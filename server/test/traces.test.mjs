import test from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, readFileSync, readdirSync, writeFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { traceRecord, appendTrace, alertsFor, alertGate, answeredBy, countReplies } from "../traces.mjs";

const NOW = Date.parse("2026-10-02T10:00:00Z");
const usage = {
  models: { main: { provider: "ollama", model: "qwen3.5:4b", contextTokens: 900 }, agenda: { provider: "anthropic", model: "claude-sonnet-5-5" } },
  providers: [{ provider: "openai", name: "OpenAI", windows: [{ label: "5h", usedPercent: 12 }, { label: "Week", usedPercent: 91 }] }],
};

test("trace : une ligne par demande, modèle réellement utilisé", () => {
  const run = { runId: "r1", agentId: "main", startedAt: NOW - 4200, request: "quel temps fait-il ?", toolNames: ["sessions_spawn"], toolCount: 1, delegatedTo: ["researcher"] };
  const t = traceRecord(run, { agentName: "Michel", usage, instructions: "amelioration-2026-10-02T13-20", now: NOW });
  assert.deepEqual([t.model, t.ms, t.delegations, t.tools, t.contextTokens, t.instructions],
    ["ollama/qwen3.5:4b", 4200, ["researcher"], ["sessions_spawn"], 900, "amelioration-2026-10-02T13-20"]);
  const dir = mkdtempSync(join(tmpdir(), "michel-traces-"));
  try {
    writeFileSync(join(dir, "2026-08-01.jsonl"), "{}\n");          // older than 30 days: pruned
    writeFileSync(join(dir, "notes.txt"), "kept");                  // not a trace file: kept
    appendTrace(dir, t, NOW); appendTrace(dir, t, NOW);
    assert.deepEqual(readdirSync(dir).sort(), ["2026-10-02.jsonl", "notes.txt"]);
    assert.equal(readFileSync(join(dir, "2026-10-02.jsonl"), "utf8").trim().split("\n").length, 2);
  } finally { rmSync(dir, { recursive: true, force: true }); }
});

test("compteur Claude : réponses par période, lues dans les traces", () => {
  const dir = mkdtempSync(join(tmpdir(), "michel-count-"));
  try {
    const line = (ts, model) => JSON.stringify({ ts, model }) + "\n";
    writeFileSync(join(dir, "2026-10-02.jsonl"), line("2026-10-02T08:00:00Z", "anthropic/claude-sonnet-5-5"));
    writeFileSync(join(dir, "2026-10-04.jsonl"), line("2026-10-04T08:00:00Z", "anthropic/claude-sonnet-5-5") + line("2026-10-04T09:30:00Z", "openai/gpt-6-astra")
      + line("2026-10-04T09:45:00Z", "anthropic/claude-sonnet-5-5") + "pas du json anthropic/\n");
    const now = Date.parse("2026-10-04T10:00:00Z");
    assert.deepEqual(countReplies(dir, "anthropic/", { last5h: now - 5 * 3600000, week: now - 7 * 86400000 }), { last5h: 2, week: 3 });
    assert.deepEqual(countReplies(join(dir, "absent"), "anthropic/", { last5h: now }), { last5h: 0 });
  } finally { rmSync(dir, { recursive: true, force: true }); }
});

test("modèle réel : lu dans la réponse, Claude Code nommé comme la configuration", () => {
  assert.deepEqual(answeredBy({ provider: "claude-cli", model: "claude-sonnet-5-5" }), { provider: "anthropic", model: "claude-sonnet-5-5" });
  assert.deepEqual(answeredBy({ provider: "ollama", model: "qwen3.5:4b" }), { provider: "ollama", model: "qwen3.5:4b" });
  assert.equal(answeredBy({ model: "automation-result" }), null);
  assert.equal(answeredBy(undefined), null);
  const t = traceRecord({ runId: "r2", agentId: "main", startedAt: NOW, model: "anthropic/claude-sonnet-5-5" }, { usage, now: NOW });
  assert.equal(t.model, "anthropic/claude-sonnet-5-5");                     // the real model wins over the session's
  const a = alertsFor({ usage: { models: { main: { provider: "anthropic", model: "claude-sonnet-5-5" }, agenda: { provider: "anthropic", model: "claude-sonnet-5-5" } } },
    primary: { main: "openai/gpt-6-astra", agenda: "anthropic/claude-sonnet-5-5" } });
  assert.deepEqual(a.map((x) => x.key), ["fallback:main:anthropic/claude-sonnet-5-5"]);   // Écrit on Claude Code is not a fallback
});

test("alertes : quota, modèle de secours, demande bloquée ; une seule fois par période", () => {
  const a = alertsFor({ usage, primary: { main: "openai/gpt-6-astra", agenda: "anthropic/claude-sonnet-5-5" },
    runs: [{ runId: "r9", agentId: "main", startedAt: NOW - 6 * 60000 }, { runId: "r8", agentId: "main", startedAt: NOW - 60000 }],
    agentName: (id) => ({ main: "Michel" })[id] ?? id, now: NOW });
  assert.deepEqual(a.map((x) => x.key), ["quota:openai:Week", "fallback:main:ollama/qwen3.5:4b", "stuck:r9"]);
  assert.match(a[0].text, /semaine utilisé à 91 %/); assert.match(a[1].text, /^Michel répond avec ollama/);
  const gate = alertGate(1000);
  assert.equal(gate("k", 0), true); assert.equal(gate("k", 500), false); assert.equal(gate("k", 1500), true);
});

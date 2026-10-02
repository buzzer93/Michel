// Agent evaluation (plan step 4): replays evals/cases.json and writes a dated report to docs/evals/.
// Run on the host, as the service account (it reads the gateway token):
//   runuser -u jarvis -- env HOME=/var/lib/jarvis /opt/jarvis-node/bin/node /opt/jarvis/server/evals/run.mjs [--only R01,M03] [--skip-agents]
//     [--agent-map main=main_candidate] [--label candidat]   (improvement loop: replay Michel's cases on the candidate)
// Each agent case runs in its own test session (agent:<id>:eval-<stamp>-<case>), so the voice conversations are not
// touched; every approval request is refused, so no case can send a mail or restart a container.
import { readFileSync, writeFileSync, mkdirSync, existsSync } from "node:fs";
import { createHash, randomUUID } from "node:crypto";
import { homedir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { GatewayClient } from "@openclaw/gateway-client";
import { PROTOCOL_VERSION } from "@openclaw/gateway-protocol/version";
import { route } from "../router.mjs";
import { readAgentsFile } from "../agents.mjs";
import { voiceBrief } from "../speech.mjs";
import { spawnTarget } from "../tools.mjs";

const HERE = dirname(fileURLToPath(import.meta.url));
const APP = join(HERE, "../..");
const args = process.argv.slice(2);
const only = args.includes("--only") ? new Set(args[args.indexOf("--only") + 1].split(",")) : null;
const skipAgents = args.includes("--skip-agents");
const optionValue = (name) => (args.includes(name) ? args[args.indexOf(name) + 1] : null);
const agentMap = Object.fromEntries((optionValue("--agent-map") ?? "").split(",").filter(Boolean).map((pair) => pair.split("=")));
const label = (optionValue("--label") ?? "").replace(/[^\w-]/g, "");
const { cases } = JSON.parse(readFileSync(join(HERE, "cases.json"), "utf8"));
const selected = cases.filter((c) => !only || only.has(c.id));
const stamp = new Date().toISOString().slice(0, 16).replace(":", "-");
const reportName = label ? `${stamp}-${label}` : stamp;
const QUIET_MS = 8000;

const sha = (file) => (existsSync(file) ? createHash("sha256").update(readFileSync(file)).digest("hex") : null);
const re = (s) => new RegExp(s, "i");

// ───────────── routing cases: the voice router alone, with the deployed roster ─────────────
function runRoute(c) {
  const agents = readAgentsFile(join(APP, "config/agents.json"));
  const got = route(c.text, { agents, activeAgent: null, followUpUntil: 0, now: 1 });
  const fails = [];
  if (got.kind !== c.expect.kind) fails.push(`type ${got.kind} au lieu de ${c.expect.kind}`);
  if (c.expect.agentId && got.agentId !== c.expect.agentId) fails.push(`agent ${got.agentId ?? "aucun"} au lieu de ${c.expect.agentId}`);
  return { fails, details: { kind: got.kind, agentId: got.agentId ?? null } };
}

// ───────────── agent cases: through the gateway ─────────────
const cfg = JSON.parse(readFileSync(join(homedir(), ".openclaw/openclaw.json"), "utf8"));
let gateway, sessions = new Map(); // sessionKey → live record of the case being run

function connect() {
  return new Promise((resolve, reject) => {
    gateway = new GatewayClient({
      url: `ws://127.0.0.1:${cfg.gateway.port}`, token: cfg.gateway.auth.token,
      minProtocol: PROTOCOL_VERSION, maxProtocol: PROTOCOL_VERSION, caps: ["tool-events", "approvals", "exec-approvals"],
      onHelloOk: async () => { try { await gateway.request("sessions.subscribe", {}); } catch { /* optional */ } resolve(); },
      onConnectError: (e) => reject(e),
      onEvent: onEvent,
    });
    gateway.start();
  });
}

function onEvent(ev) {
  const p = ev.payload ?? {};
  if (/^(plugin|exec)\.approval\.requested$/.test(ev.event ?? "")) {
    const req = p.request ?? p;
    // A delegated run asks from its own sub-session (agent:<id>:subagent:<uuid>): while a case runs, it is the case's.
    const rec = sessions.get(req.sessionKey) ?? (/:subagent:/.test(req.sessionKey ?? "") ? [...sessions.values()].at(-1) : null);
    if (!rec) return;
    let command = req.command ?? "";
    try { command = JSON.parse(req.detail ?? "{}").command ?? command; } catch { /* keep */ }
    rec.approvals.push(String(command || req.title || ""));
    rec.lastEventAt = Date.now();
    const method = ev.event.startsWith("plugin.") ? "plugin.approval.resolve" : "exec.approval.resolve";
    gateway.request(method, { id: p.id, decision: "deny" }).catch(() => {});
    return;
  }
  const rec = sessions.get(p.sessionKey);
  if (!rec) return;
  rec.lastEventAt = Date.now();
  if (ev.event === "agent" && (p.stream === "tool" || p.stream === "tools")) {
    const d = p.data ?? {};
    const target = spawnTarget(d.name ?? d.toolName ?? d.tool ?? "", d.args ?? d.input ?? d.params);
    if (target && !rec.delegations.includes(target)) rec.delegations.push(target);
  } else if (ev.event === "chat" && p.state === "final") {
    rec.finals++;
    const text = (p.message?.content ?? []).filter((x) => x.type === "text").map((x) => x.text).join("");
    if (text) rec.answer += (rec.answer ? "\n" : "") + text;
  }
}

async function runAgent(c) {
  const agent = agentMap[c.agent] ?? c.agent;
  const sessionKey = `agent:${agent}:eval-${stamp}-${c.id}`.toLowerCase();
  const rec = { delegations: [], approvals: [], finals: 0, answer: "", lastEventAt: Date.now() };
  sessions.set(sessionKey, rec);
  // On the candidate, the file to watch is its own copy (workspace-candidate instead of workspace).
  const watched = c.expect.fileUnchanged && agent !== c.agent ? c.expect.fileUnchanged.replace("/.openclaw/workspace/", "/.openclaw/workspace-candidate/") : c.expect.fileUnchanged;
  const before = watched ? sha(watched) : null;
  const t0 = Date.now(), timeout = (c.timeoutS ?? 200) * 1000;
  try {
    await gateway.request("chat.send", { sessionKey, message: `${voiceBrief("", false)}\n\n${c.text}`, idempotencyKey: `eval-${randomUUID()}` }, { timeoutMs: 60000 });
  } catch (e) { rec.error = e?.message; }
  // Done when the final answer arrived (one more after a delegation: the turn that reports the result) and the
  // session has been quiet for a moment, or on timeout.
  while (!rec.error && Date.now() - t0 < timeout) {
    await new Promise((r) => setTimeout(r, 1000));
    const needed = 1 + (rec.delegations.length ? 1 : 0);
    if (rec.finals >= needed && Date.now() - rec.lastEventAt > QUIET_MS) break;
  }
  sessions.delete(sessionKey);
  const ms = Date.now() - t0;
  let model = null, tokens = null;
  try {
    const list = await gateway.request("sessions.list", { activeMinutes: 60, limit: 200 });
    const row = list.sessions?.find((s) => s.key === sessionKey);
    model = row ? `${row.modelProvider}/${row.model}` : null; tokens = row?.totalTokens ?? null;
  } catch { /* report without it */ }

  const e = c.expect, fails = [];
  if (rec.error) fails.push(`envoi impossible : ${rec.error}`);
  if (!rec.finals) fails.push("aucune réponse finale");
  for (const a of e.delegatesTo ?? []) if (!rec.delegations.includes(a)) fails.push(`pas de délégation à ${a}`);
  for (const a of e.notDelegatesTo ?? []) if (rec.delegations.includes(a)) fails.push(`délégation à ${a} non voulue`);
  if (e.noDelegation && rec.delegations.length) fails.push(`délégation non voulue (${rec.delegations.join(", ")})`);
  if (e.answerMatches && !re(e.answerMatches).test(rec.answer)) fails.push(`réponse sans /${e.answerMatches}/`);
  if (e.answerNotMatches && re(e.answerNotMatches).test(rec.answer)) fails.push(`réponse contient /${e.answerNotMatches}/`);
  if (e.noJsonBlock && /```json/i.test(rec.answer)) fails.push("bloc JSON dans la réponse");
  if (e.approval === "none" && rec.approvals.length) fails.push(`approbation non attendue (${rec.approvals.join(" | ")})`);
  if (e.approval === "requested" && !rec.approvals.length) fails.push("aucune demande d'approbation");
  if (e.approvalMatches && rec.approvals.length && !rec.approvals.some((a) => re(e.approvalMatches).test(a))) fails.push(`approbation sans /${e.approvalMatches}/`);
  if (e.maxApprovals && rec.approvals.length > e.maxApprovals) fails.push(`${rec.approvals.length} demandes d'approbation (relance)`);
  if (watched && sha(watched) !== before) fails.push(`${watched} modifié`);
  return { fails, details: { s: Math.round(ms / 1000), model, tokens, delegations: rec.delegations, approvals: rec.approvals, answer: rec.answer.replace(/\s+/g, " ").slice(0, 240) } };
}

// ───────────── main ─────────────
const results = [];
const needGateway = !skipAgents && selected.some((c) => c.type === "agent");
if (needGateway) await connect();
for (const c of selected) {
  if (c.type === "agent" && skipAgents) continue;
  process.stdout.write(`${c.id} ${c.category} … `);
  const r = c.type === "route" ? runRoute(c) : await runAgent(c);
  results.push({ id: c.id, category: c.category, type: c.type, agent: c.agent ?? null, text: c.text, pass: !r.fails.length, fails: r.fails, ...r.details });
  console.log(r.fails.length ? `ÉCHEC (${r.fails.join(" ; ")})` : "ok");
}

const passed = results.filter((r) => r.pass).length;
// The Markdown report is versioned (and the repository will be public): answers that may carry the user's mail or
// calendar stay out of it. The JSON report keeps everything and is local (docs/evals/*.json is ignored by git).
const PRIVATE = /^(agenda)$/;
const excerpt = (r) => (PRIVATE.test(r.agent ?? "") || (r.delegations ?? []).some((a) => PRIVATE.test(a)) ? "réponse conforme (contenu privé masqué)" : (r.answer ?? "").slice(0, 90));
const byCat = {};
for (const r of results) { byCat[r.category] ??= { pass: 0, total: 0 }; byCat[r.category].total++; if (r.pass) byCat[r.category].pass++; }
const outDir = join(APP, "docs/evals");
mkdirSync(outDir, { recursive: true });
writeFileSync(join(outDir, `${reportName}.json`), JSON.stringify({ stamp, label, agentMap, passed, total: results.length, byCategory: byCat, results }, null, 2));
const md = [
  `# Évaluation des agents — ${stamp.replace("T", " ")}${label ? ` (${label})` : ""}`, "",
  `**${passed} / ${results.length} cas réussis.** Généré par \`server/evals/run.mjs\` à partir de \`server/evals/cases.json\`.`, "",
  "| Catégorie | Réussis |", "| --- | --- |", ...Object.entries(byCat).map(([k, v]) => `| ${k} | ${v.pass} / ${v.total} |`), "",
  "| Cas | Résultat | Durée | Délégations | Approbations | Détail |", "| --- | --- | --- | --- | --- | --- |",
  ...results.map((r) => `| ${r.id} | ${r.pass ? "✅" : "❌"} | ${r.s != null ? r.s + " s" : "—"} | ${(r.delegations ?? []).join(", ") || "—"} | ${(r.approvals ?? []).length || "—"} | ${(r.pass ? (r.type === "route" ? `${r.kind} ${r.agentId ?? ""}` : excerpt(r)) : r.fails.join(" ; ")).replace(/\|/g, "/")} |`),
  "",
].join("\n");
writeFileSync(join(outDir, `${reportName}.md`), md);
console.log(`\n${passed}/${results.length} — rapport : docs/evals/${reportName}.md`);
process.exit(0);

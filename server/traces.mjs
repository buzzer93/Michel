// Traces and alerts (plan step 6). One JSON line per user request in <dir>/<YYYY-MM-DD>.jsonl (kept 30 days): who
// answered, with which model, what it delegated, which tools and approvals it went through, how long, how many
// tokens. Alerts: plan quota nearly used, an agent answering on a fallback model, a request stuck for too long.
import { appendFileSync, mkdirSync, readdirSync, rmSync } from "node:fs";
import { join } from "node:path";

const KEEP_DAYS = 30;

/** Trace line of a finished request. `usage` is the last model/usage snapshot (see server refreshUsage). */
export function traceRecord(run, { agentName, usage, now = Date.now() } = {}) {
  const m = usage?.models?.[run.agentId] ?? {};
  return {
    ts: new Date(now).toISOString(), runId: run.runId, agent: run.agentId, agentName: agentName ?? run.agentId,
    request: String(run.request ?? "").slice(0, 300),
    model: m.model ? `${m.provider}/${m.model}` : null, contextTokens: m.contextTokens ?? null,
    ms: now - run.startedAt, tools: run.toolNames ?? [], toolCount: run.toolCount ?? 0,
    delegations: run.delegatedTo ?? [], approvals: run.approvals ?? [],
  };
}

/** Appends one trace and prunes the files older than KEEP_DAYS. */
export function appendTrace(dir, record, now = Date.now()) {
  mkdirSync(dir, { recursive: true, mode: 0o700 });
  appendFileSync(join(dir, `${record.ts.slice(0, 10)}.jsonl`), JSON.stringify(record) + "\n", { mode: 0o600 });
  const oldest = new Date(now - KEEP_DAYS * 86400000).toISOString().slice(0, 10);
  for (const f of readdirSync(dir)) if (/^\d{4}-\d{2}-\d{2}\.jsonl$/.test(f) && f.slice(0, 10) < oldest) rmSync(join(dir, f), { force: true });
}

/**
 * Current alert conditions: [{ key, text }]. `primary` = agentId → configured primary model ("provider/model");
 * `runs` = [{ runId, agentId, startedAt }] still running.
 */
export function alertsFor({ usage, primary = {}, runs = [], agentName = (id) => id, now = Date.now(), quotaPercent = 85, stuckMinutes = 5 }) {
  const out = [];
  for (const p of usage?.providers ?? []) for (const w of p.windows ?? []) {
    if (w.usedPercent >= quotaPercent) out.push({ key: `quota:${p.provider}:${w.label}`, text: `quota ${p.name ?? p.provider} ${w.label === "Week" ? "de la semaine" : w.label} utilisé à ${w.usedPercent} %` });
  }
  for (const [id, m] of Object.entries(usage?.models ?? {})) {
    const used = m.model ? `${m.provider}/${m.model}` : null, want = primary[id];
    if (used && want && used !== want) out.push({ key: `fallback:${id}:${used}`, text: `${agentName(id)} répond avec ${used} (modèle de secours, au lieu de ${want})` });
  }
  for (const r of runs) {
    const minutes = (now - r.startedAt) / 60000;
    if (minutes >= stuckMinutes) out.push({ key: `stuck:${r.runId}`, text: `demande à ${agentName(r.agentId)} en cours depuis ${minutes < 1 ? "moins d'une minute" : `${Math.floor(minutes)} min`}` });
  }
  return out;
}

/** Same alert at most once per `cooldownMs`. */
export function alertGate(cooldownMs = 30 * 60000) {
  const last = new Map();
  return (key, now = Date.now()) => {
    if (now - (last.get(key) ?? -Infinity) < cooldownMs) return false;
    last.set(key, now);
    return true;
  };
}

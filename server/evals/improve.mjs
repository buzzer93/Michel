// Improvement loop (plan step 8): observe → propose → apply on a branch → evaluate → the user decides.
// Run on the host as the service account:
//   runuser -u jarvis -- env HOME=/var/lib/jarvis /opt/jarvis-node/bin/node /opt/jarvis/server/evals/improve.mjs
// 1. Report: failures of the latest reference evaluation and a summary of the week's traces (no request text).
// 2. Michel Organise proposes ONE precise change to Michel's instructions (agents/main/AGENTS.md only).
// 3. Michel Construit applies it in his clone, on a fresh branch from the committed state, and commits.
// 4. The hidden candidate (main_candidate) receives the changed instructions; the failed cases and a regression set are
//    replayed on Michel and on the candidate.
// 5. The record waits in /var/lib/jarvis/improvements/ for the user's decision in the dashboard (nothing is applied here).
// Weekly (systemd jarvis-improve.timer, Tuesday evening after the weekly quota reset): --weekly does nothing while a
// record still waits for the user or when the plan quota is already high, and starts with a full evaluation so that
// the report rests on a fresh reference (not on failures already fixed).
// Afterwards, to make an applied change durable in the repository (the records are only readable by jarvis and root;
// writing in place keeps the file's owner), then review and commit it:
//   sudo env HOME=/var/lib/jarvis /opt/jarvis-node/bin/node /opt/jarvis/server/evals/improve.mjs --apply-repo <id>
import { existsSync, mkdirSync, readFileSync, readdirSync, writeFileSync } from "node:fs";
import { execFileSync } from "node:child_process";
import { randomUUID } from "node:crypto";
import { homedir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { GatewayClient } from "@openclaw/gateway-client";
import { PROTOCOL_VERSION } from "@openclaw/gateway-protocol/version";

const HERE = dirname(fileURLToPath(import.meta.url));
const APP = join(HERE, "../..");
const STATE = join(homedir(), ".openclaw");
const CLONE = join(STATE, "workspace-implementer/project");
const LIVE_WS = join(STATE, "workspace"), CANDIDATE_WS = join(STATE, "workspace-candidate");
const RECORDS = join(homedir(), "improvements");
const TARGET_FILE = "agents/main/AGENTS.md";             // v1 scope: Michel's instructions only
const REGRESSION = ["M01", "M02", "M03", "M04", "M05", "M06", "M07", "M08", "S02", "S04"];
const QUOTA_MAX_EVAL = 50, QUOTA_MAX_PROPOSAL = 75;      // --weekly: highest plan usage (%) at which each phase may start
const stamp = new Date().toISOString().slice(0, 16).replace(":", "-");
const id = `amelioration-${stamp}`;
const git = (...a) => execFileSync("git", ["-C", CLONE, ...a], { encoding: "utf8" }).trim();
const say = (s) => console.log(`[${new Date().toISOString().slice(11, 19)}] ${s}`);

// ───────────── --apply-repo: copy an applied change into the repository working tree (repository owner) ─────────────
if (process.argv[2] === "--apply-repo") {
  const rec = JSON.parse(readFileSync(join(RECORDS, `${process.argv[3]}.json`), "utf8"));
  if (rec.status !== "appliquée") throw new Error(`statut ${rec.status} : seule une amélioration appliquée peut être reportée`);
  writeFileSync(join(APP, rec.file), rec.newContent);
  console.log(`${rec.file} mis à jour dans le dépôt (commit à faire) : ${rec.why}`);
  process.exit(0);
}

const cfg = JSON.parse(readFileSync(join(STATE, "openclaw.json"), "utf8"));
const weekly = process.argv.includes("--weekly");
if (weekly && existsSync(RECORDS) && readdirSync(RECORDS).some((f) => f.endsWith(".json") && JSON.parse(readFileSync(join(RECORDS, f), "utf8")).status === "en attente")) {
  say("une amélioration attend déjà la décision de l'utilisateur : rien de lancé");
  process.exit(0);
}

// ───────────── gateway helper: one message, the final answer ─────────────
let gateway;
const pending = new Map();
try {
  await Promise.race([
    new Promise((resolve, reject) => {
      gateway = new GatewayClient({
        url: `ws://127.0.0.1:${cfg.gateway.port}`, token: cfg.gateway.auth.token, minProtocol: PROTOCOL_VERSION, maxProtocol: PROTOCOL_VERSION,
        caps: ["approvals", "exec-approvals"],
        onHelloOk: resolve, onConnectError: reject,
        onEvent: (ev) => {
          const p = ev.payload ?? {};
          if (/^(plugin|exec)\.approval\.requested$/.test(ev.event ?? "")) {   // nothing here may act outside: refuse
            gateway.request(ev.event.startsWith("plugin.") ? "plugin.approval.resolve" : "exec.approval.resolve", { id: p.id, decision: "deny" }).catch(() => {});
            return;
          }
          const rec = pending.get(p.sessionKey);
          if (!rec) return;
          rec.last = Date.now();
          if (ev.event === "chat" && p.state === "final") {
            rec.finals++;
            rec.text += (p.message?.content ?? []).filter((c) => c.type === "text").map((c) => c.text).join("");
          }
        },
      });
      gateway.start();
    }),
    new Promise((_, reject) => setTimeout(() => reject(new Error("délai de connexion")), 30000)),
  ]);
} catch (e) {
  say(`gateway injoignable (${e?.message}) : Jarvis est-il arrêté ? Rien de lancé`);
  process.exit(weekly ? 0 : 1);
}
async function ask(agent, message, timeoutS = 300) {
  const key = `agent:${agent}:improve-${stamp}`.toLowerCase();
  const rec = { finals: 0, text: "", last: Date.now() };
  pending.set(key, rec);
  await gateway.request("chat.send", { sessionKey: key, message, idempotencyKey: `improve-${randomUUID()}` }, { timeoutMs: 60000 });
  const t0 = Date.now();
  while (Date.now() - t0 < timeoutS * 1000 && !(rec.finals && Date.now() - rec.last > 8000)) await new Promise((r) => setTimeout(r, 1000));
  pending.delete(key);
  return rec.text;
}
/** Highest usage (%) among the plan windows of Michel's primary provider, as the gateway reports it. */
async function quotaUsed() {
  const usage = await gateway.request("usage.status", {}, { timeoutMs: 20000 });
  const provider = String(cfg.agents?.entries?.main?.model?.primary ?? "").split("/")[0];
  return Math.max(0, ...((usage?.providers ?? []).find((p) => p.provider === provider)?.windows ?? []).map((w) => w.usedPercent ?? 0));
}
async function quotaAllows(max, what) {
  const used = await quotaUsed();
  if (used <= max) return true;
  say(`quota à ${used} % (au-dessus de ${max} %) : ${what} reportée à la semaine prochaine`);
  return false;
}
if (weekly) {
  if (!(await quotaAllows(QUOTA_MAX_EVAL, "évaluation"))) process.exit(0);
  say("évaluation complète (nouvelle référence)");
  execFileSync(process.execPath, [join(HERE, "run.mjs")], { encoding: "utf8", maxBuffer: 1 << 24 });
}

// ───────────── 1. report ─────────────
const evals = join(APP, "docs/evals");
const refFile = readdirSync(evals).filter((f) => /^\d{4}-\d{2}-\d{2}T\d{2}-\d{2}\.json$/.test(f)).sort().at(-1);
if (!refFile) throw new Error("aucune évaluation de référence dans docs/evals (lancer d'abord run.mjs)");
const ref = JSON.parse(readFileSync(join(evals, refFile), "utf8"));
const failures = ref.results.filter((r) => !r.pass);
const cases = JSON.parse(readFileSync(join(HERE, "cases.json"), "utf8")).cases;
const traceDir = join(homedir(), "traces");
const week = Date.now() - 7 * 86400000;
const traces = existsSync(traceDir) ? readdirSync(traceDir).filter((f) => f.endsWith(".jsonl")).flatMap((f) =>
  readFileSync(join(traceDir, f), "utf8").split("\n").filter(Boolean).map((l) => { try { return JSON.parse(l); } catch { return null; } }))
  .filter((t) => t && Date.parse(t.ts) >= week) : [];
const primary = (agent) => cfg.agents?.entries?.[agent]?.model?.primary;
const ms = traces.map((t) => t.ms).sort((a, b) => a - b);
const stats = {
  requests: traces.length, medianS: ms.length ? Math.round(ms[Math.floor(ms.length / 2)] / 1000) : null,
  over60s: traces.filter((t) => t.ms > 60000).length,
  fallback: traces.filter((t) => t.model && primary(t.agent) && t.model !== primary(t.agent)).length,
  refused: traces.flatMap((t) => t.approvals ?? []).filter((a) => a.outcome === "refusée d'office").length,
};
const report = [
  `# Rapport d'amélioration — ${stamp.replace("T", " ")}`, "",
  `Évaluation de référence : \`docs/evals/${refFile.replace(".json", ".md")}\` — ${ref.passed} / ${ref.total}.`, "",
  "## Échecs", "", ...(failures.length ? failures.map((f) => `- **${f.id}** (${f.category}) : ${f.fails.join(" ; ")}`) : ["- aucun"]), "",
  "## Traces des 7 derniers jours", "",
  `- demandes : ${stats.requests} ; durée médiane : ${stats.medianS ?? "—"} s ; plus de 60 s : ${stats.over60s}`,
  `- réponses sur un modèle de secours : ${stats.fallback} ; actions refusées d'office : ${stats.refused}`, "",
].join("\n");
writeFileSync(join(evals, `rapport-${stamp}.md`), report);
say(`rapport : docs/evals/rapport-${stamp}.md (${failures.length} échec(s))`);
if (!failures.length) { say("rien à améliorer"); process.exit(0); }
if (weekly && !(await quotaAllows(QUOTA_MAX_PROPOSAL, "proposition"))) process.exit(0);

// ───────────── 2. proposal (Michel Organise) ─────────────
const failureText = failures.map((f) => {
  const c = cases.find((x) => x.id === f.id) ?? {};
  return `- ${f.id} : message « ${c.text} » à ${c.agent} ; attendu ${JSON.stringify(c.expect)} ; constaté : ${f.fails.join(" ; ")}`;
}).join("\n");
const proposalAnswer = await ask("planner", [
  "Boucle d'amélioration du système. Voici les cas d'évaluation en échec :", failureText, "",
  `Lis project/${TARGET_FILE} (les consignes de Michel, le chef d'équipe). Propose UNE seule correction précise de ce fichier qui`,
  "corrige ces échecs sans affaiblir aucune règle de sécurité ni changer le comportement des autres cas. Si l'échec vient plutôt",
  "d'une attente de test discutable, dis-le dans « why » et propose quand même la correction la plus petite.",
  "Réponds en terminant par exactement ce format, le texte de « find » devant exister tel quel une seule fois dans le fichier :",
  `<proposition>{"file": "${TARGET_FILE}", "find": "…", "replace": "…", "why": "…"}</proposition>`,
].join("\n"));
const m = /<proposition>([\s\S]*?)<\/proposition>/.exec(proposalAnswer);
let proposal;
try { proposal = JSON.parse(m?.[1] ?? "null"); } catch { proposal = null; }
const base = execFileSync("git", ["-C", APP, "show", `HEAD:${TARGET_FILE}`], { encoding: "utf8" });
if (!proposal || proposal.file !== TARGET_FILE || typeof proposal.find !== "string" || typeof proposal.replace !== "string"
  || base.split(proposal.find).length !== 2 || proposal.find === proposal.replace) {
  throw new Error(`proposition inutilisable : ${(m?.[1] ?? proposalAnswer).slice(0, 400)}`);
}
say(`proposition d'Organise : ${proposal.why}`);

// ───────────── 3. branch + Michel Construit ─────────────
git("fetch", "-q", "origin");
const branch = `amelioration/${stamp}`;
git("switch", "-q", "-c", branch, "origin/agentic-os");
const baseCommit = git("rev-parse", "HEAD");
// The implementer's git allowlist refuses ".." anywhere in the arguments, and the message goes between double quotes.
const commitMsg = `Amélioration ${stamp} : ${proposal.why}`.slice(0, 120).replace(/"/g, "'").replace(/\.{2,}/g, ".");
await ask("implementer", [
  `Dans ton clone (project/), dans le fichier project/${TARGET_FILE}, remplace exactement ce texte :`, "<<<", proposal.find, ">>>",
  "par celui-ci :", "<<<", proposal.replace, ">>>",
  `Puis lance git -C project add ${TARGET_FILE} et git -C project commit -m "${commitMsg}". Ne modifie aucun autre fichier.`,
].join("\n"));
const commit = git("rev-parse", "HEAD");
const changed = commit === baseCommit ? [] : git("diff", "--name-only", baseCommit, commit).split("\n").filter(Boolean);
const newContent = readFileSync(join(CLONE, TARGET_FILE), "utf8");
if (commit === baseCommit || changed.join() !== TARGET_FILE || newContent !== base.replace(proposal.find, proposal.replace)) {
  throw new Error(`Construit n'a pas appliqué exactement la correction (commit ${commit === baseCommit ? "absent" : commit.slice(0, 7)}, fichiers : ${changed.join(", ") || "aucun"})`);
}
const diff = git("diff", baseCommit, commit);
say(`Construit : commit ${commit.slice(0, 7)} sur ${branch}`);

// ───────────── 4. candidate + evaluation ─────────────
const live = readFileSync(join(LIVE_WS, "AGENTS.md"), "utf8");
const roster = live.slice(live.indexOf("\n# Available agents"));
writeFileSync(join(CANDIDATE_WS, "AGENTS.md"), newContent + roster);   // in place: read-only bind inside the gateway
for (const f of ["SOUL.md", "USER.md", "MEMORY.md"]) if (existsSync(join(LIVE_WS, f))) writeFileSync(join(CANDIDATE_WS, f), readFileSync(join(LIVE_WS, f)));
const ids = [...new Set([...failures.map((f) => f.id), ...REGRESSION])].join(",");
const evalRun = (extra) => execFileSync(process.execPath, [join(HERE, "run.mjs"), "--only", ids, ...extra], { encoding: "utf8", maxBuffer: 1 << 24 });
const summary = (label) => {
  const f = readdirSync(evals).filter((x) => x.endsWith(`-${label}.json`)).sort().at(-1);
  const r = JSON.parse(readFileSync(join(evals, f), "utf8"));
  return { report: `docs/evals/${f.replace(".json", ".md")}`, passed: r.passed, total: r.total, failed: r.results.filter((x) => !x.pass).map((x) => x.id) };
};
say(`évaluation de Michel sur ${ids}`);
evalRun(["--label", `base-${stamp}`]);
say("évaluation du candidat");
evalRun(["--agent-map", "main=main_candidate", "--label", `candidat-${stamp}`]);
const before = summary(`base-${stamp}`), after = summary(`candidat-${stamp}`);
const regressions = after.failed.filter((x) => !before.failed.includes(x));
say(`Michel ${before.passed}/${before.total} → candidat ${after.passed}/${after.total}${regressions.length ? ` ; régressions : ${regressions.join(", ")}` : ""}`);

// ───────────── 5. record for the user's decision ─────────────
mkdirSync(RECORDS, { recursive: true, mode: 0o700 });
const record = {
  id, createdAt: new Date().toISOString(), status: "en attente", reportFile: `docs/evals/rapport-${stamp}.md`, failures: failures.map((f) => f.id),
  file: TARGET_FILE, why: String(proposal.why ?? "").slice(0, 600), find: proposal.find, replace: proposal.replace,
  branch, commit, diff: diff.slice(0, 20000), newContent, before, after, regressions,
  recommended: after.passed > before.passed && !regressions.length,
};
writeFileSync(join(RECORDS, `${id}.json`), JSON.stringify(record, null, 2), { mode: 0o600 });
say(`en attente de décision dans le dashboard : ${id}${record.recommended ? " (recommandée)" : " (non recommandée)"}`);
process.exit(0);

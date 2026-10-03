// Improvement loop, decision side (plan step 8.5–8.6): the records written by evals/improve.mjs wait for the user in
// the dashboard. Apply = Michel's live instructions take the candidate's (the previous text is kept for "Annuler");
// refuse = nothing changes. Live files are rewritten in place: inside the gateway they are read-only bind mounts.
import { existsSync, readdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";

const ROSTER = "\n# Available agents";

/** Light view of the latest records for the dashboard (newest first). */
export function listImprovements(dir, limit = 3) {
  if (!existsSync(dir)) return [];
  return readdirSync(dir).filter((f) => f.endsWith(".json")).sort().reverse().slice(0, limit).map((f) => {
    const r = JSON.parse(readFileSync(join(dir, f), "utf8"));
    return { id: r.id, createdAt: r.createdAt, status: r.status, why: r.why, failures: r.failures, before: r.before, after: r.after,
      regressions: r.regressions, recommended: r.recommended, diff: r.diff, file: r.file, source: r.source ?? "boucle" };
  });
}

/** Michel's live AGENTS.md with the candidate program and the live roster (generated at deploy time). */
const withRoster = (program, live) => program + (live.includes(ROSTER) ? live.slice(live.indexOf(ROSTER)) : "");

/** action: "apply" | "refuse" | "rollback". Returns the updated record, or null when the action does not apply. */
export function decideImprovement(dir, liveAgentsFile, id, action, now = new Date()) {
  const file = join(dir, `${String(id).replace(/[^\w-]/g, "")}.json`);
  if (!existsSync(file)) return null;
  const r = JSON.parse(readFileSync(file, "utf8"));
  if (action === "apply" && r.status === "en attente") {
    const live = readFileSync(liveAgentsFile, "utf8");
    r.backup = live;
    writeFileSync(liveAgentsFile, withRoster(r.newContent, live));
    Object.assign(r, { status: "appliquée", decidedAt: now.toISOString() });
  } else if (action === "refuse" && r.status === "en attente") {
    Object.assign(r, { status: "refusée", decidedAt: now.toISOString() });
  } else if (action === "rollback" && r.status === "appliquée" && typeof r.backup === "string") {
    writeFileSync(liveAgentsFile, r.backup);
    Object.assign(r, { status: "annulée", rolledBackAt: now.toISOString() });
  } else return null;
  writeFileSync(file, JSON.stringify(r, null, 2));
  return r;
}

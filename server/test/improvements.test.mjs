import test from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, readFileSync, rmSync, statSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { listImprovements, decideImprovement } from "../improvements.mjs";

const LIVE = "# Identity\n\nOld rule.\n\n# Available agents (generated from agents/*/agent.json)\n\n- `planner`\n";

function setup() {
  const dir = mkdtempSync(join(tmpdir(), "jarvis-improve-"));
  const live = join(dir, "AGENTS.md");
  writeFileSync(live, LIVE);
  writeFileSync(join(dir, "amelioration-1.json"), JSON.stringify({ id: "amelioration-1", status: "en attente", why: "déléguer les plans",
    newContent: "# Identity\n\nNew rule.\n", before: { passed: 9, total: 10 }, after: { passed: 10, total: 10 }, regressions: [], recommended: true }));
  return { dir, live };
}

test("amélioration : appliquer garde la liste d'agents en direct, annuler restaure, en place", () => {
  const { dir, live } = setup();
  try {
    const inode = statSync(live).ino;
    assert.equal(listImprovements(dir)[0].status, "en attente");
    assert.equal(decideImprovement(dir, live, "amelioration-1", "rollback"), null);   // nothing applied yet
    assert.equal(decideImprovement(dir, live, "amelioration-1", "apply").status, "appliquée");
    assert.equal(readFileSync(live, "utf8"), "# Identity\n\nNew rule.\n\n# Available agents (generated from agents/*/agent.json)\n\n- `planner`\n");
    assert.equal(statSync(live).ino, inode);
    assert.equal(decideImprovement(dir, live, "amelioration-1", "apply"), null);      // already decided
    assert.equal(decideImprovement(dir, live, "amelioration-1", "rollback").status, "annulée");
    assert.equal(readFileSync(live, "utf8"), LIVE);
  } finally { rmSync(dir, { recursive: true, force: true }); }
});

test("amélioration : refuser ne touche à rien ; identifiant inconnu ou piégé ignoré", () => {
  const { dir, live } = setup();
  try {
    assert.equal(decideImprovement(dir, live, "amelioration-1", "refuse").status, "refusée");
    assert.equal(readFileSync(live, "utf8"), LIVE);
    assert.equal(decideImprovement(dir, live, "../../etc/passwd", "apply"), null);
    assert.equal(decideImprovement(dir, live, "inconnu", "apply"), null);
  } finally { rmSync(dir, { recursive: true, force: true }); }
});

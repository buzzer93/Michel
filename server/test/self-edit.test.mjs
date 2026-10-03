import test from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, readFileSync, readdirSync, rmSync, statSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { stripSelfEdits, extractSelfEdits, addProposal, addRule, readRules, removeRule, instructionChange } from "../self-edit.mjs";
import { parseProposals, memoryStore } from "../memory.mjs";

const REPLY = `<voix>C'est noté, je m'en souviendrai.</voix>
<proposer type="fait">Le bateau de l'utilisateur est à Cargèse</proposer>
<regle>Quand l'utilisateur demande la météo marine, chercher Cargèse sur Windfinder</regle>
<consigne><avant>- old rule;</avant><apres>- new rule;</apres><raison>demandé par l'utilisateur</raison></consigne>`;

test("auto-modification : balises lues, jamais dites ni affichées", () => {
  assert.equal(stripSelfEdits(REPLY).trim(), "<voix>C'est noté, je m'en souviendrai.</voix>");
  assert.equal(stripSelfEdits("Réponse.\n<regle>Quand je dis"), "Réponse.\n");          // tag still streaming
  const e = extractSelfEdits(REPLY);
  assert.deepEqual(e.proposals, [{ kind: "fait", text: "Le bateau de l'utilisateur est à Cargèse" }]);
  assert.deepEqual(e.rules, ["Quand l'utilisateur demande la météo marine, chercher Cargèse sur Windfinder"]);
  assert.deepEqual(e.changes, [{ find: "- old rule;", replace: "- new rule;", why: "demandé par l'utilisateur" }]);
  assert.deepEqual(extractSelfEdits("<proposer>préfère le thé</proposer>").proposals, [{ kind: "préférence", text: "préfère le thé" }]);
});

test("auto-modification : proposition à valider, règle directe et supprimable, en place", () => {
  const ws = mkdtempSync(join(tmpdir(), "michel-self-"));
  try {
    writeFileSync(join(ws, "propositions.md"), "# Propositions\n");
    addProposal(ws, { kind: "fait", text: "Le bateau est à Cargèse" });
    assert.equal(parseProposals(readFileSync(join(ws, "propositions.md"), "utf8"))[0].text, "Le bateau est à Cargèse");
    writeFileSync(join(ws, "USER.md"), "L’utilisateur souhaite une conversation en français.");
    const inode = statSync(join(ws, "USER.md")).ino;
    assert.equal(addRule(ws, "Règle A", "2026-10-03"), true);
    assert.equal(addRule(ws, "Règle A", "2026-10-03"), false);                    // no duplicate
    addRule(ws, "Règle B", "2026-10-03");
    assert.deepEqual(readRules(ws).map((r) => r.text), ["Règle A", "Règle B"]);
    assert.equal(removeRule(ws, readRules(ws)[0].id), true);
    assert.deepEqual(readRules(ws).map((r) => r.text), ["Règle B"]);
    assert.match(readFileSync(join(ws, "USER.md"), "utf8"), /^L’utilisateur souhaite une conversation en français\.\n\n## Règles de travail\n\n- Règle B/);
    assert.equal(statSync(join(ws, "USER.md")).ino, inode);
  } finally { rmSync(ws, { recursive: true, force: true }); }
});

test("auto-modification : une règle attend le clic, puis va dans « Règles de travail »", () => {
  const ws = mkdtempSync(join(tmpdir(), "michel-regle-"));
  try {
    writeFileSync(join(ws, "propositions.md"), "# Propositions\n");
    writeFileSync(join(ws, "USER.md"), "Préférences.\n");
    addProposal(ws, { kind: "règle", text: "Météo marine = Cargèse sur Windfinder" });
    const store = memoryStore(ws);
    const [p] = store.snapshot().proposals;
    assert.equal(p.kind, "règle");
    assert.deepEqual(store.snapshot().rules, []);                                   // nothing applied before the click
    store.decide(p.id, true, "2026-10-03");
    assert.deepEqual(store.snapshot().rules.map((r) => r.text), ["Météo marine = Cargèse sur Windfinder"]);
    assert.deepEqual(store.snapshot().proposals, []);
  } finally { rmSync(ws, { recursive: true, force: true }); }
});

test("auto-modification : changement de consigne en attente dans le panneau Amélioration", () => {
  const dir = mkdtempSync(join(tmpdir(), "michel-consigne-"));
  try {
    const live = join(dir, "AGENTS.md");
    writeFileSync(live, "# Identity\n\n- old rule;\n\n# Available agents (generated)\n\n- `planner`\n");
    const r = instructionChange(join(dir, "improvements"), live, { find: "- old rule;", replace: "- new rule;", why: "test" }, new Date("2026-10-03T16:00:00Z"));
    assert.equal(r.status, "en attente");
    assert.equal(r.newContent, "# Identity\n\n- new rule;\n");                       // program only: the roster stays live
    assert.deepEqual(readdirSync(join(dir, "improvements")), ["consigne-2026-10-03T16-00-00.json"]);
    assert.equal(instructionChange(join(dir, "improvements"), live, { find: "absent", replace: "x" }), null);
    assert.equal(instructionChange(join(dir, "improvements"), live, { find: "`planner`", replace: "x" }), null);   // roster not editable
  } finally { rmSync(dir, { recursive: true, force: true }); }
});

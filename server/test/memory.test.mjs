import test from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, writeFileSync, readFileSync, mkdirSync, rmSync, statSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { parseProposals, withoutProposal, memoryStore } from "../memory.mjs";

const SAMPLE = "# Propositions à valider\n\n- [préférence] Préfère le thé au café\nune ligne libre\n- [fait] Habite à Grenoble\n";

test("mémoire : propositions lues ligne à ligne, le reste ignoré", () => {
  const p = parseProposals(SAMPLE);
  assert.deepEqual(p.map((x) => [x.kind, x.text]), [["préférence", "Préfère le thé au café"], ["fait", "Habite à Grenoble"]]);
  assert.match(p[0].id, /^[0-9a-f]{12}$/);
  assert.equal(parseProposals(withoutProposal(SAMPLE, p[0].id)).length, 1);
  assert.match(withoutProposal(SAMPLE, p[0].id), /une ligne libre/);   // free text kept
});

test("mémoire : valider ajoute au bon fichier (en place), rejeter n'ajoute rien", () => {
  const dir = mkdtempSync(join(tmpdir(), "jarvis-mem-"));
  try {
    writeFileSync(join(dir, "propositions.md"), SAMPLE);
    writeFileSync(join(dir, "USER.md"), "L'utilisateur parle français.\n");
    const inode = statSync(join(dir, "USER.md")).ino;
    const store = memoryStore(dir);
    const [pref, fact] = store.snapshot().proposals;
    assert.equal(store.decide(pref.id, true, "2026-10-01").kind, "préférence");
    assert.equal(readFileSync(join(dir, "USER.md"), "utf8"), "L'utilisateur parle français.\n- Préfère le thé au café (validé par l'utilisateur le 2026-10-01)\n");
    assert.equal(statSync(join(dir, "USER.md")).ino, inode);           // appended in place (bind mount stays valid)
    store.decide(fact.id, false);
    assert.throws(() => readFileSync(join(dir, "MEMORY.md")));         // rejected: nothing written
    assert.equal(store.snapshot().proposals.length, 0);
    assert.equal(store.decide("inconnu", true), null);
    mkdirSync(join(dir, "notes"));
    writeFileSync(join(dir, "notes", "courses.md"), "- [ ] lait\n");
    assert.deepEqual(store.snapshot().notes.map((n) => [n.name, n.text]), [["courses", "- [ ] lait\n"]]);
  } finally { rmSync(dir, { recursive: true, force: true }); }
});

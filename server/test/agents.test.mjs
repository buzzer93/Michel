import test from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, writeFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { discoverAgents, delegationTargets, loadAgents, readTeamTaglines, buildSttPrompt, assignVoices, normalizeAgent, fnv1a, readVoiceIds, PALETTE, DEFAULT_GLYPH } from "../agents.mjs";
import { route } from "../router.mjs";

const APP = new URL("../../", import.meta.url).pathname;
// A configuration in the shape of ~/.openclaw/openclaw.json (agents.entries keyed by id).
const ocCfg = { agents: { entries: {
  zoe: { workspace: "/w/zoe" },
  main: { workspace: "/w" },
  "jean-luc": { name: "Jean-Luc", identity: { name: "Jean-Luc", emoji: "🛰️" } },
  lea: { identity: { name: "Léa" }, model: { primary: "x" } },
} } };

test("découverte depuis openclaw.json : main en tête, nom, alias, couleur, glyphe", () => {
  const agents = discoverAgents(ocCfg);
  assert.deepEqual(agents.map((a) => a.id), ["main", "zoe", "jean-luc", "lea"]);
  assert.deepEqual(agents.map((a) => a.name), ["Michel", "Zoe", "Jean-Luc", "Léa"]); // unnamed default agent = the app's name
  assert.deepEqual(agents[0].aliases, ["michel"]);          // never "main" (French word)
  assert.deepEqual(agents[2].aliases, ["jean-luc"]);        // id identical to the name: not repeated
  assert.deepEqual(agents[3].aliases, ["lea"]);             // accent-free
  assert.equal(agents[2].glyph, "🛰️"); assert.equal(agents[1].glyph, DEFAULT_GLYPH);
  assert.deepEqual(agents.map((a) => a.color), PALETTE.slice(0, 4));
  assert.equal(agents[3].avatarKey, "lea");
  assert.equal(discoverAgents({ agents: { list: [{ id: "bob" }] } })[0].name, "Bob"); // older array layout
  assert.deepEqual(discoverAgents({ agents: { entries: { main: {}, researcher: {}, planner: {} } } }, { excludeIds: ["researcher", "planner"] }).map((a) => a.id), ["main"]);
  assert.deepEqual(discoverAgents({}), []);
});

test("les spécialistes joignables seulement par délégation sont exclus du rail vocal", () => {
  const team = { agents: { entries: {
    main: {},
    orchestrator: { identity: { name: "Atlas" }, subagents: { allowAgents: ["researcher", "planner"] } },
    researcher: { subagents: { allowAgents: [] } },
    planner: {},
    agenda: { identity: { name: "Iris" } },
  } } };
  assert.deepEqual(delegationTargets(team), ["researcher", "planner"]);
  assert.deepEqual(discoverAgents(team, { excludeIds: delegationTargets(team) }).map((a) => a.name), ["Michel", "Atlas", "Iris"]);
  assert.deepEqual(delegationTargets({}), []);
});

test("un nom en plusieurs mots donne un alias en plusieurs mots", () => {
  const [agent] = discoverAgents({ agents: { entries: { agenda: { identity: { name: "Michel Écrit" } } } } });
  assert.deepEqual(agent.aliases, ["michel ecrit", "agenda"]);
  assert.equal(agent.avatarKey, "michel-ecrit");
});

test("les agents découverts sont routables par le prénom", () => {
  const agents = discoverAgents(ocCfg);
  assert.deepEqual(route("Léa, quelle heure est-il ?", { agents, activeAgent: null, followUpUntil: 0, now: 1 }), { kind: "message", agentId: "lea", text: "quelle heure est-il?" });
  assert.equal(route("Jean-Luc, annule", { agents, activeAgent: null, followUpUntil: 0, now: 1 }).kind, "cancel");
  assert.equal(route("Donne-moi un coup de main", { agents, activeAgent: null, followUpUntil: 0, now: 1 }).kind, "ignored");
});

test("loadAgents : fichier local, sinon openclaw.json, sinon l'exemple", () => {
  const dir = mkdtempSync(join(tmpdir(), "michel-agents-"));
  try {
    const file = join(dir, "agents.json");
    writeFileSync(file, JSON.stringify({ agents: [{ id: "x", name: "Xavier" }] }));
    assert.equal(loadAgents({ app: APP, ocCfg, env: { MICHEL_AGENTS_FILE: file } }).agents[0].name, "Xavier");
    const auto = loadAgents({ app: APP, ocCfg, env: { MICHEL_AGENTS_FILE: join(dir, "absent.json") } });
    assert.equal(auto.source, "openclaw.json"); assert.equal(auto.agents.length, 4);
    const ex = loadAgents({ app: APP, ocCfg: {}, env: { MICHEL_AGENTS_FILE: join(dir, "absent.json") } });
    assert.equal(ex.source, "config/agents.example.json"); assert.ok(ex.agents.length >= 1);
  } finally { rmSync(dir, { recursive: true, force: true }); }
});

test("rôle affiché : sous-titre des agents vocaux et des spécialistes de l'équipe", () => {
  const dir = mkdtempSync(join(tmpdir(), "michel-team-"));
  try {
    const file = join(dir, "agents.json");
    writeFileSync(file, JSON.stringify({ agents: [{ id: "dev", name: "Michel Compile", tagline: "GitHub & Docker" }], team: [{ id: "implementer", name: "Michel Construit", tagline: "modifie le code" }, { id: "planner" }] }));
    assert.equal(loadAgents({ app: APP, ocCfg, env: { MICHEL_AGENTS_FILE: file } }).agents[0].tagline, "GitHub & Docker");
    assert.deepEqual([...readTeamTaglines(file)], [["implementer", "modifie le code"]]); // no tagline: left out
    assert.equal(normalizeAgent({ id: "x" }).tagline, null);
    assert.equal(readTeamTaglines(join(dir, "absent.json")).size, 0);
    assert.equal(readTeamTaglines(null).size, 0);
  } finally { rmSync(dir, { recursive: true, force: true }); }
});

test("amorce Whisper : phrases complètes avec les prénoms, jamais une liste nue", () => {
  const p = buildSttPrompt(discoverAgents(ocCfg));
  assert.match(p, /^Michel, quelle heure est-il \? Stop\. Zoe, relis le rapport\. Jean-Luc, annule\. Léa, /);
  assert.ok(p.endsWith(" Stop."));
  assert.equal(buildSttPrompt([normalizeAgent({ id: "solo", name: "Solo" })]).match(/Solo,/g).length, 4); // one agent still gets several examples
  assert.equal(buildSttPrompt([]), "");
});

test("voix : mapping explicite prioritaire, sinon attribution stable et sans doublon", () => {
  const catalogue = readVoiceIds(join(APP, "vendor/voices/voices.json"));
  assert.ok(catalogue.length >= 4 && catalogue.every((v) => /^fr-[mf]-[a-z-]+$/.test(v)), catalogue.join());
  // A fixed list of 7 voices for the slot arithmetic below: it must not depend on the catalogue's size.
  const voices = ["fr-m-a", "fr-f-b", "fr-m-c", "fr-f-d", "fr-m-e", "fr-f-f", "fr-m-g"];
  const team = discoverAgents(ocCfg);
  const auto = assignVoices(team, voices);
  assert.equal(new Set(auto.values()).size, team.length);                     // distinct timbres
  const slot = (id) => fnv1a(id) % voices.length;
  assert.equal(auto.get("main"), voices[slot("main")]);                       // first agent: its hash slot
  assert.equal(assignVoices([team[3]], voices).get("lea"), voices[slot("lea")]); // alone: its hash slot
  assert.equal(slot("lea"), slot("main"));                                     // this fixture collides on purpose…
  assert.equal(auto.get("lea"), voices[(slot("lea") + 1) % voices.length]);   // …so lea moves to the next free voice
  assert.deepEqual(assignVoices(team, voices), auto);                          // deterministic
  const explicit = assignVoices([normalizeAgent({ id: "lea", voice: voices[1] }), team[0]], voices);
  assert.equal(explicit.get("lea"), voices[1]);
  assert.notEqual(explicit.get("main"), voices[1]);                            // explicit choice is reserved
  assert.equal(assignVoices([normalizeAgent({ id: "u", voice: "inexistante" })], voices).get("u"), voices[fnv1a("u") % voices.length]); // unknown id ignored
  assert.equal(fnv1a("main"), 3935363592); assert.equal(fnv1a("lea"), 1030415889); // same values as tts/tts_server.py fnv1a()
});

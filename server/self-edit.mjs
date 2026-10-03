// Michel asks to change his memory and his way of working through tags at the end of his reply. This server only
// queues them for the user (his own file tools are missing on a Claude or Qwen fallback); nothing changes Michel's
// behaviour before the user's click. Only Michel's answers to a request of the user count:
//   <proposer type="fait|préférence">…</proposer>  → propositions.md, validated in the Memory panel (MEMORY.md / USER.md)
//   <regle>…</regle>                               → propositions.md as "[règle]"; validated → USER.md "Règles de travail",
//                                                    removable there
//   <consigne><avant>…</avant><apres>…</apres><raison>…</raison></consigne>
//                                                  → an improvement of his instructions waiting in the Amélioration panel
import { appendFileSync, existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { createHash } from "node:crypto";
import { join } from "node:path";

const TAG = /<(proposer|regle|consigne)\b([^>]*)>([\s\S]*?)<\/\1>/gi;
const UNCLOSED = /<(proposer|regle|consigne)\b[^>]*>(?![\s\S]*<\/\1>)[\s\S]*$/i;   // still streaming
const RULES = "## Règles de travail";
const ROSTER = "\n# Available agents";
const one = (s) => String(s ?? "").replace(/\s+/g, " ").trim().slice(0, 500);
const inner = (body, name) => new RegExp(`<${name}>([\\s\\S]*?)</${name}>`, "i").exec(body)?.[1] ?? null;

/** The reply without its self-edit tags (spoken and displayed text). */
export const stripSelfEdits = (text) => text.replace(TAG, "").replace(UNCLOSED, "").replace(/\n{3,}/g, "\n\n");

/** { proposals: [{kind, text}], rules: [text], changes: [{find, replace, why}] } found in a reply. */
export function extractSelfEdits(text = "") {
  const out = { proposals: [], rules: [], changes: [] };
  for (const [, name, attrs, body] of text.matchAll(TAG)) {
    if (name.toLowerCase() === "proposer") {
      const kind = /type\s*=\s*"?fait/i.test(attrs) ? "fait" : "préférence";
      if (one(body)) out.proposals.push({ kind, text: one(body) });
    } else if (name.toLowerCase() === "regle") {
      if (one(body)) out.rules.push(one(body));
    } else {
      const find = inner(body, "avant"), replace = inner(body, "apres");
      if (find && replace !== null && find.trim()) out.changes.push({ find: find.replace(/^\n|\n$/g, ""), replace: replace.replace(/^\n|\n$/g, ""), why: one(inner(body, "raison")) });
    }
  }
  return out;
}

/** Appends a proposal line to propositions.md (same format as before, validated in the Memory panel). */
export function addProposal(workspace, { kind, text }) {
  appendFileSync(join(workspace, "propositions.md"), `- [${kind}] ${text}\n`);
}

const ruleId = (line) => createHash("sha1").update(line.trim()).digest("hex").slice(0, 12);

/** Rules of USER.md's "Règles de travail" section: [{ id, text }]. */
export function readRules(workspace) {
  const file = join(workspace, "USER.md");
  if (!existsSync(file)) return [];
  const text = readFileSync(file, "utf8"), at = text.indexOf(RULES);
  if (at < 0) return [];
  return text.slice(at + RULES.length).split("\n").filter((l) => /^\s*-\s+/.test(l))
    .map((l) => ({ id: ruleId(l), text: l.replace(/^\s*-\s+/, "").replace(/\s*\(règle donnée par l’utilisateur le [\d-]+\)\s*$/, "") }));
}

/** Adds a validated rule at the end of USER.md (in place: read-only bind inside the gateway); creates the section once.
 * Called when the user validates a "[règle]" proposal (memory.mjs). */
export function addRule(workspace, text, date = new Date().toISOString().slice(0, 10)) {
  const file = join(workspace, "USER.md");
  const current = existsSync(file) ? readFileSync(file, "utf8") : "";
  if (readRules(workspace).some((r) => r.text === text)) return false;
  const head = current.includes(RULES) ? "" : `${current && !current.endsWith("\n") ? "\n" : ""}\n${RULES}\n\n`;
  appendFileSync(file, `${head}- ${text} (règle donnée par l’utilisateur le ${date})\n`);
  return true;
}

/** Removes one rule by id; true when found. */
export function removeRule(workspace, id) {
  const file = join(workspace, "USER.md");
  if (!existsSync(file)) return false;
  const text = readFileSync(file, "utf8"), at = text.indexOf(RULES);
  if (at < 0) return false;
  const head = text.slice(0, at + RULES.length), lines = text.slice(at + RULES.length).split("\n");
  const kept = lines.filter((l) => !(/^\s*-\s+/.test(l) && ruleId(l) === id));
  if (kept.length === lines.length) return false;
  writeFileSync(file, head + kept.join("\n"));
  return true;
}

/** A change of Michel's instructions asked by the user: an improvement record "en attente" (not evaluated), or null
 * when the text to replace is not found exactly once in the live instructions. */
export function instructionChange(dir, liveAgentsFile, { find, replace, why }, now = new Date()) {
  const live = readFileSync(liveAgentsFile, "utf8");
  const program = live.includes(ROSTER) ? live.slice(0, live.indexOf(ROSTER)) : live;
  if (program.split(find).length !== 2 || find === replace) return null;
  const stamp = now.toISOString().slice(0, 19).replace(/:/g, "-");
  const diff = [...find.split("\n").map((l) => `-${l}`), ...replace.split("\n").map((l) => `+${l}`)].join("\n");
  const record = { id: `consigne-${stamp}`, createdAt: now.toISOString(), status: "en attente", source: "demande",
    why: why || "modification demandée par l’utilisateur", file: "agents/main/AGENTS.md", find, replace,
    newContent: program.replace(find, replace), diff, before: null, after: null, regressions: [], recommended: null, failures: [] };
  mkdirSync(dir, { recursive: true, mode: 0o700 });
  writeFileSync(join(dir, `${record.id}.json`), JSON.stringify(record, null, 2), { mode: 0o600 });
  return record;
}

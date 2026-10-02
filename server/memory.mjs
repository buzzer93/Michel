// Governed memory (plan step 5): Michel only *proposes* what to remember (propositions.md); the user validates each
// proposal from the dashboard, which appends it to USER.md (preference) or MEMORY.md (fact) — the two files OpenClaw
// loads at the start of every conversation, read-only for the agents. Notes and lists (notes/*.md) are Michel's own.
import { appendFileSync, existsSync, readdirSync, readFileSync, statSync, writeFileSync } from "node:fs";
import { createHash } from "node:crypto";
import { join } from "node:path";

// One proposal per line: "- [préférence] …" or "- [fait] …".
const LINE = /^\s*-\s*\[(préférence|preference|fait)\]\s*(.+?)\s*$/i;
const idOf = (line) => createHash("sha1").update(line.trim()).digest("hex").slice(0, 12);

/** Pending proposals of a propositions.md text: [{ id, kind: "préférence"|"fait", text }]. */
export function parseProposals(text = "") {
  const out = [];
  for (const line of text.split("\n")) {
    const m = LINE.exec(line);
    if (m) out.push({ id: idOf(line), kind: /^fait$/i.test(m[1]) ? "fait" : "préférence", text: m[2].slice(0, 500) });
  }
  return out;
}

/** The text without the proposal whose id is given (and its line ending). */
export const withoutProposal = (text, id) => text.split("\n").filter((line) => !(LINE.test(line) && idOf(line) === id)).join("\n");

/** Line appended to USER.md / MEMORY.md for a validated proposal. */
export const validatedLine = (p, date) => `- ${p.text} (validé par l'utilisateur le ${date})\n`;

/** Notes and lists of the workspace: [{ name, text, updatedAt }] (newest first, each capped). */
export function readNotes(dir) {
  if (!existsSync(dir)) return [];
  return readdirSync(dir).filter((f) => f.endsWith(".md")).map((f) => {
    const path = join(dir, f);
    return { name: f.replace(/\.md$/, ""), text: readFileSync(path, "utf8").slice(0, 4000), updatedAt: statSync(path).mtimeMs };
  }).sort((a, b) => b.updatedAt - a.updatedAt).slice(0, 30);
}

/** Store bound to Michel's workspace. USER.md / MEMORY.md are appended in place: inside the gateway they are read-only
 * bind mounts of these very files, and replacing a file (new inode) would hide the change from the gateway. */
export function memoryStore(workspace) {
  const proposals = join(workspace, "propositions.md");
  const read = () => (existsSync(proposals) ? readFileSync(proposals, "utf8") : "");
  return {
    snapshot: () => ({ proposals: parseProposals(read()), notes: readNotes(join(workspace, "notes")) }),
    decide(id, accept, date = new Date().toISOString().slice(0, 10)) {
      const text = read();
      const p = parseProposals(text).find((x) => x.id === id);
      if (!p) return null;
      if (accept) appendFileSync(join(workspace, p.kind === "fait" ? "MEMORY.md" : "USER.md"), validatedLine(p, date));
      writeFileSync(proposals, withoutProposal(text, id));
      return p;
    },
  };
}

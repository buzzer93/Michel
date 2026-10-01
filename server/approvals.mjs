// Approval requests from the gateway (an agent wants to run a command outside its allowlist): turned into a card
// shown in the dashboard, where the user approves or refuses the exact command. Two origins share the format:
// "plugin" (agents on Claude Code: their native Bash goes through OpenClaw's hook) and "exec" (OpenClaw's own runtime).

/** Parse a JSON string, or null. */
const json = (s) => { try { return JSON.parse(s); } catch { return null; } };

/**
 * Normalized view of an `*.approval.requested` event, or null when it is not one:
 * { id, kind: "plugin"|"exec", agentId, title, command, reason, decisions, expiresAtMs }.
 */
export function approvalView(event, payload = {}) {
  const m = /^(plugin|exec)\.approval\.requested$/.exec(event ?? "");
  if (!m || !payload.id) return null;
  const kind = m[1], req = payload.request ?? payload;
  const detail = typeof req.detail === "string" ? json(req.detail) : req.detail;
  const command = String(detail?.command ?? req.command ?? req.rawCommand ?? req.systemRunPlan?.rawCommand
    ?? (Array.isArray(req.argv) ? req.argv.join(" ") : "") ?? "").trim();
  return {
    id: String(payload.id), kind, agentId: req.agentId ?? null,
    title: String(req.title ?? (kind === "exec" ? "Commande" : "Action")),
    command, reason: String(detail?.description ?? "").slice(0, 300),
    decisions: Array.isArray(req.allowedDecisions) && req.allowedDecisions.length ? req.allowedDecisions : ["allow-once", "deny"],
    expiresAtMs: Number(payload.expiresAtMs) || null,
  };
}

// Never shown to the user, refused straight away: a local file sent out, or a shell construction that would run
// more than the one command displayed on the card.
const FORBIDDEN = [
  [/\s--(body-file|attach|input|template)\b/, "envoi d'un fichier local"],
  [/[|;&<>`]|\$\(|\n/, "construction shell (pipe, redirection, enchaînement)"],
];

/** Why this command is refused without asking (French, for the log and the dashboard), or null. */
export function forbiddenReason(command = "") {
  for (const [re, why] of FORBIDDEN) if (re.test(command)) return why;
  return null;
}

/** Gateway method that resolves an approval of this kind. */
export const resolveMethod = (kind) => (kind === "plugin" ? "plugin.approval.resolve" : "exec.approval.resolve");

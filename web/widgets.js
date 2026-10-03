// Dashboard widgets. Every number shown comes from the server or the page's own audio: nothing decorative.
import { sigilSvg } from "./sigil.js";

const esc = (s) => String(s ?? "").replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
const panelHead = (title, aux = "") => `<header><h2>${title}</h2><span class="aux">${aux}</span></header>`;

/** Top bar clock: time and date, refreshed every second. */
export class Clock {
  constructor(root) {
    const tick = () => {
      const now = new Date();
      root.innerHTML = `<b>${now.toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" })}</b><span>${now.toLocaleDateString("fr-FR", { weekday: "short", day: "numeric", month: "short" })}</span>`;
    };
    tick(); setInterval(tick, 1000);
  }
}

/** Delegation team: the coordinator's specialists, listed under it in the Agents panel, with their live state. */
export class TeamList {
  constructor() { this.el = document.createElement("ul"); this.el.className = "team"; this.members = new Map(); this.timers = new Map(); }

  setMembers(team = []) {
    const list = this.el;
    list.replaceChildren();
    this.members.clear();
    // Under their coordinator, a first word every specialist shares ("Michel …") only repeats: drop it.
    const first = (n) => n.split(" ")[0];
    const shared = team.length > 1 && team.every((m) => m.name.includes(" ") && first(m.name) === first(team[0].name));
    for (const m of team) {
      const li = document.createElement("li");
      li.style.setProperty("--c", m.color); li.dataset.state = "idle";
      li.innerHTML = `<span class="face">${m.avatar ? `<img src="${esc(m.avatar)}" alt="">` : sigilSvg(m.name, m.color)}</span><span class="who"><b title="${esc(m.name)}">${esc(shared ? m.name.slice(first(m.name).length + 1) : m.name)}</b>${m.tagline ? `<small>${esc(m.tagline)}</small>` : ""}</span><em>au repos</em>`;
      list.append(li); this.members.set(m.id, li);
    }
  }

  /** `delegate` event: running → "travaille", done → "terminé" for 20 s, then back to rest. */
  delegate({ to, state }) {
    const li = this.members.get(to); if (!li) return;
    clearTimeout(this.timers.get(to));
    li.dataset.state = state === "done" ? "done" : "busy";
    li.querySelector("em").textContent = state === "done" ? "terminé" : "travaille";
    if (state === "done") this.timers.set(to, setTimeout(() => { li.dataset.state = "idle"; li.querySelector("em").textContent = "au repos"; }, 20000));
  }
}

/** Counters since the page opened. */
export class SessionPanel {
  constructor(root) {
    this.n = { requests: 0, tools: 0, delegations: 0, turns: 0, ms: 0 };
    root.innerHTML = panelHead("Session", "depuis l'ouverture") + `<dl class="stats">
      <div><dt>Demandes</dt><dd data-k="requests">0</dd></div><div><dt>Outils</dt><dd data-k="tools">0</dd></div>
      <div><dt>Délégations</dt><dd data-k="delegations">0</dd></div><div><dt>Réponse moy.</dt><dd data-k="avg">–</dd></div></dl>`;
    this.dd = Object.fromEntries([...root.querySelectorAll("dd")].map((d) => [d.dataset.k, d]));
  }
  bump(key) { this.n[key]++; this.dd[key].textContent = this.n[key]; this.dd[key].classList.remove("tick"); void this.dd[key].offsetWidth; this.dd[key].classList.add("tick"); }
  turn(ms) { this.n.turns++; this.n.ms += ms; this.dd.avg.textContent = `${(this.n.ms / this.n.turns / 1000).toFixed(1)} s`; }
}

/** CPU / RAM / GPU gauges with a 2-minute sparkline each (samples every 2 s from the server). */
export class SysPanel {
  constructor(root) {
    root.innerHTML = panelHead("Système", "hôte local") + ["cpu", "ram", "gpu"].map((k) => `
      <div class="meter" data-k="${k}"><div class="row"><b>${k.toUpperCase()}</b><span class="val">–</span></div>
      <canvas width="260" height="38"></canvas><small class="note">&nbsp;</small></div>`).join("");
    this.m = Object.fromEntries([...root.querySelectorAll(".meter")].map((el) => [el.dataset.k, { el, val: el.querySelector(".val"), note: el.querySelector(".note"), cv: el.querySelector("canvas"), hist: [] }]));
  }

  update({ cpu, ram, gpu }) {
    const gb = (mb) => (mb / 1024).toFixed(1);
    this.set("cpu", cpu, "processeur (WSL)");
    this.set("ram", ram ? Math.round((100 * ram.usedMb) / ram.totalMb) : null, ram ? `${gb(ram.usedMb)} / ${gb(ram.totalMb)} Go` : "");
    this.set("gpu", gpu?.util ?? null, gpu ? `VRAM ${gb(gpu.memUsedMb)} / ${gb(gpu.memTotalMb)} Go · ${gpu.tempC} °C` : "indisponible");
  }

  set(k, pct, note) {
    const m = this.m[k];
    m.val.textContent = pct == null ? "–" : `${pct} %`; m.note.textContent = note || " ";
    m.el.classList.toggle("hot", pct >= 85);
    m.hist.push(pct ?? 0); if (m.hist.length > 60) m.hist.shift();
    const c = m.cv.getContext("2d"), W = m.cv.width, H = m.cv.height, color = getComputedStyle(m.el).getPropertyValue("--c").trim() || "#22d3ee";
    c.clearRect(0, 0, W, H);
    const pts = m.hist.map((v, i) => [W - (m.hist.length - 1 - i) * (W / 59), H - 2 - (v / 100) * (H - 4)]);
    const fill = c.createLinearGradient(0, 0, 0, H); fill.addColorStop(0, color + "66"); fill.addColorStop(1, "transparent");
    c.beginPath(); pts.forEach(([x, y], i) => (i ? c.lineTo(x, y) : c.moveTo(x, y))); c.lineTo(W, H); c.lineTo(pts[0][0], H); c.closePath(); c.fillStyle = fill; c.fill();
    c.beginPath(); pts.forEach(([x, y], i) => (i ? c.lineTo(x, y) : c.moveTo(x, y))); c.strokeStyle = color; c.lineWidth = 1.6; c.shadowColor = color; c.shadowBlur = 6; c.stroke(); c.shadowBlur = 0;
  }
}

/** Approval cards: an agent asks to run an exact command; the user approves it once or refuses it. Unanswered,
 * the request expires on the gateway side (refused). */
export class ApprovalCards {
  constructor(root, onDecide) {
    this.root = root; this.onDecide = onDecide; this.cards = new Map();
  }

  show(a) {
    if (this.cards.has(a.id)) return;
    const el = document.createElement("section");
    el.className = "approval"; el.setAttribute("role", "alertdialog"); el.setAttribute("aria-label", `Autorisation demandée par ${a.agentName}`);
    const total = a.expiresAtMs ? Math.max(1000, a.expiresAtMs - Date.now()) : 0;
    el.innerHTML = `<header><b>${esc(a.agentName)}</b><span>demande ton autorisation</span></header>
      ${a.reason ? `<p class="why">${esc(a.reason)}</p>` : ""}
      <pre class="cmd">${esc(a.command || a.title)}</pre>
      ${total ? `<i class="ttl" style="--t:${Math.round(total / 1000)}s"></i>` : ""}
      <footer>${a.decisions.includes("deny") ? '<button data-d="deny" class="no">Refuser</button>' : ""}
        ${a.decisions.includes("allow-once") ? '<button data-d="allow-once" class="yes">Approuver</button>' : ""}</footer>`;
    el.addEventListener("click", (e) => {
      const d = e.target.closest("button")?.dataset.d; if (!d) return;
      el.querySelectorAll("button").forEach((b) => (b.disabled = true));
      this.onDecide(a.id, d);
    });
    this.root.append(el); this.cards.set(a.id, el);
  }

  /** Resolved (by the user or elsewhere) or expired: the card leaves with the outcome. */
  done(id, decision) {
    const el = this.cards.get(id); if (!el) return;
    this.cards.delete(id);
    el.dataset.outcome = decision === "deny" ? "refusé" : decision === "expired" ? "expiré" : "approuvé";
    el.classList.add("gone"); setTimeout(() => el.remove(), 1600);
  }

  sync(list = []) { for (const id of [...this.cards.keys()]) if (!list.some((a) => a.id === id)) this.done(id, "expired"); list.forEach((a) => this.show(a)); }
}

/** Governed memory: Michel's proposals (validated → remembered, rejected → dropped) and his notes and lists. */
export class MemoryPanel {
  constructor(root, onDecide, onRemoveRule) {
    this.onDecide = onDecide;
    root.innerHTML = panelHead("Mémoire", "") + `<div class="mem-body"><ul class="proposals"></ul><details class="rules" hidden><summary>Règles de travail</summary><ul></ul></details><div class="notes"></div></div>`;
    [this.aux, this.props, this.notes, this.rules] = [".aux", ".proposals", ".notes", ".rules"].map((s) => root.querySelector(s));
    this.props.addEventListener("click", (e) => {
      const b = e.target.closest("button"); if (!b) return;
      b.closest("li").classList.add("deciding");
      this.onDecide(b.dataset.id, b.dataset.accept === "1");
    });
    this.rules.addEventListener("click", (e) => {
      const b = e.target.closest("button"); if (!b) return;
      b.closest("li").classList.add("deciding");
      onRemoveRule(b.dataset.id);
    });
  }

  update({ proposals = [], notes = [], rules = [] }) {
    // Rules of work the user validated (USER.md): Michel applies them in every conversation; ✕ removes one.
    this.rules.hidden = !rules.length;
    this.rules.querySelector("ul").innerHTML = rules.map((r) => `<li><span class="txt">${esc(r.text)}</span><button data-id="${esc(r.id)}" title="Retirer cette règle">✕</button></li>`).join("");
    this.aux.textContent = proposals.length ? `${proposals.length} à valider` : "";
    this.props.innerHTML = proposals.map((p) => `<li><span class="kind">${esc(p.kind)}</span><span class="txt">${esc(p.text)}</span>
      <button data-id="${esc(p.id)}" data-accept="1" title="Valider : Michel s'en souviendra">✓</button><button data-id="${esc(p.id)}" data-accept="0" title="Rejeter">✕</button></li>`).join("");
    const items = (text) => text.split("\n").map((l) => /^\s*-\s*\[( |x|X)\]\s*(.+)$/.exec(l)).filter(Boolean)
      .map((m) => `<li class="${m[1] === " " ? "" : "done"}">${esc(m[2])}</li>`).join("");
    this.notes.innerHTML = notes.length
      ? notes.map((n) => `<details><summary>${esc(n.name)}</summary><ul>${items(n.text) || `<li>${esc(n.text.slice(0, 200))}</li>`}</ul></details>`).join("")
      : `<p class="empty">Aucune note. « Michel, ajoute du lait à la liste de courses »</p>`;
  }
}

/** Improvement loop (plan step 8): the candidate change of Michel's instructions waiting for the user, its reason, its
 * diff and its score before/after on the evaluation cases. The panel is shown only while a decision is pending; after
 * "Appliquer", "Annuler" stays available for UNDO_MS, then the panel empties. */
const UNDO_MS = 30000;
export class ImprovePanel {
  constructor(root, onDecide) {
    this.root = root; this.onDecide = onDecide; this.list = []; this.undo = null;
    root.innerHTML = panelHead("Amélioration", "") + `<div class="imp-body"></div>`;
    [this.aux, this.body] = [".aux", ".imp-body"].map((s) => root.querySelector(s));
    this.body.addEventListener("click", (e) => {
      const b = e.target.closest("button[data-action]"); if (!b) return;
      b.closest(".imp").classList.add("deciding");
      if (b.dataset.action === "apply") {
        this.undo = { id: b.dataset.id, until: Date.now() + UNDO_MS };
        setTimeout(() => this.update({ list: this.list }), UNDO_MS + 100);
      } else this.undo = null;
      this.onDecide(b.dataset.id, b.dataset.action);
    });
  }

  update({ list = [] }) {
    this.list = list;
    const undoable = this.undo && Date.now() < this.undo.until ? list.find((x) => x.id === this.undo.id && x.status === "appliquée") : null;
    const r = list.find((x) => x.status === "en attente") ?? undoable;
    this.root.hidden = !r;
    if (!r) return;
    this.aux.textContent = r.status;
    const score = (s) => (s ? `${s.passed}/${s.total}` : "–");
    const lines = String(r.diff ?? "").split("\n").filter((l) => /^[+-]/.test(l) && !/^(\+\+\+|---)/.test(l))
      .map((l) => `<span class="${l[0] === "+" ? "add" : "del"}">${esc(l)}</span>`).join("\n");
    const buttons = r.status === "en attente"
      ? `<button data-id="${esc(r.id)}" data-action="apply" class="ok">Appliquer</button><button data-id="${esc(r.id)}" data-action="refuse">Refuser</button>`
      : r.status === "appliquée" ? `<button data-id="${esc(r.id)}" data-action="rollback">Annuler (30 s)</button>` : "";
    // A change the user asked Michel for (self-edit.mjs) is not measured on the evaluation cases, unlike the weekly loop.
    const measured = r.source !== "demande";
    this.body.innerHTML = `<div class="imp${r.recommended ? " rec" : ""}">
      <p class="why">${esc(r.why)}</p>
      ${measured ? `<p class="score">Michel <b>${score(r.before)}</b> → candidat <b>${score(r.after)}</b>${r.regressions?.length ? ` · <span class="reg">régressions : ${esc(r.regressions.join(", "))}</span>` : ""}</p>
      <small>${r.recommended ? "recommandée" : "non recommandée"} · échecs visés : ${esc((r.failures ?? []).join(", ") || "aucun")}</small>`
        : `<small>demandée par toi · non évaluée sur les cas de test</small>`}
      <details><summary>Modification de ${esc(r.file ?? "AGENTS.md")}</summary><pre class="diff">${lines || "(aucune)"}</pre></details>
      <div class="imp-actions">${buttons}</div></div>`;
  }
}

/** Model behind the active agent and its provider's plan usage (quota windows), as reported by the gateway. */
export class ModelPanel {
  constructor(root) {
    this.data = { models: {}, providers: [] }; this.agent = null;
    root.innerHTML = panelHead("Modèle", "") + `<div class="model-body"><p class="model-name">–</p><div class="quota"></div><small class="note">&nbsp;</small></div>`;
    [this.aux, this.name, this.quota, this.note] = [".aux", ".model-name", ".quota", ".note"].map((s) => root.querySelector(s));
  }

  update(data) { this.data = data; this.render(); }
  show(agentId) { this.agent = agentId; this.render(); }

  render() {
    const { models, providers } = this.data;
    const m = models[this.agent] ?? models.main ?? Object.values(models)[0];
    if (!m?.model) { this.name.textContent = "–"; this.quota.replaceChildren(); this.aux.textContent = ""; this.note.textContent = " "; return; }
    const p = providers.find((x) => x.provider === m.provider);
    // m is the model that really answered last (the server reads it from the reply); "fallback" when it is not the
    // agent's primary model, e.g. Claude while the ChatGPT quota is used up, or the local Qwen without Internet.
    const providerName = { openai: "OpenAI", anthropic: "Anthropic", ollama: "local" }[m.provider] ?? m.provider ?? "";
    this.name.textContent = m.model; this.name.title = `${m.provider}/${m.model}`;
    this.name.classList.toggle("fallback", Boolean(m.fallback));
    this.aux.textContent = (m.fallback ? "secours · " : "") + (p?.plan ? `${p.name} · ${p.plan}` : providerName);
    const reset = (ms) => (ms ? new Date(ms).toLocaleString("fr-FR", { weekday: "short", hour: "2-digit", minute: "2-digit" }) : "");
    this.quota.innerHTML = (p?.windows ?? []).map((w) => `<div class="quota-row${w.usedPercent >= 85 ? " hot" : ""}">
      <div class="row"><b>${esc(w.label === "Week" ? "Semaine" : w.label)}</b><span class="val">${w.usedPercent} % utilisé</span></div>
      <i style="--p:${Math.min(100, Math.max(0, w.usedPercent))}%"></i><small>remise à zéro ${esc(reset(w.resetAt))}</small></div>`).join("");
    const k = (n) => (n >= 1000 ? `${Math.round(n / 1000)} k` : String(n));
    const parts = [];
    if (m.contextTokens) parts.push(`contexte ${k(m.contextTokens)}${m.contextMax ? ` / ${k(m.contextMax)}` : ""} tokens`);
    if (p?.balance) parts.push(`crédit API ${p.balance.amount}${p.balance.unit && p.balance.unit !== "credits" ? ` ${p.balance.unit}` : ""}`);
    if (!p && m.provider !== "ollama") parts.push("consommation non remontée par ce fournisseur");
    this.note.textContent = parts.join(" · ") || " ";
  }
}

/** Live spectra of the microphone and of the agent's voice (the page's own analysers). */
export class VoicePanel {
  constructor(root, { mic, voice }) {
    root.innerHTML = panelHead("Voix", "spectre en direct") + `
      <div class="scope" data-k="mic"><b>Micro</b><canvas width="260" height="34"></canvas></div>
      <div class="scope" data-k="voice"><b>Agent</b><canvas width="260" height="34"></canvas></div>`;
    this.sources = { mic, voice };
    this.cv = Object.fromEntries([...root.querySelectorAll(".scope")].map((el) => [el.dataset.k, el.querySelector("canvas")]));
    let last = 0;
    const loop = (now) => { if (now - last > 40 && !document.hidden) { last = now; this.draw(); } requestAnimationFrame(loop); };
    requestAnimationFrame(loop);
  }
  draw() {
    for (const [k, cv] of Object.entries(this.cv)) {
      const c = cv.getContext("2d"), W = cv.width, H = cv.height, bands = this.sources[k]?.();
      c.clearRect(0, 0, W, H);
      const n = 40, w = W / n;
      const grad = c.createLinearGradient(0, 0, W, 0); grad.addColorStop(0, "#22d3ee"); grad.addColorStop(1, "#e879f9");
      c.fillStyle = grad;
      for (let i = 0; i < n; i++) {
        const v = bands ? bands[Math.floor((i / n) * 64)] / 255 : 0, h = Math.max(1.5, v * (H - 2));
        c.globalAlpha = bands ? 0.9 : 0.25; c.fillRect(i * w + 1, (H - h) / 2, w - 2, h);
      }
      c.globalAlpha = 1;
    }
  }
}

/** Status lights of the bottom bar. */
export class StatusLights {
  constructor(root) {
    root.innerHTML = [["link", "OpenClaw"], ["mic", "Micro"], ["busy", "Agents actifs"]].map(([k, label]) => `<span class="light" data-k="${k}"><i></i>${label}<b></b></span>`).join("");
    this.el = Object.fromEntries([...root.querySelectorAll(".light")].map((el) => [el.dataset.k, el]));
  }
  set(k, on, text = "") { this.el[k].classList.toggle("on", Boolean(on)); this.el[k].querySelector("b").textContent = text; }
}

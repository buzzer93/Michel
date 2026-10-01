// Activity panel (wide screens): a live log of what the agents really do — requests received, tools,
// delegations, finished turns — and the Gateway link. Only server events; nothing decorative.
const MAX_ROWS = 14;

export class Activity {
  constructor(root, agents) {
    this.agents = agents;
    root.innerHTML = `<header><b>Activité</b><span class="link"></span></header><ol class="feed"></ol><p class="empty">Aucune activité pour l'instant</p>`;
    this.feed = root.querySelector(".feed"); this.link = root.querySelector(".link"); this.empty = root.querySelector(".empty");
  }

  setLink(up) {
    this.link.textContent = up ? "OpenClaw en ligne" : "OpenClaw hors ligne";
    this.link.classList.toggle("down", !up);
  }

  /** One row per event; the same event repeated back to back becomes "×n" instead of a new row. */
  log(agentId, text, kind = "") {
    const a = this.agents.get(agentId), top = this.feed.firstElementChild;
    const time = new Date().toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit", second: "2-digit" });
    if (top?.dataset.key === `${agentId}|${text}`) {
      top.dataset.count = String(Number(top.dataset.count) + 1);
      top.querySelector("time").textContent = time;
      top.querySelector("span").textContent = `${text} ×${top.dataset.count}`;
      return;
    }
    const li = document.createElement("li");
    li.className = kind; li.dataset.key = `${agentId}|${text}`; li.dataset.count = "1";
    li.style.setProperty("--c", a?.color ?? "#22d3ee");
    li.innerHTML = "<time></time><b></b><span></span>";
    li.querySelector("time").textContent = time;
    li.querySelector("b").textContent = a?.name ?? agentId;
    li.querySelector("span").textContent = text;
    this.feed.prepend(li);
    while (this.feed.children.length > MAX_ROWS) this.feed.lastElementChild.remove();
    this.empty.hidden = true;
  }
}

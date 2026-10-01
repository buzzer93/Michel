// Ambient backdrop: a starfield crossed by the Milky Way, with nebulae and shooting stars crossing the screen.
// The galaxy band is painted once per resize into an offscreen canvas; only twinkles and shooting stars
// animate (~15 fps, half resolution), so depth costs almost nothing.
const NEBULAE = ["#7c3aed", "#db2777", "#0891b2", "#4f46e5"];

export class Backdrop {
  constructor(canvas) {
    this.c = canvas; this.ctx = canvas.getContext("2d"); this.color = "#22d3ee";
    this.sky = document.createElement("canvas");
    this.stars = Array.from({ length: 140 }, () => ({ x: Math.random(), y: Math.random(), s: Math.random(), p: Math.random() * 6.28 }));
    this.meteors = []; this.nextMeteor = 1 + Math.random() * 2;
    new ResizeObserver(() => this.resize()).observe(canvas); this.resize();
    let last = 0;
    const loop = (now) => { if (now - last > 66 && !document.hidden) { last = now; this.draw(now / 1000); } requestAnimationFrame(loop); };
    requestAnimationFrame(loop);
  }

  setColor(c) { this.color = c; }

  /** A meteor entering from the top or the right edge and leaving on the far side, down-left. */
  spawnMeteor(t, W, H) {
    const angle = (0.35 + Math.random() * 0.45), dist = Math.hypot(W, H) * 1.25;        // 20° to 45° below horizontal
    const fromTop = Math.random() < 0.6;
    const x = fromTop ? W * (0.25 + Math.random() * 0.9) : W * 1.05, y = fromTop ? -H * 0.05 : H * Math.random() * 0.5;
    const tint = ["#ffffff", "#ffffff", "#cfe3ff", "#ffe2b8"][Math.floor(Math.random() * 4)];
    return { t0: t, x, y, vx: -Math.cos(angle) * dist, vy: Math.sin(angle) * dist, dur: 1.4 + Math.random() * 1.2, width: 0.8 + Math.random() * 0.9, tint };
  }

  /** Draws one meteor; false once it has left the screen. The long tail keeps it smooth at a low frame rate. */
  drawMeteor(m, t) {
    const k = (t - m.t0) / m.dur;
    if (k > 1) return false;
    const { ctx } = this, x = m.x + m.vx * k, y = m.y + m.vy * k, tx = x - m.vx * 0.16, ty = y - m.vy * 0.16;
    const tail = ctx.createLinearGradient(x, y, tx, ty);
    tail.addColorStop(0, m.tint); tail.addColorStop(1, "transparent");
    ctx.globalAlpha = Math.min(1, Math.sin(k * Math.PI) * 1.4); ctx.strokeStyle = tail; ctx.lineWidth = m.width;
    ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(tx, ty); ctx.stroke();
    return true;
  }

  resize() {
    const r = this.c.getBoundingClientRect();
    this.c.width = this.sky.width = Math.max(2, Math.round(r.width / 2));
    this.c.height = this.sky.height = Math.max(2, Math.round(r.height / 2));
    this.paintSky();
  }

  /** Milky Way: a diagonal band of dense faint stars, coloured nebulae and darker dust lanes. */
  paintSky() {
    const ctx = this.sky.getContext("2d"), W = this.sky.width, H = this.sky.height;
    ctx.clearRect(0, 0, W, H);
    // Band axis from bottom-left to top-right; `d` = distance from it, `u` = position along it.
    const ax = { x: W * 0.05, y: H * 0.95 }, bx = { x: W * 0.95, y: H * 0.1 };
    const len = Math.hypot(bx.x - ax.x, bx.y - ax.y), nx = (bx.x - ax.x) / len, ny = (bx.y - ax.y) / len;
    const along = (u, d) => ({ x: ax.x + nx * u * len - ny * d, y: ax.y + ny * u * len + nx * d });
    const width = Math.min(W, H) * 0.16;
    for (let i = 0; i < 9; i++) {
      const p = along(Math.random(), (Math.random() - 0.5) * width * 1.6), rad = width * (0.8 + Math.random() * 1.6);
      const g = ctx.createRadialGradient(p.x, p.y, 0, p.x, p.y, rad);
      g.addColorStop(0, NEBULAE[i % NEBULAE.length]); g.addColorStop(1, "transparent");
      ctx.globalAlpha = 0.14 + Math.random() * 0.10; ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
    }
    ctx.fillStyle = "#fff";
    for (let i = 0; i < 4200; i++) {
      const gauss = (Math.random() + Math.random() + Math.random() - 1.5) / 1.5; // concentrated on the axis
      const p = along(Math.random(), gauss * width * 1.4);
      ctx.globalAlpha = 0.2 + Math.random() * 0.5; ctx.fillRect(p.x, p.y, Math.random() < 0.94 ? 0.6 : 1.1, Math.random() < 0.94 ? 0.6 : 1.1);
    }
    ctx.strokeStyle = "#000"; ctx.lineCap = "round";
    for (let i = 0; i < 5; i++) { // dust lanes
      const p = along(0.1 + i * 0.18, (Math.random() - 0.5) * width * 0.5), q = along(0.18 + i * 0.18, (Math.random() - 0.5) * width * 0.5);
      ctx.globalAlpha = 0.35; ctx.lineWidth = width * (0.12 + Math.random() * 0.15); ctx.filter = `blur(${Math.round(width * 0.12)}px)`;
      ctx.beginPath(); ctx.moveTo(p.x, p.y); ctx.lineTo(q.x, q.y); ctx.stroke();
    }
    ctx.filter = "none";
    for (let i = 0; i < 500; i++) { ctx.globalAlpha = 0.1 + Math.random() * 0.4; ctx.fillRect(Math.random() * W, Math.random() * H, 0.6, 0.6); } // scattered faint stars
    ctx.globalAlpha = 1;
  }

  draw(t) {
    const { ctx, c } = this, W = c.width, H = c.height;
    ctx.clearRect(0, 0, W, H);
    ctx.globalAlpha = 1; ctx.drawImage(this.sky, 0, 0);
    // A faint wash of the active agent's colour over the core of the galaxy.
    const g = ctx.createRadialGradient(W * 0.5, H * 0.45, 0, W * 0.5, H * 0.45, Math.max(W, H) * 0.6);
    g.addColorStop(0, this.color); g.addColorStop(1, "transparent");
    ctx.globalAlpha = 0.06; ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
    // Brighter stars twinkle, a few with a small cross flare.
    for (const s of this.stars) {
      const tw = 0.5 + 0.5 * Math.sin(t * (0.6 + s.s) + s.p), x = s.x * W, y = s.y * H, size = 0.5 + s.s * 1.1;
      ctx.fillStyle = s.s > 0.85 ? "#cfe8ff" : "#fff";
      ctx.globalAlpha = (0.25 + 0.6 * tw) * (0.4 + s.s * 0.6); ctx.fillRect(x - size / 2, y - size / 2, size, size);
      if (s.s > 0.93) { ctx.globalAlpha *= 0.5; ctx.fillRect(x - size * 3, y - 0.3, size * 6, 0.6); ctx.fillRect(x - 0.3, y - size * 3, 0.6, size * 6); }
    }
    // Shooting stars every few seconds, several at once, each crossing the whole screen.
    if (t > this.nextMeteor) { this.meteors.push(this.spawnMeteor(t, W, H)); this.nextMeteor = t + 1.5 + Math.random() * 3; }
    this.meteors = this.meteors.filter((m) => this.drawMeteor(m, t));
    ctx.globalAlpha = 1;
  }
}

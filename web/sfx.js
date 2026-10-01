// Procedural sound design, "deep space": everything is synthesised with Web Audio at run time (oscillators,
// FM bells, filtered noise, a generated long reverb and a stereo echo), so no audio file ships with the app.
// Activation timeline (seconds after the click): drone and solar wind swelling from 0 · telemetry blips that
// follow the text on screen (key() per character) · IGNITION deep boom + ethereal pad · READY three-note
// glass beacon echoing left and right. Everything goes through a limiter at a modest level.

export const IGNITION = 2.3;    // s: impact, synced with the orb flash and the shockwave (see app.js)
export const READY = 3.3;       // s: beacon signature, with the last line on screen
const VOLUME = 0.425;           // master level of every sound (activation and interface)

function noiseBuffer(ctx, seconds) {
  const b = ctx.createBuffer(1, Math.ceil(ctx.sampleRate * seconds), ctx.sampleRate), d = b.getChannelData(0);
  for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
  return b;
}

/** Long synthetic space: slowly decaying stereo noise, darker towards the tail. */
function reverb(ctx, seconds = 5) {
  const len = Math.ceil(ctx.sampleRate * seconds), b = ctx.createBuffer(2, len, ctx.sampleRate);
  for (let ch = 0; ch < 2; ch++) {
    const d = b.getChannelData(ch);
    let lp = 0;
    for (let i = 0; i < len; i++) { lp += 0.25 * ((Math.random() * 2 - 1) - lp); d[i] = lp * 2.2 * Math.pow(1 - i / len, 2.4); }
  }
  const c = ctx.createConvolver(); c.buffer = b; return c;
}

/** Stereo echo: left and right delays of different lengths feeding back into each other (ping-pong). */
function echo(ctx, out) {
  const input = ctx.createGain(), merger = ctx.createChannelMerger(2);
  const [l, r] = [0.29, 0.43].map((s) => { const d = ctx.createDelay(1); d.delayTime.value = s; return d; });
  const fb = ctx.createGain(), tone = ctx.createBiquadFilter();
  fb.gain.value = 0.42; tone.type = "lowpass"; tone.frequency.value = 3200;
  input.connect(l); l.connect(r); r.connect(tone).connect(fb).connect(l);
  l.connect(merger, 0, 0); r.connect(merger, 0, 1); merger.connect(out);
  return input;
}

const env = (g, t, a, peak, hold, rel) => {
  g.gain.setValueAtTime(0.0001, t);
  g.gain.exponentialRampToValueAtTime(peak, t + a);
  g.gain.setValueAtTime(peak, t + a + hold);
  g.gain.exponentialRampToValueAtTime(0.0001, t + a + hold + rel);
};

/** Output chain shared by every cue: limiter, long reverb and stereo echo. `bus(level, space, echoSend)`
 * returns an input: dry to the master, plus sends into the reverb and the echo. */
function spaceChain(ctx, volume) {
  const limiter = ctx.createDynamicsCompressor();
  limiter.threshold.value = -10; limiter.ratio.value = 12; limiter.attack.value = 0.003; limiter.release.value = 0.25;
  const master = ctx.createGain(); master.gain.value = volume;
  master.connect(limiter).connect(ctx.destination);
  const hall = reverb(ctx), wet = ctx.createGain(); wet.gain.value = 0.5;
  hall.connect(wet).connect(master);
  const delays = echo(ctx, master);
  const send = (from, node, level) => { if (level) { const s = ctx.createGain(); s.gain.value = level; from.connect(s).connect(node); } };
  const bus = (level = 1, space = 0.4, echoSend = 0) => {
    const g = ctx.createGain(); g.gain.value = level; g.connect(master);
    send(g, hall, space); send(g, delays, echoSend);
    return g;
  };
  return bus;
}

/** FM bell (carrier × inharmonic modulator): glassy, slightly metallic, fading like a struck crystal. */
function bell(ctx, out, freq, t, peak = 0.12, decay = 1.6) {
  const car = ctx.createOscillator(), mod = ctx.createOscillator(), depth = ctx.createGain(), g = ctx.createGain();
  car.frequency.value = freq; mod.frequency.value = freq * 3.5;
  depth.gain.setValueAtTime(freq * 2.2, t); depth.gain.exponentialRampToValueAtTime(freq * 0.05, t + decay);
  mod.connect(depth).connect(car.frequency);
  env(g, t, 0.004, peak, 0, decay);
  car.connect(g).connect(out);
  car.start(t); mod.start(t); car.stop(t + decay + 0.1); mod.stop(t + decay + 0.1);
}

/** Starts the soundtrack on `ctx` (already resumed) and returns the cues driven by the visual sequence:
 * key(char) for each typed character, ignite() at the orb flash, ready() for the final line. Each cue
 * takes an optional start time (seconds on the ctx clock) so the whole thing can be rendered offline. */
export function bootSfx(ctx, volume = VOLUME) {
  const t0 = ctx.currentTime + 0.02;
  const bus = spaceChain(ctx, volume);

  // Power-up under the text: a sub drone in fifths rising slowly, and band-passed "solar wind" opening up.
  {
    const drone = bus(1, 0.3);
    for (const [f0, f1, peak] of [[36.7, 55, 0.4], [55, 82.4, 0.16]]) {
      const o = ctx.createOscillator(), g = ctx.createGain();
      o.type = "sine"; o.frequency.setValueAtTime(f0, t0); o.frequency.exponentialRampToValueAtTime(f1, t0 + IGNITION);
      env(g, t0, IGNITION * 0.95, peak, 0.02, 0.3);
      o.connect(g).connect(drone); o.start(t0); o.stop(t0 + IGNITION + 0.4);
    }
    const n = ctx.createBufferSource(), f = ctx.createBiquadFilter(), gn = ctx.createGain();
    n.buffer = noiseBuffer(ctx, IGNITION + 0.4); f.type = "bandpass"; f.Q.value = 3;
    f.frequency.setValueAtTime(120, t0); f.frequency.exponentialRampToValueAtTime(2600, t0 + IGNITION);
    env(gn, t0, IGNITION * 0.97, 0.12, 0, 0.3);
    n.connect(f).connect(gn).connect(bus(1, 0.8)); n.start(t0);
  }

  // Telemetry: each character = a tiny high sine blip on a pentatonic scale, very quiet, with some space.
  // Rate-limited so a burst stays a soft data stream rather than a buzz.
  const blipBus = bus(1, 0.35, 0.12);
  const SCALE = [1318.5, 1480, 1661.2, 1975.5, 2217.5];   // E6 F#6 G#6 B6 C#7
  let lastKey = 0;
  const key = (ch = "a", at) => {
    const t = at ?? ctx.currentTime;
    if (ch === " " || t - lastKey < 0.045) return;
    lastKey = t;
    const o = ctx.createOscillator(), g = ctx.createGain();
    o.type = "sine"; o.frequency.value = SCALE[Math.floor(Math.random() * SCALE.length)];
    env(g, t, 0.002, 0.035 + Math.random() * 0.02, 0, 0.06);
    o.connect(g).connect(blipBus); o.start(t); o.stop(t + 0.08);
  };

  // Ignition: deep boom with a long tail, a filtered noise "shock", then an ethereal pad (sus chord of
  // detuned sines and triangles) with a shimmer an octave up, opening slowly.
  const ignite = (at) => {
    const t = at ?? ctx.currentTime;
    const o = ctx.createOscillator(), g = ctx.createGain();
    o.type = "sine"; o.frequency.setValueAtTime(90, t); o.frequency.exponentialRampToValueAtTime(28, t + 1.4);
    env(g, t, 0.01, 1.0, 0.05, 1.8);
    o.connect(g).connect(bus(1, 0.5)); o.start(t); o.stop(t + 2.2);
    const n = ctx.createBufferSource(), lpN = ctx.createBiquadFilter(), gn = ctx.createGain();
    n.buffer = noiseBuffer(ctx, 2); lpN.type = "lowpass"; lpN.frequency.setValueAtTime(5000, t); lpN.frequency.exponentialRampToValueAtTime(200, t + 1.5);
    env(gn, t, 0.005, 0.22, 0, 1.4);
    n.connect(lpN).connect(gn).connect(bus(1, 0.9)); n.start(t);
    const tp = t + 0.1, lp = ctx.createBiquadFilter(), pg = ctx.createGain();
    lp.type = "lowpass"; lp.Q.value = 2; lp.frequency.setValueAtTime(400, tp); lp.frequency.exponentialRampToValueAtTime(4200, tp + 2.2);
    env(pg, tp, 0.9, 0.09, 1.2, 2.6);
    lp.connect(pg).connect(bus(1, 1, 0.15));
    for (const f of [110, 164.81, 246.94, 329.63, 369.99]) for (const det of [-9, 9]) {   // A E B E F#: Asus2 add6
      const s = ctx.createOscillator(); s.type = det < 0 ? "triangle" : "sine"; s.frequency.value = f; s.detune.value = det;
      s.connect(lp); s.start(tp); s.stop(tp + 5);
    }
    const shimmer = bus(1, 1, 0.3);
    [659.25, 987.77, 1318.5].forEach((f, i) => bell(ctx, shimmer, f, tp + 0.4 + i * 0.35, 0.03, 2.4));
  };

  // Ready: a three-note glass beacon (FM bells) climbing a fifth, thrown into the ping-pong echo.
  const ready = (at) => {
    const t = at ?? ctx.currentTime, beacon = bus(1, 0.6, 0.45);
    [[880, 0], [1318.5, 0.16], [1760, 0.32]].forEach(([f, dt]) => bell(ctx, beacon, f, t + dt, 0.11, 1.4));
  };
  return { key, ignite, ready };
}

// Interface sounds share one chain, built on first use (one set of nodes for the whole session).
let ui = null;
const uiOut = (ctx) => {
  if (!ui) { const bus = spaceChain(ctx, VOLUME); ui = { wake: bus(1, 0.5, 0.35), ptt: bus(1, 0.25, 0.1) }; }
  return ui;
};

/** An agent wakes up: one soft glass note with a space echo. */
export function wakeChime(ctx) {
  const t = ctx.currentTime + 0.01, out = uiOut(ctx).wake;
  bell(ctx, out, 1318.5, t, 0.07, 1.1);
  bell(ctx, out, 1975.5, t + 0.08, 0.035, 0.9);
}

/** Push-to-talk: a radio "channel open" blip rising on press, falling on release. */
export function pttTone(ctx, open) {
  const t = ctx.currentTime + 0.005, out = uiOut(ctx).ptt;
  const o = ctx.createOscillator(), g = ctx.createGain();
  o.type = "sine";
  o.frequency.setValueAtTime(open ? 660 : 1320, t); o.frequency.exponentialRampToValueAtTime(open ? 1320 : 660, t + 0.09);
  env(g, t, 0.004, 0.06, 0.04, 0.08);
  o.connect(g).connect(out); o.start(t); o.stop(t + 0.2);
}

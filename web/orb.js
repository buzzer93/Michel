// The orb: a single full-canvas fragment shader drawing a black hole in the "Interstellar" style (horizon,
// photon ring, lensed halo of the far side of the disk, warm accretion disk seen almost edge-on).
// The agent's colour lives on the voice bars and the waves; the disk keeps its own blackbody palette.
// State weights are eased in JS so every transition (agent change, listen → think → speak) morphs instead of cutting.

const VERT = `attribute vec2 p; void main(){ gl_Position = vec4(p,0.,1.); }`;

// Seconds of flow per cycle of the disk texture (see diskTexture); u_flow wraps on a multiple of it,
// so the wrap is invisible.
const CYCLE = 12;
const FLOW_WRAP = CYCLE * 800;

const FRAG = `
precision highp float;
uniform vec2  u_res;
uniform float u_time, u_flow, u_level, u_awake, u_listen, u_think, u_speak, u_flash;
uniform vec3  u_color;
uniform sampler2D u_spec;   // 64 bands, mirrored left/right

const float CYCLE = ${CYCLE.toFixed(1)};
const float AVATAR_R = .37;   // edge of the avatar disc (#avatar inset 27% of the wrap; the canvas is 124% wide)

float hash(vec2 p){ vec3 q = fract(vec3(p.xyx) * .1031); q += dot(q, q.yzx + 33.33); return fract((q.x + q.y) * q.z); }
float noise(vec2 p){
  vec2 i = floor(p), f = fract(p); f = f*f*(3.-2.*f);
  return mix(mix(hash(i), hash(i+vec2(1,0)), f.x), mix(hash(i+vec2(0,1)), hash(i+vec2(1,1)), f.x), f.y);
}
float fbm(vec2 p){ float v = 0., a = .5; for(int i=0;i<4;i++){ v += a*noise(p); p = p*2.03 + 7.1; a *= .5; } return v; }

// Disk texture with Keplerian shear (the inner edge turns faster). Shear accumulated over time winds the
// streaks ever tighter until the disk turns into static, so two copies run on a sawtooth clock half a cycle
// apart and cross-fade: the visible winding never exceeds one cycle.
float swirl(float ad, float rd, float ph, float seed){
  float kep = ph*CYCLE*.55/(rd*rd + .2);
  return fbm(vec2(cos(ad - kep), sin(ad - kep))*rd*3.2 + vec2(rd*9., seed));
}
float diskTexture(float ad, float rd){
  float p1 = fract(u_flow/CYCLE), p2 = fract(u_flow/CYCLE + .5);
  float w = 1. - abs(2.*p1 - 1.);   // weight of copy 1: 0 when its clock wraps, 1 half a cycle later
  return mix(swirl(ad, rd, p2, 17.), swirl(ad, rd, p1, 3.), w);
}

void main(){
  vec2 uv = (gl_FragCoord.xy - .5*u_res) / min(u_res.x, u_res.y);
  float r = length(uv) * 2.0;            // 1.0 = canvas edge; the avatar disc ends near .37
  float a = atan(uv.y, uv.x);
  float t = u_time;
  float lvl = u_level, voice = lvl*u_speak;
  float energy = .35 + .65*u_awake;

  // Event horizon: a true black disc (it hides the stars) wrapped by a thin, white-hot photon ring.
  float shadowR = .40 + .004*sin(t*.6);
  float shadow = smoothstep(shadowR + .01, shadowR - .01, r);
  float photon = exp(-abs(r - (shadowR + .012))*170.) * (1.2 + 1.4*voice + .5*u_think);

  // Gravitational lensing: light passing close to the hole is bent, so each pixel sees the disk at a point
  // pulled towards the centre. The flat disk then looks bent: its far side wraps over the top of the hole and
  // its underside under it (the Interstellar look). Only the far half, whose light grazes the hole, is bent:
  // the near half crosses in front perfectly straight. The bending breathes a little with the voice and thinking.
  float lensK = .035*smoothstep(-.02, .06, uv.y) * (1. + .25*voice + .15*u_think);
  vec2 uvS = uv*(1. - lensK/max(dot(uv, uv), .0201));

  // Accretion disk seen almost edge-on; its near half crosses in front of the hole.
  vec2 dq = vec2(uvS.x, uvS.y*6.);
  float rd = length(dq)*2.;
  float ad = atan(dq.y, dq.x);
  float rin = shadowR + .01;
  float front = 1. - shadow*step(0., uv.y);   // the far half passes behind the hole
  float mask = smoothstep(rin, rin + .05, rd) * smoothstep(1.05, .7, rd);
  float heat = smoothstep(1., rin, rd);       // 1 at the inner edge, 0 at the rim
  float beaming = 1. + .55*cos(ad);           // the approaching side is brighter (Doppler)
  // Listening (microphone level), thinking and speaking show through the disk's light and pace only.
  float disk = mask * front * (pow(diskTexture(ad, rd), 1.7)*1.9 + .12) * beaming * (.45 + 1.1*heat)
             * (1. + 1.2*voice + .8*lvl*u_listen + .4*u_think);
  float bloom = exp(-abs(dq.y)*22.) * smoothstep(1.2, .3, rd) * front * .18;   // soft glow along the disk plane
  float glow = (0.8 - shadow) * exp(-(r - shadowR)*9.) * .12;                    // warm light hugging the horizon

  // Voice spectrum as a soft wave riding the rim, not a set of discrete bars.
  float m = abs(fract((a + 1.5707963)/6.2831853)*2. - 1.);
  float spec = texture2D(u_spec, vec2(m*.985 + .0075, .5)).r;
  float ringWave = 0.5 + 0.5*sin((a + 1.5707963) * 24.0 + u_time * 2.2);
  float voiceWave = smoothstep(.82, .835, r) * smoothstep(.845 + .12*spec, .83 + .12*spec, r)
                  * (.25 + 3.2*spec) * (0.2 + 1.2*ringWave) * u_awake;
  float gravWave = u_flash * exp(-abs(r - (.42 + (1. - u_flash)*.6))*16.); // gravitational wave on wake / agent change

  // Blackbody-like palette: white-hot inner edge, orange, deep ember at the rim; whiter on the approaching side.
  vec3 white = vec3(1., .95, .86), orange = vec3(1., .62, .26), ember = vec3(.62, .2, .07);
  vec3 diskCol = mix(mix(ember, orange, smoothstep(0., .55, heat)), white, smoothstep(.55, 1., heat));
  diskCol = mix(diskCol, white, .25*max(cos(ad), 0.));
  // The voice wave takes the disk's warm light (a hint of the agent's colour) and stays a little see-through.
  vec3 waveCol = mix(mix(orange, white, .35), u_color, .15);
  vec3 E = (diskCol*disk + mix(white, u_color, .2)*photon + orange*(bloom + glow) + waveCol*(voiceWave*.65 + gravWave)) * energy;
  // Straight (non-premultiplied) output: light where there is emission, opaque black on the horizon.
  // The avatar sits under this canvas, inside the horizon: the horizon stays see-through over it so the
  // portrait shows, and the near half of the disk passes in front of it.
  float lum = max(E.r, max(E.g, E.b));
  float hole = shadow * smoothstep(AVATAR_R - .01, AVATAR_R + .004, r);
  float alpha = max(hole, clamp(lum, 0., 1.));
  gl_FragColor = vec4(E / max(alpha, .001), alpha);
}`;

// At rest (asleep or idle, nothing easing) the orb redraws at this rate; any activity brings back every frame.
const ECO_FPS = 15;

const ease = (cur, target, dt, speed) => cur + (target - cur) * (1 - Math.exp(-dt * speed));
export const hexToRgb = (h) => [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16) / 255);

export class Orb {
  constructor(canvas) {
    this.canvas = canvas;
    const gl = (this.gl = canvas.getContext("webgl", { premultipliedAlpha: false, alpha: true, antialias: false, powerPreference: "low-power" }));
    this.ok = Boolean(gl);
    this.state = "sleep";
    this.w = { awake: 0, listen: 0, think: 0, speak: 0, flash: 0 };
    this.color = [0.13, 0.83, 0.92];
    this.targetColor = this.color.slice();
    this.level = 0; this.levelTarget = 0;
    this.flow = 0; // integrated animation time: its pace follows the state (see frame)
    this.levelSource = () => 0;
    if (!this.ok) return;
    const prog = gl.createProgram();
    for (const [type, src] of [[gl.VERTEX_SHADER, VERT], [gl.FRAGMENT_SHADER, FRAG]]) {
      const s = gl.createShader(type); gl.shaderSource(s, src); gl.compileShader(s);
      if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) { console.error(gl.getShaderInfoLog(s)); this.ok = false; return; }
      gl.attachShader(prog, s);
    }
    gl.linkProgram(prog); gl.useProgram(prog);
    gl.bindBuffer(gl.ARRAY_BUFFER, gl.createBuffer());
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 1, -1, -1, 1, 1, 1]), gl.STATIC_DRAW);
    const loc = gl.getAttribLocation(prog, "p"); gl.enableVertexAttribArray(loc); gl.vertexAttribPointer(loc, 2, gl.FLOAT, false, 0, 0);
    this.u = Object.fromEntries(["u_res", "u_time", "u_flow", "u_level", "u_awake", "u_listen", "u_think", "u_speak", "u_flash", "u_color", "u_spec"].map((n) => [n, gl.getUniformLocation(prog, n)]));
    gl.disable(gl.BLEND); // one full-screen pass: the shader writes final colour and opacity (the horizon hides the stars)
    this.spec = new Uint8Array(64); this.specTarget = new Uint8Array(64);
    this.specTex = gl.createTexture(); gl.bindTexture(gl.TEXTURE_2D, this.specTex);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.LUMINANCE, 64, 1, 0, gl.LUMINANCE, gl.UNSIGNED_BYTE, this.spec);
    for (const [k, v] of [[gl.TEXTURE_MIN_FILTER, gl.LINEAR], [gl.TEXTURE_MAG_FILTER, gl.LINEAR], [gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE], [gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE]]) gl.texParameteri(gl.TEXTURE_2D, k, v);
    gl.uniform1i(this.u.u_spec, 0);
    new ResizeObserver(() => this.resize()).observe(canvas);
    this.resize();
    this.last = performance.now(); this.drawnAt = 0;
    const loop = (now) => {
      this.raf = requestAnimationFrame(loop);
      if (this.atRest() && now - this.drawnAt < 1000 / ECO_FPS) return;
      this.drawnAt = now;
      this.frame(now);
    };
    this.raf = requestAnimationFrame(loop);
  }

  resize() {
    const dpr = Math.min(window.devicePixelRatio || 1, 2); // sharp on HiDPI screens; beyond 2 the shader cost is not worth it
    const { width, height } = this.canvas.getBoundingClientRect();
    this.canvas.width = Math.max(2, Math.round(width * dpr));
    this.canvas.height = Math.max(2, Math.round(height * dpr));
    this.gl.viewport(0, 0, this.canvas.width, this.canvas.height);
  }

  /** Nothing to animate smoothly: asleep or idle, no voice, no transition still easing. */
  atRest() {
    const w = this.w;
    return (this.state === "sleep" || this.state === "idle") && w.flash < 0.02 && w.think < 0.02 && w.speak < 0.02 && w.listen < 0.3;
  }

  setState(state) { this.state = state; }
  setSpectrum(bands) { this.specTarget.set(bands); }
  setColor(hex) { this.targetColor = hexToRgb(hex); }
  flash() { this.w.flash = 1; }

  frame(now) {
    if (document.hidden) { this.last = now; return; }
    const dt = Math.min(0.1, (now - this.last) / 1000); this.last = now;
    const s = this.state, w = this.w, gl = this.gl;
    w.awake = ease(w.awake, s === "sleep" ? 0 : 1, dt, 3);
    w.listen = ease(w.listen, s === "listening" ? 1 : s === "idle" ? 0.25 : 0, dt, 6);
    w.think = ease(w.think, s === "thinking" || s === "tool" ? 1 : 0, dt, 4);
    w.speak = ease(w.speak, s === "speaking" ? 1 : 0, dt, 7);
    w.flash = ease(w.flash, 0, dt, 2.2);
    this.levelTarget = this.levelSource();
    const sp = this.spectrumSource?.(); if (sp) this.specTarget.set(sp); else this.specTarget.fill(0);
    this.level = ease(this.level, this.levelTarget, dt, this.levelTarget > this.level ? 28 : 9);
    for (let i = 0; i < 3; i++) this.color[i] = ease(this.color[i], this.targetColor[i], dt, 5);
    // The disk and rings speed up while thinking and with the voice; integrating the pace (instead of
    // multiplying the clock by it) keeps every rotation continuous when the pace changes.
    this.flow = (this.flow + dt * (1 + 2.5 * w.think + 1.5 * w.speak * this.level)) % FLOW_WRAP;
    gl.clearColor(0, 0, 0, 0); gl.clear(gl.COLOR_BUFFER_BIT);
    gl.uniform2f(this.u.u_res, this.canvas.width, this.canvas.height);
    gl.uniform1f(this.u.u_time, (now / 1000) % 3600);
    gl.uniform1f(this.u.u_flow, this.flow);
    gl.uniform1f(this.u.u_level, this.level);
    gl.uniform1f(this.u.u_awake, w.awake); gl.uniform1f(this.u.u_listen, w.listen);
    gl.uniform1f(this.u.u_think, w.think); gl.uniform1f(this.u.u_speak, w.speak); gl.uniform1f(this.u.u_flash, w.flash);
    gl.uniform3fv(this.u.u_color, this.color);
    for (let i = 0; i < 64; i++) { const t = this.specTarget[i]; this.spec[i] += (t - this.spec[i]) * (t > this.spec[i] ? 0.55 : 0.18); }
    gl.bindTexture(gl.TEXTURE_2D, this.specTex);
    gl.texSubImage2D(gl.TEXTURE_2D, 0, 0, 0, 64, 1, gl.LUMINANCE, gl.UNSIGNED_BYTE, this.spec);
    gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
  }
}

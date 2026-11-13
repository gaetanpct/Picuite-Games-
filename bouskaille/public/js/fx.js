// ============================================================
// BOUSKAILLE — Particules et sons (synthétisés, aucun fichier audio)
// ============================================================
(function () {
  const T = THREE; const TAU = Math.PI * 2;
  const FX = {}; window.BouskFX = FX;
  const MAX = 1400;
  let pts = null, scene = null, P = null, quality = "high", camera = null;
  const rings = []; let ringPool = [];

  // atlas : 0 rond doux, 1 étoile, 2 cœur, 3 bulle
  function atlas() {
    const c = document.createElement("canvas"); c.width = c.height = 256; const g = c.getContext("2d");
    const cell = (i, f) => { g.save(); g.translate((i % 2) * 128 + 64, Math.floor(i / 2) * 128 + 64); f(); g.restore(); };
    cell(0, () => { const gr = g.createRadialGradient(0, 0, 0, 0, 0, 60); gr.addColorStop(0, "rgba(255,255,255,1)"); gr.addColorStop(0.45, "rgba(255,255,255,0.6)"); gr.addColorStop(1, "rgba(255,255,255,0)"); g.fillStyle = gr; g.beginPath(); g.arc(0, 0, 60, 0, TAU); g.fill(); });
    cell(1, () => { g.fillStyle = "#fff"; g.beginPath(); for (let i = 0; i < 10; i++) { const r = i % 2 ? 24 : 58, a = -Math.PI / 2 + (i / 10) * TAU; g.lineTo(Math.cos(a) * r, Math.sin(a) * r); } g.closePath(); g.fill(); });
    cell(2, () => { g.fillStyle = "#fff"; g.beginPath(); g.moveTo(0, 46); g.bezierCurveTo(-70, -6, -34, -62, 0, -26); g.bezierCurveTo(34, -62, 70, -6, 0, 46); g.fill(); });
    cell(3, () => { g.strokeStyle = "rgba(255,255,255,0.95)"; g.lineWidth = 7; g.beginPath(); g.arc(0, 0, 48, 0, TAU); g.stroke(); g.fillStyle = "rgba(255,255,255,0.18)"; g.fill(); g.fillStyle = "rgba(255,255,255,0.9)"; g.beginPath(); g.arc(-18, -18, 9, 0, TAU); g.fill(); });
    const t = new T.CanvasTexture(c); return t;
  }
  FX.init = function (sc, cam, q) {
    scene = sc; camera = cam; quality = q || "high"; FX.q = quality;
    const geo = new T.BufferGeometry();
    P = { n: MAX, pos: new Float32Array(MAX * 3), col: new Float32Array(MAX * 4), size: new Float32Array(MAX), tex: new Float32Array(MAX), vel: new Float32Array(MAX * 3), life: new Float32Array(MAX), max: new Float32Array(MAX), grav: new Float32Array(MAX), drag: new Float32Array(MAX), grow: new Float32Array(MAX), s0: new Float32Array(MAX), a0: new Float32Array(MAX), head: 0 };
    geo.setAttribute("position", new T.BufferAttribute(P.pos, 3)); geo.setAttribute("color", new T.BufferAttribute(P.col, 4)); geo.setAttribute("size", new T.BufferAttribute(P.size, 1)); geo.setAttribute("tex", new T.BufferAttribute(P.tex, 1));
    const mat = new T.ShaderMaterial({
      uniforms: { map: { value: atlas() }, scale: { value: 600 } }, transparent: true, depthWrite: false,
      vertexShader: "attribute vec4 color; attribute float size; attribute float tex; varying vec4 vC; varying float vT; uniform float scale; void main(){ vC=color; vT=tex; vec4 mv=modelViewMatrix*vec4(position,1.0); gl_PointSize=size*scale/(-mv.z); gl_Position=projectionMatrix*mv; }",
      fragmentShader: "uniform sampler2D map; varying vec4 vC; varying float vT; void main(){ vec2 uv=(vec2(mod(vT,2.0),floor(vT/2.0))+vec2(gl_PointCoord.x,1.0-gl_PointCoord.y))*0.5; vec4 t=texture2D(map,uv); gl_FragColor=vec4(vC.rgb,vC.a*t.a)*vec4(1.0,1.0,1.0,1.0); if(gl_FragColor.a<0.01) discard; }",
    });
    pts = new T.Points(geo, mat); pts.frustumCulled = false; pts.renderOrder = 10; scene.add(pts); FX.mat = mat;
    for (let i = 0; i < MAX; i++) P.life[i] = 0;
  };
  FX.resize = function (h) { if (FX.mat) FX.mat.uniforms.scale.value = h * 0.9; };
  const cc = new T.Color();
  function spawn(x, y, z, vx, vy, vz, size, hex, tex, life, o) {
    if (!P) return; o = o || {}; const i = P.head; P.head = (P.head + 1) % MAX;
    P.pos[i * 3] = x; P.pos[i * 3 + 1] = y; P.pos[i * 3 + 2] = z; P.vel[i * 3] = vx; P.vel[i * 3 + 1] = vy; P.vel[i * 3 + 2] = vz; P.s0[i] = size; P.size[i] = size; P.tex[i] = tex; P.life[i] = life; P.max[i] = life; P.grav[i] = o.grav || 0; P.drag[i] = o.drag == null ? 1.5 : o.drag; P.grow[i] = o.grow || 0;
    cc.set(hex); P.col[i * 4] = cc.r; P.col[i * 4 + 1] = cc.g; P.col[i * 4 + 2] = cc.b; P.a0[i] = o.a == null ? 1 : o.a; P.col[i * 4 + 3] = P.a0[i];
  }
  const R = (a, b) => a + Math.random() * (b - a);
  const lim = (n) => Math.max(2, Math.round(n * (quality === "low" ? 0.4 : quality === "medium" ? 0.7 : 1)));
  FX.dust = (x, z, dx, dz, n) => { for (let i = 0; i < lim(n || 3); i++) spawn(x + R(-0.2, 0.2), 0.12, z + R(-0.2, 0.2), -dx * R(0.5, 2) + R(-0.6, 0.6), R(0.3, 1.1), -dz * R(0.5, 2) + R(-0.6, 0.6), R(0.5, 0.9), 0xf4ead8, 0, R(0.35, 0.7), { a: 0.55, grow: 1.2, drag: 3 }); };
  FX.impact = (x, z, p, nx, nz) => {
    const n = lim(8 + p * 22); for (let i = 0; i < n; i++) { const a = R(0, TAU), s = R(2, 5 + p * 8); spawn(x, 0.9, z, Math.cos(a) * s, R(1, 4), Math.sin(a) * s, R(0.35, 0.7), i % 3 ? 0xffe14d : 0xffffff, 1, R(0.3, 0.6), { grav: 6, drag: 2 }); }
    for (let i = 0; i < lim(6); i++) spawn(x + R(-0.3, 0.3), 0.3, z + R(-0.3, 0.3), R(-1, 1), R(0.5, 1.8), R(-1, 1), R(0.9, 1.6), 0xffffff, 0, R(0.3, 0.5), { a: 0.7, grow: 2.2, drag: 3 });
    FX.ring(x, z, 0xffffff, 1.2 + p * 2.4, 0.35);
  };
  FX.ring = (x, z, hex, size, life) => {
    if (!scene) return; let m = ringPool.pop(); if (!m) { m = new T.Mesh(new T.RingGeometry(0.85, 1, 32), new T.MeshBasicMaterial({ transparent: true, depthWrite: false, side: T.DoubleSide })); m.rotation.x = -Math.PI / 2; scene.add(m); }
    m.material.color.set(hex); m.position.set(x, 0.12, z); m.userData = { t: 0, life, size }; m.visible = true; rings.push(m);
  };
  FX.poof = (x, y, z, hex) => { for (let i = 0; i < lim(14); i++) { const a = R(0, TAU), s = R(1, 4); spawn(x, y, z, Math.cos(a) * s, R(0, 3), Math.sin(a) * s, R(0.8, 1.6), hex || 0xffffff, 0, R(0.5, 0.9), { a: 0.7, grow: 1.5, drag: 2.5 }); } };
  FX.spring = (x, z) => { for (let i = 0; i < lim(10); i++) { const a = R(0, TAU); spawn(x + Math.cos(a) * 0.6, 0.3, z + Math.sin(a) * 0.6, Math.cos(a) * 1.5, R(2, 5), Math.sin(a) * 1.5, R(0.4, 0.7), 0x7fd3ff, 3, R(0.4, 0.7), { grav: 4 }); } FX.ring(x, z, 0x7fd3ff, 1.6, 0.4); };
  FX.confetti = (x, y, z, n) => { for (let i = 0; i < lim(n || 40); i++) spawn(x + R(-2, 2), y + R(0, 2), z + R(-2, 2), R(-3, 3), R(2, 8), R(-3, 3), R(0.25, 0.5), [0xff5a6a, 0xffd23d, 0x2fa8ff, 0x7be07b, 0xff7ab8][i % 5], 1, R(1.5, 3), { grav: 6, drag: 0.8 }); };
  FX.fall = (x, y, z) => { for (let i = 0; i < lim(6); i++) spawn(x + R(-0.3, 0.3), y, z + R(-0.3, 0.3), R(-0.5, 0.5), R(1, 3), R(-0.5, 0.5), R(0.4, 0.8), 0xffffff, 0, R(0.5, 0.9), { a: 0.6, grow: 1 }); };
  FX.dashTrail = (x, z, dx, dz, hex) => { for (let i = 0; i < 2; i++) spawn(x - dx * R(0.2, 0.7), R(0.3, 1.2), z - dz * R(0.2, 0.7), -dx * 1.5, 0, -dz * 1.5, R(0.5, 0.9), hex || 0xffffff, 0, R(0.2, 0.35), { a: 0.6, grow: 1.5, drag: 4 }); };
  // traînées cosmétiques
  FX.trail = (kind, x, y, z, vx, vz) => {
    if (!kind) return; const sp = Math.hypot(vx, vz); if (sp < 1.2) return; if (Math.random() > (quality === "low" ? 0.25 : 0.6)) return;
    const o = { drag: 1.2 };
    if (kind === 1) spawn(x + R(-0.3, 0.3), R(0.3, 1.4), z + R(-0.3, 0.3), R(-0.5, 0.5), R(0.2, 1), R(-0.5, 0.5), R(0.25, 0.45), [0xffe14d, 0xffffff, 0xffb347][Math.floor(Math.random() * 3)], 0, R(0.5, 0.9), o);
    else if (kind === 2) spawn(x + R(-0.3, 0.3), R(0.8, 1.6), z + R(-0.3, 0.3), 0, R(0.8, 1.6), 0, R(0.45, 0.7), 0xff5a8a, 2, R(0.8, 1.2), { drag: 0.5 });
    else if (kind === 3) spawn(x + R(-0.3, 0.3), R(0.5, 1.6), z + R(-0.3, 0.3), R(-0.6, 0.6), R(0.2, 1), R(-0.6, 0.6), R(0.45, 0.7), 0xffd23d, 1, R(0.6, 1), o);
    else if (kind === 4) spawn(x + R(-0.3, 0.3), R(0.3, 1.2), z + R(-0.3, 0.3), R(-0.3, 0.3), R(0.8, 1.6), R(-0.3, 0.3), R(0.35, 0.7), 0xbfeaff, 3, R(0.8, 1.3), { drag: 0.6 });
    else spawn(x + R(-0.2, 0.2), R(0.2, 0.8), z + R(-0.2, 0.2), R(-0.4, 0.4), R(0.8, 2), R(-0.4, 0.4), R(0.4, 0.8), [0xff6a2a, 0xffb347, 0xff3b2e][Math.floor(Math.random() * 3)], 0, R(0.35, 0.7), { drag: 1.5, a: 0.9 });
  };
  FX.update = function (dt) {
    if (!P) return; let any = false;
    for (let i = 0; i < MAX; i++) {
      if (P.life[i] <= 0) { if (P.size[i] !== 0) { P.size[i] = 0; any = true; } continue; }
      any = true; P.life[i] -= dt; const k = Math.max(0, P.life[i] / P.max[i]);
      const d = Math.exp(-P.drag[i] * dt); P.vel[i * 3] *= d; P.vel[i * 3 + 2] *= d; P.vel[i * 3 + 1] = P.vel[i * 3 + 1] * d - P.grav[i] * dt;
      P.pos[i * 3] += P.vel[i * 3] * dt; P.pos[i * 3 + 1] += P.vel[i * 3 + 1] * dt; P.pos[i * 3 + 2] += P.vel[i * 3 + 2] * dt;
      P.size[i] = P.s0[i] * (1 + P.grow[i] * (1 - k)) * (k < 0.25 ? k * 4 : 1); P.col[i * 4 + 3] = P.a0[i] * Math.min(1, k * 2.2);
    }
    if (any) { const g = pts.geometry; g.attributes.position.needsUpdate = true; g.attributes.size.needsUpdate = true; g.attributes.color.needsUpdate = true; g.attributes.tex.needsUpdate = true; }
    for (let i = rings.length - 1; i >= 0; i--) { const m = rings[i], u = m.userData; u.t += dt; const k = u.t / u.life; if (k >= 1) { m.visible = false; rings.splice(i, 1); ringPool.push(m); continue; } m.scale.setScalar(0.4 + u.size * k); m.material.opacity = 0.9 * (1 - k); }
  };
  FX.clear = function () { if (P) for (let i = 0; i < MAX; i++) { P.life[i] = 0; P.size[i] = 0; } rings.forEach((m) => { m.visible = false; ringPool.push(m); }); rings.length = 0; };
  FX.dispose = function () { if (pts && scene) { scene.remove(pts); pts.geometry.dispose(); pts = null; } ringPool = []; rings.length = 0; P = null; };

  // ---------- sons ----------
  const S = FX.sound = (function () {
    let ctx = null, master = null, amb = null; let vol = 0.7, muted = false; let chargeNode = null;
    try { const v = localStorage.getItem("bousk.vol"); if (v !== null) vol = Math.max(0, Math.min(1, +v)); muted = localStorage.getItem("bousk.mute") === "1"; } catch (e) { /* rien */ }
    const ac = () => { try { if (!ctx) { ctx = new (window.AudioContext || window.webkitAudioContext)(); master = ctx.createGain(); master.gain.value = muted ? 0 : vol; master.connect(ctx.destination); } if (ctx.state === "suspended") ctx.resume(); return ctx; } catch (e) { return null; } };
    const out = () => master;
    function tone(f, d, type, v, delay, slide, to) { const c = ac(); if (!c) return; const t0 = c.currentTime + (delay || 0); const o = c.createOscillator(), g = c.createGain(); o.type = type || "sine"; o.frequency.setValueAtTime(f, t0); if (slide) o.frequency.exponentialRampToValueAtTime(Math.max(20, slide), t0 + d); g.gain.setValueAtTime(0.0001, t0); g.gain.exponentialRampToValueAtTime(v || 0.1, t0 + 0.012); g.gain.exponentialRampToValueAtTime(0.0001, t0 + d); o.connect(g); g.connect(to || out()); o.start(t0); o.stop(t0 + d + 0.05); }
    function noise(d, v, delay, lp, hp, sweep) { const c = ac(); if (!c) return; const n = Math.floor(c.sampleRate * d), b = c.createBuffer(1, n, c.sampleRate), data = b.getChannelData(0); for (let i = 0; i < n; i++) data[i] = (Math.random() * 2 - 1) * (1 - i / n); const s = c.createBufferSource(); s.buffer = b; const g = c.createGain(); g.gain.value = v || 0.1; const f = c.createBiquadFilter(); f.type = hp ? "bandpass" : "lowpass"; const t0 = c.currentTime + (delay || 0); f.frequency.setValueAtTime(lp || 1800, t0); if (sweep) f.frequency.exponentialRampToValueAtTime(sweep, t0 + d); s.connect(f); f.connect(g); g.connect(out()); s.start(t0); }
    const S = {
      setVol(v) { vol = v; try { localStorage.setItem("bousk.vol", String(v)); } catch (e) { /* rien */ } if (master) master.gain.value = muted ? 0 : vol; },
      get vol() { return vol; }, get muted() { return muted; },
      setMute(m) { muted = m; try { localStorage.setItem("bousk.mute", m ? "1" : "0"); } catch (e) { /* rien */ } if (master) master.gain.value = muted ? 0 : vol; },
      unlock() { ac(); },
      click() { tone(660, 0.08, "triangle", 0.08); },
      beep(i) { tone(i ? 880 : 520, i ? 0.35 : 0.18, "square", 0.07); },
      go() { tone(520, 0.1, "square", 0.08); tone(780, 0.1, "square", 0.08, 0.08); tone(1040, 0.35, "square", 0.09, 0.16); },
      chargeStart() { const c = ac(); if (!c) return; this.chargeStop(); const o = c.createOscillator(), g = c.createGain(), f = c.createBiquadFilter(); o.type = "sawtooth"; o.frequency.value = 120; f.type = "lowpass"; f.frequency.value = 600; g.gain.value = 0.0001; g.gain.linearRampToValueAtTime(0.05, c.currentTime + 0.05); o.connect(f); f.connect(g); g.connect(out()); o.start(); chargeNode = { o, g, f }; },
      chargeSet(ch) { if (chargeNode && ctx) { chargeNode.o.frequency.setTargetAtTime(120 + ch * 520, ctx.currentTime, 0.04); chargeNode.f.frequency.setTargetAtTime(600 + ch * 2600, ctx.currentTime, 0.04); } },
      chargeStop() { if (chargeNode && ctx) { try { chargeNode.g.gain.setTargetAtTime(0.0001, ctx.currentTime, 0.03); chargeNode.o.stop(ctx.currentTime + 0.15); } catch (e) { /* rien */ } } chargeNode = null; },
      dash(c) { noise(0.25 + c * 0.2, 0.12 + c * 0.1, 0, 3000, true, 600); tone(200 + c * 100, 0.2, "sawtooth", 0.05, 0, 90); },
      pulse() { noise(0.12, 0.12, 0, 2500, true, 800); tone(320, 0.1, "triangle", 0.06, 0, 160); },
      hit(p) { p = Math.max(0.1, Math.min(1, p)); noise(0.18 + p * 0.15, 0.2 + p * 0.25, 0, 900 + p * 500); tone(130 - p * 40, 0.22 + p * 0.1, "sine", 0.22 + p * 0.2, 0, 50); if (p > 0.55) tone(90, 0.3, "square", 0.08, 0.02, 40); },
      bump() { tone(520, 0.18, "triangle", 0.1, 0, 1100); tone(780, 0.12, "sine", 0.06, 0.05); },
      jump() { tone(300, 0.14, "square", 0.06, 0, 640); tone(600, 0.08, "sine", 0.04, 0.04, 900); },
      spring() { tone(220, 0.3, "triangle", 0.12, 0, 900); tone(440, 0.2, "sine", 0.05, 0.05, 1300); },
      land() { noise(0.1, 0.08, 0, 700); tone(110, 0.1, "sine", 0.1, 0, 70); },
      fall() { tone(700, 0.9, "sine", 0.09, 0, 70); },
      ko() { tone(420, 0.1, "square", 0.07); tone(300, 0.12, "square", 0.07, 0.08); tone(180, 0.3, "square", 0.07, 0.16); },
      crumble() { noise(0.4, 0.14, 0, 500); tone(70, 0.4, "sawtooth", 0.05, 0, 40); },
      bar() { noise(0.12, 0.14, 0, 1100); tone(150, 0.15, "square", 0.06, 0, 80); },
      win() { [523, 659, 784, 1047].forEach((f, i) => tone(f, 0.28, "triangle", 0.1, i * 0.13)); tone(1047, 0.6, "triangle", 0.1, 0.55); },
      lose() { tone(300, 0.4, "triangle", 0.08, 0, 150); },
      crown() { tone(784, 0.15, "triangle", 0.08); tone(988, 0.25, "triangle", 0.08, 0.1); },
      gust() { noise(1.6, 0.06, 0, 500, true, 1800); },
      ambience(theme) {
        const c = ac(); if (!c) return; this.stopAmb(); const notes = { cloud: [261.6, 329.6, 392, 523.3], factory: [110, 146.8, 164.8, 220], carousel: [349.2, 440, 523.3, 659.3], island: [293.7, 370, 440, 587.3], sections: [246.9, 311.1, 370, 493.9], fair: [392, 493.9, 587.3, 784], float: [196, 233, 293.7, 392] }[theme] || [261.6, 329.6, 392, 523.3];
        const g = c.createGain(); g.gain.value = 0.0001; g.gain.linearRampToValueAtTime(0.045, c.currentTime + 2); g.connect(out()); const f = c.createBiquadFilter(); f.type = "lowpass"; f.frequency.value = 1400; f.connect(g);
        const oscs = notes.map((n, i) => { const o = c.createOscillator(); o.type = i % 2 ? "triangle" : "sine"; o.frequency.value = n * (i === 0 ? 0.5 : 1); const og = c.createGain(); og.gain.value = 0.25; const lfo = c.createOscillator(); lfo.frequency.value = 0.07 + i * 0.03; const lg = c.createGain(); lg.gain.value = 0.2; lfo.connect(lg); lg.connect(og.gain); o.connect(og); og.connect(f); o.start(); lfo.start(); return [o, lfo]; });
        // petit arpège doux
        let step = 0; const timer = setInterval(() => { if (!amb) return; const n = notes[(step * 3 + (step >> 2)) % notes.length]; tone(n * 2, 0.9, "sine", 0.025, 0, null, g); step++; }, theme === "factory" ? 700 : 520);
        amb = { g, oscs, timer, c };
      },
      stopAmb() { if (!amb) return; try { clearInterval(amb.timer); amb.g.gain.setTargetAtTime(0.0001, amb.c.currentTime, 0.2); amb.oscs.forEach(([o, l]) => { o.stop(amb.c.currentTime + 1); l.stop(amb.c.currentTime + 1); }); } catch (e) { /* rien */ } amb = null; },
    };
    return S;
  })();
})();

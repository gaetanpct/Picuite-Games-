// ============================================================
// VERTIGOGO — Particules et sons (synthétisés, aucun fichier audio)
// ============================================================
(function () {
  const T = THREE; const TAU = Math.PI * 2;
  const FX = {}; window.VgFX = FX;
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
  FX.dust = (x, y, z, dx, dz, n) => { for (let i = 0; i < lim(n || 3); i++) spawn(x + R(-0.2, 0.2), y + 0.1, z + R(-0.2, 0.2), -dx * R(0.3, 1.2) + R(-0.8, 0.8), R(0.3, 1.2), -dz * R(0.3, 1.2) + R(-0.8, 0.8), R(0.45, 0.85), 0xf4ead8, 0, R(0.35, 0.7), { a: 0.55, grow: 1.4, drag: 3 }); };
  FX.land = (x, y, z, v) => { const n = lim(5 + Math.min(10, v * 0.6)); for (let i = 0; i < n; i++) { const a = R(0, TAU), s = R(1, 2.5 + v * 0.15); spawn(x, y + 0.1, z, Math.cos(a) * s, R(0.3, 1.2), Math.sin(a) * s, R(0.5, 0.95), 0xf4ead8, 0, R(0.4, 0.8), { a: 0.6, grow: 1.6, drag: 3 }); } FX.ring(x, y, z, 0xffffff, 0.9 + v * 0.05, 0.3); };
  FX.ring = (x, y, z, hex, size, life) => {
    if (!scene) return; let m = ringPool.pop(); if (!m) { m = new T.Mesh(new T.RingGeometry(0.85, 1, 32), new T.MeshBasicMaterial({ transparent: true, depthWrite: false, side: T.DoubleSide })); m.rotation.x = -Math.PI / 2; scene.add(m); }
    m.material.color.set(hex); m.position.set(x, y + 0.06, z); m.userData = { t: 0, life, size }; m.visible = true; rings.push(m);
  };
  FX.poof = (x, y, z, hex) => { for (let i = 0; i < lim(14); i++) { const a = R(0, TAU), s = R(1, 4); spawn(x, y, z, Math.cos(a) * s, R(0, 3), Math.sin(a) * s, R(0.8, 1.6), hex || 0xffffff, 0, R(0.5, 0.9), { a: 0.7, grow: 1.5, drag: 2.5 }); } };
  FX.spring = (x, y, z) => { for (let i = 0; i < lim(12); i++) { const a = R(0, TAU); spawn(x + Math.cos(a) * 0.6, y + 0.3, z + Math.sin(a) * 0.6, Math.cos(a) * 1.5, R(2, 6), Math.sin(a) * 1.5, R(0.4, 0.7), 0x7fd3ff, 3, R(0.4, 0.8), { grav: 4 }); } FX.ring(x, y, z, 0x7fd3ff, 2, 0.4); };
  FX.grab = (x, y, z) => { for (let i = 0; i < lim(6); i++) spawn(x + R(-0.3, 0.3), y + 1.5, z + R(-0.3, 0.3), R(-1, 1), R(0.5, 2), R(-1, 1), R(0.25, 0.45), 0xffe14d, 1, R(0.3, 0.55), { grav: 3 }); };
  FX.checkpoint = (x, y, z) => { for (let i = 0; i < lim(26); i++) { const a = R(0, TAU), s = R(1, 4); spawn(x, y + 0.6, z, Math.cos(a) * s, R(2, 7), Math.sin(a) * s, R(0.35, 0.7), [0xffd23d, 0x7be07b, 0xffffff][i % 3], 1, R(0.8, 1.5), { grav: 5, drag: 1.2 }); } FX.ring(x, y, z, 0x7be07b, 3.4, 0.7); };
  FX.confetti = (x, y, z, n) => { for (let i = 0; i < lim(n || 40); i++) spawn(x + R(-3, 3), y + R(0, 3), z + R(-3, 3), R(-3, 3), R(2, 9), R(-3, 3), R(0.25, 0.5), [0xff5a6a, 0xffd23d, 0x2fa8ff, 0x7be07b, 0xff7ab8][i % 5], 1, R(1.8, 3.4), { grav: 6, drag: 1.2 }); };
  FX.crumble = (x, y, z) => { for (let i = 0; i < lim(8); i++) spawn(x + R(-1.2, 1.2), y, z + R(-1.2, 1.2), R(-0.5, 0.5), R(-1, 0.5), R(-0.5, 0.5), R(0.3, 0.6), 0xe8dcc4, 0, R(0.5, 0.9), { a: 0.7, grav: 6 }); };
  FX.wind = (x, y, z, vy) => { if (Math.random() > (quality === "low" ? 0.25 : 0.7)) return; spawn(x + R(-4, 4), y + R(-2, 3), z + R(-4, 4), 0, 12 + vy * -0.5, 0, R(0.3, 0.5), 0xffffff, 0, R(0.25, 0.4), { a: 0.35, drag: 0.1 }); };
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
    let ctx = null, master = null, amb = null; let vol = 0.7, muted = false;
    try { const v = localStorage.getItem("vg.vol"); if (v !== null) vol = Math.max(0, Math.min(1, +v)); muted = localStorage.getItem("vg.mute") === "1"; } catch (e) { /* rien */ }
    const ac = () => { try { if (!ctx) { ctx = new (window.AudioContext || window.webkitAudioContext)(); master = ctx.createGain(); master.gain.value = muted ? 0 : vol; master.connect(ctx.destination); } if (ctx.state === "suspended") ctx.resume(); return ctx; } catch (e) { return null; } };
    function tone(f, d, type, v, delay, slide) { const c = ac(); if (!c) return; const t0 = c.currentTime + (delay || 0); const o = c.createOscillator(), g = c.createGain(); o.type = type || "sine"; o.frequency.setValueAtTime(f, t0); if (slide) o.frequency.exponentialRampToValueAtTime(Math.max(20, slide), t0 + d); g.gain.setValueAtTime(0.0001, t0); g.gain.exponentialRampToValueAtTime(v || 0.1, t0 + 0.012); g.gain.exponentialRampToValueAtTime(0.0001, t0 + d); o.connect(g); g.connect(master); o.start(t0); o.stop(t0 + d + 0.05); }
    function noise(d, v, delay, lp, hp, sweep) { const c = ac(); if (!c) return; const n = Math.floor(c.sampleRate * d), b = c.createBuffer(1, n, c.sampleRate), data = b.getChannelData(0); for (let i = 0; i < n; i++) data[i] = (Math.random() * 2 - 1) * (1 - i / n); const s = c.createBufferSource(); s.buffer = b; const f = c.createBiquadFilter(); f.type = hp ? "highpass" : "lowpass"; const t0 = c.currentTime + (delay || 0); f.frequency.setValueAtTime(lp || 1200, t0); if (sweep) f.frequency.exponentialRampToValueAtTime(sweep, t0 + d); const g = c.createGain(); g.gain.value = v || 0.1; s.connect(f); f.connect(g); g.connect(master); s.start(t0); }
    const S = {
      setVol(v) { vol = v; try { localStorage.setItem("vg.vol", String(v)); } catch (e) { /* rien */ } if (master) master.gain.value = muted ? 0 : vol; },
      get vol() { return vol; }, get muted() { return muted; },
      setMute(m) { muted = m; try { localStorage.setItem("vg.mute", m ? "1" : "0"); } catch (e) { /* rien */ } if (master) master.gain.value = muted ? 0 : vol; },
      unlock() { ac(); },
      click() { tone(660, 0.08, "triangle", 0.08); },
      beep(i) { tone(i ? 880 : 520, i ? 0.35 : 0.18, "square", 0.07); },
      go() { tone(520, 0.1, "square", 0.08); tone(780, 0.1, "square", 0.08, 0.08); tone(1040, 0.35, "square", 0.09, 0.16); },
      jump() { tone(260, 0.14, "triangle", 0.09, 0, 520); noise(0.08, 0.05, 0, 1800, true); },
      land(v) { v = Math.max(3, Math.min(20, v || 6)) / 20; noise(0.1 + v * 0.1, 0.06 + v * 0.14, 0, 600 + v * 600); tone(120 - v * 40, 0.12, "sine", 0.1 + v * 0.1, 0, 60); },
      step() { noise(0.04, 0.035, 0, 900 + Math.random() * 500); },
      grab() { tone(330, 0.07, "square", 0.06); tone(440, 0.09, "square", 0.06, 0.06); noise(0.06, 0.06, 0, 1500, true); },
      mantle() { tone(300, 0.2, "triangle", 0.08, 0, 600); noise(0.15, 0.05, 0, 1200); },
      spring() { tone(200, 0.35, "triangle", 0.12, 0, 1000); tone(420, 0.25, "sine", 0.06, 0.05, 1400); },
      crumble() { noise(0.45, 0.13, 0, 500); tone(70, 0.45, "sawtooth", 0.05, 0, 40); },
      sweep() { noise(0.14, 0.12, 0, 1100); tone(150, 0.16, "square", 0.06, 0, 80); },
      checkpoint() { [659, 880, 1175].forEach((f, i) => tone(f, 0.22, "triangle", 0.09, i * 0.09)); },
      fall() { tone(800, 1.1, "sine", 0.08, 0, 60); noise(0.8, 0.05, 0, 600, true, 2200); },
      respawn() { tone(330, 0.12, "triangle", 0.07); tone(494, 0.2, "triangle", 0.07, 0.1); },
      win() { [523, 659, 784, 1047].forEach((f, i) => tone(f, 0.28, "triangle", 0.1, i * 0.13)); tone(1047, 0.7, "triangle", 0.1, 0.55); },
      finish() { [392, 523, 659, 784, 1047].forEach((f, i) => tone(f, 0.22, "triangle", 0.1, i * 0.1)); },
      // vent d'altitude, plus fort quand on monte ou qu'on tombe vite
      wind(level) { const c = ac(); if (!c) return; if (!amb) { const n = c.sampleRate * 2, b = c.createBuffer(1, n, c.sampleRate), d = b.getChannelData(0); let l = 0; for (let i = 0; i < n; i++) { l = l * 0.96 + (Math.random() * 2 - 1) * 0.04; d[i] = l * 6; } const s = c.createBufferSource(); s.buffer = b; s.loop = true; const f = c.createBiquadFilter(); f.type = "bandpass"; f.frequency.value = 500; f.Q.value = 0.6; const g = c.createGain(); g.gain.value = 0; s.connect(f); f.connect(g); g.connect(master); s.start(); amb = { s, f, g, c }; } amb.g.gain.setTargetAtTime(Math.min(0.5, level) * 0.5, c.currentTime, 0.2); amb.f.frequency.setTargetAtTime(350 + Math.min(1, level) * 900, c.currentTime, 0.2); },
      stopAmb() { if (!amb) return; try { amb.g.gain.setTargetAtTime(0.0001, amb.c.currentTime, 0.2); amb.s.stop(amb.c.currentTime + 1); } catch (e) { /* rien */ } amb = null; },
    };
    return S;
  })();
})();

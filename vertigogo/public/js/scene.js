// ============================================================
// VERTIGOGO — Décors, plateformes, ciel et lumière (tout est dessiné par le code)
// ============================================================
(function () {
  const T = THREE; const TAU = Math.PI * 2;
  const api = {}; window.VgScene = api;
  const C3 = (h) => new T.Color(h);

  // ---------- palettes des huit mondes ----------
  const THEMES = [
    { n: "chantier", sky: [0x5aa7e6, 0xcfe6f5], fog: 0xcfe6f5, sun: 0xfff1d0, hemi: [0xd8ecff, 0x9a8f80], top: ["concrete", 0xb9b4a8, 0x8f8a7e], side: [0x8d887c, 0x6f6a60], accent: 0xffc21a },
    { n: "toits", sky: [0xf29b6a, 0xffd9b0], fog: 0xffd9b0, sun: 0xffc48a, hemi: [0xffe2c4, 0x8a6a6a], top: ["tiles", 0xb5654a, 0x8a4a38], side: [0x9d7a64, 0x6e5446], accent: 0xff6a4d },
    { n: "usine", sky: [0x56606f, 0xa9b4bf], fog: 0x9aa6b2, sun: 0xdde6ee, hemi: [0xc2ccd6, 0x555a60], top: ["metal", 0x4b535c, 0x8d99a4], side: [0x39414a, 0x27303a], accent: 0xffb000 },
    { n: "jardin", sky: [0x7fd0ff, 0xdcf6c9], fog: 0xdcf6c9, sun: 0xffffe0, hemi: [0xe8ffd8, 0x6a8a4a], top: ["grass", 0x5cb85c, 0x9be07a], side: [0x7a5a3a, 0x5a4028], accent: 0xff7aa8 },
    { n: "foraine", sky: [0x3b2a8a, 0xff9ad0], fog: 0xe9a0d0, sun: 0xffe0f0, hemi: [0xffd6f0, 0x6a4a8a], top: ["stripes", 0xff5a7a, 0xfff0f0], side: [0xf0e0c8, 0xc0a890], accent: 0xffe14d },
    { n: "nuages", sky: [0x4a90e8, 0xeaf4ff], fog: 0xeaf4ff, sun: 0xffffff, hemi: [0xf4faff, 0x9ab6d8], top: ["cloud", 0xf6f9ff, 0xdbe8f8], side: [0xe2ecf8, 0xc6d6ec], accent: 0xffd166 },
    { n: "meca", sky: [0x3a2a1a, 0x9a7a4a], fog: 0x8a6a40, sun: 0xffd89a, hemi: [0xffe0b0, 0x5a3a1a], top: ["metal", 0x9a7a3a, 0xd9b45a], side: [0x6a4a22, 0x4a3016], accent: 0x6ad8ff },
    { n: "surreal", sky: [0x0b0626, 0x5a2a8a], fog: 0x3a1a6a, sun: 0xd8b0ff, hemi: [0xb890ff, 0x201040], top: ["crystal", 0x7a4af0, 0xc9a8ff], side: [0x3a2a7a, 0x241a5a], accent: 0x5af0ff },
  ];
  api.THEMES = THEMES;

  // ---------- textures dessinées ----------
  const rnd = (() => { let a = 12345; return () => { a = (a * 1664525 + 1013904223) >>> 0; return a / 4294967296; }; })();
  const hex = (c) => "#" + ("000000" + c.toString(16)).slice(-6);
  const texCache = {};
  function canvasTex(key, size, draw, repeat) {
    if (texCache[key]) return texCache[key]; const c = document.createElement("canvas"); c.width = c.height = size; const g = c.getContext("2d"); draw(g, size);
    const t = new T.CanvasTexture(c); t.wrapS = t.wrapT = T.RepeatWrapping; t.anisotropy = 4; if (T.sRGBEncoding) t.encoding = T.sRGBEncoding; texCache[key] = t; return t;
  }
  function topTex(kind, c1, c2) {
    return canvasTex("top" + kind + c1 + c2, 128, (g, s) => {
      g.fillStyle = hex(c1); g.fillRect(0, 0, s, s);
      if (kind === "concrete") { for (let i = 0; i < 260; i++) { g.fillStyle = rnd() < 0.5 ? hex(c2) : "#ffffff"; g.globalAlpha = 0.12; g.fillRect(rnd() * s, rnd() * s, 2 + rnd() * 3, 2 + rnd() * 3); } g.globalAlpha = 1; }
      else if (kind === "tiles") { g.fillStyle = hex(c2); for (let y = 0; y < s; y += 32) for (let x = (y / 32 % 2) * 16; x < s + 16; x += 32) { g.fillRect(x, y, 30, 2); g.fillRect(x, y, 2, 32); } g.globalAlpha = 0.1; for (let i = 0; i < 80; i++) { g.fillStyle = "#000"; g.fillRect(rnd() * s, rnd() * s, 6, 3); } g.globalAlpha = 1; }
      else if (kind === "metal") { g.fillStyle = hex(c2); g.globalAlpha = 0.5; for (let i = 0; i < s; i += 16) { g.fillRect(i, 0, 2, s); g.fillRect(0, i, s, 2); } g.globalAlpha = 1; for (let y = 8; y < s; y += 32) for (let x = 8; x < s; x += 32) { g.fillStyle = hex(c2); g.beginPath(); g.arc(x, y, 3, 0, TAU); g.fill(); } }
      else if (kind === "grass") { for (let i = 0; i < 380; i++) { g.strokeStyle = hex(rnd() < 0.5 ? c2 : 0x3f9a47); g.globalAlpha = 0.55; const x = rnd() * s, y = rnd() * s; g.beginPath(); g.moveTo(x, y); g.lineTo(x + rnd() * 4 - 2, y - 5 - rnd() * 7); g.stroke(); } g.globalAlpha = 1; for (let i = 0; i < 4; i++) { g.fillStyle = "#fff"; g.beginPath(); g.arc(rnd() * s, rnd() * s, 2.5, 0, TAU); g.fill(); } }
      else if (kind === "stripes") { g.fillStyle = hex(c2); for (let i = -s; i < s * 2; i += 32) { g.beginPath(); g.moveTo(i, 0); g.lineTo(i + 16, 0); g.lineTo(i + 16 + s, s); g.lineTo(i + s, s); g.fill(); } }
      else if (kind === "cloud") { for (let i = 0; i < 26; i++) { const gr = g.createRadialGradient(0, 0, 0, 0, 0, 26); gr.addColorStop(0, "rgba(255,255,255,0.85)"); gr.addColorStop(1, "rgba(255,255,255,0)"); g.save(); g.translate(rnd() * s, rnd() * s); g.fillStyle = gr; g.fillRect(-26, -26, 52, 52); g.restore(); } g.globalAlpha = 0.35; g.fillStyle = hex(c2); for (let i = 0; i < 16; i++) { g.beginPath(); g.arc(rnd() * s, rnd() * s, 8 + rnd() * 12, 0, TAU); g.fill(); } g.globalAlpha = 1; }
      else if (kind === "crystal") { const gr = g.createLinearGradient(0, 0, s, s); gr.addColorStop(0, hex(c1)); gr.addColorStop(1, hex(c2)); g.fillStyle = gr; g.fillRect(0, 0, s, s); g.strokeStyle = "rgba(255,255,255,0.35)"; g.lineWidth = 2; for (let i = 0; i < 7; i++) { g.beginPath(); g.moveTo(rnd() * s, rnd() * s); g.lineTo(rnd() * s, rnd() * s); g.stroke(); } }
      // bord clair, très lisible pour juger le rebord
      g.strokeStyle = "rgba(255,255,255,0.55)"; g.lineWidth = 6; g.strokeRect(1, 1, s - 2, s - 2); g.strokeStyle = "rgba(0,0,0,0.25)"; g.lineWidth = 2; g.strokeRect(5, 5, s - 10, s - 10);
    });
  }
  function sideTex(c1, c2) { return canvasTex("side" + c1 + c2, 64, (g, s) => { g.fillStyle = hex(c1); g.fillRect(0, 0, s, s); g.fillStyle = hex(c2); g.globalAlpha = 0.5; g.fillRect(0, s - 14, s, 14); g.globalAlpha = 0.18; for (let i = 0; i < 40; i++) g.fillRect(rnd() * s, rnd() * s, 3, 2); g.globalAlpha = 1; }); }
  const hazardTex = () => canvasTex("hazard", 64, (g, s) => { g.fillStyle = "#ffcf1a"; g.fillRect(0, 0, s, s); g.fillStyle = "#222"; for (let i = -s; i < s * 2; i += 32) { g.beginPath(); g.moveTo(i, 0); g.lineTo(i + 16, 0); g.lineTo(i + 16 + s, s); g.lineTo(i + s, s); g.fill(); } });
  const barTex = () => canvasTex("bar", 64, (g, s) => { g.fillStyle = "#ffffff"; g.fillRect(0, 0, s, s); g.fillStyle = "#e8453c"; for (let i = 0; i < s; i += 32) g.fillRect(i, 0, 16, s); });
  api.softTex = null;

  const matCache = {};
  const lam = (o) => new T.MeshLambertMaterial(o);
  function mats(zi, theme) {
    const k = "m" + theme; if (matCache[k]) return matCache[k]; const th = THEMES[theme];
    const m = { top: lam({ map: topTex(th.top[0], th.top[1], th.top[2]) }), side: lam({ map: sideTex(th.side[0], th.side[1]) }) };
    m.ice = { top: lam({ color: 0xcdefff, emissive: 0x2a5a80, map: topTex("crystal", 0xbfe8ff, 0xffffff), transparent: true, opacity: 0.92 }), side: lam({ color: 0x9ad8ff, emissive: 0x1a4060, transparent: true, opacity: 0.85 }) };
    m.crumble = { top: lam({ map: topTex("tiles", 0xd8c8a8, 0x8a7a5a) }), side: lam({ color: 0x9a8a6a }) };
    m.mover = { top: lam({ map: topTex(th.top[0], th.top[1], th.top[2]), emissive: 0x201400 }), side: lam({ map: hazardTex() }) };
    matCache[k] = m; return m;
  }

  // ---------- fusion de boîtes statiques en un seul maillage ----------
  function mergeBoxes(list, which, tile) {
    const pos = [], nor = [], uv = [], idx = []; let n = 0;
    const quad = (p, nm, uvs) => { for (let i = 0; i < 4; i++) { pos.push(p[i][0], p[i][1], p[i][2]); nor.push(nm[0], nm[1], nm[2]); uv.push(uvs[i][0], uvs[i][1]); } idx.push(n, n + 1, n + 2, n, n + 2, n + 3); n += 4; };
    list.forEach((b) => {
      const x0 = b.x0, x1 = b.x1, y0 = b.y0, y1 = b.y1, z0 = b.z0, z1 = b.z1, w = (x1 - x0) / tile, h = (y1 - y0) / tile, d = (z1 - z0) / tile;
      if (which === "top") quad([[x0, y1, z1], [x1, y1, z1], [x1, y1, z0], [x0, y1, z0]], [0, 1, 0], [[0, 0], [w, 0], [w, d], [0, d]]);
      else {
        quad([[x0, y0, z0], [x1, y0, z0], [x1, y0, z1], [x0, y0, z1]], [0, -1, 0], [[0, 0], [w, 0], [w, d], [0, d]]);
        quad([[x0, y0, z1], [x1, y0, z1], [x1, y1, z1], [x0, y1, z1]], [0, 0, 1], [[0, 0], [w, 0], [w, h], [0, h]]);
        quad([[x1, y0, z0], [x0, y0, z0], [x0, y1, z0], [x1, y1, z0]], [0, 0, -1], [[0, 0], [w, 0], [w, h], [0, h]]);
        quad([[x1, y0, z1], [x1, y0, z0], [x1, y1, z0], [x1, y1, z1]], [1, 0, 0], [[0, 0], [d, 0], [d, h], [0, h]]);
        quad([[x0, y0, z0], [x0, y0, z1], [x0, y1, z1], [x0, y1, z0]], [-1, 0, 0], [[0, 0], [d, 0], [d, h], [0, h]]);
      }
    });
    const g = new T.BufferGeometry(); g.setAttribute("position", new T.Float32BufferAttribute(pos, 3)); g.setAttribute("normal", new T.Float32BufferAttribute(nor, 3)); g.setAttribute("uv", new T.Float32BufferAttribute(uv, 2)); g.setIndex(idx); g.computeBoundingSphere(); return g;
  }

  // ---------- petits générateurs de décor ----------
  const lm = (c, o) => new T.MeshLambertMaterial(Object.assign({ color: c }, o || {}));
  const bx = (w, h, d, c, o) => new T.Mesh(new T.BoxGeometry(w, h, d), lm(c, o));
  const cyl = (rt, rb, h, c, seg, o) => new T.Mesh(new T.CylinderGeometry(rt, rb, h, seg || 14), lm(c, o));
  const sph = (r, c, o, ws, hs) => new T.Mesh(new T.SphereGeometry(r, ws || 14, hs || 10), lm(c, o));
  function setPos(m, x, y, z, ry) { m.position.set(x, y, z); if (ry) m.rotation.y = ry; return m; }

  const DECOR = {
    // chantier : grues et échafaudages
    0(g, z, R, y0, y1) {
      for (let i = 0; i < 4; i++) { const a = (i / 4) * TAU + R() * 0.6, r = 38 + R() * 22, x = Math.cos(a) * r, zz = Math.sin(a) * r, h = 38 + R() * 30; const base = y0 - 6;
        const mast = bx(1.6, h, 1.6, 0xffc21a); setPos(mast, x, base + h / 2, zz); g.add(mast); const jib = bx(26, 1.1, 1.1, 0xffc21a); setPos(jib, x + Math.cos(a + 1.57) * 8, base + h, zz + Math.sin(a + 1.57) * 8, -(a + 1.57)); g.add(jib);
        const cab = bx(2.4, 2.4, 2.4, 0x3a4a5a); setPos(cab, x, base + h - 1.8, zz); g.add(cab); const cable = cyl(0.08, 0.08, 9, 0x222222, 4); setPos(cable, x + Math.cos(a + 1.57) * 14, base + h - 4.5, zz + Math.sin(a + 1.57) * 14); g.add(cable);
        const load = bx(2.6, 1.4, 2.6, 0x8a5a2a); setPos(load, x + Math.cos(a + 1.57) * 14, base + h - 10, zz + Math.sin(a + 1.57) * 14); g.add(load); }
      for (let i = 0; i < 8; i++) { const a = R() * TAU, r = 30 + R() * 22; const s = bx(5 + R() * 6, 14 + R() * 26, 5 + R() * 6, [0x9a968c, 0xaaa69c, 0x86827a][i % 3]); setPos(s, Math.cos(a) * r, y0 - 10 + s.geometry.parameters.height / 2, Math.sin(a) * r); g.add(s); }
    },
    // toits : immeubles, cheminées, antennes
    1(g, z, R, y0, y1) {
      for (let i = 0; i < 14; i++) { const a = R() * TAU, r = 34 + R() * 34, h = 14 + R() * 60, w = 7 + R() * 9; const b = bx(w, h, w, [0xd9b08c, 0xc98a6a, 0xe8c9a6, 0xb87a5a][i % 4]); setPos(b, Math.cos(a) * r, y0 - 8 + h / 2 - 10, Math.sin(a) * r); g.add(b);
        const roof = bx(w + 0.6, 0.8, w + 0.6, 0x7a4a3a); setPos(roof, b.position.x, b.position.y + h / 2 + 0.4, b.position.z); g.add(roof); if (R() < 0.6) { const ch = bx(1.2, 3.4, 1.2, 0x8a4a3a); setPos(ch, b.position.x + (R() - 0.5) * w * 0.5, b.position.y + h / 2 + 2, b.position.z + (R() - 0.5) * w * 0.5); g.add(ch); } if (R() < 0.5) { const an = cyl(0.08, 0.08, 6, 0x333333, 4); setPos(an, b.position.x, b.position.y + h / 2 + 3.5, b.position.z); g.add(an); } }
    },
    // usine : tuyaux et engrenages
    2(g, z, R, y0, y1) {
      for (let i = 0; i < 7; i++) { const a = R() * TAU, r = 32 + R() * 24; const p = cyl(1.6, 1.6, 40 + R() * 30, 0x6a737d, 12); p.rotation.z = R() < 0.5 ? 0 : 1.5708; setPos(p, Math.cos(a) * r, y0 + R() * (y1 - y0), Math.sin(a) * r); g.add(p); }
      g.userData.spin = g.userData.spin || [];
      for (let i = 0; i < 5; i++) { const a = R() * TAU, r = 36 + R() * 22; const gear = new T.Group(); const body = cyl(5 + R() * 3, 5 + R() * 3, 1.4, 0x7d8791, 20); body.rotation.x = 1.5708; gear.add(body); for (let k = 0; k < 12; k++) { const t = bx(1.5, 1.5, 1.4, 0x7d8791); const aa = (k / 12) * TAU; t.position.set(Math.cos(aa) * (body.geometry.parameters.radiusTop + 0.6), Math.sin(aa) * (body.geometry.parameters.radiusTop + 0.6), 0); t.rotation.z = aa; gear.add(t); } setPos(gear, Math.cos(a) * r, y0 + R() * (y1 - y0), Math.sin(a) * r, -a); g.add(gear); g.userData.spin.push([gear, (R() < 0.5 ? -1 : 1) * (0.1 + R() * 0.2)]); }
    },
    // jardin : champignons et fleurs géants
    3(g, z, R, y0, y1) {
      for (let i = 0; i < 10; i++) { const a = R() * TAU, r = 28 + R() * 30, h = 12 + R() * 28; const stem = cyl(1.4, 1.9, h, 0xf3e7cf, 10); setPos(stem, Math.cos(a) * r, y0 - 12 + h / 2, Math.sin(a) * r); g.add(stem); const cap = new T.Mesh(new T.SphereGeometry(5 + R() * 4, 16, 8, 0, TAU, 0, Math.PI / 2), lm([0xe8453c, 0xff9a3d, 0xc45af0][i % 3])); setPos(cap, stem.position.x, stem.position.y + h / 2, stem.position.z); g.add(cap); for (let k = 0; k < 6; k++) { const dot = sph(0.7, 0xffffff, null, 8, 6); const aa = R() * TAU, rr = 2 + R() * 3; dot.position.set(cap.position.x + Math.cos(aa) * rr, cap.position.y + 2.2 + R(), cap.position.z + Math.sin(aa) * rr); g.add(dot); } }
      for (let i = 0; i < 8; i++) { const a = R() * TAU, r = 26 + R() * 30, h = 14 + R() * 22; const stem = cyl(0.35, 0.5, h, 0x3f9a47, 6); setPos(stem, Math.cos(a) * r, y0 - 10 + h / 2, Math.sin(a) * r); g.add(stem); const fl = new T.Group(); const c = [0xff7aa8, 0xffd23d, 0x9a7aff][i % 3]; for (let k = 0; k < 8; k++) { const p = sph(1.6, c, null, 8, 6); const aa = (k / 8) * TAU; p.position.set(Math.cos(aa) * 2.4, 0, Math.sin(aa) * 2.4); p.scale.set(1, 0.4, 1); fl.add(p); } const mid = sph(1.3, 0xffe14d, null, 8, 6); fl.add(mid); setPos(fl, stem.position.x, stem.position.y + h / 2, stem.position.z); g.add(fl); }
    },
    // fête foraine : grande roue, ballons, toits de manège
    4(g, z, R, y0, y1) {
      const wheel = new T.Group(); const rim = new T.Mesh(new T.TorusGeometry(15, 0.5, 6, 40), lm(0xff5a7a)); wheel.add(rim); for (let k = 0; k < 10; k++) { const a = (k / 10) * TAU; const sp = bx(30, 0.25, 0.25, 0xfff0f0); sp.rotation.z = a; wheel.add(sp); const gon = bx(2.2, 1.8, 1.6, [0xffd23d, 0x2fa8ff, 0x7be07b, 0xff7ab8][k % 4]); gon.position.set(Math.cos(a) * 15, Math.sin(a) * 15, 0); gon.userData.gond = true; wheel.add(gon); } setPos(wheel, 52, y0 + 10 + (y1 - y0) * 0.45, -20, 0.5); g.add(wheel); g.userData.wheel = wheel;
      const leg = bx(1.2, 30, 1.2, 0x8a6a8a); setPos(leg, 52, wheel.position.y - 15, -20); g.add(leg);
      for (let i = 0; i < 14; i++) { const a = R() * TAU, r = 28 + R() * 34; const b = sph(2 + R() * 1.4, [0xff5a6a, 0xffd23d, 0x2fa8ff, 0x7be07b, 0xff7ab8][i % 5], null, 12, 8); setPos(b, Math.cos(a) * r, y0 + R() * (y1 - y0), Math.sin(a) * r); g.add(b); const str = cyl(0.04, 0.04, 8, 0xffffff, 3); setPos(str, b.position.x, b.position.y - 5, b.position.z); g.add(str); }
      for (let i = 0; i < 4; i++) { const a = R() * TAU, r = 40 + R() * 20; const roof = new T.Mesh(new T.ConeGeometry(7, 5, 12), lm([0xff5a7a, 0x2fa8ff][i % 2])); setPos(roof, Math.cos(a) * r, y0 - 4 + R() * 12, Math.sin(a) * r); g.add(roof); const post = cyl(0.3, 0.3, 6, 0xfff0f0, 6); setPos(post, roof.position.x, roof.position.y - 4, roof.position.z); g.add(post); }
    },
    // nuages : grappes de boules blanches
    5(g, z, R, y0, y1) {
      for (let i = 0; i < 22; i++) { const a = R() * TAU, r = 26 + R() * 50; const cl = new T.Group(); const n = 4 + Math.floor(R() * 4); for (let k = 0; k < n; k++) { const s = sph(3 + R() * 4, 0xffffff, { emissive: 0x334466 }, 12, 8); s.position.set((k - n / 2) * 3.4 + R() * 2, R() * 2, R() * 4 - 2); s.scale.y = 0.65; cl.add(s); } setPos(cl, Math.cos(a) * r, y0 - 8 + R() * (y1 - y0 + 12), Math.sin(a) * r); g.add(cl); }
      const rb = [0xff5a5a, 0xffa84d, 0xffe14d, 0x7be07b, 0x4da6ff, 0xa07aff]; for (let k = 0; k < 6; k++) { const r = new T.Mesh(new T.TorusGeometry(52 - k * 1.6, 0.9, 5, 40, Math.PI), lm(rb[k], { emissive: rb[k], emissiveIntensity: 0.25, transparent: true, opacity: 0.8 })); setPos(r, 0, y0 - 6, -60, 0); r.rotation.x = 0.2; g.add(r); }
    },
    // mécanismes : engrenages géants et cadran
    6(g, z, R, y0, y1) {
      g.userData.spin = g.userData.spin || [];
      for (let i = 0; i < 8; i++) { const a = R() * TAU, r = 34 + R() * 30, rad = 6 + R() * 8; const gear = new T.Group(); const body = cyl(rad, rad, 1.6, 0xb8913a, 24); body.rotation.x = 1.5708; gear.add(body); const hub = cyl(1.6, 1.6, 2.2, 0x6a4a1a, 10); hub.rotation.x = 1.5708; gear.add(hub); const nt = Math.floor(rad * 2); for (let k = 0; k < nt; k++) { const t = bx(1.8, 1.8, 1.6, 0xb8913a); const aa = (k / nt) * TAU; t.position.set(Math.cos(aa) * (rad + 0.7), Math.sin(aa) * (rad + 0.7), 0); t.rotation.z = aa; gear.add(t); } setPos(gear, Math.cos(a) * r, y0 + R() * (y1 - y0), Math.sin(a) * r, -a + 1.57); g.add(gear); g.userData.spin.push([gear, (i % 2 ? -1 : 1) * (0.08 + R() * 0.18)]); }
      const face = new T.Mesh(new T.CircleGeometry(16, 40), lm(0xf4e8c8, { side: T.DoubleSide })); setPos(face, 0, y0 + (y1 - y0) * 0.5, -70); g.add(face); for (const [l, w] of [[12, 0.4], [8, 0.6]]) { const h = bx(w, l, 0.4, 0x2a1a0a); h.position.set(0, y0 + (y1 - y0) * 0.5 + l / 2 - 1, -69.5); h.geometry.translate(0, 0, 0); g.add(h); g.userData.hands = (g.userData.hands || []).concat([h]); }
    },
    // monde à l'envers : îles flottantes, cristaux, anneaux
    7(g, z, R, y0, y1) {
      for (let i = 0; i < 10; i++) { const a = R() * TAU, r = 30 + R() * 36, s = 4 + R() * 7; const isl = new T.Group(); const top = cyl(s, s * 0.9, 1.2, 0x5aa85a, 12); const under = new T.Mesh(new T.ConeGeometry(s * 0.9, s * 1.5, 10), lm(0x6a4a3a)); under.rotation.x = Math.PI; under.position.y = -s * 0.8 - 0.6; isl.add(top); isl.add(under); if (R() < 0.7) { const tr = cyl(0.3, 0.3, 3, 0x6a4a3a, 5); tr.position.y = 2; isl.add(tr); const lf = sph(1.6, 0x7be07b, null, 8, 6); lf.position.y = 4; isl.add(lf); } isl.rotation.x = Math.PI * (R() < 0.35 ? 1 : 0); setPos(isl, Math.cos(a) * r, y0 + R() * (y1 - y0), Math.sin(a) * r); g.add(isl); }
      for (let i = 0; i < 12; i++) { const a = R() * TAU, r = 26 + R() * 40; const c = new T.Mesh(new T.OctahedronGeometry(1.5 + R() * 3, 0), lm([0x7a4af0, 0x5af0ff, 0xff7ae0][i % 3], { emissive: [0x3a1a90, 0x1a7a90, 0x902a70][i % 3] })); c.scale.y = 1.8; setPos(c, Math.cos(a) * r, y0 + R() * (y1 - y0), Math.sin(a) * r); c.rotation.set(R(), R(), R()); g.add(c); g.userData.floaters = (g.userData.floaters || []).concat([c]); }
      for (let i = 0; i < 3; i++) { const t = new T.Mesh(new T.TorusGeometry(12 + i * 3, 0.35, 6, 40), lm(0x5af0ff, { emissive: 0x2ab0c0, transparent: true, opacity: 0.8 })); setPos(t, 0, y0 + (y1 - y0) * (0.2 + i * 0.3), 0); t.rotation.x = 1.2 + i * 0.3; t.rotation.y = i; t.scale.set(4, 4, 4); g.add(t); }
    },
  };

  // texte flottant
  function label(text, color, scale) {
    const c = document.createElement("canvas"); c.width = 512; c.height = 128; const g = c.getContext("2d"); g.font = "700 64px 'Lilita One', Fredoka, Arial, sans-serif"; g.textAlign = "center"; g.textBaseline = "middle"; g.lineWidth = 12; g.strokeStyle = "rgba(20,10,40,0.85)"; g.strokeText(text, 256, 66); g.fillStyle = color || "#fff"; g.fillText(text, 256, 66);
    const t = new T.CanvasTexture(c); const s = new T.Sprite(new T.SpriteMaterial({ map: t, transparent: true, depthWrite: false, fog: false })); s.scale.set(8 * (scale || 1), 2 * (scale || 1), 1); s.renderOrder = 15; return s;
  }

  // ---------- la vue du parcours ----------
  class CourseView {
    constructor(scene, C, quality) {
      this.scene = scene; this.C = C; this.q = quality || "high"; this.root = new T.Group(); scene.add(this.root); this.dyn = { mov: [], cru: [], spr: [], sw: [], flags: {} }; this.decor = []; this.t = 0;
      const R = (() => { let a = 777; return () => { a = (a * 1664525 + 1013904223) >>> 0; return a / 4294967296; }; })();
      // boîtes statiques regroupées par monde
      const byZone = {};
      C.boxes.forEach((b) => { if (b.mv || b.k === "crumble" || b.k === "spring") return; const key = b.zone + (b.k === "ice" ? "i" : ""); (byZone[key] = byZone[key] || []).push(b); });
      Object.keys(byZone).forEach((key) => {
        const list = byZone[key]; const zi = parseInt(key, 10); const theme = C.zones[zi].id; const M = mats(zi, theme); const ice = /i$/.test(key); const m = ice ? M.ice : M;
        const top = new T.Mesh(mergeBoxes(list, "top", 3.2), m.top), side = new T.Mesh(mergeBoxes(list, "side", 3.2), m.side);
        [top, side].forEach((o) => { o.castShadow = true; o.receiveShadow = true; this.root.add(o); });
      });
      // éléments qui bougent, s'effritent ou rebondissent
      C.boxes.forEach((b) => {
        const theme = C.zones[b.zone].id; const M = mats(b.zone, theme); const w = b.x1 - b.x0, h = b.y1 - b.y0, d = b.z1 - b.z0;
        if (b.k === "spring") { const g = new T.Group(); const base = cyl(0.8, 0.9, 0.14, 0xe8453c, 18); base.position.y = 0.07; const coil = cyl(0.5, 0.5, 0.1, 0xffffff, 16); coil.position.y = 0.18; const cap = cyl(0.62, 0.62, 0.08, 0xffd23d, 18, { emissive: 0x553b00 }); cap.position.y = 0.24; g.add(base, coil, cap); g.position.set((b.x0 + b.x1) / 2, b.y0, (b.z0 + b.z1) / 2); g.userData = { cap, coil, t: 9, b }; this.root.add(g); this.dyn.spr.push(g); return; }
        if (!b.mv && b.k !== "crumble") return;
        const kind = b.k === "crumble" ? M.crumble : M.mover; const mesh = new T.Mesh(new T.BoxGeometry(w, h, d), [kind.side, kind.side, kind.top, kind.side, kind.side, kind.side]); mesh.castShadow = true; mesh.receiveShadow = true; mesh.position.set((b.x0 + b.x1) / 2, (b.y0 + b.y1) / 2, (b.z0 + b.z1) / 2); this.root.add(mesh);
        if (b.mv) this.dyn.mov.push({ b, mesh, c: mesh.position.clone() }); else this.dyn.cru.push({ b, mesh, c: mesh.position.clone() });
      });
      // barres tournantes
      (C.sweeps || []).forEach((s) => { const g = new T.Group(); const bar = new T.Mesh(new T.BoxGeometry(s.len * 2, 0.5, s.th * 2), lam({ map: barTex() })); bar.position.y = 0.3; bar.castShadow = true; const hub = cyl(0.45, 0.55, 0.7, 0xffd23d, 12); hub.position.y = 0.35; g.add(bar, hub); g.position.set(s.x, s.y, s.z); g.userData = { s, bar }; this.root.add(g); this.dyn.sw.push(g); const map = bar.material.map; map.repeat.set(s.len * 1.2, 1); });
      // drapeaux, repères de zone et sommet
      const flag = (b, color) => { const g = new T.Group(); const pole = cyl(0.05, 0.05, 3, 0xdddddd, 5); pole.position.y = 1.5; const cloth = new T.Mesh(new T.PlaneGeometry(1.3, 0.8), new T.MeshBasicMaterial({ color, side: T.DoubleSide })); cloth.position.set(0.7, 2.6, 0); g.add(pole, cloth); g.position.set(((b.x0 + b.x1) / 2) + (b.x1 - b.x0) * 0.3, b.y1, ((b.z0 + b.z1) / 2) + (b.z1 - b.z0) * 0.3); g.userData = { cloth }; this.root.add(g); return g; };
      (C.cps || []).forEach((bi) => { this.dyn.flags[bi] = flag(C.boxes[bi], 0x4ad068); });
      C.zones.forEach((z, zi) => { const b = C.boxes[z.rest]; if (!b) return; const lab = label(z.name, "#ffffff"); lab.position.set((b.x0 + b.x1) / 2, b.y1 + 5.5, (b.z0 + b.z1) / 2); this.root.add(lab); const th = THEMES[z.id]; const disc = new T.Mesh(new T.CircleGeometry(2.6, 28), new T.MeshBasicMaterial({ color: th.accent, transparent: true, opacity: 0.55, depthWrite: false })); disc.rotation.x = -Math.PI / 2; disc.position.set((b.x0 + b.x1) / 2, b.y1 + 0.03, (b.z0 + b.z1) / 2); this.root.add(disc); });
      const sb = C.boxes[C.summit]; const sg = new T.Group(); const pole = cyl(0.14, 0.14, 8, 0xffffff, 8); pole.position.y = 4; const fl = new T.Mesh(new T.PlaneGeometry(3.4, 2), new T.MeshBasicMaterial({ color: 0xffd23d, side: T.DoubleSide })); fl.position.set(1.8, 7, 0); const beam = new T.Mesh(new T.CylinderGeometry(1.4, 1.4, 120, 16, 1, true), new T.MeshBasicMaterial({ color: 0xffe9a0, transparent: true, opacity: 0.18, depthWrite: false, side: T.DoubleSide, blending: T.AdditiveBlending, fog: false })); beam.position.y = 60; sg.add(pole, fl, beam); sg.position.set((sb.x0 + sb.x1) / 2, sb.y1, (sb.z0 + sb.z1) / 2); this.root.add(sg); this.summitFlag = fl; const sl = label("Sommet", "#ffe14d", 1.6); sl.position.set(sg.position.x, sb.y1 + 10.5, sg.position.z); this.root.add(sl);
      const st = C.boxes[C.startBox]; const dep = label("Départ", "#9be3ff", 1.2); dep.position.set((st.x0 + st.x1) / 2, st.y1 + 4.6, (st.z0 + st.z1) / 2); this.root.add(dep);
      // noyau central par monde et décor lointain
      C.zones.forEach((z, zi) => {
        const th = THEMES[z.id]; const y0 = z.y0 - 2, y1 = (zi + 1 < C.zones.length ? C.zones[zi + 1].y0 : z.y1) + 1; const core = bx(2 * (C.half - 5), y1 - y0, 2 * (C.half - 5), th.side[0]); core.material = lam({ map: sideTex(th.side[0], th.side[1]) }); core.material.map = core.material.map.clone(); core.material.map.needsUpdate = true; core.material.map.repeat.set(4, (y1 - y0) / 6); core.position.set(0, (y0 + y1) / 2, 0); this.root.add(core);
        const g = new T.Group(); const rr = (() => { let a = (zi + 3) * 99991; return () => { a = (a * 1664525 + 1013904223) >>> 0; return a / 4294967296; }; })(); DECOR[z.id](g, zi, rr, z.y0, y1); this.root.add(g); this.decor.push({ g, z, id: z.id });
      });
      // étoiles pour les mondes de nuit
      const sp = new Float32Array(600 * 3); for (let i = 0; i < 600; i++) { const a = R() * TAU, b = R() * Math.PI - Math.PI / 2, r = 250; sp[i * 3] = Math.cos(a) * Math.cos(b) * r; sp[i * 3 + 1] = Math.sin(b) * r + 60; sp[i * 3 + 2] = Math.sin(a) * Math.cos(b) * r; } const sgm = new T.BufferGeometry(); sgm.setAttribute("position", new T.BufferAttribute(sp, 3)); this.stars = new T.Points(sgm, new T.PointsMaterial({ color: 0xffffff, size: 1.6, sizeAttenuation: false, transparent: true, opacity: 0, fog: false, depthWrite: false })); scene.add(this.stars);
      // ciel et lumières
      this.sky = new T.Mesh(new T.SphereGeometry(300, 20, 12), new T.ShaderMaterial({ side: T.BackSide, depthWrite: false, fog: false, uniforms: { top: { value: C3(0x5aa7e6) }, bot: { value: C3(0xcfe6f5) } }, vertexShader: "varying float h; void main(){ vec4 p=modelViewMatrix*vec4(position,1.0); h=normalize(position).y; gl_Position=projectionMatrix*p; }", fragmentShader: "uniform vec3 top; uniform vec3 bot; varying float h; void main(){ float k=smoothstep(-0.15,0.7,h); gl_FragColor=vec4(mix(bot,top,k),1.0); }" })); this.sky.renderOrder = -10; scene.add(this.sky);
      this.hemi = new T.HemisphereLight(0xd8ecff, 0x9a8f80, 0.95); scene.add(this.hemi);
      this.sun = new T.DirectionalLight(0xfff1d0, 0.9); this.sun.position.set(30, 60, 20); scene.add(this.sun); scene.add(this.sun.target);
      if (this.q !== "low") { this.sun.castShadow = true; const m = this.q === "high" ? 2048 : 1024; this.sun.shadow.mapSize.set(m, m); const c = this.sun.shadow.camera; c.left = -22; c.right = 22; c.top = 22; c.bottom = -22; c.near = 5; c.far = 140; this.sun.shadow.bias = -0.0006; }
      scene.fog = new T.Fog(0xcfe6f5, 40, 190); this.cur = { top: C3(0x5aa7e6), bot: C3(0xcfe6f5), hem: C3(0xd8ecff), grd: C3(0x9a8f80), sun: C3(0xfff1d0), stars: 0 };
      this.setAltitude(0, 1);
    }
    // palette selon l'altitude, avec un fondu à l'entrée de chaque monde
    setAltitude(y, dt) {
      const C = this.C; let zi = 0; for (let i = 0; i < C.zones.length; i++) if (y >= C.zones[i].y0 - 3) zi = i; const z = C.zones[zi]; const th = THEMES[z.id];
      let top = C3(th.sky[0]), bot = C3(th.sky[1]), hem = C3(th.hemi[0]), grd = C3(th.hemi[1]), sun = C3(th.sun), stars = z.id === 7 ? 1 : z.id === 5 || z.id === 6 ? 0.0 : 0;
      if (zi > 0) { const pz = THEMES[C.zones[zi - 1].id]; const k = Math.max(0, Math.min(1, (y - (z.y0 - 3)) / 12)); if (k < 1) { top = C3(pz.sky[0]).lerp(top, k); bot = C3(pz.sky[1]).lerp(bot, k); hem = C3(pz.hemi[0]).lerp(hem, k); grd = C3(pz.hemi[1]).lerp(grd, k); sun = C3(pz.sun).lerp(sun, k); if (C.zones[zi - 1].id === 7) stars = 1 - k; else if (z.id === 7) stars = k; } }
      const f = Math.min(1, (dt || 0.016) * 3); const c = this.cur; c.top.lerp(top, f); c.bot.lerp(bot, f); c.hem.lerp(hem, f); c.grd.lerp(grd, f); c.sun.lerp(sun, f); c.stars += (stars - c.stars) * f;
      this.sky.material.uniforms.top.value.copy(c.top); this.sky.material.uniforms.bot.value.copy(c.bot); this.scene.fog.color.copy(c.bot); this.hemi.color.copy(c.hem); this.hemi.groundColor.copy(c.grd); this.sun.color.copy(c.sun); this.stars.material.opacity = c.stars; this.zone = zi;
    }
    flagDone(bi) { const f = this.dyn.flags[bi]; if (f) f.userData.cloth.material.color.set(0xffd23d); }
    squash(i) { const g = this.dyn.spr.find((s) => s.userData.b.i === i); if (g) g.userData.t = 0; }
    // follow : position du joueur pour la lumière et le ciel
    update(t, cr, dt, focus, camPos) {
      this.t = t; const D = this.dyn;
      for (const m of D.mov) { const mv = m.b.mv; const o = mv.amp * Math.sin(((t / mv.per) + mv.ph) * TAU); m.mesh.position.set(m.c.x + (mv.ax === "x" ? o : 0), m.c.y + (mv.ax === "y" ? o : 0), m.c.z + (mv.ax === "z" ? o : 0)); }
      for (const c of D.cru) {
        const e = cr && cr[c.b.i]; let off = 0, vis = true, sh = 0;
        if (e) { const tt = t - e.t0; if (tt < c.b.cr.delay) { sh = (tt / c.b.cr.delay); } else if (tt < c.b.cr.delay + c.b.cr.back) { const f = tt - c.b.cr.delay; off = -f * f * 14; vis = f < 0.8; } }
        c.mesh.visible = vis; c.mesh.position.set(c.c.x + (sh ? Math.sin(t * 60) * 0.05 * sh : 0), c.c.y + off, c.c.z + (sh ? Math.cos(t * 55) * 0.05 * sh : 0)); c.mesh.rotation.z = off ? off * 0.02 : 0;
        const mat = c.mesh.material[2]; if (mat && mat.color) mat.color.setRGB(1, 1 - sh * 0.35, 1 - sh * 0.5);
      }
      for (const s of D.sw) { s.rotation.y = -(s.userData.s.w * t + s.userData.s.ph); }
      for (const g of D.spr) { const u = g.userData; u.t += dt; const k = Math.max(0, 1 - u.t / 0.35); const sq = 1 - 0.55 * k * Math.sin(u.t * 30 + 1); u.cap.scale.y = Math.max(0.3, sq); u.cap.position.y = 0.24 + (1 - sq) * -0.06 + (u.t < 0.35 ? 0.18 * Math.sin(u.t * 9) : 0); u.coil.scale.y = u.t < 0.35 ? 1 + 3 * Math.sin(u.t * 9) : 1; }
      for (const d of this.decor) { const g = d.g; if (g.userData.spin) g.userData.spin.forEach(([o, w]) => { o.rotation.z += w * dt; }); if (g.userData.wheel) { g.userData.wheel.rotation.z += dt * 0.12; g.userData.wheel.children.forEach((c) => { if (c.userData.gond) c.rotation.z = -g.userData.wheel.rotation.z; }); } if (g.userData.floaters) g.userData.floaters.forEach((o, i) => { o.rotation.y += dt * 0.3; o.position.y += Math.sin(t * 0.7 + i) * dt * 0.4; }); if (g.userData.hands) { g.userData.hands.forEach((h, i) => { h.rotation.z = -(t * (i ? 0.02 : 0.2)); }); } }
      if (this.summitFlag) this.summitFlag.rotation.y = Math.sin(t * 2) * 0.4;
      if (focus) { this.sun.position.set(focus.x + 28, focus.y + 55, focus.z + 18); this.sun.target.position.set(focus.x, focus.y, focus.z); this.sun.target.updateMatrixWorld(); this.sky.position.copy(camPos || focus); this.stars.position.copy(camPos || focus); }
    }
    dispose() { this.scene.remove(this.root); this.root.traverse((o) => { if (o.geometry) o.geometry.dispose(); }); [this.sky, this.hemi, this.sun, this.sun.target, this.stars].forEach((o) => this.scene.remove(o)); this.scene.fog = null; }
  }
  api.CourseView = CourseView; api.label = label;
})();

// ============================================================
// PAGAILLE PARTY — Moteur 3D (client)
// Le serveur décrit chaque scène avec des formes simples (cases, cylindres, pions, voitures...) dans un monde à plat
// avec une hauteur z. Ce fichier les transforme en vraie scène three.js avec lumières, ombres, particules et caméra.
// Un seul rendu sert tous les jeux, il est vidé et réutilisé à chaque mini-jeu.
// Repère du serveur. x vers la droite, y vers le spectateur, z vers le haut. Une unité vaut 1/40 d'unité three.js.
// ============================================================
(function () {
  const T = window.THREE;
  if (!T) { window.Pg3D = { supported: false }; return; }
  const S = 1 / 40;
  const COLORS = ["#ef4b4b", "#3b82f6", "#34c36c", "#f5c518", "#9b5de5", "#ff8a1f", "#ff6fb5", "#1fc8c0"];
  const hexOf = (k) => COLORS[(k || 0) % COLORS.length];
  const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
  const lerp = (a, b, k) => a + (b - a) * k;
  const angLerp = (a, b, k) => { let d = b - a; while (d > Math.PI) d -= Math.PI * 2; while (d < -Math.PI) d += Math.PI * 2; return a + d * k; };

  const R = { ready: false, entries: {}, stat: [], dyn: {}, meId: null, t: 0, quality: "high", fxSeen: 0, shake: 0, flash: 0, env: null, cam: null, camCur: null, camMode: "", info: { calls: 0 } };
  const cache = { geo: {}, mat: {}, tex: {} };

  // ---------- ressources partagées ----------
  const G = {};
  function geos() {
    if (G.box) return;
    G.box = new T.BoxGeometry(1, 1, 1); G.cyl = new T.CylinderGeometry(1, 1, 1, 24); G.cyl8 = new T.CylinderGeometry(1, 1, 1, 8); G.sph = new T.SphereGeometry(1, 20, 14); G.sphLow = new T.SphereGeometry(1, 10, 8);
    G.cone = new T.ConeGeometry(1, 1, 16); G.ring = new T.RingGeometry(0.88, 1, 40); G.disc = new T.CircleGeometry(1, 28); G.plane = new T.PlaneGeometry(1, 1); G.dodeca = new T.DodecahedronGeometry(1, 0);
    G.wheel = new T.CylinderGeometry(1, 1, 1, 14); G.wheel.rotateX(Math.PI / 2); G.torus = new T.TorusGeometry(1, 0.12, 8, 28); G.oct = new T.OctahedronGeometry(1, 0);
    Object.keys(G).forEach((k) => { G[k].userData = { shared: true }; });
  }
  function mat(m, c, a) {
    const key = (m || "") + "|" + (c || "") + "|" + (a == null ? 1 : Math.round(a * 10) / 10);
    if (cache.mat[key]) return cache.mat[key];
    const col = new T.Color(c || "#8899aa"); const op = a == null ? 1 : a; let mm;
    switch (m) {
      case "ice": mm = new T.MeshPhongMaterial({ color: col, shininess: 90, specular: 0x99ccff, emissive: new T.Color("#4a86b8").multiplyScalar(0.18) }); break;
      case "glass": mm = new T.MeshPhongMaterial({ color: col, shininess: 120, specular: 0xffffff, transparent: true, opacity: 0.38 * op, depthWrite: false }); break;
      case "metal": mm = new T.MeshPhongMaterial({ color: col, shininess: 70, specular: 0x888888 }); break;
      case "lava": mm = new T.MeshLambertMaterial({ color: col, emissive: new T.Color("#ff4a14"), map: noiseTex("lava") }); break;
      case "water": mm = new T.MeshPhongMaterial({ color: col, shininess: 60, specular: 0x99ccff, transparent: true, opacity: 0.92 * op, map: noiseTex("water") }); break;
      case "neon": mm = new T.MeshBasicMaterial({ color: col, transparent: op < 1, opacity: op }); break;
      case "glow": mm = new T.MeshBasicMaterial({ color: col, transparent: true, opacity: 0.55 * op, blending: T.AdditiveBlending, depthWrite: false }); break;
      case "ghost": mm = new T.MeshLambertMaterial({ color: col, transparent: true, opacity: 0.5 * op, depthWrite: false }); break;
      default: mm = new T.MeshLambertMaterial({ color: col, transparent: op < 1, opacity: op });
    }
    mm.userData = { cached: true, kind: m || "" }; cache.mat[key] = mm; return mm;
  }
  // texture de dalle partagée, un liseré plus sombre sur les bords et un éclat doux au centre, pour que chaque bloc ait du relief
  function tileTex() {
    if (cache.tex.tile) return cache.tex.tile; const cv = document.createElement("canvas"); cv.width = cv.height = 64; const x = cv.getContext("2d");
    x.fillStyle = "#fff"; x.fillRect(0, 0, 64, 64); const g = x.createLinearGradient(0, 0, 0, 64); g.addColorStop(0, "rgba(255,255,255,.0)"); g.addColorStop(1, "rgba(0,0,40,.10)"); x.fillStyle = g; x.fillRect(0, 0, 64, 64);
    x.fillStyle = "rgba(0,0,30,.20)"; x.fillRect(0, 0, 64, 3); x.fillRect(0, 61, 64, 3); x.fillRect(0, 0, 3, 64); x.fillRect(61, 0, 3, 64);
    x.fillStyle = "rgba(255,255,255,.35)"; x.fillRect(3, 3, 58, 2); x.fillRect(3, 3, 2, 58);
    for (let i = 0; i < 40; i++) { x.fillStyle = "rgba(0,0,40," + (Math.random() * 0.05).toFixed(3) + ")"; x.fillRect(6 + Math.random() * 50, 6 + Math.random() * 50, 2 + Math.random() * 5, 2 + Math.random() * 5); }
    const tx = new T.CanvasTexture(cv); tx.anisotropy = 4; cache.tex.tile = tx; return tx;
  }
  function matB(it) {
    if (it.m || Math.max(it.w || 0, it.d || 0, it.h || 0, (it.r || 0) * 2) > 270) return mat(it.m, pc(it), it.a); const key = "tile|" + pc(it) + "|" + (it.a == null ? 1 : Math.round(it.a * 10) / 10); if (cache.mat[key]) return cache.mat[key];
    const op = it.a == null ? 1 : it.a; const mm = new T.MeshLambertMaterial({ color: new T.Color(pc(it)), map: tileTex(), transparent: op < 1, opacity: op }); mm.userData = { cached: true, kind: "tile" }; cache.mat[key] = mm; return mm;
  }
  function noiseTex(kind) {
    if (cache.tex["n" + kind]) return cache.tex["n" + kind];
    const cv = document.createElement("canvas"); cv.width = cv.height = 128; const x = cv.getContext("2d");
    const base = kind === "lava" ? "#ff7a1a" : "#7ec8ff"; x.fillStyle = base; x.fillRect(0, 0, 128, 128);
    for (let i = 0; i < 70; i++) { const px = Math.random() * 128, py = Math.random() * 128, r = 6 + Math.random() * 22; const g = x.createRadialGradient(px, py, 0, px, py, r); g.addColorStop(0, kind === "lava" ? "rgba(255,230,90,.75)" : "rgba(255,255,255,.35)"); g.addColorStop(1, "rgba(0,0,0,0)"); x.fillStyle = g; for (let ox = -128; ox <= 128; ox += 128) for (let oy = -128; oy <= 128; oy += 128) { x.save(); x.translate(ox, oy); x.fillStyle = g; x.beginPath(); x.arc(px, py, r, 0, 7); x.fill(); x.restore(); } }
    if (kind === "lava") for (let i = 0; i < 26; i++) { const px = Math.random() * 128, py = Math.random() * 128; x.fillStyle = "rgba(90,20,0,.55)"; x.beginPath(); x.arc(px, py, 3 + Math.random() * 9, 0, 7); x.fill(); }
    const tx = new T.CanvasTexture(cv); tx.wrapS = tx.wrapT = T.RepeatWrapping; tx.repeat.set(6, 6); cache.tex["n" + kind] = tx; return tx;
  }
  function textTex(text, color, size, bold, stroke) {
    const key = "t|" + text + "|" + color + "|" + size + "|" + (stroke || "");
    if (cache.tex[key]) return cache.tex[key];
    if (Object.keys(cache.tex).length > 260) { Object.keys(cache.tex).forEach((k) => { if (k.charAt(0) === "t") { cache.tex[k].dispose(); delete cache.tex[k]; } }); }
    const cv = document.createElement("canvas"); const x = cv.getContext("2d"); const f = (bold ? "700 " : "500 ") + size + "px Fredoka, 'Trebuchet MS', system-ui, sans-serif";
    x.font = f; const w = Math.ceil(x.measureText(text).width) + 24; cv.width = Math.max(32, w); cv.height = Math.ceil(size * 1.5);
    x.font = f; x.textAlign = "center"; x.textBaseline = "middle"; x.lineJoin = "round"; x.lineWidth = Math.max(4, size / 6); x.strokeStyle = stroke || "rgba(10,5,30,.85)"; x.strokeText(text, cv.width / 2, cv.height / 2 + 1); x.fillStyle = color || "#fff"; x.fillText(text, cv.width / 2, cv.height / 2 + 1);
    const tx = new T.CanvasTexture(cv); tx.minFilter = T.LinearFilter; tx.generateMipmaps = false; tx.userData = { ratio: cv.width / cv.height }; cache.tex[key] = tx; return tx;
  }
  function spriteOf(text, color, h, size, stroke) {
    const tx = textTex(text, color, size || 48, true, stroke); const sm = new T.SpriteMaterial({ map: tx, transparent: true, depthTest: false, depthWrite: false });
    const sp = new T.Sprite(sm); sp.scale.set(h * tx.userData.ratio, h, 1); sp.renderOrder = 20; sp.userData.own = true; return sp;
  }
  function setSprite(sp, text, color, h, size) { const tx = textTex(text, color, size || 48, true); if (sp.material.map !== tx) { sp.material.map = tx; sp.material.needsUpdate = true; } sp.scale.set(h * tx.userData.ratio, h, 1); }
  function blobTex() {
    if (cache.tex.blob) return cache.tex.blob; const cv = document.createElement("canvas"); cv.width = cv.height = 64; const x = cv.getContext("2d"); const g = x.createRadialGradient(32, 32, 2, 32, 32, 31); g.addColorStop(0, "rgba(0,0,0,.55)"); g.addColorStop(1, "rgba(0,0,0,0)"); x.fillStyle = g; x.fillRect(0, 0, 64, 64);
    const tx = new T.CanvasTexture(cv); cache.tex.blob = tx; return tx;
  }
  function dotTex() {
    if (cache.tex.dot) return cache.tex.dot; const cv = document.createElement("canvas"); cv.width = cv.height = 64; const x = cv.getContext("2d"); const g = x.createRadialGradient(32, 32, 0, 32, 32, 31); g.addColorStop(0, "rgba(255,255,255,1)"); g.addColorStop(0.45, "rgba(255,255,255,.7)"); g.addColorStop(1, "rgba(255,255,255,0)"); x.fillStyle = g; x.fillRect(0, 0, 64, 64);
    const tx = new T.CanvasTexture(cv); cache.tex.dot = tx; return tx;
  }

  // ---------- initialisation ----------
  R.supported = true;
  R.init = function (host) {
    if (R.ready) return true; geos();
    try {
      const canvas = document.createElement("canvas"); canvas.id = "pg-gl"; canvas.style.cssText = "position:absolute;left:0;top:0;width:100%;height:100%;display:block;touch-action:none";
      host.insertBefore(canvas, host.firstChild); R.canvas = canvas; R.host = host;
      const GLk = window.PicuiteGL;
      R.renderer = GLk ? GLk.create(T, canvas, R.quality === "low" ? "low" : "high") : new T.WebGLRenderer({ canvas, antialias: true, alpha: true });
      R.renderer.setClearColor(0x000000, 0);
      R.scene = new T.Scene(); R.camera = new T.PerspectiveCamera(38, 1, 0.1, 400);
      R.hemi = new T.HemisphereLight(0xcfe8ff, 0x4a3a60, 0.95); R.scene.add(R.hemi);
      R.sun = new T.DirectionalLight(0xfff3d6, 0.85); R.sun.position.set(-6, 14, 9); R.scene.add(R.sun); R.scene.add(R.sun.target);
      R.flashLight = new T.PointLight(0xffa850, 0, 18, 2); R.scene.add(R.flashLight);
      R.root = new T.Group(); R.scene.add(R.root); R.statG = new T.Group(); R.dynG = new T.Group(); R.root.add(R.statG); R.root.add(R.dynG);
      R.fxG = new T.Group(); R.scene.add(R.fxG); initFx();
      if (GLk && GLk.watch) GLk.watch(canvas, () => { R.dirty = true; });
      applyQuality(); try { initMotes(); } catch (e) { /* tant pis */ } R.ready = true; R.resize(); return true;
    } catch (e) { console.error("3D indisponible", e); R.failed = true; return false; }
  };
  function applyQuality() {
    if (!R.renderer) return; const hi = R.quality !== "low";
    const dpr = Math.min(window.devicePixelRatio || 1, hi ? 1.75 : 1); R.renderer.setPixelRatio(dpr);
    try { R.renderer.shadowMap.enabled = hi; R.renderer.shadowMap.type = T.PCFSoftShadowMap; } catch (e) { /* mode compatibilité */ }
    R.sun.castShadow = hi; if (hi) { R.sun.shadow.mapSize.set(1536, 1536); R.sun.shadow.bias = -0.0004; R.sun.shadow.normalBias = 0.02; }
    R.scene.traverse((o) => { if (o.material) { const ms = Array.isArray(o.material) ? o.material : [o.material]; ms.forEach((m) => { m.needsUpdate = true; }); } });
  }
  R.setQuality = function (q) { R.quality = q === "low" ? "low" : "high"; applyQuality(); };
  R.resize = function () {
    if (!R.ready) return; const w = R.host.clientWidth || 800, h = R.host.clientHeight || 600; R.w = w; R.h = h;
    R.renderer.setSize(w, h, false); R.camera.aspect = w / h; R.camera.updateProjectionMatrix();
  };

  // ---------- environnement ----------
  function setEnv(env) {
    env = env || {}; R.env = env; const sky = env.sky || ["#7ec8ff", "#d6f0ff"]; const GLk = window.PicuiteGL;
    if (GLk && GLk.sky) GLk.sky(R.scene, R.host, sky[0], sky[1], T); else R.host.style.background = "linear-gradient(180deg," + sky[0] + "," + sky[1] + ")";
    const fogc = new T.Color(env.fog || sky[1]); R.scene.fog = new T.Fog(fogc, env.fogN || 30, env.fogF || 120);
    const lt = env.lt || {}; R.hemi.color.set((lt.h && lt.h[0]) || "#cfe8ff"); R.hemi.groundColor.set((lt.h && lt.h[1]) || "#4a3a60"); R.hemi.intensity = lt.hi == null ? 0.95 : lt.hi;
    R.sun.color.set(lt.d || "#fff3d6"); R.sun.intensity = lt.di == null ? 0.85 : lt.di;
    R.sunDir = lt.dir || [-0.5, 1.0, 0.65];
  }
  function fitSun(w, h) {
    const cx = w * S / 2, cz = h * S / 2, rad = Math.max(w, h) * S * 0.75 + 3; const d = R.sunDir || [-0.5, 1, 0.65];
    R.sun.target.position.set(cx, 0, cz); R.sun.position.set(cx + d[0] * rad * 1.3, d[1] * rad * 1.3, cz + d[2] * rad * 1.3);
    const c = R.sun.shadow.camera; c.left = -rad; c.right = rad; c.top = rad; c.bottom = -rad; c.near = 0.5; c.far = rad * 5; c.updateProjectionMatrix();
  }

  // ---------- constructeurs d'éléments ----------
  const pc = (it) => (it.c || (it.k != null ? hexOf(it.k) : "#8899aa"));
  function place(o, it, lift) { o.position.set(it.x * S, ((it.z || 0) + (lift || 0)) * S, it.y * S); }
  function shadowOn(o, cast, recv) { o.castShadow = !!cast; o.receiveShadow = !!recv; }

  const B = {};
  B.box = function (it) {
    const m = new T.Mesh(G.box, matB(it)); shadowOn(m, !it.ns && it.m !== "glass", true); m.userData.kind = "box"; return m;
  };
  B.cyl = function (it) { const g = it.r2 != null ? new T.CylinderGeometry(it.r2 || 0.01, 1, 1, it.seg || 24) : (it.seg === 8 ? G.cyl8 : G.cyl); const m = new T.Mesh(g, matB(it)); shadowOn(m, !it.ns, true); m.userData.kind = "cyl"; return m; };
  B.sph = function (it) { const m = new T.Mesh(G.sph, mat(it.m, pc(it), it.a)); shadowOn(m, !it.ns, false); m.userData.kind = "sph"; return m; };
  B.ring = function (it) { const m = new T.Mesh(G.ring, new T.MeshBasicMaterial({ color: pc(it), transparent: true, opacity: it.a == null ? 0.9 : it.a, side: T.DoubleSide, depthWrite: false })); m.rotation.x = -Math.PI / 2; m.userData.own = true; m.userData.kind = "ring"; m.renderOrder = 3; return m; };
  B.disc = function (it) { const m = new T.Mesh(G.disc, new T.MeshBasicMaterial({ color: pc(it), transparent: true, opacity: it.a == null ? 0.5 : it.a, side: T.DoubleSide, depthWrite: false })); m.rotation.x = -Math.PI / 2; m.userData.own = true; m.userData.kind = "disc"; m.renderOrder = 2; return m; };
  B.text = function (it) { const sp = spriteOf(String(it.v), it.c || "#fff", (it.s || 20) * S, 48); sp.userData.kind = "text"; return sp; };
  B.beam = function (it) { const m = new T.Mesh(G.box, new T.MeshBasicMaterial({ color: pc(it), transparent: true, opacity: it.a == null ? 0.85 : it.a, blending: T.AdditiveBlending, depthWrite: false })); m.userData.own = true; m.userData.kind = "beam"; m.renderOrder = 4; return m; };
  B.arrow = function (it) {
    const g = new T.Group(); const mt = new T.MeshBasicMaterial({ color: pc(it), transparent: true, opacity: 0.92, depthWrite: false });
    const sh = new T.Mesh(G.box, mt); const hd = new T.Mesh(G.cone, mt); hd.rotation.z = -Math.PI / 2; g.add(sh); g.add(hd); g.userData = { kind: "arrow", own: true, sh, hd, mt }; sh.renderOrder = hd.renderOrder = 5; return g;
  };
  B.coin = function (it) {
    const m = new T.Mesh(G.cyl, mat("metal", it.c || "#ffcf33")); m.scale.set(0.5, 0.09, 0.5); m.rotation.x = Math.PI / 2; const g = new T.Group(); g.add(m); shadowOn(m, true, false); g.userData.kind = "coin"; g.userData.inner = m; return g;
  };
  B.flag = function (it) {
    const g = new T.Group(); const pole = new T.Mesh(G.cyl8, mat("", "#e9e9f2")); pole.scale.set(0.05, 1.6, 0.05); pole.position.y = 0.8; const cloth = new T.Mesh(G.box, mat("", pc(it))); cloth.scale.set(0.8, 0.5, 0.05); cloth.position.set(0.42, 1.35, 0);
    g.add(pole); g.add(cloth); shadowOn(pole, true, false); shadowOn(cloth, true, false); g.userData = { kind: "flag", cloth }; return g;
  };
  B.deco = function (it) {
    const g = new T.Group(); const s = (it.s || 1); g.userData = { kind: "deco" }; const k = it.kind;
    const add = (geo, m, x, y, z, sx, sy, sz) => { const o = new T.Mesh(geo, m); o.position.set(x, y, z); o.scale.set(sx, sy, sz); shadowOn(o, true, false); g.add(o); return o; };
    if (k === "tree") { add(G.cyl8, mat("", "#8a5a2b"), 0, 0.55, 0, 0.18, 1.1, 0.18); add(G.sph, mat("", it.c || "#3fa34d"), 0, 1.5, 0, 0.8, 0.75, 0.8); add(G.sph, mat("", it.c || "#4cb85a"), 0.25, 2.05, 0.1, 0.5, 0.5, 0.5); }
    else if (k === "pine") { add(G.cyl8, mat("", "#6b4423"), 0, 0.4, 0, 0.14, 0.8, 0.14); add(G.cone, mat("", it.c || "#2f8a52"), 0, 1.3, 0, 0.7, 1.2, 0.7); add(G.cone, mat("", it.c || "#37a060"), 0, 2.0, 0, 0.5, 1.0, 0.5); }
    else if (k === "rock") { add(G.dodeca, mat("", it.c || "#8d95a3"), 0, 0.4, 0, 0.7, 0.5, 0.6); }
    else if (k === "crystal") { add(G.oct, mat("glass", it.c || "#8fe3ff"), 0, 0.9, 0, 0.35, 0.9, 0.35); add(G.oct, mat("glass", it.c || "#c4a3ff"), 0.4, 0.5, 0.1, 0.22, 0.55, 0.22); }
    else if (k === "lamp") { add(G.cyl8, mat("", "#40424f"), 0, 1.0, 0, 0.07, 2.0, 0.07); add(G.sph, mat("neon", it.c || "#ffe9a0"), 0, 2.1, 0, 0.22, 0.22, 0.22); }
    else if (k === "cloud") { [[0, 0, 0, 1.2], [1.0, -0.1, 0.2, 0.9], [-1.0, -0.15, -0.1, 0.85], [0.4, 0.45, 0, 0.8]].forEach((q) => { add(G.sphLow, mat("neon", "#ffffff", 0.9), q[0], q[1], q[2], q[3], q[3] * 0.75, q[3]); }); g.children.forEach((c) => { c.castShadow = false; }); g.userData.drift = true; }
    else if (k === "banner") { add(G.cyl8, mat("", "#dcdce6"), -1.8, 1.2, 0, 0.1, 2.4, 0.1); add(G.cyl8, mat("", "#dcdce6"), 1.8, 1.2, 0, 0.1, 2.4, 0.1); const b = add(G.box, mat("", it.c || "#ff4d6d"), 0, 2.3, 0, 3.9, 0.55, 0.08); b.userData.noscale = true; }
    g.scale.set(s, s, s); g.userData.rot = it.rot || 0; return g;
  };
  // le pion, un petit personnage rond avec un chapeau différent par couleur
  B.pawn = function (it) {
    const g = new T.Group(); const col = pc(it); const body = new T.Group(); g.add(body);
    const skin = mat("", col); const belly = mat("", "#ffffff", 1);
    const b = new T.Mesh(G.sph, skin); b.scale.set(0.5, 0.56, 0.5); b.position.y = 0.58; shadowOn(b, true, false); body.add(b);
    const bl = new T.Mesh(G.sph, mat("", "#fff7e6")); bl.scale.set(0.34, 0.34, 0.2); bl.position.set(0.3, 0.46, 0); bl.rotation.y = 0; body.add(bl);
    const eyeM = mat("neon", "#ffffff"), pupM = mat("neon", "#1a1226");
    [-0.15, 0.15].forEach((z) => { const e = new T.Mesh(G.sph, eyeM); e.scale.set(0.11, 0.14, 0.11); e.position.set(0.4, 0.74, z); body.add(e); const p = new T.Mesh(G.sph, pupM); p.scale.set(0.06, 0.08, 0.06); p.position.set(0.5, 0.74, z); body.add(p); });
    [-0.22, 0.22].forEach((z) => { const f = new T.Mesh(G.sph, mat("", "#2c2540")); f.scale.set(0.14, 0.09, 0.15); f.position.set(0.04, 0.06, z); body.add(f); g.userData["foot" + (z < 0 ? "L" : "R")] = f; });
    const hat = hatFor(it.k || 0); if (hat) { hat.position.y = 1.07; body.add(hat); }
    g.userData = Object.assign(g.userData, { kind: "pawn", body, skin, hat }); return g;
  };
  function hatFor(k) {
    const g = new T.Group(); const add = (geo, m, x, y, z, sx, sy, sz, rz) => { const o = new T.Mesh(geo, m); o.position.set(x, y, z); o.scale.set(sx, sy, sz); if (rz) o.rotation.z = rz; shadowOn(o, true, false); g.add(o); return o; };
    switch (k % 8) {
      case 0: add(G.cyl, mat("", "#c62828"), 0, -0.02, 0, 0.3, 0.14, 0.3); add(G.box, mat("", "#c62828"), 0.28, -0.07, 0, 0.3, 0.05, 0.3); break; // casquette
      case 1: add(G.cyl8, mat("metal", "#ffd54a"), 0, 0, 0, 0.3, 0.2, 0.3); [0, 1, 2, 3, 4].forEach((i) => { const a = (i / 5) * Math.PI * 2; add(G.cone, mat("metal", "#ffd54a"), Math.cos(a) * 0.24, 0.18, Math.sin(a) * 0.24, 0.07, 0.2, 0.07); }); break; // couronne
      case 2: add(G.cyl8, mat("", "#222"), 0, 0, 0, 0.05, 0.1, 0.05); add(G.box, mat("", "#ff5252"), 0, 0.08, 0, 0.7, 0.03, 0.1); g.userData.spin = true; break; // hélice
      case 3: add(G.cyl8, mat("", "#555"), 0, 0.12, 0, 0.025, 0.28, 0.025); add(G.sph, mat("neon", "#ff5252"), 0, 0.3, 0, 0.07, 0.07, 0.07); break; // antenne
      case 4: add(G.cone, mat("", "#f5f0e0"), 0, 0.08, -0.22, 0.09, 0.28, 0.09, 0.4); add(G.cone, mat("", "#f5f0e0"), 0, 0.08, 0.22, 0.09, 0.28, 0.09, -0.4); break; // cornes
      case 5: add(G.cyl, mat("", "#f4f4f4"), 0, -0.1, 0, 0.5, 0.06, 0.5); break; // bandeau
      case 6: add(G.sph, mat("", "#ff4d8d"), -0.06, 0.0, -0.16, 0.12, 0.12, 0.12); add(G.sph, mat("", "#ff4d8d"), -0.06, 0.0, 0.16, 0.12, 0.12, 0.12); add(G.sph, mat("", "#ff2a6d"), -0.06, 0, 0, 0.07, 0.07, 0.07); break; // noeud
      default: [-0.15, 0, 0.15].forEach((z, i) => add(G.cone, mat("", "#2ad1c9"), 0, 0.08 + (i === 1 ? 0.04 : 0), z, 0.07, 0.3 - (i === 1 ? 0 : 0.06), 0.07)); // crête
    }
    return g;
  }
  B.car = function (it) {
    const g = new T.Group(); const body = new T.Group(); g.add(body); const col = pc(it);
    const add = (p, geo, m, x, y, z, sx, sy, sz) => { const o = new T.Mesh(geo, m); o.position.set(x, y, z); o.scale.set(sx, sy, sz); shadowOn(o, true, false); p.add(o); return o; };
    add(body, G.box, mat("metal", col), 0, 0.3, 0, 1.18, 0.3, 0.66); add(body, G.box, mat("", "#26334d"), -0.05, 0.55, 0, 0.56, 0.2, 0.56); add(body, G.box, mat("metal", col), -0.05, 0.68, 0, 0.66, 0.05, 0.62);
    add(body, G.box, mat("neon", "#fff2b0"), 0.6, 0.32, 0.2, 0.04, 0.09, 0.14); add(body, G.box, mat("neon", "#fff2b0"), 0.6, 0.32, -0.2, 0.04, 0.09, 0.14);
    add(body, G.box, mat("neon", "#ff4a4a"), -0.6, 0.32, 0.2, 0.04, 0.08, 0.12); add(body, G.box, mat("neon", "#ff4a4a"), -0.6, 0.32, -0.2, 0.04, 0.08, 0.12);
    const wheels = []; [[0.38, 0.36], [0.38, -0.36], [-0.38, 0.36], [-0.38, -0.36]].forEach((q) => { const w = add(g, G.wheel, mat("", "#1c1c24"), q[0], 0.17, q[1], 0.17, 0.12, 0.17); wheels.push(w); });
    const flame = add(body, G.cone, mat("glow", "#ff9a2b"), -0.95, 0.3, 0, 0.18, 0.7, 0.18); flame.rotation.z = Math.PI / 2; flame.visible = false;
    const bomb = new T.Group(); const bs = add(bomb, G.sph, mat("", "#1b1b22"), 0, 0, 0, 0.26, 0.26, 0.26); const cap = add(bomb, G.cyl8, mat("metal", "#7b7b88"), 0, 0.25, 0, 0.07, 0.06, 0.07); const spark = add(bomb, G.sph, mat("neon", "#ffd24a"), 0.04, 0.4, 0, 0.07, 0.07, 0.07); bomb.position.set(-0.05, 0.98, 0); bomb.visible = false; body.add(bomb);
    const shield = add(g, G.sph, mat("glow", "#9fe4ff"), 0, 0.4, 0, 0.95, 0.7, 0.95); shield.visible = false; shield.castShadow = false;
    g.userData = { kind: "car", body, wheels, flame, bomb, spark, bs, shield, wr: 0 }; return g;
  };
  B.chest = function (it) {
    const g = new T.Group(); const add = (geo, m, x, y, z, sx, sy, sz) => { const o = new T.Mesh(geo, m); o.position.set(x, y, z); o.scale.set(sx, sy, sz); shadowOn(o, true, true); g.add(o); return o; };
    add(G.box, mat("", it.c || "#a8692a"), 0, 0.25, 0, 1.0, 0.5, 0.7); const lid = add(G.cyl8, mat("", it.c || "#b97a35"), 0, 0.5, 0, 0.35, 1.0, 0.7); lid.rotation.x = Math.PI / 2; lid.scale.set(0.35, 1.0, 0.5); lid.position.y = 0.5; lid.rotation.set(0, 0, Math.PI / 2);
    add(G.box, mat("metal", "#ffd24a"), 0.5, 0.35, 0, 0.04, 0.2, 0.12); g.userData = { kind: "chest" }; return g;
  };

  // ---------- mise à jour d'un élément ----------
  const tmp = { v: new T.Vector3() };
  function applyTransform(en, it, dt, snap) {
    const o = en.obj; const x = it.x * S, y = ((it.z || 0) + (en.lift || 0)) * S, z = it.y * S;
    const cur = en.cur || (en.cur = { x, y, z, ang: it.ang || 0, rot: it.rot || 0, vx: 0, vz: 0 });
    const k = snap ? 1 : 1 - Math.exp(-dt * (it.sm || 20)); const d = Math.hypot(x - cur.x, z - cur.z);
    const kk = d > 8 || Math.abs(y - cur.y) > 8 ? 1 : k; cur.vx = (x - cur.x) / Math.max(dt, 0.001) * kk; cur.vz = (z - cur.z) / Math.max(dt, 0.001) * kk;
    cur.x += (x - cur.x) * kk; cur.y += (y - cur.y) * kk; cur.z += (z - cur.z) * kk;
    if (it.ang != null) cur.ang = angLerp(cur.ang, it.ang, kk); if (it.rot != null) cur.rot = angLerp(cur.rot, it.rot, kk);
    cur.speed = lerp(cur.speed || 0, Math.hypot(cur.vx, cur.vz) / S, 0.25); // en unités du monde par seconde
    o.position.set(cur.x, cur.y, cur.z); return cur;
  }
  const U_ = {};
  U_.box = function (en, it, dt) {
    const o = en.obj; const c = applyTransform(en, it, dt, en.fresh); const h = (it.h == null ? 10 : it.h) * S; o.scale.set((it.w || 10) * S * (it.sx || 1), Math.max(0.001, h * (it.sy == null ? 1 : it.sy)), (it.d || 10) * S * (it.sx || 1));
    o.position.y = c.y + h * (it.sy == null ? 1 : it.sy) / 2; o.rotation.y = -(it.rot || 0);
    const key = (it.m || "") + "|" + pc(it) + "|" + (it.a == null ? 1 : it.a); if (en.mk !== key) { en.mk = key; o.material = matB(it); }
    if (it.lab !== undefined) labelOn(en, it);
    if (it.m === "lava") animSurface(o.material);
  };
  function labelOn(en, it) {
    const o = en.obj; const want = it.lab ? it.lab + "|" + (it.lc || "") : "";
    if (en.lk !== want) {
      en.lk = want; if (en.lp) { o.remove(en.lp); en.lp.material.dispose(); en.lp = null; }
      if (it.lab) { const tx = textTex(String(it.lab), it.lc || "rgba(255,255,255,.9)", 64, true, "rgba(0,0,0,.28)"); const p = new T.Mesh(G.plane, new T.MeshBasicMaterial({ map: tx, transparent: true, depthWrite: false })); p.rotation.x = -Math.PI / 2; p.renderOrder = 3; p.userData.ratio = tx.userData.ratio; o.add(p); en.lp = p; }
    }
    if (en.lp) { const q = Math.min(o.scale.x, o.scale.z) * 0.62; const rt = Math.min(1.7, en.lp.userData.ratio); en.lp.scale.set(q * rt / o.scale.x, q / o.scale.z, 1); en.lp.position.y = 0.5 + 0.012 / Math.max(0.01, o.scale.y); }
  }
  U_.cyl = function (en, it, dt) {
    const o = en.obj; const c = applyTransform(en, it, dt, en.fresh); const h = (it.h == null ? 10 : it.h) * S * (it.sy == null ? 1 : it.sy); const r = (it.r || 10) * S * (it.sx || 1); o.scale.set(r, Math.max(0.001, h), r); o.position.y = c.y + h / 2; o.rotation.y = -(it.rot || 0);
    const key = (it.m || "") + "|" + pc(it) + "|" + (it.a == null ? 1 : it.a); if (en.mk !== key) { en.mk = key; o.material = matB(it); }
    if (it.m === "lava" || it.m === "water") animSurface(o.material);
  };
  U_.sph = function (en, it, dt) { const o = en.obj; const c = applyTransform(en, it, dt, en.fresh); const r = (it.r || 10) * S; o.scale.set(r * (it.sx || 1), r * (it.sy || 1), r * (it.sx || 1)); o.position.y = c.y; const key = (it.m || "") + "|" + pc(it) + "|" + (it.a == null ? 1 : it.a); if (en.mk !== key) { en.mk = key; o.material = mat(it.m, pc(it), it.a); } };
  U_.ring = function (en, it, dt) { const o = en.obj; applyTransform(en, it, dt, en.fresh); o.position.y += 0.03; const r = (it.r || 10) * S; o.scale.set(r, r, 1); o.material.color.set(pc(it)); o.material.opacity = it.a == null ? 0.9 : it.a; };
  U_.disc = function (en, it, dt) { U_.ring(en, it, dt); if (it.a == null) en.obj.material.opacity = 0.5; };
  U_.text = function (en, it, dt) { const o = en.obj; applyTransform(en, it, dt, en.fresh); o.position.y += 0.2; const k = String(it.v) + "|" + (it.c || ""); if (en.tk !== k) { en.tk = k; setSprite(o, String(it.v), it.c || "#fff", (it.s || 20) * S, 48); } if (it.a != null) o.material.opacity = it.a; };
  U_.beam = function (en, it, dt) {
    const o = en.obj; const x1 = it.x * S, y1 = (it.z || 0) * S, z1 = it.y * S, x2 = it.x2 * S, y2 = (it.z2 == null ? it.z || 0 : it.z2) * S, z2 = it.y2 * S;
    const dx = x2 - x1, dy = y2 - y1, dz = z2 - z1; const len = Math.hypot(dx, dy, dz) || 0.001; const w = (it.w || 6) * S; o.position.set((x1 + x2) / 2, (y1 + y2) / 2, (z1 + z2) / 2);
    o.scale.set(w, w, len); o.lookAt(x2, y2, z2); o.material.color.set(pc(it)); o.material.opacity = it.a == null ? 0.85 : it.a;
  };
  U_.arrow = function (en, it, dt) {
    const o = en.obj; const c = applyTransform(en, it, dt, en.fresh); o.position.y = c.y + 0.05; o.rotation.y = -(it.ang || 0); const len = Math.max(0.5, (it.len || 100) * S); const w = (it.w || 10) * S;
    const u = o.userData; u.sh.scale.set(len, 0.04, w * 0.5); u.sh.position.set(len / 2, 0, 0); u.hd.scale.set(w * 1.3, w * 1.3, w * 1.3); u.hd.position.set(len + w * 0.55, 0, 0); u.mt.color.set(pc(it)); u.mt.opacity = it.a == null ? 0.92 : it.a;
  };
  U_.coin = function (en, it, dt) { const o = en.obj; const c = applyTransform(en, it, dt, en.fresh); o.position.y = c.y + 0.35 + Math.sin(R.t * 3 + (it.x || 0)) * 0.07; o.rotation.y = R.t * 2.4 + (it.x || 0); const s = (it.s || 1) * (it.big ? 1.6 : 1); o.scale.set(s, s, s); o.visible = it.vis !== 0; };
  U_.flag = function (en, it, dt) { const o = en.obj; applyTransform(en, it, dt, en.fresh); o.userData.cloth.rotation.y = Math.sin(R.t * 4 + it.x) * 0.2; o.userData.cloth.material = mat("", it.on ? "#4cd964" : pc(it)); };
  U_.deco = function (en, it, dt) {
    const o = en.obj; const s = it.s || 1; o.position.set(it.x * S, (it.z || 0) * S, it.y * S); o.rotation.y = o.userData.rot;
    if (o.userData.drift) { const dr = (R.t * 0.25 + it.x * 0.01) % 1; o.position.x = it.x * S + Math.sin(R.t * 0.1 + it.y) * 3; }
    o.scale.set(s, s, s); o.traverse((m) => { if (m.userData && m.userData.noscale) { /* rien */ } });
  };
  U_.chest = function (en, it, dt) { const o = en.obj; applyTransform(en, it, dt, en.fresh); const s = (it.s || 1) * 0.9; o.scale.set(s, s, s); o.rotation.y = -(it.rot || 0); };
  U_.pawn = function (en, it, dt) {
    const o = en.obj; const u = o.userData; const first = en.fresh; const cur = applyTransform(en, it, dt, first); const sp = cur.speed || 0; const s0 = (it.r || 18) / 18 * 1.55;
    // orientation, vers l'avant du personnage ou dans le sens du déplacement
    let want = it.face; if (want == null && sp > 40) want = Math.atan2(cur.vx, cur.vz) ; // atan2 de x puis z, converti ci-dessous
    if (it.face != null) cur.ang = angLerp(cur.ang == null ? it.face : cur.ang, it.face, 1 - Math.exp(-dt * 16)); else if (sp > 40) { const a = Math.atan2(cur.vz, cur.vx); cur.ang = angLerp(cur.ang || a, a, 1 - Math.exp(-dt * 12)); }
    o.rotation.y = -(cur.ang || 0);
    const body = u.body; const air = !!it.air; const run = clamp(sp / 260, 0, 1); en.ph = (en.ph || 0) + dt * (6 + run * 14);
    let sy = 1, sx = 1; const dead = it.dead, ghost = it.ghost;
    if (air) { sy = 1.12; sx = 0.92; } else if (run > 0.05) { const w = Math.sin(en.ph); sy = 1 + 0.07 * w * run; sx = 1 - 0.05 * w * run; body.position.y = Math.abs(w) * 0.07 * run; } else { sy = 1 + 0.025 * Math.sin(R.t * 3 + (it.x || 0)); body.position.y = 0; }
    if (air) body.position.y = 0.05;
    body.rotation.z = -run * 0.18 + (it.tilt || 0); body.rotation.x = (it.roll || 0);
    if (it.st === "win") { body.position.y = Math.abs(Math.sin(R.t * 8 + (it.x || 0))) * 0.45; sy = 1.1; }
    if (it.st === "hit") { u.skin.emissive.set(0xffffff); } else if (u.skin.emissive.getHex() !== 0) u.skin.emissive.set(0x000000);
    let sc = s0; if (it.sc != null) sc *= it.sc;
    if (dead) { o.rotation.z = dead * 3; sc *= Math.max(0.05, 1 - dead * 0.5); }
    else o.rotation.z = 0;
    o.scale.set(sc * sx, sc * sy, sc * sx); u.footL.position.z = -0.22; u.footL.position.x = 0.04 + Math.sin(en.ph) * 0.16 * run; u.footR.position.x = 0.04 - Math.sin(en.ph) * 0.16 * run; u.footL.position.y = 0.06 + Math.max(0, Math.sin(en.ph)) * 0.1 * run; u.footR.position.y = 0.06 + Math.max(0, -Math.sin(en.ph)) * 0.1 * run;
    if (u.hat && u.hat.userData.spin) u.hat.rotation.y = R.t * 20;
    o.visible = !it.hide; const gh = ghost ? 0.4 : 1; if (en.gh !== gh) { en.gh = gh; u.skin.transparent = ghost; u.skin.opacity = gh; u.skin.needsUpdate = true; }
    // ombre au sol et nom
    shadowBlob(en, it, cur, s0);
    nameTag(en, it, cur, (it.r || 18) / 18, 1.55);
    badgeTag(en, it, cur, 1.95 * s0);
  };
  function shadowBlob(en, it, cur, s) {
    if (!en.blob) { const m = new T.Mesh(G.plane, new T.MeshBasicMaterial({ map: blobTex(), transparent: true, depthWrite: false })); m.rotation.x = -Math.PI / 2; m.userData.own = true; m.renderOrder = 1; R.dynG.add(m); en.blob = m; }
    const gz = (it.gz == null ? it.z || 0 : it.gz) * S; const h = Math.max(0, cur.y - gz); const sz = (it.br || 20) * S * 2.8 * (1 - Math.min(0.5, h * 0.25)) * (it.dead ? 0 : 1);
    en.blob.position.set(cur.x, gz + 0.04, cur.z); en.blob.scale.set(sz, sz, 1); en.blob.visible = !it.hide && !it.ghost;
  }
  function nameTag(en, it, cur, s, top) {
    if (!it.n || it.hide) { if (en.tag) en.tag.visible = false; return; }
    if (!en.tag) { en.tag = spriteOf(it.n, "#fff", 0.42, 42); R.dynG.add(en.tag); en.tagText = it.n; }
    if (en.tagText !== it.n) { en.tagText = it.n; setSprite(en.tag, it.n, "#fff", 0.42, 42); }
    en.tag.visible = true; en.tag.position.set(cur.x, cur.y + (top + (it.hat ? 0.2 : 0)) * s * 1.0 + 0.45 * s, cur.z); en.tag.material.opacity = it.ghost ? 0.5 : 1;
    const mine = R.meId && it.id === R.meId; if (mine) { if (!en.me) { en.me = new T.Mesh(G.cone, new T.MeshBasicMaterial({ color: 0xffffff })); en.me.rotation.x = Math.PI; en.me.userData.own = true; R.dynG.add(en.me); } en.me.visible = !it.dead && !it.hide; en.me.scale.set(0.22, 0.34, 0.22); en.me.position.set(cur.x, cur.y + (top + 0.95) * s + Math.sin(R.t * 5) * 0.08, cur.z); }
  }
  function badgeTag(en, it, cur, top) {
    if (!it.badge) { if (en.badge) en.badge.visible = false; return; }
    if (!en.badge) { en.badge = spriteOf(it.badge, "#fff", 0.7, 56); R.dynG.add(en.badge); en.bt = it.badge; }
    if (en.bt !== it.badge) { en.bt = it.badge; setSprite(en.badge, it.badge, "#fff", 0.7, 56); }
    en.badge.visible = true; en.badge.position.set(cur.x, cur.y + top + 0.62 + Math.sin(R.t * 6) * 0.05, cur.z);
  }
  U_.car = function (en, it, dt) {
    const o = en.obj; const u = o.userData; const cur = applyTransform(en, it, dt, en.fresh); o.rotation.y = -(cur.ang || 0); o.scale.set(1.5, 1.5, 1.5);
    const sp = cur.speed || 0; u.wr += dt * sp * S * 2.2; u.wheels.forEach((w) => { w.rotation.z = -u.wr; }); const slip = it.slip || 0;
    u.body.rotation.x = clamp(slip, -1, 1) * 0.12; u.body.rotation.z = -Math.min(0.1, sp / 3000); u.body.position.y = 0.02 + Math.sin(R.t * 30 + (it.x || 0)) * 0.004 * Math.min(1, sp / 200);
    u.flame.visible = !!it.boost; if (it.boost) { u.flame.scale.set(0.18, 0.6 + Math.random() * 0.4, 0.18); }
    const has = !!it.bomb; u.bomb.visible = has && !it.dead; if (has) { const hot = it.danger ? 1 : 0; const fl = Math.sin(R.t * (hot ? 26 : 9)) > 0; u.bs.material = mat("", hot && fl ? "#ff3b2e" : "#1b1b22"); u.bomb.scale.setScalar(1 + (hot && fl ? 0.12 : 0)); u.spark.visible = Math.sin(R.t * 40) > -0.3; if (Math.random() < dt * 20) puff("spark", cur.x, cur.y + 1.75, cur.z, "#ffd24a", 1); }
    u.shield.visible = !!it.imm; if (it.imm) u.shield.rotation.y = R.t * 3;
    if (it.dead) { o.rotation.z = it.dead * 2.2; o.rotation.x = it.dead * 1.4; }
    else { o.rotation.z = 0; o.rotation.x = 0; }
    o.visible = !it.hide; shadowBlob(en, Object.assign({}, it, { br: 30 }), cur, 1);
    nameTag(en, it, cur, 1.1, has ? 2.0 : 1.05);
    if (has && it.bomb) { if (!en.badge) { en.badge = spriteOf(String(it.bomb), "#ffe27a", 0.8, 64); R.dynG.add(en.badge); } const t = String(it.bomb); if (en.bt !== t) { en.bt = t; setSprite(en.badge, t, it.danger ? "#ff6b4a" : "#ffe27a", 0.8, 64); } en.badge.visible = true; en.badge.position.set(cur.x, cur.y + 3.0 + Math.sin(R.t * 8) * 0.05, cur.z); } else if (en.badge) en.badge.visible = false;
    if (Math.abs(slip) > 0.55 && sp > 120 && Math.random() < dt * 28) puff("dust", cur.x - Math.cos(cur.ang || 0) * 0.5, cur.y + 0.1, cur.z - Math.sin(cur.ang || 0) * 0.5, "#cfcfcf", 1);
    if (it.boost && Math.random() < dt * 40) puff("flame", cur.x - Math.cos(cur.ang || 0) * 1.1, cur.y + 0.45, cur.z - Math.sin(cur.ang || 0) * 1.1, "#ffb347", 1);
  };
  function animSurface(m) { if (m.map) { m.map.offset.set(R.t * 0.015, R.t * 0.01); } if (m.userData && m.userData.kind === "lava") m.emissiveIntensity = 0.75 + Math.sin(R.t * 2.3) * 0.25; }

  // ---------- gestion des éléments ----------
  function keyOf(it, idx, prefix) { return prefix + (it.id != null ? "i" + it.id : it.t + "#" + idx); }
  function make(it) {
    const f = B[it.t]; if (!f) return null; const o = f(it); return o;
  }
  function disposeEntry(en, parent) {
    const kill = (obj) => {
      if (!obj) return; if (obj.parent) obj.parent.remove(obj);
      obj.traverse((m) => { if (m.geometry && !(m.geometry.userData && m.geometry.userData.shared)) m.geometry.dispose(); if (m.material && (m.userData.own || (m.material.userData && !m.material.userData.cached))) { if (m.material.dispose) m.material.dispose(); } });
    };
    kill(en.obj); kill(en.tag); kill(en.blob); kill(en.badge); kill(en.me);
  }
  function reconcile(bucket, group, items, prefix, dt, staticMode) {
    const seen = {}; const counts = {};
    items.forEach((it, i) => {
      if (!it || !B[it.t]) return; counts[it.t] = (counts[it.t] || 0) + 1;
      const key = prefix + (it.id != null ? "i" + it.id : it.t + "#" + counts[it.t]); seen[key] = true;
      let en = bucket[key];
      if (!en || en.t !== it.t) { if (en) { disposeEntry(en); } const o = make(it); if (!o) return; en = bucket[key] = { t: it.t, obj: o, fresh: true, born: R.t }; group.add(o); }
      const up = U_[it.t]; if (up) up(en, it, dt);
      en.fresh = false;
      if (staticMode) { /* les éléments fixes ne bougent plus après la première mise à jour */ }
    });
    Object.keys(bucket).forEach((k) => { if (!seen[k]) { const en = bucket[k]; if (!en.dying) { en.dying = 0; } en.dying += 1; if (en.dying > 1) { disposeEntry(en); delete bucket[k]; } } else if (bucket[k]) bucket[k].dying = 0; });
  }

  // ---------- particules ----------
  const F = { sets: {}, parts: [], rings: [], debris: [] };
  function mkPoints(size, additive) {
    const N = 700; const geo = new T.BufferGeometry(); const pos = new Float32Array(N * 3); const col = new Float32Array(N * 3); geo.setAttribute("position", new T.BufferAttribute(pos, 3)); geo.setAttribute("color", new T.BufferAttribute(col, 3));
    geo.setDrawRange(0, 0); const m = new T.PointsMaterial({ size, map: dotTex(), vertexColors: true, transparent: true, depthWrite: false, blending: additive ? T.AdditiveBlending : T.NormalBlending, sizeAttenuation: true });
    const p = new T.Points(geo, m); p.frustumCulled = false; p.renderOrder = 8; R.fxG.add(p); return { p, geo, pos, col, N, additive };
  }
  // poussières lumineuses qui flottent autour de la caméra, elles donnent de la profondeur
  function initMotes() {
    const N = 70; const geo = new T.BufferGeometry(); const pos = new Float32Array(N * 3); R.motes = { off: [], n: N };
    for (let i = 0; i < N; i++) { R.motes.off.push([(Math.random() - 0.5) * 16, (Math.random()) * 8, (Math.random() - 0.5) * 16, 0.15 + Math.random() * 0.35]); }
    geo.setAttribute("position", new T.BufferAttribute(pos, 3)); const m = new T.PointsMaterial({ color: 0xffffff, size: 0.11, map: dotTex(), transparent: true, opacity: 0.45, depthWrite: false, blending: T.AdditiveBlending, sizeAttenuation: true });
    const pts = new T.Points(geo, m); pts.frustumCulled = false; pts.userData.own = true; R.scene.add(pts); R.motes.pts = pts;
  }
  function stepMotes(dt) {
    const M = R.motes; if (!M || !M.pts || R.quality === "low") { if (M && M.pts) M.pts.visible = false; return; } M.pts.visible = true; const cur = R.camCur; if (!cur) return; const a = M.pts.geometry.attributes.position;
    for (let i = 0; i < M.n; i++) { const o = M.off[i]; o[1] += dt * o[3]; if (o[1] > 8) o[1] -= 8; a.setXYZ(i, cur.tx + o[0] + Math.sin(R.t * 0.4 + i) * 0.4, cur.ty - 1 + o[1], cur.tz + o[2]); } a.needsUpdate = true;
  }
  function initFx() {
    F.sets.addS = mkPoints(0.34, true); F.sets.addL = mkPoints(1.0, true); F.sets.smokeS = mkPoints(0.55, false); F.sets.smokeL = mkPoints(1.4, false);
    for (let i = 0; i < 6; i++) { const m = new T.Mesh(G.ring, new T.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0, side: T.DoubleSide, depthWrite: false, blending: T.AdditiveBlending })); m.rotation.x = -Math.PI / 2; m.visible = false; m.userData.own = true; R.fxG.add(m); F.rings.push({ m, t: 0, life: 0, r: 0 }); }
    for (let i = 0; i < 40; i++) { const m = new T.Mesh(G.box, new T.MeshLambertMaterial({ color: 0xffffff })); m.visible = false; m.userData.own = true; m.castShadow = false; R.fxG.add(m); F.debris.push({ m, life: 0, vx: 0, vy: 0, vz: 0, rx: 0, rz: 0 }); }
  }
  function emit(set, x, y, z, vx, vy, vz, color, life, grav, drag) {
    const s = F.sets[set]; if (!s) return; if (F.parts.length > 2200) return;
    F.parts.push({ s, x, y, z, vx, vy, vz, r: color.r, g: color.g, b: color.b, life, max: life, grav: grav || 0, drag: drag == null ? 1.2 : drag });
  }
  const colObj = new T.Color();
  function C(hex) { colObj.set(hex); return { r: colObj.r, g: colObj.g, b: colObj.b }; }
  function ringFx(x, y, z, r, color, life) { const f = F.rings.find((q) => q.life <= 0); if (!f) return; f.life = f.max = life; f.r = r; f.m.position.set(x, y + 0.08, z); f.m.material.color.set(color); f.m.visible = true; f.m.scale.set(0.1, 0.1, 1); }
  function debrisFx(x, y, z, n, color) { for (let i = 0; i < n; i++) { const d = F.debris.find((q) => q.life <= 0); if (!d) return; d.life = 1.4 + Math.random() * 0.6; const a = Math.random() * 7, sp = 3 + Math.random() * 6; d.vx = Math.cos(a) * sp; d.vz = Math.sin(a) * sp; d.vy = 5 + Math.random() * 7; d.m.position.set(x, y + 0.3, z); const sz = 0.12 + Math.random() * 0.2; d.m.scale.set(sz, sz, sz); d.m.material.color.set(Math.random() < 0.5 ? color : "#3a3a44"); d.m.visible = true; d.rx = Math.random() * 9; d.rz = Math.random() * 9; } }
  function puff(kind, x, y, z, color, n) {
    for (let i = 0; i < (n || 1); i++) {
      const c = C(color || "#ffffff"); const r = () => (Math.random() - 0.5);
      if (kind === "dust") emit("smokeS", x + r() * 0.3, y, z + r() * 0.3, r() * 1.2, 0.5 + Math.random() * 0.8, r() * 1.2, c, 0.5 + Math.random() * 0.4, -0.5, 2);
      else if (kind === "spark") emit("addS", x, y, z, r() * 3, 1 + Math.random() * 2.5, r() * 3, c, 0.35 + Math.random() * 0.3, -9, 1);
      else if (kind === "flame") emit("addS", x, y, z, r() * 0.6, 0.2 + Math.random(), r() * 0.6, c, 0.25 + Math.random() * 0.15, 0, 3);
    }
  }
  const palette = ["#ff4d6d", "#ffd23b", "#4cd964", "#4dabf7", "#b388ff", "#ff9f43"];
  function playFx(f) {
    const x = (f.x || 0) * S, y = (f.z || 0) * S, z = (f.y || 0) * S; const r = () => (Math.random() - 0.5);
    switch (f.k) {
      case "boom": {
        for (let i = 0; i < 46; i++) { const a = Math.random() * 6.28, e = Math.random() * 1.4, sp = 2 + Math.random() * 8; emit("addL", x, y + 0.6, z, Math.cos(a) * sp * Math.cos(e), Math.sin(e) * sp * 0.8 + 2, Math.sin(a) * sp * Math.cos(e), C(Math.random() < 0.5 ? "#ff8a2a" : "#ffd24a"), 0.5 + Math.random() * 0.55, -3, 1.5); }
        for (let i = 0; i < 40; i++) { const a = Math.random() * 6.28, sp = 2 + Math.random() * 11; emit("addS", x, y + 0.5, z, Math.cos(a) * sp, 1 + Math.random() * 8, Math.sin(a) * sp, C("#fff0b0"), 0.5 + Math.random() * 0.6, -12, 0.6); }
        for (let i = 0; i < 24; i++) { const a = Math.random() * 6.28, sp = Math.random() * 3; emit("smokeL", x + r(), y + 0.6, z + r(), Math.cos(a) * sp, 1 + Math.random() * 3, Math.sin(a) * sp, C("#3a3a44"), 1.0 + Math.random() * 0.8, -0.3, 1.2); }
        ringFx(x, y, z, 5.5, "#ffb347", 0.55); ringFx(x, y, z, 3.4, "#fff2b0", 0.4); debrisFx(x, y, z, 10, f.c || "#ffb347"); R.shake = Math.max(R.shake, 0.9); R.flash = 1; R.flashPos = [x, y + 1.5, z]; break; }
      case "splash": { const c = f.c || "#ffffff"; for (let i = 0; i < 26; i++) { const a = Math.random() * 6.28, sp = Math.random() * 3.5; emit("smokeS", x, y, z, Math.cos(a) * sp, 4 + Math.random() * 6, Math.sin(a) * sp, C(c), 0.6 + Math.random() * 0.4, -14, 0.5); } ringFx(x, y, z, 2.2, c, 0.5); break; }
      case "lavasplash": { for (let i = 0; i < 30; i++) { const a = Math.random() * 6.28, sp = Math.random() * 4; emit("addS", x, y, z, Math.cos(a) * sp, 5 + Math.random() * 8, Math.sin(a) * sp, C(Math.random() < 0.5 ? "#ff7a1a" : "#ffd24a"), 0.7 + Math.random() * 0.5, -16, 0.4); } ringFx(x, y, z, 2.6, "#ff7a1a", 0.5); R.shake = Math.max(R.shake, 0.25); break; }
      case "puff": puff("dust", x, y + 0.1, z, f.c || "#e2e2e2", 8); break;
      case "spark": puff("spark", x, y + 0.5, z, f.c || "#ffffff", 14); break;
      case "hit": { for (let i = 0; i < 16; i++) { const a = Math.random() * 6.28, sp = 2 + Math.random() * 5; emit("addS", x, y + 0.7, z, Math.cos(a) * sp, 1 + Math.random() * 3, Math.sin(a) * sp, C(f.c || "#ffffff"), 0.3 + Math.random() * 0.2, -4, 2); } ringFx(x, y, z, 1.4, "#ffffff", 0.3); R.shake = Math.max(R.shake, 0.22); break; }
      case "coin": for (let i = 0; i < 12; i++) emit("addS", x + r() * 0.5, y + 0.5, z + r() * 0.5, r() * 2, 3 + Math.random() * 3, r() * 2, C(i % 2 ? "#ffd23b" : "#fff3a0"), 0.6 + Math.random() * 0.3, -9, 0.8); break;
      case "confetti": for (let i = 0; i < 90; i++) emit("addL", x + r() * 14, y + 7 + Math.random() * 3, z + r() * 10, r() * 2, -1 - Math.random() * 2.5, r() * 2, C(palette[i % palette.length]), 2.5 + Math.random() * 1.5, -1, 0.6); break;
      case "boost": puff("flame", x, y + 0.4, z, "#ffb347", 10); break;
      case "ring": ringFx(x, y, z, (f.r || 60) * S, f.c || "#ffffff", 0.5); break;
      case "shake": R.shake = Math.max(R.shake, 0.3 * (f.a || 1)); break;
      case "snd": if (window.PgSound && f.n) window.PgSound.play(f.n); break;
      default: break;
    }
  }
  R.playFx = function (list) { (list || []).forEach((f) => { if (f.id > R.fxSeen) { R.fxSeen = f.id; try { playFx(f); } catch (e) { /* un effet raté ne casse rien */ } } }); };
  function stepFx(dt) {
    const sets = F.sets; Object.keys(sets).forEach((k) => { sets[k].n = 0; });
    for (let i = F.parts.length - 1; i >= 0; i--) {
      const p = F.parts[i]; p.life -= dt; if (p.life <= 0) { F.parts[i] = F.parts[F.parts.length - 1]; F.parts.pop(); continue; }
      p.vy += p.grav * dt; const dr = Math.max(0, 1 - p.drag * dt); p.vx *= dr; p.vz *= dr; p.x += p.vx * dt; p.y += p.vy * dt; p.z += p.vz * dt; if (p.y < -30) p.life = 0;
      const s = p.s; if (s.n >= s.N) continue; const f = Math.max(0, p.life / p.max); const j = s.n * 3; s.pos[j] = p.x; s.pos[j + 1] = p.y; s.pos[j + 2] = p.z;
      const sh = s.additive ? f : 1; const bgmix = s.additive ? 0 : 1 - f; s.col[j] = p.r * sh + (R.fogC ? R.fogC.r : 0.5) * bgmix * 0.5; s.col[j + 1] = p.g * sh + (R.fogC ? R.fogC.g : 0.5) * bgmix * 0.5; s.col[j + 2] = p.b * sh + (R.fogC ? R.fogC.b : 0.5) * bgmix * 0.5; s.n++;
    }
    Object.keys(sets).forEach((k) => { const s = sets[k]; s.geo.setDrawRange(0, s.n); s.geo.attributes.position.needsUpdate = true; s.geo.attributes.color.needsUpdate = true; });
    F.rings.forEach((f) => { if (f.life > 0) { f.life -= dt; const k = 1 - Math.max(0, f.life) / f.max; const s = f.r * (0.15 + k * 0.85); f.m.scale.set(s, s, 1); f.m.material.opacity = Math.max(0, 1 - k) * 0.85; if (f.life <= 0) f.m.visible = false; } });
    F.debris.forEach((d) => { if (d.life > 0) { d.life -= dt; d.vy -= 18 * dt; const p = d.m.position; p.x += d.vx * dt; p.y += d.vy * dt; p.z += d.vz * dt; d.m.rotation.x += d.rx * dt; d.m.rotation.z += d.rz * dt; if (d.life <= 0 || p.y < -20) d.m.visible = false; } });
    if (R.flash > 0) { R.flash = Math.max(0, R.flash - dt * 3.2); R.flashLight.intensity = R.flash * 6; if (R.flashPos) R.flashLight.position.set(R.flashPos[0], R.flashPos[1], R.flashPos[2]); } else R.flashLight.intensity = 0;
  }

  // ---------- caméra ----------
  function updateCamera(dt) {
    const cam = R.cam || {}; const cur = R.camCur || (R.camCur = { px: 0, py: 10, pz: 10, tx: 0, ty: 0, tz: 0, fov: 38 });
    let px, py, pz, tx, ty, tz, fov = cam.fov || 38; const aspect = (R.w || 1) / (R.h || 1);
    if (cam.m === "follow") {
      const t = cam.t || [0, 0, 0]; const yaw = cam.yaw == null ? -Math.PI / 2 : cam.yaw; const d = (cam.d || 330) * S, hg = (cam.hg || 210) * S, la = (cam.la || 120) * S;
      tx = t[0] * S + Math.cos(yaw) * la; ty = t[2] * S + 0.4; tz = t[1] * S + Math.sin(yaw) * la; px = t[0] * S - Math.cos(yaw) * d; py = t[2] * S + hg; pz = t[1] * S - Math.sin(yaw) * d;
    } else {
      const w = (R.world ? R.world.w : 900) * S, h = (R.world ? R.world.h : 600) * S; const tilt = (cam.tilt || 56) * Math.PI / 180; const vf = fov * Math.PI / 180; const th = Math.tan(vf / 2);
      const pad = cam.pad || 1.06; const ht = (cam.ht || 0) * S;
      const dist = Math.max((w / 2) / (th * aspect), (h * Math.sin(tilt) / 2 + ht * Math.cos(tilt) + 0.6) / th) * pad + (h * Math.cos(tilt)) / 2 * 0.0 + 1;
      const c = cam.c ? [cam.c[0] * S, cam.c[1] * S] : [w / 2, h / 2]; tx = c[0]; ty = ht / 2; tz = c[1];
      px = tx; py = ty + dist * Math.sin(tilt); pz = tz + dist * Math.cos(tilt) * (cam.az == null ? 1 : 1);
      if (cam.zoom) { const z = cam.zoom; px = tx + (px - tx) / z; py = ty + (py - ty) / z; pz = tz + (pz - tz) / z; }
    }
    const k = R.camSnap ? 1 : 1 - Math.exp(-dt * (cam.m === "follow" ? 6 : 3.2));
    cur.px += (px - cur.px) * k; cur.py += (py - cur.py) * k; cur.pz += (pz - cur.pz) * k; cur.tx += (tx - cur.tx) * k; cur.ty += (ty - cur.ty) * k; cur.tz += (tz - cur.tz) * k; cur.fov += (fov - cur.fov) * k; R.camSnap = false;
    let sx = 0, sy = 0; if (R.shake > 0.01) { sx = (Math.random() - 0.5) * R.shake * 0.5; sy = (Math.random() - 0.5) * R.shake * 0.5; R.shake *= Math.exp(-dt * 5.5); } else R.shake = 0;
    // petite respiration de caméra pour donner de la vie
    const br = Math.sin(R.t * 0.5) * 0.05;
    R.camera.position.set(cur.px + sx + br, cur.py + sy, cur.pz); R.camera.lookAt(cur.tx, cur.ty, cur.tz);
    if (Math.abs(R.camera.fov - cur.fov) > 0.01) { R.camera.fov = cur.fov; R.camera.updateProjectionMatrix(); }
  }

  // ---------- API ----------
  R.setScene = function (sc) {
    R.clear(); if (!sc) return; R.world = { w: sc.w || 900, h: sc.h || 600 }; R.statCam = sc.cam || null; setEnv(sc.env); R.fogC = R.scene.fog ? R.scene.fog.color : null; fitSun(R.world.w, R.world.h);
    // sol lointain, l'eau, la lave ou le vide sous le décor
    if (sc.env && sc.env.ground) { const g = sc.env.ground; const m = new T.Mesh(G.plane, mat(g.m || "", g.c || "#1b6ca8")); m.rotation.x = -Math.PI / 2; m.scale.set(500, 500, 1); m.position.set(R.world.w * S / 2, (g.z || -40) * S, R.world.h * S / 2); m.receiveShadow = true; m.userData.own = false; R.statG.add(m); R.groundMesh = m; if (g.m === "water" || g.m === "lava") m.material.map && m.material.map.repeat.set(70, 70); }
    reconcile(R.stat, R.statG, sc.items || [], "s", 0.016, true); R.camSnap = true; R.cam = sc.cam || null;
  };
  R.clear = function () {
    Object.keys(R.stat).forEach((k) => { disposeEntry(R.stat[k]); delete R.stat[k]; }); Object.keys(R.dyn).forEach((k) => { disposeEntry(R.dyn[k]); delete R.dyn[k]; });
    if (R.groundMesh) { R.statG.remove(R.groundMesh); R.groundMesh = null; } F.parts.length = 0; F.rings.forEach((f) => { f.life = 0; f.m.visible = false; }); F.debris.forEach((d) => { d.life = 0; d.m.visible = false; }); R.flash = 0; R.shake = 0;
    while (R.statG.children.length) R.statG.remove(R.statG.children[0]); while (R.dynG.children.length) R.dynG.remove(R.dynG.children[0]);
  };
  // fr, p sont les derniers messages du serveur. dt vient de la boucle d'affichage
  R.feed = function (fr, priv, meId) {
    if (!R.ready || !fr) return; R.meId = meId; R.lastFrame = fr;
    const items = (fr.items || []).concat(priv && priv.items ? priv.items : []);
    reconcile(R.dyn, R.dynG, items, "d", Math.max(0.016, R.dtLast || 0.016));
    if (priv && priv.cam) R.cam = priv.cam; else if (fr.cam) R.cam = fr.cam; if (fr.w && !R.world) R.world = { w: fr.w, h: fr.h };
    if (fr.kill && fr.kill.length) fr.kill.forEach((id) => { const en = R.stat["si" + id]; if (en && en.obj.visible) en.obj.visible = false; });
    R.playFx(fr.fx);
  };
  R.render = function (dt) {
    if (!R.ready) return; R.t += dt; R.dtLast = dt; if (R.w !== R.host.clientWidth || R.h !== R.host.clientHeight) R.resize();
    // les éléments qui bougent entre deux images du serveur sont lissés ici
    smoothAll(dt);
    stepFx(dt); updateCamera(dt); stepMotes(dt);
    const run = () => R.renderer.render(R.scene, R.camera); if (window.PicuiteGL && PicuiteGL.frame) { PicuiteGL.frame(run); PicuiteGL.verify && PicuiteGL.verify(R.renderer); } else run();
  };
  function smoothAll(dt) {
    // appelée à chaque image pour que les mouvements restent fluides même si le serveur envoie moins souvent
    const f = R.lastFrame; if (!f) return; const items = f.items || [];
    const mine = R.lastPriv && R.lastPriv.items ? R.lastPriv.items : []; const all = items.concat(mine); const counts = {};
    all.forEach((it) => { if (!it || !B[it.t]) return; counts[it.t] = (counts[it.t] || 0) + 1; const key = "d" + (it.id != null ? "i" + it.id : it.t + "#" + counts[it.t]); const en = R.dyn[key]; if (en && U_[it.t] && (it.t === "pawn" || it.t === "car" || it.t === "coin" || it.t === "box" || it.t === "cyl")) U_[it.t](en, it, dt); });
    // éléments fixes animés (lave, eau, nuages)
    Object.keys(R.stat).forEach((k) => { const en = R.stat[k]; if (en.obj.userData && en.obj.userData.drift) { en.obj.position.x += dt * 0.25; } if (en.obj.material && en.obj.material.map && en.obj.userData.kind) animSurface(en.obj.material); });
    if (R.groundMesh && R.groundMesh.material.map) animSurface(R.groundMesh.material);
  }
  R.setPriv = function (p) { R.lastPriv = p; };
  // convertit un point de l'écran en position dans le monde du serveur sur le plan de hauteur zPlane
  R.pick = function (cx, cy, zPlane) {
    if (!R.ready) return null; const r = R.canvas.getBoundingClientRect(); const nx = ((cx - r.left) / r.width) * 2 - 1, ny = -((cy - r.top) / r.height) * 2 + 1;
    const rc = new T.Raycaster(); rc.setFromCamera({ x: nx, y: ny }, R.camera); const pl = new T.Plane(new T.Vector3(0, 1, 0), -(zPlane || 0) * S); const out = new T.Vector3();
    if (!rc.ray.intersectPlane(pl, out)) return null; return { x: out.x / S, y: out.z / S };
  };
  R.project = function (x, y, z) { if (!R.ready) return null; const v = new T.Vector3(x * S, (z || 0) * S, y * S).project(R.camera); const r = R.canvas.getBoundingClientRect(); return { x: (v.x * 0.5 + 0.5) * r.width, y: (-v.y * 0.5 + 0.5) * r.height, behind: v.z > 1 }; };
  R.show = function (on) { if (R.canvas) R.canvas.style.display = on ? "block" : "none"; };
  R.stats = function () { return R.renderer ? { calls: R.renderer.info.render.calls, tris: R.renderer.info.render.triangles, geos: R.renderer.info.memory.geometries, tex: R.renderer.info.memory.textures } : null; };
  window.Pg3D = R;
})();

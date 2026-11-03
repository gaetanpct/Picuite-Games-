// ============================================================
// FART TOGETHER — Scène 3D (three.js)
// Rivière en ruban, rives décorées, bouées avec équipage, fumées et éclaboussures.
// Le serveur décide de tout, ici on ne fait qu'interpoler et dessiner.
// ============================================================
(function () {
  const T = THREE;
  const S = { ready: false };
  let renderer, scene, camera, host, canvas, lvG = null, boatG = null, fxG = null, level = null, tex = null;
  let boats = {}, coinMeshes = [], obsMeshes = [], pool = [], poolI = 0, camPos = new T.Vector3(), camLook = new T.Vector3(), camInit = false, shake = 0, clock = 0, sunL = null, hemi = null;
  const col = (h) => new T.Color(h);
  const mats = {};
  const lam = (c, o) => { const k = "l" + c + JSON.stringify(o || {}); if (!mats[k]) mats[k] = new T.MeshLambertMaterial(Object.assign({ color: col(c) }, o || {})); return mats[k]; };
  const bas = (c, o) => { const k = "b" + c + JSON.stringify(o || {}); if (!mats[k]) mats[k] = new T.MeshBasicMaterial(Object.assign({ color: col(c) }, o || {})); return mats[k]; };
  const WRL = window.FTWorld;
  const SEAT_R = 1.15;
  const seatPos = (n, k) => { const a = (k / n) * Math.PI * 2; return [Math.sin(a) * SEAT_R, Math.cos(a) * SEAT_R]; };
  const HATS = ["Aucun", "Casquette", "Couronne", "Cône de fête", "Haut-de-forme", "Cornes", "Auréole", "Hélice", "Toque", "Pirate", "Fleur", "Casque"];
  const FACES = ["Content", "Concentré", "Surpris", "Malin", "Fâché", "Endormi", "Lunettes", "Moustache"];
  S.HATS = HATS; S.FACES = FACES;

  S.init = function (container) {
    host = container; canvas = document.createElement("canvas"); canvas.className = "ft-canvas"; host.appendChild(canvas);
    try { renderer = PicuiteGL.create(T, canvas, "medium"); PicuiteGL.watch(canvas); } catch (e) { return false; }
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.5));
    scene = new T.Scene(); camera = new T.PerspectiveCamera(58, 1, 0.5, 400);
    hemi = new T.HemisphereLight(0xffffff, 0x6a7a8a, 0.9); scene.add(hemi);
    sunL = new T.DirectionalLight(0xffffff, 0.75); sunL.position.set(30, 50, 20); scene.add(sunL);
    lvG = new T.Group(); boatG = new T.Group(); fxG = new T.Group(); scene.add(lvG); scene.add(boatG); scene.add(fxG);
    // texture d'eau
    const cv = document.createElement("canvas"); cv.width = 128; cv.height = 128; const x = cv.getContext("2d"); x.fillStyle = "#ffffff"; x.fillRect(0, 0, 128, 128);
    x.strokeStyle = "rgba(160,200,230,0.55)"; x.lineWidth = 3; for (let i = 0; i < 7; i++) { const yy = i * 19 + 8; x.beginPath(); x.moveTo(0, yy); for (let u = 0; u <= 128; u += 8) x.lineTo(u, yy + Math.sin(u * 0.2 + i) * 3); x.stroke(); }
    tex = new T.CanvasTexture(cv); tex.wrapS = tex.wrapT = T.RepeatWrapping;
    for (let i = 0; i < 90; i++) { const m = new T.Mesh(new T.SphereGeometry(0.5, 7, 6), new T.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0 })); m.visible = false; fxG.add(m); pool.push({ m, life: 0, vx: 0, vy: 0, vz: 0, g: 0, grow: 1, s0: 1, max: 1 }); }
    window.addEventListener("resize", S.resize); S.resize(); S.ready = true; return true;
  };
  S.resize = function () { if (!renderer || !host) return; const w = host.clientWidth || 300, h = host.clientHeight || 200; renderer.setSize(w, h, false); camera.aspect = w / h; camera.updateProjectionMatrix(); };
  function clearGroup(g) { while (g.children.length) { const c = g.children.pop(); if (c.geometry && !c.userData.shared) c.geometry.dispose(); } }

  // ---------- rivière ----------
  const ZCOL = { 1: "#f5d44a", 2: "#e6f6ff", 4: "#ff9ad5" };
  S.setLevel = function (lv, biome) {
    if (!scene) return; level = lv; clearGroup(lvG); clearGroup(boatG); boats = {}; coinMeshes = []; obsMeshes = [];
    const B = biome; PicuiteGL.sky(scene, host, B.sky[0], B.sky[1], T);
    scene.fog = new T.Fog(col(B.fog), 40, 190); hemi.color = col("#ffffff"); sunL.color = col(B.sun);
    if (scene.background === null) renderer.setClearColor(col(B.fog), 1);
    const n = lv.n; const pos = [], uv = [], cols = [], idx = []; const bpos = [], bcols = [], bidx = [];
    const wc = col(B.water), wc2 = col(B.water2), bk = col(B.bank);
    for (let i = 0; i < n; i++) {
      const a = Math.max(0, i - 1), b = Math.min(n - 1, i + 1); let tx = lv.x[b] - lv.x[a], tz = lv.z[b] - lv.z[a]; const l = Math.hypot(tx, tz) || 1; tx /= l; tz /= l; const nx = -tz, nz = tx;
      const hw = lv.hw[i], y = lv.h[i];
      pos.push(lv.x[i] + nx * hw, y, lv.z[i] + nz * hw, lv.x[i] - nx * hw, y, lv.z[i] - nz * hw);
      uv.push(0, lv.s[i] / 14, 1, lv.s[i] / 14);
      const c = (lv.zone[i] && ZCOL[lv.zone[i]]) ? col(ZCOL[lv.zone[i]]).lerp(wc, 0.25) : wc.clone().lerp(wc2, 0.5 + 0.5 * Math.sin(i * 0.7)); if (lv.turb[i]) c.lerp(col("#ffffff"), 0.35); if (lv.flow[i] < 0) c.lerp(col("#7a4ab8"), 0.18);
      cols.push(c.r, c.g, c.b, c.r, c.g, c.b);
      if (i < n - 1) { const k = i * 2; idx.push(k, k + 1, k + 2, k + 1, k + 3, k + 2); }
      // rives, deux rubans qui montent
      const out = 7, up = 1.6; bpos.push(lv.x[i] + nx * hw, y, lv.z[i] + nz * hw, lv.x[i] + nx * (hw + 1.2), y + up, lv.z[i] + nz * (hw + 1.2), lv.x[i] + nx * (hw + out), y + up + 0.2, lv.z[i] + nz * (hw + out),
        lv.x[i] - nx * hw, y, lv.z[i] - nz * hw, lv.x[i] - nx * (hw + 1.2), y + up, lv.z[i] - nz * (hw + 1.2), lv.x[i] - nx * (hw + out), y + up + 0.2, lv.z[i] - nz * (hw + out));
      const dark = bk.clone().multiplyScalar(0.7); [dark, bk, bk, dark, bk, bk].forEach((c) => bcols.push(c.r, c.g, c.b));
      if (i < n - 1) { const k = i * 6; [[0, 1], [1, 2], [3, 4], [4, 5]].forEach(([p, q]) => { idx; bidx.push(k + p, k + q, k + 6 + p, k + q, k + 6 + q, k + 6 + p); }); }
    }
    const g = new T.BufferGeometry(); g.setAttribute("position", new T.Float32BufferAttribute(pos, 3)); g.setAttribute("uv", new T.Float32BufferAttribute(uv, 2)); g.setAttribute("color", new T.Float32BufferAttribute(cols, 3)); g.setIndex(idx); g.computeVertexNormals();
    const water = new T.Mesh(g, new T.MeshLambertMaterial({ vertexColors: true, map: tex, side: T.DoubleSide })); lvG.add(water);
    const bg = new T.BufferGeometry(); bg.setAttribute("position", new T.Float32BufferAttribute(bpos, 3)); bg.setAttribute("color", new T.Float32BufferAttribute(bcols, 3)); bg.setIndex(bidx); bg.computeVertexNormals();
    lvG.add(new T.Mesh(bg, new T.MeshLambertMaterial({ vertexColors: true, side: T.DoubleSide })));
    // sol lointain
    const ground = new T.Mesh(new T.PlaneGeometry(900, 900), lam(B.bank)); ground.rotation.x = -Math.PI / 2; ground.position.set(lv.x[n >> 1], Math.min.apply(null, lv.h) - 1.5, lv.z[n >> 1]); ground.userData.shared = false; lvG.add(ground);
    // décor des rives
    let seed = lv.n * 31 + 7; const rnd = () => { seed = (seed * 1664525 + 1013904223) >>> 0; return seed / 4294967296; };
    for (let i = 2; i < n - 2; i += 2) for (const sd of [1, -1]) {
      if (rnd() < 0.35) continue; const a = i - 1, b = i + 1; let tx = lv.x[b] - lv.x[a], tz = lv.z[b] - lv.z[a]; const l = Math.hypot(tx, tz) || 1; tx /= l; tz /= l; const nx = -tz * sd, nz = tx * sd;
      const off = lv.hw[i] + 3 + rnd() * 20; const p = prop(B.prop, rnd); p.position.set(lv.x[i] + nx * off, lv.h[i] + 1.8, lv.z[i] + nz * off); p.rotation.y = rnd() * 6; lvG.add(p);
    }
    // obstacles
    lv.obstacles.forEach((o) => { const m = obstacleMesh(o); lvG.add(m); obsMeshes.push({ o, m }); });
    lv.coins.forEach((c, i) => { const p = WRL.nearest(lv, c[0], c[1]); const m = new T.Mesh(new T.SphereGeometry(0.65, 10, 8), bas("#ffd23f")); const ring = new T.Mesh(new T.TorusGeometry(0.85, 0.12, 6, 14), bas("#fff2a8")); m.add(ring); m.position.set(c[0], p.h + 1.1, c[1]); m.userData.y = p.h + 1.1; lvG.add(m); coinMeshes.push(m); });
    lv.gates.forEach((gt, i) => { if (lv.arena) return; const p = WRL.nearest(lv, gt.x, gt.z); const nx = -p.tz, nz = p.tx; const grp = new T.Group(); const hwid = gt.hw; [-1, 1].forEach((sd) => { const post = new T.Mesh(new T.CylinderGeometry(0.22, 0.22, 4.2, 8), lam(i % 2 ? "#ff5fa8" : "#2fe0a8")); post.position.set(gt.x + nx * hwid * sd, p.h + 1.8, gt.z + nz * hwid * sd); grp.add(post); const ball = new T.Mesh(new T.SphereGeometry(0.5, 8, 6), bas("#ffd23f")); ball.position.set(post.position.x, p.h + 4, post.position.z); grp.add(ball); });
      const ban = new T.Mesh(new T.BoxGeometry(hwid * 2, 0.35, 0.12), bas(i % 2 ? "#ff5fa8" : "#2fe0a8", { transparent: true, opacity: 0.55 })); ban.position.set(gt.x, p.h + 3.8, gt.z); ban.rotation.y = Math.atan2(p.tx, p.tz) + Math.PI / 2; grp.add(ban); lvG.add(grp); });
    lv.ramps.forEach((r) => { const pt = WRL.pointAt(lv, r.s + r.len / 2); const w = pt.hw * 1.7; const m = new T.Mesh(new T.BoxGeometry(w, 0.5, r.len), lam(r.pad ? "#ff5fa8" : r.fall ? "#d6f1ff" : "#c98a4a")); m.position.set(pt.x, pt.h + 0.1, pt.z); m.rotation.y = Math.atan2(pt.tx, pt.tz); m.rotation.x = -0.12; lvG.add(m); });
    // départ et arrivée
    if (!lv.arena) { arch(0, 6, "#ffffff", "DÉPART"); arch(1, lv.L - 2, "#ffd23f", "ARRIVÉE"); }
    camInit = false;
  };
  function arch(k, s, c, label) {
    const p = WRL.pointAt(level, s); const nx = -p.tz, nz = p.tx; const grp = new T.Group(); const hw = p.hw + 1;
    [-1, 1].forEach((sd) => { const post = new T.Mesh(new T.BoxGeometry(1, 9, 1), lam(c)); post.position.set(p.x + nx * hw * sd, p.h + 4, p.z + nz * hw * sd); grp.add(post); });
    const cv = document.createElement("canvas"); cv.width = 512; cv.height = 96; const x = cv.getContext("2d"); for (let i = 0; i < 16; i++) for (let j = 0; j < 3; j++) { x.fillStyle = (i + j) % 2 ? "#111" : "#fff"; x.fillRect(i * 32, j * 32, 32, 32); } x.fillStyle = "rgba(0,0,0,0.55)"; x.fillRect(0, 24, 512, 48); x.fillStyle = "#fff"; x.font = "bold 44px sans-serif"; x.textAlign = "center"; x.fillText(label, 256, 62);
    const t = new T.CanvasTexture(cv); const ban = new T.Mesh(new T.PlaneGeometry(hw * 2, 3.4), new T.MeshBasicMaterial({ map: t, side: T.DoubleSide })); ban.position.set(p.x, p.h + 8.5, p.z); ban.rotation.y = Math.atan2(p.tx, p.tz) + Math.PI / 2; grp.add(ban); lvG.add(grp);
  }
  function prop(type, rnd) {
    const g = new T.Group(); const s = 0.8 + rnd() * 1.3;
    const add = (geo, m, x, y, z) => { const o = new T.Mesh(geo, m); o.position.set(x || 0, y || 0, z || 0); g.add(o); return o; };
    if (type === "building") { const h = 5 + rnd() * 12; add(new T.BoxGeometry(5 * s, h, 5 * s), lam(["#c9b8a6", "#a8b4c8", "#d8a9a0", "#b0c9a8"][Math.floor(rnd() * 4)]), 0, h / 2 - 1, 0); add(new T.BoxGeometry(5.4 * s, 0.5, 5.4 * s), lam("#555"), 0, h - 0.8, 0); }
    else if (type === "rock") { const o = add(new T.DodecahedronGeometry(2.4 * s, 0), lam(["#c97c4b", "#b86a3a", "#d99060"][Math.floor(rnd() * 3)]), 0, 1 * s, 0); o.scale.y = 1 + rnd() * 1.5; }
    else if (type === "palm") { add(new T.CylinderGeometry(0.3, 0.5, 6 * s, 6), lam("#8a5a2a"), 0, 3 * s, 0); for (let k = 0; k < 5; k++) { const l = add(new T.ConeGeometry(0.6, 4 * s, 4), lam("#2fb85a"), Math.sin(k * 1.26) * 1.5 * s, 6.2 * s, Math.cos(k * 1.26) * 1.5 * s); l.rotation.z = Math.cos(k * 1.26) * 1.2; l.rotation.x = Math.sin(k * 1.26) * 1.2; } }
    else if (type === "pine") { add(new T.CylinderGeometry(0.3, 0.4, 2, 6), lam("#6a4a2a"), 0, 1, 0); add(new T.ConeGeometry(2.1 * s, 6 * s, 7), lam("#e6f4ff"), 0, 4.5 * s, 0); add(new T.ConeGeometry(1.5 * s, 4 * s, 7), lam("#cfe8f8"), 0, 7 * s, 0); }
    else if (type === "balloon") { add(new T.CylinderGeometry(0.06, 0.06, 5 * s, 4), lam("#555"), 0, 2.5 * s, 0); add(new T.SphereGeometry(1.6 * s, 10, 8), lam(["#ff5fa8", "#ffd23f", "#2fe0a8", "#a56bff", "#3d8bff"][Math.floor(rnd() * 5)]), 0, 6 * s, 0); }
    else if (type === "cactus") { add(new T.CylinderGeometry(0.6, 0.6, 5 * s, 8), lam("#4aa84a"), 0, 2.5 * s, 0); add(new T.CylinderGeometry(0.4, 0.4, 2.4, 6), lam("#4aa84a"), 1.2, 3.2 * s, 0).rotation.z = 0.8; }
    else if (type === "pipe") { add(new T.CylinderGeometry(1.6 * s, 1.6 * s, 8, 10), lam("#7a8a82"), 0, 3, 0).rotation.z = rnd() < 0.5 ? 0 : 1.57; }
    else { add(new T.CylinderGeometry(0.35, 0.5, 3 * s, 6), lam("#8a5a2a"), 0, 1.5 * s, 0); add(new T.SphereGeometry(2.3 * s, 8, 6), lam(["#3fb84a", "#56c858", "#2ea03e"][Math.floor(rnd() * 3)]), 0, 4.2 * s, 0); }
    return g;
  }
  function obstacleMesh(o) {
    const g = new T.Group(); const add = (geo, m, x, y, z) => { const q = new T.Mesh(geo, m); q.position.set(x || 0, y || 0, z || 0); g.add(q); return q; };
    if (o.kind === "pilier") add(new T.CylinderGeometry(o.r, o.r * 1.1, 5, 10), lam("#b8b2a6"), 0, 2, 0);
    else if (o.kind === "canard") { add(new T.SphereGeometry(o.r, 12, 10), lam("#ffe040"), 0, 0.6, 0).scale.set(1, 0.85, 1.3); add(new T.SphereGeometry(o.r * 0.55, 10, 8), lam("#ffe040"), 0, o.r * 0.9, o.r * 0.7); add(new T.ConeGeometry(0.4, 0.9, 6), lam("#ff8a1f"), 0, o.r * 0.85, o.r * 1.35).rotation.x = Math.PI / 2; [-1, 1].forEach((sd) => add(new T.SphereGeometry(0.16, 6, 5), bas("#111"), sd * 0.45, o.r * 1.1, o.r * 1.1)); }
    else if (o.kind === "bouee") { add(new T.SphereGeometry(o.r, 10, 8), lam("#ff4b3e"), 0, 0.3, 0); add(new T.TorusGeometry(o.r * 0.95, 0.18, 6, 14), lam("#ffffff"), 0, 0.3, 0).rotation.x = Math.PI / 2; }
    else { const q = add(new T.DodecahedronGeometry(o.r * 1.1, 0), lam("#8c8c96"), 0, o.r * 0.4, 0); q.scale.y = 0.85; q.rotation.set(o.id, o.id * 2, 0); }
    return g;
  }

  // ---------- bouées ----------
  const faceTex = {};
  function faceTexture(f) {
    if (faceTex[f]) return faceTex[f]; const cv = document.createElement("canvas"); cv.width = cv.height = 128; const x = cv.getContext("2d");
    x.fillStyle = "#ffcf9f"; x.fillRect(0, 0, 128, 128); x.fillStyle = "#222"; x.strokeStyle = "#222"; x.lineWidth = 6; x.lineCap = "round";
    const eye = (cx, cy, r) => { x.beginPath(); x.arc(cx, cy, r, 0, 7); x.fill(); };
    if (f === 5) { x.beginPath(); x.moveTo(34, 54); x.lineTo(54, 54); x.moveTo(76, 54); x.lineTo(96, 54); x.stroke(); } else { eye(46, 54, f === 2 ? 9 : 6); eye(84, 54, f === 2 ? 9 : 6); }
    if (f === 1) { x.beginPath(); x.moveTo(34, 40); x.lineTo(58, 46); x.moveTo(96, 40); x.lineTo(72, 46); x.stroke(); }
    if (f === 4) { x.beginPath(); x.moveTo(32, 36); x.lineTo(58, 46); x.moveTo(98, 36); x.lineTo(72, 46); x.stroke(); }
    if (f === 6) { x.lineWidth = 5; x.strokeRect(30, 40, 32, 28); x.strokeRect(68, 40, 32, 28); x.beginPath(); x.moveTo(62, 52); x.lineTo(68, 52); x.stroke(); }
    if (f === 7) { x.fillRect(42, 82, 46, 9); }
    x.beginPath(); if (f === 2) { x.arc(65, 92, 9, 0, 7); x.stroke(); } else if (f === 3) { x.moveTo(44, 88); x.quadraticCurveTo(70, 112, 96, 84); x.stroke(); } else if (f === 4) { x.moveTo(46, 98); x.quadraticCurveTo(65, 84, 84, 98); x.stroke(); } else if (f !== 7) { x.moveTo(46, 90); x.quadraticCurveTo(65, 104, 84, 90); x.stroke(); }
    const t = new T.CanvasTexture(cv); faceTex[f] = t; return t;
  }
  function hatMesh(h, colr) {
    const g = new T.Group(); const add = (geo, m, x, y, z) => { const q = new T.Mesh(geo, m); q.position.set(x || 0, y || 0, z || 0); g.add(q); return q; };
    switch (h) {
      case 1: add(new T.SphereGeometry(0.46, 10, 6, 0, 6.28, 0, 1.57), lam(colr), 0, 0.05, 0); add(new T.BoxGeometry(0.5, 0.05, 0.4), lam(colr), 0, 0.03, 0.4); break;
      case 2: add(new T.CylinderGeometry(0.4, 0.34, 0.3, 5), lam("#ffd23f"), 0, 0.15, 0); break;
      case 3: add(new T.ConeGeometry(0.34, 0.8, 8), lam("#ff5fa8"), 0, 0.4, 0); add(new T.SphereGeometry(0.1, 6, 5), lam("#ffd23f"), 0, 0.82, 0); break;
      case 4: add(new T.CylinderGeometry(0.5, 0.5, 0.05, 12), lam("#222"), 0, 0.02, 0); add(new T.CylinderGeometry(0.32, 0.32, 0.55, 12), lam("#222"), 0, 0.3, 0); break;
      case 5: [-1, 1].forEach((sd) => { const c = add(new T.ConeGeometry(0.1, 0.45, 6), lam("#e8e0d0"), sd * 0.34, 0.25, 0); c.rotation.z = -sd * 0.5; }); break;
      case 6: add(new T.TorusGeometry(0.34, 0.05, 6, 16), bas("#fff2a8"), 0, 0.55, 0).rotation.x = Math.PI / 2; break;
      case 7: add(new T.CylinderGeometry(0.03, 0.03, 0.3, 4), lam("#555"), 0, 0.15, 0); { const p = add(new T.BoxGeometry(0.9, 0.03, 0.12), lam("#3d8bff"), 0, 0.32, 0); p.userData.spin = 1; } break;
      case 8: add(new T.CylinderGeometry(0.4, 0.34, 0.5, 10), lam("#ffffff"), 0, 0.3, 0); add(new T.SphereGeometry(0.4, 10, 6), lam("#ffffff"), 0, 0.58, 0); break;
      case 9: add(new T.SphereGeometry(0.46, 10, 6, 0, 6.28, 0, 1.57), lam("#222"), 0, 0.05, 0); add(new T.BoxGeometry(0.9, 0.05, 0.2), lam("#222"), 0, 0.1, 0); break;
      case 10: for (let k = 0; k < 5; k++) add(new T.SphereGeometry(0.1, 6, 5), lam("#ff5fa8"), Math.sin(k * 1.256) * 0.17, 0.5 + 0.0, Math.cos(k * 1.256) * 0.17); add(new T.SphereGeometry(0.08, 6, 5), lam("#ffd23f"), 0, 0.5, 0); break;
      case 11: add(new T.SphereGeometry(0.47, 10, 6, 0, 6.28, 0, 1.4), lam("#e04040"), 0, 0.03, 0); break;
      default: break;
    }
    return g;
  }
  function characterMesh(look, hex) {
    const g = new T.Group(); g.scale.setScalar(1.3);
    const body = new T.Mesh(new T.CylinderGeometry(0.34, 0.42, 0.7, 10), lam(hex)); body.position.y = 0.42; g.add(body);
    const head = new T.Mesh(new T.SphereGeometry(0.4, 12, 10), new T.MeshLambertMaterial({ map: faceTexture(look.face | 0) })); head.position.set(0, 1.1, 0); head.rotation.y = -1.57; g.add(head);
    const hat = hatMesh(look.hat | 0, hex); hat.position.set(0, 1.45, 0); g.add(hat); g.userData.hat = hat;
    [-1, 1].forEach((sd) => { const arm = new T.Mesh(new T.CylinderGeometry(0.09, 0.09, 0.55, 6), lam("#ffcf9f")); arm.position.set(sd * 0.42, 0.55, 0.12); arm.rotation.x = 0.8; g.add(arm); });
    g.userData.head = head; return g;
  }
  // crews : [{ id, seats:[pid], looks:{pid:{hat,face,hex}} , hex }]
  S.setBoats = function (crews, looks) {
    clearGroup(boatG); boats = {};
    crews.forEach((c) => {
      const root = new T.Group(); const inner = new T.Group(); root.add(inner);
      const ring = new T.Mesh(new T.TorusGeometry(1.4, 0.5, 10, 24), lam(c.hex)); ring.rotation.x = Math.PI / 2; inner.add(ring);
      const stripe = new T.Mesh(new T.TorusGeometry(1.4, 0.505, 4, 24, 0.5), lam("#ffffff")); stripe.rotation.x = Math.PI / 2; inner.add(stripe);
      const disc = new T.Mesh(new T.CylinderGeometry(1.0, 1.0, 0.1, 16), lam("#3a9ad8")); disc.position.y = -0.1; inner.add(disc);
      const chars = []; const arrows = [];
      c.seats.forEach((pid, k) => {
        const lk = looks[pid] || { hat: 0, face: 0, hex: "#ffffff" }; const ch = characterMesh(lk, lk.hex); const [sx, sz] = seatPos(c.seats.length, k); ch.position.set(sx, 0.2, sz); inner.add(ch);
        const ar = new T.Mesh(new T.ConeGeometry(0.28, 1.2, 8), bas(lk.hex, { transparent: true, opacity: 0.8 })); ar.visible = false; fxG.add(ar);
        chars.push({ pid, ch, k, sx, sz, ar, pushing: 0, a: 0 });
      });
      boatG.add(root); boats[c.id] = { root, inner, chars, ring, y: 0, roll: 0, flip: 0, last: null, idx: undefined, hex: c.hex, n: c.seats.length };
    });
  };
  S.removeArrows = function () { Object.values(boats).forEach((b) => b.chars.forEach((c) => fxG.remove(c.ar))); };

  // ---------- particules ----------
  function emit(x, y, z, o) {
    const p = pool[poolI]; poolI = (poolI + 1) % pool.length; p.m.visible = true; p.m.position.set(x, y, z); p.m.material.color.set(o.c); p.m.material.opacity = o.o || 0.7;
    p.life = p.max = o.life || 0.8; p.vx = o.vx || 0; p.vy = o.vy || 0; p.vz = o.vz || 0; p.g = o.g || 0; p.grow = o.grow || 1; p.s0 = o.s || 1; p.m.scale.setScalar(p.s0); p.o0 = o.o || 0.7;
  }
  S.fart = function (x, y, z, wx, wz, big) { const sp = 2 + Math.random() * 2; emit(x, y + 0.5, z, { c: ["#c8e86a", "#e0f08a", "#a8d84a"][Math.floor(Math.random() * 3)], vx: -wx * sp + (Math.random() - 0.5), vy: 0.4 + Math.random() * 0.6, vz: -wz * sp + (Math.random() - 0.5), life: 0.7 + Math.random() * 0.4, grow: 2.4, s: big ? 0.9 : 0.5, o: 0.6 }); };
  S.splash = function (x, y, z, n) { for (let i = 0; i < (n || 10); i++) emit(x, y + 0.3, z, { c: "#ffffff", vx: (Math.random() - 0.5) * 7, vy: 3 + Math.random() * 4, vz: (Math.random() - 0.5) * 7, g: 14, life: 0.7, s: 0.3, o: 0.85 }); };
  S.sparkle = function (x, y, z) { for (let i = 0; i < 8; i++) emit(x, y, z, { c: "#ffe266", vx: (Math.random() - 0.5) * 5, vy: 2 + Math.random() * 3, vz: (Math.random() - 0.5) * 5, g: 8, life: 0.6, s: 0.25, o: 1 }); };
  S.confetti = function (x, y, z) { for (let i = 0; i < 24; i++) emit(x, y + 2, z, { c: ["#ff5fa8", "#ffd23f", "#2fe0a8", "#3d8bff", "#ffffff"][i % 5], vx: (Math.random() - 0.5) * 12, vy: 4 + Math.random() * 6, vz: (Math.random() - 0.5) * 12, g: 9, life: 1.4, s: 0.3, o: 1 }); };
  S.shake = function (v) { shake = Math.max(shake, v); };
  S.hideCoin = function (i, sparkle) { const m = coinMeshes[i]; if (m && m.visible) { m.visible = false; if (sparkle) S.sparkle(m.position.x, m.position.y, m.position.z); } };
  S.showAllCoins = function () { coinMeshes.forEach((m) => { m.visible = true; }); };

  // projection d'un point de l'écran sur le plan de l'eau
  const ray = new T.Raycaster(), plane = new T.Plane(new T.Vector3(0, 1, 0), 0), hit = new T.Vector3(), v2 = new T.Vector2();
  S.pick = function (cx, cy, planeY) {
    if (!canvas) return null; const r = canvas.getBoundingClientRect(); v2.set(((cx - r.left) / r.width) * 2 - 1, -((cy - r.top) / r.height) * 2 + 1);
    ray.setFromCamera(v2, camera); plane.constant = -planeY; return ray.ray.intersectPlane(plane, hit) ? [hit.x, hit.z] : null;
  };
  S.boatPos = function (id) { const b = boats[id]; return b && b.last ? { x: b.last.x, z: b.last.z, y: b.y, yaw: b.last.yaw } : null; };

  // ---------- image ----------
  // fr : { t, dt, boats:[{id,x,z,yaw,lean,y,flags,hp,...}], pl:{pid:{a,p,tank}}, follow, mine }
  S.draw = function (fr) {
    if (!renderer) return; PicuiteGL.frame(() => {
      clock += fr.dt || 0.016; const dt = Math.min(0.05, fr.dt || 0.016);
      obsMeshes.forEach((q) => { const p = WRL.obsPos(q.o, fr.t); const h = WRL.nearest(level, p[0], p[1]).h; q.m.position.set(p[0], h + 0.4 + Math.sin(clock * 2 + q.o.id) * 0.08, p[1]); if (q.o.kind === "canard") q.m.rotation.y = Math.cos(fr.t * q.o.mv.f + q.o.mv.ph) > 0 ? Math.atan2(q.o.mv.ax, q.o.mv.az) : Math.atan2(-q.o.mv.ax, -q.o.mv.az); });
      coinMeshes.forEach((m, i) => { if (m.visible) { m.rotation.y = clock * 3 + i; m.position.y = m.userData.y + Math.sin(clock * 3 + i) * 0.18; } });
      if (tex) tex.offset.y -= dt * 0.35;
      let follow = null;
      (fr.boats || []).forEach((b) => {
        const o = boats[b.id]; if (!o) return; const near = WRL.nearest(level, b.x, b.z, o.idx); o.idx = near.i; const hy = near.h; const cap = (b.flags & 1) ? 1 : 0; const air = (b.flags & 2) ? 1 : 0;
        o.last = b; o.root.position.set(b.x, hy + 0.35 + b.y, b.z); o.root.rotation.y = b.yaw;
        o.flip += ((cap ? 1 : 0) - o.flip) * Math.min(1, dt * 6); o.inner.rotation.z = b.lean * 0.55 + o.flip * Math.PI; o.inner.position.y = o.flip * 0.4 - 0.1 + Math.sin(clock * 3 + b.id) * 0.04;
        o.inner.rotation.x = air ? -0.25 : 0; o.y = hy + b.y; o.near = near;
        o.chars.forEach((c) => {
          const st = fr.pl && fr.pl[c.pid]; if (!st) return; c.a += ((st.a - c.a + 3 * Math.PI) % (2 * Math.PI) - Math.PI) * Math.min(1, dt * 14);
          c.ch.rotation.y = c.a; c.ch.rotation.x = st.p ? 0.35 : 0; const hat = c.ch.userData.hat; if (hat) hat.children.forEach((q) => { if (q.userData.spin) q.rotation.y += dt * (st.p ? 30 : 4); });
          c.ch.userData.head.rotation.z = Math.sin(clock * 2 + c.k) * 0.05;
          const wa = c.a + b.yaw; const wx = Math.sin(wa), wz = Math.cos(wa);
          if (st.p && !cap && !air) { c.pushing += dt; if (c.pushing > 0.045) { c.pushing = 0; const cs = Math.cos(b.yaw), sn = Math.sin(b.yaw); const px = b.x + c.sx * cs + c.sz * sn, pz = b.z - c.sx * sn + c.sz * cs; S.fart(px, hy + 0.8 + b.y, pz, wx, wz, st.press > 0.8); } }
          c.ar.visible = !!fr.showArrows && c.pid === fr.me; if (c.ar.visible) { const sc = 0.8 + (st.p ? 0.5 : 0); c.ar.position.set(b.x + wx * 3.2, hy + 1.2 + b.y, b.z + wz * 3.2); c.ar.rotation.set(Math.PI / 2, 0, 0); c.ar.rotation.order = "YXZ"; c.ar.rotation.y = wa; c.ar.scale.set(sc, sc, sc); }
        });
        if (b.id === fr.follow) follow = { b, near, hy };
      });
      // caméra
      if (follow) {
        const b = follow.b, n = follow.near; const sp = Math.hypot(b.vx || 0, b.vz || 0); const back = 10.5 + Math.min(4, sp * 0.2);
        const want = new T.Vector3(b.x - n.tx * back, follow.hy + 8.6 + (b.y || 0) * 0.5, b.z - n.tz * back);
        const lookW = new T.Vector3(b.x + n.tx * 7, follow.hy + 0.5, b.z + n.tz * 7);
        if (!camInit) { camPos.copy(want); camLook.copy(lookW); camInit = true; }
        const k = 1 - Math.pow(0.0015, dt); camPos.lerp(want, k); camLook.lerp(lookW, k);
        camera.position.copy(camPos); if (shake > 0.01) { camera.position.x += (Math.random() - 0.5) * shake; camera.position.y += (Math.random() - 0.5) * shake; shake *= 0.88; } camera.lookAt(camLook);
        camera.fov = 58 + Math.min(10, sp * 0.35); camera.updateProjectionMatrix();
        sunL.position.set(b.x + 30, follow.hy + 50, b.z + 20); sunL.target.position.set(b.x, follow.hy, b.z); sunL.target.updateMatrixWorld();
      } else if (!camInit && level) { const p = WRL.pointAt(level, 14); camera.position.set(p.x - p.tx * 14, p.h + 12, p.z - p.tz * 14); camera.lookAt(p.x + p.tx * 8, p.h, p.z + p.tz * 8); }
      // particules
      pool.forEach((p) => { if (p.life <= 0) return; p.life -= dt; if (p.life <= 0) { p.m.visible = false; return; } p.vy -= p.g * dt; p.m.position.x += p.vx * dt; p.m.position.y += p.vy * dt; p.m.position.z += p.vz * dt; const u = 1 - p.life / p.max; p.m.scale.setScalar(p.s0 * (1 + (p.grow - 1) * u)); p.m.material.opacity = p.o0 * (1 - u); });
      renderer.render(scene, camera); PicuiteGL.verify(renderer);
    });
  };
  S.setVisible = function (v) { if (host) host.style.display = v ? "block" : "none"; if (v) S.resize(); };
  S.dispose = function () { clearGroup(lvG); clearGroup(boatG); boats = {}; };
  window.FTScene = S;
})();

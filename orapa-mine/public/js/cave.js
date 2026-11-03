// ============================================================
// ORAPA MINE — Grotte en 3D (three.js)
// Un décor de grotte, les pierres lumineuses et les rayons animés.
// L'interaction se fait dans le carnet 2D, la grotte sert à voir la lumière vivre.
// ============================================================
(function () {
  const T = THREE;
  const HEX = { 1: "#ff3b4e", 2: "#3b7bff", 4: "#ffd23f", 3: "#b04dff", 5: "#ff8a1f", 6: "#2fd66b", 7: "#ffffff" };
  const Cave = { ready: false };
  let renderer, scene, camera, host, canvas, board = null, gemGroup = null, rayGroup = null, rocks = null, dust = null, W = 8, H = 8, time = 0, rays = [], drag = null, yaw = 0, pitch = 0.9;
  const col = (h) => new T.Color(h);
  const mats = {};
  const mat = (c, o) => { const k = c + JSON.stringify(o || {}); if (!mats[k]) mats[k] = new T.MeshLambertMaterial(Object.assign({ color: col(c) }, o || {})); return mats[k]; };
  const basic = (c, o) => new T.MeshBasicMaterial(Object.assign({ color: col(c) }, o || {}));

  Cave.init = function (container) {
    host = container; canvas = document.createElement("canvas"); canvas.className = "om-canvas"; host.appendChild(canvas);
    try { renderer = PicuiteGL.create(T, canvas, "medium"); PicuiteGL.watch(canvas); } catch (e) { host.classList.add("hidden"); return; }
    renderer.setClearColor(0x070a1c, 1); renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.5));
    scene = new T.Scene(); scene.fog = new T.Fog(0x070a1c, 14, 38);
    camera = new T.PerspectiveCamera(48, 1, 0.1, 80);
    scene.add(new T.HemisphereLight(0x8da8ff, 0x1a1030, 0.85));
    const pl = new T.PointLight(0xffd8a0, 0.9, 40); pl.position.set(0, 9, 4); scene.add(pl);
    gemGroup = new T.Group(); rayGroup = new T.Group(); scene.add(gemGroup); scene.add(rayGroup);
    // poussière lumineuse
    const n = 90, g = new T.BufferGeometry(), pos = new Float32Array(n * 3); for (let i = 0; i < n; i++) { pos[i * 3] = (Math.random() - 0.5) * 24; pos[i * 3 + 1] = Math.random() * 9; pos[i * 3 + 2] = (Math.random() - 0.5) * 24; }
    g.setAttribute("position", new T.BufferAttribute(pos, 3)); dust = new T.Points(g, new T.PointsMaterial({ color: 0x9fb8ff, size: 0.12 })); scene.add(dust);
    canvas.addEventListener("pointerdown", (e) => { drag = { x: e.clientX, y: e.clientY, yaw, pitch }; canvas.setPointerCapture(e.pointerId); });
    canvas.addEventListener("pointermove", (e) => { if (!drag) return; yaw = Math.max(-0.9, Math.min(0.9, drag.yaw + (e.clientX - drag.x) * 0.006)); pitch = Math.max(0.35, Math.min(1.35, drag.pitch + (e.clientY - drag.y) * 0.005)); });
    canvas.addEventListener("pointerup", () => { drag = null; });
    window.addEventListener("resize", Cave.resize); Cave.setBoard(8, 8); Cave.resize(); Cave.ready = true; requestAnimationFrame(loop);
  };
  Cave.resize = function () { if (!renderer || !host) return; const w = host.clientWidth || 300, h = host.clientHeight || 200; renderer.setSize(w, h, false); camera.aspect = w / h; camera.updateProjectionMatrix(); };
  function clear(g) { while (g.children.length) { const c = g.children.pop(); if (c.geometry) c.geometry.dispose(); } }
  Cave.setBoard = function (w, h) {
    if (!scene) return; W = w; H = h; if (board) { scene.remove(board); clear(board); } board = new T.Group();
    const floor = new T.Mesh(new T.BoxGeometry(W + 0.4, 0.3, H + 0.4), mat("#1b2142")); floor.position.set(0, -0.2, 0); board.add(floor);
    for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) { const t = new T.Mesh(new T.BoxGeometry(0.94, 0.06, 0.94), mat((x + y) % 2 ? "#2a3466" : "#232b58")); t.position.set(x - W / 2 + 0.5, -0.02, y - H / 2 + 0.5); board.add(t); }
    // parois de roche et stalactites
    const rk = mat("#2b2a44", { flatShading: true });
    for (let i = 0; i < 26; i++) { const a = (i / 26) * Math.PI * 2; const r = Math.max(W, H) * 0.95 + 2 + Math.random() * 2; const m = new T.Mesh(new T.DodecahedronGeometry(1.1 + Math.random() * 1.6, 0), rk); m.position.set(Math.cos(a) * r * (W / Math.max(W, H)) * 1.15, 0.6 + Math.random() * 1.2, Math.sin(a) * r * (H / Math.max(W, H)) * 1.15); m.rotation.set(Math.random() * 3, Math.random() * 3, 0); board.add(m); }
    for (let i = 0; i < 16; i++) { const c = new T.Mesh(new T.ConeGeometry(0.35 + Math.random() * 0.4, 2 + Math.random() * 2.5, 6), rk); c.rotation.x = Math.PI; c.position.set((Math.random() - 0.5) * (W + 10), 8.5, (Math.random() - 0.5) * (H + 10)); board.add(c); }
    // cristaux décoratifs sur le bord
    for (let i = 0; i < 10; i++) { const c = new T.Mesh(new T.OctahedronGeometry(0.25 + Math.random() * 0.25), basic(["#6ad4ff", "#c58bff", "#7affb2"][i % 3], { transparent: true, opacity: 0.8 })); c.position.set((Math.random() < 0.5 ? -1 : 1) * (W / 2 + 0.6 + Math.random()), 0.25, (Math.random() - 0.5) * H); board.add(c); }
    scene.add(board); Cave.clearRays(); Cave.setGems(null);
  };
  const cx = (x) => x - W / 2 + 0.5, cz = (y) => y - H / 2 + 0.5;
  function gemCell(gm, x, y) {
    const g = new T.Group(); g.position.set(cx(x), 0, cz(y));
    if (gm.k === "filter") { const c = HEX[gm.m] || "#fff"; const m = new T.Mesh(new T.BoxGeometry(0.86, 0.7, 0.86), basic(c, { transparent: true, opacity: 0.55 })); m.position.y = 0.38; g.add(m); const e = new T.Mesh(new T.BoxGeometry(0.5, 0.45, 0.5), basic(c, { transparent: true, opacity: 0.9 })); e.position.y = 0.38; g.add(e); }
    else if (gm.k === "mirror") { const m = new T.Mesh(new T.BoxGeometry(1.15, 0.8, 0.08), mat("#dfe8ff", { emissive: col("#5a6aa0") })); m.position.y = 0.42; m.rotation.y = gm.d ? Math.PI / 4 : -Math.PI / 4; g.add(m); }
    else if (gm.k === "obsidian") { const m = new T.Mesh(new T.DodecahedronGeometry(0.46, 0), mat("#0a0a12", { emissive: col("#241a40") })); m.position.y = 0.45; g.add(m); }
    else if (gm.k === "prism") { const m = new T.Mesh(new T.CylinderGeometry(0.42, 0.42, 0.8, 3), basic("#e8f6ff", { transparent: true, opacity: 0.7 })); m.position.y = 0.42; g.add(m); }
    else if (gm.k === "splitter") { const m = new T.Mesh(new T.OctahedronGeometry(0.5, 0), basic("#8ff4ff", { transparent: true, opacity: 0.75 })); m.position.y = 0.55; m.rotation.y = gm.d ? Math.PI / 4 : -Math.PI / 4; g.add(m); const l = new T.Mesh(new T.BoxGeometry(1.1, 0.04, 0.05), basic("#ffffff")); l.position.y = 0.55; l.rotation.y = gm.d ? Math.PI / 4 : -Math.PI / 4; g.add(l); }
    else if (gm.k === "tint") { const c = HEX[gm.m] || "#fff"; const m = new T.Mesh(new T.SphereGeometry(0.42, 12, 10), basic(c, { transparent: true, opacity: 0.8 })); m.position.y = 0.45; g.add(m); const r = new T.Mesh(new T.TorusGeometry(0.46, 0.05, 6, 16), basic("#ffffff")); r.rotation.x = Math.PI / 2; r.position.y = 0.45; g.add(r); }
    return g;
  }
  Cave.setGems = function (gems) {
    if (!scene) return; clear(gemGroup); if (!gems) return;
    gems.forEach((gm) => gm.cells.forEach(([dx, dy]) => gemGroup.add(gemCell(gm, gm.x + dx, gm.y + dy))));
  };
  Cave.clearRays = function () { if (!scene) return; clear(rayGroup); rays = []; };
  // un rayon est une suite de points en coordonnées de cases, dessinée peu à peu
  Cave.fire = function (pts, mask, opts) {
    if (!scene || pts.length < 2) return; const color = HEX[mask] || "#fff"; const t0 = time + ((opts && opts.delay) || 0); let len = 0; const segs = [];
    for (let i = 1; i < pts.length; i++) { const a = pts[i - 1], b = pts[i]; const l = Math.hypot(b[0] - a[0], b[1] - a[1]); segs.push({ a, b, l, s: len }); len += l; }
    segs.forEach((sg) => {
      const m = new T.Mesh(new T.CylinderGeometry(0.06, 0.06, 1, 6), basic(color)); m.visible = false; rayGroup.add(m);
      const halo = new T.Mesh(new T.CylinderGeometry(0.16, 0.16, 1, 6), basic(color, { transparent: true, opacity: 0.25 })); halo.visible = false; rayGroup.add(halo);
      rays.push({ m, halo, sg, t0, speed: 14, fade: (opts && opts.fade) || 0 });
    });
  };
  function loop(now) {
    requestAnimationFrame(loop); time = now / 1000;
    PicuiteGL.frame(() => {
      if (!renderer || host.classList.contains("hidden")) return;
      const R = Math.max(W, H) * 1.25 + 3; const a = yaw + Math.sin(time * 0.15) * 0.12;
      camera.position.set(Math.sin(a) * R * Math.cos(pitch) * 0.9, Math.sin(pitch) * R * 0.85 + 1, Math.cos(a) * R * Math.cos(pitch) * 0.9 + 1.5); camera.lookAt(0, 0, 0);
      for (const r of rays) {
        const tt = (time - r.t0) * r.speed - r.sg.s; const k = Math.max(0, Math.min(1, tt / r.sg.l));
        const ax = cx(r.sg.a[0]), az = cz(r.sg.a[1]), bx = cx(r.sg.b[0]), bz = cz(r.sg.b[1]); const ex = ax + (bx - ax) * k, ez = az + (bz - az) * k; const d = Math.hypot(ex - ax, ez - az);
        const vis = k > 0 && d > 0.001; r.m.visible = vis; r.halo.visible = vis; if (!vis) continue;
        const mx = (ax + ex) / 2, mz = (az + ez) / 2; [r.m, r.halo].forEach((m) => { m.position.set(mx, 0.45, mz); m.scale.set(1, d, 1); m.rotation.set(Math.PI / 2, 0, -Math.atan2(ez - az, ex - ax) + Math.PI / 2 * 0); m.rotation.order = "YXZ"; m.rotation.y = 0; m.quaternion.setFromUnitVectors(new T.Vector3(0, 1, 0), new T.Vector3(ex - ax, 0, ez - az).normalize()); });
        const age = time - r.t0 - (r.sg.s + r.sg.l) / r.speed; if (r.fade && age > 0) { const o = Math.max(0, 1 - age / r.fade); r.m.material.opacity = o; r.m.material.transparent = true; r.halo.visible = o > 0.1; r.m.visible = o > 0.02; }
      }
      if (dust) { const p = dust.geometry.attributes.position; for (let i = 0; i < p.count; i++) { let y = p.getY(i) + 0.004; if (y > 9) y = 0; p.setY(i, y); } p.needsUpdate = true; }
      renderer.render(scene, camera); PicuiteGL.verify(renderer);
    });
  }
  window.OMCave = Cave;
})();

// ============================================================
// BUS BAZAR — Le monde autour du bus, route, décor, obstacles, météo
// ============================================================
const BBWorld = (function () {
  const T = THREE; const P = BBPeople; const lam = P.lam; const G = P.geo;
  const GROUND = ["#69a84f", "#d9b46a", "#eef3f8", "#7f8c78", "#c9c07a"];
  const SURFC = ["#3b3d44", "#a8946c", "#6b4f35", "#cfe4f2"];
  const SKY = [["#4aa3e8", "#d3ecff"], ["#6c7a8a", "#b8c2cb"], ["#aab4bb", "#c9d0d4"], ["#2e3347", "#656d82"], ["#62b0ea", "#d8ecf8"]];
  const FOG = [[70, 320], [30, 190], [12, 95], [22, 140], [55, 260]];
  const hex = (c) => new T.Color(c);

  function build(scene, init, host) {
    const R = BBRoad.make(init.seed, { legs: init.legs, difficulty: init.difficulty, biomes: init.biomes, traffic: init.traffic, weather: init.weather });
    const W = { R, group: new T.Group(), obst: {}, props: [], t: 0, wx: 0, rainAmt: 0, sky: { c0: hex(SKY[0][0]), c1: hex(SKY[0][1]), t0: hex(SKY[0][0]), t1: hex(SKY[0][1]), fogN: 70, fogF: 320, dirty: true } };
    scene.add(W.group);
    scene.fog = new T.Fog(hex(SKY[0][1]), 70, 320);
    // fond du ciel en dégradé
    W.skyCv = document.createElement("canvas"); W.skyCv.width = 4; W.skyCv.height = 128; W.skyTex = new T.CanvasTexture(W.skyCv); W.skyTex.generateMipmaps = false; W.skyTex.minFilter = T.LinearFilter; W.skyTex.magFilter = T.LinearFilter; scene.background = W.skyTex;
    if (host) host.style.background = SKY[0][1];
    // lumières
    W.hemi = new T.HemisphereLight(0xdff0ff, 0x6a5d4a, 0.85); scene.add(W.hemi);
    W.sun = new T.DirectionalLight(0xfff2d0, 0.75); W.sun.position.set(40, 70, -20); scene.add(W.sun); scene.add(W.sun.target);
    // route
    const step = 2; const n = Math.floor(R.len / step); const pos = [], col = [], idx = [];
    const ribbon = (o0, o1, y, colFn) => { const base = pos.length / 3; for (let i = 0; i <= n; i++) { const a = R.at(i * step); const nx = Math.cos(a.th), nz = -Math.sin(a.th); const c = colFn(a, i); [o0, o1].forEach((o) => { pos.push(a.px + nx * o, y, a.pz + nz * o); col.push(c.r, c.g, c.b); }); } for (let i = 0; i < n; i++) { const k = base + i * 2; idx.push(k, k + 1, k + 2, k + 1, k + 3, k + 2); } };
    const gcol = (a) => hex(GROUND[a.bio]);
    ribbon(-170, -R.half - 3, 0, (a) => gcol(a).multiplyScalar(0.96)); ribbon(R.half + 3, 170, 0, (a) => gcol(a).multiplyScalar(0.96));
    ribbon(-R.half - 3, -R.half, 0.01, (a) => hex("#9c8e6e")); ribbon(R.half, R.half + 3, 0.01, (a) => hex("#9c8e6e"));
    ribbon(-R.half, R.half, 0.03, (a) => hex(SURFC[a.surf]));
    ribbon(-R.half + 0.25, -R.half + 0.5, 0.04, () => hex("#f4f4f4")); ribbon(R.half - 0.5, R.half - 0.25, 0.04, () => hex("#f4f4f4"));
    const g = new T.BufferGeometry(); g.setAttribute("position", new T.Float32BufferAttribute(pos, 3)); g.setAttribute("color", new T.Float32BufferAttribute(col, 3)); g.setIndex(idx); g.computeVertexNormals();
    const rm = new T.Mesh(g, new T.MeshLambertMaterial({ vertexColors: true, side: T.DoubleSide })); W.group.add(rm);
    // pointillés du milieu
    const dp = [], di = []; for (let s = 0; s < R.len - 6; s += 9) { const a = R.at(s), b = R.at(s + 4); const na = [Math.cos(a.th), -Math.sin(a.th)], nb = [Math.cos(b.th), -Math.sin(b.th)]; const k = dp.length / 3; dp.push(a.px - na[0] * 0.1, 0.045, a.pz - na[1] * 0.1, a.px + na[0] * 0.1, 0.045, a.pz + na[1] * 0.1, b.px - nb[0] * 0.1, 0.045, b.pz - nb[1] * 0.1, b.px + nb[0] * 0.1, 0.045, b.pz + nb[1] * 0.1); di.push(k, k + 1, k + 2, k + 1, k + 3, k + 2); }
    const dg = new T.BufferGeometry(); dg.setAttribute("position", new T.Float32BufferAttribute(dp, 3)); dg.setIndex(di); dg.computeVertexNormals(); W.group.add(new T.Mesh(dg, new T.MeshBasicMaterial({ color: 0xf2f2f2, side: T.DoubleSide })));
    // décor, instances
    const rng = BBRoad.rngOf(init.seed + "|decor"); const lists = {};
    const add = (kind, x, z, sc, rot) => { (lists[kind] = lists[kind] || []).push([x, z, sc, rot]); };
    for (let s = 12; s < R.len; s += 9 + rng() * 12) {
      const a = R.at(s); const nx = Math.cos(a.th), nz = -Math.sin(a.th); const b = BBRoad.BIOMES[a.bio].id;
      [-1, 1].forEach((sd) => {
        const off = R.half + 6 + rng() * (rng() < 0.3 ? 14 : 60); const x = a.px + nx * off * sd, z = a.pz + nz * off * sd; const r = rng(); const sc = 0.8 + rng() * 0.9; const rot = rng() * 6.28;
        if (b === "campagne") add(r < 0.62 ? "tree" : r < 0.74 ? "hay" : r < 0.82 ? "house" : "rock", x, z, sc, rot);
        else if (b === "desert") add(r < 0.5 ? "cactus" : "rock", x, z, sc, rot);
        else if (b === "neige") add(r < 0.72 ? "pine" : "rock", x, z, sc, rot);
        else if (b === "ville") { if (r < 0.55) add("house", x, z, sc, rot); else if (r < 0.8) { const o2 = R.half + 4.2; add("lamp", a.px + nx * o2 * sd, a.pz + nz * o2 * sd, 1, rot); } else add("tree", x, z, sc * 0.8, rot); }
        else add(r < 0.35 ? "tree" : r < 0.8 ? "rock" : "lamp", x, z, sc, rot);
      });
    }
    const dummy = new T.Object3D();
    const inst = (geo, mat, list, place, colorFn) => { if (!list || !list.length) return; const m = new T.InstancedMesh(geo, mat, list.length); list.forEach((e, i) => { place(dummy, e); dummy.updateMatrix(); m.setMatrixAt(i, dummy.matrix); if (colorFn) m.setColorAt(i, colorFn(e, i)); }); m.instanceMatrix.needsUpdate = true; if (m.instanceColor) m.instanceColor.needsUpdate = true; W.group.add(m); };
    const on = (y, sy, h) => (d, e) => { d.position.set(e[0], y * e[2], e[1]); d.rotation.set(0, e[3], 0); d.scale.set(e[2] * sy, e[2] * h, e[2] * sy); };
    const gt = (c) => lam(c);
    inst(G.cyl, gt("#7a4f2a"), lists.tree, (d, e) => { d.position.set(e[0], 1.2 * e[2], e[1]); d.rotation.set(0, e[3], 0); d.scale.set(0.3 * e[2], 2.4 * e[2], 0.3 * e[2]); });
    inst(G.cone, gt("#ffffff"), lists.tree, (d, e) => { d.position.set(e[0], 4.0 * e[2], e[1]); d.rotation.set(0, e[3], 0); d.scale.set(1.9 * e[2], 3.6 * e[2], 1.9 * e[2]); }, (e, i) => hex(["#2f9a45", "#3fb25a", "#5ab04a", "#8a9a3a"][i % 4]));
    inst(G.cyl, gt("#6a4a2a"), lists.pine, (d, e) => { d.position.set(e[0], 0.8 * e[2], e[1]); d.scale.set(0.25 * e[2], 1.6 * e[2], 0.25 * e[2]); d.rotation.set(0, 0, 0); });
    inst(G.cone, gt("#ffffff"), lists.pine, (d, e) => { d.position.set(e[0], 3.4 * e[2], e[1]); d.rotation.set(0, e[3], 0); d.scale.set(1.5 * e[2], 4.6 * e[2], 1.5 * e[2]); }, (e, i) => hex(i % 3 ? "#2a6f4a" : "#e9f2ee"));
    inst(G.cyl, gt("#3a9a50"), lists.cactus, (d, e) => { d.position.set(e[0], 1.3 * e[2], e[1]); d.rotation.set(0, 0, 0); d.scale.set(0.38 * e[2], 2.6 * e[2], 0.38 * e[2]); });
    inst(G.cyl, gt("#3a9a50"), lists.cactus, (d, e) => { d.position.set(e[0] + 0.55 * e[2], 1.7 * e[2], e[1]); d.rotation.set(0, 0, 0); d.scale.set(0.2 * e[2], 1.1 * e[2], 0.2 * e[2]); });
    inst(new T.DodecahedronGeometry(1, 0), gt("#8a8f96"), lists.rock, (d, e) => { d.position.set(e[0], 0.5 * e[2], e[1]); d.rotation.set(0, e[3], 0); d.scale.set(1.5 * e[2], 1.0 * e[2], 1.2 * e[2]); }, (e, i) => hex(["#8a8f96", "#767b84", "#a09a8e"][i % 3]));
    inst(G.cyl, gt("#d9b84a"), lists.hay, (d, e) => { d.position.set(e[0], 0.8 * e[2], e[1]); d.rotation.set(0, e[3], Math.PI / 2); d.scale.set(0.8 * e[2], 1.4 * e[2], 0.8 * e[2]); });
    inst(G.box, gt("#ffffff"), lists.house, (d, e) => { d.position.set(e[0], 2 * e[2], e[1]); d.rotation.set(0, e[3], 0); d.scale.set(5 * e[2], 4 * e[2], 6 * e[2]); }, (e, i) => hex(["#e8d9b8", "#d8c4a0", "#f0e6d0", "#c9a98a"][i % 4]));
    inst(new T.ConeGeometry(1, 1, 4), gt("#a8452f"), lists.house, (d, e) => { d.position.set(e[0], 4.9 * e[2], e[1]); d.rotation.set(0, e[3] + Math.PI / 4, 0); d.scale.set(4.6 * e[2], 1.8 * e[2], 5.4 * e[2]); });
    inst(G.cyl, gt("#4b5260"), lists.lamp, (d, e) => { d.position.set(e[0], 2.6, e[1]); d.rotation.set(0, 0, 0); d.scale.set(0.08, 5.2, 0.08); });
    inst(G.sph, new T.MeshBasicMaterial({ color: 0xfff0b0 }), lists.lamp, (d, e) => { d.position.set(e[0], 5.3, e[1]); d.rotation.set(0, 0, 0); d.scale.set(0.3, 0.2, 0.3); });
    // panneaux d'arrêt
    R.stops.forEach((st, i) => { const a = R.at(st.s - 14); const nx = Math.cos(a.th), nz = -Math.sin(a.th); const g2 = new T.Group(); g2.position.set(a.px + nx * (R.half + 3.4), 0, a.pz + nz * (R.half + 3.4)); g2.add(P.part(G.cyl, lam("#4b5260"), 0.07, 3, 0.07, 0, 1.5, 0)); g2.add(P.part(G.box, lam("#2f78d1"), 1.0, 0.7, 0.08, 0, 3.0, 0)); const lb = P.label(st.name.slice(0, 22), "#ffd23f"); lb.scale.set(2.4, 0.6, 1); lb.position.set(0, 3.9, 0); g2.add(lb); W.group.add(g2); });
    // pluie
    const rp = new Float32Array(900 * 6); W.rainPos = rp; for (let i = 0; i < 900; i++) { rp[i * 6] = (Math.random() - 0.5) * 60; rp[i * 6 + 1] = Math.random() * 18; rp[i * 6 + 2] = (Math.random() - 0.5) * 60; }
    const rg = new T.BufferGeometry(); rg.setAttribute("position", new T.BufferAttribute(rp, 3)); W.rain = new T.LineSegments(rg, new T.LineBasicMaterial({ color: 0xcfe0ff, transparent: true, opacity: 0.5 })); W.rain.frustumCulled = false; W.rain.visible = false; scene.add(W.rain);
    return W;
  }
  function pose(W, b) { const a = W.R.at(b.s); const nx = Math.cos(a.th), nz = -Math.sin(a.th); return { x: a.px + nx * b.e, z: a.pz + nz * b.e, h: a.th + b.psi, th: a.th, curv: a.curv, surf: a.surf, wx: a.wx, bio: a.bio, hill: a.hill }; }

  // obstacles autour du bus
  function makeObst(o) {
    const g = new T.Group();
    if (o.type === "vache") { g.add(P.part(G.box, lam("#f4f4f4"), 1.5, 0.8, 0.6, 0, 1.0, 0)); g.add(P.part(G.box, lam("#222"), 0.5, 0.5, 0.62, 0.3, 1.05, 0)); g.add(P.part(G.box, lam("#f4f4f4"), 0.4, 0.4, 0.4, 0.95, 1.3, 0)); g.add(P.part(G.box, lam("#e8a0a0"), 0.1, 0.15, 0.3, 1.18, 1.2, 0)); [[-0.55, 0.2], [-0.55, -0.2], [0.55, 0.2], [0.55, -0.2]].forEach(([x, z]) => g.add(P.part(G.cyl, lam("#ddd"), 0.07, 0.8, 0.07, x, 0.4, z))); }
    else if (o.type === "mouton") { [[-0.5, 0], [0.4, 0.3], [0.2, -0.4], [-0.2, 0.5]].forEach(([x, z]) => { g.add(P.part(G.sph, lam("#f2f0ea"), 0.45, 0.4, 0.45, x, 0.55, z)); g.add(P.part(G.sph, lam("#2a2a2a"), 0.14, 0.14, 0.14, x + 0.4, 0.62, z)); }); }
    else if (o.type === "roche") { const m = new T.Mesh(new T.DodecahedronGeometry(1, 0), lam("#7b7f87")); m.scale.set(0.85, 0.75, 0.75); m.position.y = 0.6; g.add(m); }
    else if (o.type === "trou") { const m = new T.Mesh(G.cyl, new T.MeshBasicMaterial({ color: 0x121214 })); m.scale.set(0.9, 0.02, 0.8); m.position.y = 0.05; g.add(m); }
    else if (o.type === "cone") { [[-0.2, 0], [0.2, 0.15], [0, -0.2]].forEach(([x, z]) => { g.add(P.part(G.cone, lam("#ff7a1c"), 0.22, 0.6, 0.22, x, 0.3, z)); g.add(P.part(G.cyl, lam("#fff"), 0.15, 0.1, 0.15, x, 0.3, z)); }); }
    else if (o.type === "ralent") { for (let i = -6; i <= 5; i++) g.add(P.part(G.box, lam(i % 2 ? "#f2b705" : "#222"), 0.9, 0.09, 0.9, i * 0.9 + 0.45, 0.06, 0)); g.userData.wide = true; }
    return g;
  }
  function syncObst(W, S, dt) {
    const R = W.R, s0 = S.b.s; const gone = new Set(S.go);
    R.obstacles.forEach((o) => {
      const near = o.s > s0 - 25 && o.s < s0 + 230; let m = W.obst[o.id];
      if (!near || gone.has(o.id)) { if (m) { W.group.remove(m); delete W.obst[o.id]; } return; }
      if (!m) { m = makeObst(o); W.obst[o.id] = m; W.group.add(m); }
      const a = R.at(o.s); const e = S.mv && S.mv[o.id] != null ? S.mv[o.id] : o.e; const nx = Math.cos(a.th), nz = -Math.sin(a.th); const tx = a.px + nx * e, tz = a.pz + nz * e;
      if (m.userData.init) { m.position.x += (tx - m.position.x) * Math.min(1, dt * 3); m.position.z += (tz - m.position.z) * Math.min(1, dt * 3); } else { m.position.set(tx, 0.03, tz); m.userData.init = 1; }
      m.rotation.y = o.type === "ralent" ? a.th + Math.PI / 2 : a.th + (o.type === "vache" ? 1.4 : o.id);
    });
  }
  function weather(W, wx, dt, bus, camPos) {
    const k = SKY[wx]; W.sky.t0.set(k[0]); W.sky.t1.set(k[1]); const f = Math.min(1, dt * 0.7);
    W.sky.c0.lerp(W.sky.t0, f); W.sky.c1.lerp(W.sky.t1, f); W.sky.fogN += (FOG[wx][0] - W.sky.fogN) * f; W.sky.fogF += (FOG[wx][1] - W.sky.fogF) * f;
    W.skyAcc = (W.skyAcc || 0) + dt;
    if (W.skyAcc > 0.15) { W.skyAcc = 0; const cx = W.skyCv.getContext("2d"); const gr = cx.createLinearGradient(0, 0, 0, 128); gr.addColorStop(0, "#" + W.sky.c0.getHexString()); gr.addColorStop(0.7, "#" + W.sky.c1.getHexString()); gr.addColorStop(1, "#" + W.sky.c1.getHexString()); cx.fillStyle = gr; cx.fillRect(0, 0, 4, 128); W.skyTex.needsUpdate = true; }
    const sc = W.rain.parent; if (W.fogRef) { W.fogRef.color.copy(W.sky.c1); W.fogRef.near = W.sky.fogN; W.fogRef.far = W.sky.fogF; }
    W.hemi.intensity = wx === 3 ? 0.55 : wx === 1 || wx === 2 ? 0.7 : 0.9; W.sun.intensity = wx === 0 || wx === 4 ? 0.8 : 0.35;
    const rainy = wx === 1 || wx === 3; W.rain.visible = rainy; if (!rainy) return;
    const rp = W.rainPos; const sp = Math.abs(bus.v) + 10; W.rain.position.set(camPos.x, camPos.y - 3, camPos.z);
    for (let i = 0; i < 900; i++) { const o = i * 6; rp[o + 1] -= dt * 22; if (rp[o + 1] < 0) { rp[o + 1] = 18; rp[o] = (Math.random() - 0.5) * 60; rp[o + 2] = (Math.random() - 0.5) * 60; } rp[o + 3] = rp[o] - 0.1; rp[o + 4] = rp[o + 1] + 0.7; rp[o + 5] = rp[o + 2] - (bus.v * 0.02); }
    W.rain.geometry.attributes.position.needsUpdate = true;
  }
  return { build, pose, syncObst, weather };
})();

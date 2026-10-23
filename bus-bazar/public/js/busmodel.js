// ============================================================
// BUS BAZAR — Le bus en 3D, ses objets, le quai, le feu et les flaques
// ============================================================
const BBBus = (function () {
  const T = THREE; const L = BBL; const P = BBPeople; const lam = P.lam; const G = P.geo; const part = P.part;
  const YEL = "#f2b705", CREAM = "#efe6cf", GREY = "#4b5260";
  const basic = (c, o) => new T.MeshBasicMaterial(Object.assign({ color: new T.Color(c) }, o || {}));
  function wallMats(inner, outer, side) { // faces d'une boite fine, +x -x +y -y +z -z
    const a = lam(inner), b = lam(outer); return side < 0 ? [a, b, b, b, b, b] : [b, a, b, b, b, b];
  }
  function box(w, h, d, x, y, z, m) { const o = new T.Mesh(G.box, m); o.scale.set(w, h, d); o.position.set(x, y, z); return o; }
  const glassMat = () => new T.MeshLambertMaterial({ color: 0x9fd6ff, transparent: true, opacity: 0.2, side: T.DoubleSide, depthWrite: false });

  function build() {
    const g = new T.Group(); const o = {};
    // châssis, roues, plancher
    g.add(box(3.2, 0.5, 15.8, 0, -0.25, -0.2, lam("#b98a06")));
    [[1.5, 5.6], [-1.5, 5.6], [1.5, -4.8], [-1.5, -4.8]].forEach(([x, z]) => { const w = new T.Mesh(new T.CylinderGeometry(0.5, 0.5, 0.32, 14), lam("#17181c")); w.rotation.z = Math.PI / 2; w.position.set(x, -0.05, z); g.add(w); const hub = new T.Mesh(new T.CylinderGeometry(0.22, 0.22, 0.34, 10), lam("#9aa0aa")); hub.rotation.z = Math.PI / 2; hub.position.set(x, -0.05, z); g.add(hub); o["wheel" + (x > 0 ? "R" : "L") + (z > 0 ? "F" : "B")] = w; });
    g.add(box(3.0, 0.08, 15.7, 0, -0.04, -0.2, lam("#5a5650")));
    g.add(box(0.95, 0.012, 15.0, 0, 0.005, -0.2, lam("#7b3a3a")));
    // flancs
    [-1, 1].forEach((sd) => {
      const x = sd * 1.55; const wm = wallMats(CREAM, YEL, sd);
      if (sd < 0) g.add(box(0.1, 0.85, 15.1, x, 0.425, -0.35, wm)); else { g.add(box(0.1, 0.85, 11.95, x, 0.425, -1.925, wm)); g.add(box(0.1, 0.85, 1.95, x, 0.425, 6.225, wm)); }
      g.add(box(0.1, 0.35, 15.1, x, 2.125, -0.35, wm));
      for (let z = -7.5; z <= 7; z += 1.5) { if (sd > 0 && z > 3.7 && z < 5.5) continue; g.add(box(0.12, 1.1, 0.12, x, 1.4, z, lam(YEL))); }
      const gl = new T.Mesh(new T.PlaneGeometry(15, 1.1), glassMat()); gl.rotation.y = Math.PI / 2; gl.position.set(x, 1.4, -0.35); g.add(gl);
    });
    // porte avant coulissante, côté droit
    const door = new T.Group(); door.position.set(1.62, 0, 4.6); g.add(door); door.add(box(0.05, 1.95, 1.3, 0, 1.0, 0, new T.MeshLambertMaterial({ color: 0xbfe6ff, transparent: true, opacity: 0.45 }))); door.add(box(0.07, 1.95, 0.08, 0, 1.0, 0.62, lam(YEL))); door.add(box(0.07, 1.95, 0.08, 0, 1.0, -0.62, lam(YEL))); door.add(box(0.07, 0.08, 1.3, 0, 1.95, 0, lam(YEL))); o.door = door;
    g.add(box(0.14, 1.95, 0.1, 1.55, 1.0, 3.95, lam(YEL))); g.add(box(0.14, 1.95, 0.1, 1.55, 1.0, 5.25, lam(YEL)));
    g.add(box(0.5, 0.12, 1.3, 1.78, -0.28, 4.6, lam("#8c8c92")));
    // avant, cabine
    g.add(box(3.1, 1.0, 0.5, 0, 0.5, 7.15, lam("#3a3f4c")));
    g.add(box(3.1, 0.3, 0.1, 0, 2.15, 7.45, lam(YEL)));
    const ws = new T.Mesh(new T.PlaneGeometry(3.0, 1.15), glassMat()); ws.position.set(0, 1.62, 7.45); g.add(ws);
    [-1.5, -0.2, 1.5].forEach((x) => g.add(box(0.1, 1.2, 0.1, x, 1.6, 7.42, lam(YEL))));
    g.add(box(1.4, 0.95, 0.25, -0.85, 0.48, 5.68, lam("#8a8f9a")));
    // arrière
    g.add(box(0.95, 2.3, 0.1, -1.025, 1.15, -7.92, lam("#b98a06"))); g.add(box(0.95, 2.3, 0.1, 1.025, 1.15, -7.92, lam("#b98a06"))); g.add(box(1.1, 0.3, 0.1, 0, 2.15, -7.92, lam("#b98a06")));
    const rpivot = new T.Group(); rpivot.position.set(-0.55, 0, -7.95); g.add(rpivot); const rleaf = box(1.1, 1.95, 0.06, 0.55, 0.98, 0, lam("#c9a017")); rpivot.add(rleaf); rpivot.add(box(0.5, 0.5, 0.02, 0.55, 1.4, -0.04, new T.MeshLambertMaterial({ color: 0xbfe6ff, transparent: true, opacity: 0.5 }))); o.rear = rpivot;
    // plafond et toit
    g.add(box(3.1, 0.06, 15.7, 0, 2.33, -0.2, lam("#eeeae0")));
    g.add(box(3.2, 0.14, 15.9, 0, 2.45, -0.2, lam(YEL))); g.add(box(1.2, 0.2, 2.2, 0, 2.6, -3, lam("#d9dde3")));
    for (let z = -6.5; z <= 6; z += 2.6) g.add(box(0.35, 0.03, 0.9, 0, 2.28, z, basic("#fff7d6")));
    // sièges
    const sm = [lam("#3b6fb5"), lam("#2e5890")];
    L.seats.forEach((s) => { const m = sm[s.row % 2]; g.add(box(0.46, 0.12, 0.46, s.x, 0.4, s.z, m)); g.add(box(0.46, 0.2, 0.46, s.x, 0.2, s.z, lam("#242a36"))); g.add(box(0.46, 0.62, 0.1, s.x, 0.8, s.z - 0.2, m)); g.add(box(0.3, 0.14, 0.1, s.x, 1.2, s.z - 0.2, lam("#9db9e0"))); });
    // porte-bagages et barres
    [-1, 1].forEach((sd) => { g.add(box(0.5, 0.05, 6.4, sd * 1.25, 1.7, 0.75, lam("#9aa0aa"))); g.add(box(0.04, 0.28, 6.4, sd * 1.0, 1.85, 0.75, lam("#9aa0aa"))); });
    [3.5, 1.5, -0.5, -2.5].forEach((z) => [-1, 1].forEach((sd) => { const p = new T.Mesh(new T.CylinderGeometry(0.025, 0.025, 2.3, 6), lam("#d9dde3")); p.position.set(sd * 0.56, 1.15, z); g.add(p); }));
    // emplacements au sol
    L.slots.filter((s) => s.kind === "sol").forEach((s) => g.add(box(0.7, 0.01, 0.7, s.x, 0.012, s.z, lam("#e8c200"))));
    // postes de travail
    const cart = new T.Group(); cart.position.set(-1.2, 0, 4.52); cart.add(box(0.62, 0.9, 0.82, 0, 0.45, 0, lam("#d8dce2"))); cart.add(box(0.64, 0.04, 0.84, 0, 0.92, 0, lam("#e8553c"))); [0.2, 0.4, 0.6].forEach((y, i) => cart.add(box(0.5, 0.08, 0.02, 0.32, y, -0.2 + i * 0.2, lam("#9aa0aa")))); cart.add(box(0.16, 0.1, 0.12, 0.05, 1.0, -0.2, lam("#e8a23a"))); cart.add(box(0.1, 0.18, 0.1, 0.05, 1.05, 0.15, lam("#4aa3e0"))); g.add(cart);
    const aid = new T.Group(); aid.position.set(1.36, 1.3, 6.15); aid.add(box(0.14, 0.34, 0.44, 0, 0, 0, lam("#f4f4f4"))); aid.add(box(0.02, 0.18, 0.06, -0.08, 0, 0, lam("#d6302a"))); aid.add(box(0.02, 0.06, 0.18, -0.08, 0, 0, lam("#d6302a"))); g.add(aid);
    const bench = new T.Group(); bench.position.set(-1.2, 0, -6.75); bench.add(box(0.62, 0.9, 0.7, 0, 0.45, 0, lam("#7a5232"))); bench.add(box(0.64, 0.05, 0.72, 0, 0.92, 0, lam("#a97b4e"))); bench.add(box(0.3, 0.14, 0.18, 0, 1.0, 0, lam("#d6452f"))); g.add(bench);
    const ext = new T.Group(); ext.position.set(1.25, 0, -6.75); ext.add(box(0.4, 0.06, 0.4, 0, 0.03, 0, lam("#444"))); const ec = new T.Mesh(new T.CylinderGeometry(0.08, 0.08, 0.5, 8), lam("#e0302a")); ec.position.y = 0.3; ext.add(ec); ext.add(box(0.05, 0.1, 0.05, 0, 0.6, 0, lam("#222"))); g.add(ext);
    const bst = new T.Group(); bst.position.set(0.72, 0, -7.55); bst.add(box(0.6, 0.9, 0.3, 0, 0.45, 0, lam("#9aa0aa"))); [-0.18, 0, 0.18].forEach((x) => { const b = new T.Mesh(new T.CylinderGeometry(0.08, 0.07, 0.16, 8), lam("#cfd5dc")); b.position.set(x, 0.98, 0); bst.add(b); }); g.add(bst);
    g.add(box(0.8, 0.04, 0.6, -0.5, 0.02, -7.4, lam("#6a6f79"))); g.add(box(0.2, 0.05, 0.05, -0.5, 0.06, -7.2, lam("#d6452f")));
    L.stations.forEach((st) => { const ic = { cart: "🍞", aid: "⛑️", bench: "🧰", ext: "🧯", bucketstand: "🪣", hatch: "🔧" }[st.id]; const s = P.icon(ic, 0.34); s.position.set(st.x * 0.8, st.id === "hatch" ? 0.5 : 1.55, st.z); g.add(s); });
    // poste de conduite
    const seat = new T.Group(); seat.position.set(L.DRIVER.x, 0, 6.28); seat.add(box(0.5, 0.14, 0.5, 0, 0.45, 0, lam("#262b36"))); seat.add(box(0.5, 0.7, 0.12, 0, 0.85, -0.22, lam("#262b36"))); seat.add(box(0.3, 0.2, 0.12, 0, 1.28, -0.22, lam("#262b36"))); g.add(seat);
    const wt = new T.Group(); wt.position.set(L.DRIVER.x, 0.93, 6.82); wt.rotation.x = -0.95; g.add(wt); const spin = new T.Group(); wt.add(spin); spin.add(new T.Mesh(new T.TorusGeometry(0.15, 0.024, 6, 18), lam("#15161a"))); spin.add(box(0.28, 0.025, 0.025, 0, 0, 0, lam("#15161a"))); spin.add(box(0.025, 0.15, 0.025, 0, -0.08, 0, lam("#15161a"))); spin.add(box(0.1, 0.1, 0.04, 0, 0, 0, lam("#444"))); o.wheel = spin;
    // jauges
    const gc = document.createElement("canvas"); gc.width = 256; gc.height = 128; const gx = gc.getContext("2d"); const gtex = new T.CanvasTexture(gc); gtex.generateMipmaps = false; gtex.minFilter = T.LinearFilter;
    const gp = new T.Mesh(new T.PlaneGeometry(0.62, 0.31), new T.MeshBasicMaterial({ map: gtex })); gp.position.set(L.DRIVER.x, 1.12, 7.0); gp.rotation.x = -0.6; gp.rotation.y = Math.PI; g.add(gp);
    gp.rotation.set(-0.6, 0, 0); gp.position.set(L.DRIVER.x, 1.04, 6.9); gp.rotation.order = "YXZ"; gp.rotation.y = Math.PI; gp.rotation.x = 0.6; gp.scale.x = -1;
    o.gauge = { tex: gtex, draw(b, name) { gx.fillStyle = "#0e1424"; gx.fillRect(0, 0, 256, 128); gx.fillStyle = "#fff"; gx.font = "bold 46px sans-serif"; gx.textAlign = "left"; gx.fillText(String(Math.round(Math.abs(b.v) * 3.6)), 12, 54); gx.font = "16px sans-serif"; gx.fillText("km/h", 14, 76);
      const bars = [["Moteur", Math.min(1, Math.max(0, (b.tp - 40) / 90)), b.tp > 100 ? "#e8453c" : b.tp > 85 ? "#f2b705" : "#5ad17a"], ["Carrosserie", b.hl / 100, b.hl < 35 ? "#e8453c" : b.hl < 65 ? "#f2b705" : "#5ad17a"]];
      bars.forEach((r, i) => { const y = 24 + i * 34; gx.fillStyle = "#fff"; gx.font = "14px sans-serif"; gx.fillText(r[0], 120, y); gx.fillStyle = "#2a3350"; gx.fillRect(120, y + 6, 124, 10); gx.fillStyle = r[2]; gx.fillRect(120, y + 6, 124 * r[1], 10); });
      if (b.tr) { gx.fillStyle = "#e8453c"; gx.font = "bold 18px sans-serif"; gx.fillText("PNEU", 120, 100); } if (b.lk) { gx.fillStyle = "#e8453c"; gx.font = "bold 18px sans-serif"; gx.fillText("FUITE", 180, 100); }
      gx.fillStyle = "#9db9e0"; gx.font = "14px sans-serif"; gx.fillText(name || "", 12, 118); gtex.needsUpdate = true; } };
    // panneau de destination
    const dc = document.createElement("canvas"); dc.width = 512; dc.height = 64; const dx = dc.getContext("2d"); const dtex = new T.CanvasTexture(dc); dtex.generateMipmaps = false; dtex.minFilter = T.LinearFilter;
    const dp = new T.Mesh(new T.PlaneGeometry(1.8, 0.225), new T.MeshBasicMaterial({ map: dtex })); dp.position.set(0, 2.1, 7.2); dp.rotation.y = Math.PI; dp.scale.x = -1; g.add(dp);
    o.dest = { last: "", draw(text) { if (text === this.last) return; this.last = text; dx.fillStyle = "#101820"; dx.fillRect(0, 0, 512, 64); dx.fillStyle = "#ffb000"; dx.font = "bold 34px sans-serif"; dx.textAlign = "center"; dx.textBaseline = "middle"; dx.fillText(text.slice(0, 30), 256, 34); dtex.needsUpdate = true; } };
    // lumières
    const l1 = new T.PointLight(0xfff0d0, 0.55, 9); l1.position.set(0, 2.0, 3); g.add(l1); const l2 = new T.PointLight(0xfff0d0, 0.55, 9); l2.position.set(0, 2.0, -3); g.add(l2); const l3 = new T.PointLight(0xfff0d0, 0.5, 6); l3.position.set(-0.5, 1.9, 6.4); g.add(l3);
    o.g = g; return o;
  }

  // ---------- objets ----------
  function item(type, d) {
    d = d || {}; const g = new T.Group();
    if (type === "snack") { g.add(box(0.2, 0.08, 0.14, 0, 0.04, 0, lam("#e8a23a"))); g.add(box(0.08, 0.09, 0.15, 0, 0.045, 0, lam("#c0392b"))); }
    else if (type === "drink") { const c = new T.Mesh(new T.CylinderGeometry(0.045, 0.04, 0.17, 8), lam("#4aa3e0")); c.position.y = 0.085; g.add(c); g.add(box(0.05, 0.02, 0.05, 0, 0.18, 0, lam("#fff"))); }
    else if (type === "bucket") { const c = new T.Mesh(new T.CylinderGeometry(0.14, 0.11, 0.24, 10, 1, true), lam(d.dy ? "#6b8f3a" : "#9aa5b1", { side: T.DoubleSide })); c.position.y = 0.12; g.add(c); const b2 = new T.Mesh(new T.CylinderGeometry(0.11, 0.11, 0.02, 10), lam(d.dy ? "#4d6b27" : "#7b8794")); b2.position.y = 0.02; g.add(b2); }
    else if (type === "tools") { g.add(box(0.36, 0.16, 0.2, 0, 0.08, 0, lam("#d6452f"))); g.add(box(0.22, 0.04, 0.04, 0, 0.19, 0, lam("#222"))); g.add(box(0.05, 0.05, 0.2, 0.17, 0.08, 0, lam("#9aa0aa"))); }
    else if (type === "ext") { const c = new T.Mesh(new T.CylinderGeometry(0.07, 0.07, 0.42, 8), lam("#e0302a")); c.position.y = 0.21; g.add(c); g.add(box(0.05, 0.08, 0.05, 0, 0.46, 0, lam("#222"))); g.add(box(0.14, 0.03, 0.03, 0.06, 0.47, 0, lam("#222"))); }
    else if (type === "aid") { g.add(box(0.3, 0.18, 0.12, 0, 0.09, 0, lam("#f4f4f4"))); g.add(box(0.1, 0.02, 0.13, 0, 0.09, 0, lam("#d6302a"))); g.add(box(0.03, 0.1, 0.13, 0, 0.09, 0, lam("#d6302a"))); }
    else if (type === "mop") { const c = new T.Mesh(new T.CylinderGeometry(0.015, 0.015, 1.0, 5), lam("#8a6b42")); c.position.y = 0.5; g.add(c); g.add(box(0.2, 0.1, 0.1, 0, 0.06, 0, lam("#cbbf9a"))); }
    else if (type === "bag") { const col = ["#6f55c8", "#e8553c", "#2f78d1", "#3aa653", "#f2b705", "#d86fb0"][(d.tg || 0) % 6]; g.add(box(0.42, 0.3, 0.16, 0, 0.17, 0, lam(col))); g.add(box(0.2, 0.04, 0.04, 0, 0.36, 0, lam("#222"))); g.add(box(0.1, 0.1, 0.17, 0, 0.17, 0, lam("#ffffff"))); }
    else if (type === "chick") { const b = new T.Mesh(G.sph, lam("#f2d65a")); b.scale.set(0.11, 0.1, 0.13); b.position.y = 0.12; g.add(b); const h = new T.Mesh(G.sph, lam("#f2d65a")); h.scale.set(0.06, 0.06, 0.06); h.position.set(0, 0.22, 0.1); g.add(h); const bk = new T.Mesh(G.cone, lam("#e8863a")); bk.scale.set(0.025, 0.06, 0.025); bk.rotation.x = Math.PI / 2; bk.position.set(0, 0.22, 0.17); g.add(bk); }
    else if (type === "crate") {
      const c = d.c || "valises"; const col = (L.CARGO[c] || {}).color || "#b98a52";
      if (c === "fut") { const b = new T.Mesh(new T.CylinderGeometry(0.25, 0.25, 0.55, 12), lam("#8a5a2b")); b.position.y = 0.28; g.add(b); [0.12, 0.44].forEach((y) => { const r = new T.Mesh(new T.CylinderGeometry(0.26, 0.26, 0.04, 12), lam("#444")); r.position.y = y; g.add(r); }); }
      else if (c === "statue") { g.add(box(0.4, 0.2, 0.4, 0, 0.1, 0, lam("#8a8f96"))); g.add(box(0.2, 0.55, 0.2, 0, 0.47, 0, lam(d.hp <= 0 ? "#777" : "#c9d3dc"))); const h = new T.Mesh(G.sph, lam("#c9d3dc")); h.scale.set(0.12, 0.12, 0.12); h.position.y = 0.85; g.add(h); }
      else if (c === "piano") { g.add(box(0.9, 0.95, 0.5, 0, 0.5, 0, lam("#25252d"))); g.add(box(0.8, 0.03, 0.2, 0, 0.8, 0.26, lam("#f4f4f4"))); }
      else if (c === "poulets") { g.add(box(0.55, 0.4, 0.4, 0, 0.2, 0, lam("#b98a52"))); for (let i = -2; i <= 2; i++) g.add(box(0.03, 0.4, 0.42, i * 0.11, 0.2, 0, lam("#6a4a28"))); if (d.op) g.add(box(0.5, 0.03, 0.4, 0.28, 0.44, 0, lam("#6a4a28"))); }
      else if (c === "feux") { g.add(box(0.5, 0.35, 0.4, 0, 0.18, 0, lam("#d6302a"))); g.add(box(0.3, 0.04, 0.2, 0, 0.37, 0, lam("#ffd23f"))); }
      else { g.add(box(0.5, 0.36, 0.34, 0, 0.18, 0, lam(col))); g.add(box(0.2, 0.05, 0.2, 0, 0.38, 0, lam("#222"))); g.add(box(0.5, 0.04, 0.36, 0, 0.3, 0, lam("#fff"))); }
    }
    else g.add(box(0.2, 0.2, 0.2, 0, 0.1, 0, lam("#ff00ff")));
    return g;
  }
  // ---------- quai ----------
  function platform(name) {
    const g = new T.Group(); g.add(box(7.4, 0.4, 12.4, 5.6, -0.5, 4.2, lam("#9a9a9e"))); g.add(box(0.2, 0.42, 12.4, 1.9, -0.49, 4.2, lam("#c9c9cf")));
    g.add(box(4.0, 0.06, 4.2, 6.2, 1.7, 7.2, lam("#e8553c"))); [[4.4, 5.3], [8.0, 5.3], [4.4, 9.1], [8.0, 9.1]].forEach(([x, z]) => g.add(box(0.1, 1.9, 0.1, x, 0.65, z, lam("#4b5260"))));
    g.add(box(3.4, 0.08, 0.6, 6.2, 0.3, 8.9, lam("#8a5a2b"))); g.add(box(3.4, 0.5, 0.06, 6.2, 0.6, 9.1, lam("#8a5a2b")));
    g.add(box(0.08, 2.2, 0.08, 2.8, 0.8, -0.8, lam("#4b5260"))); g.add(box(0.8, 0.5, 0.06, 2.8, 1.8, -0.8, lam("#2f78d1")));
    const lb = P.label(name.slice(0, 22), "#ffd23f"); lb.scale.set(2.0, 0.5, 1); lb.position.set(2.8, 2.5, -0.8); g.add(lb);
    return g;
  }
  function fire() { const g = new T.Group(); [["#ff4a1c", 0.38, 0.8], ["#ff9d1c", 0.28, 0.6], ["#ffe14a", 0.16, 0.4]].forEach(([c, r, h], i) => { const m = new T.Mesh(G.cone, basic(c, { transparent: true, opacity: 0.88, depthWrite: false })); m.scale.set(r, h, r); m.position.y = h / 2; g.add(m); g.userData["f" + i] = m; }); const l = new T.PointLight(0xff7a2a, 0.9, 5); l.position.y = 0.6; g.add(l); return g; }
  function puddle() { const m = new T.Mesh(new T.CylinderGeometry(1, 1, 0.012, 14), new T.MeshLambertMaterial({ color: 0x6b8f3a, transparent: true, opacity: 0.78 })); m.position.y = 0.012; return m; }
  return { build, item, platform, fire, puddle };
})();

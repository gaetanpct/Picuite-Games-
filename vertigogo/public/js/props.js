// ============================================================
// VERTIGOGO — Objets du parcours (arbres, voitures, meubles, trampolines...)
// Les modèles viennent de assets/props.glb (CC0, KayKit et Kenney).
// Les arbres, champignons, trampolines et tapis roulants sont dessinés par le code.
// Si le fichier ne charge pas, la scène garde des plateformes simples.
// ============================================================
(function () {
  const T = THREE; const TAU = Math.PI * 2;
  const P3 = { state: 0, P: {}, waiters: [] }; window.VgProps3D = P3;
  const compat = () => !!(window.PicuiteGL && PicuiteGL.compat && PicuiteGL.compat());
  P3.ok = () => P3.state === 2 && !compat();
  P3.pending = () => P3.state === 1;
  P3.load = function (cb) {
    if (P3.state === 2 || P3.state === 3) return cb && cb();
    if (cb) P3.waiters.push(cb); if (P3.state === 1) return;
    const done = (ok) => { P3.state = ok ? 2 : 3; const w = P3.waiters; P3.waiters = []; w.forEach((f) => { try { f(); } catch (e) { /* rien */ } }); };
    if (compat() || !T.GLTFLoader) { P3.state = 3; return cb && cb(); }
    P3.state = 1;
    fetch("assets/props.glb").then((r) => { if (!r.ok) throw new Error("props"); return r.arrayBuffer(); }).then((b) => {
      new T.GLTFLoader().parse(b, "", (g) => { g.scene.children.forEach((n) => { P3.P[n.name] = n; }); done(Object.keys(P3.P).length > 20); }, () => done(false));
    }).catch(() => done(false));
  };

  // ---------- petites textures ----------
  const cache = {}; let seed = 4242; const rnd = () => { seed = (seed * 1664525 + 1013904223) >>> 0; return seed / 4294967296; };
  function tex(key, w, h, draw) {
    if (cache[key]) return cache[key]; const c = document.createElement("canvas"); c.width = w; c.height = h; const g = c.getContext("2d"); draw(g, w, h);
    const t = new T.CanvasTexture(c); t.wrapS = t.wrapT = T.RepeatWrapping; if (T.sRGBEncoding) t.encoding = T.sRGBEncoding; cache[key] = t; return t;
  }
  const bark = (dead) => tex("bark" + dead, 128, 128, (g, s) => {
    g.fillStyle = dead ? "#5a4c46" : "#7a5230"; g.fillRect(0, 0, s, s);
    for (let i = 0; i < 46; i++) { const x = rnd() * s, w = 2 + rnd() * 5; g.fillStyle = dead ? (rnd() < 0.5 ? "#3a302c" : "#6e605a") : (rnd() < 0.5 ? "#4e3320" : "#9a6a3e"); g.globalAlpha = 0.55; g.fillRect(x, 0, w, s); }
    g.globalAlpha = 0.5; g.strokeStyle = dead ? "#241c1a" : "#3a2414"; g.lineWidth = 2; for (let i = 0; i < 9; i++) { const y = rnd() * s; g.beginPath(); g.moveTo(0, y); g.lineTo(s, y + rnd() * 10 - 5); g.stroke(); } g.globalAlpha = 1;
  });
  const netTex = () => tex("net", 64, 64, (g, s) => { g.fillStyle = "#2f6bd8"; g.fillRect(0, 0, s, s); g.strokeStyle = "#8fb8ff"; g.lineWidth = 3; for (let i = 0; i <= s; i += 16) { g.beginPath(); g.moveTo(i, 0); g.lineTo(i, s); g.moveTo(0, i); g.lineTo(s, i); g.stroke(); } });
  const beltTex = () => tex("belt", 128, 64, (g, w, h) => {
    g.fillStyle = "#34383e"; g.fillRect(0, 0, w, h); g.fillStyle = "#ffcf1a";
    for (let k = 0; k < 2; k++) { const x = k * 64 + 12; g.beginPath(); g.moveTo(x, 8); g.lineTo(x + 26, 8); g.lineTo(x + 44, h / 2); g.lineTo(x + 26, h - 8); g.lineTo(x, h - 8); g.lineTo(x + 18, h / 2); g.closePath(); g.fill(); }
    g.fillStyle = "rgba(255,255,255,0.08)"; for (let i = 0; i < 80; i++) g.fillRect(rnd() * w, rnd() * h, 2, 2);
  });
  const dotTex = () => tex("dots", 64, 64, (g, s) => { g.fillStyle = "#fff"; g.fillRect(0, 0, s, s); });

  const lin = (c) => { const k = new T.Color(c); if (T.sRGBEncoding && k.convertSRGBToLinear) k.convertSRGBToLinear(); return k; };
  const lam = (c, o) => new T.MeshLambertMaterial(Object.assign({}, o || {}, { color: lin(c) }));
  const MAT = {};
  const mat = (k, f) => MAT[k] || (MAT[k] = f());
  const shade = (o, on) => { o.traverse((m) => { if (m.isMesh) { m.castShadow = !!on; m.receiveShadow = !!on; } }); return o; };
  const mesh = (geo, m, x, y, z) => { const o = new T.Mesh(geo, m); o.position.set(x || 0, y || 0, z || 0); return o; };
  const G = {}; const geo = (k, f) => G[k] || (G[k] = f());

  // ---------- modèles ----------
  function modelPart(p) {
    const src = P3.P[p.m]; if (!src) return null; const inner = src.clone(true); inner.scale.setScalar(p.s); inner.position.set(-p.piv[0] * p.s, -p.piv[1] * p.s, -p.piv[2] * p.s);
    const piv = new T.Group(); piv.add(inner); return piv;
  }
  function buildModels(obj, sh) {
    const g = new T.Group(); const ca = Math.cos(obj.ang), sa = Math.sin(obj.ang); const fx = ca, fz = -sa, nx = sa, nz = ca; let n = 0;
    for (const p of obj.parts) {
      const m = modelPart(p); if (!m) continue; m.rotation.y = obj.ang + p.ry * Math.PI / 2;
      m.position.set(fx * p.p[0] + nx * p.p[2], p.p[1], fz * p.p[0] + nz * p.p[2]); g.add(m); n++;
    }
    if (!n) return null; g.position.set(obj.px, obj.py, obj.pz); shade(g, sh); return g;
  }

  // ---------- arbre ----------
  function limb(from, to, top, h, wid, dead) {
    // octogone aplati, dessus plat à la hauteur exacte de la boîte, un peu plus épais vers le tronc
    const dx = to[0] - from[0], dz = to[1] - from[1]; const len = Math.hypot(dx, dz); const H = Math.max(h * 1.9, 0.7);
    const g = new T.CylinderGeometry(0.92, 1.0, len, 8, 1); g.rotateY(Math.PI / 8); g.rotateZ(-Math.PI / 2);
    const m = new T.Mesh(g, mat("bark" + dead, () => lam(0xffffff, { map: bark(dead) }))); m.scale.set(1, H / 1.848, Math.max(wid, 0.8) * 1.1 / 1.848);
    const grp = new T.Group(); grp.add(m); grp.position.set((from[0] + to[0]) / 2, top - H / 2, (from[1] + to[1]) / 2); grp.rotation.y = -Math.atan2(dz, dx); return grp;
  }
  function leafClump(r, c) { const o = new T.Mesh(geo("clump", () => new T.IcosahedronGeometry(1, 1)), lam(c, { flatShading: true })); o.scale.set(r, r * 0.82, r); o.rotation.set(rnd() * 3, rnd() * 3, rnd() * 3); return o; }
  function buildTree(obj, C, ctx) {
    const bs = C.boxes.slice(obj.b0, obj.b0 + obj.nb); const dead = obj.style === "mort"; const g = new T.Group();
    const tb = bs[1]; const cx = (tb.x0 + tb.x1) / 2, cz = (tb.z0 + tb.z1) / 2;
    // tronc
    const th = tb.y1 - tb.y0; const trunk = mesh(new T.CylinderGeometry(0.42, 0.62, th, 9), mat("bark" + dead, () => lam(0xffffff, { map: bark(dead) })), cx, (tb.y0 + tb.y1) / 2, cz); trunk.geometry.attributes.uv.array.forEach((v, i, a) => { if (i % 2) a[i] = v * th / 3; });
    g.add(trunk);
    const root = mesh(new T.CylinderGeometry(0.62, 1.5, 1.6, 9), trunk.material, cx, tb.y0 + 0.8, cz); g.add(root);
    // grosses branches
    [bs[0], bs[2], bs[3]].forEach((b, i) => {
      const w = b.x1 - b.x0, d = b.z1 - b.z0; const alongX = w >= d; const h = b.y1 - b.y0; const wid = alongX ? d : w;
      const tipDir = alongX ? ((b.x0 + b.x1) / 2 > cx ? 1 : -1) : ((b.z0 + b.z1) / 2 > cz ? 1 : -1);
      const tip = alongX ? (tipDir > 0 ? b.x1 : b.x0) : (tipDir > 0 ? b.z1 : b.z0);
      const from = [cx, cz], to = alongX ? [tip, (b.z0 + b.z1) / 2] : [(b.x0 + b.x1) / 2, tip];
      const grp = limb(from, to, b.y1, h, wid, dead); g.add(grp);
      // petites brindilles sous la branche
      const mx = (b.x0 + b.x1) / 2, mz = (b.z0 + b.z1) / 2;
      for (let k = 0; k < 3; k++) { const tw = mesh(new T.ConeGeometry(0.12, 1.1 + rnd() * 0.7, 5), trunk.material, mx + (alongX ? (rnd() - 0.5) * w * 0.7 : (rnd() - 0.5) * 0.5), b.y0 - 0.35, mz + (alongX ? (rnd() - 0.5) * 0.5 : (rnd() - 0.5) * d * 0.7)); tw.rotation.set(rnd() * 0.8 + 2.6, 0, rnd() * 0.8 - 0.4); g.add(tw); }
      if (!dead) { // feuillage sous et autour de la branche
        const cols = [0x3f9a47, 0x58b457, 0x2f8a45, 0x7ccc5a];
        for (let k = 0; k < 3; k++) { const c = leafClump(0.75 + rnd() * 0.6, cols[(i + k) % 4]); const t = (k + 0.5) / 3; c.position.set(alongX ? from[0] + (to[0] - from[0]) * (0.35 + t * 0.65) : mx + (rnd() - 0.5) * 0.7, b.y0 - 0.25 - rnd() * 0.5, alongX ? mz + (rnd() - 0.5) * 0.7 : from[1] + (to[1] - from[1]) * (0.35 + t * 0.65)); g.add(c); }
      } else if (i === 2) { const tw = mesh(new T.ConeGeometry(0.16, 2.2, 5), trunk.material, to[0] + (alongX ? tipDir * 0.4 : 0), b.y1 + 1.0, to[1] + (alongX ? 0 : tipDir * 0.4)); tw.rotation.z = 0.5; g.add(tw); }
    });
    // couronne
    if (!dead) { const cols = [0x3f9a47, 0x58b457, 0x2f8a45, 0x7ccc5a, 0x4aa84e]; const yc = tb.y1 + 0.2; [[0, 1.2, 0, 2.5], [1.5, 0.6, 0.5, 1.9], [-1.4, 0.7, -0.6, 1.9], [0.3, 0.5, 1.6, 1.8], [-0.2, 2.5, -0.3, 1.6]].forEach((q, i) => { const c = leafClump(q[3], cols[i % 5]); c.position.set(cx + q[0], yc + q[1] + 0.9, cz + q[2]); g.add(c); }); }
    else { for (let k = 0; k < 3; k++) { const tw = mesh(new T.ConeGeometry(0.18, 2.6, 5), trunk.material, cx + (k - 1) * 0.5, tb.y1 + 1.0, cz + (k % 2 ? 0.4 : -0.4)); tw.rotation.z = (k - 1) * 0.5; g.add(tw); } }
    shade(g, ctx.sh); return g;
  }

  // ---------- champignon ----------
  function dome(rx, ry, rz, c, dots) {
    const g = new T.Group(); const cap = new T.Mesh(geo("dome", () => new T.SphereGeometry(1, 20, 10, 0, TAU, 0, Math.PI / 2)), lam(c)); cap.scale.set(rx, ry, rz); g.add(cap);
    const under = new T.Mesh(geo("disc", () => new T.CircleGeometry(1, 20)), lam(0xf0e4cc, { side: T.DoubleSide })); under.rotation.x = Math.PI / 2; under.scale.set(rx, rz, 1); g.add(under);
    if (dots) for (let i = 0; i < dots; i++) { const a = rnd() * TAU, r = 0.15 + rnd() * 0.6; const d = new T.Mesh(geo("dot", () => new T.SphereGeometry(1, 8, 6)), lam(0xffffff)); const x = Math.cos(a) * r, z = Math.sin(a) * r, y = Math.sqrt(Math.max(0, 1 - x * x - z * z)); d.position.set(x * rx, y * ry * 0.98, z * rz); d.scale.set(0.2 * rx * 0.55, 0.06 * rx, 0.2 * rz * 0.55); d.lookAt(d.position.x * 2, d.position.y * 2 + 1, d.position.z * 2); g.add(d); }
    return g;
  }
  function buildMush(obj, C, ctx) {
    const a = C.boxes[obj.b0], b = C.boxes[obj.b0 + 1]; const g = new T.Group();
    const stemM = lam(0xf3e7cf);
    const ax = (a.x0 + a.x1) / 2, az = (a.z0 + a.z1) / 2, bx = (b.x0 + b.x1) / 2, bz = (b.z0 + b.z1) / 2;
    const cap = dome((a.x1 - a.x0) / 2 + 0.05, (a.y1 - a.y0) * 1.25, (a.z1 - a.z0) / 2 + 0.05, 0xe8453c, 9); cap.position.set(ax, a.y0 - 0.02, az); g.add(cap);
    g.add(mesh(new T.CylinderGeometry(0.75, 0.95, 5, 12), stemM, ax, a.y0 - 2.5, az));
    const cap2 = dome((b.x1 - b.x0) / 2 + 0.05, (b.y1 - b.y0) * 1.1, (b.z1 - b.z0) / 2 + 0.05, 0xff9a3d, 7); cap2.position.set(bx, b.y0 - 0.02, bz); g.add(cap2);
    g.add(mesh(new T.CylinderGeometry(0.6, 0.85, 9, 12), stemM, bx, b.y0 - 4.5, bz));
    ctx.spring(obj.b0, cap, 0.45); shade(g, ctx.sh); return g;
  }

  // ---------- trampoline ----------
  function buildTramp(obj, C, ctx) {
    const a = C.boxes[obj.b0], b = C.boxes[obj.b0 + 1]; const g = new T.Group(); const cx = (a.x0 + a.x1) / 2, cz = (a.z0 + a.z1) / 2, w = a.x1 - a.x0, d = a.z1 - a.z0;
    const frameM = lam(0xe8453c), legM = lam(0x8a929c);
    const net = new T.Group(); net.position.set(cx, a.y1 - 0.08, cz);
    const nm = lam(0xffffff, { map: netTex() }); const nt = nm.map.clone(); nt.repeat.set(3, 3); nt.needsUpdate = true; nm.map = nt;
    net.add(mesh(new T.BoxGeometry(w - 0.3, 0.1, d - 0.3), nm)); g.add(net);
    [[0, d / 2 - 0.12, w, 0.32], [0, -d / 2 + 0.12, w, 0.32]].forEach((q) => g.add(mesh(new T.BoxGeometry(q[2], 0.34, q[3]), frameM, cx + q[0], a.y1 - 0.05, cz + q[1])));
    [[w / 2 - 0.12, 0], [-w / 2 + 0.12, 0]].forEach((q) => g.add(mesh(new T.BoxGeometry(0.32, 0.34, d), frameM, cx + q[0], a.y1 - 0.05, cz + q[1])));
    [[1, 1], [1, -1], [-1, 1], [-1, -1]].forEach((q) => g.add(mesh(new T.CylinderGeometry(0.1, 0.1, 1.2, 6), legM, cx + q[0] * (w / 2 - 0.2), a.y1 - 0.65, cz + q[1] * (d / 2 - 0.2))));
    // plateau d'arrivée sur pilotis
    const bw = b.x1 - b.x0, bd = b.z1 - b.z0, bh = b.y1 - b.y0; const bxm = (b.x0 + b.x1) / 2, bzm = (b.z0 + b.z1) / 2;
    const slab = new T.Mesh(new T.BoxGeometry(bw, bh, bd), [ctx.M.side, ctx.M.side, ctx.M.top, ctx.M.side, ctx.M.side, ctx.M.side]); slab.position.set(bxm, (b.y0 + b.y1) / 2, bzm); g.add(slab);
    g.add(mesh(new T.CylinderGeometry(0.28, 0.4, 9, 8), legM, bxm, b.y0 - 4.5, bzm));
    const rim = mesh(new T.TorusGeometry(Math.min(bw, bd) * 0.34, 0.07, 6, 24), new T.MeshBasicMaterial({ color: 0xffd23d }), bxm, b.y1 + 0.03, bzm); rim.rotation.x = Math.PI / 2; g.add(rim);
    ctx.spring(obj.b0, net, 0.28); shade(g, ctx.sh); return g;
  }

  // ---------- tapis roulant ----------
  function buildBelt(obj, C, ctx) {
    const b = C.boxes[obj.b0]; const cv = b.cv || [1, 0]; const g = new T.Group(); const ang = Math.atan2(-cv[1], cv[0]);
    const w = b.x1 - b.x0, d = b.z1 - b.z0, h = b.y1 - b.y0; const L = Math.max(w, d), Wd = Math.min(w, d);
    const grp = new T.Group(); grp.position.set((b.x0 + b.x1) / 2, (b.y0 + b.y1) / 2, (b.z0 + b.z1) / 2); grp.rotation.y = ang;
    grp.add(mesh(new T.BoxGeometry(L, h * 0.96, Wd), lam(0x30343a)));
    const tm = lam(0xffffff, { map: beltTex().clone() }); tm.map.needsUpdate = true; tm.map.repeat.set(L / 1.9, Wd / 1.9 * 0.5); const top = new T.Mesh(new T.PlaneGeometry(L - 0.2, Wd - 0.5), tm); top.rotation.x = -Math.PI / 2; top.position.y = h / 2 + 0.012; grp.add(top);
    [1, -1].forEach((s) => { grp.add(mesh(new T.BoxGeometry(L, h * 0.5, 0.18), lam(0xffc21a), 0, h * 0.25 + 0.02, s * (Wd / 2 - 0.02))); const r = mesh(new T.CylinderGeometry(h * 0.52, h * 0.52, Wd, 12), lam(0x777d86), s * (L / 2 - 0.02), 0, 0); r.rotation.x = Math.PI / 2; grp.add(r); });
    g.add(grp); ctx.belts.push({ map: tm.map, rep: L / 1.9 }); shade(g, ctx.sh); return g;
  }

  const BUILD = { arbre: buildTree, champi: buildMush, trampoline: buildTramp, tapis: buildBelt };

  // retourne le groupe, ou null si l'objet doit rester en plateformes simples
  P3.build = function (obj, C, ctx) {
    const f = obj.proc && BUILD[obj.proc]; if (f) { try { return f(obj, C, ctx); } catch (e) { return null; } }
    if (!P3.ok() || !obj.parts || !obj.parts.length) return null; try { return buildModels(obj, ctx.sh); } catch (e) { return null; }
  };
  // modèle libre pour les îlots du décor
  P3.model = function (name, h, sh) {
    const src = P3.P[name]; if (!src || !P3.ok()) return null; const bb = P3.BB && P3.BB[name]; const sy = bb ? (bb[4] - bb[1]) : 1; const s = h / (sy || 1); const g = new T.Group(); const inner = src.clone(true); inner.scale.setScalar(s);
    if (bb) inner.position.set(-(bb[0] + bb[3]) / 2 * s, -bb[1] * s, -(bb[2] + bb[5]) / 2 * s); g.add(inner); g.userData.r = bb ? Math.max(bb[3] - bb[0], bb[5] - bb[2]) / 2 * s : h / 2; shade(g, sh); return g;
  };
  P3.BB = (window.VgProps && window.VgProps.BB) || null;
})();

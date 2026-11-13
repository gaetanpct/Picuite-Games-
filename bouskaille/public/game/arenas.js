// ============================================================
// BOUSKAILLE — Arènes modulaires. Chaque arène est une fabrique qui accepte une graine,
// et produit une configuration différente mais toujours vérifiée par arenaCheck.
// ============================================================
(function (root, factory) {
  if (typeof module !== "undefined" && module.exports) module.exports = factory(require("./sim.js"));
  else root.BouskArenas = factory(root.BouskSim);
})(typeof window !== "undefined" ? window : globalThis, function (Sim) {
  function rng(seed) { let a = (seed >>> 0) || 1; return () => { a |= 0; a = (a + 0x6D2B79F5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }
  const TAU = Math.PI * 2;
  const disc = (x, z, r, o) => Object.assign({ k: "disc", x, z, r }, o || {});
  const rect = (x, z, w, d, o) => Object.assign({ k: "rect", x, z, w, d }, o || {});
  const empty = (id, name, theme, R) => ({ id, name, theme, R, surfaces: [], zones: [], bars: [], sliders: [], pegs: [], spawns: [], crown: [], shrink: null, tide: null, info: "" });
  function ringSpawns(A, rad, off) { for (let i = 0; i < 8; i++) { const a = (off || 0) + (i / 8) * TAU; A.spawns.push({ x: Math.cos(a) * rad, z: Math.sin(a) * rad, a: a + Math.PI }); } }
  function ringCrown(A, rad, n) { for (let i = 0; i < n; i++) { const a = (i / n) * TAU + 0.4; A.crown.push({ x: Math.cos(a) * rad, z: Math.sin(a) * rad }); } A.crown.push({ x: 0, z: 0 }); }
  const pick = (r, a) => a[Math.floor(r() * a.length)];
  const sgn = (r) => (r() < 0.5 ? -1 : 1);

  const LIST = [];
  function reg(id, name, theme, blurb, build) { LIST.push({ id, name, theme, blurb, build }); }

  // ---------- 1. Les Nuages ----------
  reg("nuages", "Les Nuages", "cloud", "Un nuage rond entouré de petits nuages qui tournent, et des rafales de vent qui reviennent.", (seed) => {
    const r = rng(seed); const R = 8.8 + r() * 1.4; const A = empty("nuages", "Les Nuages", "cloud", R + 6);
    const n = 3 + Math.floor(r() * 3), dir = sgn(r), rs = 2.2 + r() * 0.5, slipSats = r() < 0.4;
    for (let i = 0; i < n; i++) A.surfaces.push(disc(0, 0, rs, { mv: { type: "orbit", cx: 0, cz: 0, rad: R + rs - 0.5, w: dir * (0.28 + r() * 0.1), ph: (i / n) * TAU }, slip: slipSats && i % 2 === 0, kind: i === n - 1 && r() < 0.35 ? "crumble" : null, delay: 1.1, back: 4.5 }));
    A.surfaces.push(disc(0, 0, R));
    const gusts = 2 + Math.floor(r() * 2); let a0 = r() * TAU;
    for (let i = 0; i < gusts; i++) { const a = a0 + (i / gusts) * TAU + r() * 0.5; A.zones.push({ k: "wind", shape: "disc", x: 0, z: 0, r: R + 1, dx: Math.cos(a), dz: Math.sin(a), f: 8.5 + r() * 2.5, period: 12 + r() * 3, on: 2.3, ph: (i / gusts) * 12 + r() * 3 }); }
    const sp = Math.floor(r() * 3); for (let i = 0; i < sp; i++) { const a = r() * TAU, d = 3.5 + r() * 2.5; A.zones.push({ k: "spring", shape: "disc", x: Math.cos(a) * d, z: Math.sin(a) * d, r: 1.0 }); }
    if (r() < 0.5) A.zones.push({ k: "slip", shape: "disc", x: (r() - 0.5) * 6, z: (r() - 0.5) * 6, r: 2.3 });
    ringSpawns(A, R * 0.62, r() * 0.4); ringCrown(A, R * 0.4, 4);
    A.shrink = { R0: R + rs * 2 + 1, Rmin: 3.6, start: 50, dur: 40 }; A.info = "Les rafales sont annoncées par des traînées blanches.";
    return A;
  });

  // ---------- 2. L'Usine à jouets ----------
  reg("usine", "L'Usine à jouets", "factory", "Des tapis roulants, des pistons qui sortent des murs et un engrenage géant au milieu.", (seed) => {
    const r = rng(seed); const A = empty("usine", "L'Usine à jouets", "factory", 17); const W = 22, D = 19 + Math.floor(r() * 3);
    const flip = sgn(r), sp = 1.2 + r() * 0.7, lanes = r() < 0.5 ? [-1, 1] : [-1, 0, 1];
    lanes.forEach((l, i) => A.surfaces.push(rect(0, l * (D / 2 - 3.2) * (lanes.length === 2 ? 0.95 : 1), W, 3.2, { belt: { x: flip * (i % 2 ? -1 : 1) * sp, z: 0 } })));
    A.surfaces.push(rect(0, 0, W, D));
    const np = 2 + Math.floor(r() * 3);
    for (let i = 0; i < np; i++) { const side = i % 2 ? 1 : -1; const zz = (i < 2 ? (i === 0 ? -4.2 : 4.2) : (r() - 0.5) * 8); A.sliders.push({ kind: "piston", x: side * (W / 2 + 0.7), z: zz, hw: 0.8, hd: 1.5, ax: -side, az: 0, travel: 6.8 + r() * 1.4, period: 6.2 + r() * 1.5, ph: r() * 5 }); }
    A.pegs.push({ x: 0, z: 0, r: 1.25, i: 0 });
    A.bars.push({ x: 0, z: 0, len: 3.9 + r() * 0.8, w: sgn(r) * (1.0 + r() * 0.5), ph: r() * TAU, both: true, th: 0.28 });
    if (r() < 0.5) A.pegs.push({ x: (r() < 0.5 ? -1 : 1) * (W / 2 - 1.6), z: (r() < 0.5 ? -1 : 1) * (D / 2 - 1.6), r: 0.9, i: 1 });
    ringSpawns(A, 6.3, 0.2 + r() * 0.2);
    { const belts = A.surfaces.filter((q) => q.belt); const onBelt = (z) => belts.some((q) => Math.abs(z - q.z) < q.d / 2 + 0.7);
      A.spawns.forEach((q) => { if (!onBelt(q.z)) return; let best = null; belts.forEach((b) => [b.z - b.d / 2 - 1.3, b.z + b.d / 2 + 1.3].forEach((z) => { if (!onBelt(z) && Math.abs(z) < D / 2 - 1.2 && (best === null || Math.abs(z - q.z) < Math.abs(best - q.z))) best = z; })); if (best !== null) { const z0 = q.z; q.z = best; const c = arenaCheck(A); if (!c.ok && c.probs.some((m) => /apparition/.test(m))) q.z = z0; } }); }
    A.crown.push({ x: 0, z: 5.4 }, { x: 0, z: -5.4 }, { x: -1.1, z: 3.1 }, { x: 1.1, z: -3.1 }); A.shrink = { R0: 16, Rmin: 3.8, start: 50, dur: 40 };
    A.rectBounds = { w: W, d: D }; A.info = "Les pistons clignotent avant de sortir.";
    return A;
  });

  // ---------- 3. Le Manège ----------
  reg("manege", "Le Manège", "carousel", "Deux plateaux qui tournent en sens inverse, et des bras qui balayent.", (seed) => {
    const r = rng(seed); const A = empty("manege", "Le Manège", "carousel", 12); const d = sgn(r);
    A.surfaces.push(disc(0, 0, 4.5, { mv: { type: "spin", px: 0, pz: 0, w: -d * (0.38 + r() * 0.12) }, slip: r() < 0.35 }));
    A.surfaces.push(disc(0, 0, 11, { mv: { type: "spin", px: 0, pz: 0, w: d * (0.2 + r() * 0.1) } }));
    A.pegs.push({ x: 0, z: 0, r: 1.15, i: 0 });
    const arms = [1, 2, 4][Math.floor(r() * 3)], bw = sgn(r) * (0.45 + r() * 0.15), off = r() * TAU;
    for (let i = 0; i < arms; i++) A.bars.push({ x: 0, z: 0, len: 7.2 + r() * 1.2, w: bw, ph: off + Math.PI / 8 + (i / arms) * TAU, th: 0.3 });
    const ns = 1 + Math.floor(r() * 3); for (let i = 0; i < ns; i++) { const a = (i / ns) * TAU + r(); A.zones.push({ k: "spring", shape: "disc", x: Math.cos(a) * 9.4, z: Math.sin(a) * 9.4, r: 1.0, host: 1 }); }
    if (r() < 0.5) A.zones.push({ k: "slip", shape: "disc", x: 7.5, z: 0, r: 2.4, host: 1 });
    ringSpawns(A, 7.4, off); ringCrown(A, 7.2, 4); A.shrink = { R0: 11.5, Rmin: 4.2, start: 55, dur: 40 };
    A.info = "Les plateaux entraînent les joueurs, garde un oeil sur les bras."; return A;
  });

  // ---------- 4. L'Île tropicale ----------
  reg("ile", "L'Île tropicale", "island", "Une île avec de la boue, des champignons rebondissants et la marée qui monte.", (seed) => {
    const r = rng(seed); const A = empty("ile", "L'Île tropicale", "island", 12.5);
    A.surfaces.push(disc(0, 0, 6.2));
    const n = 5 + Math.floor(r() * 2); for (let i = 0; i < n; i++) { const a = (i / n) * TAU + r() * 0.6, dd = 4.4 + r() * 1.3; A.surfaces.push(disc(Math.cos(a) * dd, Math.sin(a) * dd, 3.7 + r() * 0.9)); }
    for (let i = 0; i < 2; i++) { const a = r() * TAU, dd = 1.5 + r() * 4; A.zones.push({ k: "mud", shape: "disc", x: Math.cos(a) * dd, z: Math.sin(a) * dd, r: 1.9 + r() * 0.7 }); }
    const ns = 2 + Math.floor(r() * 2); for (let i = 0; i < ns; i++) { const a = (i / ns) * TAU + r(), dd = 5 + r() * 2; A.zones.push({ k: "spring", shape: "disc", x: Math.cos(a) * dd, z: Math.sin(a) * dd, r: 1.0, pow: 1 }); }
    A.pegs.push({ x: (r() - 0.5) * 3, z: (r() - 0.5) * 3, r: 0.9, i: 0 });
    A.tide = { R0: 10.6, depth: 2.4 + r() * 0.5, period: 17 + r() * 4, ph: r() * 17 };
    A.shrink = { R0: 11, Rmin: 4.2, start: 58, dur: 40 };
    ringSpawns(A, 5.4, r()); ringCrown(A, 3.8, 4); A.info = "La marée monte et descend, le sable sombre annonce l'eau."; return A;
  });

  // ---------- 5. Les Sections mobiles ----------
  reg("sections", "Les Sections mobiles", "sections", "Un noyau fixe entouré de plateaux qui glissent et laissent des trous.", (seed) => {
    const r = rng(seed); const A = empty("sections", "Les Sections mobiles", "sections", 14);
    const nc = 2 + Math.floor(r() * 3);
    for (let i = 0; i < nc; i++) { const sx = i % 2 ? -1 : 1, sz = i < 2 ? 1 : -1; A.surfaces.push(rect(sx * 5.0, sz * 5.0, 3.4, 3.4, { kind: "crumble", delay: 1.1, back: 4.2 })); }
    A.surfaces.push(rect(0, 0, 7.4, 7.4));
    const base = r() * 6, dir = sgn(r);
    for (let i = 0; i < 4; i++) { const a = (i / 4) * TAU; const cx = Math.round(Math.cos(a)) * 6.2, cz = Math.round(Math.sin(a)) * 6.2; const tx = -Math.round(Math.sin(a)), tz = Math.round(Math.cos(a)); A.surfaces.push(rect(cx, cz, 6, 6, { mv: { type: "slide", ax: tx, az: tz, amp: 3.0 + r() * 0.5, w: dir * (0.5 + r() * 0.12), ph: base + i * 1.57 * (r() < 0.5 ? 1 : 1) } })); }
    ringSpawns(A, 2.9, 0.4); ringCrown(A, 2, 3); A.shrink = { R0: 13, Rmin: 4, start: 50, dur: 40 }; A.info = "Les plateaux glissent, les cases clignotantes s'effondrent."; return A;
  });

  // ---------- 6. La Fête foraine ----------
  reg("foraine", "La Fête foraine", "fair", "Des auto-tamponneuses, des trampolines et un manège qui tourne au milieu.", (seed) => {
    const r = rng(seed); const A = empty("foraine", "La Fête foraine", "fair", 12);
    A.surfaces.push(disc(0, 0, 3.4, { mv: { type: "spin", px: 0, pz: 0, w: sgn(r) * (0.7 + r() * 0.3) } }));
    A.surfaces.push(disc(0, 0, 10.4));
    const nb = 5 + Math.floor(r() * 3), a0 = r() * TAU, rb = 6.3 + r() * 0.6; for (let i = 0; i < nb; i++) { const a = a0 + (i / nb) * TAU; A.pegs.push({ x: Math.cos(a) * rb, z: Math.sin(a) * rb, r: 0.75, bounce: 1.15, i }); }
    const nt = 2 + Math.floor(r() * 2); for (let i = 0; i < nt; i++) { const a = a0 + ((i + 0.5) / nt) * TAU + 0.3, dd = 7.0; A.zones.push({ k: "spring", shape: "disc", x: Math.cos(a) * dd, z: Math.sin(a) * dd, r: 1.15, pow: 1.1 }); }
    for (let i = 0; i < 2; i++) { const a = r() * TAU; A.zones.push({ k: "slip", shape: "disc", x: Math.cos(a) * 4.8, z: Math.sin(a) * 4.8, r: 1.8 + r() * 0.6 }); }
    ringSpawns(A, 8.9, a0 + 0.2); ringCrown(A, 4.5, 4); A.shrink = { R0: 11, Rmin: 4, start: 50, dur: 40 }; A.info = "Les bumpers rebondissent, les trampolines propulsent."; return A;
  });

  // ---------- 7. La Structure flottante ----------
  reg("flottante", "La Structure flottante", "float", "Une croix suspendue dans le vide, des bras qui s'allongent et des dalles fragiles.", (seed) => {
    const r = rng(seed); const A = empty("flottante", "La Structure flottante", "float", 17);
    const nc = 2 + Math.floor(r() * 3); for (let i = 0; i < nc; i++) { const sx = i % 2 ? -1 : 1, sz = i < 2 ? 1 : -1; A.surfaces.push(rect(sx * 4.6, sz * 4.6, 3.6, 3.6, { kind: "crumble", delay: 1.0, back: 4.0 })); }
    A.surfaces.push(rect(0, 0, 18, 6.6)); A.surfaces.push(rect(0, 0, 6.6, 18));
    const base = r() * 6; for (let i = 0; i < 4; i++) { const a = (i / 4) * TAU, ax = Math.round(Math.cos(a)), az = Math.round(Math.sin(a)); A.surfaces.push(rect(ax * 8.3, az * 8.3, 4.4, 4.4, { mv: { type: "slide", ax, az, amp: 2.4, w: 0.45 + r() * 0.1, ph: base + i * 1.2 } })); }
    A.zones.push({ k: "wind", shape: "disc", x: 0, z: 0, r: 14, dx: Math.cos(r() * TAU), dz: Math.sin(r() * TAU), f: 7.5, period: 14, on: 2.2, ph: r() * 14 });
    if (r() < 0.6) A.zones.push({ k: "spring", shape: "disc", x: 0, z: 0, r: 1.0 });
    ringSpawns(A, 6.2, 0.4); ringCrown(A, 3.6, 4); A.shrink = { R0: 16, Rmin: 4, start: 50, dur: 40 }; A.info = "Les extrémités avancent et reculent."; return A;
  });

  const IDS = LIST.map((a) => a.id);
  function build(id, seed) {
    const e = LIST.find((a) => a.id === id) || LIST[0]; const A = e.build(seed >>> 0); A.seed = seed >>> 0; A.blurb = e.blurb;
    // aucun ressort ne doit se trouver sur une place de départ, on le fait glisser le long de son cercle
    A.zones.forEach((z) => { if (z.k !== "spring" || z.host != null) return; const rad0 = Math.hypot(z.x, z.z); const a0 = Math.atan2(z.z, z.x);
      const ok = (x, zz) => A.spawns.every((s) => Math.hypot(s.x - x, s.z - zz) > z.r + 1.3);
      if (ok(z.x, z.z)) return;
      for (const dr of [0, 1.5, -1.5, 3, -3]) { const rad = Math.max(0.5, rad0 + dr); for (let k = 0; k < 40; k++) { const a = a0 + k * 0.17; const x = Math.cos(a) * rad, zz = Math.sin(a) * rad; if (ok(x, zz) && Math.hypot(x, zz) < A.R * 0.9) { z.x = x; z.z = zz; return; } } } });
    return A;
  }
  // arène de manche, avec ses options. Sans pièges, les pistons et les bras disparaissent
  function make(id, seed, opts) { const A = build(id, seed); if (opts && opts.hazards === "none") { A.bars = []; A.sliders = []; } return A; }
  const meta = () => LIST.map((a) => ({ id: a.id, name: a.name, theme: a.theme, blurb: a.blurb }));

  // ---------- vérification, une arène générée doit toujours être jouable ----------
  function arenaCheck(A, opts) {
    const probs = []; const step = 0.5, M = A.R + 2; const n = Math.round((2 * M) / step);
    const W = Sim.makeWorld(A, { noShrink: true });
    const walk = (x, z) => !!Sim.surfaceAt(W, x, z);
    const at = (t) => { W.t = t; Sim.prepare(W); };
    const comp = (t) => {
      at(t); const g = new Uint8Array(n * n); let tot = 0;
      for (let i = 0; i < n; i++) for (let j = 0; j < n; j++) if (walk(-M + (i + 0.5) * step, -M + (j + 0.5) * step)) { g[i * n + j] = 1; tot++; }
      const lab = new Int32Array(n * n); let best = 0, id = 0;
      for (let s = 0; s < n * n; s++) { if (!g[s] || lab[s]) continue; id++; let c = 0; const st = [s]; lab[s] = id; while (st.length) { const q = st.pop(); c++; const qi = (q / n) | 0, qj = q % n; for (let di = -1; di <= 1; di++) for (let dj = -1; dj <= 1; dj++) { const ni = qi + di, nj = qj + dj; if (ni < 0 || nj < 0 || ni >= n || nj >= n) continue; const k = ni * n + nj; if (g[k] && !lab[k]) { lab[k] = id; st.push(k); } } } if (c > best) best = c; }
      return { tot, best };
    };
    const base = comp(0).tot;
    for (let t = 0; t <= 80; t += 2) {
      const c = comp(t);
      if (c.tot < base * 0.55) probs.push("surface trop réduite à t=" + t);
      if (c.best < c.tot * 0.88) probs.push("zone isolée à t=" + t + " (" + c.best + "/" + c.tot + ")");
      if (probs.length > 3) break;
    }
    // points d'apparition
    at(0); A.spawns.forEach((s, i) => { if (!walk(s.x, s.z)) probs.push("apparition " + i + " dans le vide"); });
    for (let t = 0; t <= 1.8; t += 0.25) {
      at(t);
      A.spawns.forEach((s, i) => {
        for (const o of A.sliders) { const b = Sim.sliderBox(o, t); if (Math.abs(s.x - b.x) < b.hw + 1.2 && Math.abs(s.z - b.z) < b.hd + 1.2) probs.push("piston sur l'apparition " + i + " à t=" + t); }
        for (const b of A.bars) { const sg = Sim.barSeg(b, t); const sx = sg.x1 - sg.x0, sz = sg.z1 - sg.z0; let u = ((s.x - sg.x0) * sx + (s.z - sg.z0) * sz) / (sx * sx + sz * sz); u = Math.max(0, Math.min(1, u)); if (Math.hypot(s.x - (sg.x0 + sx * u), s.z - (sg.z0 + sz * u)) < 1.0) probs.push("bras sur l'apparition " + i + " à t=" + t); }
        for (const g of A.pegs) if (Math.hypot(s.x - g.x, s.z - g.z) < g.r + 1.2) probs.push("obstacle sur l'apparition " + i);
        if (Sim.zoneAt(W, s.x, s.z, "spring") || Sim.zoneAt(W, s.x, s.z, "wind") && false) probs.push("ressort sur l'apparition " + i);
      });
    }
    // les bras ne doivent jamais bloquer la majeure partie de la surface
    let maxCover = 0;
    for (let t = 6; t <= 30; t += 1) { at(t); let cov = 0, tot = 0; for (let i = 0; i < n; i += 1) for (let j = 0; j < n; j += 1) { const x = -M + (i + 0.5) * step, z = -M + (j + 0.5) * step; if (!walk(x, z)) continue; tot++; for (const b of A.bars) { const sg = Sim.barSeg(b, t); const sx = sg.x1 - sg.x0, sz = sg.z1 - sg.z0; let u = ((x - sg.x0) * sx + (z - sg.z0) * sz) / (sx * sx + sz * sz); u = Math.max(0, Math.min(1, u)); if (Math.hypot(x - (sg.x0 + sx * u), z - (sg.z0 + sz * u)) < 1.0) { cov++; break; } } } if (tot) maxCover = Math.max(maxCover, cov / tot); }
    if (maxCover > 0.4) probs.push("bras trop couvrants " + maxCover.toFixed(2));
    // les points de couronne sont praticables à tout moment
    A.crown.forEach((c, i) => { let ok = true; for (let t = 0; t <= 80; t += 2) { at(t); if (!walk(c.x, c.z)) { ok = false; break; } for (const o of A.sliders) { const b = Sim.sliderBox(o, t); if (Math.abs(c.x - b.x) < b.hw + 1 && Math.abs(c.z - b.z) < b.hd + 1) ok = false; } } if (!ok) probs.push("point de couronne " + i + " pas toujours praticable"); });
    return { ok: probs.length === 0, probs, area: base * step * step };
  }

  // places de départ pour n joueurs, les équipes sont réparties en deux moitiés du cercle
  function spawnsFor(A, n, teamOf) {
    const slots = A.spawns; const out = new Array(n); let order = [];
    for (let i = 0; i < n; i++) order.push(Math.round((i * 8) / n) % 8);
    if (teamOf) { const idx = Array.from({ length: n }, (_, i) => i).sort((a, b) => (teamOf[a] - teamOf[b]) || a - b); const res = new Array(n); idx.forEach((pi, k) => { res[pi] = slots[order[k]]; }); return res; }
    for (let i = 0; i < n; i++) out[i] = slots[order[i]];
    return out;
  }
  return { IDS, LIST, meta, build, make, arenaCheck, spawnsFor, rng };
});

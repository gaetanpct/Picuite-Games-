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

  function clearPegs(A) { A.pegs = A.pegs.filter((g) => A.spawns.every((s) => Math.hypot(s.x - g.x, s.z - g.z) >= g.r + 1.5)); A.pegs.forEach((g, i) => { g.i = i; }); }

  // ---------- 8. Le Radeau sur la rivière ----------
  reg("radeau", "Le Radeau", "raft", "Un radeau sur la rivière qui penche du côté où se tiennent les joueurs. Tout le monde du même côté, et ça glisse.", (seed) => {
    const r = rng(seed); const W = 17 + r() * 2, D = 12 + r() * 1.5; const A = empty("radeau", "Le Radeau", "raft", 13);
    A.surfaces.push(rect(0, 0, W, D)); A.raft = { k: 7.5 + r() * 1.5, half: W / 2 };
    const nb = 2 + Math.floor(r() * 2); for (let i = 0; i < nb; i++) { const x = (i % 2 ? 1 : -1) * (2.5 + r() * 3), z = (r() - 0.5) * (D - 5); A.pegs.push({ x, z, r: 0.8, i, barrel: 1 }); }
    if (r() < 0.6) A.zones.push({ k: "slip", shape: "disc", x: (r() - 0.5) * 6, z: (r() - 0.5) * 4, r: 1.8 });
    ringSpawns(A, Math.min(W, D) * 0.33, r()); clearPegs(A); A.crown.push({ x: 0, z: 0 }, { x: 3, z: 0 }, { x: -3, z: 0 });
    A.shrink = { R0: A.R + 1.6, Rmin: 4.2, start: 55, dur: 45 }; A.rectBounds = { w: W, d: D }; A.info = "Le radeau penche du côté du groupe, répartissez-vous ou faites tout basculer."; return A;
  });

  // ---------- 9. La Patinoire en pente ----------
  reg("patinoire", "La Patinoire en pente", "ice", "Une patinoire de glace inclinée. On charge vers le haut avec peine et on dévale vers le bas.", (seed) => {
    const r = rng(seed); const W = 18, D = 16; const A = empty("patinoire", "La Patinoire en pente", "ice", 13);
    A.surfaces.push(rect(0, 0, W, D)); A.ice = true; A.slope = { dx: 0, dz: 1, f: 2.6 + r() * 0.6 };
    for (let i = 0; i < 2; i++) A.zones.push({ k: "mud", shape: "disc", x: (i ? 1 : -1) * (3 + r() * 3), z: -3 + r() * 4, r: 1.6, snow: 1 });
    A.pegs.push({ x: (r() - 0.5) * 6, z: -2 + r() * 2, r: 0.9, i: 0 });
    ringSpawns(A, 4.6, r()); A.spawns.forEach((q) => { q.z -= 1.5; }); clearPegs(A); A.crown.push({ x: 0, z: -4 }, { x: 4, z: -3 }, { x: -4, z: -3 });
    A.shrink = { R0: A.R + 1.6, Rmin: 4, start: 55, dur: 45 }; A.rectBounds = { w: W, d: D }; A.info = "La glace descend vers le bord rouge, reste en haut."; return A;
  });

  // ---------- 10. Le Ring en spirale ----------
  reg("spirale", "Le Ring en spirale", "ring", "Un ring de dalles qui tombent une par une en spirale depuis le bord. Le centre résiste jusqu'au bout.", (seed) => {
    const r = rng(seed); const N = 7, S = 2.6; const A = empty("spirale", "Le Ring en spirale", "ring", 12);
    // ordre en spirale depuis un coin, sens tiré au hasard
    const order = []; let x0 = 0, y0 = 0, x1 = N - 1, y1 = N - 1; while (x0 <= x1 && y0 <= y1) { for (let x = x0; x <= x1; x++) order.push([x, y0]); for (let y = y0 + 1; y <= y1; y++) order.push([x1, y]); if (y0 < y1) for (let x = x1 - 1; x >= x0; x--) order.push([x, y1]); if (x0 < x1) for (let y = y1 - 1; y > y0; y--) order.push([x0, y]); x0++; y0++; x1--; y1--; }
    const flip = r() < 0.5, rot = Math.floor(r() * 4); const start = 22 + r() * 6, every = 1.25 + r() * 0.25; const keep = 9; // les neuf dernières dalles, le centre, ne tombent jamais
    order.forEach(([gx, gy], k) => { let a = gx, b = gy; if (flip) a = N - 1 - a; for (let q = 0; q < rot; q++) { const t = a; a = N - 1 - b; b = t; } const x = (a - (N - 1) / 2) * S, z = (b - (N - 1) / 2) * S; A.surfaces.push(rect(x, z, S - 0.06, S - 0.06, k < order.length - keep ? { fallAt: +(start + k * every).toFixed(2), tile: 1 } : { tile: 1 })); });
    A.minArea = 0.15; ringSpawns(A, 5.2, 0.4); ringCrown(A, 1.5, 4); A.shrink = null; A.rectBounds = { w: N * S, d: N * S }; A.info = "Les dalles qui tremblent vont tomber, le centre ne tombe jamais."; return A;
  });

  // ---------- 11. Le Toit sous l'orage ----------
  reg("toit", "Le Toit sous l'orage", "storm", "Un toit d'immeuble sous l'orage. Un cercle lumineux annonce chaque éclair, qui éjecte tout ce qui s'y trouve.", (seed) => {
    const r = rng(seed); const W = 19, D = 16; const A = empty("toit", "Le Toit sous l'orage", "storm", 13);
    A.surfaces.push(rect(0, 0, W, D)); A.pegs.push({ x: -W / 2 + 2.2, z: -D / 2 + 2.2, r: 1.0, i: 0, chimney: 1 }); A.pegs.push({ x: W / 2 - 2.6, z: D / 2 - 2.4, r: 0.9, i: 1, chimney: 1 });
    A.bolts = []; let t = 9 + r() * 3; while (t < 150) { const n = t > 60 ? 2 : 1; for (let q = 0; q < n; q++) A.bolts.push({ x: +((r() - 0.5) * (W - 3)).toFixed(2), z: +((r() - 0.5) * (D - 3)).toFixed(2), r: 2.1 + r() * 0.5, at: +(t + q * 0.7).toFixed(2) }); t += 3.2 + r() * 1.6; }
    ringSpawns(A, 5.4, r()); ringCrown(A, 3.4, 4); A.shrink = { R0: A.R + 1.6, Rmin: 4.2, start: 60, dur: 45 }; A.rectBounds = { w: W, d: D }; A.info = "Sors vite des cercles lumineux, la foudre y tombe."; return A;
  });

  // ---------- 12. La Table de billard ----------
  reg("billard", "La Table de billard", "pool", "Les joueurs sont les boules. Les bandes renvoient tout le monde, il faut pousser les autres dans les poches.", (seed) => {
    const r = rng(seed); const W = 22, D = 12.5; const A = empty("billard", "La Table de billard", "pool", 13);
    A.surfaces.push(rect(0, 0, W, D, { slip: true })); const pr = 1.25, grow = 1.0 + r() * 0.4;
    A.holes = [[-W / 2, -D / 2], [0, -D / 2 - 0.3], [W / 2, -D / 2], [-W / 2, D / 2], [0, D / 2 + 0.3], [W / 2, D / 2]].map(([x, z]) => ({ x, z, r: pr, grow, g0: 40, gd: 50 }));
    const hw = W / 2, hd = D / 2, g = 1.6; A.walls = [[-hw + g, -hd, -g, -hd], [g, -hd, hw - g, -hd], [-hw + g, hd, -g, hd], [g, hd, hw - g, hd], [-hw, -hd + g, -hw, hd - g], [hw, -hd + g, hw, hd - g]].map(([x0, z0, x1, z1]) => ({ x0, z0, x1, z1, e: 0.9 }));
    A.ledge = false; A.minArea = 0.5; ringSpawns(A, 3.4, 0.4); A.spawns.forEach((q) => { q.x *= 1.6; }); A.crown.push({ x: 0, z: 0 }, { x: -4, z: 0 }, { x: 4, z: 0 });
    A.shrink = null; A.rectBounds = { w: W, d: D }; A.info = "Les bandes rebondissent, les poches grandissent avec le temps."; return A;
  });

  // ---------- 13. Le Volcan ----------
  reg("volcan", "Le Volcan", "volcano", "L'arène se fissure en îlots qui s'éloignent lentement les uns des autres au-dessus de la lave.", (seed) => {
    const r = rng(seed); const A = empty("volcan", "Le Volcan", "volcano", 15);
    A.surfaces.push(disc(0, 0, 4.2)); const n = 6, a0 = r() * TAU, t0 = 12 + r() * 6;
    for (let i = 0; i < n; i++) { const a = a0 + (i / n) * TAU; const d = 6.0; A.surfaces.push(disc(Math.cos(a) * d, Math.sin(a) * d, 3.4, { mv: { type: "drift", dx: Math.cos(a), dz: Math.sin(a), rate: 0.09 + r() * 0.03, max: 2.6 + r() * 0.6, t0: t0 + i * 1.5 } })); }
    A.zones.push({ k: "spring", shape: "disc", x: 0, z: 0, r: 0.9 });
    A.split = true; ringSpawns(A, 6.2, a0 + Math.PI / 6); ringCrown(A, 0.01, 1); A.shrink = { R0: A.R + 1.6, Rmin: 4.2, start: 70, dur: 50 }; A.info = "Les îlots s'écartent, saute de l'un à l'autre."; return A;
  });

  const IDS = LIST.map((a) => a.id);
  // ---------- événements de mi-manche, annoncés trois secondes avant ----------
  const EVENTS = { bascule: "Le sol bascule", bumper: "Bumper géant", lune: "Gravité réduite", glace: "Tout gèle" };
  function addEvents(A, seed) {
    const r = rng((seed ^ 0x5bd1e995) >>> 0); A.events = []; const list = ["bascule", "bumper", "lune", "glace"].filter((k) => !(k === "glace" && A.ice) && !(k === "bascule" && (A.slope || A.raft)) && !(k === "bumper" && A.theme === "pool"));
    let t = 24 + r() * 8; const n = 1 + (r() < 0.5 ? 1 : 0);
    for (let q = 0; q < n; q++) { const k = list[Math.floor(r() * list.length)]; const a = r() * TAU; const e = { k, at: +t.toFixed(2), dur: k === "bumper" ? 12 : k === "lune" ? 10 : 8, dx: Math.cos(a), dz: Math.sin(a), f: 4.5, name: EVENTS[k] };
      if (k === "bumper") { const c = A.crown[0] || { x: 0, z: 0 }; e.x = c.x; e.z = c.z; A.pegs.push({ x: c.x, z: c.z, r: 1.7, bounce: 1.35, i: A.pegs.length, t0: e.at, t1: e.at + e.dur, big: 1 }); }
      A.events.push(e); t += 26 + r() * 10; }
  }
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
  function make(id, seed, opts) { const A = build(id, seed); if (opts && opts.hazards === "none") { A.bars = []; A.sliders = []; } if (!opts || opts.events !== false) addEvents(A, seed); else A.events = []; return A; }
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
      if (c.tot < base * (A.minArea || 0.55) && t <= (A.areaUntil || 80)) probs.push("surface trop réduite à t=" + t);
      if (!A.split && c.best < c.tot * 0.88) probs.push("zone isolée à t=" + t + " (" + c.best + "/" + c.tot + ")");
      if (probs.length > 3) break;
    }
    // points d'apparition
    at(0); A.spawns.forEach((s, i) => { if (!walk(s.x, s.z)) probs.push("apparition " + i + " dans le vide"); });
    for (let t = 0; t <= 1.8; t += 0.25) {
      at(t);
      A.spawns.forEach((s, i) => {
        for (const o of A.sliders) { const b = Sim.sliderBox(o, t); if (Math.abs(s.x - b.x) < b.hw + 1.2 && Math.abs(s.z - b.z) < b.hd + 1.2) probs.push("piston sur l'apparition " + i + " à t=" + t); }
        for (const b of A.bars) { const sg = Sim.barSeg(b, t); const sx = sg.x1 - sg.x0, sz = sg.z1 - sg.z0; let u = ((s.x - sg.x0) * sx + (s.z - sg.z0) * sz) / (sx * sx + sz * sz); u = Math.max(0, Math.min(1, u)); if (Math.hypot(s.x - (sg.x0 + sx * u), s.z - (sg.z0 + sz * u)) < 1.0) probs.push("bras sur l'apparition " + i + " à t=" + t); }
        for (const g of A.pegs) if (!(g.t0 > 0) && Math.hypot(s.x - g.x, s.z - g.z) < g.r + 1.2) probs.push("obstacle sur l'apparition " + i);
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
  return { EVENTS, IDS, LIST, meta, build, make, arenaCheck, spawnsFor, rng };
});

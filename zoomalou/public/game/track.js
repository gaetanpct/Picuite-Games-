// ============================================================
// ZOOMALOU — Générateur de circuits (partagé serveur et client)
// Un circuit est une ligne centrale échantillonnée tous les 2 m avec hauteur, largeur et sol.
// Départ en 0,0 vers +z. Cap h = 0 vers +z, un cap croissant tourne vers la gauche.
// Éléments spéciaux
//  sauts au-dessus du vide dont la longueur est calculée d'après la voiture la plus lente
//  fortes montées et descentes, obstacles avec couloir garanti, largeurs variables, ponts sans murs
//  zones sans gravité (looping, vrille, virage mural, plafond) où la voiture suit la route, même à l'envers
// ============================================================
(function (root, factory) {
  if (typeof module !== "undefined" && module.exports) module.exports = factory();
  else root.ZoomTrack = factory();
})(typeof window !== "undefined" ? window : globalThis, function () {
  const STEP = 2;
  const SURF = { ASPHALT: 0, DIRT: 1, ICE: 2, BOOST: 3, SLOW: 4 };
  const FLAG = { BOOST: 1, JUMP: 2, MAG: 4, GAP: 8, NOWALL: 16, KICK: 32 };
  const SURF_NAMES = ["Bitume", "Terre", "Glace", "Turbo", "Collant"];
  // en vol, la pesanteur est plus forte que sur la route. Les sauts restent courts et lisibles
  const AIRK = 1.9;
  // la voiture la plus lente (Bouboule) sert de référence pour dimensionner les sauts
  const WEAK = { vmax: 45, acc: 18 };
  const VTOP = 92; // vitesse maximale possible en vol, turbo compris
  const OBS = { cone: { r: 0.75, h: 1.4 }, barrel: { r: 1.15, h: 1.7 }, crate: { r: 1.4, h: 2.2 }, pillar: { r: 0.95, h: 5 } };
  const OBS_IDS = ["cone", "barrel", "crate", "pillar"];

  function mulberry32(a) { return function () { a |= 0; a = (a + 0x6d2b79f5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }
  function hashSeed(s) { s = String(s); let h = 2166136261; for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); } return h >>> 0; }
  const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
  const sm = (t) => { t = t < 0 ? 0 : t > 1 ? 1 : t; return t * t * (3 - 2 * t); };

  const BIOMES = {
    cote: { id: "cote", name: "Côte", icon: "🏖️", sky: ["#4fc8ff", "#fff3d6"], fog: "#d8f1ff", sun: "#fff3d0", amb: "#c8ecff", ground: "#f0dc9c", road: "#5b606c", wall: "#ffffff", curb: ["#ff5a4a", "#ffffff"], gravity: 9.8, plan: { dirt: 0.0, ice: 0, slow: 0.22 },
      deco: ["palm", "palm", "rock", "parasol"], names: ["Corniche Salée", "Route des Mouettes", "Plage Express", "Marée Basse", "Phare en Vue"] },
    desert: { id: "desert", name: "Désert", icon: "🌵", sky: ["#ffa94a", "#fff0cf"], fog: "#ffe2b0", sun: "#fff0c0", amb: "#ffe0b0", ground: "#e9b868", road: "#6a5a4a", wall: "#f2d29a", curb: ["#c0552a", "#f6e2b4"], gravity: 9.8, plan: { dirt: 0.5, ice: 0, slow: 0.12 },
      deco: ["cactus", "cactus", "rock", "rock"], names: ["Piste Poussiéreuse", "Mirage Rapide", "Canyon Sec", "Dune Furieuse", "Oasis Express"] },
    neige: { id: "neige", name: "Neige", icon: "⛄", sky: ["#9fd4ff", "#f4fbff"], fog: "#e6f3ff", sun: "#ffffff", amb: "#d0e8ff", ground: "#f4f9ff", road: "#4a5666", wall: "#dff0ff", curb: ["#2a6fb0", "#ffffff"], gravity: 9.8, plan: { dirt: 0, ice: 0.45, slow: 0.1 },
      deco: ["pine", "pine", "snowman", "rock"], names: ["Piste Verglacée", "Col Blanc", "Tobogan Fou", "Sapin Givré", "Lac Gelé"] },
    foret: { id: "foret", name: "Forêt", icon: "🌲", sky: ["#6ed49a", "#e9ffe2"], fog: "#b9ecc4", sun: "#fff6c0", amb: "#a8e8b8", ground: "#3f9a50", road: "#4a4f46", wall: "#8a6a3a", curb: ["#8a5a2a", "#e8d8a8"], gravity: 9.8, plan: { dirt: 0.4, ice: 0, slow: 0.25 },
      deco: ["tree", "tree", "pine", "mushroom", "rock"], names: ["Sentier des Cerfs", "Racines Folles", "Sous-Bois Rapide", "Champignon Express", "Clairière Piégeuse"] },
    volcan: { id: "volcan", name: "Volcan", icon: "🌋", sky: ["#6a2a3a", "#ff9a5a"], fog: "#d8785a", sun: "#ffc890", amb: "#ff9a70", ground: "#3e3038", road: "#2e2830", wall: "#6a4a50", curb: ["#ff5a1a", "#ffd84a"], gravity: 9.8, plan: { dirt: 0.2, ice: 0, slow: 0.15 },
      deco: ["rock", "rock", "crystal", "crystal"], names: ["Coulée Rouge", "Cratère Express", "Cendres Chaudes", "La Fournaise", "Cheminée Folle"] },
    bonbons: { id: "bonbons", name: "Bonbons", icon: "🍭", sky: ["#ffb3e0", "#fff4fb"], fog: "#ffd9f0", sun: "#fff0f8", amb: "#ffd0ee", ground: "#c98cf0", road: "#8a5a9a", wall: "#ffffff", curb: ["#ff4aa8", "#ffe14a"], gravity: 9.8, plan: { dirt: 0, ice: 0.05, slow: 0.35 },
      deco: ["lolli", "cane", "gummy", "lolli"], names: ["Route Guimauve", "Chocolat Fondu", "Sucre d'Orge", "Gelée Rapide", "Caramel Express"] },
    neon: { id: "neon", name: "Néon", icon: "🪐", sky: ["#07041f", "#3a1f7a"], fog: "#241250", sun: "#c8c0ff", amb: "#6a60c0", ground: "#14104a", road: "#1e1a50", wall: "#5affd8", curb: ["#ff4a8a", "#5affd8"], gravity: 4.6, stars: true, plan: { dirt: 0, ice: 0.2, slow: 0.05 },
      deco: ["pylon", "pylon", "asteroid", "crystal"], names: ["Orbite Néon", "Anneau Lumineux", "Piste Stellaire", "Comète Express", "Voie Lactée"] },
  };
  const BIOME_IDS = Object.keys(BIOMES);

  // vitesse atteinte par la voiture la plus lente après L mètres, au départ arrêté
  function accelSpeed(L, vmax, acc) { let v = 0, s = 0; for (let k = 0; k < 8000 && s < L; k++) { v += acc * Math.max(0, 1 - (v / vmax) * (v / vmax)) / 60; s += v / 60; } return v; }
  // durée du vol pour un décollage vertical vk et une arrivée dl mètres plus bas
  const flightTime = (vk, g, dl) => (vk + Math.sqrt(vk * vk + 2 * g * dl)) / g;

  // ---------- profil d'altitude ----------
  // pentes données par morceaux (longueur en m, dénivelé en m), lissées, puis intégrées en une courbe d'altitude par échantillon
  function slopeProfile(segs, n) {
    const d = new Float64Array(n + 8); let pos = 0;
    segs.forEach((sg) => { const k = Math.max(1, Math.round(sg.L / STEP)); for (let i = 0; i < k && pos + i < n; i++) d[pos + i] = sg.dy / k; pos += k; });
    for (let pass = 0; pass < 2; pass++) { const c = Float64Array.from(d); for (let i = 0; i < n; i++) d[i] = ((c[i - 2] || 0) + 2 * (c[i - 1] || 0) + 3 * c[i] + 2 * (c[i + 1] || 0) + (c[i + 2] || 0)) / 9; }
    const o = new Array(n); let y = 0; for (let i = 0; i < n; i++) { y += d[i]; o[i] = y; } return o;
  }

  function build(spec, attempt) {
    const rng = mulberry32(hashSeed(spec.seed + "zt" + (attempt ? "#" + attempt : "")));
    const biome = BIOMES[spec.biome] || BIOMES.cote;
    const diff = clamp(spec.difficulty || 3, 1, 5), size = clamp(spec.size || 2, 1, 5);
    const hillsLvl = clamp(spec.hills == null ? 2 : spec.hills, 0, 3);
    const F = Object.assign({ boosts: true, jumps: true, surfaces: true, gaps: true, steep: true, obstacles: true, widths: true, bridges: true, mag: true }, spec.features || {});
    const wild = clamp(spec.special == null ? 3 : spec.special, 0, 4);
    const airG = biome.gravity * AIRK;
    const targetLen = [700, 1100, 1700, 2800, 4200][size - 1] * (0.92 + rng() * 0.16);
    const maxR = [330, 440, 600, 820, 1050][size - 1];
    const hwN = [6.6, 5.6, 4.8, 4.2, 3.6][diff - 1]; // demi-largeur des passages étroits
    const hw = hwN * 1.25; // demi-largeur ordinaire, plus large
    const elemSel = spec.elements || "auto";
    const elemK = elemSel === "peu" ? 0.45 : elemSel === "moyen" ? 1 : elemSel === "beaucoup" ? 1.7 : [0.45, 0.75, 1, 1.35, 1.7][diff - 1];
    // l'ambiance de la course change d'un circuit à l'autre
    const mood = {}; ["steep", "obst", "width", "gap", "bridge", "mag", "twist", "flow"].forEach((k) => { mood[k] = 0.3 + rng() * 1.6; });
    const narrowFrac = clamp([0, 0.18, 0.45, 0.72, 0.95][diff - 1] * (0.7 + rng() * 0.6), 0, 0.93);
    const rad = (a, b) => a + rng() * (b - a), ang = (a, b) => (a + rng() * (b - a)) * Math.PI / 180, pick = (l) => l[Math.floor(rng() * l.length)];
    const X = [], Z = [], H = [], W = [], SF = [], FL = [];
    const items = []; const starts = []; // éléments enregistrés et début de chaque pièce posée
    let x = 0, z = 0, h = 0, wMax = hw;
    const grid = new Map(); const CELL = 24;
    const gk = (px, pz) => Math.floor(px / CELL) + "," + Math.floor(pz / CELL);
    const push = (surf, flag, hwv) => { const w = hwv || hw; X.push(x); Z.push(z); H.push(h); W.push(w); SF.push(surf); FL.push(flag || 0); if (w > wMax) wMax = w; const k = gk(x, z); let l = grid.get(k); if (!l) { l = []; grid.set(k, l); } l.push(X.length - 1); };
    const regrid = () => { grid.clear(); for (let i = 0; i < X.length; i++) { const k = gk(X[i], Z[i]); let l = grid.get(k); if (!l) { l = []; grid.set(k, l); } l.push(i); } };
    const pickSurf = () => {
      if (!F.surfaces) return SURF.ASPHALT;
      const r = rng(); const p = biome.plan; const k = 0.5 + 0.2 * (spec.surfaceVar == null ? 2 : spec.surfaceVar) * 0.5;
      if (r < p.ice * k * 1.4) return SURF.ICE; if (r < (p.ice + p.dirt) * k * 1.4) return SURF.DIRT; return SURF.ASPHALT; // les ralentisseurs sont de courtes plaques posées à part, jamais une pièce entière
    };
    push(SURF.ASPHALT, 0);

    // ---------- pose d'une pièce ----------
    function walk(kind) {
      const pts = []; let cx = x, cz = z, ch = h; const ns = kind.parts.map((p) => Math.max(1, Math.round((p.straight ? p.straight : Math.abs(p.angle) * p.radius) / STEP))); const tot = ns.reduce((a, b) => a + b, 0); let k = 0;
      kind.parts.forEach((p, q) => { const n = ns[q]; const dh = p.straight ? 0 : p.angle / n; for (let i = 0; i < n; i++, k++) { ch += dh * 0.5; cx += Math.sin(ch) * STEP; cz += Math.cos(ch) * STEP; ch += dh * 0.5; pts.push({ x: cx, z: cz, h: ch, w: hw * (kind.wf ? kind.wf((k + 1) / tot) : 1) }); } });
      return pts;
    }
    const plan = (kind) => (kind.make ? kind.make(x, z, h) : walk(kind));
    function fits(pts, noSelf) {
      const old = X.length - 28;
      for (let i = 0; i < pts.length; i++) {
        const p = pts[i]; if (Math.hypot(p.x, p.z) > maxR) return false;
        const R = Math.ceil((wMax + p.w + 7) / CELL); const gx = Math.floor(p.x / CELL), gz = Math.floor(p.z / CELL);
        for (let a = -R; a <= R; a++) for (let b = -R; b <= R; b++) { const l = grid.get((gx + a) + "," + (gz + b)); if (!l) continue; for (let q = 0; q < l.length; q++) { const j = l[q]; if (j >= old) continue; const dx = X[j] - p.x, dz = Z[j] - p.z, lim = W[j] + p.w + 7; if (dx * dx + dz * dz < lim * lim) return false; } }
        if (!noSelf) for (let j = 0; j < i - 14; j++) { const dx = pts[j].x - p.x, dz = pts[j].z - p.z, lim = pts[j].w + p.w + 7; if (dx * dx + dz * dz < lim * lim) return false; }
      }
      return true;
    }
    // Ralentisseurs, de rares petites plaques de quelques mètres, espacées et en nombre limité selon la longueur
    let lastSlow = -999, slowCount = 0; const slowMax = 1 + Math.floor(size * 0.7);
    function commit(kind, pts) {
      const i0 = X.length; starts.push(i0);
      pts.forEach((p) => { x = p.x; z = p.z; h = p.h; push(p.sf != null ? p.sf : kind.surf, p.fl || 0, p.w); });
      if (kind.reg) kind.reg(i0, X.length - 1, pts);
      if (F.surfaces && biome.plan.slow > 0 && pts.length >= 12 && kind.surf !== SURF.ICE && !kind.make && !kind.noSelf && i0 > 40 && i0 - lastSlow > 90 && slowCount < slowMax && rng() < Math.min(0.4, biome.plan.slow * 1.3)) {
        const len = 3 + Math.floor(rng() * 2); const q0 = i0 + Math.floor(pts.length / 2) - 1; let ok = true;
        for (let q = q0; q < q0 + len; q++) if (q >= X.length || FL[q] !== 0 || SF[q] !== SURF.ASPHALT || items.some((it) => it.b != null && q >= it.a - 3 && q <= it.b + 3)) { ok = false; break; }
        if (ok) { for (let q = q0; q < q0 + len; q++) SF[q] = SURF.SLOW; lastSlow = X.length; slowCount++; }
      }
    }
    const sgn = () => { const toward = Math.atan2(-x, -z); let d = toward - h; while (d > Math.PI) d -= 2 * Math.PI; while (d < -Math.PI) d += 2 * Math.PI; const bias = Math.min(0.85, Math.hypot(x, z) / maxR); return (rng() < 0.5 + 0.4 * bias * Math.sign(d || 1)) ? 1 : -1; };
    const lastPinEnd = () => { let m = -999; items.forEach((it) => { if (it.t === "region" && it.b > m) m = it.b; }); return m; };
    const pinOK = () => X.length - lastPinEnd() >= 26;
    const lastMag = () => { let m = -9999; items.forEach((it) => { if (it.t === "mag" && it.b > m) m = it.b; }); return m; };
    const lastOf = (t) => { let m = -9999; items.forEach((it) => { if (it.t === t && it.a > m) m = it.a; }); return m; };
    const room = () => targetLen - STEP * X.length;
    const straightPts = (n, w, fl) => { const out = []; let cx = x, cz = z; for (let i = 0; i < n; i++) { cx += Math.sin(h) * STEP; cz += Math.cos(h) * STEP; out.push({ x: cx, z: cz, h, w: w || hw, fl: fl || 0 }); } return out; };

    // ---------- pièces classiques ----------
    function kStraight() {
      const len = rad(40, 90), surf = pickSurf(); const boost = F.boosts && len > 50 && rng() < 0.4; const bump = F.jumps && len > 70 && rng() < 0.4 && surf !== SURF.ICE && pinOK();
      const n = Math.max(1, Math.round(len / STEP));
      return { surf, parts: [{ straight: len }], reg(i0, i1) {
        if (boost) { const m = i1 - Math.floor(n / 2); for (let i = 0; i < 4; i++) { const q = m - 2 + i; if (q > 2) { FL[q] |= FLAG.BOOST; SF[q] = SURF.BOOST; } } }
        if (bump) { const R = 1.0 + rng() * 0.6 + diff * 0.05; const idx = i1 - n + Math.floor(n * 0.35); const a = idx - 8, b = idx + 12; const ofs = []; for (let i = a; i <= b; i++) ofs.push(i <= idx ? R * sm((i - a) / 8) : i <= idx + 2 ? R * (1 - (i - idx) / 2) : 0); FL[idx] |= FLAG.JUMP; items.push({ t: "region", a, b, ofs }); items.push({ t: "bump", a: idx }); }
      } };
    }
    const exitBoost = (i1) => { for (let i = 0; i < 4; i++) { const q = i1 - 1 - i; if (q > 2) { FL[q] |= FLAG.BOOST; SF[q] = SURF.BOOST; } } };
    const kCurve = () => { const s = sgn(); const eb = F.boosts && rng() < 0.3; return { surf: pickSurf(), parts: [{ straight: rad(6, 16) }, { angle: s * ang(25, 80), radius: rad(30, 70) }], reg(i0, i1) { if (eb) exitBoost(i1); } }; };
    // virage serré où la route se resserre au sommet de la courbe. La trajectoire doit être exacte
    const kTight = () => { const s = sgn(); const k = Math.max(3.1 / hw, 0.55); return { surf: pickSurf(), parts: [{ straight: rad(8, 14) }, { angle: s * ang(70, 120), radius: rad(26, 40) }, { straight: 6 }], wf: (f) => (f < 0.25 ? 1 + (k - 1) * sm(f / 0.25) : f < 0.8 ? k : k + (1 - k) * sm((f - 0.8) / 0.2)), reg(i0, i1) { items.push({ t: "neck", a: i0, b: i1 }); } }; };
    // enchaînement rapide de petits virages en sens inverse
    const kEsses = () => { const s = sgn(); const R = rad(17, 25); const a1 = ang(32, 48); const cnt = pick([4, 5]); const parts = []; for (let q = 0; q < cnt; q++) parts.push({ angle: (q % 2 ? -1 : 1) * s * (q === 0 || q === cnt - 1 ? a1 * 0.75 : a1 * 1.5), radius: R }); return { surf: pickSurf(), parts }; };
    // deux épingles dans le même sens, un grand U
    const kDouble = () => { const s = sgn(); return { surf: pickSurf(), parts: [{ straight: rad(6, 10) }, { angle: s * ang(85, 125), radius: rad(18, 26) }, { straight: rad(4, 12) }, { angle: s * ang(70, 110), radius: rad(18, 26) }] }; };
    const kHairpin = () => { const s = sgn(); return { surf: pickSurf(), parts: [{ straight: rad(6, 12) }, { angle: s * ang(110, 170), radius: rad(15, 24) }] }; };
    const kBends = () => { const s = sgn(); return { surf: pickSurf(), parts: [{ angle: s * ang(30, 70), radius: rad(38, 70) }, { angle: -s * ang(30, 70), radius: rad(38, 70) }] }; };
    const kChic = () => { const s = sgn(); return { surf: pickSurf(), parts: [{ angle: s * ang(30, 45), radius: rad(20, 28) }, { angle: -s * ang(55, 80), radius: rad(20, 28) }, { angle: s * ang(30, 45), radius: rad(20, 28) }] }; };
    const kSweep = () => { const s = sgn(); return { surf: pickSurf(), parts: [{ angle: s * ang(90, 170), radius: rad(70, 120) }] }; };

    // ---------- largeurs variables ----------
    function kNeck() {
      const k = Math.max(2.9 / hw, 0.5); const len = rad(70, 110);
      return { surf: pickSurf(), parts: [{ straight: len }], wf: (f) => (f < 0.3 ? 1 + (k - 1) * sm(f / 0.3) : f < 0.7 ? k : k + (1 - k) * sm((f - 0.7) / 0.3)), reg(i0, i1) { items.push({ t: "neck", a: i0, b: i1 }); } };
    }
    function kArena() {
      const s = sgn(); const big = Math.min(1.85, 15 / hw); return { surf: pickSurf(), parts: [{ straight: 16 }, { angle: s * ang(30, 70), radius: rad(55, 90) }, { straight: 16 }], wf: (f) => 1 + (big - 1) * Math.sin(Math.PI * clamp(f * 1.05, 0, 1)) ** 0.7, reg(i0, i1) { items.push({ t: "arena", a: i0, b: i1 }); } };
    }
    function kPulse() {
      const cyc = pick([2, 3]); const lo = Math.max(3.0 / hw, 0.58); return { surf: pickSurf(), parts: [{ straight: rad(90, 130) }], wf: (f) => (1 + lo) / 2 + (1 - lo) / 2 * Math.cos(2 * Math.PI * cyc * f) * 1 + (cyc === 3 ? 0.2 : 0.1) * Math.sin(Math.PI * f), reg(i0, i1) { items.push({ t: "neck", a: i0, b: i1 }); } };
    }

    // ---------- pentes raides ----------
    function kSteep() {
      if (!pinOK()) return null; const type = pick(["col", "creux", "russes", "falaise", "col", "grande", "toboggan"]); const hf = [0.6, 0.8, 1, 1.25][hillsLvl]; const Dh = rad(9, 22) * hf; const sl = rad(0.28, 0.5);
      let segs;
      if (type === "col") { const L1 = Dh / sl; segs = [{ L: 24, dy: 0 }, { L: L1, dy: Dh }, { L: 14, dy: 0 }, { L: Dh / rad(0.3, 0.5), dy: -Dh }, { L: 24, dy: 0 }]; }
      else if (type === "creux") { const L1 = Dh / rad(0.3, 0.5); segs = [{ L: 24, dy: 0 }, { L: L1, dy: -Dh }, { L: 14, dy: 0 }, { L: Dh / sl, dy: Dh }, { L: 24, dy: 0 }]; }
      else if (type === "grande") { const D3 = rad(18, 34) * hf; segs = [{ L: 24, dy: 0 }, { L: D3 / rad(0.16, 0.26), dy: D3 }, { L: 20, dy: 0 }, { L: D3 / rad(0.2, 0.3), dy: -D3 }, { L: 24, dy: 0 }]; }
      else if (type === "toboggan") { const D3 = rad(16, 30) * hf; segs = [{ L: 24, dy: 0 }, { L: D3 / rad(0.18, 0.3), dy: -D3 }, { L: 16, dy: 0 }, { L: D3 / rad(0.16, 0.26), dy: D3 }, { L: 24, dy: 0 }]; }
      else if (type === "falaise") { const D2 = Dh * 0.8; segs = [{ L: 24, dy: 0 }, { L: D2 / 0.6, dy: -D2 }, { L: 18, dy: 0 }, { L: D2 / 0.34, dy: D2 }, { L: 24, dy: 0 }]; }
      else { const k = 3 + Math.floor(rng() * 3); const D = rad(3.5, 6) * Math.max(0.8, hf); segs = [{ L: 24, dy: 0 }]; for (let q = 0; q < k; q++) { segs.push({ L: 30, dy: D }); segs.push({ L: 30, dy: -D }); } segs.push({ L: 24, dy: 0 }); }
      const total = segs.reduce((a, s2) => a + s2.L, 0); const n = Math.round(total / STEP) + 6;
      if (total + 10 > room() - 100) return null;
      return { surf: pickSurf(), parts: [{ straight: n * STEP }], reg(i0, i1) { const ofs = slopeProfile(segs, n); const o0 = ofs[2]; const arr = []; for (let i = 2; i <= n - 3; i++) arr.push(ofs[i] - o0); items.push({ t: "region", a: i0 + 2, b: i1 - 2, ofs: arr }); items.push({ t: "steep", a: i0, type }); } };
    }

    // ---------- obstacles ----------
    function laneFor(i0, i1, list) {
      // couloir autorisé pour le centre de la voiture, échantillon par échantillon, d'après les obstacles de la liste
      const lo = [], hi = [];
      for (let i = i0; i <= i1; i++) { const lim = W[i] - 1.25; let a = -lim, b = lim; list.forEach((o) => { if (Math.abs(o.i - i) <= 4) { if (o.side < 0) a = Math.max(a, o.u + o.r + 1.45); else b = Math.min(b, o.u - o.r - 1.45); } }); lo.push(a); hi.push(b); }
      return { lo, hi };
    }
    function kObstacles() {
      const pattern = pick(["slalom", "slalom", "barriere", "portail", "ilot", "ilot"]); const cw = 2.8 + (5 - diff) * 0.35; const types = biome.id === "bonbons" ? ["cone", "barrel"] : ["cone", "barrel", "crate", "pillar"];
      const lenS = pattern === "slalom" || pattern === "ilot" ? rad(120, 190) : pattern === "barriere" ? rad(110, 150) : rad(70, 100); const n = Math.round(lenS / STEP); let sf = pickSurf(); if (sf === SURF.ICE) sf = SURF.ASPHALT;
      return { surf: sf, parts: [{ straight: lenS }], reg(i0, i1) {
        const list = []; const place = (i, u, ty, side) => { list.push({ i, u, r: OBS[ty].r, ty, side }); };
        if (pattern === "slalom") {
          const gap = pick([11, 13, 15]); const ty = pick(types); const off = rad(0.7, 1.5); let sd = rng() < 0.5 ? 1 : -1; for (let i = i0 + 10; i < i1 - 8; i += gap) { place(i, sd * off, ty, sd); sd = -sd; }
        } else if (pattern === "ilot") {
          const ty = pick(["pillar", "barrel", "crate"]); let sd = rng() < 0.5 ? 1 : -1; const gap = pick([20, 26]); for (let i = i0 + 12; i < i1 - 10; i += gap) { place(i, 0, ty, sd); sd = -sd; }
        } else if (pattern === "barriere") {
          const ty = pick(["crate", "barrel"]); const tp = OBS[ty]; let sd = rng() < 0.5 ? 1 : -1; const count = 2 + Math.floor(rng() * 2); const sp = Math.floor((n - 24) / count);
          for (let q = 0; q < count; q++) {
            const ic = i0 + 12 + q * sp; const w0 = W[ic]; const cmax = (2 * w0 - 2.7 - cw) / (2 * w0); const c = Math.min(rad(0.42, 0.6), cmax); const mMin = w0 - c * 2 * w0;
            const ms = []; for (let m = w0 - tp.r; m > mMin + tp.r + 0.01; m -= tp.r * 1.7) ms.push(m); ms.push(mMin + tp.r); ms.forEach((m) => place(ic, sd * m, ty, sd)); sd = -sd;
          }
        } else {
          const ty = pick(["pillar", "barrel", "crate"]); const tp = OBS[ty]; const ic = i0 + Math.floor(n / 2); const gc = 1.5 + (5 - diff) * 0.35; const pu = gc + tp.r + 1.45;
          for (const sd of [-1, 1]) { for (let u = pu; u <= W[ic] - tp.r + 0.1; u += tp.r * 1.8) place(ic, sd * u, ty, sd); }
        }
        // le couloir doit rester assez large et tous les obstacles doivent tenir sur la route
        const lane = laneFor(i0 + 2, i1 - 2, list); let ok = list.length > 0; for (let q = 0; q < lane.lo.length; q++) if (lane.hi[q] - lane.lo[q] < cw - 0.01) ok = false;
        list.forEach((o) => { if (Math.abs(o.u) + o.r > W[o.i] + 0.2) ok = false; });
        if (!ok) return;
        list.forEach((o) => items.push({ t: "obs", a: o.i, u: o.u, r: o.r, ty: o.ty })); items.push({ t: "lane", a: i0 + 2, lo: lane.lo, hi: lane.hi }); items.push({ t: "obspat", a: i0, b: i1, pattern });
      } };
    }

    // ---------- saut au-dessus du vide ----------
    function kGap() {
      if (!pinOK() || room() < 560) return null;
      const T0 = pick(size <= 2 ? [0.75, 0.95] : [0.75, 0.95, 1.3]); const vk = T0 * airG / 2; const dl = pick([0, 1.2, 2.5]); const tf = flightTime(vk, airG, dl);
      const Hg = rad(5, 9); const nUp = Math.ceil(1.5 * Hg / (0.2 * STEP)); const nK = 6; const nFlat = Math.max(8, Math.ceil(100 / STEP) - nUp - nK); const La = STEP * (nUp + nFlat + nK);
      const vA = accelSpeed(La, WEAK.vmax, WEAK.acc) * 0.94; const Gmax = vA * 0.8 * tf; const Gs = Math.max(4, Math.round(clamp(Gmax * rad(0.55, 1), 8, 44) / STEP)); const G = Gs * STEP;
      const vreq = (G + 1.2) / tf; const L2 = clamp(VTOP * tf - G + 30, 70, 160); const nLand = Math.ceil(L2 / STEP); const hk = 2.4; const hland = Hg + hk - dl; const nDown = Math.max(18, Math.ceil(1.5 * hland / (0.22 * STEP)));
      const N = 4 + nUp + nFlat + nK + (Gs - 1) + 1 + nLand + nDown + 4; if (N * STEP > room() - 120) return null;
      return { surf: SURF.ASPHALT, parts: [{ straight: N * STEP }], reg(i0, i1) {
        const ofs = []; for (let i = 0; i < 4; i++) ofs.push(0);
        for (let i = 1; i <= nUp; i++) ofs.push(Hg * sm(i / nUp)); for (let i = 1; i <= nFlat; i++) ofs.push(Hg); for (let i = 1; i <= nK; i++) ofs.push(Hg + hk * i / nK);
        const lip = i0 + ofs.length - 1; const lipO = Hg + hk; for (let i = 1; i < Gs; i++) ofs.push(lipO + (hland - lipO) * i / Gs); ofs.push(hland); for (let i = 1; i < nLand; i++) ofs.push(hland); for (let i = 1; i <= nDown; i++) ofs.push(hland * (1 - sm(i / nDown))); while (ofs.length < i1 - i0 + 1) ofs.push(0); ofs.length = i1 - i0 + 1;
        for (let i = lip + 1; i < lip + Gs; i++) FL[i] |= FLAG.GAP; FL[lip] |= FLAG.KICK | FLAG.JUMP;
        items.push({ t: "region", a: i0, b: i1, ofs }); items.push({ t: "gap", a: i0, cp: i0 + 3, lip, land: lip + Gs, vk, tf, vreq, G, La });
      } };
    }

    // ---------- pont étroit sans murs ----------
    function kBridge() {
      if (!pinOK() || room() < 400) return null;
      const Hb = rad(6, 10); const nUp = Math.ceil(1.5 * Hb / (0.2 * STEP)); const nB = Math.round(rad(40, 70)); const N = 4 + nUp + nB + nUp + 4; if (N * STEP > room() - 100) return null;
      const wb = clamp(hw * 0.55, 3.0, 4.2) / hw; const nb = Math.min(nB, 40);
      return { surf: SURF.ASPHALT, parts: [{ straight: N * STEP }], wf: (f) => { const i = f * N; const lo = 4 + nUp * 0.5, hi = 4 + nUp + nB + nUp * 0.5; return i < lo ? 1 : i < lo + 8 ? 1 + (wb - 1) * sm((i - lo) / 8) : i < hi - 8 ? wb : i < hi ? wb + (1 - wb) * sm((i - (hi - 8)) / 8) : 1; }, reg(i0, i1) {
        const ofs = []; for (let i = 0; i < 4; i++) ofs.push(0); for (let i = 1; i <= nUp; i++) ofs.push(Hb * sm(i / nUp)); for (let i = 1; i <= nB; i++) ofs.push(Hb); for (let i = 1; i <= nUp; i++) ofs.push(Hb * (1 - sm(i / nUp))); while (ofs.length < i1 - i0 + 1) ofs.push(0); ofs.length = i1 - i0 + 1;
        for (let i = i0 + 4 + Math.floor(nUp * 0.55); i < i0 + 4 + nUp + nB + Math.floor(nUp * 0.45); i++) FL[i] |= FLAG.NOWALL;
        items.push({ t: "region", a: i0, b: i1, ofs }); items.push({ t: "bridge", a: i0, cp: i0 + 3 });
      } };
    }

    // ---------- corniche, route surélevée sans mur qui tourne ----------
    function kCorniche() {
      if (!pinOK() || room() < 420 || diff < 2) return null;
      const s = sgn(); const Hb = rad(5, 8); const nUp = Math.ceil(1.5 * Hb / (0.2 * STEP));
      const parts = [{ straight: STEP * (nUp + 10) }, { angle: s * ang(40, 75), radius: rad(36, 55) }, { angle: -s * ang(25, 55), radius: rad(36, 55) }, { straight: STEP * (nUp + 10) }];
      const wb = clamp(hw * 0.62, 3.0, 4.2) / hw;
      return { surf: SURF.ASPHALT, parts, wf: (f) => (f < 0.22 ? 1 : f < 0.33 ? 1 + (wb - 1) * sm((f - 0.22) / 0.11) : f < 0.67 ? wb : f < 0.78 ? wb + (1 - wb) * sm((f - 0.67) / 0.11) : 1), reg(i0, i1) {
        const N = i1 - i0 + 1; const up = Math.min(nUp, Math.floor(N * 0.3)); const ofs = []; for (let i = 0; i < N; i++) { const a = i - 4, b = N - 1 - i - 4; ofs.push(Hb * Math.min(sm(Math.max(0, a) / up), sm(Math.max(0, b) / up))); }
        for (let i = i0 + 4 + Math.floor(up * 0.55); i < i1 - 4 - Math.floor(up * 0.55); i++) FL[i] |= FLAG.NOWALL;
        items.push({ t: "region", a: i0, b: i1, ofs }); items.push({ t: "bridge", a: i0, cp: i0 + 3 });
      } };
    }

    // ---------- zones sans gravité ----------
    // une courbe fine en 3D est rééchantillonnée tous les 2 m. Chaque échantillon reçoit un repère (tangente et haut de la route)
    const arcPos = (L, turn, t) => { if (!turn) return { a: L * t, b: 0 }; const Rc = L / Math.abs(turn), al = turn * t; const bb = Rc * (1 - Math.cos(al)); return { a: Rc * Math.sin(Math.abs(al)), b: turn > 0 ? -bb : bb }; };
    function magPiece(def) {
      const h0 = h, F0 = [Math.sin(h0), 0, Math.cos(h0)], R0 = [-Math.cos(h0), 0, Math.sin(h0)];
      const nPre = 8, nPost = 10; const w = def.w; const pre = [], post = [];
      let cx = x, cz = z; for (let i = 1; i <= nPre; i++) { cx += F0[0] * STEP; cz += F0[2] * STEP; pre.push({ x: cx, z: cz, h: h0, w: hw + (w - hw) * sm(i / nPre), fl: 0 }); }
      const O = [cx + F0[0] * STEP, 0, cz + F0[2] * STEP]; // début de la courbe
      const fine = def.fine; const M = fine.length; const cl = new Float64Array(M); const P = fine.map((q) => [O[0] + F0[0] * q.a + R0[0] * q.b, q.c, O[2] + F0[2] * q.a + R0[2] * q.b]);
      for (let i = 1; i < M; i++) cl[i] = cl[i - 1] + Math.hypot(P[i][0] - P[i - 1][0], P[i][1] - P[i - 1][1], P[i][2] - P[i - 1][2]);
      const total = cl[M - 1]; const K = Math.max(6, Math.round(total / STEP));
      const at = (s) => { s = clamp(s, 0, total); let lo = 0, hi = M - 1; while (hi - lo > 1) { const m = (lo + hi) >> 1; if (cl[m] <= s) lo = m; else hi = m; } const u = (s - cl[lo]) / Math.max(1e-9, cl[hi] - cl[lo]); const A = P[lo], B = P[hi]; return { p: [A[0] + (B[0] - A[0]) * u, A[1] + (B[1] - A[1]) * u, A[2] + (B[2] - A[2]) * u], th: fine[lo].th + (fine[hi].th - fine[lo].th) * u, nl: fine[lo].nl && fine[hi].nl ? [fine[lo].nl[0] + (fine[hi].nl[0] - fine[lo].nl[0]) * u, fine[lo].nl[1] + (fine[hi].nl[1] - fine[lo].nl[1]) * u] : null }; };
      const nrm = (v) => { const l = Math.hypot(v[0], v[1], v[2]) || 1; return [v[0] / l, v[1] / l, v[2] / l]; };
      const cross = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
      const dot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
      const frames = [], pos = []; let lastH = h0; const yOfs = [];
      for (let k = 0; k <= K; k++) {
        const s = total * k / K; const cur = at(s); const A = at(s - 0.6), B = at(s + 0.6); const T = nrm([B.p[0] - A.p[0], (k === 0 || k === K) ? 0 : B.p[1] - A.p[1], B.p[2] - A.p[2]]);
        let U;
        if (cur.nl) { const n3 = [F0[0] * cur.nl[0], cur.nl[1], F0[2] * cur.nl[0]]; U = nrm([n3[0] - dot(n3, T) * T[0], n3[1] - dot(n3, T) * T[1], n3[2] - dot(n3, T) * T[2]]); }
        else { const U0 = nrm([-T[1] * T[0], 1 - T[1] * T[1], -T[1] * T[2]]); const R1 = cross(T, U0); const c = Math.cos(cur.th), sn = Math.sin(cur.th); U = nrm([U0[0] * c + R1[0] * sn, U0[1] * c + R1[1] * sn, U0[2] * c + R1[2] * sn]); }
        if (def.kind !== "loop" && Math.hypot(T[0], T[2]) > 0.25) { lastH = Math.atan2(T[0], T[2]); while (lastH - h0 > Math.PI) lastH -= 2 * Math.PI; while (lastH - h0 < -Math.PI) lastH += 2 * Math.PI; }
        frames.push([T, U]); pos.push({ x: cur.p[0], z: cur.p[2], h: lastH }); yOfs.push(cur.p[1]);
      }
      const hOut = pos[K].h; let ex = pos[K].x, ez = pos[K].z; for (let i = 1; i <= nPost; i++) { ex += Math.sin(hOut) * STEP; ez += Math.cos(hOut) * STEP; post.push({ x: ex, z: ez, h: hOut, w: w + (hw - w) * sm(i / nPost), fl: 0 }); }
      const pts = pre.slice(); pos.forEach((m) => pts.push({ x: m.x, z: m.z, h: m.h, w: w, fl: FLAG.MAG, sf: SURF.ASPHALT })); post.forEach((p) => pts.push(p));
      pts.mag = { nPre, K, frames, yOfs, kind: def.kind };
      return pts;
    }
    const regMag = () => (i0, i1, pts) => {
      const m = pts.mag; const a = i0 + m.nPre, b = a + m.K; const ofs = []; for (let i = 0; i < m.nPre; i++) ofs.push(0); m.yOfs.forEach((yv) => ofs.push(yv)); for (let i = 0; i < pts.length - m.nPre - m.K - 1; i++) ofs.push(m.yOfs[m.K]);
      const f = []; m.frames.forEach((fr) => { f.push(fr[0][0], fr[0][1], fr[0][2], fr[1][0], fr[1][1], fr[1][2]); });
      items.push({ t: "region", a: i0, b: i1, ofs }); items.push({ t: "mag", a, b, kind: m.kind, f, cp: i0 });
    };
    // hauteur du centre de la route quand elle tourne sur elle-même. Le bord le plus bas reste au dessus du sol
    const rollLift = (th, w, Hc) => w * (Math.sqrt(Math.sin(th) ** 2 + 0.0225) - 0.15) + (Hc + 1.6) * (1 - Math.cos(th)) / 2;
    const magOK = (need) => pinOK() && room() > need && X.length - lastMag() >= 60;
    function kLoop() {
      if (!magOK(300)) return null;
      const R = rad(11.5, 16) * (1 + (size - 1) * 0.03); const wL = Math.min(hw, 6); const sg = rng() < 0.5 ? 1 : -1; const d = (wL + hw + 9) / 0.84; const fine = [];
      const NN = 720; for (let q = 0; q <= NN; q++) { const ph = q / NN * 2 * Math.PI; fine.push({ a: R * Math.sin(ph), b: sg * d * sm(ph / (2 * Math.PI)), c: R * (1 - Math.cos(ph)), th: 0, nl: [-Math.sin(ph), Math.cos(ph)] }); }
      return { surf: SURF.ASPHALT, noSelf: true, make: () => magPiece({ fine, w: wL, kind: "loop" }), reg: regMag() };
    }
    function kRoll() {
      if (!magOK(300)) return null;
      const w = Math.min(hw, 6); const L = rad(80, 120); const fine = []; const NN = 400; const s = rng() < 0.5 ? 1 : -1; const turn = rng() < 0.5 ? 0 : (rng() < 0.5 ? 1 : -1) * ang(20, 40);
      for (let q = 0; q <= NN; q++) { const t = q / NN; const th = s * 2 * Math.PI * sm(t); const ap = arcPos(L, turn, t); fine.push({ a: ap.a, b: ap.b, c: rollLift(th, w, 3), th, nl: null }); }
      return { surf: SURF.ASPHALT, noSelf: true, make: () => magPiece({ fine, w, kind: "roll" }), reg: regMag() };
    }
    function kWall() {
      if (!magOK(300)) return null;
      const w = Math.min(hw, 6); const turn = rng() < 0.5 ? 1 : -1; const A = ang(70, 130); const Rc = rad(50, 75); const fine = []; const NN = 500; const L = A * Rc; const tmax = pick([Math.PI / 2, Math.PI / 2, Math.PI * 0.66]);
      for (let q = 0; q <= NN; q++) { const t = q / NN; const bump = t < 0.25 ? sm(t / 0.25) : t > 0.75 ? sm((1 - t) / 0.25) : 1; const th = -turn * tmax * bump; const ap = arcPos(L, turn * A, t); fine.push({ a: ap.a, b: ap.b, c: rollLift(th, w, 3), th, nl: null }); }
      return { surf: SURF.ASPHALT, noSelf: false, make: () => magPiece({ fine, w, kind: "wall" }), reg: regMag() };
    }
    function kCeiling() {
      if (!magOK(340)) return null;
      const w = Math.min(hw, 6); const La = 44, Lb = rad(50, 80); const L = 2 * La + Lb; const fine = []; const NN = 500; const bend = rng() < 0.5 ? 0 : (rng() < 0.5 ? 1 : -1) * ang(25, 50);
      for (let q = 0; q <= NN; q++) { const t = q / NN; const m = t * L; const th = m < La ? Math.PI * sm(m / La) : m < La + Lb ? Math.PI : Math.PI + Math.PI * sm((m - La - Lb) / La); const ap = arcPos(L, bend, t); fine.push({ a: ap.a, b: ap.b, c: rollLift(th, w, 10), th, nl: null }); }
      return { surf: SURF.ASPHALT, noSelf: true, make: () => magPiece({ fine, w, kind: "ceiling" }), reg: regMag() };
    }

    // ---------- choix de la pièce suivante ----------
    function makeKind() {
      const tw = mood.twist, fl = mood.flow; const cands = [[1.8 * fl, kStraight], [3, kCurve], [(0.7 + diff * 0.8) * tw, kHairpin], [1.6, kBends], [(0.6 + diff * 0.8) * tw, kChic], [1.2 * fl, kSweep], [(0.8 + diff * 0.6) * tw, kTight], [(0.5 + diff * 0.5) * tw, kEsses], [(0.15 + diff * 0.35) * tw, kDouble]];
      if (wild > 0) {
        const k = wild * 0.8 * elemK; const sizeOK = size >= 2;
        if (F.steep) cands.push([2.4 * k * mood.steep, kSteep]);
        if (F.obstacles) cands.push([1.8 * k * mood.obst, kObstacles]);
        if (F.widths) { cands.push([0.8 * k * mood.width, kNeck]); cands.push([0.6 * k * mood.width, kArena]); cands.push([0.5 * k * mood.width, kPulse]); }
        if (F.gaps && sizeOK) cands.push([2.4 * k * mood.gap, kGap]);
        if (F.bridges && sizeOK) { cands.push([1.1 * k * mood.bridge, kBridge]); cands.push([0.9 * k * mood.bridge, kCorniche]); }
        if (F.mag && sizeOK) { cands.push([0.8 * k * mood.mag, kLoop]); cands.push([0.55 * k * mood.mag, kRoll]); cands.push([0.6 * k * mood.mag, kWall]); cands.push([0.4 * k * mood.mag, kCeiling]); }
      }
      const tot = cands.reduce((a, c) => a + c[0], 0); let r = rng() * tot;
      for (let tries = 0; tries < 6; tries++) { let pickF = cands[cands.length - 1][1]; let t = r; for (const c of cands) { if ((t -= c[0]) < 0) { pickF = c[1]; break; } } const kind = pickF(); if (kind) return kind; r = rng() * tot; }
      return kStraight();
    }

    // ---------- pose ----------
    { const kind = { surf: SURF.ASPHALT, parts: [{ straight: 30 }] }; commit(kind, plan(kind)); }
    let tries = 0, last = 0, back = 0; const maxTries = 600 + size * 300;
    while (STEP * X.length < targetLen && tries < maxTries) {
      tries++; const k = makeKind(); const pts = plan(k);
      if (fits(pts, k.noSelf)) { commit(k, pts); last = 0; }
      else if (++last > 25) {
        const f = { surf: SURF.ASPHALT, parts: [{ straight: 20 }] }; const fp = plan(f);
        if (fits(fp)) { commit(f, fp); last = 0; }
        else if (back < 60 && X.length > 60) { // coincé, on recule de quelques pièces pour repartir autrement
          back++; last = 0; let cut = X.length; let removed = 0;
          while (starts.length > 2 && removed < 24 + Math.floor(rng() * 70) && X.length - removed > 40) { cut = starts.pop(); removed = X.length - cut; }
          X.length = H.length = Z.length = W.length = SF.length = FL.length = cut; x = X[cut - 1]; z = Z[cut - 1]; h = H[cut - 1];
          for (let q = items.length - 1; q >= 0; q--) if (items[q].a >= cut) items.splice(q, 1);
          regrid();
        } else break;
      }
    }
    for (const L of [30, 20, 12, 6]) { const kind = { surf: SURF.ASPHALT, parts: [{ straight: L }] }; const pts = plan(kind); if (fits(pts) || L === 6) { commit(kind, pts); break; } }
    const n = X.length;
    // largeur variable discrète sur les routes ordinaires
    if (F.widths) { const p1 = rng() * 6.28, p2 = rng() * 6.28; const special = new Uint8Array(n); items.forEach((it) => { if (it.b != null && (it.t === "region" || it.t === "neck" || it.t === "arena" || it.t === "obspat")) { for (let i = Math.max(0, it.a); i <= Math.min(n - 1, it.b); i++) special[i] = 1; } });
      for (let i = 0; i < n; i++) if (!special[i] && !(FL[i] & (FLAG.MAG | FLAG.NOWALL))) W[i] = Math.round(W[i] * (1 + 0.07 * Math.sin(i * 0.045 + p1) + 0.05 * Math.sin(i * 0.11 + p2)) * 100) / 100;
      // passages étroits, de temps en temps, d'autant plus souvent que le circuit est dur
      if (narrowFrac > 0.01 && n > 140) {
        const m = new Float32Array(n); let i = 40 + Math.floor(rng() * 40);
        while (i < n - 40) { const Ln = Math.round(30 + rng() * 70); const Lw = Math.round(clamp(Ln * (1 - narrowFrac) / narrowFrac * (0.4 + rng() * 1.2), 18, 400)); for (let q = 0; q < Ln && i + q < n; q++) m[i + q] = 1; i += Ln + Lw; }
        let t = m; for (let pass = 0; pass < 3; pass++) { const o = new Float32Array(n); for (let a = 0; a < n; a++) { let sum = 0, c = 0; for (let b = Math.max(0, a - 8); b <= Math.min(n - 1, a + 8); b++) { sum += t[b]; c++; } o[a] = sum / c; } t = o; }
        const steepA = new Set(); items.forEach((it) => { if (it.t === "steep") steepA.add(it.a + 2); });
        const blocked = new Uint8Array(n); items.forEach((it) => { if (it.b != null && (it.t === "neck" || it.t === "arena" || it.t === "obspat" || (it.t === "region" && !steepA.has(it.a)))) for (let a = Math.max(0, it.a); a <= Math.min(n - 1, it.b); a++) blocked[a] = 1; });
        for (let a = 0; a < n; a++) if (FL[a] & (FLAG.MAG | FLAG.NOWALL | FLAG.GAP | FLAG.JUMP | FLAG.KICK)) blocked[a] = 1;
        const dist = new Float32Array(n).fill(1e9); let dd = 1e9; for (let a = 0; a < n; a++) { dd = blocked[a] ? 0 : dd + 1; dist[a] = dd; } dd = 1e9; for (let a = n - 1; a >= 0; a--) { dd = blocked[a] ? 0 : dd + 1; if (dd < dist[a]) dist[a] = dd; }
        for (let a = 0; a < n; a++) { const k = t[a] * clamp((dist[a] - 3) / 14, 0, 1) * clamp((a - 36) / 20, 0, 1) * clamp((n - 40 - a) / 20, 0, 1); if (k <= 0.001) continue; const nw = hwN * (0.95 + 0.1 * Math.sin(a * 0.07 + p2)); if (W[a] > nw) W[a] = Math.round((W[a] + (nw - W[a]) * k) * 100) / 100; }
      } }
    // la ligne de départ est large, pour que tout le monde parte côte à côte. La route se resserre ensuite
    { const wS = Math.max(hw, 9.2); for (let i = 0; i < n; i++) { if (i <= 14) W[i] = Math.max(W[i], wS); else if (i < 34) { const t = (i - 14) / 20; const k = t * t * (3 - 2 * t); W[i] = Math.max(W[i], wS + (hw - wS) * k); } else break; } }

    // ---------- hauteurs ----------
    const noiseF = (() => { const r2 = mulberry32(hashSeed(spec.seed + "hy")); const a = [], b = []; for (let i = 0; i < 6; i++) { a.push(r2() * 6.28); b.push(0.5 + r2()); } return (t) => { let s = 0; for (let i = 0; i < 3; i++) s += Math.sin(t * (0.011 + i * 0.013) * (1 + b[i] * 0.4) + a[i]) / (1 + i); return s; }; })();
    const amp = [0, 1.2, 2.6, 4.2][hillsLvl];
    const nz = new Array(n); for (let i = 0; i < n; i++) { const ramp = Math.min(1, i / 20) * Math.min(1, (n - 1 - i) / 20); nz[i] = noiseF(i) * amp * ramp; }
    const Y = nz.slice(); const BL = 10; const pinned = new Uint8Array(n);
    items.filter((it) => it.t === "region").sort((p, q) => p.a - q.a).forEach((rg) => {
      const yr = nz[rg.a]; const ob = rg.ofs[rg.b - rg.a];
      for (let i = rg.a; i <= rg.b && i < n; i++) { Y[i] = yr + rg.ofs[i - rg.a]; pinned[i] = 1; }
      for (let q = 1; q <= BL; q++) { const s = sm(q / BL); const i1 = rg.a - BL - 1 + q; if (i1 >= 0 && !pinned[i1]) Y[i1] = nz[i1] * (1 - s) + yr * s; const i2 = rg.b + q; if (i2 < n && !pinned[i2]) Y[i2] = (yr + ob) * (1 - sm(q / BL)) + nz[i2] * sm(q / BL); }
    });
    for (let pass = 0; pass < 3; pass++) for (let i = 1; i < n; i++) { if (pinned[i] || pinned[i - 1]) continue; const d = Y[i] - Y[i - 1]; const lim = 0.5; if (d > lim) Y[i] = Y[i - 1] + lim; else if (d < -lim * 1.4) Y[i] = Y[i - 1] - lim * 1.4; }

    // ---------- points de contrôle ----------
    const len = (n - 1) * STEP; const cpEvery = [260, 300, 340, 380, 420][size - 1]; let cps = [];
    for (let d = cpEvery; d < len - 80; d += cpEvery) cps.push(Math.round(d / STEP));
    const bad = new Uint8Array(n); const must = [];
    items.forEach((it) => {
      if (it.t === "mag") { for (let i = it.a - 6; i <= it.b + 6; i++) if (i >= 0 && i < n) bad[i] = 1; must.push(it.cp); }
      if (it.t === "gap") { for (let i = it.cp - 1; i <= it.land + 6; i++) if (i >= 0 && i < n) bad[i] = 1; must.push(it.cp); }
      if (it.t === "bridge") { for (let i = it.a; i <= it.a + 60; i++) if (i >= 0 && i < n) bad[i] = 1; must.push(it.cp); }
    });
    cps = cps.filter((c) => !bad[c]); must.forEach((c) => { if (c > 4 && c < n - 60) cps.push(c); }); cps = Array.from(new Set(cps)).sort((a, b) => a - b);
    // deux points de contrôle trop proches se gênent. On garde celui qui protège un élément spécial
    const mustSet = new Set(must); cps = cps.filter((c, i) => mustSet.has(c) || !cps.some((o) => mustSet.has(o) && Math.abs(o - c) < 14));

    // ---------- décors ----------
    const dec = []; const decRng = mulberry32(hashSeed(spec.seed + "dc")); const cell = 24; const dgrid = new Map();
    for (let i = 0; i < n; i += 2) { const k = Math.floor(X[i] / cell) + "," + Math.floor(Z[i] / cell); if (!dgrid.has(k)) dgrid.set(k, []); dgrid.get(k).push(i); }
    const nearTrack = (px, pz) => { let best = 1e9; const gx = Math.floor(px / cell), gz = Math.floor(pz / cell); for (let a = -2; a <= 2; a++) for (let b = -2; b <= 2; b++) { const l = dgrid.get((gx + a) + "," + (gz + b)); if (!l) continue; for (const i of l) { const d = Math.hypot(X[i] - px, Z[i] - pz) - W[i]; if (d < best) best = d; } } return best; };
    const nDeco = Math.min(900, Math.round(120 + len * 0.28 * (spec.decor == null ? 1 : spec.decor)));
    let minY = 1e9; for (let i = 0; i < n; i++) if (Y[i] < minY) minY = Y[i];
    for (let a = 0; a < nDeco * 3 && dec.length < nDeco; a++) {
      const i = Math.floor(decRng() * n); const side = decRng() < 0.5 ? -1 : 1; const off = W[i] + 3 + Math.pow(decRng(), 1.6) * 55;
      const rx = -Math.cos(H[i]), rz = Math.sin(H[i]); const px = X[i] + rx * off * side, pz = Z[i] + rz * off * side;
      if (nearTrack(px, pz) < 2.5 + (FL[i] & FLAG.MAG ? 14 : 0)) continue; const k = biome.deco[Math.floor(decRng() * biome.deco.length)];
      dec.push({ k, x: +px.toFixed(1), z: +pz.toFixed(1), s: +(0.8 + decRng() * 0.9).toFixed(2), r: +(decRng() * 6.28).toFixed(2) });
    }

    // ---------- éléments : obstacles, couloirs, repères 3D ----------
    const round = (a, d) => a.map((v) => +v.toFixed(d));
    const obs = items.filter((it) => it.t === "obs").map((it) => { const i = it.a; const rx = -Math.cos(H[i]), rz = Math.sin(H[i]); const ti = OBS_IDS.indexOf(it.ty); return { x: +(X[i] + rx * it.u).toFixed(2), z: +(Z[i] + rz * it.u).toFixed(2), y: +Y[i].toFixed(2), r: it.r, h: OBS[it.ty].h, t: ti, i, u: +it.u.toFixed(2) }; });
    const lanes = items.filter((it) => it.t === "lane").map((it) => ({ a: it.a, lo: round(it.lo, 2), hi: round(it.hi, 2) }));
    const magsOut = items.filter((it) => it.t === "mag").map((it) => ({ a: it.a, b: it.b, k: it.kind, f: round(it.f, 4) }));
    const gapsOut = items.filter((it) => it.t === "gap").map((it) => ({ cp: it.cp, lip: it.lip, land: it.land, vk: +it.vk.toFixed(3), tf: +it.tf.toFixed(3), vreq: +it.vreq.toFixed(2), G: it.G, La: it.La }));
    const kicks = gapsOut.map((g) => ({ i: g.lip, vy: g.vk }));
    const stats = { loops: 0, rolls: 0, walls: 0, ceilings: 0, gaps: gapsOut.length, steep: items.filter((it) => it.t === "steep").length, bridges: items.filter((it) => it.t === "bridge").length, necks: items.filter((it) => it.t === "neck" || it.t === "arena").length, obstacles: items.filter((it) => it.t === "obspat").length, bumps: items.filter((it) => it.t === "bump").length };
    items.filter((it) => it.t === "mag").forEach((it) => { if (it.kind === "loop") stats.loops++; else if (it.kind === "roll") stats.rolls++; else if (it.kind === "wall") stats.walls++; else stats.ceilings++; });
    return {
      version: 2, spec: Object.assign({}, spec), biome: biome.id, name: biome.names[Math.floor(rng() * biome.names.length)], n, step: STEP, length: len, gravity: biome.gravity, airG: +airG.toFixed(3),
      x: round(X, 2), z: round(Z, 2), y: round(Y, 2), h: round(H, 3), w: round(W, 2), surf: SF, flags: FL, cps, groundY: +(minY - 1.2).toFixed(2), decor: dec,
      mags: magsOut, gaps: gapsOut, kicks, obs, lanes, stats,
      start: { x: X[2], z: Z[2], y: +Y[2].toFixed(2), h: H[2], idx: 2 },
    };
  }
  function generate(spec) {
    const size = clamp(spec.size || 2, 1, 5); const want = [700, 1100, 1700, 2800, 4200][size - 1] * 0.82; let best = null;
    for (let a = 0; a < (size >= 4 ? 14 : 8); a++) { const t = build(spec, a); if (!best || t.length > best.length) best = t; if (t.length >= want) return t; }
    return best;
  }

  // ---------- accès communs (voiture, robots, rendu) ----------
  const magCache = new WeakMap();
  function magMap(tr) {
    let m = magCache.get(tr); if (m) return m; const id = new Int16Array(tr.n).fill(-1); (tr.mags || []).forEach((g, k) => { for (let i = g.a; i <= g.b && i < tr.n; i++) id[i] = k; });
    m = { id }; magCache.set(tr, m); return m;
  }
  const _fr = { px: 0, py: 0, pz: 0, tx: 0, ty: 0, tz: 0, ux: 0, uy: 0, uz: 0, rx: 0, ry: 0, rz: 0 };
  // repère de la route à l'indice idx (fractionnaire) dans la zone sans gravité mg. Renvoie un objet réutilisé
  function frameAt(tr, mg, idx) {
    const f = mg.f; let t = clamp(idx, mg.a, mg.b - 1e-9); let i = Math.floor(t); const u = t - i; if (i >= mg.b) { i = mg.b - 1; }
    const k = (i - mg.a) * 6, k2 = k + 6; const o = _fr;
    o.px = tr.x[i] + (tr.x[i + 1] - tr.x[i]) * u; o.py = tr.y[i] + (tr.y[i + 1] - tr.y[i]) * u; o.pz = tr.z[i] + (tr.z[i + 1] - tr.z[i]) * u;
    let tx = f[k] + (f[k2] - f[k]) * u, ty = f[k + 1] + (f[k2 + 1] - f[k + 1]) * u, tz = f[k + 2] + (f[k2 + 2] - f[k + 2]) * u; let l = Math.hypot(tx, ty, tz) || 1; tx /= l; ty /= l; tz /= l;
    let ux = f[k + 3] + (f[k2 + 3] - f[k + 3]) * u, uy = f[k + 4] + (f[k2 + 4] - f[k + 4]) * u, uz = f[k + 5] + (f[k2 + 5] - f[k + 5]) * u; const d = ux * tx + uy * ty + uz * tz; ux -= d * tx; uy -= d * ty; uz -= d * tz; l = Math.hypot(ux, uy, uz) || 1; ux /= l; uy /= l; uz /= l;
    o.tx = tx; o.ty = ty; o.tz = tz; o.ux = ux; o.uy = uy; o.uz = uz;
    o.rx = ty * uz - tz * uy; o.ry = tz * ux - tx * uz; o.rz = tx * uy - ty * ux; return o;
  }
  // le sol existe-t-il à l'indice idx ? Un saut retire le sol entre l'élan et la réception
  function solidAt(tr, idx) { const fl = tr.flags; let i = Math.floor(idx); if (i < 0) i = 0; if (i > tr.n - 2) i = tr.n - 2; return !((fl[i] | fl[i + 1]) & FLAG.GAP); }
  const obsCache = new WeakMap();
  function obsBuckets(tr) {
    let m = obsCache.get(tr); if (m) return m; m = new Map(); (tr.obs || []).forEach((o) => { const k = Math.floor(o.i / 6); let l = m.get(k); if (!l) { l = []; m.set(k, l); } l.push(o); }); obsCache.set(tr, m); return m;
  }
  const laneCache = new WeakMap();
  // couloir libre au point idx (entier), ou null
  function laneAt(tr, i) {
    let m = laneCache.get(tr); if (!m) { m = new Map(); (tr.lanes || []).forEach((ln) => { for (let q = 0; q < ln.lo.length; q++) m.set(ln.a + q, [ln.lo[q], ln.hi[q]]); }); laneCache.set(tr, m); }
    return m.get(i) || null;
  }
  return { STEP, SURF, SURF_NAMES, FLAG, BIOMES, BIOME_IDS, AIRK, WEAK, VTOP, OBS, OBS_IDS, mulberry32, hashSeed, generate, magMap, frameAt, solidAt, obsBuckets, laneAt, accelSpeed };
});

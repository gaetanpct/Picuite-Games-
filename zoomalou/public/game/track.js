// ============================================================
// ZOOMALOU — Générateur de circuits (partagé serveur et client)
// Un circuit est une ligne centrale échantillonnée tous les 2 m avec hauteur, largeur et sol.
// Départ en 0,0 vers +z. Cap h = 0 vers +z, un cap croissant tourne vers la gauche.
// ============================================================
(function (root, factory) {
  if (typeof module !== "undefined" && module.exports) module.exports = factory();
  else root.ZoomTrack = factory();
})(typeof window !== "undefined" ? window : globalThis, function () {
  const STEP = 2;
  const SURF = { ASPHALT: 0, DIRT: 1, ICE: 2, BOOST: 3, SLOW: 4 };
  const FLAG = { BOOST: 1, JUMP: 2 };
  const SURF_NAMES = ["Bitume", "Terre", "Glace", "Turbo", "Collant"];

  function mulberry32(a) { return function () { a |= 0; a = (a + 0x6d2b79f5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }
  function hashSeed(s) { s = String(s); let h = 2166136261; for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); } return h >>> 0; }

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

  function build(spec, attempt) {
    const rng = mulberry32(hashSeed(spec.seed + "zt" + (attempt ? "#" + attempt : "")));
    const biome = BIOMES[spec.biome] || BIOMES.cote;
    const diff = Math.max(1, Math.min(5, spec.difficulty || 3)), size = Math.max(1, Math.min(5, spec.size || 2));
    const hillsLvl = Math.max(0, Math.min(3, spec.hills == null ? 2 : spec.hills));
    const feats = Object.assign({ boosts: true, jumps: true, surfaces: true }, spec.features || {});
    const targetLen = [700, 1100, 1700, 2800, 4200][size - 1] * (0.92 + rng() * 0.16);
    const maxR = [330, 440, 600, 820, 1050][size - 1];
    const hw = [9, 8, 7, 6.3, 5.6][diff - 1];
    const X = [], Z = [], H = [], W = [], SF = [], FL = [];
    let x = 0, z = 0, h = 0;
    const jumpsAt = [];
    const push = (surf, flag, hwv) => { X.push(x); Z.push(z); H.push(h); W.push(hwv || hw); SF.push(surf); FL.push(flag || 0); };
    // le premier échantillon et la grille de départ
    const pickSurf = () => {
      if (!feats.surfaces) return SURF.ASPHALT;
      const r = rng(); const p = biome.plan; const k = 0.5 + 0.2 * (spec.surfaceVar == null ? 2 : spec.surfaceVar) * 0.5;
      if (r < p.ice * k * 1.4) return SURF.ICE; if (r < (p.ice + p.dirt) * k * 1.4) return SURF.DIRT; if (r < (p.ice + p.dirt + p.slow) * k * 1.4) return SURF.SLOW; return SURF.ASPHALT;
    };
    push(SURF.ASPHALT, 0);
    // simule un segment sans l'ajouter pour tester les croisements
    function plan(kind) {
      const pts = []; let cx = x, cz = z, ch = h;
      const walk = (len, dAng) => { const n = Math.max(1, Math.round(len / STEP)); const dh = dAng / n; for (let i = 0; i < n; i++) { ch += dh * 0.5; cx += Math.sin(ch) * STEP; cz += Math.cos(ch) * STEP; ch += dh * 0.5; pts.push({ x: cx, z: cz, h: ch }); } };
      kind.parts.forEach((p) => { if (p.straight) walk(p.straight, 0); else walk(Math.abs(p.angle) * p.radius, p.angle); });
      return pts;
    }
    function fits(pts) {
      const lim = (2 * hw + 7) * (2 * hw + 7); const old = X.length - 28;
      for (let i = 0; i < pts.length; i++) {
        const p = pts[i]; if (Math.hypot(p.x, p.z) > maxR) return false;
        for (let j = 0; j < old; j++) { const dx = X[j] - p.x, dz = Z[j] - p.z; if (dx * dx + dz * dz < lim) return false; }
        for (let j = 0; j < i - 14; j++) { const dx = pts[j].x - p.x, dz = pts[j].z - p.z; if (dx * dx + dz * dz < lim) return false; }
      }
      return true;
    }
    function commit(kind, pts) {
      const surf = kind.surf; let k = 0;
      kind.parts.forEach((p) => { const n = Math.max(1, Math.round((p.straight ? p.straight : Math.abs(p.angle) * p.radius) / STEP)); for (let i = 0; i < n; i++, k++) { x = pts[k].x; z = pts[k].z; h = pts[k].h; push(surf, 0); } });
      if (kind.boost) { const m = X.length - 1 - Math.floor(kind.parts[0].straight / STEP / 2); for (let i = 0; i < 4; i++) { const q = m - 2 + i; if (q > 2) { FL[q] |= FLAG.BOOST; SF[q] = SURF.BOOST; } } }
      if (kind.jump) { jumpsAt.push({ idx: X.length - 1 - Math.floor(kind.parts[0].straight / STEP) + Math.floor(kind.parts[0].straight / STEP * 0.35), R: 1.0 + rng() * 0.6 + diff * 0.05 }); }
    }
    const sgn = () => { const toward = Math.atan2(-x, -z); let d = toward - h; while (d > Math.PI) d -= 2 * Math.PI; while (d < -Math.PI) d += 2 * Math.PI; const bias = Math.min(0.85, Math.hypot(x, z) / maxR); return (rng() < 0.5 + 0.4 * bias * Math.sign(d || 1)) ? 1 : -1; };
    function makeKind() {
      const r = rng(); const s = sgn(); const surf = pickSurf();
      const wS = 3, wC = 4, wH = 0.4 + diff * 0.45, wB = 2, wCh = 0.3 + diff * 0.4, wSw = 1.5; const tot = wS + wC + wH + wB + wCh + wSw; let t = r * tot;
      const rad = (a, b) => a + rng() * (b - a); const ang = (a, b) => (a + rng() * (b - a)) * Math.PI / 180;
      if ((t -= wS) < 0) { const len = rad(40, 90); return { surf, parts: [{ straight: len }], boost: feats.boosts && len > 50 && rng() < 0.45, jump: feats.jumps && len > 70 && rng() < 0.4 && surf !== SURF.ICE }; }
      if ((t -= wC) < 0) return { surf, parts: [{ straight: rad(6, 16) }, { angle: s * ang(25, 80), radius: rad(34, 80) }] };
      if ((t -= wH) < 0) return { surf, parts: [{ straight: rad(6, 12) }, { angle: s * ang(110, 170), radius: rad(15, 24) }] };
      if ((t -= wB) < 0) return { surf, parts: [{ angle: s * ang(30, 70), radius: rad(38, 70) }, { angle: -s * ang(30, 70), radius: rad(38, 70) }] };
      if ((t -= wCh) < 0) return { surf, parts: [{ angle: s * ang(30, 45), radius: rad(20, 28) }, { angle: -s * ang(55, 80), radius: rad(20, 28) }, { angle: s * ang(30, 45), radius: rad(20, 28) }] };
      return { surf, parts: [{ angle: s * ang(90, 170), radius: rad(70, 120) }] };
    }
    // grille de départ droite
    { const kind = { surf: SURF.ASPHALT, parts: [{ straight: 30 }] }; commit(kind, plan(kind)); }
    let tries = 0, last = 0, back = 0; const maxTries = 600 + size * 300;
    while (STEP * X.length < targetLen && tries < maxTries) {
      tries++; const k = makeKind(); const pts = plan(k);
      if (fits(pts)) { commit(k, pts); last = 0; }
      else if (++last > 25) {
        const f = { surf: SURF.ASPHALT, parts: [{ straight: 20 }] }; const fp = plan(f);
        if (fits(fp)) { commit(f, fp); last = 0; }
        else if (back < 60 && X.length > 60) { // coincé, on recule un peu pour repartir autrement
          back++; last = 0; const cut = X.length - Math.min(X.length - 40, 24 + Math.floor(rng() * 70));
          X.length = H.length = Z.length = W.length = SF.length = FL.length = cut; x = X[cut - 1]; z = Z[cut - 1]; h = H[cut - 1];
          for (let q = jumpsAt.length - 1; q >= 0; q--) if (jumpsAt[q].idx >= cut - 14) jumpsAt.splice(q, 1);
        } else break;
      }
    }
    { const kind = { surf: SURF.ASPHALT, parts: [{ straight: 30 }] }; const pts = plan(kind); commit(kind, pts); }
    const n = X.length;
    // la ligne de départ est large, pour que tout le monde parte côte à côte. La route se resserre ensuite
    { const wS = Math.max(hw, 9.2); for (let i = 0; i < n; i++) { if (i <= 14) W[i] = Math.max(W[i], wS); else if (i < 34) { const t = (i - 14) / 20; const k = t * t * (3 - 2 * t); W[i] = Math.max(W[i], wS + (hw - wS) * k); } else break; } }
    // hauteurs
    const noise = (() => { const r2 = mulberry32(hashSeed(spec.seed + "hy")); const a = [], b = []; for (let i = 0; i < 6; i++) { a.push(r2() * 6.28); b.push(0.5 + r2()); } return (t) => { let s = 0; for (let i = 0; i < 3; i++) s += Math.sin(t * (0.011 + i * 0.013) * (1 + b[i] * 0.4) + a[i]) / (1 + i); return s; }; })();
    const amp = [0, 1.2, 2.6, 4.2][hillsLvl];
    const Y = new Array(n).fill(0);
    for (let i = 0; i < n; i++) { const ramp = Math.min(1, i / 20) * Math.min(1, (n - 1 - i) / 20); Y[i] = noise(i) * amp * ramp; }
    jumpsAt.forEach((j) => {
      const i0 = j.idx; const R = j.R; if (i0 < 12 || i0 > n - 14) { j.dead = true; return; }
      for (let i = i0 - 8; i <= i0 + 12 && i < n; i++) {
        if (i < 0) continue; let add;
        if (i <= i0) { const t = (i - (i0 - 8)) / 8; add = R * t * t * (3 - 2 * t); }
        else if (i <= i0 + 2) add = R * (1 - (i - i0) / 2);
        else add = 0;
        Y[i] += add;
      }
      for (let i = i0 + 3; i < i0 + 14 && i < n; i++) FL[i] |= 0; FL[i0] |= FLAG.JUMP;
    });
    // pentes limitées pour que le sol reste roulable
    for (let pass = 0; pass < 3; pass++) for (let i = 1; i < n; i++) { const d = Y[i] - Y[i - 1]; const lim = 0.5; if (d > lim) Y[i] = Y[i - 1] + lim; else if (d < -lim * 1.4) Y[i] = Y[i - 1] - lim * 1.4; }
    // points de contrôle
    const len = (n - 1) * STEP; const cpEvery = [260, 300, 340, 380, 420][size - 1]; const cps = [];
    for (let d = cpEvery; d < len - 80; d += cpEvery) cps.push(Math.round(d / STEP));
    // décors
    const dec = []; const decRng = mulberry32(hashSeed(spec.seed + "dc")); const cell = 24; const grid = new Map();
    for (let i = 0; i < n; i += 2) { const k = Math.floor(X[i] / cell) + "," + Math.floor(Z[i] / cell); if (!grid.has(k)) grid.set(k, []); grid.get(k).push(i); }
    const nearTrack = (px, pz) => { let best = 1e9; const gx = Math.floor(px / cell), gz = Math.floor(pz / cell); for (let a = -2; a <= 2; a++) for (let b = -2; b <= 2; b++) { const l = grid.get((gx + a) + "," + (gz + b)); if (!l) continue; for (const i of l) { const d = Math.hypot(X[i] - px, Z[i] - pz) - W[i]; if (d < best) best = d; } } return best; };
    const nDeco = Math.min(900, Math.round(120 + len * 0.28 * (spec.decor == null ? 1 : spec.decor)));
    let minY = 1e9, maxY = -1e9; for (let i = 0; i < n; i++) { if (Y[i] < minY) minY = Y[i]; if (Y[i] > maxY) maxY = Y[i]; }
    for (let a = 0; a < nDeco * 3 && dec.length < nDeco; a++) {
      const i = Math.floor(decRng() * n); const side = decRng() < 0.5 ? -1 : 1; const off = W[i] + 3 + Math.pow(decRng(), 1.6) * 55;
      const rx = -Math.cos(H[i]), rz = Math.sin(H[i]); const px = X[i] + rx * off * side, pz = Z[i] + rz * off * side;
      if (nearTrack(px, pz) < 2.5) continue; const k = biome.deco[Math.floor(decRng() * biome.deco.length)];
      dec.push({ k, x: +px.toFixed(1), z: +pz.toFixed(1), s: +(0.8 + decRng() * 0.9).toFixed(2), r: +(decRng() * 6.28).toFixed(2) });
    }
    const round = (a, d) => a.map((v) => +v.toFixed(d));
    return {
      version: 1, spec: Object.assign({}, spec), biome: biome.id, name: biome.names[Math.floor(rng() * biome.names.length)], n, step: STEP, length: len, gravity: biome.gravity,
      x: round(X, 2), z: round(Z, 2), y: round(Y, 2), h: round(H, 3), w: round(W, 2), surf: SF, flags: FL, cps, groundY: +(minY - 1.2).toFixed(2), decor: dec,
      start: { x: X[2], z: Z[2], y: Y[2], h: H[2], idx: 2 },
    };
  }
  function generate(spec) {
    const size = Math.max(1, Math.min(5, spec.size || 2)); const want = [700, 1100, 1700, 2800, 4200][size - 1] * 0.82; let best = null;
    for (let a = 0; a < (size >= 4 ? 14 : 8); a++) { const t = build(spec, a); if (!best || t.length > best.length) best = t; if (t.length >= want) return t; }
    return best;
  }
  return { STEP, SURF, SURF_NAMES, FLAG, BIOMES, BIOME_IDS, mulberry32, hashSeed, generate };
});

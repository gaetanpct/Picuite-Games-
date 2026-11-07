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
  const SURF = { ASPHALT: 0, DIRT: 1, ICE: 2, BOOST: 3, SLOW: 4, SUPER: 5, VERGE: 6 };
  // VERGE bas-côté sans barrière, OVER route qui passe au-dessus d'une autre, UNDER route qui passe dessous, FORK cœur d'un embranchement, MOVE route qui bouge
  const FLAG = { BOOST: 1, JUMP: 2, MAG: 4, GAP: 8, NOWALL: 16, KICK: 32, VERGE: 64, OVER: 128, UNDER: 256, FORK: 512, TUNNEL: 1024, MOVE: 2048, XING: 4096, BANK: 8192, CUT: 16384 };
  const SURF_NAMES = ["Bitume", "Terre", "Glace", "Turbo", "Collant", "Super turbo", "Bas-côté"];
  // en vol, la pesanteur est plus forte que sur la route. Les sauts restent courts et lisibles
  const AIRK = 1.9;
  // la voiture la plus lente (Bouboule) sert de référence pour dimensionner les sauts
  const WEAK = { vmax: 45, acc: 18 };
  const VTOP = 96; // vitesse maximale possible en vol, turbo compris
  const OBS = { cone: { r: 0.75, h: 1.4 }, barrel: { r: 1.15, h: 1.7 }, crate: { r: 1.4, h: 2.2 }, pillar: { r: 0.95, h: 5 }, tires: { r: 1.05, h: 1.2 }, rock: { r: 1.5, h: 2.1 }, bale: { r: 1.3, h: 1.6 }, ice: { r: 1.2, h: 1.8 }, crystal: { r: 0.95, h: 2.6 }, nose: { r: 1.2, h: 1.4 } };
  const OBS_IDS = ["cone", "barrel", "crate", "pillar", "tires", "rock", "bale", "ice", "crystal", "nose"];
  // chaque biome a ses propres obstacles
  const OBS_BY = { cote: ["cone", "barrel", "crate", "tires", "bale"], neige: ["cone", "barrel", "ice", "tires", "pillar"], neon: ["pillar", "crystal", "crate", "barrel"], megapole: ["pillar", "cone", "barrel", "crate"], jungle: ["rock", "bale", "barrel", "crate", "tires"], usine: ["crate", "barrel", "pillar", "tires", "cone"], foraine: ["cone", "barrel", "tires", "crate", "bale"], dunes: ["rock", "barrel", "bale", "cone", "tires"] };

  function mulberry32(a) { return function () { a |= 0; a = (a + 0x6d2b79f5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }
  function hashSeed(s) { s = String(s); let h = 2166136261; for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); } return h >>> 0; }
  const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
  const sm = (t) => { t = t < 0 ? 0 : t > 1 ? 1 : t; return t * t * (3 - 2 * t); };

  // el règle la fréquence des éléments propres au biome (1 = normal). verge est la part de route bordée de bas-côtés sans barrière
  const BIOMES = {
    cote: { id: "cote", phys: {}, identity: "Route classique, la référence pour comparer", name: "Côte", icon: "🏖️", sky: ["#4fc8ff", "#fff3d6"], fog: "#d8f1ff", sun: "#fff3d0", amb: "#c8ecff", ground: "#f0dc9c", road: "#5b606c", wall: "#ffffff", curb: ["#ff5a4a", "#ffffff"], gravity: 9.8, plan: { dirt: 0.0, ice: 0, slow: 0.22 }, vergeK: "sable", vergeCol: "#ecd28c",
      el: { verge: 0.25 }, deco: ["palm", "palm", "rock", "parasol", "phare", "bouee"], names: ["Corniche Salée", "Route des Mouettes", "Plage Express", "Marée Basse", "Phare en Vue"] },
    neige: { id: "neige", phys: { grip: 0.86, accel: 0.95 }, identity: "Adhérence réduite partout, glace fréquente et congères sur les bords", name: "Neige", icon: "⛄", sky: ["#9fd4ff", "#f4fbff"], fog: "#e6f3ff", sun: "#ffffff", amb: "#d0e8ff", ground: "#f4f9ff", road: "#4a5666", wall: "#dff0ff", curb: ["#2a6fb0", "#ffffff"], gravity: 9.8, plan: { dirt: 0, ice: 0.45, slow: 0.1 }, vergeK: "neige", vergeCol: "#ffffff",
      el: { verge: 0.45, tunnel: 1.3, fork: 0.9, bank: 1.2 }, deco: ["pine", "pine", "snowman", "rock", "igloo"], names: ["Piste Verglacée", "Col Blanc", "Tobogan Fou", "Sapin Givré", "Lac Gelé"] },
    neon: { id: "neon", phys: { accel: 1.08, grip: 0.94 }, identity: "Gravité faible, grands sauts et anneaux turbo à traverser", name: "Néon", icon: "🪐", sky: ["#07041f", "#3a1f7a"], fog: "#241250", sun: "#c8c0ff", amb: "#6a60c0", ground: "#14104a", road: "#1e1a50", wall: "#5affd8", curb: ["#ff4a8a", "#5affd8"], gravity: 4.6, stars: true, plan: { dirt: 0, ice: 0.2, slow: 0.05 }, vergeK: "gravier", vergeCol: "#2a2470",
      el: { ring: 2.4, gap: 1.4, drop: 1.4, mag: 1.2, verge: 0, cut: 1.6, bank: 1.3 }, deco: ["pylon", "pylon", "asteroid", "crystal", "anneau", "tour"], names: ["Orbite Néon", "Anneau Lumineux", "Piste Stellaire", "Comète Express", "Voie Lactée"] },
    megapole: { id: "megapole", phys: { grip: 1.04 }, identity: "Tubes où l'on roule la tête à l'envers, voies rapides et tunnels", name: "Mégapole", icon: "🏙️", sky: ["#5ab8e8", "#e8f6ff"], fog: "#cfe6f4", sun: "#fff8e8", amb: "#bfe0f4", ground: "#8a96a4", road: "#3a3f4c", wall: "#d8e4ee", curb: ["#21c5e8", "#f2f6fa"], gravity: 9.8, plan: { dirt: 0, ice: 0, slow: 0.08 }, vergeK: "gravier", vergeCol: "#9aa4ae",
      el: { mag: 3.4, tube: 3.4, tubeLen: 1.5, magGap: 22, tunnel: 2.2, bridge: 1.6, cross: 1.6, sup: 1.6, obst: 0.6, steep: 0.6, verge: 0, bank: 2.2, xing: 1.4 }, deco: ["immeuble", "immeuble", "tourverre", "panneau", "immeuble", "antenne"], names: ["Périphérique Zéro", "Voie Suspendue", "Tunnel Azur", "Échangeur Fou", "Quartier des Tours"] },
    jungle: { id: "jungle", phys: { grip: 0.95 }, identity: "Pistes de terre, embranchements partout et tunnels de verdure", name: "Jungle", icon: "🌿", sky: ["#7ad8a0", "#f0ffe8"], fog: "#bfe8c4", sun: "#fff6c0", amb: "#a8e8b8", ground: "#3a8a46", road: "#4f4a3c", wall: "#7a5a32", curb: ["#c25a2a", "#f2e2b4"], gravity: 9.8, plan: { dirt: 0.55, ice: 0, slow: 0.18 }, vergeK: "herbe", vergeCol: "#4fa84e",
      el: { fork: 5, tunnel: 1.6, verge: 0.4, steep: 1.2, mag: 0.4, cut: 1.4, bank: 0.5 }, deco: ["palmier2", "fougere", "tree", "temple", "bambou", "rock"], names: ["Sentier du Jaguar", "Racines Folles", "Temple Perdu", "Liane Express", "Marais Rapide"] },
    usine: { id: "usine", phys: { grip: 1.0 }, identity: "Le circuit bouge, routes en vagues et plateaux qui basculent", name: "Usine", icon: "🏭", sky: ["#e8a46a", "#fbe6c8"], fog: "#e9cfae", sun: "#ffe0b0", amb: "#f0d0a8", ground: "#6e6862", road: "#36363c", wall: "#ffb21a", curb: ["#ffb21a", "#24242a"], gravity: 9.8, plan: { dirt: 0, ice: 0, slow: 0.15 }, vergeK: "gravier", vergeCol: "#8a847c",
      el: { mover: 6, obst: 1.3, cross: 1.2, tunnel: 1.3, sup: 1.4, verge: 0.15, xing: 1.6 }, deco: ["cheminee", "grue", "conteneur", "conteneur", "cuve", "rock"], names: ["Chaîne de Montage", "Haut Fourneau", "Atelier Express", "Piston Fou", "Entrepôt 9"] },
    foraine: { id: "foraine", phys: { grip: 1.02 }, identity: "Montagnes russes, routes qui se croisent et grands plongeons", name: "Fête foraine", icon: "🎡", sky: ["#ff9a8a", "#ffe6c0"], fog: "#ffd8c0", sun: "#fff0d0", amb: "#ffd0c8", ground: "#5aa86a", road: "#5a4a6a", wall: "#ffffff", curb: ["#ff3a6a", "#ffd23f"], gravity: 9.8, plan: { dirt: 0, ice: 0, slow: 0.1 }, vergeK: "herbe", vergeCol: "#6ab86a",
      el: { cross: 6, drop: 2.6, dbl: 2, ring: 1.6, mag: 1.3, gap: 1.2, verge: 0.1, bank: 1.6, xing: 0.45, cut: 1.2 }, deco: ["grandeRoue", "chapiteau", "ballons", "manege", "tree", "ballons"], names: ["Grand Huit", "Train Fantôme", "Chenille Folle", "Barbe à Papa", "Le Plongeon"] },
    dunes: { id: "dunes", phys: { wind: 2.2, grip: 0.97 }, identity: "Presque aucun mur, des bas-côtés de sable, des crêtes et du vent", name: "Dunes", icon: "🏜️", sky: ["#ffa94a", "#fff0cf"], fog: "#ffe2b0", sun: "#fff0c0", amb: "#ffe0b0", ground: "#e9b868", road: "#6a5a4a", wall: "#f2d29a", curb: ["#c0552a", "#f6e2b4"], gravity: 9.8, plan: { dirt: 0.3, ice: 0, slow: 0.08 }, vergeK: "sable", vergeCol: "#f0c878",
      el: { verge: 0.92, steep: 1.6, jumps: 1.6, bridge: 0.5, mag: 0.35, fork: 0.8, cut: 1.8, bank: 0.6 }, deco: ["dune", "cactus", "rock", "dune", "pyramide", "arche"], names: ["Piste Poussiéreuse", "Mirage Rapide", "Mer de Sable", "Dune Furieuse", "Oasis Express"] },
  };
  const BIOME_IDS = Object.keys(BIOMES);
  // grands décors, posés plus loin de la route pour que la caméra ne passe pas au travers
  const BIG_DECO = { grandeRoue: 16, chapiteau: 8, manege: 7, immeuble: 9, tourverre: 7, cheminee: 9, grue: 10, cuve: 6, temple: 7, pyramide: 8, conteneur: 5, phare: 3, arche: 5, dune: 9, panneau: 5 };

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
    const F = Object.assign({ boosts: true, jumps: true, surfaces: true, gaps: true, steep: true, obstacles: true, widths: true, bridges: true, mag: true, forks: true, verges: true, cross: true, movers: true, rings: true, bank: true, xing: true, cut: true }, spec.features || {});
    const EL = Object.assign({ fork: 1, verge: 0.2, cross: 1, tunnel: 1, mover: 0.35, mag: 1, tube: 0.4, magGap: 60, ring: 1, gap: 1, bridge: 1, obst: 1, steep: 1, drop: 1, dbl: 1, sup: 1, jumps: 1, bank: 1, xing: 1, cut: 1 }, biome.el || {});
    const wild = clamp(spec.special == null ? 3 : spec.special, 0, 4);
    const airG = biome.gravity * AIRK;
    const targetLen = [700, 1100, 1700, 2800, 4200][size - 1] * (0.92 + rng() * 0.16);
    const maxR = [330, 440, 600, 820, 1050][size - 1];
    const hwN = [6.6, 5.6, 4.8, 4.2, 3.6][diff - 1]; // demi-largeur des passages étroits
    // chaque course a sa propre largeur de route, plus ou moins large, tirée à part pour ne pas décaler le reste du circuit
    const roadK = (diff >= 4 ? 0.98 : 0.92) + (1.22 - (diff >= 4 ? 0.98 : 0.92)) * mulberry32(hashSeed(spec.seed + "rk"))();
    const hw = hwN * 1.25 * roadK; // demi-largeur ordinaire
    const elemSel = spec.elements || "auto";
    const elemK = elemSel === "peu" ? 0.45 : elemSel === "moyen" ? 1 : elemSel === "beaucoup" ? 1.7 : [0.45, 0.75, 1, 1.35, 1.7][diff - 1];
    // l'ambiance de la course change d'un circuit à l'autre
    const mood = {}; ["steep", "obst", "width", "gap", "bridge", "mag", "twist", "flow"].forEach((k) => { mood[k] = 0.3 + rng() * 1.6; });
    const narrowFrac = clamp([0, 0.18, 0.45, 0.72, 0.95][diff - 1] * (0.7 + rng() * 0.6), 0, 0.93);
    const rad = (a, b) => a + rng() * (b - a), ang = (a, b) => (a + rng() * (b - a)) * Math.PI / 180, pick = (l) => l[Math.floor(rng() * l.length)];
    const X = [], Z = [], H = [], W = [], SF = [], FL = [];
    const items = []; const starts = []; // éléments enregistrés et début de chaque pièce posée
    let x = 0, z = 0, h = 0, wMax = hw;
    const grid = new Map(); const CELL = 24; const blk = []; // couloirs de vol des raccourcis, où rien d'autre ne doit passer
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
        for (let q = 0; q < blk.length; q++) { const o = blk[q]; const dx = o.x - p.x, dz = o.z - p.z, lim = o.r + p.w + 2; if (dx * dx + dz * dz < lim * lim) return false; }
        if (!noSelf) for (let j = 0; j < i - 14; j++) { const lim = pts[j].w + p.w + 7; if ((i - j) * STEP < lim * 1.25) continue; const dx = pts[j].x - p.x, dz = pts[j].z - p.z; if (dx * dx + dz * dz < lim * lim) return false; }
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
    let cur = null; // position courante quand on habille un tracé dessiné
    const pinOK = () => (cur == null ? X.length : cur) - lastPinEnd() >= 26;
    const lastMag = () => { let m = -9999; items.forEach((it) => { if (it.t === "mag" && it.b > m) m = it.b; }); return m; };
    const lastOf = (t) => { let m = -9999; items.forEach((it) => { if (it.t === t && it.a > m) m = it.a; }); return m; };
    const room = () => (cur == null ? targetLen - STEP * X.length : (X.length - 40 - cur) * STEP);
    const straightPts = (n, w, fl) => { const out = []; let cx = x, cz = z; for (let i = 0; i < n; i++) { cx += Math.sin(h) * STEP; cz += Math.cos(h) * STEP; out.push({ x: cx, z: cz, h, w: w || hw, fl: fl || 0 }); } return out; };

    // ---------- pièces classiques ----------
    function kStraight() {
      const len = rad(40, 90), surf = pickSurf(); const boost = F.boosts && len > 50 && rng() < 0.4; const sup = boost && rng() < 0.28 * EL.sup; const bump = F.jumps && len > 70 && rng() < Math.min(0.8, 0.4 * EL.jumps) && surf !== SURF.ICE && pinOK();
      const n = Math.max(1, Math.round(len / STEP));
      return { surf, parts: [{ straight: len }], reg(i0, i1) {
        if (boost) { const m = i1 - Math.floor(n / 2); for (let i = 0; i < (sup ? 3 : 4); i++) { const q = m - 2 + i; if (q > 2) { FL[q] |= FLAG.BOOST; SF[q] = sup ? SURF.SUPER : SURF.BOOST; } } }
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

    // escargot, un virage qui se resserre ou s'ouvre sans jamais s'arrêter de tourner
    const kSpiral = () => { const s = sgn(); const open = rng() < 0.5; const R = open ? [rad(20, 26), rad(34, 46), rad(60, 85)] : [rad(60, 85), rad(34, 46), rad(20, 26)]; const A = [ang(70, 100), ang(80, 110), ang(60, 90)]; return { surf: pickSurf(), parts: [{ straight: rad(6, 12) }].concat(R.map((r, i) => ({ angle: s * A[i], radius: r }))) }; };
    // fer à cheval, demi-tour où la route s'étrangle au sommet
    const kFer = () => { const s = sgn(); const k = Math.max(3.2 / hw, 0.58); return { surf: pickSurf(), parts: [{ straight: rad(8, 14) }, { angle: s * ang(150, 178), radius: rad(26, 36) }, { straight: 8 }], wf: (f) => (f < 0.2 ? 1 + (k - 1) * sm(f / 0.2) : f < 0.8 ? k : k + (1 - k) * sm((f - 0.8) / 0.2)), reg(i0, i1) { items.push({ t: "neck", a: i0, b: i1 }); } }; };
    // grand serpent, quatre courbes alternées dont la route se pince à chaque croisement
    const kSerpent = () => { const s = sgn(); const lo = Math.max(3.1 / hw, 0.6); const parts = []; for (let q = 0; q < 4; q++) parts.push({ angle: (q % 2 ? -1 : 1) * s * ang(40, 58), radius: rad(46, 70) }); return { surf: pickSurf(), parts, wf: (f) => 1 - (1 - lo) * Math.cos(4 * Math.PI * f) ** 2 * sm(Math.min(f, 1 - f) / 0.1), reg(i0, i1) { items.push({ t: "neck", a: i0, b: i1 }); } }; };
    // rond-point, un grand cercle large où chacun choisit sa trajectoire
    const kRond = () => { const s = sgn(); const big = Math.min(1.5, 13 / hw); return { surf: pickSurf(), parts: [{ straight: 14 }, { angle: s * ang(230, 300), radius: rad(56, 74) }, { straight: 14 }], wf: (f) => 1 + (big - 1) * sm(Math.min(f, 1 - f) / 0.12), reg(i0, i1) { items.push({ t: "arena", a: i0, b: i1 }); } }; };
    // entonnoir, la route se rétrécit sur toute sa longueur puis se rouvre d'un coup
    const kEntonnoir = () => { const k = Math.max(3.0 / hw, 0.55); const len = rad(120, 170); return { surf: pickSurf(), parts: [{ straight: len }], wf: (f) => (f < 0.7 ? 1 - (1 - k) * sm(f / 0.7) : k + (1 - k) * sm((f - 0.74) / 0.12)), reg(i0, i1) { items.push({ t: "neck", a: i0, b: i1 }); } }; };
    // lacets, des épingles enchaînées pendant que la route monte puis redescend
    function kLacets() {
      if (!pinOK() || room() < 460) return null;
      const s = sgn(); const R = rad(17, 22); const cnt = pick([2, 3]); const parts = [{ straight: 16 }]; for (let q = 0; q < cnt; q++) { parts.push({ angle: (q % 2 ? -1 : 1) * s * ang(150, 172), radius: R }); parts.push({ straight: rad(10, 18) }); }
      const up = rng() < 0.65; const hf = [0.6, 0.8, 1, 1.25][hillsLvl];
      return { surf: pickSurf(), parts, reg(i0, i1) {
        const N = i1 - i0 + 1; const Dh = Math.min(rad(9, 20) * hf, 0.09 * N * STEP) * (up ? 1 : -1); const arr = []; for (let i = 2; i <= N - 3; i++) { const t = (i - 2) / Math.max(1, N - 5); arr.push(Dh * sm(Math.min(2 * t, 2 - 2 * t))); }
        const o0 = arr[0]; items.push({ t: "region", a: i0 + 2, b: i1 - 2, ofs: arr.map((v) => v - o0) }); items.push({ t: "steep", a: i0, type: "lacets" });
      } };
    }

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
      if (!pinOK()) return null; const type = pick(["col", "creux", "russes", "falaise", "col", "grande", "toboggan", "escalier", "houle", "crete"]); const hf = [0.6, 0.8, 1, 1.25][hillsLvl]; const Dh = rad(9, 22) * hf; const sl = rad(0.28, 0.5);
      let segs;
      if (type === "col") { const L1 = Dh / sl; segs = [{ L: 24, dy: 0 }, { L: L1, dy: Dh }, { L: 14, dy: 0 }, { L: Dh / rad(0.3, 0.5), dy: -Dh }, { L: 24, dy: 0 }]; }
      else if (type === "creux") { const L1 = Dh / rad(0.3, 0.5); segs = [{ L: 24, dy: 0 }, { L: L1, dy: -Dh }, { L: 14, dy: 0 }, { L: Dh / sl, dy: Dh }, { L: 24, dy: 0 }]; }
      else if (type === "grande") { const D3 = rad(18, 34) * hf; segs = [{ L: 24, dy: 0 }, { L: D3 / rad(0.16, 0.26), dy: D3 }, { L: 20, dy: 0 }, { L: D3 / rad(0.2, 0.3), dy: -D3 }, { L: 24, dy: 0 }]; }
      else if (type === "toboggan") { const D3 = rad(16, 30) * hf; segs = [{ L: 24, dy: 0 }, { L: D3 / rad(0.18, 0.3), dy: -D3 }, { L: 16, dy: 0 }, { L: D3 / rad(0.16, 0.26), dy: D3 }, { L: 24, dy: 0 }]; }
      else if (type === "falaise") { const D2 = Dh * 0.8; segs = [{ L: 24, dy: 0 }, { L: D2 / 0.6, dy: -D2 }, { L: 18, dy: 0 }, { L: D2 / 0.34, dy: D2 }, { L: 24, dy: 0 }]; }
      else if (type === "escalier") { const st = 3 + Math.floor(rng() * 2); const D = rad(2.6, 3.5) * Math.max(0.8, hf); segs = [{ L: 24, dy: 0 }]; for (let q = 0; q < st; q++) { segs.push({ L: rad(8, 10), dy: D }); segs.push({ L: rad(12, 16), dy: 0 }); } segs.push({ L: st * D / rad(0.25, 0.34), dy: -st * D }); segs.push({ L: 24, dy: 0 }); }
      else if (type === "houle") { const k = 3 + Math.floor(rng() * 2); const A = rad(5, 8) * Math.max(0.8, hf); segs = [{ L: 24, dy: 0 }]; for (let q = 0; q < k; q++) { segs.push({ L: rad(42, 55), dy: A }); segs.push({ L: rad(42, 55), dy: -A }); } segs.push({ L: 24, dy: 0 }); }
      else if (type === "crete") { const L1 = Dh / sl; const L3 = Dh / rad(0.3, 0.5); segs = [{ L: 24, dy: 0 }, { L: L1, dy: Dh }, { L: 46, dy: 0 }, { L: L3, dy: -Dh }, { L: 24, dy: 0 }]; }
      else { const k = 3 + Math.floor(rng() * 3); const D = rad(3.5, 6) * Math.max(0.8, hf); segs = [{ L: 24, dy: 0 }]; for (let q = 0; q < k; q++) { segs.push({ L: 30, dy: D }); segs.push({ L: 30, dy: -D }); } segs.push({ L: 24, dy: 0 }); }
      const total = segs.reduce((a, s2) => a + s2.L, 0); const n = Math.round(total / STEP) + 6;
      if (total + 10 > room() - 100) return null;
      let wfc = null; if (type === "crete") { const kk = Math.max(3.0 / hw, 0.55); const a0 = (24 + segs[1].L) / total, b0 = a0 + 46 / total; wfc = (f) => 1 - (1 - kk) * clamp(sm((f - (a0 - 0.05)) / 0.06) - sm((f - b0 + 0.02) / 0.06), 0, 1); }
      return { surf: pickSurf(), parts: [{ straight: n * STEP }], wf: wfc || undefined, reg(i0, i1) { if (type === "crete") items.push({ t: "neck", a: i0 + 2, b: i1 - 2 }); const ofs = slopeProfile(segs, n); const o0 = ofs[2]; const arr = []; for (let i = 2; i <= n - 3; i++) arr.push(ofs[i] - o0); items.push({ t: "region", a: i0 + 2, b: i1 - 2, ofs: arr }); items.push({ t: "steep", a: i0, type }); } };
    }

    // ---------- obstacles ----------
    function laneFor(i0, i1, list) {
      // couloir autorisé pour le centre de la voiture, échantillon par échantillon, d'après les obstacles de la liste
      const lo = [], hi = [];
      for (let i = i0; i <= i1; i++) { const lim = W[i] - 1.25; let a = -lim, b = lim; list.forEach((o) => { if (Math.abs(o.i - i) <= 4) { if (o.side < 0) a = Math.max(a, o.u + o.r + 1.45); else b = Math.min(b, o.u - o.r - 1.45); } }); lo.push(a); hi.push(b); }
      return { lo, hi };
    }
    function kObstacles() {
      const pattern = pick(["slalom", "slalom", "barriere", "portail", "ilot", "ilot", "entonnoir", "balayage"]); const cw = 2.8 + (5 - diff) * 0.35; const types = OBS_BY[biome.id] || ["cone", "barrel", "crate", "pillar"];
      const bigT = types.filter((t) => OBS[t].r >= 0.95 && t !== "crystal"); const wideT = bigT.filter((t) => t !== "pillar"); const pk2 = (l, d) => { const a = l.length ? l : d; return pick(a); };
      const lenS = pattern === "slalom" || pattern === "ilot" || pattern === "entonnoir" || pattern === "balayage" ? rad(120, 190) : pattern === "barriere" ? rad(110, 150) : rad(70, 100); const n = Math.round(lenS / STEP); let sf = pickSurf(); if (sf === SURF.ICE) sf = SURF.ASPHALT;
      return { surf: sf, parts: [{ straight: lenS }], reg(i0, i1) {
        const list = []; const place = (i, u, ty, side) => { list.push({ i, u, r: OBS[ty].r, ty, side }); };
        if (pattern === "slalom") {
          const gap = pick([11, 13, 15]); const ty = pick(types); const off = rad(0.7, 1.5); let sd = rng() < 0.5 ? 1 : -1; for (let i = i0 + 10; i < i1 - 8; i += gap) { place(i, sd * off, ty, sd); sd = -sd; }
        } else if (pattern === "ilot") {
          const ty = pk2(bigT, ["pillar", "barrel", "crate"]); let sd = rng() < 0.5 ? 1 : -1; const gap = pick([20, 26]); for (let i = i0 + 12; i < i1 - 10; i += gap) { place(i, 0, ty, sd); sd = -sd; }
        } else if (pattern === "entonnoir") {
          // des paires d'obstacles se resserrent autour d'un passage qui ondule, puis se rouvrent
          const ty = pk2(wideT, ["barrel", "crate"]); const r0 = OBS[ty].r; const rows = 7 + Math.floor(rng() * 3); const sp = Math.floor((n - 28) / rows); const A = rad(1.2, 2.6); const ph = rng() * 6.28;
          for (let q = 0; q < rows; q++) { const ic = i0 + 14 + q * sp; const t = q / (rows - 1); const gh = Math.max(cw / 2 + 0.15, (W[ic] - r0 - 2.2) * (1 - 0.85 * Math.sin(Math.PI * t))); const gc = A * Math.sin(ph + t * 6.28 * 1.1);
            const ul = gc - gh - r0 - 1.45, ur = gc + gh + r0 + 1.45; if (Math.abs(ul) + r0 <= W[ic] + 0.1) place(ic, ul, ty, -1); if (Math.abs(ur) + r0 <= W[ic] + 0.1) place(ic, ur, ty, 1); }
        } else if (pattern === "balayage") {
          // une ligne d'obstacles traverse la route en diagonale, il faut changer de côté à chaque fois
          const ty = pk2(wideT, ["barrel", "crate"]); const r0 = OBS[ty].r; const K = 6 + Math.floor(rng() * 3); const sp = Math.floor((n - 28) / K); const dir = rng() < 0.5 ? 1 : -1;
          for (let q = 0; q < K; q++) { const ic = i0 + 14 + q * sp; const span = Math.max(0, W[ic] - r0 - 1.0); const u = dir * (-span + 2 * span * q / (K - 1)); place(ic, u, ty, u <= 0 ? -1 : 1); }
        } else if (pattern === "barriere") {
          const ty = pk2(wideT, ["crate", "barrel"]); const tp = OBS[ty]; let sd = rng() < 0.5 ? 1 : -1; const count = 2 + Math.floor(rng() * 2); const sp = Math.floor((n - 24) / count);
          for (let q = 0; q < count; q++) {
            const ic = i0 + 12 + q * sp; const w0 = W[ic]; const cmax = (2 * w0 - 2.7 - cw) / (2 * w0); const c = Math.min(rad(0.42, 0.6), cmax); const mMin = w0 - c * 2 * w0;
            const ms = []; for (let m = w0 - tp.r; m > mMin + tp.r + 0.01; m -= tp.r * 1.7) ms.push(m); ms.push(mMin + tp.r); ms.forEach((m) => place(ic, sd * m, ty, sd)); sd = -sd;
          }
        } else {
          const ty = pk2(bigT, ["pillar", "barrel", "crate"]); const tp = OBS[ty]; const ic = i0 + Math.floor(n / 2); const gc = 1.5 + (5 - diff) * 0.35; const pu = gc + tp.r + 1.45;
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
    // variantes. simple, double (deux trous à la suite), plongeon (réception bien plus bas, trou plus long), montant (réception plus haut)
    function kGap(variant) {
      if (!pinOK() || room() < (variant === "double" ? 820 : 560)) return null;
      variant = variant || "simple";
      let T0 = pick(size <= 2 ? [0.75, 0.95] : [0.75, 0.95, 1.3]); if (variant === "montant") T0 = Math.max(T0, 1.1);
      const vk = T0 * airG / 2; let dl = pick([0, 1.2, 2.5]);
      if (variant === "plongeon") dl = rad(6, 9);
      if (variant === "montant") dl = -Math.min(2.2, vk * vk / (2 * airG) * 0.55);
      const tf = flightTime(vk, airG, dl);
      const Hg = rad(5, 9); const nUp = Math.ceil(1.5 * Hg / (0.2 * STEP)); const nK = 6; const nFlat = Math.max(8, Math.ceil(100 / STEP) - nUp - nK); const La = STEP * (nUp + nFlat + nK);
      const vA = accelSpeed(La, WEAK.vmax, WEAK.acc) * 0.94; const Gmax = vA * 0.8 * tf; const Gs = Math.max(4, Math.round(clamp(Gmax * rad(0.55, 1), 8, variant === "plongeon" ? 56 : 44) / STEP)); const G = Gs * STEP;
      const vreq = (G + 1.2) / tf; const L2 = clamp(VTOP * tf - G + 30, 70, 170); const nLand = Math.ceil(L2 / STEP); const hk = 2.4; const hland = Hg + hk - dl;
      // second saut, plus court, posé sur la réception du premier
      const dbl = variant === "double"; const vk2 = 0.75 * airG / 2; const tf2 = flightTime(vk2, airG, 0); const Gs2 = dbl ? Math.max(4, Math.round(clamp(vreq * 0.7 * tf2 * 0.8, 8, 22) / STEP)) : 0; const vreq2 = dbl ? (Gs2 * STEP + 1.2) / tf2 : 0; const L3 = dbl ? clamp(VTOP * tf2 - Gs2 * STEP + 30, 60, 140) : 0; const nLand3 = Math.ceil(L3 / STEP); const nK2 = 6, hk2 = 1.6, nRun = 26;
      const hEnd = dbl ? hland + hk2 : hland;
      const nDown = Math.max(18, Math.ceil(1.5 * Math.abs(hEnd) / (0.22 * STEP)));
      const N = 4 + nUp + nFlat + nK + (Gs - 1) + 1 + nLand + (dbl ? nRun + nK2 + Gs2 + nLand3 : 0) + nDown + 4; if (N * STEP > room() - 120) return null;
      return { surf: SURF.ASPHALT, parts: [{ straight: N * STEP }], reg(i0, i1) {
        const ofs = []; for (let i = 0; i < 4; i++) ofs.push(0);
        for (let i = 1; i <= nUp; i++) ofs.push(Hg * sm(i / nUp)); for (let i = 1; i <= nFlat; i++) ofs.push(Hg); for (let i = 1; i <= nK; i++) ofs.push(Hg + hk * i / nK);
        const lip = i0 + ofs.length - 1; const lipO = Hg + hk; for (let i = 1; i < Gs; i++) ofs.push(lipO + (hland - lipO) * i / Gs); ofs.push(hland);
        let lip2 = -1;
        if (dbl) {
          for (let i = 1; i < nRun; i++) ofs.push(hland); for (let i = 1; i <= nK2; i++) ofs.push(hland + hk2 * i / nK2);
          lip2 = i0 + ofs.length - 1; for (let i = 1; i < Gs2; i++) ofs.push(hland + hk2); ofs.push(hland + hk2); for (let i = 1; i < nLand3; i++) ofs.push(hland + hk2);
        } else { for (let i = 1; i < nLand; i++) ofs.push(hland); }
        for (let i = 1; i <= nDown; i++) ofs.push(hEnd * (1 - sm(i / nDown))); while (ofs.length < i1 - i0 + 1) ofs.push(0); ofs.length = i1 - i0 + 1;
        for (let i = lip + 1; i < lip + Gs; i++) FL[i] |= FLAG.GAP; FL[lip] |= FLAG.KICK | FLAG.JUMP;
        items.push({ t: "region", a: i0, b: i1, ofs }); items.push({ t: "gap", a: i0, cp: i0 + 3, lip, land: lip + Gs, vk, tf, vreq, G, La, v: variant });
        if (dbl) { for (let i = lip2 + 1; i < lip2 + Gs2; i++) FL[i] |= FLAG.GAP; FL[lip2] |= FLAG.KICK | FLAG.JUMP; items.push({ t: "gap", a: lip2 - 4, cp: i0 + 3, lip: lip2, land: lip2 + Gs2, vk: vk2, tf: tf2, vreq: Math.max(vreq2, 0), G: Gs2 * STEP, La: STEP * nRun, v: "double2" }); }
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

    // ---------- viaduc, une seule grande courbe surélevée sans rebord ----------
    function kViaduc() {
      if (!pinOK() || room() < 460 || diff < 2) return null;
      const s = sgn(); const Hb = rad(6, 10); const nUp = Math.ceil(1.5 * Hb / (0.2 * STEP)); const wb = clamp(hw * 0.66, 3.2, 4.6) / hw;
      const parts = [{ straight: STEP * (nUp + 8) }, { angle: s * ang(60, 140), radius: rad(70, 110) }, { straight: STEP * (nUp + 8) }];
      return { surf: SURF.ASPHALT, parts, wf: (f) => (f < 0.2 ? 1 : f < 0.3 ? 1 + (wb - 1) * sm((f - 0.2) / 0.1) : f < 0.7 ? wb : f < 0.8 ? wb + (1 - wb) * sm((f - 0.7) / 0.1) : 1), reg(i0, i1) {
        const N = i1 - i0 + 1; const up = Math.min(nUp, Math.floor(N * 0.28)); const ofs = []; for (let i = 0; i < N; i++) { const a2 = i - 4, b2 = N - 1 - i - 4; ofs.push(Hb * Math.min(sm(Math.max(0, a2) / up), sm(Math.max(0, b2) / up))); }
        for (let i = i0 + 4 + Math.floor(up * 0.6); i < i1 - 4 - Math.floor(up * 0.6); i++) FL[i] |= FLAG.NOWALL;
        items.push({ t: "region", a: i0, b: i1, ofs }); items.push({ t: "bridge", a: i0, cp: i0 + 3, k: "viaduc" });
      } };
    }
    // ---------- passerelle, très étroite avec une bosse au milieu ----------
    function kPasserelle() {
      if (!pinOK() || room() < 420 || diff < 3) return null;
      const Hb = rad(6, 9); const nUp = Math.ceil(1.5 * Hb / (0.2 * STEP)); const nB = Math.round(rad(36, 56)); const N = 4 + nUp + nB + nUp + 4; if (N * STEP > room() - 100) return null;
      const wb = clamp(3.0, 2.8, 3.3) / hw; const hump = rad(1.4, 2.4);
      return { surf: SURF.ASPHALT, parts: [{ straight: N * STEP }], wf: (f) => { const i = f * N; const lo = 4 + nUp * 0.5, hi = 4 + nUp + nB + nUp * 0.5; return i < lo ? 1 : i < lo + 8 ? 1 + (wb - 1) * sm((i - lo) / 8) : i < hi - 8 ? wb : i < hi ? wb + (1 - wb) * sm((i - (hi - 8)) / 8) : 1; }, reg(i0, i1) {
        const ofs = []; for (let i = 0; i < 4; i++) ofs.push(0); for (let i = 1; i <= nUp; i++) ofs.push(Hb * sm(i / nUp)); for (let i = 1; i <= nB; i++) { const t = i / nB; ofs.push(Hb + hump * Math.sin(Math.PI * t) ** 2); } for (let i = 1; i <= nUp; i++) ofs.push(Hb * (1 - sm(i / nUp))); while (ofs.length < i1 - i0 + 1) ofs.push(0); ofs.length = i1 - i0 + 1;
        for (let i = i0 + 4 + Math.floor(nUp * 0.55); i < i0 + 4 + nUp + nB + Math.floor(nUp * 0.45); i++) FL[i] |= FLAG.NOWALL;
        items.push({ t: "region", a: i0, b: i1, ofs }); items.push({ t: "bridge", a: i0, cp: i0 + 3, k: "passerelle" });
      } };
    }
    // ---------- pont ondulé, surélevé et sans rebord, la route monte et descend ----------
    function kPontVague() {
      if (!pinOK() || room() < 460) return null;
      const Hb = rad(6, 9); const nUp = Math.ceil(1.5 * Hb / (0.2 * STEP)); const nB = Math.round(rad(60, 90)); const N = 4 + nUp + nB + nUp + 4; if (N * STEP > room() - 100) return null;
      const wb = clamp(hw * 0.7, 3.3, 4.8) / hw; const A = rad(1.0, 1.7); const per = pick([22, 28]);
      return { surf: SURF.ASPHALT, parts: [{ straight: N * STEP }], wf: (f) => { const i = f * N; const lo = 4 + nUp * 0.5, hi = 4 + nUp + nB + nUp * 0.5; return i < lo ? 1 : i < lo + 8 ? 1 + (wb - 1) * sm((i - lo) / 8) : i < hi - 8 ? wb : i < hi ? wb + (1 - wb) * sm((i - (hi - 8)) / 8) : 1; }, reg(i0, i1) {
        const ofs = []; for (let i = 0; i < 4; i++) ofs.push(0); for (let i = 1; i <= nUp; i++) ofs.push(Hb * sm(i / nUp)); for (let i = 1; i <= nB; i++) { const env = sm(Math.min(i, nB - i) / 8); ofs.push(Hb + A * env * Math.sin(2 * Math.PI * i / per)); } for (let i = 1; i <= nUp; i++) ofs.push(Hb * (1 - sm(i / nUp))); while (ofs.length < i1 - i0 + 1) ofs.push(0); ofs.length = i1 - i0 + 1;
        for (let i = i0 + 4 + Math.floor(nUp * 0.55); i < i0 + 4 + nUp + nB + Math.floor(nUp * 0.45); i++) FL[i] |= FLAG.NOWALL;
        items.push({ t: "region", a: i0, b: i1, ofs }); items.push({ t: "bridge", a: i0, cp: i0 + 3, k: "vague" });
      } };
    }
    // ---------- tunnel, la route passe sous une voûte ----------
    function kTunnel() {
      if (room() < 300) return null;
      const s = sgn(); const curved = rng() < 0.55; const k = Math.max(3.6 / hw, 0.8);
      const parts = curved ? [{ straight: 16 }, { angle: s * ang(30, 80), radius: rad(60, 100) }, { straight: 16 }] : [{ straight: rad(90, 150) }];
      return { surf: SURF.ASPHALT, parts, wf: (f) => 1 + (k - 1) * sm(Math.min(f, 1 - f) / 0.15), reg(i0, i1) { for (let i = i0 + 4; i <= i1 - 4; i++) FL[i] |= FLAG.TUNNEL; items.push({ t: "tunnel", a: i0 + 4, b: i1 - 4 }); items.push({ t: "neck", a: i0, b: i1 }); } };
    }
    // ---------- croisement, la route fait un grand tour en montant et repasse au-dessus d'elle-même ----------
    function kCross() {
      if (X.length - lastPinEnd() < 12 || room() < 700) return null;
      const s = sgn(); const R = rad(36, 50); const Lin = R + rad(34, 52); const Hc = rad(8.6, 10.5); const nd = Math.ceil(Hc / 0.24 / STEP); const Lout = R + hw + 10 + nd * STEP + 24;
      const parts = [{ straight: Lin }, { angle: s * Math.PI * 1.5, radius: R }, { straight: Lout }];
      return { surf: SURF.ASPHALT, noSelf: true, parts, reg(i0, i1) {
        const N = i1 - i0 + 1; const a1 = Math.round(Lin / STEP), a2 = a1 + Math.round(1.5 * Math.PI * R / STEP), ix = a2 + Math.round(R / STEP); const hold = ix + Math.ceil((hw + 9) / STEP);
        const ofs = []; for (let j = 0; j < N; j++) { let v = 0; if (j >= a1 && j < a2) v = Hc * sm((j - a1) / (a2 - a1)); else if (j >= a2 && j <= hold) v = Hc; else if (j > hold) v = Hc * (1 - sm((j - hold) / nd)); ofs.push(+v.toFixed(3)); }
        items.push({ t: "region", a: i0, b: i1, ofs }); items.push({ t: "cross", a: i0, b: i1, cp: i0 + 3 });
      } };
    }
    // ---------- carrefour à niveau, la route fait un grand tour et recoupe son propre passage à la même hauteur ----------
    // en mode contact les voitures des deux passages peuvent se percuter au milieu
    function kCarrefour() {
      if (X.length - lastPinEnd() < 12 || room() < 640) return null;
      const s = sgn(); const R = rad(34, 46); const Lin = R + rad(30, 46); const Lout = R + hw + 40;
      const parts = [{ straight: Lin }, { angle: s * Math.PI * 1.5, radius: R }, { straight: Lout }];
      return { surf: SURF.ASPHALT, noSelf: true, parts, reg(i0, i1) {
        const N = i1 - i0 + 1; items.push({ t: "region", a: i0, b: i1, ofs: new Array(N).fill(0) });
        // les deux passages au plus près l'un de l'autre, puis les bouts de route à l'intérieur du croisement
        let best = 1e9, ja = -1, jb = -1; for (let a = i0; a <= i1; a++) for (let b = a + 30; b <= i1; b++) { const d = Math.hypot(X[a] - X[b], Z[a] - Z[b]); if (d < best) { best = d; ja = a; jb = b; } }
        if (ja < 0 || best > 3) return;
        for (let q = i0; q <= i1; q++) { const o = Math.abs(q - ja) < Math.abs(q - jb) ? jb : ja; let m = 1e9; for (let k = o - 14; k <= o + 14; k++) { if (k < i0 || k > i1) continue; m = Math.min(m, Math.hypot(X[q] - X[k], Z[q] - Z[k]) - W[k]); } if (m < 2.5) FL[q] |= FLAG.XING; }
        items.push({ t: "xing", a: i0, b: i1, cp: i0 + 3, ja, jb });
      } };
    }
    // ---------- virage relevé, une grande courbe inclinée vers l'intérieur qu'on prend bien plus vite qu'un virage plat ----------
    function kBank() {
      if (room() < 260) return null;
      const s = sgn(); const R = rad(24, 40); const A = ang(110, 200); const tilt = clamp(0.24 + diff * 0.03 + rng() * 0.1, 0.24, 0.42);
      const L0 = 16; return { surf: SURF.ASPHALT, parts: [{ straight: L0 }, { angle: s * A, radius: R }, { straight: L0 }], reg(i0, i1) {
        const N = i1 - i0 + 1; const a = Math.round(L0 / STEP), b = N - 1 - Math.round(L0 / STEP); const arr = [];
        for (let j = 0; j < N; j++) { const e = sm((j - a + 9) / 14) * sm((b + 9 - j) / 14); arr.push(+(s * tilt * e).toFixed(3)); if (e > 0.05) FL[i0 + j] |= FLAG.BANK; }
        items.push({ t: "bank", a: i0, b: i1, B: arr });
      } };
    }
    // ---------- raccourci par les airs, la route fait un grand détour en Ω et un tremplin d'un côté permet de couper tout droit ----------
    // le détour est sûr. Le saut fait gagner du temps, mais trop lent on tombe court et on revient au point de contrôle
    function kCut() {
      if (!pinOK() || room() < 620 || size < 2) return null;
      const s = sgn(); const R = rad(18, 23); const R2 = Math.max(rad(9, 12), hw + 4.5); const L = rad(4, 8); const Lapp = rad(80, 100); const Lout = rad(70, 90);
      const D = 2 * R + 2 * R2; const vA = accelSpeed(Lapp, WEAK.vmax, WEAK.acc); const vreq = Math.min(36, vA * 0.86); const vk = airG * (D - 5) / (2 * vreq);
      const parts = [{ straight: Lapp }, { angle: s * Math.PI / 2, radius: R }, { straight: L }, { angle: -s * Math.PI, radius: R2 }, { straight: L }, { angle: s * Math.PI / 2, radius: R }, { straight: Lout }];
      const ns = parts.map((p) => Math.max(1, Math.round((p.straight ? p.straight : Math.abs(p.angle) * p.radius) / STEP)));
      return { surf: SURF.ASPHALT, parts, reg(i0, i1) {
        const N = i1 - i0 + 1; const lip = i0 + ns[0] - 1; const land = i0 + ns[0] + ns[1] + ns[2] + ns[3] + ns[4] + ns[5];
        if (land >= i1 - 6) return; items.push({ t: "region", a: i0, b: i1, ofs: new Array(N).fill(0) });
        // le tremplin occupe le côté opposé au détour
        const side = s > 0 ? 1 : -1; const wl = W[lip]; const u0 = side > 0 ? 0.6 : -wl + 0.6, u1 = side > 0 ? wl - 0.6 : -0.6;
        const ax = X[lip], az = Z[lip], bx = X[land], bz = Z[land]; const Dm = Math.hypot(bx - ax, bz - az);
        for (let d = 8; d < Dm - 16; d += 4) { const t = d / Dm; blk.push({ x: ax + (bx - ax) * t, z: az + (bz - az) * t, r: 3.2, a: i0 }); }
        for (let q = lip - 2; q <= lip; q++) FL[q] |= FLAG.CUT;
        items.push({ t: "cut", a: i0, b: i1, cp: i0 + 3, lip, land, u0: +u0.toFixed(2), u1: +u1.toFixed(2), vk: +vk.toFixed(3), vreq: +vreq.toFixed(2), D: +Dm.toFixed(2) });
      } };
    }
    // ---------- route qui bouge, en vagues qui roulent vers le pilote ou en plateau qui bascule ----------
    function kMover() {
      if (room() < 360) return null;
      const k = rng() < 0.55 ? "vague" : "bascule"; const len = k === "vague" ? rad(110, 160) : rad(70, 100);
      const A = k === "vague" ? rad(0.9, 1.6) : rad(1.5, 2.4); const Tp = k === "vague" ? rad(2.4, 3.4) : rad(3.0, 4.4); const ph = rng() * 6.28; const Lw = rad(26, 40);
      return { surf: SURF.ASPHALT, parts: [{ straight: len }], reg(i0, i1) { const a2 = i0 + 6, b2 = i1 - 6; for (let i = a2; i <= b2; i++) FL[i] |= FLAG.MOVE; items.push({ t: "mover", a: a2, b: b2, k, A: +A.toFixed(2), T: +Tp.toFixed(2), ph: +ph.toFixed(2), L: +Lw.toFixed(1) }); items.push({ t: "neck", a: i0, b: i1 }); } };
    }
    // ---------- embranchement, deux voies séparées par un terre-plein qui se rejoignent plus loin ----------
    // la voie intérieure d'un virage est plus courte mais elle a un défaut, terre, saut, obstacles, étroite ou dans un tunnel. L'autre est longue mais sûre, parfois avec des turbos
    function kFork() {
      if (room() < 560) return null;
      const shape = pick(["arc", "arc", "arc", "droit", "S"]); const s = sgn();
      const wl = clamp(hw * 0.62, 3.3, 5.2); const M = rad(3.5, 8.5);
      let parts;
      if (shape === "arc") parts = [{ straight: 34 }, { angle: s * ang(55, 100), radius: rad(85, 120) }, { straight: 34 }];
      else if (shape === "S") parts = [{ straight: 30 }, { angle: s * ang(35, 55), radius: rad(90, 120) }, { angle: -s * ang(35, 55), radius: rad(90, 120) }, { straight: 30 }];
      else parts = [{ straight: rad(160, 220) }];
      const inner = shape === "arc" ? (s > 0 ? 0 : 1) : (rng() < 0.5 ? 0 : 1);
      const riskT = pick(shape === "arc" ? ["terre", "saut", "obst", "etroit", "tunnel", "saut"] : ["saut", "obst", "saut", "tunnel"]); const safeT = pick(shape === "arc" ? ["turbo", "large", "turbo", "bitume"] : ["turbo", "large", "bitume"]);
      const wRisk = riskT === "etroit" || riskT === "tunnel" ? Math.max(2.9, wl * 0.74) : wl; const wSafe = safeT === "large" ? Math.min(6.2, wl * 1.18) : wl;
      const wA = inner === 0 ? wRisk : wSafe, wB = inner === 0 ? wSafe : wRisk;
      const env = (f) => sm(f / 0.2) * sm((1 - f) / 0.2); const lw = (f, wt) => hw / 2 + (wt - hw / 2) * sm(f / 0.13) * sm((1 - f) / 0.13);
      return { surf: SURF.ASPHALT, parts, wf: (f) => (M * env(f) + 2 * Math.max(lw(f, wA), lw(f, wB))) / hw, reg(i0, i1) {
        const N = i1 - i0 + 1; const m = [], wa = [], wb = []; for (let j = 0; j < N; j++) { const f = j / (N - 1); m.push(+(M * env(f)).toFixed(2)); wa.push(+lw(f, wA).toFixed(2)); wb.push(+lw(f, wB).toFixed(2)); }
        let c0 = -1, c1 = -1; for (let j = 0; j < N; j++) if (m[j] >= 0.8) { if (c0 < 0) c0 = j; c1 = j; } if (c0 < 0 || c1 - c0 < 30) return;
        const lanes = [0, 1].map((k) => ({ t: k === inner ? riskT : safeT, s: SURF.ASPHALT, dy: null }));
        const ctr = (k, j) => (k === 0 ? -(m[j] + wa[j]) : m[j] + wb[j]); const half = (k, j) => (k === 0 ? wa[j] : wb[j]);
        const forkObs = [];
        lanes.forEach((ln, k) => {
          if (ln.t === "terre" && F.surfaces) ln.s = biome.id === "neige" ? SURF.ICE : SURF.DIRT;
          if (ln.t === "saut") { const dy = new Array(N).fill(0); const p0 = c0 + Math.floor((c1 - c0) * 0.25), len = Math.max(12, Math.floor((c1 - c0) * 0.34)); const Hc = rad(2.6, 3.8); for (let q = 0; q <= len && p0 + q < N; q++) dy[p0 + q] = +(Hc * sm(q / len)).toFixed(2); const drop = Math.max(4, Math.round(Hc / 0.85)); for (let q = 1; q <= drop && p0 + len + q < N; q++) dy[p0 + len + q] = +(Hc * (1 - q / drop)).toFixed(2); ln.dy = dy; ln.crest = i0 + p0 + len; }
          if (ln.t === "turbo" && F.boosts) { [0.3, 0.66].forEach((fr) => { const j = c0 + Math.floor((c1 - c0) * fr); const c = ctr(k, j), h = half(k, j) - 0.4; items.push({ t: "pad", a: i0 + j - 2, b: i0 + j + 2, u0: +(c - h).toFixed(2), u1: +(c + h).toFixed(2), k: rng() < 0.35 * EL.sup ? 2 : 1 }); }); }
          if (ln.t === "obst" && F.obstacles) { const tys = (OBS_BY[biome.id] || ["cone", "barrel"]).filter((t) => OBS[t].r <= 1.2); const ty = tys.length ? pick(tys) : "cone"; let sd = rng() < 0.5 ? 1 : -1; for (let j = c0 + 12; j < c1 - 10; j += 13) { const c = ctr(k, j), h = half(k, j); forkObs.push({ i: i0 + j, u: c + sd * h * 0.42, r: OBS[ty].r, ty }); sd = -sd; } }
          if (ln.t === "tunnel") items.push({ t: "tunnel", a: i0 + c0 + 4, b: i0 + c1 - 4, lane: k });
        });
        // couloir libre des robots dans la voie à obstacles, en coordonnée latérale absolue
        const olo = new Array(N).fill(null), ohi = new Array(N).fill(null); let lnObs = -1;
        if (forkObs.length) { lnObs = lanes[0].t === "obst" ? 0 : 1; for (let j = 0; j < N; j++) { const c = ctr(lnObs, j), h = half(lnObs, j); let a2 = c - h + 1.25, b2 = c + h - 1.25; forkObs.forEach((o) => { if (Math.abs(o.i - (i0 + j)) <= 4) { if (o.u > c) b2 = Math.min(b2, o.u - o.r - 1.45); else a2 = Math.max(a2, o.u + o.r + 1.45); } }); olo[j] = +a2.toFixed(2); ohi[j] = +b2.toFixed(2); } }
        forkObs.forEach((o) => items.push({ t: "obs", a: o.i, u: o.u, r: o.r, ty: o.ty, fork: true }));
        // nez du terre-plein, un butoir posé au milieu là où les deux voies se séparent
        { let jn = 0; while (jn < N - 1 && m[jn] < 1.2) jn++; items.push({ t: "obs", a: i0 + jn, u: 0, r: OBS.nose.r, ty: "nose", fork: true }); }
        for (let j = c0; j <= c1; j++) FL[i0 + j] |= FLAG.FORK;
        items.push({ t: "fork", a: i0, b: i1, c0: i0 + c0, c1: i0 + c1, m, wa, wb, lanes, inner, shape, olo, ohi, lnObs });
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
    const magOK = (need) => pinOK() && room() > need && X.length - lastMag() >= EL.magGap;
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

    // tube, la route se retourne et reste la tête en bas longtemps avant de se remettre à l'endroit
    function kTube() {
      if (!magOK(420 * (EL.tubeLen || 1))) return null;
      const w = Math.min(hw, 6); const La = 40, Lb = rad(110, 190) * (EL.tubeLen || 1); const L = 2 * La + Lb; const fine = []; const NN = 700; const bend = rng() < 0.4 ? 0 : (rng() < 0.5 ? 1 : -1) * ang(30, 70);
      for (let q = 0; q <= NN; q++) { const t = q / NN; const m = t * L; const th = m < La ? Math.PI * sm(m / La) : m < La + Lb ? Math.PI : Math.PI + Math.PI * sm((m - La - Lb) / La); const ap = arcPos(L, bend, t); fine.push({ a: ap.a, b: ap.b, c: rollLift(th, w, 10), th, nl: null }); }
      return { surf: SURF.ASPHALT, noSelf: true, make: () => magPiece({ fine, w, kind: "tube" }), reg: regMag() };
    }

    // ---------- choix de la pièce suivante ----------
    function makeKind() {
      const tw = mood.twist, fl = mood.flow; const cands = [[1.8 * fl, kStraight], [3, kCurve], [(0.7 + diff * 0.8) * tw, kHairpin], [1.6, kBends], [(0.6 + diff * 0.8) * tw, kChic], [1.2 * fl, kSweep], [(0.8 + diff * 0.6) * tw, kTight], [(0.5 + diff * 0.5) * tw, kEsses], [(0.15 + diff * 0.35) * tw, kDouble], [(0.25 + diff * 0.3) * tw, kSpiral], [(0.25 + diff * 0.3) * tw, kFer], [(0.5 + diff * 0.2) * fl, kSerpent]];
      if (wild > 0) {
        const k = wild * 0.8 * elemK; const sizeOK = size >= 2;
        if (F.steep) { cands.push([2.4 * k * mood.steep * EL.steep, kSteep]); cands.push([0.9 * k * mood.steep * EL.steep, kLacets]); }
        if (F.obstacles) cands.push([1.8 * k * mood.obst * EL.obst, kObstacles]);
        if (F.widths) { cands.push([0.8 * k * mood.width, kNeck]); cands.push([0.6 * k * mood.width, kArena]); cands.push([0.5 * k * mood.width, kPulse]); cands.push([0.5 * k * mood.width, kRond]); cands.push([0.6 * k * mood.width, kEntonnoir]); }
        if (F.gaps && sizeOK) { const gk = k * mood.gap * EL.gap; cands.push([1.6 * gk, () => kGap("simple")]); cands.push([0.45 * gk * EL.dbl, () => kGap("double")]); cands.push([0.45 * gk * EL.drop, () => kGap("plongeon")]); cands.push([0.3 * gk, () => kGap("montant")]); }
        if (F.bridges && sizeOK) { const bk = k * mood.bridge * EL.bridge; cands.push([0.6 * bk, kBridge]); cands.push([0.35 * bk, kCorniche]); cands.push([0.6 * bk, kViaduc]); cands.push([0.4 * bk, kPasserelle]); cands.push([0.45 * bk, kPontVague]); }
        if (F.mag && sizeOK) { const mk = k * mood.mag * EL.mag; cands.push([0.8 * mk, kLoop]); cands.push([0.55 * mk, kRoll]); cands.push([0.6 * mk, kWall]); cands.push([0.4 * mk, kCeiling]); cands.push([0.35 * mk * EL.tube, kTube]); }
        if (F.forks && sizeOK) cands.push([1.5 * k * EL.fork, kFork]);
        if (F.cross && sizeOK) cands.push([0.55 * k * EL.cross, kCross]);
        if (F.movers && sizeOK) cands.push([0.5 * k * EL.mover, kMover]);
        cands.push([0.55 * k * EL.tunnel, kTunnel]);
        if (F.bank) cands.push([0.8 * k * EL.bank, kBank]);
        if (F.xing && sizeOK) cands.push([0.6 * k * EL.cross * EL.xing, kCarrefour]);
        if (F.cut && sizeOK) cands.push([0.75 * k * EL.cut, kCut]);
      }
      const tot = cands.reduce((a, c) => a + c[0], 0); let r = rng() * tot;
      for (let tries = 0; tries < 6; tries++) { let pickF = cands[cands.length - 1][1]; let t = r; for (const c of cands) { if ((t -= c[0]) < 0) { pickF = c[1]; break; } } const kind = pickF(); if (kind) return kind; r = rng() * tot; }
      return kStraight();
    }

    // ---------- tracé dessiné à la souris ----------
    // le dessin arrive en points de 0 à 1000 sur une carte carrée de trace.s mètres de côté. Il est lissé pour que chaque virage reste prenable,
    // puis habillé automatiquement. Les endroits où il se recoupe deviennent des ponts ou des carrefours
    const traceErr = []; let traceInfo = null;
    function traceGeom() {
      const T = spec.trace; if (!T || !Array.isArray(T.p) || T.p.length < 16) return null;
      const sc = clamp(Number(T.s) || 900, 300, 2000) / 1000; let P = [];
      for (let i = 0; i + 1 < T.p.length; i += 2) { const px = (500 - T.p[i]) * sc, pz = (500 - T.p[i + 1]) * sc; if (!isFinite(px) || !isFinite(pz)) continue; const q = P[P.length - 1]; if (!q || Math.hypot(px - q[0], pz - q[1]) > 0.5) P.push([px, pz]); }
      if (P.length < 4) return null;
      const resample = (Q, st) => { const out = [Q[0].slice()]; let need = st; let p0 = Q[0]; for (let i = 1; i < Q.length; i++) { const p1 = Q[i]; let d = Math.hypot(p1[0] - p0[0], p1[1] - p0[1]); let a = p0; while (d >= need) { const t = need / d; a = [a[0] + (p1[0] - a[0]) * t, a[1] + (p1[1] - a[1]) * t]; out.push(a); d = Math.hypot(p1[0] - a[0], p1[1] - a[1]); need = st; } need -= d; p0 = p1; } const L = Q[Q.length - 1], E = out[out.length - 1]; if (Math.hypot(L[0] - E[0], L[1] - E[1]) > st * 0.4) out.push(L.slice()); return out; };
      const smooth = (Q, passes) => { for (let it = 0; it < passes; it++) { const c = Q.map((q) => q.slice()); for (let i = 1; i < Q.length - 1; i++) { Q[i][0] = (c[i - 1][0] + 2 * c[i][0] + c[i + 1][0]) / 4; Q[i][1] = (c[i - 1][1] + 2 * c[i][1] + c[i + 1][1]) / 4; } } return Q; };
      // lissage à grande échelle puis fin, pour gommer le tremblement de la main
      P = smooth(resample(P, 6), 3); P = smooth(resample(P, STEP), 4);
      // rayon minimal. Une voiture virtuelle suit le dessin en visant un peu devant elle, sans jamais tourner plus sec que le rayon minimal.
      // Les angles trop vifs sont arrondis et le tracé ne s'écarte jamais beaucoup du dessin
      { const Rmin = 16, amax = STEP / Rmin, look = 7; const out = []; let qx = P[0][0], qz = P[0][1]; let th = Math.atan2(P[Math.min(3, P.length - 1)][0] - qx, P[Math.min(3, P.length - 1)][1] - qz); let sI = 0; const end = P.length - 1;
        out.push([qx, qz]);
        for (let k = 0; k < P.length * 3 && out.length < 4000; k++) {
          let bi = sI, bd = 1e18; for (let q = sI; q <= Math.min(end, sI + 12); q++) { const d = (P[q][0] - qx) ** 2 + (P[q][1] - qz) ** 2; if (d < bd) { bd = d; bi = q; } } sI = bi;
          if (sI >= end - 1 && Math.hypot(P[end][0] - qx, P[end][1] - qz) < STEP * 1.5) break;
          const tg = P[Math.min(end, sI + look)]; let want = Math.atan2(tg[0] - qx, tg[1] - qz) - th; while (want > Math.PI) want -= 2 * Math.PI; while (want < -Math.PI) want += 2 * Math.PI;
          th += clamp(want, -amax, amax); qx += Math.sin(th) * STEP; qz += Math.cos(th) * STEP; out.push([qx, qz]);
        }
        P = out; }
      if (P.length < 40) return null;
      // ligne droite de départ avant le premier point, et une petite ligne droite d'arrivée
      const d0 = [P[1][0] - P[0][0], P[1][1] - P[0][1]], l0 = Math.hypot(d0[0], d0[1]) || 1; const pre = []; for (let k = 15; k >= 1; k--) pre.push([P[0][0] - d0[0] / l0 * STEP * k, P[0][1] - d0[1] / l0 * STEP * k]);
      const m = P.length; const d1 = [P[m - 1][0] - P[m - 2][0], P[m - 1][1] - P[m - 2][1]], l1 = Math.hypot(d1[0], d1[1]) || 1; const post = []; for (let k = 1; k <= 6; k++) post.push([P[m - 1][0] + d1[0] / l1 * STEP * k, P[m - 1][1] + d1[1] / l1 * STEP * k]);
      return pre.concat(P, post);
    }
    function layoutTrace(P) {
      X.length = Z.length = H.length = W.length = SF.length = FL.length = 0; grid.clear(); let hPrev = null;
      for (let i = 0; i < P.length; i++) { const a = P[Math.min(i, P.length - 2)], b = P[Math.min(i + 1, P.length - 1)]; let hh = Math.atan2(b[0] - a[0], b[1] - a[1]); if (hPrev != null) { while (hh - hPrev > Math.PI) hh -= 2 * Math.PI; while (hh - hPrev < -Math.PI) hh += 2 * Math.PI; } hPrev = hh; x = P[i][0]; z = P[i][1]; h = hh; push(pickSurf(), 0, hw); }
      const n0 = X.length;
      // surfaces par morceaux, comme des pièces
      { let i = 30; while (i < n0) { const L = Math.round(rad(40, 120) / STEP); const sf = pickSurf(); for (let q = i; q < Math.min(n0, i + L); q++) SF[q] = sf; i += L; } for (let q = 0; q < 30; q++) SF[q] = SURF.ASPHALT; }
      // ---- croisements ----
      const near = new Int32Array(n0).fill(-1), nd = new Float64Array(n0).fill(1e9);
      for (let j = 0; j < n0; j++) { const gx = Math.floor(X[j] / CELL), gz = Math.floor(Z[j] / CELL); for (let a = -1; a <= 1; a++) for (let b = -1; b <= 1; b++) { const l = grid.get((gx + a) + "," + (gz + b)); if (!l) continue; for (const i of l) { if (i > j - 30) continue; const d = Math.hypot(X[i] - X[j], Z[i] - Z[j]); if (d < nd[j]) { nd[j] = d; near[j] = i; } } } }
      const close = (j) => near[j] >= 0 && nd[j] < W[j] + W[near[j]] + 1.5;
      const crossings = []; let j = 0;
      while (j < n0) { if (!close(j)) { j++; continue; } let a = j; while (j < n0 && close(j)) j++; const b = j - 1; let bj = a; for (let q = a; q <= b; q++) if (nd[q] < nd[bj]) bj = q; const bi = near[bj];
        const ang2 = Math.abs(Math.sin(H[bj] - H[bi]));
        if (nd[bj] > 1.6) traceErr.push({ x: +X[bj].toFixed(1), z: +Z[bj].toFixed(1), k: "proche" });
        else if (ang2 < 0.5) traceErr.push({ x: +X[bj].toFixed(1), z: +Z[bj].toFixed(1), k: "rasant" });
        else if (bi < 24 || bj > n0 - 24) traceErr.push({ x: +X[bj].toFixed(1), z: +Z[bj].toFixed(1), k: "bout" });
        else crossings.push({ ic: bi, jc: bj }); }
      const level = spec.trace.x === "niveau"; const Hc = 8.6, ndn = Math.ceil(Hc / 0.24 / STEP); const OV = new Float64Array(n0); const busy = new Uint8Array(n0); let nb = 0, nl = 0;
      const mark = (c, r) => { for (let q = Math.max(0, c - r); q <= Math.min(n0 - 1, c + r); q++) busy[q] = 1; };
      crossings.forEach((c) => { const hold = Math.ceil((W[c.ic] + 9) / STEP); c.j0 = c.jc - hold - ndn; c.j1 = c.jc + hold + ndn; c.i0 = c.ic - hold - 4; c.i1 = c.ic + hold + 4; c.hold = hold; });
      crossings.forEach((c) => { c.lvl = level || c.j0 < 16 || c.j1 > n0 - 10 || crossings.some((o) => (c.j0 <= o.i1 && c.j1 >= o.i0)); });
      crossings.forEach((c) => {
        mark(c.ic, 30); mark(c.jc, 30);
        if (c.lvl) { nl++; for (const q0 of [c.ic, c.jc]) { const o = q0 === c.ic ? c.jc : c.ic; for (let q = q0 - 16; q <= q0 + 16; q++) { if (q < 0 || q >= n0) continue; let mm = 1e9; for (let k = o - 16; k <= o + 16; k++) if (k >= 0 && k < n0) mm = Math.min(mm, Math.hypot(X[q] - X[k], Z[q] - Z[k]) - W[k]); if (mm < 2.5) FL[q] |= FLAG.XING; } } items.push({ t: "xing", a: c.ic - 14, b: c.ic + 14, ja: c.ic, jb: c.jc, trace: 1 }); items.push({ t: "xing", a: c.jc - 14, b: c.jc + 14, ja: c.ic, jb: c.jc, dup: 1 }); return; }
        nb++; for (let q = c.j0; q <= c.j1; q++) { const t = q < c.jc - c.hold ? sm((q - c.j0) / ndn) : q > c.jc + c.hold ? sm((c.j1 - q) / ndn) : 1; OV[q] = Math.max(OV[q], Hc * t); }
        for (let q = c.j0; q <= c.j1; q++) busy[q] = 1;
      });
      // ponts. Chaque bosse de hauteur devient une zone de hauteur fixée
      { let q = 0; while (q < n0) { if (OV[q] <= 0) { q++; continue; } const a = Math.max(0, q - 2); while (q < n0 && OV[q] > 0) q++; const b = Math.min(n0 - 1, q + 1); const ofs = []; for (let k = a; k <= b; k++) ofs.push(+OV[k].toFixed(3)); items.push({ t: "region", a, b, ofs, over: 1 }); } }
      { const Lt = (n0 - 1) * STEP; if (Lt > 6500) traceErr.push({ x: +X[n0 - 1].toFixed(1), z: +Z[n0 - 1].toFixed(1), k: "long" }); if (Lt < 380) traceErr.push({ x: +X[n0 - 1].toFixed(1), z: +Z[n0 - 1].toFixed(1), k: "court" }); }
      traceInfo = { crossings: nb, levels: nl, errors: traceErr.length };
      // ---- habillage automatique ----
      const kap = new Float64Array(n0); for (let i = 1; i < n0 - 1; i++) { let d = H[i + 1] - H[i - 1]; kap[i] = Math.abs(d) / (2 * STEP); }
      const maxKap = (a, b) => { let m = 0; for (let q = a; q <= b; q++) if (kap[q] > m) m = kap[q]; return m; };
      const kk = Math.max(0.35, wild * 0.8) * elemK; const inl = [[1.8 * mood.flow, kStraight, 1 / 150]];
      if (wild > 0) {
        if (F.steep) inl.push([2.4 * kk * mood.steep * EL.steep, kSteep, 1]);
        if (F.obstacles) inl.push([1.8 * kk * mood.obst * EL.obst, kObstacles, 1 / 150]);
        if (F.widths) { inl.push([0.8 * kk * mood.width, kNeck, 1 / 80]); inl.push([0.6 * kk * mood.width, kEntonnoir, 1 / 120]); inl.push([0.5 * kk * mood.width, kPulse, 1 / 100]); }
        if (F.gaps) { const gk = kk * mood.gap * EL.gap; inl.push([1.6 * gk, () => kGap("simple"), 1 / 260]); inl.push([0.45 * gk * EL.dbl, () => kGap("double"), 1 / 260]); inl.push([0.45 * gk * EL.drop, () => kGap("plongeon"), 1 / 260]); inl.push([0.3 * gk, () => kGap("montant"), 1 / 260]); }
        if (F.bridges) { const bk = kk * mood.bridge * EL.bridge; inl.push([0.6 * bk, kBridge, 1 / 140]); inl.push([0.4 * bk, kPasserelle, 1 / 160]); inl.push([0.45 * bk, kPontVague, 1 / 140]); }
        if (F.forks) inl.push([1.5 * kk * EL.fork, kFork, 1 / 45]);
        if (F.movers) inl.push([0.5 * kk * EL.mover, kMover, 1 / 150]);
        inl.push([0.55 * kk * EL.tunnel, kTunnel, 1]);
      }
      const tot = inl.reduce((a2, c2) => a2 + c2[0], 0); cur = 36; let guard = 0;
      while (cur < n0 - 60 && guard++ < 3000) {
        if (busy[cur]) { cur++; continue; }
        let r = rng() * tot, pickC = inl[0]; for (const c2 of inl) { if ((r -= c2[0]) < 0) { pickC = c2; break; } }
        const kind = pickC[1](); if (!kind || kind.make) { cur += 3; continue; }
        const Nk = kind.parts.reduce((a2, p) => a2 + Math.max(1, Math.round((p.straight ? p.straight : Math.abs(p.angle) * p.radius) / STEP)), 0); const e = cur + Nk - 1;
        if (e >= n0 - 40) { cur += 6; continue; } let free = true; for (let q = cur; q <= e; q++) if (busy[q]) { free = false; break; }
        if (!free || maxKap(cur, e) > pickC[2]) { cur += 4; continue; }
        if (kind.wf) for (let q = 0; q < Nk; q++) W[cur + q] = hw * kind.wf((q + 1) / Nk);
        if (kind.surf != null) for (let q = cur; q <= e; q++) SF[q] = kind.surf;
        kind.reg(cur, e, null); for (let q = cur; q <= e; q++) busy[q] = 1;
        cur = e + 1 + Math.round(rad(14, 70) / Math.max(0.4, elemK) / STEP);
      }
      cur = null;
      // virages relevés là où la route tourne longtemps du même côté
      if (F.bank && wild > 0) {
        const sk = (i) => Math.sign(H[i + 1] - H[i - 1]); let i = 30;
        while (i < n0 - 30) {
          if (kap[i] < 1 / 110) { i++; continue; } const sg = sk(i); let e = i; let tot2 = 0; while (e < n0 - 30 && kap[e] >= 1 / 140 && sk(e) === sg) { tot2 += kap[e] * STEP; e++; }
          if (e - i >= 16 && tot2 >= 1.3 && rng() < clamp(0.45 * EL.bank * elemK, 0.2, 0.9)) {
            const a = Math.max(24, i - 8), b = Math.min(n0 - 24, e + 8); let ok = true; for (let q = a; q <= b; q++) if (busy[q] || FL[q]) { ok = false; break; }
            if (ok) { const avg = tot2 / ((e - i) * STEP); const tilt = clamp(0.2 + avg * 8, 0.22, 0.42) * sg; const arr = []; for (let q = a; q <= b; q++) { const env = sm((q - a) / 10) * sm((b - q) / 10); arr.push(+(tilt * env).toFixed(3)); if (env > 0.05) FL[q] |= FLAG.BANK; busy[q] = 1; } items.push({ t: "bank", a, b, B: arr }); }
          }
          i = e + 1;
        }
      }
      return crossings;
    }
    // ---------- pose ----------
    const TRACE = spec.trace ? traceGeom() : null; let traceX = null;
    if (TRACE) traceX = layoutTrace(TRACE); else {
    { const kind = { surf: SURF.ASPHALT, parts: [{ straight: 30 }] }; commit(kind, plan(kind)); }
    let tries = 0, last = 0, back = 0; const maxTries = 600 + size * 300;
    // élément signature du biome, essayé en priorité à des moments donnés du circuit pour que chaque biome ait toujours son caractère
    const SIG = { megapole: F.mag ? kTube : null, jungle: F.forks ? kFork : null, usine: F.movers ? kMover : null, foraine: F.cross ? kCross : null }[biome.id];
    const sigAt = SIG && size >= 2 && wild > 0 ? (size >= 3 ? [0.22, 0.5, 0.75] : [0.3, 0.62]) : []; let sigN = 0;
    while (STEP * X.length < targetLen && tries < maxTries) {
      if (sigN < sigAt.length && STEP * X.length >= sigAt[sigN] * targetLen) { sigN++; for (let q = 0; q < 14; q++) { const sk = SIG(); if (!sk) break; const sp = plan(sk); if (fits(sp, sk.noSelf)) { commit(sk, sp); break; } const f2 = { surf: SURF.ASPHALT, parts: [{ angle: sgn() * ang(20, 60), radius: rad(40, 80) }] }; const fp2 = plan(f2); if (fits(fp2)) commit(f2, fp2); } }
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
          for (let q = blk.length - 1; q >= 0; q--) if (blk[q].a >= cut) blk.splice(q, 1);
          regrid();
        } else break;
      }
    }
    for (const L of [30, 20, 12, 6]) { const kind = { surf: SURF.ASPHALT, parts: [{ straight: L }] }; const pts = plan(kind); if (fits(pts) || L === 6) { commit(kind, pts); break; } }
    }
    const n = X.length;
    // largeur variable discrète sur les routes ordinaires
    if (F.widths) { const p1 = rng() * 6.28, p2 = rng() * 6.28; const special = new Uint8Array(n); items.forEach((it) => { if (it.b != null && (it.t === "region" || it.t === "neck" || it.t === "arena" || it.t === "obspat" || it.t === "fork" || it.t === "cross" || it.t === "mover" || it.t === "bank" || it.t === "xing" || it.t === "cut")) { for (let i = Math.max(0, it.a); i <= Math.min(n - 1, it.b); i++) special[i] = 1; } });
      for (let i = 0; i < n; i++) if (!special[i] && !(FL[i] & (FLAG.MAG | FLAG.NOWALL))) W[i] = Math.round(W[i] * (1 + 0.07 * Math.sin(i * 0.045 + p1) + 0.05 * Math.sin(i * 0.11 + p2)) * 100) / 100;
      // passages étroits, de temps en temps, d'autant plus souvent que le circuit est dur
      if (narrowFrac > 0.01 && n > 140) {
        const m = new Float32Array(n); let i = 40 + Math.floor(rng() * 40);
        while (i < n - 40) { const Ln = Math.round(30 + rng() * 70); const Lw = Math.round(clamp(Ln * (1 - narrowFrac) / narrowFrac * (0.4 + rng() * 1.2), 18, 400)); for (let q = 0; q < Ln && i + q < n; q++) m[i + q] = 1; i += Ln + Lw; }
        let t = m; for (let pass = 0; pass < 3; pass++) { const o = new Float32Array(n); for (let a = 0; a < n; a++) { let sum = 0, c = 0; for (let b = Math.max(0, a - 8); b <= Math.min(n - 1, a + 8); b++) { sum += t[b]; c++; } o[a] = sum / c; } t = o; }
        const steepA = new Set(); items.forEach((it) => { if (it.t === "steep") steepA.add(it.a + 2); });
        const blocked = new Uint8Array(n); items.forEach((it) => { if (it.b != null && (it.t === "neck" || it.t === "arena" || it.t === "obspat" || it.t === "fork" || it.t === "cross" || it.t === "mover" || it.t === "bank" || it.t === "xing" || it.t === "cut" || (it.t === "region" && !steepA.has(it.a)))) for (let a = Math.max(0, it.a); a <= Math.min(n - 1, it.b); a++) blocked[a] = 1; });
        for (let a = 0; a < n; a++) if (FL[a] & (FLAG.MAG | FLAG.NOWALL | FLAG.GAP | FLAG.JUMP | FLAG.KICK | FLAG.FORK | FLAG.MOVE | FLAG.XING | FLAG.BANK | FLAG.CUT)) blocked[a] = 1;
        const dist = new Float32Array(n).fill(1e9); let dd = 1e9; for (let a = 0; a < n; a++) { dd = blocked[a] ? 0 : dd + 1; dist[a] = dd; } dd = 1e9; for (let a = n - 1; a >= 0; a--) { dd = blocked[a] ? 0 : dd + 1; if (dd < dist[a]) dist[a] = dd; }
        for (let a = 0; a < n; a++) { const k = t[a] * clamp((dist[a] - 3) / 14, 0, 1) * clamp((a - 36) / 20, 0, 1) * clamp((n - 40 - a) / 20, 0, 1); if (k <= 0.001) continue; const nw = hwN * (0.95 + 0.1 * Math.sin(a * 0.07 + p2)); if (W[a] > nw) W[a] = Math.round((W[a] + (nw - W[a]) * k) * 100) / 100; }
      } }
    // la ligne de départ est large, pour que tout le monde parte côte à côte. La route se resserre ensuite
    { const wS = Math.max(hw, 10.6); for (let i = 0; i < n; i++) { if (i <= 14) W[i] = Math.max(W[i], wS); else if (i < 34) { const t = (i - 14) / 20; const k = t * t * (3 - 2 * t); W[i] = Math.max(W[i], wS + (hw - wS) * k); } else break; } }

    // ---------- hauteurs ----------
    const noiseF = (() => { const r2 = mulberry32(hashSeed(spec.seed + "hy")); const a = [], b = []; for (let i = 0; i < 6; i++) { a.push(r2() * 6.28); b.push(0.5 + r2()); } return (t) => { let s = 0; for (let i = 0; i < 3; i++) s += Math.sin(t * (0.011 + i * 0.013) * (1 + b[i] * 0.4) + a[i]) / (1 + i); return s; }; })();
    const amp = [0, 1.2, 2.6, 4.2][hillsLvl];
    const nz = new Array(n); for (let i = 0; i < n; i++) { const ramp = Math.min(1, i / 20) * Math.min(1, (n - 1 - i) / 20); nz[i] = noiseF(i) * amp * ramp; }
    // près d'un croisement dessiné, les deux passages repartent du même niveau
    if (traceX && traceX.length) for (let i = 0; i < n; i++) { let d = 1e9; traceX.forEach((c) => { d = Math.min(d, Math.abs(i - c.ic), Math.abs(i - c.jc)); }); nz[i] *= sm((d - 34) / 40); }
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
      if (it.t === "fork" || it.t === "mover" || it.t === "cross" || it.t === "xing" || it.t === "cut") { for (let i = it.a - 6; i <= it.b + 6; i++) if (i >= 0 && i < n) bad[i] = 1; if (it.t === "cross" || it.t === "xing" || it.t === "cut") must.push(it.cp); }
    });
    cps = cps.filter((c) => !bad[c]); must.forEach((c) => { if (c > 4 && c < n - 60) cps.push(c); }); cps = Array.from(new Set(cps)).sort((a, b) => a - b);
    // deux points de contrôle trop proches se gênent. On garde celui qui protège un élément spécial
    const mustSet = new Set(must); cps = cps.filter((c, i) => mustSet.has(c) || !cps.some((o) => mustSet.has(o) && Math.abs(o - c) < 14));

    // ---------- routes superposées ----------
    // une route qui passe au-dessus d'une autre. Le rendu y met des piliers au lieu de jupes et la voiture du dessous voit le tablier
    { const cell2 = 20; const g2 = new Map(); for (let i = 0; i < n; i++) { const k = Math.floor(X[i] / cell2) + "," + Math.floor(Z[i] / cell2); let l = g2.get(k); if (!l) { l = []; g2.set(k, l); } l.push(i); }
      for (let i = 0; i < n; i++) { if (FL[i] & FLAG.MAG) continue; const gx = Math.floor(X[i] / cell2), gz = Math.floor(Z[i] / cell2);
        for (let a2 = -1; a2 <= 1; a2++) for (let b2 = -1; b2 <= 1; b2++) { const l = g2.get((gx + a2) + "," + (gz + b2)); if (!l) continue; for (const j of l) { if (Math.abs(i - j) < 30 || (FL[j] & FLAG.MAG)) continue; const d = Math.hypot(X[i] - X[j], Z[i] - Z[j]); if (d < W[i] + W[j] + 2 && Y[i] - Y[j] > 3.5) { FL[i] |= FLAG.OVER; FL[j] |= FLAG.UNDER; } } } } }

    // ---------- bas-côtés sans barrière ----------
    // de longues portions bordées de sable, d'herbe ou de neige. Sortir de la route freine et fait glisser, une clôture basse arrête la voiture plus loin
    const VW = new Float32Array(n); const vergeW = biome.vergeW || 6.2;
    if (F.verges && EL.verge > 0) {
      const vr = mulberry32(hashSeed(spec.seed + "vg")); const ok = (i) => i > 36 && i < n - 36 && !(FL[i] & (FLAG.MAG | FLAG.NOWALL | FLAG.GAP | FLAG.KICK | FLAG.JUMP | FLAG.FORK | FLAG.MOVE | FLAG.OVER | FLAG.UNDER | FLAG.TUNNEL | FLAG.XING | FLAG.BANK | FLAG.CUT));
      let i = 40;
      while (i < n - 40) {
        if (!ok(i)) { i++; continue; }
        if (vr() < EL.verge) { const Lv = Math.round(40 + vr() * 110); let j = i; while (j < n - 36 && j - i < Lv && ok(j)) j++; const len2 = j - i; if (len2 >= 24) { for (let q = 0; q < len2; q++) { const t = Math.min(q, len2 - 1 - q); VW[i + q] = vergeW * sm(t / 9); if (VW[i + q] > 0.3) FL[i + q] |= FLAG.VERGE; } } i = j + 20; }
        else i += Math.round(30 + vr() * 80);
      }
    }
    const vwOut = Array.from(VW, (v) => +v.toFixed(2));

    // ---------- décors ----------
    const dec = []; const decRng = mulberry32(hashSeed(spec.seed + "dc")); const cell = 24; const dgrid = new Map();
    for (let i = 0; i < n; i += 2) { const k = Math.floor(X[i] / cell) + "," + Math.floor(Z[i] / cell); if (!dgrid.has(k)) dgrid.set(k, []); dgrid.get(k).push(i); }
    const nearTrack = (px, pz) => { let best = 1e9; const gx = Math.floor(px / cell), gz = Math.floor(pz / cell); for (let a = -2; a <= 2; a++) for (let b = -2; b <= 2; b++) { const l = dgrid.get((gx + a) + "," + (gz + b)); if (!l) continue; for (const i of l) { const d = Math.hypot(X[i] - px, Z[i] - pz) - W[i] - VW[i]; if (d < best) best = d; } } return best; };
    const nDeco = Math.min(900, Math.round(120 + len * 0.28 * (spec.decor == null ? 1 : spec.decor)));
    let minY = 1e9; for (let i = 0; i < n; i++) if (Y[i] < minY) minY = Y[i];
    for (let a = 0; a < nDeco * 3 && dec.length < nDeco; a++) {
      const i = Math.floor(decRng() * n); const side = decRng() < 0.5 ? -1 : 1; const off = W[i] + VW[i] + 3 + Math.pow(decRng(), 1.6) * 55; if (FL[i] & FLAG.BANK) continue;
      const rx = -Math.cos(H[i]), rz = Math.sin(H[i]); const px = X[i] + rx * off * side, pz = Z[i] + rz * off * side;
      const k = biome.deco[Math.floor(decRng() * biome.deco.length)]; const big = BIG_DECO[k] || 0;
      if (nearTrack(px, pz) < 2.5 + big + (FL[i] & FLAG.MAG ? 14 : 0)) continue;
      if (blk.some((o) => Math.hypot(o.x - px, o.z - pz) < o.r + 7 + big)) continue;
      dec.push({ k, x: +px.toFixed(1), z: +pz.toFixed(1), s: +(0.8 + decRng() * 0.9).toFixed(2), r: +(decRng() * 6.28).toFixed(2) });
    }

    // ---------- éléments : obstacles, couloirs, repères 3D ----------
    const round = (a, d) => a.map((v) => +v.toFixed(d));
    const obs = items.filter((it) => it.t === "obs").map((it) => { const i = it.a; const rx = -Math.cos(H[i]), rz = Math.sin(H[i]); const ti = OBS_IDS.indexOf(it.ty); return { x: +(X[i] + rx * it.u).toFixed(2), z: +(Z[i] + rz * it.u).toFixed(2), y: +Y[i].toFixed(2), r: it.r, h: OBS[it.ty].h, t: ti, i, u: +it.u.toFixed(2) }; });
    const lanes = items.filter((it) => it.t === "lane").map((it) => ({ a: it.a, lo: round(it.lo, 2), hi: round(it.hi, 2) }));
    const magsOut = items.filter((it) => it.t === "mag").map((it) => ({ a: it.a, b: it.b, k: it.kind, f: round(it.f, 4) }));
    const gapsOut = items.filter((it) => it.t === "gap").map((it) => ({ cp: it.cp, lip: it.lip, land: it.land, vk: +it.vk.toFixed(3), tf: +it.tf.toFixed(3), vreq: +it.vreq.toFixed(2), G: it.G, La: it.La, v: it.v || "simple" }));
    const kicks = gapsOut.map((g) => ({ i: g.lip, vy: g.vk }));
    const forksOut = items.filter((it) => it.t === "fork").map((it) => ({ a: it.a, b: it.b, c0: it.c0, c1: it.c1, m: it.m, wa: it.wa, wb: it.wb, inner: it.inner, shape: it.shape, lanes: it.lanes.map((l) => ({ t: l.t, s: l.s, dy: l.dy, crest: l.crest || 0 })), olo: it.lnObs >= 0 ? it.olo : null, ohi: it.lnObs >= 0 ? it.ohi : null, lnObs: it.lnObs }));
    const padsOut = items.filter((it) => it.t === "pad").map((it) => ({ a: it.a, b: it.b, u0: it.u0, u1: it.u1, k: it.k }));
    const moversOut = items.filter((it) => it.t === "mover").map((it) => ({ a: it.a, b: it.b, k: it.k, A: it.A, T: it.T, ph: it.ph, L: it.L }));
    const cutsOut = items.filter((it) => it.t === "cut").map((it) => ({ a: it.a, b: it.b, lip: it.lip, land: it.land, u0: it.u0, u1: it.u1, vk: it.vk, vreq: it.vreq, D: it.D, ax: +X[it.lip].toFixed(2), az: +Z[it.lip].toFixed(2), h: +H[it.lip].toFixed(4) }));
    const xingsOut = items.filter((it) => it.t === "xing" && !it.dup).map((it) => ({ a: it.a, b: it.b, ja: it.ja, jb: it.jb }));
    let bankOut = null; items.filter((it) => it.t === "bank").forEach((it) => { if (!bankOut) bankOut = new Array(n).fill(0); for (let j = 0; j < it.B.length && it.a + j < n; j++) bankOut[it.a + j] = it.B[j]; });
    const tunnelsOut = items.filter((it) => it.t === "tunnel").map((it) => ({ a: it.a, b: it.b, lane: it.lane == null ? -1 : it.lane }));
    // anneaux turbo. Au sommet de la trajectoire d'un saut, après une bosse ou en portique sur une ligne droite. Les traverser donne un gros turbo
    const rings = [];
    if (F.rings && EL.ring > 0) {
      const rr = mulberry32(hashSeed(spec.seed + "rg"));
      gapsOut.forEach((g) => { if (rr() > Math.min(0.95, 0.55 * EL.ring)) return; const G2 = g.G; const v = g.vreq * 1.25; const t = (G2 / 2 + 1) / v; const hgt = g.vk * t - 0.5 * airG * t * t; const i = g.lip + Math.max(1, Math.round(G2 / 2 / STEP)); if (i >= n - 2) return; rings.push({ i, u: 0, y: +(Y[g.lip] + 0.7 + Math.max(0.6, hgt)).toFixed(2), r: 3.0 }); });
      items.filter((it) => it.t === "bump").forEach((it) => { if (rr() > Math.min(0.9, 0.35 * EL.ring)) return; const i = it.a + 9; if (i < n - 2) rings.push({ i, u: 0, y: +(Y[i] + 2.4).toFixed(2), r: 3.0 }); });
      const want = Math.round(len / 700 * 1.4 * EL.ring * (rr() < 0.5 ? 1 : 0.5)); let tries2 = 0;
      while (rings.filter((q) => q.g).length < want && tries2++ < 200) { const i = 50 + Math.floor(rr() * (n - 100)); let bad2 = false; for (let q = Math.max(0, i - 24); q <= Math.min(n - 1, i + 24); q++) if (FL[q] & (FLAG.MAG | FLAG.GAP | FLAG.FORK | FLAG.MOVE | FLAG.UNDER | FLAG.OVER | FLAG.NOWALL | FLAG.KICK | FLAG.XING | FLAG.BANK | FLAG.CUT)) bad2 = true; if (bad2) continue; if (rings.some((q) => Math.abs(q.i - i) < 40)) continue; const u = (rr() * 2 - 1) * Math.max(0, W[i] - 3.4); rings.push({ i, u: +u.toFixed(2), y: +(Y[i] + 2.1).toFixed(2), r: 2.8, g: 1 }); }
      rings.sort((a2, b2) => a2.i - b2.i);
    }
    const stats = { forks: forksOut.length, cross: items.filter((it) => it.t === "cross").length, movers: moversOut.length, tunnels: tunnelsOut.length, rings: rings.length, verge: Math.round(vwOut.filter((v) => v > 0.3).length * STEP), banks: items.filter((it) => it.t === "bank").length, xings: xingsOut.length, cuts: cutsOut.length, tubes: 0, doubles: gapsOut.filter((g) => g.v === "double").length, plongeons: gapsOut.filter((g) => g.v === "plongeon").length, supers: SF.filter((v) => v === SURF.SUPER).length, loops: 0, rolls: 0, walls: 0, ceilings: 0, gaps: gapsOut.length, steep: items.filter((it) => it.t === "steep").length, bridges: items.filter((it) => it.t === "bridge").length, necks: items.filter((it) => it.t === "neck" || it.t === "arena").length, obstacles: items.filter((it) => it.t === "obspat").length, bumps: items.filter((it) => it.t === "bump").length, lacets: items.filter((it) => it.t === "steep" && it.type === "lacets").length, road: +roadK.toFixed(2) };
    items.filter((it) => it.t === "mag").forEach((it) => { if (it.kind === "loop") stats.loops++; else if (it.kind === "roll") stats.rolls++; else if (it.kind === "wall") stats.walls++; else if (it.kind === "tube") stats.tubes++; else stats.ceilings++; });
    return {
      version: 3, spec: Object.assign({}, spec), biome: biome.id, name: TRACE ? (String(spec.trace.name || "").slice(0, 24) || "Circuit dessiné") : biome.names[Math.floor(rng() * biome.names.length)], trace: TRACE ? { info: traceInfo, err: traceErr } : null, n, step: STEP, length: len, gravity: biome.gravity, airG: +airG.toFixed(3),
      x: round(X, 2), z: round(Z, 2), y: round(Y, 2), h: round(H, 3), w: round(W, 2), surf: SF, flags: FL, cps, groundY: +(minY - 1.2).toFixed(2), decor: dec,
      mags: magsOut, gaps: gapsOut, kicks, obs, lanes, stats, crosses: items.filter((it) => it.t === "cross").map((it) => ({ a: it.a, b: it.b })), forks: forksOut, pads: padsOut, movers: moversOut, tunnels: tunnelsOut, rings, vw: vwOut, bank: bankOut, cuts: cutsOut, xings: xingsOut, vergeK: biome.vergeK || "sable",
      start: { x: X[2], z: Z[2], y: +Y[2].toFixed(2), h: H[2], idx: 2 },
    };
  }
  function generate(spec) {
    if (spec.trace && spec.trace.p) return build(spec, 0);
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
  // embranchement à l'indice i, ou -1
  const forkCache = new WeakMap();
  function forkMap(tr) { let m = forkCache.get(tr); if (m) return m; m = new Int16Array(tr.n).fill(-1); (tr.forks || []).forEach((f, k) => { for (let i = f.a; i <= f.b && i < tr.n; i++) m[i] = k; }); forkCache.set(tr, m); return m; }
  // géométrie d'un embranchement à l'indice idx (fractionnaire). m demi-largeur du terre-plein, lo et hi bornes latérales de chaque voie
  const _fk = { m: 0, a0: 0, a1: 0, b0: 0, b1: 0, j: 0 };
  function forkGeo(f, idx) {
    const N = f.b - f.a; let t = idx - f.a; if (t < 0) t = 0; if (t > N) t = N; const j = Math.min(N - 1, Math.floor(t)); const u = t - j; const L = (arr) => arr[j] + (arr[j + 1] - arr[j]) * u;
    const m = L(f.m), wa = L(f.wa), wb = L(f.wb); _fk.m = m; _fk.a0 = -(m + 2 * wa); _fk.a1 = -m; _fk.b0 = m; _fk.b1 = m + 2 * wb; _fk.j = j; _fk.u = u; return _fk;
  }
  // hauteur ajoutée à une voie d'embranchement (voie avec saut)
  function forkDy(f, lane, idx) { const ln = f.lanes[lane]; if (!ln || !ln.dy) return 0; const N = f.b - f.a; let t = idx - f.a; if (t < 0 || t > N) return 0; const j = Math.min(N - 1, Math.floor(t)); const u = t - j; return ln.dy[j] + (ln.dy[j + 1] - ln.dy[j]) * u; }
  const moverCache = new WeakMap();
  function moverMap(tr) { let m = moverCache.get(tr); if (m) return m; m = new Int16Array(tr.n).fill(-1); (tr.movers || []).forEach((mv, k) => { for (let i = mv.a; i <= mv.b && i < tr.n; i++) m[i] = k; }); moverCache.set(tr, m); return m; }
  // hauteur ajoutée par une route qui bouge, au temps t en secondes depuis le départ
  function moverDy(mv, idx, t) {
    const N = mv.b - mv.a; const j = idx - mv.a; if (j < 0 || j > N) return 0; const env = sm(j / 8) * sm((N - j) / 8);
    if (mv.k === "vague") return mv.A * env * Math.sin(2 * Math.PI * (t / mv.T + j / mv.L) + mv.ph);
    return mv.A * env * Math.sin(2 * Math.PI * t / mv.T + mv.ph) * (2 * j / N - 1);
  }
  // pente latérale de la route (virage relevé). Le bord droit est plus haut de u fois cette valeur
  function bankAt(tr, idx) { const B = tr.bank; if (!B) return 0; let i = Math.floor(idx); if (i < 0) i = 0; if (i > tr.n - 2) i = tr.n - 2; const t = idx - i; return B[i] + (B[i + 1] - B[i]) * (t < 0 ? 0 : t > 1 ? 1 : t); }
  return { bankAt, STEP, SURF, SURF_NAMES, FLAG, BIOMES, BIOME_IDS, AIRK, WEAK, VTOP, OBS, OBS_IDS, mulberry32, hashSeed, generate, magMap, frameAt, solidAt, obsBuckets, laneAt, accelSpeed, forkMap, forkGeo, forkDy, moverMap, moverDy };
});

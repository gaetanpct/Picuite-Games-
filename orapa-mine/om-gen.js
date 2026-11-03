// ============================================================
// ORAPA MINE — Générateur de mines
// Une mine est valide si chaque pierre change vraiment ce qu'on observe,
// et si on ne peut pas la remplacer par une variante d'une seule pierre sans que les rayons changent.
// ============================================================
const E = require("./public/game/engine.js");
const mulberry32 = (a) => () => { a |= 0; a = (a + 0x6D2B79F5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };

const SHAPE_SETS = { petits: ["mono", "mono", "domino", "domino"], mixtes: ["mono", "domino", "domino", "ligne3", "coude"], gros: ["domino", "ligne3", "coude", "carre", "te"] };
const BASIC = ["filter", "filter", "filter", "mirror", "mirror", "obsidian"];
const ALL = ["filter", "filter", "mirror", "mirror", "obsidian", "prism", "splitter", "tint"];
const ADV = ["prism", "prism", "splitter", "splitter", "tint", "tint", "mirror", "filter"];
const MASKS = [1, 2, 4, 3, 5, 6];

// choisit l'inventaire, c'est-à-dire la liste des pierres sans leur place
function makeInventory(rnd, cfg) {
  const pool = cfg.kinds === "basique" ? BASIC : cfg.kinds === "avance" ? ADV : ALL; const shapes = SHAPE_SETS[cfg.shapes] || SHAPE_SETS.mixtes;
  const inv = [];
  const hasColor = cfg.laserMasks.some((m) => m !== 7) || true;
  for (let i = 0; i < cfg.gems; i++) {
    let k = pool[Math.floor(rnd() * pool.length)];
    if (i === 0 && cfg.kinds !== "avance") k = "filter";
    if (i === 1 && cfg.kinds === "tout" && cfg.gems >= 4) k = ["prism", "splitter", "tint"][Math.floor(rnd() * 3)];
    const shape = k === "obsidian" || k === "prism" || k === "splitter" || k === "tint" ? ["mono", "mono", "domino"][Math.floor(rnd() * 3)] : shapes[Math.floor(rnd() * shapes.length)];
    const m = k === "filter" || k === "tint" ? MASKS[Math.floor(rnd() * (k === "tint" ? 3 : 6))] : 0;
    inv.push({ k, m, d: Math.floor(rnd() * 2), shape, rot: Math.floor(rnd() * 4), cells: E.rot(E.SHAPES[shape], 0), x: null, y: null });
  }
  return inv;
}
function withRot(g, r) { const c = E.cloneGem(g); c.rot = r; c.cells = E.rot(E.SHAPES[g.shape], r); return c; }
function symmetric(shape, r) { return false; }

function placeRandom(rnd, W, H, inv, adjacent) {
  for (let attempt = 0; attempt < 60; attempt++) {
    const gems = [];
    let ok = true;
    for (let i = 0; i < inv.length && ok; i++) {
      let placed = false;
      for (let t = 0; t < 80 && !placed; t++) {
        const g = withRot(inv[i], Math.floor(rnd() * 4)); g.d = Math.floor(rnd() * 2);
        g.x = Math.floor(rnd() * W); g.y = Math.floor(rnd() * H);
        const trial = gems.concat([g]); if (E.valid(W, H, trial, !adjacent)) { gems.push(g); placed = true; }
      }
      if (!placed) ok = false;
    }
    if (ok) return gems;
  }
  return null;
}
// toutes les traces d'une mine pour une liste de tirs, utilisée pour comparer
function fullSig(W, H, gems, shots, bail) {
  const grid = E.buildGrid(W, H, gems); const out = [];
  for (const sh of shots) { out.push(E.traceSig(W, H, grid, gems, sh.slot, sh.mask)); }
  return out;
}
function allShots(W, H, laserMasks) { const a = []; E.slotsOf(W, H).forEach((s) => laserMasks.forEach((m) => a.push({ slot: s, mask: m }))); return a; }

function distinguishable(W, H, gems, shots, rnd, adjacent) {
  const base = fullSig(W, H, gems, shots);
  const grid0 = E.buildGrid(W, H, gems);
  // chaque pierre doit compter
  for (let gi = 0; gi < gems.length; gi++) {
    const rest = gems.filter((_, j) => j !== gi); const grid = E.buildGrid(W, H, rest); let diff = false;
    for (let s = 0; s < shots.length && !diff; s++) if (E.traceSig(W, H, grid, rest, shots[s].slot, shots[s].mask) !== base[s]) diff = true;
    if (!diff) return false;
  }
  // aucune variante d'une seule pierre ne doit donner le même résultat
  for (let gi = 0; gi < gems.length; gi++) {
    const g = gems[gi]; const rest = gems.filter((_, j) => j !== gi);
    for (let r = 0; r < 4; r++) for (let d = 0; d < 2; d++) {
      const v = withRot(g, r); v.d = d;
      for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
        if (r === g.rot && d === g.d && x === g.x && y === g.y) continue;
        v.x = x; v.y = y; const trial = rest.concat([v]); if (!E.valid(W, H, trial, !adjacent)) continue;
        if (E.effectString(W, H, trial) === E.effectString(W, H, gems)) continue; // même disposition vue de l'extérieur
        const grid = E.buildGrid(W, H, trial); let diff = false;
        for (let s = 0; s < shots.length && !diff; s++) if (E.traceSig(W, H, grid, trial, shots[s].slot, shots[s].mask) !== base[s]) diff = true;
        if (!diff) return false;
      }
    }
  }
  return true;
}
// retourne { inv, gems, certified }
function makeMine(seed, cfg) {
  const rnd = mulberry32(seed >>> 0); const W = cfg.W, H = cfg.H;
  const shots = allShots(W, H, cfg.laserMasks);
  let best = null;
  for (let attempt = 0; attempt < 40; attempt++) {
    const inv = makeInventory(rnd, cfg); const gems = placeRandom(rnd, W, H, inv, cfg.adjacent); if (!gems) continue;
    if (!best) best = { inv, gems, certified: false };
    // mélange des tirs pour que les premiers soient variés et sortent vite en cas de différence
    const sh = shots.slice().sort(() => rnd() - 0.5);
    if (distinguishable(W, H, gems, sh, rnd, cfg.adjacent)) return { inv, gems, certified: true };
  }
  if (!best) { const inv = makeInventory(rnd, Object.assign({}, cfg, { gems: Math.min(cfg.gems, 3) })); best = { inv, gems: placeRandom(rnd, W, H, inv, true) || [], certified: false }; }
  return best;
}
// valide une mine posée à la main par un joueur, retourne une liste de gemmes complètes ou null
function fromPlacement(W, H, inv, placement, adjacent) {
  if (!Array.isArray(placement) || placement.length !== inv.length) return null;
  const seen = new Set(); const gems = [];
  for (const p of placement) {
    const idx = +p.idx; if (!(idx >= 0 && idx < inv.length) || seen.has(idx)) return null; seen.add(idx);
    const g = withRot(inv[idx], Math.max(0, Math.min(3, Math.floor(+p.rot || 0)))); g.d = +p.d ? 1 : 0; g.x = Math.floor(+p.x); g.y = Math.floor(+p.y);
    if (!isFinite(g.x) || !isFinite(g.y)) return null; gems[idx] = g;
  }
  if (gems.some((g) => !g)) return null;
  if (!E.valid(W, H, gems, false)) return null;
  return gems;
}
module.exports = { makeMine, makeInventory, placeRandom, fromPlacement, allShots, withRot, mulberry32 };

// ============================================================
// ORAPA MINE — Explorateur robot
// Il garde une réserve d'hypothèses compatibles avec ce qu'il a vu (recuit simulé)
// puis choisit le tir qui départage le mieux ces hypothèses.
// Novice tire presque au hasard, Futé départage, Génie ne s'engage que s'il est sûr.
// ============================================================
const E = require("./public/game/engine.js");
const Gen = require("./om-gen.js");
const rng = Math.random;
const LV = { novice: 0, fute: 1, genie: 2 };
const PARAM = [{ chains: 2, iters: 900, cand: 1, sure: 0 }, { chains: 5, iters: 2400, cand: 14, sure: 1 }, { chains: 8, iters: 4200, cand: 40, sure: 2 }];

function energy(W, H, gems, obs) {
  const grid = E.buildGrid(W, H, gems); let e = 0;
  for (let i = 0; i < obs.length; i++) if (E.traceSig(W, H, grid, gems, obs[i].slot, obs[i].mask) !== obs[i].sig) e++;
  return e;
}
function anneal(W, H, inv, obs, start, iters, adjacent) {
  let cur = start || Gen.placeRandom(rng, W, H, inv, adjacent); if (!cur) return null;
  let e = energy(W, H, cur, obs); let best = cur, be = e;
  for (let it = 0; it < iters && be > 0; it++) {
    const T = Math.max(0.06, 1.2 * (1 - it / iters));
    const i = Math.floor(rng() * cur.length); const g = cur[i]; const q = rng();
    let ng = Gen.withRot(g, g.rot); ng.d = g.d; ng.x = g.x; ng.y = g.y;
    if (q < 0.55) { ng.x = Math.max(0, Math.min(W - 1, g.x + Math.floor(rng() * 5) - 2)); ng.y = Math.max(0, Math.min(H - 1, g.y + Math.floor(rng() * 5) - 2)); if (rng() < 0.25) { ng.x = Math.floor(rng() * W); ng.y = Math.floor(rng() * H); } }
    else if (q < 0.8) { ng = Gen.withRot(g, Math.floor(rng() * 4)); ng.d = g.d; ng.x = g.x; ng.y = g.y; }
    else if (g.k === "mirror" || g.k === "splitter" || g.k === "gem") ng.d = 1 - g.d;
    else { ng.x = Math.floor(rng() * W); ng.y = Math.floor(rng() * H); }
    const trial = cur.slice(); trial[i] = ng; if (!E.valid(W, H, trial, !adjacent)) continue;
    const ne = energy(W, H, trial, obs); const d = ne - e;
    if (d <= 0 || rng() < Math.exp(-d / T)) { cur = trial; e = ne; if (e < be) { be = e; best = cur; } }
  }
  return { gems: best, e: be };
}
// outcomes possibles du joueur sur un tir donné
function outcomeKey(W, H, gems, slot, mask) { const grid = E.buildGrid(W, H, gems); return E.traceSig(W, H, grid, gems, slot, mask); }

function newBrain(level) { return { level, pool: [], shots: 0 }; }
// view : { W, H, inv, shots:[{slot, mask, sig}], budgetLeft, accLeft, laserMasks, adjacent, firedKeys }
function decide(brain, view) {
  const L = LV[brain.level] !== undefined ? LV[brain.level] : 1; const P = PARAM[L];
  const { W, H, inv, laserMasks } = view; const obs = view.shots;
  // met à jour la réserve
  const found = []; const seen = new Set();
  const starts = brain.pool.slice(0, P.chains);
  for (let c = 0; c < P.chains; c++) {
    const st = starts[c] ? starts[c].map((g) => { const n = Gen.withRot(g, g.rot); n.d = g.d; n.x = g.x; n.y = g.y; return n; }) : null;
    const r = anneal(W, H, inv, obs, st, P.iters, view.adjacent); if (!r) continue;
    const key = E.effectString(W, H, r.gems);
    if (r.e === 0 && !seen.has(key)) { seen.add(key); found.push(r.gems); }
    else if (r.e > 0 && !found.length && c === P.chains - 1) found.push(r.gems);
  }
  // les anciennes hypothèses encore valables restent
  brain.pool.forEach((g) => { if (energy(W, H, g, obs) === 0) { const key = E.effectString(W, H, g); if (!seen.has(key)) { seen.add(key); found.push(g); } } });
  brain.pool = found.slice(0, 12);
  const exact = found.filter((g) => energy(W, H, g, obs) === 0);
  const distinct = exact.length;
  const budgetOut = view.budgetLeft !== null && view.budgetLeft <= 0;
  const lastChance = view.budgetLeft !== null && view.budgetLeft <= (L === 2 ? 1 : 2);
  const toPlacement = (gems) => gems.map((g, i) => ({ idx: i, x: g.x, y: g.y, rot: g.rot, d: g.d }));
  // accuse ?
  const verify = () => {
    const key0 = E.effectString(W, H, exact[0]);
    for (let c = 0; c < P.chains + 4; c++) { const r = anneal(W, H, inv, obs, null, Math.round(P.iters * 1.3), view.adjacent); if (r && r.e === 0 && E.effectString(W, H, r.gems) !== key0) { brain.pool.push(r.gems); return false; } }
    return true;
  };
  const need = Math.max(5, Math.round(inv.length * 2));
  if (distinct >= 1) {
    let ready = false;
    if (L === 0) ready = obs.length >= Math.round(inv.length * 1.5);
    else if (L === 1) ready = (distinct === 1 && obs.length >= need && verify()) || lastChance || (obs.length >= inv.length * 4 && distinct <= 2);
    else ready = (distinct === 1 && obs.length >= need && verify()) || lastChance;
    if (ready || budgetOut) return { type: "accuse", placement: toPlacement(exact[Math.floor(rng() * exact.length)]) };
  } else if (budgetOut && found.length) return { type: "accuse", placement: toPlacement(found[0]) };
  if (budgetOut) return null;
  // choisit un tir
  const fired = new Set(obs.map((o) => E.slotKey(o.slot) + "/" + o.mask));
  const all = Gen.allShots(W, H, laserMasks).filter((s) => !fired.has(E.slotKey(s.slot) + "/" + s.mask));
  if (!all.length) return distinct ? { type: "accuse", placement: toPlacement(exact[0]) } : null;
  if (L === 0 || exact.length < 2) {
    // hasard, mais préfère les tirs qui touchent la mine
    const s = all[Math.floor(rng() * all.length)]; return { type: "shoot", slot: s.slot, mask: s.mask };
  }
  let best = null, bs = -1;
  for (let t = 0; t < Math.min(P.cand, all.length); t++) {
    const s = all[Math.floor(rng() * all.length)]; const cnt = {};
    exact.forEach((g) => { const k = outcomeKey(W, H, g, s.slot, s.mask); cnt[k] = (cnt[k] || 0) + 1; });
    let h = 0; Object.keys(cnt).forEach((k) => { const p = cnt[k] / exact.length; h -= p * Math.log(p); });
    if (h > bs) { bs = h; best = s; }
  }
  if (bs <= 0 && distinct >= 1) return { type: "accuse", placement: toPlacement(exact[0]) };
  return { type: "shoot", slot: best.slot, mask: best.mask };
}
module.exports = { newBrain, decide, energy, anneal };

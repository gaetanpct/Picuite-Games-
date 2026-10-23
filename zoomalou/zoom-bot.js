// ============================================================
// ZOOMALOU — Pilotes automatiques
// Un pilote analyse le circuit tout seul, sans le connaître d'avance.
//  1. Il calcule une trajectoire de course, la ligne qui évite de freiner en coupant les virages au plus court.
//  2. Il en déduit une vitesse cible en chaque point, d'après les limites de sa voiture (rayon de virage possible, freinage, sol).
//  3. Il règle ses propres paramètres de pilotage en se faisant rouler des centaines d'essais sur le même moteur que les joueurs.
//  4. Il peut s'inspirer de la trajectoire et des vitesses d'un meilleur temps existant, humain ou non, et teste si ça va plus vite.
// Les niveaux se distinguent par le budget de réglage, la régularité et la prise de risque.
// ============================================================
const Track = require("./public/game/track.js");
const Car = require("./public/game/car.js");

const LEVELS = {
  debutant: { id: "debutant", label: "Pilote du dimanche", evals: 0, ms: 0, noise: 0.2, pace: 0.8, paceJit: 0.08, corner: 0.7, clear: 1.5, lineK: 0.3, lapse: 0.0035, useRef: 0, push: 0 },
  moyen: { id: "moyen", label: "Habitué", evals: 6, ms: 300, noise: 0.1, pace: 0.9, paceJit: 0.05, corner: 0.88, clear: 1.0, lineK: 0.6, lapse: 0.0012, useRef: 0.3, push: 0.01 },
  champion: { id: "champion", label: "Champion", evals: 34, ms: 1500, noise: 0.03, pace: 0.985, paceJit: 0.018, corner: 1.0, clear: 0.7, lineK: 0.9, lapse: 0.0002, useRef: 1, push: 0.02 },
  prodige: { id: "prodige", label: "Prodige", evals: 110, ms: 3200, noise: 0.004, pace: 1.0, paceJit: 0.003, corner: 1.0, clear: 0.6, lineK: 1.0, lapse: 0, useRef: 1, push: 0.03 },
};

const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
const wrap = (a) => { while (a > Math.PI) a -= 2 * Math.PI; while (a < -Math.PI) a += 2 * Math.PI; return a; };
const STEP = Track.STEP;

// ---------- limites d'une voiture ----------
// rayon de virage minimal à une vitesse donnée, d'après la loi de rotation du moteur de jeu
const tableCache = {};
function radiusTable(car) {
  if (tableCache[car.id]) return tableCache[car.id];
  const c = 0.68 * car.vmax; const vs = [], rs = [];
  for (let v = 2; v <= car.vmax * 1.7; v += 0.5) { const fall = 1 / (1 + Math.pow(v / c, 1.6) * 0.85); const sf = Math.min(1, v / 6); const w = car.turn * sf * fall; vs.push(v); rs.push(v / Math.max(1e-3, w)); }
  return (tableCache[car.id] = { vs, rs });
}
function speedForRadius(car, R) {
  const t = radiusTable(car); let lo = 0, hi = t.vs.length - 1; if (R >= t.rs[hi]) return t.vs[hi]; if (R <= t.rs[0]) return t.vs[0];
  while (hi - lo > 1) { const m = (lo + hi) >> 1; if (t.rs[m] <= R) lo = m; else hi = m; }
  const u = (R - t.rs[lo]) / Math.max(1e-6, t.rs[hi] - t.rs[lo]); return t.vs[lo] + (t.vs[hi] - t.vs[lo]) * u;
}
const fallOf = (car, v) => 1 / (1 + Math.pow(Math.abs(v) / (car.vmax * 0.68), 1.6) * 0.85);

// ---------- trajectoire ----------
const lineCache = new WeakMap();
function baseLine(tr, clear) {
  let m = lineCache.get(tr); if (!m) { m = new Map(); lineCache.set(tr, m); }
  const key = Math.round(clear * 10); if (m.has(key)) return m.get(key);
  const n = tr.n, X = tr.x, Z = tr.z, H = tr.h, W = tr.w; const nx = new Float64Array(n), nz = new Float64Array(n), lim = new Float64Array(n), u = new Float64Array(n), px = Float64Array.from(X), pz = Float64Array.from(Z);
  for (let i = 0; i < n; i++) { nx[i] = -Math.cos(H[i]); nz[i] = Math.sin(H[i]); lim[i] = Math.max(0, W[i] - Car.HALF_W - clear); }
  const iters = n > 1500 ? 140 : 220;
  for (let it = 0; it < iters; it++) {
    for (let i = 2; i < n - 2; i++) {
      const dx = (4 * (px[i - 1] + px[i + 1]) - (px[i - 2] + px[i + 2])) / 6, dz = (4 * (pz[i - 1] + pz[i + 1]) - (pz[i - 2] + pz[i + 2])) / 6;
      let t = (dx - X[i]) * nx[i] + (dz - Z[i]) * nz[i]; t = clamp(t, -lim[i], lim[i]); u[i] = u[i] * 0.4 + t * 0.6; px[i] = X[i] + nx[i] * u[i]; pz[i] = Z[i] + nz[i] * u[i];
    }
  }
  const res = { u, nx, nz, lim }; m.set(key, res); return res;
}

// inspiration. transforme les images enregistrées d'une course en profil latéral et en vitesse selon l'indice du circuit
function refFromFrames(tr, frames) {
  if (!frames || frames.length < 24) return null; const n = tr.n; const nF = frames.length / 8;
  const u = new Float32Array(n), v = new Float32Array(n), ok = new Uint8Array(n); let k = 0; let cnt = 0;
  for (let i = 3; i < n - 3; i++) {
    while (k < nF - 1 && frames[(k + 1) * 8 + 7] < i) k++; if (k >= nF - 1) break;
    const a = frames[k * 8 + 7], b = frames[(k + 1) * 8 + 7]; if (b < a || b - a > 12) continue; const t = b > a ? clamp((i - a) / (b - a), 0, 1) : 0;
    const x = frames[k * 8] + (frames[(k + 1) * 8] - frames[k * 8]) * t, z = frames[k * 8 + 2] + (frames[(k + 1) * 8 + 2] - frames[k * 8 + 2]) * t;
    const hh = tr.h[i]; u[i] = (x - tr.x[i]) * -Math.cos(hh) + (z - tr.z[i]) * Math.sin(hh);
    v[i] = Math.hypot(frames[(k + 1) * 8] - frames[k * 8], frames[(k + 1) * 8 + 2] - frames[k * 8 + 2]) / 0.1; ok[i] = 1; cnt++;
  }
  if (cnt < n * 0.5) return null;
  // lissage
  const u2 = Float32Array.from(u), v2 = Float32Array.from(v); for (let it = 0; it < 2; it++) for (let i = 4; i < n - 4; i++) if (ok[i]) { u2[i] = (u[i - 1] + 2 * u[i] + u[i + 1]) / 4; v2[i] = (v[i - 2] + v[i - 1] + 2 * v[i] + v[i + 1] + v[i + 2]) / 6; }
  return { u: u2, v: v2, ok };
}

// construit la trajectoire et les vitesses cibles pour un jeu de paramètres
function buildPlan(tr, car, th, ref) {
  const n = tr.n; const base = baseLine(tr, th.clear); const X = tr.x, Z = tr.z;
  const lx = new Float64Array(n), lz = new Float64Array(n);
  for (let i = 0; i < n; i++) {
    let u = base.u[i] * th.lineK;
    if (ref && th.refBlend > 0 && ref.ok[i]) { const lim = base.lim[i] + th.clear * 0.5; u = u * (1 - th.refBlend) + clamp(ref.u[i], -lim, lim) * th.refBlend; }
    lx[i] = X[i] + base.nx[i] * u; lz[i] = Z[i] + base.nz[i] * u;
  }
  // courbure de la ligne sur 4 m de chaque côté
  const kap = new Float64Array(n);
  for (let i = 2; i < n - 2; i++) {
    const ax = lx[i - 2], az = lz[i - 2], bx = lx[i], bz = lz[i], cx = lx[i + 2], cz = lz[i + 2];
    const cross = Math.abs((bx - ax) * (cz - az) - (bz - az) * (cx - ax)); const d = Math.hypot(bx - ax, bz - az) * Math.hypot(cx - bx, cz - bz) * Math.hypot(cx - ax, cz - az);
    kap[i] = d > 1e-6 ? 2 * cross / d : 0;
  }
  const ks = new Float64Array(n); for (let i = 0; i < n; i++) { const a = kap[Math.max(0, i - 1)], b = kap[i], c = kap[Math.min(n - 1, i + 1)]; ks[i] = (a + 2 * b + c) / 4; }
  const vlimA = new Float64Array(n), vlimB = new Float64Array(n);
  for (let i = 0; i < n; i++) {
    const s = tr.surf[i]; let cap = car.vmax; let cf = 1;
    if (s === 1) { cap *= 0.93; cf = clamp(th.dirtK * (0.72 + 0.3 * car.dirt), 0.4, 1.2); } else if (s === 4) { cap *= 0.62; cf = 0.9; } else if (s === 2) cf = clamp(th.iceK * (0.35 + 1.1 * car.ice), 0.3, 1.1);
    const vc = ks[i] > 1e-4 ? speedForRadius(car, 1 / ks[i]) * th.corner * cf : 1e9;
    let vr = 1e9; if (ref && th.refSpeed > 0 && ref.ok[i]) vr = th.refSpeed * ref.v[i];
    vlimA[i] = Math.min(cap * 1.02, Math.max(vc, Math.min(vr, vc * 1.35))); vlimB[i] = Math.min(cap * 1.3, Math.max(vc, Math.min(vr, vc * 1.35)));
  }
  const dec = car.brake * th.brake; const profA = new Float64Array(n), profB = new Float64Array(n);
  for (const [lim, prof] of [[vlimA, profA], [vlimB, profB]]) {
    prof[n - 1] = lim[n - 1];
    for (let i = n - 2; i >= 0; i--) { const d = Math.hypot(lx[i + 1] - lx[i], lz[i + 1] - lz[i]); prof[i] = Math.min(lim[i], Math.sqrt(prof[i + 1] * prof[i + 1] + 2 * dec * d)); }
  }
  return { lx, lz, profA, profB };
}

// ---------- pilotage ----------
function pointAt(L, ti) { const i = Math.floor(ti); const t = ti - i; const j = Math.min(L.lx.length - 1, i + 1); return [L.lx[i] + (L.lx[j] - L.lx[i]) * t, L.lz[i] + (L.lz[j] - L.lz[i]) * t]; }
function drive(r, L, th, lv, rnd, mem) {
  const tr = r.tr, car = r.car; const n = tr.n; const spd = Math.hypot(r.vx, r.vz); const fx = Math.sin(r.hd), fz = Math.cos(r.hd); const vf = r.vx * fx + r.vz * fz;
  const idx = Math.min(n - 3, Math.max(0, r.idx));
  const Ld = th.look0 + th.lookK * Math.max(vf, 0);
  const ti = Math.min(n - 2, idx + Ld / STEP); const T = pointAt(L, ti);
  const dx = T[0] - r.x, dz = T[1] - r.z; const dist = Math.max(2, Math.hypot(dx, dz)); const ang = Math.atan2(dx, dz);
  const hA = wrap(ang - r.hd); const vA = spd > 6 && vf > 0 ? wrap(ang - Math.atan2(r.vx, r.vz)) : hA; const alpha = hA * (1 - th.slipMix) + vA * th.slipMix;
  let steer;
  if (vf < 7) steer = clamp(-alpha * 2.2, -1, 1);
  else { const omega = 2 * vf * Math.sin(alpha) / dist; const wmax = car.turn * fallOf(car, vf); steer = -th.sg * omega / Math.max(0.15, wmax); mem.sat = Math.abs(steer) > 1.08; steer = clamp(steer, -1, 1); }
  mem.noise = mem.noise * 0.96 + (rnd() - 0.5) * lv.noise * 0.5; steer = clamp(steer + mem.noise, -1, 1);
  const ia = Math.min(n - 2, idx + Math.max(0, vf) * 0.12 / STEP); const prof = r.boostT > 0 ? L.profB : L.profA; const k0 = Math.floor(ia); const vt0 = prof[k0] + (prof[k0 + 1] - prof[k0]) * (ia - k0);
  let vt = vt0 * mem.pace; if (mem.sat) vt *= 0.93;
  let thr = 0, brk = 0;
  if (mem.lapse > 0) { mem.lapse--; thr = 0; } else if (lv.lapse && rnd() < lv.lapse) mem.lapse = 12 + Math.floor(rnd() * 30);
  else { if (vf < vt - 0.25) thr = 1; else if (vf > vt + th.dvHi) brk = 1; }
  if (vf < 1.5 && r.tick < 20) thr = 1;
  if (spd < 1.2 && r.tick > 90) mem.stuck++; else mem.stuck = 0;
  let rst = 0; if (mem.stuck > 110) { rst = 1; mem.stuck = 0; }
  return { steer, thr, brk, rst };
}

// ---------- réglage par essais ----------
const TH0 = { corner: 1.0, clear: 0.7, lineK: 0.9, look0: 5, lookK: 0.22, sg: 1.1, brake: 0.85, dvHi: 1.5, slipMix: 0.4, iceK: 1, dirtK: 1, refBlend: 0, refSpeed: 0 };
const RANGE = { corner: [0.7, 1.45], clear: [0.1, 2.4], lineK: [0.35, 1.0], look0: [2.5, 9], lookK: [0.06, 0.5], sg: [0.6, 2.2], brake: [0.4, 1.15], dvHi: [0.3, 4], slipMix: [0, 1], iceK: [0.4, 1.8], dirtK: [0.5, 1.5], refBlend: [0, 1], refSpeed: [0, 1.1] };
const gauss = (rnd) => { let s = 0; for (let i = 0; i < 4; i++) s += rnd(); return (s - 2) * 1.7; };

// simule une course avec les paramètres donnés. renvoie la course et les commandes
function run(tr, carId, th, lv, seed, opts) {
  opts = opts || {}; const car = Car.CARS[carId] || Car.CARS.bolide; const rnd = Track.mulberry32(Track.hashSeed("bot" + seed));
  const L = opts.plan || buildPlan(tr, car, th, opts.ref); const r = Car.newRun(tr, carId, { slot: opts.slot || 0 });
  const mem = { noise: 0, stuck: 0, lapse: 0, sat: false, pace: opts.pace == null ? 1 : opts.pace }; const maxT = Math.floor((opts.maxSeconds || 240) * 60); const bytes = opts.noBytes ? null : [];
  while (!r.finished && r.tick < maxT) { const inp = Car.quant(drive(r, L, th, lv, rnd, mem)); if (bytes) bytes.push(Car.packInput(inp)); Car.step(r, inp); }
  return { r, bytes };
}
function cost(res, tr) { const r = res.r; if (r.finished) return r.finishTime + r.resets * 6 + r.hits * 0.01; return 400 + (tr.n - r.idx) * 0.5 + r.resets * 6; }

const cacheOf = new WeakMap();
const keyOf = (carId, levelId, refTag) => carId + "|" + levelId + "|" + (refTag || "");
function entry(tr, key) { let m = cacheOf.get(tr); if (!m) { m = new Map(); cacheOf.set(tr, m); } return { get: () => m.get(key), set: (v) => m.set(key, v) }; }
function startTheta(lv) { return Object.assign({}, TH0, { corner: TH0.corner * lv.corner, clear: lv.clear, lineK: lv.lineK }); }

// état de recherche, avancé par petites étapes pour ne pas bloquer le serveur
function newSearch(tr, carId, lv, ref) {
  const th = startTheta(lv); const s = { tr, carId, lv, ref, best: th, bestCost: Infinity, it: 0, t0: Date.now(), done: false, rnd: Track.mulberry32(Track.hashSeed(tr.name + carId + lv.id + tr.n)), grid: [] };
  const evalTh = (t) => cost(run(tr, carId, t, Object.assign({}, lv, { noise: 0, lapse: 0 }), "ev", { ref, noBytes: true }), tr);
  s.evalTh = evalTh;
  if (lv.evals > 0) { s.grid = [0.85, 1.0, 1.12, 1.25].map((c) => Object.assign({}, th, { corner: th.corner * c })); if (ref && lv.useRef) { s.grid.push(Object.assign({}, th, { refBlend: 1 }), Object.assign({}, th, { refBlend: 0.5 }), Object.assign({}, th, { refBlend: 1, refSpeed: 0.95 })); } }
  s.bestCost = lv.evals > 0 ? Infinity : 0;
  return s;
}
function stepSearch(s) {
  if (s.done) return;
  const lv = s.lv; const over = s.it >= lv.evals || Date.now() - s.t0 > lv.ms; if (lv.evals <= 0 || over) { s.done = true; return; }
  let cand;
  if (s.it < s.grid.length) cand = s.grid[s.it];
  else {
    const prog = (s.it - s.grid.length) / Math.max(1, lv.evals - s.grid.length); const sigma = 0.3 * (1 - prog) + 0.05; cand = Object.assign({}, s.best); const keys = Object.keys(RANGE).filter((k) => ((k !== "refBlend" && k !== "refSpeed") || (s.ref && lv.useRef)));
    const m = 1 + Math.floor(s.rnd() * 3); for (let q = 0; q < m; q++) { const k = keys[Math.floor(s.rnd() * keys.length)]; const [a, b] = RANGE[k]; cand[k] = clamp(cand[k] + gauss(s.rnd) * sigma * (b - a), a, b); }
  }
  const c = s.evalTh(cand); s.it++; if (c < s.bestCost) { s.bestCost = c; s.best = cand; }
}
function finalize(tr, key, s) { entry(tr, key).set({ th: s.best, cost: s.bestCost, done: true, evals: s.it }); }

// calcule les réglages d'un niveau pour un circuit, tout de suite
function prepareSync(tr, carId, levelId, frames, refTag) {
  const lv0 = LEVELS[levelId] || LEVELS.moyen; const ref = frames && lv0.useRef ? refFromFrames(tr, frames) : null; if (!ref) refTag = "";
  const key = keyOf(carId, levelId, refTag); const e = entry(tr, key); const have = e.get(); if (have && have.done) return have;
  const lv = LEVELS[levelId] || LEVELS.moyen; const s = newSearch(tr, carId, lv, ref); while (!s.done) stepSearch(s); finalize(tr, key, s); return e.get();
}
// même chose sans bloquer, rappelle cb quand c'est prêt
function prepare(tr, carId, levelId, frames, refTag, cb) {
  const lv0 = LEVELS[levelId] || LEVELS.moyen; const ref = frames && lv0.useRef ? refFromFrames(tr, frames) : null; if (!ref) refTag = "";
  const key = keyOf(carId, levelId, refTag); const e = entry(tr, key); const have = e.get(); if (have && have.done) { if (cb) cb(have); return; }
  if (have && have.pending) { have.pending.push(cb); return; }
  const lv = LEVELS[levelId] || LEVELS.moyen; const s = newSearch(tr, carId, lv, ref); const waiters = cb ? [cb] : []; e.set({ pending: waiters, done: false, th: startTheta(lv) });
  const tick = () => { const t0 = Date.now(); while (!s.done && Date.now() - t0 < 25) stepSearch(s); if (s.done) { finalize(tr, key, s); const v = e.get(); waiters.forEach((f) => { try { f(v); } catch (er) { console.error(er); } }); } else setImmediate(tick); };
  setImmediate(tick);
}
function thetaFor(tr, carId, levelId, frames, refTag) {
  const have = entry(tr, keyOf(carId, levelId, refTag)).get(); if (have && have.done) return have.th;
  if (have && have.pending) return have.th; // réglage en cours, on prend la base
  return prepareSync(tr, carId, levelId, frames, refTag).th;
}

// simule un essai complet d'un pilote automatique. opts.ref images d'inspiration, opts.refTag leur nom, opts.slot départ, opts.push essais précédents ratés
function simulateRun(tr, carId, levelId, seed, maxSeconds, opts) {
  opts = opts || {}; const lv = LEVELS[levelId] || LEVELS.moyen; const rnd = Track.mulberry32(Track.hashSeed("per" + seed));
  const ref = opts.ref && lv.useRef ? refFromFrames(tr, opts.ref) : null; const refTag = ref ? opts.refTag || "ref" : "";
  const th = Object.assign({}, thetaFor(tr, carId, levelId, ref ? opts.ref : null, refTag)); const k = opts.push || 0;
  th.corner *= 1 + lv.push * k + (rnd() - 0.5) * lv.paceJit; th.brake *= 1 + (rnd() - 0.5) * lv.paceJit;
  const pace = clamp(lv.pace * (1 + (rnd() - 0.5) * lv.paceJit * 2), 0.5, 1.05);
  const res = run(tr, carId, th, lv, seed, { ref, slot: opts.slot, pace, maxSeconds: maxSeconds || 240 });
  const r = res.r; return { bytes: Uint8Array.from(res.bytes), finished: r.finished, time: r.finishTime, resets: r.resets, hits: r.hits, ticks: r.tick, maxSpeed: r.maxSpeed };
}
module.exports = { LEVELS, simulateRun, prepare, prepareSync, refFromFrames };

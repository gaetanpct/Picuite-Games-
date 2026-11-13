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
  debutant: { id: "debutant", label: "Pilote du dimanche", evals: 0, ms: 0, noise: 0.28, pace: 0.5, paceJit: 0.08, corner: 0.55, clear: 1.5, lineK: 0.3, lapse: 0.006, useRef: 0, push: 0 },
  moyen: { id: "moyen", label: "Habitué", evals: 6, ms: 300, noise: 0.14, pace: 0.64, paceJit: 0.05, corner: 0.72, clear: 1.0, lineK: 0.6, lapse: 0.002, useRef: 0.3, push: 0.01 },
  champion: { id: "champion", label: "Champion", evals: 34, ms: 1500, noise: 0.03, pace: 0.82, paceJit: 0.018, corner: 0.94, clear: 0.7, lineK: 0.9, lapse: 0.0002, useRef: 1, push: 0.02 },
  prodige: { id: "prodige", label: "Prodige", evals: 110, ms: 3200, noise: 0.004, pace: 1.0, paceJit: 0.003, corner: 1.0, clear: 0.6, lineK: 1.0, lapse: 0, useRef: 1, push: 0.03 },
};

// personnalités. Chaque pilote automatique a un caractère tiré d'après sa graine, pour que quatre champions ne roulent pas pareil
const ARCH = [
  { id: "regulier", label: "régulier", risk: -0.6, lat: 0, steady: 0.5, lapseK: 0.3 },
  { id: "prudent", label: "prudent", risk: -1, lat: 0.15, steady: 0.7, lapseK: 0.5 },
  { id: "kamikaze", label: "kamikaze", risk: 1, lat: -0.3, steady: 2.2, lapseK: 3 },
  { id: "droite", label: "colle le bord droit", risk: 0.2, lat: 0.6, steady: 1, lapseK: 1 },
  { id: "gauche", label: "colle le bord gauche", risk: 0.2, lat: -0.6, steady: 1, lapseK: 1 },
  { id: "optimiseur", label: "cherche la trajectoire parfaite", risk: 0.5, lat: 0, steady: 0.35, lapseK: 0.2 },
  { id: "fantasque", label: "fantasque", risk: 0.1, lat: 0.4, steady: 2.6, lapseK: 2.2 },
  { id: "offensif", label: "attaque les dépassements", risk: 0.8, lat: 0.5, steady: 1.2, lapseK: 1.4 },
];
function personaOf(seed) {
  const h = Track.hashSeed("per2" + seed); const a = ARCH[h % ARCH.length]; const r2 = Track.mulberry32(h);
  return Object.assign({}, a, { risk: clamp(a.risk + (r2() - 0.5) * 0.3, -1, 1), lat: clamp(a.lat + (r2() - 0.5) * 0.3, -1, 1) });
}
function applyPersona(th, lv, per) {
  if (!per) return lv;
  th.corner *= 1 + 0.07 * per.risk; th.brake *= 1 - 0.12 * per.risk; th.lat = per.lat;
  return Object.assign({}, lv, { noise: lv.noise * per.steady, lapse: lv.lapse * per.lapseK, pace: lv.pace * (1 + 0.03 * per.risk) });
}

const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
const wrap = (a) => { while (a > Math.PI) a -= 2 * Math.PI; while (a < -Math.PI) a += 2 * Math.PI; return a; };
const STEP = Track.STEP;

// ---------- limites d'une voiture ----------
// rayon de virage minimal à une vitesse donnée, d'après la loi de rotation du moteur de jeu
const tableCache = {};
function radiusTable(car) {
  if (tableCache[car.id]) return tableCache[car.id];
  const c = (car.cv || 0.68) * car.vmax; const vs = [], rs = [];
  for (let v = 2; v <= car.vmax * 1.7; v += 0.5) { const fall = 1 / (1 + Math.pow(v / c, 1.6) * 0.85); const sf = Math.min(1, v / 6); const w = car.turn * sf * fall; vs.push(v); rs.push(v / Math.max(1e-3, w)); }
  return (tableCache[car.id] = { vs, rs });
}
function speedForRadius(car, R) {
  const t = radiusTable(car); let lo = 0, hi = t.vs.length - 1; if (R >= t.rs[hi]) return t.vs[hi]; if (R <= t.rs[0]) return t.vs[0];
  while (hi - lo > 1) { const m = (lo + hi) >> 1; if (t.rs[m] <= R) lo = m; else hi = m; }
  const u = (R - t.rs[lo]) / Math.max(1e-6, t.rs[hi] - t.rs[lo]); return t.vs[lo] + (t.vs[hi] - t.vs[lo]) * u;
}
// une voiture sur un virage relevé tourne comme si sa vitesse de virage était plus haute
const bankCache = {};
function bankCar(car, b) { const q = Math.round(b * 20); const key = car.id + "@" + q; return bankCache[key] || (bankCache[key] = Object.assign({}, car, { id: key, cv: (car.cv || 0.68) * (1 + 1.25 * q / 20) })); }
const fallOf = (car, v) => 1 / (1 + Math.pow(Math.abs(v) / (car.vmax * (car.cv || 0.68)), 1.6) * 0.85);

// ---------- trajectoire ----------
const lineCache = new WeakMap();
// choix de voie aux embranchements. Par défaut la voie dont le temps estimé est le plus court
function forkGuess(tr) {
  return (tr.forks || []).map((f) => {
    const est = [0, 1].map((k) => { let L = 0, px = null, pz = null; for (let i = f.a; i <= f.b; i++) { const g = Track.forkGeo(f, i); const u = k === 0 ? (g.a0 + g.a1) / 2 : (g.b0 + g.b1) / 2; const x = tr.x[i] + -Math.cos(tr.h[i]) * u, z = tr.z[i] + Math.sin(tr.h[i]) * u; if (px != null) L += Math.hypot(x - px, z - pz); px = x; pz = z; }
      const t = f.lanes[k].t; const sl = t === "terre" ? 0.86 : t === "obst" ? 0.88 : t === "etroit" || t === "tunnel" ? 0.96 : t === "saut" ? 0.95 : t === "turbo" ? 1.08 : t === "large" ? 1.02 : 1; return L / sl; });
    return est[0] <= est[1] ? 0 : 1;
  }).join("");
}
// raccourcis par les airs. Par défaut on saute si la voiture va assez vite pour passer
function cutGuess(tr, car) { return (tr.cuts || []).map((c) => (car.vmax >= c.vreq * 1.1 ? "1" : "0")).join(""); }
function baseLine(tr, clear, fk, ck) {
  let m = lineCache.get(tr); if (!m) { m = new Map(); lineCache.set(tr, m); }
  fk = fk || ""; ck = ck || ""; const key = Math.round(clear * 10) + "|" + fk + "|" + ck; if (m.has(key)) return m.get(key);
  const n = tr.n, X = tr.x, Z = tr.z, H = tr.h, W = tr.w; const nx = new Float64Array(n), nz = new Float64Array(n), lo = new Float64Array(n), hi = new Float64Array(n), u = new Float64Array(n), px = Float64Array.from(X), pz = Float64Array.from(Z);
  const FL = Track.FLAG;
  for (let i = 0; i < n; i++) {
    nx[i] = -Math.cos(H[i]); nz[i] = Math.sin(H[i]);
    const c = (tr.flags[i] & FL.NOWALL) ? Math.max(clear, 1.0) : clear; const L = Math.max(0, W[i] - Car.HALF_W - c); lo[i] = -L; hi[i] = L;
    if (tr.flags[i] & FL.MAG) { lo[i] = 0; hi[i] = 0; }
    const ln = Track.laneAt(tr, i); if (ln) { lo[i] = Math.max(lo[i], ln[0]); hi[i] = Math.min(hi[i], ln[1]); if (lo[i] > hi[i]) { const mid = (lo[i] + hi[i]) / 2; lo[i] = hi[i] = mid; } }
  }
  // embranchements. Le pilote se place du côté de sa voie avant le butoir, puis reste dans la voie et dans son couloir libre
  (tr.forks || []).forEach((f, k) => {
    const side = fk.charAt(k) === "1" ? 1 : 0; let first = -1;
    for (let i = f.a; i <= f.b && i < n; i++) {
      const g = Track.forkGeo(f, i); const mm = Math.max(g.m, 1.3); const c = clear + 0.25;
      let a2, b2; if (side === 0) { a2 = (g.m >= 1.2 ? g.a0 : -W[i]) + Car.HALF_W + c; b2 = -mm - Car.HALF_W - c; } else { a2 = mm + Car.HALF_W + c; b2 = (g.m >= 1.2 ? g.b1 : W[i]) - Car.HALF_W - c; }
      if (f.lnObs === side && f.olo && f.olo[i - f.a] != null && g.m >= 1.2) { a2 = Math.max(a2, f.olo[i - f.a] + 0.1); b2 = Math.min(b2, f.ohi[i - f.a] - 0.1); }
      if (i > (f.a + f.b) / 2 && g.m < 1.2) break;
      if (a2 > b2) { const mid = (a2 + b2) / 2; a2 = b2 = mid; }
      lo[i] = a2; hi[i] = b2; if (first < 0) first = i;
    }
    if (first > 0) for (let d = 1; d <= 18; d++) { const j = first - d; if (j < 0) break; lo[j] = Math.max(lo[j], lo[first] - 0.45 * d); hi[j] = Math.min(hi[j], hi[first] + 0.45 * d); if (lo[j] > hi[j]) { const mid = (lo[j] + hi[j]) / 2; lo[j] = hi[j] = mid; } }
  });
  // raccourcis. Pour sauter on se place sur le tremplin bien avant le bord, sinon on reste de l'autre côté
  (tr.cuts || []).forEach((c, k) => {
    const take = ck.charAt(k) === "1"; const mid = (c.u0 + c.u1) / 2, hl = Math.max(0.2, (c.u1 - c.u0) / 2 - Car.HALF_W * 0.7);
    for (let d = 0; d <= 50; d++) { const j = c.lip - d; if (j < 0) break; const sl = Math.max(0, d - 14) * 0.45;
      if (take) { lo[j] = Math.max(lo[j], mid - hl - sl); hi[j] = Math.min(hi[j], mid + hl + sl); }
      else if (d <= 30) { if (c.u0 > 0) hi[j] = Math.min(hi[j], c.u0 - Car.HALF_W - 0.5 + Math.max(0, d - 16) * 0.5); else lo[j] = Math.max(lo[j], c.u1 + Car.HALF_W + 0.5 - Math.max(0, d - 16) * 0.5); }
      if (lo[j] > hi[j]) { const m2 = (lo[j] + hi[j]) / 2; lo[j] = hi[j] = m2; } }
  });
  // entonnoir. Avant et après un obstacle le couloir se resserre progressivement, pour avoir le temps de se placer
  { const lo0 = Float64Array.from(lo), hi0 = Float64Array.from(hi);
    for (let i = 0; i < n; i++) {
      const L = Math.max(0, W[i] - Car.HALF_W - clear); if (!(lo0[i] > -L + 0.05 || hi0[i] < L - 0.05) || (tr.flags[i] & FL.MAG)) continue; if (!Track.laneAt(tr, i)) continue;
      for (let d = 1; d <= 16; d++) for (const j of [i - d, i + d]) { if (j < 0 || j >= n || (tr.flags[j] & FL.MAG)) continue; lo[j] = Math.max(lo[j], lo0[i] - 0.4 * d); hi[j] = Math.min(hi[j], hi0[i] + 0.4 * d); }
    }
    for (let i = 0; i < n; i++) if (lo[i] > hi[i]) { const mid = (lo[i] + hi[i]) / 2; lo[i] = hi[i] = mid; } }
  const iters = n > 1500 ? 140 : 220;
  for (let it = 0; it < iters; it++) {
    for (let i = 2; i < n - 2; i++) {
      const dx = (4 * (px[i - 1] + px[i + 1]) - (px[i - 2] + px[i + 2])) / 6, dz = (4 * (pz[i - 1] + pz[i + 1]) - (pz[i - 2] + pz[i + 2])) / 6;
      let t = (dx - X[i]) * nx[i] + (dz - Z[i]) * nz[i]; t = clamp(t, lo[i], hi[i]); u[i] = u[i] * 0.4 + t * 0.6; u[i] = clamp(u[i], lo[i], hi[i]); px[i] = X[i] + nx[i] * u[i]; pz[i] = Z[i] + nz[i] * u[i];
    }
  }
  const res = { u, nx, nz, lo, hi }; m.set(key, res); return res;
}

// inspiration. transforme les images enregistrées d'une course en profil latéral et en vitesse selon l'indice du circuit
function refFromFrames(tr, frames) {
  if (!frames || frames.length < 24) return null; const n = tr.n; const nF = frames.length / 8;
  const u = new Float32Array(n), v = new Float32Array(n), ok = new Uint8Array(n); let k = 0; let cnt = 0;
  for (let i = 3; i < n - 3; i++) {
    while (k < nF - 1 && frames[(k + 1) * 8 + 7] < i) k++; if (k >= nF - 1) break;
    const a = frames[k * 8 + 7], b = frames[(k + 1) * 8 + 7]; if (b < a || b - a > 12) continue; const t = b > a ? clamp((i - a) / (b - a), 0, 1) : 0;
    const x = frames[k * 8] + (frames[(k + 1) * 8] - frames[k * 8]) * t, z = frames[k * 8 + 2] + (frames[(k + 1) * 8 + 2] - frames[k * 8 + 2]) * t;
    if (tr.flags[i] & Track.FLAG.MAG) continue; const hh = tr.h[i]; u[i] = (x - tr.x[i]) * -Math.cos(hh) + (z - tr.z[i]) * Math.sin(hh);
    v[i] = Math.hypot(frames[(k + 1) * 8] - frames[k * 8], frames[(k + 1) * 8 + 2] - frames[k * 8 + 2]) / 0.1; ok[i] = 1; cnt++;
  }
  if (cnt < n * 0.5) return null;
  // lissage
  const u2 = Float32Array.from(u), v2 = Float32Array.from(v); for (let it = 0; it < 2; it++) for (let i = 4; i < n - 4; i++) if (ok[i]) { u2[i] = (u[i - 1] + 2 * u[i] + u[i + 1]) / 4; v2[i] = (v[i - 2] + v[i - 1] + 2 * v[i] + v[i + 1] + v[i + 2]) / 6; }
  return { u: u2, v: v2, ok };
}

// construit la trajectoire et les vitesses cibles pour un jeu de paramètres
function buildPlan(tr, car, th, ref) {
  const n = tr.n; const base = baseLine(tr, th.clear, th.fk, th.ck); const X = tr.x, Z = tr.z;
  const lx = new Float64Array(n), lz = new Float64Array(n);
  for (let i = 0; i < n; i++) {
    let u = base.u[i] * th.lineK;
    if (ref && th.refBlend > 0 && ref.ok[i]) { u = u * (1 - th.refBlend) + clamp(ref.u[i], base.lo[i] - th.clear * 0.5, base.hi[i] + th.clear * 0.5) * th.refBlend; }
    if (th.lat) u += th.lat * 0.55 * (base.hi[i] - base.lo[i]) / 2;
    u = clamp(u, base.lo[i], base.hi[i]);
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
  // dans une zone sans gravité la ligne en plan ne veut rien dire, on ne freine pas pour elle
  for (let i = 0; i < n; i++) { if (tr.flags[i] & Track.FLAG.MAG) { for (let q = Math.max(0, i - 2); q <= Math.min(n - 1, i + 2); q++) ks[q] = 0; } }
  const vlimA = new Float64Array(n), vlimB = new Float64Array(n);
  const fmap = tr.forks && tr.forks.length ? Track.forkMap(tr) : null; const carB = car.boostTurn ? Object.assign({}, car, { id: car.id + "B", turn: car.turn * car.boostTurn }) : null;
  for (let i = 0; i < n; i++) {
    let s = tr.surf[i]; let cap = car.vmax; let cf = 1;
    if (fmap && fmap[i] >= 0 && (tr.flags[i] & Track.FLAG.FORK)) { const ln = tr.forks[fmap[i]].lanes[(th.fk || "").charAt(fmap[i]) === "1" ? 1 : 0]; if (ln && ln.s) s = ln.s; }
    if (s === 1) { cap *= 0.93; cf = clamp(th.dirtK * (0.72 + 0.3 * car.dirt), 0.4, 1.2); } else if (s === 4) { cap *= 0.62; cf = 0.9; } else if (s === 2) cf = clamp(th.iceK * (0.35 + 1.1 * car.ice), 0.3, 1.1);
    const bkI = tr.bank ? Math.abs(tr.bank[i]) : 0; const carK = bkI > 0.02 ? bankCar(car, bkI) : car;
    let vc = ks[i] > 1e-4 ? speedForRadius(carK, 1 / ks[i]) * th.corner * cf : 1e9; if ((tr.flags[i] & Track.FLAG.NOWALL) && vc < 1e8) vc *= 0.8;
    // la Comète braque moins pendant un turbo, sa vitesse de virage sous turbo est plus basse
    let vcB = vc; if (carB && ks[i] > 1e-4) { vcB = speedForRadius(carB, 1 / ks[i]) * th.corner * cf; if (tr.flags[i] & Track.FLAG.NOWALL) vcB *= 0.8; }
    let vr = 1e9; if (ref && th.refSpeed > 0 && ref.ok[i]) vr = th.refSpeed * ref.v[i];
    if (tr.flags[i] & Track.FLAG.NOWALL) cap *= 0.72;
    vlimA[i] = Math.min(cap * 1.02, Math.max(vc, Math.min(vr, vc * 1.35))); vlimB[i] = Math.min(cap * 1.3, Math.max(vcB, Math.min(vr, vcB * 1.35)));
  }
  const dec = car.brake * th.brake; const profA = new Float64Array(n), profB = new Float64Array(n);
  for (const [lim, prof] of [[vlimA, profA], [vlimB, profB]]) {
    prof[n - 1] = lim[n - 1];
    for (let i = n - 2; i >= 0; i--) { const d = Math.hypot(lx[i + 1] - lx[i], lz[i + 1] - lz[i]); prof[i] = Math.min(lim[i], Math.sqrt(prof[i + 1] * prof[i + 1] + 2 * dec * d)); }
  }
  // un saut demande une vitesse minimale au bord. Le pilote ne freine jamais avant la réception
  const gapMin = new Float64Array(n);
  (tr.gaps || []).forEach((g) => { const need = Math.min(car.vmax * 0.97, g.vreq * 1.1 + 1.5); for (let i = Math.max(0, g.cp - 1); i <= Math.min(n - 1, g.land + 8); i++) { gapMin[i] = Math.max(gapMin[i], need); } });
  (tr.cuts || []).forEach((c, k) => { if ((th.ck || "").charAt(k) !== "1") return; const need = Math.min(car.vmax * 0.985, c.vreq * 1.05 + 0.8); for (let i = Math.max(0, c.lip - 34); i <= Math.min(n - 1, c.lip + 2); i++) gapMin[i] = Math.max(gapMin[i], need); });
  return { lx, lz, profA, profB, gapMin, ck: th.ck || "" };
}

// ---------- pilotage ----------
function pointAt(L, ti) { const i = Math.floor(ti); const t = ti - i; const j = Math.min(L.lx.length - 1, i + 1); return [L.lx[i] + (L.lx[j] - L.lx[i]) * t, L.lz[i] + (L.lz[j] - L.lz[i]) * t]; }
function drive(r, L, th, lv, rnd, mem) {
  // un raccourci raté, le pilote ne le retente plus et reprend le détour
  if (mem.cutK != null && r.cut < 0) { if (r.resets > mem.cutRs) mem.L = buildPlan(r.tr, r.car, Object.assign({}, th, { ck: (th.ck || "").replace(/1/g, "0") }), null); mem.cutK = null; }
  if (mem.L) L = mem.L;
  const tr = r.tr, car = r.car; const n = tr.n; const spd = Math.hypot(r.vx, r.vz); const fx = Math.sin(r.hd), fz = Math.cos(r.hd); const vf = r.vx * fx + r.vz * fz;
  const idx = Math.min(n - 3, Math.max(0, r.idx));
  const Ld = th.look0 + th.lookK * Math.max(vf, 0);
  const ti = Math.min(n - 2, idx + Ld / STEP); let T = pointAt(L, ti);
  // avant un raccourci qu'il compte prendre, le pilote vise l'axe du saut pour décoller bien droit
  if (L.ck && tr.cuts) for (let q = 0; q < tr.cuts.length; q++) { const c = tr.cuts[q]; if (L.ck.charAt(q) !== "1" || idx < c.lip - 32 || idx > c.lip + 0.6) continue;
    const cfx = Math.sin(c.h), cfz = Math.cos(c.h), crx = -Math.cos(c.h), crz = Math.sin(c.h); const mid = (c.u0 + c.u1) / 2; const along = (r.x - c.ax) * cfx + (r.z - c.az) * cfz; const a2 = along + Math.max(6, Ld);
    T = [c.ax + crx * mid + cfx * a2, c.az + crz * mid + cfz * a2]; }
  // pilotes voisins. Le pilote bloque celui qui le suit, évite de percuter celui qui le précède et sort de sa trajectoire s'il vient d'être touché
  let nbCap = 99, nbShift = 0;
  if (mem.nb && mem.nb.length && !r.rail && !r.air && r.cut < 0 && mem.react > 0) {
    const cx = Math.cos(r.hd), cz = -Math.sin(r.hd); const hw = Math.max(0, (tr.w[Math.min(n - 1, idx)] || 6) - 3.2);
    for (let q = 0; q < mem.nb.length; q++) {
      const o = mem.nb[q]; const rx = o.x - r.x, rz = o.z - r.z; const f = rx * fx + rz * fz, l = rx * cx + rz * cz; const al = Math.abs(l); const sg = l >= 0 ? 1 : -1; const ovf = o.vx * fx + o.vz * fz;
      if (f < -2 && f > -15 && al < 3.6 && ovf > vf - 4) nbShift += sg * Math.min(1.6, 3.8 - al) * mem.react * (mem.block || 0.6);
      else if (f > 1.5 && f < 11 && al < 2.8) { nbShift -= sg * Math.min(1.5, 3 - al) * mem.react; if (vf > ovf + 1 && f < 7) nbCap = Math.min(nbCap, ovf + 3 + f * 0.5); }
    }
    nbShift = clamp(nbShift, -hw, hw) * Math.min(1, hw / 1.4); if (Math.abs(nbShift) > 0.05) { const ux = cx, uz = cz; T = [T[0] + ux * nbShift, T[1] + uz * nbShift]; }
  }
  const dx = T[0] - r.x, dz = T[1] - r.z; const dist = Math.max(2, Math.hypot(dx, dz)); const ang = Math.atan2(dx, dz);
  const hA = wrap(ang - r.hd); const vA = spd > 6 && vf > 0 ? wrap(ang - Math.atan2(r.vx, r.vz)) : hA; const alpha = hA * (1 - th.slipMix) + vA * th.slipMix;
  let steer;
  if (r.cut >= 0) { mem.cutK = r.cut; mem.cutRs = r.resets; const c = tr.cuts[r.cut]; return { steer: clamp(-wrap(c.h - r.hd) * 2.5, -1, 1), thr: 1, brk: 0, rst: 0 }; }
  if (r.rail) { const u = -r.ux; const psiT = clamp(0.12 * u, -0.3, 0.3); steer = clamp(-(psiT - r.hd) * 3, -1, 1); mem.sat = false; }
  else if (vf < 7) steer = clamp(-alpha * 2.2, -1, 1);
  else { const omega = 2 * vf * Math.sin(alpha) / dist; const wmax = car.turn * fallOf(car, vf); steer = -th.sg * omega / Math.max(0.15, wmax); mem.sat = Math.abs(steer) > 1.08; steer = clamp(steer, -1, 1); }
  mem.noise = mem.noise * 0.96 + (rnd() - 0.5) * lv.noise * 0.5; steer = clamp(steer + mem.noise, -1, 1);
  const ia = Math.min(n - 2, idx + Math.max(0, vf) * 0.12 / STEP); const prof = r.boostT > 0 ? L.profB : L.profA; const k0 = Math.floor(ia); const vt0 = prof[k0] + (prof[k0 + 1] - prof[k0]) * (ia - k0);
  let vt = vt0 * mem.pace; if (mem.sat) vt *= 0.93; if (L.gapMin[k0] > vt) vt = L.gapMin[k0];
  if (nbCap < vt) vt = Math.max(nbCap, vt * 0.7);
  if (mem.stun > 0) { mem.stun--; vt *= 0.8 + 0.2 * (1 - mem.stun / (mem.stunLen || 1)); steer = clamp(steer * (0.6 + 0.4 * (1 - mem.stun / (mem.stunLen || 1))), -1, 1); }
  let thr = 0, brk = 0;
  if (mem.lapse > 0) { mem.lapse--; thr = 0; } else if (lv.lapse && rnd() < lv.lapse) mem.lapse = 12 + Math.floor(rnd() * 30);
  else { if (vf < vt - 0.25) thr = 1; else if (vf > vt + th.dvHi) brk = 1; }
  if (vf < 1.5 && r.tick < 20) thr = 1;
  if (spd < 1.2 && r.tick > 90) mem.stuck++; else if (!mem.rev) mem.stuck = 0;
  // coincé contre un obstacle ou un mur. On recule un instant en braquant de l'autre côté avant de renoncer
  if (mem.rev > 0) { mem.rev--; thr = 0; brk = 1; steer = -mem.revSteer; if (mem.rev === 0) mem.stuck = 20; }
  else if (mem.stuck > 50 && mem.tries < 3) { mem.rev = 50; mem.revSteer = steer; mem.tries++; mem.stuck = 0; }
  let rst = 0; if (mem.stuck > 110) { rst = 1; mem.stuck = 0; mem.tries = 0; }
  const gf = mem.gaffe; if (gf && !r.rail && !r.air) { if (gf.t < 0 && r.idx >= gf.idx && vf > 18) gf.t = r.tick; if (gf.t >= 0 && r.tick - gf.t < gf.len) { steer = clamp(steer + gf.dir * 0.9, -1, 1); if (r.tick - gf.t < gf.len * 0.5) brk = 0, thr = 1; } }
  return { steer, thr, brk, rst };
}

// ---------- réglage par essais ----------
const TH0 = { corner: 1.0, clear: 0.7, lineK: 0.9, look0: 5, lookK: 0.22, sg: 1.1, brake: 0.85, dvHi: 1.5, slipMix: 0.4, iceK: 1, dirtK: 1, refBlend: 0, refSpeed: 0 };
const RANGE = { corner: [0.7, 1.45], clear: [0.1, 2.4], lineK: [0.35, 1.0], look0: [2.5, 9], lookK: [0.06, 0.5], sg: [0.6, 2.2], brake: [0.4, 1.15], dvHi: [0.3, 4], slipMix: [0, 1], iceK: [0.4, 1.8], dirtK: [0.5, 1.5], refBlend: [0, 1], refSpeed: [0, 1.1] };
const gauss = (rnd) => { let s = 0; for (let i = 0; i < 4; i++) s += rnd(); return (s - 2) * 1.7; };

// simule une course avec les paramètres donnés. renvoie la course et les commandes
function run(tr, carId, th, lv, seed, opts) {
  opts = opts || {}; const car = Car.CARS[carId] || Car.CARS.bolide; const rnd = Track.mulberry32(Track.hashSeed("bot" + seed));
  const L = opts.plan || buildPlan(tr, car, th, opts.ref); const r = Car.newRun(tr, carId, { slot: opts.slot || 0, launch: opts.launch, launchFix: opts.launchFix });
  const mem = { noise: 0, stuck: 0, lapse: 0, sat: false, rev: 0, revSteer: 0, tries: 0, pace: opts.pace == null ? 1 : opts.pace, gaffe: gaffeOf(tr, opts.form) }; const maxT = Math.floor((opts.maxSeconds || 240) * 60); const bytes = opts.noBytes ? null : [];
  while (!r.finished && !r.stuck && r.tick < maxT) { const inp = Car.quant(drive(r, L, th, lv, rnd, mem)); if (bytes) bytes.push(Car.packInput(inp)); Car.step(r, inp); }
  return { r, bytes };
}
// une faute franche à un endroit du circuit, seulement les jours sans
function gaffeOf(tr, form) { if (!form || !form.gaffe) return null; return { idx: Math.floor(tr.n * (0.15 + form.gaffe * 0.7)), dir: form.gDir, len: form.gLen, t: -1 }; }
function cost(res, tr) { const r = res.r; if (r.finished) return r.finishTime + r.resets * 6 + r.hits * 0.01; return 400 + (tr.n - r.idx) * 0.5 + r.resets * 6; }

const cacheOf = new WeakMap();
const keyOf = (carId, levelId, refTag) => carId + "|" + levelId + "|" + (refTag || "");
function entry(tr, key) { let m = cacheOf.get(tr); if (!m) { m = new Map(); cacheOf.set(tr, m); } return { get: () => m.get(key), set: (v) => m.set(key, v) }; }
function startTheta(lv, tr, car) { return Object.assign({}, TH0, { corner: TH0.corner * lv.corner, clear: lv.clear, lineK: lv.lineK, fk: tr ? forkGuess(tr) : "", ck: tr ? cutGuess(tr, car || Car.CARS.bolide) : "" }); }

// état de recherche, avancé par petites étapes pour ne pas bloquer le serveur
function newSearch(tr, carId, lv, ref) {
  const th = startTheta(lv, tr, Car.CARS[carId]); const s = { tr, carId, lv, ref, best: th, bestCost: Infinity, it: 0, t0: Date.now(), done: false, rnd: Track.mulberry32(Track.hashSeed(tr.name + carId + lv.id + tr.n)), grid: [] };
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
    // de temps en temps on essaie l'autre voie d'un embranchement
    if (cand.ck && s.rnd() < 0.25) { const q = Math.floor(s.rnd() * cand.ck.length); cand.ck = cand.ck.slice(0, q) + (cand.ck.charAt(q) === "1" ? "0" : "1") + cand.ck.slice(q + 1); }
    if (cand.fk && s.rnd() < 0.3) { const q = Math.floor(s.rnd() * cand.fk.length); cand.fk = cand.fk.slice(0, q) + (cand.fk.charAt(q) === "1" ? "0" : "1") + cand.fk.slice(q + 1); }
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
  const lv = LEVELS[levelId] || LEVELS.moyen; const s = newSearch(tr, carId, lv, ref); const waiters = cb ? [cb] : []; e.set({ pending: waiters, done: false, th: startTheta(lv, tr, Car.CARS[carId]) });
  const tick = () => { const t0 = Date.now(); while (!s.done && Date.now() - t0 < 25) stepSearch(s); if (s.done) { finalize(tr, key, s); const v = e.get(); waiters.forEach((f) => { try { f(v); } catch (er) { console.error(er); } }); } else setImmediate(tick); };
  setImmediate(tick);
}
function thetaFor(tr, carId, levelId, frames, refTag) {
  const have = entry(tr, keyOf(carId, levelId, refTag)).get(); if (have && have.done) return have.th;
  if (have && have.pending) return have.th; // réglage en cours, on prend la base
  return prepareSync(tr, carId, levelId, frames, refTag).th;
}

// forme du jour. Un bon pilote a parfois un jour sans (rythme plus lent, plus d'erreurs et une vraie faute de pilotage) et parfois un jour de grâce
const FORM = { debutant: [0, 0], moyen: [0.1, 0.1], champion: [0.15, 0.1], prodige: [0.17, 0.08] };
function formOf(levelId, seed) {
  const r = Track.mulberry32(Track.hashSeed("forme" + seed)); const f = FORM[levelId] || [0, 0]; const x = r();
  if (x < f[0]) return { k: "sans", pace: 0.93 - r() * 0.03, noise: 5, lapse: 0.0015, gaffe: 0.25 + r() * 0.5, gDir: r() < 0.5 ? -1 : 1, gLen: 22 + Math.floor(r() * 18) };
  if (x < f[0] + f[1]) return { k: "grace", pace: 1.012, noise: 0.5, lapse: 0, gaffe: 0 };
  return null;
}
function applyForm(lv, form) { if (!form) return lv; return Object.assign({}, lv, { noise: Math.max(lv.noise * form.noise, form.k === "sans" ? 0.03 : 0), lapse: lv.lapse + form.lapse, pace: lv.pace * form.pace }); }

// simule un essai complet d'un pilote automatique. opts.ref images d'inspiration, opts.refTag leur nom, opts.slot départ, opts.push essais précédents ratés
function simulateRun(tr, carId, levelId, seed, maxSeconds, opts) {
  opts = opts || {}; let lv = LEVELS[levelId] || LEVELS.moyen; const rnd = Track.mulberry32(Track.hashSeed("per" + seed));
  const ref = opts.ref && lv.useRef ? refFromFrames(tr, opts.ref) : null; const refTag = ref ? opts.refTag || "ref" : "";
  const th = Object.assign({}, thetaFor(tr, carId, levelId, ref ? opts.ref : null, refTag)); const k = opts.push || 0;
  th.corner *= 1 + lv.push * k + (rnd() - 0.5) * lv.paceJit; th.brake *= 1 + (rnd() - 0.5) * lv.paceJit;
  lv = applyPersona(th, lv, opts.persona ? personaOf(opts.persona) : null);
  const form = opts.noForm ? null : formOf(levelId, seed); lv = applyForm(lv, form);
  if (th.ck && (levelId === "debutant" || levelId === "moyen")) th.ck = th.ck.split("").map((c) => (c === "1" && rnd() < (levelId === "debutant" ? 0.45 : 0.2) ? "0" : c)).join("");
  if (th.fk && (levelId === "debutant" || levelId === "moyen")) th.fk = th.fk.split("").map((c) => (rnd() < (levelId === "debutant" ? 0.5 : 0.25) ? (c === "1" ? "0" : "1") : c)).join("");
  const pace = clamp(lv.pace * (1 + (rnd() - 0.5) * lv.paceJit * 2), 0.5, 1.05);
  const res = run(tr, carId, th, lv, seed, { ref, slot: opts.slot, pace, maxSeconds: maxSeconds || 240, form });
  const r = res.r; return { bytes: Uint8Array.from(res.bytes), finished: r.finished, time: r.finishTime, resets: r.resets, stuck: !!r.stuck, hits: r.hits, ticks: r.tick, maxSpeed: r.maxSpeed, form: form ? form.k : "" };
}
// pilote automatique qui roule en direct, un pas à la fois, avec le même réglage que simulateRun. Il réagit à tout ce qui le pousse
function createLive(tr, carId, levelId, seed, opts) {
  opts = opts || {}; let lv = LEVELS[levelId] || LEVELS.moyen; const rnd = Track.mulberry32(Track.hashSeed("per" + seed));
  const ref = opts.ref && lv.useRef ? refFromFrames(tr, opts.ref) : null; const refTag = ref ? opts.refTag || "ref" : "";
  const th = Object.assign({}, thetaFor(tr, carId, levelId, ref ? opts.ref : null, refTag)); const k = opts.push || 0;
  th.corner *= 1 + lv.push * k + (rnd() - 0.5) * lv.paceJit; th.brake *= 1 + (rnd() - 0.5) * lv.paceJit;
  lv = applyPersona(th, lv, opts.persona ? personaOf(opts.persona) : null);
  const form = opts.noForm ? null : formOf(levelId, seed); lv = applyForm(lv, form);
  if (th.ck && (levelId === "debutant" || levelId === "moyen")) th.ck = th.ck.split("").map((c) => (c === "1" && rnd() < (levelId === "debutant" ? 0.45 : 0.2) ? "0" : c)).join("");
  if (th.fk && (levelId === "debutant" || levelId === "moyen")) th.fk = th.fk.split("").map((c) => (rnd() < (levelId === "debutant" ? 0.5 : 0.25) ? (c === "1" ? "0" : "1") : c)).join("");
  const pace = clamp(lv.pace * (1 + (rnd() - 0.5) * lv.paceJit * 2), 0.5, 1.05);
  const car = Car.CARS[carId] || Car.CARS.bolide; const L = buildPlan(tr, car, th, ref); const r = Car.newRun(tr, carId, { slot: opts.slot || 0, launch: opts.launch, launchFix: opts.launchFix });
  const mem = { noise: 0, stuck: 0, lapse: 0, sat: false, rev: 0, revSteer: 0, tries: 0, pace, gaffe: gaffeOf(tr, form), react: levelId === "debutant" ? 0.35 : levelId === "moyen" ? 0.7 : 1, block: levelId === "expert" ? 0.9 : levelId === "difficile" ? 0.75 : 0.55, stun: 0, stunLen: 1, nb: null };
  return { r, form: form ? form.k : "", mem, maxTicks: Math.floor((opts.maxSeconds || 240) * 60), neighbours(l) { mem.nb = l; }, bumped(sev) { const n = Math.min(70, Math.round(14 + sev * 7)); if (n > mem.stun) { mem.stun = n; mem.stunLen = n; } }, step() { Car.step(r, Car.quant(drive(r, L, th, lv, rnd, mem))); } };
}
module.exports = { personaOf, ARCH, LEVELS, simulateRun, createLive, prepare, prepareSync, refFromFrames, formOf, forkGuess };

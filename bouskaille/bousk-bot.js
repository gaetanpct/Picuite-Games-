// ============================================================
// BOUSKAILLE — Cerveau des bots. Ils lisent le même monde physique que les joueurs.
// ============================================================
const Sim = require("./public/game/sim.js");
const K = Sim.K;

const LEVELS = {
  debutant: { id: "debutant", label: "Apprenti", react: 0.55, aim: 0.5, skill: 0.25, edge: 1.3, lead: 0, dodge: 0.1, counter: 0.1, hazard: 0.3, think: 0.28 },
  moyen: { id: "moyen", label: "Habitué", react: 0.32, aim: 0.26, skill: 0.5, edge: 1.9, lead: 0.4, dodge: 0.4, counter: 0.35, hazard: 0.7, think: 0.18 },
  champion: { id: "champion", label: "Champion", react: 0.18, aim: 0.12, skill: 0.78, edge: 2.4, lead: 0.8, dodge: 0.75, counter: 0.7, hazard: 0.95, think: 0.1 },
  prodige: { id: "prodige", label: "Prodige", react: 0.08, aim: 0.04, skill: 1, edge: 2.8, lead: 1, dodge: 0.95, counter: 0.95, hazard: 1, think: 0.05 },
};
const LEVEL_LIST = Object.values(LEVELS);

function newBrain(level, rnd) { return { lv: LEVELS[level] || LEVELS.moyen, rnd, next: 0, mx: 0, mz: 0, h: false, mode: "roam", holdFor: 0, holdT: 0, tgt: null, dodgeUntil: 0, dodgeDir: 0, seenAt: { chargeOk: 0 }, wander: rnd() * 6.28, aimErr: 0 }; }

const walk = (W, x, z) => !!Sim.surfaceAt(W, x, z);
// distance jusqu'au vide dans une direction, par échantillonnage
function voidDist(W, x, z, dx, dz, maxD) { for (let d = 0.6; d <= maxD; d += 0.6) if (!walk(W, x + dx * d, z + dz * d)) return d; return maxD + 1; }

// où finirait une charge lancée dans cette direction avec cette puissance, et le sol y est-il sûr
function dashSafe(W, P, dx, dz, ch) {
  const ds = K.DASH_V0 + K.DASH_V1 * ch, len = ds * (K.DASH_T0 + K.DASH_T1 * ch) * 0.86;
  for (let d = 0.8; d <= len + 1.6; d += 0.8) if (!walk(W, P.x + dx * d, P.z + dz * d)) return false;
  return true;
}
function safeDir(W, P, dx, dz, ch) {
  if (dashSafe(W, P, dx, dz, ch)) return { x: dx, z: dz, ok: true };
  const base = Math.atan2(dz, dx);
  for (const off of [0.35, -0.35, 0.7, -0.7, 1.1, -1.1]) { const a = base + off; const x = Math.cos(a), z = Math.sin(a); if (dashSafe(W, P, x, z, ch)) return { x, z, ok: true }; }
  return { x: dx, z: dz, ok: false };
}
function decide(W, P, B, now) {
  const lv = B.lv, rnd = B.rnd;
  const out = { mx: B.mx, mz: B.mz, h: B.h };
  if (!P.alive || P.fall || P.air) { B.h = false; return { mx: 0, mz: 0, h: false }; }
  const enemies = W.players.filter((q) => q !== P && q.alive && !q.fall && q.inv <= 0 && !(q.team && q.team === P.team));
  // pensée à intervalle, mais le relâchement de la charge est vérifié à chaque pas
  if (B.h) { B.holdT += Sim.DT; }
  if (B.mode === "charge" && B.h) {
    const tg = B.tgt && W.players.find((q) => q.id === B.tgt);
    if (!tg || !tg.alive || tg.fall) { B.h = false; B.mode = "roam"; B.next = now + 0.1; }
    else {
      const d = Math.hypot(tg.x - P.x, tg.z - P.z);
      const lead = lv.lead * Math.min(0.35, d / (K.DASH_V0 + K.DASH_V1 * P.ch)); const ax = tg.x + tg.vx * lead - P.x, az = tg.z + tg.vz * lead - P.z; const al = Math.hypot(ax, az) || 1;
      const ang = Math.atan2(az, ax) + B.aimErr; B.mx = Math.cos(ang) * 0.3; B.mz = Math.sin(ang) * 0.3;
      const wantRelease = B.holdT >= B.holdFor || d < 1.35 + 0.25 * P.ch || (tg.dash > 0 && B.holdT > 0.3 && rnd() < 0.05);
      if (wantRelease) {
        let ux = Math.cos(ang), uz = Math.sin(ang);
        if (lv.skill > 0.45 || rnd() < 0.4) { const sd = safeDir(W, P, ux, uz, P.ch); if (!sd.ok) { // pas de charge vers le vide, on l'oriente vers le centre
            const hc = Math.hypot(P.x, P.z) || 1; const cx = -P.x / hc, cz = -P.z / hc; const s2 = safeDir(W, P, cx, cz, P.ch); ux = s2.x; uz = s2.z; } else { ux = sd.x; uz = sd.z; } }
        B.h = false; B.mx = ux; B.mz = uz; B.mode = "release"; B.next = now + 0.05;
      }
      return { mx: B.mx, mz: B.mz, h: B.h };
    }
  }
  if (B.mode === "release") { B.mode = "roam"; B.next = now + 0.25; out.h = false; return { mx: B.mx, mz: B.mz, h: false }; }
  if (now < B.next) return out;
  B.next = now + lv.think * (0.7 + rnd() * 0.6);
  // danger, bord proche
  const sp = Math.hypot(P.vx, P.vz);
  let mx = 0, mz = 0, priority = 0;
  const margin = lv.edge * (rnd() < 0.15 && lv.skill < 0.6 ? 0.4 : 1);
  const ahead = sp > 1 ? { x: P.vx / sp, z: P.vz / sp } : { x: P.fx, z: P.fz };
  const dAhead = voidDist(W, P.x, P.z, ahead.x, ahead.z, margin + sp * 0.35);
  const here = Math.hypot(P.x, P.z);
  if (dAhead <= margin + sp * 0.3) {
    // direction la plus sûre parmi 12, on préfère le vide lointain puis le centre
    let best = null, bs = -1e9;
    for (let k = 0; k < 12; k++) { const a = (k / 12) * Math.PI * 2; const dx = Math.cos(a), dz = Math.sin(a); const vd = voidDist(W, P.x, P.z, dx, dz, 6); const toC = (-P.x * dx - P.z * dz) / (here || 1); const sc = Math.min(vd, 6) + toC * 2.5; if (sc > bs) { bs = sc; best = { x: dx, z: dz }; } }
    mx = best.x; mz = best.z; priority = 3; B.h = false; B.mode = "roam";
  }
  // pièges mobiles
  if (priority < 2 && rnd() < lv.hazard) {
    const t1 = W.t + 0.45;
    for (const b of W.arena.bars) { const sg = Sim.barSeg(b, t1); const sx = sg.x1 - sg.x0, sz = sg.z1 - sg.z0; let u = ((P.x - sg.x0) * sx + (P.z - sg.z0) * sz) / (sx * sx + sz * sz); u = Math.max(0, Math.min(1, u)); const qx = sg.x0 + sx * u, qz = sg.z0 + sz * u; const d = Math.hypot(P.x - qx, P.z - qz); if (d < 2.3) { mx = (P.x - qx) / (d || 1); mz = (P.z - qz) / (d || 1); priority = 2; } }
    for (const o of W.arena.sliders) { const bx = Sim.sliderBox(o, W.t + 0.9); if (Math.abs(P.x - bx.x) < bx.hw + 1.8 && Math.abs(P.z - bx.z) < bx.hd + 1.8) { const dx = P.x - bx.x, dz = P.z - bx.z, d = Math.hypot(dx, dz) || 1; mx = dx / d; mz = dz / d; priority = 2; } }
    for (const g of W.arena.pegs) if (g.bounce && Math.hypot(P.x - g.x, P.z - g.z) < g.r + 1.4) { const dx = P.x - g.x, dz = P.z - g.z, d = Math.hypot(dx, dz) || 1; mx = dx / d; mz = dz / d; priority = 1; }
  }
  // esquive d'une charge adverse
  if (priority < 2 && now > B.dodgeUntil) {
    for (const e of enemies) {
      if (e.dash <= 0) continue; const dx = P.x - e.x, dz = P.z - e.z, d = Math.hypot(dx, dz); if (d > 6 || d < 0.5) continue;
      const dot = (e.dx * dx + e.dz * dz) / d; if (dot < 0.8) continue;
      if (rnd() < lv.dodge) { B.dodgeDir = rnd() < 0.5 ? 1 : -1; B.dodgeUntil = now + 0.35; B.h = false; B.mode = "roam"; }
    }
  }
  if (now < B.dodgeUntil) { const e = enemies.find((q) => q.dash > 0); if (e) { mx = -e.dz * B.dodgeDir; mz = e.dx * B.dodgeDir; priority = 2; } }
  if (priority >= 2) { B.mx = mx; B.mz = mz; return { mx, mz, h: B.h }; }
  // cible
  if (!enemies.length) { B.mx = -P.x * 0.1; B.mz = -P.z * 0.1; return { mx: B.mx, mz: B.mz, h: false }; }
  let tg = null, ts = -1e9;
  for (const e of enemies) {
    const dx = e.x - P.x, dz = e.z - P.z, d = Math.hypot(dx, dz) || 1; let sc = -d;
    if (lv.skill > 0.4) { const vd = voidDist(W, e.x, e.z, dx / d, dz / d, 5); if (vd < 5) sc += (5 - vd) * 1.1 * lv.skill; if (e.rec > 0 || e.stun > 0) sc += 2.5 * lv.skill; if (e.holding) sc += 0.8; }
    if (B.tgt === e.id) sc += 1.2; if (sc > ts) { ts = sc; tg = e; }
  }
  B.tgt = tg.id;
  const dx = tg.x - P.x, dz = tg.z - P.z, d = Math.hypot(dx, dz) || 1;
  const ux = dx / d, uz = dz / d; const faceDot = P.fx * ux + P.fz * uz;
  // contre-attaque quand l'adversaire vient de rater sa charge
  const punish = (tg.rec > 0.2 && lv.counter > rnd()) || tg.stun > 0.15;
  // poussée courte
  if (d < 1.7 && faceDot > 0.55 && P.cd <= 0 && P.rec <= 0 && rnd() < 0.25 + 0.55 * lv.skill) { B.h = true; B.mode = "pulse"; B.holdFor = 0.04; B.holdT = 0; B.mx = ux; B.mz = uz; B.next = now + 0.05; return { mx: ux, mz: uz, h: true }; }
  if (B.mode === "pulse") { B.h = false; B.mode = "roam"; }
  // charge
  const inRange = d > 1.6 && d < 3.2 + 3.2 * lv.skill && (lv.skill < 0.45 ? rnd() < 0.5 : dashSafe(W, P, ux, uz, 0.5) || dashSafe(W, P, ux, uz, 0.1));
  if (inRange && faceDot > 0.8 && P.cd <= 0 && P.rec <= 0 && P.stun <= 0 && now > B.seenAt.chargeOk && (punish || rnd() < 0.2 + 0.5 * lv.skill) && !(tg.holding && tg.ch > 0.5 && rnd() < lv.dodge * 0.5)) {
    const want = Math.min(1, (d - 1.2) / 5 + 0.15 + (punish ? 0.2 : 0)) * (0.5 + 0.5 * lv.skill);
    B.mode = "charge"; B.h = true; B.holdT = 0; B.holdFor = K.CH_MIN + 0.05 + want * K.CH_SPAN; B.aimErr = (rnd() - 0.5) * 2 * lv.aim; B.seenAt.chargeOk = now + 0.4;
    B.mx = ux * 0.3; B.mz = uz * 0.3; B.next = now + 0.05; return { mx: B.mx, mz: B.mz, h: true };
  }
  // approche, avec un peu de contournement pour viser le côté du vide
  let ax = ux, az = uz;
  if (lv.skill > 0.5 && d > 3) { // on se place du côté opposé au vide
    const vd = voidDist(W, tg.x, tg.z, ux, uz, 5); if (vd >= 5) { const toC = Math.hypot(tg.x, tg.z) || 1; const cx = -tg.x / toC, cz = -tg.z / toC; ax = ux + cx * 0.0; az = uz + cz * 0.0; }
  }
  const err = (rnd() - 0.5) * 2 * lv.aim; const c = Math.cos(err), s = Math.sin(err);
  let rx = ax * c - az * s, rz = ax * s + az * c;
  if (d < 2.3 && B.seenAt.chargeOk > now) { rx *= 0.2; rz *= 0.2; } // laisse retomber après une charge
  B.mx = rx * (d < 1.4 ? 0.6 : 1); B.mz = rz * (d < 1.4 ? 0.6 : 1);
  return { mx: B.mx, mz: B.mz, h: B.h };
}
module.exports = { LEVELS, LEVEL_LIST, newBrain, decide };

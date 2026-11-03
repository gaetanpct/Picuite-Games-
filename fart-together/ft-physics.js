// ============================================================
// FART TOGETHER — Physique d'une bouée
// Chaque joueur pousse depuis son siège. Toutes les forces agissent sur la même bouée.
// Même direction, on accélère. Directions différentes, on tourne. Mal coordonné, on chavire.
// ============================================================
const W = require("./public/game/world.js");
const R = 1.7, SEAT_R = 1.15, FMAX = 9, CAP_LEAN = 0.95;
const ABIL = {
  costaud: { force: 1.25, tank: 0.7, label: "Costaud" }, endurant: { force: 0.87, tank: 1.45, label: "Endurant" },
  rafale: { force: 1, tank: 1, ramp: 0.28, label: "Rafale" }, stabilo: { force: 0.92, tank: 1, torque: 0.6, label: "Stabilisateur" },
};
const rot = (x, z, a) => [x * Math.cos(a) + z * Math.sin(a), -x * Math.sin(a) + z * Math.cos(a)];
function seatPos(n, k) { const a = (k / n) * Math.PI * 2; return [Math.sin(a) * SEAT_R, Math.cos(a) * SEAT_R]; } // repère de la bouée, z vers l'avant
function newBoat(id, seatIds, x, z, yaw) {
  return { id, seats: seatIds.slice(), x, z, yaw, vx: 0, vz: 0, w: 0, lean: 0, dlean: 0, leanT: 0, y: 0, vy: 0, air: false, cap: false, capT: 0, right: 0, hp: 5, s: 0, idx: 0, fin: false, finT: 0, coins: 0, egg: 100, gatesOk: 0, gatesMiss: 0, nextGate: 0, hits: 0, caps: 0, dist: 0, lastSafe: { x, z, yaw }, bumpT: 0, stun: 0, noRight: 0, dead: false };
}
// players : map id -> { a, p, tank, press, ab, rest, jitter, inv }
function step(boat, dt, t, lv, players, env) {
  const near = W.nearest(lv, boat.x, boat.z, boat.idx); boat.idx = near.i; boat.s = Math.max(boat.s, near.s);
  const n = boat.seats.length; let fx = 0, fz = 0, torque = 0, lat = 0, pushing = 0, active = 0;
  boat.seats.forEach((pid, k) => {
    const pl = players[pid]; if (!pl) return; const ab = ABIL[pl.ab] || ABIL.rafale; const tankMax = 100 * ab.tank * (pl.tm || 1);
    const want = pl.p && !boat.cap && !boat.air && pl.tank > 0 && !pl.dry && !boat.dead;
    if (want) { pl.press = Math.min(1, pl.press + dt / (0.6 - (ab.ramp || 0) * 0.6 + 0.001)); pl.tank -= 24 * dt * (0.5 + pl.press * 0.5); pl.rest = 0.5; if (pl.tank <= 0) { pl.tank = 0; pl.dry = true; } pushing++; }
    else { pl.press = Math.max(0, pl.press - dt * 3.5); pl.rest -= dt; if (pl.rest <= 0) pl.tank = Math.min(tankMax, pl.tank + 17 * dt); if (pl.dry && pl.tank > 28) pl.dry = false; }
    pl.tankMax = tankMax; active++;
    if (!want) return;
    const power = (0.32 + 0.68 * pl.press) * FMAX * ab.force * (env.gasMul || 1) * (n > 4 ? Math.sqrt(4 / n) : 1);
    let a = pl.a + (pl.jitter || 0) + (env.invert ? Math.PI : 0); if (pl.burst) a = pl.burstA;
    const bx = Math.sin(a), bz = Math.cos(a); // poussée dans le repère de la bouée
    const [wx, wz] = rot(bx, bz, boat.yaw); // vers le repère monde
    const f = power * (pl.burst ? 2 : 1); const Fx = wx * f, Fz = wz * f; fx += Fx; fz += Fz;
    const [sx, sz] = seatPos(n, k); const tq = (sz * bx - sx * bz) * f * (ab.torque || 1); torque += tq;
    lat += Math.abs(tq) * 0.5;
  });
  // flux et traînée
  let flowMul = 1, dragK = 0.62, grav = near.slope;
  if (near.zone === 1) { dragK = 1.6; flowMul = 0.6; } else if (near.zone === 2) dragK = 0.18;
  const fl = near.flow * flowMul; const fvx = near.tx * fl, fvz = near.tz * fl;
  let wvx = 0, wvz = 0; if (near.zone === 3 || near.zone === 5) { const sgn = near.zone === 3 ? 1 : -1; wvx = -near.tz * 3.2 * sgn; wvz = near.tx * 3.2 * sgn; }
  if (env.gust) { wvx += env.gust[0]; wvz += env.gust[1]; }
  const air = boat.air;
  if (!boat.dead) {
    const rx = boat.vx - fvx - wvx, rz = boat.vz - fvz - wvz; const rs = Math.hypot(rx, rz);
    const dk = air ? 0.05 : dragK + 0.05 * rs;
    boat.vx += (fx - rx * dk + near.tx * grav * 0.9) * dt; boat.vz += (fz - rz * dk + near.tz * grav * 0.9) * dt;
    if (near.turb && !air) { boat.vx += (Math.sin(t * 3.1 + boat.id * 7) * 2.2) * dt; boat.vz += (Math.cos(t * 2.7 + boat.id) * 2.2) * dt; boat.dlean += (Math.sin(t * 4.3 + boat.id * 3) * 2.4) * dt; }
    boat.w += torque * 0.55 * dt; boat.w -= boat.w * (air ? 0.4 : 2.4) * dt;
    const sp = Math.hypot(boat.vx, boat.vz); if (sp > 26) { boat.vx *= 26 / sp; boat.vz *= 26 / sp; }
  }
  boat.yaw += boat.w * dt; boat.x += boat.vx * dt; boat.z += boat.vz * dt; boat.dist += Math.hypot(boat.vx, boat.vz) * dt;
  // inclinaison
  const sp2 = Math.hypot(boat.vx, boat.vz); const imb = torque * 1.0 + boat.w * sp2 * 0.9; const drive = Math.max(-2.2, Math.min(2.2, imb * 0.075));
  boat.dlean += (drive * 3.2 - boat.lean * 10 - boat.dlean * 2.4) * dt; boat.lean += boat.dlean * dt;
  if (boat.lean > 1.5) { boat.lean = 1.5; boat.dlean = 0; } if (boat.lean < -1.5) { boat.lean = -1.5; boat.dlean = 0; }
  if (!boat.cap && Math.abs(boat.lean) > CAP_LEAN) { boat.leanT += dt; if (boat.leanT > 0.45) { boat.cap = true; boat.caps++; boat.right = 0; boat.capT = 0; boat.hp -= env.hpOnCap || 0; env.events.push({ k: "cap", b: boat.id }); } } else if (!boat.cap) boat.leanT = Math.max(0, boat.leanT - dt);
  // redressage, tout l'équipage doit pousser ensemble
  if (boat.cap) {
    boat.capT += dt; const crew = boat.seats.filter((id) => players[id]); const pr = crew.filter((id) => players[id].p).length;
    boat.right += dt * (pr / Math.max(1, crew.length)) * (pr >= Math.ceil(crew.length / 2) ? 1 : 0.25);
    if (boat.right >= 1.4 || boat.capT > 7) { boat.cap = false; boat.lean = 0; boat.dlean = 0; boat.leanT = 0; boat.vx *= 0.3; boat.vz *= 0.3; env.events.push({ k: "righted", b: boat.id, auto: boat.right < 1.4 }); if (boat.right < 1.4) boat.stun = 1; }
  }
  // rives
  const nr = W.nearest(lv, boat.x, boat.z, boat.idx); const lim = nr.hw - R * 0.8;
  if (Math.abs(nr.lat) > lim && !boat.air) {
    const over = Math.abs(nr.lat) - lim; const sgn = nr.lat > 0 ? 1 : -1; const nxn = -nr.tz * sgn, nzn = nr.tx * sgn; // normale vers l'extérieur
    boat.x -= nxn * over; boat.z -= nzn * over; const vn = boat.vx * nxn + boat.vz * nzn;
    if (vn > 0) { boat.vx -= (1 + 0.38) * vn * nxn; boat.vz -= (1 + 0.38) * vn * nzn; boat.vx *= 0.93; boat.vz *= 0.93; if (vn > 3.2) bump(boat, vn, env, "rive", nxn, nzn); }
    boat.w += (Math.random() - 0.5) * 0.4 * Math.min(1, vn / 6);
  }
  // obstacles
  lv.obstacles.forEach((o) => {
    const [ox, oz] = W.obsPos(o, t); const dx = boat.x - ox, dz = boat.z - oz; const d = Math.hypot(dx, dz), min = R + o.r;
    if (d < min && d > 0.001 && !boat.air) { const nx = dx / d, nz = dz / d; boat.x += nx * (min - d); boat.z += nz * (min - d); const vn = boat.vx * nx + boat.vz * nz; if (vn < 0) { boat.vx -= (1 + 0.5) * vn * nx; boat.vz -= (1 + 0.5) * vn * nz; if (-vn > 2.4) bump(boat, -vn, env, o.kind, nx, nz); } }
  });
  // rampes, chutes, trampolines
  lv.ramps.forEach((r) => {
    if (boat.air || boat.cap) return; if (boat.s >= r.s && boat.s < r.s + r.len && boat.lastRamp !== r) {
      boat.lastRamp = r; const sp = Math.hypot(boat.vx, boat.vz); boat.vy = Math.max(r.fall ? 3 : 4.5, sp * 0.42 * r.power); boat.air = true; boat.airT = 0; env.events.push({ k: "jump", b: boat.id, pad: !!r.pad });
    }
  });
  if (boat.air) { boat.airT += dt; boat.vy -= 22 * dt; boat.y += boat.vy * dt; boat.lean += Math.sin(t * 9 + boat.id) * dt * 0.6;
    if (boat.y <= 0 && boat.vy < 0) { boat.y = 0; boat.air = false; const impact = -boat.vy; boat.dlean += (Math.random() - 0.5) * impact * 0.55 * (1 + Math.min(1, Math.abs(boat.w) * 0.5)); if (impact > 5) env.events.push({ k: "splash", b: boat.id, p: impact }); boat.vy = 0; }
  }
  if (!boat.air && Math.abs(nr.lat) < nr.hw - 2 && !boat.cap) { boat.lastSafe = { x: boat.x, z: boat.z, yaw: boat.yaw }; }
  if (boat.stun > 0) boat.stun -= dt;
  boat.bumpT = Math.max(0, boat.bumpT - dt);
  if (boat.s >= lv.L - 2) { if (!boat.fin) { boat.fin = true; boat.finT = t; env.events.push({ k: "fin", b: boat.id }); } }
  return near;
}
function bump(boat, v, env, kind, nx, nz) {
  if (boat.bumpT > 0) return; boat.bumpT = 0.35; boat.hits++; boat.dlean += (Math.random() < 0.5 ? -1 : 1) * Math.min(3.5, v * 0.5); boat.w += (Math.random() - 0.5) * v * 0.3;
  env.events.push({ k: "bump", b: boat.id, v: Math.round(v * 10) / 10, kind });
  if (env.hpOnHit && v > 4.5) { boat.hp -= 1; if (boat.hp <= 0) boat.dead = true; }
  if (env.eggHit) boat.egg = Math.max(0, boat.egg - Math.min(40, v * 5));
}
// collision entre bouées
function boatVsBoat(a, b, env) {
  if (a.air || b.air) return; const dx = b.x - a.x, dz = b.z - a.z; const d = Math.hypot(dx, dz), min = R * 2; if (d >= min || d < 0.001) return;
  const nx = dx / d, nz = dz / d; const o = (min - d) / 2; a.x -= nx * o; a.z -= nz * o; b.x += nx * o; b.z += nz * o;
  const rv = (b.vx - a.vx) * nx + (b.vz - a.vz) * nz; if (rv < 0) { const j = -(1 + 0.6) * rv / 2; a.vx -= j * nx; a.vz -= j * nz; b.vx += j * nx; b.vz += j * nz; if (-rv > 2.5) { a.dlean += 1.1 * (Math.random() < 0.5 ? -1 : 1); b.dlean += 1.1 * (Math.random() < 0.5 ? -1 : 1); env.events.push({ k: "bump", b: a.id, v: -rv, kind: "bouée" }); } }
}
module.exports = { step, newBoat, boatVsBoat, seatPos, ABIL, R, rot, SEAT_R, FMAX };

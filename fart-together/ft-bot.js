// ============================================================
// FART TOGETHER — Équipier robot
// Il vise le point à suivre sur la rivière, évite les obstacles, relâche quand la bouée penche
// et pousse seulement quand cela aide aussi à garder la bouée droite.
// Stagiaire se trompe et oublie, Matelot suit bien, Capitaine anticipe les virages.
// ============================================================
const W = require("./public/game/world.js");
const P = require("./ft-physics.js");
const LV = { stagiaire: { noise: 0.5, lag: 0.45, look: 14, avoid: 0.4, lean: 0.62, sloppy: 0.25 }, matelot: { noise: 0.2, lag: 0.22, look: 20, avoid: 0.8, lean: 0.55, sloppy: 0.08 }, capitaine: { noise: 0.06, lag: 0.08, look: 28, avoid: 1.1, lean: 0.5, sloppy: 0.01 } };
function wrap(a) { while (a > Math.PI) a -= 2 * Math.PI; while (a < -Math.PI) a += 2 * Math.PI; return a; }
// retourne { a, p } pour le siège k de la bouée
function control(bot, boat, k, lv, t, players, level, dt) {
  const L = LV[level] || LV.matelot; const n = boat.seats.length;
  if (boat.cap) return { a: 0, p: true };
  // mémoire de réaction
  bot.timer = (bot.timer || 0) - dt; if (bot.timer > 0 && bot.last) return bot.last;
  bot.timer = L.lag * (0.6 + Math.random() * 0.8);
  const near = W.nearest(lv, boat.x, boat.z, boat.idx);
  const target = W.pointAt(lv, near.s + L.look + Math.hypot(boat.vx, boat.vz) * (level === "capitaine" ? 1.2 : 0.5));
  let dx = target.x - boat.x, dz = target.z - boat.z;
  // courant contraire, on vise un peu plus fort devant
  // évitement
  lv.obstacles.forEach((o) => { const [ox, oz] = W.obsPos(o, t + 0.6); const rx = boat.x - ox, rz = boat.z - oz; const d = Math.hypot(rx, rz); const reach = 13 + o.r; if (d < reach && d > 0.01) { const along = (ox - boat.x) * near.tx + (oz - boat.z) * near.tz; if (along > -2) { const f = L.avoid * (1 - d / reach) * 38; dx += rx / d * f; dz += rz / d * f; } } });
  // rive
  const edge = near.hw - 3.2; if (Math.abs(near.lat) > edge - 3) { const sgn = near.lat > 0 ? 1 : -1; dx += near.tz * sgn * 8; dz += -near.tx * sgn * 8; }
  // coincé contre un rocher ou une rive, tout l'équipage recule en biais pour se dégager (état partagé sur la bouée)
  { if (boat.slowAt !== t) { boat.slowAt = t; const spd0 = Math.hypot(boat.vx, boat.vz); boat.slowT = spd0 < 1.2 ? (boat.slowT || 0) + (dt || 0.033) : 0; }
    if (boat.slowT > 2.0 && !(boat.rec && t < boat.rec.until)) {
      let bo = null, bd = 6; lv.obstacles.forEach((o) => { const [ox, oz] = W.obsPos(o, t); const d = Math.hypot(boat.x - ox, boat.z - oz) - o.r; if (d < bd) { bd = d; bo = [ox, oz]; } });
      const nearBank = Math.abs(near.lat) > near.hw - 4;
      if (bo || nearBank) {
        let ax = 0, az = 0; if (bo) { const d = Math.hypot(boat.x - bo[0], boat.z - bo[1]) || 1; ax = (boat.x - bo[0]) / d; az = (boat.z - bo[1]) / d; }
        boat.rec = { until: t + 1.6, dx: ax - near.tx * 0.4, dz: az - near.tz * 0.4 }; }
      boat.slowT = 0; }
    if (boat.rec && t < boat.rec.until) { dx = boat.rec.dx * 10; dz = boat.rec.dz * 10; } }
  const dl = Math.hypot(dx, dz) || 1; let wantA = Math.atan2(dx, dz) - boat.yaw; wantA = wrap(wantA + (Math.random() - 0.5) * L.noise);
  const sp = Math.hypot(boat.vx, boat.vz); const targetSpeed = level === "capitaine" ? 14 : level === "matelot" ? 11 : 8;
  const [sx, sz] = P.seatPos(n, k); const cone = P.Z.aimCone(n, k);
  const yawErr = wrap(Math.atan2(near.tx, near.tz) - boat.yaw); const wantTq = Math.max(-2, Math.min(2, yawErr * 1.6 - boat.w * 1.1 + (Math.abs(near.lat) > near.hw - 5 ? 0 : 0)));
  const gap = Math.max(-0.4, Math.min(1, (targetSpeed - sp) / targetSpeed));
  const velA = wrap(Math.atan2(boat.vx, boat.vz) - boat.yaw);
  // chaque bot choisit dans son cône la direction qui sert le mieux, vitesse voulue et rotation voulue
  let bestA = cone.c, best = -9; const steps = cone.h >= Math.PI - 1e-6 ? 24 : 10;
  for (let i = 0; i <= steps; i++) {
    const a = cone.h >= Math.PI - 1e-6 ? wantA + (i / steps - 0.5) * 2 * Math.PI : cone.c + (i / steps * 2 - 1) * cone.h;
    const bx = Math.sin(a), bz = Math.cos(a); const tq = (sz * bx - sx * bz) / 1.15;
    const trans = Math.cos(wrap(a - wantA)); const brake = gap < 0 ? -Math.cos(wrap(a - velA)) * -gap * 1.2 : 0;
    const sc = gap * trans + brake + 0.62 * tq * wantTq * (n === 1 ? 0.35 : 1) / 2 * 2;
    if (sc > best) { best = sc; bestA = a; }
  }
  let push = best > 0.12 + (n === 1 ? 0.0 : 0.04);
  if (Math.abs(boat.lean) > L.lean) push = false;
  if (players[boat.seats[k]] && players[boat.seats[k]].dry) push = false;
  if (Math.random() < L.sloppy) push = !push;
  if (n > 1 && level !== "capitaine" && (k + Math.floor(t / 2)) % (n + 1) === 0 && Math.random() < 0.3) push = false;
  wantA = bestA;
  bot.last = { a: wantA, p: push }; return bot.last;
}
module.exports = { control, LV };

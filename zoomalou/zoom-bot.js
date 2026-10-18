// ============================================================
// ZOOMALOU — Pilotes automatiques
// Un pilote suit la ligne centrale du circuit en freinant avant les virages.
// Il tourne sur le même moteur que les joueurs, donc ses temps sont réalistes.
// ============================================================
const Track = require("./public/game/track.js");
const Car = require("./public/game/car.js");

const LEVELS = {
  debutant: { id: "debutant", label: "Pilote du dimanche", lat: 13, look: 0.75, noise: 0.22, steerGain: 1.5, margin: 0.78, slipy: 0.3 },
  moyen: { id: "moyen", label: "Habitué", lat: 17, look: 0.9, noise: 0.12, steerGain: 1.9, margin: 0.88, slipy: 0.2 },
  champion: { id: "champion", label: "Champion", lat: 21, look: 1.0, noise: 0.05, steerGain: 2.3, margin: 0.95, slipy: 0.1 },
  prodige: { id: "prodige", label: "Prodige", lat: 25, look: 1.1, noise: 0.015, steerGain: 2.6, margin: 1.0, slipy: 0.05 },
};

function curvature(tr, i) { const a = Math.min(tr.n - 2, Math.max(0, i)); const b = Math.min(tr.n - 1, a + 3); let d = tr.h[b] - tr.h[a]; while (d > Math.PI) d -= 2 * Math.PI; while (d < -Math.PI) d += 2 * Math.PI; return Math.abs(d) / Math.max(1, (b - a) * tr.step); }

// renvoie la commande pour ce pas
function drive(r, lv, rnd, mem) {
  const tr = r.tr, car = r.car; const spd = Math.hypot(r.vx, r.vz); const fx = Math.sin(r.hd), fz = Math.cos(r.hd); const vf = r.vx * fx + r.vz * fz;
  // cible de visée
  const ld = (7 + spd * 0.42) * lv.look; const ti = Math.min(tr.n - 1, r.idx + ld / tr.step);
  const tgt = Car.sampleAt(tr, ti); const me = Car.sampleAt(tr, r.idx);
  // ligne légèrement à l'intérieur du virage
  const rrx = -Math.cos(tgt.h), rrz = Math.sin(tgt.h);
  let want = Math.atan2(tgt.x - r.x, tgt.z - r.z);
  let da = want - r.hd; while (da > Math.PI) da -= 2 * Math.PI; while (da < -Math.PI) da += 2 * Math.PI;
  let steer = -da * lv.steerGain; steer += (mem.noise = mem.noise * 0.96 + (rnd() - 0.5) * lv.noise * 0.5) ;
  steer = Math.max(-1, Math.min(1, steer));
  // vitesse maximale autorisée devant
  const gripK = me.surf === 2 ? car.ice * 1.6 : me.surf === 1 ? car.dirt : me.surf === 4 ? 0.9 : 1;
  let allowed = car.vmax * (me.surf === 4 ? 0.62 : me.surf === 1 ? 0.93 : 1);
  const aLat = lv.lat * Math.min(1, Math.sqrt(car.grip / 7.6)) * Math.max(0.25, gripK);
  const dec = car.brake * 0.65;
  for (let j = 0; j < 40; j++) {
    const idx = r.idx + j * 1.5; if (idx >= tr.n - 2) break; const k = curvature(tr, Math.floor(idx)); const s2 = Car.sampleAt(tr, idx); const gk = s2.surf === 2 ? car.ice * 1.6 : s2.surf === 1 ? car.dirt : 1;
    const vlim = k > 1e-4 ? Math.min(car.vmax, Math.sqrt(aLat * Math.max(0.25, gk) / k)) : car.vmax; const d = j * 1.5 * tr.step;
    const va = Math.sqrt(vlim * vlim + 2 * dec * d) * lv.margin + (1 - lv.margin) * 0; if (va < allowed) allowed = va;
  }
  allowed *= lv.margin + (1 - lv.margin) * 0.3;
  let thr = 0, brk = 0;
  if (vf < allowed - 0.5) thr = 1; else if (vf > allowed + 3.5) brk = 1;
  if (Math.abs(da) > 1.0 && vf > 12) { thr = 0; brk = vf > 18 ? 1 : 0; }
  // coincé contre un mur ou à l'arrêt
  if (spd < 1.5 && r.tick > 90) { mem.stuck++; } else mem.stuck = 0;
  let rst = 0; if (mem.stuck > 150) { rst = 1; mem.stuck = 0; }
  return { steer, thr, brk, rst };
}

// simule un tour complet. renvoie les commandes sous forme d'octets, le temps et le nombre de retours
function simulateRun(tr, carId, levelId, seed, maxSeconds) {
  const lv = LEVELS[levelId] || LEVELS.moyen; const rnd = Track.mulberry32(Track.hashSeed("bot" + seed));
  const r = Car.newRun(tr, carId); const bytes = []; const mem = { noise: 0, stuck: 0 }; const maxT = Math.floor((maxSeconds || 240) * 60);
  while (!r.finished && r.tick < maxT) { const inp = Car.quant(drive(r, lv, rnd, mem)); bytes.push(Car.packInput(inp)); Car.step(r, inp); }
  return { bytes: Uint8Array.from(bytes), finished: r.finished, time: r.finishTime, resets: r.resets, hits: r.hits, ticks: r.tick, maxSpeed: r.maxSpeed };
}
module.exports = { LEVELS, drive, simulateRun };

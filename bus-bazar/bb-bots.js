// ============================================================
// BUS BAZAR — Robots pour les postes vides (conduite et équipage)
// ============================================================
const L = require("./public/game/layout.js");
const Sim = require("./bb-sim.js");
const Act = require("./bb-act.js");
const Road = require("./public/game/road.js");
const SK = { lent: { spd: 0.72, drive: 0.78, react: 1.4 }, normal: { spd: 1, drive: 0.9, react: 0.8 }, vif: { spd: 1.4, drive: 1.0, react: 0.35 } };
const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
const dist = (a, b) => Math.hypot(a.x - b.x, a.z - b.z);

// ---------- conducteur ----------
function drive(S, dt) {
  const B = S.bus, R = S.road, sk = SK[S.cfg.botSkill] || SK.normal;
  if (S.phase === "stop") {
    B.thr = 0; B.brk = 1; B.steer = 0; B.reverse = false; S.dwell += dt;
    const waiting = S.npcs.some((n) => n.st === "wait"); const moving = S.npcs.some((n) => (n.st === "board" && n.outside === false) || (n.st === "leave" && n.x < L.BUS.x1 + 0.3) || (n.st === "board"));
    const humansOut = Object.values(S.players).some((q) => !q.bot && q.out);
    const patience = waiting ? 70 : 28; const leavers = S.npcs.some((n) => n.st === "leave" && !n.relief);
    if (S.dwell > patience && !moving && !leavers && !humansOut) { if (!S.announce) { S.announce = S.t + 6; Sim.say(S, "Le bus repart dans quelques secondes.", "info", "📣"); } else if (S.t > S.announce) { S.announce = null; Sim.departNow(S); } }
    else S.announce = null;
    return;
  }
  const at = R.at(B.s); const W = Road.WEATHER[at.wx], SU = Road.SURF[at.surf]; const grip = W.grip * SU.grip;
  let maxc = 0; for (let d = 0; d <= 80; d += 8) maxc = Math.max(maxc, Math.abs(R.at(B.s + d).curv));
  let vt = Math.min(22 * sk.spd, maxc > 0.0004 ? Math.sqrt(0.5 * 8.2 * grip / maxc) * sk.drive : 99);
  if (B.tire) vt = Math.min(vt, 8); if (B.temp > 100) vt = Math.min(vt, 12);
  const surfv = at.surf === 3 ? 9 : at.surf === 2 ? 12 : 99; vt = Math.min(vt, surfv * sk.spd);
  // obstacles
  let et = 0, slowObs = false; const ahead = R.obstacles.filter((o) => !S.gone[o.id] && o.s - B.s > 0 && o.s - B.s < 55);
  for (const o of ahead) { const OB = Road.OBST[o.type]; const oe = S.moved && S.moved[o.id] != null ? S.moved[o.id] : o.e; if (o.type === "ralent") { vt = Math.min(vt, 7 + (o.s - B.s) * 0.1); continue; } if (Math.abs(B.e - oe) < OB.w / 2 + 2.4 || Math.abs(et - oe) < OB.w / 2 + 2.4) { et = oe > 0 ? oe - OB.w / 2 - 2.4 : oe + OB.w / 2 + 2.4; if (OB.mobile) { B.horn = Math.max(B.horn, 0.5); vt = Math.min(vt, 9); } if (o.s - B.s < 22) vt = Math.min(vt, 10); slowObs = true; } }
  et = clamp(et, -3.4, 3.4);
  // arrêt
  const ns = R.stops[S.nextStop]; if (ns) { const d = ns.s - 12 - B.s; const e0 = 3.0; et = clamp(et * 0 + e0, -4, 4) * (d < 60 ? 1 : 0) + (d < 60 ? 0 : et); if (d < 140) vt = Math.min(vt, Math.max(0, Math.sqrt(2 * 3.4 * Math.max(0, d)) * 0.9)); if (d < 25 && B.v < 3) vt = 0; if (B.s > ns.s - 30) vt = Math.min(vt, B.v > 1 ? 3 : 0); }
  const err = vt - B.v; if (err > 0) { B.thr = clamp(err * 0.7, 0, 1); B.brk = 0; } else { B.thr = 0; B.brk = clamp(-err * 0.6, 0, 1); } if (vt === 0 && B.v < 0.6) { B.brk = 1; B.thr = 0; }
  const kd = R.at(B.s + 6 + B.v * 0.4).curv - (B.e - et) * 0.0055 - B.psi * 0.28; const gain = 0.042 / (1 + B.v / 38);
  B.steer = clamp(kd / gain, -1, 1); B.reverse = false;
  if (B.stuck > 0) { B.thr = 0; }
}

// ---------- équipage ----------
function claim(S, key, p) { S.claims = S.claims || {}; const c = S.claims[key]; if (c && c.until > S.t && c.id !== p.id) return false; S.claims[key] = { id: p.id, until: S.t + 25 }; return true; }
function free(S, key, p) { S.claims = S.claims || {}; const c = S.claims[key]; return !(c && c.until > S.t && c.id !== p.id); }
function route(S, p, tx, tz) {
  const open = S.phase === "stop" && S.bus.door; const outT = tx > 1.6, outP = p.x > 1.6;
  if (outT !== outP) {
    if (!open) return null;
    if (!outP) { if (Math.abs(p.z - L.DOOR.z) <= 0.45) return { x: 3.0, z: L.DOOR.z }; if (Math.abs(p.x) > 0.4) return { x: 0.1, z: p.z }; return { x: 0.1, z: L.DOOR.z }; }
    return { x: 1.0, z: L.DOOR.z };
  }
  if (outT) return { x: tx, z: tz };
  if (Math.abs(p.z - tz) > 0.7 && Math.abs(p.x) > 0.35) return { x: 0.05, z: p.z };
  if (Math.abs(p.z - tz) > 0.5 && Math.abs(p.x) <= 0.4) return { x: 0.05, z: tz };
  return { x: tx, z: tz };
}
function walkTo(S, p, tx, tz, reach, dt, sk) {
  if (dist(p, { x: tx, z: tz }) < reach) return true;
  const wp = route(S, p, tx, tz); if (!wp) return false; const dx = wp.x - p.x, dz = wp.z - p.z, d = Math.hypot(dx, dz); if (d < 0.05) return false;
  const spd = 2.5 * sk.spd; const st = Math.min(d, spd * dt); p.x += dx / d * st; p.z += dz / d * st; p.yaw = Math.atan2(dx, dz); p.vx = dx / d * spd; p.vz = dz / d * spd;
  const c = L.collide(p.x, p.z, 0.28, S.phase === "stop" && S.bus.door); p.x = c.x; p.z = c.z; p.out = p.x > L.BUS.x1 + 0.3; return dist(p, { x: tx, z: tz }) < reach;
}
const heldItem = (S, p) => (p.held && p.held.t === "item" ? S.items.find((x) => x.id === p.held.id) : null);
function stationPos(id) { return L.stations.find((s) => s.id === id); }

function chooseTask(S, p) {
  const role = p.role; const stop = S.phase === "stop"; const lst = [];
  const fire = S.haz.find((h) => h.t === "fire" && free(S, "f" + h.id, p));
  if (fire && (role === "mechanic" || !S.hasHuman.mechanic)) lst.push({ pr: 95, t: "fire", id: fire.id });
  const B = S.bus;
  if (role === "mechanic") {
    if ((B.leak || (B.tire && (stop || B.v < 2)) || B.temp > 92) && free(S, "rep", p)) lst.push({ pr: 80, t: "repair" });
    const pd = S.haz.find((h) => h.t === "puddle" && free(S, "p" + h.id, p)); if (pd) lst.push({ pr: 40, t: "puddle", id: pd.id });
  }
  if (role === "steward") {
    if (stop) { const c = S.npcs.find((n) => n.st === "wait" && free(S, "c" + n.id, p) && (n.x < 5)); if (c) lst.push({ pr: 90, t: "cand", id: c.id }); }
    S.npcs.forEach((n) => {
      if (!n.need || n.st === "gone" || n.st === "wait" || n.st === "leave" || n.st === "board") return; if (!free(S, "n" + n.id, p)) return; const N = L.NEEDS[n.need.type]; const urg = 70 + (1 - n.need.t / n.need.t0) * 20;
      if (N.item === "snack" || N.item === "drink" || N.item === "bucket") lst.push({ pr: urg, t: "serve", id: n.id, item: N.item });
      else if (N.hold) lst.push({ pr: urg - 5, t: "hold", id: n.id }); else if (N.seat) lst.push({ pr: 60, t: "seat", id: n.id });
    });
    S.npcs.forEach((n) => { if (n.trouble && n.st !== "carried" && free(S, "n" + n.id, p) && !(S.hasHuman.porter === undefined)) lst.push({ pr: 65, t: "hold", id: n.id }); });
    const pd = S.haz.find((h) => h.t === "puddle" && free(S, "p" + h.id, p)); if (pd) lst.push({ pr: 45, t: "puddle", id: pd.id });
  }
  if (role === "porter") {
    if (stop) {
      const cr = S.items.find((i) => i.t === "crate" && i.state === "wait" && free(S, "i" + i.id, p) && L.CARGO[i.cargo].risk < 0.62); if (cr && S.items.filter((i) => i.t === "crate" && i.state === "slot").length < L.slots.length - 1) lst.push({ pr: 85, t: "crate", id: cr.id });
      const out = S.items.find((i) => i.t === "crate" && i.state === "slot" && i.dest <= S.stopIdx && free(S, "i" + i.id, p)); if (out) lst.push({ pr: 88, t: "deliver", id: out.id });
    }
    const loose = S.items.find((i) => i.t === "crate" && i.state === "free" && !i.holder && free(S, "i" + i.id, p)); if (loose) lst.push({ pr: 70, t: "stow", id: loose.id });
    const ch = S.items.find((i) => i.t === "chick" && !i.holder && free(S, "i" + i.id, p)); if (ch) lst.push({ pr: 60, t: "chick", id: ch.id });
    S.npcs.forEach((n) => { if (n.need && n.need.type === "valise" && free(S, "n" + n.id, p)) { const bag = S.items.find((i) => i.t === "bag" && i.owner === n.id && !i.holder); if (bag) lst.push({ pr: 72, t: "bag", id: n.id, bag: bag.id }); } });
    S.npcs.forEach((n) => { if (n.trouble && n.mood < 7 && free(S, "n" + n.id, p)) lst.push({ pr: 66, t: S.cfg.eject && stop ? "eject" : "hold", id: n.id }); });
    S.haz.forEach((h) => { if (h.t === "puddle" && free(S, "p" + h.id, p) && !S.hasHuman.steward) lst.push({ pr: 35, t: "puddle", id: h.id }); });
    const rr = S.bus.rear && S.phase === "stop"; if (rr && !S.hasHuman.mechanic) lst.push({ pr: 50, t: "rear" });
  }
  if (S.bus.rear && S.phase === "drive" && free(S, "rear", p)) lst.push({ pr: 75, t: "rear" });
  lst.sort((a, b) => b.pr - a.pr); return lst[0] || null;
}
function crew(S, p, dt) {
  const sk = SK[S.cfg.botSkill] || SK.normal; p.cd = (p.cd || 0) - dt; if (p.cd > 0) return;
  if (!p.task || S.t > p.task.until) { if (p.task) { dropAll(S, p); } p.task = chooseTask(S, p); if (p.task) { p.task.step = 0; p.task.until = S.t + 40; claim(S, key(p.task), p); p.cd = sk.react; } else { idle(S, p, dt, sk); return; } }
  const T = p.task; claim(S, key(T), p); const done = run(S, p, T, dt, sk); if (done) { p.task = null; p.cd = sk.react * 0.5; }
}
function key(T) { return T.t === "cand" ? "c" + T.id : T.t === "fire" ? "f" + T.id : T.t === "puddle" ? "p" + T.id : T.t === "repair" ? "rep" : T.t === "rear" ? "rear" : (T.t === "crate" || T.t === "deliver" || T.t === "stow" || T.t === "chick") ? "i" + T.id : "n" + T.id; }
function dropAll(S, p) { if (p.held) { Act.drop(S, p, false); } p.hold = null; }
function idle(S, p, dt, sk) { const home = p.role === "steward" ? { x: 0.1, z: 3.6 } : p.role === "mechanic" ? { x: 0, z: -5.8 } : { x: 0.1, z: -3.9 }; walkTo(S, p, home.x, home.z, 0.5, dt, sk); }
function getItem(S, p, kind, stId, dt, sk) { // va chercher un objet à une station
  if (heldItem(S, p) && heldItem(S, p).t === kind) return true; if (p.held) { Act.drop(S, p, false); return false; }
  const st = stationPos(stId); if (walkTo(S, p, st.x * 0.4, st.z, 0.35 + st.r * 0.55, dt, sk)) { Act.station(S, p, stId, kind); return !!heldItem(S, p); } return false;
}
function run(S, p, T, dt, sk) {
  const keepHold = (type, obj) => { if (!p.hold || p.hold.t !== type || p.hold.id !== obj) p.hold = { t: type, id: obj }; p.holdAt = S.t; };
  if (T.t === "cand") { const n = S.npcs.find((x) => x.id === T.id); if (!n || n.st !== "wait" || S.phase !== "stop") return true; if (walkTo(S, p, 2.6, n.z, 1.2, dt, sk)) { const K = L.KINDS[n.kind]; const cap = Act.onboardCount(S) >= Act.CAP; const ok = !cap && (K.risk <= 0.42 || S.rng() < 0.3); Act.accept(S, p, n.id, !ok); return true; } return false; }
  if (T.t === "fire") { const f = S.haz.find((h) => h.id === T.id); if (!f) { dropAll(S, p); return true; } if (!getItem(S, p, "ext", "ext", dt, sk)) return false; if (walkTo(S, p, f.x * 0.7, f.z + (f.z > -3 ? -0.9 : 0.9), 1.4, dt, sk)) { keepHold("fire", f.id); } return false; }
  if (T.t === "repair") { const B = S.bus; if (!(B.leak || B.tire || B.temp > 80)) { dropAll(S, p); return true; } if (B.tire && S.phase === "drive" && B.v > 2) return false; if (!getItem(S, p, "tools", "bench", dt, sk)) return false; if (walkTo(S, p, -0.5, -6.6, 1.1, dt, sk)) keepHold("hatch", "hatch"); return false; }
  if (T.t === "puddle") { const f = S.haz.find((h) => h.id === T.id); if (!f) { dropAll(S, p); return true; } if (walkTo(S, p, f.x, f.z, 0.9, dt, sk)) keepHold("puddle", f.id); return false; }
  if (T.t === "rear") { if (!S.bus.rear) return true; if (walkTo(S, p, 0, -7.0, 1.0, dt, sk)) { Act.rear(S, p); return true; } return false; }
  const n = T.id && S.npcs.find((x) => x.id === T.id);
  if (T.t === "serve") { if (!n || !n.need) { dropAll(S, p); return true; } if (!getItem(S, p, T.item, T.item === "bucket" ? "bucketstand" : "cart", dt, sk)) return false; if (walkTo(S, p, n.x * 0.5, n.z, 1.2, dt, sk)) { Act.press(S, p, { t: "npc", id: n.id }); return true; } return false; }
  if (T.t === "hold") { if (!n || n.st === "gone" || !(n.trouble || n.asleep || (n.need && L.NEEDS[n.need.type].hold))) { p.hold = null; return true; } if (p.held) { Act.drop(S, p, false); return false; } if (walkTo(S, p, n.x * 0.5, n.z, 1.3, dt, sk)) keepHold("npc", n.id); return false; }
  if (T.t === "seat") { if (!n || !n.need) return true; if (walkTo(S, p, n.x * 0.5, n.z, 1.4, dt, sk)) { Act.press(S, p, { t: "npc", id: n.id }); return true; } return false; }
  if (T.t === "crate" || T.t === "stow") {
    const c = S.items.find((x) => x.id === T.id);
    if (!p.held) { if (!c || c.holder) return true; if (walkTo(S, p, c.x, c.z, 1.1, dt, sk)) Act.pickup(S, p, c.id); return false; }
    const it = heldItem(S, p); if (!it) return true;
    const sl = L.slots.find((s) => !S.items.some((i) => i.state === "slot" && i.slot === s.id)); if (!sl) { Act.drop(S, p, false); return true; }
    if (walkTo(S, p, sl.x * 0.35, sl.z, 1.2, dt, sk)) { Act.slot(S, p, sl.id); return true; } return false;
  }
  if (T.t === "deliver") {
    const c = S.items.find((x) => x.id === T.id); if (!p.held) { if (!c || c.holder) return true; if (walkTo(S, p, c.x * 0.4, c.z, 1.5, dt, sk)) { Act.slot(S, p, c.slot); } return false; }
    if (S.phase !== "stop") { Act.drop(S, p, false); return true; } if (walkTo(S, p, 3.4, 1.6, 0.5, dt, sk)) { p.yaw = 1.2; Act.drop(S, p, false); return true; } return false;
  }
  if (T.t === "chick") { const c = S.items.find((x) => x.id === T.id); if (!p.held) { if (!c || c.holder) return true; if (walkTo(S, p, c.x, c.z, 0.9, dt, sk)) Act.pickup(S, p, c.id); return false; }
    const cr = S.items.find((x) => x.t === "crate" && x.cargo === "poulets" && !x.gone); const tgt = cr ? { x: cr.x * 0.5, z: cr.z } : { x: 0, z: -5 }; if (walkTo(S, p, tgt.x, tgt.z, 1.4, dt, sk)) { const it = heldItem(S, p); if (it) { it.gone = true; p.held = null; S.events.push({ k: "fixed" }); } return true; } return false; }
  if (T.t === "bag") { if (!n || !n.need) { dropAll(S, p); return true; } if (!p.held) { const bag = S.items.find((x) => x.id === T.bag); if (!bag || bag.holder) return true; if (walkTo(S, p, bag.x * 0.5, bag.z, 1.3, dt, sk)) Act.pickup(S, p, bag.id); return false; } if (walkTo(S, p, n.x * 0.5, n.z, 1.3, dt, sk)) { Act.press(S, p, { t: "npc", id: n.id }); return true; } return false; }
  if (T.t === "eject") { if (!n || !n.trouble) return true; if (S.phase !== "stop") return true; if (!p.held) { if (walkTo(S, p, n.x * 0.6, n.z, 1.2, dt, sk)) Act.grab(S, p, n.id); return false; } if (walkTo(S, p, 1.15, L.DOOR.z, 0.35, dt, sk)) { p.yaw = Math.PI / 2; p.x = Math.max(p.x, 1.1); Act.drop(S, p, false); return true; } return false; }
  return true;
}
function think(S, dt) {
  S.hasHuman = {}; Object.values(S.players).forEach((p) => { if (!p.bot) S.hasHuman[p.role] = true; });
  Object.values(S.players).forEach((p) => { if (!p.bot) return; if (p.role === "driver") return; crew(S, p, dt); });
}
module.exports = { drive, think };

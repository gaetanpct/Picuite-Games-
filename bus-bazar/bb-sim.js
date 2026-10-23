// ============================================================
// BUS BAZAR — Simulation du voyage côté serveur (bus, route, passagers, objets, pannes)
// Le serveur décide de tout. Les joueurs envoient leur position et leurs actions.
// ============================================================
const L = require("./public/game/layout.js");
const Road = require("./public/game/road.js");
const DT = 0.05;
const SF = (r) => r - Math.floor(r);

function create(cfg, players) {
  const seed = cfg.seed || Math.random().toString(36).slice(2, 8);
  const rng = Road.rngOf(seed + "|sim");
  const road = Road.make(seed, { legs: cfg.legs, difficulty: cfg.difficulty, biomes: cfg.biomes, traffic: cfg.traffic, weather: cfg.weather });
  const S = {
    cfg, seed, rng, road, t: 0, phase: "stop", stopIdx: 0, nextStop: 1, id: 1, msgs: [], events: [],
    bus: { s: road.stops[0].s, e: 3.0, psi: 0, v: 0, w: 0, thr: 0, brk: 0, steer: 0, sh: 0, temp: 45, hull: 100, tire: false, leak: false, door: true, rear: false, al: 0, ay: 0, slip: false, horn: 0, off: false, stuck: 0, gust: 0, reverse: false },
    players: {}, npcs: [], items: [], haz: [], money: 120, rep: 60, stats: { carried: 0, delivered: 0, ejected: 0, refused: 0, fires: 0, crashes: 0, tips: 0, cargoOk: 0, cargoLost: 0, income: 0 },
    stopT: 0, dwell: 0, over: null, gone: {}, lastLon: 0, dockedAt: road.stops[0].s, timers: { need: 0, prank: 0, brk: 0, wind: 0 }, tumbled: {}, boardCount: 0, announce: null,
  };
  players.forEach((p) => addPlayer(S, p));
  enterStop(S, 0, true);
  return S;
}
function addPlayer(S, p) {
  const spawn = p.role === "driver" ? { x: L.DRIVER.x, z: L.DRIVER.z } : { x: 0.1 * (Object.keys(S.players).length % 3), z: 4.2 - Object.keys(S.players).length * 0.5 };
  S.players[p.id] = { id: p.id, name: p.name, color: p.color, role: p.role, bot: !!p.bot, x: spawn.x, z: spawn.z, yaw: 0, vx: 0, vz: 0, held: null, hold: null, holdAt: 0, useAt: 0, out: false, tum: 0, last: S.t, skill: 1, task: null, cd: 0 };
  return S.players[p.id];
}
const nid = (S) => S.id++;
const pick = (S, a) => a[Math.floor(S.rng() * a.length)];
const say = (S, text, kind, icon) => { S.msgs.push({ t: Math.round(S.t), text, kind: kind || "info", icon: icon || "" }); if (S.msgs.length > 60) S.msgs.shift(); S.events.push({ k: "msg", text, kind: kind || "info", icon: icon || "" }); };
const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
const hasRole = (S, r) => Object.values(S.players).some((p) => p.role === r && !p.bot);

// ---------- passagers ----------
function makeNpc(S, kindId, destIdx) {
  const K = L.KINDS[kindId]; const id = nid(S);
  const fare = Math.round(K.fare * (0.85 + S.rng() * 0.35) * (1 + S.stopIdx * 0.04));
  const n = { id, name: pick(S, L.NAMES), kind: kindId, look: { skin: Math.floor(S.rng() * L.SKIN.length), cloth: Math.floor(S.rng() * L.CLOTH.length), hat: S.rng() < 0.4 ? 1 + Math.floor(S.rng() * (L.HATS.length - 1)) : 0, h: 0.9 + S.rng() * 0.2, fat: 0.85 + S.rng() * 0.4 },
    dest: destIdx, fare, seat: null, x: 0, z: 0, yaw: 0, vx: 0, vz: 0, st: "wait", path: [], mood: 62 + Math.floor(S.rng() * 20), need: null, needCd: 10 + S.rng() * 30, trouble: false, prank: 0, prog: 0, tumT: 0, bag: null, wasTrouble: false, rest: 0, asleep: false, outside: true, exitT: 0, sh: 0 };
  if (kindId === "enfant") n.look.h = 0.62;
  return n;
}
function freeSeat(S, near) {
  const used = new Set(S.npcs.filter((n) => n.seat != null && n.st !== "gone").map((n) => n.seat));
  const list = L.seats.filter((s) => !used.has(s.i));
  if (!list.length) return null;
  list.sort((a, b) => (a.z + (a.aisle ? 0 : 0.6) * 0) - b.z); // l'avant d'abord
  if (near) list.sort((a, b) => Math.hypot(a.x - near.x, a.z - near.z) - Math.hypot(b.x - near.x, b.z - near.z));
  return list[0];
}
function seatPath(seat) { return [{ x: 0.05, z: L.DOOR.z }, { x: 0, z: seat.z }, { x: seat.aisle ? seat.x : seat.x < 0 ? -0.55 : 0.55, z: seat.z }, { x: seat.x, z: seat.z, final: true }]; }
function standPath(S) { const z = 1.5 + S.rng() * 2.5; return [{ x: 0.05, z: L.DOOR.z }, { x: (S.rng() - 0.5) * 0.5, z, final: true }]; }
function dockNpc(S, n) {
  // fait entrer un candidat accepté
  n.st = "board"; n.outside = true; n.path = [{ x: 2.4, z: L.DOOR.z }, { x: 1.2, z: L.DOOR.z }];
  const seat = freeSeat(S, null); n.seat = seat ? seat.i : null; n.path = n.path.concat(seat ? seatPath(seat) : standPath(S));
}

// ---------- arrêts ----------
function enterStop(S, idx, first) {
  S.phase = "stop"; S.stopIdx = idx; S.nextStop = idx + 1; S.stopT = 0; S.dwell = 0; S.bus.v = 0; S.bus.e = 3.0; S.bus.psi = 0; S.bus.door = true; S.bus.thr = 0; S.bus.brk = 1; S.dockedAt = S.bus.s; S.announce = null;
  const last = idx >= S.road.legs;
  if (!first) say(S, last ? "Terminus atteint." : "Arrêt à " + S.road.stops[idx].name + ".", "good", "🛑");
  // descente des passagers
  S.npcs.forEach((n) => {
    if (n.st === "gone" || n.st === "wait") return;
    if (n.dest <= idx || last) { if (n.st === "carried") return; if (n.st === "board" || n.st === "walk" || n.st === "seat" || n.st === "stand" || n.st === "tumble" || n.st === "sleep") { n.st = "leave"; n.path = [{ x: 0, z: n.z }, { x: 0.05, z: L.DOOR.z }, { x: 1.6, z: L.DOOR.z }, { x: 4.5, z: L.DOOR.z + 0.5, final: true }]; n.seat = null; n.asleep = false; n.trouble = false; if (n.need && n.need.type === "pipi") n.need = null; } }
  });
  if (last) { checkEnd(S); return; }
  // pause pipi
  S.npcs.forEach((n) => { if (n.need && n.need.type === "pipi" && n.st !== "gone" && n.st !== "leave") { n.st = "leave"; n.relief = true; n.path = [{ x: 0, z: n.z }, { x: 0.05, z: L.DOOR.z }, { x: 1.6, z: L.DOOR.z }, { x: 5.5, z: L.DOOR.z + 2.2, final: true }]; n.seat0 = n.seat; n.seat = null; n.need = null; } });
  // candidats
  const cap = L.seats.length + 6; const onboard = S.npcs.filter((n) => n.st !== "gone" && n.st !== "wait" && n.st !== "leave").length;
  const crowd = S.cfg.crowd; const count = Math.max(1, Math.min(10, Math.round(1.2 + crowd * 1.7 + S.rng() * 2.4)));
  const trouble = S.cfg.troublemakers; const w = (k) => { const K = L.KINDS[k]; return Math.max(0.1, 1 + (K.risk - 0.3) * (trouble - 2) * 1.6); };
  for (let i = 0; i < count && onboard + i < cap + 4; i++) {
    const weights = L.KIND_IDS.map(w); const tot = weights.reduce((a, b) => a + b, 0); let r = S.rng() * tot, kind = L.KIND_IDS[0];
    for (let k = 0; k < L.KIND_IDS.length; k++) { r -= weights[k]; if (r <= 0) { kind = L.KIND_IDS[k]; break; } }
    if (S.stopIdx === 0 && i < 2 && (kind === "vip" || kind === "farceur")) kind = "normal";
    const dest = idx + 1 + Math.floor(S.rng() * (S.road.legs - idx)); const n = makeNpc(S, kind, Math.min(S.road.legs, dest));
    n.x = 4.0 + (S.rng() - 0.5) * 2.0; n.z = 2.3 + i * 0.75 + S.rng() * 0.2; n.yaw = -Math.PI / 2; n.st = "wait"; n.qi = i; S.npcs.push(n);
  }
  // colis
  const cargoRate = { aucun: 0, rare: 0.35, normal: 0.65, frequent: 0.95 }[S.cfg.cargo] || 0;
  const nc = Math.round(cargoRate * (0.5 + S.rng() * 2.4)); const kinds = Object.keys(L.CARGO);
  for (let i = 0; i < nc; i++) {
    const wts = kinds.map((k) => (S.cfg.cargo === "frequent" ? 1 : L.CARGO[k].risk < 0.4 ? 2 : 1)); const tot = wts.reduce((a, b) => a + b, 0); let r = S.rng() * tot, k0 = kinds[0]; for (let k = 0; k < kinds.length; k++) { r -= wts[k]; if (r <= 0) { k0 = kinds[k]; break; } }
    const dest = idx + 1 + Math.floor(S.rng() * (S.road.legs - idx));
    S.items.push({ id: nid(S), t: "crate", cargo: k0, x: 3.1 + (i % 2) * 1.0, y: 0, z: -0.2 + Math.floor(i / 2) * 1.0, vx: 0, vz: 0, vy: 0, holder: null, slot: null, hp: 100, dest: Math.min(S.road.legs, dest), pay: Math.round(L.CARGO[k0].pay * (0.9 + S.rng() * 0.3)), state: "wait", leak: 0 });
  }
  S.stopIdx === 0 || say(S, count + " candidats au voyage et " + nc + " colis attendent sur le quai.", "info", "🧳");
}
function departNow(S) {
  if (S.stopIdx >= S.road.legs) return;
  S.phase = "drive"; S.bus.door = false; S.bus.brk = 0;
  // les candidats non traités repartent, les colis restent
  S.npcs.forEach((n) => { if (n.st === "wait") { n.st = "gone"; S.stats.refused++; } if (n.st === "leave" && n.relief) { n.st = "gone"; n.relief = false; } });
  S.items = S.items.filter((it) => !(it.state === "wait") && !(it.state === "plat"));
  // les joueurs restés dehors remontent
  Object.values(S.players).forEach((p) => { if (p.x > L.BUS.x1 + 0.1) { p.x = 0.2; p.z = L.DOOR.z; p.out = false; if (p.held && p.held.t === "item") dropHeld(S, p, true); } });
  S.items.forEach((it) => { if (it.x > L.BUS.x1 - 0.15 && !it.holder && it.state !== "slot") { it.x = 0.4; it.z = L.DOOR.z; } });
  say(S, "Les portes se ferment. En route vers " + S.road.stops[S.nextStop].name + ".", "info", "🚌");
}

function checkEnd(S) {
  if (S.over) return;
  const left = S.npcs.filter((n) => n.st === "leave").length;
  if (left) return;
  const stars = scoreStars(S);
  S.over = { win: true, stars, money: Math.round(S.money), rep: Math.round(S.rep), hull: Math.round(S.bus.hull), stats: S.stats, t: Math.round(S.t) };
  S.phase = "end";
}
function scoreStars(S) {
  const base = clamp(S.rep / 100, 0, 1) * 2.4 + clamp(S.bus.hull / 100, 0, 1) * 1.0 + clamp(S.money / (180 + S.road.legs * 90), 0, 1.6) * 1.1 + clamp(S.stats.carried / 14, 0, 1) * 0.5;
  return Math.max(1, Math.min(5, Math.round(base * 1.05)));
}

// ---------- boucle principale ----------
function step(S, dt) {
  if (S.over) return;
  S.t += dt;
  driveBus(S, dt);
  walkPlayers(S, dt);
  stepNpcs(S, dt);
  stepItems(S, dt);
  stepHazards(S, dt);
  stepEvents(S, dt);
  holdWork(S, dt);
  if (S.phase === "stop" && S.stopIdx >= S.road.legs) checkEnd(S);
  if (S.phase === "stop") {
    S.stopT += dt;
    const late = S.stopT > 90 ? (S.stopT - 90) / 60 : 0; if (late > 0) { S.rep -= 0.02 * dt * (1 + late); S.npcs.forEach((n) => { if (n.st === "seat" || n.st === "stand") n.mood -= 0.15 * dt; }); }
    if (S.stopT > 90 && !S.lateWarn) { S.lateWarn = true; say(S, "Le bus est en retard, les passagers râlent.", "bad", "⏰"); }
  }
  if (S.rep <= 0 && !S.over) { S.over = { win: false, why: "Mutinerie, les passagers ont pris le volant.", stats: S.stats, stars: 0, money: Math.round(S.money), rep: 0, hull: Math.round(S.bus.hull), t: Math.round(S.t) }; S.phase = "end"; }
  if (S.bus.hull <= 0 && !S.over) { S.over = { win: false, why: "Le bus est en miettes.", stats: S.stats, stars: 0, money: Math.round(S.money), rep: Math.round(S.rep), hull: 0, t: Math.round(S.t) }; S.phase = "end"; }
  S.rep = clamp(S.rep, 0, 100);
}

function driveBus(S, dt) {
  const B = S.bus; const R = S.road; const at = R.at(B.s);
  if (S.phase !== "drive") { B.al = 0; B.ay = 0; B.v = 0; B.slip = false; B.sh *= 0.9; cool(S, dt, true); return; }
  const SU = Road.SURF[at.surf], W = Road.WEATHER[at.wx]; const grip = SU.grip * W.grip;
  const v0 = B.v; let vmax = B.tire ? 9 : 24; if (B.temp > 105) vmax *= 0.6; if (B.stuck > 0) { B.stuck -= dt; B.v = 0; B.al = 0; B.ay = 0; return; }
  const offAmt = Math.max(0, Math.abs(B.e) + 1.6 - R.half); B.off = offAmt > 0.05;
  let a = B.thr * 4.4 - B.brk * 9.5 - 0.02 * B.v - 0.0016 * B.v * B.v;
  if (B.off) a -= 2.5 + offAmt * 0.6; if (B.v > vmax) a -= (B.v - vmax) * 1.5; a -= at.hill * 0.35 * B.v / 24;
  if (B.reverse) { a = -(B.thr * 2.5) - Math.sign(B.v || 1) * 0; }
  B.v += a * dt; if (!B.reverse && B.v < 0) B.v = 0; if (B.reverse) B.v = clamp(B.v, -3, 0.1);
  const target = B.steer; const rate = Math.abs(target) > Math.abs(B.w) ? 3.2 : 4.5; B.w += clamp(target - B.w, -rate * dt, rate * dt);
  let kap = B.w * 0.042 / (1 + Math.abs(B.v) / 38); if (B.tire) kap += 0.0025 * Math.min(1, Math.abs(B.v) / 8);
  const latReq = B.v * B.v * Math.abs(kap), maxLat = 8.2 * grip; B.slip = false;
  if (latReq > maxLat && Math.abs(B.v) > 3) { kap = Math.sign(kap) * maxLat / (B.v * B.v); B.slip = true; }
  const yaw = B.v * kap;
  B.psi += (B.v * (kap - at.curv)) * dt; B.psi = clamp(B.psi, -1.2, 1.2);
  B.gust = (W.id === "vent" || W.id === "orage") ? Math.sin(S.t * 0.7) * Math.sin(S.t * 0.23 + 1) * (W.id === "orage" ? 3.2 : 2.4) * (0.5 + S.cfg.turbulence * 0.35) : 0;
  B.e += (Math.sin(B.psi) * B.v + B.gust * 0.35) * dt; B.s += Math.cos(B.psi) * B.v * dt;
  B.al = (B.v - v0) / dt; B.ay = B.v * yaw + B.gust * 0.2;
  // secousses
  let sh = SU.bump * (0.4 + S.cfg.turbulence * 0.4) * Math.min(1, Math.abs(B.v) / 14) + (B.off ? 0.5 + offAmt * 0.12 : 0) + (B.slip ? 0.4 : 0) + Math.abs(B.gust) * 0.08;
  B.sh = Math.max(B.sh * Math.pow(0.4, dt), sh);
  // obstacles
  if (S.phase === "drive") {
    for (let i = 0; i < R.obstacles.length; i++) {
      const o = R.obstacles[i]; if (S.gone[o.id]) continue; const ds = o.s - B.s; if (ds > 12 || ds < -3) continue; const OB = Road.OBST[o.type];
      if (o.mobile === undefined && OB.mobile) { /* les animaux restent sur place sauf klaxon */ }
      const oe = S.moved && S.moved[o.id] != null ? S.moved[o.id] : o.e; const near = o.type === "ralent" ? Math.abs(ds) < 0.8 : Math.abs(ds) < 1.2 && Math.abs(B.e - oe) < (OB.w / 2 + 1.55);
      if (near) hitObstacle(S, o, OB);
    }
    if (B.horn > 0) { B.horn -= dt; hornScare(S); }
  }
  // sortie de route
  if (Math.abs(B.e) > R.half + 3.2) { crash(S, 14, "Le bus finit dans le fossé, la dépanneuse arrive."); B.e = 0; B.psi = 0; B.v = 0; B.stuck = 5; B.sh = 1.5; }
  // moteur
  cool(S, dt, false);
  // arrêt
  const ns = R.stops[S.nextStop]; if (ns) {
    const inZone = B.s > ns.s - 70 && B.s < ns.s + 6;
    if (inZone && Math.abs(B.v) < 0.4 && B.thr < 0.1) { const hint = Math.abs(B.e - 3) > 0 ? 1 : 0; B.s = Math.max(B.s, ns.s - 70); enterStop(S, S.nextStop, false); return; }
    if (B.s > ns.s + 6 && S.nextStop >= R.legs) { B.brk = 1; B.v = Math.max(0, B.v - 14 * dt); if (B.v < 0.3) { say(S, "Terminus dépassé, freinage d'urgence.", "bad", "⚠️"); S.rep -= 4; enterStop(S, S.nextStop, false); } }
    else if (B.s > ns.s + 6 && !S.missed) { S.missed = S.nextStop; say(S, "Arrêt manqué, les passagers sont furieux.", "bad", "⚠️"); S.rep -= 3; S.npcs.forEach((n) => { if (n.dest === S.nextStop && n.st !== "gone") { n.mood -= 25; n.dest = Math.min(R.legs, n.dest + 1); } }); S.nextStop = Math.min(R.legs, S.nextStop + 1); S.missed = null; }
  }
}
function cool(S, dt, still) {
  const B = S.bus; const load = still ? 0 : Math.abs(B.v) / 24 * (0.4 + B.thr * 0.8);
  const level = S.cfg.breakdowns; const eq = 52 + 42 * load + (B.leak ? 45 : 0) + level * 1.5;
  B.temp += (eq - B.temp) * (B.leak ? 0.09 : 0.05) * dt * 2.2;
  if (B.temp > 125 && !S.haz.some((h) => h.t === "fire" && h.x === 0 && h.z < -7)) { spawnFire(S, 0, -7.2, "Le moteur prend feu."); B.temp = 110; }
}
function crash(S, dmg, text) { S.bus.hull -= dmg; S.stats.crashes++; S.bus.sh = Math.max(S.bus.sh, 1.4); S.rep -= dmg * 0.12; if (text) say(S, text, "bad", "💥"); tumbleAll(S, 0.9); }
function hitObstacle(S, o, OB) {
  const B = S.bus; S.gone[o.id] = true; const spd = Math.abs(B.v);
  if (OB.bump) { B.sh = Math.max(B.sh, OB.bump * (0.6 + S.cfg.turbulence * 0.25) * Math.min(1.4, spd / 10 + 0.3)); if (o.type === "trou") { if (spd > 12 && S.rng() < 0.3) { B.tire = true; say(S, "Crevaison.", "bad", "🛞"); } tumbleAll(S, 0.5 * Math.min(1.5, spd / 10)); } else if (spd > 14) tumbleAll(S, 0.5); }
  if (OB.dmg > 0) { const d = OB.dmg * Math.min(1.3, spd / 12) * (0.5 + S.cfg.traffic * 0.2); if (d > 1) crash(S, d, OB.label + " percuté."); B.v *= 0.55; }
  if (o.type === "trou" || o.type === "ralent") { /* secousse seule */ }
  S.events.push({ k: "hit", type: o.type });
}
function hornScare(S) {
  S.road.obstacles.forEach((o) => { if (S.gone[o.id] || !Road.OBST[o.type].mobile) return; const ds = o.s - S.bus.s; if (ds > 0 && ds < 60) { S.moved = S.moved || {}; S.moved[o.id] = (S.moved[o.id] != null ? S.moved[o.id] : o.e) + (o.e >= 0 ? 0.35 : -0.35); if (Math.abs(S.moved[o.id]) > 7) S.gone[o.id] = true; } });
}
function tumbleAll(S, f) {
  S.npcs.forEach((n) => { if (n.st === "stand" || n.st === "walk" || n.st === "leave" || n.st === "board") { if (S.rng() < 0.55 * f) tumble(S, n, 1.6 + S.rng()); } else if (n.st === "seat" && S.rng() < 0.25 * f) { n.mood -= 3 * L.KINDS[n.kind].scare * f; } });
  Object.values(S.players).forEach((p) => { if (!p.out && p.role !== "driver") p.tum = Math.max(p.tum, f); });
  S.items.forEach((it) => { if (!it.holder && it.state !== "slot" && it.state !== "plat" && it.state !== "wait") { it.vx += (S.rng() - 0.5) * 3 * f; it.vz += (S.rng() - 0.5) * 3 * f; it.vy = 2 * f; } if (it.t === "crate" && it.hp > 0) shock(S, it, f * 8); });
}
function tumble(S, n, t) { n.st0 = n.st; n.st = "tumble"; n.tumT = t; n.vx = (S.rng() - 0.5) * 3; n.vz = (S.rng() - 0.5) * 3; n.mood -= 5; if (n.carriedBy) n.carriedBy = null; }
function shock(S, it, amt) {
  if (it.t !== "crate") return; it.hp -= amt * (it.slot != null ? 0.3 : 1); if (it.hp < 0) it.hp = 0;
  const c = L.CARGO[it.cargo]; if (!c) return;
  if (it.cargo === "poulets" && S.rng() < 0.25 + amt * 0.01 && !it.opened && it.hp < 80) { it.opened = true; for (let i = 0; i < 3; i++) S.items.push({ id: nid(S), t: "chick", x: it.x + (S.rng() - 0.5) * 0.6, y: 0, z: it.z + (S.rng() - 0.5) * 0.6, vx: (S.rng() - 0.5) * 2, vz: (S.rng() - 0.5) * 2, vy: 0, holder: null, slot: null, hp: 100, state: "free", from: it.id }); say(S, "La caisse de poulets s'ouvre, les poulets sont lâchés.", "bad", "🐔"); }
  if (it.cargo === "fut" && it.hp < 70 && !it.leaked) { it.leaked = true; spawnPuddle(S, it.x, it.z, "Le fût de cidre fuit."); }
  if (it.cargo === "statue" && it.hp <= 0 && !it.broken) { it.broken = true; say(S, "La statue fragile est en morceaux.", "bad", "🗿"); S.stats.cargoLost++; }
  if (it.cargo === "feux" && it.hp < 40 && !it.lit) { it.lit = true; spawnFire(S, it.x, it.z, "Les feux d'artifice s'enflamment."); }
}
function spawnFire(S, x, z, text) { S.haz.push({ id: nid(S), t: "fire", x, z, sz: 0.5, prog: 0, born: S.t }); S.stats.fires++; if (text) say(S, text, "bad", "🔥"); S.events.push({ k: "fire" }); }
function spawnPuddle(S, x, z, text) { S.haz.push({ id: nid(S), t: "puddle", x, z, sz: 1, prog: 0, born: S.t }); if (text) say(S, text, "bad", "💦"); }

// ---------- joueurs ----------
function walkPlayers(S, dt) {
  Object.values(S.players).forEach((p) => {
    p.tum = Math.max(0, p.tum - dt);
    if (p.bot) return;
    if (p.role === "driver") { p.x = L.DRIVER.x; p.z = L.DRIVER.z; p.out = false; return; }
    // bornes de sécurité contre les positions absurdes
    const c = L.collide(p.x, p.z, 0.28, S.phase === "stop" && S.bus.door); p.x = c.x; p.z = c.z; p.out = p.x > L.BUS.x1 + 0.3;
    if (S.phase !== "stop" && p.out) { p.x = 0.2; p.z = L.DOOR.z; p.out = false; }
  });
}
function setPos(S, p, d) {
  if (p.role === "driver" && !p.bot) { p.x = L.DRIVER.x; p.z = L.DRIVER.z; p.yaw = Number(d.yaw) || 0; return; }
  const nx = Number(d.x), nz = Number(d.z); if (!isFinite(nx) || !isFinite(nz)) return;
  const dtm = Math.max(0.03, Math.min(0.5, S.t - p.last)); p.last = S.t; const maxD = 7 * dtm + 0.4; const dx = nx - p.x, dz = nz - p.z; const dd = Math.hypot(dx, dz);
  if (dd > maxD) { p.x += (dx / dd) * maxD; p.z += (dz / dd) * maxD; } else { p.x = nx; p.z = nz; }
  p.yaw = Number(d.yaw) || 0; p.vx = clamp(Number(d.vx) || 0, -6, 6); p.vz = clamp(Number(d.vz) || 0, -6, 6);
}
function dropHeld(S, p, silent) {
  const h = p.held; if (!h) return; p.held = null;
  if (h.t === "item") { const it = S.items.find((x) => x.id === h.id); if (it) { it.holder = null; it.x = p.x + Math.sin(p.yaw) * 0.6; it.z = p.z + Math.cos(p.yaw) * 0.6; it.y = 0; it.vx = it.vz = it.vy = 0; const c = L.collide(it.x, it.z, 0.25, S.phase === "stop" && S.bus.door); it.x = c.x; it.z = c.z; afterDrop(S, it, p); } }
  else if (h.t === "npc") { const n = S.npcs.find((x) => x.id === h.id); if (n) { n.carriedBy = null; n.x = p.x + Math.sin(p.yaw) * 0.6; n.z = p.z + Math.cos(p.yaw) * 0.6; const c = L.collide(n.x, n.z, 0.28, S.phase === "stop" && S.bus.door); n.x = c.x; n.z = c.z; n.st = "stand"; n.path = []; n.outside = false; if (n.x > L.BUS.x1) n.st = "stand"; } }
}
function afterDrop(S, it, p) {
  if (it.t === "crate" && S.phase === "stop" && it.x > L.BUS.x1 + 0.6 && it.state !== "wait") { // livraison
    if (it.dest <= S.stopIdx) deliver(S, it);
    else { it.state = "plat"; }
  } else if (it.t === "crate" && it.x > L.BUS.x1 + 0.6 && it.state === "wait") { it.state = "plat"; }
  if (it.x > L.BUS.x1 + 0.3 && S.phase === "drive") { it.gone = true; }
}
function deliver(S, it) {
  const c = L.CARGO[it.cargo]; let pay = it.pay * (it.cargo === "statue" && it.broken ? 0 : clamp(it.hp / 100, 0.25, 1));
  if (it.cargo === "poulets" && it.opened) pay *= 0.4; if (it.cargo === "fut" && it.leaked) pay *= 0.5;
  S.money += Math.round(pay); S.stats.income += Math.round(pay); S.stats.delivered++; if (pay > 0) S.stats.cargoOk++; S.rep += pay > it.pay * 0.7 ? 1.2 : -1;
  say(S, c.label + " livré, " + Math.round(pay) + " pièces.", pay > 0 ? "good" : "bad", "📦"); it.gone = true; S.events.push({ k: "cash" });
}

// ---------- NPC ----------
function stepNpcs(S, dt) {
  const B = S.bus; const ax = -B.ay, az = -B.al; const demand = S.cfg.demand;
  S.npcs.forEach((n) => {
    if (n.st === "gone") return; const K = L.KINDS[n.kind];
    if (n.st === "wait") { n.mood = Math.max(n.mood, 40); return; }
    if (n.st === "carried") { const p = S.players[n.carriedBy]; if (p) { n.x = p.x + Math.sin(p.yaw) * 0.45; n.z = p.z + Math.cos(p.yaw) * 0.45; n.yaw = p.yaw; } else n.st = "stand"; n.mood -= 0.8 * dt; return; }
    if (n.st === "tumble") { n.x += n.vx * dt; n.z += n.vz * dt; n.vx *= 0.93; n.vz *= 0.93; n.vx += ax * dt * 0.5; n.vz += az * dt * 0.5; const c = L.collide(n.x, n.z, 0.28, false); n.x = c.x; n.z = c.z; n.tumT -= dt; if (n.tumT <= 0) { n.st = n.seat != null && n.st0 !== "stand" ? "walk" : "stand"; if (n.seat != null) { const s = L.seats[n.seat]; n.path = [{ x: s.aisle ? s.x : (s.x < 0 ? -0.55 : 0.55), z: s.z }, { x: s.x, z: s.z, final: true }]; } } return; }
    if (n.st === "ejected") { n.t2 = (n.t2 || 0) + dt; n.x += n.vx * dt; n.z += n.vz * dt; if (n.t2 > 1.4) n.st = "gone"; return; }
    // déplacement le long du chemin
    if (n.path && n.path.length) {
      const tp = n.path[0]; const spd = n.kind === "enfant" ? 2.0 : n.st === "leave" ? 1.7 : n.kind === "fetard" ? 1.4 : 1.3; const dx = tp.x - n.x, dz = tp.z - n.z, d = Math.hypot(dx, dz);
      if (d < 0.12) { n.path.shift(); if (tp.final) { n.path = []; arrive(S, n, tp); } }
      else { const stepL = Math.min(d, spd * dt); n.x += dx / d * stepL; n.z += dz / d * stepL; n.yaw = Math.atan2(dx, dz); n.vx = dx / d * spd; n.vz = dz / d * spd; if (n.x < L.BUS.x1 - 0.05) { n.x = clamp(n.x, -1.45, 1.45); n.z = clamp(n.z, L.BUS.z0 + 0.3, L.BUS.z1 - 0.3); } n.walking = true; }
      if (n.st === "board" && n.x < L.BUS.x1 - 0.1) n.outside = false;
    } else { n.walking = false; n.vx = n.vz = 0; }
    if (n.st === "leave" && n.x > L.BUS.x1 + 0.4 && !n.paid && !n.relief) {
      n.paid = true; const pay = n.fare * (0.45 + clamp(n.mood, 0, 100) / 100 * 0.85); S.money += Math.round(pay); S.stats.income += Math.round(pay); S.stats.delivered++; S.rep += n.mood > 65 ? 1.6 : n.mood > 35 ? 0.4 : -1.6; if (n.mood > 85) { S.stats.tips++; S.money += 6; }
      say(S, n.name + " descend" + (n.mood > 65 ? " ravi" : n.mood > 35 ? "" : " furieux") + " et paie " + Math.round(pay) + ".", n.mood > 35 ? "good" : "bad", n.mood > 65 ? "😊" : n.mood > 35 ? "😐" : "😡"); S.events.push({ k: "cash" });
    }
    if (n.st === "leave" && n.relief && n.x > L.BUS.x1 + 3.2 && !n.relT) { n.relT = S.t + 7; }
    if (n.st === "leave" && n.relief && n.relT && S.t > n.relT) { n.relief = false; n.relT = 0; n.st = "board"; const seat = n.seat0 != null ? L.seats[n.seat0] : freeSeat(S, null); n.seat = seat ? seat.i : null; n.path = [{ x: 2.4, z: L.DOOR.z }, { x: 1.2, z: L.DOOR.z }].concat(seat ? seatPath(seat) : standPath(S)); n.mood += 12; n.outside = true; }
    if (n.st === "leave" && !n.relief && n.x > L.BUS.x1 + 2.7 && (!n.path || !n.path.length)) n.st = "gone";
    if (!(n.st === "seat" || n.st === "stand" || n.st === "walk" || n.st === "sleep")) return;
    // humeur
    const rough = Math.max(0, B.sh - 0.5); let drift = -0.06 * K.decay - rough * 0.5 * K.scare * (n.st === "seat" ? 0.4 : 1);
    if (S.phase === "drive" && B.slip) drift -= 0.15; if (n.st === "sleep") drift = Math.min(drift, -0.01) * 0.3; if (n.mood > 80) drift -= 0.05;
    if (n.need) { const f = 1 - clamp(n.need.t / n.need.t0, 0, 1); drift -= (0.15 + f * 0.9) * K.decay; n.need.t -= dt * (n.need.type === "pipi" && S.phase === "stop" ? 0 : 1); if (n.need.t <= 0) failNeed(S, n); }
    else { n.needCd -= dt * (0.5 + demand * 0.5) * (S.phase === "drive" ? 1 : 0.6); if (n.needCd <= 0 && n.st !== "sleep" && !n.trouble) newNeed(S, n); }
    n.mood = clamp(n.mood + drift * dt, 0, 100);
    if (rough > 0.6 && n.st === "seat" && !n.need && S.rng() < 0.12 * dt * K.scare * 10 && demand > 0) { n.need = { type: "peur", t: 40, t0: 40 }; }
    if ((n.st === "stand" || n.st === "walk") && B.sh > 0.95 && S.rng() < dt * 0.9 * (B.sh - 0.8)) tumble(S, n, 1.8 + S.rng());
    // dormeur
    if (n.kind === "dormeur" && n.st === "seat" && !n.need && !n.trouble) { n.asleep = true; n.st = "sleep"; }
    if (n.st === "sleep" && (B.sh > 0.8 || S.rng() < 0.0004)) { n.st = "seat"; n.asleep = false; n.mood -= 14; }
    // colère
    if (n.mood < 14 && !n.trouble && (n.st === "seat" || n.st === "stand") && S.cfg.troublemakers > 0) { n.trouble = true; n.wasTrouble = true; n.prank = 3 + S.rng() * 4; n.st = "walk"; n.seat0 = n.seat; n.seat = null; say(S, n.name + " perd patience et quitte son siège.", "bad", "😡"); }
    if (n.trouble) troubleMaker(S, n, dt);
    else if ((K.risk >= 0.5 || n.kind === "farceur" || n.kind === "fetard") && S.cfg.troublemakers > 0 && n.st !== "sleep" && S.phase === "drive") { n.prank -= dt * (0.1 + S.cfg.troublemakers * 0.07); if (n.prank <= -1) { n.prank = 1; if (S.rng() < 0.012 * S.cfg.troublemakers) startPrank(S, n); } }
  });
  // départ des fauteurs remis au calme
  S.npcs.forEach((n) => { if (n.trouble && n.mood > 45 && n.st !== "carried") { n.trouble = false; n.st = "walk"; const seat = (n.seat0 != null && !S.npcs.some((m) => m !== n && m.seat === n.seat0 && m.st !== "gone")) ? L.seats[n.seat0] : freeSeat(S, n); n.seat = seat ? seat.i : null; n.path = seat ? [{ x: seat.aisle ? seat.x : (seat.x < 0 ? -0.55 : 0.55), z: seat.z }, { x: seat.x, z: seat.z, final: true }] : []; } });
}
function arrive(S, n, tp) {
  if (n.st === "board") { n.st = n.seat != null ? "seat" : "stand"; n.outside = false; S.boardCount++; S.stats.carried++; n.boardedAt = S.t; if (n.seat != null) { const s = L.seats[n.seat]; n.x = s.x; n.z = s.z; n.yaw = 0; } else n.yaw = (S.rng() - 0.5) * 3; if (n.kind === "gourmand") n.needCd = Math.min(n.needCd, 12);
    if (!n.bag && S.rng() < 0.35 && S.cfg.demand > 0) { const tag = Math.floor(S.rng() * 6); n.bag = nid(S); S.items.push({ id: n.bag, t: "bag", tag, owner: n.id, x: -1.05 + (S.rng() < 0.5 ? 0 : 2.1), y: 0, z: -6.0, vx: 0, vz: 0, vy: 0, holder: null, slot: null, hp: 100, state: "free" }); } }
  else if (n.st === "walk" || n.st === "stand") { if (n.seat != null) { n.st = "seat"; const s = L.seats[n.seat]; n.x = s.x; n.z = s.z; n.yaw = 0; } else n.st = "stand"; }
  else if (n.st === "leave") { /* rien */ }
}
const NEED_TABLE = (S, n) => {
  const K = L.KINDS[n.kind]; const w = { faim: 1.2 * K.hunger, soif: 1.2 * K.hunger, nausee: 0.5 * (n.kind === "malade" ? 5 : 1), peur: 0.6 * K.scare, ennui: 1.0, pipi: 0.6, cigarette: n.kind === "fetard" || n.kind === "farceur" ? 1.2 : 0.15, valise: n.bag ? 1.4 : 0, place: n.seat == null ? 4 : 0 };
  if (S.phase !== "drive") { w.nausee = 0; w.peur = 0; }
  return w;
};
function newNeed(S, n) {
  const w = NEED_TABLE(S, n); const keys = Object.keys(w); const tot = keys.reduce((a, k) => a + w[k], 0); if (tot <= 0) { n.needCd = 8; return; } let r = S.rng() * tot, type = keys[0];
  for (let i = 0; i < keys.length; i++) { r -= w[keys[i]]; if (r <= 0) { type = keys[i]; break; } }
  const base = L.NEEDS[type].time; const t = base * (S.cfg.demand >= 3 ? 0.85 : 1);
  n.need = { type, t, t0: t }; n.needCd = (28 + S.rng() * 45) / (0.4 + S.cfg.demand * 0.35) / Math.max(0.5, L.KINDS[n.kind].hunger * 0.6 + 0.4);
  S.events.push({ k: "need", id: n.id });
}
function failNeed(S, n) {
  const t = n.need.type; n.need = null; n.mood -= 18; S.rep -= 0.5;
  if (t === "nausee") { spawnPuddle(S, n.x, n.z, n.name + " n'a pas pu se retenir."); n.mood -= 6; }
  else if (t === "pipi") { spawnPuddle(S, n.x, n.z, n.name + " n'a pas pu attendre."); n.mood -= 20; }
  else if (t === "cigarette") { spawnFire(S, n.x, n.z, n.name + " met le feu au siège avec sa cigarette."); }
  else if (t === "peur") { n.mood -= 6; if (n.kind === "nerveux" || S.rng() < 0.5) { n.st = "walk"; n.trouble = true; n.wasTrouble = true; n.prank = 2; n.seat0 = n.seat; n.seat = null; say(S, n.name + " panique et court dans l'allée.", "bad", "😱"); } }
  else if (t === "place") { n.mood -= 5; }
  n.needCd = 20 + S.rng() * 20;
}
function startPrank(S, n) {
  const roll = S.rng(); n.prank = 2;
  if (roll < 0.28 && S.cfg.troublemakers >= 2 && !S.bus.rear) { S.bus.rear = true; say(S, n.name + " ouvre la porte de secours en roulant.", "bad", "🚪"); S.events.push({ k: "rear" }); }
  else if (roll < 0.55) { const it = S.items.find((x) => !x.holder && x.state !== "slot" && x.state !== "wait" && x.state !== "plat" && Math.hypot(x.x - n.x, x.z - n.z) < 3); if (it) { it.vx = (S.rng() - 0.5) * 6; it.vz = (S.rng() - 0.5) * 6; it.vy = 3; say(S, n.name + " jette un objet à travers le bus.", "bad", "🤾"); } else { n.trouble = true; n.wasTrouble = true; n.st = "walk"; n.seat0 = n.seat; n.seat = null; n.prank = 4; } }
  else if (roll < 0.8) { const m = S.npcs.find((x) => x !== n && (x.st === "seat" || x.st === "stand") && Math.hypot(x.x - n.x, x.z - n.z) < 2.2); if (m) { m.mood -= 16; say(S, n.name + " embête " + m.name + ".", "bad", "😈"); } }
  else { n.trouble = true; n.wasTrouble = true; if (n.seat != null) { n.seat0 = n.seat; n.seat = null; } n.st = "walk"; n.prank = 5; say(S, n.name + " se met à danser dans l'allée.", "bad", "🕺"); }
}
function troubleMaker(S, n, dt) {
  n.prank -= dt; n.mood -= 0.05 * dt;
  if (!n.path.length) { const tz = -3 + S.rng() * 7; n.path = [{ x: (S.rng() - 0.5) * 0.7, z: clamp(tz, -3.5, 5.0), final: true }]; }
  if (n.prank <= 0) { n.prank = 2.5 + S.rng() * 3; const near = S.npcs.filter((m) => m !== n && (m.st === "seat" || m.st === "stand") && Math.hypot(m.x - n.x, m.z - n.z) < 1.6); if (near.length) { const m = near[0]; m.mood -= 7; S.rep -= 0.15; } else { const it = S.items.find((x) => !x.holder && x.state === "free" && Math.hypot(x.x - n.x, x.z - n.z) < 1.5); if (it) { it.vx = (S.rng() - 0.5) * 5; it.vz = (S.rng() - 0.5) * 5; it.vy = 2.5; } } }
}

// ---------- objets ----------
function stepItems(S, dt) {
  const B = S.bus; const ax = -B.ay, az = -B.al; const open = S.phase === "stop" && B.door; const wet = S.haz.some((h) => h.t === "puddle");
  S.items.forEach((it) => {
    if (it.gone) return;
    if (it.holder) { const p = S.players[it.holder]; if (p) { it.x = p.x + Math.sin(p.yaw) * 0.5; it.z = p.z + Math.cos(p.yaw) * 0.5; it.y = 1.0; it.vx = it.vz = 0; } else it.holder = null; return; }
    if (it.state === "slot") { const sl = L.slots[it.slot]; if (sl) { it.x = sl.x; it.y = sl.y; it.z = sl.z; } return; }
    if (it.state === "wait" || it.state === "plat") return;
    const I = L.ITEMS[it.t]; const sz = I ? I.size : 0.3;
    if (it.t === "chick") { // les poulets courent
      it.t2 = (it.t2 || 0) - dt; if (it.t2 <= 0) { it.t2 = 0.6 + S.rng(); const a = S.rng() * 6.28; it.vx = Math.sin(a) * 1.6; it.vz = Math.cos(a) * 1.6; }
    }
    const fr = (it.t === "chick" ? 0 : (wet ? 1.8 : 3.4)) * (it.cargo === "piano" ? 0.5 : 1);
    if (it.y > 0.001 || it.vy > 0) { it.vy -= 9.8 * dt; it.y += it.vy * dt; if (it.y <= 0) { it.y = 0; if (Math.abs(it.vy) > 3) shock(S, it, Math.abs(it.vy) * 1.8); it.vy = Math.abs(it.vy) > 1.5 ? -it.vy * 0.3 : 0; } }
    const grounded = it.y < 0.05;
    if (grounded) { const sp = Math.hypot(it.vx, it.vz); if (sp > 0) { const dec = Math.min(sp, fr * dt); it.vx -= it.vx / sp * dec; it.vz -= it.vz / sp * dec; } it.vx += ax * dt * (it.t === "chick" ? 0 : 1); it.vz += az * dt * (it.t === "chick" ? 0 : 1); if (B.sh > 0.9 && S.rng() < dt * 1.5 && it.t !== "chick") { it.vy = 1.4; it.vx += (S.rng() - 0.5) * 2; it.vz += (S.rng() - 0.5) * 2; } }
    it.x += it.vx * dt; it.z += it.vz * dt;
    const c = L.collide(it.x, it.z, sz * 0.7, open); if (Math.abs(c.x - it.x) > 0.001 || Math.abs(c.z - it.z) > 0.001) { const hit = Math.hypot(it.vx, it.vz); if (hit > 2.5) shock(S, it, hit * 1.3); if (Math.abs(c.x - it.x) > 0.001) it.vx *= -0.3; if (Math.abs(c.z - it.z) > 0.001) it.vz *= -0.3; it.x = c.x; it.z = c.z; }
    if (S.bus.rear && it.z < L.BUS.z0 + 0.5 && Math.abs(it.x) < 0.7 && S.phase === "drive") { it.gone = true; say(S, "Un objet s'envole par la porte arrière.", "bad", "💨"); if (it.t === "crate") S.stats.cargoLost++; }
    if (S.phase === "drive" && it.x > L.BUS.x1 + 0.2) it.gone = true;
    if (open && it.x > L.BUS.x1 + 0.7 && it.t === "crate" && it.state === "free" && it.dest != null && it.dest <= S.stopIdx && it.y < 0.1 && Math.hypot(it.vx, it.vz) < 0.5) deliver(S, it);
    // lancer sur un passager
    if (Math.hypot(it.vx, it.vz) > 3.5 && it.y < 1.2) S.npcs.forEach((n) => { if ((n.st === "seat" || n.st === "stand" || n.st === "walk") && Math.hypot(n.x - it.x, n.z - it.z) < 0.45) { tumble(S, n, 1.4); n.mood -= 9; it.vx *= 0.2; it.vz *= 0.2; } });
    // les poulets sortent
    if (it.t === "chick" && open && it.x > L.BUS.x1 + 0.5) it.gone = true;
  });
  S.items = S.items.filter((it) => !it.gone);
}
function stepHazards(S, dt) {
  S.haz.forEach((h) => {
    if (h.t === "fire") { h.sz = Math.min(2.2, h.sz + 0.03 * dt); S.bus.hull -= 0.12 * h.sz * dt; S.npcs.forEach((n) => { if (n.st !== "gone" && n.st !== "wait" && Math.hypot(n.x - h.x, n.z - h.z) < 2.6) n.mood -= 1.6 * dt; }); if (h.sz > 1.8) { S.bus.hull -= 0.5 * dt; S.rep -= 0.05 * dt; } if (S.t - h.born > 14 && S.rng() < 0.02 * dt * 10 && h.sz > 1) { /* propagation */ } }
    if (h.t === "puddle") { h.sz = Math.min(1.8, h.sz + 0.01 * dt); S.npcs.forEach((n) => { if ((n.st === "walk" || n.st === "stand" || n.st === "leave" || n.st === "board") && Math.hypot(n.x - h.x, n.z - h.z) < 0.7 && S.rng() < dt * 1.2) tumble(S, n, 1.3); }); }
  });
  S.haz = S.haz.filter((h) => !h.done);
}
function stepEvents(S, dt) {
  const T = S.timers; const lvl = S.cfg.breakdowns;
  if (S.phase === "drive") {
    T.brk -= dt; if (T.brk <= 0) { T.brk = 28 + S.rng() * 40; if (lvl > 0 && S.rng() < 0.12 * lvl) { if (!S.bus.leak && !S.bus.tire && S.rng() < 0.5) { S.bus.leak = true; say(S, "Le radiateur fuit, le moteur chauffe.", "bad", "♨️"); } else if (!S.bus.tire && !S.bus.leak) { S.bus.tire = true; say(S, "Un pneu éclate, le bus tire vers la droite.", "bad", "🛞"); } } }
    // météo, orage
    const at = S.road.at(S.bus.s); if (at.wx === 3 && S.rng() < dt * 0.15) { S.events.push({ k: "thunder" }); S.npcs.forEach((n) => { if (n.st === "seat" && !n.need && S.rng() < 0.15 * L.KINDS[n.kind].scare) n.need = { type: "peur", t: 40, t0: 40 }; }); }
    if (S.bus.rear) { S.npcs.forEach((n) => { if (n.st === "seat" || n.st === "stand") n.mood -= 0.4 * dt; }); S.bus.sh = Math.max(S.bus.sh, 0.45); }
  }
}

// ---------- travaux de maintien (progression des actions longues) ----------
function holdWork(S, dt) {
  Object.values(S.players).forEach((p) => {
    const h = p.hold; if (!h) return; if (S.t - p.holdAt > 0.5) { p.hold = null; return; }
    const hs = holdStep(S, p, h, dt); if (hs === "done" || hs === "abort") p.hold = null;
  });
}
const roleBonus = { npc: "steward", fire: "mechanic", puddle: "steward", hatch: "mechanic" };
function holdStep(S, p, h, dt) {
  const skill = (roleBonus[h.t] === p.role ? 1.7 : 1) * (p.skill || 1);
  if (h.t === "npc") {
    const n = S.npcs.find((x) => x.id === h.id); if (!n || n.st === "gone") return "abort"; if (Math.hypot(n.x - p.x, n.z - p.z) > 2.1) return "abort";
    const need = n.need; const calming = n.trouble; if (!(need && L.NEEDS[need.type].hold) && !calming && !(n.asleep)) return "abort";
    n.prog = (n.prog || 0) + dt * skill; const goal = calming ? 3.2 : 2.4; h.prog = n.prog / goal;
    if (n.prog >= goal) { n.prog = 0; if (calming) { if (n.kind === "fetard" && S.rng() < 0.25) { n.mood += 10; say(S, n.name + " refuse de se calmer.", "bad", "🍺"); } else { n.mood = Math.max(n.mood, 55); n.trouble = false; say(S, n.name + " se calme.", "good", "🕊️"); } }
      else { if (need.type === "cigarette") { say(S, n.name + " éteint sa cigarette.", "good", "🚭"); } n.mood = Math.min(100, n.mood + 20); n.need = null; S.rep += 0.25; S.events.push({ k: "fixed" }); } return "done"; }
    return "ok";
  }
  if (h.t === "fire") {
    const f = S.haz.find((x) => x.id === h.id); if (!f) return "abort"; if (!p.held || p.held.t !== "item") return "abort"; const it = S.items.find((x) => x.id === p.held.id); if (!it || it.t !== "ext") return "abort"; if (Math.hypot(f.x - p.x, f.z - p.z) > 2.6) return "abort";
    f.prog += dt * skill; h.prog = f.prog / 2.6; f.sz = Math.max(0.2, f.sz - 0.35 * dt * skill); if (f.prog > 2.6) { f.done = true; say(S, "Le feu est éteint.", "good", "🧯"); S.events.push({ k: "fixed" }); S.rep += 0.5; return "done"; } return "ok";
  }
  if (h.t === "puddle") {
    const f = S.haz.find((x) => x.id === h.id); if (!f) return "abort"; if (Math.hypot(f.x - p.x, f.z - p.z) > 1.8) return "abort"; const mop = p.held && p.held.t === "item" && (S.items.find((x) => x.id === p.held.id) || {}).t === "mop"; f.prog += dt * skill * (mop ? 2.2 : 1); h.prog = f.prog / 4; if (f.prog > 4) { f.done = true; S.events.push({ k: "fixed" }); say(S, "Le sol est propre.", "good", "🧽"); return "done"; } return "ok";
  }
  if (h.t === "hatch") {
    if (Math.hypot(p.x - L.stations[5].x, p.z - L.stations[5].z) > 2.2) return "abort"; if (!p.held || p.held.t !== "item") return "abort"; const it = S.items.find((x) => x.id === p.held.id); if (!it || it.t !== "tools") return "abort";
    const B = S.bus; if (!B.leak && !B.tire && B.temp < 75) return "abort"; if (S.phase === "drive" && B.tire && Math.abs(B.v) > 3) return "abort";
    h.prog = (h.prog || 0) + dt * skill / (B.tire ? 7 : 4.5); S.hatchProg = h.prog;
    if (!B.leak && !B.tire) { B.temp = Math.max(40, B.temp - 9 * dt * skill); return h.prog > 9 ? "done" : "ok"; }
    if (h.prog >= 1) { if (B.leak) { B.leak = false; say(S, "Le radiateur est réparé.", "good", "🔧"); } else if (B.tire) { B.tire = false; say(S, "La roue est changée.", "good", "🛞"); } S.events.push({ k: "fixed" }); S.rep += 0.4; return "done"; }
    return "ok";
  }
  return "abort";
}
module.exports = { create, step, DT, setPos, addPlayer, enterStop, departNow, dropHeld, afterDrop, deliver, tumble, spawnFire, spawnPuddle, say, freeSeat, dockNpc, scoreStars, nid, shock, checkEnd, seatPath };

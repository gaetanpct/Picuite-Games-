// ============================================================
// BUS BAZAR — Partie côté serveur (salon, postes, robots, réseau)
// ============================================================
const L = require("./public/game/layout.js");
const Road = require("./public/game/road.js");
const Sim = require("./bb-sim.js");
const Act = require("./bb-act.js");
const Bots = require("./bb-bots.js");

const TS = Math.max(0.001, Number(process.env.BB_TIME_SCALE) || 1);
const SEND_EVERY = 1 / 14;
const roleIds = L.ROLE_IDS;
const r2 = (v) => Math.round(v * 100) / 100;

function bbOf(room) { if (!room.bb) room.bb = { assign: {} }; return room.bb; }
function cleanAssign(room) {
  const bb = bbOf(room); const humans = room.players.filter((p) => !p.isBot && !p.left); const ids = new Set(humans.map((p) => p.id)); const used = new Set();
  Object.keys(bb.assign).forEach((id) => { if (!ids.has(id) || used.has(bb.assign[id]) || !roleIds.includes(bb.assign[id])) delete bb.assign[id]; else used.add(bb.assign[id]); });
  return bb.assign;
}
function crewPublic(room) { const a = cleanAssign(room); const out = {}; roleIds.forEach((r) => { out[r] = null; }); Object.keys(a).forEach((id) => { out[a[id]] = id; }); return out; }
function emitCrew(room, api) { const crew = crewPublic(room); room.players.forEach((p) => { if (!p.isBot && p.socketId) api.io.to(p.socketId).emit("bb:crew", { crew }); }); }

function start(room, api) {
  const humans = room.players.filter((p) => !p.isBot && !p.left); const assign = cleanAssign(room);
  const taken = new Set(Object.values(assign)); const free = roleIds.filter((r) => !taken.has(r));
  humans.forEach((p) => { if (!assign[p.id]) { const r = free.shift(); if (r) assign[p.id] = r; } });
  const ents = [];
  humans.forEach((p) => { if (assign[p.id]) ents.push({ id: p.id, name: p.name, color: p.color, role: assign[p.id], bot: false }); });
  const have = new Set(ents.map((e) => e.role));
  roleIds.forEach((r) => { if (have.has(r)) return; if (r === "driver" || room.settings.fillAbsent) ents.push({ id: "bot-" + r, name: "Robot " + L.ROLES.find((x) => x.id === r).label.split(" ")[0], color: roleIds.indexOf(r), role: r, bot: true }); });
  const S = Sim.create(room.settings, ents);
  const g = room.g = { api, S, acc: 0, last: Date.now(), sendT: 0, reg: {}, over: false, timer: null, away: {} };
  api.sysChat(room, "Le voyage commence, graine " + S.seed + ". Les postes sans joueur sont tenus par des robots.");
  g.timer = setInterval(() => { try { loop(room); } catch (e) { console.error("bb loop", e); } }, 50);
  initAll(room); sendAll(room);
}
function onDestroy(room) { if (room.g && room.g.timer) { clearInterval(room.g.timer); room.g.timer = null; } }
function canReturn(room) { return true; }
function roleOf(room, p) { return cleanAssign(room)[p.id] || (room.g && room.g.S.players[p.id] ? room.g.S.players[p.id].role : null); }

function loop(room) {
  const g = room.g; if (!g) return; const S = g.S; const now = Date.now(); const dt = Math.min(0.5, (now - g.last) / 1000) * TS; g.last = now; g.acc += dt;
  // joueurs absents, remplacés par un robot au bout de quelques secondes
  room.players.forEach((p) => { const e = S.players[p.id]; if (!e || p.isBot) return; const away = p.left || !p.connected; if (away) { g.away[p.id] = (g.away[p.id] || 0) + dt; if (g.away[p.id] > 12 && !e.bot) { e.bot = true; e.awayBot = true; } } else { g.away[p.id] = 0; if (e.awayBot) { e.bot = false; e.awayBot = false; e.task = null; } } });
  let steps = 0;
  while (g.acc >= Sim.DT && steps < 400 && !S.over) {
    g.acc -= Sim.DT; steps++;
    const drv = Object.values(S.players).find((p) => p.role === "driver");
    if (!drv || drv.bot) Bots.drive(S, Sim.DT); else if (S.phase === "stop") { S.bus.thr = 0; S.bus.brk = 1; S.bus.steer = 0; }
    Bots.think(S, Sim.DT); Sim.step(S, Sim.DT);
  }
  if (S.over && !g.over) { g.over = true; sendAll(room); flushEvents(room); return; }
  flushEvents(room);
  g.sendT += dt; if (g.sendT >= SEND_EVERY) { g.sendT = 0; sendAll(room); }
}
function flushEvents(room) {
  const g = room.g; const S = g.S; if (!S.events.length) return; const evs = S.events.splice(0, S.events.length);
  const all = evs.filter((e) => !e.to); const mine = {}; evs.forEach((e) => { if (e.to) (mine[e.to] = mine[e.to] || []).push(e); });
  room.players.forEach((p) => { if (p.isBot || !p.socketId) return; const l = all.concat(mine[p.id] || []); if (l.length) g.api.io.to(p.socketId).emit("bb:ev", l); });
}
function initPayload(room, p) {
  const S = room.g.S; return { seed: S.seed, legs: S.road.legs, difficulty: S.cfg.difficulty, biomes: S.cfg.biomes, traffic: S.cfg.traffic, weather: S.cfg.weather, assist: S.cfg.assist, eject: S.cfg.eject, you: p.id, role: roleOf(room, p), players: Object.values(S.players).map((e) => ({ id: e.id, name: e.name, color: e.color, role: e.role, bot: e.bot })), t0: S.t };
}
function initAll(room) { room.players.forEach((p) => { if (!p.isBot && p.socketId) { room.g.reg[p.id] = {}; room.g.api.io.to(p.socketId).emit("bb:init", initPayload(room, p)); } }); }

function buildView(S) {
  const B = S.bus; const R = S.road; const ns = R.stops[S.nextStop];
  const v = {
    t: r2(S.t), ph: S.phase,
    b: { s: r2(B.s), e: r2(B.e), psi: +B.psi.toFixed(3), v: r2(B.v), w: +B.w.toFixed(3), sh: r2(B.sh), tp: Math.round(B.temp), hl: Math.round(B.hull), tr: B.tire ? 1 : 0, lk: B.leak ? 1 : 0, dr: B.door ? 1 : 0, rr: B.rear ? 1 : 0, al: r2(B.al), ay: r2(B.ay), sl: B.slip ? 1 : 0, of: B.off ? 1 : 0, sk: B.stuck > 0 ? 1 : 0, hn: B.horn > 0 ? 1 : 0, th: r2(B.thr), bk: r2(B.brk), gu: r2(B.gust) },
    st: { i: S.stopIdx, nx: S.nextStop, nm: ns ? ns.name : "", d: ns ? Math.round(ns.s - B.s) : 0, T: Math.round(S.stopT), cur: R.stops[S.stopIdx].name, ann: S.announce ? Math.max(0, Math.round(S.announce - S.t)) : -1 },
    p: Object.values(S.players).map((e) => ({ i: e.id, x: r2(e.x), z: r2(e.z), y: +e.yaw.toFixed(2), vx: r2(e.vx), vz: r2(e.vz), h: e.held ? e.held.t + e.held.id : "", ro: e.role, tm: e.tum > 0 ? 1 : 0, bt: e.bot ? 1 : 0, hp: e.hold ? Math.round((e.hold.prog || 0) * 100) : 0 })),
    n: S.npcs.filter((n) => n.st !== "gone").map((n) => ({ i: n.id, x: r2(n.x), z: r2(n.z), y: +n.yaw.toFixed(2), s: n.st, m: Math.round(n.mood), nd: n.need ? n.need.type : "", nf: n.need ? +(n.need.t / n.need.t0).toFixed(2) : 0, tr: n.trouble ? 1 : 0, sl: n.seat == null ? -1 : n.seat, wk: n.walking ? 1 : 0, pg: +(n.prog || 0).toFixed(2), as: n.asleep ? 1 : 0, o: n.outside ? 1 : 0 })),
    it: S.items.filter((i) => !i.gone).map((i) => ({ i: i.id, t: i.t, x: r2(i.x), y: r2(i.y || 0), z: r2(i.z), h: i.holder || "", c: i.cargo || "", hp: Math.round(i.hp || 0), sl: i.slot == null ? -1 : i.slot, s: i.state || "", d: i.dest == null ? -1 : i.dest, tg: i.tag == null ? -1 : i.tag, ow: i.owner || 0, op: i.opened ? 1 : 0, dy: i.dirty ? 1 : 0 })),
    hz: S.haz.map((h) => ({ i: h.id, t: h.t, x: r2(h.x), z: r2(h.z), sz: r2(h.sz) })),
    go: Object.keys(S.gone).map(Number), mv: S.moved || {},
    sc: { m: Math.round(S.money), r: Math.round(S.rep), c: S.stats.carried, dl: S.stats.delivered },
    ov: S.over,
  };
  return v;
}
function sendAll(room) {
  const g = room.g; if (!g) return; const S = g.S; const v = buildView(S);
  const npcInfo = {}; S.npcs.forEach((n) => { npcInfo[n.id] = { id: n.id, nm: n.name, k: n.kind, lk: n.look, d: n.dest, f: n.fare }; });
  room.players.forEach((p) => {
    if (p.isBot || !p.socketId || p.left) return; const sock = g.api.io.sockets.sockets.get(p.socketId); if (!sock) return;
    const reg = g.reg[p.id] = g.reg[p.id] || {}; const fresh = []; v.n.forEach((n) => { if (!reg[n.i]) { reg[n.i] = 1; fresh.push(npcInfo[n.i]); } });
    const e = S.players[p.id];
    if (fresh.length) sock.emit("bb:reg", fresh);
    sock.volatile.emit("bb:state", Object.assign({}, v, { ps: e ? { x: e.x, z: e.z } : null }));
  });
}

function bind(socket, helpers, api) {
  const { ctx, me, safe, toast } = helpers;
  const cur = () => { const room = ctx.room; const p = me(); return room && p ? { room, p } : null; };
  socket.on("bb:crewGet", safe(() => { const c = cur(); if (!c) return; socket.emit("bb:crew", { crew: crewPublic(c.room) }); }));
  socket.on("bb:role", safe((d) => {
    const c = cur(); if (!c || c.room.status !== "lobby") return; const role = d && d.role; const a = cleanAssign(c.room);
    if (role == null) { delete a[c.p.id]; return emitCrew(c.room, api); }
    if (!roleIds.includes(role)) return; const holder = Object.keys(a).find((k) => a[k] === role && k !== c.p.id);
    if (holder) return toast("Ce poste est déjà pris par un autre joueur.");
    a[c.p.id] = role; emitCrew(c.room, api);
  }));
  if (process.env.BB_DEBUG === "1") socket.on("bb:dbg", safe((d) => { const c = cur(); if (!c || !c.room.g) return; const S = c.room.g.S; if (d.k === "fire") Sim.spawnFire(S, d.x || 0, d.z || -3, "Un feu se déclare."); else if (d.k === "puddle") Sim.spawnPuddle(S, d.x || 0, d.z || 0, "Une flaque se forme."); else if (d.k === "leak") S.bus.leak = true; else if (d.k === "tire") S.bus.tire = true; else if (d.k === "win") { S.over = { win: true, stars: 4, money: Math.round(S.money), rep: Math.round(S.rep), hull: Math.round(S.bus.hull), stats: S.stats, t: Math.round(S.t) }; S.phase = "end"; } else if (d.k === "need") { const n = S.npcs.find((x) => ["seat", "stand"].includes(x.st)); if (n) n.need = { type: d.type || "peur", t: 60, t0: 60 }; } }));
  socket.on("bb:regReq", safe(() => { const c = cur(); if (c && c.room.g) c.room.g.reg[c.p.id] = {}; }));
  socket.on("bb:ready", safe(() => { const c = cur(); if (!c || !c.room.g) return; const e = c.room.g.S.players[c.p.id]; socket.emit("bb:init", initPayload(c.room, c.p)); c.room.g.reg[c.p.id] = {}; if (e && e.awayBot) { e.bot = false; e.awayBot = false; } }));
  socket.on("bb:pos", safe((d) => { const c = cur(); if (!c || !c.room.g || !d) return; const S = c.room.g.S; const e = S.players[c.p.id]; if (!e || e.bot) return; Sim.setPos(S, e, d); }));
  socket.on("bb:drive", safe((d) => {
    const c = cur(); if (!c || !c.room.g || !d) return; const S = c.room.g.S; const e = S.players[c.p.id]; if (!e || e.bot || e.role !== "driver") return;
    const n = (v, lo, hi) => Math.max(lo, Math.min(hi, Number(v) || 0)); const B = S.bus;
    B.steer = n(d.steer, -1, 1); B.thr = n(d.thr, 0, 1); B.brk = S.phase === "stop" ? 1 : n(d.brk, 0, 1); B.reverse = !!d.rev && B.v < 0.6;
  }));
  socket.on("bb:act", safe((m) => { const c = cur(); if (!c || !c.room.g || !m) return; const S = c.room.g.S; const e = S.players[c.p.id]; if (!e || e.bot || S.over) return; Act.apply(S, e, m); }));
}
function onReconnect(room, p, api) { if (!room.g) return; const e = room.g.S.players[p.id]; if (e && e.awayBot) { e.bot = false; e.awayBot = false; e.task = null; } room.g.reg[p.id] = {}; const sock = api.io.sockets.sockets.get(p.socketId); if (sock) sock.emit("bb:init", initPayload(room, p)); }
function onDisconnect() {}
function onLeave(room, p) { const g = room.g; if (!g) return; const e = g.S.players[p.id]; if (e) { e.bot = true; e.awayBot = true; if (e.held) Sim.dropHeld(g.S, e); } }
module.exports = { start, bind, onReconnect, onDisconnect, onLeave, onDestroy, canReturn, buildView };

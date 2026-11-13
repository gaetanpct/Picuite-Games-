// ============================================================
// VERTIGOGO — Lien entre les salons (Socket.io) et la course.
// Chaque humain simule son propre personnage, le serveur vérifie la plausibilité, tient le classement,
// les points de passage et les chronos. Les bots tournent sur le serveur avec le même contrôleur.
// ============================================================
const S = require("./public/game/vgsim.js");
const Cr = require("./public/game/vgcourse.js");
const Pilot = require("./public/game/vgpilot.js");
const Rules = require("./public/game/vgrules.js");

const TICK = 1000 / 60, HATS = 10, TRAILS = 6, CHARS = 5, COUNT = 4, PEN = 5, GRACE = 90;
const cleanCos = (c) => { c = c || {}; const n = (v, m) => { v = Math.floor(Number(v)); return v >= 0 && v < m ? v : 0; }; return { char: n(c.char, CHARS), hat: n(c.hat, HATS), trail: n(c.trail, TRAILS) }; };
const r2 = (v) => Math.round(v * 100) / 100;

// ---------- parcours vérifiés, mis en cache ----------
const cache = new Map();
function dayLabel() { try { return new Intl.DateTimeFormat("fr-CA", { timeZone: "Europe/Paris", year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date()); } catch (e) { return new Date().toISOString().slice(0, 10); } }
function getCourse(opts) {
  const key = JSON.stringify([opts.seed, opts.zones, opts.diff, opts.pool]); const hit = cache.get(key); if (hit) return hit;
  let best = null;
  for (let salt = 0; salt < 12; salt++) {
    const C = Cr.generate(Object.assign({}, opts, { salt })); const r = Pilot.validate(C);
    if (r.ok) { best = { C, salt, ok: true, bad: 0 }; break; }
    if (!best || r.bad.length < best.bad) best = { C, salt, ok: false, bad: r.bad.length };
  }
  if (!best.ok) console.error("vertigogo, aucun parcours entièrement vérifié pour", key, "meilleur", best.bad, "liens douteux");
  cache.set(key, best); if (cache.size > 30) cache.delete(cache.keys().next().value); return best;
}
const daily = new Map(); // date -> [{name, t}]
function addDaily(day, name, t) { let a = daily.get(day); if (!a) { a = []; daily.set(day, a); if (daily.size > 5) daily.delete(daily.keys().next().value); } a.push({ name, t: r2(t) }); a.sort((x, y) => x.t - y.t); if (a.length > 10) a.length = 10; }

function sendTo(room, p, ev, data) { if (!p.isBot && p.socketId && room.g) room.g.api.io.to(p.socketId).emit(ev, data); }
function toAll(room, ev, data) { room.g.api.emitAll(room, ev, data); }
function cosMap(room) { const m = {}; room.players.forEach((p) => { m[p.id] = p.cos || { char: 0, hat: 0, trail: 0 }; }); return m; }
const humans = (room) => room.players.filter((p) => !p.isBot && !p.left);

function start(room, api) {
  room.players.forEach((p, i) => { if (!p.cos) p.cos = p.isBot ? { char: (i * 2 + 1) % CHARS, hat: (i * 3) % HATS, trail: i % TRAILS } : { char: 0, hat: 0, trail: 0 }; });
  const s = room.settings; const day = dayLabel();
  const opts = Rules.courseOpts(s, day); let seedLabel = opts.seed; if (!opts.seed) { opts.seed = Math.random().toString(36).slice(2, 8); seedLabel = opts.seed; }
  room.g = { api, ready: false, phase: "load", C: null, order: room.players.map((p) => p.id), pl: {}, t: 0, tStart: 0, timer: null, tickN: 0, last: Date.now(), acc: 0, mode: s.mode, day, seedLabel, opts, finishedN: 0, closeAt: 0, over: false, tl: s.timeLimit * 60, board: null };
  toAll(room, "v:phase", { p: "load" });
  setImmediate(() => { try { prepare(room); } catch (e) { console.error("vertigogo prepare", e); } });
}
function prepare(room) {
  const g = room.g; if (!g || g.timer) return; const r = getCourse(g.opts); const C = r.C; g.C = C; g.salt = r.salt; g.cpOrder = {}; C.cps.forEach((bi, i) => { g.cpOrder[bi] = i + 1; });
  const sb = C.boxes[C.startBox]; const cx = (sb.x0 + sb.x1) / 2, cz = (sb.z0 + sb.z1) / 2;
  const n = room.players.length; room.players.forEach((p, i) => {
    const col = i % 4, row = Math.floor(i / 4); const x = cx + (col - 1.5) * 1.9, z = cz + (row - 0.5) * 2.2 + 0.0;
    const pl = { id: p.id, idx: i, name: p.name, bot: !!p.isBot, x, y: 0, z, ry: C.start.ry, a: 0, s: 0, on: C.startBox, best: 0, bestT: 0, cp: 0, cpN: 0, fin: null, falls: 0, pen: 0, lastT: Date.now(), good: { x, y: 0, z }, viol: 0, away: !p.isBot && !p.connected, vy: 0 };
    if (p.isBot) { const W = S.makeWorld(C); const P = S.newPlayer(x, 0, z, 0); P.on = C.startBox; pl.sim = { W, P, pilot: Pilot.create(W, C, p.level || "moyen", Math.random), delay: 0.6 + Math.random() * 1.6 }; }
    g.pl[p.id] = pl;
  });
  g.ready = true; g.phase = "count"; g.tCount = Date.now() + COUNT * 1000; g.tStart = g.tCount;
  toAll(room, "v:course", courseMsg(room)); toAll(room, "v:phase", { p: "count", n: COUNT }); toAll(room, "v:rank", rankMsg(room));
  g.timer = setInterval(() => { try { loop(room); } catch (e) { console.error("vertigogo loop", e); } }, 8); if (g.timer.unref) g.timer.unref();
}
function courseMsg(room) {
  const g = room.g; const C = g.C; return { opts: Object.assign({}, g.opts, { salt: g.salt }), mode: g.mode, seed: g.seedLabel, day: g.day, tl: g.tl, summit: C.summitTop, players: room.players.map((p) => ({ id: p.id, name: p.name, color: p.color, bot: !!p.isBot })), cos: cosMap(room), left: Math.max(0, (g.tCount - Date.now()) / 1000) };
}
function onDestroy(room) { if (room.g && room.g.timer) { clearInterval(room.g.timer); room.g.timer = null; } }

// ---------- progression, chute, arrivée ----------
function floorBox(g, pl) { const C = g.C; if (Rules.checkpoints(g.mode) && pl.cp) return C.boxes[pl.cp]; return C.boxes[Cr.netFor(C, pl.best)]; }
function respawn(room, pl, why, free) {
  const g = room.g, C = g.C; const b = floorBox(g, pl); const x = (b.x0 + b.x1) / 2, z = (b.z0 + b.z1) / 2, y = b.y1 + 0.02;
  pl.x = x; pl.y = y; pl.z = z; pl.good = { x, y, z }; pl.viol = 0; pl.on = b.i; pl.vy = 0; pl.lastT = Date.now();
  if (!free) { pl.falls++; if (g.mode === "chrono" || g.mode === "jour") pl.pen += g.mode === "chrono" ? PEN : 0; }
  if (pl.sim) { const P = pl.sim.P; P.x = x; P.y = y; P.z = z; P.vx = P.vy = P.vz = 0; P.st = "ground"; P.on = b.i; P.hang = null; P.climb = null; pl.sim.W.cr = {}; pl.sim.pilot.run = false; pl.sim.pilot.wait = 0; }
  else { const p = room.players.find((q) => q.id === pl.id); if (p) sendTo(room, p, "v:fix", { x, y, z, why, pen: pl.pen, falls: pl.falls }); }
}
function standing(g, pl, bi) {
  const C = g.C; const b = C.boxes[bi]; if (!b) return; const top = b.y1;
  if (top > pl.best) { pl.best = top; pl.bestT = elapsed(g); }
  const o = g.cpOrder[bi]; if (o && Rules.checkpoints(g.mode)) { const cur = pl.cp ? g.cpOrder[pl.cp] : 0; if (o > cur) { pl.cp = bi; pl.cpN++; if (!pl.bot) { const p = g.api && null; } return { cp: true }; } }
  return null;
}
const elapsed = (g) => Math.max(0, (Date.now() - g.tStart) / 1000);
function verifyOn(g, pl) { // le joueur annonce qu'il se tient sur la boîte "on", on vérifie qu'il y est vraiment
  const b = g.C.boxes[pl.on]; if (!b) return false; const am = b.mv ? b.mv.amp : 0; const ax = b.mv ? b.mv.ax : ""; const tol = 0.55;
  const x0 = b.x0 - tol - (ax === "x" ? am : 0), x1 = b.x1 + tol + (ax === "x" ? am : 0), z0 = b.z0 - tol - (ax === "z" ? am : 0), z1 = b.z1 + tol + (ax === "z" ? am : 0);
  const y0 = b.y1 - tol - (ax === "y" ? am : 0), y1 = b.y1 + tol + (ax === "y" ? am : 0); return pl.x >= x0 && pl.x <= x1 && pl.z >= z0 && pl.z <= z1 && pl.y >= y0 && pl.y <= y1;
}
function progress(room, pl) {
  const g = room.g, C = g.C;
  if (pl.s === 0 && pl.on >= 0 && verifyOn(g, pl)) {
    const b = C.boxes[pl.on]; if (b.k !== "crumble" && b.k !== "spring") { pl.good = { x: pl.x, y: pl.y, z: pl.z }; }
    const r = standing(g, pl, pl.on); if (r && r.cp) { const p = room.players.find((q) => q.id === pl.id); if (p) sendTo(room, p, "v:cp", { i: pl.cpN, t: r2(elapsed(g)) }); }
    if (pl.on === C.summit && !pl.fin) finish(room, pl);
  }
  const fb = floorBox(g, pl); if (pl.y < fb.y1 - 7 && !pl.fin) respawn(room, pl, "fall");
}
function finish(room, pl) {
  const g = room.g; const t = elapsed(g) + pl.pen; pl.fin = { t: r2(t), place: ++g.finishedN }; if (!g.closeAt) g.closeAt = elapsed(g) + GRACE;
  if (g.mode === "jour" && !pl.bot) addDaily(g.day, pl.name, t);
  toAll(room, "v:fin", { id: pl.id, t: pl.fin.t, place: pl.fin.place }); toAll(room, "v:rank", rankMsg(room));
}

// ---------- classement ----------
function rows(room) {
  const g = room.g; const list = room.players.map((p) => g.pl[p.id]).filter(Boolean);
  list.sort((a, b) => { if (a.fin && b.fin) return a.fin.t - b.fin.t; if (a.fin) return -1; if (b.fin) return 1; return (b.best - a.best) || (a.bestT - b.bestT); });
  return list.map((pl, i) => ({ id: pl.id, place: i + 1, h: r2(pl.best), y: r2(pl.y), fin: pl.fin ? pl.fin.t : null, falls: pl.falls, pen: pl.pen, cp: pl.cpN, away: !!pl.away }));
}
function rankMsg(room) { const g = room.g; const e = g.phase === "play" ? elapsed(g) : 0; return { rows: rows(room), t: r2(e), left: g.phase === "play" ? Math.max(0, Math.round((g.closeAt && g.closeAt < g.tl ? g.closeAt : g.tl) - e)) : null, closing: !!(g.closeAt && g.closeAt < g.tl), summit: g.C ? g.C.summitTop : 0 }; }

// ---------- boucle ----------
function loop(room) {
  const g = room.g; if (!g || !g.timer || !g.ready) return; const now = Date.now();
  if (g.phase === "count" && now >= g.tCount) { g.phase = "play"; g.tStart = now; Object.values(g.pl).forEach((pl) => { pl.lastT = now; }); toAll(room, "v:phase", { p: "play" }); }
  g.acc += Math.min(100, now - g.last); g.last = now; let n = 0;
  while (g.acc >= TICK && n < 6) { g.acc -= TICK; n++; g.tickN++; if (g.phase === "play") stepBots(room); if (g.tickN % 4 === 0) sendSnap(room); if (g.tickN % 15 === 0 && g.phase !== "over") toAll(room, "v:rank", rankMsg(room)); }
  if (g.phase === "play") {
    const e = elapsed(g); const hs = humans(room); const allDone = hs.length > 0 && hs.every((p) => g.pl[p.id] && g.pl[p.id].fin);
    if (allDone || e >= g.tl || (g.closeAt && e >= g.closeAt)) endGame(room);
    else if (!hs.length) onDestroy(room);
  }
}
function stepBots(room) {
  const g = room.g, C = g.C; const e = elapsed(g);
  for (const p of room.players) {
    if (!p.isBot) continue; const pl = g.pl[p.id]; if (!pl || pl.fin) continue; const { W, P, pilot } = pl.sim; W.t = e; S.prepare(W);
    let inp = { mx: 0, mz: 0, jump: false, drop: false }; if (e > pl.sim.delay) inp = Pilot.step(pilot, P);
    S.stepPlayer(W, P, inp, []);
    pl.x = P.x; pl.y = P.y; pl.z = P.z; pl.vy = P.vy; pl.ry = Math.atan2(P.fx, P.fz); pl.on = P.st === "ground" ? P.on : -1; pl.s = P.st === "ground" ? 0 : P.st === "hang" ? 2 : P.st === "climb" ? 3 : 1;
    const sp = Math.hypot(P.vx, P.vz); pl.a = P.st === "hang" ? 4 : P.st === "climb" ? 5 : P.st === "air" ? (P.vy > 0 ? 2 : 3) : sp > 1.2 ? 1 : 0; pl.vh = sp;
    progress(room, pl);
  }
}
function sendSnap(room) {
  const g = room.g; if (!g.C) return; const p = room.players.map((q) => { const pl = g.pl[q.id]; return pl ? [r2(pl.x), r2(pl.y), r2(pl.z), r2(pl.ry), pl.a | 0, r2(pl.vh || 0), pl.fin ? 1 : 0] : null; });
  toAll(room, "v:snap", { t: r2(elapsed(g)), now: Date.now(), p });
}
function endGame(room) {
  const g = room.g; if (g.over) return; g.over = true; g.phase = "over"; const e = elapsed(g);
  const res = rows(room); const board = g.mode === "jour" ? (daily.get(g.day) || []) : null;
  toAll(room, "v:over", { rows: res, t: r2(e), mode: g.mode, seed: g.seedLabel, summit: g.C.summitTop, board, day: g.day });
}

// ---------- sockets ----------
function bind(socket, h, api) {
  const { ctx, me, safe } = h;
  const inGame = () => ctx.room && ctx.room.g && ctx.room.status === "game" && ctx.room.g.ready;
  let nIn = 0, tIn = 0;
  socket.on("v:st", safe((d) => {
    if (!inGame() || !d) return; const g = ctx.room.g; if (g.phase !== "play") return; const now = Date.now(); if (now - tIn > 1000) { tIn = now; nIn = 0; } if (++nIn > 40) return;
    const p = me(); if (!p) return; const pl = g.pl[p.id]; if (!pl || pl.fin && false) return;
    const x = +d.x, y = +d.y, z = +d.z; if (!isFinite(x) || !isFinite(y) || !isFinite(z) || Math.abs(x) > 90 || Math.abs(z) > 90 || y < -50 || y > 600) return;
    const dt = Math.max(0.02, Math.min(0.7, (now - pl.lastT) / 1000)); pl.lastT = now; pl.away = false;
    const dh = Math.hypot(x - pl.x, z - pl.z), dv = y - pl.y;
    if (dh > 19 * dt + 1.4 || dv > 28 * dt + 1.6 || dv < -48 * dt - 2.2) { pl.viol++; if (pl.viol >= 2) { pl.x = pl.good.x; pl.y = pl.good.y; pl.z = pl.good.z; pl.viol = 0; sendTo(ctx.room, p, "v:fix", { x: pl.x, y: pl.y, z: pl.z, why: "sync", pen: pl.pen, falls: pl.falls }); } return; }
    pl.viol = 0; pl.x = x; pl.y = y; pl.z = z; pl.ry = +d.ry || 0; pl.a = d.a | 0; pl.s = d.s | 0; pl.on = d.on | 0; pl.vh = Math.min(30, +d.vh || 0); pl.vy = +d.vy || 0;
    progress(ctx.room, pl);
  }));
  socket.on("v:reset", safe(() => {
    if (!inGame()) return; const g = ctx.room.g; if (g.phase !== "play" || !Rules.checkpoints(g.mode)) return; const p = me(); if (!p) return; const pl = g.pl[p.id]; if (!pl || pl.fin) return;
    const now = Date.now(); if (pl.rstAt && now - pl.rstAt < 1500) return; pl.rstAt = now; respawn(ctx.room, pl, "reset", g.mode !== "chrono");
  }));
  socket.on("v:cos", safe((d) => { const room = ctx.room, p = me(); if (!room || !p) return; p.cos = cleanCos(d); api.emitAll(room, "v:cosmap", cosMap(room)); }));
  socket.on("v:hello", safe(() => { const room = ctx.room; if (!room) return; const p = me(); socket.emit("v:cosmap", cosMap(room)); if (room.g && p) syncTo(room, p); }));
}
function syncTo(room, p) {
  const g = room.g; if (!g || !g.ready) return; const pl = g.pl[p.id]; sendTo(room, p, "v:course", courseMsg(room)); sendTo(room, p, "v:phase", { p: g.phase, n: Math.max(0, Math.ceil((g.tCount - Date.now()) / 1000)) });
  sendTo(room, p, "v:rank", rankMsg(room));
  if (pl && g.phase === "play") { pl.lastT = Date.now(); sendTo(room, p, "v:fix", { x: pl.good.x, y: pl.good.y, z: pl.good.z, why: "back", pen: pl.pen, falls: pl.falls, quiet: true }); }
  if (g.over) sendTo(room, p, "v:over", { rows: rows(room), t: r2(elapsed(g)), mode: g.mode, seed: g.seedLabel, summit: g.C.summitTop, board: g.mode === "jour" ? (daily.get(g.day) || []) : null, day: g.day });
}
function onReconnect(room, p) { const g = room.g; if (!g) return; if (g.pl[p.id]) g.pl[p.id].away = false; syncTo(room, p); }
function onDisconnect(room, p) { const g = room.g; if (!g) return; if (g.pl && g.pl[p.id]) g.pl[p.id].away = true; }
function onLeave(room, p) { const g = room.g; if (!g) return; if (g.pl && g.pl[p.id]) g.pl[p.id].away = true; if (!room.players.some((x) => !x.isBot && !x.left)) onDestroy(room); }
// préchauffe le parcours du jour, pour que la première partie ne fasse pas attendre
function warm() { setTimeout(() => { try { getCourse(Rules.courseOpts(Rules.normalize({ mode: "jour" }), dayLabel())); } catch (e) { console.error(e); } }, 4000).unref(); }
module.exports = { start, bind, onDestroy, onReconnect, onDisconnect, onLeave, canReturn: (room) => !!(room.g && room.g.over), cleanCos, warm, getCourse, dayLabel };

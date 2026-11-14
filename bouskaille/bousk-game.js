// ============================================================
// BOUSKAILLE — Lien entre les salons (Socket.io) et la partie. Le serveur est l'autorité.
// ============================================================
const { Match } = require("./bousk-match.js");
const Rules = require("./public/game/rules.js");

const TICK_MS = 1000 / 60;
const HATS = 10, TRAILS = 6, CHARS = 5;
const GABS = ["moyen", "plume", "lourd", "rebond"];
const cleanCos = (c) => { c = c || {}; const n = (v, m) => { v = Math.floor(Number(v)); return v >= 0 && v < m ? v : 0; }; return { char: n(c.char, CHARS), hat: n(c.hat, HATS), trail: n(c.trail, TRAILS), gab: GABS.includes(c.gab) ? c.gab : "moyen" }; };

function cosMap(room) { const m = {}; room.players.forEach((p) => { m[p.id] = p.cos || { char: 0, hat: 0, trail: 0 }; }); return m; }
function sendTo(room, p, ev, data) { if (!p.isBot && p.socketId && room.g) room.g.api.io.to(p.socketId).emit(ev, data); }
function toAll(room, ev, data) { room.g.api.emitAll(room, ev, data); }

function start(room, api) {
  room.players.forEach((p, i) => { if (!p.cos) p.cos = p.isBot ? { char: (i * 2 + 1) % CHARS, hat: (i * 3) % HATS, trail: i % TRAILS } : { char: 0, hat: 0, trail: 0 }; if (p.isBot && !p.cos.gab) p.cos.gab = GABS[(i * 3 + 1) % GABS.length]; });
  const defs = room.players.map((p) => ({ id: p.id, name: p.name, color: p.color, isBot: p.isBot, level: p.level || "moyen", gab: (p.cos && p.cos.gab) || "moyen" }));
  const m = new Match(room.settings, defs);
  room.g = { api, m, last: Date.now(), acc: 0, tickN: 0, evBuf: [], hudAt: 0, timer: null, over: false, cos: cosMap(room) };
  room.players.forEach((p) => { if (!p.isBot && !p.connected) m.setAuto(p.id, true); });
  room.g.timer = setInterval(() => { try { loop(room); } catch (e) { console.error("bouskaille loop", e); } }, 8);
  if (room.g.timer.unref) room.g.timer.unref();
  process.nextTick(() => flushOut(room));
}
function onDestroy(room) { if (room.g && room.g.timer) { clearInterval(room.g.timer); room.g.timer = null; } }
const humans = (room) => room.players.filter((p) => !p.isBot && !p.left);

function loop(room) {
  const g = room.g; if (!g || !g.timer) return;
  const now = Date.now(); g.acc += Math.min(100, now - g.last); g.last = now;
  let n = 0;
  while (g.acc >= TICK_MS && n < 6) {
    g.acc -= TICK_MS; n++; g.m.tick(); g.tickN++;
    flushOut(room);
    const m = g.m, play = m.phase === "play";
    if (g.tickN % (play ? 2 : 6) === 0) sendSnaps(room);
  }
  if (now - g.hudAt > 250) { g.hudAt = now; toAll(room, "b:hud", g.m.hud()); }
  if (g.m.over && !g.over) { g.over = true; toAll(room, "b:over", { standings: g.m.standings(), teams: g.m.teamScores(), history: g.m.history }); }
}
function flushOut(room) {
  const g = room.g, m = g.m; if (!m.out.length) return;
  const evs = m.out; m.out = [];
  const keep = [];
  for (const e of evs) {
    if (e.e === "round") { toAll(room, "b:round", Object.assign(m.roundMsg(), { cos: cosMap(room) })); }
    else if (e.e === "phase") {
      if (e.p === "roundEnd") toAll(room, "b:end", { end: m.endInfo, standings: m.standings(), teams: m.teamScores() });
      else if (e.p !== "over") toAll(room, "b:phase", { p: e.p });
    } else if (e.e === "hit") { const k = e.a + ">" + e.b; const t = m.W.t; g.hitAt = g.hitAt || {}; if (g.hitAt[k] && t - g.hitAt[k] < 0.3 && e.p < 0.5) continue; g.hitAt[k] = t; keep.push(e); }
    else keep.push(e);
  }
  if (keep.length) g.evBuf = g.evBuf.concat(keep).slice(-60);
}
function sendSnaps(room) {
  const g = room.g; const snap = g.m.snapshot(); snap.ev = g.evBuf; g.evBuf = [];
  for (const p of room.players) { if (p.isBot || !p.socketId) continue; const inp = g.m.input[p.id]; const o = Object.assign({}, snap, { ack: inp ? inp.seq : 0, now: Date.now() }); g.api.io.to(p.socketId).emit("b:snap", o); }
}

function bind(socket, h, api) {
  const { ctx, me, toast, safe } = h;
  const inGame = () => ctx.room && ctx.room.g && ctx.room.status === "game";
  const pid = () => { const p = me(); return p ? p.id : null; };
  let nIn = 0, tIn = 0;
  socket.on("b:in", safe((d) => {
    if (!inGame() || !d) return; const now = Date.now(); if (now - tIn > 1000) { tIn = now; nIn = 0; } if (++nIn > 90) return;
    const p = me(); if (!p) return; ctx.room.g.m.setInput(p.id, { mx: d.mx, mz: d.mz, h: d.h, j: !!d.j, seq: d.seq });
    if (ctx.room.g.m.autoIds.has(p.id)) ctx.room.g.m.setAuto(p.id, false);
  }));
  socket.on("b:cos", safe((d) => {
    const room = ctx.room, p = me(); if (!room || !p) return; p.cos = cleanCos(d);
    api.emitAll(room, "b:cosmap", cosMap(room));
  }));
  socket.on("b:hello", safe(() => {
    const room = ctx.room; if (!room) return; const p = me();
    socket.emit("b:cosmap", cosMap(room));
    if (room.g && p) syncTo(room, p);
  }));
  socket.on("b:chat", safe(() => {}));
}
function syncTo(room, p) {
  const g = room.g; if (!g) return; const m = g.m;
  sendTo(room, p, "b:round", Object.assign(m.roundMsg(), { cos: cosMap(room) }));
  sendTo(room, p, "b:phase", { p: m.phase });
  if (m.phase === "roundEnd" && m.endInfo) sendTo(room, p, "b:end", { end: m.endInfo, standings: m.standings(), teams: m.teamScores() });
  if (m.over) sendTo(room, p, "b:over", { standings: m.standings(), teams: m.teamScores(), history: m.history });
  const snap = m.snapshot(); snap.ev = []; snap.ack = 0; snap.now = Date.now(); sendTo(room, p, "b:snap", snap);
  sendTo(room, p, "b:hud", m.hud());
}
function onReconnect(room, p) { const g = room.g; if (!g) return; g.m.setAuto(p.id, false); syncTo(room, p); }
function onDisconnect(room, p) { const g = room.g; if (!g) return; g.m.setAuto(p.id, true); }
function onLeave(room, p) { const g = room.g; if (!g) return; g.m.setAuto(p.id, true); if (!room.players.some((x) => !x.isBot && !x.left)) onDestroy(room); }
module.exports = { start, bind, onDestroy, onReconnect, onDisconnect, onLeave, canReturn: (room) => !!(room.g && room.g.m.over), cleanCos };

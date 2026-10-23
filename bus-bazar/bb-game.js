// ============================================================
// BUS BAZAR — Partie côté serveur (salon, postes, robots, réseau)
// ============================================================
const D = require("./public/game/data.js");
const Rules = require("./public/game/rules.js");
const Sim = require("./bb-sim.js");
const { view } = require("./bb-view.js");
const { act } = require("./bb-actions.js");
const Bots = require("./bb-bots.js");
const Rd = require("./public/game/road.js");

const TS = Math.max(0.001, Number(process.env.BB_TIME_SCALE) || 1);
const SEND_EVERY = 0.1;
const roleIds = D.ROLE_IDS;

function bbOf(room) { if (!room.bb) room.bb = { assign: {} }; return room.bb; }
function cleanAssign(room) {
  const bb = bbOf(room); const humans = room.players.filter((p) => !p.isBot && !p.left); const ids = new Set(humans.map((p) => p.id)); const used = new Set();
  Object.keys(bb.assign).forEach((id) => { if (!ids.has(id) || used.has(bb.assign[id]) || !roleIds.includes(bb.assign[id])) delete bb.assign[id]; else used.add(bb.assign[id]); });
  return bb.assign;
}
function crewPublic(room) {
  const a = cleanAssign(room); const out = {}; roleIds.forEach((r) => { out[r] = null; }); Object.keys(a).forEach((id) => { out[a[id]] = id; }); return out;
}
function emitCrew(room, api) { const crew = crewPublic(room); room.players.forEach((p) => { if (!p.isBot && p.socketId) api.io.to(p.socketId).emit("bb:crew", { crew }); }); }

// ---------- démarrage ----------
function start(room, api) {
  const humans = room.players.filter((p) => !p.isBot && !p.left); const assign = cleanAssign(room);
  const taken = new Set(Object.values(assign)); const free = roleIds.filter((r) => !taken.has(r));
  humans.forEach((p) => { if (!assign[p.id]) { const r = free.shift(); if (r) assign[p.id] = r; } });
  const S = Sim.create(room.settings);
  const rng = Rd.rngOf(S.seed + "|bots");
  const brains = {}; roleIds.forEach((r) => { brains[r] = Bots.makeBrain(r, S.cfg.botSkill, rng); });
  const g = room.g = { api, S, brains, acc: 0, last: Date.now(), sendT: 0, aid: {}, bucket: {}, over: false, rotated: 0, lastPhase: S.phase, vote: null, timer: null };
  api.sysChat(room, "La mission commence, graine " + S.seed + ". Les postes sans joueur sont tenus par des robots.");
  g.timer = setInterval(() => { try { loop(room); } catch (e) { console.error("bb loop", e); } }, 50);
  sendAll(room, true);
}
function onDestroy(room) { if (room.g && room.g.timer) { clearInterval(room.g.timer); room.g.timer = null; } }

function playerOfRole(room, role) {
  const a = cleanAssign(room); const id = Object.keys(a).find((k) => a[k] === role); return id ? room.players.find((p) => p.id === id) : null;
}
function roleOfPlayer(room, p) { return cleanAssign(room)[p.id] || null; }
// un poste est contrôlé par un humain connecté, sinon par un robot si le salon le permet
function humanAt(room, role) { const p = playerOfRole(room, role); return p && p.connected && !p.left ? p : null; }
function botAt(room, role) { if (humanAt(room, role)) return false; const p = playerOfRole(room, role); if (!p) return true; return !!room.settings.fillAbsent; }

function loop(room) {
  const g = room.g; if (!g || g.over) return; const S = g.S;
  const now = Date.now(); let dt = Math.min(0.5, (now - g.last) / 1000) * TS; g.last = now; g.acc += dt;
  let steps = 0;
  while (g.acc >= Sim.DT && steps < 400 && !S.end) {
    g.acc -= Sim.DT; steps++;
    roleIds.forEach((r) => { if (botAt(room, r)) Bots.think(S, g.brains[r], Sim.DT); else if (!humanAt(room, r) && r === "driver") { S.bus.thr = 0; S.bus.brk = 0.25; S.bus.steer = 0; } });
    Sim.step(S, Sim.DT);
    if (g.vote && S.t > g.vote.until) resolveVote(room);
    if (S.phase === "stop" && g.lastPhase === "drive") onStop(room);
    g.lastPhase = S.phase;
  }
  if (S.end && !g.over) { g.over = true; sendAll(room, true); room.status = "game"; return; }
  g.sendT += (now - (g.lastSend || now)) / 1000; g.lastSend = now;
  if (g.sendT >= SEND_EVERY) { g.sendT = 0; sendAll(room, false); }
}

function onStop(room) {
  const g = room.g, S = g.S; if (S.si >= S.nSeg - 1) return;
  if (S.cfg.rotation !== "releve") return;
  const a = cleanAssign(room); const ids = Object.keys(a); if (!ids.length) return;
  const next = {}; ids.forEach((id) => { const i = roleIds.indexOf(a[id]); next[id] = roleIds[(i + 1) % roleIds.length]; });
  room.bb.assign = next; g.rotated++;
  const lines = ids.map((id) => { const p = room.players.find((q) => q.id === id); const r = D.ROLES.filter((x) => x.id === next[id])[0]; return p.name + " passe " + r.label.toLowerCase(); });
  Sim.addLog(S, "info", "🔁", "Relève à l'arrêt. " + lines.join(", ") + ".");
  g.api.emitAll(room, "bb:rotate", { crew: crewPublic(room) });
}

function sendAll(room, force) {
  const g = room.g; if (!g) return; const S = g.S;
  room.players.forEach((p) => { if (p.isBot || !p.socketId || p.left) return; sendTo(room, g.api.io.sockets.sockets.get(p.socketId), p); });
}
function sendTo(room, socket, p) {
  const g = room.g; if (!g || !socket) return; const role = roleOfPlayer(room, p);
  const v = view(g.S, role || "cabin"); v.you = role; v.spectator = !role; v.crew = crewPublic(room); v.crewNames = {}; roleIds.forEach((r) => { const q = v.crew[r] ? room.players.find((x) => x.id === v.crew[r]) : null; v.crewNames[r] = q ? q.name : "Robot"; v.crewBot = v.crewBot || {}; v.crewBot[r] = !q || !q.connected; });
  v.vote = g.vote ? { until: Math.round(g.vote.until - g.S.t), by: g.vote.by, yes: g.vote.yes.size, no: g.vote.no.size, mine: g.vote.yes.has(p.id) || g.vote.no.has(p.id) } : null;
  v.rotated = g.rotated; v.rotation = g.S.cfg.rotation;
  socket.emit("bb:state", v);
}

// ---------- vote d'urgence ----------
function startVote(room, p, role) {
  const g = room.g, S = g.S; if (S.cfg.sabotage !== "total") return "Le vote d'urgence n'est pas activé dans ce salon.";
  if (g.vote) return "Un vote est déjà en cours."; if (S.phase !== "drive") return "Le bus est déjà à l'arrêt.";
  if ((g.voteCd || 0) > S.t) return "Patiente avant un nouveau vote.";
  g.vote = { until: S.t + 8, by: p.name, yes: new Set([p.id]), no: new Set() }; g.voteCd = S.t + 60;
  Sim.addLog(S, "prank", "🗳️", p.name + " demande un arrêt d'urgence et lance un vote."); 
  const hs = room.players.filter((q) => !q.isBot && !q.left && q.connected); if (hs.length <= 1) resolveVote(room);
  return null;
}
function castVote(room, p, yes) {
  const g = room.g; if (!g || !g.vote) return; if (g.vote.yes.has(p.id) || g.vote.no.has(p.id)) return;
  (yes ? g.vote.yes : g.vote.no).add(p.id);
  const hs = room.players.filter((q) => !q.isBot && !q.left && q.connected).length; if (g.vote.yes.size + g.vote.no.size >= hs) resolveVote(room);
}
function resolveVote(room) {
  const g = room.g, S = g.S; const v = g.vote; if (!v) return; g.vote = null;
  const hs = room.players.filter((q) => !q.isBot && !q.left && q.connected).length;
  if (v.yes.size * 2 > Math.max(1, hs)) { S.em = 4; Sim.moodAll(S, 2); Sim.addLog(S, "good", "🛑", "Le vote passe, le bus freine d'urgence et chacun reprend son souffle."); }
  else Sim.addLog(S, "info", "🗳️", "Le vote d'arrêt d'urgence est rejeté, on continue.");
}

// ---------- réseau ----------
function bind(socket, helpers, api) {
  const { ctx, me, safe, toast } = helpers;
  const cur = () => { const room = ctx.room; const p = me(); return room && p ? { room, p } : null; };
  socket.on("bb:crewGet", safe(() => { const c = cur(); if (!c) return; socket.emit("bb:crew", { crew: crewPublic(c.room) }); }));
  socket.on("bb:role", safe((d) => {
    const c = cur(); if (!c || c.room.status !== "lobby") return;
    const role = d && d.role; const a = cleanAssign(c.room);
    if (role == null) { delete a[c.p.id]; return emitCrew(c.room, api); }
    if (!roleIds.includes(role)) return;
    const holderId = Object.keys(a).find((k) => a[k] === role);
    if (holderId && holderId !== c.p.id) return toast("Ce poste est déjà pris par un autre joueur.");
    a[c.p.id] = role; emitCrew(c.room, api);
  }));
  socket.on("bb:act", safe((m) => {
    const c = cur(); if (!c || !c.room.g) return; const g = c.room.g; const p = c.p;
    if (!m || typeof m !== "object") return;
    let raw; try { raw = JSON.stringify(m); } catch (e) { return; } if (raw.length > 400) return;
    // débit maximal par joueur
    const now = Date.now(); const bk = g.bucket[p.id] || (g.bucket[p.id] = { t: now, n: 40 }); bk.n = Math.min(60, bk.n + (now - bk.t) / 1000 * 50); bk.t = now; if (bk.n < 1) return; bk.n -= 1;
    const role = roleOfPlayer(c.room, p); const aid = Number(m.aid);
    const reply = (r) => { if (isFinite(aid)) socket.emit("bb:ack", Object.assign({ aid }, r)); };
    if (!role) return reply({ ok: false, err: "Tu n'as pas de poste dans cette mission." });
    if (m.t !== "drive") { if (!isFinite(aid) || aid <= (g.aid[p.id] || 0)) return; g.aid[p.id] = aid; }
    if (m.t === "voteStart") { const e = startVote(c.room, p, role); return reply(e ? { ok: false, err: e } : { ok: true }); }
    if (m.t === "voteCast") { castVote(c.room, p, !!m.yes); return reply({ ok: true }); }
    const r = act(g.S, role, m); if (m.t !== "drive") reply(r);
  }));
}
function onReconnect(room, p, api) {
  const g = room.g; if (!g) return; g.aid[p.id] = 0; const s = api.io.sockets.sockets.get(p.socketId); if (s) { s.emit("bb:crew", { crew: crewPublic(room) }); sendTo(room, s, p); }
  const role = roleOfPlayer(room, p); if (role) Sim.addLog(g.S, "info", "🔌", p.name + " reprend son poste de " + D.ROLES.filter((x) => x.id === role)[0].label.toLowerCase() + ".");
}
function onDisconnect(room, p) {
  const g = room.g; if (!g) return; const role = roleOfPlayer(room, p);
  if (role) Sim.addLog(g.S, "info", "📴", p.name + " a perdu la connexion" + (room.settings.fillAbsent ? ", un robot prend le volant du poste en attendant." : ", son poste reste vide.").replace("prend le volant du poste", "reprend le poste"));
}
function onLeave(room, p) {
  const g = room.g; if (!g) return; const a = cleanAssign(room); delete a[p.id];
  if (!room.players.some((x) => !x.isBot && !x.left)) onDestroy(room);
}
module.exports = { start, bind, onReconnect, onDisconnect, onLeave, onDestroy, canReturn: (room) => !!(room.g && room.g.over), crewPublic, cleanAssign, loop, roleOfPlayer };

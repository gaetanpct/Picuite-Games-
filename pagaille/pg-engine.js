// ============================================================
// PAGAILLE PARTY — Moteur de partie (serveur)
// Il gère les manches, le vote, les règles, le déroulement d'un mini-jeu, les points et les déconnexions.
// Les mini-jeux vivent dans games/<id>.js et suivent le même contrat.
//   create(ctx) renvoie { update(dt), frame(), priv(pid), onAct(pid,msg), done, ranking() }
// ============================================================
const Cat = require("./public/game/catalog.js");
const Rules = require("./public/game/rules.js");
const U = require("./pg-util.js");

const MODULES = {};
Cat.ids.forEach((id) => { try { MODULES[id] = require("./games/" + id + ".js"); } catch (e) { console.error("Mini-jeu ignoré", id, e); } });

const TICK = 1000 / 30;
const GO_MS = 3200;          // compte à rebours avant l'action
const HOLD_MS = 1800;        // pause après la fin d'un mini-jeu
const RESULT_MS = 7000;
const MODS = [
  { id: "inv", label: "Commandes inversées", desc: "Gauche devient droite et haut devient bas.", move: true },
  { id: "turbo", label: "Turbo", desc: "Tout va plus vite, y compris les compteurs.", move: false },
  { id: "double", label: "Points doublés", desc: "Cette manche rapporte deux fois plus.", move: false },
];
const present = (p) => !!p && !p.isBot && p.connected && !p.left;

function start(room, api) {
  const s = room.settings;
  const g = room.g = {
    api, phase: "boot", t: 0, acc: 0, last: Date.now(), round: 0, total: Rules.totalRounds(s), scores: {}, delta: {}, plays: {}, lastGame: null, history: [],
    inputs: {}, edges: {}, ready: {}, votes: {}, options: [], until: 0, inst: null, meta: null, mod: null, members: [], seed: Math.random().toString(36).slice(2), endReason: "", beat: 0, msgs: [], result: null, over: false,
  };
  room.players.forEach((p) => { g.scores[p.id] = 0; g.delta[p.id] = 0; });
  api.sysChat(room, "C'est parti pour " + g.total + " manche" + (g.total > 1 ? "s" : "") + ".");
  g.timer = setInterval(() => { try { const now = Date.now(); step(room, Math.min(250, now - g.last)); g.last = now; } catch (e) { console.error("tick pagaille", e); } }, 33);
  nextRound(room);
}
function onDestroy(room) { const g = room.g; if (g && g.timer) { clearInterval(g.timer); g.timer = null; } }

// ---------- déroulement ----------
function members(room) { return room.players.filter(present); }
function nextRound(room) {
  const g = room.g;
  if (g.round >= g.total) return finish(room, "");
  const mem = members(room);
  if (mem.length < 2) return finish(room, "Il ne reste pas assez de joueurs pour continuer.");
  g.round++; g.members = mem.map((p, i) => ({ id: p.id, name: p.name, color: p.color, idx: i }));
  g.votes = {}; g.ready = {}; g.inst = null; g.meta = null; g.result = null; g.msgs = [];
  g.options = pickOptions(room, g.members.length);
  if (g.options.length <= 1) { g.meta = g.options[0] || Cat.GAMES[0]; return beginIntro(room); }
  g.phase = "vote"; g.until = g.t + room.settings.voteTime * 1000; push(room);
}
function pickOptions(room, n) {
  const g = room.g, s = room.settings;
  let pool = Cat.GAMES.filter((m) => MODULES[m.id] && s.games.includes(m.id) && m.min <= n && n <= m.max);
  if (!pool.length) pool = Cat.GAMES.filter((m) => MODULES[m.id] && m.min <= n && n <= m.max);
  if (s.noRepeat && g.lastGame && pool.length > 1) pool = pool.filter((m) => m.id !== g.lastGame);
  const out = [];
  while (out.length < 3 && pool.length) {
    const w = pool.map((m) => 1 / (1 + (g.plays[m.id] || 0) * 1.2)); const tot = w.reduce((a, b) => a + b, 0); let r = Math.random() * tot; let k = 0;
    for (; k < pool.length - 1; k++) { r -= w[k]; if (r <= 0) break; }
    out.push(pool[k]); pool.splice(k, 1);
  }
  return out;
}
function resolveVote(room) {
  const g = room.g; const counts = {}; g.options.forEach((o) => { counts[o.id] = 0; });
  Object.keys(g.votes).forEach((pid) => { const v = g.votes[pid]; if (counts[v] != null) counts[v]++; });
  const best = Math.max.apply(null, Object.values(counts)); const top = g.options.filter((o) => counts[o.id] === best);
  g.meta = top[Math.floor(Math.random() * top.length)];
  g.api.sysChat(room, "Manche " + g.round + " sur " + g.total + ", " + g.meta.name + ".");
  beginIntro(room);
}
function beginIntro(room) {
  const g = room.g, s = room.settings;
  g.mod = null;
  if (s.mode === "chaos") { const ok = MODS.filter((m) => !m.move || g.meta.move); g.mod = ok[Math.floor(Math.random() * ok.length)]; }
  g.plays[g.meta.id] = (g.plays[g.meta.id] || 0) + 1; g.lastGame = g.meta.id;
  g.phase = "intro"; g.ready = {}; g.until = g.t + s.introTime * 1000; push(room);
}
function beginPlay(room) {
  const g = room.g, s = room.settings; const meta = g.meta;
  const mod = g.mod ? g.mod.id : "";
  g.inputs = {}; g.edges = {};
  const ctx = {
    n: g.members.length, players: g.members.map((m) => Object.assign({}, m)), mod, inv: mod === "inv", speed: mod === "turbo" ? 1.3 : 1, pace: (s.pace || 1) * (mod === "turbo" ? 0.8 : 1),
    rnd: U.mulberry32(U.hashSeed(g.seed + ":" + g.round + ":" + meta.id)),
    input(pid) { const k = g.inputs[pid] || {}; let x = (k.r ? 1 : 0) - (k.l ? 1 : 0), y = (k.d ? 1 : 0) - (k.u ? 1 : 0); if (!present(findP(room, pid))) { x = 0; y = 0; } if (ctx.inv && meta.move) { x = -x; y = -y; } return { x, y, a: !!k.a, b: !!k.b }; },
    edge(pid) { const e = g.edges[pid] || {}; return { a: !!e.a, b: !!e.b }; },
    present(pid) { return present(findP(room, pid)); },
    announce(text, ms) { g.msgs.push({ text, until: g.t + (ms || 2600) }); },
    now() { return g.t; },
  };
  g.ctx = ctx; g.inst = MODULES[meta.id].create(ctx); g.phase = "play"; g.go = g.t + GO_MS; g.endAt = 0;
  g.cap = (meta.secs * 1.9 + 25) * 1000 * ctx.pace; g.playT = 0; push(room);
}
function endPlay(room) {
  const g = room.g, s = room.settings; const inst = g.inst; const ids = g.members.map((m) => m.id);
  let rk = { groups: [], bonus: {}, notes: {} };
  try { rk = Object.assign(rk, inst.ranking()); } catch (e) { console.error("classement", g.meta.id, e); }
  const seen = new Set(); const groups = []; (rk.groups || []).forEach((grp) => { const gg = grp.filter((id) => ids.includes(id) && !seen.has(id)); gg.forEach((id) => seen.add(id)); if (gg.length) groups.push(gg); });
  const rest = ids.filter((id) => !seen.has(id)); if (rest.length) groups.push(rest);
  const n = ids.length; let pos = 1; const rows = [];
  const mult = (g.round >= g.total && s.lastDouble ? 2 : 1) * (g.mod && g.mod.id === "double" ? 2 : 1);
  groups.forEach((grp) => {
    const avg = pos + (grp.length - 1) / 2; const base = Math.round(10 * (n - avg) / Math.max(1, n - 1));
    grp.forEach((id) => { const bonus = clampInt((rk.bonus || {})[id] || 0, 0, 5); const pts = (base + bonus) * mult; g.scores[id] = (g.scores[id] || 0) + pts; g.delta[id] = pts; const m = g.members.find((x) => x.id === id); rows.push({ id, name: m.name, color: m.color, rank: pos, tie: grp.length > 1, pts, bonus, note: (rk.notes || {})[id] || "" }); });
    pos += grp.length;
  });
  room.players.forEach((p) => { if (!ids.includes(p.id)) g.delta[p.id] = 0; });
  g.result = { rows, mult, game: g.meta.name, icon: g.meta.icon };
  g.history.push({ round: g.round, game: g.meta.id, winners: (groups[0] || []).slice() });
  g.phase = "result"; g.until = g.t + RESULT_MS; push(room);
}
const clampInt = (v, a, b) => Math.max(a, Math.min(b, Math.round(v)));
function finish(room, reason) {
  const g = room.g; g.phase = "over"; g.over = true; g.endReason = reason; g.until = 0;
  if (g.timer) { clearInterval(g.timer); g.timer = null; }
  push(room);
}
function findP(room, pid) { return room.players.find((p) => p.id === pid); }

// ---------- boucle ----------
function step(room, ms) {
  const g = room.g; if (!g || g.over) return; g.acc += ms;
  let guard = 0;
  while (g.acc >= TICK && guard++ < 12) { g.acc -= TICK; tick(room); }
  if (g.acc > TICK * 12) g.acc = 0;
}
function tick(room) {
  const g = room.g; g.t += TICK; g.beat++;
  g.msgs = g.msgs.filter((m) => m.until > g.t);
  if (g.phase === "vote") {
    const mem = members(room); const allVoted = mem.length > 0 && mem.every((p) => g.votes[p.id]);
    if (allVoted && g.until - g.t > 1300) { g.until = g.t + 1300; push(room); }
    if (g.t >= g.until) {
      if (!Object.keys(g.votes).length) { g.api.sysChat(room, "Personne n'a voté, le sort a choisi."); }
      resolveVote(room);
    }
  } else if (g.phase === "intro") {
    const mem = members(room); const all = mem.length > 0 && mem.every((p) => g.ready[p.id]);
    if (all && g.until - g.t > 900) { g.until = g.t + 900; push(room); }
    if (g.t >= g.until) beginPlay(room);
  } else if (g.phase === "play") {
    const inst = g.inst;
    if (g.t >= g.go && !g.endAt) {
      g.playT += TICK; try { inst.update(TICK / 1000); } catch (e) { console.error("jeu", g.meta.id, e); inst.done = true; }
      Object.keys(g.edges).forEach((k) => { g.edges[k] = { a: false, b: false }; });
      if (inst.done || g.playT >= g.cap) { g.endAt = g.t + HOLD_MS; }
    }
    if (g.endAt && g.t >= g.endAt) endPlay(room);
    else if (g.beat % 2 === 0) sendFrames(room);
  } else if (g.phase === "result") {
    if (g.t >= g.until) nextRound(room);
  }
  if (g.beat % 30 === 0 && g.phase !== "play") push(room);
}

// ---------- messages ----------
function standings(room) {
  const g = room.g;
  const rows = room.players.map((p) => ({ id: p.id, name: p.name, color: p.color, pts: g.scores[p.id] || 0, delta: g.delta[p.id] || 0, online: present(p), left: !!p.left }));
  rows.sort((a, b) => b.pts - a.pts);
  let rank = 0; rows.forEach((r, i) => { if (i === 0 || r.pts !== rows[i - 1].pts) rank = i + 1; r.rank = rank; });
  return rows;
}
function stateMsg(room, pid) {
  const g = room.g; const meta = g.meta;
  const counts = {}; g.options.forEach((o) => { counts[o.id] = 0; }); Object.keys(g.votes).forEach((k) => { if (counts[g.votes[k]] != null) counts[g.votes[k]]++; });
  return {
    phase: g.phase, left: Math.max(0, g.until - g.t), round: g.round, total: g.total, mode: room.settings.mode, standings: standings(room), reason: g.endReason,
    vote: g.phase === "vote" ? { options: g.options, counts, mine: g.votes[pid] || null, voted: Object.keys(g.votes) } : null,
    game: meta && g.phase !== "vote" ? meta : null, mod: g.mod, ready: Object.keys(g.ready), members: g.members.map((m) => m.id),
    result: g.phase === "result" ? g.result : null, history: g.phase === "over" ? g.history : null,
    goIn: g.phase === "play" ? Math.max(0, g.go - g.t) : 0,
  };
}
function push(room) {
  const g = room.g; room.players.forEach((p) => { if (p.isBot || !p.socketId) return; g.api.io.to(p.socketId).emit("pg:state", stateMsg(room, p.id)); });
}
function sendFrames(room) {
  const g = room.g; const inst = g.inst; if (!inst) return;
  let fr; try { fr = inst.frame(); } catch (e) { console.error("frame", g.meta.id, e); return; }
  fr.hud = Object.assign({}, fr.hud || {}); fr.hud.msgs = g.msgs.map((m) => m.text);
  const cd = g.go - g.t; fr.hud.cd = cd > 0 ? Math.ceil(cd / 1000) : 0; if (g.endAt) fr.hud.end = true;
  room.players.forEach((p) => {
    if (p.isBot || !p.socketId) return;
    let pv = null; try { pv = inst.priv ? inst.priv(p.id) : null; } catch (e) { console.error("priv", e); }
    g.api.io.to(p.socketId).emit("pg:frame", { f: fr, p: pv });
  });
}

// ---------- sockets ----------
function bind(socket, helpers, api) {
  const { ctx, me, safe } = helpers;
  const inGame = () => ctx.room && ctx.room.g && !ctx.room.g.over && ctx.room.status === "game";
  const rate = { n: 0, t: 0 };
  const ok = () => { const now = Date.now(); if (now - rate.t > 1000) { rate.t = now; rate.n = 0; } return ++rate.n < 90; };
  socket.on("pg:vote", safe(({ id }) => {
    if (!inGame() || !ok()) return; const g = ctx.room.g; const p = me(); if (g.phase !== "vote" || !p) return;
    if (!g.members.some((m) => m.id === p.id)) return; if (!g.options.some((o) => o.id === id)) return;
    g.votes[p.id] = id; push(ctx.room);
  }));
  socket.on("pg:ready", safe(() => {
    if (!inGame() || !ok()) return; const g = ctx.room.g; const p = me(); if (g.phase !== "intro" || !p) return; g.ready[p.id] = true; push(ctx.room);
  }));
  socket.on("pg:in", safe((k) => {
    if (!inGame() || !k || typeof k !== "object") return; const g = ctx.room.g; const p = me(); if (!p) return;
    const nk = { l: k.l ? 1 : 0, r: k.r ? 1 : 0, u: k.u ? 1 : 0, d: k.d ? 1 : 0, a: k.a ? 1 : 0, b: k.b ? 1 : 0 };
    const old = g.inputs[p.id] || {}; const e = g.edges[p.id] || { a: false, b: false };
    if (nk.a && !old.a) e.a = true; if (nk.b && !old.b) e.b = true; g.edges[p.id] = e; g.inputs[p.id] = nk;
  }));
  socket.on("pg:act", safe((m) => {
    if (!inGame() || !m || typeof m !== "object" || !ok()) return; const g = ctx.room.g; const p = me(); if (!p || g.phase !== "play" || !g.inst || !g.inst.onAct) return;
    if (g.t < g.go || g.endAt) return;
    const clean = { type: String(m.type || "").slice(0, 12), id: m.id == null ? null : String(m.id).slice(0, 24), x: Number(m.x) || 0, y: Number(m.y) || 0, v: Number(m.v) || 0 };
    g.inst.onAct(p.id, clean);
  }));
}
function sendTo(room, socket, p) {
  const g = room.g; if (!g) return; socket.emit("pg:state", stateMsg(room, p.id));
}
function onReconnect(room, p) {
  const g = room.g; if (!g) return; const s = g.api.io.sockets.sockets.get(p.socketId); if (s) sendTo(room, s, p);
}
function onLeave(room, p) {
  const g = room.g; if (!g) return; if (g.inputs[p.id]) g.inputs[p.id] = {};
  if (!members(room).length) onDestroy(room);
}
function onDisconnect(room, p) { const g = room.g; if (g && g.inputs) g.inputs[p.id] = {}; }

module.exports = { start, bind, onReconnect, onLeave, onDisconnect, onDestroy, canReturn: (room) => !!(room.g && room.g.over), step, standings, MODULES };

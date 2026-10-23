// ============================================================
// MAUVAISES LANGUES — Déroulement d'une partie côté serveur
// Un joueur classe tout le monde en secret, les autres devinent la question.
// ============================================================
const Rules = require("./public/game/rules.js");
const Q = require("./questions/index.js");

const TS = Math.max(0.001, Number(process.env.ML_TIME_SCALE) || 1);
const rng = Math.random;
const SKIP_MS = 6000 * TS;
const shuffle = (a) => { const r = a.slice(); for (let i = r.length - 1; i > 0; i--) { const j = Math.floor(rng() * (i + 1)); [r[i], r[j]] = [r[j], r[i]]; } return r; };
const defOf = (room, id) => room.players.find((p) => p.id === id);
const present = (room) => room.players.filter((p) => !p.left);

// tirage pondéré sans remise
function pickWeighted(list, weightOf) {
  let tot = 0; const ws = list.map((x) => { const w = Math.max(0, weightOf(x)); tot += w; return w; });
  if (tot <= 0) return list.length ? list[Math.floor(rng() * list.length)] : null;
  let r = rng() * tot; for (let i = 0; i < list.length; i++) { r -= ws[i]; if (r <= 0) return list[i]; }
  return list[list.length - 1];
}

function start(room, api) {
  const s = room.settings; const ids = room.players.map((p) => p.id);
  // chacun passe autant de fois, sans que le même joueur enchaîne deux manches
  let order = [];
  for (let c = 0; c < s.cycles; c++) {
    let perm = shuffle(ids);
    for (let t = 0; t < 8 && order.length && ids.length > 1 && perm[0] === order[order.length - 1]; t++) perm = shuffle(ids);
    order = order.concat(perm);
  }
  const g = room.g = { api, order, idx: -1, total: order.length, phase: "wait", phaseUntil: 0, used: new Set(), lastTheme: null, scores: {}, correctCount: {}, history: [], q: null, swapsLeft: 0, rankerId: null, pids: [], ranking: null, options: null, correctOpt: null, votes: {}, reveal: null, timer: null, over: false, lastReact: {} };
  room.players.forEach((p) => { g.scores[p.id] = 0; g.correctCount[p.id] = 0; });
  api.sysChat(room, "C'est parti, " + g.total + " manches. Les questions sont déplacées, vous êtes prévenus.");
  g.timer = setInterval(() => { try { tick(room); } catch (e) { console.error("tick ml", e); } }, 250);
  nextRound(room);
}
function onDestroy(room) { if (room.g && room.g.timer) { clearInterval(room.g.timer); room.g.timer = null; } }

// ---------- choix des questions ----------
function allowed(room) { const th = new Set(room.settings.themes); return Q.ALL.filter((q) => th.has(q.theme)); }
function drawQuestion(room, avoidIds) {
  const g = room.g, s = room.settings; const W = Rules.SPICE[s.spice] || Rules.SPICE.epice;
  let pool = allowed(room).filter((q) => !g.used.has(q.id) && !(avoidIds && avoidIds.has(q.id)));
  if (!pool.length) { g.used.clear(); pool = allowed(room).filter((q) => !(avoidIds && avoidIds.has(q.id))); }
  return pickWeighted(pool, (q) => W[q.heat - 1] * (q.theme === g.lastTheme ? 0.15 : 1));
}
function drawDecoys(room, real) {
  const s = room.settings; const pool = allowed(room).filter((q) => q.id !== real.id && q.text !== real.text);
  const near = (q) => 1 + (Math.abs(q.heat - real.heat) <= 1 ? 3 : 0);
  const out = []; const take = (list, n) => { for (let i = 0; i < n && list.length; i++) { const c = pickWeighted(list, near); out.push(c); list = list.filter((q) => q !== c && q.id !== c.id); } };
  const same = pool.filter((q) => q.theme === real.theme), other = pool.filter((q) => q.theme !== real.theme);
  if (s.decoys === "theme") { take(same, 3); take(other.filter((q) => !out.includes(q)), 3 - out.length); }
  else if (s.decoys === "hasard") take(pool, 3);
  else { take(same, 2); take(other, 3 - out.length); take(pool.filter((q) => !out.includes(q)), 3 - out.length); }
  return out;
}

// ---------- manches ----------
function nextRound(room) {
  const g = room.g, s = room.settings;
  for (;;) {
    g.idx++;
    if (g.idx >= g.total || present(room).length < 3) return finish(room, present(room).length < 3 && g.idx < g.total);
    const d = defOf(room, g.order[g.idx]); if (d && !d.left) break;
  }
  g.rankerId = g.order[g.idx]; g.pids = present(room).map((p) => p.id);
  g.q = drawQuestion(room); g.used.add(g.q.id); g.lastTheme = g.q.theme; g.swapsLeft = s.swaps;
  g.ranking = null; g.options = null; g.correctOpt = null; g.votes = {}; g.reveal = null;
  g.phase = "rank"; g.phaseUntil = Date.now() + s.rankTime * 1000 * TS;
  emitState(room); sendQuestion(room);
}
function sendQuestion(room) {
  const g = room.g; const d = defOf(room, g.rankerId); if (!d || !d.socketId) return;
  g.api.io.to(d.socketId).emit("ml:question", { q: { text: g.q.text, theme: g.q.theme, heat: g.q.heat }, swapsLeft: g.swapsLeft, idx: g.idx });
}
function startGuess(room, order) {
  const g = room.g, s = room.settings;
  g.ranking = order;
  const real = { id: "r", text: g.q.text, theme: g.q.theme, heat: g.q.heat, real: true };
  const decoys = drawDecoys(room, g.q);
  const opts = shuffle([real].concat(decoys.map((d, i) => ({ id: "d" + i, text: d.text, theme: d.theme, heat: d.heat }))));
  g.options = opts.map((o, i) => ({ id: "o" + i, text: o.text, theme: o.theme }));
  g.correctOpt = g.options[opts.indexOf(real)].id;
  g.votes = {}; g.phase = "guess"; g.phaseUntil = Date.now() + s.voteTime * 1000 * TS;
  emitState(room);
}
function eligible(room) { const g = room.g; return g.pids.filter((id) => id !== g.rankerId).filter((id) => { const d = defOf(room, id); return d && !d.left; }); }
function startReveal(room, skipped, why) {
  const g = room.g, s = room.settings; const gains = {}; const entry = { idx: g.idx, rankerId: g.rankerId, q: g.q.text, theme: g.q.theme, heat: g.q.heat, skipped: !!skipped };
  g.pids.forEach((id) => { gains[id] = 0; });
  if (!skipped) {
    const correct = Object.keys(g.votes).filter((id) => g.votes[id] === g.correctOpt);
    correct.forEach((id) => { gains[id] += s.scoreGuess; g.correctCount[id] = (g.correctCount[id] || 0) + 1; });
    gains[g.rankerId] += correct.length * s.scoreRanker;
    Object.keys(gains).forEach((id) => { g.scores[id] = (g.scores[id] || 0) + gains[id]; });
    Object.assign(entry, { ranking: g.ranking.slice(), voters: eligible(room).length, correct: correct.length, votes: Object.assign({}, g.votes) });
  }
  g.history.push(entry);
  g.reveal = { q: { text: g.q.text, theme: g.q.theme, heat: g.q.heat }, correct: g.correctOpt, votes: s.showVoters ? Object.assign({}, g.votes) : null, counts: countVotes(g), gains, skipped: !!skipped, why: why || "" };
  g.phase = "reveal"; g.phaseUntil = Date.now() + (skipped ? SKIP_MS : s.revealTime * 1000 * TS);
  emitState(room);
}
function countVotes(g) { const c = {}; Object.values(g.votes).forEach((o) => { c[o] = (c[o] || 0) + 1; }); return c; }

function tick(room) {
  const g = room.g; if (!g || g.over) return; const now = Date.now();
  if (g.phase === "rank") {
    const d = defOf(room, g.rankerId);
    if (!d || d.left) { room.g.api.sysChat(room, "Le joueur qui classait est parti, on passe à la suite."); return startReveal(room, true, "Le joueur a quitté la partie."); }
    if (now >= g.phaseUntil) { g.api.sysChat(room, d.name + " n'a pas fini son classement, manche annulée."); return startReveal(room, true, d.name + " n'a pas classé à temps."); }
  } else if (g.phase === "guess") {
    const el = eligible(room); const live = el.filter((id) => { const d = defOf(room, id); return d.connected; });
    const all = live.length && live.every((id) => g.votes[id]);
    if (now >= g.phaseUntil || all) startReveal(room, false);
  } else if (g.phase === "reveal") {
    if (now >= g.phaseUntil) nextRound(room);
  }
}

// ---------- fin de partie ----------
function standings(room) {
  const g = room.g;
  const rows = room.players.map((p) => ({ id: p.id, name: p.name, color: p.color, pts: g.scores[p.id] || 0, correct: g.correctCount[p.id] || 0, left: !!p.left }));
  rows.sort((a, b) => b.pts - a.pts || b.correct - a.correct);
  let rank = 0, last = null; rows.forEach((r, i) => { if (!last || r.pts !== last.pts || r.correct !== last.correct) rank = i + 1; r.rank = rank; last = r; });
  return rows;
}
function awards(room) {
  const g = room.g; const hist = g.history.filter((h) => !h.skipped && h.ranking); const out = [];
  if (!hist.length) return { awards: out, themes: [] };
  const pos = {}, cnt = {}, byTheme = {};
  hist.forEach((h) => { const n = h.ranking.length; h.ranking.forEach((id, i) => { const v = n > 1 ? i / (n - 1) : 0.5; pos[id] = (pos[id] || 0) + v; cnt[id] = (cnt[id] || 0) + 1; const t = (byTheme[h.theme] = byTheme[h.theme] || {}); t[id] = t[id] || { s: 0, n: 0 }; t[id].s += v; t[id].n++; }); });
  const avg = (id) => (cnt[id] ? pos[id] / cnt[id] : 0.5);
  const ids = Object.keys(cnt); const name = (id) => { const d = defOf(room, id); return d ? d.name : "?"; };
  if (hist.length >= 2) {
    const best = ids.slice().sort((a, b) => avg(a) - avg(b)); const worst = best.slice().reverse();
    out.push({ icon: "👑", title: "Le chouchou", id: best[0], detail: "Toujours en haut des classements" });
    if (worst[0] !== best[0]) out.push({ icon: "💀", title: "Le bouc émissaire", id: worst[0], detail: "Toujours en bas des classements" });
  }
  const cc = Object.keys(g.correctCount).sort((a, b) => g.correctCount[b] - g.correctCount[a]); if (cc.length && g.correctCount[cc[0]] > 0) out.push({ icon: "🕵️", title: "Le meilleur détective", id: cc[0], detail: g.correctCount[cc[0]] + " bonnes réponses" });
  // lisibilité de chaque classeur
  const rd = {}; hist.forEach((h) => { const r = (rd[h.rankerId] = rd[h.rankerId] || { c: 0, v: 0 }); r.c += h.correct; r.v += h.voters; });
  const rk = Object.keys(rd).filter((id) => rd[id].v > 0).sort((a, b) => rd[a].c / rd[a].v - rd[b].c / rd[b].v);
  if (rk.length > 1) { out.push({ icon: "🌫️", title: "L'énigme", id: rk[0], detail: "Ses classements ne se devinent jamais" }); const last = rk[rk.length - 1]; if (last !== rk[0]) out.push({ icon: "📖", title: "Le livre ouvert", id: last, detail: "On le lit comme dans un livre" }); }
  const themes = [];
  Object.keys(byTheme).forEach((t) => { const ids2 = Object.keys(byTheme[t]); const sc = (id) => byTheme[t][id].s / byTheme[t][id].n; const sorted = ids2.slice().sort((a, b) => sc(a) - sc(b)); const th = Rules.themeOf(t); const n = hist.filter((h) => h.theme === t).length; themes.push({ theme: t, label: th.label, icon: th.icon, rounds: n, top: sorted[0], bottom: sorted.length > 1 ? sorted[sorted.length - 1] : null }); });
  themes.sort((a, b) => b.rounds - a.rounds);
  return { awards: out, themes: themes.slice(0, 6) };
}
function finish(room, early) {
  const g = room.g; g.phase = "over"; g.over = true; if (g.timer) { clearInterval(g.timer); g.timer = null; }
  if (early) g.api.sysChat(room, "Il ne reste pas assez de joueurs, la partie s'arrête.");
  emitState(room); sendOver(room, null);
}
function overMsg(room) {
  const g = room.g; const aw = awards(room);
  return { rows: standings(room), awards: aw.awards, themes: aw.themes, history: g.history.map((h) => ({ idx: h.idx, rankerId: h.rankerId, q: h.q, theme: h.theme, heat: h.heat, skipped: h.skipped, top: h.ranking ? h.ranking[0] : null, bottom: h.ranking ? h.ranking[h.ranking.length - 1] : null, correct: h.correct, voters: h.voters })), players: room.players.map((p) => ({ id: p.id, name: p.name, color: p.color })) };
}
function sendOver(room, socket) { const m = overMsg(room); if (socket) socket.emit("ml:over", m); else room.g.api.emitAll(room, "ml:over", m); }

// ---------- état envoyé aux joueurs ----------
function publicState(room) {
  const g = room.g; const s = room.settings;
  const st = { phase: g.phase, idx: g.idx, total: g.total, rankerId: g.rankerId, pids: g.pids, phaseUntil: g.phaseUntil, now: Date.now(), scores: g.scores, voted: Object.keys(g.votes), theme: g.q ? g.q.theme : null, heat: g.q ? g.q.heat : null, swapsLeft: g.swapsLeft };
  if (g.phase === "guess" || g.phase === "reveal") { st.ranking = g.ranking; st.options = g.options; }
  if (g.phase === "reveal") st.reveal = g.reveal;
  st.showVoters = s.showVoters;
  return st;
}
function emitState(room) { const g = room.g; if (g) g.api.emitAll(room, "ml:state", publicState(room)); }
function sendTo(room, socket, p) {
  const g = room.g; if (!g) return;
  socket.emit("ml:state", publicState(room));
  if (g.phase === "rank" && p.id === g.rankerId) sendQuestion(room);
  if (g.phase === "guess" && g.votes[p.id]) socket.emit("ml:voted", { opt: g.votes[p.id] });
  if (g.phase === "over") sendOver(room, socket);
}

function bind(socket, helpers, api) {
  const { ctx, me, safe, toast } = helpers;
  const cur = () => { const room = ctx.room; const p = me(); return room && room.g && p ? { room, g: room.g, p } : null; };
  socket.on("ml:swap", safe(() => {
    const c = cur(); if (!c || c.g.phase !== "rank" || c.p.id !== c.g.rankerId) return;
    if (c.g.swapsLeft <= 0) return toast("Plus aucun changement possible pour cette manche.");
    const q = drawQuestion(c.room, new Set([c.g.q.id])); if (!q) return;
    c.g.swapsLeft--; c.g.q = q; c.g.used.add(q.id); c.g.lastTheme = q.theme; emitState(c.room); sendQuestion(c.room);
  }));
  socket.on("ml:rank", safe((d) => {
    const c = cur(); if (!c || c.g.phase !== "rank" || c.p.id !== c.g.rankerId) return;
    const order = Array.isArray(d && d.order) ? d.order.map(String) : [];
    const want = c.g.pids.filter((id) => { const x = defOf(c.room, id); return x && !x.left; });
    if (order.length !== want.length || new Set(order).size !== order.length || !order.every((id) => want.includes(id))) return toast("Classement invalide, il faut placer tout le monde, toi compris.");
    startGuess(c.room, order);
  }));
  socket.on("ml:vote", safe((d) => {
    const c = cur(); if (!c || c.g.phase !== "guess") return;
    if (c.p.id === c.g.rankerId || !c.g.pids.includes(c.p.id)) return;
    const opt = String(d && d.opt); if (!c.g.options.some((o) => o.id === opt)) return;
    c.g.votes[c.p.id] = opt; socket.emit("ml:voted", { opt }); emitState(c.room);
  }));
  socket.on("ml:next", safe(() => {
    const c = cur(); if (!c || c.g.phase !== "reveal" || !helpers.isHost()) return;
    nextRound(c.room);
  }));
  socket.on("ml:react", safe((d) => {
    const c = cur(); if (!c || !c.room.settings.reactions) return; if (!Rules.EMOJIS.includes(d && d.e)) return;
    const now = Date.now(); if (now - (c.g.lastReact[c.p.id] || 0) < 150) return; c.g.lastReact[c.p.id] = now;
    api.emitAll(c.room, "ml:react", { pid: c.p.id, e: d.e });
  }));
}
function onReconnect(room, p) { const g = room.g; if (!g) return; const s = g.api.io.sockets.sockets.get(p.socketId); if (s) sendTo(room, s, p); }
function onLeave(room, p) { const g = room.g; if (g && !room.players.some((x) => !x.isBot && !x.left)) onDestroy(room); }

module.exports = { start, bind, onReconnect, onLeave, onDestroy, canReturn: (room) => !!(room.g && room.g.over), publicState, standings };

// ============================================================
// HANDS OVER — Déroulement d'une émission
// intro, préparation (cartes et pactes), épreuve, jugement, puis sanction.
// Le serveur garde tous les secrets de chaque épreuve et n'envoie à chacun que ce qu'il peut voir.
// ============================================================
const Rules = require("./public/game/rules.js");
const { D, IDS } = require("./ho-chal.js");
const { HOST, pick } = require("./data/ho-data.js");

const TS = Math.max(0.001, Number(process.env.HO_TIME_SCALE) || 1);
const rng = Math.random;
const shuffle = (a) => { const r = a.slice(); for (let i = r.length - 1; i > 0; i--) { const j = Math.floor(rng() * (i + 1)); [r[i], r[j]] = [r[j], r[i]]; } return r; };
const pickOne = (a) => a[Math.floor(rng() * a.length)];
const byId = (room, id) => room.players.find((p) => p.id === id);
const present = (room) => room.players.filter((p) => !p.left);
const autoCtl = (p) => !p || p.isBot || p.left || !p.connected;
const CARD_IDS = Object.keys(Rules.CARDS);
const MODS = { double: { label: "Enjeu doublé", text: "Chaque main perdue compte double." }, vitesse: { label: "Temps accéléré", text: "Tout va plus vite." }, cadeau: { label: "Pluie de cartes", text: "Tout le monde pioche une carte." } };

function start(room, api) {
  const s = Rules.effective(room.settings); const ids = present(room).map((p) => p.id);
  const g = room.g = { api, s, phase: "intro", until: 0, round: 0, rounds: s.rounds, P: {}, ch: null, c: null, mem: {}, history: [], timer: null, over: false, final: null, quip: pick(HOST.intro), seq: 0, pacts: [], props: [], plays: [], used: [], res: null, mod: null, notes: [], lastChange: 0, botT: 0 };
  const teamOf = {}; if (s.teams && ids.length >= 2) shuffle(ids).forEach((id, i) => { teamOf[id] = i % 2; });
  room.players.forEach((p) => { g.P[p.id] = { hands: s.hands, max: s.hands, alive: !p.left, ghost: false, cards: [], points: 0, team: teamOf[p.id] !== undefined ? teamOf[p.id] : null, shield: 0, mark: 0, st: { wins: 0, loses: 0, played: 0, betrayals: 0, ghostWins: 0, helped: 0 } }; if (s.cards) g.P[p.id].cards.push(pickOne(CARD_IDS)); });
  g.until = Date.now() + 5500 * TS;
  api.sysChat(room, "Le plateau est prêt. Mode " + s.mode + ", " + s.hands + " main" + (s.hands > 1 ? "s" : "") + " chacun.");
  g.timer = setInterval(() => { try { tick(room); } catch (e) { console.error("tick ho", e); } }, 200);
  emitAll(room);
}
function onDestroy(room) { if (room.g && room.g.timer) { clearInterval(room.g.timer); room.g.timer = null; } }
const aliveIds = (room) => room.players.filter((p) => !p.left && room.g.P[p.id].alive).map((p) => p.id);
const ghostIds = (room) => room.players.filter((p) => !p.left && !room.g.P[p.id].alive).map((p) => p.id);
const draw = (g, id, n) => { const P = g.P[id]; for (let i = 0; i < (n || 1); i++) if (P.cards.length < 3) P.cards.push(pickOne(CARD_IDS)); };

// ---------- boucle ----------
function tick(room) {
  const g = room.g; if (!g || g.over) return; const now = Date.now();
  if (g.phase === "intro") { if (now >= g.until) nextRound(room); return; }
  if (g.phase === "prep") {
    botPrep(room, now);
    const humans = present(room).filter((p) => !autoCtl(p) && g.P[p.id].alive);
    if (now >= g.until || (humans.length && humans.every((p) => g.P[p.id].ready))) startPlay(room); return;
  }
  if (g.phase === "play") {
    const mod = D[g.ch.id]; const c = g.c; let ch = false;
    room.players.forEach((p) => { if (!autoCtl(p) || !c.part.includes(p.id)) return; const m = g.mem[p.id] || (g.mem[p.id] = {}); const a = mod.bot(c, p.id, p.isBot ? p.level : "candidat", m, now); if (a && mod.act(c, p.id, a, now)) ch = true; });
    if (mod.tick(c, now)) ch = true;
    if (mod.isDone(c, now)) return judge(room);
    if (ch || now - g.lastChange > 700) { g.lastChange = now; emitAll(room); } return;
  }
  if (g.phase === "judge") { if (now >= g.until) afterJudge(room); return; }
}

// ---------- tour ----------
function pickChallenge(room) {
  const g = room.g, s = g.s; const nA = aliveIds(room).length, nG = ghostIds(room).length;
  let pool = IDS.filter((id) => s.families.includes(D[id].family) && D[id].min <= nA + (D[id].ghostOk && s.ghosts ? nG : 0) && (nA >= 2 || id === "simon"));
  if (!pool.length) pool = IDS.filter((id) => D[id].min <= nA);
  const fresh = pool.filter((id) => !g.used.slice(-3).includes(id)); return pickOne(fresh.length ? fresh : pool);
}
function nextRound(room) {
  const g = room.g, s = g.s;
  if (g.round >= g.rounds || over(room)) return finish(room, false);
  g.round++; g.pacts = []; g.props = []; g.plays = []; g.res = null; g.notes = [];
  Object.values(g.P).forEach((P) => { P.ready = false; P.shield = 0; P.cibled = 0; P.mirror = null; P.dbl = false; });
  const id = pickChallenge(room); g.used.push(id); const def = D[id];
  g.mod = null; if (s.chaos) { const m = pickOne(Object.keys(MODS)); g.mod = m; if (m === "cadeau") aliveIds(room).forEach((x) => draw(g, x, 1)); }
  g.ch = { id, name: def.name, family: def.family, rules: def.rules };
  const speed = s.speed * (g.mod === "vitesse" ? 0.7 : 1);
  g.speed = speed; g.phase = "prep"; const useful = s.cards || s.pacts;
  g.until = Date.now() + (useful ? 11000 : 4500) * TS; g.quip = pick(HOST.next); g.c = null;
  emitAll(room);
}
function startPlay(room) {
  const g = room.g, s = g.s; const def = D[g.ch.id]; const al = aliveIds(room); const gh = def.ghostOk && s.ghosts ? ghostIds(room) : [];
  g.c = def.init(al.concat(gh), { speed: (g.speed || 1) * TS, variant: s.croco, short: s.mode === "express" || s.mode === "survie" });
  g.c.alive = al; g.mem = {}; g.phase = "play"; g.until = 0; g.lastChange = 0; emitAll(room);
  g.api.emitAll(room, "ho:go", { id: g.ch.id });
}
function judge(room) {
  const g = room.g, s = g.s; const def = D[g.ch.id]; const c = g.c; const res = def.result(c); g.res = res; const al = c.alive;
  // les fantômes qui ont gagné frappent le joueur le plus riche
  const ghosts = c.part.filter((id) => !al.includes(id)); let ghostWin = null;
  if (ghosts.length) { const best = ghosts.slice().sort((a, b) => res.scores[b] - res.scores[a])[0]; if (best && !res.losers.includes(best)) { ghostWin = best; g.P[best].st.ghostWins++; const rich = al.slice().sort((a, b) => g.P[b].hands - g.P[a].hands || rng() - 0.5)[0]; if (rich) { g.P[rich].mark++; g.notes.push("Le fantôme " + nm(room, best) + " a gagné et marque " + nm(room, rich) + " pour la prochaine sanction."); } } }
  const losers = res.losers.filter((id) => al.includes(id)); const loss = {}; const base = g.mod === "double" ? 2 : 1;
  losers.forEach((id) => { loss[id] = base; });
  losers.forEach((id) => { const P = g.P[id]; if (P.dbl) loss[id] += 2; if (P.cibled) loss[id] += P.cibled; });
  // les marques de fantômes ne comptent que pour ceux qui perdent, et se consomment à chaque sanction
  al.forEach((id) => { const P = g.P[id]; if (P.mark && loss[id]) { loss[id] += 1; g.notes.push(nm(room, id) + " perd une main de plus à cause d'un fantôme."); } if (loss[id]) P.mark = 0; });
  // miroirs
  al.forEach((id) => { const P = g.P[id]; if (P.mirror && loss[id]) { const t = P.mirror; if (al.includes(t) && t !== id) { loss[t] = (loss[t] || 0) + loss[id]; g.notes.push(nm(room, id) + " renvoie sa sanction à " + nm(room, t) + " avec le miroir."); loss[id] = 0; } } });
  // pactes
  g.pacts.forEach((pc) => {
    [[pc.a, pc.b, pc.la, pc.lb], [pc.b, pc.a, pc.lb, pc.la]].forEach(([vic, help, lv1, lh]) => {
      if (!(loss[vic] > 0) || (loss[help] || 0) > 0) return;
      if (lh) { loss[vic] -= 1; loss[help] = (loss[help] || 0) + 1; g.P[help].st.helped++; draw(g, help, 1); g.notes.push(nm(room, help) + " honore le pacte et prend une main à la place de " + nm(room, vic) + "."); }
      else { g.P[help].st.betrayals++; const vc = g.P[vic].cards; if (vc.length) { const k = Math.floor(rng() * vc.length); g.P[help].cards.push(vc.splice(k, 1)[0]); g.P[help].cards = g.P[help].cards.slice(0, 3); } g.notes.push(nm(room, help) + " trahit " + nm(room, vic) + " et lui vole une carte."); }
    });
  });
  // boucliers
  al.forEach((id) => { const P = g.P[id]; if (P.shield && loss[id] > 0) { loss[id] -= 1; P.shield = 0; g.notes.push(nm(room, id) + " est sauvé par son bouclier."); } });
  // points et cartes
  const safe = al.filter((id) => !(loss[id] > 0)); const bestId = safe.slice().sort((a, b) => res.scores[b] - res.scores[a])[0];
  al.forEach((id) => { const P = g.P[id]; if (loss[id] > 0) { P.st.loses++; P.points += 0; } else { P.points += id === bestId ? 3 : 1; if (id === bestId) { P.st.wins++; if (s.cards) draw(g, id, P.dbl ? 2 : 1); } } });
  // application
  const before = {}; al.forEach((id) => { before[id] = g.P[id].hands; });
  al.forEach((id) => { const P = g.P[id]; const l = loss[id] || 0; if (l) { P.hands = Math.max(0, P.hands - l); if (s.points) P.points -= l; } });
  const dead = al.filter((id) => g.P[id].hands <= 0);
  if (!s.points) {
    const left = al.filter((id) => g.P[id].hands > 0);
    if (!left.length && dead.length) { const keep = dead.slice().sort((a, b) => before[b] - before[a] || g.P[b].points - g.P[a].points || rng() - 0.5)[0]; g.P[keep].hands = 1; g.notes.push("Le producteur gracie " + nm(room, keep) + " pour que l'émission continue."); }
    al.forEach((id) => { const P = g.P[id]; if (P.hands <= 0) { P.alive = false; P.ghost = true; P.cards = []; g.notes.push(nm(room, id) + " perd sa dernière main et devient fantôme."); } });
  }
  const outs = {}; al.forEach((id) => { outs[id] = { before: before[id], after: g.P[id].hands, loss: loss[id] || 0, safe: !(loss[id] > 0) }; });
  g.judged = { id: g.ch.id, losers, loss: outs, scores: res.scores, reveal: res.reveal, notes: g.notes.slice(), best: bestId || null, ghostWin };
  g.history.push({ round: g.round, id: g.ch.id, name: g.ch.name, losers: losers.map((x) => nm(room, x)), best: bestId ? nm(room, bestId) : null });
  const anyDown = dead.length && !s.points; g.quip = anyDown ? pick(HOST.ghost) : losers.length ? pick(HOST.lose) : pick(HOST.none);
  g.phase = "judge"; g.until = Date.now() + 9500 * TS; emitAll(room);
}
function nm(room, id) { const p = byId(room, id); return p ? p.name : "?"; }
function afterJudge(room) {
  const g = room.g; g.judged = null; g.c = null; if (over(room) || g.round >= g.rounds) return finish(room, false);
  nextRound(room);
}
function over(room) {
  const g = room.g, s = g.s; if (s.points) return false; const al = aliveIds(room);
  if (s.teams) { const ts = new Set(al.map((id) => g.P[id].team)); return ts.size <= 1; }
  return al.length <= 1;
}

// ---------- classement final ----------
function standings(room) {
  const g = room.g, s = g.s;
  const rows = room.players.map((p) => { const P = g.P[p.id]; return { id: p.id, name: p.name, color: p.color, isBot: p.isBot, hands: P.hands, alive: P.alive, points: P.points, team: P.team, st: P.st, left: !!p.left }; });
  rows.sort((a, b) => (s.points ? b.points - a.points : (b.alive - a.alive) || b.hands - a.hands || b.points - a.points));
  let rk = 0; rows.forEach((r, i) => { const prev = rows[i - 1]; const same = prev && (s.points ? prev.points === r.points : prev.alive === r.alive && prev.hands === r.hands && prev.points === r.points); if (!same) rk = i + 1; r.rank = rk; });
  return rows;
}
function awards(rows) {
  const out = []; const best = (fn, min) => { let b = null; rows.forEach((r) => { const v = fn(r); if (v >= min && (!b || v > b.v)) b = { r, v }; }); return b; };
  const w = best((r) => r.st.wins, 1); if (w) out.push({ id: w.r.id, icon: "🏅", title: "Le chouchou du public", detail: w.v + " épreuve" + (w.v > 1 ? "s" : "") + " gagnée" + (w.v > 1 ? "s" : "") });
  const b = best((r) => r.st.betrayals, 1); if (b) out.push({ id: b.r.id, icon: "🗡️", title: "Le judas", detail: b.v + " trahison" + (b.v > 1 ? "s" : "") });
  const h = best((r) => r.st.helped, 1); if (h) out.push({ id: h.r.id, icon: "🤝", title: "Le fidèle", detail: h.v + " main" + (h.v > 1 ? "s" : "") + " prise" + (h.v > 1 ? "s" : "") + " pour un allié" });
  const gh = best((r) => r.st.ghostWins, 1); if (gh) out.push({ id: gh.r.id, icon: "👻", title: "Le fantôme farceur", detail: gh.v + " victoire" + (gh.v > 1 ? "s" : "") + " d'outre-tombe" });
  const l = best((r) => r.st.loses, 2); if (l) out.push({ id: l.r.id, icon: "🩹", title: "La main de trop", detail: l.v + " sanctions" });
  return out;
}
function finish(room, aborted) {
  const g = room.g; if (g.over) return; g.over = true; g.phase = "over"; if (g.timer) { clearInterval(g.timer); g.timer = null; }
  const rows = standings(room); let winTeam = null;
  if (g.s.teams) { const sc = [0, 0]; rows.forEach((r) => { if (r.alive) sc[r.team] += 10 + r.hands; sc[r.team] += r.points * 0.01; }); winTeam = sc[0] === sc[1] ? null : sc[0] > sc[1] ? 0 : 1; }
  g.quip = pick(HOST.end);
  g.final = { mode: g.s.mode, rows, awards: awards(rows), history: g.history, aborted: !!aborted, winTeam, teams: g.s.teams };
  emitAll(room); g.api.emitAll(room, "ho:over", g.final);
}

// ---------- cartes et pactes ----------
function playCard(room, pid, idx, target) {
  const g = room.g; const P = g.P[pid]; if (g.phase !== "prep" || !P || !P.alive || !g.s.cards) return "Pas maintenant.";
  const card = P.cards[idx]; if (!card) return "Cette carte n'existe plus."; const al = aliveIds(room);
  const needT = ["miroir", "cible", "vol"].includes(card); if (needT && (!target || target === pid || !al.includes(target))) return "Choisis un autre joueur encore en jeu.";
  if (card === "bouclier") { if (P.shield) return "Tu as déjà un bouclier."; P.shield = 1; }
  else if (card === "miroir") { if (P.mirror) return "Un miroir est déjà posé."; P.mirror = target; }
  else if (card === "cible") g.P[target].cibled = (g.P[target].cibled || 0) + 1;
  else if (card === "double") { if (P.dbl) return "Déjà joué."; P.dbl = true; }
  else if (card === "vol") { const tc = g.P[target].cards; if (!tc.length) return "Ce joueur n'a aucune carte."; const k = Math.floor(rng() * tc.length); P.cards.push(tc.splice(k, 1)[0]); }
  P.cards.splice(idx, 1); if (card === "vol" && P.cards.length > 3) P.cards.length = 3; P.st.played++; g.plays.push({ by: pid, card, target: card === "bouclier" || card === "double" ? null : target });
  g.api.sysChat(room, nm(room, pid) + " joue " + Rules.CARDS[card].name + (needT ? " sur " + nm(room, target) : "") + ".");
  return null;
}
function inPact(g, id) { return g.pacts.some((p) => p.a === id || p.b === id); }
function botPrep(room, now) {
  const g = room.g; present(room).forEach((p) => {
    if (!autoCtl(p)) return; const P = g.P[p.id]; if (!P.alive || P.ready) return; const m = g.mem[p.id] || (g.mem[p.id] = {}); if (!m.prepAt) m.prepAt = now + 1200 + rng() * 5000; if (now < m.prepAt) return;
    const L = p.isBot ? ({ figurant: 0, candidat: 1, veteran: 2 })[p.level] || 1 : 1; const al = aliveIds(room).filter((x) => x !== p.id);
    P.cards.slice().forEach((c) => { const i = P.cards.indexOf(c); if (i < 0) return; if (c === "bouclier" && (P.hands <= 1 || L === 2 || rng() < 0.4)) playCard(room, p.id, i); else if (c === "double" && L === 2 && rng() < 0.3) playCard(room, p.id, i); else if (c === "cible" && al.length && rng() < 0.7) playCard(room, p.id, i, al.slice().sort((a, b) => g.P[b].hands - g.P[a].hands)[0]); else if (c === "miroir" && al.length && rng() < 0.6) playCard(room, p.id, i, pickOne(al)); else if (c === "vol" && al.length && L >= 1 && rng() < 0.6) { const t = al.filter((x) => g.P[x].cards.length); if (t.length) playCard(room, p.id, i, pickOne(t)); } });
    if (g.s.pacts && !inPact(g, p.id) && al.length && rng() < [0.15, 0.3, 0.45][L]) { const t = pickOne(al.filter((x) => !inPact(g, x))); if (t && !g.props.some((q) => q.from === p.id)) g.props.push({ from: p.id, to: t, loyal: rng() < [0.5, 0.65, 0.4][L] }); }
    g.props.slice().forEach((q) => { if (q.to === p.id && !inPact(g, p.id) && !inPact(g, q.from)) { if (rng() < 0.55) { g.pacts.push({ a: q.from, b: p.id, la: q.loyal, lb: rng() < [0.5, 0.65, 0.4][L] }); } g.props = g.props.filter((x) => x !== q); } });
    P.ready = true; emitAll(room);
  });
}

// ---------- état envoyé ----------
function publicState(room, forId) {
  const g = room.g, s = g.s; const now = Date.now(); const P = g.P[forId] || {};
  const st = { phase: g.phase, left: g.until ? Math.max(0, g.until - now) : 0, mode: s.mode, sfx: s.sfx, round: g.round, rounds: g.rounds, quip: g.quip, you: forId, seq: ++g.seq, teams: s.teams, points: s.points, cardsOn: s.cards, pactsOn: s.pacts, modifier: g.mod ? Object.assign({ id: g.mod }, MODS[g.mod]) : null, now,
    players: room.players.map((p) => { const Q = g.P[p.id]; return { id: p.id, hands: Q.hands, max: Q.max, alive: Q.alive, points: Q.points, team: Q.team, cardsN: Q.cards.length, ready: !!Q.ready, ghost: !Q.alive, auto: autoCtl(p) && !p.isBot, pact: g.pacts.some((x) => x.a === p.id || x.b === p.id) }; }),
    me: { cards: (P.cards || []).slice(), alive: !!P.alive, shield: !!P.shield, mirror: P.mirror || null, dbl: !!P.dbl, ready: !!P.ready, props: g.props.filter((x) => x.to === forId || x.from === forId), pact: (g.pacts.find((x) => x.a === forId || x.b === forId) || null) && (() => { const x = g.pacts.find((y) => y.a === forId || y.b === forId); return { with: x.a === forId ? x.b : x.a, loyal: x.a === forId ? x.la : x.lb }; })() },
    plays: g.plays.map((x) => ({ by: x.by, card: x.card, target: x.target })), ch: g.ch };
  if (g.c && (g.phase === "play" || g.phase === "judge")) { const def = D[g.ch.id]; st.view = def.view(g.c, forId, now); st.part = g.c.part; st.amIn = g.c.part.includes(forId); }
  if (g.phase === "judge" && g.judged) st.judged = g.judged;
  return st;
}
function sendTo(room, sock, p) { try { sock.emit("ho:state", publicState(room, p.id)); } catch (e) { console.error("ho emit", e); } }
function emitAll(room) { const g = room.g; if (!g) return; room.players.forEach((p) => { if (p.isBot || !p.socketId) return; const s = g.api.io.sockets.sockets.get(p.socketId); if (s) sendTo(room, s, p); }); }

// ---------- sockets ----------
function bind(socket, helpers, api) {
  const { ctx, me, safe, toast } = helpers;
  const cur = () => { const room = ctx.room; const p = me(); return room && room.g && p ? { room, g: room.g, p } : null; };
  socket.on("ho:act", safe((d) => {
    const c = cur(); if (!c || c.g.phase !== "play" || !c.g.c || !d || typeof d !== "object") return; const def = D[c.g.ch.id];
    if (def.act(c.g.c, c.p.id, d, Date.now())) emitAll(c.room);
  }));
  socket.on("ho:card", safe((d) => { const c = cur(); if (!c) return; const err = playCard(c.room, c.p.id, +(d && d.i), d && d.target); if (err) toast(err); emitAll(c.room); }));
  socket.on("ho:pact", safe((d) => {
    const c = cur(); if (!c || c.g.phase !== "prep" || !c.g.s.pacts) return; const id = c.p.id, to = d && d.to; const al = aliveIds(c.room);
    if (!al.includes(id) || !al.includes(to) || to === id) return toast("Choisis un autre joueur encore en jeu."); if (inPact(c.g, id) || inPact(c.g, to)) return toast("L'un de vous a déjà un pacte.");
    c.g.props = c.g.props.filter((x) => x.from !== id); c.g.props.push({ from: id, to, loyal: !!(d && d.loyal) }); emitAll(c.room);
  }));
  socket.on("ho:pactans", safe((d) => {
    const c = cur(); if (!c || c.g.phase !== "prep") return; const id = c.p.id; const pr = c.g.props.find((x) => x.from === (d && d.from) && x.to === id); if (!pr) return;
    c.g.props = c.g.props.filter((x) => x !== pr); if (d.ok && !inPact(c.g, id) && !inPact(c.g, pr.from)) { c.g.pacts.push({ a: pr.from, b: id, la: pr.loyal, lb: !!d.loyal }); c.g.api.sysChat(c.room, nm(c.room, pr.from) + " et " + nm(c.room, id) + " scellent un pacte."); } emitAll(c.room);
  }));
  socket.on("ho:ready", safe(() => { const c = cur(); if (!c || c.g.phase !== "prep") return; const P = c.g.P[c.p.id]; if (!P || !P.alive) return; P.ready = true; emitAll(c.room); }));
  socket.on("ho:skip", safe(() => { const c = cur(); if (!c || !helpers.isHost()) return; if (c.g.phase === "intro") nextRound(c.room); else if (c.g.phase === "prep") startPlay(c.room); else if (c.g.phase === "judge") afterJudge(c.room); }));
}
function onReconnect(room, p) { const g = room.g; if (!g) return; const s = g.api.io.sockets.sockets.get(p.socketId); if (s) { sendTo(room, s, p); if (g.over && g.final) s.emit("ho:over", g.final); } }
function onLeave(room, p) {
  const g = room.g; if (!g) return; if (!room.players.some((x) => !x.isBot && !x.left)) return onDestroy(room);
  const P = g.P[p.id]; if (P && p.left && P.alive && (g.phase === "intro" || g.phase === "prep")) { P.alive = false; P.ghost = true; }
  if (g.phase === "prep" || g.phase === "intro") emitAll(room);
}
module.exports = { start, bind, onReconnect, onLeave, onDestroy, canReturn: (room) => !!(room.g && room.g.over), publicState, standings };

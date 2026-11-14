// ============================================================
// HANDS OVER — Déroulement d'une émission
// intro, préparation (cartes et pactes), épreuve, jugement, puis sanction.
// Le serveur garde tous les secrets de chaque épreuve et n'envoie à chacun que ce qu'il peut voir.
// ============================================================
const Rules = require("./public/game/rules.js");
const { D, IDS } = require("./ho-chal.js");
const { HOST, pick } = require("./data/ho-data.js");
const { BRIEF, extra: briefExtra } = require("./data/ho-brief.js");

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
  room.players.forEach((p) => { g.P[p.id] = { hands: s.hands, max: s.hands, alive: !p.left, ghost: false, cards: [], points: 0, team: teamOf[p.id] !== undefined ? teamOf[p.id] : null, shield: 0, mark: 0, st: { wins: 0, loses: 0, played: 0, betrayals: 0, ghostWins: 0, helped: 0, betrayed: 0, revived: 0 }, rancune: 0, intel: null, revived: false, briefOk: false }; if (s.cards) { g.P[p.id].cards.push(pickOne(CARD_IDS)); g.P[p.id].cards.push(pickOne(CARD_IDS)); } });
  g.until = 0; g.total = 0;
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
  if (g.phase === "intro") { const hu = present(room).filter((p) => !autoCtl(p)); if (hu.length === 0 || hu.every((p) => g.P[p.id].briefOk)) nextRound(room); return; }
  if (g.phase === "brief") {
    botBrief(room, now);
    const humans = present(room).filter((p) => !autoCtl(p));
    const allReady = humans.length === 0 || humans.every((p) => g.P[p.id].briefOk);
    if (allReady) leaveBrief(room); return;
  }
  if (g.phase === "prep") {
    botPrep(room, now);
    const humans = present(room).filter((p) => !autoCtl(p) && g.P[p.id].alive);
    // aucune limite de temps, on passe quand tous les humains en vie sont prêts. Sans humain en vie, quand les robots ont fini
    const botsDone = present(room).every((p) => !autoCtl(p) || !g.P[p.id].alive || g.P[p.id].ready || (g.mem[p.id] && g.mem[p.id].prepAt && now >= g.mem[p.id].prepAt));
    if (humans.length ? humans.every((p) => g.P[p.id].ready) : botsDone) startCount(room); return;
  }
  if (g.phase === "count") { if (now >= g.until) startPlay(room); return; }
  if (g.phase === "play") {
    const mod = D[g.ch.id]; const c = g.c; let ch = false;
    room.players.forEach((p) => { if (!autoCtl(p) || !c.part.includes(p.id)) return; const m = g.mem[p.id] || (g.mem[p.id] = {}); const a = mod.bot(c, p.id, p.isBot ? p.level : "candidat", m, now); if (a && mod.act(c, p.id, a, now)) { ch = true; fx(room, p.id); } });
    if (mod.tick(c, now)) ch = true; if (g.hoverDirty) { g.hoverDirty = false; ch = true; }
    if (mod.isDone(c, now)) return judge(room);
    if (ch || now - g.lastChange > 700) { g.lastChange = now; emitAll(room); } return;
  }
  if (g.phase === "judge") {
    // les robots finissent de lire au bout de quelques secondes, tout le monde prêt fait passer à la suite
    present(room).forEach((p) => { if (!autoCtl(p)) return; const P = g.P[p.id]; if (!P || P.briefOk) return; const m = g.mem[p.id] || (g.mem[p.id] = {}); if (!m.judgeAt) m.judgeAt = now + (2500 + rng() * 5500) * TS; if (now >= m.judgeAt) { P.briefOk = true; emitAll(room); } });
    const hu = present(room).filter((p) => !autoCtl(p));
    if (hu.length ? hu.every((p) => g.P[p.id].briefOk) : present(room).every((p) => g.P[p.id].briefOk)) afterJudge(room); return;
  }
}

// ---------- tour ----------
function pickChallenge(room) {
  const g = room.g, s = g.s; const nA = aliveIds(room).length, nG = ghostIds(room).length;
  let pool = IDS.filter((id) => s.families.includes(D[id].family) && D[id].min <= nA + (D[id].ghostOk && s.ghosts ? nG : 0) && (nA >= 2 || id === "simon"));
  // HO_ONLY sert seulement aux essais en local, pour forcer certaines épreuves
  const only = String(process.env.HO_ONLY || "").split(",").filter((id) => D[id] && D[id].min <= nA + nG); if (only.length) pool = only;
  if (!pool.length) pool = IDS.filter((id) => D[id].min <= nA);
  const fresh = pool.filter((id) => !g.used.slice(-3).includes(id)); return pickOne(fresh.length ? fresh : pool);
}
function nextRound(room) {
  const g = room.g, s = g.s;
  if (g.round >= g.rounds || over(room)) return finish(room, false);
  g.round++; g.pacts = []; g.props = []; g.plays = []; g.res = null; g.notes = []; g.mem = {}; g.alarm = false; g.fakes = [];
  Object.values(g.P).forEach((P) => { P.ready = false; P.shield = 0; P.cibled = 0; P.mirror = null; P.dbl = false; P.intel = null; });
  const id = pickChallenge(room); g.used.push(id); const def = D[id];
  g.mod = null; if (s.chaos) { const m = pickOne(Object.keys(MODS)); g.mod = m; if (m === "cadeau") aliveIds(room).forEach((x) => draw(g, x, 1)); }
  g.ch = { id, name: def.name, family: def.family, rules: def.rules };
  // les variantes sont tirées maintenant pour que tout le monde les lise avant de jouer
  g.pre = {}; if (id === "croco") g.pre.variant = s.croco && s.croco !== "mixte" ? s.croco : pickOne(["classique", "deux", "chaud", "mobile", "chrono"]);
  if (id === "reflex") g.pre.chair = rng() < 0.4 && aliveIds(room).length + (s.ghosts ? ghostIds(room).length : 0) >= 3;
  const speed = s.speed * (g.mod === "vitesse" ? 0.7 : 1);
  g.speed = speed; g.phase = "brief"; g.quip = pick(HOST.trial[id] && rng() < 0.8 ? HOST.trial[id] : HOST.next); g.c = null; g.alarm = false;
  const B = BRIEF[id] || { goal: "", cmds: [], lose: "", tip: "" }; const text = [def.rules, B.goal, B.lose, B.tip, briefExtra(id, g.pre)].concat((B.cmds || []).map((x) => x[1])).join(" ");
  const words = text.split(/\s+/).length; const minMs = Math.min(26000, Math.max(10000, 4500 + words * 300));
  g.briefMin = 0; g.until = 0; g.total = 0; g.briefMinMs = 0;
  Object.values(g.P).forEach((P) => { P.briefOk = false; });
  emitAll(room);
}
function leaveBrief(room) {
  const g = room.g, s = g.s; const useful = s.cards || s.pacts;
  if (useful && aliveIds(room).length >= 1) { g.phase = "prep"; g.total = 0; g.until = 0; emitAll(room); }
  else startCount(room);
}
function startCount(room) { const g = room.g; g.phase = "count"; g.until = Date.now() + 3300 * TS; g.quip = pick(HOST.count); emitAll(room); }
function botBrief(room, now) {
  const g = room.g; present(room).forEach((p) => { if (!autoCtl(p)) return; const P = g.P[p.id]; if (!P || P.briefOk) return; const m = g.mem[p.id] || (g.mem[p.id] = {}); if (!m.briefAt) m.briefAt = now + (3000 + rng() * 9000) * TS; if (now >= m.briefAt) { P.briefOk = true; emitAll(room); } });
}
function startPlay(room) {
  const g = room.g, s = g.s; const def = D[g.ch.id]; const al = aliveIds(room); const gh = def.ghostOk && s.ghosts ? ghostIds(room) : [];
  g.c = def.init(al.concat(gh), { speed: (g.speed || 1) * TS, variant: (g.pre && g.pre.variant) || s.croco, chair: g.pre ? g.pre.chair : undefined, short: s.mode === "express" || s.mode === "survie" });
  g.c.alive = al; g.mem = {}; g.phase = "play"; g.until = 0; g.lastChange = 0; emitAll(room);
  g.api.emitAll(room, "ho:go", { id: g.ch.id });
}
function judge(room) {
  const g = room.g, s = g.s; const def = D[g.ch.id]; const c = g.c; const res = def.result(c); g.res = res; const al = c.alive;
  // les fantômes qui ont gagné frappent le joueur le plus riche
  const ghosts = c.part.filter((id) => !al.includes(id)); let ghostWin = null;
  if (ghosts.length) { const best = ghosts.slice().sort((a, b) => res.scores[b] - res.scores[a])[0]; if (best && !res.losers.includes(best)) { ghostWin = best; g.P[best].st.ghostWins++; const rich = al.slice().sort((a, b) => g.P[b].hands - g.P[a].hands || rng() - 0.5)[0]; if (rich) { g.P[rich].mark++; g.notes.push("Le fantôme " + nm(room, best) + " a gagné et marque " + nm(room, rich) + " pour la prochaine sanction."); } } }
  const losers = res.losers.filter((id) => al.includes(id)); const loss = {}; const base = g.mod === "double" ? 2 : 1; const pev = [];
  losers.forEach((id) => { loss[id] = base; });
  losers.forEach((id) => { const P = g.P[id]; if (P.dbl) loss[id] += 1; if (P.cibled) { loss[id] += P.cibled; g.notes.push(nm(room, id) + " était pris pour cible et perd une main de plus."); } });
  // les marques de fantômes ne comptent que pour ceux qui perdent, et se consomment à chaque sanction
  al.forEach((id) => { const P = g.P[id]; if (P.mark && loss[id]) { loss[id] += 1; g.notes.push(nm(room, id) + " perd une main de plus à cause d'un fantôme."); } if (loss[id]) P.mark = 0; });
  // miroirs
  al.forEach((id) => { const P = g.P[id]; if (P.mirror && loss[id]) { const t = P.mirror; if (al.includes(t) && t !== id) { loss[t] = (loss[t] || 0) + loss[id]; g.notes.push(nm(room, id) + " renvoie sa sanction à " + nm(room, t) + " avec le miroir."); loss[id] = 0; } } });
  // pactes, ce qui se passe quand l'un perd et que l'autre s'en sort
  g.pacts.forEach((pc) => {
    const A = pc.a, B = pc.b; const la = pc.la, lb = pc.lb; const lA = loss[A] || 0, lB = loss[B] || 0;
    if (lA > 0 && lB > 0) { pev.push({ k: "none", a: A, b: B }); g.notes.push("Pacte entre " + nm(room, A) + " et " + nm(room, B) + ". Ils perdent tous les deux, le pacte ne sert à rien."); return; }
    if (lA === 0 && lB === 0) {
      if (la && lb) { draw(g, A, 1); draw(g, B, 1); g.P[A].points += 1; g.P[B].points += 1; pev.push({ k: "fruit", a: A, b: B }); g.notes.push("Le pacte entre " + nm(room, A) + " et " + nm(room, B) + " porte ses fruits. Deux fidèles piochent chacun une carte."); }
      else pev.push({ k: "silent", a: A, b: B });
      return;
    }
    const vic = lA > 0 ? A : B, help = lA > 0 ? B : A, loyal = lA > 0 ? lb : la;
    if (loyal) { loss[vic] -= 1; loss[help] = (loss[help] || 0) + 1; g.P[help].st.helped++; g.P[help].points += 1; draw(g, help, 1); pev.push({ k: "loyal", vic, help }); g.notes.push(nm(room, help) + " honore le pacte et prend une main à la place de " + nm(room, vic) + ". Il pioche une carte en remerciement."); }
    else {
      g.P[help].st.betrayals++; g.P[vic].st.betrayed++; loss[vic] += 1; g.P[help].rancune = Math.max(1, g.P[help].rancune); const vc = g.P[vic].cards; let stolen = null;
      if (vc.length) { const k = Math.floor(rng() * vc.length); stolen = vc.splice(k, 1)[0]; g.P[help].cards.push(stolen); g.P[help].cards = g.P[help].cards.slice(0, 3); }
      draw(g, vic, 1); pev.push({ k: "betray", vic, help, stolen });
      g.notes.push(nm(room, help) + " a trahi " + nm(room, vic) + ". " + nm(room, vic) + " perd une main de plus" + (stolen ? " et se fait voler " + Rules.CARDS[stolen].name : "") + ", mais il pioche une carte de consolation. " + nm(room, help) + " porte maintenant une rancune, sa prochaine sanction coûtera une main de plus.");
    }
  });
  // la rancune d'un traître se paie à sa prochaine sanction
  al.forEach((id) => { const P = g.P[id]; if (P.rancune && loss[id] > 0 && !pev.some((e) => e.k === "betray" && e.help === id)) { loss[id] += 1; P.rancune = 0; g.notes.push(nm(room, id) + " paie sa rancune de traître et perd une main de plus."); } });
  // boucliers
  al.forEach((id) => { const P = g.P[id]; if (P.shield && loss[id] > 0) { loss[id] -= 1; P.shield = 0; g.notes.push(nm(room, id) + " est sauvé par son bouclier."); } });
  // personne ne perd plus de trois mains d'un coup
  al.forEach((id) => { if (loss[id] > 3) loss[id] = 3; });
  // les leurres sont révélés
  (g.fakes || []).forEach((f) => g.notes.push("La carte " + Rules.CARDS[f.card].name + " de " + nm(room, f.by) + " était un leurre."));
  // points et cartes
  const safe = al.filter((id) => !(loss[id] > 0)); const bestId = safe.slice().sort((a, b) => res.scores[b] - res.scores[a])[0];
  al.forEach((id) => { const P = g.P[id]; if (loss[id] > 0) { P.st.loses++; P.points += 0; } else { P.points += id === bestId ? 3 : 1; if (id === bestId) { P.st.wins++; if (s.cards) draw(g, id, P.dbl ? 2 : 1); } } });
  // application
  const before = {}; al.forEach((id) => { before[id] = g.P[id].hands; });
  al.forEach((id) => { const P = g.P[id]; const l = loss[id] || 0; if (l) { P.hands = Math.max(0, P.hands - l); if (s.points) P.points -= l; } });
  // sursis des deux premières épreuves, personne ne tombe trop vite quand on joue à trois mains ou plus
  if (!s.points && s.hands >= 3 && g.round <= 2) al.forEach((id) => { if (g.P[id].hands <= 0) { g.P[id].hands = 1; g.notes.push(nm(room, id) + " obtient un sursis, le producteur est bon public."); } });
  const dead = al.filter((id) => g.P[id].hands <= 0);
  if (!s.points) {
    const left = al.filter((id) => g.P[id].hands > 0);
    if (!left.length && dead.length) { const keep = dead.slice().sort((a, b) => before[b] - before[a] || g.P[b].points - g.P[a].points || rng() - 0.5)[0]; g.P[keep].hands = 1; g.notes.push("Le producteur gracie " + nm(room, keep) + " pour que l'émission continue."); }
    al.forEach((id) => { const P = g.P[id]; if (P.hands <= 0) { P.alive = false; P.ghost = true; P.cards = []; g.notes.push(nm(room, id) + " perd sa dernière main et devient fantôme."); } });
  }
  // retour d'entre les morts, un fantôme qui gagne deux épreuves revient avec une main
  if (ghostWin && !s.points && g.P[ghostWin].st.ghostWins >= 2 && !g.P[ghostWin].revived) { const R = g.P[ghostWin]; R.revived = true; R.alive = true; R.ghost = false; R.hands = 1; R.cards = [pickOne(CARD_IDS)]; R.st.revived++; g.notes.push(nm(room, ghostWin) + " a gagné deux épreuves d'outre-tombe et revient parmi les vivants avec une main et une carte."); }
  const outs = {}; al.forEach((id) => { outs[id] = { before: before[id], after: g.P[id].hands, loss: loss[id] || 0, safe: !(loss[id] > 0) }; });
  g.judged = { id: g.ch.id, losers, pev, revived: ghostWin && g.P[ghostWin].alive ? ghostWin : null, loss: outs, scores: res.scores, reveal: res.reveal, notes: g.notes.slice(), best: bestId || null, ghostWin };
  g.history.push({ round: g.round, id: g.ch.id, name: g.ch.name, losers: losers.map((x) => nm(room, x)), best: bestId ? nm(room, bestId) : null });
  const anyDown = dead.length && !s.points; g.quip = anyDown ? pick(HOST.ghost) : losers.length ? pick(HOST.after[g.ch.id] && rng() < 0.6 ? HOST.after[g.ch.id] : HOST.lose) : pick(HOST.none);
  const lines = losers.length + g.notes.length + pev.length + (bestId ? 1 : 0); g.total = Math.min(45000, Math.max(16000, 9000 + lines * 3200)) * TS;
  Object.values(g.P).forEach((Q) => { Q.briefOk = false; }); g.mem = {};
  g.phase = "judge"; g.until = 0; g.total = 0; emitAll(room);
}
// petit signal visuel quand quelqu'un agit, pour que sa main ou son fantôme bouge sur le plateau
function fx(room, id) { const g = room.g; const now = Date.now(); g.fxAt = g.fxAt || {}; if (now - (g.fxAt[id] || 0) < 140) return; g.fxAt[id] = now; g.api.emitAll(room, "ho:fx", { a: id }); }
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
const FAKE_POOL = ["bouclier", "miroir", "cible", "double"];
function playCard(room, pid, idx, target) {
  const g = room.g; const P = g.P[pid]; if (g.phase !== "prep" || !P || !P.alive || !g.s.cards) return "Pas maintenant.";
  const card = P.cards[idx]; if (!card) return "Cette carte n'existe plus."; const al = aliveIds(room); const def = Rules.CARDS[card];
  if (def.target && (!target || target === pid || !al.includes(target))) return "Choisis un autre joueur encore en jeu.";
  let shown = card, shownTarget = def.target ? target : null;
  if (card === "bouclier") { if (P.shield) return "Tu as déjà un bouclier."; P.shield = 1; }
  else if (card === "miroir") { if (P.mirror) return "Un miroir est déjà posé."; P.mirror = target; }
  else if (card === "cible") g.P[target].cibled = (g.P[target].cibled || 0) + 1;
  else if (card === "double") { if (P.dbl) return "Déjà joué."; P.dbl = true; }
  else if (card === "vol") { const tc = g.P[target].cards; if (!tc.length) return "Ce joueur n'a aucune carte."; const k = Math.floor(rng() * tc.length); P.cards.push(tc.splice(k, 1)[0]); }
  else if (card === "alarme") { if (g.alarm) return "L'alarme a déjà retenti."; g.alarm = true; g.pacts = []; g.props = []; }
  else if (card === "leurre") { const fk = pickOne(FAKE_POOL); shown = fk; if (Rules.CARDS[fk].target) { const others = al.filter((x) => x !== pid); shownTarget = others.length ? pickOne(others) : null; } else shownTarget = null; g.fakes.push({ by: pid, card: fk }); }
  else if (card === "espion") { const T = g.P[target]; const pc = g.pacts.find((x) => x.a === target || x.b === target); P.intel = { target, cards: T.cards.slice(), rancune: T.rancune > 0, pact: pc ? { with: pc.a === target ? pc.b : pc.a, loyal: pc.a === target ? !!pc.la : !!pc.lb } : null }; }
  else if (card === "absolution") { if (!P.rancune && !P.mark) return "Tu ne portes aucune marque à effacer."; P.rancune = 0; P.mark = 0; }
  P.cards.splice(idx, 1); if (P.cards.length > 3) P.cards.length = 3; P.st.played++; g.plays.push({ by: pid, card: shown, target: shownTarget });
  const sd = Rules.CARDS[shown];
  g.api.sysChat(room, nm(room, pid) + " joue " + sd.name + (shownTarget ? " sur " + nm(room, shownTarget) : "") + ".");
  return null;
}
function inPact(g, id) { return g.pacts.some((p) => p.a === id || p.b === id); }
function botPrep(room, now) {
  const g = room.g; present(room).forEach((p) => {
    if (!autoCtl(p)) return; const P = g.P[p.id]; if (!P.alive || P.ready) return; const m = g.mem[p.id] || (g.mem[p.id] = {}); if (!m.prepAt) m.prepAt = now + (1500 + rng() * 6000) * TS; if (now < m.prepAt) return;
    const L = p.isBot ? ({ figurant: 0, candidat: 1, veteran: 2 })[p.level] || 1 : 1; const al = aliveIds(room).filter((x) => x !== p.id);
    const weakest = () => al.slice().sort((a, b) => g.P[a].hands - g.P[b].hands || rng() - 0.5)[0];
    P.cards.slice().forEach((c) => {
      const i = P.cards.indexOf(c); if (i < 0) return;
      if (c === "bouclier" && (P.hands <= 1 || L === 2 || rng() < 0.4)) playCard(room, p.id, i);
      else if (c === "double" && L === 2 && rng() < 0.3) playCard(room, p.id, i);
      else if (c === "cible" && al.length && rng() < 0.7) playCard(room, p.id, i, L ? weakest() : pickOne(al));
      else if (c === "miroir" && al.length && rng() < 0.5) playCard(room, p.id, i, pickOne(al));
      else if (c === "vol" && al.length && P.cards.length < 3 && rng() < 0.6) { const rich = al.filter((x) => g.P[x].cards.length); if (rich.length) playCard(room, p.id, i, pickOne(rich)); }
      else if (c === "alarme" && !g.alarm && (g.pacts.length || g.props.length) && !inPact(g, p.id) && rng() < 0.5) playCard(room, p.id, i);
      else if (c === "leurre" && rng() < 0.4) playCard(room, p.id, i);
      else if (c === "espion" && al.length && rng() < 0.3) playCard(room, p.id, i, pickOne(al));
      else if (c === "absolution" && (P.rancune || P.mark)) playCard(room, p.id, i);
    });
    if (g.s.pacts && !g.alarm && !inPact(g, p.id) && al.length && rng() < [0.15, 0.3, 0.45][L]) {
      const cand = al.filter((x) => !inPact(g, x) && !(g.P[x].rancune && rng() < 0.7)); const t = cand.length ? pickOne(cand) : null;
      if (t && !g.props.some((q) => q.from === p.id)) g.props.push({ from: p.id, to: t, loyal: P.rancune ? true : rng() < [0.5, 0.65, 0.4][L] });
    }
    g.props.slice().forEach((q) => {
      if (q.to === p.id && !inPact(g, p.id) && !inPact(g, q.from)) {
        const trust = g.P[q.from].rancune ? 0.25 : 0.55;
        if (!g.alarm && rng() < trust) { g.pacts.push({ a: q.from, b: p.id, la: q.loyal, lb: P.rancune ? true : rng() < [0.5, 0.65, 0.4][L] }); g.api.sysChat(room, "Un pacte secret vient d'être scellé."); }
        g.props = g.props.filter((x) => x !== q);
      }
    });
    P.ready = true; emitAll(room);
  });
}

// ---------- état envoyé ----------
function publicState(room, forId) {
  const g = room.g, s = g.s; const now = Date.now(); const P = g.P[forId] || {};
  const st = { phase: g.phase, left: g.until ? Math.max(0, g.until - now) : 0, mode: s.mode, sfx: s.sfx, countTotal: 3300 * TS, total: g.total || 0, round: g.round, rounds: g.rounds, quip: g.quip, you: forId, seq: ++g.seq, teams: s.teams, points: s.points, cardsOn: s.cards, pactsOn: s.pacts, modifier: g.mod ? Object.assign({ id: g.mod }, MODS[g.mod]) : null, now,
    players: room.players.map((p) => { const Q = g.P[p.id]; return { id: p.id, hands: Q.hands, max: Q.max, alive: Q.alive, points: Q.points, team: Q.team, cardsN: Q.cards.length, ready: !!Q.ready, read: !!Q.briefOk, ghost: !Q.alive, rancune: Q.rancune > 0, mark: Q.mark > 0, revived: !!Q.revived, auto: autoCtl(p) && !p.isBot, pact: g.pacts.some((x) => x.a === p.id || x.b === p.id) }; }),
    me: { cards: (P.cards || []).slice(), alive: !!P.alive, shield: !!P.shield, mirror: P.mirror || null, dbl: !!P.dbl, intel: P.intel || null, rancune: P.rancune | 0, ready: !!P.ready, read: !!P.briefOk, props: g.props.filter((x) => x.to === forId || x.from === forId), pact: (g.pacts.find((x) => x.a === forId || x.b === forId) || null) && (() => { const x = g.pacts.find((y) => y.a === forId || y.b === forId); return { with: x.a === forId ? x.b : x.a, loyal: x.a === forId ? x.la : x.lb }; })() },
    plays: g.plays.map((x) => ({ by: x.by, card: x.card, target: x.target })), ch: g.ch, alarm: !!g.alarm };
  if (g.ch && (g.phase === "brief" || g.phase === "prep" || g.phase === "count" || g.phase === "play")) { const B = BRIEF[g.ch.id] || {}; st.brief = { icon: B.icon || "🖐️", goal: B.goal || "", cmds: B.cmds || [], lose: B.lose || "", tip: B.tip || "", extra: briefExtra(g.ch.id, g.pre), minLeft: 0, minTotal: g.briefMinMs || 0 }; }
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
    if (def.act(c.g.c, c.p.id, d, Date.now())) { emitAll(c.room); fx(c.room, c.p.id); }
  }));
  // hésitations visibles, le code qu'on compose ou le joueur qu'on survole
  socket.on("ho:hover", safe((d) => {
    const c = cur(); if (!c || c.g.phase !== "play" || !c.g.c || !d || typeof d !== "object") return; const def = D[c.g.ch.id]; if (!def.hover) return;
    const now = Date.now(); if (!def.hover(c.g.c, c.p.id, d, now)) return;
    if (now - (c.g.hoverAt || 0) > 120) { c.g.hoverAt = now; emitAll(c.room); } else c.g.hoverDirty = true;
  }));
  socket.on("ho:card", safe((d) => { const c = cur(); if (!c) return; const err = playCard(c.room, c.p.id, +(d && d.i), d && d.target); if (err) toast(err); emitAll(c.room); }));
  socket.on("ho:pact", safe((d) => {
    const c = cur(); if (!c || c.g.phase !== "prep" || !c.g.s.pacts) return; if (c.g.alarm) return toast("L'alarme a retenti, plus aucun pacte ce tour."); const id = c.p.id, to = d && d.to; const al = aliveIds(c.room);
    if (!al.includes(id) || !al.includes(to) || to === id) return toast("Choisis un autre joueur encore en jeu."); if (inPact(c.g, id) || inPact(c.g, to)) return toast("L'un de vous a déjà un pacte.");
    c.g.props = c.g.props.filter((x) => x.from !== id); c.g.props.push({ from: id, to, loyal: !!(d && d.loyal) }); emitAll(c.room);
  }));
  socket.on("ho:pactans", safe((d) => {
    const c = cur(); if (!c || c.g.phase !== "prep" || c.g.alarm) return; const id = c.p.id; const pr = c.g.props.find((x) => x.from === (d && d.from) && x.to === id); if (!pr) return;
    c.g.props = c.g.props.filter((x) => x !== pr); if (d.ok && !inPact(c.g, id) && !inPact(c.g, pr.from)) { c.g.pacts.push({ a: pr.from, b: id, la: pr.loyal, lb: !!d.loyal }); c.g.api.sysChat(c.room, "Un pacte secret vient d'être scellé."); } emitAll(c.room);
  }));
  socket.on("ho:ready", safe(() => {
    const c = cur(); if (!c) return; const P = c.g.P[c.p.id]; if (!P) return;
    if (c.g.phase === "brief" || c.g.phase === "intro" || c.g.phase === "judge") { P.briefOk = true; emitAll(c.room); }
    else if (c.g.phase === "prep" && P.alive) { P.ready = true; emitAll(c.room); }
  }));
  socket.on("ho:skip", safe(() => {
    const c = cur(); if (!c || !helpers.isHost()) return; const now = Date.now();
    if (c.g.phase === "intro") nextRound(c.room);
    else if (c.g.phase === "brief") { leaveBrief(c.room); }
    else if (c.g.phase === "prep") startCount(c.room);
    else if (c.g.phase === "judge") afterJudge(c.room);
  }));
}
function onReconnect(room, p) { const g = room.g; if (!g) return; const s = g.api.io.sockets.sockets.get(p.socketId); if (s) { sendTo(room, s, p); if (g.over && g.final) s.emit("ho:over", g.final); } }
function onLeave(room, p) {
  const g = room.g; if (!g) return; if (!room.players.some((x) => !x.isBot && !x.left)) return onDestroy(room);
  const P = g.P[p.id]; if (P && p.left && P.alive && (g.phase === "intro" || g.phase === "prep")) { P.alive = false; P.ghost = true; }
  if (g.phase === "prep" || g.phase === "intro") emitAll(room);
}
module.exports = { start, bind, onReconnect, onLeave, onDestroy, canReturn: (room) => !!(room.g && room.g.over), publicState, standings };

// ============================================================
// SUCRÉ OU SALÉ — Déroulement d'une partie côté serveur
// Un Extralucide connaît un mot secret, il répond à des dilemmes, les enquêteurs éliminent.
// Le serveur garde le mot secret et ne l'envoie qu'à l'Extralucide, puis à la révélation.
// ============================================================
const Rules = require("./public/game/rules.js");
const { WORDS } = require("./data/words.js");
const { DILEMMAS } = require("./data/dilemmas.js");
const Bot = require("./sos-bot.js");

const TS = Math.max(0.001, Number(process.env.SOS_TIME_SCALE) || 1);
const rng = Math.random;
const shuffle = (a) => { const r = a.slice(); for (let i = r.length - 1; i > 0; i--) { const j = Math.floor(rng() * (i + 1)); [r[i], r[j]] = [r[j], r[i]]; } return r; };
const defOf = (room, id) => room.players.find((p) => p.id === id);
const present = (room) => room.players.filter((p) => !p.left);
const active = (p) => p && !p.left && (p.isBot || p.connected);
const wordById = (room, id) => { const r = room.g && room.g.r; const w = r && r.grid.find((x) => x.id === id); return w || WORDS[id] || { name: "?" }; };
const NAME_BASE = 10000;
const TRAITS = ["drole", "calme", "energie", "serieux", "mignon", "bruyant", "fete", "paresseux", "intelligent", "aventure", "courage", "doux", "agressif", "rapide", "romantique", "propre", "crade", "famille", "sage", "stress", "musique", "sport", "jeune", "adulte", "celebre", "luxe", "secret", "nature"];
const dilById = (id) => DILEMMAS[id];
const PICK_MS = 30000 * TS, RESULT_MS = 4200 * TS, REVEAL_MS = 16000 * TS, VERDICT_MS = 30000 * TS;

const EVENTS = {
  inverse: { label: "Dilemme inversé", text: "L'Extralucide désigne cette fois le côté qui lui ressemble le moins." },
  bonus: { label: "Dilemme bonus", text: "L'Extralucide répond à deux dilemmes d'un coup." },
  sablier: { label: "Sablier", text: "La discussion est deux fois plus courte." },
  revient: { label: "Un mot revient", text: "Un mot éliminé retourne sur la grille." },
};

function start(room, api) {
  const s = Rules.effective(room.settings); const ids = present(room).map((p) => p.id);
  const nRounds = s.rounds > 0 ? s.rounds : Math.min(8, Math.max(2, ids.length));
  let order = []; let perm = shuffle(ids);
  while (order.length < nRounds) {
    if (!perm.length) { perm = shuffle(ids); if (ids.length > 1 && perm[0] === order[order.length - 1]) perm.push(perm.shift()); }
    order.push(perm.shift());
  }
  const g = room.g = { api, s, order, round: -1, rounds: nRounds, phase: "wait", phaseUntil: 0, phaseTotal: 1, scores: {}, stats: {}, usedWords: new Set(), usedDil: new Set(), history: [], timer: null, over: false, mem: {}, seq: 0 };
  room.players.forEach((p) => { g.scores[p.id] = 0; g.stats[p.id] = { correct: 0, busts: 0, extraOk: 0, extraRounds: 0, fast: 0 }; });
  api.sysChat(room, "C'est parti pour " + nRounds + " manche" + (nRounds > 1 ? "s" : "") + ". Un Extralucide, un mot secret, des dilemmes.");
  g.timer = setInterval(() => { try { tick(room); } catch (e) { console.error("tick sos", e); } }, 250);
  nextRound(room);
}
function onDestroy(room) { if (room.g && room.g.timer) { clearInterval(room.g.timer); room.g.timer = null; } }

// ---------- préparation d'une manche ----------
function playerWord(room, p) {
  const g = room.g; g.traits = g.traits || {};
  if (!g.traits[p.id]) { const t = shuffle(TRAITS).slice(0, 6); g.traits[p.id] = t; }
  const t = g.traits[p.id];
  return { id: NAME_BASE + room.players.indexOf(p), name: p.name, cat: "prenom", tags: t, tagset: new Set(t), player: p.id };
}
function buildGrid(room) {
  const g = room.g, s = g.s; const cats = new Set(s.wcats);
  // au moins deux prénoms de joueurs, parfois trois, jamais mis en avant
  let nm = [];
  if (s.names) {
    const pp = shuffle(present(room)); const n = pp.length >= 5 && rng() < 0.3 ? 3 : Math.min(2, pp.length);
    nm = pp.slice(0, n).map((p) => playerWord(room, p));
  }
  let pool = WORDS.filter((w) => cats.has(w.cat) && !g.usedWords.has(w.id) && !nm.some((x) => x.name.toLowerCase() === w.name.toLowerCase()));
  if (pool.length < s.grid + 2) { g.usedWords.clear(); pool = WORDS.filter((w) => cats.has(w.cat) && !nm.some((x) => x.name.toLowerCase() === w.name.toLowerCase())); }
  const picked = shuffle(pool).slice(0, Math.max(2, s.grid - nm.length));
  picked.forEach((w) => g.usedWords.add(w.id));
  return shuffle(picked.concat(nm));
}
function nextRound(room) {
  const g = room.g, s = g.s;
  for (;;) {
    g.round++;
    if (g.round >= g.rounds) return finish(room, false);
    const ex = defOf(room, g.order[g.round]);
    if (ex && !ex.left) break;
    if (present(room).length < 2) return finish(room, true);
  }
  if (present(room).length < 2) return finish(room, true);
  const extraId = g.order[g.round];
  const guessers = present(room).filter((p) => p.id !== extraId).map((p) => p.id);
  const grid = buildGrid(room);
  const cand = grid.filter((w) => w.player !== extraId);
  const secret = cand[Math.floor(rng() * cand.length)];
  const quota = Rules.quotaFor(s.grid, s.steps);
  // groupes d'enquêteurs
  let groups = [];
  let play = s.play; if (play === "equipes" && guessers.length < 2) play = "coop";
  if (play === "solo") groups = guessers.map((id) => ({ members: [id] }));
  else if (play === "equipes") { const sh = shuffle(guessers); groups = [{ members: [] }, { members: [] }]; sh.forEach((id, i) => groups[i % 2].members.push(id)); }
  else groups = [{ members: guessers.slice() }];
  groups.forEach((gr, i) => { gr.id = i; gr.elim = new Set(); gr.marks = {}; gr.validated = new Set(); gr.finals = {}; gr.busted = false; gr.bustStep = -1; gr.early = {}; gr.pins = new Set(); gr.notes = []; gr.earlyLeft = 0; gr.earlyStep = -1; gr.final = null; gr.ok = null; gr.lockedAt = 0; gr.timedOut = false; });
  g.r = { extraId, grid, secret, quota, groups, play, step: -1, picks: [], hand: [], event: null, jokerUsed: false, rerolled: false, needPicks: 1, steps: [], elimLog: [], timerScale: 1, reveal: null, botAt: {}, resultInfo: null };
  g.mem = {};
  groups.forEach((gr) => gr.members.forEach((id) => { const p = defOf(room, id); if (p && p.isBot) g.mem[id] = Bot.newMemory(p.level); }));
  g.stats[extraId].extraRounds++;
  const ex = defOf(room, extraId);
  g.api.sysChat(room, "Manche " + (g.round + 1) + " sur " + g.rounds + ". " + (ex ? ex.name : "Quelqu'un") + " est l'Extralucide.");
  nextStep(room);
}
function aliveFor(r, gr) { return r.grid.filter((w) => !gr.elim.has(w.id)); }
function aliveAny(r) { return r.grid.filter((w) => r.groups.some((gr) => !gr.busted && !gr.elim.has(w.id))); }
function liveGroups(r) { return r.groups.filter((gr) => !gr.busted); }
function openGroups(r) { return r.groups.filter((gr) => !gr.busted && gr.final === null); }

// ---------- tirage des cartes ----------
// la main est tirée au hasard, le mot secret n'entre jamais dans le choix
function drawHand(room) {
  const g = room.g, s = g.s, r = g.r;
  const cats = new Set(s.dcats); const D = s.difficulty;
  const LW = D === 1 ? [6, 3, 0.3] : D === 2 ? [3, 4, 2] : [0.5, 3, 6];
  const names = r.grid.some((w) => w.player);
  const catW = (c) => { let w = s.chaosMix ? (c === "A" || c === "D" ? 5 : 0.6) : 1; if (c === "P") w *= names ? 2.2 : 0.35; return w; };
  let pool = DILEMMAS.filter((d) => cats.has(d.cat) && !g.usedDil.has(d.id));
  if (pool.length < s.hand * 4) { g.usedDil.clear(); pool = DILEMMAS.filter((d) => cats.has(d.cat)); }
  const hand = [];
  while (hand.length < s.hand && pool.length) {
    const weights = pool.map((d) => LW[d.lvl - 1] * catW(d.cat) + 0.01);
    let x = rng() * weights.reduce((a, b) => a + b, 0), idx = pool.length - 1;
    for (let i = 0; i < weights.length; i++) { x -= weights[i]; if (x <= 0) { idx = i; break; } }
    hand.push(pool[idx]); pool.splice(idx, 1);
  }
  return hand;
}

// ---------- étapes ----------
function nextStep(room) {
  const g = room.g, r = g.r, s = g.s;
  r.step++;
  // fin de partie de manche si plus de dilemmes ou si tout le monde est au clair
  const liv = openGroups(r);
  if (!liv.length) return startReveal(room);
  if (r.step >= s.steps || liv.every((gr) => aliveFor(r, gr).length <= 1)) return startVerdict(room);
  r.picks = []; r.event = null; r.needPicks = 1; r.timerScale = 1;
  const rate = s.events === "often" ? 0.5 : s.events === "rare" ? 0.2 : 0;
  if (rate > 0 && rng() < rate && r.step > 0) {
    const opts = ["inverse", "sablier"]; if (s.hand >= 2) opts.push("bonus");
    if (r.groups.some((gr) => !gr.busted && gr.final === null && gr.elim.size > 0)) opts.push("revient");
    const e = opts[Math.floor(rng() * opts.length)]; r.event = { id: e, label: EVENTS[e].label, text: EVENTS[e].text };
    if (e === "bonus") r.needPicks = 2;
    if (e === "sablier") r.timerScale = 0.5;
    if (e === "revient") {
      const un = []; r.groups.forEach((gr) => { if (!gr.busted && gr.final === null) gr.elim.forEach((id) => { if (!un.includes(id)) un.push(id); }); });
      if (un.length) { const w = un[Math.floor(rng() * un.length)]; r.groups.forEach((gr) => gr.elim.delete(w)); r.event.word = wordById(room, w).name; r.event.text = "Le mot « " + wordById(room, w).name + " » revient sur la grille."; }
    }
  }
  startPick(room);
}
function startPick(room) {
  const g = room.g, r = g.r;
  r.hand = drawHand(room);
  r.hand.forEach((d) => g.usedDil.add(d.id));
  setPhase(room, "pick", PICK_MS);
  scheduleBot(room, true);
  emitAll(room);
}
function setPhase(room, ph, ms) { const g = room.g; g.phase = ph; g.phaseTotal = Math.max(1000, ms); g.phaseUntil = Date.now() + ms; g.seq++; }

function doPick(room, cardId, side, auto) {
  const g = room.g, r = g.r; if (g.phase !== "pick") return false;
  const d = r.hand.find((h) => h.id === cardId); if (!d) return false;
  if (side !== "A" && side !== "B" && side !== "both" && side !== "none") return false;
  if ((side === "both" || side === "none")) { if (!g.s.joker || r.jokerUsed) return false; r.jokerUsed = true; }
  const inv = !!(r.event && r.event.id === "inverse");
  let meaning = side; if (inv && (side === "A" || side === "B")) meaning = side === "A" ? "B" : "A";
  r.picks.push({ id: d.id, a: d.a, b: d.b, side, meaning, inv, auto: !!auto });
  g.usedDil.add(d.id);
  // observation des robots enquêteurs
  const alive = aliveAny(r);
  Object.keys(g.mem).forEach((pid) => Bot.observe(g.mem[pid], d, meaning, alive));
  r.botAt = {};
  if (r.picks.length < r.needPicks) {
    r.hand = drawHand(room); r.hand.forEach((x) => g.usedDil.add(x.id));
    g.seq++; scheduleBot(room, true); emitAll(room); return true;
  }
  r.steps.push({ step: r.step, picks: r.picks.map((p) => ({ a: p.a, b: p.b, side: p.side, meaning: p.meaning, inv: p.inv })), event: r.event ? r.event.label : null });
  r.groups.forEach((gr) => { gr.marks = {}; gr.validated = new Set(); gr.early = {}; });
  const talk = Math.round(g.s.talk * 1000 * r.timerScale * TS * (r.needPicks > 1 ? 1.25 : 1));
  setPhase(room, "elim", talk);
  scheduleBot(room, false);
  emitAll(room); return true;
}
function reroll(room) {
  const g = room.g, r = g.r; if (g.phase !== "pick" || !g.s.reroll || r.rerolled || r.picks.length) return false;
  r.rerolled = true; r.hand = drawHand(room); r.hand.forEach((d) => g.usedDil.add(d.id)); g.seq++;
  return true;
}
function autoPick(room, timeout) {
  const g = room.g, r = g.r; const ex = defOf(room, r.extraId);
  const lvl = ex && ex.isBot ? ex.level : "fute";
  const inv = !!(r.event && r.event.id === "inverse");
  // un robot sans rien d'exploitable relance sa main quand il le peut
  if (!timeout && ex && ex.isBot && g.s.reroll && !r.rerolled && !r.picks.length && Bot.handQuality(lvl, r.hand, r.secret) < 1) { if (reroll(room)) { scheduleBot(room, true); emitAll(room); return; } }
  const c = Bot.chooseCard(lvl, r.hand, r.secret, aliveAny(r), g.s.joker && !r.jokerUsed, inv);
  doPick(room, c.card, c.side, !(ex && ex.isBot));
}

// ---------- élimination ----------
function members(room, gr) { return gr.members.map((id) => defOf(room, id)).filter((p) => p && !p.left); }
function activeMembers(room, gr) { return members(room, gr).filter(active); }
function mark(room, gr, pid, wordId) {
  const g = room.g, r = g.r; if (g.phase !== "elim" || gr.busted || gr.final !== null || gr.elim.has(wordId) || gr.validated.has(pid)) return false;
  if (!gr.members.includes(pid)) return false; if (!r.grid.some((w) => w.id === wordId)) return false;
  const mine = Object.keys(gr.marks).filter((k) => gr.marks[k].has(pid)).length;
  const has = gr.marks[wordId] && gr.marks[wordId].has(pid);
  if (has) { gr.marks[wordId].delete(pid); if (!gr.marks[wordId].size) delete gr.marks[wordId]; return true; }
  if (mine >= r.quota) return false;
  (gr.marks[wordId] = gr.marks[wordId] || new Set()).add(pid); return true;
}
function resolveGroup(room, gr) {
  const g = room.g, r = g.r; const act = activeMembers(room, gr); const size = Math.max(1, act.length);
  const rule = r.play === "solo" ? "un" : g.s.elim;
  const cands = Object.keys(gr.marks).map((k) => ({ id: +k, n: gr.marks[k].size, t: rng() })).filter((c) => !gr.elim.has(c.id)).filter((c) => rule === "un" ? c.n >= 1 : rule === "unanimite" ? c.n >= size : c.n > size / 2);
  cands.sort((a, b) => b.n - a.n || a.t - b.t);
  const out = cands.slice(0, r.quota).map((c) => c.id);
  out.forEach((id) => gr.elim.add(id));
  if (out.includes(r.secret.id)) { gr.busted = true; gr.bustStep = r.step; gr.ok = false; members(room, gr).forEach((p) => { g.stats[p.id].busts++; }); }
  return out;
}
function endElim(room) {
  const g = room.g, r = g.r;
  const info = r.groups.map((gr) => {
    if (gr.busted) return { id: gr.id, elim: [], busted: true };
    if (gr.final !== null) return { id: gr.id, elim: [], locked: true };
    const contested = Object.keys(gr.marks).map(Number).filter((id) => !gr.elim.has(id));
    const out = resolveGroup(room, gr);
    out.forEach((id) => gr.pins.delete(id));
    gr.notes.push({ step: r.step, elim: out, contested: contested.filter((id) => !out.includes(id)), pins: Array.from(gr.pins) });
    return { id: gr.id, elim: out, busted: gr.busted };
  });
  r.resultInfo = { step: r.step, groups: info };
  setPhase(room, "result", RESULT_MS); emitAll(room);
}
// ---------- trouver le mot avant la fin des dilemmes ----------
function earlyNeed(room, gr) {
  const g = room.g, r = g.r; const size = Math.max(1, activeMembers(room, gr).length);
  return r.play === "solo" ? 1 : g.s.elim === "un" ? 1 : g.s.elim === "unanimite" ? size : Math.floor(size / 2) + 1;
}
function earlyVote(room, gr, pid, wordId) {
  const g = room.g, r = g.r; if (g.phase !== "elim" || gr.busted || gr.final !== null || !gr.members.includes(pid)) return false;
  if (wordId === -1) { delete gr.early[pid]; return true; }
  if (gr.elim.has(wordId) || !r.grid.some((w) => w.id === wordId)) return false;
  gr.early[pid] = wordId; gr.validated.add(pid);
  checkEarly(room, gr); return true;
}
function checkEarly(room, gr) {
  const g = room.g, r = g.r; if (gr.final !== null) return;
  const act = activeMembers(room, gr).map((p) => p.id); const tally = {};
  act.forEach((id) => { const w = gr.early[id]; if (w !== undefined) tally[w] = (tally[w] || 0) + 1; });
  const need = earlyNeed(room, gr); const hit = Object.keys(tally).filter((k) => tally[k] >= need);
  if (hit.length !== 1) return;
  const w = +hit[0];
  gr.final = w; gr.ok = w === r.secret.id; gr.lockedAt = Date.now(); gr.earlyStep = r.step; gr.earlyLeft = Math.max(0, g.s.steps - r.step - 1);
  g.api.sysChat(room, (r.play === "coop" ? "Le groupe" : "Une équipe") + " annonce son mot en avance, il reste " + gr.earlyLeft + " dilemme" + (gr.earlyLeft > 1 ? "s" : "") + " non joué" + (gr.earlyLeft > 1 ? "s" : "") + ".");
  if (!openGroups(r).length) return startReveal(room);
  emitAll(room); maybeEndElim(room);
}
function afterResult(room) {
  const g = room.g, r = g.r;
  if (!liveGroups(r).length) return startReveal(room);
  nextStep(room);
}

// ---------- verdict ----------
function startVerdict(room) {
  const g = room.g, r = g.r;
  r.groups.forEach((gr) => { gr.validated = new Set(); gr.finals = {}; });
  // un seul mot restant, la réponse est automatique
  openGroups(r).forEach((gr) => { const al = aliveFor(r, gr); if (al.length === 1) { gr.final = al[0].id; gr.ok = true; gr.lockedAt = Date.now(); gr.auto = true; gr.earlyLeft = Math.max(0, g.s.steps - r.step); gr.earlyStep = r.step; } });
  if (liveGroups(r).every((gr) => gr.final !== null)) return startReveal(room);
  setPhase(room, "verdict", VERDICT_MS);
  scheduleBot(room, false, true);
  emitAll(room);
}
function final(room, gr, pid, wordId) {
  const g = room.g, r = g.r; if (g.phase !== "verdict" || gr.busted || gr.final !== null) return false;
  if (!gr.members.includes(pid)) return false;
  if (gr.elim.has(wordId) || !r.grid.some((w) => w.id === wordId)) return false;
  gr.finals[pid] = wordId; return true;
}
function resolveVerdict(room, gr) {
  const g = room.g, r = g.r; if (gr.busted || gr.final !== null) return;
  const tally = {}; Object.keys(gr.finals).forEach((pid) => { const w = gr.finals[pid]; tally[w] = (tally[w] || 0) + 1; });
  const ids = Object.keys(tally); if (!ids.length) { gr.final = -1; gr.ok = false; gr.timedOut = true; return; }
  const max = Math.max.apply(null, ids.map((k) => tally[k])); const top = ids.filter((k) => tally[k] === max);
  gr.final = +top[Math.floor(rng() * top.length)]; gr.ok = gr.final === r.secret.id; gr.lockedAt = Date.now();
}
function maybeEndVerdict(room) {
  const g = room.g, r = g.r;
  const open = liveGroups(r).filter((gr) => gr.final === null);
  const ready = open.every((gr) => { const act = activeMembers(room, gr); return !act.length || act.every((p) => gr.finals[p.id] !== undefined); });
  if (ready) { open.forEach((gr) => resolveVerdict(room, gr)); startReveal(room); }
}

// ---------- révélation et points ----------
function startReveal(room) {
  const g = room.g, r = g.r, s = g.s;
  const mult = g.round === g.rounds - 1 ? s.finalMult : 1;
  const gains = {}; room.players.forEach((p) => { gains[p.id] = 0; });
  const bonusOn = s.bonusEarly !== false;
  const gs = r.groups.map((gr) => { const ok = gr.ok === true; return { id: gr.id, members: gr.members.slice(), ok, busted: gr.busted, final: gr.final, timedOut: gr.timedOut, auto: !!gr.auto, left: ok && bonusOn ? Math.min(3, gr.earlyLeft || 0) : 0, early: gr.earlyStep >= 0 && !gr.auto }; });
  const succ = gs.filter((x) => x.ok);
  if (r.play === "coop") {
    if (succ.length) { gs[0].members.forEach((id) => { gains[id] += 3 + gs[0].left; g.stats[id].correct++; }); gains[r.extraId] += 3; g.stats[r.extraId].extraOk++; }
  } else if (r.play === "solo") {
    succ.forEach((x) => { x.members.forEach((id) => { gains[id] += 3 + x.left; g.stats[id].correct++; }); });
    gains[r.extraId] += succ.length; if (succ.length) g.stats[r.extraId].extraOk++;
    if (succ.length >= 1 && succ.length < gs.length) gains[r.extraId] += 2;
  } else {
    succ.forEach((x) => { x.members.forEach((id) => { gains[id] += 3 + x.left + (succ.length === 1 ? 1 : 0); g.stats[id].correct++; }); });
    gains[r.extraId] += succ.length + (succ.length === 1 ? 1 : 0); if (succ.length) g.stats[r.extraId].extraOk++;
  }
  gs.forEach((x) => { if (x.ok && x.left) x.members.forEach((id) => { g.stats[id].fast = (g.stats[id].fast || 0) + 1; }); });
  Object.keys(gains).forEach((id) => { gains[id] *= mult; g.scores[id] = (g.scores[id] || 0) + gains[id]; });
  const ex = defOf(room, r.extraId);
  r.reveal = { secret: { id: r.secret.id, name: r.secret.name }, groups: gs, gains, mult, steps: r.steps, extra: r.extraId, extraName: ex ? ex.name : "?", elimBy: r.groups.map((gr) => Array.from(gr.elim)) };
  g.history.push({ round: g.round, extra: r.extraId, word: r.secret.name, ok: succ.length > 0, groups: gs.length, okGroups: succ.length });
  setPhase(room, "reveal", REVEAL_MS); emitAll(room);
  const names = succ.flatMap((x) => x.members.map((id) => (defOf(room, id) || {}).name)).filter(Boolean);
  g.api.sysChat(room, "Le mot était « " + r.secret.name + " ». " + (succ.length ? "Trouvé par " + names.join(", ") + "." : "Personne ne l'a trouvé."));
}
function standings(room) {
  const g = room.g; const rows = room.players.map((p) => ({ id: p.id, name: p.name, color: p.color, left: !!p.left, pts: g.scores[p.id] || 0, correct: g.stats[p.id].correct, busts: g.stats[p.id].busts, extraOk: g.stats[p.id].extraOk, extraRounds: g.stats[p.id].extraRounds, fast: g.stats[p.id].fast || 0 }));
  rows.sort((a, b) => b.pts - a.pts || b.correct - a.correct || a.busts - b.busts);
  let rank = 0, prev = null; rows.forEach((r, i) => { if (!prev || r.pts !== prev.pts) rank = i + 1; r.rank = rank; prev = r; });
  return rows;
}
function awards(rows) {
  const out = [];
  const best = (fn, min) => { let b = null; rows.forEach((r) => { const v = fn(r); if (v >= min && (!b || v > b.v)) b = { r, v }; }); return b; };
  const a1 = best((r) => r.correct, 1); if (a1) out.push({ id: a1.r.id, icon: "🎯", title: "Le sniper", detail: a1.v + " mot" + (a1.v > 1 ? "s" : "") + " trouvé" + (a1.v > 1 ? "s" : "") });
  const a2 = best((r) => r.busts, 1); if (a2) out.push({ id: a2.r.id, icon: "💥", title: "Le kamikaze", detail: a2.v + " fois le mot secret éliminé" });
  const a3 = best((r) => (r.extraRounds ? r.extraOk / r.extraRounds : 0) * 100 + r.extraOk, 100); if (a3) out.push({ id: a3.r.id, icon: "🔮", title: "La vraie Extralucide", detail: "Toujours bien compris" });
  const a4 = best((r) => (r.extraRounds && !r.extraOk ? 1 : 0), 1); if (a4) out.push({ id: a4.r.id, icon: "🌫️", title: "La boule de cristal fêlée", detail: "Jamais compris en tant qu'Extralucide" });
  const a5 = best((r) => r.fast, 1); if (a5) out.push({ id: a5.r.id, icon: "⚡", title: "L'éclair", detail: a5.v + " mot" + (a5.v > 1 ? "s" : "") + " trouvé" + (a5.v > 1 ? "s" : "") + " avant la fin des dilemmes" });
  return out;
}
function finish(room, aborted) {
  const g = room.g; if (g.over) return;
  g.over = true; g.phase = "over"; if (g.timer) { clearInterval(g.timer); g.timer = null; }
  const rows = standings(room);
  g.final = { players: room.players.map((p) => ({ id: p.id, name: p.name, color: p.color })), rows, awards: awards(rows), history: g.history, aborted: !!aborted };
  emitAll(room);
  g.api.emitAll(room, "sos:over", g.final);
}

// ---------- robots ----------
function scheduleBot(room, forPick, forVerdict) {
  const g = room.g, r = g.r; r.botAt = {}; const now = Date.now();
  if (forPick) { const ex = defOf(room, r.extraId); if (ex && ex.isBot) r.botAt[ex.id] = now + (2500 + rng() * 4500) * TS; return; }
  r.groups.forEach((gr) => gr.members.forEach((id) => {
    const p = defOf(room, id); if (p && p.isBot) r.botAt[id] = now + ((forVerdict ? 3000 : 3500) + rng() * (forVerdict ? 5000 : g.s.talk * 450)) * TS;
  }));
}
function botAct(room) {
  const g = room.g, r = g.r; const now = Date.now();
  if (g.phase === "pick") {
    const ex = defOf(room, r.extraId); if (ex && ex.isBot && r.botAt[ex.id] && now >= r.botAt[ex.id]) { delete r.botAt[ex.id]; autoPick(room); }
  } else if (g.phase === "elim") {
    r.groups.forEach((gr) => gr.members.forEach((id) => {
      const p = defOf(room, id); if (!p || !p.isBot || p.left || !r.botAt[id] || now < r.botAt[id] || gr.busted || gr.final !== null || gr.validated.has(id)) return;
      delete r.botAt[id]; const mem = g.mem[id] || (g.mem[id] = Bot.newMemory(p.level));
      const alive = aliveFor(r, gr);
      if (gr.final === null && g.s.steps - r.step - 1 > 0) { const e = Bot.earlyGuess(mem, alive, g.s.steps - r.step - 1); if (e !== null) { earlyVote(room, gr, id, e); emitAll(room); return; } }
      const picks = Bot.chooseMarks(mem, alive, r.quota, g.s.elim, r.play === "solo");
      picks.forEach((w) => mark(room, gr, id, w)); gr.validated.add(id); emitAll(room);
    }));
    maybeEndElim(room);
  } else if (g.phase === "verdict") {
    r.groups.forEach((gr) => gr.members.forEach((id) => {
      const p = defOf(room, id); if (!p || !p.isBot || p.left || !r.botAt[id] || now < r.botAt[id] || gr.busted || gr.final !== null) return;
      delete r.botAt[id]; const mem = g.mem[id] || (g.mem[id] = Bot.newMemory(p.level));
      const w = Bot.chooseFinal(mem, aliveFor(r, gr)); if (w !== null) { final(room, gr, id, w); emitAll(room); }
    }));
    maybeEndVerdict(room);
  }
}
function maybeEndElim(room) {
  const g = room.g, r = g.r; if (g.phase !== "elim") return;
  if (!openGroups(r).length) return startReveal(room);
  const done = openGroups(r).every((gr) => { const act = activeMembers(room, gr); return !act.length || act.every((p) => gr.validated.has(p.id)); });
  if (done) endElim(room);
}

// ---------- horloge ----------
function tick(room) {
  const g = room.g; if (!g || g.over) return;
  if (present(room).length < 2 || !present(room).some((p) => !p.isBot)) return finish(room, true);
  const r = g.r; const now = Date.now();
  // l'Extralucide est parti, la manche est annulée
  if (r && g.phase !== "reveal" && g.phase !== "over") { const ex = defOf(room, r.extraId); if (!ex || ex.left) { g.api.sysChat(room, "L'Extralucide a quitté la partie, on passe à la manche suivante."); return nextRound(room); } }
  if (g.phase === "pick" || g.phase === "elim" || g.phase === "verdict") botAct(room);
  if (g.phase === "pick" && now >= g.phaseUntil) autoPick(room, true);
  else if (g.phase === "elim" && now >= g.phaseUntil) endElim(room);
  else if (g.phase === "result" && now >= g.phaseUntil) afterResult(room);
  else if (g.phase === "verdict" && now >= g.phaseUntil) { liveGroups(r).forEach((gr) => resolveVerdict(room, gr)); startReveal(room); }
  else if (g.phase === "reveal" && now >= g.phaseUntil) nextRound(room);
}

// ---------- état envoyé à chaque joueur ----------
function groupOf(r, pid) { return r.groups.find((gr) => gr.members.includes(pid)) || null; }
function publicState(room, pid) {
  const g = room.g; const base = { now: Date.now(), phase: g.phase, round: g.round, rounds: g.rounds, seq: g.seq, scores: g.scores, phaseUntil: g.phaseUntil, phaseTotal: g.phaseTotal, sfx: g.s.sfx };
  if (g.phase === "over" || g.phase === "wait" || !g.r) return base;
  const r = g.r; const isEx = pid === r.extraId; const my = groupOf(r, pid);
  const st = Object.assign(base, {
    extraId: r.extraId, step: r.step, steps: g.s.steps, quota: r.quota, play: r.play, rule: g.s.elim, jokerOk: g.s.joker && !r.jokerUsed, joker: g.s.joker,
    words: r.grid.map((w) => ({ id: w.id, name: w.name })), event: r.event, needPicks: r.needPicks, pickNo: r.picks.length,
    picks: r.picks.map((p) => ({ a: p.a, b: p.b, side: p.side, meaning: p.meaning, inv: p.inv, auto: p.auto })),
    mode: g.s.mode, tension: Math.min(1, (r.step + 1) / g.s.steps), rerollOk: !!(g.s.reroll && !r.rerolled), hist: r.steps.map((x) => ({ step: x.step, picks: x.picks, event: x.event })), bonusEarly: g.s.bonusEarly !== false,
  });
  if (isEx) { st.secretId = r.secret.id; if (g.phase === "pick") st.hand = r.hand.map((d) => ({ id: d.id, a: d.a, b: d.b })); }
  st.groups = r.groups.map((gr) => {
    const mine = my && my.id === gr.id; const open = mine || isEx || g.phase === "reveal";
    return { id: gr.id, members: gr.members, busted: gr.busted && (open || g.phase === "result"), nElim: gr.elim.size, validated: mine ? Array.from(gr.validated) : gr.validated.size, elim: open ? Array.from(gr.elim) : [], aliveN: r.grid.length - gr.elim.size, locked: gr.final !== null && (open || g.phase === "result") };
  });
  if (my) {
    st.my = my.id; st.myMarks = {}; Object.keys(my.marks).forEach((k) => { st.myMarks[k] = Array.from(my.marks[k]); });
    st.myFinals = my.finals; st.myFinal = my.final; st.myEarly = my.early; st.pins = Array.from(my.pins); st.notes = my.notes; st.myLocked = my.final !== null;
  } else if (isEx) {
    const g0 = r.groups[0]; st.notes = g0 ? g0.notes : []; st.pins = g0 ? Array.from(g0.pins) : [];
    st.exMarks = {}; r.groups.forEach((gr) => { Object.keys(gr.marks).forEach((k) => { st.exMarks[k] = (st.exMarks[k] || 0) + gr.marks[k].size; }); });
  }
  if (g.phase === "result") st.result = r.resultInfo;
  if (g.phase === "reveal") st.reveal = r.reveal;
  return st;
}
function sendTo(room, sock, p) { try { sock.emit("sos:state", publicState(room, p.id)); } catch (e) { console.error("sos emit", e); } }
function emitAll(room) {
  const g = room.g; if (!g) return;
  room.players.forEach((p) => { if (p.isBot || !p.socketId) return; const s = g.api.io.sockets.sockets.get(p.socketId); if (s) sendTo(room, s, p); });
}

// ---------- sockets ----------
function bind(socket, helpers, api) {
  const { ctx, me, safe, toast } = helpers;
  const cur = () => { const room = ctx.room; const p = me(); return room && room.g && room.g.r && p ? { room, g: room.g, r: room.g.r, p } : null; };
  socket.on("sos:pick", safe((d) => {
    const c = cur(); if (!c || c.g.phase !== "pick" || c.p.id !== c.r.extraId) return;
    if (!doPick(c.room, +(d && d.card), String(d && d.side))) toast("Choix impossible.");
  }));
  socket.on("sos:mark", safe((d) => {
    const c = cur(); if (!c || c.g.phase !== "elim") return; const gr = groupOf(c.r, c.p.id); if (!gr) return;
    if (!mark(c.room, gr, c.p.id, +(d && d.word))) return; emitAll(c.room);
  }));
  socket.on("sos:valid", safe(() => {
    const c = cur(); if (!c || c.g.phase !== "elim") return; const gr = groupOf(c.r, c.p.id); if (!gr || gr.busted) return;
    gr.validated.add(c.p.id); emitAll(c.room); maybeEndElim(c.room);
  }));
  socket.on("sos:unvalid", safe(() => {
    const c = cur(); if (!c || c.g.phase !== "elim") return; const gr = groupOf(c.r, c.p.id); if (!gr || gr.busted) return;
    gr.validated.delete(c.p.id); emitAll(c.room);
  }));
  socket.on("sos:early", safe((d) => {
    const c = cur(); if (!c || c.g.phase !== "elim") return; const gr = groupOf(c.r, c.p.id); if (!gr) return;
    if (!earlyVote(c.room, gr, c.p.id, d && d.word === -1 ? -1 : +(d && d.word))) return; emitAll(c.room);
  }));
  socket.on("sos:pin", safe((d) => {
    const c = cur(); if (!c || (c.g.phase !== "elim" && c.g.phase !== "pick" && c.g.phase !== "result" && c.g.phase !== "verdict")) return; const gr = groupOf(c.r, c.p.id); if (!gr || gr.final !== null && c.g.phase !== "verdict") return;
    const w = +(d && d.word); if (!c.r.grid.some((x) => x.id === w) || gr.elim.has(w)) return;
    if (gr.pins.has(w)) gr.pins.delete(w); else if (gr.pins.size < 8) gr.pins.add(w); else return; emitAll(c.room);
  }));
  socket.on("sos:reroll", safe(() => {
    const c = cur(); if (!c || c.g.phase !== "pick" || c.p.id !== c.r.extraId) return;
    if (!reroll(c.room)) { toast("Main déjà relancée."); return; } emitAll(c.room);
  }));
  socket.on("sos:final", safe((d) => {
    const c = cur(); if (!c || c.g.phase !== "verdict") return; const gr = groupOf(c.r, c.p.id); if (!gr) return;
    if (!final(c.room, gr, c.p.id, +(d && d.word))) return; emitAll(c.room); maybeEndVerdict(c.room);
  }));
  socket.on("sos:next", safe(() => {
    const c = cur(); if (!c || c.g.phase !== "reveal" || !helpers.isHost()) return; nextRound(c.room);
  }));
}
function onReconnect(room, p) { const g = room.g; if (!g) return; const s = g.api.io.sockets.sockets.get(p.socketId); if (s) { sendTo(room, s, p); if (g.over && g.final) s.emit("sos:over", g.final); } }
function onLeave(room, p) {
  const g = room.g; if (!g) return;
  if (!room.players.some((x) => !x.isBot && !x.left)) return onDestroy(room);
  if (g.r && g.phase === "elim") maybeEndElim(room); else if (g.r && g.phase === "verdict") maybeEndVerdict(room);
}
module.exports = { start, bind, onReconnect, onLeave, onDestroy, canReturn: (room) => !!(room.g && room.g.over), publicState, standings };

// ============================================================
// PAGAILLE PARTY — Moteur de partie (serveur)
// Il gère les manches, le vote, les règles, les bots, le déroulement d'un mini-jeu, les points et les déconnexions.
// Les mini-jeux vivent dans games/<id>.js et suivent le même contrat.
//   create(ctx) renvoie { update(dt), frame(), scene(), priv(pid), onAct(pid,msg), done, ranking() }
// Le serveur décide de tout. Le client reçoit des décors fixes (pg:scene) puis des images légères (pg:frame).
// ============================================================
const Cat = require("./public/game/catalog.js");
const Rules = require("./public/game/rules.js");
const U = require("./pg-util.js");
const fs = require("fs"), path = require("path");

const MODULES = {};
Cat.ids.forEach((id) => { try { MODULES[id] = require("./games/" + id + ".js"); } catch (e) { console.error("Mini-jeu ignoré", id, e); } });

const TICK = 1000 / 30;
const GO_MS = 3000;          // compte à rebours avant l'action
const RESULT_MS = 8500;
const HOP_MS = 230, EV_MS = 1700;  // plateau, durée d'un saut de case et d'une case surprise à l'écran
const SKILL = { facile: 0.35, normal: 0.65, expert: 0.93 };
const MODS = [
  { id: "inv", label: "Commandes inversées", desc: "Gauche devient droite et haut devient bas.", move: true },
  { id: "turbo", label: "Turbo", desc: "Tout va plus vite, y compris les compteurs.", move: false },
  { id: "double", label: "Points doublés", desc: "Cette manche rapporte deux fois plus.", move: false },
  { id: "lourd", label: "Pieds lourds", desc: "Tout le monde glisse et accélère moins vite.", move: true },
];
const LEN = { court: 0.7, normal: 1, long: 1.5 };
// ---------- plateau entre les manches ----------
// seize cases en boucle, on avance selon son rang à la manche, chaque case surprise peut renverser le classement
const BN = 16, LAP_PTS = 5;
const SQ = {
  depart: { icon: "🏁", name: "Départ", desc: "Chaque tour complet du plateau rapporte " + LAP_PTS + " points." },
  cadeau: { icon: "🎁", name: "Cadeau", desc: "Trois points offerts." },
  banane: { icon: "🍌", name: "Peau de banane", desc: "Tu perds trois points." },
  echange: { icon: "🔄", name: "Échange", desc: "Tu échanges ton score avec le joueur juste devant toi au classement." },
  voleur: { icon: "🦝", name: "Raton voleur", desc: "Tu voles trois points au premier du classement, ou au deuxième si c'est toi le premier." },
  foudre: { icon: "⚡", name: "Foudre", desc: "La foudre tombe sur le premier du classement, il perd quatre points." },
  tremplin: { icon: "🚀", name: "Tremplin", desc: "Tu avances de deux cases de plus." },
  vide: { icon: "", name: "Case tranquille", desc: "Rien ne se passe." },
};
function makeBoard(rnd) {
  const bag = ["cadeau", "cadeau", "cadeau", "banane", "banane", "echange", "voleur", "voleur", "foudre", "foudre", "tremplin", "tremplin", "vide", "vide", "vide"];
  for (let tries = 0; tries < 40; tries++) {
    U.shuffle(bag, rnd);
    // pas de tremplin juste avant le départ ni deux tremplins collés, pour que les sauts restent lisibles
    const ok = bag.every((k, i) => k !== "tremplin" || (i < bag.length - 2 && bag[i + 1] !== "tremplin" && bag[i + 2] !== "tremplin"));
    if (ok) break;
  }
  return ["depart"].concat(bag);
}
// ---------- notes des joueurs sur les mini-jeux ----------
// 👍 ou 👎 après chaque manche, gardés dans un petit fichier pour faire le tri des jeux les moins aimés
const NOTES_FILE = path.join(__dirname, "notes-joueurs.json");
let NOTES = {}; try { NOTES = JSON.parse(fs.readFileSync(NOTES_FILE, "utf8")) || {}; } catch (e) { NOTES = {}; }
let notesTimer = null;
function saveNotes() { if (notesTimer) return; notesTimer = setTimeout(() => { notesTimer = null; try { fs.writeFileSync(NOTES_FILE, JSON.stringify(NOTES)); } catch (e) { /* disque en lecture seule, les notes restent en mémoire */ } }, 1500); }
const noteOf = (id) => NOTES[id] || { up: 0, down: 0 };
const present = (p) => !!p && !p.left && (p.isBot || p.connected);
const human = (p) => !!p && !p.isBot && p.connected && !p.left;
const rd = (v) => {
  if (typeof v === "number") return Math.round(v * 100) / 100;
  if (Array.isArray(v)) { const o = new Array(v.length); for (let i = 0; i < v.length; i++) o[i] = rd(v[i]); return o; }
  if (v && typeof v === "object") { const o = {}; for (const k in v) o[k] = rd(v[k]); return o; }
  return v;
};

function start(room, api) {
  const s = room.settings;
  const g = room.g = {
    api, phase: "boot", t: 0, acc: 0, last: Date.now(), round: 0, total: Rules.totalRounds(s), scores: {}, delta: {}, plays: {}, lastGame: null, history: [],
    inputs: {}, edges: {}, botIn: {}, ready: {}, votes: {}, options: [], until: 0, inst: null, meta: null, mod: null, members: [], seed: Math.random().toString(36).slice(2),
    endReason: "", beat: 0, bpos: {}, bsq: null, board: null, rated: {}, msgs: [], result: null, over: false, fxq: [], fxId: 0, wins: {}, lasts: {}, tops: {}, voteAt: {}, scene: null, sceneKey: 0, banner: "", rk: null, startedAt: Date.now(),
  };
  room.players.forEach((p) => { g.scores[p.id] = 0; g.delta[p.id] = 0; g.wins[p.id] = 0; g.lasts[p.id] = 0; g.tops[p.id] = 0; g.bpos[p.id] = 0; });
  g.bsq = makeBoard(Math.random);
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
  g.round++; g.members = mem.map((p, i) => ({ id: p.id, name: p.name, color: p.color, idx: i, bot: !!p.isBot }));
  g.votes = {}; g.ready = {}; g.inst = null; g.meta = null; g.result = null; g.msgs = []; g.fxq = []; g.scene = null; g.banner = ""; g.rk = null; g.voteAt = {};
  g.options = pickOptions(room, g.members.length);
  if (g.options.length <= 1) { g.meta = g.options[0] || Cat.GAMES[0]; return beginIntro(room); }
  g.members.forEach((m) => { if (m.bot) g.voteAt[m.id] = g.t + 1200 + Math.random() * 4200; });
  g.phase = "vote"; g.until = g.t + room.settings.voteTime * 1000; g.span = room.settings.voteTime * 1000; push(room);
}
function pickOptions(room, n) {
  const g = room.g, s = room.settings;
  if (s.forced && MODULES[s.forced] && Cat.byId[s.forced]) return [Cat.byId[s.forced]];
  let pool = Cat.GAMES.filter((m) => MODULES[m.id] && s.games.includes(m.id) && m.min <= n && n <= m.max);
  if (!pool.length) pool = Cat.GAMES.filter((m) => MODULES[m.id] && m.min <= n && n <= m.max);
  if (s.noRepeat && g.lastGame && pool.length > 1) pool = pool.filter((m) => m.id !== g.lastGame);
  const out = [];
  // on évite de proposer trois jeux du même genre
  while (out.length < 3 && pool.length) {
    // on mélange les familles de jeux (mouvement, tête, stratégie, timing) pour que les trois choix ne se ressemblent pas
    const famPlays = {}; Cat.GAMES.forEach((m) => { famPlays[m.fam] = (famPlays[m.fam] || 0) + (g.plays[m.id] || 0); }); const lastFam = g.lastGame && Cat.byId[g.lastGame] ? Cat.byId[g.lastGame].fam : null;
    const w = pool.map((m) => (1 / (1 + (g.plays[m.id] || 0) * 1.2)) * (1 / (1 + (famPlays[m.fam] || 0) * 0.25)) * (out.some((o) => o.kind === m.kind) ? 0.35 : 1) * (out.some((o) => o.fam === m.fam) ? 0.3 : 1) * (m.fam === lastFam ? 0.6 : 1)); const tot = w.reduce((a, b) => a + b, 0); let r = Math.random() * tot; let k = 0;
    for (; k < pool.length - 1; k++) { r -= w[k]; if (r <= 0) break; }
    out.push(pool[k]); pool.splice(k, 1);
  }
  return out;
}
function resolveVote(room) {
  const g = room.g; const counts = {}; g.options.forEach((o) => { counts[o.id] = 0; });
  Object.keys(g.votes).forEach((pid) => { const v = g.votes[pid]; if (counts[v] != null) counts[v]++; });
  const best = Math.max.apply(null, Object.values(counts)); const top = g.options.filter((o) => counts[o.id] === best);
  g.meta = top[Math.floor(Math.random() * top.length)]; g.voteTie = top.length > 1;
  g.api.sysChat(room, "Manche " + g.round + " sur " + g.total + ", " + g.meta.name + ".");
  beginIntro(room);
}
function beginIntro(room) {
  const g = room.g, s = room.settings;
  g.mod = null;
  if (s.mode === "chaos") {
    const lvl = s.chaos == null ? 1 : s.chaos; const ok = MODS.filter((m) => !m.move || g.meta.move);
    if (lvl > 0 && (lvl >= 2 || Math.random() < 0.7)) g.mod = ok[Math.floor(Math.random() * ok.length)];
  }
  g.plays[g.meta.id] = (g.plays[g.meta.id] || 0) + 1; g.lastGame = g.meta.id;
  g.members.forEach((m) => { if (m.bot) g.ready[m.id] = true; });
  g.phase = "intro"; g.until = g.t + s.introTime * 1000; g.span = s.introTime * 1000; push(room);
}
function skillOf(room, p) {
  if (!p) return 0.6; if (!p.isBot) return SKILL.normal;
  return SKILL[p.level] || SKILL.normal;
}
function botControlled(room, p) {
  if (!p) return false; const s = room.settings;
  if (p.isBot) return true; if (s.demo) return true;
  return s.takeover !== false && !p.connected && !p.left;
}
function beginPlay(room) {
  const g = room.g, s = room.settings; const meta = g.meta;
  const mod = g.mod ? g.mod.id : "";
  g.inputs = {}; g.edges = {}; g.botIn = {}; g.fxq = []; g.frozen = false;
  const len = LEN[s.len] || 1;
  const ctx = {
    n: g.members.length, players: g.members.map((m) => Object.assign({}, m)), mod, inv: mod === "inv", heavy: mod === "lourd", speed: mod === "turbo" ? 1.3 : 1,
    pace: (s.pace || 1) * (mod === "turbo" ? 0.8 : 1), len, opts: s,
    rnd: U.mulberry32(U.hashSeed(g.seed + ":" + g.round + ":" + meta.id)),
    isBot(pid) { return botControlled(room, findP(room, pid)); },
    skill(pid) { return skillOf(room, findP(room, pid)); },
    input(pid) {
      if (g.frozen) return { x: 0, y: 0, a: false, b: false };
      const p = findP(room, pid);
      if (botControlled(room, p)) { const b = g.botIn[pid] || {}; return { x: b.x || 0, y: b.y || 0, a: !!b.a, b: !!b.b }; }
      const k = g.inputs[pid] || {}; let x = (k.r ? 1 : 0) - (k.l ? 1 : 0), y = (k.d ? 1 : 0) - (k.u ? 1 : 0);
      // la Course des fous envoie une direction déjà tournée selon la caméra du joueur
      if (k.mx != null) { x = k.mx; y = k.my; }
      if (!human(p)) { x = 0; y = 0; }
      if (ctx.inv && meta.move) { x = -x; y = -y; } return { x, y, a: !!k.a, b: !!k.b };
    },
    edge(pid) { const e = g.edges[pid] || {}; return { a: !!e.a, b: !!e.b }; },
    drive(pid, v) { g.botIn[pid] = { x: U.clamp(v.x || 0, -1, 1), y: U.clamp(v.y || 0, -1, 1), a: !!v.a, b: !!v.b }; },
    press(pid, k) { const e = g.edges[pid] || (g.edges[pid] = { a: false, b: false }); e[k] = true; },
    present(pid) { return present(findP(room, pid)); },
    announce(text, ms) { g.msgs.push({ text, until: g.t + (ms || 2600) }); },
    fx(k, x, y, z, c, extra) { g.fxq.push(Object.assign({ id: ++g.fxId, k, x, y, z: z || 0, c: c || "", until: g.t + 1500 }, extra || {})); },
    snd(name) { g.fxq.push({ id: ++g.fxId, k: "snd", n: name, until: g.t + 1500 }); },
    shake(a) { g.fxq.push({ id: ++g.fxId, k: "shake", a: a || 1, until: g.t + 1500 }); },
    now() { return g.t; },
  };
  g.ctx = ctx; g.inst = MODULES[meta.id].create(ctx); g.phase = "play"; g.go = g.t + GO_MS; g.endAt = 0; g.rk = null;
  const maxS = (meta.maxSecs || meta.secs * 1.7 + 20) * ctx.len * ctx.pace;
  g.cap = maxS * 1000; g.playT = 0;
  g.scene = null; g.sceneKey++; try { if (g.inst.scene) g.scene = rd(g.inst.scene()); } catch (e) { console.error("scene", meta.id, e); }
  push(room); sendScene(room); sendFrames(room);
}
function takeRanking(room) {
  const g = room.g; const inst = g.inst; let rk = { groups: [], bonus: {}, notes: {} };
  try { rk = Object.assign(rk, inst.ranking()); } catch (e) { console.error("classement", g.meta.id, e); }
  return rk;
}
function endPlay(room) {
  const g = room.g, s = room.settings;
  const ids = g.members.map((m) => m.id); const rk = g.rk || takeRanking(room);
  const seen = new Set(); const groups = []; (rk.groups || []).forEach((grp) => { const gg = grp.filter((id) => ids.includes(id) && !seen.has(id)); gg.forEach((id) => seen.add(id)); if (gg.length) groups.push(gg); });
  const rest = ids.filter((id) => !seen.has(id)); if (rest.length) groups.push(rest);
  const n = ids.length; let pos = 1; const rows = [];
  const mult = (g.round >= g.total && s.lastDouble ? 2 : 1) * (g.mod && g.mod.id === "double" ? 2 : 1);
  groups.forEach((grp, gi) => {
    const avg = pos + (grp.length - 1) / 2; const base = Math.round(10 * (n - avg) / Math.max(1, n - 1));
    grp.forEach((id) => {
      const bonus = clampInt((rk.bonus || {})[id] || 0, 0, 5); const pts = (base + bonus) * mult; g.scores[id] = (g.scores[id] || 0) + pts; g.delta[id] = pts;
      const m = g.members.find((x) => x.id === id);
      if (gi === 0 && groups.length > 1) g.wins[id] = (g.wins[id] || 0) + 1;
      if (gi === groups.length - 1 && groups.length > 1 && n >= 3) g.lasts[id] = (g.lasts[id] || 0) + 1;
      rows.push({ id, name: m.name, color: m.color, bot: m.bot, rank: pos, tie: grp.length > 1, pts, bonus, note: (rk.notes || {})[id] || "" });
    });
    pos += grp.length;
  });
  room.players.forEach((p) => { if (!ids.includes(p.id)) g.delta[p.id] = 0; });
  g.result = { rows, mult, game: g.meta.name, icon: g.meta.icon, headline: rk.headline || "", mod: g.mod ? g.mod.label : "" };
  g.history.push({ round: g.round, game: g.meta.id, winners: (groups[0] || []).slice() });
  g.phase = "result"; g.until = g.t + RESULT_MS; g.span = RESULT_MS; g.frozen = true; push(room);
}
const clampInt = (v, a, b) => Math.max(a, Math.min(b, Math.round(v)));
function awards(room) {
  const g = room.g; const out = []; const mem = room.players.filter((p) => g.scores[p.id] != null);
  const pick = (key, minV, icon, title, text) => { let best = null; mem.forEach((p) => { const v = g[key][p.id] || 0; if (v >= minV && (!best || v > best.v)) best = { p, v }; }); if (best) out.push({ icon, title, text: text(best.v), name: best.p.name, color: best.p.color }); };
  pick("wins", 1, "👑", "Roi des manches", (v) => v + " manche" + (v > 1 ? "s" : "") + " gagnée" + (v > 1 ? "s" : ""));
  pick("lasts", 2, "🍌", "Poisse du jour", (v) => v + " fois dernier");
  return out;
}
function beginBoard(room) {
  const g = room.g; const rows = (g.result && g.result.rows) || []; const n = rows.length;
  const ids = rows.map((r) => r.id).filter((id) => present(findP(room, id))); if (ids.length < 2) return nextRound(room);
  const name = (id) => (findP(room, id) || {}).name || "?";
  const pre = {}; room.players.forEach((p) => { pre[p.id] = g.scores[p.id] || 0; });
  const from = {}, steps = {}; ids.forEach((id) => { from[id] = g.bpos[id] || 0; });
  rows.forEach((r) => { if (ids.includes(r.id)) steps[r.id] = Math.max(1, Math.min(4, 4 - Math.floor(((r.rank - 1) * 3) / Math.max(1, n - 1)))); });
  const events = []; const add = (id, d) => { const before = g.scores[id] || 0; const after = Math.max(0, before + d); g.scores[id] = after; return after - before; };
  const leader = (but) => { let best = null; ids.forEach((id) => { if (id === but) return; if (!best || g.scores[id] > g.scores[best]) best = id; }); return best; };
  const above = (id) => { let best = null; ids.forEach((o) => { if (o === id || g.scores[o] <= g.scores[id]) return; if (!best || g.scores[o] < g.scores[best]) best = o; }); return best; };
  // les déplacements, puis les cases dans l'ordre inverse du classement de la manche, les derniers d'abord
  const order = rows.map((r) => r.id).filter((id) => ids.includes(id)).reverse();
  const to = {}; ids.forEach((id) => { to[id] = from[id] + steps[id]; });
  order.forEach((id) => {
    let at = to[id]; const laps = Math.floor(at / BN) - Math.floor(from[id] / BN); const d0 = {};
    if (laps > 0) { d0[id] = add(id, LAP_PTS * laps); events.push({ id, sq: 0, at, type: "depart", title: name(id) + " boucle un tour", text: "+" + LAP_PTS + " points pour le tour complet.", d: d0 }); }
    let type = g.bsq[at % BN]; let chain = 0;
    while (true) {
      const d = {}; let title = "", text = "", hop = 0;
      if (type === "cadeau") { d[id] = add(id, 3); title = name(id) + " ouvre un cadeau"; text = "+3 points."; }
      else if (type === "banane") { d[id] = add(id, -3); title = name(id) + " glisse sur une banane"; text = d[id] ? d[id] + " points." : "Pas de points à perdre, ouf."; }
      else if (type === "echange") { const o = above(id); if (o) { const a = g.scores[id], b = g.scores[o]; d[id] = add(id, b - a); d[o] = add(o, a - b); title = name(id) + " échange son score avec " + name(o); text = name(id) + " passe à " + b + " points et " + name(o) + " tombe à " + a + "."; } else { d[id] = add(id, 2); title = name(id) + " voulait échanger"; text = "Personne devant, alors +2 points de consolation."; } }
      else if (type === "voleur") { const o = leader(id); const took = o ? -add(o, -3) : 0; d[id] = add(id, took); if (o) d[o] = -took; title = name(id) + " fait les poches de " + (o ? name(o) : "personne"); text = took ? took + " points volés." : "Les poches étaient vides."; }
      else if (type === "foudre") { const o = leader(null); d[o] = add(o, -4); title = "La foudre tombe sur " + name(o); text = !d[o] ? "Il n'avait aucun point à perdre." : o === id ? name(o) + " s'est foudroyé tout seul, " + d[o] + " points." : d[o] + " points pour le premier."; }
      else if (type === "tremplin" && chain === 0) { hop = 2; title = name(id) + " rebondit sur un tremplin"; text = "Deux cases de plus."; }
      if (title) events.push({ id, sq: at % BN, at, type, title, text, d, hop });
      if (hop) { const nAt = at + hop; const l2 = Math.floor(nAt / BN) - Math.floor(at / BN); at = nAt; to[id] = at; if (l2 > 0) { const dd = {}; dd[id] = add(id, LAP_PTS); events.push({ id, sq: 0, at, type: "depart", title: name(id) + " boucle un tour", text: "+" + LAP_PTS + " points pour le tour complet.", d: dd }); } type = g.bsq[at % BN]; chain++; if (type === "tremplin") break; continue; }
      break;
    }
  });
  ids.forEach((id) => { g.bpos[id] = to[id]; });
  g.board = { sq: g.bsq.map((k) => ({ k, icon: SQ[k].icon, name: SQ[k].name })), legend: Object.keys(SQ).filter((k) => k !== "vide").map((k) => ({ icon: SQ[k].icon, name: SQ[k].name, desc: SQ[k].desc })), pre, from, steps, to, events, ids, hop: HOP_MS, ev: EV_MS, round: g.round };
  g.ready = {}; g.phase = "board";
  const anim = 1200 + 4 * HOP_MS + events.length * EV_MS + 2600; g.boardMin = g.t + 1200; g.until = g.t + anim + 3500; g.span = 0; push(room);
}
function finish(room, reason) {
  const g = room.g; g.phase = "over"; g.over = true; g.endReason = reason; g.until = 0; g.inst = null; g.frozen = true;
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
function runInst(room, dt) {
  const g = room.g; const inst = g.inst; if (!inst) return;
  if (inst.done && inst.live === false) return;
  try { inst.update(dt); } catch (e) { console.error("jeu", g.meta.id, e); inst.done = true; }
}
function tick(room) {
  const g = room.g; g.t += TICK; g.beat++;
  g.msgs = g.msgs.filter((m) => m.until > g.t); g.fxq = g.fxq.filter((f) => f.until > g.t);
  if (g.phase === "vote") {
    const mem = members(room); let changed = false;
    g.members.forEach((m) => { if (m.bot && !g.votes[m.id] && g.t >= (g.voteAt[m.id] || 0)) { g.votes[m.id] = g.options[Math.floor(Math.random() * g.options.length)].id; changed = true; } });
    if (changed) push(room);
    const allVoted = mem.length > 0 && mem.every((p) => g.votes[p.id]);
    if (allVoted && g.until - g.t > 1500) { g.until = g.t + 1500; push(room); }
    if (g.t >= g.until) {
      if (!Object.keys(g.votes).length) { g.api.sysChat(room, "Personne n'a voté, le sort a choisi."); }
      resolveVote(room);
    }
  } else if (g.phase === "intro") {
    const mem = members(room); const all = mem.length > 0 && mem.every((p) => g.ready[p.id] || botControlled(room, p));
    if (all && g.until - g.t > 900) { g.until = g.t + 900; push(room); }
    if (g.t >= g.until) beginPlay(room);
  } else if (g.phase === "play") {
    if (g.t >= g.go && !g.endAt) {
      g.playT += TICK; runInst(room, TICK / 1000);
      Object.keys(g.edges).forEach((k) => { g.edges[k] = { a: false, b: false }; });
      if (g.inst.done || g.playT >= g.cap) {
        g.rk = takeRanking(room); g.endAt = g.t + (g.meta.hold || 2300);
        g.banner = g.rk.headline || ""; g.frozen = true; push(room);
      }
    } else if (g.endAt) { runInst(room, TICK / 1000); }
    if (g.endAt && g.t >= g.endAt) endPlay(room);
    else if (g.beat % 2 === 0) sendFrames(room);
  } else if (g.phase === "result") {
    runInst(room, TICK / 1000); if (g.beat % 2 === 0) sendFrames(room);
    if (g.t >= g.until) { if (room.settings.board !== false && g.round < g.total) beginBoard(room); else nextRound(room); }
  } else if (g.phase === "board") {
    const mem = members(room); const all = mem.length > 0 && mem.every((p) => g.ready[p.id] || p.isBot);
    if (all && g.t >= g.boardMin && g.until - g.t > 500) { g.until = g.t + 500; push(room); }
    if (g.t >= g.until) nextRound(room);
  }
  if (g.beat % 30 === 0 && g.phase !== "play") push(room);
}

// ---------- messages ----------
function standings(room) {
  const g = room.g;
  const rows = room.players.map((p) => ({ id: p.id, name: p.name, color: p.color, bot: !!p.isBot, pts: g.scores[p.id] || 0, delta: g.delta[p.id] || 0, online: present(p), left: !!p.left, wins: g.wins[p.id] || 0 }));
  rows.sort((a, b) => b.pts - a.pts);
  let rank = 0; rows.forEach((r, i) => { if (i === 0 || r.pts !== rows[i - 1].pts) rank = i + 1; r.rank = rank; });
  return rows;
}
function stateMsg(room, pid) {
  const g = room.g; const meta = g.meta;
  const counts = {}; g.options.forEach((o) => { counts[o.id] = 0; }); Object.keys(g.votes).forEach((k) => { if (counts[g.votes[k]] != null) counts[g.votes[k]]++; });
  const out = {
    phase: g.phase, left: Math.max(0, g.until - g.t), span: g.span || 0, round: g.round, total: g.total, mode: room.settings.mode, standings: standings(room), reason: g.endReason,
    vote: g.phase === "vote" ? { options: g.options, counts, mine: g.votes[pid] || null, voted: Object.keys(g.votes), tie: !!g.voteTie } : null,
    game: meta && g.phase !== "vote" ? meta : null, mod: g.mod, ready: Object.keys(g.ready), members: g.members.map((m) => m.id), memberInfo: g.members,
    result: g.phase === "result" ? g.result : null, board: g.phase === "board" ? g.board : null, rate: rateMsg(g, pid), notes: g.phase === "over" ? playedNotes(g) : null, history: g.phase === "over" ? g.history : null, awards: g.phase === "over" ? awards(room) : null,
    goIn: g.phase === "play" ? Math.max(0, g.go - g.t) : 0, sceneKey: g.sceneKey, banner: g.banner, demo: !!room.settings.demo, view: meta ? (meta.view || "3d") : "3d",
  };
  return out;
}
function rateMsg(g, pid) {
  if ((g.phase !== "result" && g.phase !== "board") || !g.meta) return null; const id = g.meta.id; const n = noteOf(id);
  return { id, name: g.meta.name, up: n.up, down: n.down, mine: (g.rated[pid] || {})[id] || 0 };
}
function playedNotes(g) {
  const seen = []; g.history.forEach((h) => { if (!seen.includes(h.game)) seen.push(h.game); });
  return seen.map((id) => { const m = Cat.GAMES.find((x) => x.id === id) || { name: id, icon: "" }; const n = noteOf(id); return { id, name: m.name, icon: m.icon, up: n.up, down: n.down }; }).sort((a, b) => (a.up - a.down) - (b.up - b.down));
}
function push(room) {
  const g = room.g; room.players.forEach((p) => { if (p.isBot || !p.socketId) return; g.api.io.to(p.socketId).emit("pg:state", stateMsg(room, p.id)); });
}
function sceneMsg(g) { return { key: g.sceneKey, scene: g.scene }; }
function sendScene(room) {
  const g = room.g; if (!g.scene) return; const m = sceneMsg(g);
  room.players.forEach((p) => { if (p.isBot || !p.socketId) return; g.api.io.to(p.socketId).emit("pg:scene", m); });
}
function buildFrame(room) {
  const g = room.g; const inst = g.inst; if (!inst) return null;
  let fr; try { fr = inst.frame(); } catch (e) { console.error("frame", g.meta.id, e); return null; }
  fr = rd(fr); fr.hud = Object.assign({}, fr.hud || {}); fr.hud.msgs = g.msgs.map((m) => m.text);
  const cd = g.go - g.t; fr.hud.cd = g.phase === "play" && cd > 0 ? Math.ceil(cd / 1000) : 0; fr.hud.go = g.phase === "play" && cd <= 0 && cd > -700;
  if (g.endAt || g.phase === "result") { fr.hud.end = true; fr.hud.banner = g.banner; }
  fr.fx = (fr.fx || []).concat(g.fxq.map((f) => rd(f))); fr.k = g.sceneKey;
  return fr;
}
function sendFrames(room) {
  const g = room.g; const inst = g.inst; if (!inst) return;
  const fr = buildFrame(room); if (!fr) return;
  room.players.forEach((p) => {
    if (p.isBot || !p.socketId) return;
    let pv = null; try { pv = inst.priv ? rd(inst.priv(p.id)) : null; } catch (e) { console.error("priv", e); }
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
    if (!inGame() || !ok()) return; const g = ctx.room.g; const p = me(); if ((g.phase !== "intro" && g.phase !== "board") || !p) return; g.ready[p.id] = true; push(ctx.room);
  }));
  // un pouce levé ou baissé pour le mini-jeu qui vient d'être joué, un seul avis par joueur et par jeu dans la partie
  socket.on("pg:rate", safe((m) => {
    if (!inGame() || !ok() || !m) return; const g = ctx.room.g; const p = me(); if (!p || p.isBot || (g.phase !== "result" && g.phase !== "board") || !g.meta) return;
    const v = m.v > 0 ? 1 : m.v < 0 ? -1 : 0; const id = g.meta.id; const mine = g.rated[p.id] || (g.rated[p.id] = {}); const old = mine[id] || 0; if (old === v) return;
    const n = NOTES[id] || (NOTES[id] = { up: 0, down: 0 }); if (old > 0) n.up--; if (old < 0) n.down--; if (v > 0) n.up++; if (v < 0) n.down++; mine[id] = v; saveNotes(); push(ctx.room);
  }));
  socket.on("pg:in", safe((k) => {
    if (!inGame() || !k || typeof k !== "object") return; const g = ctx.room.g; const p = me(); if (!p) return;
    const nk = { l: k.l ? 1 : 0, r: k.r ? 1 : 0, u: k.u ? 1 : 0, d: k.d ? 1 : 0, a: k.a ? 1 : 0, b: k.b ? 1 : 0 };
    if (typeof k.mx === "number" && typeof k.my === "number" && isFinite(k.mx) && isFinite(k.my)) { nk.mx = U.clamp(k.mx, -1, 1); nk.my = U.clamp(k.my, -1, 1); }
    const old = g.inputs[p.id] || {}; const e = g.edges[p.id] || { a: false, b: false };
    if (nk.a && !old.a) e.a = true; if (nk.b && !old.b) e.b = true; g.edges[p.id] = e; g.inputs[p.id] = nk;
  }));
  // la position que le navigateur a calculée pour son propre coureur, vérifiée par le jeu
  const prate = { n: 0, t: 0 };
  socket.on("pg:pos", safe((m) => {
    if (!inGame() || !m || typeof m !== "object") return; const now = Date.now(); if (now - prate.t > 1000) { prate.t = now; prate.n = 0; } if (++prate.n > 45) return;
    const g = ctx.room.g; const p = me(); if (!p || g.phase !== "play" || !g.inst || !g.inst.onPos || g.t < g.go) return;
    const num = (v) => (typeof v === "number" && isFinite(v) ? v : 0);
    g.inst.onPos(p.id, { x: num(m.x), y: num(m.y), z: num(m.z), vx: num(m.vx), vy: num(m.vy), vz: num(m.vz), g: !!m.g, f: num(m.f), dv: num(m.dv), st: num(m.st), sp: num(m.sp), gr: !!m.gr });
  }));
  socket.on("pg:act", safe((m) => {
    if (!inGame() || !m || typeof m !== "object" || !ok()) return; const g = ctx.room.g; const p = me(); if (!p || g.phase !== "play" || !g.inst || !g.inst.onAct) return;
    if (g.t < g.go || g.endAt) return;
    const clean = { type: String(m.type || "").slice(0, 12), id: m.id == null ? null : String(m.id).slice(0, 24), x: Number(m.x) || 0, y: Number(m.y) || 0, v: Number(m.v) || 0 };
    g.inst.onAct(p.id, clean);
  }));
}
function onReconnect(room, p) {
  const g = room.g; if (!g) return; const s = g.api.io.sockets.sockets.get(p.socketId); if (!s) return;
  s.emit("pg:state", stateMsg(room, p.id));
  if ((g.phase === "play" || g.phase === "result") && g.scene) s.emit("pg:scene", sceneMsg(g));
}
function onLeave(room, p) {
  const g = room.g; if (!g) return; if (g.inputs[p.id]) g.inputs[p.id] = {};
  if (!members(room).length) onDestroy(room);
}
function onDisconnect(room, p) { const g = room.g; if (g && g.inputs) g.inputs[p.id] = {}; }

module.exports = { start, bind, onReconnect, onLeave, onDisconnect, onDestroy, canReturn: (room) => !!(room.g && room.g.over), step, standings, MODULES, SKILL, rd };

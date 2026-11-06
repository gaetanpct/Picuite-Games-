// ============================================================
// FART TOGETHER — Déroulement côté serveur
// Le serveur simule les bouées à 30 images par seconde et envoie l'état à 15 par seconde.
// Les joueurs envoient seulement un angle de visée et un bouton « pousser ».
// ============================================================
const Rules = require("./public/game/rules.js");
const W = require("./public/game/world.js");
const Phys = require("./ft-physics.js");
const Bot = require("./ft-bot.js");
const Lv = require("./ft-levels.js");

const TS = Math.max(0.001, Number(process.env.FT_TIME_SCALE) || 1);
const DT = 1 / 30;
const rng = Math.random;
const shuffle = (a) => { const r = a.slice(); for (let i = r.length - 1; i > 0; i--) { const j = Math.floor(rng() * (i + 1)); [r[i], r[j]] = [r[j], r[i]]; } return r; };
const present = (room) => room.players.filter((p) => !p.left);
const byId = (room, id) => room.players.find((p) => p.id === id);
const r2 = (v) => Math.round(v * 100) / 100;
const AB_IDS = Object.keys(Phys.ABIL);
const BOT_LEVEL = { naif: "stagiaire", fute: "matelot", genie: "capitaine", stagiaire: "stagiaire", matelot: "matelot", capitaine: "capitaine" };
const GARAGE_MS = 25000 * TS, COUNT_MS = 3400 * TS, RESULT_MS = 22000 * TS;

// ---------- niveaux ----------
function dayNumber() { const d = new Date(); return d.getFullYear() * 10000 + (d.getMonth() + 1) * 100 + d.getDate(); }
function buildArena(seed) {
  const lv = Lv.makeLevel({ id: "arene", name: "L'Arène des Bulles", biome: "parc", par: 90, recipe: [["pool", 150], ["pool", 150]] }, seed, {});
  const rnd = Lv.mulberry32(seed + 5); lv.coins = [];
  for (let i = 0; i < 70; i++) { const s = 12 + rnd() * (lv.L - 30); const p = W.pointAt(lv, s); const lat = (rnd() * 2 - 1) * (p.hw - 3); lv.coins.push({ x: p.x - p.tz * lat, z: p.z + p.tx * lat }); }
  lv.obstacles = []; for (let i = 0; i < 7; i++) { const p = W.pointAt(lv, 30 + i * 38); const lat = (rnd() * 2 - 1) * 7; lv.obstacles.push({ id: i, x: p.x - p.tz * lat, z: p.z + p.tx * lat, r: 1.5, kind: "bouee", mv: null }); }
  lv.ramps = []; lv.gates = []; lv.arena = true; return lv;
}
function planRuns(room, s, ids) {
  const diff = s.difficulty, seed0 = Math.floor(rng() * 1e9);
  const idxOf = (c) => Math.max(0, Lv.COURSES.findIndex((x) => x.id === c));
  const runs = [];
  const base = idxOf(s.course);
  if (s.mode === "aventure" || s.mode === "course") for (let i = 0; i < s.courses; i++) runs.push({ course: Lv.COURSES[(base + i) % 10].id, seed: seed0 + i, objective: s.objective });
  else if (s.mode === "chrono") for (let i = 0; i < s.attempts; i++) runs.push({ course: s.course, seed: seed0, objective: s.objective, attempt: i + 1 });
  else if (s.mode === "survie") runs.push({ course: "endless", seed: seed0, length: 1600, objective: "finir" });
  else if (s.mode === "infini") runs.push({ course: "endless", seed: seed0, length: 1800, objective: "finir", timer: 240 });
  else if (s.mode === "defis") { const c = Rules.CHALLENGES[s.challenge - 1]; runs.push({ course: c.course, seed: seed0, objective: c.objective, challenge: c }); }
  else if (s.mode === "arene") runs.push({ course: "arene", seed: seed0, objective: "pieces", timer: 90 });
  else if (s.mode === "quotidien") { const dn = dayNumber(); runs.push({ course: Lv.COURSES[dn % 10].id, seed: dn, objective: ["finir", "pieces", "oeuf", "portes"][dn % 4], daily: dn }); }
  return runs;
}
function buildLevel(spec, s) {
  const opts = { difficulty: s.difficulty };
  if (spec.course === "arene") return buildArena(spec.seed);
  if (spec.course === "endless") return Lv.makeLevel({ id: "infini", name: "La Rivière Sans Fin", biome: ["prairie", "jungle", "canyon", "parc", "fete"][spec.seed % 5], par: 600, recipe: Lv.endlessRecipe(spec.seed, spec.length) }, spec.seed, opts);
  return Lv.makeLevel(spec.course, spec.seed, opts);
}
function packLevel(lv) {
  const a = (arr) => arr.map(r2);
  return { id: lv.id, name: lv.name, biome: lv.biome, par: lv.par, L: r2(lv.L), n: lv.n, x: a(lv.x), z: a(lv.z), hw: a(lv.hw), flow: a(lv.flow), slope: a(lv.slope), zone: lv.zone, turb: lv.turb, h: a(lv.h), s: a(lv.s),
    obstacles: lv.obstacles.map((o) => ({ id: o.id, x: r2(o.x), z: r2(o.z), r: r2(o.r), kind: o.kind, mv: o.mv ? { ax: r2(o.mv.ax), az: r2(o.mv.az), amp: r2(o.mv.amp), f: r2(o.mv.f), ph: r2(o.mv.ph) } : null })),
    ramps: lv.ramps, coins: lv.coins.map((c) => [r2(c.x), r2(c.z)]), gates: lv.gates.map((g) => ({ x: r2(g.x), z: r2(g.z), hw: r2(g.hw), s: r2(g.s) })), arena: !!lv.arena, step: lv.step };
}

// ---------- départ ----------
function start(room, api) {
  const s = Rules.normalize(room.settings); const ids = present(room).map((p) => p.id);
  const g = room.g = { api, s, phase: "garage", until: 0, runs: [], runIdx: -1, run: null, garage: {}, scores: {}, stats: {}, history: [], timer: null, over: false, final: null, seq: 0 };
  room.players.forEach((p) => {
    g.garage[p.id] = { ab: p.isBot ? AB_IDS[Math.floor(rng() * 4)] : "rafale", hat: p.color % 8, face: 0, ready: !!p.isBot };
    g.scores[p.id] = 0; g.stats[p.id] = { push: 0, dry: 0, runs: 0 };
  });
  g.runs = planRuns(room, s, ids);
  api.sysChat(room, "Tout le monde sur la bouée. Mode " + s.mode + ", " + g.runs.length + " descente" + (g.runs.length > 1 ? "s" : "") + ".");
  g.timer = setInterval(() => { try { tick(room); } catch (e) { console.error("tick ft", e); } }, Math.round(DT * 1000));
  nextRun(room);
}
function onDestroy(room) { if (room.g && room.g.timer) { clearInterval(room.g.timer); room.g.timer = null; } }

function crewsFor(room, s) {
  const ids = shuffle(present(room).map((p) => p.id));
  const mode = ["course", "infini", "arene"].includes(s.mode) ? s.crew : "tous";
  if (mode === "tous" || ids.length < 2) return [ids];
  const size = mode === "solo" ? 1 : 2; const out = [];
  for (let i = 0; i < ids.length; i += size) out.push(ids.slice(i, i + size));
  if (out.length > 1 && out[out.length - 1].length < size && size === 2) { const last = out.pop(); out[out.length - 1] = out[out.length - 1].concat(last); }
  return out;
}
function nextRun(room) {
  const g = room.g; g.runIdx++;
  if (g.runIdx >= g.runs.length) return finish(room, false);
  const spec = g.runs[g.runIdx]; const lv = buildLevel(spec, g.s);
  const crews = crewsFor(room, g.s);
  const boats = crews.map((seats, bi) => {
    const row = Math.floor(bi / 3), colN = Math.min(3, crews.length - row * 3), col = bi % 3; const off = (col - (colN - 1) / 2) * 4.6;
    const p = W.pointAt(lv, Math.max(1, 14 - row * 5)); const b = Phys.newBoat(bi + 1, seats, p.x - p.tz * off, p.z + p.tx * off, Math.atan2(p.tx, p.tz));
    b.crew = seats.slice(); b.time = null; b.penalty = 0; b.gateIdx = 0; b.score = 0; return b;
  });
  const pl = {};
  room.players.forEach((p) => { if (p.left) return; const gar = g.garage[p.id] || { ab: "rafale" }; pl[p.id] = { a: 0, p: false, tank: 100 * Phys.ABIL[gar.ab].tank * g.s.tank, tm: g.s.tank, press: 0, ab: gar.ab, rest: 0, jitter: 0, dry: false, pushT: 0, dryN: 0, seen: 0 }; });
  g.run = { spec, lv, pack: packLevel(lv), boats, pl, bots: {}, t: 0, cg: new Set(), chaos: null, nextChaos: 10 + rng() * 6, ev: [], over: false, firstFin: null, cap: spec.timer || Math.min(420, Math.max(120, (lv.par || 100) * 3)), res: null, hiccupAt: 0 };
  room.players.forEach((p) => { if (g.garage[p.id]) g.garage[p.id].ready = !!p.isBot; });
  g.phase = "garage"; g.until = Date.now() + GARAGE_MS;
  sendLevel(room); emitAll(room);
}
function startCount(room) { const g = room.g; g.phase = "count"; g.until = Date.now() + COUNT_MS; emitAll(room); }
function startRun(room) { const g = room.g; g.phase = "run"; g.until = 0; g.run.t = 0; emitAll(room); g.api.emitAll(room, "ft:go", { t: 0 }); }

// ---------- boucle ----------
function active(p) { return p && !p.left && (p.isBot || p.connected); }
function botFor(room, p) { return p.isBot ? (BOT_LEVEL[p.level] || "matelot") : "matelot"; }
function tick(room) {
  const g = room.g; if (!g || g.over) return;
  const now = Date.now();
  if (g.phase === "garage") {
    const humans = present(room).filter((p) => !p.isBot && p.connected);
    if (now >= g.until || (humans.length && humans.every((p) => g.garage[p.id] && g.garage[p.id].ready))) startCount(room);
    return;
  }
  if (g.phase === "count") { if (now >= g.until) startRun(room); return; }
  if (g.phase === "result") { if (now >= g.until) nextRun(room); return; }
  if (g.phase !== "run") return;
  simulate(room);
}
function simulate(room) {
  const g = room.g, R = g.run, lv = R.lv, s = g.s; if (R.over) return;
  const env0 = { events: R.ev, hpOnCap: g.s.mode === "survie" ? 1 : 0, hpOnHit: g.s.mode === "survie", eggHit: R.spec.objective === "oeuf" };
  // chaos
  if (s.chaos || R.spec.daily) {
    if (R.chaos && R.t > R.chaos.until) R.chaos = null;
    if (!R.chaos && R.t >= R.nextChaos) {
      const kinds = ["gust", "mega", "hiccup", "wave", "invert"]; const k = kinds[Math.floor(rng() * kinds.length)];
      const c = { id: k, until: R.t + (k === "wave" ? 0.5 : 5), a: rng() * 6.28 };
      if (k === "hiccup") { const ids = Object.keys(R.pl); c.who = ids[Math.floor(rng() * ids.length)]; }
      if (k === "wave") R.boats.forEach((b) => { b.dlean += (rng() < 0.5 ? -1 : 1) * 2.4; });
      R.chaos = c; R.nextChaos = R.t + 12 + rng() * 6; R.ev.push({ k: "chaos", id: k, who: c.who });
    }
  }
  if (R.chaos) { const c = R.chaos; if (c.id === "gust") env0.gust = [Math.sin(c.a) * 5, Math.cos(c.a) * 5]; if (c.id === "mega") env0.gasMul = 1.8; if (c.id === "invert") env0.invert = true; }
  // commandes des robots et des absents
  room.players.forEach((p) => {
    if (p.left) return; const pl = R.pl[p.id]; if (!pl) return;
    const boat = R.boats.find((b) => b.seats.includes(p.id)); if (!boat) return;
    if (!active(p) || p.isBot) { const k = boat.seats.indexOf(p.id); const bt = R.bots[p.id] || (R.bots[p.id] = {}); const c = Bot.control(bt, boat, k, lv, R.t, R.pl, botFor(room, p), DT); pl.a = W.clampAim(boat.seats.length, k, c.a); pl.p = c.p; }
    pl.jitter = R.chaos && R.chaos.id === "hiccup" && R.chaos.who === p.id ? Math.sin(R.t * 7.3) * 0.9 : 0;
  });
  // physique
  R.boats.forEach((b) => {
    if (b.fin && R.spec.course !== "arene") { b.vx *= 0.96; b.vz *= 0.96; }
    b.seats.forEach((id) => { const pl = R.pl[id]; if (pl && pl.p && !b.cap && !b.air) { pl.pushT += DT; g.stats[id].push += DT; } if (pl && pl.dry && !pl.wasDry) { pl.dryN++; g.stats[id].dry++; } if (pl) pl.wasDry = pl.dry; });
    const prevS = b.s;
    const env = Object.assign({}, env0);
    const near = Phys.step(b, DT, R.t, lv, R.pl, env);
    // arène, on boucle
    if (lv.arena && b.s > lv.L - 10) { const p = W.pointAt(lv, 8); const lat = near.lat; b.x = p.x - p.tz * lat * 0.6; b.z = p.z + p.tx * lat * 0.6; b.s = 8; b.idx = 0; b.fin = false; }
    // pièces
    if (!b.dead) lv.coins.forEach((c, i) => { if (R.cg.has(i)) return; const dx = c.x - b.x, dz = c.z - b.z; if (dx * dx + dz * dz < 3.1 * 3.1) { R.cg.add(i); b.coins++; R.ev.push({ k: "coin", i, b: b.id }); } });
    // points de passage, au quart, à la moitié et aux trois quarts du parcours
    if (!lv.arena) { b.cp = b.cp || 0; while (b.cp < 3 && b.s >= lv.L * (0.25 * (b.cp + 1))) { R.ev.push({ k: "cp", b: b.id, i: b.cp + 1, t: r2(R.t) }); b.cp++; } }
    // portes
    while (b.gateIdx < lv.gates.length && b.s >= lv.gates[b.gateIdx].s) { const gt = lv.gates[b.gateIdx]; const ok = Math.abs(near.lat) <= gt.hw + 0.5 && !b.air; if (ok) b.gatesOk++; else b.gatesMiss++; R.ev.push({ k: "gate", b: b.id, ok, i: b.gateIdx }); b.gateIdx++; }
    if (b.fin && b.time === null) { b.time = r2(b.finT); R.ev.push({ k: "finish", b: b.id, t: b.time }); if (R.firstFin === null) R.firstFin = R.t; }
  });
  for (let i = 0; i < R.boats.length; i++) for (let j = i + 1; j < R.boats.length; j++) Phys.boatVsBoat(R.boats[i], R.boats[j], { events: R.ev });
  R.t += DT; R.n = (R.n || 0) + 1;
  if (R.n % 2 === 0) { sendSnap(room); }
  // fin de descente
  const all = R.boats.every((b) => b.fin || b.dead);
  let end = all;
  if (R.spec.timer && R.t >= R.spec.timer) end = true;
  if (!R.spec.timer && R.t >= R.cap) end = true;
  if (g.s.mode === "course" && R.firstFin !== null && R.t - R.firstFin > 20) end = true;
  if (end) finishRun(room);
}
function sendSnap(room) {
  const g = room.g, R = g.run;
  const snap = { t: r2(R.t), b: R.boats.map((b) => [b.id, r2(b.x), r2(b.z), Math.round(b.yaw * 1000) / 1000, Math.round(b.lean * 100) / 100, r2(b.y), (b.cap ? 1 : 0) | (b.air ? 2 : 0) | (b.fin ? 4 : 0) | (b.dead ? 8 : 0), b.hp, b.coins, Math.round(b.egg), Math.round(b.s), r2(b.vx), r2(b.vz), Math.round(b.right * 100) / 100]),
    p: Object.keys(R.pl).map((id) => { const pl = R.pl[id]; return [id, Math.round(pl.a * 100) / 100, pl.p ? 1 : 0, Math.round(100 * pl.tank / (pl.tankMax || 100)), pl.dry ? 1 : 0, Math.round(pl.press * 100) / 100]; }),
    ev: R.ev.splice(0), ch: R.chaos ? { id: R.chaos.id, who: R.chaos.who || null, left: r2(R.chaos.until - R.t) } : null };
  g.api.emitAll(room, "ft:snap", snap);
}

// ---------- résultat d'une descente ----------
function adjTime(R, b) {
  if (b.time === null) return null; let t = b.time;
  const o = R.spec.objective;
  if (o === "pieces") t -= b.coins * 1.5; else if (o === "oeuf" && b.egg <= 0) t += 15; else if (o === "portes") t += b.gatesMiss * 5;
  return r2(Math.max(b.time * 0.5, t));
}
function finishRun(room) {
  const g = room.g, R = g.run, s = g.s; if (R.over) return; R.over = true; sendSnap(room);
  const lv = R.lv, mode = s.mode;
  const rows = R.boats.map((b) => ({ boat: b.id, crew: b.crew.slice(), fin: b.fin, time: b.time, adj: adjTime(R, b), coins: b.coins, hits: b.hits, caps: b.caps, egg: Math.round(b.egg), gatesOk: b.gatesOk, gatesTotal: lv.gates.length, dist: Math.round(b.s), dead: b.dead, hp: b.hp }));
  let pts = {}; // points par bouée
  const finished = rows.filter((r) => r.fin).sort((a, b) => a.adj - b.adj);
  let note = "";
  if (mode === "aventure") { rows.forEach((r) => { let st = 0; if (r.fin) { st = 1; if (r.adj <= lv.par * 1.15) st = 2; if (r.adj <= lv.par * 0.95) st = 3; } r.stars = st; pts[r.boat] = st; }); }
  else if (mode === "course") { const table = [5, 3, 2, 1]; finished.forEach((r, i) => { pts[r.boat] = table[Math.min(i, 3)]; r.rank = i + 1; }); rows.forEach((r) => { if (pts[r.boat] === undefined) pts[r.boat] = 0; }); }
  else if (mode === "chrono") { rows.forEach((r) => { pts[r.boat] = 0; }); }
  else if (mode === "survie" || mode === "infini") { rows.forEach((r) => { pts[r.boat] = r.dist; }); }
  else if (mode === "arene") { rows.forEach((r) => { pts[r.boat] = r.coins; }); }
  else if (mode === "defis") { const ch = R.spec.challenge; rows.forEach((r) => { r.ok = ch.test({ fin: r.fin, coins: r.coins, hits: r.hits, time: r.adj === null ? 9999 : r.time, caps: r.caps, egg: r.egg, gatesOk: r.gatesOk, gatesTotal: r.gatesTotal }); pts[r.boat] = r.ok ? 1 : 0; }); note = ch.goal; }
  else if (mode === "quotidien") { rows.forEach((r) => { pts[r.boat] = r.fin ? Math.max(1, Math.round(1000 - (r.adj || 999) * 4)) : 0; }); }
  rows.forEach((r) => { r.pts = pts[r.boat] || 0; r.crew.forEach((id) => { if (g.scores[id] !== undefined) g.scores[id] += r.pts; if (g.stats[id]) g.stats[id].runs++; }); });
  if (mode === "chrono") rows.forEach((r) => { r.crew.forEach((id) => { const cur = g.best || (g.best = {}); if (r.adj !== null && (cur[id] === undefined || r.adj < cur[id])) cur[id] = r.adj; }); });
  const entry = { idx: g.runIdx, name: lv.name, course: R.spec.course, par: lv.par, rows, note, objective: R.spec.objective, daily: R.spec.daily || null, attempt: R.spec.attempt || null };
  g.history.push(entry); R.res = entry;
  g.phase = "result"; g.until = Date.now() + RESULT_MS; emitAll(room);
}
function bestTimes(g) { return g.best || {}; }

// ---------- fin de partie ----------
function standings(room) {
  const g = room.g; const mode = g.s.mode;
  const rows = room.players.map((p) => {
    let score = g.scores[p.id] || 0, label = "";
    if (mode === "chrono") { const b = bestTimes(g)[p.id]; score = b === undefined ? 0 : r2(1000 - b); label = b === undefined ? "Pas d'arrivée" : b.toFixed(1).replace(".", ",") + " s"; }
    else if (mode === "aventure") label = score + " étoile" + (score > 1 ? "s" : "");
    else if (mode === "course") label = score + " point" + (score > 1 ? "s" : "");
    else if (mode === "survie" || mode === "infini") label = score + " mètres";
    else if (mode === "arene") label = score + " bulle" + (score > 1 ? "s" : "");
    else if (mode === "defis") label = score ? "Défi réussi" : "Défi raté";
    else label = score + " point" + (score > 1 ? "s" : "");
    return { id: p.id, name: p.name, color: p.color, isBot: p.isBot, score, label, push: Math.round(g.stats[p.id].push), dry: g.stats[p.id].dry, left: !!p.left };
  });
  rows.sort((a, b) => b.score - a.score || b.push - a.push);
  let rk = 0; rows.forEach((r, i) => { if (i === 0 || r.score !== rows[i - 1].score) rk = i + 1; r.rank = rk; });
  return rows;
}
function awards(rows) {
  const out = []; const act = rows.filter((r) => !r.left);
  if (act.length < 2) return out;
  const top = act.slice().sort((a, b) => b.push - a.push)[0]; if (top && top.push > 5) out.push({ id: top.id, icon: "💨", title: "Le gros moteur", detail: top.push + " secondes de poussée" });
  const sage = act.slice().sort((a, b) => a.push - b.push)[0]; if (sage && sage.id !== (top && top.id) && sage.push > 0) out.push({ id: sage.id, icon: "🧘", title: "Le sage", detail: "Il pousse peu, mais juste" });
  const dry = act.slice().sort((a, b) => b.dry - a.dry)[0]; if (dry && dry.dry >= 1) out.push({ id: dry.id, icon: "🫗", title: "À sec", detail: "Réservoir vide " + dry.dry + " fois" });
  return out;
}
function finish(room, aborted) {
  const g = room.g; if (g.over) return; g.over = true; g.phase = "over"; if (g.timer) { clearInterval(g.timer); g.timer = null; }
  const rows = standings(room);
  g.final = { mode: g.s.mode, rows, awards: awards(rows), history: g.history, aborted: !!aborted };
  emitAll(room); g.api.emitAll(room, "ft:over", g.final);
}

// ---------- état envoyé ----------
function publicState(room, forId) {
  const g = room.g, R = g.run; const spec = g.runs[Math.min(g.runIdx, g.runs.length - 1)];
  const st = { phase: g.phase, left: g.until ? Math.max(0, g.until - Date.now()) : 0, mode: g.s.mode, chaos: g.s.chaos, sfx: g.s.sfx, runIdx: g.runIdx, runs: g.runs.length, you: forId, seq: ++g.seq,
    garage: g.garage, scores: g.scores, best: bestTimes(g) };
  if (R) {
    st.crews = R.boats.map((b) => ({ id: b.id, seats: b.seats }));
    st.course = { id: R.lv.id, name: R.lv.name, biome: R.lv.biome, par: R.lv.par, L: r2(R.lv.L), objective: R.spec.objective, timer: R.spec.timer || 0, daily: R.spec.daily || 0, goal: R.spec.challenge ? R.spec.challenge.goal : "", attempt: R.spec.attempt || 0, gates: R.lv.gates.length, blurb: (Lv.COURSES.find((c) => c.id === R.spec.course) || {}).blurb || "" };
    st.coinsGot = Array.from(R.cg);
  }
  if (g.phase === "result" && R && R.res) st.result = R.res;
  return st;
}
function sendTo(room, sock, p) { try { sock.emit("ft:state", publicState(room, p.id)); } catch (e) { console.error("ft emit", e); } }
function emitAll(room) { const g = room.g; if (!g) return; room.players.forEach((p) => { if (p.isBot || !p.socketId) return; const s = g.api.io.sockets.sockets.get(p.socketId); if (s) sendTo(room, s, p); }); }
function sendLevel(room) { const g = room.g; if (!g.run) return; g.api.emitAll(room, "ft:level", { idx: g.runIdx, level: g.run.pack }); }

// ---------- sockets ----------
function bind(socket, helpers, api) {
  const { ctx, me, safe, toast } = helpers;
  const cur = () => { const room = ctx.room; const p = me(); return room && room.g && p ? { room, g: room.g, p } : null; };
  let lastIn = 0;
  socket.on("ft:in", safe((d) => {
    const c = cur(); if (!c || c.g.phase !== "run" || !c.g.run) return; const pl = c.g.run.pl[c.p.id]; if (!pl) return;
    const now = Date.now(); if (now - lastIn < 25) return; lastIn = now;
    let a = Number(d && d.a); if (!isFinite(a)) a = 0; while (a > Math.PI) a -= 2 * Math.PI; while (a < -Math.PI) a += 2 * Math.PI;
    const bt = c.g.run.boats.find((b) => b.seats.includes(c.p.id)); if (bt) a = W.clampAim(bt.seats.length, bt.seats.indexOf(c.p.id), a); // chacun reste dans sa zone
    pl.a = a; pl.p = !!(d && d.p);
  }));
  socket.on("ft:garage", safe((d) => {
    const c = cur(); if (!c || (c.g.phase !== "garage" && c.g.phase !== "result")) return; const ga = c.g.garage[c.p.id]; if (!ga) return;
    if (d && AB_IDS.includes(d.ab)) ga.ab = d.ab;
    if (d && Number.isInteger(d.hat) && d.hat >= 0 && d.hat < 12) ga.hat = d.hat;
    if (d && Number.isInteger(d.face) && d.face >= 0 && d.face < 8) ga.face = d.face;
    emitAll(c.room);
  }));
  socket.on("ft:ready", safe((d) => {
    const c = cur(); if (!c || c.g.phase !== "garage") return; const ga = c.g.garage[c.p.id]; if (!ga) return; ga.ready = d ? !!d.v : !ga.ready; emitAll(c.room);
  }));
  socket.on("ft:next", safe(() => {
    const c = cur(); if (!c || !helpers.isHost()) return;
    if (c.g.phase === "result") nextRun(c.room); else if (c.g.phase === "garage") startCount(c.room);
  }));
}
function onReconnect(room, p) { const g = room.g; if (!g) return; const s = g.api.io.sockets.sockets.get(p.socketId); if (s) { if (g.run) s.emit("ft:level", { idx: g.runIdx, level: g.run.pack }); sendTo(room, s, p); if (g.over && g.final) s.emit("ft:over", g.final); } }
function onLeave(room, p) {
  const g = room.g; if (!g) return;
  if (!room.players.some((x) => !x.isBot && !x.left)) return onDestroy(room);
  if (g.phase === "garage" && g.run) emitAll(room);
}
module.exports = { start, bind, onReconnect, onLeave, onDestroy, canReturn: (room) => !!(room.g && room.g.over), publicState, standings, packLevel, buildLevel };

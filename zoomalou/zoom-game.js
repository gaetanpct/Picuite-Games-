// ============================================================
// ZOOMALOU — Déroulement d'une partie côté serveur
// Les clients pilotent leur voiture localement et envoient leurs commandes.
// Le serveur rejoue les commandes avec la même physique pour valider chaque temps.
// ============================================================
const Track = require("./public/game/track.js");
const Car = require("./public/game/car.js");
const Rules = require("./public/game/rules.js");
const Bot = require("./zoom-bot.js");

const TS = Math.max(0.001, Number(process.env.ZOOM_TIME_SCALE) || 1);
const INTRO_MS = 3500 * TS, ROUND_END_MS = 12000 * TS, FIRST_GO_MS = 3000, NEXT_GO_MS = 1300;
const IDLE_MS = 40000 * TS;
const isChrono = (s) => s.mode === "chrono" || s.mode === "contact";
const CHRONO_PTS = [6, 4, 3, 2, 1, 1, 1, 1];
const BOT_GAP = 1.5; // secondes de jeu entre deux essais d'un automate
const BOT_LAG = { debutant: 26, moyen: 18, champion: 13, prodige: 9 }, BOT_REACT = { debutant: 1.6, moyen: 1.0, champion: 0.6, prodige: 0.35 };
const rng = Math.random;
// durée maximale calculée pour un essai d'automate. Un circuit géant avec la voiture la plus lente dépasse 4 minutes
const capOf = (tr) => Math.max(240, Math.ceil(tr.length / 11));
const pName = (room, id) => { const p = room.players.find((x) => x.id === id); return p ? p.name : "?"; };
const defOf = (room, id) => room.players.find((p) => p.id === id);
const fix1 = (v) => Math.round(v * 10) / 10;
const fmt = (t) => t.toFixed(2).replace(".", ",") + " s";

function start(room, api) {
  const s = room.settings;
  const baseSeed = s.seed && s.seed.trim() ? s.seed.trim() : Math.random().toString(36).slice(2, 8);
  const g = room.g = { api, baseSeed, roundIdx: -1, total: s.rounds, phase: "idle", phaseUntil: 0, track: null, trackMsg: null, author: 0, players: {}, order: [], turn: null, record: null, history: [], timer: null, over: false, raceEnd: 0, lastSnap: 0, results: null, car: Car.CAR_ORDER[0] };
  room.players.forEach((p) => { g.players[p.id] = { id: p.id, car: g.car, ready: false, pts: 0, wins: 0, best: null, bestBytes: null, bestCar: null, pos: null, att: null, feed: null, tries: 0, finishes: 0, total: 0, bestAll: null }; });
  api.sysChat(room, "Les circuits se jouent avec la graine " + baseSeed + ".");
  g.timer = setInterval(() => { try { tick(room); } catch (e) { console.error("tick zoom", e); } }, 50);
  startRound(room);
}
function onDestroy(room) { if (room.g && room.g.timer) { clearInterval(room.g.timer); room.g.timer = null; } }

const botLevelOf = (def) => (def.isBot ? def.level : "moyen");
const isAuto = (room, def) => def.isBot || (!def.connected && def.absentAuto);

// ---------- manche ----------
function startRound(room) {
  const g = room.g, s = room.settings;
  g.roundIdx++; if (g.roundIdx >= g.total) return finishMatch(room);
  g.track = Rules.trackFor(s, g.baseSeed, g.roundIdx); g.author = 0;
  g.trackMsg = Object.assign({}, g.track); delete g.trackMsg.spec;
  g.turn = null; g.record = null; g.results = null; g.raceEnd = 0;
  Object.values(g.players).forEach((P) => { if (P.best != null && (P.bestAll == null || P.best < P.bestAll)) P.bestAll = P.best; P.ready = false; P.best = null; P.bestBytes = null; P.pos = null; P.att = null; P.tries = 0; P.finishes = 0; P.feed = null; P.car = g.car; P.tryCount = 0; P.bestFrames = null; P.bestCar = null; P.fuel = 0; P.out = false; P.done = false; P.botDone = false; });
  g.elim = []; g.stage = "open"; g.turnSeq = 0; g.target = null;
  const seats = room.players.map((p) => p.id);
  if (s.mode === "essence") {
    if (s.order === "retard") { const st = standings(room); const byRank = st.slice().reverse().map((r) => r.id); g.order = byRank.length === seats.length ? byRank : seats; }
    else { const k = g.roundIdx % seats.length; g.order = seats.slice(k).concat(seats.slice(0, k)); }
  } else g.order = seats.slice();
  const nSeat = room.players.length; g.slots = {}; room.players.forEach((p, i) => { g.slots[p.id] = isChrono(s) ? +Car.gridSlot(g.track, i, nSeat).toFixed(2) : 0; });
  g.goAt = 0; g.phase = "garage"; g.phaseUntil = Date.now() + s.garage * 1000 * TS;
  g.api.emitAll(room, "z:round", roundMsg(room));
  prepareBots(room); emitState(room);
}
function roundMsg(room) { const g = room.g; return { now: Date.now(), index: g.roundIdx, total: g.total, mode: room.settings.mode, track: g.trackMsg, author: g.author, car: g.car, order: g.order, slots: g.slots }; }
// les pilotes automatiques étudient le circuit pendant le garage, et le temps de l'auteur se calcule avec la voiture choisie
function prepareBots(room) {
  const g = room.g, track = g.track, car = g.car; const levels = new Set(["prodige"]); room.players.forEach((d) => { if (d.isBot) levels.add(botLevelOf(d)); });
  levels.forEach((lv) => Bot.prepare(track, car, lv, null, "", () => {
    if (lv !== "prodige" || g.track !== track || g.car !== car) return;
    const r = Bot.simulateRun(track, car, "prodige", "author" + g.roundIdx, capOf(track)); g.author = r.finished ? +r.time.toFixed(2) : 0; g.api.emitAll(room, "z:author", { time: g.author, car });
  }));
}

function beginDrive(room) {
  const g = room.g, s = room.settings;
  if (isChrono(s)) {
    g.extended = false; g.allDoneAt = 0; g.goAt = Date.now() + 4200; g.phase = "race"; g.raceEnd = g.goAt + s.roundTime * 1000 * TS; g.phaseUntil = g.raceEnd;
    room.players.forEach((def) => { const P = g.players[def.id]; P.plan = null; P.planning = false; P.nextAt = 0; P.botN = 0; });
    g.api.sysChat(room, "Tout le monde sur la ligne, départ dans quelques secondes. Vous avez ensuite " + s.roundTime + " secondes pour signer votre meilleur temps" + (s.mode === "contact" ? ", et les voitures se touchent." : "."));
  } else { g.phase = "turns"; g.turnIdx = -1; nextTurn(room); }
  emitState(room);
}

// ---------- mode chrono, pilotes automatiques ----------
// un automate enchaîne des essais, à la suite et sans jamais s'arrêter. Chaque essai est calculé juste avant de partir,
// en s'inspirant du meilleur temps déjà posé par un autre pilote.
function botRefFrames(room, selfId) {
  const g = room.g; let best = null;
  room.players.forEach((d) => { if (d.id === selfId) return; const P = g.players[d.id]; if (P.best == null || !P.bestFrames) return; if (!best || P.best < best.t) best = { t: P.best, frames: P.bestFrames, pid: d.id }; });
  return best;
}
function planBotAttempt(room, def) {
  const g = room.g, P = g.players[def.id]; P.planning = true; const lvl = botLevelOf(def); const track = g.track; const rf = botRefFrames(room, def.id);
  const use = rf && (P.best == null || rf.t < P.best) ? rf : null; const tag = use ? use.pid + ":" + use.t.toFixed(2) : ""; const k = P.botN || 0; const slot = g.slots[def.id] || 0;
  Bot.prepare(track, P.car, lvl, use && use.frames, tag, () => {
    P.planning = false; if (g.track !== track || g.phase !== "race") return;
    const r = Bot.simulateRun(track, P.car, lvl, g.baseSeed + def.id + g.roundIdx + "k" + k, capOf(track), { slot, ref: use && use.frames, refTag: tag, push: k }); P.botN = k + 1;
    const now = Date.now(); const at = Math.max(g.goAt, P.nextAt || 0, now + 50);
    if (!r.finished) { P.botDone = true; P.done = true; return; }
    const rp = Car.replay(track, P.car, r.bytes, null, { slot });
    P.plan = { at, dur: r.time * 1000 * TS, time: r.time, frames: rp.frames, bytes: r.bytes, car: P.car, slot, done: false }; P.tryCount = (P.tryCount || 0) + 1; P.botDone = true;
  });
}
function tickBots(room, now) {
  const g = room.g;
  room.players.forEach((def) => {
    if (!isAuto(room, def)) return; const P = g.players[def.id]; const pl = P.plan;
    if (pl && !pl.done) {
      if (now >= pl.at + pl.dur) { pl.done = true; P.done = true; P.feed = null; P.nextAt = pl.at + pl.dur + NEXT_GO_MS; if (pl.at + pl.dur <= g.raceEnd + 500) acceptTime(room, def.id, pl.time, pl.bytes, pl.car, pl.frames); }
      else if (now >= pl.at) { const n = pl.frames.length / 8; const k = Math.min(n - 1, Math.floor(((now - pl.at) / pl.dur) * (n - 1))); const f = pl.frames; P.feed = { x: f[k * 8], y: f[k * 8 + 1], z: f[k * 8 + 2], h: f[k * 8 + 3], p: f[k * 8 + 4], a: f[k * 8 + 5], b: f[k * 8 + 6], i: f[k * 8 + 7], car: pl.car }; } else P.feed = null;
      return;
    }
    P.feed = null;
    // un seul essai par course, comme les humains
    if (P.botDone) return;
    if (!P.planning && now < g.raceEnd - 4000 * TS && now >= (P.nextAt || 0) - 1500) planBotAttempt(room, def);
  });
}

// ---------- temps validés ----------
function acceptTime(room, pid, time, bytes, carId, frames) {
  const g = room.g; const P = g.players[pid]; const def = defOf(room, pid);
  P.finishes++;
  if (P.best == null || time < P.best) { P.best = time; P.bestBytes = bytes; P.bestCar = carId; P.bestFrames = frames || null; }
  if (P.bestAll == null || time < P.bestAll) P.bestAll = time;
  g.api.sysChat(room, def.name + " termine en " + fmt(time) + ".");
  emitState(room);
}

// ---------- mode essence ----------
// Au début de la course chaque pilote pose un temps, sans limite d'essence. Ensuite le dernier du classement joue avec toute son essence
// pour battre l'avant-dernier. Tant qu'il reste dernier c'est encore à lui. Sans essence il est éliminé. Le dernier survivant gagne.
const timeOf = (P) => (P.best == null ? 1e9 : P.best);
function aliveRank(room) {
  const g = room.g; const seats = room.players.map((p) => p.id);
  return seats.filter((id) => !g.players[id].out).sort((a, b) => timeOf(g.players[a]) - timeOf(g.players[b]) || seats.indexOf(a) - seats.indexOf(b));
}
function recordOf(room, id) { const g = room.g; const P = g.players[id]; if (!P || P.best == null) return null; return { time: P.best, pid: id, car: P.bestCar || P.car, frames: P.bestFrames || (P.bestBytes ? Car.replay(g.track, P.bestCar || P.car, P.bestBytes).frames : null) }; }
function setRecord(room, rec) {
  const g = room.g; g.record = rec; if (rec) g.api.emitAll(room, "z:record", { time: rec.time, pid: rec.pid, car: rec.car, frames: rec.frames });
}
function eliminate(room, pid, why) {
  const g = room.g; const P = g.players[pid]; if (!P || P.out) return; P.out = true; P.fuel = 0; g.elim.push(pid);
  g.api.sysChat(room, pName(room, pid) + (why === "quit" ? " abandonne et sort de la course." : " n'a plus d'essence et sort de la course."));
}
function startDuel(room) {
  const g = room.g, s = room.settings; g.stage = "duel";
  const times = room.players.map((p) => g.players[p.id].best).filter((v) => v != null); const tmin = times.length ? Math.min.apply(null, times) : (g.author || 30);
  const tank = s.tankMode === "fixe" ? s.tankSeconds : fix1(Math.max(5, s.tankFactor * tmin));
  Object.values(g.players).forEach((P) => { P.fuel = tank; });
  g.api.sysChat(room, "Tout le monde a posé un temps. Le dernier joue maintenant avec " + Math.round(tank) + " secondes d'essence pour battre l'avant-dernier.");
}
function makeTurn(room, pid, role, fuel) {
  const g = room.g; const P = g.players[pid]; g.turnSeq++;
  g.turn = { idx: g.turnSeq, pid, role, fuel, fuelLeft: fuel, introUntil: Date.now() + INTRO_MS, lastActive: Date.now() + INTRO_MS, att: null, tries: 0, bestTime: null, bestBytes: null, bestFrames: null, car: P.car, ended: false, auto: null, attempts: 0, result: "" };
  P.pos = null; P.att = null; g.phase = "turns";
}
function nextTurn(room) {
  const g = room.g, s = room.settings;
  if (g.endAfterGap) { g.endAfterGap = false; return endRound(room); }
  if (g.stage === "open") {
    g.turnIdx++;
    if (g.turnIdx < g.order.length) {
      const pid = g.order[g.turnIdx]; makeTurn(room, pid, "open", 0);
      g.api.emitAll(room, "z:turn", turnMsg(room));
      g.api.sysChat(room, pName(room, pid) + (g.turnIdx === 0 ? " ouvre la course et pose un temps." : " pose son temps."));
      emitState(room); return;
    }
    startDuel(room);
  }
  for (;;) {
    const alive = aliveRank(room);
    if (alive.length <= 1) return endRound(room);
    const worst = alive[alive.length - 1], tgt = alive[alive.length - 2]; const P = g.players[worst];
    if (P.fuel <= 0.05) { eliminate(room, worst, "dry"); continue; }
    setRecord(room, recordOf(room, tgt) || { time: 999, pid: tgt, car: g.car, frames: null });
    makeTurn(room, worst, "duel", fix1(P.fuel));
    g.api.emitAll(room, "z:turn", turnMsg(room));
    g.api.sysChat(room, pName(room, worst) + " est dernier. Il a " + Math.round(P.fuel) + " secondes d'essence pour battre " + pName(room, tgt) + " et ses " + fmt(g.record.time) + ".");
    emitState(room); return;
  }
}
function turnMsg(room) {
  const g = room.g, t = g.turn; if (!t) return null;
  return { now: Date.now(), idx: t.idx, count: g.order.length, pid: t.pid, role: t.role, fuel: t.fuel, fuelLeft: t.fuelLeft, introUntil: t.introUntil, refTries: room.settings.refTries, tries: t.tries, alive: aliveRank(room).length,
    record: g.record ? { time: g.record.time, pid: g.record.pid, car: g.record.car, frames: g.record.frames } : null };
}
function finishTurn(room, result) {
  const g = room.g, s = room.settings, t = g.turn; if (!t || t.ended) return; t.ended = true; t.result = result;
  const P = g.players[t.pid]; const def = defOf(room, t.pid);
  if (t.role === "open") {
    if (t.bestTime != null) {
      P.best = t.bestTime; P.bestBytes = t.bestBytes; P.bestFrames = t.bestFrames; P.bestCar = t.car;
      if (!g.record || t.bestTime < g.record.time) setRecord(room, recordFrom(room, t.pid, t.bestTime, t.bestBytes, t.car, t.bestFrames));
    }
  } else {
    P.fuel = Math.max(0, t.fuelLeft);
    if (result === "beat") {
      const tgt = g.record ? pName(room, g.record.pid) : "?";
      P.best = t.bestTime; P.bestBytes = t.bestBytes; P.bestFrames = t.bestFrames; P.bestCar = t.car;
      g.api.sysChat(room, def.name + " bat " + tgt + " avec " + fmt(t.bestTime) + " et n'est plus dernier.");
    } else { eliminate(room, t.pid, result === "quit" ? "quit" : "dry"); if (result === "quit" && s.giveUp === "fin") g.endAfterGap = true; }
  }
  g.api.emitAll(room, "z:turnEnd", { pid: t.pid, result, time: t.bestTime, role: t.role });
  g.phase = "turnGap"; g.phaseUntil = Date.now() + 2200 * TS; g.gapNext = true;
  emitState(room);
}
function recordFrom(room, pid, time, bytes, carId, frames) {
  const g = room.g; const rp = frames ? { frames } : Car.replay(g.track, carId, bytes); return { time, pid, car: carId, frames: rp.frames };
}

// un automate joue son tour en direct, essai après essai, avec une vraie consommation d'essence.
// Le plan est calculé d'avance (la physique est déterministe), puis rejoué à l'écran à la vitesse choisie.
// Chaque essai s'inspire du record en cours et prend un peu plus de risques que le précédent.
// Un essai commencé va toujours à son terme, même si le réservoir se vide en route.
const recIdxAt = (frames, t) => { const n = frames.length / 8; const k = Math.min(n - 1, Math.max(0, Math.round(t * 10))); return frames[k * 8 + 7]; };
function botAttempt(room, P, lvl, seed, fuelLeft, k) {
  const g = room.g; const rec = g.record; const tag = rec ? "rec" + rec.pid + rec.time.toFixed(2) : "";
  const r = Bot.simulateRun(g.track, P.car, lvl, seed, capOf(g.track), { ref: rec && rec.frames, refTag: tag, push: k });
  const rp = Car.replay(g.track, P.car, r.bytes); const fr = rp.frames; const nF = fr.length / 8;
  const lag = (BOT_LAG[lvl] || 18) * (0.8 + rng() * 0.5), react = (BOT_REACT[lvl] || 1) * (0.6 + rng() * 0.8);
  let abandon = null; const rtime = rec ? rec.time : Infinity;
  const persist = rng() < ({ debutant: 0.4, moyen: 0.3, champion: 0.2, prodige: 0.1 }[lvl] || 0.25);
  if (!persist && rec && rec.frames.length >= 16) for (let q = 80; q < nF; q++) { const tt = q / 10; if (fr[q * 8 + 7] < recIdxAt(rec.frames, tt) - lag) { abandon = tt + react; break; } }
  const fullT = r.finished ? r.time : Infinity; if (!r.finished) abandon = Math.min(abandon == null ? 1e9 : abandon, 25);
  const cut = (dur) => fr.slice(0, Math.min(nF, Math.floor(dur * 10) + 2) * 8);
  if (r.finished && rec && r.time < rtime && (abandon == null || abandon >= r.time)) return { kind: "beat", dur: r.time, burn: Math.min(r.time, fuelLeft), frames: fr, time: r.time, bytes: r.bytes };
  let dur = abandon != null && abandon < fullT ? abandon : fullT; dur = Math.min(dur, rtime + 0.4);
  return { kind: dur >= fullT ? "slow" : "abandon", dur, burn: Math.min(dur, fuelLeft), frames: cut(dur), time: null, bytes: null };
}
function botTurn(room) {
  const g = room.g, s = room.settings, t = g.turn; const def = defOf(room, t.pid); const P = g.players[t.pid]; const lvl = botLevelOf(def);
  const segs = []; let clock = 0; let result = "dry"; let n = 0; let fuelEnd = 0;
  if (t.role === "open") {
    for (let k = 0; k < s.refTries; k++) {
      const r = Bot.simulateRun(g.track, P.car, lvl, g.baseSeed + t.pid + g.roundIdx + "s" + k, capOf(g.track)); if (!r.finished) continue;
      const rp = Car.replay(g.track, P.car, r.bytes); segs.push({ t0: clock, dur: r.time, burn: 0, kind: "set", frames: rp.frames }); clock += r.time + BOT_GAP;
      if (t.bestTime == null || r.time < t.bestTime) { t.bestTime = r.time; t.bestBytes = r.bytes; t.bestFrames = rp.frames; }
    }
    if (t.bestTime == null) { const fb = Bot.simulateRun(g.track, "bolide", "debutant", "x", Math.max(400, capOf(g.track) + 100)); const rp = Car.replay(g.track, "bolide", fb.bytes); t.bestTime = (fb.finished ? fb.time : g.author * 1.6 + 20); t.bestBytes = fb.bytes; t.bestFrames = rp.frames; t.car = "bolide"; segs.push({ t0: 0, dur: Math.min(t.bestTime, 60), burn: 0, kind: "set", frames: rp.frames }); clock = Math.min(t.bestTime, 60) + BOT_GAP; }
    result = "set";
  } else {
    let fuel = t.fuel;
    while (fuel > 0.5 && n < 15) {
      const at = botAttempt(room, P, lvl, g.baseSeed + t.pid + g.roundIdx + "c" + n + "d" + g.turnSeq, fuel, n); n++;
      segs.push({ t0: clock, dur: at.dur, burn: at.burn, kind: at.kind, frames: at.frames }); clock += at.dur + BOT_GAP; fuel -= at.burn;
      if (at.time != null && (P.best == null || at.time < P.best) && at.kind !== "beat") { /* temps meilleur que le sien mais pas assez */ }
      if (at.kind === "beat") { result = "beat"; t.bestTime = at.time; t.bestBytes = at.bytes; t.bestFrames = at.frames; break; }
    }
    fuelEnd = Math.max(0, fuel);
  }
  t.attempts = segs.length;
  const rate = Math.max(1, Number(s.botPace) || 1) / TS;
  t.auto = { startAt: Date.now() + 700 * TS, rate, segs, total: clock, result, fuel: t.fuel, fuelEnd };
  g.api.emitAll(room, "z:botTurn", { pid: t.pid, now: Date.now(), startAt: t.auto.startAt, rate, fuel: t.fuel, total: clock, result, role: t.role, segs: segs.map((x) => ({ t0: x.t0, dur: x.dur, burn: x.burn, kind: x.kind })) });
}
// l'automate étudie d'abord le circuit et le record, puis joue son tour
function prepareTurn(room) {
  const g = room.g, t = g.turn; const def = defOf(room, t.pid); const P = g.players[t.pid]; const lvl = botLevelOf(def); const rec = g.record; const tag = rec ? "rec" + rec.pid + rec.time.toFixed(2) : "";
  Bot.prepare(g.track, P.car, lvl, rec && rec.frames, tag, () => { if (g.turn !== t || t.ended || t.auto) return; botTurn(room); });
}
function tickTurn(room, now) {
  const g = room.g, s = room.settings, t = g.turn; if (!t || t.ended) return;
  const def = defOf(room, t.pid); if (!def) { finishTurn(room, "dry"); return; }
  const P = g.players[t.pid];
  if (now < t.introUntil) return;
  if (t.auto) {
    const a = t.auto; const e = (now - a.startAt) / 1000 * a.rate;
    if (e >= a.total) { P.feed = null; t.fuelLeft = a.result === "dry" ? 0 : Math.max(0, a.fuelEnd || 0); finishTurn(room, a.result); return; }
    if (e < 0) { P.feed = null; return; }
    let seg = a.segs[a.segs.length - 1], idx = a.segs.length - 1, burned = 0;
    for (let i = 0; i < a.segs.length; i++) { const sg = a.segs[i]; if (e < sg.t0 + sg.dur + BOT_GAP) { seg = sg; idx = i; break; } burned += sg.burn; }
    const local = e - seg.t0; const f = seg.frames; const nF = f.length / 8 - 1;
    const k = Math.max(0, Math.min(nF, Math.floor(Math.min(local, seg.dur) * 10)));
    P.feed = { x: f[k * 8], y: f[k * 8 + 1], z: f[k * 8 + 2], h: f[k * 8 + 3], p: f[k * 8 + 4], a: f[k * 8 + 5], b: f[k * 8 + 6], i: f[k * 8 + 7], car: P.car };
    if (a.fuel > 0) t.fuelLeft = Math.max(0, fix1(a.fuel - burned - (local > 0 ? Math.min(local, seg.burn > 0 ? seg.burn : 0, seg.dur) : 0)));
    t.tries = idx + 1; return;
  }
  if (isAuto(room, def) || (!t.att && now - t.lastActive > IDLE_MS)) {
    if (!t.prepping) { t.prepping = true; if (!def.isBot) g.api.sysChat(room, def.name + " tarde trop, un automate prend le volant."); prepareTurn(room); }
    return;
  }
  if (t.att) {
    const elapsed = (now - t.att.goAt) / 1000;
    // réservoir vide en plein essai. On laisse finir l'essai, sauf s'il ne peut plus battre le record
    if (t.role === "duel" && g.record && elapsed > (t.att.fuelLeft || 0) && elapsed > g.record.time + 1.5) { t.fuelLeft = 0; t.att = null; P.att = null; P.pos = null; finishTurn(room, "dry"); return; }
    if (elapsed > 600) { t.att = null; P.att = null; }
  }
}

// ---------- fin de manche ----------
function endRound(room) {
  const g = room.g, s = room.settings;
  g.phase = "roundEnd"; g.phaseUntil = Date.now() + ROUND_END_MS; g.turn = null;
  const ps = Object.values(g.players);
  const timed = ps.filter((P) => P.best != null).sort((a, b) => a.best - b.best);
  let winner = null, second = null;
  const pts = {}; ps.forEach((P) => { pts[P.id] = 0; });
  if (isChrono(s)) { timed.forEach((P, i) => { pts[P.id] = CHRONO_PTS[Math.min(i, CHRONO_PTS.length - 1)]; }); winner = timed[0] ? timed[0].id : null; }
  else {
    const alive = aliveRank(room); winner = alive[0] || (timed[0] && timed[0].id) || null; if (winner) pts[winner] = 3;
    second = g.elim.length ? g.elim[g.elim.length - 1] : (alive[1] || null);
    if (second && second !== winner) pts[second] = 1;
  }
  if (winner) g.players[winner].wins++;
  ps.forEach((P) => { P.pts += pts[P.id] || 0; });
  const rows = ps.map((P) => ({ id: P.id, best: P.best, car: P.car, tries: P.tryCount || 0, pts: pts[P.id] || 0, total: P.pts, finishes: P.finishes, winner: P.id === winner })).sort((a, b) => (a.best == null) - (b.best == null) || a.best - b.best);
  g.history.push({ track: g.track.name, biome: g.track.biome, rows: rows.map((r) => ({ id: r.id, best: r.best, pts: r.pts })) });
  g.api.emitAll(room, "z:roundEnd", { index: g.roundIdx, track: g.track.name, author: g.author, rows, winner, last: g.roundIdx + 1 >= g.total, until: g.phaseUntil, now: Date.now(), mode: s.mode, recordTime: winner && g.players[winner].best != null ? g.players[winner].best : null });
  
  emitState(room);
}
function standings(room) {
  const g = room.g;
  const rows = room.players.map((def) => { const P = g.players[def.id]; if (P.best != null && (P.bestAll == null || P.best < P.bestAll)) P.bestAll = P.best; return { id: def.id, name: def.name, color: def.color, isBot: def.isBot, pts: P.pts, wins: P.wins, bestAll: P.bestAll, left: !!def.left }; });
  rows.sort((a, b) => b.pts - a.pts || b.wins - a.wins || ((a.bestAll == null ? 1e9 : a.bestAll) - (b.bestAll == null ? 1e9 : b.bestAll)));
  rows.forEach((r, i) => { r.rank = i + 1; });
  return rows;
}
function finishMatch(room) {
  const g = room.g; g.phase = "over"; g.over = true;
  g.api.emitAll(room, "z:over", { rows: standings(room), history: g.history, seed: g.baseSeed, mode: room.settings.mode, players: room.players.map((p) => ({ id: p.id, name: p.name, color: p.color })) });
  emitState(room);
}

// ---------- boucle ----------
function tick(room) {
  const g = room.g; if (!g || g.over) return; const now = Date.now(); const s = room.settings;
  room.players.forEach((def) => {
    if (!def.isBot && !def.connected && !def.left) { if (!def.absentAt) def.absentAt = now; def.absentAuto = now - def.absentAt > 20000 * TS; } else { def.absentAt = 0; def.absentAuto = false; }
    if (def.left) def.absentAuto = true;
  });
  if (g.phase === "garage") {
    const humans = room.players.filter((p) => !p.isBot && !p.left && p.connected);
    const allReady = humans.length && humans.every((p) => g.players[p.id].ready);
    if (now >= g.phaseUntil || (allReady && g.phaseUntil - now > 1500)) { if (allReady && now < g.phaseUntil) g.phaseUntil = now + 800; else beginDrive(room); }
  } else if (g.phase === "race") {
    tickBots(room, now);
    // tout le monde a fini ou abandonné, la course se termine après un court temps pour savourer
    const everyoneDone = room.players.every((def) => { const P = g.players[def.id]; if (def.left) return true; return !!P.done; });
    if (everyoneDone && now > g.goAt) { if (!g.allDoneAt) g.allDoneAt = now; else if (now - g.allDoneAt > 3500) return endRound(room); }
    if (now >= g.raceEnd) {
      // un pilote encore en route au moment du gong a vingt secondes de plus pour finir
      const driving = room.players.some((def) => { const P = g.players[def.id]; return !isAuto(room, def) && P.att && !P.done; });
      if (driving && !g.extended) { g.extended = true; g.raceEnd = now + 20000 * TS; g.phaseUntil = g.raceEnd; g.api.sysChat(room, "Dernière ligne droite, vingt secondes de plus pour finir."); emitState(room); }
      else endRound(room);
    }
  } else if (g.phase === "turns") tickTurn(room, now);
  else if (g.phase === "turnGap") { if (now >= g.phaseUntil) { g.phase = "turns"; nextTurn(room); } }
  else if (g.phase === "roundEnd") { if (now >= g.phaseUntil) startRound(room); }
  // instantané des voitures pour l'affichage des autres pilotes
  if (now - g.lastSnap >= (s.mode === "contact" ? 50 : 100) && (g.phase === "race" || g.phase === "turns")) {
    g.lastSnap = now; const cars = [];
    room.players.forEach((def) => {
      const P = g.players[def.id]; const f = P.feed || (P.pos && now - P.pos.t < 1500 ? P.pos : null); if (!f) return;
      if (g.phase === "turns" && (!g.turn || g.turn.pid !== def.id)) return;
      cars.push({ id: def.id, x: f.x, y: f.y, z: f.z, vx: f.vx, vz: f.vz, h: f.h, p: f.p, a: f.a, b: f.b, i: f.i || 0, car: f.car || P.car });
    });
    if (cars.length) g.api.emitAll(room, "z:snap", { t: now, cars });
  }
  if (now - (g.lastEmit || 0) > 2000) emitState(room);
}

// ---------- état envoyé ----------
function publicState(room) {
  const g = room.g, s = room.settings, t = g.turn;
  return {
    now: Date.now(), phase: g.phase, phaseUntil: g.phaseUntil, roundIdx: g.roundIdx, total: g.total, mode: s.mode, raceEnd: g.raceEnd, goAt: g.goAt || 0, order: g.order, car: g.car, slots: g.slots,
    turn: t ? { idx: t.idx, pid: t.pid, role: t.role, fuel: t.fuel, fuelLeft: t.fuelLeft, introUntil: t.introUntil, goAt: t.att ? t.att.goAt : 0, tries: t.tries, auto: !!t.auto, ended: t.ended, stage: g.stage } : null,
    stage: g.stage, elim: g.elim,
    record: g.record ? { time: g.record.time, pid: g.record.pid, car: g.record.car } : null,
    players: room.players.map((def) => { const P = g.players[def.id]; return { id: def.id, name: def.name, color: def.color, isBot: def.isBot, auto: !!def.absentAuto, left: !!def.left, connected: def.connected, car: P.car, ready: P.ready, best: P.best, pts: P.pts, wins: P.wins, finishes: P.finishes, fuel: P.fuel == null ? 0 : fix1(P.fuel), out: !!P.out }; }),
  };
}
function emitState(room) { const g = room.g; if (!g) return; g.lastEmit = Date.now(); g.api.emitAll(room, "z:state", publicState(room)); }

// ---------- réseau ----------
const b64 = (s) => { try { return Uint8Array.from(Buffer.from(String(s), "base64")); } catch (e) { return null; } };
function bind(socket, h, api) {
  const { ctx, me, toast, safe } = h;
  const inGame = () => ctx.room && ctx.room.g && ctx.room.status === "game";
  const pid = () => { const p = me(); return p ? p.id : null; };
  socket.on("z:car", safe((d) => {
    if (!inGame()) return; const g = ctx.room.g;
    if (ctx.room.hostToken !== ctx.token) return toast("Seul le premier joueur, l'hôte, choisit la voiture pour tout le monde.");
    if (g.phase !== "garage") return toast("Le garage est fermé pour cette course.");
    const id = String((d || {}).id); if (!Car.CARS[id]) return;
    g.car = id; Object.values(g.players).forEach((P) => { P.car = id; }); prepareBots(ctx.room); emitState(ctx.room);
  }));
  socket.on("z:ready", safe(() => { if (!inGame()) return; const g = ctx.room.g; const P = g.players[pid()]; if (!P || g.phase !== "garage") return; P.ready = !P.ready; emitState(ctx.room); }));
  socket.on("z:attempt", safe(() => { if (!inGame()) return; arm(ctx.room, pid(), toast); }));
  socket.on("z:pos", safe((d) => {
    if (!inGame() || !d) return; const g = ctx.room.g; const P = g.players[pid()]; if (!P) return;
    const n = (v) => (typeof v === "number" && isFinite(v) ? v : 0);
    P.pos = { x: n(d.x), y: n(d.y), z: n(d.z), vx: n(d.vx), vz: n(d.vz), h: n(d.h), p: n(d.p), a: Number(d.a) === 2 ? 2 : d.a ? 1 : 0, b: d.b ? 1 : 0, i: n(d.i), car: P.car, t: Date.now() };
  }));
  socket.on("z:end", safe((d) => { if (!inGame()) return; endAttempt(ctx.room, pid(), d || {}, toast); }));
  socket.on("z:giveup", safe(() => {
    if (!inGame()) return; const g = ctx.room.g, t = g.turn; if (g.phase !== "turns" || !t || t.pid !== pid() || t.ended || t.role !== "duel") return;
    if (t.att) { burn(ctx.room, t, (Date.now() - t.att.goAt) / 1000); t.att = null; } const P = g.players[t.pid]; P.att = null; P.pos = null; P.feed = null; t.auto = null;
    finishTurn(ctx.room, "quit");
  }));
  socket.on("z:sync", safe(() => { if (inGame()) sendTo(ctx.room, socket); }));
}
function arm(room, id, toast) {
  const g = room.g, s = room.settings; const P = g.players[id]; if (!P) return;
  if (isChrono(s)) {
    if (g.phase !== "race") return toast("La course n'a pas encore commencé.");
    if (P.tries >= 1 || P.done) return toast("Tu n'as droit qu'à un seul essai dans ce mode.");
    const now = Date.now(); P.tryCount = (P.tryCount || 0) + 1; const first = P.tries === 0; const goAt = first ? (g.goAt > now + 400 ? g.goAt : now + 2200) : now + NEXT_GO_MS;
    P.att = { goAt, car: P.car, slot: g.slots[id] || 0 }; P.tries++;
    g.api.io.to(defOf(room, id).socketId).emit("z:go", { now, goAt, fuelLeft: 0, car: P.car, slot: P.att.slot });
    return;
  }
  const t = g.turn;
  if (g.phase !== "turns" || !t || t.pid !== id) return toast("Ce n'est pas ton tour.");
  if (t.ended || t.auto) return;
  if (Date.now() < t.introUntil) return toast("Patiente un instant, le tour va commencer.");
  if (t.role === "duel" && t.fuelLeft <= 0.05) return toast("Plus une goutte d'essence.");
  if (t.role === "open" && t.tries >= s.refTries) return;
  if (t.att) { /* un redémarrage arrive avant la fin envoyée, on le traite comme un abandon */ burn(room, t, (Date.now() - t.att.goAt) / 1000); t.att = null; if (t.role === "duel" && t.fuelLeft <= 0.05) { finishTurn(room, "dry"); return; } }
  const first = t.attempts === 0; t.attempts++; P.tryCount = (P.tryCount || 0) + 1; t.lastActive = Date.now();
  t.att = { goAt: Date.now() + (first ? FIRST_GO_MS : NEXT_GO_MS), car: P.car, fuelLeft: t.fuelLeft };
  P.att = t.att; P.car = P.car;
  g.api.io.to(defOf(room, id).socketId).emit("z:go", { now: Date.now(), goAt: t.att.goAt, fuelLeft: t.role === "duel" ? t.fuelLeft : 0, car: P.car, slot: 0 });
  emitState(room);
}
function burn(room, t, secs) { if (t.role !== "duel") return; t.fuelLeft = Math.max(0, fix1(t.fuelLeft - Math.max(0, secs)) ); }

function endAttempt(room, id, d, toast) {
  const g = room.g, s = room.settings; const P = g.players[id]; if (!P) return; const def = defOf(room, id);
  const kind = d.kind === "finish" ? "finish" : "restart";
  if (isChrono(s) && kind !== "finish") { /* abandon */ }
  if (isChrono(s)) {
    const att = P.att; P.att = null; P.pos = null; if (!att) return;
    // l'essai est unique, il est consommé quoi qu'il arrive
    P.done = true;
    if (kind === "finish") { const t = verify(room, P, att, d, toast, null); if (t) acceptTime(room, id, t.time, t.bytes, att.car, t.frames); }
    else g.api.sysChat(room, def.name + " abandonne.");
    emitState(room); return;
  }
  const t = g.turn; if (g.phase !== "turns" || !t || t.pid !== id || !t.att) return;
  const att = t.att; t.att = null; P.att = null; P.pos = null; t.lastActive = Date.now();
  const elapsed = Math.max(0, (Date.now() - att.goAt) / 1000);
  if (kind === "restart") {
    burn(room, t, elapsed);
    if (t.role === "duel" && t.fuelLeft <= 0.05) return finishTurn(room, "dry");
    emitState(room); return;
  }
  const ok = verify(room, P, att, d, toast, null);
  if (!ok) { burn(room, t, elapsed); if (t.role === "duel" && t.fuelLeft <= 0.05) return finishTurn(room, "dry"); emitState(room); return; }
  g.api.emitAll(room, "z:result", { pid: id, time: ok.time, role: t.role });
  if (t.role === "open") {
    t.tries++; if (t.bestTime == null || ok.time < t.bestTime) { t.bestTime = ok.time; t.bestBytes = ok.bytes; t.bestFrames = ok.frames; t.car = att.car; }
    g.api.sysChat(room, def.name + " signe " + fmt(ok.time) + " (essai " + t.tries + " sur " + s.refTries + ").");
    if (t.tries >= s.refTries) finishTurn(room, "set"); else emitState(room);
    return;
  }
  burn(room, t, ok.time);
  if (ok.time < g.record.time) { t.bestTime = ok.time; t.bestBytes = ok.bytes; t.bestFrames = ok.frames; t.car = att.car; return finishTurn(room, "beat"); }
  g.api.sysChat(room, def.name + " termine en " + fmt(ok.time) + ", il faut faire mieux que " + fmt(g.record.time) + ".");
  if (t.fuelLeft <= 0.05) return finishTurn(room, "dry");
  emitState(room);
}

// chocs reçus d'autres pilotes en mode contact. Liste à plat de 6 entiers (pas, dx, dz, dvx, dvz, rotation en centièmes). null si incohérent
function parseEvents(raw) {
  if (!Array.isArray(raw) || raw.length === 0) return [];
  if (raw.length % 6 || raw.length > 6 * 3000) return null; const out = []; let last = -1, path = 0;
  for (let i = 0; i < raw.length; i += 6) {
    const v = raw.slice(i, i + 6).map(Number); if (v.some((x) => !isFinite(x))) return null; const t = Math.round(v[0]); if (t < last || t < 0 || t > 60 * 900) return null; last = t;
    const dx = v[1] / 100, dz = v[2] / 100, dvx = v[3] / 100, dvz = v[4] / 100, ds = v[5] / 100; if (Math.abs(dx) > 3 || Math.abs(dz) > 3 || Math.abs(dvx) > 30 || Math.abs(dvz) > 30 || Math.abs(ds) > 12) return null;
    path += Math.hypot(dx, dz); if (path > 900) return null; out.push([t, dx, dz, dvx, dvz, ds]);
  }
  return out;
}
// renvoie {time, bytes, frames} ou null
function verify(room, P, att, d, toast, fuelTicks) {
  const g = room.g, s = room.settings; const elapsed = Math.max(0, (Date.now() - att.goAt) / 1000);
  const bytes = b64(d.bytes); if (!bytes || bytes.length < 60 || bytes.length > 60 * 900) { toast("Course non reçue, retente."); return null; }
  const ropts = { slot: att.slot || 0, events: s.mode === "contact" ? parseEvents(d.ev) : [] }; if (ropts.events === null) { toast("Course refusée, retente."); return null; }
  if (s.verify === "trust") {
    const time = Number(d.time); if (!isFinite(time) || time < g.track.length / 85 || time > elapsed + 2) { toast("Temps refusé, retente."); return null; }
    const rp = Car.replay(g.track, att.car, bytes, fuelTicks, ropts); return { time, bytes, frames: rp.frames };
  }
  const rp = Car.replay(g.track, att.car, bytes, fuelTicks, ropts);
  if (!rp.run.finished) { toast("Le serveur n'a pas pu confirmer ton arrivée, retente."); return null; }
  const time = rp.run.finishTime; if (time > elapsed + 2.5) { toast("Temps refusé, retente."); return null; }
  return { time, bytes, frames: rp.frames };
}
function sendTo(room, socket) {
  const g = room.g; if (!g || !g.trackMsg) return;
  if (g.phase !== "over") socket.emit("z:round", roundMsg(room));
  if (g.turn) socket.emit("z:turn", turnMsg(room));
  if (g.record) socket.emit("z:record", { time: g.record.time, pid: g.record.pid, car: g.record.car, frames: g.record.frames });
  socket.emit("z:state", publicState(room));
  if (g.phase === "over") socket.emit("z:over", { rows: standings(room), history: g.history, seed: g.baseSeed, mode: room.settings.mode, players: room.players.map((p) => ({ id: p.id, name: p.name, color: p.color })) });
}
function onReconnect(room, p) { const g = room.g; if (!g) return; p.absentAuto = false; p.absentAt = 0; const s = room.g.api.io.sockets.sockets.get(p.socketId); if (s) sendTo(room, s); }
function onLeave(room, p) { p.absentAuto = true; const g = room.g; if (g && !room.players.some((x) => !x.isBot && !x.left)) onDestroy(room); }

module.exports = { start, onDestroy, bind, onReconnect, onLeave, publicState, standings, canReturn: (room) => !!(room.g && room.g.over) };

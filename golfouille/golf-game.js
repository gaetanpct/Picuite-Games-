// ============================================================
// GOLFOUILLE — Déroulement d'une partie côté serveur
// Le serveur simule chaque coup en entier, envoie la trajectoire,
// puis applique le résultat quand la balle a fini de rouler.
// ============================================================
const Physics = require("./public/game/physics.js");
const Course = require("./public/game/course.js");
const Rules = require("./public/game/rules.js");
const Bot = require("./golf-bot.js");

const TS = Math.max(0.001, Number(process.env.GOLF_TIME_SCALE) || 1);
const COUNTDOWN_MS = 5000 * TS;
const BETWEEN_MS = 9000 * TS;
const HARD_LIMIT_MS = 7 * 60 * 1000 * TS;
const FREEZE_MS = 4000 * TS, FOG_MS = 12000 * TS, WALL_MS = 25000 * TS;
const gauss = (r) => (r() + r() + r() - 1.5) * 1.6;
const rng = Math.random;

function pName(room, id) { const p = room.players.find((x) => x.id === id); return p ? p.name : "?"; }

function start(room, api) {
  const s = room.settings;
  const baseSeed = s.seed && s.seed.trim() ? s.seed.trim() : Math.random().toString(36).slice(2, 8);
  const g = room.g = {
    api, baseSeed, holeIndex: -1, total: s.holes, phase: "idle", phaseUntil: 0, hole: null, holeMsg: null, playStart: 0, graceUntil: 0, hardUntil: 0,
    players: {}, walls: [], orbs: [], turnPid: null, turnUntil: 0, nextWallId: 1, history: [], lastEmit: 0, over: false, timer: null, wind: [0, 0], finishCount: 0,
  };
  room.players.forEach((p) => {
    g.players[p.id] = { id: p.id, strokes: 0, finished: false, place: 0, capped: false, moving: false, settleAt: 0, pending: null, powers: [], fx: {}, x: 0, y: 0, z: 0, lastRest: null, prevRest: null, rocketUsed: false, botNext: 0, pts: 0, totalStrokes: 0, holesWon: 0, aces: 0, stats: { longest: 0, hostile: 0, targeted: 0, penalties: 0, orbs: 0 }, lastOutcome: null, absentSince: 0 };
  });
  // équipes à deux, dans l'ordre du salon. Le premier de chaque paire porte la balle de l'équipe
  g.team = {}; if (s.playMode === "equipe") { const ids = room.players.map((p) => p.id); for (let i = 0; i < ids.length; i += 2) { const t = { lead: ids[i], mates: ids.slice(i, i + 2), turn: 0, n: i / 2 + 1 }; t.mates.forEach((id) => { g.team[id] = t; }); } }
  api.sysChat(room, "Le parcours se joue avec la graine " + baseSeed + ".");
  g.timer = setInterval(() => { try { tick(room); } catch (e) { console.error("tick golf", e); } }, 100);
  beginHole(room);
}

function onDestroy(room) { if (room.g && room.g.timer) { clearInterval(room.g.timer); room.g.timer = null; } }

function beginHole(room) {
  const g = room.g, s = room.settings;
  g.holeIndex++;
  if (g.holeIndex >= g.total) return finishMatch(room);
  const hole = Rules.holeFor(s, g.baseSeed, g.holeIndex);
  g.hole = hole; g.wind = hole.wind;
  g.holeMsg = { index: g.holeIndex, total: g.total, hole: Course.encodeHole(hole) };
  g.walls = []; g.finishCount = 0; g.graceUntil = 0; Object.values(g.team || {}).forEach((t) => { t.turn = (g.holeIndex % t.mates.length); });
  g.orbs = hole.orbs.map((o) => ({ id: o.id, x: o.x, z: o.z, taken: false, respawnAt: 0 }));
  Object.values(g.players).forEach((P) => {
    P.strokes = 0; P.finished = false; P.place = 0; P.capped = false; P.moving = false; P.pending = null; P.fx = {}; P.rocketUsed = false; P.lastOutcome = null; P.finishAt = 0;
    P.x = hole.tee.x; P.z = hole.tee.z; P.y = hole.tee.y + Physics.BALL_R; P.lastRest = { x: P.x, y: P.y, z: P.z }; P.prevRest = null;
    P.botNext = 0; P.holeBonus = 0;
  });
  g.phase = "countdown"; g.phaseUntil = Date.now() + COUNTDOWN_MS;
  g.api.emitAll(room, "golf:hole", Object.assign({ now: Date.now(), startAt: g.phaseUntil }, g.holeMsg));
  if (hole.signed) g.api.sysChat(room, "Trou signé, " + hole.signed.name + ". " + hole.signed.tip);
  emitState(room, true);
}

function startPlay(room) {
  const g = room.g, s = room.settings;
  g.phase = "play"; g.playStart = Date.now(); g.hardUntil = g.playStart + HARD_LIMIT_MS;
  Object.values(g.players).forEach((P) => { P.botNext = Date.now() + thinkMs(room, P); });
  if (s.playMode === "tour") nextTurn(room);
  emitState(room, true);
}

// ---------- utilitaires ----------
// balle jouée par ce joueur. En équipe, c'est celle du premier de la paire
function ballOf(g, id) { const t = g.team && g.team[id]; return g.players[t ? t.lead : id]; }
function isBall(g, P) { const t = g.team && g.team[P.id]; return !t || t.lead === P.id; }
function balls(g) { return Object.values(g.players).filter((P) => isBall(g, P)); }
function teamTurnOk(g, pid) { const t = g.team && g.team[pid]; return !t || t.mates[t.turn % t.mates.length] === pid; }
const tRel = (g) => (Date.now() - g.playStart) / 1000 / TS;
function flowOf(g, P) { return Course.flowAt(g.hole, P.x, P.z); }
function playerDef(room, id) { return room.players.find((p) => p.id === id); }
function isAuto(room, def) { return def.isBot || (!def.connected && def.absentAuto); }
function botLevelOf(def) { return def.isBot ? def.level : "moyen"; }
function thinkMs(room, P) {
  const def = playerDef(room, P.id); const lv = Bot.LEVELS[botLevelOf(def)] || Bot.LEVELS.moyen;
  return (lv.think[0] + rng() * (lv.think[1] - lv.think[0])) * TS;
}
function activeWalls(g) { const now = Date.now(); g.walls = g.walls.filter((w) => w.exp > now); return g.walls; }

function ranks(room) {
  const g = room.g; const m = new Map();
  Object.values(g.players).forEach((P) => { const B = ballOf(g, P.id); m.set(P.id, B.finished ? -1 : flowOf(g, B)); });
  return m;
}

function nextTurn(room) {
  const g = room.g, s = room.settings;
  if (s.playMode !== "tour" || g.phase !== "play") return;
  const left = balls(g).filter((P) => !P.finished);
  if (!left.length) { g.turnPid = null; return; }
  left.sort((a, b) => flowOf(g, b) - flowOf(g, a));
  g.turnPid = left[0].id; g.turnUntil = Date.now() + s.shotClock * 1000 * TS;
  g.players[g.turnPid].botNext = Date.now() + thinkMs(room, g.players[g.turnPid]);
}

// ---------- coups ----------
function shoot(room, pid, data) {
  const g = room.g, s = room.settings; if (!g || g.phase !== "play") return { error: "Le trou n'a pas encore commencé." };
  const Sh = g.players[pid]; if (!Sh) return { error: "Joueur inconnu." };
  const P = ballOf(g, pid);
  if (P.finished) return { error: "Tu as déjà fini ce trou." };
  if (P.moving) return { error: "Ta balle roule encore." };
  if (!teamTurnOk(g, pid)) return { error: "C'est à ton équipier de jouer ce coup." };
  if (Sh.fx.frozenUntil && Sh.fx.frozenUntil > Date.now()) return { error: "Tu es gelé, patiente un instant." };
  if (s.playMode === "tour" && g.turnPid !== pid) return { error: "Ce n'est pas encore ton tour." };
  const FX = Sh.fx;
  const clubId = String(data.club || "putter"); const allowed = s.clubs.includes(clubId) ? clubId : "putter";
  const club = Rules.CLUBS[allowed];
  let yaw = Number(data.yaw); let power = Number(data.power);
  if (!isFinite(yaw) || !isFinite(power)) return { error: "Coup invalide." };
  power = Math.max(0.05, Math.min(1, power));
  // la position de la balle compte, un club souffre dans le sable, la boue ou l'herbe haute, la cale non
  const surf = Physics.surfAt(g.hole, P.x, P.z); const lie = Rules.lieFor(allowed, surf);
  const prec = s.precision;
  const sigma = club.err * lie.err * prec * (0.35 + 0.65 * power);
  yaw += (gauss(rng) * sigma * Math.PI) / 180;
  power = Math.max(0.03, power * (1 + gauss(rng) * 0.02 * prec));
  const spin = s.spin === false ? 0 : Math.max(-1, Math.min(1, Number(data.spin) || 0));
  const shot = Rules.shotFor(allowed, power, yaw, surf, spin);
  if (FX.turbo) { shot.speed = Math.min(shot.speed * 1.5, 60); }
  if (FX.glu) shot.speed *= 0.5;
  const opts = { t0: tRel(g), wind: g.wind, walls: activeWalls(g).map((w) => ({ x1: w.x1, z1: w.z1, x2: w.x2, z2: w.z2, h: w.h })), skip: !!club.skip, ice: !!FX.ice, magnet: !!FX.magnet, cupMul: 1 };
  if (s.ballHits !== false) opts.balls = balls(g).filter((Q) => Q !== P && !Q.finished && !Q.moving).map((Q) => ({ id: Q.id, x: Q.x, y: Q.y, z: Q.z }));
  if (FX.gust) { const a = yaw + (rng() < 0.5 ? 1 : -1) * Math.PI / 2; opts.gust = [Math.sin(a) * 3.4, Math.cos(a) * 3.4]; }
  if (s.powersOn && s.playMode !== "uncoup") opts.orbs = g.orbs.filter((o) => !o.taken).map((o) => ({ id: o.id, x: o.x, z: o.z, taken: false }));
  const ball = { x: P.x, y: P.y, z: P.z };
  const res = Physics.simulate(g.hole, ball, shot, opts);
  Sh.stats.longest = Math.max(Sh.stats.longest, Math.hypot(res.end.x - P.x, res.end.z - P.z));
  P.prevRest = P.lastRest; P.lastRest = null;
  P.strokes++; P.moving = true; P.lastClub = allowed; P.shooter = pid;
  const usedFx = Object.keys(FX).filter((k) => k !== "frozenUntil" && k !== "fogUntil" && k !== "bubble");
  usedFx.forEach((k) => { delete FX[k]; });
  P.settleAt = Date.now() + res.dur * 1000 * TS + 350 * TS;
  P.pending = res;
  // les orbes ramassées disparaissent tout de suite pour les autres
  res.picked.forEach((id) => { const o = g.orbs.find((q) => q.id === id); if (o) { o.taken = true; o.by = pid; o.respawnAt = s.orbRespawn ? Date.now() + s.orbRespawn * 1000 * TS : 0; } });
  g.api.emitAll(room, "golf:shot", { pid: P.id, by: pid, club: allowed, height: 2, t0: Date.now(), tRel: opts.t0, frames: res.frames, events: res.events, outcome: res.outcome, dur: res.dur, picked: res.picked, strokes: P.strokes, spin });
  // balles poussées, elles partent au moment du choc
  res.events.filter((e) => e.k === "knock").forEach((e) => knock(room, P, e, opts.t0));
  emitState(room, true);
  return { ok: true };
}
function knock(room, P, e, t0) {
  const g = room.g; const Q = g.players[e.id]; if (!Q || Q.moving || Q.finished || !isBall(g, Q)) return;
  const sp = Math.hypot(e.vx, e.vz); if (sp < 0.3) return;
  const res = Physics.simulate(g.hole, { x: Q.x, y: Q.y, z: Q.z }, { yaw: Math.atan2(e.vx, e.vz), speed: sp, loft: 0, soft: false, windMul: 0 }, { t0: t0 + e.t, wind: [0, 0], walls: activeWalls(g).map((w) => ({ x1: w.x1, z1: w.z1, x2: w.x2, z2: w.z2, h: w.h })), cupMul: 1 });
  Q.prevRest = { x: Q.x, y: Q.y, z: Q.z }; Q.moving = true; Q.knocked = true; Q.pending = res; Q.settleAt = Date.now() + (e.t + res.dur) * 1000 * TS + 350 * TS;
  g.api.emitAll(room, "golf:shot", { pid: Q.id, knocked: P.id, club: "putter", height: 2, t0: Date.now() + e.t * 1000, tRel: t0 + e.t, frames: res.frames, events: res.events, outcome: res.outcome, dur: res.dur, picked: [], strokes: Q.strokes });
  g.api.sysChat(room, pName(room, P.shooter || P.id) + " bouscule la balle de " + pName(room, Q.id) + ".");
}

function settle(room, P) {
  const g = room.g, s = room.settings; const res = P.pending; P.pending = null; P.moving = false;
  if (!res) return;
  const def = playerDef(room, P.id); P.lastOutcome = res.outcome; const knocked = P.knocked; P.knocked = false;
  const Sh = g.players[P.shooter] || P;
  // pouvoirs gagnés, ils vont à celui qui a tapé
  if (s.powersOn && res.picked.length) {
    res.picked.forEach(() => {
      if (Sh.powers.length >= s.powerSlots) return; Sh.stats.orbs++;
      const pool = s.powerSet; if (!pool.length) return;
      const id = pool[Math.floor(rng() * pool.length)]; Sh.powers.push(id);
      g.api.emitAll(room, "golf:fx", { kind: "gain", pid: Sh.id, power: id });
    });
  }
  const T = g.team && g.team[P.id]; if (T && !knocked) T.turn++;
  // balle poussée par un autre, pas de pénalité, elle revient si elle tombe à l'eau ou sort
  if (knocked && res.outcome !== "sunk") {
    let pos = { x: res.end.x, z: res.end.z }; if (res.outcome === "water" || res.outcome === "lava") pos = { x: res.lastDry.x, z: res.lastDry.z }; else if (res.outcome === "ob") pos = { x: P.prevRest.x, z: P.prevRest.z };
    P.x = pos.x; P.z = pos.z; P.y = Physics.heightAt(g.hole, P.x, P.z) + Physics.BALL_R; P.lastRest = { x: P.x, y: P.y, z: P.z };
    if (s.playMode === "tour") nextTurn(room); emitState(room, true); return;
  }
  if (res.outcome === "sunk") {
    P.finished = true; P.finishAt = P.settleAt || Date.now(); P.place = ++g.finishCount; P.x = g.hole.cup.x; P.z = g.hole.cup.z;
    const who = knocked ? def.name + ", poussé par un adversaire," : (playerDef(room, Sh.id) || def).name;
    const msg = P.strokes === 1 && !knocked ? who + " réussit un trou en un" : who + " met la balle dans le trou en " + P.strokes + " coup" + (P.strokes > 1 ? "s" : "");
    g.api.sysChat(room, msg + ".");
    if (P.strokes === 1 && !knocked) Sh.aces++;
    if (g.finishCount === 1 && s.playMode === "course") { g.graceUntil = Date.now() + s.finishGrace * 1000 * TS; }
  } else {
    let pos;
    if (res.outcome === "water" || res.outcome === "lava") {
      P.strokes++; P.stats.penalties++; pos = { x: res.lastDry.x, z: res.lastDry.z };
      g.api.sysChat(room, def.name + (res.outcome === "lava" ? " fait un barbecue de sa balle" : " fait plouf") + ", un coup de pénalité.");
    } else if (res.outcome === "ob") {
      P.strokes++; P.stats.penalties++; pos = P.prevRest ? { x: P.prevRest.x, z: P.prevRest.z } : { x: g.hole.tee.x, z: g.hole.tee.z };
      g.api.sysChat(room, def.name + " sort du terrain, un coup de pénalité.");
    } else pos = { x: res.end.x, z: res.end.z };
    P.x = pos.x; P.z = pos.z; P.y = Physics.heightAt(g.hole, P.x, P.z) + Physics.BALL_R;
    P.lastRest = { x: P.x, y: P.y, z: P.z };
    if (res.outcome === "water" || res.outcome === "lava" || res.outcome === "ob") { P.prevRest = P.prevRest || { x: P.x, y: P.y, z: P.z }; }
    if (s.playMode === "uncoup") { P.finished = true; P.capped = true; P.place = 0; P.oneDist = res.outcome === "rest" ? Math.hypot(P.x - g.hole.cup.x, P.z - g.hole.cup.z) : null; }
    else if (P.strokes >= s.maxStrokes) { P.finished = true; P.capped = true; P.place = 0; g.api.sysChat(room, (T ? "L'équipe de " : "") + def.name + " ramasse sa balle après " + s.maxStrokes + " coups."); }
  }
  P.botNext = Date.now() + thinkMs(room, P);
  if (s.playMode === "tour") { nextTurn(room); }
  emitState(room, true);
}

// ---------- pouvoirs ----------
function usePower(room, pid, powerId, targetId) {
  const g = room.g, s = room.settings; if (!g || g.phase !== "play" || !s.powersOn) return { error: "Les pouvoirs ne sont pas disponibles maintenant." };
  const P = g.players[pid]; if (!P) return { error: "Joueur inconnu." };
  const idx = P.powers.indexOf(powerId); if (idx < 0) return { error: "Tu n'as pas ce pouvoir." };
  const def = Rules.POWERS[powerId]; const me = playerDef(room, pid);
  let T = null;
  if (def.kind === "hostile") {
    T = g.players[targetId]; if (!T || T.id === pid) return { error: "Choisis un adversaire." };
    if (ballOf(g, T.id).finished) return { error: "Cet adversaire a déjà fini le trou." };
    if (g.team[pid] && g.team[pid] === g.team[T.id]) return { error: "C'est ton équipier." };
  }
  const consume = () => { P.powers.splice(P.powers.indexOf(powerId), 1); };
  const fx = (extra) => g.api.emitAll(room, "golf:fx", Object.assign({ kind: "power", pid, power: powerId, target: targetId || null }, extra || {}));
  if (T) {
    if (T.fx.bubble) {
      delete T.fx.bubble; consume(); fx({ blocked: true });
      g.api.sysChat(room, "La bulle de " + pName(room, T.id) + " bloque " + def.name + " de " + me.name + ".");
      emitState(room, true); return { ok: true };
    }
    const tn = pName(room, T.id); P.stats.hostile++; T.stats.targeted++;
    if (powerId === "mur") {
      const TB = ballOf(g, T.id); const hole = g.hole; let dx = hole.cup.x - TB.x, dz = hole.cup.z - TB.z; const d = Math.hypot(dx, dz) || 1; dx /= d; dz /= d;
      const dist = Math.min(4.5, Math.max(2.4, d - 2));
      const cx = TB.x + dx * dist, cz = TB.z + dz * dist; const px = -dz, pz = dx;
      g.walls.push({ id: g.nextWallId++, x1: cx - px * 2.6, z1: cz - pz * 2.6, x2: cx + px * 2.6, z2: cz + pz * 2.6, h: 1.8, exp: Date.now() + WALL_MS, by: pid });
    } else if (powerId === "glu") T.fx.glu = true;
    else if (powerId === "bourrasque") T.fx.gust = true;
    else if (powerId === "brouillard") T.fx.fogUntil = Date.now() + FOG_MS;
    else if (powerId === "inversion") T.fx.invert = true;
    else if (powerId === "gel") T.fx.frozenUntil = Date.now() + FREEZE_MS;
    else if (powerId === "verglas") T.fx.ice = true;
    consume(); fx({});
    g.api.sysChat(room, me.name + " lance " + def.name + " sur " + tn + ".");
  } else if (powerId === "echange") {
    const PB = ballOf(g, pid);
    if (PB.moving) return { error: "Attends que ta balle s'arrête." };
    const foes = balls(g).filter((q) => q !== PB && !q.finished && !q.moving);
    if (!foes.length) return { error: "Personne avec qui échanger." };
    foes.sort((a, b) => flowOf(g, a) - flowOf(g, b)); const L = foes[0];
    if (flowOf(g, L) >= flowOf(g, PB)) return { error: "Tu es déjà devant, garde ce pouvoir pour plus tard." };
    if (L.fx.bubble) { delete L.fx.bubble; consume(); fx({ blocked: true, target: L.id }); g.api.sysChat(room, "La bulle de " + pName(room, L.id) + " bloque l'échange."); emitState(room, true); return { ok: true }; }
    const a = { x: PB.x, y: PB.y, z: PB.z }, b = { x: L.x, y: L.y, z: L.z };
    PB.x = b.x; PB.y = b.y; PB.z = b.z; L.x = a.x; L.y = a.y; L.z = a.z; PB.lastRest = { x: PB.x, y: PB.y, z: PB.z }; L.lastRest = { x: L.x, y: L.y, z: L.z };
    consume(); fx({ target: L.id }); g.api.sysChat(room, me.name + " échange sa place avec " + pName(room, L.id) + ".");
  } else if (powerId === "turbo") { P.fx.turbo = true; consume(); fx({}); }
  else if ((powerId === "raccourci" || powerId === "rembobine") && ballOf(g, pid) !== P) return usePowerOnBall(room, pid, powerId, ballOf(g, pid), consume, fx, me);
  else if (powerId === "aimant") { P.fx.magnet = true; consume(); fx({}); }
  else if (powerId === "bulle") { P.fx.bubble = true; consume(); fx({}); }
  else if (powerId === "raccourci") {
    if (P.moving) return { error: "Attends que ta balle s'arrête." };
    const path = g.hole.path; let k = 0, bd = 1e9; path.forEach((p, i) => { const d = Math.hypot(p.x - P.x, p.z - P.z); if (d < bd) { bd = d; k = i; } });
    const hole = g.hole; const dCup = Math.hypot(hole.cup.x - P.x, hole.cup.z - P.z);
    let tx, tz;
    if (dCup < 20) { const a = Math.atan2(P.x - hole.cup.x, P.z - hole.cup.z); tx = hole.cup.x + Math.sin(a) * 4; tz = hole.cup.z + Math.cos(a) * 4; }
    else { const q = path[Math.min(path.length - 1, k + 8)]; tx = q.x; tz = q.z; }
    const sf = Physics.surfAt(hole, tx, tz); if (sf === Physics.S.WATER || sf === Physics.S.LAVA || sf === Physics.S.VOID) return { error: "Pas de place pour atterrir, réessaie plus tard." };
    P.x = tx; P.z = tz; P.y = Physics.heightAt(hole, tx, tz) + Physics.BALL_R; P.lastRest = { x: P.x, y: P.y, z: P.z };
    consume(); fx({ to: [tx, tz] }); g.api.sysChat(room, me.name + " prend un raccourci.");
  } else if (powerId === "rembobine") {
    if (P.moving) return { error: "Attends que ta balle s'arrête." };
    if (!P.prevRest || P.strokes < 1) return { error: "Rien à annuler pour le moment." };
    P.x = P.prevRest.x; P.y = P.prevRest.y; P.z = P.prevRest.z; P.lastRest = { x: P.x, y: P.y, z: P.z }; P.prevRest = null; P.strokes = Math.max(0, P.strokes - 1);
    consume(); fx({}); g.api.sysChat(room, me.name + " rembobine son dernier coup.");
  }
  emitState(room, true);
  return { ok: true };
}

// raccourci et rembobine pour un équipier, ils agissent sur la balle de l'équipe
function usePowerOnBall(room, pid, powerId, B, consume, fx, me) {
  const g = room.g; if (B.moving) return { error: "Attends que la balle s'arrête." };
  if (powerId === "rembobine") { if (!B.prevRest || B.strokes < 1) return { error: "Rien à annuler pour le moment." }; B.x = B.prevRest.x; B.y = B.prevRest.y; B.z = B.prevRest.z; B.lastRest = { x: B.x, y: B.y, z: B.z }; B.prevRest = null; B.strokes = Math.max(0, B.strokes - 1); consume(); fx({}); g.api.sysChat(room, me.name + " rembobine le dernier coup de l'équipe."); }
  else { const hole = g.hole; const path = hole.path; let k = 0, bd = 1e9; path.forEach((p, i) => { const d = Math.hypot(p.x - B.x, p.z - B.z); if (d < bd) { bd = d; k = i; } }); const q = path[Math.min(path.length - 1, k + 8)]; const sf = Physics.surfAt(hole, q.x, q.z); if (sf === Physics.S.WATER || sf === Physics.S.LAVA || sf === Physics.S.VOID) return { error: "Pas de place pour atterrir, réessaie plus tard." }; B.x = q.x; B.z = q.z; B.y = Physics.heightAt(hole, q.x, q.z) + Physics.BALL_R; B.lastRest = { x: B.x, y: B.y, z: B.z }; consume(); fx({ to: [q.x, q.z] }); g.api.sysChat(room, me.name + " prend un raccourci."); }
  emitState(room, true); return { ok: true };
}

// ---------- fin de trou et de partie ----------
function endHole(room) {
  const g = room.g, s = room.settings; if (g.phase !== "play") return;
  g.phase = "between"; g.phaseUntil = Date.now() + BETWEEN_MS;
  const hole = g.hole;
  const ps = balls(g);
  const finishers = ps.filter((P) => P.finished && !P.capped).sort((a, b) => a.finishAt - b.finishAt);
  // trou en un, dans le trou rapporte 10, sinon les plus proches marquent 6, 4, 3, 2, 1
  const near = s.playMode === "uncoup" ? ps.filter((P) => !(P.finished && !P.capped) && P.oneDist != null).sort((a, b) => a.oneDist - b.oneDist) : [];
  const rows = ps.map((P) => {
    const done = P.finished && !P.capped;
    const eff = done ? P.strokes : Math.min(P.strokes, s.maxStrokes) + s.unfinishedPenalty;
    const place = done ? finishers.indexOf(P) + 1 : 0;
    let base = 0, bonus = 0, ace = 0;
    if (s.playMode === "uncoup") { if (done) base = 10; else { const k = near.indexOf(P); if (k >= 0) base = [6, 4, 3, 2, 1][k] || 0; } }
    else if (s.scoring !== "coups" && done) {
      base = Rules.placePts(place);
      if (P.strokes === 1) ace = Rules.SCORE.ace;
      if (s.scoring === "mixte") bonus = Math.max(0, hole.par - P.strokes) * Rules.SCORE.underPar;
    }
    const pts = base + bonus + ace;
    P.pts += pts; P.totalStrokes += eff; P.parTotal = (P.parTotal || 0) + (eff - hole.par); if (place === 1) P.holesWon++;
    return { id: P.id, strokes: P.strokes, eff, done, capped: P.capped, vsPar: eff - hole.par, place, base, bonus, ace, pts, total: P.pts, totalStrokes: P.totalStrokes, parTotal: P.parTotal, dist: P.oneDist != null && !done ? +P.oneDist.toFixed(1) : null };
  });
  // en équipe, l'équipier reçoit exactement le même résultat
  Object.values(g.players).forEach((M) => { if (isBall(g, M)) return; const L = ballOf(g, M.id); const r = rows.find((x) => x.id === L.id); if (!r) return; M.pts += r.pts; M.totalStrokes += r.eff; M.parTotal = (M.parTotal || 0) + r.vsPar; if (r.place === 1) M.holesWon++; rows.push(Object.assign({}, r, { id: M.id, total: M.pts, totalStrokes: M.totalStrokes, parTotal: M.parTotal })); });
  g.history.push({ name: hole.name, biome: hole.biome, par: hole.par, rows });
  g.api.emitAll(room, "golf:holeEnd", { index: g.holeIndex, name: hole.name, par: hole.par, rows, until: g.phaseUntil, now: Date.now(), last: g.holeIndex + 1 >= g.total });
  emitState(room, true);
}

// petits trophées de fin de partie
function awards(room) {
  const g = room.g; const out = []; const ps = room.players.map((def) => ({ def, P: g.players[def.id] })).filter((x) => x.P);
  const best = (key, min, label, unit) => { let b = null; ps.forEach((x) => { const v = x.P.stats[key]; if (v >= min && (!b || v > b.v)) b = { v, x }; }); if (b) out.push({ id: b.x.def.id, label, value: unit === "m" ? Math.round(b.v) + " m" : b.v + (unit || "") }); };
  best("longest", 5, "Le plus long coup", "m"); best("hostile", 1, "Roi du chaos, pouvoirs lancés", ""); best("targeted", 1, "Cible favorite, pouvoirs reçus", ""); best("penalties", 1, "Plongeur de l'année, pénalités", ""); best("orbs", 1, "Collectionneur d'orbes", "");
  const aces = ps.filter((x) => x.P.aces > 0).sort((a, b) => b.P.aces - a.P.aces)[0]; if (aces) out.push({ id: aces.def.id, label: "Trou en un", value: String(aces.P.aces) });
  return out;
}
function standings(room) {
  const s = room.settings; const g = room.g;
  const rows = room.players.map((def) => { const P = g.players[def.id]; return { id: def.id, name: def.name, color: def.color, isBot: def.isBot, pts: P.pts, totalStrokes: P.totalStrokes, parTotal: P.parTotal || 0, holesWon: P.holesWon, aces: P.aces, left: !!def.left }; });
  if (s.scoring === "coups" && s.playMode !== "uncoup") rows.sort((a, b) => a.totalStrokes - b.totalStrokes || b.holesWon - a.holesWon);
  else rows.sort((a, b) => b.pts - a.pts || a.totalStrokes - b.totalStrokes);
  rows.forEach((r, i) => { r.rank = i + 1; });
  return rows;
}

function finishMatch(room) {
  const g = room.g; g.phase = "over"; g.over = true;
  g.api.emitAll(room, "golf:over", { awards: awards(room), rows: standings(room), history: g.history.map((h) => ({ name: h.name, biome: h.biome, par: h.par, rows: h.rows })), seed: g.baseSeed, scoring: room.settings.scoring, players: room.players.map((p) => ({ id: p.id, name: p.name, color: p.color })) });
  emitState(room, true);
}

// ---------- boucle ----------
function tick(room) {
  const g = room.g; if (!g || g.over) return; const now = Date.now(); const s = room.settings;
  if (g.phase === "countdown" && now >= g.phaseUntil) startPlay(room);
  else if (g.phase === "between" && now >= g.phaseUntil) beginHole(room);
  else if (g.phase === "play") {
    const ps = balls(g); const all = Object.values(g.players);
    ps.forEach((P) => { if (P.moving && now >= P.settleAt) settle(room, P); });
    // orbes qui reviennent
    g.orbs.forEach((o) => { if (o.taken && o.respawnAt && now >= o.respawnAt) { o.taken = false; o.respawnAt = 0; emitState(room, true); } });
    // joueurs absents depuis longtemps, le bot prend la relève
    room.players.forEach((def) => {
      if (!def.isBot && !def.connected && !def.left) { if (!def.absentAt) def.absentAt = now; def.absentAuto = now - def.absentAt > 25000 * TS; }
      else { def.absentAt = 0; def.absentAuto = false; }
      if (def.left) def.absentAuto = true;
    });
    // bots et joueurs automatiques
    all.forEach((P) => {
      const B = ballOf(g, P.id);
      const def = playerDef(room, P.id); if (!def || B.finished || B.moving) return;
      const auto = def.isBot || def.absentAuto; if (!auto) return;
      if (!teamTurnOk(g, P.id)) return;
      if (s.playMode === "tour" && g.turnPid !== P.id) return;
      if (P.fx.frozenUntil && P.fx.frozenUntil > now) return;
      if (now < P.botNext) return;
      botAct(room, P, def);
    });
    // coup imposé quand le temps du tour est écoulé
    if (s.playMode === "tour" && g.turnPid && now > g.turnUntil) {
      const P = g.players[g.turnPid]; const def = playerDef(room, g.turnPid);
      if (P && !P.moving && !P.finished && def && !def.isBot) { botShot(room, P, def, "debutant"); }
      else if (P && P.moving) g.turnUntil = now + 5000;
    }
    // fin de trou
    const open = ps.filter((P) => !P.finished);
    if (!open.length) endHole(room);
    else if (g.graceUntil && now > g.graceUntil && s.playMode === "course" && !ps.some((P) => P.moving)) endHole(room);
    else if (now > g.hardUntil && !ps.some((P) => P.moving)) endHole(room);
    if (now - g.lastEmit > 1500) emitState(room, true);
  }
}

function botShot(room, Pl, def, forcedLevel) {
  const g = room.g, s = room.settings; const level = forcedLevel || botLevelOf(def); const P = ballOf(g, Pl.id);
  const clubs = s.clubs.filter((c) => !(Rules.CLUBS[c].limited && P.rocketUsed));
  const plan = Bot.planShot(g.hole, { x: P.x, y: P.y, z: P.z }, { clubs, t0: tRel(g), walls: activeWalls(g), turbo: !!Pl.fx.turbo, glu: !!Pl.fx.glu, ice: !!Pl.fx.ice, magnet: !!Pl.fx.magnet, cupMul: 1, noHeight: room.settings.heightControl === false }, level, rng);
  shoot(room, Pl.id, { club: plan.club, yaw: plan.yaw, power: plan.power, height: plan.height });
}
function botAct(room, P, def) {
  const g = room.g, s = room.settings;
  if (s.powersOn && s.playMode !== "uncoup" && P.powers.length) {
    const pick = Bot.choosePower({ players: room.players.map((d) => g.players[d.id]) }, P, ranks(room), rng, botLevelOf(def));
    if (pick) { const r = usePower(room, P.id, pick.id, pick.target); if (r.ok) { P.botNext = Date.now() + 700 * TS; return; } else { P.powers = P.powers.filter((x) => x !== pick.id || rng() < 0.5); } }
  }
  botShot(room, P, def);
}

// ---------- état envoyé aux clients ----------
function publicState(room) {
  const g = room.g; const s = room.settings; const now = Date.now();
  return {
    now, phase: g.phase, holeIndex: g.holeIndex, total: g.total, holeName: g.hole ? g.hole.name : "", par: g.hole ? g.hole.par : 0, biome: g.hole ? g.hole.biome : "",
    playStart: g.playStart, phaseUntil: g.phaseUntil, graceUntil: g.graceUntil, turnPid: g.turnPid, turnUntil: g.turnUntil, wind: g.wind, scoring: s.scoring, playMode: s.playMode,
    walls: activeWalls(g).map((w) => ({ id: w.id, x1: w.x1, z1: w.z1, x2: w.x2, z2: w.z2, h: w.h, exp: w.exp })),
    orbs: g.orbs.map((o) => ({ id: o.id, taken: o.taken })),
    teams: s.playMode === "equipe" ? room.players.map((def) => { const t = g.team[def.id]; return t ? { id: def.id, n: t.n, lead: t.lead, mates: t.mates, turn: t.mates[t.turn % t.mates.length] } : null; }).filter(Boolean) : null,
    players: room.players.map((def) => {
      const P = g.players[def.id]; const B = ballOf(g, def.id);
      return { id: def.id, name: def.name, color: def.color, isBot: def.isBot, auto: !!def.absentAuto, left: !!def.left, connected: def.connected, x: B.x, y: B.y, z: B.z, strokes: B.strokes, finished: B.finished, capped: B.capped, place: B.place, moving: B.moving, powers: P.powers.slice(), rocketUsed: P.rocketUsed, mate: B !== P ? B.id : null, myTurn: teamTurnOk(g, def.id),
        fx: { glu: !!P.fx.glu, gust: !!P.fx.gust, invert: !!P.fx.invert, ice: !!P.fx.ice, turbo: !!P.fx.turbo, magnet: !!P.fx.magnet, bubble: !!P.fx.bubble, fogUntil: P.fx.fogUntil || 0, frozenUntil: P.fx.frozenUntil || 0 },
        pts: P.pts, totalStrokes: P.totalStrokes };
    }),
  };
}
function emitState(room, force) {
  const g = room.g; if (!g) return; g.lastEmit = Date.now();
  g.api.emitAll(room, "golf:state", publicState(room));
}

// ---------- événements réseau ----------
function bind(socket, h, api) {
  const { ctx, me, toast, safe } = h;
  const inGame = () => ctx.room && ctx.room.g && ctx.room.status === "game";
  const pidOf = () => { const p = me(); return p ? p.id : null; };
  socket.on("golf:shoot", safe((data) => {
    if (!inGame()) return; data = data || {};
    const r = shoot(ctx.room, pidOf(), data); if (r.error) toast(r.error);
  }));
  socket.on("golf:power", safe((data) => {
    if (!inGame()) return; data = data || {};
    const r = usePower(ctx.room, pidOf(), String(data.id || ""), data.target ? String(data.target) : null); if (r.error) toast(r.error);
  }));
  socket.on("golf:sync", safe(() => { if (inGame()) sendTo(ctx.room, socket); }));
}
function sendTo(room, socket) {
  const g = room.g; if (!g) return;
  if (g.holeMsg && g.phase !== "over") socket.emit("golf:hole", Object.assign({ now: Date.now(), startAt: g.phaseUntil }, g.holeMsg));
  socket.emit("golf:state", publicState(room));
  if (g.phase === "over") socket.emit("golf:over", { awards: awards(room), rows: standings(room), history: g.history, seed: g.baseSeed, scoring: room.settings.scoring, players: room.players.map((p) => ({ id: p.id, name: p.name, color: p.color })) });
}
function onReconnect(room, p, api) {
  const g = room.g; if (!g) return; const def = p; def.absentAuto = false; def.absentAt = 0;
  const s = api.io.sockets.sockets.get(p.socketId); if (s) sendTo(room, s);
}
function onLeave(room, p) {
  // le joueur parti est remplacé par un automate, ses points restent
  p.absentAuto = true;
  const g = room.g; if (g && !room.players.some((x) => !x.isBot && !x.left)) { onDestroy(room); }
}

module.exports = { start, onDestroy, bind, onReconnect, onLeave, publicState, standings, canReturn: (room) => !!(room.g && room.g.over) };

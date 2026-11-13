// ============================================================
// BOUSKAILLE — Déroulement d'une partie (manches, scores, modes). Aucune dépendance au réseau.
// ============================================================
const Sim = require("./public/game/sim.js");
const Arenas = require("./public/game/arenas.js");
const Rules = require("./public/game/rules.js");
const Bot = require("./bousk-bot.js");

const T_INTRO = 4.2, T_COUNT = 3.0, T_END = 6.5, RESPAWN = 3.0, CAP = 150;
const r2 = (v) => Math.round(v * 100) / 100;
const ST = { ok: 0, charge: 1, dash: 2, rec: 3, stun: 4, fall: 5, air: 6, out: 7 };

class Match {
  // defs: [{id, name, color, isBot, level}]
  constructor(settings, defs, opts) {
    opts = opts || {};
    this.s = Rules.normalize(settings); this.defs = defs.map((d, i) => Object.assign({}, d, { team: this.s.mode === "teams" ? (i % 2) + 1 : 0 }));
    this.rnd = opts.rnd || Math.random; this.n = defs.length;
    this.total = this.s.rounds; this.round = -1; this.phase = "none"; this.pt = 0; this.over = false;
    this.score = {}; this.defs.forEach((d) => { this.score[d.id] = { pts: 0, ko: 0, falls: 0, rank: [], wins: 0 }; });
    this.input = {}; this.brains = {}; this.out = []; this.history = []; this.lastArena = null; this.stats = { hits: 0, dashes: 0, pulses: 0, kos: 0, misses: 0 };
    this.defs.forEach((d) => { if (d.isBot) this.brains[d.id] = Bot.newBrain(d.level, this.rnd); });
    this.autoIds = new Set(); // joueurs absents, repris par un bot
    this.startRound();
  }
  teamOf() { return this.defs.map((d) => d.team); }
  arenaPool() { const p = this.s.arenas.filter((a) => Arenas.IDS.includes(a)); return p.length ? p : Arenas.IDS; }
  startRound() {
    this.round++; const pool = this.arenaPool(); let id;
    for (let k = 0; k < 8; k++) { id = pool[Math.floor(this.rnd() * pool.length)]; if (pool.length < 2 || id !== this.lastArena) break; }
    this.lastArena = id; let A = null, seed = 0;
    for (let k = 0; k < 6; k++) { seed = Math.floor(this.rnd() * 4294967295); A = Arenas.make(id, seed, { hazards: this.s.hazards }); if (Arenas.arenaCheck(A).ok) break; }
    this.A = A; this.seed = seed; this.W = Sim.makeWorld(A, { friendly: this.s.friendly, noShrink: !(this.s.shrink && !Rules.isTimed(this.s.mode)) });
    const sp = Arenas.spawnsFor(A, this.n, this.s.mode === "teams" ? this.teamOf() : null);
    this.P = {}; this.W.players = this.defs.map((d, i) => { const p = Sim.newPlayer(d.id, d.team, sp[i].x, sp[i].z, sp[i].a); p.inv = 0; this.P[d.id] = p; return p; });
    this.spawnOf = {}; this.defs.forEach((d, i) => { this.spawnOf[d.id] = sp[i]; });
    this.R = {}; this.defs.forEach((d) => { this.R[d.id] = { ko: 0, falls: 0, outAt: null, pts: 0, respawnAt: null, crown: 0, firstOut: false }; });
    this.phase = "intro"; this.pt = 0; this.tPlay = 0; this.crown = null; this.crownTimer = 0; this.endInfo = null; this.freeze = true; this.out.push({ e: "round", i: this.round });
    this.input = {}; Object.values(this.brains).forEach((b) => { b.h = false; b.mx = 0; b.mz = 0; b.mode = "roam"; b.next = 0; });
  }
  roundMsg() { return { i: this.round, total: this.total, arena: this.A.id, seed: this.seed, hazards: this.s.hazards, mode: this.s.mode, shrink: !!(this.s.shrink && !Rules.isTimed(this.s.mode)), dur: this.s.roundTime, double: !!(this.s.finalDouble && this.round === this.total - 1 && this.total > 1), players: this.defs.map((d) => ({ id: d.id, name: d.name, color: d.color, team: d.team, bot: !!d.isBot })) }; }
  setInput(id, inp) { this.input[id] = { mx: +inp.mx || 0, mz: +inp.mz || 0, h: !!inp.h, seq: inp.seq | 0 }; const jq = this.jq || (this.jq = {}), jp = this.jprev || (this.jprev = {}); if (inp.j && !jp[id]) jq[id] = true; jp[id] = !!inp.j; }
  setAuto(id, on) { if (on) this.autoIds.add(id); else this.autoIds.delete(id); if (on && !this.brains[id]) { const d = this.defs.find((x) => x.id === id); this.brains[id] = Bot.newBrain("moyen", this.rnd); } }

  aliveList() { return this.W.players.filter((p) => p.alive); }
  tick() {
    const dt = Sim.DT; this.pt += dt;
    if (this.phase === "intro") { if (this.pt >= T_INTRO) { this.phase = "count"; this.pt = 0; this.out.push({ e: "phase", p: "count" }); } return; }
    if (this.phase === "count") { if (this.pt >= T_COUNT) { this.phase = "play"; this.pt = 0; this.freeze = false; this.out.push({ e: "phase", p: "play" }); } return; }
    if (this.phase === "roundEnd") { if (this.pt >= T_END) { if (this.round + 1 >= this.total) { this.phase = "over"; this.over = true; this.out.push({ e: "phase", p: "over" }); } else this.startRound(); } return; }
    if (this.phase !== "play") return;
    const W = this.W; this.tPlay += dt;
    // entrées, les bots et les absents sont pilotés par l'IA
    const inputs = {};
    for (const p of W.players) {
      const d = this.def(p.id);
      if ((d.isBot || this.autoIds.has(p.id)) && this.brains[p.id]) inputs[p.id] = Bot.decide(W, p, this.brains[p.id], W.t);
      else { const ip = this.input[p.id] || null; const jq = this.jq || (this.jq = {}); if (ip && jq[p.id]) { inputs[p.id] = Object.assign({}, ip, { j: true }); jq[p.id] = false; } else inputs[p.id] = ip; }
    }
    Sim.stepWorld(W, inputs);
    for (const e of Sim.drain(W)) { this.out.push(e); if (e.e === "hit") this.stats.hits++; else if (e.e === "dash") this.stats.dashes++; else if (e.e === "pulse") this.stats.pulses++; else if (e.e === "miss") this.stats.misses++; }
    // éliminations
    const timed = Rules.isTimed(this.s.mode);
    for (const p of W.players) {
      const R = this.R[p.id];
      if (!p.alive && R.outAt === null) {
        R.outAt = this.tPlay; R.falls++; this.stats.kos++;
        const ev = this.out.slice().reverse().find((e) => e.e === "ko" && e.id === p.id);
        const by = ev ? ev.by : null;
        if (by && by !== p.id && this.R[by] && !(this.P[by].team && this.P[by].team === p.team)) { this.R[by].ko++; if (timed) this.R[by].pts = (this.R[by].pts || 0) + 3; }
        else if (timed && this.s.mode === "points") this.R[p.id].pts -= 1;
        if (!by) this.out.push({ e: "selfko", id: p.id });
        if (timed) R.respawnAt = this.tPlay + RESPAWN;
      }
      if (timed && !p.alive && R.respawnAt !== null && this.tPlay >= R.respawnAt) this.respawn(p, R);
    }
    if (this.s.mode === "couronne") this.tickCrown(dt);
    // fin de manche
    if (!timed) {
      const alive = this.aliveList();
      let done = false;
      if (this.s.mode === "teams") { const teams = new Set(alive.map((p) => p.team)); done = teams.size <= 1; } else done = alive.length <= 1;
      if (this.tPlay >= CAP) done = true;
      if (done) this.endRound();
    } else if (this.tPlay >= this.s.roundTime) this.endRound();
  }
  def(id) { return this.defs.find((d) => d.id === id); }
  respawn(p, R) {
    const alive = this.aliveList(); let best = null, bd = -1;
    for (const s of this.A.spawns) { const dm = alive.length ? Math.min.apply(null, alive.map((q) => Math.hypot(q.x - s.x, q.z - s.z))) : 9; if (dm > bd) { bd = dm; best = s; } }
    const np = Sim.newPlayer(p.id, p.team, best.x, best.z, best.a); np.inv = Sim.K.INV_SELF;
    Object.assign(p, np); R.outAt = null; R.respawnAt = null; this.out.push({ e: "respawn", id: p.id, x: p.x, z: p.z });
  }
  tickCrown(dt) {
    const A = this.A; this.crownTimer -= dt;
    if (!this.crown || this.crownTimer <= 0) {
      let c; for (let k = 0; k < 6; k++) { c = A.crown[Math.floor(this.rnd() * A.crown.length)]; if (!this.crown || c.x !== this.crown.x || c.z !== this.crown.z) break; }
      this.crown = { x: c.x, z: c.z, r: 2.2, born: this.tPlay }; this.crownTimer = 14; this.out.push({ e: "crown", x: c.x, z: c.z });
    }
    if (this.tPlay - this.crown.born < 2.5) { this.crown.on = false; this.crown.who = null; return; }
    this.crown.on = true;
    const inside = this.W.players.filter((p) => p.alive && !p.fall && Math.hypot(p.x - this.crown.x, p.z - this.crown.z) < this.crown.r);
    this.crown.who = inside.length === 1 ? inside[0].id : null; this.crown.contested = inside.length > 1;
    if (this.crown.who) { const R = this.R[this.crown.who]; R.crown += dt; R.pts = (R.pts || 0) + dt; }
  }

  // ----- fin de manche et classement -----
  endRound() {
    const mode = this.s.mode, timed = Rules.isTimed(mode); const n = this.n;
    const ids = this.defs.map((d) => d.id);
    let order; // liste d'ensembles d'ids ex aequo, du meilleur au dernier
    if (timed) {
      const sc = ids.map((id) => ({ id, v: this.R[id].pts || 0 })).sort((a, b) => b.v - a.v);
      order = []; sc.forEach((x) => { const last = order[order.length - 1]; if (last && last.v === x.v) last.ids.push(x.id); else order.push({ v: x.v, ids: [x.id] }); });
    } else {
      const key = (id) => (this.P[id].alive ? 1e9 : this.R[id].outAt);
      let list;
      if (mode === "teams") {
        // l'équipe gagnante d'abord, puis par moment d'élimination
        const alive = new Set(this.aliveList().map((p) => p.team));
        list = ids.map((id) => ({ id, v: (alive.has(this.P[id].team) ? 2e9 : 0) + key(id) })).sort((a, b) => b.v - a.v);
        order = []; list.forEach((x) => { const last = order[order.length - 1]; const same = last && (last.team === this.P[x.id].team && alive.has(last.team)); if (same || (last && Math.abs(last.v - x.v) < 1e-9)) last.ids.push(x.id); else order.push({ v: x.v, ids: [x.id], team: this.P[x.id].team }); });
      } else {
        list = ids.map((id) => ({ id, v: key(id) })).sort((a, b) => b.v - a.v);
        order = []; list.forEach((x) => { const last = order[order.length - 1]; if (last && Math.abs(last.v - x.v) < 1e-9) last.ids.push(x.id); else order.push({ v: x.v, ids: [x.id] }); });
      }
    }
    const double = !!(this.s.finalDouble && this.round === this.total - 1 && this.total > 1);
    const res = []; let place = 1;
    order.forEach((grp, gi) => { grp.ids.forEach((id) => { const base = Rules.placePoints(n, place); const win = gi === 0 && order.length > 1 ? 2 : 0; const ko = timed ? 0 : this.R[id].ko * 2; const pts = (base + win + ko) * (double ? 2 : 1); this.score[id].pts += pts; this.score[id].ko += this.R[id].ko; this.score[id].falls += this.R[id].falls; this.score[id].rank.push(place); if (gi === 0 && order.length > 1) this.score[id].wins++; res.push({ id, place, pts, ko: this.R[id].ko, falls: this.R[id].falls, score: timed ? r2(this.R[id].pts || 0) : null }); }); place += grp.ids.length; });
    const winners = order[0].ids.length === n ? [] : order[0].ids;
    this.endInfo = { i: this.round, res, double, winners, team: mode === "teams" && winners.length ? this.P[winners[0]].team : 0 };
    this.history.push(this.endInfo);
    this.phase = "roundEnd"; this.pt = 0; this.out.push({ e: "phase", p: "roundEnd" });
  }
  standings() {
    const rows = this.defs.map((d) => ({ id: d.id, name: d.name, color: d.color, team: d.team, bot: !!d.isBot, pts: this.score[d.id].pts, ko: this.score[d.id].ko, falls: this.score[d.id].falls, wins: this.score[d.id].wins }));
    rows.sort((a, b) => b.pts - a.pts || b.ko - a.ko || a.falls - b.falls);
    rows.forEach((r, i) => { r.place = i > 0 && rows[i - 1].pts === r.pts && rows[i - 1].ko === r.ko && rows[i - 1].falls === r.falls ? rows[i - 1].place : i + 1; });
    return rows;
  }
  teamScores() { if (this.s.mode !== "teams") return null; const t = { 1: 0, 2: 0 }; this.defs.forEach((d) => { t[d.team] += this.score[d.id].pts; }); return t; }

  // ----- messages -----
  snapshot() {
    const W = this.W;
    const p = W.players.map((P) => { const R = this.R[P.id]; const st = !P.alive ? ST.out : P.fall ? ST.fall : P.air ? ST.air : ST[P.st] || 0; return [r2(P.x), r2(P.z), r2(P.y), r2(P.vx), r2(P.vz), r2(Math.atan2(P.fz, P.fx)), st, Math.round(P.ch * 100), (P.alive ? 1 : 0) | (P.inv > 0 ? 2 : 0) | (P.cd > 0 && P.cd < 5 ? 4 : 0), r2(P.dash > 0 ? Math.atan2(P.dz, P.dx) : 0), R.respawnAt !== null ? r2(Math.max(0, R.respawnAt - this.tPlay)) : 0]; });
    const tl = []; this.A.surfaces.forEach((s, i) => { if (s.kind === "crumble") { const T = W.tiles[i]; tl.push(T.touch < 0 ? -1 : T.down < 0 ? -1 : r2(T.down - W.t)); } });
    return { t: r2(W.t), ph: this.phase, pt: r2(this.pt), p, tl, ck: W.clipR > 1e8 ? 0 : r2(W.clipR) };
  }
  hud() {
    const timed = Rules.isTimed(this.s.mode);
    return { ph: this.phase, i: this.round, total: this.total, left: timed ? Math.max(0, this.s.roundTime - this.tPlay) : null, alive: this.W.players.map((p) => (p.alive ? 1 : 0)), ko: this.defs.map((d) => this.R[d.id].ko), pts: this.defs.map((d) => r2(this.R[d.id].pts || 0)), tot: this.defs.map((d) => this.score[d.id].pts), crown: this.crown ? { x: r2(this.crown.x), z: r2(this.crown.z), r: this.crown.r, on: !!this.crown.on, who: this.crown.who || null, contested: !!this.crown.contested } : null, teams: this.teamScores() };
  }
}
module.exports = { Match, T_INTRO, T_COUNT, T_END, RESPAWN, CAP, ST };

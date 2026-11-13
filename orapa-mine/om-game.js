// ============================================================
// ORAPA MINE — Déroulement d'une partie côté serveur
// Le serveur garde les mines, calcule tous les rayons et n'envoie à chacun
// que ce qu'il a le droit de voir. Les pierres ne sont révélées qu'en fin de manche.
// ============================================================
const Rules = require("./public/game/rules.js");
const E = require("./public/game/engine.js");
const Gen = require("./om-gen.js");
const Bot = require("./om-bot.js");

const TS = Math.max(0.001, Number(process.env.OM_TIME_SCALE) || 1);
const rng = Math.random;
const shuffle = (a) => { const r = a.slice(); for (let i = r.length - 1; i > 0; i--) { const j = Math.floor(rng() * (i + 1)); [r[i], r[j]] = [r[j], r[i]]; } return r; };
const defOf = (room, id) => room.players.find((p) => p.id === id);
const present = (room) => room.players.filter((p) => !p.left);
const active = (p) => p && !p.left && (p.isBot || p.connected);
const REVEAL_MS = 22000 * TS, STALL_MS = 60000 * TS;

function start(room, api) {
  const s = Rules.effective(room.settings);
  const ids = present(room).map((p) => p.id);
  const nRounds = s.rounds;
  const g = room.g = { api, s, order: [], round: -1, rounds: nRounds, phase: "wait", phaseUntil: 0, scores: {}, stats: {}, history: [], timer: null, over: false, seq: 0, r: null };
  // ordre des Directeurs et des départs
  let perm = shuffle(ids); for (let i = 0; i < nRounds; i++) { if (!perm.length) perm = shuffle(ids); g.order.push(perm.shift()); }
  room.players.forEach((p) => { g.scores[p.id] = 0; g.stats[p.id] = { wins: 0, shots: 0, solved: 0, bad: 0, directed: 0, stumped: 0 }; });
  api.sysChat(room, "Ouverture de la mine. " + nRounds + " manche" + (nRounds > 1 ? "s" : "") + " au programme.");
  g.timer = setInterval(() => { try { tick(room); } catch (e) { console.error("tick om", e); } }, 250);
  nextRound(room);
}
function onDestroy(room) { if (room.g && room.g.timer) { clearInterval(room.g.timer); room.g.timer = null; } }

// ---------- manche ----------
function roundCfg(g) {
  const s = Object.assign({}, g.s);
  if (s.key === "campagne") { const c = Rules.CAMPAIGN[Math.min(g.round, Rules.CAMPAIGN.length - 1)]; s.board = c.board; s.gems = c.gems; s.kinds = c.kinds; s.shapes = c.shapes; s.W = Rules.BOARDS[c.board][0]; s.H = Rules.BOARDS[c.board][1]; s.laserMasks = c.kinds === "orapa" ? [0] : [1, 2, 4, 7]; }
  return s;
}
function nextRound(room) {
  const g = room.g; g.round++;
  if (g.round >= g.rounds || present(room).length < (g.s.key === "classique" || g.s.key === "croise" ? 2 : 1)) return finish(room, g.round < g.rounds);
  const s = roundCfg(g); const players = present(room).map((p) => p.id);
  const seed = s.seed ? s.seed : s.key === "campagne" ? 31000 + g.round * 97 : Math.floor(rng() * 1e9);
  const r = g.r = { s, W: s.W, H: s.H, mines: [], inv: [], units: [], directorId: null, setup: null, result: null, reveal: null, botAt: {}, gen: null, startAt: 0, endAt: 0, seed };
  if (s.key === "classique") {
    r.directorId = g.order[g.round]; if (!defOf(room, r.directorId) || defOf(room, r.directorId).left) r.directorId = players[0];
    const expl = players.filter((id) => id !== r.directorId);
    r.units = [{ id: 0, members: expl, mine: 0, perMember: true, turn: 0, shots: [], strikes: {}, solved: false, out: false, stallAt: 0, turnUntil: 0 }];
    g.stats[r.directorId].directed++;
  } else if (s.key === "course" || s.key === "precision" || s.key === "croise") {
    r.units = players.map((id, i) => ({ id: i, members: [id], mine: s.key === "croise" ? (i + 1) % players.length : 0, perMember: false, shots: [], strikes: {}, solved: false, out: false, stallAt: 0 }));
  } else if (s.key === "equipes" && players.length >= 2) {
    const sh = shuffle(players); const t = [[], []]; sh.forEach((id, i) => t[i % 2].push(id));
    r.units = t.map((m, i) => ({ id: i, members: m, mine: 0, perMember: false, team: true, shots: [], strikes: {}, solved: false, out: false, stallAt: 0 }));
  } else r.units = [{ id: 0, members: players.slice(), mine: 0, perMember: false, team: true, shots: [], strikes: {}, solved: false, out: false, stallAt: 0 }];
  // inventaires et mines
  const cfgGen = { W: r.W, H: r.H, gems: s.gems, kinds: s.kinds, shapes: s.shapes, adjacent: s.adjacent, laserMasks: s.laserMasks };
  if (s.mines === "gen") { const m = Gen.makeMine(seed, cfgGen); r.inv = m.inv; r.mines = [{ gems: m.gems, owner: null }]; }
  else {
    const m = Gen.makeMine(seed, cfgGen); r.inv = m.inv; // inventaire commun, mines vides pour l'instant
    const owners = s.key === "classique" ? [r.directorId] : players;
    r.mines = owners.map((id) => ({ gems: null, owner: id, ready: false }));
    r.setup = { until: Date.now() + s.setupTime * 1000 * TS, total: s.setupTime * 1000 * TS };
    // les robots posent tout de suite au hasard
    r.mines.forEach((mi) => { const p = defOf(room, mi.owner); if (p && p.isBot) { mi.gems = Gen.placeRandom(rng, r.W, r.H, r.inv, s.adjacent) || Gen.makeMine(rng() * 1e9, cfgGen).gems; mi.ready = true; } });
  }
  r.units.forEach((u) => { u.brain = Bot.newBrain("fute"); u.shotsUsed = 0; u.asks = []; members(room, u).forEach((p) => { if (p.isBot) u.brain = Bot.newBrain(p.level); }); });
  if (r.setup && !r.mines.every((m) => m.ready)) { g.phase = "setup"; g.phaseUntil = r.setup.until; g.seq++; emitAll(room); }
  else startPlay(room);
}
const members = (room, u) => u.members.map((id) => defOf(room, id)).filter((p) => p && !p.left);
function startPlay(room) {
  const g = room.g, r = g.r, s = r.s;
  r.mines.forEach((m) => { if (!m.gems) m.gems = Gen.placeRandom(rng, r.W, r.H, r.inv, s.adjacent) || []; });
  g.phase = "play"; r.startAt = Date.now(); r.endAt = s.roundTime ? Date.now() + s.roundTime * 1000 * TS : 0; g.phaseUntil = r.endAt || 0; g.seq++;
  r.units.forEach((u) => { u.turnUntil = Date.now() + (s.turnTime || 40) * 1000 * TS; });
  // tirs offerts de l'énigme
  if (s.freeShots) {
    const u = r.units[0]; const mine = r.mines[u.mine]; const grid = E.buildGrid(r.W, r.H, mine.gems); const cands = shuffle(Gen.allShots(r.W, r.H, s.laserMasks)); let n = 0;
    for (const c of cands) { if (n >= s.freeShots) break; const res = E.trace(r.W, r.H, grid, mine.gems, c.slot, c.mask, false); if (!res.exits.length && !res.absorbed) continue; if (res.exits.length === 1 && res.exits[0].s === opposite(c.slot.s) && res.exits[0].i === c.slot.i && res.exits[0].m === c.mask) continue; addShot(room, u, null, c.slot, c.mask, true); n++; }
  }
  scheduleBots(room); emitAll(room);
  const names = r.units.map((u) => members(room, u).map((p) => p.name).join(" et ")).join(" contre ");
  g.api.sysChat(room, "Manche " + (g.round + 1) + " sur " + g.rounds + ". " + (r.directorId ? (defOf(room, r.directorId) || {}).name + " est le Directeur. " : "") + names + (s.key === "coop" || s.key === "enigme" || s.key === "campagne" ? " fouillent ensemble." : " fouillent la mine."));
}
const opposite = (s) => ({ N: "S", S: "N", E: "W", W: "E" }[s]);

// ---------- tirs ----------
function budgetLeft(r, u) { return r.s.shots ? r.s.shots - u.shotsUsed : null; }
function canAct(r, u, pid) {
  if (u.solved || u.out || !u.members.includes(pid)) return false;
  if (r.s.share === "turn") { const act = u.members.filter((id) => !u.mout || !u.mout[id]); return act.length > 0 && act[u.turn % act.length] === pid; }
  if (u.mout && u.mout[pid]) return false;
  return true;
}
function shotResult(r, mine, slot, mask) {
  const grid = E.buildGrid(r.W, r.H, mine.gems); const full = E.trace(r.W, r.H, grid, mine.gems, slot, mask, true);
  const out = { exits: full.exits, absorbed: full.absorbed };
  if (r.s.trace === "complet") out.rays = full.rays.map((x) => ({ pts: x.pts, m: x.m, end: x.end }));
  else if (r.s.trace === "partiel") {
    // un seul trait, jusqu'à la première pierre touchée
    let x, y, dx, dy; const W = r.W, H = r.H;
    if (slot.s === "N") { x = slot.i; y = -1; dx = 0; dy = 1; } else if (slot.s === "S") { x = slot.i; y = H; dx = 0; dy = -1; } else if (slot.s === "W") { x = -1; y = slot.i; dx = 1; dy = 0; } else { x = W; y = slot.i; dx = -1; dy = 0; }
    const pts = [[x, y]]; for (let k = 0; k < W + H + 2; k++) { x += dx; y += dy; pts.push([x, y]); if (x < 0 || y < 0 || x >= W || y >= H) break; if (grid[y * W + x] >= 0) break; }
    out.rays = [{ pts, m: mask }];
  }
  return out;
}
function addShot(room, u, pid, slot, mask, free) {
  const g = room.g, r = g.r; const mine = r.mines[u.mine]; const res = shotResult(r, mine, slot, mask);
  const sig = E.shotSig({ exits: res.exits, absorbed: res.absorbed });
  const sh = { n: u.shots.length + 1, by: pid, slot, mask, exits: res.exits, absorbed: res.absorbed, rays: res.rays || null, sig, free: !!free };
  u.shots.push(sh); if (!free) { u.shotsUsed++; if (pid) g.stats[pid].shots++; }
  return sh;
}
function shoot(room, u, pid, slot, mask) {
  const g = room.g, r = g.r; if (g.phase !== "play") return "Pas maintenant.";
  if (!canAct(r, u, pid)) return r.s.share === "turn" ? "Ce n'est pas ton tour." : "Tu ne peux plus tirer.";
  if (!r.s.laserMasks.includes(mask)) return "Ce laser n'existe pas dans cette partie.";
  const sl = E.slotsOf(r.W, r.H).find((x) => x.s === slot.s && x.i === slot.i); if (!sl) return "Cette entrée n'existe pas.";
  const bl = budgetLeft(r, u); if (bl !== null && bl <= 0) return "Plus aucun tir, il ne reste qu'à accuser.";
  if (u.shots.some((x) => E.slotKey(x.slot) === E.slotKey(sl) && x.mask === mask)) return "Ce tir a déjà été fait.";
  const sh = addShot(room, u, pid, sl, mask, false);
  if (r.s.share === "turn") { u.turn++; u.turnUntil = Date.now() + r.s.turnTime * 1000 * TS; }
  if (budgetLeft(r, u) === 0) u.stallAt = Date.now() + STALL_MS;
  emitAll(room); return null;
}
// question sur une case, comme dans l'original. On apprend la couleur de la pierre, pas sa forme ni son sens, et ça coûte un tir.
function askCell(room, u, pid, x, y) {
  const g = room.g, r = g.r; if (g.phase !== "play") return "Pas maintenant.";
  if (!canAct(r, u, pid)) return r.s.share === "turn" ? "Ce n'est pas ton tour." : "Tu ne peux plus agir.";
  if (!(x >= 0 && y >= 0 && x < r.W && y < r.H) || x !== Math.floor(x) || y !== Math.floor(y)) return "Cette case n'existe pas.";
  const bl = budgetLeft(r, u); if (bl !== null && bl <= 0) return "Plus aucun tir, il ne reste qu'à accuser.";
  if (u.asks.some((a) => a.x === x && a.y === y)) return "Tu as déjà posé cette question.";
  const mine = r.mines[u.mine]; const grid = E.buildGrid(r.W, r.H, mine.gems); const gi = grid[y * r.W + x];
  const a = { x, y, k: gi < 0 ? "vide" : mine.gems[gi].k, m: gi < 0 ? 0 : mine.gems[gi].m || 0, by: pid, n: u.asks.length + 1 };
  u.asks.push(a); u.shotsUsed++; g.stats[pid].shots++;
  if (r.s.share === "turn") { u.turn++; u.turnUntil = Date.now() + r.s.turnTime * 1000 * TS; }
  if (budgetLeft(r, u) === 0) u.stallAt = Date.now() + STALL_MS;
  emitAll(room); return null;
}
function accuse(room, u, pid, placement) {
  const g = room.g, r = g.r; if (g.phase !== "play") return { err: "Pas maintenant." };
  if (!canAct(r, u, pid)) return { err: r.s.share === "turn" ? "Ce n'est pas ton tour." : "Tu ne peux plus accuser." };
  const gems = Gen.fromPlacement(r.W, r.H, r.inv, placement, true); if (!gems) return { err: "Il faut placer toutes les pierres, sans les superposer." };
  const mine = r.mines[u.mine]; const ok = E.effectString(r.W, r.H, gems) === E.effectString(r.W, r.H, mine.gems);
  if (ok) { u.solved = true; u.solvedAt = Date.now(); u.solvedBy = pid; g.stats[pid].solved++; return { ok: true }; }
  g.stats[pid].bad++;
  const lives = r.s.accLives; let outNow = false;
  if (u.perMember) { u.strikes[pid] = (u.strikes[pid] || 0) + 1; if (u.strikes[pid] >= lives) { (u.mout = u.mout || {})[pid] = true; outNow = true; } if (u.members.every((id) => u.mout && u.mout[id])) u.out = true; }
  else { u.strikes.u = (u.strikes.u || 0) + 1; if (u.strikes.u >= lives) { u.out = true; outNow = true; } }
  let hint = null;
  if (r.s.accHint) { let c = 0; gems.forEach((gm, i) => { const t = mine.gems[i]; if (t && t.x === gm.x && t.y === gm.y && t.rot === gm.rot && (t.k === "mirror" || t.k === "splitter" || t.k === "gem" ? t.d === gm.d : true)) c++; else if (t && E.effectString(r.W, r.H, [gm]) === E.effectString(r.W, r.H, [t])) c++; }); hint = c; }
  if (r.s.share === "turn") { u.turn++; u.turnUntil = Date.now() + r.s.turnTime * 1000 * TS; }
  return { ok: false, hint, out: outNow };
}
const costOf = (u) => u.shotsUsed + 3 * (u.perMember ? Object.values(u.strikes).reduce((a, b) => a + b, 0) : (u.strikes.u || 0));
function checkEnd(room) {
  const g = room.g, r = g.r; if (g.phase !== "play") return;
  if (r.s.key === "precision") {
    // temps illimité, la manche finit quand chacun a trouvé ou est sorti, le moins de tirs gagne
    if (!r.units.every((u) => u.solved || u.out)) return;
    const sv = r.units.filter((u) => u.solved).sort((a, b) => costOf(a) - costOf(b) || a.solvedAt - b.solvedAt);
    return endRound(room, sv[0] || null);
  }
  const solved = r.units.filter((u) => u.solved);
  if (solved.length) { solved.sort((a, b) => a.solvedAt - b.solvedAt); return endRound(room, solved[0]); }
  if (r.units.every((u) => u.out)) return endRound(room, null);
}

// ---------- fin de manche ----------
function endRound(room, win) {
  const g = room.g, r = g.r, s = r.s; if (g.phase === "reveal") return;
  const gains = {}; room.players.forEach((p) => { gains[p.id] = 0; });
  const used = (u) => u.shotsUsed;
  const coopLike = s.key === "coop" || s.key === "enigme" || s.key === "campagne";
  if (win) {
    const bonus = s.shots ? Math.max(0, Math.floor((s.shots - used(win)) / 3)) : Math.max(0, 6 - Math.floor((s.key === "precision" ? costOf(win) : used(win)) / 3));
    const pts = 6 + Math.min(6, bonus) + (s.key === "enigme" || s.key === "campagne" ? 2 : 0);
    win.members.forEach((id) => { gains[id] += pts; g.stats[id].wins++; });
    if (s.key === "precision") r.units.forEach((u) => { if (u !== win && u.solved) u.members.forEach((id) => { gains[id] += 3; }); });
    if (s.key === "classique") { gains[r.directorId] += Math.min(6, Math.floor(used(win) / 2)); }
    if (s.key === "croise") { /* le propriétaire de la mine résolue ne marque pas */ }
  } else {
    if (s.key === "classique") { gains[r.directorId] += 8; g.stats[r.directorId].stumped++; }
    if (s.key === "croise") r.units.forEach((u) => { const owner = r.mines[u.mine].owner; if (owner) gains[owner] += 3; });
  }
  if (!coopLike && s.key !== "classique") r.units.forEach((u) => { if (u !== win && u.solved === false && !u.out && win) { /* a continué à chercher, rien */ } });
  Object.keys(gains).forEach((id) => { g.scores[id] = (g.scores[id] || 0) + gains[id]; });
  r.result = { win: win ? win.id : null };
  r.reveal = { gains, win: win ? win.id : null, mines: r.mines.map((m) => ({ owner: m.owner, gems: m.gems.map(pubGem) })), units: r.units.map((u) => ({ id: u.id, members: u.members, mine: u.mine, cost: costOf(u), shots: u.shots.length, solved: u.solved, out: u.out, shotsList: u.shots.map(pubShotFull), asks: (u.asks || []).map((a) => ({ x: a.x, y: a.y, k: a.k, m: a.m })) })) };
  g.history.push({ round: g.round, ok: !!win, winners: win ? win.members : [], shots: win ? used(win) : null, director: r.directorId });
  g.phase = "reveal"; g.phaseUntil = Date.now() + REVEAL_MS; g.seq++; emitAll(room);
  const names = win ? win.members.map((id) => (defOf(room, id) || {}).name).join(" et ") : null;
  g.api.sysChat(room, win ? "Mine résolue par " + names + " en " + used(win) + " tir" + (used(win) > 1 ? "s" : "") + "." : "Personne n'a trouvé la mine.");
}
function pubGem(g) { return { k: g.k, m: g.m, d: g.d, shape: g.shape, rot: g.rot, cells: g.cells, x: g.x, y: g.y }; }
function pubShotFull(sh) { return { n: sh.n, slot: sh.slot, mask: sh.mask, by: sh.by, free: sh.free }; }
function standings(room) {
  const g = room.g; const rows = room.players.map((p) => ({ id: p.id, name: p.name, color: p.color, left: !!p.left, pts: g.scores[p.id] || 0, wins: g.stats[p.id].wins, shots: g.stats[p.id].shots, bad: g.stats[p.id].bad, solved: g.stats[p.id].solved, directed: g.stats[p.id].directed, stumped: g.stats[p.id].stumped }));
  rows.sort((a, b) => b.pts - a.pts || b.wins - a.wins);
  let rank = 0, prev = null; rows.forEach((r, i) => { if (!prev || r.pts !== prev.pts) rank = i + 1; r.rank = rank; prev = r; });
  return rows;
}
function awards(rows) {
  const out = []; const best = (fn, min) => { let b = null; rows.forEach((r) => { const v = fn(r); if (v >= min && (!b || v > b.v)) b = { r, v }; }); return b; };
  const a1 = best((r) => r.solved, 1); if (a1) out.push({ id: a1.r.id, icon: "💎", title: "Le fin limier", detail: a1.v + " mine" + (a1.v > 1 ? "s" : "") + " démasquée" + (a1.v > 1 ? "s" : "") });
  const a2 = best((r) => r.bad, 1); if (a2) out.push({ id: a2.r.id, icon: "🧨", title: "Le dynamiteur", detail: a2.v + " accusation" + (a2.v > 1 ? "s" : "") + " ratée" + (a2.v > 1 ? "s" : "") });
  const a3 = best((r) => r.stumped, 1); if (a3) out.push({ id: a3.r.id, icon: "🎩", title: "Le Directeur retors", detail: a3.v + " mine" + (a3.v > 1 ? "s" : "") + " jamais trouvée" + (a3.v > 1 ? "s" : "") });
  const a4 = best((r) => r.shots, 1); if (a4) out.push({ id: a4.r.id, icon: "🔦", title: "La gâchette facile", detail: a4.v + " tirs de laser" });
  return out;
}
function finish(room, aborted) {
  const g = room.g; if (g.over) return;
  g.over = true; g.phase = "over"; if (g.timer) { clearInterval(g.timer); g.timer = null; }
  const rows = standings(room);
  g.final = { players: room.players.map((p) => ({ id: p.id, name: p.name, color: p.color })), rows, awards: awards(rows), history: g.history, aborted: !!aborted };
  emitAll(room); g.api.emitAll(room, "om:over", g.final);
}

// ---------- robots ----------
function scheduleBots(room) {
  const g = room.g, r = g.r; const now = Date.now();
  r.units.forEach((u) => { members(room, u).forEach((p) => { if (p.isBot && !r.botAt[p.id]) r.botAt[p.id] = now + (3500 + rng() * 5000) * TS * (p.level === "novice" ? 0.7 : p.level === "genie" ? 1.15 : 1); }); });
}
function botAct(room) {
  const g = room.g, r = g.r; const now = Date.now();
  for (const u of r.units) {
    if (u.solved || u.out) continue;
    for (const p of members(room, u)) {
      if (!p.isBot || !r.botAt[p.id] || now < r.botAt[p.id] || !canAct(r, u, p.id)) continue;
      r.botAt[p.id] = now + (3500 + rng() * 5500) * TS;
      const obs = u.shots.map((x) => ({ slot: x.slot, mask: x.mask, sig: x.sig }));
      const bl = budgetLeft(r, u); const lives = r.s.accLives - (u.perMember ? (u.strikes[p.id] || 0) : (u.strikes.u || 0));
      u.brain.level = p.level;
      const d = Bot.decide(u.brain, { W: r.W, H: r.H, inv: r.inv, shots: obs, budgetLeft: bl, laserMasks: r.s.laserMasks, adjacent: true });
      if (!d) { if (bl !== null && bl <= 0) { /* plus rien à faire */ } continue; }
      if (d.type === "shoot") shoot(room, u, p.id, d.slot, d.mask);
      else { const res = accuse(room, u, p.id, d.placement); if (res.ok === false) { u.brain.pool = []; } checkEnd(room); emitAll(room); if (res.ok === false) g.api.sysChat(room, p.name + " accuse à tort."); }
      return;
    }
  }
}

// ---------- horloge ----------
function tick(room) {
  const g = room.g; if (!g || g.over) return;
  if (!present(room).some((p) => !p.isBot)) return finish(room, true);
  const r = g.r; const now = Date.now();
  if (g.phase === "setup") {
    if (r.mines.every((m) => m.ready) || now >= r.setup.until) startPlay(room);
  } else if (g.phase === "play") {
    // joueurs partis
    r.units.forEach((u) => { if (!u.solved && !u.out && !members(room, u).length) u.out = true; });
    if (r.s.share === "turn") { const u = r.units[0]; const act = u.members.filter((id) => !u.mout || !u.mout[id]); const cp = act.length ? defOf(room, act[u.turn % act.length]) : null; if (!u.solved && !u.out && cp && !active(cp)) { u.turn++; u.turnUntil = now + r.s.turnTime * 1000 * TS; emitAll(room); }
      if (!u.solved && !u.out && now >= u.turnUntil) { u.turn++; u.turnUntil = now + r.s.turnTime * 1000 * TS; emitAll(room); } }
    r.units.forEach((u) => { if (u.stallAt && now >= u.stallAt && !u.solved && !u.out) { u.out = true; emitAll(room); } });
    botAct(room);
    if (r.endAt && now >= r.endAt) return endRound(room, null);
    if (r.s.key === "classique") { const d = defOf(room, r.directorId); if (!d || d.left) return endRound(room, null); }
    checkEnd(room);
  } else if (g.phase === "reveal" && now >= g.phaseUntil) nextRound(room);
}

// ---------- états envoyés ----------
function unitOf(r, pid) { return r.units.find((u) => u.members.includes(pid)) || null; }
function pubShot(sh, withPath) { return { n: sh.n, by: sh.by, slot: sh.slot, mask: sh.mask, exits: sh.exits, absorbed: sh.absorbed, rays: withPath ? sh.rays : null, free: sh.free }; }
function publicState(room, pid) {
  const g = room.g; const base = { now: Date.now(), phase: g.phase, round: g.round, rounds: g.rounds, seq: g.seq, scores: g.scores, phaseUntil: g.phaseUntil, sfx: g.s.sfx };
  if (g.phase === "over" || g.phase === "wait" || !g.r) return base;
  const r = g.r, s = r.s; const my = unitOf(r, pid); const isDir = pid === r.directorId;
  const st = Object.assign(base, {
    key: s.key, faithful: s.kinds === "orapa", W: r.W, H: r.H, trace: s.trace, lasers: s.laserMasks, budget: s.shots || null, lives: s.accLives, accHint: s.accHint, share: s.share, directorId: r.directorId, roundTime: s.roundTime,
    inv: r.inv.map((g2, i) => ({ idx: i, k: g2.k, m: g2.m, shape: g2.shape, cells: E.SHAPES[g2.shape] })),
    campaign: s.key === "campagne" ? { level: g.round + 1, levels: g.rounds } : null, puzzle: s.key === "enigme" ? s.puzzle : null,
    units: r.units.map((u) => ({ id: u.id, members: u.members, shots: u.shots.length, used: u.shotsUsed, solved: u.solved, out: u.out, turn: s.share === "turn" ? u.members.filter((id) => !u.mout || !u.mout[id])[u.turn % Math.max(1, u.members.filter((id) => !u.mout || !u.mout[id]).length)] : null, turnUntil: u.turnUntil || 0, mout: u.mout || {}, strikes: u.perMember ? u.strikes : { u: u.strikes.u || 0 }, perMember: !!u.perMember, stallAt: u.stallAt || 0 })),
    myUnit: my ? my.id : null,
  });
  if (g.phase === "setup") {
    const mi = r.mines.findIndex((m) => m.owner === pid);
    st.setup = { until: r.setup.until, total: r.setup.total, owners: r.mines.map((m) => ({ id: m.owner, ready: !!m.ready })), mine: mi >= 0 ? mi : null };
    if (mi >= 0 && r.mines[mi].gems) st.setup.myGems = r.mines[mi].gems.map(pubGem);
  }
  if (g.phase === "play") {
    const full = s.trace !== "mystere";
    if (my) { st.shots = my.shots.map((x) => pubShot(x, full)); st.asks = my.asks; }
    else if (isDir || true) { // Directeur et spectateurs voient les tirs du groupe observé
      const u = r.units[0]; if (isDir && u) { st.shots = u.shots.map((x) => pubShot(x, full)); st.asks = u.asks; }
    }
    if (isDir) { const m = r.mines[0]; if (m && m.gems) st.dirMine = m.gems.map(pubGem); }
    // en mines croisées on voit sa propre mine, pour ne pas l'oublier
    const mine = r.mines.find((m) => m.owner === pid); if (mine && mine.gems && s.key === "croise") st.dirMine = mine.gems.map(pubGem);
  }
  if (g.phase === "reveal") { st.reveal = r.reveal; st.shots = null; }
  return st;
}
function sendTo(room, sock, p) { try { sock.emit("om:state", publicState(room, p.id)); } catch (e) { console.error("om emit", e); } }
function emitAll(room) { const g = room.g; if (!g) return; room.players.forEach((p) => { if (p.isBot || !p.socketId) return; const s = g.api.io.sockets.sockets.get(p.socketId); if (s) sendTo(room, s, p); }); }

// ---------- sockets ----------
function bind(socket, helpers, api) {
  const { ctx, me, safe, toast } = helpers;
  const cur = () => { const room = ctx.room; const p = me(); return room && room.g && room.g.r && p ? { room, g: room.g, r: room.g.r, p } : null; };
  // au plus juste, on peut renoncer à sa manche, et l'hôte peut la clore s'il ne reste que des joueurs qui ne bougent plus
  socket.on("om:giveup", safe(() => {
    const c = cur(); if (!c || c.g.phase !== "play" || c.r.s.key !== "precision") return; const u = unitOf(c.r, c.p.id); if (!u || u.solved || u.out) return;
    u.out = true; c.g.api.sysChat(c.room, c.p.name + " renonce à cette manche."); emitAll(c.room); checkEnd(c.room);
  }));
  socket.on("om:forceend", safe(() => {
    const c = cur(); if (!c || c.g.phase !== "play" || c.r.s.key !== "precision" || !helpers.isHost()) return;
    c.r.units.forEach((u) => { if (!u.solved) u.out = true; }); c.g.api.sysChat(c.room, "L'hôte clôt la manche."); emitAll(c.room); checkEnd(c.room);
  }));
  socket.on("om:place", safe((d) => {
    const c = cur(); if (!c || c.g.phase !== "setup") return; const mi = c.r.mines.findIndex((m) => m.owner === c.p.id); if (mi < 0) return;
    const gems = Gen.fromPlacement(c.r.W, c.r.H, c.r.inv, d && d.placement, c.r.s.adjacent);
    if (!gems) return toast("Il faut poser toutes les pierres dans la mine, sans les superposer.");
    if (!c.r.s.adjacent && !E.valid(c.r.W, c.r.H, gems, true)) return toast("Les pierres ne doivent pas se toucher dans cette partie.");
    c.r.mines[mi].gems = gems; c.r.mines[mi].ready = true; emitAll(c.room);
    if (c.r.mines.every((m) => m.ready)) startPlay(c.room);
  }));
  socket.on("om:random", safe(() => {
    const c = cur(); if (!c || c.g.phase !== "setup") return; const mi = c.r.mines.findIndex((m) => m.owner === c.p.id); if (mi < 0) return;
    const gems = Gen.placeRandom(rng, c.r.W, c.r.H, c.r.inv, c.r.s.adjacent); if (!gems) return toast("Impossible de placer toutes les pierres.");
    socket.emit("om:random", { placement: gems.map((g, i) => ({ idx: i, x: g.x, y: g.y, rot: g.rot, d: g.d })) });
  }));
  socket.on("om:unready", safe(() => { const c = cur(); if (!c || c.g.phase !== "setup") return; const mi = c.r.mines.findIndex((m) => m.owner === c.p.id); if (mi >= 0) { c.r.mines[mi].ready = false; emitAll(c.room); } }));
  socket.on("om:shoot", safe((d) => {
    const c = cur(); if (!c || c.g.phase !== "play") return; const u = unitOf(c.r, c.p.id); if (!u) return;
    const err = shoot(c.room, u, c.p.id, { s: String(d && d.s), i: +(d && d.i) }, +(d && d.mask)); if (err) toast(err);
  }));
  socket.on("om:ask", safe((d) => {
    const c = cur(); if (!c || c.g.phase !== "play") return; const u = unitOf(c.r, c.p.id); if (!u) return;
    const err = askCell(c.room, u, c.p.id, +(d && d.x), +(d && d.y)); if (err) toast(err);
  }));
  socket.on("om:accuse", safe((d) => {
    const c = cur(); if (!c || c.g.phase !== "play") return; const u = unitOf(c.r, c.p.id); if (!u) return;
    const res = accuse(c.room, u, c.p.id, d && d.placement); if (res.err) return toast(res.err);
    socket.emit("om:accuseResult", { ok: res.ok, hint: res.hint, out: res.out });
    if (!res.ok) api.sysChat(c.room, c.p.name + " accuse à tort" + (res.out ? " et sort de la manche" : "") + ".");
    checkEnd(c.room); emitAll(c.room);
  }));
  socket.on("om:skip", safe(() => { const c = cur(); if (!c || !helpers.isHost()) return; if (c.g.phase === "play") endRound(c.room, null); else if (c.g.phase === "reveal") nextRound(c.room); else if (c.g.phase === "setup") startPlay(c.room); }));
}
function onReconnect(room, p) { const g = room.g; if (!g) return; const s = g.api.io.sockets.sockets.get(p.socketId); if (s) { sendTo(room, s, p); if (g.over && g.final) s.emit("om:over", g.final); } }
function onLeave(room, p) { const g = room.g; if (!g) return; if (!room.players.some((x) => !x.isBot && !x.left)) return onDestroy(room); }
module.exports = { start, bind, onReconnect, onLeave, onDestroy, canReturn: (room) => !!(room.g && room.g.over), publicState, standings };

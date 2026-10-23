// ============================================================
// BUS BAZAR — Simulation (aucune dépendance réseau, testable seule)
// Le serveur fait avancer cette simulation et valide chaque action.
// ============================================================
const D = require("./public/game/data.js");
const Rd = require("./public/game/road.js");
const Rules = require("./public/game/rules.js");
const { clamp } = D;

const DT = 0.05;
const CHAOS_INT = [70, 45, 30, 20, 13];
const WEAR_K = [0, 0.5, 1, 1.6, 2.4];
const TRAFFIC_K = [0.2, 0.6, 1, 1.5, 2.1];
const DEMAND_K = [0.35, 0.7, 1, 1.5, 2.1];
const RES_K = { rare: 0.65, normal: 1, abondant: 1.5 };
const OBJ_K = { rare: 0.5, normal: 1, frequent: 1.7 };
const PRICES = { spares: 30, tape: 10, coolant: 15, snacks: 8, medkit: 25, fuel: 18 };
const HP_SYS = ["engine", "cooling", "brakes", "tires", "electric", "tank", "body"];
const STOP_ZONE = 130;

// ---------- création ----------
function create(settings, seedOverride) {
  const cfg = Rules.normalize(settings);
  const seed = String(seedOverride || cfg.seed || Math.random().toString(36).slice(2, 8)).slice(0, 20);
  const M = D.MODE_BY_ID[cfg.mode] || D.MODES[0];
  const rng = Rd.rngOf(seed + "|sim");
  const nSeg = Rules.SEGMENTS[cfg.duration] || 7;
  const rk = RES_K[cfg.resources] * M.res;
  const S = {
    cfg, M, seed, rng, t: 0, phase: "stop", nSeg, si: -1, seg: null, biome: D.BIOMES[0], options: null, chosen: null,
    bus: { s: 0, v: 0, x: 0, vx: 0, steer: 0, thr: 0, brk: 0 },
    hp: { engine: 100, cooling: 100, brakes: 100, tires: 100, electric: 100, tank: 100, body: 100 },
    fuel: Math.round(clamp(100 * (cfg.resources === "rare" ? 0.85 : 1), 50, 100)), temp: 40,
    inv: { spares: Math.max(1, Math.round(3 * rk)), tape: Math.max(1, Math.round(3 * rk)), coolant: Math.max(1, Math.round(2 * rk)), snacks: Math.round(6 * rk), medkit: 1, money: Math.round(120 * rk), items: {} },
    patches: [], pax: [], obs: [], inc: [], pending: [], log: [], logSeq: 0, noise: 0, jolt: 0,
    cd: {}, job: null, hornT: 0, slip: 0, windPush: 0, pull: 0, steerBias: 0, blind: 0, fog: 0, leak: false, stuckHorn: false, song: 0, flicker: 0, radioOn: false,
    stalled: false, deadT: 0, em: 0, dodge: null, stopT: 0, ready: false, stopOffer: null, bonus: null, tip: null, shortcut: 0, rough: 0,
    plannedCum: 45, delayNow: 0, deadline: 0, incTimer: 28 / Math.max(0.5, M.ev), lastIncId: null, paxSeq: 0, stopsDone: 0, satSum: 0, satT: 0,
    votes: null, gpsT: 0,
    stats: { complaints: 0, incidents: 0, solved: 0, hits: 0, horns: 0, slaps: 0, tapeUsed: 0, radio: 0, justesse: 0, requestsDone: 0, pranks: 0, items: 0, trophies: 0, fines: 0, hardBrakes: 0, stops: 0, delivered: 0, deliveredMood: 0 },
    objectives: [], end: null, clock: 0,
  };
  S.deadline = nSeg * 140 * M.time * 1.9;
  // objets de départ
  const startItems = 1 + (cfg.objects === "frequent" ? 1 : 0);
  for (let i = 0; i < startItems; i++) giveItem(S, pickItem(S, rng));
  // passagers
  const ids = D.ARCHETYPES.map((a) => a.id); const order = shuffle(rng, ids);
  for (let i = 0; i < cfg.passengers; i++) addPax(S, order[i % order.length], rng);
  // objectifs secondaires
  if (cfg.objectives) {
    const pool = shuffle(rng, ["ponctuel", "propre", "colis", "vip"]); const n = nSeg >= 7 ? 3 : 2; let crit = false;
    pool.slice(0, n).forEach((id) => {
      if (id === "vip") { const p = S.pax[Math.floor(rng() * S.pax.length)]; p.vip = true; p.name = "Mme la Directrice"; p.mood = Math.max(p.mood, 55); crit = true; S.objectives.push({ id, crit: true, label: "La passagère VIP doit arriver contente", info: "Mme la Directrice reste à bord jusqu'au bout. Si elle perd patience trop longtemps, elle quitte le bus et la mission est annulée.", status: "open", pid: p.id, low: 0 }); }
      else if (id === "colis") { let p = S.pax.find((q) => q.arch === "colis" && !q.vip); if (!p) { p = S.pax.find((q) => !q.vip); } if (p) { p.parcel = true; S.objectives.push({ id, crit: false, label: "Livrer le colis fragile jusqu'au terminus", info: "Le porteur du colis (" + p.name + ") doit rester à bord jusqu'à la fin et ne pas être évacué.", status: "open", pid: p.id }); } }
      else if (id === "ponctuel") S.objectives.push({ id, crit: false, label: "Arriver presque à l'heure", info: "Accumuler moins de 20 pour cent de retard sur l'horaire prévu à l'arrivée.", status: "open" });
      else if (id === "propre") S.objectives.push({ id, crit: false, label: "Garder une carrosserie à plus de 60 pour cent", info: "La carrosserie doit rester au dessus de 60 pour cent à l'arrivée.", status: "open" });
    });
  }
  S.crit = S.objectives.some((o) => o.crit);
  addLog(S, "info", "🚌", "Bienvenue à bord. Votre mission mène à " + Rd.stopName(seed, nSeg) + ", en " + nSeg + " étapes.");
  openStop(S, true);
  return S;
}

function shuffle(rng, a) { const r = a.slice(); for (let i = r.length - 1; i > 0; i--) { const j = Math.floor(rng() * (i + 1)); const t = r[i]; r[i] = r[j]; r[j] = t; } return r; }
function pickW(rng, list, wf) { let tot = 0; const ws = list.map((x) => { const w = Math.max(0, wf(x)); tot += w; return w; }); if (tot <= 0) return null; let r = rng() * tot; for (let i = 0; i < list.length; i++) { r -= ws[i]; if (r <= 0) return list[i]; } return list[list.length - 1]; }

// ---------- journal ----------
function addLog(S, kind, icon, text, extra) {
  const e = Object.assign({ id: ++S.logSeq, t: Math.round(S.t * 10) / 10, kind, icon, text }, extra || {});
  S.log.push(e); if (S.log.length > 90) S.log.shift(); return e;
}

// ---------- objets ----------
function pickItem(S, rng) {
  const r = rng || S.rng;
  return pickW(r, D.ITEMS, (it) => it.weight * (it.id === "trophee" ? S.M.absurd : 1));
}
function giveItem(S, it, quiet) {
  if (!it) return;
  if (it.id === "ruban") { S.inv.tape += 3; if (!quiet) addLog(S, "item", it.icon, "Trouvé un ruban adhésif géant, trois rouleaux de plus pour la caisse à outils."); return; }
  if (it.id === "snacks") { S.inv.snacks += 4; if (!quiet) addLog(S, "item", it.icon, "Une réserve de snacks vient d'être trouvée, quatre de plus."); return; }
  if (it.id === "trousse") { S.inv.medkit += 1; if (!quiet) addLog(S, "item", it.icon, "Une trousse de premiers secours rejoint le bord. On dit qu'elle contient parfois un canard."); return; }
  S.inv.items[it.id] = (S.inv.items[it.id] || 0) + 1; S.stats.items++;
  if (!quiet) addLog(S, "item", it.icon, "Nouvel objet à bord, " + it.label + ".");
}
const has = (S, id) => (S.inv.items[id] || 0) > 0;
function useItem(S, id) { if (!has(S, id)) return false; S.inv.items[id]--; if (S.inv.items[id] <= 0) delete S.inv.items[id]; return true; }

// ---------- passagers ----------
function addPax(S, archId, rng, opts) {
  const r = rng || S.rng; const A = D.ARCH_BY_ID[archId]; const used = new Set(S.pax.map((p) => p.name));
  const pool = D.PAX_NAMES.filter((n) => !used.has(n)); const name = pool.length ? pool[Math.floor(r() * pool.length)] : "Passager " + (S.paxSeq + 1);
  const trait = pickW(r, D.TRAITS, (t) => (t.id === "normal" ? 3 : 1));
  const p = { id: "p" + (++S.paxSeq), name, arch: archId, mood: Math.round(A.mood[0] + r() * (A.mood[1] - A.mood[0])), trait: trait.id, tol: trait.k, state: "normal", req: null, reqCd: 4 + r() * 30, quirkT: 20 + r() * 60, revealed: false, invincible: 0, boardSeg: S.si, vip: false, parcel: false, lowT: 0 };
  if (opts && opts.mood != null) p.mood = opts.mood;
  S.pax.push(p); return p;
}
const paxById = (S, id) => S.pax.find((p) => p.id === id);
const avgMood = (S) => (S.pax.length ? S.pax.reduce((a, p) => a + p.mood, 0) / S.pax.length : 0);
function addNoise(S, v) { S.noise = clamp(S.noise + v, 0, 3); }
function moodAll(S, d, filter) { S.pax.forEach((p) => { if (filter && !filter(p)) return; p.mood = clamp(p.mood + d * (d < 0 && p.invincible > 0 ? 0 : 1), 0, 100); }); }

function newReq(S, p) {
  const A = D.ARCH_BY_ID[p.arch]; const type = pickW(S.rng, Object.keys(A.reqs), (k) => A.reqs[k]); if (!type) return;
  if (type === "silence" && S.noise < 0.05 && S.rng() < 0.4) return;
  p.req = { type, ttl: D.REQUESTS[type].ttl * (S.M.time > 1 ? 1.15 : 1), age: 0 };
}
function satisfyReq(S, p, gain, why) {
  if (!p.req) return; const rq = p.req; p.req = null; p.reqCd = 25 + S.rng() * 35 / DEMAND_K[S.cfg.demand];
  p.mood = clamp(p.mood + (gain == null ? 10 : gain), 0, 100); S.stats.requestsDone++;
  return rq;
}

// ---------- étape et route ----------
function biomeOf(id) { return D.BIOMES.filter((b) => b.id === id)[0] || D.BIOMES[0]; }
function makeOptions(S, idx) {
  const nrng = Rd.rngOf(S.seed + "|nav" + idx); const out = [];
  ["direct", "sure", "pittoresque"].forEach((kind) => {
    const seg = Rd.makeSegment({ seed: S.seed, index: idx, kind, difficulty: S.cfg.difficulty, biomes: S.cfg.biomes });
    const bad = S.hp.electric < 30 ? 0.4 : 0.12; const wrong = nrng() < bad;
    const shownBiome = wrong ? S.cfg.biomes[Math.floor(nrng() * S.cfg.biomes.length)] : seg.biome;
    const err = 1 + (nrng() - 0.5) * (wrong ? 0.3 : 0.08);
    const B = biomeOf(seg.biome);
    out.push({ kind, seg, blocked: false, truthRisk: seg.curvIdx * (1.2 - B.grip * 0.4) + B.density * 0.5, shown: { biome: shownBiome, len: Math.round(seg.len * err / 10) * 10, dubious: wrong, pois: seg.pois.length } });
  });
  return out;
}
function genObstacles(S, seg) {
  const r = Rd.rngOf(S.seed + "|obs" + seg.index + seg.kind); const B = biomeOf(seg.biome); const obs = []; let id = 0;
  const gap = 260 / (TRAFFIC_K[S.cfg.traffic] * B.density * (0.8 + S.cfg.difficulty * 0.1)); let s = 280 + r() * 100;
  const kinds = ["cone", "animal", "pieton", "rock", "oil", "pothole", "slowcar", "barrier"];
  const wt = { cone: 3, animal: seg.biome === "campagne" ? 4 : 1.2, pieton: seg.biome === "ville" ? 4 : 0.6, rock: seg.biome === "montagne" || seg.biome === "etroit" ? 3 : 0.5, oil: seg.biome === "industrie" || seg.biome === "pluie" ? 3 : 0.6, pothole: 2, slowcar: seg.biome === "ville" || seg.biome === "chantier" ? 3 : 1, barrier: seg.biome === "chantier" ? 4 : 0.2 };
  while (s < seg.len - STOP_ZONE - 60) {
    const k = pickW(r, kinds, (q) => wt[q]); const lane = (r() < 0.5 ? -1 : 1) * (0.1 + r() * 0.7);
    const o = { id: ++id, kind: k, s: Math.round(s), x: +lane.toFixed(2), gone: false, scared: 0 };
    o.w = { cone: 0.1, animal: 0.22, pieton: 0.1, rock: 0.3, oil: 0.4, pothole: 0.2, slowcar: 0.3, barrier: 0.5 }[k];
    if (k === "slowcar") o.v = 7 + r() * 3;
    if (k === "barrier") o.x = lane > 0 ? 0.55 : -0.55;
    if (k === "animal" || k === "pieton") o.kindName = k === "animal" ? ["vache", "mouton", "oie", "lama", "chèvre"][Math.floor(r() * 5)] : ["piéton à la baguette géante", "cycliste en retard", "facteur pressé"][Math.floor(r() * 3)];
    obs.push(o); s += gap * (0.7 + r() * 0.7);
  }
  return obs;
}

function openStop(S, first) {
  S.phase = "stop"; S.stopT = 0; S.ready = false; S.bus.v = 0; S.bus.thr = 0; S.bus.brk = 1; S.job = null;
  S.options = makeOptions(S, S.si + 1); S.chosen = null; S.inc.forEach((i) => { if (i.def.stopClear) closeInc(S, i, "stop"); });
  if (!first) {
    S.stats.stops++; S.stopsDone++;
    exchangePax(S);
    const itemP = 0.35 * OBJ_K[S.cfg.objects] * S.M.items;
    if (S.rng() < itemP) giveItem(S, pickItem(S));
  }
  S.stopOffer = { fuelPrice: PRICES.fuel };
  const last = S.si >= S.nSeg - 1;
  addLog(S, "stop", "🚏", first ? "Départ de " + Rd.stopName(S.seed, 0) + ". Choisissez la première route avant de partir." : (last ? "Terminus atteint." : "Arrêt à " + Rd.stopName(S.seed, S.si + 1) + ". Choisissez la prochaine route, faites vos courses, puis repartez."));
  if (!first && !last) maybeStopIncident(S);
}

function exchangePax(S) {
  const r = Rd.rngOf(S.seed + "|exch" + S.si); const going = [];
  S.pax.forEach((p) => { if (!p.vip && !p.parcel && r() < 0.28) going.push(p); });
  const names = [];
  going.forEach((p) => {
    const tip = Math.round(p.mood / 12); S.inv.money += tip; S.stats.delivered++; S.stats.deliveredMood += p.mood; names.push(p.name);
    S.pax.splice(S.pax.indexOf(p), 1);
  });
  const want = S.cfg.passengers - S.pax.length; const arch = D.ARCHETYPES.map((a) => a.id);
  for (let i = 0; i < want; i++) { const q = addPax(S, arch[Math.floor(r() * arch.length)], r); q.mood = Math.max(q.mood, 50); }
  if (going.length) addLog(S, "pax", "👥", going.length + " passager" + (going.length > 1 ? "s descendent" : " descend") + " et " + want + " nouveau" + (want > 1 ? "x montent" : " monte") + ".");
}

function chooseRoute(S, kind) {
  if (S.phase !== "stop" || S.si >= S.nSeg - 1) return { ok: false, err: "Pas de route à choisir maintenant." };
  const o = S.options && S.options.filter((x) => x.kind === kind)[0]; if (!o) return { ok: false, err: "Route inconnue." };
  if (o.blocked) return { ok: false, err: "Cette route est barrée." };
  S.chosen = kind; return { ok: true };
}

function depart(S) {
  if (S.phase !== "stop") return { ok: false, err: "Le bus roule déjà." };
  if (S.si >= S.nSeg - 1) return { ok: false, err: "Terminus." };
  if (!S.chosen) { const ok = S.options.filter((o) => !o.blocked); S.chosen = (ok.filter((o) => o.kind === "sure")[0] || ok[0]).kind; addLog(S, "info", "🧭", "Aucun choix du navigateur, la route sûre est prise par défaut."); }
  if (S.hp.engine <= 0 || S.stalled) return { ok: false, err: "Le moteur ne démarre pas, il faut le réparer." };
  const opt = S.options.filter((o) => o.kind === S.chosen)[0];
  S.si++; S.seg = opt.seg; S.biome = biomeOf(opt.seg.biome); S.obs = genObstacles(S, S.seg);
  S.bus.s = 0; S.bus.x = 0; S.bus.vx = 0; S.bus.v = 0; S.bus.brk = 0; S.phase = "drive";
  S.plannedCum += S.seg.len / (S.biome.speed * 0.85) + 20; S.segStartT = S.t; S.segHits = 0; S.shortcut = 0;
  S.inc.forEach((i) => { if (i.def.stopClear) closeInc(S, i, "stop"); });
  addLog(S, "route", S.biome.icon, "En route pour l'étape " + (S.si + 1) + " sur " + S.nSeg + ". " + S.biome.label + " au programme.");
  return { ok: true };
}

// ---------- étape physique ----------
function sysLevel(hp) { return hp >= 60 ? "ok" : hp >= 30 ? "warn" : "crit"; }
function stepDrive(S, dt) {
  const b = S.bus, B = S.biome, seg = S.seg; const prevV = b.v; const prevS = b.s;
  const elec = S.hp.electric > 0;
  let engF = S.hp.engine <= 0 ? 0 : 0.3 + 0.7 * (S.hp.engine / 100);
  if (S.temp > 110) engF *= clamp(1 - (S.temp - 110) / 30, 0.2, 1);
  if (S.stalled) engF = 0;
  const thr = S.fuel > 0 ? b.thr : 0;
  const slope = Rd.hillAt(seg, b.s);
  const tireF = 0.45 + 0.55 * (S.hp.tires / 100);
  const grip = B.grip * tireF * (S.slip > 0 ? 0.5 : 1);
  let acc = thr * 6.2 * engF - 0.0042 * b.v * b.v - (b.v > 0.1 ? 0.15 : 0) - 9.8 * 0.7 * slope;
  const brakeEff = 0.3 + 0.7 * (S.hp.brakes / 100);
  const brk = S.em > 0 ? 1 : b.brk;
  let decel = brk * 11 * brakeEff * Math.min(1, grip + 0.25);
  acc -= decel;
  const off = Math.abs(b.x) > 1; if (off) acc -= 3.2;
  b.v = clamp(b.v + acc * dt, 0, 36); if (b.v < 0.02 && thr < 0.05) b.v = 0;
  b.s += b.v * dt;
  // latéral
  const curve = Rd.curveAt(seg, b.s);
  const auth = 1.25 * grip * (1 - clamp(b.v / 45, 0, 0.4)) * clamp(b.v / 5, 0, 1);
  const push = -curve * b.v * b.v * 0.2;
  const steer = clamp(b.steer + S.steerBias, -1, 1);
  const target = steer * auth + push + S.windPush + S.pull * clamp(b.v / 12, 0, 1);
  b.vx += (target - b.vx) * Math.min(1, dt * 5);
  b.x += b.vx * dt;
  if (Math.abs(b.x) > 1.55) {
    const sg = Math.sign(b.x); b.x = sg * 1.3; b.vx = -sg * 0.5; const sc = clamp(b.v / 14, 0.3, 2) * S.M.dmg; hit(S, "bas-côté", 4 * sc, { mood: 3, v: 0.6, jolt: 1.2 });
  }
  if (off) { S.hp.tires = Math.max(0, S.hp.tires - 0.5 * dt * WEAR_K[S.cfg.breakdowns] * 3); S.jolt = Math.max(S.jolt, 0.4); }
  // carburant et chaleur
  const k = 1 / (RES_K[S.cfg.resources] * S.M.res);
  S.fuel = Math.max(0, S.fuel - (0.02 + 0.06 * thr) * k * dt - (S.leak ? 0.25 * dt : 0));
  const heat = 1.0 + 3.5 * thr * (engF > 0 ? 1 : 0.3); const cool = (S.temp - 30) * 0.045 * (0.2 + 0.8 * S.hp.cooling / 100) * (0.7 + b.v / 60);
  S.temp = clamp(S.temp + (heat - cool) * dt, 20, 140);
  // usure
  const wk = WEAR_K[S.cfg.breakdowns] * S.M.wear * (0.8 + S.cfg.difficulty * 0.1);
  if (wk > 0) {
    S.hp.engine = Math.max(0, S.hp.engine - 0.02 * wk * (0.3 + thr) * dt * 2); S.hp.cooling = Math.max(0, S.hp.cooling - 0.015 * wk * dt);
    S.hp.tires = Math.max(0, S.hp.tires - 0.02 * wk * (b.v / 20) * dt); S.hp.brakes = Math.max(0, S.hp.brakes - 0.035 * wk * brk * (b.v / 15) * dt * 4);
    S.hp.electric = Math.max(0, S.hp.electric - 0.01 * wk * dt);
  }
  if (S.temp > 120) S.hp.engine = Math.max(0, S.hp.engine - 2.5 * dt);
  if (S.temp >= 135 && !S.stalled) { S.stalled = true; addLog(S, "fail", "🥵", "Le moteur cale net, il fait beaucoup trop chaud."); }
  if (S.stalled && S.temp < 100) { S.stalled = false; addLog(S, "good", "🆗", "Le moteur a refroidi, il redémarre."); }
  // chaleur : le décélération brusque
  const dec = (prevV - b.v) / dt; if (dec > 7 && prevV > 6) { moodAll(S, -(dec - 7) * 0.4 * dt); S.jolt = Math.max(S.jolt, 0.3); if (dec > 9 && !S._hardT) { S.stats.hardBrakes++; S._hardT = 3; wakeSleepers(S, "Le freinage brusque réveille les dormeurs."); } }
  if (S._hardT > 0) S._hardT -= dt;
  // obstacles
  const front = b.s + 2.5; const hitsBefore = S.stats.hits;
  S.obs.forEach((o) => {
    if (o.gone) return;
    if (o.kind === "slowcar") o.s += o.v * dt;
    if (o.scared > 0) { o.scared -= dt; o.x += Math.sign(o.x || 1) * 1.4 * dt; if (Math.abs(o.x) > 1.5) o.gone = true; }
    const sweep = Math.abs(front - o.s) < b.v * dt + 1.6 || (o.kind === "slowcar" && o.s - front < 3 && o.s - front > -3);
    if (!sweep || o.scared > 0) return;
    if (Math.abs(b.x - o.x) >= 0.25 + o.w) return;
    collide(S, o);
  });
  if (S.dodge && S.t > S.dodge.until) { if (S.dodge.danger && S.stats.hits === S.dodge.hits0) { S.stats.justesse++; addLog(S, "good", "😎", "Manœuvre spectaculaire réussie, l'obstacle a été évité d'un cheveu."); } S.dodge = null; }
  // arrivée
  if (b.s >= seg.len - STOP_ZONE && b.v < 1.2) arrive(S, false);
  else if (b.s >= seg.len + 40) { addLog(S, "bad", "🛑", "L'arrêt est dépassé, freinage d'urgence et voyageurs secoués."); moodAll(S, -8); hit(S, "freinage d'arrêt raté", 3, {}); S.stats.complaints++; b.v = 0; arrive(S, true); }
  // pause photo
  if (b.v < 1 && S.phase === "drive") { S.standT = (S.standT || 0) + dt; if (S.standT > 3) { S.pax.forEach((p) => { if (p.req && (p.req.type === "photo" || p.req.type === "pause")) { satisfyReq(S, p, 12); addLog(S, "good", "📸", p.name + " profite de l'arrêt improvisé.", { pid: p.id }); } }); } } else S.standT = 0;
}

function hit(S, what, dmg, o) {
  o = o || {}; if (dmg > 0) { S.hp.body = Math.max(0, S.hp.body - dmg); S.stats.hits++; S.segHits = (S.segHits || 0) + 1; }
  if (o.mood) moodAll(S, -o.mood); if (o.v) S.bus.v *= o.v; if (o.jolt) S.jolt = Math.max(S.jolt, o.jolt);
  if (dmg > 0) { addLog(S, "bad", "💥", "Choc sur " + what + ", la carrosserie perd " + Math.round(dmg) + " points."); fireOn(S, "hit", { what, dmg }); }
}
function collide(S, o) {
  const b = S.bus; const sc = clamp(b.v / 15, 0.3, 2.2) * S.M.dmg; const dv = o.kind === "slowcar" ? Math.max(0, b.v - o.v) : b.v;
  if (o.kind === "slowcar" && dv < 1.5) { b.v = Math.min(b.v, o.v); return; }
  switch (o.kind) {
    case "cone": hit(S, "un cône", 1 * sc, { jolt: 0.4 }); o.gone = true; break;
    case "animal": hit(S, "un animal (" + o.kindName + ", indemne et vexé)", 5 * sc, { mood: 6, v: 0.7, jolt: 1 }); o.gone = true; break;
    case "pieton": hit(S, "un piéton (" + o.kindName + ", qui rebondit dans un buisson, sain et sauf)", 2 * sc, { mood: 12, v: 0.7 }); S.inv.money = Math.max(0, S.inv.money - 20); S.stats.fines++; S.stats.complaints++; o.gone = true; break;
    case "rock": hit(S, "un rocher", 12 * sc, { mood: 5, v: 0.5, jolt: 1.5 }); S.hp.tires = Math.max(0, S.hp.tires - 10 * sc); o.gone = true; fireOn(S, "rock", {}); break;
    case "oil": S.slip = 6; addLog(S, "bad", "🛢️", "Flaque d'huile, le bus glisse pendant quelques secondes."); o.gone = true; break;
    case "pothole": S.hp.tires = Math.max(0, S.hp.tires - 6 * sc); S.jolt = Math.max(S.jolt, 1); moodAll(S, -2); wakeSleepers(S, "Le nid de poule réveille les dormeurs."); o.gone = true; break;
    case "slowcar": hit(S, "un véhicule lent", 0.8 * dv * S.M.dmg, { mood: 3, v: 0.8 }); b.v = Math.min(b.v, o.v); break;
    case "barrier": hit(S, "une barrière de chantier", 8 * sc, { mood: 4, v: 0.55, jolt: 1.2 }); o.gone = true; break;
  }
}
function wakeSleepers(S, msg) { let n = 0; S.pax.forEach((p) => { if (p.arch === "dormeur" && p.state === "dort") { p.state = "normal"; p.mood = clamp(p.mood - 6, 0, 100); n++; } }); if (n && msg) addLog(S, "pax", "😴", msg); }

function arrive(S, forced) {
  const last = S.si >= S.nSeg - 1;
  const delay = S.t - S.plannedCum; S.delayNow = delay;
  if (S.bonus && S.bonus.seg === S.si) { if (delay <= 0) { S.inv.money += S.bonus.amount; addLog(S, "good", "💰", "Prime de ponctualité de " + S.bonus.amount + " encaissée."); } else { S.inv.money = Math.max(0, S.inv.money - 40); addLog(S, "bad", "💸", "Arrivée en retard, la prime est perdue et 40 de pénalité s'ajoutent."); } S.bonus = null; }
  if (S.seg.pois.length && S.cfg.mode === "tourisme") { moodAll(S, 4); }
  if (S.seg.pois.length) { const nm = S.seg.pois[0].name; addLog(S, "pax", "🌄", "Les passagers ont admiré " + nm + "."); moodAll(S, 3, (p) => p.arch === "touriste" || p.arch === "influenceur" || p.arch === "retraite"); }
  S.inc.forEach((i) => { if (i.def.stopClear) closeInc(S, i, "stop"); });
  if (last) { finish(S, "win"); return; }
  openStop(S, false);
}

// ---------- incidents (voir bb-events.js) ----------
let Ev = null;
function fireOn(S, type, ev) { if (!Ev) Ev = require("./bb-events.js"); Ev.notify(S, type, ev); }
function closeInc(S, inc, why) { if (!Ev) Ev = require("./bb-events.js"); Ev.close(S, inc, why); }
function maybeStopIncident(S) { if (!Ev) Ev = require("./bb-events.js"); Ev.stopIncident(S); }

// ---------- vie à bord ----------
function stepCabin(S, dt) {
  const M = S.M; const dk = DEMAND_K[S.cfg.demand]; const moving = S.phase === "drive";
  S.noise = Math.max(0, S.noise - 0.35 * dt);
  if (S.stuckHorn) addNoise(S, 0.9 * dt);
  if (S.song > 0) { S.song -= dt; addNoise(S, 0.5 * dt); }
  S.jolt = Math.max(0, S.jolt - 1.2 * dt);
  const sway = moving ? Math.max(0, Math.abs(S.bus.vx) - 0.9) : 0;
  S.pax.forEach((p) => {
    const A = D.ARCH_BY_ID[p.arch];
    if (p.invincible > 0) { p.invincible -= dt; if (p.invincible <= 0) { p.mood = clamp(p.mood - 10, 0, 100); addLog(S, "pax", "🦺", p.name + " redescend de son nuage, le gilet magique n'a plus d'effet."); } }
    if (p.state === "dort" && S.noise > 0.8) { p.state = "normal"; p.mood -= 4; }
    if (p.arch === "dormeur" && p.state === "normal" && !p.req && S.noise < 0.2 && S.jolt < 0.2 && S.rng() < 0.01 * dt * 20) p.state = "dort";
    const sleeping = p.state === "dort";
    let drain = 0.03 * A.drain * p.tol * dk * M.mood * (sleeping ? 0.4 : 1);
    if (S.noise > 0.4) drain += S.noise * A.noise * 0.12 * (sleeping ? 2 : 1);
    if (S.jolt > 0.1) drain += S.jolt * 0.35;
    drain += sway * 0.5; if (moving && Math.abs(S.bus.x) > 1) drain += 0.8;
    if (p.state === "malaise") drain += 0.25; if (p.state === "colere") drain += 0.8;
    if (p.req) { p.req.age += dt; p.req.ttl -= dt; drain += 0.12 * dk; if (p.req.ttl <= 0) { const rq = p.req; p.req = null; p.reqCd = 30; p.mood -= 8; S.stats.complaints += A.id === "plaignant" ? 1 : 0; addLog(S, "pax", "😠", p.name + " perd patience, sa demande est restée sans réponse.", { pid: p.id }); if (p.arch !== "plaignant" && p.mood < 25 && S.rng() < 0.5) { S.stats.complaints++; addLog(S, "bad", "📝", p.name + " dépose une réclamation."); } } }
    else { p.reqCd -= dt; if (p.reqCd <= 0 && p.state !== "malaise" && !sleeping) newReq(S, p); if (p.reqCd <= 0 && !p.req) p.reqCd = 10; }
    p.mood = clamp(p.mood - (p.invincible > 0 ? 0 : drain * dt), 0, 100);
    if (!["malaise", "colere", "dort"].includes(p.state)) p.state = p.mood < 18 ? "panique" : "normal";
    if (p.mood < 6) p.lowT += dt; else p.lowT = Math.max(0, p.lowT - dt);
  });
  S.satSum += avgMood(S) * dt; S.satT += dt;
}

// ---------- suivi de la mission ----------
function stepMission(S, dt) {
  // patchs provisoires
  S.patches = S.patches.filter((pt) => {
    if (S.t < pt.until) return true;
    const loss = Math.min(S.hp[pt.sys], pt.amount); S.hp[pt.sys] -= loss; if (pt.sys === "tank" && S.hp.tank < 50) { S.leak = true; }
    addLog(S, "bad", "🩹", "Le ruban lâche sur " + sysLabel(pt.sys) + ", le problème revient en partie."); return false;
  });
  if (S.hp.tank >= 50) S.leak = false;
  // objectif VIP
  S.objectives.forEach((o) => {
    if (o.id !== "vip" || o.status !== "open") return; const p = paxById(S, o.pid); if (!p) return;
    if (p.mood < 25 && !o.warned) { o.warned = true; addLog(S, "bad", "👑", "Mme la Directrice fronce les sourcils. Elle perd patience, il faut s'occuper d'elle vite."); }
    if (p.mood >= 40) o.warned = false;
    if (p.lowT > 25) { o.status = "fail"; finish(S, "fail", "objective"); }
  });
  S.pax.forEach((p) => { if (p.parcel && p.lowT > 20) { const o = S.objectives.filter((x) => x.id === "colis")[0]; if (o && o.status === "open") { o.status = "fail"; addLog(S, "bad", "📦", "Le porteur du colis a quitté le bus en claquant la porte, le colis ne sera pas livré."); S.pax.splice(S.pax.indexOf(p), 1); } } });
  // échecs
  if (S.hp.body <= 0) return finish(S, "fail", "accident");
  if (S.fuel <= 0 && S.bus.v < 0.5 && S.phase === "drive") return finish(S, "fail", "fuel");
  if (S.t > S.deadline) return finish(S, "fail", "late");
  if (S.hp.engine <= 0) { S.deadT += dt; if (S.deadT > 120) return finish(S, "fail", "unusable"); } else S.deadT = Math.max(0, S.deadT - dt * 2);
  S.delayNow = S.t - S.plannedCum;
}
const sysLabel = (id) => { const s = D.SYSTEMS.filter((x) => x.id === id)[0]; return s ? s.label.toLowerCase() : id; };

// ---------- pas de temps ----------
function step(S, dt) {
  if (S.end) return; dt = dt || DT; S.t += dt;
  for (const k in S.cd) if (S.cd[k] <= S.t) delete S.cd[k];
  if (S.phase === "drive") stepDrive(S, dt);
  else { // à l'arrêt
    S.stopT += dt; S.bus.v = 0;
    S.temp = clamp(S.temp + (1.0 - (S.temp - 30) * 0.045 * (0.2 + 0.8 * S.hp.cooling / 100) * 0.7) * dt, 20, 140);
    if (S.stalled && S.temp < 100) S.stalled = false;
    if (S.leak) S.fuel = Math.max(0, S.fuel - 0.1 * dt);
    if (S.stopT > 75 && S.si < S.nSeg - 1 && !S.job) { depart(S); }
  }
  if (S.end) return;
  stepCabin(S, dt);
  tickJob(S, dt);
  if (S.timers) S.timers = S.timers.filter((tm) => { if (S.t >= tm.at) { tm.fn(); return false; } return true; });
  if (S.fakeAlert && S.t > S.fakeAlert.until) S.fakeAlert = null;
  if (S.hornT > 0) S.hornT -= dt;
  if (S.slip > 0) S.slip -= dt; if (S.blind > 0) S.blind -= dt; if (S.fog > 0) S.fog -= dt; if (S.em > 0) S.em -= dt; if (S.flicker > 0) S.flicker -= dt; if (S.gpsT > 0) S.gpsT -= dt;
  if (!Ev) Ev = require("./bb-events.js");
  Ev.tick(S, dt);
  stepMission(S, dt);
}

// ---------- réparations ----------
function tickJob(S, dt) {
  const j = S.job; if (!j) return; j.left -= dt;
  if (j.needStop && S.bus.v > 3) { j.paused = true; return; } j.paused = false;
  if (j.left > 0) return;
  S.job = null; const R = D.REPAIRS[j.kind]; const sys = j.sys;
  if (j.kind === "refroidir") { S.temp = Math.max(30, S.temp - 45); addLog(S, "good", "💧", "Le moteur reçoit son liquide de refroidissement, la température chute."); fireOn(S, "repair", { sys: "cooling", kind: j.kind, gain: 0, cool: true }); return; }
  let gain = R.gain, note = "";
  if (j.kind === "propre") {
    const part = j.part; gain = R.gain * part.gain; note = part.id === "normale" ? "" : " (" + part.label.toLowerCase() + ")";
    if (part.hold) S.patches.push({ sys, amount: Math.round(gain * 0.8), until: S.t + part.hold });
  } else if (j.kind === "ruban") { S.patches.push({ sys, amount: Math.round(gain), until: S.t + R.patch }); S.stats.tapeUsed++; }
  const cap = sys === "body" ? 90 : 100; const before = S.hp[sys]; S.hp[sys] = clamp(S.hp[sys] + gain, 0, cap);
  addLog(S, "good", R.icon, "Réparation terminée sur " + sysLabel(sys) + note + ", de " + Math.round(before) + " à " + Math.round(S.hp[sys]) + ".");
  if (sys === "engine" && S.hp.engine > 0) S.deadT = 0;
  fireOn(S, "repair", { sys, kind: j.kind, gain });
}

// ---------- score et fin ----------
function finish(S, kind, reason) {
  if (S.end) return;
  const sat0 = S.satT > 0 ? S.satSum / S.satT : avgMood(S);
  const sat = clamp(sat0 * 0.5 + avgMood(S) * 0.5, 0, 100);
  const finalDelay = S.t - S.plannedCum; const planned = Math.max(1, S.plannedCum);
  const lateRatio = Math.max(0, finalDelay) / planned;
  S.objectives.forEach((o) => {
    if (o.status !== "open") return;
    if (kind !== "win") return;
    if (o.id === "ponctuel") o.status = lateRatio <= 0.2 ? "ok" : "fail";
    else if (o.id === "propre") o.status = S.hp.body >= 60 ? "ok" : "fail";
    else if (o.id === "colis") o.status = S.pax.some((p) => p.parcel) ? "ok" : "fail";
    else if (o.id === "vip") { const p = paxById(S, o.pid); o.status = p && p.mood >= 20 ? "ok" : "fail"; }
  });
  const objOk = S.objectives.filter((o) => o.status === "ok").length, objAll = S.objectives.length;
  const satW = S.cfg.mode === "tourisme" ? 55 : 40; const rest = 100 - satW;
  const parts = {
    satisfaction: Math.round(sat / 100 * satW),
    ponctualite: Math.round(clamp(1 - lateRatio * 1.3, 0, 1) * rest * 0.3),
    vehicule: Math.round(S.hp.body / 100 * rest * 0.25),
    objectifs: objAll ? Math.round(objOk / objAll * rest * 0.25) : Math.round(rest * 0.25 * 0.6),
    ressources: Math.round(clamp((S.fuel / 100 * 0.5 + clamp(S.inv.money / 150, 0, 1) * 0.5), 0, 1) * rest * 0.2),
  };
  let style = (S.inv.items.trophee || 0) * (S.cfg.mode === "compagnie" ? 4 : 2) + S.stats.justesse * 2;
  const trophies = computeTrophies(S);
  const total = clamp(parts.satisfaction + parts.ponctualite + parts.vehicule + parts.objectifs + parts.ressources + style - S.stats.complaints * 2, 0, 100);
  let title, text, win = kind === "win";
  if (win) {
    const honors = sat >= S.M.minSat;
    const tier = total >= 85 ? "Mission légendaire" : total >= 70 ? "Réussite brillante" : total >= 50 ? "Arrivé entier" : total >= 30 ? "Arrivé de justesse" : "Arrivé, à peine";
    title = honors ? tier : "Arrivé sans les honneurs";
    text = honors ? "Le bus est arrivé à " + Rd.stopName(S.seed, S.nSeg) + "." : "Le bus est arrivé, mais la satisfaction est restée sous le seuil de ce mode, la compagnie ne vous félicite pas.";
    S.end = { win: true, reason: "arrivee", title, text, total: Math.round(total), tier, honors };
  } else {
    const R = {
      accident: ["Accident majeur", "La carrosserie n'a pas survécu. Le bus finit sa course dans un décor qui n'était pas prévu."],
      fuel: ["Panne sèche", "Le réservoir est vide et le bus s'arrête au milieu de nulle part. Il fallait faire le plein à un arrêt."],
      late: ["Mission annulée", "Le retard est devenu trop grand, la compagnie annule la mission."],
      unusable: ["Véhicule irréparable", "Le moteur est resté trop longtemps hors service, le bus part à la casse."],
      objective: ["Objectif critique manqué", "La passagère VIP est descendue furieuse. La compagnie ne vous le pardonnera pas."],
    }[reason] || ["Fin de mission", "La mission s'arrête."];
    title = R[0]; text = R[1]; S.end = { win: false, reason, title, text, total: Math.round(total), tier: "Échec" };
  }
  Object.assign(S.end, { parts, style, satisfaction: Math.round(sat), lateRatio: +lateRatio.toFixed(2), delay: Math.round(finalDelay), body: Math.round(S.hp.body), complaints: S.stats.complaints, objectives: S.objectives.map((o) => ({ id: o.id, label: o.label, status: o.status, crit: o.crit })), trophies, stats: Object.assign({}, S.stats), time: Math.round(S.t), seed: S.seed, segments: S.si + 1, nSeg: S.nSeg });
  S.phase = "over";
  addLog(S, win ? "good" : "fail", win ? "🏁" : "💀", title + ". " + text);
}
function computeTrophies(S) {
  const out = [];
  if (S.stats.tapeUsed >= 3) out.push("ruban"); if (S.stats.slaps >= 2) out.push("baffe"); if (S.stats.horns >= 12) out.push("klaxon");
  if (S.stats.justesse >= 1) out.push("justesse"); if (S.stats.requestsDone >= 12) out.push("diplomate"); if (S.stats.radio >= 3) out.push("radio");
  if ((S.inv.items.trophee || 0) >= 1) out.push("trophee"); if (S.stats.incidents >= 15) out.push("tempete");
  return out.map((id) => D.TROPHIES.filter((t) => t.id === id)[0]).filter(Boolean);
}

module.exports = { create, step, DT, PRICES, STOP_ZONE, depart, chooseRoute, openStop, hit, addLog, addNoise, moodAll, satisfyReq, paxById, avgMood, has, useItem, giveItem, pickItem, addPax, shuffle, pickW, sysLevel, sysLabel, biomeOf, fireOn, closeInc, finish, wakeSleepers, newReq, HP_SYS, DEMAND_K, WEAR_K, TRAFFIC_K, OBJ_K, CHAOS_INT };

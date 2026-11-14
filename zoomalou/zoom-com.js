// ============================================================
// ZOOMALOU — Commentateur sportif, côté serveur
// Le serveur voit toutes les voitures. Il repère les moments forts (dépassement, duel roue contre roue, chute, envol,
// aspiration, remontée, dernière ligne droite, record, essence presque vide...) et envoie un court événement.
// Chaque navigateur choisit ensuite une phrase dans sa banque de répliques, l'affiche en sous-titre et la dit.
// Un événement important passe devant les autres, et il y a toujours un petit silence entre deux phrases.
// ============================================================
const Car = require("./public/game/car.js");

const GAP_MS = 2600; // silence minimal entre deux phrases ordinaires
const fmt = (t) => t.toFixed(2).replace(".", ",") + " s";

function reset(g) { g.com = { last: 0, lastPri: 0, cars: {}, pairs: {}, lead: null, leadAt: 0, leadSaid: null, final: false, go: false, lastRank: {}, came: {}, firstFin: false, turnMarks: {}, fuelSaid: false }; }
function nameOf(room, id) { const p = room.players.find((x) => x.id === id); return p ? p.name : "?"; }
function carOf(room, id) { const g = room.g; const P = g && g.players[id]; const c = P && Car.CARS[P.car]; return c ? c.name : ""; }

// envoie un événement si le micro est libre, ou s'il est plus important que le précédent
function say(room, k, d, pri) {
  const g = room.g; if (!g) return false; if (!g.com) reset(g); const c = g.com; const now = Date.now(); pri = pri || 1;
  const quiet = now - c.last; if (quiet < (pri >= 3 ? 900 : pri > c.lastPri ? 1500 : GAP_MS)) return false;
  c.last = now; c.lastPri = pri;
  const msg = Object.assign({ k, n: Math.floor(Math.random() * 1e6) }, d || {});
  if (msg.a && !msg.an) { msg.an = nameOf(room, msg.a); msg.ac = carOf(room, msg.a); }
  if (msg.b && !msg.bn) { msg.bn = nameOf(room, msg.b); msg.bc = carOf(room, msg.b); }
  if (typeof msg.t === "number") msg.ts = fmt(msg.t);
  g.api.emitAll(room, "z:com", msg); return true;
}

// ---------- suivi des voitures, appelé à chaque instantané ----------
// cars, liste {id, i (indice sur le circuit), a (0 sol, 1 en l'air, 2 rail), x, z, vx, vz}
function snap(room, cars, now) {
  const g = room.g; if (!g || !g.track) return; if (!g.com) reset(g); const c = g.com; const n = g.track.n; const contact = room.settings.mode === "contact";
  if (g.phase === "race" && !c.go && g.goAt && now >= g.goAt) { c.go = true; say(room, "go", {}, 3); }
  const seen = {};
  cars.forEach((o) => {
    seen[o.id] = 1; let s = c.cars[o.id]; if (!s) s = c.cars[o.id] = { i: o.i, start: now, air: 0, cdReset: 0, cdAir: 0, cdDraft: 0, draft: 0, maxI: o.i };
    // retour en arrière, la voiture vient d'être remise au point de contrôle
    if (o.i < s.i - 5 && s.i > 12 && now > s.cdReset) { s.cdReset = now + 8000; say(room, s.air > 0.6 ? "chute" : "faute", { a: o.id }, 2); s.lastReset = now; }
    // nouvel essai en mode essence, on repart de la ligne
    if (g.phase === "turns" && o.i < 8 && s.maxI > 40) { s.maxI = 0; c.turnMarks = {}; say(room, "retry", { a: o.id }, 1); }
    if (o.a === 1) { s.air += 0.04; if (s.air > 1.15 && now > s.cdAir) { s.cdAir = now + 12000; say(room, "envol", { a: o.id }, 1); } } else s.air = 0;
    s.i = o.i; s.maxI = Math.max(s.maxI, o.i); s.x = o.x; s.z = o.z; s.v = Math.hypot(o.vx || 0, o.vz || 0); s.at = now;
  });
  if (g.phase === "race") raceEvents(room, cars, now, contact);
  if (g.phase === "turns") turnEvents(room, cars, now);
}

function raceEvents(room, cars, now, contact) {
  const g = room.g, c = g.com, n = g.track.n; const run = cars.filter((o) => c.cars[o.id] && now - c.cars[o.id].start < 600000);
  if (run.length < 2) { if (run.length === 1) finalCheck(room, run, now); return; }
  // seuls se comparent les pilotes partis presque ensemble
  const st = (id) => c.cars[id];
  const sorted = run.slice().sort((a, b) => b.i - a.i);
  // tête de course
  const lead = sorted[0]; if (!c.firstFin && sorted[0].i - sorted[1].i > 1.5) { if (c.lead !== lead.id) { c.lead = lead.id; c.leadAt = now; } else if (c.leadSaid !== lead.id && now - c.leadAt > 1200 && now - g.goAt > 5000) { if (say(room, c.leadSaid ? "tete" : "tete1", { a: lead.id, b: c.leadSaid || sorted[1].id }, 2)) c.leadSaid = lead.id; } }
  // paires, dépassements et duels
  for (let p = 0; p < run.length; p++) for (let q = p + 1; q < run.length; q++) {
    const A = run[p], B = run[q]; if (Math.abs(st(A.id).start - st(B.id).start) > 2500) continue; if (A.i < 15 || B.i < 15) continue;
    const key = A.id < B.id ? A.id + "|" + B.id : B.id + "|" + A.id; const P = c.pairs[key] || (c.pairs[key] = { sg: 0, flip: 0, close: 0, cdPass: 0, cdDuel: 0 });
    const d = A.id < B.id ? A.i - B.i : B.i - A.i; const sg = d > 0.6 ? 1 : d < -0.6 ? -1 : P.sg;
    if (P.sg && sg !== P.sg && Math.abs(d) < 10) P.flip = now; P.sg = sg;
    if (P.flip && now - P.flip > 650) { P.flip = 0; if (now > P.cdPass && Math.abs(d) < 14) { P.cdPass = now + 7000; const front = sg > 0 ? (A.id < B.id ? A : B) : (A.id < B.id ? B : A); const back = front === A ? B : A; const isLead = sorted[0].id === front.id; say(room, isLead ? "doubleTete" : "double", { a: front.id, b: back.id }, isLead ? 3 : 2); if (isLead) { c.lead = front.id; c.leadSaid = front.id; c.leadAt = now; } } }
    if (Math.abs(d) <= 3) { if (!P.close) P.close = now; if (now - P.close > 3000 && now > P.cdDuel) { P.cdDuel = now + 20000; say(room, "duel", { a: A.id, b: B.id }, 2); } } else P.close = 0;
    // aspiration, en mode contact quand on colle la voiture de devant à pleine vitesse
    if (contact) { const front = d > 0 === A.id < B.id ? A : B; const back = front === A ? B : A; const gap = Math.abs(d); const sb = st(back.id); const lat = Math.hypot(front.x - back.x, front.z - back.z);
      if (gap >= 1.5 && gap <= 7 && lat < 15 && sb.v > 22 && sb.v > st(front.id).v - 1) { sb.draft += 0.04; if (sb.draft > 1.6 && now > sb.cdDraft) { sb.cdDraft = now + 16000; say(room, "aspi", { a: back.id, b: front.id }, 1); } } else sb.draft = Math.max(0, sb.draft - 0.04); }
  }
  // remontée, un pilote qui était dernier depuis un moment se retrouve dans la première moitié
  if (sorted.length >= 3) { const lastId = sorted[sorted.length - 1].id; c.lastRank[lastId] = (c.lastRank[lastId] || 0) + 0.04; const half = Math.ceil(sorted.length / 2);
    sorted.slice(0, half).forEach((o) => { if ((c.lastRank[o.id] || 0) > 4 && !c.came[o.id]) { c.came[o.id] = true; say(room, "remontee", { a: o.id }, 2); } }); }
  finalCheck(room, sorted, now);
}
function finalCheck(room, sorted, now) {
  const g = room.g, c = g.com, n = g.track.n; if (c.final || !sorted.length) return; const L = sorted[0];
  if (L.i > n * 0.9) { c.final = true; say(room, sorted.length > 1 && sorted[0].i - sorted[1].i < 12 ? "finalSerre" : "final", { a: L.id, b: sorted[1] ? sorted[1].id : null }, 2); }
}

// mode essence, un seul pilote en piste. On le compare au temps à battre à un tiers et aux deux tiers du circuit
function turnEvents(room, cars, now) {
  const g = room.g, c = g.com, t = g.turn; if (!t || !cars.length) return; const o = cars[0]; const n = g.track.n; const P = g.players[t.pid]; const rec = g.record;
  if (rec && rec.frames && rec.frames.length >= 16 && P && P.comEl != null && rec.pid !== t.pid) {
    [0.35, 0.7].forEach((fr) => { const key = fr + ":" + (t.tries || 0); if (c.turnMarks[key] || o.i < n * fr) return; c.turnMarks[key] = true;
      const f = rec.frames; const nF = f.length / 8; let k = 0; while (k < nF - 1 && f[k * 8 + 7] < o.i) k++; const recT = k / 10; const dt = P.comEl - recT;
      if (Math.abs(dt) < 0.25) say(room, "egal", { a: t.pid, b: rec.pid }, 2); else say(room, dt < 0 ? "avance" : "retard", { a: t.pid, b: rec.pid, t: Math.abs(dt) }, 2); });
  }
  if (t.role === "duel" && !c.fuelSaid && t.fuel > 4 && t.fuelLeft < t.fuel * 0.25 && t.fuelLeft > 0) { c.fuelSaid = true; say(room, "essence", { a: t.pid }, 2); }
}

// ---------- événements venus du déroulement de la partie ----------
function round(room) { const g = room.g; reset(g); const tr = g.track; say(room, "intro", { circuit: tr.name, biome: tr.biome }, 3); }
function race(room) { const g = room.g; const keep = g.com ? g.com.last : 0; reset(g); g.com.last = keep; }
function turn(room, t, rec) {
  const g = room.g; if (!g.com) reset(g); g.com.turnMarks = {}; g.com.fuelSaid = false; Object.values(g.com.cars).forEach((s) => { s.maxI = 0; s.i = 0; });
  if (t.role === "open") say(room, g.turnIdx === 0 ? "ouvre" : "pose", { a: t.pid }, 3);
  else say(room, t.last ? "dernierEssai" : "duelEssence", { a: t.pid, b: rec ? rec.pid : null, t: rec ? rec.time : undefined }, 3);
}
function finish(room, pid, time, info) {
  const g = room.g; if (!g.com) reset(g); const c = g.com;
  if (info.photo) return say(room, "photo", { a: pid, b: info.photo, t: time }, 3);
  if (!c.firstFin) { c.firstFin = true; return say(room, "premier", { a: pid, t: time }, 3); }
  if (info.best) return say(room, "meilleur", { a: pid, t: time }, 3);
  return say(room, "arrive", { a: pid, t: time }, 1);
}
function turnEnd(room, t, result, rec) {
  if (t.role === "open") { if (t.bestTime == null) return; return say(room, rec && rec.pid === t.pid ? "recordEssence" : "tempsPose", { a: t.pid, t: t.bestTime }, 3); }
  if (result === "beat") return say(room, "battu", { a: t.pid, b: rec ? rec.pid : null, t: t.bestTime }, 3);
  return say(room, result === "quit" ? "abandon" : "elimine", { a: t.pid }, 3);
}
function svOut(room, id) { say(room, "survieOut", { a: id }, 3); }
function roundEnd(room, winner) { if (winner) say(room, "victoire", { a: winner }, 3); }

module.exports = { reset, say, snap, round, race, turn, finish, turnEnd, svOut, roundEnd };

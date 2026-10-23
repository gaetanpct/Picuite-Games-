// ============================================================
// GOLFOUILLE — Cerveau des bots
// Un bot simule plusieurs coups possibles avec la vraie physique
// et choisit celui qui laisse la balle le plus près du trou.
// ============================================================
const Physics = require("./public/game/physics.js");
const Course = require("./public/game/course.js");
const Rules = require("./public/game/rules.js");

const LEVELS = {
  debutant: { id: "debutant", label: "Mou du genou", yawErr: 7, powErr: 0.18, think: [2200, 5000], dirs: 3, pick: 6, usePower: 0.35 },
  moyen: { id: "moyen", label: "Gaillard", yawErr: 3, powErr: 0.09, think: [1600, 3600], dirs: 5, pick: 3, usePower: 0.6 },
  champion: { id: "champion", label: "Champion", yawErr: 1.1, powErr: 0.04, think: [1100, 2500], dirs: 7, pick: 2, usePower: 0.85 },
  prodige: { id: "prodige", label: "Prodige", yawErr: 0.35, powErr: 0.015, think: [800, 1700], dirs: 9, pick: 1, usePower: 1 },
};
const RANGE = { driver: 62, iron: 48, wedge: 31, lob: 14, putter: 13, ricochet: 43, rocket: 105 };
const gauss = (r) => (r() + r() + r() - 1.5) * 1.6;

function normAng(a) { while (a > Math.PI) a -= 2 * Math.PI; while (a < -Math.PI) a += 2 * Math.PI; return a; }

// Renvoie { club, yaw, power } pour la balle ball.
function planShot(hole, ball, ctx, level, rng) {
  const lv = LEVELS[level] || LEVELS.moyen;
  const cup = hole.cup;
  const dx = cup.x - ball.x, dz = cup.z - ball.z; const D = Math.hypot(dx, dz);
  const toCup = Math.atan2(dx, dz);
  // point d'avancée le long du chemin pour contourner les virages
  let bestK = 0, bd = 1e9; hole.path.forEach((p, k) => { const d = Math.hypot(p.x - ball.x, p.z - ball.z); if (d < bd) { bd = d; bestK = k; } });
  const ahead = hole.path[Math.min(hole.path.length - 1, bestK + 14)];
  const toCarrot = Math.atan2(ahead.x - ball.x, ahead.z - ball.z);
  const baseYaws = [toCup];
  if (Math.abs(normAng(toCarrot - toCup)) > 0.05) baseYaws.push(toCarrot);
  const offs = lv.dirs === 3 ? [-4, 0, 4] : lv.dirs === 5 ? [-9, -4, 0, 4, 9] : lv.dirs === 7 ? [-14, -8, -4, 0, 4, 8, 14] : [-20, -14, -8, -4, 0, 4, 8, 14, 20];
  const yaws = []; baseYaws.forEach((b) => offs.forEach((o) => yaws.push(b + (o * Math.PI) / 180)));
  const clubs = ctx.clubs.filter((c) => c !== "rocket" || (D > 75 && rng() < 0.7));
  // clubs dont la portée convient le mieux
  const ranked = clubs.map((c) => ({ c, d: Math.abs(RANGE[c] - Math.min(D, RANGE[c] * 1.1)) + (RANGE[c] < D * 0.45 ? 40 : 0) })).sort((a, b) => a.d - b.d).slice(0, lv.id === "debutant" ? 2 : 3).map((x) => x.c);
  if (D < 18 && clubs.includes("putter") && !ranked.includes("putter")) ranked.push("putter");
  const cands = [];
  ranked.forEach((c) => {
    const club = Rules.CLUBS[c]; const R = RANGE[c];
    const need = Math.min(1, Math.max(0.28, Math.min(D, R) / R));
    // les bots un peu forts essaient aussi un tir plus haut ou plus bas
    const hs = !Rules.hasHeight(club) || ctx.noHeight ? [2] : lv.id === "debutant" ? [2] : lv.id === "moyen" ? [2, 3] : [2, 3, 1];
    hs.forEach((h) => {
      const loft = Rules.loftFor(c, h); const ratio = club.loft > 0 && loft > 0 ? Math.sqrt(Math.sin(2 * club.loft * Math.PI / 180) / Math.max(0.2, Math.sin(2 * loft * Math.PI / 180))) : 1;
      const nd = Math.min(1, Math.max(0.2, need * Math.min(1.7, Math.max(0.55, ratio))));
      const pows = c === "putter" || c === "lob" ? [need * 0.8, need * 0.95, need, need * 1.12, need * 1.3] : h === 2 ? [need * 0.85, need, Math.min(1, need * 1.1)] : [nd * 0.8, nd, Math.min(1, nd * 1.2)];
      pows.forEach((p) => { p = Math.min(1, Math.max(0.15, p)); yaws.forEach((yaw) => cands.push({ club: c, yaw, power: p, def: club, height: h, loft })); });
    });
  });
  const mult = ctx.turbo ? 1.5 : 1; const half = ctx.glu ? 0.5 : 1;
  const results = [];
  cands.forEach((cd) => {
    const r = Physics.simulate(hole, ball, { yaw: cd.yaw, speed: cd.def.speed * cd.power * mult * half, loft: cd.loft != null ? cd.loft : cd.def.loft, lob: !!cd.def.lob }, { t0: ctx.t0, wind: hole.wind, walls: ctx.walls, ice: ctx.ice, magnet: ctx.magnet, skip: !!cd.def.skip, maxTime: 22, cupMul: ctx.cupMul });
    let sc;
    if (r.outcome === "sunk") sc = -2000 - (r.dur);
    else {
      sc = Course.flowAt(hole, r.end.x, r.end.z);
      const sf = Physics.surfAt(hole, r.end.x, r.end.z);
      if (r.outcome === "water" || r.outcome === "lava") sc += 55; else if (r.outcome === "ob") sc += 75;
      else if (sf === Physics.S.SAND) sc += 7; else if (sf === Physics.S.MUD) sc += 9; else if (sf === Physics.S.ROUGH) sc += 3.5;
      // légère préférence pour économiser les fusées
      if (cd.club === "rocket") sc += 6;
    }
    results.push({ cd, sc });
  });
  results.sort((a, b) => a.sc - b.sc);
  const top = results.slice(0, Math.max(1, Math.min(lv.pick, results.length)));
  const chosen = top[Math.floor(rng() * top.length)] || results[0];
  if (!chosen) return { club: "putter", yaw: toCup, power: Math.min(1, D / 12) };
  let yaw = chosen.cd.yaw + (gauss(rng) * lv.yawErr * Math.PI) / 180;
  let power = Math.min(1, Math.max(0.1, chosen.cd.power * (1 + gauss(rng) * lv.powErr)));
  return { club: chosen.cd.club, yaw, power, height: chosen.cd.height != null ? chosen.cd.height : 2, expect: chosen.sc };
}

// Choix d'un pouvoir à jouer, ou null.
function choosePower(room, P, ranks, rng, level) {
  const lv = LEVELS[level] || LEVELS.moyen; if (!P.powers.length || rng() > lv.usePower) return null;
  const foes = room.players.filter((q) => q.id !== P.id && !q.finished);
  const myD = ranks.get(P.id);
  const leader = foes.slice().sort((a, b) => ranks.get(a.id) - ranks.get(b.id))[0];
  for (const id of P.powers) {
    const def = Rules.POWERS[id];
    if (def.kind === "hostile") {
      if (!leader) continue;
      // on vise celui qui menace de gagner
      const tgt = foes.filter((q) => !q.moving).sort((a, b) => ranks.get(a.id) - ranks.get(b.id))[0] || leader;
      if (ranks.get(tgt.id) < myD + 30 || rng() < 0.4) return { id, target: tgt.id };
    } else if (id === "echange") { if (leader && ranks.get(leader.id) < myD - 25) return { id }; }
    else if (id === "rembobine") { if (P.lastOutcome === "water" || P.lastOutcome === "ob" || P.lastOutcome === "lava") return { id }; }
    else if (id === "raccourci") { if (myD > 40) return { id }; }
    else if (id === "aimant") { if (myD < 26) return { id }; }
    else if (id === "turbo") { if (myD > 30) return { id }; }
    else if (id === "bulle") { return { id }; }
  }
  return null;
}

module.exports = { LEVELS, planShot, choosePower, RANGE };

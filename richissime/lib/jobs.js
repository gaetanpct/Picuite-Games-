// ============================================================
// RICHISSIME DESTINY — Offres d'emploi cohérentes avec la vie du joueur
// Les propositions tiennent compte du profil (forme, intelligence, goûts), de l'expérience,
// des anciens métiers, de l'âge, de la santé, du diplôme et surtout de la fortune.
// Un millionnaire sportif de 40 ans n'aura jamais l'offre d'un moniteur de ski à 19 000 euros.
// ============================================================
const R = require("./rules");
const C = require("./core");
const FX = require("./fx");
const { pick, POOLS } = require("./pools");

const clamp = (v, a, b) => Math.max(a, Math.min(b, v));

// Salaire minimal qu'un joueur riche accepte encore d'étudier, sauf métier de passion.
function salaryFloor(p) {
  const n = C.netWorth(p);
  if (n < 150000) return 0;
  return Math.min(60000, n * 0.035);
}

function statOf(p, key) { return key in p.traits ? p.traits[key] : p.stats[key]; }

function affinity(g, p, k, T, ctx) {
  const lou = p.cfg.loufoque;
  if (T.lunar && lou === 0) return 0;
  if (T.mature && !g.settings.mature) return 0;
  if (T.illicit && !(g.settings.mature && (p.record > 0 || p.traits.honnete < 40))) return 0;
  if (!FX.canWork(p, k)) return 0;
  if (p.job && p.job.track === k && !ctx.sameOk) return 0;
  let a = 1;
  const s = statOf(p, T.stat);
  a *= clamp(0.4 + s / 52, 0.35, 2.6);
  const exp = (p.exp && p.exp[k]) || 0;
  a *= 1 + Math.min(exp, 12) * 0.25;
  if (p.jobHistory.some((j) => j.track === k)) a *= 1.5;
  if (T.stat === "sport") {
    // un métier du corps ne se propose pas à qui n'est pas sportif, ni passé la quarantaine bien avancée, sauf s'il y a déjà travaillé
    const known = exp > 0 || p.jobHistory.some((j) => j.track === k);
    if (!known && (p.stats.sport < 48 || p.age > 45)) return 0;
    if (p.age > 38) a *= Math.max(0.15, 1 - (p.age - 38) / 14);
  }
  if (T.minStat && s < T.minStat[1]) a *= 0.2;
  if (T.danger && p.stats.sante < 40) a *= 0.2;
  if (T.lunar) a *= [0, 0.45, 1, 1.9][lou] || 1;
  if (T.passion && C.netWorth(p) >= 150000) a *= 1.4;
  if (T.minNet) a *= 2.2;
  // le métier doit pouvoir nourrir la vie qu'on mène
  const lvl = ctx.level(k);
  const start = T.levels[lvl][1];
  const floor = ctx.floor;
  if (floor && start < floor && !T.minNet) a *= T.passion ? (exp > 0 || p.jobHistory.some((j) => j.track === k) ? 0.3 : 0.07) : 0;
  // un diplômé du supérieur ne postule pas comme plongeur sauf nécessité
  if (p.school.edu >= 4 && T.levels[0][1] < 20000 && !T.passion && !T.lunar && C.netWorth(p) > 8000) a *= 0.3;
  return a;
}

function weightedSample(rng, items, weights, n) {
  const picked = [];
  const arr = items.slice(), w = weights.slice();
  while (picked.length < n && arr.length) {
    const total = w.reduce((a, b) => a + b, 0);
    if (total <= 0) break;
    let r = rng() * total, idx = w.length - 1;
    for (let i = 0; i < w.length; i++) { r -= w[i]; if (r <= 0) { idx = i; break; } }
    picked.push(arr.splice(idx, 1)[0]); w.splice(idx, 1);
  }
  return picked;
}

// Retourne jusqu'à n offres [{track, level, title, salary, boss, why}]. Il y en a toujours au moins une si le joueur peut travailler.
function offers(g, p, opts) {
  opts = opts || {};
  const rng = g.rng;
  const n = opts.n || 3;
  const bonusLevel = (opts.reseau || p.flags.bilan_competences || p.flags.piston ? 1 : 0);
  const ctxBase = {
    sameOk: !!opts.sameOk,
    floor: salaryFloor(p),
    level: (k) => {
      const T = R.TRACKS[k];
      let lv = FX.trackLevelFor(p, k);
      if (bonusLevel && lv < T.levels.length - 1 && (!T.gate || T.gate[lv + 1] <= p.school.edu)) lv++;
      return lv;
    },
  };
  const keys = Object.keys(R.TRACKS);
  let ctx = ctxBase;
  let ws = keys.map((k) => affinity(g, p, k, R.TRACKS[k], ctx));
  // sécurité : si rien ne convient (très riche sans poste adapté, très jeune...), on assouplit les filtres
  if (!ws.some((w) => w > 0)) { ctx = Object.assign({}, ctxBase, { floor: 0 }); ws = keys.map((k) => affinity(g, p, k, R.TRACKS[k], ctx)); }
  if (!ws.some((w) => w > 0)) { ctx = Object.assign({}, ctxBase, { floor: 0, sameOk: true }); ws = keys.map((k) => affinity(g, p, k, R.TRACKS[k], ctx)); }
  const chosen = weightedSample(rng, keys, ws, n);
  const out = [];
  chosen.forEach((k) => {
    const T = R.TRACKS[k];
    const level = ctx.level(k);
    const mul = 0.92 + rng() * 0.26 + (p.job ? 0.14 : 0) + (p.flags.piston ? 0.08 : 0);
    const salary = Math.round(T.levels[level][1] * mul / 100) * 100;
    const exp = (p.exp && p.exp[k]) || 0;
    const hist = p.jobHistory.some((j) => j.track === k);
    let why = "";
    if (exp > 0 || hist) why = "dans ta spécialité";
    else if (statOf(p, T.stat) >= 62) why = "qui colle à ton profil";
    else if (T.lunar) why = "pour le moins original";
    out.push({ track: k, level, title: T.levels[level][0], salary, mulReal: salary / T.levels[level][1], boss: pick(rng, POOLS.boites), why });
  });
  return out;
}

module.exports = { offers, salaryFloor, affinity };

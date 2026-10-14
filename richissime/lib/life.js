// ============================================================
// RICHISSIME DESTINY — Les choix de vie proposés chaque année
// Au lieu d'une longue liste fixe, chaque joueur reçoit quelques propositions qui changent
// d'une année à l'autre et qui collent à sa vie (âge, travail, couple, argent, forme, goûts).
// Les étapes d'un parcours (rencontre, rendez-vous, mariage, bébé, examen, candidature...)
// restent proposées tant qu'elles sont possibles, pour ne jamais se retrouver coincé.
// ============================================================
const C = require("./core");
const kit = require("./lifekit");
require("./choices");

const LIST = kit.LIST;
const byId = kit.byId;

function ev(spec, key, p, g) { const v = spec[key]; return typeof v === "function" ? v(p, g) : v; }

function isEligible(g, p, pr) {
  const inPrison = !!p.prison;
  const prisonOnly = !!(pr.need && pr.need.prison === true);
  if (inPrison !== prisonOnly && !pr.anywhere) return false;
  if (pr.tag === "mature" && !g.settings.mature) return false;
  if (pr.tag === "loufoque" && p.cfg.loufoque === 0) return false;
  if (pr.need && !C.check(p, pr.need, g)) return false;
  const cost = ev(pr, "cost", p, g) || 0;
  if (cost && p.cash < cost && pr.id !== "routine") return false;
  if (pr.fit && !(pr.fit(p, g) > 0)) return false;
  return true;
}

// Les choix de vie qui reviennent d'une année sur l'autre sont dévalués, pour que la liste tourne.
function freshness(p, g, pr) {
  let f = 1;
  const seen = p.lifeSeen[pr.id];
  if (seen !== undefined) { const gap = g.round - seen; f *= gap <= 1 ? 0.3 : gap === 2 ? 0.55 : gap === 3 ? 0.8 : 1; }
  const done = p.lifeDone[pr.id];
  if (done !== undefined) { const gap = g.round - done; f *= gap <= 1 ? 0.2 : gap <= 3 ? 0.5 : 0.85; }
  return f;
}

function chosenRecently(p, g, pr) {
  const done = p.lifeDone[pr.id];
  if (done === undefined) return false;
  const cool = pr.cool === undefined ? 2 : pr.cool;
  return g.round - done <= cool && cool > 0;
}

// Calcule la liste des choix de l'année pour un joueur (identifiants, dans l'ordre d'affichage).
function offer(g, p) {
  const n = Math.max(2, Math.min(10, Number(g.settings.lifeChoices) || 5));
  const rng = g.rng;
  const pool = LIST.filter((pr) => pr.id !== "routine" && isEligible(g, p, pr) && !chosenRecently(p, g, pr));
  const picked = [];
  const used = {};
  // 1. les étapes de parcours, toujours proposées
  const sticky = pool.filter((pr) => pr.prio > 0).sort((a, b) => (b.prio - a.prio) || ((p.lifeSeen[a.id] === undefined ? -1 : p.lifeSeen[a.id]) - (p.lifeSeen[b.id] === undefined ? -1 : p.lifeSeen[b.id])));
  const stickyMax = p.prison ? 3 : n >= 5 ? 2 : 1;
  sticky.slice(0, stickyMax).forEach((pr) => { picked.push(pr); used[pr.grp] = (used[pr.grp] || 0) + 1; });
  // 2. le reste, tiré au sort selon la cohérence avec la vie du joueur
  const cap = Math.max(1, Math.ceil(n / 2.5));
  const rest = pool.filter((pr) => !picked.includes(pr));
  const target = p.prison ? Math.min(n, 4) : n;
  let guard = 0;
  while (picked.length < target && rest.length && guard++ < 50) {
    const ws = rest.map((pr) => {
      if ((used[pr.grp] || 0) >= cap) return 0;
      const base = pr.w === undefined ? 5 : pr.w;
      const fit = pr.fit ? pr.fit(p, g) : 1;
      let lf = 1;
      if (pr.tag === "loufoque") lf = [0, 0.4, 1, 2.2][p.cfg.loufoque] || 1;
      return base * fit * lf * freshness(p, g, pr) * (0.65 + rng() * 0.7);
    });
    const total = ws.reduce((a, b) => a + b, 0);
    if (total <= 0) break;
    let r = rng() * total, idx = ws.length - 1;
    for (let i = 0; i < ws.length; i++) { r -= ws[i]; if (r <= 0) { idx = i; break; } }
    const pr = rest.splice(idx, 1)[0];
    picked.push(pr); used[pr.grp] = (used[pr.grp] || 0) + 1;
  }
  const ids = picked.map((pr) => pr.id);
  ids.forEach((id) => { p.lifeSeen[id] = g.round; });
  return ids;
}

// Description complète d'un choix pour le client
function describe(g, p, id) {
  const pr = id === "routine" ? ROUTINE : byId[id];
  if (!pr) return null;
  return { id: pr.id, l: ev(pr, "l", p, g), ic: pr.ic, d: ev(pr, "d", p, g), cost: ev(pr, "cost", p, g) || 0, step: pr.prio > 0, grp: pr.grp };
}

const ROUTINE = { id: "routine", grp: "divers", l: "Année tranquille", ic: "🌤️", d: "Tu laisses la vie venir, sans rien forcer.", need: {}, fx: {}, cost: 0 };
LIST.push(ROUTINE);
byId.routine = ROUTINE;

module.exports = { LIST, byId, offer, describe, isEligible, ROUTINE, ev };

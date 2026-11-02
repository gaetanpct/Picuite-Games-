// ============================================================
// RICHISSIME DESTINY — Les objectifs de vie
// Chaque joueur peut avoir un objectif, tiré au sort en secret ou choisi dans le salon. Il est suivi tout au long de la vie
// sous forme de pourcentage, puis dévoilé à la fin. Réussir sa vie ne veut pas toujours dire être le plus riche.
// Aucun texte ne contient de deux-points.
// ============================================================
const C = require("./core");
const R = require("./rules");

const cl = (v, a, b) => Math.max(a === undefined ? 0 : a, Math.min(b === undefined ? 1 : b, v));
const lg = (n, lo, hi) => cl((Math.log10(Math.max(1, n)) - lo) / (hi - lo));
const netOf = (p) => (p.finalWorth !== undefined ? p.finalWorth : C.netWorth(p));
const mem = (p) => p.mem || {};
const gt = (p) => { p.mem = p.mem || {}; p.mem.gt = p.mem.gt || { rep: 0, rank: 0, sal: 0, cities: [] }; return p.mem.gt; };
const led = (p, kinds, minW) => (p.ledger || []).filter((l) => (!kinds || kinds.includes(l.kind)) && l.w >= (minW || 0)).reduce((s, l) => s + l.w, 0);
const ledN = (p, minW) => (p.ledger || []).filter((l) => l.w >= (minW || 0)).length;
const closeNpcs = (p, k) => p.npcs.filter((n) => n.alive && n.kind !== "pet" && n.close >= k).length;
const FAME_TRACKS = ["sportpro", "foot", "tennis", "rugby", "boxe", "f1", "cinema", "chanteur", "dj", "humour", "danse", "mannequin", "createur", "photo", "peintre", "politique", "media", "esport", "golf_pro"];
const pct = (v) => Math.round(cl(v) * 100);

// chaque objectif donne une valeur entre 0 et 1 et une phrase qui explique le résultat
const GOALS = {
  fortune: { ic: "💰", l: "Devenir richissime", d: "Terminer ta vie avec une immense fortune, plus c'est gros mieux c'est.",
    score(p) { const n = netOf(p), pk = mem(p).peakNet || 0; return { v: lg(Math.max(n, pk * 0.6), 3.5, 7.7), line: "Patrimoine final " + C.fmt(n) + ", record à " + C.fmt(pk) }; } },
  gloire: { ic: "🌟", l: "Devenir célèbre", d: "Être connu, reconnu et suivi. Ta réputation doit monter très haut.",
    score(p) { const g = gt(p); const fameJobs = Object.keys(mem(p).tracksTried || {}).filter((t) => FAME_TRACKS.includes(t)).length;
      const v = 0.5 * cl(g.rep / 90) + 0.2 * cl(led(p, ["carriere"]) / 30) + 0.2 * cl(fameJobs / 2) + 0.1 * cl(p.stats.repute / 80);
      return { v, line: "Réputation au plus haut " + Math.round(g.rep) + " sur 100" }; } },
  carriere: { ic: "🏆", l: "Une carrière exceptionnelle", d: "Grimper au sommet d'un métier, jusqu'au poste le plus haut possible.",
    score(p) { const g = gt(p); const v = 0.55 * Math.pow(cl(g.rank), 2.6) + 0.3 * lg(g.sal, 4.8, 6.5) + 0.15 * cl((p.yearsWorked || 0) / 40);
      return { v, line: "Sommet atteint " + Math.round(cl(g.rank) * 100) + " pour cent de l'échelle de ton métier" }; } },
  famille: { ic: "👨‍👩‍👧‍👦", l: "Une grande famille unie", d: "Un couple solide, des enfants, des proches qui comptent sur toi.",
    score(p) { const m = mem(p); const kids = p.npcs.filter((n) => n.kind === "child" && n.alive);
      const fam = p.npcs.filter((n) => n.alive && ["mere", "pere", "sibling", "child", "spouse", "partner"].includes(n.kind));
      const close = fam.length ? fam.reduce((s, n) => s + n.close, 0) / fam.length / 100 : 0;
      const v = 0.3 * cl(kids.length / 3) + 0.3 * cl((m.partnerYears || 0) / 35) + 0.25 * cl(close) + 0.15 * cl(1 - (m.divorces || 0) * 0.5);
      return { v, line: kids.length + " enfant" + (kids.length > 1 ? "s" : "") + " en vie, " + (m.partnerYears || 0) + " ans en couple" }; } },
  influence: { ic: "🕴️", l: "Devenir influent", d: "Avoir un réseau, du pouvoir et le téléphone de gens importants.",
    score(p) { const s = p.pro || { net: 0, rep: 0, skill: 0 }; const rank = p.org ? p.org.rank || 0 : 0;
      const v = 0.25 * cl(s.net / 70) + 0.2 * cl(s.rep / 70) + 0.2 * cl(p.stats.repute / 85) + 0.15 * cl(closeNpcs(p, 60) / 10) + 0.1 * cl(rank / 5) + 0.1 * cl(s.skill / 80);
      return { v, line: "Réseau " + Math.round(s.net) + ", renom professionnel " + Math.round(s.rep) }; } },
  experiences: { ic: "🌍", l: "Une vie d'expériences extraordinaires", d: "Essayer des métiers, des lieux, des aventures. Une vie qui se raconte.",
    score(p) { const g = gt(p); const tried = Object.keys(mem(p).tracksTried || {}).length;
      const v = 0.25 * cl(tried / 7) + 0.2 * cl(g.cities.length / 7) + 0.25 * cl(ledN(p, 5) / 14) + 0.2 * cl((p.journal || []).length / 220) + 0.1 * cl(Object.keys(p.badges || {}).length / 8);
      return { v, line: tried + " métier" + (tried > 1 ? "s" : "") + " essayés, " + g.cities.length + " ville" + (g.cities.length > 1 ? "s" : "") + " habitées" }; } },
  chaos: { ic: "🌪️", l: "Une vie complètement chaotique", d: "Prison, ruines, divorces, renvois, rebondissements. Le plus agité gagne.",
    score(p) { const m = mem(p); const tried = Object.keys(m.tracksTried || {}).length;
      const parts = [cl((m.jailYears || 0) / 3) * 0.17, cl((m.divorces || 0) / 2) * 0.14, cl((m.fired || 0) / 3) * 0.1, (m.ruinedAt != null ? 0.14 : 0), (m.bigLossAt != null ? 0.09 : 0), cl(tried / 8) * 0.12, cl((p.record || 0) / 4) * 0.1, (p.org || (p.flags && p.flags.mafia) ? 0.08 : 0), cl(((m.peakNet || 0) - Math.max(0, netOf(p))) / Math.max(50000, m.peakNet || 1)) * 0.06];
      return { v: parts.reduce((a, b) => a + b, 0) * 1.7, line: (m.jailYears || 0) + " an" + ((m.jailYears || 0) > 1 ? "s" : "") + " de prison, " + (m.divorces || 0) + " séparation" + ((m.divorces || 0) > 1 ? "s" : "") + ", " + tried + " métiers" }; } },
  rebond: { ic: "🧗", l: "Réussir malgré un départ difficile", d: "Parti de presque rien, tu veux arriver loin. Plus le départ est dur, plus ça compte.", only: (p) => p.cfg && p.cfg.startClass === "modeste",
    score(p) { const g = gt(p); const mod = p.cfg && p.cfg.startClass === "modeste" ? 1 : p.cfg && p.cfg.startClass === "moyenne" ? 0.7 : 0.5;
      const v = (0.5 * lg(Math.max(netOf(p), (mem(p).peakNet || 0) * 0.6), 3.5, 7) + 0.3 * cl(g.rank) + 0.2 * cl(p.school.edu / 6)) * mod;
      return { v, line: "Départ " + (mod === 1 ? "modeste" : "moins difficile") + ", arrivée à " + C.fmt(netOf(p)) }; } },
  relever: { ic: "🔄", l: "Tout perdre puis tout regagner", d: "Connaître la ruine, puis finir plus riche qu'avant. Il faut vraiment tout risquer pour y arriver.", choiceOnly: true,
    score(p) { const m = mem(p); const n = netOf(p);
      if (m.ruinedAt == null && m.bigLossAt == null) return { v: 0.05 * lg(n, 3.5, 7), line: "Aucune chute, donc rien à regagner" };
      const base = m.ruinedAt != null ? 0.4 : 0.22;
      const v = base + (1 - base) * cl(n / Math.max(100000, (m.peakNet || 0) * 0.9));
      return { v, line: "Chute vers " + (m.ruinedAt != null ? m.ruinedAt : m.bigLossAt) + " ans, patrimoine final " + C.fmt(n) }; } },
  honnete: { ic: "🕊️", l: "Rester honnête toute sa vie", d: "Aucun casier, aucune magouille, la conscience tranquille.",
    score(p) { const m = mem(p); const v = 0.45 * cl(p.traits.honnete / 85) + 0.25 * ((p.record || 0) === 0 ? 1 : cl(1 - p.record / 4)) + 0.15 * ((m.jailYears || 0) === 0 ? 1 : 0) + 0.15 * (p.org ? 0 : 1);
      return { v, line: "Honnêteté " + Math.round(p.traits.honnete) + " sur 100, " + (p.record || 0) + " condamnation" + ((p.record || 0) > 1 ? "s" : "") }; } },
  bonheur: { ic: "😊", l: "Être heureux, tout simplement", d: "Peu importe l'argent, tu veux avoir été heureux presque tout le temps.",
    score(p) { const m = mem(p); const avg = m.bhN ? m.bhSum / m.bhN : p.stats.bonheur; const v = 0.7 * cl((avg - 68) / 27) + 0.15 * cl((p.stats.bonheur - 50) / 45) + 0.15 * cl(closeNpcs(p, 55) / 6);
      return { v, line: "Bonheur moyen " + Math.round(avg) + " sur 100 tout au long de la vie" }; } },
};
const IDS = Object.keys(GOALS);

function track(p) {
  const g = gt(p);
  g.rep = Math.max(g.rep, p.stats.repute);
  if (p.job) {
    const T = R.TRACKS[p.job.track];
    if (T && T.levels.length > 1 && !T.illicit) g.rank = Math.max(g.rank, p.job.level / (T.levels.length - 1));
    g.sal = Math.max(g.sal, p.job.salary || 0);
  }
  if (p.city && !g.cities.includes(p.city)) g.cities.push(p.city);
}

// tirage ou choix d'un objectif au début de la vie
function assign(g, p, wanted) {
  const mode = g.settings.goals;
  if (mode !== "secret" && mode !== "choice") { p.goal = null; return; }
  if (mode === "choice" && wanted && GOALS[wanted] && (!GOALS[wanted].only || GOALS[wanted].only(p))) { p.goal = wanted; return; }
  const pool = IDS.filter((id) => !GOALS[id].choiceOnly && (!GOALS[id].only || GOALS[id].only(p)));
  const ws = pool.map((id) => GOALS[id].weight || 1);
  let r = g.rng() * ws.reduce((a, b) => a + b, 0), idx = pool.length - 1;
  for (let i = 0; i < pool.length; i++) { r -= ws[i]; if (r <= 0) { idx = i; break; } }
  p.goal = pool[idx];
}

// ces trois objectifs ont une valeur de départ élevée dès la naissance, ils se méritent surtout avec les années
const SLOW = { honnete: 1, bonheur: 1, famille: 1 };
function progress(p) {
  if (!p.goal || !GOALS[p.goal]) return null;
  const G = GOALS[p.goal]; const s = G.score(p); const age = p.death ? p.death.age : p.age; const v = cl(s.v) * (SLOW[p.goal] ? cl((age - 10) / 45) : 1);
  return { id: p.goal, ic: G.ic, l: G.l, d: G.d, pct: pct(v), line: s.line };
}

// favorise un peu les propositions qui servent l'objectif, pour que la vie reste cohérente avec ce qu'on cherche
const BOOST = {
  fortune: { argent: 1.25, travail: 1.2, pro_patron: 1.2 }, gloire: { arts: 1.3, social: 1.2, pro_scene: 1.25, pro_sport: 1.15 }, carriere: { travail: 1.25, etudes: 1.2, pro_bureau: 1.2, pro_patron: 1.15 },
  famille: { famille: 1.35, amour: 1.3 }, influence: { social: 1.3, travail: 1.15, pro_bureau: 1.15 }, experiences: { voyage: 1.4, loisir: 1.25, sport: 1.2, lunaire: 1.2, arts: 1.1 },
  chaos: { louche: 1.5, lunaire: 1.3, casino: 1.4, prison: 1.2, pro_ombre: 1.25 }, rebond: { etudes: 1.25, travail: 1.25, ecole: 1.2 },
  relever: { casino: 1.4, argent: 1.15 }, honnete: { sante: 1.2, famille: 1.15, social: 1.1, louche: 0.4, pro_ombre: 0.4 }, bonheur: { loisir: 1.3, famille: 1.2, amour: 1.2, sante: 1.15 },
};
function boost(p, pr) {
  if (!p.goal) return 1;
  const b = BOOST[p.goal]; return (b && b[pr.grp]) || 1;
}

function summary(p) {
  const pg = progress(p);
  return pg ? { id: pg.id, ic: pg.ic, l: pg.l, pct: pg.pct, line: pg.line } : null;
}

function list() { return IDS.map((id) => ({ id, ic: GOALS[id].ic, l: GOALS[id].l, d: GOALS[id].d, only: GOALS[id].only ? "modeste" : "" })); }

module.exports = { GOALS, IDS, track, assign, progress, boost, summary, list };

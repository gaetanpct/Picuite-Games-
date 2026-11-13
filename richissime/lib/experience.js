// ============================================================
// RICHISSIME DESTINY — L'expérience change l'issue des choix répétés
// Un même choix de vie ne tourne pas pareil deux fois. Les chances dépendent
// de ce que tu sais faire (intelligence, ambition, prudence), de ce que tu as déjà
// vécu avec ce choix (leçon retenue, excès de confiance, série noire) et de ta situation.
// ============================================================
const C = require("./core");

const num = (v) => { const n = Number(v); return isFinite(n) ? n : 0; };
function ev(v, p, x, g) { try { return typeof v === "function" ? v(p, x, g) : v; } catch (e) { return 0; } }

// ton d'une issue, 1 plutôt bon, -1 plutôt mauvais, 0 neutre
function tone(o, p, x, g) {
  const fx = o.fx || {};
  const money = num(ev(fx.argent, p, x, g)) - num(ev(fx.dette, p, x, g));
  const bon = num(ev(fx.bonheur, p, x, g));
  if (fx.empire) return 1;
  if (money > 300) return 1;
  if (money < -300) return -1;
  if (bon >= 4) return 0.5;
  if (bon <= -4) return -0.5;
  return 0;
}

function hist(p, id) {
  p.mem.lifeHist = p.mem.lifeHist || {};
  return p.mem.lifeHist[id] || null;
}

// retourne des poids ajustés, ou les mêmes si le choix n'a pas de vrai risque
function tilt(g, p, pr, outs, ws, x) {
  const tones = outs.map((o) => tone(o, p, x, g));
  if (!(tones.some((t) => t > 0) && tones.some((t) => t < 0))) return { ws, tones, risky: false };
  const h = hist(p, pr.id);
  const T = p.traits, S = p.stats;
  const skill = C.clamp(0.6 * (S.intel - 50) / 100 + 0.2 * (T.ambition - 50) / 100 + 0.2 * (T.prudent - 50) / 100, -0.3, 0.35);
  const n = h ? Math.min(3, h.n) : 0;
  const lastBad = h && h.last < 0 ? Math.min(2, h.badRun || 1) : 0;
  const lastGood = h && h.last > 0 ? Math.min(2, h.goodRun || 1) : 0;
  // leçon retenue après un échec, confiance après un succès, mais la chance finit toujours par tourner
  const good = C.clamp(1 + skill + 0.08 * n + 0.12 * lastBad + 0.05 * lastGood, 0.6, 1.9);
  const bad = C.clamp(1 - skill * 0.8 - 0.05 * n + 0.1 * lastGood - 0.05 * lastBad, 0.5, 1.5);
  const out = ws.map((w, i) => w * (tones[i] > 0 ? good : tones[i] < 0 ? bad : 1));
  return { ws: out, tones, risky: true, h };
}

const PRE = {
  badThenGood: ["Cette fois, tu as retenu la leçon. ", "Tu t'y prends autrement que la dernière fois. ", "L'expérience a fini par payer. "],
  goodThenGood: ["Le succès appelle le succès. ", "Tu sais maintenant comment faire. ", "Ta réputation te précède. "],
  goodThenBad: ["Un peu trop sûr de toi, tu as baissé la garde. ", "La chance a tourné. ", "Cette fois, ça ne s'est pas passé comme avant. "],
  badThenBad: ["L'histoire se répète. ", "Tu retombes dans les mêmes pièges. ", "Insister n'a rien arrangé. "],
};

// retient l'issue, retourne un début de phrase si la répétition est notable
function record(g, p, pr, tn, info) {
  if (!info || !info.risky || !tn) return "";
  p.mem.lifeHist = p.mem.lifeHist || {};
  const h = p.mem.lifeHist[pr.id] || (p.mem.lifeHist[pr.id] = { n: 0, last: 0, goodRun: 0, badRun: 0 });
  const prev = h.last;
  h.n++; h.last = tn;
  h.goodRun = tn > 0 ? h.goodRun + 1 : 0;
  h.badRun = tn < 0 ? h.badRun + 1 : 0;
  if (h.n < 2 || !prev || tn === 0) return "";
  const key = prev < 0 ? (tn > 0 ? "badThenGood" : "badThenBad") : (tn > 0 ? "goodThenGood" : "goodThenBad");
  const L = PRE[key];
  return L[Math.floor(g.rng() * L.length)];
}

// ---------- les choix sans hasard ne se passent pas toujours pareil ----------
const GOOD = {
  sport: ["Tu progresses plus vite que prévu.", "Les efforts se voient enfin."],
  etudes: ["Tout s'imbrique, tu comprends vite cette année.", "Un professeur te remarque et te pousse."],
  ecole: ["Tout s'imbrique, tu comprends vite cette année.", "Un professeur te remarque et te pousse."],
  arts: ["Une idée t'arrive d'un coup et tu tiens quelque chose.", "Quelqu'un adore ce que tu fais."],
  social: ["Une rencontre inattendue égaie l'année.", "Les liens se resserrent plus que prévu."],
  famille: ["L'ambiance à la maison est belle cette année.", "Un moment de tendresse que tu n'oublieras pas."],
  voyage: ["Le voyage dépasse tes attentes.", "Un hasard de route devient un souvenir fort."],
  loisir: ["Tu y prends un plaisir fou.", "Les fous rires s'enchaînent."],
  sante: ["Ton corps te remercie vite.", "Tu te sens plus léger qu'il y a des années."],
  travail: ["Ton investissement est remarqué.", "On te confie un dossier qui compte."],
  emploi: ["Un contact te rend un vrai service.", "Ça démarre mieux que prévu."],
  argent: ["Les chiffres sont plus gentils que prévu.", "Une bonne surprise tombe sur ton compte."],
};
const BAD = {
  sport: ["Une petite blessure te ralentit.", "Tu stagnes, le découragement guette."],
  etudes: ["Tu te perds dans les cours, il faut rattraper.", "La fatigue s'installe."],
  ecole: ["Tu te perds dans les cours, il faut rattraper.", "Un contrôle raté te vexe."],
  arts: ["L'inspiration ne vient pas, tu doutes.", "Une critique te touche plus que tu ne le dis."],
  social: ["Un malentendu refroidit l'ambiance.", "Tu te sens un peu à l'écart."],
  famille: ["Des tensions pèsent à la maison.", "Un souci d'organisation te fatigue."],
  voyage: ["Le voyage tourne court, tout est trop cher.", "Un imprévu gâche une partie du séjour."],
  loisir: ["Ça ne prend pas, tu t'ennuies.", "Tu y laisses plus d'argent que prévu."],
  sante: ["Le résultat se fait attendre, tu doutes.", "Tu récupères mal."],
  travail: ["Un collègue te met des bâtons dans les roues.", "Le dossier traîne et l'ambiance aussi."],
  emploi: ["Les réponses tardent, le moral flanche.", "Une occasion te file sous le nez."],
  argent: ["Une dépense imprévue grignote tes projets.", "Les chiffres sont moins bons que prévu."],
};

function variance(g, p, pr, rep) {
  if (pr.id === "routine" || pr.outs && pr.outs.length || pr.scene) return;
  if (!pr.fx || !Object.keys(pr.fx).length || p.dying) return;
  const grp = pr.grp;
  const G = GOOD[grp], B = BAD[grp];
  if (!G || !B) return;
  const key = pr.interest || null;
  const rng = g.rng;
  const stat = Math.max(S_(p, "intel"), S_(p, "sport"), S_(p, "charme"));
  const luck = (stat - 50) / 400;
  const r = rng();
  const h = hist(p, "var_" + pr.id);
  p.mem.lifeHist = p.mem.lifeHist || {};
  p.mem.lifeHist["var_" + pr.id] = { n: ((h && h.n) || 0) + 1, last: 0, goodRun: 0, badRun: 0 };
  if (r < 0.2 + luck) {
    p.stats.bonheur = C.clamp(p.stats.bonheur + 2, 0, 100);
    const k = Object.keys(pr.fx).find((f) => p.stats[f] !== undefined && f !== "bonheur" && num(pr.fx[f]) > 0);
    if (k) p.stats[k] = C.clamp(p.stats[k] + 1, 0, 100);
    rep.lines.push(pr.ic + " " + G[Math.floor(rng() * G.length)]);
  } else if (r > 0.82 - luck) {
    p.stats.bonheur = C.clamp(p.stats.bonheur - 2, 0, 100);
    if (grp === "loisir" || grp === "voyage" || grp === "argent") { const m = Math.min(Math.max(0, p.cash), 200 + Math.round(Math.max(0, C.netWorth(p)) * 0.002)); p.cash -= m; }
    rep.lines.push(pr.ic + " " + B[Math.floor(rng() * B.length)]);
  }
}
const S_ = (p, k) => p.stats[k] || 50;

module.exports = { tilt, record, tone, variance };

// ---------- échos du passé ----------
const ECHO = (function () {


function memo(p) { if (!p.memo) p.memo = { peak: 0, ruin: 0, rich: 0, record: 0, last: -99, done: {} }; return p.memo; }

// met à jour les repères de vie. Appelé chaque année, même sans écho
function track(g, p) {
  const m = memo(p); const nw = C.netWorth(p);
  if (nw > m.peak) m.peak = nw;
  if (!m.rich && nw >= 1000000) m.rich = p.age;
  if (!m.ruin && m.peak >= 150000 && nw < -20000) m.ruin = p.age;
  if (p.record > m.record) { m.record = p.record; m.prison = p.age; }
}

const nm = (n) => n.name;
const first = (a) => a[Math.floor(Math.random() * a.length)];

// Chaque écho renvoie null s'il ne s'applique pas, sinon { id, line, fx, bond }
function candidates(g, p) {
  const m = memo(p); const rng = g.rng; const out = [];
  const add = (id, w, run) => { if (!m.done[id] || g.round - m.done[id] >= 8) out.push({ id, w, run }); };

  // ancien métier, une ancienne connaissance se rappelle à toi
  const old = (p.jobHistory || []).filter((j) => j.to <= p.age - 5 && j.why !== "licencié");
  if (old.length) add("ancien_job", 6, () => {
    const j = old[Math.floor(rng() * old.length)]; const t = j.title.toLowerCase();
    if (rng() < 0.6) return { line: "🕰️ Une ancienne collègue de ton époque comme " + t + " parle de toi à un contact. Ta réputation de l'époque te suit encore.", fx: { repute: 2, bonheur: 2, flag: { piston: 3 } } };
    return { line: "🕰️ Un ancien chef de ton temps comme " + t + " te rappelle pour une mission rémunérée. Tu n'avais pas oublié ses blagues.", fx: { argent: 1200 + Math.round(rng() * 4000), bonheur: 2 } };
  });

  // ami d'enfance
  const friends = p.npcs.filter((n) => (n.kind === "bestfriend" || n.kind === "friend") && n.alive && n.age >= 25);
  if (p.age >= 30 && friends.length) add("ami_enfance", 7, () => {
    const f = friends[Math.floor(rng() * friends.length)];
    if (f.close < 40) { f.close = Math.min(100, f.close + 18); return { line: "🕰️ " + nm(f) + ", un ami que tu avais perdu de vue, t'invite à dîner. Vous parlez de la cabane, des bêtises et de tout ce qui a changé.", fx: { bonheur: 5, sociable: 1 } }; }
    f.close = Math.min(100, f.close + 6);
    if (p.cash > 5000 && rng() < 0.4) { const s = Math.min(Math.round(p.cash * 0.05), 3000); return { line: "🕰️ " + nm(f) + " traverse une mauvaise passe et vient te voir. Tu lui prêtes " + C.fmt(s) + ". Il n'a rien oublié de ce que vous avez vécu.", fx: { argent: -s, bonte: 2, bonheur: 3 } }; }
    return { line: "🕰️ " + nm(f) + " débarque sans prévenir avec un gâteau raté. Vous rigolez comme à quinze ans.", fx: { bonheur: 5 } };
  });

  // rival d'autrefois
  const rivals = p.npcs.filter((n) => n.kind === "rival" && n.alive);
  if (p.age >= 28 && rivals.length) add("rival_passe", 4, () => {
    const r = rivals[Math.floor(rng() * rivals.length)];
    if (rng() < 0.5) return { line: "🕰️ " + nm(r) + ", ton vieux rival, te croise en ville et te complimente enfin. Tu ne sais pas si c'est sincère.", fx: { bonheur: 2, bonte: 1 } };
    return { line: "🕰️ " + nm(r) + " répand une vieille histoire à ton sujet. Elle est fausse, mais elle circule encore.", fx: { repute: -3, bonheur: -2 } };
  });

  // casier
  if (m.prison && p.age - m.prison >= 6) add("casier", 6, () => {
    if (p.traits.honnete >= 50 && rng() < 0.5) return { line: "🕰️ Un voisin te laisse une chance, malgré ton passé en prison. Tu essaies de ne pas le décevoir.", fx: { repute: 3, bonheur: 3, honnete: 1 } };
    return { line: "🕰️ Ton passage en prison ressurgit lors d'une vérification. Une porte se ferme poliment, une autre ne s'ouvrira pas.", fx: { repute: -4, bonheur: -3, argent: -Math.min(Math.max(0, p.cash), 1500) } };
  });

  // richesse passée puis perdue
  if (m.rich && C.netWorth(p) < m.peak * 0.3 && p.age - m.rich >= 6) add("fastes", 4, () => ({ line: "🕰️ Tu retrouves une photo de l'époque où tu étais riche. Les amis de ce temps-là ont disparu avec le champagne.", fx: { bonheur: -3, prudent: 2, sociable: 1 } }));

  // ruine passée puis rebond
  if (m.ruin && C.netWorth(p) > 150000 && p.age - m.ruin >= 6) add("rebond", 5, () => ({ line: "🕰️ Tu repenses à l'époque où tu n'avais plus rien. Cela te rend prudent, et fier de ce chemin parcouru.", fx: { bonheur: 5, prudent: 2, ambition: 1 } }));

  // enfant devenu adulte
  const kids = p.npcs.filter((n) => n.kind === "child" && n.alive && n.age >= 22);
  if (kids.length) add("enfant_adulte", 6, () => {
    const k = kids[Math.floor(rng() * kids.length)]; k.close = Math.min(100, k.close + 5);
    if (k.close < 35) return { line: "🕰️ " + nm(k) + " t'envoie un message maladroit après des années de silence. Tu réponds longuement.", fx: { bonheur: 4 } };
    if (p.cash > 8000 && rng() < 0.35) { const s = Math.min(Math.round(p.cash * 0.04), 4000); return { line: "🕰️ " + nm(k) + " a besoin d'un coup de pouce pour son premier logement. Tu aides, avec une petite larme.", fx: { argent: -s, bonheur: 4, bonte: 2 } }; }
    return { line: "🕰️ " + nm(k) + " t'invite à fêter une bonne nouvelle. Tu mesures le temps qui a passé.", fx: { bonheur: 5 } };
  });
  return out;
}

function tick(g, p, rep) {
  track(g, p);
  const m = memo(p);
  if (p.age < 28 || p.prison || p.dying || g.round - m.last < 7) return;
  const cs = candidates(g, p); if (!cs.length) return;
  if (g.rng() > 0.25) return;
  const tot = cs.reduce((a, c) => a + c.w, 0); let r = g.rng() * tot, pick = cs[cs.length - 1];
  for (const c of cs) { r -= c.w; if (r <= 0) { pick = c; break; } }
  const res = pick.run(); if (!res) return;
  m.last = g.round; m.done[pick.id] = g.round;
  require("./fx").applyFx(g, p, res.fx, null);
  rep.lines.push(res.line);
  p.journal.push({ age: p.age, text: res.line.replace("🕰️ ", ""), ic: "🕰️", tag: "souvenir" });
}



  return { tick, track, memo };
})();
module.exports.echo = ECHO;

// Onglet Professionnel. La détention en profondeur (s'en sortir par le haut ou par le bas), puis les raccourcis de carrière risqués
// pour devenir star de cinéma, de la musique ou du sport plus vite, au prix de l'argent, du risque ou de la réputation.
const K = require("../prokit");
const { P, out, chance, fail, S, sal, scale, clamp } = K;
const JU = require("../justice");
const IN = require("../interests");
const C = require("../core");

const cell = { prison: true };
const pj = (p) => JU.pris(p);
const left = (p) => (p.prison ? p.prison.left : 0);
const st = (p, k) => (k in p.stats ? p.stats[k] : p.traits[k]);
const yrs = (lo, hi) => (p, x, g) => C.rint(g ? g.rng : Math.random, lo, hi);
const dis = (p) => (p.dirty || 0);

// ================= détention, le bon chemin =================
P("pj_travail", "prison", "🧺", "Travailler pour l'établissement", "Cuisine, buanderie, atelier. Quelques euros par semaine, un dossier qui s'étoffe et des journées qui passent plus vite.",
  { need: cell, anywhere: true, cool: 1, w: 9, risk: 0,
    outs: [
      out(0.85, "Tu deviens fiable aux yeux des surveillants. Ton pécule grossit un peu, et ton dossier aussi.", { argent: 900, pris: { dossier: 5, conduct: 1 }, pro: { skill: 2 }, bonheur: 2 }, true),
      out(0.15, "Un incident à l'atelier te vaut un rapport. Tu retrouves vite la confiance du chef, mais la note reste.", { pris: { dossier: -2 }, bonheur: -1 }),
    ] });
{
  const ch = chance(0.5, "intel", { skill: 0.001 });
  P("pj_diplome", "prison", "🎓", "Passer un diplôme depuis ta cellule", "Cours par correspondance, livres de la bibliothèque et un surveillant qui t'apporte les sujets. Un papier qui compte à la sortie.",
    { need: Object.assign({ fn: (p) => !(p.school.diplomas || []).includes("licence") && !(p.school.diplomas || []).includes("master") && !(p.school.diplomas || []).includes("doctorat") }, cell), anywhere: true, cool: 3, w: 8, risk: 1,
      outs: [
        out(ch, "Tu décroches ton diplôme. Le jury ne sait pas d'où tu passes l'examen, ton CV le saura très bien.", { dipl: (p) => ((p.school.diplomas || []).includes("bac") ? "licence" : (p.school.diplomas || []).includes("bacpro") ? "bac" : "brevet"), intel: 3, pris: { dossier: 8, conduct: 1 }, pro: { skill: 6, rep: 2 }, bonheur: 5, pub: "🎓 $nom décroche un diplôme depuis sa cellule." }, true),
        out(fail(ch), "Tu rates l'examen de peu. Les révisions ne sont pas perdues, et le conseiller note ton effort.", { intel: 2, pris: { dossier: 3 }, pro: { skill: 2 }, bonheur: -1 }),
      ] });
}
{
  const ch = (p) => clamp(0.08 + pj(p).dossier / 170 + pj(p).conduct * 0.05 + pj(p).bribed * 0.07 - Math.max(0, p.record - 1) * 0.03, 0.03, 0.8);
  P("pj_conditionnelle", "prison", "🗝️", "Demander la libération conditionnelle", "Un dossier de sortie, un projet d'emploi, un logement promis et une commission qui décide. Plus ton dossier est épais, mieux ça passe.",
    { need: Object.assign({ fn: (p) => left(p) >= 2 }, cell), anywhere: true, cool: 2, w: 8, risk: 1, fit: (p) => (pj(p).dossier >= 20 ? 2.2 : 0.8),
      outs: [
        out(ch, "La commission accepte. Ta peine est réduite et tu prépares ta sortie avec un vrai projet.", { shorten: (p) => Math.max(1, Math.round(left(p) * 0.45)), pris: { dossier: 5 }, bonheur: 10, pub: "🗝️ $nom obtient une libération conditionnelle." }, true),
        out(fail(ch), "La commission refuse, jugeant ton dossier insuffisant. Elle te dit exactement ce qui manque.", { pris: { dossier: 4 }, bonheur: -4 }),
      ] });
}
{
  const ch = (p) => clamp(0.04 + st(p, "repute") / 900 + pj(p).dossier / 600, 0.02, 0.4);
  P("pj_grace", "prison", "🖋️", "Demander une grâce", "Une lettre, un bon avocat, des soutiens extérieurs et un peu de chance. Ça n'arrive presque jamais, mais ça arrive.",
    { need: Object.assign({ fn: (p) => left(p) >= 3 }, cell), anywhere: true, cool: 4, w: 3, risk: 1,
      outs: [
        out(ch, "Contre toute attente, ta demande est acceptée. Une grosse partie de ta peine s'envole.", { shorten: (p) => Math.max(2, Math.round(left(p) * 0.6)), bonheur: 14, repute: 4, pub: "🖋️ $nom est gracié(e) en partie." }, true),
        out(fail(ch), "La réponse arrive six mois plus tard, en deux lignes. Tu n'attendais pas grand-chose.", { bonheur: -3 }),
      ] });
}
{
  const ch = chance(0.4, "creatif", { skill: 0.001 });
  P("pj_livre", "prison", "📖", "Écrire un livre depuis ta cellule", "Ton histoire, ta version, tes nuits blanches. Un éditeur curieux, ou aucun.",
    { need: Object.assign({ fn: (p) => st(p, "creatif") >= 45 || st(p, "intel") >= 55 }, cell), anywhere: true, cool: 4, w: 5, risk: 1,
      outs: [
        out((p) => ch(p) * 0.4, "Le livre sort et fait du bruit. Les lecteurs te découvrent, les droits d'auteur t'attendent dehors.", { argent: 6000, repute: 6, creatif: 4, pris: { dossier: 8 }, pro: { rep: 4, net: 3 }, bonheur: 8, pub: "📖 Le livre de $nom, écrit en prison, fait parler." }, true),
        out((p) => ch(p) * 0.6, "Un petit éditeur te publie. Peu de ventes, mais un courrier de lecteurs qui te fait pleurer.", { argent: 800, creatif: 3, pris: { dossier: 4 }, bonheur: 5 }),
        out(fail(ch), "Les pages s'entassent sans trouver d'éditeur. Tu as au moins appris à écrire.", { creatif: 2, bonheur: 1 }),
      ] });
}
P("pj_famille", "prison", "📞", "Entretenir le lien avec ceux du dehors", "Lettres, appels, parloirs. Ça demande de l'énergie, et c'est ce qui sauve un couple pendant une longue peine.",
  { need: cell, anywhere: true, cool: 1, w: 9, risk: 0, fit: (p) => (p.partner ? 2 : 1),
    outs: [
      out(0.8, "Tes proches te sentent présents. Le lien tient, et la peine devient un peu plus supportable.", { pris: { lien: 3, dossier: 3 }, rel: { love: 8, mere: 5, pere: 4, bestfriend: 8 }, bonheur: 6 }, true),
      out(0.2, "La ligne est mauvaise, les parloirs trop courts. Tu raccroches avec un goût amer, mais quelqu'un a décroché.", { pris: { lien: 1 }, rel: { love: 3 }, bonheur: 1 }),
    ] });
P("pj_mediation", "prison", "🤝", "Suivre un programme de justice restaurative", "Rencontrer ceux que tu as touchés, comprendre, parfois s'excuser. Pas facile, mais le juge regarde.",
  { need: cell, anywhere: true, cool: 3, w: 5, risk: 1,
    outs: [
      out(0.7, "Le programme te remue. Tu en ressors plus honnête avec toi-même, et ton dossier le dit.", { honnete: 4, bonte: 3, pris: { dossier: 9, conduct: 1 }, shorten: (p) => (left(p) >= 4 ? 1 : 0), bonheur: 4 }, true),
      out(0.3, "Tu t'accroches mais la colère ne s'en va pas. Ton conseiller note quand même ta présence.", { pris: { dossier: 3 }, bonheur: -1 }),
    ] });
P("pj_sante", "prison", "🩺", "Prendre soin de ta santé en détention", "Sport léger, suivi médical, sommeil. Dehors tu y penses peu, ici tu n'as que ça.",
  { need: cell, anywhere: true, cool: 1, w: 6, risk: 0,
    outs: [out(0.9, "Tu retrouves un rythme. Ton corps te remercie, ton humeur aussi.", { sante: 4, bonheur: 3, sport: 2 }, true), out(0.1, "Le suivi médical est lent. Tu te débrouilles avec ce que tu as.", { sante: 1 })] });
P("pj_enseigner", "prison", "📚", "Apprendre à lire à d'autres détenus", "Deux heures par semaine avec ceux qui n'ont jamais eu leur chance. C'est utile, et on te respecte pour ça.",
  { need: cell, anywhere: true, cool: 2, w: 5, risk: 0,
    outs: [out(0.85, "Plusieurs détenus te doivent un premier livre lu. Les surveillants t'estiment, et tu te sens utile pour la première fois depuis longtemps.", { bonte: 4, pris: { dossier: 6, rep: 4, conduct: 1 }, bonheur: 5 }, true), out(0.15, "Les élèves se dissipent. Tu persistes, un seul revient, et c'est déjà beaucoup.", { bonte: 1, pris: { dossier: 2 } })] });
P("pj_boxe", "prison", "🥊", "Monter un cours de boxe dans la cour", "Un sac, des gants, un peu d'autorité. Ceux qui s'entraînent ensemble se battent moins entre eux, en théorie.",
  { need: Object.assign({ fn: (p) => st(p, "sport") >= 40 }, cell), anywhere: true, cool: 3, w: 4, risk: 1,
    outs: [out(0.75, "La cour t'adopte comme entraîneur. Tu gagnes le respect de tous sans lever la main.", { sport: 4, courage: 2, pris: { rep: 10, dossier: 3 }, bonheur: 3 }, true), out(0.25, "Un élève enthousiaste met un surveillant au tapis. Le cours est suspendu pour quelques mois.", { pris: { rep: 4, dossier: -3 } })] });

// ================= détention, l'autre chemin =================
{
  const ch = (p) => clamp(0.35 + st(p, "courage") / 300 + S(p).rep / 300 + p.record * 0.04, 0.1, 0.85);
  P("pj_clan", "prison", "🕴️", "T'allier au clan le plus puissant de la prison", "Un caïd, des gardes du corps, des affaires partout dans l'établissement. Dehors, ils ont des relations jusqu'au sommet.",
    { need: Object.assign({ fn: (p) => !pj(p).gang && !pj(p).snitch }, cell), anywhere: true, cool: 2, w: 8, risk: 3, ill: true, tag: "mature", fit: (p) => (p.org ? 3 : p.flags.milieu_contact ? 1.8 : 1),
      outs: [
        out(ch, "Le clan t'accepte. Tu as désormais de quoi te protéger, de quoi gagner de l'argent, et des amis que tu ne choisiras pas.", { pris: (p, x, g) => ({ gang: p.org ? p.org.name : JU.orgName(g), rep: 14 }), honnete: -3, courage: 2, pro: { net: 6, rep: 3, heat: 4 }, flag: "milieu_contact", bonheur: 2 }, true),
        out(fail(ch), "Le caïd te met à l'épreuve et tu la rates. Tu retournes en cellule avec un œil au beurre noir et ton orgueil en miettes.", { sante: -6, pris: { rep: -4 }, bonheur: -4 }),
      ] });
}
P("pj_grade", "prison", "📈", "Monter en grade dans ton clan", "Tu t'occupes de petits problèmes, puis de plus gros. Ton nom circule dans les couloirs.",
  { need: Object.assign({ fn: (p) => !!pj(p).gang && !pj(p).snitch }, cell), anywhere: true, cool: 2, w: 8, risk: 2, ill: true, tag: "mature",
    outs: [
      out(0.7, "Les anciens te confient les affaires importantes. Dehors, certains commencent à parler de toi avec respect.", { pris: { rep: 16 }, sale: (p) => Math.round(1500 + pj(p).rep * 90), pro: { rep: 5, net: 4, heat: 6 }, honnete: -2 }, true),
      out(0.3, "Une querelle de pouvoir tourne mal. Tu t'en sors avec une blessure et une enquête interne qui rallonge ton séjour.", { sante: -7, extend: 1, pris: { rep: 4 }, pro: { heat: 8 } }),
    ] });
{
  const ch = (p) => clamp(0.4 + pj(p).rep / 220 + (pj(p).gang ? 0.15 : 0) + pj(p).bribed * 0.06, 0.15, 0.88);
  P("pj_trafic", "prison", "📦", "Monter un trafic en détention", "Téléphones, tabac, médicaments. Tout se vend très cher derrière les murs.",
    { need: cell, anywhere: true, cool: 2, w: 7, risk: 3, ill: true, tag: "mature",
      outs: [
        out(ch, "Le commerce tourne. Tu empiles le liquide dans une planque que même les surveillants ignorent.", { sale: (p) => Math.round(4000 + pj(p).rep * 380 + (pj(p).gang ? 6000 : 0)), pris: { rep: 8 }, pro: { rep: 3, heat: 10 }, honnete: -3, bonheur: 2 }, true),
        out(fail(ch), "Une fouille met à jour ton stock. Isolement, rallonge et perte de ton réseau.", { extend: 2, pris: { rep: -10, dossier: -10 }, pro: { heat: 12 }, sante: -2, bonheur: -6 }),
      ] });
}
{
  const ch = (p) => clamp(0.45 + st(p, "courage") / 300 + pj(p).rep / 300 + (pj(p).gang ? 0.1 : 0), 0.15, 0.85);
  P("pj_racket", "prison", "💢", "Racketter les autres détenus", "Un loyer pour la douche, un loyer pour le préau. Les plus faibles paient, les plus forts regardent.",
    { need: cell, anywhere: true, cool: 2, w: 4, risk: 3, ill: true, tag: "mature",
      outs: [
        out(ch, "Tu règnes sur l'étage. Les enveloppes rentrent, et personne n'ose te regarder en face.", { sale: (p) => 2500 + Math.round(pj(p).rep * 120), pris: { rep: 12 }, honnete: -4, bonte: -4, bonheur: 1 }, true),
        out(fail(ch), "Un détenu refuse de payer et porte plainte. Tu prends un rapport et une bonne raclée.", { sante: -6, extend: 1, pris: { rep: -6, dossier: -6 }, bonheur: -4 }),
      ] });
}
{
  const ch = (p) => clamp(0.5 + st(p, "charme") / 300 + pj(p).rep / 400, 0.15, 0.85);
  P("pj_gardien", "prison", "🔑", "Corrompre un surveillant", "Un surveillant mal payé, un peu d'argent glissé avec le plateau repas. À partir de là, les règles deviennent souples.",
    { need: cell, anywhere: true, cost: 3000, cool: 2, w: 7, risk: 3, ill: true, tag: "mature",
      outs: [
        out(ch, "Le surveillant empoche et devient ton ami. Ton dossier est mieux noté, ta cellule est plus tranquille, et les portes s'ouvrent un peu plus facilement.", { pris: { bribed: 1, dossier: 6, plan: 12, conduct: 1 }, pro: { net: 3, heat: 4 }, honnete: -3 }, true),
        out(fail(ch), "Le surveillant empoche... puis te dénonce. Rallonge, isolement et plus un sou.", { extend: 1, pris: { dossier: -12, rep: -6 }, bonheur: -6, pro: { heat: 8 } }),
      ] });
}
{
  const ch = (p) => clamp(0.35 + pj(p).dossier / 220 + (pj(p).gang ? 0.08 : 0), 0.15, 0.8);
  P("pj_avocat", "prison", "👔", "Engager un avocat de renom", "Un cabinet qui coûte une fortune et qui a déjà fait sortir des gens qu'on croyait perdus.",
    { need: Object.assign({ fn: (p) => left(p) >= 3 }, cell), anywhere: true, cost: 20000, cool: 4, w: 5, risk: 2, ill: true,
      outs: [
        out(ch, "L'avocat trouve une faille de procédure et plaide avec brio. Ta peine fond.", { shorten: (p) => Math.max(1, Math.round(left(p) * 0.5)), pris: { dossier: 6 }, bonheur: 12, pub: "👔 Un grand avocat fait réduire la peine de $nom." }, true),
        out(fail(ch), "Il tient tête à la cour, mais le dossier est trop lourd. Tu as payé cher pour apprendre que tout n'a pas de solution.", { pris: { dossier: 3 }, bonheur: -5 }),
      ] });
}
P("pj_protection", "prison", "🛡️", "Acheter la protection d'un caïd", "Une redevance régulière, et personne ne t'embête. Dans certaines prisons, c'est ça ou la peur.",
  { need: Object.assign({ fn: (p) => !pj(p).gang }, cell), anywhere: true, cost: 2500, cool: 3, w: 4, risk: 2, ill: true, tag: "mature",
    outs: [out(0.85, "Le caïd te couvre. Tu dors enfin sans chercher le moindre bruit.", { pris: { rep: 8, conduct: 1 }, sante: 2, bonheur: 4, pro: { net: 2 } }, true), out(0.15, "Le caïd est arrêté la semaine suivante. Tu as payé pour rien, mais personne ne te cherche.", { bonheur: -2 })] });
{
  const ch = (p) => clamp(0.4 + st(p, "intel") / 300 + pj(p).bribed * 0.08, 0.15, 0.85);
  P("pj_plan", "prison", "🧭", "Préparer une évasion", "Repérer les tours de garde, les points faibles, les complices à l'extérieur. Ça se fait sur des mois.",
    { need: Object.assign({ fn: (p) => left(p) >= 3 }, cell), anywhere: true, cost: 1500, cool: 1, w: 6, risk: 3, ill: true, tag: "mature",
      outs: [
        out(ch, "Ton plan prend forme. Les horaires, les angles morts et les complices dehors sont maintenant sur le papier.", { pris: (p, x, g) => ({ plan: C.rint(g ? g.rng : Math.random, 18, 34) }), courage: 2, pro: { heat: 5 } }, true),
        out(fail(ch), "Un détenu bavard a tout répété. Isolement, perquisition et plan à refaire.", { pris: (p) => ({ plan: -pj(p).plan }), extend: 1, sante: -2, bonheur: -5 }),
      ] });
}
{
  const ch = (p) => clamp(0.08 + pj(p).plan / 170 + pj(p).bribed * 0.1 + (st(p, "courage") - 50) / 400, 0.05, 0.85);
  P("pj_evasion", "prison", "🏃", "Tenter l'évasion", "La nuit est noire, les complices sont en place et le surveillant a oublié sa montre. C'est maintenant.",
    { prio: 0, need: Object.assign({ fn: (p) => pj(p).plan >= 25 }, cell), anywhere: true, cool: 1, w: 12, risk: 3, ill: true, tag: "mature",
      outs: [
        out(ch, "L'évasion réussit. Tu cours dans la nuit, libre et recherché(e) par toute la région.", { escape: true, courage: 5, honnete: -3, pro: { heat: 40 }, repute: -5, bonheur: 10, pub: "🏃 $nom s'évade de prison." }, true),
        out(fail(ch), "Tu es repris(e) à quelques mètres du mur. Rallonge, isolement et un plan à reconstruire de zéro.", { extend: (p, x, g) => C.rint(g ? g.rng : Math.random, 2, 4), pris: (p) => ({ plan: -pj(p).plan, dossier: -15 }), sante: -5, bonheur: -9 }),
      ] });
}
{
  const ch = (p) => clamp(0.5 + (pj(p).gang ? 0.2 : 0) + dis(p) / 200000, 0.2, 0.85);
  P("pj_contrat", "prison", "🎯", "Régler un compte du dehors", "Un nom, une enveloppe et quelqu'un à l'extérieur qui ne pose pas de questions. Tu seras très loin de l'endroit au moment des faits.",
    { need: Object.assign({ mature: true, fn: (p) => (!!pj(p).gang || dis(p) >= 8000) && p.npcs.some((n) => n.alive && (n.kind === "rival" || n.kind === "ex")) }, cell), anywhere: true, cost: 8000, cool: 5, w: 3, risk: 3, ill: true, tag: "mature",
      outs: [
        out(ch, "L'affaire est réglée sans toi. Personne ne remonte jusqu'à ta cellule, et tout le monde, dehors comme dedans, a compris le message.", { kill: ["rival"], pris: { rep: 18 }, honnete: -8, bonte: -6, bonheur: -2, pro: { rep: 5, heat: 14 } }, true),
        out(fail(ch), "L'intermédiaire parle. Une enquête t'accuse d'être le commanditaire, et ta peine s'allonge lourdement.", { extend: 5, pris: { dossier: -25, rep: -10 }, bonheur: -12, repute: -6 }),
      ] });
}
P("pj_balance", "prison", "📣", "Dénoncer un réseau contre une remise de peine", "Les enquêteurs veulent des noms. Tu peux en donner contre un traitement de faveur. Ça se paie un jour.",
  { need: Object.assign({ fn: (p) => left(p) >= 3 && !pj(p).snitch }, cell), anywhere: true, cool: 5, w: 3, risk: 3, tag: "mature",
    outs: [
      out(0.75, "Tes déclarations font tomber un réseau. Ta peine fond, mais certaines portes se ferment pour de bon.", { shorten: (p) => Math.max(2, Math.round(left(p) * 0.55)), pris: { snitch: true, gang: null, rep: -20, dossier: 12 }, honnete: 2, repute: -3, bonheur: 4 }, true),
      out(0.25, "Les enquêteurs doutent de toi, et quelqu'un apprend que tu as parlé. Tu paies cher les deux.", { pris: { snitch: true, gang: null, rep: -20 }, sante: -10, bonheur: -8 }),
    ] });
{
  const ch = (p) => clamp(0.2 + st(p, "repute") / 250 + S(p).rep / 400, 0.1, 0.6);
  P("pj_greve", "prison", "🥣", "Faire la grève de la faim", "Un message au monde, un corps qui s'épuise. Les journaux finissent par s'en mêler, ou pas.",
    { need: Object.assign({ fn: (p) => left(p) >= 2 && st(p, "sante") >= 40 }, cell), anywhere: true, cool: 4, w: 3, risk: 2,
      outs: [
        out(ch, "Les médias relaient ton cas. L'administration cède sur plusieurs points et ta peine est un peu allégée.", { shorten: 1, pris: { dossier: 6 }, repute: 5, sante: -5, bonheur: 4, pub: "🥣 La grève de la faim de $nom fait la une." }, true),
        out(fail(ch), "Personne ne vient. Tu y laisses des forces et un peu de dignité.", { sante: -12, bonheur: -6 }),
      ] });
}
P("pj_affaires", "prison", "📱", "Faire tourner tes affaires du dehors depuis la prison", "Un téléphone, un homme de confiance, des instructions murmurées au parloir. L'organisation te rappelle que tu lui appartiens toujours.",
  { need: Object.assign({ fn: (p) => !!p.org || p.flags.mafia }, cell), anywhere: true, cool: 2, w: 7, risk: 2, ill: true, tag: "mature",
    outs: [
      out(0.7, "Tes affaires continuent de tourner. Le liquide s'accumule dehors, et la famille te remercie à sa manière.", { sale: (p) => 8000 + Math.round(Math.max(0, S(p).rep) * 600), pro: { rep: 3, net: 3, heat: 6 } }, true),
      out(0.3, "Quelqu'un en profite pour te doubler. Tu apprends vite qui compte vraiment, trop tard.", { sale: (p) => -Math.min(dis(p), 6000), pro: { heat: 4 }, bonheur: -4 }),
    ] });

// ================= raccourcis de carrière (cinéma, musique, sport) =================
const screen = (p) => IN.val(p, "screen") >= 2 || (p.job && p.job.track === "cinema") || p.flags.par_cine_1;
const music = (p) => IN.val(p, "music") >= 2 || (p.job && ["chanteur", "dj"].includes(p.job.track)) || p.flags.par_music_1;
const sportOk = (p) => st(p, "sport") >= 50 && (IN.val(p, "sport") >= 2 || (p.job && ["sportpro", "foot", "tennis", "rugby", "cyclisme", "boxe", "natation", "ski"].includes(p.job.track)) || p.flags.par_sport_1);
const young = { nostudy: true, noprison: true, ages: [16, 55] };
{
  const ch = (p) => clamp(0.22 + (st(p, "charme") - 50) / 220 + (st(p, "creatif") - 50) / 300 + S(p).net / 400, 0.08, 0.6);
  P("rc_cine_la", "scene", "🌴", "Partir à Los Angeles sans filet", "Un aller simple, un appartement partagé à trois et des castings à n'en plus finir. Si ça marche, tu gagnes des années. Sinon, tu rentres fauché(e).",
    { need: Object.assign({ fn: screen, money: [5000, null] }, young), cost: 5000, cool: 4, w: 7, risk: 3, fit: (p) => (p.job && p.job.track === "cinema" ? 1.4 : 1),
      outs: [
        out((p) => ch(p) * 0.6, "Un directeur de casting te repère dans une file d'attente. Tu décroches un rôle important, et tu t'installes là-bas.", { job: (p) => ({ track: "cinema", level: Math.max(2, p.job && p.job.track === "cinema" ? p.job.level + 1 : 2) }), flag: ["par_cine_1", "par_cine_2", "par_cine_3"], city: "Los Angeles", repute: 9, charme: 3, pro: { net: 8, rep: 5 }, bonheur: 9, pub: "🌴 $nom perce à Hollywood." }, true),
        out((p) => 0.35, "Tu enchaînes les petits rôles et quelques publicités. Pas la gloire, mais des contacts qui comptent et un bel accent.", { flag: ["par_cine_1", "par_cine_2"], argent: 3000, pro: { net: 6, skill: 3 }, bonheur: 3 }),
        out((p) => Math.max(0.1, 0.65 - ch(p) * 0.6 - 0.35), "Six mois de galère. Tu rentres fauché(e), avec des histoires à raconter mais pas de contrat.", { pro: { net: 3 }, bonheur: -6 }),
      ] });
}
{
  const ch = (p) => clamp(0.55 + (st(p, "charme") - 50) / 250, 0.25, 0.8);
  P("rc_cine_tele", "scene", "📺", "Participer à une émission de télé-réalité", "La notoriété en six semaines, au prix de ton intimité et d'une image qui colle. Les producteurs adorent les gens qui font des histoires.",
    { need: Object.assign({ fn: screen }, young), cool: 5, w: 6, risk: 2, tag: "mature",
      outs: [
        out(ch, "Tu deviens le personnage préféré du public. Les propositions arrivent, des vraies et des plus douteuses.", { flag: ["par_cine_1", "par_cine_2"], repute: 6, charme: 3, honnete: -2, argent: 12000, pro: { net: 8, rep: 2 }, bonheur: 5, pub: "📺 $nom devient une célébrité de la télé-réalité." }, true),
        out(fail(ch), "Le montage ne te rend pas service. Tout le pays se moque de toi, avec la bonne humeur de ceux qui n'ont jamais regardé leur propre vie.", { repute: -8, bonheur: -8, pro: { rep: -4 } }),
      ] });
}
{
  const ch = (p) => clamp(0.12 + (st(p, "creatif") - 50) / 250 + S(p).skill / 300, 0.05, 0.4);
  P("rc_cine_film", "scene", "🎥", "Financer toi-même ton propre film", "Tu paies l'équipe, la caméra, la location. Tu risques ton argent pour te donner un rôle et une carte de visite.",
    { need: Object.assign({ fn: screen, money: [30000, null] }, young), cost: 30000, cool: 6, w: 4, risk: 3,
      outs: [
        out(ch, "Ton film est sélectionné dans un grand festival. Les distributeurs se disputent ton nom, et la vie change d'un coup.", { job: (p) => ({ track: "cinema", level: Math.max(3, p.job && p.job.track === "cinema" ? p.job.level : 3) }), flag: ["par_cine_1", "par_cine_2", "par_cine_3"], argent: 60000, repute: 12, creatif: 4, pro: { net: 9, rep: 7 }, bonheur: 12, pub: "🎥 Le film de $nom triomphe en festival." }, true),
        out((p) => 0.4, "Le film trouve un petit public. Tu rembourses à peu près ta mise, avec des contacts utiles en prime.", { argent: 20000, repute: 3, pro: { net: 5, skill: 4 }, bonheur: 3 }),
        out((p) => Math.max(0.1, 0.6 - ch(p)), "Le film ne trouve personne. Ta caméra est amortie, pas ton compte en banque.", { repute: -2, bonheur: -7 }),
      ] });
}
P("rc_cine_buzz", "scene", "🔥", "Provoquer un scandale pour faire le buzz", "Une phrase de trop dans une émission, une soirée très arrosée, une vidéo qui fuit. Tout le monde parle de toi, de la meilleure ou de la pire manière.",
  { need: Object.assign({ fn: (p) => screen(p) || music(p) }, young), cool: 5, w: 4, risk: 3, tag: "mature",
    outs: [
      out(0.45, "Le buzz prend. Ton nom est partout et les propositions affluent, un peu plus lucratives qu'avant.", { repute: -2, pro: { net: 8, rep: 4 }, argent: 6000, charme: 2, bonheur: 4 }, true),
      out(0.55, "Le scandale tourne mal. Des partenaires coupent les ponts et tu passes pour quelqu'un de peu fréquentable.", { repute: -9, pro: { rep: -6, net: -3 }, bonheur: -7 }),
    ] });
{
  const ch = (p) => clamp(0.5 + (st(p, "creatif") - 50) / 250, 0.25, 0.8);
  P("rc_mus_streams", "scene", "📈", "Acheter des écoutes pour lancer ton morceau", "Un prestataire qui garantit un million d'écoutes. Les algorithmes font le reste, tant qu'ils ne comprennent pas.",
    { need: Object.assign({ fn: music }, young), cost: 2000, cool: 4, w: 6, risk: 3, ill: true, tag: "mature",
      outs: [
        out(ch, "Le titre décolle réellement. Des gens normaux l'écoutent, et personne ne pense à vérifier les chiffres du départ.", { flag: ["par_music_1", "par_music_2"], repute: 4, pro: { net: 7, rep: 3 }, argent: 4000, bonheur: 4 }, true),
        out(fail(ch), "La plateforme détecte la fraude. Titre supprimé, compte fermé et un article bien peu flatteur à ton sujet.", { repute: -8, pro: { rep: -5 }, bonheur: -7 }),
      ] });
}
{
  const ch = (p) => clamp(0.45 + (st(p, "creatif") - 50) / 250, 0.2, 0.75);
  P("rc_mus_label", "scene", "🖊️", "Signer avec un label qui a de drôles d'amis", "Les contrats sont avantageux et les studios magnifiques. Le patron a des relations qu'on n'aime pas détailler. Il te demandera un jour des services.",
    { need: Object.assign({ fn: music }, young), cool: 6, w: 4, risk: 3, ill: true, tag: "mature",
      outs: [
        out(ch, "Le label déroule le tapis rouge. Tu passes en radio, tu signes des dates et tu apprends à ne pas poser de questions.", { job: (p) => ({ track: p.job && p.job.track === "dj" ? "dj" : "chanteur", level: Math.max(2, p.job && ["chanteur", "dj"].includes(p.job.track) ? p.job.level : 2) }), flag: ["par_music_1", "par_music_2", "par_music_3", "milieu_contact"], sale: 25000, repute: 7, pro: { net: 9, rep: 5, heat: 8 }, honnete: -3, bonheur: 7, pub: "🖊️ $nom signe un contrat de rêve." }, true),
        out(fail(ch), "Le label s'effondre dans une affaire de fraude. Ton nom est cité dans les comptes, et tes disques ne sortiront pas.", { repute: -9, pro: { rep: -5, heat: 14 }, honnete: -2, bonheur: -8 }),
      ] });
}
P("rc_mus_viral", "scene", "📱", "Lancer un défi viral avec ton morceau", "Une chorégraphie, un refrain collant, un budget minuscule. Soit tout le monde l'imite, soit personne ne la voit.",
  { need: Object.assign({ fn: music }, young), cost: 800, cool: 3, w: 6, risk: 2,
    outs: [
      out((p) => clamp(0.18 + (st(p, "charme") - 50) / 250, 0.08, 0.4), "Le défi explose. Ton refrain se retrouve dans toutes les cours d'école, et les maisons de disques te contactent.", { flag: ["par_music_1", "par_music_2"], repute: 7, pro: { net: 9, rep: 4 }, argent: 7000, bonheur: 8, pub: "📱 Le morceau de $nom devient viral." }, true),
      out((p) => 0.82 - clamp(0.18 + (st(p, "charme") - 50) / 250, 0.08, 0.4), "Le défi passe inaperçu. Tu gardes ta dignité, c'est déjà ça.", { creatif: 2, bonheur: -1 }),
    ] });
{
  const ch = (p) => clamp(0.4 + (st(p, "sport") - 55) / 220, 0.15, 0.75);
  P("rc_sport_agent", "sport", "🧾", "Passer par un agent ambitieux et peu scrupuleux", "Il promet un contrat dans un meilleur club. Il prend sa commission, garde tes économies s'il faut, et connaît tous les recruteurs.",
    { need: Object.assign({ fn: sportOk }, young), cost: 3000, cool: 4, w: 8, risk: 3, ill: true,
      outs: [
        out(ch, "L'agent décroche un transfert que tu n'espérais pas. Ton niveau de vie change, ton niveau de jeu aussi.", { job: (p) => ({ track: p.job && ["sportpro", "foot", "tennis", "rugby", "cyclisme", "boxe", "natation", "ski"].includes(p.job.track) ? p.job.track : "sportpro", level: Math.min(4, (p.job && ["sportpro", "foot", "tennis", "rugby", "cyclisme", "boxe", "natation", "ski"].includes(p.job.track) ? p.job.level : 0) + 1) }), flag: ["par_sport_1", "par_sport_2", "par_sport_3"], repute: 6, argent: 12000, pro: { net: 8, rep: 4 }, bonheur: 8, pub: "🧾 $nom signe un transfert surprise." }, true),
        out(fail(ch), "L'agent encaisse sa commission puis disparaît. Les clubs savent maintenant que tu t'es fait avoir.", { repute: -3, pro: { rep: -3 }, bonheur: -7 }),
      ] });
}
{
  const ch = (p) => clamp(0.5 + (st(p, "sport") - 55) / 250 + (st(p, "sante") - 60) / 400, 0.2, 0.8);
  P("rc_sport_camp", "sport", "🏔️", "Partir en camp d'entraînement de haut niveau", "Trois mois dans un centre réputé, avec les meilleurs préparateurs, loin de tout. Ça coûte cher et ça fait mal.",
    { need: Object.assign({ fn: sportOk, money: [8000, null] }, young), cost: 8000, cool: 3, w: 7, risk: 2,
      outs: [
        out(ch, "Tu reviens transformé(e). Ton niveau saute une marche, et les recruteurs commencent à te regarder.", { sport: 8, sante: 2, courage: 3, flag: ["par_sport_1", "par_sport_2"], repute: 4, pro: { skill: 6, net: 4 }, bonheur: 5 }, true),
        out(fail(ch), "Une blessure te ralentit et gâche le séjour. Tu progresses moins que prévu.", { sport: 3, sante: -8, bonheur: -5 }),
      ] });
}
{
  const ch = (p) => clamp(0.5 + S(p).net / 300 + (st(p, "intel") - 50) / 300 - S(p).heat / 200, 0.2, 0.8);
  P("rc_sport_truque", "sport", "🎲", "Truquer un match contre de l'argent", "Un coup de téléphone, une erreur bien placée, des mises sur un résultat. Ça rapporte beaucoup, et ça se paie cher en cas de problème.",
    { need: Object.assign({ fn: (p) => sportOk(p) && p.job && !p.job.illicit && p.job.level >= 1, mature: true }, young), cool: 5, w: 4, risk: 3, ill: true, tag: "mature",
      outs: [
        out(ch, "Le match est joué comme prévu. Tu touches une enveloppe qui vaut une saison de salaire et personne ne regarde de trop près.", { sale: (p) => (p.job ? p.job.salary : 20000), pro: { heat: 16, net: 4 }, honnete: -6, bonheur: 1 }, true),
        out(fail(ch), "Une enquête de la fédération met la main sur des échanges de messages. Tu es suspendu(e) à vie, et la justice veut s'en mêler.", { fire: true, prison: yrs(1, 2), flag: "ancienne_gloire", repute: -22, pro: { rep: -8, heat: 20 }, bonheur: -14, pub: "🎲 $nom suspendu(e) pour match truqué." }, true),
      ] });
}

// ============================================================
// Vocabulaire par métier (ce qui suit adapte les options déjà déclarées)
// ============================================================
{
// Les options de l'onglet Professionnel parlent la langue du métier exercé.
// Un chanteur ne reçoit plus des conseils de footballeur, un peintre ne passe plus de casting, un plombier ne vise plus une étoile au guide.
// Les textes deviennent des fonctions du joueur. Sans variante pour un métier, le texte d'origine reste.
const { byId } = require("../lifekit");

const subOf = (map) => (p) => {
  const t = p.job && p.job.track;
  for (const k of Object.keys(map)) if (map[k].includes(t)) return k;
  return null;
};

// ---------- création et scène ----------
const SCENE = subOf({
  MUS: ["chanteur", "dj"],
  ECR: ["cinema", "humour", "mannequin", "cabaret", "adulte", "medium_tele", "voyante"],
  VIS: ["arts", "peintre", "photo", "mode", "danse", "cirque", "sculpteur_beurre"],
  WEB: ["createur", "media", "gamedev", "paparazzi", "critique_gastro"],
});
// ---------- sport et aventure ----------
const SPORT = subOf({
  TEAM: ["foot", "rugby"],
  SOLO: ["sportpro", "tennis", "boxe", "natation", "ski", "cyclisme", "f1", "golf_pro", "testeur_toboggans"],
  ESP: ["esport"],
  COACH: ["coach"],
  ADV: ["explorateur", "astronaute"],
});
// ---------- métiers manuels ----------
const FOOD = ["resto", "patisserie", "chocolatier", "sommelier", "boulanger", "boucher", "fromager", "brasseur", "fleuriste", "hotel", "agri", "maraicher", "apiculteur", "coiffeur", "artisan", "paysagiste", "menuisier", "bijoutier", "couturier", "tatoueur", "libraire"];
const RISK = ["btp", "agri", "marin", "transport", "pompier", "militaire", "artisan", "plombier", "electricien", "pecheur", "installateur_solaire", "mecano", "maraicher", "chauffeur_bus"];
const EXAM = ["ordre", "pompier", "militaire", "transport", "facteur", "chauffeur_bus", "hotesse_air", "animateur", "aide_domicile"];
const NOSHOP = ["ordre", "pompier", "militaire", "chauffeur_bus", "facteur", "marin", "hotesse_air", "animateur", "aide_domicile", "guide_tourisme", "crieur_public", "casino", "nuit", "testeur_matelas"];

function edit(id, f) { const pr = byId[id]; if (pr) f(pr); else throw new Error("option inconnue " + id); }
// ne propose l'option qu'à certains métiers
function onlyFor(id, list) { edit(id, (pr) => { const old = pr.fit; pr.fit = (p, g) => (p.job && list.includes(p.job.track) ? (old ? old(p, g) : 1) : 0); }); }
function notFor(id, list) { edit(id, (pr) => { const old = pr.fit; pr.fit = (p, g) => (p.job && list.includes(p.job.track) ? 0 : (old ? old(p, g) : 1)); }); }
// titre, description et issues selon le métier. V = { CLE: [titre, description, [texte issue 1, texte issue 2, ...]] }
function words(id, sub, V) {
  edit(id, (pr) => {
    const l0 = pr.l, d0 = pr.d;
    pr.l = (p) => { const v = V[sub(p)]; return v && v[0] ? v[0] : l0; };
    pr.d = (p) => { const v = V[sub(p)]; return v && v[1] ? v[1] : d0; };
    (pr.outs || []).forEach((o, i) => {
      const t0 = o.t;
      o.t = (p) => { const v = V[sub(p)]; return v && v[2] && v[2][i] ? v[2][i] : t0; };
    });
  });
}

// ===== scène =====
words("s_casting", SCENE, {
  MUS: ["Enchaîner les auditions et les scènes ouvertes", "Des fonds de bar, des plateaux de télé et la phrase « on vous rappellera ». Il faut passer partout pour être entendu.",
    ["Un producteur te choisit pour sa prochaine production. Ton nom apparaît sur les affiches et les propositions suivantes arrivent toutes seules.", "Tu décroches une première partie. Ce n'est pas la gloire, mais ton nom est sur le programme.", "Les refus s'enchaînent. Tu apprends à encaisser, à sourire, et à porter ton instrument dans le métro."]],
  ECR: null,
  VIS: ["Présenter ton travail aux galeries et aux appels à projets", "Un dossier sous le bras, des portfolios qui s'empilent et des réponses qui tardent. Il faut frapper à beaucoup de portes.",
    ["Une galerie importante t'ouvre ses murs. Ton nom est sur le carton d'invitation et les propositions suivantes arrivent toutes seules.", "Une exposition collective te prend. Ce n'est pas la gloire, mais ton nom est dans le catalogue.", "Les refus s'enchaînent. Tu apprends à encaisser, à sourire, et à porter ton carton à dessin dans le métro."]],
  WEB: ["Décrocher des partenariats et des collaborations", "Des messages à des marques, des propositions de contenus et la phrase « on revient vers vous ». Il faut démarcher pour exister.",
    ["Une grande marque te confie sa campagne. Ton nom est partout et les propositions suivantes arrivent toutes seules.", "Un petit partenariat te tombe dessus. Ce n'est pas la gloire, mais ton nom est dans la description.", "Les refus s'enchaînent. Tu apprends à encaisser, à sourire, et à relancer sans insister."]],
});
words("s_tournee", SCENE, {
  MUS: ["Partir en tournée", "Des villes que tu ne connaissais pas, des salles de taille variable, un camion de matériel et des hôtels de passage.", null],
  ECR: ["Partir en tournée de théâtre ou de spectacle", "Des villes inconnues, des salles de tailles variées, des loges minuscules et des hôtels de passage.", null],
  VIS: ["Faire circuler ton travail dans des expositions", "Des villes, des murs blancs, des vernissages et des trajets avec des cadres sous le bras.", ["L'exposition itinérante est fatigante et belle. Tu reviens avec de l'argent, des contacts partout et un public qui sait ton nom.", "Les salles sont à moitié vides et les vernissages tièdes. L'exposition n'est pas rentable, mais tu progresses."]],
  WEB: ["Partir à la rencontre de ton public", "Salons, conventions et rencontres avec ceux qui te suivent. Tu découvres que les gens réels sont plus grands qu'à l'écran.", ["La rencontre est fatigante et belle. Tu reviens avec de l'argent, des contacts partout et des fans qui connaissent ton nom.", "Les salles sont à moitié vides et les stands trop chauds. La tournée n'est pas rentable, mais tu progresses."]],
});
words("s_contrat", SCENE, {
  MUS: ["Signer avec un grand label", "Plus de moyens, un studio mieux équipé et un contrat plus épais que ton répertoire.", null],
  ECR: ["Signer avec une grande production", "Un studio, une chaîne ou une grande agence. Plus de moyens, moins de liberté.", null],
  VIS: ["Être représenté par une grande galerie", "Une galerie qui compte te propose un contrat d'exclusivité. Plus de moyens et de visibilité, moins de liberté.", null],
  WEB: ["Signer avec un grand réseau ou une grande marque", "Une plateforme ou une marque te propose un contrat. Plus de moyens, moins de liberté.", null],
});
words("s_festival", SCENE, {
  MUS: ["Te présenter à un festival ou à un concours de chant", "Un jury, un public et une photo du lauréat dans le journal du lendemain.", null],
  ECR: ["Te présenter à un festival ou à un concours", "Un jury, un public et une photo du lauréat dans le journal du lendemain.", null],
  VIS: ["Concourir pour un salon ou un prix d'art", "Un jury qui regarde ton œuvre trois secondes et un nom de lauréat dans le journal du lendemain.", null],
  WEB: ["Viser un prix de créateurs ou de médias", "Un jury, des nominations et une cérémonie où tout le monde se connaît.", null],
});
words("s_maitre", SCENE, {
  MUS: ["Prendre des cours avec un grand musicien", "Un artiste reconnu accepte de te prendre en cours. Il est exigeant, souvent injuste et toujours instructif.", null],
  ECR: ["Prendre des cours avec un grand comédien", "Un artiste reconnu accepte de te prendre en cours. Il est exigeant, souvent injuste et toujours instructif.", null],
  VIS: ["Prendre des cours avec un maître de ton art", "Un artiste reconnu accepte de te prendre en atelier. Il est exigeant, souvent injuste et toujours instructif.", null],
  WEB: ["Te former auprès d'un grand créateur", "Une figure de ton milieu accepte de te donner son temps. Il est exigeant, souvent injuste et toujours instructif.", null],
});
// des issues très liées à la scène ne conviennent pas à tous
notFor("s_casting", ["critique_gastro", "paparazzi", "gamedev", "voyante", "sculpteur_beurre", "traducteur_chats", "chasseur_fantomes", "dresseur_licornes"]);

// ===== sport =====
words("sp_grand_rdv", SPORT, {
  TEAM: ["Viser la grande finale avec ton équipe", "Championnat, finale, derby mythique. Toute ta saison converge vers un seul match.", ["Vous le faites. Le jour J, tout s'aligne, et ton équipe réalise l'exploit dont tu rêvais depuis l'enfance.", "Vous faites un beau match. Pas de titre, mais de la fierté et des sponsors rassurés.", "Le jour J, rien ne va. Tu passes l'hiver à te demander pourquoi."]],
  SOLO: ["Viser le grand rendez-vous de l'année", "Championnat, finale, course mythique. Toute ta saison converge vers un seul jour.", null],
  ESP: ["Viser le grand tournoi mondial", "Une salle comble, des écrans géants et dix mille personnes qui regardent ta souris. Toute ta saison converge vers un seul week-end.", ["Tu le fais. Le jour J, tout s'aligne, et ton équipe soulève le trophée devant une salle debout.", "Tu fais un beau tournoi. Pas de titre, mais de la fierté et des sponsors rassurés.", "Le jour J, rien ne va. Tu passes l'hiver à regarder le replay."]],
  COACH: ["Mener tes athlètes jusqu'à la grande échéance", "Une finale, un championnat, une qualification. Tout ton travail de l'année se joue en quelques heures sur le bord du terrain.", ["Tes athlètes le font. Le jour J, tout s'aligne, et tu savoures l'exploit dont ils rêvaient depuis l'enfance.", "Une belle performance, sans titre. De la fierté et des sponsors rassurés.", "Le jour J, rien ne va. Tu passes l'hiver à te demander ce que tu aurais pu changer."]],
  ADV: ["Tenter l'expédition de ta vie", "Un sommet, un pôle, une mission lointaine. Toute ta préparation converge vers un seul départ.", ["Tu le fais. Le jour J, tout s'aligne, et tu réalises l'exploit dont tu rêvais depuis l'enfance.", "L'expédition est belle et incomplète. Pas de record, mais de la fierté et des soutiens rassurés.", "Le jour J, tout se dérègle. Tu passes l'hiver à te demander pourquoi."]],
});
words("sp_prepa", SPORT, {
  ESP: ["Tout donner à l'entraînement et à l'hygiène de vie", "Des journées de pratique intensive, des réflexes à affûter, du sommeil à respecter et un dos qui proteste.", null],
  COACH: ["Mettre à jour ta méthode d'entraînement", "Stages, lectures et analyses vidéo. Ceux qui entraînent doivent aussi s'entraîner.", null],
  ADV: ["Te préparer physiquement pour l'expédition", "Endurance, altitude, froid et poids du sac. Ton corps devra tenir plus longtemps que ton confort.", null],
});
words("sp_contrat", SPORT, {
  TEAM: ["Négocier un nouveau contrat ou un transfert", "Ton agent, un directeur sportif et trois clubs qui font semblant de ne pas se parler.", null],
  SOLO: ["Négocier avec une écurie, un équipementier ou une fédération", "Ton agent, un directeur et trois marques qui font semblant de ne pas se parler.", ["Une meilleure structure te veut. Ton nouveau contrat te permet de franchir un cap, en salaire comme en visibilité.", "Aucune structure ne s'engage. Tu restes où tu es, avec une prolongation moins avantageuse."]],
  ESP: ["Rejoindre une meilleure équipe", "Ton manager, deux structures concurrentes et une clause de départ que personne ne comprend.", ["Une meilleure équipe te veut. Ton nouveau contrat te permet de franchir un cap, en salaire comme en visibilité.", "Aucune équipe ne s'engage. Tu restes où tu es, avec une prolongation moins avantageuse."]],
});
words("sp_capitaine", SPORT, {
  ESP: ["Devenir le capitaine de l'équipe", "Organiser les stratégies, calmer les tensions, parler aux sponsors quand ça va mal.", null],
});
onlyFor("sp_contrat", ["foot", "rugby", "tennis", "boxe", "natation", "ski", "cyclisme", "f1", "sportpro", "golf_pro", "esport"]);
onlyFor("sp_capitaine", ["foot", "rugby", "esport"]);
onlyFor("sp_reconversion", ["foot", "rugby", "tennis", "boxe", "natation", "ski", "cyclisme", "f1", "sportpro", "golf_pro", "esport", "astronaute", "explorateur"]);
notFor("sp_raccourci", ["esport", "explorateur", "astronaute", "coach", "golf_pro", "testeur_toboggans"]);
notFor("sp_sponsor", ["coach", "astronaute"]);
notFor("sp_grand_rdv", ["testeur_toboggans"]);

// ===== métiers manuels =====
onlyFor("t_label", FOOD);
onlyFor("t_chantier_risque", RISK);
onlyFor("t_concours", EXAM.concat(["public", "enseignement"]));
notFor("t_atelier", NOSHOP);
words("t_label", subOf({ FOOD: FOOD }), { FOOD: ["Viser un label de qualité", "Un guide, une étoile, une distinction régionale. Les inspecteurs passent sans prévenir.", null] });

// ===== coups de poker de la scène et du sport (rc_*) =====
const MUS = ["chanteur", "dj"];
const ECR = ["cinema", "humour", "mannequin", "cabaret", "adulte", "medium_tele"];
onlyFor("rc_mus_streams", MUS);
onlyFor("rc_mus_label", MUS);
onlyFor("rc_mus_viral", MUS.concat(["createur"]));
onlyFor("rc_cine_la", ECR);
onlyFor("rc_cine_tele", ECR.concat(["createur", "chanteur", "danse"]));
onlyFor("rc_cine_film", ECR.concat(["photo", "media"]));
onlyFor("rc_cine_buzz", ECR.concat(["createur", "chanteur", "dj", "media", "paparazzi"]));
onlyFor("rc_sport_agent", ["foot", "rugby", "tennis", "boxe", "natation", "ski", "cyclisme", "f1", "sportpro", "golf_pro", "esport"]);
onlyFor("rc_sport_camp", ["foot", "rugby", "tennis", "boxe", "natation", "ski", "cyclisme", "f1", "sportpro", "golf_pro", "explorateur", "astronaute"]);
onlyFor("rc_sport_truque", ["foot", "rugby", "tennis", "boxe", "cyclisme", "sportpro", "esport"]);

}

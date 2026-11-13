"use strict";
// ============================================================
// RICHISSIME DESTINY — Parcours atypiques
// Cinq voies très rares, avec une suite de choix précis qu'il faut réussir un à un.
// La voie divine (culte, prophète, dieu), la politique jusqu'à la présidence, la conquête spatiale,
// la recherche jusqu'au prix Nobel et la famille royale.
// Chaque étape apparaît de temps en temps et reste proposée tant qu'elle est possible.
// ============================================================
const C = require("./core");
const JU = require("./justice");

const PATHS = [];

function stage(flags, order) { for (let i = order.length - 1; i >= 0; i--) if (flags[order[i]]) return i; return -1; }

// ---------- déclaration des voies ----------
// Chaque étape : id, l, ic, d, req (drapeau exigé), set (drapeau posé), win, flat, ok, nul, ko, cost, ages, w, cool, fit, tr, fxWin, fxKo
const CULTE = {
  id: "culte", tag: "loufoque", order: ["culte_1", "culte_2", "culte_3", "prophete", "miracle", "dieu"],
  income: [[8000, 30000], [40000, 150000], [200000, 700000], [700000, 2500000], [2000000, 8000000], [5000000, 20000000]],
  label: ["Fondateur d'une secte", "Gourou de plusieurs centaines de fidèles", "Maître d'un grand temple", "Prophète", "Faiseur de miracles", "Dieu"],
  steps: [
    { id: "culte_fonder", l: "Fonder une petite secte", ic: "🕯️", d: "Un salon, des bougies et quelques âmes perdues prêtes à croire en toi. C'est le début d'un très long chemin vers le sommet.", set: "culte_1", ages: [24, 75], w: 1, cool: 12, prio: 0, cost: 500, win: 0.55, flat: 0.3,
      ok: "Une dizaine de personnes viennent t'écouter chaque semaine. Elles te donnent de l'argent et te regardent comme un guide. Ta petite secte est née.", nul: "Personne ne vient, ou presque. L'idée était belle, mais il va falloir un meilleur discours.", ko: "Un journaliste curieux s'intéresse à toi. L'article est moqueur et ta réputation en prend un coup.",
      fit: (p) => (p.stats.charme >= 58 && p.stats.intel >= 50 ? 2.2 : p.stats.charme >= 50 ? 0.7 : 0.15), fxWin: { charme: 2, honnete: -4, argent: 3000 }, fxKo: { repute: -8, bonheur: -4 } },
    { id: "culte_fideles", l: "Recruter des centaines de fidèles", ic: "🙏", d: "Des réunions plus grandes, des témoignages émus et un message qui circule. Tes fidèles deviennent nombreux.", req: "culte_1", set: "culte_2", ages: [24, 80], cool: 3, win: 0.5, flat: 0.35,
      ok: "Ta communauté compte maintenant des centaines de fidèles. Les dons arrivent chaque mois et tu n'as plus besoin de travailler.", nul: "Les fidèles restent fidèles, mais la communauté ne grandit pas cette année.", ko: "Deux fidèles partent en claquant la porte et racontent tout. Les rumeurs de dérive sectaire circulent.", fxWin: { argent: 20000, repute: 2 }, fxKo: { repute: -10, bonheur: -5 } },
    { id: "culte_temple", l: "Bâtir un grand temple", ic: "🛕", d: "Un vrai bâtiment, un autel, une salle immense. Cela coûte cher, mais cela change tout. Coût 30 000 €.", req: "culte_2", set: "culte_3", ages: [26, 85], cool: 4, cost: 30000, win: 0.5, flat: 0.3,
      ok: "Le temple est inauguré devant une foule immense. Des élus viennent te saluer et les dons explosent.", nul: "Le chantier prend du retard. Le temple sera pour plus tard.", ko: "Un contrôle fiscal découvre des comptes douteux. Tu es condamné pour abus de confiance.", fxWin: { repute: 3, argent: 60000 }, fxKo: { prison: 3, repute: -15, bonheur: -8, unflag: ["culte_1", "culte_2"] } },
    { id: "culte_prophete", l: "Te proclamer prophète", ic: "📜", d: "Tu affirmes avoir reçu un message venu d'ailleurs. Ou tu convaincs tes fidèles que c'est le cas.", req: "culte_3", set: "prophete", ages: [28, 90], cool: 4, win: 0.5, flat: 0.35,
      ok: "Tes fidèles s'agenouillent. Un livre sacré est publié et des disciples traduisent tes paroles dans le monde entier. Tu es désormais un prophète.", nul: "On t'écoute avec respect, mais on attend une preuve. Tu dois encore convaincre.", ko: "Un ancien fidèle publie un livre à charge. Tu perds une partie de tes disciples.", fxWin: { repute: 5, argent: 200000 }, fxKo: { repute: -12, argent: -50000 } },
    { id: "culte_miracle", l: "Accomplir un miracle devant les caméras", ic: "✨", d: "Un événement que personne ne peut expliquer, filmé par le monde entier. Ou le meilleur tour de magie de l'histoire.", req: "prophete", set: "miracle", ages: [30, 95], cool: 5, win: 0.33, flat: 0.4,
      ok: "La foule hurle. Les images font le tour du monde et des millions de personnes croient en toi. Tu n'es plus un prophète mais un faiseur de miracles.", nul: "L'effet est modeste. Certains crient au prodige, d'autres au trucage.", ko: "Le miracle tourne mal devant les caméras. Les moqueries sont mondiales.", fxWin: { repute: 12, bonheur: 8, argent: 1000000 }, fxKo: { repute: -25, bonheur: -10 } },
    { id: "culte_ascension", l: "Réaliser l'ascension finale", ic: "🌌", d: "Le soir de la grande cérémonie, des millions de regards se tournent vers toi. Si tout réussit, tu deviens plus qu'un humain. Si tout échoue, tu perds beaucoup.", req: "miracle", set: "dieu", ages: [32, 100], cool: 6, win: 0.22, flat: 0.45,
      ok: "Le ciel s'ouvre. Une lumière enveloppe ton corps et tu t'élèves au-dessus de la foule. Tu es devenu un dieu. Ton corps ne vieillit plus, ta fortune est sans limite et tes pouvoirs touchent désormais tous les autres.", nul: "La cérémonie est magnifique, mais rien d'extraordinaire ne se produit. Il faudra recommencer.", ko: "La cérémonie échoue devant le monde entier. Des fidèles quittent ta communauté et ton statut de miracle s'effondre.", fxWin: { repute: 30, bonheur: 30, sante: 100, argent: 5000000, pub: "🌟 Stupeur mondiale, $nom s'est élevé(e) dans le ciel et se proclame dieu." }, fxKo: { repute: -25, bonheur: -12, unflag: ["miracle"] } },
  ],
};

const POLITIQUE = {
  id: "pol", order: ["pol_1", "pol_2", "pol_3", "pol_4", "president"],
  income: [[0, 5000], [25000, 60000], [70000, 110000], [130000, 220000], [250000, 400000]],
  label: ["Militant engagé", "Maire", "Député", "Ministre", "Président de la République"],
  steps: [
    { id: "pol_militer", l: "T'engager dans un parti politique", ic: "🗳️", d: "Tu distribues des tracts, tu parles aux gens et tu apprends les règles du jeu. La politique est une longue marche.", set: "pol_1", ages: [18, 65], w: 1, cool: 8, prio: 0, win: 0.6, flat: 0.3,
      ok: "Tu deviens un militant remarqué. On te propose de nouvelles responsabilités.", nul: "Tu colles des affiches et tu bois des cafés. Personne ne te remarque encore.", ko: "Une querelle interne t'éloigne de tes amis politiques.", fit: (p) => (p.stats.charme >= 55 && p.stats.intel >= 55 ? 2 : 0.4), fxWin: { repute: 3, charme: 2 }, fxKo: { repute: -4 } },
    { id: "pol_maire", l: "Te présenter à la mairie", ic: "🏛️", d: "Une liste, une campagne et un quartier à convaincre. La victoire change ton statut.", req: "pol_1", set: "pol_2", ages: [25, 80], cool: 5, win: 0.4, flat: 0.4,
      ok: "Tu es élu maire. Ton nom est connu de tous les habitants.", nul: "Tu perds de peu. La prochaine fois sera la bonne.", ko: "Une affaire de campagne te nuit. Tu perds du crédit.", fxWin: { repute: 8, bonheur: 5 }, fxKo: { repute: -8 } },
    { id: "pol_depute", l: "Devenir député", ic: "🏟️", d: "Une circonscription, un adversaire coriace et une campagne nationale.", req: "pol_2", set: "pol_3", ages: [28, 85], cool: 5, win: 0.33, flat: 0.45,
      ok: "Tu entres à l'Assemblée. Tes discours passent à la télévision.", nul: "Tu échoues au second tour. Tu gardes ton mandat de maire.", ko: "Une affaire de financement t'éclabousse. Tes alliés prennent leurs distances.", fxWin: { repute: 8, bonheur: 4 }, fxKo: { repute: -10 } },
    { id: "pol_ministre", l: "Entrer au gouvernement", ic: "📂", d: "Un ministère, des dossiers lourds et les yeux de tout le pays rivés sur toi.", req: "pol_3", set: "pol_4", ages: [32, 85], cool: 5, win: 0.32, flat: 0.45,
      ok: "Tu deviens ministre. Les caméras te suivent partout et les journaux t'appellent par ton prénom.", nul: "On te promet un poste, mais le remaniement te laisse sur le côté.", ko: "Un scandale éclate au sein de ton cabinet et tu dois présenter des excuses publiques.", fxWin: { repute: 8 }, fxKo: { repute: -12 } },
    { id: "pol_presidence", l: "Briguer la présidence de la République", ic: "👑", d: "Le plus grand défi d'une vie politique. Des mois de campagne, des débats, et un pays à convaincre.", req: "pol_4", set: "president", ages: [35, 90], cool: 6, win: 0.16, flat: 0.5,
      ok: "Tu es élu président de la République. Tu diriges le pays et tes décisions comptent pour des millions de personnes.", nul: "Tu échoues au second tour avec un score honorable. Tu restes une figure majeure.", ko: "Ta campagne s'effondre après un faux pas fatal. La défaite est cinglante.", fxWin: { repute: 25, bonheur: 15, pub: "🏛️ $nom est élu(e) à la tête du pays." }, fxKo: { repute: -12, bonheur: -8, unflag: ["pol_4"] } },
  ],
};

const ESPACE = {
  id: "esp", tag: "loufoque", order: ["esp_1", "esp_2", "esp_3", "esp_4"],
  income: [[0, 0], [60000, 110000], [110000, 200000], [250000, 600000]],
  label: ["Candidat astronaute", "Astronaute en formation", "Astronaute en mission", "Pionnier de Mars"],
  steps: [
    { id: "esp_candidater", l: "Candidater à l'agence spatiale", ic: "🚀", d: "Un dossier énorme, des tests physiques et des entretiens sans fin. Très peu de gens passent.", set: "esp_1", ages: [22, 42], w: 0.8, cool: 10, prio: 0, win: 0.4, flat: 0.5,
      ok: "Ta candidature est retenue. Tu entames un long cycle de sélection.", nul: "Le dossier est refusé cette fois. Tu pourras retenter.", ko: "Un test médical révèle un petit défaut qui te ferme la porte pour cette année.", fit: (p) => (p.stats.sante >= 70 && p.stats.intel >= 60 && p.stats.sport >= 50 ? 2.5 : 0.1), fxWin: { repute: 4 }, fxKo: { bonheur: -3 } },
    { id: "esp_entrainement", l: "Suivre l'entraînement des astronautes", ic: "🧑‍🚀", d: "Centrifugeuse, apesanteur simulée, plongée en piscine et survie. Une année très dure.", req: "esp_1", set: "esp_2", ages: [22, 50], cool: 3, win: 0.5, flat: 0.35,
      ok: "Tu termines major de ta promotion. On te propose une place dans un équipage.", nul: "Tu stagnes dans le classement. L'entraînement continue l'année prochaine.", ko: "Tu te blesses à l'entraînement. Il te faudra du temps pour te remettre.", fxWin: { sport: 5, intel: 3, sante: 4, repute: 4 }, fxKo: { sante: -10 } },
    { id: "esp_mission", l: "Partir pour une mission en orbite", ic: "🛰️", d: "Un lancement, quelques mois dans la station et des images que le monde entier verra.", req: "esp_2", set: "esp_3", ages: [26, 58], cool: 4, win: 0.55, flat: 0.3,
      ok: "La mission est un succès. Tu reviens célèbre, avec des souvenirs plein les yeux.", nul: "Le lancement est repoussé. La mission aura lieu plus tard.", ko: "Un incident technique ramène l'équipage plus tôt que prévu. Tu es sain et sauf, mais déçu.", fxWin: { repute: 12, bonheur: 10, argent: 50000 }, fxKo: { bonheur: -5 } },
    { id: "esp_mars", l: "Poser le pied sur Mars", ic: "🔴", d: "Sept mois de voyage et une planète inconnue. Le plus grand voyage de l'histoire humaine.", req: "esp_3", set: "esp_4", ages: [30, 62], cool: 6, win: 0.3, flat: 0.4,
      ok: "Tu es parmi les premiers humains à marcher sur Mars. Ton nom est inscrit dans les manuels d'histoire.", nul: "La fenêtre de tir est manquée. Le voyage est reporté de deux ans.", ko: "La mission est annulée en plein vol. Tu rentres, épuisé et sans gloire.", fxWin: { repute: 30, bonheur: 25, argent: 1500000, pub: "🔴 $nom a marché sur Mars." }, fxKo: { repute: -2, sante: -10, bonheur: -6 } },
  ],
};

const NOBEL = {
  id: "sci", order: ["sci_1", "sci_2", "sci_3", "nobel"],
  income: [[0, 10000], [30000, 80000], [150000, 500000], [800000, 2000000]],
  label: ["Chercheur obsédé", "Découvreur reconnu", "Inventeur breveté", "Prix Nobel"],
  steps: [
    { id: "sci_recherche", l: "Te lancer dans une recherche folle", ic: "🧪", d: "Un laboratoire, un sujet que personne n'ose aborder et des nuits blanches. Tu cherches ce que personne n'a trouvé.", set: "sci_1", ages: [22, 70], w: 0.7, cool: 8, prio: 0, win: 0.55, flat: 0.35,
      ok: "Tes premiers résultats intriguent ton laboratoire. Tu tiens quelque chose.", nul: "Les expériences échouent les unes après les autres. Tu persévères.", ko: "Ton financement est coupé. Tu travailles sur ton temps libre.", fit: (p) => (p.stats.intel >= 68 ? 2.5 : p.stats.intel >= 58 ? 0.6 : 0.1), fxWin: { intel: 4 }, fxKo: { bonheur: -4 } },
    { id: "sci_decouverte", l: "Publier une découverte majeure", ic: "📄", d: "Un article dans une grande revue, relu par des spécialistes sceptiques.", req: "sci_1", set: "sci_2", ages: [24, 85], cool: 4, win: 0.45, flat: 0.4,
      ok: "L'article fait le tour de la communauté scientifique. On te cite partout.", nul: "Les relecteurs demandent des corrections. La publication attendra.", ko: "Une erreur est trouvée dans tes calculs. Tu dois tout reprendre.", fxWin: { intel: 3, repute: 8, argent: 15000 }, fxKo: { repute: -6 } },
    { id: "sci_brevet", l: "Déposer un brevet révolutionnaire", ic: "💡", d: "Ton idée peut changer l'industrie. Des entreprises sont prêtes à payer très cher pour l'utiliser.", req: "sci_2", set: "sci_3", ages: [26, 85], cool: 4, win: 0.35, flat: 0.4,
      ok: "Le brevet est accepté. Les licences t'apportent une jolie fortune.", nul: "Les industriels hésitent. Tu patientes.", ko: "Un concurrent dépose un brevet similaire avant toi. C'est un échec.", fxWin: { argent: 300000, repute: 6 }, fxKo: { bonheur: -5, repute: -3 } },
    { id: "sci_nobel", l: "Recevoir le prix Nobel", ic: "🏅", d: "Le plus grand honneur scientifique. Il faut que ton travail change vraiment le monde.", req: "sci_3", set: "nobel", ages: [35, 95], cool: 6, win: 0.15, flat: 0.6,
      ok: "L'académie t'appelle à l'aube. Tu reçois le prix Nobel à Stockholm.", nul: "Tu es cité parmi les favoris, mais le prix revient à quelqu'un d'autre cette année.", ko: "Une polémique de dernière minute écarte ta candidature.", fxWin: { repute: 28, bonheur: 20, argent: 1000000, pub: "🏅 $nom reçoit le prix Nobel." }, fxKo: { repute: -4 } },
  ],
};

const ROYAUTE = {
  id: "roy", tag: "loufoque", order: ["roy_1", "roy_2", "roy_3"],
  income: [[0, 0], [250000, 500000], [2000000, 6000000]],
  label: ["Proche d'une famille royale", "Membre de la famille royale", "Souverain"],
  steps: [
    { id: "roy_rencontre", l: "Rencontrer l'héritier d'une famille royale", ic: "🏰", d: "Un bal, une invitation ou une rencontre par hasard. Une personne issue d'une famille royale croise ta route.", set: "roy_1", ages: [18, 50], w: 0.6, cool: 14, prio: 0, win: 0.5, flat: 0.4, need: { partner: false },
      ok: "Le courant passe immédiatement. On t'invite régulièrement à la cour.", nul: "Une conversation agréable, rien de plus. Les regards se perdent dans la foule.", ko: "Tu commets un faux pas à un dîner officiel. La famille te regarde de travers.", fit: (p) => (p.stats.charme >= 62 ? 2.5 : p.stats.charme >= 55 ? 0.6 : 0.05), fxWin: { charme: 2, repute: 4, bonheur: 5 }, fxKo: { repute: -4 } },
    { id: "roy_mariage", l: "Épouser un membre de la famille royale", ic: "💍", d: "Une demande, un mariage de conte de fées et des obligations sans fin. Tu entres dans la famille.", req: "roy_1", set: "roy_2", ages: [18, 70], cool: 4, win: 0.45, flat: 0.4,
      ok: "Le mariage est retransmis dans le monde entier. Tu fais désormais partie de la famille royale.", nul: "La famille hésite à donner son accord. La décision est repoussée.", ko: "Un scandale de presse met fin à votre histoire.", fxWin: { repute: 15, bonheur: 15, argent: 500000, pub: "💍 Mariage royal, $nom entre dans la famille." }, fxKo: { repute: -10, bonheur: -10, unflag: ["roy_1"] } },
    { id: "roy_trone", l: "Monter sur le trône", ic: "🤴", d: "La succession approche. Le moindre faux pas peut tout ruiner, mais la couronne est à portée de main.", req: "roy_2", set: "roy_3", ages: [30, 95], cool: 6, win: 0.25, flat: 0.5,
      ok: "On te couronne dans la cathédrale. Tu règnes désormais, entouré de palais et de courtisans.", nul: "Le vieux souverain s'accroche. La succession attendra.", ko: "Un conflit de succession éclate. La famille se divise et tu perds ta place.", fxWin: { repute: 28, bonheur: 15, argent: 3000000, pub: "👑 $nom est couronné(e)." }, fxKo: { repute: -15, bonheur: -10, unflag: ["roy_2"] } },
  ],
};

PATHS.push(CULTE, POLITIQUE, ESPACE, NOBEL, ROYAUTE);

function register(lk) {
  const { reg, out } = lk;
  PATHS.forEach((P) => {
    P.steps.forEach((S) => {
      const need = Object.assign({ ages: S.ages || [22, 85], noprison: true, nostudy: true }, S.need || {});
      if (S.req) need.flag = S.req;
      need.noflag = S.set;
      const spec = {
        id: S.id, grp: "parcours", l: S.l, ic: S.ic, d: S.d, need, cool: S.cool || 3, w: S.w || 9, j: true, prio: S.prio === undefined ? 1 : S.prio,
        fit: S.fit || (() => 1.5),
        outs: [
          out(S.win, S.ok, Object.assign({ flag: S.set }, S.fxWin || {}), true),
          out(S.flat, S.nul, {}),
          out(Math.max(0.02, 1 - S.win - S.flat), S.ko, S.fxKo || {}, true),
        ],
      };
      if (P.tag) spec.tag = P.tag;
      if (S.cost) spec.cost = S.cost;
      reg(spec);
    });
  });
}

// ---------- effets de chaque année ----------
function level(p, P) { return stage(p.flags, P.order); }

function yearly(g, p, rep) {
  if (p.prison || !p.alive) return;
  const rng = g.rng;
  PATHS.forEach((P) => {
    const i = level(p, P);
    if (i < 0) return;
    const [lo, hi] = P.income[i];
    if (hi > 0) {
      const gain = C.rint(rng, lo, hi);
      if (gain > 0) {
        if (P.id === "culte") JU.earn(p, gain, 0.4); else p.cash += gain;
        rep.income += gain;
        rep.lines.push((P.id === "culte" ? "🙏 Tes fidèles t'ont apporté " : P.id === "pol" ? "🏛️ Ta fonction t'a rapporté " : P.id === "esp" ? "🚀 Ta carrière spatiale t'a rapporté " : P.id === "sci" ? "🔬 Tes recherches et tes brevets t'ont rapporté " : "👑 Ton rang t'a rapporté ") + C.fmt(gain) + " cette année. Statut actuel, " + P.label[i].toLowerCase() + ".");
      }
    }
    // une année de prestige
    if (i >= 1) p.stats.repute = C.clamp(p.stats.repute + (P.id === "culte" ? 0.5 : 1.2), 0, 100);
  });
  // risque de scandale pour les petits cultes
  const ci = level(p, CULTE);
  if (ci >= 0 && ci <= 2 && rng() < 0.035) {
    require("./fx").applyFx(g, p, { prison: C.rint(rng, 2, 4), repute: -15, bonheur: -8, unflag: CULTE.order.slice(0, 3) }, null);
    rep.lines.push("🚔 Une enquête sur ta secte aboutit. Tu es condamné pour abus de faiblesse et la communauté se disperse.");
    g.news(p, "🚔 " + p.name + ", chef d'une secte, est condamné pour abus de faiblesse.", "crime");
  }
  if (p.flags.dieu) godYear(g, p, rep);
}

// Les pouvoirs d'un dieu. Il ne vieillit plus et influence la vie d'un autre joueur chaque année
function godYear(g, p, rep) {
  const rng = g.rng, st = p.stats;
  st.sante = 100; st.bonheur = C.clamp(st.bonheur + 6, 0, 100); st.repute = C.clamp(st.repute + 2, 0, 100); st.charme = C.clamp(st.charme + 1, 0, 100); st.intel = C.clamp(st.intel + 1, 0, 100);
  const others = g.alivePlayers().filter((q) => q !== p);
  if (!others.length) { rep.lines.push("🌟 Tu règnes sur un monde où plus personne ne t'égale."); return; }
  const q = others[Math.floor(rng() * others.length)];
  const kind = p.traits.bonte >= 45 ? (rng() < 0.8 ? "grace" : "epreuve") : (rng() < 0.7 ? "epreuve" : "grace");
  if (kind === "grace") {
    const gift = C.rint(rng, 20000, 200000);
    q.cash += gift; q.stats.bonheur = C.clamp(q.stats.bonheur + 10, 0, 100); q.stats.sante = C.clamp(q.stats.sante + 8, 0, 100); q.stats.repute = C.clamp(q.stats.repute + 3, 0, 100);
    q.yearLog.push("✨ " + p.name + ", devenu(e) dieu, t'a accordé sa grâce. Ta santé, ton moral et ton compte en banque s'en ressentent, " + C.fmt(gift) + " en plus.");
    rep.lines.push("🌟 Tu as béni " + q.name + " cette année.");
    g.news(q, "✨ Une grâce divine s'abat sur " + q.name + ", envoyée par " + p.name + ".");
  } else {
    const lost = Math.min(Math.max(0, q.cash), C.rint(rng, 10000, 150000));
    q.cash -= lost; q.stats.sante = C.clamp(q.stats.sante - 12, 0, 100); q.stats.bonheur = C.clamp(q.stats.bonheur - 10, 0, 100); q.stats.repute = C.clamp(q.stats.repute - 4, 0, 100);
    q.yearLog.push("⚡ " + p.name + ", devenu(e) dieu, t'a envoyé une épreuve. Tu perds " + C.fmt(lost) + ", ta santé et ton moral en pâtissent.");
    rep.lines.push("⚡ Tu as éprouvé " + q.name + " cette année.");
    g.news(q, "⚡ Une épreuve divine frappe " + q.name + ", venue de " + p.name + ".");
  }
}

// un dieu ne meurt pas de mort naturelle ou d'accident
function immortal(p) { return !!(p.flags && p.flags.dieu); }

// libellé affiché à côté du nom (null si aucune voie)
function title(p) {
  let best = null;
  PATHS.forEach((P) => { const i = level(p, P); if (i >= 1 && (!best || P.income[i][1] > best.v)) best = { v: P.income[i][1], t: P.label[i] }; });
  return best ? best.t : null;
}

module.exports = { register, yearly, immortal, title, PATHS };

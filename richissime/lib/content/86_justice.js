// La vie derrière les barreaux et ce qui se passe après. Les choix pèsent sur la suite (clan, dossier, évasion, argent sale, couple, amis).
const { ev, O, C, D } = require("../kit");
const JU = require("../justice");

const cell = { prison: true };
const P_ = (p) => JU.pris(p);
const gang = (p) => !!P_(p).gang;
const dirty = (p) => p.dirty || 0;
const left = (p) => (p.prison ? p.prison.left : 0);

// ================= pendant la peine =================
ev("pv_bagarre", {
  ages: [18, 90], tags: ["mature", "justice"], ic: "👊⛓️", w: 6, need: cell, once: false, cool: 3,
  t: "Dans la cour, un détenu plus costaud te bouscule exprès. Tout le monde s'arrête de jouer aux cartes et attend de voir ce que tu vas faire.",
  c: [
    C("Répondre à coups de poing", "👊", [O(0.55, "Tu gagnes le round. On te laisse tranquille, et un caïd note ton nom.", { courage: 3, sante: -3, pris: { rep: 10 }, honnete: -1 }), O(0.45, "Tu perds, devant tout le monde. Le sang, la honte et un séjour à l'infirmerie.", { sante: -9, pris: { rep: -6 }, bonheur: -4 })], { risk: 2 }),
    D("Appeler un surveillant", "📣", "Le détenu écope d'un rapport. Tu passes pour un faible, mais ton dossier se porte bien.", { pris: { dossier: 5, rep: -4, conduct: 1 }, bonheur: -1 }),
    D("Détourner l'attention avec une blague", "😅", "Tu fais rire la cour aux dépens de ton adversaire. Il t'en veut, mais personne ne bouge.", { sociable: 3, pris: { rep: 3 }, bonheur: 1 }),
    D("Demander la protection du clan", "🕴️", "Un homme costaud s'interpose et ton agresseur disparaît. Tu devras bien rendre la politesse un jour.", { pris: (p, x, g) => ({ gang: P_(p).gang || (p.org ? p.org.name : JU.orgName(g)), rep: 8 }), honnete: -2, flag: "milieu_contact" }, { need: { fn: (p) => !gang(p) }, why: "Tu fais déjà partie d'un clan" }),
  ],
});

ev("pv_tribut", {
  ages: [18, 90], tags: ["mature", "justice"], ic: "💰⛓️", w: 5, need: cell, once: false, cool: 4,
  t: "Deux détenus te barrent le chemin du réfectoire. Ils travaillent pour un caïd et réclament une « participation » mensuelle. Le ton est très poli et les poings sont très gros.",
  c: [
    D("Payer", "💵", "Tu paies sans discuter. La paix a un prix, et il est raisonnable.", { argent: -600, pris: { rep: -2 }, bonheur: -1 }, { cost: 600 }),
    C("Refuser", "🙅", [O(0.5, "Ils réfléchissent, haussent les épaules et vont taxer quelqu'un d'autre. Ton regard a dû faire effet.", { pris: { rep: 8 }, courage: 2 }), O(0.5, "La nuit suivante tourne mal. Tu t'en sors avec des côtes fêlées et une leçon.", { sante: -8, pris: { rep: -4 }, bonheur: -5 })], { risk: 2 }),
    D("Proposer de travailler pour leur caïd", "🤝", "Le caïd te reçoit, t'évalue, et t'adopte. Tu as un patron, et plus de problèmes de cette sorte.", { pris: (p, x, g) => ({ gang: P_(p).gang || JU.orgName(g), rep: 10 }), honnete: -3, flag: "milieu_contact" }, { need: { fn: (p) => !gang(p) }, why: "Tu as déjà un clan" }),
    D("Les dénoncer à l'administration", "📣", "L'administration promet de s'en occuper. Les rumeurs disent que tu as parlé, ce que tu paieras plus tard.", { pris: { snitch: true, dossier: 6, rep: -12 }, honnete: 2, bonheur: -2 }),
  ],
});

ev("pv_transfert", {
  ages: [18, 90], tags: ["mature", "justice"], ic: "🚐⛓️", w: 4, need: cell, once: false, cool: 5,
  t: "L'administration annonce un transfert dans un autre établissement, à l'autre bout du pays. Tes affaires tiennent dans un sac, ton réseau dans ta tête.",
  c: [
    D("Accepter sans histoire", "🎒", "Tu changes de décor. Tes visites seront plus rares, mais tu repars à zéro, sans casier de querelles.", { pris: (p) => ({ plan: -Math.round(P_(p).plan * 0.5), lien: -1 }), bonheur: -3, sociable: 1 }),
    D("Payer pour rester ici", "💼", "Un surveillant glisse ton dossier sous une pile. Tu restes.", { argent: -3000, pris: { bribed: 1 }, honnete: -2 }, { cost: 3000, need: { fn: (p) => p.cash + dirty(p) >= 3000 }, why: "Pas assez d'argent" }),
    D("Demander un établissement près de ta famille", "🏡", "L'administration accepte, étonnée par ta demande polie. Les visites seront plus faciles.", { pris: { lien: 3, dossier: 3 }, bonheur: 4 }),
    C("Profiter du trajet pour t'évader", "🏃", [O(0.12, "Le fourgon est attaqué par des amis dévoués. Tu t'envoles dans la nature.", { escape: true, courage: 5, pro: { heat: 40 }, bonheur: 10 }), O(0.88, "La tentative échoue lamentablement. Rallonge et isolement.", { extend: 3, sante: -4, bonheur: -9, pris: { dossier: -15 } })], { risk: 3, need: { fn: (p) => gang(p) || P_(p).plan >= 30 }, why: "Tu n'as ni complices ni plan" }),
  ],
});

ev("pv_emeute", {
  ages: [18, 90], tags: ["mature", "justice"], ic: "🔥⛓️", w: 3, need: cell, once: false, cool: 8,
  t: "À l'heure du repas, un cri, puis un plateau qui vole. En moins d'une minute, la moitié du bâtiment est en feu et les surveillants reculent dans les couloirs.",
  c: [
    C("Prendre part à l'émeute", "🔥", [O(0.5, "Le désordre te donne de l'air et de la réputation. Tu repères aussi des failles dans le dispositif.", { pris: { rep: 12, plan: 15 }, courage: 3, bonheur: 3 }), O(0.5, "L'enquête te retrouve sur les images. Rallonge, isolement et dossier ruiné.", { extend: 2, pris: { dossier: -15 }, bonheur: -6 })], { risk: 3 }),
    D("Te cacher en cellule", "🙈", "Tu laisses la tempête passer. L'administration remarque ton calme.", { pris: { dossier: 4, conduct: 1 }, prudent: 3 }),
    D("Aider les surveillants à évacuer", "🚑", "Tu portes un blessé jusqu'à l'infirmerie. On s'en souviendra au moment de la commission.", { bonte: 4, pris: { dossier: 12, rep: -6, conduct: 2 }, repute: 2, bonheur: 2 }),
    C("Négocier le calme au nom des détenus", "🕊️", [O(0.6, "Tu obtiens une promesse de meilleures conditions. Tu es respecté par les deux camps.", { pris: { rep: 10, dossier: 6 }, charme: 2, repute: 2 }), O(0.4, "Personne ne t'écoute et tu deviens la cible de tous.", { sante: -5, pris: { rep: -4 }, bonheur: -3 })], { risk: 2 }),
  ],
});

ev("pv_parrain", {
  ages: [20, 80], tags: ["mature", "justice"], ic: "🕴️⛓️", w: 4, need: Object.assign({ fn: (p) => !p.org && P_(p).rep >= 5 }, cell), once: true,
  t: "Un homme élégant se fait annoncer au parloir. Il se présente comme un « ami de la famille » et dit qu'une organisation s'intéresse à toi. À ta sortie, il y aura une place, un salaire et des amis. À une condition, on ne demande jamais pourquoi.",
  c: [
    D("Accepter de rejoindre l'organisation", "🤝", "On te promet un grade dès ta sortie. En attendant, on s'occupe de ton quotidien.", { pris: (p, x, g) => ({ gang: JU.orgName(g), rep: 20 }), org: true, sale: 6000, honnete: -4, flag: "milieu_contact", pro: { net: 8, rep: 4, heat: 6 } }),
    D("Demander du temps pour réfléchir", "⏳", "Il sourit. On te laissera cette liberté, mais pas éternellement.", { pris: { rep: 4 }, prudent: 2 }),
    D("Refuser et couper les ponts", "🚫", "Il ne montre aucune colère. Mais certains ne l'oublient pas.", { honnete: 3, prudent: 2, pris: { rep: -4 }, bonheur: 1 }),
    D("Le dénoncer", "📣", "Les enquêteurs se montrent reconnaissants. L'organisation moins.", { pris: { snitch: true, dossier: 12, rep: -18 }, honnete: 3, shorten: (p) => (left(p) >= 3 ? 1 : 0) }),
  ],
});

ev("pv_tunnel", {
  ages: [18, 70], tags: ["mature", "justice"], ic: "🕳️⛓️", w: 3, need: Object.assign({ fn: (p) => left(p) >= 3 }, cell), once: true,
  t: "Un codétenu t'explique à voix basse que sa cellule cache un début de tunnel, et que le plan manque d'un partenaire de confiance. Il a besoin de quelqu'un de patient et de discret.",
  c: [
    C("Rejoindre le plan", "🛠️", [O(0.6, "Les semaines de creusement passent sans éveiller les soupçons. Le projet avance, et ta confiance aussi.", { pris: { plan: 35 }, courage: 2, pro: { heat: 4 } }), O(0.4, "Un surveillant découvre le trou. Vous prenez tous les deux de lourdes rallonges.", { extend: 2, pris: { dossier: -15, plan: -100 }, bonheur: -7 })], { risk: 3 }),
    D("Refuser et garder le secret", "🤐", "Tu tiens ta langue. Il te regarde avec un respect nouveau.", { prudent: 2, pris: { rep: 3 } }),
    D("Le dénoncer", "📣", "L'administration te remercie à sa façon. Le détenu ne te pardonnera pas.", { pris: { snitch: true, dossier: 10, rep: -15 }, shorten: 1, honnete: 2 }),
  ],
});

ev("pv_directeur", {
  ages: [18, 90], tags: ["mature", "justice"], ic: "🧑‍⚖️⛓️", w: 4, need: Object.assign({ fn: (p) => left(p) >= 2 }, cell), once: false, cool: 6,
  t: "Le directeur te convoque. Il a lu ton dossier. Il peut faciliter les choses, à condition que tu l'aides à garder son établissement calme. Il ne précise pas ce que cela signifie.",
  c: [
    D("Coopérer franchement", "🤝", "Tu l'informes de ce qui se passe, sans trop détailler. Il remarque ton sérieux.", { pris: { dossier: 10, rep: -6, conduct: 2 }, shorten: (p) => (left(p) >= 4 ? 1 : 0), honnete: 1 }),
    D("Demander des avantages concrets d'abord", "💬", "Tu négocies un meilleur travail, une cellule plus calme et des parloirs plus longs.", { pris: { dossier: 4, lien: 2 }, charme: 1, bonheur: 3 }),
    D("Refuser tout net", "✋", "Il note ton refus d'un air neutre. Le prochain examen sera plus froid.", { pris: { dossier: -4, rep: 4 }, courage: 2 }),
    D("Lui proposer de l'argent", "💼", "Il fait semblant de ne rien voir. Les portes s'ouvrent plus facilement qu'avant.", { argent: -5000, pris: { bribed: 1, dossier: 6 }, honnete: -3 }, { cost: 5000, need: { fn: (p) => p.cash + dirty(p) >= 5000 }, why: "Pas assez d'argent" }),
  ],
});

ev("pv_lettre_ex", {
  ages: [18, 90], tags: ["mature", "amour", "justice"], ic: "✉️💔", w: 5, need: Object.assign({ partner: true }, cell), once: false, cool: 6, who: { amour: "love" },
  t: "Un courrier de $amour dans le casier. L'enveloppe est mince. Tu l'ouvres dans le couloir, en essayant de ne pas trembler.",
  c: [
    D("La lire jusqu'au bout", "📖", "$amour promet de tenir bon, malgré la distance et les regards. Tu n'as pas le droit d'espérer plus, mais tu espères.", { rel: { amour: 10 }, pris: { lien: 2 }, bonheur: 6 }),
    D("Répondre par une longue lettre sincère", "✍️", "Tu lui écris ce que tu n'as jamais su dire dehors. La réponse arrive deux semaines plus tard, plus chaude que jamais.", { rel: { amour: 14 }, pris: { lien: 3 }, creatif: 2, bonheur: 7 }),
    D("Lui demander de t'oublier", "🚪", "Tu lui rends sa liberté. Elle pleure, puis elle accepte. Tu dors mal ce soir-là.", { drop: ["amour"], honnete: 2, bonheur: -9 }),
    C("Exiger des visites plus fréquentes", "😤", [O(0.4, "$amour vient plus souvent, fatigué(e) mais présent(e).", { rel: { amour: 4 }, pris: { lien: 2 }, bonheur: 2 }), O(0.6, "Elle trouve ton ton blessant. Vous vous éloignez un peu plus.", { rel: { amour: -12 }, bonheur: -5 })]),
  ],
});

ev("pv_deuil", {
  ages: [18, 90], tags: ["mature", "famille", "justice"], ic: "🕯️⛓️", w: 3, need: Object.assign({ rel: "parent" }, cell), once: false, cool: 10, who: { proche: "parent" },
  t: "Un surveillant t'annonce le décès de $proche. La cérémonie a lieu dans trois jours. Tu demandes une permission de sortie, sous escorte.",
  c: [
    C("Faire la demande dans les règles", "📋", [O(0.65, "On t'autorise à assister à la cérémonie, menotté(e) mais présent(e). Ta famille te serre dans ses bras.", { kill: ["proche"], rel: { mere: 5, pere: 5 }, pris: { dossier: 4, lien: 2 }, bonheur: -4 }), O(0.35, "La permission est refusée, faute d'escorte. Tu pleures seul(e) en cellule.", { kill: ["proche"], bonheur: -12 })]),
    C("Tenter de t'échapper pendant la cérémonie", "🏃", [O(0.15, "Le plan marche. Tu disparais dans la foule au cimetière.", { kill: ["proche"], escape: true, pro: { heat: 40 }, bonheur: -3 }), O(0.85, "L'escorte te coince au portail. Dur retour, peine rallongée.", { kill: ["proche"], extend: 3, bonheur: -14, pris: { dossier: -20 } })], { risk: 3, need: { fn: (p) => gang(p) || P_(p).plan >= 25 }, why: "Tu n'as aucun complice dehors" }),
    D("Rester en cellule et écrire un adieu", "🕊️", "Tu écris une longue lettre que ta famille lira devant la tombe.", { kill: ["proche"], creatif: 2, bonheur: -8, rel: { mere: 3, pere: 3 } }),
  ],
});

ev("pv_greve", {
  ages: [18, 90], tags: ["mature", "justice"], ic: "🥄⛓️", w: 3, need: cell, once: false, cool: 8,
  t: "Les détenus de l'étage décident d'une grève collective des plateaux pour protester contre les conditions. On vient te demander ta position.",
  c: [
    C("Participer pleinement", "✊", [O(0.55, "L'administration cède sur quelques points. Tu es salué(e) comme un meneur discret.", { pris: { rep: 10, dossier: 2 }, courage: 2, bonheur: 4 }), O(0.45, "L'administration serre la vis. Tu fais partie des punis.", { pris: { dossier: -8, rep: 4 }, sante: -3, bonheur: -4 })]),
    D("Ne pas te joindre au mouvement", "🙅", "Tu continues de manger tranquillement. Certains te le reprocheront.", { pris: { rep: -6, dossier: 2 } }),
    D("Organiser la grève toi-même", "📢", "Tu rédiges les revendications et tu mènes les discussions. Le journal local en parle.", { pris: { rep: 14, dossier: -3 }, repute: 3, charme: 2, pro: { rep: 2 } }, { need: { fn: (p) => P_(p).rep >= 15 }, why: "Tu n'as pas assez de respect ici" }),
  ],
});

ev("pv_audience", {
  ages: [18, 90], tags: ["mature", "justice"], ic: "⚖️🗓️", w: 6, need: Object.assign({ fn: (p) => left(p) >= 2 }, cell), once: false, cool: 4,
  t: "Une audience pour examiner ta peine est fixée. L'avocat commis d'office te prévient, le dossier est mince, mais tout dépend de la manière dont tu te présenteras.",
  c: [
    C("Jouer la carte du repentir", "🙏", [O((p) => Math.min(0.75, 0.25 + P_(p).dossier / 200), "Le juge est sensible à ton évolution. Une partie de ta peine est levée.", { shorten: (p) => Math.max(1, Math.round(left(p) * 0.25)), pris: { dossier: 4 }, honnete: 2, bonheur: 6 }), O((p) => 1 - Math.min(0.75, 0.25 + P_(p).dossier / 200), "Le juge est sceptique. Il estime que tu n'as pas assez changé.", { pris: { dossier: 2 }, bonheur: -3 })]),
    C("Contester l'enquête", "📚", [O(0.2, "Tu fais voler en éclats un point de procédure. La peine est revue à la baisse.", { shorten: (p) => Math.max(1, Math.round(left(p) * 0.35)), intel: 2, bonheur: 8 }), O(0.8, "La contestation est rejetée sans appel.", { bonheur: -4, pris: { dossier: -2 } })], { risk: 1 }),
    D("Faire intervenir un contact bien placé", "☎️", "Un coup de téléphone, une faveur rendue, un juge qui a des oreilles. Ta peine est révisée discrètement.", { shorten: (p) => Math.max(1, Math.round(left(p) * 0.3)), pris: { bribed: 1 }, honnete: -3, sale: -1500 }, { need: { fn: (p) => P_(p).bribed >= 1 || gang(p) || !!p.org }, why: "Tu n'as aucun contact de ce niveau" }),
  ],
});

ev("pv_cantine", {
  ages: [18, 80], tags: ["mature", "argent", "justice"], ic: "🍽️💰", w: 4, need: Object.assign({ fn: (p) => gang(p) && P_(p).rep >= 15 }, cell), once: false, cool: 5,
  t: "Le clan te confie la gestion de l'économie de la cantine. Cigarettes, produits frais, services. Un petit empire de timbres et de promesses.",
  c: [
    C("Faire tourner le marché sans excès", "📦", [O(0.85, "Le marché prospère. Tu es devenu le banquier de l'étage.", { sale: (p) => 3000 + Math.round(P_(p).rep * 150), pris: { rep: 8 }, honnete: -1 }), O(0.15, "Une dette impayée tourne au drame. Tu règles ça à l'amiable, difficilement.", { sale: 800, pris: { rep: 2 }, bonheur: -2 })]),
    C("Doubler les marges et gagner gros", "🤑", [O(0.55, "Les clients paient sans broncher. Tu t'enrichis, mais certains murmurent.", { sale: (p) => 8000 + Math.round(P_(p).rep * 250), pris: { rep: 4 }, honnete: -3 }), O(0.45, "Une révolte éclate. Le clan te retire la gestion et tu perds des appuis.", { pris: { rep: -12 }, sale: -1500, bonheur: -4 })], { risk: 2 }),
    D("Laisser la place à un autre", "🚪", "Tu laisses la gestion à un jeune ambitieux. On t'estime pour ton désintéressement.", { pris: { rep: 5, dossier: 2 }, bonte: 1 }),
  ],
});

ev("pv_visite_enfant", {
  ages: [20, 90], tags: ["mature", "famille", "justice"], ic: "🧒⛓️", w: 4, need: Object.assign({ rel: "child" }, cell), once: false, cool: 5, who: { petit: "child" },
  t: "Au parloir, $petit te regarde à travers la vitre. Les mots lui manquent. Les tiens aussi.",
  c: [
    D("Lui promettre de revenir pour de bon", "🤝", "Tu lui jures de ne plus jamais te retrouver ici. Tu sais que tu devras tenir.", { rel: { petit: 12 }, honnete: 2, pris: { lien: 2, dossier: 3 }, bonheur: 5 }),
    D("Lui expliquer honnêtement ce que tu as fait", "🗣️", "Il pose mille questions, certaines très dures. À la fin, il te serre la main.", { rel: { petit: 8 }, honnete: 3, bonheur: 2 }),
    D("Rester vague pour le protéger", "🌫️", "Tu évites les sujets difficiles. Il sent le non-dit, et son regard se ferme un peu.", { rel: { petit: -5 }, bonheur: -3 }),
  ],
});

ev("pv_infirmerie", {
  ages: [18, 90], tags: ["mature", "sante", "justice"], ic: "🩺⛓️", w: 4, need: cell, once: false, cool: 4,
  t: "Une douleur te réveille depuis plusieurs nuits. Ton tour à l'infirmerie n'arrive qu'après trois semaines d'attente.",
  c: [
    D("Attendre ton tour", "⏳", "Le médecin te soigne, un peu tard. La douleur s'en va, la séquelle reste.", { sante: -4, bonheur: -2 }),
    D("Acheter un tour de faveur", "💶", "Quelques euros, un médecin attentif, et la douleur disparaît en un jour.", { argent: -400, sante: 3, pris: { bribed: 0 } }, { cost: 400 }),
    D("Demander l'aide du clan", "🕴️", "Un détenu infirmier te soigne avec des moyens du bord. Tu lui devras une faveur.", { sante: 1, pris: { rep: 2 } }, { need: { fn: (p) => gang(p) }, why: "Tu n'as pas de clan" }),
  ],
});

ev("pv_ancien_ami", {
  ages: [18, 90], tags: ["mature", "justice"], ic: "🫂⛓️", w: 3, need: Object.assign({ rel: "friend" }, cell), once: true, who: { copain: "friend" },
  t: "Dans le couloir des visites, tu reconnais $copain, ton ancien camarade de jeunesse, menotté lui aussi. Il a l'air plus mal en point que toi.",
  c: [
    D("Lui tendre la main", "🤝", "Vous vous retrouvez dans la cour et vous parlez des années d'avant. Ça fait du bien à tous les deux.", { rel: { copain: 15 }, bonheur: 5, pris: { rep: 2 } }),
    D("Faire semblant de ne pas le reconnaître", "🙈", "Tu changes de couloir. Il comprend, et ça lui fait plus mal que ça ne devrait.", { rel: { copain: -15 }, bonheur: -2 }),
    D("Lui proposer d'entrer dans ton clan", "🕴️", "Il hésite, puis accepte. Tu te retrouves avec un allié sûr, et une responsabilité de plus.", { rel: { copain: 8 }, pris: { rep: 8 }, honnete: -1 }, { need: { fn: (p) => gang(p) }, why: "Tu n'as pas de clan" }),
  ],
});

ev("pv_nouveau", {
  ages: [18, 90], tags: ["mature", "justice"], ic: "🧳⛓️", w: 4, need: cell, once: false, cool: 4,
  t: "Un nouveau détenu arrive dans ta section. Il parle beaucoup, trop peut-être. Il connaît pas mal de monde dehors et il cherche quelqu'un à qui parler.",
  c: [
    C("Lier connaissance et tirer les vers du nez", "🕸️", [O(0.65, "Il te donne des noms, des adresses et des histoires. Une fois dehors, tu sauras à qui t'adresser.", { pro: { net: 8, rep: 2 }, pris: { rep: 3 }, honnete: -1 }), O(0.35, "Il s'avère être un indicateur. Tout ce que tu as dit est noté.", { pris: { dossier: -6 }, pro: { heat: 6 }, bonheur: -3 })]),
    D("Te tenir à distance", "🧊", "Tu gardes tes secrets et ton calme. Il finit par s'adresser à d'autres.", { prudent: 3 }),
    D("L'aider à s'installer", "🛏️", "Tu lui montres les règles non écrites. Il te remercie sincèrement.", { bonte: 3, pris: { rep: 4 }, rel: {}, bonheur: 2 }),
  ],
});

// ================= après la peine =================
ev("sp_casier", {
  chainOnly: true, ages: [18, 90], tags: ["mature", "travail", "justice"], ic: "📂🔓", w: 6, need: { flag: "ex_detenu", noprison: true }, once: false, cool: 3,
  t: "Tu es dehors, avec un casier qui te précède dans chaque entretien. Les employeurs sont polis, puis ils ne rappellent pas. Il faut choisir comment reprendre pied.",
  c: [
    D("Jouer la carte de la franchise", "🗣️", "Tu parles de ton passé sans détour. Quelqu'un finit par apprécier ta franchise et te donne ta chance.", { honnete: 3, jobHunt: true, pro: { rep: 2 }, bonheur: 3, repute: 1 }),
    C("Cacher ton casier", "🙈", [O(0.5, "L'employeur ne vérifie rien. Tu retrouves un poste correct.", { honnete: -2, jobHunt: true, bonheur: 3 }), O(0.5, "Un contrôle de routine révèle ton passé. Tu es renvoyé(e) dans la semaine, avec l'étiquette « menteur ».", { honnete: -3, repute: -5, bonheur: -6 })], { risk: 2 }),
    D("Te lancer à ton compte", "🧰", "Un petit commerce, une camionnette, des clients qui ne demandent pas ton casier. Ça démarre doucement.", { job: "libre:0", ambition: 2, creatif: 1, bonheur: 3 }),
    D("Revenir dans le milieu", "🕶️", "Les anciennes connaissances t'accueillent à bras ouverts. L'argent rentre vite, les ennuis aussi.", { job: "crime:0", honnete: -3, sale: 4000, pro: { heat: 8, net: 4 } }),
  ],
});

ev("sp_couple", {
  chainOnly: true, ages: [18, 90], tags: ["mature", "amour", "justice"], ic: "💞🔓", w: 6, need: { flag: "ex_detenu", noprison: true, partner: true }, once: false, cool: 4, who: { amour: "love" },
  t: "Tu retrouves $amour devant la porte. Les années ont laissé des traces sur vous deux. Vous n'avez pas le même regard sur ce qui s'est passé.",
  c: [
    D("Reconstruire doucement, un jour à la fois", "🌱", "Vous reprenez des habitudes, un petit déjeuner, une promenade. Le lien se recoud lentement.", { rel: { amour: 15 }, bonheur: 8, honnete: 1 }),
    D("Vous installer ailleurs pour repartir à zéro", "🧳", "Une nouvelle ville, personne ne vous connaît. Vous portez ensemble le secret.", { rel: { amour: 10 }, city: true, argent: -2500, bonheur: 5 }, { cost: 2500 }),
    C("Lui demander des comptes sur ces années", "❓", [O(0.5, "La discussion est dure, mais vous vous comprenez mieux.", { rel: { amour: 6 }, bonheur: 1 }), O(0.5, "Les reproches s'enchaînent. Vous vous quittez sur des mots qu'on regrette.", { drop: ["amour"], bonheur: -9 })]),
    D("Reprendre ta liberté", "🚪", "Tu as changé, elle aussi. Vous décidez de vous séparer en bons termes.", { drop: ["amour"], bonheur: -3, honnete: 1 }),
  ],
});

ev("sp_seul", {
  chainOnly: true, ages: [18, 90], tags: ["mature", "justice"], ic: "🏚️🔓", w: 5, need: { flag: "ex_detenu", noprison: true, partner: false }, once: false, cool: 4,
  t: "Personne ne t'attend à la sortie. Tu marches jusqu'à la gare avec ton sac, les yeux plissés par la lumière. Il faut tout reconstruire, un appartement, des contacts, un but.",
  c: [
    D("Retourner chez tes proches", "🏡", "Ta famille t'accueille avec un mélange de soulagement et de méfiance. C'est un début.", { home: "parents", rel: { mere: 8, pere: 6 }, bonheur: 4 }),
    D("Te trouver une chambre et un travail", "🛏️", "Une petite chambre, un contrat précaire. Rien de glorieux, mais c'est à toi.", { jobHunt: true, home: "rent", argent: -800, honnete: 1, bonheur: 2 }),
    D("Rejoindre ceux qui t'ont attendu", "🕶️", "Une voiture noire t'attend au coin de la rue. Les vieux amis t'ouvrent grand les bras.", { flag: "milieu_contact", job: "crime:0", sale: 3000, honnete: -3, pro: { net: 5 } }),
  ],
});

ev("sp_amis", {
  chainOnly: true, ages: [18, 90], tags: ["mature", "justice"], ic: "👥🔓", w: 5, need: { flag: "ex_detenu", noprison: true, rel: "friend" }, once: false, cool: 4, who: { copain: "friend" },
  t: "Les amis d'avant ont suivi leur vie. $copain a changé de quartier, de travail et de fréquentations. Certains évitent de te croiser, d'autres sont curieux.",
  c: [
    D("Les inviter à dîner pour recoller les morceaux", "🍲", "Le dîner est un peu raide au début, puis les histoires de jeunesse reprennent. Un ou deux resteront de vrais amis.", { rel: { copain: 12 }, sociable: 2, bonheur: 5 }),
    D("Te rapprocher de ceux que tu as connus en prison", "🕴️", "Vous partagez des souvenirs que les autres ne peuvent pas comprendre. Ce lien est solide, mais pas sans risques.", { rel: { copain: -8 }, flag: "milieu_contact", pro: { net: 5, heat: 3 }, bonheur: 2 }),
    D("Tourner la page et en rencontrer de nouveaux", "🌅", "Tu t'inscris dans un club, un atelier, un groupe de marche. De nouvelles têtes, de nouveaux départs.", { sociable: 3, creatif: 1, bonheur: 3 }),
  ],
});

ev("sp_orga", {
  chainOnly: true, ages: [18, 90], tags: ["mature", "justice"], ic: "🕴️🔓", w: 8, need: { flag: "ex_detenu", noprison: true, fn: (p) => !!p.org }, once: false, cool: 4,
  t: "Les chefs de ton organisation te reçoivent dans l'arrière-salle d'un restaurant. Ils parlent peu, observent beaucoup. Ils te demandent ce que tu veux faire de ta nouvelle liberté.",
  c: [
    D("Demander un poste de confiance", "📈", "On te confie un territoire, une équipe et une part des revenus. Ton nom circule déjà.", { rank: 1, sale: 15000, pro: { rep: 6, net: 5, heat: 8 }, honnete: -2 }),
    D("Rester dans l'ombre, sans histoire", "🌘", "On te laisse faire de petites missions, discrètes et sûres. Peu de gloire, peu de risques.", { sale: 5000, pro: { net: 2, heat: 2 }, prudent: 2 }),
    C("Demander à quitter l'organisation", "🚪", [O(0.4, "Après une conversation tendue, on te laisse partir à condition de rester muet. Tu es libre, pauvre et vivant.", { org: false, unflag: ["mafia"], sale: (p) => -Math.round(dirty(p) * 0.7), honnete: 3, pro: { heat: -15 }, bonheur: 6 }), O(0.6, "On ne quitte pas la famille. Un avertissement, puis une sévère correction.", { sante: -12, sale: (p) => -Math.round(dirty(p) * 0.3), bonheur: -8 })], { risk: 3 }),
    D("Proposer de prendre la tête d'une équipe rivale", "⚔️", "Les chefs approuvent à demi-mot. La guerre se prépare, et tu es sur la ligne de front.", { rank: 1, pro: { rep: 6, heat: 14 }, courage: 3, sale: 8000, flag: "milieu_contact" }, { need: { fn: (p) => p.org && p.org.rank >= 1 }, why: "Tu n'as pas assez de grade" }),
  ],
});

ev("sp_planque", {
  chainOnly: true, ages: [18, 90], tags: ["mature", "argent", "justice"], ic: "💰🔓", w: 4, need: { flag: "ex_detenu", noprison: true, fn: (p) => dirty(p) > 0 || p.cash < 2000 }, once: false, cool: 6,
  t: "Tu repasses voir la cachette où tu avais laissé une partie de ton argent avant ton arrestation. Une vieille boîte, un double fond, une porte de cave. Tu n'es pas sûr de ce que tu vas trouver.",
  c: [
    C("Aller la récupérer", "🔦", [O(0.6, "La planque est intacte. Tu récupères de quoi repartir, sans que personne ne le sache.", { sale: (p) => 5000 + Math.round(dirty(p) * 0.15), bonheur: 5 }), O(0.4, "Elle a été vidée. Quelqu'un savait. Tu ne sauras jamais qui.", { bonheur: -6, honnete: 0 })]),
    D("La laisser là, trop dangereux", "🚫", "Tu préfères ne pas courir de risque. L'argent attendra, ou pas.", { prudent: 3 }),
    D("La confier à quelqu'un de confiance", "🤝", "Un ami fidèle la gardera pour toi. Il prend sa part, comme il se doit.", { sale: (p) => -Math.round(dirty(p) * 0.1), rel: { bestfriend: 6 }, bonheur: 2 }),
  ],
});

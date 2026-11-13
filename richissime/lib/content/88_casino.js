// Casinos, tables de jeu et paris. Chaque scène propose plusieurs façons de jouer, avec une mise qui suit la fortune du joueur.
// Le résultat des mises est un gain net (clé gain). Rien ne se compte à la fortune quand on s'assoit à la table, seulement au résultat.
const { ev, O, C, D } = require("../kit");

const rnd50 = (v, lo, hi, step) => Math.max(lo, Math.min(hi, Math.round(v / step) * step));
const miseOf = (frac, lo, hi, step) => (p) => rnd50(Math.max(lo, p.cash * frac), lo, Math.min(hi, Math.max(lo, Math.floor(p.cash * 0.5))), step || 50);
// gain net, positif ou négatif, en multiple de la mise
const net = (k) => (p, x) => Math.round(x.vals.mise * k);
const R = (w, t, k, extra) => O(w, t, Object.assign({ gain: net(k), arc: { jeu: 1 } }, extra || {}));
const hasMoney = (k) => ({ money: [k, null] });

// ---------------- blackjack ----------------
ev("casino_blackjack", {
  chainOnly: true, once: false, tags: ["argent", "casino"], ic: "🃏", roll: { mise: miseOf(0.06, 50, 30000) },
  t: "La table de blackjack est tiède, le croupier a le sourire d'un comptable en vacances. Les jetons attendent. Tu peux jouer $mise ce soir. Comment t'assois-tu ?",
  c: [
    C("Jouer sagement, sans jamais s'emballer", "🃏", [
      R(0.44, "Tu gagnes la plupart des mains à la patience. Le croupier te salue d'un hochement, les voisins de table te trouvent ennuyeux et riche.", 0.8, { bonheur: 3 }),
      R(0.08, "Égalité sur la dernière main. Tu repars exactement comme tu es venu, avec un peu plus de pouls.", 0, { bonheur: 1 }),
      R(0.48, "La banque gagne. Elle gagne toujours un peu, c'est son métier et son loyer.", -0.7, { bonheur: -2 }),
    ], { risk: 2, need: hasMoney(80) }),
    C("Compter les cartes", "🧠", [
      R(0.5, "Ton cerveau fait des additions sous ta chemise. Les piles de jetons grimpent doucement, sans bruit, comme il se doit.", 1.1, { bonheur: 4, intel: 1 }),
      R(0.3, "Tu comptes bien mais tu mises mal. Le gain est mince et la sueur abondante.", 0.2),
      O(0.2, "Le chef de salle te raccompagne poliment à la porte. Ton visage figure désormais sur une liste. Les casinos te sont fermés pour de longues années.", { gain: net(0.3), flag: { banni_casino: 8 }, repute: -1, bonheur: -3, arc: { jeu: 1 } }),
    ], { risk: 3, need: { money: [200, null], stat: { intel: [58, null] } } }),
    C("Tout miser sur une seule main", "🔥", [
      R(0.04, "Un blackjack d'entrée, la table hurle, le croupier applaudit à contrecœur. Tu repars en héros pour une soirée.", 7.5, { bonheur: 10, repute: 1, pub: "🃏 $nom frappe un blackjack colossal et fait sauter la banque d'une table." }),
      R(0.43, "Tu gagnes la main et tu respires enfin. Tes mains tremblent encore dans le taxi.", 3, { bonheur: 6 }),
      R(0.53, "La banque retourne un vingt et un. Tu regardes ton tas de jetons disparaître avec la grâce d'une glace en été.", -3, { bonheur: -6, prudent: -1 }),
    ], { risk: 4, need: { money: [600, null], tr: { courage: [45, null] } } }),
    C("Doubler la mise à chaque perte", "📈", [
      R(0.8, "La méthode fonctionne, miracle. Tu ressors avec un petit bénéfice et la certitude d'avoir percé le système.", 0.6, { bonheur: 2 }),
      R(0.2, "La série noire dépasse ton portefeuille. Le système n'existe pas, et il te le prouve au sixième tour.", -6, { bonheur: -8, prudent: -2 }),
    ], { risk: 4, need: hasMoney(500) }),
    D("Prendre un verre et regarder les autres jouer", "🥃", "Tu bois un verre en regardant les joueurs et leurs visages. Tu repars avec trois histoires, aucune perte et une vraie envie de ne pas rentrer.", { sociable: 1, bonheur: 2 }, { risk: 0 }),
  ],
});

// ---------------- poker entre amis, en club ----------------
ev("casino_poker", {
  chainOnly: true, once: false, tags: ["argent", "casino"], ic: "♠️", roll: { mise: miseOf(0.04, 40, 15000) },
  t: "On sort les cartes, le tapis vert et les chips. La table est pleine de regards fuyants, de verres à moitié vides et de gens qui prétendent ne pas jouer pour l'argent. L'enjeu est de $mise. Quelle façon de jouer choisis-tu ?",
  c: [
    C("Jouer serré et patient", "🧊", [
      R(0.4, "Tu attends les bonnes cartes comme un chat attend une souris. Tu ramasses trois gros pots et ne dis presque rien.", 1, { bonheur: 3, prudent: 1 }),
      R(0.25, "Tu rentres dans tes frais. Personne n'a rien appris, tout le monde est content.", 0, { bonheur: 1 }),
      R(0.35, "Les bonnes cartes ne viennent pas, ou viennent trop tard. Ton tas fond lentement et poliment.", -0.8, { bonheur: -2 }),
    ], { risk: 2, need: hasMoney(60) }),
    C("Bluffer comme si ta vie en dépendait", "🎭", [
      R(0.38, "Ton bluff passe, tout le monde le sent après coup, et personne n'ose en vouloir à un menteur aussi charmant.", 2.2, { bonheur: 6, courage: 2, repute: 1 }),
      R(0.62, "On t'appelle, tu montres une paire de trois, la table éclate de rire. Tu paies ta tournée avec dignité.", -1.2, { bonheur: -3 }),
    ], { risk: 3, need: { money: [100, null], tr: { courage: [48, null] } } }),
    C("Défier le meilleur joueur de la table", "⚔️", [
      R(0.25, "Tu le bats au dernier tour, d'une quinte flush royale que personne n'a vue venir. Il te serre la main en regardant ailleurs.", 3.5, { bonheur: 8, repute: 2, ambition: 1, pub: "♠️ $nom bat le roi du poker local lors d'une partie mémorable." }),
      R(0.75, "Il te lit comme un menu de restaurant. Tu apprends beaucoup, tu perds plus encore.", -1.5, { bonheur: -4, intel: 1 }),
    ], { risk: 4, need: { money: [300, null], tr: { courage: [50, null] } } }),
    D("Apprendre en regardant la table", "📚", "Tu regardes, tu retiens, tu notes les tics des joueurs. Tu repars sans un sou perdu et avec une vraie méthode, ou presque.", { intel: 1, bonheur: 1 }, { risk: 0 }),
  ],
});

// ---------------- tournoi de poker ----------------
ev("casino_poker_tournoi", {
  chainOnly: true, once: false, tags: ["argent", "casino"], ic: "🏆", roll: { mise: miseOf(0.1, 200, 50000, 100) },
  t: "Un grand tournoi de poker s'ouvre ce week-end. Le droit d'entrée est de $mise, les caméras sont installées et la salle sent le café brûlé et l'ambition. Que fais-tu ?",
  c: [
    C("S'inscrire et jouer pour gagner", "🏆", [
      R(0.005, "Tu remportes le tournoi. Les flashs, les bras en l'air, un chèque géant que tu ne sais pas où poser. Ta vie vient de prendre un virage.", 60, { bonheur: 20, repute: 8, ambition: 3, pub: "🏆 $nom remporte un grand tournoi de poker et ramasse le gros lot.", flag: { champion_poker: 15 } }),
      R(0.03, "Tu termines à la table finale. Le prix est confortable, ton nom apparaît dans un article.", 9, { bonheur: 8, repute: 3 }),
      R(0.14, "Tu finis dans l'argent, de justesse. Le gain couvre l'inscription et quelques verres.", 1.2, { bonheur: 3 }),
      R(0.825, "Tu sors au deuxième tour, balayé par une paire d'as que tu n'avais pas vue venir. Le buffet est bon, c'est déjà ça.", -1, { bonheur: -3 }),
    ], { risk: 4, need: hasMoney(400) }),
    C("Parier sur un joueur que tu connais", "🎟️", [
      R(0.3, "Ton champion passe les tables une à une. Tu empoches ta part en jouant les indifférents.", 1.8, { bonheur: 4 }),
      R(0.7, "Ton champion sort au premier tour en jurant sur les dieux du tapis. Tu as eu l'élan, pas la chance.", -0.3, { bonheur: -1 }),
    ], { risk: 2, need: hasMoney(150) }),
    C("Se faire sponsoriser par un parrain", "🤝", [
      R(0.1, "Ton parrain te finance, tu gagnes, vous partagez. Il te proposera bientôt d'autres tournois, et d'autres conditions.", 5, { bonheur: 6, repute: 2, ambition: 1 }),
      R(0.4, "Tu perds, mais tu ne perds que la moitié. Le parrain te sourit froidement et demande des nouvelles dans l'année.", -0.4, { bonheur: -2 }),
      R(0.5, "Le parrain te reproche le résultat avec une politesse inquiétante. Tu lui dois un service.", -0.4, { bonheur: -3, honnete: -2 }),
    ], { risk: 3, need: hasMoney(60) }),
    D("Rester chez toi, ce soir c'est canapé", "🛋️", "Tu regardes le tournoi à la télé en commentant chaque main avec une assurance qui n'a jamais coûté un centime à personne.", { bonheur: 1 }, { risk: 0 }),
  ],
});

// ---------------- roulette ----------------
ev("casino_roulette", {
  chainOnly: true, once: false, tags: ["argent", "casino"], ic: "🎡", roll: { mise: miseOf(0.05, 50, 25000) },
  t: "La roulette tourne, la bille saute, un homme en smoking murmure « les jeux sont faits ». Tu disposes de $mise. Où poses-tu tes jetons ?",
  c: [
    C("Rouge ou noir, c'est simple", "🔴", [
      R(0.486, "La bille tombe de ton côté. Tu doubles ta mise et ton ego dans la même seconde.", 1, { bonheur: 3 }),
      R(0.514, "Zéro ou la mauvaise couleur, peu importe. La bille a choisi l'autre camp.", -1, { bonheur: -2 }),
    ], { risk: 2, need: hasMoney(60) }),
    C("Une douzaine de numéros", "🎯", [
      R(0.324, "Tu tombes dans ta douzaine. Le croupier te pousse un tas de jetons en souriant poliment.", 2, { bonheur: 4 }),
      R(0.676, "Rien ne tombe de ton côté. Tu observes la bille avec la rancune de quelqu'un qui vient d'être trahi.", -1, { bonheur: -2 }),
    ], { risk: 2, need: hasMoney(80) }),
    C("Un seul numéro, celui de ta date de naissance", "🍀", [
      R(0.027, "Ton numéro sort. Les jetons s'empilent, les voisins s'embrassent, tu cries très fort et très peu élégamment.", 35, { bonheur: 14, repute: 2, pub: "🎡 $nom gagne au numéro plein à la roulette, toute la salle se lève." }),
      R(0.973, "Le numéro ne sort pas. Il ne sort presque jamais, c'est même ce qui le rend si attirant.", -1, { bonheur: -2 }),
    ], { risk: 4, need: hasMoney(100) }),
    D("Jouer juste pour le spectacle", "🎡", "Tu poses un jeton, tu regardes la bille. Quelques minutes de pur bonheur pour trois fois rien, et tu rentres dormir comme un bébé.", { bonheur: 2 }, { risk: 0 }),
  ],
});

// ---------------- machines à sous ----------------
ev("casino_machines", {
  chainOnly: true, once: false, tags: ["argent", "casino"], ic: "🎰", roll: { mise: miseOf(0.02, 20, 2000, 10) },
  t: "Les machines à sous clignotent comme un sapin de Noël désorienté. Un seau de pièces à la main, tu as $mise à dépenser, et personne pour te dire de ne pas le faire.",
  c: [
    C("Jouer jusqu'au bout du seau", "🎰", [
      R(0.01, "Trois sept alignés. Les sirènes hurlent, les pièces débordent, un employé vient te féliciter avec un air qui dit « quelle journée ».", 40, { bonheur: 12, pub: "🎰 $nom touche le jackpot d'une machine à sous." }),
      R(0.1, "Un petit gain par ci, un petit gain par là. Tu repars avec plus de pièces que prévu et le dos en capilotade.", 1.5, { bonheur: 4 }),
      R(0.89, "Les pièces tombent une à une dans la machine avec un bruit de joie qui n'est pas pour toi.", -1, { bonheur: -2 }),
    ], { risk: 2, need: hasMoney(30) }),
    C("Changer de machine toutes les cinq minutes", "🔄", [
      R(0.12, "L'intuition marche, ou le hasard fait semblant. Tu gagnes un peu et tu t'en vantes pour la décennie.", 1, { bonheur: 3 }),
      R(0.88, "Chaque machine a son caractère, aucune n'a de cœur. Tu rentres plus léger.", -0.9, { bonheur: -2 }),
    ], { risk: 3, need: hasMoney(30) }),
    D("Te contenter d'un café et d'un sandwich au buffet", "☕", "Tu manges bien pour pas cher, tu discutes avec une dame qui connaît le prénom de chaque machine, et tu repars sans avoir joué un seul jeton.", { bonheur: 2, sociable: 1 }, { risk: 0 }),
  ],
});

// ---------------- salle privée ----------------
ev("casino_vip", {
  chainOnly: true, once: false, tags: ["argent", "casino", "luxe"], ic: "💎", roll: { mise: (p) => rnd50(Math.max(5000, p.cash * 0.04), 5000, 1500000, 1000) },
  t: "Une porte capitonnée s'ouvre sur la salle privée du casino. Des fauteuils en cuir, un baccara à mise élevée et des invités qui ne regardent jamais l'addition. Tu peux mettre $mise sur la table. Comment joues-tu ?",
  c: [
    C("Le baccara de la soirée", "💎", [
      R(0.49, "La main de la banque t'est favorable. Tu rafles le pot, tu refuses le champagne et tu le prends quand même.", 1, { bonheur: 5, repute: 1 }),
      R(0.51, "La carte qu'il fallait n'est pas venue. Tu hausses un sourcil pour la forme et tu fais signe qu'on remette ça.", -1, { bonheur: -3 }),
    ], { risk: 3, need: hasMoney(8000) }),
    C("Un duel de poker contre un magnat", "🕴️", [
      R(0.4, "Tu le bats. Il te fait livrer un cigare le lendemain, avec une carte de visite qui te veut du bien ou du mal.", 2.4, { bonheur: 8, repute: 3, ambition: 1, pub: "💎 $nom humilie un magnat au poker dans une salle privée." }),
      R(0.6, "Il te lit sans effort, avec la bienveillance du requin devant un petit poisson.", -1.5, { bonheur: -5, repute: -1 }),
    ], { risk: 4, need: { money: [15000, null], tr: { courage: [45, null] } } }),
    C("Mettre ton yacht dans la mise", "🛥️", [
      R(0.45, "Ton adversaire sue, tu souris, tu gagnes. Le yacht reste à toi, la mise de l'autre aussi.", 6, { bonheur: 12, repute: 6, pub: "🛥️ $nom met son yacht en jeu au casino et gagne la partie." }),
      O(0.55, "Tu perds la main. Le yacht change de propriétaire dès le lendemain matin. Tu prends l'avion, la tête haute et les poches vides.", { loseItem: "yacht", bonheur: -12, repute: -2, arc: { jeu: 1 }, pub: "🛥️ $nom perd son yacht à une table de jeu." }),
    ], { risk: 5, need: { asset: "yacht", money: [1000, null] } }),
    D("Refuser la salle et rester au bar", "🍸", "Tu bois un cocktail hors de prix au bar en saluant les gens qui comptent. C'est déjà un investissement, et il est cher.", { sociable: 2, repute: 1, bonheur: 2 }, { risk: 0 }),
  ],
});

// ---------------- paris sportifs ----------------
ev("paris_match", {
  chainOnly: true, once: false, tags: ["argent", "casino"], ic: "⚽", roll: { mise: miseOf(0.04, 20, 5000, 10) },
  t: "Un gros match approche. Les cotes défilent sur ton téléphone avec la douceur d'un vendeur de voitures. Tu es prêt à parier $mise. Sur quoi mises-tu ?",
  c: [
    C("Sur le favori, tranquillement", "🏟️", [
      R(0.55, "Le favori gagne comme prévu. Ton gain est mince mais régulier, comme une petite rente d'amateur.", 0.6, { bonheur: 3 }),
      R(0.45, "Le favori fait une erreur monumentale à la dernière minute. Tu pleures, tu rejoues le match dans ta tête.", -1, { bonheur: -3 }),
    ], { risk: 2, need: hasMoney(40) }),
    C("Sur l'outsider, pour le frisson", "🐴", [
      R(0.12, "L'outsider crée la surprise, la cote explose, tu hurles sur le canapé comme si tu avais joué toi-même.", 8, { bonheur: 9, repute: 1 }),
      R(0.88, "L'outsider fait ce que font les outsiders, il perd avec beaucoup de panache.", -1, { bonheur: -2 }),
    ], { risk: 4, need: hasMoney(40) }),
    C("Un pari combiné sur dix matchs", "🎫", [
      R(0.02, "Les dix matchs tombent. Dix. Tu n'y crois pas, ton ami non plus, le bookmaker pas du tout.", 45, { bonheur: 12, pub: "🎫 $nom réussit un pari combiné sur dix matchs, un seul sur des milliers." }),
      R(0.98, "Le troisième match ruine tout, les sept suivants ne comptent plus.", -1, { bonheur: -2 }),
    ], { risk: 4, need: hasMoney(40) }),
    D("Regarder le match sans parier", "📺", "Tu regardes le match avec tes amis, tu cries pour les bonnes raisons et tu ne dois rien à personne.", { sociable: 1, bonheur: 3 }, { risk: 0 }),
  ],
});

// ---------------- poker en ligne ----------------
ev("poker_ligne_scene", {
  chainOnly: true, once: false, tags: ["argent", "casino"], ic: "💻", roll: { mise: miseOf(0.03, 20, 3000, 10) },
  t: "La nuit est tombée, l'écran brille, et une table de poker en ligne t'attend avec ses avatars sans visage. Tu as décidé de ne jouer que $mise. Tu le crois sincèrement.",
  c: [
    C("Quelques mains tranquilles avant de dormir", "🌙", [
      R(0.45, "Tu gagnes quelques mains, tu éteins l'ordinateur, tu dors comme un loir.", 0.7, { bonheur: 2 }),
      R(0.55, "Tu perds peu, tu éteins tôt, tu t'en félicites un instant.", -0.6, { bonheur: -1 }),
    ], { risk: 2, need: hasMoney(30) }),
    C("Un marathon de tournois toute la nuit", "⏳", [
      R(0.04, "À l'aube, tu es en finale et tu gagnes. Tu pleures de fatigue devant un écran, vainqueur anonyme.", 14, { bonheur: 8, sante: -3, repute: 1 }),
      R(0.26, "Tu finis l'argent d'un tournoi et le sommeil de trois nuits.", 0.6, { bonheur: 1, sante: -4 }),
      R(0.7, "Tu perds, tu rejoues, tu perds encore. Le soleil se lève sur un homme au regard éteint.", -1.6, { bonheur: -5, sante: -4, prudent: -1 }),
    ], { risk: 4, need: hasMoney(60) }),
    D("Éteindre l'ordinateur et aller dormir", "😴", "Tu fermes l'écran, tu gardes ton argent et tu t'endors rapidement. La sagesse gagne parfois, sans gloire.", { sante: 2, prudent: 1, bonheur: 1 }, { risk: 0 }),
  ],
});

// ---------------- le casino qui revient trop souvent ----------------
ev("jeu_derapage", {
  once: false, cool: 8, rar: "peu", tags: ["argent", "casino"], ic: "🎲", ages: [20, 95],
  need: { noprison: true, fn: (p) => ((p.arcs && p.arcs.jeu) || 0) >= 5 },
  roll: { perte: (p) => rnd50(Math.max(300, p.cash * 0.25), 300, 600000, 100) },
  t: "Le casino est devenu un rendez-vous. Tu y vas après le travail, le week-end, parfois à la place des repas. Ton entourage commence à t'observer avec un air que tu n'aimes pas. Cette année, une soirée a coûté très cher, et tu dois décider ce que tu fais.",
  c: [
    D("Reconnaître le problème et demander de l'aide", "🛟", "Tu t'avoues vaincu devant un thérapeute qui ne juge pas. Tu t'interdis les casinos pour quelques années. L'effort est énorme, et ta vie t'en remercie.", { arcreset: "jeu", flag: { banni_casino: 6 }, bonheur: 4, prudent: 3, sante: 2 }, { risk: 0 }),
    C("Retourner jouer pour te refaire", "💥", [
      O(0.3, "Cette fois la chance revient d'un coup. Tu te refais, tu jures que c'est la dernière, tu ne le jures pas à tout le monde.", { gain: (p, x) => Math.round(x.vals.perte * 1.2), bonheur: 4, arc: { jeu: 1 } }),
      O(0.7, "Tu perds encore, et plus que prévu. Tu empruntes à un ami, puis à un autre, puis tu n'oses plus appeler.", { gain: (p, x) => -x.vals.perte, dette: (p, x) => Math.round(x.vals.perte * 0.4), bonheur: -9, sociable: -2, arc: { jeu: 1 }, later: { id: "jeu_creancier", in: [1, 3] } }),
    ], { risk: 5 }),
    D("Tout dire à ton entourage", "🫂", "Tu avoues tout à ceux qui comptent. C'est la pire conversation de ta vie et la plus utile. Ils ne te lâchent pas, et tu n'oses pas encore y croire.", { arc: { jeu: -3 }, bonheur: 2, sociable: 1, bonte: 1 }, { risk: 0 }),
  ],
});

// ---------------- une pause de jeu ----------------
ev("casino_pause", {
  chainOnly: true, once: false, tags: ["argent"], ic: "🌿",
  t: "Tu décides de lever le pied avec les jeux d'argent. Comment t'y prends-tu ?",
  c: [
    D("Supprimer les applications et les cartes de casino", "📵", "Tu supprimes tout, tu rends les cartes de membre et tu respires un peu mieux. Quelques mois plus tard tu es presque fier de toi.", { arc: { jeu: -3 }, bonheur: 2, prudent: 2 }),
    D("Remplacer le jeu par un vrai loisir", "🎸", "Tu te lances dans un nouveau loisir. Tu y passes les soirées qui t'étaient devenues dangereuses, et tu te surprends à y prendre goût.", { arc: { jeu: -2 }, bonheur: 3, creatif: 1, sante: 1 }),
  ],
});

// ---------------- les événements de casino ----------------
ev("casino_croupier_ami", {
  once: false, cool: 10, rar: "peu", tags: ["casino"], ic: "🤵", ages: [21, 90], need: { noprison: true, fn: (p) => ((p.arcs && p.arcs.jeu) || 0) >= 2 && !((p.flags && p.flags.banni_casino) > 0) },
  t: "Un croupier te reconnaît à l'entrée, te salue par ton prénom et te glisse une confidence sur une table qui ne perd jamais. Tu ne sais pas s'il faut le croire.",
  c: [
    D("Suivre son conseil", "🎰", "Tu joues la table indiquée. Elle te rend la petite monnaie, puis plus rien, comme tous les secrets de croupier.", { gain: (p) => -Math.min(Math.floor(p.cash * 0.02), 800), arc: { jeu: 1 }, bonheur: -1 }),
    D("Le remercier sans rien faire", "🙏", "Tu le remercies, tu gardes ton argent. Le croupier t'a trouvé sympathique, et un jour il te le rendra d'une autre manière.", { sociable: 1, bonheur: 1, prudent: 1 }),
  ],
});

// ============================================================
// Grands tournants de la mise à jour finale. Scandales qui durent des années, rivalités et alliances d'affaires,
// transmission d'un héritage, cercles d'influence et événements très rares.
// ============================================================
{
// Grands tournants de la mise à jour finale. Scandales qui durent des années, rivalités et alliances d'affaires,
// transmission d'un héritage, cercles d'influence et événements très rares. Chaque choix laisse des traces plus tard dans la vie.
const { ev, O, C, D } = require("../kit");

const pc = (f, cap) => (p) => Math.round(Math.min(cap || 1e12, Math.max(0, p.cash) * f));
const lose = (f, cap) => (p) => -pc(f, cap)(p);

// ======================================================
// 1. LE SCANDALE QUI SUIT TA FORTUNE
// ======================================================
ev("scandale_fortune", {
  ages: [30, 90], tags: ["social", "argent"], ic: "🗞️", once: false, cool: 14, rar: "peu", need: { net: [120000, null], noprison: true },
  t: "Un journal d'investigation s'intéresse à l'origine de ta fortune. Des documents circulent, des anciens collaborateurs parlent, et ton nom s'étale sur trois colonnes. Que fais-tu face à la presse ?",
  c: [
    D("Tout expliquer avec transparence", "🔦", "Tu ouvres tes comptes et tu réponds à chaque question. Les premiers jours sont rudes, mais le soupçon se dégonfle peu à peu.", { repute: -3, honnete: 3, bonheur: -2, flag: { sous_les_feux: 3 }, later: { id: "scandale_apaisement", in: [2, 4] } }),
    C("Payer cher pour étouffer l'affaire", "💼", [
      O(0.55, "L'argent fait taire les uns et dormir les autres. Le dossier disparaît des unes. Ton conseiller envoie une facture qui fait peur.", { argent: lose(0.05, 400000), repute: -1, honnete: -3, flag: { sous_les_feux: 5 }, later: { id: "scandale_fuite", in: [3, 6], p: 0.7 } }),
      O(0.45, "Un journaliste refuse l'offre et publie tout, avec en prime l'histoire du pot-de-vin refusé.", { argent: lose(0.05, 400000), repute: -9, honnete: -3, bonheur: -6, flag: { sous_les_feux: 6 }, later: { id: "scandale_fuite", in: [1, 3] } }),
    ], { risk: 3 }),
    C("Contre-attaquer en justice", "⚖️", [
      O(0.45, "Le tribunal te donne raison et le journal publie un rectificatif discret. Les lecteurs, eux, retiennent surtout le premier titre.", { argent: lose(0.02, 150000), repute: 2, bonheur: 2, flag: { sous_les_feux: 2 } }),
      O(0.55, "Le procès s'éternise et chaque audience relance l'affaire. Tu perds en argent et en sommeil.", { argent: lose(0.06, 400000), repute: -6, bonheur: -6, flag: { sous_les_feux: 5 }, later: { id: "scandale_apaisement", in: [3, 5] } }),
    ], { risk: 3 }),
    D("Disparaître à l'étranger quelques années", "🏝️", "Tu t'installes au soleil, loin des micros. L'affaire s'oublie, ton réseau aussi, et ton retour sera un événement.", { city: true, repute: -2, bonheur: 1, flag: { sous_les_feux: 4 }, later: { id: "scandale_retour", in: [4, 7] } }),
  ],
});
ev("scandale_apaisement", {
  chainOnly: true, tags: ["social"], ic: "🕊️",
  t: "Le scandale appartient désormais au passé. Un magazine te propose de raconter ta version, calmement, des années après.",
  c: [
    D("Accepter et parler franchement", "🎙️", "Ton récit touche, parce qu'il est honnête. On te regarde enfin autrement.", { repute: 6, honnete: 2, bonheur: 3, unflag: "sous_les_feux" }),
    D("Refuser, la page est tournée", "🚪", "Tu laisses l'histoire dormir. Elle ne sera jamais tout à fait oubliée, mais elle ne te poursuit plus.", { repute: 2, bonheur: 1, unflag: "sous_les_feux" }),
  ],
});
ev("scandale_fuite", {
  chainOnly: true, tags: ["social", "argent"], ic: "📂",
  t: "Un ancien employé, mécontent, ressort les documents de l'affaire étouffée. Cette fois, il y a des preuves et des dates.",
  c: [
    C("Reconnaître les faits et payer", "🧾", [
      O(0.7, "Tu paies, tu t'excuses, tu te fais tout petit. La sanction est lourde mais ton nom ne disparaît pas.", { argent: lose(0.08, 600000), repute: -4, honnete: 3, bonheur: -3, unflag: "sous_les_feux" }),
      O(0.3, "Les autorités ouvrent une enquête. Tu évites la prison de justesse, au prix d'une très lourde amende.", { argent: lose(0.15, 1500000), repute: -8, bonheur: -8, record: 1, unflag: "sous_les_feux" }),
    ], { risk: 3 }),
    D("Nier en bloc", "🙅", "Tu nies, encore et encore. Personne ne te croit vraiment, et tout le monde fait semblant de te croire.", { repute: -8, honnete: -3, bonheur: -4, flag: { sous_les_feux: 6 } }),
  ],
});
ev("scandale_retour", {
  chainOnly: true, tags: ["social"], ic: "✈️",
  t: "Tu rentres après des années d'absence. La presse t'attend à l'aéroport, curieuse et moqueuse. Ton retour est une petite affaire nationale.",
  c: [
    D("Faire un retour fracassant", "🎺", "Tu donnes une conférence de presse très préparée et très drôle. Le public rit, le scandale s'efface sous les applaudissements.", { repute: 5, bonheur: 4, unflag: "sous_les_feux", pub: "✈️ $nom revient après des années d'exil et reprend sa place." }),
    D("Rentrer discrètement", "🌙", "Tu rentres par la porte de service, sans bruit. Tu retrouves une vie plus calme et un peu plus étroite.", { repute: 1, bonheur: 1, unflag: "sous_les_feux" }),
  ],
});

// ======================================================
// 2. RIVALITÉS ET ALLIANCES D'AFFAIRES
// ======================================================
ev("rival_affaires_debut", {
  ages: [25, 70], tags: ["travail", "social"], ic: "🥊", once: false, cool: 10, rar: "peu", need: { nostudy: true, noprison: true, fn: (p) => !!p.job || p.assets.some((a) => a.kind === "entreprise") },
  who: { rival: "rival" },
  t: "Un nouveau venu, $rival, s'installe dans ton milieu avec un grand sourire et de grandes ambitions. Il vise tes clients, tes contacts et peut-être ta place. Comment réagis-tu ?",
  c: [
    D("Le défier ouvertement", "🥊", "Tu annonces la couleur, il relève le gant. L'ambiance s'électrise, ton équipe aussi.", { ambition: 2, courage: 2, arc: { rivalite: 2 }, later: { id: "rival_affaires_guerre", in: [2, 4], keep: true } }),
    D("Lui proposer de s'associer", "🤝", "Tu tends la main avant qu'il ne lève le poing. Il hésite, puis accepte avec un sourire de joueur d'échecs.", { sociable: 2, arc: { alliance: 1 }, later: { id: "alliance_affaires_fruit", in: [2, 4], keep: true } }),
    D("L'ignorer et travailler", "🧘", "Tu laisses les rumeurs filer et tu te concentres sur ton travail. Il avance dans ton ombre, ou devant toi.", { prudent: 2, later: { id: "rival_affaires_ombre", in: [2, 5], keep: true } }),
    D("Le fragiliser en coulisses", "🕳️", "Tu parles à quelques personnes, tu glisses quelques doutes. Il ne saura jamais d'où ça vient, pense-t-on.", { honnete: -3, ambition: 1, pro: { heat: 3 }, arc: { rivalite: 1 }, later: { id: "rival_affaires_guerre", in: [1, 3], keep: true } }),
  ],
});
ev("rival_affaires_guerre", {
  chainOnly: true, tags: ["travail"], ic: "⚔️", who: { rival: "rival" },
  t: "La rivalité avec $rival a pris des proportions. Des clients choisissent un camp, les collègues aussi, et tout le monde parie sur toi, ou contre.",
  c: [
    C("Livrer bataille jusqu'au bout", "⚔️", [
      O(0.5, "Tu l'emportes. $rival quitte le milieu avec sa dignité et tes félicitations contraintes. Tes clients te regardent avec respect.", { argent: pc(0.06, 200000), repute: 5, ambition: 2, pro: { rep: 6, net: 3 }, arcreset: "rivalite" }),
      O(0.5, "Tu perds la bataille. $rival t'enlève deux gros clients et un peu de ta réputation, mais pas de ta détermination.", { argent: lose(0.05, 150000), repute: -4, bonheur: -4, pro: { rep: -3 }, arcreset: "rivalite" }),
    ], { risk: 3 }),
    D("Demander la paix et un partage du terrain", "🕊️", "Vous vous asseyez à la même table. Deux heures et trois cafés plus tard, vous êtes presque amis.", { bonte: 2, sociable: 2, bonheur: 2, arcreset: "rivalite", later: { id: "alliance_affaires_fruit", in: [2, 4], keep: true } }),
    D("Passer à autre chose et changer de métier ou de ville", "🧳", "Tu laisses le champ de bataille à qui le veut. La vie ailleurs est un peu plus douce.", { city: true, bonheur: 2, arcreset: "rivalite", repute: -1 }),
  ],
});
ev("rival_affaires_ombre", {
  chainOnly: true, tags: ["travail"], ic: "🌓", who: { rival: "rival" },
  t: "$rival a grimpé les échelons sans bruit. Aujourd'hui, c'est lui que l'on consulte à ta place, et il t'invite à déjeuner avec une politesse inquiétante.",
  c: [
    D("Accepter et apprendre de lui", "🍽️", "Tu découvres pourquoi il réussit. Sa méthode est simple, discrète et redoutable. Tu en prends une partie.", { intel: 2, ambition: 1, pro: { skill: 5, net: 3 }, bonheur: 1 }),
    D("Refuser et renforcer ta position", "🛡️", "Tu redoubles d'efforts et tu soignes ton réseau. Ton rival le sent et ralentit un peu.", { ambition: 2, pro: { rep: 3, net: 2 }, bonheur: -1 }),
  ],
});
ev("alliance_affaires_fruit", {
  chainOnly: true, tags: ["travail", "argent"], ic: "🤝", who: { rival: "rival" },
  t: "L'alliance avec $rival porte ses fruits. Vous avez monté ensemble une petite affaire, qui grandit plus vite que prévu et que personne d'autre n'aurait osé lancer.",
  c: [
    D("Fonder une société commune", "🏢", "Vous signez chez le notaire, côte à côte. La société rapporte régulièrement et vos noms apparaissent sur la plaque.", { item: (p) => ({ kind: "entreprise", name: "Société commune", value: Math.round(45000 + Math.max(0, p.cash) * 0.15), income: Math.round(5000 + Math.max(0, p.cash) * 0.02) }), pro: { net: 8, rep: 4 }, ambition: 2, sociable: 2, repute: 2, arc: { alliance: 1 } }),
    D("Rester amis, sans papier", "🥂", "Vous gardez votre liberté et un respect tranquille. Chacun saura qui appeler le jour où ça compte.", { pro: { net: 6 }, sociable: 2, bonheur: 3 }),
  ],
});

// ======================================================
// 3. LE TESTAMENT, CE QUE TU LAISSES
// ======================================================
ev("legs_reflexion", {
  ages: [60, 95], tags: ["argent", "famille"], ic: "📜", once: false, cool: 12, rar: "peu", need: { noprison: true, net: [120000, null] },
  t: "Tu as passé l'âge où l'on croit qu'on a le temps. Un notaire pose un dossier sur la table et demande avec douceur ce que tu veux laisser derrière toi. Que décides-tu ?",
  c: [
    D("Tout léguer à ta famille", "👨‍👩‍👧", "Tu rédiges un testament simple et tu prépares chacun à la suite. Tes proches te remercient, et certains en pleurent.", { bonheur: 6, bonte: 3, repute: 1 }, { need: { rel: "family" } }),
    D("Créer une fondation à ton nom", "🏛️", "Tu consacres une grande part de ta fortune à une cause qui te survivra. Ton nom restera sur une plaque et dans de petits cœurs.", { argent: lose(0.3, 20000000), repute: 12, bonte: 4, bonheur: 5, badge: "fondation", pub: "🏛️ $nom consacre une partie de sa fortune à une fondation durable." }, { need: { net: [400000, null] } }),
    D("Tout dépenser avant de partir", "🥂", "Tu offres des voyages, des fêtes et des cadeaux à ceux que tu aimes. Le notaire sourit en essayant de ne pas le montrer.", { argent: lose(0.45, 8000000), bonheur: 9, sociable: 3, repute: 2 }),
    D("Un testament plein de surprises", "🎭", "Tu écris des consignes bizarres et des légataires inattendus. À ton enterrement, personne ne s'ennuiera.", { bonheur: 4, creatif: 3, repute: 3, pub: "🎭 $nom prépare un testament qui fera parler." }),
  ],
});

// ======================================================
// 4. LE CERCLE DES GENS INFLUENTS
// ======================================================
ev("cercle_influence", {
  ages: [35, 80], tags: ["social", "travail"], ic: "🎩", once: false, cool: 12, rar: "peu", need: { noprison: true, fn: (p) => p.stats.repute >= 62 || (p.pro && p.pro.net >= 40) || require("../core").netWorth(p) >= 400000 },
  t: "Une enveloppe crème arrive chez toi. Un cercle très fermé d'hommes et de femmes de pouvoir t'invite à dîner, et le dîner ne se refuse pas vraiment. Que fais-tu ?",
  c: [
    D("Rejoindre le cercle", "🎩", "Tu es accueilli avec une chaleur calculée. Les portes s'ouvrent, les services se rendent, et chaque faveur te coûtera un jour.", { argent: lose(0.01, 30000), pro: { net: 12, rep: 4 }, repute: 3, honnete: -1, ambition: 2, arc: { cercle: 1 } }),
    C("Y aller en simple observateur", "🧐", [
      O(0.7, "Tu écoutes, tu retiens, tu repars avec des noms et la paix de l'esprit. Tu n'as rien promis à personne.", { pro: { net: 5 }, intel: 1, bonheur: 1 }),
      O(0.3, "Tu es démasqué en cinq minutes. L'ambiance se refroidit, et plusieurs portes ne s'ouvriront plus.", { pro: { net: -3 }, repute: -2, bonheur: -2 }),
    ], { risk: 2 }),
    D("Décliner poliment", "🙏", "Tu t'excuses avec élégance. L'hôte sourit, note ton nom et ne t'inquiétera plus.", { prudent: 2, honnete: 1, bonheur: 2 }),
  ],
});

// ======================================================
// 5. LE CRÉANCIER QUI N'OUBLIE PAS
// ======================================================
ev("jeu_creancier", {
  chainOnly: true, tags: ["argent", "casino"], ic: "📞", once: false,
  t: "Un homme poli t'attend à la sortie du travail. Il parle de ta dette de jeu, du temps qui passe, et d'un arrangement amiable qui n'en a que le nom.",
  c: [
    C("Payer ce que tu dois", "💶", [
      O(0.8, "Tu règles tout, jusqu'au dernier centime. La dette disparaît, et l'envie de jouer aussi, pour un temps.", { argent: lose(0.15, 300000), bonheur: 2, prudent: 3, arc: { jeu: -2 } }),
      O(0.2, "Tu paies, mais l'homme revient avec un nouveau chiffre. Il y a toujours un nouveau chiffre.", { argent: lose(0.3, 600000), bonheur: -6, prudent: 2, arc: { jeu: -1 } }),
    ], { risk: 2 }),
    D("Prévenir la police", "🚔", "Tu déposes plainte et tu changes de numéro. Les semaines suivantes sont tendues, mais la menace s'éloigne.", { courage: 2, honnete: 2, bonheur: -2, arc: { jeu: -2 } }),
    D("Fuir en changeant de ville", "🚪", "Tu pars en pleine nuit avec une valise. Le nouveau départ est dur, mais il est un départ.", { city: true, bonheur: -3, prudent: 1, arc: { jeu: -1 } }),
  ],
});

// ======================================================
// 6. LES ÉVÉNEMENTS TRÈS RARES
// ======================================================
ev("rare_mecene_anonyme", {
  ages: [22, 80], tags: ["argent"], ic: "💌", rar: "rare", once: false, cool: 25, need: { noprison: true },
  t: "Un courrier recommandé t'annonce qu'un mécène anonyme souhaite soutenir ton parcours. Il joint un chèque, une lettre et aucune explication.",
  c: [
    D("Accepter avec reconnaissance", "🙏", "Tu encaisses et tu travailles deux fois plus. Ta vie prend un virage, et tu ne sauras jamais qui t'a tendu la main.", { gain: (p) => Math.round(18000 + Math.max(0, p.cash) * 0.08), bonheur: 8, bonte: 2, ambition: 2, pub: "💌 $nom reçoit l'aide d'un mécène anonyme." }),
    D("Enquêter sur l'identité du mécène", "🔎", "Tu finis par apprendre le nom, et l'histoire derrière. Elle est plus belle que prévu, et plus triste.", { gain: 12000, intel: 1, bonheur: 4, meet: ["mentor"] }),
    D("Refuser, on ne sait jamais", "🚫", "Tu renvoies le chèque. Tu resteras avec un doute et une fierté toute neuve.", { prudent: 2, honnete: 2, bonheur: -1 }),
  ],
});
ev("rare_video_virale", {
  ages: [14, 60], tags: ["social"], ic: "📱", rar: "rare", once: false, cool: 20, need: { noprison: true },
  t: "Une vidéo de toi, tournée par hasard par un inconnu, devient virale en une nuit. Des millions de gens te regardent faire exactement ce que tu faisais, très mal.",
  c: [
    C("Surfer sur la vague", "🏄", [
      O(0.55, "Tu enchaînes les invitations, les parrainages et les photos. Pendant un an, tout te réussit, puis la vague retombe doucement.", { gain: 25000, repute: 8, charme: 3, bonheur: 5, pub: "📱 $nom devient célèbre grâce à une vidéo virale." }),
      O(0.45, "La vague te porte puis te lâche brutalement. Tu restes le garçon ou la fille de la vidéo pendant des années.", { gain: 6000, repute: 2, bonheur: -3 }),
    ], { risk: 2 }),
    D("Disparaître des réseaux", "🫥", "Tu supprimes tout, tu fermes ton compte et tu changes d'adresse. La rumeur finit par s'éteindre, et toi tu respires.", { bonheur: 2, prudent: 2 }),
    D("En faire un métier", "🎬", "Tu transformes un accident en carrière. La chaîne grandit, les contrats arrivent et tu apprends un métier inattendu.", { gain: 9000, creatif: 3, sociable: 2, repute: 4, pro: { net: 4 } }),
  ],
});
ev("rare_ile_milliardaire", {
  ages: [30, 85], tags: ["luxe", "social"], ic: "🏝️", rar: "mythique", once: false, cool: 30, need: { noprison: true, net: [600000, null] },
  t: "Un milliardaire que tu n'as jamais rencontré t'invite sur son île privée pour un week-end. Les autres invités sont tous célèbres, et il refuse de dire pourquoi toi.",
  c: [
    C("Accepter l'invitation", "🛩️", [
      O(0.45, "Le week-end est un rêve. Tu repars avec trois alliés, deux associés et le numéro d'un chef étoilé.", { pro: { net: 14, rep: 6 }, repute: 5, bonheur: 8, sociable: 3, meet: ["mentor"], pub: "🏝️ $nom passe un week-end très remarqué sur l'île d'un milliardaire." }),
      O(0.3, "Les photos du week-end fuient dans la presse. L'ambiance était moins élégante que prévu, et ton nom est sur chaque légende.", { repute: -6, bonheur: -3, flag: { sous_les_feux: 4 }, later: { id: "scandale_apaisement", in: [2, 4] } }),
      O(0.25, "Tu passes un excellent week-end et personne n'en parle jamais. Tu ne sauras pas ce qu'on attendait de toi, mais on t'invitera encore.", { bonheur: 5, repute: 1, pro: { net: 6 } }),
    ], { risk: 3 }),
    D("Décliner", "🛑", "Tu regardes l'invitation longtemps, puis tu réponds non. Ta vie reste exactement la même, et tu te le demanderas parfois.", { prudent: 3, honnete: 1, bonheur: 1 }),
  ],
});
ev("rare_double_inconnu", {
  ages: [20, 85], tags: ["social"], ic: "🪞", rar: "mythique", once: false, cool: 30, need: { noprison: true },
  t: "Un homme ou une femme qui te ressemble comme deux gouttes d'eau te salue dans la rue. Il ou elle sait ton prénom, ton quartier et ta date de naissance, et affirme qu'il ne s'agit pas d'un hasard.",
  c: [
    D("Le suivre jusqu'à son café", "☕", "Vous parlez pendant des heures. Vous n'êtes pas parents, mais l'histoire est tellement étrange que vous restez amis pour la vie.", { bonheur: 6, sociable: 2, creatif: 2, meet: ["friend"], pub: "🪞 $nom croise son sosie parfait et devient son ami." }),
    D("Prendre la fuite", "🏃", "Tu t'éloignes d'un pas rapide. Tu te retournes cent fois. Tu penseras à cette rencontre pour le restant de tes jours.", { bonheur: -1, prudent: 2 }),
    D("Raconter l'histoire à la presse", "📰", "Le récit fait le tour du pays. Ton sosie démentira, puis confirmera, puis démentira encore.", { gain: 4000, repute: 4, honnete: -1, bonheur: 2 }),
  ],
});
ev("rare_trahison_associe", {
  ages: [28, 75], tags: ["argent", "travail"], ic: "🕳️", rar: "rare", once: false, cool: 20, need: { noprison: true, asset: "entreprise" },
  t: "Ton associé disparaît un matin avec une partie de la caisse. Le téléphone ne répond plus, la banque t'écrit, et ton comptable te regarde avec pitié.",
  c: [
    C("Le retrouver à tout prix", "🕵️", [
      O(0.35, "Tu le retrouves dans un petit port, un cocktail à la main. Il rend une grande partie de l'argent, et ne te regarde pas dans les yeux.", { gain: (p) => Math.round(Math.min(120000, Math.max(5000, p.cash * 0.05))), repute: 2, bonheur: 2 }),
      O(0.65, "Tu perds des mois et de l'argent à le chercher. Il reste introuvable, et tu apprends à ne plus faire confiance au premier sourire.", { argent: lose(0.04, 100000), bonheur: -6, prudent: 3 }),
    ], { risk: 3 }),
    D("Réparer et repartir de plus belle", "🔧", "Tu serres les dents, tu renégocies, tu travailles la nuit. Ton entreprise survit, et elle est plus solide qu'avant.", { argent: lose(0.03, 80000), ambition: 3, courage: 2, bonheur: -3, pro: { skill: 4, rep: 2 } }),
    D("Porter plainte et laisser la justice faire", "⚖️", "Tu laisses la justice avancer à son rythme. Le jugement arrive quatre ans plus tard, et une partie de l'argent aussi.", { bonheur: -2, honnete: 2, later: { id: "rare_trahison_justice", in: [3, 5] } }),
  ],
});
ev("rare_trahison_justice", {
  chainOnly: true, tags: ["argent"], ic: "🏛️",
  t: "Le tribunal rend enfin son jugement dans l'affaire de ton ancien associé. Une partie de ce qui a disparu doit te revenir.",
  c: [D("Récupérer ce qui est dû", "💶", "Tu reçois un chèque et une lettre d'excuses. Tu as perdu des années, mais pas ton honneur.", { gain: (p) => Math.round(Math.min(150000, Math.max(8000, p.cash * 0.06))), honnete: 2, bonheur: 4, repute: 2 })],
});
ev("rare_sauvetage_inconnu", {
  ages: [12, 90], tags: ["social"], ic: "🛟", rar: "rare", once: false, cool: 20, need: { noprison: true },
  t: "Un inconnu te sauve la vie d'un geste, sans réfléchir, avant de disparaître dans la foule. Tu retiens son visage, son manteau rouge et un détail que lui seul pourrait confirmer.",
  c: [
    D("Le chercher partout", "🔍", "Tu le retrouves au bout de plusieurs mois. Il t'explique que ce n'était rien, et tu lui dis que c'était tout. Vous restez en contact.", { bonheur: 8, bonte: 3, sociable: 2, meet: ["friend"], pub: "🛟 $nom retrouve l'inconnu qui lui a sauvé la vie." }),
    D("Faire un don anonyme à une association de secours", "💝", "Tu paies pour que d'autres soient sauvés. Ton geste restera anonyme, ce qui lui donne encore plus de sens.", { argent: lose(0.01, 20000), bonte: 4, bonheur: 5 }),
    D("Tourner la page", "📖", "Tu ranges l'histoire dans un coin de ta mémoire. Parfois elle revient, la nuit, avec la couleur d'un manteau.", { bonheur: 2, prudent: 1 }),
  ],
});
}

module.exports = {};

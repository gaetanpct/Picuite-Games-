// Les carrefours de vie. Des décisions qui changent vraiment la suite (couple, métier, argent, famille, justice).
// Elles sont marquées key, donc le mode cinq ans par cinq ans les propose en priorité.
const { ev, O, C, D } = require("../kit");

const cash = (f, cap) => (p) => Math.round(Math.min(cap || 1e12, Math.max(0, p.cash) * f));
const lose = (f, cap) => (p) => -cash(f, cap)(p);
const solo = (id, spec) => ev(id, Object.assign({ key: true, once: false, cool: 12, w: 7, tags: ["carrefour"] }, spec));

// ===================== enfance et adolescence =====================
solo("cf_famille_demenage", {
  ages: [8, 16], ic: "📦", once: true, who: { bestfriend: "bestfriend", mere: "mere", pere: "pere" },
  t: "Tes parents annoncent un grand changement. Un nouveau travail les envoie à l'autre bout du pays. Il faudrait quitter l'école, les amis et la rue que tu connais par cœur.",
  c: [
    D("Suivre la famille sans râler", "🚚", "Tu fais tes cartons. Le début est difficile, puis une nouvelle bande t'adopte. Tu apprends à t'adapter vite.", { city: true, sociable: 3, bonheur: -2, rel: { bestfriend: -25 } }),
    C("Négocier pour rester chez un proche", "🏠", [
      O(0.45, "Ta tante accepte de t'héberger. Tu gardes tes amis, ta famille te manque, et tu grandis plus vite que prévu.", { bonheur: 2, courage: 3, rel: { mere: -12, pere: -12 } }),
      O(0.55, "Tes parents refusent net. Tu pars quand même, un peu fâché(e), avec la conviction qu'on ne t'écoute pas.", { city: true, bonheur: -5, rel: { mere: -5, pere: -5, bestfriend: -25 } }),
    ]),
    D("Faire de la ville d'arrivée un terrain de jeu", "🗺️", "Tu transformes le déménagement en aventure. Tu explores chaque quartier, tu te fais des amis sur le chemin, et tu gardes le contact avec les anciens.", { city: true, creatif: 3, sociable: 2, bonheur: 1 }),
  ],
});

solo("cf_parents_separent", {
  ages: [8, 17], ic: "💔", once: true, need: { rel: "mere" },
  who: { mere: "mere", pere: "pere" },
  t: "Tes parents s'assoient avec toi dans le salon. Leur voix est douce et leurs yeux sont rouges. Ils se séparent, et ils veulent savoir avec qui tu aimerais vivre.",
  c: [
    D("Rester chez ta mère", "👩", "Tu choisis ta mère. Ton père comprend, ou fait semblant, et vos week-ends deviennent précieux.", { rel: { mere: 14, pere: -8 }, bonheur: -3 }),
    D("Rester chez ton père", "👨", "Tu choisis ton père. Ta mère encaisse en silence et vous gardez un lien fragile mais sincère.", { rel: { pere: 14, mere: -8 }, bonheur: -3 }),
    D("Refuser de choisir et alterner", "⚖️", "Tu demandes une semaine chez l'un, une semaine chez l'autre. C'est fatigant, mais personne n'a l'impression d'avoir perdu.", { rel: { pere: 4, mere: 4 }, sante: -2, bonheur: -2, prudent: 2 }),
    D("Faire de ton mieux pour les réconcilier", "🧩", "Tu joues les médiateurs pendant des mois. Ils ne se remettent pas ensemble, mais ils restent en bons termes. Tu en sors épuisé(e) et mûr(e).", { bonte: 3, bonheur: -4, rel: { pere: 3, mere: 3 }, flag: "mediateur" }),
  ],
});

solo("cf_harcelement", {
  ages: [9, 16], ic: "🏫", cool: 15, who: { bestfriend: "bestfriend" },
  t: "Depuis des semaines, un groupe de l'école te rend la vie impossible. Moqueries, sacs cachés, silences dans les couloirs. Aujourd'hui, cela devient trop lourd à porter.",
  c: [
    C("Tout dire à un adulte", "📣", [
      O(0.7, "L'école réagit sérieusement. Le groupe est sanctionné et l'ambiance change. Tu comprends qu'on peut demander de l'aide sans honte.", { bonheur: 4, bonte: 2, repute: 2 }),
      O(0.3, "L'adulte minimise. Tu te sens encore plus seul(e), et les moqueries reprennent de plus belle.", { bonheur: -6, repute: -3 }),
    ]),
    C("Leur tenir tête", "🛡️", [
      O(0.5, "Tu les regardes dans les yeux et tu parles calmement. Ils reculent, surpris. Ton assurance change tout.", { courage: 5, repute: 4, bonheur: 3 }),
      O(0.5, "Ça dégénère en bagarre devant tout le monde. Tu es puni(e) comme eux et tu te sens injustement traité(e).", { courage: 2, sante: -4, repute: -4, bonheur: -3 }),
    ], { risk: 1 }),
    D("Changer d'école", "🚪", "Tes parents t'inscrivent ailleurs. Tout est neuf, tu repars de zéro, et personne ne connaît ton histoire.", { city: true, bonheur: 3, courage: 1, rel: { bestfriend: -30 } }),
    D("Te replier sur tes passions", "🎧", "Tu te protèges derrière tes livres, tes jeux et ton imagination. Cela te nourrit, mais cela te coupe un peu des autres.", { creatif: 4, intel: 2, sociable: -4, bonheur: -2 }),
  ],
});

solo("cf_mauvaise_bande", {
  ages: [13, 19], ic: "🕴️", tags: ["carrefour", "mature"], who: { mere: "mere", pere: "pere" },
  t: "Un groupe plus âgé t'invite à traîner avec eux. Ils sont drôles, ils ont de l'argent de poche mystérieux, et ils te trouvent « différent(e) des autres ». Ils attendent une réponse.",
  c: [
    C("Entrer dans la bande", "🔥", [
      O(0.45, "Tu fais des petits coups avec eux. L'argent rentre, l'adrénaline aussi, et ta réputation de fréquentable s'effrite.", { argent: 600, courage: 3, honnete: -4, repute: -4, flag: "milieu_contact", record: 0 }),
      O(0.35, "Un coup tourne mal. La police vous cueille, ce sera une première ligne sur ton casier.", { record: 1, honnete: -3, repute: -8, bonheur: -6, rel: { mere: -15, pere: -15 }, flag: "milieu_contact" }),
      O(0.2, "Tu t'ennuies vite, tu t'éloignes et tu gardes quelques bons souvenirs sans dégâts.", { courage: 2, sociable: 2 }),
    ], { risk: 2 }),
    D("Refuser poliment", "🙅", "Tu déclines avec un sourire. Ils haussent les épaules. Tu perds une occasion de t'imposer, mais tu gardes ton chemin.", { prudent: 3, honnete: 2 }),
    D("En parler à tes parents", "👪", "Tes parents te remercient de ta confiance, puis ils se renseignent. La bande est surveillée et toi aussi, avec bienveillance.", { rel: { mere: 8, pere: 8 }, bonte: 1, bonheur: 1 }),
  ],
});

// ===================== vie d'adulte =====================
solo("cf_offre_etranger", {
  ages: [22, 52], ic: "🌍", need: { job: true }, w: 8, who: { bestfriend: "bestfriend", mere: "mere", pere: "pere" },
  t: "Ton entreprise te propose un poste à l'étranger, mieux payé et plus prestigieux. Il faut partir dans trois mois, et ta vie actuelle ne rentrera pas dans une valise.",
  c: [
    C("Accepter et partir", "✈️", [
      O(0.6, "L'aventure est à la hauteur. Tu progresses vite, tu découvres un autre monde, mais les liens d'avant s'étirent.", { promote: true, city: true, ambition: 3, argent: 2500, bonheur: 3, rel: { bestfriend: -20, mere: -8, pere: -8 } }),
      O(0.4, "L'ambiance est difficile et la solitude pèse. Tu tiens un an puis tu rentres, un peu plus fort(e).", { city: true, bonheur: -4, courage: 3, argent: 1200 }),
    ]),
    D("Refuser pour garder ta vie", "🏡", "Tu reste auprès des tiens. Ton patron note ton manque de mobilité, mais tes liens se renforcent.", { bonheur: 3, ambition: -2, rel: { bestfriend: 6, mere: 4, pere: 4 } }),
    C("Négocier un compromis", "🤝", [
      O(0.45, "Tu obtiens un détachement de deux ans avec retour garanti. Le meilleur des deux mondes, pour une fois.", { promote: true, argent: 1500, bonheur: 2, ambition: 2 }),
      O(0.55, "L'entreprise refuse et se vexe. Ton dossier prend un petit coup.", { repute: -3, bonheur: -2 }),
    ]),
  ],
});

solo("cf_creer_entreprise", {
  ages: [24, 58], ic: "🚀", need: { job: true, money: [8000, null] }, w: 6,
  t: "Depuis des mois, une idée te trotte dans la tête. Une vraie entreprise à toi, ton nom sur la porte, toutes les nuits blanches qui vont avec. Un ancien collègue te propose de te lancer ensemble.",
  c: [
    D("Démissionner et se lancer", "🚀", "Tu claques la porte de ton emploi et tu plonges. Il faudra choisir un secteur, tenir les premiers mois et croire à ton étoile.", { quit: true, forced: ["sys:startup"], courage: 3, ambition: 3, bonheur: 2 }),
    C("Lancer l'activité le soir et le week-end", "🌙", [
      O(0.5, "Ça démarre doucement. Tu dors peu, mais tu gardes ton salaire et tes premiers clients arrivent.", { argent: 3000, sante: -4, ambition: 2, bonheur: 1 }),
      O(0.5, "Fatigue et dispersion. Ton emploi en souffre et ton activité n'avance pas vraiment.", { sante: -6, bonheur: -3, repute: -2 }),
    ]),
    D("Rester salarié et ranger l'idée", "🗄️", "Tu choisis la sécurité. La vie continue, avec parfois un petit pincement quand tu passes devant une vitrine.", { prudent: 3, bonheur: -1 }),
  ],
});

solo("cf_enfant_ou_carriere", {
  ages: [26, 42], ic: "👶", need: { partner: true, job: true }, who: { partner: "partner" }, w: 7, cool: 10,
  t: "Ton partenaire a un grand sourire et une question qui change tout. Le moment semble venu de fonder une famille, mais ton travail vient de te proposer une belle montée en grade.",
  c: [
    D("Avoir un enfant maintenant", "🍼", "Un bébé arrive. Les nuits raccourcissent, l'argent file, et pourtant tu n'as jamais été aussi attaché(e) à ta vie.", { born: 1, bonheur: 6, argent: -2500, ambition: -2, rel: { partner: 12 } }),
    C("Foncer sur la promotion d'abord", "📈", [
      O(0.65, "La promotion tombe et le salaire aussi. Ton partenaire patiente, avec un sourire un peu crispé.", { promote: true, argent: 2500, ambition: 3, rel: { partner: -10 } }),
      O(0.35, "Tu t'épuises pour un poste qui ne vient pas, et ton partenaire commence à douter de tes priorités.", { sante: -5, bonheur: -5, rel: { partner: -18 } }),
    ]),
    D("Prendre le temps de décider à deux", "💬", "Vous parlez longuement, sans vous fâcher. Le calendrier n'est pas fixé, mais vous êtes sur la même longueur d'onde.", { rel: { partner: 8 }, prudent: 2, bonheur: 2 }),
  ],
});

solo("cf_couple_crise", {
  ages: [26, 75], ic: "⛈️", need: { partner: true }, who: { partner: "partner" }, w: 8, cool: 10,
  t: "Les silences durent trop longtemps à table. Il y a eu des mots durs, une porte claquée, et des questions que vous évitez depuis longtemps. Il faut décider de ce que devient votre histoire.",
  c: [
    C("Aller voir un thérapeute de couple", "🛋️", [
      O(0.6, "Les séances ouvrent des portes que vous aviez fermées. C'est inconfortable, puis soulageant. Votre lien en sort plus solide.", { argent: -900, bonheur: 5, rel: { partner: 20 } }),
      O(0.4, "Le thérapeute met le doigt sur trop de choses. Vous vous disputez de plus belle dans la voiture.", { argent: -900, bonheur: -3, rel: { partner: -8 } }),
    ]),
    D("Faire un grand voyage pour se retrouver", "🏝️", "Deux semaines loin de tout. Vous rigolez, vous vous disputez, vous vous réconciliez. Ça ne règle pas tout mais ça ranime l'essentiel.", { argent: lose(0.1, 4000), bonheur: 4, rel: { partner: 14 } }),
    D("Mettre fin à la relation", "💔", "La séparation est triste et honnête. Il faut partager les affaires, les amis et les souvenirs, et trouver une nouvelle manière d'habiter sa vie.", { drop: ["partner"], bonheur: -8, argent: lose(0.15, 15000), courage: 2 }),
    D("Ne rien changer et serrer les dents", "😶", "Vous faites comme si de rien n'était. Les semaines passent, les rancœurs s'installent en douce.", { bonheur: -4, rel: { partner: -10 } }),
  ],
});

solo("cf_burnout", {
  ages: [26, 60], ic: "🪫", need: { job: true }, w: 6, cool: 12,
  t: "Tu te réveilles sans énergie, dans un corps qui dit non. Le travail s'empile, le café ne suffit plus, et tout ce qui te plaisait avant te laisse indifférent(e). Quelque chose doit changer.",
  c: [
    D("Prendre un long arrêt et se soigner", "🛌", "Tu t'arrêtes pour de bon. C'est difficile à avouer, puis étrangement doux. Ta santé remonte et tes priorités se redessinent.", { sante: 10, bonheur: 5, argent: -2500, ambition: -3 }),
    D("Démissionner et repartir ailleurs", "🚪", "Tu quittes tout. Il y a un temps de vide, d'inquiétude, puis le goût d'autre chose revient.", { quit: true, forced: ["sys:jobhunt"], sante: 6, bonheur: 4, argent: -1500 }),
    C("Continuer en serrant les dents", "💪", [
      O(0.4, "Ça passe, tu tiens, la vague finit par se retirer. Tu paies cependant ce coup de force plus tard.", { sante: -6, ambition: 2 }),
      O(0.6, "Ton corps lâche pour de bon. Hospitalisation, arrêt forcé, et un long chemin pour revenir.", { sante: -16, bonheur: -8, argent: -3500 }),
    ], { risk: 3 }),
    D("Réorganiser ta vie petit à petit", "🧭", "Tu négocies, tu délègues, tu apprends à dire non. Ce n'est pas spectaculaire, mais ta vie redevient respirable.", { sante: 5, bonheur: 3, prudent: 3 }),
  ],
});

solo("cf_heritage_maison", {
  ages: [30, 75], ic: "🏚️", w: 5, cool: 20,
  t: "Une tante éloignée que tu connaissais à peine t'a légué sa maison de famille. Elle est ancienne, pleine de souvenirs, et demande des travaux. Un voisin propose déjà de la racheter.",
  c: [
    D("La garder et la retaper", "🔨", "Tu y mets du temps, de l'argent et du courage. La maison reprend vie et devient ton refuge.", { item: { kind: "immo", name: "la maison de famille", value: 120000 }, argent: -6000, bonheur: 4, creatif: 2 }),
    D("La vendre tout de suite", "💶", "Tu acceptes l'offre du voisin. L'argent arrive vite, les souvenirs partent avec la clé.", { argent: 85000, bonheur: 1 }),
    D("La proposer à un proche en difficulté", "🤲", "Tu offres l'usage de la maison à quelqu'un qui en a besoin. Sa gratitude est immense, et ton nom est cité longtemps dans la famille.", { bonte: 4, repute: 3, bonheur: 3 }),
  ],
});

solo("cf_proposition_louche", {
  ages: [22, 62], ic: "🕶️", tags: ["carrefour", "mature"], w: 6, cool: 12,
  t: "Un ancien camarade te retrouve dans un café. Il parle à voix basse. Une affaire sans risque, dit-il, de l'argent liquide à placer, quelques signatures, et une grosse enveloppe à la clé.",
  c: [
    C("Accepter l'affaire", "🤝", [
      O(0.55, "Tout se passe bien et l'enveloppe est épaisse. Tu viens de mettre un pied dans un monde dont on ne ressort pas facilement.", { sale: 18000, honnete: -4, flag: "milieu_contact", repute: -1 }),
      O(0.3, "L'affaire est surveillée. Tu es interpellé(e), et ton casier prend une première ligne.", { prison: 1, record: 1, repute: -12, bonheur: -8, argent: lose(0.2, 20000) }),
      O(0.15, "Ton camarade disparaît avec la caisse. Tu es le dindon de la farce et tu dois rembourser.", { dette: 8000, bonheur: -6, honnete: -1 }),
    ], { risk: 3 }),
    D("Refuser et couper les ponts", "✋", "Tu pars sans te retourner. Tu perds un vieil ami, tu gardes ta tranquillité.", { honnete: 3, prudent: 2, bonheur: 1 }),
    D("Prévenir la police", "📞", "Tu transmets l'information. L'enquête avance, ton nom reste discret, et certains regards deviennent froids.", { honnete: 3, repute: 3, courage: 2, flag: "informateur", bonheur: -1 }),
  ],
});

solo("cf_gros_placement", {
  ages: [25, 70], ic: "📊", need: { money: [15000, null] }, w: 5, cool: 10,
  t: "Une occasion se présente et ton banquier insiste. Une partie de tes économies pourrait être placée dans un projet audacieux, un secteur en plein essor, ou une valeur sûre mais sans éclat.",
  c: [
    C("Miser gros sur le projet audacieux", "🎲", [
      O(0.3, "Le pari paye bien au-delà de ce que tu espérais. Ta mise est multipliée plusieurs fois.", { argent: cash(1.2, 120000), ambition: 2, bonheur: 4 }),
      O(0.3, "Le projet végète. Tu retrouves ta mise amputée de moitié.", { argent: lose(0.3, 40000), bonheur: -3 }),
      O(0.4, "Tu y perds une bonne partie de ce que tu avais mis.", { argent: lose(0.5, 80000), bonheur: -6 }),
    ], { risk: 3 }),
    D("Choisir la valeur sûre", "🏦", "Tu places prudemment. Les gains sont modestes, mais tu dors comme un bébé.", { argent: cash(0.08, 8000), prudent: 2 }),
    D("Tout dépenser dans une expérience de vie", "🌅", "Tu offres à ta vie un grand voyage et un souvenir gigantesque. L'argent s'évapore, pas ce que tu as vécu.", { argent: lose(0.4, 30000), bonheur: 8, creatif: 2 }),
    D("Ne rien faire", "😌", "Tu gardes tes économies sur ton compte, sans bruit.", { bonheur: 0 }),
  ],
});

solo("cf_parent_age", {
  ages: [32, 68], ic: "🧓", need: { rel: "mere" }, who: { mere: "mere" }, w: 6, cool: 15, once: true,
  t: "Ta mère ne peut plus vivre seule. Les oublis se multiplient et les chutes aussi. Les enfants de son âge parlent de maison de retraite, mais elle répète qu'elle préfère mourir plutôt que de quitter sa maison.",
  c: [
    D("L'accueillir chez toi", "🏠", "Elle emménage dans la chambre d'amis. Le quotidien est plus lourd, mais vous vous retrouvez. Votre foyer change de rythme.", { rel: { mere: 22 }, bonheur: 1, sante: -3, argent: -1200 }),
    D("Payer une résidence de qualité", "🏥", "Tu choisis un établissement chaleureux et tu rends visite chaque semaine. C'est coûteux, mais elle est entourée et soignée.", { rel: { mere: 8 }, argent: -9000, bonheur: -1 }),
    D("Organiser une aide à domicile", "👩‍⚕️", "Une auxiliaire passe tous les jours. Ta mère garde sa maison et son indépendance, et toi tu portes un peu moins de culpabilité.", { rel: { mere: 12 }, argent: -4000, bonheur: 1 }),
    D("Laisser ta fratrie s'en occuper", "🙈", "Tu laisses les autres gérer. Ta mère ne dit rien, mais ses yeux disent tout. La famille se déchire un peu.", { rel: { mere: -20 }, bonheur: -3, bonte: -2 }),
  ],
});

solo("cf_retraite_choix", {
  ages: [60, 72], ic: "🎉", need: { job: true, retired: false }, w: 9, cool: 6,
  t: "Le moment de la retraite approche. Ton entourage en parle sans arrêt, et ton patron te glisse qu'il aimerait bien que tu restes encore un peu.",
  c: [
    D("Partir en retraite maintenant", "🌴", "Tu quittes ton poste avec un pot de départ et quelques larmes. Les journées s'élargissent, la vie prend le temps qu'elle voulait.", { retire: true, bonheur: 6, sante: 3 }),
    D("Continuer quelques années", "💼", "Tu prolonges ton activité. Le salaire reste, la fatigue aussi, et tu gardes ton rôle auprès des plus jeunes.", { argent: 4000, sante: -3, repute: 2, ambition: 1 }),
    D("Se reconvertir en consultant à temps partiel", "🧠", "Tu transmets ton expérience à ton rythme. Les honoraires restent confortables et les journées sont libres.", { retire: true, argent: 6000, bonheur: 4, repute: 2 }),
  ],
});

solo("cf_derniers_voeux", {
  ages: [70, 100], ic: "🕯️", w: 8, who: { friend: "friend" }, cool: 10, once: true,
  t: "Les années pèsent. Tu ressens ce besoin de mettre de l'ordre dans ta vie et dans tes relations. Que veux-tu faire du temps qui reste ?",
  c: [
    D("Se réconcilier avec ceux qu'on a fâchés", "🕊️", "Tu écris, tu appelles, tu t'excuses. Tout ne se répare pas, mais beaucoup de choses se dénouent.", { bonheur: 6, bonte: 3, rel: { friend: 12 } }),
    D("Faire un dernier grand voyage", "🌅", "Tu vas voir les endroits que tu n'as jamais pris le temps de voir. Les souvenirs rempliront les années qui viennent.", { argent: lose(0.15, 25000), bonheur: 8, sante: -2 }),
    D("Organiser la transmission de ton patrimoine", "📜", "Tu organises ton héritage avec soin. Ceux que tu aimes sauront ce que tu pensais d'eux.", { bonheur: 3, repute: 2, bonte: 2 }),
    D("Se consacrer à une cause", "🤲", "Tu offres ton temps et une partie de ton argent à une cause qui compte. Ta réputation de générosité te survivra.", { argent: lose(0.1, 15000), bonte: 4, repute: 6, bonheur: 5 }),
  ],
});

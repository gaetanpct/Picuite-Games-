// ============================================================
// BUS BAZAR — Données communes (serveur et client)
// Rôles, systèmes du bus, passagers, objets, actions de cabine, modes.
// ============================================================
(function (root, factory) {
  if (typeof module !== "undefined" && module.exports) module.exports = factory();
  else root.BBData = factory();
})(typeof window !== "undefined" ? window : globalThis, function () {
  const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);

  // ---------- les quatre postes ----------
  const ROLES = [
    { id: "driver", label: "Conducteur", icon: "🚌", short: "Conduit", blurb: "Tient le volant. Évite les obstacles, dose la vitesse et klaxonne au bon moment." },
    { id: "mech", label: "Mécanicien", icon: "🔧", short: "Répare", blurb: "Surveille moteur, freins, pneus et circuit électrique, diagnostique et répare avec ce qu'il y a dans la caisse à outils." },
    { id: "nav", label: "Navigateur", icon: "🧭", short: "Décide", blurb: "Lit la carte et la météo, choisit les routes, gère l'horaire, les achats et les annonces." },
    { id: "cabin", label: "Responsable de cabine", icon: "📣", short: "Gère les passagers", blurb: "S'occupe des passagers, de leurs humeurs, de leurs demandes et de leurs bêtises." },
  ];
  const ROLE_IDS = ROLES.map((r) => r.id);

  // ---------- systèmes du bus ----------
  const SYSTEMS = [
    { id: "engine", label: "Moteur", icon: "⚙️", info: "Donne la puissance. Très abîmé, le bus n'avance plus." },
    { id: "cooling", label: "Refroidissement", icon: "🧊", info: "Évacue la chaleur du moteur. En panne, le moteur surchauffe." },
    { id: "brakes", label: "Freins", icon: "🛑", info: "Plus ils sont usés, plus il faut de distance pour s'arrêter." },
    { id: "tires", label: "Pneus", icon: "🛞", info: "Donnent l'adhérence. Usés ou crevés, le bus glisse et dérive." },
    { id: "electric", label: "Électricité", icon: "🔌", info: "Phares, klaxon, GPS et annonces. En panne, tout s'éteint." },
    { id: "body", label: "Carrosserie", icon: "🚌", info: "L'état général du bus. À zéro, c'est l'accident majeur et la mission s'arrête." },
    { id: "tank", label: "Réservoir", icon: "⛽", info: "Une fuite vide le carburant en route. Seul le ruban ou une réparation propre la bouche." },
  ];
  const SYSTEM_IDS = SYSTEMS.map((s) => s.id);

  // ---------- types de routes ----------
  // curve et hill règlent la raideur des virages et des pentes, grip l'adhérence, vis la visibilité en mètres
  const BIOMES = [
    { id: "campagne", label: "Campagne", icon: "🌾", curve: 0.55, hill: 0.5, grip: 1, vis: 320, density: 0.8, speed: 27, sky: ["#8fd3ff", "#e8f7ff"], ground: "#6fbf4a", ground2: "#63b240", road: "#555a64", note: "Routes tranquilles, animaux et tracteurs." },
    { id: "montagne", label: "Montagne", icon: "⛰️", curve: 1.35, hill: 1.3, grip: 0.92, vis: 260, density: 0.7, speed: 22, sky: ["#6fa8ff", "#dff0ff"], ground: "#8d8f93", ground2: "#7f8186", road: "#4a4e57", note: "Virages serrés, éboulements et vent." },
    { id: "ville", label: "Ville", icon: "🏙️", curve: 0.7, hill: 0.2, grip: 1, vis: 280, density: 1.5, speed: 19, sky: ["#b6c8e6", "#f1f5ff"], ground: "#9aa0a8", ground2: "#8d939b", road: "#3f434b", note: "Beaucoup de circulation et de piétons." },
    { id: "cote", label: "Route côtière", icon: "🏖️", curve: 0.95, hill: 0.6, grip: 1, vis: 340, density: 0.7, speed: 25, sky: ["#6ad1ff", "#fdf4d4"], ground: "#e8d9a0", ground2: "#decf92", road: "#565b66", note: "Belle vue et coups de vent." },
    { id: "chantier", label: "Chantier", icon: "🚧", curve: 0.8, hill: 0.3, grip: 0.9, vis: 280, density: 1.4, speed: 18, sky: ["#ffd9a0", "#fff1d6"], ground: "#c7a36a", ground2: "#b9965d", road: "#6a645a", note: "Route rétrécie, cônes et gravillons." },
    { id: "industrie", label: "Zone industrielle", icon: "🏭", curve: 0.75, hill: 0.3, grip: 0.85, vis: 260, density: 1.1, speed: 22, sky: ["#a9a6b8", "#e6e2f0"], ground: "#7c8087", ground2: "#70747b", road: "#43474f", note: "Camions lents et flaques d'huile." },
    { id: "pluie", label: "Route sous la pluie", icon: "🌧️", curve: 0.9, hill: 0.6, grip: 0.62, vis: 190, density: 0.9, speed: 21, sky: ["#6d7a8f", "#b9c4d4"], ground: "#4f8a50", ground2: "#467f47", road: "#3b3f48", note: "Adhérence réduite et visibilité basse." },
    { id: "nuit", label: "Route de nuit", icon: "🌙", curve: 0.9, hill: 0.6, grip: 0.95, vis: 130, density: 0.9, speed: 22, sky: ["#0c1330", "#25346b"], ground: "#1f3b2a", ground2: "#1a3324", road: "#262a33", note: "On ne voit que ce que les phares éclairent." },
    { id: "etroit", label: "Passage étroit", icon: "🪨", curve: 1.1, hill: 0.7, grip: 0.95, vis: 240, density: 0.9, speed: 17, sky: ["#9ac7ff", "#e9f3ff"], ground: "#7c8a62", ground2: "#6f7d57", road: "#4e5258", note: "Une route qui laisse à peine passer le bus." },
  ];
  const BIOME_IDS = BIOMES.map((b) => b.id);

  // ---------- passagers ----------
  // noise la sensibilité au bruit, drain la vitesse à laquelle l'humeur baisse, quirk le comportement propre
  const ARCHETYPES = [
    { id: "touriste", name: "Touriste suréquipé", icon: "📸", quirk: "photos", drain: 1, noise: 0.6, mood: [58, 78], reqs: { photo: 3, pause: 2, info: 2, attention: 1 }, blurb: "Quinze sacs, trois appareils photo et une envie d'arrêt photo toutes les deux minutes.", loves: ["annonce", "snack"], hates: [] },
    { id: "influenceur", name: "Influenceur en direct", icon: "🤳", quirk: "film", drain: 1.1, noise: 0.4, mood: [55, 80], reqs: { attention: 3, snack: 1, info: 1 }, blurb: "Se filme sans arrêt. Adore les catastrophes, tant que son public est là.", loves: ["chanson", "discours_absurde"], hates: ["confisquer"] },
    { id: "retraite", name: "Retraité connaisseur", icon: "🧓", quirk: "tips", drain: 0.8, noise: 0.9, mood: [60, 80], reqs: { info: 3, attention: 2, pause: 1 }, blurb: "Connaît toutes les routes du pays, y compris celles qui n'existent plus.", loves: ["parler", "discours_rassurant"], hates: ["baffe", "sifflet"] },
    { id: "silence", name: "Fanatique du silence", icon: "🤫", quirk: "silence", drain: 1.2, noise: 1.8, mood: [52, 72], reqs: { silence: 4, attention: 1 }, blurb: "Supporte à peine un moteur qui tourne. Le moindre bruit lui fait perdre ses moyens.", loves: ["discours_autoritaire"], hates: ["chanson", "sifflet", "discours_absurde", "snack"] },
    { id: "clown", name: "Clown involontaire", icon: "🤡", quirk: "slapstick", drain: 0.7, noise: 0.3, mood: [65, 90], reqs: { attention: 2, snack: 2 }, blurb: "Trébuche, renverse, lâche des objets. Ne se rend jamais compte de rien.", loves: ["discours_absurde", "chanson", "cadeau"], hates: [] },
    { id: "canards", name: "Collectionneur de canards", icon: "🦆", quirk: "ducks", drain: 0.9, noise: 0.5, mood: [58, 80], reqs: { canard: 4, attention: 1, snack: 1 }, blurb: "Possède trois cents canards en plastique. Il en manque toujours un.", loves: ["cadeau"], hates: ["confisquer"] },
    { id: "plaignant", name: "Client mécontent", icon: "😤", quirk: "complain", drain: 1.5, noise: 0.9, mood: [42, 62], reqs: { plainte: 4, attention: 2, pause: 1 }, blurb: "A déjà écrit à la compagnie avant même de monter. Se plaint du sens de la marche.", loves: ["parler", "discours_autoritaire"], hates: ["baffe", "confisquer"] },
    { id: "fauxchauffeur", name: "Faux conducteur", icon: "🧢", quirk: "backseat", drain: 1, noise: 0.8, mood: [50, 70], reqs: { info: 2, attention: 3 }, blurb: "Persuadé qu'il conduirait mieux. Donne des conseils criés et parfois s'empare du volant.", loves: ["discours_rassurant", "parler"], hates: ["sifflet", "baffe"] },
    { id: "train", name: "Voyageur du train imaginaire", icon: "🚂", quirk: "train", drain: 0.9, noise: 0.7, mood: [58, 78], reqs: { annonce: 4, info: 1, attention: 1 }, blurb: "Pense que le bus est un train. Réclame les annonces de gare et le contrôle des billets.", loves: ["annonce", "discours_absurde", "discours_autoritaire"], hates: [] },
    { id: "dormeur", name: "Grand dormeur", icon: "😴", quirk: "sleeper", drain: 0.6, noise: 1.5, mood: [60, 85], reqs: { silence: 3, snack: 1 }, blurb: "Dort partout, ronfle fort et se réveille grognon quand ça cogne.", loves: [], hates: ["chanson", "sifflet", "baffe"] },
    { id: "colis", name: "Porteur du colis qui bipe", icon: "📦", quirk: "parcel", drain: 1, noise: 0.8, mood: [52, 72], reqs: { attention: 2, info: 2, pause: 1 }, blurb: "Ne lâche pas son colis. Le colis, lui, fait des bruits.", loves: ["parler"], hates: ["confisquer"] },
    { id: "animal", name: "Maître d'un animal improbable", icon: "🦜", quirk: "pet", drain: 0.9, noise: 0.7, mood: [58, 78], reqs: { snack: 3, attention: 2, pause: 1 }, blurb: "Voyage avec un perroquet, une chèvre ou un lama. Ils ne sont pas d'accord entre eux.", loves: ["snack"], hates: ["baffe"] },
    { id: "magicien", name: "Magicien incompris", icon: "🎩", quirk: "magic", drain: 1, noise: 0.5, mood: [56, 76], reqs: { attention: 3, annonce: 2, snack: 1 }, blurb: "Sort des foulards de partout. Ses tours ratent une fois sur deux, toujours au pire moment.", loves: ["discours_absurde", "chanson", "quiz"], hates: ["confisquer"] },
    { id: "poete", name: "Poète en résidence", icon: "📜", quirk: "poem", drain: 0.9, noise: 0.6, mood: [58, 78], reqs: { attention: 2, silence: 2, info: 1 }, blurb: "Récite des poèmes de quarante strophes sur la beauté d'un rond-point.", loves: ["parler", "discours_rassurant", "horoscope"], hates: ["sifflet", "baffe"] },
    { id: "sportif", name: "Sportif du dimanche", icon: "🏃", quirk: "sport", drain: 1.1, noise: 0.7, mood: [55, 75], reqs: { pause: 3, snack: 2, attention: 1 }, blurb: "S'échauffe dans l'allée avant chaque arrêt, même quand il n'y en a pas.", loves: ["snack", "chanson", "conga"], hates: ["discours_autoritaire", "sieste"] },
    { id: "cuisinier", name: "Cuisinier de voyage", icon: "🍳", quirk: "cook", drain: 1, noise: 0.5, mood: [58, 80], reqs: { snack: 3, info: 1, attention: 1 }, blurb: "Fait des crêpes sur un réchaud de camping, en roulant, bien sûr.", loves: ["snack", "cadeau", "tombola"], hates: ["confisquer", "sifflet"] },
    { id: "ventriloque", name: "Ventriloque et sa marionnette", icon: "🪆", quirk: "ventri", drain: 1, noise: 0.8, mood: [52, 74], reqs: { attention: 3, plainte: 1, info: 1 }, blurb: "La marionnette dit tout haut ce que personne ne voulait entendre.", loves: ["discours_absurde", "parler", "quiz"], hates: ["baffe", "confisquer"] },
    { id: "sosie", name: "Sosie d'une grande star", icon: "🕶️", quirk: "star", drain: 1, noise: 0.5, mood: [56, 78], reqs: { photo: 3, attention: 2, annonce: 1 }, blurb: "Tout le monde croit le reconnaître. Lui répond toujours qu'il ne donne pas d'autographe.", loves: ["annonce", "cadeau", "selfie"], hates: ["discours_autoritaire"] },
  ];
  const ARCH_BY_ID = {}; ARCHETYPES.forEach((a) => { ARCH_BY_ID[a.id] = a; });

  // cadeaux et leurs effets, base d'humeur, favoris et détracteurs
  const GIFTS = {
    canardplastique: { base: 3 }, gilet: { base: 0 }, trophee: { base: 8 },
    chapeau: { base: 5, fav: ["clown", "touriste", "influenceur", "sosie", "magicien"], bad: ["silence", "plaignant"], line: "met le chapeau de fête de travers" },
    ballon: { base: 4, fav: ["clown", "sportif", "canards"], bad: ["silence", "dormeur"], line: "serre le ballon géant contre lui", pop: 0.2 },
    peluche: { base: 5, fav: ["dormeur", "animal", "retraite", "poete"], bad: ["fauxchauffeur", "sportif"], line: "adopte la peluche douteuse", calm: true },
    coussin: { base: 0, fav: ["clown", "influenceur", "ventriloque"], bad: ["silence", "retraite", "poete", "plaignant"], line: "s'assoit sur le coussin à bruits", noisy: true },
    glace: { base: 7, fav: ["sportif", "cuisinier", "touriste", "dormeur"], bad: [], line: "lèche la glace à la pistache", calm: true },
    medaille: { base: 6, fav: ["fauxchauffeur", "sportif", "sosie", "plaignant"], bad: [], line: "porte la médaille en chocolat comme une victoire olympique" },
  };
  const GIFT_IDS = Object.keys(GIFTS);

  const ANNOUNCES = [
    { id: "info", icon: "📣", label: "Annonce d'information", tip: "Répond aux passagers qui veulent un renseignement ou une annonce de gare.", log: "Annonce d'information" },
    { id: "calme", icon: "🕊️", label: "Annonce rassurante", tip: "Apaise doucement toute la cabine.", log: "Annonce rassurante" },
    { id: "delire", icon: "🎭", label: "Annonce délirante", tip: "Ça passe très bien ou très mal selon les passagers.", log: "Annonce délirante" },
    { id: "compliment", icon: "🌸", label: "Compliment général", tip: "Dit à chacun qu'il est formidable. Les râleurs n'y croient qu'à moitié.", log: "Compliment général" },
    { id: "blague", icon: "😂", label: "Blague du chauffeur", tip: "Une blague très moyenne. Elle fait rire ou soupirer, au hasard, avec un avantage pour les clowns.", log: "Blague du chauffeur" },
    { id: "meteo", icon: "☀️", label: "Bulletin météo du bord", tip: "Rassure ceux qui veulent une information et ravit les touristes.", log: "Bulletin météo du bord" },
    { id: "silence", icon: "🤫", label: "Minute de silence", tip: "Calme le bruit et comble les fanatiques du silence. Les autres trouvent ça un peu long.", log: "Minute de silence" },
    { id: "loto", icon: "🎰", label: "Loto des sièges", tip: "Un siège gagnant est tiré au sort. Le gagnant exulte, les autres boudent un peu.", log: "Loto des sièges" },
  ];
  const ANN_BY_ID = {}; ANNOUNCES.forEach((a) => { ANN_BY_ID[a.id] = a; });

  // petites actions bonus du conducteur et du mécanicien
  const DRIVER_EXTRAS = [
    { id: "musique", icon: "🎵", label: "Musique du bord", cd: 40, info: "Met de la musique pendant vingt-cinq secondes. Les passagers apprécient, les amoureux du silence et les dormeurs beaucoup moins." },
    { id: "gyro", icon: "🚨", label: "Gyrophare de fête", cd: 45, info: "Fait fuir les obstacles vivants devant le bus sans faire de bruit. Il grille un peu l'électricité." },
  ];
  const MECH_EXTRAS = [
    { id: "bidouille", icon: "🪛", label: "Bidouille créative", cd: 25, info: "Gratuit. Peut réparer, trouver une pièce en trop, déclencher un nuage de fumée ou casser un truc de plus. Le résultat est une surprise totale." },
    { id: "parler_moteur", icon: "🗣️", label: "Parler au moteur", cd: 20, info: "Gratuit. Murmurer des mots doux au moteur le refroidit parfois un peu. Parfois il se vexe." },
  ];

  const REQUESTS = {
    photo: { label: "Veut un arrêt photo", icon: "📸", sol: "Arrête le bus quelques secondes ou calme-le en lui parlant.", ttl: 70 },
    pause: { label: "Réclame une pause", icon: "🚻", sol: "Demande un arrêt au conducteur ou calme-le.", ttl: 80 },
    info: { label: "Veut une information", icon: "❓", sol: "Parle-lui ou fais une annonce.", ttl: 60 },
    attention: { label: "Réclame de l'attention", icon: "🙋", sol: "Parle-lui.", ttl: 55 },
    snack: { label: "A une petite faim", icon: "🍪", sol: "Offre-lui un snack.", ttl: 60 },
    silence: { label: "Exige du silence", icon: "🔇", sol: "Fais baisser le bruit, ou parle-lui.", ttl: 50 },
    canard: { label: "A perdu un canard", icon: "🦆", sol: "Aide-le à le retrouver en lui parlant ou offre-lui un canard.", ttl: 60 },
    plainte: { label: "Veut déposer une plainte", icon: "📝", sol: "Écoute-le en lui parlant.", ttl: 50 },
    annonce: { label: "Attend une annonce de gare", icon: "🚉", sol: "Fais une annonce ou un discours.", ttl: 60 },
  };

  const PAX_NAMES = ["Mme Poulard", "Gaston", "Bernadette", "Kévin 2000", "Tonton Rémy", "Zoé Zapping", "Mamie Crêpe", "Hubert", "Lucette", "Jean-Mi", "Colette", "Boris", "Mireille", "Ginette", "Marcel", "Yvonne", "Patrick", "Odette", "Roger", "Nadège", "Alphonse", "Simone", "Gérard", "Célestine", "Fernand", "Josiane", "Bastien", "Raymonde"];
  const CREW_NAMES = { driver: "Gustave Moustache", mech: "Petit Pierrot", nav: "Monsieur Carton", cabin: "Sylvie Sifflet" };

  // ---------- objets absurdes ----------
  const ITEMS = [
    { id: "klaxon", label: "Klaxon de clown", icon: "📯", role: "driver", info: "Disperse animaux et piétons à coup sûr, mais fait sursauter les passagers.", weight: 3 },
    { id: "marteau", label: "Marteau en mousse", icon: "🔨", role: "mech", info: "Un coup sûr de réparation modeste, sans risque d'aggraver la panne. Le clown du bus adore.", weight: 3 },
    { id: "extincteur", label: "Extincteur", icon: "🧯", role: "mech", info: "Refroidit le moteur d'un coup. Il y a de la mousse partout ensuite, y compris sur le pare-brise.", weight: 2 },
    { id: "ruban", label: "Ruban adhésif géant", icon: "🎞️", role: "mech", info: "Ajoute trois rouleaux de ruban pour des réparations provisoires.", weight: 3 },
    { id: "gps", label: "GPS très confiant", icon: "🛰️", role: "nav", info: "Donne un avis sûr de lui sur la meilleure route. Il a raison une fois sur deux.", weight: 2 },
    { id: "gilet", label: "Gilet de sécurité magique", icon: "🦺", role: "cabin", info: "À offrir à un passager. Il se sent invincible pendant une minute, avec des conséquences.", weight: 2 },
    { id: "trousse", label: "Trousse de premiers secours", icon: "🧰", role: "cabin", info: "Soigne un malaise. Parfois, elle contient un canard en plastique à la place.", weight: 3 },
    { id: "snacks", label: "Réserve de snacks", icon: "🥨", role: "cabin", info: "Ajoute quatre snacks pour apaiser les estomacs.", weight: 3 },
    { id: "trophee", label: "Trophée ridicule", icon: "🏆", role: "any", info: "Ne sert à rien d'autre que le prestige. Rapporte des points de style à la fin.", weight: 1 },
    { id: "bonheur", label: "Porte-bonheur", icon: "🍀", role: "any", info: "Dans quatre cas sur dix le prochain incident est plus doux, dans deux cas il est plus dur. Sinon, rien.", weight: 2 },
    { id: "canardplastique", label: "Canard en plastique", icon: "🦆", role: "cabin", info: "Un cadeau parfait pour le collectionneur, un peu moins pour les autres.", weight: 2 },
    { id: "chapeau", label: "Chapeau de fête", icon: "🎉", role: "cabin", info: "Un cadeau qui fait plaisir à presque tout le monde, surtout aux clowns et aux touristes.", weight: 2 },
    { id: "ballon", label: "Ballon géant", icon: "🎈", role: "cabin", info: "À offrir à un passager. Il éclate parfois au pire moment.", weight: 2 },
    { id: "peluche", label: "Peluche douteuse", icon: "🧸", role: "cabin", info: "Console les paniqués et les râleurs, effraie les autres.", weight: 2 },
    { id: "coussin", label: "Coussin à bruits", icon: "💨", role: "cabin", info: "Fait un bruit gênant quand on s'assoit dessus. Un cadeau risqué qui fait rire ou hurler.", weight: 1 },
    { id: "glace", label: "Glace à la pistache", icon: "🍦", role: "cabin", info: "Calme presque tout le monde. Fond vite et laisse des traces.", weight: 2 },
    { id: "medaille", label: "Médaille en chocolat", icon: "🏅", role: "cabin", info: "Un petit trophée comestible. Les passagers importants adorent.", weight: 2 },
  ];
  const ITEM_BY_ID = {}; ITEMS.forEach((i) => { ITEM_BY_ID[i.id] = i; });

  // ---------- réparations ----------
  const REPAIRS = {
    propre: { label: "Réparation propre", icon: "🛠️", info: "Une pièce de rechange, huit secondes de travail. Restaure beaucoup. Freins et pneus demandent un bus presque arrêté.", cost: { spares: 1 }, dur: 8, gain: 60, needStop: ["brakes", "tires"] },
    ruban: { label: "Ruban adhésif", icon: "🩹", info: "Un rouleau de ruban, trois secondes. Restaure un peu, mais le ruban lâche au bout de quarante-cinq secondes.", cost: { tape: 1 }, dur: 3, gain: 28, patch: 45 },
    clef: { label: "Coup de clé", icon: "🔧", info: "Gratuit et rapide. Une chance sur deux d'aider un peu, trois sur dix de ne rien faire, deux sur dix d'abîmer encore.", cost: {}, dur: 1.5, cd: 7 },
    refroidir: { label: "Refroidir", icon: "💧", info: "Un bidon de liquide, six secondes. Fait baisser nettement la température du moteur.", cost: { coolant: 1 }, dur: 6, system: "engine" },
  };
  const WRENCH = { help: 0.5, nothing: 0.3, worse: 0.2, helpGain: 20, worseLoss: 10 };

  // ---------- actions de la cabine ----------
  const CABIN_ACTIONS = [
    { id: "parler", label: "Parler", icon: "💬", target: true, cd: 3, info: "Écouter et négocier. Résout les demandes d'attention, de plainte et d'information." },
    { id: "snack", label: "Offrir un snack", icon: "🍪", target: true, cd: 3, cost: { snacks: 1 }, info: "Un snack de la réserve. Règle une petite faim, sauf pour ceux que ça agace." },
    { id: "sifflet", label: "Coup de sifflet", icon: "🪈", target: false, cd: 20, info: "Fait taire tout le monde d'un coup, mais certains protestent." },
    { id: "discours_rassurant", label: "Discours rassurant", icon: "🕊️", target: false, cd: 25, info: "Apaise la cabine, surtout en pleine crise." },
    { id: "discours_autoritaire", label: "Discours autoritaire", icon: "📢", target: false, cd: 25, info: "Rétablit l'ordre. Les têtes brûlées apprécient moyennement." },
    { id: "discours_absurde", label: "Discours absurde", icon: "🎭", target: false, cd: 25, info: "Une annonce complètement délirante. Cela passe très bien ou très mal selon le public." },
    { id: "cadeau", label: "Faire un cadeau", icon: "🎁", target: true, cd: 5, needItem: ["canardplastique", "gilet", "trophee", "chapeau", "ballon", "peluche", "coussin", "glace", "medaille"], info: "Offre un objet à un passager. L'effet dépend de lui et de l'objet." },
    { id: "chanson", label: "Concours de chansons", icon: "🎤", target: false, cd: 45, info: "Met de l'ambiance pendant vingt secondes. Les dormeurs et les amoureux du silence détestent." },
    { id: "confisquer", label: "Confisquer", icon: "🧺", target: true, cd: 6, info: "Retire un objet gênant. Règle colis, animaux et téléphones, mais risque une réclamation." },
    { id: "soigner", label: "Soigner", icon: "🩺", target: true, cd: 4, cost: { medkit: 1 }, info: "Utilise une trousse pour un passager qui fait un malaise." },
    { id: "evacuer", label: "Faire descendre", icon: "🚪", target: true, cd: 6, info: "Possible seulement à l'arrêt. Le passager quitte le bus, parfois en protestant." },
    { id: "baffe", label: "Baffe cartoon", icon: "🖐️", target: true, cd: 12, info: "Une petite claque exagérée de dessin animé. Remet les idées en place d'un passager paniqué, mais fâche presque tous les autres." },
    { id: "ola", label: "La ola", icon: "🌊", target: false, cd: 35, info: "Toute la cabine se lève et se rassoit en vague. Bonne humeur générale, un peu de tangage." },
    { id: "conga", label: "Danse en file", icon: "💃", target: false, cd: 55, info: "Une conga dans l'allée. Grosse ambiance, mais le bus tangue, le bruit monte et les dormeurs sursautent." },
    { id: "quiz", label: "Quiz du bus", icon: "❓", target: false, cd: 45, info: "Une question à toute la cabine. Si elle plaît, deux demandes d'attention ou d'information sont réglées d'un coup." },
    { id: "tombola", label: "Tombola", icon: "🎟️", target: false, cd: 60, info: "Un passager gagne un lot tiré au hasard, snacks, objet ou simple gloire. Les autres sont un peu jaloux." },
    { id: "selfie", label: "Selfie de groupe", icon: "🤳", target: false, cd: 50, info: "Tout le monde sourit. Les touristes et les influenceurs adorent, mais il y a toujours quelqu'un qui cligne des yeux." },
    { id: "sieste", label: "Sieste collective", icon: "😴", target: false, cd: 70, info: "Baisse les lumières et le bruit. Rassure tout le monde et comble les amoureux du silence. Fragile si le klaxon sonne." },
    { id: "massage", label: "Massage de nuque", icon: "💆", target: true, cd: 8, info: "Un massage express pour un passager. Règle une demande d'attention, mais tout le monde n'aime pas qu'on le touche." },
    { id: "horoscope", label: "Horoscope du bord", icon: "🔮", target: true, cd: 10, info: "Lit l'avenir d'un passager. Il adore ou il panique. Révèle son caractère s'il sourit." },
    { id: "penchez", label: "Tous à droite", icon: "↔️", target: false, cd: 30, info: "Toute la cabine se penche pour contrer le vent ou un pneu qui tire. Utile en pleine panne, ridicule sans raison." },
  ];
  const CABIN_BY_ID = {}; CABIN_ACTIONS.forEach((a) => { CABIN_BY_ID[a.id] = a; });

  // chances de succès affichées au joueur et tirées par le serveur. Une seule source de vérité
  function cabinOdds(actionId, pax, ctx) {
    const a = ARCH_BY_ID[pax && pax.arch] || {}; const mood = pax ? pax.mood : 50; const loves = (a.loves || []).indexOf(actionId) >= 0, hates = (a.hates || []).indexOf(actionId) >= 0;
    const adj = (loves ? 0.2 : 0) - (hates ? 0.25 : 0);
    switch (actionId) {
      case "parler": return clamp(0.5 + (mood - 40) / 250 + adj, 0.2, 0.92);
      case "snack": return clamp(0.8 + adj, 0.25, 0.95);
      case "cadeau": return clamp(0.55 + adj, 0.15, 0.9);
      case "confisquer": return clamp(0.85 + adj, 0.35, 0.95);
      case "soigner": return clamp((ctx && ctx.speed > 12 ? 0.5 : 0.85), 0.3, 0.95);
      case "massage": return clamp(0.75 + adj, 0.2, 0.95);
      case "horoscope": return clamp(0.5 + adj, 0.2, 0.9);
      case "quiz": return clamp(0.6 + (loves ? 0.15 : 0) - (hates ? 0.15 : 0), 0.3, 0.9);
      case "baffe": return pax && (pax.state === "panique" || pax.state === "colere") ? 0.75 : 0.1;
      default: return 1;
    }
  }

  // ---------- modes de mission ----------
  // ev fréquence des événements, res ressources, wear usure, mood chute d'humeur, time temps imparti, absurd poids des événements absurdes, items objets trouvés
  const MODES = [
    { id: "standard", label: "Mission standard", icon: "🚌", desc: "Le réglage classique. Il faut arriver à destination, sans accident ni panne définitive. La note dépend de la satisfaction, du retard, de l'état du bus, des objectifs et des ressources.", ev: 1, res: 1, wear: 1, mood: 1, time: 1, absurd: 1, items: 1, dmg: 1, minSat: 0 },
    { id: "panique", label: "Mode Panique", icon: "🚨", desc: "Plus d'incidents, moins de ressources, un horaire plus serré et des passagers qui s'énervent vite. La réussite complète demande au moins un quart de satisfaction à l'arrivée, sinon c'est une arrivée sans les honneurs.", ev: 1.6, res: 0.6, wear: 1.3, mood: 1.35, time: 0.9, absurd: 1, items: 0.8, dmg: 1.1, minSat: 25 },
    { id: "tourisme", label: "Mode Tourisme", icon: "🌄", desc: "Moins de pression, un horaire souple et des points d'intérêt sur la route. La satisfaction compte double dans la note et la réussite complète demande au moins la moitié de satisfaction à l'arrivée, sinon c'est une arrivée sans les honneurs.", ev: 0.6, res: 1.2, wear: 0.8, mood: 0.7, time: 1.35, absurd: 1, items: 1, dmg: 0.9, minSat: 50 },
    { id: "compagnie", label: "Compagnie catastrophique", icon: "🤪", desc: "Les incidents absurdes et les objets farfelus sont deux fois plus nombreux, avec des conséquences plus lourdes. Les trophées de style rapportent plus de points.", ev: 1.2, res: 1, wear: 1, mood: 1, time: 1, absurd: 2.2, items: 2, dmg: 1.3, minSat: 0 },
  ];
  const MODE_BY_ID = {}; MODES.forEach((m) => { MODE_BY_ID[m.id] = m; });

  const TRAITS = [
    { id: "zen", label: "Zen", k: 0.7, info: "Encaisse presque tout sans broncher." },
    { id: "normal", label: "Normal", k: 1, info: "Réagit comme tout le monde." },
    { id: "joyeux", label: "Joyeux", k: 0.8, info: "Prend les catastrophes avec le sourire." },
    { id: "raleur", label: "Râleur", k: 1.3, info: "Se plaint pour un rien." },
    { id: "petard", label: "Pétard", k: 1.6, info: "S'énerve très vite et se bagarre volontiers." },
  ];
  const TRAIT_BY_ID = {}; TRAITS.forEach((t) => { TRAIT_BY_ID[t.id] = t; });
  const PARTS = [
    { id: "normale", label: "Pièce d'origine", p: 0.72, gain: 1, hold: 0, note: "Fait son travail." },
    { id: "autre", label: "Pièce d'un autre bus", p: 0.16, gain: 0.7, hold: 0, note: "Pas tout à fait la bonne taille." },
    { id: "absurde", label: "Pièce absurde", p: 0.12, gain: 0.5, hold: 70, note: "Un tuyau en spaghetti, une cuillère à soupe... Ça tient un moment, pas toujours." },
  ];
  const TROPHIES = [
    { id: "ruban", label: "Roi du ruban", info: "A utilisé le plus de rouleaux de ruban adhésif." },
    { id: "baffe", label: "Baffeur d'élite", info: "A distribué des baffes cartoon." },
    { id: "klaxon", label: "Virtuose du klaxon", info: "Klaxon utilisé sans retenue." },
    { id: "justesse", label: "Sauvetage de justesse", info: "A évité un obstacle d'un coup de volant spectaculaire." },
    { id: "diplomate", label: "Diplomate de cabine", info: "A résolu le plus de demandes de passagers." },
    { id: "radio", label: "Voix de la radio", info: "A envoyé le plus de messages radio dramatiques." },
    { id: "trophee", label: "Collectionneur de trophées ridicules", info: "A réuni des trophées ridicules." },
    { id: "tempete", label: "Magnet à catastrophes", info: "Le bus a subi énormément d'incidents." },
  ];

  return { clamp, ROLES, ROLE_IDS, SYSTEMS, SYSTEM_IDS, BIOMES, BIOME_IDS, ARCHETYPES, ARCH_BY_ID, REQUESTS, PAX_NAMES, CREW_NAMES, ITEMS, ITEM_BY_ID, REPAIRS, WRENCH, CABIN_ACTIONS, CABIN_BY_ID, cabinOdds, GIFTS, GIFT_IDS, ANNOUNCES, ANN_BY_ID, DRIVER_EXTRAS, MECH_EXTRAS, MODES, MODE_BY_ID, TROPHIES, TRAITS, TRAIT_BY_ID, PARTS };
});

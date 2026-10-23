// ============================================================
// GOLFOUILLE — Réglages, clubs et pouvoirs (source unique)
// ============================================================
(function (root, factory) {
  if (typeof module !== "undefined" && module.exports) module.exports = factory(require("./course.js"));
  else root.GolfRules = factory(root.GolfCourse);
})(typeof window !== "undefined" ? window : globalThis, function (Course) {
  // speed vitesse maximale en m/s, loft angle de lancer par défaut en degrés, loftMin et loftMax les angles extrêmes réglables,
  // err erreur de visée en degrés pour un coup à pleine puissance
  const CLUBS = {
    rocket: { id: "rocket", name: "Fusée", icon: "🚀", speed: 46, loft: 11, loftMin: 6, loftMax: 22, err: 4.2, limited: 1, role: "Distance folle", desc: "Le coup le plus puissant du sac. Très long et très imprécis, une seule fois par trou.", fly: "Vol rapide et assez bas. Il rase les arbres, monte la hauteur pour les passer." },
    driver: { id: "driver", name: "Driver", icon: "🏌️", speed: 34, loft: 14, loftMin: 8, loftMax: 30, err: 2.6, role: "Longue distance", desc: "Le grand frappeur. Part très loin avec un vol tendu, un peu imprécis.", fly: "Vol tendu et bas. Il file droit mais cogne facilement un arbre ou un obstacle. Monte la hauteur pour passer au dessus." },
    iron: { id: "iron", name: "Fer", icon: "⛳", speed: 24, loft: 22, loftMin: 14, loftMax: 40, err: 1.9, role: "Bon à tout faire", desc: "Le club polyvalent, une belle courbe et un bon roulé.", fly: "Vol moyen. Passe les petits obstacles, roule bien à l'arrivée." },
    ricochet: { id: "ricochet", name: "Ricochet", icon: "🥏", speed: 24, loft: 8, loftMin: 8, loftMax: 8, err: 2.2, skip: true, role: "Spécial eau", desc: "Frappe rasante qui fait des ricochets sur l'eau pour traverser les mares.", fly: "Vol rasant, hauteur fixe. Aucun arbre ne le laisse passer." },
    wedge: { id: "wedge", name: "Cale", icon: "🥄", speed: 16, loft: 42, loftMin: 30, loftMax: 58, err: 1.5, role: "Haut et doux", desc: "Monte haut, passe les arbres et retombe doucement.", fly: "Vol haut qui franchit la plupart des obstacles. Court mais sûr." },
    lob: { id: "lob", name: "Lob", icon: "🎈", speed: 12.5, loft: 62, loftMin: 52, loftMax: 76, err: 1.4, lob: true, role: "Très haut et court", desc: "Un lob très haut qui retombe presque à la verticale et s'arrête net.", fly: "Vol très haut, passe tout, mais la portée est courte." },
    putter: { id: "putter", name: "Putter", icon: "🎯", speed: 12, loft: 0, loftMin: 0, loftMax: 0, err: 0.7, role: "Au sol, précis", desc: "Roule au ras du sol, le plus précis. Parfait sur le green.", fly: "Aucun vol, la balle roule. Un obstacle ou une pente l'arrête." },
  };
  // du plus puissant au moins puissant
  const CLUB_ORDER = ["rocket", "driver", "iron", "ricochet", "wedge", "lob", "putter"];
  const HEIGHT_NAMES = ["Très bas", "Bas", "Normal", "Haut", "Très haut"];
  const HEIGHT_DEFAULT = 2;
  const hasHeight = (c) => c.loftMax > c.loftMin;
  // cinq hauteurs possibles, la troisième est l'angle habituel du club
  function loftFor(id, h) {
    const c = CLUBS[id] || CLUBS.putter; if (!hasHeight(c)) return c.loft;
    h = Math.max(0, Math.min(4, Math.round(Number(h)))); if (!isFinite(h)) h = HEIGHT_DEFAULT;
    const l = [c.loftMin, (c.loftMin + c.loft) / 2, c.loft, (c.loft + c.loftMax) / 2, c.loftMax]; return l[h];
  }
  // notes de 1 à 5 pour afficher la fiche d'un club
  function stars(c) {
    const pow = Math.max(1, Math.min(5, Math.round((c.speed / 46) * 5)));
    const acc = Math.max(1, Math.min(5, Math.round(5 - ((c.err - 0.7) / 3.5) * 4)));
    const hi = c.loft <= 0 ? 0 : Math.max(1, Math.min(5, Math.round(c.loft / 62 * 5)));
    return { pow, acc, hi };
  }

  // kind hostile se lance sur un adversaire, self sur soi
  const POWERS = {
    mur: { id: "mur", name: "Mur surprise", icon: "🧱", kind: "hostile", desc: "Un mur surgit devant la balle d'un adversaire et bloque le chemin pendant 25 secondes." },
    glu: { id: "glu", name: "Colle", icon: "🍯", kind: "hostile", desc: "Le prochain coup de l'adversaire est réduit de moitié." },
    bourrasque: { id: "bourrasque", name: "Bourrasque", icon: "💨", kind: "hostile", desc: "Un vent fou pousse le prochain coup de l'adversaire sur le côté." },
    brouillard: { id: "brouillard", name: "Brouillard", icon: "🌫️", kind: "hostile", desc: "L'écran de l'adversaire se remplit de brume pendant 12 secondes." },
    inversion: { id: "inversion", name: "Mal de mer", icon: "🙃", kind: "hostile", desc: "La visée de l'adversaire est inversée pour son prochain coup." },
    gel: { id: "gel", name: "Gel", icon: "❄️", kind: "hostile", desc: "L'adversaire est figé pendant 4 secondes et ne peut plus taper." },
    verglas: { id: "verglas", name: "Verglas", icon: "🧊", kind: "hostile", desc: "Sa prochaine balle glisse comme sur une patinoire." },
    echange: { id: "echange", name: "Échange", icon: "🔀", kind: "self", desc: "Tu échanges ta place avec le joueur le plus proche du trou. Utile quand on est à la traîne." },
    turbo: { id: "turbo", name: "Turbo", icon: "🚀", kind: "self", desc: "Ton prochain coup part avec 50 pour cent de puissance en plus." },
    aimant: { id: "aimant", name: "Aimant", icon: "🧲", kind: "self", desc: "Le trou attire ta prochaine balle et devient plus large." },
    bulle: { id: "bulle", name: "Bulle", icon: "🫧", kind: "self", desc: "Une bulle te protège et bloque le prochain pouvoir qu'on lance contre toi." },
    raccourci: { id: "raccourci", name: "Raccourci", icon: "🌀", kind: "self", desc: "Ta balle se téléporte une quinzaine de mètres plus près du trou, sur le chemin." },
    rembobine: { id: "rembobine", name: "Rembobine", icon: "🔁", kind: "self", desc: "Ton dernier coup est annulé. Tu reviens sur ta position précédente et le coup n'est pas compté." },
  };
  const POWER_ORDER = ["mur", "glu", "bourrasque", "brouillard", "inversion", "gel", "verglas", "echange", "turbo", "aimant", "bulle", "raccourci", "rembobine"];

  // barème unique des points, utilisé par le serveur et par l'affichage
  const SCORE = { place: [10, 7, 5, 3, 2, 1], underPar: 2, ace: 5 };
  const placePts = (place) => (place >= 1 ? SCORE.place[Math.min(place - 1, SCORE.place.length - 1)] : 0);
  function scoringText(s) {
    const pl = SCORE.place.join(", ");
    if (s.scoring === "coups") return "Pas de points. À la fin, celui qui a le moins de coups gagne. Un trou non fini compte ses coups plus " + s.unfinishedPenalty + " de pénalité. Eau, lave et sortie de terrain ajoutent un coup.";
    const base = "Points d'arrivée " + pl + " selon l'ordre dans le trou, 0 si tu ne finis pas. Un trou en un rapporte " + SCORE.ace + " points de plus.";
    if (s.scoring === "course") return base + " Le nombre de coups ne change rien d'autre.";
    return base + " Chaque coup sous le par rapporte " + SCORE.underPar + " points de plus. Au par ou au-dessus il n'y a ni bonus ni malus.";
  }
  const BIOME_OPTIONS = Course.BIOME_IDS.map((id) => ({ value: id, label: Course.BIOMES[id].name, icon: Course.BIOMES[id].icon }));
  const FEATURE_OPTIONS = [
    { value: "bumpers", label: "Bumpers", icon: "🔵", desc: "Des plots qui renvoient la balle plus fort qu'elle n'arrive." },
    { value: "windmills", label: "Moulins", icon: "🌀", desc: "Des pales qui tournent en travers du chemin." },
    { value: "sliders", label: "Barrières", icon: "🚧", desc: "Des barrières qui vont et viennent d'un bord à l'autre." },
    { value: "boosts", label: "Tapis turbo", icon: "⏩", desc: "Des tapis qui accélèrent la balle dans le sens des flèches." },
    { value: "trampolines", label: "Trampolines", icon: "🟣", desc: "Des disques qui projettent la balle en l'air." },
    { value: "portals", label: "Portails", icon: "🕳️", desc: "Une paire de portails qui envoie la balle plus loin." },
  ];

  const SCHEMA = [
    { category: "🏁 La partie", rules: [
      { id: "holes", label: "Nombre de trous", type: "range", min: 1, max: 18, step: 1, default: 5, info: "Chaque trou est un terrain différent, généré pour toi. Cinq trous durent environ 15 minutes." },
      { id: "playMode", label: "Façon de jouer", type: "cards", default: "course", options: [
        { value: "course", label: "Course", icon: "🏃", desc: "Tout le monde tape en même temps. Arriver le premier compte." },
        { value: "tour", label: "Tour par tour", icon: "🔁", desc: "Le plus loin du trou joue. Plus calme et plus tactique." },
      ] },
      { id: "scoring", label: "Décompte des points", type: "cards", default: "mixte", options: [
        { value: "course", label: "Arrivée", icon: "🥇", desc: "Seul l'ordre d'arrivée compte. Le premier dans le trou gagne 10 points, puis 7, 5, 3, 2 et 1. Un trou en un ajoute 5 points." },
        { value: "mixte", label: "Arrivée et coups", icon: "⚖️", desc: "Les mêmes points d'arrivée, plus 2 points par coup sous le par du trou et 5 points pour un trou en un. Rapide et précis est récompensé." },
        { value: "coups", label: "Coups", icon: "🔢", desc: "Pas de points, le moins de coups au total gagne, comme au vrai golf. L'ordre d'arrivée ne compte pas." },
      ] },
      { id: "finishGrace", label: "Temps accordé après le premier arrivé", type: "chips", default: 30, options: [{ value: 15, label: "15 s" }, { value: 30, label: "30 s" }, { value: 45, label: "45 s" }, { value: 60, label: "1 min" }, { value: 90, label: "1 min 30" }], showIf: { playMode: "course" }, info: "Quand quelqu'un met sa balle dans le trou, les autres ont ce temps pour finir. Passé ce délai, le trou se termine." },
      { id: "shotClock", label: "Temps pour jouer son coup", type: "chips", default: 30, options: [{ value: 20, label: "20 s" }, { value: 30, label: "30 s" }, { value: 45, label: "45 s" }, { value: 60, label: "1 min" }], showIf: { playMode: "tour" }, info: "Si tu hésites trop longtemps, le jeu tape un coup à ta place." },
      { id: "maxStrokes", label: "Coups maximum par trou", type: "chips", default: 8, options: [6, 8, 10, 12], info: "Au-delà de ce nombre de coups la balle est ramassée et le trou est terminé pour toi." },
      { id: "unfinishedPenalty", label: "Coups ajoutés si le trou n'est pas fini", type: "chips", default: 2, options: [0, 1, 2, 3], info: "Ajoutés au total de coups d'un joueur qui ne finit pas un trou, uniquement dans le décompte aux coups." },
    ] },
    { category: "🗺️ Le terrain", rules: [
      { id: "biomes", label: "Biomes possibles", type: "multi", default: Course.BIOME_IDS.slice(), options: BIOME_OPTIONS, info: "Coche les décors que tu veux croiser. Chaque biome a ses pièges et ses obstacles." },
      { id: "biomeOrder", label: "Choix du biome à chaque trou", type: "chips", default: "hasard", options: [{ value: "hasard", label: "Au hasard" }, { value: "ordre", label: "Dans l'ordre de la liste" }, { value: "unique", label: "Le même partout" }], info: "Au hasard change à chaque trou. Dans l'ordre fait un voyage. Le même partout prend le premier biome coché." },
      { id: "holeLength", label: "Longueur des trous", type: "chips", default: 0, options: [{ value: 0, label: "Variée" }, { value: 1, label: "Court" }, { value: 2, label: "Moyen" }, { value: 3, label: "Long" }], info: "Un trou court fait environ 45 mètres, un long plus de 100." },
      { id: "difficulty", label: "Difficulté du terrain", type: "range", min: 1, max: 5, step: 1, default: 3, info: "Plus c'est haut, plus le chemin est étroit et sinueux." },
      { id: "hills", label: "Relief", type: "range", min: 0, max: 3, step: 1, default: 2, format: (v) => ["plat", "doux", "vallonné", "montagneux"][v], info: "Les pentes font rouler la balle et changent les trajectoires." },
      { id: "hazards", label: "Pièges", type: "range", min: 0, max: 3, step: 1, default: 2, format: (v) => ["aucun", "peu", "normal", "beaucoup"][v], info: "Eau, lave, sable, glace, boue et gelée selon le biome." },
      { id: "obstacles", label: "Obstacles", type: "range", min: 0, max: 3, step: 1, default: 2, format: (v) => ["aucun", "peu", "normal", "beaucoup"][v], info: "Arbres, cactus, rochers, bonshommes de neige et autres." },
      { id: "features", label: "Animations du terrain", type: "multi", default: FEATURE_OPTIONS.map((f) => f.value), options: FEATURE_OPTIONS, info: "Ce qui bouge ou qui réagit sur le terrain. Décoche ce que tu n'aimes pas." },
      { id: "wind", label: "Vent", type: "chips", default: 1, options: [{ value: 0, label: "Aucun" }, { value: 1, label: "Léger" }, { value: 2, label: "Fort" }], info: "Le vent pousse les balles en vol. Une flèche indique sa direction." },
      { id: "seed", label: "Graine du parcours", type: "text", default: "", max: 20, placeholder: "Laisse vide pour du hasard", info: "Écris un mot pour rejouer exactement le même parcours plus tard ou avec des amis." },
    ] },
    { category: "🏌️ Les clubs", rules: [
      { id: "clubs", label: "Clubs autorisés", type: "multi", default: CLUB_ORDER.slice(), options: CLUB_ORDER.map((id) => ({ value: id, label: CLUBS[id].name, icon: CLUBS[id].icon, desc: CLUBS[id].desc })), info: "Le putter est toujours disponible pour ne jamais rester bloqué." },
      { id: "precision", label: "Précision des coups", type: "chips", default: 1, options: [{ value: 0.5, label: "Facile" }, { value: 1, label: "Normale" }, { value: 1.6, label: "Réaliste" }], info: "Facile réduit de moitié les erreurs de visée, réaliste les augmente." },
      { id: "heightControl", label: "Hauteur du tir réglable", type: "bool", default: true, info: "Quand c'est actif, chaque club se joue sur cinq hauteurs, de très bas à très haut. Un tir bas va plus droit et roule mais cogne les arbres, un tir haut passe au dessus des obstacles mais se pose plus court ou plus long selon le club. Sinon chaque club garde son angle habituel." },
      { id: "aimAssist", label: "Aide à la visée", type: "chips", default: "zone", options: [{ value: "none", label: "Aucune" }, { value: "dots", label: "Direction seule" }, { value: "zone", label: "Zone d'arrivée" }, { value: "traj", label: "Trajectoire exacte" }], info: "Zone d'arrivée montre l'arc de la balle jusqu'à son atterrissage et un grand cercle où elle devrait finir, sans dire où elle rebondit. Une alerte prévient seulement quand un obstacle ou un danger est proche. Trajectoire exacte dessine tout le vol, les rebonds et les obstacles touchés, pour apprendre. Direction seule montre juste une flèche. Aucune est le mode des experts. Valable pour tous les joueurs." },
      { id: "cupSize", label: "Taille du trou", type: "chips", default: 1, options: [{ value: 1.5, label: "Grand" }, { value: 1, label: "Normal" }, { value: 0.75, label: "Petit" }], info: "Un grand trou avale aussi les balles un peu rapides." },
    ] },
    { category: "✨ Les pouvoirs", rules: [
      { id: "powersOn", label: "Orbes et pouvoirs", type: "bool", default: true, info: "Des orbes flottent sur le terrain. En roulant dessus tu gagnes un pouvoir pour aider ta balle ou embêter les autres." },
      { id: "orbs", label: "Orbes par trou", type: "range", min: 1, max: 6, step: 1, default: 3, showIf: { powersOn: true }, info: "Le nombre d'orbes à ramasser sur chaque terrain." },
      { id: "orbRespawn", label: "Retour des orbes", type: "chips", default: 30, options: [{ value: 0, label: "Jamais" }, { value: 20, label: "20 s" }, { value: 30, label: "30 s" }, { value: 60, label: "1 min" }], showIf: { powersOn: true }, info: "Une orbe ramassée réapparaît après ce délai." },
      { id: "powerSlots", label: "Pouvoirs gardés en réserve", type: "chips", default: 2, options: [1, 2, 3], showIf: { powersOn: true }, info: "Combien de pouvoirs tu peux porter en même temps." },
      { id: "powerSet", label: "Pouvoirs en jeu", type: "multi", default: POWER_ORDER.slice(), options: POWER_ORDER.map((id) => ({ value: id, label: POWERS[id].name, icon: POWERS[id].icon, desc: POWERS[id].desc })), showIf: { powersOn: true }, info: "Décoche les pouvoirs que tu ne veux pas dans la partie." },
    ] },
  ];

  const allRules = () => SCHEMA.reduce((a, c) => a.concat(c.rules), []);
  function defaults() { const o = {}; allRules().forEach((r) => { o[r.id] = Array.isArray(r.default) ? r.default.slice() : r.default; }); return o; }
  function valuesOf(rule) { return (rule.options || []).map((o) => (typeof o === "object" ? o.value : o)); }
  function normalize(input) {
    const out = defaults();
    allRules().forEach((r) => {
      let v = input ? input[r.id] : undefined; if (v === undefined) return;
      if (r.type === "bool") out[r.id] = !!v;
      else if (r.type === "range") { v = Math.round(Number(v)); if (!isFinite(v)) return; out[r.id] = Math.max(r.min, Math.min(r.max, v)); }
      else if (r.type === "text") out[r.id] = String(v).replace(/[\u0000-\u001f<>]/g, "").slice(0, r.max || 20);
      else if (r.type === "multi") { const ok = valuesOf(r); out[r.id] = Array.isArray(v) ? v.filter((x) => ok.includes(x)) : r.default.slice(); }
      else { const ok = valuesOf(r); const want = typeof ok[0] === "number" ? Number(v) : v; if (ok.includes(want)) out[r.id] = want; }
    });
    if (!out.biomes.length) out.biomes = [Course.BIOME_IDS[0]];
    if (!out.clubs.includes("putter")) out.clubs.push("putter");
    return out;
  }
  // Génère le trou numéro index d'une partie. Le serveur et l'aperçu du salon passent par ici pour obtenir exactement le même terrain.
  function pickBiome(s, i, r) {
    const list = s.biomes;
    if (s.biomeOrder === "unique") return list[0];
    if (s.biomeOrder === "ordre") return list[i % list.length];
    return list[Math.floor(r() * list.length)];
  }
  function holeFor(s, baseSeed, index) {
    const r = Course.mulberry32(Course.hashSeed(baseSeed + "#" + index));
    const biome = pickBiome(s, index, r);
    const size = s.holeLength || [1, 2, 2, 3][Math.floor(r() * 4)];
    const ang = r() * Math.PI * 2; const wmag = [0, 0.9, 2.1][s.wind || 0];
    const features = {}; s.features.forEach((f) => { features[f] = true; });
    const hole = Course.generateHole({ seed: baseSeed + "#" + index, biome, size, difficulty: s.difficulty, hills: s.hills, hazards: s.hazards, obstacles: s.obstacles, features, orbs: s.powersOn ? s.orbs : 0, wind: [Math.cos(ang) * wmag, Math.sin(ang) * wmag] });
    hole.cupR = 0.52 * s.cupSize;
    return hole;
  }
  return { holeFor, SCORE, placePts, scoringText, SCHEMA, CLUBS, CLUB_ORDER, HEIGHT_NAMES, HEIGHT_DEFAULT, hasHeight, loftFor, stars, POWERS, POWER_ORDER, defaults, normalize, allRules };
});

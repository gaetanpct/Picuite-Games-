// ============================================================
// ZOOMALOU — Réglages (source unique)
// ============================================================
(function (root, factory) {
  if (typeof module !== "undefined" && module.exports) module.exports = factory(require("./track.js"), require("./car.js"));
  else root.ZoomRules = factory(root.ZoomTrack, root.ZoomCar);
})(typeof window !== "undefined" ? window : globalThis, function (Track, Car) {
  // réglages supprimés de l'écran, ils gardent une valeur fixe
  const FIXED = { refTries: 1, giveUp: "elimine", garage: 10, biomeOrder: "hasard", ghost: true, others: true, verify: "replay" };
  const BIOME_OPTIONS = Track.BIOME_IDS.map((id) => ({ value: id, label: Track.BIOMES[id].name, icon: Track.BIOMES[id].icon }));
  const FEATURE_OPTIONS = [
    { value: "boosts", label: "Tapis turbo", icon: "⏩", desc: "Des tapis orange qui donnent un coup d'accélérateur, et parfois des super turbos violets, plus courts et bien plus forts." },
    { value: "jumps", label: "Bosses et sauts", icon: "🦘", desc: "Des bosses qui font décoller la voiture. Attention à l'atterrissage." },
    { value: "gaps", label: "Trous à sauter", icon: "🕳️", desc: "Un trou dans la route à franchir en l'air, parfois deux à la suite, parfois avec une réception bien plus bas ou plus haut. Le tremplin est calculé pour que ce soit toujours possible, même avec la voiture la plus lente." },
    { value: "steep", label: "Côtes et descentes raides", icon: "⛰️", desc: "Des montées très pentues où il faut de l'élan, et des descentes qui lancent la voiture." },
    { value: "obstacles", label: "Obstacles", icon: "🧱", desc: "Rochers, plots et barrières posés sur la route. Un passage est toujours laissé libre." },
    { value: "widths", label: "Route large ou étroite", icon: "↔️", desc: "La largeur change beaucoup, avec des goulots et de grandes arènes." },
    { value: "bridges", label: "Ponts sans rebord", icon: "🌉", desc: "Ponts droits, viaducs en courbe, passerelles très étroites et ponts ondulés, tous sans mur. Une sortie de route fait tomber la voiture." },
    { value: "forks", label: "Embranchements", icon: "🔀", desc: "La route se sépare en deux voies qui se rejoignent plus loin. L'une est plus courte mais piégée, terre, saut, obstacles, étroite ou en tunnel. L'autre est plus longue et plus sûre, parfois avec des turbos." },
    { value: "cross", label: "Croisements sur deux niveaux", icon: "🎢", desc: "La route fait un grand tour en montant et repasse au-dessus d'elle-même sur un pont." },
    { value: "xing", label: "Carrefours à niveau", icon: "✖️", desc: "La route fait un grand tour et recoupe son propre passage à la même hauteur. En chrono contact, gare aux voitures qui arrivent sur le côté." },
    { value: "bank", label: "Virages relevés", icon: "🌀", desc: "De grandes courbes inclinées vers l'intérieur, comme sur un anneau de vitesse. On les prend bien plus vite qu'un virage plat." },
    { value: "cut", label: "Raccourcis par les airs", icon: "🛫", desc: "La route fait un grand détour et un tremplin, d'un seul côté, permet de couper tout droit. Il faut arriver vite et bien droit, sinon la voiture tombe dans le détour et revient au point de contrôle." },
    { value: "verges", label: "Bas-côtés sans barrière", icon: "🌾", desc: "Des portions bordées de sable, d'herbe ou de neige au lieu d'un mur. Sortir de la route y freine beaucoup et fait glisser, une clôture basse arrête la voiture plus loin." },
    { value: "movers", label: "Routes qui bougent", icon: "〰️", desc: "Des portions de route qui ondulent en vagues ou basculent comme un plateau pendant la course. Prises au bon moment elles font sauter la voiture." },
    { value: "rings", label: "Anneaux turbo", icon: "⭕", desc: "Des anneaux à traverser, au sommet des sauts ou en portique sur la route. Passer dedans donne un gros turbo." },
    { value: "mag", label: "Zones sans gravité", icon: "🌀", desc: "Looping, vrille, mur et plafond. La voiture reste collée à la route même la tête en bas. La route n'est jamais à l'envers ailleurs que dans ces zones." },
    { value: "surfaces", label: "Sols variés", icon: "🧊", desc: "Terre, glace ou matière collante selon le biome. L'adhérence change." },
  ];
  const fmtMult = (v) => v + " fois";
  const SCHEMA = [
    { category: "🏁 La partie", rules: [
      { id: "format", label: "Format", type: "cards", default: "libre", options: [
        { value: "libre", label: "Partie classique", icon: "🏁", desc: "Une série de courses indépendantes, chacune sur un nouveau circuit." },
        { value: "etapes", label: "Course à étapes", icon: "🚴", desc: "De trois à cinq étapes au profil différent, plaine, montagne, étape folle et une étape reine pour finir. Une étape sur deux la voiture est imposée à tout le monde, sinon chacun choisit la sienne. Le classement général additionne les temps et son premier porte le maillot jaune." },
      ], showIf: { mode: ["chrono", "contact"] }, info: "La course à étapes se joue en chrono fantôme ou en chrono contact." },
      { id: "stages", label: "Nombre d'étapes", type: "chips", default: 4, options: [{ value: 3, label: "3 étapes" }, { value: 4, label: "4 étapes" }, { value: 5, label: "5 étapes" }], showIf: { format: "etapes", mode: ["chrono", "contact"] } },
      { id: "survie", label: "Survie", type: "bool", default: false, showIf: { format: "libre", mode: ["chrono", "contact"] }, info: "À chaque point de contrôle, le dernier à le franchir est éliminé. Quand il reste peu de points de contrôle, plusieurs pilotes peuvent sortir d'un coup, et la ligne d'arrivée élimine tous ceux qui ne sont pas premiers. Les circuits sont au moins longs pour laisser le temps de remonter. Le classement suit l'ordre d'élimination." },
      { id: "rounds", label: "Nombre de courses", type: "range", min: 1, max: 12, step: 1, default: 5, info: "Chaque course se joue sur un nouveau circuit généré pour toi. À chaque course, chaque place rapporte un nombre de points différent. Le dernier en marque un, le premier en marque le plus, et un pilote sans temps ne marque rien." },
      { id: "winRule", label: "Qui gagne la compétition", type: "cards", default: "points", options: [
        { value: "points", label: "Classement et points", icon: "🏅", desc: "Chaque course rapporte des points selon la place. Le plus de points au total gagne." },
        { value: "temps", label: "Cumul des temps", icon: "⏱️", desc: "On additionne le meilleur temps de chaque pilote sur toutes les courses. Le plus petit total gagne. Un pilote sans temps reçoit celui du dernier de la course plus cinq secondes." },
        { value: "mixte", label: "Mixte", icon: "⚖️", desc: "On additionne la place au classement des points et la place au classement des temps cumulés. Le plus petit total gagne, et à égalité le meilleur temps cumulé l'emporte." },
      ], showIf: { mode: ["chrono", "contact"], format: "libre", survie: false }, info: "Ne concerne que les modes chrono. En mode essence, le classement se fait toujours aux points. En survie aussi." },
      { id: "mode", label: "Mode de jeu", type: "cards", default: "essence", options: [
        { value: "essence", label: "Essence", icon: "⛽", desc: "Chaque pilote a un réservoir proportionnel à la durée du circuit, et chaque essai en consomme, y compris le premier. Chacun pose un temps, puis le dernier du classement joue avec l'essence qui lui reste pour battre l'avant-dernier. Tant qu'il reste dernier c'est encore à lui. Sans essence, il garde un tout dernier essai pour reprendre la place, et s'il le rate il est éliminé. Les duels peuvent donc se répéter longtemps. Le dernier pilote en course gagne." },
        { value: "chrono", label: "Chrono fantôme", icon: "👻", desc: "Tout le monde part en même temps depuis la même ligne, n'a droit qu'à un seul essai sans recommencer, et le meilleur temps gagne. Les voitures sont des fantômes, elles ne se touchent jamais." },
        { value: "contact", label: "Chrono contact", icon: "💥", desc: "Même principe, mais les voitures sont bien réelles. Un seul essai, on se pousse, on se gêne, on dévie un adversaire en le percutant. Le départ se fait côte à côte pour que ce soit équitable." },
      ] },
      { id: "order", label: "Ordre pour poser les temps", type: "cards", default: "tour", options: [
        { value: "tour", label: "À tour de rôle", icon: "🔁", desc: "Le pilote qui ouvre la course change à chaque manche, dans l'ordre des places." },
        { value: "retard", label: "Le dernier d'abord", icon: "🐢", desc: "Le dernier du classement général pose son temps en premier." },
      ], showIf: { mode: "essence" } },
      { id: "roundTime", label: "Temps pour se lancer en chrono et en contact", type: "chips", default: 0, options: [{ value: 0, label: "Adapté au circuit" }, { value: 60, label: "1 min" }, { value: 90, label: "1 min 30" }, { value: 120, label: "2 min" }, { value: 180, label: "3 min" }, { value: 240, label: "4 min" }], showIf: { mode: ["chrono", "contact"] }, info: "Après le départ commun, chacun n'a qu'un seul essai par course. Ce temps est la limite pour partir. Sur Adapté au circuit, la durée suit la longueur du tracé, donc une course courte ne laisse pas traîner. Quoi qu'il arrive, un pilote déjà parti garde le temps de finir son essai, qui ne peut donc jamais être gâché par la fin du chrono. La course s'arrête plus tôt si tout le monde a fini ou abandonné." },
      { id: "carMode", label: "Choix des voitures", type: "chips", default: "winner", options: [{ value: "winner", label: "Le dernier vainqueur choisit" }, { value: "own", label: "Chacun la sienne" }, { value: "random", label: "Tirée au sort à chaque course" }], info: "Le dernier vainqueur choisit, celui qui a gagné la course précédente choisit la voiture de tout le monde (l'hôte pour la première course). Chacun la sienne, chaque pilote choisit sa voiture au garage. Tirée au sort, une voiture au hasard pour tous à chaque course." },
    ] },
    { category: "🛣️ Le circuit", rules: [
      { id: "biomes", label: "Biomes possibles", type: "multi", default: Track.BIOME_IDS.slice(), options: BIOME_OPTIONS, info: "Coche les décors que tu veux croiser. Chaque biome change la façon de piloter. Côte est la référence, Neige glisse, Néon a une gravité faible et des anneaux, Mégapole retourne la voiture dans des tubes, Jungle multiplie la terre et les embranchements, Usine fait bouger la route, Fête foraine croise ses routes et plonge, Dunes n'a presque pas de murs." },
      { id: "trackSize", label: "Longueur des circuits", type: "chips", default: 2, options: [{ value: 1, label: "Court" }, { value: 2, label: "Moyen" }, { value: 3, label: "Long" }, { value: 4, label: "Très long" }, { value: 5, label: "Géant" }], info: "Court fait environ 30 secondes de conduite, moyen environ 45, long environ 1 minute 15, très long environ 2 minutes, géant 3 minutes ou plus. Les circuits géants sont faits pour de vraies courses d'endurance." },
      { id: "difficulty", label: "Difficulté du circuit", type: "range", min: 1, max: 5, step: 1, default: 3, info: "En facile la route est presque toujours large avec peu d'éléments. En moyen, des passages larges et des passages étroits se mélangent. En très très dur, la route est serrée la plupart du temps, avec des virages serrés, des corniches sans rebord et beaucoup d'éléments. Les passages étroits tombent au hasard, chaque course est différente." },
      { id: "elements", label: "Quantité d'éléments sur le circuit", type: "chips", default: "auto", options: [{ value: "auto", label: "Selon la difficulté" }, { value: "peu", label: "Peu" }, { value: "moyen", label: "Moyenne" }, { value: "beaucoup", label: "Beaucoup" }], info: "Règle le nombre de virages serrés, de sauts, d'obstacles, de ponts et de montées. Selon la difficulté, un circuit facile en a peu et reste large, un circuit très difficile en a beaucoup et se resserre souvent." },
      { id: "hills", label: "Relief", type: "range", min: 0, max: 3, step: 1, default: 2, format: (v) => ["plat", "doux", "vallonné", "montagneux"][v], info: "Les bosses font décoller la voiture, les côtes la ralentissent." },
      { id: "rnd", label: "Circuits différents à chaque course", type: "multi", default: [], options: [
        { value: "size", label: "Longueur", icon: "📏", desc: "Court, moyen ou long, tiré au sort à chaque course." },
        { value: "difficulty", label: "Difficulté", icon: "🎯", desc: "Facile, intermédiaire ou difficile, tiré au sort à chaque course." },
        { value: "elements", label: "Quantité d'éléments", icon: "🧩", desc: "Peu, moyenne ou beaucoup d'obstacles, de tremplins, de virages et de turbos." },
        { value: "hills", label: "Relief", icon: "⛰️", desc: "Plat, doux, vallonné ou montagneux, tiré au sort à chaque course." },
      ], info: "Coche ce qui doit changer au hasard d'une course à l'autre, quel que soit le mode. Un point coché remplace le réglage du même nom juste au dessus. Deux courses de suite ne reprennent jamais la même valeur. Les dégâts des chocs se règlent à part, dans la conduite, et la sortie de piste ne change jamais." },
      { id: "features", label: "Animations du circuit", type: "multi", default: FEATURE_OPTIONS.map((f) => f.value), options: FEATURE_OPTIONS, info: "Décoche ce que tu n'aimes pas. Chaque élément est tiré au sort selon le biome et la difficulté." },
      { id: "seed", label: "Graine du parcours", type: "text", default: "", max: 20, placeholder: "Laisse vide pour du hasard", info: "Écris un mot pour rejouer exactement les mêmes circuits plus tard ou avec des amis." },
    ] },
    { category: "🚗 La conduite", rules: [
      { id: "botPace", label: "Vitesse des tours des pilotes automatiques", type: "chips", default: 2, options: [{ value: 1, label: "Normale" }, { value: 2, label: "Deux fois plus vite" }, { value: 4, label: "Quatre fois plus vite" }], showIf: { mode: "essence" }, info: "Les pilotes automatiques roulent en direct, essai après essai, avec leur essence qui baisse. Accélérer évite d'attendre quand ils ont un grand réservoir." },
      { id: "leave", label: "Sortie de piste", type: "chips", default: "mur", options: [{ value: "mur", label: "Murs infranchissables" }, { value: "cp", label: "Sortie permise, retour au point de contrôle" }, { value: "zero", label: "Sortie permise, retour au départ" }], info: "Sur Murs infranchissables, les bords du circuit arrêtent toujours la voiture, c'est le mode assisté. Sur les deux autres, un saut trop haut ou trop long peut passer par dessus la barrière. La voiture sort alors du circuit et retombe, puis elle repart soit du dernier point de contrôle, soit de la ligne de départ. Le chrono continue de tourner pendant ce temps." },
      { id: "crashRnd", label: "Dégâts des chocs aléatoires", type: "bool", default: false, info: "Si c'est activé, les dégâts des chocs sont tirés au sort à chaque course, doux, normaux ou brutaux, sans jamais répéter la valeur de la course précédente. Cette option est indépendante des circuits aléatoires." },
      { id: "crash", label: "Dégâts des chocs", showIf: { crashRnd: false }, type: "chips", default: "normal", options: [{ value: "doux", label: "Doux" }, { value: "normal", label: "Normaux" }, { value: "brutal", label: "Brutaux" }], info: "Règle ce que coûte un choc contre un mur, un obstacle ou un atterrissage raté. Avec des chocs brutaux, un frottement de mur te fait perdre beaucoup de vitesse, comme en course de compétition. En doux, les erreurs se pardonnent plus facilement." },
    ] },
  ];
  const allRules = () => SCHEMA.reduce((a, c) => a.concat(c.rules), []);
  function defaults() { const o = {}; allRules().forEach((r) => { o[r.id] = Array.isArray(r.default) ? r.default.slice() : r.default; }); return Object.assign(o, FIXED); }
  const valuesOf = (rule) => (rule.options || []).map((o) => (typeof o === "object" ? o.value : o));
  function normalize(input) {
    const out = Object.assign(defaults(), FIXED);
    allRules().forEach((r) => {
      let v = input ? input[r.id] : undefined; if (v === undefined) return;
      if (r.type === "bool") out[r.id] = !!v;
      else if (r.type === "range") { v = Number(v); if (!isFinite(v)) return; const st = r.step || 1; v = Math.round(v / st) * st; out[r.id] = Math.max(r.min, Math.min(r.max, v)); }
      else if (r.type === "text") out[r.id] = String(v).replace(/[\u0000-\u001f<>]/g, "").slice(0, r.max || 20);
      else if (r.type === "multi") { const ok = valuesOf(r); out[r.id] = Array.isArray(v) ? v.filter((x) => ok.includes(x)) : r.default.slice(); }
      else { const ok = valuesOf(r); const want = typeof ok[0] === "number" ? Number(v) : v; if (ok.includes(want)) out[r.id] = want; }
    });
    if (!out.biomes.length) out.biomes = [Track.BIOME_IDS[0]];
    out.trace = cleanTrace(input && input.trace);
    if (out.mode === "essence") { out.format = "libre"; out.survie = false; }
    if (out.format === "etapes") { out.survie = false; out.winRule = "temps"; out.rounds = out.stages; }
    if (out.survie) out.winRule = "points";
    Object.assign(out, FIXED);
    return out;
  }
  // tracé dessiné à la souris. Points entiers de 0 à 1000 à plat, x puis y, taille de la carte en mètres, type de croisement
  function cleanTrace(t) {
    if (!t || typeof t !== "object" || !Array.isArray(t.p)) return null; const p = [];
    for (let i = 0; i + 1 < t.p.length && p.length < 1600; i += 2) { const a = Math.round(Number(t.p[i])), b = Math.round(Number(t.p[i + 1])); if (!isFinite(a) || !isFinite(b)) continue; p.push(Math.max(0, Math.min(1000, a)), Math.max(0, Math.min(1000, b))); }
    if (p.length < 16) return null; const sz = [500, 900, 1400].includes(Number(t.s)) ? Number(t.s) : 900;
    return { p, s: sz, x: t.x === "niveau" ? "niveau" : "pont", name: String(t.name || "").replace(/[\u0000-\u001f<>]/g, "").slice(0, 24) };
  }
  // profils des étapes. La dernière est toujours l'étape reine, les autres tournent
  const STAGES = { plaine: { id: "plaine", name: "Étape de plaine", icon: "🌾", hills: 0, elements: "peu", diff: -1, size: 0 }, montagne: { id: "montagne", name: "Étape de montagne", icon: "⛰️", hills: 3, elements: "moyen", diff: 0, size: 0 }, folle: { id: "folle", name: "Étape folle", icon: "🎢", hills: 2, elements: "beaucoup", diff: 0, size: 0 }, reine: { id: "reine", name: "Étape reine", icon: "👑", hills: 3, elements: "beaucoup", diff: 1, size: 1 } };
  function stageOf(s, i) {
    if (!s || s.format !== "etapes") return null; const n = s.stages || 4; const id = i >= n - 1 ? "reine" : ["plaine", "montagne", "folle"][i % 3];
    return Object.assign({ i, n, car: i % 2 === 1 ? "imposee" : "libre" }, STAGES[id]);
  }
  // choix des voitures réellement appliqué à une course. En course à étapes, une étape sur deux la voiture est tirée au sort pour tous
  const carModeFor = (s, i) => (s && s.format === "etapes" ? (i % 2 === 1 ? "random" : "own") : s.carMode);
  function pickBiome(s, i, r) { const l = s.biomes; if (s.biomeOrder === "unique") return l[0]; if (s.biomeOrder === "ordre") return l[i % l.length]; return l[Math.floor(r() * l.length)]; }
  // génère le circuit numéro index d'une partie, identique pour le serveur et pour l'aperçu du salon
  // valeurs tirées au sort pour la course numéro index. Chaque paramètre a son propre tirage et ne reprend jamais la valeur de la course d'avant
  const RND_SETS = { size: [1, 2, 3], difficulty: ["facile", "moyen", "dur"], elements: ["peu", "moyen", "beaucoup"], hills: [0, 1, 2, 3], crash: ["doux", "normal", "brutal"] };
  const RND_LABEL = { size: { 1: "courte", 2: "moyenne", 3: "longue" }, difficulty: { facile: "facile", moyen: "intermédiaire", dur: "difficile" }, elements: { peu: "peu d'éléments", moyen: "éléments moyens", beaucoup: "beaucoup d'éléments" }, hills: { 0: "plat", 1: "relief doux", 2: "vallonné", 3: "montagneux" }, crash: { doux: "chocs doux", normal: "chocs normaux", brutal: "chocs brutaux" } };
  const DIFF_VALUE = (tier, r) => (tier === "facile" ? 1 + Math.floor(r() * 2) : tier === "dur" ? 4 + Math.floor(r() * 2) : 3);
  function drawFor(key, baseSeed, index) {
    const set = RND_SETS[key]; let prev = null, v = null;
    for (let i = 0; i <= index; i++) { const r = Track.mulberry32(Track.hashSeed(baseSeed + "rnd" + key + i)); let pick = set[Math.floor(r() * set.length)]; if (pick === prev) pick = set[(set.indexOf(pick) + 1 + Math.floor(r() * (set.length - 1))) % set.length]; v = pick; prev = pick; }
    return v;
  }
  // réglages réellement utilisés pour la course index, avec ce qui a été tiré au sort
  function paramsFor(s, baseSeed, index) {
    const rnd = s.rnd || []; const p = { size: s.trackSize, difficulty: s.difficulty, elements: s.elements, hills: s.hills, drawn: [] };
    if (rnd.includes("size")) { p.size = drawFor("size", baseSeed, index); p.drawn.push(RND_LABEL.size[p.size]); }
    if (rnd.includes("difficulty")) { const tier = drawFor("difficulty", baseSeed, index); const r = Track.mulberry32(Track.hashSeed(baseSeed + "dv" + index)); p.difficulty = DIFF_VALUE(tier, r); p.drawn.push(RND_LABEL.difficulty[tier]); }
    if (rnd.includes("elements")) { p.elements = drawFor("elements", baseSeed, index); p.drawn.push(RND_LABEL.elements[p.elements]); }
    if (rnd.includes("hills")) { p.hills = drawFor("hills", baseSeed, index); p.drawn.push(RND_LABEL.hills[p.hills]); }
    return p;
  }
  function trackFor(s, baseSeed, index) {
    const r = Track.mulberry32(Track.hashSeed(baseSeed + "#" + index));
    const biome = pickBiome(s, index, r); const pp = paramsFor(s, baseSeed, index); const st = stageOf(s, index);
    if (st) { pp.hills = st.hills; pp.elements = st.elements; pp.difficulty = Math.max(1, Math.min(5, pp.difficulty + st.diff)); pp.size = Math.max(1, Math.min(5, pp.size + st.size)); }
    if (s.survie) pp.size = Math.max(3, pp.size);
    const spec = { seed: baseSeed + "#" + index, biome, size: pp.size, difficulty: pp.difficulty, hills: pp.hills, elements: pp.elements, features: FEATURE_OPTIONS.reduce((o, f) => { o[f.value] = s.features.includes(f.value); return o; }, {}) };
    // un circuit dessiné reste le même à chaque course, seul le biome peut changer
    if (s.trace) { spec.trace = s.trace; spec.seed = "trace" + (s.seed || "") + s.trace.p.length; }
    const tr = Track.generate(spec);
    tr.drawn = pp.drawn.slice(); if (s.crashRnd) tr.drawn.push(RND_LABEL.crash[crashKey(s, baseSeed, index)]);
    if (st) tr.stage = st;
    return tr;
  }
  const CRASH_K = { doux: 0.5, normal: 1, brutal: 1.6 };
  const crashKey = (s, baseSeed, index) => (s && s.crashRnd ? drawFor("crash", baseSeed || "", index || 0) : (s && s.crash) || "normal");
  const crashK = (s, baseSeed, index) => CRASH_K[crashKey(s, baseSeed, index)] || 1;
  // barème des points pour n pilotes, une valeur différente par place. La dernière place vaut 1, chaque place de plus ajoute 1, et le haut du classement reçoit un bonus
  function scale(n) {
    n = Math.max(1, Math.floor(n)); const b = Math.max(1, Math.round(n / 3)); const out = [];
    for (let i = 0; i < n; i++) out.push(n - i + Math.max(0, b - i));
    return out;
  }
  return { SCHEMA, defaults, normalize, trackFor, allRules, crashK, crashKey, paramsFor, scale, stageOf, carModeFor, cleanTrace, STAGES };
});

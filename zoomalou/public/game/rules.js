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
    { value: "boosts", label: "Tapis turbo", icon: "⏩", desc: "Des tapis orange qui donnent un coup d'accélérateur." },
    { value: "jumps", label: "Bosses et sauts", icon: "🦘", desc: "Des bosses qui font décoller la voiture. Attention à l'atterrissage." },
    { value: "gaps", label: "Trous à sauter", icon: "🕳️", desc: "Un trou dans la route à franchir en l'air. Le tremplin est calculé pour que ce soit toujours possible, même avec la voiture la plus lente." },
    { value: "steep", label: "Côtes et descentes raides", icon: "⛰️", desc: "Des montées très pentues où il faut de l'élan, et des descentes qui lancent la voiture." },
    { value: "obstacles", label: "Obstacles", icon: "🧱", desc: "Rochers, plots et barrières posés sur la route. Un passage est toujours laissé libre." },
    { value: "widths", label: "Route large ou étroite", icon: "↔️", desc: "La largeur change beaucoup, avec des goulots et de grandes arènes." },
    { value: "bridges", label: "Ponts sans rebord", icon: "🌉", desc: "Des ponts surélevés sans mur. Une sortie de route fait tomber la voiture." },
    { value: "mag", label: "Zones sans gravité", icon: "🌀", desc: "Looping, vrille, mur et plafond. La voiture reste collée à la route même la tête en bas. La route n'est jamais à l'envers ailleurs que dans ces zones." },
    { value: "surfaces", label: "Sols variés", icon: "🧊", desc: "Terre, glace ou matière collante selon le biome. L'adhérence change." },
  ];
  const fmtMult = (v) => v + " fois";
  const SCHEMA = [
    { category: "🏁 La partie", rules: [
      { id: "rounds", label: "Nombre de courses", type: "range", min: 1, max: 12, step: 1, default: 5, info: "Chaque course se joue sur un nouveau circuit généré pour toi." },
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
      { id: "biomes", label: "Biomes possibles", type: "multi", default: Track.BIOME_IDS.slice(), options: BIOME_OPTIONS, info: "Coche les décors que tu veux croiser. Chaque biome a sa couleur de route, sa gravité et ses types de sols." },
      { id: "trackSize", label: "Longueur des circuits", type: "chips", default: 2, options: [{ value: 1, label: "Court" }, { value: 2, label: "Moyen" }, { value: 3, label: "Long" }, { value: 4, label: "Très long" }, { value: 5, label: "Géant" }], info: "Court fait environ 30 secondes de conduite, moyen environ 45, long environ 1 minute 15, très long environ 2 minutes, géant 3 minutes ou plus. Les circuits géants sont faits pour de vraies courses d'endurance." },
      { id: "difficulty", label: "Difficulté du circuit", type: "range", min: 1, max: 5, step: 1, default: 3, info: "En facile la route est presque toujours large avec peu d'éléments. En moyen, des passages larges et des passages étroits se mélangent. En très très dur, la route est serrée la plupart du temps, avec des virages serrés, des corniches sans rebord et beaucoup d'éléments. Les passages étroits tombent au hasard, chaque course est différente." },
      { id: "elements", label: "Quantité d'éléments sur le circuit", type: "chips", default: "auto", options: [{ value: "auto", label: "Selon la difficulté" }, { value: "peu", label: "Peu" }, { value: "moyen", label: "Moyenne" }, { value: "beaucoup", label: "Beaucoup" }], info: "Règle le nombre de virages serrés, de sauts, d'obstacles, de ponts et de montées. Selon la difficulté, un circuit facile en a peu et reste large, un circuit très difficile en a beaucoup et se resserre souvent." },
      { id: "hills", label: "Relief", type: "range", min: 0, max: 3, step: 1, default: 2, format: (v) => ["plat", "doux", "vallonné", "montagneux"][v], info: "Les bosses font décoller la voiture, les côtes la ralentissent." },
      { id: "features", label: "Animations du circuit", type: "multi", default: FEATURE_OPTIONS.map((f) => f.value), options: FEATURE_OPTIONS, info: "Décoche ce que tu n'aimes pas. Chaque élément est tiré au sort selon le biome et la difficulté." },
      { id: "seed", label: "Graine du parcours", type: "text", default: "", max: 20, placeholder: "Laisse vide pour du hasard", info: "Écris un mot pour rejouer exactement les mêmes circuits plus tard ou avec des amis." },
    ] },
    { category: "🚗 La conduite", rules: [
      { id: "botPace", label: "Vitesse des tours des pilotes automatiques", type: "chips", default: 2, options: [{ value: 1, label: "Normale" }, { value: 2, label: "Deux fois plus vite" }, { value: 4, label: "Quatre fois plus vite" }], showIf: { mode: "essence" }, info: "Les pilotes automatiques roulent en direct, essai après essai, avec leur essence qui baisse. Accélérer évite d'attendre quand ils ont un grand réservoir." },
      { id: "leave", label: "Sortie de piste", type: "chips", default: "mur", options: [{ value: "mur", label: "Murs infranchissables" }, { value: "cp", label: "Sortie permise, retour au point de contrôle" }, { value: "zero", label: "Sortie permise, retour au départ" }], info: "Sur Murs infranchissables, les bords du circuit arrêtent toujours la voiture, c'est le mode assisté. Sur les deux autres, un saut trop haut ou trop long peut passer par dessus la barrière. La voiture sort alors du circuit et retombe, puis elle repart soit du dernier point de contrôle, soit de la ligne de départ. Le chrono continue de tourner pendant ce temps." },
      { id: "crash", label: "Dégâts des chocs", type: "chips", default: "normal", options: [{ value: "doux", label: "Doux" }, { value: "normal", label: "Normaux" }, { value: "brutal", label: "Brutaux" }], info: "Règle ce que coûte un choc contre un mur, un obstacle ou un atterrissage raté. Avec des chocs brutaux, un frottement de mur te fait perdre beaucoup de vitesse, comme en course de compétition. En doux, les erreurs se pardonnent plus facilement." },
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
    Object.assign(out, FIXED);
    return out;
  }
  function pickBiome(s, i, r) { const l = s.biomes; if (s.biomeOrder === "unique") return l[0]; if (s.biomeOrder === "ordre") return l[i % l.length]; return l[Math.floor(r() * l.length)]; }
  // génère le circuit numéro index d'une partie, identique pour le serveur et pour l'aperçu du salon
  function trackFor(s, baseSeed, index) {
    const r = Track.mulberry32(Track.hashSeed(baseSeed + "#" + index));
    const biome = pickBiome(s, index, r);
    return Track.generate({ seed: baseSeed + "#" + index, biome, size: s.trackSize, difficulty: s.difficulty, hills: s.hills, elements: s.elements, features: { boosts: s.features.includes("boosts"), jumps: s.features.includes("jumps"), surfaces: s.features.includes("surfaces"), gaps: s.features.includes("gaps"), steep: s.features.includes("steep"), obstacles: s.features.includes("obstacles"), widths: s.features.includes("widths"), bridges: s.features.includes("bridges"), mag: s.features.includes("mag") } });
  }
  const crashK = (s) => ({ doux: 0.5, normal: 1, brutal: 1.6 }[s && s.crash] || 1);
  return { SCHEMA, defaults, normalize, trackFor, allRules, crashK };
});

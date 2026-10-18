// ============================================================
// ZOOMALOU — Réglages (source unique)
// ============================================================
(function (root, factory) {
  if (typeof module !== "undefined" && module.exports) module.exports = factory(require("./track.js"), require("./car.js"));
  else root.ZoomRules = factory(root.ZoomTrack, root.ZoomCar);
})(typeof window !== "undefined" ? window : globalThis, function (Track, Car) {
  const BIOME_OPTIONS = Track.BIOME_IDS.map((id) => ({ value: id, label: Track.BIOMES[id].name, icon: Track.BIOMES[id].icon }));
  const FEATURE_OPTIONS = [
    { value: "boosts", label: "Tapis turbo", icon: "⏩", desc: "Des tapis orange qui donnent un coup d'accélérateur." },
    { value: "jumps", label: "Bosses et sauts", icon: "🦘", desc: "Des bosses qui font décoller la voiture. Attention à l'atterrissage." },
    { value: "surfaces", label: "Sols variés", icon: "🧊", desc: "Terre, glace ou matière collante selon le biome. L'adhérence change." },
  ];
  const fmtMult = (v) => v + " fois";
  const SCHEMA = [
    { category: "🏁 La partie", rules: [
      { id: "rounds", label: "Nombre de courses", type: "range", min: 1, max: 12, step: 1, default: 5, info: "Chaque course se joue sur un nouveau circuit généré pour toi." },
      { id: "mode", label: "Mode de jeu", type: "cards", default: "essence", options: [
        { value: "essence", label: "Essence", icon: "⛽", desc: "Le premier pilote pose un temps. Les autres, à tour de rôle, ont une réserve d'essence limitée pour le battre, avec autant d'essais que le réservoir le permet." },
        { value: "chrono", label: "Chrono", icon: "⏱️", desc: "Tout le monde roule en même temps, recommence autant qu'il veut, et le meilleur temps gagne." },
      ] },
      { id: "refTries", label: "Essais du premier pilote", type: "chips", default: 1, options: [1, 2, 3], showIf: { mode: "essence" }, info: "Le premier pilote de la course pose le temps à battre, sans limite d'essence. Avec plusieurs essais son meilleur temps compte." },
      { id: "tankMode", label: "Taille du réservoir", type: "chips", default: "relatif", options: [{ value: "relatif", label: "Selon le record" }, { value: "fixe", label: "Durée fixe" }], showIf: { mode: "essence" }, info: "Selon le record, le réservoir vaut un multiple du temps à battre, ce qui garde la tension sur les petits comme sur les grands circuits. Durée fixe donne le même nombre de secondes à chaque défi." },
      { id: "tankFactor", label: "Réservoir en multiple du record", type: "range", min: 1, max: 10, step: 0.5, default: 3, format: fmtMult, showIf: { mode: "essence", tankMode: "relatif" }, info: "Avec 3 fois, un record de 40 secondes donne 120 secondes de conduite au challenger, essais ratés compris. Chaque redémarrage brûle l'essence déjà utilisée." },
      { id: "tankSeconds", label: "Durée du réservoir", type: "chips", default: 60, options: [{ value: 30, label: "30 s" }, { value: 45, label: "45 s" }, { value: 60, label: "1 min" }, { value: 90, label: "1 min 30" }, { value: 120, label: "2 min" }], showIf: { mode: "essence", tankMode: "fixe" }, info: "Le temps de conduite total dont dispose chaque challenger pour battre le record." },
      { id: "order", label: "Ordre des pilotes", type: "cards", default: "tour", options: [
        { value: "tour", label: "À tour de rôle", icon: "🔁", desc: "Le pilote qui pose le temps change à chaque course, dans l'ordre des places." },
        { value: "retard", label: "Le dernier d'abord", icon: "🐢", desc: "Le dernier du classement joue en premier et pose le temps. Le leader passe en dernier et doit battre tout le monde." },
      ], showIf: { mode: "essence" } },
      { id: "roundTime", label: "Durée d'une course en chrono", type: "chips", default: 120, options: [{ value: 60, label: "1 min" }, { value: 90, label: "1 min 30" }, { value: 120, label: "2 min" }, { value: 180, label: "3 min" }, { value: 240, label: "4 min" }], showIf: { mode: "chrono" }, info: "Pendant ce temps, chacun enchaîne les essais. Seul le meilleur temps compte." },
      { id: "garage", label: "Temps au garage", type: "chips", default: 20, options: [{ value: 10, label: "10 s" }, { value: 20, label: "20 s" }, { value: 40, label: "40 s" }], info: "Avant chaque course, chacun choisit sa voiture. Le garage se ferme plus tôt quand tous les joueurs sont prêts." },
    ] },
    { category: "🛣️ Le circuit", rules: [
      { id: "biomes", label: "Biomes possibles", type: "multi", default: Track.BIOME_IDS.slice(), options: BIOME_OPTIONS, info: "Coche les décors que tu veux croiser. Chaque biome a sa couleur de route, sa gravité et ses types de sols." },
      { id: "biomeOrder", label: "Choix du biome à chaque course", type: "chips", default: "hasard", options: [{ value: "hasard", label: "Au hasard" }, { value: "ordre", label: "Dans l'ordre de la liste" }, { value: "unique", label: "Le même partout" }], info: "Le même partout prend le premier biome coché." },
      { id: "trackSize", label: "Longueur des circuits", type: "chips", default: 2, options: [{ value: 1, label: "Court" }, { value: 2, label: "Moyen" }, { value: 3, label: "Long" }], info: "Court fait environ 25 secondes de conduite, moyen environ 45, long plus d'une minute." },
      { id: "difficulty", label: "Difficulté du circuit", type: "range", min: 1, max: 5, step: 1, default: 3, info: "Plus c'est haut, plus la route est étroite avec des virages serrés et des enchaînements." },
      { id: "hills", label: "Relief", type: "range", min: 0, max: 3, step: 1, default: 2, format: (v) => ["plat", "doux", "vallonné", "montagneux"][v], info: "Les bosses font décoller la voiture, les côtes la ralentissent." },
      { id: "features", label: "Animations du circuit", type: "multi", default: FEATURE_OPTIONS.map((f) => f.value), options: FEATURE_OPTIONS, info: "Décoche ce que tu n'aimes pas." },
      { id: "seed", label: "Graine du parcours", type: "text", default: "", max: 20, placeholder: "Laisse vide pour du hasard", info: "Écris un mot pour rejouer exactement les mêmes circuits plus tard ou avec des amis." },
    ] },
    { category: "🚗 Les voitures", rules: [
      { id: "cars", label: "Voitures autorisées", type: "multi", default: Car.CAR_ORDER.slice(), options: Car.CAR_ORDER.map((id) => ({ value: id, label: Car.CARS[id].name, icon: Car.CARS[id].icon, desc: Car.CARS[id].desc })), info: "Chaque voiture a sa vitesse, son adhérence et son caractère." },
      { id: "carMode", label: "Choix de la voiture", type: "chips", default: "libre", options: [{ value: "libre", label: "Chacun choisit" }, { value: "imposee", label: "Tirée au sort" }], info: "Chacun choisit passe par le garage avant chaque course. Tirée au sort donne la même voiture à tout le monde, pour une course équitable." },
      { id: "ghost", label: "Fantôme du record", type: "bool", default: true, info: "Affiche une voiture transparente qui rejoue le meilleur temps du moment et un écart en direct." },
      { id: "others", label: "Voir les autres pilotes", type: "bool", default: true, info: "Affiche les voitures des autres pilotes en transparence pendant qu'ils roulent. Elles ne gênent jamais." },
      { id: "verify", label: "Contrôle des temps", type: "chips", default: "replay", options: [{ value: "replay", label: "Rejouer les pilotages" }, { value: "trust", label: "Faire confiance" }], info: "Rejouer les pilotages fait refaire chaque course par le serveur pour confirmer le temps exact. Faire confiance accepte le temps annoncé par chaque navigateur, plus simple mais triche possible." },
    ] },
  ];
  const allRules = () => SCHEMA.reduce((a, c) => a.concat(c.rules), []);
  function defaults() { const o = {}; allRules().forEach((r) => { o[r.id] = Array.isArray(r.default) ? r.default.slice() : r.default; }); return o; }
  const valuesOf = (rule) => (rule.options || []).map((o) => (typeof o === "object" ? o.value : o));
  function normalize(input) {
    const out = defaults();
    allRules().forEach((r) => {
      let v = input ? input[r.id] : undefined; if (v === undefined) return;
      if (r.type === "bool") out[r.id] = !!v;
      else if (r.type === "range") { v = Number(v); if (!isFinite(v)) return; const st = r.step || 1; v = Math.round(v / st) * st; out[r.id] = Math.max(r.min, Math.min(r.max, v)); }
      else if (r.type === "text") out[r.id] = String(v).replace(/[\u0000-\u001f<>]/g, "").slice(0, r.max || 20);
      else if (r.type === "multi") { const ok = valuesOf(r); out[r.id] = Array.isArray(v) ? v.filter((x) => ok.includes(x)) : r.default.slice(); }
      else { const ok = valuesOf(r); const want = typeof ok[0] === "number" ? Number(v) : v; if (ok.includes(want)) out[r.id] = want; }
    });
    if (!out.biomes.length) out.biomes = [Track.BIOME_IDS[0]];
    if (!out.cars.length) out.cars = [Car.CAR_ORDER[0]];
    return out;
  }
  function pickBiome(s, i, r) { const l = s.biomes; if (s.biomeOrder === "unique") return l[0]; if (s.biomeOrder === "ordre") return l[i % l.length]; return l[Math.floor(r() * l.length)]; }
  // génère le circuit numéro index d'une partie, identique pour le serveur et pour l'aperçu du salon
  function trackFor(s, baseSeed, index) {
    const r = Track.mulberry32(Track.hashSeed(baseSeed + "#" + index));
    const biome = pickBiome(s, index, r);
    return Track.generate({ seed: baseSeed + "#" + index, biome, size: s.trackSize, difficulty: s.difficulty, hills: s.hills, features: { boosts: s.features.includes("boosts"), jumps: s.features.includes("jumps"), surfaces: s.features.includes("surfaces") } });
  }
  return { SCHEMA, defaults, normalize, trackFor, allRules };
});

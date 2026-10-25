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
        { value: "essence", label: "Essence", icon: "⛽", desc: "Chaque pilote pose un temps. Ensuite le dernier du classement joue avec toute son essence pour battre l'avant-dernier. Tant qu'il reste dernier c'est encore à lui, et sans essence il est éliminé. Le dernier pilote en course gagne." },
        { value: "chrono", label: "Chrono fantôme", icon: "👻", desc: "Tout le monde part en même temps depuis la même ligne, n'a droit qu'à un seul essai sans recommencer, et le meilleur temps gagne. Les voitures sont des fantômes, elles ne se touchent jamais." },
        { value: "contact", label: "Chrono contact", icon: "💥", desc: "Même principe, mais les voitures sont bien réelles. Un seul essai, on se pousse, on se gêne, on dévie un adversaire en le percutant. Le départ se fait côte à côte pour que ce soit équitable." },
      ] },
      { id: "refTries", label: "Essais pour poser un temps", type: "chips", default: 1, options: [1, 2, 3], showIf: { mode: "essence" }, info: "Au début de la course chaque pilote pose un temps, sans limite d'essence. Avec plusieurs essais son meilleur temps compte." },
      { id: "tankMode", label: "Taille du réservoir", type: "chips", default: "relatif", options: [{ value: "relatif", label: "Selon le record" }, { value: "fixe", label: "Durée fixe" }], showIf: { mode: "essence" }, info: "Selon le record, le réservoir de chaque pilote vaut un multiple du meilleur temps posé, ce qui garde la tension sur les petits comme sur les grands circuits. Durée fixe donne le même nombre de secondes à tous. Le réservoir ne se remplit pas entre deux tours de jeu." },
      { id: "tankFactor", label: "Réservoir en multiple du meilleur temps", type: "range", min: 1, max: 10, step: 0.5, default: 3, format: fmtMult, showIf: { mode: "essence", tankMode: "relatif" }, info: "Avec 3 fois, un meilleur temps de 40 secondes donne 120 secondes de conduite à chaque pilote pour toute la manche, essais ratés compris. Chaque redémarrage brûle l'essence déjà utilisée." },
      { id: "tankSeconds", label: "Durée du réservoir", type: "chips", default: 60, options: [{ value: 30, label: "30 s" }, { value: 45, label: "45 s" }, { value: 60, label: "1 min" }, { value: 90, label: "1 min 30" }, { value: 120, label: "2 min" }], showIf: { mode: "essence", tankMode: "fixe" }, info: "Le temps de conduite total dont dispose chaque pilote pour toute la manche." },
      { id: "order", label: "Ordre pour poser les temps", type: "cards", default: "tour", options: [
        { value: "tour", label: "À tour de rôle", icon: "🔁", desc: "Le pilote qui ouvre la course change à chaque manche, dans l'ordre des places." },
        { value: "retard", label: "Le dernier d'abord", icon: "🐢", desc: "Le dernier du classement général pose son temps en premier." },
      ], showIf: { mode: "essence" } },
      { id: "giveUp", label: "Quand un pilote abandonne", type: "chips", default: "elimine", options: [{ value: "elimine", label: "Il est éliminé" }, { value: "fin", label: "La manche s'arrête" }], showIf: { mode: "essence" }, info: "Un pilote dernier peut abandonner avant d'avoir vidé son réservoir. Il sort de la course, et selon ce réglage la manche continue entre les autres ou s'arrête aussitôt, le meilleur temps l'emportant." },
      { id: "roundTime", label: "Temps maximum pour finir en chrono", type: "chips", default: 120, options: [{ value: 60, label: "1 min" }, { value: 90, label: "1 min 30" }, { value: 120, label: "2 min" }, { value: 180, label: "3 min" }, { value: 240, label: "4 min" }], showIf: { mode: ["chrono", "contact"] }, info: "Après le départ commun, chacun a un seul essai et ce temps pour franchir la ligne. La course s'arrête plus tôt si tout le monde a fini ou abandonné, et un pilote encore en route a vingt secondes de plus." },
      { id: "garage", label: "Temps au garage", type: "chips", default: 20, options: [{ value: 10, label: "10 s" }, { value: 20, label: "20 s" }, { value: 40, label: "40 s" }], info: "Avant chaque course, chacun choisit sa voiture. Le garage se ferme plus tôt quand tous les joueurs sont prêts." },
    ] },
    { category: "🛣️ Le circuit", rules: [
      { id: "biomes", label: "Biomes possibles", type: "multi", default: Track.BIOME_IDS.slice(), options: BIOME_OPTIONS, info: "Coche les décors que tu veux croiser. Chaque biome a sa couleur de route, sa gravité et ses types de sols." },
      { id: "biomeOrder", label: "Choix du biome à chaque course", type: "chips", default: "hasard", options: [{ value: "hasard", label: "Au hasard" }, { value: "ordre", label: "Dans l'ordre de la liste" }, { value: "unique", label: "Le même partout" }], info: "Le même partout prend le premier biome coché." },
      { id: "trackSize", label: "Longueur des circuits", type: "chips", default: 2, options: [{ value: 1, label: "Court" }, { value: 2, label: "Moyen" }, { value: 3, label: "Long" }, { value: 4, label: "Très long" }, { value: 5, label: "Géant" }], info: "Court fait environ 30 secondes de conduite, moyen environ 45, long environ 1 minute 15, très long environ 2 minutes, géant 3 minutes ou plus. Les circuits géants sont faits pour de vraies courses d'endurance." },
      { id: "difficulty", label: "Difficulté du circuit", type: "range", min: 1, max: 5, step: 1, default: 3, info: "Plus c'est haut, plus la route est étroite avec des virages serrés et des enchaînements." },
      { id: "hills", label: "Relief", type: "range", min: 0, max: 3, step: 1, default: 2, format: (v) => ["plat", "doux", "vallonné", "montagneux"][v], info: "Les bosses font décoller la voiture, les côtes la ralentissent." },
      { id: "features", label: "Animations du circuit", type: "multi", default: FEATURE_OPTIONS.map((f) => f.value), options: FEATURE_OPTIONS, info: "Décoche ce que tu n'aimes pas. Chaque élément est tiré au sort selon le biome et la difficulté." },
      { id: "seed", label: "Graine du parcours", type: "text", default: "", max: 20, placeholder: "Laisse vide pour du hasard", info: "Écris un mot pour rejouer exactement les mêmes circuits plus tard ou avec des amis." },
    ] },
    { category: "🚗 La conduite", rules: [
      { id: "botPace", label: "Vitesse des tours des pilotes automatiques", type: "chips", default: 2, options: [{ value: 1, label: "Normale" }, { value: 2, label: "Deux fois plus vite" }, { value: 4, label: "Quatre fois plus vite" }], showIf: { mode: "essence" }, info: "Les pilotes automatiques roulent en direct, essai après essai, avec leur essence qui baisse. Accélérer évite d'attendre quand ils ont un grand réservoir." },
      { id: "ghost", label: "Fantôme du record", type: "bool", default: true, info: "Affiche une voiture transparente qui rejoue le meilleur temps du moment (le record en mode essence, ton meilleur essai en chrono) et un écart en direct." },
      { id: "others", label: "Voir les autres pilotes", type: "bool", default: true, info: "Affiche les voitures des autres pilotes pendant qu'ils roulent, en transparence en chrono fantôme. En chrono contact elles sont toujours visibles et solides." },
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
    return out;
  }
  function pickBiome(s, i, r) { const l = s.biomes; if (s.biomeOrder === "unique") return l[0]; if (s.biomeOrder === "ordre") return l[i % l.length]; return l[Math.floor(r() * l.length)]; }
  // génère le circuit numéro index d'une partie, identique pour le serveur et pour l'aperçu du salon
  function trackFor(s, baseSeed, index) {
    const r = Track.mulberry32(Track.hashSeed(baseSeed + "#" + index));
    const biome = pickBiome(s, index, r);
    return Track.generate({ seed: baseSeed + "#" + index, biome, size: s.trackSize, difficulty: s.difficulty, hills: s.hills, features: { boosts: s.features.includes("boosts"), jumps: s.features.includes("jumps"), surfaces: s.features.includes("surfaces"), gaps: s.features.includes("gaps"), steep: s.features.includes("steep"), obstacles: s.features.includes("obstacles"), widths: s.features.includes("widths"), bridges: s.features.includes("bridges"), mag: s.features.includes("mag") } });
  }
  return { SCHEMA, defaults, normalize, trackFor, allRules };
});

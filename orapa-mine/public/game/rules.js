// ============================================================
// ORAPA MINE — Réglages (source unique, serveur et client)
// ============================================================
(function (root, factory) {
  if (typeof module !== "undefined" && module.exports) module.exports = factory();
  else root.OMRules = factory();
})(typeof window !== "undefined" ? window : globalThis, function () {
  const BOARDS = { "6x6": [6, 6], "8x8": [8, 8], "10x8": [10, 8], "8x10": [8, 10], "10x10": [10, 10] };
  // niveaux de difficulté appliqués aux modes qui ne sont pas personnalisés
  const LEVELS = {
    facile: { board: "6x6", gems: 3, kinds: "orapa", shapes: "petits", lasers: ["t"], trace: "complet", shots: 0, accLives: 3, accHint: true, adjacent: true },
    normal: { board: "10x8", gems: 5, kinds: "orapa", shapes: "mixtes", lasers: ["t"], trace: "mystere", shots: 24, accLives: 2, accHint: false, adjacent: false },
    expert: { board: "10x8", gems: 7, kinds: "orapa", shapes: "mixtes", lasers: ["t"], trace: "mystere", shots: 18, accLives: 1, accHint: false, adjacent: false },
    fantaisie: { board: "8x8", gems: 5, kinds: "tout", shapes: "mixtes", lasers: ["r", "b", "y", "w"], trace: "mystere", shots: 24, accLives: 2, accHint: false, adjacent: false },
  };
  const MODES = {
    classique: { share: "turn", mines: "director" }, course: { share: "private", mines: "gen" }, croise: { share: "private", mines: "own" },
    coop: { share: "team", mines: "gen", teams: 1 }, equipes: { share: "team", mines: "gen", teams: 2 }, enigme: { share: "team", mines: "gen", teams: 1, enigme: true }, campagne: { share: "team", mines: "gen", teams: 1, campagne: true },
  };
  // niveaux de la campagne, mêmes mines pour tout le monde
  const CAMPAIGN = [
    { board: "6x6", gems: 2, kinds: "orapa", shapes: "petits" }, { board: "6x6", gems: 3, kinds: "orapa", shapes: "petits" }, { board: "8x8", gems: 3, kinds: "orapa", shapes: "mixtes" },
    { board: "8x8", gems: 4, kinds: "orapa", shapes: "mixtes" }, { board: "10x8", gems: 5, kinds: "orapa", shapes: "mixtes" }, { board: "10x8", gems: 6, kinds: "orapa", shapes: "mixtes" },
    { board: "10x8", gems: 7, kinds: "orapa", shapes: "mixtes" }, { board: "8x8", gems: 4, kinds: "tout", shapes: "mixtes" }, { board: "8x8", gems: 5, kinds: "tout", shapes: "mixtes" },
    { board: "8x10", gems: 6, kinds: "tout", shapes: "mixtes" }, { board: "10x10", gems: 7, kinds: "tout", shapes: "mixtes" }, { board: "10x10", gems: 9, kinds: "tout", shapes: "mixtes" },
  ];
  const LASERS = { t: 0, r: 1, b: 2, y: 4, w: 7 };
  const SCHEMA = [
    { category: "⛏️ La partie", rules: [
      { id: "mode", label: "Mode de jeu", type: "cards", default: "classique", options: [
        { value: "classique", label: "Classique", icon: "🎩", desc: "Un Directeur cache les pierres, les explorateurs tirent à tour de rôle et voient tous les mêmes résultats." },
        { value: "course", label: "Course", icon: "🏁", desc: "Une mine tirée au sort. Chacun tire de son côté en secret et le premier qui accuse juste gagne." },
        { value: "croise", label: "Mines croisées", icon: "🔀", desc: "Chacun cache sa propre mine, puis explore celle de son voisin. Cache bien, trouve vite." },
        { value: "coop", label: "Coopération", icon: "🤝", desc: "Tout le monde fouille la même mine avec un carnet commun et un nombre de tirs limité." },
        { value: "equipes", label: "Équipes", icon: "⚔️", desc: "Deux équipes se disputent la même mine, chacune avec son carnet secret." },
        { value: "enigme", label: "Énigme", icon: "🧩", desc: "Une mine prédéfinie avec quelques tirs déjà révélés. Il reste peu de tirs pour conclure." },
        { value: "campagne", label: "Campagne", icon: "🗺️", desc: "Douze mines de plus en plus grandes, les mêmes pour tout le monde. On avance ensemble." },
        { value: "perso", label: "Personnalisé", icon: "🛠️", desc: "Tu choisis le mode de base et tous les réglages, la taille de la mine, les pierres, les lasers et les limites." },
      ] },
      { id: "base", label: "Mode de base", type: "chips", default: "course", options: [{ value: "classique", label: "Classique" }, { value: "course", label: "Course" }, { value: "croise", label: "Mines croisées" }, { value: "coop", label: "Coopération" }, { value: "equipes", label: "Équipes" }], showIf: { mode: ["perso"] }, info: "Le fonctionnement de la partie, comme dans les modes ci-dessus." },
      { id: "level", label: "Difficulté", type: "cards", default: "normal", options: [
        { value: "facile", label: "Facile", icon: "🌱", desc: "Mine 6 sur 6, trois pierres, la sonde laisse sa trace complète et chaque erreur donne un indice." },
        { value: "normal", label: "Normal", icon: "⛏️", desc: "La mine de l'original, 10 sur 8, avec les cinq pierres de base, rouge, bleue, jaune et deux blanches. 24 tirs." },
        { value: "expert", label: "Expert", icon: "💎", desc: "Mine 10 sur 8, sept pierres dont un diamant et un corps noir, 18 tirs, une seule accusation." },
        { value: "fantaisie", label: "Fantaisie", icon: "🌈", desc: "Mine 8 sur 8 avec des filtres, des prismes et des opales, et quatre lasers de couleur. Les pierres de l'original, en plus fou." },
      ], showIf: { mode: ["classique", "course", "croise", "coop", "equipes", "enigme"] }, info: "Règle la taille de la mine, le nombre de pierres, les tirs disponibles et la visibilité des rayons." },
      { id: "rounds", label: "Nombre de manches", type: "chips", default: 3, options: [{ value: 1, label: "1" }, { value: 2, label: "2" }, { value: 3, label: "3" }, { value: 4, label: "4" }, { value: 6, label: "6" }], showIf: { mode: ["classique", "course", "croise", "coop", "equipes", "perso"] }, info: "Chaque manche utilise une nouvelle mine. En classique, le rôle de Directeur tourne." },
      { id: "levels", label: "Niveaux à jouer", type: "chips", default: 6, options: [{ value: 3, label: "3" }, { value: 6, label: "6" }, { value: 9, label: "9" }, { value: 12, label: "12" }], showIf: { mode: ["campagne"] }, info: "La campagne commence petit et grandit. Un niveau raté ne bloque pas la suite." },
      { id: "puzzle", label: "Numéro de l'énigme", type: "range", min: 1, max: 30, step: 1, default: 1, showIf: { mode: ["enigme"] }, info: "Chaque numéro donne toujours la même mine. Plus le numéro est grand, plus la mine est grosse." },
    ] },
    { category: "💎 La mine", showIf: { mode: ["perso"] }, rules: [
      { id: "board", label: "Taille de la mine", type: "chips", default: "10x8", options: [{ value: "6x6", label: "6 sur 6" }, { value: "8x8", label: "8 sur 8" }, { value: "10x8", label: "10 sur 8" }, { value: "8x10", label: "8 sur 10" }, { value: "10x10", label: "10 sur 10" }], showIf: { mode: ["perso"] }, info: "Plus la mine est grande, plus il y a de places où cacher les pierres." },
      { id: "gems", label: "Nombre de pierres", type: "range", min: 2, max: 9, step: 1, default: 5, showIf: { mode: ["perso"] }, info: "Chaque pierre de la mine est listée dans l'inventaire, mais pas sa place ni son sens." },
      { id: "kinds", label: "Types de pierres", type: "cards", default: "orapa", options: [
        { value: "orapa", label: "Originales", icon: "💎", desc: "Pierres rouge, bleue, jaune et blanche qui renvoient la sonde en lui donnant leur couleur, un diamant transparent et un corps noir qui absorbe." },
        { value: "basique", label: "Basiques", icon: "🔷", desc: "Filtres colorés, miroirs et obsidienne." },
        { value: "tout", label: "Toutes", icon: "🌈", desc: "Ajoute les prismes, les séparateurs et les opales." },
        { value: "avance", label: "Avancées", icon: "🔮", desc: "Beaucoup de prismes, de séparateurs et d'opales. Très technique." },
      ], showIf: { mode: ["perso"] } },
      { id: "shapes", label: "Formes des pierres", type: "chips", default: "mixtes", options: [{ value: "petits", label: "Petites" }, { value: "mixtes", label: "Variées" }, { value: "gros", label: "Grosses" }], showIf: { mode: ["perso"] }, info: "Petites = une ou deux cases. Grosses = jusqu'à quatre cases." },
      { id: "adjacent", label: "Pierres collées", type: "bool", default: false, showIf: { mode: ["perso"] }, info: "Autorise deux pierres côte à côte. Plus compliqué à démêler." },
      { id: "lasers", label: "Lasers disponibles", type: "multi", default: ["r", "b", "y", "w"], options: [{ value: "r", label: "Rouge", icon: "🔴" }, { value: "b", label: "Bleu", icon: "🔵" }, { value: "y", label: "Jaune", icon: "🟡" }, { value: "w", label: "Blanc", icon: "⚪" }, { value: "t", label: "Sonde transparente", icon: "🔦" }], showIf: { mode: ["perso"] }, info: "Avec les pierres originales, seule la sonde transparente est utilisée. Le blanc contient les trois couleurs et se sépare dans les prismes. Il faut au moins un laser." },
    ] },
    { category: "🔦 Les tirs et les accusations", showIf: { mode: ["perso"] }, rules: [
      { id: "trace", label: "Trace des rayons", type: "cards", default: "mystere", options: [
        { value: "mystere", label: "Mystère", icon: "❓", desc: "On voit seulement par où le rayon entre et par où il ressort, avec sa couleur." },
        { value: "partiel", label: "Partielle", icon: "🌗", desc: "On voit le rayon jusqu'à la première pierre qu'il touche." },
        { value: "complet", label: "Complète", icon: "🌕", desc: "On voit tout le trajet du rayon. Parfait pour apprendre." },
      ], showIf: { mode: ["perso"] } },
      { id: "shots", label: "Tirs par joueur ou équipe", type: "chips", default: 24, options: [{ value: 0, label: "Illimité" }, { value: 12, label: "12" }, { value: 18, label: "18" }, { value: 24, label: "24" }, { value: 36, label: "36" }], showIf: { mode: ["perso"] }, info: "Quand il n'y en a plus, il ne reste qu'à accuser." },
      { id: "accLives", label: "Accusations ratées permises", type: "chips", default: 2, options: [{ value: 1, label: "1" }, { value: 2, label: "2" }, { value: 3, label: "3" }], showIf: { mode: ["perso"] }, info: "Une accusation fausse en coûte une. Quand il n'y en a plus, on sort de la manche." },
      { id: "accHint", label: "Indice après une erreur", type: "bool", default: false, showIf: { mode: ["perso"] }, info: "Une accusation fausse révèle combien de pierres étaient bien placées." },
      { id: "roundTime", label: "Temps maximum d'une manche", type: "chips", default: 0, options: [{ value: 0, label: "Aucun" }, { value: 180, label: "3 min" }, { value: 300, label: "5 min" }, { value: 480, label: "8 min" }, { value: 720, label: "12 min" }], showIf: { mode: ["perso"] } },
    ] },
    { category: "🕒 Rythme", rules: [
      { id: "turnTime", label: "Temps par tour en classique", type: "chips", default: 40, options: [{ value: 20, label: "20 s" }, { value: 40, label: "40 s" }, { value: 60, label: "1 min" }, { value: 90, label: "1 min 30" }], showIf: { mode: ["classique"] }, info: "À l'expiration, le tour passe au joueur suivant." },
      { id: "setupTime", label: "Temps pour cacher les pierres", type: "chips", default: 120, options: [{ value: 60, label: "1 min" }, { value: 120, label: "2 min" }, { value: 180, label: "3 min" }], showIf: { mode: ["classique", "croise"] }, info: "Les pierres non posées à temps sont placées au hasard." },
      { id: "sfx", label: "Bruitages", type: "bool", default: true, info: "Cristaux, rayons et éboulements. Chacun peut couper le son dans son menu." },
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
      else if (r.type === "range") { v = Math.round(Number(v)); if (!isFinite(v)) return; out[r.id] = Math.max(r.min, Math.min(r.max, v)); }
      else if (r.type === "multi") { const ok = valuesOf(r); out[r.id] = Array.isArray(v) ? v.filter((x) => ok.includes(x)) : r.default.slice(); }
      else { const ok = valuesOf(r); const want = typeof ok[0] === "number" ? Number(v) : v; if (ok.includes(want)) out[r.id] = want; }
    });
    if (!out.lasers.length) out.lasers = ["t"];
    return out;
  }
  // réglages réellement appliqués
  function effective(s0) {
    const s = normalize(s0); const key = s.mode === "perso" ? s.base : s.mode; const M = MODES[key] || MODES.course;
    const e = Object.assign({}, s, M, { key });
    if (s.mode !== "perso") { Object.assign(e, LEVELS[s.level] || LEVELS.normal); if (key === "coop") { e.shots = e.shots ? e.shots + 6 : 0; } }
    if (key === "enigme") { e.rounds = 1; e.freeShots = 3; e.shots = 8; e.accLives = 2; const p = s.puzzle; e.board = p <= 8 ? "6x6" : p <= 18 ? "10x8" : "10x10"; e.gems = 2 + Math.floor(p / 5); e.kinds = p < 20 ? "orapa" : "tout"; if (e.kinds === "orapa") e.lasers = ["t"]; else e.lasers = ["r", "b", "y", "w"]; e.shapes = "mixtes"; e.trace = "mystere"; e.seed = 7000 + p; e.roundTime = 0; e.adjacent = false; }
    else e.freeShots = 0;
    if (key === "campagne") { e.rounds = s.levels; e.shots = 0; e.accLives = 3; e.accHint = true; e.roundTime = 0; e.lasers = ["r", "b", "y", "w"]; e.trace = "partiel"; e.adjacent = false; }
    if (e.kinds === "orapa") e.lasers = ["t"];
    if (s.mode !== "perso") { if (!e.roundTime) e.roundTime = 0; }
    if (!e.lasers || !e.lasers.length) e.lasers = ["t"]; e.W = (BOARDS[e.board] || BOARDS["8x8"])[0]; e.H = (BOARDS[e.board] || BOARDS["8x8"])[1];
    e.laserMasks = e.lasers.map((l) => LASERS[l]);
    return e;
  }
  return { BOARDS, LEVELS, MODES, CAMPAIGN, LASERS, SCHEMA, defaults, normalize, effective };
});

// ============================================================
// FART TOGETHER — Réglages (source unique, serveur et client)
// ============================================================
(function (root, factory) {
  if (typeof module !== "undefined" && module.exports) module.exports = factory();
  else root.FTRules = factory();
})(typeof window !== "undefined" ? window : globalThis, function () {
  const COURSES = [
    ["riviere", "La Rivière Tranquille"], ["canal", "Le Canal Étroit"], ["rapides", "Les Rapides Rageurs"], ["cascade", "La Cascade Folle"], ["contre", "Le Contre-Courant"],
    ["marais", "Le Marais Fromagé"], ["parc", "Le Parc Aquatique"], ["canyon", "Le Canyon Sauteur"], ["tuyaux", "Les Tuyaux Géants"], ["huit", "Le Grand Huit"],
  ];
  const CHALLENGES = [
    { id: 1, name: "La grande récolte", course: "riviere", objective: "pieces", goal: "Ramasse au moins 22 bulles dorées et franchis l'arrivée.", test: (r) => r.fin && r.coins >= 22 },
    { id: 2, name: "Sans toucher", course: "canal", objective: "finir", goal: "Franchis l'arrivée avec six chocs au maximum.", test: (r) => r.fin && r.hits <= 6 },
    { id: 3, name: "Contre la montre", course: "rapides", objective: "finir", goal: "Arrive en moins de 62 secondes.", test: (r) => r.fin && r.time <= 62 },
    { id: 4, name: "Bouée stable", course: "cascade", objective: "finir", goal: "Franchis l'arrivée sans jamais chavirer.", test: (r) => r.fin && r.caps === 0 },
    { id: 5, name: "L'œuf précieux", course: "parc", objective: "oeuf", goal: "Livre l'œuf avec au moins la moitié de sa coquille intacte.", test: (r) => r.fin && r.egg >= 50 },
    { id: 6, name: "Slalom parfait", course: "parc", objective: "portes", goal: "Passe au moins quatre portes sur cinq.", test: (r) => r.fin && r.gatesOk >= Math.ceil(r.gatesTotal * 0.8) },
    { id: 7, name: "Fromage express", course: "marais", objective: "finir", goal: "Arrive en moins de 80 secondes malgré le fromage.", test: (r) => r.fin && r.time <= 80 },
    { id: 8, name: "Le grand chelem", course: "huit", objective: "finir", goal: "Franchis l'arrivée en chavirant deux fois au plus.", test: (r) => r.fin && r.caps <= 2 },
  ];
  const SCHEMA = [
    { category: "🌊 La descente", rules: [
      { id: "mode", label: "Mode de jeu", type: "cards", default: "course", options: [
        { value: "aventure", label: "Aventure", icon: "🗺️", desc: "Tout le monde sur la même bouée. On enchaîne des parcours et on gagne des étoiles selon le temps." },
        { value: "chrono", label: "Contre-la-montre", icon: "⏱️", desc: "Une bouée, un parcours, plusieurs essais. Le meilleur temps de l'équipage compte." },
        { value: "course", label: "Course", icon: "🏁", desc: "Plusieurs bouées se disputent la descente. On se bouscule, on se double, le premier gagne." },
        { value: "survie", label: "Survie", icon: "🛟", desc: "Une rivière sans fin, une coque qui prend des coups. Jusqu'où ira l'équipage avant le naufrage ?" },
        { value: "infini", label: "Parcours infini", icon: "♾️", desc: "Quatre minutes pour descendre le plus loin possible, chaque équipe sur sa bouée." },
        { value: "defis", label: "Défis", icon: "🎯", desc: "Huit défis précis avec un objectif à atteindre, récolter, éviter, livrer ou aller vite." },
        { value: "arene", label: "Arène", icon: "🛁", desc: "Une grande piscine, des bulles dorées à ramasser et des bousculades. Le plus riche en bulles gagne." },
        { value: "quotidien", label: "Défi du jour", icon: "📅", desc: "Le même parcours, le même objectif et les mêmes événements pour tout le monde aujourd'hui." },
      ] },
      { id: "course", label: "Parcours", type: "chips", default: "riviere", options: COURSES.map((c) => ({ value: c[0], label: c[1] })), showIf: { mode: ["aventure", "chrono", "course"] }, info: "Le premier parcours joué. Le Grand Huit est le plus long et le plus fou." },
      { id: "courses", label: "Nombre de parcours", type: "chips", default: 2, options: [{ value: 1, label: "1" }, { value: 2, label: "2" }, { value: 3, label: "3" }, { value: 5, label: "5" }], showIf: { mode: ["aventure", "course"] }, info: "Les parcours se suivent dans l'ordre de la liste à partir du premier choisi." },
      { id: "attempts", label: "Essais", type: "chips", default: 3, options: [{ value: 1, label: "1" }, { value: 3, label: "3" }, { value: 5, label: "5" }], showIf: { mode: ["chrono"] }, info: "Après chaque essai l'équipage repart au début. Le meilleur temps est gardé." },
      { id: "challenge", label: "Numéro du défi", type: "range", min: 1, max: 8, step: 1, default: 1, showIf: { mode: ["defis"] }, info: "Chaque défi impose son parcours et son objectif. L'objectif est rappelé à l'écran." },
      { id: "crew", label: "Équipages", type: "cards", default: "paires", options: [
        { value: "tous", label: "Une seule bouée", icon: "🛟", desc: "Tout le monde sur la même bouée. Coopération totale." },
        { value: "paires", label: "Bouées de deux", icon: "👯", desc: "Les joueurs se répartissent par deux sur plusieurs bouées." },
        { value: "solo", label: "Chacun sa bouée", icon: "🧍", desc: "Une bouée par joueur. Plus de physique, moins de coordination." },
      ], showIf: { mode: ["course", "infini", "arene"] }, info: "Une bouée porte jusqu'à quatre joueurs. Dans les autres modes tout le monde partage la même bouée." },
    ] },
    { category: "🎲 Règles de la rivière", rules: [
      { id: "difficulty", label: "Difficulté", type: "cards", default: 1, options: [
        { value: 0, label: "Cool", icon: "🌼", desc: "Moins de rochers, plus de place pour se rater." },
        { value: 1, label: "Normal", icon: "🌊", desc: "Le parcours tel qu'il a été dessiné." },
        { value: 2, label: "Sauvage", icon: "🦈", desc: "Beaucoup plus de rochers et de pièges." },
      ], showIf: { mode: ["aventure", "chrono", "course", "survie", "infini"] } },
      { id: "objective", label: "Objectif de la descente", type: "cards", default: "finir", options: [
        { value: "finir", label: "Finir", icon: "🏁", desc: "Franchir l'arrivée le plus vite possible." },
        { value: "pieces", label: "Récolter", icon: "🪙", desc: "Chaque bulle dorée ramassée enlève une seconde et demie au temps final." },
        { value: "oeuf", label: "Livrer l'œuf", icon: "🥚", desc: "Un œuf fragile voyage sur la bouée. S'il casse, quinze secondes de pénalité." },
        { value: "portes", label: "Passer les portes", icon: "🎪", desc: "Chaque porte manquée coûte cinq secondes." },
      ], showIf: { mode: ["aventure", "chrono", "course"] } },
      { id: "chaos", label: "Chaos", type: "bool", default: false, showIf: { mode: ["aventure", "chrono", "course", "survie", "infini", "arene"] }, info: "Des événements imprévisibles toutes les quinze secondes environ, rafales de vent, pets géants, hoquets qui faussent la visée, vagues et commandes inversées." },
      { id: "tank", label: "Réservoir de gaz", type: "chips", default: 1, options: [{ value: 0.7, label: "Petit" }, { value: 1, label: "Normal" }, { value: 1.4, label: "Grand" }], info: "La quantité de souffle de chaque joueur. Elle se recharge quand on arrête de pousser." },
    ] },
    { category: "🔊 Ambiance", rules: [
      { id: "sfx", label: "Bruitages", type: "bool", default: true, info: "Les pets, les éclaboussures et les cris. Chacun peut couper le son dans son menu." },
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
      else { const ok = valuesOf(r); const want = typeof ok[0] === "number" ? Number(v) : v; if (ok.includes(want)) out[r.id] = want; }
    });
    return out;
  }
  return { SCHEMA, COURSES, CHALLENGES, defaults, normalize };
});

// ============================================================
// MAUVAISES LANGUES — Réglages (source unique, serveur et client)
// ============================================================
(function (root, factory) {
  if (typeof module !== "undefined" && module.exports) module.exports = factory();
  else root.MLRules = factory();
})(typeof window !== "undefined" ? window : globalThis, function () {
  // les thèmes. L'ordre est celui de l'affichage
  const THEMES = [
    { id: "sexe", label: "Sexualité", icon: "🍑" },
    { id: "betises", label: "Bêtises et honte", icon: "🤡" },
    { id: "hygiene", label: "Hygiène de vie", icon: "🦠" },
    { id: "amour", label: "Amour et drague", icon: "💘" },
    { id: "soiree", label: "Soirées et alcool", icon: "🍾" },
    { id: "trahison", label: "Mensonges et secrets", icon: "🐍" },
    { id: "look", label: "Physique et ego", icon: "🪞" },
    { id: "argent", label: "Argent", icon: "💸" },
    { id: "ecran", label: "Téléphone et réseaux", icon: "📱" },
    { id: "travail", label: "Boulot et études", icon: "💼" },
    { id: "perso", label: "Personnalité", icon: "🧠" },
    { id: "futur", label: "Futur", icon: "🔮" },
    { id: "chaos", label: "Chaos", icon: "🌪️" },
  ];
  const THEME_IDS = THEMES.map((t) => t.id);
  const themeOf = (id) => THEMES.find((t) => t.id === id) || THEMES[0];
  // poids de tirage selon le piment de la question, dans l'ordre taquin, épicé, déplacé
  const SPICE = { doux: [6, 2, 0], equilibre: [3, 5, 2], epice: [1, 4, 6], infernal: [0, 1, 8] };
  const HEAT_NAMES = ["", "Taquin", "Épicé", "Déplacé"];
  const EMOJIS = ["😂", "💀", "🔥", "😱", "🫣", "👀"];
  const SCHEMA = [
    { category: "🎲 La partie", rules: [
      { id: "cycles", label: "Tours par joueur", type: "range", min: 1, max: 4, step: 1, default: 2, info: "À chaque manche, un joueur classe tout le monde en secret. Avec 2 tours, chaque joueur passe deux fois au classement. Avec 6 joueurs, comptez environ 25 minutes." },
      { id: "rankTime", label: "Temps pour classer", type: "chips", default: 60, options: [{ value: 40, label: "40 s" }, { value: 60, label: "1 min" }, { value: 90, label: "1 min 30" }, { value: 120, label: "2 min" }], info: "Si le joueur n'a pas fini, la manche est annulée et personne ne marque." },
      { id: "voteTime", label: "Temps pour voter", type: "chips", default: 25, options: [{ value: 15, label: "15 s" }, { value: 25, label: "25 s" }, { value: 40, label: "40 s" }, { value: 60, label: "1 min" }], info: "La manche passe plus vite quand tout le monde a voté." },
      { id: "revealTime", label: "Durée du dévoilement", type: "chips", default: 15, options: [{ value: 10, label: "10 s" }, { value: 15, label: "15 s" }, { value: 25, label: "25 s" }, { value: 40, label: "40 s" }], info: "Le temps de rire, de s'indigner et de lire les votes avant la manche suivante. L'hôte peut passer plus vite." },
    ] },
    { category: "🌶️ Les questions", rules: [
      { id: "spice", label: "Niveau de piment", type: "cards", default: "epice", options: [
        { value: "doux", label: "Doux", icon: "🙂", desc: "Surtout des taquineries. Presque rien de gênant, pour une première soirée." },
        { value: "equilibre", label: "Équilibré", icon: "🌶️", desc: "Un mélange de tout, avec quelques questions qui piquent." },
        { value: "epice", label: "Épicé", icon: "🔥", desc: "Surtout des questions qui font rougir. Le réglage conseillé." },
        { value: "infernal", label: "Infernal", icon: "😈", desc: "Presque uniquement du déplacé. Ça finit en dispute ou en fou rire." },
      ] },
      { id: "themes", label: "Thèmes autorisés", type: "multi", default: THEME_IDS.slice(), options: THEMES.map((t) => ({ value: t.id, label: t.label, icon: t.icon })), info: "Décoche un thème pour ne plus jamais le voir, ni dans les questions ni dans les leurres. Il en faut au moins un." },
      { id: "swaps", label: "Changements de question par manche", type: "chips", default: 1, options: [0, 1, 2, 3], info: "Le joueur qui classe voit sa question en secret. Il peut la remplacer s'il ne veut pas y répondre. Zéro signifie qu'il faut assumer." },
      { id: "decoys", label: "Questions leurres", type: "cards", default: "mixte", options: [
        { value: "mixte", label: "Mélangées", icon: "🎭", desc: "Deux leurres du même thème que la vraie question et un d'un autre thème." },
        { value: "theme", label: "Même thème", icon: "🎯", desc: "Les quatre questions parlent du même sujet. Beaucoup plus difficile." },
        { value: "hasard", label: "Au hasard", icon: "🎲", desc: "Les leurres viennent de partout. Plus facile à deviner." },
      ] },
    ] },
    { category: "🏆 Les points", rules: [
      { id: "scoreGuess", label: "Points pour une bonne réponse", type: "chips", default: 2, options: [1, 2, 3, 5], info: "Gagnés par chaque joueur qui devine la vraie question." },
      { id: "scoreRanker", label: "Points du classeur par joueur qui devine", type: "chips", default: 1, options: [0, 1, 2], info: "Le joueur qui classe gagne ces points pour chaque joueur qui trouve la vraie question. Il a donc intérêt à être honnête et lisible. Zéro le laisse sans enjeu." },
      { id: "showVoters", label: "Montrer qui a voté pour quoi", type: "bool", default: true, info: "Au dévoilement, chaque vote apparaît avec le nom du joueur. C'est là que les egos se touchent. Décoché, seuls les totaux sont visibles." },
      { id: "reactions", label: "Réactions en emojis", type: "bool", default: true, info: "Des emojis à envoyer pendant le dévoilement pour réagir au classement." },
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
    if (!out.themes.length) out.themes = THEME_IDS.slice(0, 1);
    return out;
  }
  return { THEMES, THEME_IDS, themeOf, SPICE, HEAT_NAMES, EMOJIS, SCHEMA, defaults, normalize, allRules };
});

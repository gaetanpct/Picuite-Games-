// ============================================================
// SUCRÉ OU SALÉ — Réglages (source unique, serveur et client)
// Les modes sont des préréglages. Les réglages détaillés n'apparaissent qu'en mode personnalisé.
// ============================================================
(function (root, factory) {
  if (typeof module !== "undefined" && module.exports) module.exports = factory();
  else root.SOSRules = factory();
})(typeof window !== "undefined" ? window : globalThis, function () {
  const WORD_CATS = [
    { id: "objets", label: "Objets du quotidien", icon: "🧴" }, { id: "nourriture", label: "Nourriture et boissons", icon: "🍕" }, { id: "animaux", label: "Animaux", icon: "🐙" },
    { id: "lieux", label: "Lieux", icon: "🏰" }, { id: "metiers", label: "Métiers", icon: "👩‍🚒" }, { id: "fiction", label: "Créatures et personnages", icon: "🧛" },
    { id: "nature", label: "Nature et météo", icon: "🌋" }, { id: "culture", label: "Musique, sports et véhicules", icon: "🎸" },
  ];
  const DIL_CATS = [
    { id: "P", label: "Personnalité", icon: "🪞" }, { id: "L", label: "Logique", icon: "🧠" }, { id: "Q", label: "Quotidien", icon: "🪥" }, { id: "C", label: "Culture", icon: "🎭" }, { id: "D", label: "Drôle", icon: "🤡" },
    { id: "A", label: "Absurde", icon: "🌀" }, { id: "H", label: "Difficile à cerner", icon: "🔮" }, { id: "I", label: "Imagination", icon: "🦄" },
  ];
  const WORD_IDS = WORD_CATS.map((c) => c.id), DIL_IDS = DIL_CATS.map((c) => c.id);
  // préréglages appliqués quand le mode n'est pas personnalisé
  const PRESETS = {
    classique: { grid: 16, steps: 5, hand: 4, names: true, reroll: true, bonusEarly: true, talk: 45, difficulty: 2, elim: "majorite", play: "coop", events: "none", joker: true, rounds: 0, finalMult: 1, chaosMix: false },
    express: { grid: 12, steps: 3, hand: 3, names: true, reroll: true, bonusEarly: true, talk: 25, difficulty: 1, elim: "majorite", play: "coop", events: "none", joker: false, rounds: 2, finalMult: 1, chaosMix: false },
    expert: { grid: 25, steps: 7, hand: 3, names: true, reroll: false, bonusEarly: true, talk: 40, difficulty: 3, elim: "majorite", play: "coop", events: "rare", joker: false, rounds: 0, finalMult: 1, chaosMix: false },
    chaos: { grid: 16, steps: 5, hand: 4, names: true, reroll: true, bonusEarly: true, talk: 30, difficulty: 2, elim: "majorite", play: "coop", events: "often", joker: true, rounds: 0, finalMult: 1, chaosMix: true },
    equipes: { grid: 16, steps: 5, hand: 4, names: true, reroll: true, bonusEarly: true, talk: 45, difficulty: 2, elim: "majorite", play: "equipes", events: "rare", joker: true, rounds: 0, finalMult: 1, chaosMix: false },
    tournoi: { grid: 16, steps: 5, hand: 4, names: true, reroll: true, bonusEarly: true, talk: 35, difficulty: 2, elim: "un", play: "solo", events: "rare", joker: true, rounds: 0, finalMult: 2, chaosMix: false },
  };
  const SCHEMA = [
    { category: "📺 Le plateau", rules: [
      { id: "mode", label: "Mode de jeu", type: "cards", default: "classique", options: [
        { value: "classique", label: "Classique", icon: "🎯", desc: "Tout le monde cherche ensemble le mot de l'Extralucide. 16 mots, jusqu'à 5 dilemmes, et on peut gagner avant la fin." },
        { value: "express", label: "Express", icon: "⚡", desc: "12 mots, jusqu'à 3 dilemmes, 25 secondes de discussion. Une partie en dix minutes." },
        { value: "expert", label: "Expert", icon: "🧪", desc: "25 mots, jusqu'à 7 dilemmes, des dilemmes vicieux, ni joker ni main relancée. Pour les esprits tordus." },
        { value: "chaos", label: "Chaos", icon: "🌀", desc: "Des dilemmes absurdes et drôles, des événements presque à chaque manche, 30 secondes pour décider." },
        { value: "equipes", label: "Équipes", icon: "🤝", desc: "Les enquêteurs forment deux équipes qui cherchent le même mot en secret. Les deux marquent si elles trouvent." },
        { value: "tournoi", label: "Tournoi", icon: "🏆", desc: "Chacun cherche seul, sans voir les erreurs des autres. La dernière manche vaut double." },
        { value: "perso", label: "Personnalisé", icon: "🛠️", desc: "Tu règles tout toi-même, la grille, les dilemmes, les temps, l'élimination et les événements." },
      ] },
      { id: "rounds", label: "Nombre de manches", type: "chips", default: 0, options: [{ value: 0, label: "Chacun son tour" }, { value: 1, label: "1" }, { value: 2, label: "2" }, { value: 3, label: "3" }, { value: 4, label: "4" }, { value: 6, label: "6" }], showIf: { mode: ["perso"] }, info: "À chaque manche, un joueur différent devient l'Extralucide. Chacun son tour signifie que tout le monde l'est une fois." },
    ] },
    { category: "🧩 La grille et les dilemmes", showIf: { mode: ["perso"] }, rules: [
      { id: "grid", label: "Mots sur la grille", type: "chips", default: 16, options: [{ value: 9, label: "9" }, { value: 12, label: "12" }, { value: 16, label: "16" }, { value: 20, label: "20" }, { value: 25, label: "25" }], showIf: { mode: ["perso"] }, info: "Plus il y a de mots, plus il faut de dilemmes pour s'en sortir." },
      { id: "steps", label: "Dilemmes à résoudre", type: "range", min: 2, max: 9, step: 1, default: 5, showIf: { mode: ["perso"] }, info: "Après chaque dilemme, le groupe élimine des mots. Quand ils sont tous passés, on choisit le mot final parmi ceux qui restent." },
      { id: "hand", label: "Dilemmes proposés à l'Extralucide", type: "chips", default: 4, options: [{ value: 2, label: "2" }, { value: 3, label: "3" }, { value: 4, label: "4" }, { value: 5, label: "5" }], showIf: { mode: ["perso"] }, info: "Les dilemmes sont tirés au hasard, sans tenir compte du mot secret. Certains collent bien, d'autres pas du tout. Plus il y en a, plus l'Extralucide a de chances d'en trouver un utilisable." },
      { id: "reroll", label: "Main relançable", type: "bool", default: true, showIf: { mode: ["perso"] }, info: "Une fois par manche, l'Extralucide peut jeter tous ses dilemmes et en piocher de nouveaux, quand rien ne colle à son mot." },
      { id: "names", label: "Prénoms des joueurs dans la grille", type: "bool", default: true, showIf: { mode: ["perso"] }, info: "Au moins deux prénoms de joueurs se glissent parmi les mots. L'Extralucide peut avoir un prénom à faire deviner, il faut alors se servir de ce qu'on sait de chacun." },
      { id: "difficulty", label: "Difficulté des dilemmes", type: "cards", default: 2, options: [
        { value: 1, label: "Faciles", icon: "🍬", desc: "Des oppositions claires, chaud ou froid, petit ou grand." },
        { value: 2, label: "Équilibrés", icon: "🍰", desc: "Un mélange d'évidents et de subtils." },
        { value: 3, label: "Vicieux", icon: "🌶️", desc: "Des oppositions ambiguës où les deux côtés peuvent convenir." },
      ], showIf: { mode: ["perso"] } },
      { id: "dcats", label: "Catégories de dilemmes", type: "multi", default: DIL_IDS.slice(), options: DIL_CATS.map((c) => ({ value: c.id, label: c.label, icon: c.icon })), showIf: { mode: ["perso"] }, info: "Décoche une catégorie pour ne plus jamais la voir. Il en faut au moins une." },
      { id: "wcats", label: "Catégories de mots", type: "multi", default: WORD_IDS.slice(), options: WORD_CATS.map((c) => ({ value: c.id, label: c.label, icon: c.icon })), showIf: { mode: ["perso"] }, info: "Les mots de la grille sont tirés dans ces familles. Il en faut au moins deux pour que la grille soit variée." },
    ] },
    { category: "🗣️ La discussion", showIf: { mode: ["perso"] }, rules: [
      { id: "talk", label: "Temps de discussion", type: "chips", default: 45, options: [{ value: 20, label: "20 s" }, { value: 30, label: "30 s" }, { value: 45, label: "45 s" }, { value: 60, label: "1 min" }, { value: 90, label: "1 min 30" }], showIf: { mode: ["perso"] }, info: "Le temps pour marquer les mots à éliminer après chaque dilemme. À la fin du temps, ce qui est décidé part à la poubelle." },
      { id: "play", label: "Façon de jouer", type: "cards", default: "coop", options: [
        { value: "coop", label: "Tous ensemble", icon: "🫂", desc: "Un seul groupe. Tout le monde voit les marques des autres." },
        { value: "equipes", label: "Deux équipes", icon: "🤝", desc: "Deux groupes qui cherchent le même mot sans se voir." },
        { value: "solo", label: "Chacun pour soi", icon: "🕵️", desc: "Chaque enquêteur élimine seul et ne voit pas les marques des autres." },
      ], showIf: { mode: ["perso"] } },
      { id: "bonusEarly", label: "Bonus de rapidité", type: "bool", default: true, showIf: { mode: ["perso"] }, info: "Un groupe qui trouve le mot avant la fin des dilemmes gagne un point par dilemme économisé, jusqu'à trois. Se tromper en avance fait perdre la manche." },
      { id: "elim", label: "Règle d'élimination", type: "cards", default: "majorite", options: [
        { value: "majorite", label: "Majorité", icon: "🗳️", desc: "Un mot disparaît quand plus de la moitié du groupe le marque." },
        { value: "un", label: "Un seul suffit", icon: "☝️", desc: "Un mot disparaît dès qu'un joueur le marque. Rapide et dangereux." },
        { value: "unanimite", label: "Unanimité", icon: "🤝", desc: "Il faut que tout le monde soit d'accord. Très prudent, la grille se vide lentement." },
      ], showIf: { mode: ["perso"] }, info: "Ne change rien quand chacun joue seul." },
    ] },
    { category: "🎪 Les rebondissements", showIf: { mode: ["perso"] }, rules: [
      { id: "events", label: "Événements", type: "cards", default: "none", options: [
        { value: "none", label: "Aucun", icon: "😌", desc: "Pas de surprise." },
        { value: "rare", label: "De temps en temps", icon: "🎲", desc: "Un dilemme sur cinq est perturbé." },
        { value: "often", label: "Souvent", icon: "🎢", desc: "Un dilemme sur deux est perturbé." },
      ], showIf: { mode: ["perso"] }, info: "Dilemme inversé, mot qui revient, sablier, dilemme bonus. Chaque événement est annoncé à l'écran." },
      { id: "joker", label: "Jokers de l'Extralucide", type: "bool", default: true, showIf: { mode: ["perso"] }, info: "Une fois par manche, l'Extralucide peut répondre « les deux » ou « aucun » au lieu de choisir un côté." },
      { id: "chaosMix", label: "Dilemmes absurdes en vedette", type: "bool", default: false, showIf: { mode: ["perso"] }, info: "Les dilemmes absurdes et drôles sortent beaucoup plus souvent." },
      { id: "finalMult", label: "Dernière manche", type: "chips", default: 1, options: [{ value: 1, label: "Normale" }, { value: 2, label: "Double" }, { value: 3, label: "Triple" }], showIf: { mode: ["perso"] }, info: "Multiplie les points de la dernière manche pour relancer le suspense." },
    ] },
    { category: "🔊 Ambiance", rules: [
      { id: "sfx", label: "Bruitages du plateau", type: "bool", default: true, info: "Gong, tic-tac, rires enregistrés. Chacun peut aussi couper le son dans son menu." },
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
    if (!out.dcats.length) out.dcats = ["Q"];
    if (out.reroll === undefined) out.reroll = true;
    if (out.wcats.length < 2) out.wcats = WORD_IDS.slice();
    return out;
  }
  // réglages réellement appliqués, le préréglage l'emporte sauf en mode perso
  function effective(s) {
    const base = normalize(s); if (base.mode === "perso") return base;
    const p = PRESETS[base.mode] || PRESETS.classique;
    const e = Object.assign({}, base, p);
    if (base.mode === "classique" || base.mode === "expert" || base.mode === "chaos" || base.mode === "equipes" || base.mode === "tournoi") e.rounds = 0;
    e.dcats = DIL_IDS.slice(); e.wcats = WORD_IDS.slice();
    return e;
  }
  // nombre de mots à pouvoir éliminer par dilemme, calculé pour que la grille se vide à peu près
  function quotaFor(grid, steps) { return Math.max(1, Math.ceil((grid - 2) / steps)); }
  return { WORD_CATS, DIL_CATS, PRESETS, SCHEMA, defaults, normalize, effective, allRules, quotaFor };
});

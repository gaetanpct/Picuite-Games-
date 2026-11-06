// ============================================================
// HANDS OVER — Réglages, familles d'épreuves, cartes (serveur et client)
// ============================================================
(function (root, factory) {
  if (typeof module !== "undefined" && module.exports) module.exports = factory();
  else root.HORules = factory();
})(typeof window !== "undefined" ? window : globalThis, function () {
  const FAMILIES = [["chance", "Chance"], ["memoire", "Mémoire"], ["reflexe", "Réflexes"], ["precision", "Précision"], ["deduction", "Déduction"], ["bluff", "Bluff"]];
  const CROCO = [["mixte", "Au hasard"], ["classique", "Classique"], ["deux", "Deux pièges"], ["chaud", "Chaud et froid"], ["mobile", "Piège mobile"], ["chrono", "Chronométré"]];
  // les cartes d'influence, chacune dit quand la jouer, ce qu'elle fait et ce qu'elle risque
  const CARDS = {
    bouclier: { icon: "🛡️", name: "Bouclier", target: false, when: "Avant l'épreuve.", text: "Si tu perds cette épreuve, tu perds une main de moins.", risk: "Aucun, mais tout le monde voit que tu es protégé.", use: "À jouer quand tu as peu de mains ou quand l'épreuve est risquée." },
    miroir: { icon: "🪞", name: "Miroir", target: true, when: "Avant l'épreuve, sur un autre joueur.", text: "Si tu perds, ta sanction est renvoyée au joueur choisi.", risk: "Si tu ne perds pas, la carte est gaspillée.", use: "À viser sur un joueur fort qui ne perd presque jamais, il ne sera pas prévenu." },
    cible: { icon: "🎯", name: "Cible", target: true, when: "Avant l'épreuve, sur un autre joueur.", text: "Si le joueur choisi perd, il perd une main de plus.", risk: "Si le joueur ne perd pas, la carte est gaspillée.", use: "Sur un joueur déjà fragile ou sur celui qui a un pacte." },
    double: { icon: "✌️", name: "Double ou rien", target: false, when: "Avant l'épreuve.", text: "Si tu gagnes tu pioches deux cartes. Si tu perds tu perds deux mains au lieu d'une.", risk: "Une défaite devient très coûteuse.", use: "Pour les joueurs confiants ou ceux qui ont besoin de remonter." },
    vol: { icon: "🫳", name: "Vol", target: true, when: "Tout de suite, sur un autre joueur.", text: "Tu prends une carte au hasard dans la main d'un joueur.", risk: "Aucun, mais la cible sait qui l'a volée.", use: "Pour désarmer un joueur qui garde beaucoup de cartes." },
    alarme: { icon: "🚨", name: "Alarme", target: false, when: "Avant l'épreuve.", text: "Annule tous les pactes de cette épreuve. Plus de fidèles ni de traîtres, chacun pour soi.", risk: "Tu casses aussi ton propre pacte.", use: "Quand tu soupçonnes une trahison, ou pour empêcher une alliance de te viser." },
    leurre: { icon: "🎭", name: "Leurre", target: false, when: "Avant l'épreuve.", text: "Annonce à tout le monde une autre carte au hasard, mais elle ne fait rien. La vérité est révélée à la fin.", risk: "Aucun, mais les malins finissent par se méfier.", use: "Pour faire croire que tu es protégé, ou que tu vises quelqu'un." },
    espion: { icon: "🕵️", name: "Espion", target: true, when: "Tout de suite, sur un autre joueur.", text: "Tu vois en secret les cartes du joueur et son pacte, avec la décision fidèle ou traître.", risk: "Aucun, mais ce que tu apprends peut déjà être périmé après un nouveau pacte.", use: "Pour savoir à qui proposer un pacte, ou avant de voler." },
    absolution: { icon: "⛪", name: "Absolution", target: false, when: "À tout moment avant l'épreuve.", text: "Efface toutes les marques que tu portes, rancune de traître et marques des fantômes.", risk: "Elle est gaspillée si tu n'as aucune marque.", use: "Après une trahison, ou si un fantôme t'a pris pour cible." },
  };
  const PACT_RULES = [
    ["🤝", "Comment ça marche", "Un pacte lie deux joueurs pour une seule épreuve. L'un propose, l'autre accepte. Chacun choisit en secret d'être fidèle ou traître. Tout le monde voit qui a un pacte, personne ne sait avec qui."],
    ["⚖️", "Quand ça joue", "Seulement à la fin de l'épreuve, si l'un des deux perd et que l'autre s'en sort."],
    ["💚", "Si le partenaire sain est fidèle", "Il prend une main à la place du perdant. Il pioche une carte en remerciement et gagne un point."],
    ["🗡️", "S'il est traître", "Le perdant perd une main de plus et le traître lui vole une carte. Mais le traître porte une rancune. Sa prochaine sanction coûte une main de plus, et tout le monde voit sa marque."],
    ["😤", "La réaction", "Le trahi pioche une carte de consolation. Les robots refusent plus souvent un pacte avec un traître, et l'Absolution efface la rancune."],
    ["✨", "Si personne ne perd", "Deux fidèles piochent chacun une carte. Un traître ne se révèle pas, son secret est gardé."],
  ];
  const MODES = [
    { value: "classique", label: "Classique", icon: "🎬", desc: "Trois mains chacun, seize épreuves au plus. Cartes d'influence, pactes et trahisons. Le dernier debout gagne." },
    { value: "survie", label: "Survie", icon: "☠️", desc: "Deux mains seulement et des épreuves plus courtes. Chaque erreur compte, les fantômes peuvent revenir." },
    { value: "equipes", label: "Équipes", icon: "🤝", desc: "Deux équipes, trois mains chacun. Une équipe gagne quand l'autre n'a plus aucun joueur debout." },
    { value: "tournoi", label: "Tournoi", icon: "🏆", desc: "Douze épreuves, personne n'est éliminé. Chaque épreuve rapporte des points, les mains perdues en retirent." },
    { value: "express", label: "Express", icon: "⚡", desc: "Deux mains, six épreuves rapides, pas de cartes ni de pactes. Une partie en dix minutes." },
    { value: "chaos", label: "Chaos", icon: "🌀", desc: "Chaque tour ajoute une règle folle, enjeu doublé, temps accéléré ou pluie de cartes." },
    { value: "perso", label: "Personnalisé", icon: "🔧", desc: "Tu règles toi-même les mains, les épreuves, le crocodile et les options." },
  ];
  const SCHEMA = [
    { category: "🎬 Le plateau", rules: [
      { id: "mode", label: "Mode de jeu", type: "cards", default: "classique", options: MODES },
      { id: "format", label: "Durée de la partie", type: "cards", default: "normal", options: [
        { value: "court", label: "Courte", icon: "⏱️", desc: "Environ un tiers d'épreuves en moins, avec les mêmes mains. La partie s'arrête au bout du nombre d'épreuves et le plus de mains gagne." },
        { value: "normal", label: "Normale", icon: "🎬", desc: "Le format prévu par le mode choisi." },
        { value: "long", label: "Longue", icon: "🕯️", desc: "Une main de plus par joueur et plus d'épreuves. Une soirée entière." },
      ], showIf: { mode: ["classique", "survie", "equipes", "tournoi", "chaos"] }, info: "Change le nombre de mains et d'épreuves du mode. Le mode Express reste court et le mode Personnalisé se règle lui-même." },
      { id: "hands", label: "Mains par joueur", type: "range", min: 1, max: 5, step: 1, default: 3, showIf: { mode: ["perso"] }, info: "Chaque épreuve perdue coûte une main. Sans main, on devient fantôme." },
      { id: "rounds", label: "Nombre d'épreuves maximum", type: "range", min: 3, max: 30, step: 1, default: 16, showIf: { mode: ["perso"] }, info: "La partie s'arrête avant s'il ne reste qu'un joueur debout." },
      { id: "families", label: "Familles d'épreuves", type: "multi", default: FAMILIES.map((f) => f[0]), options: FAMILIES.map((f) => ({ value: f[0], label: f[1] })), showIf: { mode: ["perso"] }, info: "Seules les familles cochées peuvent être tirées." },
      { id: "croco", label: "Crocodile dentiste", type: "chips", default: "mixte", options: CROCO.map((c) => ({ value: c[0], label: c[1] })), showIf: { mode: ["perso"] }, info: "La variante du crocodile quand il est tiré. Au hasard change à chaque fois." },
      { id: "cards", label: "Cartes d'influence", type: "bool", default: true, showIf: { mode: ["perso"] }, info: "Chaque joueur reçoit des cartes à jouer avant une épreuve pour se protéger ou frapper." },
      { id: "pacts", label: "Pactes et trahisons", type: "bool", default: true, showIf: { mode: ["perso"] }, info: "Deux joueurs peuvent s'allier en secret. L'un peut trahir à la fin de l'épreuve." },
      { id: "ghosts", label: "Fantômes qui hantent", type: "bool", default: true, showIf: { mode: ["perso"] }, info: "Les joueurs éliminés restent dans la partie et gênent un peu les vivants." },
      { id: "speed", label: "Rythme", type: "chips", default: 1, options: [{ value: 1.4, label: "Tranquille" }, { value: 1, label: "Normal" }, { value: 0.7, label: "Rapide" }], showIf: { mode: ["perso"] }, info: "La durée des épreuves et des pauses." },
    ] },
    { category: "🔊 Ambiance", rules: [
      { id: "sfx", label: "Bruitages", type: "bool", default: true, info: "Rires enregistrés, grincements et sirènes. Chacun peut couper le son dans son menu." },
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
      else if (r.type === "multi") { if (!Array.isArray(v)) return; const ok = valuesOf(r); const m = v.filter((x) => ok.includes(x)); out[r.id] = m.length ? m : ok.slice(0, 1); }
      else { const ok = valuesOf(r); const want = typeof ok[0] === "number" ? Number(v) : v; if (ok.includes(want)) out[r.id] = want; }
    });
    return out;
  }
  // réglages réellement appliqués, selon le mode
  function effective(settings) {
    const s = normalize(settings); const all = FAMILIES.map((f) => f[0]);
    const base = { mode: s.mode, sfx: s.sfx, hands: 3, rounds: 16, families: all, croco: "mixte", cards: true, pacts: true, ghosts: true, speed: 1, teams: false, points: false, chaos: false, format: s.format };
    switch (s.mode) {
      case "survie": Object.assign(base, { hands: 2, rounds: 24, pacts: false, speed: 0.85 }); break;
      case "equipes": Object.assign(base, { hands: 3, rounds: 18, teams: true }); break;
      case "tournoi": Object.assign(base, { hands: 4, rounds: 12, points: true, ghosts: false }); break;
      case "express": Object.assign(base, { hands: 2, rounds: 6, cards: false, pacts: false, speed: 0.7, format: "normal" }); break;
      case "chaos": Object.assign(base, { hands: 3, rounds: 16, chaos: true }); break;
      case "perso": Object.assign(base, { hands: s.hands, rounds: s.rounds, families: s.families, croco: s.croco, cards: s.cards, pacts: s.pacts, ghosts: s.ghosts, speed: s.speed, format: "normal" }); break;
      default: break;
    }
    if (base.format === "court") { base.rounds = Math.max(4, Math.round(base.rounds * 0.65)); }
    else if (base.format === "long") { base.hands = Math.min(5, base.hands + 1); base.rounds = Math.min(36, Math.round(base.rounds * 1.4)); }
    return base;
  }
  return { SCHEMA, FAMILIES, CROCO, CARDS, PACT_RULES, MODES, defaults, normalize, effective };
});

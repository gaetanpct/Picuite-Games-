// ============================================================
// HANDS OVER — Réglages, familles d'épreuves, cartes (serveur et client)
// ============================================================
(function (root, factory) {
  if (typeof module !== "undefined" && module.exports) module.exports = factory();
  else root.HORules = factory();
})(typeof window !== "undefined" ? window : globalThis, function () {
  const FAMILIES = [["chance", "Chance"], ["memoire", "Mémoire"], ["reflexe", "Réflexes"], ["precision", "Précision"], ["deduction", "Déduction"], ["bluff", "Bluff"]];
  const CROCO = [["mixte", "Au hasard"], ["classique", "Classique"], ["deux", "Deux pièges"], ["chaud", "Chaud et froid"], ["mobile", "Piège mobile"], ["chrono", "Chronométré"]];
  // les cartes d'influence
  const CARDS = {
    bouclier: { icon: "🛡️", name: "Bouclier", text: "Annule la prochaine main que tu perds ce tour-ci." },
    miroir: { icon: "🪞", name: "Miroir", text: "Renvoie ta sanction à un joueur de ton choix." },
    cible: { icon: "🎯", name: "Cible", text: "Le joueur choisi perd une main de plus s'il est dernier." },
    double: { icon: "✌️", name: "Double ou rien", text: "Si tu gagnes l'épreuve tu pioches deux cartes. Si tu perds tu perds deux mains." },
    vol: { icon: "🫳", name: "Vol", text: "Prend une carte au hasard à un joueur de ton choix, tout de suite." },
  };
  const MODES = [
    { value: "classique", label: "Classique", icon: "🎬", desc: "Deux mains chacun. Épreuves de toutes sortes, cartes d'influence, pactes. Le dernier debout gagne." },
    { value: "survie", label: "Survie", icon: "☠️", desc: "Une seule main, des épreuves plus courtes. Une erreur et tu deviens fantôme." },
    { value: "equipes", label: "Équipes", icon: "🤝", desc: "Deux équipes. Une équipe gagne quand l'autre n'a plus aucun joueur debout." },
    { value: "tournoi", label: "Tournoi", icon: "🏆", desc: "Dix épreuves, personne n'est éliminé. Chaque épreuve rapporte des points, les mains perdues en retirent." },
    { value: "express", label: "Express", icon: "⚡", desc: "Une main, cinq épreuves très courtes, pas de cartes. Une partie en dix minutes." },
    { value: "chaos", label: "Chaos", icon: "🌀", desc: "Chaque tour ajoute une règle folle, enjeu doublé, classement inversé, lumière coupée ou temps accéléré." },
    { value: "perso", label: "Personnalisé", icon: "🔧", desc: "Tu règles toi-même les mains, les épreuves, le crocodile et les options." },
  ];
  const SCHEMA = [
    { category: "🎬 Le plateau", rules: [
      { id: "mode", label: "Mode de jeu", type: "cards", default: "classique", options: MODES },
      { id: "hands", label: "Mains par joueur", type: "range", min: 1, max: 4, step: 1, default: 2, showIf: { mode: ["perso"] }, info: "Chaque épreuve perdue coûte une main. Sans main, on devient fantôme." },
      { id: "rounds", label: "Nombre d'épreuves maximum", type: "range", min: 3, max: 20, step: 1, default: 12, showIf: { mode: ["perso"] }, info: "La partie s'arrête avant s'il ne reste qu'un joueur debout." },
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
    const base = { mode: s.mode, sfx: s.sfx, hands: 2, rounds: 12, families: all, croco: "mixte", cards: true, pacts: true, ghosts: true, speed: 1, teams: false, points: false, chaos: false };
    switch (s.mode) {
      case "survie": Object.assign(base, { hands: 1, rounds: 20, pacts: false, speed: 0.8 }); break;
      case "equipes": Object.assign(base, { hands: 2, rounds: 14, teams: true }); break;
      case "tournoi": Object.assign(base, { hands: 3, rounds: 10, points: true, ghosts: false }); break;
      case "express": Object.assign(base, { hands: 1, rounds: 5, cards: false, pacts: false, speed: 0.6 }); break;
      case "chaos": Object.assign(base, { hands: 2, rounds: 12, chaos: true }); break;
      case "perso": Object.assign(base, { hands: s.hands, rounds: s.rounds, families: s.families, croco: s.croco, cards: s.cards, pacts: s.pacts, ghosts: s.ghosts, speed: s.speed }); break;
      default: break;
    }
    return base;
  }
  return { SCHEMA, FAMILIES, CROCO, CARDS, MODES, defaults, normalize, effective };
});

// ============================================================
// PAGAILLE PARTY — Réglages du salon (partagés serveur et client)
// Chaque réglage change vraiment le jeu, aucun n'est décoratif.
// ============================================================
(function (root, factory) { if (typeof module === "object" && module.exports) module.exports = factory(require("./catalog.js")); else root.PgRules = factory(root.PgCatalog); })(typeof self !== "undefined" ? self : this, function (Cat) {
  const GAME_OPTIONS = Cat.GAMES.map((g) => ({ value: g.id, label: g.name, icon: g.icon, desc: g.min + (g.max > g.min ? " à " + g.max : "") + " joueurs, " + g.kind.toLowerCase() + ". " + g.rules[0] }));
  const FORCED = [{ value: "", label: "Vote normal" }].concat(Cat.GAMES.map((g) => ({ value: g.id, label: g.icon + " " + g.name })));
  const SCHEMA = [
    { category: "🎉 La partie", rules: [
      { id: "rounds", label: "Nombre de manches", type: "chips", default: 10, options: [5, 10, 15, 20, 30], info: "Une manche est un mini-jeu. Compte entre une et deux minutes par manche, vote et règles comprises." },
      { id: "roundsCustom", label: "Nombre de manches personnalisé", type: "range", min: 0, max: 40, step: 1, default: 0, format: (v) => (v === 0 ? "pas utilisé" : v + " manches"), info: "Mets un nombre ici pour remplacer le choix du dessus. À zéro, c'est le choix du dessus qui compte." },
      { id: "mode", label: "Ambiance", type: "cards", default: "competitif", options: [
        { value: "competitif", label: "Compétitif", icon: "🏆", desc: "Les règles restent les mêmes à chaque manche, le meilleur gagne." },
        { value: "chaos", label: "Chaotique", icon: "🌪️", desc: "Une surprise tirée au hasard change la manche. Commandes inversées, pieds lourds, vitesse en folie ou points doublés." },
      ] },
      { id: "chaos", label: "Niveau de chaos", type: "chips", default: 1, options: [{ value: 0, label: "Aucune surprise" }, { value: 1, label: "Souvent" }, { value: 2, label: "À chaque manche" }], showIf: (s) => s.mode === "chaos", info: "Règle la fréquence des surprises du mode chaotique. Avec aucune surprise, le mode chaotique ne change rien." },
      { id: "board", label: "Plateau surprise entre les manches", type: "bool", default: true, info: "Après chaque manche, chacun avance sur un petit plateau selon son rang. Cadeaux, peaux de banane, échange de score, raton voleur ou foudre sur le premier, de quoi renverser le classement. Un tour complet du plateau rapporte cinq points." },
      { id: "lastDouble", label: "Dernière manche à points doubles", type: "bool", default: true, info: "Pour garder du suspense jusqu'au bout. Les points de la dernière manche comptent double." },
    ] },
    { category: "🗳️ Le choix des jeux", rules: [
      { id: "noRepeat", label: "Éviter deux fois de suite le même jeu", type: "bool", default: true, info: "Un jeu qui vient d'être joué n'est pas reproposé à la manche suivante. Les jeux pas encore joués passent aussi en priorité." },
      { id: "games", label: "Mini-jeux autorisés", type: "multi", default: Cat.ids.slice(), options: GAME_OPTIONS, info: "Décoche ceux que tu ne veux pas. Les jeux qui ne conviennent pas au nombre de joueurs présents ne sont jamais proposés." },
    ] },
    { category: "⏱️ Le rythme", rules: [
      { id: "len", label: "Durée des mini-jeux", type: "chips", default: "normal", options: [{ value: "court", label: "Courts" }, { value: "normal", label: "Normaux" }, { value: "long", label: "Longs" }], info: "Raccourcit ou allonge les jeux qui ont un temps limite, des étapes ou une montée en difficulté. Un jeu s'arrête toujours dès qu'il y a un vainqueur." },
    ] },
    { category: "🤖 Bots et tests", rules: [
      { id: "takeover", label: "Un bot remplace un joueur déconnecté", type: "bool", default: true, info: "Si quelqu'un perd la connexion pendant un mini-jeu, un bot joue à sa place jusqu'à son retour. Sinon son personnage reste immobile." },
      { id: "demo", label: "Mode démo, les bots jouent à ma place", type: "bool", default: false, info: "Pratique pour tester seul. Tous les personnages, le tien compris, sont pilotés par des bots et tu regardes la partie se dérouler." },
      { id: "forced", label: "Jeu imposé pour tester", type: "chips", default: "", options: FORCED, info: "Pour essayer un mini-jeu en boucle sans passer par le vote. Laisse sur vote normal pour jouer comme d'habitude." },
    ] },
  ];
  const FIXED = { voteTime: 20, introTime: 20, jumpAssist: false, tntFuse: "long", sumoEvents: true, bumperEvents: "normal" };
  const allRules = () => SCHEMA.reduce((a, c) => a.concat(c.rules), []);
  function defaults() { const o = {}; allRules().forEach((r) => { o[r.id] = Array.isArray(r.default) ? r.default.slice() : r.default; }); return Object.assign(o, FIXED); }
  const valuesOf = (rule) => (rule.options || []).map((o) => (typeof o === "object" ? o.value : o));
  function normalize(input) {
    const out = defaults();
    allRules().forEach((r) => {
      let v = input ? input[r.id] : undefined; if (v === undefined) return;
      if (r.type === "bool") out[r.id] = !!v;
      else if (r.type === "range") { v = Number(v); if (!isFinite(v)) return; const st = r.step || 1; v = Math.round(v / st) * st; out[r.id] = Math.max(r.min, Math.min(r.max, v)); }
      else if (r.type === "multi") { const ok = valuesOf(r); out[r.id] = Array.isArray(v) ? v.filter((x) => ok.includes(x)) : r.default.slice(); }
      else { const ok = valuesOf(r); const want = typeof ok[0] === "number" ? Number(v) : v; if (ok.includes(want)) out[r.id] = want; }
    });
    if (!out.games.length) out.games = Cat.ids.slice();
    // réglages fixes, plus proposés dans le salon. La difficulté de la Course des fous est tirée à chaque manche entre normal et costaud
    Object.assign(out, FIXED);
    return out;
  }
  const totalRounds = (s) => (s.roundsCustom > 0 ? s.roundsCustom : s.rounds);
  return { SCHEMA, defaults, normalize, allRules, totalRounds };
});

// ============================================================
// PAGAILLE PARTY — Réglages du salon (partagés serveur et client)
// ============================================================
(function (root, factory) { if (typeof module === "object" && module.exports) module.exports = factory(require("./catalog.js")); else root.PgRules = factory(root.PgCatalog); })(typeof self !== "undefined" ? self : this, function (Cat) {
  const GAME_OPTIONS = Cat.GAMES.map((g) => ({ value: g.id, label: g.name, icon: g.icon, desc: g.min + (g.max > g.min ? " à " + g.max : "") + " joueurs. " + g.rules[0] }));
  const SCHEMA = [
    { category: "🎉 La partie", rules: [
      { id: "rounds", label: "Nombre de manches", type: "chips", default: 10, options: [5, 10, 15, 20, 30], info: "Une manche est un mini-jeu de moins d'une minute. Dix manches font environ un quart d'heure." },
      { id: "roundsCustom", label: "Nombre de manches personnalisé", type: "range", min: 0, max: 40, step: 1, default: 0, format: (v) => (v === 0 ? "pas utilisé" : v + " manches"), info: "Mets un nombre ici pour remplacer le choix du dessus. À zéro, c'est le choix du dessus qui compte." },
      { id: "mode", label: "Ambiance", type: "cards", default: "competitif", options: [
        { value: "competitif", label: "Compétitif", icon: "🏆", desc: "Les règles restent les mêmes à chaque manche, le meilleur gagne." },
        { value: "chaos", label: "Chaotique", icon: "🌪️", desc: "Chaque manche reçoit une surprise tirée au hasard. Commandes inversées, vitesse en folie ou points doublés." },
      ] },
      { id: "lastDouble", label: "Dernière manche à points doubles", type: "bool", default: true, info: "Pour garder du suspense jusqu'au bout. Les points de la dernière manche comptent double." },
    ] },
    { category: "🗳️ Le choix des jeux", rules: [
      { id: "voteTime", label: "Temps pour voter", type: "chips", default: 12, options: [{ value: 8, label: "8 s" }, { value: 12, label: "12 s" }, { value: 20, label: "20 s" }], info: "Trois mini-jeux sont proposés à chaque manche. Le vote s'arrête dès que tout le monde a voté." },
      { id: "noRepeat", label: "Éviter deux fois de suite le même jeu", type: "bool", default: true, info: "Un jeu qui vient d'être joué n'est pas reproposé à la manche suivante. Les jeux pas encore joués passent aussi en priorité." },
      { id: "games", label: "Mini-jeux autorisés", type: "multi", default: Cat.ids.slice(), options: GAME_OPTIONS, info: "Décoche ceux que tu ne veux pas. Les jeux qui ne conviennent pas au nombre de joueurs présents ne sont jamais proposés." },
    ] },
    { category: "⏱️ Le rythme", rules: [
      { id: "pace", label: "Durée des manches", type: "chips", default: 1, options: [{ value: 0.7, label: "Courtes" }, { value: 1, label: "Normales" }, { value: 1.4, label: "Longues" }], info: "Allonge ou raccourcit les mini-jeux qui ont un temps limite ou plusieurs étapes." },
      { id: "introTime", label: "Temps pour lire les règles", type: "chips", default: 8, options: [{ value: 5, label: "5 s" }, { value: 8, label: "8 s" }, { value: 12, label: "12 s" }], info: "Avant chaque mini-jeu, les règles s'affichent. Elles passent plus vite si tout le monde se déclare prêt." },
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
      else if (r.type === "multi") { const ok = valuesOf(r); out[r.id] = Array.isArray(v) ? v.filter((x) => ok.includes(x)) : r.default.slice(); }
      else { const ok = valuesOf(r); const want = typeof ok[0] === "number" ? Number(v) : v; if (ok.includes(want)) out[r.id] = want; }
    });
    if (!out.games.length) out.games = Cat.ids.slice();
    return out;
  }
  const totalRounds = (s) => (s.roundsCustom > 0 ? s.roundsCustom : s.rounds);
  return { SCHEMA, defaults, normalize, allRules, totalRounds };
});

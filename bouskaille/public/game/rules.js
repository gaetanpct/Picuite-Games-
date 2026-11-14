// ============================================================
// BOUSKAILLE — Réglages (source unique pour le salon, le serveur et les bots)
// ============================================================
(function (root, factory) {
  if (typeof module !== "undefined" && module.exports) module.exports = factory(require("./arenas.js"));
  else root.BouskRules = factory(root.BouskArenas);
})(typeof window !== "undefined" ? window : globalThis, function (Arenas) {
  const ARENA_OPTIONS = Arenas.LIST.map((a) => ({ value: a.id, label: a.name, desc: a.blurb }));
  const SCHEMA = [
    { category: "🏆 La partie", rules: [
      { id: "mode", label: "Mode de jeu", type: "cards", default: "ffa", options: [
        { value: "ffa", label: "Chacun pour soi", icon: "🥊", desc: "Le dernier debout gagne la manche. Les éliminations rapportent aussi des points." },
        { value: "teams", label: "Équipe contre équipe", icon: "🤝", desc: "Deux équipes, rouge et bleue. La manche est gagnée quand toute l'équipe adverse est tombée." },
        { value: "points", label: "Points", icon: "🎯", desc: "Pas d'élimination définitive, on revient 3 secondes après sa chute. Une éjection rapporte 3 points, une chute seule en retire 1." },
        { value: "couronne", label: "Roi de la couronne", icon: "👑", desc: "Une zone dorée apparaît, un point par seconde pour celui qui s'y tient seul. Se faire éjecter coûte du temps de retour." },
      ] },
      { id: "rounds", label: "Nombre de manches", type: "range", min: 1, max: 9, step: 1, default: 5, info: "Chaque manche se joue sur une arène générée pour toi. Les points s'additionnent, donc quelqu'un d'éliminé tôt peut toujours revenir." },
      { id: "roundTime", label: "Durée d'une manche chronométrée", type: "range", min: 45, max: 150, step: 15, default: 90, unit: " s", showIf: { mode: ["points", "couronne"] } },
      { id: "firstPerson", label: "Vue à la première personne pour tous", type: "bool", default: false, info: "Si c'est activé, tout le monde joue avec la caméra à hauteur de yeux, qui tourne toute seule vers la direction où l'on va. Les flèches servent à se déplacer, F, H, T et G orientent la caméra. Le choix vaut pour tous les joueurs de la partie." },
      { id: "finalDouble", label: "Dernière manche à points doubles", type: "bool", default: true, info: "Pour que tout se joue jusqu'au bout." },
    ] },
    { category: "🏟️ Les arènes", rules: [
      { id: "arenas", label: "Arènes possibles", type: "multi", default: Arenas.IDS.slice(), options: ARENA_OPTIONS, info: "Coche les arènes que tu veux croiser. Chacune a sa façon de jouer, et chaque manche génère une variante différente." },
      { id: "hazards", label: "Pièges de l'arène", type: "chips", default: "normal", options: [{ value: "none", label: "Aucun" }, { value: "normal", label: "Normaux" }], info: "Les pistons et les bras tournants peuvent être retirés pour un duel plus pur." },
      { id: "shrink", label: "Les bords s'effondrent à la fin", type: "bool", default: true, info: "Après une minute environ, l'arène rétrécit. Ça évite les manches qui n'en finissent plus.", showIf: { mode: ["ffa", "teams"] } },
      { id: "friendly", label: "Équipiers qui se poussent", type: "bool", default: false, showIf: { mode: "teams" }, info: "Par défaut on ne peut pas bousculer ses équipiers." },
    ] },
  ];
  const allRules = () => SCHEMA.reduce((a, c) => a.concat(c.rules), []);
  const defaults = () => { const o = {}; allRules().forEach((r) => { o[r.id] = Array.isArray(r.default) ? r.default.slice() : r.default; }); return o; };
  const valuesOf = (rule) => (rule.options || []).map((o) => (typeof o === "object" ? o.value : o));
  function normalize(input) {
    const out = defaults();
    allRules().forEach((r) => {
      let v = input ? input[r.id] : undefined; if (v === undefined) return;
      if (r.type === "bool") out[r.id] = !!v;
      else if (r.type === "range") { v = Number(v); if (!isFinite(v)) return; const st = r.step || 1; v = Math.round(v / st) * st; out[r.id] = Math.max(r.min, Math.min(r.max, v)); }
      else if (r.type === "multi") { const ok = valuesOf(r); out[r.id] = Array.isArray(v) ? v.filter((x) => ok.includes(x)) : r.default.slice(); }
      else { const ok = valuesOf(r); if (ok.includes(v)) out[r.id] = v; }
    });
    if (!out.arenas.length) out.arenas = [Arenas.IDS[0]];
    return out;
  }
  const MODES = { ffa: "Chacun pour soi", teams: "Équipe contre équipe", points: "Points", couronne: "Roi de la couronne" };
  const isTimed = (m) => m === "points" || m === "couronne";
  const placePoints = (n, place) => Math.max(0, n + 1 - place);
  return { SCHEMA, defaults, normalize, MODES, isTimed, placePoints };
});

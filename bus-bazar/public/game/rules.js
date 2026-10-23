// ============================================================
// BUS BAZAR — Réglages du salon (source unique, serveur et client)
// ============================================================
(function (root, factory) {
  if (typeof module !== "undefined" && module.exports) module.exports = factory(require("./data.js"));
  else root.BBRules = factory(root.BBData);
})(typeof window !== "undefined" ? window : globalThis, function (D) {
  const lvl = (names) => (v) => names[v];
  const SCALE5 = ["aucun", "faible", "normal", "fort", "extrême"];
  const BIOME_OPTIONS = D.BIOMES.map((b) => ({ value: b.id, label: b.label, icon: b.icon }));
  const SCHEMA = [
    { category: "🚌 La mission", rules: [
      { id: "mode", label: "Mode de mission", type: "cards", default: "standard", options: D.MODES.map((m) => ({ value: m.id, label: m.label, icon: m.icon, desc: m.desc })) },
      { id: "duration", label: "Durée de la mission", type: "chips", default: "standard", options: [{ value: "court", label: "Courte" }, { value: "standard", label: "Standard" }, { value: "long", label: "Longue" }], info: "Courte compte trois étapes, soit environ 8 minutes. Standard en compte sept, environ 18 minutes. Longue en compte onze, environ 26 minutes. Chaque étape finit par un arrêt." },
      { id: "rotation", label: "Rotation des postes", type: "cards", default: "fixe", options: [
        { value: "fixe", label: "Équipage fixe", icon: "🧷", desc: "Chacun garde son poste pendant toute la mission." },
        { value: "releve", label: "Relève à chaque arrêt", icon: "🔁", desc: "À chaque arrêt, les joueurs passent au poste suivant, pour que tout le monde essaie tous les métiers. Les postes sans humain restent confiés aux robots." },
      ] },
      { id: "seed", label: "Graine du parcours", type: "text", default: "", max: 20, placeholder: "Laisse vide pour du hasard", info: "Écris un mot pour rejouer le même trajet, les mêmes passagers et les mêmes objets de départ. Ce que les joueurs décident ensuite change la suite." },
    ] },
    { category: "🌪️ Le chaos", rules: [
      { id: "difficulty", label: "Difficulté de la route", type: "range", min: 1, max: 5, step: 1, default: 3, info: "Plus c'est haut, plus les virages sont serrés, les obstacles nombreux et le bus sensible aux erreurs." },
      { id: "chaos", label: "Intensité du chaos", type: "range", min: 0, max: 4, step: 1, default: 2, format: lvl(SCALE5), info: "Détermine la fréquence des incidents et la vitesse à laquelle les problèmes se cumulent. Une valeur élevée crée davantage de situations urgentes, sans jamais rendre les événements impossibles à gérer." },
      { id: "breakdowns", label: "Intensité des pannes", type: "range", min: 0, max: 4, step: 1, default: 2, format: lvl(SCALE5), info: "Règle l'usure du bus et la fréquence des pannes mécaniques. Aucun laisse le mécanicien se reposer, extrême lui donne du travail sans arrêt." },
      { id: "traffic", label: "Densité du trafic", type: "range", min: 0, max: 4, step: 1, default: 2, format: lvl(SCALE5), info: "Nombre de véhicules lents, de piétons et d'obstacles sur la route." },
      { id: "demand", label: "Exigence des passagers", type: "range", min: 0, max: 4, step: 1, default: 2, format: lvl(SCALE5), info: "Plus c'est haut, plus les passagers demandent souvent quelque chose et plus leur humeur chute vite." },
      { id: "passengers", label: "Nombre de passagers", type: "chips", default: 10, options: [{ value: 6, label: "6" }, { value: 10, label: "10" }, { value: 14, label: "14" }, { value: 18, label: "18" }], info: "Le nombre de passagers au départ. Plus il y en a, plus la cabine est chargée. Les arrêts en font descendre et monter d'autres." },
    ] },
    { category: "🎒 Ressources et humour", rules: [
      { id: "resources", label: "Quantité de ressources", type: "chips", default: "normal", options: [{ value: "rare", label: "Rares" }, { value: "normal", label: "Normales" }, { value: "abondant", label: "Abondantes" }], info: "Carburant, pièces de rechange, ruban, liquide de refroidissement, snacks et argent de départ." },
      { id: "objects", label: "Fréquence des objets absurdes", type: "chips", default: "normal", options: [{ value: "rare", label: "Rares" }, { value: "normal", label: "Normaux" }, { value: "frequent", label: "Fréquents" }], info: "Klaxon de clown, marteau en mousse, canard en plastique et autres. Ils tombent des incidents, des arrêts et des cadeaux de passagers." },
      { id: "sabotage", label: "Blagues entre équipiers", type: "chips", default: "limite", options: [{ value: "aucune", label: "Aucune" }, { value: "limite", label: "Limitées" }, { value: "total", label: "Totales" }], info: "Messages radio dramatiques, fausses alertes, annonces déplacées, insecte factice sur le pare-brise et vote d'urgence. Limitées ne laisse que la radio et l'annonce. Totales ouvre tout, avec un délai plus court entre deux blagues." },
      { id: "slaps", label: "Baffes cartoon", type: "bool", default: true, info: "La petite claque de dessin animé de la responsable de cabine, sans violence réaliste. Décoché, l'action disparaît." },
      { id: "objectives", label: "Objectifs secondaires", type: "bool", default: true, info: "Deux ou trois missions annexes tirées au sort, comme livrer un colis ou arriver avant l'heure. Elles rapportent des points mais compliquent le trajet." },
    ] },
    { category: "🛣️ Le trajet", rules: [
      { id: "biomes", label: "Types de routes", type: "multi", default: D.BIOME_IDS.slice(), options: BIOME_OPTIONS, info: "Coche les routes que tu veux croiser. Chacune change la conduite, la visibilité, l'adhérence et les incidents possibles. Il en faut au moins une." },
    ] },
    { category: "🤖 L'équipage", rules: [
      { id: "botSkill", label: "Niveau des robots", type: "chips", default: "habile", options: [{ value: "debutant", label: "Débutants" }, { value: "habile", label: "Habiles" }, { value: "expert", label: "Experts" }], info: "Les robots tiennent les postes sans humain. Débutants réagissent lentement et se trompent parfois, experts réagissent vite." },
      { id: "fillAbsent", label: "Remplacer un joueur absent par un robot", type: "bool", default: true, info: "Quand un joueur perd la connexion, son poste est repris par un robot, et il le retrouve en revenant. Décoché, le poste reste simplement vide." },
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
      else if (r.type === "text") out[r.id] = String(v).replace(/[^A-Za-z0-9À-ÿ _-]/g, "").trim().slice(0, r.max || 20);
      else if (r.type === "multi") { const ok = valuesOf(r); out[r.id] = Array.isArray(v) ? v.filter((x) => ok.includes(x)) : r.default.slice(); }
      else { const ok = valuesOf(r); const want = typeof ok[0] === "number" ? Number(v) : v; if (ok.includes(want)) out[r.id] = want; }
    });
    if (!out.biomes.length) out.biomes = [D.BIOME_IDS[0]];
    return out;
  }
  const SEGMENTS = { court: 3, standard: 7, long: 11 };
  return { SCHEMA, defaults, normalize, allRules, SEGMENTS };
});

// ============================================================
// BUS BAZAR — Réglages du salon (source unique, serveur et client)
// ============================================================
(function (root, factory) {
  if (typeof module !== "undefined" && module.exports) module.exports = factory(require("./road.js"), require("./layout.js"));
  else root.BBRules = factory(root.BBRoad, root.BBL);
})(typeof window !== "undefined" ? window : globalThis, function (Road, L) {
  const lvl = (names) => (v) => names[v];
  const SCALE5 = ["aucun", "faible", "normal", "fort", "extrême"];
  const BIOME_OPTIONS = Road.BIOMES.map((b) => ({ value: b.id, label: b.label, icon: b.icon }));
  const SCHEMA = [
    { category: "🚌 La mission", rules: [
      { id: "legs", label: "Durée du voyage", type: "chips", default: 5, options: [{ value: 3, label: "Court, 3 étapes" }, { value: 5, label: "Normal, 5 étapes" }, { value: 8, label: "Long, 8 étapes" }], info: "Chaque étape est un trajet entre deux arrêts, d'environ une minute de route. Prévois aussi le temps passé aux arrêts pour choisir les passagers et ranger les colis." },
      { id: "difficulty", label: "Difficulté de la route", type: "range", min: 1, max: 5, step: 1, default: 3, info: "Plus c'est haut, plus les virages sont serrés et plus le bus glisse. Le conducteur doit anticiper davantage." },
      { id: "seed", label: "Graine du voyage", type: "text", default: "", max: 20, placeholder: "Laisse vide pour du hasard", info: "Écris un mot pour rejouer exactement la même route, la même météo et les mêmes candidats au voyage." },
    ] },
    { category: "🧳 Passagers et colis", rules: [
      { id: "crowd", label: "Affluence aux arrêts", type: "range", min: 0, max: 4, step: 1, default: 2, format: lvl(SCALE5), info: "Nombre de candidats au voyage qui attendent à chaque arrêt. Les remplir, c'est de l'argent, mais plus de monde veut dire plus de problèmes." },
      { id: "demand", label: "Exigence des passagers", type: "range", min: 0, max: 4, step: 1, default: 2, format: lvl(SCALE5), info: "Fréquence des demandes comme avoir faim, soif, peur ou besoin de descendre. Plus c'est haut, plus l'équipage court partout." },
      { id: "troublemakers", label: "Fauteurs de trouble", type: "range", min: 0, max: 4, step: 1, default: 2, format: lvl(SCALE5), info: "Les farceurs, fêtards et énervés qui lancent des objets, ouvrent les portes ou embêtent leurs voisins." },
      { id: "cargo", label: "Colis dangereux", type: "chips", default: "normal", options: [{ value: "aucun", label: "Aucun" }, { value: "rare", label: "Rares" }, { value: "normal", label: "Normaux" }, { value: "frequent", label: "Fréquents" }], info: "Poulets, feux d'artifice, statues fragiles, fûts qui fuient. Ils paient bien mais deviennent vite un cauchemar." },
      { id: "eject", label: "Éjecter les fauteurs de trouble", type: "bool", default: true, info: "Autorise à porter un passager énervé jusqu'à la porte d'un arrêt, ou jusqu'à la porte de secours en roulant. C'est drôle, mais cela coûte de la réputation." },
    ] },
    { category: "🌪️ Route et chaos", rules: [
      { id: "weather", label: "Météo", type: "chips", default: "varie", options: [{ value: "calme", label: "Calme" }, { value: "varie", label: "Variée" }, { value: "capricieux", label: "Capricieuse" }], info: "Pluie, brouillard, vent et orage changent l'adhérence, la visibilité et poussent le bus sur le côté." },
      { id: "turbulence", label: "Secousses de la route", type: "range", min: 0, max: 4, step: 1, default: 2, format: lvl(SCALE5), info: "Nids de poule, gravier et rafales. Les passagers debout tombent, les colis glissent, les nerveux paniquent." },
      { id: "traffic", label: "Obstacles sur la route", type: "range", min: 0, max: 4, step: 1, default: 2, format: lvl(SCALE5), info: "Vaches, moutons, rochers et cônes. Le klaxon fait fuir les animaux." },
      { id: "breakdowns", label: "Pannes du bus", type: "range", min: 0, max: 4, step: 1, default: 2, format: lvl(SCALE5), info: "Surchauffe du moteur, crevaisons et départs de feu. Le mécano a du travail." },
      { id: "biomes", label: "Types de routes", type: "multi", default: Road.BIOME_IDS.slice(), options: BIOME_OPTIONS, info: "Coche les décors que tu veux croiser. Chacun change le revêtement et les virages." },
    ] },
    { category: "🤖 L'équipage", rules: [
      { id: "fillAbsent", label: "Robots pour les postes vides", type: "bool", default: true, info: "Les postes sans joueur sont tenus par des robots lents mais courageux. Décoche pour que personne ne les remplace." },
      { id: "botSkill", label: "Niveau des robots", type: "chips", default: "normal", options: [{ value: "lent", label: "Lents" }, { value: "normal", label: "Normaux" }, { value: "vif", label: "Vifs" }], info: "La vitesse à laquelle les robots rendent service et la qualité de leur conduite." },
      { id: "assist", label: "Halos sur les objets utiles", type: "bool", default: true, info: "Fait briller ce avec quoi on peut interagir. Décoche pour un voyage plus sauvage." },
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
    if (!out.biomes.length) out.biomes = [Road.BIOME_IDS[0]];
    return out;
  }
  return { SCHEMA, defaults, normalize };
});

// ============================================================
// VERTIGOGO — Réglages (source unique pour le salon, le serveur et les bots)
// ============================================================
(function (root, factory) { if (typeof module === "object" && module.exports) module.exports = factory(require("./vgcourse.js")); else root.VgRules = factory(root.VgCourse); })(typeof self !== "undefined" ? self : this, function (Cr) {
  const SCHEMA = [
    { category: "🏔️ La course", rules: [
      { id: "mode", label: "Mode de jeu", type: "cards", default: "classique", options: [
        { value: "classique", label: "Classique", icon: "🧗", desc: "Aucun point de passage. Si tu tombes, tu retombes. Un filet te rattrape seulement au début de chaque zone." },
        { value: "points", label: "Points de passage", icon: "🚩", desc: "Des drapeaux jalonnent la montée. Après une chute, tu reprends au dernier drapeau atteint." },
        { value: "chrono", label: "Contre la montre", icon: "⏱️", desc: "Même règle que les points de passage, mais chaque chute ajoute 5 secondes à ton temps." },
        { value: "jour", label: "Parcours du jour", icon: "📅", desc: "Le même parcours pour tout le monde aujourd'hui, avec des points de passage. Compare ton temps à celui des autres." },
      ] },
      { id: "length", label: "Hauteur du parcours", type: "chips", default: "moyen", options: [{ value: "court", label: "Court" }, { value: "moyen", label: "Moyen" }, { value: "long", label: "Long" }], info: "Court, quatre zones. Moyen, six zones. Long, les huit zones à la suite.", showIf: { mode: ["classique", "points", "chrono"] } },
      { id: "diff", label: "Difficulté", type: "chips", default: "normal", options: [{ value: "facile", label: "Facile" }, { value: "normal", label: "Normale" }, { value: "difficile", label: "Difficile" }], info: "Change la taille des sauts et la vitesse des pièges. Tous les parcours restent faisables.", showIf: { mode: ["classique", "points", "chrono"] } },
      { id: "seed", label: "Graine du parcours", type: "text", max: 20, default: "", placeholder: "Laisse vide pour un parcours au hasard", info: "Deux salons avec la même graine et les mêmes réglages jouent exactement le même parcours.", showIf: { mode: ["classique", "points", "chrono"] } },
      { id: "timeLimit", label: "Temps maximum", type: "range", min: 5, max: 30, step: 5, default: 15, unit: " min", info: "La partie s'arrête quand tout le monde a fini ou quand le temps est écoulé." },
    ] },
    { category: "🌆 Les environnements", rules: [
      { id: "pool", label: "Environnements possibles", type: "multi", default: Cr.THEMES.map((t, i) => String(i)), options: Cr.NAMES.map((n, i) => ({ value: String(i), label: n, desc: Cr.BLURBS[i] })), info: "Les zones s'empilent toujours dans le même ordre. Décoche celles que tu ne veux pas croiser.", showIf: { mode: ["classique", "points", "chrono"] } },
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
      else if (r.type === "text") out[r.id] = String(v).replace(/[^\p{L}\p{N}_\- ]/gu, "").slice(0, r.max || 20);
      else { const ok = valuesOf(r); if (ok.includes(v)) out[r.id] = v; }
    });
    if (!out.pool.length) out.pool = ["0"];
    return out;
  }
  const MODES = { classique: "Classique", points: "Points de passage", chrono: "Contre la montre", jour: "Parcours du jour" };
  const ZONES = { court: 4, moyen: 6, long: 8 };
  // paramètres de génération à partir des réglages
  function courseOpts(s, dayLabel) {
    const jour = s.mode === "jour";
    return { seed: jour ? "jour-" + dayLabel : (s.seed || ""), zones: jour ? 6 : ZONES[s.length] || 6, diff: jour ? "normal" : s.diff, pool: jour ? null : s.pool.map(Number) };
  }
  const checkpoints = (mode) => mode !== "classique";
  return { SCHEMA, defaults, normalize, MODES, courseOpts, checkpoints };
});

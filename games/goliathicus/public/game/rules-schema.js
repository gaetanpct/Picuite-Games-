// ============================================================
// GOLIATHICUS — Réglages de partie (source unique)
// Sert à générer le salon, valider les valeurs et fournir les défauts.
// ============================================================
(function (root, factory) {
  if (typeof module !== "undefined" && module.exports) module.exports = factory();
  else root.GoliathRules = factory();
})(typeof window !== "undefined" ? window : globalThis, function () {
  // type : "cards" (grandes cartes), "chips" (boutons), "bool" (interrupteur)
  const SCHEMA = [
    {
      category: "⚔️ Façon de gagner",
      rules: [
        {
          id: "mode", label: "Mode de jeu", type: "cards", default: "classic",
          options: [
            { value: "classic", label: "Classique", icon: "🥚", desc: "Croque l'Œuf de Dragon d'un adversaire pour l'éliminer. Le dernier en lice gagne." },
            { value: "conquest", label: "Conquête", icon: "🏆", desc: "Tiens les reliques du centre pour marquer des points. Le premier à atteindre l'objectif gagne, ou le dernier en lice." },
            { value: "kinghunt", label: "Chasse au roi", icon: "👑", desc: "Pas d'œuf ! Un camp est éliminé quand son Roi tombe. Protège ton roi, planque-le bien." },
          ],
          info: "Le mode de victoire de la partie.",
        },
        { id: "relicTarget", label: "Points de reliques pour gagner", type: "chips", default: 12, options: [8, 12, 16, 24], showIf: { mode: "conquest" }, info: "Chaque relique tenue au début de ton tour rapporte 1 point." },
        { id: "relicOrbits", label: "Nombre de reliques", type: "chips", default: 1, options: [{ value: 1, label: "Peu" }, { value: 2, label: "Beaucoup" }], showIf: { mode: "conquest" }, info: "Peu = 4 reliques (2 en duel), beaucoup = le double." },
      ],
    },
    {
      category: "🌶️ Pimente la partie",
      rules: [
        { id: "teams", label: "👯 Équipes 2 contre 2", type: "bool", default: false, needs: { players: 4 }, info: "Uniquement à 4. Tu joues avec le joueur en face de toi, vous partagez ce que vous savez, vous ne pouvez pas vous attaquer. L'équipe gagne quand les deux adversaires sont éliminés." },
        { id: "fog", label: "🌫️ Brouillard", type: "bool", default: false, info: "Tu ne vois que les pièces proches des tiennes. Le reste du plateau est dans la brume." },
        { id: "fogRadius", label: "Portée de vue", type: "chips", default: 2, options: [1, 2, 3], showIf: { fog: true }, info: "Distance maximale (en cases) à laquelle tu vois les pièces ennemies." },
        { id: "chaos", label: "🎲 Chaos", type: "bool", default: false, info: "Un événement surprise secoue le royaume à intervalles réguliers : boue, tourbillon, tartes qui tombent du ciel..." },
        { id: "chaosEvery", label: "Un événement tous les", type: "chips", default: 5, options: [{ value: 3, label: "3 tours" }, { value: 5, label: "5 tours" }, { value: 8, label: "8 tours" }], showIf: { chaos: true }, info: "Un « tour » = tout le monde a joué une fois." },
        { id: "boardSize", label: "⚡ Taille du plateau", type: "chips", default: "normal", options: [{ value: "normal", label: "Normale (~35 min)" }, { value: "express", label: "Express (~10 min)" }], info: "Express = petit plateau et armées de 12 pièces, pour une partie éclair." },
      ],
    },
    {
      category: "🗺️ Le royaume",
      rules: [
        {
          id: "terrain", label: "Relief", type: "chips", default: "classic",
          options: [
            { value: "classic", label: "Classique" }, { value: "random", label: "Aléatoire" }, { value: "wild", label: "Sauvage" }, { value: "none", label: "Plaine" },
          ],
          info: "Classique = un grand lac central. Aléatoire = lacs, forêts et marais tirés au sort (toujours équitable). Sauvage = beaucoup de relief. Plaine = aucun obstacle.",
        },
        { id: "terrainInfo", type: "legend", info: "🌲 Forêt : le défenseur qui gagne un combat ici reste caché.   🟤 Marais : une pièce qui s'y arrête dort un tour.   💧 Lac : infranchissable." },
      ],
    },
    {
      category: "🛡️ Les armées",
      rules: [
        {
          id: "armyPreset", label: "Composition", type: "cards", default: "standard",
          options: [
            { value: "standard", label: "Équilibrée", icon: "⚖️", desc: "La recette classique." },
            { value: "offensive", label: "Offensive", icon: "⚔️", desc: "Peu de pièges, beaucoup de gros bras." },
            { value: "trap", label: "Piégeuse", icon: "🥧", desc: "Des tartes et des nains." },
            { value: "fast", label: "Rapide", icon: "🧚", desc: "Des lutins à gogo." },
            { value: "loufoque", label: "Fantômes", icon: "👻", desc: "Avec des fantômes.", needs: { specialPieces: true } },
            { value: "custom", label: "Sur mesure", icon: "🛠️", desc: "Compose ton armée avec un budget." },
          ],
          info: "Tout le monde joue avec la même composition (équitable).",
        },
        { id: "armyBudget", label: "Budget de l'armée sur mesure", type: "chips", default: 150, options: [110, 130, 150, 180], showIf: { armyPreset: "custom" }, info: "Chaque pièce coûte des points. Plus le budget est élevé, plus l'armée est costaude." },
        { id: "customArmy", type: "armyEditor", default: null, showIf: { armyPreset: "custom" } },
        { id: "specialPieces", label: "👻 Pièces spéciales", type: "bool", default: true, info: "Autorise le Fantôme (saute par-dessus un obstacle) dans les compositions." },
        { id: "survivorsRevealed", label: "👁️ Les survivants restent dévoilés", type: "bool", default: true, info: "Activé = après un combat, la pièce gagnante reste visible de tous. Désactivé = mode mémoire, tu dois te souvenir de ce que tu as vu." },
      ],
    },
    {
      category: "🏰 Les maisons",
      rules: [
        { id: "powers", label: "✨ Pouvoirs de maison", type: "bool", default: true, info: "Chaque maison a un pouvoir à usage limité : Coup de Théâtre, Longue-vue, Sieste Générale ou Ruée Dorée." },
        { id: "powerCharges", label: "Utilisations par partie", type: "chips", default: 1, options: [1, 2, 3], showIf: { powers: true }, info: "Combien de fois chaque joueur peut utiliser son pouvoir." },
      ],
    },
    {
      category: "⏱️ Rythme et fin de partie",
      rules: [
        { id: "turnTimer", label: "Temps par tour", type: "chips", default: 90, options: [{ value: 0, label: "Illimité" }, { value: 30, label: "30 s" }, { value: 60, label: "60 s" }, { value: 90, label: "90 s" }, { value: 180, label: "3 min" }], info: "Si le temps est écoulé, un coup raisonnable est joué à ta place." },
        { id: "eliminated", label: "Camp éliminé", type: "chips", default: "ruins", options: [{ value: "ruins", label: "Devient ruines" }, { value: "vanish", label: "Disparaît" }], info: "Ruines = les pièces restantes se changent en obstacles infranchissables. Disparaît = elles s'évaporent." },
        { id: "slowMode", label: "🐢 Mode lent", type: "bool", default: false, info: "Les pions glissent plus doucement et l'IA prend son temps, pratique pour suivre ce qu'il se passe." },
      ],
    },
  ];

  function allRules() {
    const out = [];
    SCHEMA.forEach((c) => c.rules.forEach((r) => out.push(r)));
    return out;
  }

  function defaults() {
    const d = {};
    allRules().forEach((r) => { if (r.type !== "legend") d[r.id] = r.default; });
    return d;
  }

  // Les valeurs valides d'un réglage.
  function allowedValues(rule) {
    if (!rule.options) return null;
    return rule.options.map((o) => (typeof o === "object" ? o.value : o));
  }

  // Valide et complète des réglages reçus (jamais d'exception).
  function normalize(input, playerCount) {
    const base = defaults();
    const src = input && typeof input === "object" ? input : {};
    allRules().forEach((r) => {
      if (r.type === "legend") return;
      let v = src[r.id];
      if (v === undefined) return;
      if (r.type === "bool") base[r.id] = !!v;
      else if (r.type === "armyEditor") base[r.id] = v && typeof v === "object" ? v : null;
      else {
        const ok = allowedValues(r);
        if (ok && ok.includes(v)) base[r.id] = v;
        else if (ok) {
          const num = Number(v);
          if (ok.includes(num)) base[r.id] = num;
        }
      }
    });
    if (typeof playerCount === "number") {
      if (playerCount !== 4) base.teams = false;
    }
    if (!base.specialPieces && base.armyPreset === "loufoque") base.armyPreset = "standard";
    return base;
  }

  return { SCHEMA, allRules, defaults, normalize, allowedValues };
});

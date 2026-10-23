// ============================================================
// BUS BAZAR — Route générée à partir d'une graine (serveur et client, identique)
// ============================================================
(function (root, factory) {
  if (typeof module !== "undefined" && module.exports) module.exports = factory();
  else root.BBRoad = factory();
})(typeof window !== "undefined" ? window : globalThis, function () {
  function hashSeed(str) { let h = 2166136261 >>> 0; str = String(str); for (let i = 0; i < str.length; i++) { h ^= str.charCodeAt(i); h = Math.imul(h, 16777619) >>> 0; } return h >>> 0; }
  function mulberry32(a) { return function () { a |= 0; a = (a + 0x6d2b79f5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }
  const rngOf = (seed) => mulberry32(hashSeed(seed));
  const STEP = 2;
  const BIOMES = [
    { id: "campagne", label: "Campagne", icon: "🌾", surf: [0, 0, 0, 1], curve: 1, hill: 1 },
    { id: "desert", label: "Désert", icon: "🌵", surf: [0, 0, 1, 1], curve: 0.8, hill: 0.8 },
    { id: "neige", label: "Montagne enneigée", icon: "🏔️", surf: [0, 0, 3, 3], curve: 1.5, hill: 1.4 },
    { id: "ville", label: "Banlieue", icon: "🏘️", surf: [0, 0, 0, 0], curve: 1.1, hill: 0.4 },
    { id: "cote", label: "Route côtière", icon: "🌊", surf: [0, 0, 2, 0], curve: 1.3, hill: 1 },
  ];
  const BIOME_IDS = BIOMES.map((b) => b.id);
  const WEATHER = [{ id: "clair", label: "Grand soleil", icon: "☀️", grip: 1 }, { id: "pluie", label: "Pluie", icon: "🌧️", grip: 0.75 }, { id: "brouillard", label: "Brouillard", icon: "🌫️", grip: 0.9 }, { id: "orage", label: "Orage", icon: "⛈️", grip: 0.7 }, { id: "vent", label: "Grand vent", icon: "🌬️", grip: 0.85 }];
  const SURF = [{ id: "asphalte", label: "Asphalte", grip: 1, bump: 0 }, { id: "gravier", label: "Gravier", grip: 0.8, bump: 0.5 }, { id: "boue", label: "Boue", grip: 0.55, bump: 0.35 }, { id: "verglas", label: "Verglas", grip: 0.38, bump: 0.05 }];
  const STOP_NAMES = ["Gare de Trifouilly", "Place du Marché Boiteux", "Carrefour des Oies", "Les Trois Platanes", "Auberge du Gros Moteur", "Parking de la Grande Poule", "Saint-Canard-sur-Mer", "Hameau des Courants d'Air", "Pont de la Baguette", "Fontaine des Râleurs", "Zone industrielle des Rêves"];
  const OBST = {
    vache: { label: "Vache", w: 1.5, dmg: 14, mobile: true }, mouton: { label: "Moutons", w: 1.7, dmg: 10, mobile: true }, roche: { label: "Rocher", w: 1.2, dmg: 20 },
    trou: { label: "Nid de poule", w: 1.5, dmg: 4, bump: 1 }, cone: { label: "Cônes", w: 0.7, dmg: 2 }, ralent: { label: "Ralentisseur", w: 12, dmg: 0, bump: 0.8 },
  };

  function make(seed, o) {
    o = o || {};
    const legs = Math.max(2, Math.min(10, o.legs || 5)); const diff = 0.6 + (o.difficulty || 3) * 0.16; const rng = rngOf(seed + "|road"); const trafficN = o.traffic == null ? 2 : o.traffic;
    const biomes = (o.biomes && o.biomes.length ? o.biomes : BIOME_IDS).filter((b) => BIOME_IDS.includes(b));
    const legLen = 640 + Math.round((o.legLen || 0)); const lead = 50; const len = lead + legs * legLen + 60;
    const n = Math.ceil(len / STEP) + 4;
    const curv = new Float32Array(n), surf = new Uint8Array(n), wx = new Uint8Array(n), bio = new Uint8Array(n), hill = new Float32Array(n);
    const stops = [{ s: lead, name: "Départ du dépôt", biome: biomes[0], leg: 0 }];
    for (let k = 1; k <= legs; k++) stops.push({ s: lead + k * legLen, name: k === legs ? "Terminus " + STOP_NAMES[Math.floor(rng() * STOP_NAMES.length)] : STOP_NAMES[Math.floor(rng() * STOP_NAMES.length)], leg: k });
    // une météo et un décor par étape
    const legWeather = [], legBiome = [];
    const calm = o.weather === "calme" ? 0 : o.weather === "capricieux" ? 2 : 1;
    for (let k = 0; k < legs; k++) {
      legBiome.push(biomes[Math.floor(rng() * biomes.length)]);
      const r = rng(); let w = 0;
      if (calm === 0) w = r < 0.85 ? 0 : 1; else if (calm === 1) w = r < 0.45 ? 0 : r < 0.65 ? 1 : r < 0.78 ? 2 : r < 0.9 ? 4 : 3; else w = r < 0.12 ? 0 : r < 0.35 ? 1 : r < 0.55 ? 2 : r < 0.75 ? 3 : 4;
      legWeather.push(w);
    }
    stops[0].biome = legBiome[0]; for (let k = 1; k <= legs; k++) stops[k].biome = legBiome[Math.min(legs - 1, k)];
    const legOf = (s) => Math.max(0, Math.min(legs - 1, Math.floor((s - lead) / legLen)));
    for (let i = 0; i < n; i++) { const s = i * STEP; const lg = legOf(s); bio[i] = BIOME_IDS.indexOf(legBiome[lg]); wx[i] = legWeather[lg]; }
    // virages. Aucune courbe près des arrêts pour garder l'approche lisible
    const nearStop = (s) => stops.some((st) => s > st.s - 70 && s < st.s + 40);
    for (let lg = 0; lg < legs; lg++) {
      const B = BIOMES[BIOME_IDS.indexOf(legBiome[lg])] || BIOMES[0]; const a0 = lead + lg * legLen + 90, a1 = lead + (lg + 1) * legLen - 90;
      let s = a0; const maxC = 0.011 * B.curve * diff;
      while (s < a1) {
        const segL = 50 + rng() * 120; const sign = rng() < 0.5 ? -1 : 1; const amp = (rng() < 0.3 ? 0 : (0.25 + rng() * 0.75)) * maxC * sign;
        for (let x = s; x < Math.min(a1, s + segL); x += STEP) { const i = Math.round(x / STEP); const t = (x - s) / segL; const e = Math.sin(Math.PI * Math.min(1, t * 1.0)) ; curv[i] += amp * Math.min(1, e * 1.6); }
        s += segL + 10;
      }
      // revêtement
      let sx = a0; while (sx < a1) { const L = 80 + rng() * 160; const sf = B.surf[Math.floor(rng() * B.surf.length)]; for (let x = sx; x < Math.min(a1, sx + L); x += STEP) surf[Math.round(x / STEP)] = rng() < 0.0 ? 0 : sf; sx += L; }
    }
    for (let i = 0; i < n; i++) { const s = i * STEP; if (nearStop(s)) { curv[i] = 0; surf[i] = 0; } }
    // lissage de la courbure
    for (let pass = 0; pass < 3; pass++) for (let i = 1; i < n - 1; i++) curv[i] = (curv[i - 1] + curv[i] * 2 + curv[i + 1]) / 4;
    // relief pour les chocs (simple bruit lent)
    for (let i = 0; i < n; i++) hill[i] = Math.sin(i * 0.031 + 1.3) * 0.5 + Math.sin(i * 0.011) * 0.5;
    // pose du centre de la route, th est le cap, la direction est (sin th, cos th)
    const px = new Float32Array(n), pz = new Float32Array(n), th = new Float32Array(n);
    for (let i = 1; i < n; i++) { th[i] = th[i - 1] + curv[i - 1] * STEP; px[i] = px[i - 1] + Math.sin(th[i - 1] + curv[i - 1] * STEP / 2) * STEP; pz[i] = pz[i - 1] + Math.cos(th[i - 1] + curv[i - 1] * STEP / 2) * STEP; }
    // obstacles
    const obstacles = []; let oid = 1; const orng = rngOf(seed + "|obst");
    const kinds = { campagne: ["vache", "mouton", "roche", "trou", "cone"], desert: ["roche", "trou", "vache", "cone"], neige: ["roche", "trou", "cone"], ville: ["cone", "trou", "ralent"], cote: ["roche", "trou", "mouton", "cone"] };
    for (let lg = 0; lg < legs; lg++) {
      const cnt = Math.round((2 + lg * 0.3 + trafficN * 2.3) * (0.6 + diff * 0.4)); const a0 = lead + lg * legLen + 110, a1 = lead + (lg + 1) * legLen - 110; const list = kinds[legBiome[lg]] || kinds.campagne;
      for (let k = 0; k < cnt; k++) { const s = a0 + (a1 - a0) * ((k + 0.2 + orng() * 0.6) / cnt); const type = list[Math.floor(orng() * list.length)]; const e = type === "ralent" ? 0 : (orng() * 2 - 1) * 3.4; obstacles.push({ id: oid++, s: Math.round(s), e: +e.toFixed(1), type, gone: false }); }
    }
    stops.forEach((st) => { if (st.leg > 0) obstacles.push({ id: oid++, s: st.s - 55, e: 0, type: "ralent", gone: false }); });
    obstacles.sort((a, b) => a.s - b.s);
    const idx = (s) => Math.max(0, Math.min(n - 2, Math.floor(s / STEP)));
    function at(s) { const i = idx(s); const f = Math.max(0, Math.min(1, (s - i * STEP) / STEP)); const l = (a) => a[i] + (a[i + 1] - a[i]) * f; return { curv: l(curv), th: l(th), px: l(px), pz: l(pz), surf: surf[i], wx: wx[i], bio: bio[i], hill: l(hill) }; }
    return { seed, legs, legLen, len, lead, stops, obstacles, at, half: 5.2, legWeather, legBiome, n };
  }
  return { make, rngOf, hashSeed, mulberry32, BIOMES, BIOME_IDS, WEATHER, SURF, OBST, STEP };
});

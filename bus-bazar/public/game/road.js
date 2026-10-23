// ============================================================
// BUS BAZAR — Route générée (serveur et client)
// Une étape est une route déterminée par une graine. Le serveur et le client la reconstruisent à l'identique.
// ============================================================
(function (root, factory) {
  if (typeof module !== "undefined" && module.exports) module.exports = factory(require("./data.js"));
  else root.BBRoad = factory(root.BBData);
})(typeof window !== "undefined" ? window : globalThis, function (D) {
  function hashSeed(str) { let h = 2166136261 >>> 0; str = String(str); for (let i = 0; i < str.length; i++) { h ^= str.charCodeAt(i); h = Math.imul(h, 16777619) >>> 0; } return h >>> 0; }
  function mulberry32(a) { return function () { a |= 0; a = (a + 0x6d2b79f5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }
  const rngOf = (seed) => mulberry32(hashSeed(seed));
  const STEP = 20; // un point de courbure tous les 20 m
  const KINDS = {
    direct: { label: "Route directe", icon: "⚡", lenMul: 0.86, curveMul: 1.18, bias: ["etroit", "montagne", "chantier", "industrie"], note: "Plus courte, mais plus serrée et plus risquée." },
    sure: { label: "Route sûre", icon: "🛡️", lenMul: 1.12, curveMul: 0.8, bias: ["campagne", "cote", "ville"], note: "Plus longue, plus calme et plus facile à conduire." },
    pittoresque: { label: "Route pittoresque", icon: "🌄", lenMul: 1.0, curveMul: 1.0, bias: ["cote", "montagne", "campagne"], note: "Des points d'intérêt pour les passagers, au prix d'un trajet moyen." },
  };
  const POI_NAMES = ["le Pont des Soupirs", "la Vache Monumentale", "le Rond-point Fleuri", "le Moulin Penché", "la Cascade du Bus", "le Panneau Qui Tourne", "la Grande Baguette", "le Belvédère des Mouettes", "l'Usine Rigolote", "le Champ de Citrouilles"];
  const STOP_NAMES = ["Gare de Trifouilly", "Place du Marché Boiteux", "Carrefour des Oies", "Station Les Trois Platanes", "Auberge du Gros Moteur", "Parking de la Grande Poule", "Arrêt Saint-Canard", "Dépôt de Bourg-les-Nids", "Rond-Point du Fromage", "Halte de la Dernière Chance", "Terminus de Grand-Pétaouchnoque", "Gare de Plouc-sur-Mer"];
  const stopName = (seed, k) => { const r = rngOf(seed + "stopn" + k); const a = STOP_NAMES.slice(); for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(r() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a[k % a.length]; };

  // choisit un type de route pour une variante
  function pickBiome(rng, allowed, kind) {
    const ids = allowed && allowed.length ? allowed : D.BIOME_IDS; const bias = KINDS[kind].bias;
    const w = ids.map((id) => 1 + (bias.indexOf(id) >= 0 ? 3 : 0)); let tot = w.reduce((a, b) => a + b, 0); let r = rng() * tot;
    for (let i = 0; i < ids.length; i++) { r -= w[i]; if (r <= 0) return ids[i]; }
    return ids[0];
  }
  // fabrique une étape. opts contient seed, index, kind, biome (optionnel), difficulty
  function makeSegment(opts) {
    const rng = rngOf(opts.seed + "|seg" + opts.index + "|" + opts.kind);
    const biomeId = opts.biome || pickBiome(rng, opts.biomes, opts.kind); const B = D.BIOMES.filter((b) => b.id === biomeId)[0] || D.BIOMES[0]; const K = KINDS[opts.kind] || KINDS.sure;
    const diff = 0.7 + (opts.difficulty || 3) * 0.12; // 0.82 à 1.3
    const len = Math.round((2200 + rng() * 500) * K.lenMul / 10) * 10; const n = Math.ceil(len / STEP) + 8;
    const curve = new Array(n).fill(0), hill = new Array(n).fill(0);
    const amp = 0.0105 * B.curve * K.curveMul * diff;
    const turns = Math.max(3, Math.round(len / 330 * (0.7 + B.curve * 0.5)));
    for (let t = 0; t < turns; t++) {
      const sc = 220 + rng() * (len - 520), hw = 35 + rng() * 85, pk = (0.35 + rng() * 0.65) * amp * (rng() < 0.5 ? -1 : 1);
      for (let i = 0; i < n; i++) { const s = i * STEP; const d = (s - sc) / hw; if (d > -3 && d < 3) curve[i] += pk * Math.exp(-d * d * 1.2); }
    }
    for (let i = 0; i < n; i++) { const s = i * STEP; let c = curve[i]; if (s < 120 || s > len - 150) c *= Math.max(0, Math.min(1, s < 120 ? s / 120 : (len - s) / 150)); curve[i] = Math.max(-0.021, Math.min(0.021, c)); }
    const h1 = rng() * 6, h2 = rng() * 6, hAmp = 0.05 * B.hill;
    for (let i = 0; i < n; i++) { const s = i * STEP; let g = hAmp * (Math.sin(s / 260 + h1) * 0.65 + Math.sin(s / 97 + h2) * 0.35); if (s > len - 160) g *= Math.max(0, (len - s) / 160); hill[i] = Math.max(-0.1, Math.min(0.1, g)); }
    const pois = []; if (opts.kind === "pittoresque" || rng() < 0.35) { const count = opts.kind === "pittoresque" ? 2 : 1; for (let q = 0; q < count; q++) pois.push({ s: Math.round(len * (0.25 + 0.4 * rng() + q * 0.25) / 10) * 10, name: POI_NAMES[Math.floor(rng() * POI_NAMES.length)] }); }
    let curv = 0; for (let i = 0; i < n; i++) curv += Math.abs(curve[i]); curv = curv / n / 0.01;
    return { seed: opts.seed, index: opts.index, kind: opts.kind, biome: B.id, len, step: STEP, curve: curve.map((v) => +v.toFixed(5)), hill: hill.map((v) => +v.toFixed(4)), pois, decor: Math.floor(rng() * 1e9), curvIdx: +curv.toFixed(2), stopZone: 130 };
  }
  const idx = (seg, s) => Math.max(0, Math.min(seg.curve.length - 2, s / seg.step));
  function curveAt(seg, s) { const f = idx(seg, s), i = Math.floor(f), u = f - i; return seg.curve[i] * (1 - u) + seg.curve[i + 1] * u; }
  function hillAt(seg, s) { const f = idx(seg, s), i = Math.floor(f), u = f - i; return seg.hill[i] * (1 - u) + seg.hill[i + 1] * u; }
  return { hashSeed, mulberry32, rngOf, STEP, KINDS, makeSegment, curveAt, hillAt, stopName, pickBiome, POI_NAMES };
});

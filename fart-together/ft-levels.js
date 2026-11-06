// ============================================================
// FART TOGETHER — Générateur de parcours
// Chaque parcours est une suite de tronçons, avec ses courants, ses rapides, ses chutes,
// ses rampes et ses zones absurdes. Tout est tiré d'une graine, donc reproductible.
// ============================================================
const mulberry32 = (a) => () => { a |= 0; a = (a + 0x6D2B79F5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
const STEP = 3;
// tronçons, [genre, longueur, paramètre]
const COURSES = [
  { id: "riviere", name: "La Rivière Tranquille", biome: "prairie", blurb: "Pour apprendre à pousser ensemble. Un courant doux, quelques rochers et une première chicane.", par: 85, recipe: [["calm", 60], ["bend", 70, 0.9], ["rocks", 60], ["chicane", 90, 1], ["bend", 80, -1.1], ["calm", 40], ["rocks", 70], ["bend", 60, 0.8], ["calm", 50]] },
  { id: "canal", name: "Le Canal Étroit", biome: "ville", blurb: "Goulots entre deux rochers, piliers et une épingle à cheveux. La précision avant la puissance.", par: 92, recipe: [["calm", 40], ["narrow", 70], ["bend", 50, 1.3], ["goulot", 72], ["pillars", 70], ["epingle", 66, -2.7], ["narrow", 80], ["goulot", 60], ["calm", 30]] },
  { id: "rapides", name: "Les Rapides Rageurs", biome: "canyon", blurb: "L'eau file, des vagues secouent la bouée et ça penche tout le temps.", par: 70, recipe: [["calm", 30], ["rapids", 90], ["bend", 60, -1], ["rapids", 100], ["rocks", 50], ["rapids", 90], ["calm", 30]] },
  { id: "cascade", name: "La Cascade Folle", biome: "jungle", blurb: "Des chutes, des rampes et des atterrissages qui retournent l'équipage.", par: 50, recipe: [["calm", 40], ["drop", 45], ["rocks", 50], ["ramp", 50], ["bend", 50, 0.8], ["drop", 50], ["calm", 30], ["ramp", 50], ["pool", 40]] },
  { id: "contre", name: "Le Contre-Courant", biome: "glacier", blurb: "Le courant remonte et le sol est glissant. Il faut ramer très fort et très ensemble.", par: 85, recipe: [["calm", 30], ["counter", 80], ["ice", 70], ["bend", 60, 1.1], ["counter", 90], ["ice", 60], ["calm", 30]] },
  { id: "marais", name: "Le Marais Fromagé", biome: "marais", blurb: "Du fromage fondu qui colle, des canards géants qui traversent. Absurde et poisseux.", par: 85, recipe: [["calm", 30], ["cheese", 80], ["ducks", 80], ["bend", 60, -1], ["cheese", 70], ["ducks", 90], ["calm", 30]] },
  { id: "parc", name: "Le Parc Aquatique", biome: "parc", blurb: "Slalom de portes, trampolines et rampes. Tout est fait pour s'éclater.", par: 62, recipe: [["calm", 30], ["slalom", 90], ["pad", 50], ["slalom", 80], ["ramp", 50], ["bend", 60, 1], ["pad", 50], ["pool", 40]] },
  { id: "canyon", name: "Le Canyon Sauteur", biome: "desert", blurb: "Des rampes pour franchir des trous. L'atterrissage décide de tout.", par: 55, recipe: [["calm", 30], ["ramp", 50], ["rapids", 60], ["ramp", 50], ["bend", 60, -1.2], ["ramp", 50], ["drop", 40], ["pool", 40]] },
  { id: "tuyaux", name: "Les Tuyaux Géants", biome: "egout", blurb: "Des tuyaux étroits, du vent qui pousse de côté et de l'écho partout, avec une épingle et une chicane à négocier.", par: 78, recipe: [["calm", 30], ["pipe", 80], ["wind", 70, 1], ["epingle", 66, 2.6], ["pipe", 70], ["wind", 70, -1], ["chicane", 90, -1], ["pipe", 60], ["calm", 30]] },
  { id: "huit", name: "Le Grand Huit", biome: "fete", blurb: "Le parcours final avec absolument tout. Bonne chance et bon courage.", par: 125, recipe: [["calm", 25], ["rapids", 70], ["ramp", 50], ["narrow", 60], ["cheese", 50], ["counter", 60], ["epingle", 66, 2.7], ["drop", 50], ["slalom", 70], ["ice", 50], ["goulot", 60], ["wind", 50, -1], ["chicane", 90, 1], ["ramp", 50], ["pool", 40]] },
];
const BIOMES = require("./public/game/biomes.js");
// paramètres des tronçons
const KIND = {
  calm: { hw: 9, flow: 3.4 }, bend: { hw: 9, flow: 3.6 }, rocks: { hw: 10, flow: 3.6, rocks: 0.1 }, narrow: { hw: 5.4, flow: 3.8 }, pillars: { hw: 7.5, flow: 3.8, rocks: 0.11, pillar: true },
  rapids: { hw: 8.5, flow: 7.2, turb: true, rocks: 0.07 }, drop: { hw: 7.5, flow: 11, slope: 7.5 }, ramp: { hw: 8.5, flow: 5.6, ramp: true }, counter: { hw: 8.5, flow: -1.8 },
  ice: { hw: 9, flow: 1.4, zone: 2 }, cheese: { hw: 9.5, flow: 3, zone: 1, rocks: 0.05 }, ducks: { hw: 11, flow: 3, ducks: true }, slalom: { hw: 9, flow: 4, gates: true },
  chicane: { hw: 7.6, flow: 3.8 }, epingle: { hw: 7.4, flow: 3.8 }, goulot: { hw: 5.4, flow: 3.8 },
  pad: { hw: 9, flow: 4.4, zone: 4 }, pipe: { hw: 4.6, flow: 5.2 }, wind: { hw: 7, flow: 4.4, zone: 3 }, pool: { hw: 16, flow: 1.3 },
};
function makeLevel(course, seed, opts) {
  opts = opts || {}; const rnd = mulberry32(seed >>> 0 || 1); const recipe = typeof course === "string" ? (COURSES.find((c) => c.id === course) || COURSES[0]).recipe : course.recipe;
  const meta = typeof course === "string" ? (COURSES.find((c) => c.id === course) || COURSES[0]) : course;
  const x = [0], z = [0], hw = [9], flow = [3.4], slope = [0], zone = [0], turb = [0], h = [0], s = [0];
  let heading = 0; const obstacles = [], ramps = [], coins = [], gates = []; let curHw = 9, curFlow = 3.4;
  const diff = opts.difficulty || 1;
  const rockMul = diff === 0 ? 0.7 : diff === 2 ? 1.4 : 1;
  const addObs = (px, pz, r, kind, mv) => obstacles.push({ id: obstacles.length, x: px, z: pz, r, kind, mv: mv || null });
  recipe.forEach(([kind, len, par]) => {
    const K = KIND[kind] || KIND.calm; const steps = Math.max(2, Math.round(len / STEP)); const turn = (kind === "bend" || kind === "epingle" ? par : kind === "slalom" ? 0 : (rnd() - 0.5) * 0.35) / steps;
    const startIdx = x.length; let sinceRock = 4;
    const base0 = heading;
    for (let k = 0; k < steps; k++) {
      if (kind === "chicane") heading = base0 + (par || 1) * 0.62 * Math.sin((k + 1) / steps * Math.PI * 4); else
      heading += turn + (kind === "rapids" || kind === "drop" ? (rnd() - 0.5) * 0.05 : 0);
      const px = x[x.length - 1] + Math.sin(heading) * STEP, pz = z[z.length - 1] + Math.cos(heading) * STEP;
      curHw += (K.hw - curHw) * 0.35; curFlow += (K.flow - curFlow) * 0.3;
      x.push(px); z.push(pz); hw.push(curHw); flow.push(curFlow); const sl = K.slope || (kind === "calm" ? 0.1 : 0.3); slope.push(sl);
      zone.push(K.zone ? (K.zone === 3 ? (par > 0 ? 3 : 5) : K.zone) : 0); turb.push(K.turb ? 1 : 0);
      h.push(h[h.length - 1] - sl * STEP * 0.12); s.push(s[s.length - 1] + STEP);
      // obstacles de ce pas
      const tx = Math.sin(heading), tz = Math.cos(heading), nx = -tz, nz = tx; sinceRock++;
      if (K.rocks && sinceRock * STEP >= 8 && rnd() < K.rocks * STEP * rockMul) {
        sinceRock = 0; const r = K.pillar ? 1.4 : 1.1 + rnd() * 0.9; const lat = (rnd() * 2 - 1) * Math.max(0.5, curHw - r - 3.4);
        addObs(px + nx * lat, pz + nz * lat, r, K.pillar ? "pilier" : "rocher");
      }
      if (K.ducks && k % 11 === 5) { const lat = (rnd() * 2 - 1) * 2; addObs(px + nx * lat, pz + nz * lat, 2.1, "canard", { ax: nx, az: nz, amp: curHw - 4.2, f: 0.55 + rnd() * 0.4, ph: rnd() * 6.28 }); }
      if (kind === "rapids" && k % 9 === 4 && rnd() < 0.7) { const lat = (rnd() * 2 - 1) * (curHw - 4); addObs(px + nx * lat, pz + nz * lat, 1.2 + rnd() * 0.6, "rocher"); }
      if (kind === "goulot" && k % 8 === 3) { const sd = (Math.floor(k / 8) % 2 ? 1 : -1); addObs(px + nx * sd * 1.5, pz + nz * sd * 1.5, 1.0, "rocher"); }
      if (kind === "slalom" && k % 7 === 3) { const sd = (Math.floor(k / 7) % 2 ? 1 : -1); addObs(px + nx * sd * (curHw - 3.2), pz + nz * sd * (curHw - 3.2), 1.6, "bouee"); gates.push({ i: x.length - 1, x: px, z: pz, hw: Math.min(6.4, curHw - 2.5), s: s[s.length - 1] }); }
      if (kind === "rocks" && k % 9 === 2) { const lat = (rnd() * 2 - 1) * (curHw - 4); coins.push({ x: px + nx * lat, z: pz + nz * lat }); }
      else if ((kind === "calm" || kind === "pool" || kind === "bend" || kind === "pad" || kind === "narrow") && k % 6 === 3) { const lat = (rnd() * 2 - 1) * (curHw - 3.5); coins.push({ x: px + nx * lat, z: pz + nz * lat }); }
      else if (k % 8 === 4 && kind !== "drop") { const lat = (rnd() * 2 - 1) * (curHw - 3.5); coins.push({ x: px + nx * lat, z: pz + nz * lat }); }
    }
    if (K.ramp) { const mid = startIdx + Math.floor(steps * 0.45); ramps.push({ s: s[mid], len: 9, power: 1 }); }
    if (kind === "pad") { for (let q = 0; q < 2; q++) { const i = startIdx + Math.floor(steps * (0.3 + q * 0.35)); ramps.push({ s: s[i], len: 6, power: 0.75, pad: true }); } }
    if (kind === "drop") { ramps.push({ s: s[startIdx + steps - 2], len: 6, power: 0.55, fall: true }); }
  });
  // porte d'arrivée toutes les 75 unités environ pour l'objectif des portes
  if (!gates.length) for (let i = 18; i < x.length - 8; i += 24) gates.push({ i, x: x[i], z: z[i], hw: Math.min(6.4, hw[i] - 2.5), s: s[i] });
  const n = x.length; const L = s[n - 1];
  const lv = { id: meta.id, name: meta.name, biome: meta.biome, par: meta.par, seed, n, L, x, z, hw, flow, slope, zone, turb, h, s, obstacles, ramps, coins, gates, step: STEP };
  return lv;
}
// parcours sans fin, longs, tirés au sort avec une difficulté croissante
function endlessRecipe(seed, length) {
  const rnd = mulberry32((seed + 99) >>> 0); const kinds = ["calm", "bend", "rocks", "narrow", "chicane", "goulot", "rapids", "ramp", "drop", "counter", "ice", "cheese", "ducks", "slalom", "pad", "pipe", "wind", "pillars", "epingle"];
  const rec = [["calm", 40]]; let total = 40;
  while (total < length) {
    const prog = total / length; const pool = prog < 0.25 ? kinds.slice(0, 6) : prog < 0.6 ? kinds.slice(0, 12) : kinds;
    const k = pool[Math.floor(rnd() * pool.length)]; const len = 50 + Math.floor(rnd() * 5) * 10;
    rec.push([k, len, k === "bend" ? (rnd() < 0.5 ? -1 : 1) * (0.7 + rnd() * 0.8) : k === "epingle" ? (rnd() < 0.5 ? -1 : 1) * 2.6 : k === "chicane" ? (rnd() < 0.5 ? -1 : 1) : k === "wind" ? (rnd() < 0.5 ? 1 : -1) : undefined]); total += len;
    if (rnd() < 0.3) { rec.push(["calm", 30]); total += 30; }
  }
  rec.push(["pool", 40]); return rec;
}
module.exports = { COURSES, BIOMES, makeLevel, endlessRecipe, mulberry32, STEP };

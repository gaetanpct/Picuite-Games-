// ============================================================
// GOLFOUILLE — Générateur de trous
// À partir d'une graine et de réglages, fabrique un trou complet
// (relief, surfaces, obstacles, pièges, orbes). Même graine, même trou.
// ============================================================
(function (root, factory) {
  if (typeof module !== "undefined" && module.exports) module.exports = factory(require("./physics.js"));
  else root.GolfCourse = factory(root.GolfPhysics);
})(typeof window !== "undefined" ? window : globalThis, function (Physics) {
  const S = Physics.S;
  function mulberry32(a) {
    return function () { a |= 0; a = (a + 0x6D2B79F5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
  }
  function hashSeed(str) { let h = 2166136261; str = String(str); for (let i = 0; i < str.length; i++) { h ^= str.charCodeAt(i); h = Math.imul(h, 16777619); } return h >>> 0; }
  const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
  const lerp = (a, b, t) => a + (b - a) * t;
  const smooth = (t) => { t = clamp(t, 0, 1); return t * t * (3 - 2 * t); };

  // Les huit biomes. Les couleurs servent à l'affichage, le reste à la génération.
  const BIOMES = {
    prairie: { id: "prairie", name: "Prairie", icon: "🌳", gravity: 9.8, sky: ["#6ec6ff", "#e8f7ff"], fog: "#d6efff", sun: "#fff4d6", amb: "#bfe3ff",
      col: { fairway: "#62c96e", green: "#7fe08a", rough: "#3f9a50", sand: "#f0d98c", water: "#3da5ee", ice: "#bfeaff", mud: "#7a5a3a", lava: "#ff5a2a", bouncy: "#ff9ad5", wall: "#2f7a40" },
      hazards: { water: 3, sand: 3, mud: 1 }, obst: { tree: 6, rock: 2, mushroom: 0.4 }, names: ["Le Grand Chêne", "La Mare aux Canards", "Pré Fleuri", "La Colline Douce", "Le Pique-nique"] },
    desert: { id: "desert", name: "Désert", icon: "🌵", gravity: 9.8, sky: ["#ffb347", "#fff0cf"], fog: "#ffe2b0", sun: "#fff0c0", amb: "#ffe0b0",
      col: { fairway: "#ecc77c", green: "#f6dc9a", rough: "#cf9650", sand: "#f7e2a0", water: "#35b6c9", ice: "#d9f4ff", mud: "#8a5a30", lava: "#ff5a2a", bouncy: "#ffb870", wall: "#b9783a" },
      hazards: { sand: 5, mud: 2, water: 1.5 }, obst: { cactus: 6, rock: 3 }, names: ["Mirage Piquant", "L'Oasis Perdue", "Dune Chaude", "Le Chameau Boudeur", "Canyon Sec"] },
    neige: { id: "neige", name: "Neige", icon: "⛄", gravity: 9.8, sky: ["#a9d8ff", "#f4fbff"], fog: "#e6f3ff", sun: "#ffffff", amb: "#d0e8ff",
      col: { fairway: "#f2f7ff", green: "#ffffff", rough: "#c4d7ea", sand: "#e3d8c0", water: "#2a6fb0", ice: "#a8e4ff", mud: "#6a5a50", lava: "#ff5a2a", bouncy: "#c9f0ff", wall: "#9bb5cf" },
      hazards: { ice: 5, water: 1.5, mud: 1, sand: 0.5 }, obst: { pine: 5, snowman: 3, rock: 2 }, names: ["Piste Verglacée", "Le Bonhomme Gelé", "Sapin Givré", "Lac Glacé", "Col Blanc"] },
    jungle: { id: "jungle", name: "Jungle", icon: "🦜", gravity: 9.8, sky: ["#6ed49a", "#e9ffe2"], fog: "#b9ecc4", sun: "#fff6c0", amb: "#a8e8b8",
      col: { fairway: "#3fb35e", green: "#5fd47a", rough: "#1f7a3d", sand: "#d8c27a", water: "#2b9a8a", ice: "#bfeaff", mud: "#6a4a2a", lava: "#ff5a2a", bouncy: "#ff7ac0", wall: "#165a2c" },
      hazards: { water: 4, mud: 4, sand: 1 }, obst: { jtree: 6, rock: 2, mushroom: 2 }, names: ["Liane Glissante", "La Rivière Folle", "Champignon Géant", "Temple Moussu", "Singe Farceur"] },
    volcan: { id: "volcan", name: "Volcan", icon: "🌋", gravity: 9.8, sky: ["#6a2a3a", "#ff9a5a"], fog: "#d8785a", sun: "#ffc890", amb: "#ff9a70",
      col: { fairway: "#6a5660", green: "#8a7480", rough: "#3e3038", sand: "#9a8e8a", water: "#3da5ee", ice: "#bfeaff", mud: "#4a3a30", lava: "#ff5a1a", bouncy: "#ff9a40", wall: "#2a1e24" },
      hazards: { lava: 5, sand: 2, mud: 1 }, obst: { rock: 5, crystal: 3 }, names: ["Cratère Rouge", "Coulée de Lave", "La Cheminée", "Fournaise", "Cendres Chaudes"] },
    plage: { id: "plage", name: "Plage", icon: "🏖️", gravity: 9.8, sky: ["#5ad0ff", "#fff6dc"], fog: "#e6f6ff", sun: "#fff6d0", amb: "#c8ecff",
      col: { fairway: "#f3e2a8", green: "#fff0be", rough: "#d6b878", sand: "#fff2c0", water: "#26b8e8", ice: "#d9f4ff", mud: "#8a6a4a", lava: "#ff5a2a", bouncy: "#ff9ad5", wall: "#c8a468" },
      hazards: { water: 5, sand: 2, mud: 0.6 }, obst: { palm: 6, parasol: 2, rock: 2 }, names: ["Bord de Mer", "Palmier Penché", "Château de Sable", "La Crique Secrète", "Marée Haute"] },
    bonbons: { id: "bonbons", name: "Bonbons", icon: "🍭", gravity: 9.8, sky: ["#ffb3e0", "#fff4fb"], fog: "#ffd9f0", sun: "#fff0f8", amb: "#ffd0ee",
      col: { fairway: "#ff9fd6", green: "#ffc2e6", rough: "#c98cf0", sand: "#ffe9a8", water: "#6ad0ff", ice: "#d9f4ff", mud: "#7a4a30", lava: "#ff5a8a", bouncy: "#7affc0", wall: "#a368d8" },
      hazards: { bouncy: 4, mud: 3, water: 2, sand: 1 }, obst: { lolli: 5, cane: 3, gummy: 3 }, names: ["Route Guimauve", "Rivière de Soda", "Chocolat Fondu", "Gelée Rebondissante", "Sucre d'Orge"] },
    cosmos: { id: "cosmos", name: "Cosmos", icon: "🪐", gravity: 3.4, sky: ["#07041f", "#3a1f7a"], fog: "#241250", sun: "#c8c0ff", amb: "#6a60c0", stars: true,
      col: { fairway: "#7f8cff", green: "#a8b2ff", rough: "#4a3ea0", sand: "#b8a8e8", water: "#0a0a20", ice: "#bfeaff", mud: "#4a3070", lava: "#ff4a8a", bouncy: "#5affd0", wall: "#2a2070" },
      hazards: { water: 3, bouncy: 2.5, ice: 2, sand: 1 }, obst: { asteroid: 6, crystal: 3 }, names: ["Orbite Basse", "Pluie d'Astéroïdes", "Anneau de Saturne", "La Lune Rieuse", "Trou Noir Poli"] },
  };
  const BIOME_IDS = Object.keys(BIOMES);

  // Obstacles. r rayon, h hauteur de collision, e rebond.
  const OBST = {
    tree: { r: 0.5, h: 7, e: 0.5 }, pine: { r: 0.45, h: 7, e: 0.5 }, palm: { r: 0.32, h: 6, e: 0.5 }, jtree: { r: 0.6, h: 8, e: 0.5 },
    cactus: { r: 0.45, h: 2.7, e: 0.45 }, rock: { r: 1.1, h: 1.7, e: 0.35 }, snowman: { r: 0.7, h: 2.1, e: 0.4 },
    mushroom: { r: 0.9, h: 1.5, e: 1.1, bouncy: true }, lolli: { r: 0.4, h: 3, e: 0.6 }, cane: { r: 0.35, h: 2.7, e: 0.6 },
    asteroid: { r: 1.2, h: 2.4, e: 0.4 }, crystal: { r: 0.6, h: 2.6, e: 0.5 }, parasol: { r: 0.25, h: 2.4, e: 0.5 }, gummy: { r: 0.85, h: 1.3, e: 1.0, bouncy: true },
  };
  const LENGTHS = { 1: 44, 2: 72, 3: 108 };

  function pickWeighted(rng, table) {
    const keys = Object.keys(table); let tot = 0; keys.forEach((k) => { tot += table[k]; });
    let x = rng() * tot; for (const k of keys) { x -= table[k]; if (x <= 0) return k; }
    return keys[keys.length - 1];
  }

  // bruit de valeur pour le relief
  function makeNoise(seed) {
    const h = (i, j) => { let n = (Math.imul(i, 374761393) + Math.imul(j, 668265263) + seed) | 0; n = Math.imul(n ^ (n >>> 13), 1274126177); return ((n ^ (n >>> 16)) >>> 0) / 4294967296; };
    const v = (x, z) => { const i = Math.floor(x), j = Math.floor(z); const u = smooth(x - i), w = smooth(z - j); return lerp(lerp(h(i, j), h(i + 1, j), u), lerp(h(i, j + 1), h(i + 1, j + 1), u), w); };
    return (x, z) => (v(x, z) * 0.65 + v(x * 2.1 + 7, z * 2.1 + 3) * 0.35) * 2 - 1;
  }

  // spec = { seed, biome, size 1 à 3, difficulty 1 à 5, hills 0 à 3, hazards 0 à 3, obstacles 0 à 3, features {...}, orbs, wind }
  function generateHole(spec) {
    const rng = mulberry32(hashSeed(spec.seed));
    const biome = BIOMES[spec.biome] || BIOMES.prairie;
    const diff = clamp(Math.round(spec.difficulty || 3), 1, 5);
    const hillsLv = clamp(spec.hills == null ? 2 : spec.hills, 0, 3);
    const hazLv = clamp(spec.hazards == null ? 2 : spec.hazards, 0, 3);
    const obsLv = clamp(spec.obstacles == null ? 2 : spec.obstacles, 0, 3);
    const feat = spec.features || {};
    const noise = makeNoise(hashSeed(spec.seed + "n"));
    const len = LENGTHS[spec.size] * (0.9 + 0.2 * rng());
    const ds = 2; const n = Math.ceil(len / ds) + 1;

    // ----- ligne centrale -----
    const bends = 1 + Math.floor(diff * 0.45 + rng() * 1.8);
    const targets = []; let sign = rng() < 0.5 ? -1 : 1;
    for (let i = 0; i < bends; i++) { targets.push(sign * (0.3 + rng() * 0.6)); sign = rng() < 0.75 ? -sign : sign; }
    const path = []; let px = 0, pz = 0, hd = 0;
    for (let k = 0; k < n; k++) {
      path.push({ x: px, z: pz, s: k * ds });
      const seg = Math.min(bends - 1, Math.floor((k / n) * bends));
      const tg = k < 5 ? 0 : targets[seg];
      hd += clamp(tg - hd, -0.055, 0.055);
      hd = clamp(hd, -1.05, 1.05);
      px += Math.sin(hd) * ds; pz += Math.cos(hd) * ds;
      path[k].h = hd;
    }
    const L = (n - 1) * ds;
    // largeur du fairway
    const baseHw = lerp(9.5, 4.2, (diff - 1) / 4);
    const hwArr = path.map((p, k) => { let w = baseHw * (1 + 0.2 * Math.sin(k * 0.33 + 1.7) + 0.1 * Math.sin(k * 0.9)); if (k < 4) w = Math.max(w, 5.2); if (k > n - 6) w = Math.max(w, 6); return w; });

    // ----- emplacements spéciaux (avant les pièges, pour réserver la place) -----
    const taken = []; // zones en s déjà occupées
    const free = (s, r) => taken.every((t) => Math.abs(t - s) > r);
    const specials = [];
    function placeSpecial(kind, lo, hi, r, widen) {
      for (let t = 0; t < 30; t++) {
        const s = lerp(lo, hi, rng()) * L; if (!free(s, r)) continue;
        taken.push(s); specials.push({ kind, s });
        if (widen) path.forEach((p, k) => { const d = Math.abs(p.s - s); if (d < widen + 6) hwArr[k] = Math.max(hwArr[k], lerp(widen > 0 ? 5.6 : 0, hwArr[k], smooth((d - widen) / 6))); });
        return true;
      }
      return false;
    }
    if (feat.windmills && L > 50 && rng() < 0.55 + diff * 0.07) placeSpecial("windmill", 0.35, 0.8, 12, 5);
    if (feat.sliders && L > 60 && rng() < 0.4 + diff * 0.06) placeSpecial("slider", 0.3, 0.85, 12, 5);
    if (feat.bumpers && rng() < 0.55) placeSpecial("bumpers", 0.25, 0.85, 10, 4);
    if (feat.boosts && rng() < 0.7) placeSpecial("boost", 0.15, 0.7, 9, 0);
    if (feat.trampolines && L > 55 && rng() < 0.4) placeSpecial("tramp", 0.3, 0.75, 10, 0);
    let portalAt = null;
    if (feat.portals && L > 70 && rng() < 0.35) { const s1 = lerp(0.25, 0.4, rng()) * L; if (free(s1, 10) && free(s1 + 22, 8)) { portalAt = s1; taken.push(s1, s1 + 22); } }

    const pathAt = (s) => {
      const f = clamp(s / ds, 0, n - 1.0001); const k = Math.floor(f); const t = f - k; const a = path[k], b = path[k + 1];
      return { x: lerp(a.x, b.x, t), z: lerp(a.z, b.z, t), h: lerp(a.h, b.h, t), hw: lerp(hwArr[k], hwArr[k + 1], t), s };
    };

    // relief le long du chemin
    const amp = hillsLv * 2.1;
    const ph = [rng() * 6.28, rng() * 6.28, rng() * 6.28]; const wl1 = 32 + rng() * 22, wl2 = 15 + rng() * 9; const tilt = (rng() - 0.5) * hillsLv * 0.05;
    const elevS = (s) => amp * (0.62 * Math.sin((2 * Math.PI * s) / wl1 + ph[0]) + 0.38 * Math.sin((2 * Math.PI * s) / wl2 + ph[1])) + tilt * s;
    const e0 = elevS(0);
    const elev = (s) => elevS(s) - e0 + 2;

    // ----- repérage d'un point par rapport à la ligne -----
    const segs = [];
    for (let k = 0; k < n - 1; k++) segs.push([path[k], path[k + 1]]);
    function locate(x, z) {
      let bd = 1e9, bs = 0, bu = 0, bk = 0;
      for (let k = 0; k < segs.length; k++) {
        const a = segs[k][0], b = segs[k][1]; const dx = b.x - a.x, dz = b.z - a.z; const l2 = dx * dx + dz * dz;
        let t = ((x - a.x) * dx + (z - a.z) * dz) / l2; t = t < 0 ? 0 : t > 1 ? 1 : t;
        const cx = a.x + dx * t, cz = a.z + dz * t; const ex = x - cx, ez = z - cz; const d2 = ex * ex + ez * ez;
        if (d2 < bd) { bd = d2; bs = a.s + t * ds; bk = k; bu = (dx * ez - dz * ex) / Math.sqrt(l2); }
      }
      const d = Math.sqrt(bd);
      const p = pathAt(bs);
      return { d, s: bs, u: bu, hw: p.hw };
    }
    const rb = 3 + rng() * 1.4; // largeur du rough
    const VOIDD = 9;

    // ----- pièges -----
    const blobs = [];
    const wantHaz = (L / 20) * (hazLv * 0.5) * (0.75 + diff * 0.12);
    const nHaz = hazLv === 0 ? 0 : Math.round(wantHaz + rng() * 0.8);
    for (let i = 0, tries = 0; i < nHaz && tries < 80; tries++) {
      const type = pickWeighted(rng, biome.hazards);
      const s = lerp(0.12, 0.9, rng()) * L; if (s < 9 || s > L - 10) continue;
      const hwS = pathAt(s).hw;
      const liquid = type === "water" || type === "lava";
      if (liquid && (!free(s, 9) )) continue;
      if (!liquid && !free(s, 3.5)) continue;
      let a, b, uc;
      if (liquid) {
        a = 3.5 + rng() * 4; const side = rng() < 0.5 ? -1 : 1;
        uc = side * hwS * (0.25 + rng() * 0.55); b = Math.min(hwS * (0.5 + rng() * 0.45), Math.abs(uc) + hwS - 3.8);
        if (b < 1.8) continue;
        taken.push(s);
      } else if (type === "ice" || type === "mud") { a = 4 + rng() * 6; b = hwS * (0.5 + rng() * 0.6); uc = (rng() - 0.5) * hwS * 0.8; taken.push(s - 3, s + 3);
      } else if (type === "bouncy") { a = 3 + rng() * 4; b = hwS * (0.4 + rng() * 0.5); uc = (rng() - 0.5) * hwS * 0.8; taken.push(s);
      } else { a = 2.5 + rng() * 4.5; b = 2 + rng() * hwS * 0.6; uc = (rng() - 0.5) * hwS * 1.4; }
      blobs.push({ type, s, uc, a, b, ph: rng() * 6.28, wob: 0.14 + rng() * 0.12, yl: 0 });
      i++;
    }
    // quelques points d'eau décoratifs dans le rough (même effet de jeu, ils piègent les balles perdues)
    blobs.forEach((bl) => { bl.yl = elev(bl.s) - 0.35; });
    function blobRho(bl, s, u) {
      const ds2 = (s - bl.s) / bl.a, du = (u - bl.uc) / bl.b; let r = Math.sqrt(ds2 * ds2 + du * du);
      const ang = Math.atan2(du, ds2); r /= 1 + bl.wob * Math.sin(ang * 3 + bl.ph) + bl.wob * 0.6 * Math.sin(ang * 5 + bl.ph * 2);
      return r;
    }
    const SURF_OF = { water: S.WATER, lava: S.LAVA, sand: S.SAND, ice: S.ICE, mud: S.MUD, bouncy: S.BOUNCY };

    // ----- grille -----
    let minx = 1e9, maxx = -1e9, minz = 1e9, maxz = -1e9; const maxHw = Math.max.apply(null, hwArr);
    path.forEach((p) => { minx = Math.min(minx, p.x); maxx = Math.max(maxx, p.x); minz = Math.min(minz, p.z); maxz = Math.max(maxz, p.z); });
    const M = Math.ceil(maxHw * 0.0 + rb + VOIDD + 8 + 6);
    const ox = Math.floor(minx - M - 4), oz = Math.floor(minz - M - 4);
    const nx = Math.ceil(maxx + M + 4) - ox, nz = Math.ceil(maxz + M + 4) - oz;
    const W = nx + 1;
    const heights = new Float32Array((nx + 1) * (nz + 1));
    const surf = new Uint8Array(nx * nz);
    const tee = pathAt(3), cupP = pathAt(L - 1);
    const cupZone = 7, teeZone = 4;
    for (let j = 0; j <= nz; j++) for (let i = 0; i <= nx; i++) {
      const x = ox + i, z = oz + j; const loc = locate(x, z);
      const band = loc.hw + rb; const dd = Math.max(0, loc.d - band);
      let hgt = elev(loc.s);
      const fade = smooth(loc.s / 8) * smooth((L - loc.s) / 8 + 0.3);
      hgt += hillsLv * 1.1 * noise(x * 0.09, z * 0.09) * fade * smooth(1.4 - loc.d / (loc.hw + 1)) + hillsLv * 0.55 * noise(x * 0.23 + 9, z * 0.23) * fade;
      // murs naturels de chaque côté
      hgt += dd < 6 ? 0.2 * dd * dd : 7.2 + (dd - 6) * 1.6;
      // plateforme du départ et du trou
      const dt = Math.hypot(x - tee.x, z - tee.z); if (dt < teeZone + 3) hgt = lerp(hgt, elev(tee.s), smooth(1 - (dt - teeZone) / 3));
      const dc = Math.hypot(x - cupP.x, z - cupP.z); if (dc < cupZone + 3) hgt = lerp(hgt, elev(cupP.s), smooth(1 - (dc - cupZone) / 3));
      // creux des pièges
      for (let q = 0; q < blobs.length; q++) {
        const bl = blobs[q]; if (Math.abs(loc.s - bl.s) > bl.a * 2.2) continue;
        const r = blobRho(bl, loc.s, loc.u);
        if (r < 1.5 && (bl.type === "water" || bl.type === "lava")) hgt = lerp(hgt, bl.yl, smooth((1.5 - r) / 0.7));
        else if (r < 1.3 && bl.type === "sand") hgt -= 0.32 * smooth((1.3 - r) / 1.3);
      }
      heights[j * W + i] = hgt;
    }
    for (let j = 0; j < nz; j++) for (let i = 0; i < nx; i++) {
      const x = ox + i + 0.5, z = oz + j + 0.5; const loc = locate(x, z);
      let sf = S.ROUGH;
      if (loc.d > loc.hw + rb + VOIDD) sf = S.VOID;
      else if (loc.d <= loc.hw) sf = S.FAIRWAY;
      if (Math.hypot(x - cupP.x, z - cupP.z) < 6.2) sf = S.GREEN;
      const dt = Math.hypot(x - tee.x, z - tee.z);
      if (dt < 3) sf = S.FAIRWAY;
      if (sf !== S.VOID) {
        const dc = Math.hypot(x - cupP.x, z - cupP.z);
        if (dt > 5 && dc > 3) {
          for (let q = 0; q < blobs.length; q++) { const bl = blobs[q]; if (Math.abs(loc.s - bl.s) > bl.a * 1.6) continue; if (blobRho(bl, loc.s, loc.u) < 1) { sf = SURF_OF[bl.type]; if (sf === S.WATER || sf === S.LAVA) break; } }
        }
      }
      surf[j * nx + i] = sf;
    }

    const hole = {
      version: 1, spec: Object.assign({}, spec), biome: biome.id, name: biome.names[Math.floor(rng() * biome.names.length)],
      gravity: biome.gravity, ox, oz, nx, nz, heights, surf, len: L,
      tee: { x: tee.x, z: tee.z, y: 0 }, cup: { x: cupP.x, z: cupP.z }, cupR: 0.52,
      path: path.map((p, k) => ({ x: +p.x.toFixed(2), z: +p.z.toFixed(2), s: p.s, w: +hwArr[k].toFixed(2) })),
      teeAngle: Math.atan2(path[6].x - path[0].x, path[6].z - path[0].z),
      obstacles: [], bumpers: [], bars: [], sliders: [], pads: [], tramps: [], portals: [], orbs: [], decor: [],
    };
    hole.tee.y = Physics.heightAt(hole, hole.tee.x, hole.tee.z);
    const surfHere = (x, z) => Physics.surfAt(hole, x, z);
    const here = (s, u) => { const p = pathAt(s); const nxv = Math.cos(p.h), nzv = -Math.sin(p.h); return { x: p.x + nxv * u * -1, z: p.z + nzv * u * -1, h: p.h }; };
    // (u positif = côté choisi par locate, cohérent avec la formule du signe)
    const place = (s, u) => { const p = pathAt(s); const px2 = Math.cos(p.h), pz2 = -Math.sin(p.h); return { x: p.x + px2 * u, z: p.z + pz2 * u, h: p.h }; };
    // locate renvoie un u calculé avec dx*ez - dz*ex, donc le sens est l'inverse de place(). On le vérifie une fois.
    const probe = place(L * 0.5, 2); const chk = locate(probe.x, probe.z); const uSign = chk.u * 2 > 0 ? 1 : -1;
    const placeU = (s, u) => place(s, u * uSign);
    const okSpot = (x, z, margin) => { const sf = surfHere(x, z); if (sf === S.WATER || sf === S.LAVA || sf === S.VOID) return false; if (margin) for (let a = 0; a < 6; a++) { const sf2 = surfHere(x + Math.cos(a) * margin, z + Math.sin(a) * margin); if (sf2 === S.WATER || sf2 === S.LAVA || sf2 === S.VOID) return false; } return true; };

    // ----- obstacles -----
    const nObs = Math.round((L / 10) * [0, 0.9, 1.7, 2.6][obsLv] * (0.8 + diff * 0.1));
    for (let i = 0, tries = 0; i < nObs && tries < nObs * 8; tries++) {
      const k = pickWeighted(rng, biome.obst); const def = OBST[k];
      const s = lerp(0.04, 0.97, rng()) * L; const pa = pathAt(s);
      if (s < 7 || s > L - 8) continue;
      let u;
      const onFair = rng() < 0.12 + diff * 0.045 && obsLv > 0;
      if (onFair) u = (rng() * 2 - 1) * pa.hw * 0.78; else u = (rng() < 0.5 ? -1 : 1) * (pa.hw * 0.7 + rng() * (rb + 5));
      const pos = placeU(s, u);
      if (!okSpot(pos.x, pos.z, 0)) continue;
      const sc = k === "rock" || k === "asteroid" ? 0.7 + rng() * 0.9 : 0.85 + rng() * 0.4;
      // pas de gros obstacle collé aux autres
      if (hole.obstacles.some((o) => Math.hypot(o.x - pos.x, o.z - pos.z) < (o.r + def.r * sc) + 0.7)) continue;
      if (Math.hypot(pos.x - tee.x, pos.z - tee.z) < 6 || Math.hypot(pos.x - cupP.x, pos.z - cupP.z) < 7) continue;
      hole.obstacles.push({ k, x: +pos.x.toFixed(2), z: +pos.z.toFixed(2), r: +(def.r * sc).toFixed(2), h: +(def.h * (k === "rock" ? 1 : sc)).toFixed(2), e: def.e, bouncy: !!def.bouncy, sc: +sc.toFixed(2), rot: +(rng() * 6.28).toFixed(2) });
      i++;
    }
    // décors sans collision (touffes, fleurs, cailloux)
    const nDec = Math.round(L * 0.9);
    for (let i = 0; i < nDec; i++) {
      const s = rng() * L; const pa = pathAt(s); const u = (rng() < 0.5 ? -1 : 1) * (pa.hw * 0.4 + rng() * (pa.hw * 0.9 + rb + 4)); const pos = placeU(s, u);
      if (!okSpot(pos.x, pos.z, 0)) continue; if (surfHere(pos.x, pos.z) === S.SAND) continue;
      hole.decor.push({ x: +pos.x.toFixed(2), z: +pos.z.toFixed(2), sc: +(0.6 + rng() * 0.8).toFixed(2), rot: +(rng() * 6.28).toFixed(2), v: Math.floor(rng() * 3) });
    }

    // ----- spéciaux -----
    specials.forEach((sp) => {
      const pa = pathAt(sp.s);
      if (sp.kind === "windmill") {
        const c = place(sp.s, 0); const dir = rng() < 0.5 ? 1 : -1;
        hole.bars.push({ x: +c.x.toFixed(2), z: +c.z.toFixed(2), len: Math.min(2 * (pa.hw - 1.6), 8), thick: 0.55, omega: dir * (1.0 + rng() * 0.7 + diff * 0.1), phase: rng() * 6.28, r: 0.75, k: "windmill" });
      } else if (sp.kind === "slider") {
        const c = place(sp.s, 0); const tx = Math.sin(pa.h), tz = Math.cos(pa.h); const nxv = Math.cos(pa.h), nzv = -Math.sin(pa.h);
        const len = Math.max(3, Math.min(5, pa.hw * 0.7));
        hole.sliders.push({ x: +c.x.toFixed(2), z: +c.z.toFixed(2), tx: nxv, tz: nzv, nx: nxv, nz: nzv, len, thick: 0.6, amp: Math.max(1.5, pa.hw - len / 2 - 0.6), period: 3.6 + rng() * 2.2, phase: rng() * 6.28 });
      } else if (sp.kind === "bumpers") {
        const cnt = 2 + Math.floor(rng() * 3);
        for (let q = 0; q < cnt; q++) { const u = (rng() * 2 - 1) * pa.hw * 0.7; const pos = placeU(sp.s + (rng() - 0.5) * 6, u); if (okSpot(pos.x, pos.z, 0)) hole.bumpers.push({ x: +pos.x.toFixed(2), z: +pos.z.toFixed(2), r: 0.85 }); }
      } else if (sp.kind === "boost") {
        const c = place(sp.s, (rng() - 0.5) * pa.hw * 0.7); hole.pads.push({ x: +c.x.toFixed(2), z: +c.z.toFixed(2), w: 3.0, l: 3.6, ang: +pa.h.toFixed(3), power: 24 });
      } else if (sp.kind === "tramp") {
        const c = place(sp.s, (rng() - 0.5) * pa.hw * 0.8); hole.tramps.push({ x: +c.x.toFixed(2), z: +c.z.toFixed(2), r: 1.7, vy: 11.5 });
      }
    });
    if (portalAt != null) {
      const a = pathAt(portalAt), b = pathAt(portalAt + 22);
      hole.portals.push({ a: { x: +a.x.toFixed(2), z: +a.z.toFixed(2), ang: a.h }, b: { x: +b.x.toFixed(2), z: +b.z.toFixed(2), ang: b.h }, r: 1.25 });
    }

    // ----- orbes -----
    const nOrbs = clamp(spec.orbs == null ? 3 : spec.orbs, 0, 8);
    for (let i = 0; i < nOrbs; i++) {
      for (let t = 0; t < 20; t++) {
        const s = lerp(0.14, 0.9, (i + 0.3 + rng() * 0.4) / nOrbs) * L; const pa = pathAt(s); const pos = placeU(s, (rng() * 2 - 1) * pa.hw * 0.5);
        if (!okSpot(pos.x, pos.z, 1.2)) continue;
        if (hole.obstacles.some((o) => Math.hypot(o.x - pos.x, o.z - pos.z) < o.r + 1.4)) continue;
        hole.orbs.push({ id: "o" + i, x: +pos.x.toFixed(2), z: +pos.z.toFixed(2) }); break;
      }
    }
    // pente de départ et vent
    hole.wind = spec.wind || [0, 0];
    // difficulté estimée et par
    const hazPenalty = blobs.filter((b) => b.type === "water" || b.type === "lava").length >= 3 ? 1 : 0;
    hole.par = clamp(Math.round(L / 36) + 1 + (diff >= 5 ? hazPenalty : 0), 2, 6);
    return hole;
  }

  // ---------- carte des distances pour les bots ----------
  function flowField(hole) {
    if (hole._flow) return hole._flow;
    const nx = hole.nx, nz = hole.nz; const dist = new Float64Array(nx * nz).fill(1e9);
    const cost = (sf) => (sf === S.WATER || sf === S.LAVA ? 40 : sf === S.VOID ? 1e6 : sf === S.SAND ? 2.2 : sf === S.MUD ? 3 : sf === S.ROUGH ? 1.5 : sf === S.ICE ? 0.9 : 1);
    const ci = Math.floor(hole.cup.x - hole.ox), cj = Math.floor(hole.cup.z - hole.oz);
    // file de priorité simple par seaux
    const heap = []; const push = (d, k) => { heap.push([d, k]); let i = heap.length - 1; while (i > 0) { const p = (i - 1) >> 1; if (heap[p][0] <= heap[i][0]) break; [heap[p], heap[i]] = [heap[i], heap[p]]; i = p; } };
    const pop = () => { const top = heap[0]; const last = heap.pop(); if (heap.length) { heap[0] = last; let i = 0; for (;;) { let l = 2 * i + 1, r = l + 1, m = i; if (l < heap.length && heap[l][0] < heap[m][0]) m = l; if (r < heap.length && heap[r][0] < heap[m][0]) m = r; if (m === i) break; [heap[m], heap[i]] = [heap[i], heap[m]]; i = m; } } return top; };
    dist[cj * nx + ci] = 0; push(0, cj * nx + ci);
    const D8 = [[1, 0, 1], [-1, 0, 1], [0, 1, 1], [0, -1, 1], [1, 1, 1.414], [1, -1, 1.414], [-1, 1, 1.414], [-1, -1, 1.414]];
    while (heap.length) {
      const [d, k] = pop(); if (d > dist[k]) continue; const i = k % nx, j = (k / nx) | 0;
      for (const [di, dj, w] of D8) { const a = i + di, b = j + dj; if (a < 0 || b < 0 || a >= nx || b >= nz) continue; const k2 = b * nx + a; const nd = d + w * cost(hole.surf[k2]); if (nd < dist[k2]) { dist[k2] = nd; push(nd, k2); } }
    }
    hole._flow = dist; return dist;
  }
  function flowAt(hole, x, z) {
    const f = flowField(hole); const i = Math.floor(x - hole.ox), j = Math.floor(z - hole.oz);
    if (i < 0 || j < 0 || i >= hole.nx || j >= hole.nz) return 1e5; return f[j * hole.nx + i];
  }

  // ---------- transport ----------
  const b64 = typeof Buffer !== "undefined" ? { enc: (u8) => Buffer.from(u8.buffer, u8.byteOffset, u8.byteLength).toString("base64"), dec: (s) => new Uint8Array(Buffer.from(s, "base64")) }
    : { enc: (u8) => { let s = ""; for (let i = 0; i < u8.length; i += 0x8000) s += String.fromCharCode.apply(null, u8.subarray(i, i + 0x8000)); return btoa(s); }, dec: (s) => { const b = atob(s); const u = new Uint8Array(b.length); for (let i = 0; i < b.length; i++) u[i] = b.charCodeAt(i); return u; } };
  function encodeHole(h) {
    const hi = new Int16Array(h.heights.length); for (let i = 0; i < hi.length; i++) hi[i] = Math.round(h.heights[i] * 100);
    const o = Object.assign({}, h); delete o._w; delete o._flow; o.heights = b64.enc(new Uint8Array(hi.buffer)); o.surf = b64.enc(h.surf); return o;
  }
  function decodeHole(o) {
    const h = Object.assign({}, o);
    const u8 = b64.dec(o.heights); const hi = new Int16Array(u8.buffer, u8.byteOffset, u8.byteLength / 2); h.heights = new Float32Array(hi.length); for (let i = 0; i < hi.length; i++) h.heights[i] = hi[i] / 100;
    h.surf = b64.dec(o.surf); return h;
  }

  return { BIOMES, BIOME_IDS, OBST, mulberry32, hashSeed, generateHole, flowAt, flowField, encodeHole, decodeHole };
});

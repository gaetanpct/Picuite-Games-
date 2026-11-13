// ============================================================
// ORAPA MINE — Moteur de lumière (partagé serveur et client)
// Grille, pierres, rayons colorés, réflexions, filtres, prismes, séparateurs.
// Les couleurs sont des masques de trois primaires, rouge 1, bleu 2, jaune 4.
// ============================================================
(function (root, factory) {
  if (typeof module !== "undefined" && module.exports) module.exports = factory();
  else root.OMEngine = factory();
})(typeof window !== "undefined" ? window : globalThis, function () {
  const COLOR_NAMES = { 1: "rouge", 2: "bleu", 4: "jaune", 3: "violet", 5: "orange", 6: "vert", 7: "blanc" };
  const COLOR_HEX = { 1: "#ff3b4e", 2: "#3b7bff", 4: "#ffd23f", 3: "#b04dff", 5: "#ff8a1f", 6: "#2fd66b", 7: "#ffffff" };
  // mode fidèle à l'original, la sonde est transparente et prend les couleurs des pierres touchées
  // rouge 1, bleu 2, jaune 4, blanc 8. Chaque couleur ne compte qu'une fois.
  const FAITHFUL_HEX = { 0: "#d6ecff", 1: "#ff3b4e", 2: "#3b7bff", 4: "#ffd23f", 3: "#b04dff", 5: "#ff8a1f", 6: "#2fd66b", 7: "#8d5a3b", 8: "#ffffff", 9: "#ff9db0", 10: "#9cc3ff", 12: "#fff0a0", 11: "#d9b6ff", 13: "#ffc58a", 14: "#a6f0c0", 15: "#9aa3b5" };
  const FAITHFUL_NAMES = { 0: "transparent", 1: "rouge", 2: "bleu", 4: "jaune", 3: "violet", 5: "orange", 6: "vert", 7: "brun", 8: "blanc", 9: "rose", 10: "bleu clair", 12: "jaune clair", 11: "violet clair", 13: "orange clair", 14: "vert clair", 15: "gris" };
  const hexOf = (m, f) => (f ? FAITHFUL_HEX[m] : COLOR_HEX[m]) || "#ffffff";
  const nameOf = (m, f) => (f ? FAITHFUL_NAMES[m] : COLOR_NAMES[m]) || "inconnu";
  const KINDS = {
    gem: { label: "Pierre", desc: "Renvoie le rayon en diagonale et lui donne sa couleur. Une couleur n'est comptée qu'une fois, même touchée deux fois." },
    filter: { label: "Filtre", desc: "Laisse passer sa couleur et arrête le reste." },
    mirror: { label: "Miroir", desc: "Renvoie le rayon en diagonale." },
    obsidian: { label: "Obsidienne", desc: "Avale tous les rayons." },
    prism: { label: "Prisme", desc: "Sépare la lumière, le rouge tourne à gauche, le bleu à droite, le jaune continue." },
    splitter: { label: "Séparateur", desc: "Laisse passer le rayon et en renvoie une copie en diagonale." },
    tint: { label: "Opale", desc: "Ajoute sa couleur au rayon qui la traverse." },
  };
  const SHAPES = {
    mono: [[0, 0]], domino: [[0, 0], [1, 0]], ligne3: [[0, 0], [1, 0], [2, 0]], coude: [[0, 0], [1, 0], [0, 1]],
    carre: [[0, 0], [1, 0], [0, 1], [1, 1]], te: [[0, 0], [1, 0], [2, 0], [1, 1]],
  };
  const SIDES = ["N", "E", "S", "W"];
  const norm = (cells) => { let mx = 1e9, my = 1e9; cells.forEach((c) => { mx = Math.min(mx, c[0]); my = Math.min(my, c[1]); }); return cells.map((c) => [c[0] - mx, c[1] - my]).sort((a, b) => a[1] - b[1] || a[0] - b[0]); };
  const rot = (cells, n) => { let c = cells; for (let i = 0; i < ((n % 4) + 4) % 4; i++) c = norm(c.map(([x, y]) => [-y, x])); return norm(c); };
  const slotsOf = (W, H) => { const a = []; for (let i = 0; i < W; i++) { a.push({ s: "N", i }); a.push({ s: "S", i }); } for (let j = 0; j < H; j++) { a.push({ s: "W", i: j }); a.push({ s: "E", i: j }); } return a; };
  const slotKey = (s) => s.s + s.i;
  const parseSlot = (k) => ({ s: k[0], i: +k.slice(1) });
  function buildGrid(W, H, gems) {
    const g = new Int16Array(W * H).fill(-1);
    gems.forEach((gm, gi) => { if (!gm.placed && gm.placed !== undefined) return; gm.cells.forEach(([dx, dy]) => { const x = gm.x + dx, y = gm.y + dy; if (x >= 0 && y >= 0 && x < W && y < H) g[y * W + x] = gi; }); });
    return g;
  }
  // valide le placement, retourne vrai si toutes les pierres sont dedans sans se chevaucher
  function valid(W, H, gems, gap) {
    const g = new Int16Array(W * H).fill(-1);
    for (let gi = 0; gi < gems.length; gi++) {
      const gm = gems[gi]; if (gm.x === undefined || gm.x === null) return false;
      for (const [dx, dy] of gm.cells) { const x = gm.x + dx, y = gm.y + dy; if (x < 0 || y < 0 || x >= W || y >= H || g[y * W + x] !== -1) return false; g[y * W + x] = gi; }
    }
    if (gap) {
      for (let gi = 0; gi < gems.length; gi++) for (const [dx, dy] of gems[gi].cells) { const x = gems[gi].x + dx, y = gems[gi].y + dy;
        for (const [ax, ay] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) { const nx = x + ax, ny = y + ay; if (nx < 0 || ny < 0 || nx >= W || ny >= H) continue; const o = g[ny * W + nx]; if (o !== -1 && o !== gi) return false; } }
    }
    return true;
  }
  // tire un rayon. Retourne { exits, absorbed, rays } où rays contient les segments si wantPath
  function trace(W, H, grid, gems, slot, mask, wantPath) {
    let x, y, dx, dy;
    if (slot.s === "N") { x = slot.i; y = -1; dx = 0; dy = 1; } else if (slot.s === "S") { x = slot.i; y = H; dx = 0; dy = -1; }
    else if (slot.s === "W") { x = -1; y = slot.i; dx = 1; dy = 0; } else { x = W; y = slot.i; dx = -1; dy = 0; }
    const stack = [{ x, y, dx, dy, m: mask, pts: wantPath ? [[x, y]] : null, hit: false }];
    const exits = []; let absorbed = false; const rays = []; const seen = new Set(); let guard = 0;
    while (stack.length && guard++ < 80) {
      const r = stack.pop(); let steps = 0;
      for (;;) {
        if (steps++ > W * H * 4) { absorbed = true; break; }
        r.x += r.dx; r.y += r.dy;
        if (r.x < 0 || r.y < 0 || r.x >= W || r.y >= H) {
          const s = r.dx === 1 ? "E" : r.dx === -1 ? "W" : r.dy === 1 ? "S" : "N"; const i = r.dx !== 0 ? r.y : r.x;
          exits.push({ s, i, m: r.m }); if (wantPath) { r.pts.push([r.x, r.y]); rays.push({ pts: r.pts, m: r.m, end: "exit" }); } break;
        }
        const key = r.x + "," + r.y + "," + r.dx + "," + r.dy + "," + r.m; if (seen.has(key)) { absorbed = true; if (wantPath) { rays.push({ pts: r.pts, m: r.m, end: "loop" }); } break; } seen.add(key);
        if (wantPath) r.pts.push([r.x, r.y]);
        const gi = grid[r.y * W + r.x]; if (gi < 0) continue;
        const gm = gems[gi]; r.hit = true;
        if (gm.k === "obsidian") { absorbed = true; if (wantPath) rays.push({ pts: r.pts, m: r.m, end: "absorb" }); break; }
        if (gm.k === "filter") { r.m &= gm.m; if (!r.m) { absorbed = true; if (wantPath) rays.push({ pts: r.pts, m: 0, end: "absorb" }); break; } continue; }
        if (gm.k === "gem") { const ndx = gm.d ? r.dy : -r.dy, ndy = gm.d ? r.dx : -r.dx; r.dx = ndx; r.dy = ndy; r.m |= gm.m; continue; }
        if (gm.k === "tint") { if (r.m) r.m |= gm.m; continue; }
        if (gm.k === "mirror") { const ndx = gm.d ? r.dy : -r.dy, ndy = gm.d ? r.dx : -r.dx; r.dx = ndx; r.dy = ndy; if (wantPath) { /* le coude est déjà le point courant */ } continue; }
        if (gm.k === "splitter") {
          const ndx = gm.d ? r.dy : -r.dy, ndy = gm.d ? r.dx : -r.dx;
          stack.push({ x: r.x, y: r.y, dx: ndx, dy: ndy, m: r.m, pts: wantPath ? [[r.x, r.y]] : null, hit: true }); continue;
        }
        if (gm.k === "prism") {
          const left = [r.dy, -r.dx], right = [-r.dy, r.dx];
          [[1, left], [2, right], [4, [r.dx, r.dy]]].forEach(([bit, d]) => { if (r.m & bit) stack.push({ x: r.x, y: r.y, dx: d[0], dy: d[1], m: bit, pts: wantPath ? [[r.x, r.y]] : null, hit: true }); });
          if (wantPath) rays.push({ pts: r.pts, m: r.m, end: "split" }); break;
        }
      }
    }
    exits.sort((a, b) => (a.s < b.s ? -1 : a.s > b.s ? 1 : a.i - b.i || a.m - b.m));
    return { exits, absorbed, rays };
  }
  // signature textuelle d'un tir, pour comparer deux mines
  function shotSig(res) { return res.exits.map((e) => e.s + e.i + ":" + e.m).join(",") + (res.absorbed ? "|a" : ""); }
  function traceSig(W, H, grid, gems, slot, mask) { return shotSig(trace(W, H, grid, gems, slot, mask, false)); }
  // chaîne décrivant l'effet de chaque case, deux mines identiques ont la même
  function effectString(W, H, gems) {
    const g = buildGrid(W, H, gems); const out = [];
    for (let i = 0; i < W * H; i++) { const gi = g[i]; if (gi < 0) { out.push("."); continue; } const gm = gems[gi]; out.push(gm.k[0] + (gm.k === "filter" || gm.k === "tint" ? gm.m : gm.k === "mirror" || gm.k === "splitter" ? gm.d : gm.k === "gem" ? gm.m + "/" + gm.d : "")); }
    return out.join("");
  }
  function cloneGem(g) { return { k: g.k, m: g.m, d: g.d, shape: g.shape, rot: g.rot || 0, cells: g.cells.map((c) => c.slice()), x: g.x, y: g.y }; }
  return { COLOR_NAMES, COLOR_HEX, hexOf, nameOf, FAITHFUL_HEX, KINDS, SHAPES, SIDES, norm, rot, slotsOf, slotKey, parseSlot, buildGrid, valid, trace, shotSig, traceSig, effectString, cloneGem };
});

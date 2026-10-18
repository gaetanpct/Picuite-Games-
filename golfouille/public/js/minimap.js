// ============================================================
// GOLFOUILLE — Petite carte du trou (aperçu du salon et carte en jeu)
// Le départ est en bas, le trou en haut, et la gauche de la carte est la gauche de l'écran 3D.
// ============================================================
(function () {
  const Course = GolfCourse, S = GolfPhysics.S;
  const cache = new WeakMap();
  function base(hole) {
    if (cache.has(hole)) return cache.get(hole);
    const nx = hole.nx, nz = hole.nz; const C = Course.BIOMES[hole.biome].col;
    const hex = (h) => [parseInt(h.slice(1, 3), 16), parseInt(h.slice(3, 5), 16), parseInt(h.slice(5, 7), 16)];
    const pal = [C.fairway, C.green, C.rough, C.sand, C.water, C.ice, C.mud, C.lava, C.bouncy].map(hex);
    const cv = document.createElement("canvas"); cv.width = nx; cv.height = nz; const g = cv.getContext("2d"); const im = g.createImageData(nx, nz);
    const W = nx + 1;
    for (let j = 0; j < nz; j++) for (let i = 0; i < nx; i++) {
      const s = hole.surf[j * nx + i]; const o = ((nz - 1 - j) * nx + (nx - 1 - i)) * 4;
      if (s === S.VOID) { im.data[o + 3] = 0; continue; }
      const h = (hole.heights[j * W + i] + hole.heights[j * W + i + 1] + hole.heights[(j + 1) * W + i] + hole.heights[(j + 1) * W + i + 1]) / 4;
      const shade = 1 + Math.max(-0.2, Math.min(0.2, (h - 2) * 0.03));
      const c = pal[s] || pal[2];
      im.data[o] = Math.min(255, c[0] * shade); im.data[o + 1] = Math.min(255, c[1] * shade); im.data[o + 2] = Math.min(255, c[2] * shade); im.data[o + 3] = 255;
    }
    g.putImageData(im, 0, 0);
    // on recadre sur la zone utile pour que la carte ne soit pas pleine de vide
    let minI = nx, maxI = 0, minJ = nz, maxJ = 0;
    for (let j = 0; j < nz; j++) for (let i = 0; i < nx; i++) if (hole.surf[j * nx + i] !== S.VOID) { if (i < minI) minI = i; if (i > maxI) maxI = i; if (j < minJ) minJ = j; if (j > maxJ) maxJ = j; }
    if (maxI < minI) { minI = 0; maxI = nx - 1; minJ = 0; maxJ = nz - 1; }
    const b = { cv, minI: Math.max(0, minI - 1), maxI: Math.min(nx - 1, maxI + 1), minJ: Math.max(0, minJ - 1), maxJ: Math.min(nz - 1, maxJ + 1) };
    cache.set(hole, b); return b;
  }
  // calcule la fonction monde vers pixels pour un canvas donné
  function mapper(hole, w, h, pad) {
    const b = base(hole); pad = pad || 4;
    const cw = b.maxI - b.minI + 1, ch = b.maxJ - b.minJ + 1;
    const sc = Math.min((w - pad * 2) / cw, (h - pad * 2) / ch);
    const ox = (w - cw * sc) / 2, oy = (h - ch * sc) / 2;
    // monde x vers colonne : (nx - 1 - i) avec i = x - hole.ox
    const toPx = (x, z) => {
      const i = x - hole.ox, j = z - hole.oz; const col = hole.nx - i, row = hole.nz - j; // en cases, bord haut gauche à 0
      return [ox + (col - (hole.nx - 1 - b.maxI)) * sc, oy + (row - (hole.nz - 1 - b.maxJ)) * sc];
    };
    return { b, sc, ox, oy, cw, ch, toPx };
  }
  function draw(canvas, hole, extra) {
    const g = canvas.getContext("2d"); const w = canvas.width, h = canvas.height; g.clearRect(0, 0, w, h);
    const m = mapper(hole, w, h, extra && extra.pad);
    g.imageSmoothingEnabled = false;
    g.drawImage(m.b.cv, hole.nx - 1 - m.b.maxI, hole.nz - 1 - m.b.maxJ, m.cw, m.ch, m.ox, m.oy, m.cw * m.sc, m.ch * m.sc);
    // ligne du chemin
    if (extra && extra.path) {
      g.strokeStyle = "rgba(255,255,255,0.35)"; g.lineWidth = 1; g.setLineDash([3, 4]); g.beginPath();
      hole.path.forEach((p, k) => { const q = m.toPx(p.x, p.z); if (k) g.lineTo(q[0], q[1]); else g.moveTo(q[0], q[1]); }); g.stroke(); g.setLineDash([]);
    }
    const tee = m.toPx(hole.tee.x, hole.tee.z); g.fillStyle = "#ffffff"; g.strokeStyle = "#0b3a2a"; g.lineWidth = 2; g.beginPath(); g.arc(tee[0], tee[1], Math.max(3, m.sc * 0.9), 0, 6.3); g.fill(); g.stroke();
    const cup = m.toPx(hole.cup.x, hole.cup.z); g.fillStyle = "#111"; g.beginPath(); g.arc(cup[0], cup[1], Math.max(3, m.sc * 0.8), 0, 6.3); g.fill();
    g.strokeStyle = "#fff"; g.lineWidth = 2; g.beginPath(); g.moveTo(cup[0], cup[1]); g.lineTo(cup[0], cup[1] - 11); g.stroke(); g.fillStyle = "#ff3a5a"; g.beginPath(); g.moveTo(cup[0], cup[1] - 11); g.lineTo(cup[0] + 8, cup[1] - 8); g.lineTo(cup[0], cup[1] - 5); g.fill();
    if (extra && extra.orbs) extra.orbs.forEach((o) => { if (o.taken) return; const q = m.toPx(o.x, o.z); g.fillStyle = "#ffe45a"; g.strokeStyle = "#7a5a00"; g.lineWidth = 1.5; g.beginPath(); g.arc(q[0], q[1], 3.5, 0, 6.3); g.fill(); g.stroke(); });
    if (extra && extra.specials) {
      const dot = (x, z, c) => { const q = m.toPx(x, z); g.fillStyle = c; g.beginPath(); g.arc(q[0], q[1], 2.5, 0, 6.3); g.fill(); };
      hole.bars.forEach((b) => dot(b.x, b.z, "#ffcc33")); hole.sliders.forEach((b) => dot(b.cx != null ? b.cx : b.x, b.cz != null ? b.cz : b.z, "#7a5cff"));
      hole.bumpers.forEach((b) => dot(b.x, b.z, "#3a6aee")); hole.tramps.forEach((b) => dot(b.x, b.z, "#b04aff")); hole.portals.forEach((p) => { dot(p.a.x, p.a.z, "#2ad0ff"); dot(p.b.x, p.b.z, "#ff9a2a"); });
    }
    if (extra && extra.players) extra.players.forEach((p) => {
      if (p.hidden) return; const q = m.toPx(p.x, p.z); g.fillStyle = p.hex; g.strokeStyle = p.you ? "#ffffff" : "#0b3a2a"; g.lineWidth = p.you ? 3 : 2; g.beginPath(); g.arc(q[0], q[1], p.you ? 5.5 : 4.5, 0, 6.3); g.fill(); g.stroke();
    });
    if (extra && extra.aim) { const q = m.toPx(extra.aim.x, extra.aim.z); const d = [-Math.sin(extra.aim.yaw), -Math.cos(extra.aim.yaw)]; g.strokeStyle = "#ffd84a"; g.lineWidth = 2; g.beginPath(); g.moveTo(q[0], q[1]); g.lineTo(q[0] + d[0] * 22, q[1] + d[1] * 22); g.stroke(); }
    return m;
  }
  window.GolfMini = { draw, mapper, base };
})();

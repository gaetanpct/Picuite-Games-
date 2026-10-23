// ============================================================
// BUS BAZAR — Scène de conduite en pseudo 3D (tracée en code)
// La route est reconstruite à l'identique du serveur à partir de la graine.
// ============================================================
const BBScene = (function () {
  const D = BBData, Rd = BBRoad, Dr = BBDraw;
  const cache = { key: "", seg: null };
  function segOf(d) { const key = d.seed + "|" + d.index + "|" + d.kind + "|" + d.biome; if (cache.key !== key) { cache.key = key; cache.seg = Rd.makeSegment({ seed: d.seed, index: d.index, kind: d.kind, biome: d.biome, difficulty: d.difficulty, biomes: d.biomes }); } return cache.seg; }
  const hex = (h) => { h = h.replace("#", ""); return [parseInt(h.slice(0, 2), 16), parseInt(h.slice(2, 4), 16), parseInt(h.slice(4, 6), 16)]; };
  const mix = (a, b, k) => "rgb(" + Math.round(a[0] + (b[0] - a[0]) * k) + "," + Math.round(a[1] + (b[1] - a[1]) * k) + "," + Math.round(a[2] + (b[2] - a[2]) * k) + ")";
  const hsh = (n) => { n = Math.imul(n ^ (n >>> 15), 2246822507); n = Math.imul(n ^ (n >>> 13), 3266489909); return ((n ^ (n >>> 16)) >>> 0) / 4294967296; };
  const ROAD_HALF = 5, CAM_H = 2.6, DZ = 8, N = 80, VK = 0.5, HK = 0.55;

  // ---------- sprites ----------
  function sprite(ctx, kind, x, y, k, o, t) {
    ctx.save(); ctx.translate(x, y); ctx.scale(k, k);
    switch (kind) {
      case "cone": Dr.poly(ctx, [[-14, 0], [14, 0], [6, -42], [-6, -42]], "#ff7a1a", 3); Dr.line(ctx, -10, -14, 10, -14, 5, "#fff"); Dr.line(ctx, -7, -28, 7, -28, 5, "#fff"); break;
      case "animal": {
        const nm = o.name || "vache"; const sheep = nm === "mouton", goose = nm === "oie", lama = nm === "lama", goat = nm === "chèvre";
        if (goose) { Dr.ell(ctx, 0, -22, 22, 16, "#fff", 3); Dr.ell(ctx, 22, -44, 8, 8, "#fff", 3); Dr.line(ctx, 18, -36, 14, -24, 5, "#fff"); Dr.poly(ctx, [[28, -44], [38, -41], [28, -38]], "#ff9a2e", 2); Dr.line(ctx, -6, -8, -6, 0, 3); Dr.line(ctx, 8, -8, 8, 0, 3); break; }
        Dr.rrect(ctx, -34, -48, 68, 36, 14, sheep ? "#f4f0e6" : lama ? "#d8b890" : goat ? "#d7d2c4" : "#fff", 3.5);
        if (!sheep && !lama && !goat) { Dr.ell(ctx, -10, -36, 8, 6, "#2b1b17", 0); Dr.ell(ctx, 14, -28, 7, 8, "#2b1b17", 0); }
        Dr.rrect(ctx, 26, lama ? -78 : -58, 22, lama ? 40 : 24, 8, sheep ? "#3a3a3a" : "#fff", 3.5); Dr.ell(ctx, 40, lama ? -70 : -50, 2.5, 2.5, "#2b1b17", 0);
        [[-24], [-8], [10], [26]].forEach((l) => Dr.line(ctx, l[0], -14, l[0], 0, 5)); break;
      }
      case "pieton": Dr.ell(ctx, 0, -66, 12, 13, "#e8b088", 3); Dr.rrect(ctx, -12, -54, 24, 36, 8, "#3aa653", 3); Dr.line(ctx, -6, -18, -8, 0, 5); Dr.line(ctx, 6, -18, 10, 0, 5);
        Dr.ell(ctx, 18, -54, 36, 6, "#e8c27a", 3, -0.4); Dr.line(ctx, 8, -40, 22, -50, 4); break;
      case "rock": Dr.poly(ctx, [[-44, 0], [-34, -30], [-10, -48], [16, -42], [40, -20], [46, 0]], "#8b8f97", 4); Dr.line(ctx, -10, -40, -4, -20, 2.5, "#666"); break;
      case "oil": Dr.ell(ctx, 0, -4, 70, 12, "#1a1a1f", 0); Dr.ell(ctx, -16, -6, 20, 4, "rgba(120,200,255,0.5)", 0); break;
      case "pothole": Dr.ell(ctx, 0, -4, 40, 9, "#2a2520", 3); break;
      case "slowcar": Dr.rrect(ctx, -44, -46, 88, 40, 10, "#6fa8dc", 3.5); Dr.rrect(ctx, -30, -64, 60, 24, 8, "#bfe8ff", 3); Dr.ell(ctx, -28, -4, 12, 12, "#222", 3); Dr.ell(ctx, 28, -4, 12, 12, "#222", 3); Dr.rrect(ctx, -40, -34, 12, 8, 2, "#d6453d", 2); Dr.rrect(ctx, 28, -34, 12, 8, 2, "#d6453d", 2); break;
      case "barrier": Dr.rrect(ctx, -56, -44, 112, 22, 4, "#fff", 3.5); for (let i = -3; i < 3; i++) Dr.poly(ctx, [[i * 18, -44], [i * 18 + 12, -44], [i * 18 + 4, -22], [i * 18 - 8, -22]], "#e8453c", 0); Dr.line(ctx, -40, -22, -40, 0, 5); Dr.line(ctx, 40, -22, 40, 0, 5); break;
    }
    ctx.restore();
  }
  function decor(ctx, biome, kind, x, y, k, side) {
    ctx.save(); ctx.translate(x, y); ctx.scale(k * side, k);
    const b = biome;
    if (kind === 0) { Dr.rrect(ctx, -6, -50, 12, 50, 3, "#7a4b2a", 3); if (b === "montagne" || b === "etroit") Dr.poly(ctx, [[-30, -40], [30, -40], [0, -130]], "#2f6b3a", 3.5); else { Dr.ell(ctx, 0, -76, 34, 34, b === "nuit" ? "#1f5a34" : "#3fae4e", 3.5); Dr.ell(ctx, -8, -86, 10, 8, "rgba(255,255,255,0.25)", 0); } }
    else if (kind === 1) { if (b === "ville" || b === "industrie") { const h = 90 + (x % 7) * 10; Dr.rrect(ctx, -38, -h, 76, h, 3, b === "ville" ? "#d7c3a1" : "#8a8f98", 3.5); for (let r = 0; r < 4; r++) for (let c = 0; c < 3; c++) Dr.rrect(ctx, -28 + c * 22, -h + 12 + r * 22, 14, 14, 2, "#ffe9a0", 1.5); } else if (b === "cote") { Dr.line(ctx, 0, 0, 6, -90, 7, "#8a5a2b"); for (let i = 0; i < 5; i++) Dr.ell(ctx, 6 + Math.cos(i * 1.26) * 28, -92 + Math.sin(i * 1.26) * 12, 26, 7, "#3fae4e", 2.5, i * 1.26); } else if (b === "chantier") { Dr.poly(ctx, [[-14, 0], [14, 0], [6, -42], [-6, -42]], "#ff7a1a", 3); } else { Dr.rrect(ctx, -34, -44, 68, 44, 3, "#c9a77a", 3.5); Dr.poly(ctx, [[-42, -44], [42, -44], [0, -86]], "#a8442f", 3.5); } }
    else { Dr.poly(ctx, [[-44, 0], [-30, -28], [-6, -40], [24, -30], [44, 0]], "#8b8f97", 3.5); }
    ctx.restore();
  }

  // ---------- rendu ----------
  function render(ctx, W, H, v, t, disp, fx) {
    const seg = segOf(v.seg); const B = D.BIOMES.filter((q) => q.id === v.seg.biome)[0] || D.BIOMES[0];
    const s0 = disp.s, xb = disp.x; const horizon = H * 0.4; const f = W * 0.85;
    const sky0 = hex(B.sky[0]), sky1 = hex(B.sky[1]), g1 = hex(B.ground), g2 = hex(B.ground2), road = hex(B.road);
    const night = B.id === "nuit"; const visM = Math.max(110, B.vis * (v.fog ? 0.45 : 1));
    const fogC = night ? hex("#0a1022") : hex(B.sky[1]);
    // ciel
    const gr = ctx.createLinearGradient(0, 0, 0, horizon + 10); gr.addColorStop(0, B.sky[0]); gr.addColorStop(1, B.sky[1]); ctx.fillStyle = gr; ctx.fillRect(0, 0, W, horizon + 10);
    if (night) { for (let i = 0; i < 40; i++) { ctx.fillStyle = "rgba(255,255,255," + (0.4 + hsh(i) * 0.6) + ")"; ctx.fillRect(hsh(i * 3) * W, hsh(i * 7) * horizon * 0.8, 2, 2); } Dr.ell(ctx, W * 0.8, horizon * 0.3, 22, 22, "#f6f1c8", 0); } else if (B.id !== "pluie") { Dr.ell(ctx, W * 0.82, horizon * 0.32, 26, 26, "#fff3a8", 0); }
    // collines lointaines (décalées par la courbure)
    const bend = Rd.curveAt(seg, s0 + 60) * 6000; const hillCol = night ? "#0d1830" : mix(g1, fogC, 0.55);
    ctx.fillStyle = hillCol; ctx.beginPath(); ctx.moveTo(0, horizon + 2);
    for (let x = 0; x <= W; x += 24) { const hh = (Math.sin((x + bend + s0 * 0.2) / 140) * 0.5 + Math.sin((x + bend * 1.3) / 61) * 0.3 + 0.8) * (B.id === "montagne" ? 70 : 28); ctx.lineTo(x, horizon + 2 - hh); }
    ctx.lineTo(W, horizon + 2); ctx.closePath(); ctx.fill();
    // nuages
    if (!night) { for (let i = 0; i < 4; i++) { const cx = ((hsh(i + 9) * W * 1.4 + (t || 0) * 5 - bend * 0.4) % (W * 1.3)) - W * 0.15; Dr.ell(ctx, cx, horizon * (0.2 + hsh(i) * 0.4), 52, 16, "rgba(255,255,255,0.8)", 0); Dr.ell(ctx, cx + 24, horizon * (0.2 + hsh(i) * 0.4) - 8, 34, 14, "rgba(255,255,255,0.8)", 0); } }
    ctx.fillStyle = mix(g1, fogC, 0.1); ctx.fillRect(0, horizon, W, H - horizon);
    // géométrie des bandes
    const Xs = new Array(N + 2), Ys = new Array(N + 2), Zs = new Array(N + 2), Ss = new Array(N + 2);
    let X = 0, dX = 0, Y = 0; const frac = s0 % DZ; Xs[0] = 0; Ys[0] = 0; Zs[0] = 1.5; Ss[0] = s0;
    for (let i = 1; i <= N + 1; i++) { const z = (i - 1) * DZ + (DZ - frac); const s = s0 + z; dX += Rd.curveAt(seg, s) * DZ * VK; X += dX * DZ; Y += Rd.hillAt(seg, s) * DZ * HK; Xs[i] = X; Ys[i] = Y; Zs[i] = Math.max(1.5, z); Ss[i] = s; }
    const camX = xb * ROAD_HALF; const scr = (i, wx) => { const z = Zs[i]; const k = f / z; return [W / 2 + (Xs[i] + wx - camX) * k, horizon + (CAM_H - Ys[i]) * k, k]; };
    let maxY = H + 10;
    for (let i = N; i >= 1; i--) {
      const a = scr(i, 0), b = scr(i - 1, 0); const k1 = a[2], k0 = b[2]; const y1 = a[1], y0 = b[1]; if (y0 < y1 - 1) continue; // face cachée
      const alt = Math.floor(Ss[i] / DZ) % 2 === 0; const fog = Math.min(1, Math.pow(Zs[i] / visM, 1.6));
      const gcol = mix(alt ? g1 : g2, fogC, fog), rcol = mix(alt ? road : [road[0] * 0.93, road[1] * 0.93, road[2] * 0.93], fogC, fog);
      ctx.fillStyle = gcol; ctx.fillRect(0, y1, W, Math.max(1, y0 - y1 + 1));
      const xl1 = a[0] - ROAD_HALF * k1, xr1 = a[0] + ROAD_HALF * k1, xl0 = b[0] - ROAD_HALF * k0, xr0 = b[0] + ROAD_HALF * k0;
      const rum = ROAD_HALF * 0.14;
      ctx.fillStyle = mix(alt ? [255, 255, 255] : [220, 60, 50], fogC, fog); ctx.beginPath(); ctx.moveTo(xl1 - rum * k1, y1); ctx.lineTo(xl1, y1); ctx.lineTo(xl0, y0); ctx.lineTo(xl0 - rum * k0, y0); ctx.fill(); ctx.beginPath(); ctx.moveTo(xr1 + rum * k1, y1); ctx.lineTo(xr1, y1); ctx.lineTo(xr0, y0); ctx.lineTo(xr0 + rum * k0, y0); ctx.fill();
      ctx.fillStyle = rcol; ctx.beginPath(); ctx.moveTo(xl1, y1); ctx.lineTo(xr1, y1); ctx.lineTo(xr0, y0); ctx.lineTo(xl0, y0); ctx.fill();
      if (Math.floor(Ss[i] / (DZ * 1.5)) % 2 === 0) { ctx.fillStyle = mix([255, 244, 200], fogC, fog); const w1 = 0.12 * k1, w0 = 0.12 * k0; ctx.beginPath(); ctx.moveTo(a[0] - w1, y1); ctx.lineTo(a[0] + w1, y1); ctx.lineTo(b[0] + w0, y0); ctx.lineTo(b[0] - w0, y0); ctx.fill(); }
      // zone d'arrêt
      if (Ss[i] > v.seg.len - 130 && Ss[i] < v.seg.len) { ctx.fillStyle = "rgba(255,210,60,0.28)"; ctx.beginPath(); ctx.moveTo(xl1, y1); ctx.lineTo(xr1, y1); ctx.lineTo(xr0, y0); ctx.lineTo(xl0, y0); ctx.fill(); }
      if (Math.abs(Ss[i] - (v.seg.len - 130)) < DZ * 0.55) { ctx.fillStyle = "#fff"; ctx.beginPath(); ctx.moveTo(xl1, y1); ctx.lineTo(xr1, y1); ctx.lineTo(xr0, y0 + 1); ctx.lineTo(xl0, y0 + 1); ctx.fill(); }
      if (Ss[i] > seg.len + 5) { ctx.fillStyle = gcol; ctx.fillRect(0, y1, W, Math.max(1, y0 - y1 + 1)); }
    }
    // éléments de décor et obstacles, du plus loin au plus proche
    const items = [];
    const at = (z) => { const f2 = Math.max(0, Math.min(N - 0.001, (z - (DZ - frac)) / DZ + 1)); const i = Math.floor(f2), u = f2 - i; return { X: Xs[i] + (Xs[i + 1] - Xs[i]) * u, Y: Ys[i] + (Ys[i + 1] - Ys[i]) * u }; };
    const first = Math.floor(s0 / DZ) + 1;
    for (let q = first; q < first + N; q++) {
      const r = hsh(seg.decor + q * 7919); if (r > 0.55) continue; const side = hsh(q * 31 + seg.decor) < 0.5 ? -1 : 1; const kind = Math.floor(hsh(q * 17 + 3) * 3);
      const z = q * DZ - s0; if (z < 6 || z > N * DZ - 10) continue; if (q * DZ > seg.len + 20) continue;
      items.push({ z, kind: "decor", d: kind, side, xw: 8 + hsh(q * 5) * 14 });
    }
    seg.pois.forEach((p) => { const z = p.s - s0; if (z > 8 && z < N * DZ - 10) items.push({ z, kind: "poi", p, side: p.s % 20 > 10 ? -1 : 1, xw: 14 }); });
    { const z = seg.len - 130 - s0; if (z > 8 && z < N * DZ - 10) items.push({ z, kind: "stop", side: 1, xw: 7.5 }); }
    v.obs.forEach((o) => { const z = o.s - s0; if (z > 2.5 && z < N * DZ - 10) items.push({ z, kind: "obs", o, xw: o.x * ROAD_HALF }); });
    items.sort((a, b) => b.z - a.z);
    items.forEach((it) => {
      const P = at(it.z); const k = f / it.z; const wx = it.kind === "obs" ? it.xw : it.side * it.xw; const sx = W / 2 + (P.X + wx - camX) * k, sy = horizon + (CAM_H - P.Y) * k; if (sx < -300 || sx > W + 300) return;
      const fog = Math.min(1, Math.pow(it.z / visM, 1.6)); if (fog > 0.97) return; ctx.globalAlpha = 1 - fog * 0.9;
      const m = k * 0.045;
      if (it.kind === "obs") { if (v.blind && it.o.s - s0 > 30) { ctx.globalAlpha = 1; return; } sprite(ctx, it.o.kind, sx, sy, m * (it.o.kind === "slowcar" ? 1.2 : 1), it.o, t); if (it.o.scared) Dr.text(ctx, "!", sx, sy - 100 * m, 36 * m, "#e8453c"); }
      else if (it.kind === "decor") decor(ctx, B.id, it.d, sx, sy, m * 1.3, it.side);
      else if (it.kind === "stop") { ctx.save(); ctx.translate(sx, sy); ctx.scale(m * 1.6, m * 1.6); Dr.line(ctx, 0, 0, 0, -120, 6); Dr.rrect(ctx, -46, -170, 92, 54, 8, "#2f78d1", 4); Dr.text(ctx, v.last && v.si === v.nSeg - 1 ? "TERMINUS" : "ARRÊT", 0, -143, 20, "#fff"); ctx.restore(); }
      else if (it.kind === "poi") { ctx.save(); ctx.translate(sx, sy); ctx.scale(m * 1.8, m * 1.8); const h = Dr.hash(it.p.name) % 3; if (h === 0) { Dr.rrect(ctx, -60, -70, 120, 70, 14, "#fff", 4); Dr.ell(ctx, -20, -40, 8, 8, "#222", 0); Dr.ell(ctx, 18, -30, 10, 12, "#222", 0); Dr.rrect(ctx, 50, -110, 36, 34, 12, "#fff", 4); } else if (h === 1) { Dr.rrect(ctx, -70, -60, 140, 26, 13, "#e0b060", 4); } else { Dr.poly(ctx, [[-40, 0], [-20, -110], [20, -110], [40, 0]], "#c88aff", 4); } Dr.rrect(ctx, -80, -140, 160, 26, 8, "#fff7c2", 3); Dr.text(ctx, it.p.name, 0, -127, 13, "#2b1b17"); ctx.restore(); }
      ctx.globalAlpha = 1;
    });
    // météo et lumière
    if (B.id === "pluie") { ctx.strokeStyle = "rgba(200,220,255,0.55)"; ctx.lineWidth = 1.5; ctx.beginPath(); for (let i = 0; i < 70; i++) { const rx = hsh(i) * W, ry = ((hsh(i + 50) * H + (t || 0) * 900) % H); ctx.moveTo(rx, ry); ctx.lineTo(rx - 5, ry + 18); } ctx.stroke(); }
    if (night) { ctx.fillStyle = "rgba(4,8,24," + (v.lights.electric === "crit" ? 0.88 : 0.55) + ")"; ctx.fillRect(0, 0, W, H); const g = ctx.createRadialGradient(W / 2, H * 0.78, 10, W / 2, H * 0.55, W * 0.55); g.addColorStop(0, "rgba(255,244,190,0.45)"); g.addColorStop(1, "rgba(255,244,190,0)"); ctx.fillStyle = g; ctx.fillRect(0, 0, W, H); }
    if (v.fog) { const g = ctx.createLinearGradient(0, horizon - 40, 0, H); g.addColorStop(0, "rgba(235,240,245,0.9)"); g.addColorStop(1, "rgba(235,240,245,0.25)"); ctx.fillStyle = g; ctx.fillRect(0, 0, W, H); }
    if (v.slip) { ctx.fillStyle = "rgba(20,20,30,0.12)"; ctx.fillRect(0, 0, W, H); }
    // tableau de bord, volant
    const dh = H * 0.2; const dash = ctx.createLinearGradient(0, H - dh, 0, H); dash.addColorStop(0, "#2a2f3a"); dash.addColorStop(1, "#14171e"); ctx.fillStyle = dash; ctx.beginPath(); ctx.moveTo(0, H); ctx.lineTo(0, H - dh * 0.55); ctx.quadraticCurveTo(W / 2, H - dh * 1.25, W, H - dh * 0.55); ctx.lineTo(W, H); ctx.fill();
    ctx.save(); ctx.translate(W / 2, H - dh * 0.1); ctx.rotate((fx.steer || 0) * 0.9); const wr = Math.min(W, H) * 0.2; ctx.beginPath(); ctx.arc(0, 0, wr, 0, Dr.TAU); ctx.lineWidth = 12; ctx.strokeStyle = "#0e0f13"; ctx.stroke(); ctx.lineWidth = 6; ctx.strokeStyle = "#3a3f4c"; ctx.stroke(); Dr.line(ctx, -wr, 0, wr, 0, 9, "#14161c"); Dr.line(ctx, 0, 0, 0, wr, 9, "#14161c"); Dr.ell(ctx, 0, 0, wr * 0.22, wr * 0.22, "#d6453d", 3); ctx.restore();
    if (fx.hornFlash > 0) { Dr.text(ctx, "POUET", W / 2, H * 0.3, 48 + fx.hornFlash * 30, "#ff3b3b"); }
    // pare-brise sale
    if (v.blind) { Dr.ell(ctx, W * 0.45, H * 0.38, W * 0.2, H * 0.17, fx.foam ? "#f4f8ff" : "#6b8e23", 3); Dr.ell(ctx, W * 0.55, H * 0.46, W * 0.14, H * 0.1, fx.foam ? "#e4efff" : "#556b1c", 3); for (let i = 0; i < 6; i++) Dr.line(ctx, W * 0.35 + i * W * 0.06, H * 0.5, W * 0.35 + i * W * 0.06 - 4, H * 0.62 + (i % 3) * 14, 5, fx.foam ? "#f4f8ff" : "#6b8e23"); Dr.text(ctx, "Essuie-glace", W / 2, H * 0.62, 20, "#fff"); }
    if (v.startle) { const k = Math.min(1, (fx.startleT || 0) * 4); Dr.line(ctx, W * 0.5, 0, W * 0.5, H * 0.1 + k * H * 0.28, 2, "#222"); Dr.ell(ctx, W * 0.5, H * 0.14 + k * H * 0.28, 26, 22, "#222", 3); for (let i = 0; i < 4; i++) { Dr.line(ctx, W * 0.5 - 22, H * 0.14 + k * H * 0.28 + (i - 1.5) * 6, W * 0.5 - 48, H * 0.14 + k * H * 0.28 + (i - 1.5) * 12 + 12, 3); Dr.line(ctx, W * 0.5 + 22, H * 0.14 + k * H * 0.28 + (i - 1.5) * 6, W * 0.5 + 48, H * 0.14 + k * H * 0.28 + (i - 1.5) * 12 + 12, 3); } Dr.ell(ctx, W * 0.5 - 8, H * 0.14 + k * H * 0.28 - 4, 4, 4, "#fff", 0); Dr.ell(ctx, W * 0.5 + 8, H * 0.14 + k * H * 0.28 - 4, 4, 4, "#fff", 0); }
    if (v.flick && Math.sin((t || 0) * 40) > 0.3) { ctx.fillStyle = "rgba(0,0,0,0.5)"; ctx.fillRect(0, 0, W, H); }
  }
  return { render, segOf, ROAD_HALF };
})();

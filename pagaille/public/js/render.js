// ============================================================
// PAGAILLE PARTY — Dessin du plateau (canvas 2D)
// Le serveur envoie des listes de formes simples, ce fichier sait les dessiner toutes.
// ============================================================
(function () {
  const COLORS = ["#ef4b4b", "#3b82f6", "#34c36c", "#f5c518", "#9b5de5", "#ff8a1f", "#ff6fb5", "#1fc8c0"];
  const hexOf = (k) => COLORS[(k || 0) % COLORS.length];
  const vis = {}; // position affichée de chaque pion, rattrape la position du serveur en douceur
  function follow(id, x, y, ang, dt) {
    let v = vis[id]; if (!v) v = vis[id] = { x, y, ang: ang || 0 };
    const d = Math.hypot(x - v.x, y - v.y); const k = d > 180 ? 1 : Math.min(1, dt * 16);
    v.x += (x - v.x) * k; v.y += (y - v.y) * k;
    if (ang != null) { let da = ang - v.ang; while (da > Math.PI) da -= Math.PI * 2; while (da < -Math.PI) da += Math.PI * 2; v.ang += da * (d > 180 ? 1 : Math.min(1, dt * 16)); }
    return v;
  }
  function rr(ctx, x, y, w, h, r) { r = Math.min(r || 0, w / 2, h / 2); ctx.beginPath(); ctx.moveTo(x + r, y); ctx.arcTo(x + w, y, x + w, y + h, r); ctx.arcTo(x + w, y + h, x, y + h, r); ctx.arcTo(x, y + h, x, y, r); ctx.arcTo(x, y, x + w, y, r); ctx.closePath(); }
  function label(ctx, text, x, y, size, color) { ctx.font = "700 " + size + "px Fredoka, system-ui, sans-serif"; ctx.textAlign = "center"; ctx.lineWidth = 4; ctx.strokeStyle = "rgba(0,0,0,.65)"; ctx.strokeText(text, x, y); ctx.fillStyle = color || "#fff"; ctx.fillText(text, x, y); }

  function pawn(ctx, it, dt, t) {
    const v = follow(it.id, it.x, it.y, null, dt); const z = it.z || 0; const lift = z * 5 + (it.air ? 14 : 0); const r = (it.r || 16) * (it.s || 1);
    ctx.save(); ctx.globalAlpha = it.dead ? 0.35 : 1;
    if (z || it.air) { ctx.fillStyle = "rgba(0,0,0,.35)"; ctx.beginPath(); ctx.ellipse(v.x, v.y + 4, r * 0.95, r * 0.5, 0, 0, 7); ctx.fill(); }
    const cy = v.y - lift;
    if (it.ring) { ctx.strokeStyle = it.ring; ctx.lineWidth = 5; ctx.beginPath(); ctx.arc(v.x, cy, r + 5 + Math.sin(t * 10) * 1.5, 0, 7); ctx.stroke(); }
    ctx.fillStyle = hexOf(it.k); ctx.strokeStyle = "#fff"; ctx.lineWidth = 3; ctx.beginPath(); ctx.arc(v.x, cy, r, 0, 7); ctx.fill(); ctx.stroke();
    ctx.fillStyle = "rgba(255,255,255,.9)"; ctx.beginPath(); ctx.arc(v.x - r * 0.3, cy - r * 0.15, r * 0.17, 0, 7); ctx.arc(v.x + r * 0.3, cy - r * 0.15, r * 0.17, 0, 7); ctx.fill();
    ctx.fillStyle = "#222"; ctx.beginPath(); ctx.arc(v.x - r * 0.3, cy - r * 0.12, r * 0.08, 0, 7); ctx.arc(v.x + r * 0.3, cy - r * 0.12, r * 0.08, 0, 7); ctx.fill();
    if (it.n) label(ctx, it.n, v.x, cy - r - 8, 13);
    if (it.badge) { ctx.font = "20px serif"; ctx.textAlign = "center"; ctx.fillText(it.badge, v.x, cy - r - 24); }
    if (it.ok) { ctx.font = "18px serif"; ctx.textAlign = "center"; ctx.fillText("✅", v.x + r, cy - r + 4); }
    ctx.restore();
  }
  function car(ctx, it, dt, t) {
    const v = follow(it.id, it.x, it.y, it.ang, dt);
    ctx.save(); ctx.translate(v.x, v.y);
    if (it.danger) { ctx.fillStyle = "rgba(255,60,30," + (0.25 + 0.2 * Math.sin(t * 18)) + ")"; ctx.beginPath(); ctx.arc(0, 0, 38, 0, 7); ctx.fill(); }
    if (it.imm) { ctx.strokeStyle = "rgba(255,255,255,.85)"; ctx.lineWidth = 3; ctx.setLineDash([6, 5]); ctx.beginPath(); ctx.arc(0, 0, 30, 0, 7); ctx.stroke(); ctx.setLineDash([]); }
    ctx.rotate(v.ang);
    ctx.fillStyle = hexOf(it.k); ctx.strokeStyle = "#fff"; ctx.lineWidth = 2.5; rr(ctx, -19, -11, 38, 22, 7); ctx.fill(); ctx.stroke();
    ctx.fillStyle = "rgba(20,30,50,.75)"; rr(ctx, 1, -8, 11, 16, 3); ctx.fill();
    ctx.fillStyle = "#ffe9a0"; ctx.fillRect(16, -9, 3, 5); ctx.fillRect(16, 4, 3, 5);
    ctx.restore();
    label(ctx, it.n || "", v.x, v.y - 28, 13);
    if (it.bomb) { ctx.font = "30px serif"; ctx.textAlign = "center"; ctx.fillText("💣", v.x, v.y - 52); label(ctx, String(it.bomb), v.x, v.y - 74, 24, it.danger ? "#ff6b4a" : "#ffe27a"); }
  }
  function draw(ctx, fr, dt, t) {
    (fr.items || []).forEach((it) => {
      switch (it.t) {
        case "rect": ctx.save(); ctx.globalAlpha = it.a == null ? 1 : it.a; ctx.fillStyle = it.c || "#fff"; rr(ctx, it.x, it.y, it.w, it.h, it.r || 0); ctx.fill(); if (it.s) { ctx.strokeStyle = it.s; ctx.lineWidth = 2; ctx.stroke(); } ctx.restore(); break;
        case "circ": ctx.save(); ctx.globalAlpha = it.a == null ? 1 : it.a; ctx.fillStyle = it.c || "#fff"; ctx.beginPath(); ctx.arc(it.x, it.y, it.r, 0, 7); ctx.fill(); if (it.s) { ctx.strokeStyle = it.s; ctx.lineWidth = 3; ctx.stroke(); } ctx.restore(); break;
        case "ring": ctx.save(); ctx.globalAlpha = it.a == null ? 1 : it.a; ctx.strokeStyle = it.c; ctx.lineWidth = it.w || 4; ctx.beginPath(); ctx.arc(it.x, it.y, it.r, 0, 7); ctx.stroke(); ctx.restore(); break;
        case "text": ctx.save(); ctx.font = "700 " + (it.s || 20) + "px Fredoka, system-ui, sans-serif"; ctx.textAlign = "center"; ctx.fillStyle = it.c || "#fff"; ctx.fillText(it.v, it.x, it.y); ctx.restore(); break;
        case "grid": {
          const pal = it.pal || []; ctx.save();
          for (let r = 0; r < it.rows; r++) for (let c = 0; c < it.cols; c++) {
            const code = it.cells[r * it.cols + c]; if (code < 0) continue; const x = it.x + c * it.cs, y = it.y + r * it.cs;
            ctx.fillStyle = pal[code] || "#556"; rr(ctx, x + 2, y + 2, it.cs - 4, it.cs - 4, 9); ctx.fill();
            ctx.strokeStyle = "rgba(255,255,255,.28)"; ctx.lineWidth = 2; ctx.stroke();
            if (it.sym && it.sym[code]) { ctx.font = "700 " + Math.round(it.cs * 0.42) + "px Fredoka, system-ui, sans-serif"; ctx.textAlign = "center"; ctx.fillStyle = "rgba(255,255,255,.55)"; ctx.fillText(it.sym[code], x + it.cs / 2, y + it.cs / 2 + it.cs * 0.15); }
            if (pal.length === 2 && code === 1) { ctx.strokeStyle = "rgba(60,20,0,.7)"; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(x + 12, y + 14); ctx.lineTo(x + it.cs / 2, y + it.cs / 2); ctx.lineTo(x + it.cs - 16, y + 10); ctx.moveTo(x + it.cs / 2, y + it.cs / 2); ctx.lineTo(x + it.cs / 2 + 6, y + it.cs - 12); ctx.stroke(); }
          }
          ctx.restore(); break;
        }
        case "pawn": pawn(ctx, it, dt, t); break;
        case "car": car(ctx, it, dt, t); break;
        default: break;
      }
    });
  }
  window.PgRender = { draw, hexOf, COLORS, reset() { Object.keys(vis).forEach((k) => delete vis[k]); } };
})();

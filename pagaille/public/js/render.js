// ============================================================
// PAGAILLE PARTY — Vue à plat (canvas 2D)
// Sert aux jeux conçus à plat et de solution de repli quand la 3D n'est pas disponible.
// Elle lit les mêmes images du serveur que le moteur 3D. x vers la droite, y vers le bas, z devient un décalage vers le haut.
// ============================================================
(function () {
  const COLORS = ["#ef4b4b", "#3b82f6", "#34c36c", "#f5c518", "#9b5de5", "#ff8a1f", "#ff6fb5", "#1fc8c0"];
  const hexOf = (k) => COLORS[(k || 0) % COLORS.length];
  const vis = {}; // position affichée de chaque pion, rattrape la position du serveur en douceur
  const LIFT = 0.55;
  function follow(id, x, y, ang, dt) {
    let v = vis[id]; if (!v) v = vis[id] = { x, y, ang: ang || 0 };
    const d = Math.hypot(x - v.x, y - v.y); const k = d > 180 ? 1 : Math.min(1, dt * 16);
    v.x += (x - v.x) * k; v.y += (y - v.y) * k;
    if (ang != null) { let da = ang - v.ang; while (da > Math.PI) da -= Math.PI * 2; while (da < -Math.PI) da += Math.PI * 2; v.ang += da * (d > 180 ? 1 : Math.min(1, dt * 16)); }
    return v;
  }
  function rr(ctx, x, y, w, h, r) { r = Math.min(r || 0, w / 2, h / 2); ctx.beginPath(); ctx.moveTo(x + r, y); ctx.arcTo(x + w, y, x + w, y + h, r); ctx.arcTo(x + w, y + h, x, y + h, r); ctx.arcTo(x, y + h, x, y, r); ctx.arcTo(x, y, x + w, y, r); ctx.closePath(); }
  function label(ctx, text, x, y, size, color) { ctx.font = "700 " + size + "px Fredoka, system-ui, sans-serif"; ctx.textAlign = "center"; ctx.textBaseline = "alphabetic"; ctx.lineWidth = 4; ctx.lineJoin = "round"; ctx.strokeStyle = "rgba(0,0,0,.65)"; ctx.strokeText(text, x, y); ctx.fillStyle = color || "#fff"; ctx.fillText(text, x, y); }
  function shade(hex, f) { const n = parseInt(String(hex).replace("#", "").slice(0, 6), 16); if (isNaN(n)) return hex; const r = Math.max(0, Math.min(255, ((n >> 16) & 255) * f)), g = Math.max(0, Math.min(255, ((n >> 8) & 255) * f)), b = Math.max(0, Math.min(255, (n & 255) * f)); return "rgb(" + (r | 0) + "," + (g | 0) + "," + (b | 0) + ")"; }
  const col = (it) => it.c || (it.k != null ? hexOf(it.k) : "#8899aa");

  function pawn(ctx, it, dt, t, me) {
    const v = follow(it.id, it.x, it.y, null, dt); const z = (it.z || 0) * LIFT; const r = (it.r || 16) * (it.sc || 1); const gz = ((it.gz == null ? it.z || 0 : it.gz)) * LIFT;
    ctx.save(); ctx.globalAlpha = it.dead ? 0.3 : it.ghost ? 0.45 : 1;
    ctx.fillStyle = "rgba(0,0,0,.35)"; ctx.beginPath(); ctx.ellipse(v.x, v.y - gz + 4, r * 0.95, r * 0.5, 0, 0, 7); ctx.fill();
    const cy = v.y - z - (it.air ? 4 : 0);
    ctx.fillStyle = col(it); ctx.strokeStyle = "#fff"; ctx.lineWidth = 3; ctx.beginPath(); ctx.arc(v.x, cy, r, 0, 7); ctx.fill(); ctx.stroke();
    ctx.fillStyle = "rgba(255,255,255,.95)"; ctx.beginPath(); ctx.arc(v.x - r * 0.3, cy - r * 0.15, r * 0.19, 0, 7); ctx.arc(v.x + r * 0.3, cy - r * 0.15, r * 0.19, 0, 7); ctx.fill();
    ctx.fillStyle = "#222"; ctx.beginPath(); ctx.arc(v.x - r * 0.3, cy - r * 0.12, r * 0.09, 0, 7); ctx.arc(v.x + r * 0.3, cy - r * 0.12, r * 0.09, 0, 7); ctx.fill();
    if (it.n) label(ctx, it.n, v.x, cy - r - 8, 13);
    if (me && me === it.id) { ctx.fillStyle = "#fff"; ctx.beginPath(); ctx.moveTo(v.x, cy - r - 30); ctx.lineTo(v.x - 8, cy - r - 42); ctx.lineTo(v.x + 8, cy - r - 42); ctx.closePath(); ctx.fill(); }
    if (it.badge) { ctx.font = "20px serif"; ctx.textAlign = "center"; ctx.fillText(it.badge, v.x, cy - r - 26); }
    ctx.restore();
  }
  function car(ctx, it, dt, t) {
    const v = follow(it.id, it.x, it.y, it.ang, dt); const z = (it.z || 0) * LIFT;
    ctx.save(); ctx.translate(v.x, v.y - z);
    if (it.danger) { ctx.fillStyle = "rgba(255,60,30," + (0.25 + 0.2 * Math.sin(t * 18)) + ")"; ctx.beginPath(); ctx.arc(0, 0, 38, 0, 7); ctx.fill(); }
    if (it.imm) { ctx.strokeStyle = "rgba(255,255,255,.85)"; ctx.lineWidth = 3; ctx.setLineDash([6, 5]); ctx.beginPath(); ctx.arc(0, 0, 30, 0, 7); ctx.stroke(); ctx.setLineDash([]); }
    ctx.rotate(v.ang);
    ctx.fillStyle = col(it); ctx.strokeStyle = "#fff"; ctx.lineWidth = 2.5; rr(ctx, -19, -11, 38, 22, 7); ctx.fill(); ctx.stroke();
    ctx.fillStyle = "rgba(20,30,50,.75)"; rr(ctx, 1, -8, 11, 16, 3); ctx.fill();
    ctx.fillStyle = "#ffe9a0"; ctx.fillRect(16, -9, 3, 5); ctx.fillRect(16, 4, 3, 5);
    ctx.restore();
    label(ctx, it.n || "", v.x, v.y - z - 28, 13);
    if (it.bomb) { ctx.font = "30px serif"; ctx.textAlign = "center"; ctx.fillText("💣", v.x, v.y - z - 52); label(ctx, String(it.bomb), v.x, v.y - z - 74, 24, it.danger ? "#ff6b4a" : "#ffe27a"); }
  }
  function draw(ctx, fr, dt, t, me) {
    const items = (fr.items || []).slice(); const all = (fr.sceneItems || []).concat(items); if (fr.privItems) fr.privItems.forEach((p) => all.push(p));
    if (fr.ground) { ctx.fillStyle = fr.ground; ctx.fillRect(0, 0, fr.w, fr.h); }
    all.sort((a, b) => ((a.z || 0) + (a.h || 0)) - ((b.z || 0) + (b.h || 0)));
    all.forEach((it) => {
      const lift = (it.z || 0) * LIFT, hh = (it.h || 0) * LIFT;
      switch (it.t) {
        case "box": {
          const w = it.w || 10, d = it.d || 10; ctx.save(); ctx.globalAlpha = it.a == null ? 1 : it.a; ctx.translate(it.x, it.y - lift - hh); if (it.rot) ctx.rotate(it.rot);
          if (hh > 2) { ctx.fillStyle = shade(col(it), 0.62); rr(ctx, -w / 2, -d / 2 + hh, w, d, 5); ctx.fill(); }
          ctx.fillStyle = it.m === "lava" ? "#ff6a1a" : col(it); rr(ctx, -w / 2, -d / 2, w, d, 5); ctx.fill(); ctx.strokeStyle = "rgba(255,255,255,.22)"; ctx.lineWidth = 2; ctx.stroke();
          if (it.lab) { ctx.font = "700 " + Math.round(Math.min(w, d) * 0.45) + "px Fredoka, system-ui, sans-serif"; ctx.textAlign = "center"; ctx.textBaseline = "middle"; ctx.fillStyle = it.lc || "rgba(255,255,255,.75)"; ctx.fillText(it.lab, 0, 2); ctx.textBaseline = "alphabetic"; }
          ctx.restore(); break; }
        case "cyl": case "sph": case "disc": { const r = it.r || 10; ctx.save(); ctx.globalAlpha = it.a == null ? (it.t === "disc" ? 0.5 : 1) : it.a; if (hh > 2) { ctx.fillStyle = shade(col(it), 0.62); ctx.beginPath(); ctx.arc(it.x, it.y - lift, r, 0, 7); ctx.fill(); } ctx.fillStyle = col(it); ctx.beginPath(); ctx.arc(it.x, it.y - lift - hh, r, 0, 7); ctx.fill(); ctx.strokeStyle = "rgba(255,255,255,.3)"; ctx.lineWidth = 3; ctx.stroke(); ctx.restore(); break; }
        case "ring": ctx.save(); ctx.globalAlpha = it.a == null ? 1 : it.a; ctx.strokeStyle = col(it); ctx.lineWidth = it.w || 4; ctx.beginPath(); ctx.arc(it.x, it.y - lift, it.r, 0, 7); ctx.stroke(); ctx.restore(); break;
        case "text": ctx.save(); ctx.font = "700 " + (it.s || 20) + "px Fredoka, system-ui, sans-serif"; ctx.textAlign = "center"; ctx.fillStyle = it.c || "#fff"; ctx.fillText(it.v, it.x, it.y - lift); ctx.restore(); break;
        case "beam": ctx.save(); ctx.globalAlpha = it.a == null ? 0.85 : it.a; ctx.strokeStyle = col(it); ctx.lineWidth = it.w || 6; ctx.lineCap = "round"; ctx.beginPath(); ctx.moveTo(it.x, it.y - lift); ctx.lineTo(it.x2, it.y2 - (it.z2 == null ? it.z || 0 : it.z2) * LIFT); ctx.stroke(); ctx.restore(); break;
        case "arrow": { const len = it.len || 100, a = it.ang || 0; const x2 = it.x + Math.cos(a) * len, y2 = it.y + Math.sin(a) * len - lift; ctx.save(); ctx.strokeStyle = col(it); ctx.fillStyle = col(it); ctx.lineWidth = 6; ctx.beginPath(); ctx.moveTo(it.x, it.y - lift); ctx.lineTo(x2, y2); ctx.stroke(); ctx.beginPath(); ctx.moveTo(x2 + Math.cos(a) * 14, y2 + Math.sin(a) * 14); ctx.lineTo(x2 + Math.cos(a + 2.5) * 14, y2 + Math.sin(a + 2.5) * 14); ctx.lineTo(x2 + Math.cos(a - 2.5) * 14, y2 + Math.sin(a - 2.5) * 14); ctx.closePath(); ctx.fill(); ctx.restore(); break; }
        case "coin": ctx.save(); ctx.fillStyle = "#ffcf33"; ctx.strokeStyle = "#a87b00"; ctx.lineWidth = 2; ctx.beginPath(); ctx.arc(it.x, it.y - lift - 8, 9 * (it.s || 1), 0, 7); ctx.fill(); ctx.stroke(); ctx.restore(); break;
        case "flag": ctx.save(); ctx.fillStyle = it.on ? "#4cd964" : col(it); ctx.fillRect(it.x, it.y - lift - 40, 3, 40); ctx.fillRect(it.x, it.y - lift - 40, 22, 14); ctx.restore(); break;
        case "chest": ctx.save(); ctx.fillStyle = "#a8692a"; rr(ctx, it.x - 20, it.y - lift - 22, 40, 26, 5); ctx.fill(); ctx.fillStyle = "#ffd24a"; ctx.fillRect(it.x - 3, it.y - lift - 14, 6, 8); ctx.restore(); break;
        case "pawn": pawn(ctx, it, dt, t, me); break;
        case "car": car(ctx, it, dt, t); break;
        default: break;
      }
    });
  }
  window.PgRender = { draw, hexOf, COLORS, reset() { Object.keys(vis).forEach((k) => delete vis[k]); } };
})();

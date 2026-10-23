// ============================================================
// BUS BAZAR — Dessin des personnages et du bus (tout est tracé en code)
// ============================================================
const BBDraw = (function () {
  const TAU = Math.PI * 2; const INK = "#2b1b17";
  const SKINS = ["#f6c9a0", "#e8b088", "#c98e63", "#a8734c", "#f3d3b8", "#d9a273"];
  const SHIRTS = ["#e8453c", "#2f78d1", "#3aa653", "#f08a24", "#8a55c8", "#25b9b0", "#ee6fb0", "#6b7a8f", "#c9a227"];
  function hash(str) { let h = 2166136261 >>> 0; str = String(str); for (let i = 0; i < str.length; i++) { h ^= str.charCodeAt(i); h = Math.imul(h, 16777619) >>> 0; } return h >>> 0; }
  function path(ctx, fn) { ctx.beginPath(); fn(ctx); }
  function fillStroke(ctx, fill, lw) { if (fill) { ctx.fillStyle = fill; ctx.fill(); } if (lw === 0) return; ctx.lineWidth = lw == null ? 3 : lw; ctx.strokeStyle = INK; ctx.lineJoin = "round"; ctx.lineCap = "round"; ctx.stroke(); }
  function ell(ctx, x, y, rx, ry, fill, lw, rot) { ctx.beginPath(); ctx.ellipse(x, y, Math.max(0.1, rx), Math.max(0.1, ry), rot || 0, 0, TAU); fillStroke(ctx, fill, lw); }
  function rrect(ctx, x, y, w, h, r, fill, lw) { r = Math.min(r, w / 2, h / 2); ctx.beginPath(); ctx.moveTo(x + r, y); ctx.arcTo(x + w, y, x + w, y + h, r); ctx.arcTo(x + w, y + h, x, y + h, r); ctx.arcTo(x, y + h, x, y, r); ctx.arcTo(x, y, x + w, y, r); ctx.closePath(); fillStroke(ctx, fill, lw); }
  function poly(ctx, pts, fill, lw) { ctx.beginPath(); ctx.moveTo(pts[0][0], pts[0][1]); for (let i = 1; i < pts.length; i++) ctx.lineTo(pts[i][0], pts[i][1]); ctx.closePath(); fillStroke(ctx, fill, lw); }
  function line(ctx, x1, y1, x2, y2, lw, col) { ctx.beginPath(); ctx.moveTo(x1, y1); ctx.lineTo(x2, y2); ctx.lineWidth = lw; ctx.strokeStyle = col || INK; ctx.lineCap = "round"; ctx.stroke(); }
  function text(ctx, t, x, y, size, col, align) { ctx.font = "700 " + size + "px Fredoka, 'Trebuchet MS', sans-serif"; ctx.textAlign = align || "center"; ctx.textBaseline = "middle"; ctx.fillStyle = col || INK; ctx.fillText(t, x, y); }

  // ---------- visages ----------
  // emo vaut happy, ok, sad, angry, panic, sleep, sick, smug
  function face(ctx, x, y, r, emo, t) {
    const ex = r * 0.38, ey = -r * 0.08, er = r * 0.12;
    const blink = Math.sin((t || 0) * 1.7 + x) > 0.97;
    const eye = (sx) => {
      if (emo === "sleep" || blink) { ctx.beginPath(); ctx.arc(x + sx * ex, y + ey, er * 1.2, 0.1 * Math.PI, 0.9 * Math.PI); ctx.lineWidth = 2.5; ctx.strokeStyle = INK; ctx.stroke(); return; }
      if (emo === "happy") { ctx.beginPath(); ctx.arc(x + sx * ex, y + ey + er, er * 1.3, 1.1 * Math.PI, 1.9 * Math.PI); ctx.lineWidth = 3; ctx.strokeStyle = INK; ctx.lineCap = "round"; ctx.stroke(); return; }
      if (emo === "panic") { ell(ctx, x + sx * ex, y + ey, er * 1.9, er * 2.2, "#fff", 2.2); ell(ctx, x + sx * ex + Math.sin((t || 0) * 18) * 1.2, y + ey, er * 0.7, er * 0.7, INK, 0); return; }
      if (emo === "sick") { ctx.beginPath(); ctx.moveTo(x + sx * ex - er, y + ey - er); ctx.lineTo(x + sx * ex + er, y + ey + er); ctx.moveTo(x + sx * ex + er, y + ey - er); ctx.lineTo(x + sx * ex - er, y + ey + er); ctx.lineWidth = 2.5; ctx.strokeStyle = INK; ctx.stroke(); return; }
      ell(ctx, x + sx * ex, y + ey, er * 1.5, er * 1.7, "#fff", 2); ell(ctx, x + sx * ex + (emo === "angry" ? -sx * er * 0.3 : 0), y + ey + er * 0.2, er * 0.75, er * 0.85, INK, 0);
    };
    eye(-1); eye(1);
    if (emo === "angry" || emo === "sad" || emo === "smug") {
      const a = emo === "angry" ? 1 : emo === "sad" ? -1 : 0.2;
      line(ctx, x - ex * 1.6, y + ey - er * (2.2 + a * 1.6), x - ex * 0.4, y + ey - er * (2.2 - a * 1.6), 3);
      line(ctx, x + ex * 1.6, y + ey - er * (2.2 + a * 1.6), x + ex * 0.4, y + ey - er * (2.2 - a * 1.6), 3);
    }
    const my = y + r * 0.42;
    ctx.beginPath();
    if (emo === "happy") { ctx.moveTo(x - r * 0.34, my - r * 0.1); ctx.quadraticCurveTo(x, my + r * 0.5, x + r * 0.34, my - r * 0.1); ctx.closePath(); fillStroke(ctx, "#7a1f2b", 2.5); ctx.beginPath(); ctx.ellipse(x, my + r * 0.12, r * 0.12, r * 0.07, 0, 0, TAU); ctx.fillStyle = "#ff8a8a"; ctx.fill(); }
    else if (emo === "panic") { ctx.ellipse(x, my + r * 0.1, r * 0.2, r * 0.26 + Math.sin((t || 0) * 14) * 1.5, 0, 0, TAU); fillStroke(ctx, "#7a1f2b", 2.5); }
    else if (emo === "sad" || emo === "sick") { ctx.moveTo(x - r * 0.25, my + r * 0.18); ctx.quadraticCurveTo(x, my - r * 0.08, x + r * 0.25, my + r * 0.18); ctx.lineWidth = 3; ctx.strokeStyle = INK; ctx.stroke(); }
    else if (emo === "angry") { ctx.moveTo(x - r * 0.28, my + r * 0.12); ctx.lineTo(x - r * 0.1, my + r * 0.02); ctx.lineTo(x + r * 0.1, my + r * 0.12); ctx.lineTo(x + r * 0.28, my + r * 0.02); ctx.lineWidth = 3; ctx.strokeStyle = INK; ctx.stroke(); }
    else if (emo === "sleep") { ctx.ellipse(x, my + r * 0.08, r * 0.09, r * 0.07, 0, 0, TAU); fillStroke(ctx, "#7a1f2b", 2); }
    else { ctx.moveTo(x - r * 0.26, my); ctx.quadraticCurveTo(x, my + r * (emo === "smug" ? 0.32 : 0.2), x + r * 0.26, my - (emo === "smug" ? r * 0.08 : 0)); ctx.lineWidth = 3; ctx.strokeStyle = INK; ctx.stroke(); }
    if (emo === "panic") { ctx.beginPath(); ctx.moveTo(x + r * 0.78, y - r * 0.5); ctx.quadraticCurveTo(x + r * 0.95, y - r * 0.2, x + r * 0.78, y - r * 0.05); ctx.quadraticCurveTo(x + r * 0.6, y - r * 0.2, x + r * 0.78, y - r * 0.5); ctx.fillStyle = "#7fd4ff"; ctx.fill(); ctx.lineWidth = 1.5; ctx.strokeStyle = INK; ctx.stroke(); }
    if (emo === "sleep") { text(ctx, "z", x + r * 0.95, y - r * 0.9, r * 0.5, "#4a6fa5"); text(ctx, "Z", x + r * 1.25, y - r * 1.25, r * 0.7, "#4a6fa5"); }
  }
  function head(ctx, x, y, r, skin, tint) {
    ell(ctx, x - r * 0.98, y + r * 0.05, r * 0.16, r * 0.22, skin, 2.5); ell(ctx, x + r * 0.98, y + r * 0.05, r * 0.16, r * 0.22, skin, 2.5);
    ell(ctx, x, y, r, r * 1.05, tint || skin, 3.2);
    ell(ctx, x, y + r * 0.22, r * 0.12, r * 0.09, "rgba(200,110,90,0.55)", 0);
  }
  function emoOfPax(p) {
    if (!p) return "ok"; if (p.state === "malaise") return "sick"; if (p.state === "dort") return "sleep"; if (p.state === "colere") return "angry"; if (p.state === "panique") return "panic";
    if (p.inv) return "smug"; if (p.mood >= 72) return "happy"; if (p.mood >= 45) return "ok"; if (p.mood >= 25) return "sad"; return "angry";
  }

  // ---------- équipage (bustes) ----------
  // (x, y) est le bas du buste au centre. s vaut 1 pour environ 110 pixels de haut.
  function crew(ctx, role, x, y, s, emo, t, opt) {
    opt = opt || {}; ctx.save(); ctx.translate(x, y); ctx.scale(s, s); const bob = Math.sin((t || 0) * 3.1 + role.length) * (emo === "panic" ? 2.4 : 1.2); ctx.translate(0, bob);
    const R = 26;
    if (role === "driver") {
      rrect(ctx, -38, -44, 76, 46, 14, "#2f5fb3"); poly(ctx, [[-12, -44], [0, -26], [12, -44]], "#fff", 2.5);
      for (let i = 0; i < 3; i++) ell(ctx, 0, -22 + i * 9, 2.6, 2.6, "#f2c230", 1.5); rrect(ctx, -38, -6, 76, 8, 3, "#14316b", 2.5);
      head(ctx, 0, -64, R, SKINS[0]);
      rrect(ctx, -R * 1.02, -R * 2.3 + 8, R * 2.04, 12, 5, "#1f4f9a", 3); path(ctx, (c) => { c.moveTo(-R, -R * 2.0 + 8); c.quadraticCurveTo(0, -R * 3.0, R, -R * 2.0 + 8); c.closePath(); }); fillStroke(ctx, "#2f5fb3", 3.2);
      ell(ctx, 0, -R * 2.3 + 2, 6, 5, "#f2c230", 2); path(ctx, (c) => { c.moveTo(-R * 0.9, -R * 1.5); c.quadraticCurveTo(0, -R * 1.2, R * 0.9, -R * 1.5); c.lineTo(R * 0.9, -R * 1.62); c.quadraticCurveTo(0, -R * 1.35, -R * 0.9, -R * 1.62); c.closePath(); }); fillStroke(ctx, "#1f4f9a", 2.5);
      face(ctx, 0, -64, R, emo, t);
      const wob = Math.sin((t || 0) * 5) * (emo === "panic" ? 3 : 0.8);
      path(ctx, (c) => { c.moveTo(-3, -57); c.bezierCurveTo(-14, -48 + wob, -34, -56, -38, -69); c.bezierCurveTo(-26, -64, -22, -68, -4, -62); c.closePath(); }); fillStroke(ctx, "#3a2412", 2.8);
      path(ctx, (c) => { c.moveTo(3, -57); c.bezierCurveTo(14, -48 + wob, 34, -56, 38, -69); c.bezierCurveTo(26, -64, 22, -68, 4, -62); c.closePath(); }); fillStroke(ctx, "#3a2412", 2.8);
    } else if (role === "mech") {
      rrect(ctx, -32, -36, 64, 38, 12, "#f08a24"); rrect(ctx, -22, -36, 10, 30, 3, "#c96a10", 2); rrect(ctx, 12, -36, 10, 30, 3, "#c96a10", 2); rrect(ctx, -12, -22, 24, 14, 3, "#c96a10", 2);
      head(ctx, 0, -56, R * 0.95, SKINS[1]);
      ell(ctx, -9, -50, 6, 3.5, "rgba(40,30,20,0.35)", 0);
      path(ctx, (c) => { c.moveTo(-R * 1.45, -R * 1.52); c.quadraticCurveTo(-R * 1.5, -R * 3.1, 0, -R * 3.1); c.quadraticCurveTo(R * 1.5, -R * 3.1, R * 1.45, -R * 1.52); c.closePath(); }); fillStroke(ctx, "#ffd23f", 3.2);
      rrect(ctx, -R * 1.6, -R * 1.62, R * 3.2, 9, 4, "#e6b800", 3); ell(ctx, 0, -R * 2.6, 8, 6, "#fff7c2", 2.5);
      face(ctx, 0, -56, R * 0.95, emo, t);
      rrect(ctx, 14, -14, 34, 22, 4, "#d6453d", 3); path(ctx, (c) => { c.moveTo(22, -14); c.lineTo(22, -22); c.lineTo(40, -22); c.lineTo(40, -14); }); ctx.lineWidth = 3; ctx.strokeStyle = INK; ctx.stroke(); line(ctx, 14, -4, 48, -4, 2.5);
    } else if (role === "nav") {
      rrect(ctx, -36, -44, 72, 46, 12, "#cfd6e0"); poly(ctx, [[-10, -44], [0, -30], [10, -44]], "#fff", 2.5); poly(ctx, [[-4, -34], [4, -34], [6, -6], [0, -2], [-6, -6]], "#d6453d", 2.5);
      rrect(ctx, 14, -30, 14, 14, 2, "#ffe66b", 2); rrect(ctx, -30, -36, 12, 12, 2, "#ff9ec7", 2);
      head(ctx, 0, -64, R, SKINS[4]);
      path(ctx, (c) => { c.moveTo(-R * 0.95, -R * 1.45); c.quadraticCurveTo(-R * 0.7, -R * 2.0, -R * 0.2, -R * 1.65); c.quadraticCurveTo(0, -R * 1.9, R * 0.2, -R * 1.65); c.quadraticCurveTo(R * 0.7, -R * 2.0, R * 0.95, -R * 1.45); }); fillStroke(ctx, "#8a8a8a", 2.5);
      rrect(ctx, -6, -R * 2.05, 14, 12, 2, "#7fe6a2", 2);
      face(ctx, 0, -64, R, emo, t);
      ctx.beginPath(); ctx.arc(-R * 0.4, -64 - R * 0.08, R * 0.3, 0, TAU); ctx.moveTo(R * 0.4 + R * 0.3, -64 - R * 0.08); ctx.arc(R * 0.4, -64 - R * 0.08, R * 0.3, 0, TAU); ctx.lineWidth = 2.6; ctx.strokeStyle = INK; ctx.stroke(); line(ctx, -R * 0.1, -64 - R * 0.08, R * 0.1, -64 - R * 0.08, 2.5);
      rrect(ctx, 16, -26, 44, 14, 7, "#f1dfb0", 2.8); ell(ctx, 60, -19, 5, 7, "#e2c98a", 2.5); line(ctx, 22, -22, 52, -22, 1.5, "#a07a2a"); line(ctx, 22, -17, 46, -17, 1.5, "#a07a2a");
    } else {
      rrect(ctx, -34, -42, 68, 44, 12, "#3a4f7a"); path(ctx, (c) => { c.moveTo(-34, -30); c.lineTo(-34, 2); c.lineTo(-10, 2); c.lineTo(-14, -42); c.lineTo(-30, -42); c.closePath(); c.moveTo(34, -30); c.lineTo(34, 2); c.lineTo(10, 2); c.lineTo(14, -42); c.lineTo(30, -42); c.closePath(); }); fillStroke(ctx, "#c8ff1a", 3);
      line(ctx, -32, -22, -12, -22, 4, "#e8e8e8"); line(ctx, 32, -22, 12, -22, 4, "#e8e8e8");
      head(ctx, 0, -64, R, SKINS[2]);
      ell(ctx, 0, -R * 2.05 - 3, R * 0.55, R * 0.45, "#5a2f1a", 3); path(ctx, (c) => { c.moveTo(-R * 1.0, -R * 1.5); c.quadraticCurveTo(0, -R * 2.5, R * 1.0, -R * 1.5); c.quadraticCurveTo(0, -R * 1.7, -R * 1.0, -R * 1.5); c.closePath(); }); fillStroke(ctx, "#5a2f1a", 3);
      face(ctx, 0, -64, R, emo === "ok" || emo === "sad" ? "happy" : emo, t);
      ctx.beginPath(); ctx.moveTo(-6, -40); ctx.quadraticCurveTo(0, -30, 6, -40); ctx.lineWidth = 1.6; ctx.strokeStyle = INK; ctx.stroke(); rrect(ctx, -6, -34, 12, 8, 3, "#cfd6e0", 2); ell(ctx, 0, -30, 2, 2, INK, 0);
      if (emo === "happy" || emo === "ok") { rrect(ctx, 20, -50 - Math.sin((t || 0) * 8) * 1.5, 14, 6, 3, "#cfd6e0", 2); }
    }
    ctx.restore();
  }

  // ---------- passagers ----------
  function paxBust(ctx, p, x, y, s, t) {
    const h = hash(p.id + p.name); const skin = SKINS[h % SKINS.length]; const shirt = SHIRTS[(h >> 3) % SHIRTS.length]; const emo = emoOfPax(p); const R = 26;
    ctx.save(); ctx.translate(x, y); ctx.scale(s, s); const bob = p.state === "dort" ? Math.sin((t || 0) * 1.2) * 1.5 : Math.sin((t || 0) * 3 + (h % 7)) * (emo === "panic" ? 2.5 : 0.9); ctx.translate(0, bob);
    rrect(ctx, -32, -36, 64, 38, 14, shirt);
    const a = p.arch;
    if (a === "touriste") { for (let i = 0; i < 3; i++) rrect(ctx, 34 + (i % 2) * 4, -18 - i * 14, 26, 16, 4, ["#d6453d", "#2f78d1", "#3aa653"][i], 2.5); }
    if (a === "colis") { rrect(ctx, -26, -30, 52, 34, 3, "#c99a5a", 3); line(ctx, 0, -30, 0, 4, 4, "#e6d3a8"); ell(ctx, 18, -24, 3, 3, "#d6453d", 1.5); }
    head(ctx, 0, -60, R, skin, p.state === "malaise" ? "#b7e08a" : null);
    if (a === "touriste") { ell(ctx, 0, -R * 1.9, R * 1.8, R * 0.45, "#f1d27a", 3); path(ctx, (c) => { c.moveTo(-R, -R * 2.0); c.quadraticCurveTo(0, -R * 3.0, R, -R * 2.0); c.closePath(); }); fillStroke(ctx, "#f1d27a", 3); rrect(ctx, -R, -R * 2.1, R * 2, 6, 2, "#d6453d", 2); }
    if (a === "influenceur") { path(ctx, (c) => { c.moveTo(-R * 0.95, -R * 1.5); c.quadraticCurveTo(-R * 0.3, -R * 2.6, R * 0.95, -R * 1.55); c.quadraticCurveTo(0, -R * 1.9, -R * 0.95, -R * 1.5); }); fillStroke(ctx, "#ff5fa2", 3); }
    if (a === "retraite") { for (let i = -2; i <= 2; i++) ell(ctx, i * 7, -R * 1.95 + Math.abs(i) * 2, 6, 7, "#f4f4f4", 2.2); }
    if (a === "silence") { ctx.beginPath(); ctx.arc(0, -R * 1.45, R * 1.12, Math.PI, 0); ctx.lineWidth = 5; ctx.strokeStyle = "#555"; ctx.stroke(); ell(ctx, -R * 1.05, -R * 1.3, 8, 11, "#d6453d", 3); ell(ctx, R * 1.05, -R * 1.3, 8, 11, "#d6453d", 3); }
    if (a === "clown") { for (let i = 0; i < 5; i++) ell(ctx, -22 + i * 11, -R * 1.9 + Math.abs(i - 2) * 3, 9, 9, ["#ff4d4d", "#ffd23f", "#4dd36a", "#4da6ff", "#c24dff"][i], 2.2); }
    if (a === "canards") { for (let i = 0; i < 3; i++) { const dx = -16 + i * 16, dy = -R * 1.95 - (i === 1 ? 10 : 0); ell(ctx, dx, dy, 9, 7, "#ffd23f", 2.5); ell(ctx, dx + 5, dy - 7, 5, 5, "#ffd23f", 2.2); poly(ctx, [[dx + 9, dy - 7], [dx + 15, dy - 5], [dx + 9, dy - 3]], "#ff9a2e", 1.8); } }
    if (a === "plaignant") { path(ctx, (c) => { c.moveTo(-R * 0.9, -R * 1.55); c.quadraticCurveTo(0, -R * 2.2, R * 0.9, -R * 1.55); c.quadraticCurveTo(0, -R * 1.75, -R * 0.9, -R * 1.55); }); fillStroke(ctx, "#4a3b20", 3); }
    if (a === "fauxchauffeur") { path(ctx, (c) => { c.moveTo(-R * 0.95, -R * 1.55); c.quadraticCurveTo(0, -R * 2.6, R * 0.95, -R * 1.55); c.closePath(); }); fillStroke(ctx, "#3a8a4a", 3); rrect(ctx, -R * 1.1, -R * 1.6, R * 2.4, 8, 4, "#2a6a38", 2.5); }
    if (a === "train") { path(ctx, (c) => { c.moveTo(-R * 0.95, -R * 1.5); c.lineTo(-R * 0.8, -R * 2.2); c.lineTo(R * 0.8, -R * 2.2); c.lineTo(R * 0.95, -R * 1.5); c.closePath(); }); fillStroke(ctx, "#d6453d", 3); rrect(ctx, -R, -R * 1.6, R * 2, 8, 3, "#9a2a22", 2.5); ell(ctx, 0, -R * 1.9, 5, 5, "#ffd23f", 1.5); }
    if (a === "dormeur") { path(ctx, (c) => { c.moveTo(-R * 0.95, -R * 1.5); c.quadraticCurveTo(-R * 0.2, -R * 2.8, R * 1.35, -R * 1.2); c.quadraticCurveTo(0, -R * 1.7, -R * 0.95, -R * 1.5); }); fillStroke(ctx, "#8aa4ff", 3); ell(ctx, R * 1.35, -R * 1.15, 6, 6, "#fff", 2); rrect(ctx, -30, -12, 60, 16, 8, "#fff5e6", 2.5); }
    if (a === "animal") { ell(ctx, 30, -42, 9, 11, "#3fbf5b", 2.5); ell(ctx, 32, -54, 7, 7, "#3fbf5b", 2.5); poly(ctx, [[37, -54], [45, -51], [37, -49]], "#ff9a2e", 1.8); ell(ctx, 33, -55, 1.8, 1.8, INK, 0); ell(ctx, 30, -34, 4, 6, "#d6453d", 1.8); }
    face(ctx, 0, -60, R, emo, t);
    if (a === "retraite") { ctx.beginPath(); ctx.arc(-R * 0.4, -60 - R * 0.08, R * 0.3, 0, TAU); ctx.moveTo(R * 0.7, -60 - R * 0.08); ctx.arc(R * 0.4, -60 - R * 0.08, R * 0.3, 0, TAU); ctx.lineWidth = 2.2; ctx.strokeStyle = INK; ctx.stroke(); }
    if (a === "silence") { ell(ctx, 0, -60 + R * 0.42, 5, 14, SKINS[0], 2.5, 0); rrect(ctx, -3, -60 + R * 0.1, 6, 20, 3, skin, 2.2); }
    if (a === "clown") { ell(ctx, 0, -60 + R * 0.12, 7, 7, "#ff3b3b", 2.5); }
    if (a === "plaignant") { rrect(ctx, 14, -30, 26, 32, 3, "#fff", 2.5); line(ctx, 18, -22, 36, -22, 1.6); line(ctx, 18, -16, 36, -16, 1.6); line(ctx, 18, -10, 30, -10, 1.6); }
    if (a === "fauxchauffeur") { ctx.beginPath(); ctx.arc(26, -14, 15, 0, TAU); ctx.lineWidth = 4; ctx.strokeStyle = INK; ctx.stroke(); ctx.lineWidth = 2; ctx.strokeStyle = "#555"; ctx.stroke(); line(ctx, 26, -14, 26, 1, 3, "#555"); }
    if (a === "influenceur") { line(ctx, 22, -10, 46, -50, 3, "#888"); rrect(ctx, 38, -76, 20, 32, 4, "#222", 2.5); ell(ctx, 48, -64, 5, 5, "#4da6ff", 1.5); text(ctx, "♥", 52, -86 - (Math.floor((t || 0) * 2) % 2) * 4, 14, "#ff4d6d"); }
    if (a === "train") { ell(ctx, 0, -14, 5, 5, "#cfd6e0", 2); line(ctx, 0, -14, 14, -6, 2); }
    if (a === "canards") { ell(ctx, 24, -12, 9, 7, "#ffd23f", 2.5); ell(ctx, 29, -19, 5, 5, "#ffd23f", 2.2); poly(ctx, [[33, -19], [39, -17], [33, -15]], "#ff9a2e", 1.8); }
    if (a === "touriste") { rrect(ctx, -14, -26, 28, 18, 4, "#333", 2.5); ell(ctx, 0, -17, 6, 6, "#9ad", 2); }
    if (a === "colis" && (Math.floor((t || 0) * 3) % 2 === 0)) text(ctx, "bip", 22, -52, 12, "#d6453d");
    if (p.vip) { poly(ctx, [[-14, -R * 2.3], [-8, -R * 2.0], [0, -R * 2.5], [8, -R * 2.0], [14, -R * 2.3], [12, -R * 1.75], [-12, -R * 1.75]], "#ffd23f", 2.5); }
    if (p.inv) { ctx.save(); ctx.globalAlpha = 0.4 + 0.3 * Math.sin((t || 0) * 6); ell(ctx, 0, -40, 44, 56, "#fff6a8", 0); ctx.restore(); }
    ctx.restore();
  }

  // ---------- le bus vu de côté ----------
  function bus(ctx, W, H, v, t, anim) {
    anim = anim || {}; ctx.clearRect(0, 0, W, H); const gx = W / 2, gy = H * 0.78;
    const sc = Math.min(W / 330, H / 150); ctx.save(); ctx.translate(gx, gy); ctx.scale(sc, sc);
    const shake = (anim.jolt || 0) * Math.sin((t || 0) * 40) * 2.5; ctx.translate(0, shake + Math.sin((t || 0) * 9) * Math.min(1.4, (v.bus.v || 0) / 18));
    // route sous le bus
    // roues
    const spin = (anim.dist || 0) / 14;
    const wheel = (wx) => { ell(ctx, wx, 0, 21, 21, "#2a2a2e", 4); ell(ctx, wx, 0, 11, 11, v.lights && v.lights.tires === "crit" ? "#b0b0b0" : "#cfd3da", 3); for (let i = 0; i < 4; i++) line(ctx, wx, 0, wx + Math.cos(spin + i * Math.PI / 2) * 9, Math.sin(spin + i * Math.PI / 2) * 9, 2.5, "#666"); };
    const dent = Math.max(0, 1 - v.body / 100);
    path(ctx, (c) => { c.moveTo(-150, -8); c.lineTo(-150, -88); c.quadraticCurveTo(-150, -112, -128, -112); c.lineTo(110, -112); c.quadraticCurveTo(138, -112, 148, -84); c.lineTo(156, -30); c.quadraticCurveTo(158, -8, 140, -8); c.closePath(); }); fillStroke(ctx, "#f2b705", 4.5);
    rrect(ctx, -150, -42, 304, 10, 3, "#d6453d", 3);
    // fenêtres et passagers
    const n = Math.min(v.nPax || 0, 10);
    for (let i = 0; i < 6; i++) { const wx = -132 + i * 36; rrect(ctx, wx, -98, 30, 38, 6, "#bfe8ff", 3); }
    rrect(ctx, 100, -100, 44, 42, 8, "#bfe8ff", 3);
    const pax = anim.pax || []; for (let i = 0; i < 6; i++) { const q = pax[i]; if (!q) continue; const wx = -117 + i * 36; const em = emoOfPax(q); ell(ctx, wx, -76 + Math.sin((t || 0) * 3 + i) * 1.2, 9, 10, SKINS[hash(q.id) % SKINS.length], 2.2); if (em === "panic") ell(ctx, wx, -72, 3, 4, "#7a1f2b", 1.5); else if (em === "angry" || em === "sad") line(ctx, wx - 4, -72, wx + 4, -72, 2); else ell(ctx, wx, -73, 4, 2.5, "#7a1f2b", 1.2); }
    crew(ctx, "driver", 122, -56, 0.42, anim.driverEmo || "ok", t);
    if (anim.tourBags) { for (let i = 0; i < 5; i++) rrect(ctx, -90 + i * 14, -126 - (i % 2) * 10, 16, 16, 3, ["#d6453d", "#2f78d1", "#3aa653", "#f08a24", "#8a55c8"][i], 2.5); }
    rrect(ctx, 152, -52, 12, 10, 3, v.flick ? "#fff" : "#fff3a0", 2.5); rrect(ctx, 152, -24, 8, 8, 2, "#d6453d", 2);
    wheel(-100); wheel(90);
    // pannes visibles
    if (dent > 0.25) { line(ctx, -40, -100, -30, -88, 2.5); line(ctx, -30, -88, -42, -80, 2.5); }
    if (dent > 0.55) { line(ctx, 40, -100, 54, -90, 2.5); line(ctx, 54, -90, 42, -78, 2.5); poly(ctx, [[-148, -34], [-136, -26], [-148, -20]], "#888", 2); }
    if (v.temp > 105 || v.lights.cooling === "crit") { for (let i = 0; i < 3; i++) { const k = ((t || 0) * 1.2 + i * 0.33) % 1; ctx.globalAlpha = 0.8 - k * 0.8; ell(ctx, 130 + i * 6, -112 - k * 40, 8 + k * 10, 7 + k * 8, "#f4f4f4", 0); ctx.globalAlpha = 1; } }
    if (v.lights.engine === "crit" || v.lights.brakes === "crit") { for (let i = 0; i < 3; i++) { const k = ((t || 0) * 0.9 + i * 0.33) % 1; ctx.globalAlpha = 0.7 - k * 0.7; ell(ctx, -155 - k * 40, -20 - i * 4, 8 + k * 14, 8 + k * 10, "#555", 0); ctx.globalAlpha = 1; } }
    if (v.leak) { for (let i = 0; i < 3; i++) { const k = ((t || 0) * 1.5 + i * 0.4) % 1; ell(ctx, -20 - i * 8, -6 + k * 22, 2.5, 4, "#d9a441", 0); } }
    if (v.stuckHorn) text(ctx, "📯", 150, -126, 22);
    ctx.restore();
  }

  // ---------- accessoires et signes ----------
  function bubble(ctx, x, y, w, h, tail) { rrect(ctx, x, y, w, h, 8, "#fff", 2.5); if (tail) poly(ctx, [[x + w * 0.3, y + h - 1], [x + w * 0.2, y + h + 8], [x + w * 0.45, y + h - 1]], "#fff", 2.2); }

  return { SKINS, hash, ell, rrect, poly, line, text, fillStroke, face, head, emoOfPax, crew, paxBust, bus, bubble, INK, TAU };
})();

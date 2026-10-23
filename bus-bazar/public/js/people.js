// ============================================================
// BUS BAZAR — Personnages en 3D, icônes et étiquettes
// ============================================================
const BBPeople = (function () {
  const T = THREE; const L = BBL;
  const matCache = {}; const lam = (c, o) => { const k = c + (o ? JSON.stringify(o) : ""); if (!matCache[k]) matCache[k] = new T.MeshLambertMaterial(Object.assign({ color: new T.Color(c) }, o || {})); return matCache[k]; };
  const geo = { box: new T.BoxGeometry(1, 1, 1), sph: new T.SphereGeometry(1, 12, 9), cyl: new T.CylinderGeometry(1, 1, 1, 10), cone: new T.ConeGeometry(1, 1, 10), half: new T.SphereGeometry(1, 12, 6, 0, Math.PI * 2, 0, Math.PI / 2) };
  function part(g, m, sx, sy, sz, x, y, z) { const o = new T.Mesh(g, m); o.scale.set(sx, sy, sz); o.position.set(x || 0, y || 0, z || 0); return o; }
  const ROLE_COL = { driver: "#f2b705", steward: "#e8553c", mechanic: "#2f78d1", porter: "#3aa653" };

  function hat(kind, color) {
    const g = new T.Group();
    if (kind === 1) { g.add(part(geo.half, lam(color), 0.16, 0.14, 0.16, 0, 0.02, 0)); g.add(part(geo.box, lam(color), 0.2, 0.02, 0.14, 0, 0.03, 0.14)); }
    else if (kind === 2) { g.add(part(geo.cyl, lam("#5b3d28"), 0.3, 0.02, 0.3, 0, 0.04, 0)); g.add(part(geo.cyl, lam("#5b3d28"), 0.16, 0.14, 0.16, 0, 0.1, 0)); }
    else if (kind === 3) { g.add(part(geo.half, lam(color), 0.17, 0.2, 0.17, 0, 0.0, 0)); g.add(part(geo.sph, lam("#fff"), 0.05, 0.05, 0.05, 0, 0.2, 0)); }
    else if (kind === 4) { g.add(part(geo.cyl, lam("#f2c230"), 0.15, 0.08, 0.15, 0, 0.1, 0)); for (let i = 0; i < 5; i++) { const a = i / 5 * 6.28; g.add(part(geo.cone, lam("#f2c230"), 0.03, 0.08, 0.03, Math.cos(a) * 0.13, 0.17, Math.sin(a) * 0.13)); } }
    else if (kind === 5) { g.add(part(geo.half, lam("#222"), 0.16, 0.16, 0.16, 0, 0.02, 0)); g.add(part(geo.cyl, lam("#222"), 0.22, 0.02, 0.22, 0, 0.03, 0)); }
    return g;
  }
  // un personnage dont les pieds sont à y = 0. opts contient skin, cloth, hat, h, fat, role
  function person(opts) {
    opts = opts || {}; const skin = L.SKIN[(opts.skin || 0) % L.SKIN.length], cloth = opts.role ? ROLE_COL[opts.role] : L.CLOTH[(opts.cloth || 0) % L.CLOTH.length];
    const root = new T.Group(); const body = new T.Group(); root.add(body);
    const hips = new T.Group(); hips.position.y = 0.75; body.add(hips);
    const legL = new T.Group(), legR = new T.Group(); legL.position.set(-0.1, 0, 0); legR.position.set(0.1, 0, 0); hips.add(legL, legR);
    const pants = opts.role ? "#2a3550" : "#3b4560";
    [legL, legR].forEach((l) => { l.add(part(geo.box, lam(pants), 0.15, 0.72, 0.17, 0, -0.36, 0)); l.add(part(geo.box, lam("#1f1f24"), 0.16, 0.08, 0.26, 0, -0.74, 0.04)); });
    const upper = new T.Group(); upper.position.y = 0; hips.add(upper);
    upper.add(part(geo.box, lam(cloth), 0.42, 0.6, 0.25, 0, 0.32, 0));
    if (opts.role) { upper.add(part(geo.box, lam("#ffd23f"), 0.43, 0.06, 0.26, 0, 0.2, 0)); upper.add(part(geo.box, lam("#ffffff"), 0.1, 0.16, 0.02, 0.1, 0.45, 0.13)); }
    const head = new T.Group(); head.position.y = 0.76; upper.add(head);
    head.add(part(geo.sph, lam(skin), 0.15, 0.17, 0.15, 0, 0, 0)); head.add(part(geo.sph, lam("#222"), 0.02, 0.02, 0.02, -0.05, 0.02, 0.14)); head.add(part(geo.sph, lam("#222"), 0.02, 0.02, 0.02, 0.05, 0.02, 0.14));
    const hh = opts.role ? hat(1, ROLE_COL[opts.role]) : hat(opts.hat || 0, L.CLOTH[((opts.cloth || 0) + 3) % L.CLOTH.length]); hh.position.y = 0.12; head.add(hh);
    const armL = new T.Group(), armR = new T.Group(); armL.position.set(-0.27, 0.58, 0); armR.position.set(0.27, 0.58, 0); upper.add(armL, armR);
    [armL, armR].forEach((a) => { a.add(part(geo.box, lam(cloth), 0.11, 0.5, 0.12, 0, -0.22, 0)); a.add(part(geo.sph, lam(skin), 0.06, 0.06, 0.06, 0, -0.5, 0)); });
    const sc = opts.h || 1; root.scale.set(sc * (opts.fat || 1), sc, sc * (opts.fat || 1));
    return { g: root, body, hips, legL, legR, armL, armR, upper, head, phase: Math.random() * 6, lastPose: "", amt: 0 };
  }
  // pose, w vaut 0 à 1 pour la marche. mode vaut stand, sit, lie, carry
  function animate(P, mode, w, t, extra) {
    extra = extra || {}; P.amt += (w - P.amt) * 0.25; const sw = Math.sin((t + P.phase) * 8.5) * 0.75 * P.amt;
    P.legL.rotation.x = sw; P.legR.rotation.x = -sw; P.armL.rotation.x = -sw * 0.8; P.armR.rotation.x = sw * 0.8; P.armL.rotation.z = 0; P.armR.rotation.z = 0; P.upper.rotation.x = 0; P.head.rotation.set(0, 0, 0); P.body.rotation.set(0, 0, 0); P.body.position.set(0, 0, 0); P.hips.position.y = 0.75; P.legL.scale.y = 1; P.legR.scale.y = 1;
    if (mode === "sit" || mode === "sleep") { P.hips.position.y = 0.46; P.legL.rotation.x = -1.5; P.legR.rotation.x = -1.5; P.legL.scale.y = 0.62; P.legR.scale.y = 0.62; P.armL.rotation.x = -0.5; P.armR.rotation.x = -0.5;
      if (mode === "sleep") { P.head.rotation.set(0.5, 0, 0.25); P.upper.rotation.x = 0.2; P.armL.rotation.x = -0.3; P.armR.rotation.x = -0.3; } else if (extra.panic) { P.armL.rotation.x = -2.6; P.armR.rotation.x = -2.6 + Math.sin(t * 14) * 0.3; } else if (extra.angry) { P.armL.rotation.x = -1.8 + Math.sin(t * 9) * 0.4; } }
    else if (mode === "lie") { P.body.rotation.x = -1.4; P.body.position.set(0, 0.28, 0.2); P.armL.rotation.z = -1.0; P.armR.rotation.z = 1.0; }
    else if (mode === "carry") { P.armL.rotation.x = -1.5; P.armR.rotation.x = -1.5; }
    else if (extra.hold) { P.armL.rotation.x = -1.1 + Math.sin(t * 6) * 0.15; P.armR.rotation.x = -1.1 - Math.sin(t * 6) * 0.15; }
    else if (extra.panic) { P.armL.rotation.x = -2.8 + Math.sin(t * 16) * 0.4; P.armR.rotation.x = -2.8 - Math.sin(t * 16) * 0.4; }
    else if (extra.angry) { P.armL.rotation.x = -1.6 + Math.sin(t * 10) * 0.7; P.armR.rotation.x = -1.6 - Math.sin(t * 10) * 0.7; P.body.rotation.z = Math.sin(t * 6) * 0.06; }
    else if (extra.dance) { P.armL.rotation.z = -2.4 + Math.sin(t * 9) * 0.5; P.armR.rotation.z = 2.4 - Math.sin(t * 9) * 0.5; P.body.position.y = Math.abs(Math.sin(t * 9)) * 0.1; }
    if (extra.holdItem) { P.armL.rotation.x = -1.2; P.armR.rotation.x = -1.2; }
  }
  // icônes (emoji dessinés sur un canevas puis mis en cache)
  const icoCache = {};
  function iconTex(emoji, bg) {
    const k = emoji + (bg || ""); if (icoCache[k]) return icoCache[k];
    const cv = document.createElement("canvas"); cv.width = cv.height = 128; const x = cv.getContext("2d");
    x.fillStyle = bg || "rgba(20,30,50,0.82)"; x.beginPath(); x.arc(64, 64, 58, 0, 7); x.fill(); x.lineWidth = 6; x.strokeStyle = "rgba(255,255,255,0.85)"; x.stroke();
    x.font = "64px sans-serif"; x.textAlign = "center"; x.textBaseline = "middle"; x.fillText(emoji, 64, 70);
    const t = new T.CanvasTexture(cv); t.generateMipmaps = false; t.minFilter = T.LinearFilter; icoCache[k] = t; return t;
  }
  function icon(emoji, size, bg) { const m = new T.SpriteMaterial({ map: iconTex(emoji, bg), transparent: true, depthWrite: false }); const s = new T.Sprite(m); s.scale.set(size || 0.4, size || 0.4, 1); s.renderOrder = 5; return s; }
  function setIcon(sp, emoji, bg) { sp.material.map = iconTex(emoji, bg); sp.material.needsUpdate = true; }
  function label(text, color) {
    const cv = document.createElement("canvas"); cv.width = 256; cv.height = 64; const x = cv.getContext("2d"); x.fillStyle = "rgba(10,16,30,0.75)"; const w = 244; x.beginPath(); if (x.roundRect) x.roundRect(6, 8, w, 48, 16); else x.rect(6, 8, w, 48); x.fill();
    x.font = "bold 30px sans-serif"; x.textAlign = "center"; x.textBaseline = "middle"; x.fillStyle = color || "#fff"; x.fillText(text, 128, 34);
    const t = new T.CanvasTexture(cv); t.generateMipmaps = false; t.minFilter = T.LinearFilter; const s = new T.Sprite(new T.SpriteMaterial({ map: t, transparent: true, depthWrite: false })); s.scale.set(0.9, 0.225, 1); s.renderOrder = 5; return s;
  }
  function bar() { const s = new T.Sprite(new T.SpriteMaterial({ color: 0x5ad17a, transparent: true, depthWrite: false })); s.center.set(0, 0.5); s.scale.set(0.4, 0.06, 1); s.renderOrder = 6; return s; }
  return { person, animate, icon, setIcon, label, bar, lam, geo, part, ROLE_COL };
})();

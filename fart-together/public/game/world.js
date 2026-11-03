// ============================================================
// FART TOGETHER — Monde partagé (serveur et client)
// Requêtes sur le cours d'eau, position des obstacles mobiles.
// ============================================================
(function (root, factory) {
  if (typeof module !== "undefined" && module.exports) module.exports = factory();
  else root.FTWorld = factory();
})(typeof window !== "undefined" ? window : globalThis, function () {
  // le niveau est un objet { n, x[], z[], hw[], flow[], slope[], h[], zone[], turb[], L, obstacles[], ramps[], coins[], gates[], biome, ... }
  // s[i] est la longueur d'arc cumulée
  function nearest(lv, px, pz, hint) {
    const n = lv.n; let best = 1e18, bi = 0;
    const lo = hint === undefined ? 0 : Math.max(0, hint - 14), hi = hint === undefined ? n - 2 : Math.min(n - 2, hint + 14);
    for (let i = lo; i <= hi; i++) {
      const ax = lv.x[i], az = lv.z[i], bx = lv.x[i + 1], bz = lv.z[i + 1]; const dx = bx - ax, dz = bz - az; const l2 = dx * dx + dz * dz || 1;
      let t = ((px - ax) * dx + (pz - az) * dz) / l2; t = t < 0 ? 0 : t > 1 ? 1 : t;
      const qx = ax + dx * t, qz = az + dz * t; const d = (px - qx) * (px - qx) + (pz - qz) * (pz - qz);
      if (d < best) { best = d; bi = i; bi = i; lv._t = t; lv._qx = qx; lv._qz = qz; lv._dx = dx; lv._dz = dz; }
    }
    const i = bi, t = lv._t; const l = Math.sqrt(lv._dx * lv._dx + lv._dz * lv._dz) || 1; const tx = lv._dx / l, tz = lv._dz / l;
    const side = (px - lv._qx) * (-tz) + (pz - lv._qz) * tx; // positif à gauche du sens de la course
    const lerp = (a, b) => a + (b - a) * t;
    return { i, t, s: lv.s[i] + (lv.s[i + 1] - lv.s[i]) * t, tx, tz, lat: side, dist: Math.sqrt(best), hw: lerp(lv.hw[i], lv.hw[i + 1]), flow: lerp(lv.flow[i], lv.flow[i + 1]), slope: lerp(lv.slope[i], lv.slope[i + 1]), h: lerp(lv.h[i], lv.h[i + 1]), zone: t < 0.5 ? lv.zone[i] : lv.zone[i + 1], turb: lv.turb[i] || lv.turb[i + 1], qx: lv._qx, qz: lv._qz };
  }
  // position d'un obstacle à l'instant t (secondes de simulation)
  function obsPos(o, t) {
    if (!o.mv) return [o.x, o.z];
    const w = Math.sin(t * o.mv.f + o.mv.ph) * o.mv.amp; return [o.x + o.mv.ax * w, o.z + o.mv.az * w];
  }
  function pointAt(lv, s) {
    s = Math.max(0, Math.min(lv.L - 0.001, s)); let lo = 0, hi = lv.n - 1; while (hi - lo > 1) { const m = (lo + hi) >> 1; if (lv.s[m] <= s) lo = m; else hi = m; }
    const t = (s - lv.s[lo]) / ((lv.s[lo + 1] - lv.s[lo]) || 1); const x = lv.x[lo] + (lv.x[lo + 1] - lv.x[lo]) * t, z = lv.z[lo] + (lv.z[lo + 1] - lv.z[lo]) * t;
    const dx = lv.x[lo + 1] - lv.x[lo], dz = lv.z[lo + 1] - lv.z[lo]; const l = Math.hypot(dx, dz) || 1;
    return { x, z, tx: dx / l, tz: dz / l, hw: lv.hw[lo] + (lv.hw[lo + 1] - lv.hw[lo]) * t, h: lv.h[lo] + (lv.h[lo + 1] - lv.h[lo]) * t, i: lo };
  }
  return { nearest, obsPos, pointAt };
});

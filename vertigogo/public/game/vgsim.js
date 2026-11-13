// ============================================================
// VERTIGOGO — Contrôleur de personnage et monde (partagé client, serveur et tests)
// Tout le monde est fait de boîtes alignées sur les axes. Les éléments mobiles sont des fonctions pures du temps.
// ============================================================
(function (root, factory) { if (typeof module === "object" && module.exports) module.exports = factory(); else root.VgSim = factory(); })(typeof self !== "undefined" ? self : this, function () {
  const DT = 1 / 60;
  const K = {
    R: 0.32, H: 1.7, RUN: 6.0, ACC: 46, DEC: 52, AIR_ACC: 17, AIR_MAX: 6.6, G: 27, JV: 9.6, CUT: 0.42, COY: 0.11, BUF: 0.13, VMAX: -34,
    ICE_ACC: 6, ICE_DEC: 1.3, SPRING_V: 17.5, STEP: 0.3, REACH_LO: 0.95, REACH_HI: 1.8, HANG_DY: 1.55, CLIMB_T: 0.52, REGRAB: 0.35, TURN: 16,
  };
  const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);

  // ---------- monde ----------
  // box : {id, x0,x1,y0,y1,z0,z1, k:"solid|ice|crumble|spring|mover|lift", mv:{ax,amp,per,ph}, cr:{delay,back}}
  // sweep : {x,y,z, len, w (rad/s), ph, h, th} barre qui tourne
  function makeWorld(course) {
    const W = { t: 0, boxes: course.boxes.map((b) => Object.assign({}, b)), sweeps: course.sweeps || [], cr: {}, cell: 6, grid: new Map(), movers: [], dyn: [] };
    W.boxes.forEach((b, i) => {
      b.i = i; b.ox = 0; b.oy = 0; b.oz = 0; b.px = 0; b.py = 0; b.pz = 0; b.live = true;
      b.X0 = b.x0; b.X1 = b.x1; b.Y0 = b.y0; b.Y1 = b.y1; b.Z0 = b.z0; b.Z1 = b.z1;
      if (b.mv) { W.movers.push(b); } else addGrid(W, b);
    });
    return W;
  }
  function addGrid(W, b) {
    const c = W.cell; for (let gx = Math.floor(b.x0 / c); gx <= Math.floor(b.x1 / c); gx++) for (let gz = Math.floor(b.z0 / c); gz <= Math.floor(b.z1 / c); gz++) { const k = gx * 4096 + gz; let a = W.grid.get(k); if (!a) { a = []; W.grid.set(k, a); } a.push(b); }
  }
  function off(mv, t) { return mv.amp * Math.sin(((t / mv.per) + mv.ph) * Math.PI * 2); }
  // met à jour les boîtes mobiles et l'état d'effondrement à l'instant W.t
  function prepare(W) {
    const t = W.t;
    for (let i = 0; i < W.movers.length; i++) {
      const b = W.movers[i]; b.px = b.ox; b.py = b.oy; b.pz = b.oz; const o = off(b.mv, t); b.ox = b.mv.ax === "x" ? o : 0; b.oy = b.mv.ax === "y" ? o : 0; b.oz = b.mv.ax === "z" ? o : 0;
      b.X0 = b.x0 + b.ox; b.X1 = b.x1 + b.ox; b.Y0 = b.y0 + b.oy; b.Y1 = b.y1 + b.oy; b.Z0 = b.z0 + b.oz; b.Z1 = b.z1 + b.oz;
    }
  }
  function crumbleLive(W, b) { const c = W.cr[b.i]; if (!c) return true; const e = c.t0 + b.cr.delay; if (W.t < e) return true; if (W.t < e + b.cr.back) return false; delete W.cr[b.i]; return true; }
  // boîtes proches (rapide), mobiles toujours incluses
  function near(W, x0, x1, z0, z1, out) {
    out.length = 0; const c = W.cell;
    for (let gx = Math.floor(x0 / c); gx <= Math.floor(x1 / c); gx++) for (let gz = Math.floor(z0 / c); gz <= Math.floor(z1 / c); gz++) { const a = W.grid.get(gx * 4096 + gz); if (a) for (let i = 0; i < a.length; i++) if (out.indexOf(a[i]) < 0) out.push(a[i]); }
    for (let i = 0; i < W.movers.length; i++) out.push(W.movers[i]);
    return out;
  }
  const solid = (W, b) => (b.k === "crumble" ? crumbleLive(W, b) : true);

  function newPlayer(x, y, z, ry) {
    return { x, y, z, vx: 0, vz: 0, vy: 0, fx: Math.sin(ry || 0), fz: Math.cos(ry || 0), st: "ground", on: -1, coy: 0, buf: 0, jprev: false, jheld: false, grabLock: 0, hang: null, climbT: 0, climb: null, air: 0, slip: false, lastLand: 0, tAir: 0 };
  }
  const tmp = [];

  // ---------- collision ----------
  function overlapAny(W, x, y, z, hh, r, ignore) { // pour la place libre
    near(W, x - r, x + r, z - r, z + r, tmp);
    for (let i = 0; i < tmp.length; i++) { const b = tmp[i]; if (b === ignore || !solid(W, b)) continue; if (x + r > b.X0 && x - r < b.X1 && z + r > b.Z0 && z - r < b.Z1 && y + hh > b.Y0 && y < b.Y1) return b; }
    return null;
  }

  function stepPlayer(W, P, inp, ev) {
    const dt = DT, R = K.R, H = K.H; ev = ev || [];
    // entrées
    let mx = inp.mx || 0, mz = inp.mz || 0; const ml = Math.hypot(mx, mz); if (ml > 1) { mx /= ml; mz /= ml; }
    const jpress = !!inp.jump && !P.jprev; P.jprev = !!inp.jump; P.jheld = !!inp.jump;
    if (jpress) P.buf = K.BUF; else P.buf = Math.max(0, P.buf - dt);
    P.grabLock = Math.max(0, P.grabLock - dt);

    // porté par une plateforme mobile ou un tapis roulant
    if (P.on >= 0) { const b = W.boxes[P.on]; if (b && b.mv) { P.x += b.ox - b.px; P.y += b.oy - b.py; P.z += b.oz - b.pz; } else if (b && b.cv && P.st === "ground") { P.x += b.cv[0] * dt; P.z += b.cv[1] * dt; } }

    // ---- escalade ----
    if (P.st === "climb") {
      P.climbT += dt; const c = P.climb, k = clamp(P.climbT / K.CLIMB_T, 0, 1);
      const b = W.boxes[c.box]; const dx = b.mv ? b.ox : 0, dy = b.mv ? b.oy : 0, dz = b.mv ? b.oz : 0;
      const ky = clamp(k / 0.62, 0, 1), kx = clamp((k - 0.5) / 0.5, 0, 1); const e = (v) => v * v * (3 - 2 * v);
      P.y = c.y0 + (c.ty - c.y0) * e(ky) + dy; P.x = c.x0 + (c.tx - c.x0) * e(kx) + dx; P.z = c.z0 + (c.tz - c.z0) * e(kx) + dz; P.vx = P.vz = P.vy = 0;
      if (k >= 1) { P.st = "ground"; P.on = c.box; P.climb = null; P.vx = c.nx * 1.2; P.vz = c.nz * 1.2; ev.push({ e: "mantle", x: P.x, y: P.y, z: P.z }); }
      return ev;
    }
    // ---- suspendu ----
    if (P.st === "hang") {
      const h = P.hang, b = W.boxes[h.box]; const dx = b.mv ? b.ox : 0, dy = b.mv ? b.oy : 0, dz = b.mv ? b.oz : 0;
      P.x = h.x + dx; P.z = h.z + dz; P.y = h.y + dy; P.vx = P.vz = P.vy = 0;
      const toward = mx * -h.nx + mz * -h.nz; const away = mx * h.nx + mz * h.nz;
      if (!solid(W, b)) { P.st = "air"; P.hang = null; P.grabLock = K.REGRAB; return ev; }
      if (jpress || toward > 0.5) { const ex = h.x - h.nx * (R + 0.28), ez = h.z - h.nz * (R + 0.28); P.climb = { box: h.box, x0: P.x - dx, y0: P.y - dy, z0: P.z - dz, tx: ex, ty: b.y1, tz: ez, nx: -h.nx, nz: -h.nz }; P.st = "climb"; P.climbT = 0; P.hang = null; ev.push({ e: "climb" }); return ev; }
      if (inp.drop || away > 0.6) { P.st = "air"; P.hang = null; P.grabLock = K.REGRAB; P.vx = h.nx * 1.5; P.vz = h.nz * 1.5; P.vy = 0; ev.push({ e: "release" }); return ev; }
      // petit déplacement latéral sur le rebord
      const tx = -h.nz, tz = h.nx; const side = mx * tx + mz * tz;
      if (Math.abs(side) > 0.3) { const nx = h.x + tx * side * 1.5 * dt, nz = h.z + tz * side * 1.5 * dt, lim = 0.15; if (h.nx !== 0 ? (nz > b.z0 + lim && nz < b.z1 - lim) : (nx > b.x0 + lim && nx < b.x1 - lim)) { h.x = nx; h.z = nz; } }
      P.fx = -h.nx; P.fz = -h.nz; return ev;
    }

    // ---- sol ou air ----
    const grounded = P.st === "ground";
    if (grounded) { P.coy = K.COY; P.tAir = 0; } else { P.coy = Math.max(0, P.coy - dt); P.tAir += dt; }
    // surface
    let ice = false; if (grounded && P.on >= 0) { const b = W.boxes[P.on]; ice = b && b.k === "ice"; }
    const wantL = Math.hypot(mx, mz); const sp = K.RUN * wantL;
    if (grounded) {
      const tvx = mx * K.RUN, tvz = mz * K.RUN; const a = ice ? (wantL > 0.05 ? K.ICE_ACC : K.ICE_DEC) : (wantL > 0.05 ? K.ACC : K.DEC);
      const dx = tvx - P.vx, dz = tvz - P.vz, dl = Math.hypot(dx, dz), s = Math.min(dl, a * dt); if (dl > 1e-6) { P.vx += dx / dl * s; P.vz += dz / dl * s; }
    } else {
      // contrôle aérien, on ne brake pas, on infléchit
      const sp0 = Math.hypot(P.vx, P.vz), cap = Math.max(K.AIR_MAX, sp0);
      P.vx += mx * K.AIR_ACC * dt; P.vz += mz * K.AIR_ACC * dt; const sp1 = Math.hypot(P.vx, P.vz); if (sp1 > cap) { P.vx *= cap / sp1; P.vz *= cap / sp1; }
      if (wantL < 0.05) { const f = Math.max(0, 1 - 1.2 * dt); P.vx *= f; P.vz *= f; }
    }
    if (wantL > 0.1) { const k = Math.min(1, K.TURN * dt); P.fx += (mx / wantL - P.fx) * k; P.fz += (mz / wantL - P.fz) * k; const fl = Math.hypot(P.fx, P.fz) || 1; P.fx /= fl; P.fz /= fl; }

    // saut
    if (P.buf > 0 && P.coy > 0) { P.vy = K.JV; P.st = "air"; P.on = -1; P.coy = 0; P.buf = 0; P.jumped = true; ev.push({ e: "jump", x: P.x, y: P.y, z: P.z }); }
    if (!P.jheld && P.vy > 0 && P.jumped) { P.vy *= Math.pow(K.CUT, dt * 12); }
    P.vy -= K.G * dt; if (P.vy < K.VMAX) P.vy = K.VMAX;

    // déplacement par axes
    const box = tmp; let hit = null;
    const x1 = P.x + P.vx * dt, z1 = P.z + P.vz * dt;
    near(W, Math.min(P.x, x1) - R - 1, Math.max(P.x, x1) + R + 1, Math.min(P.z, z1) - R - 1, Math.max(P.z, z1) + R + 1, box);
    const list = box.slice(); // copie, car overlapAny réutilise tmp
    // X
    P.x = x1; for (let i = 0; i < list.length; i++) { const b = list[i]; if (!solid(W, b)) continue; if (P.x + R > b.X0 && P.x - R < b.X1 && P.z + R > b.Z0 && P.z - R < b.Z1 && P.y + H > b.Y0 && P.y < b.Y1) { if (b.Y1 - P.y <= K.STEP && P.vy <= 0.5 && !overlapAny(W, P.x, b.Y1 + 0.02, P.z, H - 0.02, R * 0.98, b)) { P.y = b.Y1; continue; } if (P.vx > 0 || (P.vx === 0 && P.x < (b.X0 + b.X1) / 2)) P.x = b.X0 - R - 1e-4; else P.x = b.X1 + R + 1e-4; P.vx = 0; } }
    // Z
    P.z = z1; for (let i = 0; i < list.length; i++) { const b = list[i]; if (!solid(W, b)) continue; if (P.x + R > b.X0 && P.x - R < b.X1 && P.z + R > b.Z0 && P.z - R < b.Z1 && P.y + H > b.Y0 && P.y < b.Y1) { if (b.Y1 - P.y <= K.STEP && P.vy <= 0.5 && !overlapAny(W, P.x, b.Y1 + 0.02, P.z, H - 0.02, R * 0.98, b)) { P.y = b.Y1; continue; } if (P.vz > 0 || (P.vz === 0 && P.z < (b.Z0 + b.Z1) / 2)) P.z = b.Z0 - R - 1e-4; else P.z = b.Z1 + R + 1e-4; P.vz = 0; } }
    // Y
    const yPrev = P.y; P.y += P.vy * dt; let landed = null;
    for (let i = 0; i < list.length; i++) { const b = list[i]; if (!solid(W, b)) continue; if (P.x + R > b.X0 && P.x - R < b.X1 && P.z + R > b.Z0 && P.z - R < b.Z1 && P.y + H > b.Y0 && P.y < b.Y1) {
      if (P.vy <= 0 && yPrev >= b.Y1 - 0.12 + (b.mv ? Math.min(0, b.oy - b.py) : 0) - 0.02) { P.y = b.Y1; if (!landed || b.Y1 > landed.Y1) landed = b; }
      else if (P.vy > 0 && yPrev + H <= b.Y0 + 0.12) { P.y = b.Y0 - H - 1e-4; P.vy = Math.min(P.vy, 0); }
      else { // enfoncé de côté par une boîte mobile, on ressort par la plus courte distance
        const dxl = b.X0 - R - P.x, dxr = b.X1 + R - P.x, dzl = b.Z0 - R - P.z, dzr = b.Z1 + R - P.z; const m = Math.min(Math.abs(dxl), Math.abs(dxr), Math.abs(dzl), Math.abs(dzr));
        if (m === Math.abs(dxl)) P.x += dxl; else if (m === Math.abs(dxr)) P.x += dxr; else if (m === Math.abs(dzl)) P.z += dzl; else P.z += dzr; } } }
    // appui au sol (sonde étroite)
    let stand = null;
    if (landed) { stand = landed; } else if (P.vy <= 0.01) {
      const r2 = R * 0.6; for (let i = 0; i < list.length; i++) { const b = list[i]; if (!solid(W, b)) continue; if (P.x + r2 > b.X0 && P.x - r2 < b.X1 && P.z + r2 > b.Z0 && P.z - r2 < b.Z1 && Math.abs(P.y - b.Y1) < 0.045 && P.vy <= 0.01) { if (!stand || b.Y1 > stand.Y1) stand = b; } }
    }
    if (stand && P.vy <= 0.01) {
      const impact = -P.vy; const was = P.st; P.y = stand.Y1; P.vy = 0; P.st = "ground"; P.on = stand.i; P.jumped = false;
      if (was === "air" && impact > 3) ev.push({ e: "land", v: impact, x: P.x, y: P.y, z: P.z, k: stand.k });
      if (stand.k === "spring") { P.vy = stand.sv || K.SPRING_V; P.st = "air"; P.on = -1; P.spr = stand.i; P.jumped = false; P.coy = 0; P.buf = 0; ev.push({ e: "spring", x: P.x, y: P.y, z: P.z, i: stand.i }); }
      else if (stand.k === "crumble" && !W.cr[stand.i]) { W.cr[stand.i] = { t0: W.t }; ev.push({ e: "crumble", i: stand.i }); }
    } else if (P.st === "ground") { P.st = "air"; P.on = -1; }
    if (P.st === "air") P.on = -1;

    // ---- barres tournantes ----
    for (let i = 0; i < W.sweeps.length; i++) {
      const s = W.sweeps[i]; if (P.y + H < s.y || P.y > s.y + s.h) continue; const a = s.w * W.t + s.ph; const ca = Math.cos(a), sa = Math.sin(a);
      const rx = P.x - s.x, rz = P.z - s.z; const u = rx * ca + rz * sa, v = -rx * sa + rz * ca; // repère de la barre
      const lim = s.len; if (Math.abs(u) > lim + R) continue; const hw = s.th + R; if (Math.abs(v) < hw) { const sg = v >= 0 ? 1 : -1; const push = (hw - Math.abs(v)) + 0.02; P.x += -sa * sg * push; P.z += ca * sg * push; const ws = s.w * Math.abs(u); P.vx += -sa * sg * Math.min(8, ws * 0.6 + 2); P.vz += ca * sg * Math.min(8, ws * 0.6 + 2); ev.push({ e: "sweep", i }); }
    }

    // ---- accroche de rebord ----
    if (P.st === "air" && P.vy < 2.5 && P.vy > -7.5 && P.grabLock <= 0 && !P.noGrab) {
      let gx = mx, gz = mz; if (Math.hypot(gx, gz) < 0.2) { gx = P.fx; gz = P.fz; } const gl = Math.hypot(gx, gz) || 1; gx /= gl; gz /= gl;
      const qx = P.x + gx * (R + 0.34), qz = P.z + gz * (R + 0.34);
      near(W, qx - 1, qx + 1, qz - 1, qz + 1, tmp); const cand = tmp.slice(); let best = null, bd = 9;
      for (let i = 0; i < cand.length; i++) { const b = cand[i]; if (!solid(W, b) || b.k === "spring") continue; const dy = b.Y1 - P.y; if (dy < K.REACH_LO || dy > K.REACH_HI) continue; if (qx < b.X0 || qx > b.X1 || qz < b.Z0 || qz > b.Z1) continue;
        // le joueur doit être dehors
        const dxo = Math.max(b.X0 - P.x, P.x - b.X1), dzo = Math.max(b.Z0 - P.z, P.z - b.Z1); if (Math.max(dxo, dzo) < R * 0.4) continue;
        let nx = 0, nz = 0; if (dxo >= dzo) nx = P.x < b.X0 ? -1 : 1; else nz = P.z < b.Z0 ? -1 : 1;
        if (gx * nx + gz * nz > -0.2) continue; // il faut regarder vers la paroi
        // place libre au dessus du rebord
        const ex = P.x - nx * (R + 0.3), ez = P.z - nz * (R + 0.3); if (overlapAny(W, ex, b.Y1 + 0.05, ez, H - 0.1, R * 0.9, b)) continue;
        const d = Math.abs(dy - 1.4); if (d < bd) { bd = d; best = { b, nx, nz }; } }
      if (best) {
        const b = best.b; const hx = best.nx !== 0 ? (best.nx < 0 ? b.X0 - R - 0.03 : b.X1 + R + 0.03) : clamp(P.x, b.X0 + 0.12, b.X1 - 0.12); const hz = best.nz !== 0 ? (best.nz < 0 ? b.Z0 - R - 0.03 : b.Z1 + R + 0.03) : clamp(P.z, b.Z0 + 0.12, b.Z1 - 0.12);
        const dx = b.mv ? b.ox : 0, dy2 = b.mv ? b.oy : 0, dz = b.mv ? b.oz : 0;
        P.st = "hang"; P.hang = { box: b.i, x: hx - dx, y: b.Y1 - K.HANG_DY - dy2, z: hz - dz, nx: best.nx, nz: best.nz }; P.x = hx; P.y = b.Y1 - K.HANG_DY; P.z = hz; P.vx = P.vz = P.vy = 0; P.on = -1; P.fx = -best.nx; P.fz = -best.nz; ev.push({ e: "grab", x: P.x, y: P.y, z: P.z });
      }
    }
    return ev;
  }

  // avance le monde d'un pas
  function tick(W) { W.t += DT; prepare(W); }

  function clonePlayer(P) { const c = Object.assign({}, P); if (P.hang) c.hang = Object.assign({}, P.hang); if (P.climb) c.climb = Object.assign({}, P.climb); return c; }
  function cloneWorldState(W) { return { t: W.t, cr: JSON.parse(JSON.stringify(W.cr)) }; }

  return { DT, K, clamp, makeWorld, prepare, tick, newPlayer, stepPlayer, clonePlayer, cloneWorldState, near, solid, overlapAny };
});

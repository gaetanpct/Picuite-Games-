// ============================================================
// BOUSKAILLE — Moteur physique partagé (client, serveur et bots)
// Tout dépend du temps de jeu t, les éléments mobiles n'ont donc jamais besoin d'être synchronisés.
// ============================================================
(function (root, factory) {
  if (typeof module !== "undefined" && module.exports) module.exports = factory();
  else root.BouskSim = factory();
})(typeof window !== "undefined" ? window : globalThis, function () {
  const DT = 1 / 60, RAD = 0.5;
  // toutes les valeurs d'équilibrage sont ici
  const K = {
    RUN: 6.4, ACC: 36, CHG_SPD: 3.1, DAMP: 2.1, ICE_ACC: 4.5, ICE_DAMP: 0.4, MUD: 0.55, REC_SPD: 0.4,
    CH_MIN: 0.14, CH_SPAN: 0.85,
    DASH_V0: 10.5, DASH_V1: 8.5, DASH_T0: 0.2, DASH_T1: 0.2, STEER: 2.3,
    REC_MISS0: 0.5, REC_MISS1: 0.45, REC_HIT: 0.2, CD_HIT: 0.7, CD_MISS: 1.15,
    PULSE_R: 1.9, PULSE_F: 7.2, PULSE_CD: 0.55, PULSE_MISS: 0.18, PULSE_COS: 0.2,
    E: 0.42, BONUS0: 2.2, BONUS1: 6.5, VCAP: 18, VCAP_BAR: 13,
    GRAV: 30, SPRING_V: 12.5, FALL_OUT: -13, EDGE: 0.18, AIRCTL: 0.35, STUN_K: 0.012,
    BRACE: 0.8, RECV: 1.5, INV_SELF: 1.6, HIT_MEMORY: 4,
    RAMP: 4, JUMP_V: 8.6, JUMP_CD: 0.95,
  };
  const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
  const len = (x, z) => Math.sqrt(x * x + z * z);
  // montée progressive des éléments mobiles au début de la manche, pour qu'aucun ne démarre en trombe
  const ramp = (t) => (t < K.RAMP ? (t * t) / (2 * K.RAMP) : t - K.RAMP / 2);
  const dramp = (t) => (t < K.RAMP ? t / K.RAMP : 1);

  function newPlayer(id, team, x, z, face) {
    return { id, team: team || 0, x, z, y: 0, vx: 0, vz: 0, vy: 0, fx: Math.cos(face || 0), fz: Math.sin(face || 0),
      alive: true, fall: false, air: false, holding: false, chT: 0, ch: 0, dash: 0, dx: 0, dz: 0, ds: 0, dpow: 0, dhit: false,
      rec: 0, cd: 0, jcd: 0, jHeld: false, stun: 0, slide: 0, inv: 0, springCd: 0, lastHit: null, hits: 0, ground: true, slip: false, st: "ok" };
  }

  // ---------- éléments de l'arène à l'instant t ----------
  function surfState(s, t) {
    const m = s.mv; let cx = s.x, cz = s.z, rot = s.rot || 0, vx = 0, vz = 0, w = 0, px = 0, pz = 0;
    if (m) {
      const tt = ramp(t), dt = dramp(t);
      if (m.type === "orbit") { const a = m.ph + m.w * tt; cx = m.cx + Math.cos(a) * m.rad; cz = m.cz + Math.sin(a) * m.rad; vx = -Math.sin(a) * m.rad * m.w * dt; vz = Math.cos(a) * m.rad * m.w * dt; rot = (s.rot || 0) + (m.selfSpin ? a : 0); }
      else if (m.type === "slide") { const a = m.ph + m.w * tt; const o = Math.sin(a) * m.amp; cx = s.x + m.ax * o; cz = s.z + m.az * o; const dv = Math.cos(a) * m.amp * m.w * dt; vx = m.ax * dv; vz = m.az * dv; }
      else if (m.type === "spin") {
        const th = m.w * tt; const c = Math.cos(th), sn = Math.sin(th); const rx = s.x - m.px, rz = s.z - m.pz;
        cx = m.px + rx * c - rz * sn; cz = m.pz + rx * sn + rz * c; rot = (s.rot || 0) + th; w = m.w * dt; px = m.px; pz = m.pz;
      }
    }
    return { cx, cz, rot, cos: Math.cos(rot), sin: Math.sin(rot), vx, vz, w, px, pz };
  }
  function sliderPos(o, t) {
    const T = o.period; const te = t - 7 - o.ph; // les pistons dorment pendant le début de la manche
    if (te < 0) return { k: 0, warn: 0 };
    const u = (te % T) / T; let k;
    if (o.kind === "block") { const a = o.ph + o.w * ramp(t); return { k: (Math.sin(a) + 1) / 2, warn: 0 }; }
    if (u < 0.55) k = 0; else if (u < 0.62) k = (u - 0.55) / 0.07; else if (u < 0.8) k = 1; else k = 1 - (u - 0.8) / 0.2;
    return { k, warn: u >= 0.35 && u < 0.62 ? 1 : 0 };
  }
  function sliderBox(o, t) {
    const p = sliderPos(o, t); const off = p.k * o.travel;
    return { x: o.x + o.ax * off, z: o.z + o.az * off, hw: o.hw, hd: o.hd, k: p.k, warn: p.warn };
  }
  function barAngle(b, t) { return b.ph + b.w * ramp(t); }
  function barSeg(b, t) {
    const a = barAngle(b, t), c = Math.cos(a), s = Math.sin(a);
    const x0 = b.both ? b.x - c * b.len : b.x, z0 = b.both ? b.z - s * b.len : b.z;
    return { x0, z0, x1: b.x + c * b.len, z1: b.z + s * b.len, c, s };
  }
  function zonePos(W, z) {
    if (z.host == null) return { x: z.x, z: z.z };
    const st = W.ss[z.host]; return { x: st.cx + z.x * st.cos - z.z * st.sin, z: st.cz + z.x * st.sin + z.z * st.cos };
  }
  function clipRadius(W, t) {
    const A = W.arena; let r = 1e9;
    if (A.shrink && W.shrinkOn) { const s = A.shrink; const u = clamp((t - s.start) / s.dur, 0, 1); r = s.R0 + (s.Rmin - s.R0) * u * u * (3 - 2 * u) * 1; }
    if (A.tide) { const T = A.tide; const u = 0.5 + 0.5 * Math.sin(((t + T.ph) / T.period) * Math.PI * 2); r = Math.min(r, T.R0 - T.depth * u * dramp(t)); }
    return r;
  }

  function makeWorld(arena, opts) {
    const W = { arena, t: 0, tick: 0, ss: [], tiles: arena.surfaces.map(() => ({ touch: -1, down: -1 })), events: [], players: [], friendly: !!(opts && opts.friendly), shrinkOn: !(opts && opts.noShrink), clipR: 1e9, zs: [] };
    prepare(W); return W;
  }
  function prepare(W) {
    const A = W.arena, t = W.t;
    for (let i = 0; i < A.surfaces.length; i++) W.ss[i] = surfState(A.surfaces[i], t);
    W.clipR = clipRadius(W, t);
    for (let i = 0; i < A.zones.length; i++) W.zs[i] = zonePos(W, A.zones[i]);
    // plateaux qui se dérobent
    for (let i = 0; i < A.surfaces.length; i++) {
      const s = A.surfaces[i]; if (s.kind !== "crumble") continue;
      const T = W.tiles[i]; if (T.down >= 0 && t >= T.down + s.back) { T.down = -1; T.touch = -1; }
    }
  }
  function tileOn(W, i) { const T = W.tiles[i]; return !(T.down >= 0 && W.t >= T.down); }

  // ---------- sol sous un point ----------
  function surfaceAt(W, x, z) {
    const A = W.arena;
    if (x * x + z * z > W.clipR * W.clipR) return null;
    let best = null;
    for (let i = 0; i < A.surfaces.length; i++) {
      const s = A.surfaces[i]; if (s.kind === "crumble" && !tileOn(W, i)) continue;
      const st = W.ss[i]; const dx = x - st.cx, dz = z - st.cz;
      const lx = dx * st.cos + dz * st.sin, lz = -dx * st.sin + dz * st.cos;
      let inside;
      if (s.k === "disc") { const rr = s.r + K.EDGE; inside = lx * lx + lz * lz <= rr * rr; }
      else inside = Math.abs(lx) <= s.w / 2 + K.EDGE && Math.abs(lz) <= s.d / 2 + K.EDGE;
      if (!inside) continue;
      let vx = st.vx, vz = st.vz;
      if (st.w) { vx += -st.w * (z - st.pz); vz += st.w * (x - st.px); }
      if (s.belt) { vx += (s.belt.x * st.cos - s.belt.z * st.sin) * dramp(W.t); vz += (s.belt.x * st.sin + s.belt.z * st.cos) * dramp(W.t); }
      best = { i, vx, vz, slip: !!s.slip, mud: !!s.mud, crumble: s.kind === "crumble" }; break;
    }
    return best;
  }
  function zoneAt(W, x, z, k) {
    const A = W.arena; let hit = null;
    for (let i = 0; i < A.zones.length; i++) {
      const zn = A.zones[i]; if (zn.k !== k) continue;
      const p = W.zs[i]; const dx = x - p.x, dz = z - p.z;
      if (zn.shape === "rect") { if (Math.abs(dx) <= zn.w / 2 && Math.abs(dz) <= zn.d / 2) hit = zn; } else if (dx * dx + dz * dz <= zn.r * zn.r) hit = zn;
    }
    return hit;
  }
  function windAt(W, x, z) {
    const A = W.arena, t = W.t; let ax = 0, az = 0;
    for (let i = 0; i < A.zones.length; i++) {
      const zn = A.zones[i]; if (zn.k !== "wind") continue;
      const p = W.zs[i]; const dx = x - p.x, dz = z - p.z;
      const inside = zn.shape === "rect" ? Math.abs(dx) <= zn.w / 2 && Math.abs(dz) <= zn.d / 2 : dx * dx + dz * dz <= zn.r * zn.r;
      if (!inside) continue;
      const u = (((t + zn.ph) % zn.period) + zn.period) % zn.period;
      if (t > 4 && u < zn.on) { ax += zn.dx * zn.f; az += zn.dz * zn.f; }
    }
    return { ax, az };
  }
  const windState = (zn, t) => { const u = (((t + zn.ph) % zn.period) + zn.period) % zn.period; return t > 4 && u < zn.on ? 2 : (t > 3 && u >= zn.period - 1.1 ? 1 : 0); };

  const ev = (W, e) => { if (W.events.length < 80) W.events.push(e); };

  // ---------- un pas pour un joueur ----------
  function stepPlayer(W, P, inp) {
    if (!P.alive) return;
    const dt = DT; inp = inp || {};
    P.cd = Math.max(0, P.cd - dt); P.rec = Math.max(0, P.rec - dt); P.stun = Math.max(0, P.stun - dt); P.slide = Math.max(0, P.slide - dt); P.inv = Math.max(0, P.inv - dt); P.springCd = Math.max(0, P.springCd - dt); P.jcd = Math.max(0, (P.jcd || 0) - dt);
    const jEdge = !!inp.j && !P.jHeld; P.jHeld = !!inp.j;
    let mx = +inp.mx || 0, mz = +inp.mz || 0; const ml = len(mx, mz); if (ml > 1) { mx /= ml; mz /= ml; }
    // chute
    if (P.fall) {
      P.vy -= K.GRAV * dt; P.y += P.vy * dt; const d = Math.exp(-0.45 * dt); P.vx *= d; P.vz *= d; P.x += P.vx * dt; P.z += P.vz * dt;
      P.holding = false; P.dash = 0; P.ch = 0;
      if (P.y > -0.55 && P.vy < 0) { const sf = surfaceAt(W, P.x, P.z); if (sf && !sf.crumble) { P.fall = false; P.y = 0; P.vy = 0; P.air = false; ev(W, { e: "save", id: P.id, x: P.x, z: P.z }); } }
      if (P.y < K.FALL_OUT) { P.alive = false; ev(W, { e: "ko", id: P.id, x: P.x, z: P.z, by: koBy(W, P) }); }
      P.st = "fall"; return;
    }
    // air (ressort)
    if (P.air) {
      P.vy -= K.GRAV * dt; P.y += P.vy * dt;
      const des = K.RUN * K.AIRCTL; const wx = mx * des, wz = mz * des; P.vx += clamp(wx - P.vx, -K.ACC * 0.3 * dt, K.ACC * 0.3 * dt) * (Math.abs(wx) > 0 ? 1 : 0); P.vz += clamp(wz - P.vz, -K.ACC * 0.3 * dt, K.ACC * 0.3 * dt) * (Math.abs(wz) > 0 ? 1 : 0);
      P.x += P.vx * dt; P.z += P.vz * dt;
      if (P.y <= 0 && P.vy < 0) { const sf = surfaceAt(W, P.x, P.z); if (sf && !(sf.crumble && false)) { P.y = 0; P.vy = 0; P.air = false; ev(W, { e: "land", id: P.id, x: P.x, z: P.z }); } else { P.air = false; P.fall = true; P.y = 0; ev(W, { e: "edge", id: P.id, x: P.x, z: P.z }); } }
      P.st = "air"; return;
    }
    const sf = surfaceAt(W, P.x, P.z);
    if (!sf) { P.fall = true; P.vy = 0; ev(W, { e: "edge", id: P.id, x: P.x, z: P.z }); P.st = "fall"; return; }
    if (!sf.slip && zoneAt(W, P.x, P.z, "slip")) sf.slip = true; if (!sf.mud && zoneAt(W, P.x, P.z, "mud")) sf.mud = true;
    P.slip = sf.slip; P.ground = true;
    if (sf.crumble) { const T = W.tiles[sf.i]; if (T.touch < 0) { T.touch = W.t; T.down = W.t + W.arena.surfaces[sf.i].delay; ev(W, { e: "crumble", i: sf.i }); } }
    const stunned = P.stun > 0, recov = P.rec > 0;
    // saut, un petit bond qui permet d'enjamber barres et adversaires, au prix d'un temps de recharge
    if (jEdge && P.jcd <= 0 && !stunned && !(P.dash > 0)) { P.air = true; P.vy = K.JUMP_V; P.y = 0.01; P.jcd = K.JUMP_CD; if (P.holding) { P.holding = false; P.chT = 0; P.ch = 0; P.cd = Math.max(P.cd, 0.25); } ev(W, { e: "jump", id: P.id, x: P.x, z: P.z }); P.st = "air"; return; }
    // visée et commandes
    if (ml > 0.12 && !P.dash) { const tx = mx / ml, tz = mz / ml; const a0 = Math.atan2(P.fz, P.fx), a1 = Math.atan2(tz, tx); let d = a1 - a0; while (d > Math.PI) d -= 2 * Math.PI; while (d < -Math.PI) d += 2 * Math.PI; const turn = clamp(d, -16 * dt, 16 * dt); const na = a0 + turn; P.fx = Math.cos(na); P.fz = Math.sin(na); }
    const hold = !!inp.h;
    if (!P.dash) {
      if (hold && !P.holding && P.cd <= 0 && !recov && !stunned) { P.holding = true; P.chT = 0; P.ch = 0; ev(W, { e: "chargeStart", id: P.id }); }
      if (P.holding) {
        if (stunned && P.stun > 0.3) { P.holding = false; P.ch = 0; P.cd = 0.4; ev(W, { e: "interrupt", id: P.id }); }
        else if (hold) { P.chT += dt; P.ch = clamp((P.chT - K.CH_MIN) / K.CH_SPAN, 0, 1); }
        else {
          P.holding = false;
          if (P.chT < K.CH_MIN) doPulse(W, P); else startDash(W, P, mx, mz, ml);
          P.chT = 0; P.ch = 0;
        }
      }
    }
    // vitesse voulue
    let cap = K.RUN * (sf.mud ? K.MUD : 1);
    if (P.holding) cap = K.CHG_SPD * (1 - 0.35 * P.ch); else if (recov) cap = K.RUN * K.REC_SPD; else if (stunned) cap *= 0.3;
    const acc = (sf.slip ? (ml > 0.05 ? K.ICE_ACC : 0.5) : K.ACC) * (stunned ? 0.3 : 1), damp = sf.slip ? K.ICE_DAMP : K.DAMP;
    if (P.dash > 0) {
      // charge, on peut infléchir un peu la trajectoire
      if (ml > 0.2) { const a0 = Math.atan2(P.dz, P.dx), a1 = Math.atan2(mz, mx); let d = a1 - a0; while (d > Math.PI) d -= 2 * Math.PI; while (d < -Math.PI) d += 2 * Math.PI; const na = a0 + clamp(d, -K.STEER * dt, K.STEER * dt); P.dx = Math.cos(na); P.dz = Math.sin(na); }
      P.dash -= dt; const u = P.dashLen > 0 ? P.dash / P.dashLen : 0; const sp = P.ds * (u > 0.3 ? 1 : 0.55 + 0.45 * (u / 0.3));
      P.vx = P.dx * sp; P.vz = P.dz * sp; P.fx = P.dx; P.fz = P.dz;
      if (P.dash <= 0) { P.dash = 0; const keep = Math.min(P.ds, 8.5); P.vx = P.dx * keep; P.vz = P.dz * keep; endDash(W, P); }
    } else {
      // vitesse au dessus du plafond, elle est freinée par la friction seulement
      let sp = len(P.vx, P.vz), exx = 0, exz = 0; const capEx = P.slide > 0 ? 0 : cap;
      if (sp > capEx) { const k = (sp - capEx) / sp; exx = P.vx * k; exz = P.vz * k; }
      let bx = P.vx - exx, bz = P.vz - exz;
      const tx = mx * cap, tz = mz * cap; let dx = tx - bx, dz = tz - bz; const dl = len(dx, dz), mxA = acc * dt;
      if (dl > mxA) { dx = dx / dl * mxA; dz = dz / dl * mxA; }
      bx += dx; bz += dz;
      const f = Math.exp(-damp * dt); exx *= f; exz *= f;
      if (ml < 0.05 && !sf.slip && P.slide <= 0) { const fb = Math.exp(-7 * dt); bx *= fb; bz *= fb; }
      P.vx = bx + exx; P.vz = bz + exz;
    }
    // vent
    const wd = windAt(W, P.x, P.z); if (wd.ax || wd.az) { P.vx += wd.ax * dt; P.vz += wd.az * dt; }
    // déplacement, le sol mobile emporte le joueur
    P.x += (P.vx + sf.vx) * dt; P.z += (P.vz + sf.vz) * dt;
    // ressorts
    if (P.springCd <= 0) { const sp = zoneAt(W, P.x, P.z, "spring"); if (sp) { P.air = true; P.vy = K.SPRING_V * (sp.pow || 1); P.y = 0.01; P.springCd = 0.6; P.holding = false; P.dash = 0; P.ch = 0; ev(W, { e: "spring", id: P.id, x: P.x, z: P.z }); } }
    P.st = P.dash > 0 ? "dash" : P.holding ? "charge" : recov ? "rec" : stunned ? "stun" : "ok";
  }
  function koBy(W, P) { const h = P.lastHit; return h && W.t - h.t < K.HIT_MEMORY ? h.id : null; }

  function startDash(W, P, mx, mz, ml) {
    const c = P.ch; let dx, dz;
    if (ml > 0.2) { dx = mx / ml; dz = mz / ml; } else { dx = P.fx; dz = P.fz; }
    P.dx = dx; P.dz = dz; P.ds = K.DASH_V0 + K.DASH_V1 * c; P.dashLen = K.DASH_T0 + K.DASH_T1 * c; P.dash = P.dashLen; P.dpow = c; P.dhit = false;
    P.vx = dx * P.ds; P.vz = dz * P.ds; P.fx = dx; P.fz = dz;
    ev(W, { e: "dash", id: P.id, x: P.x, z: P.z, c, dx, dz });
  }
  function endDash(W, P) {
    if (P.dhit) { P.rec = K.REC_HIT; P.cd = K.CD_HIT; } else { P.rec = K.REC_MISS0 + K.REC_MISS1 * P.dpow; P.cd = K.CD_MISS; ev(W, { e: "miss", id: P.id, x: P.x, z: P.z, long: P.dpow }); }
    P.dpow = 0;
  }
  function doPulse(W, P) {
    let any = false;
    for (const Q of W.players) {
      if (Q === P || !Q.alive || Q.inv > 0 || Q.fall || (Q.team && Q.team === P.team && !W.friendly)) continue;
      const dx = Q.x - P.x, dz = Q.z - P.z, d = len(dx, dz); if (d > K.PULSE_R || d < 0.001) continue;
      if ((dx * P.fx + dz * P.fz) / d < K.PULSE_COS) continue;
      const nx = dx / d, nz = dz / d; let f = K.PULSE_F * (1 + 0.3 * (1 - d / K.PULSE_R));
      if (Q.rec > 0) f *= K.RECV; if (Q.holding) f *= K.BRACE;
      Q.vx += nx * f; Q.vz += nz * f; Q.slide = 0.6; capV(Q, K.VCAP); Q.lastHit = { id: P.id, t: W.t }; Q.stun = Math.max(Q.stun, 0.12); any = true;
      ev(W, { e: "hit", x: (P.x + Q.x) / 2, z: (P.z + Q.z) / 2, p: 0.25, a: P.id, b: Q.id, nx, nz });
    }
    P.vx -= P.fx * 1.0; P.vz -= P.fz * 1.0;
    P.cd = K.PULSE_CD; if (!any) P.rec = K.PULSE_MISS;
    ev(W, { e: "pulse", id: P.id, x: P.x, z: P.z, hit: any, fx: P.fx, fz: P.fz });
  }
  function capV(P, c) { const s = len(P.vx, P.vz); if (s > c) { P.vx *= c / s; P.vz *= c / s; } }

  // ---------- obstacles ----------
  function collideObstacles(W, P) {
    if (!P.alive || P.fall || P.y > 0.9) return;
    const A = W.arena, t = W.t;
    for (const b of A.bars) {
      const sg = barSeg(b, t); const sx = sg.x1 - sg.x0, sz = sg.z1 - sg.z0, l2 = sx * sx + sz * sz;
      let u = ((P.x - sg.x0) * sx + (P.z - sg.z0) * sz) / l2; u = clamp(u, 0, 1);
      const qx = sg.x0 + sx * u, qz = sg.z0 + sz * u; let dx = P.x - qx, dz = P.z - qz; let d = len(dx, dz); const rr = RAD + (b.th || 0.3);
      if (d >= rr) continue; if (d < 1e-4) { dx = -sg.s; dz = sg.c; d = 1; }
      const nx = dx / d, nz = dz / d; P.x += nx * (rr - d); P.z += nz * (rr - d);
      // vitesse du point touché
      const wv = b.w * dramp(t); const rx = qx - b.x, rz = qz - b.z; const bvx = -wv * rz, bvz = wv * rx;
      const rvx = P.vx - bvx, rvz = P.vz - bvz; const vn = rvx * nx + rvz * nz;
      if (vn < 0) { P.vx -= (1 + 0.3) * vn * nx; P.vz -= (1 + 0.3) * vn * nz; }
      const push = 3.2 + Math.min(5, Math.abs(wv) * len(rx, rz) * 0.7); P.vx += nx * push * 0.35; P.vz += nz * push * 0.35;
      P.slide = 0.6; if (P.dash > 0) P.dash = 0; capV(P, K.VCAP_BAR); P.stun = Math.max(P.stun, 0.18); P.lastHit = null; ev(W, { e: "bar", x: qx, z: qz, id: P.id, p: 0.6 });
    }
    for (const o of A.sliders) {
      const bx = sliderBox(o, t), bx2 = sliderBox(o, t + 0.02); const ovx = (bx2.x - bx.x) / 0.02, ovz = (bx2.z - bx.z) / 0.02;
      const cx = clamp(P.x, bx.x - bx.hw, bx.x + bx.hw), cz = clamp(P.z, bx.z - bx.hd, bx.z + bx.hd);
      let dx = P.x - cx, dz = P.z - cz, d = len(dx, dz);
      if (d >= RAD) continue;
      let nx, nz, pen;
      if (d < 1e-4) { const ex = bx.hw - Math.abs(P.x - bx.x), ez = bx.hd - Math.abs(P.z - bx.z); if (ex < ez) { nx = Math.sign(P.x - bx.x) || 1; nz = 0; pen = ex + RAD; } else { nx = 0; nz = Math.sign(P.z - bx.z) || 1; pen = ez + RAD; } }
      else { nx = dx / d; nz = dz / d; pen = RAD - d; }
      P.x += nx * pen; P.z += nz * pen;
      const rvx = P.vx - ovx, rvz = P.vz - ovz; const vn = rvx * nx + rvz * nz;
      if (vn < 0) { P.vx -= 1.4 * vn * nx; P.vz -= 1.4 * vn * nz; }
      const os = len(ovx, ovz); if (os > 0.5) { P.slide = 0.6; P.vx += ovx * 0.9; P.vz += ovz * 0.9; P.stun = Math.max(P.stun, 0.25); if (P.dash > 0) P.dash = 0; ev(W, { e: "bar", x: cx, z: cz, id: P.id, p: Math.min(1, os / 10) }); }
      capV(P, K.VCAP_BAR + 3);
    }
    for (const g of A.pegs) {
      let dx = P.x - g.x, dz = P.z - g.z, d = len(dx, dz); const rr = RAD + g.r; if (d >= rr) continue; if (d < 1e-4) { dx = 1; dz = 0; d = 1; }
      const nx = dx / d, nz = dz / d; P.x += nx * (rr - d); P.z += nz * (rr - d); const vn = P.vx * nx + P.vz * nz;
      if (vn < 0) { const e = g.bounce || 0.3; P.vx -= (1 + e) * vn * nx; P.vz -= (1 + e) * vn * nz; if (g.bounce) { P.slide = 0.6; const s = len(P.vx, P.vz); if (s < 7) { P.vx += nx * (7 - s); P.vz += nz * (7 - s); } P.stun = Math.max(P.stun, 0.1); ev(W, { e: "bump", x: g.x, z: g.z, id: P.id, i: g.i }); } if (P.dash > 0 && g.bounce) P.dash = 0; }
      capV(P, K.VCAP);
    }
  }

  // ---------- joueurs entre eux ----------
  function collidePlayers(W) {
    const L = W.players;
    for (let i = 0; i < L.length; i++) {
      const A = L[i]; if (!A.alive || A.fall && A.y < -1) continue;
      for (let j = i + 1; j < L.length; j++) {
        const B = L[j]; if (!B.alive || B.fall && B.y < -1) continue;
        if (A.inv > 0 || B.inv > 0) continue;
        if (Math.abs(A.y - B.y) > 0.9) continue;
        let dx = A.x - B.x, dz = A.z - B.z; let d = len(dx, dz); const D = RAD * 2;
        if (d >= D) continue; if (d < 1e-4) { dx = 1; dz = 0; d = 1; }
        const nx = dx / d, nz = dz / d; const pen = D - d; A.x += nx * pen / 2; A.z += nz * pen / 2; B.x -= nx * pen / 2; B.z -= nz * pen / 2;
        const friend = A.team && A.team === B.team && !W.friendly;
        const vn = (A.vx - B.vx) * nx + (A.vz - B.vz) * nz; // négatif si on se rapproche
        if (vn >= 0) continue;
        let J = -(1 + K.E) * vn / 2;
        // un coup de charge donne un bonus de poussée à celui qui frappe de face
        let bonusA = 0, bonusB = 0, hitA = false, hitB = false;
        if (!friend) {
          // A frappe B s'il fonce dans la direction de B
          const aTo = A.dash > 0 ? -(A.dx * nx + A.dz * nz) : 0, bTo = B.dash > 0 ? (B.dx * nx + B.dz * nz) : 0;
          if (A.dash > 0 && aTo > 0.35) { bonusB = (K.BONUS0 + K.BONUS1 * A.dpow) * aTo; hitA = true; }
          if (B.dash > 0 && bTo > 0.35) { bonusA = (K.BONUS0 + K.BONUS1 * B.dpow) * bTo; hitB = true; }
          if (hitA && hitB) { const df = (A.dpow + 0.1) - (B.dpow + 0.1); bonusB *= clamp(0.5 + df, 0.15, 1.2); bonusA *= clamp(0.5 - df, 0.15, 1.2); J *= 0.8; }
        }
        let mA = 1, mB = 1;
        if (A.rec > 0) mA *= K.RECV; if (B.rec > 0) mB *= K.RECV; if (A.holding) mA *= K.BRACE; if (B.holding) mB *= K.BRACE;
        const jA = J * mA + bonusA * mA, jB = J * mB + bonusB * mB;
        A.vx += nx * jA; A.vz += nz * jA; B.vx -= nx * jB; B.vz -= nz * jB; A.slide = 0.6; B.slide = 0.6;
        // celui qui frappe perd de l'élan
        if (hitA && !friend) { A.vx *= 0.7; A.vz *= 0.7; A.dhit = true; B.stun = Math.max(B.stun, 0.12 + K.STUN_K * bonusB * 8); B.lastHit = { id: A.id, t: W.t }; }
        if (hitB && !friend) { B.vx *= 0.7; B.vz *= 0.7; B.dhit = true; A.stun = Math.max(A.stun, 0.12 + K.STUN_K * bonusA * 8); A.lastHit = { id: B.id, t: W.t }; }
        if (!hitA && !hitB && !friend) { const ra = len(A.vx, A.vz), rb = len(B.vx, B.vz); if (ra > rb + 1) B.lastHit = { id: A.id, t: W.t }; else if (rb > ra + 1) A.lastHit = { id: B.id, t: W.t }; }
        // un joueur qui encaisse en chargeant voit sa charge interrompue par un gros choc
        [A, B].forEach((P) => { if (P.holding && P.stun > 0.3) { P.holding = false; P.ch = 0; P.cd = 0.4; } if (P.dash > 0 && P.stun > 0.25 && !(P === A ? hitA : hitB)) P.dash = 0; });
        capV(A, K.VCAP); capV(B, K.VCAP);
        const power = Math.min(1, (J + Math.max(bonusA, bonusB)) / 14);
        ev(W, { e: "hit", x: (A.x + B.x) / 2, z: (A.z + B.z) / 2, p: power, a: hitA ? A.id : hitB ? B.id : null, b: hitA ? B.id : hitB ? A.id : null, nx, nz });
      }
    }
  }

  // ---------- un pas de monde complet ----------
  function stepWorld(W, inputs) {
    W.t += DT; W.tick++; prepare(W);
    for (const P of W.players) stepPlayer(W, P, inputs ? inputs[P.id] : null);
    for (const P of W.players) collideObstacles(W, P);
    collidePlayers(W); collidePlayers(W);
    for (const P of W.players) collideObstacles(W, P);
  }
  function drain(W) { const e = W.events; W.events = []; return e; }

  return { DT, RAD, K, clamp, len, ramp, dramp, newPlayer, makeWorld, prepare, stepPlayer, stepWorld, surfaceAt, zoneAt, windAt, windState, surfState, sliderBox, sliderPos, barSeg, barAngle, zonePos, clipRadius, tileOn, drain, doPulse };
});

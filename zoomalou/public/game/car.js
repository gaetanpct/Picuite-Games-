// ============================================================
// ZOOMALOU — Voitures et physique (partagée serveur et client)
// Pas fixe de 1/60 s, entièrement déterministe. Le serveur rejoue les commandes d'un pilote
// pour vérifier son temps.
// ============================================================
(function (root, factory) {
  if (typeof module !== "undefined" && module.exports) module.exports = factory(require("./track.js"));
  else root.ZoomCar = factory(root.ZoomTrack);
})(typeof window !== "undefined" ? window : globalThis, function (Track) {
  const DT = 1 / 60;
  const S = Track.SURF;

  // vmax en m/s, acc en m/s2, turn vitesse de rotation maximale en rad/s, grip adhérence latérale en 1/s
  const CARS = {
    bolide: { id: "bolide", name: "Bolide", icon: "🏎️", color: "#e8453c", vmax: 50, acc: 21, brake: 36, turn: 2.2, grip: 7.6, dirt: 0.7, ice: 0.18, drift: 0.5, bounce: 0, desc: "La voiture équilibrée. Rapide, stable et facile à prendre en main." },
    rallye: { id: "rallye", name: "Rallye-Pote", icon: "🚙", color: "#3aa653", vmax: 44, acc: 19, brake: 34, turn: 2.1, grip: 6.4, dirt: 0.98, ice: 0.5, drift: 0.5, bounce: 0, desc: "Adore la terre et la glace où elle tient la route, mais un peu moins vive sur le bitume." },
    petard: { id: "petard", name: "Pétard", icon: "🚀", color: "#f08a24", vmax: 60, acc: 26, brake: 32, turn: 1.7, grip: 6.6, dirt: 0.55, ice: 0.12, drift: 0.4, bounce: 0, desc: "Une fusée sur roues. Vitesse folle, mais il faut anticiper les virages." },
    toupie: { id: "toupie", name: "Toupie", icon: "🌀", color: "#8a55c8", vmax: 46, acc: 19.5, brake: 34, turn: 2.8, grip: 4.3, dirt: 0.8, ice: 0.3, drift: 1.0, bounce: 0, desc: "Elle glisse et adore ça. En dérapage prolongé elle gagne un gros turbo à la sortie." },
    bouboule: { id: "bouboule", name: "Bouboule", icon: "🫧", color: "#25b9b0", vmax: 42, acc: 18, brake: 33, turn: 2.4, grip: 7.0, dirt: 0.85, ice: 0.35, drift: 0.5, bounce: 0.35, desc: "Ronde et rebondissante. Les chocs avec les murs la ralentissent à peine." },
  };
  const CAR_ORDER = ["bolide", "rallye", "petard", "toupie", "bouboule"];
  const HALF_W = 1.05;
  const BOOST_TICKS = 70;

  const wrap = (a) => { while (a > Math.PI) a -= 2 * Math.PI; while (a < -Math.PI) a += 2 * Math.PI; return a; };

  // projection d'un point sur la ligne centrale, autour d'un indice connu
  function project(tr, x, z, hint, back, fwd) {
    const n = tr.n; let lo = Math.max(0, Math.floor(hint) - (back == null ? 8 : back)), hi = Math.min(n - 2, Math.floor(hint) + (fwd == null ? 14 : fwd));
    let best = 1e18, bi = lo, bt = 0;
    for (let i = lo; i <= hi; i++) {
      const ax = tr.x[i], az = tr.z[i], bx = tr.x[i + 1] - ax, bz = tr.z[i + 1] - az; const l2 = bx * bx + bz * bz;
      let t = ((x - ax) * bx + (z - az) * bz) / l2; t = t < 0 ? 0 : t > 1 ? 1 : t;
      const dx = x - (ax + bx * t), dz = z - (az + bz * t); const d = dx * dx + dz * dz; if (d < best) { best = d; bi = i; bt = t; }
    }
    return { idx: bi + bt, i: bi, t: bt };
  }
  function sampleAt(tr, idx) {
    let i = Math.floor(idx); if (i < 0) i = 0; if (i > tr.n - 2) i = tr.n - 2; const t = Math.min(1, Math.max(0, idx - i));
    const hd = tr.h[i] + wrap(tr.h[i + 1] - tr.h[i]) * t;
    return { x: tr.x[i] + (tr.x[i + 1] - tr.x[i]) * t, z: tr.z[i] + (tr.z[i + 1] - tr.z[i]) * t, y: tr.y[i] + (tr.y[i + 1] - tr.y[i]) * t, h: hd, w: tr.w[i] + (tr.w[i + 1] - tr.w[i]) * t, surf: tr.surf[t < 0.5 ? i : i + 1], flags: tr.flags[i], slope: (tr.y[i + 1] - tr.y[i]) / (tr.step), solid: !((tr.flags[i] | tr.flags[i + 1]) & Track.FLAG.GAP) };
  }

  function newRun(tr, carId, opts) {
    const car = CARS[carId] || CARS.bolide; const st = tr.start; const slot = (opts && opts.slot) || 0;
    const r = {
      tr, car, tick: 0, x: st.x - Math.cos(st.h) * slot, z: st.z + Math.sin(st.h) * slot, slot, y: st.y, hd: st.h, vx: 0, vz: 0, vy: 0, air: false, idx: st.idx, prevIdx: st.idx, cp: 0, cpIdx: st.idx, cpHd: st.h,
      finished: false, finishTime: 0, boostT: 0, driftT: 0, resets: 0, hits: 0, climb: 0, steerV: 0, pitch: 0, roll: 0, lastResetTick: -999, maxSpeed: 0, onSurf: 0, wallHit: 0, landed: 0, boostEvt: 0,
      rail: false, mag: -1, ux: 0, uz: 0, wasSolid: true, spin: 0,
      opts: opts || {},
    };
    r.y = sampleAt(tr, r.idx).y; return r;
  }
  // place sur la ligne de départ, de la gauche vers la droite de la route, pour n pilotes
  function gridSlot(tr, i, n) {
    if (n <= 1) return 0; const half = tr.w[tr.start.idx] - 1.5; const sp = Math.min(2.8, (2 * half) / (n - 1)); return (i - (n - 1) / 2) * sp;
  }
  // choc venu d'un autre pilote, appliqué avant le pas suivant. Enregistré dans la course pour que le serveur puisse la rejouer
  // dspin est une vitesse de rotation ajoutée, en rad/s, qui s'éteint toute seule. Un choc de côté ou à l'arrière fait déraper et tourner la voiture
  function nudge(r, dx, dz, dvx, dvz, dspin) { if (r.rail) return; r.x += dx; r.z += dz; r.vx += dvx; r.vz += dvz; if (dspin) r.spin = Math.max(-9, Math.min(9, (r.spin || 0) + dspin)); }

  function resetToCheckpoint(r) {
    const tr = r.tr, s = sampleAt(tr, r.cpIdx);
    r.x = s.x; r.z = s.z; r.y = s.y; r.hd = s.h; r.vx = 0; r.vz = 0; r.vy = 0; r.air = false; r.idx = r.cpIdx; r.prevIdx = r.cpIdx; r.boostT = 0; r.driftT = 0; r.climb = 0; r.resets++; r.lastResetTick = r.tick; r.rail = false; r.mag = -1; r.wasSolid = true; r.pitch = 0;
  }

  const OBS_CAR = 1.1; // rayon d'une voiture pour les obstacles
  const STEP = Track.STEP;
  const airGOf = (tr) => tr.airG || tr.gravity * Track.AIRK;
  // entrée dans une zone sans gravité. L'état de la voiture passe dans le repère déroulé de la route
  // px = moins le décalage latéral, pz = distance parcourue. Le cap hd devient le cap relatif à la route
  function enterMag(r) {
    const tr = r.tr; const L = tr.mags;
    for (let k = 0; k < L.length; k++) {
      const mg = L[k]; let dir = 0;
      if (r.prevIdx < mg.a && r.idx >= mg.a) dir = 1; else if (r.prevIdx > mg.b && r.idx <= mg.b) dir = -1; if (!dir) continue;
      const ps = sampleAt(tr, r.idx); const rrx = -Math.cos(ps.h), rrz = Math.sin(ps.h); let u = (r.x - ps.x) * rrx + (r.z - ps.z) * rrz; const lim = mg.w || (ps.w - HALF_W); u = Math.max(-lim, Math.min(lim, u));
      const tx = Math.sin(ps.h), tz = Math.cos(ps.h); const va = r.vx * tx + r.vz * tz, vr = r.vx * rrx + r.vz * rrz;
      r.rail = true; r.mag = k; r.ux = -u; r.uz = r.idx * STEP; r.vx = -vr; r.vz = va; r.hd = wrap(r.hd - ps.h); r.air = false; r.climb = 0; r.vy = 0; r.wasSolid = true;
      railPose(r); return true;
    }
    return false;
  }
  function railPose(r) {
    const tr = r.tr, mg = tr.mags[r.mag]; const fr = Track.frameAt(tr, mg, r.idx); const u = -r.ux;
    r.x = fr.px + fr.rx * u; r.y = fr.py + fr.ry * u; r.z = fr.pz + fr.rz * u; r.pitch = 0;
  }
  function leaveMag(r) {
    const tr = r.tr; const ps = sampleAt(tr, r.idx); const rrx = -Math.cos(ps.h), rrz = Math.sin(ps.h); const tx = Math.sin(ps.h), tz = Math.cos(ps.h);
    const va = r.vz, vr = -r.vx; const u = -r.ux;
    r.vx = va * tx + vr * rrx; r.vz = va * tz + vr * rrz; r.hd = ps.h + r.hd; r.x = ps.x + rrx * u; r.z = ps.z + rrz * u; r.y = ps.y;
    r.rail = false; r.mag = -1; r.air = false; r.climb = 0; r.vy = 0; r.prevIdx = r.idx; r.pitch = Math.atan(ps.slope); r.wasSolid = true;
  }
  // progression sur le circuit, commune au sol et aux zones sans gravité
  function progress(r) {
    const tr = r.tr; const nextCp = tr.cps[r.cp];
    if (nextCp !== undefined && r.prevIdx < nextCp && r.idx >= nextCp) { r.cp++; r.cpIdx = nextCp; r.cpHd = sampleAt(tr, nextCp).h; r.cpEvt = r.tick; }
    const F = tr.n - 3;
    if (r.cp >= tr.cps.length && r.prevIdx < F && r.idx >= F) {
      const frac = (F - r.prevIdx) / Math.max(1e-6, r.idx - r.prevIdx); r.finished = true; r.finishTime = (r.tick - 1 + Math.min(1, Math.max(0, frac))) * DT;
    }
  }
  // choc contre un obstacle fixe. Un cercle pour chaque obstacle
  function collideObs(r, tr) {
    const bk = Track.obsBuckets(tr); const car = r.car; const b0 = Math.floor(r.idx / 6);
    for (let b = b0 - 1; b <= b0 + 1; b++) {
      const l = bk.get(b); if (!l) continue;
      for (let q = 0; q < l.length; q++) {
        const o = l[q]; if (r.air && r.y > o.y + o.h) continue;
        const dx = r.x - o.x, dz = r.z - o.z, R = o.r + OBS_CAR, d2 = dx * dx + dz * dz; if (d2 >= R * R) continue;
        const d = Math.sqrt(d2) || 1e-4, nx = dx / d, nz = dz / d; r.x = o.x + nx * R; r.z = o.z + nz * R;
        const vn = r.vx * nx + r.vz * nz;
        if (vn < 0) { const rest = 0.2 + car.bounce; r.vx -= (1 + rest) * vn * nx; r.vz -= (1 + rest) * vn * nz; const hit = -vn; const keep = 1 - Math.min(0.4, hit * 0.022) * (1 - car.bounce * 0.8); r.vx *= keep; r.vz *= keep; r.hits++; if (hit > r.wallHit) r.wallHit = hit; }
      }
    }
  }

  // commande = { steer -1..1 (positif = droite), thr 0|1, brk 0|1, rst 0|1 }
  // dans une zone sans gravité (rail), la voiture roule dans le repère déroulé de la route avec la même dynamique qu'au sol
  function stepRail(r, inp) {
    const tr = r.tr, car = r.car, mg = tr.mags[r.mag];
    const fx = Math.sin(r.hd), fz = Math.cos(r.hd), rx = -Math.cos(r.hd), rz = Math.sin(r.hd);
    let vf = r.vx * fx + r.vz * fz, vl = r.vx * rx + r.vz * rz; let vmax = car.vmax, accMul = 1;
    r.steerV += (inp.steer - r.steerV) * Math.min(1, DT * 14); const st = r.steerV;
    const sgnV = vf >= 0 ? 1 : -1; const sf = Math.min(1, Math.abs(vf) / 6); const fall = 1 / (1 + Math.pow(Math.abs(vf) / (car.vmax * 0.68), 1.6) * 0.85);
    r.hd += -st * car.turn * sf * fall * sgnV * DT;
    if (r.boostT > 0) { vmax *= 1.3; accMul += 1.1; r.boostT--; }
    if (inp.thr) { const k = 1 - Math.pow(Math.max(0, vf) / vmax, 2); vf += car.acc * accMul * Math.max(0, k) * DT; if (vf > vmax) vf -= (vf - vmax) * Math.min(1, DT * 2); }
    if (inp.brk) { if (vf > 0.4) vf = Math.max(0, vf - car.brake * DT); else vf = Math.max(-12, vf - car.acc * 0.55 * DT); }
    if (!inp.thr && !inp.brk) vf -= Math.sign(vf) * Math.min(Math.abs(vf), 2.6 * DT);
    if (!inp.thr && vf > vmax) vf -= (vf - vmax) * Math.min(1, DT * 1.5);
    const k2 = Math.exp(-car.grip * DT); const loss = Math.abs(vl) * (1 - k2); vl *= k2; vf -= Math.sign(vf) * loss * 0.12;
    if (Math.abs(vl) > 0.22 * Math.max(8, Math.abs(vf)) && Math.abs(vf) > 17) r.driftT++;
    else { if (r.driftT > 42) { r.boostT = Math.max(r.boostT, Math.round(BOOST_TICKS * Math.min(1.2, 0.5 + r.driftT / 130) * car.drift)); r.boostEvt = r.tick; } r.driftT = 0; }
    r.vx = fx * vf + rx * vl; r.vz = fz * vf + rz * vl;
    { const nfx = Math.sin(r.hd), nfz = Math.cos(r.hd); const vf2 = r.vx * nfx + r.vz * nfz, vl2 = r.vx * -Math.cos(r.hd) + r.vz * Math.sin(r.hd); r.vx = nfx * vf2 + -Math.cos(r.hd) * vl2; r.vz = nfz * vf2 + Math.sin(r.hd) * vl2; }
    r.ux += r.vx * DT; r.uz += r.vz * DT; r.prevIdx = r.idx; r.idx = r.uz / STEP;
    // murs latéraux. Dans le repère déroulé la droite de la route est -x
    const i0 = Math.max(0, Math.min(tr.n - 2, Math.floor(r.idx))); const wv = tr.w[i0] + (tr.w[i0 + 1] - tr.w[i0]) * (r.idx - i0); const lim = wv - HALF_W;
    r.wallHit = 0; let u = -r.ux;
    if (Math.abs(u) > lim) {
      const sg = u > 0 ? 1 : -1; const push = u - sg * lim; r.ux += sg * push; const vn = -r.vx;
      if (vn * sg > 0) { const rest = 0.22 + car.bounce; const hit = Math.abs(vn); r.vx += (1 + rest) * vn; const keep = 1 - Math.min(0.2, hit * 0.012) * (1 - car.bounce); r.vx *= keep; r.vz *= keep; r.hits++; r.wallHit = hit; }
      r.hd += wrap(0 - r.hd) * 0.05; r.vx *= 0.995; r.vz *= 0.995;
    }
    r.onSurf = 0; r.air = false; r.landed = 0;
    const spd = Math.hypot(r.vx, r.vz); if (spd > r.maxSpeed) r.maxSpeed = spd;
    if (r.idx >= mg.b) { leaveMag(r); progress(r); return; }
    if (r.idx <= mg.a && r.vz < 0) { leaveMag(r); progress(r); return; }
    railPose(r); progress(r);
  }

  function step(r, inp) {
    if (r.finished) return;
    const tr = r.tr, car = r.car, g = tr.gravity, gAir = airGOf(tr);
    r.tick++;
    if (inp.rst && r.tick - r.lastResetTick > 30) { resetToCheckpoint(r); return; }
    if (r.rail) { stepRail(r, inp); return; }
    const fx = Math.sin(r.hd), fz = Math.cos(r.hd), rx = -Math.cos(r.hd), rz = Math.sin(r.hd);
    let vf = r.vx * fx + r.vz * fz, vl = r.vx * rx + r.vz * rz;
    const sp = sampleAt(tr, r.idx); const surf = r.air ? S.ASPHALT : sp.surf; r.onSurf = surf;
    let gripMul = 1, vmax = car.vmax, accMul = 1, drag = 0.0;
    if (surf === S.DIRT) { gripMul = car.dirt; vmax *= 0.93; drag = 0.35; }
    else if (surf === S.ICE) { gripMul = car.ice; drag = 0.05; }
    else if (surf === S.SLOW) { gripMul = 0.9; vmax *= 0.62; accMul = 0.75; drag = 1.1; }
    // direction
    const target = inp.steer; r.steerV += (target - r.steerV) * Math.min(1, DT * 14); const st = r.steerV;
    const sgnV = vf >= 0 ? 1 : -1; const sf = Math.min(1, Math.abs(vf) / 6);
    const fall = 1 / (1 + Math.pow(Math.abs(vf) / (car.vmax * 0.68), 1.6) * 0.85);
    let yaw = -st * car.turn * sf * fall * sgnV; if (r.air) yaw *= 0.35; r.hd += yaw * DT;
    if (r.spin) { r.hd += r.spin * DT; r.spin *= 0.9; if (Math.abs(r.spin) < 0.03) r.spin = 0; }
    // accélération
    const boosted = r.boostT > 0; if (boosted) { vmax *= 1.3; accMul += 1.1; r.boostT--; }
    if (!r.air) {
      if (inp.thr) { const k = 1 - Math.pow(Math.max(0, vf) / vmax, 2); vf += car.acc * accMul * Math.max(0, k) * DT; if (vf > vmax) vf -= (vf - vmax) * Math.min(1, DT * 2); }
      if (inp.brk) { if (vf > 0.4) vf = Math.max(0, vf - car.brake * DT); else vf = Math.max(-12, vf - car.acc * 0.55 * DT); }
      if (!inp.thr && !inp.brk) vf -= Math.sign(vf) * Math.min(Math.abs(vf), 2.6 * DT);
      vf -= vf * drag * DT; vf -= g * sp.slope * 0.8 * DT;
      if (!inp.thr && vf > vmax) vf -= (vf - vmax) * Math.min(1, DT * 1.5);
      // adhérence
      const grip = car.grip * gripMul; const k = Math.exp(-grip * DT); const loss = Math.abs(vl) * (1 - k); vl *= k; vf -= Math.sign(vf) * loss * 0.12;
      // dérapage maintenu, mini turbo à la sortie
      if (Math.abs(vl) > 0.22 * Math.max(8, Math.abs(vf)) && Math.abs(vf) > 17 && surf !== S.ICE) r.driftT++;
      else { if (r.driftT > 42) { r.boostT = Math.max(r.boostT, Math.round(BOOST_TICKS * Math.min(1.2, 0.5 + r.driftT / 130) * car.drift)); r.boostEvt = r.tick; } r.driftT = 0; }
    }
    r.vx = fx * vf + rx * vl; r.vz = fz * vf + rz * vl;
    // la direction a pu tourner, on recalcule l'avant pour que la vitesse suive le cap
    const nfx = Math.sin(r.hd), nfz = Math.cos(r.hd);
    { const vf2 = r.vx * nfx + r.vz * nfz, vl2 = r.vx * -Math.cos(r.hd) + r.vz * Math.sin(r.hd); const mix = r.air ? 0 : 1; // en l'air la vitesse ne tourne pas
      if (mix) { r.vx = nfx * vf2 + -Math.cos(r.hd) * vl2; r.vz = nfz * vf2 + Math.sin(r.hd) * vl2; } }
    const ox = r.x, oz = r.z;
    r.x += r.vx * DT; r.z += r.vz * DT;
    // position sur le circuit
    const pj = project(tr, r.x, r.z, r.idx); r.prevIdx = r.idx; r.idx = pj.idx;
    if (tr.mags && tr.mags.length && enterMag(r)) { progress(r); return; }
    const ps = sampleAt(tr, r.idx);
    const rrx = -Math.cos(ps.h), rrz = Math.sin(ps.h); let u = (r.x - ps.x) * rrx + (r.z - ps.z) * rrz;
    const lim = ps.w - HALF_W; const nowall = !!(ps.flags & Track.FLAG.NOWALL);
    r.wallHit = 0;
    if (!nowall && Math.abs(u) > lim) {
      const sg = u > 0 ? 1 : -1; const push = u - sg * lim; r.x -= rrx * push; r.z -= rrz * push;
      const vn = r.vx * rrx + r.vz * rrz;
      if (vn * sg > 0) {
        const rest = 0.22 + car.bounce; const hit = Math.abs(vn);
        r.vx -= (1 + rest) * vn * rrx; r.vz -= (1 + rest) * vn * rrz;
        const keep = 1 - Math.min(0.2, hit * 0.012) * (1 - car.bounce); r.vx *= keep; r.vz *= keep; r.hits++; r.wallHit = hit;
      }
      // le cap se redresse un peu le long du mur
      r.hd += wrap(ps.h - r.hd) * 0.05; r.vx *= 0.995; r.vz *= 0.995;
      u = sg * lim;
    }
    if (tr.obs && tr.obs.length) collideObs(r, tr);
    // tremplin. Au bout de la rampe la voiture décolle toujours avec la même vitesse verticale, c'est ce qui rend les sauts calculables
    if (!r.air && tr.kicks && tr.kicks.length && Math.hypot(r.vx, r.vz) > 3) {
      for (let q = 0; q < tr.kicks.length; q++) { const kk = tr.kicks[q]; if (r.prevIdx < kk.i && r.idx >= kk.i) { r.air = true; r.vy = kk.vy; r.climb = 0; r.y = Math.max(r.y, ps.y) + 0.02; r.kickEvt = r.tick; break; } }
    }
    // hauteur et envol
    const offroad = nowall && Math.abs(u) > ps.w + 0.2; let solid = ps.solid && !offroad; const gy = solid ? ps.y : -1e9;
    if (!r.air) {
      const freeY = r.y + r.climb * DT - 0.5 * gAir * DT * DT;
      if (!solid || (gy < freeY - 0.012 && Math.hypot(r.vx, r.vz) > 6)) { r.air = true; r.vy = r.climb - gAir * DT; r.y = freeY; }
      else { r.climb = (gy - r.y) / DT; if (r.climb > 30) r.climb = 30; if (r.climb < -30) r.climb = -30; r.y = gy; }
    } else {
      r.vy -= gAir * DT; r.y += r.vy * DT;
      if (solid && !r.wasSolid && r.y < gy - 0.6) { // la voiture heurte le bord de la réception
        r.x = ox; r.z = oz; r.vx *= -0.15; r.vz *= -0.15; r.idx = r.prevIdx; r.hits++; r.wallHit = 8; solid = false;
      } else if (solid && r.y <= gy) {
        const impact = -r.vy; r.y = gy; r.air = false; r.landed = impact; r.climb = 0;
        const sf2 = 1 - Math.min(0.12, Math.max(0, impact - 3) * 0.012); r.vx *= sf2; r.vz *= sf2;
        if (car.bounce && impact > 4) { r.air = true; r.vy = impact * car.bounce; r.y = gy + 0.02; }
      }
    }
    r.wasSolid = solid;
    // pad turbo
    if (!r.air && (ps.flags & Track.FLAG.BOOST) && ps.surf === S.BOOST) { if (r.boostT < BOOST_TICKS) { r.boostT = BOOST_TICKS; r.boostEvt = r.tick; } }
    // chute dans le vide ou hors du pont, on revient au point de contrôle quand on touche le sol
    if (r.air && !solid && r.y < tr.groundY + 0.4) { resetToCheckpoint(r); return; }
    if (r.y < tr.groundY - 6) resetToCheckpoint(r);
    const spd = Math.hypot(r.vx, r.vz); if (spd > r.maxSpeed) r.maxSpeed = spd;
    // visuel
    r.pitch = Math.atan(ps.slope);
    progress(r);
  }

  // commandes compactées sur un octet par pas. bits 0 à 4 direction (0 à 30, 15 neutre), 5 gaz, 6 frein, 7 retour
  function packInput(inp) { const s = Math.max(0, Math.min(30, Math.round(inp.steer * 15) + 15)); return s | (inp.thr ? 32 : 0) | (inp.brk ? 64 : 0) | (inp.rst ? 128 : 0); }
  function unpackInput(b) { return { steer: ((b & 31) - 15) / 15, thr: (b & 32) ? 1 : 0, brk: (b & 64) ? 1 : 0, rst: (b & 128) ? 1 : 0 }; }
  const quant = (inp) => unpackInput(packInput(inp));

  // rejoue une série de commandes et renvoie la course. fuelTicks coupe les gaz au delà de ce pas (mode essence)
  function replay(tr, carId, bytes, fuelTicks, opts) {
    const r = newRun(tr, carId, opts); const n = bytes.length; const frames = []; const lim = fuelTicks == null ? 1e12 : fuelTicks;
    const ev = (opts && opts.events) || []; let ei = 0;
    for (let i = 0; i < n && !r.finished; i++) {
      while (ei < ev.length && ev[ei][0] <= i) { if (ev[ei][0] === i) nudge(r, ev[ei][1], ev[ei][2], ev[ei][3], ev[ei][4], ev[ei][5]); ei++; }
      const inp = unpackInput(bytes[i]); if (i >= lim) inp.thr = 0;
      step(r, inp); if (i % 6 === 0) frames.push(r.x, r.y, r.z, r.hd, r.pitch, r.rail ? 2 : r.air ? 1 : 0, r.boostT > 0 ? 1 : 0, r.idx);
    }
    frames.push(r.x, r.y, r.z, r.hd, r.pitch, 0, 0, r.idx);
    return { run: r, frames };
  }
  return { DT, CARS, CAR_ORDER, HALF_W, OBS_CAR, project, sampleAt, newRun, gridSlot, nudge, step, resetToCheckpoint, packInput, unpackInput, quant, replay };
});

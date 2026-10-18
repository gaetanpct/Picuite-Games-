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
    return { x: tr.x[i] + (tr.x[i + 1] - tr.x[i]) * t, z: tr.z[i] + (tr.z[i + 1] - tr.z[i]) * t, y: tr.y[i] + (tr.y[i + 1] - tr.y[i]) * t, h: hd, w: tr.w[i] + (tr.w[i + 1] - tr.w[i]) * t, surf: tr.surf[t < 0.5 ? i : i + 1], flags: tr.flags[i], slope: (tr.y[i + 1] - tr.y[i]) / (tr.step) };
  }

  function newRun(tr, carId, opts) {
    const car = CARS[carId] || CARS.bolide; const st = tr.start;
    const r = {
      tr, car, tick: 0, x: st.x, z: st.z, y: st.y, hd: st.h, vx: 0, vz: 0, vy: 0, air: false, idx: st.idx, prevIdx: st.idx, cp: 0, cpIdx: st.idx, cpHd: st.h,
      finished: false, finishTime: 0, boostT: 0, driftT: 0, resets: 0, hits: 0, climb: 0, steerV: 0, pitch: 0, roll: 0, lastResetTick: -999, maxSpeed: 0, onSurf: 0, wallHit: 0, landed: 0, boostEvt: 0,
      opts: opts || {},
    };
    r.y = sampleAt(tr, r.idx).y; return r;
  }

  function resetToCheckpoint(r) {
    const tr = r.tr, s = sampleAt(tr, r.cpIdx);
    r.x = s.x; r.z = s.z; r.y = s.y; r.hd = s.h; r.vx = 0; r.vz = 0; r.vy = 0; r.air = false; r.idx = r.cpIdx; r.prevIdx = r.cpIdx; r.boostT = 0; r.driftT = 0; r.climb = 0; r.resets++; r.lastResetTick = r.tick;
  }

  // commande = { steer -1..1 (positif = droite), thr 0|1, brk 0|1, rst 0|1 }
  function step(r, inp) {
    if (r.finished) return;
    const tr = r.tr, car = r.car, g = tr.gravity;
    r.tick++;
    if (inp.rst && r.tick - r.lastResetTick > 30) { resetToCheckpoint(r); return; }
    const fx = Math.sin(r.hd), fz = Math.cos(r.hd), rx = -Math.cos(r.hd), rz = Math.sin(r.hd);
    let vf = r.vx * fx + r.vz * fz, vl = r.vx * rx + r.vz * rz;
    const sp = sampleAt(tr, r.idx); const surf = r.air ? S.ASPHALT : sp.surf; r.onSurf = surf;
    let gripMul = 1, vmax = car.vmax, accMul = 1, drag = 0.0;
    if (surf === S.DIRT) { gripMul = car.dirt; vmax *= 0.93; drag = 0.35; }
    else if (surf === S.ICE) { gripMul = car.ice; drag = 0.05; }
    else if (surf === S.SLOW) { gripMul = 0.9; vmax *= 0.62; accMul = 0.75; drag = 1.1; }
    // direction
    const target = inp.steer * (inp.steer < 0 ? 1 : 1); r.steerV += (target - r.steerV) * Math.min(1, DT * 14); const st = r.steerV;
    const sgnV = vf >= 0 ? 1 : -1; const sf = Math.min(1, Math.abs(vf) / 6);
    const fall = 1 / (1 + Math.pow(Math.abs(vf) / (car.vmax * 0.68), 1.6) * 0.85);
    let yaw = -st * car.turn * sf * fall * sgnV; if (r.air) yaw *= 0.35; r.hd += yaw * DT;
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
    r.x += r.vx * DT; r.z += r.vz * DT;
    // position sur le circuit
    const pj = project(tr, r.x, r.z, r.idx); r.prevIdx = r.idx; r.idx = pj.idx; const ps = sampleAt(tr, r.idx);
    const rrx = -Math.cos(ps.h), rrz = Math.sin(ps.h); let u = (r.x - ps.x) * rrx + (r.z - ps.z) * rrz;
    const lim = ps.w - HALF_W;
    r.wallHit = 0;
    if (Math.abs(u) > lim) {
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
    // hauteur et envol
    const gy = ps.y;
    if (!r.air) {
      const freeY = r.y + r.climb * DT - 0.5 * g * DT * DT;
      if (gy < freeY - 0.012 && Math.hypot(r.vx, r.vz) > 6) { r.air = true; r.vy = r.climb - g * DT; r.y = freeY; }
      else { r.climb = (gy - r.y) / DT; if (r.climb > 12) r.climb = 12; if (r.climb < -12) r.climb = -12; r.y = gy; }
    } else {
      r.vy -= g * DT; r.y += r.vy * DT;
      if (r.y <= gy) {
        const impact = -r.vy; r.y = gy; r.air = false; r.landed = impact; r.climb = 0;
        const sf2 = 1 - Math.min(0.12, Math.max(0, impact - 3) * 0.012); r.vx *= sf2; r.vz *= sf2;
        if (car.bounce && impact > 4) { r.air = true; r.vy = impact * car.bounce; r.y = gy + 0.02; }
      }
    }
    // pad turbo
    if (!r.air && (ps.flags & Track.FLAG.BOOST) && ps.surf === S.BOOST) { if (r.boostT < BOOST_TICKS) { r.boostT = BOOST_TICKS; r.boostEvt = r.tick; } }
    // chute hors circuit (ne devrait pas arriver, murs partout)
    if (r.y < tr.groundY - 6) resetToCheckpoint(r);
    const spd = Math.hypot(r.vx, r.vz); if (spd > r.maxSpeed) r.maxSpeed = spd;
    // visuel
    r.pitch = Math.atan(ps.slope); 
    // points de contrôle et arrivée
    const nextCp = tr.cps[r.cp];
    if (nextCp !== undefined && r.prevIdx < nextCp && r.idx >= nextCp) { r.cp++; r.cpIdx = nextCp; r.cpHd = sampleAt(tr, nextCp).h; r.cpEvt = r.tick; }
    const F = tr.n - 3;
    if (r.cp >= tr.cps.length && r.prevIdx < F && r.idx >= F) {
      const frac = (F - r.prevIdx) / Math.max(1e-6, r.idx - r.prevIdx); r.finished = true; r.finishTime = (r.tick - 1 + Math.min(1, Math.max(0, frac))) * DT;
    }
  }

  // commandes compactées sur un octet par pas. bits 0 à 4 direction (0 à 30, 15 neutre), 5 gaz, 6 frein, 7 retour
  function packInput(inp) { const s = Math.max(0, Math.min(30, Math.round(inp.steer * 15) + 15)); return s | (inp.thr ? 32 : 0) | (inp.brk ? 64 : 0) | (inp.rst ? 128 : 0); }
  function unpackInput(b) { return { steer: ((b & 31) - 15) / 15, thr: (b & 32) ? 1 : 0, brk: (b & 64) ? 1 : 0, rst: (b & 128) ? 1 : 0 }; }
  const quant = (inp) => unpackInput(packInput(inp));

  // rejoue une série de commandes et renvoie la course. fuelTicks coupe les gaz au delà de ce pas (mode essence)
  function replay(tr, carId, bytes, fuelTicks) {
    const r = newRun(tr, carId); const n = bytes.length; const frames = []; const lim = fuelTicks == null ? 1e12 : fuelTicks;
    for (let i = 0; i < n && !r.finished; i++) {
      const inp = unpackInput(bytes[i]); if (i >= lim) inp.thr = 0;
      step(r, inp); if (i % 6 === 0) frames.push(r.x, r.y, r.z, r.hd, r.pitch, r.air ? 1 : 0, r.boostT > 0 ? 1 : 0, r.idx);
    }
    frames.push(r.x, r.y, r.z, r.hd, r.pitch, 0, 0, r.idx);
    return { run: r, frames };
  }
  return { DT, CARS, CAR_ORDER, HALF_W, project, sampleAt, newRun, step, resetToCheckpoint, packInput, unpackInput, quant, replay };
});

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
  // wall et hill règlent la casse au choc et la gêne en côte, boostK la puissance des turbos, drift la récompense du dérapage
  const CARS = {
    bolide: { id: "bolide", name: "Bolide", icon: "🏎️", color: "#e8453c", vmax: 52, acc: 21, brake: 38, turn: 2.2, grip: 6.8, dirt: 0.7, ice: 0.18, drift: 0.7, bounce: 0, wall: 1, hill: 1, cv: 0.68, boostK: 1, mass: 1, trait: "La référence, sans point faible ni point fort", desc: "La voiture équilibrée. Rapide, stable, elle pardonne un peu les erreurs de trajectoire." },
    rallye: { id: "rallye", name: "Rallye-Pote", icon: "🚙", color: "#3aa653", vmax: 47, acc: 20, brake: 36, turn: 2.1, grip: 5.2, dirt: 1.5, ice: 1.0, drift: 0.65, bounce: 0, wall: 0.8, hill: 0.75, cv: 0.7, boostK: 1, mass: 1.15, verge: 1.6, trait: "Colle à la terre, à la glace et aux bas-côtés", desc: "Reine de la terre, de la glace et des bas-côtés où elle perd bien moins de vitesse que les autres. Sur le bitume elle glisse et perd du temps." },
    petard: { id: "petard", name: "Pétard", icon: "🚀", color: "#f08a24", vmax: 70, acc: 31, brake: 28, turn: 1.5, grip: 5.3, dirt: 0.42, ice: 0.07, drift: 0.32, bounce: 0, wall: 1.6, hill: 1.5, cv: 0.47, boostK: 1.15, mass: 0.9, trait: "La plus rapide en ligne droite, la pire en virage", desc: "Une fusée sur roues, la plus rapide en ligne droite. Il freine mal, tourne mal et chaque mur fait très mal." },
    toupie: { id: "toupie", name: "Toupie", icon: "🌀", color: "#8a55c8", vmax: 49, acc: 19.5, brake: 33, turn: 3.1, grip: 3.3, dirt: 0.8, ice: 0.3, drift: 1.15, bounce: 0, wall: 1.1, hill: 1.1, cv: 0.9, boostK: 0.9, mass: 0.8, trait: "Glisse tout le temps, énorme turbo de dérapage", desc: "Elle glisse tout le temps. Très vive dans les virages, et un long dérapage lui donne un énorme turbo à la sortie." },
    bouboule: { id: "bouboule", name: "Bouboule", icon: "🫧", color: "#25b9b0", vmax: 47, acc: 18, brake: 34, turn: 2.4, grip: 7.0, dirt: 0.85, ice: 0.35, drift: 0.5, bounce: 0.45, wall: 0.25, hill: 0.65, cv: 0.75, boostK: 1, mass: 0.7, trait: "Rebondit sur les murs sans presque rien perdre", desc: "Ronde et rebondissante. Les murs et les obstacles la ralentissent à peine, mais elle manque de vitesse de pointe." },
  };
  // poids lourd et poids plume
  CARS.mastodonte = { id: "mastodonte", name: "Mastodonte", icon: "🚜", color: "#7a6a4a", vmax: 50, acc: 17.5, brake: 40, turn: 1.7, grip: 7.9, dirt: 0.9, ice: 0.42, drift: 0.35, bounce: 0, wall: 0.25, hill: 0.3, cv: 0.75, boostK: 0.9, mass: 2.2, trait: "Rien ne l'arrête, il pousse tout le monde", desc: "Un poids lourd. Il démarre lentement mais rien ne l'arrête, les montées ne lui font rien, les murs à peine et il envoie valser les autres voitures. Il tourne large." };
  CARS.libellule = { id: "libellule", name: "Libellule", icon: "🦋", color: "#d94fb0", vmax: 55, acc: 24, brake: 34, turn: 2.65, grip: 4.5, dirt: 0.6, ice: 0.15, drift: 1.35, bounce: 0, wall: 1.4, hill: 1.2, cv: 0.62, boostK: 1.25, mass: 0.65, trait: "Les plus gros mini turbos, mais très fragile", desc: "Légère comme une plume. Elle accélère fort, tourne vite et son dérapage donne de gros mini turbos. Les chocs et les montées la secouent, un contact avec le Mastodonte la fait voler." };
  // trois voitures à mécanique propre
  // Volt, couple électrique constant et freinage qui recharge une batterie, rendue en poussée à la relance
  CARS.volt = { id: "volt", name: "Volt", icon: "⚡", color: "#2fb0ff", vmax: 48, acc: 19, accPow: 4, regen: 1, brake: 39, turn: 2.3, grip: 6.6, dirt: 0.7, ice: 0.2, drift: 0.55, bounce: 0, wall: 1, hill: 0.9, cv: 0.7, boostK: 1, mass: 1.1, trait: "Chaque freinage recharge sa batterie, la relance suivante est électrique", desc: "Électrique. Il garde toute sa poussée jusqu'à sa vitesse de pointe, et chaque coup de frein remplit sa batterie, rendue en poussée dès qu'on réaccélère. Parfait pour les circuits pleins de virages serrés." };
  // Sauterelle, se pilote en l'air, plane un peu et se pose sans perdre de vitesse
  CARS.sauterelle = { id: "sauterelle", name: "Sauterelle", icon: "🦗", color: "#7ac943", vmax: 48, acc: 19, brake: 34, turn: 2.35, grip: 6.2, dirt: 0.75, ice: 0.22, drift: 0.6, bounce: 0, wall: 1.1, hill: 0.95, cv: 0.7, boostK: 1, mass: 0.85, airCtl: 1, airSteer: 0.5, glide: 0.88, soft: 0.2, trait: "Se pilote en l'air, plane et se pose en douceur", desc: "Reine des airs. En plein saut elle tourne comme au sol et corrige sa trajectoire, elle plane un peu plus loin que les autres et ses réceptions ne lui coûtent presque rien. Au sol elle reste moyenne." };
  // Comète, ses turbos s'additionnent au lieu de se remplacer, mais elle tourne mal pendant un turbo
  CARS.comete = { id: "comete", name: "Comète", icon: "☄️", color: "#ff5ab4", vmax: 50, acc: 18.5, brake: 35, turn: 2.2, grip: 6.4, dirt: 0.65, ice: 0.18, drift: 0.8, bounce: 0, wall: 1.1, hill: 1.05, cv: 0.68, boostK: 1.12, mass: 0.95, stack: 1, boostTurn: 0.62, trait: "Ses turbos s'additionnent, mais elle tourne mal pendant un turbo", desc: "Chaque turbo s'ajoute au précédent. Tapis, dérapages et anneaux enchaînés lui donnent des pointes folles, à condition de savoir tenir la route, car elle braque beaucoup moins pendant un turbo." };
  const CAR_ORDER = ["bolide", "rallye", "petard", "toupie", "bouboule", "mastodonte", "libellule", "volt", "sauterelle", "comete"];
  // paliers du turbo de dérapage, en pas de 1/60 s de dérapage tenu, et durée du turbo donné à la sortie
  const DRIFT_TIERS = [{ at: 30, boost: 48 }, { at: 72, boost: 92 }, { at: 125, boost: 140 }];
  const driftTier = (t) => (t >= DRIFT_TIERS[2].at ? 3 : t >= DRIFT_TIERS[1].at ? 2 : t >= DRIFT_TIERS[0].at ? 1 : 0);
  const HALF_W = 1.05;
  const BOOST_TICKS = 70;
  const BOOST_MAX = 150;
  const VCAP = 94; // vitesse de pointe maximale sous turbo, sous la vitesse de référence des sauts

  const wrap = (a) => { while (a > Math.PI) a -= 2 * Math.PI; while (a < -Math.PI) a += 2 * Math.PI; return a; };
  // donne un turbo de n pas. La Comète additionne ses turbos, les autres gardent le plus long
  function giveBoost(r, n, lv) { if (r.car.stack) r.boostT = Math.min(BOOST_MAX * 2, r.boostT + n); else r.boostT = Math.max(r.boostT, n); if (lv && lv > (r.boostLv || 1)) r.boostLv = lv; r.boostEvt = r.tick; }

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
      rail: false, mag: -1, ux: 0, uz: 0, wasSolid: true, spin: 0, lane: -1, laneF: -1, draft: 0, draftT: 0, drTier: 0, batt: 0, boostLv: 1, onVerge: false, ringEvt: 0, cut: -1, bank: 0,
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
  function nudge(r, dx, dz, dvx, dvz, dspin) { if (r.rail) return; r.x += dx; r.z += dz; r.vx += dvx; r.vz += dvz; if (Math.hypot(dvx, dvz) > 5) { r.boostT = 0; r.driftT = 0; } if (dspin) r.spin = Math.max(-9, Math.min(9, (r.spin || 0) + dspin)); }

  // choc entre deux voitures faites chacune de deux cercles. r est ma voiture, o l'autre {x,z,h,y,vx,vz}. Renvoie le décalage et l'impulsion à appliquer à r, ou null.
  // La même formule sert au client pour lui même et au serveur pour les pilotes automatiques, donc les deux voitures réagissent de la même façon
  function contactVs(r, o, share, canBump) {
    const R = 1.12, off = 1.05; if (Math.abs(o.y - r.y) > 1.6) return null; let best = null;
    for (let a = -1; a <= 1; a += 2) for (let b = -1; b <= 1; b += 2) {
      const ax = r.x + Math.sin(r.hd) * off * a, az = r.z + Math.cos(r.hd) * off * a, bx = o.x + Math.sin(o.h) * off * b, bz = o.z + Math.cos(o.h) * off * b;
      const dx = ax - bx, dz = az - bz, d = Math.hypot(dx, dz), pen = 2 * R - d;
      if (pen > 0 && (!best || pen > best.pen)) best = { pen, nx: d > 1e-4 ? dx / d : 1, nz: d > 1e-4 ? dz / d : 0, cx: (ax + bx) / 2, cz: (az + bz) / 2 };
    }
    if (!best) return null;
    // choc avec masses. share est la part de l'impulsion reçue par ma voiture, plus l'autre est lourde plus je reçois. Restitution faible, donc pas de rebond disproportionné
    const mr = (r.car && r.car.mass) || 1, mo = (o.car && CARS[o.car] && CARS[o.car].mass) || 1; share = mo / (mr + mo);
    const push = Math.min(0.7, best.pen * 0.9) * share * 1.25; const vn = (r.vx - o.vx) * best.nx + (r.vz - o.vz) * best.nz; let dvx = 0, dvz = 0, ds = 0;
    if (vn < -0.2 && canBump) {
      const e = 0.28; const j = Math.min(18, -(1 + e) * vn * share); dvx = best.nx * j; dvz = best.nz * j;
      const lx = best.cx - r.x, lz = best.cz - r.z; ds = Math.max(-5, Math.min(5, (lz * dvx - lx * dvz) * 0.26));
    }
    return { dx: best.nx * push, dz: best.nz * push, dvx, dvz, ds, vn, bump: dvx !== 0 || dvz !== 0 };
  }

  function resetToCheckpoint(r) {
    const tr = r.tr;
    // en sortie de piste avec le retour au départ, tout est à refaire depuis la ligne
    if (r.out && r.opts && r.opts.leave === "zero") { r.cp = 0; r.cpIdx = tr.start.idx; r.cpHd = tr.start.h; }
    r.out = false; const s = sampleAt(tr, r.cpIdx);
    r.x = s.x; r.z = s.z; r.y = s.y; r.hd = s.h; r.vx = 0; r.vz = 0; r.vy = 0; r.air = false; r.idx = r.cpIdx; r.prevIdx = r.cpIdx; r.boostT = 0; r.driftT = 0; r.climb = 0; r.resets++; r.lastResetTick = r.tick; r.rail = false; r.mag = -1; r.wasSolid = true; r.pitch = 0; r.lane = -1; r.laneF = -1; r.drTier = 0; r.batt = 0; r.boostLv = 1; r.cut = -1;
  }

  const SNAP = 0.05; // débattement de suspension, la voiture reste collée au sol sur les cassures de pente légères
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
    const tr = r.tr;
    for (let nextCp = tr.cps[r.cp]; nextCp !== undefined && r.prevIdx < nextCp && r.idx >= nextCp; nextCp = tr.cps[r.cp]) { r.cp++; r.cpIdx = nextCp; r.cpHd = sampleAt(tr, nextCp).h; r.cpEvt = r.tick; }
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
        if (vn < 0) { const rest = 0.2 + car.bounce; r.vx -= (1 + rest) * vn * nx; r.vz -= (1 + rest) * vn * nz; const hit = -vn; const ck = r.tr.crashK || 1; const keep = 1 - Math.min(0.65, hit * 0.04 * ck * car.wall); r.vx *= keep; r.vz *= keep; r.hits++; if (hit > r.wallHit) r.wallHit = hit; }
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
    const sgnV = vf >= 0 ? 1 : -1; const sf = Math.min(1, Math.abs(vf) / 6); const fall = 1 / (1 + Math.pow(Math.abs(vf) / (car.vmax * (car.cv || 0.68)), 1.6) * 0.85);
    r.hd += -st * car.turn * sf * fall * sgnV * DT;
    if (r.boostT > 0) { const bl = (car.boostK || 1) * (r.boostLv || 1); vmax = Math.min(VCAP, vmax * (1 + 0.3 * bl)); accMul += 1.1 * bl; r.boostT--; if (r.boostT <= 0) r.boostLv = 1; }
    if (inp.thr) { const k = 1 - Math.pow(Math.max(0, vf) / vmax, car.accPow || 2); vf += car.acc * accMul * Math.max(0, k) * DT; if (vf > vmax) vf -= (vf - vmax) * Math.min(1, DT * 2); }
    if (inp.brk) { if (vf > 0.4) vf = Math.max(0, vf - car.brake * DT); else vf = Math.max(-12, vf - car.acc * 0.55 * DT); }
    if (!inp.thr && !inp.brk) vf -= Math.sign(vf) * Math.min(Math.abs(vf), 2.6 * DT);
    if (!inp.thr && vf > vmax) vf -= (vf - vmax) * Math.min(1, DT * 1.5);
    const k2 = Math.exp(-car.grip * DT); const loss = Math.abs(vl) * (1 - k2); vl *= k2; vf -= Math.sign(vf) * loss * 0.12;
    if (Math.abs(vl) > 0.22 * Math.max(8, Math.abs(vf)) && Math.abs(vf) > 17) { r.driftT++; r.drTier = driftTier(r.driftT); }
    else { if (r.drTier > 0) giveBoost(r, Math.round(DRIFT_TIERS[r.drTier - 1].boost * 0.8 * car.drift)); r.driftT = 0; r.drTier = 0; }
    r.vx = fx * vf + rx * vl; r.vz = fz * vf + rz * vl;
    { const nfx = Math.sin(r.hd), nfz = Math.cos(r.hd); const vf2 = r.vx * nfx + r.vz * nfz, vl2 = r.vx * -Math.cos(r.hd) + r.vz * Math.sin(r.hd); r.vx = nfx * vf2 + -Math.cos(r.hd) * vl2; r.vz = nfz * vf2 + Math.sin(r.hd) * vl2; }
    r.ux += r.vx * DT; r.uz += r.vz * DT; r.prevIdx = r.idx; r.idx = r.uz / STEP;
    // murs latéraux. Dans le repère déroulé la droite de la route est -x
    const i0 = Math.max(0, Math.min(tr.n - 2, Math.floor(r.idx))); const wv = tr.w[i0] + (tr.w[i0 + 1] - tr.w[i0]) * (r.idx - i0); const lim = wv - HALF_W;
    r.wallHit = 0; let u = -r.ux;
    if (Math.abs(u) > lim) {
      const sg = u > 0 ? 1 : -1; r.ux = -sg * lim; const vn = -r.vx;
      if (vn * sg > 0) { const rest = 0.22 + car.bounce; const hit = Math.abs(vn); r.vx += (1 + rest) * vn; const keep = 1 - Math.min(0.5, hit * 0.026 * (r.tr.crashK || 1) * car.wall); r.vx *= keep; r.vz *= keep; r.hits++; r.wallHit = hit; }
      r.hd += wrap(0 - r.hd) * 0.05; r.vx *= 0.995; r.vz *= 0.995;
    }
    r.onSurf = 0; r.air = false; r.landed = 0;
    const spd = Math.hypot(r.vx, r.vz); if (spd > r.maxSpeed) r.maxSpeed = spd;
    if (r.idx >= mg.b) { leaveMag(r); progress(r); return; }
    if (r.idx <= mg.a && r.vz < 0) { leaveMag(r); progress(r); return; }
    railPose(r); progress(r);
  }

  // éléments à faible nombre, parcourus à chaque pas
  function crossRings(r, tr, u) {
    const L = tr.rings; if (!L || !L.length || r.rail) return;
    for (let q = 0; q < L.length; q++) { const g = L[q]; if (r.prevIdx < g.i && r.idx >= g.i) { const d = Math.hypot(u - g.u, r.y + 0.7 - g.y); if (d < g.r) { giveBoost(r, 105, 1.25); r.ringEvt = r.tick; } } }
  }
  function onPad(tr, idx, u) { const L = tr.pads; if (!L || !L.length) return 0; for (let q = 0; q < L.length; q++) { const p = L[q]; if (idx >= p.a && idx <= p.b + 1 && u >= p.u0 && u <= p.u1) return p.k; } return 0; }

  // vol d'un raccourci. La voiture a quitté la route au tremplin et file tout droit au dessus du détour, elle se pose sur la route d'en face
  function stepCut(r, inp) {
    const tr = r.tr, car = r.car, c = tr.cuts[r.cut]; const gAir = airGOf(tr) * (car.glide || 1);
    r.steerV += (inp.steer - r.steerV) * Math.min(1, DT * 14); const fx0 = Math.sin(r.hd), fz0 = Math.cos(r.hd); const vf = r.vx * fx0 + r.vz * fz0;
    const fall = 1 / (1 + Math.pow(Math.abs(vf) / (car.vmax * (car.cv || 0.68)), 1.6) * 0.85); r.hd += -r.steerV * car.turn * Math.min(1, Math.abs(vf) / 6) * fall * (car.airCtl || 0.35) * DT;
    if (car.airSteer) { const nfx = Math.sin(r.hd), nfz = Math.cos(r.hd); const sp0 = Math.hypot(r.vx, r.vz); const k2 = car.airSteer * 0.1; let nx = r.vx + (nfx * sp0 - r.vx) * k2, nz = r.vz + (nfz * sp0 - r.vz) * k2; const sp1 = Math.hypot(nx, nz) || 1; r.vx = nx / sp1 * sp0; r.vz = nz / sp1 * sp0; }
    if (r.boostT > 0) { r.boostT--; if (r.boostT <= 0) r.boostLv = 1; }
    r.x += r.vx * DT; r.z += r.vz * DT; r.vy -= gAir * DT; r.y += r.vy * DT; r.prevIdx = r.idx; r.wallHit = 0; r.landed = 0; r.onSurf = 0;
    const fx = Math.sin(c.h), fz = Math.cos(c.h); const d = (r.x - c.ax) * fx + (r.z - c.az) * fz;
    let est = d < c.D ? c.lip + (c.land - c.lip) * Math.max(0, d) / c.D : c.land + (d - c.D) / STEP; est = Math.min(tr.n - 2, Math.max(r.prevIdx, est));
    if (d > c.D - 10) {
      const pj = project(tr, r.x, r.z, Math.min(tr.n - 2, c.land + Math.max(0, (d - c.D) / STEP)), 8, 12);
      if (pj.idx >= c.land - 5) {
        const ps = sampleAt(tr, pj.idx); const u = (r.x - ps.x) * -Math.cos(ps.h) + (r.z - ps.z) * Math.sin(ps.h); est = Math.max(r.prevIdx, pj.idx);
        if (Math.abs(u) <= ps.w - 0.3 && ps.solid) { const gy = ps.y + u * Track.bankAt(tr, pj.idx);
          if (r.y <= gy) { const impact = -r.vy; r.y = gy; r.air = false; r.cut = -1; r.climb = 0; r.landed = impact; r.idx = est; r.wasSolid = true;
            const sf2 = 1 - Math.min(0.3, Math.max(0, impact - 2.5) * 0.026 * (tr.crashK || 1) * (car.soft == null ? 1 : car.soft)); r.vx *= sf2; r.vz *= sf2; progress(r); return; } }
      }
    }
    r.idx = est;
    // trop court ou à côté, la voiture tombe dans le détour et revient au point de contrôle
    if (r.y < Math.min(tr.y[c.land], tr.y[c.lip]) - 3.5 || r.y < tr.groundY + 0.4) { resetToCheckpoint(r); return; }
    { const hs = Math.max(1e-6, Math.hypot(r.vx, r.vz)); r.pitch += (Math.atan2(r.vy, Math.max(hs, 4)) - r.pitch) * 0.12; }
    const spd = Math.hypot(r.vx, r.vz); if (spd > r.maxSpeed) r.maxSpeed = spd;
    progress(r);
  }

  function step(r, inp) {
    if (r.finished) return;
    const tr = r.tr, car = r.car, g = tr.gravity, gAir = airGOf(tr) * (car.glide || 1);
    r.tick++;
    if (inp.rst && r.tick - r.lastResetTick > 30) { resetToCheckpoint(r); return; }
    if (r.draftT != null) r.draft += ((r.draftT || 0) * 0.25 - r.draft) * 0.05;
    if (r.rail) { stepRail(r, inp); return; }
    if (r.cut >= 0) { stepCut(r, inp); return; }
    const fx = Math.sin(r.hd), fz = Math.cos(r.hd), rx = -Math.cos(r.hd), rz = Math.sin(r.hd);
    let vf = r.vx * fx + r.vz * fz, vl = r.vx * rx + r.vz * rz;
    const sp = sampleAt(tr, r.idx);
    // position latérale avant le pas, pour connaître le sol sous les roues (bas-côté, voie d'embranchement)
    const u0 = (r.x - sp.x) * -Math.cos(sp.h) + (r.z - sp.z) * Math.sin(sp.h);
    const vwArr = tr.vw; const i0w = Math.max(0, Math.min(tr.n - 1, Math.round(r.idx))); const vw0 = vwArr ? vwArr[i0w] : 0;
    r.onVerge = !r.air && vw0 > 0.3 && Math.abs(u0) > sp.w - 0.25;
    let surf = r.air ? S.ASPHALT : sp.surf;
    const fm = tr.forks && tr.forks.length ? Track.forkMap(tr)[Math.floor(Math.min(tr.n - 1, Math.max(0, r.idx)))] : -1;
    if (fm >= 0 && r.laneF === fm && r.lane >= 0 && !r.air) { const ln = tr.forks[fm].lanes[r.lane]; if (ln && ln.s && (sp.flags & Track.FLAG.FORK)) surf = ln.s; }
    if (r.onVerge) surf = S.VERGE;
    r.onSurf = surf;
    const ph = r.phys || (r.phys = (Track.BIOMES[tr.biome] && Track.BIOMES[tr.biome].phys) || {});
    let gripMul = ph.grip || 1, vmax = car.vmax * (ph.vmax || 1), accMul = ph.accel || 1, drag = 0.0;
    if (surf === S.DIRT) { gripMul = car.dirt; vmax *= 0.93; drag = 0.35; }
    else if (surf === S.ICE) { gripMul = car.ice; drag = 0.05; }
    else if (surf === S.SLOW) { gripMul = 0.9; vmax *= 0.62; accMul = 0.75; drag = 1.1; }
    else if (surf === S.VERGE) { const vk = car.verge || 1; gripMul = Math.min(1, car.dirt * 0.55 * vk); vmax *= Math.min(0.92, 0.56 * vk); accMul *= 0.7; drag = 1.5 / vk; }
    // virage relevé. La route penchée tient la voiture, on tourne plus fort et on glisse moins
    const bk0 = !r.air && tr.bank ? Math.abs(Track.bankAt(tr, r.idx)) : 0; if (bk0 > 0.01) gripMul *= 1 + 1.5 * bk0;
    // aspiration, derrière une autre voiture en mode contact
    if (r.draft > 0.01) { vmax *= 1 + 0.07 * r.draft; accMul += 0.35 * r.draft; }
    // direction
    const target = inp.steer; r.steerV += (target - r.steerV) * Math.min(1, DT * 14); const st = r.steerV;
    const sgnV = vf >= 0 ? 1 : -1; const sf = Math.min(1, Math.abs(vf) / 6);
    const fall = 1 / (1 + Math.pow(Math.abs(vf) / (car.vmax * (car.cv || 0.68) * (1 + 1.25 * bk0)), 1.6) * 0.85);
    let yaw = -st * car.turn * sf * fall * sgnV; if (r.air) yaw *= car.airCtl || 0.35; if (r.boostT > 0 && car.boostTurn) yaw *= car.boostTurn; r.hd += yaw * DT;
    if (r.spin) { r.hd += r.spin * DT; r.spin *= 0.9; if (Math.abs(r.spin) < 0.03) r.spin = 0; }
    // accélération
    const boosted = r.boostT > 0; if (boosted) { const bk = (ph.boost || 1) * (car.boostK || 1) * (r.boostLv || 1); vmax = Math.min(VCAP, vmax * (1 + 0.3 * bk)); accMul += 1.1 * bk; r.boostT--; if (r.boostT <= 0) r.boostLv = 1; }
    if (ph.wind && !r.air) { vl += ph.wind * Math.sin(r.tick * 0.021 + r.idx * 0.018) * Math.sin(r.tick * 0.0067 + 1.3) * DT * 6; }
    if (!r.air) {
      // batterie du Volt. Le freinage la remplit, elle pousse à la relance
      if (car.regen) { if (inp.brk && vf > 4) r.batt = Math.min(140, r.batt + 2.4); else if (inp.thr && r.batt > 0) { accMul += 1.0 * Math.min(1, r.batt / 40); vmax *= 1 + 0.06 * Math.min(1, r.batt / 40); r.batt = Math.max(0, r.batt - 1.5); } }
      if (inp.thr) { const k = 1 - Math.pow(Math.max(0, vf) / vmax, car.accPow || 2); vf += car.acc * accMul * Math.max(0, k) * DT; if (vf > vmax) vf -= (vf - vmax) * Math.min(1, DT * 2); }
      if (inp.brk) { if (vf > 0.4) vf = Math.max(0, vf - car.brake * DT); else vf = Math.max(-12, vf - car.acc * 0.55 * DT); }
      if (!inp.thr && !inp.brk) vf -= Math.sign(vf) * Math.min(Math.abs(vf), 2.6 * DT);
      vf -= vf * drag * DT; vf -= g * sp.slope * 0.8 * (car.hill || 1) * DT;
      if (!inp.thr && vf > vmax) vf -= (vf - vmax) * Math.min(1, DT * 1.5);
      if (surf === S.VERGE && vf > vmax) vf -= (vf - vmax) * Math.min(1, DT * 2.2);
      // adhérence
      const grip = car.grip * gripMul; const k = Math.exp(-grip * DT); const loss = Math.abs(vl) * (1 - k); vl *= k; vf -= Math.sign(vf) * loss * 0.12;
      // dérapage maintenu, trois paliers de turbo à la sortie
      if (Math.abs(vl) > 0.17 * Math.max(8, Math.abs(vf)) && Math.abs(vf) > 17 && surf !== S.ICE && surf !== S.VERGE) { r.driftT++; r.drTier = driftTier(r.driftT); }
      else { if (r.drTier > 0) giveBoost(r, Math.min(BOOST_MAX, Math.round(DRIFT_TIERS[r.drTier - 1].boost * car.drift))); r.driftT = 0; r.drTier = 0; }
    }
    r.vx = fx * vf + rx * vl; r.vz = fz * vf + rz * vl;
    // la direction a pu tourner, on recalcule l'avant pour que la vitesse suive le cap. En l'air seule la Sauterelle peut infléchir sa trajectoire
    const nfx = Math.sin(r.hd), nfz = Math.cos(r.hd);
    { const vf2 = r.vx * nfx + r.vz * nfz, vl2 = r.vx * -Math.cos(r.hd) + r.vz * Math.sin(r.hd); const mix = r.air ? car.airSteer || 0 : 1;
      if (mix >= 1) { r.vx = nfx * vf2 + -Math.cos(r.hd) * vl2; r.vz = nfz * vf2 + Math.sin(r.hd) * vl2; }
      else if (mix > 0) { const ax = nfx * vf2 + -Math.cos(r.hd) * vl2 * 0.6, az = nfz * vf2 + Math.sin(r.hd) * vl2 * 0.6; const k2 = mix * 0.1; const sp0 = Math.hypot(r.vx, r.vz); let nx = r.vx + (ax - r.vx) * k2, nz = r.vz + (az - r.vz) * k2; const sp1 = Math.hypot(nx, nz) || 1; r.vx = nx / sp1 * sp0; r.vz = nz / sp1 * sp0; } }
    const ox = r.x, oz = r.z;
    r.x += r.vx * DT; r.z += r.vz * DT;
    // position sur le circuit
    const pj = project(tr, r.x, r.z, r.idx); r.prevIdx = r.idx; r.idx = pj.idx;
    if (tr.mags && tr.mags.length && enterMag(r)) { progress(r); return; }
    const ps = sampleAt(tr, r.idx);
    const rrx = -Math.cos(ps.h), rrz = Math.sin(ps.h); let u = (r.x - ps.x) * rrx + (r.z - ps.z) * rrz;
    const iw = Math.max(0, Math.min(tr.n - 1, Math.round(r.idx))); const vw = vwArr ? vwArr[iw] : 0;
    // la barrière recule derrière le bas-côté
    const lim = ps.w + (vw > 0.05 ? vw : 0) - HALF_W; const nowall = !!(ps.flags & Track.FLAG.NOWALL);
    let loU = -lim, hiU = lim;
    // embranchement. Une fois le terre-plein assez large, chaque voiture reste dans la voie où elle est entrée
    let laneDy = 0; const fk = tr.forks && tr.forks.length ? Track.forkMap(tr)[Math.floor(Math.min(tr.n - 1, Math.max(0, r.idx)))] : -1;
    if (fk >= 0) {
      const f = tr.forks[fk]; const fg = Track.forkGeo(f, r.idx);
      if (fg.m >= 1.2) {
        if (r.laneF !== fk || r.lane < 0) { r.laneF = fk; r.lane = u < 0 ? 0 : 1; }
        if (r.lane === 0) { loU = fg.a0 + HALF_W; hiU = fg.a1 - HALF_W; } else { loU = fg.b0 + HALF_W; hiU = fg.b1 - HALF_W; }
      }
      if (r.laneF === fk && r.lane >= 0) laneDy = Track.forkDy(f, r.lane, r.idx);
    } else if (r.lane >= 0) { r.lane = -1; r.laneF = -1; }
    // route qui bouge
    if (tr.movers && tr.movers.length) { const mi = Track.moverMap(tr)[Math.floor(Math.min(tr.n - 1, Math.max(0, r.idx)))]; if (mi >= 0) laneDy += Track.moverDy(tr.movers[mi], r.idx, r.tick * DT); }
    r.wallHit = 0;
    // sortie de piste permise, une voiture assez haute passe par dessus la barrière et sort du circuit
    if (r.opts && r.opts.leave && r.opts.leave !== "mur" && fk < 0) {
      if (r.out && Math.abs(u) <= lim) r.out = false;
      if (!r.out && r.air && Math.abs(u) > lim && r.y - ps.y > 0.9) r.out = true;
    }
    if (!nowall && !r.out && (u > hiU || u < loU)) {
      const sg = u > hiU ? 1 : -1; const tgt = sg > 0 ? hiU : loU; const push = u - tgt; r.x -= rrx * push; r.z -= rrz * push;
      const vn = r.vx * rrx + r.vz * rrz;
      if (vn * sg > 0) {
        const rest = 0.22 + car.bounce; const hit = Math.abs(vn);
        r.vx -= (1 + rest) * vn * rrx; r.vz -= (1 + rest) * vn * rrz;
        const ck = r.tr.crashK || 1; const keep = 1 - Math.min(0.6, hit * 0.032 * ck * car.wall); r.vx *= keep; r.vz *= keep; r.hits++; r.wallHit = hit;
      }
      // le cap se redresse un peu le long du mur, et frotter le mur freine fort
      { const ck = r.tr.crashK || 1; const sc = 1 - Math.min(0.06, 0.012 * ck * car.wall); r.hd += wrap(ps.h - r.hd) * 0.05; r.vx *= sc; r.vz *= sc; }
      u = tgt;
    }
    if (tr.obs && tr.obs.length) collideObs(r, tr);
    // tremplin. Au bout de la rampe la voiture décolle toujours avec la même vitesse verticale, c'est ce qui rend les sauts calculables
    if (!r.air && tr.kicks && tr.kicks.length && Math.hypot(r.vx, r.vz) > 3) {
      for (let q = 0; q < tr.kicks.length; q++) { const kk = tr.kicks[q]; if (r.prevIdx < kk.i && r.idx >= kk.i) { r.air = true; r.vy = kk.vy; r.climb = 0; r.y = Math.max(r.y, ps.y) + 0.02; r.kickEvt = r.tick; break; } }
    }
    // tremplin de raccourci, seulement du côté de la route où il est posé
    if (!r.air && tr.cuts && tr.cuts.length && Math.hypot(r.vx, r.vz) > 12) {
      for (let q = 0; q < tr.cuts.length; q++) { const c = tr.cuts[q]; if (r.prevIdx < c.lip + 0.5 && r.idx >= c.lip + 0.5 && u >= c.u0 - 0.25 && u <= c.u1 + 0.25) { r.air = true; r.vy = c.vk; r.climb = 0; r.y = ps.y + 0.55; r.cut = q; r.kickEvt = r.tick; r.cutEvt = r.tick; progress(r); return; } }
    }
    // hauteur et envol
    const offroad = (nowall || r.out) && Math.abs(u) > ps.w + 0.2; let solid = ps.solid && !offroad; const bkn = tr.bank ? Track.bankAt(tr, r.idx) : 0; r.bank = bkn; const gy = solid ? ps.y + laneDy + u * bkn : -1e9;
    if (!r.air) {
      const freeY = r.y + r.climb * DT - 0.5 * gAir * DT * DT;
      if (!solid || (gy < freeY - (0.012 + SNAP) && Math.hypot(r.vx, r.vz) > 6)) { r.air = true; r.vy = r.climb - gAir * DT; r.y = freeY; }
      else { r.climb = (gy - r.y) / DT; if (r.climb > 30) r.climb = 30; if (r.climb < -30) r.climb = -30; r.y = gy; }
    } else {
      r.vy -= gAir * DT; r.y += r.vy * DT;
      if (solid && !r.wasSolid && r.y < gy - 0.6) { // la voiture heurte le bord de la réception
        r.x = ox; r.z = oz; r.vx *= -0.15; r.vz *= -0.15; r.idx = r.prevIdx; r.hits++; r.wallHit = 8; solid = false;
      } else if (solid && r.y <= gy) {
        const impact = -r.vy; r.y = gy; r.air = false; r.landed = impact; r.climb = 0;
        const sf2 = 1 - Math.min(0.3, Math.max(0, impact - 2.5) * 0.026 * (r.tr.crashK || 1) * (car.soft == null ? 1 : car.soft)); r.vx *= sf2; r.vz *= sf2;
        const bnc = car.bounce + (ph.bounce || 0); if (bnc && impact > 4) { r.air = true; r.vy = impact * bnc; r.y = gy + 0.02; }
      }
    }
    r.wasSolid = solid;
    // tapis turbo et super turbo
    if (!r.air && (ps.flags & Track.FLAG.BOOST)) { if (ps.surf === S.BOOST && r.boostT < BOOST_TICKS) giveBoost(r, car.stack ? 26 : BOOST_TICKS); else if (ps.surf === S.SUPER && (r.boostT < 120 || car.stack)) giveBoost(r, car.stack ? 44 : 120, 1.45); }
    if (!r.air && tr.pads && tr.pads.length) { const pk = onPad(tr, r.idx, u); if (pk && (r.lastPad || 0) < r.tick - 20) { r.lastPad = r.tick; giveBoost(r, pk === 2 ? 120 : BOOST_TICKS, pk === 2 ? 1.45 : 1); } }
    crossRings(r, tr, u);
    // chute dans le vide ou hors du pont, on revient au point de contrôle quand on touche le sol
    if (r.air && !solid && r.y < tr.groundY + 0.4) { resetToCheckpoint(r); return; }
    if (r.y < tr.groundY - 6) resetToCheckpoint(r);
    const spd = Math.hypot(r.vx, r.vz); if (spd > r.maxSpeed) r.maxSpeed = spd;
    // visuel
    { const hs = Math.max(1e-6, Math.hypot(r.vx, r.vz)); const target = r.air ? Math.atan2(r.vy, Math.max(hs, 4)) : Math.atan(sampleAt(tr, Math.min(tr.n - 2, r.idx + 1.2)).slope * 0.6 + ps.slope * 0.4);
      r.pitch += (target - r.pitch) * (r.air ? 0.12 : 0.35); }
    progress(r);
  }

  // commandes compactées sur un octet par pas. bits 0 à 4 direction (0 à 30, 15 neutre), 5 gaz, 6 frein, 7 retour
  function packInput(inp) { const s = Math.max(0, Math.min(30, Math.round(inp.steer * 15) + 15)); return s | (inp.thr ? 32 : 0) | (inp.brk ? 64 : 0) | (inp.rst ? 128 : 0); }
  function unpackInput(b) { return { steer: ((b & 31) - 15) / 15, thr: (b & 32) ? 1 : 0, brk: (b & 64) ? 1 : 0, rst: (b & 128) ? 1 : 0 }; }
  const quant = (inp) => unpackInput(packInput(inp));

  // rejoue une série de commandes et renvoie la course. fuelTicks coupe les gaz au delà de ce pas (mode essence)
  function replay(tr, carId, bytes, fuelTicks, opts) {
    const r = newRun(tr, carId, opts); const n = bytes.length; const frames = []; const lim = fuelTicks == null ? 1e12 : fuelTicks;
    const ev = (opts && opts.events) || []; let ei = 0; const dr = (opts && opts.draft) || []; let di = 0;
    for (let i = 0; i < n && !r.finished; i++) {
      while (ei < ev.length && ev[ei][0] <= i) { if (ev[ei][0] === i) nudge(r, ev[ei][1], ev[ei][2], ev[ei][3], ev[ei][4], ev[ei][5]); ei++; }
      while (di < dr.length && dr[di][0] <= i) { r.draftT = dr[di][1]; di++; }
      const inp = unpackInput(bytes[i]); if (i >= lim) inp.thr = 0;
      step(r, inp); if (i % 6 === 0) frames.push(r.x, r.y, r.z, r.hd, r.pitch, r.rail ? 2 : r.air ? 1 : 0, r.boostT > 0 ? 1 : 0, r.idx);
    }
    frames.push(r.x, r.y, r.z, r.hd, r.pitch, 0, 0, r.idx);
    return { run: r, frames };
  }
  // niveau d'aspiration visé, de 0 à 4, d'après les voitures devant. others liste de {x, z, y}
  function draftTarget(r, others) {
    if (r.rail || r.air) return 0; const fx = Math.sin(r.hd), fz = Math.cos(r.hd); const sp = r.vx * fx + r.vz * fz; if (sp < 15) return 0; let best = 0;
    for (let q = 0; q < others.length; q++) { const o = others[q]; const dx = o.x - r.x, dz = o.z - r.z; const ahead = dx * fx + dz * fz; const lat = Math.abs(dx * -Math.cos(r.hd) + dz * Math.sin(r.hd)); if (ahead < 3.5 || ahead > 17 || lat > 2.4 || Math.abs((o.y || 0) - r.y) > 2) continue; const k = 1 - Math.max(0, ahead - 5) / 12; if (k > best) best = k; }
    return Math.round(best * 4);
  }
  return { DT, CARS, CAR_ORDER, DRIFT_TIERS, draftTarget, HALF_W, OBS_CAR, project, sampleAt, newRun, gridSlot, nudge, contactVs, step, resetToCheckpoint, packInput, unpackInput, quant, replay };
});

// ============================================================
// GOLFOUILLE — Physique de la balle (partagée serveur et client)
// Le serveur simule chaque coup en entier puis envoie la trajectoire.
// Unités en mètres et en secondes. La balle mesure 0,2 m de rayon.
// ============================================================
(function (root, factory) {
  if (typeof module !== "undefined" && module.exports) module.exports = factory();
  else root.GolfPhysics = factory();
})(typeof window !== "undefined" ? window : globalThis, function () {
  const BALL_R = 0.2;
  const DT = 1 / 240;
  const REC = 8; // une image toutes les 8 étapes, soit 30 images par seconde

  // Surfaces. roll = freinage au sol en m/s2, e = rebond, damp = perte à l'impact, stick = pente qui retient la balle.
  const S = { FAIRWAY: 0, GREEN: 1, ROUGH: 2, SAND: 3, WATER: 4, ICE: 5, MUD: 6, LAVA: 7, BOUNCY: 8, VOID: 9 };
  const SURF = [
    { id: 0, name: "Fairway", roll: 1.2, rollv: 0.55, e: 0.35, damp: 0.5, stick: 0.05 },
    { id: 1, name: "Green", roll: 0.8, rollv: 0.3, e: 0.3, damp: 0.7, stick: 0.035 },
    { id: 2, name: "Rough", roll: 3.5, rollv: 1.5, e: 0.15, damp: 0.3, stick: 0.14 },
    { id: 3, name: "Sable", roll: 7, rollv: 3.5, e: 0.03, damp: 0.12, stick: 0.3 },
    { id: 4, name: "Eau", roll: 0, rollv: 0, e: 0, damp: 1, stick: 0, liquid: "water" },
    { id: 5, name: "Glace", roll: 0.06, rollv: 0.01, e: 0.3, damp: 1, stick: 0.004 },
    { id: 6, name: "Boue", roll: 8, rollv: 3, e: 0.02, damp: 0.12, stick: 0.35 },
    { id: 7, name: "Lave", roll: 0, rollv: 0, e: 0, damp: 1, stick: 0, liquid: "lava" },
    { id: 8, name: "Gelée", roll: 0.5, rollv: 0.1, e: 0.9, damp: 0.98, stick: 0.03 },
    { id: 9, name: "Vide", roll: 0, rollv: 0, e: 0, damp: 1, stick: 0 },
  ];

  // ---------- accès au terrain ----------
  function prepare(hole) {
    if (hole._w) return hole._w;
    const nx = hole.nx, nz = hole.nz, W = nx + 1;
    const H = hole.heights, N = new Float32Array((nx + 1) * (nz + 1) * 2);
    // normales aux sommets par différences centrées
    for (let j = 0; j <= nz; j++) for (let i = 0; i <= nx; i++) {
      const hl = H[j * W + Math.max(0, i - 1)], hr = H[j * W + Math.min(nx, i + 1)];
      const hd = H[Math.max(0, j - 1) * W + i], hu = H[Math.min(nz, j + 1) * W + i];
      const dx = (hr - hl) / (Math.min(nx, i + 1) - Math.max(0, i - 1));
      const dz = (hu - hd) / (Math.min(nz, j + 1) - Math.max(0, j - 1));
      N[(j * W + i) * 2] = dx; N[(j * W + i) * 2 + 1] = dz; // pente brute, normalisée à l'usage
    }
    const w = { nx, nz, W, H, N, ox: hole.ox, oz: hole.oz, surf: hole.surf };
    // grille de hachage des obstacles circulaires
    const cs = 6; const gx = Math.ceil(nx / cs) + 1, gz = Math.ceil(nz / cs) + 1; const cells = new Array(gx * gz);
    const add = (o) => {
      const i0 = Math.max(0, Math.floor((o.x - o.r - hole.ox) / cs)), i1 = Math.min(gx - 1, Math.floor((o.x + o.r - hole.ox) / cs));
      const j0 = Math.max(0, Math.floor((o.z - o.r - hole.oz) / cs)), j1 = Math.min(gz - 1, Math.floor((o.z + o.r - hole.oz) / cs));
      for (let j = j0; j <= j1; j++) for (let i = i0; i <= i1; i++) { const k = j * gx + i; (cells[k] || (cells[k] = [])).push(o); }
    };
    (hole.obstacles || []).forEach(add);
    (hole.bumpers || []).forEach((b) => add({ x: b.x, z: b.z, r: b.r, h: 2, e: 1.35, bumper: true, kick: 5 }));
    (hole.bars || []).forEach((b) => add({ x: b.x, z: b.z, r: b.r || 0.7, h: 3, e: 0.5, pylon: true }));
    w.grid = { cs, gx, gz, cells };
    hole._w = w;
    return w;
  }

  function sample(w, x, z) {
    let fx = x - w.ox, fz = z - w.oz;
    if (fx < 0) fx = 0; else if (fx > w.nx - 0.0001) fx = w.nx - 0.0001;
    if (fz < 0) fz = 0; else if (fz > w.nz - 0.0001) fz = w.nz - 0.0001;
    const i = Math.floor(fx), j = Math.floor(fz); const u = fx - i, v = fz - j;
    const W = w.W, k = j * W + i;
    const h00 = w.H[k], h10 = w.H[k + 1], h01 = w.H[k + W], h11 = w.H[k + W + 1];
    const h = h00 * (1 - u) * (1 - v) + h10 * u * (1 - v) + h01 * (1 - u) * v + h11 * u * v;
    const a = w.N, k2 = k * 2, k3 = (k + 1) * 2, k4 = (k + W) * 2, k5 = (k + W + 1) * 2;
    const gxs = a[k2] * (1 - u) * (1 - v) + a[k3] * u * (1 - v) + a[k4] * (1 - u) * v + a[k5] * u * v;
    const gzs = a[k2 + 1] * (1 - u) * (1 - v) + a[k3 + 1] * u * (1 - v) + a[k4 + 1] * (1 - u) * v + a[k5 + 1] * u * v;
    return { h, gx: gxs, gz: gzs };
  }
  function heightAt(hole, x, z) { return sample(prepare(hole), x, z).h; }
  function surfAt(hole, x, z) {
    const w = prepare(hole);
    const i = Math.floor(x - w.ox), j = Math.floor(z - w.oz);
    if (i < 0 || j < 0 || i >= w.nx || j >= w.nz) return S.VOID;
    return w.surf[j * w.nx + i];
  }

  // ---------- obstacles mobiles (partagés avec l'affichage) ----------
  // Pale de moulin. Renvoie les deux extrémités à l'instant t (secondes depuis le début du trou).
  function barEnds(b, t) {
    const a = b.phase + b.omega * t; const c = Math.cos(a), s = Math.sin(a), L = b.len / 2;
    return { x1: b.x - c * L, z1: b.z - s * L, x2: b.x + c * L, z2: b.z + s * L, ang: a };
  }
  // Barrière coulissante, elle va et vient en travers du fairway.
  function sliderEnds(b, t) {
    const off = b.amp * Math.sin((2 * Math.PI * t) / b.period + b.phase);
    const cx = b.x + b.nx * off, cz = b.z + b.nz * off; const L = b.len / 2;
    return { x1: cx - b.tx * L, z1: cz - b.tz * L, x2: cx + b.tx * L, z2: cz + b.tz * L, vx: b.nx * b.amp * (2 * Math.PI / b.period) * Math.cos((2 * Math.PI * t) / b.period + b.phase), vz: b.nz * b.amp * (2 * Math.PI / b.period) * Math.cos((2 * Math.PI * t) / b.period + b.phase) };
  }

  function closestOnSeg(px, pz, x1, z1, x2, z2) {
    const dx = x2 - x1, dz = z2 - z1; const l2 = dx * dx + dz * dz;
    let t = l2 > 0 ? ((px - x1) * dx + (pz - z1) * dz) / l2 : 0; t = t < 0 ? 0 : t > 1 ? 1 : t;
    return { x: x1 + dx * t, z: z1 + dz * t, t };
  }

  // ---------- simulation d'un coup ----------
  // shot = { yaw (rad, 0 = vers +z, positif vers +x), speed (m/s), loft (deg) }
  // opts = { t0 (s depuis le début du trou), wind [ax, az], ice, magnet, walls [{x1,z1,x2,z2,h}], orbs [{id,x,z}], gravity, sandPro, skip }
  function simulate(hole, ball, shot, opts) {
    opts = opts || {};
    const w = prepare(hole);
    const g = opts.gravity || hole.gravity || 9.8;
    const wind = opts.wind || [0, 0];
    const t0 = opts.t0 || 0;
    const loft = (shot.loft * Math.PI) / 180;
    const sp = shot.speed;
    let x = ball.x, z = ball.z, y = ball.y;
    let vx = Math.sin(shot.yaw) * Math.cos(loft) * sp, vz = Math.cos(shot.yaw) * Math.cos(loft) * sp, vy = Math.sin(loft) * sp;
    const frames = [Math.round(x * 100), Math.round(y * 100), Math.round(z * 100)];
    const events = [];
    const picked = [];
    const cup = hole.cup; const cupR = (hole.cupR || 0.52) * (opts.cupMul || 1) * (opts.magnet ? 1.35 : 1);
    const maxSteps = Math.round((opts.maxTime || 38) / DT);
    let step = 0, stillSteps = 0, outcome = "rest", skips = 0, lastDry = { x: ball.x, z: ball.z };
    let portalCool = 0, airTime = 0, wasAir = true;
    const walls = opts.walls || [];
    const orbs = opts.orbs || [];
    const rec = () => { frames.push(Math.round(x * 100), Math.round(y * 100), Math.round(z * 100)); };
    const ev = (k, extra) => { const e = { k, f: frames.length / 3 - 1, x: +x.toFixed(2), y: +y.toFixed(2), z: +z.toFixed(2) }; if (extra) Object.assign(e, extra); events.push(e); };
    // collisions avec un segment épais
    function hitSeg(x1, z1, x2, z2, rad, top, e, wvx, wvz) {
      if (y - BALL_R > top) return false;
      const c = closestOnSeg(x, z, x1, z1, x2, z2);
      let dx = x - c.x, dz = z - c.z; let d = Math.sqrt(dx * dx + dz * dz);
      const need = rad + BALL_R;
      if (d >= need) return false;
      if (d < 1e-6) { dx = 1; dz = 0; d = 1; }
      const nx = dx / d, nz = dz / d;
      const rvx = vx - wvx, rvz = vz - wvz; const vn = rvx * nx + rvz * nz;
      x = c.x + nx * need; z = c.z + nz * need;
      if (vn < 0) { vx = rvx - (1 + e) * vn * nx + wvx; vz = rvz - (1 + e) * vn * nz + wvz; return Math.abs(vn); }
      return 0;
    }

    while (step < maxSteps) {
      const tAbs = t0 + step * DT;
      const smp = sample(w, x, z);
      const gh = smp.h;
      const onGround = y - BALL_R <= gh + 0.012;
      // forces
      let ax = 0, az = 0, ay = -g;
      if (!onGround) {
        const speed = Math.sqrt(vx * vx + vy * vy + vz * vz);
        const drag = 0.0011 * speed;
        ax -= vx * drag; az -= vz * drag; ay -= vy * drag;
        ax += wind[0]; az += wind[1];
        if (opts.gust) { ax += opts.gust[0]; az += opts.gust[1]; }
      }
      // aimant du trou
      if (opts.magnet) {
        const dx = cup.x - x, dz = cup.z - z; const d = Math.sqrt(dx * dx + dz * dz);
        if (d < 7 && d > 0.05) { const f = 9 * (1 - d / 7); ax += (dx / d) * f; az += (dz / d) * f; }
      }
      vx += ax * DT; vy += ay * DT; vz += az * DT;
      x += vx * DT; y += vy * DT; z += vz * DT;
      if (portalCool > 0) portalCool--;

      // sol
      const s2 = sample(w, x, z);
      const surf = surfAt(hole, x, z);
      if (surf === S.VOID) { outcome = "ob"; ev("ob"); break; }
      let nx = -s2.gx, ny = 1, nz = -s2.gz; const nl = Math.sqrt(nx * nx + 1 + nz * nz); nx /= nl; ny /= nl; nz /= nl;
      if (y - BALL_R < s2.h) {
        const sf = SURF[surf];
        if (sf.liquid) {
          const vn0 = vx * nx + vy * ny + vz * nz; const hs = Math.sqrt(vx * vx + vz * vz);
          const canSkip = sf.liquid === "water" && skips < (opts.skip ? 5 : 3) && hs > (opts.skip ? 6 : 9.5) && vn0 > -(opts.skip ? 9 : 6.5);
          if (canSkip) {
            skips++; y = s2.h + BALL_R + 0.02; vy = Math.max(2.2, -vy * 0.55); vx *= 0.84; vz *= 0.84; ev("skip");
          } else { outcome = sf.liquid; y = s2.h; ev(sf.liquid === "lava" ? "lava" : "splash"); rec(); break; }
        } else {
          y = s2.h + BALL_R;
          const vn = vx * nx + vy * ny + vz * nz;
          if (wasAir) { const vi = Math.abs(vn); if (vi > 2.2) ev("bounce", { s: surf, v: +vi.toFixed(1) }); }
          if (vn < 0) {
            let e = sf.e; if (-vn < 1.6 && surf !== S.BOUNCY) e = 0;
            if (shot.lob && surf !== S.BOUNCY) e *= 0.4;
            vx -= (1 + e) * vn * nx; vy -= (1 + e) * vn * ny; vz -= (1 + e) * vn * nz;
            if (-vn > 2) { const base = (surf === S.SAND && opts.sandPro) ? 0.8 : sf.damp; const d = 1 - (1 - base) * Math.min(1.25, Math.max(0.35, -vn / 8)); vx *= d; vz *= d; if (shot.lob) { vx *= 0.8; vz *= 0.8; } }
          }
          // frottement de roulement quand la balle colle au sol
          const vn2 = vx * nx + vy * ny + vz * nz;
          if (Math.abs(vn2) < 1.2) {
            let roll = sf.roll, rv = sf.rollv; if (opts.ice) { roll = SURF[S.ICE].roll; rv = SURF[S.ICE].rollv; }
            const tx = vx - vn2 * nx, ty = vy - vn2 * ny, tz = vz - vn2 * nz; const ts = Math.sqrt(tx * tx + ty * ty + tz * tz);
            if (ts > 1e-6) { const k = Math.max(0, ts - roll * DT) / ts * Math.exp(-rv * DT); vx = vx - tx + tx * k; vy = vy - ty + ty * k; vz = vz - tz + tz * k; }
            // arrêt quand la pente ne retient plus assez
            const slope = Math.sqrt(s2.gx * s2.gx + s2.gz * s2.gz);
            const sp2 = Math.sqrt(vx * vx + vy * vy + vz * vz);
            if (sp2 < 0.22 && slope / Math.sqrt(1 + slope * slope) < sf.stick) { vx = vy = vz = 0; }
          }
        }
        lastDry.x = x; lastDry.z = z;
        // trampolines et tapis d'accélération
        if (!sf.liquid) {
          const trs = hole.tramps || [];
          for (let q = 0; q < trs.length; q++) { const tr = trs[q]; const dx = x - tr.x, dz = z - tr.z; if (dx * dx + dz * dz < tr.r * tr.r && vy < tr.vy * 0.6) { vy = tr.vy; ev("tramp"); break; } }
          const pds = hole.pads || [];
          for (let q = 0; q < pds.length; q++) {
            const pd = pds[q]; const dx = x - pd.x, dz = z - pd.z; const c = Math.cos(pd.ang), s = Math.sin(pd.ang);
            const lu = dx * s + dz * c, lv = dx * c - dz * s; // u le long de la flèche, v en travers
            if (Math.abs(lu) < pd.l / 2 && Math.abs(lv) < pd.w / 2) {
              const sdir = s, cdir = c; const cur = vx * sdir + vz * cdir;
              if (cur < pd.power) { const add = Math.min(pd.power - cur, 60 * DT * 4); vx += sdir * add; vz += cdir * add; }
              if (step % 24 === 0) ev("boost");
            }
          }
        }
      }
      wasAir = y - BALL_R > s2.h + 0.03;

      // obstacles circulaires
      const gr = w.grid; const gi = Math.floor((x - w.ox) / gr.cs), gj = Math.floor((z - w.oz) / gr.cs);
      if (gi >= 0 && gj >= 0 && gi < gr.gx && gj < gr.gz) {
        const lst = gr.cells[gj * gr.gx + gi];
        if (lst) for (let q = 0; q < lst.length; q++) {
          const o = lst[q];
          if (y - BALL_R > (o.h || 3) + (s2.h > 0 ? 0 : 0)) continue;
          const dx = x - o.x, dz = z - o.z; const need = o.r + BALL_R; const d2 = dx * dx + dz * dz;
          if (d2 < need * need) {
            const d = Math.sqrt(d2) || 1e-6; const cx = dx / d, cz = dz / d;
            const vn = vx * cx + vz * cz;
            x = o.x + cx * need; z = o.z + cz * need;
            if (vn < 0) {
              const e = o.e || 0.5; vx -= (1 + e) * vn * cx; vz -= (1 + e) * vn * cz;
              if (o.bumper) { const hs = Math.sqrt(vx * vx + vz * vz); if (hs < o.kick) { vx = cx * o.kick; vz = cz * o.kick; } vy = Math.max(vy, 2); }
              if (o.bouncy) vy = Math.max(vy, 5 + Math.abs(vn) * 0.4);
              if (-vn > 2.5) ev(o.bumper ? "bumper" : "hit", { o: o.k || "x", v: +(-vn).toFixed(1) });
            }
          }
        }
      }
      // pales de moulin et barrières
      const bars = hole.bars || [];
      for (let q = 0; q < bars.length; q++) {
        const b = bars[q]; const be = barEnds(b, tAbs); const om = b.omega;
        const cxm = (be.x1 + be.x2) / 2, czm = (be.z1 + be.z2) / 2;
        // vitesse de la pale au point le plus proche
        const c = closestOnSeg(x, z, be.x1, be.z1, be.x2, be.z2);
        const wvx = -om * (c.z - czm), wvz = om * (c.x - cxm);
        const r = hitSeg(be.x1, be.z1, be.x2, be.z2, b.thick / 2, 1.6, 0.55, wvx, wvz);
        if (r > 2.5) ev("hit", { o: "pale", v: +r.toFixed(1) });
      }
      const sls = hole.sliders || [];
      for (let q = 0; q < sls.length; q++) {
        const b = sls[q]; const se = sliderEnds(b, tAbs);
        const r = hitSeg(se.x1, se.z1, se.x2, se.z2, b.thick / 2, 1.6, 0.5, se.vx, se.vz);
        if (r > 2.5) ev("hit", { o: "barriere", v: +r.toFixed(1) });
      }
      for (let q = 0; q < walls.length; q++) {
        const wl = walls[q]; const r = hitSeg(wl.x1, wl.z1, wl.x2, wl.z2, 0.22, wl.h || 1.8, 0.45, 0, 0);
        if (r > 2.5) ev("hit", { o: "mur", v: +r.toFixed(1) });
      }
      // portails
      if (portalCool === 0) {
        const pts = hole.portals || [];
        for (let q = 0; q < pts.length; q++) {
          const p = pts[q];
          for (let side = 0; side < 2; side++) {
            const a = side ? p.b : p.a, b = side ? p.a : p.b;
            const dx = x - a.x, dz = z - a.z;
            if (dx * dx + dz * dz < p.r * p.r && y - BALL_R < heightAt(hole, a.x, a.z) + 1.4) {
              const rot = (b.ang || 0) - (a.ang || 0); const c = Math.cos(rot), s = Math.sin(rot);
              const nvx = vx * c - vz * s, nvz = vx * s + vz * c; vx = nvx; vz = nvz;
              ev("portal", { to: [+b.x.toFixed(2), +b.z.toFixed(2)] });
              x = b.x; z = b.z; y = heightAt(hole, b.x, b.z) + BALL_R + 0.1;
              // image de saut dans la trajectoire
              frames.push(Math.round(x * 100), Math.round(y * 100), Math.round(z * 100));
              portalCool = 120; side = 2; q = pts.length;
            }
          }
        }
      }
      // orbes
      if (orbs.length) {
        for (let q = 0; q < orbs.length; q++) {
          const o = orbs[q]; if (o.taken) continue;
          const dx = x - o.x, dz = z - o.z;
          if (dx * dx + dz * dz < 1.15 * 1.15 && Math.abs(y - (heightAt(hole, o.x, o.z) + 0.9)) < 1.6) { o.taken = true; picked.push(o.id); ev("orb", { id: o.id }); }
        }
      }
      // trou
      {
        const dx = x - cup.x, dz = z - cup.z; const d2 = dx * dx + dz * dz;
        if (d2 < cupR * cupR) {
          const hc = heightAt(hole, cup.x, cup.z); const hs = Math.sqrt(vx * vx + vz * vz);
          if (y - BALL_R < hc + 0.28 && hs < (opts.magnet ? 9.5 : 7.2)) { outcome = "sunk"; x = cup.x; z = cup.z; y = hc - 0.15; ev("sunk"); rec(); break; }
        }
      }
      // fin du coup
      const sp3 = vx * vx + vy * vy + vz * vz;
      if (sp3 < 0.0009 && y - BALL_R <= s2.h + 0.02) { stillSteps++; if (stillSteps > 100) break; } else stillSteps = 0;
      if (y < -60) { outcome = "ob"; ev("ob"); break; }
      step++;
      if (step % REC === 0) rec();
    }
    if (outcome === "rest" && step >= maxSteps) outcome = "rest";
    if (frames.length / 3 < 2 || (frames[frames.length - 3] !== Math.round(x * 100) || frames[frames.length - 1] !== Math.round(z * 100))) rec();
    return { frames, events, outcome, end: { x, y, z }, dur: (frames.length / 3 - 1) / 30, lastDry, picked };
  }

  return { BALL_R, DT, S, SURF, prepare, sample, heightAt, surfAt, barEnds, sliderEnds, closestOnSeg, simulate };
});

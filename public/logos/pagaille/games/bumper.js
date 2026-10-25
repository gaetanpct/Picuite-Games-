// Choc au sommet. Une arène flottante, des coups de bélier, des écrasements de sol et des dégâts qui font reculer de plus en plus loin.
// Plus on est touché, plus on vole loin. Des bumpers, des vagues et des météores secouent l'arène, qui finit par rétrécir.
const U = require("../pg-util.js");
const Plat = require("../pg-plat.js");
const Surv = require("../pg-surv.js");

exports.create = function (ctx) {
  const rnd = ctx.rnd; const n = ctx.n; const mode = ctx.opts.bumperEvents || "normal"; const SZ0 = 640 + n * 36; let sz = SZ0; const CX = 0, CY = 0;
  const world = new Plat.World(); const arena = world.add({ x: CX, y: CY, z: -60, w: sz, d: sz, h: 60, e: 0.05 });
  const posts = []; if (n >= 3) [[-1, -1], [1, -1], [-1, 1], [1, 1]].slice(0, n >= 6 ? 4 : 2).forEach((q, i) => { const px = q[0] * SZ0 * 0.2, py = q[1] * SZ0 * 0.2; const b = world.add({ x: px, y: py, z: 0, w: 58, d: 58, h: 64, e: 1.5 }); posts.push({ b, id: "bp" + i }); });
  const cfg = { maxV: 290 * ctx.speed, accG: ctx.heavy ? 1000 : 2500, accA: 1400, jumpV: 600, maxJumps: 1, g: 1800, kill: -420, diveV: 540, diveCd: 1.25 };
  const S = Surv.setup(ctx, world, cfg, { spawn: (i, nn) => { const a = (i / nn) * 6.283; return { x: Math.cos(a) * sz * 0.33, y: Math.sin(a) * sz * 0.33, z: 2, face: a + 3.14 }; }, killZ: -420, shove: 1.5, human: (p, i, e) => { p.hReq = e.b; return { x: i.x, y: i.y, jump: e.b && p.bd.grounded, jh: i.b, dive: e.a }; } });
  S.P.forEach((p) => { p.dmg = 0; p.ejects = 0; p.lastBy = null; p.lastAt = -9; p.slam = 0; p.slamCd = 0; p.hitSet = new Set(); p.ex.wasDive = 0; });
  let t = 0, waveIn = mode === "aucun" ? 1e9 : 9, meteorIn = mode === "aucun" ? 1e9 : 14; let wave = null; const meteors = []; let mid = 0; const craters = [];
  const evScale = mode === "chaos" ? 0.55 : 1;
  const hit = (a, b, f, why) => { if (!b || b.dead) return; const k = (f || 1) * (1 + b.dmg / 60); const dx = b.bd.x - a.x, dy = b.bd.y - a.y, d = Math.hypot(dx, dy) || 1; b.bd.vx += dx / d * 255 * k; b.bd.vy += dy / d * 255 * k; b.bd.vz = Math.max(b.bd.vz, 160); b.bd.fric = 0.1; b.dmg += 8 + rnd() * 6; if (a.id) { b.lastBy = a.id; b.lastAt = t; } ctx.fx("hit", b.bd.x, b.bd.y, b.bd.z + 24, ""); ctx.snd("bump"); };
  function slamLand(p) { const b = p.bd; ctx.fx("ring", b.x, b.y, b.z + 2, "#ffd23b"); ctx.fx("puff", b.x, b.y, b.z, ""); ctx.snd("boom"); ctx.shake(1.5); S.alive().forEach((q) => { if (q === p || !q.bd.grounded) return; const d = Math.hypot(q.bd.x - b.x, q.bd.y - b.y); if (d < 150) hit({ x: b.x, y: b.y, id: p.id }, q, (1 - d / 150) * 1.35 + 0.25); }); }
  function bot(p, dt) {
    const b = p.bd, sk = ctx.skill(p.id), ex = p.ex; ex.think = (ex.think || 0) - dt; const inp = { x: 0, y: 0, jump: false, jh: false, dive: false };
    const edge = Math.min(sz / 2 - Math.abs(b.x), sz / 2 - Math.abs(b.y));
    if (!b.grounded && b.z < -40 || b.z < -4 && !Plat.groundAt(world, b.x, b.y, b.z + 40, b.z - 60)) { // on est au dessus du vide, on remonte
      inp.x = -b.x / (Math.hypot(b.x, b.y) || 1); inp.y = -b.y / (Math.hypot(b.x, b.y) || 1); if (b.jumps < 2 && b.vz < 100 && b.z > -300 && rnd() < 0.6 + sk * 0.3) { inp.jump = true; inp.jh = true; } return inp;
    }
    if (ex.think <= 0 || !ex.tg || ex.tg.dead) { ex.think = 0.2 + (1 - sk) * 0.4; let best = null, bs = -1e9; S.alive().forEach((q) => { if (q === p) return; const d = Math.hypot(q.bd.x - b.x, q.bd.y - b.y); const e = sz / 2 - Math.max(Math.abs(q.bd.x), Math.abs(q.bd.y)); const s = -d * 0.5 + q.dmg * 1.2 + (sk > 0.5 ? (120 - e) * 0.8 : 0) + (rnd() - 0.5) * (1 - sk) * 200; if (s > bs) { bs = s; best = q; } }); ex.tg = best; }
    const tg = ex.tg; if (!tg) return inp;
    let tx = tg.bd.x + tg.bd.vx * 0.15, ty = tg.bd.y + tg.bd.vy * 0.15; const d = Math.hypot(tx - b.x, ty - b.y);
    // reste loin du bord. si c'est trop près du bord on revient vers le centre
    if (edge < 70 + (1 - sk) * 30) { tx = b.x * 0.3; ty = b.y * 0.3; }
    // attaque à l'opposé du centre pour pousser la cible vers le bord
    const w = Surv.walk(b, tx, ty, 0.8 + sk * 0.2, 8); inp.x = w.x; inp.y = w.y;
    ex.cw = (ex.cw || 0) - dt; if (d < 95 && b.diveCd <= 0 && b.grounded && ex.cw <= 0 && rnd() < 0.12 + sk * 0.2) { inp.dive = true; ex.cw = 0.5 + rnd() * 1.6 * (1.3 - sk); }
    else if (d < 60 && p.slamCd <= 0 && b.grounded && sk > 0.4 && rnd() < 0.05 * sk) { inp.jump = true; inp.jh = true; ex.slamNext = true; }
    if (!b.grounded && ex.slamNext && b.vz < 60 && p.slamCd <= 0) { inp.slamNow = true; ex.slamNext = false; }
    return inp;
  }
  const inst = {
    done: false,
    update(dt) {
      t += dt; S.P.forEach((p) => { p.slamCd = Math.max(0, p.slamCd - dt); });
      const botFn = (p, d2) => { const i = bot(p, d2); p.slamReq = !!i.slamNow; p.hReq = false; return i; };
      S.update(dt, botFn, (p, ev) => {
        const b = p.bd; if (b.fric != null && b.fric < 1) b.fric = Math.min(1, b.fric + dt * 1.8);
        if ((p.hReq || p.slamReq) && !b.grounded && b.z > 25 && p.slamCd <= 0 && !p.slam) { p.slam = 1; p.slamCd = 1.6; b.vz = -980; b.vx *= 0.3; b.vy *= 0.3; ctx.snd("whoosh"); }
        else if (p.slam && b.grounded) { slamLand(p); p.slam = 0; }
        if (b.dive > 0) { S.alive().forEach((q) => { if (q === p || p.hitSet.has(q.id)) return; if (Math.hypot(q.bd.x - b.x, q.bd.y - b.y) < 38 && Math.abs(q.bd.z - b.z) < 40) { p.hitSet.add(q.id); hit(b, q, 1.45); } }); } else if (p.hitSet.size) p.hitSet.clear();
      });
      // arène qui rétrécit
      if (t > 22 && sz > SZ0 * 0.55) { sz = Math.max(SZ0 * 0.55, sz - dt * (mode === "chaos" ? 14 : 8)); arena.w = arena.d = sz; }
      // vague qui traverse l'arène
      waveIn -= dt; if (waveIn <= 0 && !wave) { const dir = rnd() < 0.5 ? 1 : -1; const axis = rnd() < 0.5 ? 0 : 1; const b = world.add({ x: axis ? 0 : -dir * (sz / 2 + 50), y: axis ? -dir * (sz / 2 + 50) : 0, z: 0, w: axis ? sz + 80 : 34, d: axis ? 34 : sz + 80, h: 46, e: 1.3 }); wave = { b, dir, axis, spd: 150 + n * 6 }; ctx.announce("Une vague arrive, saute par dessus", 1500); ctx.snd("whoosh"); }
      if (wave) { const adv = wave.dir * wave.spd * dt; if (wave.axis) wave.b.y += adv; else wave.b.x += adv; const done = Math.abs(wave.axis ? wave.b.y : wave.b.x) > sz / 2 + 80; wave.b.vx = wave.axis ? 0 : wave.dir * wave.spd; wave.b.vy = wave.axis ? wave.dir * wave.spd : 0; if (done) { wave.b.solid = false; world.boxes.splice(world.boxes.indexOf(wave.b), 1); wave = null; waveIn = (14 + rnd() * 8) * evScale; } }
      // météores
      meteorIn -= dt; if (meteorIn <= 0) { meteorIn = (15 + rnd() * 6) * evScale; const k = mode === "chaos" ? 3 : 2; for (let i = 0; i < k; i++) { const a = rnd() * 6.283, d = Math.sqrt(rnd()) * sz * 0.4; meteors.push({ id: "m" + (mid++), x: Math.cos(a) * d, y: Math.sin(a) * d, r: 70, at: t + 2.1 }); } ctx.announce("Météores, regarde les cercles rouges", 1800); }
      for (let i = meteors.length - 1; i >= 0; i--) { const m = meteors[i]; if (t >= m.at) { meteors.splice(i, 1); ctx.fx("boom", m.x, m.y, 0, "#ff9a3a"); ctx.snd("boom"); ctx.shake(2.5); craters.push({ id: m.id, x: m.x, y: m.y, r: m.r * 0.55, at: t }); S.alive().forEach((q) => { const d = Math.hypot(q.bd.x - m.x, q.bd.y - m.y); if (d < m.r * 1.9) hit({ x: m.x, y: m.y }, q, (1 - d / (m.r * 1.9)) * 1.6 + 0.3); }); } }
      while (craters.length && t - craters[0].at > 6) craters.shift();
      // attribution des éjections
      S.P.forEach((p) => { if (p.dead && !p.credited) { p.credited = true; if (p.lastBy && t - p.lastAt < 4) { const o = S.byId(p.lastBy); if (o && o !== p) { o.ejects++; ctx.announce(o.name + " éjecte " + p.name, 1500); } } } });
      if (S.alive().length <= 1 && ctx.n > 1) inst.done = true;
    },
    scene() { return { w: 1100, h: 1100, cam: { tilt: 60, fov: 40, pad: 1.12, c: [0, 0], ht: 40 }, env: { sky: ["#3b1c5e", "#ff7aa8"], fog: "#6a2a6e", fogN: 70, fogF: 250, ground: { c: "#2a1148", z: -500 }, lt: { h: ["#ffe0ee", "#6a4a8a"], hi: 1, d: "#fff1d8", di: 0.95, dir: [-0.3, 1, 0.5] } }, items: [{ t: "deco", kind: "cloud", x: -600, y: -400, z: -80, s: 3 }, { t: "deco", kind: "cloud", x: 600, y: 450, z: -60, s: 3 }] }; },
    frame() {
      const items = [{ t: "box", id: "arena", x: 0, y: 0, z: -60, w: sz, d: sz, h: 60, c: "#ffb347", sm: 20 }, { t: "box", id: "rim", x: 0, y: 0, z: -66, w: sz + 14, d: sz + 14, h: 8, c: "#ff4da6", m: "neon", ns: 1, sm: 20 }];
      posts.forEach((q) => items.push({ t: "cyl", id: q.id, x: q.b.x, y: q.b.y, z: 0, r: 30, h: 64, c: "#ff4da6", m: "neon" }));
      craters.forEach((c) => items.push({ t: "disc", id: "c" + c.id, x: c.x, y: c.y, z: 1, r: c.r, c: "#5a3a2a", a: 0.5 }));
      meteors.forEach((m) => { const k = 1 - (m.at - t) / 2.1; items.push({ t: "ring", id: "r" + m.id, x: m.x, y: m.y, z: 1, r: m.r, c: "#ff4d4d", a: 0.8 }); items.push({ t: "disc", id: "q" + m.id, x: m.x, y: m.y, z: 1, r: m.r * Math.max(0.1, k), c: "#ff6b3d", a: 0.3 }); });
      if (wave) items.push({ t: "box", id: "wave", x: wave.b.x, y: wave.b.y, z: 0, w: wave.b.w, d: wave.b.d, h: 46, c: "#4dd2ff", m: "neon", sm: 40 });
      S.pawns((p) => { const q = S.byId(p.id); return { tilt: q.slam ? 0.6 : undefined, badge: q.dmg >= 100 ? "💥" : "", st: q.dmg >= 100 ? "hot" : "" }; }).forEach((it) => items.push(it));
      return { w: 1100, h: 1100, items, hud: { title: "Pousse les autres hors de l'arène", chips: [{ text: S.alive().length + " debout" }, { text: "Arène " + Math.round(sz / 10) + " m" }], prog: null } };
    },
    priv(pid) { const p = S.byId(pid); if (!p) return null; return { dead: p.dead ? 1 : 0, deadText: "Tu es tombé, regarde la suite", bars: p.dead ? null : [{ label: "Dégâts", pct: Math.min(100, p.dmg), c: p.dmg > 80 ? "#ff4d4d" : p.dmg > 45 ? "#ffb347" : "#7ed957" }] }; },
    ranking() { const bonus = {}; const top = S.P.slice().sort((a, b) => b.ejects - a.ejects)[0]; if (top && top.ejects >= 2) bonus[top.id] = 2; return S.ranking({ bonus, note: (p) => (p.dead ? "Éjecté après " + Math.round(p.deadAt) + " s" : "Dernier debout") + (p.ejects ? ", " + p.ejects + " éjection" + (p.ejects > 1 ? "s" : "") : ""), headline: "🥊 Maître de l'arène" }); },
  };
  return inst;
};

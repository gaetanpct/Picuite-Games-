// Choc au sommet, nouvelle version. Deux boutons seulement. Espace pour frapper en fonçant, Maj pour parer.
// Chaque coup encaissé monte le pourcentage de dégâts et fait voler de plus en plus loin. Une parade réussie annule le coup et fait vaciller l'attaquant.
// Le sommet au centre soigne ceux qui s'y tiennent. L'arène rétrécit par paliers annoncés. Le dernier debout gagne.
const U = require("../pg-util.js");
const Plat = require("../pg-plat.js");
const Surv = require("../pg-surv.js");

const GUARD_T = 0.55, GUARD_CD = 1.7, STUN_T = 0.85;
exports.create = function (ctx) {
  const rnd = ctx.rnd; const n = ctx.n; const mode = ctx.opts.bumperEvents || "normal"; const SZ0 = 600 + n * 34; let sz = SZ0;
  const world = new Plat.World(); const arena = world.add({ x: 0, y: 0, z: -60, w: sz, d: sz, h: 60, e: 0.05 });
  const posts = []; if (mode !== "aucun" && n >= 3) [[-1, -1], [1, 1], [1, -1], [-1, 1]].slice(0, n >= 6 ? 4 : 2).forEach((q, i) => { const b = world.add({ x: q[0] * SZ0 * 0.27, y: q[1] * SZ0 * 0.27, z: 0, w: 52, d: 52, h: 60, e: 1.6 }); posts.push({ b, id: "bp" + i }); });
  const cfg = { maxV: 285 * ctx.speed, accG: ctx.heavy ? 1000 : 2500, accA: 1200, jumpV: 0, maxJumps: 0, g: 1800, kill: -420, diveV: 450, diveCd: 0.9 };
  const S = Surv.setup(ctx, world, cfg, { spawn: (i, nn) => { const a = (i / nn) * 6.283; return { x: Math.cos(a) * sz * 0.34, y: Math.sin(a) * sz * 0.34, z: 2, face: a + 3.14 }; }, killZ: -420, shove: 1.35, human: (p, i, e) => { p.gReq = !!e.b; return { x: i.x, y: i.y, dive: e.a }; } });
  S.P.forEach((p) => { p.dmg = 0; p.ejects = 0; p.lastBy = null; p.lastAt = -9; p.guard = 0; p.guardCd = 0; p.stunV = 0; p.hitSet = new Set(); p.parries = 0; p.reign = 0; p.hits = 0; });
  let t = 0, nextShrink = 24, shrinkN = 0, warn = 0, meteorIn = mode === "aucun" ? 1e9 : 15; const meteors = []; let mid = 0; const craters = [];
  const evScale = mode === "chaos" ? 0.55 : 1; const SUMMIT = 78;
  const shrinkTo = [0.86, 0.72, 0.6];
  function hit(from, b, f, dmgBase) {
    if (!b || b.dead) return false;
    if (b.guard > 0) { // parade réussie. pas de dégâts, l'attaquant vacille
      b.parries++; b.guard = 0; ctx.fx("ring", b.bd.x, b.bd.y, b.bd.z + 4, "#6cc7ff"); ctx.snd("stab");
      if (from.id) { const a = S.byId(from.id); if (a) { a.bd.stun = STUN_T; const dx = a.bd.x - b.bd.x, dy = a.bd.y - b.bd.y, d = Math.hypot(dx, dy) || 1; a.bd.vx = dx / d * 240; a.bd.vy = dy / d * 240; a.bd.dive = 0; ctx.announce(b.name + " pare le coup de " + a.name, 1300); } }
      return false;
    }
    const k = (f || 1) * (1 + b.dmg / 55); const dx = b.bd.x - from.x, dy = b.bd.y - from.y, d = Math.hypot(dx, dy) || 1;
    b.bd.vx += dx / d * 205 * k; b.bd.vy += dy / d * 205 * k; b.bd.vz = Math.max(b.bd.vz, 120); b.bd.fric = 0.12; b.bd.stun = Math.max(b.bd.stun, 0.18);
    b.dmg += (dmgBase || 9) * (0.85 + rnd() * 0.3); if (from.id) { b.lastBy = from.id; b.lastAt = t; const a = S.byId(from.id); if (a) a.hits++; }
    ctx.fx("hit", b.bd.x, b.bd.y, b.bd.z + 24, ""); ctx.snd("bump"); return true;
  }
  function bot(p, dt) {
    const b = p.bd, sk = ctx.skill(p.id), ex = p.ex; ex.think = (ex.think || 0) - dt; const inp = { x: 0, y: 0, dive: false }; p.gReq = false;
    if (b.z < -4 && !Plat.groundAt(world, b.x, b.y, b.z + 40, b.z - 60)) { const m = Math.hypot(b.x, b.y) || 1; inp.x = -b.x / m; inp.y = -b.y / m; return inp; }
    const edge = sz / 2 - Math.max(Math.abs(b.x), Math.abs(b.y)); const foes = S.alive().filter((q) => q !== p);
    // la parade se déclenche quand un adversaire fonce sur soi
    if (p.guardCd <= 0 && p.guard <= 0 && rnd() < dt * (4 + sk * 14)) { const th = foes.find((q) => q.bd.dive > 0.12 && Math.hypot(q.bd.x - b.x, q.bd.y - b.y) < 90 && (q.bd.vx * (b.x - q.bd.x) + q.bd.vy * (b.y - q.bd.y)) > 0); if (th && rnd() < 0.25 + sk * 0.6) { p.gReq = true; return inp; } }
    if (ex.think <= 0 || !ex.tg || ex.tg.dead) { ex.think = 0.25 + (1 - sk) * 0.4; let best = null, bs = -1e9; foes.forEach((q) => { const d = Math.hypot(q.bd.x - b.x, q.bd.y - b.y); const e = sz / 2 - Math.max(Math.abs(q.bd.x), Math.abs(q.bd.y)); const s = -d * 0.5 + q.dmg * 1.1 + (sk > 0.5 ? (130 - e) * 0.8 : 0) + (rnd() - 0.5) * (1 - sk) * 220; if (s > bs) { bs = s; best = q; } }); ex.tg = best; }
    const tg = ex.tg; if (!tg) return inp;
    let tx = tg.bd.x + tg.bd.vx * 0.15, ty = tg.bd.y + tg.bd.vy * 0.15; const d = Math.hypot(tx - b.x, ty - b.y);
    if (edge < 66 + (1 - sk) * 30) { tx = b.x * 0.25; ty = b.y * 0.25; }
    else if (p.dmg > 55 && sk > 0.4) { tx = 0; ty = 0; } // blessé, on file se soigner au sommet
    const w = Surv.walk(b, tx, ty, 0.85 + sk * 0.15, 8); inp.x = w.x; inp.y = w.y;
    ex.cw = (ex.cw || 0) - dt; const ux = (tx - b.x) / (d || 1), uy = (ty - b.y) / (d || 1); const land = Math.max(Math.abs(b.x + ux * 175), Math.abs(b.y + uy * 175)); if (d < 92 && b.diveCd <= 0 && b.grounded && ex.cw <= 0 && land < sz / 2 - 28 && rnd() < 0.15 + sk * 0.25) { inp.dive = true; ex.cw = 0.4 + rnd() * 1.4 * (1.3 - sk); }
    return inp;
  }
  const inst = {
    done: false,
    update(dt) {
      t += dt; S.P.forEach((p) => { p.guard = Math.max(0, p.guard - dt); p.guardCd = Math.max(0, p.guardCd - dt); });
      S.update(dt, bot, (p) => {
        const b = p.bd; if (b.fric != null && b.fric < 1) b.fric = Math.min(1, b.fric + dt * 1.8);
        if (p.gReq && p.guardCd <= 0 && p.guard <= 0 && b.stun <= 0) { p.guard = GUARD_T; p.guardCd = GUARD_CD; ctx.snd("whoosh"); } p.gReq = false;
        if (b.dive > 0) { S.alive().forEach((q) => { if (q === p || p.hitSet.has(q.id)) return; const dx = q.bd.x - b.x, dy = q.bd.y - b.y; if (Math.hypot(dx, dy) < 40 && Math.abs(q.bd.z - b.z) < 40) { p.hitSet.add(q.id); hit({ x: b.x, y: b.y, id: p.id }, q, 1.0, 9); } }); } else if (p.hitSet.size) p.hitSet.clear();
        if (b.grounded && Math.hypot(b.x, b.y) < SUMMIT) { p.dmg = Math.max(0, p.dmg - 3.2 * dt); p.reign += dt; }
      });
      // l'arène rétrécit par paliers, prévenus quelques secondes avant
      if (shrinkN < shrinkTo.length && t > nextShrink - 4 && !warn) { warn = 1; ctx.announce("L'arène va rétrécir", 1800); ctx.snd("count"); }
      if (shrinkN < shrinkTo.length && t >= nextShrink) { shrinkN++; warn = 0; nextShrink = t + 17; ctx.shake(2); }
      const goal = SZ0 * (shrinkN ? shrinkTo[shrinkN - 1] : 1); if (sz > goal) { sz = Math.max(goal, sz - dt * 26); arena.w = arena.d = sz; }
      if (t > 85 && sz > SZ0 * 0.4) { sz = Math.max(SZ0 * 0.4, sz - dt * 14); arena.w = arena.d = sz; }
      meteorIn -= dt; if (meteorIn <= 0) { meteorIn = (16 + rnd() * 6) * evScale; const k = mode === "chaos" ? 3 : 2; for (let i = 0; i < k; i++) { const a = rnd() * 6.283, d = Math.sqrt(rnd()) * sz * 0.4; meteors.push({ id: "m" + (mid++), x: Math.cos(a) * d, y: Math.sin(a) * d, r: 70, at: t + 2.1 }); } ctx.announce("Météores, regarde les cercles rouges", 1800); }
      for (let i = meteors.length - 1; i >= 0; i--) { const m = meteors[i]; if (t >= m.at) { meteors.splice(i, 1); ctx.fx("boom", m.x, m.y, 0, "#ff9a3a"); ctx.snd("boom"); ctx.shake(2.5); craters.push({ id: m.id, x: m.x, y: m.y, r: m.r * 0.55, at: t }); S.alive().forEach((q) => { const d = Math.hypot(q.bd.x - m.x, q.bd.y - m.y); if (d < m.r * 1.9) { q.guard = 0; hit({ x: m.x, y: m.y }, q, (1 - d / (m.r * 1.9)) * 1.5 + 0.3, 7); } }); } }
      while (craters.length && t - craters[0].at > 6) craters.shift();
      S.P.forEach((p) => { if (p.dead && !p.credited) { p.credited = true; if (p.lastBy && t - p.lastAt < 4) { const o = S.byId(p.lastBy); if (o && o !== p) { o.ejects++; ctx.announce(o.name + " éjecte " + p.name, 1500); } } } });
      if (S.alive().length <= 1 && ctx.n > 1) inst.done = true;
    },
    scene() { return { w: 1100, h: 1100, cam: { tilt: 60, fov: 40, pad: 1.12, c: [0, 0], ht: 40 }, env: { sky: ["#3b1c5e", "#ff7aa8"], fog: "#6a2a6e", fogN: 70, fogF: 250, ground: { c: "#2a1148", z: -500 }, lt: { h: ["#ffe0ee", "#6a4a8a"], hi: 1, d: "#fff1d8", di: 0.95, dir: [-0.3, 1, 0.5] } }, items: [{ t: "deco", kind: "cloud", x: -600, y: -400, z: -80, s: 3 }, { t: "deco", kind: "cloud", x: 600, y: 450, z: -60, s: 3 }] }; },
    frame() {
      const items = [{ t: "box", id: "arena", x: 0, y: 0, z: -60, w: sz, d: sz, h: 60, c: "#ffb347", sm: 20 }, { t: "box", id: "rim", x: 0, y: 0, z: -66, w: sz + 14, d: sz + 14, h: 8, c: warn ? "#ff3b3b" : "#ff4da6", m: "neon", ns: 1, sm: 20 }, { t: "disc", id: "summit", x: 0, y: 0, z: 1, r: SUMMIT, c: "#ffe27a", a: 0.7 }, { t: "ring", id: "summitr", x: 0, y: 0, z: 2, r: SUMMIT, c: "#fff6c8", w: 4 }];
      posts.forEach((q) => items.push({ t: "cyl", id: q.id, x: q.b.x, y: q.b.y, z: 0, r: 28, h: 60, c: "#ff4da6", m: "neon" }));
      craters.forEach((c) => items.push({ t: "disc", id: "c" + c.id, x: c.x, y: c.y, z: 1, r: c.r, c: "#5a3a2a", a: 0.5 }));
      meteors.forEach((m) => { const k = 1 - (m.at - t) / 2.1; items.push({ t: "ring", id: "r" + m.id, x: m.x, y: m.y, z: 1, r: m.r, c: "#ff4d4d", a: 0.8 }); items.push({ t: "disc", id: "q" + m.id, x: m.x, y: m.y, z: 1, r: m.r * Math.max(0.1, k), c: "#ff6b3d", a: 0.3 }); });
      S.pawns((p) => { const q = S.byId(p.id); return { badge: Math.round(q.dmg) + " %", st: q.dmg >= 100 ? "hot" : q.stunned ? "dizzy" : "" }; }).forEach((it) => items.push(it));
      S.alive().forEach((q) => { if (q.guard > 0) items.push({ t: "sph", id: "sh" + q.id, x: q.bd.x, y: q.bd.y, z: q.bd.z + 22, r: 34, c: "#6cc7ff", a: 0.38 }); });
      return { w: 1100, h: 1100, items, hud: { title: "Espace pour frapper, Maj pour parer, le sommet soigne", chips: [{ text: S.alive().length + " debout" }, { text: "Arène " + Math.round(sz / 10) + " m" }], prog: null } };
    },
    priv(pid) { const p = S.byId(pid); if (!p) return null; return { dead: p.dead ? 1 : 0, deadText: "Tu es tombé, regarde la suite", bars: p.dead ? null : [{ label: "Dégâts", pct: Math.min(100, p.dmg), c: p.dmg > 80 ? "#ff4d4d" : p.dmg > 45 ? "#ffb347" : "#7ed957" }, { label: p.guardCd > 0 ? "Parade en recharge" : "Parade prête", pct: p.guardCd > 0 ? 100 * (1 - p.guardCd / GUARD_CD) : 100, c: "#6cc7ff" }] }; },
    ranking() {
      const bonus = {}; const top = S.P.slice().sort((a, b) => b.ejects - a.ejects)[0]; if (top && top.ejects >= 2) bonus[top.id] = 2;
      const par = S.P.slice().sort((a, b) => b.parries - a.parries)[0]; if (par && par.parries >= 2 && !bonus[par.id]) bonus[par.id] = 1;
      return S.ranking({ bonus, note: (p) => (p.dead ? "Éjecté après " + Math.round(p.deadAt) + " s" : "Dernier debout") + (p.ejects ? ", " + p.ejects + " éjection" + (p.ejects > 1 ? "s" : "") : "") + (p.parries ? ", " + p.parries + " parade" + (p.parries > 1 ? "s" : "") : ""), headline: "🥊 Maître du sommet" });
    },
  };
  return inst;
};

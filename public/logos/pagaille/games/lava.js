// Lave montante. Une tour en spirale, de la lave qui monte de plus en plus vite. On grimpe de dalle en dalle et on reste au sec.
// Les dalles se resserrent et certaines glissent. Le serveur simule tout, bots compris.
const U = require("../pg-util.js");
const Plat = require("../pg-plat.js");

exports.create = function (ctx) {
  const rnd = ctx.rnd; const n = ctx.n; const rate = { lente: 0.72, normal: 1, rapide: 1.4 }[ctx.opts.lavaRise] || 1;
  const world = new Plat.World(); const stat = []; const dyn = []; const plats = [];
  const N = 48 + Math.min(4, Math.floor(n / 2)); const STEP = 70, SLAB = 22, Z0 = 30, GROUND = -260;
  const palette = ["#7ed957", "#b6e04a", "#ffd23b", "#ffa03b", "#ff7a59", "#ff6f91", "#c780ff", "#8fa8ff", "#ffffff"];
  const spin = rnd() < 0.5 ? 1 : -1; const phase = rnd() * 6.28;
  let thAcc = phase, prevSize = 190;
  for (let i = 0; i < N; i++) {
    const k = i / (N - 1); let size = 190 - 70 * k + rnd() * 16; if (i === 0) size = 270; if (i === N - 1) size = 320; const r = 340 + Math.sin(i * 0.8) * 50 + rnd() * 20;
    if (i > 0) { const gap = 62 + 38 * k + rnd() * 26; thAcc += spin * 2 * Math.asin(Math.min(0.95, ((size + prevSize) / 2 + gap) / (2 * r))); } prevSize = size; const th = thAcc;
    const x = Math.cos(th) * r, y = Math.sin(th) * r, top = Z0 + i * STEP + (rnd() - 0.5) * 10; const c = palette[Math.min(palette.length - 1, Math.floor(k * palette.length))];
    const mover = i > 4 && i % 7 === 0 && i < N - 2; const crumble = !mover && i > 9 && i % 6 === 4 && i < N - 2; const rot = th + Math.PI / 2 * 0; const id = "pl" + i;
    const b = world.add({ x, y, z: top - SLAB, w: size, d: size, h: SLAB, rot, e: 0.1 });
    let mv = null; if (mover) { const A = 80, T = 4.6 / Math.max(0.8, ctx.speed), ph = rnd() * 6.28; const ux = Math.cos(th), uy = Math.sin(th); mv = (t) => ({ x: x + ux * Math.sin(t * 6.283 / T + ph) * A, y: y + uy * Math.sin(t * 6.283 / T + ph) * A }); b.move = mv; }
    const P = { i, b, x, y, top, size, c, mover, crumble, id, th, timer: -1, fall: 0, base: top - SLAB, gone: false }; plats.push(P);
    if (crumble) { b.hurt = () => { if (P.timer < 0) { P.timer = 1.25 / Math.max(0.8, ctx.speed); ctx.snd("crack"); } }; }
    if (!mover && !crumble) {
      stat.push({ t: "box", x, y, z: top - SLAB, w: size, d: size, h: SLAB - 6, c: "#59607a", rot });
      stat.push({ t: "box", x, y, z: top - 7, w: size + 4, d: size + 4, h: 7, c, ns: 1, rot });
      stat.push({ t: "box", x, y, z: top - SLAB - 190, w: size * 0.3, d: size * 0.3, h: 190, c: "#3d3b52", rot });
    }
  }
  const last = plats[N - 1]; last.summit = true;
  stat.push({ t: "flag", id: "summit", x: last.x, y: last.y, z: last.top, c: "#ffd23b" });
  // grande colonne au centre et décor
  for (let i = 0; i < 12; i++) stat.push({ t: "deco", kind: "crystal", x: Math.cos(i * 0.52) * 760, y: Math.sin(i * 0.52) * 760, z: GROUND, s: 3 + rnd() * 3, c: "#ff7a3a" });
  for (let i = 0; i < 5; i++) stat.push({ t: "deco", kind: "cloud", x: (rnd() - 0.5) * 1600, y: (rnd() - 0.5) * 1600, z: last.top + 150 + rnd() * 200, s: 4 });

  let t = 0; let lavaZ = -110; const base = rate * Math.min(1.3, ctx.speed) / Math.sqrt(Math.max(0.7, ctx.len)); const startDelay = 4;
  const deadOrder = []; let deadSeq = 0; let summitBy = null; let tag = 0;
  const P = ctx.players.map((m, i) => {
    const a = i / ctx.players.length * 6.283 + plats[0].th; const first = plats[0]; const px = first.x + Math.cos(a) * 85, py = first.y + Math.sin(a) * 85;
    const bd = Plat.body(px, py, first.top + 2, {}); return { id: m.id, k: m.color, name: m.name, bd, best: 0, bestZ: first.top, dead: false, deadAt: 0, deadSeq: 0, cur: 0, tgt: 1, wait: 0, jumpCd: 0, noise: 0, noiseT: 0, camYaw: Math.atan2(-py, -px), lastZ: first.top, pausT: 0, lastIdx: 0 };
  });
  const cfg = { maxV: 295 * ctx.speed * (ctx.heavy ? 0.9 : 1), accG: ctx.heavy ? 1100 : 2600, accA: 1500, diveV: 440 };
  const idxOf = new Map(); plats.forEach((p) => idxOf.set(p.b.n, p.i));
  const platPos = (p) => ({ x: p.b.x, y: p.b.y });

  function botThink(p, dt) {
    const b = p.bd; const sk = ctx.skill(p.id); const inp = { x: 0, y: 0, jump: false, jh: false, dive: false }; p.jumpCd = Math.max(0, p.jumpCd - dt); p.pausT = Math.max(0, p.pausT - dt);
    if (b.grounded && b.ground && idxOf.has(b.ground.n)) { const ci = idxOf.get(b.ground.n); if (ci !== p.cur) { p.cur = ci; p.pausT = (1 - sk) * (0.1 + rnd() * 0.55); } }
    // la lave se rapproche, on arrête de traîner
    const danger = b.z - lavaZ < 260; if (danger) p.pausT = 0;
    // cible. les bons joueurs sautent parfois deux dalles d'un coup
    if (b.grounded && p.cur === N - 1) {
      const sm = plats[N - 1]; const foes = P.filter((q) => q !== p && !q.dead && q.bd.grounded && q.bd.ground === sm.b); let near = null, nd = 1e9; foes.forEach((q) => { const d = Math.hypot(q.bd.x - b.x, q.bd.y - b.y); if (d < nd) { nd = d; near = q; } });
      const cd = Math.hypot(b.x - sm.b.x, b.y - sm.b.y);
      if (near && sk > 0.3) { const ax = near.bd.x - b.x, ay = near.bd.y - b.y, al = Math.hypot(ax, ay) || 1; inp.x = ax / al; inp.y = ay / al; if (nd < 70 && b.diveCd <= 0 && rnd() < 0.05 + sk * 0.12) inp.dive = true; }
      else if (cd > sm.size * 0.28) { inp.x = (sm.b.x - b.x) / cd; inp.y = (sm.b.y - b.y) / cd; }
      return inp;
    }
    let ti = Math.min(N - 1, p.cur + 1); if (sk > 0.5 && p.cur + 2 < N) { const c2 = plats[p.cur + 2]; const d2 = Math.hypot(c2.b.x - b.x, c2.b.y - b.y); if (c2.top - b.z < 118 && d2 < 250 && !c2.mover && rnd() < 0.003 * sk * 30) ti = p.cur + 2; }
    if (b.grounded) p.tgt = ti; const T = plats[Math.min(N - 1, p.tgt)];
    let tx = T.b.x, ty = T.b.y; if (T.mover) { tx += T.b.vx * 0.35; ty += T.b.vy * 0.35; }
    p.noiseT -= dt; if (p.noiseT <= 0) { p.noiseT = 0.35 + rnd() * 0.5; p.noise = (rnd() - 0.5) * (1 - sk) * 0.9; }
    let dx = tx - b.x, dy = ty - b.y; const dist = Math.hypot(dx, dy) || 1; dx /= dist; dy /= dist; const ang = Math.atan2(dy, dx) + (dist < 120 ? 0 : p.noise); dx = Math.cos(ang); dy = Math.sin(ang);
    const edge = dist - T.size / 2;
    if (b.grounded) {
      if (p.pausT > 0) return inp;
      const cp = plats[p.cur]; const onSelf = cp && Plat.over(cp.b, b.x, b.y, -2);
      const ahead = Plat.groundAt(world, b.x + dx * 40, b.y + dy * 40, b.z + 20, b.z - 40);
      let jump = false; const dz = T.top - b.z;
      const wall = Plat.groundAt(world, b.x + dx * 34, b.y + dy * 34, b.z + 130, b.z + 18);
      if (wall != null && p.jumpCd <= 0) jump = true;
      if (ahead == null && p.jumpCd <= 0 && edge < 120 + sk * 40 && dz < 135) jump = true; // bord atteint
      else if (dz > 40 && edge < 120 && p.jumpCd <= 0 && ahead != null) jump = false;
      if (jump && rnd() < (1 - sk) * 0.025) jump = false;
      // si la cible est trop haute ou trop loin, on attend le bon moment ou on s'approche du bord
      inp.x = dx * (0.82 + sk * 0.18); inp.y = dy * (0.82 + sk * 0.18); inp.jump = jump; inp.jh = jump; if (jump) { p.jumpCd = 0.45; p.holdUp = true; }
      if (!jump && ahead == null && edge >= 150 + sk * 40) { inp.x = dx * 0.25; inp.y = dy * 0.25; }
      p.lastZ = b.z;
    } else {
      inp.x = dx; inp.y = dy; inp.jh = b.vz > 0 && b.z - p.lastZ < 95 + sk * 25;
      const below = T.top - b.z; const over = Plat.groundAt(world, b.x, b.y, b.z + 6, b.z - 60);
      if (b.jumps === 1 && b.vz < 20 && p.jumpCd <= 0 && over == null && (below > 12 || edge > 30) && sk > 0.28 && edge < 230 && b.z > lavaZ - 20) { inp.jump = true; inp.jh = true; p.jumpCd = 0.3; }
      if (edge < 0) { inp.x *= 0.45; inp.y *= 0.45; }
    }
    return inp;
  }

  function kill(p, why) {
    const b = p.bd; if (p.dead) return; if (process.env.PGDBG) console.log('DEATH', p.name, 'cur', p.cur, 'tgt', p.tgt, plats[p.cur] && (plats[p.cur].mover ? 'M' : plats[p.cur].crumble ? 'C' : ''), plats[p.tgt] && (plats[p.tgt].mover ? 'M' : plats[p.tgt].crumble ? 'C' : ''), Math.round(b.z), 't', t.toFixed(1)); p.dead = true; p.deadAt = t; p.deadSeq = ++deadSeq; b.alive = false; deadOrder.push(p);
    ctx.fx("lavasplash", b.x, b.y, Math.max(lavaZ, b.z), "#ff7a1a"); ctx.snd("burn"); ctx.shake(2); if (n <= 8) ctx.announce(p.name + " finit dans la lave", 1500);
  }

  const inst = {
    done: false,
    update(dt) {
      t += dt; world.step(dt);
      const ts = Math.max(0, t - startDelay); lavaZ = -110 + base * (32 * ts + 0.75 * ts * ts);
      plats.forEach((q) => { if (!q.crumble || q.gone) return; if (q.timer >= 0) { q.timer -= dt; if (q.timer < 0 && !q.fall) { q.fall = 0.001; ctx.fx("puff", q.x, q.y, q.top, ""); } } if (q.fall) { q.fall += dt; q.b.z -= 260 * q.fall * dt * 3; if (q.fall > 0.25) q.b.solid = false; if (q.b.z < GROUND) q.gone = true; } });
      P.forEach((p) => {
        const b = p.bd; if (p.dead) return;
        let inp; if (ctx.isBot(p.id)) inp = botThink(p, dt); else { const i = ctx.input(p.id); const e = ctx.edge(p.id); inp = { x: i.x, y: i.y, jump: e.a, jh: i.a, dive: e.b }; }
        const ev = Plat.step(world, b, inp, dt, cfg);
        ev.forEach((e) => { if (e === "jump" || e === "dbl") { ctx.snd("jump"); ctx.fx("puff", b.x, b.y, b.z, ""); } else if (e === "land") { ctx.snd("land"); ctx.fx("puff", b.x, b.y, b.z, ""); } else if (e === "dive") ctx.snd("whoosh"); else if (e === "bump") ctx.snd("bump"); });
        if (b.grounded && b.z > p.bestZ) { p.bestZ = b.z; }
        if (b.grounded && b.ground && idxOf.has(b.ground.n)) { const ii = idxOf.get(b.ground.n); if (ii > p.best) { p.best = ii; if (ii === N - 1 && !summitBy) { summitBy = p; ctx.fx("confetti", b.x, b.y, b.z + 40, ""); ctx.snd("win"); ctx.announce(p.name + " atteint le sommet", 2400); } } }
        if (b.z < lavaZ - 8 || ev.includes("void")) kill(p);
      });
      Plat.separate(P.filter((p) => !p.dead).map((p) => p.bd), { shove: 1.15 });
      // étincelles qui montent de la lave
      if (rnd() < dt * 8) { const a = rnd() * 6.283, r = 80 + rnd() * 500; ctx.fx("spark", Math.cos(a) * r, Math.sin(a) * r, lavaZ + 4, "#ff9a3a"); }
      const alive = P.filter((p) => !p.dead);
      if (alive.length <= 1 && n > 1) { if (alive.length === 1) { alive[0].survivor = true; } inst.done = true; }
      if (alive.length > 1 && lavaZ > last.top + 400) inst.done = true;
      // le dernier survivant gagne dès que les autres sont tombés, mais on laisse une petite seconde de suspens
    },
    scene() {
      const R = 900; return { w: R * 2, h: R * 2, cam: { tilt: 62, fov: 42, pad: 1.1, c: [0, 0], ht: 900 }, env: { sky: ["#2a0e1e", "#ff7a3a"], fog: "#5a1a22", fogN: 70, fogF: 260, ground: { c: "#ff5a14", m: "lava", z: GROUND + 20 }, lt: { h: ["#ffd9b0", "#6a3a4a"], hi: 1, d: "#ffd9a8", di: 0.9, dir: [-0.5, 1, 0.4] } }, items: stat };
    },
    frame() {
      const items = [];
      items.push({ t: "box", id: "lava", x: 0, y: 0, z: lavaZ - 60, w: 2600, d: 2600, h: 60, c: "#ff6a1a", m: "lava", ns: 1 });
      plats.forEach((p) => { if ((!p.mover && !p.crumble) || p.gone) return; const b = p.b; const shk = p.timer >= 0 && !p.fall ? Math.sin(t * 60) * 3 : 0; items.push({ t: "box", id: p.id, x: b.x + shk, y: b.y, z: b.z, w: p.size, d: p.size, h: SLAB - 6, c: p.crumble ? "#7a5a48" : "#59607a", rot: b.rot, sm: 40 }); items.push({ t: "box", id: p.id + "c", x: b.x + shk, y: b.y, z: b.z + SLAB - 7, w: p.size + 4, d: p.size + 4, h: 7, c: p.crumble ? "#c9a27a" : "#ff9f43", ns: 1, rot: b.rot, sm: 40 }); });
      P.forEach((p) => { if (p.dead) return; items.push(Plat.pawnItem(p.bd, p, { st: summitBy === p ? "win" : "", badge: summitBy === p ? "👑" : "" })); });
      const aliveN = P.filter((p) => !p.dead).length;
      const prog = P.map((p) => ({ id: p.id, k: p.k, n: p.name, p: U.clamp(p.dead ? p.best / (N - 1) : p.bd.z / (last.top), 0, 1), out: p.dead }));
      const gap = Math.max(0, Math.round(Math.min.apply(null, P.filter((p) => !p.dead).map((p) => p.bd.z - lavaZ).concat([9999])) / 10));
      return { w: 1800, h: 1800, items, hud: { title: t < startDelay ? "La lave arrive, prépare toi à grimper" : "Grimpe, la lave monte", prog, chips: [{ text: aliveN + " au sec" }, { text: "Lave à " + Math.round(Math.max(0, lavaZ) / 10) + " m" }] } };
    },
    priv(pid) {
      const p = P.find((x) => x.id === pid); if (!p) return null; let who = p;
      if (p.dead) { const al = P.filter((q) => !q.dead).sort((a, b) => b.bd.z - a.bd.z)[0]; if (al) who = al; }
      const b = who.bd; const want = Math.atan2(-b.y, -b.x); let dY = want - who.camYaw; while (dY > Math.PI) dY -= 6.283; while (dY < -Math.PI) dY += 6.283; who.camYaw += dY * 0.06;
      const cam = { m: "follow", t: [b.x, b.y, Math.max(b.z, lavaZ)], yaw: who.camYaw, d: 340, hg: 440, la: 60 };
      const gap = Math.round((p.bd.z - lavaZ) / 10);
      return { cam, dead: p.dead ? 1 : 0, deadText: p.dead ? "Tu es tombé, regarde la fin de la partie" : "", bars: p.dead ? null : [{ label: "Marge", pct: U.clamp((p.bd.z - lavaZ) / 6, 0, 100), c: p.bd.z - lavaZ < 160 ? "#ff4d4d" : "#7ed957" }] };
    },
    ranking() {
      // les survivants passent devant, puis ceux qui sont tombés le plus tard. Égalité si la chute est dans la même demi-seconde.
      const alive = P.filter((p) => !p.dead).sort((a, b) => b.bd.z - a.bd.z); const dead = P.filter((p) => p.dead).sort((a, b) => b.deadAt - a.deadAt);
      const groups = []; alive.forEach((p) => groups.push([p.id]));
      dead.forEach((p) => { const g = groups[groups.length - 1]; const lp = g && P.find((q) => q.id === g[0]); if (lp && lp.dead && Math.abs(lp.deadAt - p.deadAt) < 0.25) g.push(p.id); else groups.push([p.id]); });
      const bonus = {}, notes = {}; const topBest = P.slice().sort((a, b) => b.best - a.best)[0];
      if (summitBy) bonus[summitBy.id] = 3; else if (topBest && topBest.best > 4) bonus[topBest.id] = 2;
      P.forEach((p) => { notes[p.id] = (p.dead ? "Tombé après " + Math.round(p.deadAt) + " s" : "Encore au sec") + ", " + Math.round(p.bestZ / 10) + " m"; });
      const w = groups[0] && P.find((q) => q.id === groups[0][0]);
      return { groups, bonus, notes, headline: w ? "🌋 " + w.name + " reste au sec le plus longtemps" : "La lave a tout avalé" };
    },
  };
  return inst;
};

// Le Tourniquet. Deux barres tournent au ras du sol sur une grande plateforme ronde.
// On saute par-dessus au bon moment, on ramasse les pièces, et un coup de barre fait voler et perdre des pièces.
const U = require("../pg-util.js");
const Plat = require("../pg-plat.js");
const Surv = require("../pg-surv.js");

exports.create = function (ctx) {
  const rnd = ctx.rnd; const n = ctx.n; const R0 = 360 + n * 14; const CX = R0 + 60, CY = R0 + 60; const WORLD = (R0 + 60) * 2;
  const DUR = Math.round(60 * ctx.len); const BAR_H = 26, BAR_W = 22;
  const world = new Plat.World();
  // la plateforme ronde est faite de dalles carrées, celles qui sortent du cercle sont retirées
  const TS = 80; const tiles = [];
  for (let gx = -R0; gx < R0; gx += TS) for (let gy = -R0; gy < R0; gy += TS) { const x = gx + TS / 2, y = gy + TS / 2; if (Math.hypot(x, y) > R0 - TS * 0.3) continue; const b = world.add({ x: CX + x, y: CY + y, z: -40, w: TS, d: TS, h: 40, e: 0.1 }); tiles.push({ id: "f" + tiles.length, b }); }
  const hub = world.add({ x: CX, y: CY, z: 0, w: 70, d: 70, h: 60, e: 0.4 });
  const cfg = { maxV: 290 * ctx.speed, accG: ctx.heavy ? 1100 : 2500, accA: 1400, jumpV: 560, maxJumps: 1, g: 1900, kill: -320, diveV: 0 };
  const S = Surv.setup(ctx, world, cfg, { spawn: (i, nn) => { const a = (i / nn) * 6.283 + 0.4; return { x: CX + Math.cos(a) * R0 * 0.62, y: CY + Math.sin(a) * R0 * 0.62, z: 2, face: a + 3.14 }; }, killZ: -320, shove: 1.2, push: false });
  // deux barres, la seconde arrive après quelques secondes et tourne dans l'autre sens
  const bars = [{ a: 0, w: 0.9, on: true, len: R0 - 10 }, { a: Math.PI, w: -0.7, on: false, len: R0 * 0.62 }];
  const coins = []; let coinId = 0; let t = 0, phase = "pre", left = 2.2;
  function spawnCoin(x, y, val) { const a = rnd() * 6.283, r = Math.sqrt(rnd()) * (R0 - 60); coins.push({ id: "c" + (++coinId), x: x != null ? x : CX + Math.cos(a) * Math.max(80, r), y: y != null ? y : CY + Math.sin(a) * Math.max(80, r), v: val || 1, born: t }); }
  for (let i = 0; i < 6 + n; i++) spawnCoin();
  S.P.forEach((p) => { p.coins = 0; p.hits = 0; p.inv = 0; });
  const speedUp = () => 1 + Math.min(1.6, t / DUR * 1.8);
  // distance du joueur à une barre, et de quel côté elle arrive
  function barHit(bar, b) {
    const dx = b.x - CX, dy = b.y - CY; const r = Math.hypot(dx, dy); if (r > bar.len + b.r || r < 40) return null;
    const pa = Math.atan2(dy, dx); const d = U.angDiff(bar.a, pa); const lat = Math.sin(d) * r; const along = Math.cos(d) * r;
    if (along < 0 || Math.abs(lat) > BAR_W / 2 + b.r) return null; return { r, d };
  }
  function bot(p, dt) {
    const b = p.bd, sk = ctx.skill(p.id), ex = p.ex; if (phase !== "play") return { x: 0, y: 0 };
    let jump = false; const dx = b.x - CX, dy = b.y - CY; const r = Math.hypot(dx, dy); const pa = Math.atan2(dy, dx);
    bars.forEach((bar) => { if (!bar.on || r > bar.len + 20) return; const w = bar.w * speedUp(); const d = U.angDiff(bar.a, pa); if (d / w <= 0) return; const tEnter = (Math.abs(d) * r - (BAR_W / 2 + b.r + 6)) / (Math.abs(w) * Math.max(r, 40)); if (ex.jd == null || ex.jdAt !== Math.round(t * 2)) { ex.jdAt = Math.round(t * 2); ex.jd = (rnd() - 0.5) * (1 - sk) * 0.3; } const reach = 0.1 + ex.jd; if (tEnter < reach && tEnter > -0.05 && b.grounded) jump = true; });
    ex.think = (ex.think || 0) - dt; if (ex.think <= 0 || !ex.goal || !coins.includes(ex.goal)) { ex.think = 0.4 + (1 - sk) * 0.5; let best = null, bd = 1e9; coins.forEach((c) => { const d = Math.hypot(c.x - b.x, c.y - b.y) + rnd() * (1 - sk) * 200; if (d < bd) { bd = d; best = c; } }); ex.goal = best; }
    const g = ex.goal || { x: CX + Math.cos(pa) * R0 * 0.5, y: CY + Math.sin(pa) * R0 * 0.5 }; const w = Surv.walk(b, g.x, g.y, 0.8 + sk * 0.2, 8);
    // reste loin du bord
    if (r > R0 - 70) { w.x -= dx / r * 0.8; w.y -= dy / r * 0.8; }
    return { x: w.x, y: w.y, jump, jh: jump || !b.grounded };
  }
  const inst = {
    done: false,
    update(dt) {
      t += dt; left -= dt;
      if (phase === "pre") { S.update(dt, () => ({ x: 0, y: 0 })); if (left <= 0) { phase = "play"; t = 0; ctx.snd("go"); ctx.announce("Saute par-dessus les barres", 1600); } return; }
      S.update(dt, bot);
      if (!bars[1].on && t > 12) { bars[1].on = true; ctx.announce("Une deuxième barre", 1400); ctx.snd("siren"); }
      bars.forEach((bar) => { if (bar.on) bar.a += bar.w * speedUp() * dt; });
      S.alive().forEach((p) => {
        const b = p.bd; p.inv = Math.max(0, p.inv - dt);
        // pièces
        for (let i = coins.length - 1; i >= 0; i--) { const c = coins[i]; if (t - c.born < 0.5) continue; if (Math.hypot(c.x - b.x, c.y - b.y) < 34 && b.z < 60) { p.coins += c.v; coins.splice(i, 1); ctx.snd("coin"); ctx.fx("puff", c.x, c.y, 10, "#ffd23b"); } }
        // barres, un joueur au ras du sol est fauché
        if (p.inv > 0 || b.z > BAR_H + 4) return;
        bars.forEach((bar) => { if (!bar.on || p.inv > 0) return; const h = barHit(bar, b); if (!h) return;
          const sg = Math.sign(bar.w); const tx = -Math.sin(bar.a) * sg, ty = Math.cos(bar.a) * sg; const f = 300 + 90 * speedUp();
          b.vx = tx * f + (b.x - CX) / h.r * 110; b.vy = ty * f + (b.y - CY) / h.r * 110; b.vz = 380; b.stun = 0.5; p.inv = 0.8; p.hits++;
          ctx.snd("bump"); ctx.shake(1); ctx.fx("puff", b.x, b.y, 10, "");
          const lost = Math.min(p.coins, 2); p.coins -= lost; for (let k = 0; k < lost; k++) spawnCoin(b.x + (rnd() - 0.5) * 120, b.y + (rnd() - 0.5) * 120);
        });
      });
      // de nouvelles pièces apparaissent régulièrement
      if (coins.length < 5 + n && rnd() < dt * 1.4) spawnCoin();
      if (t >= DUR || (S.alive().length <= 1 && ctx.n > 1)) inst.done = true;
    },
    scene() {
      const items = tiles.map((q) => ({ t: "box", id: q.id, x: q.b.x, y: q.b.y, z: -40, w: TS - 3, d: TS - 3, h: 40, c: (Math.round((q.b.x - CX) / TS) + Math.round((q.b.y - CY) / TS)) % 2 ? "#3fb8a8" : "#36a598" }));
      items.push({ t: "cyl", id: "hub", x: CX, y: CY, z: 0, r: 40, h: 60, c: "#ffd23b" });
      return { w: WORLD, h: WORLD, cam: { tilt: 62, fov: 40, pad: 1.05, c: [CX, CY + 20], ht: 40 }, env: { sky: ["#1b3a5a", "#7fd0ff"], fog: "#2a5a88", fogN: 80, fogF: 280, ground: { c: "#123a5a", m: "water", z: -300 }, lt: { h: ["#ffffff", "#6a8ab0"], hi: 1, d: "#fff4dd", di: 1, dir: [-0.3, 1, 0.45] } }, items };
    },
    frame() {
      const items = [];
      bars.forEach((bar, i) => { if (!bar.on) return; const mx = CX + Math.cos(bar.a) * bar.len / 2, my = CY + Math.sin(bar.a) * bar.len / 2; items.push({ t: "box", id: "bar" + i, x: mx, y: my, z: 0, w: bar.len, d: BAR_W, h: BAR_H, rot: bar.a, c: i ? "#ff5d8f" : "#ff8a1f", sm: 0 }); });
      coins.forEach((c) => items.push({ t: "coin", id: c.id, x: c.x, y: c.y, z: 0 }));
      S.pawns((p) => ({ n: p.name + (p.coins ? "  🪙" + p.coins : ""), st: p.inv > 0.5 ? "hit" : undefined })).forEach((p) => items.push(p));
      const best = S.P.slice().sort((a, b) => b.coins - a.coins)[0];
      return { w: WORLD, h: WORLD, items, hud: { title: phase === "pre" ? "Prépare tes jambes" : "Saute par-dessus les barres et ramasse les pièces", timer: phase === "play" ? Math.max(0, DUR - t) : null, chips: [{ text: S.alive().length + " debout" }, { text: best && best.coins ? "En tête " + best.name + " " + best.coins : "Aucune pièce" }] } };
    },
    priv(pid) { const p = S.byId(pid); return p ? { dead: p.dead ? 1 : 0, deadText: "Tu es tombé, regarde les autres" } : null; },
    ranking() {
      const groups = U.rankByScore(S.P, (p) => (p.dead ? 0 : 10000) + p.coins * 10 + (p.dead ? p.deadAt / 100 : 0), false, 0);
      const notes = {}; S.P.forEach((p) => { notes[p.id] = p.coins + " pièce" + (p.coins > 1 ? "s" : "") + (p.dead ? ", tombé" : "") + (p.hits ? ", fauché " + p.hits + " fois" : ""); });
      const bonus = {}; const clean = S.P.filter((p) => !p.dead && !p.hits); clean.forEach((p) => { bonus[p.id] = 1; });
      const top = S.P.find((p) => p.id === groups[0][0]);
      return { groups, bonus, notes, headline: "🌀 " + (top ? top.name : "") + " a dompté le tourniquet" };
    },
  };
  return inst;
};

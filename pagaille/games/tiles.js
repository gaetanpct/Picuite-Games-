// Sol en miettes. Chaque dalle effleurée s'effrite puis tombe. Il faut bouger sans cesse, trouver du sol et bousculer les autres.
// Avec le temps des dalles se fissurent toutes seules pour qu'une partie ne s'éternise jamais.
const U = require("../pg-util.js");
const Plat = require("../pg-plat.js");
const Surv = require("../pg-surv.js");

exports.create = function (ctx) {
  const rnd = ctx.rnd; const n = ctx.n; const G = n <= 3 ? 7 : n <= 6 ? 8 : 9; const TILE = 112; const WORLD = G * TILE; const CX = WORLD / 2, CY = WORLD / 2; const life = 1.5 / Math.max(0.8, ctx.speed), hold = life; const DROP = 190;
  const world = new Plat.World(); const tiles = []; const grid = [[], []];
  for (let L = 0; L < 2; L++) for (let r = 0; r < G; r++) { grid[L][r] = []; for (let c = 0; c < G; c++) {
    const x = TILE * (c + 0.5), y = TILE * (r + 0.5); const z0 = -40 - L * DROP; const b = world.add({ x, y, z: z0, w: TILE - 5, d: TILE - 5, h: 40, e: 0.1 });
    const t = { id: "t" + tiles.length, L, r, c, x, y, b, timer: -1, fall: 0, gone: false, base: z0, shade: rnd() * 0.08, dmg: 0, hot: 0, moving: false }; b.hurt = () => { if (t.fall || t.timer >= 0) return; t.dmg += 1 / 30; t.hot = 0.2; if (t.dmg >= life * (L ? 1.2 : 1)) { t.timer = 0.28; ctx.snd("crack"); } }; tiles.push(t); grid[L][r][c] = t; } }
  const cfg = { maxV: 305 * ctx.speed, accG: ctx.heavy ? 1000 : 2700, accA: 1500, jumpV: 560, maxJumps: 1, g: 1900, kill: -560, diveV: 520, diveCd: 1.1 };
  const S = Surv.setup(ctx, world, cfg, { spawn: (i, nn) => { const a = (i / nn) * 6.283 + 0.3; return { x: CX + Math.cos(a) * WORLD * 0.3, y: CY + Math.sin(a) * WORLD * 0.3, z: 2, face: a + 3.14 }; }, killZ: -560, shove: 1.35 });
  let t = 0, cracking = 9; const killIds = []; const dynSet = new Set();
  const live = (q) => q && !q.gone && !q.fall;
  const near = (x, y, z) => { const c = Math.floor(x / TILE), r = Math.floor(y / TILE); const L = z != null && z < -100 ? 1 : 0; return grid[L][r] && grid[L][r][c] || null; };
  const nbCount = (q) => { let k = 0; for (let dr = -1; dr <= 1; dr++) for (let dc = -1; dc <= 1; dc++) { const row = grid[q.L][q.r + dr]; const o = row && row[q.c + dc]; if (o && o !== q && live(o) && o.timer < 0) k++; } return k; };
  function bot(p, dt) {
    const b = p.bd, sk = ctx.skill(p.id), ex = p.ex; ex.think = (ex.think || 0) - dt;
    if (!b.grounded) return { x: ex.vx || 0, y: ex.vy || 0, jh: true };
    if (ex.think <= 0 || !ex.goal || !live(ex.goal) || ex.goal.timer >= 0 && ex.goal !== near(b.x, b.y, b.z)) {
      ex.think = 0.25 + (1 - sk) * 0.35; const here = near(b.x, b.y, b.z); const myL = b.z < -100 ? 1 : 0; let best = null, bs = -1e9;
      tiles.forEach((q) => { if (!live(q) || q.L !== myL) return; const d = Math.hypot(q.x - b.x, q.y - b.y); if (d > TILE * (2.6 + sk)) return;
        let s = nbCount(q) * 22 - d * 0.18 + (q.timer < 0 ? 40 : -90) + (rnd() - 0.5) * (1 - sk) * 80 - Math.hypot(q.x - CX, q.y - CY) * 0.05;
        S.alive().forEach((o) => { if (o !== p && Math.hypot(o.bd.x - q.x, o.bd.y - q.y) < TILE * 0.8) s -= 25; });
        if (s > bs) { bs = s; best = q; } });
      ex.goal = best || here; ex.jumpNext = false;
    }
    const g = ex.goal; if (!g) return { x: 0, y: 0 };
    const w = Surv.walk(b, g.x, g.y, 1, 20); ex.vx = w.x; ex.vy = w.y;
    // saute par dessus les trous, et plonge sur un voisin quand il est près du vide
    const ahead = Plat.groundAt(world, b.x + w.x * 34, b.y + w.y * 34, b.z + 20, b.z - 45); let jump = false;
    if (ahead == null && w.d > 30) jump = true;
    let dive = false; if (sk > 0.55 && b.diveCd <= 0) { S.alive().forEach((o) => { if (o === p || dive) return; const d = Math.hypot(o.bd.x - b.x, o.bd.y - b.y); if (d < 80 && nbCount(near(o.bd.x, o.bd.y, o.bd.z) || tiles[0]) < 5 && rnd() < 0.08 * sk) { dive = true; ex.vx = (o.bd.x - b.x) / d; ex.vy = (o.bd.y - b.y) / d; } }); }
    return { x: w.x, y: w.y, jump, jh: jump, dive };
  }
  function colOf(q, w) { const base = 0.62 + q.shade; const cr = Math.round(210 * base + 45 * w), cg = Math.round(165 * base - 90 * w), cb = Math.round(110 * base - 80 * w); return "rgb(" + U.clamp(cr, 0, 255) + "," + U.clamp(cg, 0, 255) + "," + U.clamp(cb, 0, 255) + ")"; }
  const inst = {
    done: false,
    update(dt) {
      t += dt; S.update(dt, bot);
      tiles.forEach((q) => { if (q.gone) return; if (q.timer >= 0) { q.timer -= dt; if (q.timer < 0) { q.fall = 0.001; q.b.solid = false; ctx.fx("puff", q.x, q.y, 0, ""); } } if (q.fall) { q.fall += dt; q.b.z -= 650 * q.fall * dt; if (q.b.z < q.base - 520) q.gone = true; } });
      // des dalles se fissurent toutes seules, de plus en plus vite
      cracking -= dt; if (cracking <= 0 && t > 10) { cracking = Math.max(0.3, 2.2 - t * 0.035) / Math.max(1, S.alive().length * 0.28); const topLeft = tiles.some((q) => q.L === 0 && live(q)); const pool = tiles.filter((q) => live(q) && q.timer < 0 && (q.L === 1 || !S.alive().some((p) => p.bd.z > -100) ? true : q.L === 0)); if (pool.length) { const q = pool[Math.floor(rnd() * pool.length)]; q.timer = 0.9; ctx.snd("crack"); } }
      if (S.alive().length <= 1 && ctx.n > 1) inst.done = true;
    },
    scene() { return { w: WORLD, h: WORLD, cam: { tilt: 61, fov: 40, pad: 1.08, c: [CX, CY + 20], ht: 40 }, env: { sky: ["#6a4f2a", "#e8c28a"], fog: "#9b7447", fogN: 70, fogF: 240, ground: { c: "#4a2d14", m: "lava", z: -340 }, lt: { h: ["#fff0d0", "#8a6a4a"], hi: 1, d: "#ffe9c4", di: 1, dir: [-0.3, 1, 0.5] } }, items: tiles.map((q) => ({ t: "box", id: q.id, x: q.x, y: q.y, z: q.base, w: TILE - 5, d: TILE - 5, h: 40, c: colOf(q, 0) })) }; },
    frame() {
      const items = [];
      const kill = [];
      tiles.forEach((q) => { if (q.hot > 0) q.hot -= 1 / 15; const active = q.dmg > 0 || q.timer >= 0 || q.fall; if (!active) return; kill.push(q.id); if (q.gone) return;
        const warn = q.timer >= 0 ? 1 : Math.min(1, q.dmg / (life * (q.L ? 1.2 : 1))); const shk = q.timer >= 0 || q.hot > 0 ? Math.sin(t * 70 + q.r * 3) * (q.timer >= 0 ? 2.4 : 1) : 0;
        items.push({ t: "box", id: "d" + q.id, x: q.x + shk, y: q.y, z: q.b.z, w: TILE - 5, d: TILE - 5, h: 40, c: colOf(q, warn), sm: 30 }); });
      S.pawns().forEach((p) => items.push(p));
      return { w: WORLD, h: WORLD, items, kill, hud: { title: "Ne reste jamais immobile", chips: [{ text: S.alive().length + " debout" }, { text: tiles.filter((q) => live(q) && q.L === 0).length + " dalles en haut" }, { text: tiles.filter((q) => live(q) && q.L === 1).length + " en bas" }] } };
    },
    priv(pid) { const p = S.byId(pid); return p ? { dead: p.dead ? 1 : 0, deadText: "Tu es tombé, regarde les autres" } : null; },
    ranking() { return S.ranking({ headline: "🧱 Dernier debout sur le sol en miettes" }); },
  };
  return inst;
};

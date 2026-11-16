// Vole la couronne. Une couronne apparaît au milieu de l'arène. Celui qui la porte marque des points chaque seconde,
// il suffit de toucher le porteur pour la lui voler. Le porteur est un peu plus lent, des blocs et des tremplins aident à fuir.
const U = require("../pg-util.js");
const Plat = require("../pg-plat.js");
const Surv = require("../pg-surv.js");

exports.create = function (ctx) {
  const rnd = ctx.rnd; const n = ctx.n; const SIZE = 820 + n * 30; const CX = SIZE / 2, CY = SIZE / 2; const DUR = Math.round(70 * ctx.len);
  const world = new Plat.World(); const statics = [];
  // le sol, entouré d'un petit muret pour qu'on ne tombe pas
  const floor = world.add({ x: CX, y: CY, z: -40, w: SIZE, d: SIZE, h: 40, e: 0.1 }); statics.push({ t: "box", id: "floor", x: CX, y: CY, z: -40, w: SIZE, d: SIZE, h: 40, c: "#5a3e8a" });
  [[CX, -10, SIZE + 40, 20], [CX, SIZE + 10, SIZE + 40, 20], [-10, CY, 20, SIZE + 40], [SIZE + 10, CY, 20, SIZE + 40]].forEach((w, i) => { world.add({ x: w[0], y: w[1], z: 0, w: w[2], d: w[3], h: 46, e: 0.6 }); statics.push({ t: "box", id: "wall" + i, x: w[0], y: w[1], z: 0, w: w[2], d: w[3], h: 46, c: "#ffd23b" }); });
  // blocs sur lesquels on peut sauter, et piliers pour tourner autour
  const blocks = [];
  for (let i = 0; i < 4; i++) { const a = i * Math.PI / 2 + Math.PI / 4; const x = CX + Math.cos(a) * SIZE * 0.28, y = CY + Math.sin(a) * SIZE * 0.28; blocks.push({ x, y, w: 120, d: 120, h: 48 }); }
  for (let i = 0; i < 4; i++) { const a = i * Math.PI / 2; const x = CX + Math.cos(a) * SIZE * 0.36, y = CY + Math.sin(a) * SIZE * 0.36; blocks.push({ x, y, w: 46, d: 46, h: 120 }); }
  blocks.forEach((k, i) => { world.add({ x: k.x, y: k.y, z: 0, w: k.w, d: k.d, h: k.h, e: 0.3 }); statics.push({ t: "box", id: "blk" + i, x: k.x, y: k.y, z: 0, w: k.w, d: k.d, h: k.h, c: k.h > 60 ? "#ff8a3d" : "#7fd0ff" }); });
  const cfg = { maxV: 300 * ctx.speed, accG: ctx.heavy ? 1100 : 2600, accA: 1500, jumpV: 560, maxJumps: 2, g: 1900, kill: -320, diveV: 520, diveCd: 1.2 };
  const S = Surv.setup(ctx, world, cfg, { spawn: (i, nn) => { const a = (i / nn) * 6.283 + 0.2; return { x: CX + Math.cos(a) * SIZE * 0.4, y: CY + Math.sin(a) * SIZE * 0.4, z: 2, face: a + 3.14 }; }, killZ: -320, shove: 1.1, push: false });
  S.P.forEach((p) => { p.pts = 0; p.steals = 0; p.held = 0; });
  let holder = null, crown = { x: CX, y: CY }, immune = 0, t = 0, phase = "pre", left = 2.2;
  const holderCfg = Object.assign({}, cfg, { maxV: cfg.maxV * 0.86 });
  function bot(p, dt) {
    const b = p.bd, sk = ctx.skill(p.id), ex = p.ex; if (phase !== "play") return { x: 0, y: 0 };
    if (holder === p) {
      // le porteur fuit le poursuivant le plus proche en restant loin des murs
      let fx = 0, fy = 0; S.alive().forEach((q) => { if (q === p) return; const dx = b.x - q.bd.x, dy = b.y - q.bd.y, d = Math.hypot(dx, dy) || 1; if (d < 360) { fx += dx / d * (360 - d); fy += dy / d * (360 - d); } });
      fx += (CX - b.x) * 0.6; fy += (CY - b.y) * 0.6; const l = Math.hypot(fx, fy) || 1; ex.wob = (ex.wob || 0) + dt * 2;
      const jump = b.grounded && rnd() < dt * 0.6 * sk;
      return { x: fx / l + Math.sin(ex.wob) * 0.3, y: fy / l + Math.cos(ex.wob) * 0.3, jump, jh: jump || !b.grounded };
    }
    const tg = holder ? holder.bd : crown; const lead = holder ? 0.25 * sk : 0; const tx = tg.x + (tg.vx || 0) * lead, ty = tg.y + (tg.vy || 0) * lead;
    const w = Surv.walk(b, tx, ty, 0.78 + sk * 0.22, 4); const d = Math.hypot(tx - b.x, ty - b.y);
    const dive = holder && d < 120 && d > 50 && b.diveCd <= 0 && rnd() < dt * 3 * sk;
    const jump = b.grounded && holder && holder.bd.z > b.z + 20 && d < 160;
    return { x: w.x, y: w.y, jump, jh: jump || !b.grounded, dive };
  }
  function give(p, from) { holder = p; immune = 1.1; if (from) { from.ex.lost = t; p.steals++; ctx.snd("grab"); ctx.fx("puff", p.bd.x, p.bd.y, 30, "#ffd23b"); ctx.announce(p.name + " vole la couronne", 1100); } else { ctx.snd("coin"); ctx.announce(p.name + " prend la couronne", 1100); } }
  const inst = {
    done: false,
    update(dt) {
      t += dt; left -= dt;
      if (phase === "pre") { S.update(dt, () => ({ x: 0, y: 0 })); if (left <= 0) { phase = "play"; t = 0; ctx.snd("go"); ctx.announce("Attrape la couronne", 1500); } return; }
      // le porteur court un peu moins vite
      S.P.forEach((p) => { p.bd.maxVOver = holder === p ? holderCfg.maxV : null; });
      S.update(dt, bot);
      if (holder && holder.dead) { crown = { x: CX, y: CY }; holder = null; }
      immune = Math.max(0, immune - dt);
      if (!holder) { const p = S.alive().find((q) => Math.hypot(q.bd.x - crown.x, q.bd.y - crown.y) < 40 && q.bd.z < 50); if (p) give(p, null); }
      else {
        holder.pts += dt; holder.held += dt; crown = { x: holder.bd.x, y: holder.bd.y };
        if (immune <= 0) { const hb = holder.bd; const thief = S.alive().find((q) => q !== holder && Math.hypot(q.bd.x - hb.x, q.bd.y - hb.y) < hb.r + q.bd.r + 6 && Math.abs(q.bd.z - hb.z) < 40 && (t - (q.ex.lost || -9)) > 0.6); if (thief) give(thief, holder); }
      }
      if (t >= DUR) inst.done = true;
    },
    scene() { return { w: SIZE, h: SIZE, cam: { tilt: 60, fov: 40, pad: 1.08, c: [CX, CY + 20], ht: 60 }, env: { sky: ["#2a1a4a", "#c58bff"], fog: "#3a2a6a", fogN: 80, fogF: 280, ground: { c: "#1a1030", z: -300 }, lt: { h: ["#ffffff", "#8a6ab0"], hi: 1, d: "#fff4dd", di: 1, dir: [-0.3, 1, 0.45] } }, items: statics }; },
    frame() {
      const items = [];
      const hz = holder ? holder.bd.z + 62 : 6; items.push({ t: "coin", id: "crown", x: crown.x, y: crown.y, z: hz, big: 1 });
      if (!holder) items.push({ t: "ring", id: "crownring", x: crown.x, y: crown.y, z: 1, r: 46, c: "#ffd23b", a: 0.7 });
      S.pawns((p) => ({ n: (p === holder ? "👑 " : "") + p.name + " " + Math.floor(p.pts), st: p === holder && immune > 0 ? "win" : undefined })).forEach((p) => items.push(p));
      const best = S.P.slice().sort((a, b) => b.pts - a.pts)[0];
      return { w: SIZE, h: SIZE, items, hud: { title: phase === "pre" ? "Prépare-toi" : holder ? (holder.name + " porte la couronne") : "La couronne attend au milieu", timer: phase === "play" ? Math.max(0, DUR - t) : null, chips: [{ text: best && best.pts >= 1 ? "En tête " + best.name + " " + Math.floor(best.pts) : "Personne n'a encore marqué" }] } };
    },
    priv(pid) { const p = S.byId(pid); return p ? { dead: p.dead ? 1 : 0, deadText: "Tu es tombé, regarde les autres" } : null; },
    ranking() {
      const groups = U.rankByScore(S.P, (p) => Math.floor(p.pts), false, 0);
      const notes = {}; S.P.forEach((p) => { notes[p.id] = Math.floor(p.pts) + " point" + (Math.floor(p.pts) > 1 ? "s" : "") + ", " + p.steals + " vol" + (p.steals > 1 ? "s" : ""); });
      const bonus = {}; const thief = S.P.slice().sort((a, b) => b.steals - a.steals)[0]; if (thief && thief.steals >= 3) bonus[thief.id] = 1;
      const top = S.P.find((p) => p.id === groups[0][0]);
      return { groups, bonus, notes, headline: "👑 " + (top ? top.name : "") + " garde la couronne" };
    },
  };
  return inst;
};

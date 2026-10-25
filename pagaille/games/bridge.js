// Pont de verre. Façon Squid Game mais en liberté. Chaque rangée a deux dalles identiques, une seule est fragile.
// On marche, on saute, on se pousse. Un mur laser avance derrière tout le monde et force à avancer, sinon tout le monde tombe.
// Les dalles sur lesquelles on a marché sans casser deviennent sûres pour tous. Le premier arrivé gagne.
const U = require("../pg-util.js");
const Plat = require("../pg-plat.js");
const Surv = require("../pg-surv.js");

const RH = 112, PX = 68, PW = 128, PD = 104;
exports.create = function (ctx) {
  const rnd = ctx.rnd; const n = ctx.n; const R = Math.min(12, 8 + Math.ceil(n / 3)); const rowY = (r) => -r * RH; const START = RH * 1.4; const END = rowY(R - 1) - 46 - 8 - 100;
  const world = new Plat.World();
  world.add({ x: 0, y: START - 20, z: -40, w: 420, d: 220, h: 40, e: 0.1 }); const fin = world.add({ x: 0, y: END, z: -40, w: 420, d: 200, h: 40, e: 0.1 });
  const panels = []; for (let r = 0; r < R; r++) { const bad = rnd() < 0.5 ? 0 : 1; for (let s = 0; s < 2; s++) { const b = world.add({ x: (s ? 1 : -1) * PX, y: rowY(r), z: -22, w: PW, d: PD, h: 14, e: 0.1 }); panels.push({ id: "g" + r + "_" + s, r, s, b, bad: s === bad, safe: false, crack: 0, fall: 0, gone: false }); } }
  const cfg = { maxV: 270 * ctx.speed, accG: ctx.heavy ? 1100 : 2600, accA: 1500, jumpV: 560, maxJumps: 1, g: 1850, kill: -260, diveV: 0 };
  const S = Surv.setup(ctx, world, cfg, { spawn: (i, nn) => ({ x: -160 + (320 * (i + 0.5)) / nn, y: START - 20 + ((i % 2) * 50 - 25), z: 2, face: -1.57 }), killZ: -260, shove: 1.15, push: true, botPush: 0.04 });
  const wallStart = START + 260; const bridgeLen = wallStart - (rowY(R - 1) - 40);
  let wallY = wallStart, t = 0, phase = "pre", left = 2.2, wallOn = 14 * ctx.pace; const finishers = [];
  const wallSpeed = bridgeLen / (105 * ctx.len * ctx.pace);
  const prog = (p) => Math.max(0, Math.min(1, (START - p.bd.y) / (START - END)));
  S.P.forEach((p) => { p.ex.best = 0; p.ex.fin = false; });
  function nextRowOf(p) { return U.clamp(Math.floor((START - 20 - p.bd.y) / RH) + 1, 0, R - 1); }
  function bot(p, dt) {
    const b = p.bd, ex = p.ex, sk = ctx.skill(p.id); if (phase === "pre") return { x: 0, y: 0 };
    ex.t = (ex.t || 0) + dt; if (ex.fin) return { x: 0, y: 0 };
    if (ex.patience == null) ex.patience = 1.5 + rnd() * 9 * (1.1 - sk * 0.4);
    const here = b.grounded && b.ground ? panels.find((q) => q.b === b.ground) : null; if (here) ex.onRow = here.r;
    const r = ex.onRow == null ? 0 : ex.onRow + 1;
    if (r >= R) { const w = Surv.walk(b, 0, END, 1, 14); const jp = b.grounded && b.y > END + 140; return { x: w.x, y: w.y, jump: jp, jh: jp || !b.grounded }; }
    const pr = panels.filter((q) => q.r === r && !q.gone && !q.fall && !(q.bad && q.crack)); const safe = pr.find((q) => q.safe);
    let tgt = safe || (pr.length === 1 ? pr[0] : null);
    if (!tgt) {
      const wallNear = wallOn <= 0 && (wallY - b.y) < 150; const others = S.alive().filter((q) => q !== p && !q.ex.fin);
      const someoneTesting = others.some((q) => q.ex.onRow != null && q.ex.onRow + 1 >= r - 0 && q.bd.y < b.y - 20 && q.ex.onRow + 1 === r && q.bd.grounded);
      const go = wallNear || ex.t > ex.patience + (r > 0 ? 0 : 0) || !others.length;
      if (!go || (someoneTesting && !wallNear)) return { x: 0, y: 0 };
      if (ex.pickRow !== r) { ex.pickRow = r; ex.pick = rnd() < 0.5 ? 0 : 1; } tgt = pr.find((q) => q.s === ex.pick) || pr[0];
    }
    if (!tgt) return { x: 0, y: 0 };
    const w = Surv.walk(b, tgt.b.x, tgt.b.y, 1, 6); const d = Math.hypot(tgt.b.x - b.x, tgt.b.y - b.y);
    const jump = b.grounded && d < 95 && d > 30 && (!here || here.r !== tgt.r); return { x: w.x, y: w.y, jump, jh: jump || !b.grounded };
  }
  const inst = {
    done: false,
    update(dt) {
      t += dt;
      S.update(dt, bot, null);
      S.P.forEach((p) => { if (p.dead && !p.ex.wallDead) { p.ex.rs = p.ex.rs == null ? 3.4 : p.ex.rs - dt; if (p.ex.rs <= 0) { p.dead = false; p.bd.alive = true; p.ex.rs = null; p.ex.falls = (p.ex.falls || 0) + 1; p.ex.onRow = null; p.ex.t = Math.max(p.ex.t || 0, (p.ex.patience || 0)); const b = p.bd; const a = rnd() * 6.283; b.x = Math.cos(a) * 120; b.y = START - 20 + Math.sin(a) * 40; b.z = 2; b.vx = b.vy = b.vz = 0; b.grounded = false; ctx.fx("puff", b.x, b.y, 0, ""); } } });
      // dalles qui se fissurent sous les pieds
      S.alive().forEach((p) => {
        const b = p.bd; const g = b.grounded && b.ground ? panels.find((q) => q.b === b.ground) : null;
        if (g) { if (g.bad && !g.crack) { g.crack = 0.001; ctx.snd("glass"); } if (!g.bad && !g.safe) { g.safe = true; p.ex.pio = (p.ex.pio || 0) + 1; ctx.fx("puff", g.b.x, g.b.y, g.b.z + 14, ""); } }
        p.ex.best = Math.max(p.ex.best, prog(p));
        if (!p.ex.fin && b.grounded && b.ground === fin) { p.ex.fin = true; p.ex.finT = t; finishers.push(p); ctx.snd("win"); ctx.fx("confetti", b.x, b.y, 50, ""); ctx.announce(p.name + " a traversé le pont", 2200); }
      });
      panels.forEach((q) => { if (q.crack) { q.crack += dt; if (q.crack > 0.3 && !q.fall) { q.fall = 0.001; q.b.solid = false; ctx.shake(1.5); ctx.fx("splash", q.b.x, q.b.y, -30, "#e8f7ff"); } } if (q.fall) { q.fall += dt; q.b.z -= 650 * q.fall * dt; if (q.b.z < -500) q.gone = true; } });
      if (phase === "pre") { left -= dt; if (left <= 0) { phase = "run"; ctx.announce("Avancez ou le mur vous écrasera", 2200); } return; }
      wallOn -= dt; if (wallOn <= 0) { const was = wallY; wallY -= wallSpeed * dt; S.alive().forEach((p) => { if (p.bd.y > wallY && !p.ex.fin) { p.ex.wallDead = true; S.kill(p, "boom"); ctx.fx("boom", p.bd.x, wallY, 30, "#ff6b6b"); } }); }
      const live = S.P.filter((p) => !p.ex.fin && !p.ex.wallDead);
      if (!live.length) inst.done = true;
      if (finishers.length && t - finishers[0].ex.finT > 14 * ctx.pace) inst.done = true;
    },
    scene() {
      const items = [{ t: "box", x: 0, y: START - 20, z: -40, w: 420, d: 220, h: 40, c: "#cfd8e6" }, { t: "box", x: 0, y: END, z: -40, w: 420, d: 200, h: 40, c: "#ffe58a" }, { t: "text", x: 0, y: END - 20, z: 30, v: "ARRIVÉE", c: "#ffd23b", s: 34 }, { t: "flag", x: -170, y: END - 30, z: 0, c: "#ff4d6d" }, { t: "flag", x: 170, y: END - 30, z: 0, c: "#ff4d6d" }];
      for (let r = 0; r < R; r += 2) [-1, 1].forEach((s) => items.push({ t: "box", x: s * 190, y: rowY(r), z: -200, w: 14, d: 14, h: 190, c: "#3a4a68" }));
      for (let i = 0; i < 7; i++) items.push({ t: "deco", kind: "cloud", x: (i % 2 ? 1 : -1) * (520 + i * 20), y: -i * 160 + 100, z: 90 + i * 14, s: 3 });
      return { w: 1100, h: (R + 6) * RH, cam: { tilt: 56, fov: 40, pad: 1.0, c: [0, (START + END) / 2], ht: 40 }, env: { sky: ["#0c2a45", "#6fd0ff"], fog: "#1e5a88", fogN: 90, fogF: 320, ground: { c: "#0e4a73", m: "water", z: -300 }, lt: { h: ["#eaf8ff", "#4a7a9a"], hi: 1, d: "#fff", di: 0.9, dir: [-0.3, 1, 0.5] } }, items };
    },
    frame() {
      const items = [];
      panels.forEach((q) => { if (q.gone) return; const cr = q.crack ? Math.sin(q.crack * 60) * 1.5 : 0; items.push({ t: "box", id: q.id, x: q.b.x + cr, y: q.b.y, z: q.b.z, w: PW, d: PD, h: 14, c: q.safe ? "#9be8c0" : "#b9e6ff", m: "glass", a: 0.82, sm: 30 }); });
      items.push({ t: "beam", id: "wall", x: -230, y: wallY, z: 30, x2: 230, y2: wallY, z2: 30, w: 26, c: "#ff3b5c", a: 0.9 }, { t: "beam", id: "wall2", x: -230, y: wallY, z: 70, x2: 230, y2: wallY, z2: 70, w: 10, c: "#ffd0d8", a: 0.7 });
      S.pawns((p) => ({ badge: p.ex.fin ? "🏁" : "" })).forEach((p) => items.push(p));
      const distWall = Math.max(0, Math.round((S.alive().reduce((m, p) => Math.min(m, p.bd.y), 1e9) - 0) * 0));
      return { w: 1100, h: (R + 6) * RH, items, hud: { title: phase === "pre" ? "Le pont est piégé, une dalle sur deux se brise" : wallOn > 0 ? "Le mur démarre dans " + Math.ceil(wallOn) + " s" : "Le mur avance, fonce", timer: null, chips: [{ text: S.P.filter((p) => !p.ex.fin && !p.ex.wallDead).length + " en jeu" }, { text: "Rangées " + R }], prog: S.P.map((p) => ({ id: p.id, k: p.k, n: p.name, p: p.ex.fin ? 1 : prog(p), out: p.dead })) } };
    },
    priv(pid) {
      const p = S.byId(pid); if (!p) return null; const b = p.bd; return { cam: { m: "follow", t: [b.x * 0.5, Math.min(b.y, START), p.dead ? 0 : Math.max(b.z, 0)], yaw: -Math.PI / 2, d: 330, hg: 210, la: 140 }, dead: p.dead ? 1 : 0, deadText: p.ex.wallDead ? "Le mur t'a eu, regarde les autres" : "Tombé, tu reviens au départ dans un instant" };
    },
    ranking() {
      const fin = finishers.slice(); const rest = S.P.filter((p) => !p.ex.fin).sort((a, b) => b.ex.best - a.ex.best);
      const groups = fin.map((p) => [p.id]); rest.forEach((p) => { const last = groups[groups.length - 1]; const q = last && S.byId(last[0]); if (q && !q.ex.fin && Math.abs(q.ex.best - p.ex.best) < 0.04) last.push(p.id); else groups.push([p.id]); });
      const notes = {}, bonus = {}; S.P.forEach((p) => { notes[p.id] = p.ex.fin ? "a traversé" + (p.ex.falls ? ", " + p.ex.falls + " chute" + (p.ex.falls > 1 ? "s" : "") : ", sans chute") : Math.round(p.ex.best * 100) + " % du pont" + (p.ex.wallDead ? ", écrasé par le mur" : ""); }); const mp = Math.max(0, ...S.P.map((p) => p.ex.pio || 0)); S.P.forEach((p) => { if (mp >= 3 && (p.ex.pio || 0) === mp) { bonus[p.id] = 2; notes[p.id] += ", a ouvert la voie"; } });
      return { groups, bonus, notes, headline: fin[0] ? "🌉 " + fin[0].name + " traverse en premier" : "Le mur a gagné" };
    },
  };
  return inst;
};

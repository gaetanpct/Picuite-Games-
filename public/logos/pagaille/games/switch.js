// Couleur cible. Une couleur est annoncée, on court sur une dalle de cette couleur avant la fin du compte à rebours.
// Les autres dalles tombent. À partir du cinquième tour les couleurs s'éteignent juste avant la chute, il faut s'en souvenir.
const U = require("../pg-util.js");
const Plat = require("../pg-plat.js");
const Surv = require("../pg-surv.js");

const COLS = [{ c: "#ff4d6d", n: "Rouge", s: "●" }, { c: "#4dabf7", n: "Bleu", s: "▲" }, { c: "#4cd964", n: "Vert", s: "■" }, { c: "#ffd23b", n: "Jaune", s: "◆" }, { c: "#b388ff", n: "Violet", s: "★" }];

exports.create = function (ctx) {
  const rnd = ctx.rnd; const n = ctx.n; const G = n <= 3 ? 5 : n <= 5 ? 6 : 7; const TILE = 118; const half = (G * TILE) / 2; const maxRounds = Math.round(12 * ctx.len);
  const world = new Plat.World(); const tiles = [];
  for (let r = 0; r < G; r++) for (let c = 0; c < G; c++) {
    const x = -half + TILE * (c + 0.5) + half, y = -half + TILE * (r + 0.5) + half; const b = world.add({ x, y, z: -40, w: TILE - 4, d: TILE - 4, h: 40, e: 0.1 });
    tiles.push({ id: "t" + tiles.length, x, y, b, col: 0, fall: 0, gone: false, base: -40 });
  }
  const CX = half, CY = half; const WORLD = G * TILE;
  const cfg = { maxV: 300 * ctx.speed, accG: ctx.heavy ? 1100 : 2800, accA: 1500, jumpV: 430, maxJumps: 1, g: 1900, kill: -320, diveV: 0 };
  const S = Surv.setup(ctx, world, cfg, { spawn: (i, nn) => { const a = (i / nn) * 6.283; const t = tiles[Math.floor(rnd() * tiles.length)]; return { x: CX + Math.cos(a) * WORLD * 0.28, y: CY + Math.sin(a) * WORLD * 0.28, z: 2, face: a + 3.14 }; }, killZ: -320, shove: 1.2 });
  let phase = "pre", left = 2.2, round = 0, target = 0, hide = false, hideFrom = 0, total = 0; let msg = "";
  const roundTime = () => Math.max(1.35, 4.6 - 0.42 * round) * ctx.pace;
  function newColours() {
    // chaque couleur est présente et la cible occupe de 20 à 30 pour cent des dalles
    const alive = tiles.filter((t) => !t.gone); const ids = alive.map((t) => t); U.shuffle(ids, rnd);
    target = Math.floor(rnd() * COLS.length); const wantTarget = Math.max(3, Math.round(alive.length * (0.3 - Math.min(0.14, round * 0.02))));
    ids.forEach((t, i) => { t.col = i < wantTarget ? target : (target + 1 + Math.floor(rnd() * (COLS.length - 1))) % COLS.length; });
  }
  function startRound() {
    round++; phase = "show"; total = left = roundTime(); tiles.forEach((t) => { if (t.gone) { t.gone = false; t.fall = 0; t.b.solid = true; t.b.z = t.base; } });
    newColours(); hide = round >= 5; hideFrom = hide ? total * 0.45 : 0; ctx.snd("count"); msg = COLS[target].n;
    ctx.announce("Tour " + round + ", cours sur le " + (COLS[target].n.toLowerCase()), 1600);
  }
  function drop() {
    phase = "drop"; left = 1.5; ctx.snd("crack"); ctx.shake(1.5);
    tiles.forEach((t) => { if (t.col !== target && !t.gone && !t.dropping) { t.dropping = true; t.b.solid = false; t.fall = 0.001; } });
  }
  // intelligence des bots
  function bot(p, dt) {
    const b = p.bd; const sk = ctx.skill(p.id); const ex = p.ex; if (phase !== "show" && phase !== "drop") return { x: 0, y: 0 };
    if (ex.round !== round) { ex.round = round; ex.react = 0.15 + (1 - sk) * 1.1 * rnd(); ex.goal = null; ex.wrong = rnd() < (1 - sk) * 0.22 && round >= 4; }
    ex.react -= dt; if (ex.react > 0) return { x: 0, y: 0 };
    if (!ex.goal && phase === "show") {
      const cand = tiles.filter((t) => !t.gone && !t.dropping && (ex.wrong ? t.col !== target : t.col === target));
      let best = null, bd = 1e9; cand.forEach((t) => { const d = Math.hypot(t.x - b.x, t.y - b.y) + rnd() * (1 - sk) * 150 + (S.alive().filter((q) => q !== p && q.ex.goal === t).length) * 80; if (d < bd) { bd = d; best = t; } }); ex.goal = best;
    }
    if (!ex.goal) return { x: 0, y: 0 }; const g = ex.goal; const w = Surv.walk(b, g.x + (rnd() - 0.5) * 6, g.y, 0.85 + sk * 0.15, 10);
    // sur la bonne dalle, on s'arrête au milieu et on ne bouge plus
    return { x: w.x, y: w.y };
  }
  const inst = {
    done: false,
    update(dt) {
      S.update(dt, bot); S.P.forEach((p) => { if (p.dead && p.ex.dr == null) p.ex.dr = round; });
      tiles.forEach((t) => { if (t.fall) { t.fall += dt; t.b.z -= 700 * t.fall * dt; if (t.b.z < -500) { t.gone = true; t.fall = 0; t.dropping = false; } } });
      left -= dt;
      if (phase === "pre") { if (left <= 0) startRound(); }
      else if (phase === "show") { if (left <= 0) drop(); }
      else if (phase === "drop") { if (left <= 0) { const al = S.alive().length; if (al <= 1 || round >= maxRounds) inst.done = true; else { phase = "gap"; left = 0.5; } } }
      else if (phase === "gap") { if (left <= 0) startRound(); }
      if (S.alive().length <= 1 && ctx.n > 1 && phase !== "drop") inst.done = true;
    },
    scene() { return { w: WORLD, h: WORLD, cam: { tilt: 60, fov: 40, pad: 1.1, c: [CX, CY + 30], ht: 40 }, env: { sky: ["#2a2f6b", "#8f7ae0"], fog: "#3a3580", fogN: 70, fogF: 230, ground: { c: "#2b2a63", z: -330 }, lt: { h: ["#ffffff", "#8e8ac8"], hi: 1, d: "#fff4dd", di: 0.9, dir: [-0.35, 1, 0.45] } }, items: [{ t: "deco", kind: "cloud", x: -420, y: CY - 200, z: -60, s: 3 }, { t: "deco", kind: "cloud", x: WORLD + 420, y: CY - 100, z: -80, s: 3 }] }; },
    frame() {
      const blank = hide && phase === "show" && left < total - hideFrom;
      const items = [];
      tiles.forEach((t) => { if (t.gone) return; const co = COLS[t.col]; const off = t.dropping ? "#555a73" : ""; items.push({ t: "box", id: t.id, x: t.x, y: t.y, z: t.b.z, w: TILE - 4, d: TILE - 4, h: 40, c: blank ? "#6b6f93" : co.c, lab: blank ? "" : co.s, lc: "rgba(0,0,0,.35)", sm: 30 }); });
      S.pawns().forEach((p) => items.push(p));
      return { w: WORLD, h: WORLD, items, hud: { title: phase === "drop" ? "Les autres dalles tombent" : blank ? "Les couleurs sont éteintes, souviens toi" : "Cours sur le " + COLS[target].n.toLowerCase(), timer: phase === "show" ? left : null, target: phase === "pre" ? null : { c: COLS[target].c, s: COLS[target].s + " " + COLS[target].n }, chips: [{ text: "Tour " + round + " sur " + maxRounds }, { text: S.alive().length + " debout" }] } };
    },
    priv(pid) { const p = S.byId(pid); return p ? { dead: p.dead ? 1 : 0, deadText: "Tu es tombé, regarde les autres" } : null; },
    ranking() { return S.ranking({ note: (p) => (p.dead ? "Tombé au tour " + Math.max(1, p.ex.dr || round) : "Encore debout"), headline: "🎨 Dernier debout" }); },
  };
  return inst;
};

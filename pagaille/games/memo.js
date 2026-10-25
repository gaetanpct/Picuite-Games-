// Dalles de mémoire. Des dalles s'allument une à une, puis le sol s'éteint. Au signal on court sur une dalle qui était allumée.
// Les autres tombent. Il y a de moins en moins de dalles sûres et de moins en moins de temps.
const U = require("../pg-util.js");
const Plat = require("../pg-plat.js");
const Surv = require("../pg-surv.js");

const SYM = ["●", "▲", "■", "◆", "★", "♥"]; const CL = ["#ff4d6d", "#4dabf7", "#4cd964", "#ffd23b", "#b388ff", "#ff9f43"];

exports.create = function (ctx) {
  const rnd = ctx.rnd; const n = ctx.n; const G = n <= 4 ? 5 : n <= 6 ? 6 : 7; const TILE = 118; const WORLD = G * TILE; const CX = WORLD / 2, CY = WORLD / 2; const maxRounds = Math.round(10 * ctx.len);
  const world = new Plat.World(); const tiles = [];
  for (let r = 0; r < G; r++) for (let c = 0; c < G; c++) { const x = TILE * (c + 0.5), y = TILE * (r + 0.5); const b = world.add({ x, y, z: -40, w: TILE - 4, d: TILE - 4, h: 40, e: 0.1 }); tiles.push({ id: "t" + tiles.length, x, y, b, sym: (r * 2 + c) % SYM.length, lit: 0, safe: false, fall: 0, gone: false, base: -40, litAt: -1 }); }
  let phase = "pre", left = 2, round = 0, t = 0, safeList = []; let showT = 0;
  const cfg = { maxV: 310 * ctx.speed, accG: ctx.heavy ? 1100 : 2800, accA: 1500, jumpV: 440, maxJumps: 1, g: 1900, kill: -330, diveV: 0 };
  const S = Surv.setup(ctx, world, cfg, { spawn: (i, nn) => { const a = (i / nn) * 6.283; return { x: CX + Math.cos(a) * 46, y: CY + Math.sin(a) * 46, z: 2, face: a }; }, killZ: -330, shove: 1.2, human: (p, i, e) => (phase === "go" ? { x: i.x, y: i.y, jump: e.a, jh: i.a } : { x: 0, y: 0 }) });
  const safeCount = () => U.clamp(Math.round(S.alive().length * 0.75), 2, 9);
  function recentre() { const A = S.alive(); A.forEach((p, i) => { const a = (i / A.length) * 6.283; const b = p.bd; b.x = CX + Math.cos(a) * 46; b.y = CY + Math.sin(a) * 46; b.z = 2; b.vx = b.vy = b.vz = 0; b.grounded = false; b.face = a; ctx.fx("puff", b.x, b.y, 0, ""); }); }
  function startRound() {
    round++; tiles.forEach((q) => { if (q.gone) { q.gone = false; q.fall = 0; q.b.solid = true; q.b.z = q.base; } q.safe = false; q.lit = 0; });
    const k = safeCount(); const pool = U.shuffle(tiles.slice(), rnd); safeList = pool.slice(0, k); safeList.forEach((q, i) => { q.safe = true; q.litAt = i * 0.42; });
    recentre(); phase = "show"; showT = 0; left = k * 0.42 + 0.9 + Math.max(0, 1.0 - round * 0.08); ctx.announce("Tour " + round + ", retiens les dalles allumées", 1700);
    S.alive().forEach((p) => { p.ex.mem = null; p.ex.goal = null; });
  }
  function botMemory(p) {
    // un bon joueur retient toutes les dalles, un joueur moyen en oublie, un joueur distrait se trompe de voisine
    const sk = ctx.skill(p.id); const mem = safeList.filter(() => rnd() < 0.55 + sk * 0.45 - round * 0.015).map((q) => { if (rnd() < (1 - sk) * 0.16 + round * 0.012) { const nb = tiles.filter((o) => Math.abs(o.x - q.x) + Math.abs(o.y - q.y) <= TILE * 1.01 && o !== q); return nb[Math.floor(rnd() * nb.length)] || q; } return q; });
    p.ex.mem = mem.length ? mem : [tiles[Math.floor(rnd() * tiles.length)]]; p.ex.react = 0.1 + (1 - sk) * 0.5 * rnd();
  }
  function bot(p, dt) {
    if (phase !== "go") return { x: 0, y: 0 }; const b = p.bd, ex = p.ex; if (!ex.mem) botMemory(p); ex.react -= dt; if (ex.react > 0) return { x: 0, y: 0 };
    if (!ex.goal) { let best = null, bs = 1e9; ex.mem.forEach((q) => { const crowd = S.alive().filter((o) => o !== p && o.ex.goal === q).length; const s = Math.hypot(q.x - b.x, q.y - b.y) + crowd * 90 + rnd() * 20; if (s < bs) { bs = s; best = q; } }); ex.goal = best; }
    const w = Surv.walk(b, ex.goal.x, ex.goal.y, 1, 14); return { x: w.x, y: w.y };
  }
  function drop() { phase = "drop"; left = 1.6; ctx.snd("crack"); ctx.shake(1.5); tiles.forEach((q) => { if (!q.safe && !q.gone && !q.fall) { q.fall = 0.001; q.b.solid = false; } }); }
  const goTime = () => Math.max(2.1, 4.2 - 0.26 * round) * ctx.pace;
  const inst = {
    done: false,
    update(dt) {
      t += dt; showT += dt; if (phase !== "go") S.alive().forEach((p) => { p.bd.stun = Math.max(p.bd.stun, 0.1); });
      S.update(dt, bot); S.P.forEach((p) => { if (p.dead && p.ex.dr == null) p.ex.dr = round; });
      tiles.forEach((q) => { if (q.fall) { q.fall += dt; q.b.z -= 700 * q.fall * dt; if (q.b.z < q.base - 520) { q.gone = true; q.fall = 0; q.b.z = q.base - 600; } } });
      left -= dt;
      if (phase === "pre") { if (left <= 0) startRound(); }
      else if (phase === "show") { const lastLit = safeList.length * 0.42; if (!inst._beep || inst._beep !== Math.floor(showT / 0.42)) { inst._beep = Math.floor(showT / 0.42); if (inst._beep < safeList.length) ctx.snd("coin"); } if (left <= 0) { phase = "dark"; left = 0.9; } }
      else if (phase === "dark") { if (left <= 0) { phase = "go"; left = goTime(); ctx.snd("go"); } }
      else if (phase === "go") { if (left <= 0) drop(); }
      else if (phase === "drop") { if (left <= 0) { if (S.alive().length <= 1 || round >= maxRounds) inst.done = true; else { phase = "gap"; left = 0.5; } } }
      else if (phase === "gap") { if (left <= 0) startRound(); }
      if (S.alive().length <= 1 && ctx.n > 1 && phase !== "drop") inst.done = true;
    },
    scene() { return { w: WORLD, h: WORLD, cam: { tilt: 60, fov: 40, pad: 1.1, c: [CX, CY + 30], ht: 40 }, env: { sky: ["#1b1040", "#6a4fc8"], fog: "#2c1a66", fogN: 70, fogF: 230, ground: { c: "#160c36", z: -330 }, lt: { h: ["#e6dcff", "#5a4a9a"], hi: 0.9, d: "#f0e8ff", di: 0.8, dir: [-0.3, 1, 0.5] } }, items: [] }; },
    frame() {
      const items = []; const lighting = phase === "show"; const showSafe = phase === "drop" || phase === "gap";
      tiles.forEach((q) => { if (q.gone) return; let c = "#4a4378", lab = "", m;
        if (lighting && showT >= q.litAt && q.safe && showT < safeList.length * 0.42 + 0.7 + q.litAt * 0) { c = CL[q.sym]; lab = SYM[q.sym]; m = "glow"; }
        else if (lighting && q.safe && showT >= q.litAt) { c = CL[q.sym]; lab = SYM[q.sym]; m = "glow"; }
        if (showSafe && q.safe) { c = "#4cd964"; lab = "✔"; m = "glow"; } else if (showSafe && !q.safe && !q.fall) c = "#7a3a4a";
        items.push({ t: "box", id: q.id, x: q.x, y: q.y, z: q.b.z, w: TILE - 4, d: TILE - 4, h: 40, c, lab, lc: "rgba(0,0,0,.45)", m, sm: 30 }); });
      S.pawns((p) => ({ badge: phase === "show" ? "👀" : "" })).forEach((it) => items.push(it));
      return { w: WORLD, h: WORLD, items, hud: { title: phase === "show" ? "Retiens les dalles allumées" : phase === "dark" ? "Le sol s'éteint" : phase === "go" ? "Cours sur une dalle qui était allumée" : phase === "drop" ? "Les autres dalles tombent" : "", timer: phase === "go" ? left : null, big: phase === "dark" ? "Prêt" : "", chips: [{ text: "Tour " + round + " sur " + maxRounds }, { text: S.alive().length + " debout" }, { text: safeList.length + " dalles sûres" }] } };
    },
    priv(pid) { const p = S.byId(pid); return p ? { dead: p.dead ? 1 : 0, deadText: "Tu es tombé, regarde les autres" } : null; },
    ranking() { return S.ranking({ note: (p) => (p.dead ? "Tombé au tour " + Math.max(1, p.ex.dr || round) : "Encore debout"), headline: "🧠 La meilleure mémoire" }); },
  };
  return inst;
};

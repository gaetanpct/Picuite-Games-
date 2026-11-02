// Territoires. Un sol en damier, chaque pas repeint la case sous tes pieds à la couleur de ton équipe.
// À quatre joueurs ou plus, deux équipes tirées au hasard. À deux ou trois, chacun pour soi. Maj éclabousse les cases autour de toi.
// Des seaux dorés apparaissent et donnent une grosse éclaboussure. À la fin, l'équipe qui possède le plus de cases gagne.
const U = require("../pg-util.js");
const Plat = require("../pg-plat.js");
const Surv = require("../pg-surv.js");

const G = 7, TS = 100, HALF = (G * TS) / 2; const TEAMS = [{ n: "Orange", c: "#ff8a1f" }, { n: "Bleue", c: "#3b9bff" }];
const FFA = ["#ef4b4b", "#3b82f6", "#34c36c", "#f5c518", "#9b5de5", "#ff8a1f", "#ff6fb5", "#1fc8c0"];
exports.create = function (ctx) {
  const rnd = ctx.rnd; const n = ctx.n; const TIME = Math.round(52 * ctx.len * (ctx.pace > 1.2 ? 1.15 : 1)); const teamed = n >= 4;
  const world = new Plat.World(); world.add({ x: 0, y: 0, z: -40, w: G * TS + 60, d: G * TS + 60, h: 40, e: 0.1 });
  [[0, -HALF - 20, G * TS + 80, 40], [0, HALF + 20, G * TS + 80, 40], [-HALF - 20, 0, 40, G * TS + 80], [HALF + 20, 0, 40, G * TS + 80]].forEach((w) => world.add({ x: w[0], y: w[1], z: 0, w: w[2], d: w[3], h: 70, e: 0.3 }));
  const cfg = { maxV: 300 * ctx.speed, accG: ctx.heavy ? 1100 : 2600, accA: 1400, jumpV: 0, maxJumps: 0, g: 1800, kill: -300 };
  const S = Surv.setup(ctx, world, cfg, { spawn: (i, nn) => { const a = (i / nn) * 6.283 + 0.4; return { x: Math.cos(a) * 250, y: Math.sin(a) * 250, z: 2, face: a + 3.14 }; }, killZ: -300, shove: 1.2, push: false, human: (p, i, e) => { p.sReq = !!e.b; return { x: i.x, y: i.y }; } });
  const tm = teamed ? U.randomTeams(ctx.players.map((m) => m.id), 2, rnd) : null;
  S.P.forEach((p, i) => { p.team = teamed ? (tm[0].includes(p.id) ? 0 : 1) : i; p.col = teamed ? TEAMS[p.team].c : FFA[p.k % FFA.length]; p.painted = 0; p.splash = 0; p.sCd = 0; p.sReq = false; });
  const tiles = Array.from({ length: G * G }, () => ({ own: -1 })); const nTeams = teamed ? 2 : n; const sizeOf = (t) => Math.max(1, S.P.filter((p) => p.team === t).length);
  const tcx = (i) => (i % G - (G - 1) / 2) * TS, tcy = (i) => (Math.floor(i / G) - (G - 1) / 2) * TS; const tileAt = (x, y) => { const gx = Math.floor((x + HALF) / TS), gy = Math.floor((y + HALF) / TS); return gx < 0 || gy < 0 || gx >= G || gy >= G ? -1 : gy * G + gx; };
  let t = 0, bucket = null, bucketIn = 9; const flashes = [];
  const paint = (idx, p) => { if (idx < 0) return; const tl = tiles[idx]; if (tl.own !== p.team) { tl.own = p.team; p.painted++; } };
  function splash(p, rad, big) { const b = p.bd; for (let i = 0; i < tiles.length; i++) { if (Math.hypot(tcx(i) - b.x, tcy(i) - b.y) <= rad) paint(i, p); } ctx.fx("ring", b.x, b.y, 4, p.col); ctx.fx("boom", b.x, b.y, 10, p.col); ctx.snd(big ? "boom" : "whoosh"); flashes.push({ x: b.x, y: b.y, r: rad, c: p.col, at: t }); }
  function bot(p, dt) {
    const b = p.bd, sk = ctx.skill(p.id), ex = p.ex; ex.think = (ex.think || 0) - dt; const inp = { x: 0, y: 0 }; p.sReq = false;
    if (ex.think <= 0 || ex.goal == null || (ex.goal === -2 && !bucket) || (ex.goal >= 0 && tiles[ex.goal].own === p.team)) {
      ex.think = 0.3 + (1 - sk) * 0.5; if (ex.homeT == null || t > ex.homeT) { ex.homeT = t + 8 + rnd() * 6; ex.hx = (rnd() - 0.5) * 560; ex.hy = (rnd() - 0.5) * 560; } let best = -1, bs = -1e9;
      for (let i = 0; i < tiles.length; i++) { const d = Math.hypot(tcx(i) - b.x, tcy(i) - b.y); const foe = tiles[i].own >= 0 && tiles[i].own !== p.team; const taken = S.P.some((q) => q !== p && q.ex.goal === i && Math.hypot(tcx(i) - q.bd.x, tcy(i) - q.bd.y) < d + 60); const s = (taken ? -220 : 0) + (tiles[i].own === p.team ? -300 : 0) + (foe ? 12 * sk : 0) - d * (0.9 + (1 - sk) * 0.4) - Math.hypot(tcx(i) - ex.hx, tcy(i) - ex.hy) * 0.45 + rnd() * 60 * (1 - sk); if (s > bs) { bs = s; best = i; } }
      ex.goal = best;
      if (bucket && Math.hypot(bucket.x - b.x, bucket.y - b.y) < 260 * (0.5 + sk)) ex.goal = -2;
    }
    let tx, ty; if (ex.goal === -2 && bucket) { tx = bucket.x; ty = bucket.y; } else { const g = ex.goal >= 0 ? ex.goal : 0; tx = tcx(g); ty = tcy(g); }
    const w = Surv.walk(b, tx, ty, 0.9 + sk * 0.1, 10); inp.x = w.x; inp.y = w.y;
    if (p.sCd <= 0 && sk > 0.3) { let foreign = 0; for (let i = 0; i < tiles.length; i++) if (tiles[i].own !== p.team && Math.hypot(tcx(i) - b.x, tcy(i) - b.y) <= 150) foreign++; if (foreign >= 4 + (1 - sk) * 3) p.sReq = true; }
    return inp;
  }
  const scoreOf = (tn) => tiles.filter((x) => x.own === tn).length / sizeOf(tn);
  const inst = {
    done: false,
    update(dt) {
      t += dt; S.P.forEach((p) => { p.sCd = Math.max(0, p.sCd - dt); });
      S.update(dt, bot, (p) => { const b = p.bd; if (b.grounded) paint(tileAt(b.x, b.y), p); if (p.sReq && p.sCd <= 0) { p.sCd = 6.5; splash(p, 135, false); } p.sReq = false; if (bucket && Math.hypot(bucket.x - b.x, bucket.y - b.y) < 44) { bucket = null; bucketIn = 11 + rnd() * 5; splash(p, 230, true); ctx.announce(p.name + " ramasse le seau doré", 1500); } });
      if (!bucket) { bucketIn -= dt; if (bucketIn <= 0 && t < TIME - 6) { const i = Math.floor(rnd() * tiles.length); bucket = { x: tcx(i), y: tcy(i) }; ctx.announce("Un seau doré est apparu", 1400); ctx.snd("reveal"); } }
      while (flashes.length && t - flashes[0].at > 0.6) flashes.shift();
      if (t >= TIME) inst.done = true;
    },
    scene() {
      const items = [{ t: "box", x: 0, y: 0, z: -40, w: G * TS + 60, d: G * TS + 60, h: 40, c: "#3a4258" }];
      [[0, -HALF - 20, G * TS + 80, 40], [0, HALF + 20, G * TS + 80, 40], [-HALF - 20, 0, 40, G * TS + 80], [HALF + 20, 0, 40, G * TS + 80]].forEach((w) => items.push({ t: "box", x: w[0], y: w[1], z: 0, w: w[2], d: w[3], h: 70, c: "#6b7692", sm: 20 }));
      return { w: 1000, h: 1000, cam: { tilt: 62, fov: 40, pad: 1.1, c: [0, 0], ht: 30 }, env: { sky: ["#1b2b4a", "#8fb4e8"], fog: "#35507a", fogN: 80, fogF: 280, ground: { c: "#202a40", z: -300 }, lt: { h: ["#eaf1ff", "#5a6a8a"], hi: 1, d: "#fff", di: 0.95, dir: [-0.3, 1, 0.5] } }, items };
    },
    frame() {
      const items = []; tiles.forEach((tl, i) => { const col = tl.own < 0 ? "#cfd6e4" : teamed ? TEAMS[tl.own].c : FFA[(S.P[tl.own].k) % FFA.length]; items.push({ t: "box", id: "tl" + i, x: tcx(i), y: tcy(i), z: 0, w: TS - 6, d: TS - 6, h: 3, c: col, sm: 12 }); });
      flashes.forEach((f, i) => items.push({ t: "ring", id: "fl" + i + "_" + Math.round(f.at * 10), x: f.x, y: f.y, z: 6, r: f.r * (0.4 + (t - f.at) * 1.5), c: f.c, w: 6, a: 0.8 }));
      if (bucket) items.push({ t: "cyl", id: "bucket", x: bucket.x, y: bucket.y, z: 3, r: 22, h: 34, c: "#ffd23b", m: "neon" }, { t: "text", id: "bucketx", x: bucket.x, y: bucket.y, z: 52, v: "🪣", s: 40 });
      S.pawns((p) => { const q = S.byId(p.id); return { badge: teamed ? TEAMS[q.team].n.charAt(0) : "", st: "" }; }).forEach((it) => items.push(it));
      const chips = []; for (let k = 0; k < nTeams; k++) { const cnt = tiles.filter((x) => x.own === k).length; chips.push({ text: (teamed ? TEAMS[k].n : S.P[k].name) + " " + Math.round(cnt / (G * G) * 100) + " %" }); }
      return { w: 1000, h: 1000, items, hud: { title: teamed ? "Deux équipes, repeins le plus de cases, Maj éclabousse" : "Chacun pour soi, repeins le plus de cases, Maj éclabousse", timer: Math.max(0, TIME - t), chips: chips.slice(0, 4) } };
    },
    priv(pid) { const p = S.byId(pid); if (!p) return null; const out = { bars: [{ label: p.sCd > 0 ? "Éclaboussure en recharge" : "Éclaboussure prête", pct: p.sCd > 0 ? 100 * (1 - p.sCd / 6.5) : 100, c: p.col }] }; if (teamed) out.role = { name: "Équipe " + TEAMS[p.team].n, c: TEAMS[p.team].c, tip: "Tes pas repeignent les cases, Maj éclabousse autour de toi" }; return out; },
    ranking() {
      const sc = []; for (let k = 0; k < nTeams; k++) sc.push({ k, v: scoreOf(k) });
      const order = sc.slice().sort((a, b) => b.v - a.v); const groups = []; order.forEach((o) => { const ids = S.P.filter((p) => p.team === o.k).map((p) => p.id); const last = groups[groups.length - 1]; if (last && Math.abs(last.v - o.v) < 0.001) last.ids.push.apply(last.ids, ids); else groups.push({ v: o.v, ids }); });
      const bonus = {}, notes = {}; const top = S.P.slice().sort((a, b) => b.painted - a.painted)[0]; if (top) bonus[top.id] = 1;
      S.P.forEach((p) => { const cnt = tiles.filter((x) => x.own === p.team).length; notes[p.id] = (teamed ? "Équipe " + TEAMS[p.team].n + ", " : "") + cnt + " case" + (cnt > 1 ? "s" : "") + (teamed ? " pour l'équipe" : "") + ", " + p.painted + " repeinte" + (p.painted > 1 ? "s" : ""); });
      const w = order[0]; return { groups: groups.map((g) => g.ids), bonus, notes, headline: "🎨 " + (teamed ? "L'équipe " + TEAMS[w.k].n : S.P[w.k].name) + " peint le plus de cases" };
    },
  };
  return inst;
};

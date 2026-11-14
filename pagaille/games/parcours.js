// Course des fous, façon Fall Guys. Un parcours d'obstacles en 3D qui tourne, monte et se divise en deux chemins.
// Les bots sont simulés par le serveur. Chaque humain fait courir son propre coureur dans son navigateur, tout de suite,
// et envoie sa position. Le serveur vérifie qu'elle est plausible, gère les drapeaux, les chutes, les portes, l'arrivée et les bousculades.
const U = require("../pg-util.js");
const Plat = require("../pg-plat.js");

exports.create = function (ctx) {
  const rnd = ctx.rnd; const n = ctx.n; const DIFF = { facile: 0, normal: 1, dur: 2 }; const diff = DIFF[ctx.opts.raceDiff] != null ? DIFF[ctx.opts.raceDiff] : 1;
  const world = new Plat.World(); const stat = []; const dyn = []; const cps = []; const obstacles = []; const line = []; const fans = []; const tiles = [];
  const R = (a, b) => a + rnd() * (b - a);
  const cols = ["#7ed957", "#5fd0a5", "#ffc857", "#ff9f68", "#8fb8ff", "#c79bff"];
  const H = 70, KILL = -260;
  const F = { x: 0, y: 0, z: 0, a: -Math.PI / 2 }; let lat = 0; let laneMode = null; const paths = [[], []];
  const cp = () => ({ x: F.x, y: F.y, z: F.z, a: F.a });
  const fwd = (fr) => [Math.cos((fr || F).a), Math.sin((fr || F).a)];
  const rgt = (fr) => [-Math.sin((fr || F).a), Math.cos((fr || F).a)];
  const W = (lx, lf, fr) => { fr = fr || F; const c = Math.cos(fr.a), s = Math.sin(fr.a); return { x: fr.x - s * lx + c * lf, y: fr.y + c * lx + s * lf }; };
  const ROT = (fr) => (fr || F).a + Math.PI / 2;
  function adv(len) { const f = fwd(); F.x += f[0] * len; F.y += f[1] * len; line.push({ x: F.x, y: F.y, z: F.z, a: F.a }); }
  function plat(lx, lf, top, w, d, opt) {
    opt = opt || {}; const fr = opt.fr || F; const p = W(lx, lf, fr); const rot = ROT(fr) + (opt.rot || 0);
    const b = world.add({ x: p.x, y: p.y, z: top - H, w, d, h: H, rot, e: 0.15 }); const c = opt.c || cols[Math.floor(rnd() * cols.length)];
    stat.push({ t: "box", x: p.x, y: p.y, z: top - H, w, d, h: H - 7, rot, c: "#6b7a99" }); stat.push({ t: "box", x: p.x, y: p.y, z: top - 7, w: w + 2, d: d + 2, h: 7, rot, c, ns: 1, lab: opt.lab, lc: opt.lc });
    return b;
  }
  function node(lx, lf, z, extra, fr) {
    fr = fr || F; const p = W(lx, lf, fr); const nd = Object.assign({ x: p.x, y: p.y, z, d: 150, f: fwd(fr), r: rgt(fr) }, extra || {});
    if (laneMode == null) { paths[0].push(nd); paths[1].push(nd); } else paths[laneMode].push(nd); return nd;
  }
  function addDyn(o) { o.id = o.id || "d" + dyn.length; dyn.push(o); return o; }

  // ---------- les sections ----------
  function rest(len, flag, banner, wide) {
    const w = wide || 320; plat(lat * 0.5, len / 2, F.z, w, len, { c: banner ? "#ffe066" : "#9be37a" }); node(lat * 0.5, len / 2, F.z, { k: "rest", d: len });
    if (flag) { const p = W(lat * 0.5 + w / 2 - 34, len / 2); const idx = cps.length; const sp = W(lat * 0.5, len / 2); cps.push({ x: sp.x, y: sp.y, z: F.z, a: F.a, ni: [paths[0].length - 1, paths[1].length - 1], flag: { t: "flag", id: "f" + idx, x: p.x, y: p.y, z: F.z, c: "#ff4d6d" } }); }
    lat = 0; adv(len);
  }
  function gaps(cnt) {
    for (let i = 0; i < cnt; i++) {
      const gap = R(75, 105) + diff * 18 + i * 3, d = R(150, 210) - diff * 20, w = R(200, 260) - diff * 35; const nl = U.clamp(lat + R(-90, 90), -140, 140); const nz = U.clamp(F.z + R(-40, 36), -80, 220);
      plat(nl, gap + d / 2, nz, w, d); node(nl, gap + d / 2, nz, { k: "gap", d }); adv(gap + d); F.z = nz; lat = nl;
    }
  }
  function movers(cnt) {
    for (let i = 0; i < cnt; i++) {
      const gap = R(95, 115) + diff * 12, d = 170, w = 170 - diff * 18, A = R(130, 190), T = (R(3.2, 4.4) - diff * 0.5) / Math.max(0.7, ctx.speed), ph = rnd() * 6.28;
      const fr = cp(); const c = W(0, gap + d / 2, fr); const r = rgt(fr);
      const b = world.add({ x: c.x, y: c.y, z: F.z - H, w, d, h: H, rot: ROT(fr), e: 0.1, move: (t) => { const o = Math.sin((t * 6.283) / T + ph) * A; return { x: c.x + r[0] * o, y: c.y + r[1] * o }; } });
      addDyn({ b, c: "#ff9f43", cap: "#ffd18a" }); node(0, gap + d / 2, F.z, { k: "mover", mv: b, d }); adv(gap + d); lat = 0;
    }
  }
  function sweeper() {
    const len = 680, w = 230; const fr = cp(); plat(0, len / 2, F.z, w, len, { c: "#8ec5ff" }); node(0, 60, F.z, { k: "bridge" });
    const om = (1.5 + diff * 0.55) * (rnd() < 0.5 ? 1 : -1) * Math.min(1.25, ctx.speed); const c = W(0, len / 2, fr);
    const bar = world.add({ x: c.x, y: c.y, z: F.z, w: 340, d: 24, h: 48, e: 0.8, stun: 0.55, move: (t) => ({ rot: ROT(fr) + t * om }) });
    addDyn({ b: bar, c: "#ff4d6d", kind: "bar" }); obstacles.push({ b: bar, k: "bar", f: fwd(fr), r: rgt(fr) });
    if (diff >= 2) { const c2 = W(0, len / 2 + 240, fr); const bar2 = world.add({ x: c2.x, y: c2.y, z: F.z, w: 300, d: 24, h: 48, e: 0.8, stun: 0.55, move: (t) => ({ rot: ROT(fr) - t * om * 1.1 + 1 }) }); addDyn({ b: bar2, c: "#ff9f43", kind: "bar" }); obstacles.push({ b: bar2, k: "bar", f: fwd(fr), r: rgt(fr) }); }
    node(0, len - 60, F.z, { k: "bridge" }); adv(len); lat = 0;
  }
  function pistons() {
    const len = 560, w = 300; const fr = cp(); plat(0, len / 2, F.z, w, len, { c: "#ffd37a" }); node(0, 40, F.z, { k: "piston" }); const r = rgt(fr);
    const cnt = 2 + diff; for (let i = 0; i < cnt; i++) {
      const lf = 130 + (i * (len - 200)) / Math.max(1, cnt - 1) * 0.97; const T = (2.6 - diff * 0.3) / Math.max(0.7, ctx.speed), ph = rnd() * 6.28, dir = i % 2 ? 1 : -1; const c = W(0, lf, fr);
      const pb = world.add({ x: c.x, y: c.y, z: F.z, w: 120, d: 44, h: 82, rot: ROT(fr), e: 0.7, stun: 0.4, move: (t) => { const o = dir * Math.sin((t * 6.283) / T + ph) * 150; return { x: c.x + r[0] * o, y: c.y + r[1] * o }; } });
      addDyn({ b: pb, c: "#d94f70" }); obstacles.push({ b: pb, k: "piston", f: fwd(fr), r });
    }
    node(0, len - 40, F.z, { k: "piston" }); adv(len); lat = 0;
  }
  function stairs() {
    const steps = 4 + diff; let top = F.z;
    for (let i = 0; i < steps; i++) { top += 34; plat(lat, 55, top, 250, 110, { c: "#f0a6ff" }); node(lat, 55, top, { k: "stair", d: 110 }); adv(110); }
    plat(lat, 90, top, 250, 180, { c: "#f0a6ff" }); node(lat, 90, top, { k: "stair", d: 180 }); adv(180);
    const low = Math.max(-60, top - 130); plat(lat, 170, low, 260, 140, { c: "#9be37a" }); node(lat, 170, low, { k: "gap", d: 140 }); adv(240); F.z = low;
  }
  function beam() {
    const len = 420 + diff * 60, w = 74 - diff * 8; plat(lat, 90 + len / 2, F.z, w, len, { c: "#ffb4a2" }); node(lat, 110, F.z, { k: "beam", ed: 20 }); node(lat, 70 + len, F.z, { k: "beam" }); adv(90 + len);
  }
  function fallers(cnt) {
    for (let i = 0; i < cnt; i++) {
      const gap = R(70, 95) + diff * 10, d = 150, w = 180 - diff * 20; const nl = U.clamp(lat + R(-110, 110), -170, 170); const c = W(nl, gap + d / 2);
      const b = world.add({ x: c.x, y: c.y, z: F.z - H, w, d, h: H, rot: ROT(), e: 0.1 }); const st = addDyn({ b, c: "#c9a27a", timer: -1, fall: 0, base: F.z - H, drop: true });
      b.hurt = () => { if (st.timer < 0) st.timer = 0.55 / Math.max(0.8, ctx.speed); }; node(nl, gap + d / 2, F.z, { k: "gap", d }); adv(gap + d); lat = nl;
    }
  }
  // un mur de portes, certaines s'ouvrent quand on fonce dedans, les autres sont fausses
  function doors() {
    const len = 520, w = 340; const fr = cp(); plat(0, len / 2, F.z, w, len, { c: "#b9e4ff" }); node(0, 70, F.z, { k: "rest" });
    const nd = 5; const dw = w / nd; const nReal = diff === 0 ? 3 : 2; const real = U.shuffle([0, 1, 2, 3, 4], rnd).slice(0, nReal); const list = [];
    for (let k = 0; k < nd; k++) {
      const lx = -w / 2 + dw * (k + 0.5); const c = W(lx, len * 0.45, fr); const isReal = real.includes(k);
      const b = world.add({ x: c.x, y: c.y, z: F.z, w: dw - 6, d: 22, h: 92, rot: ROT(fr), e: 0.25 }); const o = addDyn({ b, c: ["#ff7aa8", "#7a8cff", "#ffc35a", "#5fd0a5", "#c79bff"][k], kind: "door", real: isReal, openT: 0 });
      b.hit = () => { if (o.real && !o.openT) { o.openT = 3.4; b.solid = false; ctx.fx("puff", c.x, c.y, F.z + 40, ""); ctx.snd("crack"); } };
      list.push({ o, x: c.x, y: c.y });
    }
    node(0, len * 0.45, F.z, { k: "door", doors: list }); node(0, len - 50, F.z, { k: "rest" }); adv(len); lat = 0;
  }
  // des rouleaux géants roulent vers les coureurs, il faut sauter par dessus
  function rollers() {
    const len = 620, w = 280; const fr = cp(); plat(0, len / 2, F.z, w, len, { c: "#d7c4a3" }); node(0, 50, F.z, { k: "rest" });
    const cnt = 2 + (diff >= 1 ? 1 : 0); const vR = (140 + diff * 30) * Math.min(1.25, ctx.speed); const span = len - 80;
    for (let k = 0; k < cnt; k++) {
      const ofs = (k / cnt) * span; const b = world.add({ x: 0, y: 0, z: F.z, w: 300, d: 46, h: 46, rot: ROT(fr), e: 0.6, stun: 0.5, move: (t) => { const s = (t * vR + ofs) % span; const p = W(0, len - 40 - s, fr); return { x: p.x, y: p.y }; } });
      const p0 = W(0, len - 40 - (ofs % span), fr); b.x = p0.x; b.y = p0.y; addDyn({ b, c: "#a0662b", kind: "log" }); obstacles.push({ b, k: "log", f: fwd(fr), r: rgt(fr) });
    }
    node(0, len - 40, F.z, { k: "rest" }); adv(len); lat = 0;
  }
  // un tapis roulant qui recule, avec des poteaux à éviter
  function conveyor() {
    const len = 560, w = 260; const fr = cp(); const vb = 85 + diff * 35; const f = fwd(fr); const b = plat(0, len / 2, F.z, w, len, { c: "#4d5262" }); b.belt = [-f[0] * vb, -f[1] * vb];
    node(0, 40, F.z, { k: "rest" });
    const posts = 2 + diff; for (let k = 0; k < posts; k++) { const lx = (k % 2 ? 1 : -1) * R(30, 70); const lf = 130 + (k * (len - 230)) / Math.max(1, posts - 1); const p = W(lx, lf, fr); world.add({ x: p.x, y: p.y, z: F.z, w: 46, d: 46, h: 60, rot: ROT(fr), e: 0.5 }); stat.push({ t: "box", x: p.x, y: p.y, z: F.z, w: 46, d: 46, h: 60, rot: ROT(fr), c: "#ff4d6d" }); node(-lx * 1.6, lf, F.z, { k: "belt" }); }
    // des bandes qui défilent pour montrer le sens du tapis
    for (let k = 0; k < 6; k++) addDyn({ vis: true, kind: "stripe", fr, lf0: (k / 6) * len, len, vb, w });
    node(0, len - 40, F.z, { k: "rest" }); adv(len); lat = 0;
  }
  // des ventilateurs sur les côtés qui soufflent par moments
  function fansSec() {
    const len = 540, w = 210; const fr = cp(); plat(0, len / 2, F.z, w, len, { c: "#a8e6ff" }); node(0, 40, F.z, { k: "rest" }); const r = rgt(fr);
    const cnt = 2 + (diff >= 2 ? 1 : 0);
    for (let k = 0; k < cnt; k++) {
      const lf = 120 + (k * (len - 220)) / Math.max(1, cnt - 1); const side = k % 2 ? 1 : -1; const c = W(0, lf, fr); const strength = 820 + diff * 180;
      const zn = { x: c.x, y: c.y, w: w + 60, d: 130, rot: ROT(fr), z0: F.z - 20, z1: F.z + 220, fx: -side * r[0] * strength, fy: -side * r[1] * strength, off: false, per: 3.6, on: 2.1, ph: rnd() * 3 };
      world.zones.push(zn); fans.push({ zn, side, c, fr, lf });
      const fp = W(side * (w / 2 + 40), lf, fr); stat.push({ t: "box", x: fp.x, y: fp.y, z: F.z - 20, w: 40, d: 120, h: 140, rot: ROT(fr), c: "#5b6b88" }); stat.push({ t: "cyl", x: fp.x, y: fp.y, z: F.z + 120, r: 46, h: 10, c: "#d8e6f7" });
      node(0, lf, F.z, { k: "fan", fan: zn });
    }
    node(0, len - 40, F.z, { k: "rest" }); adv(len); lat = 0;
  }
  // des marteaux qui balancent en série sur un pont
  function pendulums() {
    const len = 620, w = 200; const fr = cp(); plat(0, len / 2, F.z, w, len, { c: "#ffcf9e" }); node(0, 40, F.z, { k: "rest" }); const r = rgt(fr);
    const cnt = 3; const T = (2.4 - diff * 0.25) / Math.max(0.7, ctx.speed);
    for (let k = 0; k < cnt; k++) {
      const lf = 150 + k * 160; const c = W(0, lf, fr); const ph = k * 1.3;
      const b = world.add({ x: c.x, y: c.y, z: F.z + 6, w: 74, d: 74, h: 74, rot: ROT(fr), e: 0.9, stun: 0.6, move: (t) => { const o = Math.sin((t * 6.283) / T + ph) * 140; return { x: c.x + r[0] * o, y: c.y + r[1] * o }; } });
      addDyn({ b, c: "#7c4dff", kind: "hammer", pivot: [c.x, c.y, F.z + 300] }); obstacles.push({ b, k: "hammer", f: fwd(fr), r });
      node(0, lf + 70, F.z, { k: "hammer" });
    }
    node(0, len - 40, F.z, { k: "rest" }); adv(len); lat = 0;
  }
  // un sol de dalles bleues et rouges, une couleur disparaît à tour de rôle
  function tilesSec() {
    const cols2 = 3, rows = 5, ts = 92, gp = 6; const fr = cp(); const per = 3.4 / Math.max(0.8, ctx.speed);
    for (let rw = 0; rw < rows; rw++) for (let cl = 0; cl < cols2; cl++) {
      const lx = (cl - 1) * (ts + gp), lf = 30 + rw * (ts + gp) + ts / 2; const p = W(lx, lf, fr); const color = (rw + cl) % 2;
      const b = world.add({ x: p.x, y: p.y, z: F.z - H, w: ts, d: ts, h: H, rot: ROT(fr), e: 0.1 }); const o = addDyn({ b, c: color ? "#ff4d6d" : "#3b82f6", kind: "tile", color, per, base: F.z - H }); tiles.push(o);
    }
    node(0, 30 + (ts + gp) * 1.5, F.z, { k: "tile" }); node(0, 30 + (ts + gp) * 3.5, F.z, { k: "tile" }); adv(30 + rows * (ts + gp) + 10); lat = 0;
  }
  // un virage, une aire carrée puis le parcours repart dans une autre direction
  function turn(da) {
    const sz = 330; plat(lat * 0.4, sz / 2, F.z, sz, sz, { c: "#9be37a", rot: da / 2 }); node(lat * 0.4, sz / 2, F.z, { k: "rest", d: sz });
    const c = W(lat * 0.4, sz / 2); F.x = c.x; F.y = c.y; F.a += da; lat = 0; adv(sz / 2 - 10);
  }
  // la course se divise en deux chemins qui se rejoignent plus loin
  function fork() {
    rest(150, false, false, 560); const fr = cp(); const L = 640; const off = 175;
    // chemin de gauche, des pierres rapprochées, plus sûr
    laneMode = 0; for (let k = 0; k < 5; k++) { const lf = 38 + k * 128 + 45; const lx = -off + (k % 2 ? 26 : -26); plat(lx, lf, F.z, 112, 90, { c: "#7ed957", fr }); node(lx, lf, F.z, { k: "gap", d: 90 }, fr); }
    // chemin de droite, une poutre directe avec deux marteaux
    laneMode = 1; plat(off, L / 2, F.z, 70 - diff * 6, L, { c: "#ffb4a2", fr }); node(off, 30, F.z, { k: "beam", ed: 20 }, fr);
    // sur le chemin rapide, un seul marteau lent quand c'est costaud
    if (diff >= 2) { const r = rgt(fr); const c = W(off, L / 2, fr); const T = 3.2 / Math.max(0.7, ctx.speed);
      const b = world.add({ x: c.x, y: c.y, z: F.z + 6, w: 56, d: 56, h: 60, rot: ROT(fr), e: 0.9, stun: 0.6, move: (t) => { const o = Math.sin((t * 6.283) / T) * 110; return { x: c.x + r[0] * o, y: c.y + r[1] * o }; } });
      addDyn({ b, c: "#7c4dff", kind: "hammer", pivot: [c.x, c.y, F.z + 280] }); obstacles.push({ b, k: "hammer", f: fwd(fr), r }); }
    node(off, L - 30, F.z, { k: "beam" }, fr);
    laneMode = null; adv(L); const sign = W(0, -L - 30, F); stat.push({ t: "text", x: sign.x, y: sign.y, z: F.z + 120, v: "◀ Sûr      Rapide ▶", c: "#ffffff", s: 26 });
    rest(170, true, false, 560);
  }

  // ---------- assemblage ----------
  plat(0, 130, 0, 380, 260, { c: "#ffe066" }); node(0, 130, 0, { k: "rest", d: 260 }); line.push({ x: F.x, y: F.y, z: 0, a: F.a }); adv(260);
  const pool = U.shuffle(["movers", "sweeper", "pistons", "stairs", "beam", "fallers", "doors", "rollers", "conveyor", "fans", "pendulums", "tiles"], rnd);
  const count = 6 + diff; const order = ["gaps"].concat(pool.slice(0, count - 1)); const forkAt = diff >= 1 ? 2 + Math.floor(rnd() * 2) : -1;
  let turnSign = rnd() < 0.5 ? 1 : -1;
  order.forEach((m, i) => {
    if (i === forkAt) fork();
    if (m === "gaps") gaps(3 + diff + (i === 0 ? 1 : 0)); else if (m === "movers") movers(2 + (diff > 0 ? 1 : 0)); else if (m === "sweeper") sweeper(); else if (m === "pistons") pistons(); else if (m === "stairs") stairs(); else if (m === "beam") beam(); else if (m === "fallers") fallers(3 + diff);
    else if (m === "doors") doors(); else if (m === "rollers") rollers(); else if (m === "conveyor") conveyor(); else if (m === "fans") fansSec(); else if (m === "pendulums") pendulums(); else if (m === "tiles") tilesSec();
    if (i < order.length - 1) { if (i % 2 === 1) { turn(turnSign * R(0.45, 0.85)); turnSign = -turnSign; } rest(150, i % 2 === 1 || i === 1); }
  });
  rest(300, false, true); const FIN = paths[0][paths[0].length - 1];
  const finP = W(0, -150); const finA = F.a;
  stat.push({ t: "box", x: finP.x, y: finP.y, z: F.z, w: 300, d: 14, h: 3, rot: ROT(), c: "#ffffff", ns: 1 }); stat.push({ t: "deco", kind: "banner", x: finP.x, y: finP.y, z: F.z, s: 1.5, c: "#ff4d6d", rot: ROT() });
  const finZ = F.z;
  // décor le long du parcours
  const segs = []; let total = 0; for (let i = 1; i < line.length; i++) { const L = Math.hypot(line[i].x - line[i - 1].x, line[i].y - line[i - 1].y); segs.push({ a: line[i - 1], b: line[i], L, s0: total }); total += L; }
  let finS = 0; { const pr = project(finP.x, finP.y, segs.length - 1); finS = pr.s; }
  for (let i = 0; i < 22; i++) { const sg = segs[Math.floor(rnd() * segs.length)]; const k = rnd(); const x = sg.a.x + (sg.b.x - sg.a.x) * k, y = sg.a.y + (sg.b.y - sg.a.y) * k; const r = [-Math.sin(sg.a.a), Math.cos(sg.a.a)]; const side = rnd() < 0.5 ? 1 : -1; const off = 420 + R(0, 220); stat.push({ t: "deco", kind: i % 3 ? "tree" : "rock", x: x + r[0] * off * side, y: y + r[1] * off * side, z: -90 - R(0, 40), s: R(2.4, 4) }); }
  for (let i = 0; i < 7; i++) { const sg = segs[Math.floor(rnd() * segs.length)]; stat.push({ t: "deco", kind: "cloud", x: sg.a.x + R(-700, 700), y: sg.a.y + R(-300, 300), z: 420 + R(0, 180), s: 3 }); }

  // position le long du parcours, la projection sur la ligne centrale, de 0 au départ jusqu'à la longueur totale
  function project(x, y, hint) {
    let best = { d: 1e9, s: 0, i: 0 }; const lo = hint == null ? 0 : Math.max(0, hint - 3), hi = hint == null ? segs.length - 1 : Math.min(segs.length - 1, hint + 4);
    for (let i = lo; i <= hi; i++) { const sg = segs[i]; const dx = sg.b.x - sg.a.x, dy = sg.b.y - sg.a.y; let u = sg.L ? ((x - sg.a.x) * dx + (y - sg.a.y) * dy) / (sg.L * sg.L) : 0; u = U.clamp(u, 0, 1); const px = sg.a.x + dx * u, py = sg.a.y + dy * u; const d = Math.hypot(x - px, y - py); if (d < best.d) best = { d, s: sg.s0 + u * sg.L, i, a: Math.atan2(dy, dx) }; }
    return best;
  }

  // ---------- les coureurs ----------
  const maxV = 305 * ctx.speed * (ctx.heavy ? 0.85 : 1);
  const cfg = { maxV, accG: ctx.heavy ? 1200 : 2600, accA: 1400, diveV: 500 * Math.min(1.2, ctx.speed), friction: 1, flop: 1050 };
  const P = ctx.players.map((m, i) => {
    const bd = Plat.body(((i % 4) - 1.5) * 60, -90 + Math.floor(i / 4) * 50, 4, {}); const lane = rnd() < 0.5 ? 0 : 1;
    return { id: m.id, k: m.color, name: m.name, bd, cp: -1, ni: 1, lane, falls: 0, prog: 0, seg: 0, finished: 0, finT: 0, respawn: 0, noise: 0, noiseT: 0, jumpCd: 0, sp: 1, rep: null, held: 0, grabT: 0, grabbing: null, doorTry: {}, squeak: 0 };
  });
  P.forEach((p) => { const sk = ctx.skill(p.id); if (ctx.isBot(p.id)) p.lane = sk > 0.8 ? (rnd() < 0.7 ? 1 : 0) : rnd() < 0.3 ? 1 : 0; });
  const byId = {}; P.forEach((p) => { byId[p.id] = p; });
  const places = n >= 3 && !process.env.PG_NOPLACES ? Math.max(1, Math.round(n * 0.6)) : n;
  const finishers = []; let t = 0; let firstAt = 0;
  function spawn(p) {
    const c = p.cp >= 0 ? cps[p.cp] : { x: 0, y: -130, z: 0, a: -Math.PI / 2, ni: [0, 0] }; const b = p.bd; const k = P.indexOf(p); const r = [-Math.sin(c.a), Math.cos(c.a)], f = [Math.cos(c.a), Math.sin(c.a)];
    const lx = ((k % 4) - 1.5) * 50, lf = -Math.floor(k / 4) * 40 + 10; b.x = c.x + r[0] * lx + f[0] * lf; b.y = c.y + r[1] * lx + f[1] * lf; b.z = c.z + 4; b.vx = b.vy = b.vz = 0; b.alive = true; b.stun = 0; b.grounded = false; b.face = c.a; b.dive = 0;
    p.ni = (c.ni ? c.ni[p.lane] : 0) + 1; p.respawn = 0; p.inv = 1.2; p.sp++; p.rep = null; p.stuckT = 0;
  }
  const posOf = (nd) => (nd.mv ? { x: nd.mv.x, y: nd.mv.y } : { x: nd.x, y: nd.y });
  const dot = (ax, ay, v) => ax * v[0] + ay * v[1];
  function boxUnder(b) { let best = null; for (let i = 0; i < world.boxes.length; i++) { const bx = world.boxes[i]; if (!bx.solid) continue; const top = bx.z + bx.h; if (top > b.z + 4 || top < b.z - 8) continue; if (!Plat.over(bx, b.x, b.y, b.r * 0.55)) continue; if (!best || top > best.z + best.h) best = bx; } return best; }
  function tileWarned(o) { const ph = (t % (o.per * 2)) / o.per; const c = Math.floor(ph); const u = ph - c; return c === o.color && u > 0.45; }

  // ---------- bots ----------
  function botThink(p, dt) {
    const b = p.bd; const sk = ctx.skill(p.id); const inp = { x: 0, y: 0, jump: false, jh: false, dive: false };
    if (!b.alive) return inp; const path = paths[p.lane];
    p.noiseT -= dt; if (p.noiseT <= 0) { p.noiseT = 0.3 + rnd() * 0.5; p.noise = (rnd() - 0.5) * (1 - sk) * 1.0; } p.jumpCd = Math.max(0, p.jumpCd - dt);
    let nd = path[Math.min(p.ni, path.length - 1)]; if (!nd) return inp;
    for (let guard = 0; guard < 3; guard++) {
      nd = path[Math.min(p.ni, path.length - 1)]; const q = posOf(nd); const d = Math.hypot(q.x - b.x, q.y - b.y); const ahead = dot(b.x - q.x, b.y - q.y, nd.f);
      const doorBlock = nd.k === "door" && !nd.doors.some((dd) => !dd.o.b.solid && Math.hypot(dd.x - b.x, dd.y - b.y) < 60);
      if (p.ni < path.length - 1 && !doorBlock && ((d < 62 && Math.abs(b.z - nd.z) < 40 && b.grounded) || (ahead > 30 && b.z > nd.z - 30 && b.grounded))) p.ni++; else break;
    }
    nd = path[Math.min(p.ni, path.length - 1)]; let q = posOf(nd); if (nd.mv) q = { x: nd.mv.x + nd.mv.vx * 0.5, y: nd.mv.y + nd.mv.vy * 0.5 };
    // portes, on vise une porte pas encore essayée, on change si elle résiste
    if (nd.k === "door") {
      const open = nd.doors.find((dd) => !dd.o.b.solid); let tgt = open || nd.doors[p.doorPick != null ? p.doorPick : (p.doorPick = Math.floor(rnd() * nd.doors.length))];
      const dd = Math.hypot(tgt.x - b.x, tgt.y - b.y); if (!open && dd < 50) { p.doorPush = (p.doorPush || 0) + dt; if (p.doorPush > 0.5) { p.doorTry[p.doorPick] = 1; const left = nd.doors.map((x, i) => i).filter((i) => !p.doorTry[i]); p.doorPick = left.length ? left[Math.floor(rnd() * left.length)] : Math.floor(rnd() * nd.doors.length); p.doorPush = 0; } }
      q = { x: tgt.x + nd.f[0] * 40, y: tgt.y + nd.f[1] * 40 };
    }
    let dx = q.x - b.x, dy = q.y - b.y; const dist = Math.hypot(dx, dy) || 1; dx /= dist; dy /= dist; const narrow = nd.k === "beam" && nd.ed == null; const ang = Math.atan2(dy, dx) + (narrow ? 0 : p.noise); dx = Math.cos(ang); dy = Math.sin(ang);
    const spd = narrow ? 0.62 : 0.78 + sk * 0.22; const reach = 175 + sk * 40;
    const latOff = dot(q.x - b.x, q.y - b.y, nd.r);
    if (b.grounded) {
      const look = 34 + Math.hypot(b.vx, b.vy) * 0.06; const gh = Plat.groundAt(world, b.x + dx * look, b.y + dy * look, b.z + 20, b.z - 45);
      const wall = Plat.groundAt(world, b.x + dx * 36, b.y + dy * 36, b.z + 150, b.z + 18);
      let jump = false, hold = false;
      if (wall != null && p.jumpCd <= 0 && nd.k !== "door") jump = true;
      if (gh == null && !narrow) {
        const tz = nd.z - b.z; const rx = Math.abs(latOff), edge = dot(q.x - b.x, q.y - b.y, nd.f) - (nd.ed != null ? nd.ed : (nd.d || 150) / 2);
        p.holdT = (p.holdT || 0) + dt;
        const aligned = !nd.mv || rx < nd.mv.w / 2 - 28 + sk * 12;
        if ((edge < 110 + sk * 50 && tz < 105 && aligned) || (p.holdT > 2.2 && !nd.mv) || p.holdT > 6) { if (p.jumpCd <= 0) { jump = true; p.holdT = 0; } } else hold = true;
      } else if (gh != null) p.holdT = 0;
      // obstacles juste devant, barres, rouleaux, pistons, marteaux
      obstacles.forEach((o) => { const ox = o.b.x - b.x, oy = o.b.y - b.y; const along = dot(ox, oy, o.f), side = dot(ox, oy, o.r); if (Math.abs(b.z - o.b.z) > 80) return;
        if (o.k === "bar" && along > 30 && along < 105 && p.jumpCd <= 0) jump = true;
        else if (o.k === "log") { const vrel = dot(o.b.vx, o.b.vy, o.f); if (along > 15 && along < 95 + (vrel < 0 ? 40 : 0) && p.jumpCd <= 0) jump = true; }
        else if (o.k === "piston" && along > 30 && along < 105 && p.jumpCd <= 0 && rnd() < 0.05 + sk * 0.04) jump = true;
        else if (o.k === "hammer" && along > 10 && along < 120 && Math.abs(side) < 110 && sk > 0.4) { const vs = dot(o.b.vx, o.b.vy, o.r); if (side * vs < 0 || Math.abs(side) < 60) hold = true; } });
      // dalles, on saute quand la couleur sous les pieds va disparaître
      const under = b.ground; if (under) { const to = tiles.find((x) => x.b === under); if (to && tileWarned(to) && p.jumpCd <= 0 && rnd() < 0.3 + sk * 0.6) jump = true; }
      if (jump && rnd() < (1 - sk) * 0.04) jump = false;
      inp.x = hold ? 0 : dx * spd; inp.y = hold ? 0 : dy * spd; inp.jump = jump; inp.jh = jump; if (jump) p.jumpCd = 0.35;
      if (hold) {
        // on s'aligne sur la cible sans quitter la plateforme sous ses pieds
        let c = U.clamp(latOff / 120, -0.6, 0.6); const gb = b.ground;
        if (gb) { const co = Math.cos(-gb.rot), si = Math.sin(-gb.rot); const dx2 = b.x - gb.x, dy2 = b.y - gb.y; const lx = dx2 * co - dy2 * si, ly = dx2 * si + dy2 * co; const mx = nd.r[0] * c, my = nd.r[1] * c; const mlx = mx * co - my * si, mly = mx * si + my * co;
          if ((Math.abs(lx) > gb.w / 2 - 34 && mlx * lx > 0) || (Math.abs(ly) > gb.d / 2 - 34 && mly * ly > 0)) c = 0; }
        inp.x = nd.r[0] * c; inp.y = nd.r[1] * c;
      }
      if (narrow && !hold) { const c = U.clamp(latOff / 25, -0.8, 0.8); inp.x = nd.r[0] * c + nd.f[0] * 0.75; inp.y = nd.r[1] * c + nd.f[1] * 0.75; }
    } else {
      inp.x = dx * spd; inp.y = dy * spd; inp.jh = (b.vz > 0 && b.z - (p.lastJumpZ || b.z) < 70 + sk * 20) || false;
      const needMore = b.vz < -80 && b.jumps === 1 && (nd.z > b.z - 30 || dist > 140) && Plat.groundAt(world, b.x, b.y, b.z + 4, b.z - 90) == null && sk > 0.3 && dist < reach + 80;
      if (needMore && p.jumpCd <= 0) { inp.jump = true; inp.jh = true; p.jumpCd = 0.3; }
    }
    // vent, on lutte contre
    for (const fn of fans) { const zn = fn.zn; if (!zn.off && Plat.over(zn, b.x, b.y, 0)) { const s = Math.hypot(zn.fx, zn.fy); inp.x -= (zn.fx / s) * (0.45 + sk * 0.35); inp.y -= (zn.fy / s) * (0.45 + sk * 0.35); } }
    if (b.grounded) p.lastJumpZ = b.z; else if (p.lastJumpZ == null) p.lastJumpZ = b.z;
    return inp;
  }

  // ---------- un humain envoie la position de son coureur ----------
  function acceptReport(p) {
    const b = p.bd; const r = p.rep; if (!r || r.sp !== p.sp) return false;
    const dtR = Math.max(0.03, (r.t - (p.lastRepT || r.t - 50)) / 1000); p.lastRepT = r.t;
    const jump = Math.hypot(r.x - b.x, r.y - b.y); if (jump > 60 + (maxV * 2.2 + cfg.diveV) * dtR || Math.abs(r.z - b.z) > 120 + 1200 * dtR) { if (process.env.PGDBG) console.log("refus", p.name, t.toFixed(1), p.predicting, Math.round(jump), Math.round(r.z - b.z), dtR.toFixed(2), "srv", Math.round(b.x), Math.round(b.y), Math.round(b.z), "rep", Math.round(r.x), Math.round(r.y), Math.round(r.z)); p.sp++; return false; }
    b.x = r.x; b.y = r.y; b.z = r.z; b.vx = r.vx; b.vy = r.vy; b.vz = r.vz; b.grounded = r.g; b.face = r.f; b.dive = r.dv; b.stun = r.st; b.kin = true;
    const g = boxUnder(b); b.ground = b.grounded ? g : null; b.gz = g ? g.z + g.h : b.z - 400; if (b.grounded && g && g.hurt) g.hurt(b);
    // une vraie porte cède quand on fonce dessus
    dyn.forEach((o) => { if (o.kind === "door" && o.real && o.b.solid && Math.abs(b.z - o.b.z) < 80) { if (Plat.overlap(o.b, b.x, b.y, b.r + 6)) o.b.hit(); } });
    return true;
  }
  function fallOut(p) { const b = p.bd; b.alive = false; p.falls++; p.respawn = 1.1; ctx.fx("splash", b.x, b.y, -280, "#bfe9ff"); ctx.snd("splash"); ctx.snd("scream"); }

  const inst = {
    done: false,
    onPos(pid, d) { const p = byId[pid]; if (!p) return; p.predicting = true; p.rep = { x: +d.x || 0, y: +d.y || 0, z: +d.z || 0, vx: +d.vx || 0, vy: +d.vy || 0, vz: +d.vz || 0, g: !!d.g, f: +d.f || 0, dv: +d.dv || 0, st: Math.max(0, Math.min(1, +d.st || 0)), sp: d.sp | 0, gr: !!d.gr, t: ctx.now() }; p.repFresh = true; },
    update(dt) {
      t += dt; world.step(dt);
      // plateformes qui tombent, portes, dalles et ventilateurs
      dyn.forEach((d) => {
        if (d.drop) { if (d.timer >= 0) { d.timer -= dt; if (d.timer < 0 && !d.fall) d.fall = 1; } if (d.fall && !d.gone) { d.fall += dt * 10; d.b.z -= 520 * dt * d.fall * 0.2; if (d.b.z < d.base - 40 && d.b.solid) d.b.solid = false; if (d.b.z < d.base - 600) { d.gone = true; d.regen = 2.4; d.goneT = 0; } } if (d.gone) { d.regen -= dt; d.goneT = (d.goneT || 0) + dt; if (d.regen <= 0 || d.goneT > 5) { d.gone = false; d.fall = 0; d.timer = -1; d.b.z = d.base; d.b.vz = 0; d.b.solid = true; } } }
        if (d.kind === "door" && d.openT > 0) { d.openT -= dt; if (d.openT <= 0) { d.openT = 0; d.b.solid = true; } }
        if (d.kind === "tile") { const ph = (t % (d.per * 2)) / d.per; const c = Math.floor(ph); const u = ph - c; d.warn = c === d.color && u > 0.45 && u < 0.72; d.b.solid = !(c === d.color && u >= 0.72); }
      });
      fans.forEach((fn) => { const zn = fn.zn; zn.off = ((t + zn.ph) % zn.per) > zn.on; });
      P.forEach((p) => {
        const b = p.bd; p.inv = Math.max(0, (p.inv || 0) - dt); p.squeak = Math.max(0, p.squeak - dt);
        if (p.finished) { if (ctx.isBot(p.id) || !p.rep) { b.vx *= 0.9; b.vy *= 0.9; Plat.step(world, b, { x: 0, y: 0 }, dt, cfg); } else acceptReport(p); return; }
        if (!b.alive) { p.respawn -= dt; if (p.respawn <= 0) spawn(p); return; }
        // l'agrippement ralentit celui qui est tenu
        p.held = Math.max(0, p.held - dt); b.slow = p.held > 0 ? 0.5 : p.grabbing ? 0.75 : 0;
        const bot = ctx.isBot(p.id);
        // un navigateur qui prédit son coureur garde la main, le serveur attend sa prochaine position au lieu de le faire courir
        // au départ, on laisse une seconde et demie au navigateur pour se manifester avant de faire courir le coureur à sa place
        if (!bot && !p.rep && (p.predicting || t < 1.5)) { b.kin = true; b.vx = b.vy = 0; return; }
        if (bot || !p.rep) {
          b.kin = false;
          const inp = bot ? botThink(p, dt) : (() => { const i = ctx.input(p.id); const e = ctx.edge(p.id); return { x: i.x, y: i.y, jump: e.a, jh: i.a, dive: e.b }; })();
          const ev = Plat.step(world, b, inp, dt, cfg);
          ev.forEach((e) => { if (e === "jump" || e === "dbl") { ctx.snd("jump"); ctx.fx("puff", b.x, b.y, b.z, ""); } else if (e === "land") ctx.fx("puff", b.x, b.y, b.z, ""); else if (e === "dive") ctx.snd("whoosh"); else if (e === "void") fallOut(p); else if (e === "bump") ctx.snd("bump"); else if (e === "stun" || e === "flop") { if (!p.squeak) { ctx.snd("squeak"); p.squeak = 0.6; } } });
          // les bots experts s'agrippent parfois au coureur devant eux
          if (bot && ctx.skill(p.id) > 0.8 && !p.grabbing && rnd() < dt * 0.15) { const tg = P.find((q) => q !== p && q.bd.alive && !q.finished && Math.hypot(q.bd.x - b.x, q.bd.y - b.y) < 44 && Math.abs(q.bd.z - b.z) < 30); if (tg) { p.grabbing = tg; p.grabT = 0.9; } }
        } else {
          if (p.repFresh) { p.repFresh = false; if (!acceptReport(p)) { /* position refusée, le navigateur sera recalé */ } }
          if (b.z < KILL + 5 && b.alive) fallOut(p);
          if (p.rep && p.rep.gr && !p.grabbing) { const tg = P.find((q) => q !== p && q.bd.alive && !q.finished && Math.hypot(q.bd.x - b.x, q.bd.y - b.y) < 46 && Math.abs(q.bd.z - b.z) < 30); if (tg) { p.grabbing = tg; p.grabT = 2; ctx.snd("grab"); } }
          if (p.rep && !p.rep.gr) p.grabbing = null;
        }
        if (p.grabbing) { p.grabT -= dt; const tg = p.grabbing; if (p.grabT <= 0 || !tg.bd.alive || Math.hypot(tg.bd.x - b.x, tg.bd.y - b.y) > 70) p.grabbing = null; else tg.held = 0.25; }
        if (!b.alive) return;
        // progression le long du parcours, drapeaux, arrivée
        const pr = project(b.x, b.y, p.seg); p.seg = pr.i; const prog = U.clamp(pr.s / finS, 0, 1);
        if (prog > p.prog + 0.004) { p.prog = prog; p.stuckT = 0; } else if (bot) { p.stuckT = (p.stuckT || 0) + dt; if (p.stuckT > 14 && b.grounded) { p.stuckT = 0; b.alive = false; p.respawn = 0.3; } }
        for (let i = p.cp + 1; i < cps.length; i++) { const c = cps[i]; if (b.grounded && Math.abs(b.z - c.z) < 30 && Math.hypot(b.x - c.x, b.y - c.y) < 190) { p.cp = i; ctx.fx("coin", c.x, c.y, c.z + 40, ""); ctx.snd("flag"); ctx.announce(p.name + " passe un drapeau", 1200); } }
        if (pr.s >= finS && b.grounded && Math.abs(b.z - finZ) < 40 && !p.finished) {
          p.finished = finishers.length + 1; p.finT = t; finishers.push(p); ctx.fx("confetti", b.x, b.y, b.z + 40, ""); ctx.snd(p.finished === 1 ? "win" : "coin");
          ctx.announce(p.name + (p.finished <= places ? " est qualifié, " + p.finished + (p.finished === 1 ? "er" : "e") : " arrive " + p.finished + "e"), 2600); if (!firstAt) firstAt = t;
        }
      });
      Plat.separate(P.filter((p) => p.bd.alive).map((p) => p.bd), { shove: 1.15 });
      if (!inst.done) {
        const left = P.filter((p) => !p.finished);
        if (!left.length || finishers.length >= places) inst.done = true; else if (firstAt && t - firstAt > 18 * ctx.len) inst.done = true; else if (t > 170 * ctx.len) inst.done = true;
      }
    },
    scene() {
      const items = stat.slice(); cps.forEach((c) => items.push(Object.assign({}, c.flag)));
      const ph = world.boxes.filter((b) => !b.move && !dyn.some((d) => d.b === b)).map((b) => { const a = [b.x, b.y, b.z, b.w, b.d, b.h, b.rot, b.e]; if (b.belt) a.push(b.belt[0], b.belt[1]); return a; });
      const zones = world.zones.map((z) => [z.x, z.y, z.w, z.d, z.rot, z.z0, z.z1, z.fx, z.fy]);
      return { w: 700, h: 1200, cam: { m: "follow", t: [0, -100, 0], yaw: -Math.PI / 2, d: 380, hg: 250, la: 120 }, env: { sky: ["#5ec8ff", "#e8f8ff"], fog: "#e8f8ff", fogN: 40, fogF: 140, ground: { c: "#2d9bd6", m: "water", z: -330 }, lt: { h: ["#ffffff", "#7a9cc0"], hi: 1, d: "#fff6dd", di: 0.9, dir: [-0.4, 1, 0.5] } }, items, pred: { ph, zones, cfg, kill: KILL } };
    },
    frame() {
      const items = []; const ph = [];
      dyn.forEach((d) => {
        if (d.vis) { // bandes du tapis roulant
          const s = ((t * d.vb) % d.len); const lf = d.len - ((d.lf0 + s) % d.len); const p = W(0, lf, d.fr); items.push({ t: "box", id: d.id, x: p.x, y: p.y, z: d.fr.z + 0.5, w: d.w * 0.9, d: 10, h: 1.5, rot: ROT(d.fr), c: "#ffd23f", ns: 1, sm: 40 }); return;
        }
        const b = d.b; if (d.gone) return;
        ph.push([d.id, b.x, b.y, b.z, b.w, b.d, b.h, b.rot, b.vx, b.vy, b.vz, b.omega, b.solid ? 1 : 0, b.stun || 0]);
        if (d.kind === "log") { items.push({ t: "log", id: d.id, x: b.x, y: b.y, z: b.z, w: b.w, d: b.d, rot: b.rot, c: d.c, sm: 40 }); return; }
        if (d.kind === "door") { const o = d.openT > 0; items.push({ t: "box", id: d.id, x: b.x, y: b.y, z: b.z, w: b.w, d: b.d, h: o ? 4 : b.h, rot: b.rot, c: d.c, sm: 30, lab: o ? "" : "?", lc: "rgba(255,255,255,0.85)" }); return; }
        if (d.kind === "tile") { items.push({ t: "box", id: d.id, x: b.x, y: b.y, z: b.z + b.h - 8, w: b.w, d: b.d, h: 8, rot: b.rot, c: !b.solid ? "#1b2a40" : d.warn && Math.floor(t * 8) % 2 ? "#ffffff" : d.c, a: b.solid ? 1 : 0.25, sm: 60 }); return; }
        if (d.kind === "hammer") { items.push({ t: "beam", id: d.id + "r", x: d.pivot[0], y: d.pivot[1], z: d.pivot[2], x2: b.x, y2: b.y, z2: b.z + b.h / 2, w: 8, c: "#5b5f6b", a: 1 }); }
        items.push({ t: "box", id: d.id, x: b.x, y: b.y, z: b.z, w: b.w, d: b.d, h: d.cap ? b.h - 7 : b.h, rot: b.rot, c: d.drop && (d.timer >= 0 || d.fall) ? "#e8704a" : d.c, sm: 40 }); if (d.cap) items.push({ t: "box", id: d.id + "c", x: b.x, y: b.y, z: b.z + b.h - 7, w: b.w + 2, d: b.d + 2, h: 7, c: d.cap, ns: 1, rot: b.rot, sm: 40 });
      });
      fans.forEach((fn, i) => { if (fn.zn.off) return; for (let k = 0; k < 3; k++) { const lf = fn.lf - 40 + k * 40; const a = W(fn.side * 120, lf, fn.fr), b2 = W(fn.side * (40 - ((t * 260 + k * 50) % 160)), lf, fn.fr); items.push({ t: "beam", id: "w" + i + "_" + k, x: a.x, y: a.y, z: fn.fr.z + 40 + k * 18, x2: b2.x, y2: b2.y, z2: fn.fr.z + 40 + k * 18, w: 3, c: "#ffffff", a: 0.55 }); } });
      cps.forEach((c, i) => items.push({ t: "flag", id: "f" + i, x: c.flag.x, y: c.flag.y, z: c.flag.z, c: "#ff4d6d", on: P.some((p) => p.cp >= i) ? 1 : 0 }));
      P.forEach((p) => { const b = p.bd; if (!b.alive) return; const it = Plat.pawnItem(b, p, { badge: p.finished === 1 ? "🏆" : p.finished && p.finished <= places ? "✅" : p.finished ? "🏁" : p.held > 0 ? "✊" : "", st: p.finished === 1 ? "win" : "", ghost: p.inv > 0 ? 1 : 0, sc: 1 }); if (b.stun > 0) { it.tilt = 1.3; it.roll = Math.sin(t * 18) * 0.4; } items.push(it); });
      const prog = P.map((p) => ({ id: p.id, k: p.k, n: p.name, p: p.finished ? 1 : p.prog, out: !p.bd.alive }));
      const left = Math.max(0, places - finishers.length);
      return { w: 700, h: 1200, items, ph, zo: fans.map((fn) => (fn.zn.off ? 0 : 1)), hud: { title: firstAt ? "Dépêche toi, les places partent" : "Cours jusqu'à la ligne d'arrivée", prog, chips: [{ text: places < n ? "🎟️ " + left + " place" + (left > 1 ? "s" : "") + " qualificative" + (left > 1 ? "s" : "") + " sur " + places : finishers.length + " arrivé" + (finishers.length > 1 ? "s" : "") + " sur " + n }], timer: firstAt ? Math.max(0, 18 * ctx.len - (t - firstAt)) : null } };
    },
    priv(pid) {
      const p = byId[pid]; if (!p) return null; const b = p.bd; const pr = project(b.x, b.y, p.seg);
      const tgtZ = Math.max(b.z, p.finished ? finZ : (b.alive ? b.z : (p.cp >= 0 ? cps[p.cp].z : 0)));
      return { cam: { m: "follow", rel: 1, t: [b.x, b.y, tgtZ], yaw: pr.a == null ? -Math.PI / 2 : pr.a, d: 340, hg: 220, la: 130 }, me: { sp: p.sp, x: b.x, y: b.y, z: b.z, a: p.cp >= 0 ? cps[p.cp].a : -Math.PI / 2, alive: b.alive ? 1 : 0, slow: b.slow || 0, fin: p.finished ? 1 : 0, grab: p.grabbing ? 1 : 0 }, bars: null };
    },
    ranking() {
      const fin = finishers.slice(); const rest = P.filter((p) => !p.finished).sort((a, b) => b.prog - a.prog || a.falls - b.falls);
      const groups = fin.map((p) => [p.id]).concat(rest.map((p) => [p.id])); const bonus = {}, notes = {};
      fin.forEach((p) => { notes[p.id] = (p.finished <= places ? "Qualifié, " : "") + fmt(p.finT) + (p.falls ? ", " + p.falls + " chute" + (p.falls > 1 ? "s" : "") : ", sans chute"); if (!p.falls) bonus[p.id] = 3; });
      rest.forEach((p) => { notes[p.id] = "Éliminé à " + Math.round(p.prog * 100) + " % du parcours"; });
      return { groups, bonus, notes, headline: fin[0] ? "🏁 " + fin[0].name + " gagne la course" : "Personne n'a passé la ligne" };
    },
  };
  const fmt = (s) => { const m = Math.floor(s / 60); return m ? m + " min " + Math.round(s % 60) + " s" : Math.round(s) + " s"; };
  if (process.env.PGDBG) inst.debug = { paths, cps, segs, finS, world, P, line };
  return inst;
};

// Course des fous. Un parcours d'obstacles en 3D, plateformes mobiles, balanciers, pistons, marches et plateformes qui s'effondrent.
// Le serveur simule chaque coureur avec une vraie physique de saut. Le parcours est le même pour tous et change à chaque manche.
const U = require("../pg-util.js");
const Plat = require("../pg-plat.js");

exports.create = function (ctx) {
  const rnd = ctx.rnd; const n = ctx.n; const diff = { facile: 0, normal: 1, dur: 2 }[ctx.opts.raceDiff] != null ? { facile: 0, normal: 1, dur: 2 }[ctx.opts.raceDiff] : 1;
  const world = new Plat.World(); const stat = []; const dynBoxes = []; const nodes = []; const cps = []; const obstacles = [];
  const R = (a, b) => a + rnd() * (b - a);
  const cols = ["#7ed957", "#5fd0a5", "#ffc857", "#ff9f68", "#8fb8ff", "#c79bff"];
  let cy = 0, cx = 0, cz = 0; // bord avant du parcours, qui avance vers les y négatifs
  const H = 70;
  let lastD = 200;
  function plat(x, yc, top, w, d, opt) {
    opt = opt || {}; lastD = d; const b = world.add({ x, y: yc, z: top - H, w, d, h: H, rot: opt.rot || 0, e: 0.15 }); const c = opt.c || cols[Math.floor(rnd() * cols.length)];
    stat.push({ t: "box", x, y: yc, z: top - H, w, d, h: H - 7, c: "#6b7a99" }); stat.push({ t: "box", x, y: yc, z: top - 7, w: w + 2, d: d + 2, h: 7, c, ns: 1 });
    return b;
  }
  function node(x, y, z, extra) { const nd = Object.assign({ x, y, z, d: lastD }, extra || {}); nodes.push(nd); return nd; }
  function rest(len, flag, banner) {
    const w = 300, d = len; const yc = cy - d / 2; plat(cx, yc, cz, w, d, { c: banner ? "#ffe066" : "#9be37a" });
    node(cx, yc, cz, { k: "rest" }); if (flag) { const idx = cps.length; cps.push({ x: cx, y: yc, z: cz, ni: nodes.length - 1, flag: { t: "flag", id: "f" + idx, x: cx + w / 2 - 30, y: yc, z: cz, c: "#ff4d6d" } }); }
    cy -= d; return yc;
  }
  // gaps. Des plateformes séparées par des trous
  function gaps(cnt) {
    for (let i = 0; i < cnt; i++) {
      const gap = R(75, 105) + diff * 18 + i * 3, d = R(150, 210) - diff * 20, w = R(200, 260) - diff * 35; const dx = U.clamp(R(-90, 90) - diff * 0, -140, 140);
      const nz = U.clamp(cz + R(-40, 36), -80, 140); const yc = cy - gap - d / 2; const nx = U.clamp(cx + dx, -180, 180);
      plat(nx, yc, nz, w, d); node(nx, yc, nz, { k: "gap" }); cy = yc - d / 2; cx = nx; cz = nz;
    }
  }
  // plateformes qui glissent d'un côté à l'autre
  function movers(cnt) {
    for (let i = 0; i < cnt; i++) {
      const gap = R(95, 115) + diff * 12, d = 170, w = 170 - diff * 18, A = R(130, 190), T = (R(3.2, 4.4) - diff * 0.5) / Math.max(0.7, ctx.speed), ph = rnd() * 6.28; const yc = cy - gap - d / 2; const id = "m" + dynBoxes.length;
      const b = world.add({ x: cx, y: yc, z: cz - H, w, d, h: H, e: 0.1, move: (t) => ({ x: cx0 + Math.sin(t * 6.283 / T + ph) * A }) }); const cx0 = 0; b.move = (t) => ({ x: Math.sin(t * 6.283 / T + ph) * A });
      dynBoxes.push({ b, id, c: "#ff9f43", cap: "#ffd18a" }); node(0, yc, cz, { k: "mover", mv: b, d: d }); cy = yc - d / 2; cx = 0;
    }
  }
  // un pont avec une barre qui tourne au milieu
  function sweeper() {
    const len = 680, w = 230; const yc = cy - len / 2; plat(0, yc, cz, w, len, { c: "#8ec5ff" }); node(0, yc + len / 2 - 60, cz, { k: "bridge" });
    const om = (1.5 + diff * 0.55) * (i0() ? 1 : -1) * Math.min(1.25, ctx.speed); const bar = world.add({ x: 0, y: yc, z: cz, w: 340, d: 24, h: 48, e: 0.8, move: (t) => ({ rot: t * om }) });
    dynBoxes.push({ b: bar, id: "bar" + dynBoxes.length, c: "#ff4d6d", rot: true }); obstacles.push({ y: yc, h: 48, k: "bar" });
    // un deuxième balancier plus loin quand c'est costaud
    if (diff >= 2) { const y2 = yc - 240; const bar2 = world.add({ x: 0, y: y2, z: cz, w: 300, d: 24, h: 48, e: 0.8, move: (t) => ({ rot: -t * om * 1.1 + 1 }) }); dynBoxes.push({ b: bar2, id: "bar" + dynBoxes.length, c: "#ff9f43", rot: true }); obstacles.push({ y: y2, h: 48, k: "bar" }); }
    node(0, yc - len / 2 + 60, cz, { k: "bridge" }); cy -= len; cx = 0;
  }
  const i0 = () => rnd() < 0.5;
  // plateforme large avec des pistons qui poussent sur le côté
  function pistons() {
    const len = 560, w = 300; const yc = cy - len / 2; plat(0, yc, cz, w, len, { c: "#ffd37a" }); node(0, yc + len / 2 - 40, cz, { k: "piston" });
    const cnt = 2 + diff; for (let i = 0; i < cnt; i++) {
      const py = yc + len / 2 - 130 - i * (len - 200) / Math.max(1, cnt - 1) * 0.97; const T = (2.6 - diff * 0.3) / Math.max(0.7, ctx.speed), ph = rnd() * 6.28, dir = i % 2 ? 1 : -1;
      const pb = world.add({ x: 0, y: py, z: cz, w: 120, d: 44, h: 82, e: 0.7, move: (t) => ({ x: dir * Math.sin(t * 6.283 / T + ph) * 150 }) }); dynBoxes.push({ b: pb, id: "p" + dynBoxes.length, c: "#d94f70" }); obstacles.push({ y: py, h: 82, k: "piston" });
    }
    node(0, yc - len / 2 + 40, cz, { k: "piston" }); cy -= len; cx = 0;
  }
  // marches qui montent puis redescendent
  function stairs() {
    const steps = 4 + diff; let top = cz;
    for (let i = 0; i < steps; i++) { top += 34; const yc = cy - 55; plat(cx, yc, top, 250, 110, { c: "#f0a6ff" }); node(cx, yc, top, { k: "stair" }); cy -= 110; }
    const yc = cy - 90; plat(cx, yc, top, 250, 180, { c: "#f0a6ff" }); node(cx, yc, top, { k: "stair" }); cy -= 180;
    // descente d'un coup, puis plateforme basse
    const low = Math.max(-60, top - 130); const yc2 = cy - 100 - 70; plat(cx, yc2, low, 260, 140, { c: "#9be37a" }); node(cx, yc2, low, { k: "gap" }); cy -= 240; cz = low;
  }
  // poutre étroite
  function beam() {
    const len = 420 + diff * 60, w = 74 - diff * 8; const yc = cy - 90 - len / 2; plat(cx, yc, cz, w, len, { c: "#ffb4a2" }); node(cx, yc + len / 2 - 20, cz, { k: "beam", ed: 20 }); node(cx, yc - len / 2 + 20, cz, { k: "beam" }); cy = yc - len / 2;
  }
  // plateformes qui s'effondrent peu après le premier contact
  function fallers(cnt) {
    for (let i = 0; i < cnt; i++) {
      const gap = R(70, 95) + diff * 10, d = 150, w = 180 - diff * 20; const nx = U.clamp(cx + R(-110, 110), -170, 170); const yc = cy - gap - d / 2; const id = "z" + dynBoxes.length;
      const b = world.add({ x: nx, y: yc, z: cz - H, w, d, h: H, e: 0.1 }); const st = { b, id, c: "#c9a27a", timer: -1, fall: 0, base: cz - H, drop: true };
      b.hurt = () => { if (st.timer < 0) st.timer = 0.55 / Math.max(0.8, ctx.speed); }; dynBoxes.push(st); node(nx, yc, cz, { k: "gap" }); cy = yc - d / 2; cx = nx;
    }
  }
  // assemblage du parcours
  const mid = U.shuffle(["gaps", "movers", "sweeper", "pistons", "stairs", "beam", "fallers"], rnd);
  const count = 5 + diff;
  const startPlat = (() => { const yc = 0 - 130; plat(0, yc, 0, 380, 260, { c: "#ffe066" }); node(0, yc, 0, { k: "rest" }); cy = -260; return yc; })();
  let order = ["gaps"].concat(mid.filter((m) => m !== "gaps")); order = order.slice(0, count - 1); order.push("gaps");
  order.forEach((m, i) => {
    if (process.env.PGDBG) console.log("section", m, Math.round(cy), Math.round(cz));
    if (m === "gaps") gaps(3 + diff + (i === 0 ? 1 : 0)); else if (m === "movers") movers(2 + (diff > 0 ? 1 : 0)); else if (m === "sweeper") sweeper(); else if (m === "pistons") pistons(); else if (m === "stairs") stairs(); else if (m === "beam") beam(); else if (m === "fallers") fallers(3 + diff);
    cy -= 40; if (i < order.length - 1) { cy += 40; rest(150, i % 2 === 1 || i === 1); }
  });
  cy -= 10; const finishY = cy - 120;
  const finalYc = rest(300, false, true); const FINISH = finalYc + 60;
  const finishLineY = FINISH;
  stat.push({ t: "box", x: 0, y: finishLineY, z: cz, w: 300, d: 14, h: 3, c: "#ffffff", ns: 1 }); stat.push({ t: "deco", kind: "banner", x: 0, y: finishLineY, z: cz, s: 1.5, c: "#ff4d6d" });
  const startY = -60; const total = startY - finishLineY;
  // décor
  for (let i = 0; i < 16; i++) { const y = -300 - i * (-cy / 14); const side = i % 2 ? 1 : -1; stat.push({ t: "deco", kind: i % 3 ? "tree" : "rock", x: side * (330 + R(0, 160)), y, z: -90 - R(0, 40), s: R(2.4, 4) }); }
  for (let i = 0; i < 6; i++) stat.push({ t: "deco", kind: "cloud", x: R(-700, 700), y: -i * (-cy / 5) - 100, z: 420 + R(0, 180), s: 3 });

  // les coureurs
  const P = ctx.players.map((m, i) => {
    const a = (i % 4 - 1.5) * 70, b2 = Math.floor(i / 4) * 80;
    const bd = Plat.body(a, -70 - b2 * 0.6, 0, {}); return { id: m.id, k: m.color, name: m.name, bd, cp: -1, ni: 1, falls: 0, prog: 0, finished: 0, finT: 0, respawn: 0, wait: 0, noise: 0, noiseT: 0, jumpCd: 0, rx: a };
  });
  const finishers = []; let t = 0; let firstAt = 0; const maxV = 305 * ctx.speed * (ctx.heavy ? 0.85 : 1);
  const cfg = { maxV, accG: ctx.heavy ? 1200 : 2600, accA: 1400, diveV: 480 * Math.min(1.2, ctx.speed), friction: 1 };
  function spawn(p) {
    const cp = p.cp >= 0 ? cps[p.cp] : { x: 0, y: -130, z: 0, ni: 0 }; const b = p.bd; const k = P.indexOf(p);
    b.x = cp.x + ((k % 4) - 1.5) * 50; b.y = cp.y + (cp.y > -200 ? 0 : 0) + Math.floor(k / 4) * 40 - 20; b.z = cp.z + 4; b.vx = b.vy = b.vz = 0; b.alive = true; b.stun = 0; b.grounded = false; p.ni = cp.ni + 1; p.respawn = 0; p.inv = 1.2;
  }
  P.forEach((p) => { p.bd.y = -90 + Math.floor(P.indexOf(p) / 4) * 50; p.bd.x = ((P.indexOf(p) % 4) - 1.5) * 60; p.bd.z = 4; });
  const posOf = (nd) => (nd.mv ? { x: nd.mv.x, y: nd.mv.y } : { x: nd.x, y: nd.y });
  // intelligence des bots
  function botThink(p, dt) {
    const b = p.bd; const sk = ctx.skill(p.id); const inp = { x: 0, y: 0, jump: false, jh: false, dive: false };
    if (!b.alive) return inp; p.noiseT -= dt; if (p.noiseT <= 0) { p.noiseT = 0.3 + rnd() * 0.5; p.noise = (rnd() - 0.5) * (1 - sk) * 1.0; } p.jumpCd = Math.max(0, p.jumpCd - dt);
    let nd = nodes[Math.min(p.ni, nodes.length - 1)]; if (!nd) return inp;
    // passe au nœud suivant quand on y est ou qu'on l'a dépassé
    for (let guard = 0; guard < 3; guard++) { nd = nodes[Math.min(p.ni, nodes.length - 1)]; const q = posOf(nd); const d = Math.hypot(q.x - b.x, q.y - b.y); if (p.ni < nodes.length - 1 && ((d < 62 && Math.abs(b.z - nd.z) < 40 && b.grounded) || b.y < q.y - 30 && b.z > nd.z - 30 && b.grounded)) p.ni++; else break; }
    nd = nodes[Math.min(p.ni, nodes.length - 1)]; let q = posOf(nd); if (nd.mv) { const lead = 0.5; q = { x: nd.mv.x + nd.mv.vx * lead, y: nd.mv.y }; }
    // vise le centre du nœud avec un peu d'erreur selon le niveau
    let dx = q.x - b.x, dy = q.y - b.y; const dist = Math.hypot(dx, dy) || 1; dx /= dist; dy /= dist; const narrow = nd.k === 'beam' && nd.ed == null; const ang = Math.atan2(dy, dx) + (narrow ? 0 : p.noise); dx = Math.cos(ang); dy = Math.sin(ang);
    const spd = narrow ? 0.62 : 0.78 + sk * 0.22; const reach = 175 + sk * 40;
    if (b.grounded) {
      const look = 34 + Math.hypot(b.vx, b.vy) * 0.06; const ax = b.x + dx * look, ay = b.y + dy * look; const gh = Plat.groundAt(world, ax, ay, b.z + 20, b.z - 45);
      // mur ou marche devant
      const wall = Plat.groundAt(world, b.x + dx * 36, b.y + dy * 36, b.z + 150, b.z + 18);
      let jump = false;
      if (wall != null && p.jumpCd <= 0) jump = true;
      let hold = false;
      if (gh == null && !(nd.k === "beam" && nd.ed == null)) {
        // bord du vide. saute si la cible est à portée, sinon attend
        const tz = nd.z - b.z; const rx = Math.abs(q.x - b.x), edge = b.y - (q.y + (nd.ed != null ? nd.ed : (nd.d || 150) / 2));
        p.holdT = (p.holdT || 0) + dt;
        if ((edge < 110 + sk * 50 && tz < 105 && (!nd.mv || rx < 95 + sk * 30)) || p.holdT > 2.2) { if (p.jumpCd <= 0) { jump = true; p.holdT = 0; } } else hold = true;
      } else if (gh != null) { p.holdT = 0; } else if (gh == null && nd.k === "beam") { /* sur la poutre, on avance droit */ }
      // obstacles à enjamber, barres et pistons juste devant
      obstacles.forEach((o) => { const dyo = b.y - o.y; if (dyo > 30 && dyo < 105 && b.z >= nd.z - 10 && Math.abs(b.x) < 260 && p.jumpCd <= 0 && b.y > q.y) { if (o.k === "bar" || rnd() < 0.05 + sk * 0.04) jump = true; } });
      if (jump && rnd() < (1 - sk) * 0.04) { jump = false; } // raté
      inp.x = hold ? 0 : dx * spd; inp.y = hold ? 0 : dy * spd; inp.jump = jump; inp.jh = jump; if (jump) p.jumpCd = 0.35;
      if (hold) { inp.x = U.clamp((q.x - b.x) / 120, -0.6, 0.6); }
      if (narrow && !hold) { inp.x = U.clamp((q.x - b.x) / 25, -0.8, 0.8); inp.y = -0.75; }
    } else {
      // en l'air, garde le cap et utilise le double saut si besoin
      inp.x = dx * spd; inp.y = dy * spd; inp.jh = b.vz > 0 && b.z - p.lastJumpZ < 70 + sk * 20 || false;
      const needMore = b.vz < -80 && b.jumps === 1 && (nd.z > b.z - 30 || dist > 140) && Plat.groundAt(world, b.x, b.y, b.z + 4, b.z - 90) == null && sk > 0.3 && dist < reach + 80;
      if (needMore && p.jumpCd <= 0) { inp.jump = true; inp.jh = true; p.jumpCd = 0.3; }
    }
    if (b.grounded) p.lastJumpZ = b.z; else if (p.lastJumpZ == null) p.lastJumpZ = b.z;
    return inp;
  }

  const inst = {
    done: false,
    update(dt) {
      t += dt; world.step(dt);
      dynBoxes.forEach((d) => { if (d.drop) { if (d.timer >= 0) { d.timer -= dt; if (d.timer < 0 && !d.fall) d.fall = 1; } if (d.fall) { d.fall += dt * 10; d.b.vz = 0; d.b.z -= 520 * dt * d.fall * 0.2 - 0; if (d.b.z < d.base - 40 && d.b.solid) d.b.solid = false; if (d.b.z < d.base - 600) d.gone = true; } } });
      P.forEach((p) => {
        const b = p.bd; p.inv = Math.max(0, (p.inv || 0) - dt);
        if (p.finished) { b.vx *= 0.9; b.vy *= 0.9; const e = Plat.step(world, b, { x: 0, y: 0 }, dt, cfg); return; }
        if (!b.alive) { p.respawn -= dt; if (p.respawn <= 0) spawn(p); return; }
        let inp; if (ctx.isBot(p.id)) inp = botThink(p, dt); else { const i = ctx.input(p.id); const e = ctx.edge(p.id); inp = { x: i.x, y: i.y, jump: e.a, jh: i.a, dive: e.b }; }
        const ev = Plat.step(world, b, inp, dt, cfg);
        ev.forEach((e) => { if (e === "jump" || e === "dbl") { ctx.snd("jump"); ctx.fx("puff", b.x, b.y, b.z, ""); } else if (e === "land") { ctx.fx("puff", b.x, b.y, b.z, ""); } else if (e === "dive") ctx.snd("whoosh"); else if (e === "void") { if (process.env.PGDBG) console.log("VOID", p.name, Math.round(b.x), Math.round(b.y), Math.round(b.z), "ni", p.ni, nodes[p.ni] && nodes[p.ni].k, nodes[p.ni] && Math.round(nodes[p.ni].y)); b.alive = false; p.falls++; p.respawn = 1.1; ctx.fx("splash", b.x, b.y, -280, "#bfe9ff"); ctx.snd("splash"); } else if (e === "bump") ctx.snd("bump"); });
        // progression et drapeaux
        const pr = U.clamp((startY - b.y) / total, 0, 1); if (pr > p.prog) p.prog = pr;
        for (let i = p.cp + 1; i < cps.length; i++) { if (b.y < cps[i].y + 40 && b.grounded && Math.abs(b.z - cps[i].z) < 30) { p.cp = i; ctx.fx("coin", cps[i].x, cps[i].y, cps[i].z + 40, ""); ctx.snd("flag"); if (ctx.n <= 4 || true) ctx.announce(p.name + " passe un drapeau", 1200); } }
        // arrivée
        if (b.y < finishLineY && b.grounded && b.z > cz - 40 && !p.finished) { p.finished = finishers.length + 1; p.finT = t; finishers.push(p); ctx.fx("confetti", b.x, b.y, b.z + 40, ""); ctx.snd(p.finished === 1 ? "win" : "coin"); ctx.announce(p.name + " franchit la ligne en " + (p.finished === 1 ? "premier" : p.finished + "e position"), 2600); if (!firstAt) firstAt = t; }
      });
      Plat.separate(P.filter((p) => p.bd.alive).map((p) => p.bd), { shove: 1.1 });
      if (!inst.done) {
        const left = P.filter((p) => !p.finished);
        if (!left.length) inst.done = true; else if (firstAt && t - firstAt > 14 * ctx.len) inst.done = true; else if (t > 150 * ctx.len) inst.done = true;
      }
    },
    scene() {
      const items = stat.slice(); cps.forEach((c) => items.push(Object.assign({}, c.flag)));
      return { w: 700, h: Math.max(1200, -cy), cam: { m: "follow", t: [0, -100, 0], yaw: -Math.PI / 2, d: 380, hg: 250, la: 120 }, env: { sky: ["#5ec8ff", "#e8f8ff"], fog: "#e8f8ff", fogN: 40, fogF: 130, ground: { c: "#2d9bd6", m: "water", z: -330 }, lt: { h: ["#ffffff", "#7a9cc0"], hi: 1, d: "#fff6dd", di: 0.9, dir: [-0.4, 1, 0.5] } }, items };
    },
    frame() {
      const items = [];
      dynBoxes.forEach((d) => { if (d.gone) return; const b = d.b; items.push({ t: "box", id: d.id, x: b.x, y: b.y, z: b.z, w: b.w, d: b.d, h: d.cap ? b.h - 7 : b.h, rot: b.rot, c: d.c, sm: 40 }); if (d.cap) items.push({ t: "box", id: d.id + "c", x: b.x, y: b.y, z: b.z + b.h - 7, w: b.w + 2, d: b.d + 2, h: 7, c: d.cap, ns: 1, rot: b.rot, sm: 40 }); });
      cps.forEach((c, i) => items.push({ t: "flag", id: "f" + i, x: c.flag.x, y: c.flag.y, z: c.flag.z, c: "#ff4d6d", on: P.some((p) => p.cp >= i) ? 1 : 0 }));
      P.forEach((p) => { const b = p.bd; if (!b.alive) return; items.push(Plat.pawnItem(b, p, { badge: p.finished === 1 ? "🏆" : p.finished ? "🏁" : "", st: p.finished === 1 ? "win" : "", ghost: p.inv > 0 ? 1 : 0, sc: 1 })); });
      const prog = P.map((p) => ({ id: p.id, k: p.k, n: p.name, p: p.finished ? 1 : p.prog, out: !p.bd.alive }));
      const lead = P.slice().sort((a, b) => (b.finished ? 2 - b.finished * 0.001 : b.prog) - (a.finished ? 2 - a.finished * 0.001 : a.prog))[0];
      return { w: 700, h: 1200, items, hud: { title: firstAt ? "Dépêche toi, la course se termine bientôt" : "Cours jusqu'à la ligne d'arrivée", prog, chips: [{ text: finishers.length + " arrivé" + (finishers.length > 1 ? "s" : "") + " sur " + n }], timer: firstAt ? Math.max(0, 14 * ctx.len - (t - firstAt)) : null } };
    },
    priv(pid) {
      const p = P.find((x) => x.id === pid); if (!p) return null; const b = p.bd; const mine = { m: "follow", t: [b.x * 0.55, b.y, Math.max(b.z, p.finished ? 0 : (b.alive ? b.z : (p.cp >= 0 ? cps[p.cp].z : 0)))], yaw: -Math.PI / 2, d: 340, hg: 220, la: 130 };
      return { cam: mine, bars: null };
    },
    ranking() {
      const fin = finishers.slice(); const rest = P.filter((p) => !p.finished).sort((a, b) => b.prog - a.prog || a.falls - b.falls);
      const groups = fin.map((p) => [p.id]).concat(rest.map((p) => [p.id])); const bonus = {}, notes = {};
      fin.forEach((p) => { notes[p.id] = fmt(p.finT) + (p.falls ? ", " + p.falls + " chute" + (p.falls > 1 ? "s" : "") : ", sans chute"); if (!p.falls) bonus[p.id] = 3; });
      rest.forEach((p) => { notes[p.id] = Math.round(p.prog * 100) + " % du parcours"; });
      return { groups, bonus, notes, headline: fin[0] ? "🏁 " + fin[0].name + " gagne la course" : "Personne n'a passé la ligne" };
    },
  };
  const fmt = (s) => { const m = Math.floor(s / 60); return m ? m + " min " + Math.round(s % 60) + " s" : Math.round(s) + " s"; };
  return inst;
};

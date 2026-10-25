// Bombe en voiture. Des voitures qui dérapent sur une arène qui s'effrite, une bombe qui passe de main en main.
// Le serveur simule tout. Le client affiche une vraie scène 3D avec des voitures, des explosions et de la lave en dessous.
const U = require("../pg-util.js");

const TILE = 100, COLS = 10, ROWS = 7, W = COLS * TILE, H = ROWS * TILE;
const CR = 30;                 // rayon d'une voiture pour les chocs
const GROUND = -150;

exports.create = function (ctx) {
  const rnd = ctx.rnd; const n = ctx.n;
  const fuseBase = { court: 6.5, normal: 10, long: 14 }[ctx.opts.tntFuse] || 10;
  const fuse = fuseBase * (n <= 3 ? 1.2 : 1) / Math.sqrt(ctx.speed);
  // zone de jeu, en cases. Elle rétrécit à chaque élimination
  let c0 = 0, c1 = COLS - 1, r0 = 0, r1 = ROWS - 1;
  const gone = {}; const fallingTiles = [];
  const killed = [];
  // obstacles au centre, ils ne tombent jamais car le centre reste jusqu'au bout
  const obst = [];
  const spots = U.shuffle([[3, 2], [4, 2], [5, 2], [6, 2], [3, 3], [4, 3], [5, 3], [6, 3], [3, 4], [4, 4], [5, 4], [6, 4]], rnd);
  const nObs = 3 + Math.floor(n / 3);
  for (let i = 0; i < nObs; i++) {
    const [cx, cy] = spots[i]; const kind = i % 3;
    const ox = cx * TILE + TILE / 2 + (rnd() - 0.5) * 36, oy = cy * TILE + TILE / 2 + (rnd() - 0.5) * 36;
    if (kind === 0) obst.push({ k: "barrel", x: ox, y: oy, r: 26, h: 52, c: i % 2 ? "#e0453a" : "#f2c230" });
    else if (kind === 1) obst.push({ k: "block", x: ox, y: oy, w: 64, d: 64, h: 54, r: 34, c: "#8a93a6" });
    else obst.push({ k: "barrel", x: ox, y: oy, r: 24, h: 46, c: "#3aa0e0" });
  }
  const pads = [];
  for (let i = nObs; i < nObs + 2 && i < spots.length; i++) pads.push({ x: spots[i][0] * TILE + TILE / 2, y: spots[i][1] * TILE + TILE / 2, r: 38 });

  const C = ctx.players.map((m, i) => {
    const a = (i / n) * Math.PI * 2 - Math.PI / 2; const rx = W / 2 - 150, ry = H / 2 - 120;
    return { id: m.id, k: m.color, name: m.name, x: W / 2 + Math.cos(a) * rx, y: H / 2 + Math.sin(a) * ry, ang: a + Math.PI, vx: 0, vy: 0, z: 0, vz: 0, alive: true, bomb: 0, imm: 0, gauge: 100, boosting: false, padCd: 0, passes: 0, slip: 0, fall: false, dead: 0, explode: false, gone: false, noise: 0, noiseT: 0 };
  });
  const falls = []; let t = 0; let bombCount = n >= 7 ? 2 : 1; let lastDeadT = -9;
  const alive = () => C.filter((c) => c.alive);
  const mkBombs = () => {
    const A = alive(); const have = A.filter((c) => c.bomb).length; const need = Math.min(bombCount, A.length - 1) - have;
    U.shuffle(A.filter((c) => !c.bomb), rnd).slice(0, Math.max(0, need)).forEach((c) => { c.bomb = fuse; c.imm = 0; ctx.announce(c.name + " porte la bombe", 1800); ctx.snd("siren"); });
  };
  mkBombs();
  const heavy = ctx.heavy ? 0.7 : 1;
  const ACC = 620 * ctx.speed * heavy, MAXV = 400 * ctx.speed, BOOST = 1.55, TURN = 3.1;

  const tileAt = (x, y) => { const c = Math.floor(x / TILE), r = Math.floor(y / TILE); if (c < c0 || c > c1 || r < r0 || r > r1) return null; return r * COLS + c; };
  function shrink() {
    // la plus longue dimension perd une ligne, côté pris au hasard
    const cw = c1 - c0 + 1, rh = r1 - r0 + 1; if (cw <= 5 && rh <= 4) return;
    let side; if (cw - 5 >= rh - 4) side = rnd() < 0.5 ? "l" : "r"; else side = rnd() < 0.5 ? "t" : "b";
    const tiles = [];
    if (side === "l") { for (let r = r0; r <= r1; r++) tiles.push(r * COLS + c0); c0++; } else if (side === "r") { for (let r = r0; r <= r1; r++) tiles.push(r * COLS + c1); c1--; }
    else if (side === "t") { for (let c = c0; c <= c1; c++) tiles.push(r0 * COLS + c); r0++; } else { for (let c = c0; c <= c1; c++) tiles.push(r1 * COLS + c); r1--; }
    tiles.forEach((id, i) => { gone[id] = true; killed.push(id); fallingTiles.push({ id, z: 0, vz: 0, delay: 0.15 + i * 0.05, rot: (rnd() - 0.5) * 0.6 }); });
    ctx.announce("Le sol s'effondre", 1700); ctx.snd("crack"); ctx.shake(0.6);
  }
  function eliminate(c, why) {
    if (!c.alive) return; c.alive = false; c.bomb = 0; if (t - lastDeadT > 0.4 || !falls.length) falls.push([c.id]); else falls[falls.length - 1].push(c.id); lastDeadT = t;
    if (why === "bomb") { c.explode = true; c.gone = true; ctx.fx("boom", c.x, c.y, 20, c.k != null ? "#ffb347" : ""); ctx.snd("boom"); ctx.announce(c.name + " saute avec la bombe", 2200); }
    else { ctx.announce(c.name + " tombe dans le vide", 2000); ctx.snd("fall"); }
    if (alive().length > 1) { mkBombs(); shrink(); }
  }

  // intelligence des bots. Chaque niveau change la précision, la vitesse de réaction et l'usage du turbo
  function think(c, dt) {
    const sk = ctx.skill(c.id); const A = alive().filter((o) => o !== c);
    c.noiseT -= dt; if (c.noiseT <= 0) { c.noiseT = 0.25 + rnd() * 0.3; c.noise = (rnd() - 0.5) * (1.1 - sk) * 1.2; }
    let tx = W / 2, ty = H / 2, boost = false; const sp = Math.hypot(c.vx, c.vy);
    const carrier = A.find((o) => o.bomb) || null;
    if (c.bomb) {
      // chasse la voiture non protégée la plus proche, en visant un peu devant elle
      let best = null, bd = 1e9; A.forEach((o) => { if (o.imm > 0.2 || o.bomb) return; const d = Math.hypot(o.x - c.x, o.y - c.y); if (d < bd) { bd = d; best = o; } });
      if (!best) best = A[0];
      if (best) { const lead = 0.28 * sk; tx = best.x + best.vx * lead; ty = best.y + best.vy * lead; if (bd > 170 && bd < 520 && c.gauge > 30 && sk > 0.45) boost = true; if (c.bomb < 2.2 && c.gauge > 10) boost = true; }
    } else {
      // fuit la voiture qui porte la bombe, sinon reste au centre en évitant les autres
      let ax = 0, ay = 0;
      A.forEach((o) => { const dx = c.x - o.x, dy = c.y - o.y, d = Math.hypot(dx, dy) || 1; const w = o.bomb ? 3.2 : 0.35; if (d < 520) { ax += (dx / d) * w * (520 - d) / 520; ay += (dy / d) * w * (520 - d) / 520; } });
      tx = c.x + ax * 500 + (W / 2 - c.x) * 0.25; ty = c.y + ay * 500 + (H / 2 - c.y) * 0.25;
      if (carrier && Math.hypot(carrier.x - c.x, carrier.y - c.y) < 230 && c.gauge > 25 && sk > 0.4) boost = true;
    }
    // reste sur le sol, regarde plus loin que le bout de son capot
    const fx = Math.cos(c.ang), fy = Math.sin(c.ang); const look = 90 + sp * 0.55;
    const px = c.x + fx * look, py = c.y + fy * look; const margin = 50 + (1 - sk) * 30;
    const lc0 = c0 * TILE + margin, lc1 = (c1 + 1) * TILE - margin, lr0 = r0 * TILE + margin, lr1 = (r1 + 1) * TILE - margin;
    let danger = 0;
    if (px < lc0 || px > lc1 || py < lr0 || py > lr1) { tx = (c0 + c1 + 1) * TILE / 2; ty = (r0 + r1 + 1) * TILE / 2; danger = 1; boost = false; }
    obst.forEach((o) => { const dx = px - o.x, dy = py - o.y, d = Math.hypot(dx, dy); if (d < (o.r || 40) + 60) { tx += dx / (d || 1) * 220; ty += dy / (d || 1) * 220; } });
    let want = Math.atan2(ty - c.y, tx - c.x) + c.noise * (danger ? 0.3 : 1); const da = U.angDiff(c.ang, want);
    const steer = U.clamp(da * 2.2, -1, 1); let thr = -1; if (Math.abs(da) > 1.9) thr = sp > 120 ? 1 : -0.4; else if (danger && sp > 260) thr = 0.2;
    if (c.fall || !c.alive) return; ctx.drive(c.id, { x: steer, y: thr, a: boost });
  }

  const inst = {
    done: false,
    update(dt) {
      t += dt;
      // tuiles qui tombent
      fallingTiles.forEach((f) => { f.delay -= dt; if (f.delay <= 0) { f.vz -= 900 * dt; f.z += f.vz * dt; } });
      for (let i = fallingTiles.length - 1; i >= 0; i--) if (fallingTiles[i].z < -400) fallingTiles.splice(i, 1);
      C.forEach((c) => {
        if (c.gone) return;
        if (c.fall) {
          c.vz -= 1100 * dt; c.z += c.vz * dt; c.x += c.vx * dt; c.y += c.vy * dt; c.dead = Math.min(1, c.dead + dt * 1.2);
          if (c.z < GROUND + 60 && !c.splash) { c.splash = true; ctx.fx("lavasplash", c.x, c.y, GROUND + 20); ctx.snd("lava"); if (c.alive) eliminate(c, "fall"); }
          if (c.z < GROUND - 60) c.gone = true; return;
        }
        if (!c.alive) return;
        if (ctx.isBot(c.id)) think(c, dt);
        const i = ctx.input(c.id); c.imm = Math.max(0, c.imm - dt); c.padCd = Math.max(0, c.padCd - dt);
        const sp0 = Math.hypot(c.vx, c.vy);
        c.boosting = !!i.a && c.gauge > 3 && sp0 > 20;
        if (c.boosting) c.gauge = Math.max(0, c.gauge - 42 * dt); else c.gauge = Math.min(100, c.gauge + (sp0 > 5 ? 16 : 24) * dt);
        const k = c.boosting ? BOOST : (c.bomb ? 1.06 : 1);
        const steer = i.x; const grip = (ctx.heavy ? 1.7 : 3.4);
        c.ang += steer * TURN * dt * (0.5 + 0.5 * Math.min(1, sp0 / 150)) * (sp0 > 5 || i.y < 0 ? 1 : 0.6);
        const fx = Math.cos(c.ang), fy = Math.sin(c.ang);
        if (i.y < 0) { c.vx += fx * ACC * k * dt; c.vy += fy * ACC * k * dt; }
        else if (i.y > 0) { const fwd = c.vx * fx + c.vy * fy; if (fwd > 5) { c.vx -= fx * 880 * dt * i.y; c.vy -= fy * 880 * dt * i.y; } else { c.vx -= fx * ACC * 0.55 * dt * i.y; c.vy -= fy * ACC * 0.55 * dt * i.y; } }
        const fwd = c.vx * fx + c.vy * fy, lat = -c.vx * fy + c.vy * fx;
        const g = grip * (1 - Math.min(0.6, Math.abs(steer) * sp0 / 900)); const nl = lat * Math.max(0, 1 - g * dt);
        c.vx = fx * fwd - fy * nl; c.vy = fy * fwd + fx * nl; const sp = Math.hypot(c.vx, c.vy), lim = MAXV * k; if (sp > lim) { c.vx *= lim / sp; c.vy *= lim / sp; }
        c.vx *= 1 - 0.42 * dt; c.vy *= 1 - 0.42 * dt; c.slip = U.clamp(lat / 220, -1, 1);
        c.x += c.vx * dt; c.y += c.vy * dt;
        // tapis accélérateurs
        pads.forEach((p) => { if (c.padCd <= 0 && Math.hypot(c.x - p.x, c.y - p.y) < p.r) { c.padCd = 1.2; c.vx += fx * 380; c.vy += fy * 380; ctx.fx("boost", c.x, c.y, 10, ""); ctx.snd("whoosh"); } });
        // obstacles
        obst.forEach((o) => {
          if (o.k === "barrel") { const dx = c.x - o.x, dy = c.y - o.y, d = Math.hypot(dx, dy) || 0.01, m = o.r + CR - 4; if (d < m) { const nx = dx / d, ny = dy / d; c.x = o.x + nx * m; c.y = o.y + ny * m; const vn = c.vx * nx + c.vy * ny; if (vn < 0) { c.vx -= 1.5 * vn * nx; c.vy -= 1.5 * vn * ny; if (vn < -120) { ctx.snd("bump"); ctx.fx("spark", c.x - nx * 20, c.y - ny * 20, 20, ""); } } } }
          else { const hx = o.w / 2 + CR - 4, hy = o.d / 2 + CR - 4; const dx = c.x - o.x, dy = c.y - o.y; if (Math.abs(dx) < hx && Math.abs(dy) < hy) { const px = hx - Math.abs(dx), py = hy - Math.abs(dy); if (px < py) { const sx = dx < 0 ? -1 : 1; c.x += sx * px; if (c.vx * sx < 0) { c.vx = -c.vx * 0.5; ctx.snd("bump"); } } else { const sy = dy < 0 ? -1 : 1; c.y += sy * py; if (c.vy * sy < 0) { c.vy = -c.vy * 0.5; ctx.snd("bump"); } } } }
        });
        // sous la voiture, plus de sol, elle tombe
        if (tileAt(c.x, c.y) == null) { c.fall = true; c.vz = 60; ctx.snd("whoosh"); }
        if (c.bomb) { c.bomb -= dt; if (c.bomb <= 0) { c.exploded = true; eliminate(c, "bomb"); } }
      });
      // chocs entre voitures
      const A = C.filter((c) => c.alive && !c.fall);
      for (let i = 0; i < A.length; i++) for (let j = i + 1; j < A.length; j++) {
        const a = A[i], b = A[j]; const dx = b.x - a.x, dy = b.y - a.y, d = Math.hypot(dx, dy) || 0.01, m = CR * 2;
        if (d < m) {
          const nx = dx / d, ny = dy / d, o = (m - d) / 2; a.x -= nx * o; a.y -= ny * o; b.x += nx * o; b.y += ny * o;
          const rv = (b.vx - a.vx) * nx + (b.vy - a.vy) * ny;
          if (rv < 0) { const j2 = -1.75 * rv / 2; a.vx -= nx * j2; a.vy -= ny * j2; b.vx += nx * j2; b.vy += ny * j2; if (rv < -90) { ctx.fx("hit", (a.x + b.x) / 2, (a.y + b.y) / 2, 24, ""); ctx.snd("bump"); } }
          if (a.bomb && !b.bomb && b.imm <= 0) { b.bomb = Math.max(a.bomb, 3.5); a.bomb = 0; a.imm = 1.2; a.passes++; ctx.announce(a.name + " passe la bombe à " + b.name, 1700); ctx.snd("pass"); ctx.fx("spark", (a.x + b.x) / 2, (a.y + b.y) / 2, 40, "#ffd24a"); }
          else if (b.bomb && !a.bomb && a.imm <= 0) { a.bomb = Math.max(b.bomb, 3.5); b.bomb = 0; b.imm = 1.2; b.passes++; ctx.announce(b.name + " passe la bombe à " + a.name, 1700); ctx.snd("pass"); ctx.fx("spark", (a.x + b.x) / 2, (a.y + b.y) / 2, 40, "#ffd24a"); }
        }
      }
      if (!inst.done) { if (alive().length <= 1 || t > 175 * ctx.len) inst.done = true; }
    },
    scene() {
      const items = [];
      for (let r = 0; r < ROWS; r++) for (let c = 0; c < COLS; c++) { const id = r * COLS + c; items.push({ t: "box", id: "t" + id, x: c * TILE + TILE / 2, y: r * TILE + TILE / 2, z: -34, w: TILE - 1, d: TILE - 1, h: 34, c: (r + c) % 2 ? "#6b7288" : "#7d84a0" }); }
      obst.forEach((o, i) => { if (o.k === "barrel") { items.push({ t: "cyl", x: o.x, y: o.y, z: 0, r: o.r, h: o.h, c: o.c }); items.push({ t: "cyl", x: o.x, y: o.y, z: o.h - 2, r: o.r + 2, h: 5, c: "#2a2a33" }); } else items.push({ t: "box", x: o.x, y: o.y, z: 0, w: o.w, d: o.d, h: o.h, c: o.c, m: "metal" }); });
      pads.forEach((p) => { items.push({ t: "cyl", x: p.x, y: p.y, z: 0, r: p.r, h: 3, c: "#ffcc00", m: "neon" }); items.push({ t: "ring", x: p.x, y: p.y, z: 4, r: p.r * 0.8, c: "#fff3a8" }); });
      // décor autour de l'arène
      [[-90, -90], [W + 90, -90], [-90, H + 90], [W + 90, H + 90]].forEach((q) => { items.push({ t: "deco", kind: "lamp", x: q[0], y: q[1], z: -34, s: 2.2 }); });
      for (let i = 0; i < 9; i++) { const a = (i / 9) * Math.PI * 2; items.push({ t: "deco", kind: "rock", x: W / 2 + Math.cos(a) * 780, y: H / 2 + Math.sin(a) * 600, z: GROUND, s: 3 + (i % 3) * 1.2, c: "#5a3a4a" }); }
      for (let i = 0; i < 5; i++) items.push({ t: "deco", kind: "cloud", x: -400 + i * 450, y: -620 - (i % 2) * 120, z: 360 + (i % 3) * 60, s: 3 });
      return { w: W, h: H, cam: { tilt: 54, fov: 36, pad: 1.1 }, env: { sky: ["#2b1050", "#ff8a4a"], fog: "#6a2a4a", fogN: 50, fogF: 150, ground: { c: "#ff7a22", m: "lava", z: GROUND }, lt: { h: ["#ffd9b0", "#5a2a60"], hi: 0.95, d: "#fff0d0", di: 0.95, dir: [-0.6, 1, 0.8] } }, items };
    },
    frame() {
      const items = [];
      C.forEach((c) => { if (c.gone) return; items.push({ t: "car", id: c.id, x: c.x, y: c.y, z: c.z, ang: c.ang, k: c.k, n: c.name, bomb: c.alive && c.bomb ? Math.ceil(c.bomb) : 0, danger: c.alive && c.bomb && c.bomb < 3 ? 1 : 0, imm: c.imm > 0 ? 1 : 0, slip: c.slip, boost: c.boosting ? 1 : 0, dead: c.fall ? c.dead : 0, hide: c.explode ? 1 : 0 }); });
      fallingTiles.forEach((f) => { const r = Math.floor(f.id / COLS), cc = f.id % COLS; items.push({ t: "box", id: "f" + f.id, x: cc * TILE + TILE / 2, y: r * TILE + TILE / 2, z: -34 + f.z, w: TILE - 1, d: TILE - 1, h: 34, c: (r + cc) % 2 ? "#6b7288" : "#7d84a0", sm: 40 }); });
      const al = alive().length;
      return { w: W, h: H, items, kill: killed.slice(), hud: { title: n > 2 ? "Passe la bombe en touchant une voiture" : "", chips: [{ text: al + " en jeu" }], bars: null } };
    },
    priv(pid) { const c = C.find((x) => x.id === pid); if (!c) return null; return { bars: [{ label: "Turbo", pct: c.gauge, c: c.boosting ? "#ffb347" : "#4dabf7" }], dead: !c.alive ? 1 : 0, deadText: c.alive ? "" : "Tu es éliminé, regarde la suite" }; },
    ranking() {
      const al = alive().map((c) => c.id); const groups = U.rankFromFalls(C.map((c) => c.id), falls, al);
      const bonus = {}, notes = {}; let top = 0; C.forEach((c) => { if (c.passes > top) top = c.passes; });
      C.forEach((c) => { if (c.passes > 0) notes[c.id] = c.passes + " passe" + (c.passes > 1 ? "s" : ""); if (top >= 2 && c.passes === top) bonus[c.id] = 2; });
      const w = al.length === 1 ? C.find((c) => c.id === al[0]) : null;
      return { groups, bonus, notes, headline: w ? "🏆 " + w.name + " est le dernier survivant" : "Égalité, plus personne debout" };
    },
  };
  return inst;
};

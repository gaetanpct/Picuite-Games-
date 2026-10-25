// Bombe en voiture. Des voitures qui dérapent, une bombe qui passe de main en main.
const U = require("../pg-util.js");
const W = 900, H = 600;
exports.create = function (ctx) {
  const rnd = ctx.rnd; const n = ctx.n;
  const pillars = []; const np = 3 + Math.floor(n / 2);
  const spots = U.shuffle([[300, 200], [600, 200], [300, 400], [600, 400], [450, 300], [150, 300], [750, 300], [450, 120], [450, 480], [150, 120], [750, 480]], rnd);
  for (let i = 0; i < np && i < spots.length; i++) pillars.push({ x: spots[i][0], y: spots[i][1], r: 26 + Math.floor(rnd() * 8) });
  const C = ctx.players.map((m, i) => { const a = (i / n) * Math.PI * 2; return { id: m.id, k: m.color, name: m.name, x: W / 2 + Math.cos(a) * 340, y: H / 2 + Math.sin(a) * 215, ang: a + Math.PI, vx: 0, vy: 0, alive: true, bomb: 0, imm: 0 }; });
  C.forEach((c) => { c.x = U.clamp(c.x, 40, W - 40); c.y = U.clamp(c.y, 40, H - 40); });
  const falls = []; let t = 0; const bombs = Math.max(1, Math.round(n / 4)); const fuse = (n <= 3 ? 11 : 9) * ctx.pace / ctx.speed;
  function giveBombs() { const A = C.filter((c) => c.alive && !c.bomb); const need = Math.min(bombs, C.filter((c) => c.alive).length - 1) - C.filter((c) => c.alive && c.bomb).length; U.shuffle(A, rnd).slice(0, Math.max(0, need)).forEach((c) => { c.bomb = fuse; c.imm = 0; }); }
  giveBombs();
  const acc = 420 * ctx.speed, maxV = 285 * ctx.speed, grip = 3.2;
  const inst = {
    done: false,
    update(dt) {
      t += dt; const dead = [];
      C.forEach((c) => {
        if (!c.alive) return; const i = ctx.input(c.id); c.imm = Math.max(0, c.imm - dt);
        c.ang += i.x * 2.9 * dt * (0.55 + 0.45 * Math.min(1, Math.hypot(c.vx, c.vy) / 140));
        const fx = Math.cos(c.ang), fy = Math.sin(c.ang);
        const boost = c.bomb ? 1.08 : 1;
        if (i.y < 0) { c.vx += fx * acc * boost * dt; c.vy += fy * acc * boost * dt; } else if (i.y > 0) { const fwd = c.vx * fx + c.vy * fy; if (fwd > 5) { c.vx -= fx * 520 * dt; c.vy -= fy * 520 * dt; } else { c.vx -= fx * acc * 0.5 * dt; c.vy -= fy * acc * 0.5 * dt; } }
        // adhérence latérale partielle, la voiture dérape un peu
        const fwd = c.vx * fx + c.vy * fy, lat = -c.vx * fy + c.vy * fx; const nl = lat * Math.max(0, 1 - grip * dt);
        c.vx = fx * fwd + -fy * nl; c.vy = fy * fwd + fx * nl; const sp = Math.hypot(c.vx, c.vy), lim = maxV * boost; if (sp > lim) { c.vx *= lim / sp; c.vy *= lim / sp; }
        c.vx *= 1 - 0.35 * dt; c.vy *= 1 - 0.35 * dt;
        c.x += c.vx * dt; c.y += c.vy * dt;
        if (c.x < 22) { c.x = 22; c.vx = Math.abs(c.vx) * 0.5; } if (c.x > W - 22) { c.x = W - 22; c.vx = -Math.abs(c.vx) * 0.5; }
        if (c.y < 22) { c.y = 22; c.vy = Math.abs(c.vy) * 0.5; } if (c.y > H - 22) { c.y = H - 22; c.vy = -Math.abs(c.vy) * 0.5; }
        pillars.forEach((p) => { const dx = c.x - p.x, dy = c.y - p.y, d = Math.hypot(dx, dy) || 0.01, m = p.r + 15; if (d < m) { const nx = dx / d, ny = dy / d; c.x = p.x + nx * m; c.y = p.y + ny * m; const vn = c.vx * nx + c.vy * ny; if (vn < 0) { c.vx -= 1.6 * vn * nx; c.vy -= 1.6 * vn * ny; } } });
        if (c.bomb) { c.bomb -= dt; if (c.bomb <= 0) { c.alive = false; dead.push(c.id); } }
      });
      const A = C.filter((c) => c.alive);
      for (let i = 0; i < A.length; i++) for (let j = i + 1; j < A.length; j++) {
        const a = A[i], b = A[j]; const dx = b.x - a.x, dy = b.y - a.y, d = Math.hypot(dx, dy) || 0.01;
        if (d < 34) {
          const nx = dx / d, ny = dy / d, o = (34 - d) / 2; a.x -= nx * o; a.y -= ny * o; b.x += nx * o; b.y += ny * o;
          const rv = (b.vx - a.vx) * nx + (b.vy - a.vy) * ny; if (rv < 0) { const j2 = -1.5 * rv / 2; a.vx -= nx * j2; a.vy -= ny * j2; b.vx += nx * j2; b.vy += ny * j2; }
          // la bombe passe de celui qui la porte à celui qui est touché, sauf s'il est protégé
          if (a.bomb && !b.bomb && b.imm <= 0) { b.bomb = Math.max(fuse * 0.75, a.bomb); a.bomb = 0; a.imm = 1.3; ctx.announce(a.name + " passe la bombe à " + b.name, 1800); }
          else if (b.bomb && !a.bomb && a.imm <= 0) { a.bomb = Math.max(fuse * 0.75, b.bomb); b.bomb = 0; b.imm = 1.3; ctx.announce(b.name + " passe la bombe à " + a.name, 1800); }
        }
      }
      if (dead.length) { falls.push(dead); dead.forEach((id) => { const c = C.find((x) => x.id === id); ctx.announce(c.name + " saute avec la bombe", 2200); }); const left = C.filter((c) => c.alive); if (left.length > 1) giveBombs(); }
      if (C.filter((c) => c.alive).length <= 1 || t > 80 * ctx.pace) inst.done = true;
    },
    frame() {
      const items = pillars.map((p) => ({ t: "circ", x: p.x, y: p.y, r: p.r, c: "#5d6b7d", s: "#2c3644" }));
      C.forEach((c) => { if (c.alive) items.push({ t: "car", id: c.id, x: c.x, y: c.y, ang: c.ang, k: c.k, n: c.name, bomb: c.bomb ? Math.ceil(c.bomb) : 0, imm: c.imm > 0 ? 1 : 0, danger: c.bomb && c.bomb < 3 ? 1 : 0 }); });
      return { w: W, h: H, bg: "#202a38", items, hud: { title: "Passe la bombe en touchant une autre voiture", chips: [{ text: C.filter((c) => c.alive).length + " en jeu" }] } };
    },
    ranking() { const al = C.filter((c) => c.alive).map((c) => c.id); return { groups: U.rankFromFalls(C.map((c) => c.id), falls, al), bonus: {} }; },
  };
  return inst;
};

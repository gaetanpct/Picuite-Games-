// Sol en miettes. Chaque dalle touchée s'effrite puis tombe.
const U = require("../pg-util.js");
exports.create = function (ctx) {
  const rnd = ctx.rnd; const cs = 70; const cols = Math.max(7, 6 + Math.ceil(ctx.n / 2)), rows = Math.max(6, 5 + Math.ceil(ctx.n / 3));
  const OX = 10, OY = 70, W = cols * cs + OX * 2, H = OY + rows * cs + 10; const spd = 175 * ctx.speed;
  // etat de chaque dalle, 0 intacte, 1 en train de s'effriter, -1 tombée
  const st = new Array(cols * rows).fill(0), timer = new Array(cols * rows).fill(0);
  const P = ctx.players.map((m, i) => { const a = (i / ctx.n) * Math.PI * 2; return { id: m.id, k: m.color, name: m.name, x: W / 2 + Math.cos(a) * (cols * cs * 0.3), y: OY + rows * cs / 2 + Math.sin(a) * (rows * cs * 0.3), vx: 0, vy: 0, alive: true, fall: 0 }; });
  const falls = []; let t = 0;
  const tileOf = (x, y) => { const c = Math.floor((x - OX) / cs), r = Math.floor((y - OY) / cs); return c < 0 || r < 0 || c >= cols || r >= rows ? -1 : r * cols + c; };
  const crumbleT = 1.15 / ctx.speed;
  const inst = {
    done: false,
    update(dt) {
      t += dt; const dieAt = 70 * ctx.pace;
      P.forEach((p) => {
        if (!p.alive) return; const i = ctx.input(p.id); const [ix, iy] = U.norm2(i.x, i.y);
        p.vx += (ix * spd - p.vx) * Math.min(1, dt * 9); p.vy += (iy * spd - p.vy) * Math.min(1, dt * 9); p.x += p.vx * dt; p.y += p.vy * dt;
        const ti = tileOf(p.x, p.y);
        if (ti >= 0 && st[ti] === 0) { st[ti] = 1; timer[ti] = crumbleT; }
        if (ti < 0 || st[ti] === -1) { p.fall += dt; if (p.fall > 0.25) { p.alive = false; } } else p.fall = 0;
      });
      const A = P.filter((p) => p.alive);
      for (let i = 0; i < A.length; i++) for (let j = i + 1; j < A.length; j++) { const dx = A[j].x - A[i].x, dy = A[j].y - A[i].y, d = Math.hypot(dx, dy) || 0.01; if (d < 36) { const o = (36 - d); const nx = dx / d, ny = dy / d; A[i].x -= nx * o / 2; A[i].y -= ny * o / 2; A[j].x += nx * o / 2; A[j].y += ny * o / 2; A[i].vx -= nx * 90; A[i].vy -= ny * 90; A[j].vx += nx * 90; A[j].vy += ny * 90; } }
      for (let i = 0; i < st.length; i++) if (st[i] === 1) { timer[i] -= dt; if (timer[i] <= 0) st[i] = -1; }
      // les dalles se mettent à tomber plus vite quand la partie traîne
      if (t > dieAt * 0.6) { const idx = Math.floor(rnd() * st.length); if (st[idx] === 0 && rnd() < dt * 3) { st[idx] = 1; timer[idx] = crumbleT; } }
      const fell = P.filter((p) => !p.alive && !falls.some((g) => g.includes(p.id)) && !p.logged); fell.forEach((p) => { p.logged = true; });
      if (fell.length) { // ceux qui tombent dans le même instant forment un groupe
        falls.push(fell.map((p) => p.id));
      }
      if (P.filter((p) => p.alive).length <= 1 || t > dieAt + 15) inst.done = true;
    },
    frame() {
      const cells = st.map((s) => (s === -1 ? -1 : s === 1 ? 1 : 0));
      const items = [{ t: "grid", x: OX, y: OY, cs, cols, rows, cells, pal: ["#58b368", "#e0a23c"], sym: [] }];
      P.forEach((p) => { if (p.alive) items.push({ t: "pawn", id: p.id, x: p.x, y: p.y, k: p.k, n: p.name, r: 16, s: p.fall > 0 ? 0.7 : 1 }); });
      return { w: W, h: H, bg: "#16212e", items, hud: { title: "Reste sur les dalles", chips: [{ text: P.filter((p) => p.alive).length + " en jeu" }] } };
    },
    ranking() { const al = P.filter((p) => p.alive).map((p) => p.id); return { groups: U.rankFromFalls(P.map((p) => p.id), falls, al), bonus: {} }; },
  };
  return inst;
};

// Sumo glissant. On vise en secret, on se lance tous en même temps, la glace fait le reste.
const U = require("../pg-util.js");
const W = 760, H = 600, CX = 380, CY = 300;
exports.create = function (ctx) {
  const n = ctx.n; const R0 = 150 + 14 * n; let R = R0; let cycle = 0;
  const P = ctx.players.map((m, i) => { const a = (i / n) * Math.PI * 2 - Math.PI / 2; const d = R0 * 0.55; return { id: m.id, k: m.color, name: m.name, x: CX + Math.cos(a) * d, y: CY + Math.sin(a) * d, vx: 0, vy: 0, alive: true, ang: a + Math.PI, pow: 0.55, lock: false, falling: 0 }; });
  const falls = []; let lastFallT = -9, t = 0, phase = "aim", left = 0, target = R0, slideT = 0;
  const aimTime = () => 6.5 * ctx.pace;
  left = aimTime();
  const alive = () => P.filter((p) => p.alive);
  function launch() {
    alive().forEach((p) => { const v = 120 + p.pow * 640; p.vx = Math.cos(p.ang) * v; p.vy = Math.sin(p.ang) * v; });
    phase = "slide"; slideT = 0;
  }
  const inst = {
    done: false,
    update(dt) {
      t += dt;
      if (phase === "aim") {
        left -= dt;
        alive().forEach((p) => {
          if (p.lock) return; const i = ctx.input(p.id); const e = ctx.edge(p.id);
          p.ang += i.x * 3.1 * dt; p.pow = U.clamp(p.pow - i.y * 0.85 * dt, 0.15, 1);
          if (e.a) p.lock = true;
        });
        const A = alive().filter((p) => ctx.present(p.id));
        if (left <= 0 || (A.length && A.every((p) => p.lock))) launch();
      } else if (phase === "slide") {
        slideT += dt; const A = alive();
        A.forEach((p) => { const f = Math.max(0, 1 - 1.15 * dt); p.vx *= f; p.vy *= f; p.x += p.vx * dt; p.y += p.vy * dt; });
        for (let i = 0; i < A.length; i++) for (let j = i + 1; j < A.length; j++) {
          const a = A[i], b = A[j]; const dx = b.x - a.x, dy = b.y - a.y, d = Math.hypot(dx, dy) || 0.01;
          if (d < 40) { const nx = dx / d, ny = dy / d, o = (40 - d) / 2; a.x -= nx * o; a.y -= ny * o; b.x += nx * o; b.y += ny * o; const rv = (b.vx - a.vx) * nx + (b.vy - a.vy) * ny; if (rv < 0) { const jj = -(1 + 0.92) * rv / 2; a.vx -= nx * jj; a.vy -= ny * jj; b.vx += nx * jj; b.vy += ny * jj; } }
        }
        const dead = [];
        A.forEach((p) => { const d = Math.hypot(p.x - CX, p.y - CY); if (d > R + 6) { p.alive = false; dead.push(p); } });
        if (dead.length) { if (t - lastFallT > 0.5 || !falls.length) falls.push(dead.map((p) => p.id)); else dead.forEach((p) => falls[falls.length - 1].push(p.id)); lastFallT = t; }
        const moving = alive().some((p) => Math.hypot(p.vx, p.vy) > 14);
        if (alive().length <= 1) { inst.done = true; return; }
        if (!moving || slideT > 4.5) {
          cycle++; if (cycle >= 11) { inst.done = true; return; }
          alive().forEach((p) => { p.vx = 0; p.vy = 0; p.lock = false; p.pow = 0.55; const toC = Math.atan2(CY - p.y, CX - p.x); p.ang = toC; });
          target = Math.max(95, R0 - 26 * cycle); phase = "shrink"; left = 1.0;
        }
      } else if (phase === "shrink") {
        left -= dt; R += (target - R) * Math.min(1, dt * 4); if (left <= 0) { R = target; phase = "aim"; left = aimTime(); ctx.announce("La plateforme rétrécit", 1600);
          // ceux qui sont maintenant dans le vide tombent
          const dead = alive().filter((p) => Math.hypot(p.x - CX, p.y - CY) > R + 6); dead.forEach((p) => { p.alive = false; }); if (dead.length) falls.push(dead.map((p) => p.id));
          if (alive().length <= 1) inst.done = true; }
      }
    },
    frame() {
      const items = [{ t: "circ", x: CX, y: CY, r: R + 8, c: "#7fb7d6", s: "#d9f0ff" }, { t: "circ", x: CX, y: CY, r: R, c: "#b9e3f5", a: 0.55 }];
      alive().forEach((p) => items.push({ t: "pawn", id: p.id, x: p.x, y: p.y, k: p.k, n: p.name, r: 20, ok: phase === "aim" && p.lock ? 1 : 0 }));
      const lockN = alive().filter((p) => p.lock).length;
      return { w: W, h: H, bg: "#16324a", items, hud: { title: phase === "aim" ? "Vise en secret puis valide avec Espace" : phase === "slide" ? "Ça glisse" : "La plateforme rétrécit", timer: phase === "aim" ? Math.max(0, left) : null, chips: [{ text: alive().length + " en jeu" }, { text: lockN + " prêts" }] } };
    },
    priv(pid) { const p = P.find((x) => x.id === pid); if (!p || !p.alive || phase !== "aim") return null; return { arrow: { id: p.id, ang: p.ang, pow: p.pow, lock: p.lock } }; },
    onAct(pid, m) {
      const p = P.find((x) => x.id === pid); if (!p || !p.alive || phase !== "aim" || p.lock) return;
      if (m.type === "click") { const dx = m.x - p.x, dy = m.y - p.y, d = Math.hypot(dx, dy); if (d > 6) { p.ang = Math.atan2(dy, dx); p.pow = U.clamp(d / 260, 0.15, 1); } }
      else if (m.type === "btn" && m.id === "lock") p.lock = true;
    },
    ranking() { const al = alive().map((p) => p.id); return { groups: U.rankFromFalls(P.map((p) => p.id), falls, al), bonus: {} }; },
  };
  return inst;
};

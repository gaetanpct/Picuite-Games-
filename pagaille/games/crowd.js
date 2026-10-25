// Faites des groupes. Un nombre est annoncé, il faut être exactement ce nombre dans une zone.
const U = require("../pg-util.js");
const W = 900, H = 560;
exports.create = function (ctx) {
  const rnd = ctx.rnd; const spd = 215 * ctx.speed;
  const P = ctx.players.map((m, i) => { const a = (i / ctx.n) * Math.PI * 2; return { id: m.id, k: m.color, name: m.name, x: W / 2 + Math.cos(a) * 90, y: H / 2 + Math.sin(a) * 70, alive: true }; });
  const falls = []; let cycle = 0, phase = "run", left = 0, K = 2, zones = [], hold = 0, last = 0;
  const alive = () => P.filter((p) => p.alive);
  function setup() {
    const m = alive().length; const choices = []; for (let k = 1; k <= Math.max(2, Math.floor(m / 2)); k++) if (!(m >= 4 && k === 1) && k !== last) choices.push(k);
    K = choices.length ? choices[Math.floor(rnd() * choices.length)] : 2; last = K;
    const Z = Math.min(8, Math.max(3, Math.ceil(m / K) + 1)); const spots = U.shuffle([[170, 140], [450, 130], [730, 140], [150, 420], [450, 430], [750, 420], [300, 285], [600, 285]], rnd);
    zones = spots.slice(0, Z).map((s, i) => ({ x: s[0], y: s[1], r: 78, n: 0 }));
    left = Math.max(4.5, 8.5 - cycle * 0.7) * ctx.pace; phase = "run";
  }
  setup();
  function count() { zones.forEach((z) => { z.n = 0; }); alive().forEach((p) => { zones.forEach((z) => { if (Math.hypot(p.x - z.x, p.y - z.y) < z.r - 6) z.n++; }); }); }
  const inst = {
    done: false,
    update(dt) {
      alive().forEach((p) => { const i = ctx.input(p.id); const [vx, vy] = U.norm2(i.x, i.y); p.x = U.clamp(p.x + vx * spd * dt, 16, W - 16); p.y = U.clamp(p.y + vy * spd * dt, 16, H - 16); });
      const A = alive(); for (let i = 0; i < A.length; i++) for (let j = i + 1; j < A.length; j++) { const dx = A[j].x - A[i].x, dy = A[j].y - A[i].y, d = Math.hypot(dx, dy) || 0.01; if (d < 32) { const o = (32 - d) / 2; A[i].x -= dx / d * o; A[i].y -= dy / d * o; A[j].x += dx / d * o; A[j].y += dy / d * o; } }
      count(); left -= dt;
      if (phase === "run" && left <= 0) {
        const safeIn = (p) => zones.some((z) => Math.hypot(p.x - z.x, p.y - z.y) < z.r - 6 && z.n === K);
        const ok = A.filter(safeIn); const out = A.filter((p) => !ok.includes(p));
        if (!ok.length) { ctx.announce("Personne n'est dans un bon groupe, on rejoue", 2000); cycle++; if (cycle >= 7) { inst.done = true; return; } setup(); return; }
        out.forEach((p) => { p.alive = false; }); if (out.length) falls.push(out.map((p) => p.id));
        phase = "show"; left = 2.2; if (out.length) ctx.announce(out.map((p) => p.name).join(" et ") + " sont éliminés", 2000);
      } else if (phase === "show" && left <= 0) {
        cycle++; if (alive().length <= 1 || cycle >= 7) { inst.done = true; return; } setup();
      }
    },
    frame() {
      const items = zones.map((z) => ({ t: "circ", id: "z", x: z.x, y: z.y, r: z.r, c: z.n === K ? "#34c36c" : z.n > K ? "#e5484d" : "#3b82f6", a: 0.35, s: "rgba(255,255,255,.7)" }));
      zones.forEach((z) => items.push({ t: "text", x: z.x, y: z.y + 14, v: z.n + " sur " + K, c: "#ffffff", s: 30 }));
      alive().forEach((p) => items.push({ t: "pawn", id: p.id, x: p.x, y: p.y, k: p.k, n: p.name, r: 16 }));
      return { w: W, h: H, bg: "#1a1f3a", items, hud: { title: "Formez des groupes de " + K, big: String(K), timer: phase === "run" ? Math.max(0, left) : null, chips: [{ text: alive().length + " en jeu" }] } };
    },
    ranking() { return { groups: U.rankFromFalls(P.map((p) => p.id), falls, alive().map((p) => p.id)), bonus: {} }; },
  };
  return inst;
};

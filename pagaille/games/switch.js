// Couleur cible. Une couleur est annoncée, les autres cases disparaissent.
const U = require("../pg-util.js");
const PAL = ["#ef4b4b", "#3b82f6", "#34c36c", "#f5c518", "#9b5de5"];
const NAMES = ["rouge", "bleu", "vert", "jaune", "violet"];
const SYM = ["●", "▲", "■", "★", "◆"];
const COLS = 8, ROWS = 6, CS = 88, OX = 8, OY = 96, W = COLS * CS + OX * 2, H = OY + ROWS * CS + 8;

exports.create = function (ctx) {
  const rnd = ctx.rnd; const spd = 190 * ctx.speed;
  const P = ctx.players.map((m, i) => { const a = (i / ctx.n) * Math.PI * 2; return { id: m.id, k: m.color, x: W / 2 + Math.cos(a) * 130, y: OY + ROWS * CS / 2 + Math.sin(a) * 110, alive: true, name: m.name }; });
  const falls = []; let cycle = 0, phase = "show", left = 0, target = 0, cells = [], stuck = 0, done = false;
  function newBoard() {
    const total = COLS * ROWS; const nT = Math.ceil(total * (0.2 + rnd() * 0.08)); target = Math.floor(rnd() * 5);
    const arr = []; for (let i = 0; i < total; i++) arr.push(i < nT ? target : (target + 1 + Math.floor(rnd() * 4)) % 5);
    cells = U.shuffle(arr, rnd); phase = "show"; left = Math.max(1.9, 4.6 - 0.5 * cycle) * ctx.pace;
  }
  newBoard();
  const alive = () => P.filter((p) => p.alive);
  function tileAt(p) { const c = Math.floor((p.x - OX) / CS), r = Math.floor((p.y - OY) / CS); if (c < 0 || r < 0 || c >= COLS || r >= ROWS) return -1; return r * COLS + c; }
  const inst = {
    done: false,
    update(dt) {
      alive().forEach((p) => { const i = ctx.input(p.id); const [vx, vy] = U.norm2(i.x, i.y); p.x = U.clamp(p.x + vx * spd * dt, OX + 16, W - OX - 16); p.y = U.clamp(p.y + vy * spd * dt, OY + 16, OY + ROWS * CS - 16); });
      const A = alive(); for (let i = 0; i < A.length; i++) for (let j = i + 1; j < A.length; j++) { const dx = A[j].x - A[i].x, dy = A[j].y - A[i].y, d = Math.hypot(dx, dy) || 0.01; if (d < 34) { const push = (34 - d) / 2; A[i].x -= dx / d * push; A[i].y -= dy / d * push; A[j].x += dx / d * push; A[j].y += dy / d * push; } }
      left -= dt;
      if (phase === "show" && left <= 0) {
        const safe = A.filter((p) => { const t = tileAt(p); return t >= 0 && cells[t] === target; });
        if (!safe.length) { ctx.announce("Personne sur la bonne couleur, on recommence plus vite.", 2200); cycle++; newBoard(); return; }
        const out = A.filter((p) => !safe.includes(p)); out.forEach((p) => { p.alive = false; }); if (out.length) falls.push(out.map((p) => p.id));
        phase = "drop"; left = 1.4;
      } else if (phase === "drop" && left <= 0) {
        cycle++; if (alive().length <= 1 || cycle >= 9) { inst.done = true; return; } newBoard();
      }
    },
    frame() {
      const shown = cells.map((c, i) => (phase === "drop" && c !== target ? -1 : c));
      const items = [{ t: "grid", x: OX, y: OY, cs: CS, cols: COLS, rows: ROWS, cells: shown, pal: PAL, sym: SYM }];
      P.forEach((p) => { if (p.alive) items.push({ t: "pawn", id: p.id, x: p.x, y: p.y, k: p.k, n: p.name, r: 17 }); });
      return { w: W, h: H, bg: "#1b2540", items, hud: { title: phase === "show" ? "Cours sur la couleur " + NAMES[target] + " " + SYM[target] : "Les autres cases tombent", target: { c: PAL[target], s: SYM[target] }, timer: Math.max(0, left), chips: [{ text: alive().length + " en jeu" }] } };
    },
    ranking() { const al = alive().map((p) => p.id); return { groups: U.rankFromFalls(P.map((p) => p.id), falls, al), bonus: {} }; },
  };
  return inst;
};

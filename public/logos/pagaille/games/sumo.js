// Sumo glissant. On vise en secret, on se lance tous en même temps sur la glace, les chocs font le reste.
// Des météores annoncés par des cercles rouges bousculent la piste, et la plateforme rétrécit à chaque tour.
const U = require("../pg-util.js");

exports.create = function (ctx) {
  const rnd = ctx.rnd; const n = ctx.n; const R0 = 165 + 13 * n; let R = R0; const CX = 400, CY = 340, W = 800, H = 680; const events = ctx.opts.sumoEvents !== false; const maxCycles = Math.round(10 * ctx.len);
  const P = ctx.players.map((m, i) => { const a = (i / n) * Math.PI * 2 - Math.PI / 2; const d = R0 * 0.58; return { id: m.id, k: m.color, name: m.name, x: CX + Math.cos(a) * d, y: CY + Math.sin(a) * d, z: 0, vx: 0, vy: 0, vz: 0, alive: true, ang: a + Math.PI, pow: 0.45, lock: false, fall: 0, hits: 0, ex: {} }; });
  const falls = []; let lastFallT = -9, t = 0, phase = "aim", left = 0, target = R0, slideT = 0, cycle = 0; const meteors = []; const craters = []; let mid = 0;
  const aimTime = () => 7 * ctx.pace; left = aimTime();
  const alive = () => P.filter((p) => p.alive); const dist = (p) => Math.hypot(p.x - CX, p.y - CY);
  function planMeteors() {
    meteors.length = 0; if (!events || cycle < 1) return; const k = Math.min(4, 1 + Math.floor(cycle / 3)) + (rnd() < 0.4 ? 1 : 0);
    for (let i = 0; i < k; i++) { const a = rnd() * 6.283, d = Math.sqrt(rnd()) * R * 0.85; meteors.push({ id: "m" + (mid++), x: CX + Math.cos(a) * d, y: CY + Math.sin(a) * d, r: 78 }); }
  }
  function impact() {
    meteors.forEach((m) => { ctx.fx("boom", m.x, m.y, 0, "#ff9a3a"); ctx.snd("boom"); craters.push({ x: m.x, y: m.y, r: m.r * 0.6, id: m.id }); alive().forEach((p) => { const dx = p.x - m.x, dy = p.y - m.y, d = Math.hypot(dx, dy) || 1; if (d < m.r * 1.8) { const f = (1 - d / (m.r * 1.8)) * 620; p.vx += dx / d * f; p.vy += dy / d * f; } }); });
    if (meteors.length) ctx.shake(3); meteors.length = 0;
  }
  function launch() {
    alive().forEach((p) => { const v = 120 + p.pow * 640; p.vx = Math.cos(p.ang) * v; p.vy = Math.sin(p.ang) * v; }); impact(); ctx.snd("whoosh"); phase = "slide"; slideT = 0;
  }
  function botAim(p) {
    const sk = ctx.skill(p.id); const foes = alive().filter((q) => q !== p); if (!foes.length) return;
    // les bons joueurs visent celui qui est près du bord, les autres le plus proche
    let best = null, bs = -1e9; foes.forEach((q) => { const d = Math.hypot(q.x - p.x, q.y - p.y); const s = (sk > 0.5 ? dist(q) * 1.1 : 0) - d * 0.6 + (rnd() - 0.5) * (1 - sk) * 220; if (s > bs) { bs = s; best = q; } });
    const dx = best.x - p.x, dy = best.y - p.y, d = Math.hypot(dx, dy) || 1; p.ang = Math.atan2(dy, dx) + (rnd() - 0.5) * (1 - sk) * 0.7;
    // distance de glissade = vitesse divisée par 1.15. on vise un peu au delà de la cible mais pas hors de la plateforme
    let need = (d + 28) * 1.15; const safe = Math.max(60, R - dist(p) + 40) * 1.15; if (sk > 0.4) need = Math.min(need, Math.max(need * 0.6, safe + d * 0.5));
    p.pow = U.clamp((need - 120) / 640 + (rnd() - 0.5) * (1 - sk) * 0.4, 0.12, 1); p.ex.at = 1.2 + rnd() * (1 - sk) * 4 + rnd();
  }
  function startAim() { phase = "aim"; left = aimTime(); planMeteors(); alive().forEach((p) => { p.vx = 0; p.vy = 0; p.lock = false; p.pow = 0.45; p.ang = Math.atan2(CY - p.y, CX - p.x); if (ctx.isBot(p.id)) { botAim(p); } }); if (meteors.length) ctx.announce("Des météores arrivent, regarde les cercles rouges", 2200); }
  const dead = (p) => { p.alive = false; p.vz = 60; ctx.snd("splash"); ctx.fx("splash", p.x, p.y, -40, "#e8f7ff"); };
  startAim();
  const inst = {
    done: false,
    update(dt) {
      t += dt;
      P.forEach((p) => { if (!p.alive && p.fall < 2) { p.fall += dt; p.vz -= 1400 * dt; p.z += p.vz * dt; p.x += p.vx * dt * 0.4; p.y += p.vy * dt * 0.4; } });
      if (phase === "aim") {
        left -= dt;
        alive().forEach((p) => {
          if (ctx.isBot(p.id)) { p.ex.at -= dt; if (p.ex.at <= 0) p.lock = true; return; }
          if (p.lock) return; const i = ctx.input(p.id); const e = ctx.edge(p.id);
          p.ang += i.x * 3.1 * dt; p.pow = U.clamp(p.pow - i.y * 0.85 * dt, 0.12, 1); if (e.a) { p.lock = true; ctx.snd("coin"); }
        });
        const A = alive().filter((p) => ctx.present(p.id)); if (left <= 0 || (A.length && A.every((p) => p.lock))) launch();
      } else if (phase === "slide") {
        slideT += dt; const A = alive();
        A.forEach((p) => { const f = Math.max(0, 1 - 1.15 * dt); p.vx *= f; p.vy *= f; p.x += p.vx * dt; p.y += p.vy * dt; });
        for (let i = 0; i < A.length; i++) for (let j = i + 1; j < A.length; j++) {
          const a = A[i], b = A[j]; const dx = b.x - a.x, dy = b.y - a.y, d = Math.hypot(dx, dy) || 0.01;
          if (d < 40) { const nx = dx / d, ny = dy / d, o = (40 - d) / 2; a.x -= nx * o; a.y -= ny * o; b.x += nx * o; b.y += ny * o; const rv = (b.vx - a.vx) * nx + (b.vy - a.vy) * ny; if (rv < 0) { const jj = -(1 + 0.92) * rv / 2; a.vx -= nx * jj; a.vy -= ny * jj; b.vx += nx * jj; b.vy += ny * jj; if (-rv > 120) { ctx.fx("hit", (a.x + b.x) / 2, (a.y + b.y) / 2, 20, ""); ctx.snd("bump"); if (Math.hypot(a.vx, a.vy) > Math.hypot(b.vx, b.vy)) b.hits++; else a.hits++; } } }
        }
        const out = []; A.forEach((p) => { if (dist(p) > R + 8) out.push(p); });
        if (out.length) { if (t - lastFallT > 0.5 || !falls.length) falls.push(out.map((p) => p.id)); else out.forEach((p) => falls[falls.length - 1].push(p.id)); lastFallT = t; out.forEach(dead); }
        const moving = alive().some((p) => Math.hypot(p.vx, p.vy) > 14);
        if (alive().length <= 1) { inst.done = true; return; }
        if (!moving || slideT > 5) { cycle++; if (cycle >= maxCycles) { inst.done = true; return; } target = Math.max(92, R0 - 22 * cycle); phase = "shrink"; left = 1.1; craters.length = 0; ctx.snd("crack"); }
      } else if (phase === "shrink") {
        left -= dt; R += (target - R) * Math.min(1, dt * 4);
        if (left <= 0) { R = target; const out = alive().filter((p) => dist(p) > R + 8); if (out.length) { falls.push(out.map((p) => p.id)); out.forEach(dead); } if (alive().length <= 1) inst.done = true; else { ctx.announce("La plateforme rétrécit", 1300); startAim(); } }
      }
    },
    scene() { return { w: W, h: H, cam: { tilt: 58, fov: 40, pad: 1.12, c: [CX, CY + 20], ht: 40 }, env: { sky: ["#142b4d", "#6fb4e8"], fog: "#2a5a88", fogN: 70, fogF: 250, ground: { c: "#12456b", m: "water", z: -120 }, lt: { h: ["#e8f4ff", "#506a8a"], hi: 1, d: "#fff", di: 0.95, dir: [-0.35, 1, 0.5] } }, items: [{ t: "deco", kind: "cloud", x: 40, y: 80, z: 120, s: 2.4 }, { t: "deco", kind: "cloud", x: 760, y: 560, z: 140, s: 2.4 }] }; },
    frame() {
      const items = [{ t: "cyl", id: "ice", x: CX, y: CY, z: -70, r: R + 8, h: 70, c: "#8fd2f0", m: "ice", sm: 20 }];
      craters.forEach((c) => items.push({ t: "disc", id: "c" + c.id, x: c.x, y: c.y, z: 1, r: c.r, c: "#3a5870", a: 0.55 }));
      if (phase === "aim") meteors.forEach((m) => { const k = 1 - Math.max(0, left) / aimTime(); items.push({ t: "ring", id: "r" + m.id, x: m.x, y: m.y, z: 1, r: m.r * (1 + Math.sin(t * 8) * 0.05), c: "#ff4d4d", a: 0.6 + k * 0.3 }); items.push({ t: "disc", id: "q" + m.id, x: m.x, y: m.y, z: 1, r: m.r * (0.25 + k * 0.75), c: "#ff6b3d", a: 0.25 }); });
      P.forEach((p) => { if (!p.alive && p.fall >= 1.6) return; items.push({ t: "pawn", id: p.id, x: p.x, y: p.y, z: p.z, k: p.k, n: p.name, face: Math.atan2(p.vy, p.vx || 0.001) * (Math.hypot(p.vx, p.vy) > 30 ? 1 : 0) + (Math.hypot(p.vx, p.vy) > 30 ? 0 : p.ang), air: p.alive ? 0 : 1, gz: -200, badge: p.alive && phase === "aim" && p.lock ? "✔" : "", dead: p.alive ? 0 : 1 }); });
      const lockN = alive().filter((p) => p.lock).length;
      return { w: W, h: H, items, hud: { title: phase === "aim" ? "Vise en secret puis valide avec Espace" : phase === "slide" ? "Ça glisse" : "La plateforme rétrécit", timer: phase === "aim" ? Math.max(0, left) : null, chips: [{ text: "Tour " + (cycle + 1) + " sur " + maxCycles }, { text: phase === "aim" ? lockN + " sur " + alive().length + " prêts" : alive().length + " debout" }] } };
    },
    priv(pid) {
      const p = P.find((x) => x.id === pid); if (!p) return null; if (!p.alive) return { dead: 1, deadText: "Tu es tombé, regarde la suite" };
      if (phase !== "aim") return null; const len = 30 + p.pow * 170;
      return { items: [{ t: "arrow", id: "myarrow", x: p.x, y: p.y, z: 3, ang: p.ang, len, w: 20, c: p.lock ? "#4cd964" : "#ffd23b" }], bars: [{ label: "Puissance", pct: p.pow * 100, c: p.pow > 0.8 ? "#ff4d4d" : "#ffd23b" }], ui: { title: p.lock ? "Prêt, on attend les autres" : "Vise et lance", groups: [], lock: { id: "lock", t: p.lock ? "Prêt" : "Je me lance", dis: p.lock } } };
    },
    onAct(pid, m) {
      const p = P.find((x) => x.id === pid); if (!p || !p.alive || phase !== "aim" || p.lock) return;
      if (m.type === "click") { const dx = m.x - p.x, dy = m.y - p.y, d = Math.hypot(dx, dy); if (d > 6) { p.ang = Math.atan2(dy, dx); p.pow = U.clamp((d - 30) / 170, 0.12, 1); } } else if (m.type === "btn" && m.id === "lock") { p.lock = true; ctx.snd("coin"); }
    },
    ranking() {
      const al = alive().map((p) => p.id); const groups = U.rankFromFalls(P.map((p) => p.id), falls, al); const bonus = {}, notes = {}; const top = P.slice().sort((a, b) => b.hits - a.hits)[0]; if (top && top.hits >= 3) bonus[top.id] = 2;
      P.forEach((p) => { notes[p.id] = (p.alive ? "Encore sur la glace" : "Tombé") + (p.hits ? ", " + p.hits + " choc" + (p.hits > 1 ? "s" : "") + " gagnant" + (p.hits > 1 ? "s" : "") : ""); });
      return { groups, bonus, notes, headline: "🧊 Le dernier sur la glace" };
    },
  };
  return inst;
};

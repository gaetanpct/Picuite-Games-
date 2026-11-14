// La Bouée, reprise de Pétard Mouillé en version courte. Une bouée par équipe sur un lac, huit portes à passer dans l'ordre.
// Chaque membre pousse dans la direction de ses flèches et la bouée suit la moyenne de l'équipe. Espace lâche un pétard qui propulse d'un coup,
// et deux pétards lâchés ensemble dans le même sens propulsent encore plus fort.
const U = require("../pg-util.js");

exports.create = function (ctx) {
  const rnd = ctx.rnd; const n = ctx.n; const W = 1400, H = 900, CX = 700, CY = 450, RX = 500, RY = 290; const G = 8;
  const TEAMC = ["#ff6b6b", "#4dabf7", "#51cf66", "#fcc419"]; const TEAMN = ["rouge", "bleue", "verte", "jaune"];
  // équipes, chacun pour soi à deux ou trois, par deux au delà
  const order = U.shuffle(ctx.players.map((p) => p.id), rnd); const teams = [];
  if (n <= 3) order.forEach((id) => teams.push([id])); else { for (let i = 0; i < order.length; i += 2) teams.push(order.slice(i, i + 2)); if (teams[teams.length - 1].length === 1) teams[teams.length - 2].push(teams.pop()[0]); }
  const info = {}; ctx.players.forEach((p) => { info[p.id] = p; });
  // les portes sur une boucle autour du lac, chacune perpendiculaire au chemin
  const gates = []; for (let k = 0; k < G; k++) { const a = Math.PI / 2 - ((k + 1) / G) * Math.PI * 2 + 0.25; const zig = k % 2 ? 0.78 : 1.04; const cx = CX + Math.cos(a) * RX * zig, cy = CY + Math.sin(a) * RY * zig; gates.push({ x: cx, y: cy, hw: 80 }); }
  // sens de passage de chaque porte, de la porte d'avant vers la porte d'après, les deux bouées de la porte se placent en travers
  gates.forEach((g, k) => { const pv = gates[(k + G - 1) % G], nx2 = gates[(k + 1) % G]; let tx = nx2.x - pv.x, ty = nx2.y - pv.y; const tl = Math.hypot(tx, ty) || 1; g.tx = tx / tl; g.ty = ty / tl; g.nx = -g.ty; g.ny = g.tx; });
  const rocks = []; for (let k = 0; k < G; k++) { const a = Math.PI / 2 - ((k + 0.5) / G) * Math.PI * 2 + 0.25; const off = (rnd() < 0.5 ? -1 : 1) * (95 + rnd() * 40); const rm = 0.91; rocks.push({ x: CX + Math.cos(a) * (RX * rm + off), y: CY + Math.sin(a) * (RY * rm + off * 0.6), r: 30 + rnd() * 14 }); }
  rocks.push({ x: CX, y: CY, r: 90 });
  const B = teams.map((mem, i) => { const sx = CX + (i - (teams.length - 1) / 2) * 110, sy = CY + RY + 10; return { i, mem, x: sx, y: sy, vx: 0, vy: 0, yaw: -Math.PI / 2, gate: 0, fin: 0, finT: 0, burstAt: {}, cd: {}, bot: {}, wob: 0 }; });
  const teamOf = {}; B.forEach((b) => b.mem.forEach((id) => { teamOf[id] = b; }));
  let t = 0, finN = 0, firstAt = 0; const R = 46, ACC = 400, DRAG = 1.2, VMAX = 300;
  const near = (b) => gates[Math.min(G - 1, b.gate)];
  function botDir(b, pid, dt) {
    const sk = ctx.skill(pid); const g = near(b);
    // on vise un point au delà de la porte, dans le sens de passage, pour la traverser franchement
    const before = (b.x - g.x) * g.tx + (b.y - g.y) * g.ty; const aim = before < -40 ? { x: g.x - g.tx * 30, y: g.y - g.ty * 30 } : { x: g.x + g.tx * 110, y: g.y + g.ty * 110 }; let dx = aim.x - b.x, dy = aim.y - b.y; const d = Math.hypot(dx, dy) || 1; dx /= d; dy /= d;
    // contourne le rocher central et vise un peu en avance selon la vitesse
    const wantVx = dx * VMAX * 0.8, wantVy = dy * VMAX * 0.8; let ix = (wantVx - b.vx) / 260, iy = (wantVy - b.vy) / 260;
    rocks.forEach((r) => { const rx = b.x - r.x, ry = b.y - r.y, rd = Math.hypot(rx, ry); if (rd < r.r + 75) { const side = (rx * dy - ry * dx) > 0 ? 1 : -1; ix += (rx / rd) * 0.5 + dy * side * 0.6; iy += (ry / rd) * 0.5 - dx * side * 0.6; } });
    const bt = b.bot[pid] || (b.bot[pid] = { n: 0, nt: 0 }); bt.nt -= dt; if (bt.nt <= 0) { bt.nt = 0.4 + rnd() * 0.6; bt.n = (rnd() - 0.5) * (1 - sk) * 1.6; }
    const a = Math.atan2(iy, ix) + bt.n; const l = Math.min(1, Math.hypot(ix, iy)); return { x: Math.cos(a) * l, y: Math.sin(a) * l, burst: d > 230 && (b.vx * dx + b.vy * dy) > 60 && rnd() < dt * (0.6 + sk * 1.2) };
  }
  const inst = {
    done: false,
    update(dt) {
      t += dt;
      B.forEach((b) => {
        if (b.fin) { b.vx *= Math.exp(-3 * dt); b.vy *= Math.exp(-3 * dt); b.x += b.vx * dt; b.y += b.vy * dt; return; }
        let fx = 0, fy = 0; const now = t; const k = b.mem.length;
        b.mem.forEach((pid) => {
          let ix, iy, burst; if (ctx.isBot(pid)) { const o = botDir(b, pid, dt); ix = o.x; iy = o.y; burst = o.burst; } else { const i = ctx.input(pid); ix = i.x; iy = i.y; burst = ctx.edge(pid).a; }
          const l = Math.hypot(ix, iy); if (l > 1) { ix /= l; iy /= l; } fx += ix; fy += iy;
          b.cd[pid] = Math.max(0, (b.cd[pid] || 0) - dt);
          if (burst && b.cd[pid] <= 0) {
            let bx = ix, by = iy; if (Math.hypot(bx, by) < 0.2) { bx = Math.cos(b.yaw); by = Math.sin(b.yaw); } const bl = Math.hypot(bx, by) || 1; bx /= bl; by /= bl;
            // un pétard lâché presque en même temps qu'un équipier dans le même sens compte double
            const mate = b.mem.find((q) => q !== pid && b.burstAt[q] && now - b.burstAt[q].t < 0.35 && b.burstAt[q].x * bx + b.burstAt[q].y * by > 0.6); const pow = (240 / Math.sqrt(k)) * (mate ? 1.6 : 1);
            b.vx += bx * pow; b.vy += by * pow; b.cd[pid] = 1.4; b.burstAt[pid] = { t: now, x: bx, y: by };
            ctx.fx("puff", b.x - bx * R, b.y - by * R, 6, mate ? "#d4f08a" : "#b9d98a"); ctx.snd(mate ? "prout2" : "prout"); b.wob = 1;
            if (mate) ctx.announce("Double pétard pour l'équipe " + TEAMN[b.i % 4], 1400);
          }
        });
        b.vx += (fx / k) * ACC * dt; b.vy += (fy / k) * ACC * dt; const dr = Math.exp(-DRAG * dt); b.vx *= dr; b.vy *= dr; const sp = Math.hypot(b.vx, b.vy); if (sp > VMAX) { b.vx *= VMAX / sp; b.vy *= VMAX / sp; }
        const px = b.x, py = b.y; b.x += b.vx * dt; b.y += b.vy * dt;
        // la bouée tourne doucement vers sa course, et tangue quand l'équipe n'est pas d'accord
        if (sp > 30) { let d = Math.atan2(b.vy, b.vx) - b.yaw; while (d > Math.PI) d -= 2 * Math.PI; while (d < -Math.PI) d += 2 * Math.PI; b.yaw += d * Math.min(1, dt * 3); }
        const agree = k > 1 ? Math.hypot(fx, fy) / k : 1; b.wob = Math.max(0, b.wob - dt * 1.5) + (1 - agree) * dt * 2;
        // rives et rochers
        if (b.x < 60 + R) { b.x = 60 + R; b.vx = Math.abs(b.vx) * 0.6; } if (b.x > W - 60 - R) { b.x = W - 60 - R; b.vx = -Math.abs(b.vx) * 0.6; }
        if (b.y < 60 + R) { b.y = 60 + R; b.vy = Math.abs(b.vy) * 0.6; } if (b.y > H - 60 - R) { b.y = H - 60 - R; b.vy = -Math.abs(b.vy) * 0.6; }
        rocks.forEach((r) => { const dx = b.x - r.x, dy = b.y - r.y, d = Math.hypot(dx, dy) || 1, m = r.r + R; if (d < m) { const nx = dx / d, ny = dy / d; b.x = r.x + nx * m; b.y = r.y + ny * m; const vn = b.vx * nx + b.vy * ny; if (vn < 0) { b.vx -= 1.6 * vn * nx; b.vy -= 1.6 * vn * ny; if (vn < -120) { ctx.snd("bump"); b.wob = 1; } } } });
        // passage de la porte suivante, on coupe le segment entre les deux bouées de la porte
        const g = near(b); const ax = g.x - g.nx * g.hw, ay = g.y - g.ny * g.hw, bx2 = g.x + g.nx * g.hw, by2 = g.y + g.ny * g.hw;
        if (segX(px, py, b.x, b.y, ax, ay, bx2, by2)) {
          b.gate++; ctx.fx("coin", g.x, g.y, 30, ""); ctx.snd("flag");
          if (b.gate >= G) { b.fin = ++finN; b.finT = t; if (!firstAt) firstAt = t; ctx.fx("confetti", b.x, b.y, 40, ""); ctx.snd(b.fin === 1 ? "win" : "coin"); ctx.announce("L'équipe " + TEAMN[b.i % 4] + " passe la dernière porte", 2400); }
        }
      });
      // les bouées se cognent
      for (let i = 0; i < B.length; i++) for (let j = i + 1; j < B.length; j++) { const a = B[i], c = B[j]; const dx = c.x - a.x, dy = c.y - a.y, d = Math.hypot(dx, dy) || 0.01; if (d < R * 2) { const nx = dx / d, ny = dy / d, o = (R * 2 - d) / 2; a.x -= nx * o; a.y -= ny * o; c.x += nx * o; c.y += ny * o; const rv = (c.vx - a.vx) * nx + (c.vy - a.vy) * ny; if (rv < 0) { const jj = -(1 + 0.8) * rv / 2; a.vx -= nx * jj; a.vy -= ny * jj; c.vx += nx * jj; c.vy += ny * jj; if (-rv > 140) { ctx.snd("bump"); a.wob = c.wob = 1; } } } }
      if (!inst.done) { if (B.every((b) => b.fin)) inst.done = true; else if (firstAt && t - firstAt > 12) inst.done = true; else if (t > 65 * ctx.len) inst.done = true; }
    },
    scene() {
      const items = [];
      items.push({ t: "box", x: W / 2, y: 30, z: -10, w: W + 80, d: 60, h: 30, c: "#e8d9a8" }, { t: "box", x: W / 2, y: H - 30, z: -10, w: W + 80, d: 60, h: 30, c: "#e8d9a8" }, { t: "box", x: 30, y: H / 2, z: -10, w: 60, d: H, h: 30, c: "#e8d9a8" }, { t: "box", x: W - 30, y: H / 2, z: -10, w: 60, d: H, h: 30, c: "#e8d9a8" });
      rocks.forEach((r, i) => items.push({ t: "cyl", x: r.x, y: r.y, z: -20, r: r.r, h: 46, c: i === rocks.length - 1 ? "#5ea84a" : "#8a8f99", seg: 8 }));
      items.push({ t: "deco", kind: "tree", x: CX, y: CY, z: 26, s: 3.2 });
      gates.forEach((g, k) => { [-1, 1].forEach((s) => items.push({ t: "cyl", x: g.x + g.nx * g.hw * s, y: g.y + g.ny * g.hw * s, z: -10, r: 13, h: 80, c: k === G - 1 ? "#ffffff" : "#ff8a3d" })); const gc = k === G - 1 ? "#ffffff" : "#ff8a3d"; items.push({ t: "box", x: g.x, y: g.y, z: 62, w: g.hw * 2, d: 5, h: 12, rot: Math.atan2(g.ny, g.nx), c: gc, ns: 1 }); items.push({ t: "box", x: g.x, y: g.y, z: 0, w: g.hw * 2, d: 3, h: 3, rot: Math.atan2(g.ny, g.nx), c: "#fff2c4", ns: 1 }); items.push({ t: "text", x: g.x, y: g.y, z: 100, v: k === G - 1 ? "🏁" : String(k + 1), c: "#ffffff", s: 44 }); });
      return { w: W, h: H, cam: { tilt: 60, fov: 40, pad: 1.04, c: [CX, CY + 10], ht: 30 }, env: { sky: ["#6fc3ff", "#e7f7ff"], fog: "#d7f0ff", fogN: 80, fogF: 260, ground: { c: "#2d9bd6", m: "water", z: 0 }, lt: { h: ["#ffffff", "#7a9cc0"], hi: 1, d: "#fff6dd", di: 0.9, dir: [-0.4, 1, 0.5] } }, items };
    },
    frame() {
      const items = [];
      B.forEach((b) => {
        const c = TEAMC[b.i % 4]; const tilt = Math.sin(t * 9 + b.i) * 0.12 * Math.min(1, b.wob);
        items.push({ t: "cyl", id: "bo" + b.i, x: b.x, y: b.y, z: 2 + Math.sin(t * 2 + b.i) * 2, r: R, h: 16, c, sm: 30 }); items.push({ t: "cyl", id: "bi" + b.i, x: b.x, y: b.y, z: 3 + Math.sin(t * 2 + b.i) * 2, r: R * 0.55, h: 16, c: "#1e6fa8", sm: 30 });
        b.mem.forEach((pid, k) => { const a = b.yaw + Math.PI + (k - (b.mem.length - 1) / 2) * 0.9; const p = info[pid]; items.push({ t: "pawn", id: pid, x: b.x + Math.cos(a) * R * 0.78, y: b.y + Math.sin(a) * R * 0.78, z: 14, k: p.color, n: p.name, face: b.yaw, sc: 0.75, roll: tilt, gz: 2, badge: b.fin === 1 ? "🏆" : b.fin ? "🏁" : (b.cd[pid] || 0) > 1.2 ? "💨" : "" }); });
      });
      const chips = B.map((b) => ({ text: "Équipe " + TEAMN[b.i % 4] + " " + Math.min(G, b.gate) + " sur " + G }));
      return { w: W, h: H, items, hud: { title: firstAt ? "Vite, la course se termine" : "Passe les portes dans l'ordre avec ton équipe", chips, timer: firstAt ? Math.max(0, 12 - (t - firstAt)) : Math.max(0, 65 * ctx.len - t) } };
    },
    priv(pid) {
      const b = teamOf[pid]; if (!b) return null; const g = near(b); const mates = b.mem.filter((q) => q !== pid).map((q) => info[q].name);
      const items = b.fin ? [] : [{ t: "ring", id: "ng", x: g.x, y: g.y, z: 2, r: g.hw + 20, c: TEAMC[b.i % 4], a: 0.85 }, { t: "arrow", id: "na", x: b.x, y: b.y, z: 20, ang: Math.atan2(g.y - b.y, g.x - b.x), len: 70, w: 14, c: TEAMC[b.i % 4] }];
      return { items, bars: [{ label: "Pétard", pct: 100 - ((b.cd[pid] || 0) / 1.4) * 100, c: (b.cd[pid] || 0) > 0 ? "#9aa5b1" : "#b9d98a" }], role: { name: "Équipe " + TEAMN[b.i % 4], c: TEAMC[b.i % 4], tip: mates.length ? "Avec " + mates.join(" et ") + ". Poussez dans le même sens, et lâchez vos pétards ensemble." : "Tu pilotes seul ta bouée." } };
    },
    ranking() {
      const sorted = B.slice().sort((a, b) => (a.fin && b.fin ? a.fin - b.fin : a.fin ? -1 : b.fin ? 1 : b.gate - a.gate || dist(a) - dist(b)));
      const notes = {}, bonus = {}; sorted.forEach((b) => b.mem.forEach((id) => { notes[id] = b.fin ? "Huit portes en " + Math.round(b.finT) + " s" : b.gate + " porte" + (b.gate > 1 ? "s" : "") + " sur " + G; }));
      return { groups: sorted.map((b) => b.mem.slice()), bonus, notes, headline: sorted[0] && sorted[0].fin ? "🛟 L'équipe " + TEAMN[sorted[0].i % 4] + " gagne la course de bouées" : "Personne n'a bouclé le tour" };
    },
  };
  const dist = (b) => { const g = near(b); return Math.hypot(g.x - b.x, g.y - b.y); };
  function segX(ax, ay, bx, by, cx, cy, dx, dy) { const d1 = (bx - ax) * (cy - ay) - (by - ay) * (cx - ax), d2 = (bx - ax) * (dy - ay) - (by - ay) * (dx - ax), d3 = (dx - cx) * (ay - cy) - (dy - cy) * (ax - cx), d4 = (dx - cx) * (by - cy) - (dy - cy) * (bx - cx); return d1 * d2 < 0 && d3 * d4 < 0; }
  return inst;
};

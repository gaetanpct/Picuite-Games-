// Meurtre mystère, de 3 à 8 joueurs. Le détective est connu de tous, le meurtrier est secret.
const U = require("../pg-util.js");
const W = 900, H = 580;
exports.create = function (ctx) {
  const rnd = ctx.rnd; const n = ctx.n; const spd = 170 * ctx.speed;
  const order = U.shuffle(ctx.players.map((m) => m.id), rnd); const murdererId = order[0]; const detId = n >= 4 ? order[1] : null;
  const pill = [[260, 180, 34], [640, 180, 34], [450, 290, 40], [260, 400, 34], [640, 400, 34], [110, 290, 28], [790, 290, 28]].map((a) => ({ x: a[0], y: a[1], r: a[2] }));
  const P = ctx.players.map((m, i) => { const a = (i / n) * Math.PI * 2; return { id: m.id, k: m.color, name: m.name, x: W / 2 + Math.cos(a) * 300, y: H / 2 + Math.sin(a) * 190, alive: true, role: m.id === murdererId ? "M" : m.id === detId ? "D" : "I", cd: 4, stun: 0, kills: 0, diedAt: -1 }; });
  const bodies = [], pings = []; let t = 0, result = null; const cap = 75 * ctx.pace; const falls = [];
  const alive = () => P.filter((p) => p.alive);
  function nearest(p, range) { let best = null, bd = range; P.forEach((q) => { if (q === p || !q.alive) return; const d = Math.hypot(q.x - p.x, q.y - p.y); if (d < bd) { bd = d; best = q; } }); return best; }
  function die(q, why) { q.alive = false; q.diedAt = t; bodies.push({ x: q.x, y: q.y, k: q.k }); pings.push({ x: q.x, y: q.y, t0: t }); falls.push([q.id]); ctx.announce(why, 3000); }
  function check() {
    const M = P.find((p) => p.role === "M");
    if (!M.alive) { result = { win: "I", by: result && result.by }; return; }
    const others = P.filter((p) => p.role !== "M" && p.alive).length;
    if (others <= 1) result = { win: "M" };
  }
  const inst = {
    done: false,
    update(dt) {
      t += dt;
      P.forEach((p) => {
        if (!p.alive) return; p.cd = Math.max(0, p.cd - dt); p.stun = Math.max(0, p.stun - dt);
        const i = ctx.input(p.id), e = ctx.edge(p.id); const [vx, vy] = U.norm2(i.x, i.y);
        if (p.stun <= 0) { p.x = U.clamp(p.x + vx * spd * dt, 40, W - 40); p.y = U.clamp(p.y + vy * spd * dt, 52, H - 40); }
        pill.forEach((c) => { const dx = p.x - c.x, dy = p.y - c.y, d = Math.hypot(dx, dy) || 0.01, m = c.r + 14; if (d < m) { p.x = c.x + dx / d * m; p.y = c.y + dy / d * m; } });
        if (e.a && p.role === "M" && p.cd <= 0) { const q = nearest(p, 58); if (q) { p.cd = 7; p.kills++; die(q, "Un cri dans la maison"); } }
        if (e.b) {
          if (p.role === "M") { ctx.announce("Le meurtrier n'a pas besoin d'accuser", 1200); }
          else { const q = nearest(p, 95); if (q) {
            if (q.role === "M") { result = { win: "I", by: p.id }; ctx.announce(p.name + " démasque " + q.name + " le meurtrier", 3200); q.alive = false; falls.push([q.id]); }
            else if (p.role === "D") { p.stun = 5; ctx.announce(p.name + " a accusé " + q.name + " à tort et reste figé", 2600); }
            else { die(p, p.name + " a accusé " + q.name + " à tort et le paie cher"); }
          } }
        }
      });
      const A = alive(); for (let i = 0; i < A.length; i++) for (let j = i + 1; j < A.length; j++) { const dx = A[j].x - A[i].x, dy = A[j].y - A[i].y, d = Math.hypot(dx, dy) || 0.01; if (d < 28) { const o = (28 - d) / 2; A[i].x -= dx / d * o; A[i].y -= dy / d * o; A[j].x += dx / d * o; A[j].y += dy / d * o; } }
      if (!result) check();
      while (pings.length && t - pings[0].t0 > 2.6) pings.shift();
      if (result) inst.done = true;
      else if (t >= cap) { const M = P.find((p) => p.role === "M"); const need = Math.ceil((n - 1) / 2); result = { win: M.kills >= need ? "M" : "I" }; ctx.announce(result.win === "M" ? "Le temps est écoulé, le meurtrier a fait assez de victimes" : "Le temps est écoulé, le meurtrier n'a pas fini son travail", 3000); inst.done = true; }
    },
    frame() {
      const items = [{ t: "rect", x: 20, y: 20, w: W - 40, h: H - 40, c: "#3a2f3f", r: 18, s: "#6b5876" }];
      pill.forEach((c) => items.push({ t: "circ", x: c.x, y: c.y, r: c.r, c: "#5a4a63", s: "#2a2230" }));
      bodies.forEach((b) => items.push({ t: "text", x: b.x, y: b.y + 8, v: "💀", s: 26 }));
      pings.forEach((p) => items.push({ t: "ring", x: p.x, y: p.y, r: 20 + (t - p.t0) * 40, c: "#ff4d4d", w: 5, a: Math.max(0, 1 - (t - p.t0) / 2.6) }));
      P.forEach((p) => { if (p.alive) items.push({ t: "pawn", id: p.id, x: p.x, y: p.y, k: p.k, n: p.name, r: 15, badge: p.role === "D" ? "🔎" : null, ring: p.stun > 0 ? "#ffffff" : null }); });
      return { w: W, h: H, bg: "#1c1522", items, hud: { title: "Trouve le meurtrier", timer: Math.max(0, cap - t), chips: [{ text: alive().length + " en vie" }] } };
    },
    priv(pid) {
      const p = P.find((x) => x.id === pid); if (!p) return null;
      const role = p.role === "M" ? { name: "Meurtrier", tip: "Frappe de près avec Espace, sans te faire repérer.", c: "#e53935" } : p.role === "D" ? { name: "Détective", tip: "Tout le monde te connaît. Accuse avec Maj ou E quand tu es sûr.", c: "#3b82f6" } : { name: "Innocent", tip: "Observe, reste en groupe, accuse seulement si tu es sûr.", c: "#34c36c" };
      return { role, dead: !p.alive, cd: p.role === "M" ? p.cd : 0, stun: p.stun };
    },
    ranking() {
      const M = P.find((p) => p.role === "M"); const win = result ? result.win : "I"; const bonus = {}, notes = {};
      if (win === "M") {
        const surv = P.filter((p) => p.role !== "M" && p.alive).map((p) => p.id); const dead = P.filter((p) => p.role !== "M" && !p.alive).sort((a, b) => b.diedAt - a.diedAt).map((p) => [p.id]);
        bonus[M.id] = Math.min(3, M.kills); notes[M.id] = "meurtrier, " + M.kills + " victime" + (M.kills > 1 ? "s" : "");
        return { groups: [[M.id]].concat(surv.length ? [surv] : []).concat(dead), bonus, notes };
      }
      const surv = P.filter((p) => p.role !== "M" && p.alive).map((p) => p.id); const dead = P.filter((p) => p.role !== "M" && !p.alive).sort((a, b) => b.diedAt - a.diedAt).map((p) => [p.id]);
      if (result && result.by) { bonus[result.by] = 3; notes[result.by] = "a démasqué le meurtrier"; }
      notes[M.id] = "était le meurtrier";
      return { groups: (surv.length ? [surv] : []).concat(dead).concat([[M.id]]), bonus, notes };
    },
  };
  return inst;
};

// Cagnotte qui grimpe. Encaisser avant l'explosion, ou tout perdre.
const U = require("../pg-util.js");
exports.create = function (ctx) {
  const rnd = ctx.rnd; const COUPS = Math.max(3, Math.round(5 * (ctx.pace > 1.2 ? 1.2 : ctx.pace < 0.8 ? 0.8 : 1)));
  const P = ctx.players.map((m) => ({ id: m.id, k: m.color, name: m.name, total: 0, cash: null, gain: 0 }));
  let coup = 0, t = 0, crashAt = 0, phase = "run", hold = 0, boomed = false;
  const mult = (x) => 1 + 0.4 * x + 0.07 * x * x;
  function begin() { coup++; t = 0; phase = "run"; const u = rnd(); crashAt = Math.min(11, 1.4 + -Math.log(1 - u) * 3.2) / ctx.speed; P.forEach((p) => { p.cash = null; p.gain = 0; }); boomed = false; }
  begin();
  function cash(p) { if (p.cash != null || phase !== "run") return; p.cash = mult(t * ctx.speed); p.gain = Math.round(p.cash * 10); p.total += p.gain; ctx.announce(p.name + " encaisse à x" + p.cash.toFixed(2).replace(".", ","), 1800); }
  const inst = {
    done: false,
    update(dt) {
      if (phase === "run") {
        t += dt; P.forEach((p) => { if (p.cash == null) { const e = ctx.edge(p.id); if (e.a) cash(p); } });
        if (t >= crashAt) { phase = "boom"; hold = 2.4; boomed = true; ctx.announce("Boum, la cagnotte explose", 1800); }
        else if (P.every((p) => p.cash != null || !ctx.present(p.id))) { phase = "boom"; hold = 1.8; }
      } else { hold -= dt; if (hold <= 0) { if (coup >= COUPS) inst.done = true; else begin(); } }
    },
    frame() {
      const m = mult(Math.min(t, crashAt) * ctx.speed); const items = []; const boom = phase === "boom" && boomed;
      items.push({ t: "text", x: 360, y: 150, v: boom ? "💥" : "💰", s: 90 });
      items.push({ t: "text", x: 360, y: 250, v: boom ? "BOUM" : "x" + m.toFixed(2).replace(".", ","), c: boom ? "#ff5a5a" : "#ffd23b", s: 64 });
      P.forEach((p, i) => { const col = i % 4, row = Math.floor(i / 4); items.push({ t: "pawn", id: p.id, x: 90 + col * 180, y: 350 + row * 90, k: p.k, n: p.name, r: 20, ok: p.cash != null ? 1 : 0 }); items.push({ t: "text", x: 90 + col * 180, y: 392 + row * 90, v: p.cash != null ? "x" + p.cash.toFixed(2).replace(".", ",") + " = " + p.gain : phase === "boom" ? "0" : "...", c: p.cash != null ? "#7dff9a" : "#ff9a9a", s: 18 }); });
      return { w: 720, h: 560, bg: "#2a1b3d", items, hud: { title: "Coup " + coup + " sur " + COUPS + ", encaisse avant l'explosion", chips: [{ text: P.filter((p) => p.cash == null && phase === "run").length + " pas encore encaissé" }] } };
    },
    priv(pid) { const p = P.find((x) => x.id === pid); if (!p) return null; return { total: p.total, ui: phase === "run" && p.cash == null ? { groups: [], lock: { id: "cash", t: "Encaisser", dis: false } } : null, scores: P.map((q) => ({ id: q.id, name: q.name, total: q.total })) }; },
    onAct(pid, m) { const p = P.find((x) => x.id === pid); if (p && (m.type === "click" || (m.type === "btn" && m.id === "cash"))) cash(p); },
    ranking() { const sorted = P.slice().sort((a, b) => b.total - a.total); const groups = []; sorted.forEach((p) => { const last = groups[groups.length - 1]; if (last && P.find((x) => x.id === last[0]).total === p.total) last.push(p.id); else groups.push([p.id]); }); const notes = {}; P.forEach((p) => { notes[p.id] = p.total + " pièces"; }); return { groups, bonus: {}, notes }; },
  };
  return inst;
};

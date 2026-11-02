// Chrono aveugle. Un temps cible est annoncé, le chronomètre part, puis s'éteint. Arrête le au moment où tu penses avoir atteint la cible.
// Plus on avance dans les manches, plus vite le chrono disparaît. À la dernière il est invisible dès le départ. Le plus petit écart total gagne.
const U = require("../pg-util.js");

exports.create = function (ctx) {
  const rnd = ctx.rnd; const ROUNDS = Math.max(3, Math.round(4 * (ctx.len < 0.8 ? 0.75 : ctx.len > 1.2 ? 1.25 : 1)));
  const P = ctx.players.map((m) => ({ id: m.id, k: m.color, name: m.name, stop: null, err: 0, errs: [], total: 0, ex: {} }));
  let round = 0, phase = "pre", left = 2.4, clock = 0, target = 5, hideAt = 2, shown = []; const fmt = (v) => v.toFixed(2).replace(".", ",");
  const FR = [0.55, 0.38, 0.22, 0.12, 0.05];
  function newRound() {
    round++; phase = "run"; clock = 0; target = Math.round((4 + rnd() * 5.5) * 10) / 10; const f = round >= ROUNDS ? 0 : FR[Math.min(FR.length - 1, round - 1)]; hideAt = Math.round(target * f * 10) / 10;
    P.forEach((p) => { p.stop = null; const sk = ctx.skill(p.id); p.ex.aim = target + (rnd() + rnd() + rnd() - 1.5) * (0.9 - 0.55 * sk) * (0.5 + target / 8) * 1.1 + (rnd() < 0.5 ? 1 : -1) * 0.05; p.ex.aim = Math.max(0.5, p.ex.aim); });
    ctx.announce(round === ROUNDS ? "Dernière manche, chrono invisible dès le départ" : "Arrête le chrono à " + target.toFixed(1).replace(".", ",") + " s", 2200); ctx.snd("count");
  }
  function stop(p) { if (phase !== "run" || p.stop != null) return; p.stop = clock; ctx.snd("coin"); }
  function settle() { P.forEach((p) => { const e = p.stop == null ? 9.99 : Math.abs(p.stop - target); p.err = e; p.errs.push(e); p.total += e; }); phase = "show"; left = 4.6; ctx.snd("reveal"); const best = P.slice().sort((a, b) => a.err - b.err)[0]; if (best && best.stop != null) { ctx.announce(best.name + " est le plus proche, " + fmt(best.err) + " s d'écart", 2400); if (best.err < 0.1) ctx.fx("confetti", 450, 250, 40, ""); } }
  const inst = {
    done: false,
    update(dt) {
      if (phase === "pre") { left -= dt; if (left <= 0) newRound(); return; }
      if (phase === "run") {
        clock += dt; P.forEach((p) => { if (p.stop == null) { if (ctx.isBot(p.id)) { if (clock >= p.ex.aim) stop(p); } else if (ctx.edge(p.id).a) stop(p); else if (!ctx.present(p.id) && clock > 2) stop(p); } });
        if (P.every((p) => p.stop != null) || clock > target + 6) settle();
      } else if (phase === "show") { left -= dt; if (left <= 0) { if (round >= ROUNDS) inst.done = true; else newRound(); } }
    },
    frame() {
      const items = []; const vis = phase === "run" && clock < hideAt;
      items.push({ t: "text", x: 360, y: 90, v: phase === "pre" ? "Prêts ?" : "Cible " + target.toFixed(1).replace(".", ",") + " s", c: "#ffd23b", s: 54 });
      items.push({ t: "text", x: 360, y: 190, v: phase === "run" ? (vis ? clock.toFixed(1).replace(".", ",") : "?") : phase === "show" ? "Résultat" : "", c: vis ? "#ffffff" : "#8a7ab8", s: 84 });
      if (phase === "run") items.push({ t: "text", x: 360, y: 235, v: vis ? "Le chrono va s'éteindre à " + hideAt.toFixed(1).replace(".", ",") + " s" : hideAt > 0 ? "Chrono éteint, compte dans ta tête" : "Chrono invisible", c: "#c8b8e8", s: 20 });
      const rows = P.slice(); rows.sort((a, b) => (phase === "show" ? a.err - b.err : a.total - b.total));
      rows.forEach((p, i) => { const y = 290 + i * 34; const st = phase === "show" ? (p.stop == null ? "trop tard" : fmt(p.stop) + " s, écart " + fmt(p.err)) : p.stop != null ? "a arrêté" : "..."; items.push({ t: "box", x: 360, y: y - 6, z: 0, w: 640, d: 30, h: 0, c: p.stop != null ? "#3a2a5a" : "#2a1f42", a: 0.9 }); items.push({ t: "pawn", id: p.id, x: 80, y: y + 2, z: 0, k: p.k, n: "", s: 0.5 }); items.push({ t: "text", x: 200, y: y + 2, v: p.name, c: "#fff", s: 18 }); items.push({ t: "text", x: 430, y: y + 2, v: st, c: phase === "show" && i === 0 && p.stop != null ? "#9be37a" : "#e8def8", s: 17 }); items.push({ t: "text", x: 620, y: y + 2, v: "total " + fmt(Math.min(99, p.total)), c: "#ffd23b", s: 16 }); });
      return { w: 720, h: Math.max(560, 310 + P.length * 34), bg: "#1d1233", items, hud: { title: "Manche " + Math.max(1, round) + " sur " + ROUNDS + ", le plus petit écart total gagne", chips: [{ text: P.filter((p) => p.stop != null).length + " sur " + P.length + " ont arrêté" }] } };
    },
    priv(pid) { const p = P.find((x) => x.id === pid); if (!p) return null; return { ui: phase === "run" && p.stop == null ? { groups: [], lock: { id: "stop", t: "Stop", dis: false } } : null, why: phase === "show" && p.stop != null ? "Tu as arrêté à " + fmt(p.stop) + " s pour une cible de " + target.toFixed(1).replace(".", ",") + " s" : "" }; },
    onAct(pid, m) { const p = P.find((x) => x.id === pid); if (p && (m.type === "click" || (m.type === "btn" && m.id === "stop"))) stop(p); },
    ranking() {
      const groups = U.rankByScore(P, (p) => p.total, true, 0.02); const bonus = {}, notes = {}; let bp = null; P.forEach((p) => p.errs.forEach((e) => { if (p.errs.length && e < 0.08 && (!bp || e < bp.e)) bp = { id: p.id, e }; })); if (bp) bonus[bp.id] = 1;
      P.forEach((p) => { notes[p.id] = "écart total " + fmt(Math.min(99, p.total)) + " s" + (bp && bp.id === p.id ? ", presque pile" : ""); });
      return { groups, bonus, notes, headline: "⏱️ " + P.find((p) => p.id === groups[0][0]).name + " a le meilleur sens du temps" };
    },
  };
  return inst;
};

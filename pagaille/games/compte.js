// Le bon compte. Un tableau d'images s'affiche quelques secondes puis disparaît, une question arrive.
// Combien d'un même dessin, lequel a disparu, lequel était le plus nombreux, où était l'étoile. Le plus rapide à répondre juste prend le plus de points.
const U = require("../pg-util.js");

const POOLS = [["🍎", "🍌", "🍇", "🍓", "🍒", "🍋", "🥝", "🍑", "🍍", "🥕"], ["🐶", "🐱", "🐭", "🐹", "🐰", "🦊", "🐻", "🐼", "🐸", "🐵"], ["⚽", "🏀", "🎾", "🏐", "🏈", "🎱", "🥎", "🏓", "⚾", "🎳"], ["🚗", "🚕", "🚌", "🚑", "🚒", "🚓", "🚜", "🚲", "🛵", "🚀"]];
const COLS = 8, ROWS = 5, X0 = 90, Y0 = 130, DX = 77, DY = 72;
const QUAD = ["En haut à gauche", "En haut à droite", "En bas à gauche", "En bas à droite"];
exports.create = function (ctx) {
  const rnd = ctx.rnd; const ROUNDS = Math.max(4, Math.round(5 * (ctx.len < 0.8 ? 0.75 : ctx.len > 1.2 ? 1.2 : 1))); const ANS_T = 9 * ctx.pace; const SHOW_T = 3.8 * ctx.pace;
  const P = ctx.players.map((m) => ({ id: m.id, k: m.color, name: m.name, score: 0, pick: null, at: 0, gain: 0, right: 0, ex: {} }));
  let round = 0, phase = "pre", left = 2.4, q = null, clock = 0; const kinds = U.shuffle(["count", "missing", "most", "star", "count", "missing", "most", "star"], rnd);
  const cellXY = (c) => ({ x: X0 + (c % COLS) * DX, y: Y0 + Math.floor(c / COLS) * DY });
  function cells(k) { return U.shuffle(Array.from({ length: COLS * ROWS }, (_, i) => i), rnd).slice(0, k); }
  function make(kind) {
    const pool = U.shuffle(U.pick(POOLS, rnd).slice(), rnd);
    if (kind === "count") { const c = 2 + Math.floor(rnd() * 7); const target = pool[0]; const others = pool.slice(1, 4); const total = 22 + Math.floor(rnd() * 6); const cs = cells(total); const show = cs.map((cell, i) => ({ cell, e: i < c ? target : others[i % others.length] })); const opts = new Set([c]); [1, -1, 2, -2, 3].forEach((d) => { if (opts.size < 4 && c + d >= 1 && rnd() < 0.8) opts.add(c + d); }); for (let v = 1; opts.size < 4; v++) opts.add(v + c + 3); const o = U.shuffle([...opts], rnd); return { kind, show, text: "Combien y avait-il de " + target + " ?", opts: o.map(String), good: o.indexOf(c), icon: target }; }
    if (kind === "missing") { const set = pool.slice(0, 6 + Math.floor(rnd() * 2)); const cs = cells(set.length); const show = cs.map((cell, i) => ({ cell, e: set[i] })); const gone = Math.floor(rnd() * set.length); const rest = pool.slice(set.length); const opts = U.shuffle([set[gone]].concat(rest.slice(0, 3).concat(rest.length < 3 ? set.filter((_, i) => i !== gone).slice(0, 3 - rest.length) : [])), rnd); return { kind, show, after: show.filter((_, i) => i !== gone), text: "Quel dessin a disparu ?", opts, good: opts.indexOf(set[gone]) }; }
    if (kind === "most") { const types = pool.slice(0, 4); const cnt = U.shuffle([9, 6, 4, 2], rnd); const items = []; types.forEach((e, i) => { for (let j = 0; j < cnt[i]; j++) items.push(e); }); const cs = cells(items.length); const show = U.shuffle(items, rnd).map((e, i) => ({ cell: cs[i], e })); const best = cnt.indexOf(9); const opts = U.shuffle(types, rnd); return { kind, show, text: "Quel dessin était le plus nombreux ?", opts, good: opts.indexOf(types[best]) }; }
    const cs = cells(14); const okS = cs.map((c, i) => i).filter((i) => Math.floor(cs[i] / COLS) !== 2); const star = okS[Math.floor(rnd() * okS.length)]; const show = cs.map((cell, i) => ({ cell, e: i === star ? "⭐" : pool[i % 6] })); const sc = cellXY(cs[star]); const qd = (sc.x < X0 + (COLS - 1) * DX / 2 ? 0 : 1) + (sc.y < Y0 + (ROWS - 1) * DY / 2 ? 0 : 2);
    // on évite une étoile pile sur la frontière entre deux quarts
    return { kind: "star", show, text: "Dans quel quart de l'écran était l'étoile ?", opts: QUAD, good: qd, star: cs[star], icon: "⭐" };
  }
  function newRound() { round++; q = make(kinds[(round - 1) % kinds.length]); P.forEach((p) => { p.pick = null; p.gain = 0; p.ex.t = null; }); phase = "show"; left = q.kind === "star" ? 2.4 * ctx.pace : SHOW_T; ctx.announce("Observe bien", 1200); ctx.snd("count"); }
  function answer(p, i) { if (phase !== "ask" || p.pick != null || i < 0 || i >= q.opts.length) return; p.pick = i; p.at = clock; ctx.snd("vote"); if (i === q.good) { p.gain = Math.round(60 + 40 * Math.max(0, 1 - clock / ANS_T)); p.score += p.gain; p.right++; } }
  function settle() { phase = "reveal"; left = 3.4; const first = P.filter((p) => p.pick === q.good).sort((a, b) => a.at - b.at)[0]; ctx.snd(first ? "reveal" : "lose"); if (first) ctx.announce(first.name + " est le plus rapide", 1800); else ctx.announce("Personne n'a trouvé", 1800); }
  const inst = {
    done: false,
    update(dt) {
      if (phase === "pre") { left -= dt; if (left <= 0) newRound(); return; }
      left -= dt;
      if (phase === "show" && left <= 0) { phase = "hide"; left = 0.9; }
      else if (phase === "hide" && left <= 0) { phase = "ask"; clock = 0; ctx.snd("go"); P.forEach((p) => { const sk = ctx.skill(p.id); const hard = q.kind === "count" ? 0.12 : q.kind === "star" ? 0.05 : 0; const right = rnd() < 0.5 + 0.45 * sk - hard; p.ex.t = 1.4 + rnd() * 4.2 * (1.15 - sk * 0.6); p.ex.i = right ? q.good : (q.good + 1 + Math.floor(rnd() * (q.opts.length - 1))) % q.opts.length; }); }
      else if (phase === "ask") {
        clock += dt; P.forEach((p) => { if (p.pick == null && ctx.isBot(p.id) && clock >= p.ex.t) answer(p, p.ex.i); });
        if (P.every((p) => p.pick != null || !ctx.present(p.id)) || clock >= ANS_T) settle();
      } else if (phase === "reveal" && left <= 0) { if (round >= ROUNDS) inst.done = true; else newRound(); }
    },
    frame() {
      const items = []; if (q && (phase === "show" || (q.after && (phase === "ask" || phase === "reveal")))) (phase === "show" ? q.show : q.after).forEach((it) => { const c = cellXY(it.cell); items.push({ t: "text", x: c.x, y: c.y + 14, v: it.e, s: 44 }); });
      if (q && phase === "reveal" && !q.after) { if (q.kind === "star") { const c = cellXY(q.star); items.push({ t: "text", x: c.x, y: c.y + 14, v: "⭐", s: 54 }); } else q.show.forEach((it) => { const c = cellXY(it.cell); items.push({ t: "text", x: c.x, y: c.y + 14, v: it.e, s: 38 }); }); }
      if (q && phase === "reveal" && q.after) { const gone = q.show.find((it) => !q.after.includes(it)); if (gone) { const c = cellXY(gone.cell); items.push({ t: "ring", x: c.x, y: c.y, r: 36, c: "#7ed957", w: 5 }); } }
      if (phase === "ask" && q.kind === "star") { items.push({ t: "box", x: X0 + (COLS - 1) * DX / 2, y: Y0 + (ROWS - 1) * DY / 2, z: 0, w: 4, d: 360, h: 0, c: "#ffffff", a: 0.25 }, { t: "box", x: X0 + (COLS - 1) * DX / 2, y: Y0 + (ROWS - 1) * DY / 2, z: 0, w: 640, d: 4, h: 0, c: "#ffffff", a: 0.25 }); }
      items.push({ t: "text", x: 360, y: 70, v: phase === "pre" ? "Prépare tes yeux" : phase === "show" ? "Observe bien" : phase === "hide" ? "Tout disparaît" : q.text, c: "#ffd23b", s: phase === "ask" || phase === "reveal" ? 30 : 38 });
      if (phase === "ask") items.push({ t: "text", x: 360, y: 108, v: "Il te reste " + Math.max(0, Math.ceil(ANS_T - clock)) + " s", c: "#c8b8e8", s: 18 });
      if (phase === "reveal") items.push({ t: "text", x: 360, y: 108, v: "Réponse, " + (q.kind === "star" ? q.opts[q.good] : q.opts[q.good]), c: "#9be37a", s: 24 });
      const rows = P.slice().sort((a, b) => b.score - a.score); rows.forEach((p, i) => { const col = i % 4, row = Math.floor(i / 4); const x = 90 + col * 180, y = 520 + row * 40; items.push({ t: "text", x, y, v: p.name + " " + p.score, c: phase === "reveal" && p.pick === q.good ? "#9be37a" : phase === "ask" && p.pick != null ? "#ffd23b" : "#e8def8", s: 17 }); if (phase === "reveal" && p.gain) items.push({ t: "text", x, y: y + 18, v: "+" + p.gain, c: "#9be37a", s: 14 }); });
      return { w: 720, h: 600, bg: "#142a3a", items, hud: { title: "Question " + Math.max(1, round) + " sur " + ROUNDS, chips: [{ text: phase === "ask" ? P.filter((p) => p.pick != null).length + " sur " + P.length + " ont répondu" : "Mémoire et coup d'oeil" }] } };
    },
    priv(pid) {
      const p = P.find((x) => x.id === pid); if (!p) return null;
      if (phase === "ask") return { ui: { title: q.text, groups: [{ label: p.pick == null ? "Choisis vite, plus tu es rapide plus tu gagnes" : "Réponse enregistrée", btns: q.opts.map((o, i) => ({ id: "a" + i, t: String(o), sel: p.pick === i, dis: p.pick != null })) }] } };
      if (phase === "reveal") return { why: p.pick == null ? "Tu n'as pas répondu" : p.pick === q.good ? "Bonne réponse, plus " + p.gain + " points" : "Raté, c'était " + q.opts[q.good] };
      return { ui: null };
    },
    onAct(pid, m) { const p = P.find((x) => x.id === pid); if (!p || m.type !== "btn") return; const mm = /^a(\d)$/.exec(m.id || ""); if (mm) answer(p, Number(mm[1])); },
    ranking() {
      const groups = U.rankByScore(P, (p) => p.score, false, 0); const bonus = {}, notes = {}; const top = P.slice().sort((a, b) => b.right - a.right)[0]; if (top && top.right === ROUNDS) bonus[top.id] = 2;
      P.forEach((p) => { notes[p.id] = p.right + " bonne" + (p.right > 1 ? "s" : "") + " réponse" + (p.right > 1 ? "s" : "") + " sur " + ROUNDS + ", " + p.score + " points"; });
      return { groups, bonus, notes, headline: "👀 " + P.find((p) => p.id === groups[0][0]).name + " a l'oeil le plus vif" };
    },
  };
  return inst;
};

// Course des cases. Un plateau en serpent, tout le monde joue une carte de 1 à 6 en secret et en même temps.
// Les cartes identiques se percutent et personne ne bouge. Les autres avancent du nombre joué. Chaque carte ne sert qu'une fois, puis la main se refait.
// Des cases changent la donne, un élan en avant, un piège en arrière et un échange avec le premier. La première pièce arrivée gagne.
const U = require("../pg-util.js");

const LEN = 20, MAXT = 8; const BOOST = [4, 10, 15], TRAP = [7, 13, 18], SWAP = [11];
const CX = (i) => { const r = Math.floor(i / 8), c = i % 8; return 120 + (r % 2 === 0 ? c : 7 - c) * 96; };
const CY = (i) => 150 + Math.floor(i / 8) * 130;
exports.create = function (ctx) {
  const rnd = ctx.rnd; const TURN_T = 10 * ctx.pace;
  const P = ctx.players.map((m) => ({ id: m.id, k: m.color, name: m.name, pos: 0, hand: [1, 2, 3, 4, 5, 6], pick: null, lock: false, clash: 0, moved: 0, last: null, said: "", ex: {} }));
  let turn = 0, phase = "pre", left = 2.5; const log = [];
  const cellKind = (i) => (BOOST.includes(i) ? "boost" : TRAP.includes(i) ? "trap" : SWAP.includes(i) ? "swap" : "");
  function newTurn() { turn++; phase = "pick"; left = TURN_T; P.forEach((p) => { if (!p.hand.length) p.hand = [1, 2, 3, 4, 5, 6]; p.pick = null; p.lock = false; p.last = null; p.said = ""; p.ex.bt = 1.5 + rnd() * 4.5 * (1.15 - ctx.skill(p.id) * 0.7); }); ctx.announce("Tour " + turn + ", choisis ta carte en secret", 1500); ctx.snd("count"); }
  // les bots estiment les chances de percuter quelqu'un et préfèrent les bonnes cases
  function botPick(p) {
    const sk = ctx.skill(p.id); const foes = P.filter((q) => q !== p); const vals = [];
    p.hand.forEach((v) => {
      let uniq = 1; foes.forEach((q) => { if (q.hand.includes(v)) uniq *= 1 - (1 / Math.max(1, q.hand.length)) * (0.4 + 0.6 * sk); });
      const tgt = Math.min(LEN, p.pos + v); const k = cellKind(tgt); let gain = v + (k === "boost" ? 2 : k === "trap" ? -3.5 : k === "swap" ? ((P.slice().sort((a, b) => b.pos - a.pos)[0].pos - tgt) * 0.6) : 0);
      if (tgt >= LEN) gain += 12;
      const leader = foes.reduce((m, q) => Math.max(m, q.pos), 0); if (leader >= LEN - 7 && p.pos < leader) gain += v * 0.4; // il faut rattraper
      vals.push({ v, val: gain * uniq });
    });
    // tirage pondéré, un bon bot choisit presque toujours le meilleur mais varie, sinon tous les bots joueraient la même carte
    const T = 2.4 - sk * 1.2; const mx = Math.max.apply(null, vals.map((x) => x.val)); const w = vals.map((x) => Math.exp((x.val - mx) / T)); let r = rnd() * w.reduce((a, b) => a + b, 0);
    for (let i = 0; i < vals.length; i++) { r -= w[i]; if (r <= 0) return vals[i].v; } return vals[vals.length - 1].v;
  }
  function play(p, v) { if (phase !== "pick" || p.lock || !p.hand.includes(v)) return; p.pick = v; ctx.snd("tick"); }
  function reveal() {
    P.forEach((p) => { if (p.pick == null || !p.hand.includes(p.pick)) p.pick = p.hand[Math.floor(rnd() * p.hand.length)]; p.last = p.pick; p.hand.splice(p.hand.indexOf(p.pick), 1); });
    const cnt = {}; P.forEach((p) => { cnt[p.pick] = (cnt[p.pick] || 0) + 1; });
    P.forEach((p) => { if (cnt[p.pick] > 1) { p.clash++; p.said = "Percuté"; p.ex.moved = 0; } else p.ex.moved = p.pick; });
    P.forEach((p) => { p.pos = Math.min(LEN, p.pos + p.ex.moved); p.moved += p.ex.moved; });
    // cases spéciales, résolues dans l'ordre des joueurs les plus avancés
    P.slice().sort((a, b) => b.pos - a.pos).forEach((p) => {
      if (p.ex.moved === 0 || p.pos >= LEN) return; const k = cellKind(p.pos);
      if (k === "boost") { p.pos = Math.min(LEN, p.pos + 2); p.said = "Élan, deux cases de plus"; ctx.fx("confetti", CX(p.pos), CY(p.pos), 30, ""); }
      else if (k === "trap") { p.pos = Math.max(0, p.pos - 3); p.said = "Piège, trois cases en arrière"; ctx.snd("lose"); }
      else if (k === "swap") { const lead = P.filter((q) => q !== p).sort((a, b) => b.pos - a.pos)[0]; if (lead && lead.pos > p.pos) { const tmp = p.pos; p.pos = lead.pos; lead.pos = tmp; p.said = "Échange avec " + lead.name; lead.said = "Échangé par " + p.name; ctx.snd("reveal"); } else p.said = "Échange, mais tu es déjà devant"; }
    });
    phase = "reveal"; left = 3.2; ctx.snd("coin");
    const cl = P.filter((p) => p.clash && p.said === "Percuté").length; if (cl) ctx.announce(cl + " joueur" + (cl > 1 ? "s" : "") + " se sont percutés", 1700);
  }
  const inst = {
    done: false,
    update(dt) {
      left -= dt;
      if (phase === "pre") { if (left <= 0) newTurn(); }
      else if (phase === "pick") {
        P.forEach((p) => { if (p.lock) return; if (ctx.isBot(p.id)) { p.ex.bt -= dt; if (p.ex.bt <= 0) { play(p, botPick(p)); p.lock = true; } } else if (!ctx.present(p.id)) { p.lock = true; } else if (p.pick != null && ctx.edge(p.id).a) { p.lock = true; ctx.snd("coin"); } });
        if (left <= 0 || P.every((p) => p.lock)) reveal();
      } else if (phase === "reveal" && left <= 0) { if (P.some((p) => p.pos >= LEN) || turn >= MAXT) inst.done = true; else newTurn(); }
    },
    frame() {
      const items = [];
      for (let i = 0; i <= LEN; i++) { const k = i === LEN ? "end" : cellKind(i); if (i === 0) continue; items.push({ t: "box", x: CX(i - 1), y: CY(i - 1), z: 0, w: 88, d: 88, h: 0, c: i === LEN ? "#ffd23b" : k === "boost" ? "#2fbf71" : k === "trap" ? "#c0392b" : k === "swap" ? "#8e5bd9" : "#34506e", lab: i === LEN ? "🏁" : k === "boost" ? "+2" : k === "trap" ? "-3" : k === "swap" ? "↔" : String(i), lc: "rgba(255,255,255,.55)" }); }
            items.push({ t: "text", x: 35, y: CY(0) + 72, v: "Départ", c: "#c8e0ff", s: 16 });
      const groups = {}; P.forEach((p) => { (groups[p.pos] = groups[p.pos] || []).push(p); });
      Object.keys(groups).forEach((k) => { const g = groups[k]; const pos = Number(k); const bx = pos === 0 ? 40 : CX(pos - 1), by = pos === 0 ? CY(0) : CY(pos - 1); g.forEach((p, i) => { const ox = (i % 3 - (Math.min(3, g.length) - 1) / 2) * 26, oy = Math.floor(i / 3) * 24 - 6; items.push({ t: "pawn", id: p.id, x: bx + ox, y: by + oy + 16, z: 0, k: p.k, n: p.name, st: p.pos >= LEN ? "win" : "" }); if (phase === "reveal" && p.last != null) items.push({ t: "text", x: bx + ox, y: by + oy - 28, v: (p.said === "Percuté" ? "✖ " : "") + p.last, c: p.said === "Percuté" ? "#ff6a6a" : "#ffd23b", s: 22 }); }); });
      items.push({ t: "text", x: 450, y: 70, v: phase === "pick" ? "Choisis ta carte en secret" : phase === "reveal" ? "Voici les cartes" : "La course des cases", c: "#fff3c8", s: 30 });
      items.push({ t: "text", x: 450, y: 515, v: "Cartes identiques, personne ne bouge. Vert, élan. Rouge, piège. Violet, échange avec le premier.", c: "#b8c8e0", s: 15 });
      const say = P.filter((p) => phase === "reveal" && p.said && p.said !== "Percuté"); say.forEach((p, i) => items.push({ t: "text", x: 450, y: 545 + i * 20, v: p.name + " " + p.said.charAt(0).toLowerCase() + p.said.slice(1), c: "#ffe9a0", s: 16 }));
      return { w: 900, h: 580 + Math.max(0, say.length - 1) * 20, bg: "#16253a", items, hud: { title: "Tour " + Math.max(1, turn) + " sur " + MAXT + " au plus, première pièce à l'arrivée", timer: phase === "pick" ? left : null, chips: [{ text: phase === "pick" ? P.filter((p) => p.lock).length + " sur " + P.length + " ont validé" : "Arrivée case " + LEN }] } };
    },
    priv(pid) {
      const p = P.find((x) => x.id === pid); if (!p) return null;
      if (phase !== "pick") return { ui: null, why: phase === "reveal" && p.last != null ? (p.said === "Percuté" ? "Tu as joué " + p.last + ", mais quelqu'un a joué la même carte" : "Tu avances de " + p.last) : "" };
      return { ui: { title: "Ta main, une carte par tour", groups: [{ label: p.lock ? "Carte validée" : p.pick == null ? "Choisis une carte puis valide" : "Carte choisie, tu peux encore changer", btns: [1, 2, 3, 4, 5, 6].map((v) => ({ id: "c" + v, t: String(v), sel: p.pick === v, dis: p.lock || !p.hand.includes(v) })) }], lock: { id: "ok", t: p.lock ? "Validée" : "Valider", dis: p.lock || p.pick == null } } };
    },
    onAct(pid, m) { const p = P.find((x) => x.id === pid); if (!p || phase !== "pick" || p.lock || m.type !== "btn") return; if (m.id === "ok") { if (p.pick != null) { p.lock = true; ctx.snd("coin"); } return; } const mm = /^c([1-6])$/.exec(m.id || ""); if (mm) play(p, Number(mm[1])); },
    ranking() {
      const groups = U.rankByScore(P, (p) => p.pos, false, 0); const bonus = {}, notes = {}; const sm = P.slice().sort((a, b) => a.clash - b.clash)[0]; if (sm && sm.clash === 0 && turn >= 4) bonus[sm.id] = 1;
      P.forEach((p) => { notes[p.id] = p.pos >= LEN ? "Arrivé en " + turn + " tours" : "Case " + p.pos; notes[p.id] += ", " + p.clash + " percussion" + (p.clash > 1 ? "s" : ""); });
      return { groups, bonus, notes, headline: "🎲 " + P.find((p) => p.id === groups[0][0]).name + " gagne la course des cases" };
    },
  };
  return inst;
};

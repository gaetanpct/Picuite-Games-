// Tir à la corde en rythme. Deux équipes tirées au hasard, une corde au milieu et un battement qui revient sans cesse.
// On tire en appuyant pile quand le cercle touche l'anneau. Un coup parfait tire fort, un coup à côté essouffle.
// Chaque équipe a la même force quel que soit son nombre de joueurs. La première équipe à gagner deux manches l'emporte.
const U = require("../pg-util.js");

const TEAMS = [{ n: "Orange", c: "#ff8a1f" }, { n: "Bleue", c: "#3b9bff" }];
const BEAT = 0.8, GOOD = 0.17, PERFECT = 0.075;
exports.create = function (ctx) {
  const rnd = ctx.rnd; const n = ctx.n; const WIN = Math.max(1, Math.round(2 * (ctx.len < 0.8 ? 0.6 : 1)));
  const tm = U.randomTeams(ctx.players.map((m) => m.id), 2, rnd);
  const P = ctx.players.map((m) => ({ id: m.id, k: m.color, name: m.name, team: tm[0].includes(m.id) ? 0 : 1, tired: 0, cd: 0, good: 0, perfect: 0, miss: 0, flash: "", flashT: 0, ex: {} }));
  const size = [P.filter((p) => p.team === 0).length, P.filter((p) => p.team === 1).length];
  let pos = 0, vel = 0, t = 0, phase = "pre", left = 2.8, roundT = 0, wins = [0, 0], rounds = 0, lastWin = -1; const ROUND_MAX = 20 * ctx.pace;
  const bphase = () => (t % BEAT);
  function offBeat() { const b = bphase(); return Math.min(b, BEAT - b); }
  function pull(p) {
    if (phase !== "play" || p.tired > 0 || p.cd > 0) return; p.cd = 0.16; const o = offBeat();
    let q = 0;
    if (o <= PERFECT) { q = 1.5; p.perfect++; p.good++; p.flash = "Parfait"; ctx.snd("pass"); } else if (o <= GOOD) { q = 1; p.good++; p.flash = "Bien"; ctx.snd("tick"); } else { p.tired = 0.55; p.miss++; p.flash = "Raté"; p.flashT = 0.6; ctx.snd("lose"); p.flashT = 0.6; return; }
    p.flashT = 0.5; const dir = p.team === 0 ? -1 : 1; vel += dir * q * (2.6 / size[p.team]) * 0.9;
  }
  function begin() { rounds++; pos = 0; vel = 0; roundT = 0; phase = "pre"; left = 2.4; P.forEach((p) => { p.tired = 0; p.cd = 0; }); ctx.announce(rounds === 1 ? "Orange à gauche, Bleue à droite" : "Manche " + rounds, 1600); ctx.snd("count"); }
  begin(); left = 3.2;
  function botTick(p, dt) {
    const sk = ctx.skill(p.id); const ex = p.ex; ex.cool = (ex.cool || 0) - dt;
    // le bot vise le prochain battement avec une petite erreur selon son niveau
    if (ex.target == null || t > ex.target + 0.3) { const nb = Math.ceil(t / BEAT) * BEAT; const skip = rnd() < 0.22 * (1 - sk); ex.target = nb + (skip ? BEAT : 0) + (rnd() + rnd() + rnd() - 1.5) * (0.2 - 0.14 * sk); }
    if (t >= ex.target && ex.target != null) { pull(p); ex.target = null; }
  }
  const inst = {
    done: false,
    update(dt) {
      t += dt; P.forEach((p) => { p.tired = Math.max(0, p.tired - dt); p.cd = Math.max(0, p.cd - dt); p.flashT = Math.max(0, p.flashT - dt); });
      if (phase === "pre") { left -= dt; if (left <= 0) { phase = "play"; ctx.announce("Tirez", 1000); ctx.snd("go"); } return; }
      if (phase === "play") {
        roundT += dt; P.forEach((p) => { if (ctx.isBot(p.id)) botTick(p, dt); else if (ctx.edge(p.id).a) pull(p); });
        vel *= Math.pow(0.12, dt); vel -= pos * 0.35 * dt * 0.0; pos += vel * dt * 0.33; pos = U.clamp(pos, -1.02, 1.02);
        // un petit retour vers le centre quand personne ne tire garde la corde vivante
        pos *= 1 - 0.05 * dt;
        let w = -1; if (pos <= -1) w = 0; else if (pos >= 1) w = 1; else if (roundT > ROUND_MAX) w = pos < -0.02 ? 0 : pos > 0.02 ? 1 : (rnd() < 0.5 ? 0 : 1);
        if (w >= 0) { wins[w]++; lastWin = w; phase = "end"; left = 2.6; ctx.announce("L'équipe " + TEAMS[w].n + " gagne la manche", 2000); ctx.snd("win"); ctx.shake(1.2); }
      } else if (phase === "end") { left -= dt; if (left <= 0) { if (wins[0] >= WIN || wins[1] >= WIN) inst.done = true; else begin(); } }
    },
    frame() {
      const items = []; const X0 = 450, SPAN = 330; const fx = X0 + pos * SPAN; const b = bphase(); const k = b / BEAT; // k va de 0 à 1 puis recommence, l'impact est à 0 et à 1
      items.push({ t: "box", x: 70, y: 255, z: 0, w: 130, d: 150, h: 0, c: TEAMS[0].c, a: 0.25 }, { t: "box", x: 830, y: 255, z: 0, w: 130, d: 150, h: 0, c: TEAMS[1].c, a: 0.25 });
      items.push({ t: "box", x: X0, y: 255, z: 0, w: 780, d: 10, h: 0, c: "#c9a46a" }); items.push({ t: "box", x: X0, y: 255, z: 0, w: 4, d: 90, h: 0, c: "#ffffff", a: 0.35 });
      items.push({ t: "box", x: fx, y: 255, z: 0, w: 26, d: 36, h: 0, c: "#ff3b5c" }); items.push({ t: "text", x: fx, y: 228, v: "🚩", s: 26 });
      // pions des deux équipes
      [0, 1].forEach((tn) => { const mem = P.filter((p) => p.team === tn); mem.forEach((p, i) => { const row = i % 4, col = Math.floor(i / 4); const bx = tn === 0 ? 150 + col * 62 - pos * 90 : 750 - col * 62 - pos * 90; const by = 160 + row * 62 - (mem.length > 4 ? 0 : (4 - mem.length) * -12); items.push({ t: "pawn", id: p.id, x: Math.max(40, Math.min(860, bx)), y: by + 30, z: 0, k: p.k, n: p.name, st: p.tired > 0 ? "dizzy" : p.flash === "Parfait" && p.flashT > 0 ? "win" : "" }); if (p.flashT > 0) items.push({ t: "text", x: Math.max(40, Math.min(860, bx)), y: by - 16, v: p.flash, c: p.flash === "Parfait" ? "#ffd23b" : p.flash === "Bien" ? "#9be37a" : "#ff6a6a", s: 18 }); }); });
      // le battement. un cercle qui se resserre sur l'anneau fixe
      const R = 28 + (1 - k) * 90; items.push({ t: "ring", x: X0, y: 440, r: 30, c: "#ffffff", w: 5 }); items.push({ t: "ring", x: X0, y: 440, r: R, c: k > 0.82 || k < 0.1 ? "#ffd23b" : "#8fd0ff", w: 4, a: 0.9 });
      items.push({ t: "text", x: X0, y: 448, v: "Appuie", s: 16, c: "#ffffff" });
      items.push({ t: "text", x: 70, y: 150, v: "Équipe " + TEAMS[0].n, s: 22, c: TEAMS[0].c }, { t: "text", x: 830, y: 150, v: "Équipe " + TEAMS[1].n, s: 22, c: TEAMS[1].c });
      items.push({ t: "text", x: X0, y: 90, v: wins[0] + "   manches   " + wins[1], s: 28, c: "#fff3c8" });
      return { w: 900, h: 520, bg: "#243a2a", items, hud: { title: phase === "pre" ? "Tirez en rythme, appuie quand le cercle touche l'anneau" : "Un coup parfait tire fort, un coup à côté essouffle", chips: [{ text: "Manche " + rounds }, { text: "Il faut " + WIN + " manche" + (WIN > 1 ? "s" : "") + " gagnée" + (WIN > 1 ? "s" : "") }] } };
    },
    priv(pid) { const p = P.find((x) => x.id === pid); if (!p) return null; const tt = TEAMS[p.team]; return { role: { name: "Équipe " + tt.n, c: tt.c, tip: "Appuie sur Espace pile quand le cercle touche l'anneau" }, ui: phase === "play" || phase === "pre" ? { groups: [], lock: { id: "pull", t: p.tired > 0 ? "Essoufflé" : "Tirer", dis: p.tired > 0 } } : null }; },
    onAct(pid, m) { const p = P.find((x) => x.id === pid); if (p && (m.type === "click" || (m.type === "btn" && m.id === "pull"))) pull(p); },
    ranking() {
      const w = wins[0] === wins[1] ? (pos <= 0 ? 0 : 1) : wins[0] > wins[1] ? 0 : 1; const win = P.filter((p) => p.team === w).map((p) => p.id), lose = P.filter((p) => p.team !== w).map((p) => p.id);
      const bonus = {}, notes = {}; const best = P.slice().sort((a, b) => b.perfect - a.perfect)[0]; if (best && best.perfect >= 6) bonus[best.id] = 1;
      P.forEach((p) => { notes[p.id] = "Équipe " + TEAMS[p.team].n + ", " + p.perfect + " parfait" + (p.perfect > 1 ? "s" : "") + (p.miss ? ", " + p.miss + " raté" + (p.miss > 1 ? "s" : "") : ""); });
      return { groups: [win, lose].filter((g) => g.length), bonus, notes, headline: "🪢 L'équipe " + TEAMS[w].n + " l'emporte " + wins[w] + " à " + wins[1 - w] };
    },
  };
  return inst;
};

// Pont de verre. À chaque rangée une dalle est fragile, ceux qui tombent aident les suivants.
const U = require("../pg-util.js");
exports.create = function (ctx) {
  const rnd = ctx.rnd; const n = ctx.n; const R = 6 + Math.floor(n / 3);
  const fragile = Array.from({ length: R }, () => (rnd() < 0.5 ? 0 : 1)); const known = new Array(R).fill(null); // known vaut la dalle solide si révélée
  const P = ctx.players.map((m) => ({ id: m.id, k: m.color, name: m.name, prog: 0, alive: true, crossed: false, sel: null }));
  const queue = U.shuffle(P.map((p) => p.id), rnd); let qi = 0, left = 0, t = 0, winner = null, pause = 0; const falls = [], broke = [];
  const turnTime = () => 7 * ctx.pace;
  function advance(p) { while (p.prog < R && known[p.prog] != null) p.prog++; if (p.prog >= R) { p.crossed = true; winner = winner || p; } }
  function current() { for (let k = 0; k < queue.length; k++) { const p = P.find((x) => x.id === queue[(qi + k) % queue.length]); if (p.alive && !p.crossed) { qi = (qi + k) % queue.length; return p; } } return null; }
  let cur = null;
  function begin() { cur = current(); if (!cur) return; advance(cur); if (cur.crossed) { return; } cur.sel = null; left = turnTime(); }
  begin();
  function play(p) {
    const side = p.sel == null ? (rnd() < 0.5 ? 0 : 1) : p.sel; const r = p.prog;
    if (fragile[r] === side) { p.alive = false; falls.push([p.id]); broke[r] = side; known[r] = 1 - side; ctx.announce(p.name + " a posé le pied sur une dalle fragile", 2200); }
    else { known[r] = side; p.prog++; ctx.announce(p.name + " passe la rangée " + (r + 1), 1500); advance(p); }
    pause = 1.3; qi = (qi + 1) % queue.length;
  }
  const inst = {
    done: false,
    update(dt) {
      t += dt;
      if (winner) { inst.done = true; return; }
      if (pause > 0) { pause -= dt; if (pause <= 0) { begin(); if (winner || !cur) inst.done = true; } return; }
      if (!cur) { inst.done = true; return; }
      const i = ctx.input(cur.id), e = ctx.edge(cur.id); if (i.x < 0) cur.sel = 0; else if (i.x > 0) cur.sel = 1;
      left -= dt; if ((e.a && cur.sel != null) || left <= 0) { play(cur); if (winner) { pause = 1.4; } }
      if (!P.some((p) => p.alive && !p.crossed)) inst.done = true;
    },
    frame() {
      const items = []; const rowH = 52, top = 100, W = 640, H = top + R * rowH + 100;
      items.push({ t: "rect", x: 180, y: top - 20, w: 280, h: R * rowH + 34, c: "#0b1120", r: 10 });
      for (let r = 0; r < R; r++) {
        const y = top + (R - 1 - r) * rowH;
        for (let s = 0; s < 2; s++) {
          const x = 200 + s * 130; let c = "#9ad4ea", a = 0.5, st = "rgba(255,255,255,.7)"; const isBroken = broke[r] === s;
          if (isBroken) { c = "#0b1120"; a = 1; st = "#334"; } else if (known[r] === s) { c = "#4ade80"; a = 0.75; }
          items.push({ t: "rect", x, y, w: 110, h: rowH - 8, c, a, s: st, r: 8 });
        }
      }
      items.push({ t: "text", x: 320, y: top - 30, v: "ARRIVÉE", c: "#ffd23b", s: 20 });
      // pions
      const at = {}; P.forEach((p) => { if (!p.alive) return; const key = p.prog; (at[key] = at[key] || []).push(p); });
      Object.keys(at).forEach((key) => { const rr = Number(key); at[key].forEach((p, i) => { const y = rr >= R ? top - 6 : rr === 0 ? top + R * rowH + 24 : top + (R - rr) * rowH + 18; const x = 320 + (i - (at[key].length - 1) / 2) * 70; items.push({ t: "pawn", id: p.id, x, y: rr === 0 ? top + R * rowH + 44 : y, k: p.k, n: p.name, r: 16, ring: cur && cur.id === p.id ? "#ffffff" : null }); }); });
      return { w: W, h: H, bg: "#0f2233", items, hud: { title: cur ? "À " + cur.name + " de jouer" : "Fin du pont", timer: cur && !winner && pause <= 0 ? Math.max(0, left) : null, chips: [{ text: P.filter((p) => p.alive).length + " en jeu" }] } };
    },
    priv(pid) { if (!cur || cur.id !== pid || winner || pause > 0) return { wait: true }; return { ui: { groups: [{ label: "Quelle dalle choisis-tu", btns: [{ id: "L", t: "Gauche", sel: cur.sel === 0 }, { id: "R", t: "Droite", sel: cur.sel === 1 }] }], lock: { id: "ok", t: "Poser le pied", dis: cur.sel == null } }, row: cur.prog + 1 }; },
    onAct(pid, m) { if (!cur || cur.id !== pid || m.type !== "btn" || winner || pause > 0) return; if (m.id === "L") cur.sel = 0; else if (m.id === "R") cur.sel = 1; else if (m.id === "ok" && cur.sel != null) { play(cur); if (winner) pause = 1.4; } },
    ranking() {
      const sorted = P.slice().sort((a, b) => (b.crossed - a.crossed) || (b.prog - a.prog) || (b.alive - a.alive)); const groups = []; sorted.forEach((p) => { const last = groups[groups.length - 1]; const q = last && P.find((x) => x.id === last[0]); if (q && q.crossed === p.crossed && q.prog === p.prog && q.alive === p.alive) last.push(p.id); else groups.push([p.id]); });
      const notes = {}; P.forEach((p) => { notes[p.id] = p.crossed ? "a traversé" : "rangée " + p.prog; }); return { groups, bonus: {}, notes };
    },
  };
  return inst;
};

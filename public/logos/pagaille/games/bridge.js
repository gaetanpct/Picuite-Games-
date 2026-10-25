// Pont de verre. À chaque rangée une dalle est fragile. On traverse chacun son tour, ceux qui tombent aident les suivants.
// Le premier à traverser gagne. Tout le monde voit tout, il faut donc retenir ce que les autres révèlent.
const U = require("../pg-util.js");

const RH = 100, PX = 74, PW = 126, PD = 86;
exports.create = function (ctx) {
  const rnd = ctx.rnd; const n = ctx.n; const R = Math.min(10, 6 + Math.floor(n / 2)); const rowY = (r) => -r * RH; const START = RH * 1.25; const END = rowY(R) - 10;
  const fragile = Array.from({ length: R }, () => (rnd() < 0.5 ? 0 : 1)); const known = new Array(R).fill(null); const brokenAt = new Array(R).fill(-1); const broke = new Array(R).fill(null);
  const P = ctx.players.map((m, i) => ({ id: m.id, k: m.color, name: m.name, prog: 0, alive: true, crossed: false, sel: null, side: -1, z: 0, vz: 0, fall: 0, ex: {}, order: i }));
  const queue = U.shuffle(P.map((p) => p.id), rnd); let qi = 0, left = 0, t = 0, winner = null, pause = 0, jumpT = 0; const falls = [];
  const turnTime = () => 8 * ctx.pace;
  function advance(p) { while (p.prog < R && known[p.prog] != null) { p.side = known[p.prog]; p.prog++; } if (p.prog >= R) { p.crossed = true; winner = winner || p; } }
  function current() { for (let k = 0; k < queue.length; k++) { const p = P.find((x) => x.id === queue[(qi + k) % queue.length]); if (p.alive && !p.crossed) { qi = (qi + k) % queue.length; return p; } } return null; }
  let cur = null;
  function begin() { cur = current(); if (!cur) return; advance(cur); if (cur.crossed) return; cur.sel = null; left = turnTime(); cur.ex.think = 0.9 + (1 - ctx.skill(cur.id)) * 2.2 + rnd(); }
  begin();
  function play(p) {
    const side = p.sel == null ? (rnd() < 0.5 ? 0 : 1) : p.sel; const r = p.prog;
    if (fragile[r] === side) { p.alive = false; p.fall = 0.001; p.side = side; falls.push([p.id]); broke[r] = side; brokenAt[r] = t; known[r] = 1 - side; ctx.fx("splash", (side ? 1 : -1) * PX, rowY(r), 0, "#e8f7ff"); ctx.snd("glass"); ctx.shake(2); ctx.announce(p.name + " a posé le pied sur une dalle fragile", 2200); }
    else { known[r] = side; p.side = side; p.prog++; p.vz = 330; ctx.snd("jump"); ctx.announce(p.name + " passe la rangée " + (r + 1), 1500); advance(p); }
    pause = 1.5; qi = (qi + 1) % queue.length;
  }
  const inst = {
    done: false,
    live: false,
    update(dt) {
      t += dt;
      P.forEach((p) => { if (p.vz || p.z > 0) { p.vz -= 1500 * dt; p.z = Math.max(0, p.z + p.vz * dt); if (p.z === 0 && p.vz < 0) p.vz = 0; } if (p.fall) { p.fall += dt; } });
      if (winner) { pause -= dt; if (pause <= -0.2 || !pause) { } inst.done = pause <= 0; if (pause > 0 && !inst._cel) { inst._cel = true; ctx.fx("confetti", 0, rowY(R), 50, ""); ctx.snd("win"); } return; }
      if (pause > 0) { pause -= dt; if (pause <= 0) { begin(); if (winner || !cur) inst.done = true; } return; }
      if (!cur) { inst.done = true; return; }
      if (ctx.isBot(cur.id)) { cur.ex.think -= dt; if (cur.ex.think < 0.5 && cur.sel == null) cur.sel = rnd() < 0.5 ? 0 : 1; if (cur.ex.think <= 0) { play(cur); } }
      else { const i = ctx.input(cur.id), e = ctx.edge(cur.id); if (i.x < 0) cur.sel = 0; else if (i.x > 0) cur.sel = 1; if (e.a && cur.sel != null) play(cur); }
      left -= dt; if (left <= 0 && pause <= 0 && cur && !winner) play(cur);
      if (winner && pause <= 0) pause = 1.8;
      if (!P.some((p) => p.alive && !p.crossed)) inst.done = true;
    },
    scene() {
      const items = [{ t: "box", x: 0, y: START, z: -26, w: 360, d: 120, h: 26, c: "#cfd8e6" }, { t: "box", x: 0, y: END, z: -26, w: 360, d: 130, h: 26, c: "#ffe58a" }, { t: "text", x: 0, y: END - 6, z: 30, v: "ARRIVÉE", c: "#ffd23b", s: 30 }, { t: "flag", x: -140, y: END, z: 0, c: "#ff4d6d" }, { t: "flag", x: 140, y: END, z: 0, c: "#ff4d6d" }];
      for (let r = 0; r < R; r++) { [-1, 1].forEach((s) => items.push({ t: "box", x: s * 230, y: rowY(r), z: -150, w: 18, d: 18, h: 150, c: "#3a4a68" })); }
      [-1, 1].forEach((s) => { items.push({ t: "box", x: s * 215, y: (START + END) / 2, z: 12, w: 6, d: START - END, h: 3, c: "#7fe7ff", m: "neon", ns: 1 }); });
      for (let i = 0; i < 5; i++) items.push({ t: "deco", kind: "cloud", x: (i % 2 ? 1 : -1) * (420 + i * 30), y: -i * 220, z: 60 + i * 20, s: 3 });
      return { w: 760, h: (R + 4) * RH, cam: { tilt: 56, fov: 40, pad: 1.0, c: [0, (START + END) / 2 + 10], ht: 40 }, env: { sky: ["#0c2a45", "#6fd0ff"], fog: "#1e5a88", fogN: 70, fogF: 260, ground: { c: "#0e4a73", m: "water", z: -300 }, lt: { h: ["#eaf8ff", "#4a7a9a"], hi: 1, d: "#fff", di: 0.9, dir: [-0.3, 1, 0.5] } }, items };
    },
    frame() {
      const items = [];
      for (let r = 0; r < R; r++) for (let s = 0; s < 2; s++) {
        const isBroken = broke[r] === s; const gone = isBroken && t - brokenAt[r] > 1.6; if (gone) continue;
        const dtb = isBroken ? t - brokenAt[r] : 0; const z = isBroken ? -Math.min(300, 700 * dtb * dtb) : 0;
        let c = "#bfeaff", m = "glass"; if (isBroken) c = "#9ad4ea"; else if (known[r] === s) { c = "#7fe9a8"; m = "glass"; }
        items.push({ t: "box", id: "g" + r + "_" + s, x: (s ? 1 : -1) * PX, y: rowY(r), z: z - 8, w: PW, d: PD, h: 10, c, m, a: isBroken ? 0.4 : 0.7, ns: 1, sm: 30 });
      }
      const groups = {}; P.forEach((p) => { if (p.fall > 1.6 || (!p.alive && p.fall === 0)) return; const key = p.alive ? p.prog + "_" + p.side : "x" + p.id; (groups[key] = groups[key] || []).push(p); });
      P.forEach((p) => {
        if (p.fall > 1.6) return; const slot = (groups[p.alive ? p.prog + "_" + p.side : "x" + p.id] || [p]).indexOf(p); let x, y;
        if (!p.alive) { x = (p.side ? 1 : -1) * PX; y = rowY(broke.indexOf(p.side) >= 0 ? p.prog : p.prog); }
        else if (p.crossed) { x = (slot - 1) * 70; y = END + 10; }
        else if (p.prog === 0) { x = -120 + p.order * (240 / Math.max(1, n - 1)) * (n > 1 ? 1 : 0); y = START + (p.order % 2) * 28 - 14; }
        else { x = (p.side ? 1 : -1) * PX + (slot - 0.5 * ((groups[p.prog + "_" + p.side] || [p]).length - 1)) * 26; y = rowY(p.prog - 1); }
        const falling = !p.alive; items.push({ t: "pawn", id: p.id, x, y, z: falling ? -Math.min(300, 700 * p.fall * p.fall) : p.z, k: p.k, n: p.name, face: -1.57, air: falling || p.z > 3 ? 1 : 0, gz: -320, badge: cur && cur.id === p.id && pause <= 0 ? "👉" : p.crossed ? "🏁" : "", st: winner === p ? "win" : "", sm: 10 });
      });
      return { w: 760, h: (R + 4) * RH, items, hud: { title: winner ? winner.name + " traverse le pont" : cur ? "À " + cur.name + " de jouer" : "Fin du pont", timer: cur && !winner && pause <= 0 ? Math.max(0, left) : null, chips: [{ text: P.filter((p) => p.alive).length + " en jeu" }, { text: "Rangées " + R }] } };
    },
    priv(pid) {
      const items = []; if (cur && cur.id === pid && !winner && pause <= 0 && cur.sel != null) items.push({ t: "ring", id: "selring", x: (cur.sel ? 1 : -1) * PX, y: rowY(cur.prog), z: 4, r: 50, c: "#ffd23b", a: 0.95 });
      if (!cur || cur.id !== pid || winner || pause > 0) return { wait: true, items, dead: P.find((x) => x.id === pid && !x.alive) ? 1 : 0, deadText: "Tu es tombé, tes pas servent aux suivants" };
      return { items, ui: { title: "C'est ton tour", groups: [{ label: "Quelle dalle choisis-tu", btns: [{ id: "L", t: "Gauche", sel: cur.sel === 0 }, { id: "R", t: "Droite", sel: cur.sel === 1 }] }], lock: { id: "ok", t: "Poser le pied", dis: cur.sel == null } }, row: cur.prog + 1 };
    },
    onAct(pid, m) { if (!cur || cur.id !== pid || winner || pause > 0) return; if (m.type === "click") { cur.sel = m.x < 0 ? 0 : 1; ctx.snd("coin"); return; } if (m.type !== "btn") return; if (m.id === "L") cur.sel = 0; else if (m.id === "R") cur.sel = 1; else if (m.id === "ok" && cur.sel != null) play(cur); },
    ranking() {
      const sorted = P.slice().sort((a, b) => (b.crossed - a.crossed) || (b.prog - a.prog) || (b.alive - a.alive)); const groups = []; sorted.forEach((p) => { const last = groups[groups.length - 1]; const q = last && P.find((x) => x.id === last[0]); if (q && q.crossed === p.crossed && q.prog === p.prog && q.alive === p.alive) last.push(p.id); else groups.push([p.id]); });
      const notes = {}; P.forEach((p) => { notes[p.id] = p.crossed ? "a traversé" : "rangée " + p.prog + (p.alive ? "" : ", tombé"); }); return { groups, bonus: {}, notes, headline: winner ? "🌉 " + winner.name + " traverse en premier" : "Le pont a gagné" };
    },
  };
  return inst;
};

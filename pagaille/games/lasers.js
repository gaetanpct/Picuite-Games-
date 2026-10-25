// Lasers invisibles. Une grande plateforme ronde où l'on marche librement. Chaque joueur a un laser qui part tout droit devant lui, en permanence.
// Pendant le placement personne ne voit les autres ni leurs lasers. À la révélation tout apparaît, et celui qui se tient sur le laser de quelqu'un tombe.
// Ensuite la plateforme rétrécit et ramène les survivants vers le centre.
const U = require("../pg-util.js");
exports.create = function (ctx) {
  const rnd = ctx.rnd; const n = ctx.n; const R0 = 250 + 24 * n; const RMIN = 120; const maxCycles = Math.max(4, Math.round(9 * ctx.len)); const SP = 210 * ctx.speed; const HIT = 21;
  const P = ctx.players.map((m, i) => { const a = (i / n) * 6.283 + rnd(); const r = R0 * (0.35 + rnd() * 0.4); return { id: m.id, k: m.color, name: m.name, x: Math.cos(a) * r, y: Math.sin(a) * r, face: a + 3.14, alive: true, ready: false, kills: 0, deadAt: -1, fade: 0, ex: {} }; });
  const falls = []; let R = R0, cycle = 0, phase = "place", left = 0, t = 0, shrinkTo = R0, firedKills = [];
  const alive = () => P.filter((p) => p.alive);
  const dirOf = (p) => [Math.cos(p.face), Math.sin(p.face)];
  // distance d'un point à un rayon qui part de p dans sa direction
  function rayDist(p, q) { const d = dirOf(p); const dx = q.x - p.x, dy = q.y - p.y; const s = dx * d[0] + dy * d[1]; if (s < 0) return 1e9; return Math.abs(dx * d[1] - dy * d[0]); }
  function startPlace() { phase = "place"; left = Math.max(5.5, 9 - cycle * 0.5) * ctx.pace; alive().forEach((p) => { p.ready = false; p.ex.go = null; p.ex.readyAt = 1.2 + (1 - ctx.skill(p.id)) * 3 + rnd() * 2; p.ex.t = 0; }); if (cycle > 0) ctx.announce("Place toi, ton laser pointe devant toi", 1800); }
  function reveal() {
    phase = "reveal"; left = 3.4; ctx.snd("laser"); firedKills = []; const A = alive();
    const dead = []; A.forEach((q) => { const hitters = A.filter((p) => p !== q && rayDist(p, q) < HIT + 6); if (hitters.length) { dead.push(q); hitters.forEach((h) => { h.kills++; }); } });
    firedKills = dead; ctx.announce(dead.length ? "Ceux qui sont sur un laser tombent" : "Tous les lasers sont passés à côté", 1900);
  }
  function bot(p, dt) {
    const sk = ctx.skill(p.id); const ex = p.ex; ex.t += dt;
    if (!ex.go) {
      // un bon joueur reste vers le bord et regarde vers l'intérieur, un faible joueur se place au hasard
      const edge = rnd() < 0.35 + sk * 0.5; const a = rnd() * 6.283; const r = edge ? Math.max(20, R - 40 - rnd() * 40) : rnd() * (R - 30);
      ex.go = { x: Math.cos(a) * r, y: Math.sin(a) * r }; const aim = edge ? Math.atan2(-ex.go.y, -ex.go.x) + (rnd() - 0.5) * 1.3 * (1.2 - sk) : rnd() * 6.283; ex.aim = aim;
    }
    const dx = ex.go.x - p.x, dy = ex.go.y - p.y, d = Math.hypot(dx, dy);
    if (d > 8) { return { x: dx / d, y: dy / d, strafe: false }; }
    return { x: 0, y: 0, face: ex.aim };
  }
  startPlace();
  const inst = {
    done: false,
    live: false,
    update(dt) {
      t += dt; left -= dt; P.forEach((p) => { if (p.fade > 0) p.fade -= dt; });
      if (phase === "place") {
        alive().forEach((p) => {
          let ix = 0, iy = 0, strafe = false;
          if (ctx.isBot(p.id)) { const c = bot(p, dt); ix = c.x; iy = c.y; if (c.face != null) { const da = U.angDiff ? U.angDiff(p.face, c.face) : 0; p.face = c.face; } if (c.x === 0 && c.y === 0 && p.ex.t > p.ex.readyAt) p.ready = true; }
          else { const i = ctx.input(p.id), e = ctx.edge(p.id); ix = i.x; iy = i.y; strafe = !!i.a; if (e.b) p.ready = !p.ready; }
          const l = Math.hypot(ix, iy); if (l > 0.01) { const nx = ix / l, ny = iy / l; p.x += nx * SP * dt; p.y += ny * SP * dt; if (!strafe) p.face = Math.atan2(ny, nx); }
          const d = Math.hypot(p.x, p.y), lim = R - 16; if (d > lim) { p.x *= lim / d; p.y *= lim / d; }
        });
        const A = alive().filter((p) => ctx.present(p.id));
        if (left <= 0 || (A.length && A.every((p) => p.ready))) reveal();
      } else if (phase === "reveal") {
        if (left < 2.4 && firedKills.length) { firedKills.forEach((p) => { p.alive = false; p.fade = 1.4; p.deadAt = t; ctx.fx("boom", p.x, p.y, 20, "#ff6b6b"); }); falls.push(firedKills.map((p) => p.id)); firedKills = []; ctx.shake(2); ctx.snd("boom"); if (alive().length <= 1) { left = Math.min(left, 1.2); } }
        if (left <= 0) {
          cycle++; if (alive().length <= 1 || cycle >= maxCycles) { inst.done = true; return; }
          phase = "shrink"; left = 1.4; shrinkTo = Math.max(RMIN, R * 0.88); ctx.snd("crack"); ctx.shake(1);
        }
      } else if (phase === "shrink") {
        R += (shrinkTo - R) * Math.min(1, dt * 4); alive().forEach((p) => { const d = Math.hypot(p.x, p.y), lim = R - 16; if (d > lim) { p.x *= lim / d; p.y *= lim / d; } });
        if (left <= 0) { R = shrinkTo; startPlace(); }
      }
    },
    scene() { return { w: R0 * 2.4, h: R0 * 2.4, cam: { tilt: 62, fov: 40, pad: 1.05, c: [0, 10], ht: 30 }, env: { sky: ["#1a0f3a", "#7a3bd6"], fog: "#2a1a5a", fogN: 80, fogF: 300, ground: { c: "#120a2e", m: "water", z: -240 }, lt: { h: ["#f1e8ff", "#6a52a8"], hi: 1, d: "#ffe8ff", di: 0.9, dir: [-0.3, 1, 0.5] } }, items: [{ t: "deco", kind: "cloud", x: -R0 * 1.3, y: -R0, z: 70, s: 3 }, { t: "deco", kind: "cloud", x: R0 * 1.4, y: R0 * 0.4, z: 80, s: 3 }] }; },
    beams(all, only) {
      const out = []; P.forEach((p) => { if (!p.alive && !(phase === "reveal" && p.fade > 0)) return; if (only && p.id !== only) return; const d = dirOf(p); out.push({ t: "beam", id: "lz" + p.id, x: p.x, y: p.y, z: 26, x2: p.x + d[0] * (R0 * 2.2), y2: p.y + d[1] * (R0 * 2.2), z2: 26, w: all ? 14 : 7, c: all ? "#ff3b5c" : "#ffd23b", a: all ? 0.9 : 0.45 }); });
      return out;
    },
    frame() {
      const items = [{ t: "cyl", id: "floor", x: 0, y: 0, z: -30, r: R, h: 30, c: "#4a3a8c", m: "", sm: 6 }, { t: "cyl", id: "rim", x: 0, y: 0, z: -34, r: R + 10, h: 8, c: "#ff8ad8", m: "neon", ns: 1, sm: 6 }];
      const show = phase !== "place";
      if (show) { P.forEach((p) => { if (p.alive || p.fade > 0) items.push({ t: "pawn", id: p.id, x: p.x, y: p.y, z: p.alive ? 0 : -Math.max(0, 1.4 - p.fade) * 120, k: p.k, n: p.name, face: p.face, dead: p.alive ? 0 : 1 - p.fade / 1.4, air: p.alive ? 0 : 1, gz: -200 }); }); if (phase === "reveal") this.beams(true).forEach((b) => items.push(b)); }
      return { w: R0 * 2.4, h: R0 * 2.4, items, hud: { title: phase === "place" ? "Place toi, ton laser pointe devant toi" : phase === "reveal" ? "Révélation des lasers" : "La plateforme rétrécit", timer: phase === "place" ? Math.max(0, left) : null, chips: [{ text: "Tour " + Math.min(maxCycles, cycle + 1) + " sur " + maxCycles }, { text: alive().length + " debout" }], target: null } };
    },
    priv(pid) {
      const me = P.find((p) => p.id === pid); if (!me) return null; const items = [];
      if (phase === "place") {
        if (me.alive) { items.push({ t: "pawn", id: me.id, x: me.x, y: me.y, z: 0, k: me.k, n: me.name, face: me.face, badge: me.ready ? "✓" : "" }); this.beams(false, me.id).forEach((b) => items.push(b)); }
        else P.forEach((p) => { if (p.alive) items.push({ t: "pawn", id: p.id, x: p.x, y: p.y, z: 0, k: p.k, n: p.name, face: p.face }); });
        return { items, dead: me.alive ? 0 : 1, deadText: "Tu es tombé, regarde la fin", bars: [{ label: me.ready ? "Prêt" : "Maj pour valider", pct: me.ready ? 100 : Math.max(0, left / 9 * 100), c: me.ready ? "#4cd964" : "#ffd23b" }] };
      }
      return { items, dead: me.alive ? 0 : 1, deadText: "Tu es tombé, regarde la fin" };
    },
    onAct(pid, m) { const p = P.find((x) => x.id === pid); if (p && p.alive && phase === "place" && m.type === "btn" && m.id === "ready") p.ready = !p.ready; },
    ranking() {
      const alive = P.filter((p) => p.alive).map((p) => p.id); const groups = U.rankFromFalls(P.map((p) => p.id), falls, alive); const notes = {}; const bonus = {}; const mk = Math.max(0, ...P.map((p) => p.kills));
      P.forEach((p) => { notes[p.id] = (p.alive ? "Encore debout" : "Tombé") + (p.kills ? ", " + p.kills + " touché" + (p.kills > 1 ? "s" : "") : ""); if (mk > 0 && p.kills === mk) bonus[p.id] = Math.min(3, mk); });
      return { groups, bonus, notes, headline: "🔦 Le dernier hors des lasers" };
    },
  };
  return inst;
};

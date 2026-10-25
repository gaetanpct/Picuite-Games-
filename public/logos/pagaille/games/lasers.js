// Lasers invisibles. Déplacement et laser choisis en secret, tout part en même temps.
// Les lasers traversent toute une ligne ou toute une colonne. On ne peut pas se tirer dessus soi même.
const U = require("../pg-util.js");
const T = 104;
const DIRS = { N: [0, -1], S: [0, 1], W: [-1, 0], E: [1, 0], X: [0, 0] };
exports.create = function (ctx) {
  const rnd = ctx.rnd; const n = ctx.n; const S = Math.max(5, Math.min(9, n + 3)); const W = S * T, H = S * T; const maxCycles = Math.round(7 * ctx.len);
  const free = U.shuffle(Array.from({ length: S * S }, (_, i) => i), rnd);
  const P = ctx.players.map((m, i) => ({ id: m.id, k: m.color, name: m.name, cx: free[i] % S, cy: Math.floor(free[i] / S), alive: true, mv: "X", ln: null, lock: false, err: "", kills: 0, ex: {}, fade: 0 }));
  const falls = []; let cycle = 0, phase = "plan", left = 15 * ctx.pace, flash = null, t = 0, planT = 0, shown = false;
  const alive = () => P.filter((p) => p.alive);
  const dest = (p) => { const d = DIRS[p.mv]; const x = p.cx + d[0], y = p.cy + d[1]; return x < 0 || y < 0 || x >= S || y >= S ? [p.cx, p.cy] : [x, y]; };
  const onLine = (ln, x, y) => (ln[0] === "r" ? y === Number(ln.slice(1)) : x === Number(ln.slice(1)));
  const px = (c) => c * T + T / 2;
  function tryLock(p) { if (p.lock) return; if (p.ln) { const [x, y] = dest(p); if (onLine(p.ln, x, y)) { p.err = "Ton laser te toucherait, change de ligne ou de déplacement."; return; } } p.err = ""; p.lock = true; ctx.snd("coin"); }
  function resolve() {
    const A = alive(); A.forEach((p) => { const d = dest(p); p.cx = d[0]; p.cy = d[1]; });
    const lines = A.filter((p) => p.ln).map((p) => ({ ln: p.ln, by: p.id }));
    const dead = []; A.forEach((p) => { const hit = lines.filter((l) => onLine(l.ln, p.cx, p.cy)); if (hit.length) { dead.push(p); hit.forEach((l) => { const o = P.find((q) => q.id === l.by); if (o && o !== p) o.kills++; }); } });
    dead.forEach((p) => { p.alive = false; p.fade = 1.4; }); if (dead.length) falls.push(dead.map((p) => p.id));
    flash = { lines: lines.map((l) => l.ln), dead: dead.map((p) => ({ x: p.cx, y: p.cy })) };
    phase = "fire"; left = 2.6; shown = false; ctx.snd("laser");
    if (!lines.length) ctx.announce("Personne n'a tiré", 1800); else if (!dead.length) ctx.announce("Tous les lasers sont passés à côté", 2000); else ctx.announce(dead.map((p) => p.name).join(" et ") + (dead.length > 1 ? " sont touchés" : " est touché"), 2200);
  }
  function plan(p) {
    const sk = ctx.skill(p.id); const foes = alive().filter((q) => q !== p); p.ex.at = 1.5 + rnd() * 3.5 * (1.2 - sk);
    // les lignes qui rapportent le plus. on compte les adversaires qui pourraient s'y trouver
    const score = (ln) => foes.reduce((s, q) => { let k = 0; [[0, 0], [1, 0], [-1, 0], [0, 1], [0, -1]].forEach((d) => { if (onLine(ln, q.cx + d[0], q.cy + d[1])) k += d[0] === 0 && d[1] === 0 ? 2 : 1; }); return s + k; }, 0);
    const lines = []; for (let i = 0; i < S; i++) { lines.push("r" + i); lines.push("c" + i); }
    // un bon joueur évite les lignes où il y a trop d'adversaires, qui seront probablement visées. il se met là où personne n'est aligné
    const risk = (x, y) => foes.reduce((s, q) => s + (q.cx === x ? 1 : 0) + (q.cy === y ? 1 : 0), 0);
    let bestMv = "X", br = 1e9; Object.keys(DIRS).forEach((k) => { const x = p.cx + DIRS[k][0], y = p.cy + DIRS[k][1]; if (x < 0 || y < 0 || x >= S || y >= S) return; const r = risk(x, y) * (0.5 + sk) + rnd() * (1.3 - sk) * 2 + (k === "X" ? 0.4 : 0); if (r < br) { br = r; bestMv = k; } });
    p.mv = bestMv; const [dx, dy] = dest(p); let bl = null, bs = -1e9; lines.forEach((ln) => { if (onLine(ln, dx, dy)) return; const s = score(ln) + rnd() * (1.2 - sk) * 3; if (s > bs) { bs = s; bl = ln; } });
    p.ln = bl && bs > 0.5 ? bl : (rnd() < 0.35 ? null : bl);
  }
  function startPlan() { phase = "plan"; planT = 0; left = Math.max(8, 14 - cycle) * ctx.pace; flash = null; alive().forEach((p) => { p.mv = "X"; p.ln = null; p.lock = false; p.err = ""; if (ctx.isBot(p.id)) plan(p); }); }
  const lineBeam = (ln, a) => { const v = Number(ln.slice(1)); return ln[0] === "r" ? { t: "beam", x: -20, y: px(v), z: 36, x2: W + 20, y2: px(v), z2: 36, w: 18, c: "#ff3b3b", a } : { t: "beam", x: px(v), y: -20, z: 36, x2: px(v), y2: H + 20, z2: 36, w: 18, c: "#ff3b3b", a }; };
  startPlan();
  const inst = {
    done: false,
    live: false,
    update(dt) {
      t += dt; left -= dt; P.forEach((p) => { if (p.fade > 0) p.fade -= dt; });
      if (phase === "plan") {
        planT += dt;
        alive().forEach((p) => {
          if (ctx.isBot(p.id)) { if (!p.lock && planT > p.ex.at) { if (!p.ln || !onLine(p.ln, dest(p)[0], dest(p)[1])) p.lock = true; else { p.ln = null; p.lock = true; } } return; }
          if (p.lock) return; const i = ctx.input(p.id); const e = ctx.edge(p.id);
          if (i.x < 0) p.mv = "W"; else if (i.x > 0) p.mv = "E"; else if (i.y < 0) p.mv = "N"; else if (i.y > 0) p.mv = "S"; if (e.b) p.mv = "X"; if (e.a) tryLock(p);
        });
        const A = alive().filter((p) => ctx.present(p.id));
        if (left <= 0 || (A.length && A.every((p) => p.lock))) resolve();
      } else if (phase === "fire") {
        if (!shown && left < 2.0) { shown = true; if (flash && flash.dead.length) { flash.dead.forEach((d) => ctx.fx("boom", px(d.x), px(d.y), 20, "#ff6b6b")); ctx.shake(2); ctx.snd("boom"); } }
        if (left <= 0 && !inst.done) { cycle++; if (alive().length <= 1 || cycle >= maxCycles) { inst.done = true; return; } startPlan(); }
      }
    },
    scene() {
      const items = []; for (let r = 0; r < S; r++) for (let c = 0; c < S; c++) items.push({ t: "box", x: px(c), y: px(r), z: -30, w: T - 4, d: T - 4, h: 30, c: (r + c) % 2 ? "#2f3f63" : "#38496f" });
      for (let i = 0; i < S; i++) { items.push({ t: "text", x: -34, y: px(i), z: 6, v: String(i + 1), c: "#9fb3d1", s: 28 }); items.push({ t: "text", x: px(i), y: -34, z: 6, v: String.fromCharCode(65 + i), c: "#9fb3d1", s: 28 }); }
      return { w: W, h: H, cam: { tilt: 62, fov: 40, pad: 1.12, c: [W / 2, H / 2 + 20], ht: 30 }, env: { sky: ["#0a1020", "#1a2a55"], fog: "#0c1530", fogN: 70, fogF: 250, ground: { c: "#070b16", z: -300 }, lt: { h: ["#b8c8ff", "#3a4a7a"], hi: 0.8, d: "#cfe0ff", di: 0.7, dir: [-0.3, 1, 0.5] } }, items };
    },
    frame() {
      const items = [];
      P.forEach((p) => { if (!p.alive && p.fade <= 0) return; if (!p.alive && phase !== "fire") return; items.push({ t: "pawn", id: p.id, x: px(p.cx), y: px(p.cy), z: 0, k: p.k, n: p.name, face: 0.8, dead: p.alive ? 0 : 1, badge: p.alive && phase === "plan" && p.lock ? "✔" : "", sm: 14 }); });
      if (phase === "fire" && flash && left > 0.6) flash.lines.forEach((ln, i) => items.push(Object.assign(lineBeam(ln, left > 2.0 ? 0.35 : 0.9), { id: "lz" + i })));
      const lockN = alive().filter((p) => p.lock).length;
      return { w: W, h: H, items, hud: { title: phase === "plan" ? "Prépare ton coup en secret" : "Les lasers partent", timer: phase === "plan" ? Math.max(0, left) : null, chips: [{ text: "Tour " + Math.min(maxCycles, cycle + 1) + " sur " + maxCycles }, { text: alive().length + " en jeu" }, { text: phase === "plan" ? lockN + " prêts" : "" }].filter((c) => c.text) } };
    },
    priv(pid) {
      const p = P.find((x) => x.id === pid); if (!p) return null; if (!p.alive) return { dead: 1, deadText: "Tu es touché, regarde la suite" };
      const out = { err: p.err, items: [], bars: null };
      if (phase === "plan") {
        const [dx, dy] = dest(p); out.items.push({ t: "ring", id: "mydest", x: px(dx), y: px(dy), z: 2, r: 38, c: "#ffd23b", a: 0.95 }); out.items.push({ t: "disc", id: "mydisc", x: px(dx), y: px(dy), z: 2, r: 36, c: "#ffd23b", a: 0.22 });
        if (p.ln) { const v = Number(p.ln.slice(1)); out.items.push(p.ln[0] === "r" ? { t: "beam", id: "mypre", x: 0, y: px(v), z: 12, x2: W, y2: px(v), z2: 12, w: 10, c: "#ffd23b", a: 0.55 } : { t: "beam", id: "mypre", x: px(v), y: 0, z: 12, x2: px(v), y2: H, z2: 12, w: 10, c: "#ffd23b", a: 0.55 }); }
        const mvb = [["X", "Rester"], ["N", "Haut"], ["S", "Bas"], ["W", "Gauche"], ["E", "Droite"]].map(([id, t]) => ({ id: "mv" + id, t, sel: p.mv === id, dis: p.lock }));
        const rows = [], cols = []; for (let i = 0; i < S; i++) { rows.push({ id: "lnr" + i, t: "Ligne " + (i + 1), sel: p.ln === "r" + i, dis: p.lock }); cols.push({ id: "lnc" + i, t: "Colonne " + String.fromCharCode(65 + i), sel: p.ln === "c" + i, dis: p.lock }); }
        out.ui = { title: "Choisis en secret", groups: [{ label: "Où te déplacer", btns: mvb }, { label: "Quelle ligne tirer", btns: rows.concat(cols).concat([{ id: "lnnone", t: "Aucun tir", sel: p.ln === null, dis: p.lock }]) }], lock: { id: "lock", t: p.lock ? "Prêt" : "Valider", dis: p.lock } };
      }
      return out;
    },
    onAct(pid, m) {
      const p = P.find((x) => x.id === pid); if (!p || !p.alive || phase !== "plan" || p.lock) return;
      if (m.type === "click") { // un clic sur une case voisine ou sur la même case règle le déplacement
        const c = Math.floor(m.x / T), r = Math.floor(m.y / T); const dc = c - p.cx, dr = r - p.cy; if (Math.abs(dc) + Math.abs(dr) <= 1) { p.mv = dc === 1 ? "E" : dc === -1 ? "W" : dr === 1 ? "S" : dr === -1 ? "N" : "X"; p.err = ""; } return;
      }
      if (m.type !== "btn") return; const id = m.id || "";
      if (id.startsWith("mv") && DIRS[id.slice(2)]) { p.mv = id.slice(2); p.err = ""; }
      else if (id === "lnnone") { p.ln = null; p.err = ""; }
      else if (/^ln[rc]\d$/.test(id)) { const k = id[2], v = Number(id.slice(3)); if (v < S) { p.ln = k + v; p.err = ""; } }
      else if (id === "lock") tryLock(p);
    },
    ranking() { const al = alive().map((p) => p.id); const bonus = {}, notes = {}; P.forEach((p) => { if (p.kills) { bonus[p.id] = Math.min(2, p.kills); notes[p.id] = p.kills + " touché" + (p.kills > 1 ? "s" : ""); } else notes[p.id] = p.alive ? "Encore debout" : "Touché"; }); return { groups: U.rankFromFalls(P.map((p) => p.id), falls, al), bonus, notes, headline: "🔦 Le dernier à l'abri des lasers" }; },
  };
  return inst;
};

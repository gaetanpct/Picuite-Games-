// Lasers invisibles. Déplacement et laser choisis en secret, tout part en même temps.
const U = require("../pg-util.js");
const CS = 62, OX = 70, OY = 70;
const DIRS = { N: [0, -1], S: [0, 1], W: [-1, 0], E: [1, 0], X: [0, 0] };
exports.create = function (ctx) {
  const rnd = ctx.rnd; const n = ctx.n; const S = Math.max(5, Math.min(9, n + 3)); const W = OX + S * CS + 20, H = OY + S * CS + 20;
  const free = U.shuffle(Array.from({ length: S * S }, (_, i) => i), rnd);
  const P = ctx.players.map((m, i) => ({ id: m.id, k: m.color, name: m.name, cx: free[i] % S, cy: Math.floor(free[i] / S), alive: true, mv: "X", ln: null, lock: false, err: "", kills: 0 }));
  const falls = []; let cycle = 0, phase = "plan", left = 14 * ctx.pace, flash = null, shown = false;
  const alive = () => P.filter((p) => p.alive);
  const dest = (p) => { const d = DIRS[p.mv]; const x = p.cx + d[0], y = p.cy + d[1]; return x < 0 || y < 0 || x >= S || y >= S ? [p.cx, p.cy] : [x, y]; };
  const onLine = (ln, x, y) => (ln[0] === "r" ? y === Number(ln.slice(1)) : x === Number(ln.slice(1)));
  function tryLock(p) { if (p.lock) return; if (p.ln) { const [x, y] = dest(p); if (onLine(p.ln, x, y)) { p.err = "Ton laser te toucherait, change de ligne ou de déplacement."; return; } } p.err = ""; p.lock = true; }
  function resolve() {
    const A = alive(); A.forEach((p) => { const d = dest(p); p.cx = d[0]; p.cy = d[1]; });
    const lines = A.filter((p) => p.ln).map((p) => ({ ln: p.ln, by: p.id }));
    const dead = []; A.forEach((p) => { const hit = lines.filter((l) => onLine(l.ln, p.cx, p.cy)); if (hit.length) { dead.push(p); hit.forEach((l) => { const o = P.find((q) => q.id === l.by); if (o && o !== p) o.kills++; }); } });
    dead.forEach((p) => { p.alive = false; }); if (dead.length) falls.push(dead.map((p) => p.id));
    flash = { lines: lines.map((l) => l.ln), dead: dead.map((p) => ({ x: p.cx, y: p.cy, k: p.k })) };
    phase = "fire"; left = 2.4; shown = false;
    if (!lines.length) ctx.announce("Personne n'a tiré", 1800); else if (!dead.length) ctx.announce("Tous les lasers sont passés à côté", 2000); else ctx.announce(dead.map((p) => p.name).join(" et ") + (dead.length > 1 ? " sont touchés" : " est touché"), 2200);
  }
  const inst = {
    done: false,
    update(dt) {
      left -= dt;
      if (phase === "plan") {
        alive().forEach((p) => {
          if (p.lock) return; const i = ctx.input(p.id); const e = ctx.edge(p.id);
          if (i.x < 0) p.mv = "W"; else if (i.x > 0) p.mv = "E"; else if (i.y < 0) p.mv = "N"; else if (i.y > 0) p.mv = "S"; if (e.b) p.mv = "X"; if (e.a) tryLock(p);
        });
        const A = alive().filter((p) => ctx.present(p.id));
        if (left <= 0 || (A.length && A.every((p) => p.lock))) resolve();
      } else if (phase === "fire") {
        if (left <= 0) {
          cycle++; if (alive().length <= 1 || cycle >= 6) { inst.done = true; return; }
          alive().forEach((p) => { p.mv = "X"; p.ln = null; p.lock = false; p.err = ""; }); phase = "plan"; left = Math.max(8, 13 - cycle) * ctx.pace; flash = null;
        }
      }
    },
    frame() {
      const items = []; const cells = []; for (let i = 0; i < S * S; i++) cells.push(0);
      items.push({ t: "grid", x: OX, y: OY, cs: CS, cols: S, rows: S, cells, pal: ["#2b3a55"], sym: [] });
      for (let i = 0; i < S; i++) { items.push({ t: "text", x: OX - 24, y: OY + i * CS + CS / 2 + 6, v: String(i + 1), c: "#9fb3d1", s: 20 }); items.push({ t: "text", x: OX + i * CS + CS / 2, y: OY - 20, v: String.fromCharCode(65 + i), c: "#9fb3d1", s: 20 }); }
      if (phase === "fire" && flash) {
        flash.lines.forEach((ln) => { const v = Number(ln.slice(1)); if (ln[0] === "r") items.push({ t: "rect", x: OX, y: OY + v * CS + CS / 2 - 8, w: S * CS, h: 16, c: "#ff3b3b", a: 0.85 }); else items.push({ t: "rect", x: OX + v * CS + CS / 2 - 8, y: OY, w: 16, h: S * CS, c: "#ff3b3b", a: 0.85 }); });
        alive().forEach((p) => items.push({ t: "pawn", id: p.id, x: OX + p.cx * CS + CS / 2, y: OY + p.cy * CS + CS / 2, k: p.k, n: p.name, r: 20 }));
        flash.dead.forEach((d) => items.push({ t: "text", x: OX + d.x * CS + CS / 2, y: OY + d.y * CS + CS / 2 + 10, v: "💥", s: 34 }));
      }
      const lockN = alive().filter((p) => p.lock).length;
      return { w: W, h: H, bg: "#121a2b", items, hud: { title: phase === "plan" ? "Prépare ton coup en secret" : "Les lasers partent", timer: phase === "plan" ? Math.max(0, left) : null, chips: [{ text: alive().length + " en jeu" }, { text: lockN + " prêts" }] } };
    },
    priv(pid) {
      const p = P.find((x) => x.id === pid); if (!p) return null;
      if (!p.alive) return { dead: true };
      const out = { me: { x: OX + p.cx * CS + CS / 2, y: OY + p.cy * CS + CS / 2, k: p.k }, err: p.err, lock: p.lock };
      if (phase === "plan") {
        const [dx, dy] = dest(p); out.dest = { x: OX + dx * CS + CS / 2, y: OY + dy * CS + CS / 2 };
        if (p.ln) out.preview = p.ln[0] === "r" ? { t: "rect", x: OX, y: OY + Number(p.ln.slice(1)) * CS + CS / 2 - 5, w: S * CS, h: 10, c: "#ffd23b", a: 0.6 } : { t: "rect", x: OX + Number(p.ln.slice(1)) * CS + CS / 2 - 5, y: OY, w: 10, h: S * CS, c: "#ffd23b", a: 0.6 };
        const mvb = [["X", "Rester"], ["N", "Haut"], ["S", "Bas"], ["W", "Gauche"], ["E", "Droite"]].map(([id, t]) => ({ id: "mv" + id, t, sel: p.mv === id, dis: p.lock }));
        const rows = [], cols = []; for (let i = 0; i < S; i++) { rows.push({ id: "lnr" + i, t: "Ligne " + (i + 1), sel: p.ln === "r" + i, dis: p.lock }); cols.push({ id: "lnc" + i, t: "Colonne " + String.fromCharCode(65 + i), sel: p.ln === "c" + i, dis: p.lock }); }
        out.ui = { groups: [{ label: "Où te déplacer", btns: mvb }, { label: "Quelle ligne tirer", btns: rows.concat(cols).concat([{ id: "lnnone", t: "Aucun tir", sel: p.ln === null, dis: p.lock }]) }], lock: { id: "lock", t: p.lock ? "Prêt" : "Valider", dis: p.lock } };
      }
      return out;
    },
    onAct(pid, m) {
      const p = P.find((x) => x.id === pid); if (!p || !p.alive || phase !== "plan" || p.lock || m.type !== "btn") return; const id = m.id || "";
      if (id.startsWith("mv") && DIRS[id.slice(2)]) { p.mv = id.slice(2); p.err = ""; }
      else if (id === "lnnone") { p.ln = null; p.err = ""; }
      else if (/^ln[rc]\d$/.test(id)) { const k = id[2], v = Number(id.slice(3)); if (v < S) { p.ln = k + v; p.err = ""; } }
      else if (id === "lock") tryLock(p);
    },
    ranking() { const al = alive().map((p) => p.id); const bonus = {}, notes = {}; P.forEach((p) => { if (p.kills) { bonus[p.id] = Math.min(2, p.kills); notes[p.id] = p.kills + " touché" + (p.kills > 1 ? "s" : ""); } }); return { groups: U.rankFromFalls(P.map((p) => p.id), falls, al), bonus, notes }; },
  };
  return inst;
};

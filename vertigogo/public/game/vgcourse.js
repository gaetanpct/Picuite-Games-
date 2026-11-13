// ============================================================
// VERTIGOGO — Génération de parcours à partir d'une graine (partagé client, serveur et tests)
// Le parcours monte en spirale carrée autour d'un noyau central. Chaque module est calibré
// sur les vrais sauts du contrôleur, puis le serveur vérifie tout avec un pilote automatique.
// ============================================================
(function (root, factory) { if (typeof module === "object" && module.exports) module.exports = factory(require("./vgsim.js"), require("./vgprops.js")); else root.VgCourse = factory(root.VgSim, root.VgProps); })(typeof self !== "undefined" ? self : this, function (S, PR) {
  const THEMES = ["jardin", "rue", "chantier", "maison", "cuisine", "toits", "cimetiere", "nuages"];
  const NAMES = ["Le jardin", "La rue", "Le chantier", "La maison géante", "La cuisine géante", "Les toits", "Le cimetière", "Les nuages"];
  const BLURBS = ["Des pins, des rochers et des champignons qui font rebondir.", "Des voitures, des bennes et des poteaux tout fins.", "Des caisses, des poutres et des palettes empilées.", "Des chaises, des tables, un canapé et un lit trampoline.", "Un fourneau, un frigo, des marmites et un tapis roulant.", "Des immeubles de hauteurs différentes et des trampolines.", "Des arbres morts, des citrouilles et des tombes qui s'effritent.", "Des nuages moelleux et des bonds géants vers le sommet."];
  const WEIGHTS = [
    { prop: 8, steps: 2, gaps: 2, narrow: 1, crumble: 1, tramp: 2 },
    { prop: 8, gaps: 2, steps: 1, wall: 1, mover: 2, lift: 1, tramp: 2 },
    { prop: 7, narrow: 2, lift: 2, sweeper: 2, gaps: 1, mover: 1, wall: 1, tramp: 2 },
    { prop: 8, steps: 2, wall: 2, spring: 1, tramp: 2, narrow: 1 },
    { prop: 7, mover: 2, ice: 2, sweeper: 1, gaps: 1, steps: 1, tramp: 2 },
    { prop: 7, gaps: 3, wall: 2, narrow: 1, tramp: 3, mover: 1 },
    { prop: 7, crumble: 3, narrow: 1, sweeper: 1, steps: 1, spring: 1, tramp: 1 },
    { prop: 6, crumble: 3, spring: 2, tramp: 3, gaps: 1, lift: 1, mover: 1, ice: 1 },
  ];
  const DIFF = {
    facile: { gap: 0.58, wall: 2.1, narrow: 1.6, crumble: 0.85, per: 6.2, zoneBonus: 0.06 },
    normal: { gap: 0.7, wall: 2.35, narrow: 1.3, crumble: 0.65, per: 5.2, zoneBonus: 0.08 },
    difficile: { gap: 0.82, wall: 2.55, narrow: 1.05, crumble: 0.5, per: 4.2, zoneBonus: 0.08 },
  };

  // ---------- hasard ----------
  function hash(str) { let h = 1779033703 ^ String(str).length; const s = String(str); for (let i = 0; i < s.length; i++) { h = Math.imul(h ^ s.charCodeAt(i), 3432918353); h = (h << 13) | (h >>> 19); } h = Math.imul(h ^ (h >>> 16), 2246822507); h = Math.imul(h ^ (h >>> 13), 3266489909); return (h ^ (h >>> 16)) >>> 0; }
  function rng(seed) { let a = typeof seed === "number" ? seed >>> 0 : hash(seed); return function () { a = (a + 0x6D2B79F5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }

  // ---------- enveloppe des sauts, mesurée sur le vrai contrôleur ----------
  let ENV = null;
  function trial(gap, dy, run) {
    const A = { x0: -6, x1: 0, y0: -1, y1: 0, z0: -2, z1: 2, k: "solid" }, B = { x0: gap, x1: gap + 40, y0: -1 + dy, y1: dy, z0: -2, z1: 2, k: "solid" };
    const W = S.makeWorld({ boxes: [A, B] }); const P = S.newPlayer(-run, 0, 0, 0); P.fx = 1; P.fz = 0; P.noGrab = true; let j = false;
    for (let i = 0; i < 300; i++) { W.t = i * S.DT; S.prepare(W); if (P.x > -0.02) j = true; S.stepPlayer(W, P, { mx: 1, mz: 0, jump: j }, []); if (P.st === "ground" && P.on === 1) return P.x > gap + 0.3; if (P.y < dy - 8) return false; }
    return false;
  }
  function envelope() {
    if (ENV) return ENV; const dys = [-4, -2, -1, 0, 0.5, 1, 1.4, 1.8]; ENV = { dys, gaps: [] };
    dys.forEach((dy) => { let m = 0; for (let g = 0.5; g < 9; g += 0.1) { if (trial(g, dy, 2.5)) m = g; else if (g > m + 1.2) break; } ENV.gaps.push(m); }); return ENV;
  }
  function maxGap(dy) { const E = envelope(); if (dy <= E.dys[0]) return E.gaps[0]; for (let i = 1; i < E.dys.length; i++) if (dy <= E.dys[i]) { const k = (dy - E.dys[i - 1]) / (E.dys[i] - E.dys[i - 1]); return E.gaps[i - 1] + (E.gaps[i] - E.gaps[i - 1]) * k; } return E.gaps[E.gaps.length - 1] * 0.5; }

  // ---------- génération ----------
  const DIRS = [[1, 0], [0, 1], [-1, 0], [0, -1]];
  function generate(opts) {
    opts = opts || {}; const seed = opts.seed == null ? 1 : opts.seed; const salt = opts.salt | 0; const diffName = DIFF[opts.diff] ? opts.diff : "normal"; const D = DIFF[diffName];
    const nzReq = [4, 6, 8].includes(opts.zones | 0) ? opts.zones | 0 : 6; const R = rng(hash(String(seed) + "|" + nzReq + "|" + diffName + "|" + salt + "|" + (opts.pool ? opts.pool.join("") : "")));
    const pick = (lo, hi) => lo + (hi - lo) * R(); const ri = (lo, hi) => Math.floor(pick(lo, hi + 1)); const sgn = () => (R() < 0.5 ? -1 : 1);
    // quelles zones, toujours dans l'ordre de montée
    let pool = Array.from(new Set((opts.pool && opts.pool.length ? opts.pool : [0, 1, 2, 3, 4, 5, 6, 7]).map(Number).filter((v) => v >= 0 && v <= 7))).sort((a, b) => a - b); if (!pool.length) pool = [0, 1, 2, 3, 4, 5, 6, 7];
    let ids; if (pool.length <= nzReq) ids = pool.slice(); else { const keep = new Set([pool[0], pool[pool.length - 1]]); while (keep.size < nzReq) keep.add(pool[ri(1, pool.length - 2)]); ids = pool.filter((v) => keep.has(v)); }
    const nz = ids.length;
    const C = { boxes: [], sweeps: [], nodes: [], zones: [], objs: [], seed, opts: { seed, salt, diff: diffName, zones: nzReq, pool: opts.pool || null } }; const boxes = C.boxes;
    const HZ = nz <= 3 ? 42 : nz === 4 ? 38 : nz <= 6 ? 31 : 26; const Hs = 12 + ri(0, 2) * 1.5; // demi-côté de la spirale
    // état du curseur
    let dir = 0, lx = -Hs, lz = -Hs, ltop = 0, lw = 8, ld = 8, lastBox = null; let zoneIdx = 0, zStartY = 0, zNodeStart = 0, side = 0, halfPlaced = false, nextCp = 0;
    const gapF = (z) => Math.min(0.86, D.gap + D.zoneBonus * (z / Math.max(1, nz - 1)));
    function mkBox(cx, cz, d, w, top, th, k, extra) {
      const f = DIRS[dir]; const hx = f[0] ? d / 2 : w / 2, hz = f[0] ? w / 2 : d / 2;
      const b = Object.assign({ x0: cx - hx, x1: cx + hx, z0: cz - hz, z1: cz + hz, y0: top - th, y1: top, k: k || "solid", zone: zoneIdx, w, d }, extra || {}); return b;
    }
    function reach(b) { // boîte englobante sur toute la course du mobile
      let o = { x0: b.x0, x1: b.x1, y0: b.y0, y1: b.y1, z0: b.z0, z1: b.z1 }; if (b.mv) { const a = b.mv.amp; if (b.mv.ax === "x") { o.x0 -= a; o.x1 += a; } else if (b.mv.ax === "y") { o.y0 -= a; o.y1 += a; } else { o.z0 -= a; o.z1 += a; } } return o;
    }
    function conflict(b, ignoreLast) { const r = reach(b); const n = boxes.length; const lb = ignoreLast && n ? boxes[n - 1] : null; for (let i = 0; i < n - (ignoreLast || 0); i++) { if (lb && lb.obj != null && boxes[i].obj === lb.obj) continue; const e = reach(boxes[i]); if (r.x1 + 0.5 > e.x0 && r.x0 - 0.5 < e.x1 && r.z1 + 0.5 > e.z0 && r.z0 - 0.5 < e.z1 && r.y1 + 3.0 > e.y0 && r.y0 - 4.4 < e.y1) return true; } return false; }
    function commit(b, isNode) { b.i = boxes.length; boxes.push(b); if (isNode !== false) C.nodes.push(b.i); return b; }
    function front(box) { const f = DIRS[dir]; return f[0] ? (f[0] > 0 ? box.x1 : box.x0) : (f[1] > 0 ? box.z1 : box.z0); }
    // place une plateforme à "gap" de la précédente (bord à bord), lat = décalage latéral
    function place(gap, dy, w, d, lat, k, extra, th) {
      const runF = Math.min(1, 0.52 + ld / 5); gap *= runF; const f = DIRS[dir], n = [-f[1], f[0]]; const farX = lx + f[0] * ld / 2, farZ = lz + f[1] * ld / 2; const c = [farX + f[0] * (gap + d / 2) + n[0] * lat, farZ + f[1] * (gap + d / 2) + n[1] * lat];
      return mkBox(c[0], c[1], d, w, ltop + dy, th || pick(0.9, 1.2), k, extra);
    }
    function adopt(b) { lx = (b.x0 + b.x1) / 2; lz = (b.z0 + b.z1) / 2; ltop = b.y1; lastBox = b; const f = DIRS[dir]; ld = f[0] ? b.x1 - b.x0 : b.z1 - b.z0; lw = f[0] ? b.z1 - b.z0 : b.x1 - b.x0; }
    const sg = (dy, frac) => Math.max(0.4, maxGap(dy) * frac);

    // départ
    zoneIdx = 0; const startB = mkBox(lx, lz, 9, 9, 0, 1.4, "solid", { role: "start" }); commit(startB); adopt(startB); C.start = { x: lx, y: 0, z: lz, ry: Math.atan2(DIRS[0][0], DIRS[0][1]) }; C.startBox = startB.i;
    C.zones.push({ i: 0, id: ids[0], theme: THEMES[ids[0]], name: NAMES[ids[0]], blurb: BLURBS[ids[0]], y0: 0, y1: 0, rest: startB.i, cps: [] });
    const ring = { cx: 0, cz: 0 };
    function cornerTarget() { // coin idéal de la spirale vers lequel on va
      const cs = [[Hs, -Hs], [Hs, Hs], [-Hs, Hs], [-Hs, -Hs]]; return cs[dir];
    }
    const MODS = {
      steps(z) { const n = ri(3, 5); let ok = true; for (let i = 0; i < n; i++) { const dy = pick(0.3, 1.3), g = sg(dy, gapF(z)) * pick(0.55, 0.9), w = pick(2.4, 4.2), d = pick(2.3, 3.6); const b = place(g, dy, w, d, pick(-1, 1) * 0.8, "solid"); if (conflict(b, 1)) return false; commit(b); adopt(b); } return ok; },
      gaps(z) { const n = ri(2, 3); for (let i = 0; i < n; i++) { const dy = pick(-0.5, 0.5), g = sg(dy, gapF(z)) * pick(0.82, 1.0), b = place(g, dy, pick(2.6, 3.6), pick(2.6, 3.4), pick(-0.7, 0.7), "solid"); if (conflict(b, 1)) return false; commit(b); adopt(b); } return true; },
      narrow(z) { const n = ri(2, 3); for (let i = 0; i < n; i++) { const dy = pick(-0.2, 0.9), g = pick(0.8, 1.8) * Math.min(1, gapF(z) + 0.2); const b = place(Math.min(g, sg(dy, 0.8)), dy, D.narrow, pick(3.8, 6), 0, "solid"); if (conflict(b, 1)) return false; commit(b); adopt(b); } return true; },
      wall(z) { const dy = pick(1.7, D.wall), b = place(pick(0.1, 0.5), dy, pick(3, 4.6), pick(2.8, 3.6), pick(-0.6, 0.6), "solid", null, 1.6); if (conflict(b, 1)) return false; commit(b); adopt(b); return true; },
      crumble(z) { const n = ri(3, 4); const made = []; for (let i = 0; i < n; i++) { const dy = pick(0, 0.8), g = sg(dy, gapF(z)) * pick(0.5, 0.78), b = place(g, dy, pick(2.6, 3.4), pick(2.5, 3.1), pick(-0.7, 0.7), "crumble", { cr: { delay: D.crumble, back: 4.2 } }, 0.8); if (conflict(b, 1)) return false; commit(b); adopt(b); } return true; },
      ice(z) { const n = ri(2, 3); for (let i = 0; i < n; i++) { const dy = pick(0, 0.6), g = Math.min(sg(dy, 0.6), 2.0) * pick(0.5, 0.9), b = place(g, dy, pick(2.4, 3.2), pick(3.4, 4.6), pick(-0.5, 0.5), "ice"); if (conflict(b, 1)) return false; commit(b); adopt(b); } return true; },
      spring(z) {
        const f = DIRS[dir]; const A = lastBox; // plot de ressort sur la plateforme courante, près du bord avant
        if (!A || A.k !== "solid" || ld < 2.4 || lw < 2.2) { const dy = pick(0.2, 0.8), b = place(sg(dy, 0.6), dy, 3.6, 3.4, 0, "solid"); if (conflict(b, 1)) return false; commit(b); adopt(b); }
        const A2 = lastBox; const px = lx + f[0] * (ld / 2 - 1.0), pz = lz + f[1] * (ld / 2 - 1.0); const pad = { x0: px - 0.9, x1: px + 0.9, z0: pz - 0.9, z1: pz + 0.9, y0: ltop, y1: ltop + 0.26, k: "spring", zone: zoneIdx, w: 1.8, d: 1.8 }; commit(pad);
        // arrivée en hauteur
        const dy = pick(2.6, 4.2) - 0.26, g = pick(1.4, 3.0) + (dy - 2.6) * 0.3, b = place(g, dy + 0.26, pick(3, 4.4), pick(3, 3.8), pick(-0.8, 0.8), "solid", null, 1.4); if (conflict(b, 2)) { boxes.pop(); C.nodes.pop(); return false; } commit(b); adopt(b); return true;
      },
      mover(z) {
        const A = lastBox; const amp = pick(1.7, 2.6), dm = 3.0, w = pick(2.8, 3.6), g1 = sg(0, gapF(z) * 0.62); const f = DIRS[dir];
        const dyM = pick(0, 0.6); const neutral = g1 + amp + dm / 2; const m = place(neutral - dm / 2, dyM, w, dm, 0, "mover", { mv: { ax: f[0] ? "x" : "z", amp, per: D.per * pick(0.9, 1.2), ph: R() } }, 0.8);
        if (conflict(m, 1)) return false; commit(m);
        const far = g1 + 2 * amp + dm; const b = (function () { const sv = [lx, lz, ltop, ld, lw]; lx = lx; return place(far + g1 - 0, dyM * 0.5, pick(3, 4), pick(3, 3.8), pick(-0.5, 0.5), "solid"); })();
        if (conflict(b, 2)) { boxes.pop(); C.nodes.pop(); return false; } commit(b); adopt(b); return true;
      },
      lift(z) {
        const amp = pick(1.2, 1.6), g1 = sg(1.5, gapF(z) * 0.55), f = DIRS[dir]; const ytop0 = ltop + amp;
        const L = place(g1, amp, pick(2.8, 3.4), 3.0, 0, "lift", { mv: { ax: "y", amp, per: D.per * pick(1.0, 1.3), ph: R() } }, 0.8);
        if (conflict(L, 1)) return false; commit(L);
        const savedTop = ltop; const b = (function () { const f2 = DIRS[dir], n = [-f2[1], f2[0]]; const farX = (L.x0 + L.x1) / 2 + f2[0] * L.d / 2, farZ = (L.z0 + L.z1) / 2 + f2[1] * L.d / 2; const d = pick(3, 3.8), w = pick(3, 4); const c = [farX + f2[0] * (g1 + d / 2), farZ + f2[1] * (g1 + d / 2)]; return mkBox(c[0], c[1], d, w, ltop + 2 * amp + 0.35, 1.4, "solid"); })();
        if (conflict(b, 2)) { boxes.pop(); C.nodes.pop(); return false; } commit(b); adopt(b); return true;
      },
      sweeper(z) {
        const dy = pick(0, 0.5), b = place(sg(dy, gapF(z) * 0.7), dy, 6.4, 6.4, 0, "solid", null, 1.4); if (conflict(b, 1)) return false; commit(b); adopt(b);
        const dirS = sgn(); C.sweeps.push({ x: lx, z: lz, y: ltop, len: 2.9, w: dirS * (diffName === "facile" ? 1.0 : diffName === "normal" ? 1.3 : 1.65), ph: R() * 6.28, h: 0.55, th: 0.17, i: C.sweeps.length, box: b.i });
        const dy2 = pick(0, 0.6), e = place(sg(dy2, gapF(z) * 0.7), dy2, pick(3, 4), 3.2, 0, "solid"); if (conflict(e, 2)) { C.sweeps.pop(); boxes.pop(); C.nodes.pop(); return false; } commit(e); adopt(e); return true;
      },
    };
    // ---- objets du quotidien : chaque objet a ses propres boîtes de collision ----
    let recent = [];
    function placeTpl(T, z, o) {
      o = o || {}; const f = pick(0.92, 1.1); const L = PR.layout(T, f); const E = L.boxes[L.route[0]]; const fv = DIRS[dir], nv = [-fv[1], fv[0]];
      const dy = o.dy != null ? o.dy : pick(-0.3, 0.9); const g = (o.gap != null ? o.gap : Math.max(0.5, sg(dy, gapF(z)) * pick(0.55, 0.92))) * Math.min(1, 0.52 + ld / 5); const lat = pick(-0.7, 0.7);
      const farF = (lx + fv[0] * ld / 2) * fv[0] + (lz + fv[1] * ld / 2) * fv[1]; const cN = lx * nv[0] + lz * nv[1];
      const pf = farF + g - E.u0, pn = cN + lat - (E.v0 + E.v1) / 2, py = ltop + dy - E.y1;
      const wb = L.boxes.map((b) => {
        const xs = [], zs = []; [[b.u0, b.v0], [b.u1, b.v0], [b.u0, b.v1], [b.u1, b.v1]].forEach((q) => { xs.push(fv[0] * (pf + q[0]) + nv[0] * (pn + q[1])); zs.push(fv[1] * (pf + q[0]) + nv[1] * (pn + q[1])); });
        const w = { x0: Math.min.apply(null, xs), x1: Math.max.apply(null, xs), z0: Math.min.apply(null, zs), z1: Math.max.apply(null, zs), y0: py + b.y0, y1: py + b.y1, k: b.k || "solid", zone: zoneIdx, w: Math.abs(b.v1 - b.v0), d: Math.abs(b.u1 - b.u0) };
        if (b.sv) w.sv = b.sv; if (b.cv) { const sgn = R() < 0.5 ? -1 : 1; w.cv = [fv[0] * 2.3 * sgn, fv[1] * 2.3 * sgn]; w.cvs = sgn; } if (b.node === false) w.nonode = 1; return w;
      });
      for (let i = 0; i < wb.length; i++) if (conflict(wb[i], 1)) return false;
      const id = C.objs.length; const base = boxes.length; wb.forEach((w) => { w.obj = id; commit(w, false); });
      L.route.forEach((ri) => C.nodes.push(base + ri));
      const ang = Math.atan2(-fv[1], fv[0]); C.objs.push({ t: T.id, proc: T.proc || null, style: T.style || null, b0: base, nb: wb.length, px: fv[0] * pf + nv[0] * pn, py, pz: fv[1] * pf + nv[1] * pn, ang, f, zone: zoneIdx, parts: L.parts });
      adopt(boxes[base + L.route[L.route.length - 1]]); return true;
    }
    function pickTpl(z) {
      const zid = ids[z]; const c = PR.TPL.filter((t) => t.w > 0 && t.zones.indexOf(zid) >= 0); if (!c.length) return null;
      let tot = 0; const ws = c.map((t) => { const w = t.w * (recent.indexOf(t.id) >= 0 ? 0.12 : 1); tot += w; return w; }); let r = R() * tot; for (let i = 0; i < c.length; i++) { r -= ws[i]; if (r <= 0) { recent.push(c[i].id); if (recent.length > 4) recent.shift(); return c[i]; } } return c[c.length - 1];
    }
    MODS.prop = function (z) { const T = pickTpl(z); return T ? placeTpl(T, z) : false; };
    MODS.tramp = function (z) { return placeTpl(PR.byId("trampoline"), z, { dy: pick(0, 0.6), gap: pick(0.9, 1.8) }); };
    let lastMod = "";
    function weightedPick(z) { const w = WEIGHTS[ids[z]]; let tot = 0; const eff = {}; for (const k in w) { eff[k] = w[k] * ((k === "tramp" || k === "spring") && (lastMod === "tramp" || lastMod === "spring" || lastMod === "mover") ? 0 : k === lastMod && k !== "prop" ? 0.35 : 1); tot += eff[k]; } let r = R() * tot; for (const k in eff) { r -= eff[k]; if (r <= 0) return k; } return "steps"; }
    function snapshotState() { return { dir, lx, lz, ltop, lw, ld, lastBox, nb: boxes.length, nn: C.nodes.length, ns: C.sweeps.length, no: C.objs.length }; }
    function restore(s) { dir = s.dir; lx = s.lx; lz = s.lz; ltop = s.ltop; lw = s.lw; ld = s.ld; lastBox = s.lastBox; boxes.length = s.nb; C.nodes.length = s.nn; C.sweeps.length = s.ns; C.objs.length = s.no; }
    function corner(big, rest) { // plateforme d'angle, ou de repos, puis virage à droite
      const f = DIRS[dir], n = [-f[1], f[0]]; const t = cornerTarget(); const size = big ? 7.4 : 4.6;
      // on vise le coin idéal, en bornant la distance de saut
      const farX = lx + f[0] * ld / 2, farZ = lz + f[1] * ld / 2; let along = (t[0] - farX) * f[0] + (t[1] - farZ) * f[1]; let lat = (t[0] - lx) * n[0] + (t[1] - lz) * n[1];
      const maxG = Math.max(1.2, sg(0.4, gapF(zoneIdx)) * 0.9); lat = Math.max(-1.8, Math.min(1.8, lat)); let gap = Math.max(0.9, Math.min(Math.sqrt(Math.max(0.6, maxG * maxG - lat * lat * 1.4)), along - size / 2));
      const dy = rest ? 0.6 : pick(0.2, 0.9); const b = place(gap, dy, size, size, lat, "solid", rest ? { role: "rest" } : { role: "corner" }, rest ? 1.6 : 1.1);
      return b;
    }
    function remainingToCorner() { const f = DIRS[dir]; const t = cornerTarget(); const farX = lx + f[0] * ld / 2, farZ = lz + f[1] * ld / 2; return (t[0] - farX) * f[0] + (t[1] - farZ) * f[1]; }

    let guard = 0;
    for (let z = 0; z < nz; z++) {
      zoneIdx = z; const zc = C.zones[z] || (C.zones[z] = { i: z, id: ids[z], theme: THEMES[ids[z]], name: NAMES[ids[z]], blurb: BLURBS[ids[z]], y0: ltop, y1: ltop, rest: lastBox.i, cps: [] });
      zc.y0 = ltop; zc.rest = lastBox.i; const yTarget = ltop + HZ; let cpDone = false;
      while (guard++ < 2000) {
        const climbed = ltop - zc.y0; const rem = remainingToCorner();
        if (climbed >= HZ && rem < 14) { // fin de zone sur un angle, plateforme de repos
          const b = corner(true, true); if (conflict(b, 1)) { b.y0 -= 0; } b.zone = z; commit(b); adopt(b); zc.y1 = ltop; zc.restEnd = b.i; dir = (dir + 1) % 4; break; }
        if (rem < 9) { const b = corner(false, false); if (!conflict(b, 1)) { commit(b); adopt(b); dir = (dir + 1) % 4; side++; continue; } }
        // pas de module trop long près d'un angle : on se contente de marches
        const st0 = snapshotState(); let ok = false; let tries = 0;
        while (!ok && tries++ < 8) { const name = rem < 16 ? "steps" : weightedPick(z); ok = MODS[name](z); if (ok) lastMod = name; if (!ok) restore(st0); else if (!cpDone && climbed > HZ * 0.45 && lastBox.w >= 3 && lastBox.k === "solid") { cpDone = true; lastBox.cp = true; zc.cps.push(lastBox.i); } }
        if (!ok) { // dernier recours, marches simples vers le haut
          const b = place(sg(1.0, 0.5), 1.0, 3.4, 3.2, 0, "solid"); commit(b); adopt(b); }
      }
    }
    // sommet
    zoneIdx = nz - 1; const f = DIRS[dir]; const rem = remainingToCorner(); const top = place(Math.min(sg(0.6, 0.7), 3), 0.8, 9, 9, 0, "solid", { role: "summit" }, 2.0); commit(top); adopt(top);
    C.summit = top.i; C.summitTop = top.y1; C.height = top.y1; C.center = ring; C.half = Hs;
    C.zones.forEach((zz, i) => { zz.cx = 0; zz.cz = 0; if (!zz.y1) zz.y1 = zz.y0 + HZ; }); C.zones[nz - 1].y1 = top.y1;
    // checkpoints : repos de zone + plateformes marquées
    C.cps = []; C.zones.forEach((zz, i) => { if (i > 0) C.cps.push(zz.rest); zz.cps.forEach((c) => C.cps.push(c)); }); C.cps.sort((a, b) => boxes[a].y1 - boxes[b].y1);
    // normalise pour le monde
    boxes.forEach((b) => { b.th = b.y1 - b.y0; });
    return C;
  }

  // zone de la hauteur y
  function zoneAt(C, y) { let z = 0; for (let i = 0; i < C.zones.length; i++) if (y >= C.zones[i].y0 - 1.5) z = i; return z; }
  // rattrapage de zone en mode classique, c'est le repos de la zone en cours
  function netFor(C, bestY) { let r = C.startBox; for (let i = 0; i < C.zones.length; i++) { if (bestY >= C.boxes[C.zones[i].rest].y1 - 0.5) r = C.zones[i].rest; } return r; }

  return { THEMES, NAMES, BLURBS, DIFF, generate, maxGap, envelope, rng, hash, zoneAt, netFor, trial };
});

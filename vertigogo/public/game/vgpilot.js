// ============================================================
// VERTIGOGO — Pilote automatique (bots et vérification des parcours)
// Il joue avec le même contrôleur que les humains. Avant chaque saut il simule le saut avec la vraie physique.
// ============================================================
(function (root, factory) { if (typeof module === "object" && module.exports) module.exports = factory(require("./vgsim.js")); else root.VgPilot = factory(root.VgSim); })(typeof self !== "undefined" ? self : this, function (S) {
  const LEVELS = {
    debutant: { id: "debutant", label: "Apprenti", err: 0.2, pace: 0.8, lag: 0.35, noise: 0.35 },
    moyen: { id: "moyen", label: "Habitué", err: 0.1, pace: 0.9, lag: 0.18, noise: 0.18 },
    champion: { id: "champion", label: "Champion", err: 0.04, pace: 1, lag: 0.06, noise: 0.06 },
    prodige: { id: "prodige", label: "Prodige", err: 0, pace: 1, lag: 0, noise: 0 },
  };
  const LEVEL_LIST = Object.values(LEVELS).map((l) => ({ id: l.id, label: l.label }));
  const tmpEv = [];

  function topCenter(b) { return [(b.X0 + b.X1) / 2, (b.Z0 + b.Z1) / 2]; }
  // nœud de la route correspondant à une boîte
  function mapNodes(C) { const m = new Map(); C.nodes.forEach((bi, k) => m.set(bi, k)); return m; }

  function create(W, C, level, rnd) {
    const L = LEVELS[level] || LEVELS.moyen; const nodeOf = mapNodes(C); rnd = rnd || Math.random;
    return { W, C, L, rnd, nodeOf, cur: 0, run: false, wait: 0, tick: 0, ok: false, edge: null, lagT: 0, mistake: false, since: 0, last: -1, drop: false };
  }

  // essai de saut complet avec la vraie physique, renvoie vrai si l'on se réceptionne sur la boîte cible
  function trialJump(st, P, target, jumpNow) {
    const W = st.W; const t0 = W.t; const c = S.clonePlayer(P); const crSave = JSON.stringify(W.cr); let ok = false; let jumped = false;
    for (let i = 0; i < 100; i++) {
      W.t = t0 + (i + 1) * S.DT; S.prepare(W); const b = W.boxes[target]; const gx = (b.X0 + b.X1) / 2 - c.x, gz = (b.Z0 + b.Z1) / 2 - c.z; const gl = Math.hypot(gx, gz) || 1;
      let jump = true; if (!jumpNow && !jumped) jump = false; jumped = true;
      tmpEv.length = 0; S.stepPlayer(W, c, { mx: gx / gl, mz: gz / gl, jump }, tmpEv);
      if (c.st === "ground" && c.on === target) { ok = c.x > b.X0 + 0.3 && c.x < b.X1 - 0.3 && c.z > b.Z0 + 0.3 && c.z < b.Z1 - 0.3; if (b.X1 - b.X0 < 1.4 || b.Z1 - b.Z0 < 1.4) ok = true; break; } if (c.st === "hang" && c.hang.box === target) { ok = true; break; } if (c.st === "climb") { ok = c.climb.box === target; break; }
      if (c.y < b.Y1 - 6 && c.vy < 0) break; if (c.st === "ground" && i > 3) break;
    }
    W.cr = JSON.parse(crSave); W.t = t0 - S.DT; S.prepare(W); W.t = t0; S.prepare(W); return ok;
  }

  // l'essai doit aussi réussir avec un petit décalage de départ, pour éviter les réussites de justesse
  function nudge(P, ux, uz) { const c = S.clonePlayer(P); c.x -= ux * 0.06; c.z -= uz * 0.06; return c; }

  // entrée du pilote à cet instant
  function step(st, P) {
    const W = st.W, C = st.C, L = st.L; st.tick++; const inp = { mx: 0, mz: 0, jump: false, drop: false };
    // où sommes nous dans la route
    let here = -1; if (P.st === "ground" && P.on >= 0) here = st.nodeOf.has(P.on) ? st.nodeOf.get(P.on) : -1;
    if (P.st === "hang") { const k = st.nodeOf.get(P.hang.box); if (k !== undefined) { inp.jump = (st.tick % 12) < 2; if (k + 1 < st.cur) inp.drop = true; return inp; } }
    if (P.st === "climb") return inp;
    if (here >= 0) { if (here !== st.cur) { st.cur = here; st.run = false; st.wait = 0; st.mistake = false; st.lagT = 0; } st.since = 0; } else st.since += S.DT;
    const nextN = st.cur + 1; if (nextN >= C.nodes.length) { st.ok = true; return inp; }
    const target = C.nodes[nextN]; const tb = W.boxes[target]; const here0 = W.boxes[C.nodes[st.cur]];
    const tc = topCenter(tb);
    if (P.st === "air") { // en l'air, on vise la cible
      const gx = tc[0] - P.x, gz = tc[1] - P.z, gl = Math.hypot(gx, gz) || 1; inp.mx = gx / gl; inp.mz = gz / gl; inp.jump = true;
      if (L.noise > 0) { inp.mx += (st.rnd() - 0.5) * L.noise; inp.mz += (st.rnd() - 0.5) * L.noise; } return inp;
    }
    if (P.st !== "ground" || here < 0) { // perdu, on se dirige vers le nœud le plus proche
      return inp;
    }
    // ressort : on marche sur le plot, c'est lui qui lance
    if (tb.k === "spring") { const gx = tc[0] - P.x, gz = tc[1] - P.z, gl = Math.hypot(gx, gz) || 1; inp.mx = gx / gl * L.pace; inp.mz = gz / gl * L.pace; return inp; }
    // le nœud courant est un plot de ressort : il a déjà lancé
    if (here0.k === "spring") { inp.mx = 0; inp.mz = 0; return inp; }
    // saut vers la cible : on court vers le milieu du bord qui regarde la cible
    const ac = topCenter(here0); const ddx = tc[0] - ac[0], ddz = tc[1] - ac[1]; let ex, ez;
    if (Math.abs(ddx) >= Math.abs(ddz)) { ex = ddx > 0 ? here0.X1 - 0.15 : here0.X0 + 0.15; ez = Math.max(here0.Z0 + 0.25, Math.min(here0.Z1 - 0.25, tc[1])); } else { ez = ddz > 0 ? here0.Z1 - 0.15 : here0.Z0 + 0.15; ex = Math.max(here0.X0 + 0.25, Math.min(here0.X1 - 0.25, tc[0])); }
    const toEdge = Math.hypot(ex - P.x, ez - P.z); let ux = (ex - P.x) / (toEdge || 1), uz = (ez - P.z) / (toEdge || 1); if (toEdge < 0.05) { ux = Math.sign(ddx) * (Math.abs(ddx) >= Math.abs(ddz) ? 1 : 0); uz = Math.sign(ddz) * (Math.abs(ddx) >= Math.abs(ddz) ? 0 : 1); }
    // marche arrière pour prendre de l'élan
    if (!st.run) { const back = 2.4; const ax = Math.abs(ddx) >= Math.abs(ddz); const sx = ax ? Math.max(here0.X0 + 0.5, Math.min(here0.X1 - 0.5, ex - Math.sign(ddx) * (back + 0.3))) : Math.max(here0.X0 + 0.5, Math.min(here0.X1 - 0.5, ex)), sz = ax ? Math.max(here0.Z0 + 0.5, Math.min(here0.Z1 - 0.5, ez)) : Math.max(here0.Z0 + 0.5, Math.min(here0.Z1 - 0.5, ez - Math.sign(ddz) * (back + 0.3))); const d2 = Math.hypot(sx - P.x, sz - P.z); if (d2 > 0.5 && st.wait <= 0) { inp.mx = (sx - P.x) / d2 * L.pace; inp.mz = (sz - P.z) / d2 * L.pace; if (d2 < 0.8) st.run = true; return inp; } st.run = true; }
    if (st.wait > 0) { st.wait -= S.DT; if (st.wait <= 0) st.run = false; return inp; }
    inp.mx = ux * L.pace; inp.mz = uz * L.pace;
    const ready = st.tick % 2 === 0 && trialJump(st, P, target, true) && trialJump(st, nudge(P, ux, uz), target, true);
    if (st.mistake === false && L.err > 0 && st.rnd() < L.err && toEdge < 1.2) { st.mistake = "go"; }
    if (ready || st.mistake === "go" && toEdge < 0.5) { if (st.lagT < L.lag * st.rnd()) { st.lagT += S.DT; return inp; } inp.jump = true; return inp; }
    if (toEdge < 0.28) { inp.mx = 0; inp.mz = 0; st.wait = 0.5 + st.rnd() * 0.6; }
    return inp;
  }

  // Vérifie un lien de la route : le pilote doit arriver du nœud k au nœud k+1 dans le temps imparti
  function checkLink(C, k, t0, maxT) {
    const W = S.makeWorld(C); W.t = t0; S.prepare(W); const nb = W.boxes[C.nodes[k]]; const c = topCenter(nb); const P = S.newPlayer(c[0], nb.Y1, c[1], 0); P.on = nb.i; P.st = "ground";
    const st = create(W, C, "prodige", () => 0.5); st.cur = k; const ev = [];
    for (let i = 0; i < Math.round(maxT * 60); i++) { W.t += S.DT; S.prepare(W); const inp = step(st, P); S.stepPlayer(W, P, inp, ev); const sp = ev.some((e) => e.e === "spring"); ev.length = 0; if (sp && C.boxes[C.nodes[k + 1]].k === "spring") return { ok: true, t: i / 60 }; if (P.st === "ground" && P.on >= 0 && st.nodeOf.get(P.on) > k) return { ok: st.nodeOf.get(P.on) === k + 1 || st.nodeOf.get(P.on) > k, t: i / 60 }; if (P.y < nb.Y1 - 12) return { ok: false, why: "chute", t: i / 60 }; }
    return { ok: false, why: "temps", t: maxT };
  }
  function validate(C) {
    const bad = []; const spans = [0, 2.3]; let maxT = 0;
    for (let k = 0; k + 1 < C.nodes.length; k++) {
      const bk = C.boxes[C.nodes[k]]; if (bk.k === "spring") { /* lien porté par le plot */ }
      let ok = false, last = null; for (const t0 of spans) { const r = checkLink(C, k, t0 + k * 0.37, 26); last = r; if (r.ok) { ok = true; maxT = Math.max(maxT, r.t); break; } }
      if (!ok) bad.push({ k, why: last.why, kind: C.boxes[C.nodes[k + 1]].k });
    }
    return { ok: bad.length === 0, bad, maxT };
  }
  return { LEVELS, LEVEL_LIST, create, step, trialJump, checkLink, validate };
});

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
  function trialJump(st, P, target, jumpNow, lenient) {
    const W = st.W; const t0 = W.t; const c = S.clonePlayer(P); const crSave = JSON.stringify(W.cr); let ok = false; let jumped = false;
    for (let i = 0; i < 100; i++) {
      W.t = t0 + (i + 1) * S.DT; S.prepare(W); const b = W.boxes[target]; const gx = (b.X0 + b.X1) / 2 - c.x, gz = (b.Z0 + b.Z1) / 2 - c.z; const gl = Math.hypot(gx, gz) || 1;
      let jump = true; if (!jumpNow && !jumped) jump = false; jumped = true;
      tmpEv.length = 0; S.stepPlayer(W, c, { mx: gx / gl, mz: gz / gl, jump }, tmpEv);
      if (c.st === "ground" && c.on !== target && st.nodeOf.has(c.on) && st.nodeOf.get(c.on) > st.nodeOf.get(target)) { ok = true; break; } if (c.st === "ground" && c.on === target) { ok = c.x > b.X0 + 0.3 && c.x < b.X1 - 0.3 && c.z > b.Z0 + 0.3 && c.z < b.Z1 - 0.3; if (lenient || b.X1 - b.X0 < 1.4 || b.Z1 - b.Z0 < 1.4) ok = true; break; } const later = (bx) => bx === target || (st.nodeOf.has(bx) && st.nodeOf.get(bx) > st.nodeOf.get(target)); if (c.st === "hang" && later(c.hang.box)) { ok = true; break; } if (c.st === "climb") { ok = later(c.climb.box); break; }
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
    // un plot de ressort relance dans la même image, on le compte comme franchi
    if (P.spr != null) { const ks = st.nodeOf.get(P.spr); P.spr = null; if (ks !== undefined && ks >= st.cur) { st.cur = ks; st.run = false; st.wait = 0; st.mistake = false; st.lagT = 0; st.since = 0; } }
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
    // cible collée ou emboîtée dans la plateforme actuelle (étages d'un pin, toit d'une voiture) : on saute depuis son pied
    const nearT = !(tb.X0 > here0.X1 + 0.6 || tb.X1 < here0.X0 - 0.6 || tb.Z0 > here0.Z1 + 0.6 || tb.Z1 < here0.Z0 - 0.6);
    if (nearT) {
      {
        st.lpNode = st.cur; st.lp = null; const m = 0.12, cl = (v, a, b) => Math.max(a, Math.min(b, v)); const cz = cl(tc[1], here0.Z0 + 0.3, here0.Z1 - 0.3), cx = cl(tc[0], here0.X0 + 0.3, here0.X1 - 0.3);
        const cand = [[tb.X0 - S.K.R - m, cz], [tb.X1 + S.K.R + m, cz], [cx, tb.Z0 - S.K.R - m], [cx, tb.Z1 + S.K.R + m]].filter((c) => c[0] > here0.X0 + 0.2 && c[0] < here0.X1 - 0.2 && c[1] > here0.Z0 + 0.2 && c[1] < here0.Z1 - 0.2);
        let bd = 1e9; cand.forEach((c) => { const d = Math.hypot(c[0] - P.x, c[1] - P.z); if (d < bd) { bd = d; st.lp = c; } });
      }
      if (st.lp) {
        const dx = st.lp[0] - P.x, dz = st.lp[1] - P.z, d = Math.hypot(dx, dz);
        if (d > 0.18) { inp.mx = dx / d * L.pace; inp.mz = dz / d * L.pace; return inp; }
        const gx = tc[0] - P.x, gz = tc[1] - P.z, gl = Math.hypot(gx, gz) || 1; inp.mx = gx / gl * 0.05; inp.mz = gz / gl * 0.05;
        const ready = st.tick % 2 === 0 && trialJump(st, P, target, true, true); if (ready) { if (st.lagT < L.lag * st.rnd()) { st.lagT += S.DT; return inp; } inp.jump = true; } return inp;
      }
    }
    if (Math.abs(ddx) >= Math.abs(ddz)) { ex = ddx > 0 ? here0.X1 - 0.15 : here0.X0 + 0.15; ez = Math.max(here0.Z0 + 0.25, Math.min(here0.Z1 - 0.25, tc[1])); } else { ez = ddz > 0 ? here0.Z1 - 0.15 : here0.Z0 + 0.15; ex = Math.max(here0.X0 + 0.25, Math.min(here0.X1 - 0.25, tc[0])); }
    const toEdge = Math.hypot(ex - P.x, ez - P.z); let ux = (ex - P.x) / (toEdge || 1), uz = (ez - P.z) / (toEdge || 1); if (toEdge < 0.05) { ux = Math.sign(ddx) * (Math.abs(ddx) >= Math.abs(ddz) ? 1 : 0); uz = Math.sign(ddz) * (Math.abs(ddx) >= Math.abs(ddz) ? 0 : 1); }
    // marche arrière pour prendre de l'élan
    if (!st.run) { const back = 2.4; const ax = Math.abs(ddx) >= Math.abs(ddz); const sx = ax ? Math.max(here0.X0 + 0.5, Math.min(here0.X1 - 0.5, ex - Math.sign(ddx) * (back + 0.3))) : Math.max(here0.X0 + 0.5, Math.min(here0.X1 - 0.5, ex)), sz = ax ? Math.max(here0.Z0 + 0.5, Math.min(here0.Z1 - 0.5, ez)) : Math.max(here0.Z0 + 0.5, Math.min(here0.Z1 - 0.5, ez - Math.sign(ddz) * (back + 0.3))); const d2 = Math.hypot(sx - P.x, sz - P.z); if (d2 > 0.5 && st.wait <= 0) { inp.mx = (sx - P.x) / d2 * L.pace; inp.mz = (sz - P.z) / d2 * L.pace; if (d2 < 0.8) st.run = true; return inp; } st.run = true; }
    if (st.wait > 0) { st.wait -= S.DT; if (st.wait <= 0) st.run = false; return inp; }
    inp.mx = ux * L.pace; inp.mz = uz * L.pace;
    const ready = st.tick % 2 === 0 && trialJump(st, P, target, true, nearT) && trialJump(st, nudge(P, ux, uz), target, true, nearT);
    if (st.mistake === false && L.err > 0 && st.rnd() < L.err && toEdge < 1.2) { st.mistake = "go"; }
    if (ready || st.mistake === "go" && toEdge < 0.5) { if (st.lagT < L.lag * st.rnd()) { st.lagT += S.DT; return inp; } inp.jump = true; return inp; }
    if (toEdge < 0.28) { inp.mx = 0; inp.mz = 0; st.wait = 0.5 + st.rnd() * 0.6; }
    return inp;
  }

  // Vérifie un lien de la route : le pilote doit arriver du nœud k au nœud k+1 dans le temps imparti
  function checkLink(C, k, t0, maxT) {
    const W = S.makeWorld(C); W.t = t0; S.prepare(W); const nb = W.boxes[C.nodes[k]]; const c = startSpot(W, nb); const P = S.newPlayer(c[0], nb.Y1, c[1], 0); P.on = nb.i; P.st = "ground";
    if (nb.k === "spring") { // on arrive sur le ressort en courant, comme en vrai
      const tb0 = W.boxes[C.nodes[k + 1]], pb = k > 0 ? W.boxes[C.nodes[k - 1]] : null; const tcx = (tb0.X0 + tb0.X1) / 2, tcz = (tb0.Z0 + tb0.Z1) / 2; let dx = tcx - c[0], dz = tcz - c[1]; const dl = Math.hypot(dx, dz) || 1; dx /= dl; dz /= dl;
      if (pb) { const px = (pb.X0 + pb.X1) / 2, pz = (pb.Z0 + pb.Z1) / 2; const q = S.K.R + 0.08; P.x = Math.max(nb.X0 + q, Math.min(nb.X1 - q, px)); P.z = Math.max(nb.Z0 + q, Math.min(nb.Z1 - q, pz)); }
      P.st = "air"; P.on = -1; P.y = nb.Y1 + 0.04; P.vy = -1.5; P.vx = dx * 5.4; P.vz = dz * 5.4;
    }
    const st = create(W, C, "prodige", () => 0.5); st.cur = k; const ev = [];
    for (let i = 0; i < Math.round(maxT * 60); i++) { W.t += S.DT; S.prepare(W); const inp = step(st, P); S.stepPlayer(W, P, inp, ev); const sp = ev.some((e) => e.e === "spring"); ev.length = 0; if (sp && C.boxes[C.nodes[k + 1]].k === "spring") return { ok: true, t: i / 60 }; if (P.st === "ground" && P.on >= 0 && st.nodeOf.get(P.on) > k) return { ok: st.nodeOf.get(P.on) === k + 1 || st.nodeOf.get(P.on) > k, t: i / 60 }; if (P.y < nb.Y1 - 12) return { ok: false, why: "chute", t: i / 60 }; }
    return { ok: false, why: "temps", t: maxT };
  }
  // point libre sur le dessus d'une plateforme, le plus proche du centre (des étages peuvent occuper le milieu)
  function startSpot(W, b) {
    const c = topCenter(b); if (!S.overlapAny(W, c[0], b.Y1 + 0.03, c[1], S.K.H - 0.05, S.K.R, b)) return c; let best = null, bd = 1e9;
    for (let x = b.X0 + 0.45; x <= b.X1 - 0.45 + 1e-6; x += 0.3) for (let z = b.Z0 + 0.45; z <= b.Z1 - 0.45 + 1e-6; z += 0.3) { if (S.overlapAny(W, x, b.Y1 + 0.03, z, S.K.H - 0.05, S.K.R, b)) continue; const d = Math.hypot(x - c[0], z - c[1]); if (d < bd) { bd = d; best = [x, z]; } }
    return best || c;
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
  return { LEVELS, LEVEL_LIST, create, step, trialJump, checkLink, validate, startSpot };
});

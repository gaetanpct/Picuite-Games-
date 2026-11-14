// ============================================================
// PAGAILLE PARTY — Prédiction locale du coureur (Course des fous)
// Le navigateur fait courir son propre personnage tout de suite avec la même physique que le serveur,
// puis il envoie sa position. Le serveur vérifie, gère les chutes et l'arrivée, et peut le recaler.
// Les plateformes mobiles sont extrapolées entre deux images du serveur.
// ============================================================
(function () {
  const PL = window.PgPlat; const STEP = 1 / 30;
  const P = { on: false, dead: false, fin: false, yaw: -Math.PI / 2, yawOff: 0, hgOff: 0 };
  let world = null, body = null, dynMap = {}, cfg = null, kill = -260, sp = -1, acc = 0, prev = null, cur = null, sendAt = 0, others = [], slow = 0, latched = { jump: false, dive: false }, lastKeys = { a: 0, b: 0 }, assist = true, frameAt = 0, evq = [];
  const snap = (b) => ({ x: b.x, y: b.y, z: b.z, face: b.face });
  P.reset = function () { P.on = false; world = null; body = null; dynMap = {}; sp = -1; P.dead = false; P.fin = false; evq = []; P.yawOff = 0; P.hgOff = 0; P.yawInit = false; };
  P.setScene = function (sc, opts) {
    P.reset(); if (!sc || !sc.pred || !PL) return; const pr = sc.pred; world = new PL.World();
    pr.ph.forEach((a) => { const b = world.add({ x: a[0], y: a[1], z: a[2], w: a[3], d: a[4], h: a[5], rot: a[6], e: a[7] }); if (a.length > 8) b.belt = [a[8], a[9]]; });
    (pr.zones || []).forEach((z) => world.zones.push({ x: z[0], y: z[1], w: z[2], d: z[3], rot: z[4], z0: z[5], z1: z[6], fx: z[7], fy: z[8], off: false }));
    cfg = Object.assign({}, pr.cfg); kill = pr.kill || -260; assist = !opts || opts.jumpAssist !== false; P.on = true;
  };
  // une image du serveur, les boîtes mobiles, les autres coureurs, et l'état de notre coureur vu par le serveur
  P.frame = function (fr, priv, meId, now) {
    if (!P.on || !fr) return; frameAt = now;
    const seen = {};
    (fr.ph || []).forEach((a) => {
      let d = dynMap[a[0]]; if (!d) { d = dynMap[a[0]] = { b: world.add({ x: a[1], y: a[2], z: a[3], w: a[4], d: a[5], h: a[6], rot: a[7], e: 0.3 }) }; }
      d.sx = a[1]; d.sy = a[2]; d.sz = a[3]; d.srot = a[7]; d.vx = a[8]; d.vy = a[9]; d.vz = a[10]; d.om = a[11]; d.b.solid = !!a[12]; d.b.stun = a[13] || 0; d.b.w = a[4]; d.b.d = a[5]; d.b.h = a[6]; d.t0 = now; seen[a[0]] = 1;
    });
    Object.keys(dynMap).forEach((k) => { if (!seen[k]) dynMap[k].b.solid = false; });
    (fr.zo || []).forEach((on, i) => { if (world.zones[i]) world.zones[i].off = !on; });
    others = (fr.items || []).filter((it) => it.t === "pawn" && it.id !== meId);
    const me = priv && priv.me; if (!me) return;
    slow = me.slow || 0; P.fin = !!me.fin; P.grabbing = !!me.grab;
    if (me.sp !== sp || !body) { sp = me.sp; body = PL.body(me.x, me.y, me.z, {}); body.face = me.a; P.dead = !me.alive; prev = cur = snap(body); acc = 0; P.snapped = true; P.snaps = (P.snaps || 0) + 1; }
    else if (!me.alive) P.dead = true;
  };
  // fait avancer les boîtes mobiles jusqu'à maintenant
  function moveDyn(now) {
    Object.keys(dynMap).forEach((k) => {
      const d = dynMap[k]; const b = d.b; const age = Math.min(0.3, (now - d.t0) / 1000); const nx = d.sx + d.vx * age, ny = d.sy + d.vy * age, nz = d.sz + d.vz * age, nr = d.srot + d.om * age;
      b.dx = nx - b.x; b.dy = ny - b.y; b.dz = nz - b.z; b.x = nx; b.y = ny; b.z = nz; b.rot = nr; b.vx = d.vx; b.vy = d.vy; b.vz = d.vz; b.omega = d.om; b.move = true;
    });
  }
  // in {mx,my} déjà tournés selon la caméra, a et b les touches saut et plongeon, gr l'agrippement
  P.step = function (dt, inp, now, send) {
    if (!P.on || !body) return;
    if (inp.a && !lastKeys.a) latched.jump = true; if (inp.b && !lastKeys.b) latched.dive = true; lastKeys = { a: inp.a, b: inp.b };
    if (P.dead || inp.frozen) { latched.jump = latched.dive = false; acc = 0; return; }
    acc += dt; let n = 0;
    while (acc >= STEP && n < 5) {
      acc -= STEP; n++; prev = snap(body); moveDyn(now);
      const i = { x: inp.mx, y: inp.my, jump: latched.jump, jh: !!inp.a, dive: latched.dive }; latched.jump = latched.dive = false;
      if (assist && !i.jump && PL.assistJump(world, body, i)) { i.jump = true; i.jh = true; }
      body.slow = slow > 0 ? slow : P.grabbing ? 0.75 : 0;
      const ev = PL.step(world, body, i, STEP, cfg);
      // les autres coureurs nous poussent
      for (const o of others) { if (Math.abs(o.z - body.z) > 32) continue; const dx = body.x - o.x, dy = body.y - o.y, m = body.r * 2; const d2 = dx * dx + dy * dy; if (d2 >= m * m || d2 < 0.01) continue; const d = Math.sqrt(d2); const nx = dx / d, ny = dy / d; body.x += nx * (m - d) * 0.6; body.y += ny * (m - d) * 0.6; const vn = body.vx * nx + body.vy * ny; if (vn < 0) { body.vx -= nx * vn * 1.1; body.vy -= ny * vn * 1.1; } }
      ev.forEach((e) => evq.push(e));
      if (body.z < kill) { P.dead = true; evq.push("void"); send(pack(true)); break; }
      cur = snap(body);
    }
    if (acc > STEP * 5) acc = 0;
    if (now - sendAt > 50 && !P.dead) { sendAt = now; send(pack(!!inp.gr)); }
  };
  function pack(gr) { return { x: body.x, y: body.y, z: body.z, vx: body.vx, vy: body.vy, vz: body.vz, g: body.grounded, f: body.face, dv: body.dive, st: body.stun, sp, gr: !!gr }; }
  P.events = function () { const e = evq; evq = []; return e; };
  P.pos = function () { if (!body || !cur) return null; const k = Math.min(1, acc / STEP); return { x: prev.x + (cur.x - prev.x) * k, y: prev.y + (cur.y - prev.y) * k, z: prev.z + (cur.z - prev.z) * k }; };
  // remplace notre coureur dans l'image du serveur par la position prédite
  P.patch = function (items, meId) {
    if (!P.on || !items || !body) return; const i = items.findIndex((it) => it.t === "pawn" && it.id === meId);
    if (P.dead) { if (i >= 0) items[i].hide = 1; return; }
    const p = P.pos(); if (!p) return; let it = items[i]; if (!it) { it = { t: "pawn", id: meId }; items.push(it); }
    it.hide = 0; it.x = p.x; it.y = p.y; it.z = p.z; it.face = body.face; it.air = body.grounded ? 0 : 1; it.gz = body.gz == null ? body.z - 400 : body.gz; it.sm = 90;
    it.tilt = body.dive > 0 ? 0.7 : body.stun > 0 ? 1.3 : 0; it.roll = body.stun > 0 ? Math.sin(performance.now() / 55) * 0.4 : 0; it.ghost = 0;
  };
  window.PgPred = P;
})();

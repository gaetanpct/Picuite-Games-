// ============================================================
// BUS BAZAR — Passagers, équipiers, objets et dangers dans le bus
// ============================================================
const BBEnt = (function () {
  const T = THREE; const L = BBL; const P = BBPeople; const B = BBBus;
  const wrap = (a) => { while (a > Math.PI) a -= 2 * Math.PI; while (a < -Math.PI) a += 2 * Math.PI; return a; };
  const gy = (x) => (x > 1.75 ? -0.3 : 0);
  const ring = new T.Mesh(new T.RingGeometry(0.2, 0.3, 20), new T.MeshBasicMaterial({ color: 0xffe14a, transparent: true, opacity: 0.8, side: T.DoubleSide, depthWrite: false }));
  ring.rotation.x = -Math.PI / 2;

  function create(parent) { return { parent, npcs: {}, pl: {}, it: {}, hz: {}, t: 0, hand: null, handKey: "" }; }

  function syncPlayers(E, S, C, dt) {
    const seen = {};
    S.p.forEach((p) => {
      seen[p.i] = 1; if (p.i === C.me) return;
      let o = E.pl[p.i];
      if (!o) { const inf = C.players[p.i] || {}; const per = P.person({ role: p.ro, skin: (inf.color || 0) + 1, cloth: 0, h: 1 }); const lb = P.label((inf.name || "Équipier").slice(0, 14), "#ffd23f"); lb.position.y = 2.05; per.g.add(lb); E.parent.add(per.g); o = E.pl[p.i] = { per, x: p.x, z: p.z, y: p.y, lb }; o.per.g.position.set(p.x, gy(p.x), p.z); }
      const k = 1 - Math.exp(-dt * 14); const mv = Math.hypot(p.x - o.x, p.z - o.z); o.x += (p.x - o.x) * k; o.z += (p.z - o.z) * k; o.y += wrap(p.y - o.y) * k;
      const sit = p.ro === "driver" && p.z > 5.6 && Math.abs(p.x - L.DRIVER.x) < 0.5;
      o.per.g.position.set(o.x, gy(o.x) + (sit ? 0 : 0), o.z); o.per.g.rotation.y = o.y;
      const walking = Math.hypot(p.vx, p.vz) > 0.25 ? 1 : 0;
      P.animate(o.per, p.tm ? "lie" : sit ? "sit" : p.h && p.h.indexOf("npc") === 0 ? "carry" : "stand", p.tm || sit ? 0 : walking, E.t, { holdItem: p.h && p.h.indexOf("item") === 0, hold: p.hp > 0 });
    });
    Object.keys(E.pl).forEach((id) => { if (!seen[id]) { E.parent.remove(E.pl[id].per.g); delete E.pl[id]; } });
  }

  function npcIcon(n) {
    if (n.nd && L.NEEDS[n.nd]) return L.NEEDS[n.nd].icon; if (n.tr) return "😡"; if (n.as) return "💤"; if (n.m < 22 && n.s !== "wait") return "😠"; return "";
  }
  function syncNpcs(E, S, C, dt) {
    const seen = {}; const myp = C.myPos;
    S.n.forEach((n) => {
      const inf = C.npc[n.i]; if (!inf) return; seen[n.i] = 1; let o = E.npcs[n.i];
      if (!o) { const lk = inf.lk || {}; const per = P.person({ skin: lk.skin, cloth: lk.cloth, hat: lk.hat, h: lk.h, fat: lk.fat }); E.parent.add(per.g); o = E.npcs[n.i] = { per, x: n.x, z: n.z, y: n.y, ic: null, icKey: "", bar: null, lb: null, mx: n.x, mz: n.z }; per.g.position.set(n.x, gy(n.x), n.z); }
      const k = 1 - Math.exp(-dt * 12); const mv = Math.hypot(n.x - o.x, n.z - o.z) / Math.max(dt, 0.001);
      o.x += (n.x - o.x) * k; o.z += (n.z - o.z) * k; o.y += wrap(n.y - o.y) * k;
      const g = o.per.g; const sit = n.s === "seat"; const sl = n.s === "sleep"; const car = n.s === "carried"; const lie = n.s === "tumble" || n.s === "ejected" || car;
      let px = o.x, pz = o.z, py = gy(o.x), ry = o.y;
      if (sit && n.sl >= 0 && L.seats[n.sl]) { const s = L.seats[n.sl]; px = s.x; pz = s.z + 0.04; py = 0.0; }
      if (car) { const h = C.holderOf("npc" + n.i); if (h) { px = h.x + Math.sin(h.y) * 0.42; pz = h.z + Math.cos(h.y) * 0.42; py = 0.62; ry = h.y + 1.57; } }
      g.position.set(px, py, pz); g.rotation.y = ry;
      const walking = (n.wk || mv > 0.5) && !sit && !sl && !lie ? 1 : 0;
      P.animate(o.per, lie ? "lie" : sl ? "sleep" : sit ? "sit" : "stand", walking, E.t, { panic: n.nd === "peur" || (n.s === "tumble"), angry: n.tr || n.nd === "cigarette", dance: n.tr && n.m > 50 && false, hold: n.pg > 0 });
      // icône au-dessus de la tête
      const key = npcIcon(n) + (n.tr ? "t" : "");
      if (key !== o.icKey) { o.icKey = key; const ic = npcIcon(n); if (!ic) { if (o.ic) o.ic.visible = false; } else { if (!o.ic) { o.ic = P.icon(ic, 0.4); g.add(o.ic); } else P.setIcon(o.ic, ic); o.ic.visible = true; } }
      const hh = (inf.lk && inf.lk.h || 1) * 1.0;
      if (o.ic) { o.ic.position.y = 1.95 * hh + 0.15 + Math.sin(E.t * 3 + n.i) * 0.03; const near = myp ? Math.hypot(myp.x - o.x, myp.z - o.z) : 9; o.ic.scale.setScalar(Math.min(0.62, 0.36 + near * 0.025)); }
      // barre de patience
      if (n.nd && n.s !== "wait") { if (!o.bar) { o.bar = P.bar(); g.add(o.bar); } o.bar.visible = true; o.bar.position.set(-0.2, 1.78 * hh, 0); o.bar.scale.x = Math.max(0.01, 0.4 * n.nf); o.bar.material.color.set(n.nf > 0.5 ? 0x5ad17a : n.nf > 0.25 ? 0xf2b705 : 0xe8453c); } else if (o.bar) o.bar.visible = false;
      // nom à proximité
      const d = myp ? Math.hypot(myp.x - o.x, myp.z - o.z) : 99;
      if (d < 5.5) { if (!o.lb) { o.lb = P.label(inf.nm, n.s === "wait" ? "#ffd23f" : "#ffffff"); g.add(o.lb); } o.lb.visible = true; o.lb.position.y = 2.3 * hh + (o.ic ? 0.25 : 0); } else if (o.lb) o.lb.visible = false;
    });
    Object.keys(E.npcs).forEach((id) => { if (!seen[id]) { E.parent.remove(E.npcs[id].per.g); delete E.npcs[id]; } });
  }

  function syncItems(E, S, C, dt) {
    const seen = {};
    S.it.forEach((it) => {
      seen[it.i] = 1; const key = it.t + "|" + it.c + "|" + it.op + "|" + it.dy + "|" + (it.hp <= 0 ? 1 : 0) + "|" + it.tg; let o = E.it[it.i];
      if (!o || o.key !== key) { if (o) E.parent.remove(o.g); const g = B.item(it.t, { c: it.c, op: it.op, dy: it.dy, hp: it.hp, tg: it.tg }); E.parent.add(g); o = E.it[it.i] = { g, key, x: it.x, y: it.y, z: it.z, ring: null }; g.position.set(it.x, it.y, it.z); }
      let tx = it.x, ty = it.y, tz = it.z, snap = false;
      if (it.h) { const h = C.holderPos(it.h); if (h) { tx = h.x + Math.sin(h.y) * 0.45; tz = h.z + Math.cos(h.y) * 0.45; ty = 0.95; snap = true; } }
      o.g.visible = !(it.h && it.h === C.me);
      const k = snap ? 1 - Math.exp(-dt * 20) : 1 - Math.exp(-dt * 10); o.x += (tx - o.x) * k; o.y += (ty - o.y) * k; o.z += (tz - o.z) * k;
      o.g.position.set(o.x, o.y + (o.x > 1.75 && !it.h ? gy(o.x) : 0), o.z); o.g.rotation.y = it.h ? (C.holderPos(it.h) || { y: 0 }).y : (it.i * 1.7) % 6;
      const wantRing = C.assist && !it.h && it.s !== "slot" && it.t !== "mop" && it.s !== "";
      if (wantRing && !o.ring) { o.ring = ring.clone(); o.ring.material = ring.material; o.ring.position.y = 0.02; o.g.add(o.ring); }
      if (o.ring) { o.ring.visible = !!wantRing; o.ring.scale.setScalar(1 + Math.sin(E.t * 4) * 0.12); }
    });
    Object.keys(E.it).forEach((id) => { if (!seen[id]) { E.parent.remove(E.it[id].g); delete E.it[id]; } });
  }

  function syncHaz(E, S, C, dt) {
    const seen = {};
    S.hz.forEach((h) => {
      seen[h.i] = 1; let o = E.hz[h.i];
      if (!o) { const g = h.t === "fire" ? B.fire() : B.puddle(); E.parent.add(g); o = E.hz[h.i] = { g, t: h.t }; }
      o.g.position.set(h.x, o.t === "fire" ? 0 : 0.012, h.z);
      if (h.t === "fire") { const s = 0.7 + h.sz * 0.9; o.g.scale.set(s * (0.9 + Math.sin(E.t * 17 + h.i) * 0.1), s * (0.95 + Math.sin(E.t * 13 + h.i) * 0.12), s); } else o.g.scale.set(h.sz * 0.9 + 0.2, 1, h.sz * 0.9 + 0.2);
    });
    Object.keys(E.hz).forEach((id) => { if (!seen[id]) { E.parent.remove(E.hz[id].g); delete E.hz[id]; } });
  }

  function sync(E, S, C, dt) {
    E.t += dt; syncPlayers(E, S, C, dt); syncNpcs(E, S, C, dt); syncItems(E, S, C, dt); syncHaz(E, S, C, dt);
  }
  function clear(E) { [E.npcs, E.pl, E.it, E.hz].forEach((m) => { Object.keys(m).forEach((k) => { const o = m[k]; E.parent.remove(o.g || o.per.g); delete m[k]; }); }); }
  return { create, sync, clear, gy };
})();

// ============================================================
// PAGAILLE PARTY — Aides communes aux jeux de survie en 3D (serveur)
// Ils partagent les mêmes personnages physiques (pg-plat), la même gestion des chutes et le même classement.
// ============================================================
const Plat = require("./pg-plat.js");
const U = require("./pg-util.js");

// prépare les joueurs et la boucle de mise à jour. o { spawn(i,n) -> {x,y,z,face}, body, killZ, shove }
exports.setup = function (ctx, world, cfg, o) {
  o = o || {}; let t = 0; const falls = []; let lastFall = -9;
  const P = ctx.players.map((m, i) => {
    const sp = o.spawn(i, ctx.n); const bd = Plat.body(sp.x, sp.y, sp.z, o.body); bd.face = sp.face || 0;
    return { id: m.id, k: m.color, name: m.name, bd, dead: false, deadAt: 0, score: 0, ex: {} };
  });
  const S = { P, falls, world, cfg };
  Object.defineProperty(S, "t", { get() { return t; } });
  S.alive = () => P.filter((p) => !p.dead);
  S.byId = (id) => P.find((p) => p.id === id);
  // marque un joueur comme éliminé. les chutes proches dans le temps forment une égalité
  S.kill = function (p, kind) {
    if (p.dead) return; p.dead = true; p.deadAt = t; p.bd.alive = false; const b = p.bd;
    if (t - lastFall > 0.45 || !falls.length) falls.push([p.id]); else falls[falls.length - 1].push(p.id); lastFall = t;
    if (kind === "lava") { ctx.fx("lavasplash", b.x, b.y, b.z, "#ff7a1a"); ctx.snd("burn"); } else if (kind === "void" || kind == null) { ctx.fx("splash", b.x, b.y, o.killZ != null ? o.killZ : -180, "#bfe9ff"); ctx.snd("splash"); } else if (kind === "boom") { ctx.fx("boom", b.x, b.y, b.z, "#ffb347"); ctx.snd("boom"); }
    ctx.shake(1.2);
  };
  // petite poussée entre joueurs, on écarte les voisins sans les éjecter d'un coup
  S.push = function (p) {
    if (p.dead || p.ex.pushCd > 0) return; const b = p.bd; let hit = 0;
    S.alive().forEach((q) => { if (q === p) return; const dx = q.bd.x - b.x, dy = q.bd.y - b.y, d = Math.hypot(dx, dy); if (d > 78 || d < 0.1) return; q.bd.vx += dx / d * 280; q.bd.vy += dy / d * 280; if (q.bd.grounded) q.bd.vz = Math.max(q.bd.vz, 120); hit++; });
    p.ex.pushCd = 0.9; ctx.snd(hit ? "bump" : "whoosh"); ctx.fx("puff", b.x, b.y, b.z, "");
  };
  // fait avancer le monde et tous les joueurs vivants. bot(p,dt) renvoie les commandes d'un bot
  S.update = function (dt, bot, hook) {
    t += dt; world.step(dt);
    S.alive().forEach((p) => {
      const b = p.bd; let inp;
      const canPush = o.push != null ? o.push : !cfg.diveV; p.ex.pushCd = Math.max(0, (p.ex.pushCd || 0) - dt);
      if (ctx.isBot(p.id)) { inp = bot ? bot(p, dt) : { x: 0, y: 0 }; if (canPush && p.ex.pushCd <= 0 && b.grounded && Math.random() < dt * (o.botPush != null ? o.botPush : 0.3)) S.push(p); }
      else { const i = ctx.input(p.id); const e = ctx.edge(p.id); inp = o.human ? o.human(p, i, e) : { x: i.x, y: i.y, jump: e.a, jh: i.a, dive: e.b }; if (canPush && e.b) S.push(p); }
      const ev = Plat.step(world, b, inp, dt, cfg);
      for (let k = 0; k < ev.length; k++) { const e = ev[k]; if (e === "jump" || e === "dbl") { ctx.snd("jump"); ctx.fx("puff", b.x, b.y, b.z, ""); } else if (e === "land") ctx.fx("puff", b.x, b.y, b.z, ""); else if (e === "dive") ctx.snd("whoosh"); else if (e === "bump") ctx.snd("bump"); }
      if (hook) hook(p, ev);
      if (!p.dead && (ev.indexOf("void") >= 0 || (o.killZ != null && b.z < o.killZ))) S.kill(p, "void");
    });
    Plat.separate(S.alive().map((p) => p.bd), { shove: o.shove || 1 });
  };
  S.pawns = function (extra) { return S.alive().map((p) => Plat.pawnItem(p.bd, p, extra ? extra(p) : null)); };
  S.ranking = function (opts) {
    opts = opts || {}; const alive = S.alive().map((p) => p.id); const groups = U.rankFromFalls(P.map((p) => p.id), falls, alive);
    const notes = {}; P.forEach((p) => { notes[p.id] = opts.note ? opts.note(p) : (p.dead ? "Tombé après " + Math.round(p.deadAt) + " s" : "Encore debout à la fin"); });
    return { groups, bonus: opts.bonus || {}, notes, headline: opts.headline || "" };
  };
  return S;
};

// un coup de pouce commun aux bots qui marchent. va vers un point en évitant de s'arrêter net
exports.walk = function (b, tx, ty, speed, stop) {
  const dx = tx - b.x, dy = ty - b.y, d = Math.hypot(dx, dy) || 1; const s = d < (stop || 12) ? 0 : (speed || 1); return { x: dx / d * s, y: dy / d * s, d };
};

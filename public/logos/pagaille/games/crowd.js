// Faites des groupes. Un nombre est annoncé, il faut se retrouver sur une plateforme avec exactement ce nombre de joueurs.
// Les plateformes trop pleines ou trop vides tombent, avec tout le monde dessus. Il faut se parler, ou plutôt se bousculer.
const U = require("../pg-util.js");
const Plat = require("../pg-plat.js");
const Surv = require("../pg-surv.js");

exports.create = function (ctx) {
  const rnd = ctx.rnd; const n = ctx.n; const CX = 0, CY = 0; const maxRounds = Math.round(10 * ctx.len); const SIZE = 190, HUB = 210;
  const world = new Plat.World(); const hub = world.add({ x: CX, y: CY, z: -40, w: HUB, d: HUB, h: 40, e: 0.1 }); let islands = [];
  const cfg = { maxV: 300 * ctx.speed, accG: ctx.heavy ? 1100 : 2700, accA: 1500, jumpV: 520, maxJumps: 1, g: 1850, kill: -360, diveV: 440, diveCd: 1.2 };
  const S = Surv.setup(ctx, world, cfg, { spawn: (i, nn) => { const a = (i / nn) * 6.283; return { x: Math.cos(a) * 60, y: Math.sin(a) * 60, z: 2, face: a }; }, killZ: -360, shove: 1.3 });
  let phase = "pre", left = 2, round = 0, N = 2, t = 0, noValid = 0; const hubS = { fall: 0, gone: false };
  const alive = () => S.alive();
  function build() {
    islands.forEach((q) => { const i = world.boxes.indexOf(q.b); if (i >= 0) world.boxes.splice(i, 1); }); islands = [];
    const a = alive().length; N = a <= 2 ? 1 : U.clamp(2 + Math.floor(rnd() * Math.max(1, Math.min(3, Math.ceil(a / 2) - 1))), 2, Math.max(2, Math.min(4, a - 1)));
    const m = U.clamp(Math.ceil(a / N) + 1 + (rnd() < 0.5 ? 1 : 0), 3, 8); const ph = rnd() * 6.283; const R = 312 + Math.max(0, m - 6) * 14;
    for (let i = 0; i < m; i++) { const th = ph + (i / m) * 6.283; const x = Math.cos(th) * R, y = Math.sin(th) * R; const sz = m > 6 ? SIZE - 16 : SIZE; const b = world.add({ x, y, z: -40, w: sz, d: sz, h: 40, e: 0.1 }); islands.push({ id: "i" + round + "_" + i, x, y, b, sz, cnt: 0, fall: 0, gone: false, th }); }
    hub.solid = true; hub.z = -40; hubS.fall = 0; hubS.gone = false;
  }
  function count() { islands.forEach((q) => { q.cnt = 0; }); let onHub = 0; alive().forEach((p) => { const b = p.bd; if (!b.grounded || !b.ground) return; const q = islands.find((o) => o.b === b.ground); if (q) { q.cnt++; p.ex.on = q; } else p.ex.on = null; }); }
  function startRound() { round++; build(); phase = "run"; left = Math.max(4.8, 8.2 - 0.4 * round) * ctx.pace; alive().forEach((p) => { p.ex.goal = null; p.ex.think = 0.2 + (1 - ctx.skill(p.id)) * 0.9; }); ctx.announce("Tour " + round + ", formez des groupes de " + N, 1900); ctx.snd("count"); }
  function judge() {
    count(); const valid = islands.filter((q) => q.cnt === N); phase = "drop"; left = 1.8; ctx.shake(1.5);
    if (!valid.length) { noValid++; ctx.announce("Aucun groupe complet, personne ne tombe", 1800); islands.forEach((q) => { q.keep = true; }); return; }
    noValid = 0; ctx.snd("crack"); islands.forEach((q) => { q.keep = q.cnt === N; if (!q.keep) { q.fall = 0.001; q.b.solid = false; } }); hub.solid = false; hubS.fall = 0.001;
  }
  function bot(p, dt) {
    const b = p.bd, sk = ctx.skill(p.id), ex = p.ex; if (phase !== "run") return { x: 0, y: 0 }; ex.think -= dt; const here = ex.on;
    if (ex.think <= 0) {
      ex.think = 0.35 + (1 - sk) * 0.8 + rnd() * 0.3; count();
      const mine = here ? here.cnt : 0; const stay = here && (here.cnt === N || (here.cnt < N && rnd() < 0.5 + sk * 0.3));
      // trop de monde sur cette dalle, les derniers dans l'ordre des identifiants s'en vont
      const crowd = here && here.cnt > N ? alive().filter((q) => q.ex.on === here).sort((a, c) => (a.id < c.id ? -1 : 1)).findIndex((q) => q === p) >= N : false;
      if (!here || crowd || !stay) {
        let best = null, bs = 1e9; islands.forEach((q) => { if (q === here) return; const want = alive().filter((o) => o !== p && (o.ex.goal === q || o.ex.on === q)).length; const d = Math.hypot(q.x - b.x, q.y - b.y); const fill = want >= N ? 400 : want > 0 && want < N ? -60 : 0; const s = d + fill + (rnd() - 0.5) * (1 - sk) * 260; if (s < bs) { bs = s; best = q; } });
        ex.goal = best || here;
      } else ex.goal = here;
    }
    const g = ex.goal; if (!g) return { x: 0, y: 0 }; const w = Surv.walk(b, g.x, g.y, 1, ex.on === g ? 30 : 16);
    // sauter le vide entre le centre et les îles
    const ahead = Plat.groundAt(world, b.x + w.x * 36, b.y + w.y * 36, b.z + 20, b.z - 45); let jump = false; if (ahead == null && w.d > 40 && b.grounded) jump = true;
    return { x: w.x, y: w.y, jump, jh: jump || !b.grounded };
  }
  const inst = {
    done: false,
    update(dt) {
      t += dt; S.update(dt, bot); S.P.forEach((p) => { if (p.dead && p.ex.dr == null) p.ex.dr = round; });
      islands.forEach((q) => { if (q.fall) { q.fall += dt; q.b.z -= 700 * q.fall * dt; if (q.b.z < -600) q.gone = true; } }); if (hubS.fall) { hubS.fall += dt; hub.z -= 700 * hubS.fall * dt; if (hub.z < -600) hubS.gone = true; }
      left -= dt;
      if (phase === "pre") { if (left <= 0) startRound(); }
      else if (phase === "run") { count(); if (left <= 0) judge(); }
      else if (phase === "drop") { if (left <= 0) { if (alive().length <= 1 || round >= maxRounds || noValid >= 3) inst.done = true; else { phase = "gap"; left = 0.4; } } }
      else if (phase === "gap") { if (left <= 0) { // les survivants reviennent au centre
        hub.solid = true; hub.z = -40; alive().forEach((p, i) => { const a = (i / alive().length) * 6.283; const b = p.bd; b.x = Math.cos(a) * 60; b.y = Math.sin(a) * 60; b.z = 2; b.vx = b.vy = b.vz = 0; b.grounded = false; ctx.fx("puff", b.x, b.y, 0, ""); }); startRound(); } }
      if (alive().length <= 1 && ctx.n > 1 && phase !== "drop") inst.done = true;
    },
    scene() { return { w: 1100, h: 1100, cam: { tilt: 60, fov: 42, pad: 1.1, c: [0, 0], ht: 40 }, env: { sky: ["#0f3d2b", "#6bd68f"], fog: "#1e6a4a", fogN: 70, fogF: 250, ground: { c: "#0c3a52", m: "water", z: -420 }, lt: { h: ["#e8fff0", "#4a7a6a"], hi: 1, d: "#fffbe4", di: 0.95, dir: [-0.3, 1, 0.5] } }, items: [] }; },
    frame() {
      const items = []; if (!hubS.gone) items.push({ t: "box", id: "hub", x: 0, y: 0, z: hub.z, w: HUB, d: HUB, h: 40, c: "#ffd9a8", sm: 30 });
      count();
      islands.forEach((q) => { if (q.gone) return; const ok = q.cnt === N; const showFinal = phase === "drop"; items.push({ t: "box", id: q.id, x: q.x, y: q.y, z: q.b.z, w: q.sz, d: q.sz, h: 40, c: showFinal ? (q.keep ? "#4cd964" : "#c0392b") : ok ? "#7ed9a0" : q.cnt > N ? "#e3735e" : "#bde6ff", lab: q.cnt + " / " + N, lc: ok ? "rgba(0,70,20,.85)" : "rgba(30,30,60,.8)", sm: 30 }); });
      S.pawns().forEach((p) => items.push(p));
      return { w: 1100, h: 1100, items, hud: { title: phase === "run" ? "Rejoins une plateforme avec exactement " + N + " joueur" + (N > 1 ? "s" : "") : phase === "drop" ? "Les mauvais groupes tombent" : "", timer: phase === "run" ? left : null, target: phase === "pre" ? null : { c: "#2fbf71", s: "Groupes de " + N }, chips: [{ text: "Tour " + round + " sur " + maxRounds }, { text: alive().length + " debout" }] } };
    },
    priv(pid) { const p = S.byId(pid); return p ? { dead: p.dead ? 1 : 0, deadText: "Tu es tombé, regarde les autres" } : null; },
    ranking() { return S.ranking({ note: (p) => (p.dead ? "Éliminé au tour " + Math.max(1, p.ex.dr || round) : "Encore debout"), headline: "👥 Les groupes gagnants" }); },
  };
  return inst;
};

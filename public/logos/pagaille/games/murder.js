// Meurtre mystère, de 3 à 8 joueurs. Le détective est connu de tous, le meurtrier est secret.
// Le meurtrier frappe de près en silence, un cadavre déclenche une alerte sonore. Accuser le bon fait gagner, accuser un innocent coûte cher.
const U = require("../pg-util.js");
const Plat = require("../pg-plat.js");
const Surv = require("../pg-surv.js");

const W = 900, H = 580;
exports.create = function (ctx) {
  const rnd = ctx.rnd; const n = ctx.n; const cap = 80 * ctx.pace;
  const order = U.shuffle(ctx.players.map((m) => m.id), rnd); const murdererId = order[0]; const detId = n >= 4 ? order[1] : null;
  const world = new Plat.World(); world.add({ x: W / 2, y: H / 2, z: -40, w: W + 60, d: H + 60, h: 40, e: 0.1 }); const wallBox = (x, y, w, d) => world.add({ x, y, z: -20, w, d, h: 160, e: 0.2 });
  wallBox(W / 2, 14, W + 80, 60); wallBox(W / 2, H - 14, W + 80, 60); wallBox(14, H / 2, 60, H + 80); wallBox(W - 14, H / 2, 60, H + 80);
  const pill = [[260, 180, 34], [640, 180, 34], [450, 290, 40], [260, 400, 34], [640, 400, 34], [110, 290, 28], [790, 290, 28]].map((a) => ({ x: a[0], y: a[1], r: a[2] }));
  pill.forEach((c) => world.add({ x: c.x, y: c.y, z: -20, w: c.r * 1.7, d: c.r * 1.7, h: 140, e: 0.2 }));
  const cfg = { maxV: 175 * ctx.speed * (ctx.heavy ? 0.9 : 1), accG: ctx.heavy ? 900 : 2200, accA: 1000, jumpV: 0, maxJumps: 0, g: 1800, kill: -300, diveV: 0 };
  const S = Surv.setup(ctx, world, cfg, { spawn: (i, nn) => { const a = (i / nn) * 6.283; return { x: W / 2 + Math.cos(a) * 300, y: H / 2 + Math.sin(a) * 190, z: 0, face: a + 3.14 }; }, killZ: -300, human: (p, i, e) => { p.ex.a = e.a; p.ex.b = e.b; return { x: i.x, y: i.y }; } });
  S.P.forEach((p) => { p.role = p.id === murdererId ? "M" : p.id === detId ? "D" : "I"; p.cd = 4; p.kills = 0; p.diedAt = -1; p.ex.react = 0; });
  const bodies = [], pings = []; let t = 0, result = null; const falls = []; const events = [];
  const alive = () => S.P.filter((p) => !p.dead);
  const dist = (a, b) => Math.hypot(a.bd.x - b.bd.x, a.bd.y - b.bd.y);
  function nearest(p, range) { let best = null, bd = range; S.P.forEach((q) => { if (q === p || q.dead) return; const d = dist(p, q); if (d < bd) { bd = d; best = q; } }); return best; }
  function die(q, why, by) { q.dead = true; q.bd.alive = false; q.diedAt = t; bodies.push({ id: q.id, x: q.bd.x, y: q.bd.y, k: q.k, name: q.name }); pings.push({ x: q.bd.x, y: q.bd.y, t0: t }); falls.push([q.id]); ctx.announce(why, 3000); ctx.snd("scream"); ctx.fx("ring", q.bd.x, q.bd.y, 10, "#ff4d4d"); ctx.shake(1.5); if (by) events.push({ t, x: q.bd.x, y: q.bd.y, killer: by.id, victim: q.id }); }
  function check() { const M = S.P.find((p) => p.role === "M"); if (M.dead) { result = result || { win: "I" }; return; } const others = S.P.filter((p) => p.role !== "M" && !p.dead).length; if (others <= 1) result = { win: "M" }; }
  function strike(p) { const q = nearest(p, 58); if (q) { p.cd = 7; p.kills++; die(q, "Un cri dans la maison", p); } }
  function accuse(p) {
    if (p.role === "M") { ctx.announce("Le meurtrier n'a pas besoin d'accuser", 1200); return; } const q = nearest(p, 95); if (!q) return;
    if (q.role === "M") { result = { win: "I", by: p.id }; ctx.announce(p.name + " démasque " + q.name + " le meurtrier", 3200); q.dead = true; q.bd.alive = false; q.diedAt = t; bodies.push({ id: q.id, x: q.bd.x, y: q.bd.y, k: q.k, name: q.name }); falls.push([q.id]); ctx.snd("win"); }
    else if (p.role === "D") { p.bd.stun = 5; ctx.announce(p.name + " a accusé " + q.name + " à tort et reste figé", 2600); ctx.snd("bump"); }
    else die(p, p.name + " a accusé " + q.name + " à tort et le paie cher");
  }
  function wander(p, b, sp) { const ex = p.ex; if (!ex.wt || Math.hypot(ex.wt.x - b.x, ex.wt.y - b.y) < 30 || t > ex.wUntil) { ex.wt = { x: 80 + rnd() * (W - 160), y: 90 + rnd() * (H - 180) }; ex.wUntil = t + 3 + rnd() * 4; } return Surv.walk(b, ex.wt.x, ex.wt.y, sp, 20); }
  function bot(p, dt) {
    const b = p.bd, sk = ctx.skill(p.id), ex = p.ex; p.cd = Math.max(0, p.cd - dt); ex.react -= dt; if (b.stun > 0) return { x: 0, y: 0 };
    if (p.role === "M") {
      if (ex.react <= 0) { ex.react = 0.3 + (1 - sk) * 0.3; let best = null, bs = -1e9; alive().forEach((q) => { if (q === p) return; const wit = alive().filter((o) => o !== p && o !== q && dist(o, q) < 190).length; const s = -dist(p, q) * 0.35 - wit * (60 + sk * 140) + (rnd() - 0.5) * 60 + (q.role === "D" ? -sk * 40 : 0); if (s > bs) { bs = s; best = q; } }); ex.tg = best; }
      const q = ex.tg; if (q && !q.dead) { const wit = alive().filter((o) => o !== p && o !== q && Math.hypot(o.bd.x - b.bd?.x, 0) >= 0 && Math.hypot(o.bd.x - b.x, o.bd.y - b.y) < 175).length; const w = Surv.walk(b, q.bd.x, q.bd.y, 0.65 + sk * 0.2, 36); if (dist(p, q) < 48 && p.cd <= 0 && (wit === 0 || (sk < 0.45 && rnd() < 0.02))) strike(p); return wit > 0 && dist(p, q) > 90 ? Object.assign(wander(p, b, 0.45), {}) : { x: w.x, y: w.y }; }
      const w = wander(p, b, 0.5); return { x: w.x, y: w.y };
    }
    // innocents et détective. ils ont peut être vu quelque chose
    events.forEach((ev) => { if (ev.seen && ev.seen[p.id]) return; ev.seen = ev.seen || {}; ev.seen[p.id] = 1; if (p.id === ev.victim || p.dead) return; const d = Math.hypot(ev.x - b.x, ev.y - b.y); if (d < 230 && rnd() < 0.35 + sk * 0.6) { ex.suspect = rnd() < 0.55 + sk * 0.4 ? ev.killer : (nearest(p, 400) || {}).id; ex.confirmAt = t + 0.4 + (1 - sk) * 2.2 + rnd(); } else if (d < 420 && rnd() < 0.3) { ex.vague = nearest({ bd: { x: ev.x, y: ev.y } }, 300); } });
    if (ex.suspect && t >= ex.confirmAt) { const q = S.byId(ex.suspect); if (q && !q.dead && q !== p) { const w = Surv.walk(b, q.bd.x, q.bd.y, 1, 30); if (dist(p, q) < 80) { if (p.role === "D" || rnd() < 0.5 + sk * 0.3) { accuse(p); } ex.suspect = null; } return { x: w.x, y: w.y }; } ex.suspect = null; }
    // sinon on reste en groupe, on se méfie de ceux qui s'isolent
    const others = alive().filter((o) => o !== p); if (others.length && (bodies.length || rnd() < 0.003)) ex.group = true;
    if (ex.group && others.length) { let cx = 0, cy = 0; others.forEach((o) => { cx += o.bd.x; cy += o.bd.y; }); cx /= others.length; cy /= others.length; const w = Surv.walk(b, cx + Math.cos(p.id.length * 7) * 70, cy + 60, 0.6, 40); return { x: w.x * 0.8, y: w.y * 0.8 }; }
    const w = wander(p, b, 0.55); return { x: w.x, y: w.y };
  }
  const inst = {
    done: false,
    update(dt) {
      t += dt; S.update(dt, bot, (p) => { if (ctx.isBot(p.id)) return; const e = p.ex; if (e.a && p.role === "M" && p.cd <= 0) strike(p); if (e.b) accuse(p); e.a = e.b = false; });
      S.P.forEach((p) => { if (!ctx.isBot(p.id) && !p.dead) p.cd = Math.max(0, p.cd - dt); });
      if (!result) check(); while (pings.length && t - pings[0].t0 > 2.6) pings.shift(); while (events.length && t - events[0].t > 6) events.shift();
      if (result) inst.done = true;
      else if (t >= cap) { const M = S.P.find((p) => p.role === "M"); const need = Math.ceil((n - 1) / 2); result = { win: M.kills >= need ? "M" : "I" }; ctx.announce(result.win === "M" ? "Le temps est écoulé, le meurtrier a fait assez de victimes" : "Le temps est écoulé, le meurtrier n'a pas fini son travail", 3000); inst.done = true; }
    },
    scene() {
      const items = [{ t: "box", x: W / 2, y: H / 2, z: -40, w: W + 40, d: H + 40, h: 40, c: "#4a3a52" }, { t: "box", x: W / 2, y: H / 2, z: -2, w: W - 40, d: H - 40, h: 2, c: "#5b4864", ns: 1 }];
      [[W / 2, -6, W + 70, 28], [W / 2, H + 6, W + 70, 28], [-6, H / 2, 28, H + 20], [W + 6, H / 2, 28, H + 20]].forEach((w) => items.push({ t: "box", x: w[0], y: w[1], z: -20, w: w[2], d: w[3], h: 100, c: "#2f2236" }));
      pill.forEach((c) => items.push({ t: "cyl", x: c.x, y: c.y, z: -20, r: c.r, h: 140, c: "#7a6585" }));
      [[60, 60], [W - 60, 60], [60, H - 60], [W - 60, H - 60]].forEach((l) => items.push({ t: "deco", kind: "lamp", x: l[0], y: l[1], z: -20, s: 1.6 }));
      return { w: W, h: H, cam: { tilt: 60, fov: 42, pad: 1.08, c: [W / 2, H / 2 + 20], ht: 30 }, env: { sky: ["#1a1020", "#3a2850"], fog: "#1c1026", fogN: 70, fogF: 250, ground: { c: "#120a18", z: -200 }, lt: { h: ["#ffd9c0", "#4a3a5a"], hi: 0.8, d: "#ffe6cf", di: 0.75, dir: [-0.3, 1, 0.5] } }, items };
    },
    frame() {
      const items = [];
      bodies.forEach((b) => { items.push({ t: "pawn", id: "body" + b.id, x: b.x, y: b.y, z: 0, k: b.k, n: "", dead: 1, face: 0 }); items.push({ t: "text", id: "sk" + b.id, x: b.x, y: b.y, z: 48, v: "💀", s: 26 }); });
      pings.forEach((p, i) => items.push({ t: "ring", id: "pg" + i + "_" + Math.round(p.t0 * 10), x: p.x, y: p.y, z: 1, r: 20 + (t - p.t0) * 60, c: "#ff4d4d", a: Math.max(0, 1 - (t - p.t0) / 2.6) }));
      S.pawns((p) => { const q = S.byId(p.id); return { badge: q.role === "D" ? "🔎" : q.bd.stun > 0 ? "🧊" : "", st: "" }; }).forEach((it) => items.push(it));
      return { w: W, h: H, items, hud: { title: "Trouve le meurtrier", timer: Math.max(0, cap - t), chips: [{ text: alive().length + " en vie" }, { text: bodies.length + " victime" + (bodies.length > 1 ? "s" : "") }] } };
    },
    priv(pid) {
      const p = S.byId(pid); if (!p) return null;
      const role = p.role === "M" ? { name: "Meurtrier", tip: "Frappe de près avec Espace, sans te faire repérer.", c: "#e53935" } : p.role === "D" ? { name: "Détective", tip: "Tout le monde te connaît. Accuse avec Maj ou E quand tu es sûr.", c: "#3b82f6" } : { name: "Innocent", tip: "Observe, reste en groupe, accuse seulement si tu es sûr.", c: "#34c36c" };
      return { role, dead: p.dead ? 1 : 0, deadText: "Tu es mort, regarde la fin de l'enquête", cd: p.role === "M" ? p.cd : 0, stun: p.bd.stun };
    },
    ranking() {
      const M = S.P.find((p) => p.role === "M"); const win = result ? result.win : "I"; const bonus = {}, notes = {};
      const surv = S.P.filter((p) => p.role !== "M" && !p.dead).map((p) => p.id); const dead = S.P.filter((p) => p.role !== "M" && p.dead).sort((a, b) => b.diedAt - a.diedAt).map((p) => [p.id]);
      S.P.forEach((p) => { notes[p.id] = p.role === "M" ? "meurtrier" : p.role === "D" ? "détective" : "innocent"; });
      if (win === "M") { bonus[M.id] = Math.min(3, M.kills); notes[M.id] = "meurtrier, " + M.kills + " victime" + (M.kills > 1 ? "s" : ""); return { groups: [[M.id]].concat(surv.length ? [surv] : []).concat(dead), bonus, notes, headline: "🔪 " + M.name + " était le meurtrier et s'en sort" }; }
      if (result && result.by) { bonus[result.by] = 3; notes[result.by] = "a démasqué le meurtrier"; }
      notes[M.id] = "était le meurtrier";
      return { groups: (surv.length ? [surv] : []).concat(dead).concat([[M.id]]), bonus, notes, headline: "🔎 " + M.name + " était le meurtrier, les innocents gagnent" };
    },
  };
  return inst;
};

// ============================================================
// BUS BAZAR — Vues filtrées par poste
// Chaque poste ne reçoit que ce qu'il peut voir. Les robots utilisent la même vue.
// ============================================================
const D = require("./public/game/data.js");
const Rd = require("./public/game/road.js");
const Sim = require("./bb-sim.js");
const Ev = require("./bb-events.js");

const r1 = (v) => Math.round(v * 10) / 10;
function cdsOf(S) { const o = {}; for (const k in S.cd) { const l = S.cd[k] - S.t; if (l > 0.05) o[k] = r1(l); } return o; }

function view(S, role) {
  const B = S.biome; const stopName = S.phase === "stop" ? Rd.stopName(S.seed, S.si + 1) : null;
  const lights = {}; Sim.HP_SYS.forEach((k) => { lights[k] = Sim.sysLevel(S.hp[k]); }); if (S.leak) lights.tank = "crit";
  const flick = S.flicker > 0 && S.hp.electric < 55;
  const v = {
    role, t: r1(S.t), phase: S.phase, nSeg: S.nSeg, si: S.si, seed: S.seed, mode: S.cfg.mode, stopName,
    bus: { s: Math.round(S.bus.s), v: r1(S.bus.v), len: S.seg ? S.seg.len : 0, x: +S.bus.x.toFixed(2), vx: +S.bus.vx.toFixed(2) },
    seg: S.seg ? { seed: S.seg.seed, index: S.seg.index, kind: S.seg.kind, biome: S.seg.biome, difficulty: S.cfg.difficulty, biomes: S.cfg.biomes, len: S.seg.len, pois: S.seg.pois } : null,
    lights, fuel: Math.round(S.fuel), temp: Math.round(S.temp), body: Math.round(S.hp.body), noise: +S.noise.toFixed(2), stalled: S.stalled, leak: S.leak,
    inv: { spares: S.inv.spares, tape: S.inv.tape, coolant: S.inv.coolant, snacks: S.inv.snacks, medkit: S.inv.medkit, money: S.inv.money, items: Object.assign({}, S.inv.items) },
    sat: Math.round(Sim.avgMood(S)), nPax: S.pax.length, delay: Math.round(S.t - S.plannedCum), left: Math.max(0, Math.round(S.deadline - S.t)),
    jolt: +S.jolt.toFixed(2), seq: { hits: S.stats.hits, horns: S.stats.horns, slaps: S.stats.slaps, inc: S.stats.incidents, solved: S.stats.solved, radio: S.stats.radio }, foam: !!(S.foamUntil && S.foamUntil > S.t),
    paxLite: S.pax.slice(0, 6).map((p) => ({ id: p.id, arch: p.arch, mood: Math.round(p.mood), state: p.state })), tour: S.pax.some((p) => p.arch === "touriste"), prices: Sim.PRICES,
    end: S.end || null, inc: S.inc.map((i) => Ev.publicInc(S, i)), log: S.log.slice(-40), objectives: S.objectives.map((o) => ({ id: o.id, label: o.label, info: o.info, crit: o.crit, status: o.status })),
    cds: cdsOf(S), radioMsg: S.radioMsg && S.radioMsg.until > S.t ? S.radioMsg : null, radioOn: S.radioOn, stuckHorn: S.stuckHorn, flick, blind: S.blind > 0, fog: S.fog > 0, slip: S.slip > 0, startle: S.startle && S.startle.until > S.t ? S.startle.id : 0, wind: Math.round(S.windPush * 10) / 10,
    fake: S.fakeAlert && role !== "cabin" ? S.fakeAlert.sys : null, stopT: r1(S.stopT), chosen: S.chosen, canDepart: S.phase === "stop" && S.si < S.nSeg - 1, last: S.si >= S.nSeg - 1, em: S.em > 0, sab: S.cfg.sabotage, slapsOn: S.cfg.slaps,
  };
  if (role === "driver") {
    v.obs = S.phase === "drive" ? S.obs.filter((o) => !o.gone && o.s > S.bus.s - 8 && o.s < S.bus.s + Math.min(S.biome.vis * (S.fog > 0 ? 0.5 : 1) * (S.blind > 0 ? 0.0 : 1), 360)).map((o) => ({ id: o.id, kind: o.kind, s: Math.round(o.s), x: +o.x.toFixed(2), w: o.w, scared: o.scared > 0, name: o.kindName || "" })) : [];
    v.driver = { engine: Sim.sysLevel(S.hp.engine), pull: +S.pull.toFixed(2), grip: +(B.grip * (0.45 + 0.55 * S.hp.tires / 100) * (S.slip > 0 ? 0.5 : 1)).toFixed(2), speedLimit: B.speed, vis: B.vis };
  }
  if (role === "mech") {
    v.hp = {}; Sim.HP_SYS.forEach((k) => { v.hp[k] = Math.round(S.hp[k]); }); v.job = S.job ? { kind: S.job.kind, sys: S.job.sys, left: r1(S.job.left), total: S.job.total, paused: !!S.job.paused } : null;
    v.patches = S.patches.map((p) => ({ sys: p.sys, left: Math.max(0, Math.round(p.until - S.t)) })); v.hasHammer = Sim.has(S, "marteau"); v.hasExt = Sim.has(S, "extincteur"); v.deadT = Math.round(S.deadT);
  }
  if (role === "nav") {
    v.options = S.phase === "stop" && S.options ? S.options.map((o) => ({ kind: o.kind, blocked: o.blocked, biome: o.shown.biome, len: o.shown.len, pois: o.shown.pois, dubious: S.hp.electric < 30, curvIdx: undefined })) : null;
    v.gpsHint = S.gpsHint && S.gpsHint.at === S.si ? S.gpsHint.kind : null; v.tip = S.tip && S.tip.at >= S.si - 1 ? S.tip : null;
    v.forecast = S.pending.filter((p) => Ev.DEFS[p.id] && Ev.DEFS[p.id].forecast).map((p) => ({ id: p.id, icon: Ev.DEFS[p.id].icon, title: Ev.DEFS[p.id].title, in: Math.max(0, Math.round(p.at - S.t)) }));
    v.next = S.phase === "drive" && S.si < S.nSeg - 1 ? null : null; v.prices = Sim.PRICES; v.plannedCum = Math.round(S.plannedCum); v.deadline = Math.round(S.deadline);
    v.upcoming = S.seg ? { biome: S.seg.biome, remaining: Math.max(0, Math.round(S.seg.len - S.bus.s)), pois: S.seg.pois.filter((p) => p.s > S.bus.s).map((p) => ({ name: p.name, in: Math.round(p.s - S.bus.s) })), obsAhead: S.obs.filter((o) => !o.gone && o.s > S.bus.s).length } : null;
    v.hasGps = Sim.has(S, "gps");
  }
  if (role === "cabin") {
    v.pax = S.pax.map((p) => ({ id: p.id, name: p.name, arch: p.arch, mood: Math.round(p.mood), state: p.state, req: p.req ? { type: p.req.type, left: Math.round(p.req.ttl) } : null, trait: p.revealed ? p.trait : null, vip: p.vip, parcel: p.parcel, inv: p.invincible > 0 }));
    v.hasDuck = Sim.has(S, "canardplastique"); v.cabinItems = ["canardplastique", "gilet", "trophee"].concat(D.GIFT_IDS.filter((k) => !["canardplastique", "gilet", "trophee"].includes(k))).filter((k) => Sim.has(S, k));
  }
  return v;
}
module.exports = { view };

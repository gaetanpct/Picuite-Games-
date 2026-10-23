// ============================================================
// BUS BAZAR — Robots d'équipage
// Chaque robot ne lit que la vue de son poste, comme un joueur. Il agit avec un temps de réaction.
// ============================================================
const D = require("./public/game/data.js");
const Rd = require("./public/game/road.js");
const { view } = require("./bb-view.js");
const { act } = require("./bb-actions.js");
const { clamp } = D;

const SKILL = {
  debutant: { id: "debutant", label: "Débutant", react: 0.9, noise: 0.14, look: 45, err: 0.25, margin: 0.7 },
  habile: { id: "habile", label: "Habile", react: 0.5, noise: 0.06, look: 70, err: 0.1, margin: 0.85 },
  expert: { id: "expert", label: "Expert", react: 0.3, noise: 0.02, look: 100, err: 0.02, margin: 0.95 },
};
function makeBrain(role, skillId, rng) { const sk = SKILL[skillId] || SKILL.habile; return { role, sk, rng: rng || Math.random, timer: sk.react * Math.random(), seenInc: {}, noteT: 0 }; }

function think(S, brain, dt) {
  if (!S || S.end) return;
  brain.timer -= dt; const v0 = brain.role === "driver" ? null : null;
  if (brain.role === "driver") { driver(S, brain, view(S, "driver")); return; }
  if (brain.timer > 0) return; brain.timer = brain.sk.react * (0.7 + brain.rng() * 0.6);
  const v = view(S, brain.role);
  if (brain.role === "mech") mech(S, brain, v); else if (brain.role === "nav") nav(S, brain, v); else cabin(S, brain, v);
}

// ---------- conducteur ----------
function driver(S, br, v) {
  const sk = br.sk;
  if (v.phase === "stop") {
    if (!v.canDepart) return;
    br.ctl = null; if (S.chosen && S.stopT > 9 && !S.job && S.hp.engine > 0 && !S.stalled && v.fuel > 0) act(S, "driver", { t: "depart" });
    else if (!S.chosen && S.stopT > 40 && !S.job) act(S, "driver", { t: "depart" });
    return;
  }
  if (v.phase !== "drive" || !v.seg) return;
  br.n = (br.n || 0) + 1;
  const seg = Rd.makeSegmentCached ? Rd.makeSegmentCached(v.seg) : cacheSeg(br, v.seg);
  const b = v.bus; const B = D.BIOMES.filter((q) => q.id === v.seg.biome)[0];
  const grip = v.driver.grip; const auth = 1.25 * grip * (1 - clamp(b.v / 45, 0, 0.4)) * clamp(b.v / 5, 0.2, 1);
  // vitesse cible selon les virages
  let maxC = 0; const look = sk.look * (v.fog ? 0.6 : 1);
  for (let d = 0; d <= look + b.v * 1.5; d += 12) maxC = Math.max(maxC, Math.abs(Rd.curveAt(seg, b.s + d)));
  let vt = B.speed * (v.lights.engine === "crit" ? 0.6 : 1) * (v.temp > 110 ? 0.6 : 1);
  if (maxC > 0.0008) vt = Math.min(vt, Math.sqrt(sk.margin * 1.25 * grip * 0.8 / (0.2 * maxC)) * 1.0);
  if (v.slip) vt = Math.min(vt, 12); if (v.fog) vt = Math.min(vt, B.speed * 0.7); if (v.driver.vis < 160) vt = Math.min(vt, B.speed * 0.8);
  // approche de l'arrêt
  const toStop = Math.max(0, b.len - 70 - b.s); vt = Math.min(vt, Math.sqrt(2 * 3.2 * toStop) + 0.6);
  if (b.s > b.len - 130 && b.v > 6) vt = Math.min(vt, 6);
  // obstacles
  let xt = 0; let danger = null; const reach = Math.min(look, 40 + b.v * 3);
  v.obs.forEach((o) => { const d = o.s - b.s; if (d < 2 || d > reach || o.scared) return; if (Math.abs(o.x - b.x) < 0.25 + o.w + 0.25 || Math.abs(o.x) < 0.25 + o.w) { if (!danger || d < danger.d) danger = { o, d }; } });
  if (v.blind) { vt = Math.min(vt, 6); }
  if (danger) {
    const o = danger.o; const side = o.x >= 0 ? -1 : 1; xt = clamp(o.x + side * (0.25 + o.w + 0.28), -0.85, 0.85);
    if ((o.kind === "animal" || o.kind === "pieton") && danger.d < 75 && !br.hornT) { if (act(S, "driver", { t: "horn" }).ok) br.hornT = 1.5; }
    if (o.kind === "slowcar") vt = Math.min(vt, o.v ? o.v : 7, Math.max(6, vt)); 
    if (danger.d < 14 + b.v * 0.5 && b.v > 9 && Math.abs(b.x - xt) > 0.45 && sk.id !== "debutant") act(S, "driver", { t: "dodge", dir: xt > b.x ? 1 : -1 });
    if (danger.d < 11 && b.v > 11 && Math.abs(b.x - xt) > 0.5 && sk.id === "expert") act(S, "driver", { t: "emergency" });
    if (o.kind !== "oil" && o.kind !== "pothole" && danger.d < 30) vt = Math.min(vt, 13);
  }
  if (br.hornT) br.hornT = Math.max(0, br.hornT - 0.05);
  if (v.blind) act(S, "driver", { t: "wipe" });
  // direction
  const curve = Rd.curveAt(seg, b.s); const comp = (curve * b.v * b.v * 0.2 * -1 * -1 - v.wind - v.driver.pull) / Math.max(0.3, auth);
  let steer = (xt - b.x) * 1.8 - b.vx * 0.55 + comp; steer += (Math.sin((S.t + (br.n % 7)) * 2.3) * sk.noise);
  steer = clamp(steer, -1, 1);
  // vitesse
  const err = vt - b.v; let thr = clamp(err * 0.35, 0, 1), brk = err < -0.6 ? clamp(-err * 0.3, 0, 1) : 0;
  if (v.stalled || S.fuel <= 0) { thr = 0; }
  act(S, "driver", { t: "drive", steer, thr, brk });
}
function cacheSeg(br, d) { const key = d.seed + "|" + d.index + "|" + d.kind + "|" + d.biome; if (br.segKey !== key) { br.segKey = key; br.seg = Rd.makeSegment({ seed: d.seed, index: d.index, kind: d.kind, biome: d.biome, difficulty: d.difficulty, biomes: d.biomes }); } return br.seg; }

// ---------- mécanicien ----------
const REPAIRABLE = ["engine", "cooling", "brakes", "tires", "electric", "tank", "body"];
function mech(S, br, v) {
  if (v.job) return; const hp = v.hp; const sk = br.sk;
  if (v.fake && v.hp[v.fake] > 60) { act(S, "mech", { t: "wrench", sys: v.fake }); return; }
  const stopped = v.bus.v < 3;
  if (v.stuckHorn) { if (v.hasHammer && act(S, "mech", { t: "hammer", sys: "electric" }).ok) return; if (act(S, "mech", { t: "wrench", sys: "electric" }).ok) return; }
  if (v.temp > 104 && v.inv.coolant > 0) { act(S, "mech", { t: "repair", sys: "engine", kind: "refroidir" }); return; }
  if (v.temp > 118 && v.hasExt) { act(S, "mech", { t: "extinguish" }); return; }
  const thr = v.phase === "stop" ? 75 : 50;
  const order = REPAIRABLE.filter((k) => (k === "tank" ? v.leak : hp[k] < (k === "body" ? 55 : thr))).sort((a, b) => (a === "tank" ? -1 : b === "tank" ? 1 : hp[a] - hp[b]));
  let pick = order[0]; if (!pick) return;
  if (br.rng() < sk.err && order.length > 1) pick = order[1];
  const spare = v.inv.spares, tape = v.inv.tape; const needStop = pick === "brakes" || pick === "tires";
  if (spare > 0 && (!needStop || stopped) && (spare > 1 || hp[pick] < 25 || v.phase === "stop") && act(S, "mech", { t: "repair", sys: pick, kind: "propre" }).ok) return;
  if (tape > 0 && act(S, "mech", { t: "repair", sys: pick, kind: "ruban" }).ok) return;
  if (v.hasHammer && act(S, "mech", { t: "hammer", sys: pick }).ok) return;
  act(S, "mech", { t: "wrench", sys: pick });
}

// ---------- navigateur ----------
function nav(S, br, v) {
  const sk = br.sk;
  if (v.radioOn) act(S, "nav", { t: "radio_off" });
  v.inc.forEach((i) => { if (!i.dilemma || br.seenInc[i.id]) return; br.seenInc[i.id] = 1; decideDilemma(S, br, v, i); });
  if (v.phase !== "stop") return;
  if (!v.canDepart) return;
  // courses
  const m = () => v.inv.money; const P = v.prices || {};
  const buy = (w, cond, keep) => { if (cond && m() - (P[w] || 0) >= (keep || 0)) act(S, "nav", { t: "buy", what: w }); };
  if (!br.stopDone || br.stopDone !== v.si) {
    if (v.fuel < 60) buy("fuel", true, 0); if (v.fuel < 35) buy("fuel", true, 0);
    buy("spares", v.inv.spares < 2, 20); buy("tape", v.inv.tape < 2, 15); buy("coolant", v.inv.coolant < 1, 15); buy("medkit", v.inv.medkit < 1, 30); buy("snacks", v.inv.snacks < 3, 40);
    if (v.hasGps) act(S, "nav", { t: "gps" });
    if (v.fuel < 85) buy("fuel", m() > 90, 60);
  }
  if (!v.options || v.chosen) { return; }
  br.stopDone = v.si;
  const hurt = v.body < 60 || v.lights.engine !== "ok" || v.lights.brakes === "crit" || v.lights.tires === "crit";
  const late = v.delay > 25;
  let best = null, bs = -1e9;
  v.options.forEach((o) => {
    if (o.blocked) return; const Bm = D.BIOMES.filter((q) => q.id === o.biome)[0] || D.BIOMES[0];
    let sc = -Bm.curve * 2 - Bm.density * 1.2 + Bm.grip * 3 - o.len / 900;
    if (o.kind === "direct") sc += late && !hurt ? 2.6 : -0.6; if (o.kind === "sure") sc += hurt ? 2.5 : 0.8; if (o.kind === "pittoresque") sc += v.mode === "tourisme" ? 2.5 : 0;
    if (v.gpsHint === o.kind) sc += 0.7; if (v.tip && v.tip.kind === o.kind) sc += v.tip.good ? 0.4 : -0.4;
    sc += (br.rng() - 0.5) * sk.err * 6; if (sc > bs) { bs = sc; best = o; }
  });
  if (best) act(S, "nav", { t: "route", kind: best.kind });
}
function decideDilemma(S, br, v, i) {
  const choose = (c) => act(S, "nav", { t: "decide", inc: i.id, choice: c });
  if (i.defId === "prime") choose(v.delay <= 5 && v.body > 50 ? "oui" : "non");
  else if (i.defId === "champ") choose(v.lights.tires === "ok" && v.body > 60 && br.rng() < 0.5 ? "oui" : "non");
  else if (i.defId === "autostoppeur") choose(v.bus.v < 3 ? "oui" : "non");
}

// ---------- responsable de cabine ----------
function cabin(S, br, v) {
  const sk = br.sk; const pax = v.pax; if (!pax) return; const can = (a) => !v.cds["cabin:" + a];
  if (v.cds["cabin:any"]) return;
  const incs = v.inc;
  const doIt = (a, p, item) => act(S, "cabin", { t: "cabin", action: a, pid: p ? p.id : undefined, item }).ok;
  const sick = pax.find((p) => p.state === "malaise"); if (sick && v.inv.medkit > 0 && can("soigner") && doIt("soigner", sick)) return;
  if (sick && v.bus.v < 2 && can("parler") && doIt("parler", sick)) return;
  if (incs.some((i) => i.defId === "bagarre")) { if (can("discours_autoritaire") && doIt("discours_autoritaire")) return; if (can("sifflet") && doIt("sifflet")) return; }
  const fx = pax.find((p) => p.arch === "fauxchauffeur"); if (incs.some((i) => i.defId === "prise_volant") && fx) { if (can("sifflet") && doIt("sifflet")) return; if (doIt("parler", fx)) return; }
  const col = pax.find((p) => p.arch === "colis"); if (incs.some((i) => i.defId === "colis_suspect") && col && can("confisquer") && doIt("confisquer", col)) return;
  const an = pax.find((p) => p.arch === "animal"); if (incs.some((i) => i.defId === "animal_libre") && an) { if (v.inv.snacks > 0 && can("snack") && doIt("snack", an)) return; if (can("parler") && doIt("parler", an)) return; }
  const vip = pax.find((p) => p.vip); if (vip && vip.mood < 45) { if (vip.req && vip.req.type === "snack" && v.inv.snacks > 0 && can("snack") && doIt("snack", vip)) return; if (can("parler") && doIt("parler", vip)) return; }
  // demandes les plus pressantes
  const wants = pax.filter((p) => p.req).sort((a, b) => a.req.left - b.req.left);
  if (v.sat < 35 && can("discours_rassurant") && doIt("discours_rassurant")) return;
  for (const p of wants) {
    const t = p.req.type;
    if (t === "snack" && v.inv.snacks > 0 && can("snack") && doIt("snack", p)) return;
    if (t === "canard" && v.cabinItems.includes("canardplastique") && can("cadeau") && doIt("cadeau", p, "canardplastique")) return;
    if (t === "annonce" && can("discours_absurde") && wants.filter((q) => q.req.type === "annonce").length >= 1 && doIt("discours_absurde")) return;
    if (t === "silence" && can("sifflet") && wants.filter((q) => q.req.type === "silence").length >= 2 && doIt("sifflet")) return;
    if (can("parler") && doIt("parler", p)) return;
  }
  const panicky = pax.filter((p) => p.state === "panique");
  if (panicky.length >= 3 && can("discours_rassurant") && doIt("discours_rassurant")) return;
  if (sk.id === "expert" && panicky.length === 1 && v.slapsOn && can("baffe") && br.rng() < 0.15 && doIt("baffe", panicky[0])) return;
  const low = pax.slice().sort((a, b) => a.mood - b.mood)[0]; if (low && low.mood < 45 && can("parler")) doIt("parler", low);
}

module.exports = { SKILL, makeBrain, think };

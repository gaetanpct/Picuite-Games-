// ============================================================
// BUS BAZAR — Actions des joueurs (validées côté serveur)
// Chaque action vérifie le poste, l'état du bus, les ressources et les délais.
// ============================================================
const D = require("./public/game/data.js");
const Sim = require("./bb-sim.js");
const Ev = require("./bb-events.js");
const { clamp } = D;

const RADIO = [
  "Mayday mayday, le bus est en danger de tomber en panne de café.",
  "Ici la tour de contrôle, nous vous voyons très en retard et très beau.",
  "Attention, canard en vue, je répète, canard en vue.",
  "Chers passagers, ceci n'est pas un exercice, ceci est un bus.",
  "Alerte générale, quelqu'un a mangé le dernier biscuit.",
];
const ANN = {};
const PRANKS = { fausse_alerte: { label: "Fausse alerte moteur", cost: 5 }, insecte: { label: "Faux insecte sur le conducteur", cost: 0 }, annonce_mal: { label: "Annonce déplacée", cost: 0 }, radio: { label: "Radio dramatique", cost: 0 } };

const ok = (extra) => Object.assign({ ok: true }, extra || {});
const err = (e) => ({ ok: false, err: e });
const cdLeft = (S, k) => Math.max(0, (S.cd[k] || 0) - S.t);
function setCd(S, k, sec) { S.cd[k] = S.t + sec; }
function gate(S, k, sec) { const l = cdLeft(S, k); if (l > 0) return "Patiente encore " + Math.ceil(l) + " seconde" + (l > 1 ? "s" : "") + "."; setCd(S, k, sec); return null; }
const stopped = (S) => S.phase === "stop" || S.bus.v < 3;
const sabotageOn = (S, kind) => { const m = S.cfg.sabotage; if (m === "aucune") return false; if (m === "limite") return kind === "radio" || kind === "annonce_mal"; return true; };

function act(S, role, m) {
  if (!S || S.end) return err("La mission est terminée.");
  if (!m || typeof m !== "object") return err("Message invalide.");
  const t = String(m.t || "");
  switch (t) {
    case "drive": return role === "driver" ? drive(S, m) : err("Seul le conducteur tient le volant.");
    case "horn": return role === "driver" ? horn(S) : err("Seul le conducteur klaxonne.");
    case "wipe": return role === "driver" ? wipe(S) : err("Seul le conducteur actionne l'essuie-glace.");
    case "dodge": return role === "driver" ? dodge(S, m) : err("Seul le conducteur peut faire cette manœuvre.");
    case "emergency": return role === "driver" ? emergency(S) : err("Seul le conducteur peut freiner en urgence.");
    case "depart": return role === "driver" || role === "nav" ? Sim.depart(S) : err("Le conducteur ou le navigateur donne le départ.");
    case "repair": return role === "mech" ? repair(S, m) : err("Seul le mécanicien répare.");
    case "wrench": return role === "mech" ? wrench(S, m) : err("Seul le mécanicien tient la clé.");
    case "hammer": return role === "mech" ? hammer(S, m) : err("Seul le mécanicien utilise le marteau.");
    case "extinguish": return role === "mech" ? extinguish(S) : err("Seul le mécanicien manie l'extincteur.");
    case "route": return role === "nav" ? Sim.chooseRoute(S, String(m.kind)) : err("Seul le navigateur choisit la route.");
    case "buy": return role === "nav" ? buy(S, m) : err("Seul le navigateur fait les achats.");
    case "gps": return role === "nav" ? gps(S) : err("Seul le navigateur utilise le GPS.");
    case "announce": return role === "nav" ? announce(S, m) : err("Seul le navigateur fait les annonces.");
    case "radio_off": return role === "nav" ? radioOff(S) : err("Seul le navigateur touche à la radio.");
    case "musique": return role === "driver" ? musique(S) : err("Seul le conducteur choisit la musique.");
    case "gyro": return role === "driver" ? gyro(S) : err("Seul le conducteur allume le gyrophare.");
    case "bidouille": return role === "mech" ? bidouille(S) : err("Seul le mécanicien bidouille.");
    case "parler_moteur": return role === "mech" ? parlerMoteur(S) : err("Seul le mécanicien parle au moteur.");
    case "decide": return decide(S, role, m);
    case "cabin": return role === "cabin" ? cabin(S, m) : err("Seule la responsable de cabine s'occupe des passagers.");
    case "radio": return radio(S, role, m);
    case "prank": return prank(S, role, m);
    default: return err("Action inconnue.");
  }
}

// ---------- conducteur ----------
function drive(S, m) {
  const n = (v, a, b) => { v = Number(v); return isFinite(v) ? clamp(v, a, b) : 0; };
  if (S.phase !== "drive") return ok();
  S.bus.steer = n(m.steer, -1, 1); S.bus.thr = n(m.thr, 0, 1); S.bus.brk = n(m.brk, 0, 1); return ok();
}
function horn(S) {
  if (S.hp.electric <= 0) return err("Le circuit électrique est mort, le klaxon ne répond plus.");
  if (S.stuckHorn) return err("Le klaxon est coincé, il hurle déjà.");
  const g = gate(S, "horn", 1.2); if (g) return err(g);
  const big = Sim.has(S, "klaxon"); S.stats.horns++; Sim.addNoise(S, big ? 1.6 : 0.8);
  S.pax.forEach((p) => { if (p.arch === "silence") p.mood = clamp(p.mood - (big ? 5 : 3), 0, 100); if (p.arch === "clown" && big) p.mood = clamp(p.mood + 3, 0, 100); });
  Sim.wakeSleepers(S, "Le klaxon réveille les dormeurs en sursaut.");
  let scared = 0; S.obs.forEach((o) => { if ((o.kind === "animal" || o.kind === "pieton") && !o.gone && o.scared <= 0 && o.s > S.bus.s && o.s - S.bus.s < 90) { if (big || S.rng() < 0.5) { o.scared = 1.5; scared++; } } });
  if (scared) Sim.addLog(S, "good", "📯", "Le klaxon met en fuite " + scared + " obstacle" + (scared > 1 ? "s" : "") + " vivant" + (scared > 1 ? "s" : "") + ".");
  Ev.notify(S, "horn", {}); return ok({ scared });
}
function wipe(S) {
  const g = gate(S, "wipe", 2); if (g) return err(g);
  const was = S.blind > 0; S.blind = 0; Ev.notify(S, "wipe", {}); if (was) Sim.addLog(S, "good", "🧽", "L'essuie-glace nettoie le pare-brise."); return ok();
}
function dodge(S, m) {
  if (S.phase !== "drive") return err("Le bus est à l'arrêt.");
  if (S.bus.v < 5) return err("Il faut rouler pour faire cette manœuvre.");
  const g = gate(S, "dodge", 12); if (g) return err(g);
  const dir = Number(m.dir) < 0 ? -1 : 1; const b = S.bus;
  b.vx += dir * 1.8; b.x = clamp(b.x + dir * 0.35, -1.5, 1.5); S.hp.tires = Math.max(0, S.hp.tires - 3); Sim.moodAll(S, -3); S.jolt = Math.max(S.jolt, 0.8);
  const danger = S.obs.some((o) => !o.gone && o.s > b.s && o.s - b.s < 45 && Math.abs(o.x - b.x + dir * 0.35) < 0.7);
  S.dodge = { until: S.t + 3, hits0: S.stats.hits, danger };
  Sim.addLog(S, "bus", "↔️", "Coup de volant spectaculaire " + (dir < 0 ? "à gauche" : "à droite") + ", les passagers s'accrochent aux sièges."); return ok();
}
function emergency(S) {
  const g = gate(S, "emergency", 8); if (g) return err(g);
  if (S.phase !== "drive") return err("Le bus est déjà arrêté.");
  S.em = 1.4; S.hp.brakes = Math.max(0, S.hp.brakes - 3); Sim.moodAll(S, -2); Sim.addLog(S, "bus", "🛑", "Freinage d'urgence, les freins chauffent."); return ok();
}

// ---------- mécanicien ----------
function repair(S, m) {
  const sys = String(m.sys), kind = String(m.kind); const R = D.REPAIRS[kind];
  if (!R || !Sim.HP_SYS.includes(sys)) return err("Réparation inconnue.");
  if (S.job) return err("Une réparation est déjà en cours.");
  if (kind === "clef") return err("Le coup de clé se lance avec son propre bouton.");
  if (kind === "refroidir") { if (S.inv.coolant <= 0) return err("Il n'y a plus de liquide de refroidissement."); S.inv.coolant--; S.job = { kind, sys: "engine", left: R.dur, total: R.dur }; return ok(); }
  if (sys === "body" && kind === "ruban" && false) return err("");
  if (R.cost.spares && S.inv.spares <= 0) return err("Il n'y a plus de pièce de rechange.");
  if (R.cost.tape && S.inv.tape <= 0) return err("Il n'y a plus de ruban adhésif.");
  const needStop = kind === "propre" && R.needStop.includes(sys);
  if (needStop && S.bus.v > 3) return err("Il faut que le bus soit presque arrêté pour réparer cela proprement.");
  if (R.cost.spares) S.inv.spares--; if (R.cost.tape) S.inv.tape--;
  let part = null; if (kind === "propre") part = Sim.pickW(S.rng, D.PARTS, (p) => p.p);
  S.job = { kind, sys, left: R.dur, total: R.dur, needStop, part };
  if (S.hp[sys] > 85 && sys !== "body") Sim.addLog(S, "mech", "🔧", "Le mécanicien bichonne " + Sim.sysLabel(sys) + " alors qu'il n'en a pas vraiment besoin.");
  return ok();
}
function wrench(S, m) {
  const sys = String(m.sys); if (!Sim.HP_SYS.includes(sys)) return err("Système inconnu.");
  const g = gate(S, "wrench", D.REPAIRS.clef.cd); if (g) return err(g);
  if (S.fakeAlert && S.fakeAlert.sys === sys) { S.fakeAlert = null; Sim.addLog(S, "mech", "🔧", "Le mécanicien inspecte " + Sim.sysLabel(sys) + " et ne trouve rien, c'était une fausse alerte."); return ok({ result: "nothing" }); }
  const r = S.rng(); let res = "nothing"; const W = D.WRENCH;
  if (r < W.help) { res = "help"; S.hp[sys] = clamp(S.hp[sys] + W.helpGain, 0, sys === "body" ? 90 : 100); Sim.addLog(S, "good", "🔧", "Un bon coup de clé et " + Sim.sysLabel(sys) + " reprend un peu du poil de la bête."); }
  else if (r < W.help + W.nothing) { Sim.addLog(S, "mech", "🔧", "Coup de clé sur " + Sim.sysLabel(sys) + ", il ne se passe rien du tout."); }
  else { res = "worse"; S.hp[sys] = clamp(S.hp[sys] - W.worseLoss, 0, 100); Sim.addLog(S, "bad", "🔧", "Mauvais coup de clé, " + Sim.sysLabel(sys) + " s'abîme encore."); }
  if (S.hp.tank >= 50) S.leak = false; Ev.notify(S, "wrench", { sys, result: res }); return ok({ result: res });
}
function hammer(S, m) {
  const sys = String(m.sys); if (!Sim.HP_SYS.includes(sys)) return err("Système inconnu.");
  if (!Sim.has(S, "marteau")) return err("Il n'y a pas de marteau en mousse à bord.");
  const g = gate(S, "hammer", 6); if (g) return err(g);
  S.hp[sys] = clamp(S.hp[sys] + 12, 0, sys === "body" ? 90 : 100); if (S.hp.tank >= 50) S.leak = false;
  S.pax.forEach((p) => { if (p.arch === "clown") p.mood = clamp(p.mood + 4, 0, 100); });
  Sim.addLog(S, "good", "🔨", "Boing, un coup de marteau en mousse sur " + Sim.sysLabel(sys) + ", ça fait rire le clown et ça aide un peu."); Ev.notify(S, "hammer", { sys }); return ok();
}
function extinguish(S) {
  if (!Sim.has(S, "extincteur")) return err("Il n'y a plus d'extincteur.");
  Sim.useItem(S, "extincteur"); S.temp = Math.max(30, S.temp - 60); S.blind = Math.max(S.blind, 5); S.foamUntil = S.t + 5;
  Sim.addLog(S, "good", "🧯", "Pschhhh, le moteur refroidit d'un coup, et le pare-brise disparaît sous la mousse pendant cinq secondes."); Ev.notify(S, "repair", { sys: "cooling", cool: true }); Ev.notify(S, "extinguish", {}); return ok();
}

// ---------- petites actions bonus ----------
function musique(S) {
  if (S.hp.electric <= 10) return err("Sans électricité, la musique ne marche plus.");
  const g = gate(S, "musique", 40); if (g) return err(g);
  S.song = Math.max(S.song, 25); Sim.addNoise(S, 0.5);
  S.pax.forEach((p) => { const bad = p.arch === "silence" || p.arch === "dormeur" || p.arch === "poete"; p.mood = clamp(p.mood + (bad ? -4 : p.arch === "sportif" || p.arch === "clown" ? 5 : 2), 0, 100); if (p.req && p.req.type === "silence") p.mood = clamp(p.mood - 3, 0, 100); });
  Sim.wakeSleepers(S, "La musique réveille les dormeurs."); Sim.addLog(S, "bus", "🎵", "Le conducteur monte le son, la cabine se met à taper du pied."); return ok();
}
function gyro(S) {
  if (S.phase !== "drive") return err("Le bus doit rouler.");
  if (S.hp.electric <= 15) return err("Le circuit électrique est trop faible pour le gyrophare.");
  const g = gate(S, "gyro", 45); if (g) return err(g);
  S.hp.electric = Math.max(0, S.hp.electric - 2); let n = 0;
  S.obs.forEach((o) => { if ((o.kind === "animal" || o.kind === "pieton") && !o.gone && o.s > S.bus.s && o.s - S.bus.s < 110 && o.scared <= 0) { o.scared = 1.5; n++; } });
  Sim.addLog(S, "good", "🚨", n ? "Le gyrophare de fête éblouit " + n + " obstacle" + (n > 1 ? "s" : "") + " vivant" + (n > 1 ? "s" : "") + ", qui s'écartent en dansant." : "Le gyrophare de fête tourne dans le vide, mais les passagers adorent.");
  if (!n) Sim.moodAll(S, 1); Ev.notify(S, "horn", { silent: true }); return ok({ scared: n });
}
const BIDOUILLES = [
  { w: 30, f(S, sys) { S.hp[sys] = clamp(S.hp[sys] + 18, 0, sys === "body" ? 90 : 100); Sim.addLog(S, "good", "🪛", "Une bidouille improbable et " + Sim.sysLabel(sys) + " repart comme neuf, personne ne sait pourquoi."); } },
  { w: 12, f(S) { S.inv.spares++; Sim.addLog(S, "good", "🔩", "Il reste une pièce en trop après le remontage. Elle rejoint la caisse à outils."); } },
  { w: 10, f(S) { S.inv.tape++; Sim.addLog(S, "good", "🎞️", "Un rouleau de ruban était coincé derrière le tableau de bord."); } },
  { w: 10, f(S) { S.song = Math.max(S.song, 10); Sim.moodAll(S, 2); Sim.addLog(S, "good", "🎶", "Le moteur se met à fredonner un air connu. Les passagers applaudissent."); } },
  { w: 8, f(S) { Sim.giveItem(S, D.ITEM_BY_ID.canardplastique); } },
  { w: 10, f(S) { S.blind = Math.max(S.blind, 4); Sim.addLog(S, "mech", "💨", "Pschhhit, un nuage de fumée violette monte du capot. Rien de grave, mais on n'y voit plus rien pendant quelques secondes."); } },
  { w: 12, f(S, sys) { S.hp[sys] = clamp(S.hp[sys] - 8, 0, 100); Sim.addLog(S, "bad", "🪛", "Quelque chose tombe de " + Sim.sysLabel(sys) + ". Ce n'était sûrement pas important."); } },
  { w: 8, f(S) { Sim.moodAll(S, -2); Sim.addNoise(S, 0.6); Sim.addLog(S, "bad", "💥", "Un grand bang sort du moteur et fait sursauter toute la cabine."); } },
];
function bidouille(S) {
  const g = gate(S, "bidouille", 25); if (g) return err(g);
  if (S.job) return err("Une réparation est déjà en cours.");
  const sys = Sim.HP_SYS.slice().sort((a, b) => S.hp[a] - S.hp[b])[0]; const b = Sim.pickW(S.rng, BIDOUILLES, (q) => q.w); b.f(S, sys);
  S.stats.bidouilles = (S.stats.bidouilles || 0) + 1; return ok();
}
function parlerMoteur(S) {
  const g = gate(S, "parler_moteur", 20); if (g) return err(g);
  const r = S.rng();
  if (r < 0.7) { S.temp = Math.max(30, S.temp - 8); if (r < 0.2) S.hp.engine = clamp(S.hp.engine + 6, 0, 100); Sim.addLog(S, "good", "🗣️", r < 0.2 ? "Le mécanicien murmure des mots doux et le moteur ronronne un peu mieux." : "Le mécanicien raconte sa journée au moteur, qui se détend légèrement."); }
  else if (r < 0.85) Sim.addLog(S, "mech", "🗣️", "Le moteur n'écoute pas. Le mécanicien insiste quand même.");
  else { S.temp += 5; Sim.addLog(S, "bad", "😤", "Le moteur se vexe et chauffe un peu plus."); }
  return ok();
}

// ---------- navigateur ----------
function buy(S, m) {
  if (S.phase !== "stop") return err("On ne fait ses courses qu'à l'arrêt.");
  const w = String(m.what); const P = Sim.PRICES; const I = S.inv;
  if (w === "fuel") { if (S.fuel >= 99) return err("Le réservoir est déjà plein."); if (I.money < P.fuel) return err("Pas assez d'argent."); I.money -= P.fuel; S.fuel = Math.min(100, S.fuel + 25); Sim.addLog(S, "nav", "⛽", "Le plein de 25 pour cent est fait."); return ok(); }
  const map = { spares: ["spares", 1, "pièce de rechange"], tape: ["tape", 2, "rouleaux de ruban"], coolant: ["coolant", 1, "bidon de liquide"], snacks: ["snacks", 4, "snacks"], medkit: ["medkit", 1, "trousse de premiers secours"] };
  const e = map[w]; if (!e) return err("Article inconnu."); if (I.money < P[w]) return err("Pas assez d'argent."); I.money -= P[w]; I[e[0]] += e[1]; Sim.addLog(S, "nav", "🛒", "Achat de " + e[1] + " " + e[2] + "."); return ok();
}
function gps(S) {
  if (!Sim.has(S, "gps")) return err("Il n'y a pas de GPS à bord.");
  if (S.phase !== "stop" || !S.options) return err("Le GPS se consulte à l'arrêt, avant de choisir la route.");
  if (S.hp.electric <= 10) return err("Sans électricité, le GPS reste muet.");
  const g = gate(S, "gps", 8); if (g) return err(g);
  const o = S.options.filter((x) => !x.blocked); const best = o.slice().sort((a, b) => (a.truthRisk + a.seg.len / 400) - (b.truthRisk + b.seg.len / 400))[0];
  const right = S.rng() < 0.5; const pick = right ? best : o[Math.floor(S.rng() * o.length)];
  S.gpsHint = { kind: pick.kind, at: S.si }; Sim.addLog(S, "nav", "🛰️", "Le GPS affirme avec un aplomb total que la meilleure route est " + (pick.kind === "direct" ? "la directe" : pick.kind === "sure" ? "la sûre" : "la pittoresque") + "."); return ok();
}
function announce(S, m) {
  const k = String(m.tpl); const A = D.ANN_BY_ID[k]; if (!A) return err("Annonce inconnue.");
  if (S.hp.electric <= 10) return err("Sans électricité, le micro ne marche plus.");
  const g = gate(S, "announce", 20); if (g) return err(g);
  Sim.addNoise(S, k === "silence" ? 0 : 0.2);
  const lv = (p, a) => D.ARCH_BY_ID[p.arch].loves.includes(a), ht = (p, a) => D.ARCH_BY_ID[p.arch].hates.includes(a);
  const mood = (p, d) => { p.mood = clamp(p.mood + d, 0, 100); };
  if (k === "loto") { const w = S.pax[Math.floor(S.rng() * S.pax.length)]; S.pax.forEach((p) => { if (p === w) { mood(p, 12); if (p.req) Sim.satisfyReq(S, p, 6); } else mood(p, -1); }); if (w) { S.inv.snacks += 1; Sim.addLog(S, "nav", "🎰", "Le loto des sièges tombe sur " + w.name + ", qui gagne un snack et la gloire éternelle."); } return ok(); }
  if (k === "silence") { S.noise = 0; }
  S.pax.forEach((p) => {
    if (k === "info" && p.req && (p.req.type === "annonce" || p.req.type === "info")) { Sim.satisfyReq(S, p, 10); return; }
    if (k === "meteo") { if (p.req && p.req.type === "info") { Sim.satisfyReq(S, p, 10); return; } mood(p, p.arch === "touriste" ? 4 : 1); return; }
    if (k === "silence") { if (p.req && p.req.type === "silence") { Sim.satisfyReq(S, p, 14); return; } mood(p, p.arch === "poete" ? 3 : -1); return; }
    if (k === "calme") { mood(p, 2 + (p.state === "panique" ? 4 : 0)); return; }
    if (k === "delire") { mood(p, S.rng() < 0.5 + (lv(p, "discours_absurde") ? 0.3 : 0) - (ht(p, "discours_absurde") ? 0.4 : 0) ? 5 : -5); return; }
    if (k === "compliment") { mood(p, p.trait === "raleur" || p.trait === "petard" ? 1 : 3 + (p.arch === "sosie" ? 3 : 0)); return; }
    if (k === "blague") { mood(p, S.rng() < 0.4 + (p.arch === "clown" ? 0.4 : 0) + (p.arch === "ventriloque" ? 0.2 : 0) - (p.arch === "poete" || p.arch === "plaignant" ? 0.25 : 0) ? 4 : -3); return; }
    mood(p, 1);
  });
  Sim.addLog(S, "nav", "📣", A.log + " à bord."); return ok();
}
function radioOff(S) {
  const was = S.radioOn; S.radioOn = false; S.song = 0; Ev.notify(S, "radio_off", {}); if (was) Sim.addLog(S, "good", "📻", "La radio est coupée, le silence revient."); return ok();
}
function decide(S, role, m) {
  const inc = S.inc.filter((x) => x.id === Number(m.inc))[0]; if (!inc) return err("Ce choix n'existe plus.");
  if (!inc.def.who.includes(role)) return err("Ce n'est pas à ton poste de décider.");
  return Ev.decide(S, inc.id, String(m.choice));
}

// ---------- cabine ----------
function cabin(S, m) {
  const A = D.CABIN_BY_ID[String(m.action)]; if (!A) return err("Action inconnue.");
  if (A.id === "baffe" && !S.cfg.slaps) return err("Les baffes cartoon sont désactivées dans ce salon.");
  const gl = cdLeft(S, "cabin:any"); if (gl > 0) return err("Une seconde de souffle.");
  let p = null;
  if (A.target) { p = Sim.paxById(S, String(m.pid)); if (!p) return err("Choisis d'abord un passager."); }
  const cl = cdLeft(S, "cabin:" + A.id); if (cl > 0) return err("Cette action sera prête dans " + Math.ceil(cl) + " seconde" + (cl > 1 ? "s" : "") + ".");
  if (A.cost) { for (const k in A.cost) { if ((S.inv[k] || 0) < A.cost[k]) return err(k === "snacks" ? "Il n'y a plus de snacks." : "Il n'y a plus de trousse de premiers secours."); } }
  let item = null; if (A.id === "cadeau") { item = String(m.item); if (!A.needItem.includes(item) || !Sim.has(S, item)) return err("Cet objet n'est pas dans l'inventaire."); }
  if (A.id === "evacuer" && S.phase !== "stop") return err("On ne fait descendre quelqu'un qu'à l'arrêt.");
  if (A.id === "soigner" && p.state !== "malaise") return err("Ce passager n'a pas de malaise.");
  setCd(S, "cabin:" + A.id, A.cd); setCd(S, "cabin:any", 0.8);
  const ctx = { speed: S.bus.v }; const odds = D.cabinOdds(A.id, p, ctx); const roll = S.rng() < odds; let res = { ok: roll, action: A.id, pid: p ? p.id : null };
  const moodAdj = (q, d) => { q.mood = clamp(q.mood + d, 0, 100); };
  const fx = EFFECTS[A.id](S, p, roll, item); Object.assign(res, fx || {});
  Ev.notify(S, "cabin", { action: A.id, pid: p ? p.id : null, ok: res.ok });
  return Object.assign({ ok: true, odds: Math.round(odds * 100) }, { result: res.ok ? "success" : "fail", msg: res.msg || "" });
}
const L = (S, icon, t, k) => Sim.addLog(S, k || "pax", icon, t);
const likes = (p, a) => D.ARCH_BY_ID[p.arch].loves.includes(a), hates = (p, a) => D.ARCH_BY_ID[p.arch].hates.includes(a);
function reveal(p) { p.revealed = true; }
const EFFECTS = {
  parler(S, p, roll) {
    if (!roll) { p.mood = clamp(p.mood - 2, 0, 100); L(S, "🙉", p.name + " n'écoute pas un mot de ce qui est dit."); return { ok: false, msg: p.name + " n'écoute pas." }; }
    reveal(p);
    if (p.req && ["attention", "plainte", "info", "silence", "photo", "pause", "canard"].includes(p.req.type)) {
      const t = p.req.type; Sim.satisfyReq(S, p, t === "photo" || t === "pause" ? 7 : 11); L(S, "💬", p.name + " est rassuré après une bonne discussion.");
      if (p.arch === "retraite" && t === "info") { const good = S.rng() < 0.55; S.tip = { text: "Le retraité jure que la route directe est " + (good ? "dégagée" : "pleine de bouchons") + ". Il est très sûr de lui.", kind: "direct", good, at: S.si, t: S.t }; L(S, "🧓", S.tip.text, "nav"); }
    } else { p.mood = clamp(p.mood + 4, 0, 100); L(S, "💬", "Petite discussion avec " + p.name + ", ça fait du bien."); }
    return { ok: true, msg: "Bonne discussion." };
  },
  snack(S, p, roll) {
    S.inv.snacks--; if (!roll) { p.mood = clamp(p.mood - 2, 0, 100); L(S, "🍪", p.name + " refuse le snack d'un air dégoûté."); return { ok: false, msg: "Snack refusé." }; }
    if (p.req && p.req.type === "snack") Sim.satisfyReq(S, p, 12); else p.mood = clamp(p.mood + 5, 0, 100);
    if (p.arch === "silence") { Sim.addNoise(S, 0.3); } L(S, "🍪", p.name + " croque son snack, tout content."); return { ok: true };
  },
  sifflet(S) {
    Sim.addNoise(S, 1.2); S.pax.forEach((p) => { if (p.req && p.req.type === "silence") Sim.satisfyReq(S, p, 10); else if (hates(p, "sifflet")) p.mood = clamp(p.mood - 5, 0, 100); else if (p.state === "colere") p.mood = clamp(p.mood + 2, 0, 100); else p.mood = clamp(p.mood - 1, 0, 100); });
    L(S, "🪈", "Coup de sifflet strident, la cabine se fige."); return { ok: true };
  },
  discours_rassurant(S) {
    S.pax.forEach((p) => { p.mood = clamp(p.mood + (["panique", "malaise", "colere"].includes(p.state) ? 8 : 2) + (likes(p, "discours_rassurant") ? 3 : 0), 0, 100); if (p.state === "panique") p.state = "normal"; }); L(S, "🕊️", "Discours rassurant, les épaules se relâchent."); return { ok: true };
  },
  discours_autoritaire(S) {
    S.pax.forEach((p) => { if (p.state === "colere") { p.state = "normal"; } let d = likes(p, "discours_autoritaire") ? 4 : -1; if (p.trait === "petard") d -= 5; p.mood = clamp(p.mood + d, 0, 100); }); L(S, "📢", "Discours autoritaire, chacun regagne sa place."); return { ok: true };
  },
  discours_absurde(S) {
    S.pax.forEach((p) => { if (p.req && p.req.type === "annonce") { Sim.satisfyReq(S, p, 12); return; } const pr = 0.5 + (likes(p, "discours_absurde") ? 0.3 : 0) - (hates(p, "discours_absurde") ? 0.4 : 0); p.mood = clamp(p.mood + (S.rng() < pr ? 6 : -6), 0, 100); }); L(S, "🎭", "Discours absurde, certains pleurent de rire, d'autres de désespoir."); return { ok: true };
  },
  cadeau(S, p, roll, item) {
    Sim.useItem(S, item);
    if (item === "canardplastique") { if (p.arch === "canards") { if (p.req) Sim.satisfyReq(S, p, 16); else p.mood = clamp(p.mood + 12, 0, 100); L(S, "🦆", p.name + " serre le canard sur son cœur."); return { ok: true }; } p.mood = clamp(p.mood + (roll ? 4 : -3), 0, 100); L(S, "🦆", p.name + (roll ? " accepte le canard avec un sourire gêné." : " regarde le canard d'un œil vide.")); return { ok: roll }; }
    if (item === "gilet") { p.invincible = 60; reveal(p); L(S, "🦺", p.name + " enfile le gilet magique et se sent invincible pendant une minute."); return { ok: true }; }
    const G = D.GIFTS[item];
    if (G && item !== "trophee") {
      const fav = (G.fav || []).includes(p.arch), bad = (G.bad || []).includes(p.arch); let d = G.base + (fav ? 6 : 0) - (bad ? 9 : 0);
      if (G.calm && (p.state === "panique" || p.state === "colere")) { p.state = "normal"; d += 6; }
      if (G.noisy) { d += S.rng() < 0.5 ? 6 : -6; Sim.addNoise(S, 0.5); Sim.wakeSleepers(S, "Le coussin a fait un bruit qui réveille les dormeurs."); }
      if (G.pop && S.rng() < G.pop) { d -= 8; L(S, "💥", "Le ballon de " + p.name + " éclate d'un coup sec, tout le monde sursaute."); Sim.addNoise(S, 0.8); }
      p.mood = clamp(p.mood + d, 0, 100); if (p.req && (p.req.type === "attention" || p.req.type === "snack") && d > 4) Sim.satisfyReq(S, p, 4);
      L(S, D.ITEM_BY_ID[item].icon, p.name + " " + G.line + (d < 0 ? " et le regrette aussitôt." : ".")); return { ok: d >= 0 };
    }
    p.mood = clamp(p.mood + 8, 0, 100); L(S, "🏆", p.name + " reçoit le trophée ridicule avec une fierté infinie."); return { ok: true };
  },
  ola(S) {
    S.pax.forEach((p) => { p.mood = clamp(p.mood + (p.arch === "silence" ? -2 : p.arch === "sportif" || p.arch === "clown" ? 6 : 3), 0, 100); });
    S.jolt = Math.max(S.jolt, 0.4); Sim.addNoise(S, 0.3); L(S, "🌊", "La ola traverse la cabine d'avant en arrière, le bus tangue un peu."); return { ok: true };
  },
  conga(S) {
    S.pax.forEach((p) => { const hate = p.arch === "silence" || p.arch === "dormeur" || p.arch === "poete"; p.mood = clamp(p.mood + (hate ? -8 : p.arch === "clown" || p.arch === "influenceur" || p.arch === "sportif" ? 9 : 5), 0, 100); if (p.state === "dort") p.state = "normal"; });
    S.jolt = Math.max(S.jolt, 1); Sim.addNoise(S, 1); S.hp.body = Math.max(0, S.hp.body - 1); S.song = Math.max(S.song, 12); L(S, "💃", "Une conga part de l'arrière et fait le tour du bus. Le plancher proteste."); return { ok: true };
  },
  quiz(S, p, roll) {
    if (!roll) { Sim.moodAll(S, -2); const q = S.pax[Math.floor(S.rng() * S.pax.length)]; L(S, "❓", "La question du quiz est si compliquée que " + (q ? q.name : "quelqu'un") + " exige une réclamation."); return { ok: false, msg: "Question ratée." }; }
    let n = 0; S.pax.slice().sort((a, b) => (a.req ? a.req.ttl : 999) - (b.req ? b.req.ttl : 999)).forEach((q) => { if (n < 2 && q.req && ["attention", "info", "annonce"].includes(q.req.type)) { Sim.satisfyReq(S, q, 10); n++; } else q.mood = clamp(q.mood + 3, 0, 100); });
    L(S, "❓", "Le quiz du bus passionne la cabine" + (n ? " et règle " + n + " demande" + (n > 1 ? "s" : "") + "." : ".")); return { ok: true };
  },
  tombola(S) {
    if (!S.pax.length) return { ok: false };
    const w = S.pax.slice().sort((a, b) => (a.mood + (a.req ? -20 : 0)) - (b.mood + (b.req ? -20 : 0)))[Math.floor(S.rng() * Math.min(3, S.pax.length))]; const r = S.rng();
    S.pax.forEach((q) => { if (q !== w) q.mood = clamp(q.mood - 1, 0, 100); });
    if (r < 0.45) { S.inv.snacks += 2; w.mood = clamp(w.mood + 10, 0, 100); L(S, "🎟️", w.name + " gagne deux paquets de biscuits à la tombola et les met en commun."); }
    else if (r < 0.75) { const id = D.GIFT_IDS[Math.floor(S.rng() * D.GIFT_IDS.length)]; Sim.giveItem(S, D.ITEM_BY_ID[id], true); w.mood = clamp(w.mood + 12, 0, 100); L(S, "🎟️", w.name + " gagne " + D.ITEM_BY_ID[id].label.toLowerCase() + " et le rend aussitôt à la responsable pour l'offrir à qui elle veut."); }
    else if (r < 0.9) { w.mood = clamp(w.mood + 16, 0, 100); if (w.req) Sim.satisfyReq(S, w, 8); L(S, "🎟️", w.name + " gagne le grand lot, une médaille imaginaire et le droit de choisir la prochaine chanson."); }
    else { S.stats.complaints += 1; L(S, "🎟️", "Le billet gagnant est introuvable, " + w.name + " crie à la tricherie.", "bad"); w.mood = clamp(w.mood - 8, 0, 100); return { ok: false }; }
    return { ok: true };
  },
  selfie(S, p, roll) {
    const flop = S.rng() < 0.25; S.pax.forEach((q) => { q.mood = clamp(q.mood + (flop ? -2 : q.arch === "touriste" || q.arch === "influenceur" || q.arch === "sosie" ? 10 : 2), 0, 100); if (!flop && q.req && q.req.type === "photo") Sim.satisfyReq(S, q, 6); });
    L(S, "🤳", flop ? "Dans le selfie de groupe, la moitié de la cabine a les yeux fermés et l'autre moitié ne le pardonne pas." : "Selfie de groupe réussi, le bus entier sourit en même temps."); return { ok: !flop };
  },
  sieste(S) {
    S.noise = 0; S.pax.forEach((q) => { if (q.req && q.req.type === "silence") Sim.satisfyReq(S, q, 12); else q.mood = clamp(q.mood + (q.arch === "dormeur" ? 8 : 4), 0, 100); if (q.arch === "dormeur" && q.state === "normal" && !q.req) q.state = "dort"; });
    L(S, "😴", "Lumières tamisées et silence, la cabine fait la sieste. Personne ne touche au klaxon, s'il vous plaît."); return { ok: true };
  },
  massage(S, p, roll) {
    if (!roll) { p.mood = clamp(p.mood - 4, 0, 100); L(S, "💆", p.name + " n'aime pas du tout qu'on lui touche la nuque."); return { ok: false }; }
    p.mood = clamp(p.mood + 10, 0, 100); if (p.req && p.req.type === "attention") Sim.satisfyReq(S, p, 5); L(S, "💆", p.name + " fond comme du beurre sous le massage de nuque."); return { ok: true };
  },
  horoscope(S, p, roll) {
    if (!roll) { p.mood = clamp(p.mood - 5, 0, 100); L(S, "🔮", "L'horoscope de " + p.name + " annonce une catastrophe imminente. Merci beaucoup."); if (S.rng() < 0.3 && p.state === "normal") p.state = "panique"; return { ok: false }; }
    p.mood = clamp(p.mood + 8, 0, 100); reveal(p); if (p.req && p.req.type === "info") Sim.satisfyReq(S, p, 6); L(S, "🔮", p.name + " apprend qu'une grande chance l'attend, et se rengorge."); return { ok: true };
  },
  penchez(S) {
    if (S.phase !== "drive") { L(S, "↔️", "Tout le monde se penche pour rien, le bus est déjà à l'arrêt."); Sim.moodAll(S, -1); return { ok: false }; }
    const active = Math.abs(S.pull) > 0.02 || Math.abs(S.windPush) > 0.02;
    if (active) { S.leanUntil = S.t + 6; L(S, "↔️", "Toute la cabine se penche du bon côté, le bus se redresse."); Sim.moodAll(S, -1); return { ok: true }; }
    Sim.moodAll(S, -2); L(S, "↔️", "Tout le monde se penche à droite pour contrer un vent qui n'existe pas.", "bad"); return { ok: false };
  },
  chanson(S) {
    S.song = Math.max(S.song, 20); S.pax.forEach((p) => { p.mood = clamp(p.mood + (hates(p, "chanson") ? -8 : likes(p, "chanson") ? 8 : 3), 0, 100); if (p.state === "dort") p.state = "normal"; }); L(S, "🎤", "Concours de chansons, la cabine chante faux et fort."); return { ok: true };
  },
  confisquer(S, p, roll) {
    if (!roll) { p.mood = clamp(p.mood - 6, 0, 100); L(S, "🧺", p.name + " refuse de rendre quoi que ce soit."); return { ok: false }; }
    p.mood = clamp(p.mood + (p.arch === "colis" || p.arch === "animal" ? 4 : hates(p, "confisquer") ? -10 : -4), 0, 100); p.req = null;
    if (p.arch === "colis" || p.arch === "animal") L(S, "🧺", "Le " + (p.arch === "colis" ? "colis" : "petit compagnon") + " de " + p.name + " est confié à la responsable."); else { L(S, "🧺", "L'objet gênant de " + p.name + " est confisqué."); if (hates(p, "confisquer") && S.rng() < 0.5) { S.stats.complaints++; L(S, "📝", p.name + " dépose une réclamation.", "bad"); } }
    return { ok: true };
  },
  soigner(S, p, roll) {
    S.inv.medkit--; if (S.rng() < 0.2) { Sim.giveItem(S, D.ITEM_BY_ID.canardplastique, true); L(S, "🦆", "La trousse de premiers secours contenait un canard en plastique. Ce n'est pas ce qu'on espérait."); return { ok: false, msg: "Un canard dans la trousse." }; }
    if (!roll) { L(S, "🩺", "Le soin n'a pas encore fait effet sur " + p.name + "."); S.inv.medkit++; return { ok: false }; }
    p.state = "normal"; p.mood = clamp(p.mood + 6, 0, 100); L(S, "🩺", p.name + " se sent mieux."); return { ok: true };
  },
  evacuer(S, p) {
    const idx = S.pax.indexOf(p); S.pax.splice(idx, 1);
    const hard = p.parcel || p.vip; if (p.vip) { S.objectives.forEach((o) => { if (o.id === "vip") o.status = "fail"; }); L(S, "🚪", "Mme la Directrice est descendue en claquant la porte, la compagnie va l'apprendre.", "bad"); Sim.finish(S, "fail", "objective"); return { ok: true }; }
    if (p.parcel) S.objectives.forEach((o) => { if (o.id === "colis" && o.status === "open") o.status = "fail"; });
    S.pax.forEach((q) => { q.mood = clamp(q.mood + (p.state === "colere" || p.trait === "petard" ? 2 : -3), 0, 100); }); if (p.mood > 50) { S.stats.complaints++; }
    L(S, "🚪", p.name + " descend du bus" + (p.mood > 50 ? " en protestant" : " sans demander son reste") + ".", p.mood > 50 ? "bad" : "pax"); return { ok: true };
  },
  baffe(S, p, roll) {
    S.stats.slaps++; if (roll) { p.mood = clamp(p.mood + 10, 0, 100); p.state = "normal"; L(S, "🖐️", "Une baffe cartoon, paf, " + p.name + " retrouve ses esprits en tournant sur lui-même."); }
    else { p.mood = clamp(p.mood - 15, 0, 100); S.stats.complaints += S.rng() < 0.5 ? 1 : 0; L(S, "🖐️", "La baffe cartoon fait scandale, " + p.name + " est vexé et les témoins aussi.", "bad"); }
    S.pax.forEach((q) => { if (q !== p) q.mood = clamp(q.mood - (roll ? 1 : 3), 0, 100); }); return { ok: roll };
  },
};

// ---------- farces entre équipiers ----------
function radio(S, role, m) {
  if (!sabotageOn(S, "radio")) return err("Les blagues entre équipiers sont désactivées dans ce salon.");
  const i = Math.floor(Number(m.i)); if (!(i >= 0 && i < RADIO.length)) return err("Message inconnu.");
  const g = gate(S, "prank:" + role, S.cfg.sabotage === "total" ? 18 : 30); if (g) return err(g);
  S.stats.radio++; S.stats.pranks++; Sim.addNoise(S, 0.4);
  S.pax.forEach((p) => { p.mood = clamp(p.mood - 1 + (["train", "clown", "influenceur"].includes(p.arch) ? 4 : 0) - (p.arch === "silence" ? 3 : 0), 0, 100); });
  S.radioMsg = { text: RADIO[i], from: role, until: S.t + 6, id: ++S.paxSeq };
  Sim.addLog(S, "prank", "📻", "Message radio de " + roleName(role) + ", " + RADIO[i], { role }); return ok();
}
function prank(S, role, m) {
  const k = String(m.kind); const P = PRANKS[k]; if (!P) return err("Farce inconnue.");
  if (k === "radio") return err("Utilise le bouton radio.");
  if (!sabotageOn(S, k)) return err("Cette farce est désactivée dans ce salon.");
  const g = gate(S, "prank:" + role, S.cfg.sabotage === "total" ? 18 : 30); if (g) return err(g);
  S.stats.pranks++;
  if (k === "annonce_mal") {
    S.pax.forEach((p) => { p.mood = clamp(p.mood + (["train", "clown"].includes(p.arch) ? 5 : p.arch === "silence" || p.arch === "plaignant" ? -6 : -1), 0, 100); if (p.req && p.req.type === "annonce") Sim.satisfyReq(S, p, 10); });
    Sim.addLog(S, "prank", "🙊", roleName(role) + " lâche une annonce complètement déplacée dans le micro. Certains adorent."); return ok();
  }
  if (k === "fausse_alerte") {
    if (S.inv.money < P.cost) return err("Une fausse alerte coûte " + P.cost + " d'amende et la caisse est vide.");
    S.inv.money -= P.cost; S.stats.fines++; const sys = ["engine", "brakes", "cooling", "electric"][Math.floor(S.rng() * 4)]; S.fakeAlert = { sys, until: S.t + 10 };
    Sim.addLog(S, "prank", "🚨", "Une alerte rouge s'affiche sur " + Sim.sysLabel(sys) + ". Était-elle bien réelle ? Cela coûte " + P.cost + " d'amende à la compagnie."); return ok();
  }
  if (k === "insecte") {
    if (S.phase !== "drive") return err("Le bus doit rouler pour que la farce ait un effet.");
    S.startle = { until: S.t + 1.6, id: ++S.paxSeq }; S.steerBias = 0.6 * (S.rng() < 0.5 ? -1 : 1); setTimeoutish(S, 0.9, () => { S.steerBias = 0; });
    Sim.addLog(S, "prank", "🕷️", roleName(role) + " pose un faux insecte sur l'épaule du conducteur, qui sursaute." ); return ok();
  }
  return err("Farce inconnue.");
}
function setTimeoutish(S, sec, fn) { S.timers = S.timers || []; S.timers.push({ at: S.t + sec, fn }); }
function runTimers(S) { if (!S.timers) return; S.timers = S.timers.filter((t) => { if (S.t >= t.at) { t.fn(); return false; } return true; }); }
function roleName(role) { const r = D.ROLES.filter((x) => x.id === role)[0]; return r ? r.label.toLowerCase() : role; }

module.exports = { act, RADIO, ANN, PRANKS, runTimers, sabotageOn, roleName };

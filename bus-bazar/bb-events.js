// ============================================================
// BUS BAZAR — Incidents et réactions en chaîne
// Chaque incident a une condition, des conséquences, des solutions et un poste concerné.
// ============================================================
const D = require("./public/game/data.js");
const Sim = require("./bb-sim.js");
const { clamp } = D;
const rnd = (S) => S.rng();

const DEFS = {};
const def = (id, d) => { d.id = id; DEFS[id] = d; };

const paxOf = (S, f) => S.pax.filter(f);
const pickPax = (S, f) => { const l = paxOf(S, f || (() => true)); return l.length ? l[Math.floor(rnd(S) * l.length)] : null; };
const biomeIs = (S, ...ids) => S.phase === "drive" && ids.includes(S.biome.id);
const driving = (S) => S.phase === "drive" && S.bus.s > 120 && S.bus.s < S.seg.len - 220;
const hasFix = (S) => S.inv.spares > 0 || S.inv.tape > 0;

// ---------- ROUTE (conducteur) ----------
def("vent", { cat: "route", icon: "💨", title: "Rafale de vent", sev: 1, who: ["driver"], forecast: 12, ttl: 10,
  weight: (S) => biomeIs(S, "cote", "montagne", "campagne", "pluie") ? 2.2 : driving(S) ? 0.5 : 0, ok: driving,
  spawn(S, i) { i.data.dir = rnd(S) < 0.5 ? -1 : 1; S.windPush = i.data.dir * (0.35 + S.cfg.difficulty * 0.05); },
  desc: (S, i) => "Une rafale pousse le bus vers " + (i.data.dir > 0 ? "la droite" : "la gauche") + " pendant quelques secondes.",
  hint: "Le conducteur corrige au volant et peut ralentir.", clear(S) { S.windPush = 0; } });

def("eboulement", { cat: "route", icon: "🪨", title: "Éboulement", sev: 2, who: ["driver"], ttl: 9, weight: (S) => biomeIs(S, "montagne", "etroit") ? 2 : 0, ok: (S) => driving(S) && S.bus.v > 5,
  spawn(S, i) { const s = S.bus.s + Math.max(80, Math.min(140, S.biome.vis * 0.5)); S.obs.push({ id: 900 + S.stats.incidents, kind: "rock", s, x: clamp(S.bus.x + (rnd(S) - 0.5) * 0.5, -0.7, 0.7), w: 0.32, gone: false, scared: 0 }); i.data.s = s; },
  desc: () => "Des rochers dégringolent juste devant. Il faut freiner ou changer de file.", hint: "Le conducteur évite ou freine. Un choc abîme les pneus.",
  tick(S, i) { if (S.bus.s > i.data.s + 6) return "done"; },
  on(S, i, ev) { if (ev.type === "rock") S.pending.push({ id: "crevaison", at: S.t + 2, chained: "eboulement" }); } });

def("brouillard", { cat: "route", icon: "🌫️", title: "Nappe de brouillard", sev: 1, who: ["driver", "nav"], forecast: 12, ttl: 22, weight: (S) => biomeIs(S, "montagne", "pluie", "nuit", "campagne") ? 1.8 : 0, ok: driving,
  spawn(S) { S.fog = 22; }, desc: () => "La visibilité chute. Les obstacles n'apparaissent que très tard.", hint: "Ralentir. Le navigateur peut annoncer ce qui vient.", clear(S) { S.fog = 0; } });

def("convoi", { cat: "route", icon: "🚜", title: "Véhicule très lent", sev: 1, who: ["driver"], ttl: 18, weight: (S) => biomeIs(S, "ville", "chantier", "industrie", "campagne") ? 2 : 0, ok: (S) => driving(S) && S.bus.v > 6,
  spawn(S, i) { const s = S.bus.s + 70; S.obs.push({ id: 800 + S.stats.incidents, kind: "slowcar", s, x: clamp(S.bus.x, -0.5, 0.5), w: 0.3, v: 6, gone: false, scared: 0 }); i.data.s = s; },
  desc: () => "Un tracteur occupe toute la voie à vitesse d'escargot.", hint: "Le conducteur double ou ralentit, un coup de klaxon aide.",
  tick(S, i) { const o = S.obs.filter((q) => q.kind === "slowcar" && q.s >= S.bus.s - 40 && !q.gone)[0]; if (!o || S.bus.s > i.data.s + 15) return "done"; },
  on(S, i, ev) { if (ev.type === "horn") { const o = S.obs.filter((q) => q.kind === "slowcar" && q.s > S.bus.s && q.s - S.bus.s < 90 && !q.gone)[0]; if (o) { o.scared = 1.2; return "solved"; } } } });

// ---------- MÉCANIQUE ----------
const sysWeight = (sys, base) => (S) => (S.phase === "drive" ? base * (1 + (100 - S.hp[sys]) / 40) * D_W(S) : 0);
const D_W = (S) => [0, 0.5, 1, 1.6, 2.4][S.cfg.breakdowns];
const lowOk = (sys, min) => (S) => S.phase === "drive" && S.hp[sys] > min && hasFix(S) && !S.inc.some((x) => x.defId === sysInc[sys]);
const sysInc = { cooling: "surchauffe", tires: "crevaison", tank: "fuite", electric: "court_circuit", brakes: "freins", engine: "courroie" };

def("surchauffe", { cat: "meca", icon: "🥵", title: "Surchauffe du moteur", sev: 2, who: ["mech", "driver"], ttl: 70, weight: sysWeight("cooling", 1.4), ok: (S) => lowOk("cooling", 12)(S) && (S.inv.coolant > 0 || hasFix(S)),
  spawn(S) { S.hp.cooling = Math.max(5, S.hp.cooling - 28); S.temp += 14; },
  desc: (S) => "Le circuit de refroidissement fuit, la température monte (" + Math.round(S.temp) + " degrés).", hint: "Le mécanicien refroidit ou répare. Le conducteur peut lever le pied.",
  tick(S, i) { if (S.temp < 88 && S.hp.cooling >= 40) return "done"; },
  on(S, i, ev) { if (ev.type === "repair" && (ev.sys === "cooling" || ev.cool) && S.temp < 100) return "solved"; },
  chainFail: [{ id: "courroie", p: 0.6, delay: 3 }] });

def("crevaison", { cat: "meca", icon: "🛞", title: "Pneu crevé", sev: 2, who: ["mech", "driver"], ttl: 100, weight: sysWeight("tires", 1.5), ok: lowOk("tires", 15),
  spawn(S, i) { S.hp.tires = Math.max(4, S.hp.tires - 40); i.data.dir = rnd(S) < 0.5 ? -1 : 1; S.pull = i.data.dir * 0.32; },
  desc: (S, i) => "Un pneu éclate, le bus tire à " + (i.data.dir > 0 ? "droite" : "gauche") + ". Le mécanicien doit réparer.", hint: "Ruban en roulant, ou pièce de rechange à l'arrêt.",
  tick(S) { if (S.hp.tires >= 50) return "done"; }, on(S, i, ev) { if (ev.type === "repair" && ev.sys === "tires" && S.hp.tires >= 50) return "solved"; }, clear(S) { S.pull = 0; } });

def("fuite", { cat: "meca", icon: "⛽", title: "Fuite du réservoir", sev: 2, who: ["mech", "nav"], ttl: 110, weight: sysWeight("tank", 0.9), ok: (S) => driving(S) && S.hp.tank >= 50 && hasFix(S) && S.fuel > 25 && !S.leak,
  spawn(S) { S.hp.tank = 20; S.leak = true; },
  desc: (S) => "Le réservoir perd du carburant. Il reste " + Math.round(S.fuel) + " pour cent.", hint: "Le mécanicien bouche la fuite avec du ruban ou une pièce.",
  tick(S) { if (!S.leak) return "done"; }, on(S, i, ev) { if (ev.type === "repair" && ev.sys === "tank" && !S.leak) return "solved"; } });

def("court_circuit", { cat: "meca", icon: "⚡", title: "Court-circuit", sev: 2, who: ["mech"], ttl: 60, weight: sysWeight("electric", 1.1), ok: lowOk("electric", 18),
  spawn(S) { S.hp.electric = Math.max(5, S.hp.electric - 35); S.flicker = 14; },
  desc: () => "Les lumières clignotent et le tableau de bord s'affole. Klaxon et annonces deviennent capricieux.", hint: "Le mécanicien répare le circuit électrique.",
  tick(S) { if (S.hp.electric >= 55) return "done"; }, on(S, i, ev) { if (ev.type === "repair" && ev.sys === "electric") return "solved"; },
  chainFail: [{ id: "klaxon_coince", p: 0.5, delay: 2 }] });

def("freins", { cat: "meca", icon: "🛑", title: "Freins qui fument", sev: 2, who: ["mech", "driver"], ttl: 70, weight: (S) => (S.phase === "drive" ? 1 * (1 + (100 - S.hp.brakes) / 40) * D_W(S) * (S.biome.id === "montagne" ? 1.8 : 1) : 0), ok: lowOk("brakes", 18),
  spawn(S) { S.hp.brakes = Math.max(6, S.hp.brakes - 28); }, desc: () => "Odeur de brûlé, les freins faiblissent. Il faudra anticiper chaque virage.", hint: "Le mécanicien répare à l'arrêt ou colmate. Le conducteur freine plus tôt.",
  tick(S) { if (S.hp.brakes >= 55) return "done"; }, on(S, i, ev) { if (ev.type === "repair" && ev.sys === "brakes") return "solved"; } });

def("courroie", { cat: "meca", icon: "🔗", title: "Courroie en lambeaux", sev: 2, who: ["mech"], ttl: 80, weight: sysWeight("engine", 0.8), ok: (S) => lowOk("engine", 25)(S),
  spawn(S) { S.hp.engine = Math.max(10, S.hp.engine - 22); S.temp += 6; }, desc: () => "Une courroie cède et le moteur tousse. Il perd de la puissance.", hint: "Le mécanicien remplace ou colmate la pièce.",
  tick(S) { if (S.hp.engine >= 60) return "done"; }, on(S, i, ev) { if (ev.type === "repair" && ev.sys === "engine") return "solved"; } });

// ---------- NAVIGATION ----------
def("route_barree", { cat: "nav", icon: "🚧", title: "Route barrée", sev: 1, who: ["nav"], ttl: 70, stopClear: true,
  weight: (S) => (S.phase === "stop" && S.options && S.si < S.nSeg - 2 ? 1.2 : 0), ok: (S) => S.phase === "stop" && !!S.options && S.options.filter((o) => !o.blocked).length >= 3,
  spawn(S, i) { const o = S.options.filter((q) => !q.blocked && q.kind !== "sure"); const b = o[Math.floor(rnd(S) * o.length)]; b.blocked = true; i.data.kind = b.kind; if (S.chosen === b.kind) S.chosen = null; },
  desc: (S, i) => "La route " + (i.data.kind === "direct" ? "directe" : "pittoresque") + " est fermée par des travaux.", hint: "Le navigateur choisit une autre route.", tick(S) { if (S.phase !== "stop") return "done"; } });

def("prime", { cat: "nav", icon: "💼", title: "Prime de ponctualité", sev: 0, who: ["nav"], ttl: 35, dilemma: true, weight: (S) => (S.phase === "stop" && S.si < S.nSeg - 1 ? 0.8 : 0), ok: (S) => S.phase === "stop" && !S.bonus && S.si < S.nSeg - 1,
  spawn(S, i) { i.data.amount = 60; },
  desc: () => "La compagnie propose 60 de prime pour arriver à l'heure à l'arrêt suivant. En cas de retard, ce sera 40 de pénalité.",
  choices: [{ id: "oui", label: "Accepter la prime", info: "60 si le prochain arrêt est atteint sans retard, sinon moins 40." }, { id: "non", label: "Refuser", info: "Rien ne change." }],
  decide(S, i, c) { if (c === "oui") { S.bonus = { seg: S.si + 1, amount: 60 }; Sim.addLog(S, "nav", "💼", "Prime acceptée, il va falloir se dépêcher."); } else Sim.addLog(S, "nav", "💼", "Prime refusée."); return "solved"; } });

def("champ", { cat: "nav", icon: "🌾", title: "Raccourci par un champ", sev: 1, who: ["nav", "driver"], ttl: 25, dilemma: true, weight: (S) => (driving(S) && S.seg.len - S.bus.s > 600 ? 0.9 * S.M.absurd : 0), ok: (S) => driving(S) && S.seg.len - S.bus.s > 600,
  spawn() { }, desc: () => "Le GPS propose de couper à travers un champ de citrouilles. Cela raccourcit la route de 250 mètres mais secoue le bus.",
  choices: [{ id: "oui", label: "Foncer dans le champ", info: "250 mètres gagnés. Pendant vingt secondes le bus est secoué, les pneus et l'humeur en souffrent." }, { id: "non", label: "Rester sur la route", info: "Rien ne change." }],
  decide(S, i, c) { if (c === "oui") { S.bus.s += 250; S.shortcut = 20; S.hp.tires = Math.max(0, S.hp.tires - 10); Sim.moodAll(S, -3); S.jolt = 1.4; Sim.addLog(S, "nav", "🎃", "Le bus traverse un champ de citrouilles, 250 mètres gagnés et une sacrée secousse."); S.obs.push({ id: 700, kind: "pothole", s: S.bus.s + 30, x: 0, w: 0.3, gone: false, scared: 0 }); } else Sim.addLog(S, "nav", "🛣️", "Le bus reste sur la route."); return "solved"; } });

def("autostoppeur", { cat: "nav", icon: "🧳", title: "Auto-stoppeur au bord de la route", sev: 0, who: ["nav", "driver"], ttl: 25, dilemma: true, weight: (S) => (driving(S) ? 0.7 * S.M.absurd : 0), ok: driving,
  spawn() { }, desc: () => "Quelqu'un fait signe avec une pancarte. Pour le prendre, le bus doit être à l'arrêt.",
  choices: [{ id: "oui", label: "Le prendre à bord", info: "Demande que le bus soit à l'arrêt. Il paie 15 mais ajoute un passager à gérer.", need: (S) => (S.bus.v < 3 ? true : "Le bus doit d'abord s'arrêter.") }, { id: "non", label: "Passer son chemin", info: "Rien ne change." }],
  decide(S, i, c) { if (c === "oui") { const A = D.ARCHETYPES; const p = Sim.addPax(S, A[Math.floor(rnd(S) * A.length)].id); p.mood = 62; S.inv.money += 15; Sim.addLog(S, "pax", "🧳", p.name + " monte à bord, un voyageur de plus (" + D.ARCH_BY_ID[p.arch].name.toLowerCase() + ")."); } return "solved"; } });

// ---------- CABINE ----------
def("malaise", { cat: "cabin", icon: "🤢", title: "Malaise d'un passager", sev: 2, who: ["cabin", "driver"], ttl: 45, weight: (S) => (S.pax.length ? 1.2 * (1 + S.noise) : 0), ok: (S) => S.pax.some((p) => p.state === "normal" && !p.vip) && !S.inc.some((x) => x.defId === "malaise"),
  spawn(S, i) { const p = pickPax(S, (q) => q.state === "normal" && !q.vip); if (!p) return false; p.state = "malaise"; p.req = null; i.data.pid = p.id; i.data.name = p.name; },
  desc: (S, i) => i.data.name + " ne se sent pas bien du tout.", hint: "La responsable de cabine soigne avec la trousse, ou le conducteur s'arrête pour souffler.",
  tick(S, i) { const p = Sim.paxById(S, i.data.pid); if (!p) return "done"; if (S.bus.v > 20) p.mood -= 0.3 * Sim.DT; },
  on(S, i, ev) { if (ev.type === "cabin" && ev.pid === i.data.pid && ev.ok && (ev.action === "soigner" || (ev.action === "parler" && S.bus.v < 2))) { const p = Sim.paxById(S, i.data.pid); if (p) { p.state = "normal"; } return "solved"; } },
  clear(S, i, why) { const p = Sim.paxById(S, i.data.pid); if (p && p.state === "malaise") { p.state = "normal"; if (why === "expire") { p.mood = clamp(p.mood - 25, 0, 100); S.stats.complaints++; Sim.addLog(S, "bad", "📝", p.name + " se remet mais dépose une réclamation."); } } } });

def("bagarre", { cat: "cabin", icon: "🥊", title: "Dispute entre passagers", sev: 2, who: ["cabin"], ttl: 30, weight: (S) => (S.pax.length > 3 ? 1.1 : 0), ok: (S) => paxOf(S, (p) => p.state === "normal").length >= 2 && !S.inc.some((x) => x.defId === "bagarre"),
  spawn(S, i) { const a = pickPax(S, (q) => q.state === "normal" && q.trait === "petard") || pickPax(S, (q) => q.state === "normal"); const b = pickPax(S, (q) => q.state === "normal" && q !== a); if (!a || !b) return false; a.state = "colere"; b.state = "colere"; i.data.a = a.id; i.data.b = b.id; i.data.names = [a.name, b.name]; },
  desc: (S, i) => i.data.names[0] + " et " + i.data.names[1] + " se disputent pour un accoudoir, et le ton monte.", hint: "Un coup de sifflet, un discours autoritaire ou une baffe cartoon calme les esprits.",
  tick(S, i) { Sim.addNoise(S, 0.5 * Sim.DT); [i.data.a, i.data.b].forEach((id) => { const p = Sim.paxById(S, id); if (p) p.mood = clamp(p.mood - 0.8 * Sim.DT, 0, 100); }); },
  on(S, i, ev) { if (ev.type === "cabin" && ev.ok && (ev.action === "sifflet" || ev.action === "discours_autoritaire" || (ev.action === "baffe" && [i.data.a, i.data.b].includes(ev.pid)) || (ev.action === "parler" && [i.data.a, i.data.b].includes(ev.pid)))) return "solved"; },
  clear(S, i, why) { [i.data.a, i.data.b].forEach((id) => { const p = Sim.paxById(S, id); if (p && p.state === "colere") p.state = "normal"; if (p && why === "expire") p.mood = clamp(p.mood - 15, 0, 100); }); if (why === "expire") S.stats.complaints++; },
  chainFail: [{ id: "malaise", p: 0.4, delay: 3 }] });

def("prise_volant", { cat: "cabin", icon: "🧢", title: "Un passager veut conduire", sev: 2, who: ["cabin", "driver"], ttl: 9, weight: (S) => (S.pax.some((p) => p.arch === "fauxchauffeur") && driving(S) ? 2 * S.M.absurd : 0), ok: (S) => driving(S) && S.pax.some((p) => p.arch === "fauxchauffeur"),
  spawn(S, i) { const p = S.pax.filter((q) => q.arch === "fauxchauffeur")[0]; i.data.pid = p.id; i.data.name = p.name; i.data.ph = 0; },
  desc: (S, i) => i.data.name + " s'accroche au volant pour montrer comment on conduit.", hint: "La responsable de cabine le calme avec la parole, un sifflet ou un discours.",
  tick(S, i, dt) { i.data.ph += dt * 3; S.steerBias = Math.sin(i.data.ph) * 0.65; },
  on(S, i, ev) { if (ev.type === "cabin" && ev.ok && ["sifflet", "discours_autoritaire", "discours_rassurant", "confisquer"].concat(ev.pid === i.data.pid ? ["parler", "baffe", "snack"] : []).includes(ev.action)) return "solved"; },
  clear(S) { S.steerBias = 0; } });

def("animal_libre", { cat: "cabin", icon: "🦜", title: "Animal en liberté", sev: 1, who: ["cabin", "driver"], ttl: 16, weight: (S) => (S.pax.some((p) => p.arch === "animal") && driving(S) ? 1.6 * S.M.absurd : 0), ok: (S) => driving(S) && S.pax.some((p) => p.arch === "animal"),
  spawn(S, i) { const p = S.pax.filter((q) => q.arch === "animal")[0]; i.data.pid = p.id; i.data.name = p.name; },
  desc: (S, i) => "L'animal de " + i.data.name + " s'est échappé et file vers la cabine du conducteur.", hint: "Un snack le fait revenir. Sinon il atterrit sur le tableau de bord et masque la vue.",
  on(S, i, ev) { if (ev.type === "cabin" && ev.ok && ev.pid === i.data.pid && (ev.action === "snack" || ev.action === "parler")) return "solved"; if (ev.type === "wipe") { return "solved"; } },
  clear(S, i, why) { if (why === "expire") { S.blind = 7; Sim.addLog(S, "bad", "🦜", "L'animal atterrit sur le pare-brise, le conducteur n'y voit plus rien."); } } });

def("colis_suspect", { cat: "cabin", icon: "📦", title: "Le colis qui bipe", sev: 1, who: ["cabin"], ttl: 26, weight: (S) => (S.pax.some((p) => p.arch === "colis") ? 1.4 * S.M.absurd : 0), ok: (S) => S.pax.some((p) => p.arch === "colis") && S.phase === "drive",
  spawn(S, i) { const p = S.pax.filter((q) => q.arch === "colis")[0]; i.data.pid = p.id; i.data.name = p.name; },
  desc: (S, i) => "Le colis de " + i.data.name + " bipe de plus en plus vite. Personne ne sait ce qu'il contient.", hint: "Le confisquer le met au coffre. Sinon, il éclate en confettis dans toute la cabine.",
  tick(S) { Sim.addNoise(S, 0.15 * Sim.DT); }, on(S, i, ev) { if (ev.type === "cabin" && ev.ok && ev.action === "confisquer" && ev.pid === i.data.pid) return "solved"; },
  clear(S, i, why) { if (why === "expire") { Sim.moodAll(S, -6); Sim.addLog(S, "bad", "🎊", "Le colis éclate en confettis, la cabine est couverte de paillettes et de mauvaise humeur."); } } });

def("cafe_renverse", { cat: "cabin", icon: "☕", title: "Café renversé", sev: 1, who: ["mech", "cabin"], ttl: 4, weight: (S) => (S.pax.some((p) => p.arch === "clown") ? 1.5 * S.M.absurd : 0), ok: (S) => S.pax.some((p) => p.arch === "clown") && S.phase === "drive",
  spawn(S) { S.hp.electric = Math.max(5, S.hp.electric - 12); S.flicker = 6; }, desc: () => "Le clown involontaire renverse un thermos sur le tableau électrique.", hint: "Rien à faire sur le moment, le mécanicien surveille le circuit.",
  chain: [{ id: "court_circuit", p: 0.4, delay: 5 }], tick() { } });

// ---------- CHAOS ----------
def("klaxon_coince", { cat: "chaos", icon: "📯", title: "Klaxon coincé", sev: 2, who: ["mech", "cabin"], ttl: 40, weight: (S) => (driving(S) ? 0.6 * S.M.absurd * (S.hp.electric < 50 ? 2 : 1) : 0), ok: (S) => driving(S) && !S.stuckHorn,
  spawn(S) { S.stuckHorn = true; }, desc: () => "Le klaxon hurle sans arrêt, les passagers se bouchent les oreilles.", hint: "Un coup de marteau en mousse, un coup de clé ou une réparation électrique le fait taire.",
  on(S, i, ev) { if ((ev.type === "repair" && ev.sys === "electric") || (ev.type === "hammer" && ev.sys === "electric") || (ev.type === "wrench" && ev.sys === "electric" && ev.result === "help")) return "solved"; },
  clear(S, i, why) { S.stuckHorn = false; if (why === "expire") { S.hp.electric = Math.max(0, S.hp.electric - 10); Sim.addLog(S, "bad", "🔋", "Le klaxon se tait enfin, mais la batterie est à plat."); } },
  chainFail: [{ id: "malaise", p: 0.3, delay: 2 }] });

def("insecte", { cat: "chaos", icon: "🪲", title: "Insecte géant sur le pare-brise", sev: 1, who: ["driver"], ttl: 12, weight: (S) => (driving(S) ? 0.9 * S.M.absurd : 0), ok: driving,
  spawn(S) { S.blind = 12; }, desc: () => "Un insecte énorme s'écrase sur le pare-brise. Plus rien n'est visible.", hint: "Le conducteur actionne l'essuie-glace.",
  on(S, i, ev) { if (ev.type === "wipe") return "solved"; }, clear(S) { S.blind = 0; } });

def("radio_pirate", { cat: "chaos", icon: "📻", title: "Radio pirate", sev: 1, who: ["nav", "cabin"], ttl: 30, weight: (S) => (S.phase === "drive" ? 0.9 * S.M.absurd : 0), ok: (S) => S.phase === "drive" && !S.radioOn,
  spawn(S) { S.radioOn = true; S.song = 30; }, desc: () => "La radio se met à diffuser de l'accordéon à plein volume.", hint: "Le navigateur coupe la radio, ou la responsable de cabine sort le sifflet.",
  on(S, i, ev) { if (ev.type === "radio_off" || (ev.type === "cabin" && ev.ok && ev.action === "sifflet")) return "solved"; },
  clear(S) { S.radioOn = false; S.song = 0; } });

def("trouvaille", { cat: "chaos", icon: "🎁", title: "Objet tombé du plafond", sev: 0, who: ["cabin"], ttl: 4, weight: (S) => (S.phase === "drive" ? 0.7 * S.M.items * Sim.OBJ_K[S.cfg.objects] : 0), ok: (S) => S.phase === "drive",
  spawn(S) { Sim.giveItem(S, Sim.pickItem(S)); }, desc: () => "Un objet tombe d'une trappe du plafond, personne ne sait d'où.", hint: "Il rejoint l'inventaire.", tick() { } });

// ---------- moteur ----------
function weightOf(S, d) { let w = 0; try { w = d.weight(S); } catch (e) { w = 0; } if (!w || w < 0) return 0; if (d.ok && !d.ok(S)) return 0; if (S.inc.some((x) => x.defId === d.id)) return 0; if (d.cat === "chaos") w *= S.M.absurd; return w * (d.sev >= 2 ? 1 : 1); }
const maxActive = (S) => 2 + Math.floor(S.cfg.chaos / 2);

function spawn(S, id, opts) {
  const d = DEFS[id]; if (!d) return null;
  if (d.forecast && !(opts && opts.now)) { S.pending.push({ id, at: S.t + d.forecast }); return { pending: true }; }
  const inc = { id: ++S.paxSeq + 1000, defId: id, def: d, t0: S.t, ttl: d.ttl, sev: d.sev, data: {}, done: false };
  if (S.hasLuck) { }
  if (d.spawn && d.spawn(S, inc) === false) return null;
  // porte-bonheur
  if (Sim.has(S, "bonheur") && d.sev >= 1) { Sim.useItem(S, "bonheur"); const r = rnd(S); if (r < 0.4) { inc.sev = Math.max(0, d.sev - 1); inc.ttl = d.ttl * 1.4; Sim.addLog(S, "item", "🍀", "Le porte-bonheur adoucit le prochain malheur."); } else if (r < 0.6) { inc.ttl = Math.max(6, d.ttl * 0.7); Sim.addLog(S, "item", "🍀", "Le porte-bonheur était un porte-malheur, l'incident est plus dur."); } else Sim.addLog(S, "item", "🍀", "Le porte-bonheur s'est évaporé sans effet."); }
  S.inc.push(inc); S.stats.incidents++;
  Sim.addLog(S, "inc", d.icon, d.title + ". " + d.desc(S, inc), { inc: inc.id, cat: d.cat, who: d.who });
  if (d.chain) d.chain.forEach((c) => { if (rnd(S) < c.p) S.pending.push({ id: c.id, at: S.t + c.delay, chained: id }); });
  if (!d.tick && !d.on && !d.dilemma && d.ttl <= 4) { inc.ttl = d.ttl; }
  return inc;
}
function close(S, inc, why) {
  if (inc.done) return; inc.done = true;
  if (inc.def.clear) inc.def.clear(S, inc, why);
  S.inc = S.inc.filter((x) => x !== inc);
  if (why === "solved") { S.stats.solved++; Sim.addLog(S, "good", "✅", inc.def.title + " réglé.", { inc: inc.id }); }
  else if (why === "expire") {
    if (inc.def.chainFail) inc.def.chainFail.forEach((c) => { if (rnd(S) < c.p) S.pending.push({ id: c.id, at: S.t + c.delay, chained: inc.defId }); });
    if (inc.def.sev >= 1 && !inc.def.dilemma) Sim.addLog(S, "bad", "⌛", inc.def.title + " n'a pas été réglé à temps.", { inc: inc.id });
  }
}
function notify(S, type, ev) {
  ev = Object.assign({ type }, ev || {});
  S.inc.slice().forEach((inc) => { if (inc.done || !inc.def.on) return; const r = inc.def.on(S, inc, ev); if (r === "solved") close(S, inc, "solved"); });
}
function decide(S, incId, choice) {
  const inc = S.inc.filter((x) => x.id === incId)[0]; if (!inc || !inc.def.dilemma) return { ok: false, err: "Ce choix n'existe plus." };
  const c = inc.def.choices.filter((x) => x.id === choice)[0]; if (!c) return { ok: false, err: "Choix inconnu." };
  if (c.need) { const r = c.need(S); if (r !== true) return { ok: false, err: r }; }
  const r = inc.def.decide(S, inc, choice); close(S, inc, r === "solved" ? "solved" : "done"); return { ok: true };
}
function stopIncident(S) {
  const pool = ["route_barree", "prime"].map((id) => DEFS[id]); const d = Sim.pickW(S.rng, pool, (q) => weightOf(S, q)); if (d && rnd(S) < 0.55) spawn(S, d.id, { now: true });
}
function tick(S, dt) {
  // incidents en attente (prévisions et enchaînements)
  S.pending = S.pending.filter((pd) => { if (S.t < pd.at) return true; const d = DEFS[pd.id]; if (!d) return false; if (pd.chained && d.ok && !d.ok(S)) return false; if (!pd.chained && d.ok && !d.ok(S)) return false; if (S.inc.some((x) => x.defId === pd.id)) return false; spawn(S, pd.id, { now: true }); return false; });
  // vie des incidents en cours
  S.inc.slice().forEach((inc) => {
    if (inc.done) return; inc.ttl -= dt; const r = inc.def.tick ? inc.def.tick(S, inc, dt) : null;
    if (r === "done") return close(S, inc, "done");
    if (r === "solved") return close(S, inc, "solved");
    if (inc.ttl <= 0) close(S, inc, inc.def.sev >= 1 || inc.def.dilemma ? (inc.def.dilemma ? "done" : "expire") : "done");
  });
  // tirage d'un nouvel incident
  if (S.phase !== "drive" || S.t < 25) { if (S.phase === "stop") S.incTimer = Math.max(S.incTimer, 8); return; }
  S.incTimer -= dt; if (S.incTimer > 0) return;
  const mean = Sim.CHAOS_INT[S.cfg.chaos] / Math.max(0.5, S.M.ev); S.incTimer = mean * (0.6 + rnd(S) * 0.8);
  const active = S.inc.filter((i) => !i.def.dilemma);
  if (active.length >= maxActive(S)) return;
  const hot = S.inc.filter((i) => i.sev >= 2).length; const list = Object.keys(DEFS).map((k) => DEFS[k]).filter((d) => !(hot >= 2 && d.sev >= 2));
  const d = Sim.pickW(S.rng, list, (q) => weightOf(S, q)); if (d) spawn(S, d.id);
}

// ---------- vue publique d'un incident ----------
function publicInc(S, inc) {
  const d = inc.def; return { id: inc.id, defId: d.id, icon: d.icon, title: d.title, cat: d.cat, sev: inc.sev, who: d.who, desc: d.desc(S, inc), hint: d.hint || "", left: Math.max(0, Math.round(inc.ttl)), dilemma: !!d.dilemma, choices: d.dilemma ? d.choices.map((c) => ({ id: c.id, label: c.label, info: c.info, ok: c.need ? c.need(S) === true : true, why: c.need && c.need(S) !== true ? c.need(S) : "" })) : null };
}

module.exports = { DEFS, tick, notify, close, spawn, decide, stopIncident, publicInc, maxActive };

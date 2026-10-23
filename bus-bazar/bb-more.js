// ============================================================
// BUS BAZAR — Incidents loufoques supplémentaires et manies des passagers
// Chargé par bb-events.js. Les incidents suivent les mêmes règles que les autres.
// Un incident absurde ne bloque jamais la route entièrement et reste toujours faisable.
// ============================================================
const D = require("./public/game/data.js");
const Sim = require("./bb-sim.js");
const { clamp } = D;

module.exports = function install(api) {
  const { def, rnd, pickPax, paxOf, biomeIs, driving } = api;
  const L = (S, k, icon, t) => Sim.addLog(S, k, icon, t);
  const obsId = (S) => (S.obsSeq = (S.obsSeq || 3000) + 1);
  const stopOk = (S) => S.phase === "stop" && S.si < S.nSeg - 1 && !!S.options;
  const pay = (S, n) => { const k = Math.min(n, S.inv.money); S.inv.money -= k; return k; };
  const lose = (S, sec) => { S.plannedCum -= sec; };
  const ANY = (S) => S.phase === "drive";
  const wipePlay = (S, i, ev) => ev.type === "wipe";

  // ---------- ROUTE ----------
  def("fanfare", { cat: "chaos", icon: "🎺", title: "Fanfare en travers de la route", sev: 1, who: ["driver"], ttl: 18,
    weight: (S) => (biomeIs(S, "ville", "campagne", "cote") ? 1.5 : driving(S) ? 0.5 : 0), ok: (S) => driving(S) && S.bus.v > 6,
    spawn(S, i) { i.data.ids = []; [[85, -0.6], [100, 0.6], [115, -0.6]].forEach(([d, x]) => { const id = obsId(S); i.data.ids.push(id); S.obs.push({ id, kind: "pieton", s: S.bus.s + d, x, w: 0.2, gone: false, scared: 0 }); }); i.data.end = S.bus.s + 130; },
    desc: () => "Une fanfare de village défile sur la route en jouant très faux. Les musiciens ne regardent pas devant eux.", hint: "Un coup de klaxon ou le gyrophare les fait s'écarter. Sinon, ralentir et slalomer.",
    tick(S, i) { if (S.bus.s > i.data.end) return "done"; },
    on(S, i, ev) { if (ev.type === "horn" && S.obs.some((o) => i.data.ids.includes(o.id) && o.scared > 0)) { L(S, "good", "🎺", "La fanfare s'écarte en jouant un air triomphal."); Sim.moodAll(S, 2); return "solved"; } } });

  def("troupeau", { cat: "chaos", icon: "🐑", title: "Troupeau en promenade", sev: 1, who: ["driver"], ttl: 18,
    weight: (S) => (biomeIs(S, "campagne", "montagne", "cote") ? 1.6 : 0), ok: (S) => driving(S) && S.bus.v > 6,
    spawn(S, i) { const names = ["de moutons", "de lamas", "d'oies grincheuses", "de vaches à lunettes", "de flamants roses"]; i.data.name = names[Math.floor(rnd(S) * names.length)]; i.data.ids = [];
      [[85, 0.6], [98, -0.6], [112, 0.55]].forEach(([d, x]) => { const id = obsId(S); i.data.ids.push(id); S.obs.push({ id, kind: "animal", s: S.bus.s + d, x, w: 0.22, gone: false, scared: 0 }); }); i.data.end = S.bus.s + 130; },
    desc: (S, i) => "Un troupeau " + i.data.name + " traverse tranquillement, en plusieurs fois.", hint: "Le klaxon les disperse. Sinon, on lève le pied et on passe entre eux.",
    tick(S, i) { if (S.bus.s > i.data.end) return "done"; },
    on(S, i, ev) { if (ev.type === "horn" && S.obs.some((o) => i.data.ids.includes(o.id) && o.scared > 0)) return "solved"; } });

  def("grenouilles", { cat: "chaos", icon: "🐸", title: "Pluie de grenouilles", sev: 1, who: ["driver", "cabin"], ttl: 14,
    weight: (S) => (biomeIs(S, "pluie", "campagne") ? 1.6 : driving(S) ? 0.25 : 0), ok: driving,
    spawn(S) { S.blind = 8; S.slip = Math.max(S.slip, 4); Sim.moodAll(S, -1); },
    desc: () => "Il pleut des grenouilles. Le pare-brise est tapissé et la route devient glissante.", hint: "L'essuie-glace nettoie la vue. Les grenouilles, elles, refusent de partir.",
    on: wipePlay2, clear(S) { S.blind = 0; } });
  function wipePlay2(S, i, ev) { if (ev.type === "wipe") { L(S, "good", "🐸", "L'essuie-glace balaie les grenouilles, qui s'en vont vexées."); return "solved"; } }

  def("mouette", { cat: "chaos", icon: "🐦", title: "Mouette voleuse de snacks", sev: 1, who: ["cabin", "driver"], ttl: 16,
    weight: (S) => (biomeIs(S, "cote") ? 2 : driving(S) ? 0.3 : 0), ok: (S) => driving(S) && S.inv.snacks > 1,
    spawn() { }, desc: () => "Une mouette est entrée par la fenêtre et fonce droit sur la réserve de snacks.", hint: "Un coup de sifflet ou de klaxon la chasse. Sinon elle part avec deux snacks.",
    on(S, i, ev) { if ((ev.type === "cabin" && ev.ok && (ev.action === "sifflet" || ev.action === "snack")) || (ev.type === "horn" && !ev.silent)) return "solved"; },
    clear(S, i, why) { if (why === "expire") { const n = Math.min(2, S.inv.snacks); S.inv.snacks -= n; L(S, "bad", "🐦", "La mouette repart avec " + n + " snack" + (n > 1 ? "s" : "") + " et une dignité intacte."); } } });

  def("fromage", { cat: "chaos", icon: "🧀", title: "Camion de fromages renversé", sev: 1, who: ["driver", "cabin"], ttl: 25, dilemma: true, bot: "non",
    weight: (S) => (driving(S) ? 0.7 * S.M.absurd : 0), ok: (S) => driving(S) && S.seg.len - S.bus.s > 500,
    spawn() { }, desc: () => "Un camion de fromages s'est renversé sur la route. L'odeur est incroyable et la chaussée glisse.",
    choices: [{ id: "oui", label: "S'arrêter ramasser du fromage", info: "Demande que le bus soit presque arrêté. Rapporte des snacks mais coûte du temps et sent fort.", need: (S) => (S.bus.v < 3 ? true : "Le bus doit d'abord s'arrêter.") }, { id: "non", label: "Rouler dessus", info: "Le bus glisse un instant, les pneus souffrent un peu." }],
    decide(S, i, c) { if (c === "oui") { S.inv.snacks += 3; lose(S, 12); Sim.moodAll(S, -1); L(S, "good", "🧀", "Le bus fait le plein de fromages, trois snacks de plus et une odeur qui restera jusqu'au terminus."); } else { S.slip = Math.max(S.slip, 5); S.hp.tires = Math.max(0, S.hp.tires - 3); L(S, "bad", "🧀", "Le bus patine sur le fromage fondu."); } return "solved"; } });

  def("tunnel_echo", { cat: "chaos", icon: "🕳️", title: "Tunnel à écho", sev: 0, who: ["driver"], ttl: 12,
    weight: (S) => (biomeIs(S, "montagne", "ville", "industrie") ? 1 : 0), ok: (S) => driving(S) && S.hp.electric > 15,
    spawn() { }, desc: () => "Le bus entre dans un tunnel à l'écho magnifique. Tout le monde se tait pour écouter.", hint: "Un coup de klaxon ici sonne comme un orchestre. Ou pas.",
    on(S, i, ev) { if (ev.type === "horn" && !ev.silent) { Sim.moodAll(S, 5, (p) => p.arch !== "silence" && p.arch !== "dormeur"); L(S, "good", "📯", "Le klaxon résonne dans le tunnel comme un orchestre, les passagers applaudissent."); return "solved"; } } });

  def("soleil_couchant", { cat: "chaos", icon: "🌅", title: "Coucher de soleil magnifique", sev: 0, who: ["driver", "cabin"], ttl: 22,
    weight: (S) => (biomeIs(S, "cote", "campagne", "montagne") ? 1.3 : 0), ok: (S) => driving(S) && S.seg.len - S.bus.s > 500,
    spawn() { }, desc: () => "Le ciel devient rose et orange. Les touristes collent le nez aux vitres en suppliant qu'on s'arrête.", hint: "S'arrêter quelques secondes ravit tout le monde. Rouler, c'est une déception pour les photographes.",
    tick(S, i) { if (S.bus.v < 2 && S.t - i.t0 > 1) { Sim.moodAll(S, 7); Sim.moodAll(S, 6, (p) => p.arch === "touriste" || p.arch === "influenceur" || p.arch === "sosie" || p.arch === "poete"); lose(S, 4); L(S, "good", "🌅", "Arrêt photo improvisé devant le coucher de soleil, la cabine est aux anges."); return "solved"; } },
    clear(S, i, why) { if (why === "expire") { Sim.moodAll(S, -3, (p) => p.arch === "touriste" || p.arch === "influenceur" || p.arch === "sosie"); } } });

  // ---------- NAVIGATION ET ARRÊTS ----------
  def("cortege", { cat: "nav", icon: "💒", title: "Cortège de mariage", sev: 0, who: ["driver", "nav", "cabin"], ttl: 25, dilemma: true, bot: "non",
    weight: (S) => (biomeIs(S, "campagne", "ville", "cote") ? 1.2 * S.M.absurd : 0), ok: (S) => driving(S) && S.bus.v > 5 && S.hp.electric > 15,
    spawn() { }, desc: () => "Un cortège de mariage klaxonne joyeusement devant le bus et fait signe de se joindre à la fête.",
    choices: [{ id: "oui", label: "Klaxonner avec eux", info: "Tout le monde est ravi et les mariés lancent parfois un cadeau. Cela coûte une dizaine de secondes." }, { id: "non", label: "Doubler poliment", info: "Rien ne change, sauf quelques soupirs de passagers romantiques." }],
    decide(S, i, c) { if (c === "oui") { Sim.moodAll(S, 5); Sim.addNoise(S, 0.8); lose(S, 10); L(S, "good", "💒", "Le bus rejoint le cortège en klaxonnant, les passagers jettent du riz par la fenêtre."); if (rnd(S) < 0.45) Sim.giveItem(S, Sim.pickItem(S)); } else { Sim.moodAll(S, -1, (p) => p.arch === "poete" || p.arch === "sosie"); L(S, "pax", "💒", "Le bus double le cortège, quelques passagers soupirent."); } return "solved"; } });

  def("duel_klaxon", { cat: "chaos", icon: "📯", title: "Duel de klaxons", sev: 0, who: ["driver"], ttl: 20, dilemma: true, bot: "non",
    weight: (S) => (driving(S) ? 0.6 * S.M.absurd : 0), ok: (S) => driving(S) && S.hp.electric > 25 && !S.stuckHorn,
    spawn() { }, desc: () => "Un car de tourisme se met à côté du bus et lance un duel de klaxons. Ses passagers regardent avec un air supérieur.",
    choices: [{ id: "oui", label: "Relever le défi", info: "Une chance sur deux de gagner, un peu plus avec le klaxon de clown. Sinon le bus fait pitié." }, { id: "non", label: "Refuser avec dignité", info: "Rien ne change." }],
    decide(S, i, c) { if (c !== "oui") return "solved"; const win = rnd(S) < 0.5 + (Sim.has(S, "klaxon") ? 0.15 : 0); Sim.addNoise(S, 1.2); Sim.wakeSleepers(S, "Le duel réveille les dormeurs."); if (win) { Sim.moodAll(S, 4); Sim.moodAll(S, 5, (p) => p.arch === "clown" || p.arch === "influenceur"); L(S, "good", "📯", "Le bus gagne le duel de klaxons, le car repart la queue basse."); } else { Sim.moodAll(S, -3); S.hp.electric = Math.max(0, S.hp.electric - 8); L(S, "bad", "📯", "Le klaxon du bus perd ce duel dans un couinement pathétique."); } return "solved"; } });

  def("quiz_radio", { cat: "nav", icon: "📻", title: "Jeu radiophonique", sev: 0, who: ["nav"], ttl: 30, dilemma: true, bot: "non",
    weight: (S) => (driving(S) ? 0.7 * S.M.absurd : 0), ok: (S) => driving(S) && S.hp.electric > 10 && !S.radioOn,
    spawn() { }, desc: () => "La radio annonce un jeu. Le premier à répondre à la question la plus bête de la région gagne un lot.",
    choices: [{ id: "oui", label: "Appeler et répondre", info: "Une chance sur deux de gagner un lot, sinon la radio se moque du bus en direct." }, { id: "non", label: "Changer de station", info: "Rien ne change." }],
    decide(S, i, c) { if (c !== "oui") return "solved"; if (rnd(S) < 0.5) { const m = 20 + Math.floor(rnd(S) * 15); S.inv.money += m; L(S, "good", "📻", "Bonne réponse, la radio offre " + m + " au bus et félicite la compagnie."); if (rnd(S) < 0.4) Sim.giveItem(S, Sim.pickItem(S)); } else { Sim.moodAll(S, -3); L(S, "bad", "📻", "Mauvaise réponse. La radio traite le bus de tortue en direct."); } return "solved"; } });

  def("peage_clown", { cat: "nav", icon: "🤡", title: "Péage tenu par un clown", sev: 0, who: ["nav"], ttl: 40, dilemma: true, stop: true, bot: "pay",
    weight: (S) => (stopOk(S) ? 0.9 : 0), ok: stopOk,
    spawn() { }, desc: () => "Un clown barre la route avec un bâton et réclame un péage. Il accepte les pièces, les blagues et les ballons.",
    choices: [{ id: "pay", label: "Payer 20", info: "Simple et sans histoire. Il rend un ballon en échange.", need: (S) => (S.inv.money >= 20 ? true : "Pas assez d'argent.") }, { id: "rimes", label: "Négocier en rimes", info: "Une chance sur deux de passer gratuit, sinon il réclame 30." }, { id: "non", label: "Faire le tour", info: "Gratuit, mais on perd vingt secondes." }],
    decide(S, i, c) { if (c === "pay") { pay(S, 20); Sim.giveItem(S, D.ITEM_BY_ID.ballon); L(S, "nav", "🤡", "Le clown encaisse 20 et tend un ballon géant au bus."); } else if (c === "rimes") { if (rnd(S) < 0.5) { Sim.moodAll(S, 2); L(S, "good", "🤡", "Le clown pleure de rire devant les rimes et laisse passer le bus gratuitement."); } else { const k = pay(S, 30); L(S, "bad", "🤡", "Les rimes sont jugées trop mauvaises, le clown prend " + k + "."); } } else { lose(S, 20); L(S, "nav", "🤡", "Le bus fait un détour pour éviter le clown, qui salue en pleurant."); } return "solved"; } });

  def("fete_village", { cat: "nav", icon: "🎪", title: "Fête du village", sev: 0, who: ["nav", "cabin"], ttl: 40, dilemma: true, stop: true, bot: "non",
    weight: (S) => (stopOk(S) ? 0.9 * S.M.absurd : 0), ok: stopOk,
    spawn() { }, desc: () => "Le village est en fête. Des habitants en costume proposent de la musique, des crêpes et un concours de grimaces.",
    choices: [{ id: "oui", label: "Faire une halte festive", info: "La cabine adore, on perd environ vingt-cinq secondes et on repart avec des provisions." }, { id: "non", label: "Saluer et continuer", info: "Rien ne change." }],
    decide(S, i, c) { if (c === "oui") { Sim.moodAll(S, 8); lose(S, 25); S.inv.snacks += 2; L(S, "good", "🎪", "Halte à la fête du village, la cabine rit, mange et repart avec deux snacks de plus."); if (rnd(S) < 0.4) Sim.giveItem(S, Sim.pickItem(S)); } return "solved"; } });

  def("marchand", { cat: "nav", icon: "🛍️", title: "Marchand ambulant", sev: 0, who: ["nav"], ttl: 40, dilemma: true, stop: true, bot: "non",
    weight: (S) => (stopOk(S) ? 1 : 0), ok: stopOk,
    spawn() { }, desc: () => "Un marchand ambulant au chapeau immense propose un sac mystère pour 15. Il jure que c'est une affaire exceptionnelle.",
    choices: [{ id: "oui", label: "Acheter le sac mystère", info: "Pour 15. Peut contenir des snacks, du ruban, un objet, un canard en plastique ou un mot gentil.", need: (S) => (S.inv.money >= 15 ? true : "Pas assez d'argent.") }, { id: "non", label: "Refuser poliment", info: "Rien ne change." }],
    decide(S, i, c) { if (c !== "oui") return "solved"; pay(S, 15); const r = rnd(S); if (r < 0.35) { S.inv.snacks += 3; L(S, "good", "🛍️", "Le sac contient trois snacks. Pas mal."); } else if (r < 0.58) { S.inv.tape += 2; L(S, "good", "🛍️", "Le sac contient deux rouleaux de ruban adhésif."); } else if (r < 0.78) { Sim.giveItem(S, Sim.pickItem(S)); } else if (r < 0.9) { Sim.giveItem(S, D.ITEM_BY_ID.canardplastique); } else { Sim.moodAll(S, 2); L(S, "pax", "🛍️", "Le sac ne contient qu'un mot gentil signé du marchand. Les passagers trouvent ça touchant."); } return "solved"; } });

  def("bus_jumeau", { cat: "nav", icon: "🚌", title: "Un bus jumeau à l'arrêt", sev: 0, who: ["nav", "cabin"], ttl: 40, dilemma: true, stop: true, bot: "non",
    weight: (S) => (stopOk(S) ? 0.8 * S.M.absurd : 0), ok: stopOk,
    spawn() { }, desc: () => "Un autre bus, tout aussi cabossé, se gare à côté. Son équipage propose de troquer un objet contre un autre, sans regarder.",
    choices: [{ id: "oui", label: "Troquer un objet", info: "Un objet au hasard de l'inventaire est échangé contre un objet au hasard. Demande d'avoir au moins un objet.", need: (S) => (Object.keys(S.inv.items).length ? true : "Il n'y a aucun objet à troquer.") }, { id: "non", label: "Échanger un salut", info: "Les équipages se saluent de loin. Cela remonte un peu le moral." }],
    decide(S, i, c) { if (c === "oui") { const ks = Object.keys(S.inv.items); const k = ks[Math.floor(rnd(S) * ks.length)]; Sim.useItem(S, k); const it = Sim.pickItem(S); Sim.giveItem(S, it, true); L(S, "good", "🔁", "Troc avec le bus jumeau, " + D.ITEM_BY_ID[k].label.toLowerCase() + " contre " + it.label.toLowerCase() + "."); } else { Sim.moodAll(S, 1); L(S, "pax", "👋", "Les deux équipages se saluent en klaxonnant, tout le monde agite la main."); } return "solved"; } });

  def("controleur", { cat: "nav", icon: "🕴️", title: "Contrôleur très zélé", sev: 1, who: ["nav", "cabin"], ttl: 40, dilemma: true, stop: true, bot: "bill",
    weight: (S) => (stopOk(S) ? 0.8 : 0), ok: stopOk,
    spawn() { }, desc: () => "Un contrôleur monte à bord avec un carnet géant. Il inspecte les billets, les sièges et même les ceintures.",
    choices: [{ id: "bill", label: "Montrer les papiers", info: "Quatre chances sur dix d'une amende de 25, sinon il repart en saluant." }, { id: "snack", label: "Lui offrir un snack", info: "Coûte un snack. Presque toujours efficace.", need: (S) => (S.inv.snacks > 0 ? true : "Il n'y a plus de snacks.") }, { id: "dort", label: "Faire semblant de dormir", info: "Il part vexé dans quatre cas sur dix. Sinon il note une réclamation." }],
    decide(S, i, c) { if (c === "bill") { if (rnd(S) < 0.4) { const k = pay(S, 25); L(S, "bad", "🕴️", "Un papier n'est pas à jour, amende de " + k + "."); } else L(S, "good", "🕴️", "Tout est en règle, le contrôleur salue et repart."); } else if (c === "snack") { S.inv.snacks--; if (rnd(S) < 0.9) L(S, "good", "🕴️", "Le contrôleur croque le snack et oublie son carnet."); else { S.stats.complaints++; L(S, "bad", "🕴️", "Le contrôleur est allergique au snack et note tout."); } } else { if (rnd(S) < 0.4) L(S, "good", "🕴️", "Le contrôleur repart sur la pointe des pieds."); else { S.stats.complaints++; L(S, "bad", "🕴️", "Le contrôleur n'est pas dupe et dépose une réclamation."); } } return "solved"; } });

  def("drone", { cat: "nav", icon: "🚁", title: "Drone de livraison perdu", sev: 0, who: ["nav", "cabin"], ttl: 30, dilemma: true, stop: true, bot: "oui",
    weight: (S) => (stopOk(S) ? 0.8 * S.M.absurd : 0), ok: stopOk,
    spawn() { }, desc: () => "Un drone tournoie au-dessus du bus avec un colis. Il a visiblement confondu l'adresse.",
    choices: [{ id: "oui", label: "Attraper le colis", info: "Un objet ou un lot de provisions, avec un risque que ce soit un canard en plastique." }, { id: "non", label: "Laisser filer", info: "Rien ne change." }],
    decide(S, i, c) { if (c === "oui") { const r = rnd(S); if (r < 0.2) { Sim.giveItem(S, D.ITEM_BY_ID.canardplastique); } else if (r < 0.5) { S.inv.snacks += 3; L(S, "good", "🚁", "Le colis du drone contient trois snacks encore tièdes."); } else { Sim.giveItem(S, Sim.pickItem(S)); } } return "solved"; } });

  // ---------- CABINE ----------
  def("ovni", { cat: "chaos", icon: "🛸", title: "Lumières dans le ciel", sev: 1, who: ["cabin"], ttl: 22,
    weight: (S) => (biomeIs(S, "nuit", "campagne", "montagne") ? 1.4 : driving(S) ? 0.2 : 0), ok: (S) => driving(S) && S.pax.length >= 3 && !S.pax.every((p) => p.state !== "normal"),
    spawn(S) { S.pax.forEach((p) => { if (p.state === "normal" && p.invincible <= 0 && rnd(S) < 0.4) p.state = "panique"; }); },
    desc: () => "Un objet lumineux flotte dans le ciel. Plusieurs passagers affirment que ce n'est pas un avion.", hint: "Un discours rassurant, un concours de chansons ou un discours absurde ramène le calme.",
    on(S, i, ev) { if (ev.type === "cabin" && ev.ok && ["discours_rassurant", "discours_absurde", "chanson"].includes(ev.action)) { S.pax.forEach((p) => { if (p.state === "panique") p.state = "normal"; }); return "solved"; } },
    clear(S, i, why) { if (why === "expire") { Sim.moodAll(S, -4); L(S, "bad", "🛸", "Les passagers restent convaincus d'avoir été observés pendant tout le trajet."); } } });

  def("karaoke", { cat: "chaos", icon: "🎤", title: "Karaoké sauvage", sev: 1, who: ["cabin"], ttl: 26,
    weight: (S) => (S.pax.length >= 3 && driving(S) ? 0.9 * S.M.absurd : 0), ok: (S) => driving(S) && S.pax.some((p) => p.state === "normal"),
    spawn(S, i) { const p = pickPax(S, (q) => q.state === "normal"); if (!p) return false; i.data.pid = p.id; i.data.name = p.name; },
    desc: (S, i) => i.data.name + " a trouvé un micro et chante à pleins poumons. Personne ne lui a demandé.", hint: "Rejoindre le concours de chansons, siffler ou confisquer le micro règle le problème.",
    tick(S, i, dt) { Sim.addNoise(S, 0.12 * dt); S.pax.forEach((p) => { if (p.id !== i.data.pid && (p.arch === "silence" || p.arch === "dormeur" || p.arch === "poete")) p.mood = clamp(p.mood - 0.5 * dt, 0, 100); }); },
    on(S, i, ev) { if (ev.type === "cabin" && ev.ok && (ev.action === "chanson" || ev.action === "sifflet" || (ev.action === "confisquer" && ev.pid === i.data.pid))) { const p = Sim.paxById(S, i.data.pid); if (p) p.mood = clamp(p.mood + (ev.action === "chanson" ? 8 : -2), 0, 100); return "solved"; } },
    clear(S, i, why) { if (why === "expire") { Sim.moodAll(S, -3); S.stats.complaints += rnd(S) < 0.5 ? 1 : 0; } } });

  def("fantome", { cat: "chaos", icon: "👻", title: "Le bus est hanté", sev: 1, who: ["cabin", "mech"], ttl: 24,
    weight: (S) => (biomeIs(S, "nuit") ? 2 : biomeIs(S, "industrie", "montagne") ? 0.4 : 0), ok: (S) => driving(S) && S.pax.length >= 3,
    spawn(S) { S.flicker = 14; S.pax.forEach((p) => { if (p.state === "normal" && p.invincible <= 0 && rnd(S) < 0.35) p.state = "panique"; }); },
    desc: () => "Les lumières clignotent, une porte claque toute seule et une voix murmure dans les haut-parleurs. Il y a des paniqués.", hint: "La responsable de cabine rassure. Le mécanicien peut aussi vérifier l'électricité.",
    on(S, i, ev) { if ((ev.type === "cabin" && ev.ok && ["discours_rassurant", "sifflet", "chanson"].includes(ev.action)) || (ev.type === "repair" && ev.sys === "electric") || (ev.type === "wrench" && ev.sys === "electric" && ev.result === "help")) { S.pax.forEach((p) => { if (p.state === "panique") p.state = "normal"; }); return "solved"; } },
    clear(S, i, why) { S.flicker = Math.min(S.flicker, 2); if (why === "expire") Sim.moodAll(S, -3); } });

  def("greve", { cat: "cabin", icon: "🪧", title: "Grève des sièges", sev: 1, who: ["cabin"], ttl: 35,
    weight: (S) => (S.pax.length >= 4 && driving(S) ? (Sim.avgMood(S) < 55 ? 1.2 : 0.3) * S.M.absurd : 0), ok: (S) => driving(S) && S.pax.length >= 4 && !S.inc.some((x) => x.defId === "greve"),
    spawn(S) { Sim.moodAll(S, -2); }, desc: () => "Les passagers brandissent des pancartes et refusent de s'asseoir tant qu'on ne leur parle pas.", hint: "Un discours, une tombola ou un quiz les calme.",
    tick(S, i, dt) { Sim.moodAll(S, -0.4 * dt); },
    on(S, i, ev) { if (ev.type === "cabin" && ev.ok && ["discours_rassurant", "discours_autoritaire", "tombola", "quiz", "ola"].includes(ev.action)) return "solved"; },
    clear(S, i, why) { if (why === "expire") { S.stats.complaints++; L(S, "bad", "🪧", "La grève se termine dans l'amertume et un cahier de doléances."); } } });

  def("bebe_canard", { cat: "cabin", icon: "🐥", title: "Un caneton à bord", sev: 0, who: ["cabin"], ttl: 30, dilemma: true, bot: "oui",
    weight: (S) => (driving(S) ? 0.6 * S.M.absurd : 0), ok: (S) => driving(S) && !S.mascotte,
    spawn() { }, desc: () => "Un caneton s'est glissé dans le bus. Il suit la responsable de cabine partout en piaillant.",
    choices: [{ id: "oui", label: "L'adopter comme mascotte", info: "Les passagers se détendent doucement jusqu'à la fin du trajet. Il pose parfois un œuf sur un siège." }, { id: "non", label: "Le remettre à la mare", info: "Rien ne change, les passagers sont un peu tristes." }],
    decide(S, i, c) { if (c === "oui") { S.mascotte = true; Sim.moodAll(S, 3); L(S, "good", "🐥", "Le caneton devient la mascotte officielle du bus et monte sur le tableau de bord."); } else { Sim.moodAll(S, -1); L(S, "pax", "🐥", "Le caneton est rendu à sa mare sous les regards tristes."); } return "solved"; } });

  def("feu_cuisine", { cat: "cabin", icon: "🔥", title: "Crêpes en flammes", sev: 2, who: ["mech", "cabin"], ttl: 22,
    weight: () => 0, ok: (S) => driving(S) && S.pax.some((p) => p.arch === "cuisinier"),
    spawn(S, i) { const p = S.pax.filter((q) => q.arch === "cuisinier")[0]; i.data.pid = p.id; i.data.name = p.name; S.blind = Math.max(S.blind, 2); },
    desc: (S, i) => "Le réchaud de " + i.data.name + " prend feu et une crêpe vole en flammes dans l'allée.", hint: "L'extincteur éteint tout. Confisquer le réchaud ou rassurer la cabine aide aussi.",
    tick(S, i, dt) { Sim.moodAll(S, -0.3 * dt); Sim.addNoise(S, 0.1 * dt); },
    on(S, i, ev) { if (ev.type === "extinguish" || (ev.type === "cabin" && ev.ok && ev.action === "confisquer" && ev.pid === i.data.pid)) return "solved"; },
    clear(S, i, why) { if (why === "expire") { S.hp.body = Math.max(0, S.hp.body - 10); Sim.moodAll(S, -6); S.stats.complaints++; L(S, "bad", "🔥", "Le feu s'éteint tout seul en laissant une odeur de crêpe brûlée et un siège noirci."); } },
    chainFail: [] });

  // ---------- manies des passagers ----------
  function quirk(S, p) {
    const o = (a) => paxOf(S, (q) => q !== p && a(q)); const mood = (q, d) => { q.mood = clamp(q.mood + d * (d < 0 && q.invincible > 0 ? 0 : 1), 0, 100); };
    switch (p.arch) {
      case "magicien":
        if (rnd(S) < 0.5) { Sim.moodAll(S, 3, (q) => q.arch !== "silence"); Sim.addNoise(S, 0.3); L(S, "pax", "🎩", p.name + " sort un lapin de son chapeau, la cabine applaudit."); }
        else { Sim.addNoise(S, 0.8); Sim.moodAll(S, -2); if (S.inv.snacks > 0 && rnd(S) < 0.5) { S.inv.snacks--; L(S, "bad", "🎩", "Le tour de " + p.name + " rate, et un snack disparaît pour de bon dans un nuage de fumée violette."); } else L(S, "bad", "🎩", "Le tour de " + p.name + " rate dans un nuage de fumée violette."); }
        break;
      case "poete":
        Sim.addNoise(S, 0.3); Sim.moodAll(S, -0.5); mood(p, 3); S.pax.forEach((q) => { if (q.arch === "retraite") mood(q, 4); if (q.arch === "silence") mood(q, -4); });
        L(S, "pax", "📜", p.name + " récite une ode au pare-chocs en vingt-quatre strophes."); break;
      case "sportif":
        S.jolt = Math.max(S.jolt, 0.5); Sim.moodAll(S, -1); mood(p, 3); L(S, "pax", "🏃", p.name + " s'échauffe dans l'allée, quelques sacs volent."); break;
      case "cuisinier": {
        const r = rnd(S);
        if (r < 0.15 && driving(S)) { api.spawn(S, "feu_cuisine", { now: true }); }
        else if (r < 0.6) { S.inv.snacks += 1; mood(p, 2); L(S, "good", "🍳", p.name + " distribue une crêpe à la cabine, une réserve de snacks de plus."); }
        else { Sim.moodAll(S, -1); L(S, "pax", "🍳", "Une odeur de crêpe flotte dans le bus, certains en rêvent, d'autres toussent."); }
        break; }
      case "ventriloque": {
        const v = o((q) => q.invincible <= 0)[0] ? o((q) => q.invincible <= 0)[Math.floor(rnd(S) * o((q) => q.invincible <= 0).length)] : null;
        if (v) { mood(v, -6); mood(p, 3); L(S, "pax", "🪆", "La marionnette de " + p.name + " dit à " + v.name + " ce que tout le monde pensait de sa coiffure."); if (v.trait === "petard" && rnd(S) < 0.5) S.pending.push({ id: "bagarre", at: S.t + 2, chained: "quirk" }); }
        break; }
      case "sosie":
        Sim.moodAll(S, 2, (q) => q.arch === "touriste" || q.arch === "influenceur"); Sim.addNoise(S, 0.2); { const q = pickPax(S, (x) => x !== p && !x.req && x.state === "normal"); if (q) q.req = { type: "photo", ttl: D.REQUESTS.photo.ttl, age: 0 }; }
        L(S, "pax", "🕶️", "Plusieurs passagers croient reconnaître la star dans " + p.name + " et demandent une photo."); break;
    }
  }
  function quirks(S, dt) {
    if (S.phase !== "drive") return;
    S.pax.forEach((p) => {
      if (!["magicien", "poete", "sportif", "cuisinier", "ventriloque", "sosie"].includes(p.arch) || p.state !== "normal") return;
      p.quirkT -= dt; if (p.quirkT > 0) return; p.quirkT = (38 + rnd(S) * 50) / Math.max(0.6, S.M.absurd);
      quirk(S, p);
    });
    if (S.mascotte) Sim.moodAll(S, 0.025 * dt);
  }
  api.quirks = quirks;
};

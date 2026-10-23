// ============================================================
// BUS BAZAR — Interface générale, réseau, salon, panneaux partagés (client)
// ============================================================
const BB = { v: null, role: null, keys: {}, shake: 0, routeHist: [], aid: 0, acks: {}, crew: {}, last: {}, t: 0 };
(function () {
  const { el, $, toast, sound, store } = Kit;
  const D = BBData, R = BBRules, Dr = BBDraw;
  const COLORS = [{ name: "Jaune bus", hex: "#f2b705" }, { name: "Rouge sirène", hex: "#e8453c" }, { name: "Bleu route", hex: "#2f78d1" }, { name: "Vert canard", hex: "#3aa653" }];
  const hexOf = (c) => COLORS[(c || 0) % COLORS.length].hex;
  const ST = BBStations; const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
  const roleInfo = (id) => D.ROLES.filter((r) => r.id === id)[0];
  const CAT = { route: "🛣️ Route", meca: "🔧 Mécanique", nav: "🧭 Navigation", cabin: "📣 Cabine", chaos: "🌪️ Chaos" };
  let ui = {}; let built = false; let station = null; let tab = "station";

  // ---------- envoi ----------
  BB.rawSend = (m) => { if (Kit.socket && Kit.socket.connected) Kit.socket.emit("bb:act", m); };
  BB.send = (m, cb) => { m = Object.assign({}, m); m.aid = ++BB.aid; if (cb) BB.acks[m.aid] = cb; if (!Kit.socket || !Kit.socket.connected) { toast("Connexion perdue, reconnexion en cours.", "error"); return; } Kit.socket.emit("bb:act", m); };
  BB.pop = (node, text) => { const p = el("div", { class: "pop", text }); node.appendChild(p); setTimeout(() => p.remove(), 900); };

  // ---------- sons ----------
  const S2 = {
    horn() { sound.tone(310, 0.16, "square", 0.08); sound.tone(392, 0.2, "square", 0.08, 0.06); },
    crash() { sound.noise(0.35, 0.22, 0, 900); sound.tone(110, 0.25, "sawtooth", 0.1, 0, 50); },
    good() { sound.tone(660, 0.1, "triangle", 0.08); sound.tone(880, 0.14, "triangle", 0.08, 0.08); },
    bad() { sound.tone(240, 0.22, "sawtooth", 0.06, 0, 120); },
    slap() { sound.noise(0.1, 0.2, 0, 3000); sound.tone(180, 0.1, "square", 0.08); },
    radio() { sound.tone(800, 0.05, "square", 0.04); sound.tone(1100, 0.06, "square", 0.04, 0.07); sound.noise(0.25, 0.04, 0.14, 4000); },
    alert() { sound.tone(520, 0.12, "square", 0.05); sound.tone(390, 0.18, "square", 0.05, 0.14); },
  };
  const eng = { ctx: null };
  function engStart() {
    if (eng.ctx || !sound.enabled) return;
    try { const ctx = new (window.AudioContext || window.webkitAudioContext)(); const o = ctx.createOscillator(); o.type = "sawtooth"; const f = ctx.createBiquadFilter(); f.type = "lowpass"; f.frequency.value = 500; const g = ctx.createGain(); g.gain.value = 0; o.connect(f); f.connect(g); g.connect(ctx.destination); o.start(); eng.ctx = ctx; eng.o = o; eng.f = f; eng.g = g; } catch (e) { /* pas de son */ }
  }
  function engUpdate(v) { if (!eng.ctx) return; const t = eng.ctx.currentTime; const sp = v ? v.bus.v : 0; eng.o.frequency.setTargetAtTime(38 + sp * 3.2, t, 0.08); eng.f.frequency.setTargetAtTime(300 + sp * 16, t, 0.08); eng.g.gain.setTargetAtTime(sound.enabled && v && v.phase === "drive" ? 0.012 + Math.min(0.02, sp / 40 * 0.02) : 0, t, 0.15); }

  // ---------- squelette du jeu ----------
  function buildGame() {
    const sc = $("#screen-game"); sc.innerHTML = "";
    ui.top = el("header", { class: "bb-top" });
    ui.station = el("main", { class: "bb-station", id: "bb-station" });
    ui.busCv = el("canvas", { id: "bb-bus", width: 330, height: 150, class: "bb-buscv" });
    ui.crew = el("div", { class: "bb-crew" }); ui.alerts = el("div", { class: "bb-alerts" }); ui.prank = el("div", { class: "bb-prank" }); ui.journal = el("div", { class: "bb-journal" });
    ui.side = el("aside", { class: "bb-side" }, [
      el("div", { class: "card-lite bb-busbox" }, [ui.busCv, ui.crew]),
      el("div", { class: "card-lite bb-p-alerts" }, [el("h3", { text: "Alertes et incidents" }), ui.alerts]),
      el("div", { class: "card-lite bb-p-prank" }, [el("h3", { text: "Blagues entre équipiers" }), ui.prank]),
      el("div", { class: "card-lite bb-p-journal" }, [el("h3", { text: "Journal de bord" }), ui.journal]),
    ]);
    ui.tabs = el("nav", { class: "bb-tabs" }, [["station", "Mon poste"], ["alerts", "Alertes"], ["journal", "Journal"]].map(([k, l]) => el("button", { class: "tab", "data-tab": k, text: l, onclick: () => { tab = k; applyTab(); } })));
    ui.banner = el("div", { class: "bb-banner hidden" }); ui.end = el("div", { class: "bb-end hidden" }); ui.fx = el("div", { class: "bb-fx" });
    sc.appendChild(el("div", { class: "bb-root", id: "bb-root" }, [ui.top, el("div", { class: "bb-body" }, [ui.station, ui.side]), ui.tabs, ui.banner, ui.end, ui.fx]));
    built = true; station = null; BB.role = null; applyTab();
  }
  function applyTab() { const root = $("#bb-root"); if (!root) return; root.dataset.tab = tab; Array.from(document.querySelectorAll(".bb-tabs .tab")).forEach((b) => b.classList.toggle("on", b.dataset.tab === tab)); }

  function enterRole(v) {
    const role = v.you || null; if (BB.role === role && station) return; BB.role = role; ui.station.innerHTML = ""; station = role ? ST[role] : null; BB.routeHist = BB.routeHist || [];
    if (station) { station.build(ui.station); const info = roleInfo(role); ui.station.dataset.role = role; if (store.get("bb.intro." + role, "") !== "1") { store.set("bb.intro." + role, "1"); setTimeout(() => showRoleHelp(role), 400); } }
    else ui.station.appendChild(el("div", { class: "card-lite" }, [el("h3", { text: "Tu regardes la partie" }), el("p", { text: "Tu n'as pas de poste dans cette mission. Observe l'équipage ou rejoue plus tard avec un poste." })]));
  }
  const ROLE_TIPS = {
    driver: ["Tu tiens le volant. Les flèches tournent, haut accélère, bas freine.", "Dans les virages serrés, ralentis avant d'entrer, sinon le bus glisse vers l'extérieur.", "Klaxon (espace) pour disperser vaches et piétons. Esquive (A ou E) en cas de danger, essuie-glace (R) si le pare-brise est sale.", "À l'arrêt, attends le navigateur et donne le départ."],
    mech: ["Tu gardes le bus en vie. Choisis un système, puis une réparation.", "Pièce de rechange pour du solide, ruban pour dépanner en roulant, coup de clé gratuit mais capricieux.", "Surveille la température du moteur et réagis aux alertes de l'équipe.", "Freins et pneus se réparent proprement seulement à l'arrêt."],
    nav: ["Tu décides de la route et de l'horaire. À chaque arrêt, choisis entre directe, sûre ou pittoresque.", "Fais le plein et les courses à la boutique, tu es le seul à gérer l'argent.", "Pendant le trajet, lis les prévisions et préviens le conducteur par la radio de blague ou en parlant.", "Tranche les dilemmes de la compagnie, ils ont tous un prix."],
    cabin: ["Tu t'occupes des passagers. Clique sur l'un d'eux puis choisis une action.", "Les pourcentages montrent tes chances de réussir. Certaines actions sont dangereuses ou mal vues de certains.", "Les demandes ont un compte à rebours. Ignorées, elles fâchent.", "Les baffes cartoon fonctionnent sur les paniqués, jamais comme solution miracle."],
  };
  function showRoleHelp(role) {
    const info = roleInfo(role); Kit.showModal(info.icon + " Poste de " + info.label.toLowerCase(), [el("p", { text: info.blurb })].concat(ROLE_TIPS[role].map((t) => el("p", { class: "mtip", text: "• " + t }))));
  }

  // ---------- barre du haut ----------
  function updateTop(v) {
    const B = v.seg ? D.BIOMES.filter((b) => b.id === v.seg.biome)[0] : null; const pct = v.phase === "drive" && v.seg ? clamp(v.bus.s / v.seg.len * 100, 0, 100) : v.phase === "stop" ? 100 : 0;
    const chip = (ic, label, val, cls, tip) => el("div", { class: "tchip " + (cls || ""), title: tip || label }, [el("small", { text: label }), el("b", { text: ic + " " + val })]);
    const lat = v.delay;
    ui.top.innerHTML = "";
    ui.top.appendChild(el("div", { class: "t-main" }, [
      el("div", { class: "t-step" }, [el("b", { text: v.phase === "drive" ? "Étape " + (v.si + 1) + " sur " + v.nSeg : v.last ? "Terminus" : "À l'arrêt, étape " + (v.si + 2) + " sur " + v.nSeg }), el("small", { text: B && v.phase === "drive" ? B.icon + " " + B.label : v.stopName || "" })]),
      el("div", { class: "t-prog", title: "Avancement sur l'étape" }, [el("i", { style: { width: pct + "%" } })]),
    ]));
    const chips = el("div", { class: "t-chips" });
    chips.appendChild(chip("🚌", "Vitesse", Math.round(v.bus.v * 3.6) + " km/h")); chips.appendChild(chip("⛽", "Carburant", v.fuel + " %", v.fuel < 20 ? "bad" : "", "Niveau du réservoir")); chips.appendChild(chip("🌡️", "Moteur", v.temp + " °", v.temp > 118 ? "bad" : v.temp > 104 ? "warn" : ""));
    chips.appendChild(chip("🛡️", "Carrosserie", v.body + " %", v.body < 30 ? "bad" : v.body < 60 ? "warn" : "", "Si elle tombe à zéro, c'est l'accident majeur")); chips.appendChild(chip("😀", "Humeur", v.sat + " %", v.sat < 30 ? "bad" : v.sat < 50 ? "warn" : "good", "Humeur moyenne des passagers"));
    chips.appendChild(chip("⏱️", "Horaire", lat <= 0 ? Math.abs(lat) + " s d'avance" : lat + " s de retard", lat > 40 ? "bad" : lat > 0 ? "warn" : "good")); chips.appendChild(chip("💰", "Argent", String(v.inv.money)));
    chips.appendChild(chip("🧰", "Stock", v.inv.spares + " pièces, " + v.inv.tape + " ruban, " + v.inv.snacks + " snacks"));
    ui.top.appendChild(chips);
    ui.top.appendChild(el("div", { class: "t-btns" }, [el("button", { class: "btn btn--ghost btn--tiny", title: "Aide du poste", text: "?", onclick: () => v.you && showRoleHelp(v.you) }), el("button", { class: "btn btn--ghost btn--tiny", title: "Son", id: "bb-snd", text: sound.enabled ? "🔊" : "🔇", onclick: (e) => { sound.toggle(); e.target.textContent = sound.enabled ? "🔊" : "🔇"; } })]));
  }

  // ---------- panneaux partagés ----------
  function updateCrew(v) {
    if (!ui.crewBuilt) { ui.crewBuilt = {}; ui.crew.innerHTML = ""; D.ROLE_IDS.forEach((r) => { const cv = el("canvas", { width: 70, height: 66 }); const c = el("div", { class: "cm", "data-role": r }, [cv, el("b"), el("small")]); c.cv = cv; ui.crewBuilt[r] = c; ui.crew.appendChild(c); }); }
    D.ROLE_IDS.forEach((r) => { const c = ui.crewBuilt[r]; const info = roleInfo(r); c.querySelector("b").textContent = v.crewNames[r]; c.querySelector("small").textContent = info.label + (v.crewBot[r] ? " (robot)" : ""); c.classList.toggle("me", v.you === r); c.classList.toggle("bot", !!v.crewBot[r]); c.title = info.blurb; });
  }
  function drawCrew(t) {
    if (!BB.v || !ui.crewBuilt) return; const v = BB.v; const hot = {}; v.inc.forEach((i) => i.who.forEach((r) => { hot[r] = Math.max(hot[r] || 0, i.sev); }));
    D.ROLE_IDS.forEach((r) => { const c = ui.crewBuilt[r]; const cx = c.cv.getContext("2d"); cx.clearRect(0, 0, 70, 66); let emo = "ok"; if (hot[r] >= 2) emo = "panic"; else if (hot[r] >= 1) emo = "sad"; else if (v.sat > 60) emo = "happy"; if (r === "driver" && v.startle) emo = "panic"; Dr.crew(cx, r, 35, 64, 0.58, emo, t); });
  }
  function updateAlerts(v) {
    const box = ui.alerts; const sig = JSON.stringify(v.inc.map((i) => [i.id, i.sev, i.left, i.desc, i.choices && i.choices.map((c) => c.ok)])) + v.you; if (sig === ui.alertSig) return; ui.alertSig = sig; box.innerHTML = "";
    if (!v.inc.length) { box.appendChild(el("p", { class: "muted", text: "Tout est calme pour l'instant." })); return; }
    v.inc.slice().sort((a, b) => b.sev - a.sev).forEach((i) => {
      const mine = i.who.includes(v.you); const c = el("div", { class: "inc inc--s" + i.sev + (mine ? " mine" : "") }, [
        el("div", { class: "inc-h" }, [el("span", { class: "inc-ic", text: i.icon }), el("b", { text: i.title }), el("small", { text: CAT[i.cat] || "" }), el("span", { class: "inc-t", text: i.left + " s" })]),
        el("p", { text: i.desc }), i.hint ? el("small", { class: "muted", text: i.hint }) : null,
        el("small", { class: "inc-who", text: "Concerne " + i.who.map((r) => roleInfo(r).label.toLowerCase()).join(" et ") }),
      ]);
      if (i.dilemma) { const row = el("div", { class: "inc-ch" }); i.choices.forEach((ch) => { const b = el("button", { class: "btn btn--small " + (ch.id === "oui" ? "btn--accent" : "btn--ghost"), title: ch.info, disabled: !mine || !ch.ok, onclick: () => BB.send({ t: "decide", inc: i.id, choice: ch.id }) }, [ch.label]); row.appendChild(b); if (!mine) { /* seul son poste décide */ } row.appendChild(el("small", { class: "muted", text: ch.ok ? ch.info : ch.why })); }); c.appendChild(row); if (!mine) c.appendChild(el("small", { class: "muted", text: "C'est à " + i.who.map((r) => roleInfo(r).label.toLowerCase()).join(" ou à ") + " de décider." })); }
      box.appendChild(c);
    });
  }
  function updatePrank(v) {
    const box = ui.prank; const sab = v.sab; const sig = sab + "|" + v.you + "|" + (v.vote ? JSON.stringify(v.vote) : "") + "|" + [cd(v, "prank:" + v.you)].join(",");
    function cd(v2, k) { return (v2.cds && v2.cds[k]) || 0; }
    if (sig === ui.prankSig) return; ui.prankSig = sig; box.innerHTML = "";
    if (sab === "aucune" || !v.you) { box.appendChild(el("p", { class: "muted", text: sab === "aucune" ? "Les blagues entre équipiers sont désactivées par l'hôte." : "Tu regardes la partie." })); return; }
    const l = cd(v, "prank:" + v.you); const note = l > 0 ? "Prêt dans " + Math.ceil(l) + " s" : "";
    const sel = el("select", { class: "mini-select", id: "bb-radio-sel", "aria-label": "Message radio" }, ["Mayday, le bus est en danger de tomber en panne de café", "Ici la tour de contrôle, vous êtes très en retard et très beau", "Attention, canard en vue", "Ceci n'est pas un exercice, ceci est un bus", "Alerte générale, quelqu'un a mangé le dernier biscuit"].map((t, i) => el("option", { value: i, text: t })));
    const b1 = el("button", { class: "btn btn--small btn--plum", text: "📻 Radio dramatique", title: "Un message radio que tout le monde entend. Fait rire certains passagers, énerve les amateurs de silence.", onclick: () => BB.send({ t: "radio", i: Number(sel.value) }) }); b1.disabled = l > 0;
    const b2 = el("button", { class: "btn btn--small btn--plum", text: "🙊 Annonce déplacée", title: "Une annonce complètement hors sujet dans le micro du bus.", onclick: () => BB.send({ t: "prank", kind: "annonce_mal" }) }); b2.disabled = l > 0;
    box.appendChild(el("div", { class: "prow" }, [sel, b1])); box.appendChild(el("div", { class: "prow" }, [b2]));
    if (sab === "total") {
      const b3 = el("button", { class: "btn btn--small btn--plum", text: "🕷️ Faux insecte sur le conducteur", title: "Le conducteur sursaute et le volant part de travers une seconde.", onclick: () => BB.send({ t: "prank", kind: "insecte" }) }); b3.disabled = l > 0 || v.phase !== "drive";
      const b4 = el("button", { class: "btn btn--small btn--plum", text: "🚨 Fausse alerte moteur (5 pièces d'amende)", title: "Affiche une alerte rouge sur le tableau de bord. La compagnie facture 5 pièces d'amende.", onclick: () => BB.send({ t: "prank", kind: "fausse_alerte" }) }); b4.disabled = l > 0;
      const b5 = el("button", { class: "btn btn--small btn--danger", text: "🗳️ Vote d'arrêt d'urgence", title: "Les humains votent pour un freinage d'urgence immédiat. Rassure les passagers mais coûte du temps.", onclick: () => BB.send({ t: "voteStart" }) }); b5.disabled = v.phase !== "drive" || !!v.vote;
      box.appendChild(el("div", { class: "prow" }, [b3])); box.appendChild(el("div", { class: "prow" }, [b4])); box.appendChild(el("div", { class: "prow" }, [b5]));
    }
    if (v.vote) { const vb = el("div", { class: "vote" }, [el("b", { text: "Vote d'arrêt d'urgence lancé par " + v.vote.by }), el("small", { text: "Pour " + v.vote.yes + ", contre " + v.vote.no + ", il reste " + Math.max(0, v.vote.until) + " s." })]); if (!v.vote.mine) { vb.appendChild(el("button", { class: "btn btn--small btn--green", text: "Pour", onclick: () => BB.send({ t: "voteCast", yes: true }) })); vb.appendChild(el("button", { class: "btn btn--small btn--danger", text: "Contre", onclick: () => BB.send({ t: "voteCast", yes: false }) })); } box.appendChild(vb); }
    if (note) box.appendChild(el("small", { class: "muted", text: note }));
  }
  function updateJournal(v) {
    const last = v.log.length ? v.log[v.log.length - 1].id : 0; if (ui.logLast === last && !ui.logForce) return; ui.logLast = last; ui.logForce = false; const box = ui.journal; box.innerHTML = "";
    v.log.slice().reverse().forEach((e) => box.appendChild(el("div", { class: "lg lg--" + e.kind }, [el("span", { class: "lg-ic", text: e.icon }), el("span", { class: "lg-tx", text: e.text })])));
  }
  function drawBus(t) {
    const v = BB.v; if (!v) return; const cv = ui.busCv; const cx = cv.getContext("2d"); BB.dist = (BB.dist || 0) + v.bus.v * 0.016;
    Dr.bus(cx, cv.width, cv.height, { bus: v.bus, lights: v.lights, body: v.body, temp: v.temp, leak: v.leak, stuckHorn: v.stuckHorn, flick: v.flick, nPax: v.nPax }, t, { jolt: v.jolt, dist: BB.dist, pax: v.pax || v.paxLite, tourBags: v.tour, driverEmo: v.inc.some((i) => i.sev >= 2) ? "panic" : "ok" });
  }

  // ---------- réactions aux événements ----------
  function reactions(v, prev) {
    const s = v.seq, p = prev ? prev.seq : s; if (!prev) return;
    if (s.hits > p.hits) { S2.crash(); BB.shake = 1; setTimeout(() => (BB.shake = 0), 350); flash("BOUM !", "#e8453c"); }
    if (s.horns > p.horns) { S2.horn(); if (v.you === "driver") ST.driver.horn(); }
    if (s.slaps > p.slaps) { S2.slap(); flash("PAF !", "#f08a24"); }
    if (s.inc > p.inc) S2.alert(); if (s.solved > p.solved) S2.good(); if (s.radio > p.radio) S2.radio();
    if (v.radioMsg && (!prev.radioMsg || prev.radioMsg.id !== v.radioMsg.id)) { const b = ui.banner; b.textContent = "📻 " + v.radioMsg.text; b.classList.remove("hidden"); clearTimeout(ui.bt); ui.bt = setTimeout(() => b.classList.add("hidden"), 5500); }
    if (v.phase === "stop" && prev.phase === "drive" && !v.end) { S2.good(); }
    if (v.rotated !== prev.rotated) { toast("Relève ! Chacun passe au poste suivant.", "info"); BB.role = null; }
  }
  function flash(t, col) { const f = el("div", { class: "onoma", text: t, style: { color: col } }); ui.fx.appendChild(f); setTimeout(() => f.remove(), 900); }

  // ---------- fin de mission ----------
  function showEnd(v) {
    const e = v.end; const box = ui.end; if (box.dataset.shown === "1") return; box.dataset.shown = "1"; box.classList.remove("hidden"); box.innerHTML = "";
    const parts = [["Satisfaction des passagers", e.parts.satisfaction], ["Ponctualité", e.parts.ponctualite], ["État du bus", e.parts.vehicule], ["Objectifs", e.parts.objectifs], ["Ressources restantes", e.parts.ressources]];
    const c = el("div", { class: "card end-card " + (e.win ? "win" : "lose") }, [
      el("div", { class: "end-emoji", text: e.win ? (e.honors ? "🏆" : "🚌") : "💥" }), el("h2", { text: e.title }), el("p", { class: "end-text", text: e.text }),
      el("div", { class: "end-score" }, [el("b", { text: String(e.total) }), el("small", { text: "points sur 100" })]),
      el("div", { class: "end-parts" }, parts.map(([l, n]) => el("div", { class: "ep" }, [el("span", { text: l }), el("b", { text: "+" + n })])).concat(e.style ? [el("div", { class: "ep" }, [el("span", { text: "Points de style" }), el("b", { text: "+" + e.style })])] : []).concat(e.complaints ? [el("div", { class: "ep bad" }, [el("span", { text: "Réclamations (" + e.complaints + ")" }), el("b", { text: "-" + e.complaints * 2 })])] : [])),
      e.objectives.length ? el("div", { class: "end-obj" }, e.objectives.map((o) => el("p", { text: (o.status === "ok" ? "✅ " : o.status === "fail" ? "❌ " : "▫️ ") + o.label }))) : null,
      e.trophies.length ? el("div", { class: "end-troph" }, [el("h3", { text: "Trophées" })].concat(e.trophies.map((t) => el("p", { text: "🏅 " + t.label + ". " + t.info })))) : null,
      el("div", { class: "end-facts" }, [el("span", { text: "Durée " + Math.floor(e.time / 60) + " min " + String(e.time % 60).padStart(2, "0") }), el("span", { text: "Étapes " + e.segments + " sur " + e.nSeg }), el("span", { text: "Incidents " + e.stats.incidents + ", réglés " + e.stats.solved })]),
      el("div", { class: "end-seed" }, [el("span", { text: "Graine " }), el("b", { text: e.seed }), el("button", { class: "btn btn--ghost btn--tiny", text: "Copier", onclick: () => { try { navigator.clipboard.writeText(e.seed); toast("Graine copiée.", "info"); } catch (er) { /* rien */ } } })]),
      el("div", { class: "end-btns" }, [Kit.isHost() ? el("button", { class: "btn btn--accent btn--big", id: "bb-again", text: "Retour au salon pour rejouer", onclick: () => Kit.backToLobby() }) : el("p", { class: "muted", text: "L'hôte peut ramener tout le monde au salon pour une nouvelle mission." }), el("button", { class: "btn btn--ghost", text: "Quitter", onclick: () => Kit.leave() })]),
    ]);
    box.appendChild(c); if (e.win) S2.good(); else S2.bad();
  }

  // ---------- état reçu ----------
  function onState(v) {
    if (!built) buildGame(); engStart(); const prev = BB.v; BB.v = v;
    if (v.you !== BB.role || !station) enterRole(v);
    // historique des routes pour le fil de la mission
    if (v.seg && v.phase === "drive") { const B = D.BIOMES.filter((b) => b.id === v.seg.biome)[0]; BB.routeHist[v.si] = { icon: B.icon }; }
    if (prev && prev.seed !== v.seed) { BB.routeHist = []; }
    reactions(v, prev);
    updateTop(v); updateCrew(v); updateAlerts(v); updatePrank(v); updateJournal(v);
    if (station) station.update(v);
    if (v.end) showEnd(v); else { ui.end.classList.add("hidden"); ui.end.dataset.shown = ""; }
    BB.last.t = performance.now(); engUpdate(v);
    document.body.classList.toggle("bb-night", !!(v.seg && v.seg.biome === "nuit"));
  }
  function attach() {
    const s = Kit.socket; if (!s || s.__bb) return; s.__bb = true;
    s.on("bb:state", onState);
    s.on("bb:ack", (a) => { const cb = BB.acks[a.aid]; delete BB.acks[a.aid]; if (!a.ok && a.err) toast(a.err, "error"); else if (a.msg && a.result === "fail") toast(a.msg, "info"); if (cb) cb(a); });
    s.on("bb:crew", (d) => { BB.crew = d.crew || {}; if (Kit.room && Kit.room.status === "lobby") renderPreview($("#lobby-preview"), Kit.room); });
    s.on("bb:rotate", () => { });
  }

  // ---------- boucle d'affichage et saisie ----------
  let lastT = 0;
  function loop(ts) {
    requestAnimationFrame(loop); const dt = Math.min(0.1, (ts - lastT) / 1000 || 0.016); lastT = ts; BB.t = ts / 1000;
    if (!built || document.body.dataset.screen !== "game" || !BB.v) return;
    if (station && station.input) station.input(dt);
    if (station && station.frame) station.frame(dt, BB.t);
    drawBus(BB.t); drawCrew(BB.t);
    if (BB.shake > 0) BB.shake = Math.max(0, BB.shake - dt * 2.5);
  }
  setInterval(() => { if (station && station.sendDrive && BB.v && BB.v.you === "driver" && !BB.v.end) station.sendDrive(); }, 60);
  const typing = (e) => { const t = e.target; return t && (t.tagName === "INPUT" || t.tagName === "TEXTAREA" || t.tagName === "SELECT"); };
  document.addEventListener("keydown", (e) => { if (typing(e) || document.body.dataset.screen !== "game") return; BB.keys[e.key] = true; if (["ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight", " "].includes(e.key) && BB.role === "driver") e.preventDefault(); if (station && station.key) station.key(e); });
  document.addEventListener("keyup", (e) => { delete BB.keys[e.key]; });
  window.addEventListener("blur", () => { BB.keys = {}; });

  // ---------- salon, choix des postes ----------
  function renderPreview(box, room) {
    if (!box) return; box.innerHTML = ""; const me = Kit.me(); const crew = BB.crew || {}; const host = Kit.isHost();
    const wrap = el("div", { class: "bb-lobby" }, [el("h3", { text: "Les quatre postes du bus" }), el("p", { class: "muted small", text: "Choisis ton poste. Les postes sans joueur sont tenus par des robots, tu peux donc jouer seul ou à quatre. Un joueur sans choix recevra un poste libre au départ." })]);
    const grid = el("div", { class: "bb-roles" });
    D.ROLES.forEach((r) => {
      const holderId = crew[r.id]; const holder = holderId ? room.players.find((p) => p.id === holderId) : null; const mine = holder && holder.you;
      const cv = el("canvas", { width: 90, height: 84 }); const cx = cv.getContext("2d"); Dr.crew(cx, r.id, 45, 82, 0.72, holder ? "happy" : "ok", 0.3);
      const btn = el("button", { class: "btn btn--small " + (mine ? "btn--ghost" : "btn--accent"), text: mine ? "Libérer ce poste" : holder ? "Poste pris" : "Prendre ce poste", onclick: () => { sound.click(); Kit.socket.emit("bb:role", { role: mine ? null : r.id }); } }); btn.disabled = !!holder && !mine;
      grid.appendChild(el("div", { class: "bb-role" + (mine ? " me" : "") + (holder ? " taken" : "") }, [cv, el("div", { class: "br-main" }, [el("b", { text: r.icon + " " + r.label }), el("small", { text: r.blurb }), el("small", { class: "who", text: holder ? "Tenu par " + holder.name : "Robot, si personne ne le prend" })]), btn]));
    });
    wrap.appendChild(grid);
    const seedRow = el("div", { class: "bb-seed" }, [el("b", { text: "Graine du parcours" }), el("code", { text: room.settings.seed ? room.settings.seed : "au hasard à chaque mission" }),
      host ? el("button", { class: "btn btn--small btn--plum", text: "🎲 Tirer une graine", onclick: () => { const w = ["canard", "moulin", "baguette", "tracteur", "citrouille", "fanfare", "moustache", "gomme", "ruban", "klaxon", "patate", "nuage", "tuba", "biscotte", "lama"]; const g = w[Math.floor(Math.random() * w.length)] + Math.floor(Math.random() * 90 + 10); Kit.socket.emit("room:settings", { settings: { seed: g } }); } }) : null,
      room.settings.seed ? el("button", { class: "btn btn--small btn--ghost", text: "Copier", onclick: () => { try { navigator.clipboard.writeText(room.settings.seed); toast("Graine copiée.", "info"); } catch (e) { /* rien */ } } }) : null,
      el("small", { class: "muted", text: "Même graine et mêmes réglages, même trajet, mêmes passagers et mêmes objets de départ." })]);
    wrap.appendChild(seedRow); box.appendChild(wrap);
    if (!renderPreview.t) renderPreview.t = setTimeout(() => { renderPreview.t = null; if (Kit.socket) Kit.socket.emit("bb:crewGet"); }, 150);
  }

  Kit.on("reset", () => { BB.v = null; BB.role = null; built = false; ui = {}; station = null; BB.routeHist = []; });
  Kit.on("room", (r) => { if (r.status === "lobby") { BB.v = null; BB.role = null; if (built) { built = false; ui = {}; station = null; } } });
  Kit.on("screen", (name) => { if (name === "game" && !built) buildGame(); });
  Kit.init({
    id: "bus-bazar", title: "Bus Bazar", emoji: "🚌", ribbon: "Quatre postes, un bus, zéro contrôle", tagline: "Faites arriver un bus absurde à destination, avec des passagers pires que lui.",
    createLabel: "Créer un équipage", soloLabel: "Jouer seul", startLabel: "Prendre la route", helpTitle: "Comment jouer", noBots: true,
    floaters: [{ e: "🚌", x: 6 }, { e: "🦆", x: 20 }, { e: "🧰", x: 34 }, { e: "🧭", x: 48 }, { e: "📣", x: 62 }, { e: "🚧", x: 76 }, { e: "🥖", x: 90 }],
    colors: COLORS, botLevels: [{ id: "habile", label: "Habile" }], maxPlayers: 4, minPlayers: 1, schema: R.SCHEMA,
    help: [
      { title: "Le but", text: "Amener un bus et ses passagers jusqu'au terminus à travers des routes générées au hasard. Quatre postes se partagent le travail, le conducteur, le mécanicien, le navigateur et la responsable de cabine. Les postes sans joueur sont tenus par des robots, on peut donc jouer de un à quatre." },
      { title: "Réussir et échouer", text: "On réussit en arrivant à destination. La note dépend de la satisfaction des passagers, du retard, de l'état du bus, des objectifs et des ressources restantes. Des passagers mécontents ne font jamais perdre la partie, ils donnent des réclamations et une note plus basse." },
      { title: "Les cinq façons de perdre", text: "Accident majeur si la carrosserie tombe à zéro. Véhicule irréparable si le moteur reste hors service deux minutes. Panne sèche si le carburant est épuisé. Mission annulée si le retard dépasse la limite. Objectif critique manqué, par exemple la passagère VIP qui quitte le bus furieuse." },
      { title: "Le conducteur", text: "Il conduit avec de vraies inerties. Dans un virage serré, il faut freiner avant d'y entrer. Le klaxon disperse vaches et piétons, l'esquive évite un obstacle au prix des pneus et de l'humeur, l'essuie-glace nettoie le pare-brise." },
      { title: "Le mécanicien", text: "Chaque système du bus s'use. Pièce de rechange pour du solide, ruban pour dépanner mais ça lâche, coup de clé gratuit mais capricieux. Les freins et les pneus se réparent proprement seulement à l'arrêt." },
      { title: "Le navigateur", text: "Il choisit la route à chaque arrêt, directe, sûre ou pittoresque, achète carburant et pièces, annonce les prévisions et tranche les dilemmes de la compagnie. Avec un circuit électrique en panne, ses cartes deviennent douteuses." },
      { title: "La responsable de cabine", text: "Elle gère les humeurs, les demandes et les bêtises. Chaque action affiche ses chances de réussir. Les baffes cartoon marchent surtout sur les paniqués et fâchent presque tout le monde, elles ne sont jamais la meilleure idée par défaut." },
      { title: "Les incidents en chaîne", text: "Les incidents ont des causes et des suites. Un café renversé abîme l'électricité, un court-circuit coince le klaxon, un klaxon coincé rend malade le dormeur. Le journal et les alertes expliquent tout, et chaque incident a toujours une solution." },
      { title: "Les nouveautés loufoques", text: "Fanfares, troupeaux, pluies de grenouilles, péage tenu par un clown, drone perdu, fantômes, karaoké sauvage et bien d'autres surprises. Chaque événement a toujours une solution. Les passagers ont aussi leurs manies, le magicien rate ses tours, le cuisinier fait des crêpes en roulant. La responsable de cabine a de nouvelles actions, le conducteur a la musique et le gyrophare, le mécanicien a la bidouille créative." },
      { title: "Blagues entre équipiers", text: "Radio dramatique, annonce déplacée, faux insecte, fausse alerte et vote d'urgence. L'hôte choisit ce qui est autorisé. Chaque blague a un petit coût ou un temps d'attente." },
      { title: "Relève des postes", text: "En mode relève, à chaque arrêt, les joueurs passent au poste suivant pour essayer tous les métiers. Les robots prennent les postes vides." },
    ],
    theme: { a1: "#ffd23f", a2: "#f08a24", bg1: "#2a4a7a", bg2: "#10203a" },
    renderPreview,
    onInit() { buildGame(); attach(); Kit.on("connect", attach); requestAnimationFrame(loop); },
  });
})();

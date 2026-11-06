// ============================================================
// HANDS OVER — Interface de jeu (client)
// Le plateau 3D donne l'ambiance, les épreuves se jouent dans des panneaux simples.
// ============================================================
(function () {
  const { el, $, toast, sound } = Kit;
  const R = HORules, S = window.HOStage;
  const COLORS = [
    { name: "Rouge sang", hex: "#e63946" }, { name: "Or terni", hex: "#d4a72c" }, { name: "Vert poison", hex: "#5ec26a" }, { name: "Violet funèbre", hex: "#9b5de5" },
    { name: "Bleu nuit", hex: "#3d7bd9" }, { name: "Orange citrouille", hex: "#f77f00" }, { name: "Rose bonbon", hex: "#ff6fb5" }, { name: "Blanc os", hex: "#e9e4d4" },
  ];
  const FAM = { chance: "Chance", memoire: "Mémoire", reflexe: "Réflexes", precision: "Précision", deduction: "Déduction", bluff: "Bluff" };
  const MODE_NAMES = { classique: "Classique", survie: "Survie", equipes: "Équipes", tournoi: "Tournoi", express: "Express", chaos: "Chaos", perso: "Personnalisé" };
  const TEAMS = ["Gants noirs", "Gants rouges"];
  const PADS = ["#e63946", "#3d7bd9", "#ffd23f", "#2fe0a8"];
  const G = { st: null, over: null, off: 0, samples: [], lastKey: "", sig: "", ui: {}, attached: false, prevHands: null, prevQuip: "", simonIdx: -1, recv: 0, built: false, judgeFor: -1 };
  const E = (t, a, k) => el(t, a || {}, [].concat.apply([], (k || []).map((x) => (Array.isArray(x) ? x : [x]))).filter((x) => x !== null && x !== undefined && x !== false));
  const myId = () => { const p = Kit.me(); return p ? p.id : null; };
  const pl = (id) => (Kit.room ? Kit.room.players.find((p) => p.id === id) : null);
  const nameOf = (id) => { const p = pl(id); return p ? p.name : "?"; };
  const hexOf = (id) => { const p = pl(id); return COLORS[((p && p.color) || 0) % COLORS.length].hex; };
  const dot = (id) => E("i", { class: "dotc", style: { background: hexOf(id) }, title: nameOf(id) });
  const snow = () => Date.now() + G.off;
  const sample = (n) => { G.samples.push(n - Date.now()); if (G.samples.length > 10) G.samples.shift(); G.off = Math.max.apply(null, G.samples); };
  const secs = (ms) => Math.max(0, Math.ceil(ms / 1000));
  const sfxOn = () => !G.st || G.st.sfx !== false;
  const sfx = (f) => { if (sfxOn()) f(); };
  const act = (d) => { if (Kit.socket) Kit.socket.emit("ho:act", d); };
  const cap = (s) => s.charAt(0).toUpperCase() + s.slice(1);
  const handsStr = (p) => (p.ghost ? "👻" : "✋".repeat(Math.max(0, p.hands)) + (p.max > p.hands ? "·".repeat(p.max - p.hands) : ""));

  // ---------- sons ----------
  const sIntro = () => sfx(() => { [196, 233, 262].forEach((f, i) => sound.tone(f, 0.6, "sawtooth", 0.07, i * 0.25, f * 0.97)); });
  const sTick = () => sfx(() => sound.tone(700, 0.04, "square", 0.05));
  const sBite = () => sfx(() => { sound.tone(120, 0.3, "sawtooth", 0.14, 0, 40); sound.noise(0.25, 0.18, 0, 900); });
  const sTooth = () => sfx(() => sound.tone(520, 0.06, "triangle", 0.08));
  const sLose = () => sfx(() => { sound.tone(300, 0.5, "sawtooth", 0.1, 0, 60); sound.noise(0.35, 0.16, 0.05, 1200); });
  const sLaugh = () => sfx(() => { for (let i = 0; i < 6; i++) sound.tone(300 + Math.random() * 120, 0.09, "square", 0.04, 0.25 + i * 0.11, 220); });
  const sGhost = () => sfx(() => { sound.tone(500, 0.9, "sine", 0.08, 0, 160); sound.tone(520, 0.9, "sine", 0.05, 0.1, 170); });
  const sWin = () => sfx(() => { [523, 659, 784].forEach((f, i) => sound.tone(f, 0.18, "triangle", 0.1, i * 0.1)); });
  const sPad = (k) => sfx(() => sound.tone([262, 330, 392, 523][k], 0.22, "triangle", 0.12));
  const sGo = () => sfx(() => { sound.tone(660, 0.12, "triangle", 0.12); sound.tone(990, 0.2, "triangle", 0.12, 0.08); });

  // ---------- squelette ----------
  function build() {
    const sc = $("#screen-game"); sc.innerHTML = "";
    const view = E("div", { class: "ho-view", id: "ho-view" }); sc.appendChild(view);
    const ui = E("div", { class: "ho-ui" }, [E("div", { class: "ho-top", id: "ho-top" }), E("div", { class: "ho-timer hidden", id: "ho-timer" }, [E("i", { id: "ho-timer-fill" })]), E("div", { class: "ho-stage-top" }), E("div", { class: "ho-main", id: "ho-main" })]); sc.appendChild(ui);
    sc.appendChild(E("button", { class: "round-btn ho-menu", title: "Menu", text: "⚙️", onclick: openMenu }));
    G.noGL = !S.init(view); if (G.noGL) view.style.background = "radial-gradient(circle at 50% 20%, #5a0f1c, #0a0206 70%)";
    G.built = true; requestAnimationFrame(frame);
  }
  function openMenu() {
    const sbtn = E("button", { class: "btn btn--small btn--ghost", text: sound.enabled ? "Son activé" : "Son coupé", onclick: (ev) => { ev.target.textContent = sound.toggle() ? "Son activé" : "Son coupé"; } });
    const rows = [E("div", { class: "menu-row" }, [E("div", {}, [E("b", { text: "Sons" }), E("p", { class: "small muted", text: "Rires, grincements et mâchoires." })]), sbtn]),
      E("h3", { text: "Les cartes d'influence", style: { marginTop: "0.8rem" } })];
    Object.keys(R.CARDS).forEach((k) => rows.push(E("p", { class: "small" }, [E("b", { text: R.CARDS[k].icon + " " + R.CARDS[k].name + ". " }), R.CARDS[k].when + " " + R.CARDS[k].text + " Risque. " + R.CARDS[k].risk])));
    R.PACT_RULES.forEach((r) => rows.push(E("p", { class: "small" }, [E("b", { text: r[0] + " " + r[1] + ". " }), r[2]])));
    rows.push(E("button", { class: "btn btn--danger btn--small", style: { marginTop: "0.8rem" }, text: "Quitter la partie", onclick: () => Kit.confirm("Quitter la partie et revenir à l'accueil ?", () => { $("#modal").classList.add("hidden"); Kit.leave(); }) }));
    Kit.showModal("Menu", rows);
  }

  // ---------- réception ----------
  function onState(s) {
    sample(s.now); G.recv = performance.now(); const prev = G.st; G.st = s;
    if (s.phase !== "over") G.over = null;
    const key = s.phase + "|" + s.round; if (key !== G.lastKey) { G.lastKey = key; phaseEnter(s, prev); }
    if (s.quip !== G.prevQuip) { G.prevQuip = s.quip; if (S.ready) S.talk(); }
    if (S.ready) S.setPlayers(s.players.map((p) => ({ id: p.id, color: (pl(p.id) || { color: 0 }).color, hex: hexOf(p.id), hands: p.hands, max: p.max, alive: p.alive })));
    renderAll();
  }
  function phaseEnter(s, prev) {
    G.ui = {}; G.simonIdx = -1;
    if (s.phase === "intro") sIntro();
    if (s.phase === "brief") { sIntro(); if (S.ready) S.mood(s.modifier ? "#ffd23f" : "#e63946"); }
    if (s.phase === "prep") { sGo(); if (S.ready) S.mood("#a56bff"); }
    if (s.phase === "count") { G.countN = -1; }
    if (s.phase === "play") { sGo(); }
    if (s.phase === "judge" && s.judged && G.judgeFor !== s.round) {
      G.judgeFor = s.round; const J = s.judged; const lost = Object.keys(J.loss).filter((id) => J.loss[id].loss > 0);
      if (lost.length) { sLose(); sLaugh(); if (S.ready) { S.flash("#ff3b4e", 1); S.mood("#ff3b4e"); lost.forEach((id) => { for (let i = 0; i < J.loss[id].loss; i++) setTimeout(() => S.loseHand(id), 400 + i * 300); }); } }
      else if (S.ready) { S.mood("#2fe0a8"); sWin(); }
      const down = Object.keys(J.loss).filter((id) => J.loss[id].after <= 0 && J.loss[id].loss > 0 && !s.points); if (down.length) setTimeout(sGhost, 1200);
    }
  }
  function onOver(m) { G.over = m; G.lastKey = ""; sfx(() => sound.win()); renderAll(); }

  // ---------- horloge et animations ----------
  function frame() {
    requestAnimationFrame(frame); const st = G.st; if (!st) return; const scr = $("#screen-game"); if (!scr || !scr.classList.contains("screen--active")) return; const t = snow();
    // barre de temps
    const tm = $("#ho-timer"), fill = $("#ho-timer-fill"); if (tm && fill) {
      let left = 0, total = 1;
      if (st.phase === "play" && st.view && st.view.ends) { left = st.view.ends - t; total = Math.max(1, st.view.ends - (st.view.t0 || st.view.showStart || st.view.qStart || st.view.clueStart || (st.view.ends - 14000))); if (st.view.turnEnds) { left = st.view.turnEnds - t; total = 10000; } }
      else if (st.phase === "play" && st.view && st.view.turnEnds) { left = st.view.turnEnds - t; total = 10000; }
      else if (st.phase === "brief") { const b = st.brief || {}; left = (b.minLeft || 0) - (performance.now() - G.recv); total = Math.max(1, b.minTotal || 1); }
      else if (st.phase === "count") { left = st.left - (performance.now() - G.recv); total = st.countTotal || 3300; }
      else if (st.phase !== "play" && st.phase !== "over") { left = st.left - (performance.now() - G.recv); total = st.phase === "judge" ? 9500 : st.phase === "prep" ? 30000 : 5500; }
      if (st.phase === "play" && !(st.view && (st.view.ends || st.view.turnEnds))) tm.classList.add("hidden"); else { tm.classList.remove("hidden"); fill.style.width = Math.max(0, Math.min(100, (left / total) * 100)) + "%"; }
    }
    if (st.phase === "brief") { const w = $("#ho-brief-wait"); if (w) { const left = (st.brief ? st.brief.minLeft : 0) - (performance.now() - G.recv); w.textContent = left > 0 ? "Lecture obligatoire encore " + secs(left) + " s, personne ne peut lancer avant." : "Le départ se fait quand tout le monde est prêt."; } }
    if (st.phase === "count") { const e = $("#ho-count"); if (e) { const left = st.left - (performance.now() - G.recv); const n = Math.max(1, Math.min(3, Math.ceil(left / ((st.countTotal || 3300) / 3)))); e.textContent = String(n); if (n !== G.countN) { G.countN = n; sTick(); e.classList.remove("ho-count--pop"); void e.offsetWidth; e.classList.add("ho-count--pop"); } } }
    if (st.phase !== "play" || !st.view) return; const v = st.view; const id = st.ch.id;
    if (id === "hot") { const cells = document.querySelectorAll(".ho-hotcell"); const t2 = snow(); let lit = -1; v.seq.forEach((w) => { if (t2 >= v.start + w.at && t2 < v.start + w.at + w.dur) lit = w.cell; }); cells.forEach((c, k) => c.classList.toggle("ho-hotcell--lit", k === lit)); const msg = $("#ho-hot-msg"); if (msg) msg.textContent = t2 < v.start ? "Prépare-toi" : t2 > v.end ? "Terminé" : "Touche les mains allumées"; }
    if (id === "stoppile") { const cur = $("#ho-cur"); if (cur) { const pos = v.mine !== null && v.mine !== undefined ? v.mine : (t < v.t0 ? 0 : 1 - Math.abs(2 * (((t - v.t0) / v.P) % 1) - 1)); cur.style.left = pos * 100 + "%"; } }
    if (id === "simon") {
      const L = v.seq.length; const idx = t >= v.showStart && t < v.showStart + L * v.pace ? Math.floor((t - v.showStart) / v.pace) : -1; const within = idx >= 0 && ((t - v.showStart) % v.pace) < v.pace * 0.72;
      document.querySelectorAll(".ho-pad").forEach((p, k) => p.classList.toggle("ho-pad--lit", (within && v.seq[idx] === k) || G.ui.flash === k));
      if (within && idx !== G.simonIdx) { G.simonIdx = idx; sPad(v.seq[idx]); }
      const msg = $("#ho-simon-msg"); if (msg) msg.textContent = t < v.showStart ? "Prépare-toi" : t < v.showStart + L * v.pace ? "Regarde bien" : t < v.inputStart ? "Attends" : "À toi de jouer";
    }
    if (id === "bombe") { const b = $("#ho-bomb-t"); if (b && !v.over) b.textContent = t < v.t0 ? "Prêt" : Math.floor((t - v.t0) / 1000) + " s"; }
    if (id === "calcul" && v.choices === null && $("#ho-calc-wait")) { /* on attend le début de la question, le prochain état arrive */ }
  }

  // ---------- rendu ----------
  function renderAll() {
    const st = G.st; if (!st) return; const top = $("#ho-top"), main = $("#ho-main"); if (!top || !main) return;
    renderTop(st, top);
    const sig = JSON.stringify([st.phase, st.round, st.players, st.me, st.view ? Object.assign({}, st.view, { now: 0 }) : null, st.judged, st.plays, st.modifier, G.over ? 1 : 0, G.ui.tick]);
    if (sig === G.sig) return; G.sig = sig; main.innerHTML = "";
    if (G.over && st.phase === "over") return main.appendChild(buildOver());
    if (st.phase === "intro") main.appendChild(buildIntro(st));
    else if (st.phase === "brief") main.appendChild(buildBrief(st));
    else if (st.phase === "prep") main.appendChild(buildPrep(st));
    else if (st.phase === "count") main.appendChild(buildCount(st));
    else if (st.phase === "play") main.appendChild(buildPlay(st));
    else if (st.phase === "judge") main.appendChild(buildJudge(st));
    else if (st.phase === "over") main.appendChild(E("div", { class: "ho-card" }, [E("h2", { text: "Générique de fin" })]));
  }
  function renderTop(st, top) {
    top.innerHTML = "";
    top.appendChild(E("div", { class: "ho-round", text: MODE_NAMES[st.mode] + (st.phase === "over" ? "  ·  fin de l'émission" : st.round ? "  ·  épreuve " + st.round + " sur " + st.rounds : "") }));
    top.appendChild(E("div", { class: "ho-quip", text: st.quip || "" }));
    top.appendChild(E("div", { class: "ho-players" }, st.players.map((p) => E("div", { class: "ho-chip" + (p.id === st.you ? " ho-chip--you" : "") + (p.ghost ? " ho-chip--ghost" : "") + (st.phase === "play" && st.part && st.part.includes(p.id) ? " ho-chip--in" : "") }, [dot(p.id), E("span", { class: "nm", text: nameOf(p.id) }), E("span", { class: "ho-hands", text: st.points ? p.points + " pt" : handsStr(p) }), st.teams && p.team !== null ? E("small", { text: p.team === 0 ? "⚫" : "🔴" }) : null, p.pact ? E("small", { text: "🤝", title: "Un pacte secret est scellé" }) : null, p.rancune ? E("small", { text: "🗡️", title: "Rancune de traître" }) : null, p.mark ? E("small", { text: "👻", title: "Marqué par un fantôme" }) : null, p.cardsN && st.phase !== "over" ? E("small", { text: "🃏" + p.cardsN }) : null]))));
  }
  function buildIntro(st) {
    const m = R.MODES.find((x) => x.value === st.mode);
    return E("div", { class: "ho-card" }, [E("h2", { text: "Bienvenue dans Main Morte" }), E("p", { class: "ho-sub", text: m ? m.desc : "" }), E("p", { class: "ho-sub", text: "Chaque épreuve perdue coûte une main. Sans main, tu deviens fantôme et tu continues à jouer, tu peux même te venger." }), st.teams ? E("p", { class: "ho-sub", text: "Tu es dans l'équipe " + TEAMS[(st.players.find((p) => p.id === st.you) || {}).team || 0] + "." }) : null, Kit.isHost() ? E("div", { class: "ho-ctrl" }, [E("button", { class: "btn btn--accent", text: "Passer", onclick: () => Kit.socket.emit("ho:skip") })]) : null]);
  }

  // ----- lecture des règles -----
  function buildBrief(st) {
    const ch = st.ch, b = st.brief || { icon: "🖐️", goal: "", cmds: [], lose: "", tip: "", extra: "", minLeft: 0, minTotal: 0 }; const me = st.me; const mustRead = true;
    const kids = [];
    kids.push(E("div", { class: "ho-brief ho-card" }, [
      E("div", { class: "ho-brief__icon", text: b.icon }),
      E("div", { class: "ho-fam", text: "Épreuve " + st.round + " sur " + st.rounds + "  ·  " + FAM[ch.family] }),
      E("h2", { class: "ho-brief__name", text: ch.name }),
      E("div", { class: "ho-goal" }, [E("small", { text: "Ton objectif" }), E("b", { text: b.goal || ch.rules })]),
      b.extra ? E("p", { class: "ho-variant", text: b.extra }) : null,
      st.modifier ? E("p", { class: "ho-variant", text: "Règle chaos. " + st.modifier.label + ", " + st.modifier.text }) : null,
    ]));
    if (b.cmds && b.cmds.length) kids.push(E("div", { class: "ho-card" }, [E("h3", { text: "Les commandes" })].concat(b.cmds.map((c) => E("div", { class: "ho-cmd" }, [E("span", { class: "ho-cmd__ic", text: c[0] }), E("span", { text: c[1] })])))));
    kids.push(E("div", { class: "ho-card ho-card--lose" }, [E("h3", { text: "Ce qui te fait perdre" }), E("p", { class: "ho-bigp", text: b.lose || "" }), b.tip ? E("p", { class: "ho-tip", text: "Astuce. " + b.tip }) : null]));
    if (!me.alive && st.amInPlay !== false) kids.push(E("p", { class: "ho-ghostbar", text: "👻 Tu es fantôme. Tu peux quand même jouer cette épreuve si elle l'autorise, sinon tu regardes." }));
    const total = st.players.filter((p) => !p.auto);
    kids.push(E("div", { class: "ho-card" }, [E("h3", { text: "Qui a fini de lire" }), E("div", { class: "ho-readers" }, st.players.map((p) => E("span", { class: "ho-reader" + (p.read || p.auto ? " ho-reader--ok" : "") }, [dot(p.id), " " + nameOf(p.id) + (p.read || p.auto ? "  ✔" : "  …")])))]));
    kids.push(E("div", { class: "ho-ctrl ho-ctrl--sticky" }, [
      E("button", { class: "btn btn--accent btn--big", id: "ho-readybtn", text: me.read ? "J'ai fini de lire, j'attends les autres" : "J'ai compris, je suis prêt", disabled: !!me.read, onclick: () => Kit.socket.emit("ho:ready") }),
      E("div", { class: "ho-wait", id: "ho-brief-wait", text: "" }),
      Kit.isHost() ? E("button", { class: "btn btn--ghost btn--small", text: "Passer", onclick: () => Kit.socket.emit("ho:skip") }) : null,
    ]));
    return E("div", { class: "ho-col" }, kids);
  }
  function buildCount(st) {
    return E("div", { class: "ho-col" }, [E("div", { class: "ho-card ho-countcard" }, [E("div", { class: "ho-fam", text: st.ch.name }), E("div", { class: "ho-count", id: "ho-count", text: "3" }), E("p", { class: "ho-hint", text: st.brief && st.brief.goal ? st.brief.goal : "" })])]);
  }

  // ----- préparation : cartes et pactes -----
  function cardTile(cd, i, sel, onpick) {
    const d = R.CARDS[cd]; return E("button", { class: "ho-cardbtn" + (i === sel ? " ho-cardbtn--on" : ""), onclick: onpick }, [
      E("div", { class: "ho-cardbtn__top" }, [E("span", { class: "ho-cardbtn__ic", text: d.icon }), E("b", { text: d.name })]),
      E("small", { class: "ho-cardbtn__when", text: d.when }), E("small", { text: d.text }), E("small", { class: "ho-cardbtn__risk", text: "Risque. " + d.risk })]);
  }
  function buildPrep(st) {
    const ch = st.ch; const me = st.me; const alive = st.players.filter((p) => p.alive && p.id !== st.you); const kids = []; const b = st.brief || {};
    kids.push(E("div", { class: "ho-card ho-card--slim" }, [E("div", { class: "ho-fam", text: "Avant l'épreuve  ·  " + FAM[ch.family] }), E("h2", { text: (b.icon || "") + " " + ch.name }), E("p", { class: "ho-sub", text: "Objectif. " + (b.goal || ch.rules) }), st.modifier ? E("p", { class: "ho-sub", style: { color: "#ffd23f" }, text: "Règle chaos. " + st.modifier.label + ", " + st.modifier.text }) : null, st.alarm ? E("p", { class: "ho-alarm", text: "🚨 L'alarme a retenti, tous les pactes de cette épreuve sont annulés." }) : null, !me.alive ? E("p", { class: "ho-ghostbar", text: "👻 Tu es fantôme, tu n'as ni carte ni pacte." }) : null]));
    if (st.plays.length) kids.push(E("div", { class: "ho-card" }, [E("h3", { text: "Cartes jouées par la table" })].concat(st.plays.map((x) => E("p", { class: "ho-note" }, [dot(x.by), " " + nameOf(x.by) + " joue " + R.CARDS[x.card].icon + " " + R.CARDS[x.card].name + (x.target ? " sur " + nameOf(x.target) : "")])))));
    if (me.alive && me.intel) { const I = me.intel; kids.push(E("div", { class: "ho-card ho-card--intel" }, [E("h3", { text: "🕵️ Ce que tu sais sur " + nameOf(I.target) }), E("p", { class: "ho-note", text: I.cards.length ? "Ses cartes sont " + I.cards.map((c) => R.CARDS[c].icon + " " + R.CARDS[c].name).join(", ") + "." : "Il n'a aucune carte." }), E("p", { class: "ho-note", text: I.pact ? "Il a un pacte avec " + nameOf(I.pact.with) + " et compte être " + (I.pact.loyal ? "fidèle" : "traître") + "." : "Il n'a aucun pacte pour l'instant." }), I.rancune ? E("p", { class: "ho-note", text: "Il porte une rancune de traître." }) : null])); }
    if (me.alive && st.cardsOn) {
      const sel = G.ui.card; const c = me.cards[sel];
      kids.push(E("div", { class: "ho-card" }, [E("h3", { text: "Tes cartes d'influence" }), E("p", { class: "ho-hint ho-hint--left", text: "Touche une carte pour la jouer. Tout le monde voit quelle carte tu joues, mais pas forcément si elle dit vrai." }),
        me.cards.length ? E("div", { class: "ho-cards" }, me.cards.map((cd, i) => cardTile(cd, i, sel, () => { const needT = R.CARDS[cd].target; if (!needT) { Kit.socket.emit("ho:card", { i }); G.ui.card = undefined; } else { G.ui.card = i; G.ui.tick = Math.random(); renderAll(); } }))) : E("p", { class: "ho-hint", text: "Tu n'as aucune carte. On en gagne en remportant une épreuve ou grâce à un pacte." }),
        c ? E("div", {}, [E("p", { class: "ho-hint", text: R.CARDS[c].icon + " " + R.CARDS[c].name + ". Choisis la cible." }), E("div", { class: "ho-targets" }, alive.map((p) => E("button", { class: "ho-pill", onclick: () => { Kit.socket.emit("ho:card", { i: sel, target: p.id }); G.ui.card = undefined; } }, [dot(p.id), nameOf(p.id) + (p.rancune ? " 🗡️" : "")])))]) : null,
        me.shield ? E("p", { class: "ho-note", text: "🛡️ Ton bouclier est posé." }) : null, me.mirror ? E("p", { class: "ho-note", text: "🪞 Ton miroir vise " + nameOf(me.mirror) + "." }) : null, me.dbl ? E("p", { class: "ho-note", text: "✌️ Double ou rien est engagé." }) : null,
        me.rancune ? E("p", { class: "ho-note", text: "🗡️ Tu portes une rancune de traître. Ta prochaine sanction coûtera une main de plus." }) : null]));
    }
    if (me.alive && st.pactsOn) {
      const incoming = me.props.filter((x) => x.to === st.you); const mine = me.props.find((x) => x.from === st.you);
      const pk = [E("h3", { text: "Pacte secret" })];
      pk.push(E("details", { class: "ho-details" }, [E("summary", { text: "Comment fonctionne un pacte et une trahison" })].concat(R.PACT_RULES.map((r) => E("p", { class: "ho-rule" }, [E("b", { text: r[0] + " " + r[1] + ". " }), r[2]])))));
      if (st.alarm) pk.push(E("p", { class: "ho-note", text: "Plus aucun pacte n'est possible ce tour." }));
      else if (me.pact) pk.push(E("p", { class: "ho-note ho-note--big", text: "🤝 Pacte avec " + nameOf(me.pact.with) + ". Tu as choisi d'être " + (me.pact.loyal ? "fidèle" : "traître") + ", seul toi le sais. Cela se joue à la fin de l'épreuve." }));
      else {
        const choice = (ok, id) => E("div", { class: "ho-choicebox" }, [
          E("button", { class: "ho-pill ho-pill--big", text: "Accepter et rester fidèle", onclick: () => Kit.socket.emit("ho:pactans", { from: id, ok: true, loyal: true }) }),
          E("button", { class: "ho-pill ho-pill--big ho-pill--bad", text: "Accepter et trahir", onclick: () => Kit.socket.emit("ho:pactans", { from: id, ok: true, loyal: false }) }),
          E("button", { class: "ho-pill", text: "Refuser", onclick: () => Kit.socket.emit("ho:pactans", { from: id, ok: false }) })]);
        incoming.forEach((x) => pk.push(E("div", { class: "ho-note ho-note--big" }, [dot(x.from), " " + nameOf(x.from) + " te propose un pacte. Il a déjà fait son choix en secret.", choice(true, x.from)])));
        if (mine) pk.push(E("p", { class: "ho-note", text: "Proposition envoyée à " + nameOf(mine.to) + ". Elle se joue à la fin de l'épreuve si elle est acceptée." }));
        else {
          G.ui.loyal = G.ui.loyal === undefined ? true : G.ui.loyal;
          pk.push(E("div", { class: "ho-two" }, [
            E("button", { class: "ho-opt" + (G.ui.loyal ? " ho-opt--on" : ""), onclick: () => { G.ui.loyal = true; G.ui.tick = Math.random(); renderAll(); } }, [E("b", { text: "💚 Fidèle" }), E("small", { text: "Si l'autre perd et que tu t'en sors, tu prends une main à sa place. Tu gagnes une carte et un point." })]),
            E("button", { class: "ho-opt ho-opt--bad" + (!G.ui.loyal ? " ho-opt--on" : ""), onclick: () => { G.ui.loyal = false; G.ui.tick = Math.random(); renderAll(); } }, [E("b", { text: "🗡️ Traître" }), E("small", { text: "Si l'autre perd et que tu t'en sors, il perd une main de plus et tu lui voles une carte. Tu portes ensuite une rancune, ta prochaine sanction coûte une main de plus." })])]));
          pk.push(E("p", { class: "ho-hint ho-hint--left", text: "Choisis ton allié. Ton choix reste secret, il ne verra que ta proposition." }));
          pk.push(E("div", { class: "ho-targets" }, alive.filter((p) => !p.pact).map((p) => E("button", { class: "ho-pill", onclick: () => Kit.socket.emit("ho:pact", { to: p.id, loyal: !!G.ui.loyal }) }, [dot(p.id), nameOf(p.id) + (p.rancune ? " 🗡️" : "")]))));
        }
      }
      kids.push(E("div", { class: "ho-card" }, pk));
    }
    if (me.alive) kids.push(E("div", { class: "ho-ctrl ho-ctrl--sticky" }, [E("button", { class: "btn btn--accent btn--big", text: me.ready ? "En attente des autres" : "J'ai fini, on lance", disabled: me.ready, onclick: () => Kit.socket.emit("ho:ready") }), Kit.isHost() ? E("button", { class: "btn btn--ghost btn--small", text: "Lancer", onclick: () => Kit.socket.emit("ho:skip") }) : null]));
    return E("div", { class: "ho-col" }, kids);
  }

  // ----- épreuves -----
  function buildPlay(st) {
    const v = st.view; const ch = st.ch; const can = st.amIn; const head = E("div", { class: "ho-card" }, [E("div", { class: "ho-fam", text: FAM[ch.family] }), E("h2", { text: ch.name }), st.brief && st.brief.goal ? E("p", { class: "ho-goalline", text: "Objectif. " + st.brief.goal }) : null, E("p", { class: "ho-sub", text: (v && v.extra) ? v.extra : "" }), !can ? E("p", { class: "ho-ghostbar", text: "👀 Tu regardes cette épreuve." }) : null]);
    const B = { croco, collision, simon, reflex, stoppile, coffre, bombe, calcul, imposteur, doigts, ppc, hot }[ch.id];
    return E("div", { class: "ho-col" }, [head, B && v ? B(v, st, can) : null]);
  }
  function croco(v, st, can) {
    const me = st.you; const myTurn = v.turn === me && can; const bite = v.bite;
    const teeth = [...Array(v.teeth).keys()].map((i) => { const pr = v.pressed.find((p) => p.i === i); const isTrap = v.traps && v.traps.includes(i);
      return E("button", { class: "ho-tooth" + (pr ? " ho-tooth--down" : "") + (bite && bite.i === i ? " ho-tooth--bite" : "") + (isTrap && !(bite && bite.i === i) ? " ho-tooth--trap" : ""), disabled: !myTurn || !!pr || !!bite, title: pr ? nameOf(pr.by) : "Dent " + (i + 1), onclick: () => { sTooth(); act({ tooth: i }); } }, [String(i + 1), pr && pr.hint ? E("span", { class: "ho-hot", text: pr.hint }) : null]); });
    if (bite && !G.ui.bit) { G.ui.bit = 1; setTimeout(sBite, 50); if (S.ready) S.shake(0.8); }
    return E("div", { class: "ho-card" }, [E("div", { class: "ho-turn" + (myTurn ? " ho-turn--me" : ""), text: bite ? "Clac ! " + nameOf(bite.by) + " a perdu une main." : myTurn ? "À toi d'appuyer sur une dent" : "Au tour de " + nameOf(v.turn) }),
      E("div", { class: "ho-croco" + (bite ? " ho-croco--bite" : "") }, [E("div", { class: "ho-croco__jaw" }, [E("div", { class: "ho-croco__eyes" }, [E("i"), E("i")]), E("div", { class: "ho-teeth" }, teeth)])]),
      E("p", { class: "ho-hint", text: v.nTraps + " piège" + (v.nTraps > 1 ? "s" : "") + " caché" + (v.nTraps > 1 ? "s" : "") + ", " + v.left + " dents restantes." }), E("p", { class: "ho-hint" }, ["Ordre  "].concat(v.order.map((id) => E("span", { class: "ho-seat" }, [dot(id), " "]))))]);
  }
  function collision(v, st, can) {
    const nums = [...Array(v.n).keys()].map((i) => i + 1);
    return E("div", { class: "ho-card" }, [E("p", { class: "ho-hint", text: v.mine ? "Tu as choisi le " + v.mine + ". Les autres décident encore." : "Choisis un numéro en secret." }), E("div", { class: "ho-nums" }, nums.map((n) => E("button", { class: "ho-num" + (v.mine === n ? " ho-num--on" : ""), disabled: !can || !!v.mine, onpointerdown: () => act({ n }), text: String(n) }))),
      E("div", { class: "ho-prog" }, ["Ont choisi  "].concat(Object.keys(v.chosen).map((id) => dot(id)))), v.all ? E("div", {}, nums.map((n) => { const who = Object.keys(v.all).filter((id) => v.all[id] === n); return who.length ? E("p", { class: "ho-note" }, [E("b", { text: "Numéro " + n + "  " })].concat(who.map((id) => dot(id))).concat([who.length > 1 ? "  collision" : "  seul"])) : null; })) : null]);
  }
  function simon(v, st, can) {
    const done = v.prog[st.you] && (v.prog[st.you].fail || v.prog[st.you].done);
    return E("div", { class: "ho-card" }, [E("p", { class: "ho-turn", id: "ho-simon-msg", text: "Prépare-toi" }), E("div", { class: "ho-pads" }, PADS.map((c, k) => E("button", { class: "ho-pad", style: { background: c, color: c }, disabled: !can || !!done, onpointerdown: () => { G.ui.flash = k; sPad(k); setTimeout(() => { G.ui.flash = undefined; }, 160); act({ tap: k }); } }))),
      E("div", { class: "ho-prog" }, st.part.map((id) => E("span", { class: "ho-seat" }, [dot(id), " " + (v.prog[id].fail ? "raté" : v.prog[id].done ? "fini" : v.prog[id].i + " sur " + v.seq.length) + "   "])))]);
  }
  function reflex(v, st, can) {
    const mine = v.taps[st.you]; const early = v.early[st.you];
    const label = early ? "Trop tôt" : mine !== undefined ? mine + " ms" : v.fired ? (v.chair ? "ASSIEDS-TOI" : "MAINTENANT") : (v.chair ? "La musique joue, ne bouge pas" : "Attends le signal");
    return E("div", { class: "ho-card" }, [E("button", { class: "ho-big " + (early || mine !== undefined ? "ho-big--done" : v.fired ? "ho-big--go" : "ho-big--wait"), disabled: !can || early || mine !== undefined, onpointerdown: () => act({ tap: true }), text: label }),
      E("div", { class: "ho-prog" }, st.part.map((id) => E("span", { class: "ho-seat" }, [dot(id), " " + (v.early[id] ? "trop tôt" : v.taps[id] !== undefined ? v.taps[id] + " ms" : "...") + "   "]))), v.chair ? E("p", { class: "ho-hint", text: "Il y a " + v.chairs + " chaises pour " + st.part.length + " joueurs." }) : null]);
  }
  function stoppile(v, st, can) {
    const me = st.you; const stopped = v.mine !== null && v.mine !== undefined;
    return E("div", { class: "ho-card" }, [E("div", { class: "ho-bar" }, [E("div", { class: "ho-bar__zone", style: { left: (v.target - v.w) * 100 + "%", width: v.w * 200 + "%" } }), E("div", { class: "ho-bar__cur", id: "ho-cur" })]),
      E("button", { class: "ho-big " + (stopped ? "ho-big--done" : "ho-big--go"), disabled: !can || stopped, onpointerdown: () => act({ stop: true }), text: stopped ? "Arrêté" : "STOP" }),
      E("div", { class: "ho-prog" }, st.part.map((id) => E("span", { class: "ho-seat" }, [dot(id), " " + (v.errs ? "écart " + Math.round(v.errs[id] * 100) : v.stopped[id] ? "arrêté" : "...") + "   "])))]);
  }
  function coffre(v, st, can) {
    const code = G.ui.code || (G.ui.code = [1, 2, 3]);
    const digits = code.map((d, i) => E("button", { class: "ho-digit", text: String(d), disabled: !can, onclick: () => { code[i] = (code[i] % 6) + 1; G.ui.tick = Math.random(); renderAll(); } }));
    return E("div", { class: "ho-card" }, [E("p", { class: "ho-hint", text: v.code ? "Le code était " + v.code.join(" ") + "." : v.cracked ? nameOf(v.cracked) + " a ouvert le coffre." : "Il reste " + v.left + " essais pour toute l'équipe." }), E("div", { class: "ho-digits" }, digits),
      E("div", { class: "ho-ctrl" }, [E("button", { class: "btn btn--accent", text: "Tenter ce code", disabled: !can || !!v.cracked, onclick: () => { if (new Set(code).size !== 3) return toast("Les trois chiffres doivent être différents."); act({ guess: code.slice() }); } })]),
      E("div", { class: "ho-log" }, v.guesses.slice().reverse().map((g) => E("div", { class: "ho-logline" }, [dot(g.by), E("b", { text: g.g.join(" ") }), E("span", { text: g.exact + " bien placé" + (g.exact > 1 ? "s" : "") + ", " + g.near + " ailleurs" })])))]);
  }
  function bombe(v, st, can) {
    const outs = Object.keys(v.out);
    return E("div", { class: "ho-card" }, [E("div", { class: "ho-bomb", text: v.over ? "💥" : "💣" }), E("p", { class: "ho-turn", id: "ho-bomb-t", text: "Prêt" }), E("button", { class: "ho-big " + (v.mineOut || v.over ? "ho-big--done" : "ho-big--go"), disabled: !can || v.mineOut || v.over, onpointerdown: () => act({ out: true }), text: v.mineOut ? "Main retirée" : "Retirer la main" }),
      E("div", { class: "ho-prog" }, ["Mains retirées  "].concat(outs.map((id) => E("span", { class: "ho-seat" }, [dot(id), " " + Math.round(v.out[id] / 100) / 10 + " s  "])))), v.E ? E("p", { class: "ho-hint", text: "La bombe devait exploser à " + Math.round(v.E / 100) / 10 + " secondes." }) : null]);
  }
  function calcul(v, st, can) {
    const ans = v.mine; const ready = v.choices && v.text;
    return E("div", { class: "ho-card" }, [E("p", { class: "ho-hint", text: "Question " + Math.min(3, v.qi + 1) + " sur 3" }), E("div", { class: "ho-q", id: "ho-calc-wait", text: ready ? v.text : "..." }),
      ready ? E("div", { class: "ho-choices" }, v.choices.map((c, i) => E("button", { class: "ho-choice" + (ans === i ? " ho-choice--on" : ""), disabled: !can || ans !== undefined && ans !== null, onpointerdown: () => act({ a: i }), text: String(c) }))) : E("p", { class: "ho-hint", text: "La question arrive" }),
      E("div", { class: "ho-prog" }, ["Ont répondu  "].concat(Object.keys(v.answered).map((id) => dot(id)))), v.past.length ? E("div", {}, v.past.map((q) => E("p", { class: "ho-note", text: q.text + "  donne " + q.ok + (q.mine === q.ok ? "  réussi" : "  raté") }))) : null]);
  }
  function imposteur(v, st, can) {
    const kids = [];
    if (v.word) kids.push(E("p", { class: "ho-hint", text: "Ton mot secret" }), E("div", { class: "ho-word", text: cap(v.word) }));
    if (v.phase === "clue") {
      kids.push(E("p", { class: "ho-hint", text: v.myClue !== undefined ? "Indice envoyé, les autres réfléchissent." : "Donne un indice sans trop en dire, un imposteur a un mot voisin." }), E("div", { class: "ho-clues" }, (v.options || []).map((w, i) => E("button", { class: "ho-pill" + (v.myClue === i ? " ho-pill--on" : ""), disabled: !can || v.myClue !== undefined, onclick: () => act({ clue: i }), text: w }))));
    } else if (v.phase === "vote") {
      kids.push(E("p", { class: "ho-hint", text: v.myVote ? "Ton vote est parti." : "Qui est l'imposteur ? Vote pour un joueur." }));
      st.part.forEach((id) => kids.push(E("div", { class: "ho-logline" }, [dot(id), E("b", { text: nameOf(id) }), E("span", { text: "« " + (v.clues.find((c) => c.by === id) || {}).w + " »" }), id !== st.you ? E("button", { class: "ho-pill" + (v.myVote === id ? " ho-pill--on" : ""), disabled: !can || !!v.myVote, onclick: () => act({ vote: id }), text: "Voter" }) : null])));
    } else if (v.reveal) {
      kids.push(E("p", { class: "ho-hint", text: "L'imposteur était " + nameOf(v.reveal.imp) + "." }));
    }
    return E("div", { class: "ho-card" }, kids);
  }
  function doigts(v, st, can) {
    const n = st.part.length; G.ui.f = G.ui.f === undefined ? 1 : G.ui.f; G.ui.g = G.ui.g === undefined ? Math.round(1.5 * n) : G.ui.g; const locked = !!v.mine;
    return E("div", { class: "ho-card" }, [E("p", { class: "ho-hint", text: locked ? "Verrouillé, tu as levé " + v.mine.f + " doigt(s) et parié sur " + v.mine.g + "." : "Combien de doigts lèves-tu ?" }), E("div", { class: "ho-fing" }, [0, 1, 2, 3].map((k) => E("button", { class: G.ui.f === k ? "on" : "", disabled: !can || locked, onclick: () => { G.ui.f = k; G.ui.tick = Math.random(); renderAll(); }, text: String(k) }))),
      E("p", { class: "ho-hint", text: "Quel sera le total de tous les doigts levés  entre 0 et " + v.max + " ?" }), E("div", { class: "ho-fing" }, [E("button", { disabled: !can || locked, text: "−", onclick: () => { G.ui.g = Math.max(0, G.ui.g - 1); G.ui.tick = Math.random(); renderAll(); } }), E("div", { class: "ho-q", style: { margin: 0 }, text: String(G.ui.g) }), E("button", { disabled: !can || locked, text: "+", onclick: () => { G.ui.g = Math.min(v.max, G.ui.g + 1); G.ui.tick = Math.random(); renderAll(); } })]),
      E("div", { class: "ho-ctrl" }, [E("button", { class: "btn btn--accent", text: "Verrouiller", disabled: !can || locked, onclick: () => act({ f: G.ui.f, g: G.ui.g }) })]),
      E("div", { class: "ho-prog" }, ["Ont verrouillé  "].concat(Object.keys(v.locked).map((id) => dot(id)))), v.reveal ? E("div", {}, [E("p", { class: "ho-hint", text: "Total réel " + v.reveal.sum }), E("div", {}, Object.keys(v.reveal.f).map((id) => E("p", { class: "ho-note" }, [dot(id), " " + nameOf(id) + " levait " + v.reveal.f[id] + " et pariait " + v.reveal.g[id]])))]) : null]);
  }

  function ppc(v, st, can) {
    const ICON = ["✊", "✋", "✌️"]; const locked = v.mine !== null && v.mine !== undefined;
    return E("div", { class: "ho-card" }, [E("p", { class: "ho-hint", text: locked ? "Tu as choisi " + v.names[v.mine] + ". Les autres décident encore." : "Choisis en secret." }),
      E("div", { class: "ho-ppc" }, [0, 1, 2].map((k) => E("button", { class: "ho-ppcbtn" + (v.mine === k ? " ho-ppcbtn--on" : ""), disabled: !can || locked, onpointerdown: () => act({ pick: k }) }, [E("span", { class: "ho-ppcbtn__ic", text: ICON[k] }), E("b", { text: v.names[k] })]))),
      E("div", { class: "ho-prog" }, ["Ont choisi  "].concat(Object.keys(v.chosen).map((id) => dot(id)))),
      v.all ? E("div", {}, st.part.map((id) => E("p", { class: "ho-note" }, [dot(id), " " + nameOf(id) + "  " + ICON[v.all[id]] + " " + v.names[v.all[id]] + ", bilan " + (v.bil[id] > 0 ? "+" : "") + v.bil[id]]))) : null]);
  }
  function hot(v, st, can) {
    const cells = [...Array(9).keys()].map((k) => E("button", { class: "ho-hotcell", disabled: !can, onpointerdown: () => act({ cell: k }) }, [E("span", { text: "🖐️" })]));
    return E("div", { class: "ho-card" }, [E("p", { class: "ho-turn", id: "ho-hot-msg", text: "Prépare-toi" }), E("div", { class: "ho-hotgrid" }, cells),
      E("div", { class: "ho-prog" }, st.part.map((id) => E("span", { class: "ho-seat" }, [dot(id), " " + (v.scores[id] === undefined ? 0 : v.scores[id]) + " pt   "])))]);
  }

  // ----- jugement -----
  function revealText(st, J) {
    const r = J.reveal || {}; const id = J.id;
    if (id === "croco") return r.bite ? "Dent " + (r.bite.i + 1) + " piégée, " + nameOf(r.bite.by) + " a été mordu." : "";
    if (id === "coffre") return "Le code était " + (r.code || []).join(" ") + (r.cracked ? ", ouvert par " + nameOf(r.cracked) + "." : ", personne n'a réussi.");
    if (id === "bombe") return "La bombe devait exploser à " + Math.round(r.E / 100) / 10 + " secondes.";
    if (id === "imposteur") return "L'imposteur était " + nameOf(r.imp) + (r.caught ? ", il est démasqué." : ", il s'en sort.");
    if (id === "reflex") return Object.keys(r.taps).length ? "Meilleur réflexe " + Math.min.apply(null, Object.values(r.taps)) + " ms." : "Personne n'a réagi.";
    if (id === "stoppile") return "Zone visée à " + Math.round(r.target * 100) + " sur 100.";
    if (id === "collision") return Object.keys(r.groups).filter((k) => r.groups[k].length > 1).map((k) => "Collision au " + k + " entre " + r.groups[k].map(nameOf).join(" et ")).join(". ") || "Aucune collision.";
    if (id === "doigts") return "Le total était " + r.sum + ".";
    if (id === "ppc") return Object.keys(r.bil).map((k) => nameOf(k) + " " + r.names[r.pick[k]] + " (" + (r.bil[k] > 0 ? "+" : "") + r.bil[k] + ")").join(", ") + ".";
    if (id === "hot") return Object.keys(r.score).map((k) => nameOf(k) + " " + r.score[k] + " pt").join(", ") + ".";
    return "";
  }
  function pactCards(st, J) {
    const out = [];
    (J.pev || []).forEach((e) => {
      if (e.k === "betray") out.push(E("div", { class: "ho-pactfx ho-pactfx--betray" }, [E("div", { class: "ho-pactfx__ic", text: "🗡️" }), E("div", {}, [E("b", { text: "Trahison" }), E("p", { text: nameOf(e.help) + " a laissé tomber " + nameOf(e.vic) + ". " + nameOf(e.vic) + " perd une main de plus" + (e.stolen ? " et se fait voler " + R.CARDS[e.stolen].name : "") + "." }), E("p", { text: nameOf(e.help) + " porte maintenant une rancune, et " + nameOf(e.vic) + " pioche une carte de consolation." })])]));
      else if (e.k === "loyal") out.push(E("div", { class: "ho-pactfx ho-pactfx--loyal" }, [E("div", { class: "ho-pactfx__ic", text: "💚" }), E("div", {}, [E("b", { text: "Le pacte tient" }), E("p", { text: nameOf(e.help) + " prend une main à la place de " + nameOf(e.vic) + " et pioche une carte en remerciement." })])]));
      else if (e.k === "fruit") out.push(E("div", { class: "ho-pactfx ho-pactfx--loyal" }, [E("div", { class: "ho-pactfx__ic", text: "✨" }), E("div", {}, [E("b", { text: "Un pacte qui rapporte" }), E("p", { text: nameOf(e.a) + " et " + nameOf(e.b) + " étaient fidèles et sains tous les deux. Chacun pioche une carte." })])]));
      else if (e.k === "none") out.push(E("div", { class: "ho-pactfx" }, [E("div", { class: "ho-pactfx__ic", text: "🤝" }), E("div", {}, [E("b", { text: "Pacte inutile" }), E("p", { text: nameOf(e.a) + " et " + nameOf(e.b) + " perdent tous les deux, personne ne peut aider personne." })])]));
    });
    if (J.revived) out.push(E("div", { class: "ho-pactfx ho-pactfx--ghost" }, [E("div", { class: "ho-pactfx__ic", text: "👻" }), E("div", {}, [E("b", { text: "Retour d'entre les morts" }), E("p", { text: nameOf(J.revived) + " revient parmi les vivants avec une main et une carte." })])]));
    return out;
  }
  function buildJudge(st) {
    const J = st.judged; if (!J) return E("div", { class: "ho-card" }, [E("h2", { text: "Délibération" })]);
    const lost = Object.keys(J.loss).filter((id) => J.loss[id].loss > 0); const kids = [E("h2", { text: lost.length ? "Les mains tombent" : "Personne ne perd rien" }), E("p", { class: "ho-sub", text: revealText(st, J) })];
    lost.forEach((id) => kids.push(E("p", { class: "ho-judge__loss" }, [dot(id), " " + nameOf(id) + " perd " + J.loss[id].loss + " main" + (J.loss[id].loss > 1 ? "s" : "") + (st.points ? "" : J.loss[id].after <= 0 ? ", il devient fantôme" : ""), E("small", { text: "   " + "✋".repeat(Math.max(0, J.loss[id].after)) })])));
    if (J.best) kids.push(E("p", { class: "ho-note", text: "Meilleur de l'épreuve  " + nameOf(J.best) + (st.cardsOn ? ", il pioche une carte." : ".") }));
    const fx = pactCards(st, J); const spoken = new Set();
    J.notes.forEach((n) => { if (!spoken.has(n)) kids.push(E("p", { class: "ho-note", text: n })); });
    return E("div", { class: "ho-col" }, [E("div", { class: "ho-card" }, kids)].concat(fx));
  }
  function buildOver() {
    const o = G.over; const kids = []; const top = o.rows.slice(0, 3); const order = top.length === 1 ? [top[0]] : top.length === 2 ? [top[1], top[0]] : [top[1], top[0], top[2]];
    kids.push(E("div", { class: "ho-card" }, [E("h2", { text: o.teams && o.winTeam !== null ? "Victoire des " + TEAMS[o.winTeam] : "Le dernier gagnant de l'émission" }), E("div", { class: "podium" }, order.map((r) => E("div", { class: "pod pod--" + r.rank }, [E("div", { class: "pod__ball", style: { background: hexOf(r.id) } }), E("div", { class: "pod__nm", text: r.name }), E("div", { class: "pod__bar", text: G.st && G.st.points ? r.points + " pt" : r.alive ? r.hands + " main" + (r.hands > 1 ? "s" : "") : "fantôme" })])))]));
    kids.push(E("div", { class: "ho-card" }, [E("h3", { text: "Le classement" }), E("table", { class: "tbl" }, [E("thead", {}, [E("tr", {}, [E("th", { text: "" }), E("th", { text: "Joueur" }), E("th", { class: "r", text: "Mains" }), E("th", { class: "r", text: "Points" })])]), E("tbody", {}, o.rows.map((r) => E("tr", {}, [E("td", { text: String(r.rank) }), E("td", {}, [E("span", { class: "dotc", style: { background: hexOf(r.id) } }), r.name + (o.teams && r.team !== null ? (r.team === 0 ? " ⚫" : " 🔴") : "") + (r.left ? " (parti)" : "")]), E("td", { class: "r", text: r.alive ? String(r.hands) : "👻" }), E("td", { class: "r", text: String(r.points) })])))])]));
    if (o.awards.length) kids.push(E("div", { class: "ho-card" }, [E("h3", { text: "Les titres" })].concat(o.awards.map((a) => E("p", { class: "ho-note" }, [a.icon + " ", E("b", { text: a.title + "  " }), dot(a.id), " " + nameOf(a.id) + ", " + a.detail])))));
    kids.push(E("div", { class: "ho-ctrl" }, [E("button", { class: "btn btn--ghost", text: "Quitter", onclick: () => Kit.confirm("Quitter la partie et revenir à l'accueil ?", () => Kit.leave()) }), Kit.isHost() ? E("button", { class: "btn btn--accent btn--big", text: "Retour au salon", onclick: () => Kit.backToLobby() }) : E("span", { class: "muted small", text: "L'hôte peut relancer une partie depuis le salon." })]));
    return E("div", { class: "ho-col" }, kids);
  }

  // ---------- branchement ----------
  Kit.on("reset", () => { G.st = null; G.over = null; G.lastKey = ""; G.sig = ""; });
  Kit.on("room", (r) => { if (r.status === "lobby") { G.st = null; G.over = null; G.lastKey = ""; G.sig = ""; G.judgeFor = -1; } });
  function attach() { const so = Kit.socket; if (!so || G.attached) return; G.attached = true; so.on("ho:state", onState); so.on("ho:over", onOver); so.on("ho:go", () => { G.ui = {}; }); }

  Kit.init({
    id: "hands-over", title: "Main Morte", emoji: "🖐️", ribbon: "Le jeu télé où l'on perd des mains", tagline: "Lis les règles, scelle des pactes, trahis si tu l'oses.",
    createLabel: "Ouvrir le plateau", soloLabel: "Jouer contre des robots", startLabel: "Lancer l'émission", helpTitle: "Comment jouer",
    floaters: [{ e: "🖐️", x: 6 }, { e: "🐊", x: 20 }, { e: "🎬", x: 36 }, { e: "👻", x: 50 }, { e: "🃏", x: 64 }, { e: "🩸", x: 78 }, { e: "🎭", x: 92 }],
    colors: COLORS, botLevels: [{ id: "figurant", label: "Figurant" }, { id: "candidat", label: "Candidat" }, { id: "veteran", label: "Vétéran" }], maxPlayers: 8, minPlayers: 2, schema: R.SCHEMA,
    help: [
      { title: "Le principe", text: "Tu participes à une émission de télévision cruelle. À chaque épreuve, un ou plusieurs joueurs perdent une main. Sans main, on devient fantôme, mais on peut revenir. Le dernier joueur qui a encore ses mains gagne." },
      { title: "Le déroulement d'un tour", text: "Un tour a quatre temps. D'abord la lecture des règles, avec le temps qu'il faut et un bouton prêt pour chacun. Ensuite les cartes et les pactes. Puis un compte à rebours de trois secondes. Enfin l'épreuve et le jugement." },
      { title: "Les épreuves", text: "Crocodile dentiste, mémoire des couleurs, réflexes, arrêt de curseur, coffre à code, bombe, calcul éclair, collision de numéros, imposteur, jeu des doigts, duel des mains et main chaude. Chaque épreuve affiche son objectif, ses commandes et ce qui fait perdre avant de commencer." },
      { title: "Les cartes", text: "Neuf cartes, chacune indique quand la jouer, ce qu'elle fait et ce qu'elle risque. Bouclier, miroir, cible, double ou rien, vol, alarme, leurre, espion et absolution. Tout le monde voit la carte que tu joues, mais le leurre ment. On en gagne en remportant une épreuve." },
      { title: "Les pactes et la trahison", text: "Un pacte lie deux joueurs pour une épreuve. Chacun choisit en secret d'être fidèle ou traître. Il ne se joue que si l'un perd et que l'autre s'en sort. Un fidèle prend une main à la place de son allié et pioche une carte. Un traître fait perdre une main de plus à son allié et lui vole une carte, mais il porte une rancune qui lui coûtera une main de plus." },
      { title: "Les fantômes", text: "Un fantôme joue encore aux épreuves qui l'autorisent. S'il gagne, il marque le joueur le plus riche en mains. S'il gagne deux fois, il revient parmi les vivants avec une main et une carte." },
      { title: "Les modes", text: "Classique, survie, équipes, tournoi sans élimination, express, chaos avec une règle folle à chaque tour et personnalisé pour tout régler soi-même. Chaque mode existe en version courte, normale ou longue." },
    ],
    theme: { a1: "#e63946", a2: "#ffd23f", bg1: "#4a0a14", bg2: "#12060a" },
    onInit() { build(); attach(); Kit.on("connect", attach); },
  });
})();

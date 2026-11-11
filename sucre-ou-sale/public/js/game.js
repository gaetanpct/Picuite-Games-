// ============================================================
// SUCRÉ OU SALÉ — Interface de jeu (client)
// Un plateau de jeu télé. L'Extralucide voit le mot secret, les autres éliminent.
// ============================================================
(function () {
  const { el, $, toast, sound } = Kit;
  const R = SOSRules;
  const COLORS = [
    { name: "Rose", hex: "#ff5fa8" }, { name: "Jaune", hex: "#ffd23f" }, { name: "Turquoise", hex: "#27d3c3" }, { name: "Violet", hex: "#a56bff" },
    { name: "Orange", hex: "#ff8a1f" }, { name: "Vert", hex: "#4cd964" }, { name: "Bleu", hex: "#3d8bff" }, { name: "Rouge", hex: "#ff4b3e" },
  ];
  const G = { st: null, over: null, sig: "", offset: 0, samples: [], seen: {}, lastTick: 0, prevElim: null, attached: false, topSig: "", early: false };
  const myId = () => { const p = Kit.me(); return p ? p.id : null; };
  const pl = (id) => (Kit.room ? Kit.room.players.find((p) => p.id === id) : null);
  const nameOf = (id) => { const p = pl(id); return p ? p.name : "?"; };
  const hexOf = (id) => { const p = pl(id); return COLORS[((p && p.color) || 0) % COLORS.length].hex; };
  const snow = () => Date.now() + G.offset;
  const sample = (serverNow) => { G.samples.push(serverNow - Date.now()); if (G.samples.length > 10) G.samples.shift(); G.offset = Math.max.apply(null, G.samples); };
  const sfx = (f) => { if (!G.st || G.st.sfx !== false) f(); };
  const dot = (id) => el("i", { class: "dotc", style: { background: hexOf(id) }, title: nameOf(id) });
  const secs = (ms) => Math.max(0, Math.ceil(ms / 1000));

  // ---------- squelette ----------
  function build() {
    const sc = $("#screen-game"); sc.innerHTML = "";
    sc.appendChild(el("div", { class: "sos-bg" }, [el("i", { class: "sos-spot sos-spot--l" }), el("i", { class: "sos-spot sos-spot--r" }), el("i", { class: "sos-floor" })]));
    sc.appendChild(el("div", { class: "sos-top", id: "sos-top" }));
    sc.appendChild(el("div", { class: "sos-timer hidden", id: "sos-timer" }, [el("i", { id: "sos-timer-fill" }), el("span", { id: "sos-timer-txt" })]));
    sc.appendChild(el("main", { class: "sos-stage", id: "sos-stage" }));
    sc.appendChild(el("div", { class: "sos-flash hidden", id: "sos-flash" }));
    sc.appendChild(el("button", { class: "round-btn sos-menu", title: "Menu", text: "⚙️", onclick: openMenu }));
  }
  function openMenu() {
    const sbtn = el("button", { class: "btn btn--small btn--ghost", text: sound.enabled ? "Son activé" : "Son coupé", onclick: (ev) => { ev.target.textContent = sound.toggle() ? "Son activé" : "Son coupé"; } });
    Kit.showModal("Menu", [
      el("div", { class: "menu-row" }, [el("div", {}, [el("b", { text: "Sons" }), el("p", { class: "small muted", text: "Gong, tic-tac et bruitages du plateau." })]), sbtn]),
      el("h3", { text: "Comment ça marche", style: { marginTop: "0.8rem" } }),
      el("p", { class: "small", text: "L'Extralucide connaît un mot de la grille. Il répond à des dilemmes en choisissant le côté qui lui ressemble. Les autres éliminent les mots qui ne collent pas, sans toucher au mot secret, puis désignent le mot final." }),
      el("button", { class: "btn btn--danger btn--small", style: { marginTop: "0.8rem" }, text: "Quitter la partie", onclick: () => Kit.confirm("Quitter la partie et revenir à l'accueil ?", () => { $("#modal").classList.add("hidden"); Kit.leave(); }) }),
    ]);
  }

  // ---------- réception ----------
  function onState(s) {
    sample(s.now);
    const prev = G.st; G.st = s;
    const key = s.phase + "|" + s.round + "|" + s.step + "|" + s.pickNo;
    if (!prev || key !== G.phaseKey) { G.phaseKey = key; G.early = false; phaseSound(s, prev); }
    render();
  }
  function phaseSound(s, prev) {
    sfx(() => {
      if (s.phase === "pick" && s.extraId === myId()) { sound.tone(520, 0.12, "triangle", 0.1); sound.tone(780, 0.14, "triangle", 0.1, 0.12); }
      if (s.phase === "elim") { sound.tone(392, 0.1, "square", 0.05); sound.tone(587, 0.16, "triangle", 0.09, 0.1); }
      if (s.phase === "result") { sound.tone(180, 0.35, "sawtooth", 0.07); }
      if (s.phase === "verdict") { [440, 554, 659, 880].forEach((f, i) => sound.tone(f, 0.18, "triangle", 0.09, i * 0.12)); }
      if (s.phase === "reveal") { sound.tone(262, 0.4, "sawtooth", 0.07); sound.tone(392, 0.5, "triangle", 0.1, 0.25); }
    });
    if (s.event && s.phase === "pick") flash(s.event.label, s.event.text);
  }
  function flash(title, text) {
    const f = $("#sos-flash"); if (!f) return; f.innerHTML = ""; f.appendChild(el("div", { class: "sos-flash__in" }, [el("b", { text: title }), el("span", { text: text })])); f.classList.remove("hidden");
    sfx(() => { sound.tone(220, 0.2, "square", 0.06); sound.tone(330, 0.2, "square", 0.06, 0.15); sound.tone(440, 0.3, "triangle", 0.08, 0.3); });
    clearTimeout(flash.t); flash.t = setTimeout(() => f.classList.add("hidden"), 3600);
  }
  function onOver(m) { G.over = m; G.sig = ""; render(); sfx(() => sound.win()); }

  // ---------- rendu ----------
  function render() {
    const s = G.st; if (!s || !Kit.room) return;
    renderTop();
    const sc = $("#screen-game"); sc.style.setProperty("--t", String(s.tension || 0));
    sc.classList.toggle("sos-hot", (s.tension || 0) >= 0.7);
    $("#sos-timer").classList.add("hidden");
    const stage = $("#sos-stage"); const top = stage.scrollTop;
    stage.innerHTML = "";
    if (s.phase === "over") buildOver(stage);
    else if (s.phase === "wait" || !s.words) stage.appendChild(el("div", { class: "sos-card sos-wait" }, [el("div", { class: "sos-ball" }, [el("span", { text: "🔮" })]), el("h2", { text: "Le plateau s'allume" })]));
    else buildStage(stage, s);
    stage.scrollTop = top;
  }
  function renderTop() {
    const s = G.st, r = Kit.room; const box = $("#sos-top"); if (!box) return;
    const rows = r.players.map((p) => el("div", { class: "sos-chip" + (p.id === s.extraId ? " sos-chip--ex" : "") + (p.id === myId() ? " sos-chip--you" : "") + (p.left || (!p.isBot && !p.connected) ? " sos-chip--off" : "") }, [dot(p.id), el("span", { class: "nm", text: (p.id === s.extraId ? "🔮 " : "") + p.name }), el("b", { text: String((s.scores || {})[p.id] || 0) })]));
    const label = s.phase === "over" ? "Fin de l'émission" : "Manche " + (s.round + 1) + " sur " + s.rounds + (s.steps && s.phase !== "reveal" ? "  ·  Dilemme " + Math.min(s.step + 1, s.steps) + " sur " + s.steps : "");
    box.innerHTML = ""; box.appendChild(el("div", { class: "sos-round", text: label })); box.appendChild(el("div", { class: "sos-scores" }, rows));
  }

  // ---------- les écrans de manche ----------
  function buildStage(st, s) {
    const iAmEx = s.extraId === myId(); const mine = s.my !== undefined && s.my !== null;
    st.appendChild(extraBanner(s, iAmEx));
    const pn = postits(s); if (pn) st.appendChild(pn);
    if (s.phase === "pick") return buildPick(st, s, iAmEx);
    if (s.phase === "reveal") return buildReveal(st, s);
    st.appendChild(dilemmaView(s));
    if (s.phase === "result") st.appendChild(resultView(s));
    st.appendChild(gridView(s, iAmEx, mine));
    if (s.phase === "elim") st.appendChild(elimControls(s, iAmEx, mine));
    if (s.phase === "verdict") st.appendChild(verdictControls(s, iAmEx, mine));
  }
  function extraBanner(s, iAmEx) {
    const g = (s.groups || []);
    let line;
    if (iAmEx) line = "Tu es l'Extralucide. Ton mot est " + wordName(s, s.secretId) + ".";
    else line = nameOf(s.extraId) + " est l'Extralucide.";
    const box = el("div", { class: "sos-extra" + (iAmEx ? " sos-extra--me" : "") }, [el("div", { class: "sos-ball sos-ball--sm" }, [el("span", { text: "🔮" })]), el("div", {}, [el("b", { text: line }), el("span", { class: "small", text: playLine(s) })])]);
    return box;
  }
  function playLine(s) {
    const base = "Chacun marque autant de mots qu'il veut, sans limite de temps. ";
    if (s.play === "solo") return base + "Chacun joue seul, personne ne voit tes marques.";
    if (s.play === "equipes") return base + "Deux équipes, la tienne et une rivale.";
    return base + (s.rule === "un" ? "Un seul joueur suffit à éliminer un mot." : s.rule === "unanimite" ? "Il faut l'accord de tous pour éliminer un mot." : "Il faut la majorité pour éliminer un mot.");
  }
  const wordName = (s, id) => { const w = (s.words || []).find((x) => x.id === id); return w ? w.name : "?"; };

  function buildPick(st, s, iAmEx) {
    if (iAmEx) {
      st.appendChild(el("div", { class: "sos-card" }, [
        el("h2", { text: "Ton dilemme" }),
        el("p", { class: "sos-hint", text: s.event && s.event.id === "inverse" ? "Dilemme inversé. Désigne le côté qui ressemble le MOINS à ton mot." : "Ce dilemme est tiré au hasard, il peut coller à ton mot ou pas du tout. Qu'il y ait un rapport ou non, débrouille-toi, choisis le côté qui ressemble le plus à ton mot. Tu n'as aucune limite de temps." }),
        el("div", { class: "sos-secret" }, [el("span", { text: "Ton mot" }), el("b", { text: wordName(s, s.secretId) })]),
      ]));
      (s.hand || []).forEach((c) => {
        const btn = (side, txt) => el("button", { class: "sos-side sos-side--" + side, onclick: () => { Kit.socket.emit("sos:pick", { card: c.id, side }); sfx(() => sound.click()); } }, [el("small", { text: side === "A" ? "Sucré" : "Salé" }), el("b", { text: txt })]);
        st.appendChild(el("div", { class: "sos-hand" }, [btn("A", c.a), el("span", { class: "sos-vs", text: "ou" }), btn("B", c.b)]));
      });
      if (s.joker) st.appendChild(el("div", { class: "sos-ctrl" }, [s.jokerOk ? el("button", { class: "btn btn--ghost", text: "🃏 Joker, changer de dilemme (une fois par manche)", onclick: () => { Kit.socket.emit("sos:reroll"); sfx(() => sound.click()); } }) : el("p", { class: "sos-hint", text: "Ton joker est utilisé pour cette manche." })]));
      if (s.picks && s.picks.length) st.appendChild(dilemmaView(s));
    } else {
      st.appendChild(el("div", { class: "sos-card sos-wait" }, [el("div", { class: "sos-ball" }, [el("span", { text: "🔮" })]), el("h2", { text: nameOf(s.extraId) + " réfléchit" }), el("p", { class: "sos-hint", text: "Il réfléchit au côté du dilemme qui ressemble le plus à son mot." }), s.event ? el("div", { class: "sos-event" }, [el("b", { text: s.event.label }), el("span", { text: s.event.text })]) : null]));
      if (s.picks && s.picks.length) st.appendChild(dilemmaView(s));
      st.appendChild(gridView(s, false, s.my !== undefined && s.my !== null));
    }
  }
  function dilemmaView(s) {
    const box = el("div", { class: "sos-dil-wrap" });
    if (s.event) box.appendChild(el("div", { class: "sos-event" }, [el("b", { text: s.event.label }), el("span", { text: s.event.text })]));
    (s.picks || []).forEach((p, i) => {
      const label = p.side === "both" ? "Le mot colle aux deux" : p.side === "none" ? "Le mot ne colle à aucun" : p.inv ? "Le mot ne colle pas à" : "Le mot colle à";
      const meaning = p.meaning;
      const half = (side, txt, tag) => el("div", { class: "sos-half sos-half--" + side + (meaning === side ? " sos-half--on" : "") + ((meaning === "both") ? " sos-half--on" : "") + (meaning !== side && (meaning === "A" || meaning === "B") ? " sos-half--off" : "") }, [el("small", { text: tag }), el("b", { text: txt }), (meaning === side && p.inv) ? el("span", { class: "sos-tick", text: "↺" }) : null]);
      const card = el("div", { class: "sos-dil" }, [half("A", p.a, "Sucré"), el("div", { class: "sos-mid" }, [el("span", { text: "ou" })]), half("B", p.b, "Salé")]);
      box.appendChild(el("div", { class: "sos-dilemma", style: { animationDelay: (i * 0.25) + "s" } }, [card, el("p", { class: "sos-verdict", text: p.side === "A" || p.side === "B" ? label + " " + (p.inv ? (p.side === "A" ? p.a : p.b) : (p.side === "A" ? p.a : p.b)) : label })]));
    });
    return box;
  }
  // bouton de suite, aucun minuteur, on passe quand tous les joueurs présents sont prêts
  function nextBtn(s, label) {
    const row = el("div", { class: "sos-ctrl" }, [el("button", { class: "btn btn--accent btn--big", disabled: !!s.readyMe, text: s.readyMe ? "Prêt, on attend les autres (" + s.readyN + " sur " + s.humansN + ")" : label + " (" + s.readyN + " sur " + s.humansN + " prêts)", onclick: () => { Kit.socket.emit("sos:next"); sfx(() => sound.click()); } })]);
    if (Kit.isHost() && s.humansN > 1) row.appendChild(el("button", { class: "btn btn--ghost btn--small", text: "Forcer la suite", onclick: () => Kit.socket.emit("sos:next", { force: true }) }));
    return row;
  }
  function resultView(s) {
    const r = s.result; if (!r) return el("div");
    const my = (r.groups || []).find((x) => x.id === s.my) || (r.groups || [])[0];
    const out = [];
    (r.groups || []).forEach((x) => {
      const view = s.my === undefined || s.my === null || x.id === s.my;
      if (!view && s.extraId !== myId()) return;
      if (x.busted) out.push(el("div", { class: "sos-bust" }, [el("b", { text: "💥 Le mot secret est éliminé" }), el("span", { text: s.play === "coop" ? "Le groupe a perdu la manche." : "Cette équipe est sortie de la manche." })]));
      else out.push(el("div", { class: "sos-gone" }, [el("b", { text: x.elim.length ? x.elim.length + " mot" + (x.elim.length > 1 ? "s" : "") + " éliminé" + (x.elim.length > 1 ? "s" : "") : "Aucun mot éliminé" }), el("span", { class: "small", text: x.elim.map((id) => wordName(s, id)).join(", ") })]));
    });
    if (my && my.busted) sfx(() => { if (!resultView.b) { resultView.b = 1; sound.fail(); setTimeout(() => { resultView.b = 0; }, 3000); } });
    out.push(nextBtn(s, "Dilemme suivant"));
    return el("div", { class: "sos-card sos-result" }, out);
  }

  // ----- les post-it -----
  const NOTE_COLORS = ["#fff27a", "#ffb3d9", "#9ff1e6", "#ffd0a1"];
  const ansTxt = (p) => (p.meaning === "A" ? p.a : p.meaning === "B" ? p.b : p.meaning === "both" ? "les deux" : "aucun");
  function postits(s) {
    if (!s.hist || !s.hist.length || s.phase === "reveal" || s.phase === "over") return null;
    const list = s.hist.filter((h) => h.step < s.step || (s.phase === "result" && h.step === s.step));
    if (!list.length) return null;
    const names = (ids) => ids.map((id) => wordName(s, id));
    const row = el("div", { class: "sos-notes", "aria-label": "Post-it des dilemmes déjà joués" }, list.map((h, i) => {
      const n = (s.notes || []).find((x) => x.step === h.step) || { elim: [], contested: [], pins: [] };
      const lines = h.picks.map((p) => el("div", { class: "sos-note__l" }, [el("span", { text: p.a + " ou " + p.b }), el("b", { text: "→ " + ansTxt(p) })]));
      const chips = el("div", { class: "sos-note__c" }, [el("span", { title: "Mots éliminés", text: "✕ " + n.elim.length }), el("span", { title: "Mots qui ont hésité", text: "? " + n.contested.length }), n.pins.length ? el("span", { title: "Mots épinglés", text: "📌 " + n.pins.length }) : null]);
      return el("button", { class: "sos-note", style: { background: NOTE_COLORS[i % NOTE_COLORS.length], transform: "rotate(" + ((i % 3) - 1) * 1.6 + "deg)" }, onclick: () => {
        sfx(() => sound.tone(700, 0.05, "triangle", 0.06));
        Kit.showModal("Dilemme " + (h.step + 1), [
          ...h.picks.map((p) => el("p", {}, [el("b", { text: p.a + " ou " + p.b }), el("br"), el("span", { text: "Le mot colle à " + ansTxt(p) + (p.inv ? " (dilemme inversé)" : "") + "." })])),
          el("p", { class: "small" }, [el("b", { text: "Éliminés. " }), document.createTextNode(n.elim.length ? names(n.elim).join(", ") : "Aucun")]),
          el("p", { class: "small" }, [el("b", { text: "Ont hésité, marqués mais gardés. " }), document.createTextNode(n.contested.length ? names(n.contested).join(", ") : "Aucun")]),
          el("p", { class: "small" }, [el("b", { text: "Épinglés à ce moment. " }), document.createTextNode(n.pins.length ? names(n.pins).join(", ") : "Aucun")]),
        ]);
      } }, [el("small", { text: "Dilemme " + (h.step + 1) }), ...lines, chips]);
    }));
    return row;
  }

  // ----- grille -----
  function elimFor(s, iAmEx) {
    const set = new Set(); const part = {};
    if (s.my !== undefined && s.my !== null) { const g = (s.groups || []).find((x) => x.id === s.my); if (g) g.elim.forEach((id) => set.add(id)); }
    else (s.groups || []).forEach((g) => (g.elim || []).forEach((id) => { part[id] = (part[id] || 0) + 1; }));
    const live = (s.groups || []).filter((g) => !g.busted).length || 1;
    if (!(s.my !== undefined && s.my !== null)) Object.keys(part).forEach((id) => { if (part[id] >= live) set.add(+id); });
    return { set, part };
  }
  function gridView(s, iAmEx, mine) {
    const { set, part } = elimFor(s, iAmEx);
    const marks = s.myMarks || {}; const n = s.words.length; const pins = new Set(s.pins || []);
    const cols = n <= 9 ? 3 : n <= 12 ? 4 : n <= 16 ? 4 : n <= 20 ? 5 : 5;
    const prev = G.prevElim; const cur = new Set(set);
    const grid = el("div", { class: "sos-grid sos-grid--" + cols });
    const locked = !!s.myLocked;
    const gKey = s.words.map((w) => w.id).join(","); if (!G.goneAt || G.goneKey !== gKey) { G.goneAt = {}; G.goneKey = gKey; }
    s.words.forEach((w) => { if (set.has(w.id) && G.goneAt[w.id] == null) G.goneAt[w.id] = s.round; });
    const freshR = Math.max(-1, ...Object.values(G.goneAt));
    s.words.forEach((w) => {
      const gone = set.has(w.id); const who = marks[w.id] || []; const myMark = who.includes(myId());
      const classes = ["sos-word"]; if (gone) classes.push("sos-word--gone"); if (gone && G.goneAt[w.id] === freshR && Object.keys(G.goneAt).some((k) => G.goneAt[k] !== freshR)) classes.push("sos-word--fresh"); if (!gone && part[w.id]) classes.push("sos-word--part");
      if (iAmEx && w.id === s.secretId) classes.push("sos-word--secret"); if (myMark) classes.push("sos-word--mine"); if (who.length && !myMark) classes.push("sos-word--mark");
      if (pins.has(w.id) && !gone) classes.push("sos-word--pin");
      if (gone && prev && prev.round === s.round && !prev.set.has(w.id)) classes.push("sos-word--just");
      const interactive = mine && !locked && ((s.phase === "elim" && !gone) || (s.phase === "verdict" && !gone));
      const myFinal = s.myFinals && s.myFinals[myId()] === w.id;
      if (s.phase === "verdict" && myFinal) classes.push("sos-word--final");
      const ev = s.myEarly ? Object.keys(s.myEarly).filter((pid) => s.myEarly[pid] === w.id) : [];
      if (ev.length && s.phase === "elim") classes.push("sos-word--early");
      const children = [el("span", { class: "sos-word__t", text: w.name })];
      if (s.phase === "elim" && who.length) children.push(el("span", { class: "sos-word__m" }, who.map((id) => dot(id))));
      if (s.phase === "elim" && ev.length) children.push(el("span", { class: "sos-word__m sos-word__m--top" }, [el("b", { text: "⚡" }), ...ev.map((id) => dot(id))]));
      if (s.phase === "elim" && iAmEx && s.exMarks && s.exMarks[w.id]) children.push(el("span", { class: "sos-word__m" }, [el("b", { text: "✕" + s.exMarks[w.id] })]));
      if (s.phase === "verdict" && mine && s.myFinals) { const v = Object.keys(s.myFinals).filter((pid) => s.myFinals[pid] === w.id); if (v.length) children.push(el("span", { class: "sos-word__m" }, v.map((id) => dot(id)))); }
      if (gone) children.push(el("span", { class: "sos-word__x", text: "✕" }));
      const b = el("button", { class: classes.join(" "), disabled: !interactive, onclick: () => {
        if (s.phase === "elim" && G.early) { const mineV = s.myEarly && s.myEarly[myId()] === w.id; Kit.socket.emit("sos:early", { word: mineV ? -1 : w.id }); sfx(() => sound.tone(mineV ? 330 : 740, 0.08, "triangle", 0.1)); }
        else if (s.phase === "elim") { Kit.socket.emit("sos:mark", { word: w.id }); sfx(() => sound.tone(myMark ? 330 : 520, 0.06, "triangle", 0.08)); }
        else if (s.phase === "verdict") { Kit.socket.emit("sos:final", { word: w.id }); sfx(() => sound.tone(660, 0.1, "triangle", 0.1)); }
      } }, children);
      const cell = el("div", { class: "sos-cell" }, [b]);
      if (mine && !gone && !(locked && s.phase !== "verdict")) cell.appendChild(el("button", { class: "sos-pinbtn" + (pins.has(w.id) ? " sos-pinbtn--on" : ""), title: "Garder un œil sur ce mot", "aria-label": "Épingler " + w.name, text: "📌", onclick: (ev) => { ev.stopPropagation(); Kit.socket.emit("sos:pin", { word: w.id }); sfx(() => sound.tone(880, 0.05, "triangle", 0.07)); } }));
      grid.appendChild(cell);
    });
    G.prevElim = { round: s.round, set: cur };
    return el("div", { class: "sos-gridwrap" }, [grid]);
  }
  function elimControls(s, iAmEx, mine) {
    if (!mine) return el("div", { class: "sos-card sos-hint-card" }, [el("p", { class: "sos-hint", text: iAmEx ? "Tu observes les enquêteurs. Les croix sont leurs marques, ton mot secret brille en or." : "Tu regardes la partie." })]);
    const g = (s.groups || []).find((x) => x.id === s.my);
    if (s.myLocked) return el("div", { class: "sos-card sos-hint-card" }, [el("p", { class: "sos-hint", text: "Ton groupe a annoncé son mot. Réponse à la fin de la manche, on attend les autres." })]);
    const used = Object.keys(s.myMarks || {}).filter((k) => s.myMarks[k].includes(myId())).length;
    const valid = g && Array.isArray(g.validated) && g.validated.includes(myId());
    const total = g ? g.members.length : 0, nv = g && Array.isArray(g.validated) ? g.validated.length : 0;
    const left = Math.max(0, (s.steps || 0) - (s.step || 0) - 1);
    const rule = s.play === "solo" ? "Seul à bord, ton annonce compte tout de suite." : s.rule === "un" ? "Un seul joueur suffit à annoncer." : s.rule === "unanimite" ? "Tout le groupe doit annoncer le même mot." : "La majorité du groupe doit annoncer le même mot.";
    if (G.early) return el("div", { class: "sos-ctrl" }, [
      el("p", { class: "sos-hint sos-hint--hot", text: "Touche le mot que tu annonces. " + rule + " Se tromper fait perdre la manche." }),
      el("button", { class: "btn btn--ghost", text: "Finalement non", onclick: () => { G.early = false; Kit.socket.emit("sos:early", { word: -1 }); render(); } }),
    ]);
    return el("div", { class: "sos-ctrl" }, [
      el("p", { class: "sos-hint", text: "Marque autant de mots à éliminer que tu veux, " + used + " pour l'instant, prends ton temps. " + (s.play === "solo" ? "" : "Les couleurs montrent qui a marqué quoi. ") + "Le 📌 sert à garder un œil sur un mot qui hésite." }),
      el("button", { class: "btn btn--accent btn--big", text: valid ? "Marques validées, annuler" : "Je valide mes marques (" + nv + " sur " + total + " prêts)", onclick: () => { Kit.socket.emit(valid ? "sos:unvalid" : "sos:valid"); sfx(() => sound.click()); } }),
      left > 0 ? el("button", { class: "btn btn--ghost sos-early", text: "⚡ Je tiens mon mot" + (s.bonusEarly ? ", bonus jusqu'à +" + Math.min(3, left) : ""), onclick: () => { G.early = true; sfx(() => sound.click()); render(); } }) : null,
    ]);
  }
  function verdictControls(s, iAmEx, mine) {
    if (!mine) return el("div", { class: "sos-card sos-hint-card" }, [el("p", { class: "sos-hint", text: iAmEx ? "Les enquêteurs désignent leur mot final. Croise les doigts." : "Tu regardes la partie." })]);
    const g = (s.groups || []).find((x) => x.id === s.my);
    return el("div", { class: "sos-ctrl" }, [el("p", { class: "sos-hint", text: g && g.busted ? "Ton mot est tombé, tu regardes la fin." : "C'est l'heure de vérité. Touche le mot que tu désignes. Le groupe retient le plus choisi." })]);
  }

  // ----- révélation -----
  function buildReveal(st, s) {
    const rv = s.reveal; if (!rv) return;
    st.appendChild(el("div", { class: "sos-card sos-reveal" }, [el("p", { class: "sos-hint", text: "Le mot secret était" }), el("div", { class: "sos-flip" }, [el("b", { text: rv.secret.name })])]));
    rv.groups.forEach((gr) => {
      const names = gr.members.map(nameOf).join(", ");
      const head = gr.ok ? "✅ " + (s.play === "coop" ? "Mot trouvé" : "Trouvé") : gr.busted ? "💥 Mot éliminé" : gr.timedOut ? "⌛ Pas de réponse" : "❌ Raté";
      st.appendChild(el("div", { class: "sos-card sos-grp " + (gr.ok ? "sos-grp--ok" : "sos-grp--ko") }, [el("h3", { text: head }), el("div", { class: "small", text: (s.play === "coop" ? "Groupe" : s.play === "equipes" ? "Équipe " + (gr.id + 1) : "Enquêteur") + " " + names + (gr.final >= 0 && !gr.busted && gr.final !== rv.secret.id ? "  ·  a désigné " + wordName(s, gr.final) : "") + (gr.ok && gr.left ? "  ·  bonus rapidité +" + gr.left : "") })]));
    });
    const rows = Object.keys(rv.gains).filter((id) => rv.gains[id] > 0);
    if (rows.length) st.appendChild(el("div", { class: "sos-card" }, [el("h3", { text: rv.mult > 1 ? "Points de la manche, multipliés par " + rv.mult : "Points de la manche" }), el("div", { class: "sos-gains" }, rows.map((id) => el("span", { class: "sos-gain" }, [dot(id), nameOf(id) + " +" + rv.gains[id]])))]));
    else st.appendChild(el("div", { class: "sos-card" }, [el("h3", { text: "Personne ne marque" })]));
    if (rv.steps && rv.steps.length) st.appendChild(el("div", { class: "sos-card" }, [el("h3", { text: "Les réponses de l'Extralucide" }), el("div", { class: "sos-recap" }, rv.steps.map((x) => el("div", { class: "sos-recap__row" }, x.picks.map((p) => el("span", { class: "small", text: p.a + " ou " + p.b + (p.side === "both" ? "  ·  les deux" : p.side === "none" ? "  ·  aucun" : "  ·  " + (p.side === "A" ? p.a : p.b)) + (p.inv ? " (inversé)" : "") })))))]));
    const host = Kit.isHost();
    st.appendChild(nextBtn(s, "Manche suivante")); if (false) st.appendChild(el("div", { class: "sos-ctrl" }, [host ? el("button", { class: "btn btn--accent btn--big", text: "Manche suivante", onclick: () => Kit.socket.emit("sos:next") }) : el("p", { class: "sos-hint", text: "La manche suivante démarre toute seule." })]));
    if (rv.groups.some((g) => g.ok)) sfx(() => { if (!buildReveal.w) { buildReveal.w = 1; sound.win(); setTimeout(() => { buildReveal.w = 0; }, 4000); } });
  }

  // ----- fin -----
  function buildOver(st) {
    const o = G.over; if (!o) { st.appendChild(el("div", { class: "sos-card sos-wait" }, [el("h2", { text: "Résultats en cours" })])); return; }
    const nm = (id) => { const p = o.players.find((x) => x.id === id); return p ? p.name : "?"; };
    const hx = (id) => { const p = o.players.find((x) => x.id === id); return COLORS[((p && p.color) || 0) % COLORS.length].hex; };
    const top = o.rows.slice(0, 3); const order = top.length === 1 ? [top[0]] : top.length === 2 ? [top[1], top[0]] : [top[1], top[0], top[2]];
    st.appendChild(el("div", { class: "sos-card" }, [el("h2", { text: o.aborted ? "L'émission s'arrête ici" : "Le podium de l'émission" }), el("div", { class: "podium sos-podium" }, order.map((r) => el("div", { class: "pod pod--" + r.rank }, [el("div", { class: "pod__ball", style: { background: hx(r.id) } }), el("div", { class: "pod__nm", text: r.name }), el("div", { class: "pod__bar", text: String(r.pts) })])))]));
    st.appendChild(el("div", { class: "sos-card" }, [el("h2", { text: "Le classement final" }), el("table", { class: "tbl sos-tbl" }, [el("thead", {}, [el("tr", {}, [el("th", { text: "" }), el("th", { text: "Joueur" }), el("th", { class: "r", text: "Points" }), el("th", { class: "r", text: "Mots trouvés" }), el("th", { class: "r", text: "Éliminés à tort" })])]), el("tbody", {}, o.rows.map((r) => el("tr", {}, [el("td", { text: String(r.rank) }), el("td", {}, [el("span", { class: "dotc", style: { background: hx(r.id) } }), r.name + (r.left ? " (parti)" : "")]), el("td", { class: "r", text: String(r.pts) }), el("td", { class: "r", text: String(r.correct) }), el("td", { class: "r", text: String(r.busts) })])))])]));
    if (o.awards.length) st.appendChild(el("div", { class: "sos-card" }, [el("h2", { text: "Les titres" }), el("div", { class: "sos-awards" }, o.awards.map((a) => el("div", { class: "sos-award", style: { borderLeftColor: hx(a.id) } }, [el("span", { class: "sos-award__ic", text: a.icon }), el("div", {}, [el("b", { text: a.title }), el("div", { class: "sos-award__nm" }, [el("span", { class: "dotc", style: { background: hx(a.id) } }), nm(a.id)]), el("span", { class: "small muted", text: a.detail })])])))]));
    if (o.history.length) st.appendChild(el("div", { class: "sos-card" }, [el("h2", { text: "Les mots de la soirée" }), el("div", { class: "sos-recap" }, o.history.map((h) => el("div", { class: "sos-recap__row" }, [el("b", { text: h.word }), el("span", { class: "small muted", text: "Extralucide " + nm(h.extra) + ". " + (h.okGroups ? "Trouvé" : "Pas trouvé") + "." })])))]));
    const host = Kit.isHost();
    st.appendChild(el("div", { class: "sos-ctrl" }, [el("button", { class: "btn btn--ghost", text: "Quitter", onclick: () => Kit.confirm("Quitter la partie et revenir à l'accueil ?", () => Kit.leave()) }), host ? el("button", { class: "btn btn--accent btn--big", text: "Retour au salon", onclick: () => Kit.backToLobby() }) : el("span", { class: "muted small", text: "L'hôte peut relancer une partie depuis le salon." })]));
  }

  // ---------- horloge ----------
  // ---------- branchement ----------
  Kit.on("reset", () => { G.st = null; G.over = null; G.sig = ""; G.phaseKey = ""; G.prevElim = null; });
  Kit.on("room", (r) => { if (r.status === "lobby") { G.st = null; G.over = null; G.phaseKey = ""; G.prevElim = null; } else if (G.st) renderTop(); });
  function attach() { const so = Kit.socket; if (!so || G.attached) return; G.attached = true; so.on("sos:state", onState); so.on("sos:over", onOver); }

  Kit.init({
    id: "sucre-ou-sale", title: "Cristal Tordu", emoji: "🔮", ribbon: "Le jeu télé des mots cachés", tagline: "Un mot secret, des dilemmes absurdes, une grille qui se vide.",
    createLabel: "Créer un plateau", soloLabel: "Jouer contre un robot", startLabel: "Lancer l'émission", helpTitle: "Comment jouer",
    floaters: [{ e: "🔮", x: 6 }, { e: "🍬", x: 20 }, { e: "🧂", x: 34 }, { e: "🦷", x: 50 }, { e: "🎩", x: 64 }, { e: "🍕", x: 78 }, { e: "🪥", x: 92 }],
    colors: COLORS, botLevels: [{ id: "naif", label: "Naïf" }, { id: "fute", label: "Futé" }, { id: "genie", label: "Génie" }], maxPlayers: 8, minPlayers: 2, schema: R.SCHEMA,
    help: [
      { title: "Le principe", text: "À chaque manche, un joueur devient l'Extralucide. Il connaît un mot secret caché dans une grille. Les autres sont des enquêteurs, ils doivent trouver ce mot sans jamais l'éliminer." },
      { title: "Les dilemmes", text: "L'Extralucide reçoit un seul dilemme par tour, tiré au hasard. Qu'il ait un rapport avec son mot ou non, il doit se débrouiller pour désigner le côté qui lui ressemble. Une fois par manche, il peut utiliser son joker pour se défausser du dilemme et en recevoir un nouveau." },
      { title: "Éliminer", text: "Après chaque dilemme, les enquêteurs discutent et marquent les mots qui collent à l'autre côté. Un mot marqué par assez de monde disparaît, selon la règle choisie par l'hôte. Si le mot secret disparaît, c'est perdu. Le 📌 permet de garder un œil sur un mot qui hésite." },
      { title: "Les post-it", text: "Chaque dilemme joué laisse un post-it avec la réponse de l'Extralucide, les mots éliminés et ceux qui ont hésité. Touche un post-it pour relire les détails." },
      { title: "Gagner vite", text: "Les cinq dilemmes sont un maximum, et il n'y a aucune limite de temps ni de mots éliminés par dilemme. Quand le groupe est sûr, il peut annoncer son mot en avance avec le bouton éclair et gagner un bonus de rapidité. Mais s'il se trompe, la manche est perdue." },
      { title: "Les prénoms", text: "Des prénoms de joueurs se cachent parmi les mots. Si l'Extralucide doit faire deviner un prénom, servez-vous de ce que vous savez de la personne." },
      { title: "Les jokers", text: "Une fois par manche, l'Extralucide peut se défausser de son dilemme et en recevoir un nouveau tiré au hasard. Le mode Expert n'en donne pas." },
      { title: "Les événements", text: "Selon les réglages, un dilemme peut être inversé ou ramener un mot éliminé. L'événement est annoncé en plein écran." },
      { title: "Les modes", text: "Classique et Express se jouent tous ensemble. Expert agrandit la grille et durcit les dilemmes. Chaos mise sur l'absurde. Équipes oppose deux groupes. Tournoi se joue chacun pour soi avec une dernière manche double." },
      { title: "Les robots", text: "Naïf devine à peu près et oublie vite. Futé raisonne dilemme par dilemme. Génie cumule tous les indices et évite de prendre des risques inutiles." },
    ],
    theme: { a1: "#ffd23f", a2: "#ff5fa8", bg1: "#5b1a7a", bg2: "#190522" },
    onInit() { build(); attach(); Kit.on("connect", attach); },
  });
})();

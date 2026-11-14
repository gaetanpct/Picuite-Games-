// ============================================================
// MAIN MORTE — Interface de jeu (client)
// La table 3D vue à la première personne porte l'épreuve, le panneau du bas garde les commandes et les infos.
// Tout ce qui se clique sur la table se clique aussi dans le panneau.
// ============================================================
(function () {
  const { el, $, toast, sound } = Kit;
  const R = HORules, S = window.HOStage, A = window.HOAudio;
  const COLORS = [
    { name: "Rouge sang", hex: "#e63946" }, { name: "Or terni", hex: "#d4a72c" }, { name: "Vert poison", hex: "#5ec26a" }, { name: "Violet funèbre", hex: "#9b5de5" },
    { name: "Bleu nuit", hex: "#3d7bd9" }, { name: "Orange citrouille", hex: "#f77f00" }, { name: "Rose bonbon", hex: "#ff6fb5" }, { name: "Blanc os", hex: "#e9e4d4" },
  ];
  const FAM = { chance: "Chance", memoire: "Mémoire", reflexe: "Réflexes", precision: "Précision", deduction: "Déduction", bluff: "Bluff" };
  const MODE_NAMES = { classique: "Classique", survie: "Survie", equipes: "Équipes", tournoi: "Tournoi", express: "Express", chaos: "Chaos", perso: "Personnalisé" };
  const TEAMS = ["Gants noirs", "Gants rouges"];
  const PADS = ["#e63946", "#3d7bd9", "#ffd23f", "#2fe0a8"];
  const G = { st: null, over: null, off: 0, samples: [], lastKey: "", sig: "", ui: {}, attached: false, prevQuip: "", simonIdx: -1, recv: 0, built: false, judgeFor: -1, verdictAt: 0, focusAt: 0, beatSeen: -1, etauStep: 0, bombState: "" };
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
  const afx = (n, a) => { if (sfxOn() && sound.enabled) A.fx(n, a); };
  const act = (d) => { if (Kit.socket) Kit.socket.emit("ho:act", d); };
  const hover = (d) => { if (Kit.socket) Kit.socket.emit("ho:hover", d); };
  const cap = (s) => s.charAt(0).toUpperCase() + s.slice(1);
  const handsStr = (p) => (p.ghost ? "👻" : "✋".repeat(Math.max(0, p.hands)) + (p.max > p.hands ? "·".repeat(p.max - p.hands) : ""));
  const playing = () => G.st && G.st.phase === "play" && G.st.view && G.st.amIn;
  A.setEnabled(() => sound.enabled && sfxOn());

  // ---------- sons courts ----------
  const sIntro = () => sfx(() => { [196, 233, 262].forEach((f, i) => sound.tone(f, 0.6, "sawtooth", 0.07, i * 0.25, f * 0.97)); });
  const sTick = () => sfx(() => sound.tone(700, 0.04, "square", 0.05));
  const sTooth = () => sfx(() => sound.tone(520, 0.06, "triangle", 0.08));
  const sLaugh = () => sfx(() => { for (let i = 0; i < 6; i++) sound.tone(300 + Math.random() * 120, 0.09, "square", 0.04, 0.25 + i * 0.11, 220); });
  const sWin = () => sfx(() => { [523, 659, 784].forEach((f, i) => sound.tone(f, 0.18, "triangle", 0.1, i * 0.1)); });
  const sGo = () => sfx(() => { sound.tone(660, 0.12, "triangle", 0.12); sound.tone(990, 0.2, "triangle", 0.12, 0.08); });

  // ---------- squelette ----------
  function build() {
    const sc = $("#screen-game"); sc.innerHTML = "";
    const view = E("div", { class: "ho-view", id: "ho-view" }); sc.appendChild(view);
    const ui = E("div", { class: "ho-ui" }, [E("div", { class: "ho-top", id: "ho-top" }), E("div", { class: "ho-timer hidden", id: "ho-timer" }, [E("i", { id: "ho-timer-fill" })]), E("div", { class: "ho-stage-top", id: "ho-stage-top" }), E("div", { class: "ho-main", id: "ho-main" }), E("div", { class: "ho-foot hidden", id: "ho-foot" })]); ui.id = "ho-ui"; sc.appendChild(ui);
    sc.appendChild(E("div", { class: "ho-cut", id: "ho-cut" }));
    sc.appendChild(E("button", { class: "round-btn ho-menu", title: "Menu", text: "⚙️", onclick: openMenu }));
    G.noGL = !S.init(view); if (G.noGL) view.style.background = "radial-gradient(circle at 50% 20%, #5a0f1c, #0a0206 70%)";
    S.onPick = onPick; S.pickable = canPick;
    window.addEventListener("keydown", onKey); window.addEventListener("keyup", onKeyUp);
    window.addEventListener("pointerup", releaseAll); window.addEventListener("pointercancel", releaseAll); window.addEventListener("blur", () => { releaseAll(); if (G.bis) G.bis.drag = null; });
    window.addEventListener("pointermove", bisMove); window.addEventListener("pointerup", bisUp);
    G.built = true; requestAnimationFrame(frame);
  }
  function openMenu() {
    const sbtn = E("button", { class: "btn btn--small btn--ghost", text: sound.enabled ? "Son activé" : "Son coupé", onclick: (ev) => { ev.target.textContent = sound.toggle() ? "Son activé" : "Son coupé"; } });
    const vb = (m, label) => E("button", { class: "btn btn--small " + (A.mode === m ? "btn--accent" : "btn--ghost"), text: label, onclick: () => { A.setMode(m); openMenu(); if (m !== "muet") A.say("Bonsoir. Gardez vos mains bien en vue.", m); } });
    const rows = [E("div", { class: "menu-row" }, [E("div", {}, [E("b", { text: "Sons" }), E("p", { class: "small muted", text: "Ambiance de plateau, cœur qui bat, mâchoires et clochettes." })]), sbtn]),
      E("div", { class: "menu-row" }, [E("div", {}, [E("b", { text: "Voix du présentateur" }), E("p", { class: "small muted", text: "Charabia déformé, voix de synthèse grave, ou silence." })]), E("div", { class: "ho-voice" }, [vb("babil", "Charabia"), vb("voix", "Synthèse"), vb("muet", "Muet")])]),
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
    if (s.quip !== G.prevQuip) { G.prevQuip = s.quip; const wait = Math.max(0, G.verdictAt - performance.now()); setTimeout(() => speak(s.quip), wait + (s.phase === "brief" ? 400 : 0)); }
    if (S.ready) S.setPlayers(s.players.map((p) => ({ id: p.id, color: (pl(p.id) || { color: 0 }).color, hex: hexOf(p.id), hands: p.hands, max: p.max, alive: p.alive, name: nameOf(p.id) })), s.you);
    if (s.phase === "play" && prev && prev.phase === "play" && prev.view && s.view) diffSounds(prev, s);
    renderAll();
  }
  function speak(q) { if (!q || !G.st || G.st.quip !== q) return; const d = sfxOn() && sound.enabled ? A.say(q) : 0; if (S.ready) S.talk(d || Math.min(4, 0.8 + q.length * 0.03)); }
  function phaseEnter(s, prev) {
    G.ui = {}; G.simonIdx = -1; G.beatSeen = -1; G.etauStep = 0; G.bombState = ""; releaseAll();
    if (s.phase !== "play" && s.phase !== "judge" && S.ready) S.clearTrial();
    if (s.phase === "intro") sIntro();
    if (s.phase === "brief") { sIntro(); if (S.ready) S.mood(s.modifier ? "#ffd23f" : "#e63946"); }
    if (s.phase === "prep") { sGo(); if (S.ready) S.mood("#a56bff"); }
    if (s.phase === "count") { G.countN = -1; if (S.ready) S.mood("#e63946"); }
    if (s.phase === "play") { sGo(); G.bis = null; }
    if (s.phase === "judge" && s.judged && G.judgeFor !== s.round) {
      G.judgeFor = s.round; const J = s.judged; const round = s.round; const lost = Object.keys(J.loss).filter((id) => J.loss[id].loss > 0);
      const down = Object.keys(J.loss).filter((id) => J.loss[id].after <= 0 && J.loss[id].loss > 0 && !s.points);
      // silence total, puis le verdict
      G.verdictAt = performance.now() + 1150; A.silence(1150); if (S.ready) { S.hold(true); S.setView("wide"); }
      setTimeout(() => { if (G.judgeFor !== round) return; renderAll(); }, 1160);
      setTimeout(() => {
        if (G.judgeFor !== round) return;
        if (lost.length) { afx("stinger"); sLaugh(); if (S.ready) { S.mood("#ff3b4e"); S.flash("#ff3b4e", 0.6); } } else { afx("relief"); sWin(); if (S.ready) S.mood("#2fe0a8"); }
        const evs = []; lost.forEach((id) => { for (let i = 0; i < Math.min(3, J.loss[id].loss); i++) evs.push(id); }); let tt = 300;
        evs.forEach((id) => {
          setTimeout(() => { if (G.judgeFor !== round || !S.ready) return; S.setView("wide", id); S.redLight(id, true); afx("creak"); }, tt);
          setTimeout(() => { if (G.judgeFor !== round) return; cut(); afx("chop"); if (S.ready) S.cover(id); }, tt + 850);
          setTimeout(() => { if (S.ready) S.redLight(id, false); }, tt + 1400);
          tt += 1650;
        });
        setTimeout(() => { if (S.ready) { S.setView("wide"); S.hold(false); } if (down.length && G.judgeFor === round) afx("ghost"); }, tt + 150);
      }, 1150);
    }
  }
  function cut() { const c = $("#ho-cut"); if (!c) return; c.classList.remove("ho-cut--on"); void c.offsetWidth; c.classList.add("ho-cut--on"); }
  function onOver(m) { G.over = m; G.lastKey = ""; if (S.ready) { S.hold(false); S.clearTrial(); S.setView("wide"); } sfx(() => sound.win()); renderAll(); }
  // petits sons quand l'état change pendant une épreuve
  function diffSounds(a, b) {
    const id = b.ch.id, va = a.view, vb = b.view;
    if (id === "croco") { if (vb.pressed.length > va.pressed.length && !vb.bite) sTooth(); if (vb.bite && !va.bite) afx("bite"); }
    if (id === "bombe") { const ka = Object.keys(va.out).length, kb = Object.keys(vb.out).length; if (kb > ka) afx("whoosh"); if (vb.over && !va.over) afx(vb.boom ? "boom" : "fizzle"); }
    if (id === "reflex") { if (vb.fired && !va.fired) afx("slam"); else if (vb.feints.length > va.feints.length) afx("whoosh"); }
    if (id === "etau") { if (vb.closed && !va.closed) afx("crush"); if (Object.keys(vb.out).length > Object.keys(va.out).length) afx("whoosh"); }
    if (id === "gants") { if (vb.bite && !va.bite) afx("bite"); else if (vb.left < va.left) afx("glove"); }
    if (id === "boite") { if (vb.bite && !va.bite) setTimeout(() => afx("bite"), 750); else if (Object.keys(vb.picks).length > Object.keys(va.picks).length) afx("whoosh"); if (vb.phase === "pick" && va.phase === "feel") afx("reveal"); }
    if (id === "couteau") { const me = b.you; const pa = va.prog[me], pb = vb.prog[me]; if (pa && pb && pb.fail >= 0 && pa.fail < 0) afx("knife", false); }
    if (id === "collision" && vb.all && !va.all) afx("reveal");
    if ((id === "doigts" && vb.reveal && !va.reveal) || (id === "ppc" && vb.all && !va.all)) afx("reveal");
    if (id === "coffre" && vb.cracked && !va.cracked) sWin();
    if (id === "bistouri") { Object.keys(vb.prog).forEach((k) => { if (k !== b.you && vb.prog[k].strikes > (va.prog[k] || { strikes: 0 }).strikes) afx("buzz"); }); }
  }

  // ---------- commandes à la souris sur la table, au clavier ----------
  function canPick(p) {
    if (!playing()) return false; const v = G.st.view, id = G.st.ch.id, me = G.st.you;
    if (p.k === "tooth") return id === "croco" && v.turn === me && !v.bite && !v.pressed.some((x) => x.i === p.i);
    if (p.k === "cell") return id === "collision" && !v.mine;
    if (p.k === "bell") return id === "simon" && snow() >= v.inputStart && !(v.prog[me] && (v.prog[me].fail || v.prog[me].done));
    if (p.k === "hot") return id === "hot";
    if (p.k === "gap") return id === "couteau";
    if (p.k === "glove") return id === "gants" && v.turn === me && !(v.gloves[p.i] && v.gloves[p.i].by);
    if (p.k === "box") return id === "boite" && v.phase === "pick" && v.turn === me && (v.free || []).includes(p.i);
    if (p.k === "myhand") return id === "reflex" && v.taps[me] === undefined && !v.early[me];
    if (p.k === "stop") return id === "stoppile" && (v.mine === null || v.mine === undefined);
    return false;
  }
  function onPick(p) {
    if (!canPick(p)) return;
    if (p.k === "tooth") { sTooth(); act({ tooth: p.i }); }
    else if (p.k === "cell") act({ n: p.i + 1 });
    else if (p.k === "bell") tapBell(p.i);
    else if (p.k === "hot") act({ cell: p.i });
    else if (p.k === "gap") knife(p.i);
    else if (p.k === "glove") act({ glove: p.i });
    else if (p.k === "box") act({ box: p.i });
    else if (p.k === "myhand") act({ tap: true });
    else if (p.k === "stop") act({ stop: true });
  }
  function tapBell(k) { G.ui.flash = k; setTimeout(() => { G.ui.flash = undefined; }, 160); if (S.ready) S.ring(k); afx("bell", k); act({ tap: k }); }
  function knife(k) {
    const v = G.st.view; const me = G.st.you; const P = v.prog[me]; if (!P || P.fail >= 0 || P.i >= v.n) return; const t = snow(); const b = v.beats[P.i]; const B = v.t0 + b.at;
    afx("knife", k === b.g && Math.abs(t - B) <= b.w); act({ gap: k, at: t });
  }
  function typing() { const a = document.activeElement; return a && (a.tagName === "INPUT" || a.tagName === "TEXTAREA"); }
  function onKey(ev) {
    if (typing() || !playing() || ev.repeat) return; const id = G.st.ch.id, v = G.st.view, me = G.st.you; const k = ev.key;
    if (k === " " || k === "Spacebar") {
      if (id === "reflex" && v.taps[me] === undefined && !v.early[me]) act({ tap: true });
      else if (id === "bombe" && !v.mineOut && !v.over) act({ out: true });
      else if (id === "stoppile" && (v.mine === null || v.mine === undefined)) act({ stop: true });
      else if (id === "etau") holdOn();
      else return; ev.preventDefault(); return;
    }
    const n = parseInt(k, 10); if (!(n >= 1 && n <= 9)) return;
    if (id === "couteau" && n <= 4) { knife(n - 1); ev.preventDefault(); }
    else if (id === "simon" && n <= 4 && canPick({ k: "bell", i: n - 1 })) { tapBell(n - 1); ev.preventDefault(); }
    else if (id === "hot") { act({ cell: n - 1 }); ev.preventDefault(); }
  }
  function onKeyUp(ev) { if (ev.key === " " || ev.key === "Spacebar") holdOff(); }
  function holdOn() { if (!playing() || G.st.ch.id !== "etau" || G.holding) return; const v = G.st.view; if (v.mineOut || v.started) return; G.holding = true; act({ hold: true }); }
  function holdOff() { if (!G.holding) return; G.holding = false; act({ hold: false }); }
  function releaseAll() { holdOff(); }

  // ---------- horloge et animations ----------
  function tension(st, t) {
    const v = st.view, id = st.ch.id, me = st.you;
    if (id === "croco") return (v.turn === me ? 0.6 : 0.25) + 0.4 * (v.pressed.length / v.teeth);
    if (id === "bombe") return v.mineOut ? 0.15 : Math.min(1, 0.3 + Math.max(0, t - v.t0) / (v.vis * 2.4));
    if (id === "etau") return v.mineOut ? 0.15 : Math.min(1, 0.35 + v.P * 1.2);
    if (id === "couteau") { const P = v.prog[me]; return P && P.fail < 0 ? 0.3 + 0.7 * (P.i / v.n) : 0.1; }
    if (id === "reflex") return v.fired ? 0.4 : 0.75;
    if (id === "gants") return v.turn === me ? 0.85 : 0.4;
    if (id === "boite") return v.turn === me ? 0.85 : 0.35;
    return 0.35;
  }
  function frame() {
    requestAnimationFrame(frame); const st = G.st; if (!st) return; const scr = $("#screen-game"); if (!scr || !scr.classList.contains("screen--active")) { A.update(null); A.ambience(0); return; } const t = snow();
    // la caméra, et la zone d'écran où l'on veut voir la table
    if (S.ready) {
      const seat = st.phase === "play" || st.phase === "count"; if (st.phase !== "judge") S.setView(seat ? "seat" : "wide");
      if (performance.now() - G.focusAt > 300) { G.focusAt = performance.now(); const top = $("#ho-stage-top"); const vw = $("#ho-view"); if (top && vw && top.offsetHeight > 30) { const r = top.getBoundingClientRect(), q = vw.getBoundingClientRect(); S.setFocus(r.top - q.top, q.bottom - r.bottom); } else S.setFocus(0, 0); }
      if ((st.phase === "play" || st.phase === "judge") && st.view && st.ch) S.trial(st.ch.id, st.view, st, t);
    }
    // le son
    const inPlay = st.phase === "play" && st.view && st.amIn; const id = st.ch ? st.ch.id : "";
    A.ambience(st.phase === "over" ? 0.3 : 1);
    let sz = 0; if (st.phase === "play" && id === "bombe" && st.view && t >= st.view.t0 && !st.view.over) sz = 0.15 + 0.85 * Math.min(1, (t - st.view.t0) / (st.view.vis * 2.4));
    A.update({ heart: !!inPlay && st.me && (st.me.alive || st.amIn), tension: inPlay ? tension(st, t) : 0, sizzle: sz });
    // barre de temps
    const tm = $("#ho-timer"), fill = $("#ho-timer-fill"); if (tm && fill) {
      let left = 0, total = 1, show = false; const v = st.view;
      if (st.phase === "play" && v) { if (v.turnEnds) { if (v.turnEnds !== G.teSeen) { G.teSeen = v.turnEnds; G.teTotal = Math.max(1000, v.turnEnds - t); } left = v.turnEnds - t; total = G.teTotal; show = true; } else if (v.ends && id !== "couteau" && id !== "bistouri") { left = v.ends - t; total = Math.max(1, v.ends - (v.t0 || v.showStart || v.flashEnd || v.ends - 14000)); show = true; } }
      else if (st.phase === "count") { left = st.left - (performance.now() - G.recv); total = st.countTotal || 3300; show = true; }
      tm.classList.toggle("hidden", !show); if (show) fill.style.width = Math.max(0, Math.min(100, (left / total) * 100)) + "%";
    }
    if (st.phase === "brief") { const w = $("#ho-brief-wait"); if (w) w.textContent = "Prends ton temps, le départ se fait quand tout le monde est prêt."; }
    if (st.phase !== "brief") { const w = $("#ho-brief-wait"); if (w && w.dataset.base !== undefined) w.textContent = w.dataset.base; }
    if (st.phase === "count") { const e = $("#ho-count"); if (e) { const left = st.left - (performance.now() - G.recv); const n = Math.max(1, Math.min(3, Math.ceil(left / ((st.countTotal || 3300) / 3)))); e.textContent = String(n); if (n !== G.countN) { G.countN = n; sTick(); e.classList.remove("ho-count--pop"); void e.offsetWidth; e.classList.add("ho-count--pop"); } } }
    if (st.phase === "judge" && G.verdictAt && performance.now() >= G.verdictAt && $("#ho-verdict-wait")) renderAll();
    if (st.phase !== "play" || !st.view) return; const v = st.view;
    if (id === "hot") { const cells = document.querySelectorAll(".ho-hotcell"); let lit = -1; v.seq.forEach((w) => { if (t >= v.start + w.at && t < v.start + w.at + w.dur) lit = w.cell; }); cells.forEach((c, k) => c.classList.toggle("ho-hotcell--lit", k === lit)); const msg = $("#ho-hot-msg"); if (msg) msg.textContent = t < v.start ? "Prépare-toi" : t > v.end ? "Terminé" : "Touche les mains allumées"; }
    if (id === "stoppile") { const cur = $("#ho-cur"); if (cur) { const pos = v.mine !== null && v.mine !== undefined ? v.mine : (t < v.t0 ? 0 : 1 - Math.abs(2 * (((t - v.t0) / v.P) % 1) - 1)); cur.style.left = pos * 100 + "%"; } }
    if (id === "simon") {
      const L = v.seq.length; const idx = t >= v.showStart && t < v.showStart + L * v.pace ? Math.floor((t - v.showStart) / v.pace) : -1; const within = idx >= 0 && ((t - v.showStart) % v.pace) < v.pace * 0.72;
      document.querySelectorAll(".ho-pad").forEach((p, k) => p.classList.toggle("ho-pad--lit", (within && v.seq[idx] === k) || G.ui.flash === k));
      if (within && idx !== G.simonIdx) { G.simonIdx = idx; afx("bell", v.seq[idx]); if (S.ready) S.ring(-1); }
      const msg = $("#ho-simon-msg"); if (msg) msg.textContent = t < v.showStart ? "La lumière baisse, écoute bien" : t < v.showStart + L * v.pace ? "Regarde et écoute" : t < v.inputStart ? "Attends" : "À toi de rejouer la suite";
    }
    if (id === "bombe") {
      const b = $("#ho-bomb-t"); const f = $("#ho-fuse"); const s = Math.max(0, Math.min(1, (t - v.t0) / v.vis));
      if (b && !v.over) b.textContent = t < v.t0 ? "Prêt" : s < 1 ? "La mèche brûle" : "La mèche est entrée dans la bombe"; if (f) f.style.width = (1 - s) * 100 + "%";
    }
    if (id === "etau") {
      const P = Math.max(0, Math.min(1, v.started && !v.over ? v.P + v.rate * (t - v.at) : v.P)); const g = $("#ho-press"); if (g) g.style.width = P * 100 + "%";
      const step = Math.floor(P / 0.04); if (step > G.etauStep && v.started && !v.over) { G.etauStep = step; afx("ratchet"); }
      const m = $("#ho-etau-msg"); if (m) m.textContent = !v.started ? (G.holding ? "Ta main est dans l'étau, ne lâche pas" : "Maintiens le bouton pour poser ta main") : v.mineOut ? "Ta main est sortie" : v.over ? "C'est fini" : G.holding ? "Tiens bon, ou lâche" : "";
    }
    if (id === "couteau") {
      const me = st.you; const P = v.prog[me]; const fill2 = $("#ho-beat");
      if (P && P.fail < 0 && P.i < v.n) {
        const b = v.beats[P.i]; const B = v.t0 + b.at; const prev = P.i > 0 ? v.t0 + v.beats[P.i - 1].at : v.t0 - 1200; const k = Math.max(0, Math.min(1, (t - prev) / Math.max(1, B - prev)));
        if (fill2) fill2.style.transform = "scale(" + (1 + 1.6 * (1 - k)) + ")";
        document.querySelectorAll(".ho-gapbtn").forEach((x, g) => x.classList.toggle("ho-gapbtn--on", g === b.g));
        const bi = v.beats.findIndex((x) => v.t0 + x.at > t) - 1; if (bi >= 0 && bi !== G.beatSeen) { G.beatSeen = bi; afx("tickBeat", bi % 4 === 0); }
      } else document.querySelectorAll(".ho-gapbtn").forEach((x) => x.classList.remove("ho-gapbtn--on"));
    }
    if (id === "coupdoeil") { const box = $("#ho-flash"); if (box) { const on = v.hands && t >= v.flashStart && t < v.flashEnd; box.classList.toggle("ho-flash--on", !!on && G.noGL); } }
    if (id === "bistouri") bisDraw(v, t);
  }

  // ---------- rendu ----------
  function renderAll() {
    const st = G.st; if (!st) return; const top = $("#ho-top"), main = $("#ho-main"); if (!top || !main) return;
    renderTop(st, top);
    const waitV = st.phase === "judge" && performance.now() < G.verdictAt;
    const sig = JSON.stringify([st.phase, st.round, st.players, st.me, st.view ? Object.assign({}, st.view, { now: 0, at: 0, P: 0 }) : null, st.judged, st.plays, st.modifier, G.over ? 1 : 0, G.ui.tick, waitV]);
    if (sig === G.sig) return; G.sig = sig; const pk = st.phase + "|" + st.round; const keepY = G.lastPk === pk ? main.scrollTop : 0; G.lastPk = pk; main.innerHTML = "";
    const ui = $("#ho-ui"), foot = $("#ho-foot");
    if (ui) { ["intro", "brief", "prep", "judge", "count", "play", "over"].forEach((k) => ui.classList.toggle("ho-ph-" + k, st.phase === k)); ui.classList.toggle("ho-wide", st.phase === "brief" || st.phase === "prep" || st.phase === "judge"); ui.classList.toggle("ho-tallpanel", st.phase === "play" && st.ch && st.ch.id === "bistouri"); }
    if (foot) { foot.innerHTML = ""; const f = waitV ? null : buildFoot(st); if (f) { foot.classList.remove("hidden"); f.forEach((x) => foot.appendChild(x)); } else foot.classList.add("hidden"); }
    if (G.over && st.phase === "over") return main.appendChild(buildOver());
    if (st.phase === "intro") main.appendChild(buildIntro(st));
    else if (st.phase === "brief") main.appendChild(buildBrief(st));
    else if (st.phase === "prep") main.appendChild(buildPrep(st));
    else if (st.phase === "count") main.appendChild(buildCount(st));
    else if (st.phase === "play") main.appendChild(buildPlay(st));
    else if (st.phase === "judge") main.appendChild(waitV ? E("div", { class: "ho-col", id: "ho-verdict-wait" }, [E("div", { class: "ho-card ho-verdict" }, [E("h2", { text: "Le verdict tombe" }), E("p", { class: "ho-sub", text: "Silence sur le plateau." })])]) : buildJudge(st));
    else if (st.phase === "over") main.appendChild(E("div", { class: "ho-card" }, [E("h2", { text: "Générique de fin" })]));
    if (keepY) main.scrollTop = keepY;
  }
  function renderTop(st, top) {
    top.innerHTML = "";
    top.appendChild(E("div", { class: "ho-round", text: MODE_NAMES[st.mode] + (st.phase === "over" ? "  ·  fin de l'émission" : st.round ? "  ·  épreuve " + st.round + " sur " + st.rounds : "") }));
    top.appendChild(E("div", { class: "ho-quip", text: st.phase === "judge" && performance.now() < G.verdictAt ? "…" : st.quip || "" }));
    top.appendChild(E("div", { class: "ho-players" }, st.players.map((p) => E("div", { class: "ho-chip" + (p.id === st.you ? " ho-chip--you" : "") + (p.ghost ? " ho-chip--ghost" : "") + (st.phase === "play" && st.part && st.part.includes(p.id) ? " ho-chip--in" : "") }, [dot(p.id), E("span", { class: "nm", text: nameOf(p.id) }), E("span", { class: "ho-hands", text: st.points ? p.points + " pt" : handsStr(p) }), st.teams && p.team !== null ? E("small", { text: p.team === 0 ? "⚫" : "🔴" }) : null, p.pact ? E("small", { text: "🤝", title: "Un pacte secret est scellé" }) : null, p.rancune ? E("small", { text: "🗡️", title: "Rancune de traître" }) : null, p.mark ? E("small", { text: "👻", title: "Marqué par un fantôme" }) : null, p.cardsN && st.phase !== "over" ? E("small", { text: "🃏" + p.cardsN }) : null]))));
  }
  function buildIntro(st) {
    const m = R.MODES.find((x) => x.value === st.mode);
    return E("div", { class: "ho-card" }, [E("h2", { text: "Bienvenue dans Main Morte" }), E("p", { class: "ho-sub", text: m ? m.desc : "" }), E("p", { class: "ho-sub", text: "Chaque épreuve perdue coûte une main. Sans main, tu deviens fantôme et tu continues à jouer, tu peux même te venger." }), E("p", { class: "ho-sub", text: "Pendant les épreuves, tu es assis à la table. Tu peux cliquer directement sur les objets de la table, ou utiliser le panneau du bas." }), st.teams ? E("p", { class: "ho-sub", text: "Tu es dans l'équipe " + TEAMS[(st.players.find((p) => p.id === st.you) || {}).team || 0] + "." }) : null]);
  }

  // ----- pied de page commun -----
  const FOOT_LABEL = { intro: "Je suis prêt", brief: "J'ai compris, je suis prêt", prep: "Mes cartes et mon pacte sont prêts", judge: "J'ai tout lu, épreuve suivante" };
  function buildFoot(st) {
    const ph = st.phase; if (!FOOT_LABEL[ph]) return null; const me = st.me; if (ph === "prep" && !me.alive) return null;
    const done = ph === "prep" ? !!me.ready : !!me.read;
    const wait = st.players.filter((p) => p.id !== st.you && (ph === "prep" ? p.alive && !p.ready : !(p.read || p.auto)));
    let base = "";
    if (ph !== "brief") base = done ? (wait.length ? "Tu es prêt, on attend " + wait.map((p) => nameOf(p.id)).join(", ") : "Tout le monde est prêt") : (wait.length ? "Déjà prêts  " + (st.players.length - 1 - wait.length) + " sur " + (st.players.length - 1) : "Tous les autres sont prêts");
    const btn = E("button", { class: "btn btn--accent btn--big ho-foot__btn", id: "ho-readybtn", text: done ? "Prêt, j'attends les autres" : FOOT_LABEL[ph], disabled: done, onclick: () => Kit.socket.emit("ho:ready") });
    const info = E("div", { class: "ho-wait", id: "ho-brief-wait", text: "" }); if (ph !== "brief") info.dataset.base = base;
    return [E("div", { class: "ho-foot__row" }, [btn, Kit.isHost() ? E("button", { class: "btn btn--ghost btn--small ho-foot__skip", text: ph === "prep" ? "Lancer" : "Passer", onclick: () => Kit.socket.emit("ho:skip") }) : null]), info];
  }

  // ----- lecture des règles -----
  function buildBrief(st) {
    const ch = st.ch, b = st.brief || { icon: "🖐️", goal: "", cmds: [], lose: "", tip: "", extra: "" }; const me = st.me;
    const hero = E("div", { class: "ho-brief ho-card" }, [
      E("div", { class: "ho-brief__head" }, [E("div", { class: "ho-brief__icon", text: b.icon }), E("div", { class: "ho-brief__tt" }, [E("div", { class: "ho-fam", text: "Épreuve " + st.round + " sur " + st.rounds + "  ·  " + FAM[ch.family] }), E("h2", { class: "ho-brief__name", text: ch.name })])]),
      E("div", { class: "ho-goal" }, [E("small", { text: "Ton objectif" }), E("b", { text: b.goal || ch.rules })]),
      b.extra ? E("p", { class: "ho-variant", text: b.extra }) : null,
      st.modifier ? E("p", { class: "ho-variant", text: "Règle chaos. " + st.modifier.label + ", " + st.modifier.text }) : null,
      !me.alive ? E("p", { class: "ho-ghostbar", text: "👻 Tu es fantôme. Tu peux quand même jouer cette épreuve si elle l'autorise, sinon tu regardes." }) : null,
    ]);
    const items = [hero];
    if (b.cmds && b.cmds.length) items.push(E("div", { class: "ho-card" }, [E("h3", { text: "Les commandes" })].concat(b.cmds.map((c) => E("div", { class: "ho-cmd" }, [E("span", { class: "ho-cmd__ic", text: c[0] }), E("span", { text: c[1] })])))));
    items.push(E("div", { class: "ho-card ho-card--lose" }, [E("h3", { text: "Ce qui te fait perdre" }), E("p", { class: "ho-bigp", text: b.lose || "" }), b.tip ? E("p", { class: "ho-tip", text: "Astuce. " + b.tip }) : null]));
    items.push(E("div", { class: "ho-card" }, [E("h3", { text: "Qui a fini de lire" }), E("div", { class: "ho-readers" }, st.players.map((p) => E("span", { class: "ho-reader" + (p.read || p.auto ? " ho-reader--ok" : "") }, [dot(p.id), " " + nameOf(p.id) + (p.read || p.auto ? "  ✔" : "  …")])))]));
    return E("div", { class: "ho-grid" }, items);
  }
  function buildCount(st) {
    return E("div", { class: "ho-col" }, [E("div", { class: "ho-card ho-countcard" }, [E("div", { class: "ho-fam", text: st.ch.name }), E("div", { class: "ho-count", id: "ho-count", text: "3" }), E("p", { class: "ho-hint", text: st.brief && st.brief.goal ? st.brief.goal : "" })])]);
  }

  // ----- préparation, cartes et pactes -----
  function cardTile(cd, i, sel, onpick) {
    const d = R.CARDS[cd]; return E("button", { class: "ho-cardbtn" + (i === sel ? " ho-cardbtn--on" : ""), onclick: onpick }, [
      E("div", { class: "ho-cardbtn__top" }, [E("span", { class: "ho-cardbtn__ic", text: d.icon }), E("b", { text: d.name })]),
      E("small", { class: "ho-cardbtn__when", text: d.when }), E("small", { text: d.text }), E("small", { class: "ho-cardbtn__risk", text: "Risque. " + d.risk })]);
  }
  function buildPrep(st) {
    const ch = st.ch; const me = st.me; const alive = st.players.filter((p) => p.alive && p.id !== st.you); const b = st.brief || {};
    const items = [];
    items.push(E("div", { class: "ho-card ho-card--slim ho-span" }, [E("div", { class: "ho-fam", text: "Avant l'épreuve  ·  " + FAM[ch.family] }), E("h2", { text: (b.icon || "") + " " + ch.name }), E("p", { class: "ho-goalline", text: "Objectif. " + (b.goal || ch.rules) }), st.modifier ? E("p", { class: "ho-sub", style: { color: "#ffd23f" }, text: "Règle chaos. " + st.modifier.label + ", " + st.modifier.text }) : null, st.alarm ? E("p", { class: "ho-alarm", text: "🚨 L'alarme a retenti, tous les pactes de cette épreuve sont annulés." }) : null, !me.alive ? E("p", { class: "ho-ghostbar", text: "👻 Tu es fantôme, tu n'as ni carte ni pacte. Regarde la table se préparer." }) : null]));
    const tab = G.ui.tab || (st.cardsOn ? "cards" : "pact"); const hasIncoming = me.alive && st.pactsOn && !me.pact && me.props.some((x) => x.to === st.you);
    if (me.alive && st.cardsOn && st.pactsOn) items.push(E("div", { class: "ho-tabs ho-span" }, [
      E("button", { class: "ho-tab" + (tab === "cards" ? " ho-tab--on" : ""), text: "🃏 Cartes" + (me.cards.length ? "  " + me.cards.length : ""), onclick: () => { G.ui.tab = "cards"; G.ui.tick = Math.random(); renderAll(); } }),
      E("button", { class: "ho-tab" + (tab === "pact" ? " ho-tab--on" : ""), text: "🤝 Pacte" + (hasIncoming ? "  ❗" : me.pact ? "  ✔" : ""), onclick: () => { G.ui.tab = "pact"; G.ui.tick = Math.random(); renderAll(); } })]));
    const pane = (id, kids) => E("div", { class: "ho-pane" + (tab === id || !(st.cardsOn && st.pactsOn) ? "" : " ho-pane--off") }, kids);
    if (st.plays.length || (me.alive && me.intel)) {
      const tk = [];
      if (st.plays.length) tk.push(E("h3", { text: "Cartes jouées par la table" }), ...st.plays.map((x) => E("p", { class: "ho-note" }, [dot(x.by), " " + nameOf(x.by) + " joue " + R.CARDS[x.card].icon + " " + R.CARDS[x.card].name + (x.target ? " sur " + nameOf(x.target) : "")])));
      if (me.alive && me.intel) { const I = me.intel; tk.push(E("h3", { text: "🕵️ Ce que tu sais sur " + nameOf(I.target) }), E("p", { class: "ho-note", text: I.cards.length ? "Ses cartes sont " + I.cards.map((c) => R.CARDS[c].icon + " " + R.CARDS[c].name).join(", ") + "." : "Il n'a aucune carte." }), E("p", { class: "ho-note", text: I.pact ? "Il a un pacte avec " + nameOf(I.pact.with) + " et compte être " + (I.pact.loyal ? "fidèle" : "traître") + "." : "Il n'a aucun pacte pour l'instant." }), I.rancune ? E("p", { class: "ho-note", text: "Il porte une rancune de traître." }) : null); }
      items.push(E("div", { class: "ho-card ho-card--intel ho-span" }, tk));
    }
    if (me.alive && st.cardsOn) {
      const sel = G.ui.card; const c = me.cards[sel];
      items.push(pane("cards", [E("div", { class: "ho-card ho-card--full" }, [E("h3", { text: "Tes cartes d'influence" }), E("p", { class: "ho-hint ho-hint--left", text: "Touche une carte pour la jouer. Tout le monde voit quelle carte tu joues, mais pas forcément si elle dit vrai." }),
        me.cards.length ? E("div", { class: "ho-cards" }, me.cards.map((cd, i) => cardTile(cd, i, sel, () => { const needT = R.CARDS[cd].target; if (!needT) { Kit.socket.emit("ho:card", { i }); G.ui.card = undefined; } else { G.ui.card = i; G.ui.tick = Math.random(); renderAll(); } }))) : E("p", { class: "ho-hint", text: "Tu n'as aucune carte. On en gagne en remportant une épreuve ou grâce à un pacte." }),
        c ? E("div", { class: "ho-target-box" }, [E("p", { class: "ho-hint ho-hint--left", text: R.CARDS[c].icon + " " + R.CARDS[c].name + ". Choisis la cible." }), E("div", { class: "ho-targets" }, alive.map((p) => E("button", { class: "ho-pill", onclick: () => { Kit.socket.emit("ho:card", { i: sel, target: p.id }); G.ui.card = undefined; } }, [dot(p.id), nameOf(p.id) + (p.rancune ? " 🗡️" : "")])))]) : null,
        me.shield ? E("p", { class: "ho-note", text: "🛡️ Ton bouclier est posé." }) : null, me.mirror ? E("p", { class: "ho-note", text: "🪞 Ton miroir vise " + nameOf(me.mirror) + "." }) : null, me.dbl ? E("p", { class: "ho-note", text: "✌️ Double ou rien est engagé." }) : null,
        me.rancune ? E("p", { class: "ho-note", text: "🗡️ Tu portes une rancune de traître. Ta prochaine sanction coûtera une main de plus." }) : null])]));
    }
    if (me.alive && st.pactsOn) {
      const incoming = me.props.filter((x) => x.to === st.you); const mine = me.props.find((x) => x.from === st.you);
      const pk = [E("h3", { text: "Pacte secret" })];
      if (st.alarm) pk.push(E("p", { class: "ho-note", text: "Plus aucun pacte n'est possible ce tour." }));
      else if (me.pact) pk.push(E("p", { class: "ho-note ho-note--big", text: "🤝 Pacte avec " + nameOf(me.pact.with) + ". Tu as choisi d'être " + (me.pact.loyal ? "fidèle" : "traître") + ", seul toi le sais. Cela se joue à la fin de l'épreuve." }));
      else {
        const choice = (id) => E("div", { class: "ho-choicebox" }, [
          E("button", { class: "ho-pill ho-pill--big", text: "Accepter et rester fidèle", onclick: () => Kit.socket.emit("ho:pactans", { from: id, ok: true, loyal: true }) }),
          E("button", { class: "ho-pill ho-pill--big ho-pill--bad", text: "Accepter et trahir", onclick: () => Kit.socket.emit("ho:pactans", { from: id, ok: true, loyal: false }) }),
          E("button", { class: "ho-pill", text: "Refuser", onclick: () => Kit.socket.emit("ho:pactans", { from: id, ok: false }) })]);
        incoming.forEach((x) => pk.push(E("div", { class: "ho-note ho-note--big ho-incoming" }, [dot(x.from), " " + nameOf(x.from) + " te propose un pacte. Il a déjà fait son choix en secret.", choice(x.from)])));
        if (mine) pk.push(E("p", { class: "ho-note", text: "Proposition envoyée à " + nameOf(mine.to) + ". Elle se joue à la fin de l'épreuve si elle est acceptée." }));
        else {
          G.ui.loyal = G.ui.loyal === undefined ? true : G.ui.loyal;
          pk.push(E("p", { class: "ho-hint ho-hint--left", text: "Choisis ton camp en secret, puis ton allié. Il ne verra que ta proposition." }));
          pk.push(E("div", { class: "ho-two" }, [
            E("button", { class: "ho-opt" + (G.ui.loyal ? " ho-opt--on" : ""), onclick: () => { G.ui.loyal = true; G.ui.tick = Math.random(); renderAll(); } }, [E("b", { text: "💚 Fidèle" }), E("small", { text: "Si l'autre perd et que tu t'en sors, tu prends une main à sa place. Tu gagnes une carte et un point." })]),
            E("button", { class: "ho-opt ho-opt--bad" + (!G.ui.loyal ? " ho-opt--on" : ""), onclick: () => { G.ui.loyal = false; G.ui.tick = Math.random(); renderAll(); } }, [E("b", { text: "🗡️ Traître" }), E("small", { text: "Si l'autre perd et que tu t'en sors, il perd une main de plus et tu lui voles une carte. Tu portes ensuite une rancune, ta prochaine sanction coûte une main de plus." })])]));
          pk.push(E("div", { class: "ho-targets" }, alive.filter((p) => !p.pact).map((p) => E("button", { class: "ho-pill", onclick: () => Kit.socket.emit("ho:pact", { to: p.id, loyal: !!G.ui.loyal }) }, [dot(p.id), "Proposer à " + nameOf(p.id) + (p.rancune ? " 🗡️" : "")]))));
        }
      }
      pk.push(E("h3", { class: "ho-rules__h", text: "Les règles du pacte" }), E("div", { class: "ho-rules" }, R.PACT_RULES.map((r) => E("div", { class: "ho-rule" }, [E("span", { class: "ho-rule__ic", text: r[0] }), E("p", {}, [E("b", { text: r[1] + ". " }), r[2]])]))));
      items.push(pane("pact", [E("div", { class: "ho-card ho-card--full" }, pk)]));
    }
    return E("div", { class: "ho-grid" }, items);
  }

  // ----- épreuves -----
  const BUILDERS = {};
  function buildPlay(st) {
    const v = st.view; const ch = st.ch; const can = st.amIn; const b = st.brief || {};
    const head = E("div", { class: "ho-playhead" }, [E("b", { text: (b.icon || "") + " " + ch.name }), E("span", { text: b.goal || "" }), !can ? E("span", { class: "ho-ghostbar", text: "👀 Tu regardes cette épreuve." }) : null]);
    const fn = BUILDERS[ch.id];
    return E("div", { class: "ho-col" }, [head, fn && v ? fn(v, st, can) : null]);
  }
  const seats = (st, fn) => E("div", { class: "ho-prog" }, st.part.map((id) => E("span", { class: "ho-seat" }, [dot(id), " " + fn(id) + "   "])));

  BUILDERS.croco = function (v, st, can) {
    const me = st.you; const myTurn = v.turn === me && can; const bite = v.bite;
    const teeth = [...Array(v.teeth).keys()].map((i) => { const pr = v.pressed.find((p) => p.i === i); const isTrap = v.traps && v.traps.includes(i);
      return E("button", { class: "ho-tooth" + (pr ? " ho-tooth--down" : "") + (bite && bite.i === i ? " ho-tooth--bite" : "") + (isTrap && !(bite && bite.i === i) ? " ho-tooth--trap" : ""), disabled: !myTurn || !!pr || !!bite, title: pr ? nameOf(pr.by) : "Dent " + (i + 1), onclick: () => { sTooth(); act({ tooth: i }); } }, [String(i + 1), pr && pr.hint ? E("span", { class: "ho-hot", text: pr.hint }) : null]); });
    if (bite && !G.ui.bit) { G.ui.bit = 1; }
    return E("div", { class: "ho-card ho-card--play" }, [E("div", { class: "ho-turn" + (myTurn ? " ho-turn--me" : ""), text: bite ? "Clac ! " + nameOf(bite.by) + " a perdu une main." : myTurn ? "À toi, touche une dent sur la mâchoire" : "Au tour de " + nameOf(v.turn) }),
      E("div", { class: "ho-teeth ho-teeth--flat" }, teeth),
      E("p", { class: "ho-hint" }, [v.nTraps + " piège" + (v.nTraps > 1 ? "s" : "") + " caché" + (v.nTraps > 1 ? "s" : "") + ", " + v.left + " dents restantes.  Ordre  "].concat(v.order.map((id) => E("span", { class: "ho-seat" + (id === v.turn ? " ho-seat--turn" : "") }, [dot(id), " "]))))]);
  };
  BUILDERS.collision = function (v, st, can) {
    const nums = [...Array(v.n).keys()].map((i) => i + 1);
    return E("div", { class: "ho-card ho-card--play" }, [E("p", { class: "ho-turn", text: v.mine ? "Ta main est posée sur la case " + v.mine + ". Les autres choisissent encore." : "Pose ta main sur une case, sur la table ou ici." }), E("div", { class: "ho-nums" }, nums.map((n) => E("button", { class: "ho-num" + (v.mine === n ? " ho-num--on" : ""), disabled: !can || !!v.mine, onpointerdown: () => act({ n }), text: String(n) }))),
      E("div", { class: "ho-prog" }, ["Mains posées  "].concat(Object.keys(v.chosen).map((id) => dot(id)))), v.all ? E("div", {}, nums.map((n) => { const who = Object.keys(v.all).filter((id) => v.all[id] === n); return who.length ? E("p", { class: "ho-note" }, [E("b", { text: "Case " + n + "  " })].concat(who.map((id) => dot(id))).concat([who.length > 1 ? "  écrasées" : "  seule"])) : null; })) : null]);
  };
  BUILDERS.simon = function (v, st, can) {
    const done = v.prog[st.you] && (v.prog[st.you].fail || v.prog[st.you].done);
    return E("div", { class: "ho-card ho-card--play" }, [E("p", { class: "ho-turn", id: "ho-simon-msg", text: "La lumière baisse, écoute bien" }), E("div", { class: "ho-pads" }, PADS.map((c, k) => E("button", { class: "ho-pad", style: { background: c, color: c }, disabled: !can || !!done, onpointerdown: () => { if (canPick({ k: "bell", i: k })) tapBell(k); } }, [E("span", { text: "🔔 " + (k + 1) })]))),
      E("p", { class: "ho-hint", text: "Touches 1 à 4, ou les clochettes de la table." }), seats(st, (id) => (v.prog[id].fail ? "raté" : v.prog[id].done ? "fini" : v.prog[id].i + " sur " + v.seq.length))]);
  };
  BUILDERS.reflex = function (v, st, can) {
    const mine = v.taps[st.you]; const early = v.early[st.you];
    const label = early ? "Trop tôt, la main était encore en l'air" : mine !== undefined ? "Main retirée en " + mine + " ms" : v.fired ? "RETIRE TA MAIN" : v.chair ? "Ne bouge pas, la musique joue" : "Garde ta main posée";
    return E("div", { class: "ho-card ho-card--play" }, [E("button", { class: "ho-big " + (early || mine !== undefined ? "ho-big--done" : v.fired ? "ho-big--go" : "ho-big--wait"), disabled: !can || early || mine !== undefined, onpointerdown: () => act({ tap: true }), text: label }),
      E("p", { class: "ho-hint", text: "Barre d'espace, ce bouton ou ta main sur la table retirent ta main." }), seats(st, (id) => (v.early[id] ? "trop tôt" : v.taps[id] !== undefined ? v.taps[id] + " ms" : "…")), v.chair ? E("p", { class: "ho-hint", text: "Il y a " + v.chairs + " chaises pour " + st.part.length + " joueurs." }) : null]);
  };
  BUILDERS.stoppile = function (v, st, can) {
    const stopped = v.mine !== null && v.mine !== undefined;
    return E("div", { class: "ho-card ho-card--play" }, [E("div", { class: "ho-bar" }, [E("div", { class: "ho-bar__zone", style: { left: (v.target - v.w) * 100 + "%", width: v.w * 200 + "%" } }), E("div", { class: "ho-bar__cur", id: "ho-cur" })]),
      E("button", { class: "ho-big " + (stopped ? "ho-big--done" : "ho-big--go"), disabled: !can || stopped, onpointerdown: () => act({ stop: true }), text: stopped ? "Arrêté" : "STOP" }),
      seats(st, (id) => (v.errs ? "écart " + Math.round(v.errs[id] * 100) : v.stopped[id] ? "arrêté" : "…"))]);
  };
  BUILDERS.coffre = function (v, st, can) {
    const code = G.ui.code || (G.ui.code = [1, 2, 3]);
    const digits = code.map((d, i) => E("button", { class: "ho-digit", text: String(d), disabled: !can, onclick: () => { code[i] = (code[i] % 6) + 1; hover({ code: code.slice() }); G.ui.tick = Math.random(); renderAll(); } }));
    const others = Object.keys(v.hv || {}).filter((id) => id !== st.you);
    return E("div", { class: "ho-card ho-card--play" }, [E("p", { class: "ho-hint", text: v.code ? "Le code était " + v.code.join(" ") + "." : v.cracked ? nameOf(v.cracked) + " a ouvert le coffre." : "Il reste " + v.left + " essais pour toute l'équipe." }), E("div", { class: "ho-digits" }, digits),
      E("div", { class: "ho-ctrl" }, [E("button", { class: "btn btn--accent", text: "Tenter ce code", disabled: !can || !!v.cracked, onclick: () => { if (new Set(code).size !== 3) return toast("Les trois chiffres doivent être différents."); act({ guess: code.slice() }); } })]),
      others.length ? E("div", { class: "ho-hesit" }, [E("small", { text: "Ce que les autres composent" })].concat(others.map((id) => E("span", { class: "ho-hesit__one" }, [dot(id), " " + v.hv[id].join(" ")])))) : null,
      E("div", { class: "ho-log" }, v.guesses.slice().reverse().map((g) => E("div", { class: "ho-logline" }, [dot(g.by), E("b", { text: g.g.join(" ") }), E("span", { text: g.exact + " bien placé" + (g.exact > 1 ? "s" : "") + ", " + g.near + " ailleurs" })])))]);
  };
  BUILDERS.bombe = function (v, st, can) {
    const outs = Object.keys(v.out);
    return E("div", { class: "ho-card ho-card--play" }, [E("p", { class: "ho-turn", id: "ho-bomb-t", text: v.over ? (v.boom ? "BOUM" : "La mèche s'est éteinte") : "Prêt" }), E("div", { class: "ho-fusebar" }, [E("i", { id: "ho-fuse" }), E("span", { text: "💣" })]),
      E("button", { class: "ho-big " + (v.mineOut || v.over ? "ho-big--done" : "ho-big--go"), disabled: !can || v.mineOut || v.over, onpointerdown: () => act({ out: true }), text: v.mineOut ? "Main retirée" : "Retirer la main" }),
      E("div", { class: "ho-prog" }, ["Mains retirées  "].concat(outs.map((id) => E("span", { class: "ho-seat" }, [dot(id), " " + Math.round(v.out[id] / 100) / 10 + " s  "])))), v.E ? E("p", { class: "ho-hint", text: "La bombe devait exploser à " + Math.round(v.E / 100) / 10 + " secondes." }) : null]);
  };
  function svgHand(up) {
    const fx = [52, 40, 30, 20, 10], fl = [18, 26, 30, 28, 22]; const kids = [];
    kids.push('<rect x="8" y="34" width="40" height="34" rx="10" fill="#f2d2b0"/>');
    up.forEach((u, i) => { if (i === 0) kids.push(u ? '<rect x="44" y="30" width="9" height="22" rx="4" fill="#f2d2b0" transform="rotate(35 48 50)"/>' : ""); else kids.push(u ? '<rect x="' + fx[i] + '" y="' + (36 - fl[i]) + '" width="8" height="' + (fl[i] + 4) + '" rx="4" fill="#f2d2b0"/>' : '<rect x="' + fx[i] + '" y="30" width="8" height="8" rx="4" fill="#e0bc98"/>'); });
    return '<svg viewBox="0 0 62 72" width="48" height="56">' + kids.join("") + "</svg>";
  }
  BUILDERS.coupdoeil = function (v, st, can) {
    const ans = v.mine; const kids = [E("p", { class: "ho-turn", text: "Manche " + (v.qi + 1) + " sur 3  ·  " + (v.choices ? "Combien de doigts levés ?" : "Regarde la table, les mains arrivent") })];
    const fl = E("div", { class: "ho-flash", id: "ho-flash" }); if (v.hands) fl.innerHTML = v.hands.map((h) => svgHand(h.up)).join(""); kids.push(fl);
    if (v.choices) kids.push(E("div", { class: "ho-choices" }, v.choices.map((c, i) => E("button", { class: "ho-choice" + (ans === i ? " ho-choice--on" : ""), disabled: !can || (ans !== undefined && ans !== null), onpointerdown: () => act({ a: i }), text: String(c) }))));
    kids.push(E("div", { class: "ho-prog" }, ["Ont répondu  "].concat(Object.keys(v.answered).map((id) => dot(id)))));
    if (v.past.length) kids.push(E("div", {}, v.past.map((q, i) => E("p", { class: "ho-note", text: "Manche " + (i + 1) + ", il y avait " + q.v + " doigts" + (q.mine === q.ok ? ", bien vu" : q.mine === undefined ? ", pas de réponse" : ", raté") }))));
    return E("div", { class: "ho-card ho-card--play" }, kids);
  };
  BUILDERS.imposteur = function (v, st, can) {
    const kids = [];
    if (v.word) kids.push(E("p", { class: "ho-hint", text: "Ton mot secret" }), E("div", { class: "ho-word", text: cap(v.word) }));
    if (v.phase === "clue") {
      kids.push(E("p", { class: "ho-hint", text: v.myClue !== undefined ? "Indice envoyé, les autres réfléchissent." : "Donne un indice sans trop en dire, un imposteur a un mot voisin." }), E("div", { class: "ho-clues" }, (v.options || []).map((w, i) => E("button", { class: "ho-pill" + (v.myClue === i ? " ho-pill--on" : ""), disabled: !can || v.myClue !== undefined, onclick: () => act({ clue: i }), text: w }))));
    } else if (v.phase === "vote") {
      kids.push(E("p", { class: "ho-hint", text: v.myVote ? "Ton vote est parti." : "Qui est l'imposteur ? Tout le monde voit sur qui tu hésites." }));
      const hv = v.hv || {};
      st.part.forEach((id) => { const watchers = Object.keys(hv).filter((k) => hv[k] === id && k !== st.you);
        kids.push(E("div", { class: "ho-logline ho-voterow" + (G.ui.hv === id ? " ho-voterow--hv" : ""), onpointerenter: () => { if (can && !v.myVote && id !== st.you) { G.ui.hv = id; hover({ hv: id }); } }, onpointerleave: () => { if (G.ui.hv === id) { G.ui.hv = null; hover({ hv: null }); } } }, [dot(id), E("b", { text: nameOf(id) }), E("span", { text: "« " + (v.clues.find((c) => c.by === id) || {}).w + " »" }), E("span", { class: "ho-eyes" }, watchers.map((w) => E("i", { class: "ho-eye", style: { background: hexOf(w) }, title: nameOf(w) + " hésite" }))), id !== st.you ? E("button", { class: "ho-pill" + (v.myVote === id ? " ho-pill--on" : ""), disabled: !can || !!v.myVote, onclick: () => act({ vote: id }), text: "Voter" }) : null])); });
    } else if (v.reveal) kids.push(E("p", { class: "ho-hint", text: "L'imposteur était " + nameOf(v.reveal.imp) + "." }));
    return E("div", { class: "ho-card ho-card--play" }, kids);
  };
  BUILDERS.doigts = function (v, st, can) {
    const n = st.part.length; G.ui.f = G.ui.f === undefined ? 1 : G.ui.f; G.ui.g = G.ui.g === undefined ? Math.round(1.5 * n) : G.ui.g; const locked = !!v.mine;
    return E("div", { class: "ho-card ho-card--play" }, [E("p", { class: "ho-hint", text: locked ? "Verrouillé, tu as levé " + v.mine.f + " doigt(s) et parié sur " + v.mine.g + "." : "Combien de doigts lèves-tu ?" }), E("div", { class: "ho-fing" }, [0, 1, 2, 3].map((k) => E("button", { class: G.ui.f === k ? "on" : "", disabled: !can || locked, onclick: () => { G.ui.f = k; G.ui.tick = Math.random(); renderAll(); }, text: String(k) }))),
      E("p", { class: "ho-hint", text: "Quel sera le total de tous les doigts levés, entre 0 et " + v.max + " ?" }), E("div", { class: "ho-fing" }, [E("button", { disabled: !can || locked, text: "−", onclick: () => { G.ui.g = Math.max(0, G.ui.g - 1); G.ui.tick = Math.random(); renderAll(); } }), E("div", { class: "ho-q", style: { margin: 0 }, text: String(G.ui.g) }), E("button", { disabled: !can || locked, text: "+", onclick: () => { G.ui.g = Math.min(v.max, G.ui.g + 1); G.ui.tick = Math.random(); renderAll(); } })]),
      E("div", { class: "ho-ctrl" }, [E("button", { class: "btn btn--accent", text: "Verrouiller", disabled: !can || locked, onclick: () => act({ f: G.ui.f, g: G.ui.g }) })]),
      E("div", { class: "ho-prog" }, ["Ont verrouillé  "].concat(Object.keys(v.locked).map((id) => dot(id)))), v.reveal ? E("div", {}, [E("p", { class: "ho-hint", text: "Total réel " + v.reveal.sum }), E("div", {}, Object.keys(v.reveal.f).map((id) => E("p", { class: "ho-note" }, [dot(id), " " + nameOf(id) + " levait " + v.reveal.f[id] + " et pariait " + v.reveal.g[id]])))]) : null]);
  };
  BUILDERS.ppc = function (v, st, can) {
    const ICON = ["✊", "✋", "✌️"]; const locked = v.mine !== null && v.mine !== undefined;
    return E("div", { class: "ho-card ho-card--play" }, [E("p", { class: "ho-hint", text: locked ? "Tu as choisi " + v.names[v.mine] + ". Les autres décident encore." : "Choisis en secret." }),
      E("div", { class: "ho-ppc" }, [0, 1, 2].map((k) => E("button", { class: "ho-ppcbtn" + (v.mine === k ? " ho-ppcbtn--on" : ""), disabled: !can || locked, onpointerdown: () => act({ pick: k }) }, [E("span", { class: "ho-ppcbtn__ic", text: ICON[k] }), E("b", { text: v.names[k] })]))),
      E("div", { class: "ho-prog" }, ["Ont choisi  "].concat(Object.keys(v.chosen).map((id) => dot(id)))),
      v.all ? E("div", {}, st.part.map((id) => E("p", { class: "ho-note" }, [dot(id), " " + nameOf(id) + "  " + ICON[v.all[id]] + " " + v.names[v.all[id]] + ", bilan " + (v.bil[id] > 0 ? "+" : "") + v.bil[id]]))) : null]);
  };
  BUILDERS.hot = function (v, st, can) {
    const cells = [...Array(9).keys()].map((k) => E("button", { class: "ho-hotcell", disabled: !can, onpointerdown: () => act({ cell: k }) }, [E("span", { text: "🖐️" })]));
    return E("div", { class: "ho-card ho-card--play" }, [E("p", { class: "ho-turn", id: "ho-hot-msg", text: "Prépare-toi" }), E("div", { class: "ho-hotgrid" }, cells), seats(st, (id) => (v.scores[id] === undefined ? 0 : v.scores[id]) + " pt")]);
  };
  BUILDERS.couteau = function (v, st, can) {
    const P = v.prog[st.you];
    const msg = !can ? "Tu regardes la main de " + nameOf(st.part[0]) + "." : P.fail >= 0 ? "Aïe. Le doigt a sauté au coup " + (P.fail + 1) + "." : P.i >= v.n ? "Tous les coups réussis, quelle précision." : "Coup " + (P.i + 1) + " sur " + v.n + ", frappe l'espace allumé quand le cercle se referme";
    return E("div", { class: "ho-card ho-card--play" }, [E("p", { class: "ho-turn" + (can && P.fail < 0 && P.i < v.n ? " ho-turn--me" : ""), text: msg }),
      E("div", { class: "ho-gaps" }, [E("i", { class: "ho-beatring", id: "ho-beat" })].concat([0, 1, 2, 3].map((g) => E("button", { class: "ho-gapbtn", disabled: !can || P.fail >= 0 || P.i >= v.n, onpointerdown: (ev) => { ev.preventDefault(); knife(g); }, text: String(g + 1) })))),
      E("p", { class: "ho-hint", text: "Touches 1, 2, 3 et 4, les boutons, ou les espaces entre les doigts sur la table." }),
      seats(st, (id) => { const q = v.prog[id]; return q.fail >= 0 ? "doigt perdu au coup " + (q.fail + 1) : q.i >= v.n ? "parfait" : q.i + " coups"; })]);
  };
  BUILDERS.etau = function (v, st, can) {
    const ids = st.part; const btn = E("button", { class: "ho-big ho-hold " + (v.mineOut || v.over ? "ho-big--done" : v.mineHold ? "ho-big--go" : "ho-big--wait"), disabled: !can || v.mineOut || v.over || (v.started && !v.mineHold), text: v.mineOut ? "Main retirée" : v.started ? (v.mineHold ? "Relâche pour retirer ta main" : "Trop tard") : v.mineHold ? "Ta main est posée, garde le bouton" : "Maintiens pour poser ta main" });
    btn.addEventListener("pointerdown", (ev) => { ev.preventDefault(); holdOn(); });
    return E("div", { class: "ho-card ho-card--play" }, [E("p", { class: "ho-turn", id: "ho-etau-msg", text: "" }), E("div", { class: "ho-pressbar" }, [E("i", { id: "ho-press" }), E("span", { text: "Pression de l'étau" })]), btn,
      E("p", { class: "ho-hint", text: "Barre d'espace maintenue ou bouton maintenu. Lâcher retire ta main pour de bon." }),
      seats(st, (id) => (v.crushed && v.crushed.includes(id) ? "écrasé" : v.out[id] !== undefined ? (v.out[id] === 0 ? "jamais posée" : "sortie à " + Math.round(v.out[id] / 100) / 10 + " s") : v.started || v.hold[id] ? "dans l'étau" : "…"))]);
  };
  BUILDERS.gants = function (v, st, can) {
    const me = st.you; const myTurn = v.turn === me && can;
    return E("div", { class: "ho-card ho-card--play" }, [E("div", { class: "ho-turn" + (myTurn ? " ho-turn--me" : ""), text: v.bite ? nameOf(v.bite.by) + " a enfilé le gant piégé." : myTurn ? "À toi, choisis un gant à enfiler" : "Au tour de " + nameOf(v.turn) }),
      E("div", { class: "ho-clue-list" }, v.clues.map((c, i) => E("p", { class: "ho-clue" }, ["🔎 Indice " + (i + 1) + ". " + c]))),
      E("div", { class: "ho-gloves" }, v.gloves.map((g, i) => E("button", { class: "ho-glove" + (g.by ? " ho-glove--gone" : "") + (v.trap === i ? " ho-glove--trap" : ""), disabled: !myTurn || !!g.by, onclick: () => act({ glove: i }) }, [E("i", { class: "ho-glove__sw", style: { background: g.hex } }), E("b", { text: cap(g.name) }), E("small", { text: g.k + ", " + g.h }), g.by ? E("small", {}, [dot(g.by), " " + nameOf(g.by)]) : null]))),
      E("div", { class: "ho-ctrl" }, [E("button", { class: "btn btn--ghost", text: v.passed[me] ? "Passe déjà utilisée" : "Passer mon tour", disabled: !myTurn || !!v.passed[me] || v.left <= 1, onclick: () => act({ pass: true }) })]),
      E("p", { class: "ho-hint" }, ["Ordre  "].concat(v.order.map((id) => E("span", { class: "ho-seat" + (id === v.turn ? " ho-seat--turn" : "") }, [dot(id), v.passed[id] ? " ⏭️ " : " "]))))]);
  };
  BUILDERS.boite = function (v, st, can) {
    const me = st.you; const kids = [];
    if (v.mine) kids.push(E("p", { class: "ho-feel" }, ["🤲 Ta main dans la boîte " + (v.mine.box + 1) + ". ", E("b", { text: v.mine.text })]));
    if (v.phase === "feel") {
      kids.push(E("p", { class: "ho-hint", text: v.myClaim !== null ? "Annonce envoyée. On attend les autres." : "Que dis-tu aux autres sur ta boîte ? Tu peux mentir." }));
      kids.push(E("div", { class: "ho-claims" }, v.names.map((n, k) => E("button", { class: "ho-pill ho-pill--big ho-claim--" + k + (v.myClaim === k ? " ho-pill--on" : ""), disabled: !can || v.myClaim !== null, onclick: () => act({ claim: k }) }, [n]))));
      kids.push(E("div", { class: "ho-prog" }, ["Ont annoncé  "].concat(Object.keys(v.claimed).map((id) => dot(id)))));
    } else {
      const myTurn = v.turn === me && can; const free = v.free || [];
      kids.push(E("div", { class: "ho-turn" + (myTurn ? " ho-turn--me" : ""), text: v.bite ? nameOf(v.bite.by) + " s'est fait mordre dans la boîte " + (v.bite.box + 1) + "." : v.phase === "reveal" ? "Personne n'a été mordu." : myTurn ? "À toi, plonge la main dans une boîte" : "Au tour de " + nameOf(v.turn) }));
      kids.push(E("div", { class: "ho-boxes" }, [...Array(v.nb).keys()].map((b) => { const cl = (v.claims || []).find((c) => c.box === b); const by = v.picks[b];
        return E("button", { class: "ho-boxbtn" + (by ? " ho-boxbtn--taken" : "") + (v.trap === b ? " ho-boxbtn--trap" : ""), disabled: !myTurn || !free.includes(b), onclick: () => act({ box: b }) }, [E("b", { text: "📦 " + (b + 1) }), cl ? E("small", { class: "ho-claim--" + cl.k }, [dot(cl.by), " " + v.names[cl.k]]) : E("small", { text: "personne ne l'a sentie" }), v.mine && v.mine.box === b ? E("small", { text: "ta boîte" }) : null, by ? E("small", {}, ["✋ ", dot(by)]) : null, v.contents ? E("small", { class: "ho-content", text: v.contents[b] }) : null]); })));
      kids.push(E("p", { class: "ho-hint" }, ["Ordre  "].concat(v.order.map((id) => E("span", { class: "ho-seat" + (id === v.turn ? " ho-seat--turn" : "") }, [dot(id), " "])))));
    }
    return E("div", { class: "ho-card ho-card--play" }, kids);
  };

  // ----- le bistouri, un petit jeu de précision dessiné dans un canevas -----
  const BIS_LAYOUTS = [
    { objs: [["heart", "un cœur en mousse"], ["key", "une clé rouillée"], ["bone", "un os de poulet"]], paths: [[[205, 175], [250, 150], [300, 190], [345, 160], [395, 120], [450, 95], [560, 95]], [[215, 285], [265, 312], [320, 288], [380, 325], [440, 300], [560, 318]], [[335, 225], [380, 245], [420, 210], [470, 228], [500, 200], [560, 205]]] },
    { objs: [["coin", "une pièce"], ["die", "un dé"], ["candy", "un bonbon"]], paths: [[[190, 160], [230, 120], [290, 135], [330, 100], [400, 125], [560, 110]], [[260, 230], [300, 260], [350, 230], [400, 265], [455, 235], [560, 240]], [[220, 305], [280, 330], [340, 300], [400, 340], [470, 320], [560, 335]]] },
    { objs: [["bone", "un os de poulet"], ["coin", "une pièce"], ["heart", "un cœur en mousse"]], paths: [[[180, 150], [220, 190], [280, 160], [320, 200], [380, 160], [440, 190], [560, 165]], [[300, 255], [330, 215], [380, 250], [420, 215], [470, 250], [560, 250]], [[230, 320], [290, 300], [340, 335], [410, 300], [470, 330], [560, 315]]] },
  ];
  function pathLen(p) { let L = 0; for (let i = 1; i < p.length; i++) L += Math.hypot(p[i][0] - p[i - 1][0], p[i][1] - p[i - 1][1]); return L; }
  function nearest(p, x, y) { let best = { d: 1e9, s: 0 }; let acc = 0; const L = pathLen(p); for (let i = 1; i < p.length; i++) { const ax = p[i - 1][0], ay = p[i - 1][1], bx = p[i][0], by = p[i][1]; const dx = bx - ax, dy = by - ay; const sl = Math.hypot(dx, dy); let u = ((x - ax) * dx + (y - ay) * dy) / (sl * sl); u = Math.max(0, Math.min(1, u)); const px = ax + u * dx, py = ay + u * dy; const d = Math.hypot(x - px, y - py); if (d < best.d) best = { d, s: (acc + u * sl) / L }; acc += sl; } return best; }
  const halfW = (s) => 17 - 7 * s;
  function bisEnsure(v) {
    if (G.bis && G.bis.round === G.st.round) return G.bis;
    const cv = document.createElement("canvas"); cv.width = 600; cv.height = 400; cv.className = "ho-bis"; const lay = BIS_LAYOUTS[v.lay] || BIS_LAYOUTS[0];
    cv.addEventListener("pointerdown", bisDown);
    G.bis = { round: G.st.round, cv, lay, pos: lay.paths.map((p) => p[0].slice()), drag: null, got: [], strikes: 0, noseAt: 0, last: null }; if (S.ready) S.patient = cv; return G.bis;
  }
  function bisXY(ev) { const r = G.bis.cv.getBoundingClientRect(); return [((ev.clientX - r.left) / r.width) * 600, ((ev.clientY - r.top) / r.height) * 400]; }
  function bisLive() { const st = G.st; if (!playing() || st.ch.id !== "bistouri") return false; const v = st.view; const P = v.prog[st.you]; const t = snow(); return P && !P.out && !P.done && t >= v.t0 && t <= v.ends; }
  function bisDown(ev) {
    const B = G.bis; if (!B || !bisLive()) return; const [x, y] = bisXY(ev); const P = G.st.view.prog[G.st.you];
    for (let k = 0; k < 3; k++) { if (P.got.includes(k) || B.got.includes(k)) continue; const o = B.pos[k]; if (Math.hypot(x - o[0], y - o[1]) < 24) { B.drag = k; B.last = [x, y]; ev.preventDefault(); afx("pluck"); return; } }
  }
  function bisMove(ev) {
    const B = G.bis; if (!B || B.drag === null) return; if (!bisLive()) { B.drag = null; return; } const [x, y] = bisXY(ev); const k = B.drag; const path = B.lay.paths[k];
    const steps = Math.max(1, Math.ceil(Math.hypot(x - B.last[0], y - B.last[1]) / 4));
    for (let i = 1; i <= steps; i++) { const px = B.last[0] + ((x - B.last[0]) * i) / steps, py = B.last[1] + ((y - B.last[1]) * i) / steps; const n = nearest(path, px, py); if (n.d > halfW(n.s)) { B.drag = null; B.pos[k] = path[0].slice(); B.noseAt = performance.now(); afx("buzz"); act({ touch: true }); if (S.ready) S.shake(0.25); return; } }
    B.last = [x, y]; B.pos[k] = [x, y]; const n = nearest(path, x, y); if (n.s > 0.97) { B.drag = null; B.got.push(k); afx("pluck"); act({ got: k }); }
  }
  function bisUp() { const B = G.bis; if (!B || B.drag === null) return; B.pos[B.drag] = B.lay.paths[B.drag][0].slice(); B.drag = null; }
  function drawObj(x, c, cx, cy, kind, s) {
    x.save(); x.translate(cx, cy); x.scale(s, s); x.lineWidth = 2; x.strokeStyle = "#2a1219";
    if (kind === "heart") { x.fillStyle = "#e63946"; x.beginPath(); x.moveTo(0, 9); x.bezierCurveTo(-16, -2, -9, -14, 0, -6); x.bezierCurveTo(9, -14, 16, -2, 0, 9); x.fill(); x.stroke(); }
    else if (kind === "key") { x.fillStyle = "#c9a46a"; x.beginPath(); x.arc(-7, 0, 6, 0, 7); x.fill(); x.stroke(); x.fillRect(-2, -2, 15, 4); x.fillRect(9, 2, 3, 4); }
    else if (kind === "bone") { x.fillStyle = "#f4ead2"; x.fillRect(-9, -3, 18, 6); [[-10, -3], [-10, 3], [10, -3], [10, 3]].forEach((p) => { x.beginPath(); x.arc(p[0], p[1], 4, 0, 7); x.fill(); }); }
    else if (kind === "coin") { x.fillStyle = "#ffd23f"; x.beginPath(); x.arc(0, 0, 9, 0, 7); x.fill(); x.stroke(); }
    else if (kind === "die") { x.fillStyle = "#ffffff"; x.fillRect(-8, -8, 16, 16); x.strokeRect(-8, -8, 16, 16); x.fillStyle = "#111"; [[-4, -4], [4, 4], [0, 0]].forEach((p) => { x.beginPath(); x.arc(p[0], p[1], 1.8, 0, 7); x.fill(); }); }
    else { x.fillStyle = "#ff6fb5"; x.beginPath(); x.arc(0, 0, 7, 0, 7); x.fill(); x.stroke(); x.beginPath(); x.moveTo(-7, 0); x.lineTo(-13, -5); x.lineTo(-13, 5); x.fill(); x.beginPath(); x.moveTo(7, 0); x.lineTo(13, -5); x.lineTo(13, 5); x.fill(); }
    x.restore();
  }
  function bisDraw(v, t) {
    const B = G.bis; if (!B) return; const x = B.cv.getContext("2d"); const P = v.prog[G.st.you] || { got: [], strikes: 0 };
    x.fillStyle = "#d8c9a8"; x.fillRect(0, 0, 600, 400);
    // le patient en carton
    x.fillStyle = "#f0d9b5"; x.strokeStyle = "#7a4a2a"; x.lineWidth = 4; x.beginPath(); x.arc(95, 210, 62, 0, 7); x.fill(); x.stroke();
    x.beginPath(); x.moveTo(150, 120); x.quadraticCurveTo(160, 92, 230, 92); x.lineTo(500, 92); x.quadraticCurveTo(545, 92, 545, 140); x.lineTo(545, 290); x.quadraticCurveTo(545, 345, 500, 345); x.lineTo(230, 345); x.quadraticCurveTo(160, 345, 150, 310); x.closePath(); x.fill(); x.stroke();
    const red = performance.now() - B.noseAt < 600; x.fillStyle = red ? "#ff2a3a" : "#c45a5a"; x.beginPath(); x.arc(70, 215, 13, 0, 7); x.fill(); if (red) { x.fillStyle = "rgba(255,40,60,0.35)"; x.beginPath(); x.arc(70, 215, 26, 0, 7); x.fill(); }
    x.fillStyle = "#3a2010"; x.beginPath(); x.arc(78, 186, 5, 0, 7); x.arc(112, 186, 5, 0, 7); x.fill(); x.strokeStyle = "#3a2010"; x.lineWidth = 3; x.beginPath(); x.arc(98, 240, 16, 0.2, Math.PI - 0.2); x.stroke();
    // le plateau à droite
    x.fillStyle = "#b9c3cc"; x.fillRect(555, 60, 40, 300); x.strokeStyle = "#6a737c"; x.lineWidth = 2; x.strokeRect(555, 60, 40, 300);
    B.lay.paths.forEach((p, k) => {
      const L = pathLen(p); const N = 40; x.lineCap = "round"; x.lineJoin = "round";
      for (let pass = 0; pass < 2; pass++) { let acc = 0; for (let i = 1; i < p.length; i++) { const sl = Math.hypot(p[i][0] - p[i - 1][0], p[i][1] - p[i - 1][1]); const s = (acc + sl / 2) / L; x.strokeStyle = pass ? "#5a1a22" : "#2a0a10"; x.lineWidth = (halfW(s) * 2 + (pass ? 0 : 6)); x.beginPath(); x.moveTo(p[i - 1][0], p[i - 1][1]); x.lineTo(p[i][0], p[i][1]); x.stroke(); acc += sl; } }
      void N;
    });
    const got = new Set(P.got.concat(B.got));
    B.lay.objs.forEach((o, k) => { if (got.has(k)) { drawObj(x, B.cv, 575, 110 + k * 90, o[0], 1.2); return; } const pos = B.pos[k]; drawObj(x, B.cv, pos[0], pos[1], o[0], B.drag === k ? 1.25 : 1.1); if (B.drag !== k && bisLive()) { x.strokeStyle = "rgba(255,210,63,0.8)"; x.lineWidth = 2; x.beginPath(); x.arc(pos[0], pos[1], 20 + Math.sin(t / 200) * 2, 0, 7); x.stroke(); } });
    x.fillStyle = "#2a1219"; x.font = "bold 22px Fredoka, sans-serif"; x.textAlign = "left"; x.fillText("Fautes " + "❌".repeat(P.strikes) + "◻️".repeat(Math.max(0, 3 - P.strikes)), 14, 30);
    x.textAlign = "right"; x.fillText(t < v.t0 ? "Prépare ta pince" : P.out ? "Exclu de l'opération" : P.done ? "Opération réussie" : secs(v.ends - t) + " s", 586, 30);
  }
  BUILDERS.bistouri = function (v, st, can) {
    const B = bisEnsure(v); const P = v.prog[st.you];
    return E("div", { class: "ho-card ho-card--play" }, [E("p", { class: "ho-turn", text: !can ? "Tu regardes l'opération." : P.out ? "Trois fautes, tu es exclu." : P.done ? "Les trois objets sont sortis." : "Attrape un objet et fais-le glisser jusqu'au plateau à droite, sans toucher les bords" }), B.cv,
      seats(st, (id) => { const q = v.prog[id]; return q.got.length + " sur 3" + (q.strikes ? ", " + q.strikes + " faute" + (q.strikes > 1 ? "s" : "") : "") + (q.out ? ", exclu" : ""); }), v.scores ? E("p", { class: "ho-hint", text: "Scores  " + st.part.map((id) => nameOf(id) + " " + v.scores[id]).join(", ") }) : null]);
  };

  // ----- jugement -----
  function revealText(st, J) {
    const r = J.reveal || {}; const id = J.id;
    if (id === "croco") return r.bite ? "Dent " + (r.bite.i + 1) + " piégée, " + nameOf(r.bite.by) + " a été mordu." : "";
    if (id === "coffre") return "Le code était " + (r.code || []).join(" ") + (r.cracked ? ", ouvert par " + nameOf(r.cracked) + "." : ", personne n'a réussi.");
    if (id === "bombe") return (r.boom ? "Boum. " : "Personne n'est resté. ") + "La bombe devait exploser à " + Math.round(r.E / 100) / 10 + " secondes.";
    if (id === "imposteur") return "L'imposteur était " + nameOf(r.imp) + (r.caught ? ", il est démasqué." : ", il s'en sort.");
    if (id === "reflex") return Object.keys(r.taps).length ? "Main la plus rapide, " + Math.round(Math.min.apply(null, Object.values(r.taps))) + " ms." : "Personne n'a retiré sa main.";
    if (id === "stoppile") return "Zone visée à " + Math.round(r.target * 100) + " sur 100.";
    if (id === "collision") return Object.keys(r.groups).filter((k) => r.groups[k].length > 1).map((k) => "Case " + k + ", les mains de " + r.groups[k].map(nameOf).join(" et ") + " s'écrasent").join(". ") || "Aucune main ne se croise.";
    if (id === "doigts") return "Le total était " + r.sum + ".";
    if (id === "ppc") return Object.keys(r.bil).map((k) => nameOf(k) + " " + r.names[r.pick[k]] + " (" + (r.bil[k] > 0 ? "+" : "") + r.bil[k] + ")").join(", ") + ".";
    if (id === "hot") return Object.keys(r.score).map((k) => nameOf(k) + " " + r.score[k] + " pt").join(", ") + ".";
    if (id === "coupdoeil") return "Il y avait " + (r.vals || []).join(", puis ") + " doigts levés.";
    if (id === "couteau") return Object.keys(r.prog || {}).map((k) => nameOf(k) + (r.prog[k].fail >= 0 ? " perd un doigt au coup " + (r.prog[k].fail + 1) : " tient jusqu'au bout")).join(", ") + ".";
    if (id === "etau") return r.crushed && r.crushed.length ? "L'étau s'est fermé sur " + r.crushed.map(nameOf).join(" et ") + "." : "Personne n'a été écrasé, l'étau aurait tenu jusqu'à " + r.Pc + " pour cent.";
    if (id === "gants") return r.bite ? "Le gant " + r.name + " cachait le piège, " + nameOf(r.bite.by) + " l'a enfilé." : "";
    if (id === "boite") return (r.bite ? nameOf(r.bite.by) + " s'est fait mordre dans la boîte " + (r.bite.box + 1) + "." : "La boîte piégée est restée fermée.") + (r.liar ? " " + nameOf(r.liar) + " l'avait sentie et a juré qu'elle était sans danger." : "") + " Dedans, " + (r.contents || []).map((c, i) => (i + 1) + " " + c).join(", ") + ".";
    if (id === "bistouri") return Object.keys(r.scores || {}).map((k) => nameOf(k) + " " + r.scores[k] + " pt").join(", ") + ".";
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
    if (J.best) kids.push(E("p", { class: "ho-note", text: "Meilleur de l'épreuve, " + nameOf(J.best) + (st.cardsOn ? ", il pioche une carte." : ".") }));
    const fx = pactCards(st, J); const spoken = new Set(); const notes = [];
    J.notes.forEach((n) => { if (!spoken.has(n)) { spoken.add(n); notes.push(E("p", { class: "ho-note", text: n })); } });
    const items = [E("div", { class: "ho-card" }, kids)];
    if (notes.length) items.push(E("div", { class: "ho-card" }, [E("h3", { text: "Ce qui s'est passé" })].concat(notes)));
    return E("div", { class: "ho-grid" }, items.concat(fx));
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
  Kit.on("room", (r) => { if (r.status === "lobby") { G.st = null; G.over = null; G.lastKey = ""; G.sig = ""; G.judgeFor = -1; if (S.ready) { S.clearTrial(); S.hold(false); } } });
  function attach() { const so = Kit.socket; if (!so || G.attached) return; G.attached = true; so.on("ho:state", onState); so.on("ho:over", onOver); so.on("ho:go", () => { G.ui = {}; }); so.on("ho:fx", (d) => { if (S.ready && d && d.a) S.pulse(d.a); }); }

  Kit.init({
    id: "hands-over", hero: true, title: "Main Morte", emoji: "🖐️", ribbon: "Le jeu télé où l'on perd des mains", tagline: "Lis les règles, scelle des pactes, trahis si tu l'oses.",
    createLabel: "Ouvrir le plateau", soloLabel: "Jouer contre des robots", startLabel: "Lancer l'émission", helpTitle: "Comment jouer",
    floaters: [{ e: "🖐️", x: 6 }, { e: "🐊", x: 20 }, { e: "🎬", x: 36 }, { e: "👻", x: 50 }, { e: "🃏", x: 64 }, { e: "🔪", x: 78 }, { e: "🎭", x: 92 }],
    colors: COLORS, botLevels: [{ id: "figurant", label: "Figurant" }, { id: "candidat", label: "Candidat" }, { id: "veteran", label: "Vétéran" }], maxPlayers: 8, minPlayers: 2, schema: R.SCHEMA,
    help: [
      { title: "Le principe", text: "Tu participes à une émission de télévision cruelle. À chaque épreuve, un ou plusieurs joueurs perdent une main. Sans main, on devient fantôme, mais on peut revenir. Le dernier joueur qui a encore ses mains gagne." },
      { title: "Le déroulement d'un tour", text: "Un tour a quatre temps. D'abord la lecture des règles, avec le temps qu'il faut et un bouton prêt pour chacun. Ensuite les cartes et les pactes. Puis un compte à rebours de trois secondes. Enfin l'épreuve, assis à la table, et le verdict." },
      { title: "La table", text: "Pendant une épreuve, tu vois la table depuis ta place, tes mains posées devant toi. Tu peux cliquer sur la mâchoire du crocodile, les clochettes, les cases, les gants ou les boîtes. Le panneau du bas fait la même chose." },
      { title: "Les épreuves", text: "Crocodile dentiste, collision des mains, clochettes des ténèbres, main géante, arrêt de curseur, coffre à code, bombe à mèche, coup d'œil, imposteur, jeu des doigts, duel des mains, main chaude, couteau entre les doigts, étau, gants piégés, boîte noire et bistouri. Chaque épreuve affiche son objectif, ses commandes et ce qui fait perdre avant de commencer." },
      { title: "Les cartes", text: "Neuf cartes, chacune indique quand la jouer, ce qu'elle fait et ce qu'elle risque. Bouclier, miroir, cible, double ou rien, vol, alarme, leurre, espion et absolution. Tout le monde voit la carte que tu joues, mais le leurre ment. On en gagne en remportant une épreuve." },
      { title: "Les pactes et la trahison", text: "Un pacte lie deux joueurs pour une épreuve. Chacun choisit en secret d'être fidèle ou traître. Il ne se joue que si l'un perd et que l'autre s'en sort. Un fidèle prend une main à la place de son allié et pioche une carte. Un traître fait perdre une main de plus à son allié et lui vole une carte, mais il porte une rancune qui lui coûtera une main de plus." },
      { title: "Les fantômes", text: "Un fantôme reste assis à sa place, translucide, et joue encore aux épreuves qui l'autorisent. S'il gagne, il marque le joueur le plus riche en mains. S'il gagne deux fois, il revient parmi les vivants avec une main et une carte." },
      { title: "Les modes", text: "Classique, survie, équipes, tournoi sans élimination, express, chaos avec une règle folle à chaque tour et personnalisé pour tout régler soi-même. Chaque mode existe en version courte, normale ou longue." },
    ],
    theme: { a1: "#e63946", a2: "#ffd23f", bg1: "#4a0a14", bg2: "#12060a" },
    onInit() { build(); attach(); Kit.on("connect", attach); },
  });
})();

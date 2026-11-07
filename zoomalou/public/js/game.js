// ============================================================
// ZOOMALOU — Interface de jeu, pilotage local et réseau (client)
// ============================================================
(function () {
  const { el, $, toast, sound, store } = Kit;
  const ZR = ZoomRules, TR = ZoomTrack, CA = ZoomCar, V = ZoomView;
  const COLORS = [
    { name: "Rouge", hex: "#e8453c" }, { name: "Bleu", hex: "#2f78d1" }, { name: "Vert", hex: "#3aa653" }, { name: "Jaune", hex: "#f2c230" },
    { name: "Violet", hex: "#8a55c8" }, { name: "Orange", hex: "#f08a24" }, { name: "Rose", hex: "#ee6fb0" }, { name: "Turquoise", hex: "#25b9b0" },
  ];
  const LEVELS = [{ id: "debutant", label: "Pilote du dimanche" }, { id: "moyen", label: "Habitué" }, { id: "champion", label: "Champion" }, { id: "prodige", label: "Prodige" }];
  const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
  const hexOf = (c) => COLORS[(c || 0) % COLORS.length].hex;
  const fmt = (t) => (t == null ? "-" : t.toFixed(2).replace(".", ","));
  const fmtS = (t) => fmt(t) + " s";

  const G = {
    track: null, roundIdx: -1, total: 0, mode: "essence", st: null, turn: null, record: null, author: 0, carId: "bolide", botPlan: null, samples: [], offset: 0, order: [],
    run: null, keys: {}, touch: {}, rstReq: false, snaps: {}, viewInit: false, myBest: null, myBestFrames: null, ghostFrames: null, ghostCar: "bolide", ghostT0: 0, ghostPtr: 0,
    autoArm: 0, wantArm: false, armedAt: 0, lastFeed: [], sheet: null, endInfo: null, lastTurnKey: "", waiting: false, prev: { seed: "", idx: 0, key: "", track: null }, lastMini: 0, lastDom: 0,
    cpBanner: 0, lastState: "", slots: {},
  };
  const isChrono = (m) => m === "chrono" || m === "contact";
  const snow = () => Date.now() + G.offset;
  const S = () => (Kit.room && Kit.room.settings) || ZR.defaults();
  const myId = () => { const p = Kit.me(); return p ? p.id : null; };
  const stP = (id) => (G.st ? G.st.players.find((p) => p.id === id) : null);
  const me = () => stP(myId());
  const nameOf = (id) => { const p = stP(id); return p ? p.name : "?"; };
  const clock = (n) => { G.samples.push(n - Date.now()); if (G.samples.length > 12) G.samples.shift(); G.offset = Math.max.apply(null, G.samples); };

  // ---------- son du moteur ----------
  // chaque voiture a son moteur. f0 fréquence au ralenti, gears nombre de rapports, rough moteur qui cogne, wobble moteur qui ondule, whistle sifflement de turbine
  const ENGINE = {
    bolide: { w: "sawtooth", f0: 44, cut: 760, g: 0.03, gears: 5, sub: 0.45 },
    rallye: { w: "square", f0: 36, cut: 520, g: 0.022, gears: 5, rough: 0.55, sub: 0.3 },
    petard: { w: "sawtooth", f0: 58, cut: 1300, g: 0.026, gears: 6, whistle: 0.9 },
    toupie: { w: "triangle", f0: 74, cut: 950, g: 0.045, gears: 4, wobble: 1 },
    bouboule: { w: "sine", f0: 52, cut: 620, g: 0.06, gears: 3, wobble: 0.55, sub: 0.6 },
    mastodonte: { w: "square", f0: 24, cut: 340, g: 0.03, gears: 7, rough: 1, sub: 0.8 },
    libellule: { w: "triangle", f0: 96, cut: 1500, g: 0.032, gears: 4, wobble: 0.25 },
    volt: { w: "sine", f0: 110, cut: 3200, g: 0.03, gears: 1, whistle: 0.6 },
    sauterelle: { w: "square", f0: 82, cut: 1050, g: 0.018, gears: 4, rough: 0.3 },
    comete: { w: "sawtooth", f0: 54, cut: 1100, g: 0.026, gears: 5, whistle: 0.7, sub: 0.3 },
  };
  const eng = { ctx: null, car: null };
  function engineStart() {
    if (eng.ctx || !sound.enabled) return;
    try { const ctx = new (window.AudioContext || window.webkitAudioContext)(); const out = ctx.createGain(); out.gain.value = 0; out.connect(ctx.destination); eng.ctx = ctx; eng.out = out; } catch (e) { /* pas de son */ }
  }
  function engineBuild(carId) {
    if (!eng.ctx || eng.car === carId) return; const ctx = eng.ctx; const P = ENGINE[carId] || ENGINE.bolide;
    (eng.nodes || []).forEach((nd) => { try { nd.stop && nd.stop(); nd.disconnect(); } catch (e) { /* rien */ } }); eng.nodes = [];
    const filt = ctx.createBiquadFilter(); filt.type = "lowpass"; filt.frequency.value = P.cut; const mix = ctx.createGain(); mix.gain.value = 1; filt.connect(mix); mix.connect(eng.out);
    const osc = ctx.createOscillator(); osc.type = P.w; osc.connect(filt); osc.start(); eng.nodes.push(osc, filt, mix); eng.osc = osc; eng.filt = filt; eng.P = P; eng.car = carId;
    if (P.sub) { const o2 = ctx.createOscillator(); o2.type = "sine"; const g2 = ctx.createGain(); g2.gain.value = P.sub; o2.connect(g2); g2.connect(filt); o2.start(); eng.sub = o2; eng.nodes.push(o2, g2); } else eng.sub = null;
    if (P.whistle) { const o3 = ctx.createOscillator(); o3.type = "sine"; const g3 = ctx.createGain(); g3.gain.value = 0.05 * P.whistle; o3.connect(g3); g3.connect(eng.out); o3.start(); eng.wh = o3; eng.nodes.push(o3, g3); } else eng.wh = null;
    if (P.rough || P.wobble) { const lfo = ctx.createOscillator(); lfo.type = P.rough ? "square" : "sine"; lfo.frequency.value = P.rough ? 16 : 5; const lg = ctx.createGain(); lg.gain.value = P.rough ? 0.45 * P.rough : 0; lfo.connect(lg); lg.connect(mix.gain); if (P.wobble) { const fg = ctx.createGain(); fg.gain.value = 6 * P.wobble; lfo.connect(fg); fg.connect(osc.frequency); eng.nodes.push(fg); } lfo.start(); eng.lfo = lfo; eng.nodes.push(lfo, lg); } else eng.lfo = null;
  }
  function engineUpdate(speed, active, carId) {
    if (!eng.ctx) return; engineBuild(carId || G.carId || "bolide"); const t = eng.ctx.currentTime; const P = eng.P; const car = CA.CARS[carId] || CA.CARS.bolide;
    const span = car.vmax * 1.1 / P.gears; const gear = Math.min(P.gears - 1, Math.floor(speed / span)); const rpm = P.gears === 1 ? speed / (car.vmax * 1.2) : 0.3 + 0.7 * clamp((speed - gear * span) / span, 0, 1);
    const f = P.f0 * (1 + 1.8 * rpm) * (1 + 0.07 * gear);
    eng.osc.frequency.setTargetAtTime(f, t, 0.04); if (eng.sub) eng.sub.frequency.setTargetAtTime(f / 2, t, 0.04); if (eng.wh) eng.wh.frequency.setTargetAtTime(f * 7, t, 0.06); if (eng.lfo && P.rough) eng.lfo.frequency.setTargetAtTime(8 + rpm * 22, t, 0.1);
    eng.filt.frequency.setTargetAtTime(P.cut * (0.55 + rpm * 0.9), t, 0.05);
    eng.out.gain.setTargetAtTime(active && sound.enabled ? P.g * (0.75 + 0.45 * Math.min(1, speed / 40)) : 0, t, 0.1);
  }

  // ---------- squelette ----------
  function buildGame() {
    const sc = $("#screen-game"); sc.innerHTML = "";
    sc.appendChild(el("div", { id: "gl-host" }));
    const hud = el("div", { class: "hud", id: "hud" }, [
      el("div", { class: "pill z-top nopoint" }, [el("div", { id: "z-time", class: "z-time" }), el("div", { id: "z-sub", class: "z-sub" })]),
      el("div", { id: "z-rec", class: "pill z-rec nopoint" }),
      el("div", { class: "pill z-mini nopoint" }, [el("canvas", { id: "z-mini", width: 260, height: 260 })]),
      el("div", { id: "z-board", class: "pill z-board" }),
      el("div", { id: "z-fuel", class: "pill z-fuel nopoint hidden" }),
      el("div", { id: "z-fx", class: "z-fx nopoint" }),
      el("div", { id: "z-race", class: "pill z-race nopoint hidden" }),
      el("div", { id: "z-retro", class: "pill z-retro nopoint hidden", text: "Rétroviseur" }),
      el("div", { id: "z-lights", class: "z-lights nopoint hidden" }, [0, 1, 2, 3, 4].map(() => el("i"))),
      el("div", { id: "z-speed", class: "pill z-speed nopoint" }, [el("div", { class: "z-kmh" }, [el("b", { id: "z-kmh", text: "0" }), el("span", { text: "km/h" })]), el("div", { class: "z-gauges" }, [el("div", { class: "z-drift", id: "z-drift" }, [el("i"), el("i"), el("i")]), el("div", { class: "z-boost" }, [el("i", { id: "z-boost" })]), el("span", { class: "z-tag hidden", id: "z-draft", text: "Aspiration" }), el("div", { class: "z-batt hidden", id: "z-batt" }, [el("i")])])]),
      el("div", { id: "z-spec", class: "pill z-spec hidden" }, [el("button", { class: "round-btn", id: "spec-prev", text: "◀" }), el("span", { id: "spec-name" }), el("button", { class: "round-btn", id: "spec-next", text: "▶" })]),
      el("div", { id: "z-replay", class: "pill z-replaybar hidden" }),
      el("div", { id: "z-center", class: "z-center nopoint" }),
      el("div", { id: "z-feed", class: "z-feed nopoint" }),
      el("div", { id: "z-tip", class: "z-tip nopoint" }),
      el("div", { class: "z-menu" }, [
        el("button", { class: "round-btn", id: "btn-menu", title: "Menu et commandes", text: "⚙️" }),
        el("button", { class: "round-btn", id: "btn-cam", title: "Changer de caméra", text: "🎥" }),
        el("button", { class: "round-btn", id: "btn-restart", title: "Recommencer l'essai", text: "↺" }),
        el("button", { class: "round-btn", id: "btn-respawn", title: "Revenir au dernier point de contrôle", text: "📍" }),
        el("button", { class: "round-btn", id: "btn-back", title: "Regarder derrière, maintenir appuyé", text: "🪞" }),
      ]),
      el("button", { class: "btn btn--danger btn--small z-giveup hidden", id: "btn-giveup", text: "Abandonner" }),
      el("div", { class: "touch touch--l" }, [el("button", { id: "t-left", text: "◀" }), el("button", { id: "t-right", text: "▶" })]),
      el("div", { class: "touch touch--r" }, [el("button", { id: "t-gas", text: "⛽" }), el("button", { id: "t-brake", text: "🛑" })]),
      el("div", { id: "garage", class: "garage hidden" }),
    ]);
    sc.appendChild(hud); sc.appendChild(el("div", { id: "sheet", class: "sheet hidden" }));
    if ("ontouchstart" in window || /[?&]touch/.test(location.search)) document.body.classList.add("has-touch");
    wireInput();
  }

  // ---------- manche et circuit ----------
  function autoQuality() { return (window.innerWidth < 760 || /Mobi|Android/i.test(navigator.userAgent)) ? "low" : "medium"; }
  function onRound(m) {
    clock(m.now);
    if (!G.viewInit) { V.init($("#gl-host"), store.get("zoom.quality", autoQuality())); G.viewInit = true; V.paused = false; V.onFrame = onFrame; }
    G.track = m.track; G.roundIdx = m.index; G.total = m.total; G.mode = m.mode; G.author = m.author; G.carId = m.car || G.carId; G.botPlan = null; G.order = m.order || []; G.slots = m.slots || {};
    G.run = null; G.myBest = null; G.myBestFrames = null; G.ghostFrames = null; G.record = null; G.snaps = {}; G.bufs = {}; G.off = {}; G.turn = null; G.wantArm = false; G.armedAt = 0; G.waiting = false; G.specId = null; G.replay = null; hideReplayBar();
    closeSheet(); V.loadTrack(G.track); V.resize(); V.removeAllCars(); setBanner("Course " + (m.index + 1) + " sur " + m.total, G.track.name + " · " + TR.BIOMES[G.track.biome].name + (G.track.drawn && G.track.drawn.length ? " · " + G.track.drawn.join(", ") : ""), 3400);
  }
  function onRecord(m) {
    G.record = { time: m.time, pid: m.pid, car: m.car, frames: m.frames }; if (!isChrono(G.mode)) { G.ghostFrames = m.frames; G.ghostCar = m.car; G.ghostPtr = 0; }
  }
  function onTurn(m) {
    if (!m) return; clock(m.now); G.turn = m; G.run = null; G.wantArm = false; G.armedAt = 0; G.waiting = false;
    if (m.record) { G.record = m.record; G.ghostFrames = m.record.frames; G.ghostCar = m.record.car; G.ghostPtr = 0; }
    if (m.pid === myId()) { setBanner("À toi de jouer", m.role === "open" ? "Pose ton temps" : "Tu es dernier. Bats " + nameOf(m.record.pid) + " et ses " + fmtS(m.record.time) + " avec " + Math.round(m.fuel) + " s d'essence", 2800); sound.tone(660, 0.15, "triangle", 0.1); sound.tone(880, 0.2, "triangle", 0.1, 0.12); }
    else setBanner("Au tour de " + nameOf(m.pid), m.role === "open" ? "Il pose son temps" : "Il est dernier et a " + Math.round(m.fuel) + " s d'essence", 2600);
    V.resetGates();
  }

  // ---------- état ----------
  function onState(s) {
    clock(s.now); const old = G.st; G.st = s; { const mine = (s.players || []).find((q) => q.id === myId()); G.carId = (mine && mine.car) || s.car || G.carId; }
    if (!G.track) return;
    if (s.turn && (!G.turn || G.turn.pid !== s.turn.pid || G.turn.idx !== s.turn.idx)) { /* z:turn arrive juste avant */ }
    if (G.turn && s.turn) { G.turn.fuelLeft = s.turn.fuelLeft; G.turn.tries = s.turn.tries; G.turn.goAt = s.turn.goAt; G.turn.ended = s.turn.ended; }
    if (s.phase !== G.lastState) {
      G.lastState = s.phase;
      if (s.phase === "garage") { G.run = null; renderGarage(); setBanner("Au garage", "Choisis ta voiture", 1800); V.removeAllCars(); }
      if (s.phase === "race") { hideGarage(); G.wantArm = true; G.armedAt = 0; G.myDone = false; }
      if (s.phase === "turns") hideGarage();
      if (s.phase === "roundEnd") { G.run = null; }
    }
    if (s.phase === "garage") renderGarage();
    renderBoard();
  }

  // ---------- pilotage ----------
  function arm() { if (G.armedAt && Date.now() - G.armedAt < 1200) return; G.armedAt = Date.now(); G.waiting = true; Kit.socket.emit("z:attempt"); }
  function onGo(m) {
    clock(m.now); G.waiting = false; if (isChrono(G.mode)) G.wantArm = false; const car = m.car || G.carId || "bolide";
    G.slotMe = m.slot || 0; G.run = { r: CA.newRun(G.track, car, { slot: G.slotMe, leave: S().leave }), bytes: [], events: [], goAt: m.goAt, fuelTicks: 1e12, fuel0: m.fuelLeft || 0, challenger: m.role === "duel" && m.fuelLeft > 0, frames: [], done: false, car, cpShown: 0, out: false, finishSent: false, gptr: 0, lastGo: 0 };
    G.ghostPtr = 0; V.resetGates(); V.resetFollow(); G.armedAt = 0; G.cpBanner = 0;
    G.ghostT0 = m.goAt;
    const cm = me(); V.ensureCar("me", car, hexOf(cm ? cm.color : 0), false, null); engineStart();
    G.run.draft = []; G.run.lastDraft = 0; G.specId = null; if (m.goAt - m.now > 1800) V.intro(1);
  }
  function inputNow() {
    const k = G.keys, t = G.touch; let steer = 0;
    if (k.arrowleft || t.left) steer -= 1; if (k.arrowright || t.right) steer += 1;
    let thr = (k.arrowup || t.gas) ? 1 : 0, brk = (k.arrowdown || t.brake) ? 1 : 0;
    const gp = navigator.getGamepads ? navigator.getGamepads()[0] : null;
    if (gp) { const ax = gp.axes[0] || 0; if (Math.abs(ax) > 0.12) steer = clamp(ax, -1, 1); if ((gp.buttons[7] && gp.buttons[7].value > 0.1) || (gp.buttons[0] && gp.buttons[0].pressed)) thr = 1; if (gp.buttons[6] && gp.buttons[6].value > 0.1) brk = 1; if (gp.buttons[2] && gp.buttons[2].pressed && !G.gpRst) { G.rstReq = true; G.gpRst = true; } if (!(gp.buttons[2] && gp.buttons[2].pressed)) G.gpRst = false; if (gp.buttons[3] && gp.buttons[3].pressed && !G.gpRs) { G.gpRs = true; restartAttempt(); } if (!(gp.buttons[3] && gp.buttons[3].pressed)) G.gpRs = false; const lb = !!(gp.buttons[4] && gp.buttons[4].pressed); if (lb !== !!G.gpBack) { G.gpBack = lb; V.lookBack(lb); } }
    const rst = G.rstReq ? 1 : 0; G.rstReq = false;
    return { steer, thr, brk, rst };
  }
  function restartAttempt() {
    const s = G.st; if (!s) return;
    // en chrono fantôme et contact, un seul essai. Le bouton sert à abandonner, avec une confirmation par un second appui
    if (isChrono(G.mode)) {
      if (!G.run || G.run.done || G.run.finishSent || s.phase !== "race") return;
      const n = performance.now();
      if (!G.quitAsk || n - G.quitAsk > 3000) { G.quitAsk = n; setBanner("Abandonner la course", "Appuie encore une fois pour confirmer, tu n'as qu'un seul essai", 2600); return; }
      G.quitAsk = 0; Kit.socket.emit("z:end", { kind: "quit" }); G.run = null; G.wantArm = false; G.myDone = true; V.hideCar("me"); setBanner("Course abandonnée", "Flèches gauche et droite pour suivre un autre pilote", 3000);
      return;
    }
    if (s.phase === "race" || (s.phase === "turns" && s.turn && s.turn.pid === myId() && !s.turn.ended && !s.turn.auto)) {
      if (G.run && !G.run.finishSent) { Kit.socket.emit("z:end", { kind: "restart" }); }
      G.run = null; G.armedAt = 0; setTimeout(arm, 150);
    }
  }
  function myTurnActive() { const s = G.st; return !!(s && s.phase === "turns" && s.turn && s.turn.pid === myId() && !s.turn.ended && !s.turn.auto); }
  function canDrive() { const s = G.st; if (!s) return false; return s.phase === "race" || myTurnActive(); }
  function canDriveNow() { return !!(G.run && !G.run.done && canDrive()); }

  // ---------- boucle de rendu ----------
  function onFrame(dt) {
    if (document.body.dataset.screen !== "game" || !G.st || !G.track) return;
    if (G.replay) { replayFrame(dt); return; }
    const s = G.st; const now = snow(); const tr = G.track; const cm = me();
    const run = G.run;
    // armement automatique
    if (s.phase === "race" && G.wantArm && !run && !G.waiting) { arm(); }
    if (myTurnActive() && !run && !G.waiting && now > (s.turn.introUntil || 0) && (s.turn.role === "open" ? s.turn.tries < S().refTries : s.turn.fuelLeft > 0.05) && !s.turn.goAt) { G.autoArm = G.autoArm || performance.now(); if (performance.now() - G.autoArm > 300) { arm(); G.autoArm = 0; } }
    // simulation locale
    let speed = 0, shownTime = null, active = false;
    if (run && !run.done) {
      const want = Math.floor((now - run.goAt) / (1000 / 60)); const r = run.r;
      if (want < 0) { run.countdown = Math.ceil(-want / 60); }
      else {
        run.countdown = 0; let n = 0;
        while (r.tick < want && !r.finished && n < 8) {
          if (run.challenger && r.tick / 60 >= run.fuel0) run.out = true;
          if (G.mode === "contact") { contacts(run, r); const dt0 = CA.draftTarget(r, draftOthers()); if (dt0 !== run.lastDraft) { run.lastDraft = dt0; run.draft.push(r.tick, dt0); } r.draftT = dt0; }
          const tierWas = r.drTier;
          const inp = inputNow(); const q = CA.quant(inp); run.bytes.push(CA.packInput(q)); CA.step(r, q); n++;
          if (r.drTier > tierWas) Kit.sound.tone([0, 520, 700, 940][r.drTier], 0.08, "square", 0.05);
          if (r.ringEvt === r.tick) { Kit.sound.tone(990, 0.08, "triangle", 0.09); Kit.sound.tone(1320, 0.14, "triangle", 0.08, 0.07); V.shake(0.12); }
          if (r.tick % 6 === 1) run.frames.push(r.x, r.y, r.z, r.hd, r.pitch, r.rail ? 2 : r.air ? 1 : 0, r.boostT > 0 ? 1 : 0, r.idx);
          if (r.cpEvt === r.tick) { V.flashGate(r.cp); Kit.sound.tone(880, 0.12, "triangle", 0.1); G.cpBanner = performance.now(); setBanner("Point de contrôle " + r.cp + " sur " + tr.cps.length, fmtS(r.tick / 60), 1100); }
          if (r.wallHit > 5) { V.shake(Math.min(0.6, r.wallHit * 0.03)); Kit.sound.noise(0.12, 0.08, 0, 900); }
          if (r.landed > 3 && r.tick - (run.lastLand || 0) > 10) { run.lastLand = r.tick; V.puff(r.x, r.y + 0.3, r.z, "#dddddd", 6, 3, 1, 1.2); r.landed = 0; }
          if (r.boostEvt === r.tick) { Kit.sound.tone(380, 0.3, "sawtooth", 0.07, 0, 900); V.shake(0.15); }
          if (r.lastResetTick === r.tick) { V.resetFollow(); setBanner("Retour au point de contrôle", null, 900); }
        }
        if (r.finished && !run.done) finishRun(run);
        if (run.out && run.challenger && !run.done && G.record && G.mode === "essence" && r.tick / 60 > G.record.time + 1 && !run.lost) { run.lost = true; setBanner("Trop tard", "Le record ne peut plus être battu, ton réservoir est vide", 2400); Kit.socket.emit("z:end", { kind: "restart" }); }
      }
      speed = Math.hypot(r.vx, r.vz); shownTime = want >= 0 ? r.tick / 60 : 0; active = want >= 0 && !r.finished;
    }
    // ma voiture
    const myRun = run && run.r;
    if (myRun && (canDrive() || run.done)) {
      const r = myRun; const car = V.ensureCar("me", run.car, hexOf(cm ? cm.color : 0), false, null);
      const inp = G.keys; const steer = ((inp.arrowright || G.touch.right) ? 1 : 0) - ((inp.arrowleft || G.touch.left) ? 1 : 0);
      const fx = Math.sin(r.hd), fz = Math.cos(r.hd); const vf = r.vx * fx + r.vz * fz, vl = r.vx * -Math.cos(r.hd) + r.vz * Math.sin(r.hd);
      V.setCarState("me", { x: r.x, y: r.y, z: r.z, h: r.hd, p: r.pitch, a: r.rail ? 2 : r.air ? 1 : 0, i: r.idx, b: r.boostT > 0, speed: vf, steer: -r.steerV, skid: Math.abs(vl) > 4 && !r.air ? 1 : 0, dt: run.done ? 0 : r.drTier, dr: r.draft }, false);
      car.skidCol = r.onSurf === 1 ? "#a07a50" : r.onSurf === 2 ? "#e0f4ff" : r.onSurf === 6 ? "#e8d4a0" : "#dddddd";
      if (r.onSurf === 6 && !r.air && vf > 10 && Math.random() < 0.5) V.puff(r.x - Math.sin(r.hd) * 1.6, r.y + 0.3, r.z - Math.cos(r.hd) * 1.6, TR.BIOMES[tr.biome].vergeCol || "#e8d4a0", 2, 2.2, 1.4, 1.3);
      if (r.onSurf === 1 && !r.air && vf > 15 && Math.random() < 0.3) V.puff(r.x - Math.sin(r.hd) * 1.6, r.y + 0.3, r.z - Math.cos(r.hd) * 1.6, "#b08a5a", 1, 1.5, 1, 1.1);
    } else if (cm && (s.phase === "garage" || s.phase === "race" || myTurnActive())) {
      V.ensureCar("me", cm.car, hexOf(cm.color), false, null); V.setCarState("me", gridPose(isChrono(G.mode) ? (G.slots[myId()] || 0) : 0), true);
    } else V.hideCar("me");
    // caméra
    const spectating = s.phase === "turns" && s.turn && s.turn.pid !== myId();
    updateSpec(s, run);
    if (G.replay) { /* la caméra est réglée par le replay */ }
    else if (s.phase === "garage") { V.setOrbit("fly"); V.follow("me"); }
    else if (s.phase === "roundEnd" || s.phase === "over") { V.setOrbit(true); V.follow("me"); }
    else { V.setOrbit(null); V.follow(spectating ? s.turn.pid : G.specId && V.cars[G.specId] && V.cars[G.specId].root.visible ? G.specId : "me"); }
    // autres voitures
    const contact = G.mode === "contact"; const showOthers = S().others || contact;
    const chronoGrid = isChrono(G.mode) && (s.phase === "race" || s.phase === "garage");
    s.players.forEach((p) => {
      const id = p.id; if (id === myId()) return; const sn = G.snaps[id]; const live = sn && Date.now() - sn.at < (contact ? 600 : 1500);
      const isActive = spectating && s.turn.pid === id;
      if (!showOthers && !isActive) { V.hideCar(id); return; }
      if (live && (s.phase === "race" || s.phase === "turns")) { V.ensureCar(id, sn.car, hexOf(p.color), !isActive && !contact, isActive ? "" : p.name); V.setCarTarget(id, sn); }
      else if (chronoGrid && !p.left) { V.ensureCar(id, p.car, hexOf(p.color), !contact, p.name); V.setCarState(id, gridPose(G.slots[id] || 0), true); const c = V.cars[id]; if (c) c.tgt = null; }
      else V.hideCar(id);
    });
    // fantôme
    let gt = null;
    if (isChrono(G.mode)) { G.ghostFrames = G.myBestFrames; G.ghostCar = run ? run.car : (cm ? cm.car : "bolide"); }
    const frames = G.ghostFrames; let ghostOn = false;
    if (S().ghost && frames && frames.length >= 16) {
      if (run && !run.done && run.countdown === 0) gt = run.r.tick / 60; else if (spectating) { const bc = botClock(); if (bc) gt = bc.gap ? null : bc.t; else if (s.turn.goAt) gt = (now - s.turn.goAt) / 1000; }
      if (gt != null && gt >= 0) { const nF = frames.length / 8 - 1; const f = gt * 10; const k = Math.min(nF - 1, Math.floor(f)); const u = clamp(f - k, 0, 1);
        if (f <= nF + 20) { const o = Math.min(nF - 1, k) * 8, o2 = o + 8; const L = (a, b) => a + (b - a) * u; const hd = frames[o + 3] + ((((frames[o2 + 3] - frames[o + 3]) % 6.2832) + 9.4248) % 6.2832 - 3.1416) * u;
          V.ensureCar("ghost", G.ghostCar, "#9fe8ff", true, "Record"); V.setCarState("ghost", { x: L(frames[o], frames[o2]), y: L(frames[o + 1], frames[o2 + 1]), z: L(frames[o + 2], frames[o2 + 2]), h: hd, p: frames[o + 4], a: frames[o + 5], i: L(frames[o + 7], frames[o2 + 7]), b: frames[o + 6], speed: 20 }, false); ghostOn = true; } }
    }
    if (!ghostOn) V.hideCar("ghost");
    // interface
    updateHud(dt, run, speed, shownTime, gt);
    engineUpdate(speed, active && !(run && run.out && speed < 3), run ? run.car : cm ? cm.car : null);
  }

  function finishRun(run) {
    run.done = true; G.myDone = true; const r = run.r; const t = r.finishTime;
    if (!run.finishSent) { run.finishSent = true; Kit.socket.emit("z:end", { kind: "finish", bytes: bytesB64(run.bytes), time: t, ev: run.events || [], dr: run.draft || [] }); }
    Kit.sound.win(); { const A = G.author; const k = A ? t / A : 0; const medal = !A ? "" : k <= 1 ? "Médaille d'auteur battue 🏆" : k <= 1.06 ? "Médaille d'or 🥇" : k <= 1.15 ? "Médaille d'argent 🥈" : k <= 1.3 ? "Médaille de bronze 🥉" : ""; const base = r.resets ? "Arrivée avec " + r.resets + " retour" + (r.resets > 1 ? "s" : "") : "Arrivée"; setBanner(fmtS(t), medal ? medal + " · " + base : base, 2800); }
    if (G.myBest == null || t < G.myBest) { G.myBest = t; G.myBestFrames = run.frames.slice(); }
    run.doneAt = performance.now();
    const rec = G.mode === "essence" && G.record ? G.record.time : null;
    if (rec != null) feed(t < rec ? "Record battu de " + fmt(rec - t) + " s" : "Il manque " + fmt(t - rec) + " s pour battre le record");
    // l'essai suivant démarre tout seul après une courte pause
    G.afterFinish = performance.now(); G.run = run;
    setTimeout(() => { if (G.run === run && canDrive() && !(G.st.turn && G.st.turn.ended)) { G.run = null; G.armedAt = 0; if (isChrono(G.mode)) { G.waiting = false; setBanner("Ton temps est posé", "Flèches gauche et droite pour suivre les autres pilotes", 4000); } } }, 2600);
  }
  function bytesB64(arr) { let s = ""; for (let i = 0; i < arr.length; i += 0x8000) s += String.fromCharCode.apply(null, arr.slice(i, i + 0x8000)); return btoa(s); }

  // ---------- messages réseau ----------
  // tampon d'échantillons par voiture. On affiche un peu dans le passé en interpolant entre deux mesures, avec l'horloge de l'envoyeur, pour que le mouvement reste régulier malgré les à-coups du réseau
  G.bufs = {}; G.off = {};
  function pushSample(c, now) {
    const b = G.bufs[c.id] || (G.bufs[c.id] = []); const ts = c.c || now; if (b.length && ts <= b[b.length - 1].ts) return;
    const o = now - ts; G.off[c.id] = G.off[c.id] == null ? o : Math.min(o, G.off[c.id] + 0.4);
    b.push({ ts, x: c.x, y: c.y, z: c.z, h: c.h, p: c.p || 0, a: c.a, b: c.b, i: c.i || 0, vx: c.vx || 0, vz: c.vz || 0, car: c.car });
    if (b.length > 40) b.splice(0, b.length - 40);
  }
  const wrapA = (d) => { while (d > Math.PI) d -= 2 * Math.PI; while (d < -Math.PI) d += 2 * Math.PI; return d; };
  V.sampler = (id) => {
    const b = G.bufs[id]; if (!b || !b.length || G.off[id] == null) return null;
    const delay = G.mode === "contact" ? 70 : 130; const tr = Date.now() - G.off[id] - delay;
    while (b.length > 3 && b[1].ts < tr - 600) b.shift();
    const f = b[0], l = b[b.length - 1];
    if (tr <= f.ts) return f;
    if (tr >= l.ts) { const dp = Math.min(0.3, (tr - l.ts) / 1000); const air = l.a === 1; return Object.assign({}, l, { x: l.x + l.vx * dp, z: l.z + l.vz * dp, i: l.a === 2 ? l.i + (Math.hypot(l.vx, l.vz) * dp) / 2 : l.i, y: air ? l.y : l.y }); }
    let q = 0; while (q < b.length - 2 && b[q + 1].ts <= tr) q++;
    const A = b[q], B = b[q + 1]; if (Math.hypot(B.x - A.x, B.z - A.z) > 22 || (A.a === 2) !== (B.a === 2)) return A;
    const u = (tr - A.ts) / Math.max(1, B.ts - A.ts);
    return { x: A.x + (B.x - A.x) * u, y: A.y + (B.y - A.y) * u, z: A.z + (B.z - A.z) * u, h: A.h + wrapA(B.h - A.h) * u, p: A.p + (B.p - A.p) * u, a: u > 0.5 ? B.a : A.a, b: u > 0.5 ? B.b : A.b, i: A.i + (B.i - A.i) * u, vx: A.vx, vz: A.vz, car: B.car };
  };
  function onSnap(m) {
    const now = Date.now();
    m.cars.forEach((c) => { pushSample(c, now); });
    m.cars.forEach((c) => {
      const prev = G.snaps[c.id]; const n = Object.assign({ at: now, vx: 0, vz: 0 }, c);
      if (prev) { const dt = (now - prev.at) / 1000; if (dt > 0.015 && dt < 0.6) { n.vx = prev.vx * 0.4 + ((c.x - prev.x) / dt) * 0.6; n.vz = prev.vz * 0.4 + ((c.z - prev.z) / dt) * 0.6; } else { n.vx = prev.vx; n.vz = prev.vz; } }
      if (typeof c.vx === 'number' && (c.vx || c.vz)) { n.vx = c.vx; n.vz = c.vz; }
      G.snaps[c.id] = n;
    });
  }
  // contact entre pilotes. Chaque voiture est faite de deux cercles. Le choc est appliqué à ma voiture et noté pour que le serveur le rejoue.
  function contacts(run, r) {
    if (r.tick < 2) return; const R = 1.12, off = 1.05; const t = Date.now();
    Object.keys(G.snaps).forEach((id) => {
      if (id === myId()) return; const sn = G.snaps[id]; if (t - sn.at > 450) return; const c = V.cars[id]; if (!c || !c.init || !c.root.visible || c.ghost) return;
      const o = c.st;
      const share = 0.8; const hit = CA.contactVs(r, { x: o.x, z: o.z, h: o.h, y: o.y, vx: sn.vx, vz: sn.vz, car: sn.car }, share, (r.bumpCd | 0) <= r.tick); if (!hit) return;
      if (hit.bump) r.bumpCd = r.tick + 5; const vn = hit.vn;
      const q = (v) => Math.round(v * 100); const ex = [q(hit.dx), q(hit.dz), q(hit.dvx), q(hit.dvz), q(hit.ds)]; CA.nudge(r, ex[0] / 100, ex[1] / 100, ex[2] / 100, ex[3] / 100, ex[4] / 100); // valeurs arrondies comme sur le serveur
      run.events.push(r.tick, ex[0], ex[1], ex[2], ex[3], ex[4]);
      if (vn < -3 && t - (run.lastBump || 0) > 250) { run.lastBump = t; V.shake(Math.min(0.5, -vn * 0.03)); Kit.sound.noise(0.1, 0.07, 0, 700); }
    });
  }
  const gridPose = (slot) => { const st = G.track.start; return { x: st.x - Math.cos(st.h) * slot, y: st.y, z: st.z + Math.sin(st.h) * slot, h: st.h, p: 0, a: 0, b: 0, speed: 0 }; };
  function onTurnEnd(m) {
    const nm = nameOf(m.pid);
    if (m.role === "open") feed(nm + " pose " + (m.time != null ? fmtS(m.time) : "aucun temps"));
    else if (m.result === "beat") { setBanner("Il passe devant", nm + " signe " + fmtS(m.time) + " et n'est plus dernier", 2600); sound.win(); }
    else if (m.result === "quit") { setBanner("Abandon", nm + " sort de la course", 2400); sound.fail(); }
    else { setBanner("Panne d'essence", nm + " est éliminé", 2400); sound.fail(); }
    if (m.pid === myId()) { G.run = null; G.waiting = false; }
  }
  function onResult(m) { if (m.pid !== myId()) feed(nameOf(m.pid) + " termine en " + fmtS(m.time)); }
  function onBotTurn(m) { clock(m.now); G.botPlan = m; }
  // horloge d'un tour d'automate, calculée comme sur le serveur à partir du plan reçu
  function botClock() {
    const p = G.botPlan, s = G.st; if (!p || !s || !s.turn || s.turn.pid !== p.pid || s.phase !== "turns") return null;
    const e = (snow() - p.startAt) / 1000 * p.rate; if (e < 0) return { t: 0, fuel: p.fuel, idx: 0, gap: true, n: p.segs.length };
    let burned = 0, idx = p.segs.length - 1, seg = p.segs[idx];
    for (let i = 0; i < p.segs.length; i++) { const sg = p.segs[i]; if (e < sg.t0 + sg.dur + 1.5) { seg = sg; idx = i; break; } burned += sg.burn; }
    const local = e - seg.t0; const inSeg = local >= 0 && local <= seg.dur;
    return { t: clamp(local, 0, seg.dur), fuel: p.fuel > 0 ? Math.max(0, p.fuel - burned - (seg.burn > 0 ? clamp(local, 0, seg.dur) : 0)) : 0, idx, gap: !inSeg, n: p.segs.length, kind: seg.kind };
  }
  function onRoundEnd(m) {
    clock(m.now); G.endInfo = m; G.run = null;
    const tbl = el("table", { class: "tbl" }, [
      el("thead", {}, [el("tr", {}, [el("th", { text: "Pilote" }), el("th", { class: "r", text: "Meilleur temps" }), el("th", { class: "r", text: "Essais" }), el("th", { class: "r", text: "Points" }), el("th", { class: "r", text: "Total" })].concat(m.rule && m.rule !== "points" ? [el("th", { class: "r", text: "Cumul des temps" })] : []))]),
      el("tbody", {}, m.rows.map((r) => { const p = stP(r.id) || {}; const car = CA.CARS[r.car]; const cumCell = m.rule && m.rule !== "points" ? [el("td", { class: "r", text: r.cum == null ? "-" : fmtS(r.cum) + (r.pen ? " (sans temps, " + fmtS(r.counted) + " comptées)" : "") + (m.cumRank && m.cumRank[r.id] ? ", " + m.cumRank[r.id] + (m.cumRank[r.id] === 1 ? "er" : "e") : "") })] : []; return el("tr", {}, [el("td", {}, [el("span", { class: "dotc", style: { background: hexOf(p.color) } }), (r.winner ? "🏆 " : "") + (p.name || "?") + (car ? " " + car.icon : "")]), el("td", { class: "r", text: r.best == null ? "-" : fmtS(r.best) }), el("td", { class: "r", text: String(r.tries || 0) }), el("td", { class: "r", text: "+" + r.pts }), el("td", { class: "r", text: String(r.total) })].concat(cumCell)); })),
    ]);
    const note = el("p", { id: "sheet-next", class: "muted small", text: "" });
    const info = el("p", { class: "muted", text: m.track + (m.drawn && m.drawn.length ? " · " + m.drawn.join(", ") : "") + (m.rule === "temps" ? " · le meilleur cumul des temps gagne" : m.rule === "mixte" ? " · places aux points et aux temps cumulés" : "") + (m.author ? " · temps de l'auteur " + fmtS(m.author) : "") + (m.recordTime && m.mode === "essence" ? " · temps du vainqueur " + fmtS(m.recordTime) : "") });
    openSheet([el("h2", { text: "Course " + (m.index + 1) + " terminée" }), info, tbl, note]); G.sheet = { kind: "end", note };
  }
  function onOver(m) {
    G.endInfo = null; const rows = m.rows; const top = rows.slice(0, 3); const order = top.length === 1 ? [top[0]] : top.length === 2 ? [top[1], top[0]] : [top[1], top[0], top[2]];
    const pod = el("div", { class: "podium" }, order.map((r) => el("div", { class: "pod pod--" + r.rank }, [el("div", { class: "pod__ball", style: { background: hexOf(r.color) } }), el("div", { class: "pod__nm", text: r.name }), el("div", { class: "pod__bar", text: String(r.rank) })])));
    const tbl = el("table", { class: "tbl" }, [
      el("thead", {}, [el("tr", {}, [el("th", { text: "" }), el("th", { text: "Pilote" }), el("th", { class: "r", text: "Points" }), el("th", { class: "r", text: "Courses gagnées" }), el("th", { class: "r", text: "Meilleur temps" })].concat(m.rule && m.rule !== "points" ? [el("th", { class: "r", text: "Cumul des temps" })] : []).concat(m.rule === "mixte" ? [el("th", { class: "r", text: "Places points + temps" })] : []))]),
      el("tbody", {}, rows.map((r) => el("tr", {}, [el("td", { text: String(r.rank) }), el("td", {}, [el("span", { class: "dotc", style: { background: hexOf(r.color) } }), r.name + (r.left ? " (parti)" : "")]), el("td", { class: "r", text: String(r.pts) }), el("td", { class: "r", text: String(r.wins) }), el("td", { class: "r", text: r.bestAll == null ? "-" : fmtS(r.bestAll) })].concat(m.rule && m.rule !== "points" ? [el("td", { class: "r", text: r.cum == null ? "-" : fmtS(r.cum) + (r.dnf ? " (" + r.dnf + " sans temps)" : "") })] : []).concat(m.rule === "mixte" ? [el("td", { class: "r", text: r.rkPts + " + " + r.rkTime + " = " + r.mix })] : [])))),
    ]);
    const host = Kit.isHost();
    const btns = el("div", { class: "row" }, [
      el("button", { class: "btn btn--ghost", text: "Copier la graine " + m.seed, onclick: () => { try { navigator.clipboard.writeText(m.seed); toast("Graine copiée.", "info"); } catch (e) { toast("Graine " + m.seed, "info"); } } }),
      el("button", { class: "btn btn--ghost", text: "Quitter", onclick: () => Kit.confirm("Quitter la partie et revenir à l'accueil ?", () => Kit.leave()) }),
      host ? el("button", { class: "btn btn--accent", text: "Retour au salon", onclick: () => Kit.backToLobby() }) : el("span", { class: "muted small", text: "L'hôte peut relancer une partie depuis le salon." }),
    ]);
    G.overInfo = m;
    const rlist = (m.replays && m.replays.list) || []; const rbox = rlist.length ? el("div", { class: "replays" }, [el("h3", { text: "Revoir les courses" }), el("div", { class: "chips" }, rlist.map((r) => el("button", { class: "chip", text: "Course " + (r.i + 1) + " · " + r.name + " " + (TR.BIOMES[r.biome] ? TR.BIOMES[r.biome].icon : ""), onclick: () => Kit.socket.emit("z:replay", { i: r.i }) })))]) : null;
    openSheet([el("h2", { text: "Fin de la partie" }), el("p", { class: "muted small", style: { textAlign: "center" }, text: m.rule === "temps" ? "Victoire au cumul des temps" : m.rule === "mixte" ? "Victoire mixte, places aux points et aux temps cumulés" : "Victoire aux points" }), pod, tbl, rbox, btns]); G.sheet = { kind: "over" }; if (!G.overSound) { sound.win(); G.overSound = true; } V.setOrbit(true);
  }

  // ---------- éléments d'interface ----------
  function openSheet(nodes) { const s = $("#sheet"); s.innerHTML = ""; s.appendChild(el("div", { class: "card" }, nodes)); s.classList.remove("hidden"); }
  function closeSheet() { const s = $("#sheet"); if (s) { s.classList.add("hidden"); s.innerHTML = ""; } G.sheet = null; }
  let bannerTimer = 0;
  function setBanner(big, small, ms) { const c = $("#z-center"); if (!c) return; c.innerHTML = ""; const b = el("div", { class: "banner", text: big }); if (small) b.appendChild(el("small", { text: small })); c.appendChild(b); clearTimeout(bannerTimer); if (ms) bannerTimer = setTimeout(() => { c.innerHTML = ""; }, ms); }
  function feed(text) { const box = $("#z-feed"); if (!box) return; const line = el("div", { class: "pill", text }); box.appendChild(line); while (box.children.length > 3) box.firstChild.remove(); setTimeout(() => line.remove(), 4200); }
  function hideGarage() { const g = $("#garage"); if (g) { g.classList.add("hidden"); g.dataset.key = ""; } }
  function renderGarage() {
    const g = $("#garage"); if (!g || !G.st || !G.track) return; const s = G.st; const cm = me();
    // on ne reconstruit le garage que si son contenu change, sinon un clic en cours serait perdu
    const secs = Math.max(0, Math.ceil((s.phaseUntil - snow()) / 1000)); const isHost0 = Kit.isHost();
    const carWho = () => (S().carMode === "random" ? "Voiture tirée au sort pour tous" : S().carMode === "winner" ? (s.chooser === myId() ? "Tu choisis la voiture de tout le monde" : nameOf(s.chooser) + " choisit la voiture de tout le monde") : "Choisis ta voiture");
    const gkey = [G.track.name, G.carId, S().carMode, s.chooser, G.author, isHost0, !!(cm && cm.ready), Kit.room && Kit.room.hostId].join("|");
    g.classList.remove("hidden");
    if (g.dataset.key === gkey && g.firstChild) { const t = $("#gar-secs"); if (t) t.textContent = carWho() + " · départ dans " + secs + " s"; return; }
    g.dataset.key = gkey; g.innerHTML = "";
    const B = TR.BIOMES[G.track.biome];
    g.appendChild(el("div", { class: "garage__info" }, [el("b", { text: B.icon + " " + G.track.name }), el("span", { class: "small", text: B.name + (B.identity ? " (" + B.identity.toLowerCase() + ")" : "") + " · " + Math.round(G.track.length) + " m · environ " + Math.round(G.track.length / 27) + " s de conduite" + (G.author ? " · temps de l'auteur " + fmtS(G.author) : "") })].concat(G.track.drawn && G.track.drawn.length ? [el("span", { class: "small", style: { display: "block" }, text: "Tiré au sort pour cette course, " + G.track.drawn.join(", ") })] : [])));
    const cmode = S().carMode || "winner"; const canPick = cmode === "own" || (cmode === "winner" && s.chooser === myId()); const cards = el("div", { class: "cars" + (canPick ? "" : " cars--locked") });
    CA.CAR_ORDER.forEach((id) => {
      const c = CA.CARS[id]; const on = G.carId === id; const bar = (v) => el("i", { style: { width: Math.round(clamp(v, 0.08, 1) * 80) + "px" } });
      cards.appendChild(el("button", { class: "carcard" + (on ? " carcard--on" : ""), onclick: () => { if (canPick) { Kit.socket.emit("z:car", { id }); sound.click(); } else toast(cmode === "random" ? "La voiture est tirée au sort à chaque course." : nameOf(s.chooser) + " choisit la voiture, il a gagné la dernière course ou c'est l'hôte pour la première.", "info"); } }, [
        el("b", {}, [el("span", { class: "ic", text: c.icon }), c.name]), el("p", { class: "trait", text: c.trait || "" }), el("p", { text: c.desc }),
        el("div", { class: "stat" }, [el("span", { text: "Vitesse" }), bar(c.vmax / 70)]), el("div", { class: "stat" }, [el("span", { text: "Accélération" }), bar((c.acc * (c.accPow ? 1.15 : 1)) / 31)]),
        el("div", { class: "stat" }, [el("span", { text: "Adhérence" }), bar(c.grip / 7.6)]), el("div", { class: "stat" }, [el("span", { text: "Maniabilité" }), bar(c.turn / 3)]),
        el("div", { class: "stat" }, [el("span", { text: "Turbo de dérapage" }), bar(c.drift / 1.4)]), el("div", { class: "stat" }, [el("span", { text: "Solidité aux chocs" }), bar(1.25 - c.wall * 0.75)]), el("div", { class: "stat" }, [el("span", { text: "Poids" }), bar(c.mass / 2.2)]),
      ]));
    });
    g.appendChild(cards);
    g.appendChild(el("div", { class: "legend" }, [el("kbd", { text: "↑" }), el("span", { text: "accélérer" }), el("kbd", { text: "↓" }), el("span", { text: "reculer" }), el("kbd", { text: "←" }), el("kbd", { text: "→" }), el("span", { text: "tourner" }), el("kbd", { text: "Entrée" }), el("span", { text: "recommencer" }), el("kbd", { text: "Maj" }), el("span", { text: "dernier point de contrôle" }), el("kbd", { text: "Espace" }), el("span", { text: "regarder derrière" })]));
    const ready = !!(cm && cm.ready);
    g.appendChild(el("div", { class: "garage__row" }, [
      el("span", { class: "pill", id: "gar-secs", text: carWho() + " · départ dans " + secs + " s" }),
      el("button", { class: "btn " + (ready ? "btn--ghost" : "btn--green") + " btn--big", text: ready ? "Je ne suis plus prêt" : "Je suis prêt", onclick: () => Kit.socket.emit("z:ready") }),
    ]));
    if (cm && cm.car) { const c = V.ensureCar("me", cm.car, hexOf(cm.color), false, null); const st = G.track.start; V.setCarState("me", { x: st.x, y: st.y, z: st.z, h: st.h, p: 0, a: 0, b: 0, speed: 0 }, true); }
  }
  function renderBoard() {
    const s = G.st; if (!s) return; const box = $("#z-board"); box.innerHTML = "";
    const ess = s.mode === "essence";
    box.appendChild(el("h4", {}, [el("span", { text: (ess ? "Essence" : s.mode === "contact" ? "Contact" : "Fantôme") + " · course " + Math.min(s.total, s.roundIdx + 1) }), el("span", { text: ess ? "temps · essence" : (S().winRule === "temps" ? "meilleur · cumul" : "meilleur · pts") })]));
    let list = s.players.slice();
    if (ess && s.stage !== "open") list.sort((a, b) => (!!a.out - !!b.out) || (a.best == null) - (b.best == null) || a.best - b.best);
    else if (ess && s.order && s.order.length) list.sort((a, b) => s.order.indexOf(a.id) - s.order.indexOf(b.id));
    else list.sort((a, b) => (a.best == null) - (b.best == null) || a.best - b.best);
    list.forEach((p) => {
      const turn = ess && s.turn && s.turn.pid === p.id && s.phase === "turns"; const holder = ess && s.record && s.record.pid === p.id && s.stage === "duel" && !p.out;
      let right = String(p.pts); if (!ess && S().winRule === "temps") right = p.cum == null ? "-" : fmt(p.cum);
      if (ess) right = p.out ? "éliminé" : s.stage === "duel" ? Math.round(turn && s.turn.fuelLeft != null ? s.turn.fuelLeft : p.fuel) + " s" : "-";
      box.appendChild(el("div", { class: "brow" + (p.id === myId() ? " brow--you" : "") + (turn ? " brow--turn" : "") + (ess && p.out ? " brow--out" : "") }, [
        el("i", { style: { background: hexOf(p.color) } }), el("span", { class: "nm", text: (holder ? "🎯 " : "") + p.name + (p.isBot || p.auto ? " 🤖" : !p.connected ? " 💤" : "") }),
        el("span", { class: "st", text: p.best == null ? "-" : fmt(p.best) }), el("span", { class: "pt", text: right })]));
    });
  }
  function updateHud(dt, run, speed, shownTime, gt) {
    const s = G.st; const tEl = $("#z-time"), sub = $("#z-sub");
    let timeTxt = "", subTxt = "", cls = "";
    if (run && run.countdown > 0) { timeTxt = String(run.countdown); setCount(run.countdown); }
    else if (run) {
      timeTxt = fmt(run.done ? run.r.finishTime : shownTime) + "<small>s</small>";
      if (G.ghostFrames && S().ghost && !run.done) {
        const f = G.ghostFrames; const nF = f.length / 8; const idx = run.r.idx; let k = G.ghostPtr; while (k < nF - 1 && f[k * 8 + 7] < idx) k++; G.ghostPtr = k;
        if (k > 0 && k < nF) { const a = f[(k - 1) * 8 + 7], b = f[k * 8 + 7]; const u = b > a ? clamp((idx - a) / (b - a), 0, 1) : 0; const gT = (k - 1 + u) / 10; const d = shownTime - gT; subTxt = (d <= 0 ? "−" : "+") + fmt(Math.abs(d)) + " s"; cls = d <= 0 ? "z-delta--good" : "z-delta--bad"; }
      }
    } else if (s && s.phase === "turns" && s.turn && s.turn.pid !== myId() && botClock()) { const bc = botClock(); timeTxt = bc.gap ? "" : fmt(bc.t) + "<small>s</small>"; subTxt = nameOf(s.turn.pid) + " essai " + (bc.idx + 1) + (S().botPace > 1 ? " · vitesse x" + S().botPace : ""); }
    else if (s && (s.phase === "turns" && s.turn && s.turn.pid !== myId() && s.turn.goAt)) { const t = Math.max(0, (snow() - s.turn.goAt) / 1000); timeTxt = fmt(t) + "<small>s</small>"; subTxt = nameOf(s.turn.pid) + " roule"; }
    else timeTxt = "";
    if (G.lastDom.t !== timeTxt) { tEl.innerHTML = timeTxt; G.lastDom.t = timeTxt; }
    sub.textContent = subTxt; sub.className = "z-sub " + cls;
    // record
    const rec = $("#z-rec"); rec.style.visibility = ""; let rt = "", rs = "";
    if (s && s.mode === "essence" && s.phase === "turns" && s.turn && s.turn.role === "open") { rt = s.turn.pid === myId() ? "Pose ton temps" : nameOf(s.turn.pid) + " pose son temps"; rs = "Essai " + Math.min(S().refTries, s.turn.tries + 1) + " sur " + S().refTries; }
    else if (s && s.mode === "essence" && G.record && s.stage === "duel") { rt = "À battre " + fmtS(G.record.time); rs = nameOf(G.record.pid) + " · " + nameOf(s.turn ? s.turn.pid : "") + " est dernier"; } else if (s && s.mode === "essence" && s.stage === "duel") { rt = ""; rs = ""; } else if (s && isChrono(s.mode)) { rt = G.myBest != null ? "Ton meilleur " + fmtS(G.myBest) : "Pas encore de temps"; rs = s.raceEnd ? (snow() < s.goAt ? "Départ dans " + Math.max(0, Math.ceil((s.goAt - snow()) / 1000)) + " s" : "Il reste " + Math.max(0, Math.ceil((s.raceEnd - snow()) / 1000)) + " s") : ""; }
    if (G.lastDom.r !== rt + rs) { rec.innerHTML = ""; rec.appendChild(el("b", { text: rt })); rec.appendChild(el("span", { text: rs })); G.lastDom.r = rt + rs; }
    { const fx = $("#z-fx"); const kmh = speed * 3.6; fx.style.opacity = run && !run.done ? clamp((kmh - 110) / 150, 0, 0.7) : 0; fx.classList.toggle("z-fx--boost", !!(run && !run.done && run.r.boostT > 0)); }
    $("#z-speed").style.visibility = run && !run.done ? "visible" : "hidden";
    { const kmh = String(Math.round(speed * 3.6)); const kb = $("#z-kmh"); if (kb.textContent !== kmh) kb.textContent = kmh;
      const r = run && run.r; const tier = r && !run.done ? r.drTier : 0; [...$("#z-drift").children].forEach((b, k) => { b.className = k < tier ? "t" + tier : ""; });
      $("#z-boost").style.width = r ? clamp(r.boostT / 150, 0, 1) * 100 + "%" : "0%"; $("#z-draft").classList.toggle("hidden", !(r && r.draft > 0.25 && !run.done));
      const vb = $("#z-batt"); const volt = r && r.car && r.car.regen; vb.classList.toggle("hidden", !volt); if (volt) vb.firstChild.style.width = clamp(r.batt / 140, 0, 1) * 100 + "%"; }
    startLights(run, snow());
    // position en course et points de contrôle
    { const rc = $("#z-race"); let txt = "";
      if (run && !run.done && run.countdown === 0) { const ncp = G.track.cps.length; txt = "Contrôle " + run.r.cp + " sur " + ncp;
        if (isChrono(G.mode) && s) { const mine = run.r.idx; let ahead = 0, tot = 1; s.players.forEach((p) => { if (p.id === myId() || p.left) return; tot++; const sn = G.snaps[p.id]; if (p.best != null && p.finishes > 0) ahead++; else if (sn && Date.now() - sn.at < 1500 && sn.i > mine) ahead++; }); txt = "Position " + (ahead + 1) + " sur " + tot + " · " + txt; } }
      rc.classList.toggle("hidden", !txt); if (G.lastDom.rc !== txt) { rc.textContent = txt; G.lastDom.rc = txt; } }
    { const gb = $("#btn-giveup"); const show = !!(s && s.mode === "essence" && s.phase === "turns" && s.turn && s.turn.role === "duel" && s.turn.pid === myId() && !s.turn.ended); gb.classList.toggle("hidden", !show); }
    // essence
    const fu = $("#z-fuel");
    if (s && s.mode === "essence" && s.phase === "turns" && s.turn) {
      let left = s.turn.fuelLeft; if (run && run.fuel0 > 0 && !run.done && run.countdown === 0) left = run.fuel0 - run.r.tick / 60; else if (s.turn.pid !== myId() && botClock()) left = botClock().fuel; else if (s.turn.goAt && s.turn.pid !== myId()) left = s.turn.fuelLeft - Math.max(0, (snow() - s.turn.goAt) / 1000);
      left = Math.max(0, left); fu.classList.remove("hidden"); fu.classList.toggle("z-fuel--low", left < 10);
      const txt = "⛽ " + Math.ceil(left) + " s d'essence"; if (G.lastDom.f !== txt) { fu.innerHTML = ""; fu.appendChild(el("div", { text: txt })); fu.appendChild(el("div", { class: "bar" }, [el("i", { style: { width: clamp(left / s.turn.fuel, 0, 1) * 100 + "%" } })])); G.lastDom.f = txt; } else fu.querySelector("i").style.width = clamp(left / s.turn.fuel, 0, 1) * 100 + "%";
      if (run && run.out && !run.done && run.countdown === 0 && !G.noFuelBanner) { G.noFuelBanner = true; setBanner("Réservoir vide", "Finis cet essai, c'est ton dernier", 2800); Kit.sound.fail(); }
      if (!run || !run.out) G.noFuelBanner = false;
    } else fu.classList.add("hidden");
    // mini carte
    const now = performance.now(); if (now - G.lastMini > 100 && G.track) {
      G.lastMini = now; const pts = []; const r = run && run.r; const mi = V.carState("me");
      if (mi && V.cars.me && V.cars.me.root.visible) pts.push({ x: mi.x, z: mi.z, hex: "#ffffff", big: true });
      Object.keys(G.snaps).forEach((id) => { const sn = G.snaps[id]; if (id !== myId() && Date.now() - sn.at < 1500) { const p = stP(id); pts.push({ x: sn.x, z: sn.z, hex: hexOf(p ? p.color : 0) }); } });
      drawMap($("#z-mini"), G.track, { dots: pts, lw: 5 });
    }
    // conseils
    const tip = $("#z-tip"); let tt = "";
    if (G.specId) tt = "← → changer de pilote suivi";
    else if (s && canDrive()) tt = "↑ accélérer · ↓ reculer · ← → tourner · Espace regarder derrière · Entrée recommencer (ou abandonner en chrono) · Maj dernier point de contrôle · C caméra";
    else if (s && s.phase === "turns" && s.turn) tt = "Tu joueras dans " + Math.max(0, s.order.indexOf(myId()) - s.turn.idx) + " tour" + (s.order.indexOf(myId()) - s.turn.idx > 1 ? "s" : "") + (s.order.indexOf(myId()) <= s.turn.idx ? ", ton tour est passé." : ".");
    if (G.lastDom.tip !== tt) { tip.textContent = tt; G.lastDom.tip = tt; }
    if (G.sheet && G.sheet.kind === "end" && G.endInfo) { const left = Math.max(0, Math.ceil((G.endInfo.until - snow()) / 1000)); G.sheet.note.textContent = G.endInfo.last ? "C'est la dernière course, les résultats arrivent." : "Prochaine course dans " + left + " s."; }
    if (s && s.phase === "garage" && now - (G.lastGar || 0) > 500) { G.lastGar = now; renderGarage(); }
  }
  // feux de départ, cinq feux rouges s'allument pendant les trois dernières secondes puis tout passe au vert
  let lastLit = -1, greenUntil = 0;
  function startLights(run, now) {
    const box = $("#z-lights"); if (!box) return; const rem = run ? (run.goAt - now) / 1000 : -99;
    if (run && rem > 0 && rem < 4.5) { const lit = clamp(Math.ceil((3.4 - rem) / 0.62), 0, 5); box.classList.remove("hidden", "z-lights--go"); if (lit !== lastLit) { lastLit = lit; [...box.children].forEach((b, k) => b.classList.toggle("on", k < lit)); if (lit > 0) Kit.sound.tone(520, 0.12, "square", 0.06); } return; }
    if (run && rem <= 0 && rem > -0.9 && lastLit !== 99) { lastLit = 99; greenUntil = performance.now() + 900; box.classList.add("z-lights--go"); [...box.children].forEach((b) => b.classList.add("on")); Kit.sound.tone(880, 0.35, "square", 0.08); setBanner("Partez", null, 800); }
    if (performance.now() > greenUntil) { box.classList.add("hidden"); if (!run || rem < -1) lastLit = -1; }
  }
  let lastCount = 0;
  function setCount(n) { lastCount = n; }

  // ---------- carte du circuit (salon et jeu) ----------
  function drawMap(canvas, tr, o) {
    o = o || {}; const g = canvas.getContext("2d"); const W = canvas.width, H = canvas.height; g.clearRect(0, 0, W, H);
    let minX = 1e9, maxX = -1e9, minZ = 1e9, maxZ = -1e9; for (let i = 0; i < tr.n; i += 2) { if (tr.x[i] < minX) minX = tr.x[i]; if (tr.x[i] > maxX) maxX = tr.x[i]; if (tr.z[i] < minZ) minZ = tr.z[i]; if (tr.z[i] > maxZ) maxZ = tr.z[i]; }
    const pad = o.pad || 10; const sc = Math.min((W - pad * 2) / Math.max(1, maxX - minX), (H - pad * 2) / Math.max(1, maxZ - minZ)); const ox = (W - (maxX - minX) * sc) / 2, oz = (H - (maxZ - minZ) * sc) / 2;
    const P = (x, z) => [ox + (maxX - x) * sc, oz + (maxZ - z) * sc + 0]; // +z vers le haut, +x vers la gauche comme à l'écran
    const colr = ["#c8ccd8", "#c49a6a", "#9fdcff", "#ff9a1a", "#e0a0ff"]; g.lineCap = "round"; g.lineWidth = o.lw || 5;
    const FMp = TR.forkMap(tr);
    for (let i = 0; i < tr.n - 1; i++) {
      g.strokeStyle = (tr.flags[i] & 4) ? "#b57aff" : (tr.vw && tr.vw[i] > 0.3) ? "#e8c890" : colr[tr.surf[i]] || "#c8ccd8"; if (tr.flags[i] & 8) { g.setLineDash([2, 6]); } else g.setLineDash([]);
      if (FMp[i] >= 0 && FMp[i + 1] === FMp[i]) { const f = tr.forks[FMp[i]]; const g0 = TR.forkGeo(f, i); const ca = [(g0.a0 + g0.a1) / 2, (g0.b0 + g0.b1) / 2]; const g1 = TR.forkGeo(f, i + 1); const cb = [(g1.a0 + g1.a1) / 2, (g1.b0 + g1.b1) / 2];
        [0, 1].forEach((k) => { const pa = P(tr.x[i] - Math.cos(tr.h[i]) * ca[k], tr.z[i] + Math.sin(tr.h[i]) * ca[k]), pb = P(tr.x[i + 1] - Math.cos(tr.h[i + 1]) * cb[k], tr.z[i + 1] + Math.sin(tr.h[i + 1]) * cb[k]); const lw0 = g.lineWidth; g.lineWidth = lw0 * 0.6; g.strokeStyle = f.lanes[k].s === 1 ? colr[1] : "#c8ccd8"; g.beginPath(); g.moveTo(pa[0], pa[1]); g.lineTo(pb[0], pb[1]); g.stroke(); g.lineWidth = lw0; }); continue; }
      const a = P(tr.x[i], tr.z[i]), b = P(tr.x[i + 1], tr.z[i + 1]); g.beginPath(); g.moveTo(a[0], a[1]); g.lineTo(b[0], b[1]); g.stroke();
    }
    const dot = (p, c, r) => { g.fillStyle = c; g.strokeStyle = "#14172b"; g.lineWidth = 2; g.beginPath(); g.arc(p[0], p[1], r, 0, 6.3); g.fill(); g.stroke(); };
    g.setLineDash([]);
    for (let i = 0; i < tr.n; i++) if (tr.flags[i] & 2) dot(P(tr.x[i], tr.z[i]), "#ff6a8a", 3);
    (tr.obs || []).forEach((ob) => dot(P(ob.x, ob.z), "#ffb347", 1.8));
    tr.cps.forEach((c) => dot(P(tr.x[c], tr.z[c]), "#33e0ff", 3));
    (tr.rings || []).forEach((rg) => dot(P(tr.x[rg.i], tr.z[rg.i]), "#ffcf33", 2));
    dot(P(tr.x[tr.start.idx], tr.z[tr.start.idx]), "#7aff7a", 5); dot(P(tr.x[tr.n - 3], tr.z[tr.n - 3]), "#ffffff", 5);
    (o.dots || []).forEach((d) => dot(P(d.x, d.z), d.hex, d.big ? 6 : 5));
  }

  // ---------- entrées ----------
  function wireInput() {
    $("#btn-menu").onclick = openMenu; $("#btn-cam").onclick = () => { const m = V.cycleCam(); toast(["Caméra poursuite", "Caméra haute", "Caméra capot"][m], "info"); };
    $("#btn-giveup").onclick = () => Kit.confirm("Abandonner ? Tu sors de la course et tu ne pourras plus rejouer cette manche.", () => { if (G.run && !G.run.finishSent) G.run = null; Kit.socket.emit("z:giveup"); });
    $("#btn-restart").onclick = restartAttempt; $("#btn-respawn").onclick = () => { G.rstReq = true; };
    const hold = (id, key) => { const b = $("#" + id); const on = (e) => { e.preventDefault(); G.touch[key] = true; b.classList.add("on"); engineStart(); }; const off = (e) => { e.preventDefault(); G.touch[key] = false; b.classList.remove("on"); }; b.addEventListener("pointerdown", on); b.addEventListener("pointerup", off); b.addEventListener("pointerleave", off); b.addEventListener("pointercancel", off); };
    hold("t-left", "left"); hold("t-right", "right"); hold("t-gas", "gas"); hold("t-brake", "brake");
    window.addEventListener("keydown", (e) => {
      if (document.body.dataset.screen !== "game") return; if (/INPUT|TEXTAREA|SELECT/.test(e.target.tagName || "")) return;
      const k = e.key.toLowerCase(); G.keys[k] = true; engineStart();
      if (["arrowup", "arrowdown", "arrowleft", "arrowright", " ", "enter", "shift"].includes(k)) e.preventDefault();
      if (e.repeat) return;
      if (k === " ") V.lookBack(true);
      if (G.specId && !canDriveNow() && (k === "arrowleft" || k === "arrowright")) specMove(k === "arrowleft" ? -1 : 1);
      if (k === "enter") restartAttempt(); else if (k === "shift") G.rstReq = true; else if (k === "c") { const m = V.cycleCam(); toast(["Caméra poursuite", "Caméra haute", "Caméra capot"][m], "info"); }
    });
    window.addEventListener("keyup", (e) => { const k = e.key.toLowerCase(); G.keys[k] = false; if (k === " ") V.lookBack(false); });
    { const bb = $("#btn-back"); const on = (e) => { e.preventDefault(); V.lookBack(true); }, off = () => V.lookBack(false); bb.addEventListener("pointerdown", on); bb.addEventListener("pointerup", off); bb.addEventListener("pointerleave", off); bb.addEventListener("pointercancel", off); }
    $("#spec-prev").onclick = () => specMove(-1); $("#spec-next").onclick = () => specMove(1);
    window.addEventListener("blur", () => { G.keys = {}; V.lookBack(false); });
  }
  function openMenu() {
    const q = store.get("zoom.quality", autoQuality()); const qs = [["low", "Basse"], ["medium", "Moyenne"], ["high", "Haute"]];
    const row = (title, info, control) => el("div", { class: "menu-row" }, [el("div", {}, [el("b", { text: title }), el("p", { class: "small muted", text: info })]), control]);
    const qbox = el("div", { class: "chips" }, qs.map(([v, l]) => el("button", { class: "chip" + (q === v ? " chip--on" : ""), text: l, onclick: (ev) => { store.set("zoom.quality", v); V.setQuality(v); ev.target.parentNode.querySelectorAll(".chip").forEach((c) => c.classList.remove("chip--on")); ev.target.classList.add("chip--on"); } })));
    const cbtn = el("button", { class: "btn btn--small btn--ghost", text: PicuiteGL.compat() ? "Compatibilité activée" : "Compatibilité coupée", onclick: () => PicuiteGL.setCompat(!PicuiteGL.compat()) });
    const sbtn = el("button", { class: "btn btn--small btn--ghost", text: sound.enabled ? "Son activé" : "Son coupé", onclick: (ev) => { ev.target.textContent = sound.toggle() ? "Son activé" : "Son coupé"; } });
    const keys = el("div", { class: "keys" }, [
      el("kbd", { text: "↑ ↓ ← →" }), el("span", { text: "Flèche du haut pour accélérer, flèche du bas pour freiner puis reculer, flèches de côté pour tourner." }),
      el("kbd", { text: "Entrée" }), el("span", { text: "En mode essence, recommence l'essai depuis la ligne de départ et l'essence déjà brûlée est perdue. En chrono fantôme et contact, on n'a qu'un seul essai, la touche sert à abandonner et demande une confirmation." }),
      el("kbd", { text: "Maj" }), el("span", { text: "Revenir au dernier point de contrôle franchi, le chrono continue." }),
      el("kbd", { text: "C" }), el("span", { text: "Changer de caméra." }),
      el("kbd", { text: "Espace" }), el("span", { text: "Regarder derrière soi tant que la touche est enfoncée, comme dans un rétroviseur." }),
      el("kbd", { text: "← →" }), el("span", { text: "Une fois ta course finie en chrono, changer de pilote suivi par la caméra." }),
      el("kbd", { text: "Manette" }), el("span", { text: "Stick gauche pour tourner, gâchette droite pour accélérer, gauche pour freiner, carré pour revenir au point de contrôle, triangle pour recommencer ou abandonner, bouton L1 pour regarder derrière." }),
    ]);
    const cars = el("div", {}, CA.CAR_ORDER.map((id) => el("p", { class: "small", text: CA.CARS[id].icon + " " + CA.CARS[id].name + " · " + CA.CARS[id].desc })));
    Kit.showModal("Menu", [row("Qualité graphique", "Basse retire les ombres et allège l'affichage, utile sur téléphone ou ordinateur modeste.", qbox), row("Mode compatibilité", "Affichage 3D le plus simple possible, sans ombres ni reflets. À essayer si l'écran reste blanc ou noir, c'est le cas de certains Mac. La page se recharge. Activé par défaut sur Safari.", cbtn), row("Sons", "Moteur, points de contrôle et arrivées.", sbtn),
      el("h3", { text: "Commandes", style: { marginTop: "0.8rem" } }), keys, el("h3", { text: "Les voitures", style: { marginTop: "0.8rem" } }), cars,
      el("button", { class: "btn btn--danger btn--small", style: { marginTop: "0.8rem" }, text: "Quitter la partie", onclick: () => Kit.confirm("Quitter la partie et revenir à l'accueil ?", () => { $("#modal").classList.add("hidden"); Kit.leave(); }) })]);
  }

  // ---------- aspiration ----------
  // positions des voitures des autres pilotes, telles qu'elles sont affichées, pour savoir si l'on roule dans leur sillage
  function draftOthers() {
    const out = []; const t = Date.now();
    Object.keys(G.snaps).forEach((id) => { if (id === myId()) return; const sn = G.snaps[id]; if (t - sn.at > 450) return; const c = V.cars[id]; if (!c || !c.init || !c.root.visible || c.ghost) return; out.push({ x: c.st.x, z: c.st.z, y: c.st.y }); });
    return out;
  }

  // ---------- spectateur ----------
  // après son essai en chrono, on peut suivre la caméra des pilotes encore en piste
  function specCandidates() { const t = Date.now(); return (G.st ? G.st.players : []).filter((p) => p.id !== myId() && G.snaps[p.id] && t - G.snaps[p.id].at < 1500 && V.cars[p.id] && V.cars[p.id].root.visible).map((p) => p.id); }
  function updateSpec(s, run) {
    const box = $("#z-spec"); if (!box) return;
    const can = isChrono(G.mode) && s.phase === "race" && (!run || run.done) && !G.waiting && G.myDone;
    const list = can ? specCandidates() : [];
    if (!list.length) { G.specId = null; box.classList.add("hidden"); return; }
    if (!G.specId || !list.includes(G.specId)) { let best = null, bi = -1; list.forEach((id) => { const sn = G.snaps[id]; if (sn && sn.i > bi) { bi = sn.i; best = id; } }); G.specId = best; }
    box.classList.remove("hidden"); const nm = $("#spec-name"); const txt = "Tu regardes " + nameOf(G.specId); if (nm.textContent !== txt) nm.textContent = txt;
  }
  function specMove(d) { const list = specCandidates(); if (!list.length) return; const k = Math.max(0, list.indexOf(G.specId)); G.specId = list[(k + d + list.length) % list.length]; V.resetFollow(); }

  // ---------- replays de fin de partie ----------
  function hideReplayBar() { const b = $("#z-replay"); if (b) { b.classList.add("hidden"); b.innerHTML = ""; } V.setTV && V.setTV(false); }
  function onReplayData(m) {
    const ov = G.overInfo; if (!ov || !ov.replays) return;
    let tr = null; try { tr = ZR.trackFor(ov.replays.settings, ov.seed, m.i); } catch (e) { console.error(e); }
    if (!tr || !m.cars || !m.cars.length) { toast("Ce replay n'est pas disponible.", "error"); return; }
    G.track = tr; V.loadTrack(tr); V.resize(); V.removeAllCars(); closeSheet();
    const players = {}; (ov.players || []).forEach((p) => { players[p.id] = p; });
    G.replay = { i: m.i, cars: m.cars.map((c) => ({ id: c.id, car: c.car, time: c.time, frames: c.frames, name: (players[c.id] || {}).name || "?", hex: hexOf((players[c.id] || {}).color) })), t: -2.5, speed: 1, follow: 0, tv: false, name: m.name };
    G.replay.cars.sort((a, b) => a.time - b.time); V.setOrbit(null); V.resetFollow(); V.intro(1);
    const bar = $("#z-replay"); bar.innerHTML = ""; bar.classList.remove("hidden");
    const lbl = el("span", { id: "rp-label" });
    bar.appendChild(el("b", { text: "Replay, course " + (m.i + 1) + " · " + m.name })); bar.appendChild(lbl);
    bar.appendChild(el("div", { class: "rp-btns" }, [
      el("button", { class: "btn btn--small btn--ghost", text: "◀ Pilote", onclick: () => { G.replay.follow = (G.replay.follow + G.replay.cars.length - 1) % G.replay.cars.length; V.resetFollow(); } }),
      el("button", { class: "btn btn--small btn--ghost", text: "Pilote ▶", onclick: () => { G.replay.follow = (G.replay.follow + 1) % G.replay.cars.length; V.resetFollow(); } }),
      el("button", { class: "btn btn--small btn--ghost", id: "rp-speed", text: "Vitesse x1", onclick: (e) => { G.replay.speed = G.replay.speed === 1 ? 2 : G.replay.speed === 2 ? 0.5 : 1; e.target.textContent = "Vitesse x" + String(G.replay.speed).replace(".", ","); } }),
      el("button", { class: "btn btn--small btn--ghost", id: "rp-tv", text: "Caméra télé", onclick: (e) => { G.replay.tv = !G.replay.tv; V.setTV(G.replay.tv); e.target.textContent = G.replay.tv ? "Caméra poursuite" : "Caméra télé"; } }),
      el("button", { class: "btn btn--small btn--ghost", text: "Revoir depuis le départ", onclick: () => { G.replay.t = -1; V.resetFollow(); } }),
      el("button", { class: "btn btn--small btn--accent", text: "Retour aux résultats", onclick: endReplay }),
    ]));
  }
  function endReplay() { G.replay = null; hideReplayBar(); V.removeAllCars(); if (G.overInfo) onOver(G.overInfo); }
  function replayFrame(dt) {
    const R = G.replay; R.t += dt * R.speed; const t = Math.max(0, R.t); let last = 0;
    R.cars.forEach((c, k) => {
      const f = c.frames; const nF = f.length / 8; last = Math.max(last, c.time);
      const fi = t * 10; const q = Math.min(nF - 2, Math.floor(fi)); const u = clamp(fi - q, 0, 1); const o = q * 8, o2 = o + 8; const L = (a, b) => a + (b - a) * u;
      const hd = f[o + 3] + ((((f[o2 + 3] - f[o + 3]) % 6.2832) + 9.4248) % 6.2832 - 3.1416) * u;
      const id = "rp" + k; V.ensureCar(id, c.car, c.hex, false, c.name + (t >= c.time ? " " + fmtS(c.time) : ""));
      V.setCarState(id, { x: L(f[o], f[o2]), y: L(f[o + 1], f[o2 + 1]), z: L(f[o + 2], f[o2 + 2]), h: hd, p: f[o + 4], a: f[o + 5], i: L(f[o + 7], f[o2 + 7]), b: f[o + 6], speed: t < c.time ? Math.hypot(f[o2] - f[o], f[o2 + 2] - f[o + 2]) * 10 : 0 }, false);
    });
    V.follow("rp" + R.follow);
    const fc = R.cars[R.follow]; const lb = $("#rp-label"); const txt = "Caméra sur " + fc.name + " · " + fmt(t) + " s" + (R.speed !== 1 ? " · x" + String(R.speed).replace(".", ",") : ""); if (lb && lb.textContent !== txt) lb.textContent = txt;
    const tEl = $("#z-time"); if (tEl) { const tt = fmt(Math.min(t, fc.time)) + "<small>s</small>"; if (G.lastDom.t !== tt) { tEl.innerHTML = tt; G.lastDom.t = tt; } }
    $("#z-speed").style.visibility = "hidden"; $("#z-race").classList.add("hidden"); $("#z-rec").style.visibility = "hidden"; $("#z-fuel").classList.add("hidden"); $("#z-spec").classList.add("hidden");
    if (R.t > last + 3) { R.t = -1.5; setBanner("Fin du replay", "Il recommence depuis le départ", 2200); }
  }

  function elementsText(t) {
    const st = t.stats || {}; const parts = []; const pl = (n, a, b) => n + " " + (n > 1 ? b : a);
    if (st.loops) parts.push(pl(st.loops, "looping", "loopings")); if (st.rolls) parts.push(pl(st.rolls, "vrille", "vrilles")); if (st.walls) parts.push(pl(st.walls, "mur à grimper", "murs à grimper")); if (st.ceilings) parts.push(pl(st.ceilings, "plafond", "plafonds"));
    if (st.gaps) parts.push(pl(st.gaps, "trou à sauter", "trous à sauter")); if (st.steep) parts.push(pl(st.steep, "côte raide", "côtes raides")); if (st.bridges) parts.push(pl(st.bridges, "pont sans rebord", "ponts sans rebord")); if (st.necks) parts.push(pl(st.necks, "passage étroit ou large", "passages étroits ou larges")); if (st.obstacles) parts.push(pl(st.obstacles, "série d'obstacles", "séries d'obstacles"));
    if (st.forks) parts.push(pl(st.forks, "embranchement", "embranchements")); if (st.cross) parts.push(pl(st.cross, "croisement sur deux niveaux", "croisements sur deux niveaux")); if (st.tunnels) parts.push(pl(st.tunnels, "tunnel", "tunnels")); if (st.movers) parts.push(pl(st.movers, "route qui bouge", "routes qui bougent")); if (st.tubes) parts.push(pl(st.tubes, "tube à l'envers", "tubes à l'envers")); if (st.rings) parts.push(pl(st.rings, "anneau turbo", "anneaux turbo")); if (st.doubles) parts.push(pl(st.doubles, "double saut", "doubles sauts")); if (st.plongeons) parts.push(pl(st.plongeons, "plongeon", "plongeons")); if (st.verge > 40) parts.push(Math.round(st.verge) + " m de bas-côtés sans barrière");
    return parts.length ? "Au programme " + parts.join(", ") + "." : "Un circuit sans élément spécial.";
  }
  // ---------- aperçu dans le salon ----------
  function renderPreview(box, room) {
    const s = room.settings; const host = Kit.isHost(); const seeded = !!(s.seed && s.seed.trim());
    if (!seeded && !G.prev.seed) G.prev.seed = Math.random().toString(36).slice(2, 8);
    const seed = seeded ? s.seed.trim() : G.prev.seed; if (seeded && G.prev.idx >= s.rounds) G.prev.idx = 0; const idx = seeded ? G.prev.idx : 0;
    const key = JSON.stringify([s.biomes, s.biomeOrder, s.trackSize, s.difficulty, s.elements, s.hills, s.features, s.rnd, s.crashRnd, seed, idx]);
    if (key !== G.prev.key) { try { G.prev.track = ZR.trackFor(s, seed, idx); } catch (e) { G.prev.track = null; console.error(e); } G.prev.key = key; }
    box.innerHTML = ""; const t = G.prev.track; if (!t) return; const B = TR.BIOMES[t.biome];
    const cv = el("canvas", { width: 340, height: 340, style: { width: "170px", height: "170px", borderRadius: "12px", background: "#14172b", flex: "none" } });
    const jumps = t.flags.filter((f) => f & 2).length, boosts = (() => { let c = 0, p = false; for (let i = 0; i < t.n; i++) { const b = !!(t.flags[i] & 1); if (b && !p) c++; p = b; } return c; })();
    const info = el("div", { style: { flex: 1, minWidth: "140px" } }, [
      el("div", { class: "meta", text: B.icon + " " + t.name }), el("p", { class: "small", text: B.name + " · " + Math.round(t.length) + " m · environ " + Math.round(t.length / 27) + " s de conduite" }),
      t.drawn && t.drawn.length ? el("p", { class: "small", text: "Tiré au sort pour cette course, " + t.drawn.join(", ") }) : null,
      el("p", { class: "small muted", text: elementsText(t) }),
      el("p", { class: "small muted", text: (jumps ? jumps + " bosse" + (jumps > 1 ? "s" : "") + " à sauter. " : "") + (boosts ? boosts + " tapis turbo. " : "") + (t.surf.some((v) => v === 2) ? "De la glace. " : "") + (t.surf.some((v) => v === 1) ? "De la terre. " : "") + (t.surf.some((v) => v === 4) ? "Un sol collant. " : "") }),
      el("p", { class: "small muted", text: seeded ? "Parcours fixé par la graine " + seed + (s.rounds > 1 ? ". Course " + (idx + 1) + " sur " + s.rounds + "." : ".") : "Simple aperçu d'un circuit possible. Fixe la graine pour jouer exactement celui-ci." }),
      el("div", { class: "row" }, [
        seeded && s.rounds > 1 ? el("button", { class: "btn btn--small btn--ghost", text: "◀", onclick: () => { G.prev.idx = (idx + s.rounds - 1) % s.rounds; renderPreview(box, Kit.room); } }) : null,
        seeded && s.rounds > 1 ? el("button", { class: "btn btn--small btn--ghost", text: "▶", onclick: () => { G.prev.idx = (idx + 1) % s.rounds; renderPreview(box, Kit.room); } }) : null,
        seeded ? (host ? el("button", { class: "btn btn--small btn--green", text: "Générer d'autres circuits", onclick: () => { G.prev.idx = 0; Kit.socket.emit("room:settings", { settings: { seed: Math.random().toString(36).slice(2, 8) } }); } }) : null)
          : el("button", { class: "btn btn--small btn--green", text: "Générer un autre circuit", onclick: () => { G.prev.seed = Math.random().toString(36).slice(2, 8); renderPreview(box, Kit.room); } }),
        !seeded && host ? el("button", { class: "btn btn--small btn--accent", text: "Jouer ce parcours", onclick: () => { G.prev.idx = 0; Kit.socket.emit("room:settings", { settings: { seed } }); } }) : null,
        seeded && host ? el("button", { class: "btn btn--small btn--ghost", text: "Retirer la graine", onclick: () => Kit.socket.emit("room:settings", { settings: { seed: "" } }) }) : null,
      ]),
    ]);
    box.appendChild(el("div", { class: "lobby-prev" }, [el("h3", { text: "Aperçu du circuit" }), el("div", { style: { display: "flex", gap: "0.8rem", flexWrap: "wrap", marginTop: "0.4rem" } }, [cv, info])]));
    drawMap(cv, t, { lw: 6, pad: 14 });
  }

  // ---------- démarrage ----------
  function attach() {
    const so = Kit.socket; if (!so || G.attached) return; G.attached = true;
    so.on("z:round", onRound); so.on("z:author", (m) => { G.author = m.time; G.lastGar = 0; }); so.on("z:state", onState); so.on("z:turn", onTurn); so.on("z:record", onRecord); so.on("z:go", onGo); so.on("z:snap", onSnap);
    so.on("z:turnEnd", onTurnEnd); so.on("z:result", onResult); so.on("z:botTurn", onBotTurn); so.on("z:roundEnd", onRoundEnd); so.on("z:over", (m) => { G.overSound = false; onOver(m); }); so.on("z:replayData", onReplayData);
  }
  // envoi régulier de la position pendant un essai
  const sendPos = () => { const r = G.run; if (!r || r.done || !Kit.socket || r.countdown > 0 || !canDrive()) return; const a = r.r; const fx = Math.sin(a.hd), fz = Math.cos(a.hd); Kit.socket.emit("z:pos", { c: Date.now(), x: +a.x.toFixed(2), y: +a.y.toFixed(2), z: +a.z.toFixed(2), vx: +a.vx.toFixed(2), vz: +a.vz.toFixed(2), h: +a.hd.toFixed(3), p: +a.pitch.toFixed(3), a: a.rail ? 2 : a.air ? 1 : 0, i: +a.idx.toFixed(2), b: a.boostT > 0 ? 1 : 0 }); };
  setInterval(sendPos, 50);
  Kit.on("screen", (name) => { V.paused = name !== "game"; if (name === "game") setTimeout(() => { if (G.viewInit) V.resize(); }, 50); });
  Kit.on("reset", () => { G.st = null; G.track = null; G.run = null; closeSheet(); G.prev.key = ""; });
  Kit.on("room", (r) => { if (r.status === "lobby") { G.st = null; G.run = null; closeSheet(); G.lastState = ""; } });
  window.ZoomGame = G;
  // temps de course de la voiture suivie, pour animer les routes qui bougent exactement comme la physique
  V.moverClock = () => {
    if (G.replay) return Math.max(0, G.replay.t); const s = G.st; const now = snow();
    if (G.run && !G.run.done && (!G.specId)) return G.run.r.tick / 60;
    if (s && s.phase === "turns" && s.turn && s.turn.pid !== myId()) { const bc = botClock(); if (bc) return bc.t; if (s.turn.goAt) return Math.max(0, (now - s.turn.goAt) / 1000); }
    if (s && s.goAt && now > s.goAt) return (now - s.goAt) / 1000; return performance.now() / 1000;
  };

  Kit.init({
    id: "zoomalou", title: "Zoomalou", emoji: "🏎️", ribbon: "Vroum à l'infini", tagline: "Des circuits qui n'existent pas encore et un réservoir qui se vide.",
    createLabel: "Créer un salon", soloLabel: "Jouer contre des bots", startLabel: "Lancer la partie", helpTitle: "Comment jouer",
    floaters: [{ e: "🏎️", x: 6 }, { e: "🏁", x: 22 }, { e: "⛽", x: 38 }, { e: "🚀", x: 52 }, { e: "🌴", x: 66 }, { e: "⛄", x: 80 }, { e: "🍭", x: 92 }],
    colors: COLORS, botLevels: LEVELS, maxPlayers: 8, minPlayers: 1, schema: ZR.SCHEMA,
    help: [
      { title: "Le but", text: "Chaque course se joue sur un circuit généré au hasard. Il s'agit de franchir la ligne d'arrivée le plus vite possible, en passant par tous les points de contrôle." },
      { title: "Le mode essence", text: "Le premier pilote pose un temps. Ensuite chaque autre pilote, à son tour, a un réservoir limité pour le battre. Chaque essai consomme de l'essence, y compris ceux qu'on abandonne. Quand le réservoir est vide, l'essai en cours peut quand même aller jusqu'au bout. S'il bat le record il devient le nouveau record à battre, sinon il tombe en panne et passe la main." },
      { title: "Le chrono fantôme", text: "Tout le monde part en même temps depuis la même ligne de départ, très large pour que ce soit équitable. Chacun n'a droit qu'à un seul essai, sans recommencer ni remettre le chrono à zéro. Le meilleur temps gagne, et la course s'arrête dès que tout le monde a fini. Les voitures des autres sont transparentes et ne gênent jamais." },
      { title: "Le chrono contact", text: "Le même principe, mais les voitures sont solides. On se pousse, on se bloque, on peut faire perdre son temps à un adversaire en lui coupant la route. Les pilotes automatiques roulent pour de vrai, ils se font pousser et se rattrapent. Rouler dans le sillage d'une voiture donne l'aspiration" },
      { title: "Piloter", text: "Les quatre flèches pilotent, haut pour accélérer, bas pour freiner et reculer, côtés pour tourner. Entrée recommence l'essai à zéro en mode essence et sert à abandonner en chrono, Maj ramène au dernier point de contrôle sans arrêter le chrono, Espace fait regarder derrière soi. Les tapis orange donnent un coup de turbo, les violets un super turbo, et traverser un anneau doré aussi." },
      { title: "Le turbo de dérapage", text: "Tenir un dérapage charge un turbo en trois paliers, étincelles bleues, puis orange, puis violettes. Plus le dérapage dure, plus le turbo de sortie est long. La Toupie et la Libellule en tirent les plus gros." },
      { title: "L'aspiration", text: "En chrono contact, rouler juste derrière une autre voiture donne un peu plus de vitesse, de quoi la rattraper puis la dépasser. Des traînées de vent et le mot Aspiration apparaissent quand ça marche." },
      { title: "Embranchements et bas-côtés", text: "Quand la route se sépare, choisis ta voie avant le butoir jaune et noir. La voie courte cache toujours un piège. Sur les bas-côtés sans barrière, sortir de la route freine fort et fait glisser, sauf avec la Rallye-Pote qui y est à l'aise." },
      { title: "Suivre les autres et revoir les courses", text: "En chrono, une fois ta course finie, les flèches gauche et droite changent le pilote suivi par la caméra. À la fin de la partie, chaque course peut être revue en replay, avec la caméra poursuite ou une caméra télé." },
      { title: "Les sols", text: "Le bitume accroche, la terre un peu moins, la glace très peu, et le sol collant ralentit. Les bas-côtés de sable, d'herbe ou de neige freinent fort. Chaque voiture réagit différemment, la Rallye-Pote adore la terre, la glace et les bas-côtés." },
      { title: "Les biomes", text: "Côte est la référence. Neige glisse partout. Néon a une gravité faible et des anneaux turbo. Mégapole retourne la voiture dans des tubes. Jungle multiplie la terre et les embranchements. Usine fait bouger la route. Fête foraine croise ses routes et plonge. Dunes n'a presque pas de murs." },
      { title: "Les points", text: "En essence, la voiture qui détient le record à la fin gagne 3 points, et celle qui l'a détenu juste avant 1 point. En chrono, les points dépendent du classement des meilleurs temps." },
    ],
    theme: { a1: "#ffd66b", a2: "#f08a24", bg1: "#2b2f6a", bg2: "#14172b" },
    renderPreview,
    onInit() { buildGame(); attach(); Kit.on("connect", attach); },
  });
})();

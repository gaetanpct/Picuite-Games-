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
    cpBanner: 0, lastState: "",
  };
  const snow = () => Date.now() + G.offset;
  const S = () => (Kit.room && Kit.room.settings) || ZR.defaults();
  const myId = () => { const p = Kit.me(); return p ? p.id : null; };
  const stP = (id) => (G.st ? G.st.players.find((p) => p.id === id) : null);
  const me = () => stP(myId());
  const nameOf = (id) => { const p = stP(id); return p ? p.name : "?"; };
  const clock = (n) => { G.samples.push(n - Date.now()); if (G.samples.length > 12) G.samples.shift(); G.offset = Math.max.apply(null, G.samples); };

  // ---------- son du moteur ----------
  const eng = { ctx: null };
  function engineStart() {
    if (eng.ctx || !sound.enabled) return;
    try {
      const ctx = new (window.AudioContext || window.webkitAudioContext)(); const osc = ctx.createOscillator(); osc.type = "sawtooth"; const filt = ctx.createBiquadFilter(); filt.type = "lowpass"; filt.frequency.value = 700;
      const gain = ctx.createGain(); gain.gain.value = 0; osc.connect(filt); filt.connect(gain); gain.connect(ctx.destination); osc.start(); eng.ctx = ctx; eng.osc = osc; eng.filt = filt; eng.gain = gain;
    } catch (e) { /* pas de son */ }
  }
  function engineUpdate(speed, active) {
    if (!eng.ctx) return; const t = eng.ctx.currentTime;
    eng.osc.frequency.setTargetAtTime(48 + speed * 3.6, t, 0.05); eng.filt.frequency.setTargetAtTime(450 + speed * 20, t, 0.05);
    eng.gain.gain.setTargetAtTime(active && sound.enabled ? 0.03 + Math.min(0.03, speed / 60 * 0.03) : 0, t, 0.1);
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
      el("div", { id: "z-speed", class: "pill z-speed nopoint" }),
      el("div", { id: "z-center", class: "z-center nopoint" }),
      el("div", { id: "z-feed", class: "z-feed nopoint" }),
      el("div", { id: "z-tip", class: "z-tip nopoint" }),
      el("div", { class: "z-menu" }, [
        el("button", { class: "round-btn", id: "btn-menu", title: "Menu et commandes", text: "⚙️" }),
        el("button", { class: "round-btn", id: "btn-cam", title: "Changer de caméra", text: "🎥" }),
        el("button", { class: "round-btn", id: "btn-restart", title: "Recommencer l'essai", text: "↺" }),
        el("button", { class: "round-btn", id: "btn-respawn", title: "Revenir au dernier point de contrôle", text: "📍" }),
      ]),
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
    G.track = m.track; G.roundIdx = m.index; G.total = m.total; G.mode = m.mode; G.author = m.author; G.carId = m.car || G.carId; G.botPlan = null; G.order = m.order || [];
    G.run = null; G.myBest = null; G.myBestFrames = null; G.ghostFrames = null; G.record = null; G.snaps = {}; G.turn = null; G.wantArm = false; G.armedAt = 0; G.waiting = false;
    closeSheet(); V.loadTrack(G.track); V.resize(); V.removeAllCars(); setBanner("Course " + (m.index + 1) + " sur " + m.total, G.track.name + " · " + TR.BIOMES[G.track.biome].name, 2600);
  }
  function onRecord(m) {
    G.record = { time: m.time, pid: m.pid, car: m.car, frames: m.frames }; if (G.mode === "essence") { G.ghostFrames = m.frames; G.ghostCar = m.car; G.ghostPtr = 0; }
  }
  function onTurn(m) {
    if (!m) return; clock(m.now); G.turn = m; G.run = null; G.wantArm = false; G.armedAt = 0; G.waiting = false;
    if (m.record) { G.record = m.record; G.ghostFrames = m.record.frames; G.ghostCar = m.record.car; G.ghostPtr = 0; }
    if (m.pid === myId()) { setBanner("À toi de jouer", m.role === "setter" ? "Pose le temps à battre" : "Bats " + fmtS(m.record.time) + " avec " + Math.round(m.fuel) + " s d'essence", 2800); sound.tone(660, 0.15, "triangle", 0.1); sound.tone(880, 0.2, "triangle", 0.1, 0.12); }
    else setBanner("Au tour de " + nameOf(m.pid), m.role === "setter" ? "Il pose le temps à battre" : "Il a " + Math.round(m.fuel) + " s d'essence", 2600);
    V.resetGates();
  }

  // ---------- état ----------
  function onState(s) {
    clock(s.now); const old = G.st; G.st = s; if (s.car) G.carId = s.car;
    if (!G.track) return;
    if (s.turn && (!G.turn || G.turn.pid !== s.turn.pid || G.turn.idx !== s.turn.idx)) { /* z:turn arrive juste avant */ }
    if (G.turn && s.turn) { G.turn.fuelLeft = s.turn.fuelLeft; G.turn.tries = s.turn.tries; G.turn.goAt = s.turn.goAt; G.turn.ended = s.turn.ended; }
    if (s.phase !== G.lastState) {
      G.lastState = s.phase;
      if (s.phase === "garage") { G.run = null; renderGarage(); setBanner("Au garage", "Choisis ta voiture", 1800); V.removeAllCars(); }
      if (s.phase === "race") { hideGarage(); G.wantArm = true; G.armedAt = 0; }
      if (s.phase === "turns") hideGarage();
      if (s.phase === "roundEnd") { G.run = null; }
    }
    if (s.phase === "garage") renderGarage();
    renderBoard();
  }

  // ---------- pilotage ----------
  function arm() { if (G.armedAt && Date.now() - G.armedAt < 1200) return; G.armedAt = Date.now(); G.waiting = true; Kit.socket.emit("z:attempt"); }
  function onGo(m) {
    clock(m.now); G.waiting = false; const car = G.carId || m.car || "bolide";
    G.run = { r: CA.newRun(G.track, car), bytes: [], goAt: m.goAt, fuelTicks: m.fuelLeft > 0 ? Math.floor(m.fuelLeft * 60) : 1e12, fuel0: m.fuelLeft || 0, challenger: m.fuelLeft > 0, frames: [], done: false, car, cpShown: 0, out: false, finishSent: false, gptr: 0, lastGo: 0 };
    G.ghostPtr = 0; V.resetGates(); V.resetFollow(); G.armedAt = 0; G.cpBanner = 0;
    G.ghostT0 = m.goAt;
    const cm = me(); V.ensureCar("me", car, hexOf(cm ? cm.color : 0), false, null); engineStart();
  }
  function inputNow() {
    const k = G.keys, t = G.touch; let steer = 0;
    if (k.arrowleft || t.left) steer -= 1; if (k.arrowright || t.right) steer += 1;
    let thr = (k.arrowup || t.gas) ? 1 : 0, brk = (k.arrowdown || t.brake) ? 1 : 0;
    const gp = navigator.getGamepads ? navigator.getGamepads()[0] : null;
    if (gp) { const ax = gp.axes[0] || 0; if (Math.abs(ax) > 0.12) steer = clamp(ax, -1, 1); if ((gp.buttons[7] && gp.buttons[7].value > 0.1) || (gp.buttons[0] && gp.buttons[0].pressed)) thr = 1; if (gp.buttons[6] && gp.buttons[6].value > 0.1) brk = 1; if (gp.buttons[2] && gp.buttons[2].pressed && !G.gpRst) { G.rstReq = true; G.gpRst = true; } if (!(gp.buttons[2] && gp.buttons[2].pressed)) G.gpRst = false; if (gp.buttons[3] && gp.buttons[3].pressed && !G.gpRs) { G.gpRs = true; restartAttempt(); } if (!(gp.buttons[3] && gp.buttons[3].pressed)) G.gpRs = false; }
    const rst = G.rstReq ? 1 : 0; G.rstReq = false;
    return { steer, thr, brk, rst };
  }
  function restartAttempt() {
    const s = G.st; if (!s) return;
    if (s.phase === "race" || (s.phase === "turns" && s.turn && s.turn.pid === myId() && !s.turn.ended && !s.turn.auto)) {
      if (G.run && !G.run.finishSent) { Kit.socket.emit("z:end", { kind: "restart" }); }
      G.run = null; G.armedAt = 0; setTimeout(arm, 150);
    }
  }
  function myTurnActive() { const s = G.st; return !!(s && s.phase === "turns" && s.turn && s.turn.pid === myId() && !s.turn.ended && !s.turn.auto); }
  function canDrive() { const s = G.st; if (!s) return false; return s.phase === "race" || myTurnActive(); }

  // ---------- boucle de rendu ----------
  function onFrame(dt) {
    if (document.body.dataset.screen !== "game" || !G.st || !G.track) return;
    const s = G.st; const now = snow(); const tr = G.track; const cm = me();
    const run = G.run;
    // armement automatique
    if (s.phase === "race" && G.wantArm && !run && !G.waiting) { arm(); }
    if (myTurnActive() && !run && !G.waiting && now > (s.turn.introUntil || 0) && (s.turn.role === "setter" ? s.turn.tries < S().refTries : s.turn.fuelLeft > 0.05) && !s.turn.goAt) { G.autoArm = G.autoArm || performance.now(); if (performance.now() - G.autoArm > 300) { arm(); G.autoArm = 0; } }
    // simulation locale
    let speed = 0, shownTime = null, active = false;
    if (run && !run.done) {
      const want = Math.floor((now - run.goAt) / (1000 / 60)); const r = run.r;
      if (want < 0) { run.countdown = Math.ceil(-want / 60); }
      else {
        run.countdown = 0; let n = 0;
        while (r.tick < want && !r.finished && n < 8) {
          const inp = inputNow(); if (r.tick >= run.fuelTicks) { inp.thr = 0; run.out = true; }
          const q = CA.quant(inp); run.bytes.push(CA.packInput(q)); CA.step(r, q); n++;
          if (r.tick % 6 === 1) run.frames.push(r.x, r.y, r.z, r.hd, r.pitch, r.air ? 1 : 0, r.boostT > 0 ? 1 : 0, r.idx);
          if (r.cpEvt === r.tick) { V.flashGate(r.cp); Kit.sound.tone(880, 0.12, "triangle", 0.1); G.cpBanner = performance.now(); setBanner("Point de contrôle " + r.cp + " sur " + tr.cps.length, fmtS(r.tick / 60), 1100); }
          if (r.wallHit > 5) { V.shake(Math.min(0.6, r.wallHit * 0.03)); Kit.sound.noise(0.12, 0.08, 0, 900); }
          if (r.landed > 3 && r.tick - (run.lastLand || 0) > 10) { run.lastLand = r.tick; V.puff(r.x, r.y + 0.3, r.z, "#dddddd", 6, 3, 1, 1.2); r.landed = 0; }
          if (r.boostEvt === r.tick) { Kit.sound.tone(380, 0.3, "sawtooth", 0.07, 0, 900); V.shake(0.15); }
          if (r.lastResetTick === r.tick) { V.resetFollow(); setBanner("Retour au point de contrôle", null, 900); }
        }
        if (r.finished && !run.done) finishRun(run);
      }
      speed = Math.hypot(r.vx, r.vz); shownTime = want >= 0 ? r.tick / 60 : 0; active = want >= 0 && !r.finished;
    }
    // ma voiture
    const myRun = run && run.r;
    if (myRun && (canDrive() || run.done)) {
      const r = myRun; const car = V.ensureCar("me", run.car, hexOf(cm ? cm.color : 0), false, null);
      const inp = G.keys; const steer = ((inp.arrowright || G.touch.right) ? 1 : 0) - ((inp.arrowleft || G.touch.left) ? 1 : 0);
      const fx = Math.sin(r.hd), fz = Math.cos(r.hd); const vf = r.vx * fx + r.vz * fz, vl = r.vx * -Math.cos(r.hd) + r.vz * Math.sin(r.hd);
      V.setCarState("me", { x: r.x, y: r.y, z: r.z, h: r.hd, p: r.pitch, a: r.air, b: r.boostT > 0, speed: vf, steer: -r.steerV, skid: Math.abs(vl) > 4 && !r.air ? 1 : 0 }, false);
      car.skidCol = r.onSurf === 1 ? "#a07a50" : r.onSurf === 2 ? "#e0f4ff" : "#dddddd";
      if (r.onSurf === 1 && !r.air && vf > 15 && Math.random() < 0.3) V.puff(r.x - Math.sin(r.hd) * 1.6, r.y + 0.3, r.z - Math.cos(r.hd) * 1.6, "#b08a5a", 1, 1.5, 1, 1.1);
    } else if (cm && (s.phase === "garage" || s.phase === "race" || myTurnActive())) {
      const car = V.ensureCar("me", cm.car, hexOf(cm.color), false, null); const st = tr.start; V.setCarState("me", { x: st.x, y: st.y, z: st.z, h: st.h, p: 0, a: 0, b: 0, speed: 0 }, true);
    } else V.hideCar("me");
    // caméra
    const spectating = s.phase === "turns" && s.turn && s.turn.pid !== myId();
    if (s.phase === "garage" || s.phase === "roundEnd" || s.phase === "over") { V.setOrbit(true); V.follow("me"); }
    else { V.setOrbit(null); V.follow(spectating ? s.turn.pid : "me"); }
    // autres voitures
    const showOthers = S().others;
    Object.keys(G.snaps).forEach((id) => {
      const sn = G.snaps[id]; if (id === myId()) return; const live = Date.now() - sn.at < 1500;
      const isActive = spectating && s.turn.pid === id;
      if (!live || (!showOthers && !isActive)) { V.hideCar(id); return; }
      const p = stP(id); V.ensureCar(id, sn.car, hexOf(p ? p.color : 0), !isActive, isActive ? "" : (p ? p.name : "")); V.setCarTarget(id, sn);
    });
    // fantôme
    let gt = null;
    if (G.mode === "chrono") { G.ghostFrames = G.myBestFrames; G.ghostCar = run ? run.car : (cm ? cm.car : "bolide"); }
    const frames = G.ghostFrames; let ghostOn = false;
    if (S().ghost && frames && frames.length >= 16) {
      if (run && !run.done && run.countdown === 0) gt = run.r.tick / 60; else if (spectating) { const bc = botClock(); if (bc) gt = bc.gap ? null : bc.t; else if (s.turn.goAt) gt = (now - s.turn.goAt) / 1000; }
      if (gt != null && gt >= 0) { const nF = frames.length / 8 - 1; const f = gt * 10; const k = Math.min(nF - 1, Math.floor(f)); const u = clamp(f - k, 0, 1);
        if (f <= nF + 20) { const o = Math.min(nF - 1, k) * 8, o2 = o + 8; const L = (a, b) => a + (b - a) * u; const hd = frames[o + 3] + ((((frames[o2 + 3] - frames[o + 3]) % 6.2832) + 9.4248) % 6.2832 - 3.1416) * u;
          V.ensureCar("ghost", G.ghostCar, "#9fe8ff", true, "Record"); V.setCarState("ghost", { x: L(frames[o], frames[o2]), y: L(frames[o + 1], frames[o2 + 1]), z: L(frames[o + 2], frames[o2 + 2]), h: hd, p: frames[o + 4], a: frames[o + 5], b: frames[o + 6], speed: 20 }, false); ghostOn = true; } }
    }
    if (!ghostOn) V.hideCar("ghost");
    // interface
    updateHud(dt, run, speed, shownTime, gt);
    engineUpdate(speed, active && !(run && run.out && speed < 3));
  }

  function finishRun(run) {
    run.done = true; const r = run.r; const t = r.finishTime;
    if (!run.finishSent) { run.finishSent = true; Kit.socket.emit("z:end", { kind: "finish", bytes: bytesB64(run.bytes), time: t }); }
    Kit.sound.win(); setBanner(fmtS(t), r.resets ? "Arrivée avec " + r.resets + " retour" + (r.resets > 1 ? "s" : "") : "Arrivée", 2200);
    if (G.myBest == null || t < G.myBest) { G.myBest = t; G.myBestFrames = run.frames.slice(); }
    run.doneAt = performance.now();
    const rec = G.mode === "essence" && G.record ? G.record.time : null;
    if (rec != null) feed(t < rec ? "Record battu de " + fmt(rec - t) + " s" : "Il manque " + fmt(t - rec) + " s pour battre le record");
    // l'essai suivant démarre tout seul après une courte pause
    G.afterFinish = performance.now(); G.run = run;
    setTimeout(() => { if (G.run === run && canDrive() && !(G.st.turn && G.st.turn.ended)) { G.run = null; G.armedAt = 0; if (G.mode === "chrono") { G.waiting = false; arm(); } } }, 2600);
  }
  function bytesB64(arr) { let s = ""; for (let i = 0; i < arr.length; i += 0x8000) s += String.fromCharCode.apply(null, arr.slice(i, i + 0x8000)); return btoa(s); }

  // ---------- messages réseau ----------
  function onSnap(m) { m.cars.forEach((c) => { G.snaps[c.id] = Object.assign({ at: Date.now() }, c); }); }
  function onTurnEnd(m) {
    const nm = nameOf(m.pid);
    if (m.role === "setter") feed(nm + " pose " + fmtS(m.time));
    else if (m.result === "beat") { setBanner("Record battu", nm + " signe " + fmtS(m.time), 2600); sound.win(); } else { setBanner("Panne d'essence", nm + " n'a pas réussi", 2200); sound.fail(); }
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
      el("thead", {}, [el("tr", {}, [el("th", { text: "Pilote" }), el("th", { class: "r", text: "Meilleur temps" }), el("th", { class: "r", text: "Essais" }), el("th", { class: "r", text: "Points" }), el("th", { class: "r", text: "Total" })])]),
      el("tbody", {}, m.rows.map((r) => { const p = stP(r.id) || {}; const car = CA.CARS[r.car]; return el("tr", {}, [el("td", {}, [el("span", { class: "dotc", style: { background: hexOf(p.color) } }), (r.winner ? "🏆 " : "") + (p.name || "?") + (car ? " " + car.icon : "")]), el("td", { class: "r", text: r.best == null ? "-" : fmtS(r.best) }), el("td", { class: "r", text: String(r.tries || 0) }), el("td", { class: "r", text: "+" + r.pts }), el("td", { class: "r", text: String(r.total) })]); })),
    ]);
    const note = el("p", { id: "sheet-next", class: "muted small", text: "" });
    const info = el("p", { class: "muted", text: m.track + (m.author ? " · temps de l'auteur " + fmtS(m.author) : "") + (m.recordTime ? " · record final " + fmtS(m.recordTime) : "") });
    openSheet([el("h2", { text: "Course " + (m.index + 1) + " terminée" }), info, tbl, note]); G.sheet = { kind: "end", note };
  }
  function onOver(m) {
    G.endInfo = null; const rows = m.rows; const top = rows.slice(0, 3); const order = top.length === 1 ? [top[0]] : top.length === 2 ? [top[1], top[0]] : [top[1], top[0], top[2]];
    const pod = el("div", { class: "podium" }, order.map((r) => el("div", { class: "pod pod--" + r.rank }, [el("div", { class: "pod__ball", style: { background: hexOf(r.color) } }), el("div", { class: "pod__nm", text: r.name }), el("div", { class: "pod__bar", text: String(r.rank) })])));
    const tbl = el("table", { class: "tbl" }, [
      el("thead", {}, [el("tr", {}, [el("th", { text: "" }), el("th", { text: "Pilote" }), el("th", { class: "r", text: "Points" }), el("th", { class: "r", text: "Courses gagnées" }), el("th", { class: "r", text: "Meilleur temps" })])]),
      el("tbody", {}, rows.map((r) => el("tr", {}, [el("td", { text: String(r.rank) }), el("td", {}, [el("span", { class: "dotc", style: { background: hexOf(r.color) } }), r.name + (r.left ? " (parti)" : "")]), el("td", { class: "r", text: String(r.pts) }), el("td", { class: "r", text: String(r.wins) }), el("td", { class: "r", text: r.bestAll == null ? "-" : fmtS(r.bestAll) })]))),
    ]);
    const host = Kit.isHost();
    const btns = el("div", { class: "row" }, [
      el("button", { class: "btn btn--ghost", text: "Copier la graine " + m.seed, onclick: () => { try { navigator.clipboard.writeText(m.seed); toast("Graine copiée.", "info"); } catch (e) { toast("Graine " + m.seed, "info"); } } }),
      el("button", { class: "btn btn--ghost", text: "Quitter", onclick: () => Kit.confirm("Quitter la partie et revenir à l'accueil ?", () => Kit.leave()) }),
      host ? el("button", { class: "btn btn--accent", text: "Retour au salon", onclick: () => Kit.backToLobby() }) : el("span", { class: "muted small", text: "L'hôte peut relancer une partie depuis le salon." }),
    ]);
    openSheet([el("h2", { text: "Fin de la partie" }), pod, tbl, btns]); G.sheet = { kind: "over" }; sound.win(); V.setOrbit(true);
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
    const gkey = [G.track.name, G.carId, isHost0, !!(cm && cm.ready), Kit.room && Kit.room.hostId].join("|");
    g.classList.remove("hidden");
    if (g.dataset.key === gkey && g.firstChild) { const t = $("#gar-secs"); if (t) t.textContent = (isHost0 ? "Tu choisis la voiture de tout le monde" : nameOf(Kit.room.hostId) + " choisit la voiture de tout le monde") + " · départ dans " + secs + " s"; return; }
    g.dataset.key = gkey; g.innerHTML = "";
    const B = TR.BIOMES[G.track.biome];
    g.appendChild(el("div", { class: "garage__info" }, [el("b", { text: B.icon + " " + G.track.name }), el("span", { class: "small", text: B.name + " · " + Math.round(G.track.length) + " m · environ " + Math.round(G.track.length / 27) + " s de conduite" + (G.author ? " · temps de l'auteur " + fmtS(G.author) : "") })]));
    const isHost = Kit.isHost(); const cards = el("div", { class: "cars" + (isHost ? "" : " cars--locked") });
    CA.CAR_ORDER.forEach((id) => {
      const c = CA.CARS[id]; const on = G.carId === id; const bar = (v) => el("i", { style: { width: Math.round(clamp(v, 0.08, 1) * 80) + "px" } });
      cards.appendChild(el("button", { class: "carcard" + (on ? " carcard--on" : ""), onclick: () => { if (isHost) { Kit.socket.emit("z:car", { id }); sound.click(); } else toast("Le premier joueur, l'hôte, choisit la voiture de tout le monde.", "info"); } }, [
        el("b", {}, [el("span", { class: "ic", text: c.icon }), c.name]), el("p", { text: c.desc }),
        el("div", { class: "stat" }, [el("span", { text: "Vitesse" }), bar(c.vmax / 60)]), el("div", { class: "stat" }, [el("span", { text: "Accélération" }), bar(c.acc / 26)]),
        el("div", { class: "stat" }, [el("span", { text: "Adhérence" }), bar(c.grip / 7.6)]), el("div", { class: "stat" }, [el("span", { text: "Maniabilité" }), bar(c.turn / 2.8)]),
      ]));
    });
    g.appendChild(cards);
    g.appendChild(el("div", { class: "legend" }, [el("kbd", { text: "↑" }), el("span", { text: "accélérer" }), el("kbd", { text: "↓" }), el("span", { text: "reculer" }), el("kbd", { text: "←" }), el("kbd", { text: "→" }), el("span", { text: "tourner" }), el("kbd", { text: "Entrée" }), el("span", { text: "recommencer" }), el("kbd", { text: "Maj" }), el("span", { text: "dernier point de contrôle" })]));
    const ready = !!(cm && cm.ready);
    g.appendChild(el("div", { class: "garage__row" }, [
      el("span", { class: "pill", id: "gar-secs", text: (isHost ? "Tu choisis la voiture de tout le monde" : nameOf(Kit.room.hostId) + " choisit la voiture de tout le monde") + " · départ dans " + secs + " s" }),
      el("button", { class: "btn " + (ready ? "btn--ghost" : "btn--green") + " btn--big", text: ready ? "Je ne suis plus prêt" : "Je suis prêt", onclick: () => Kit.socket.emit("z:ready") }),
    ]));
    if (cm && cm.car) { const c = V.ensureCar("me", cm.car, hexOf(cm.color), false, null); const st = G.track.start; V.setCarState("me", { x: st.x, y: st.y, z: st.z, h: st.h, p: 0, a: 0, b: 0, speed: 0 }, true); }
  }
  function renderBoard() {
    const s = G.st; if (!s) return; const box = $("#z-board"); box.innerHTML = "";
    box.appendChild(el("h4", {}, [el("span", { text: s.mode === "essence" ? "Essence · course " + Math.min(s.total, s.roundIdx + 1) : "Chrono · course " + Math.min(s.total, s.roundIdx + 1) }), el("span", { text: s.mode === "essence" ? "temps · pts" : "meilleur · pts" })]));
    let list = s.players.slice();
    if (s.mode === "essence" && s.order && s.order.length) list.sort((a, b) => s.order.indexOf(a.id) - s.order.indexOf(b.id)); else list.sort((a, b) => (a.best == null) - (b.best == null) || a.best - b.best);
    list.forEach((p) => {
      const turn = s.mode === "essence" && s.turn && s.turn.pid === p.id && s.phase === "turns"; const holder = s.record && s.record.pid === p.id;
      box.appendChild(el("div", { class: "brow" + (p.id === myId() ? " brow--you" : "") + (turn ? " brow--turn" : "") }, [
        el("i", { style: { background: hexOf(p.color) } }), el("span", { class: "nm", text: (holder ? "🏆 " : "") + p.name + (p.isBot || p.auto ? " 🤖" : !p.connected ? " 💤" : "") }),
        el("span", { class: "st", text: p.best == null ? "-" : fmt(p.best) }), el("span", { class: "pt", text: String(p.pts) })]));
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
    const rec = $("#z-rec"); let rt = "", rs = "";
    if (s && s.mode === "essence" && s.phase === "turns" && s.turn && s.turn.role === "setter") { rt = s.turn.pid === myId() ? "Pose le temps à battre" : nameOf(s.turn.pid) + " pose le temps"; rs = "Essai " + Math.min(S().refTries, s.turn.tries + 1) + " sur " + S().refTries; }
    else if (s && s.mode === "essence" && G.record) { rt = "Record " + fmtS(G.record.time); rs = nameOf(G.record.pid) + (s.turn && s.turn.role === "challenger" ? " · essai " + (s.turn.pid === myId() && G.run ? "en cours" : "suivant") : ""); } else if (s && s.mode === "chrono") { rt = G.myBest != null ? "Ton meilleur " + fmtS(G.myBest) : "Pas encore de temps"; rs = s.raceEnd ? "Il reste " + Math.max(0, Math.ceil((s.raceEnd - snow()) / 1000)) + " s" : ""; }
    if (G.lastDom.r !== rt + rs) { rec.innerHTML = ""; rec.appendChild(el("b", { text: rt })); rec.appendChild(el("span", { text: rs })); G.lastDom.r = rt + rs; }
    $("#z-speed").style.visibility = run && !run.done ? "visible" : "hidden";
    $("#z-speed").innerHTML = "<b>" + Math.round(speed * 3.6) + "</b><span>km/h</span>";
    // essence
    const fu = $("#z-fuel");
    if (s && s.mode === "essence" && s.phase === "turns" && s.turn && s.turn.role === "challenger") {
      let left = s.turn.fuelLeft; if (run && run.challenger && !run.done && run.countdown === 0) left = run.fuel0 - run.r.tick / 60; else if (s.turn.pid !== myId() && botClock()) left = botClock().fuel; else if (s.turn.goAt && s.turn.pid !== myId()) left = s.turn.fuelLeft - Math.max(0, (snow() - s.turn.goAt) / 1000);
      left = Math.max(0, left); fu.classList.remove("hidden"); fu.classList.toggle("z-fuel--low", left < 10);
      const txt = "⛽ " + Math.ceil(left) + " s d'essence"; if (G.lastDom.f !== txt) { fu.innerHTML = ""; fu.appendChild(el("div", { text: txt })); fu.appendChild(el("div", { class: "bar" }, [el("i", { style: { width: clamp(left / s.turn.fuel, 0, 1) * 100 + "%" } })])); G.lastDom.f = txt; } else fu.querySelector("i").style.width = clamp(left / s.turn.fuel, 0, 1) * 100 + "%";
      if (run && run.out && !run.done && run.countdown === 0 && !G.noFuelBanner) { G.noFuelBanner = true; setBanner("Panne d'essence", "Franchis la ligne en roue libre, ou recommence", 2600); Kit.sound.fail(); }
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
    if (s && canDrive()) tt = "↑ accélérer · ↓ reculer · ← → tourner · Entrée recommencer l'essai · Maj dernier point de contrôle · C caméra";
    else if (s && s.phase === "turns" && s.turn) tt = "Tu joueras dans " + Math.max(0, s.order.indexOf(myId()) - s.turn.idx) + " tour" + (s.order.indexOf(myId()) - s.turn.idx > 1 ? "s" : "") + (s.order.indexOf(myId()) <= s.turn.idx ? ", ton tour est passé." : ".");
    if (G.lastDom.tip !== tt) { tip.textContent = tt; G.lastDom.tip = tt; }
    if (G.sheet && G.sheet.kind === "end" && G.endInfo) { const left = Math.max(0, Math.ceil((G.endInfo.until - snow()) / 1000)); G.sheet.note.textContent = G.endInfo.last ? "C'est la dernière course, les résultats arrivent." : "Prochaine course dans " + left + " s."; }
    if (s && s.phase === "garage" && now - (G.lastGar || 0) > 500) { G.lastGar = now; renderGarage(); }
  }
  let lastCount = 0;
  function setCount(n) { if (n !== lastCount) { lastCount = n; setBanner(String(n), null, 1100); Kit.sound.tone(560, 0.1, "triangle", 0.09); } if (n === 1 && !G.goTimer) { G.goTimer = setTimeout(() => { G.goTimer = 0; setBanner("Partez", null, 900); Kit.sound.tone(900, 0.3, "triangle", 0.12); }, 950); } }

  // ---------- carte du circuit (salon et jeu) ----------
  function drawMap(canvas, tr, o) {
    o = o || {}; const g = canvas.getContext("2d"); const W = canvas.width, H = canvas.height; g.clearRect(0, 0, W, H);
    let minX = 1e9, maxX = -1e9, minZ = 1e9, maxZ = -1e9; for (let i = 0; i < tr.n; i += 2) { if (tr.x[i] < minX) minX = tr.x[i]; if (tr.x[i] > maxX) maxX = tr.x[i]; if (tr.z[i] < minZ) minZ = tr.z[i]; if (tr.z[i] > maxZ) maxZ = tr.z[i]; }
    const pad = o.pad || 10; const sc = Math.min((W - pad * 2) / Math.max(1, maxX - minX), (H - pad * 2) / Math.max(1, maxZ - minZ)); const ox = (W - (maxX - minX) * sc) / 2, oz = (H - (maxZ - minZ) * sc) / 2;
    const P = (x, z) => [ox + (maxX - x) * sc, oz + (maxZ - z) * sc + 0]; // +z vers le haut, +x vers la gauche comme à l'écran
    const colr = ["#c8ccd8", "#c49a6a", "#9fdcff", "#ff9a1a", "#e0a0ff"]; g.lineCap = "round"; g.lineWidth = o.lw || 5;
    for (let i = 0; i < tr.n - 1; i++) { const a = P(tr.x[i], tr.z[i]), b = P(tr.x[i + 1], tr.z[i + 1]); g.strokeStyle = colr[tr.surf[i]] || "#c8ccd8"; g.beginPath(); g.moveTo(a[0], a[1]); g.lineTo(b[0], b[1]); g.stroke(); }
    const dot = (p, c, r) => { g.fillStyle = c; g.strokeStyle = "#14172b"; g.lineWidth = 2; g.beginPath(); g.arc(p[0], p[1], r, 0, 6.3); g.fill(); g.stroke(); };
    for (let i = 0; i < tr.n; i++) if (tr.flags[i] & 2) dot(P(tr.x[i], tr.z[i]), "#ff6a8a", 3);
    tr.cps.forEach((c) => dot(P(tr.x[c], tr.z[c]), "#33e0ff", 3));
    dot(P(tr.x[tr.start.idx], tr.z[tr.start.idx]), "#7aff7a", 5); dot(P(tr.x[tr.n - 3], tr.z[tr.n - 3]), "#ffffff", 5);
    (o.dots || []).forEach((d) => dot(P(d.x, d.z), d.hex, d.big ? 6 : 5));
  }

  // ---------- entrées ----------
  function wireInput() {
    $("#btn-menu").onclick = openMenu; $("#btn-cam").onclick = () => { const m = V.cycleCam(); toast(["Caméra poursuite", "Caméra haute", "Caméra capot"][m], "info"); };
    $("#btn-restart").onclick = restartAttempt; $("#btn-respawn").onclick = () => { G.rstReq = true; };
    const hold = (id, key) => { const b = $("#" + id); const on = (e) => { e.preventDefault(); G.touch[key] = true; b.classList.add("on"); engineStart(); }; const off = (e) => { e.preventDefault(); G.touch[key] = false; b.classList.remove("on"); }; b.addEventListener("pointerdown", on); b.addEventListener("pointerup", off); b.addEventListener("pointerleave", off); b.addEventListener("pointercancel", off); };
    hold("t-left", "left"); hold("t-right", "right"); hold("t-gas", "gas"); hold("t-brake", "brake");
    window.addEventListener("keydown", (e) => {
      if (document.body.dataset.screen !== "game") return; if (/INPUT|TEXTAREA|SELECT/.test(e.target.tagName || "")) return;
      const k = e.key.toLowerCase(); G.keys[k] = true; engineStart();
      if (["arrowup", "arrowdown", "arrowleft", "arrowright", " ", "enter", "shift"].includes(k)) e.preventDefault();
      if (e.repeat) return;
      if (k === "enter") restartAttempt(); else if (k === "shift") G.rstReq = true; else if (k === "c") { const m = V.cycleCam(); toast(["Caméra poursuite", "Caméra haute", "Caméra capot"][m], "info"); }
    });
    window.addEventListener("keyup", (e) => { G.keys[e.key.toLowerCase()] = false; });
    window.addEventListener("blur", () => { G.keys = {}; });
  }
  function openMenu() {
    const q = store.get("zoom.quality", autoQuality()); const qs = [["low", "Basse"], ["medium", "Moyenne"], ["high", "Haute"]];
    const row = (title, info, control) => el("div", { class: "menu-row" }, [el("div", {}, [el("b", { text: title }), el("p", { class: "small muted", text: info })]), control]);
    const qbox = el("div", { class: "chips" }, qs.map(([v, l]) => el("button", { class: "chip" + (q === v ? " chip--on" : ""), text: l, onclick: (ev) => { store.set("zoom.quality", v); V.setQuality(v); ev.target.parentNode.querySelectorAll(".chip").forEach((c) => c.classList.remove("chip--on")); ev.target.classList.add("chip--on"); } })));
    const sbtn = el("button", { class: "btn btn--small btn--ghost", text: sound.enabled ? "Son activé" : "Son coupé", onclick: (ev) => { ev.target.textContent = sound.toggle() ? "Son activé" : "Son coupé"; } });
    const keys = el("div", { class: "keys" }, [
      el("kbd", { text: "↑ ↓ ← →" }), el("span", { text: "Flèche du haut pour accélérer, flèche du bas pour freiner puis reculer, flèches de côté pour tourner." }),
      el("kbd", { text: "Entrée" }), el("span", { text: "Recommencer l'essai depuis la ligne de départ. En mode essence, l'essence déjà brûlée est perdue." }),
      el("kbd", { text: "Maj" }), el("span", { text: "Revenir au dernier point de contrôle franchi, le chrono continue." }),
      el("kbd", { text: "C" }), el("span", { text: "Changer de caméra." }),
      el("kbd", { text: "Manette" }), el("span", { text: "Stick gauche pour tourner, gâchette droite pour accélérer, gauche pour freiner, carré pour revenir au point de contrôle, triangle pour recommencer." }),
    ]);
    const cars = el("div", {}, CA.CAR_ORDER.map((id) => el("p", { class: "small", text: CA.CARS[id].icon + " " + CA.CARS[id].name + " · " + CA.CARS[id].desc })));
    Kit.showModal("Menu", [row("Qualité graphique", "Basse retire les ombres et allège l'affichage, utile sur téléphone ou ordinateur modeste.", qbox), row("Sons", "Moteur, points de contrôle et arrivées.", sbtn),
      el("h3", { text: "Commandes", style: { marginTop: "0.8rem" } }), keys, el("h3", { text: "Les voitures", style: { marginTop: "0.8rem" } }), cars,
      el("button", { class: "btn btn--danger btn--small", style: { marginTop: "0.8rem" }, text: "Quitter la partie", onclick: () => Kit.confirm("Quitter la partie et revenir à l'accueil ?", () => { $("#modal").classList.add("hidden"); Kit.leave(); }) })]);
  }

  // ---------- aperçu dans le salon ----------
  function renderPreview(box, room) {
    const s = room.settings; const host = Kit.isHost(); const seeded = !!(s.seed && s.seed.trim());
    if (!seeded && !G.prev.seed) G.prev.seed = Math.random().toString(36).slice(2, 8);
    const seed = seeded ? s.seed.trim() : G.prev.seed; if (seeded && G.prev.idx >= s.rounds) G.prev.idx = 0; const idx = seeded ? G.prev.idx : 0;
    const key = JSON.stringify([s.biomes, s.biomeOrder, s.trackSize, s.difficulty, s.hills, s.features, seed, idx]);
    if (key !== G.prev.key) { try { G.prev.track = ZR.trackFor(s, seed, idx); } catch (e) { G.prev.track = null; console.error(e); } G.prev.key = key; }
    box.innerHTML = ""; const t = G.prev.track; if (!t) return; const B = TR.BIOMES[t.biome];
    const cv = el("canvas", { width: 340, height: 340, style: { width: "170px", height: "170px", borderRadius: "12px", background: "#14172b", flex: "none" } });
    const jumps = t.flags.filter((f) => f & 2).length, boosts = (() => { let c = 0, p = false; for (let i = 0; i < t.n; i++) { const b = !!(t.flags[i] & 1); if (b && !p) c++; p = b; } return c; })();
    const info = el("div", { style: { flex: 1, minWidth: "140px" } }, [
      el("div", { class: "meta", text: B.icon + " " + t.name }), el("p", { class: "small", text: B.name + " · " + Math.round(t.length) + " m · environ " + Math.round(t.length / 27) + " s de conduite" }),
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
    so.on("z:round", onRound); so.on("z:state", onState); so.on("z:turn", onTurn); so.on("z:record", onRecord); so.on("z:go", onGo); so.on("z:snap", onSnap);
    so.on("z:turnEnd", onTurnEnd); so.on("z:result", onResult); so.on("z:botTurn", onBotTurn); so.on("z:roundEnd", onRoundEnd); so.on("z:over", onOver);
  }
  // envoi régulier de la position pendant un essai
  setInterval(() => { const r = G.run; if (!r || r.done || !Kit.socket || r.countdown > 0 || !canDrive()) return; const a = r.r; const fx = Math.sin(a.hd), fz = Math.cos(a.hd); Kit.socket.emit("z:pos", { x: +a.x.toFixed(2), y: +a.y.toFixed(2), z: +a.z.toFixed(2), h: +a.hd.toFixed(3), p: +a.pitch.toFixed(3), a: a.air ? 1 : 0, b: a.boostT > 0 ? 1 : 0 }); }, 100);
  Kit.on("screen", (name) => { V.paused = name !== "game"; if (name === "game") setTimeout(() => { if (G.viewInit) V.resize(); }, 50); });
  Kit.on("reset", () => { G.st = null; G.track = null; G.run = null; closeSheet(); G.prev.key = ""; });
  Kit.on("room", (r) => { if (r.status === "lobby") { G.st = null; G.run = null; closeSheet(); G.lastState = ""; } });
  window.ZoomGame = G;

  Kit.init({
    id: "zoomalou", title: "Zoomalou", emoji: "🏎️", ribbon: "Vroum à l'infini", tagline: "Des circuits qui n'existent pas encore et un réservoir qui se vide.",
    createLabel: "Créer un salon", soloLabel: "Jouer contre des bots", startLabel: "Lancer la partie", helpTitle: "Comment jouer",
    floaters: [{ e: "🏎️", x: 6 }, { e: "🏁", x: 22 }, { e: "⛽", x: 38 }, { e: "🚀", x: 52 }, { e: "🌴", x: 66 }, { e: "⛄", x: 80 }, { e: "🍭", x: 92 }],
    colors: COLORS, botLevels: LEVELS, maxPlayers: 6, minPlayers: 1, schema: ZR.SCHEMA,
    help: [
      { title: "Le but", text: "Chaque course se joue sur un circuit généré au hasard. Il s'agit de franchir la ligne d'arrivée le plus vite possible, en passant par tous les points de contrôle." },
      { title: "Le mode essence", text: "Le premier pilote pose un temps. Ensuite chaque autre pilote, à son tour, a un réservoir limité pour le battre. Chaque essai consomme de l'essence, y compris ceux qu'on abandonne. S'il bat le record il devient le nouveau record à battre, sinon il tombe en panne et passe la main." },
      { title: "Le mode chrono", text: "Tout le monde roule en même temps pendant la durée choisie. On recommence autant qu'on veut, et le meilleur temps de chacun compte. Les voitures des autres sont transparentes et ne gênent jamais." },
      { title: "Piloter", text: "Les quatre flèches pilotent, haut pour accélérer, bas pour freiner et reculer, côtés pour tourner. Entrée recommence l'essai à zéro, Maj ramène au dernier point de contrôle sans arrêter le chrono. Les tapis orange donnent un coup de turbo, et un long dérapage donne un petit turbo à la sortie, surtout avec la Toupie." },
      { title: "Les sols", text: "Le bitume accroche, la terre un peu moins, la glace très peu, et le sol collant ralentit. Chaque voiture réagit différemment, la Rallye-Pote adore la terre et la glace." },
      { title: "Les points", text: "En essence, la voiture qui détient le record à la fin gagne 3 points, et celle qui l'a détenu juste avant 1 point. En chrono, les points dépendent du classement des meilleurs temps." },
    ],
    theme: { a1: "#ffd66b", a2: "#f08a24", bg1: "#2b2f6a", bg2: "#14172b" },
    renderPreview,
    onInit() { buildGame(); attach(); Kit.on("connect", attach); },
  });
})();

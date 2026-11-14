// ============================================================
// BOUSKAILLE — Interface de jeu, pilotage local, réseau et affichage (client)
// ============================================================
(function () {
  const { el, $, toast, store } = Kit;
  const Sim = BouskSim, Ar = BouskArenas, Rules = BouskRules, SC = BouskScene, CH = BouskChars, FX = BouskFX, SND = FX.sound;
  const T = THREE;
  const COLORS = [
    { name: "Rouge", hex: "#e8453c" }, { name: "Bleu", hex: "#2f78d1" }, { name: "Vert", hex: "#3aa653" }, { name: "Jaune", hex: "#f2c230" },
    { name: "Violet", hex: "#8a55c8" }, { name: "Orange", hex: "#f08a24" }, { name: "Rose", hex: "#ee6fb0" }, { name: "Turquoise", hex: "#25b9b0" },
  ];
  const TEAM = { 1: { name: "Rouge", hex: "#ff5a4d" }, 2: { name: "Bleu", hex: "#3d8bff" } };
  const LEVELS = [{ id: "debutant", label: "Apprenti" }, { id: "moyen", label: "Habitué" }, { id: "champion", label: "Champion" }, { id: "prodige", label: "Prodige" }];
  const STN = ["ok", "charge", "dash", "rec", "stun", "fall", "air", "out"];
  const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
  const TAU = Math.PI * 2;
  const isTouch = ("ontouchstart" in window) || (navigator.maxTouchPoints > 0 && /Mobi|Android|iPhone|iPad/.test(navigator.userAgent));
  if (isTouch) document.documentElement.classList.add("touch");

  const G = {
    round: null, A: null, view: null, actors: {}, ids: [], idx: {}, snaps: [], clockOff: null, off: [], hud: null, phase: "none", L: null, LW: null, input: { mx: 0, mz: 0, h: false }, seq: 0, fp: false, fpManual: 0, fpT: 0, fpYaw: 0, fpPitch: 0, fpInit: false, jumpBtn: false, sens: +store.get("bousk.sens", "1"),
    keys: {}, joy: { x: 0, z: 0, on: false }, act: false, lastSend: 0, lastSent: "", acc: 0, last: 0, cam: { x: 0, y: 30, z: 20, tx: 0, tz: 0, shake: 0 }, shown: false,
    quality: store.get("bousk.quality", isTouch ? "medium" : "high"), end: null, over: null, cos: {}, mine: null, mismatch: 0, helped: 0, fps: [], pr: 1, feedN: 0, lastGust: 0,
    prevSt: {}, lastEv: 0, podium: null, hitSnd: 0, tilt: 0, frame: 0,
  };
  const S = () => (Kit.room && Kit.room.settings) || Rules.defaults();
  const myPid = () => { const p = Kit.me(); return p ? p.id : null; };
  const colorOf = (id) => { const d = G.round && G.round.players.find((p) => p.id === id); if (!d) return "#fff"; return d.team && G.round.mode === "teams" ? TEAM[d.team].hex : COLORS[d.color % 8].hex; };
  const nameOf = (id) => { const d = G.round && G.round.players.find((p) => p.id === id); return d ? d.name : "?"; };
  const myCos = () => { try { const c = JSON.parse(store.get("bousk.cos", "{}")); return { char: c.char | 0, hat: c.hat | 0, trail: c.trail | 0 }; } catch (e) { return { char: 0, hat: 0, trail: 0 }; } };

  // ---------- construction de l'écran ----------
  let R = null, canvas, hudEl;
  function buildGame() {
    const sc = $("#screen-game"); sc.innerHTML = "";
    canvas = el("canvas", { id: "bk-canvas" }); sc.appendChild(canvas);
    hudEl = el("div", { class: "bk-hud" });
    hudEl.innerHTML = `<div class="bk-board" id="bk-board"></div>
      <div class="bk-top"><div class="bk-pill" id="bk-round"></div><div class="bk-pill" id="bk-timer" style="display:none"></div></div>
      <div class="bk-feed" id="bk-feed"></div>
      <div class="bk-btns"><button class="bk-btn" id="bk-snd" title="Son">🔊</button><button class="bk-btn" id="bk-menu" title="Menu">⚙️</button></div>
      <div class="bk-banner" id="bk-banner"></div>
      <div class="bk-cd" id="bk-cd" style="opacity:0"><i></i></div>
      <div class="bk-me" id="bk-charge"><i></i></div>
      <div class="bk-help" id="bk-help"></div>
      <div class="bk-crown" id="bk-crown" style="display:none">👑</div>
      <div class="bk-joy" id="bk-joy"><i></i></div><div class="bk-act" id="bk-act">POUSSE</div><div class="bk-jump" id="bk-jump">SAUT</div><div class="bk-xh" id="bk-xh"></div><div class="bk-keys" id="bk-keys"></div>
      <div class="bk-ov" id="bk-end"></div><div class="bk-ov" id="bk-over"></div><div class="bk-ov" id="bk-pause"></div>`;
    sc.appendChild(hudEl);
    $("#bk-snd").onclick = () => { SND.setMute(!SND.muted); $("#bk-snd").textContent = SND.muted ? "🔇" : "🔊"; if (!SND.muted) SND.click(); };
    $("#bk-snd").textContent = SND.muted ? "🔇" : "🔊";
    $("#bk-menu").onclick = openPause; keysHint(); $("#bk-xh").style.display = G.fp ? "block" : "none";
    document.addEventListener("pointerlockchange", () => { if (document.pointerLockElement !== canvas) G.act = false; });
    bindInput();
  }

  // ---------- rendu ----------
  function initRender() {
    if (R) return true;
    let renderer;
    try { renderer = PicuiteGL.create(T, canvas, G.quality === "low" ? "low" : "high"); } catch (e) { return false; }
    renderer.shadowMap.enabled = G.quality !== "low"; renderer.shadowMap.type = T.PCFSoftShadowMap;
    if (T.sRGBEncoding) renderer.outputEncoding = T.sRGBEncoding; renderer.toneMapping = T.ACESFilmicToneMapping; renderer.toneMappingExposure = 1.05;
    const scene = new T.Scene(); const cam = new T.PerspectiveCamera(38, 1, 0.5, 400);
    R = { renderer, scene, cam }; FX.init(scene, cam, G.quality); PicuiteGL.watch(canvas, () => resize());
    window.addEventListener("resize", resize); resize(); SC.loadAssets(); CH.load();
    G.last = performance.now(); loop(); return true;
  }
  function resize() {
    if (!R) return; const w = canvas.clientWidth || window.innerWidth, h = canvas.clientHeight || window.innerHeight; const dpr = Math.min(window.devicePixelRatio || 1, G.quality === "high" ? 2 : G.quality === "medium" ? 1.5 : 1) * G.pr;
    R.renderer.setPixelRatio(dpr); R.renderer.setSize(w, h, false); R.cam.aspect = w / h; R.cam.updateProjectionMatrix(); FX.resize(h * dpr);
  }
  function setQuality(q) { G.quality = q; store.set("bousk.quality", q); if (R) { R.renderer.shadowMap.enabled = q !== "low"; resize(); } if (G.round) startRound(G.round, true); }

  // ---------- manche ----------
  function disposeRound() {
    Object.values(G.actors).forEach((a) => a.dispose()); G.actors = {}; if (G.view) { G.view.dispose(); G.view = null; } FX.clear(); SND.chargeStop(); if (G.podium) { R.scene.remove(G.podium); G.podium = null; }
  }
  function startRound(msg, rebuild) {
    if (!initRender()) return toast("Ton navigateur ne peut pas afficher la 3D.", "error");
    disposeRound(); G.round = msg; G.cos = msg.cos || G.cos; G.A = Ar.make(msg.arena, msg.seed, { hazards: msg.hazards }); G.ids = msg.players.map((p) => p.id); G.idx = {}; G.ids.forEach((id, i) => { G.idx[id] = i; });
    G.view = new SC.ArenaView(R.scene, G.A, G.quality); FX.dispose(); FX.init(R.scene, R.cam, G.quality); resize();
    G.mine = myPid(); G.snaps = []; G.L = null; G.LW = Sim.makeWorld(G.A, { noShrink: true }); G.LW.players = []; G.prevSt = {}; G.feedN = 0;
    G.view.update(0, null, 0, 0);
    msg.players.forEach((p) => {
      const co = G.cos[p.id] || { char: 0, hat: 0, trail: 0 };
      G.actors[p.id] = new CH.Actor(R.scene, { name: p.name, color: colorOf(p.id), char: co.char, hat: co.hat, trail: co.trail });
    });
    const sp = Ar.spawnsFor(G.A, msg.players.length, msg.mode === "teams" ? msg.players.map((p) => p.team) : null);
    msg.players.forEach((p, i) => { const a = G.actors[p.id]; a.group.position.set(sp[i].x, 0, sp[i].z); a.fx = Math.PI / 2 - sp[i].a; G.snaps.length = 0; });
    G.pre = msg.players.map((p, i) => ({ x: sp[i].x, z: sp[i].z, a: sp[i].a }));
    SND.ambience(G.A.theme); renderBoard(); updateHeader(); document.body.dataset.bk = "round";
    $("#bk-end").classList.remove("show"); $("#bk-over").classList.remove("show");
    banner(G.A.name, G.A.blurb + " " + (G.A.info || ""), 0);
    G.phase = "intro"; G.introAt = performance.now(); G.cam.fit = null;
    const h = $("#bk-help"); if (h) { h.style.opacity = 1; h.innerHTML = isTouch ? "Joystick pour te déplacer, bouton pour pousser, bouton Saut pour sauter. Maintiens pour charger." : "<kbd>ZQSD</kbd> ou <kbd>flèches</kbd> pour bouger. <kbd>Espace</kbd> pour pousser, maintiens pour charger et relâche pour foncer. <kbd>Maj</kbd> ou <kbd>E</kbd> pour sauter."; }
  }
  function banner(big, sub, ms) { const b = $("#bk-banner"); if (!b) return; b.innerHTML = ""; if (big) b.appendChild(el("div", { class: "big", text: big })); if (sub) b.appendChild(el("div", { class: "sub", text: sub })); b.style.display = big || sub ? "block" : "none"; clearTimeout(banner.t); if (ms) banner.t = setTimeout(() => { b.style.display = "none"; }, ms); }
  function feed(html) { const f = $("#bk-feed"); if (!f) return; const d = el("div", { html }); f.appendChild(d); while (f.children.length > 5) f.removeChild(f.firstChild); setTimeout(() => d.remove(), 4600); }
  const dotHtml = (id) => `<span class="dot" style="display:inline-block;width:11px;height:11px;border-radius:50%;background:${colorOf(id)};margin-right:5px"></span><b>${esc(nameOf(id))}</b>`;
  const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));

  function updateHeader() {
    const m = G.round; if (!m) return; const r = $("#bk-round"); if (!r) return;
    const rule = Rules.MODES[m.mode] || ""; r.innerHTML = `<span>Manche <b>${m.i + 1}</b> sur ${m.total}</span><span style="opacity:.75">${esc(rule)}${m.double ? " · points doubles" : ""}</span>`;
    $("#bk-timer").style.display = Rules.isTimed(m.mode) ? "flex" : "none";
  }
  function renderBoard() {
    const b = $("#bk-board"); if (!b || !G.round) return; const h = G.hud; b.innerHTML = "";
    const m = G.round; const rows = m.players.map((p, i) => ({ p, i, tot: h ? h.tot[i] : 0, ko: h ? h.ko[i] : 0, alive: h ? !!h.alive[i] : true, pts: h ? h.pts[i] : 0 }));
    if (m.mode === "teams" && h && h.teams) b.appendChild(el("div", { class: "bk-row", html: `<span class="bk-team"><i style="background:${TEAM[1].hex}"></i><b>${h.teams[1]}</b></span><span class="nm"></span><span class="bk-team"><b>${h.teams[2]}</b><i style="background:${TEAM[2].hex}"></i></span>` }));
    rows.sort((a, c) => (Rules.isTimed(m.mode) ? c.pts - a.pts : c.tot - a.tot) || a.i - c.i).forEach((r) => {
      const timed = Rules.isTimed(m.mode);
      b.appendChild(el("div", { class: "bk-row" + (r.alive ? "" : " dead") + (r.p.id === G.mine ? " me" : "") }, [el("span", { class: "dot", style: { background: colorOf(r.p.id) } }), el("span", { class: "nm", text: r.p.name }), el("span", { class: "sk", text: r.alive ? "" : "👻" }), el("span", { class: "sc", text: String(timed ? Math.round(r.pts) : r.tot) })]));
    });
  }

  // ---------- réseau ----------
  function attach() {
    const s = Kit.socket; if (!s || s.__bk) return; s.__bk = true;
    s.on("b:round", (m) => { G.cos = m.cos || G.cos; G.hud = null; startRound(m); });
    s.on("b:phase", (d) => onPhase(d.p));
    s.on("b:snap", onSnap);
    s.on("b:hud", (h) => { G.hud = h; renderBoard(); const t = $("#bk-timer"); if (h.left != null && t) t.innerHTML = `<b>${Math.ceil(h.left)}</b> s`; updateCrown(); });
    s.on("b:end", (d) => { G.end = d; showEnd(d); });
    s.on("b:over", (d) => { G.over = d; setTimeout(() => showOver(d), 1800); });
    s.on("b:cosmap", (m) => { G.cos = m; refreshPreview(); });
    s.on("room:lobbyAgain", () => { leaveGame(); });
    sendCos();
  }
  function sendCos() { if (Kit.socket && Kit.socket.connected) { Kit.socket.emit("b:cos", myCos()); Kit.socket.emit("b:hello"); } }
  function leaveGame() { document.body.dataset.bk = ""; if (R) { disposeRound(); } SND.stopAmb(); $("#bk-end").classList.remove("show"); $("#bk-over").classList.remove("show"); G.round = null; G.phase = "none"; }
  function onPhase(p) {
    G.phase = p; G.phaseAt = performance.now();
    if (p === "count") { SND.beep(0); banner("3", "", 0); G.cdN = 3; $("#bk-end").classList.remove("show"); }
    if (p === "play") { SND.go(); banner("Bouscule !", "", 900); setTimeout(() => { const h = $("#bk-help"); if (h) h.style.opacity = G.round && G.round.i > 0 ? 0 : 1; }, 100); setTimeout(() => { const h = $("#bk-help"); if (h) h.style.opacity = 0; }, G.round && G.round.i > 1 ? 1500 : 9000); }
  }
  function onSnap(sn) {
    const arr = performance.now(); sn.arr = arr; const off = arr - sn.now; G.off.push(off); if (G.off.length > 40) G.off.shift(); G.clockOff = Math.min.apply(null, G.off) + 5;
    G.snaps.push(sn); if (G.snaps.length > 40) G.snaps.shift();
    if (sn.phase !== undefined) return;
    // état des dalles qui s'effondrent
    G.tiles = sn.tl; G.tilesAt = sn.t;
    // événements
    if (sn.ev && sn.ev.length) sn.ev.forEach((e) => onEvent(e, sn));
    // recalage de ma prédiction
    const me = G.idx[G.mine]; if (me === undefined || !sn.p[me]) return; const s = sn.p[me];
    if (!G.L) { G.L = Sim.newPlayer(G.mine, 0, s[0], s[1], s[5]); G.LW.players = [G.L]; G.L.alive = !!(s[8] & 1); }
    const L = G.L; const st = STN[s[6]] || "ok"; const alive = !!(s[8] & 1);
    const age = (performance.now() - arr) / 1000; const ex = s[0] + s[3] * age, ez = s[1] + s[4] * age; const dx = ex - L.x, dz = ez - L.z, d = Math.hypot(dx, dz);
    if (!alive) { L.alive = false; return; }
    if (!L.alive) { L.alive = true; L.fall = false; L.air = false; L.y = 0; L.vy = 0; L.x = s[0]; L.z = s[1]; L.vx = s[3]; L.vz = s[4]; L.holding = false; L.dash = 0; L.rec = 0; L.cd = 0; L.stun = 0; }
    if (d > 3.2 || st === "fall" || st === "air" || (L.fall && st !== "fall")) { L.x = s[0]; L.z = s[1]; L.vx = s[3]; L.vz = s[4]; L.y = s[2]; L.fall = st === "fall"; L.air = st === "air"; if (!L.fall && !L.air) { L.y = 0; L.vy = 0; } }
    else if (d > 0.03) { const k = d > 0.8 ? 0.5 : 0.22; L.x += dx * k; L.z += dz * k; L.vx += (s[3] - L.vx) * 0.35; L.vz += (s[4] - L.vz) * 0.35; }
    // états de combat, on suit le serveur quand il est en désaccord durablement
    const local = L.dash > 0 ? "dash" : L.holding ? "charge" : L.rec > 0 ? "rec" : L.stun > 0 ? "stun" : "ok";
    if (local !== st && !(st === "ok" && local === "charge")) { G.mismatch++; } else if (local === "charge" && st === "ok") { G.mismatch++; } else G.mismatch = 0;
    if (G.mismatch > 2) { if (st === "rec") { L.rec = 0.35; L.holding = false; L.dash = 0; } else if (st === "stun") { L.stun = 0.25; L.holding = false; L.dash = 0; } else if (st === "ok") { L.holding = false; L.dash = 0; L.rec = 0; } else if (st === "dash" && L.dash <= 0) { L.dash = 0.2; L.dx = L.fx; L.dz = L.fz; L.ds = 12; L.dashLen = 0.3; } G.mismatch = 0; }
    L.cd = (s[8] & 4) ? Math.max(L.cd, 0.2) : L.cd;
  }
  function onEvent(e, sn) {
    const v = G.view; const me = G.mine; const now = performance.now();
    switch (e.e) {
      case "hit": { FX.impact(e.x, e.z, e.p, e.nx, e.nz); if (now - G.hitSnd > 70) { SND.hit(e.p); G.hitSnd = now; } shake(e.p * 0.9 + 0.1); const b = G.actors[e.b]; if (b && e.p > 0.3) b.oneShot("hit", 1.5); break; }
      case "dash": { SND.dash(e.c); const a = G.actors[e.id]; if (a) FX.dust(e.x, e.z, e.dx, e.dz, 5); break; }
      case "pulse": { SND.pulse(); const a = G.actors[e.id]; if (a) a.oneShot("kick", 1.8); FX.ring(e.x + e.fx, e.z + e.fz, 0xffffff, 1.2, 0.22); break; }
      case "miss": { FX.dust(e.x, e.z, 0, 0, 6); break; }
      case "bar": { SND.bar(); FX.impact(e.x, e.z, e.p * 0.5, 0, 0); shake(0.35); break; }
      case "bump": { SND.bump(); const pg = v && v.pegs[e.i]; if (pg) { pg.g.scale.set(1.25, 0.8, 1.25); setTimeout(() => pg.g.scale.set(1, 1, 1), 110); } FX.ring(e.x, e.z, 0xffe14d, 1.6, 0.3); break; }
      case "spring": { SND.spring(); FX.spring(e.x, e.z); if (v) { const i = v.nearestSpring(e.x, e.z); if (i >= 0) v.squash(i); } break; }
      case "jump": { if (e.id === me) SND.jump(); FX.dust(e.x, e.z, 0, 0, 4); break; }
      case "land": { if (e.id === me) SND.land(); FX.dust(e.x, e.z, 0, 0, 6); break; }
      case "edge": { if (e.id === me) SND.fall(); break; }
      case "save": { FX.ring(e.x, e.z, 0x7fe07f, 1.4, 0.3); break; }
      case "crumble": { SND.crumble(); break; }
      case "interrupt": { if (e.id === me) SND.chargeStop(); break; }
      case "ko": { const a = G.actors[e.id]; if (a) FX.poof(e.x, 0.5, e.z, 0xffffff); SND.ko(); feed(e.by && e.by !== e.id ? `${dotHtml(e.by)} a éjecté ${dotHtml(e.id)}` : `${dotHtml(e.id)} est tombé`); if (e.id === me) shake(0.8); break; }
      case "respawn": { FX.ring(e.x, e.z, 0xffffff, 2.2, 0.5); FX.confetti(e.x, 1, e.z, 12); break; }
      case "crown": { SND.crown(); banner("", "La couronne se déplace", 1400); break; }
    }
  }
  function shake(p) { G.cam.shake = Math.min(1.4, G.cam.shake + p * 0.6); }

  // ---------- commandes ----------
  function bindInput() {
    const map = (e) => { const k = e.key.toLowerCase(); return k; };
    window.addEventListener("keydown", (e) => {
      if (document.body.dataset.screen !== "game") return; const t = e.target && e.target.tagName; if (t === "INPUT" || t === "TEXTAREA") return;
      const k = map(e); if (["arrowup", "arrowdown", "arrowleft", "arrowright", " ", "z", "q", "s", "d", "w", "a", "e", "shift", "f", "h", "t", "g"].includes(k)) e.preventDefault();
      G.keys[k] = true; SND.unlock(); if (k === "escape") { if ($("#bk-pause").classList.contains("show")) closePause(); else openPause(); }
    });
    window.addEventListener("keyup", (e) => { G.keys[map(e)] = false; });
    window.addEventListener("blur", () => { G.keys = {}; G.act = false; });
    const jb = $("#bk-jump"); jb.addEventListener("pointerdown", (e) => { G.jumpBtn = true; jb.classList.add("on"); jb.setPointerCapture(e.pointerId); SND.unlock(); }); const endJ = () => { G.jumpBtn = false; jb.classList.remove("on"); }; jb.addEventListener("pointerup", endJ); jb.addEventListener("pointercancel", endJ);
    document.addEventListener("mousemove", (e) => { if (document.body.dataset.screen !== "game" || !G.fp || document.pointerLockElement !== canvas) return; G.fpManual = performance.now(); G.fpYaw -= e.movementX * 0.0024 * G.sens; G.fpPitch = clamp(G.fpPitch - e.movementY * 0.0024 * G.sens, -1.2, 1.2); });
    canvas.addEventListener("mousedown", (e) => { SND.unlock(); if (!G.fp || isTouch) return; if (document.pointerLockElement !== canvas) { try { canvas.requestPointerLock(); } catch (x) { /* rien */ } } else if (e.button === 0) G.act = true; });
    window.addEventListener("mouseup", (e) => { if (e.button === 0 && G.fp && document.pointerLockElement === canvas) G.act = false; });
    let tid = null, tx = 0, ty = 0; canvas.addEventListener("pointerdown", (e) => { if (e.pointerType === "touch" && G.fp && e.clientX > innerWidth * 0.35 && e.clientY < innerHeight * 0.7) { tid = e.pointerId; tx = e.clientX; ty = e.clientY; } });
    canvas.addEventListener("pointermove", (e) => { if (e.pointerId === tid) { G.fpManual = performance.now(); G.fpYaw -= (e.clientX - tx) * 0.005 * G.sens; G.fpPitch = clamp(G.fpPitch - (e.clientY - ty) * 0.004 * G.sens, -1.2, 1.2); tx = e.clientX; ty = e.clientY; } }); const endT = (e) => { if (e.pointerId === tid) tid = null; }; canvas.addEventListener("pointerup", endT); canvas.addEventListener("pointercancel", endT);
    const joy = $("#bk-joy"), act = $("#bk-act");
    let jid = null; const jc = { x: 0, y: 0 };
    joy.addEventListener("pointerdown", (e) => { jid = e.pointerId; joy.setPointerCapture(jid); const r = joy.getBoundingClientRect(); jc.x = r.left + r.width / 2; jc.y = r.top + r.height / 2; moveJoy(e); SND.unlock(); });
    const moveJoy = (e) => { let dx = (e.clientX - jc.x) / 55, dy = (e.clientY - jc.y) / 55; const l = Math.hypot(dx, dy); if (l > 1) { dx /= l; dy /= l; } G.joy.x = dx; G.joy.z = dy; G.joy.on = l > 0.12; joy.firstElementChild.style.transform = `translate(${dx * 45}px,${dy * 45}px)`; };
    joy.addEventListener("pointermove", (e) => { if (e.pointerId === jid) moveJoy(e); });
    const endJoy = (e) => { if (e.pointerId !== jid) return; jid = null; G.joy.x = G.joy.z = 0; G.joy.on = false; joy.firstElementChild.style.transform = ""; };
    joy.addEventListener("pointerup", endJoy); joy.addEventListener("pointercancel", endJoy);
    act.addEventListener("pointerdown", (e) => { G.act = true; act.classList.add("on"); act.setPointerCapture(e.pointerId); SND.unlock(); });
    const endAct = () => { G.act = false; act.classList.remove("on"); }; act.addEventListener("pointerup", endAct); act.addEventListener("pointercancel", endAct);
  }
  function readInput() {
    const k = G.keys; let mx = 0, mz = 0;
    if (k["arrowleft"] || k["q"] || k["a"]) mx -= 1; if (k["arrowright"] || k["d"]) mx += 1; if (k["arrowup"] || k["z"] || k["w"]) mz -= 1; if (k["arrowdown"] || k["s"]) mz += 1;
    if (G.joy.on) { mx = G.joy.x; mz = G.joy.z; }
    const j = !!(k["shift"] || k["e"] || G.jumpBtn);
    if (G.fp) {
      let a = 0, b = 0; if (k["arrowleft"] || k["q"] || k["a"]) a -= 1; if (k["arrowright"] || k["d"]) a += 1; if (k["arrowup"] || k["z"] || k["w"]) b += 1; if (k["arrowdown"] || k["s"]) b -= 1;
      if (G.joy.on) { a = G.joy.x; b = -G.joy.z; }
      const ll = Math.hypot(a, b); if (ll > 1) { a /= ll; b /= ll; }
      { const tn = performance.now(), dtf = Math.min(0.1, (tn - (G.fpT || tn)) / 1000); G.fpT = tn;
        // caméra au clavier, F gauche, H droite, T haut, G bas. Les flèches servent seulement à se déplacer
        const turn = (k["f"] ? 1 : 0) - (k["h"] ? 1 : 0), look = (k["t"] ? 1 : 0) - (k["g"] ? 1 : 0);
        if (turn || look) { G.fpManual = tn; G.fpYaw += turn * 2.6 * G.sens * dtf; G.fpPitch = clamp(G.fpPitch + look * 1.7 * G.sens * dtf * (G.inv ? -1 : 1), -1.2, 1.2); }
        if (G.phase === "play" && Math.hypot(a, b) > 0.25 && tn - G.fpManual > 700) { const d = Math.atan2(-a, b); if (Math.abs(d) < 2.35) G.fpYaw += clamp(d * 1.25, -1.5, 1.5) * dtf; } }
      const fxv = -Math.sin(G.fpYaw), fzv = -Math.cos(G.fpYaw), rxv = Math.cos(G.fpYaw), rzv = -Math.sin(G.fpYaw);
      mx = fxv * b + rxv * a; mz = fzv * b + rzv * a; const hh = !!(k[" "] || k["space"] || G.act);
      if (hh && Math.hypot(mx, mz) < 0.12) { mx = fxv * 0.16; mz = fzv * 0.16; }
      return { mx, mz, h: hh, j };
    }
    const l = Math.hypot(mx, mz); if (l > 1) { mx /= l; mz /= l; }
    return { mx, mz, h: !!(k[" "] || k["space"] || G.act), j };
  }
  const serverNow = () => { const sn = G.snaps[G.snaps.length - 1]; if (!sn || G.clockOff == null) return 0; const sms = performance.now() - G.clockOff; return sn.t + (sms - sn.now) / 1000; };

  // ---------- boucle ----------
  function interp(i, srvMs) {
    const a = G.snaps; if (!a.length) return null; let s0 = null, s1 = null;
    for (let k = a.length - 1; k >= 0; k--) { if (a[k].now <= srvMs) { s0 = a[k]; s1 = a[k + 1] || null; break; } }
    if (!s0) { s0 = a[0]; s1 = null; }
    const p0 = s0.p[i]; if (!p0) return null; const p1 = s1 && s1.p[i]; let k = 0; if (p1 && s1.now > s0.now) k = clamp((srvMs - s0.now) / (s1.now - s0.now), 0, 1);
    const L = (x, y) => x + (y - x) * k; let ang = p0[5]; if (p1) { let d = p1[5] - p0[5]; while (d > Math.PI) d -= TAU; while (d < -Math.PI) d += TAU; ang = p0[5] + d * k; }
    const st = STN[p0[6]]; const alive = !!(p0[8] & 1);
    return { x: p1 && alive ? L(p0[0], p1[0]) : p0[0], z: p1 && alive ? L(p0[1], p1[1]) : p0[1], y: p1 ? L(p0[2], p1[2]) : p0[2], vx: p0[3], vz: p0[4], a: ang, st, ch: p0[7] / 100, alive, inv: !!(p0[8] & 2), respawn: p0[10] };
  }
  function loop() {
    requestAnimationFrame(loop); if (document.hidden) { G.last = performance.now(); return; }
    PicuiteGL.frame(frame);
  }
  function frame() {
    const now = performance.now(); let dt = Math.min(0.1, (now - G.last) / 1000); G.last = now; if (!G.round || !G.view || document.body.dataset.screen !== "game") { return; }
    G.frame++; G.fps.push(dt); if (G.fps.length > 90) { const avg = G.fps.reduce((a, b) => a + b, 0) / G.fps.length; G.fps = []; adapt(avg); }
    const tNow = serverNow(); const srvMs = G.clockOff == null ? 0 : now - G.clockOff - 100;
    const playing = G.phase === "play"; const inp = readInput();
    // prédiction locale
    if (playing && G.L && G.L.alive && !$("#bk-pause").classList.contains("show")) {
      G.acc += dt; const W = G.LW; let n = 0;
      while (G.acc >= Sim.DT && n < 5) { G.acc -= Sim.DT; n++; W.t = tNow; Sim.prepare(W); applyTiles(W); Sim.stepPlayer(W, G.L, inp); W.events.length = 0; }
      if (G.acc > 0.2) G.acc = 0;
    } else G.acc = 0;
    // envoi des commandes
    if (playing) { const key = inp.mx.toFixed(2) + "," + inp.mz.toFixed(2) + inp.h + inp.j; if ((key !== G.lastSent && now - G.lastSend > 28) || now - G.lastSend > 120) { G.lastSend = now; G.lastSent = key; Kit.socket.emit("b:in", { mx: +inp.mx.toFixed(3), mz: +inp.mz.toFixed(3), h: inp.h, j: inp.j, seq: ++G.seq }); } }
    else if (G.lastSent !== "0.00,0.00false" && Kit.socket) { G.lastSent = "0.00,0.00false"; Kit.socket.emit("b:in", { mx: 0, mz: 0, h: false, j: false, seq: ++G.seq }); }
    // charge locale, sons
    const L = G.L; if (L && playing) { if (L.holding && !G.wasHold) SND.chargeStart(); if (!L.holding && G.wasHold) SND.chargeStop(); if (L.holding) SND.chargeSet(L.ch); G.wasHold = L.holding; }
    // acteurs
    const sn = G.snaps[G.snaps.length - 1]; const meIdx = G.idx[G.mine]; let cx = 0, cz = 0, cn = 0, mine = null;
    G.round.players.forEach((p, i) => {
      const a = G.actors[p.id]; if (!a) return; let s = null;
      if (G.podium) return;
      if (i === meIdx && G.L && G.L.alive && playing) { const sv = sn && sn.p[i] ? interp(i, srvMs) : null; const Lp = G.L; s = { x: Lp.x, z: Lp.z, y: Lp.y, vx: Lp.vx, vz: Lp.vz, a: Math.atan2(Lp.fz, Lp.fx), st: Lp.fall ? "fall" : Lp.air ? "air" : Lp.dash > 0 ? "dash" : Lp.holding ? "charge" : Lp.rec > 0 ? "rec" : Lp.stun > 0 ? "stun" : "ok", ch: Lp.ch, alive: true, inv: sv ? sv.inv : false }; if (sv && (sv.st === "rec" || sv.st === "stun") && s.st === "ok") s.st = sv.st; }
      else if (sn) s = interp(i, srvMs);
      if (!s) { const pre = G.pre && G.pre[i]; if (pre) s = { x: pre.x, z: pre.z, y: 0, vx: 0, vz: 0, a: pre.a, st: "ok", ch: 0, alive: true, inv: false }; else return; }
      if (G.phase === "intro" || G.phase === "count") s.st = "ok";
      if (G.phase === "roundEnd" || G.phase === "over") { const win = G.end && G.end.end && G.end.end.winners.includes(p.id); if (win) s.cheer = true; }
      a.show(s, dt); if (i === meIdx) a.group.visible = !(G.fp && playing && s.alive && G.phase === "play");
      const co = G.cos[p.id]; if (co && co.trail && playing && s.alive && (s.st === "dash" || Math.hypot(s.vx, s.vz) > 3)) FX.trail(co.trail, s.x, 0, s.z, s.vx, s.vz);
      if (s.st === "dash" && s.alive) FX.dashTrail(s.x, s.z, s.vx / (Math.hypot(s.vx, s.vz) || 1), s.vz / (Math.hypot(s.vx, s.vz) || 1), colorOf(p.id));
      else if (s.alive && s.y <= 0.01 && Math.hypot(s.vx, s.vz) > 5.5 && G.frame % 5 === 0) FX.dust(s.x, s.z, s.vx * 0.1, s.vz * 0.1, 1);
      if (s.alive) { cx += s.x; cz += s.z; cn++; } if (i === meIdx) mine = s;
      if (s.st === "fall" && G.prevSt[p.id] !== "fall") FX.fall(s.x, 0, s.z); G.prevSt[p.id] = s.st;
    });
    if (G.podium) podiumUpdate(dt);
    // monde animé
    const tView = G.phase === "intro" || G.phase === "count" ? 0 : (sn ? sn.t + ((now - G.clockOff - 100) - sn.now) / 1000 : 0);
    G.view.update(Math.max(0, tView), G.tiles, sn && sn.ck ? sn.ck : 0, dt);
    FX.update(dt);
    updateHud(mine, L, dt);
    camera(dt, cn ? { x: cx / cn, z: cz / cn } : { x: 0, z: 0 }, mine);
    R.renderer.render(R.scene, R.cam); PicuiteGL.verify(R.renderer);
  }
  function applyTiles(W) {
    const tl = G.tiles; if (!tl) return; let k = 0; const A = G.A;
    A.surfaces.forEach((s, i) => { if (s.kind !== "crumble") return; const rem = tl[k++]; const T0 = W.tiles[i]; if (rem === undefined || rem < 0) { T0.touch = -1; T0.down = -1; } else { T0.touch = 0; T0.down = G.tilesAt + rem; } });
  }
  function adapt(avg) { const fps = 1 / avg; if (G.phase !== "play") return; if (fps < 38 && G.pr > 0.65) { G.pr = Math.max(0.65, G.pr - 0.15); resize(); } else if (fps > 56 && G.pr < 1) { G.pr = Math.min(1, G.pr + 0.1); resize(); } }

  // ---------- caméra ----------
  function keysHint() { const kk = $("#bk-keys"); if (kk) kk.innerHTML = "<span><kbd>Maj</kbd> ou <kbd>E</kbd> saut</span>" + (G.fp ? "<span><kbd>F</kbd><kbd>H</kbd><kbd>T</kbd><kbd>G</kbd> caméra</span>" : ""); }
  function setFp(on) {
    on = !!on; if (on === G.fp) return; G.fp = on; G.fpInit = false; keysHint(); const xh = $("#bk-xh"); if (xh) xh.style.display = G.fp ? "block" : "none";
    if (!G.fp && document.pointerLockElement) document.exitPointerLock();
    if (G.fp && G.phase === "play") toast("Vue à la première personne, clique pour capturer la souris", "info");
    if (!G.fp) { R.cam.fov = 38; R.cam.near = 0.5; R.cam.updateProjectionMatrix(); }
  }
  function fpCamera(dt, mine) {
    const cam = R.cam; if (cam.fov !== 80) { cam.fov = 80; cam.near = 0.15; cam.updateProjectionMatrix(); }
    if (!G.fpInit) { G.fpInit = true; if (mine) G.fpYaw = Math.atan2(-Math.cos(mine.a || 0), -Math.sin(mine.a || 0)) + 0; else G.fpYaw = 0; G.fpPitch = 0; }
    const x = mine ? mine.x : 0, z = mine ? mine.z : 0, y = mine ? Math.max(mine.y, mine.st === "fall" ? mine.y : 0) : 0; const c = G.cam; c.shake *= Math.max(0, 1 - dt * 7); const sh = c.shake * 0.12;
    cam.rotation.order = "YXZ"; cam.position.set(x + (Math.random() - 0.5) * sh, y + 1.45 + (Math.random() - 0.5) * sh, z + (Math.random() - 0.5) * sh); cam.rotation.set(G.fpPitch, G.fpYaw, 0);
  }
  function camera(dt, cen, mine) {
    if (R) setFp(!!S().firstPerson);
    if (G.fp && !G.podium && G.phase === "play" && mine && mine.alive !== false) { fpCamera(dt, mine); return; }
    if (R.cam.fov !== 38) { R.cam.fov = 38; R.cam.near = 0.5; R.cam.updateProjectionMatrix(); R.cam.rotation.order = "XYZ"; }
    if (G.podium) { R.cam.position.set(0, 14.6, 14.5); R.cam.lookAt(0, 11.9, 0); return; }
    const A = G.A, cam = R.cam, c = G.cam; const asp = cam.aspect; const fov = cam.fov * Math.PI / 180;
    const Rv = A.R * 0.78 + 3.2; const pitch = 0.98; // 56 degrés
    const distV = (Rv * 0.86) / Math.tan(fov / 2) / Math.sin(pitch) * 0.78, distH = (Rv * 1.0) / (Math.tan(fov / 2) * asp);
    let dist = Math.max(distV, distH) * 1.02;
    let tx = cen.x * 0.18, tz = cen.z * 0.18; let ty = 0;
    if (G.phase === "intro") { const k = clamp((performance.now() - G.introAt) / 4200, 0, 1); const ang = (1 - k) * 1.2; dist *= 1.0 + (1 - k) * 0.35; tx = 0; tz = 0; c.yaw = ang * 0.7; }
    else c.yaw = (c.yaw || 0) * Math.max(0, 1 - dt * 4);
    if (mine && mine.st === "fall" && G.phase === "play") { ty = clamp(mine.y * 0.2, -2.5, 0); }
    if (G.podium) { tx = 0; tz = 0; dist = 11; }
    const ca = Math.cos(pitch), sa = Math.sin(pitch); const yaw = c.yaw || 0;
    const px = tx + Math.sin(yaw) * dist * ca, pz = tz + Math.cos(yaw) * dist * ca, py = ty + dist * sa;
    c.x += (px - c.x) * Math.min(1, dt * 5); c.y += (py - c.y) * Math.min(1, dt * 5); c.z += (pz - c.z) * Math.min(1, dt * 5);
    if (!c.init) { c.x = px; c.y = py; c.z = pz; c.init = true; }
    c.shake *= Math.max(0, 1 - dt * 7); const sh = c.shake * 0.35;
    cam.position.set(c.x + (Math.random() - 0.5) * sh, c.y + (Math.random() - 0.5) * sh, c.z + (Math.random() - 0.5) * sh); cam.lookAt(tx, ty, tz);
  }

  // ---------- interface pendant la manche ----------
  function updateHud(mine, L, dt) {
    const chg = $("#bk-charge"); if (chg) { const on = L && L.holding && G.phase === "play"; chg.classList.toggle("on", !!on); if (on) chg.firstElementChild.style.width = Math.round(L.ch * 100) + "%"; }
    const cd = $("#bk-cd"); if (cd && L) { const v = G.phase === "play" ? clamp(L.cd / 1.15, 0, 1) : 0; cd.style.opacity = v > 0.02 ? 0.9 : 0; cd.firstElementChild.style.width = Math.round(v * 100) + "%"; }
    // compte à rebours
    if (G.phase === "count") { const left = Math.max(0, 3 - (performance.now() - G.phaseAt) / 1000); const n = Math.ceil(left); if (n !== G.cdN && n > 0) { G.cdN = n; SND.beep(n === 1 ? 0 : 0); banner(String(n), "", 0); } }
    if (G.phase === "intro" && performance.now() - G.introAt > 3600) { const b = $("#bk-banner"); if (b && b.firstChild && b.firstChild.textContent !== "Prêts ?") banner("Prêts ?", "", 0); }
    if (G.phase === "play" && mine && !mine.alive && G.round && Rules.isTimed(G.round.mode)) { const sn = G.snaps[G.snaps.length - 1]; const p = sn && sn.p[G.idx[G.mine]]; if (p && p[10] > 0) banner("", "Retour dans " + Math.ceil(p[10]) + " s", 400); }
    updateCrown();
  }
  function updateCrown() {
    const c = $("#bk-crown"), h = G.hud; if (!c) return; if (!h || !h.crown || !R || !G.round || G.round.mode !== "couronne") { c.style.display = "none"; if (G.crownMesh) G.crownMesh.visible = false; return; }
    if (!G.crownMesh && R) { const m = new T.Mesh(new T.CylinderGeometry(2.2, 2.2, 0.1, 40), new T.MeshBasicMaterial({ color: 0xffd23d, transparent: true, opacity: 0.5, depthWrite: false })); m.position.y = 0.09; R.scene.add(m); G.crownMesh = m; const ring = new T.Mesh(new T.RingGeometry(2.1, 2.3, 48), new T.MeshBasicMaterial({ color: 0xffffff, side: T.DoubleSide, transparent: true, opacity: 0.9 })); ring.rotation.x = -Math.PI / 2; ring.position.y = 0.13; m.add(ring); G.crownRing = ring; }
    G.crownMesh.visible = true; G.crownMesh.position.set(h.crown.x, 0.09, h.crown.z);
    const col = !h.crown.on ? 0xaaaaaa : h.crown.contested ? 0xff4d3d : h.crown.who ? 0x7be07b : 0xffd23d; G.crownMesh.material.color.setHex(col); G.crownMesh.material.opacity = h.crown.on ? 0.55 : 0.2 + 0.2 * Math.sin(performance.now() / 150);
    const v = new T.Vector3(h.crown.x, 3, h.crown.z).project(R.cam); c.style.display = v.z < 1 ? "block" : "none"; c.style.left = ((v.x + 1) / 2 * 100) + "%"; c.style.top = ((1 - v.y) / 2 * 100) + "%";
  }

  // ---------- fin de manche et de partie ----------
  function tableHtml(rows, opts) {
    const m = G.round; const mine = G.mine; const team = (r) => (m && m.mode === "teams" && r.team ? `<span style="color:${TEAM[r.team].hex}">●</span> ` : "");
    return `<table class="bk-tab"><tr><th>#</th><th>Joueur</th>${opts.cols.map((c) => `<th class="n">${c[0]}</th>`).join("")}</tr>` + rows.map((r) => `<tr class="${r.id === mine ? "me" : ""} ${r.place === 1 ? "win" : ""}"><td>${r.place}</td><td><span class="dot" style="background:${colorOf(r.id)}"></span>${team(r)}${esc(nameOf(r.id))}</td>${opts.cols.map((c) => `<td class="n">${c[1](r)}</td>`).join("")}</tr>`).join("") + "</table>";
  }
  function showEnd(d) {
    if (!G.round) return; const e = d.end; const ov = $("#bk-end"); const win = e.winners.length ? e.winners.map((id) => nameOf(id)).join(" et ") : "Personne";
    const mode = G.round.mode; const title = mode === "teams" && e.team ? "Équipe " + TEAM[e.team].name.toLowerCase() + " gagne la manche" : e.winners.length ? win + " gagne la manche" : "Égalité";
    const res = e.res.slice().sort((a, b) => a.place - b.place); const rows = res.map((r) => Object.assign({ team: (G.round.players.find((p) => p.id === r.id) || {}).team }, r));
    const tot = {}; d.standings.forEach((r) => { tot[r.id] = r; });
    const timed = Rules.isTimed(mode);
    ov.innerHTML = `<div class="bk-card"><h2>${esc(title)}</h2><div class="sm">${e.double ? "Points doubles pour cette dernière manche. " : ""}${G.round.i + 1 < G.round.total ? "La prochaine manche arrive dans quelques secondes." : "C'était la dernière manche."}</div>` +
      tableHtml(rows, { cols: [[timed ? "Score" : "Éject.", (r) => (timed ? r.score : r.ko)], ["Manche", (r) => "+" + r.pts], ["Total", (r) => (tot[r.id] ? tot[r.id].pts : 0)]] }) + `</div>`;
    ov.classList.add("show"); banner("", "", 0);
    const meWon = e.winners.includes(G.mine); if (meWon) { SND.win(); const a = G.actors[G.mine]; if (a) FX.confetti(a.group.position.x, 1, a.group.position.z, 50); } else SND.lose();
    if (e.winners.length) e.winners.forEach((id) => { const a = G.actors[id]; if (a) FX.confetti(a.group.position.x, 1, a.group.position.z, 20); });
  }
  function showOver(d) {
    if (!G.round) return; const ov = $("#bk-over"); $("#bk-end").classList.remove("show"); const st = d.standings; const top = st.filter((r) => r.place === 1);
    const mode = G.round.mode; let head = top.length > 1 ? "Égalité en tête" : esc(top[0].name) + " remporte la partie";
    if (d.teams && mode === "teams") { const w = d.teams[1] === d.teams[2] ? null : d.teams[1] > d.teams[2] ? 1 : 2; head = w ? "L'équipe " + TEAM[w].name.toLowerCase() + " remporte la partie" : "Égalité entre les équipes"; }
    ov.innerHTML = `<div class="bk-card"><h2>${head}</h2><div class="sm">${d.teams && mode === "teams" ? `Rouge ${d.teams[1]} points, bleu ${d.teams[2]} points` : "Classement général"}</div>` +
      tableHtml(st.map((r) => Object.assign({}, r)), { cols: [["Manches", (r) => r.wins], ["Éject.", (r) => r.ko], ["Points", (r) => r.pts]] }) +
      `<div class="bk-btnrow">${Kit.isHost() ? '<button class="bk-b" id="bk-again">Revanche</button>' : '<span class="sm">En attente de l\'hôte pour la revanche</span>'}<button class="bk-b g" id="bk-quit">Quitter</button></div></div>`;
    ov.classList.add("show", "podium"); setupPodium(st);
    const a = $("#bk-again"); if (a) a.onclick = () => Kit.backToLobby(); $("#bk-quit").onclick = () => Kit.leave();
    SND.win();
  }
  function setupPodium(st) {
    if (G.podium || !R) return; const g = new T.Group(); const heights = [1.6, 1.1, 0.7]; const xs = [0, -2.6, 2.6];
    const topIds = st.slice(0, 3).map((r) => r.id); const cols = [0xffd23d, 0xcfd6e0, 0xd08a4a];
    heights.forEach((h, i) => { const b = new T.Mesh(new T.BoxGeometry(2.2, h, 2.2), new T.MeshLambertMaterial({ color: cols[i] })); b.position.set(xs[i], 12 + h / 2 - 0.0, 0); b.castShadow = true; g.add(b); });
    const pl = new T.PointLight(0xfff2c8, 1.6, 30); pl.position.set(0, 18, 6); g.add(pl); g.position.y = 0; R.scene.add(g); G.podium = g; G.podiumIds = topIds; G.podiumH = heights; G.podiumX = xs; G.podiumT = 0;
    // les autres joueurs sont cachés, les trois premiers montent sur le podium, loin au dessus du décor pour ne rien chevaucher
    Object.keys(G.actors).forEach((id) => { const a = G.actors[id]; const k = topIds.indexOf(id); a.group.visible = k >= 0; });
  }
  function podiumUpdate(dt) {
    G.podiumT += dt; G.round.players.forEach((p) => { const k = G.podiumIds.indexOf(p.id); const a = G.actors[p.id]; if (!a) return; if (k < 0) { a.group.visible = false; return; } a.group.visible = true; a.show({ x: G.podiumX[k], z: 0.1, y: 12 + G.podiumH[k], vx: 0, vz: 0, a: Math.PI / 2, st: "ok", ch: 0, alive: true, inv: false, cheer: k === 0, lose: false }, dt); a.pose.rotation.y = 0; });
    if (G.podiumT > 0.5 && !G.podiumConf) { G.podiumConf = true; FX.confetti(0, 14, 0, 80); } G.view.update(0, null, 0, dt); FX.update(dt);
    G.cam.init = false;
  }
  function openPause() {
    const ov = $("#bk-pause"); ov.innerHTML = `<div class="bk-card"><h2>Menu</h2><div class="bk-set">
      <label>Volume<input type="range" id="bk-vol" min="0" max="100" value="${Math.round(SND.vol * 100)}"></label>
      <label>Sensibilité de la souris<input type="range" id="bk-sens" min="40" max="220" value="${Math.round(G.sens * 100)}"></label>
      <label>Qualité de l'image<select id="bk-q"><option value="low">Légère</option><option value="medium">Équilibrée</option><option value="high">Belle</option></select></label></div>
      <div class="bk-btnrow"><button class="bk-b" id="bk-resume">Reprendre</button><button class="bk-b g" id="bk-leave">Quitter la partie</button></div></div>`;
    ov.classList.add("show"); $("#bk-q").value = G.quality; $("#bk-vol").oninput = (e) => SND.setVol(e.target.value / 100); $("#bk-q").onchange = (e) => setQuality(e.target.value); $("#bk-sens").oninput = (e) => { G.sens = e.target.value / 100; store.set("bousk.sens", String(G.sens)); };
    $("#bk-resume").onclick = closePause; $("#bk-leave").onclick = () => Kit.confirm("Quitter la partie en cours ?", () => { closePause(); Kit.leave(); });
  }
  function closePause() { $("#bk-pause").classList.remove("show"); }

  // ---------- personnalisation dans le salon ----------
  let prev = null, prevNode = null;
  function setCos(k, d) { const c = myCos(); const n = { char: CH.FILES.length, hat: CH.HATS.length, trail: CH.TRAILS.length }[k]; c[k] = (c[k] + d + n) % n; store.set("bousk.cos", JSON.stringify(c)); sendCos(); refreshPreview(); drawPickers(); }
  function drawPickers() { if (!prevNode) return; const c = myCos(); [["char", "Personnage", CH.NAMES], ["hat", "Accessoire", CH.HATS], ["trail", "Effet", CH.TRAILS]].forEach(([k, l, arr]) => { const e = prevNode.querySelector("[data-k=" + k + "] b"); if (e) e.textContent = arr[c[k]]; }); }
  function makePreview() {
    if (prevNode) return; prevNode = el("div", { class: "bk-custom" });
    const cv = el("canvas", { width: 300, height: 380 }); prevNode.appendChild(cv);
    const box = el("div"); [["char", "Personnage"], ["hat", "Accessoire"], ["trail", "Effet"]].forEach(([k, l]) => box.appendChild(el("div", { class: "bk-pick", "data-k": k }, [el("span", { class: "l", text: l }), el("button", { text: "‹", title: "Précédent", onclick: () => setCos(k, -1) }), el("b"), el("button", { text: "›", title: "Suivant", onclick: () => setCos(k, 1) })])));
    box.appendChild(el("p", { class: "muted small", text: "Les accessoires et les effets ne changent rien au jeu, ils servent à te reconnaître." }));
    prevNode.appendChild(box); drawPickers();
    try { const r = new T.WebGLRenderer({ canvas: cv, antialias: true, alpha: true }); r.setClearColor(0x000000, 0); const sc = new T.Scene(); const cam = new T.PerspectiveCamera(30, 300 / 380, 0.1, 50); cam.position.set(0, 1.5, 5.4); cam.lookAt(0, 1.0, 0); sc.add(new T.HemisphereLight(0xffffff, 0x8899bb, 1.1)); const dl = new T.DirectionalLight(0xffffff, 0.9); dl.position.set(3, 6, 5); sc.add(dl); prev = { r, sc, cam, actor: null, key: "" }; } catch (e) { prev = null; }
    const tick = () => { requestAnimationFrame(tick); if (!prev || document.body.dataset.screen !== "lobby" || !prevNode.isConnected) return; if (prev.actor) { prev.actor.show({ x: 0, z: 0, y: 0, vx: 0, vz: 0, a: Math.PI / 2 - 0.4 + Math.sin(performance.now() / 1500) * 0.25, st: "ok", ch: 0, alive: true, inv: false }, 0.016); prev.actor.tag.visible = false; prev.actor.shadow.visible = false; } prev.r.render(prev.sc, prev.cam); };
    tick();
  }
  function refreshPreview() {
    if (!prev) return; const c = myCos(); const me = Kit.me(); const col = me ? COLORS[me.color % 8].hex : "#e8453c"; const key = [c.char, c.hat, col].join("|"); if (key === prev.key) return; prev.key = key;
    if (prev.actor) { prev.actor.dispose(); prev.actor = null; } CH.load(() => { if (prev.key !== key) return; prev.actor = new CH.Actor(prev.sc, { name: "", color: col, char: c.char, hat: c.hat }); prev.actor.group.scale.setScalar(1); });
  }
  function renderPreview(box, room) {
    makePreview(); if (!prevNode.isConnected || prevNode.parentNode !== box) box.appendChild(prevNode); refreshPreview(); drawPickers();
    let ar = box.querySelector(".bk-arenas"); if (!ar) { ar = el("div", { class: "bk-arenas" }); box.appendChild(ar); const on = new Set(S().arenas || []); Ar.LIST.forEach((a) => ar.appendChild(el("div", { "data-a": a.id }, [el("b", { text: a.name }), el("span", { class: "muted", text: a.blurb })]))); }
    const on = new Set((room.settings && room.settings.arenas) || []); ar.querySelectorAll("[data-a]").forEach((d) => { d.style.opacity = on.has(d.dataset.a) ? 1 : 0.35; });
  }

  // ---------- démarrage ----------
  function onInit() {
    buildGame(); attach(); Kit.on("connect", () => { attach(); sendCos(); });
    Kit.on("room", () => { if (Kit.room && Kit.room.status === "lobby") { sendCos(); } });
    Kit.on("screen", (n) => { if (n === "game") { setTimeout(() => { if (initRender()) resize(); }, 30); } if (n !== "game") { SND.stopAmb(); SND.chargeStop(); } });
    Kit.on("reset", () => leaveGame());
    document.addEventListener("pointerdown", () => SND.unlock(), { once: true });
  }
  Kit.init({
    id: "bouskaille", hero: true, title: "Bouskaille", emoji: "🥊", ribbon: "Pousse, esquive, tiens bon", tagline: "Des arènes qui bougent, des copains à pousser dans le vide.",
    createLabel: "Créer un salon", soloLabel: "Jouer contre des bots", startLabel: "Lancer la partie", helpTitle: "Comment jouer",
    floaters: [{ e: "🥊", x: 6 }, { e: "☁️", x: 20 }, { e: "🎠", x: 34 }, { e: "🏝️", x: 48 }, { e: "🎡", x: 62 }, { e: "🍄", x: 76 }, { e: "⭐", x: 90 }],
    colors: COLORS, botLevels: LEVELS, maxPlayers: 8, minPlayers: 2, schema: Rules.SCHEMA,
    help: [
      { title: "Le but", text: "Reste sur l'arène et fais tomber les autres. Dans Chacun pour soi, le dernier debout gagne la manche. Chaque éjection rapporte aussi des points, donc quelqu'un d'éliminé tôt peut remonter au classement général." },
      { title: "Se déplacer", text: "Les flèches du clavier, ZQSD ou WASD pour bouger. Sur téléphone, un joystick et un bouton apparaissent. En vue à la première personne, la caméra suit ta direction toute seule, et tu peux aussi l'orienter avec la souris ou avec F et H pour regarder à gauche et à droite, T et G pour regarder vers le haut et vers le bas." },
      { title: "Pousser et charger", text: "Un appui rapide sur Espace donne une poussée courte, utile pour repousser quelqu'un qui est tout près. Si tu maintiens Espace, tu charges, tu avances lentement et un anneau grandit autour de toi. En relâchant, tu fonces dans la direction où tu vas. Plus la charge est longue, plus le choc est fort." },
      { title: "Les risques", text: "Une charge qui ne touche personne te laisse sans défense un instant, et tu ne peux pas enchaîner les charges sans pause. Quelqu'un qui te percute pendant que tu charges ou que tu récupères t'envoie bien plus loin." },
      { title: "Jouer avec l'élan", text: "Un choc de plein fouet avec beaucoup de vitesse pousse bien plus qu'un choc de côté. Tu peux infléchir un peu ta charge en route, et esquiver sur le côté quand tu vois quelqu'un charger." },
      { title: "Les arènes", text: "Les nuages ont des rafales de vent annoncées par des traînées blanches. L'usine a des tapis roulants et des pistons qui clignotent avant de sortir. Le manège tourne avec des bras qui balayent. L'île a de la boue, des champignons et une marée. Les sections glissent, la fête foraine a des bumpers, et la structure flottante allonge ses bras." },
      { title: "Les modes", text: "Chacun pour soi, équipe contre équipe, Points où l'on revient après une chute, et Roi de la couronne où il faut rester seul dans la zone dorée. À la fin, l'arène rétrécit pour que les manches se terminent." },
      { title: "Personnaliser", text: "Dans le salon, choisis ton personnage, ton accessoire et ton effet. Ça ne change rien au jeu." },
    ],
    theme: { a1: "#ff8a3d", a2: "#ffcf5a", bg1: "#5a2a8a", bg2: "#1a0f33" },
    renderPreview, onInit,
  });
})();

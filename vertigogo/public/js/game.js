// ============================================================
// VERTIGOGO — Interface de jeu, pilotage local, réseau et affichage (client)
// ============================================================
(function () {
  const { el, $, toast, store } = Kit;
  const S = VgSim, Cr = VgCourse, Rules = VgRules, SC = VgScene, CH = VgChars, FX = VgFX, SND = FX.sound;
  const T = THREE; const TAU = Math.PI * 2;
  const COLORS = [
    { name: "Rouge", hex: "#e8453c" }, { name: "Bleu", hex: "#2f78d1" }, { name: "Vert", hex: "#3aa653" }, { name: "Jaune", hex: "#f2c230" },
    { name: "Violet", hex: "#8a55c8" }, { name: "Orange", hex: "#f08a24" }, { name: "Rose", hex: "#ee6fb0" }, { name: "Turquoise", hex: "#25b9b0" },
  ];
  const LEVELS = [{ id: "debutant", label: "Apprenti" }, { id: "moyen", label: "Habitué" }, { id: "champion", label: "Champion" }, { id: "prodige", label: "Prodige" }];
  const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
  const isTouch = ("ontouchstart" in window) || (navigator.maxTouchPoints > 0 && /Mobi|Android|iPhone|iPad/.test(navigator.userAgent));
  if (isTouch) document.documentElement.classList.add("touch");
  const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
  const fmtT = (s) => { s = Math.max(0, s); const m = Math.floor(s / 60), r = s - m * 60; return m > 0 ? m + " min " + (r < 10 ? "0" : "") + r.toFixed(1).replace(".", ",") + " s" : r.toFixed(1).replace(".", ",") + " s"; };
  const fmtS = (s) => { s = Math.max(0, Math.round(s)); const m = Math.floor(s / 60); return m > 0 ? m + " min " + (s % 60 < 10 ? "0" : "") + (s % 60) + " s" : s + " s"; };

  const G = {
    msg: null, C: null, W: null, P: null, view: null, actors: {}, ids: [], idx: {}, snaps: [], off: [], clockOff: null, rank: null, phase: "none", phaseAt: 0, input: {}, keys: {}, joy: { x: 0, z: 0, on: false }, jump: false, drop: false,
    cam: { yaw: 0, pitch: 0.42, dist: 7, fx: 0, fy: 0, fz: 0, init: false, shake: 0 }, last: 0, acc: 0, tPlay: 0, lastSend: 0, lock: 0, quality: store.get("vg.quality", isTouch ? "medium" : "high"), sens: +store.get("vg.sens", "1"), inv: store.get("vg.inv", "0") === "1",
    pr: 1, fps: [], frame: 0, cos: {}, mine: null, cpSeen: {}, falls: 0, pen: 0, fixAt: 0, good: null, stepT: 0, hudAt: 0, fin: null, wasAir: false, marker: null, over: null, countN: 0, hangPrompt: 0, lastFixWhy: "",
  };
  const myPid = () => { const p = Kit.me(); return p ? p.id : null; };
  const colorOf = (id) => { const d = G.msg && G.msg.players.find((p) => p.id === id); return d ? COLORS[d.color % 8].hex : "#fff"; };
  const nameOf = (id) => { const d = G.msg && G.msg.players.find((p) => p.id === id); return d ? d.name : "?"; };
  const myCos = () => { try { const c = JSON.parse(store.get("vg.cos", "{}")); return { char: c.char | 0, hat: c.hat | 0, trail: c.trail | 0 }; } catch (e) { return { char: 0, hat: 0, trail: 0 }; } };
  const slot = (C, i) => { const sb = C.boxes[C.startBox]; const cx = (sb.x0 + sb.x1) / 2, cz = (sb.z0 + sb.z1) / 2; return { x: cx + ((i % 4) - 1.5) * 1.9, z: cz + (Math.floor(i / 4) - 0.5) * 2.2 }; };

  // ---------- écran ----------
  let R = null, canvas, hudEl;
  function buildGame() {
    const sc = $("#screen-game"); sc.innerHTML = ""; canvas = el("canvas", { id: "vg-canvas" }); sc.appendChild(canvas);
    hudEl = el("div", { class: "vg-hud" });
    hudEl.innerHTML = `<div class="vg-board" id="vg-board"></div>
      <div class="vg-top"><div class="vg-pill" id="vg-mode"></div><div class="vg-pill vg-tl" id="vg-timer">0 s</div></div>
      <div class="vg-feed" id="vg-feed"></div>
      <div class="vg-btns"><button class="vg-btn" id="vg-snd" title="Son">🔊</button><button class="vg-btn" id="vg-menu" title="Menu">⚙️</button></div>
      <div class="vg-gauge" id="vg-gauge"><div class="top" id="vg-gtop"></div><div class="rail" id="vg-rail"></div><div class="bot">0 m</div></div>
      <div class="vg-alt" id="vg-alt"><b id="vg-h">0 m</b><span id="vg-z"></span></div>
      <div class="vg-prompt" id="vg-prompt"></div><div class="vg-fall" id="vg-fall"></div>
      <div class="vg-banner" id="vg-banner"></div><div class="vg-fade" id="vg-fade"></div>
      <div class="vg-help" id="vg-help"></div>
      <div class="vg-ck" id="vg-ck"><span>Caméra</span><kbd id="ck-g" title="Tourner à gauche">G</kbd><kbd id="ck-h" title="Tourner à droite">H</kbd><kbd id="ck-r" title="Monter la caméra">R</kbd><kbd id="ck-f" title="Descendre la caméra">F</kbd></div>
      <div class="vg-joy" id="vg-joy"><i></i></div><div class="vg-act" id="vg-act">SAUT</div><div class="vg-btn2" id="vg-b2">LÂCHER</div>
      <div class="vg-ov" id="vg-end"></div><div class="vg-ov" id="vg-over"></div><div class="vg-ov" id="vg-pause"></div>`;
    sc.appendChild(hudEl);
    $("#vg-snd").onclick = () => { SND.setMute(!SND.muted); $("#vg-snd").textContent = SND.muted ? "🔇" : "🔊"; if (!SND.muted) SND.click(); }; $("#vg-snd").textContent = SND.muted ? "🔇" : "🔊"; $("#vg-menu").onclick = openPause;
    bindInput();
  }
  function banner(big, sub, ms) { const b = $("#vg-banner"); if (!b) return; b.innerHTML = ""; if (big) b.appendChild(el("div", { class: "big", text: big })); if (sub) b.appendChild(el("div", { class: "sub", text: sub })); b.style.display = big || sub ? "block" : "none"; clearTimeout(banner.t); if (ms) banner.t = setTimeout(() => { b.style.display = "none"; }, ms); }
  function feed(html) { const f = $("#vg-feed"); if (!f) return; const d = el("div", { html }); f.appendChild(d); while (f.children.length > 4) f.removeChild(f.firstChild); setTimeout(() => d.remove(), 4600); }
  const dotHtml = (id) => `<span class="dot" style="display:inline-block;width:11px;height:11px;border-radius:50%;background:${colorOf(id)};margin-right:5px"></span><b>${esc(nameOf(id))}</b>`;

  // ---------- rendu ----------
  function initRender() {
    if (R) return true; let renderer;
    try { renderer = PicuiteGL.create(T, canvas, G.quality === "low" ? "low" : "high"); } catch (e) { return false; }
    renderer.shadowMap.enabled = G.quality !== "low"; renderer.shadowMap.type = T.PCFSoftShadowMap; if (T.sRGBEncoding) renderer.outputEncoding = T.sRGBEncoding; renderer.toneMapping = T.ACESFilmicToneMapping; renderer.toneMappingExposure = 1.0;
    const scene = new T.Scene(); const cam = new T.PerspectiveCamera(58, 1, 0.3, 700); R = { renderer, scene, cam };
    FX.init(scene, cam, G.quality); PicuiteGL.watch(canvas, () => resize()); window.addEventListener("resize", resize); resize(); CH.load(); G.last = performance.now(); loop(); return true;
  }
  function resize() { if (!R) return; const w = canvas.clientWidth || innerWidth, h = canvas.clientHeight || innerHeight; const dpr = Math.min(devicePixelRatio || 1, G.quality === "high" ? 2 : G.quality === "medium" ? 1.5 : 1) * G.pr; R.renderer.setPixelRatio(dpr); R.renderer.setSize(w, h, false); R.cam.aspect = w / h; R.cam.fov = w / h < 0.8 ? 70 : 58; R.cam.updateProjectionMatrix(); FX.resize(h * dpr); }
  function setQuality(q) { G.quality = q; store.set("vg.quality", q); if (R) { R.renderer.shadowMap.enabled = q !== "low"; resize(); } if (G.msg) startCourse(G.msg, true); }

  // ---------- parcours ----------
  function disposeCourse() { Object.values(G.actors).forEach((a) => a.dispose()); G.actors = {}; if (G.view) { G.view.dispose(); G.view = null; } if (G.marker) { R.scene.remove(G.marker); G.marker = null; } FX.clear(); SND.stopAmb(); }
  function startCourse(msg, keepPhase) {
    if (window.VgProps3D && VgProps3D.state < 2) { VgProps3D.load(() => startCourse(msg, keepPhase)); return; }
    if (!initRender()) return toast("Ton navigateur ne peut pas afficher la 3D.", "error");
    disposeCourse(); G.msg = msg; G.cos = msg.cos || G.cos; G.C = Cr.generate(msg.opts); G.W = S.makeWorld(G.C); G.ids = msg.players.map((p) => p.id); G.idx = {}; G.ids.forEach((id, i) => { G.idx[id] = i; }); G.mine = myPid(); G.snaps = []; G.cpSeen = {}; G.fin = null; G.over = null; G.falls = 0; G.pen = 0;
    const me = G.idx[G.mine] || 0; const s0 = slot(G.C, me); G.P = S.newPlayer(s0.x, 0, s0.z, G.C.start.ry); G.P.on = G.C.startBox; G.good = { x: s0.x, y: 0, z: s0.z };
    G.view = new SC.CourseView(R.scene, G.C, G.quality); resize();
    msg.players.forEach((p, i) => { const co = G.cos[p.id] || { char: 0, hat: 0, trail: 0 }; const a = new CH.Actor(R.scene, { name: p.name, color: colorOf(p.id), char: co.char, hat: co.hat, me: p.id === G.mine }); const s = slot(G.C, i); a.group.position.set(s.x, 0, s.z); a.fy = G.C.start.ry; G.actors[p.id] = a; });
    // marqueur d'atterrissage
    const mk = new T.Group(); const ring = new T.Mesh(new T.RingGeometry(0.34, 0.5, 28), new T.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.9, depthWrite: false, depthTest: false })); ring.rotation.x = -Math.PI / 2; const dot = new T.Mesh(new T.CircleGeometry(0.3, 20), new T.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.35, depthWrite: false, depthTest: false })); dot.rotation.x = -Math.PI / 2; mk.add(ring, dot); mk.renderOrder = 9; ring.renderOrder = 9; dot.renderOrder = 9; R.scene.add(mk); G.marker = mk;
    G.cam.yaw = G.C.start.ry + Math.PI; G.cam.pitch = 0.42; G.cam.init = false;
    document.body.dataset.vg = "course"; $("#vg-end").classList.remove("show"); $("#vg-over").classList.remove("show");
    const md = Rules.MODES[msg.mode] || ""; $("#vg-mode").innerHTML = `<span>${esc(md)}</span><span style="opacity:.75">${msg.mode === "jour" ? esc(msg.day) : "Graine " + esc(msg.seed)}</span>`;
    renderRail(); renderBoard();
    const h = $("#vg-help"); if (h) { h.style.opacity = 1; h.innerHTML = isTouch ? "Joystick pour avancer, glisse à droite pour tourner la caméra, bouton Saut pour sauter." : "<kbd>ZQSD</kbd> pour bouger, <kbd>Espace</kbd> pour sauter (appuie plus longtemps pour sauter plus haut), la souris ou les touches G, H, R et F orientent la caméra. Saute vers un rebord pour t'y accrocher."; }
    if (!keepPhase) { G.phase = "load"; }
  }
  function renderRail() {
    const r = $("#vg-rail"); if (!r || !G.C) return; r.innerHTML = ""; const top = G.C.summitTop; G.C.zones.forEach((z, i) => { if (i === 0) return; const b = el("div", { class: "zb" }); b.style.bottom = (z.y0 / top * 100) + "%"; r.appendChild(b); });
    $("#vg-gtop").textContent = Math.round(top) + " m";
    (G.msg.players || []).forEach((p) => { const pin = el("div", { class: "pin" + (p.id === G.mine ? " me" : ""), id: "pin-" + p.id }); pin.style.background = colorOf(p.id); pin.style.bottom = "0%"; r.appendChild(pin); });
  }
  function renderBoard() {
    const b = $("#vg-board"); if (!b || !G.msg) return; b.innerHTML = ""; const rk = G.rank; if (!rk) return;
    rk.rows.slice(0, 8).forEach((r) => { const row = el("div", { class: "vg-row" + (r.id === G.mine ? " me" : "") + (r.away ? " dead" : "") }, [el("span", { class: "sk", text: String(r.place) }), el("span", { class: "dot", style: { background: colorOf(r.id) } }), el("span", { class: "nm", text: nameOf(r.id) }), el("span", { class: "sc", text: r.fin != null ? "🏁" : Math.round(r.h) + " m" })]); b.appendChild(row); });
  }

  // ---------- réseau ----------
  function attach() {
    const s = Kit.socket; if (!s || s.__vg) return; s.__vg = true;
    s.on("v:course", (m) => { G.cos = m.cos || G.cos; const same = G.msg && G.C && JSON.stringify(G.msg.opts) === JSON.stringify(m.opts) && G.view; if (same) { G.msg = m; G.cos = m.cos || G.cos; } else startCourse(m); if (m.left > 0 && G.phase === "load") onPhase({ p: "count", n: m.left }); });
    s.on("v:phase", (d) => onPhase(d));
    s.on("v:snap", onSnap);
    s.on("v:rank", (r) => { G.rank = r; });
    s.on("v:fix", onFix);
    s.on("v:cp", () => {});
    s.on("v:fin", (d) => { if (!G.msg) return; feed(`${dotHtml(d.id)} atteint le sommet en ${esc(fmtT(d.t))}`); if (d.id === G.mine) onMyFinish(d); });
    s.on("v:over", (d) => { G.over = d; showOver(d); });
    s.on("v:cosmap", (m) => { G.cos = m; refreshPreview(); });
    s.on("room:lobbyAgain", () => leaveGame());
    sendCos();
  }
  function sendCos() { if (Kit.socket && Kit.socket.connected) { Kit.socket.emit("v:cos", myCos()); Kit.socket.emit("v:hello"); } }
  function leaveGame() { document.body.dataset.vg = ""; if (R) disposeCourse(); $("#vg-end") && $("#vg-end").classList.remove("show"); $("#vg-over") && $("#vg-over").classList.remove("show"); G.msg = null; G.C = null; G.phase = "none"; if (document.pointerLockElement) document.exitPointerLock(); }
  function onPhase(d) {
    const was = G.phase; G.phase = d.p; G.phaseAt = performance.now(); if (d.p === "load") { banner("Préparation du parcours", "Le serveur vérifie que tout est faisable.", 0); }
    if (d.p === "count") { G.countAt = performance.now() + (d.n || 4) * 1000; G.countN = 0; $("#vg-over").classList.remove("show"); banner("", "", 0); }
    if (d.p === "play") { G.tPlay = 0; G.playAt = performance.now(); G.snaps = []; banner("Grimpe !", "", 900); SND.go(); if (was !== "count") { const h = $("#vg-help"); if (h) h.style.opacity = 0; } setTimeout(() => { const h = $("#vg-help"); if (h) h.style.opacity = 0; }, 9000); if (G.msg) $("#vg-over").classList.remove("show"); }
  }
  function onSnap(sn) {
    const arr = performance.now(); sn.arr = arr; const off = arr - sn.now; G.off.push(off); if (G.off.length > 40) G.off.shift(); G.clockOff = Math.min.apply(null, G.off) + 5; G.snaps.push(sn); if (G.snaps.length > 30) G.snaps.shift(); G.srvT = sn.t;
  }
  function onFix(d) {
    const P = G.P; if (!P) return; P.x = d.x; P.y = d.y; P.z = d.z; P.vx = P.vy = P.vz = 0; P.st = "ground"; P.on = -1; P.hang = null; P.climb = null; P.coy = 0; P.buf = 0; if (G.W) G.W.cr = {}; G.good = { x: d.x, y: d.y, z: d.z }; G.lock = 0.3; G.pen = d.pen || 0; G.falls = d.falls || 0; G.fixAt = performance.now();
    if (d.quiet) return; SND.respawn(); const f = $("#vg-fade"); f.classList.add("on"); setTimeout(() => f.classList.remove("on"), 120);
    if (d.why === "fall") { const m = G.msg && G.msg.mode; showFall(m === "classique" ? "Le filet te rattrape" : m === "chrono" ? "Retour au drapeau, plus 5 secondes" : "Retour au dernier drapeau"); }
    else if (d.why === "reset") showFall("Retour au dernier drapeau"); else if (d.why === "sync") showFall("Position corrigée");
    FX.poof(d.x, d.y + 0.8, d.z, 0xffffff); G.cam.init = false;
  }
  function showFall(t) { const f = $("#vg-fall"); f.textContent = t; f.classList.remove("on"); void f.offsetWidth; f.classList.add("on"); clearTimeout(showFall.t); showFall.t = setTimeout(() => f.classList.remove("on"), 1800); }
  function onMyFinish(d) { G.fin = d; SND.finish(); const a = G.actors[G.mine]; FX.confetti(G.P.x, G.P.y + 1, G.P.z, 70); banner("Sommet atteint", fmtT(d.t) + (d.place === 1 ? ", tu es premier" : ", place " + d.place), 5000); }

  // ---------- commandes ----------
  function bindInput() {
    window.addEventListener("keydown", (e) => {
      if (document.body.dataset.screen !== "game") return; const t = e.target && e.target.tagName; if (t === "INPUT" || t === "TEXTAREA" || t === "SELECT") return; const k = e.key.toLowerCase();
      if (["arrowup", "arrowdown", "arrowleft", "arrowright", " ", "z", "q", "s", "d", "w", "a", "shift", "g", "h", "r", "f"].includes(k)) e.preventDefault();
      G.keys[k] = true; SND.unlock(); if (k === "escape") { if ($("#vg-pause").classList.contains("show")) closePause(); else openPause(); }
      if (k === "t" && !e.repeat) resetToFlag(); if (k === "c") { G.cam.yaw = Math.atan2(G.P.fx, G.P.fz) + Math.PI; }
    });
    window.addEventListener("keyup", (e) => { G.keys[e.key.toLowerCase()] = false; }); window.addEventListener("blur", () => { G.keys = {}; G.jump = false; });
    // souris, verrouillage du pointeur
    document.addEventListener("mousemove", (e) => { if (document.body.dataset.screen !== "game") return; if (document.pointerLockElement === canvas) rot(e.movementX, e.movementY); else if (G.drag) { rot(e.movementX, e.movementY); } });
    canvas.addEventListener("mousedown", (e) => { SND.unlock(); if (G.phase === "play" && !isTouch && !$("#vg-pause").classList.contains("show")) { try { canvas.requestPointerLock(); } catch (x) { /* rien */ } } G.drag = true; });
    window.addEventListener("mouseup", () => { G.drag = false; });
    // tactile
    const joy = $("#vg-joy"), act = $("#vg-act"), b2 = $("#vg-b2"); let jid = null; const jc = { x: 0, y: 0 };
    const moveJoy = (e) => { let dx = (e.clientX - jc.x) / 55, dy = (e.clientY - jc.y) / 55; const l = Math.hypot(dx, dy); if (l > 1) { dx /= l; dy /= l; } G.joy.x = dx; G.joy.z = dy; G.joy.on = l > 0.12; joy.firstElementChild.style.transform = `translate(${dx * 45}px,${dy * 45}px)`; };
    joy.addEventListener("pointerdown", (e) => { jid = e.pointerId; joy.setPointerCapture(jid); const r = joy.getBoundingClientRect(); jc.x = r.left + r.width / 2; jc.y = r.top + r.height / 2; moveJoy(e); SND.unlock(); });
    joy.addEventListener("pointermove", (e) => { if (e.pointerId === jid) moveJoy(e); }); const endJoy = (e) => { if (e.pointerId !== jid) return; jid = null; G.joy.x = G.joy.z = 0; G.joy.on = false; joy.firstElementChild.style.transform = ""; }; joy.addEventListener("pointerup", endJoy); joy.addEventListener("pointercancel", endJoy);
    act.addEventListener("pointerdown", (e) => { G.jump = true; act.classList.add("on"); act.setPointerCapture(e.pointerId); SND.unlock(); }); const endAct = () => { G.jump = false; act.classList.remove("on"); }; act.addEventListener("pointerup", endAct); act.addEventListener("pointercancel", endAct);
    b2.addEventListener("pointerdown", () => { G.drop = true; setTimeout(() => { G.drop = false; }, 250); });
    let cid = null, cx = 0, cy = 0; canvas.addEventListener("pointerdown", (e) => { if (e.pointerType === "touch" && e.clientX > innerWidth * 0.35) { cid = e.pointerId; cx = e.clientX; cy = e.clientY; } });
    canvas.addEventListener("pointermove", (e) => { if (e.pointerId === cid) { rot((e.clientX - cx) * 1.6, (e.clientY - cy) * 1.6); cx = e.clientX; cy = e.clientY; } }); const endC = (e) => { if (e.pointerId === cid) cid = null; }; canvas.addEventListener("pointerup", endC); canvas.addEventListener("pointercancel", endC);
  }
  function rot(dx, dy) { const k = 0.0024 * G.sens; G.cam.yaw -= dx * k; G.cam.pitch = clamp(G.cam.pitch + dy * k * (G.inv ? -1 : 1), -0.15, 1.25); }
  function resetToFlag() { if (!G.msg || G.phase !== "play" || G.msg.mode === "classique" || G.fin) return; Kit.socket.emit("v:reset"); }
  function readInput() {
    const k = G.keys; let a = 0, b = 0; if (k["arrowleft"] || k["q"] || k["a"]) a -= 1; if (k["arrowright"] || k["d"]) a += 1; if (k["arrowup"] || k["z"] || k["w"]) b += 1; if (k["arrowdown"] || k["s"]) b -= 1;
    if (G.joy.on) { a = G.joy.x; b = -G.joy.z; } const l = Math.hypot(a, b); if (l > 1) { a /= l; b /= l; }
    const yaw = G.cam.yaw; const fx = -Math.sin(yaw), fz = -Math.cos(yaw), rx = -fz, rz = fx;
    return { mx: fx * b + rx * a, mz: fz * b + rz * a, jump: !!(k[" "] || k["space"] || G.jump), drop: !!(k["shift"] || G.drop) };
  }

  // ---------- boucle ----------
  const serverNow = () => (G.clockOff == null ? 0 : performance.now() - G.clockOff);
  function loop() { requestAnimationFrame(loop); if (document.hidden) { G.last = performance.now(); return; } PicuiteGL.frame(frame); }
  function interp(i, srvMs) {
    const a = G.snaps; if (!a.length) return null; let s0 = null, s1 = null; for (let k = a.length - 1; k >= 0; k--) { if (a[k].now <= srvMs) { s0 = a[k]; s1 = a[k + 1] || null; break; } } if (!s0) { s0 = a[0]; s1 = null; }
    const p0 = s0.p[i]; if (!p0) return null; const p1 = s1 && s1.p[i]; let k = 0; if (p1 && s1.now > s0.now) k = clamp((srvMs - s0.now) / (s1.now - s0.now), 0, 1); const L = (x, y) => x + (y - x) * k;
    let ry = p0[3]; if (p1) { let d = p1[3] - p0[3]; while (d > Math.PI) d -= TAU; while (d < -Math.PI) d += TAU; ry = p0[3] + d * k; }
    return { x: p1 ? L(p0[0], p1[0]) : p0[0], y: p1 ? L(p0[1], p1[1]) : p0[1], z: p1 ? L(p0[2], p1[2]) : p0[2], ry, a: p0[4], vh: p0[5], fin: p0[6] };
  }
  function frame() {
    const now = performance.now(); const dt = Math.min(0.1, (now - G.last) / 1000); G.last = now; if (!G.C || !G.view || document.body.dataset.screen !== "game") return;
    G.frame++; G.fps.push(dt); if (G.fps.length > 90) { const avg = G.fps.reduce((a, b) => a + b, 0) / G.fps.length; G.fps = []; adapt(avg); }
    const P = G.P, W = G.W; const playing = G.phase === "play" && !$("#vg-pause").classList.contains("show"); const ev = [];
    if (G.phase === "play") { const ls = G.snaps[G.snaps.length - 1]; G.tPlay = ls && ls.t != null ? ls.t + (now - ls.arr) / 1000 : (now - G.playAt) / 1000; }
    { const k = G.keys, c = G.cam, sp = 1.9 * G.sens; if (k["g"]) c.yaw += sp * dt; if (k["h"]) c.yaw -= sp * dt; if (k["r"]) c.pitch = clamp(c.pitch + sp * 0.7 * dt * (G.inv ? -1 : 1), -0.15, 1.25); if (k["f"]) c.pitch = clamp(c.pitch - sp * 0.7 * dt * (G.inv ? -1 : 1), -0.15, 1.25); ["g", "h", "r", "f"].forEach((x) => { const e = document.getElementById("ck-" + x); if (e) e.classList.toggle("on", !!k[x]); }); }
    // simulation locale à pas fixe
    if (G.phase === "play") {
      G.acc += dt; let n = 0; const inp = G.auto ? G.auto() : readInput(); if (G.lock > 0) { G.lock -= dt; inp.mx = inp.mz = 0; inp.jump = false; } if (!playing) { inp.mx = inp.mz = 0; inp.jump = false; }
      while (G.acc >= S.DT && n < 5) { G.acc -= S.DT; n++; W.t = G.tPlay - G.acc; if (W.t < 0) W.t = 0; S.prepare(W); S.stepPlayer(W, P, inp, ev); }
      if (G.acc > 0.2) G.acc = 0;
    } else { G.acc = 0; W.t = G.tPlay; S.prepare(W); }
    handleEvents(ev, dt);
    // envoi de l'état
    if (G.phase === "play" && now - G.lastSend > 50) { G.lastSend = now; Kit.socket.emit("v:st", { x: +P.x.toFixed(3), y: +P.y.toFixed(3), z: +P.z.toFixed(3), ry: +Math.atan2(P.fx, P.fz).toFixed(3), a: animCode(P), s: P.st === "ground" ? 0 : P.st === "air" ? 1 : P.st === "hang" ? 2 : 3, on: P.st === "ground" ? P.on : -1, vh: +Math.hypot(P.vx, P.vz).toFixed(2), vy: +P.vy.toFixed(2) }); }
    // sécurité si le serveur ne répond pas à une chute
    if (G.phase === "play" && P.y < G.good.y - 90) { P.x = G.good.x; P.y = G.good.y + 0.1; P.z = G.good.z; P.vx = P.vy = P.vz = 0; P.st = "ground"; P.on = -1; }
    if (P.st === "ground" && P.on >= 0) { const b = G.C.boxes[P.on]; if (b && b.k !== "crumble" && b.k !== "spring") { G.good = { x: P.x, y: P.y, z: P.z }; } if (G.C.cps.includes(P.on) && !G.cpSeen[P.on] && G.phase === "play") { G.cpSeen[P.on] = true; G.view.flagDone(P.on); SND.checkpoint(); FX.checkpoint(P.x, P.y, P.z); if (G.msg.mode !== "classique") showFall("Drapeau atteint"); } }
    // acteurs
    const srvMs = serverNow() - 110; const me = G.idx[G.mine];
    G.msg.players.forEach((p, i) => {
      const a = G.actors[p.id]; if (!a) return;
      if (i === me) { const s = { x: P.x, y: P.y, z: P.z, ry: Math.atan2(P.fx, P.fz), a: G.fin ? 6 : animCode(P), vh: Math.hypot(P.vx, P.vz), tag: false, ring: false }; a.show(s, dt); return; }
      let s = G.phase === "play" || G.phase === "over" ? interp(i, srvMs) : null; if (!s) { const sl = slot(G.C, i); s = { x: sl.x, y: 0, z: sl.z, ry: G.C.start.ry, a: 0, vh: 0 }; }
      if (s.fin) s.a = 6; a.show(s, dt);
    });
    // effets du personnage local
    if (G.phase === "play") { if (P.st === "ground" && Math.hypot(P.vx, P.vz) > 3.5 && P.on >= 0) { G.stepT -= dt; if (G.stepT <= 0) { G.stepT = 0.3; SND.step(); } if (G.frame % 6 === 0) FX.dust(P.x, P.y, P.z, P.vx * 0.1, P.vz * 0.1, 1); } const co = G.cos[G.mine]; if (co && co.trail && Math.hypot(P.vx, P.vz) > 1.5) FX.trail(co.trail, P.x, P.y, P.z, P.vx, P.vz); if (P.vy < -14 && G.frame % 2 === 0) FX.wind(P.x, P.y, P.z, P.vy); }
    // monde
    const PF = G.dbgFocus ? { x: G.dbgFocus.x, y: G.dbgFocus.y, z: G.dbgFocus.z, vx: 0, vy: 0, vz: 0, st: "ground", fx: 0, fz: 1 } : P;
    G.view.update(W.t, W.cr, dt, { x: PF.x, y: PF.y, z: PF.z }, R.cam.position); G.view.setAltitude(PF.y, dt); FX.update(dt);
    updateMarker(P); updateHud(P, dt); camera(dt, PF); R.renderer.render(R.scene, R.cam); PicuiteGL.verify(R.renderer);
    // vent
    if (G.frame % 10 === 0 && G.phase === "play") SND.wind(clamp(P.y / (G.C.summitTop || 100) * 0.5 + Math.max(0, -P.vy) / 45, 0, 1));
  }
  function animCode(P) { if (P.st === "hang") return 4; if (P.st === "climb") return 5; if (P.st === "air") return P.vy > 0.5 ? 2 : 3; return Math.hypot(P.vx, P.vz) > 0.9 ? 1 : 0; }
  function handleEvents(ev, dt) {
    const P = G.P; for (const e of ev) {
      if (e.e === "jump") { SND.jump(); FX.dust(e.x, e.y, e.z, 0, 0, 4); }
      else if (e.e === "land") { SND.land(e.v); FX.land(e.x, e.y, e.z, e.v); if (e.v > 18) shake(0.3); }
      else if (e.e === "grab") { SND.grab(); FX.grab(e.x, e.y, e.z); }
      else if (e.e === "mantle") { SND.mantle(); FX.dust(e.x, e.y, e.z, 0, 0, 5); }
      else if (e.e === "spring") { SND.spring(); FX.spring(e.x, e.y, e.z); G.view.squash(e.i); shake(0.2); }
      else if (e.e === "crumble") { SND.crumble(); const b = G.C.boxes[e.i]; if (b) FX.crumble((b.x0 + b.x1) / 2, b.y1, (b.z0 + b.z1) / 2); }
      else if (e.e === "sweep") { if (performance.now() - (G.sweepAt || 0) > 400) { SND.sweep(); G.sweepAt = performance.now(); } }
    }
  }
  function shake(p) { G.cam.shake = Math.min(1, G.cam.shake + p); }
  function adapt(avg) { const fps = 1 / avg; if (G.phase !== "play") return; if (fps < 38 && G.pr > 0.65) { G.pr = Math.max(0.65, G.pr - 0.15); resize(); } else if (fps > 56 && G.pr < 1) { G.pr = Math.min(1, G.pr + 0.1); resize(); } }

  // ---------- marqueur d'atterrissage ----------
  function updateMarker(P) {
    const m = G.marker; if (!m) return; if (G.phase !== "play" || P.st === "ground" || P.st === "hang" || P.st === "climb") { m.visible = false; return; }
    let best = null; const R0 = 0.35; for (const b of G.W.boxes) { if (b.k === "crumble" && G.W.cr[b.i] && G.W.t > G.W.cr[b.i].t0 + b.cr.delay) continue; if (P.x + R0 > b.X0 && P.x - R0 < b.X1 && P.z + R0 > b.Z0 && P.z - R0 < b.Z1 && b.Y1 <= P.y + 0.3) { if (!best || b.Y1 > best.Y1) best = b; } }
    if (!best) { m.visible = false; return; } m.visible = true; m.position.set(P.x, best.Y1 + 0.04, P.z); const h = P.y - best.Y1; const s = 1 + clamp(h / 8, 0, 1.2); m.scale.set(s, 1, s); m.children[0].material.opacity = clamp(1.1 - h / 30, 0.35, 0.95);
  }

  // ---------- caméra ----------
  function rayBoxes(ox, oy, oz, dx, dy, dz, maxT) {
    let tmin = maxT; for (const b of G.W.boxes) { if (b.k === "crumble" && G.W.cr[b.i] && G.W.t > G.W.cr[b.i].t0 + b.cr.delay) continue; let t0 = 0, t1 = tmin; const ax = [[ox, dx, b.X0, b.X1], [oy, dy, b.Y0, b.Y1], [oz, dz, b.Z0, b.Z1]]; let ok = true; for (const [o, d, lo, hi] of ax) { if (Math.abs(d) < 1e-8) { if (o < lo || o > hi) { ok = false; break; } } else { let a = (lo - o) / d, c = (hi - o) / d; if (a > c) { const tt = a; a = c; c = tt; } t0 = Math.max(t0, a); t1 = Math.min(t1, c); if (t0 > t1) { ok = false; break; } } } if (ok && t0 < tmin && t0 > 0) tmin = t0; }
    return tmin;
  }
  function camera(dt, P) {
    const c = G.cam, cam = R.cam; const asp = cam.aspect;
    if (G.dbgCam) { cam.position.set(G.dbgCam.p[0], G.dbgCam.p[1], G.dbgCam.p[2]); cam.lookAt(G.dbgCam.l[0], G.dbgCam.l[1], G.dbgCam.l[2]); return; }
    if (G.phase === "count") { // plongée d'introduction du sommet vers le départ
      const k = clamp(1 - (G.countAt - performance.now()) / 4000, 0, 1), e = k * k * (3 - 2 * k); const top = G.C.summitTop; const sb = G.C.boxes[G.C.startBox]; const cx = (sb.x0 + sb.x1) / 2, cz = (sb.z0 + sb.z1) / 2;
      const a0 = { x: 40, y: top * 0.9, z: 40, ly: top * 0.55 }, a1 = { x: cx - Math.sin(c.yaw) * 7, y: 4.8, z: cz - Math.cos(c.yaw) * 7, ly: 1.4 };
      cam.position.set(a0.x + (a1.x - a0.x) * e, a0.y + (a1.y - a0.y) * e, a0.z + (a1.z - a0.z) * e); cam.lookAt(cx * e, a0.ly + (a1.ly - a0.ly) * e, cz * e); G.cam.init = false; return;
    }
    const tx = P.x + P.vx * 0.1, tz = P.z + P.vz * 0.1, ty = P.y + 1.35;
    if (!c.init) { c.fx = tx; c.fy = ty; c.fz = tz; c.init = true; c.dist = 7; }
    c.fx += (tx - c.fx) * Math.min(1, dt * 12); c.fz += (tz - c.fz) * Math.min(1, dt * 12);
    const rate = P.st === "ground" || P.st === "hang" || P.st === "climb" ? 7 : P.vy < -10 ? 10 : 3.5; c.fy += (ty - c.fy) * Math.min(1, dt * rate); if (c.fy > ty + 2) c.fy = ty + 2; if (c.fy < ty - 3.2) c.fy = ty - 3.2;
    const sp = Math.hypot(P.vx, P.vz); const want = 6.6 + clamp(sp * 0.09, 0, 0.7) + (P.vy < -8 ? clamp(-P.vy * 0.08, 0, 3) : 0) + (P.st === "hang" ? 1.2 : 0) + (asp < 0.8 ? 2 : 0);
    const cp = Math.cos(c.pitch), sp2 = Math.sin(c.pitch); const dx = Math.sin(c.yaw) * cp, dy = sp2, dz = Math.cos(c.yaw) * cp;
    const th = rayBoxes(c.fx, c.fy, c.fz, dx, dy, dz, want + 0.4); let d = th < want + 0.4 ? Math.max(1.0, th - 0.45) : want;
    if (d < c.dist) c.dist = c.dist + (d - c.dist) * Math.min(1, dt * 18); else c.dist += (d - c.dist) * Math.min(1, dt * 2.5);
    c.shake *= Math.max(0, 1 - dt * 7); const sh = c.shake * 0.18;
    cam.position.set(c.fx + dx * c.dist + (Math.random() - 0.5) * sh, c.fy + dy * c.dist + (Math.random() - 0.5) * sh, c.fz + dz * c.dist + (Math.random() - 0.5) * sh); cam.lookAt(c.fx, c.fy + 0.1, c.fz);
    // sous le sol, on remonte un peu
    if (cam.position.y < c.fy - c.dist * 0.95) cam.position.y = c.fy - c.dist * 0.95;
  }

  // ---------- interface pendant la course ----------
  function updateHud(P, dt) {
    const now = performance.now(); if (now - G.hudAt < 100) return; G.hudAt = now; const C = G.C; const top = C.summitTop;
    const rk = G.rank; const pen = G.pen || 0; const tl = $("#vg-timer"); if (tl) { const el0 = G.phase === "play" ? G.tPlay : (G.over ? G.over.t : 0); tl.textContent = fmtS(el0 + (G.msg.mode === "chrono" ? pen : 0)) + (G.msg.mode === "chrono" && pen ? " (plus " + pen + " s)" : "") + (rk && rk.left != null && G.phase === "play" ? "  reste " + fmtS(rk.left) : ""); }
    $("#vg-h").textContent = Math.max(0, Math.round(P.y)) + " m"; const zi = Cr.zoneAt(C, P.y); $("#vg-z").textContent = C.zones[zi].name + "  sur  " + Math.round(top) + " m";
    if (rk) { renderBoard(); rk.rows.forEach((r) => { const pin = $("#pin-" + r.id); if (pin) pin.style.bottom = clamp((r.id === G.mine ? Math.max(P.y, r.h) : r.h) / top * 100, 0, 100) + "%"; }); if (rk.closing && G.phase === "play") { const l = $("#vg-timer"); } }
    const pr = $("#vg-prompt"); const on = P.st === "hang"; pr.classList.toggle("on", on); if (on) pr.textContent = isTouch ? "Saute pour te hisser" : "Espace ou avance pour te hisser, Maj pour lâcher";
    if (G.phase === "count") { const n = Math.ceil((G.countAt - now) / 1000); if (n !== G.countN && n > 0 && n <= 3) { G.countN = n; SND.beep(n === 1 ? 1 : 0); banner(String(n), "", 0); } else if (n > 3) { banner(G.C.zones.length + " mondes, " + Math.round(top) + " mètres", "Atteins le sommet avant les autres", 0); } }
  }

  // ---------- fin de course ----------
  function tableRows(rows, mode) {
    return `<table class="vg-tab"><tr><th>#</th><th>Joueur</th><th class="n">Hauteur</th><th class="n">Temps</th><th class="n">Chutes</th></tr>` + rows.map((r) => `<tr class="${r.id === G.mine ? "me" : ""} ${r.place === 1 ? "win" : ""}"><td>${r.place}</td><td><span class="dot" style="background:${colorOf(r.id)}"></span>${esc(nameOf(r.id))}</td><td class="n">${Math.round(r.h)} m</td><td class="n">${r.fin != null ? esc(fmtT(r.fin)) : "pas fini"}</td><td class="n">${r.falls}</td></tr>`).join("") + "</table>";
  }
  function showOver(d) {
    if (!G.msg) return; const ov = $("#vg-over"); const first = d.rows[0]; const head = first && first.fin != null ? nameOf(first.id) + " remporte la course" : "Course terminée";
    let board = ""; if (d.board && d.board.length) board = `<h3 style="margin:14px 0 4px;text-align:center">Meilleurs temps du jour</h3><table class="vg-tab">` + d.board.slice(0, 5).map((b, i) => `<tr><td>${i + 1}</td><td>${esc(b.name)}</td><td class="n">${esc(fmtT(b.t))}</td></tr>`).join("") + "</table>";
    ov.innerHTML = `<div class="vg-card"><h2>${esc(head)}</h2><div class="sm">${esc(Rules.MODES[d.mode] || "")}${d.mode === "jour" ? " du " + esc(d.day) : ", graine " + esc(d.seed)} sur ${Math.round(d.summit)} mètres en ${esc(fmtS(d.t))}</div>` + tableRows(d.rows, d.mode) + board +
      `<div class="vg-btnrow">${Kit.isHost() ? '<button class="vg-b" id="vg-again">Revanche</button>' : '<span class="sm">En attente de l\'hôte pour la revanche</span>'}<button class="vg-b g" id="vg-quit">Quitter</button></div></div>`;
    ov.classList.add("show"); if (document.pointerLockElement) document.exitPointerLock(); const a = $("#vg-again"); if (a) a.onclick = () => Kit.backToLobby(); $("#vg-quit").onclick = () => Kit.leave();
    const me = d.rows.find((r) => r.id === G.mine); if (me && me.fin != null) { SND.win(); FX.confetti(G.P.x, G.P.y + 1, G.P.z, 60); } else SND.click();
  }
  function openPause() {
    const ov = $("#vg-pause"); if (document.pointerLockElement) document.exitPointerLock();
    ov.innerHTML = `<div class="vg-card"><h2>Menu</h2><div class="vg-set">
      <label>Volume<input type="range" id="vg-vol" min="0" max="100" value="${Math.round(SND.vol * 100)}"></label>
      <label>Sensibilité de la caméra<input type="range" id="vg-sens" min="40" max="220" value="${Math.round(G.sens * 100)}"></label>
      <label>Inverser le haut et le bas<input type="checkbox" id="vg-inv" ${G.inv ? "checked" : ""}></label>
      <label>Qualité de l'image<select id="vg-q"><option value="low">Légère</option><option value="medium">Équilibrée</option><option value="high">Belle</option></select></label></div>
      <div class="vg-btnrow"><button class="vg-b" id="vg-resume">Reprendre</button><button class="vg-b g" id="vg-leave">Quitter la partie</button></div></div>`;
    ov.classList.add("show"); $("#vg-q").value = G.quality; $("#vg-vol").oninput = (e) => SND.setVol(e.target.value / 100); $("#vg-sens").oninput = (e) => { G.sens = e.target.value / 100; store.set("vg.sens", String(G.sens)); }; $("#vg-inv").onchange = (e) => { G.inv = e.target.checked; store.set("vg.inv", G.inv ? "1" : "0"); }; $("#vg-q").onchange = (e) => setQuality(e.target.value);
    $("#vg-resume").onclick = closePause; $("#vg-leave").onclick = () => Kit.confirm("Quitter la partie en cours ?", () => { closePause(); Kit.leave(); });
  }
  function closePause() { $("#vg-pause").classList.remove("show"); }

  // ---------- personnalisation dans le salon ----------
  let prev = null, prevNode = null;
  function setCos(k, d) { const c = myCos(); const n = { char: CH.FILES.length, hat: CH.HATS.length, trail: CH.TRAILS.length }[k]; c[k] = (c[k] + d + n) % n; store.set("vg.cos", JSON.stringify(c)); sendCos(); refreshPreview(); drawPickers(); }
  function drawPickers() { if (!prevNode) return; const c = myCos(); [["char", CH.NAMES], ["hat", CH.HATS], ["trail", CH.TRAILS]].forEach(([k, arr]) => { const e = prevNode.querySelector("[data-k=" + k + "] b"); if (e) e.textContent = arr[c[k]]; }); }
  function makePreview() {
    if (prevNode) return; prevNode = el("div", { class: "vg-custom" }); const cv = el("canvas", { width: 300, height: 380 }); prevNode.appendChild(cv);
    const box = el("div"); [["char", "Personnage"], ["hat", "Accessoire"], ["trail", "Effet"]].forEach(([k, l]) => box.appendChild(el("div", { class: "vg-pick", "data-k": k }, [el("span", { class: "l", text: l }), el("button", { text: "‹", title: "Précédent", onclick: () => setCos(k, -1) }), el("b"), el("button", { text: "›", title: "Suivant", onclick: () => setCos(k, 1) })])));
    box.appendChild(el("p", { class: "muted small", text: "Les accessoires et les effets ne changent rien au jeu, ils servent à te reconnaître." })); prevNode.appendChild(box); drawPickers();
    try { const r = new T.WebGLRenderer({ canvas: cv, antialias: true, alpha: true }); r.setClearColor(0x000000, 0); const sc = new T.Scene(); const cam = new T.PerspectiveCamera(30, 300 / 380, 0.1, 50); cam.position.set(0, 1.5, 5.4); cam.lookAt(0, 1.0, 0); sc.add(new T.HemisphereLight(0xffffff, 0x8899bb, 1.1)); const dl = new T.DirectionalLight(0xffffff, 0.9); dl.position.set(3, 6, 5); sc.add(dl); prev = { r, sc, cam, actor: null, key: "" }; } catch (e) { prev = null; }
    const tick = () => { requestAnimationFrame(tick); if (!prev || document.body.dataset.screen !== "lobby" || !prevNode.isConnected) return; if (prev.actor) prev.actor.show({ x: 0, y: 0, z: 0, ry: -0.4 + Math.sin(performance.now() / 1500) * 0.25, a: 0, vh: 0, tag: false, ring: false }, 0.016); prev.r.render(prev.sc, prev.cam); }; tick();
  }
  function refreshPreview() {
    if (!prev) return; const c = myCos(); const me = Kit.me(); const col = me ? COLORS[me.color % 8].hex : "#e8453c"; const key = [c.char, c.hat, col].join("|"); if (key === prev.key) return; prev.key = key;
    if (prev.actor) { prev.actor.dispose(); prev.actor = null; } CH.load(() => { if (prev.key !== key) return; prev.actor = new CH.Actor(prev.sc, { name: "", color: col, char: c.char, hat: c.hat, me: true }); });
  }
  function renderPreview(box, room) { makePreview(); if (prevNode.parentNode !== box) box.appendChild(prevNode); refreshPreview(); drawPickers(); }

  function onInit() {
    if (window.VgProps3D) VgProps3D.load();
    if (/[?&]debug/.test(location.search)) window.VgDebug = { G, S, get R() { return R; } };
    buildGame(); attach(); Kit.on("connect", () => { attach(); sendCos(); }); Kit.on("room", () => { if (Kit.room && Kit.room.status === "lobby") sendCos(); });
    Kit.on("screen", (n) => { if (n === "game") { setTimeout(() => { if (initRender()) resize(); }, 30); } if (n !== "game") { SND.stopAmb(); if (document.pointerLockElement) document.exitPointerLock(); } });
    Kit.on("reset", () => leaveGame()); document.addEventListener("pointerdown", () => SND.unlock(), { once: true });
  }
  Kit.init({
    id: "vertigogo", title: "Vertigogo", emoji: "🏔️", ribbon: "Grimpe, saute, ne regarde pas en bas", tagline: "Une tour d'objets géants à escalader, seul ou entre amis.",
    createLabel: "Créer un salon", soloLabel: "Jouer contre des bots", startLabel: "Lancer la course", helpTitle: "Comment jouer",
    floaters: [{ e: "🏔️", x: 6 }, { e: "☁️", x: 20 }, { e: "🚕", x: 34 }, { e: "🍄", x: 48 }, { e: "🛋️", x: 62 }, { e: "🎃", x: 76 }, { e: "🌳", x: 90 }],
    colors: COLORS, botLevels: LEVELS, maxPlayers: 8, minPlayers: 2, schema: Rules.SCHEMA,
    help: [
      { title: "Le but", text: "Arriver au sommet d'une tour faite de plusieurs mondes empilés. Personne ne peut te pousser, seuls la gravité et les pièges te gênent. Le classement se fait à l'arrivée, et en direct pendant la montée selon la hauteur atteinte." },
      { title: "Se déplacer et sauter", text: "ZQSD, WASD ou les flèches pour avancer, la souris pour tourner la caméra, ou les touches G et H pour tourner à gauche et à droite, R et F pour monter et descendre la caméra. Espace pour sauter, et plus tu restes appuyé, plus tu sautes haut. Un appui court donne un petit saut." },
      { title: "S'accrocher et grimper", text: "Quand tu sautes vers un rebord un peu plus haut que toi, ton personnage s'y accroche. Avance ou appuie sur Espace pour te hisser dessus, ou appuie sur Maj pour lâcher. Tu peux aussi glisser sur le côté en restant accroché." },
      { title: "Les objets géants", text: "Tu grimpes sur des objets du quotidien devenus immenses, arbres, voitures, canapés, casseroles, citrouilles ou nuages. Chaque objet a sa propre forme, un arbre a un tronc très fin et des branches plus larges, une voiture a un toit et un capot. Il faut viser la bonne partie avant de sauter." },
      { title: "Les pièges", text: "Les plateformes mobiles vont et viennent, les dalles qui s'effritent tombent un instant après ton passage puis reviennent, les plots rouges, les trampolines, les lits et les champignons rouges te propulsent, les tapis roulants t'entraînent, la glace fait glisser et les barres rayées te balayent sans te blesser." },
      { title: "Les chutes", text: "En mode Classique tu retombes vraiment, et seul un filet au début de chaque zone te rattrape. Dans les autres modes, tu reprends au dernier drapeau atteint. Touche T pour y retourner à la main." },
      { title: "Les modes", text: "Classique, Points de passage, Contre la montre où chaque chute ajoute 5 secondes, et Parcours du jour, le même pour tout le monde aujourd'hui. Tous les parcours sont générés à partir d'une graine et vérifiés pour être faisables." },
      { title: "Le chat et les bots", text: "Tu peux jouer seul contre des bots de quatre niveaux. Dans le salon, choisis ton personnage, ton accessoire et ton effet. Ça ne change rien au jeu." },
    ],
    theme: { a1: "#3fb6ff", a2: "#bfe8ff", bg1: "#1d4f9a", bg2: "#0b1a3d" }, renderPreview, onInit,
  });
})();

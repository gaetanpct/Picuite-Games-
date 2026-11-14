// ============================================================
// PAGAILLE PARTY — Interface de jeu (client)
// Reçoit l'état du serveur, affiche la scène 3D (ou la vue à plat), envoie les touches et les choix.
// ============================================================
(function () {
  const { el, $, toast, sound, store } = Kit;
  const Cat = PgCatalog, PR = PgRules, RD = PgRender, P3 = window.Pg3D || { supported: false }, PD = window.PgPred || { on: false, reset() {}, setScene() {}, frame() {} };
  const COLORS = [
    { name: "Rouge", hex: "#ef4b4b" }, { name: "Bleu", hex: "#3b82f6" }, { name: "Vert", hex: "#34c36c" }, { name: "Jaune", hex: "#f5c518" },
    { name: "Violet", hex: "#9b5de5" }, { name: "Orange", hex: "#ff8a1f" }, { name: "Rose", hex: "#ff6fb5" }, { name: "Turquoise", hex: "#1fc8c0" },
  ];
  const G = { cam: { f: 0, h: 0, t: 0, g: 0 }, st: null, deadline: 0, fr: null, priv: null, scene: null, keys: { l: 0, r: 0, u: 0, d: 0, a: 0, b: 0, c: 0 }, sent: "", canvas: null, ctx: null, last: 0, phaseKey: "", scale: 1, ox: 0, oy: 0, lastFrameAt: 0, uiKey: "", sceneKey: -1, cdLast: 0, goShown: 0 };
  const play = (n) => { try { window.PgSound && PgSound.play(n); } catch (e) { /* rien */ } };
  const myId = () => { const p = Kit.me(); return p ? p.id : null; };
  const hexOf = (k) => COLORS[(k || 0) % COLORS.length].hex;
  const pref = () => store.get("pg.view", "auto");           // auto, low, flat
  const want3d = () => P3.supported && !P3.failed && pref() !== "flat" && G.st && G.st.view !== "2d";
  const fmtDur = (s) => { const m = Math.floor(s / 60), r = Math.round(s % 60); return m ? m + " min" + (r ? " " + r : "") : r + " s"; };

  // ---------- squelette de l'écran de jeu ----------
  function buildGame() {
    const sc = $("#screen-game"); sc.innerHTML = "";
    const wrap = el("div", { id: "pg-wrap" }, [
      el("div", { id: "pg-top" }, [
        el("div", { id: "pg-round", class: "pg-pill" }), el("div", { id: "pg-mod", class: "pg-pill pg-pill--mod hidden" }),
        el("div", { id: "pg-score", class: "pg-score" }),
        el("div", { class: "pg-tools" }, [
          el("button", { id: "pg-snd", class: "pg-tool", title: "Son", onclick: () => { sound.toggle(); updateTools(); play("tick"); } }),
          el("button", { id: "pg-vw", class: "pg-tool", title: "Affichage", onclick: cycleView }),
        ]),
      ]),
      el("div", { id: "pg-stage" }, [
        el("div", { id: "pg-board" }, [
          el("canvas", { id: "pg-canvas" }),
          el("div", { id: "pg-hud" }, [
            el("div", { id: "pg-title", class: "pg-pill" }), el("div", { id: "pg-timer", class: "pg-timer" }), el("div", { id: "pg-chips", class: "pg-chips" }),
            el("div", { id: "pg-target", class: "pg-target hidden" }), el("div", { id: "pg-big", class: "pg-big hidden" }), el("div", { id: "pg-msgs", class: "pg-msgs" }), el("div", { id: "pg-cd", class: "pg-cd hidden" }),
            el("div", { id: "pg-dead", class: "pg-dead hidden" }), el("div", { id: "pg-prog", class: "pg-prog hidden" }), el("div", { id: "pg-banner", class: "pg-banner hidden" }),
            el("div", { id: "pg-bars", class: "pg-bars" }), el("div", { id: "pg-flash", class: "pg-flash" }),
            el("div", { id: "pg-racehint", class: "pg-racehint hidden", text: "Espace saute deux fois, Maj ou E plonge, C agrippe, F et H tournent la caméra, T et G la montent ou la baissent" }),
          ]),
          el("div", { id: "pg-pad", class: "pg-pad hidden" }),
        ]),
        el("div", { id: "pg-side", class: "pg-side hidden" }, [el("div", { id: "pg-role", class: "pg-role hidden" }), el("div", { id: "pg-ui", class: "pg-ui hidden" })]),
        el("div", { id: "pg-overlay", class: "pg-overlay hidden" }),
      ]),
    ]);
    sc.appendChild(wrap);
    G.canvas = $("#pg-canvas"); G.ctx = G.canvas.getContext("2d");
    if (window.ResizeObserver) new ResizeObserver(() => resize()).observe($("#pg-board"));
    $("#pg-hud").addEventListener("pointerdown", onCanvasClick); G.canvas.addEventListener("pointerdown", onCanvasClick);
    buildPad(); updateTools(); resize();
  }
  function updateTools() {
    $("#pg-snd").textContent = sound.enabled ? "🔊" : "🔇";
    const v = pref(); $("#pg-vw").textContent = v === "flat" ? "2D" : v === "low" ? "3D léger" : "3D"; $("#pg-vw").title = "Affichage, appuie pour changer";
  }
  function cycleView() {
    const order = ["auto", "low", "flat"]; const v = order[(order.indexOf(pref()) + 1) % 3]; store.set("pg.view", v);
    if (P3.ready) P3.setQuality(v === "low" ? "low" : "high"); updateTools(); applyView(true); toast(v === "auto" ? "Affichage 3D complet" : v === "low" ? "Affichage 3D allégé, pour les ordinateurs lents" : "Vue à plat", "ok");
  }
  function buildPad() {
    const pad = $("#pg-pad"); pad.innerHTML = "";
    const mk = (txt, key, cls) => {
      const b = el("button", { class: "pg-padbtn " + (cls || ""), text: txt }); const on = (e) => { e.preventDefault(); setKey(key, 1); }; const off = (e) => { e.preventDefault(); setKey(key, 0); };
      b.addEventListener("touchstart", on, { passive: false }); b.addEventListener("touchend", off); b.addEventListener("touchcancel", off); b.addEventListener("mousedown", on); b.addEventListener("mouseup", off); b.addEventListener("mouseleave", off); return b;
    };
    pad.appendChild(el("div", { class: "pg-dpad" }, [mk("▲", "u", "up"), mk("◀", "l", "left"), mk("▶", "r", "right"), mk("▼", "d", "down")]));
    pad.appendChild(el("div", { class: "pg-abtns" }, [mk("B", "b", "pb"), mk("A", "a", "pa")]));
    // touches propres à la course, agripper et tourner la caméra
    const camBtn = (txt, key) => { const b = el("button", { class: "pg-padbtn pg-padbtn--cam", text: txt }); const on = (e) => { e.preventDefault(); G.cam[key] = 1; }; const off = (e) => { e.preventDefault(); G.cam[key] = 0; }; b.addEventListener("touchstart", on, { passive: false }); b.addEventListener("touchend", off); b.addEventListener("mousedown", on); b.addEventListener("mouseup", off); b.addEventListener("mouseleave", off); return b; };
    pad.appendChild(el("div", { class: "pg-racebtns" }, [camBtn("⟲", "f"), mk("✊", "c", "pg"), camBtn("⟳", "h")]));
    if (window.matchMedia && window.matchMedia("(pointer: coarse)").matches) pad.classList.remove("hidden");
  }
  function resize() {
    const c = G.canvas; if (!c) return; const st = $("#pg-board"); const dpr = Math.min(2, window.devicePixelRatio || 1);
    const w = st.clientWidth, h = st.clientHeight; c.width = Math.max(10, w * dpr); c.height = Math.max(10, h * dpr); c.style.width = w + "px"; c.style.height = h + "px"; G.dpr = dpr; G.cw = w; G.ch = h;
    if (P3.ready) P3.resize();
  }
  window.addEventListener("resize", () => { if (G.canvas) resize(); });
  // choisit entre la 3D et la vue à plat selon le jeu et les préférences
  function applyView(force) {
    const use3d = want3d(); let ok = use3d;
    if (use3d && !P3.ready) ok = P3.init($("#pg-board"));
    if (use3d && P3.ready && ok) { P3.setQuality(pref() === "low" ? "low" : "high"); }
    G.use3d = !!(use3d && ok && P3.ready);
    if (P3.ready) P3.show(G.use3d); G.canvas.style.display = G.use3d ? "none" : "block";
    if (G.use3d && G.scene && (force || G.sceneApplied !== G.scene.key)) { P3.setScene(G.scene.scene); G.sceneApplied = G.scene.key; }
    $("#pg-board").classList.toggle("pg-board--3d", G.use3d);
  }

  // ---------- touches ----------
  const KEYMAP = { ArrowLeft: "l", ArrowRight: "r", ArrowUp: "u", ArrowDown: "d", q: "l", a: "l", d: "r", z: "u", w: "u", s: "d", " ": "a", Enter: "a", x: "a", X: "a", Shift: "b", e: "b", c: "b", C: "b", Q: "l", A: "l", D: "r", Z: "u", W: "u", S: "d", E: "b" };
  function setKey(k, v) { if (G.keys[k] === v) return; G.keys[k] = v; sendKeys(); }
  function sendKeys() { const k = Object.assign({}, G.keys); if (isRace() && G.mv) { k.mx = Math.round(G.mv[0] * 100) / 100; k.my = Math.round(G.mv[1] * 100) / 100; } const s = JSON.stringify(k); if (s === G.sent) return; G.sent = s; if (Kit.socket) Kit.socket.emit("pg:in", k); }
  const inGame = () => document.body.dataset.screen === "game" && G.st && G.st.phase === "play";
  // pendant la Course des fous, F et H tournent la caméra, T et G la montent ou la baissent, C agrippe
  const isRace = () => !!(G.st && G.st.game && G.st.game.id === "parcours" && PD.on);
  const CAMK = { f: "f", F: "f", h: "h", H: "h", t: "t", T: "t", g: "g", G: "g" };
  window.addEventListener("keydown", (e) => {
    if (document.body.dataset.screen !== "game") return; const tag = (e.target && e.target.tagName) || ""; if (tag === "INPUT" || tag === "TEXTAREA" || e.ctrlKey || e.metaKey || e.altKey) return;
    if (isRace()) { if (CAMK[e.key]) { G.cam[CAMK[e.key]] = 1; e.preventDefault(); return; } if (e.key === "c" || e.key === "C") { G.keys.c = 1; e.preventDefault(); return; } }
    const k = KEYMAP[e.key]; if (!k) return; e.preventDefault(); setKey(k, 1);
  });
  window.addEventListener("keyup", (e) => { if (CAMK[e.key]) G.cam[CAMK[e.key]] = 0; if (e.key === "c" || e.key === "C") G.keys.c = 0; const k = KEYMAP[e.key]; if (!k) return; setKey(k, 0); });
  window.addEventListener("blur", () => { ["l", "r", "u", "d", "a", "b", "c"].forEach((k) => { G.keys[k] = 0; }); Object.keys(G.cam).forEach((k) => { G.cam[k] = 0; }); sendKeys(); });
  setInterval(() => { if (inGame()) { G.sent = ""; sendKeys(); } }, 700);
  function onCanvasClick(e) {
    if (!inGame() || (e.target && e.target.closest && e.target.closest(".pg-padbtn"))) return; let x, y; const pz = G.fr && G.fr.hud && G.fr.hud.pickZ || 0;
    if (G.use3d) { const w = P3.pick(e.clientX, e.clientY, pz); if (!w) return; x = w.x; y = w.y; }
    else { const r = G.canvas.getBoundingClientRect(); x = (e.clientX - r.left - G.ox) / G.scale; y = (e.clientY - r.top - G.oy) / G.scale + pz * 0.55; }
    Kit.socket.emit("pg:act", { type: "click", x, y });
  }
  function act(id) { play("vote"); Kit.socket.emit("pg:act", { type: "btn", id }); }

  // ---------- messages réseau ----------
  function onState(st) {
    const prev = G.st; G.st = st; G.deadline = Date.now() + st.left;
    const key = st.phase + ":" + st.round + ":" + (st.game ? st.game.id : "");
    if (key !== G.phaseKey) {
      G.phaseKey = key; G.priv = null; G.uiKey = ""; G.cdLast = 0; G.goShown = 0;
      if (st.phase !== "play" && st.phase !== "result") { G.fr = null; RD.reset(); if (st.phase === "intro" || st.phase === "vote") { G.scene = null; G.sceneApplied = -1; if (P3.ready) P3.clear(); } }
      if (st.phase === "play") { ["l", "r", "u", "d", "a", "b", "c"].forEach((k) => { G.keys[k] = 0; }); G.sent = ""; }
      if (st.phase !== "play" && st.phase !== "result") { PD.reset(); if (P3.ready) P3.camLive = null; }
      if (st.phase === "vote") play("reveal"); if (st.phase === "intro") play("vote");
      if (st.phase === "over") { play("win"); confettiBurst(); }
      if (st.phase === "result") { const mine = st.result && st.result.rows.find((r) => r.id === myId()); play(mine && mine.rank === 1 ? "win" : mine && mine.rank <= Math.ceil(st.members.length / 2) ? "reveal" : "lose"); }
      applyView(false);
    }
    const sig = JSON.stringify(Object.assign({}, st, { left: 0 })); if (sig === G.sig) return; G.sig = sig;
    renderTop(); renderOverlay();
  }
  function onScene(m) { G.scene = m; G.sceneApplied = -1; if (m && m.scene && m.scene.pred && window.PgPred) PD.setScene(m.scene, { jumpAssist: !(Kit.room && Kit.room.settings && Kit.room.settings.jumpAssist === false) }); else PD.reset(); applyView(true); if (!G.use3d) { /* la vue à plat lit G.scene à chaque image */ } }
  function onFrame(m) {
    G.fr = m.f; G.priv = m.p; G.lastFrameAt = performance.now();
    if (PD.on) { PD.frame(m.f, m.p, myId(), performance.now()); PD.patch(m.f.items, myId()); }
    if (G.use3d) { P3.feed(m.f, m.p, myId()); P3.setPriv(m.p); } else if (m.f.fx) playFlat(m.f.fx);
    renderHud(); renderPriv();
  }
  let flatSeen = 0;
  function playFlat(list) { list.forEach((f) => { if (f.id > flatSeen) { flatSeen = f.id; if (f.k === "snd" && f.n) play(f.n); } }); }

  // ---------- haut de l'écran ----------
  function renderTop() {
    const st = G.st; if (!st) return;
    $("#pg-round").textContent = st.phase === "over" ? "Partie terminée" : "Manche " + st.round + " sur " + st.total + (st.mode === "chaos" ? " • chaos" : "");
    const md = $("#pg-mod"); if (st.mod && (st.phase === "intro" || st.phase === "play" || st.phase === "result")) { md.classList.remove("hidden"); md.textContent = "🌪️ " + st.mod.label; } else md.classList.add("hidden");
    const sc = $("#pg-score"); sc.innerHTML = "";
    st.standings.forEach((r) => sc.appendChild(el("div", { class: "pg-chip" + (r.id === myId() ? " pg-chip--me" : "") + (r.online ? "" : " pg-chip--off"), style: { "--c": hexOf(r.color) } }, [el("i"), el("b", { text: (r.bot ? "🤖 " : "") + r.name }), el("span", { text: String(r.pts) })])));
    updateTools();
  }

  // ---------- HUD de manche ----------
  function renderHud() {
    const f = G.fr; if (!f) return; const h = f.hud || {};
    $("#pg-title").textContent = h.title || ""; $("#pg-title").classList.toggle("hidden", !h.title);
    const tm = $("#pg-timer"); if (h.timer != null && !h.end) { tm.textContent = fmtT(h.timer); tm.classList.remove("hidden"); tm.classList.toggle("pg-timer--low", h.timer < 4); } else tm.classList.add("hidden");
    const ch = $("#pg-chips"); const ck = JSON.stringify(h.chips || []); if (ck !== G.chipKey) { G.chipKey = ck; ch.innerHTML = ""; (h.chips || []).forEach((c) => ch.appendChild(el("span", { class: "pg-pill pg-pill--small", text: c.text }))); }
    const tg = $("#pg-target"); if (h.target) { tg.classList.remove("hidden"); tg.style.background = h.target.c; tg.textContent = h.target.s; } else tg.classList.add("hidden");
    const bg = $("#pg-big"); if (h.big) { bg.classList.remove("hidden"); bg.textContent = h.big; } else bg.classList.add("hidden");
    const ms = $("#pg-msgs"); const mk = (h.msgs || []).join("|"); if (mk !== G.msgKey) { G.msgKey = mk; ms.innerHTML = ""; (h.msgs || []).slice(-3).forEach((t) => ms.appendChild(el("div", { class: "pg-msg", text: t }))); }
    const cd = $("#pg-cd");
    if (h.cd) { cd.classList.remove("hidden"); cd.classList.remove("pg-cd--go"); if (cd.textContent !== String(h.cd)) { cd.textContent = String(h.cd); cd.style.animation = "none"; void cd.offsetWidth; cd.style.animation = ""; } if (G.cdLast !== h.cd) { G.cdLast = h.cd; play("count"); } }
    else if (h.go) { cd.classList.remove("hidden"); cd.classList.add("pg-cd--go"); if (cd.textContent !== "GO") { cd.textContent = "GO"; cd.style.animation = "none"; void cd.offsetWidth; cd.style.animation = ""; if (!G.goShown) { G.goShown = 1; play("go"); } } }
    else cd.classList.add("hidden");
    const bn = $("#pg-banner"); if (h.end && h.banner) { bn.classList.remove("hidden"); if (bn.textContent !== h.banner) { bn.textContent = h.banner; confettiBurst(true); } } else bn.classList.add("hidden");
    renderProg(h.prog);
    const rh = $("#pg-racehint"); if (rh) { const show = isRace() && !h.end; rh.classList.toggle("hidden", !show); if (show && !G.hintAt) G.hintAt = performance.now(); rh.classList.toggle("pg-racehint--fade", show && performance.now() - G.hintAt > 12000); }
    const pad = $("#pg-pad"); if (pad) pad.classList.toggle("pg-pad--race", isRace());
  }
  const fmtT = (t) => { t = Math.max(0, Math.ceil(t)); return t >= 60 ? Math.floor(t / 60) + " min " + (t % 60 < 10 ? "0" : "") + (t % 60) : String(t); };
  function renderProg(pr) {
    const box = $("#pg-prog"); if (!pr) { box.classList.add("hidden"); return; } box.classList.remove("hidden");
    if (box.dataset.n !== String(pr.length)) { box.dataset.n = String(pr.length); box.innerHTML = ""; box.appendChild(el("div", { class: "pg-prog__track" })); box.appendChild(el("span", { class: "pg-prog__end", text: "🏁" })); pr.forEach((p) => box.appendChild(el("i", { class: "pg-prog__dot", "data-id": p.id, style: { "--c": hexOf(p.k) }, title: p.n }))); }
    pr.forEach((p) => { const d = box.querySelector('[data-id="' + p.id + '"]'); if (d) { d.style.left = (4 + Math.max(0, Math.min(1, p.p)) * 88) + "%"; d.classList.toggle("pg-prog__dot--me", p.id === myId()); d.classList.toggle("pg-prog__dot--out", !!p.out); } });
  }
  function renderPriv() {
    const p = G.priv; const role = $("#pg-role"), dead = $("#pg-dead"), ui = $("#pg-ui");
    if (p && p.role) {
      role.classList.remove("hidden"); role.style.setProperty("--rc", p.role.c);
      const cdTxt = p.cd > 0 ? " • recharge " + Math.ceil(p.cd) + " s" : (p.cd === 0 && p.role.name === "Meurtrier" ? " • prêt à frapper" : "");
      role.innerHTML = ""; role.appendChild(el("b", { text: p.role.name + cdTxt })); role.appendChild(el("span", { text: p.role.tip }));
      if (p.log && p.log.length) p.log.forEach((l) => role.appendChild(el("em", { text: l }))); if (p.why) role.appendChild(el("em", { text: p.why }));
    } else role.classList.add("hidden");
    renderBars(p && p.bars);
    dead.classList.toggle("hidden", !(p && p.dead && G.st && G.st.phase === "play")); dead.textContent = (p && p.deadText) || "Tu es éliminé, regarde la suite";
    if (p && p.err) toastOnce(p.err);
    const key = p && p.ui ? JSON.stringify(p.ui) : "";
    if (key !== G.uiKey) {
      G.uiKey = key; ui.innerHTML = "";
      if (p && p.ui) {
        ui.classList.remove("hidden");
        if (p.ui.title) ui.appendChild(el("div", { class: "pg-uititle", text: p.ui.title }));
        (p.ui.groups || []).forEach((g) => { const row = el("div", { class: "pg-uigroup" }, [el("div", { class: "pg-uilabel", text: g.label })]); const bs = el("div", { class: "pg-uibtns" }); g.btns.forEach((b) => bs.appendChild(el("button", { class: "pg-btn" + (b.sel ? " pg-btn--sel" : ""), disabled: !!b.dis, text: b.t, onclick: () => act(b.id) }))); row.appendChild(bs); ui.appendChild(row); });
        if (p.ui.lock) ui.appendChild(el("button", { class: "pg-btn pg-btn--go", disabled: !!p.ui.lock.dis, text: p.ui.lock.t, onclick: () => act(p.ui.lock.id) }));
      } else ui.classList.add("hidden");
    }
    $("#pg-side").classList.toggle("hidden", ui.classList.contains("hidden") && role.classList.contains("hidden"));
  }
  function renderBars(bars) {
    const box = $("#pg-bars"); const key = bars ? bars.length : 0; if (box.dataset.n !== String(key)) { box.dataset.n = String(key); box.innerHTML = ""; (bars || []).forEach((b) => box.appendChild(el("div", { class: "pg-bar2" }, [el("span", { text: b.label }), el("div", {}, [el("i")])]))); }
    (bars || []).forEach((b, i) => { const row = box.children[i]; if (!row) return; const f = row.querySelector("i"); f.style.width = Math.max(0, Math.min(100, b.pct)) + "%"; f.style.background = b.c || "#4dabf7"; });
  }
  let lastToast = "", lastToastAt = 0;
  function toastOnce(t) { if (t === lastToast && Date.now() - lastToastAt < 3000) return; lastToast = t; lastToastAt = Date.now(); toast(t, "error"); }

  // ---------- dessin ----------
  let lastReport = 0;
  function frameLoop(now) {
    requestAnimationFrame(frameLoop);
    if (document.body.dataset.screen !== "game") return; const dt = Math.min(0.1, (now - (G.last || now)) / 1000); G.last = now;
    if (!G.st) return;
    if (PD.on && G.fr) raceStep(dt);
    if (G.use3d && P3.ready) { if (G.st.phase === "play" || G.st.phase === "result" || G.st.phase === "intro") P3.render(dt); return; }
    const ctx = G.ctx; if (!ctx) return; const dpr = G.dpr || 1; ctx.setTransform(1, 0, 0, 1, 0, 0); ctx.clearRect(0, 0, G.canvas.width, G.canvas.height);
    const f = G.fr; if (!f || (G.st.phase !== "play" && G.st.phase !== "result")) return;
    const sc = G.scene && G.scene.scene || {}; const w = f.w || sc.w || 900, h = f.h || sc.h || 600;
    const sw = G.cw, sh = G.ch; let s = Math.min(sw / w, sh / h); G.scale = s; G.ox = (sw - w * s) / 2; G.oy = (sh - h * s) / 2;
    if (sc.cam) {
      // scènes décrites pour la 3D, centrées sur l'origine. On cadre la boîte englobante, ou on suit son pion si le monde est très allongé.
      const cc = sc.cam.c || [0, 0]; let cx = cc[0], cy = cc[1]; const bw = w + 40, bh = h + 40;
      if (sc.cam.m === "follow" || bw / bh > 2.4 || bh / bw > 2.4) { const me = (f.items || []).find((it) => it.t === "pawn" && it.id === myId()); s = Math.min(sw, sh) / (Math.min(bw, bh) * 0.9); if (me) { cx = me.x; cy = me.y; } } else s = Math.min(sw / bw, sh / bh);
      G.scale = s; G.ox = sw / 2 - cx * s; G.oy = sh / 2 - cy * s;
    }
    ctx.setTransform(dpr * s, 0, 0, dpr * s, dpr * G.ox, dpr * G.oy);
    ctx.fillStyle = f.bg || sc.bg || (sc.env && sc.env.ground && sc.env.ground.c) || "#223"; if (sc.cam) ctx.fillRect(-G.ox / G.scale, -G.oy / G.scale, sw / G.scale, sh / G.scale); else ctx.fillRect(0, 0, w, h);
    ctx.save(); if (!sc.cam) { ctx.beginPath(); ctx.rect(0, 0, w, h); ctx.clip(); }
    const kill = new Set(f.kill || []); RD.draw(ctx, { w, h, items: f.items, sceneItems: (sc.items || []).filter((x) => x.id == null || !kill.has(x.id)), privItems: G.priv && G.priv.items || [] }, dt, now / 1000, myId());
    ctx.restore();
  }

  // ---------- course des fous, notre coureur avance tout de suite ----------
  const angLerp = (a, b, k) => { let d = b - a; while (d > Math.PI) d -= Math.PI * 2; while (d < -Math.PI) d += Math.PI * 2; return a + d * k; };
  const RSND = { jump: "jump", dbl: "jump", dive: "whoosh", land: "land", stun: "squeak", flop: "squeak", void: "scream", bump: "bump" };
  function raceStep(dt) {
    const h = (G.fr && G.fr.hud) || {}; const pc = G.priv && G.priv.cam; const now = performance.now();
    // caméra de dos qui suit les virages, F et H la tournent, T et G changent sa hauteur
    PD.yawOff = Math.max(-2.6, Math.min(2.6, (PD.yawOff || 0) + ((G.cam.h ? 1 : 0) - (G.cam.f ? 1 : 0)) * dt * 1.9));
    if (!G.cam.f && !G.cam.h && Math.abs(PD.yawOff) > 0.001 && G.keys.u) PD.yawOff *= Math.exp(-dt * 0.8);
    PD.hgOff = Math.max(-110, Math.min(240, (PD.hgOff || 0) + ((G.cam.t ? 1 : 0) - (G.cam.g ? 1 : 0)) * dt * 220));
    const target = (pc && pc.yaw != null ? pc.yaw : -Math.PI / 2) + PD.yawOff;
    if (!PD.yawInit || PD.snapped) { PD.yaw = target; PD.yawInit = true; PD.snapped = false; } else PD.yaw = angLerp(PD.yaw, target, 1 - Math.exp(-dt * 2.4));
    const f = [Math.cos(PD.yaw), Math.sin(PD.yaw)], r = [-Math.sin(PD.yaw), Math.cos(PD.yaw)]; const k = G.keys;
    let mx = f[0] * ((k.u ? 1 : 0) - (k.d ? 1 : 0)) + r[0] * ((k.r ? 1 : 0) - (k.l ? 1 : 0)), my = f[1] * ((k.u ? 1 : 0) - (k.d ? 1 : 0)) + r[1] * ((k.r ? 1 : 0) - (k.l ? 1 : 0));
    const l = Math.hypot(mx, my); if (l > 1) { mx /= l; my /= l; } if (G.st.mod && G.st.mod.id === "inv") { mx = -mx; my = -my; }
    G.mv = [mx, my]; if (!G.mvSentAt || now - G.mvSentAt > 120) { G.mvSentAt = now; sendKeys(); }
    const frozen = G.st.phase !== "play" || !!h.cd || !!h.end;
    PD.step(dt, { mx, my, a: k.a, b: k.b, gr: k.c, frozen }, now, (pk) => { if (Kit.socket) Kit.socket.emit("pg:pos", pk); });
    PD.events().forEach((e) => { if (RSND[e]) play(RSND[e]); });
    PD.patch(G.fr.items, myId());
    const p = PD.pos(); const tall = window.innerWidth < window.innerHeight; if (P3.ready) P3.camLive = p && !PD.dead ? { m: "follow", t: [p.x, p.y, Math.max(p.z, -60)], yaw: PD.yaw, d: tall ? 520 : 340, hg: (tall ? 320 : 220) + PD.hgOff, la: tall ? 170 : 130 } : null;
    const hint = $("#pg-racehint"); if (hint) hint.classList.toggle("hidden", !!h.end);
  }

  // ---------- confettis ----------
  function confettiBurst(small) {
    const layer = $("#pg-board"); if (!layer) return; const n = small ? 26 : 70; const cols = ["#ff4d6d", "#ffd23b", "#4cd964", "#4dabf7", "#b388ff", "#ff9f43"];
    for (let i = 0; i < n; i++) { const c = el("i", { class: "pg-conf", style: { left: Math.random() * 100 + "%", background: cols[i % cols.length], animationDelay: Math.random() * 0.6 + "s", animationDuration: 2.2 + Math.random() * 1.6 + "s", transform: "rotate(" + Math.random() * 360 + "deg)" } }); layer.appendChild(c); setTimeout(() => c.remove(), 4600); }
  }

  // ---------- écrans par phase ----------
  function clockBar(st) {
    const bar = el("div", { class: "pg-bar" }, [el("i")]); const total = st.span || st.left || 1;
    const tick = () => { if (!G.st || !bar.isConnected) return; const left = Math.max(0, G.deadline - Date.now()); bar.firstChild.style.width = Math.max(0, Math.min(100, (left / total) * 100)) + "%"; if (left > 0) requestAnimationFrame(tick); };
    requestAnimationFrame(tick); return bar;
  }
  const avatar = (m, ex) => el("span", { class: "pg-av" + (ex ? " " + ex : ""), style: { "--c": hexOf(m.color) }, title: m.name, text: m.bot ? "🤖" : "" });
  function ready3(st) {
    const row = el("div", { class: "pg-avs" });
    (st.memberInfo || []).forEach((m) => row.appendChild(el("span", { class: "pg-avwrap" }, [avatar(m, st.ready.includes(m.id) || m.bot ? "pg-av--ok" : ""), el("small", { text: m.name })])));
    return row;
  }
  function renderOverlay() {
    const st = G.st, ov = $("#pg-overlay"); if (!st) return;
    if (st.phase === "play") { ov.classList.add("hidden"); setPad(true); return; }
    setPad(false); $("#pg-ui").classList.add("hidden"); $("#pg-side").classList.add("hidden"); ov.classList.remove("hidden");
    if (st.phase === "board") { boardOverlay(st, ov); return; }
    G.bd = null; const okey = st.phase + ":" + st.round; const again = G.ovKey === okey; G.ovKey = okey;
    ov.className = "pg-overlay pg-overlay--" + st.phase + (again ? " pg-still" : ""); ov.innerHTML = "";
    const me = myId();
    if (st.phase === "vote") {
      const box = el("div", { class: "pg-card pg-card--wide pg-card--vote" }, [el("div", { class: "pg-kicker", text: "Manche " + st.round + " sur " + st.total }), el("h2", { text: "Quel mini-jeu ensuite ?" }), el("p", { class: "pg-sub", text: "Vote pour ton préféré. La plus grosse pile gagne, le sort départage les égalités." })]);
      const row = el("div", { class: "pg-votes" });
      st.vote.options.forEach((o, i) => row.appendChild(el("button", { class: "pg-vote" + (st.vote.mine === o.id ? " pg-vote--mine" : ""), style: { "--th": o.theme || "#ffd23b", "animation-delay": i * 0.08 + "s" }, onclick: () => { play("vote"); Kit.socket.emit("pg:vote", { id: o.id }); } }, [
        el("span", { class: "pg-vote__icon", text: o.icon }), el("b", { text: o.name }),
        el("span", { class: "pg-tags" }, [el("span", { class: "pg-tag pg-tag--kind", text: o.kind })].concat((o.skills || []).map((s) => el("span", { class: "pg-tag", text: s })))),
        el("span", { class: "pg-vote__rule", text: o.rules[0] }), el("span", { class: "pg-vote__meta", text: o.min + (o.max > o.min ? " à " + o.max : "") + " joueurs, environ " + fmtDur(o.secs) }),
        el("span", { class: "pg-vote__count", text: st.vote.counts[o.id] + " vote" + (st.vote.counts[o.id] > 1 ? "s" : "") })])));
      box.appendChild(row); box.appendChild(el("p", { class: "pg-wait", text: st.vote.voted.length + " vote" + (st.vote.voted.length > 1 ? "s" : "") + " sur " + st.members.length })); box.appendChild(clockBar(st)); ov.appendChild(box);
    } else if (st.phase === "intro") {
      const g = st.game; const box = el("div", { class: "pg-card pg-card--wide pg-card--intro", style: { "--th": g.theme || "#ffd23b" } }, [
        el("div", { class: "pg-intro__head" }, [el("span", { class: "pg-intro__icon", text: g.icon }), el("div", {}, [el("div", { class: "pg-kicker", text: "Manche " + st.round + " sur " + st.total }), el("h2", { text: g.name }), el("div", { class: "pg-tags" }, [el("span", { class: "pg-tag pg-tag--kind", text: g.kind })].concat((g.skills || []).map((s) => el("span", { class: "pg-tag", text: s }))))])]),
      ]);
      if (st.mod) box.appendChild(el("div", { class: "pg-mod" }, [el("b", { text: "🌪️ Surprise du chaos, " + st.mod.label }), el("span", { text: st.mod.desc })]));
      const cols = el("div", { class: "pg-intro__cols" });
      const rules = el("div", {}, [el("h3", { text: "Les règles" }), el("ol", { class: "pg-steps" }, g.rules.map((r) => el("li", {}, [el("span", { text: r })])))]);
      const keys = el("div", {}, [el("h3", { text: "Les commandes" }), el("ul", { class: "pg-rules" }, g.controls.map((r) => el("li", { text: r })))]);
      if (g.move) keys.appendChild(el("div", { class: "pg-keys" }, [el("span", { class: "pg-key", text: "←" }), el("span", { class: "pg-key", text: "↑" }), el("span", { class: "pg-key", text: "↓" }), el("span", { class: "pg-key", text: "→" }), el("span", { class: "pg-key pg-key--wide", text: "Espace" }), el("span", { class: "pg-key pg-key--wide", text: "Maj" })]));
      cols.appendChild(rules); cols.appendChild(keys); box.appendChild(cols);
      box.appendChild(el("p", { class: "pg-score-line", text: g.scoring }));
      box.appendChild(ready3(st));
      const ready = st.ready.includes(me);
      box.appendChild(el("button", { class: "btn btn--big " + (ready ? "btn--ghost" : "btn--green"), disabled: ready, text: ready ? "Prêt, on attend les autres" : "Je suis prêt", onclick: () => { play("vote"); Kit.socket.emit("pg:ready"); } }));
      box.appendChild(clockBar(st)); ov.appendChild(box);
    } else if (st.phase === "result") {
      const r = st.result; const box = el("div", { class: "pg-card pg-card--result" }, [el("div", { class: "pg-kicker", text: r.icon + " " + r.game }), r.headline ? el("h2", { text: r.headline }) : el("h2", { text: "Résultats de la manche" }), r.mult > 1 ? el("p", { class: "pg-mod pg-mod--x", text: "Points multipliés par " + r.mult }) : null]);
      const tb = el("div", { class: "pg-rank" }); const medals = ["🥇", "🥈", "🥉"];
      r.rows.forEach((x, i) => tb.appendChild(el("div", { class: "pg-rank__row" + (x.id === me ? " pg-rank__row--me" : ""), style: { "--c": hexOf(x.color), "animation-delay": i * 0.09 + "s" } }, [el("span", { class: "pg-rank__n", text: x.rank <= 3 && !x.tie ? medals[x.rank - 1] : (x.tie ? "=" : "") + x.rank }), el("i"), el("b", { text: (x.bot ? "🤖 " : "") + x.name }), el("span", { class: "pg-rank__note", text: x.note }), el("span", { class: "pg-rank__pts", text: "+" + x.pts })])));
      box.appendChild(tb); box.appendChild(el("h3", { text: "Classement général" }));
      const gen = el("div", { class: "pg-rank pg-rank--small" }); const maxP = Math.max(1, ...st.standings.map((x) => x.pts));
      st.standings.forEach((x) => gen.appendChild(el("div", { class: "pg-rank__row" + (x.id === me ? " pg-rank__row--me" : ""), style: { "--c": hexOf(x.color) } }, [el("span", { class: "pg-rank__n", text: String(x.rank) }), el("i"), el("b", { text: x.name }), el("span", { class: "pg-rank__bar" }, [el("span", { style: { width: (x.pts / maxP) * 100 + "%" } })]), el("span", { class: "pg-rank__pts pg-rank__pts--gen", text: String(x.pts) })])));
      box.appendChild(gen); if (st.rate) box.appendChild(rateRow(st.rate)); box.appendChild(el("p", { class: "pg-wait", text: st.round >= st.total ? "Résultats finaux dans un instant" : Kit.room && Kit.room.settings && Kit.room.settings.board === false ? "Manche suivante dans un instant" : "Le plateau surprise arrive" })); box.appendChild(clockBar(st)); ov.appendChild(box);
    } else if (st.phase === "over") {
      const top = st.standings; const box = el("div", { class: "pg-card pg-card--wide pg-card--over" }, [el("div", { class: "pg-kicker", text: "Fin de la partie" }), el("h2", { text: top[0] ? "🏆 " + top[0].name + " remporte la partie" : "Fin de la partie" })]);
      if (st.reason) box.appendChild(el("p", { class: "pg-sub", text: st.reason }));
      const pod = el("div", { class: "pg-podium" }); const order = [1, 0, 2];
      order.forEach((i) => { const x = top[i]; if (!x) return; pod.appendChild(el("div", { class: "pg-pod pg-pod--" + (i + 1), style: { "--c": hexOf(x.color), "animation-delay": (2 - i) * 0.3 + "s" } }, [el("span", { class: "pg-pod__medal", text: ["🥇", "🥈", "🥉"][i] }), el("span", { class: "pg-av pg-av--big", style: { "--c": hexOf(x.color) }, text: x.bot ? "🤖" : "" }), el("b", { text: x.name }), el("span", { class: "pg-pod__pts", text: x.pts + " pts" })])); });
      box.appendChild(pod);
      if ((st.awards || []).length) box.appendChild(el("div", { class: "pg-awards" }, st.awards.map((a) => el("div", { class: "pg-award", style: { "--c": hexOf(a.color) } }, [el("span", { text: a.icon }), el("div", {}, [el("b", { text: a.title }), el("small", { text: a.name + ", " + a.text })])]))));
      const gen = el("div", { class: "pg-rank pg-rank--small" }); top.forEach((x) => gen.appendChild(el("div", { class: "pg-rank__row" + (x.id === me ? " pg-rank__row--me" : ""), style: { "--c": hexOf(x.color) } }, [el("span", { class: "pg-rank__n", text: String(x.rank) }), el("i"), el("b", { text: (x.bot ? "🤖 " : "") + x.name }), el("span", { class: "pg-rank__note", text: x.wins + " manche" + (x.wins > 1 ? "s" : "") + " gagnée" + (x.wins > 1 ? "s" : "") }), el("span", { class: "pg-rank__pts pg-rank__pts--gen", text: String(x.pts) })])));
      box.appendChild(gen);
      if ((st.notes || []).length) {
        const nb = el("div", { class: "pg-notes" }, [el("h3", { text: "Les mini-jeux de la soirée, du moins aimé au plus aimé" })]);
        st.notes.forEach((x) => nb.appendChild(el("div", { class: "pg-notes__row" }, [el("span", { text: x.icon + " " + x.name }), el("b", { text: "👍 " + x.up + "  👎 " + x.down })])));
        nb.appendChild(el("small", { class: "muted", text: "Ces avis s'additionnent d'une partie à l'autre, et repartent de zéro quand le serveur s'endort ou est redéployé. Ils aident à repérer les jeux à retravailler ou à décocher dans les réglages." })); box.appendChild(nb);
      }
      const row = el("div", { class: "pg-actions" });
      if (Kit.isHost()) row.appendChild(el("button", { class: "btn btn--accent btn--big", text: "Retour au salon", onclick: () => Kit.backToLobby() })); else row.appendChild(el("p", { class: "muted", text: "L'hôte peut relancer une partie depuis le salon." }));
      row.appendChild(el("button", { class: "btn btn--ghost", text: "Quitter", onclick: () => Kit.leave() })); box.appendChild(row); ov.appendChild(box);
    }
  }
  // ---------- avis sur le mini-jeu ----------
  function rateRow(r) {
    const b = (v, ico, n) => el("button", { class: "pg-rate__b" + (r.mine === v ? " pg-rate__b--on" : ""), onclick: () => { play("vote"); Kit.socket.emit("pg:rate", { v: r.mine === v ? 0 : v }); } }, [el("span", { text: ico }), el("small", { text: String(n) })]);
    return el("div", { class: "pg-rate" }, [el("span", { text: r.mine ? "Merci pour ton avis" : "Ce mini-jeu t'a plu ?" }), b(1, "👍", r.up), b(-1, "👎", r.down)]);
  }

  // ---------- plateau surprise entre les manches ----------
  // seize cases sur le bord d'une grille de six sur quatre, dans le sens des aiguilles d'une montre
  function cellOf(i) { i = ((i % 16) + 16) % 16; if (i < 6) return [i, 0]; if (i < 8) return [5, i - 5]; if (i < 14) return [13 - i, 3]; return [0, 17 - i]; }
  function boardOverlay(st, ov) {
    const bd = st.board, me = myId();
    if (!G.bd || G.bd.round !== bd.round || !ov.querySelector(".pg-bd")) {
      if (G.bd && G.bd.timers) G.bd.timers.forEach(clearTimeout);
      ov.className = "pg-overlay pg-overlay--board"; ov.innerHTML = "";
      const info = {}; (st.standings || []).forEach((x) => { info[x.id] = x; });
      const B = G.bd = { round: bd.round, timers: [], pos: Object.assign({}, bd.from), score: Object.assign({}, bd.pre), info, pawns: {}, done: false };
      const card = el("div", { class: "pg-card pg-card--wide pg-card--board" }, [el("div", { class: "pg-kicker", text: "Plateau surprise, après la manche " + bd.round }), el("h2", { text: "On avance selon son rang" })]);
      const grid = el("div", { class: "pg-bd" }); B.grid = grid;
      bd.sq.forEach((q, i) => { const [c, r] = cellOf(i); grid.appendChild(el("div", { class: "pg-bd__sq pg-bd__sq--" + q.k, style: { "grid-column": c + 1, "grid-row": r + 1 }, title: q.name, "data-i": String(i) }, [el("span", { text: q.icon || "·" })])); });
      const mid = el("div", { class: "pg-bd__mid" }, [el("b", { text: "Tout le monde avance" }), el("span", { text: "Premier de la manche, quatre cases. Dernier, une case." })]); B.mid = mid; grid.appendChild(mid);
      bd.ids.forEach((id) => { const x = info[id] || { color: 0, name: "?" }; const pw = el("div", { class: "pg-bd__pawn" + (id === me ? " pg-bd__pawn--me" : ""), style: { background: hexOf(x.color) }, title: x.name }, [el("small", { text: x.name.slice(0, 2) })]); grid.appendChild(pw); B.pawns[id] = pw; });
      card.appendChild(grid);
      const side = el("div", { class: "pg-bd__side" });
      const rk = el("div", { class: "pg-rank pg-rank--small" }); B.rk = rk; side.appendChild(rk);
      side.appendChild(el("div", { class: "pg-bd__legend" }, bd.legend.map((l) => el("div", {}, [el("span", { text: l.icon }), el("small", {}, [el("b", { text: l.name + " " }), document.createTextNode(l.desc)])]))));
      card.appendChild(side);
      const foot = el("div", { class: "pg-bd__foot" }); B.foot = foot; card.appendChild(foot);
      ov.appendChild(card); layoutPawns(); drawRank();
      // les sauts de case, tous en même temps
      const maxS = Math.max(1, ...bd.ids.map((id) => bd.steps[id] || 1)); const t0 = 700;
      for (let k = 1; k <= maxS; k++) B.timers.push(setTimeout(() => { bd.ids.forEach((id) => { if ((bd.steps[id] || 0) >= k) B.pos[id] = bd.from[id] + k; }); layoutPawns(); play("tick"); }, t0 + k * bd.hop));
      let t = t0 + maxS * bd.hop + 500;
      if (!bd.events.length) B.timers.push(setTimeout(() => { setMid("Que des cases tranquilles", "Personne ne bouge au classement cette fois."); }, t));
      bd.events.forEach((e) => {
        B.timers.push(setTimeout(() => {
          B.pos[e.id] = e.at; layoutPawns(); grid.querySelectorAll(".pg-bd__sq--hot").forEach((n) => n.classList.remove("pg-bd__sq--hot"));
          const sq = grid.querySelector('[data-i="' + e.sq + '"]'); if (sq) sq.classList.add("pg-bd__sq--hot");
          setMid((bd.sq[e.sq].icon || "") + " " + e.title, e.text, e.type);
          Object.keys(e.d || {}).forEach((id) => { B.score[id] = (B.score[id] || 0) + e.d[id]; });
          drawRank(e.d); play(e.type === "banane" || e.type === "foudre" ? "lose" : e.type === "echange" ? "reveal" : "coin");
        }, t)); t += bd.ev;
      });
      B.timers.push(setTimeout(() => { B.done = true; grid.querySelectorAll(".pg-bd__sq--hot").forEach((n) => n.classList.remove("pg-bd__sq--hot")); bd.ids.forEach((id) => { B.pos[id] = bd.to[id]; }); layoutPawns(); setMid("Classement mis à jour", st.round >= st.total ? "Place aux résultats" : "Prochaine manche juste après"); drawFoot(G.st); }, t + 200));
    }
    drawFoot(st);
  }
  function setMid(title, text, type) { const B = G.bd; if (!B) return; B.mid.className = "pg-bd__mid pg-bd__mid--pop" + (type ? " pg-bd__mid--" + type : ""); B.mid.innerHTML = ""; B.mid.appendChild(el("b", { text: title })); B.mid.appendChild(el("span", { text: text })); void B.mid.offsetWidth; }
  function layoutPawns() {
    const B = G.bd; if (!B) return; const by = {};
    Object.keys(B.pawns).forEach((id) => { const i = ((B.pos[id] % 16) + 16) % 16; (by[i] = by[i] || []).push(id); });
    Object.keys(by).forEach((i) => { const list = by[i]; const [c, r] = cellOf(+i); list.forEach((id, k) => { const a = (k / Math.max(1, list.length)) * Math.PI * 2, rr = list.length > 1 ? 1.1 : 0; const pw = B.pawns[id]; pw.style.left = "calc(" + ((c + 0.5) / 6) * 100 + "% + " + Math.cos(a) * rr + "rem)"; pw.style.top = "calc(" + ((r + 0.7) / 4) * 100 + "% + " + Math.sin(a) * rr * 0.5 + "rem)"; pw.style.zIndex = 3 + k; }); });
  }
  function drawRank(d) {
    const B = G.bd; if (!B) return; const me = myId(); B.rk.innerHTML = "";
    const rows = Object.keys(B.pawns).map((id) => ({ id, pts: B.score[id] || 0, x: B.info[id] || { name: "?", color: 0 } })).sort((a, b) => b.pts - a.pts);
    rows.forEach((r, i) => { const dv = d && d[r.id]; B.rk.appendChild(el("div", { class: "pg-rank__row" + (r.id === me ? " pg-rank__row--me" : "") + (dv ? " pg-rank__row--flash" : ""), style: { "--c": hexOf(r.x.color) } }, [el("span", { class: "pg-rank__n", text: String(i + 1) }), el("i"), el("b", { text: (r.x.bot ? "🤖 " : "") + r.x.name }), dv ? el("span", { class: "pg-bd__d" + (dv < 0 ? " pg-bd__d--neg" : ""), text: (dv > 0 ? "+" : "") + dv }) : null, el("span", { class: "pg-rank__pts pg-rank__pts--gen", text: String(r.pts) })])); });
  }
  function drawFoot(st) {
    const B = G.bd; if (!B || !st || st.phase !== "board") return; const me = myId(); B.foot.innerHTML = "";
    if (st.rate) B.foot.appendChild(rateRow(st.rate));
    B.foot.appendChild(ready3(st)); const ready = (st.ready || []).includes(me);
    B.foot.appendChild(el("button", { class: "btn btn--big " + (ready ? "btn--ghost" : "btn--green"), disabled: ready, text: ready ? "On attend les autres" : B.done ? "Manche suivante" : "Passer le plateau", onclick: () => { play("vote"); Kit.socket.emit("pg:ready"); } }));
  }
  function setPad(on) { const pad = $("#pg-pad"); if (!pad) return; if (window.matchMedia && window.matchMedia("(pointer: coarse)").matches) pad.classList.toggle("hidden", !on); }

  function attach() {
    const so = Kit.socket; if (!so || G.attached) return; G.attached = true;
    so.on("pg:state", onState); so.on("pg:scene", onScene); so.on("pg:frame", onFrame);
  }
  Kit.on("screen", (name) => { if (name === "game") setTimeout(() => { resize(); applyView(false); }, 60); });
  Kit.on("reset", () => { G.st = null; G.fr = null; G.priv = null; G.phaseKey = ""; G.scene = null; if (P3.ready) P3.clear(); });
  Kit.on("room", (r) => { if (r.status === "lobby") { G.st = null; G.fr = null; G.priv = null; G.phaseKey = ""; G.scene = null; if (P3.ready) P3.clear(); } });
  requestAnimationFrame(frameLoop);

  // bouton qui complète le salon avec des bots, pratique pour tester seul
  function fillBots(r, level) {
    const need = Math.max(0, 8 - r.players.length); for (let i = 0; i < need; i++) Kit.socket.emit("room:addBot", { level });
  }
  Kit.init({
    id: "pagaille", hero: true, title: "Pagaille Party", emoji: "🎉", ribbon: "Le party game des copains", tagline: "Des mini-jeux en 3D, un vote à chaque manche et beaucoup de chaos.",
    createLabel: "Créer un salon", soloLabel: "Jouer seul avec des bots", startLabel: "Lancer la partie", helpTitle: "Comment jouer",
    floaters: [{ e: "🎉", x: 6 }, { e: "💣", x: 20 }, { e: "🏁", x: 34 }, { e: "🌋", x: 48 }, { e: "🥊", x: 62 }, { e: "⛏️", x: 76 }, { e: "🧊", x: 90 }],
    colors: COLORS, botLevels: [{ id: "facile", label: "Facile" }, { id: "normal", label: "Normal" }, { id: "expert", label: "Expert" }], maxPlayers: 8, minPlayers: 2, schema: PR.SCHEMA,
    help: [
      { title: "Le principe", text: "De deux à huit joueurs se retrouvent dans un salon, avec ou sans bots. À chaque manche, trois mini-jeux sont proposés et tout le monde vote. Le plus voté se joue, puis les points tombent et la manche suivante commence." },
      { title: "Les commandes", text: "Les flèches ou ZQSD déplacent. Espace est l'action principale, Maj, E ou C l'action secondaire, et X peut remplacer Espace si ton clavier bloque. Certains jeux se jouent avec des boutons à l'écran ou à la souris. Sur téléphone, des touches apparaissent à l'écran." },
      { title: "Jouer seul", text: "Appuie sur Jouer seul avec des bots, ou ajoute des bots dans le salon. Dans les réglages, le mode démo laisse les bots jouer à ta place et le jeu imposé permet de répéter un mini-jeu." },
      { title: "Les points", text: "Le premier d'un mini-jeu reçoit dix points, les suivants moins, et les égalités se partagent. Quelques bonus récompensent les beaux coups. La dernière manche peut compter double." },
      { title: "Affichage", text: "Le bouton en haut à droite change l'affichage. 3D complet, 3D allégé pour les ordinateurs lents, ou vue à plat si ton navigateur n'arrive pas à dessiner la 3D. Le bouton à côté coupe le son." },
      { title: "Si quelqu'un se déconnecte", text: "La partie continue sans bloquer les autres. Un bot joue à sa place pendant son absence, et il reprend la main s'il revient avec le même lien avant la fin de la partie." },
      { title: "Le mode chaotique", text: "Une surprise est tirée à chaque manche. Les commandes peuvent être inversées, les pieds alourdis, tout peut aller plus vite, ou les points peuvent être doublés." },
    ],
    theme: { a1: "#ffd23b", a2: "#ff7a1f", bg1: "#4b2a83", bg2: "#150c2b" },
    renderPreview(box, r) {
      box.innerHTML = ""; const n = r.players.length; const s = r.settings || {};
      const ok = Cat.GAMES.filter((g) => (s.games || Cat.ids).includes(g.id) && g.min <= n && n <= g.max);
      box.appendChild(el("p", { class: "muted small", text: n + " joueur" + (n > 1 ? "s" : "") + ", " + ok.length + " mini-jeu" + (ok.length > 1 ? "x" : "") + " possible" + (ok.length > 1 ? "s" : "") + " avec ce nombre." }));
      box.appendChild(el("div", { class: "pg-prev" }, ok.map((g) => el("span", { class: "pg-prev__g", title: g.name, text: g.icon }))));
      if (Kit.isHost() && n < 8 && r.status === "lobby") box.appendChild(el("button", { class: "btn btn--small btn--plum", style: { marginTop: "0.5rem" }, text: "Compléter avec des bots jusqu'à 8", onclick: () => fillBots(r, "normal") }));
    },
    onInit() { buildGame(); attach(); Kit.on("connect", attach); },
  });
  window.PagailleGame = G;
})();

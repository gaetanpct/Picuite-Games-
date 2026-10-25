// ============================================================
// PAGAILLE PARTY — Interface de jeu (client)
// Reçoit l'état du serveur, dessine le plateau, envoie les touches et les choix.
// ============================================================
(function () {
  const { el, $, toast, sound } = Kit;
  const Cat = PgCatalog, PR = PgRules, RD = PgRender;
  const COLORS = [
    { name: "Rouge", hex: "#ef4b4b" }, { name: "Bleu", hex: "#3b82f6" }, { name: "Vert", hex: "#34c36c" }, { name: "Jaune", hex: "#f5c518" },
    { name: "Violet", hex: "#9b5de5" }, { name: "Orange", hex: "#ff8a1f" }, { name: "Rose", hex: "#ff6fb5" }, { name: "Turquoise", hex: "#1fc8c0" },
  ];
  const G = { st: null, deadline: 0, fr: null, priv: null, keys: { l: 0, r: 0, u: 0, d: 0, a: 0, b: 0 }, sent: "", canvas: null, ctx: null, last: 0, phaseKey: "", scale: 1, ox: 0, oy: 0, view: { w: 800, h: 600 }, lastFrameAt: 0, uiKey: "" };
  const safeSound = (n) => { try { sound[n] && sound[n](); } catch (e) { /* rien */ } };
  const myId = () => { const p = Kit.me(); return p ? p.id : null; };
  const hexOf = (k) => COLORS[(k || 0) % COLORS.length].hex;
  const secs = (ms) => Math.max(0, Math.ceil(ms / 1000));

  // ---------- squelette de l'écran de jeu ----------
  function buildGame() {
    const sc = $("#screen-game"); sc.innerHTML = "";
    const wrap = el("div", { id: "pg-wrap" }, [
      el("div", { id: "pg-top" }, [el("div", { id: "pg-round", class: "pg-pill" }), el("div", { id: "pg-score", class: "pg-score" })]),
      el("div", { id: "pg-stage" }, [
        el("div", { id: "pg-board" }, [
          el("canvas", { id: "pg-canvas" }),
          el("div", { id: "pg-hud" }, [
            el("div", { id: "pg-title", class: "pg-pill" }), el("div", { id: "pg-timer", class: "pg-timer" }), el("div", { id: "pg-chips", class: "pg-chips" }),
            el("div", { id: "pg-target", class: "pg-target hidden" }), el("div", { id: "pg-big", class: "pg-big hidden" }), el("div", { id: "pg-msgs", class: "pg-msgs" }), el("div", { id: "pg-cd", class: "pg-cd hidden" }),
            el("div", { id: "pg-dead", class: "pg-dead hidden" }),
          ]),
          el("div", { id: "pg-pad", class: "pg-pad hidden" }),
        ]),
        el("div", { id: "pg-side", class: "pg-side hidden" }, [el("div", { id: "pg-role", class: "pg-role hidden" }), el("div", { id: "pg-ui", class: "pg-ui hidden" })]),
        el("div", { id: "pg-overlay", class: "pg-overlay hidden" }),
      ]),
    ]);
    sc.appendChild(wrap);
    G.canvas = $("#pg-canvas"); G.ctx = G.canvas.getContext("2d"); if (window.ResizeObserver) new ResizeObserver(() => resize()).observe($("#pg-board"));
    G.canvas.addEventListener("pointerdown", onCanvasClick);
    buildPad(); resize();
  }
  function buildPad() {
    const pad = $("#pg-pad"); pad.innerHTML = "";
    const mk = (txt, key, cls) => { const b = el("button", { class: "pg-padbtn " + (cls || ""), text: txt }); const on = (e) => { e.preventDefault(); setKey(key, 1); }; const off = (e) => { e.preventDefault(); setKey(key, 0); };
      b.addEventListener("touchstart", on, { passive: false }); b.addEventListener("touchend", off); b.addEventListener("touchcancel", off); b.addEventListener("mousedown", on); b.addEventListener("mouseup", off); b.addEventListener("mouseleave", off); return b; };
    pad.appendChild(el("div", { class: "pg-dpad" }, [mk("▲", "u", "up"), mk("◀", "l", "left"), mk("▶", "r", "right"), mk("▼", "d", "down")]));
    pad.appendChild(el("div", { class: "pg-abtns" }, [mk("A", "a", "pa"), mk("B", "b", "pb")]));
    if (window.matchMedia && window.matchMedia("(pointer: coarse)").matches) pad.classList.remove("hidden");
  }
  function resize() {
    const c = G.canvas; if (!c) return; const st = $("#pg-board"); const dpr = Math.min(2, window.devicePixelRatio || 1);
    const w = st.clientWidth, h = st.clientHeight; c.width = Math.max(10, w * dpr); c.height = Math.max(10, h * dpr); c.style.width = w + "px"; c.style.height = h + "px"; G.dpr = dpr; G.cw = w; G.ch = h;
  }
  window.addEventListener("resize", () => { if (G.canvas) resize(); });

  // ---------- touches ----------
  const KEYMAP = { ArrowLeft: "l", ArrowRight: "r", ArrowUp: "u", ArrowDown: "d", q: "l", a: "l", d: "r", z: "u", w: "u", s: "d", " ": "a", Shift: "b", e: "b", Q: "l", A: "l", D: "r", Z: "u", W: "u", S: "d", E: "b" };
  function setKey(k, v) { if (G.keys[k] === v) return; G.keys[k] = v; sendKeys(); }
  function sendKeys() { const s = JSON.stringify(G.keys); if (s === G.sent) return; G.sent = s; if (Kit.socket) Kit.socket.emit("pg:in", G.keys); }
  const inGame = () => document.body.dataset.screen === "game" && G.st && G.st.phase === "play";
  window.addEventListener("keydown", (e) => {
    if (document.body.dataset.screen !== "game") return; const tag = (e.target && e.target.tagName) || ""; if (tag === "INPUT" || tag === "TEXTAREA") return;
    const k = KEYMAP[e.key]; if (!k) return; e.preventDefault(); setKey(k, 1);
  });
  window.addEventListener("keyup", (e) => { const k = KEYMAP[e.key]; if (!k) return; setKey(k, 0); });
  window.addEventListener("blur", () => { ["l", "r", "u", "d", "a", "b"].forEach((k) => { G.keys[k] = 0; }); sendKeys(); });
  setInterval(() => { if (inGame()) { G.sent = ""; sendKeys(); } }, 700);
  function onCanvasClick(e) {
    if (!inGame()) return; const r = G.canvas.getBoundingClientRect(); const x = (e.clientX - r.left - G.ox) / G.scale, y = (e.clientY - r.top - G.oy) / G.scale;
    Kit.socket.emit("pg:act", { type: "click", x, y });
  }
  function act(id) { safeSound("click"); Kit.socket.emit("pg:act", { type: "btn", id }); }

  // ---------- messages réseau ----------
  function onState(st) {
    const prev = G.st; G.st = st; G.deadline = Date.now() + st.left;
    const key = st.phase + ":" + st.round + ":" + (st.game ? st.game.id : "");
    if (key !== G.phaseKey) { G.phaseKey = key; G.fr = null; G.priv = null; RD.reset(); G.uiKey = ""; if (st.phase === "play") { ["l", "r", "u", "d", "a", "b"].forEach((k) => { G.keys[k] = 0; }); G.sent = ""; } }
    const sig = JSON.stringify(Object.assign({}, st, { left: 0 })); if (sig === G.sig) return; G.sig = sig;
    renderTop(); renderOverlay();
  }
  function onFrame(m) { G.fr = m.f; G.priv = m.p; G.lastFrameAt = performance.now(); if (m.f.w) G.view = { w: m.f.w, h: m.f.h }; renderHud(); renderPriv(); }

  // ---------- haut de l'écran ----------
  function renderTop() {
    const st = G.st; if (!st) return;
    $("#pg-round").textContent = st.phase === "over" ? "Partie terminée" : "Manche " + st.round + " sur " + st.total + (st.mode === "chaos" ? " · chaos" : "").replace("·", "-");
    const sc = $("#pg-score"); sc.innerHTML = "";
    st.standings.forEach((r) => sc.appendChild(el("div", { class: "pg-chip" + (r.id === myId() ? " pg-chip--me" : "") + (r.online ? "" : " pg-chip--off"), style: { "--c": hexOf(r.color) } }, [el("i"), el("b", { text: r.name }), el("span", { text: String(r.pts) })])));
  }

  // ---------- HUD de manche ----------
  function renderHud() {
    const f = G.fr; if (!f) return; const h = f.hud || {}; const st = G.st;
    $("#pg-title").textContent = h.title || ""; $("#pg-title").classList.toggle("hidden", !h.title);
    const tm = $("#pg-timer"); if (h.timer != null) { tm.textContent = String(Math.ceil(h.timer)); tm.classList.remove("hidden"); tm.classList.toggle("pg-timer--low", h.timer < 3); } else tm.classList.add("hidden");
    const ch = $("#pg-chips"); ch.innerHTML = ""; (h.chips || []).forEach((c) => ch.appendChild(el("span", { class: "pg-pill pg-pill--small", text: c.text })));
    const tg = $("#pg-target"); if (h.target) { tg.classList.remove("hidden"); tg.style.background = h.target.c; tg.textContent = h.target.s; } else tg.classList.add("hidden");
    const bg = $("#pg-big"); if (h.big) { bg.classList.remove("hidden"); bg.textContent = h.big; } else bg.classList.add("hidden");
    const ms = $("#pg-msgs"); ms.innerHTML = ""; (h.msgs || []).slice(-3).forEach((t) => ms.appendChild(el("div", { class: "pg-msg", text: t })));
    const cd = $("#pg-cd"); if (h.cd) { cd.classList.remove("hidden"); cd.textContent = String(h.cd); } else cd.classList.add("hidden");
  }
  function renderPriv() {
    const p = G.priv; const role = $("#pg-role"), dead = $("#pg-dead"), ui = $("#pg-ui");
    if (p && p.role) {
      role.classList.remove("hidden"); role.style.setProperty("--rc", p.role.c);
      const cdTxt = p.cd > 0 ? " · recharge " + Math.ceil(p.cd) + " s" : (p.cd === 0 && p.role.name === "Meurtrier" ? " · prêt à frapper" : "");
      role.innerHTML = ""; role.appendChild(el("b", { text: p.role.name + cdTxt.replace("·", "-") })); role.appendChild(el("span", { text: p.role.tip }));
      if (p.log && p.log.length) p.log.forEach((l) => role.appendChild(el("em", { text: l }))); if (p.why) role.appendChild(el("em", { text: p.why }));
    } else role.classList.add("hidden");
    dead.classList.toggle("hidden", !(p && p.dead)); dead.textContent = "Tu es éliminé, regarde la suite";
    if (p && p.err) toastOnce(p.err);
    // panneau de boutons
    const key = p && p.ui ? JSON.stringify(p.ui) : "";
    if (key !== G.uiKey) {
      G.uiKey = key; ui.innerHTML = "";
      if (p && p.ui) {
        ui.classList.remove("hidden");
        (p.ui.groups || []).forEach((g) => { const row = el("div", { class: "pg-uigroup" }, [el("div", { class: "pg-uilabel", text: g.label })]); const bs = el("div", { class: "pg-uibtns" }); g.btns.forEach((b) => bs.appendChild(el("button", { class: "pg-btn" + (b.sel ? " pg-btn--sel" : ""), disabled: !!b.dis, text: b.t, onclick: () => act(b.id) }))); row.appendChild(bs); ui.appendChild(row); });
        if (p.ui.lock) ui.appendChild(el("button", { class: "pg-btn pg-btn--go", disabled: !!p.ui.lock.dis, text: p.ui.lock.t, onclick: () => act(p.ui.lock.id) }));
      } else ui.classList.add("hidden");
    }
    $("#pg-side").classList.toggle("hidden", ui.classList.contains("hidden") && role.classList.contains("hidden"));
  }
  let lastToast = "", lastToastAt = 0;
  function toastOnce(t) { if (t === lastToast && Date.now() - lastToastAt < 3000) return; lastToast = t; lastToastAt = Date.now(); toast(t, "error"); }

  // ---------- dessin ----------
  function frameLoop(now) {
    requestAnimationFrame(frameLoop);
    if (document.body.dataset.screen !== "game" || !G.ctx) return; const dt = Math.min(0.1, (now - (G.last || now)) / 1000); G.last = now;
    const ctx = G.ctx; const dpr = G.dpr || 1; ctx.setTransform(1, 0, 0, 1, 0, 0); ctx.clearRect(0, 0, G.canvas.width, G.canvas.height);
    const f = G.fr; if (!f || !G.st || (G.st.phase !== "play" && G.st.phase !== "result")) return;
    const sw = G.cw, sh = G.ch; const s = Math.min(sw / f.w, sh / f.h); G.scale = s; G.ox = (sw - f.w * s) / 2; G.oy = (sh - f.h * s) / 2;
    ctx.setTransform(dpr * s, 0, 0, dpr * s, dpr * G.ox, dpr * G.oy);
    ctx.fillStyle = f.bg || "#223"; ctx.fillRect(0, 0, f.w, f.h);
    ctx.save(); ctx.beginPath(); ctx.rect(0, 0, f.w, f.h); ctx.clip();
    RD.draw(ctx, f, dt, now / 1000);
    drawPriv(ctx, now / 1000);
    ctx.restore();
  }
  function drawPriv(ctx, t) {
    const p = G.priv; if (!p) return;
    if (p.preview) { ctx.save(); ctx.globalAlpha = p.preview.a; ctx.fillStyle = p.preview.c; ctx.fillRect(p.preview.x, p.preview.y, p.preview.w, p.preview.h); ctx.restore(); }
    if (p.me && !p.dead) { ctx.save(); ctx.strokeStyle = "#fff"; ctx.lineWidth = 4; ctx.setLineDash([6, 4]); ctx.beginPath(); ctx.arc(p.me.x, p.me.y, 26, 0, 7); ctx.stroke(); ctx.setLineDash([]); ctx.fillStyle = hexOf(p.me.k); ctx.beginPath(); ctx.arc(p.me.x, p.me.y, 17, 0, 7); ctx.fill(); ctx.font = "700 13px Fredoka, system-ui, sans-serif"; ctx.textAlign = "center"; ctx.fillStyle = "#fff"; ctx.fillText("toi", p.me.x, p.me.y + 4); ctx.restore(); }
    if (p.dest && p.me && (p.dest.x !== p.me.x || p.dest.y !== p.me.y)) { ctx.save(); ctx.strokeStyle = "#ffd23b"; ctx.lineWidth = 4; ctx.setLineDash([5, 5]); ctx.beginPath(); ctx.moveTo(p.me.x, p.me.y); ctx.lineTo(p.dest.x, p.dest.y); ctx.stroke(); ctx.beginPath(); ctx.arc(p.dest.x, p.dest.y, 20, 0, 7); ctx.stroke(); ctx.restore(); }
    if (p.arrow) {
      const f = G.fr; const it = f && f.items.find((x) => x.id === p.arrow.id); if (!it) return; const len = 40 + p.arrow.pow * 150; const x2 = it.x + Math.cos(p.arrow.ang) * len, y2 = it.y + Math.sin(p.arrow.ang) * len;
      ctx.save(); ctx.strokeStyle = p.arrow.lock ? "#34c36c" : "#ffd23b"; ctx.fillStyle = ctx.strokeStyle; ctx.lineWidth = 6; ctx.beginPath(); ctx.moveTo(it.x, it.y); ctx.lineTo(x2, y2); ctx.stroke();
      const a = p.arrow.ang; ctx.beginPath(); ctx.moveTo(x2 + Math.cos(a) * 14, y2 + Math.sin(a) * 14); ctx.lineTo(x2 + Math.cos(a + 2.5) * 14, y2 + Math.sin(a + 2.5) * 14); ctx.lineTo(x2 + Math.cos(a - 2.5) * 14, y2 + Math.sin(a - 2.5) * 14); ctx.closePath(); ctx.fill();
      ctx.font = "700 15px Fredoka, system-ui, sans-serif"; ctx.textAlign = "center"; ctx.fillStyle = "#fff"; ctx.fillText("puissance " + Math.round(p.arrow.pow * 100) + (p.arrow.lock ? " validé" : ""), x2, y2 - 18); ctx.restore();
    }
  }

  // ---------- écrans par phase ----------
  function timerBar() { const bar = el("div", { class: "pg-bar" }, [el("i")]); bar._tick = () => { const left = G.deadline - Date.now(); const total = (G.st && G.st.total_ms) || 12000; bar.firstChild.style.width = Math.max(0, Math.min(100, (left / total) * 100)) + "%"; }; return bar; }
  function renderOverlay() {
    const st = G.st, ov = $("#pg-overlay"); if (!st) return;
    if (st.phase === "play") { ov.classList.add("hidden"); setPad(true); return; }
    setPad(false); $("#pg-ui").classList.add("hidden"); $("#pg-side").classList.add("hidden"); ov.classList.remove("hidden"); ov.innerHTML = "";
    const me = myId();
    if (st.phase === "vote") {
      const box = el("div", { class: "pg-card pg-card--wide" }, [el("h2", { text: "Quel mini-jeu pour la manche " + st.round + " ?" }), el("p", { class: "muted", text: "Vote pour ton préféré. La plus grosse pile l'emporte, le sort départage les égalités." })]);
      const row = el("div", { class: "pg-votes" });
      st.vote.options.forEach((o) => row.appendChild(el("button", { class: "pg-vote" + (st.vote.mine === o.id ? " pg-vote--mine" : ""), onclick: () => { safeSound("click"); Kit.socket.emit("pg:vote", { id: o.id }); } }, [
        el("span", { class: "pg-vote__icon", text: o.icon }), el("b", { text: o.name }), el("span", { class: "pg-vote__kind", text: o.kind }), el("span", { class: "pg-vote__meta", text: o.min + (o.max > o.min ? " à " + o.max : "") + " joueurs, environ " + o.secs + " s" }),
        el("span", { class: "pg-vote__rule", text: o.rules[0] }), el("span", { class: "pg-vote__count", text: st.vote.counts[o.id] + " vote" + (st.vote.counts[o.id] > 1 ? "s" : "") })])));
      box.appendChild(row); box.appendChild(el("p", { class: "pg-wait", id: "pg-wait", text: st.vote.voted.length + " vote" + (st.vote.voted.length > 1 ? "s" : "") + " sur " + st.members.length })); box.appendChild(clockBar(st)); ov.appendChild(box);
    } else if (st.phase === "intro") {
      const g = st.game; const box = el("div", { class: "pg-card pg-card--wide" }, [
        el("div", { class: "pg-intro__head" }, [el("span", { class: "pg-vote__icon", text: g.icon }), el("div", {}, [el("h2", { text: g.name }), el("span", { class: "pg-vote__kind", text: g.kind })])]),
      ]);
      if (st.mod) box.appendChild(el("div", { class: "pg-mod" }, [el("b", { text: "Surprise du chaos, " + st.mod.label }), el("span", { text: st.mod.desc })]));
      box.appendChild(el("h3", { text: "Les règles" })); box.appendChild(el("ul", { class: "pg-rules" }, g.rules.map((r) => el("li", { text: r }))));
      box.appendChild(el("h3", { text: "Les commandes" })); box.appendChild(el("ul", { class: "pg-rules" }, g.controls.map((r) => el("li", { text: r }))));
      box.appendChild(el("p", { class: "muted small", text: g.scoring }));
      const ready = st.ready.includes(me);
      box.appendChild(el("button", { class: "btn btn--big " + (ready ? "btn--ghost" : "btn--green"), disabled: ready, text: ready ? "Prêt, on attend les autres" : "Je suis prêt", onclick: () => { safeSound("click"); Kit.socket.emit("pg:ready"); } }));
      box.appendChild(el("p", { class: "pg-wait", text: st.ready.length + " prêt" + (st.ready.length > 1 ? "s" : "") + " sur " + st.members.length })); box.appendChild(clockBar(st)); ov.appendChild(box);
    } else if (st.phase === "result") {
      ov.classList.add("pg-overlay--side");
      const r = st.result; const box = el("div", { class: "pg-card" }, [el("h2", { text: r.icon + " " + r.game }), r.mult > 1 ? el("p", { class: "pg-mod pg-mod--x", text: "Points multipliés par " + r.mult }) : null]);
      const tb = el("div", { class: "pg-rank" });
      r.rows.forEach((x) => tb.appendChild(el("div", { class: "pg-rank__row" + (x.id === me ? " pg-rank__row--me" : ""), style: { "--c": hexOf(x.color) } }, [el("span", { class: "pg-rank__n", text: (x.tie ? "=" : "") + x.rank }), el("i"), el("b", { text: x.name }), el("span", { class: "pg-rank__note", text: x.note }), el("span", { class: "pg-rank__pts", text: "+" + x.pts })])));
      box.appendChild(tb); box.appendChild(el("h3", { text: "Classement général" }));
      const gen = el("div", { class: "pg-rank pg-rank--small" }); st.standings.forEach((x) => gen.appendChild(el("div", { class: "pg-rank__row" + (x.id === me ? " pg-rank__row--me" : ""), style: { "--c": hexOf(x.color) } }, [el("span", { class: "pg-rank__n", text: x.rank }), el("i"), el("b", { text: x.name }), el("span", { class: "pg-rank__pts", text: x.pts + " pts" })])));
      box.appendChild(gen); box.appendChild(el("p", { class: "pg-wait", text: st.round >= st.total ? "Résultats finaux dans un instant" : "Manche suivante dans un instant" })); ov.appendChild(box);
    } else if (st.phase === "over") {
      ov.classList.remove("pg-overlay--side");
      const top = st.standings; const box = el("div", { class: "pg-card pg-card--wide" }, [el("h2", { text: "Fin de la partie" })]);
      if (st.reason) box.appendChild(el("p", { class: "muted", text: st.reason }));
      const pod = el("div", { class: "pg-podium" });
      top.slice(0, 3).forEach((x, i) => pod.appendChild(el("div", { class: "pg-pod pg-pod--" + (i + 1), style: { "--c": hexOf(x.color) } }, [el("span", { class: "pg-pod__medal", text: ["🥇", "🥈", "🥉"][i] }), el("i"), el("b", { text: x.name }), el("span", { text: x.pts + " points" })])));
      box.appendChild(pod);
      const gen = el("div", { class: "pg-rank pg-rank--small" }); top.forEach((x) => gen.appendChild(el("div", { class: "pg-rank__row" + (x.id === me ? " pg-rank__row--me" : ""), style: { "--c": hexOf(x.color) } }, [el("span", { class: "pg-rank__n", text: x.rank }), el("i"), el("b", { text: x.name }), el("span", { class: "pg-rank__pts", text: x.pts + " pts" })])));
      box.appendChild(gen);
      const wins = {}; (st.history || []).forEach((h) => h.winners.forEach((id) => { wins[id] = (wins[id] || 0) + 1; }));
      box.appendChild(el("p", { class: "muted small", text: "Manches gagnées. " + top.map((x) => x.name + " " + (wins[x.id] || 0)).join(", ") }));
      const row = el("div", { class: "pg-actions" });
      if (Kit.isHost()) row.appendChild(el("button", { class: "btn btn--accent btn--big", text: "Retour au salon", onclick: () => Kit.backToLobby() })); else row.appendChild(el("p", { class: "muted", text: "L'hôte peut relancer une partie depuis le salon." }));
      row.appendChild(el("button", { class: "btn btn--ghost", text: "Quitter", onclick: () => Kit.leave() })); box.appendChild(row); ov.appendChild(box);
    }
  }
  function clockBar(st) { const total = st.left || 1; const bar = el("div", { class: "pg-bar" }, [el("i")]); const start = Date.now(); const tick = () => { if (!G.st || G.st !== st || !bar.isConnected) return; const left = Math.max(0, G.deadline - Date.now()); bar.firstChild.style.width = Math.min(100, (left / Math.max(total, 1)) * 100) + "%"; requestAnimationFrame(tick); }; requestAnimationFrame(tick); return bar; }
  function setPad(on) { const pad = $("#pg-pad"); if (!pad) return; if (window.matchMedia && window.matchMedia("(pointer: coarse)").matches) pad.classList.toggle("hidden", !on); }

  function attach() {
    const so = Kit.socket; if (!so || G.attached) return; G.attached = true;
    so.on("pg:state", onState); so.on("pg:frame", onFrame);
  }
  Kit.on("screen", (name) => { if (name === "game") setTimeout(resize, 60); });
  Kit.on("reset", () => { G.st = null; G.fr = null; G.priv = null; G.phaseKey = ""; });
  Kit.on("room", (r) => { if (r.status === "lobby") { G.st = null; G.fr = null; G.priv = null; G.phaseKey = ""; } });
  requestAnimationFrame(frameLoop);

  Kit.init({
    id: "pagaille", title: "Pagaille Party", emoji: "🎉", ribbon: "Le party game des copains", tagline: "Des mini-jeux de moins d'une minute, du vote et beaucoup de chaos.",
    createLabel: "Créer un salon", startLabel: "Lancer la partie", helpTitle: "Comment jouer", noBots: true,
    floaters: [{ e: "🎉", x: 6 }, { e: "💣", x: 20 }, { e: "🎨", x: 34 }, { e: "🌋", x: 48 }, { e: "🔦", x: 62 }, { e: "🌉", x: 76 }, { e: "💰", x: 90 }],
    colors: COLORS, botLevels: [{ id: "x", label: "x" }], maxPlayers: 8, minPlayers: 2, schema: PR.SCHEMA,
    help: [
      { title: "Le principe", text: "De deux à huit joueurs se retrouvent dans un salon. À chaque manche, trois mini-jeux sont proposés et tout le monde vote. Le plus voté se joue, puis les points tombent et la manche suivante commence." },
      { title: "Les commandes", text: "Les flèches ou ZQSD déplacent. Espace est l'action principale. Maj ou E est l'action secondaire. Certains jeux se jouent avec des boutons à l'écran ou à la souris. Sur téléphone, des touches apparaissent à l'écran." },
      { title: "Les points", text: "Le premier d'un mini-jeu reçoit dix points, les suivants moins, et les égalités se partagent. Quelques bonus récompensent les beaux coups. La dernière manche peut compter double." },
      { title: "Sans le son", text: "Tout se comprend à l'écran. Les règles s'affichent avant chaque jeu, des compteurs et des messages annoncent ce qui se passe." },
      { title: "Si quelqu'un se déconnecte", text: "La partie continue sans bloquer les autres. Un joueur absent ne vote plus et ne joue plus, et peut revenir avec le même lien tant que la partie n'est pas finie." },
      { title: "Le mode chaotique", text: "Une surprise est tirée à chaque manche. Les commandes peuvent être inversées, tout peut aller plus vite, ou les points peuvent être doublés." },
    ],
    theme: { a1: "#ffd23b", a2: "#ff7a1f", bg1: "#4b2a83", bg2: "#1a1033" },
    renderPreview(box, r) {
      box.innerHTML = ""; const n = r.players.length; const s = r.settings || {};
      const ok = Cat.GAMES.filter((g) => (s.games || Cat.ids).includes(g.id) && g.min <= n && n <= g.max);
      box.appendChild(el("p", { class: "muted small", text: n + " joueur" + (n > 1 ? "s" : "") + ", " + ok.length + " mini-jeu" + (ok.length > 1 ? "x" : "") + " possible" + (ok.length > 1 ? "s" : "") + " avec ce nombre." }));
      box.appendChild(el("div", { class: "pg-prev" }, ok.map((g) => el("span", { class: "pg-prev__g", title: g.name, text: g.icon }))));
    },
    onInit() { buildGame(); attach(); Kit.on("connect", attach); },
  });
  window.PagailleGame = G;
})();

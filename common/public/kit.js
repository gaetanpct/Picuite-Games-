// ============================================================
// Noyau d'interface partagé par Golfouille et Zoomalou
// Accueil, salon, réglages automatiques depuis un schéma, tchat, sons, reconnexion.
// ============================================================
(function () {
  const $ = (s, r) => (r || document).querySelector(s);
  const $$ = (s, r) => Array.from((r || document).querySelectorAll(s));
  function el(tag, attrs, kids) {
    const n = document.createElement(tag);
    if (attrs) Object.keys(attrs).forEach((k) => {
      const v = attrs[k];
      if (v === undefined || v === null || v === false) return;
      if (k === "class") n.className = v;
      else if (k === "text") n.textContent = v;
      else if (k === "html") n.innerHTML = v;
      else if (k === "style" && typeof v === "object") Object.assign(n.style, v);
      else if (k.startsWith("on") && typeof v === "function") n.addEventListener(k.slice(2), v);
      else n.setAttribute(k, v === true ? "" : v);
    });
    (kids || []).forEach((c) => { if (c !== null && c !== undefined && c !== false) n.appendChild(typeof c === "string" ? document.createTextNode(c) : c); });
    return n;
  }
  const store = {
    get(k, f) { try { const v = localStorage.getItem(k); return v === null ? f : v; } catch (e) { return f; } },
    set(k, v) { try { localStorage.setItem(k, v); } catch (e) { /* rien */ } },
    sget(k, f) { try { const v = sessionStorage.getItem(k); return v === null ? f : v; } catch (e) { return f; } },
    sset(k, v) { try { sessionStorage.setItem(k, v); } catch (e) { /* rien */ } },
    sdel(k) { try { sessionStorage.removeItem(k); } catch (e) { /* rien */ } },
  };
  function toast(text, type) {
    let box = $("#toasts"); if (!box) { box = el("div", { id: "toasts" }); document.body.appendChild(box); }
    const t = el("div", { class: "toast toast--" + (type || "info"), text });
    box.appendChild(t);
    setTimeout(() => t.classList.add("toast--out"), 3200);
    setTimeout(() => t.remove(), 3700);
  }

  // ---------- sons par synthèse ----------
  const sound = (function () {
    let ctx = null; let enabled = true;
    function ac() {
      if (!enabled) return null;
      try { if (!ctx) ctx = new (window.AudioContext || window.webkitAudioContext)(); if (ctx.state === "suspended") ctx.resume(); return ctx; } catch (e) { return null; }
    }
    function tone(freq, dur, type, vol, delay, slideTo) {
      const c = ac(); if (!c) return;
      const t0 = c.currentTime + (delay || 0);
      const o = c.createOscillator(); const g = c.createGain();
      o.type = type || "sine"; o.frequency.setValueAtTime(freq, t0);
      if (slideTo) o.frequency.exponentialRampToValueAtTime(slideTo, t0 + dur);
      g.gain.setValueAtTime(0.0001, t0); g.gain.exponentialRampToValueAtTime(vol || 0.1, t0 + 0.01); g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
      o.connect(g); g.connect(c.destination); o.start(t0); o.stop(t0 + dur + 0.05);
    }
    function noise(dur, vol, delay, lp) {
      const c = ac(); if (!c) return;
      const n = Math.floor(c.sampleRate * dur); const b = c.createBuffer(1, n, c.sampleRate); const d = b.getChannelData(0);
      for (let i = 0; i < n; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / n);
      const s = c.createBufferSource(); s.buffer = b; const g = c.createGain(); g.gain.value = vol || 0.1;
      const f = c.createBiquadFilter(); f.type = "lowpass"; f.frequency.value = lp || 1800;
      s.connect(f); f.connect(g); g.connect(c.destination); s.start(c.currentTime + (delay || 0));
    }
    return {
      tone, noise,
      get enabled() { return enabled; },
      toggle() { enabled = !enabled; store.set("kit.sound", enabled ? "1" : "0"); return enabled; },
      init() { enabled = store.get("kit.sound", "1") !== "0"; },
      click() { tone(520, 0.07, "triangle", 0.07); },
      win() { tone(520, 0.12, "triangle", 0.1); tone(660, 0.12, "triangle", 0.1, 0.1); tone(880, 0.2, "triangle", 0.1, 0.2); },
      fail() { tone(300, 0.25, "sawtooth", 0.07, 0, 120); },
    };
  })();

  const handlers = {};
  const Kit = { $, $$, el, store, toast, sound, socket: null, room: null, cfg: null, token: null, roomCode: null };
  Kit.on = (ev, fn) => { (handlers[ev] = handlers[ev] || []).push(fn); };
  const fire = (ev, a) => (handlers[ev] || []).forEach((f) => { try { f(a); } catch (e) { console.error(e); } });

  Kit.showScreen = function (name) {
    $$(".screen").forEach((s) => s.classList.toggle("screen--active", s.id === "screen-" + name));
    document.body.dataset.screen = name;
    $("#btn-chat-fab").classList.toggle("hidden", name === "home");
    if (name === "home") closeChat();
    fire("screen", name);
  };

  // ---------- squelette ----------
  function build(cfg) {
    const root = $("#kit-root");
    root.innerHTML = "";
    const home = el("section", { id: "screen-home", class: "screen screen--active" }, [
      el("div", { class: "kit-sky" }, (cfg.floaters || []).map((f, i) => el("span", { class: "kit-floater", style: { "--x": f.x + "%", "--d": (i * 1.3) + "s", "--s": (1.6 + (i % 3) * 0.5) + "rem" }, text: f.e }))),
      el("div", { class: "home-wrap" }, [
        el("header", { class: "kit-logo" }, [
          el("div", { class: "kit-logo__emoji", text: cfg.emoji }),
          el("h1", { class: "kit-logo__big", text: cfg.title }),
          el("div", { class: "kit-logo__ribbon" }, [el("span", { text: cfg.ribbon })]),
          el("p", { class: "kit-logo__tag", text: cfg.tagline }),
        ]),
        el("main", { class: "card home-card" }, [
          el("label", { class: "field" }, [el("span", { class: "field__label", text: "Ton nom" }), el("input", { id: "input-name", type: "text", maxlength: "16", placeholder: "Ex. Pupuce", autocomplete: "off" })]),
          el("div", { class: "home-actions" }, [
            el("button", { id: "btn-create", class: "btn btn--accent btn--big", text: cfg.createLabel }),
            cfg.noBots ? null : el("button", { id: "btn-solo", class: "btn btn--green btn--big", text: cfg.soloLabel }),
          ]),
          el("div", { class: "home-or" }, [el("span", { text: "ou rejoindre des amis" })]),
          el("div", { class: "join-row" }, [
            el("input", { id: "input-code", type: "text", maxlength: "4", placeholder: "CODE", autocomplete: "off" }),
            el("button", { id: "btn-join", class: "btn btn--plum", text: "Rejoindre" }),
          ]),
          el("button", { id: "btn-rules", class: "btn btn--ghost", text: "Comment jouer" }),
          el("a", { class: "kit-backlink", href: "/", text: "Retour à Picuite Games" }),
        ]),
      ]),
    ]);
    const lobby = el("section", { id: "screen-lobby", class: "screen" }, [
      el("div", { class: "lobby-wrap" }, [
        el("header", { class: "lobby-top" }, [
          el("button", { id: "btn-lobby-leave", class: "btn btn--ghost btn--small", text: "Quitter" }),
          el("div", { class: "code-box" }, [el("span", { class: "code-box__label", text: "Code du salon" }), el("button", { id: "lobby-code", class: "code-box__code", title: "Copier le code", text: "----" })]),
          el("button", { id: "btn-lobby-rules", class: "btn btn--ghost btn--small", text: "Règles" }),
        ]),
        el("div", { class: "lobby-grid" }, [
          el("section", { class: "card" }, [el("h2", { text: "Les joueurs" }), el("div", { id: "player-list" }), el("div", { id: "add-bot-row", class: "add-bot-row" }), el("div", { id: "lobby-preview" })]),
          el("section", { class: "card" }, [el("h2", { text: "Les réglages" }), el("p", { class: "muted small", id: "rules-hint" }), el("div", { id: "rules-box" })]),
        ]),
        el("footer", { class: "lobby-foot" }, [el("div", { id: "lobby-status", class: "muted" }), el("div", { id: "lobby-buttons" })]),
      ]),
    ]);
    const game = el("section", { id: "screen-game", class: "screen" });
    const modal = el("div", { id: "modal", class: "overlay hidden" }, [el("div", { class: "modal card" }, [el("h2", { id: "modal-title" }), el("div", { id: "modal-body" }), el("button", { id: "modal-close", class: "btn btn--accent", text: "Compris" })])]);
    const confirm = el("div", { id: "confirm-overlay", class: "overlay hidden" }, [el("div", { class: "modal card" }, [el("p", { id: "confirm-text" }), el("div", { class: "row" }, [el("button", { id: "btn-confirm-no", class: "btn btn--ghost", text: "Non" }), el("button", { id: "btn-confirm-yes", class: "btn btn--accent", text: "Oui" })])])]);
    const chat = el("div", { id: "chat-panel", class: "chat hidden" }, [
      el("div", { class: "chat__head" }, [el("b", { text: "Tchat" }), el("button", { id: "btn-chat-close", class: "chat__x", text: "×" })]),
      el("div", { id: "chat-messages", class: "chat__msgs" }),
      el("form", { id: "chat-form", class: "chat__form" }, [el("input", { id: "chat-input", maxlength: "200", placeholder: "Un petit mot", autocomplete: "off" }), el("button", { class: "btn btn--accent btn--small", text: "Envoyer" })]),
    ]);
    const fab = el("button", { id: "btn-chat-fab", class: "chat-fab hidden", title: "Tchat" }, [el("span", { text: "💬" }), el("i", { id: "chat-fab-badge", class: "badge hidden", text: "0" })]);
    [home, lobby, game, modal, confirm, chat, fab, el("div", { id: "toasts" })].forEach((n) => root.appendChild(n));
  }

  // ---------- session ----------
  function initSession(cfg) {
    const pre = cfg.id;
    Kit.token = store.sget(pre + ".token", null);
    if (!Kit.token) { Kit.token = Math.random().toString(36).slice(2) + Math.random().toString(36).slice(2); store.sset(pre + ".token", Kit.token); }
    Kit.roomCode = store.sget(pre + ".room", null);
    const socket = io({ path: location.pathname.replace(/[^\/]*$/, "") + "socket.io", transports: ["websocket", "polling"] });
    Kit.socket = socket;
    let pendingSolo = false;
    socket.on("connect", () => { if (Kit.roomCode) socket.emit("room:reconnect", { code: Kit.roomCode, token: Kit.token }); fire("connect"); });
    socket.on("disconnect", () => toast("Connexion perdue, reconnexion en cours", "error"));
    socket.on("room:joined", ({ code, token }) => {
      Kit.roomCode = code; Kit.token = token || Kit.token;
      store.sset(pre + ".room", code); store.sset(pre + ".token", Kit.token);
      if (pendingSolo) { pendingSolo = false; socket.emit("room:addBot", { level: cfg.botLevels[1].id }); }
    });
    socket.on("room:gone", () => { clearSession(); Kit.showScreen("home"); });
    socket.on("room:kicked", () => { toast("Tu as été expulsé du salon.", "error"); clearSession(); fire("reset"); Kit.showScreen("home"); });
    socket.on("room:lobbyAgain", () => { fire("reset"); Kit.showScreen("lobby"); });
    socket.on("toast", ({ text, type }) => toast(text, type || "error"));
    socket.on("room:state", (r) => {
      Kit.room = r; fire("room", r);
      if (r.status === "lobby") { renderLobby(r); Kit.showScreen("lobby"); }
      else if (document.body.dataset.screen !== "game") Kit.showScreen("game");
    });
    function clearSession() { store.sdel(pre + ".room"); Kit.roomCode = null; Kit.room = null; chatMsgs = []; renderChat(); }
    Kit.leave = () => { socket.emit("room:leave"); clearSession(); fire("reset"); Kit.showScreen("home"); };
    Kit.backToLobby = () => socket.emit("room:backToLobby");
    Kit.isHost = () => !!(Kit.room && Kit.room.hostId && Kit.room.players.find((p) => p.you && p.id === Kit.room.hostId));
    Kit.me = () => (Kit.room ? Kit.room.players.find((p) => p.you) : null);

    // accueil
    $("#input-name").value = store.get(pre + ".name", "");
    const myName = () => { const v = ($("#input-name").value || "").trim(); if (v) store.set(pre + ".name", v); return v || "Joueur"; };
    $("#btn-create").onclick = () => { sound.click(); socket.emit("room:create", { name: myName(), token: Kit.token }); };
    if ($("#btn-solo")) $("#btn-solo").onclick = () => { sound.click(); pendingSolo = true; socket.emit("room:create", { name: myName(), token: Kit.token }); };
    const join = () => {
      const code = ($("#input-code").value || "").trim().toUpperCase();
      if (code.length !== 4) return toast("Le code du salon fait 4 lettres.", "error");
      socket.emit("room:join", { code, name: myName(), token: Kit.token });
    };
    $("#btn-join").onclick = join;
    $("#input-code").addEventListener("keydown", (e) => { if (e.key === "Enter") join(); });
    $("#input-code").addEventListener("input", (e) => { e.target.value = e.target.value.toUpperCase().replace(/[^A-Z]/g, ""); });
    $("#input-name").addEventListener("keydown", (e) => { if (e.key === "Enter") $("#btn-create").click(); });
    $("#btn-rules").onclick = () => showHelp(); $("#btn-lobby-rules").onclick = () => showHelp();
    $("#btn-lobby-leave").onclick = () => Kit.leave();
    $("#lobby-code").onclick = () => { try { navigator.clipboard.writeText(Kit.roomCode || ""); toast("Code copié.", "info"); } catch (e) { /* rien */ } };
    $("#modal-close").onclick = () => $("#modal").classList.add("hidden");
    $("#modal").addEventListener("click", (e) => { if (e.target.id === "modal") e.target.classList.add("hidden"); });
    $("#confirm-overlay").addEventListener("click", (e) => { if (e.target.id === "confirm-overlay") e.target.classList.add("hidden"); });

    // tchat
    let chatMsgs = []; let unread = 0; let chatOpen = false;
    function renderChat() {
      const box = $("#chat-messages"); box.innerHTML = "";
      chatMsgs.slice(-60).forEach((m) => {
        if (m.system) return box.appendChild(el("div", { class: "chat-msg chat-msg--sys", text: m.text }));
        const col = cfg.colors[(m.color || 0) % cfg.colors.length].hex;
        box.appendChild(el("div", { class: "chat-msg", style: { "--hc": col } }, [el("b", { text: m.name + " " }), el("span", { text: m.text })]));
      });
      box.scrollTop = box.scrollHeight;
    }
    function setBadge() { const b = $("#chat-fab-badge"); b.textContent = unread; b.classList.toggle("hidden", unread === 0); }
    function openChat() { chatOpen = true; unread = 0; setBadge(); $("#chat-panel").classList.remove("hidden"); renderChat(); setTimeout(() => $("#chat-input").focus(), 50); }
    window.closeChat = function () { chatOpen = false; $("#chat-panel").classList.add("hidden"); };
    socket.on("chat:history", (h) => { chatMsgs = h || []; renderChat(); });
    socket.on("chat:message", (m) => { chatMsgs.push(m); if (chatMsgs.length > 80) chatMsgs.shift(); if (chatOpen) renderChat(); else { unread++; setBadge(); } fire("chat", m); });
    $("#btn-chat-fab").onclick = () => (chatOpen ? window.closeChat() : openChat());
    $("#btn-chat-close").onclick = () => window.closeChat();
    $("#chat-form").addEventListener("submit", (e) => { e.preventDefault(); const v = $("#chat-input").value.trim(); if (!v) return; socket.emit("chat:send", { text: v }); $("#chat-input").value = ""; });
  }
  function closeChat() { if (window.closeChat) window.closeChat(); }

  function showHelp() {
    const cfg = Kit.cfg;
    $("#modal-title").textContent = cfg.helpTitle || "Comment jouer";
    const body = $("#modal-body"); body.innerHTML = "";
    cfg.help.forEach((h) => body.appendChild(el("div", { class: "help-item" }, [el("h3", { text: h.title }), el("p", { text: h.text })])));
    $("#modal").classList.remove("hidden");
  }
  Kit.showModal = function (title, nodes) {
    $("#modal-title").textContent = title; const b = $("#modal-body"); b.innerHTML = "";
    (nodes || []).forEach((n) => b.appendChild(typeof n === "string" ? el("p", { text: n }) : n));
    $("#modal").classList.remove("hidden");
  };
  Kit.confirm = function (text, yes) {
    $("#confirm-text").textContent = text;
    const ov = $("#confirm-overlay"); ov.classList.remove("hidden");
    $("#btn-confirm-no").onclick = () => ov.classList.add("hidden");
    $("#btn-confirm-yes").onclick = () => { ov.classList.add("hidden"); yes(); };
  };

  // ---------- salon ----------
  function ruleVisible(rule, s) {
    if (!rule.showIf) return true;
    return Object.keys(rule.showIf).every((k) => { const need = rule.showIf[k]; return Array.isArray(need) ? need.includes(s[k]) : s[k] === need; });
  }
  function renderLobby(r) {
    const cfg = Kit.cfg; const host = Kit.isHost(); const meP = r.players.find((p) => p.you);
    $("#lobby-code").textContent = r.code;
    const list = $("#player-list"); list.innerHTML = "";
    r.players.forEach((p) => {
      const col = cfg.colors[p.color % cfg.colors.length];
      const row = el("div", { class: "player" + (p.you ? " player--you" : "") }, [
        el("span", { class: "player__dot", style: { background: col.hex }, title: col.name }),
        el("div", { class: "player__main" }, [
          el("b", { text: p.name }),
          el("span", { class: "muted small", text: (p.isBot ? "Bot" : p.id === r.hostId ? "Hôte" : "Joueur") + (p.you ? " et c'est toi" : "") + (!p.isBot && !p.connected ? " hors ligne" : "") }),
        ]),
        p.isBot ? (host ? el("select", { class: "mini-select", onchange: (e) => Kit.socket.emit("room:botLevel", { id: p.id, level: e.target.value }) }, cfg.botLevels.map((l) => el("option", { value: l.id, text: l.label, selected: l.id === p.level }))) : el("span", { class: "chip-mini", text: (cfg.botLevels.find((l) => l.id === p.level) || {}).label || "" })) : el("span", { class: "chip-mini " + (p.ready ? "chip-mini--ok" : ""), text: p.ready ? "prêt" : "pas prêt" }),
        host && !p.you ? el("button", { class: "btn btn--tiny btn--danger", title: "Retirer", text: "×", onclick: () => Kit.socket.emit("room:kick", { id: p.id }) }) : null,
      ]);
      list.appendChild(row);
      if (p.you) {
        const sw = el("div", { class: "swatches" }, cfg.colors.map((c, i) => {
          const taken = r.players.some((q) => q.color === i && !q.you);
          return el("button", { class: "swatch" + (i === p.color ? " swatch--on" : "") + (taken ? " swatch--taken" : ""), style: { background: c.hex }, title: c.name, onclick: () => Kit.socket.emit("room:color", { color: i }) });
        }));
        list.appendChild(sw);
      }
    });
    const bots = $("#add-bot-row"); bots.innerHTML = "";
    if (host && !cfg.noBots && r.players.length < cfg.maxPlayers) {
      const sel = el("select", { id: "bot-level", class: "mini-select" }, cfg.botLevels.map((l, i) => el("option", { value: l.id, text: l.label, selected: i === 1 })));
      bots.appendChild(el("button", { class: "btn btn--green btn--small", text: "Ajouter un bot", onclick: () => Kit.socket.emit("room:addBot", { level: sel.value }) }));
      bots.appendChild(sel);
    }
    // réglages
    $("#rules-hint").textContent = host ? "Tu es l'hôte, tout se règle ici. Chaque réglage est expliqué juste dessous." : "Seul l'hôte change les réglages. Tu peux les lire ici.";
    renderRules(r, host);
    if (cfg.renderPreview) cfg.renderPreview($("#lobby-preview"), r);
    // pied
    const foot = $("#lobby-buttons"); foot.innerHTML = "";
    const st = $("#lobby-status");
    if (host) {
      const others = r.players.filter((p) => !p.isBot && !p.you);
      const notReady = others.filter((p) => !p.ready).length;
      st.textContent = r.players.length < cfg.minPlayers ? (cfg.noBots ? "Il faut au moins " + cfg.minPlayers + " joueurs, invite des amis avec le code." : "Ajoute un bot ou invite un ami avec le code.") : notReady ? notReady + " joueur(s) pas encore prêt(s)." : "Tout le monde est prêt, lance la partie.";
      foot.appendChild(el("button", { class: "btn btn--accent btn--big", text: cfg.startLabel, onclick: () => { sound.click(); Kit.socket.emit("room:start"); } }));
    } else {
      st.textContent = meP && meP.ready ? "Tu es prêt, l'hôte lancera la partie." : "Clique sur prêt quand tu veux commencer.";
      foot.appendChild(el("button", { class: "btn " + (meP && meP.ready ? "btn--ghost" : "btn--green") + " btn--big", text: meP && meP.ready ? "Je ne suis plus prêt" : "Je suis prêt", onclick: () => Kit.socket.emit("room:ready", { ready: !(meP && meP.ready) }) }));
    }
  }
  const edit = (id, value) => Kit.socket.emit("room:settings", { settings: { [id]: value } });
  function renderRules(r, host) {
    const box = $("#rules-box"); const s = r.settings;
    const scrollTop = box.scrollTop;
    box.innerHTML = "";
    Kit.cfg.schema.forEach((cat) => {
      const rules = cat.rules.filter((x) => ruleVisible(x, s));
      if (!rules.length) return;
      box.appendChild(el("h3", { class: "rules-cat", text: cat.category }));
      rules.forEach((rule) => {
        const wrap = el("div", { class: "rule" });
        const head = el("div", { class: "rule__head" }, [el("b", { text: rule.label })]);
        wrap.appendChild(head);
        const val = s[rule.id];
        if (rule.type === "bool") {
          head.appendChild(el("label", { class: "switch" + (host ? "" : " switch--ro") }, [el("input", { type: "checkbox", checked: !!val, disabled: !host, onchange: (e) => edit(rule.id, e.target.checked) }), el("span", { class: "switch__track" })]));
        } else if (rule.type === "range") {
          const out = el("span", { class: "range-val", text: (rule.format ? rule.format(val) : val) + (rule.unit || "") });
          head.appendChild(out);
          const inp = el("input", { type: "range", min: rule.min, max: rule.max, step: rule.step || 1, value: val, disabled: !host, class: "range" });
          inp.addEventListener("input", () => { out.textContent = (rule.format ? rule.format(+inp.value) : inp.value) + (rule.unit || ""); });
          inp.addEventListener("change", () => edit(rule.id, +inp.value));
          wrap.appendChild(inp);
        } else if (rule.type === "text") {
          const inp = el("input", { type: "text", maxlength: String(rule.max || 24), value: val || "", placeholder: rule.placeholder || "", disabled: !host, class: "text-input" });
          inp.addEventListener("change", () => edit(rule.id, inp.value));
          wrap.appendChild(inp);
        } else if (rule.type === "multi") {
          const chosen = new Set(val || []);
          wrap.appendChild(el("div", { class: "chips" }, rule.options.map((o) => el("button", {
            class: "chip" + (chosen.has(o.value) ? " chip--on" : ""), disabled: !host, title: o.desc || "",
            onclick: () => { const n = new Set(chosen); if (n.has(o.value)) n.delete(o.value); else n.add(o.value); edit(rule.id, Array.from(n)); },
          }, [o.icon ? el("span", { text: o.icon + " " }) : null, o.label]))));
          if (rule.options.some((o) => o.desc)) wrap.appendChild(el("p", { class: "opt-notes small muted", text: rule.options.filter((o) => chosen.has(o.value) && o.desc).map((o) => o.label + " · " + o.desc).join(" ") }));
        } else if (rule.type === "cards") {
          wrap.appendChild(el("div", { class: "cards" }, rule.options.map((o) => el("button", {
            class: "optcard" + (o.value === val ? " optcard--on" : ""), disabled: !host, onclick: () => edit(rule.id, o.value),
          }, [el("span", { class: "optcard__icon", text: o.icon || "" }), el("b", { text: o.label }), el("span", { class: "small muted", text: o.desc || "" })]))));
        } else {
          wrap.appendChild(el("div", { class: "chips" }, rule.options.map((o) => {
            const ov = typeof o === "object" ? o.value : o; const ol = typeof o === "object" ? o.label : String(o);
            return el("button", { class: "chip" + (ov === val ? " chip--on" : ""), disabled: !host, onclick: () => edit(rule.id, ov), text: ol });
          })));
          const cur = rule.options.find((o) => typeof o === "object" && o.value === val);
          if (cur && cur.desc) wrap.appendChild(el("p", { class: "small muted", text: cur.desc }));
        }
        if (rule.info) wrap.appendChild(el("p", { class: "rule__info small muted", text: rule.info }));
        box.appendChild(wrap);
      });
    });
    box.scrollTop = scrollTop;
  }

  Kit.init = function (cfg) {
    Kit.cfg = cfg; sound.init();
    build(cfg); initSession(cfg);
    document.title = cfg.title;
    document.documentElement.style.setProperty("--accent-1", cfg.theme.a1);
    document.documentElement.style.setProperty("--accent-2", cfg.theme.a2);
    document.documentElement.style.setProperty("--bg-1", cfg.theme.bg1);
    document.documentElement.style.setProperty("--bg-2", cfg.theme.bg2);
    if (cfg.onInit) cfg.onInit(Kit);
  };
  window.Kit = Kit;
})();

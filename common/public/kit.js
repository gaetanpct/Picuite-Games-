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
    socket.on("room:gone", () => { clearSession(); toast("Cette partie n'existe plus, le serveur a sans doute redémarré. Recrée un salon ou rejoins-en un.", "error"); Kit.showScreen("home"); });
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

// ============================================================
// Garde-fous du rendu 3D. Certains ordinateurs (Mac, Safari, cartes graphiques partagées) refusent une option
// du rendu et l'écran reste vide ou blanc. Le mode compatibilité utilise le rendu le plus simple possible.
// Il s'active tout seul sur Safari, ou dès qu'une erreur de shader ou un écran vide est détecté, et se règle dans le menu.
// ============================================================
(function () {
  const GL = { info: "", errors: 0, level: 0, reason: "" };
  const ua = navigator.userAgent || "";
  const isSafari = /Safari\//.test(ua) && !/Chrome|Chromium|CriOS|Edg|OPR|Firefox|FxiOS|Android/.test(ua);
  const lsGet = (k) => { try { return localStorage.getItem(k); } catch (e) { return null; } };
  const lsSet = (k, v) => { try { localStorage.setItem(k, v); } catch (e) {} };
  const ssGet = (k) => { try { return sessionStorage.getItem(k); } catch (e) { return null; } };
  const ssSet = (k, v) => { try { sessionStorage.setItem(k, v); } catch (e) {} };
  GL.isSafari = isSafari;
  GL.compat = function () {
    if (/[?&]safe=1/.test(location.search)) return true;
    if (/[?&]safe=0/.test(location.search)) return false;
    const v = lsGet("gl.compat"); if (v === "1") return true; if (v === "0") return false;
    return isSafari;
  };
  GL.setCompat = function (on) { lsSet("gl.compat", on ? "1" : "0"); if (on) { lsSet("golf.quality", "low"); lsSet("zoom.quality", "low"); } location.reload(); };
  // Message discret. Petit, en bas à gauche, il ne cache jamais le jeu, se ferme tout seul et se ferme aussi d'un clic.
  GL.banner = function (msg, noBtn) {
    try {
      let b = document.getElementById("gl-diag");
      if (!b) {
        b = document.createElement("div"); b.id = "gl-diag";
        b.style.cssText = "position:fixed;left:10px;bottom:10px;z-index:99999;max-width:min(320px,70vw);background:rgba(30,10,10,0.85);color:#fff;border:1px solid #ffb84a;border-radius:10px;padding:6px 26px 6px 10px;font:12px/1.3 sans-serif;text-align:left;opacity:0.9";
        document.body.appendChild(b);
      }
      b.textContent = "";
      const t = document.createElement("div"); t.textContent = msg; b.appendChild(t);
      const x = document.createElement("span"); x.textContent = "✕"; x.style.cssText = "position:absolute;right:8px;top:4px;cursor:pointer;font-size:13px"; x.onclick = () => b.remove(); b.appendChild(x);
      if (!noBtn && !GL.compat()) {
        const bt = document.createElement("button"); bt.textContent = "Passer en mode compatibilité";
        bt.style.cssText = "margin-top:6px;padding:4px 10px;border-radius:8px;border:0;background:#ffb84a;font-weight:700;cursor:pointer;font-size:12px"; bt.onclick = () => GL.setCompat(true); b.appendChild(bt);
      }
      const d = document.createElement("a"); d.textContent = "Page de diagnostic"; d.href = "common/diag.html"; d.target = "_blank";
      d.style.cssText = "display:block;margin-top:4px;color:#ffd98a;font-size:11px"; b.appendChild(d);
      clearTimeout(GL._bt); GL._bt = setTimeout(() => { try { b.remove(); } catch (e) {} }, 9000);
    } catch (e) {}
  };
  // bascule une seule fois en mode compatibilité, sinon montre la cause
  GL.fail = function (why) {
    GL.reason = why;
    if (why !== "écran vide" && !GL.compat() && !ssGet("gl.auto")) { ssSet("gl.auto", "1"); lsSet("gl.compat", "1"); lsSet("golf.quality", "low"); lsSet("zoom.quality", "low"); location.reload(); return; }
    GL.banner("Affichage 3D douteux (" + why + "). Si le jeu s'affiche bien, ignore ce message.", true);
  };
  let patched = false;
  function patchMaterials(T) {
    if (patched) return; patched = true;
    ["MeshStandardMaterial", "MeshPhysicalMaterial", "MeshPhongMaterial", "MeshToonMaterial"].forEach((n) => {
      const Base = T.MeshLambertMaterial;
      try {
        const Simple = function (p) { const q = Object.assign({}, p || {}); ["roughness", "metalness", "shininess", "specular", "envMapIntensity", "clearcoat", "transmission", "ior", "thickness", "gradientMap", "roughnessMap", "metalnessMap", "normalMap", "bumpMap", "sheen", "reflectivity", "iridescence", "attenuationColor", "attenuationDistance"].forEach((k) => delete q[k]); return new Base(q); };
        Simple.prototype = Base.prototype; T[n] = Simple;
      } catch (e) { /* objet figé, tant pis */ }
    });
  }
  // Essaie des réglages de plus en plus prudents. Le mode compatibilité n'utilise qu'un contexte WebGL1 sans lissage ni transparence.
  GL.create = function (T, canvas, quality) {
    let r = null, last = null;
    const hook = (rr) => { try { rr.debug.checkShaderErrors = true; rr.debug.onShaderError = () => GL.fail("une erreur de compilation graphique"); } catch (e) {} return rr; };
    if (GL.compat()) {
      patchMaterials(T);
      try {
        const gl = canvas.getContext("webgl", { antialias: false, alpha: false, depth: true, stencil: false, powerPreference: "default", failIfMajorPerformanceCaveat: false, preserveDrawingBuffer: false }) || canvas.getContext("experimental-webgl");
        if (gl) { r = new T.WebGLRenderer({ canvas, context: gl }); GL.level = 9; }
      } catch (e) { last = e; }
      if (r) {
        try { Object.defineProperty(r.shadowMap, "enabled", { get() { return false; }, set() {} }); } catch (e) {}
        const spr = r.setPixelRatio.bind(r); r.setPixelRatio = (v) => spr(Math.min(v, 1.25));
        r.setClearColor(0x000000, 1); document.documentElement.classList.add("gl-compat");
        return hook(r);
      }
    }
    const tries = [
      { canvas, antialias: quality !== "low", alpha: true, powerPreference: "high-performance" },
      { canvas, antialias: quality !== "low", alpha: true },
      { canvas, antialias: false, alpha: true },
      { canvas, antialias: false, alpha: false, precision: "mediump", failIfMajorPerformanceCaveat: false },
    ];
    for (let i = 0; i < tries.length; i++) {
      try { r = new T.WebGLRenderer(tries[i]); GL.level = i; return hook(r); } catch (e) { last = e; }
    }
    GL.banner("Ton navigateur ne peut pas afficher le jeu en 3D. Vérifie que l'accélération graphique est activée dans les réglages, ou essaie un autre navigateur. Détail " + (last && last.message ? String(last.message).slice(0, 140) : "inconnu"));
    throw last || new Error("WebGL indisponible");
  };
  // fond du ciel. En mode normal c'est un dégradé derrière un canevas transparent, en compatibilité c'est une image dans la scène
  GL.sky = function (scene, host, c0, c1, T) {
    if (GL.compat()) {
      try {
        const cv = document.createElement("canvas"); cv.width = 4; cv.height = 256; const x = cv.getContext("2d"); const g = x.createLinearGradient(0, 0, 0, 256); g.addColorStop(0, c0); g.addColorStop(0.78, c1); g.addColorStop(1, c1); x.fillStyle = g; x.fillRect(0, 0, 4, 256);
        const tex = new T.CanvasTexture(cv); tex.minFilter = T.LinearFilter; tex.magFilter = T.LinearFilter; tex.generateMipmaps = false; scene.background = tex;
      } catch (e) { scene.background = new T.Color(c1); }
      host.style.background = c1;
    } else { scene.background = null; host.style.background = "linear-gradient(180deg," + c0 + "," + c1 + " 78%)"; }
  };
  GL.watch = function (canvas, onRestore) {
    canvas.addEventListener("webglcontextlost", (e) => { e.preventDefault(); GL.banner("L'affichage 3D a été interrompu par ton ordinateur. Il devrait reprendre tout seul.", true); }, false);
    canvas.addEventListener("webglcontextrestored", () => { const b = document.getElementById("gl-diag"); if (b) b.remove(); if (onRestore) onRestore(); }, false);
  };
  // dessine une image sans jamais casser la boucle
  GL.frame = function (fn) {
    try { fn(); } catch (e) {
      GL.errors++;
      if (GL.errors === 3) GL.banner("Une erreur d'affichage 3D se répète. Détail " + String(e && e.message || e).slice(0, 160));
      if (GL.errors > 400) return;
    }
  };
  // Vérifie que quelque chose s'affiche vraiment. Une image d'une seule couleur alors que des objets sont dessinés est un écran vide.
  let frames = 0, blank = 0;
  GL.verify = function (renderer) {
    frames++;
    if (frames !== 100 && frames !== 200 && frames !== 330 && frames !== 500) return;
    try {
      const gl = renderer.getContext(); const w = gl.drawingBufferWidth, h = gl.drawingBufferHeight; let uniform = false;
      if (!w || !h) uniform = true;
      else {
        const px = new Uint8Array(4); let first = null, diff = 0;
        for (let i = 1; i <= 11; i++) for (let j = 1; j <= 8; j++) { gl.readPixels(Math.floor(w * i / 12), Math.floor(h * j / 9), 1, 1, gl.RGBA, gl.UNSIGNED_BYTE, px); const c = [px[0], px[1], px[2], px[3]]; if (!first) first = c; else diff = Math.max(diff, Math.abs(c[0] - first[0]), Math.abs(c[1] - first[1]), Math.abs(c[2] - first[2]), Math.abs(c[3] - first[3])); }
        uniform = diff < 4;
      }
      const calls = renderer.info && renderer.info.render ? renderer.info.render.calls : 1;
      if (uniform && calls > 0) blank++; else blank = 0;
      if (blank >= 3 && !GL.warned) { GL.warned = 1; GL.fail("écran vide"); }
    } catch (e) { /* lecture impossible, on ne dit rien */ }
  };
  // toute erreur de script s'affiche à l'écran pour pouvoir être signalée
  let shown = 0;
  window.addEventListener("error", (e) => {
    if (shown++ > 0 || !e || !e.message || /ResizeObserver|Script error/.test(e.message)) return;
    try {
      const b = document.createElement("div"); b.style.cssText = "position:fixed;left:8px;right:8px;bottom:8px;z-index:99998;background:rgba(40,10,10,0.92);color:#fff;border:2px solid #ff8a7a;border-radius:12px;padding:8px 12px;font:12px/1.35 sans-serif";
      b.textContent = "Erreur technique, montre ce message au créateur. " + String(e.message).slice(0, 160) + " dans " + String(e.filename || "").split("/").slice(-2).join("/") + " ligne " + e.lineno;
      b.onclick = () => b.remove(); document.body.appendChild(b);
    } catch (x) {}
  });
  window.PicuiteGL = GL;
})();

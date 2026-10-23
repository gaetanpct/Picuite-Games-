// ============================================================
// BUS BAZAR — Jeu côté navigateur, vue à la première personne
// ============================================================
(function () {
  "use strict";
  const T = THREE; const L = BBL; const R = BBRules; const P = BBPeople;
  const { $, el, toast, sound, store } = Kit;
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
  const wrap = (a) => { while (a > Math.PI) a -= 2 * Math.PI; while (a < -Math.PI) a += 2 * Math.PI; return a; };
  const COLORS = [{ name: "Jaune bus", hex: "#f2b705" }, { name: "Rouge sirène", hex: "#e8453c" }, { name: "Bleu route", hex: "#2f78d1" }, { name: "Vert canard", hex: "#3aa653" }];
  const WX = BBRoad.WEATHER; const SURF = BBRoad.SURF;
  const BB = { init: null, v: null, tb: null, age: 0, npc: {}, crew: {}, keys: {}, me: null, role: null, pos: { x: 0, z: 0, yaw: 0, pitch: 0, vx: 0, vz: 0 }, bus: null, feed: [], held: "", hold: null, sel: { cart: 0 }, tumble: 0, roll: 0, sens: Number(store.get("bb.sens", "1")) || 1, wheel: Number(store.get("bb.wheel", "1")) || 1, steerV: 0, assist: true, locked: false, last: 0, over: null, shake: 0, flash: 0, hurt: 0, nextSend: 0, nextDrive: 0, nextHold: 0, hudT: 0, touch: false, mobile: { mx: 0, mz: 0, sx: 0 } };
  let renderer = null, scene = null, camera = null, W = null, bus = null, busG = null, flip = null, E = null, handG = null, host = null, canvas = null, hud = {}, built = false, platG = null, platFor = -1;
  const ZONE = (z) => (z > 2.5 ? "à l'avant" : z < -2.5 ? "au fond" : "au milieu");
  const pick = (id) => document.getElementById(id);

  // ---------- salon, choix des postes ----------
  function renderPreview(box, room) {
    if (!box) return; box.innerHTML = ""; const crew = BB.crew || {}; const host = Kit.isHost();
    const wrapEl = el("div", { class: "bb-lobby" }, [el("h3", { text: "Les quatre postes du bus" }), el("p", { class: "muted small", text: "Chacun a un rôle et marche dans le bus en vue à la première personne. Les postes sans joueur sont tenus par des robots, tu peux donc jouer seul ou à quatre. Un joueur sans choix reçoit un poste libre au départ." })]);
    const grid = el("div", { class: "bb-roles" });
    L.ROLES.forEach((r) => {
      const holderId = crew[r.id]; const holder = holderId ? room.players.find((p) => p.id === holderId) : null; const mine = holder && holder.you;
      const btn = el("button", { class: "btn btn--small " + (mine ? "btn--ghost" : "btn--accent"), text: mine ? "Libérer ce poste" : holder ? "Poste pris" : "Prendre ce poste", onclick: () => { sound.click(); Kit.socket.emit("bb:role", { role: mine ? null : r.id }); } }); btn.disabled = !!holder && !mine;
      grid.appendChild(el("div", { class: "bb-roleCard" + (mine ? " me" : "") + (holder ? " taken" : "") }, [el("div", { class: "ic", text: r.icon }), el("div", { class: "main" }, [el("b", { text: r.label }), el("small", { text: r.desc }), el("small", { text: holder ? "Tenu par " + holder.name : "Tenu par un robot si personne ne le prend" })]), btn]));
    });
    wrapEl.appendChild(grid);
    const seedRow = el("div", { class: "bb-seed" }, [el("b", { text: "Graine du voyage" }), el("code", { text: room.settings.seed ? room.settings.seed : "au hasard à chaque voyage" }),
      host ? el("button", { class: "btn btn--small btn--plum", text: "🎲 Tirer une graine", onclick: () => { const w = ["canard", "moulin", "baguette", "tracteur", "citrouille", "fanfare", "moustache", "gomme", "ruban", "klaxon", "patate", "nuage", "tuba", "biscotte", "lama"]; const g = w[Math.floor(Math.random() * w.length)] + Math.floor(Math.random() * 90 + 10); Kit.socket.emit("room:settings", { settings: { seed: g } }); } }) : null,
      el("small", { class: "muted", text: "Même graine et mêmes réglages, même route, même météo et mêmes candidats au voyage." })]);
    wrapEl.appendChild(seedRow); box.appendChild(wrapEl);
    if (!renderPreview.t) renderPreview.t = setTimeout(() => { renderPreview.t = null; if (Kit.socket) Kit.socket.emit("bb:crewGet"); }, 150);
  }

  // ---------- construction de l'interface ----------
  function buildGame() {
    const sc = $("#screen-game"); sc.innerHTML = ""; built = true;
    host = el("div", { id: "bb-host" }); canvas = document.createElement("canvas"); host.appendChild(canvas); sc.appendChild(host);
    const H = el("div", { class: "bb-hud", id: "bb-hud" }); sc.appendChild(H);
    const add = (cls, id, kids, extra) => { const d = el("div", Object.assign({ class: cls, id }, extra || {}), kids || []); H.appendChild(d); hud[id] = d; return d; };
    add("bb-hurt", "hurt"); add("bb-flash", "flash");
    add("bb-role pill", "role"); add("bb-stats pill", "stats"); add("bb-top pill", "top"); add("bb-alerts", "alerts"); add("bb-feed", "feed");
    add("bb-cross", "cross"); add("bb-prompt", "prompt"); add("bb-dash pill", "dash"); add("bb-held pill", "heldbox"); add("bb-help pill", "help"); add("bb-center", "center");
    add("bb-click", "click", [el("div", { class: "pill", text: "Clique ici pour regarder avec la souris. Échap pour la libérer." })]);
    const menu = add("bb-menu", "menu", [el("button", { class: "btn btn--small btn--ghost", text: "Réglages", onclick: () => openMenu() })]);
    add("bb-end hidden", "end");
    hud.click.onclick = () => { try { canvas.requestPointerLock(); } catch (e) { /* tant pis */ } hud.click.style.display = "none"; };
    buildTouch(H);
    window.addEventListener("resize", resize);
  }
  function resize() { if (!renderer || !host) return; const w = host.clientWidth || window.innerWidth, h = host.clientHeight || window.innerHeight; renderer.setSize(w, h, false); camera.aspect = w / h; camera.fov = w / h < 1 ? 82 : 72; camera.updateProjectionMatrix(); }

  // ---------- scène ----------
  function startScene(init) {
    if (!renderer) {
      renderer = PicuiteGL.create(T, canvas, "medium"); PicuiteGL.watch(canvas);
      BB.gl = renderer; renderer.setClearColor(0x000000, 1); renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.5));
    }
    scene = new T.Scene(); camera = new T.PerspectiveCamera(72, 1, 0.05, 720); scene.add(camera);
    flip = new T.Group(); flip.scale.x = -1; scene.add(flip);
    W = BBWorld.build(scene, init, pick("bb-host")); W.fogRef = scene.fog; flip.add(W.group);
    bus = BBBus.build(); busG = bus.g; busG.rotation.order = "YXZ"; flip.add(busG);
    E = BBEnt.create(busG); handG = new T.Group(); handG.position.set(0.27, -0.3, -0.55); camera.add(handG); BB.handKey = "";
    platG = null; platFor = -1; resize();
    const b = init.t0 !== undefined && BB.v ? BB.v.b : null; BB.bus = b ? Object.assign({}, b) : null;
  }
  function stopScene() { if (E) BBEnt.clear(E); scene = null; W = null; bus = null; busG = null; E = null; }

  // ---------- réseau ----------
  function attach() {
    const so = Kit.socket; if (!so || so._bb) return; so._bb = true;
    so.on("bb:crew", (d) => { BB.crew = d.crew || {}; if (Kit.room && Kit.room.status === "lobby") renderPreview($("#lobby-preview"), Kit.room); });
    so.on("bb:init", (d) => {
      BB.init = d; BB.me = d.you; BB.role = d.role; document.body.classList.toggle("bb-driver", d.role === "driver"); BB.npc = {}; BB.v = null; BB.tb = null; BB.feed = []; BB.over = null; BB.held = "";
      BB.players = {}; d.players.forEach((p) => { BB.players[p.id] = p; });
      BB.assist = d.assist !== false;
      const spawn = d.role === "driver" ? { x: L.DRIVER.x, z: L.DRIVER.z } : { x: 0.2, z: 3.8 }; BB.pos.x = spawn.x; BB.pos.z = spawn.z; BB.pos.yaw = 0; BB.pos.pitch = 0; BB.pos.vx = BB.pos.vz = 0;
      if (!built) buildGame();
      stopScene(); try { startScene(d); } catch (e) { console.error(e); toast("Impossible de démarrer la 3D, essaie le mode compatibilité dans les réglages.", "error"); }
      hud.end.classList.add("hidden"); hud.end.innerHTML = "";
      showCenter("Le voyage commence", "Tu es " + (L.ROLES.find((r) => r.id === d.role) || { label: "équipier" }).label.toLowerCase(), 4);
    });
    so.on("bb:reg", (list) => { list.forEach((n) => { BB.npc[n.id] = n; }); });
    so.on("bb:state", (s) => {
      if (s.n.some((n) => !BB.npc[n.i])) { BB.missT = (BB.missT || 0) + 1; if (BB.missT > 28) { BB.missT = 0; so.emit("bb:regReq"); } } else BB.missT = 0;
      BB.v = s; BB.tb = s.b; BB.age = 0;
      if (!BB.bus) BB.bus = Object.assign({}, s.b);
      const me = s.p.find((p) => p.i === BB.me);
      if (me) { if (s.ps && Math.hypot(s.ps.x - BB.pos.x, s.ps.z - BB.pos.z) > 1.8) { BB.pos.x = s.ps.x; BB.pos.z = s.ps.z; } BB.held = me.h; BB.tumble = me.tm ? 1 : 0; BB.holdProg = me.hp; }
      if (s.ov && !BB.over) { BB.over = s.ov; showEnd(s.ov); }
    });
    so.on("bb:ev", (list) => { list.forEach(onEvent); });
  }
  function onEvent(e) {
    if (e.k === "msg") pushFeed(e.text, e.kind, e.icon);
    else if (e.k === "toast") pushFeed(e.text, "info", "ℹ️");
    else if (e.k === "hit") { BB.shake = 1; BB.hurt = 0.6; sound.noise(0.25, 0.12, 0, 900); sound.tone(120, 0.2, "sawtooth", 0.08, 0, 60); }
    else if (e.k === "cash") sound.tone(880, 0.08, "triangle", 0.07), sound.tone(1175, 0.1, "triangle", 0.07, 0.07);
    else if (e.k === "fixed") sound.tone(660, 0.1, "triangle", 0.08), sound.tone(990, 0.14, "triangle", 0.08, 0.09);
    else if (e.k === "need") sound.tone(440, 0.07, "sine", 0.05);
    else if (e.k === "fire") sound.noise(0.5, 0.1, 0, 2400);
    else if (e.k === "horn") { sound.tone(330, 0.5, "square", 0.07); sound.tone(415, 0.5, "square", 0.05); }
    else if (e.k === "thunder") { BB.flash = 1; sound.noise(1.2, 0.15, 0.2, 500); }
    else if (e.k === "rear") sound.tone(200, 0.3, "sawtooth", 0.06, 0, 90);
    else if (e.k === "eject") sound.tone(500, 0.4, "triangle", 0.08, 0, 140);
    else if (e.k === "chick") sound.tone(1200, 0.08, "square", 0.04), sound.tone(1500, 0.08, "square", 0.04, 0.09);
  }
  function pushFeed(text, kind, icon) { BB.feed.push({ text: (icon ? icon + " " : "") + text, kind: kind || "info", t: performance.now() }); if (BB.feed.length > 7) BB.feed.shift(); BB.feedDirty = true; }
  function showCenter(a, b, sec) { hud.center.innerHTML = ""; hud.center.appendChild(document.createTextNode(a)); if (b) hud.center.appendChild(el("small", { text: b })); hud.center.style.display = ""; clearTimeout(showCenter.t); showCenter.t = setTimeout(() => { hud.center.style.display = "none"; }, (sec || 3) * 1000); }

  // ---------- commandes ----------
  const typing = (e) => { const t = e.target; return t && (t.tagName === "INPUT" || t.tagName === "TEXTAREA" || t.isContentEditable); };
  const inGame = () => document.body.dataset.screen === "game" && BB.v && BB.init && !BB.over;
  document.addEventListener("keydown", (e) => {
    if (typing(e) || document.body.dataset.screen !== "game") return;
    if (e.repeat && !["KeyW", "KeyA", "KeyS", "KeyD"].includes(e.code)) { if (["ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight", "Space"].includes(e.code)) e.preventDefault(); return; }
    BB.keys[e.code] = true; if (["ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight", "Space"].includes(e.code)) e.preventDefault();
    if (!inGame()) return; const k = (e.key || "").toLowerCase();
    if (k === "e") pressUse();
    else if (k === "f") pressGrab();
    else if (k === "r") pressRefuse();
    else if (k === "g") send({ a: "drop" });
    else if (k === "t") send({ a: "throw" });
    else if (k === "h" && BB.role === "driver") send({ a: "horn" });
    else if (e.code === "Digit1" || e.code === "Digit2" || e.code === "Digit3") { BB.sel.cart = Number(e.code.slice(5)) - 1; BB.hudT = 0; }
  });
  document.addEventListener("keyup", (e) => { delete BB.keys[e.code]; if ((e.key || "").toLowerCase() === "e") BB.hold = null; });
  window.addEventListener("blur", () => { BB.keys = {}; BB.hold = null; });
  document.addEventListener("pointerlockchange", () => { BB.locked = document.pointerLockElement === canvas; if (!BB.locked && hud.click && document.body.dataset.screen === "game") hud.click.style.display = ""; });
  document.addEventListener("mousemove", (e) => { if (!BB.locked || !inGame()) return; look(e.movementX * 0.0022, e.movementY * 0.0022); });
  document.addEventListener("mousedown", (e) => { if (BB.locked && inGame()) { if (BB.role === "driver") send({ a: "horn" }); else pressUse(); } });
  document.addEventListener("mouseup", () => { BB.hold = null; });
  function look(dx, dy) { BB.pos.yaw = wrap(BB.pos.yaw + dx * BB.sens); BB.pos.pitch = clamp(BB.pos.pitch - dy * BB.sens, -1.3, 1.3); }
  const send = (m) => { if (Kit.socket) Kit.socket.emit("bb:act", m); };

  // ---------- cibles d'interaction ----------
  function findTargets() {
    const S = BB.v; if (!S || !BB.init) return []; const me = BB.pos; const out = []; const fx = Math.sin(me.yaw), fz = Math.cos(me.yaw); const stop = S.ph === "stop"; const open = stop && S.b.dr;
    const heldNpc = BB.held.indexOf("npc") === 0; const heldItem = BB.held.indexOf("item") === 0 ? S.it.find((i) => "item" + i.i === BB.held) : null;
    const consider = (x, z, range, bias, obj) => {
      const dx = x - me.x, dz = z - me.z; const d = Math.hypot(dx, dz); if (d > range) return; let ang = 0;
      if (d > 0.9) { ang = Math.abs(wrap(Math.atan2(dx, dz) - me.yaw)); if (ang > 0.95) return; }
      obj.d = d; obj.score = d + ang * 1.4 + (bias || 0); out.push(obj);
    };
    const driver = BB.role === "driver";
    if (driver) {
      out.push({ kind: "door", score: 0, d: 0, x: 0, z: 0, text: stop ? "Appuie sur E pour fermer la porte et repartir" : "Le klaxon se joue avec H ou un clic", can: stop });
      return out;
    }
    S.n.forEach((n) => {
      const inf = BB.npc[n.i]; if (!inf) return;
      if (n.s === "wait") { if (stop && open !== undefined) consider(n.x, n.z, 2.9, 0, { kind: "cand", n, inf }); return; }
      if (["leave", "ejected", "carried", "board"].includes(n.s)) return;
      consider(n.x, n.z, 2.1, 0, { kind: "npc", n, inf });
    });
    S.it.forEach((i) => { if (i.h) return; if (i.s === "slot" || i.s === "free" || i.s === "wait" || i.s === "plat" || i.s === "") consider(i.x, i.z, 2.0, 0.15, { kind: "item", it: i }); });
    L.stations.forEach((st) => consider(st.x, st.z, st.r + 0.4, 0.1, { kind: st.id === "hatch" ? "hatch" : "station", st }));
    S.hz.forEach((h) => consider(h.x, h.z, 1.9, -0.2, { kind: h.t, h }));
    if (heldItem && (heldItem.t === "crate" || heldItem.t === "bag")) L.slots.forEach((sl) => { if (S.it.some((i) => i.s === "slot" && i.sl === sl.id)) return; consider(sl.x, sl.z, 2.0, 0.3, { kind: "slot", sl }); });
    if (heldNpc) L.seats.forEach((s) => { if (S.n.some((n) => n.sl === s.i && n.s !== "gone")) return; consider(s.x, s.z, 1.9, 0.2, { kind: "seat", seat: s }); });
    consider(0, -7.3, 2.6, 0.8, { kind: "rear" });
    out.sort((a, b) => a.score - b.score); return out;
  }
  function describe(t) {
    const S = BB.v; const heldItem = BB.held.indexOf("item") === 0 ? S.it.find((i) => "item" + i.i === BB.held) : null;
    if (t.kind === "cand") { const k = L.KINDS[t.inf.k]; return { text: "E pour accepter, R pour refuser", info: t.inf.nm + ", " + k.label + ". " + k.note + " Va jusqu'à l'arrêt " + (S.st && BB.init ? W.R.stops[t.inf.d].name : "") + ". Paie " + t.inf.f + " pièces." }; }
    if (t.kind === "npc") {
      const n = t.n; const nm = t.inf.nm; const N = n.nd ? L.NEEDS[n.nd] : null;
      if (N) {
        if (N.item) return heldItem && heldItem.t === N.item ? { text: "E pour donner " + L.ITEMS[N.item].label.toLowerCase() + " à " + nm } : { text: nm + " " + N.label + ". Il lui faut " + (L.ITEMS[N.item].label.toLowerCase()), hint: true };
        if (N.seat) return { text: "E pour trouver une place à " + nm };
        if (N.stop) return { text: nm + " doit descendre vite. Demande au conducteur de s'arrêter", hint: true };
        if (N.hold) return { text: "Maintiens E pour " + N.hold.toLowerCase() + " " + nm, hold: true };
      }
      if (n.tr) return { text: "Maintiens E pour calmer " + nm + ", F pour le porter", hold: true };
      if (n.as) return { text: "Maintiens E pour réveiller " + nm, hold: true };
      return { text: nm + " va bien. F pour le porter", hint: true };
    }
    if (t.kind === "item" && BB.held) return { text: "Tes mains sont pleines. G pour poser ce que tu tiens", hint: true };
    if (t.kind === "item") { const d = L.ITEMS[t.it.t]; const c = t.it.c ? L.CARGO[t.it.c] : null; return { text: "E pour prendre " + (c ? c.label.toLowerCase() : d.label.toLowerCase()), info: c ? c.label + ". " + c.note + " Destination " + (t.it.d >= 0 && W ? W.R.stops[t.it.d].name : "inconnue") + (t.it.hp < 100 ? ". Solidité " + t.it.hp + " sur 100" : "") : d.tip }; }
    if (t.kind === "station") { const st = t.st; const cur = BB.held.indexOf("item") === 0; if (cur) return { text: "E pour reposer ce que tu tiens" }; if (st.id === "cart") { const ks = ["snack", "drink", "mop"]; const k = ks[BB.sel.cart % 3]; return { text: "E pour prendre " + (L.ITEMS[k] ? L.ITEMS[k].label.toLowerCase() : "serpillière") + ". Touches 1 casse-croûte, 2 boisson, 3 serpillière" }; } return { text: "E pour prendre " + L.ITEMS[st.give[0]].label.toLowerCase() }; }
    if (t.kind === "hatch") return heldItem && heldItem.t === "tools" ? { text: "Maintiens E pour réparer le moteur", hold: true } : { text: "Trappe du moteur. Prends d'abord la caisse à outils sur l'établi", hint: true };
    if (t.kind === "fire") return heldItem && heldItem.t === "ext" ? { text: "Maintiens E pour éteindre le feu", hold: true } : { text: "Un feu. Prends d'abord l'extincteur au fond du bus", hint: true };
    if (t.kind === "puddle") return { text: "Maintiens E pour nettoyer (la serpillière va plus vite)", hold: true };
    if (t.kind === "slot") return { text: "E pour ranger ici (" + (t.sl.kind === "haut" ? "porte-bagages" : "sol") + ")" };
    if (t.kind === "seat") return { text: "E pour asseoir le passager ici" };
    if (t.kind === "rear") return { text: S.b.rr ? "E pour refermer la porte de secours" : "E pour ouvrir la porte de secours", hint: false };
    if (t.kind === "door") return { text: t.text };
    return { text: "" };
  }
  function pressUse() {
    const S = BB.v; if (!S) return; const list = findTargets(); const t = list[0]; if (!t) return;
    const m = { a: "use", e: 1 };
    if (t.kind === "door") m.t = "door";
    else if (t.kind === "cand") { m.t = "cand"; m.id = t.n.i; }
    else if (t.kind === "npc") { m.t = "npc"; m.id = t.n.i; }
    else if (t.kind === "item") { m.t = "item"; m.id = t.it.i; }
    else if (t.kind === "station") { m.t = "station"; m.id = t.st.id; m.k = t.st.id === "cart" ? ["snack", "drink", "mop"][BB.sel.cart % 3] : undefined; }
    else if (t.kind === "hatch") { m.t = "hatch"; m.id = "hatch"; }
    else if (t.kind === "fire") { m.t = "fire"; m.id = t.h.i; }
    else if (t.kind === "puddle") { m.t = "puddle"; m.id = t.h.i; }
    else if (t.kind === "slot") { m.t = "slot"; m.id = t.sl.id; }
    else if (t.kind === "seat") { m.t = "seat"; m.id = t.seat.i; }
    else if (t.kind === "rear") m.t = "rear";
    send(m);
    if (["npc", "hatch", "fire", "puddle"].includes(t.kind)) BB.hold = { t: m.t, id: m.id };
  }
  function pressRefuse() { const list = findTargets().filter((t) => t.kind === "cand"); if (list[0]) send({ a: "use", e: 1, t: "cand", id: list[0].n.i, refuse: 1 }); }
  function pressGrab() { const S = BB.v; if (!S || BB.role === "driver") return; const t = findTargets().find((x) => x.kind === "npc"); if (t) send({ a: "use", e: 1, t: "grab", id: t.n.i }); }

  // ---------- commandes tactiles ----------
  function buildTouch(H) {
    const coarse = ("ontouchstart" in window) || (window.matchMedia && window.matchMedia("(pointer: coarse)").matches); if (!coarse) return; BB.touch = true;
    const layer = el("div", { class: "bb-touch" }); H.appendChild(layer);
    const lookZone = el("div", { class: "bb-lookzone" }); layer.appendChild(lookZone); let lp = null;
    lookZone.addEventListener("pointerdown", (e) => { lp = { id: e.pointerId, x: e.clientX, y: e.clientY }; lookZone.setPointerCapture(e.pointerId); });
    lookZone.addEventListener("pointermove", (e) => { if (!lp || lp.id !== e.pointerId) return; look((e.clientX - lp.x) * 0.0045, (e.clientY - lp.y) * 0.0045); lp.x = e.clientX; lp.y = e.clientY; });
    const endLook = (e) => { if (lp && lp.id === e.pointerId) lp = null; }; lookZone.addEventListener("pointerup", endLook); lookZone.addEventListener("pointercancel", endLook);
    const stick = el("div", { class: "bb-stick" }); const knob = el("div", { class: "bb-knob" }); stick.appendChild(knob); layer.appendChild(stick); let sp = null;
    const setStick = (e) => { const r = stick.getBoundingClientRect(); let dx = e.clientX - (r.left + r.width / 2), dy = e.clientY - (r.top + r.height / 2); const m = Math.hypot(dx, dy), lim = r.width / 2; if (m > lim) { dx *= lim / m; dy *= lim / m; } knob.style.transform = "translate(" + dx + "px," + dy + "px)"; BB.mobile.mx = dx / lim; BB.mobile.mz = -dy / lim; };
    stick.addEventListener("pointerdown", (e) => { sp = e.pointerId; stick.setPointerCapture(sp); setStick(e); }); stick.addEventListener("pointermove", (e) => { if (sp === e.pointerId) setStick(e); });
    const endStick = (e) => { if (sp === e.pointerId) { sp = null; BB.mobile.mx = BB.mobile.mz = 0; knob.style.transform = ""; } }; stick.addEventListener("pointerup", endStick); stick.addEventListener("pointercancel", endStick);
    const btn = (txt, cls, down, up) => { const b = el("button", { class: "bb-tb " + cls, text: txt }); b.addEventListener("pointerdown", (e) => { e.preventDefault(); b.classList.add("on"); down(); }); const u = () => { b.classList.remove("on"); if (up) up(); }; b.addEventListener("pointerup", u); b.addEventListener("pointercancel", u); b.addEventListener("pointerleave", u); layer.appendChild(b); return b; };
    btn("Agir", "b1", () => { if (inGame()) pressUse(); }, () => { BB.hold = null; }); btn("Porter", "b2", () => { if (inGame()) pressGrab(); }); btn("Lâcher", "b3", () => { if (inGame()) send({ a: "drop" }); }); btn("Refuser", "b4", () => { if (inGame()) pressRefuse(); });
    const k = (code, on) => () => { if (on) BB.keys[code] = true; else delete BB.keys[code]; };
    const d1 = btn("Accélérer", "d1", k("KeyW", 1), k("KeyW", 0)), d2 = btn("Freiner", "d2", k("KeyS", 1), k("KeyS", 0)), d3 = btn("Gauche", "d3", k("KeyA", 1), k("KeyA", 0)), d4 = btn("Droite", "d4", k("KeyD", 1), k("KeyD", 0)), d5 = btn("Klaxon", "d5", () => { if (inGame()) send({ a: "horn" }); });
    BB.touchDrv = [d1, d2, d3, d4, d5]; BB.touchOnly = [stick]; document.body.classList.add("bb-touch-on");
  }


  // envois réguliers, indépendants de l'affichage pour rester fluides même quand l'image rame
  let netLast = performance.now(), netN = 0;
  function netTick() {
    const now = performance.now(); const dt = Math.min(0.2, (now - netLast) / 1000); netLast = now; netN++;
    if (!BB.v || !BB.init || !Kit.socket || BB.over || document.body.dataset.screen !== "game") return;
    const p = BB.pos, b = BB.bus; if (!b) return;
    Kit.socket.emit("bb:pos", { x: +p.x.toFixed(2), z: +p.z.toFixed(2), yaw: +p.yaw.toFixed(3), vx: +p.vx.toFixed(2), vz: +p.vz.toFixed(2) });
    if (BB.role === "driver") {
      const up = holdKey("KeyW") || holdKey("ArrowUp"), dn = holdKey("KeyS") || holdKey("ArrowDown") || holdKey("Space");
      const rev = dn && !up && Math.abs(b.v) < 1.2 && !holdKey("Space"); const want = ((holdKey("KeyD") || holdKey("ArrowRight")) ? 1 : 0) - ((holdKey("KeyA") || holdKey("ArrowLeft")) ? 1 : 0) + BB.mobile.sx;
      // volant progressif, il se tourne peu à peu et revient seul au centre
      const grow = 1.5 * BB.wheel, back = 3.2; const tgt = clamp(want, -1, 1); const diff = tgt - BB.steerV; const rate = (tgt !== 0 && Math.sign(tgt) === Math.sign(BB.steerV || tgt) && Math.abs(tgt) >= Math.abs(BB.steerV)) ? grow : back; BB.steerV += clamp(diff, -rate * dt, rate * dt); const steer = Math.abs(BB.steerV) < 0.02 ? 0 : BB.steerV;
      Kit.socket.emit("bb:drive", { steer, thr: up || rev ? 1 : 0, brk: dn && !rev ? 1 : 0, rev: rev ? 1 : 0 });
    }
    if (BB.hold && netN % 2 === 0) send({ a: "use", e: 0, t: BB.hold.t, id: BB.hold.id });
  }
  setInterval(netTick, 60);

  // ---------- boucle ----------
  const holdKey = (c) => !!BB.keys[c];
  function loop(now) { requestAnimationFrame(loop); PicuiteGL.frame(() => body(now)); }
  function body(now) {
    const dt = Math.min(0.1, (now - BB.last) / 1000); BB.last = now; BB.fps = BB.fps ? BB.fps * 0.95 + (1 / Math.max(0.001, dt)) * 0.05 : 30;
    if (!scene || !BB.v || !BB.init || document.body.dataset.screen !== "game") return;
    const S = BB.v; const open = S.ph === "stop" && S.b.dr;
    // le bus
    const tb = BB.tb, b = BB.bus; BB.age += dt;
    const ps = tb.s + Math.cos(tb.psi) * tb.v * BB.age, pe = tb.e + Math.sin(tb.psi) * tb.v * BB.age; const k = 1 - Math.exp(-dt * 9);
    if (Math.abs(ps - b.s) > 25) { b.s = ps; b.e = pe; } else { b.s += (ps - b.s) * k; b.e += (pe - b.e) * k; }
    ["psi", "v", "w", "sh", "al", "ay", "gu"].forEach((f) => { b[f] += (tb[f] - b[f]) * k; });
    ["tp", "hl", "tr", "lk", "dr", "rr", "sl", "of", "sk", "hn", "th", "bk"].forEach((f) => { b[f] = tb[f]; });
    const pose = BBWorld.pose(W, b); BB.pose = pose;
    // déplacements du joueur
    const p = BB.pos; const driver = BB.role === "driver"; const heldNpc = BB.held.indexOf("npc") === 0;
    if (driver) { p.x = L.DRIVER.x; p.z = L.DRIVER.z; p.vx = p.vz = 0; if (holdKey("ArrowLeft") && false) look(-dt, 0); }
    else {
      if (holdKey("ArrowLeft") && !driver) look(-1.9 * dt / BB.sens, 0); if (holdKey("ArrowRight") && !driver) look(1.9 * dt / BB.sens, 0);
      let f = (holdKey("KeyW") || holdKey("ArrowUp") ? 1 : 0) - (holdKey("KeyS") || holdKey("ArrowDown") ? 1 : 0) + BB.mobile.mz, s = (holdKey("KeyD") ? 1 : 0) - (holdKey("KeyA") ? 1 : 0) + BB.mobile.mx;
      if (BB.tumble) { f = 0; s = 0; }
      const m = Math.hypot(f, s); if (m > 1) { f /= m; s /= m; }
      const sp = (holdKey("ShiftLeft") || holdKey("ShiftRight") ? 3.6 : 2.4) * (heldNpc ? 0.7 : 1);
      const fx = Math.sin(p.yaw), fz = Math.cos(p.yaw), rx = Math.cos(p.yaw), rz = -Math.sin(p.yaw);
      const tx = (fx * f + rx * s) * sp, tz = (fz * f + rz * s) * sp; const a = Math.min(1, dt * 9);
      p.vx += (tx - p.vx) * a; p.vz += (tz - p.vz) * a;
      if (S.ph === "drive" || true) { p.vx -= tb.ay * 0.09 * dt * 8 * (BB.tumble ? 1.5 : 1) * 0.2; p.vz += -tb.al * 0.07 * dt * 8 * 0.2; }
      const ox = p.x, oz = p.z; const c = L.collide(p.x + p.vx * dt, p.z + p.vz * dt, 0.28, open); p.x = c.x; p.z = c.z;
      if (S.ph !== "stop" && p.x > L.BUS.x1 + 0.1) { p.x = 0.2; p.z = L.DOOR.z; }
      const rvx = (p.x - ox) / Math.max(dt, 0.001), rvz = (p.z - oz) / Math.max(dt, 0.001); p.vx = Math.abs(rvx - p.vx) > 1.5 ? rvx : p.vx; p.vz = Math.abs(rvz - p.vz) > 1.5 ? rvz : p.vz;
    }
    // le bus dans le monde
    busG.position.set(pose.x, 0.55, pose.z); busG.rotation.y = pose.h; const t = performance.now() / 1000;
    const shk = b.sh * 0.012 + BB.shake * 0.02; busG.position.y += Math.sin(t * 41) * shk; busG.rotation.x = clamp(-b.al * 0.004, -0.05, 0.05) + Math.sin(t * 29) * shk * 0.4; busG.rotation.z = clamp(b.ay * 0.004, -0.06, 0.06) + Math.sin(t * 33) * shk * 0.4;
    const door = bus.door; door.position.z += ((b.dr ? 5.95 : 4.6) - door.position.z) * Math.min(1, dt * 4); bus.rear.rotation.y += ((b.rr ? 1.65 : 0) - bus.rear.rotation.y) * Math.min(1, dt * 3);
    bus.wheel.rotation.z += (-b.w * 1.7 - bus.wheel.rotation.z) * Math.min(1, dt * 10);
    BB.gaugeT = (BB.gaugeT || 0) - dt; if (BB.gaugeT <= 0) { BB.gaugeT = 0.2; const dr = Object.keys(BB.players).map((i) => BB.players[i]).find((q) => q.role === "driver"); bus.gauge.draw(b, dr ? dr.name : ""); bus.dest.draw(S.st.nm || S.st.cur || ""); }
    // quai
    if (S.ph === "stop" && platFor !== S.st.i) { if (platG) flip.remove(platG); platG = new T.Group(); platG.add(BBBus.platform(S.st.cur || "Arrêt")); platG.position.copy(busG.position); platG.position.y = 0.55; platG.rotation.y = pose.h; platG.userData.s = b.s; flip.add(platG); platFor = S.st.i; }
    if (platG && Math.abs(b.s - platG.userData.s) > 90 && S.ph !== "stop") { flip.remove(platG); platG = null; }
    // contexte pour les entités
    const holderPos = (id) => { if (id === BB.me) return { x: p.x, z: p.z, y: p.yaw }; const o = E.pl[id]; return o ? { x: o.x, z: o.z, y: o.y } : null; };
    const C = { me: BB.me, npc: BB.npc, players: BB.players, assist: BB.assist, myPos: p, holderPos, holderOf: (key) => { const q = S.p.find((x) => x.h === key); return q ? holderPos(q.i) : null; } };
    BBEnt.sync(E, S, C, dt);
    // l'objet tenu en main
    const ht = BB.held.indexOf("item") === 0 ? S.it.find((i) => "item" + i.i === BB.held) : null; const hk = ht ? ht.t + "|" + ht.c + "|" + ht.tg : "";
    if (hk !== BB.handKey) { BB.handKey = hk; while (handG.children.length) handG.remove(handG.children[0]); if (ht) { const g = BBBus.item(ht.t, { c: ht.c, tg: ht.tg, hp: ht.hp }); g.scale.setScalar(ht.t === "crate" ? 0.8 : 1); g.rotation.y = -0.4; handG.add(g); } }
    // la caméra
    BB.shake = Math.max(0, BB.shake - dt * 1.6); BB.hurt = Math.max(0, BB.hurt - dt); BB.flash = Math.max(0, BB.flash - dt * 2.2);
    BB.roll += ((BB.tumble ? 0.9 : 0) - BB.roll) * Math.min(1, dt * 5);
    const walk = Math.hypot(p.vx, p.vz); BB.bob = (BB.bob || 0) + walk * dt * 3.2;
    const eyeY = (driver ? 1.42 : 1.62) - BB.roll * 0.9 + Math.sin(BB.bob) * 0.022 * Math.min(1, walk) + (E ? BBEnt.gy(p.x) : 0);
    busG.updateMatrixWorld(true);
    const eye = new T.Vector3(p.x, eyeY, driver ? p.z - 0.12 : p.z), dirL = new T.Vector3(Math.sin(p.yaw) * Math.cos(p.pitch), Math.sin(p.pitch), Math.cos(p.yaw) * Math.cos(p.pitch));
    const eyeW = eye.clone().applyMatrix4(busG.matrixWorld), tgtW = eye.clone().add(dirL).applyMatrix4(busG.matrixWorld);
    camera.position.copy(eyeW); camera.up.set(0, 1, 0).transformDirection(busG.matrixWorld); camera.lookAt(tgtW); if (BB.roll) camera.rotateZ(BB.roll);
    // le monde
    const at = W.R.at(b.s); BBWorld.syncObst(W, { b, go: S.go, mv: S.mv }, dt); BBWorld.weather(W, at.wx, dt, b, eyeW);
    W.sun.position.set(eyeW.x + 40, 70, eyeW.z - 20); W.sun.target.position.copy(eyeW);
    renderer.render(scene, camera); PicuiteGL.verify(renderer);
    BB.hudT -= dt; if (BB.hudT <= 0) { BB.hudT = 0.12; updateHud(S, b, at, t); }
    hud.hurt.style.opacity = String(Math.min(1, BB.hurt)); hud.flash.style.opacity = String(BB.flash * 0.8);
  }

  // ---------- interface ----------
  const setKids = (node, key, build) => { node._k = node._k || ""; if (node._k === key) return; node._k = key; node.textContent = ""; build().forEach((n) => { if (n) node.appendChild(n); }); };
  const bar = (v, cls) => el("div", { class: "bb-bar " + (cls || "") }, [el("i", { style: { width: Math.round(clamp(v, 0, 1) * 100) + "%" } })]);
  const lvl = (v, lo, hi) => (v < lo ? "bad" : v < hi ? "warn" : "");
  function curveHint(b) { const cs = [W.R.at(b.s + 18).curv, W.R.at(b.s + 40).curv, W.R.at(b.s + 70).curv]; const c = Math.abs(cs[0]) > Math.abs(cs[1]) ? cs[0] : cs[1]; const m = Math.abs(c) > Math.abs(cs[2]) ? c : cs[2]; return m; }
  function updateHud(S, b, at, t) {
    const role = L.ROLES.find((r) => r.id === BB.role) || L.ROLES[0]; const R_ = W.R;
    setKids(hud.role, role.id, () => [el("div", { class: "ic", text: role.icon }), el("div", {}, [el("b", { text: role.label }), el("small", { text: "Ton poste" })])]);
    // état du bus et du voyage
    const onb = S.n.filter((n) => !["wait", "leave", "ejected", "carried"].includes(n.s) || n.s === "carried").length;
    const rows = [["💰", S.sc.m + " pièces"], ["👥", onb + " à bord, " + S.sc.dl + " colis livrés"]];
    setKids(hud.stats, [S.sc.m, onb, S.sc.dl, Math.round(S.sc.r / 5), Math.round(b.hl / 5), Math.round(b.tp / 5)].join("|"), () => [
      el("div", { class: "bb-row" }, [el("span", { text: "💰 " + S.sc.m + " pièces" }), el("span", { text: "👥 " + onb })]),
      el("div", { class: "bb-row" }, [el("span", { text: "⭐ Réputation" }), el("span", { text: Math.round(S.sc.r) })]), bar(S.sc.r / 100, lvl(S.sc.r, 30, 60)),
      el("div", { class: "bb-row" }, [el("span", { text: "🚌 Carrosserie" }), el("span", { text: Math.round(b.hl) })]), bar(b.hl / 100, lvl(b.hl, 35, 65)),
      el("div", { class: "bb-row" }, [el("span", { text: "🌡️ Moteur" }), el("span", { text: Math.round(b.tp) + " degrés" })]), bar((b.tp - 40) / 90, b.tp > 105 ? "bad" : b.tp > 88 ? "warn" : ""),
      el("div", { class: "bb-row" }, [el("span", { text: "📦 Colis livrés" }), el("span", { text: S.sc.dl })]),
    ]);
    // haut de l'écran
    const st = S.st; const legs = BB.init.legs; const wx = WX[at.wx]; const sf = SURF[at.surf];
    const from = R_.stops[st.i] ? R_.stops[st.i].s : 0, to = R_.stops[st.nx] ? R_.stops[st.nx].s : from + 1; const frac = clamp((b.s - from) / Math.max(1, to - from), 0, 1);
    const stopMsg = S.ph === "stop" ? (BB.role === "driver" ? "Attends que l'équipage ait choisi les passagers et rangé les colis, puis appuie sur E pour repartir." : "Va sur le quai choisir les candidats au voyage et les colis. Le conducteur repart quand tout est prêt.") : "";
    setKids(hud.top, [S.ph, st.ann, st.i, st.nx, Math.round(st.d / 10), Math.round(frac * 50), at.wx, at.surf, BB.role].join("|"), () => S.ph === "stop"
      ? [el("b", { text: "🚏 Arrêt " + (st.cur || "") }), el("small", { text: "Étape " + Math.min(legs, st.i + 1) + " sur " + legs + (st.i >= legs ? ", c'est le terminus" : "") + (st.ann >= 0 ? "  ·  Départ annoncé dans " + st.ann + " s" : "") }), el("small", { text: stopMsg })]
      : [el("b", { text: "➡️ " + (st.nm || "Terminus") }), el("small", { text: Math.max(0, st.d) + " m  ·  " + wx.icon + " " + wx.label + "  ·  " + sf.label }), el("div", { class: "bb-road" }, [el("i", { style: { width: Math.round(frac * 100) + "%" } })])]);
    // tableau de bord
    const kmh = Math.round(Math.abs(b.v) * 3.6); const cv = curveHint(b); const dz = st.d - 70;
    setKids(hud.dash, [kmh, Math.round(cv * 4000), b.sl, Math.round((SURF[at.surf].grip * WX[at.wx].grip) * 10),  S.ph, Math.round(st.d / 5), BB.role === "driver" ? 1 : 0, b.tr, b.lk, b.of].join("|"), () => {
      const kids = [el("div", { class: "bb-speed" }, [document.createTextNode(String(kmh)), el("small", { text: " km/h" })])];
      if (BB.role === "driver") {
        if (S.ph === "drive") {
          const mag = Math.abs(cv); const dir = cv > 0 ? "à droite" : "à gauche";
          kids.push(el("div", { class: "bb-row", text: mag > 0.0045 ? (mag > 0.011 ? "⚠️ Virage serré " + dir : "↪ Virage " + dir) : "Route droite" }));
          const grip = SURF[at.surf].grip * WX[at.wx].grip; let cmax = 0.0001; [8, 28, 50, 75].forEach((o) => { cmax = Math.max(cmax, Math.abs(W.R.at(b.s + o).curv)); }); const rec = Math.min(100, Math.round(Math.sqrt(8.2 * grip * 0.75 / cmax) * 3.6));
          kids.push(el("div", { class: "bb-row" + (kmh > rec * 1.12 ? " warnrow" : ""), text: "Vitesse conseillée " + rec + " km/h" }));
          if (b.sl) kids.push(el("div", { class: "bb-row", text: "🛞 Le bus dérape, relâche l'accélérateur" }));
          if (b.of) kids.push(el("div", { class: "bb-row", text: "🌾 Tu es hors de la route" }));
          if (st.nx <= legs) kids.push(el("div", { class: "bb-row", text: dz > 0 ? "🛑 Zone d'arrêt dans " + dz + " m" : st.d > 6 ? "🛑 Arrête-toi maintenant" : "🛑 Arrêt dépassé" }));
        }
      }
      return kids;
    });
    // alertes
    const al = []; const z = (v) => ZONE(v);
    if (b.rr) al.push({ ic: "🚪", t: "Porte de secours ouverte" });
    if (b.tp > 100) al.push({ ic: "🌡️", t: "Le moteur surchauffe", hot: 1 }); if (b.tr) al.push({ ic: "🛞", t: "Pneu crevé, trappe du moteur", hot: 1 }); if (b.lk) al.push({ ic: "💧", t: "Fuite du radiateur, trappe du moteur", hot: 1 });
    if (b.hl < 35) al.push({ ic: "💥", t: "Carrosserie très abîmée", hot: 1 });
    S.hz.forEach((h) => al.push({ ic: h.t === "fire" ? "🔥" : "💦", t: (h.t === "fire" ? "Feu " : "Flaque ") + z(h.z), hot: h.t === "fire" }));
    const needs = S.n.filter((n) => (n.nd || n.tr) && BB.npc[n.i] && n.s !== "wait" && n.s !== "leave").sort((a, c) => (a.nd ? a.nf : 0.5) - (c.nd ? c.nf : 0.5)).slice(0, 5);
    needs.forEach((n) => { const N = n.nd ? L.NEEDS[n.nd] : null; al.push({ ic: N ? N.icon : "😡", t: BB.npc[n.i].nm + (N ? " " + N.label : " fait des bêtises") + ", " + z(n.z), pct: N ? n.nf : 0.4, hot: N ? n.nf < 0.25 : 1 }); });
    if (S.ph === "stop") { const cands = S.n.filter((n) => n.s === "wait").length, crates = S.it.filter((i) => i.t === "crate" && (i.s === "wait" || i.s === "plat")).length; if (cands || crates) al.push({ ic: "🧳", t: cands + " candidat" + (cands > 1 ? "s" : "") + " et " + crates + " colis sur le quai" }); }
    setKids(hud.alerts, al.map((a) => a.t + (a.pct != null ? Math.round(a.pct * 10) : "")).join("#"), () => al.slice(0, 8).map((a) => el("div", { class: "bb-alert" + (a.hot ? " hot" : "") }, [el("span", { class: "ic", text: a.ic }), el("span", { class: "t", text: a.t }), a.pct != null ? el("span", { class: "m" }, [el("i", { style: { width: Math.round(clamp(a.pct, 0, 1) * 100) + "%" } })]) : null])));
    // journal
    const nowMs = performance.now(); const live = BB.feed.filter((m) => nowMs - m.t < 11000).slice(window.innerHeight < 560 ? -3 : -7);
    setKids(hud.feed, live.map((m) => m.t).join(","), () => live.map((m) => el("div", { class: "bb-msg " + m.kind, text: m.text })));
    // invite d'action
    const list = findTargets(); const top = list[0]; const dsc = top ? describe(top) : null;
    const showHold = BB.hold && BB.holdProg > 0;
    setKids(hud.prompt, (dsc ? dsc.text + (dsc.info || "") : "") + (showHold ? BB.holdProg : "") + (BB.tumble ? "t" : ""), () => {
      if (BB.tumble) return [el("div", { class: "pill", text: "Tu es tombé, attends de te relever" })];
      const k = [];
      if (dsc && dsc.text) k.push(el("div", { class: "pill" + (dsc.hint ? " soft" : "") , text: dsc.text }));
      if (dsc && dsc.info) k.push(el("div", { class: "pill info", text: dsc.info }));
      if (showHold) k.push(el("div", { class: "bb-prog" }, [el("i", { style: { width: BB.holdProg + "%" } })]));
      return k;
    });
    const held = BB.held; let hl = "";
    if (held.indexOf("item") === 0) { const it = S.it.find((i) => "item" + i.i === held); if (it) hl = "Tu portes " + (it.c ? L.CARGO[it.c].label.toLowerCase() : L.ITEMS[it.t].label.toLowerCase()) + ". G pour le poser, T pour le lancer"; } else if (held.indexOf("npc") === 0) hl = "Tu portes un passager. G pour le poser, devant une porte ouverte il sera éjecté";
    setKids(hud.heldbox, hl, () => hl ? [el("span", { text: hl })] : []); hud.heldbox.style.display = hl ? "" : "none";
    const keys = BB.touch ? "Stick pour marcher, glisse pour regarder" : (BB.role === "driver" ? "Z S accélérer et freiner  ·  Q D tourner  ·  Espace frein  ·  H klaxon  ·  E porte et départ" : "ZQSD ou flèches marcher  ·  Souris regarder  ·  Maj courir  ·  E agir  ·  F porter  ·  G poser  ·  T lancer");
    setKids(hud.help, keys, () => [el("span", { text: keys })]);
    hud.cross.style.display = BB.role === "driver" && false ? "none" : "";
  }

  function showEnd(ov) {
    hud.end.classList.remove("hidden"); hud.end.innerHTML = "";
    const st = ov.stats || {}; const mins = Math.floor((ov.t || 0) / 60), secs = (ov.t || 0) % 60;
    const lines = [["💰 Pièces gagnées", ov.money], ["⭐ Réputation", ov.rep], ["🚌 Carrosserie", ov.hull], ["👥 Passagers transportés", st.carried || 0], ["📦 Colis livrés", st.delivered || 0], ["🛫 Éjectés", st.ejected || 0], ["💥 Chocs", st.crashes || 0], ["🔥 Feux", st.fires || 0], ["🕒 Durée", mins + " min " + secs + " s"]];
    const stars = ov.win ? "★".repeat(ov.stars) + "☆".repeat(5 - ov.stars) : "☆☆☆☆☆";
    const card = el("div", { class: "card" }, [el("h2", { text: ov.win ? "Terminus atteint" : "Voyage terminé" }), el("p", { text: ov.win ? "Le bus est arrivé à bon port, plus ou moins entier." : (ov.why || "Le voyage s'arrête ici.") }), el("div", { class: "bb-stars", text: stars }),
      el("div", { class: "bb-endlines" }, lines.map((l) => el("div", { class: "bb-row" }, [el("span", { text: l[0] }), el("b", { text: String(l[1]) })]))),
      el("div", { class: "bb-endbtn" }, [Kit.isHost() ? el("button", { class: "btn btn--accent", text: "Retour au salon", onclick: () => Kit.backToLobby() }) : el("p", { class: "muted small", text: "L'hôte peut ramener tout le monde au salon." }), el("button", { class: "btn btn--ghost", text: "Quitter", onclick: () => Kit.leave() })])]);
    hud.end.appendChild(card); sound.win(); try { document.exitPointerLock(); } catch (e) { /* rien */ }
  }

  function openMenu() {
    const row = (title, info, control) => el("div", { class: "menu-row" }, [el("div", {}, [el("b", { text: title }), el("p", { class: "small muted", text: info })]), control]);
    const sens = el("input", { type: "range", min: "0.4", max: "2.5", step: "0.1", value: String(BB.sens) }); sens.oninput = () => { BB.sens = Number(sens.value); store.set("bb.sens", String(BB.sens)); };
    const wh = el("input", { type: "range", min: "0.5", max: "2.5", step: "0.1", value: String(BB.wheel) }); wh.oninput = () => { BB.wheel = Number(wh.value); store.set("bb.wheel", String(BB.wheel)); };
    const sbtn = el("button", { class: "btn btn--small btn--ghost", text: sound.enabled ? "Son activé" : "Son coupé", onclick: (ev) => { ev.target.textContent = sound.toggle() ? "Son activé" : "Son coupé"; } });
    const cbtn = el("button", { class: "btn btn--small btn--ghost", text: PicuiteGL.compat() ? "Compatibilité activée" : "Compatibilité coupée", onclick: () => PicuiteGL.setCompat(!PicuiteGL.compat()) });
    const keys = el("div", { class: "keys" }, [
      el("kbd", { text: "Z Q S D" }), el("span", { text: "Marcher dans le bus. Sur un clavier QWERTY ce sont W A S D, les flèches marchent aussi. Le conducteur accélère avec la touche du haut, freine avec celle du bas et tourne avec les côtés." }),
      el("kbd", { text: "Souris" }), el("span", { text: "Regarder autour de soi. Clique dans la scène pour capter la souris, Échap pour la libérer. Un clic agit comme la touche E, ou joue le klaxon pour le conducteur." }),
      el("kbd", { text: "E" }), el("span", { text: "Agir sur ce que tu vises. Reste appuyé pour calmer, éteindre un feu ou réparer le moteur." }),
      el("kbd", { text: "F" }), el("span", { text: "Porter un passager, par exemple un fauteur de trouble ou un dormeur." }),
      el("kbd", { text: "G et T" }), el("span", { text: "Poser ce que tu tiens, ou le lancer. À une porte ouverte, poser un passager l'éjecte." }),
      el("kbd", { text: "R" }), el("span", { text: "Refuser un candidat au voyage sur le quai." }),
      el("kbd", { text: "1 2 3" }), el("span", { text: "Au chariot, choisir casse-croûte, boisson ou serpillière." }),
      el("kbd", { text: "Maj" }), el("span", { text: "Courir, mais attention aux virages." }),
      el("kbd", { text: "H" }), el("span", { text: "Klaxon du conducteur, il fait fuir les animaux." }),
      el("kbd", { text: "E (conducteur)" }), el("span", { text: "À l'arrêt, ferme la porte et lance le départ." }),
    ]);
    Kit.showModal("Réglages", [row("Sensibilité de la souris", "Vitesse de rotation de la vue. Plus haut tourne plus vite.", sens), row("Vitesse du volant", "Pour le conducteur. Plus haut, le volant tourne plus vite quand tu gardes une touche appuyée. Il revient seul au centre quand tu la relâches.", wh), row("Son", "Active ou coupe les bruitages.", sbtn),
      row("Mode compatibilité", "Affichage 3D le plus simple possible, sans ombres ni reflets. À essayer si l'écran reste blanc ou si le jeu rame.", cbtn),
      el("h3", { text: "Commandes", style: { marginTop: "0.8rem" } }), keys,
      el("button", { class: "btn btn--danger btn--small", style: { marginTop: "0.8rem" }, text: "Quitter la partie", onclick: () => Kit.confirm("Quitter la partie et revenir à l'accueil ?", () => { $("#modal").classList.add("hidden"); Kit.leave(); }) })]);
  }

  Kit.on("reset", () => { stopScene(); BB.v = null; BB.init = null; BB.over = null; try { document.exitPointerLock(); } catch (e) { /* rien */ } });
  Kit.on("room", (r) => { if (r.status === "lobby") { stopScene(); BB.v = null; BB.init = null; BB.over = null; if (hud.end) hud.end.classList.add("hidden"); try { document.exitPointerLock(); } catch (e) { /* rien */ } } });
  Kit.on("screen", (name) => { if (name === "game") { if (!built) buildGame(); setTimeout(resize, 50); if (hud.click && !BB.touch) hud.click.style.display = ""; } });
  window.BusBazar = BB;
  Kit.init({
    id: "bus-bazar", title: "Bus Bazar", emoji: "🚌", ribbon: "Un bus, des passagers, zéro contrôle", tagline: "Un voyage en 3D dans un bus bondé, où chacun a son poste et rien ne se passe comme prévu.",
    createLabel: "Créer un équipage", soloLabel: "Jouer seul", startLabel: "Prendre la route", helpTitle: "Comment jouer", noBots: true,
    floaters: [{ e: "🚌", x: 6 }, { e: "🐔", x: 20 }, { e: "🧰", x: 34 }, { e: "🧳", x: 48 }, { e: "📣", x: 62 }, { e: "🐄", x: 76 }, { e: "🥖", x: 90 }],
    colors: COLORS, botLevels: [{ id: "habile", label: "Habile" }], maxPlayers: 4, minPlayers: 1, schema: R.SCHEMA,
    help: [
      { title: "Le but", text: "Mener un bus et ses passagers de station en station jusqu'au terminus, en 3D, à la première personne. À chaque arrêt on choisit qui monte et quels colis chargent. En route il faut nourrir, rassurer, réparer et garder le bus sur la route." },
      { title: "Les quatre postes", text: "Le conducteur reste au volant, conduit, klaxonne et ouvre ou ferme la porte. L'hôtesse ou steward sert les repas et les boissons, rassure les passagers et choisit qui monte à l'arrêt. Le mécano répare le moteur et les pneus et éteint les feux. Le bagagiste choisit et range les colis, rattrape les poulets et sort les fauteurs de trouble. Les postes sans joueur sont tenus par des robots." },
      { title: "Se déplacer et agir", text: "On marche dans le bus avec ZQSD ou les flèches, et on regarde à la souris. Une invite en bas de l'écran dit ce que la touche E fait sur ce que tu vises. Reste appuyé sur E pour calmer quelqu'un, éteindre un feu ou réparer le moteur. F porte un passager, G pose ce que tu tiens, T le lance." },
      { title: "Aux arrêts", text: "Le conducteur s'arrête dans la zone d'arrêt. L'équipage descend sur le quai, lit la fiche de chaque candidat, accepte ou refuse avec R, puis charge les colis et les range dans le bus. Le conducteur referme la porte quand tout le monde est monté, et personne ne doit rester dehors." },
      { title: "En route", text: "Les passagers ont faim, soif, peur, besoin de leur valise ou envie de descendre. Une icône et une barre apparaissent au-dessus de leur tête, et la liste en haut à droite dit où aller. Les virages serrés, les nids de poule, la pluie et le vent secouent tout le monde, même les colis." },
      { title: "Les colis", text: "Chaque colis paie à l'arrivée à la bonne destination. Les poulets s'échappent si la caisse est secouée, les feux d'artifice craignent les flammes, le fût de cidre fuit, la statue se brise et le piano glisse partout. Range-les dans le porte-bagages ou sur les emplacements jaunes du fond." },
      { title: "Les fauteurs de trouble", text: "Un farceur ou un fêtard peut jeter des objets, ouvrir la porte de secours ou embêter ses voisins. Maintiens E pour le calmer, ou porte-le avec F jusqu'à une porte ouverte pour l'éjecter. C'est drôle mais cela coûte de la réputation si la personne n'avait rien fait." },
      { title: "Réussir", text: "La note de une à cinq étoiles dépend de la réputation, de l'état du bus, de l'argent gagné et du nombre de passagers transportés. Le voyage se perd si la réputation tombe à zéro ou si le bus est en miettes." },
    ],
    theme: { a1: "#ffd23f", a2: "#f08a24", bg1: "#2a4a7a", bg2: "#10203a" },
    renderPreview,
    onInit() { buildGame(); attach(); Kit.on("connect", attach); requestAnimationFrame(loop); },
  });
})();

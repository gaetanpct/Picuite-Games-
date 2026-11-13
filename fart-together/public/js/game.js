// ============================================================
// FART TOGETHER — Interface de jeu (client)
// Le serveur simule. Ici on envoie la visée et le bouton, on interpole et on dessine.
// ============================================================
(function () {
  const { el, $, toast, sound } = Kit;
  const R = FTRules, S = window.FTScene;
  const COLORS = [
    { name: "Fraise", hex: "#ff5fa8" }, { name: "Citron", hex: "#ffd23f" }, { name: "Menthe", hex: "#2fe0a8" }, { name: "Raisin", hex: "#a56bff" },
    { name: "Mandarine", hex: "#ff8a1f" }, { name: "Kiwi", hex: "#7ed957" }, { name: "Myrtille", hex: "#3d8bff" }, { name: "Piment", hex: "#ff4b3e" },
  ];
  const ABS = { costaud: ["💪", "Costaud", "Pousse plus fort, mais le réservoir se vide vite."], endurant: ["🫁", "Endurant", "Un gros réservoir, une poussée un peu plus faible."], rafale: ["💨", "Rafale", "Monte en puissance très vite. Le modèle équilibré."], stabilo: ["⚖️", "Stabilisateur", "Fait moins pencher la bouée, poussée légèrement réduite."] };
  const HAT_REQ = [0, 0, 0, 0, 3, 6, 10, 15, 22, 30, 40, 55], FACE_REQ = [0, 0, 0, 0, 5, 9, 14, 20];
  const MODE_NAMES = { aventure: "Aventure", chrono: "Contre-la-montre", course: "Course", survie: "Survie", infini: "Parcours infini", defis: "Défis", arene: "Arène", quotidien: "Défi du jour" };
  const G = { st: null, over: null, level: null, levelIdx: -1, snaps: [], inp: { a: 0, p: false, kb: 0, kbUsed: false, sent: 0, lastSent: null }, attached: false, lastKey: "", prog: null, built: false, lastAnim: 0, hud: {}, pushed: {}, lastFartSnd: {}, banner: null, go: false, count: -1 };

  // ---------- progression locale ----------
  function loadProg() { try { const p = JSON.parse(localStorage.getItem("ft.prog") || "null"); if (p && typeof p === "object") return Object.assign({ runs: 0, stars: 0, push: 0, best: {}, daily: {}, hat: 0, face: 0, ab: "rafale" }, p); } catch (e) { /* rien */ } return { runs: 0, stars: 0, push: 0, best: {}, daily: {}, hat: 0, face: 0, ab: "rafale" }; }
  function saveProg() { try { localStorage.setItem("ft.prog", JSON.stringify(G.prog)); } catch (e) { /* rien */ } }
  const points = () => G.prog.runs + G.prog.stars * 2;
  const hatOk = (i) => points() >= HAT_REQ[i], faceOk = (i) => points() >= FACE_REQ[i];

  const myId = () => { const p = Kit.me(); return p ? p.id : null; };
  const pl = (id) => (Kit.room ? Kit.room.players.find((p) => p.id === id) : null);
  const nameOf = (id) => { const p = pl(id); return p ? p.name : "?"; };
  const hexOf = (id) => { const p = pl(id); return COLORS[((p && p.color) || 0) % COLORS.length].hex; };
  const dot = (id) => el("i", { class: "dotc", style: { background: hexOf(id) }, title: nameOf(id) });
  const fmtT = (t) => { if (t === null || t === undefined) return "-"; if (t < 60) return t.toFixed(1).replace(".", ",") + " s"; const m = Math.floor(t / 60); return m + " min " + String(Math.floor(t % 60)).padStart(2, "0") + " s"; };
  const secs = (ms) => Math.max(0, Math.ceil(ms / 1000));
  const sfxOn = () => !G.st || G.st.sfx !== false;
  const sfx = (f) => { if (sfxOn()) f(); };

  // ---------- sons ----------
  function fartSound(power, mine) {
    sfx(() => {
      const base = 70 + Math.random() * 90 + power * 40, dur = 0.12 + Math.random() * 0.18 + power * 0.1, v = mine ? 0.13 : 0.06;
      sound.tone(base, dur, "sawtooth", v, 0, base * (0.45 + Math.random() * 0.3)); sound.tone(base * 1.5, dur * 0.7, "square", v * 0.4, 0.01, base * 0.7); sound.noise(dur * 0.8, v * 0.8, 0, 700);
      if (Math.random() < 0.3) sound.tone(base * 2.2, 0.05, "square", v * 0.3, dur * 0.8, base);
    });
  }
  const sSplash = () => sfx(() => { sound.noise(0.35, 0.12, 0, 2600); sound.tone(220, 0.2, "sine", 0.06, 0, 90); });
  const sBump = () => sfx(() => { sound.tone(120, 0.15, "square", 0.1, 0, 60); sound.noise(0.1, 0.1, 0, 900); });
  const sCoin = () => sfx(() => { sound.tone(988, 0.07, "triangle", 0.09); sound.tone(1319, 0.14, "triangle", 0.09, 0.06); });
  const sCap = () => sfx(() => { sound.tone(400, 0.5, "sawtooth", 0.09, 0, 70); sound.noise(0.5, 0.14, 0.05, 1800); });
  const sFinish = () => sfx(() => { [523, 659, 784, 1047, 1319].forEach((f, i) => sound.tone(f, 0.22, "triangle", 0.11, i * 0.09)); });
  const sChaos = () => sfx(() => { sound.tone(300, 0.1, "square", 0.07); sound.tone(500, 0.1, "square", 0.07, 0.1); sound.tone(300, 0.1, "square", 0.07, 0.2); });
  const sBeep = (hi) => sfx(() => sound.tone(hi ? 880 : 440, hi ? 0.4 : 0.16, "triangle", 0.12));

  // ---------- squelette ----------
  function build() {
    const sc = $("#screen-game"); sc.innerHTML = "";
    const view = el("div", { class: "ft-view", id: "ft-view" }); sc.appendChild(view);
    sc.appendChild(el("div", { class: "ft-hud hidden", id: "ft-hud" }));
    sc.appendChild(el("div", { class: "ft-panel hidden", id: "ft-panel" }));
    sc.appendChild(el("button", { class: "round-btn ft-menu", title: "Menu", text: "⚙️", onclick: openMenu }));
    G.noGL = !S.init(view);
    if (G.noGL) { view.classList.add("ft-nogl"); view.appendChild(el("p", { class: "ft-nogl__txt", text: "L'affichage 3D n'est pas disponible sur cet appareil. Le jeu reste jouable mais sans image de la rivière." })); }
    bindInput(view); requestAnimationFrame(loop); G.built = true;
  }
  function openMenu() {
    const sbtn = el("button", { class: "btn btn--small btn--ghost", text: sound.enabled ? "Son activé" : "Son coupé", onclick: (ev) => { ev.target.textContent = sound.toggle() ? "Son activé" : "Son coupé"; } });
    const rows = [el("div", { class: "menu-row" }, [el("div", {}, [el("b", { text: "Sons" }), el("p", { class: "small muted", text: "Pets, éclaboussures et fanfares." })]), sbtn]),
      el("p", { class: "small", text: "Souris ou doigt visent la direction de ta poussée. Elle reste limitée à ta zone, vers l'intérieur de la bouée. Clic ou appui prolongé pour pousser. Au clavier, les flèches tournent la visée et espace pousse." }),
      el("p", { class: "small", text: "Tu as " + G.prog.runs + " descentes, " + G.prog.stars + " étoiles et " + Math.round(G.prog.push) + " secondes de poussée sur cet appareil." }),
      el("button", { class: "btn btn--danger btn--small", style: { marginTop: "0.8rem" }, text: "Quitter la partie", onclick: () => Kit.confirm("Quitter la partie et revenir à l'accueil ?", () => { $("#modal").classList.add("hidden"); Kit.leave(); }) })];
    Kit.showModal("Menu", rows);
  }

  // ---------- réception ----------
  function onLevel(m) {
    G.level = m.level; G.levelIdx = m.idx; G.snaps = []; G.coinGot = new Set(); G.pushed = {};
    const B = window.FTBiomes[m.level.biome] || window.FTBiomes.prairie; if (S.ready) S.setLevel(m.level, B);
    G.boatsBuilt = false;
  }
  function buildBoats(st) {
    if (!S.ready || !st.crews) return; const looks = {};
    st.crews.forEach((c) => c.seats.forEach((pid) => { const ga = st.garage[pid] || {}; looks[pid] = { hat: ga.hat || 0, face: ga.face || 0, hex: hexOf(pid), name: nameOf(pid) }; }));
    S.setBoats(st.crews.map((c) => ({ id: c.id, seats: c.seats, hex: hexOf(c.seats[0]) })), looks); G.boatsBuilt = true; G.lookKey = JSON.stringify(looks);
  }
  function onState(s) {
    const prev = G.st; G.st = s;
    const key = s.phase + "|" + s.runIdx;
    if (s.crews && S.ready && G.level) { const looks = {}; s.crews.forEach((c) => c.seats.forEach((pid) => { const ga = s.garage[pid] || {}; looks[pid] = { hat: ga.hat || 0, face: ga.face || 0, hex: hexOf(pid), name: nameOf(pid) }; })); if (!G.boatsBuilt || G.lookKey !== JSON.stringify(looks)) buildBoats(s); }
    if (key !== G.lastKey) { G.lastKey = key; phaseEnter(s, prev); }
    if (s.coinsGot && S.ready) { s.coinsGot.forEach((i) => { if (!G.coinGot.has(i)) { G.coinGot.add(i); S.hideCoin(i, false); } }); }
    render();
  }
  function phaseEnter(s, prev) {
    G.over = s.phase === "over" ? G.over : null;
    if (s.phase === "garage") {
      G.snaps = []; G.coinGot = new Set(); if (S.ready) S.showAllCoins(); G.go = false; G.count = -1; G.banner = null;
      // on pousse notre choix local au serveur
      const ga = (s.garage || {})[myId()]; if (ga && Kit.socket) { const want = { ab: G.prog.ab, hat: hatOk(G.prog.hat) ? G.prog.hat : 0, face: faceOk(G.prog.face) ? G.prog.face : 0 }; if (ga.ab !== want.ab || ga.hat !== want.hat || ga.face !== want.face) Kit.socket.emit("ft:garage", want); }
    }
    if (s.phase === "count") { G.count = -1; }
    if (s.phase === "run") { G.go = true; G.snaps = []; sfx(() => { sound.tone(660, 0.3, "triangle", 0.14); sound.tone(990, 0.4, "triangle", 0.14, 0.1); }); }
    if (s.phase === "result" && s.result) afterResult(s);
  }
  function afterResult(s) {
    const mine = s.result.rows.find((r) => r.crew.includes(myId())); if (!mine) return;
    G.prog.runs++; G.prog.stars += mine.stars || 0;
    if (mine.fin && mine.adj !== null) { const key = s.result.course; if (!G.prog.best[key] || mine.adj < G.prog.best[key]) G.prog.best[key] = mine.adj; }
    if (s.result.daily && mine.fin) { const k = String(s.result.daily); if (!G.prog.daily[k] || mine.adj < G.prog.daily[k]) G.prog.daily[k] = mine.adj; }
    saveProg();
  }
  function onOver(m) { G.over = m; G.lastKey = ""; render(); sfx(() => sound.win()); }
  function onGo() { G.go = true; }
  function onSnap(sn) {
    sn.recv = performance.now(); const prev = G.snaps[G.snaps.length - 1]; G.snaps.push(sn); if (G.snaps.length > 40) G.snaps.shift();
    const me = myId(); const mine = G.st && G.st.crews ? G.st.crews.find((c) => c.seats.includes(me)) : null;
    // événements
    (sn.ev || []).forEach((e) => handleEvent(e, sn, mine));
    // sons des pets, front montant du bouton de chaque joueur
    sn.p.forEach((q) => { const id = q[0], pushing = q[2] === 1; if (pushing && !G.pushed[id]) { const now = performance.now(); if (now - (G.lastFartSnd[id] || 0) > 160) { G.lastFartSnd[id] = now; fartSound(q[5], id === me); } } G.pushed[id] = pushing; if (id === me && pushing) G.prog.push += 1 / 15; });
    if (sn.ch && (!G.chaosId || G.chaosId !== sn.ch.id + sn.ch.left)) { /* bandeau géré dans l'événement */ }
  }
  const CHAOS = { gust: ["🌬️ Rafale de vent", "Le vent pousse la bouée de côté."], mega: ["💥 Pets géants", "Tout le monde pousse presque deux fois plus fort."], hiccup: ["😳 Hoquet", "La visée d'un joueur tremble."], wave: ["🌊 Grosse vague", "La bouée est secouée."], invert: ["🔄 Commandes inversées", "Les pets partent dans l'autre sens."] };
  function handleEvent(e, sn, mine) {
    const my = mine && e.b === mine.id; const bo = sn.b.find((b) => b[0] === e.b);
    const pos = bo ? [bo[1], bo[5], bo[2]] : null;
    switch (e.k) {
      case "cap": if (pos) S.splash(pos[0], pos[1], pos[2], 22); S.shake(my ? 0.9 : 0.3); sCap(); if (my) banner("🛟 Chavirée ! Poussez tous ensemble pour redresser.", 3500); break;
      case "righted": if (my) banner(e.auto ? "Redressée par la rivière, étourdi une seconde." : "Redressée !", 1800); break;
      case "splash": if (pos) S.splash(pos[0], pos[1], pos[2], 14); if (my) { S.shake(Math.min(1, e.p * 0.08)); sSplash(); } break;
      case "jump": if (my) { sfx(() => sound.tone(300, 0.3, "sine", 0.1, 0, 800)); } break;
      case "bump": if (my) { S.shake(Math.min(0.9, e.v * 0.1)); sBump(); } break;
      case "coin": S.hideCoin(e.i, true); G.coinGot.add(e.i); if (my) sCoin(); break;
      case "cp": if (my) { banner("Point de passage " + e.i + " sur 3, " + fmtT(e.t), 1800); sfx(() => sound.tone(660, 0.12, "triangle", 0.1)); } break;
      case "gate": if (my) banner(e.ok ? "Porte passée" : "Porte manquée", 1100); break;
      case "finish": if (pos) S.confetti(pos[0], pos[1], pos[2]); if (my) { sFinish(); banner("Arrivée !", 2200); } break;
      case "chaos": { const c = CHAOS[e.id]; if (c) { sChaos(); banner(c[0] + " — " + c[1], 3800); } break; }
      default: break;
    }
  }
  function banner(text, ms) { G.banner = { text, until: performance.now() + ms }; const b = G.hud.banner; if (b) { b.textContent = text; b.classList.remove("hidden"); } }

  // ---------- entrées ----------
  function bindInput(view) {
    const down = (e) => { if (!G.st || G.st.phase !== "run") return; e.preventDefault(); G.inp.p = true; G.inp.kbUsed = false; aimAt(e.clientX, e.clientY); try { view.setPointerCapture(e.pointerId); } catch (x) { /* rien */ } };
    const move = (e) => { if (!G.st || G.st.phase !== "run") return; if (e.pointerType === "mouse" || G.inp.p) { G.inp.kbUsed = false; aimAt(e.clientX, e.clientY); } };
    const up = () => { G.inp.p = false; };
    view.addEventListener("pointerdown", down); view.addEventListener("pointermove", move); view.addEventListener("pointerup", up); view.addEventListener("pointercancel", up); view.addEventListener("contextmenu", (e) => e.preventDefault());
    window.addEventListener("keydown", (e) => { if (!G.st || G.st.phase !== "run") return; if (e.code === "Space") { G.inp.p = true; e.preventDefault(); } if (e.code === "ArrowLeft" || e.code === "KeyA") { G.inp.kb = -1; G.inp.kbUsed = true; e.preventDefault(); } if (e.code === "ArrowRight" || e.code === "KeyD") { G.inp.kb = 1; G.inp.kbUsed = true; e.preventDefault(); } });
    window.addEventListener("keyup", (e) => { if (e.code === "Space") G.inp.p = false; if (["ArrowLeft", "KeyA", "ArrowRight", "KeyD"].includes(e.code)) G.inp.kb = 0; });
    window.addEventListener("blur", () => { G.inp.p = false; G.inp.kb = 0; });
    setInterval(sendInput, 50);
  }
  const WZ = () => window.FTWorld;
  function mySeat() { const st = G.st; if (!st || !st.crews) return null; const c = st.crews.find((x) => x.seats.includes(myId())); return c ? { n: c.seats.length, k: c.seats.indexOf(myId()), crew: c } : null; }
  function clampMine(a) { const m = mySeat(); return m ? WZ().clampAim(m.n, m.k, a) : a; }
  function myBoatView() { const st = G.st; if (!st || !st.crews) return null; const c = st.crews.find((x) => x.seats.includes(myId())); return c ? S.boatPos(c.id) : null; }
  function aimAt(cx, cy) {
    const b = myBoatView(); if (!b) return; const w = S.pick(cx, cy, b.y); if (!w) return; let a = Math.atan2(w[0] - b.x, w[1] - b.z) - b.yaw; while (a > Math.PI) a -= 2 * Math.PI; while (a < -Math.PI) a += 2 * Math.PI; G.inp.a = clampMine(a);
  }
  function sendInput() {
    if (!Kit.socket || !G.st || G.st.phase !== "run") return;
    if (G.inp.kbUsed && G.inp.kb) { G.inp.a += G.inp.kb * 0.15; if (G.inp.a > Math.PI) G.inp.a -= 2 * Math.PI; if (G.inp.a < -Math.PI) G.inp.a += 2 * Math.PI; G.inp.a = clampMine(G.inp.a); }
    const k = Math.round(G.inp.a * 50) + "|" + (G.inp.p ? 1 : 0); const now = performance.now();
    if (k !== G.inp.lastSent || now - G.inp.sent > 400) { G.inp.lastSent = k; G.inp.sent = now; Kit.socket.emit("ft:in", { a: G.inp.a, p: G.inp.p }); }
  }

  // ---------- boucle d'image ----------
  function lerpAng(a, b, t) { let d = b - a; while (d > Math.PI) d -= 2 * Math.PI; while (d < -Math.PI) d += 2 * Math.PI; return a + d * t; }
  function frameAt(now) {
    const sn = G.snaps; if (!sn.length) return null;
    const last = sn[sn.length - 1]; const est = last.t + Math.min(0.2, (now - last.recv) / 1000); const rt = est - 0.1;
    let a = sn[0], b = sn[0]; for (let i = sn.length - 1; i >= 0; i--) { if (sn[i].t <= rt) { a = sn[i]; b = sn[Math.min(sn.length - 1, i + 1)]; break; } a = sn[i]; b = sn[i]; }
    const k = b.t > a.t ? Math.max(0, Math.min(1, (rt - a.t) / (b.t - a.t))) : 0;
    const boats = a.b.map((q, i) => { const w = b.b.find((x) => x[0] === q[0]) || q; return { id: q[0], x: q[1] + (w[1] - q[1]) * k, z: q[2] + (w[2] - q[2]) * k, yaw: lerpAng(q[3], w[3], k), lean: q[4] + (w[4] - q[4]) * k, y: q[5] + (w[5] - q[5]) * k, flags: k > 0.5 ? w[6] : q[6], hp: w[7], coins: w[8], egg: w[9], s: w[10], vx: w[11], vz: w[12], right: w[13] }; });
    const pls = {}; b.p.forEach((q) => { pls[q[0]] = { a: q[1], p: q[2] === 1, tank: q[3], dry: q[4] === 1, press: q[5] }; });
    return { t: rt, boats, pl: pls, raw: b };
  }
  let lastT = performance.now();
  function loop(now) {
    requestAnimationFrame(loop); const dt = Math.min(0.1, (now - lastT) / 1000); lastT = now;
    const st = G.st; if (!st || !S.ready || !G.level) return; const scr = $("#screen-game"); if (!scr || !scr.classList.contains("screen--active")) return;
    const me = myId(); const mine = st.crews ? st.crews.find((c) => c.seats.includes(me)) : null;
    let fr = null;
    if (st.phase === "run" || st.phase === "result" || (st.phase === "over")) fr = frameAt(now);
    if (!fr) { // garage ou compte à rebours, la scène montre la ligne de départ
      const bs = (st.crews || []).map((c, i) => { const p = G.level ? window.FTWorld.pointAt(G.level, 14) : { x: 0, z: 0, tx: 0, tz: 1 }; return null; });
      fr = { t: 0, dt, boats: startBoats(st), pl: startPl(st), follow: mine ? mine.id : null, me, showArrows: false }; fr.dt = dt; S.draw(fr); tickHud(now, null); return;
    }
    fr.dt = dt; fr.follow = mine ? mine.id : (fr.boats[0] && fr.boats[0].id); fr.me = me; fr.showArrows = st.phase === "run"; S.draw(fr); tickHud(now, fr);
  }
  // positions de départ affichées pendant le garage
  function startBoats(st) {
    const lv = G.level, W = window.FTWorld; const n = (st.crews || []).length;
    return (st.crews || []).map((c, bi) => { const row = Math.floor(bi / 3), colN = Math.min(3, n - row * 3), col = bi % 3, off = (col - (colN - 1) / 2) * 4.6; const p = W.pointAt(lv, Math.max(1, 14 - row * 5)); return { id: c.id, x: p.x - p.tz * off, z: p.z + p.tx * off, yaw: Math.atan2(p.tx, p.tz), lean: 0, y: 0, flags: 0, vx: 0, vz: 0 }; });
  }
  function startPl(st) { const o = {}; (st.crews || []).forEach((c) => c.seats.forEach((id) => { o[id] = { a: 0, p: false, tank: 100, press: 0 }; })); return o; }

  // ---------- affichage ----------
  function render() {
    const st = G.st; const panel = $("#ft-panel"), hud = $("#ft-hud"); if (!st || !panel) return;
    panel.innerHTML = ""; panel.classList.add("hidden"); G.hud = {};
    if (st.phase === "garage") { hud.classList.add("hidden"); panel.classList.remove("hidden"); buildGarage(panel, st); }
    else if (st.phase === "count" || st.phase === "run") { hud.classList.remove("hidden"); buildHud(hud, st); }
    else if (st.phase === "result") { hud.classList.add("hidden"); panel.classList.remove("hidden"); buildResult(panel, st); }
    else if (st.phase === "over") { hud.classList.add("hidden"); panel.classList.remove("hidden"); buildOver(panel); }
  }
  function modeLine(st) { const c = st.course || {}; return MODE_NAMES[st.mode] + (st.runs > 1 ? "  ·  descente " + (st.runIdx + 1) + " sur " + st.runs : "") + (c.attempt ? "  ·  essai " + c.attempt : ""); }
  const OBJ = { finir: "Arriver le plus vite possible.", pieces: "Chaque bulle dorée ramassée enlève une seconde et demie.", oeuf: "Garder l'œuf intact, sinon quinze secondes de pénalité.", portes: "Chaque porte manquée coûte cinq secondes." };

  function buildGarage(panel, st) {
    const c = st.course || {}; const me = myId(); const ga = (st.garage || {})[me] || {};
    const head = el("div", { class: "ft-card ft-card--head" }, [
      el("div", { class: "ft-kicker", text: modeLine(st) }), el("h2", { text: c.name || "La rivière" }),
      el("p", { class: "ft-sub", text: c.blurb || (st.mode === "survie" ? "Une rivière sans fin. La coque encaisse cinq chocs, la rivière ne pardonne rien." : st.mode === "arene" ? "Une grande piscine pleine de bulles dorées. Le plus riche gagne." : "Descends le plus loin possible.") }),
      el("p", { class: "ft-sub ft-sub--goal", text: c.goal ? "Défi. " + c.goal : OBJ[c.objective] || "" }),
    ]);
    if (c.daily) { const best = G.prog.daily[String(c.daily)]; head.appendChild(el("p", { class: "ft-sub", text: "Défi du jour, identique pour tout le monde." + (best ? " Ton meilleur temps sur cet appareil est " + fmtT(best) + "." : "") })); }
    else if (c.id && G.prog.best[c.id]) head.appendChild(el("p", { class: "ft-sub", text: "Ton record sur cet appareil est " + fmtT(G.prog.best[c.id]) + "." }));
    const crew = el("div", { class: "ft-card" }, [el("h3", { text: "Les équipages" })].concat((st.crews || []).map((cr) => el("div", { class: "ft-crew" }, [el("b", { text: "Bouée " + cr.id })].concat(cr.seats.map((id) => el("span", { class: "ft-seat" + ((st.garage[id] || {}).ready ? " ft-seat--ok" : "") }, [dot(id), nameOf(id) + ((st.garage[id] || {}).ready ? " prêt" : "")])))))));
    const seat = mySeat(); let zoneCard = null;
    if (seat) {
      const cv = el("canvas", { class: "ft-zonecv", width: 240, height: 240 });
      const role = WZ().roleOf(seat.n, seat.k);
      const mates = seat.crew.seats.map((id, k) => { const r = WZ().roleOf(seat.n, k); return el("div", { class: "ft-line" + (id === myId() ? " ft-line--me" : "") }, [dot(id), el("span", {}, [el("b", { text: nameOf(id) + (id === myId() ? " (toi)" : "") }), " " + r.icon + " " + r.name])]); });
      zoneCard = el("div", { class: "ft-card" }, [el("h3", { text: seat.n > 1 ? "Ta zone sur la bouée" : "Ta bouée" }), el("div", { class: "ft-zonerow" }, [cv, el("div", {}, [el("p", { class: "ft-sub", text: role.icon + " " + role.name + ". " + role.desc }), seat.n > 1 ? el("p", { class: "ft-sub", text: "Chaque joueur reste dans sa zone et pousse seulement vers l'intérieur de la bouée. Une poussée d'un côté fait tourner la bouée de l'autre. Il faut compenser les uns les autres pour avancer droit." }) : el("p", { class: "ft-sub", text: "Seul sur ta bouée, tu pousses dans toutes les directions." }), el("div", {}, mates)])])]);
      setTimeout(() => { const c2 = cv.getContext("2d"); if (c2) drawZones(c2, 240, seat.crew, null, {}); }, 0);
    }
    const abBox = el("div", { class: "ft-card" }, [el("h3", { text: "Ton style de pet" }), el("div", { class: "ft-abs" }, Object.keys(ABS).map((k) => el("button", { class: "ft-ab" + (ga.ab === k ? " ft-ab--on" : ""), onclick: () => { G.prog.ab = k; saveProg(); Kit.socket.emit("ft:garage", { ab: k }); sound.click(); } }, [el("span", { class: "ft-ab__ic", text: ABS[k][0] }), el("b", { text: ABS[k][1] }), el("small", { text: ABS[k][2] })])))]);
    const hats = el("div", { class: "ft-picks" }, S.HATS.map((nm, i) => el("button", { class: "ft-pick" + (ga.hat === i ? " ft-pick--on" : "") + (hatOk(i) ? "" : " ft-pick--lock"), title: hatOk(i) ? nm : nm + ", à débloquer", onclick: () => { if (!hatOk(i)) return toast("Se débloque à " + HAT_REQ[i] + " points de progression, tu en as " + points() + "."); G.prog.hat = i; saveProg(); Kit.socket.emit("ft:garage", { hat: i }); sound.click(); }, text: hatOk(i) ? nm : "🔒 " + HAT_REQ[i] })));
    const faces = el("div", { class: "ft-picks" }, S.FACES.map((nm, i) => el("button", { class: "ft-pick" + (ga.face === i ? " ft-pick--on" : "") + (faceOk(i) ? "" : " ft-pick--lock"), title: faceOk(i) ? nm : nm + ", à débloquer", onclick: () => { if (!faceOk(i)) return toast("Se débloque à " + FACE_REQ[i] + " points de progression, tu en as " + points() + "."); G.prog.face = i; saveProg(); Kit.socket.emit("ft:garage", { face: i }); sound.click(); }, text: faceOk(i) ? nm : "🔒 " + FACE_REQ[i] })));
    const look = el("div", { class: "ft-card" }, [el("h3", { text: "Ton look" }), el("p", { class: "small muted", text: "Chapeaux et visages sont purement décoratifs. Ils se débloquent avec tes descentes et tes étoiles, sur cet appareil." }), el("div", { class: "ft-sub", text: "Chapeau" }), hats, el("div", { class: "ft-sub", text: "Visage" }), faces]);
    const ctl = el("div", { class: "ft-ctrl" }, [el("button", { class: "btn btn--accent btn--big", id: "ft-ready", text: ga.ready ? "J'annule, pas prêt" : "Prêt à pousser", onclick: () => { Kit.socket.emit("ft:ready", { v: !ga.ready }); sound.click(); } }), Kit.isHost() ? el("button", { class: "btn btn--ghost", text: "Lancer maintenant", onclick: () => Kit.socket.emit("ft:next") }) : el("span", { class: "small muted", text: "Départ automatique quand tout le monde est prêt." }), el("span", { class: "ft-timer", id: "ft-gtimer" })]);
    panel.appendChild(el("div", { class: "ft-scroll" }, [head, zoneCard, crew, abBox, look, ctl].filter(Boolean)));
  }

  function buildHud(hud, st) {
    hud.innerHTML = ""; const c = st.course || {};
    const top = el("div", { class: "ft-top" }, [el("div", { class: "ft-top__l" }, [el("div", { class: "ft-name", text: c.name || "" }), el("div", { class: "ft-time", id: "ft-time", text: "0,0 s" })]), el("div", { class: "ft-prog" }, [el("i", { id: "ft-progfill" })])]);
    const stats = el("div", { class: "ft-stats", id: "ft-stats" });
    const banner = el("div", { class: "ft-banner hidden", id: "ft-banner" });
    const count = el("div", { class: "ft-count hidden", id: "ft-count" });
    const tank = el("div", { class: "ft-tank" }, [el("div", { class: "ft-tank__bar" }, [el("i", { id: "ft-tankfill" })]), el("div", { class: "ft-tank__lab", id: "ft-tanklab", text: "Souffle" })]);
    const crewBars = el("div", { class: "ft-crewbars", id: "ft-crewbars" });
    const seat = mySeat(); const role = seat ? WZ().roleOf(seat.n, seat.k) : null;
    const help = el("div", { class: "ft-helpline", id: "ft-help", text: seat && seat.n > 1 ? "Ta zone est en couleur. Vise vers l'intérieur de la bouée, appuie pour pousser. Seul, tu ne fais que tourner, il faut s'accorder." : "Vise avec la souris ou le doigt, clique ou appuie pour pousser." });
    const radar = seat ? el("canvas", { class: "ft-radar", id: "ft-radar", width: 240, height: 240 }) : null;
    const roleBox = role && seat.n > 1 ? el("div", { class: "ft-role" }, [el("span", { class: "ft-role__ic", text: role.icon }), el("div", {}, [el("b", { text: role.name }), el("small", { text: "Ta zone est en couleur sur la bouée." })])]) : null;
    const right = el("div", { class: "ft-right hidden", id: "ft-right" }, [el("div", { class: "ft-right__lab", text: "Redressement" }), el("div", { class: "ft-right__bar" }, [el("i", { id: "ft-rightfill" })])]);
    hud.appendChild(top); hud.appendChild(stats); hud.appendChild(banner); hud.appendChild(count); hud.appendChild(right); hud.appendChild(crewBars); hud.appendChild(tank); hud.appendChild(help); if (radar) hud.appendChild(radar); if (roleBox) hud.appendChild(roleBox);
    G.hud = { time: $("#ft-time"), fill: $("#ft-progfill"), stats, banner, count, tankfill: $("#ft-tankfill"), tanklab: $("#ft-tanklab"), crew: crewBars, right, rightfill: $("#ft-rightfill"), help, radar: radar ? radar.getContext("2d") : null };
  }
  // ---------- radar des zones, la bouée vue de dessus ----------
  // dir est le sens de la poussée sur la bouée, l'avant est en haut, la gauche de l'écran est à gauche
  function drawZones(ctx, W, crew, pl, opts) {
    const n = crew.seats.length, me = myId(), Z = WZ(); const cx = W / 2, cy = W / 2, R = W * 0.36, r = W * 0.17;
    ctx.clearRect(0, 0, W, W); ctx.save();
    const pt = (th, rad) => [cx - Math.sin(th) * rad, cy - Math.cos(th) * rad]; const phi = (th) => -Math.PI / 2 - th;
    ctx.fillStyle = "rgba(4,22,32,0.55)"; ctx.beginPath(); ctx.arc(cx, cy, R + W * 0.1, 0, 7); ctx.fill();
    crew.seats.forEach((id, k) => {
      const z = Z.zoneOf(n, k), hx = hexOf(id), mine = id === me; const f0 = phi(z.c - z.h), f1 = phi(z.c + z.h);
      ctx.beginPath(); ctx.arc(cx, cy, R, Math.min(f0, f1), Math.max(f0, f1)); ctx.arc(cx, cy, r, Math.max(f0, f1), Math.min(f0, f1), true); ctx.closePath();
      ctx.fillStyle = hx; ctx.globalAlpha = mine ? 0.9 : 0.45; ctx.fill(); ctx.globalAlpha = 1; ctx.lineWidth = 3; ctx.strokeStyle = "#fff"; ctx.stroke();
      if (mine && n > 1) { // le cône dans lequel je peux pousser
        const cn = Z.aimCone(n, k); const q0 = phi(cn.c - cn.h), q1 = phi(cn.c + cn.h);
        ctx.beginPath(); ctx.moveTo(cx, cy); ctx.arc(cx, cy, r * 0.92, Math.min(q0, q1), Math.max(q0, q1)); ctx.closePath(); ctx.fillStyle = "rgba(255,255,255,0.28)"; ctx.fill();
      }
      const p = pl && pl[id]; const sp = Z.seatAngle(n, k); const [lx, ly] = pt(n > 1 ? sp : Math.PI, R * 0.78);
      ctx.fillStyle = "#fff"; ctx.strokeStyle = "rgba(0,0,0,0.65)"; ctx.lineWidth = 4; ctx.font = "bold " + Math.round(W * (n > 4 ? 0.09 : 0.115)) + "px sans-serif"; ctx.textAlign = "center"; ctx.textBaseline = "middle"; const nm = Array.from(nameOf(id))[0] || "?"; ctx.strokeText(nm, lx, ly); ctx.fillText(nm, lx, ly);
      if (p && p.p) { // flèche de poussée, sens de la force sur la bouée
        const [ex, ey] = pt(p.a, r * 0.95); ctx.strokeStyle = "#ffd23f"; ctx.lineWidth = 5; ctx.lineCap = "round"; ctx.beginPath(); ctx.moveTo(cx, cy); ctx.lineTo(cx - Math.sin(p.a) * r * 1.5, cy - Math.cos(p.a) * r * 1.5); ctx.stroke();
        const [sx2, sy2] = pt(sp, R + 2); ctx.fillStyle = "#ffd23f"; ctx.beginPath(); ctx.arc(sx2, sy2, W * 0.03, 0, 7); ctx.fill();
      }
    });
    // le nez de la bouée
    ctx.fillStyle = "#fff"; ctx.beginPath(); ctx.moveTo(cx, cy - R - W * 0.095); ctx.lineTo(cx - W * 0.045, cy - R - W * 0.015); ctx.lineTo(cx + W * 0.045, cy - R - W * 0.015); ctx.closePath(); ctx.fill();
    // ma visée
    if (opts && opts.aim !== undefined) { const a = opts.aim; ctx.strokeStyle = "#fff"; ctx.lineWidth = 6; ctx.lineCap = "round"; ctx.beginPath(); ctx.moveTo(cx, cy); ctx.lineTo(cx - Math.sin(a) * R * 0.98, cy - Math.cos(a) * R * 0.98); ctx.stroke(); const ex = cx - Math.sin(a) * R * 1.0, ey = cy - Math.cos(a) * R * 1.0; ctx.beginPath(); ctx.arc(ex, ey, W * 0.032, 0, 7); ctx.fillStyle = "#ffd23f"; ctx.fill(); }
    ctx.restore();
  }
  let lastStat = "";
  function tickHud(now, fr) {
    const st = G.st; if (!st) return;
    // minuteries hors HUD
    if (st.phase === "garage") { const t = $("#ft-gtimer"); if (t) { const left = Math.max(0, st.left - (now - (st._recv || (st._recv = now)))); t.textContent = secs(left) + " s"; } return; }
    if (st.phase === "result") { const t = $("#ft-rtimer"); if (t) { const left = Math.max(0, st.left - (now - (st._recv || (st._recv = now)))); t.textContent = "Suite dans " + secs(left) + " s"; } return; }
    const H = G.hud; if (!H || !H.time) return;
    if (!st._recv) st._recv = now;
    if (st.phase === "count") { const left = Math.max(0, st.left - (now - st._recv)); const n = Math.ceil(left / 1000); H.count.classList.remove("hidden"); H.count.textContent = n > 0 ? String(n) : "Pousse !"; if (n !== G.count) { G.count = n; sBeep(n === 0); } H.help.classList.remove("hidden"); return; }
    H.count.classList.add("hidden");
    if (!fr) return; const c = st.course || {}; const me = myId(); const mine = fr.boats.find((b) => st.crews.find((x) => x.id === b.id && x.seats.includes(me)));
    if (c.timer) H.time.textContent = fmtT(Math.max(0, c.timer - fr.t)); else H.time.textContent = fmtT(fr.t);
    if (mine) {
      H.fill.style.width = Math.min(100, (mine.s / (c.L || 1)) * 100) + "%";
      const pm = fr.pl[me]; if (pm) { H.tankfill.style.width = pm.tank + "%"; H.tankfill.classList.toggle("ft-low", pm.tank < 25 || pm.dry); H.tanklab.textContent = pm.dry ? "À sec, laisse souffler" : pm.p ? "Tu pousses" : "Souffle"; }
      const cap = mine.flags & 1; H.right.classList.toggle("hidden", !cap); if (cap) H.rightfill.style.width = Math.min(100, (mine.right / 1.4) * 100) + "%";
      let s = ""; const extra = [];
      if (c.objective === "pieces" || st.mode === "arene") extra.push("🪙 " + mine.coins);
      if (st.mode === "survie") extra.push("❤️".repeat(Math.max(0, mine.hp)) + "🖤".repeat(Math.max(0, 5 - Math.max(0, mine.hp))));
      if (c.objective === "oeuf") extra.push("🥚 " + mine.egg + " %");
      if (st.mode === "survie" || st.mode === "infini") extra.push("📏 " + Math.round(mine.s) + " m");
      if (st.mode === "course" && fr.boats.length > 1) { const order = fr.boats.slice().sort((a, b) => b.s - a.s); extra.push("Place " + (order.findIndex((b) => b.id === mine.id) + 1) + " sur " + order.length); }
      s = extra.join("   ");
      if (s !== lastStat) { lastStat = s; H.stats.textContent = s; }
    }
    // réservoirs de l'équipage
    const crew = st.crews.find((x) => x.seats.includes(me));
    if (H.radar && crew) drawZones(H.radar, 240, crew, fr.pl, { aim: G.inp.a });
    if (crew && crew.seats.length > 1) { const key = crew.seats.map((id) => (fr.pl[id] ? fr.pl[id].tank : 0)).join(","); if (key !== H.crewKey) { H.crewKey = key; H.crew.innerHTML = ""; crew.seats.forEach((id) => { const q = fr.pl[id]; if (!q) return; H.crew.appendChild(el("div", { class: "ft-cb" + (q.p ? " ft-cb--push" : "") }, [dot(id), el("i", { style: { width: q.tank + "%" } })])); }); } }
    if (G.banner && now > G.banner.until) { G.banner = null; H.banner.classList.add("hidden"); } else if (G.banner) { H.banner.textContent = G.banner.text; H.banner.classList.remove("hidden"); }
    if (fr.t > 9) H.help.classList.add("hidden"); else H.help.classList.remove("hidden");
  }

  function buildResult(panel, st) {
    const r = st.result; if (!r) return; const me = myId();
    const mine = r.rows.find((x) => x.crew.includes(me)); const rows = r.rows.slice().sort((a, b) => (a.fin === b.fin ? (a.adj || 9999) - (b.adj || 9999) : a.fin ? -1 : 1));
    const stars = (n) => "⭐".repeat(n) + "☆".repeat(Math.max(0, 3 - n));
    const lines = rows.map((x) => el("div", { class: "ft-row" + (x === mine ? " ft-row--me" : "") }, [
      el("div", { class: "ft-row__who" }, x.crew.map((id) => el("span", { class: "ft-seat" }, [dot(id), nameOf(id)]))),
      el("div", { class: "ft-row__main", text: st.mode === "survie" || st.mode === "infini" ? x.dist + " mètres" : st.mode === "arene" ? x.coins + " bulles" : x.fin ? fmtT(x.adj) : (x.dead ? "Coque détruite" : "Pas arrivé") }),
      el("div", { class: "ft-row__sub", text: [x.fin && x.adj !== x.time ? "temps réel " + fmtT(x.time) : "", x.coins ? x.coins + " bulles" : "", x.hits + " chocs", x.caps + " chavirage" + (x.caps > 1 ? "s" : ""), r.objective === "oeuf" ? "œuf à " + x.egg + " %" : "", r.objective === "portes" ? x.gatesOk + " portes sur " + x.gatesTotal : ""].filter(Boolean).join("  ·  ") }),
      el("div", { class: "ft-row__pts", text: st.mode === "aventure" ? stars(x.stars) : st.mode === "defis" ? (x.ok ? "Réussi" : "Raté") : st.mode === "course" ? "+" + x.pts + " pt" : st.mode === "chrono" ? "" : "" }),
    ]));
    const kids = [el("div", { class: "ft-kicker", text: modeLine(st) }), el("h2", { text: r.name }), r.note ? el("p", { class: "ft-sub", text: r.note }) : null].filter(Boolean);
    const card = el("div", { class: "ft-card" }, kids.concat(lines));
    const rank = Object.keys(st.scores).map((id) => ({ id, s: st.scores[id] })).sort((a, b) => b.s - a.s);
    const scoreCard = (st.mode === "course" || st.mode === "aventure") && st.runs > 1 ? el("div", { class: "ft-card" }, [el("h3", { text: "Au total" })].concat(rank.map((q) => el("div", { class: "ft-line" }, [dot(q.id), nameOf(q.id) + "  " + q.s])))) : null;
    const ctl = el("div", { class: "ft-ctrl" }, [Kit.isHost() ? el("button", { class: "btn btn--accent btn--big", text: st.runIdx + 1 >= st.runs ? "Voir le classement" : "Descente suivante", onclick: () => Kit.socket.emit("ft:next") }) : el("span", { class: "small muted", text: "La suite démarre toute seule." }), el("span", { class: "ft-timer", id: "ft-rtimer" })]);
    panel.appendChild(el("div", { class: "ft-scroll" }, [card, scoreCard, ctl].filter(Boolean)));
  }
  function buildOver(panel) {
    const o = G.over; if (!o) { panel.appendChild(el("div", { class: "ft-card" }, [el("h2", { text: "Résultats en cours" })])); return; }
    const hx = (id) => { const p = pl(id); return COLORS[((p && p.color) || 0) % COLORS.length].hex; };
    const top = o.rows.slice(0, 3); const order = top.length === 1 ? [top[0]] : top.length === 2 ? [top[1], top[0]] : [top[1], top[0], top[2]];
    const pod = el("div", { class: "ft-card" }, [el("h2", { text: o.mode === "defis" ? "Le défi est terminé" : "Le podium de la rivière" }), el("div", { class: "podium" }, order.map((r) => el("div", { class: "pod pod--" + r.rank }, [el("div", { class: "pod__ball", style: { background: hx(r.id) } }), el("div", { class: "pod__nm", text: r.name }), el("div", { class: "pod__bar", text: r.label })])))]);
    const tbl = el("div", { class: "ft-card" }, [el("h2", { text: "Le classement" }), el("table", { class: "tbl" }, [el("thead", {}, [el("tr", {}, [el("th", { text: "" }), el("th", { text: "Joueur" }), el("th", { class: "r", text: "Résultat" }), el("th", { class: "r", text: "Poussée" })])]), el("tbody", {}, o.rows.map((r) => el("tr", {}, [el("td", { text: String(r.rank) }), el("td", {}, [el("span", { class: "dotc", style: { background: hx(r.id) } }), r.name + (r.left ? " (parti)" : "")]), el("td", { class: "r", text: r.label }), el("td", { class: "r", text: r.push + " s" })])))])]);
    const aw = o.awards.length ? el("div", { class: "ft-card" }, [el("h2", { text: "Les titres" })].concat(o.awards.map((a) => el("div", { class: "ft-award" }, [el("span", { class: "ft-award__ic", text: a.icon }), el("div", {}, [el("b", { text: a.title }), el("div", {}, [dot(a.id), nameOf(a.id)]), el("span", { class: "small muted", text: a.detail })])])))) : null;
    const ctl = el("div", { class: "ft-ctrl" }, [el("button", { class: "btn btn--ghost", text: "Quitter", onclick: () => Kit.confirm("Quitter la partie et revenir à l'accueil ?", () => Kit.leave()) }), Kit.isHost() ? el("button", { class: "btn btn--accent btn--big", text: "Retour au salon", onclick: () => Kit.backToLobby() }) : el("span", { class: "muted small", text: "L'hôte peut relancer une partie depuis le salon." })]);
    panel.appendChild(el("div", { class: "ft-scroll" }, [pod, tbl, aw, ctl].filter(Boolean)));
  }

  // ---------- branchement ----------
  Kit.on("reset", () => { G.st = null; G.over = null; G.level = null; G.lastKey = ""; });
  Kit.on("room", (r) => { if (r.status === "lobby") { G.st = null; G.over = null; G.level = null; G.lastKey = ""; G.snaps = []; } });
  function attach() { const so = Kit.socket; if (!so || G.attached) return; G.attached = true; so.on("ft:state", (s) => { s._recv = performance.now(); onState(s); }); so.on("ft:level", onLevel); so.on("ft:snap", onSnap); so.on("ft:over", onOver); so.on("ft:go", onGo); }

  G.prog = loadProg();
  Kit.init({
    id: "fart-together", hero: true, title: "Pétard Mouillé", emoji: "💨", ribbon: "Une bouée, un équipage, zéro autonomie", tagline: "Chacun sa zone, une seule bouée, aucune chance d'y arriver sans s'accorder.",
    createLabel: "Créer un équipage", soloLabel: "Descendre avec des robots", startLabel: "À l'eau", helpTitle: "Comment jouer",
    floaters: [{ e: "💨", x: 6 }, { e: "🛟", x: 20 }, { e: "🦆", x: 36 }, { e: "🌊", x: 50 }, { e: "🪙", x: 64 }, { e: "🧀", x: 78 }, { e: "🐸", x: 92 }],
    colors: COLORS, botLevels: [{ id: "stagiaire", label: "Stagiaire" }, { id: "matelot", label: "Matelot" }, { id: "capitaine", label: "Capitaine" }], maxPlayers: 8, minPlayers: 1, schema: R.SCHEMA,
    help: [
      { title: "Le principe", text: "Une seule bouée, plusieurs joueurs, personne ne peut la conduire seul. La bouée est découpée en zones, une par joueur, visibles dès le départ. À deux, tu as la moitié gauche ou droite. À trois, un tiers. À quatre, un quart. Personne ne peut entrer dans la zone d'un autre." },
      { title: "Ta zone et ta poussée", text: "Chacun pousse seulement vers l'intérieur de la bouée. Tu vises avec la souris ou le doigt, ta visée reste bloquée dans le cône de ta zone. Le petit radar en bas à droite montre ta zone et ton cône en clair. Plus tu restes appuyé, plus la poussée monte." },
      { title: "Les rôles", text: "À l'arrière, le Moteur pousse vers l'avant. Sur les côtés, les Rames poussent en travers et font tourner la bouée. À l'avant, le Gouvernail pousse vers l'arrière et pivote le nez. Une poussée d'un côté fait tourner la bouée vers l'autre côté. Pour aller droit, il faut compenser." },
      { title: "S'accorder", text: "Accélérez ensemble, ralentissez ensemble, corrigez la trajectoire depuis les deux côtés, anticipez les virages, passez les goulots à la queue leu leu et rattrapez la trajectoire après un choc. Si un joueur lâche, les autres compensent." },
      { title: "Le souffle", text: "Chaque joueur a un réservoir de gaz. Il se vide quand on pousse et se remplit quand on s'arrête. À sec, il faut laisser souffler un moment." },
      { title: "Chavirer", text: "Si la bouée penche trop longtemps, elle se retourne. Pour la redresser, la moitié de l'équipage au moins doit pousser en même temps. Les chocs, les rapides, les poussées trop inégales et les atterrissages font pencher." },
      { title: "La rivière", text: "Courants, rapides, chutes, rampes, glace, fromage fondu, goulots, chicanes et épingles. Trois points de passage découpent chaque parcours, les rochers et les rives donnent des chocs." },
      { title: "Les modes", text: "Aventure enchaîne des parcours avec des étoiles. Contre-la-montre garde le meilleur essai. Course met plusieurs bouées face à face. Survie, parcours infini, défis, arène et défi du jour complètent la liste. Chaque mode a ses réglages." },
      { title: "Le chaos", text: "Si l'hôte l'active, des événements arrivent au hasard, rafales, pets géants, hoquets, vagues et commandes inversées. Le tout est affiché à l'écran." },
    ],
    theme: { a1: "#2fe0a8", a2: "#ffd23f", bg1: "#0e5f7a", bg2: "#06202c" },
    onInit() { build(); attach(); Kit.on("connect", attach); },
  });
})();

// ============================================================
// GOLFOUILLE — Interface de jeu et réseau (client)
// ============================================================
(function () {
  const { el, $, toast, sound, store } = Kit;
  const GR = GolfRules, GC = GolfCourse, GP = GolfPhysics, V = GolfView, M = GolfMini;
  const COLORS = [
    { name: "Rouge", hex: "#e8453c" }, { name: "Bleu", hex: "#2f78d1" }, { name: "Vert", hex: "#3aa653" }, { name: "Jaune", hex: "#f2c230" },
    { name: "Violet", hex: "#8a55c8" }, { name: "Orange", hex: "#f08a24" }, { name: "Rose", hex: "#ee6fb0" }, { name: "Turquoise", hex: "#25b9b0" },
  ];
  const LEVELS = [{ id: "debutant", label: "Mou du genou" }, { id: "moyen", label: "Gaillard" }, { id: "champion", label: "Champion" }, { id: "prodige", label: "Prodige" }];
  const RANGE = { driver: 62, iron: 48, wedge: 31, lob: 14, putter: 13, ricochet: 43, rocket: 105 };
  const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
  const hexOf = (c) => COLORS[(c || 0) % COLORS.length].hex;

  const G = {
    hole: null, holeIdx: -1, total: 0, st: null, samples: [], offset: 0, club: "driver", clubManual: false, power: 0.65, yaw: 0, charging: false, chargeAt: 0, keys: {},
    viewInit: false, flown: false, needAim: false, peek: null, prevPhase: "", lastTurn: null, sentAt: 0, sheet: null, lastCount: -99, endInfo: null,
    prev: { seed: "", idx: 0, key: "", hole: null }, traj: null, trajAt: 0, trajKey: "", lastMini: 0, lastSlow: 0, wasMoving: false, pointers: new Map(), pinch: 0,
  };
  const snow = () => Date.now() + G.offset;
  const S = () => (Kit.room && Kit.room.settings) || GR.defaults();
  const myId = () => { const p = Kit.me(); return p ? p.id : null; };
  const stPlayer = (id) => (G.st ? G.st.players.find((p) => p.id === id) : null);
  const myState = () => stPlayer(myId());
  const clockSample = (serverNow) => { G.samples.push(serverNow - Date.now()); if (G.samples.length > 12) G.samples.shift(); G.offset = Math.max.apply(null, G.samples); V.setClock(G.offset); };

  // ---------- squelette de l'écran de jeu ----------
  function buildGame() {
    const sc = $("#screen-game"); sc.innerHTML = "";
    sc.appendChild(el("div", { id: "gl-host" }));
    sc.appendChild(el("div", { id: "fx-fog", class: "overlay-fx overlay-fx--fog" }));
    sc.appendChild(el("div", { id: "fx-ice", class: "overlay-fx overlay-fx--ice" }));
    const hud = el("div", { class: "hud", id: "hud" }, [
      el("div", { id: "hud-hole", class: "pill hud-hole" }),
      el("div", { id: "hud-wind", class: "pill hud-wind" }),
      el("div", { class: "pill hud-mini" }, [el("canvas", { id: "hud-mini", width: 236, height: 392 })]),
      el("div", { id: "hud-board", class: "pill hud-board" }),
      el("div", { id: "hud-fx", class: "fxchips" }),
      el("div", { id: "hud-center", class: "hud-center nopoint" }),
      el("div", { class: "hud-menu" }, [
        el("button", { class: "round-btn", id: "btn-menu", title: "Menu et commandes", text: "⚙️" }),
        el("button", { class: "round-btn", id: "btn-zoomin", title: "Rapprocher la caméra", text: "＋" }),
        el("button", { class: "round-btn", id: "btn-zoomout", title: "Éloigner la caméra", text: "－" }),
      ]),
      el("div", { class: "hud-bottom" }, [
        el("div", { id: "hud-tip", class: "tip nopoint" }),
        el("div", { id: "hud-powers", class: "powers" }),
        el("div", { id: "hud-clubs", class: "clubs" }),
        el("div", { class: "shootrow" }, [
          el("div", { id: "power", class: "power", title: "Force du coup" }, [el("div", { id: "power-fill", class: "power__fill" }), el("div", { class: "power__ticks" }), el("div", { id: "power-txt", class: "power__txt" })]),
          el("button", { id: "btn-shoot", class: "btn btn--accent shootbtn", text: "Taper" }),
        ]),
      ]),
      el("div", { id: "hud-pick", class: "pill pick hidden" }),
    ]);
    sc.appendChild(hud);
    sc.appendChild(el("div", { id: "sheet", class: "sheet hidden" }));
    wireInput();
  }

  // ---------- chargement d'un trou ----------
  function autoQuality() { return (window.innerWidth < 760 || /Mobi|Android/i.test(navigator.userAgent)) ? "low" : "medium"; }
  function loadHole(m) {
    clockSample(m.now);
    if (!G.viewInit) {
      V.init($("#gl-host"), store.get("golf.quality", autoQuality())); G.viewInit = true; V.paused = false;
      V.onBallEvent(onBallEvent);
    }
    G.hole = GC.decodeHole(m.hole); G.holeIdx = m.index; G.total = m.total; G.flown = false; G.prevPhase = ""; G.peek = null; G.needAim = false; G.endInfo = null; G.traj = null;
    closeSheet();
    V.loadHole(G.hole); V.resize();
    $("#hud-hole").innerHTML = "";
    $("#hud-hole").appendChild(el("b", { text: "Trou " + (m.index + 1) + " sur " + m.total }));
    $("#hud-hole").appendChild(el("span", { id: "hud-hole-sub", text: G.hole.name + " · par " + G.hole.par }));
    const b = GC.BIOMES[G.hole.biome];
    $("#hud-hole-sub").textContent = b.icon + " " + G.hole.name + " · par " + G.hole.par;
    V.setCam({ dist: 9, pitch: 0.42 });
  }

  // ---------- réception de l'état ----------
  function onState(s) {
    clockSample(s.now);
    const old = G.st; G.st = s;
    if (!G.hole || !G.viewInit) return;
    V.setPlayStart(s.playStart);
    V.setPlayers(s.players.map((p) => ({ id: p.id, name: p.name, hex: hexOf(p.color), finished: p.finished, moving: p.moving, x: p.x, y: p.y, z: p.z })));
    V.setWalls(s.walls); V.setOrbs(s.orbs);
    s.players.forEach((p) => { if (!p.moving) V.setBallRest(p.id, p); });
    const me = myState();
    if (s.phase === "countdown" && !G.flown) { G.flown = true; V.startFlyover(Math.max(1500, s.phaseUntil - snow())); }
    if (s.phase !== G.prevPhase) {
      if (s.phase === "play" && G.prevPhase !== "play") { V.endFlyover(); G.needAim = true; G.flown = true; if (G.prevPhase === "countdown") { sound.tone(900, 0.25, "triangle", 0.12); setBanner("Partez", null, 900); } }
      G.prevPhase = s.phase;
    }
    if (me && old) { const om = old.players.find((p) => p.id === me.id); if (om && om.moving && !me.moving) { G.needAim = true; G.clubManual = false; } }
    if (s.playMode === "tour" && s.turnPid !== G.lastTurn) { G.lastTurn = s.turnPid; if (s.turnPid === myId() && s.phase === "play") { setBanner("À toi de jouer", null, 1400); sound.tone(660, 0.15, "triangle", 0.1); sound.tone(880, 0.2, "triangle", 0.1, 0.12); } }
    const wind = s.wind || [0, 0]; const wl = Math.hypot(wind[0], wind[1]);
    const w = $("#hud-wind"); w.innerHTML = "";
    if (wl < 0.05) w.appendChild(el("span", { text: "🍃 Pas de vent" }));
    else {
      // la flèche est dans le repère de la caméra, le vent vers +x apparaît vers la gauche de l'écran
      const ang = Math.atan2(-wind[0], -wind[1]) - G.yaw; // 0 = vers le haut de l'écran
      w.appendChild(el("i", { html: '<svg viewBox="0 0 30 30" style="transform:rotate(' + (ang * 180 / Math.PI) + 'deg)"><path d="M15 3 L25 19 H18 V27 H12 V19 H5 Z" fill="#ffd84a" stroke="#0b3a2a" stroke-width="2" stroke-linejoin="round"/></svg>' }));
      w.appendChild(el("span", { text: "Vent " + (wl < 1.5 ? "léger" : "fort") }));
      w.dataset.wx = wind[0]; w.dataset.wz = wind[1];
    }
    renderPowers(); renderClubs(); renderBoard(); renderTip(); renderFx();
    if (s.phase === "between" || s.phase === "over") { /* la feuille de résultats gère l'affichage */ }
  }

  // ---------- aide à la visée et caméra ----------
  function pickClub() {
    const me = myState(); if (!me || !G.hole) return;
    const allowed = S().clubs; const d = Math.hypot(G.hole.cup.x - me.x, G.hole.cup.z - me.z);
    const order = d > 70 ? ["driver", "iron"] : d > 38 ? ["iron", "driver"] : d > 18 ? ["wedge", "iron"] : d > 8 ? ["putter", "wedge"] : ["putter"];
    const c = order.find((x) => allowed.includes(x) && !(GR.CLUBS[x].limited && me.rocketUsed)) || "putter";
    G.club = c;
  }
  function resetAim() {
    const me = myState(); if (!me || !G.hole) return;
    const d = Math.hypot(G.hole.cup.x - me.x, G.hole.cup.z - me.z); let tx = G.hole.cup.x, tz = G.hole.cup.z;
    if (d > 30) {
      let k = 0, bd = 1e9; G.hole.path.forEach((p, i) => { const dd = Math.hypot(p.x - me.x, p.z - me.z); if (dd < bd) { bd = dd; k = i; } });
      let j = k; while (j < G.hole.path.length - 1 && Math.hypot(G.hole.path[j].x - me.x, G.hole.path[j].z - me.z) < 22) j++;
      tx = G.hole.path[j].x; tz = G.hole.path[j].z;
    }
    G.yaw = Math.atan2(tx - me.x, tz - me.z);
    if (!G.clubManual) pickClub();
    G.power = clamp(G.club === "putter" ? Math.min(1, d / RANGE.putter * 0.9) : G.power, 0.15, 1);
    V.setCam({ yaw: G.yaw }); renderClubs(); G.traj = null;
  }
  function canAct() {
    const s = G.st, me = myState(); if (!s || !me || s.phase !== "play") return false;
    if (me.finished || me.moving || V.isAnimating(me.id)) return false;
    if (me.fx.frozenUntil && me.fx.frozenUntil > snow()) return false;
    if (s.playMode === "tour" && s.turnPid !== me.id) return false;
    return true;
  }
  function followId() {
    const me = myState(); const s = G.st; if (!s) return null;
    if (me && !me.finished) return me.id;
    if (G.peek) { const p = stPlayer(G.peek); if (p && !p.finished) return p.id; }
    const left = s.players.filter((p) => !p.finished && !p.left); if (!left.length) return me ? me.id : null;
    left.sort((a, b) => GC.flowAt(G.hole, a.x, a.z) - GC.flowAt(G.hole, b.x, b.z)); return left[0].id;
  }
  function currentSpeed(me) {
    const club = GR.CLUBS[G.club]; let sp = club.speed * G.power; if (me.fx.turbo) sp = Math.min(sp * 1.5, 60); if (me.fx.glu) sp *= 0.5; return sp;
  }
  function trajectory(me) {
    const key = [G.club, G.power.toFixed(2), G.yaw.toFixed(3), me.x.toFixed(1), me.z.toFixed(1), me.fx.turbo, me.fx.glu, me.fx.ice, me.fx.magnet, G.st.walls.length].join("|");
    if (key === G.trajKey && G.traj) return G.traj;
    if (Date.now() - G.trajAt < 90) return G.traj; G.trajAt = Date.now(); G.trajKey = key;
    const club = GR.CLUBS[G.club];
    try {
      const res = GP.simulate(G.hole, { x: me.x, y: me.y, z: me.z }, { yaw: G.yaw, speed: currentSpeed(me), loft: club.loft, lob: !!club.lob },
        { t0: (snow() - G.st.playStart) / 1000, wind: G.st.wind, walls: G.st.walls.map((w) => ({ x1: w.x1, z1: w.z1, x2: w.x2, z2: w.z2, h: w.h })), skip: !!club.skip, ice: me.fx.ice, magnet: me.fx.magnet, cupMul: 1 });
      G.traj = res.frames;
    } catch (e) { G.traj = null; }
    return G.traj;
  }

  // ---------- coup ----------
  function fire(power) {
    if (Date.now() - G.sentAt < 500) return;
    if (!G.st || G.st.phase !== "play") { toast("Le trou n'a pas encore commencé.", "error"); return; }
    const me = myState(); if (!me) return;
    if (!canAct()) {
      if (me.finished) toast("Tu as déjà fini ce trou.", "info");
      else if (me.fx.frozenUntil > snow()) toast("Tu es gelé, patiente un instant.", "error");
      else if (G.st.playMode === "tour" && G.st.turnPid !== me.id) toast("Ce n'est pas encore ton tour.", "error");
      return;
    }
    G.sentAt = Date.now(); G.power = power;
    Kit.socket.emit("golf:shoot", { club: G.club, yaw: G.yaw, power });
  }

  // ---------- événements du jeu ----------
  function onShot(m) {
    V.playShot(m.pid, m.frames, m.events, m.t0, m.outcome);
    const mine = m.pid === myId(); const club = GR.CLUBS[m.club];
    sound.noise(0.14, mine ? 0.14 : 0.06, 0, 3200); sound.tone(club && club.speed > 30 ? 180 : 260, 0.1, "triangle", mine ? 0.09 : 0.04, 0, 90);
    const p = stPlayer(m.pid); if (p && !mine) feed((p.name || "?") + " tape avec " + (club ? club.name : "un club"));
    G.sentAt = Date.now();
  }
  function onBallEvent(e) {
    const vol = e.mine ? 1 : 0.35;
    if (e.k === "bounce") sound.tone(160 + (e.v || 3) * 22, 0.07, "sine", 0.07 * vol);
    else if (e.k === "splash") sound.noise(0.4, 0.13 * vol, 0, 1300);
    else if (e.k === "skip") sound.tone(520, 0.06, "sine", 0.05 * vol);
    else if (e.k === "sunk") { if (e.mine) sound.win(); else { sound.tone(700, 0.12, "triangle", 0.07); sound.tone(940, 0.14, "triangle", 0.07, 0.1); } }
    else if (e.k === "hit" || e.k === "bumper") sound.tone(e.k === "bumper" ? 520 : 130, 0.08, e.k === "bumper" ? "triangle" : "square", 0.06 * vol, 0, e.k === "bumper" ? 880 : 90);
    else if (e.k === "boost") sound.tone(380, 0.16, "sawtooth", 0.05 * vol, 0, 900);
    else if (e.k === "tramp") sound.tone(260, 0.22, "sine", 0.08 * vol, 0, 720);
    else if (e.k === "portal") sound.tone(540, 0.28, "sine", 0.07 * vol, 0, 180);
    else if (e.k === "orb") { sound.tone(700, 0.1, "triangle", 0.09 * vol); sound.tone(1050, 0.16, "triangle", 0.09 * vol, 0.08); }
    else if (e.k === "ob") sound.fail();
    else if (e.k === "end") {
      const p = G.st && stPlayer(e.id); if (p && !p.moving) V.setBallRest(e.id, p);
      if (e.id === myId()) G.needAim = true;
    }
  }
  function onFx(m) {
    const me = myState(); const nameOf = (id) => { const p = stPlayer(id); return p ? p.name : "?"; };
    const pw = GR.POWERS[m.power];
    if (m.kind === "gain") {
      const mine = m.pid === myId();
      if (mine) { sound.tone(780, 0.12, "triangle", 0.1); sound.tone(1040, 0.12, "triangle", 0.1, 0.1); sound.tone(1320, 0.2, "triangle", 0.1, 0.2); setBanner(pw.icon + " " + pw.name, "Nouveau pouvoir", 1600); }
      feed(mine ? "Tu gagnes " + pw.name : nameOf(m.pid) + " ramasse un pouvoir");
    } else if (m.kind === "power" && pw) {
      const tgt = m.target ? nameOf(m.target) : "";
      if (m.blocked) feed("La bulle de " + tgt + " bloque " + pw.name);
      else feed(nameOf(m.pid) + " lance " + pw.icon + " " + pw.name + (pw.kind === "hostile" && tgt ? " sur " + tgt : ""));
      const tb = m.target && V.ballPos(m.target); const sb = V.ballPos(m.pid);
      if (m.target === myId() && !m.blocked && pw.kind === "hostile") { V.shake(0.5); sound.fail(); setBanner(pw.icon + " " + pw.name, nameOf(m.pid) + " t'embête", 1700); }
      if (tb && pw.kind === "hostile") V.burst(tb.x, tb.y + 0.6, tb.z, "#ff6a5a", 20, 4, 5, 1.3);
      if (sb && pw.kind === "self") V.burst(sb.x, sb.y + 0.6, sb.z, "#7aff9a", 20, 3.5, 5, 1.2);
      if (m.pid === myId()) sound.tone(480, 0.2, "sawtooth", 0.07, 0, 900);
      G.needAim = G.needAim || m.pid === myId();
    }
  }
  function onHoleEnd(m) {
    clockSample(m.now); G.endInfo = m;
    const rows = m.rows.slice().sort((a, b) => (b.done - a.done) || (a.place - b.place) || (a.eff - b.eff));
    const tbl = el("table", { class: "tbl" }, [
      el("thead", {}, [el("tr", {}, [el("th", { text: "Joueur" }), el("th", { class: "r", text: "Coups" }), el("th", { class: "r", text: "Place" }), el("th", { class: "r", text: "Points" }), el("th", { class: "r", text: "Total" })])]),
      el("tbody", {}, rows.map((r) => {
        const p = stPlayer(r.id) || {};
        return el("tr", {}, [el("td", {}, [el("span", { class: "dotc", style: { background: hexOf(p.color) } }), p.name || "?"]), el("td", { class: "r", text: r.done ? String(r.strokes) : "abandon" }), el("td", { class: "r", text: r.done ? (r.place === 1 ? "🥇" : r.place === 2 ? "🥈" : r.place === 3 ? "🥉" : r.place + "e") : "-" }), el("td", { class: "r", text: (r.pts >= 0 ? "+" : "") + r.pts }), el("td", { class: "r", text: String(r.total) })]);
      })),
    ]);
    const note = el("p", { id: "sheet-next", class: "muted small", text: "" });
    openSheet([el("h2", { text: "Trou " + (m.index + 1) + " terminé" }), el("p", { class: "muted", text: m.name + " · par " + m.par }), tbl, note]);
    G.sheet = { kind: "end", note };
  }
  function onOver(m) {
    G.endInfo = null;
    const rows = m.rows; const top = rows.slice(0, 3);
    const order = top.length === 1 ? [top[0]] : top.length === 2 ? [top[1], top[0]] : [top[1], top[0], top[2]];
    const pod = el("div", { class: "podium" }, order.map((r) => el("div", { class: "pod pod--" + r.rank }, [el("div", { class: "pod__ball", style: { background: hexOf(r.color) } }), el("div", { class: "pod__nm", text: r.name }), el("div", { class: "pod__bar", text: r.rank === 1 ? "1" : r.rank === 2 ? "2" : "3" })])));
    const unit = m.scoring === "coups" ? "coups" : "points";
    const tbl = el("table", { class: "tbl" }, [
      el("thead", {}, [el("tr", {}, [el("th", { text: "" }), el("th", { text: "Joueur" }), el("th", { class: "r", text: unit === "points" ? "Points" : "Coups" }), el("th", { class: "r", text: unit === "points" ? "Coups" : "Trous gagnés" }), el("th", { class: "r", text: "Trous en un" })])]),
      el("tbody", {}, rows.map((r) => el("tr", {}, [el("td", { text: String(r.rank) }), el("td", {}, [el("span", { class: "dotc", style: { background: hexOf(r.color) } }), r.name + (r.left ? " (parti)" : "")]), el("td", { class: "r", text: String(unit === "points" ? r.pts : r.totalStrokes) }), el("td", { class: "r", text: String(unit === "points" ? r.totalStrokes : r.holesWon) }), el("td", { class: "r", text: String(r.aces) })]))),
    ]);
    const host = Kit.isHost();
    const btns = el("div", { class: "row" }, [
      el("button", { class: "btn btn--ghost", text: "Copier la graine " + m.seed, onclick: () => { try { navigator.clipboard.writeText(m.seed); toast("Graine copiée.", "info"); } catch (e) { toast("Graine " + m.seed, "info"); } } }),
      el("button", { class: "btn btn--ghost", text: "Quitter", onclick: () => Kit.confirm("Quitter la partie et revenir à l'accueil ?", () => Kit.leave()) }),
      host ? el("button", { class: "btn btn--accent", text: "Retour au salon", onclick: () => Kit.backToLobby() }) : el("span", { class: "muted small", text: "L'hôte peut relancer une partie depuis le salon." }),
    ]);
    openSheet([el("h2", { text: "Fin de la partie" }), pod, tbl, btns]); G.sheet = { kind: "over" };
    sound.win();
  }

  // ---------- feuille de résultats ----------
  function openSheet(nodes) { const s = $("#sheet"); s.innerHTML = ""; const card = el("div", { class: "card" }, nodes); s.appendChild(card); s.classList.remove("hidden"); }
  function closeSheet() { const s = $("#sheet"); if (s) { s.classList.add("hidden"); s.innerHTML = ""; } G.sheet = null; }

  // ---------- interface ----------
  let bannerTimer = 0;
  function setBanner(big, small, ms) {
    const c = $("#hud-center"); if (!c) return; c.innerHTML = "";
    const b = el("div", { class: "banner", text: big }); if (small) b.appendChild(el("small", { text: small })); c.appendChild(b);
    clearTimeout(bannerTimer); if (ms) bannerTimer = setTimeout(() => { c.innerHTML = ""; }, ms);
  }
  const feedList = [];
  function feed(text) {
    const c = $("#hud-center"); if (!c) return; const line = el("div", { class: "pill say", text, "data-feed": "1" });
    feedList.push(line); while (feedList.length > 3) { const o = feedList.shift(); o.remove(); }
    const box = ensureFeedBox(); box.appendChild(line); setTimeout(() => { line.remove(); const i = feedList.indexOf(line); if (i >= 0) feedList.splice(i, 1); }, 4200);
  }
  function ensureFeedBox() {
    let b = $("#hud-feed"); if (!b) { b = el("div", { id: "hud-feed", class: "hud-center nopoint", style: { top: "auto", bottom: "13.5rem", display: "flex", flexDirection: "column", alignItems: "center", gap: "0.2rem" } }); $("#hud").appendChild(b); }
    return b;
  }
  function renderBoard() {
    const s = G.st; if (!s) return; const box = $("#hud-board"); box.innerHTML = "";
    const lead = s.scoring === "coups" ? "coups" : "points";
    box.appendChild(el("h4", {}, [el("span", { text: s.playMode === "tour" ? "Tour par tour" : "Course" }), el("span", { text: lead === "points" ? "pts" : "total" })]));
    const me = myId();
    const list = s.players.slice().sort((a, b) => (lead === "points" ? b.pts - a.pts : a.totalStrokes - b.totalStrokes));
    list.forEach((p) => {
      const status = p.finished ? (p.capped ? "🏳️" : "✅ " + p.strokes) : p.moving ? "🏌️" : p.fx.frozenUntil > snow() ? "❄️" : String(p.strokes);
      const row = el("div", { class: "brow" + (p.id === me ? " brow--you" : "") + (s.playMode === "tour" && s.turnPid === p.id ? " brow--turn" : "") + (myState() && myState().finished && !p.finished ? " brow--peek" : ""),
        title: p.auto ? "Joué par un automate" : p.connected ? "" : "Déconnecté", onclick: () => { const m = myState(); if (m && m.finished && !p.finished) { G.peek = p.id; } } }, [
        el("i", { style: { background: hexOf(p.color) } }), el("span", { class: "nm", text: p.name + (p.isBot ? " 🤖" : p.auto ? " 🤖" : !p.connected ? " 💤" : "") }),
        el("span", { class: "st", text: status }), el("span", { class: "pt", text: String(lead === "points" ? p.pts : p.totalStrokes) })]);
      box.appendChild(row);
    });
  }
  function renderClubs() {
    const box = $("#hud-clubs"); if (!box) return; const me = myState(); box.innerHTML = "";
    const allowed = GR.CLUB_ORDER.filter((c) => S().clubs.includes(c));
    allowed.forEach((id, i) => {
      const c = GR.CLUBS[id]; const off = c.limited && me && me.rocketUsed;
      const b = el("button", { class: "club" + (G.club === id ? " club--on" : ""), disabled: !!off, title: c.name + ". " + c.desc, onclick: () => { G.club = id; G.clubManual = true; sound.click(); renderClubs(); } }, [el("kbd", { text: String(i + 1) }), el("span", { text: c.icon }), c.name + (c.limited ? (off ? " (utilisée)" : " x1") : "")]);
      box.appendChild(b);
    });
  }
  function renderPowers() {
    const box = $("#hud-powers"); if (!box) return; box.innerHTML = ""; const me = myState();
    if (!S().powersOn || !me) return;
    me.powers.forEach((id) => {
      const p = GR.POWERS[id];
      box.appendChild(el("button", { class: "pw pw--" + p.kind, title: p.desc, onclick: () => usePower(id) }, [el("span", { text: p.icon }), p.name]));
    });
    if (!me.powers.length) box.appendChild(el("span", { class: "pill tip", style: { padding: "0.15rem 0.7rem" }, text: "Roule sur une orbe dorée pour gagner un pouvoir" }));
  }
  function usePower(id) {
    const me = myState(); const p = GR.POWERS[id]; if (!me || !p) return;
    if (p.kind === "self") { Kit.socket.emit("golf:power", { id }); return; }
    const foes = G.st.players.filter((q) => q.id !== me.id && !q.finished && !q.left);
    if (!foes.length) { toast("Personne à viser pour le moment.", "error"); return; }
    if (foes.length === 1) { Kit.socket.emit("golf:power", { id, target: foes[0].id }); return; }
    const box = $("#hud-pick"); box.innerHTML = "";
    box.appendChild(el("p", { text: p.icon + " " + p.name + " · " + p.desc }));
    box.appendChild(el("div", { class: "row" }, foes.map((f) => el("button", { class: "btn btn--small btn--plum", onclick: () => { Kit.socket.emit("golf:power", { id, target: f.id }); box.classList.add("hidden"); } }, [el("span", { class: "dotc", style: { background: hexOf(f.color) } }), f.name]))));
    box.appendChild(el("button", { class: "btn btn--small btn--ghost", text: "Annuler", onclick: () => box.classList.add("hidden") }));
    box.classList.remove("hidden");
  }
  function renderTip() {
    const t = $("#hud-tip"); if (!t) return; const s = G.st, me = myState(); let txt = "";
    if (!s || !me) { t.textContent = ""; return; }
    if (s.phase === "play" && me.finished) txt = me.capped ? "Balle ramassée. Touche un joueur du tableau pour le suivre." : "Trou terminé. Touche un joueur du tableau pour le suivre.";
    else if (s.phase === "play" && s.playMode === "tour" && s.turnPid !== me.id) { const p = stPlayer(s.turnPid); txt = p ? "Au tour de " + p.name + ". Prépare ta visée." : ""; }
    else if (s.phase === "play") txt = "Glisse pour viser, molette pour zoomer. Clique sur Taper, ou maintiens pour charger.";
    t.textContent = txt;
  }
  function renderFx() {
    const box = $("#hud-fx"); if (!box) return; box.innerHTML = ""; const me = myState(); if (!me) return;
    const now = snow(); const add = (txt) => box.appendChild(el("span", { class: "pill", text: txt }));
    if (me.fx.glu) add("🍯 Prochain coup réduit de moitié"); if (me.fx.gust) add("💨 Bourrasque au prochain coup"); if (me.fx.invert) add("🙃 Visée inversée"); if (me.fx.ice) add("🧊 Balle glissante");
    if (me.fx.turbo) add("🚀 Turbo prêt"); if (me.fx.magnet) add("🧲 Aimant prêt"); if (me.fx.bubble) add("🫧 Bulle active");
    if (me.fx.frozenUntil > now) add("❄️ Gelé encore " + Math.ceil((me.fx.frozenUntil - now) / 1000) + " s");
    $("#fx-fog").classList.toggle("overlay-fx--on", me.fx.fogUntil > now); $("#fx-ice").classList.toggle("overlay-fx--on", me.fx.frozenUntil > now);
  }

  // ---------- entrées ----------
  function wireInput() {
    const host = $("#gl-host");
    const rot = (dx) => { const me = myState(); const inv = me && me.fx.invert ? -1 : 1; G.yaw -= dx * 0.0055 * inv; };
    host.addEventListener("pointerdown", (e) => { host.setPointerCapture(e.pointerId); G.pointers.set(e.pointerId, { x: e.clientX, y: e.clientY }); if (G.pointers.size === 2) { const a = [...G.pointers.values()]; G.pinch = Math.hypot(a[0].x - a[1].x, a[0].y - a[1].y); } });
    host.addEventListener("pointermove", (e) => {
      const p = G.pointers.get(e.pointerId); if (!p) return; const dx = e.clientX - p.x, dy = e.clientY - p.y; p.x = e.clientX; p.y = e.clientY;
      if (G.pointers.size === 2) { const a = [...G.pointers.values()]; const d = Math.hypot(a[0].x - a[1].x, a[0].y - a[1].y); const cs = V.camState(); V.setCam({ dist: cs.dist * (G.pinch / Math.max(20, d)) }); G.pinch = d; return; }
      rot(dx); const cs = V.camState(); V.setCam({ pitch: cs.pitch + dy * 0.004 });
    });
    const up = (e) => { G.pointers.delete(e.pointerId); };
    host.addEventListener("pointerup", up); host.addEventListener("pointercancel", up);
    host.addEventListener("wheel", (e) => { e.preventDefault(); if (e.shiftKey) { G.power = clamp(G.power - Math.sign(e.deltaY) * 0.03, 0.05, 1); } else { const cs = V.camState(); V.setCam({ dist: cs.dist * (1 + Math.sign(e.deltaY) * 0.1) }); } }, { passive: false });
    $("#btn-zoomin").onclick = () => { const cs = V.camState(); V.setCam({ dist: cs.dist * 0.85 }); };
    $("#btn-zoomout").onclick = () => { const cs = V.camState(); V.setCam({ dist: cs.dist * 1.18 }); };
    $("#btn-menu").onclick = openMenu;
    // jauge de force
    const pw = $("#power"); let drag = false;
    const setP = (e) => { const r = pw.getBoundingClientRect(); G.power = clamp(Math.round(((e.clientX - r.left) / r.width) * 100) / 100, 0.05, 1); };
    pw.addEventListener("pointerdown", (e) => { drag = true; pw.setPointerCapture(e.pointerId); setP(e); }); pw.addEventListener("pointermove", (e) => { if (drag) setP(e); }); pw.addEventListener("pointerup", () => { drag = false; });
    // bouton taper
    const sb = $("#btn-shoot");
    const down = (e) => { e.preventDefault(); if (G.charging) return; G.charging = true; G.chargeAt = performance.now(); G.chargeBase = G.power; };
    const rel = (e) => { if (!G.charging) return; e.preventDefault(); const held = performance.now() - G.chargeAt; G.charging = false; fire(held <= 220 ? G.chargeBase : G.power); };
    sb.addEventListener("pointerdown", down); sb.addEventListener("pointerup", rel); sb.addEventListener("pointerleave", (e) => { if (G.charging) rel(e); });
    window.addEventListener("keydown", (e) => {
      if (document.body.dataset.screen !== "game") return; if (/INPUT|TEXTAREA|SELECT/.test((e.target.tagName || ""))) return;
      const k = e.key.toLowerCase(); G.keys[k] = true;
      if (k === " " || k === "enter") { e.preventDefault(); if (!G.charging && !e.repeat) { G.charging = true; G.chargeAt = performance.now(); G.chargeBase = G.power; } }
      else if (/^[1-7]$/.test(k)) { const list = GR.CLUB_ORDER.filter((c) => S().clubs.includes(c)); const id = list[+k - 1]; if (id) { const me = myState(); if (!(GR.CLUBS[id].limited && me && me.rocketUsed)) { G.club = id; G.clubManual = true; renderClubs(); } } }
      else if (k === "arrowup" || k === "z" || k === "w") { e.preventDefault(); G.power = clamp(G.power + (e.shiftKey ? 0.1 : 0.02), 0.05, 1); }
      else if (k === "arrowdown" || k === "s") { e.preventDefault(); G.power = clamp(G.power - (e.shiftKey ? 0.1 : 0.02), 0.05, 1); }
      else if (k === "escape") { $("#hud-pick").classList.add("hidden"); }
    });
    window.addEventListener("keyup", (e) => {
      const k = e.key.toLowerCase(); G.keys[k] = false;
      if ((k === " " || k === "enter") && G.charging) { const held = performance.now() - G.chargeAt; G.charging = false; fire(held <= 220 ? G.chargeBase : G.power); }
    });
  }
  function openMenu() {
    const q = store.get("golf.quality", autoQuality());
    const qs = [["low", "Basse"], ["medium", "Moyenne"], ["high", "Haute"]];
    const row = (title, info, control) => el("div", { class: "menu-row" }, [el("div", {}, [el("b", { text: title }), el("p", { class: "small muted", text: info })]), control]);
    const qbox = el("div", { class: "chips" }, qs.map(([v, l]) => el("button", { class: "chip" + (q === v ? " chip--on" : ""), text: l, onclick: (ev) => { store.set("golf.quality", v); V.setQuality(v); ev.target.parentNode.querySelectorAll(".chip").forEach((c) => c.classList.remove("chip--on")); ev.target.classList.add("chip--on"); } })));
    const sbtn = el("button", { class: "btn btn--small btn--ghost", text: sound.enabled ? "Son activé" : "Son coupé", onclick: (ev) => { ev.target.textContent = sound.toggle() ? "Son activé" : "Son coupé"; } });
    const keys = el("div", { class: "keys" }, [
      el("kbd", { text: "Glisser" }), el("span", { text: "Tourner la visée et incliner la caméra." }),
      el("kbd", { text: "Flèches gauche droite ou Q D" }), el("span", { text: "Tourner la visée. Avec Maj, tourner plus finement." }),
      el("kbd", { text: "Flèches haut bas ou Z S" }), el("span", { text: "Régler la force du coup." }),
      el("kbd", { text: "1 à 7" }), el("span", { text: "Choisir son club." }),
      el("kbd", { text: "Espace" }), el("span", { text: "Un appui rapide tape avec la force réglée. Un appui long charge la force, on relâche pour taper." }),
      el("kbd", { text: "Molette" }), el("span", { text: "Zoom de la caméra." }),
    ]);
    const clubs = el("div", {}, GR.CLUB_ORDER.map((id) => el("p", { class: "small", text: GR.CLUBS[id].icon + " " + GR.CLUBS[id].name + " · " + GR.CLUBS[id].desc })));
    const pows = el("div", {}, GR.POWER_ORDER.map((id) => el("p", { class: "small", text: GR.POWERS[id].icon + " " + GR.POWERS[id].name + " · " + GR.POWERS[id].desc })));
    Kit.showModal("Menu", [
      row("Qualité graphique", "Basse retire les ombres et allège l'affichage, utile sur téléphone ou ordinateur modeste.", qbox),
      row("Sons", "Coups, rebonds, plouf et pouvoirs.", sbtn),
      el("h3", { text: "Commandes", style: { marginTop: "0.8rem" } }), keys,
      el("h3", { text: "Les clubs", style: { marginTop: "0.8rem" } }), clubs,
      el("h3", { text: "Les pouvoirs", style: { marginTop: "0.8rem" } }), pows,
      el("button", { class: "btn btn--danger btn--small", style: { marginTop: "0.8rem" }, text: "Quitter la partie", onclick: () => Kit.confirm("Quitter la partie et revenir à l'accueil ?", () => { $("#modal").classList.add("hidden"); Kit.leave(); }) }),
    ]);
  }

  // ---------- boucle d'interface ----------
  let lastFrame = performance.now();
  function frame(now) {
    requestAnimationFrame(frame);
    const dt = Math.min(0.05, (now - lastFrame) / 1000); lastFrame = now;
    if (document.body.dataset.screen !== "game" || !G.st || !G.hole || !G.viewInit) return;
    const me = myState(); const fid = followId(); V.follow(fid);
    if (me && G.needAim && !me.moving && !V.isAnimating(me.id) && G.st.phase === "play") { G.needAim = false; resetAim(); }
    // rotation au clavier
    const inv = me && me.fx.invert ? -1 : 1; const fine = G.keys["shift"] ? 0.25 : 1;
    const dir = ((G.keys["arrowleft"] || G.keys["q"] || G.keys["a"]) ? 1 : 0) - ((G.keys["arrowright"] || G.keys["d"]) ? 1 : 0);
    if (dir) G.yaw += dir * dt * 1.1 * fine * inv;
    // charge
    if (G.charging) { const held = performance.now() - G.chargeAt; if (held > 220) G.power = clamp((held - 220) / 1500, 0.03, 1); }
    // caméra
    const animating = fid && V.isAnimating(fid);
    if (fid === (me && me.id) && !animating) V.setCam({ yaw: G.yaw });
    else if (!animating && fid !== (me && me.id)) { /* le spectateur tourne la caméra en glissant */ V.setCam({ yaw: G.yaw }); }
    // visée
    const showAim = !!(me && G.st.phase === "play" && !me.finished && !me.moving && !animating && fid === me.id);
    const mode = S().aimAssist === "traj" ? "trajectoire" : S().aimAssist === "none" ? "aucune" : "points";
    if (showAim) {
      const len = clamp(RANGE[G.club] * Math.pow(G.power, 1.5) * 0.95 + 1, 2, 70);
      V.setAim(true, me.x, me.y, me.z, G.yaw, len, mode, mode === "trajectoire" ? trajectory(me) : null);
    } else V.setAim(false);
    // jauge
    const fill = $("#power-fill"); if (fill) { fill.style.width = (G.power * 100).toFixed(1) + "%"; $("#power-txt").textContent = Math.round(G.power * 100) + " pour cent"; }
    const btn = $("#btn-shoot"); if (btn) { const ok = canAct(); btn.disabled = false; btn.style.opacity = ok ? 1 : 0.55; }
    // carte
    if (now - G.lastMini > 100) {
      G.lastMini = now; const cv = $("#hud-mini");
      const players = G.st.players.filter((p) => !(p.finished && !p.moving)).map((p) => { const bp = V.ballPos(p.id) || p; return { x: bp.x, z: bp.z, hex: hexOf(p.color), you: me && p.id === me.id }; });
      const orbs = G.hole.orbs.map((o) => { const so = G.st.orbs.find((q) => q.id === o.id); return { x: o.x, z: o.z, taken: so ? so.taken : false }; });
      M.draw(cv, G.hole, { players, orbs: S().powersOn ? orbs : [], path: false, aim: showAim ? { x: me.x, z: me.z, yaw: G.yaw } : null });
    }
    // rythme lent, compte à rebours et horloges
    if (now - G.lastSlow > 200) {
      G.lastSlow = now; const s = G.st;
      if (s.phase === "countdown") {
        const n = Math.ceil((s.phaseUntil - snow()) / 1000);
        if (n !== G.lastCount) { G.lastCount = n; if (n > 0) sound.tone(560, 0.08, "triangle", 0.08); }
        if (n > 0) setBanner(String(n), G.hole.name + " · " + GC.BIOMES[G.hole.biome].name, 0); else setBanner("Partez", null, 0);
      } else if (G.lastCount !== -99) { G.lastCount = -99; if (!document.querySelector("#hud-center .banner small") || true) { /* la bannière Partez disparaît seule */ } }
      if (s.phase === "play" && s.playMode === "tour" && s.turnPid) {
        const left = Math.max(0, Math.ceil((s.turnUntil - snow()) / 1000)); const tp = stPlayer(s.turnPid);
        const c = $("#hud-fx"); if (c && tp && !c.querySelector(".turnchip")) { const chip = el("span", { class: "pill turnchip", text: "" }); c.prepend(chip); }
        const chip = c && c.querySelector(".turnchip"); if (chip && tp) chip.textContent = (tp.id === myId() ? "À toi de jouer" : "Au tour de " + tp.name) + " · " + left + " s";
      }
      if (G.sheet && G.sheet.kind === "end" && G.endInfo) { const left = Math.max(0, Math.ceil((G.endInfo.until - snow()) / 1000)); G.sheet.note.textContent = G.endInfo.last ? "C'est le dernier trou, les résultats arrivent." : "Prochain trou dans " + left + " s."; }
      renderFx(); renderBoard();
    }
  }

  // ---------- aperçu du terrain dans le salon ----------
  function terrainKey(s) { return JSON.stringify([s.biomes, s.biomeOrder, s.holeLength, s.difficulty, s.hills, s.hazards, s.obstacles, s.features, s.wind, s.powersOn, s.orbs, s.cupSize, s.seed, G.prev.seed, G.prev.idx]); }
  function renderPreview(box, room) {
    const s = room.settings; const host = Kit.isHost();
    const seeded = !!(s.seed && s.seed.trim());
    if (!seeded && !G.prev.seed) G.prev.seed = Math.random().toString(36).slice(2, 8);
    const seed = seeded ? s.seed.trim() : G.prev.seed; if (seeded && G.prev.idx >= s.holes) G.prev.idx = 0;
    const idx = seeded ? G.prev.idx : 0;
    const key = terrainKey(s) + "|" + seed + "|" + idx;
    if (key !== G.prev.key) { try { G.prev.hole = GR.holeFor(s, seed, idx); } catch (e) { G.prev.hole = null; console.error(e); } G.prev.key = key; }
    box.innerHTML = ""; const h = G.prev.hole; if (!h) return;
    const b = GC.BIOMES[h.biome];
    const cv = el("canvas", { width: 300, height: 520, style: { width: "150px", height: "260px", borderRadius: "12px", background: "#0b3a2a33", flex: "none" } });
    const feats = []; const cnt = (n, w) => { if (n) feats.push(n + " " + w); };
    cnt(h.bars.length, h.bars.length > 1 ? "moulins" : "moulin"); cnt(h.sliders.length, h.sliders.length > 1 ? "barrières" : "barrière"); cnt(h.bumpers.length, h.bumpers.length > 1 ? "bumpers" : "bumper"); cnt(h.tramps.length, h.tramps.length > 1 ? "trampolines" : "trampoline"); cnt(h.portals.length, h.portals.length > 1 ? "paires de portails" : "paire de portails"); cnt(h.pads.length, h.pads.length > 1 ? "tapis turbo" : "tapis turbo");
    const info = el("div", { style: { flex: 1, minWidth: "140px" } }, [
      el("div", { class: "meta", style: { textAlign: "left" }, text: b.icon + " " + h.name }),
      el("p", { class: "small", text: b.name + " · par " + h.par + " · environ " + Math.round(h.len) + " m" }),
      el("p", { class: "small muted", text: feats.length ? "On y trouve " + feats.join(", ") + "." : "Un terrain tout simple, sans animation." }),
      el("p", { class: "small muted", text: seeded ? "Parcours fixé par la graine " + seed + (s.holes > 1 ? ". Trou " + (idx + 1) + " sur " + s.holes + "." : ".") : "Simple aperçu d'un terrain possible. Fixe la graine pour jouer exactement celui-ci." }),
      el("div", { class: "row", style: { justifyContent: "flex-start" } }, [
        seeded && s.holes > 1 ? el("button", { class: "btn btn--small btn--ghost", text: "◀", onclick: () => { G.prev.idx = (idx + s.holes - 1) % s.holes; renderPreview(box, Kit.room); } }) : null,
        seeded && s.holes > 1 ? el("button", { class: "btn btn--small btn--ghost", text: "▶", onclick: () => { G.prev.idx = (idx + 1) % s.holes; renderPreview(box, Kit.room); } }) : null,
        seeded ? (host ? el("button", { class: "btn btn--small btn--green", text: "Générer un autre parcours", onclick: () => { G.prev.idx = 0; Kit.socket.emit("room:settings", { settings: { seed: Math.random().toString(36).slice(2, 8) } }); } }) : null)
          : el("button", { class: "btn btn--small btn--green", text: "Générer un autre terrain", onclick: () => { G.prev.seed = Math.random().toString(36).slice(2, 8); renderPreview(box, Kit.room); } }),
        !seeded && host ? el("button", { class: "btn btn--small btn--accent", text: "Jouer ce parcours", onclick: () => { G.prev.idx = 0; Kit.socket.emit("room:settings", { settings: { seed: seed } }); } }) : null,
        seeded && host ? el("button", { class: "btn btn--small btn--ghost", text: "Retirer la graine", onclick: () => Kit.socket.emit("room:settings", { settings: { seed: "" } }) }) : null,
      ]),
    ]);
    box.appendChild(el("div", { class: "lobby-prev" }, [el("h3", { text: "Aperçu du terrain" }), el("div", { style: { display: "flex", gap: "0.8rem", flexWrap: "wrap", marginTop: "0.4rem" } }, [cv, info])]));
    M.draw(cv, h, { path: true, specials: true, orbs: s.powersOn ? h.orbs : [], pad: 8 });
  }

  // ---------- démarrage ----------
  function attach() {
    const so = Kit.socket; if (!so || G.attached) return; G.attached = true;
    so.on("golf:hole", loadHole); so.on("golf:state", onState); so.on("golf:shot", onShot); so.on("golf:fx", onFx); so.on("golf:holeEnd", onHoleEnd); so.on("golf:over", onOver);
  }
  Kit.on("screen", (name) => { V.paused = name !== "game"; if (name === "game") setTimeout(() => { if (G.viewInit) V.resize(); }, 50); });
  Kit.on("reset", () => { G.st = null; G.hole = null; G.holeIdx = -1; closeSheet(); G.prev.key = ""; });
  Kit.on("room", (r) => { if (r.status === "lobby") { G.st = null; closeSheet(); } });
  window.GolfGame = G;

  Kit.init({
    id: "golfouille", title: "Golfouille", emoji: "⛳", ribbon: "Le golf en folie", tagline: "Des terrains qui n'existent pas encore, des pouvoirs pour embêter les copains.",
    createLabel: "Créer un salon", soloLabel: "Jouer contre des bots", startLabel: "Lancer la partie", helpTitle: "Comment jouer",
    floaters: [{ e: "⛳", x: 6 }, { e: "🏌️", x: 22 }, { e: "🌵", x: 38 }, { e: "⛄", x: 52 }, { e: "🪐", x: 66 }, { e: "🌴", x: 80 }, { e: "🍭", x: 92 }],
    colors: COLORS, botLevels: LEVELS, maxPlayers: 6, minPlayers: 1, schema: GR.SCHEMA,
    help: [
      { title: "Le but", text: "Chaque trou est un terrain tiré au hasard, avec son décor et ses pièges. Mets ta balle dans le trou en un minimum de coups, et si possible avant les autres." },
      { title: "Taper", text: "Glisse sur l'écran ou utilise les flèches pour viser. Règle la force avec la jauge, choisis un club, puis appuie sur Taper. Un appui long charge la force, on relâche pour frapper." },
      { title: "Les clubs", text: "Le driver va loin, le fer sert à tout, la cale et le lob passent par dessus les obstacles, le putter est précis sur le green, le ricochet traverse l'eau et la fusée ne se joue qu'une fois par trou." },
      { title: "Les orbes et les pouvoirs", text: "Roule sur une orbe dorée pour gagner un pouvoir au hasard. Certains aident ta balle, d'autres embêtent un adversaire. Ils se lancent à tout moment, même pendant que la balle des autres roule." },
      { title: "Les pièges", text: "Eau, lave et sortie de terrain coûtent un coup. Le sable et la boue freinent, la glace fait glisser, la gelée fait rebondir. Les moulins, barrières, trampolines et portails sont des animations du terrain que l'hôte peut régler." },
      { title: "Les points", text: "Selon le décompte choisi, les points viennent de l'ordre d'arrivée, des coups, ou des deux. Un trou en un rapporte un bonus en mode arrivée." },
    ],
    theme: { a1: "#ffe27a", a2: "#f0a81c", bg1: "#1f7a4d", bg2: "#0b3a2a" },
    renderPreview,
    onInit() { buildGame(); attach(); Kit.on("connect", attach); requestAnimationFrame(frame); },
  });
})();

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
  const LIE = { 0: "Fairway, la balle roule bien.", 1: "Green, la balle roule loin et droit.", 2: "Rough, la balle freine vite.", 3: "Sable, la balle s'arrête presque tout de suite.", 5: "Glace, la balle glisse très loin.", 6: "Boue, la balle s'arrête net.", 8: "Gelée, la balle rebondit partout." };
  const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
  const hexOf = (c) => COLORS[(c || 0) % COLORS.length].hex;

  const G = {
    hole: null, holeIdx: -1, total: 0, st: null, samples: [], offset: 0, club: "driver", height: 2, clubManual: false, power: 0.65, yaw: 0, charging: false, chargeAt: 0, keys: {},
    viewInit: false, flown: false, needAim: false, peek: null, prevPhase: "", lastTurn: null, sentAt: 0, sheet: null, lastCount: -99, endInfo: null,
    prev: { seed: "", idx: 0, key: "", hole: null }, pred: null, predAt: 0, predKey: "", ranges: {}, rangeKey: "", suggest: null, aimDist: null, top: false, topZoom: 1, tap: null, lastInfo: "", lastMini: 0, lastSlow: 0, wasMoving: false, pointers: new Map(), pinch: 0,
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
        el("button", { class: "round-btn round-btn--on", id: "btn-top", title: "Vue du dessus pour mieux viser (touche V)", text: "🗺️" }),
        el("button", { class: "round-btn", id: "btn-caddie", title: "Conseil du caddie, il vise pour toi (touche C)", text: "🧭" }),
        el("button", { class: "round-btn", id: "btn-zoomin", title: "Rapprocher la caméra", text: "＋" }),
        el("button", { class: "round-btn", id: "btn-zoomout", title: "Éloigner la caméra", text: "－" }),
      ]),
      el("div", { class: "hud-bottom" }, [
        el("div", { id: "hud-tip", class: "tip nopoint" }),
        el("div", { id: "hud-powers", class: "powers" }),
        el("div", { id: "hud-aim", class: "aiminfo nopoint" }),
        el("div", { class: "shootrow" }, [
          el("button", { id: "pw-minus", class: "round-btn round-btn--small", title: "Moins fort", text: "−" }),
          el("div", { id: "power", class: "power", title: "Force du coup, touche la jauge ou glisse dessus" }, [el("div", { id: "power-fill", class: "power__fill" }), el("div", { class: "power__ticks" }), el("div", { id: "power-txt", class: "power__txt" })]),
          el("button", { id: "pw-plus", class: "round-btn round-btn--small", title: "Plus fort", text: "+" }),
          el("button", { id: "btn-shoot", class: "btn btn--accent shootbtn", text: "Taper" }),
        ]),
      ]),
      el("div", { id: "hud-clubs", class: "clubrail" }),
      el("div", { id: "hud-height", class: "heightbox" }),
      el("div", { id: "hud-clubcard", class: "clubcard" }),
      el("div", { id: "hud-cup", class: "cupmark nopoint hidden" }, [el("span", { class: "cupmark__arr", text: "▲" }), el("b", { id: "cupmark-txt" })]),
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
    G.hole = GC.decodeHole(m.hole); G.holeIdx = m.index; G.total = m.total; G.flown = false; G.prevPhase = ""; G.peek = null; G.needAim = false; G.endInfo = null; G.pred = null; G.top = false; G.aimDist = null; G.ranges = {}; G.rangeKey = "";
    closeSheet();
    V.loadHole(G.hole); V.resize();
    $("#hud-hole").innerHTML = "";
    $("#hud-hole").appendChild(el("b", { text: "Trou " + (m.index + 1) + " sur " + m.total }));
    $("#hud-hole").appendChild(el("span", { id: "hud-hole-sub", text: G.hole.name + " · par " + G.hole.par }));
    const b = GC.BIOMES[G.hole.biome];
    $("#hud-hole-sub").textContent = b.icon + " " + G.hole.name + " · par " + G.hole.par;
    V.setCam({ dist: 11, pitch: 0.58 });
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
      if (s.phase === "play" && G.prevPhase !== "play") { V.endFlyover(); G.needAim = true; G.flown = true; setTimeout(() => showTuto(false), 600); if (G.prevPhase === "countdown") { sound.tone(900, 0.25, "triangle", 0.12); setBanner("Partez", null, 900); } }
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

  // ---------- aide à la visée ----------
  const dist2 = (ax, az, bx, bz) => Math.hypot(ax - bx, az - bz);
  // hauteur utilisée pour un club, celle choisie pour le club en main et l'angle habituel pour les autres
  const heightOf = (clubId) => (S().heightControl === false || clubId !== G.club ? GR.HEIGHT_DEFAULT : G.height);
  function simShot(me, clubId, power, yaw) {
    const club = GR.CLUBS[clubId]; let speed = club.speed * power; if (me.fx.turbo) speed = Math.min(speed * 1.5, 60); if (me.fx.glu) speed *= 0.5;
    const opts = { t0: (snow() - G.st.playStart) / 1000, wind: G.st.wind, walls: G.st.walls.map((w) => ({ x1: w.x1, z1: w.z1, x2: w.x2, z2: w.z2, h: w.h })), skip: !!club.skip, ice: me.fx.ice, magnet: me.fx.magnet, cupMul: 1 };
    if (S().powersOn) opts.orbs = G.st.orbs.filter((o) => !o.taken).map((o) => ({ id: o.id, x: o.x, z: o.z, taken: false }));
    return GP.simulate(G.hole, { x: me.x, y: me.y, z: me.z }, { yaw, speed, loft: GR.loftFor(clubId, heightOf(clubId)), lob: !!club.lob }, opts);
  }
  const reach = (me, res) => dist2(res.end.x, res.end.z, me.x, me.z);
  // trouve la force qui amène la balle à la distance voulue avec ce club
  function solvePower(me, clubId, yaw, d) {
    const f = (p) => reach(me, simShot(me, clubId, p, yaw));
    const dMax = f(1); if (dMax <= d) return { p: 1, dist: dMax, ok: dMax > d - 1.5 };
    const dMin = f(0.05); if (dMin >= d) return { p: 0.05, dist: dMin, ok: true };
    let lo = 0.05, hi = 1; for (let i = 0; i < 11; i++) { const mid = (lo + hi) / 2; if (f(mid) < d) lo = mid; else hi = mid; }
    const p = Math.round(((lo + hi) / 2) * 100) / 100; return { p, dist: d, ok: true };
  }
  function allowedClubs(me) { return GR.CLUB_ORDER.filter((c) => S().clubs.includes(c) && !(GR.CLUBS[c].limited && me && me.rocketUsed)); }
  // le caddie compare les clubs pour une distance donnée et garde le plus confortable
  function bestClub(me, yaw, d) {
    const pool = allowedClubs(me).filter((c) => ["putter", "wedge", "iron", "driver"].includes(c) || (c === "lob" && d < 14));
    let best = null;
    pool.forEach((c) => {
      const r = solvePower(me, c, yaw, d); const comfort = Math.abs(r.p - 0.72) + (r.p >= 0.98 ? 0.4 : 0) + (c === "putter" ? (d < 12 ? -0.2 : 0.6) : 0) + (c === "driver" ? 0.04 : 0) + (c === "lob" ? 0.25 : 0);
      if (!best || comfort < best.comfort) best = { club: c, p: r.p, comfort, ok: r.ok };
    });
    return best || { club: "putter", p: 0.5, ok: true };
  }
  function lieNow(me) { try { return LIE[GP.surfAt(G.hole, me.x, me.z)] || ""; } catch (e) { return ""; } }
  // vise un point du terrain, règle la force pour que la balle s'y arrête
  function aimAtPoint(tx, tz, o) {
    const me = myState(); if (!me || !G.hole) return; o = o || {};
    const dx = tx - me.x, dz = tz - me.z; const d = Math.hypot(dx, dz); if (d < 0.8) return;
    G.yaw = Math.atan2(dx, dz); G.aimDist = d;
    const auto = !G.clubManual || o.auto;
    const cand = bestClub(me, G.yaw, d); G.suggest = cand.club;
    if (auto) { G.club = cand.club; G.height = GR.HEIGHT_DEFAULT; G.power = clamp(cand.p, 0.05, 1); }
    else { const r = solvePower(me, G.club, G.yaw, d); G.power = clamp(r.p, 0.05, 1); if (!r.ok && !o.quiet) toast("Ce club ne va pas assez loin, il envoie à " + Math.round(r.dist) + " m au maximum.", "info"); }
    G.pred = null; V.setCam({ yaw: G.yaw }); renderClubs();
  }
  function updateRanges(me) {
    const key = [me.x.toFixed(1), me.z.toFixed(1), G.yaw.toFixed(1), G.club, G.height, !!me.fx.turbo, !!me.fx.glu].join("|"); if (key === G.rangeKey) return; G.rangeKey = key;
    allowedClubs(me).forEach((c) => { try { G.ranges[c] = Math.round(reach(me, simShot(me, c, 1, G.yaw))); } catch (e) { G.ranges[c] = 0; } });
    renderClubs();
  }
  function resetAim() {
    const me = myState(); if (!me || !G.hole) return;
    const d = Math.hypot(G.hole.cup.x - me.x, G.hole.cup.z - me.z); let tx = G.hole.cup.x, tz = G.hole.cup.z;
    if (d > 30) {
      let k = 0, bd = 1e9; G.hole.path.forEach((p, i) => { const dd = Math.hypot(p.x - me.x, p.z - me.z); if (dd < bd) { bd = dd; k = i; } });
      let j = k; while (j < G.hole.path.length - 1 && Math.hypot(G.hole.path[j].x - me.x, G.hole.path[j].z - me.z) < 24) j++;
      tx = G.hole.path[j].x; tz = G.hole.path[j].z;
    } else { const L = d || 1; tx += (tx - me.x) / L * 0.5; tz += (tz - me.z) / L * 0.5; }
    G.clubManual = false; G.rangeKey = "";
    aimAtPoint(tx, tz, { auto: true, quiet: true }); updateRanges(me);
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
  // prévision du coup sans l'erreur de frappe, avec distances et alertes
  function predict(me) {
    const key = [G.club, G.height, S().aimAssist, G.power.toFixed(2), G.yaw.toFixed(3), me.x.toFixed(1), me.z.toFixed(1), me.fx.turbo, me.fx.glu, me.fx.ice, me.fx.magnet, G.st.walls.length, Math.floor(snow() / 1500)].join("|");
    if (key === G.predKey && G.pred) return G.pred;
    if (Date.now() - G.predAt < 80) return G.pred; G.predAt = Date.now(); G.predKey = key;
    try {
      const res = simShot(me, G.club, G.power, G.yaw); const club = GR.CLUBS[G.club]; const f = res.frames; const n = f.length / 3;
      let carry = null, cp = null; for (let i = 4; i < n; i++) { const x = f[i * 3] / 100, y = f[i * 3 + 1] / 100, z = f[i * 3 + 2] / 100; if (y - GP.heightAt(G.hole, x, z) < 0.2) { carry = dist2(x, z, me.x, me.z); cp = { x, z }; break; } }
      const total = reach(me, res); const toCup = dist2(res.end.x, res.end.z, G.hole.cup.x, G.hole.cup.z);
      const sig = club.err * S().precision * (0.35 + 0.65 * G.power) * Math.PI / 180; const lat = total * Math.tan(sig), lon = total * 0.025 * S().precision;
      const sigma = Math.max(0.6, Math.hypot(lat, lon));
      const hitEv = res.events.filter((e) => e.k === "hit"); const hits = hitEv.length; const mover = hitEv.some((e) => e.o === "pale" || e.o === "barriere");
      const warn = res.outcome === "water" ? "Eau, un coup de pénalité" : res.outcome === "lava" ? "Lave, un coup de pénalité" : res.outcome === "ob" ? "Hors limites, un coup de pénalité" : "";
      // zone d'arrivée de l'aide douce, un grand cercle entre l'atterrissage et l'arrêt
      if (!cp) cp = { x: res.end.x, z: res.end.z };
      const roll = Math.max(0, total - (carry == null ? total : carry));
      const zone = { cx: (cp.x + res.end.x) / 2, cz: (cp.z + res.end.z) / 2, r: dist2(cp.x, cp.z, res.end.x, res.end.z) / 2 + Math.max(2.4, sigma * 1.4) + total * 0.05 };
      G.pred = { zone, roll, res, frames: f, events: res.events, outcome: res.outcome, carry: carry == null ? total : carry, total, toCup, sigma, hits, mover, warn, sunk: res.outcome === "sunk" };
    } catch (e) { console.error(e); G.pred = null; }
    return G.pred;
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
    G.sentAt = Date.now(); G.power = power; G.top = false;
    Kit.socket.emit("golf:shoot", { club: G.club, yaw: G.yaw, power, height: S().heightControl === false ? GR.HEIGHT_DEFAULT : G.height });
  }

  // ---------- événements du jeu ----------
  function onShot(m) {
    V.playShot(m.pid, m.frames, m.events, m.t0, m.outcome);
    const mine = m.pid === myId(); const club = GR.CLUBS[m.club];
    sound.noise(0.14, mine ? 0.14 : 0.06, 0, 3200); sound.tone(club && club.speed > 30 ? 180 : 260, 0.1, "triangle", mine ? 0.09 : 0.04, 0, 90);
    const p = stPlayer(m.pid); if (p && !mine) feed((p.name || "?") + " tape avec " + (club ? club.name : "un club"));
    G.sentAt = Date.now();
    if (mine) setTimeout(() => shotBanner(m), Math.max(300, (m.dur || 1) * 1000 + 250));
  }
  function scoreName(strokes, par) {
    const d = strokes - par; if (strokes === 1) return "Trou en un !"; if (d <= -3) return "Albatros !"; if (d === -2) return "Aigle !"; if (d === -1) return "Birdie !"; if (d === 0) return "Par"; if (d === 1) return "Bogey"; if (d === 2) return "Double bogey"; return strokes + " coups";
  }
  function shotBanner(m) {
    if (!G.hole || !G.st || G.st.phase === "between") return;
    if (m.outcome === "sunk") { setBanner(scoreName(m.strokes, G.hole.par), "Dans le trou en " + m.strokes + " coup" + (m.strokes > 1 ? "s" : "") + ", le par est " + G.hole.par, 2400); }
    else if (m.outcome === "water") setBanner("Plouf", "Un coup de pénalité, retour au dernier point sec", 2200);
    else if (m.outcome === "lava") setBanner("Aïe, de la lave", "Un coup de pénalité, retour au dernier point sûr", 2200);
    else if (m.outcome === "ob") setBanner("Hors limites", "Un coup de pénalité, retour à ta position précédente", 2200);
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
  const medal = (p) => (p === 1 ? "🥇" : p === 2 ? "🥈" : p === 3 ? "🥉" : p + "e");
  const sgn = (v) => (v > 0 ? "+" + v : v < 0 ? "−" + Math.abs(v) : "0");
  function onHoleEnd(m) {
    clockSample(m.now); G.endInfo = m; const sc = S().scoring; G.top = false;
    const rows = m.rows.slice().sort((a, b) => (sc === "coups" ? (a.eff - b.eff) || (b.done - a.done) : (b.pts - a.pts) || (b.done - a.done) || (a.place - b.place)));
    let head, body;
    const name = (r) => { const p = stPlayer(r.id) || {}; return el("td", {}, [el("span", { class: "dotc", style: { background: hexOf(p.color) } }), p.name || "?"]); };
    if (sc === "coups") {
      head = ["Joueur", "Coups", "Par " + m.par, "Total des coups"];
      body = rows.map((r) => el("tr", {}, [name(r), el("td", { class: "r", text: r.done ? r.strokes + " · " + scoreName(r.strokes, m.par).replace(" !", "") : "abandon, " + r.eff + " comptés" }), el("td", { class: "r", text: sgn(r.vsPar) }), el("td", { class: "r", text: String(r.totalStrokes) })]));
    } else {
      head = ["Joueur", "Coups", "Arrivée", "Bonus", "Points", "Total"];
      body = rows.map((r) => el("tr", {}, [name(r), el("td", { class: "r", text: r.done ? r.strokes + " · " + scoreName(r.strokes, m.par).replace(" !", "") : "abandon" }),
        el("td", { class: "r", text: r.done ? medal(r.place) + " +" + r.base : "0" }), el("td", { class: "r", text: r.bonus + r.ace ? "+" + (r.bonus + r.ace) : "-" }), el("td", { class: "r", text: "+" + r.pts }), el("td", { class: "r", text: String(r.total) })]));
    }
    const tbl = el("table", { class: "tbl" }, [el("thead", {}, [el("tr", {}, head.map((h, i) => el("th", { class: i ? "r" : "", text: h })))]), el("tbody", {}, body)]);
    const note = el("p", { id: "sheet-next", class: "muted small", text: "" });
    openSheet([el("h2", { text: "Trou " + (m.index + 1) + " terminé" }), el("p", { class: "muted", text: m.name + " · par " + m.par }), tbl, el("p", { class: "small muted", text: GR.scoringText(S()) }), note]);
    G.sheet = { kind: "end", note };
  }
  function onOver(m) {
    G.endInfo = null;
    const rows = m.rows; const top = rows.slice(0, 3);
    const order = top.length === 1 ? [top[0]] : top.length === 2 ? [top[1], top[0]] : [top[1], top[0], top[2]];
    const pod = el("div", { class: "podium" }, order.map((r) => el("div", { class: "pod pod--" + r.rank }, [el("div", { class: "pod__ball", style: { background: hexOf(r.color) } }), el("div", { class: "pod__nm", text: r.name }), el("div", { class: "pod__bar", text: r.rank === 1 ? "1" : r.rank === 2 ? "2" : "3" })])));
    const unit = m.scoring === "coups" ? "coups" : "points";
    const awardBox = (m.awards && m.awards.length) ? el("div", { class: "awards" }, m.awards.map((a) => { const p = m.players.find((q) => q.id === a.id) || {}; return el("div", { class: "award" }, [el("span", { class: "dotc", style: { background: hexOf(p.color) } }), el("b", { text: p.name || "?" }), el("span", { text: a.label + " " + a.value })]); })) : null;
    const tbl = el("table", { class: "tbl" }, [
      el("thead", {}, [el("tr", {}, [el("th", { text: "" }), el("th", { text: "Joueur" }), el("th", { class: "r", text: unit === "points" ? "Points" : "Coups" }), el("th", { class: "r", text: unit === "points" ? "Coups" : "Écart au par" }), el("th", { class: "r", text: "Trous gagnés" })])]),
      el("tbody", {}, rows.map((r) => el("tr", {}, [el("td", { text: String(r.rank) }), el("td", {}, [el("span", { class: "dotc", style: { background: hexOf(r.color) } }), r.name + (r.left ? " (parti)" : "")]), el("td", { class: "r", text: String(unit === "points" ? r.pts : r.totalStrokes) }), el("td", { class: "r", text: unit === "points" ? String(r.totalStrokes) : sgn(r.parTotal) }), el("td", { class: "r", text: String(r.holesWon) })]))),
    ]);
    const host = Kit.isHost();
    const btns = el("div", { class: "row" }, [
      el("button", { class: "btn btn--ghost", text: "Copier la graine " + m.seed, onclick: () => { try { navigator.clipboard.writeText(m.seed); toast("Graine copiée.", "info"); } catch (e) { toast("Graine " + m.seed, "info"); } } }),
      el("button", { class: "btn btn--ghost", text: "Quitter", onclick: () => Kit.confirm("Quitter la partie et revenir à l'accueil ?", () => Kit.leave()) }),
      host ? el("button", { class: "btn btn--accent", text: "Retour au salon", onclick: () => Kit.backToLobby() }) : el("span", { class: "muted small", text: "L'hôte peut relancer une partie depuis le salon." }),
    ]);
    openSheet([el("h2", { text: "Fin de la partie" }), pod, tbl, awardBox, el("p", { class: "small muted", text: GR.scoringText(S()) }), btns]); G.sheet = { kind: "over" };
    sound.win();
  }

  // ---------- petit tutoriel du premier coup ----------
  function showTuto(force) {
    if (!force && store.get("golf.tuto", "")) return; if ($("#tuto")) return;
    const step = (n, t, d) => el("div", { class: "tuto__step" }, [el("i", { text: String(n) }), el("div", {}, [el("b", { text: t }), el("p", { class: "small", text: d })])]);
    const box = el("div", { id: "tuto", class: "tuto" }, [el("div", { class: "card" }, [
      el("h2", { text: "Comment taper" }),
      step(1, "Vise", "Touche le terrain à l'endroit où tu veux que la balle s'arrête. Le jeu choisit le club et la force pour toi. Tu peux aussi glisser pour tourner. La carte en haut à gauche marche pareil."),
      step(2, "Regarde la zone", "L'arc blanc est le vol de la balle jusqu'à son atterrissage, et le grand cercle montre où elle devrait finir en roulant. Ce n'est pas exact, le vent, le sol et ton erreur de frappe jouent. L'hôte peut changer cette aide dans les réglages."),
      step(3, "Choisis club et hauteur", "La colonne de clubs sur le côté va du plus puissant en haut au moins puissant en bas, avec la portée en mètres. Les flèches à côté règlent la hauteur. Un tir bas file droit mais cogne les arbres, un tir haut passe au dessus. Les boutons plus et moins règlent la force."),
      step(4, "Tape", "Appuie sur Taper, ou sur espace. Le bouton boussole fait viser le caddie, et le premier arrivé dans le trou marque le plus de points."),
      el("button", { class: "btn btn--accent btn--big", text: "Compris, c'est parti", onclick: () => { store.set("golf.tuto", "1"); $("#tuto").remove(); } }),
    ])]);
    $("#screen-game").appendChild(box);
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
    let b = $("#hud-feed"); if (!b) { b = el("div", { id: "hud-feed", class: "hud-center nopoint", style: { top: "6.6rem", display: "flex", flexDirection: "column", alignItems: "center", gap: "0.2rem" } }); $("#hud").appendChild(b); }
    return b;
  }
  function renderBoard() {
    const s = G.st; if (!s) return; const box = $("#hud-board");
    const sig = JSON.stringify([s.playMode, s.turnPid, s.scoring, s.players.map((p) => [p.id, p.name, p.finished, p.capped, p.moving, p.strokes, p.pts, p.totalStrokes, p.connected, p.auto, p.fx && p.fx.frozenUntil > snow()]), myState() && myState().finished, G.peek]);
    if (box.dataset.sig === sig) return; box.dataset.sig = sig; box.innerHTML = "";
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
  const fuzzy = (d) => (d < 12 ? Math.round(d) : d < 40 ? Math.round(d / 2) * 2 : Math.round(d / 5) * 5);
  const rollWord = (r) => (r < 2.5 ? "s'arrête presque tout de suite" : r < 9 ? "roule un peu" : "roule beaucoup");
  const pips = (n, max) => { let t = ""; for (let i = 0; i < max; i++) t += i < n ? "●" : "○"; return t; };
  // colonne des clubs sur le côté, du plus puissant au moins puissant
  function renderClubs() {
    const box = $("#hud-clubs"); if (!box) return; const me = myState();
    const allowed = GR.CLUB_ORDER.filter((c) => S().clubs.includes(c));
    const ckey = allowed.map((c) => c + ":" + (G.ranges[c] || 0)).join(",") + "|" + G.club + "|" + G.suggest + "|" + (me && me.rocketUsed);
    if (box.dataset.key !== ckey) {
      box.dataset.key = ckey; box.innerHTML = "";
      allowed.forEach((id, i) => {
        const c = GR.CLUBS[id]; const off = c.limited && me && me.rocketUsed; const rg = G.ranges[id];
        const kids = [el("kbd", { text: String(i + 1) }), el("span", { class: "club__ic", text: c.icon }), el("span", { class: "club__nm", text: c.name + (c.limited ? (off ? " (utilisée)" : " x1") : "") })];
        kids.push(el("span", { class: "club__rg", text: rg && !off ? rg + " m" : "" }));
        kids.push(el("span", { class: "club__bar" }, [el("i", { style: { width: Math.round(c.speed / 46 * 100) + "%" } })]));
        if (G.suggest === id && !off) kids.push(el("span", { class: "club__tag", text: "conseillé" }));
        box.appendChild(el("button", { class: "club" + (G.club === id ? " club--on" : ""), disabled: !!off, title: c.name + ", " + c.role + ". " + c.desc + " Portée maximale environ " + (rg || "?") + " m depuis ici.", onclick: () => setClub(id) }, kids));
      });
    }
    renderHeight(); renderClubCard();
  }
  function renderHeight() {
    const box = $("#hud-height"); if (!box) return; const c = GR.CLUBS[G.club];
    const on = S().heightControl !== false && GR.hasHeight(c);
    const key = on + "|" + G.club + "|" + G.height; if (box.dataset.key === key) return; box.dataset.key = key; box.innerHTML = "";
    box.classList.toggle("heightbox--off", !on);
    if (!on) { box.appendChild(el("span", { class: "heightbox__fix", text: S().heightControl === false ? "Hauteur fixe" : c.loft ? "Hauteur fixe" : "Au sol" })); return; }
    box.appendChild(el("button", { class: "round-btn round-btn--small", id: "h-up", title: "Tir plus haut, passe au dessus des obstacles (touche R)", text: "▲", disabled: G.height >= 4, onclick: () => setHeight(G.height + 1) }));
    const lv = el("div", { class: "heightbox__lv" }); for (let i = 4; i >= 0; i--) lv.appendChild(el("i", { class: i === G.height ? "on" : i < G.height ? "fill" : "", onclick: () => setHeight(i) }));
    box.appendChild(lv);
    box.appendChild(el("span", { class: "heightbox__nm", text: GR.HEIGHT_NAMES[G.height] }));
    box.appendChild(el("button", { class: "round-btn round-btn--small", id: "h-down", title: "Tir plus bas, plus tendu, mais il cogne les arbres (touche F)", text: "▼", disabled: G.height <= 0, onclick: () => setHeight(G.height - 1) }));
  }
  function renderClubCard() {
    const box = $("#hud-clubcard"); if (!box) return; const c = GR.CLUBS[G.club]; const st = GR.stars(c); const rg = G.ranges[G.club];
    const key = G.club + "|" + G.height + "|" + rg + "|" + S().heightControl; if (box.dataset.key === key) return; box.dataset.key = key; box.innerHTML = "";
    const on = S().heightControl !== false && GR.hasHeight(c);
    box.appendChild(el("b", { text: c.icon + " " + c.name })); box.appendChild(el("em", { text: c.role }));
    box.appendChild(el("div", { class: "clubcard__row" }, [el("span", { text: "Puissance" }), el("span", { class: "pips", text: pips(st.pow, 5) })]));
    box.appendChild(el("div", { class: "clubcard__row" }, [el("span", { text: "Hauteur" }), el("span", { class: "pips", text: c.loft ? pips(st.hi, 5) : "au sol" })]));
    box.appendChild(el("div", { class: "clubcard__row" }, [el("span", { text: "Précision" }), el("span", { class: "pips", text: pips(st.acc, 5) })]));
    box.appendChild(el("p", { class: "small", text: c.fly }));
    box.appendChild(el("p", { class: "small muted", text: (rg ? "Portée maximale d'ici environ " + rg + " m" : "") + (on ? ", tir " + GR.HEIGHT_NAMES[G.height].toLowerCase() + "." : ".") }));
  }
  function setClub(id) {
    const me = myState(); G.club = id; G.clubManual = true; G.height = GR.HEIGHT_DEFAULT; sound.click();
    // on garde le même point visé, seul le style du coup change
    if (me && G.aimDist) { const r = solvePower(me, id, G.yaw, G.aimDist); G.power = clamp(r.p, 0.05, 1); if (!r.ok) toast("Ce club ne va pas assez loin, il envoie à " + Math.round(r.dist) + " m au maximum.", "info"); }
    G.pred = null; G.rangeKey = ""; renderClubs();
  }
  // change la hauteur du tir, la force est recalculée pour garder le même point visé
  function setHeight(h) {
    const me = myState(); const c = GR.CLUBS[G.club]; if (!me || S().heightControl === false || !GR.hasHeight(c)) return;
    h = clamp(h, 0, 4); if (h === G.height) return; G.height = h; G.clubManual = true; sound.click();
    if (G.aimDist) { const r = solvePower(me, G.club, G.yaw, G.aimDist); G.power = clamp(r.p, 0.05, 1); }
    G.pred = null; G.rangeKey = ""; renderClubs();
  }
  // carte d'information au dessus de la jauge de force
  function renderAimInfo(me, pred) {
    const box = $("#hud-aim"); if (!box) return; const club = GR.CLUBS[G.club]; const mode = S().aimAssist;
    const hname = S().heightControl !== false && GR.hasHeight(club) ? " · tir " + GR.HEIGHT_NAMES[G.height].toLowerCase() : "";
    let l1 = "", l2 = "", l3 = "", bad = false;
    if (me && pred && mode === "traj") {
      l1 = club.icon + " " + club.name + hname + " à " + Math.round(G.power * 100) + " pour cent, ";
      if (pred.sunk) l1 += "la balle finit dans le trou !";
      else l1 += "elle retombe à " + Math.round(pred.carry) + " m et s'arrête à " + Math.round(pred.total) + " m";
      if (pred.warn) { l2 = "Attention, " + pred.warn.toLowerCase() + "."; bad = true; }
      else if (pred.mover) l2 = "Elle croise un moulin ou une barrière qui bouge, tout dépend du moment où tu tapes.";
      else if (pred.hits) l2 = "Elle touche un obstacle en route, le coup sera dévié.";
      else if (!pred.sunk) l2 = "Il restera " + Math.round(pred.toCup) + " m jusqu'au trou.";
      l3 = club.fly + " " + lieNow(me) + " Erreur possible de " + (pred.sigma < 1 ? "moins de 1" : "environ " + Math.round(pred.sigma)) + " m autour du point d'arrêt.";
    } else if (me && pred && mode === "zone") {
      l1 = club.icon + " " + club.name + hname + " à " + Math.round(G.power * 100) + " pour cent, atterrit vers " + fuzzy(pred.carry) + " m";
      if (pred.warn) { l2 = "Attention, un danger se trouve près de la zone d'arrivée."; bad = true; }
      else if (pred.hits || pred.mover) l2 = "Quelque chose se trouve sur la route de la balle. Un tir plus haut ou une autre direction peut l'éviter.";
      else if (pred.sunk) l2 = "Le trou est dans la zone, c'est bien visé.";
      else l2 = "Après l'atterrissage elle " + rollWord(pred.roll) + ", il resterait environ " + fuzzy(pred.toCup) + " m du trou.";
      l3 = club.fly + " " + lieNow(me) + " Le cercle montre où elle devrait finir.";
    } else if (me) { l1 = club.icon + " " + club.name + hname + " à " + Math.round(G.power * 100) + " pour cent"; l3 = club.fly + " " + lieNow(me); }
    const key = l1 + "|" + l2 + "|" + l3 + "|" + bad; if (key === G.lastInfo) return; G.lastInfo = key;
    box.innerHTML = ""; if (!l1) { box.classList.add("hidden"); return; } box.classList.remove("hidden"); box.classList.toggle("aiminfo--bad", bad);
    box.appendChild(el("b", { text: l1 })); if (l2) box.appendChild(el("span", { class: "aiminfo__warn", text: l2 })); if (l3) box.appendChild(el("span", { class: "small muted", text: l3 }));
  }
  function renderPowers() {
    const box = $("#hud-powers"); if (!box) return; const me = myState();
    const pkey = S().powersOn && me ? me.powers.join(",") : "off"; if (box.dataset.key === pkey) return; box.dataset.key = pkey; box.innerHTML = "";
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
    else if (s.phase === "play") txt = "";
    t.textContent = txt;
  }
  function renderFx() {
    const box = $("#hud-fx"); if (!box) return; box.innerHTML = ""; const me = myState(); if (!me) return;
    const now = snow(); const add = (txt) => box.appendChild(el("span", { class: "pill", text: txt }));
    if (me.fx.glu) add("🍯 Prochain coup réduit de moitié"); if (me.fx.gust) add("💨 Bourrasque au prochain coup"); if (me.fx.invert) add("🙃 Visée inversée"); if (me.fx.ice) add("🧊 Balle glissante");
    if (me.fx.turbo) add("🚀 Turbo prêt"); if (me.fx.magnet) add("🧲 Aimant prêt"); if (me.fx.bubble) add("🫧 Bulle active");
    if (me.fx.frozenUntil > now) add("❄️ Gelé encore " + Math.ceil((me.fx.frozenUntil - now) / 1000) + " s");
    const gs = G.st; if (gs && gs.phase === "play" && gs.graceUntil > now) add("⏱️ Le trou se termine dans " + Math.ceil((gs.graceUntil - now) / 1000) + " s");
    $("#fx-fog").classList.toggle("overlay-fx--on", me.fx.fogUntil > now); $("#fx-ice").classList.toggle("overlay-fx--on", me.fx.frozenUntil > now);
  }

  // ---------- entrées ----------
  function wireInput() {
    const host = $("#gl-host");
    const rot = (dx) => { const me = myState(); const inv = me && me.fx.invert ? -1 : 1; G.yaw -= dx * 0.0055 * inv; if (Math.abs(dx) > 0) G.aimDist = null; };
    host.addEventListener("pointerdown", (e) => { host.setPointerCapture(e.pointerId); G.pointers.set(e.pointerId, { x: e.clientX, y: e.clientY }); G.tap = G.pointers.size === 1 ? { id: e.pointerId, t: performance.now(), moved: 0 } : null; if (G.pointers.size === 2) { const a = [...G.pointers.values()]; G.pinch = Math.hypot(a[0].x - a[1].x, a[0].y - a[1].y); } });
    host.addEventListener("pointermove", (e) => {
      const p = G.pointers.get(e.pointerId); if (!p) return; const dx = e.clientX - p.x, dy = e.clientY - p.y; p.x = e.clientX; p.y = e.clientY; if (G.tap) G.tap.moved += Math.abs(dx) + Math.abs(dy);
      if (G.pointers.size === 2) { const a = [...G.pointers.values()]; const d = Math.hypot(a[0].x - a[1].x, a[0].y - a[1].y); const cs = V.camState(); V.setCam({ dist: cs.dist * (G.pinch / Math.max(20, d)) }); G.pinch = d; return; }
      rot(dx); const cs = V.camState(); V.setCam({ pitch: cs.pitch + dy * 0.004 });
    });
    const up = (e) => {
      const tp = G.tap; G.pointers.delete(e.pointerId);
      // un simple toucher sur le terrain vise ce point
      if (tp && tp.id === e.pointerId && tp.moved < 9 && performance.now() - tp.t < 500 && e.type === "pointerup" && canAct()) { const pt = V.pick(e.clientX, e.clientY); if (pt) { aimAtPoint(pt.x, pt.z); sound.click(); } }
      G.tap = null;
    };
    host.addEventListener("pointerup", up); host.addEventListener("pointercancel", up);
    host.addEventListener("wheel", (e) => { e.preventDefault(); if (e.shiftKey) { G.power = clamp(G.power - Math.sign(e.deltaY) * 0.03, 0.05, 1); G.aimDist = null; } else if (e.altKey) { setHeight(G.height - Math.sign(e.deltaY)); } else if (G.top) { G.topZoom = clamp(G.topZoom * (1 + Math.sign(e.deltaY) * 0.1), 0.5, 2); } else { const cs = V.camState(); V.setCam({ dist: cs.dist * (1 + Math.sign(e.deltaY) * 0.1) }); } }, { passive: false });
    $("#btn-zoomin").onclick = () => { const cs = V.camState(); V.setCam({ dist: cs.dist * 0.85 }); };
    $("#btn-zoomout").onclick = () => { const cs = V.camState(); V.setCam({ dist: cs.dist * 1.18 }); };
    $("#btn-menu").onclick = openMenu;
    const toggleTop = () => { G.top = !G.top; G.topZoom = 1; toast(G.top ? "Vue du dessus. Touche le terrain pour viser un point." : "Vue normale.", "info"); };
    const caddie = () => { if (!canAct()) return; resetAim(); toast("Le caddie a visé vers le trou et choisi le club.", "info"); };
    $("#btn-top").onclick = toggleTop; $("#btn-caddie").onclick = caddie;
    $("#pw-minus").onclick = () => { G.power = clamp(Math.round((G.power - 0.05) * 100) / 100, 0.05, 1); G.aimDist = null; };
    $("#pw-plus").onclick = () => { G.power = clamp(Math.round((G.power + 0.05) * 100) / 100, 0.05, 1); G.aimDist = null; };
    $("#hud-mini").addEventListener("pointerup", (e) => { if (!canAct() || !G.hole) return; const cv = e.currentTarget; const r = cv.getBoundingClientRect(); const m = M.mapper(G.hole, cv.width, cv.height); const pt = m.fromPx((e.clientX - r.left) * cv.width / r.width, (e.clientY - r.top) * cv.height / r.height); aimAtPoint(pt.x, pt.z); sound.click(); });
    G.toggleTop = toggleTop; G.caddie = caddie;
    // jauge de force
    const pw = $("#power"); let drag = false;
    const setP = (e) => { const r = pw.getBoundingClientRect(); G.power = clamp(Math.round(((e.clientX - r.left) / r.width) * 100) / 100, 0.05, 1); G.aimDist = null; };
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
      else if (/^[1-7]$/.test(k)) { const list = GR.CLUB_ORDER.filter((c) => S().clubs.includes(c)); const id = list[+k - 1]; if (id) { const me = myState(); if (!(GR.CLUBS[id].limited && me && me.rocketUsed)) setClub(id); } }
      else if (k === "arrowup" || k === "z" || k === "w") { e.preventDefault(); G.power = clamp(G.power + (e.shiftKey ? 0.1 : 0.02), 0.05, 1); G.aimDist = null; }
      else if (k === "arrowdown" || k === "s") { e.preventDefault(); G.power = clamp(G.power - (e.shiftKey ? 0.1 : 0.02), 0.05, 1); G.aimDist = null; }
      else if (k === "r" || k === "pageup") { e.preventDefault(); setHeight(G.height + 1); }
      else if (k === "f" || k === "pagedown") { e.preventDefault(); setHeight(G.height - 1); }
      else if (k === "v") { if (G.toggleTop) G.toggleTop(); }
      else if (k === "c") { if (G.caddie) G.caddie(); }
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
      el("kbd", { text: "Toucher le terrain" }), el("span", { text: "Vise ce point. Le club et la force se règlent seuls pour que la balle s'y arrête, tu peux ensuite les changer." }),
      el("kbd", { text: "Glisser" }), el("span", { text: "Tourner la visée et incliner la caméra." }),
      el("kbd", { text: "Flèches gauche droite" }), el("span", { text: "Tourner la visée. Avec Maj, tourner plus finement." }),
      el("kbd", { text: "Flèches haut bas" }), el("span", { text: "Régler la force du coup, ou les boutons plus et moins." }),
      el("kbd", { text: "1 à 7" }), el("span", { text: "Choisir son club, du plus puissant au moins puissant. La portée en mètres est écrite sur chaque bouton." }),
      el("kbd", { text: "R et F" }), el("span", { text: "Régler la hauteur du tir. R pour plus haut, F pour plus bas. Les boutons flèches à côté des clubs font pareil." }),
      el("kbd", { text: "V" }), el("span", { text: "Vue du dessus pour voir toute la trajectoire et toucher la cible." }),
      el("kbd", { text: "C" }), el("span", { text: "Le caddie vise vers le trou et choisit le club conseillé." }),
      el("kbd", { text: "Espace" }), el("span", { text: "Un appui rapide tape avec la force réglée. Un appui long charge la force, on relâche pour taper." }),
      el("kbd", { text: "Molette" }), el("span", { text: "Zoom de la caméra." }),
    ]);
    const clubs = el("div", {}, GR.CLUB_ORDER.map((id) => el("p", { class: "small", text: GR.CLUBS[id].icon + " " + GR.CLUBS[id].name + " (" + GR.CLUBS[id].role.toLowerCase() + ") · " + GR.CLUBS[id].desc + " " + GR.CLUBS[id].fly })));
    const pows = el("div", {}, GR.POWER_ORDER.map((id) => el("p", { class: "small", text: GR.POWERS[id].icon + " " + GR.POWERS[id].name + " · " + GR.POWERS[id].desc })));
    Kit.showModal("Menu", [
      row("Qualité graphique", "Basse retire les ombres et allège l'affichage, utile sur téléphone ou ordinateur modeste.", qbox),
      row("Sons", "Coups, rebonds, plouf et pouvoirs.", sbtn),
      el("h3", { text: "Commandes", style: { marginTop: "0.8rem" } }), keys,
      el("button", { class: "btn btn--small btn--ghost", style: { marginTop: "0.6rem" }, text: "Revoir le tutoriel", onclick: () => { $("#modal").classList.add("hidden"); showTuto(true); } }),
      el("h3", { text: "Les points", style: { marginTop: "0.8rem" } }), el("p", { class: "small", text: GR.scoringText(S()) }),
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
    if (dir) { G.yaw += dir * dt * 1.1 * fine * inv; G.aimDist = null; }
    // charge
    if (G.charging) { const held = performance.now() - G.chargeAt; if (held > 220) G.power = clamp((held - 220) / 1500, 0.03, 1); }
    // caméra
    const animating = fid && V.isAnimating(fid);
    if (fid === (me && me.id) && !animating) V.setCam({ yaw: G.yaw });
    else if (!animating && fid !== (me && me.id)) { /* le spectateur tourne la caméra en glissant */ V.setCam({ yaw: G.yaw }); }
    // visée
    const showAim = !!(me && G.st.phase === "play" && !me.finished && !me.moving && !animating && fid === me.id);
    const mode = S().aimAssist === "traj" ? "trajectoire" : S().aimAssist === "zone" ? "zone" : S().aimAssist === "none" ? "aucune" : "points";
    let pred = null;
    if (showAim) {
      if (canAct() || true) updateRanges(me);
      pred = mode === "trajectoire" || mode === "zone" ? predict(me) : null;
      const len = pred ? clamp(pred.total, 2, 90) : clamp(G.power * (G.ranges[G.club] || 30) + 1, 2, 90);
      V.setAim(true, me.x, me.y, me.z, G.yaw, { mode, len, frames: pred && pred.frames, events: pred && pred.events, outcome: pred && pred.outcome, sigma: pred && pred.sigma, warn: pred && !!pred.warn, zone: pred && pred.zone,
        label: !pred ? "" : mode === "zone" ? (pred.warn ? "Danger près de la zone" : "≈ " + fuzzy(pred.total) + " m") : (pred.sunk ? "Dans le trou" : pred.warn ? pred.warn.split(",")[0] + " " + Math.round(pred.total) + " m" : Math.round(pred.total) + " m") });
    } else V.setAim(false);
    // vue du dessus pour viser
    if (G.top && showAim && canAct()) {
      const L = Math.max(14, pred ? pred.total : (G.ranges[G.club] || 30) * G.power); const half = L * 0.5;
      V.setTop(true, { x: me.x + Math.sin(G.yaw) * half, z: me.z + Math.cos(G.yaw) * half, yaw: G.yaw, h: clamp(((L * 0.55 + 7) / 0.554) * G.topZoom, 18, 130) });
    } else { if (V.isTop()) V.setTop(false); }
    renderAimInfo(showAim ? me : null, pred);
    // repère du trou, même quand il est hors de l'écran
    { const cm = $("#hud-cup"), host = $("#gl-host"); const cup = G.hole.cup;
      if (cm && me && G.st.phase === "play" && !me.finished && host.clientWidth) {
        const pr = V.project(cup.x, GP.heightAt(G.hole, cup.x, cup.z) + 2.6, cup.z); const w = host.clientWidth, h = host.clientHeight; const mx = 46, top = 96, bot = 150;
        let x = pr.x, y = pr.y, off = false; if (pr.behind) { x = w - x; y = h - y; off = true; }
        if (x < mx || x > w - mx || y < top || y > h - bot) off = true;
        const d = Math.hypot(cup.x - me.x, cup.z - me.z);
        if (off) { const cx = w / 2, cy = (top + h - bot) / 2; let dx = x - cx, dy = y - cy; if (pr.behind) { dx = -dx; dy = -dy; if (Math.abs(dx) < 1 && Math.abs(dy) < 1) dy = -1; } const kx = dx ? (w / 2 - mx) / Math.abs(dx) : 1e9, ky = dy ? ((h - bot - top) / 2) / Math.abs(dy) : 1e9; const k = Math.min(kx, ky); x = cx + dx * k; y = cy + dy * k; cm.querySelector(".cupmark__arr").style.transform = "rotate(" + (Math.atan2(dx, -dy) * 180 / Math.PI).toFixed(0) + "deg)"; }
        cm.classList.remove("hidden"); cm.classList.toggle("cupmark--on", !off); cm.style.left = x.toFixed(0) + "px"; cm.style.top = y.toFixed(0) + "px";
        const t = "⛳ " + Math.round(d) + " m"; if (G.lastCup !== t) { $("#cupmark-txt").textContent = t; G.lastCup = t; }
      } else if (cm) cm.classList.add("hidden"); }
    const tb = $("#btn-top"); if (tb) tb.classList.toggle("round-btn--lit", G.top);
    // jauge
    const fill = $("#power-fill"); if (fill) { fill.style.width = (G.power * 100).toFixed(1) + "%"; $("#power-txt").textContent = Math.round(G.power * 100) + " %" + (pred ? " · " + Math.round(pred.total) + " m" : ""); }
    const btn = $("#btn-shoot"); if (btn) { const ok = canAct(); btn.disabled = false; btn.style.opacity = ok ? 1 : 0.55; }
    // carte
    if (now - G.lastMini > 100) {
      G.lastMini = now; const cv = $("#hud-mini");
      const players = G.st.players.filter((p) => !(p.finished && !p.moving)).map((p) => { const bp = V.ballPos(p.id) || p; return { x: bp.x, z: bp.z, hex: hexOf(p.color), you: me && p.id === me.id }; });
      const orbs = G.hole.orbs.map((o) => { const so = G.st.orbs.find((q) => q.id === o.id); return { x: o.x, z: o.z, taken: so ? so.taken : false }; });
      M.draw(cv, G.hole, { players, orbs: S().powersOn ? orbs : [], path: false, aim: showAim ? { x: me.x, z: me.z, yaw: G.yaw } : null, pred: showAim && pred && S().aimAssist === "traj" ? pred : null });
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
      { title: "Viser", text: "Touche le terrain à l'endroit où tu veux que la balle s'arrête, le jeu règle alors le club et la force. Une aide montre l'arc de la balle et un grand cercle d'arrivée, sans dire exactement où elle rebondit. L'hôte peut la remplacer par la trajectoire exacte, une simple flèche ou rien du tout. Le bouton carte donne une vue du dessus et le bouton boussole fait viser le caddie." },
      { title: "Taper", text: "Les clubs sont dans la colonne sur le côté, rangés du plus puissant au moins puissant, avec leur portée en mètres. Les flèches haut et bas à côté règlent la hauteur du tir, les boutons plus et moins règlent la force. Appuie sur Taper ou sur espace. Un appui long charge la force, on relâche pour frapper." },
      { title: "Les clubs et la hauteur", text: "Du plus puissant au moins puissant, la fusée est un coup monstrueux utilisable une fois par trou, le driver va très loin avec un vol tendu, le fer est le bon à tout faire, le ricochet saute sur l'eau, la cale monte haut, le lob retombe presque à la verticale et le putter roule au sol en restant le plus précis. Chaque club se joue de très bas à très haut. Un tir bas file droit et roule mais cogne les arbres et les obstacles, un tir haut les passe. Le jeu conseille un club, mais tu choisis." },
      { title: "Les orbes et les pouvoirs", text: "Roule sur une orbe dorée pour gagner un pouvoir au hasard. Certains aident ta balle, d'autres embêtent un adversaire. Ils se lancent à tout moment, même pendant que la balle des autres roule." },
      { title: "Les pièges", text: "Eau, lave et sortie de terrain coûtent un coup. Le sable et la boue freinent, la glace fait glisser, la gelée fait rebondir. Les moulins, barrières, trampolines et portails sont des animations du terrain que l'hôte peut régler." },
      { title: "Les points", text: "Le premier dans le trou gagne 10 points, puis 7, 5, 3, 2 et 1. Un trou en un ajoute 5 points. Dans le décompte arrivée et coups, chaque coup sous le par du trou rapporte 2 points de plus. Dans le décompte aux coups, il n'y a pas de points et le moins de coups gagne. Le détail s'affiche à la fin de chaque trou." },
    ],
    theme: { a1: "#ffe27a", a2: "#f0a81c", bg1: "#1f7a4d", bg2: "#0b3a2a" },
    renderPreview,
    onInit() { buildGame(); attach(); Kit.on("connect", attach); requestAnimationFrame(frame); },
  });
})();

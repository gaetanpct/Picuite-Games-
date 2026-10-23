// ============================================================
// BUS BAZAR — Les quatre postes de travail (interface)
// ============================================================
const BBStations = (function () {
  const D = BBData, Dr = BBDraw;
  const el = (t, a, k) => Kit.el(t, a, k);
  const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
  const lvlTxt = { ok: "en forme", warn: "fatigué", crit: "en piteux état" };
  const kmh = (v) => Math.round(v * 3.6);
  const cd = (v, k) => (v.cds && v.cds[k]) || 0;
  const secTxt = (n) => Math.ceil(n) + " s";
  function btnTip(btn, reason) { btn.disabled = !!reason; btn.title = reason || ""; const w = btn.querySelector(".why"); if (w) w.textContent = reason || ""; }
  function act(msg) { return BB.send(msg); }
  function bar(cls) { const b = el("div", { class: "bar " + (cls || "") }, [el("i")]); b.set = (p, col) => { b.firstChild.style.width = clamp(p, 0, 100) + "%"; if (col) b.firstChild.style.background = col; }; return b; }
  const hpColor = (p) => (p >= 60 ? "#4fae5a" : p >= 30 ? "#f0b429" : "#d6453d");

  // ====================== CONDUCTEUR ======================
  const driver = {
    build(root) {
      const cv = el("canvas", { id: "bb-road", class: "road" }); this.cv = cv; this.ctx = cv.getContext("2d");
      const sign = el("div", { class: "limit", title: "Vitesse conseillée sur ce type de route" }, [el("b", { id: "d-lim" }), el("span", { text: "km/h" })]);
      const speed = el("div", { class: "speedo" }, [el("b", { id: "d-speed", text: "0" }), el("span", { text: "km/h" })]);
      const warn = el("div", { class: "warns", id: "d-warns" });
      const alertBox = el("div", { class: "d-alert hidden", id: "d-alert" });
      const stopBox = el("div", { class: "d-stop hidden", id: "d-stop" }, [el("h3", { id: "d-stop-t" }), el("p", { id: "d-stop-p" }), el("button", { class: "btn btn--accent btn--big", id: "d-depart", text: "Donner le départ", onclick: () => act({ t: "depart" }) }), el("p", { class: "why", id: "d-depart-why" })]);
      const keys = el("div", { class: "keyhint" }, [el("span", { text: "Flèches ou Q D pour tourner, haut ou Z pour accélérer, bas ou S pour freiner" }), el("span", { text: "Espace klaxon, A et E esquive, Maj freinage d'urgence, R essuie-glace, M musique, G gyrophare" })]);
      const pad = el("div", { class: "pad" }, [
        el("div", { class: "pad-l" }, [this.hold("◀", "left"), this.hold("▶", "right")]),
        el("div", { class: "pad-m" }, [
          this.tap("📯", "Klaxon", () => act({ t: "horn" }), "d-b-horn"), this.tap("↩️", "Esquive gauche", () => act({ t: "dodge", dir: -1 }), "d-b-dl"), this.tap("↪️", "Esquive droite", () => act({ t: "dodge", dir: 1 }), "d-b-dr"),
          this.tap("🛑", "Freinage d'urgence", () => act({ t: "emergency" }), "d-b-em"), this.tap("🧽", "Essuie-glace", () => act({ t: "wipe" }), "d-b-wipe"),
          this.tap("🎵", "Musique du bord", () => act({ t: "musique" }), "d-b-music"), this.tap("🚨", "Gyrophare de fête", () => act({ t: "gyro" }), "d-b-gyro"),
        ]),
        el("div", { class: "pad-r" }, [this.hold("⛽", "gas", "Accélérer"), this.hold("🛞", "brake", "Freiner")]),
      ]);
      root.appendChild(el("div", { class: "driver" }, [cv, sign, speed, warn, alertBox, stopBox, keys, pad]));
      this.fx = { steer: 0, hornFlash: 0, startleT: 0 }; this.disp = { s: 0, x: 0 }; this.srv = null;
      this.cmd = { left: false, right: false, gas: false, brake: false };
    },
    tap(ic, label, fn, id) { const b = el("button", { class: "pbtn", id, title: label, "aria-label": label, onclick: (e) => { e.preventDefault(); fn(); } }, [el("span", { class: "pi", text: ic }), el("span", { class: "pl", text: label })]); return b; },
    hold(ic, key, label) {
      const b = el("button", { class: "pbtn pbtn--hold", title: label || "", "aria-label": label || key, "data-key": key }, [el("span", { class: "pi", text: ic }), label ? el("span", { class: "pl", text: label }) : null]);
      const on = (e) => { e.preventDefault(); this.cmd[key] = true; b.classList.add("on"); }; const off = (e) => { e.preventDefault(); this.cmd[key] = false; b.classList.remove("on"); };
      b.addEventListener("pointerdown", on); b.addEventListener("pointerup", off); b.addEventListener("pointerleave", off); b.addEventListener("pointercancel", off); b.addEventListener("contextmenu", (e) => e.preventDefault()); return b;
    },
    update(v) {
      this.v = v; this.srv = { s: v.bus.s, x: v.bus.x, vx: v.bus.vx, v: v.bus.v, t: performance.now() };
      document.getElementById("d-speed").textContent = kmh(v.bus.v);
      if (v.seg) document.getElementById("d-lim").textContent = kmh((D.BIOMES.filter((b) => b.id === v.seg.biome)[0] || D.BIOMES[0]).speed);
      const w = document.getElementById("d-warns"); const items = [["engine", "⚙️"], ["cooling", "🧊"], ["brakes", "🛑"], ["tires", "🛞"], ["electric", "🔌"], ["tank", "⛽"]];
      w.innerHTML = ""; items.forEach(([k, ic]) => { const lv = v.lights[k]; if (lv === "ok") return; w.appendChild(el("span", { class: "wl wl--" + lv, title: D.SYSTEMS.filter((s) => s.id === k)[0].label + " " + lvlTxt[lv], text: ic })); });
      if (v.temp > 105) w.appendChild(el("span", { class: "wl wl--crit", title: "Moteur trop chaud", text: "🌡️ " + v.temp })); if (v.fuel < 20) w.appendChild(el("span", { class: "wl wl--crit", title: "Réservoir presque vide", text: "⛽ " + v.fuel }));
      const al = document.getElementById("d-alert"); const msgs = [];
      if (v.fake) msgs.push("Alerte rouge sur " + D.SYSTEMS.filter((s) => s.id === v.fake)[0].label.toLowerCase() + " (le mécanicien vérifie).");
      if (v.stalled) msgs.push("Le moteur a calé, il doit refroidir."); if (v.slip) msgs.push("Le bus glisse."); if (Math.abs(v.driver ? v.driver.pull : 0) > 0.05) msgs.push("Le bus tire sur le côté, un pneu est mort.");
      al.classList.toggle("hidden", !msgs.length); al.textContent = msgs.join(" ");
      const st = document.getElementById("d-stop"); const atStop = v.phase === "stop";
      st.classList.toggle("hidden", !atStop || v.last);
      if (atStop) {
        document.getElementById("d-stop-t").textContent = "Arrêt à " + (v.stopName || "la station");
        document.getElementById("d-stop-p").textContent = v.chosen ? "La route est choisie. Dès que le mécanicien et la cabine sont prêts, donne le départ." : "Le navigateur choisit encore la route. Tu peux partir sans attendre, la route sûre sera prise par défaut.";
        const why = document.getElementById("d-depart-why"); const bad = v.stalled ? "Le moteur est trop chaud pour démarrer." : v.lights.engine === "crit" && v.inv && false ? "" : v.fuel <= 0 ? "Plus de carburant." : ""; document.getElementById("d-depart").disabled = !!bad || !v.canDepart; why.textContent = bad;
      }
      ["d-b-horn"].forEach((id) => { const b = document.getElementById(id); if (b) b.disabled = v.stuckHorn || v.lights.electric === "crit" && false; });
      const cdBtn = (id, key) => { const b = document.getElementById(id); if (!b) return; const l = cd(v, key); b.classList.toggle("cool", l > 0); b.dataset.cd = l > 0 ? Math.ceil(l) : ""; };
      cdBtn("d-b-dl", "dodge"); cdBtn("d-b-dr", "dodge"); cdBtn("d-b-em", "emergency"); cdBtn("d-b-wipe", "wipe"); cdBtn("d-b-horn", "horn");
    },
    input(dt) {
      const k = BB.keys, c = this.cmd; const L = k.ArrowLeft || k.q || k.Q || c.left, Rr = k.ArrowRight || k.d || k.D || c.right;
      const tgt = (Rr ? 1 : 0) - (L ? 1 : 0); this.fx.steer += (tgt - this.fx.steer) * Math.min(1, dt * (tgt === 0 ? 9 : 6));
      this.thr = k.ArrowUp || k.z || k.Z || k.w || k.W || c.gas ? 1 : 0; this.brk = k.ArrowDown || k.s || k.S || c.brake ? 1 : 0;
      if (this.v && this.v.phase === "stop") { this.thr = 0; this.brk = 1; }
    },
    sendDrive() { if (!this.v) return; BB.rawSend({ t: "drive", steer: +this.fx.steer.toFixed(2), thr: this.thr || 0, brk: this.brk || 0 }); },
    key(e) {
      if (e.type !== "keydown" || e.repeat) return; const k = e.key;
      if (k === " ") { e.preventDefault(); act({ t: "horn" }); } else if (k === "a" || k === "A") act({ t: "dodge", dir: -1 }); else if (k === "e" || k === "E") act({ t: "dodge", dir: 1 }); else if (k === "Shift") act({ t: "emergency" }); else if (k === "r" || k === "R") act({ t: "wipe" }); else if (k === "m" || k === "M") act({ t: "musique" }); else if (k === "g" || k === "G") act({ t: "gyro" });
    },
    frame(dt, t) {
      const v = this.v; if (!v || !this.srv) return; const cv = this.cv;
      if (!v.seg) { const r0 = cv.getBoundingClientRect(); const W0 = Math.max(280, Math.round(r0.width * 0.6)), H0 = Math.max(180, Math.round(r0.height * 0.6)); if (cv.width !== W0 || cv.height !== H0) { cv.width = W0; cv.height = H0; } const c0 = this.ctx; const g = c0.createLinearGradient(0, 0, 0, H0); g.addColorStop(0, "#7cc6ff"); g.addColorStop(0.55, "#e8f7ff"); g.addColorStop(0.55, "#6fbf4a"); g.addColorStop(1, "#555a64"); c0.fillStyle = g; c0.fillRect(0, 0, W0, H0); Dr.rrect(c0, W0 * 0.6, H0 * 0.18, W0 * 0.22, H0 * 0.2, 8, "#2f78d1", 4); Dr.text(c0, "DÉPART", W0 * 0.71, H0 * 0.28, Math.max(14, W0 * 0.03), "#fff"); Dr.line(c0, W0 * 0.71, H0 * 0.38, W0 * 0.71, H0 * 0.55, 6); return; } const r = cv.getBoundingClientRect(); const dpr = Math.min(2, window.devicePixelRatio || 1);
      const W = Math.max(280, Math.round(r.width * dpr * 0.6)), H = Math.max(180, Math.round(r.height * dpr * 0.6)); if (cv.width !== W || cv.height !== H) { cv.width = W; cv.height = H; }
      const age = (performance.now() - this.srv.t) / 1000; const es = this.srv.s + this.srv.v * Math.min(age, 0.3), ex = clamp(this.srv.x + this.srv.vx * Math.min(age, 0.3), -1.7, 1.7);
      if (v.phase === "stop") { this.disp.s = this.srv.s; this.disp.x = this.srv.x; } else { this.disp.s += (es - this.disp.s) * Math.min(1, dt * 12); this.disp.x += (ex - this.disp.x) * Math.min(1, dt * 12); }
      this.fx.hornFlash = Math.max(0, this.fx.hornFlash - dt * 3); this.fx.startleT += dt; if (!v.startle) this.fx.startleT = 0; this.fx.foam = v.foam;
      const sh = BB.shake; if (sh > 0) { this.ctx.save(); this.ctx.translate((Math.random() - 0.5) * sh * 14, (Math.random() - 0.5) * sh * 14); }
      BBScene.render(this.ctx, W, H, v, t, this.disp, this.fx);
      if (sh > 0) this.ctx.restore();
      if (v.phase === "stop") { const r2 = v.bus; }
    },
    horn() { this.fx.hornFlash = 1; },
  };

  // ====================== MÉCANICIEN ======================
  const mech = {
    sel: null,
    build(root) {
      this.cards = {}; const grid = el("div", { class: "msys" });
      D.SYSTEMS.forEach((s) => {
        const c = el("button", { class: "mcard", "data-sys": s.id, onclick: () => { this.sel = s.id; this.update(this.v); } }, [el("span", { class: "mc-ic", text: s.icon }), el("b", { text: s.label }), bar("hp"), el("small", { class: "mc-txt" }), el("small", { class: "mc-patch" })]);
        this.cards[s.id] = c; grid.appendChild(c);
      });
      this.temp = bar("temp"); this.tempTxt = el("span", { class: "mtemp-t" });
      this.job = el("div", { class: "mjob hidden" }, [el("b", { class: "mj-t" }), bar("job")]);
      this.inv = el("div", { class: "minv" }); this.actions = el("div", { class: "mact" }); this.info = el("p", { class: "minfo" });
      root.appendChild(el("div", { class: "mech" }, [
        el("div", { class: "card-lite" }, [el("div", { class: "mtemp" }, [el("b", { text: "Température du moteur" }), this.temp, this.tempTxt]), this.job, this.inv]),
        grid, el("div", { class: "card-lite" }, [el("h3", { id: "m-sel-t" }), this.info, this.actions]),
        el("p", { class: "tipline", text: "Astuce, les freins et les pneus demandent un bus presque arrêté pour une réparation propre. Le ruban se fait en roulant mais lâche au bout de quarante-cinq secondes." }),
      ]));
    },
    update(v) {
      if (!v || !v.hp) return; this.v = v; if (!this.sel) this.sel = "engine";
      D.SYSTEMS.forEach((s) => {
        const c = this.cards[s.id], hp = v.hp[s.id]; c.querySelector(".bar").set(hp, hpColor(hp)); const lv = hp >= 60 ? "ok" : hp >= 30 ? "warn" : "crit";
        c.querySelector(".mc-txt").textContent = hp + " sur 100" + (s.id === "tank" && v.leak ? ", fuite" : ""); c.classList.toggle("sel", this.sel === s.id); c.classList.toggle("alert", lv === "crit" || (v.fake === s.id));
        const pt = v.patches.filter((p) => p.sys === s.id)[0]; c.querySelector(".mc-patch").textContent = pt ? "Ruban pendant encore " + pt.left + " s" : v.fake === s.id ? "Alerte rouge, vérifiez" : "";
      });
      this.temp.set((v.temp - 20) / 1.2, v.temp > 118 ? "#d6453d" : v.temp > 104 ? "#f0b429" : "#4fae5a"); this.tempTxt.textContent = v.temp + " degrés" + (v.stalled ? ", moteur calé" : v.temp > 118 ? ", danger" : v.temp > 104 ? ", chaud" : "");
      if (v.job) { this.job.classList.remove("hidden"); const j = v.job; this.job.querySelector(".mj-t").textContent = (j.kind === "refroidir" ? "Refroidissement" : j.kind === "propre" ? "Réparation propre" : "Ruban adhésif") + " sur " + D.SYSTEMS.filter((s) => s.id === j.sys)[0].label.toLowerCase() + (j.paused ? ", en pause tant que le bus roule" : ""); this.job.querySelector(".bar").set((1 - j.left / j.total) * 100, "#2f78d1"); } else this.job.classList.add("hidden");
      this.inv.innerHTML = ""; [["🔩", v.inv.spares, "pièces de rechange"], ["🎞️", v.inv.tape, "rouleaux de ruban"], ["💧", v.inv.coolant, "bidons de liquide"]].forEach(([ic, n, l]) => this.inv.appendChild(el("span", { class: "chip" + (n === 0 ? " chip--zero" : ""), title: l, text: ic + " " + n + " " + l })));
      if (v.hasHammer) this.inv.appendChild(el("span", { class: "chip", text: "🔨 Marteau en mousse" })); if (v.hasExt) this.inv.appendChild(el("span", { class: "chip", text: "🧯 Extincteur" }));
      const sysI = D.SYSTEMS.filter((s) => s.id === this.sel)[0]; document.getElementById("m-sel-t").textContent = sysI.icon + " " + sysI.label; this.info.textContent = sysI.info;
      this.buildActions(v, sysI);
    },
    buildActions(v, sysI) {
      const busy = !!v.job; const slow = v.bus.v <= 3; const sys = sysI.id; const R = D.REPAIRS; const defs = [];
      defs.push({ id: "propre", ic: R.propre.icon, label: "Réparation propre", detail: "1 pièce, 8 secondes, restaure beaucoup. Pièce d'origine 72 pour cent, d'un autre bus 16, absurde 12 (elle tient 70 secondes).", dis: busy ? "Une réparation est en cours." : v.inv.spares <= 0 ? "Plus de pièce de rechange." : (sys === "brakes" || sys === "tires") && !slow ? "Il faut que le bus soit presque arrêté." : "", go: () => act({ t: "repair", sys, kind: "propre" }) });
      defs.push({ id: "ruban", ic: R.ruban.icon, label: "Ruban adhésif", detail: "1 rouleau, 3 secondes, restaure un peu. Le ruban lâche au bout de 45 secondes.", dis: busy ? "Une réparation est en cours." : v.inv.tape <= 0 ? "Plus de ruban adhésif." : "", go: () => act({ t: "repair", sys, kind: "ruban" }) });
      const l = cd(v, "wrench"); defs.push({ id: "clef", ic: R.clef.icon, label: "Coup de clé", detail: "Gratuit. 50 pour cent d'aider un peu, 30 de ne rien faire, 20 d'abîmer encore.", dis: l > 0 ? "Prêt dans " + secTxt(l) : "", go: () => act({ t: "wrench", sys }) });
      if (v.hasHammer) { const l2 = cd(v, "hammer"); defs.push({ id: "marteau", ic: "🔨", label: "Marteau en mousse", detail: "Sans risque, restaure un peu. Le clown adore.", dis: l2 > 0 ? "Prêt dans " + secTxt(l2) : "", go: () => act({ t: "hammer", sys }) }); }
      if (sys === "engine" || sys === "cooling") defs.push({ id: "refroidir", ic: R.refroidir.icon, label: "Refroidir le moteur", detail: "1 bidon de liquide, 6 secondes, baisse nettement la température.", dis: busy ? "Une réparation est en cours." : v.inv.coolant <= 0 ? "Plus de liquide de refroidissement." : "", go: () => act({ t: "repair", sys: "engine", kind: "refroidir" }) });
      if (v.hasExt && (sys === "engine" || sys === "cooling")) defs.push({ id: "ext", ic: "🧯", label: "Extincteur", detail: "Refroidit tout de suite, mais le pare-brise du conducteur disparaît sous la mousse pendant 5 secondes.", dis: "", go: () => act({ t: "extinguish" }) });
      D.MECH_EXTRAS.forEach((x) => { const l3 = cd(v, x.id); defs.push({ id: x.id, ic: x.icon, label: x.label, detail: x.info, dis: l3 > 0 ? "Prêt dans " + secTxt(l3) : busy && x.id === "bidouille" ? "Une réparation est en cours." : "", go: () => act({ t: x.id }) }); });
      const sig = defs.map((d) => d.id).join(",") + sys; if (this.sig !== sig) { this.sig = sig; this.actions.innerHTML = ""; this.btns = {}; defs.forEach((d) => { const b = el("button", { class: "mbtn", onclick: () => d.go() }, [el("span", { class: "mb-ic", text: d.ic }), el("span", { class: "mb-main" }, [el("b", { text: d.label }), el("small", { text: d.detail }), el("small", { class: "why" })])]); this.btns[d.id] = b; this.actions.appendChild(b); }); }
      defs.forEach((d) => { const b = this.btns[d.id]; btnTip(b, d.dis); b.go = d.go; });
    },
    frame() { },
  };

  // ====================== NAVIGATEUR ======================
  const KIND = { direct: { label: "Route directe", ic: "⚡", note: "Plus courte, mais plus serrée et plus risquée." }, sure: { label: "Route sûre", ic: "🛡️", note: "Plus longue, plus calme." }, pittoresque: { label: "Route pittoresque", ic: "🌄", note: "Des curiosités pour les passagers." } };
  const nav = {
    hist: [],
    build(root) {
      this.sched = el("div", { class: "card-lite nsched" }); this.trail = el("div", { class: "ntrail" });
      this.drive = el("div", { class: "ndrive" }); this.stop = el("div", { class: "nstop hidden" });
      this.obj = el("div", { class: "card-lite" });
      root.appendChild(el("div", { class: "nav" }, [this.sched, this.trail, this.drive, this.stop, this.obj]));
      this.sig = ""; this.stopSig = "";
    },
    update(v) {
      this.v = v; const late = v.delay; const ahead = late <= 0;
      this.sched.innerHTML = ""; this.sched.appendChild(el("div", { class: "nrow" }, [
        el("div", { class: "nbig " + (late > 20 ? "bad" : ahead ? "good" : "") }, [el("small", { text: "Horaire" }), el("b", { text: ahead ? Math.abs(late) + " s d'avance" : late + " s de retard" })]),
        el("div", { class: "nbig " + (v.left < 240 ? "bad" : "") }, [el("small", { text: "Avant annulation de la mission" }), el("b", { text: Math.floor(v.left / 60) + " min " + String(v.left % 60).padStart(2, "0") })]),
        el("div", { class: "nbig" }, [el("small", { text: "Argent" }), el("b", { text: "💰 " + v.inv.money })]),
        el("div", { class: "nbig " + (v.fuel < 25 ? "bad" : "") }, [el("small", { text: "Carburant" }), el("b", { text: "⛽ " + v.fuel + " pour cent" })]),
      ]));
      // fil de la mission
      const total = v.nSeg; const hist = BB.routeHist; this.trail.innerHTML = "";
      for (let i = 0; i < total; i++) { const h = hist[i]; const cur = v.phase === "drive" ? i === v.si : i === v.si + 1; const done = v.phase === "drive" ? i < v.si : i <= v.si; this.trail.appendChild(el("div", { class: "tnode" + (done ? " done" : "") + (cur ? " cur" : "") }, [el("span", { text: h ? h.icon : cur ? "🚌" : "❔" }), el("small", { text: String(i + 1) })])); }
      this.trail.appendChild(el("div", { class: "tnode end" }, [el("span", { text: "🏁" }), el("small", { text: "fin" })]));
      if (v.phase === "stop") { this.drive.classList.add("hidden"); this.stop.classList.remove("hidden"); this.updateStop(v); } else { this.stop.classList.add("hidden"); this.drive.classList.remove("hidden"); this.updateDrive(v); }
      this.obj.innerHTML = ""; if (v.objectives.length) { this.obj.appendChild(el("h3", { text: "Objectifs de la compagnie" })); v.objectives.forEach((o) => this.obj.appendChild(el("div", { class: "obj obj--" + o.status, title: o.info }, [el("b", { text: (o.status === "ok" ? "✅ " : o.status === "fail" ? "❌ " : o.crit ? "⭐ " : "🎯 ") + o.label }), o.crit ? el("small", { text: "Critique, la mission échoue si on le rate." }) : el("small", { text: o.info })]))); }
    },
    updateDrive(v) {
      const u = v.upcoming; const d = this.drive;
      if (!this.dInfo) { this.dInfo = el("div"); this.dBtns = el("div", { class: "nbtns" }); d.appendChild(this.dInfo); d.appendChild(this.dBtns); this.annBtns = {}; }
      const info = this.dInfo; info.innerHTML = "";
      const B = u ? D.BIOMES.filter((b2) => b2.id === u.biome)[0] : null;
      info.appendChild(el("div", { class: "card-lite" }, [el("h3", { text: "Devant nous" }), u ? el("p", { text: B.icon + " " + B.label + ", encore " + u.remaining + " mètres avant l'arrêt. Environ " + u.obsAhead + " obstacle" + (u.obsAhead > 1 ? "s" : "") + " sur la route." }) : el("p", { text: "..." }), ...(u && u.pois.length ? [el("p", { class: "good", text: "À venir " + u.pois.map((p) => p.name + " dans " + p.in + " mètres").join(", ") + "." })] : [])]));
      const fc = v.forecast || []; info.appendChild(el("div", { class: "card-lite" }, [el("h3", { text: "Prévisions" }), fc.length ? el("div", {}, fc.map((f) => el("p", { class: "fc", text: f.icon + " " + f.title + " dans " + f.in + " secondes. Préviens le conducteur par radio." }))) : el("p", { class: "muted", text: "Rien de prévu pour les prochaines secondes." })]));
      if (v.tip) info.appendChild(el("div", { class: "card-lite tip" }, [el("h3", { text: "Tuyau d'un passager" }), el("p", { text: v.tip.text }), el("small", { text: "Sa fiabilité est douteuse." })]));
      const defs = D.ANNOUNCES.map((a) => [a.id, a.icon, a.label, a.tip]);
      const sig = String(v.radioOn); if (this.dSig !== sig) { this.dSig = sig; this.dBtns.innerHTML = ""; this.annBtns = {};
        defs.forEach(([k, ic, l, tip]) => { const b2 = el("button", { class: "mbtn", onclick: () => act({ t: "announce", tpl: k }) }, [el("span", { class: "mb-ic", text: ic }), el("span", { class: "mb-main" }, [el("b", { text: l }), el("small", { text: tip }), el("small", { class: "why" })])]); this.annBtns[k] = b2; this.dBtns.appendChild(b2); });
        if (v.radioOn) this.dBtns.appendChild(el("button", { class: "mbtn", onclick: () => act({ t: "radio_off" }) }, [el("span", { class: "mb-ic", text: "📻" }), el("span", { class: "mb-main" }, [el("b", { text: "Couper la radio" }), el("small", { text: "La radio pirate hurle de l'accordéon." })])])); }
      const c = cd(v, "announce"); const dis = c > 0 ? "Prêt dans " + secTxt(c) : v.lights.electric === "crit" ? "Le micro est en panne." : "";
      Object.keys(this.annBtns).forEach((k) => btnTip(this.annBtns[k], dis));
    },
    updateStop(v) {
      const s = this.stop; const last = v.last; const sig = JSON.stringify([v.si, v.chosen, v.options, v.inv, v.gpsHint, v.hasGps, v.last, cd(v, "gps") > 0, v.canDepart, v.phase]);
      if (sig === this.stopSig) return; this.stopSig = sig; s.innerHTML = "";
      if (last) { s.appendChild(el("div", { class: "card-lite" }, [el("h3", { text: "Terminus" }), el("p", { text: "La mission est terminée." })])); return; }
      s.appendChild(el("div", { class: "card-lite" }, [el("h3", { text: "Choisis la prochaine route" }), el("p", { class: "muted", text: "Chaque route change la conduite. " + (v.lights.electric === "crit" ? "Le circuit électrique est en panne, ta carte papier est ancienne et ses infos sont douteuses." : "Les infos viennent du GPS de bord et sont fiables en général.") })]));
      const row = el("div", { class: "routes" });
      (v.options || []).forEach((o) => {
        const B = D.BIOMES.filter((b) => b.id === o.biome)[0] || D.BIOMES[0]; const K = KIND[o.kind]; const picked = v.chosen === o.kind;
        const c = el("button", { class: "route" + (picked ? " picked" : "") + (o.blocked ? " blocked" : ""), disabled: o.blocked, onclick: () => act({ t: "route", kind: o.kind }) }, [el("span", { class: "r-ic", text: K.ic }), el("b", { text: K.label }), el("span", { text: B.icon + " " + B.label }), el("small", { text: "Environ " + o.len + " mètres" + (o.pois ? ", " + o.pois + " curiosité" + (o.pois > 1 ? "s" : "") : "") }), el("small", { text: K.note }), v.gpsHint === o.kind ? el("small", { class: "good", text: "🛰️ Le GPS jure que c'est la meilleure." }) : null, o.blocked ? el("small", { class: "bad", text: "Barrée par des travaux." }) : null, o.dubious ? el("small", { class: "bad", text: "Carte ancienne, infos douteuses." }) : null, picked ? el("small", { class: "good", text: "Route choisie" }) : null]);
        row.appendChild(c);
      });
      s.appendChild(row);
      if (v.hasGps) { const l = cd(v, "gps"); const b = el("button", { class: "mbtn", onclick: () => act({ t: "gps" }) }, [el("span", { class: "mb-ic", text: "🛰️" }), el("span", { class: "mb-main" }, [el("b", { text: "Demander son avis au GPS très confiant" }), el("small", { text: "Il a raison une fois sur deux, mais il ne doute jamais." }), el("small", { class: "why", text: l > 0 ? "Prêt dans " + secTxt(l) : "" })])]); b.disabled = l > 0; s.appendChild(b); }
      const shop = el("div", { class: "card-lite" }, [el("h3", { text: "Boutique de la station" })]); const P = v.prices || {}; const list = el("div", { class: "shop" });
      [["fuel", "⛽", "Plein de 25 pour cent", "fuel"], ["spares", "🔩", "Pièce de rechange", "spares"], ["tape", "🎞️", "2 rouleaux de ruban", "tape"], ["coolant", "💧", "Bidon de liquide", "coolant"], ["snacks", "🥨", "4 snacks", "snacks"], ["medkit", "🧰", "Trousse de secours", "medkit"]].forEach(([w, ic, l]) => {
        const price = P[w] || 0; const poor = v.inv.money < price; const full = w === "fuel" && v.fuel >= 99;
        const b = el("button", { class: "mbtn shopbtn", onclick: () => act({ t: "buy", what: w }) }, [el("span", { class: "mb-ic", text: ic }), el("span", { class: "mb-main" }, [el("b", { text: l }), el("small", { text: price + " pièces" }), el("small", { class: "why", text: full ? "Le réservoir est plein." : poor ? "Pas assez d'argent." : "" })])]); b.disabled = poor || full; list.appendChild(b);
      });
      shop.appendChild(list); s.appendChild(shop);
      const go = el("button", { class: "btn btn--accent btn--big", text: "Donner le départ", onclick: () => act({ t: "depart" }) }); go.disabled = !v.canDepart; s.appendChild(go);
    },
    frame() { },
  };

  // ====================== CABINE ======================
  const cabin = {
    sel: null, cards: {},
    build(root) {
      this.grid = el("div", { class: "pgrid" }); this.bar = el("div", { class: "cbar" }); this.head = el("div", { class: "chead" });
      root.appendChild(el("div", { class: "cabin" }, [this.head, this.grid, this.bar]));
      this.sig = "";
    },
    update(v) {
      if (!v.pax) return; this.v = v; const ids = v.pax.map((p) => p.id);
      Object.keys(this.cards).forEach((id) => { if (!ids.includes(id)) { this.cards[id].remove(); delete this.cards[id]; if (this.sel === id) this.sel = null; } });
      v.pax.forEach((p) => {
        let c = this.cards[p.id];
        if (!c) { const cv = el("canvas", { width: 96, height: 96 }); c = el("button", { class: "pcard", "data-pid": p.id, onclick: () => { this.sel = p.id; this.update(this.v); } }, [cv, el("b", { class: "p-name" }), el("small", { class: "p-arch" }), bar("mood"), el("div", { class: "p-req" })]); c.cv = cv; this.cards[p.id] = c; this.grid.appendChild(c); }
        const A = D.ARCH_BY_ID[p.arch]; c.querySelector(".p-name").textContent = (p.vip ? "👑 " : p.parcel ? "📦 " : "") + p.name; c.querySelector(".p-arch").textContent = A.name + (p.trait ? " (" + D.TRAIT_BY_ID[p.trait].label + ")" : ""); c.querySelector(".bar").set(p.mood, hpColor(p.mood));
        c.classList.toggle("sel", this.sel === p.id); c.classList.toggle("sick", p.state === "malaise"); c.classList.toggle("mad", p.state === "colere" || p.state === "panique");
        const rq = c.querySelector(".p-req"); if (p.req) { const R = D.REQUESTS[p.req.type]; rq.textContent = R.icon + " " + R.label + " (" + p.req.left + " s)"; rq.className = "p-req on" + (p.req.left < 15 ? " urgent" : ""); } else { rq.textContent = p.state === "malaise" ? "🤢 Malaise" : p.state === "colere" ? "🥊 Dispute" : p.state === "dort" ? "😴 Dort" : ""; rq.className = "p-req" + (p.state !== "normal" ? " on" : ""); }
      });
      if (!this.head.firstChild) this.head.appendChild(el("p", { class: "muted", text: "Clique sur un passager pour lui parler, le nourrir ou le calmer. Sa jauge indique son humeur. Certaines personnalités se révèlent quand tu discutes avec eux." }));
      this.buildBar(v);
    },
    buildBar(v) {
      const p = v.pax.filter((q) => q.id === this.sel)[0]; const bar2 = this.bar;
      const defs = []; D.CABIN_ACTIONS.forEach((a) => { if (a.id === "baffe" && !v.slapsOn) return; (a.id === "cadeau" ? (v.cabinItems.length ? v.cabinItems : [null]) : [null]).forEach((item) => defs.push({ a, item })); });
      const sig = defs.map((d) => d.a.id + (d.item || "")).join(",");
      if (this.barSig !== sig) { this.barSig = sig; bar2.innerHTML = ""; this.selBox = el("div", { class: "csel" }, [el("b"), el("small")]); bar2.appendChild(this.selBox); const row = el("div", { class: "cacts" }); this.cbtns = []; bar2.appendChild(row);
        defs.forEach((d) => { const b = el("button", { class: "mbtn cbtn" }, [el("span", { class: "mb-ic" }), el("span", { class: "mb-main" }, [el("b"), el("small"), el("small", { class: "why" })])]); b.d = d; b.onclick = () => BB.send({ t: "cabin", action: d.a.id, pid: this.sel || undefined, item: d.item || undefined }, (r) => this.feedback(r, this.v.pax.filter((q) => q.id === this.sel)[0])); this.cbtns.push(b); row.appendChild(b); }); }
      this.selBox.firstChild.textContent = p ? "Sélection " + p.name : "Aucun passager choisi"; this.selBox.lastChild.textContent = p ? D.ARCH_BY_ID[p.arch].blurb : "Les actions qui visent un passager demandent d'en choisir un.";
      this.cbtns.forEach((b) => {
        const a = b.d.a, item = b.d.item; let dis = ""; const l = cd(v, "cabin:" + a.id);
        if (a.target && !p) dis = "Choisis d'abord un passager."; else if (l > 0) dis = "Prêt dans " + secTxt(l);
        else if (a.id === "snack" && v.inv.snacks <= 0) dis = "Plus de snacks."; else if (a.id === "soigner" && v.inv.medkit <= 0) dis = "Plus de trousse de secours."; else if (a.id === "soigner" && p && p.state !== "malaise") dis = "Ce passager n'a pas de malaise.";
        else if (a.id === "evacuer" && v.phase !== "stop") dis = "Seulement quand le bus est à l'arrêt."; else if (a.id === "cadeau" && !item) dis = "Aucun objet à offrir.";
        const odds = a.target && p ? Math.round(D.cabinOdds(a.id, { arch: p.arch, mood: p.mood, state: p.state }, { speed: v.bus.v }) * 100) : null;
        const label = a.id === "cadeau" ? "Offrir " + (D.ITEM_BY_ID[item] ? D.ITEM_BY_ID[item].label.toLowerCase() : "un objet") : a.label;
        b.querySelector(".mb-ic").textContent = a.id === "cadeau" && D.ITEM_BY_ID[item] ? D.ITEM_BY_ID[item].icon : a.icon; b.querySelector("b").textContent = label + (odds != null && !dis ? " (" + odds + " pour cent)" : ""); b.querySelectorAll("small")[0].textContent = a.info; btnTip(b, dis);
      });
    },
    feedback(r, p) { if (!r || !p) return; const c = this.cards[p.id]; if (!c) return; BB.pop(c, r.result === "success" ? "Bien joué" : "Raté"); },
    frame(dt, t) {
      if (!this.v || !this.v.pax) return; this.v.pax.forEach((p) => { const c = this.cards[p.id]; if (!c) return; const cx = c.cv.getContext("2d"); cx.clearRect(0, 0, 96, 96); Dr.paxBust(cx, p, 48, 92, 0.78, t); });
    },
  };

  return { driver, mech, nav, cabin };
})();

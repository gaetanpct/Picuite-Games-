// ============================================================
// ORAPA MINE — Interface de jeu (client)
// Le carnet 2D sert à jouer, la grotte 3D montre la lumière.
// ============================================================
(function () {
  const { el, $, toast, sound } = Kit;
  const R = OMRules, E = OMEngine;
  const COLORS = [
    { name: "Rubis", hex: "#ff4a6a" }, { name: "Topaze", hex: "#ffc83d" }, { name: "Émeraude", hex: "#2fd66b" }, { name: "Saphir", hex: "#4a86ff" },
    { name: "Améthyste", hex: "#b06bff" }, { name: "Citrine", hex: "#ff8a1f" }, { name: "Aigue-marine", hex: "#35d4d4" }, { name: "Diamant", hex: "#e8f1ff" },
  ];
  const NS = "http://www.w3.org/2000/svg";
  const G = { st: null, over: null, offset: 0, samples: [], round: -1, hyp: [], notes: new Set(), sel: null, slot: null, mask: 7, tool: "tir", tab: "journal", askCell: null, unitView: 0, shotsSeen: 0, newUntil: {}, attached: false, lastKey: "", hint: null };
  const myId = () => { const p = Kit.me(); return p ? p.id : null; };
  const pl = (id) => (Kit.room ? Kit.room.players.find((p) => p.id === id) : null);
  const nameOf = (id) => { const p = pl(id); return p ? p.name : "?"; };
  const hexOf = (id) => { const p = pl(id); return COLORS[((p && p.color) || 0) % COLORS.length].hex; };
  const snow = () => Date.now() + G.offset;
  const sample = (n) => { G.samples.push(n - Date.now()); if (G.samples.length > 10) G.samples.shift(); G.offset = Math.max.apply(null, G.samples); };
  const sfx = (f) => { if (!G.st || G.st.sfx !== false) f(); };
  const dot = (id) => el("i", { class: "dotc", style: { background: hexOf(id) }, title: nameOf(id) });
  const svg = (tag, attrs, kids) => { const n = document.createElementNS(NS, tag); Object.keys(attrs || {}).forEach((k) => n.setAttribute(k, attrs[k])); (kids || []).forEach((c) => c && n.appendChild(c)); return n; };
  const fa = () => !!(G.st && G.st.faithful);
  const HEX = new Proxy({}, { get: (_, m) => E.hexOf(+m, fa()) });
  const CNAME = new Proxy({}, { get: (_, m) => E.nameOf(+m, fa()) });
  const lum = (hex) => { const n = parseInt(hex.slice(1), 16); return 0.299 * (n >> 16) + 0.587 * ((n >> 8) & 255) + 0.114 * (n & 255); };
  const inkOn = (hex) => (lum(hex) > 150 ? "#14182e" : "#ffffff");
  const gemLabel = (m, f) => { if (f !== false && m.k === "gem") return m.m === 0 ? "Diamant" : "Pierre " + ({ 1: "rouge", 2: "bleue", 4: "jaune", 8: "blanche" }[m.m] || "colorée"); if (m.k === "obsidian" && fa()) return "Corps noir"; return E.KINDS[m.k].label + (m.m ? " " + E.nameOf(m.m, false) : ""); };
  const COLS = "ABCDEFGHIJKL";
  const slotLabel = (sl) => (sl.s === "N" || sl.s === "S" ? COLS[sl.i] : String(sl.i + 1));
  const slotLong = (sl) => ({ N: "haut", S: "bas", W: "gauche", E: "droite" }[sl.s]) + " " + slotLabel(sl);
  const cellName = (x, y) => COLS[x] + (y + 1);
  const secs = (ms) => Math.max(0, Math.ceil(ms / 1000));
  const cellsOf = (shape, rot) => E.rot(E.SHAPES[shape], rot || 0);

  // ---------- squelette ----------
  function build() {
    const sc = $("#screen-game"); sc.innerHTML = "";
    sc.appendChild(el("div", { class: "om-bg" }));
    sc.appendChild(el("div", { class: "om-top", id: "om-top" }));
    sc.appendChild(el("div", { class: "om-timer hidden", id: "om-timer" }, [el("i", { id: "om-timer-fill" }), el("span", { id: "om-timer-txt" })]));
    sc.appendChild(el("main", { class: "om-stage", id: "om-stage" }));
    sc.appendChild(el("button", { class: "round-btn om-menu", title: "Menu", text: "⚙️", onclick: openMenu }));
  }
  function openMenu() {
    const sbtn = el("button", { class: "btn btn--small btn--ghost", text: sound.enabled ? "Son activé" : "Son coupé", onclick: (ev) => { ev.target.textContent = sound.toggle() ? "Son activé" : "Son coupé"; } });
    const rows = [el("div", { class: "menu-row" }, [el("div", {}, [el("b", { text: "Sons" }), el("p", { class: "small muted", text: "Lasers, cristaux et éboulements." })]), sbtn]),
      el("h3", { text: "Les pierres", style: { marginTop: "0.8rem" } })];
    rows.push(el("p", { class: "small", text: "La sonde est transparente. Chaque pierre qu'elle touche la renvoie en diagonale et lui donne sa couleur, une seule fois par couleur. Rouge et bleu font du violet, rouge et jaune de l'orange, bleu et jaune du vert. Le blanc éclaircit. Un diamant renvoie sans colorer, le corps noir avale tout." }));
    rows.push(el("button", { class: "btn btn--danger btn--small", style: { marginTop: "0.8rem" }, text: "Quitter la partie", onclick: () => Kit.confirm("Quitter la partie et revenir à l'accueil ?", () => { $("#modal").classList.add("hidden"); Kit.leave(); }) }));
    Kit.showModal("Menu", rows);
  }

  // ---------- réception ----------
  function onState(s) {
    sample(s.now);
    const prev = G.st; G.st = s;
    if (s.round !== G.round) { G.round = s.round; G.hyp = []; G.notes = new Set(); G.sel = null; G.slot = null; G.askCell = null; G.shotsSeen = 0; G.newUntil = {}; G.hint = null; G.tool = "tir"; G.unitView = s.myUnit !== null && s.myUnit !== undefined ? s.myUnit : 0; }
    const key = s.phase + "|" + s.round;
    if (key !== G.lastKey) { G.lastKey = key; phaseEnter(s, prev); }
    if (s.phase === "play" && s.shots) {
      if (s.shots.length > G.shotsSeen) { for (let i = G.shotsSeen; i < s.shots.length; i++) { G.newUntil[s.shots[i].n] = Date.now() + 3000; shotSound(s.shots[i]); } G.shotsSeen = s.shots.length; }
    }
    render();
  }
  function phaseEnter(s, prev) {
    if (s.phase === "play") sfx(() => { sound.tone(330, 0.12, "triangle", 0.09); sound.tone(494, 0.14, "triangle", 0.09, 0.1); sound.tone(660, 0.2, "triangle", 0.1, 0.2); });
    if (s.phase === "reveal") sfx(() => { [392, 523, 659, 784].forEach((f, i) => sound.tone(f, 0.25, "triangle", 0.1, i * 0.1)); });
  }
  function shotSound(sh) {
    sfx(() => { sound.tone(900, 0.08, "sawtooth", 0.05); sound.tone(1300, 0.12, "sawtooth", 0.05, 0.05); if (sh.absorbed && !sh.exits.length) sound.tone(150, 0.4, "sawtooth", 0.07, 0.2); else sound.tone(600 + (sh.exits.length ? sh.exits[0].m * 30 : 0), 0.12, "triangle", 0.07, 0.3); });
  }
  function onOver(m) { G.over = m; G.lastKey = ""; render(); sfx(() => sound.win()); }
  function onAccuseResult(m) {
    if (m.ok) { sfx(() => { [523, 659, 784, 1047].forEach((f, i) => sound.tone(f, 0.2, "triangle", 0.12, i * 0.1)); }); return; }
    G.hint = m.hint; sfx(() => sound.fail());
    toast(m.out ? "Mauvaise accusation, tu sors de la manche." : "Mauvaise accusation." + (m.hint !== null && m.hint !== undefined ? " Pierres bien placées " + m.hint + " sur " + G.st.inv.length + "." : ""));
  }
  function onRandom(m) { G.hyp = []; (m.placement || []).forEach((p) => { G.hyp[p.idx] = { x: p.x, y: p.y, rot: p.rot, d: p.d }; }); render(); }

  // ---------- rendu ----------
  function render() {
    const s = G.st; if (!s || !Kit.room) return;
    renderTop();
    const tm = $("#om-timer"); tm.classList.toggle("hidden", !(s.phaseUntil && (s.phase === "setup" || s.phase === "play" || s.phase === "reveal")));
    const stage = $("#om-stage"); const top = stage.scrollTop; stage.innerHTML = "";
    if (s.phase === "over") buildOver(stage);
    else if (s.phase === "wait" || !s.W) stage.appendChild(el("div", { class: "om-card om-wait" }, [el("div", { class: "om-bigemoji", text: "⛏️" }), el("h2", { text: "On descend dans la mine" })]));
    else if (s.phase === "setup") buildSetup(stage, s);
    else if (s.phase === "play") buildPlay(stage, s);
    else if (s.phase === "reveal") buildReveal(stage, s);
    stage.scrollTop = top;
  }
  function renderTop() {
    const s = G.st, r = Kit.room; const box = $("#om-top"); if (!box) return;
    const mine = s.units ? s.units.find((u) => u.id === s.myUnit) : null;
    const rows = r.players.map((p) => el("div", { class: "om-chip" + (p.id === s.directorId ? " om-chip--dir" : "") + (p.id === myId() ? " om-chip--you" : "") + (p.left || (!p.isBot && !p.connected) ? " om-chip--off" : "") }, [dot(p.id), el("span", { class: "nm", text: (p.id === s.directorId ? "🎩 " : "") + p.name }), el("b", { text: String((s.scores || {})[p.id] || 0) })]));
    let label = s.phase === "over" ? "Fin de l'expédition" : "Manche " + (s.round + 1) + " sur " + s.rounds;
    if (s.campaign) label = "Niveau " + s.campaign.level + " sur " + s.campaign.levels; else if (s.puzzle) label = "Énigme " + s.puzzle;
    if (s.phase === "play" && mine && s.budget) label += "  ·  Tirs restants " + Math.max(0, s.budget - mine.used);
    box.innerHTML = ""; box.appendChild(el("div", { class: "om-round", text: label })); box.appendChild(el("div", { class: "om-scores" }, rows));
  }

  // ---------- plateau SVG ----------
  // opts : { gems (vrais), hyp (hypothèses), shots, asks, onCell, onSlot, selSlot, selCell, notes, reveal }
  const S = 44;
  const txt = (t) => document.createTextNode(t);
  function slotXY(sl, W, H) { return sl.s === "N" ? [(sl.i + 1.5) * S, 0.6 * S] : sl.s === "S" ? [(sl.i + 1.5) * S, (H + 1.4) * S] : sl.s === "W" ? [0.6 * S, (sl.i + 1.5) * S] : [(W + 1.4) * S, (sl.i + 1.5) * S]; }
  const P = (p) => ((p[0] + 1.5) * S) + "," + ((p[1] + 1.5) * S);
  function boardSvg(s, opts) {
    const W = s.W, H = s.H; const vw = (W + 2) * S, vh = (H + 2) * S; const f = !!s.faithful;
    const root = svg("svg", { viewBox: "0 0 " + vw + " " + vh, class: "om-board", role: "img", "aria-label": "Plateau de la mine, " + W + " colonnes et " + H + " lignes" });
    const defs = svg("defs", {}, [
      svg("linearGradient", { id: "omFrame", x1: 0, y1: 0, x2: 1, y2: 1 }, [svg("stop", { offset: "0", "stop-color": "#3b4bb0" }), svg("stop", { offset: "1", "stop-color": "#1b2563" })]),
      svg("filter", { id: "omGlow", x: "-50%", y: "-50%", width: "200%", height: "200%" }, [svg("feGaussianBlur", { stdDeviation: 2.2, result: "b" }), svg("feMerge", {}, [svg("feMergeNode", { in: "b" }), svg("feMergeNode", { in: "SourceGraphic" })])]),
    ]); root.appendChild(defs);
    root.appendChild(svg("rect", { x: S * 0.95, y: S * 0.95, width: (W + 0.1) * S, height: (H + 0.1) * S, rx: 12, fill: "#0b1030", stroke: "url(#omFrame)", "stroke-width": 7 }));
    for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
      const sel = opts.selCell && opts.selCell[0] === x && opts.selCell[1] === y;
      const c = svg("rect", { x: (x + 1) * S + 1.5, y: (y + 1) * S + 1.5, width: S - 3, height: S - 3, rx: 5, fill: (x + y) % 2 ? "#1c2656" : "#162049", class: "om-cell" + (sel ? " om-cell--sel" : "") });
      if (opts.onCell) { c.style.cursor = "pointer"; c.addEventListener("click", () => opts.onCell(x, y)); }
      root.appendChild(c);
      if (y === 0) root.appendChild(svg("text", { x: (x + 1) * S + 6, y: (y + 1) * S + 14, class: "om-coord" }, [txt(COLS[x])]));
      if (x === 0) root.appendChild(svg("text", { x: (x + 1) * S + 6, y: (y + 1) * S + (y === 0 ? 28 : 14), class: "om-coord" }, [txt(String(y + 1))]));
    }
    if (opts.notes) opts.notes.forEach((k) => { const [x, y] = k.split(",").map(Number); root.appendChild(svg("text", { x: (x + 1.5) * S, y: (y + 1.5) * S + 7, "text-anchor": "middle", "font-size": 22, fill: "#8d99d8", "pointer-events": "none" }, [txt("✕")])); });
    if (opts.gems) opts.gems.forEach((gm) => drawGem(root, gm, f, 1, false, opts.onCell));
    if (opts.hyp) opts.hyp.forEach((h, i) => { if (!h) return; const meta = s.inv[i]; const gm = { k: meta.k, m: meta.m, d: h.d, cells: cellsOf(meta.shape, h.rot), x: h.x, y: h.y, idx: i }; drawGem(root, gm, f, 0.88, G.sel === i && G.tool === "pose", (x, y) => { if (G.tool === "pose") { G.sel = i; render(); } else if (opts.onCell) opts.onCell(x, y); }, true); });
    // réponses aux questions sur une case
    if (opts.asks) opts.asks.forEach((a) => { const cx = (a.x + 1.5) * S, cy = (a.y + 1.5) * S; const hex = a.k === "vide" ? "#7f8ac8" : a.k === "obsidian" ? "#0b0b14" : HEX[a.m || 0];
      root.appendChild(svg("g", { class: "om-ask", "pointer-events": "none" }, [svg("circle", { cx, cy, r: S * 0.3, fill: a.k === "vide" ? "none" : hex, stroke: a.k === "obsidian" ? "#9a8cff" : "#fff", "stroke-width": 3, "stroke-dasharray": a.k === "vide" ? "4 4" : "0" }), svg("text", { x: cx, y: cy + 5, "text-anchor": "middle", "font-size": 14, "font-weight": 800, fill: a.k === "vide" ? "#aeb8f0" : inkOn(a.k === "obsidian" ? "#0b0b14" : hex) }, [txt("?")])])); });
    // rayons, tracés complets ou partiels
    const now = Date.now();
    if (opts.shots) opts.shots.forEach((sh) => {
      if (!sh.rays) return; const fresh = !opts.reveal && G.newUntil[sh.n] > now; const hxs = HEX[sh.mask || 0];
      sh.rays.forEach((r, ri) => {
        if (!r.pts || r.pts.length < 2) return; const col = HEX[r.m !== undefined && r.m !== null ? r.m : sh.mask] || hxs;
        const pts = r.pts.map(P).join(" ");
        root.appendChild(svg("polyline", { points: pts, fill: "none", stroke: col, "stroke-width": 9, "stroke-linecap": "round", "stroke-linejoin": "round", opacity: 0.22, "pointer-events": "none" }));
        const pl = svg("polyline", { points: pts, fill: "none", stroke: col, "stroke-width": 4, "stroke-linecap": "round", "stroke-linejoin": "round", pathLength: 1, class: "om-ray" + (fresh ? " om-ray--new" : ""), style: fresh ? "animation-delay:" + (ri * 0.25) + "s" : "", "pointer-events": "none", filter: "url(#omGlow)" });
        root.appendChild(pl);
        // rebonds
        for (let k = 1; k < r.pts.length - 1; k++) { const a = r.pts[k - 1], b = r.pts[k], c = r.pts[k + 1]; if ((b[0] - a[0]) * (c[1] - b[1]) - (b[1] - a[1]) * (c[0] - b[0]) !== 0) root.appendChild(svg("circle", { cx: (b[0] + 1.5) * S, cy: (b[1] + 1.5) * S, r: 5, fill: "#fff", stroke: col, "stroke-width": 2, class: "om-bounce" + (fresh ? " om-bounce--new" : ""), "pointer-events": "none" })); }
        if (r.end === "absorb") { const e = r.pts[r.pts.length - 1]; root.appendChild(svg("text", { x: (e[0] + 1.5) * S, y: (e[1] + 1.5) * S + 7, "text-anchor": "middle", "font-size": 22, "font-weight": 900, fill: "#ff5a5a", class: "om-absorb" + (fresh ? " om-absorb--new" : ""), "pointer-events": "none" }, [txt("✕")])); }
      });
    });
    // entrées et sorties
    E.slotsOf(W, H).forEach((sl) => {
      const p = slotXY(sl, W, H); const shotsHere = (opts.shots || []).filter((sh) => E.slotKey(sh.slot) === E.slotKey(sl));
      const exitsHere = []; (opts.shots || []).forEach((sh) => sh.exits.forEach((e) => { if (E.slotKey(e) === E.slotKey(sl)) exitsHere.push({ n: sh.n, m: e.m, sh }); }));
      const sel = opts.selSlot && E.slotKey(opts.selSlot) === E.slotKey(sl);
      const g = svg("g", { class: "om-slot" + (sel ? " om-slot--sel" : "") + (opts.onSlot ? " om-slot--btn" : "") });
      const lastSh = shotsHere[shotsHere.length - 1], lastEx = exitsHere[exitsHere.length - 1];
      const fresh = (lastSh && G.newUntil[lastSh.n] > now) || (lastEx && G.newUntil[lastEx.n] > now);
      g.appendChild(svg("circle", { cx: p[0], cy: p[1], r: S * 0.37, fill: sel ? "#ffd23f" : "#1a2358", stroke: sel ? "#fff" : "#5365d6", "stroke-width": 2.5, class: "om-slot__bg" }));
      if (lastSh) { const hex = HEX[lastSh.mask || 0]; g.appendChild(svg("circle", { cx: p[0], cy: p[1], r: S * 0.31, fill: hex, class: fresh ? "om-pulse" : "" })); g.appendChild(svg("text", { x: p[0], y: p[1] + 5, "text-anchor": "middle", "font-size": 15, "font-weight": 800, fill: inkOn(hex), "pointer-events": "none" }, [txt(String(lastSh.n) + (lastSh.absorbed && !lastSh.exits.length ? "✕" : ""))])); }
      else if (lastEx) { const hex = HEX[lastEx.m || 0]; g.appendChild(svg("rect", { x: p[0] - S * 0.28, y: p[1] - S * 0.28, width: S * 0.56, height: S * 0.56, rx: 7, fill: hex, stroke: "#fff", "stroke-width": 2, class: fresh ? "om-pulse" : "" })); g.appendChild(svg("text", { x: p[0], y: p[1] + 5, "text-anchor": "middle", "font-size": 15, "font-weight": 800, fill: inkOn(hex), "pointer-events": "none" }, [txt(String(lastEx.n))])); }
      else g.appendChild(svg("text", { x: p[0], y: p[1] + 5, "text-anchor": "middle", "font-size": 14, "font-weight": 700, fill: sel ? "#2a1a00" : "#9fb0ff", "pointer-events": "none" }, [txt(slotLabel(sl))]));
      if (opts.onSlot) { g.style.cursor = "pointer"; g.addEventListener("click", () => opts.onSlot(sl)); }
      root.appendChild(g);
    });
    return root;
  }
  // une pierre dessinée case par case
  function drawGem(root, gm, f, scale, selected, onClick, ghost) {
    gm.cells.forEach(([dx, dy]) => {
      const x = (gm.x + dx + 1) * S, y = (gm.y + dy + 1) * S; const pad = S * (1 - scale) / 2 + 2.5; const w = S - pad * 2; const g = svg("g", { class: "om-gem" + (ghost ? " om-gem--ghost" : "") });
      const cxp = x + S / 2, cyp = y + S / 2; const x0 = x + pad, y0 = y + pad, x1 = x + pad + w, y1 = y + pad + w;
      if (gm.k === "gem") {
        const hex = f && gm.m === 0 ? "#bfefff" : E.hexOf(gm.m, true); const dark = gm.m === 0 ? "#6fc3e6" : shade(hex);
        g.appendChild(svg("rect", { x: x0, y: y0, width: w, height: w, rx: 7, fill: dark, opacity: 0.35 }));
        const tri = gm.d ? [[x0, y0], [x1, y1], [x0, y1]] : [[x0, y1], [x1, y0], [x1, y1]];
        g.appendChild(svg("polygon", { points: tri.map((q) => q.join(",")).join(" "), fill: hex, opacity: gm.m === 0 ? 0.55 : 0.95, stroke: "#fff", "stroke-width": 2, "stroke-linejoin": "round" }));
        g.appendChild(svg("line", gm.d ? { x1: x0, y1: y0, x2: x1, y2: y1, stroke: "#fff", "stroke-width": 3.5, "stroke-linecap": "round" } : { x1: x0, y1: y1, x2: x1, y2: y0, stroke: "#fff", "stroke-width": 3.5, "stroke-linecap": "round" }));
        g.appendChild(svg("circle", { cx: gm.d ? cxp - w * 0.16 : cxp + w * 0.16, cy: cyp + w * 0.18, r: 3, fill: "#fff", opacity: 0.8 }));
      }
      else if (gm.k === "filter") g.appendChild(svg("rect", { x: x0, y: y0, width: w, height: w, rx: 6, fill: HEX[gm.m], opacity: ghost ? 0.6 : 0.75, stroke: "#fff", "stroke-width": 2 }));
      else if (gm.k === "mirror") { g.appendChild(svg("rect", { x: x0, y: y0, width: w, height: w, rx: 6, fill: "#46506f", stroke: "#cfd8ff", "stroke-width": 2 })); g.appendChild(svg("line", gm.d ? { x1: x0 + 3, y1: y0 + 3, x2: x1 - 3, y2: y1 - 3, stroke: "#e8f0ff", "stroke-width": 5, "stroke-linecap": "round" } : { x1: x0 + 3, y1: y1 - 3, x2: x1 - 3, y2: y0 + 3, stroke: "#e8f0ff", "stroke-width": 5, "stroke-linecap": "round" })); }
      else if (gm.k === "obsidian") { g.appendChild(svg("rect", { x: x0, y: y0, width: w, height: w, rx: 10, fill: "#05050c", stroke: "#8a78ff", "stroke-width": 2.5 })); g.appendChild(svg("circle", { cx: cxp - w * 0.15, cy: cyp - w * 0.15, r: 3.5, fill: "#9a8cff" })); }
      else if (gm.k === "prism") { g.appendChild(svg("polygon", { points: cxp + "," + y0 + " " + x1 + "," + y1 + " " + x0 + "," + y1, fill: "#e8f6ff", opacity: 0.85, stroke: "#9fd8ff", "stroke-width": 2 })); g.appendChild(svg("line", { x1: cxp, y1: cyp, x2: cxp - 7, y2: cyp - 6, stroke: "#ff3b4e", "stroke-width": 3 })); g.appendChild(svg("line", { x1: cxp, y1: cyp, x2: cxp + 7, y2: cyp - 6, stroke: "#3b7bff", "stroke-width": 3 })); }
      else if (gm.k === "splitter") { g.appendChild(svg("polygon", { points: cxp + "," + y0 + " " + x1 + "," + cyp + " " + cxp + "," + y1 + " " + x0 + "," + cyp, fill: "#7fe8ff", opacity: 0.8, stroke: "#fff", "stroke-width": 2 })); g.appendChild(svg("line", gm.d ? { x1: x0 + 6, y1: y0 + 6, x2: x1 - 6, y2: y1 - 6, stroke: "#fff", "stroke-width": 3 } : { x1: x0 + 6, y1: y1 - 6, x2: x1 - 6, y2: y0 + 6, stroke: "#fff", "stroke-width": 3 })); }
      else if (gm.k === "tint") { g.appendChild(svg("circle", { cx: cxp, cy: cyp, r: w / 2, fill: HEX[gm.m], opacity: 0.85, stroke: "#fff", "stroke-width": 2 })); g.appendChild(svg("circle", { cx: cxp - 4, cy: cyp - 4, r: 4, fill: "#fff", opacity: 0.7 })); }
      if (selected) g.appendChild(svg("rect", { x: x + 1.5, y: y + 1.5, width: S - 3, height: S - 3, rx: 7, fill: "none", stroke: "#ffd23f", "stroke-width": 3.5 }));
      if (onClick) { g.style.cursor = "pointer"; g.addEventListener("click", (e) => { e.stopPropagation(); onClick(gm.x + dx, gm.y + dy); }); }
      root.appendChild(g);
    });
  }
  const shade = (hex) => { const n = parseInt(hex.slice(1), 16); const r = (n >> 16) * 0.5, g2 = ((n >> 8) & 255) * 0.5, b = (n & 255) * 0.5; return "#" + [r, g2, b].map((v) => Math.round(v).toString(16).padStart(2, "0")).join(""); };
  function gemIcon(meta, d, size) {
    const sz = size || 30; const cells = E.SHAPES[meta.shape]; const w = Math.max.apply(null, cells.map((c) => c[0])) + 1, h = Math.max.apply(null, cells.map((c) => c[1])) + 1;
    const root = svg("svg", { width: w * sz, height: h * sz });
    drawGem(root, { k: meta.k, m: meta.m, d: d || 0, cells, x: 0, y: 0 }, fa(), 1, false, null);
    root.setAttribute("viewBox", S + " " + S + " " + w * S + " " + h * S); return root;
  }

  // ---------- carnet et pose ----------
  function hypGems(s) { return G.hyp.map((h, i) => (h ? { k: s.inv[i].k, m: s.inv[i].m, d: h.d, cells: cellsOf(s.inv[i].shape, h.rot), x: h.x, y: h.y } : null)); }
  function fitsHyp(s, idx, h) {
    const cells = cellsOf(s.inv[idx].shape, h.rot); const occ = new Set();
    G.hyp.forEach((o, i) => { if (!o || i === idx) return; cellsOf(s.inv[i].shape, o.rot).forEach(([dx, dy]) => occ.add((o.x + dx) + "," + (o.y + dy))); });
    return cells.every(([dx, dy]) => { const x = h.x + dx, y = h.y + dy; return x >= 0 && y >= 0 && x < s.W && y < s.H && !occ.has(x + "," + y); });
  }
  function cellPose(s, x, y) {
    if (G.tool === "ask") { G.askCell = [x, y]; render(); return; }
    if (G.tool === "note") { const k = x + "," + y; if (G.notes.has(k)) G.notes.delete(k); else G.notes.add(k); render(); return; }
    if (G.sel === null) { // on clique sur une pierre posée ?
      for (let i = 0; i < G.hyp.length; i++) { const h = G.hyp[i]; if (!h) continue; if (cellsOf(s.inv[i].shape, h.rot).some(([dx, dy]) => h.x + dx === x && h.y + dy === y)) { G.sel = i; render(); return; } }
      return toast("Choisis d'abord une pierre dans la liste.");
    }
    const prev = G.hyp[G.sel] || { rot: 0, d: 0 }; const h = { x, y, rot: prev.rot, d: prev.d };
    if (!fitsHyp(s, G.sel, h)) { // essaie de décaler pour rentrer dans la mine
      const cells = cellsOf(s.inv[G.sel].shape, h.rot); const mw = Math.max.apply(null, cells.map((c) => c[0])), mh = Math.max.apply(null, cells.map((c) => c[1])); h.x = Math.min(x, s.W - 1 - mw); h.y = Math.min(y, s.H - 1 - mh);
      if (!fitsHyp(s, G.sel, h)) return toast("Cette pierre ne rentre pas ici.");
    }
    G.hyp[G.sel] = h; sfx(() => sound.tone(600, 0.06, "triangle", 0.08)); render();
  }
  function rotateSel(s) { if (G.sel === null) return; const h = G.hyp[G.sel] || { x: 0, y: 0, rot: 0, d: 0, unplaced: true }; const n = { x: h.x, y: h.y, rot: (h.rot + 1) % 4, d: h.d }; if (G.hyp[G.sel]) { if (!fitsHyp(s, G.sel, n)) { const cells = cellsOf(s.inv[G.sel].shape, n.rot); const mw = Math.max.apply(null, cells.map((c) => c[0])), mh = Math.max.apply(null, cells.map((c) => c[1])); n.x = Math.min(n.x, s.W - 1 - mw); n.y = Math.min(n.y, s.H - 1 - mh); if (!fitsHyp(s, G.sel, n)) return toast("Pas la place pour tourner."); } G.hyp[G.sel] = n; } else { G.prefRot = G.prefRot || {}; } render(); }
  function flipSel() { if (G.sel === null || !G.hyp[G.sel]) return; const h = G.hyp[G.sel]; G.hyp[G.sel] = { x: h.x, y: h.y, rot: h.rot, d: 1 - h.d }; render(); }
  function removeSel() { if (G.sel === null) return; G.hyp[G.sel] = null; render(); }
  function placement() { return G.hyp.map((h, i) => (h ? { idx: i, x: h.x, y: h.y, rot: h.rot, d: h.d } : null)).filter(Boolean); }
  function palette(s) {
    const box = el("div", { class: "om-pal" });
    s.inv.forEach((m, i) => {
      const placed = !!G.hyp[i];
      const b = el("button", { class: "om-pitem" + (G.sel === i ? " om-pitem--sel" : "") + (placed ? " om-pitem--placed" : ""), onclick: () => { G.sel = G.sel === i ? null : i; G.tool = "pose"; render(); } }, [el("span", { class: "om-picon" }), el("small", { text: gemLabel(m) })]);
      b.querySelector(".om-picon").appendChild(gemIcon(m, 0, 24));
      box.appendChild(b);
    });
    return box;
  }
  const diagKind = (k) => k === "mirror" || k === "splitter" || k === "gem";
  function poseTools(s) {
    const selMeta = G.sel !== null ? s.inv[G.sel] : null; const diag = selMeta && diagKind(selMeta.k);
    return el("div", { class: "om-tools" }, [
      el("button", { class: "btn btn--small btn--ghost", text: "Tourner", disabled: G.sel === null, onclick: () => rotateSel(s) }),
      diag ? el("button", { class: "btn btn--small btn--ghost", text: "Changer la diagonale", disabled: !G.hyp[G.sel], onclick: flipSel }) : null,
      el("button", { class: "btn btn--small btn--ghost", text: "Retirer", disabled: G.sel === null || !G.hyp[G.sel], onclick: removeSel }),
    ]);
  }
  function toolBar(s, allowed) {
    const defs = [["tir", "🔦 Tirer"], ["ask", "❓ Question"], ["pose", "💎 Poser"], ["note", "✕ Barrer"]].filter((t) => allowed.includes(t[0]));
    return el("div", { class: "om-modes", role: "tablist" }, defs.map((t) => el("button", { class: "om-mode" + (G.tool === t[0] ? " om-mode--on" : ""), role: "tab", "aria-selected": G.tool === t[0] ? "true" : "false", onclick: () => { G.tool = t[0]; render(); } }, [txt(t[1])])));
  }

  // ---------- préparation de la mine ----------
  function buildSetup(st, s) {
    const me = s.setup && s.setup.mine !== null && s.setup.mine !== undefined;
    const ready = s.setup.owners.find((o) => o.id === myId());
    if (!me) {
      st.appendChild(el("div", { class: "om-card om-wait" }, [el("div", { class: "om-bigemoji", text: "🎩" }), el("h2", { text: s.directorId ? nameOf(s.directorId) + " cache les pierres" : "Les mines se préparent" }), el("p", { class: "om-hint", text: "Patience, les rayons partiront dès que tout est prêt." }), el("div", { class: "om-readyrow" }, s.setup.owners.map((o) => el("span", { class: "om-ready " + (o.ready ? "om-ready--ok" : "") }, [dot(o.id), nameOf(o.id) + (o.ready ? " prêt" : " cache ses pierres")])))]));
      return;
    }
    if (ready && ready.ready && s.setup.myGems && !G.hyp.length) { G.hyp = []; s.setup.myGems.forEach((g, i) => { G.hyp[i] = { x: g.x, y: g.y, rot: g.rot, d: g.d }; }); }
    st.appendChild(el("div", { class: "om-card" }, [el("h2", { text: s.key === "classique" ? "Tu es le Directeur" : "Cache ta mine" }), el("p", { class: "om-hint", text: "Pose toutes les pierres dans la mine. Les explorateurs devront les retrouver avec des rayons. Pour une pierre, un miroir ou un séparateur, choisis aussi le sens de la diagonale." + (s.key === "croise" ? " Ton voisin explorera ta mine, et tu exploreras celle d'un autre." : "") })]));
    G.tool = G.tool === "note" ? "note" : "pose";
    st.appendChild(boardWrap(boardSvg(s, { hyp: G.hyp.map((h, i) => h), onCell: (x, y) => cellPose(s, x, y), notes: G.notes, gems: null })));
    st.appendChild(palette(s)); st.appendChild(toolBar(s, ["pose", "note"])); if (G.tool === "pose") st.appendChild(poseTools(s));
    const all = G.hyp.filter(Boolean).length === s.inv.length;
    st.appendChild(el("div", { class: "om-ctrl" }, [
      el("button", { class: "btn btn--ghost", text: "Au hasard", onclick: () => Kit.socket.emit("om:random") }),
      ready && ready.ready ? el("button", { class: "btn btn--ghost", text: "Modifier encore", onclick: () => Kit.socket.emit("om:unready") }) : el("button", { class: "btn btn--accent btn--big", text: all ? "Cacher les pierres" : "Place les " + s.inv.length + " pierres (" + G.hyp.filter(Boolean).length + " posées)", disabled: !all, onclick: () => Kit.socket.emit("om:place", { placement: placement() }) }),
    ]));
    st.appendChild(el("div", { class: "om-readyrow" }, s.setup.owners.map((o) => el("span", { class: "om-ready " + (o.ready ? "om-ready--ok" : "") }, [dot(o.id), nameOf(o.id) + (o.ready ? " prêt" : " prépare")]))));
  }
  function boardWrap(node) { return el("div", { class: "om-boardwrap" }, [node]); }

  // ---------- partie ----------
  function buildPlay(st, s) {
    const iAmDir = s.directorId === myId(); const mine = s.units.find((u) => u.id === s.myUnit); const explorer = !!mine;
    const shots = s.shots || []; const asks = s.asks || [];
    let banner = null;
    if (iAmDir) banner = "Tu es le Directeur, regarde-les chercher. Ta mine est affichée sous les rayons.";
    else if (!explorer) banner = "Tu regardes la partie.";
    else if (mine.solved) banner = "Mine résolue, bravo !";
    else if (mine.out) banner = "Tu es sorti de la manche.";
    else if (s.share === "turn") banner = mine.turn === myId() ? "C'est ton tour, tire, interroge une case ou accuse." : "Tour de " + nameOf(mine.turn) + ".";
    else banner = s.key === "course" ? "Course. Ton carnet est secret, le premier qui accuse juste gagne." : s.key === "croise" ? "Tu explores la mine de ton voisin. La tienne est cachée plus bas." : s.key === "equipes" ? "Ton équipe " + mine.members.map(nameOf).join(" et ") + " partage un carnet secret." : "Vous fouillez ensemble, le carnet est commun.";
    const mayAct = explorer && !mine.solved && !mine.out && (s.share !== "turn" || mine.turn === myId());
    const left = s.budget && mine ? Math.max(0, s.budget - mine.used) : null;
    const allowed = explorer ? ["tir", "ask", "pose", "note"] : [];
    if (explorer && !allowed.includes(G.tool)) G.tool = "tir";
    const bd = boardSvg(s, { gems: iAmDir ? s.dirMine : null, hyp: explorer ? G.hyp : null, shots: explorer || iAmDir ? shots : [], asks: explorer || iAmDir ? asks : [], notes: G.notes, onCell: explorer && G.tool !== "tir" ? (x, y) => cellPose(s, x, y) : null, onSlot: mayAct && G.tool === "tir" ? (sl) => { G.slot = sl; render(); } : null, selSlot: G.slot, selCell: G.tool === "ask" ? G.askCell : null });
    const mainCol = el("div", { class: "om-main" }, [el("div", { class: "om-banner" + (explorer && s.share === "turn" && mine.turn === myId() ? " om-banner--turn" : "") }, [el("b", { text: banner })])]);
    if (s.units.length > 1 && s.key !== "classique") mainCol.appendChild(el("div", { class: "om-units" }, s.units.map((u) => el("span", { class: "om-unit" + (u.id === s.myUnit ? " om-unit--me" : "") + (u.out ? " om-unit--out" : "") }, u.members.map((id) => dot(id)).concat([u.members.map(nameOf).join(" et ") + "  ·  " + u.used + " tir" + (u.used > 1 ? "s" : "") + (u.solved ? "  ·  résolu" : u.out ? "  ·  éliminé" : "")])))));
    mainCol.appendChild(boardWrap(bd));
    if (explorer) {
      mainCol.appendChild(toolBar(s, allowed));
      const act = el("div", { class: "om-act" });
      if (G.tool === "tir") {
        if (s.lasers.length > 1) {
          if (!s.lasers.includes(G.mask)) G.mask = s.lasers[s.lasers.length - 1];
          act.appendChild(el("div", { class: "om-lasers" }, s.lasers.map((m) => el("button", { class: "om-laser" + (G.mask === m ? " om-laser--on" : ""), style: { "border-color": G.mask === m ? HEX[m] : "transparent" }, title: CNAME[m], onclick: () => { G.mask = m; render(); } }, [el("i", { style: { background: HEX[m], boxShadow: "0 0 12px " + HEX[m] } }), el("small", { text: CNAME[m] })]))));
        } else G.mask = s.lasers[0];
        const canShoot = mayAct && G.slot && (left === null || left > 0);
        act.appendChild(el("button", { class: "btn btn--accent btn--big", disabled: !canShoot, text: left === 0 ? "Plus de tirs" : G.slot ? "Tirer depuis " + slotLong(G.slot) : "Touche une entrée autour de la mine", onclick: () => { Kit.socket.emit("om:shoot", { s: G.slot.s, i: G.slot.i, mask: G.mask }); G.slot = null; } }));
        act.appendChild(el("p", { class: "om-hint", text: s.faithful ? "La sonde est transparente et prend la couleur des pierres qu'elle touche. Les ronds ont des lettres ou des chiffres, ce sont les entrées." : "Choisis un laser puis une entrée. Un rond coloré et numéroté est un tir, un carré coloré est l'endroit où il ressort." }));
      } else if (G.tool === "ask") {
        const c = G.askCell; const canAsk = mayAct && c && (left === null || left > 0);
        act.appendChild(el("button", { class: "btn btn--accent btn--big", disabled: !canAsk, text: c ? "Que cache la case " + cellName(c[0], c[1]) + " ? Coûte un tir" : "Touche une case de la mine", onclick: () => { Kit.socket.emit("om:ask", { x: c[0], y: c[1] }); G.askCell = null; } }));
        act.appendChild(el("p", { class: "om-hint", text: "Tu apprends la couleur de la pierre qui occupe la case, ou qu'elle est vide, mais ni sa forme ni son sens. Ça compte comme un tir." }));
      } else if (G.tool === "pose") {
        act.appendChild(palette(s)); act.appendChild(poseTools(s));
        act.appendChild(el("p", { class: "om-hint", text: "Choisis une pierre puis touche une case pour la poser dans ton carnet. Les tirs incompatibles se marquent d'une croix dans le journal." }));
      } else act.appendChild(el("p", { class: "om-hint", text: "Touche une case pour la barrer quand tu es sûr qu'elle est vide." }));
      mainCol.appendChild(act);
      const all = G.hyp.filter(Boolean).length === s.inv.length;
      const lives = mine.perMember ? s.lives - (mine.strikes[myId()] || 0) : s.lives - (mine.strikes.u || 0);
      mainCol.appendChild(el("div", { class: "om-ctrl" }, [el("button", { class: "btn btn--green btn--big", disabled: !mayAct || !all, text: !all ? "Pour accuser, pose les " + s.inv.length + " pierres dans le carnet (" + G.hyp.filter(Boolean).length + ")" : "J'accuse, c'est ça la mine (" + lives + " essai" + (lives > 1 ? "s" : "") + ")", onclick: () => Kit.confirm("Accuser avec ce carnet ? Une erreur coûte un essai.", () => Kit.socket.emit("om:accuse", { placement: placement() })) })]));
      if (G.hint !== null && G.hint !== undefined) mainCol.appendChild(el("p", { class: "om-hint", text: "Dernier indice, " + G.hint + " pierre" + (G.hint > 1 ? "s" : "") + " bien placée" + (G.hint > 1 ? "s" : "") + " sur " + s.inv.length + "." }));
      if (s.units.some((u) => u.stallAt && u.id === s.myUnit)) mainCol.appendChild(el("p", { class: "om-hint", text: "Plus de tirs. Tu as une minute pour accuser." }));
    }
    // colonne de droite, journal et légende
    const side = el("div", { class: "om-side" });
    const tabs = [["journal", "Journal"], ["pierres", "Les pierres"]];
    side.appendChild(el("div", { class: "om-modes om-modes--tabs", role: "tablist" }, tabs.map((t) => el("button", { class: "om-mode" + (G.tab === t[0] ? " om-mode--on" : ""), role: "tab", onclick: () => { G.tab = t[0]; render(); } }, [txt(t[1])]))));
    if (G.tab === "pierres") side.appendChild(legendCard(s)); else side.appendChild(shotLog(s, shots, asks, explorer));
    if (s.key === "croise" && s.dirMine) side.appendChild(el("div", { class: "om-card" }, [el("h3", { text: "Ta propre mine" }), boardWrap(boardSvg(s, { gems: s.dirMine, shots: [] }))]));
    if (Kit.isHost()) side.appendChild(el("div", { class: "om-ctrl" }, [el("button", { class: "btn btn--small btn--ghost", text: "Terminer la manche", onclick: () => Kit.confirm("Terminer la manche maintenant ? Personne ne marquera.", () => Kit.socket.emit("om:skip")) })]));
    st.appendChild(el("div", { class: "om-play" }, [mainCol, side]));
  }
  function legendCard(s) {
    const rows = s.inv.map((m) => el("div", { class: "om-leg" }, [el("span", { class: "om-picon" }, [gemIcon(m, 0, 26)]), el("div", {}, [el("b", { text: gemLabel(m) }), el("span", { class: "small muted", text: m.k === "gem" ? (m.m === 0 ? " Renvoie la sonde sans la colorer." : " Renvoie la sonde et la colore en " + E.nameOf(m.m, true) + ".") : m.k === "obsidian" && s.faithful ? " Absorbe la sonde, rien ne ressort." : " " + E.KINDS[m.k].desc })])]));
    const card = el("div", { class: "om-card" }, [el("h3", { text: "À trouver dans la mine (" + s.inv.length + ")" }), el("div", { class: "om-legs" }, rows)]);
    if (s.faithful) card.appendChild(el("p", { class: "small muted", text: "Mélanges. Rouge et bleu font violet, rouge et jaune orange, bleu et jaune vert. Le blanc éclaircit, rose, bleu clair, jaune clair. Les quatre couleurs ensemble donnent gris. Toucher deux fois la même couleur ne change rien." }));
    return card;
  }
  const slotName = (sl) => slotLong(sl);
  function shotLog(s, shots, asks, explorer) {
    const hyp = hypGems(s); const placedAll = hyp.every(Boolean) && hyp.length === s.inv.length; const grid = placedAll ? E.buildGrid(s.W, s.H, hyp) : null;
    const items = [];
    shots.forEach((sh) => {
      let mark = ""; if (placedAll) { const res = E.trace(s.W, s.H, grid, hyp, sh.slot, sh.mask, false); mark = E.shotSig(res) === E.shotSig(sh) ? "✔" : "✕"; }
      const exits = sh.exits.length ? sh.exits.map((e) => slotLong(e) + " en " + CNAME[e.m]).join(" et ") : "nulle part";
      const hex = HEX[sh.mask || 0];
      items.push({ n: sh.n, node: el("div", { class: "om-shot" }, [el("i", { class: "om-shot__dot", style: { background: hex, color: inkOn(hex) } }, [txt(String(sh.n))]), el("div", {}, [el("b", { text: (sh.free ? "Tir offert. " : "") + "Entrée " + slotLong(sh.slot) }), el("span", { class: "small", text: (s.lasers.length > 1 ? CNAME[sh.mask] + ". " : "") + "Sortie " + exits + (sh.absorbed ? (sh.exits.length ? ", une partie absorbée" : ", signal absorbé") : "") + "." })]), mark ? el("span", { class: "om-shot__mark " + (mark === "✔" ? "ok" : "ko"), text: mark }) : null]) });
    });
    asks.forEach((a, i) => {
      let mark = ""; if (placedAll) { const gi = grid[a.y * s.W + a.x]; const g2 = gi >= 0 ? hyp[gi] : null; const ok = a.k === "vide" ? !g2 : g2 && g2.k === a.k && (a.m || 0) === (g2.m || 0); mark = ok ? "✔" : "✕"; }
      const what = a.k === "vide" ? "vide" : a.k === "obsidian" ? (s.faithful ? "le corps noir" : "obsidienne") : a.k === "gem" ? (a.m === 0 ? "un diamant" : "une pierre " + ({ 1: "rouge", 2: "bleue", 4: "jaune", 8: "blanche" }[a.m] || "colorée")) : E.KINDS[a.k].label + (a.m ? " " + E.nameOf(a.m, false) : "");
      items.push({ n: 1000 + i, node: el("div", { class: "om-shot" }, [el("i", { class: "om-shot__dot om-shot__dot--ask", text: "?" }), el("div", {}, [el("b", { text: "Question, case " + cellName(a.x, a.y) }), el("span", { class: "small", text: "Réponse, " + what + "." })]), mark ? el("span", { class: "om-shot__mark " + (mark === "✔" ? "ok" : "ko"), text: mark }) : null]) });
    });
    items.sort((x, y) => y.n - x.n);
    return el("div", { class: "om-card" }, [el("h3", { text: "Journal (" + items.length + ")" }), items.length ? el("div", { class: "om-shots" }, items.map((i) => i.node)) : el("p", { class: "small muted", text: "Aucun tir pour l'instant." })]);
  }

  // ---------- révélation ----------
  function buildReveal(st, s) {
    const rv = s.reveal; if (!rv) return;
    const win = rv.win !== null && rv.win !== undefined ? rv.units.find((u) => u.id === rv.win) : null;
    st.appendChild(el("div", { class: "om-card om-reveal" }, [el("h2", { text: win ? "Mine résolue" : "Mine intacte" }), el("p", { class: "om-hint", text: win ? win.members.map(nameOf).join(" et ") + " ont tout trouvé en " + win.shots + " tir" + (win.shots > 1 ? "s" : "") + "." : "Personne n'a trouvé toutes les pierres." })]));
    if (rv.units.length > 1) st.appendChild(el("div", { class: "om-units" }, rv.units.map((u) => el("button", { class: "om-unit om-unit--btn" + (u.id === G.unitView ? " om-unit--me" : ""), onclick: () => { G.unitView = u.id; render(); } }, u.members.map((id) => dot(id)).concat([u.members.map(nameOf).join(" et ") + "  ·  " + u.shots + " tirs" + (u.solved ? "  ·  résolu" : "")])))));
    const u = rv.units.find((x) => x.id === G.unitView) || rv.units[0]; const mine = rv.mines[u.mine] || rv.mines[0];
    const shots = u.shotsList.map((sh) => { const res = E.trace(s.W, s.H, E.buildGrid(s.W, s.H, mine.gems), mine.gems, sh.slot, sh.mask, true); return { n: sh.n, slot: sh.slot, mask: sh.mask, exits: res.exits, absorbed: res.absorbed, rays: res.rays }; });
    st.appendChild(boardWrap(boardSvg(s, { gems: mine.gems, shots, asks: u.asks || [], onCell: null, reveal: true })));
    st.appendChild(el("p", { class: "om-hint", text: "Voici la vraie mine" + (mine.owner ? " cachée par " + nameOf(mine.owner) : "") + " et le trajet complet de chaque rayon." }));
    const gains = Object.keys(rv.gains).filter((id) => rv.gains[id] > 0);
    st.appendChild(el("div", { class: "om-card" }, [el("h3", { text: "Points de la manche" }), gains.length ? el("div", { class: "om-gains" }, gains.map((id) => el("span", { class: "om-gain" }, [dot(id), nameOf(id) + " +" + rv.gains[id]]))) : el("p", { class: "small muted", text: "Personne ne marque." })]));
    st.appendChild(el("div", { class: "om-ctrl" }, [Kit.isHost() ? el("button", { class: "btn btn--accent btn--big", text: "Manche suivante", onclick: () => Kit.socket.emit("om:skip") }) : el("p", { class: "om-hint", text: "La manche suivante démarre toute seule." })]));
  }

  // ---------- fin ----------
  function buildOver(st) {
    const o = G.over; if (!o) { st.appendChild(el("div", { class: "om-card om-wait" }, [el("h2", { text: "Résultats en cours" })])); return; }
    const nm = (id) => { const p = o.players.find((x) => x.id === id); return p ? p.name : "?"; };
    const hx = (id) => { const p = o.players.find((x) => x.id === id); return COLORS[((p && p.color) || 0) % COLORS.length].hex; };
    const top = o.rows.slice(0, 3); const order = top.length === 1 ? [top[0]] : top.length === 2 ? [top[1], top[0]] : [top[1], top[0], top[2]];
    st.appendChild(el("div", { class: "om-card" }, [el("h2", { text: o.aborted ? "L'expédition s'arrête ici" : "Le podium des mineurs" }), el("div", { class: "podium om-podium" }, order.map((r) => el("div", { class: "pod pod--" + r.rank }, [el("div", { class: "pod__ball", style: { background: hx(r.id) } }), el("div", { class: "pod__nm", text: r.name }), el("div", { class: "pod__bar", text: String(r.pts) })])))]));
    st.appendChild(el("div", { class: "om-card" }, [el("h2", { text: "Le classement final" }), el("table", { class: "tbl" }, [el("thead", {}, [el("tr", {}, [el("th", { text: "" }), el("th", { text: "Joueur" }), el("th", { class: "r", text: "Points" }), el("th", { class: "r", text: "Mines" }), el("th", { class: "r", text: "Tirs" })])]), el("tbody", {}, o.rows.map((r) => el("tr", {}, [el("td", { text: String(r.rank) }), el("td", {}, [el("span", { class: "dotc", style: { background: hx(r.id) } }), r.name + (r.left ? " (parti)" : "")]), el("td", { class: "r", text: String(r.pts) }), el("td", { class: "r", text: String(r.solved) }), el("td", { class: "r", text: String(r.shots) })])))])]));
    if (o.awards.length) st.appendChild(el("div", { class: "om-card" }, [el("h2", { text: "Les titres" }), el("div", { class: "om-awards" }, o.awards.map((a) => el("div", { class: "om-award", style: { borderLeftColor: hx(a.id) } }, [el("span", { class: "om-award__ic", text: a.icon }), el("div", {}, [el("b", { text: a.title }), el("div", { class: "om-award__nm" }, [el("span", { class: "dotc", style: { background: hx(a.id) } }), nm(a.id)]), el("span", { class: "small muted", text: a.detail })])])))]));
    st.appendChild(el("div", { class: "om-ctrl" }, [el("button", { class: "btn btn--ghost", text: "Quitter", onclick: () => Kit.confirm("Quitter la partie et revenir à l'accueil ?", () => Kit.leave()) }), Kit.isHost() ? el("button", { class: "btn btn--accent btn--big", text: "Retour au salon", onclick: () => Kit.backToLobby() }) : el("span", { class: "muted small", text: "L'hôte peut relancer une partie depuis le salon." })]));
  }

  // ---------- horloge ----------
  setInterval(() => {
    const s = G.st; if (!s || !Kit.room) return; const fill = $("#om-timer-fill"), txt2 = $("#om-timer-txt"), tm = $("#om-timer"); if (!fill || !tm || tm.classList.contains("hidden")) return;
    let until = s.phaseUntil, total = 1;
    if (s.phase === "setup") total = s.setup ? s.setup.total : 1; else if (s.phase === "reveal") total = 22000; else if (s.phase === "play") total = (s.roundTime || 1) * 1000;
    const left = Math.max(0, until - snow()); const pct = Math.max(0, Math.min(100, (left / total) * 100));
    fill.style.width = pct + "%"; txt2.textContent = secs(left) + " s"; tm.classList.toggle("om-timer--hot", pct < 20 && s.phase !== "reveal");
  }, 300);

  // ---------- branchement ----------
  Kit.on("reset", () => { G.st = null; G.over = null; G.round = -1; G.lastKey = ""; });
  Kit.on("room", (r) => { if (r.status === "lobby") { G.st = null; G.over = null; G.round = -1; G.lastKey = ""; } else if (G.st) renderTop(); });
  function attach() { const so = Kit.socket; if (!so || G.attached) return; G.attached = true; so.on("om:state", onState); so.on("om:over", onOver); so.on("om:accuseResult", onAccuseResult); so.on("om:random", onRandom); }

  Kit.init({
    id: "orapa-mine", title: "Mine de Rien", emoji: "💎", ribbon: "Le jeu de déduction à lasers", tagline: "Tire des rayons dans la mine et retrouve les pierres cachées.",
    createLabel: "Créer une expédition", soloLabel: "Jouer contre un robot", startLabel: "Descendre dans la mine", helpTitle: "Comment jouer",
    floaters: [{ e: "💎", x: 6 }, { e: "⛏️", x: 20 }, { e: "🔦", x: 36 }, { e: "🔴", x: 50 }, { e: "🔵", x: 64 }, { e: "🟡", x: 78 }, { e: "🪨", x: 92 }],
    colors: COLORS, botLevels: [{ id: "novice", label: "Novice" }, { id: "fute", label: "Futé" }, { id: "genie", label: "Génie" }], maxPlayers: 6, minPlayers: 2, schema: R.SCHEMA,
    help: [
      { title: "Le principe", text: "Des pierres précieuses sont cachées dans une mine en forme de grille. Tu ne les vois pas. Tu envoies une sonde depuis un bord et tu regardes par où elle ressort et de quelle couleur. À toi de déduire où sont les pierres et dans quel sens elles sont tournées." },
      { title: "Les pierres", text: "Dans les modes originaux, chaque pierre renvoie la sonde en diagonale et lui donne sa couleur. Il y a des pierres rouge, bleue, jaune et blanche, un diamant qui renvoie sans colorer et un corps noir qui avale tout. En mode fantaisie s'ajoutent des filtres, des prismes, des séparateurs et des opales." },
      { title: "Les couleurs", text: "La sonde est transparente au départ. Elle prend la couleur de chaque pierre touchée, une seule fois par couleur. Rouge et bleu font violet, rouge et jaune orange, bleu et jaune vert. Le blanc éclaircit la couleur et les quatre ensemble donnent du gris." },
      { title: "Tirer ou demander", text: "Touche un rond autour de la mine pour choisir l'entrée, puis tire. Selon le réglage tu vois tout le trajet, le début seulement, ou juste l'entrée et la sortie. Tu peux aussi demander ce que cache une case, tu apprends la couleur de la pierre mais pas son sens, et ça compte comme un tir." },
      { title: "Le carnet", text: "Pose les pierres de la liste dans ton carnet, tourne-les, change le sens des diagonales. Une fois toutes posées, le journal te dit quels tirs et quelles réponses sont compatibles avec ton carnet. C'est la meilleure façon de trouver ce qui ne va pas." },
      { title: "Accuser", text: "Quand ton carnet te semble juste, accuse. Si les pierres sont bien placées avec le bon sens, tu gagnes la manche. Sinon tu perds un essai, et quand il n'y en a plus tu sors de la manche." },
      { title: "Les modes", text: "En classique un Directeur cache la mine et chacun tire à son tour. En course on se dispute la même mine en secret. En mines croisées chacun cache la sienne. En coopération et en équipes on partage un carnet. L'énigme donne quelques tirs gratuits, la campagne enchaîne douze mines." },
    ],
    theme: { a1: "#7fd6ff", a2: "#b06bff", bg1: "#1a2a6b", bg2: "#070a1c" },
    onInit() { build(); attach(); Kit.on("connect", attach); },
  });
})();

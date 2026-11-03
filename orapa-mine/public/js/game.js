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
  const G = { st: null, over: null, offset: 0, samples: [], round: -1, hyp: [], notes: new Set(), sel: null, slot: null, mask: 7, tool: "pose", unitView: 0, shotsSeen: 0, attached: false, lastKey: "", spyOpen: false, hint: null, replay: null };
  const myId = () => { const p = Kit.me(); return p ? p.id : null; };
  const pl = (id) => (Kit.room ? Kit.room.players.find((p) => p.id === id) : null);
  const nameOf = (id) => { const p = pl(id); return p ? p.name : "?"; };
  const hexOf = (id) => { const p = pl(id); return COLORS[((p && p.color) || 0) % COLORS.length].hex; };
  const snow = () => Date.now() + G.offset;
  const sample = (n) => { G.samples.push(n - Date.now()); if (G.samples.length > 10) G.samples.shift(); G.offset = Math.max.apply(null, G.samples); };
  const sfx = (f) => { if (!G.st || G.st.sfx !== false) f(); };
  const dot = (id) => el("i", { class: "dotc", style: { background: hexOf(id) }, title: nameOf(id) });
  const svg = (tag, attrs, kids) => { const n = document.createElementNS(NS, tag); Object.keys(attrs || {}).forEach((k) => n.setAttribute(k, attrs[k])); (kids || []).forEach((c) => c && n.appendChild(c)); return n; };
  const HEX = E.COLOR_HEX, CNAME = E.COLOR_NAMES;
  const secs = (ms) => Math.max(0, Math.ceil(ms / 1000));
  const cellsOf = (shape, rot) => E.rot(E.SHAPES[shape], rot || 0);

  // ---------- squelette ----------
  function build() {
    const sc = $("#screen-game"); sc.innerHTML = "";
    sc.appendChild(el("div", { class: "om-bg" }));
    sc.appendChild(el("div", { class: "om-top", id: "om-top" }));
    sc.appendChild(el("div", { class: "om-timer hidden", id: "om-timer" }, [el("i", { id: "om-timer-fill" }), el("span", { id: "om-timer-txt" })]));
    const cave = el("div", { class: "om-cave hidden", id: "om-cave" }); sc.appendChild(cave);
    sc.appendChild(el("main", { class: "om-stage", id: "om-stage" }));
    sc.appendChild(el("button", { class: "round-btn om-menu", title: "Menu", text: "⚙️", onclick: openMenu }));
    try { OMCave.init(cave); } catch (e) { cave.classList.add("hidden"); G.noCave = true; }
  }
  function openMenu() {
    const sbtn = el("button", { class: "btn btn--small btn--ghost", text: sound.enabled ? "Son activé" : "Son coupé", onclick: (ev) => { ev.target.textContent = sound.toggle() ? "Son activé" : "Son coupé"; } });
    const rows = [el("div", { class: "menu-row" }, [el("div", {}, [el("b", { text: "Sons" }), el("p", { class: "small muted", text: "Lasers, cristaux et éboulements." })]), sbtn]),
      el("h3", { text: "Les pierres", style: { marginTop: "0.8rem" } })];
    Object.keys(E.KINDS).forEach((k) => rows.push(el("p", { class: "small" }, [el("b", { text: E.KINDS[k].label + " " }), E.KINDS[k].desc])));
    rows.push(el("p", { class: "small", text: "Les couleurs sont des mélanges de rouge, bleu et jaune. Le blanc contient les trois." }));
    rows.push(el("button", { class: "btn btn--danger btn--small", style: { marginTop: "0.8rem" }, text: "Quitter la partie", onclick: () => Kit.confirm("Quitter la partie et revenir à l'accueil ?", () => { $("#modal").classList.add("hidden"); Kit.leave(); }) }));
    Kit.showModal("Menu", rows);
  }

  // ---------- réception ----------
  function onState(s) {
    sample(s.now);
    const prev = G.st; G.st = s;
    if (s.round !== G.round) { G.round = s.round; G.hyp = []; G.notes = new Set(); G.sel = null; G.slot = null; G.shotsSeen = 0; G.hint = null; G.replay = null; G.unitView = s.myUnit !== null && s.myUnit !== undefined ? s.myUnit : 0; if (s.W && window.OMCave && OMCave.ready) OMCave.setBoard(s.W, s.H); }
    // nouvelle phase
    const key = s.phase + "|" + s.round;
    if (key !== G.lastKey) { G.lastKey = key; phaseEnter(s, prev); }
    // nouveaux tirs, on les anime dans la grotte
    if (s.phase === "play" && s.shots) {
      if (s.shots.length > G.shotsSeen) { for (let i = G.shotsSeen; i < s.shots.length; i++) animateShot(s, s.shots[i]); G.shotsSeen = s.shots.length; }
    }
    render();
  }
  function phaseEnter(s, prev) {
    const cave = $("#om-cave");
    if (s.phase === "setup" || s.phase === "play" || s.phase === "reveal") { if (!G.noCave) cave.classList.remove("hidden"); if (window.OMCave && OMCave.ready) { OMCave.resize(); } }
    if (s.phase === "play") { if (window.OMCave && OMCave.ready) { OMCave.clearRays(); OMCave.setGems(s.dirMine || null); } sfx(() => { sound.tone(330, 0.12, "triangle", 0.09); sound.tone(494, 0.14, "triangle", 0.09, 0.1); sound.tone(660, 0.2, "triangle", 0.1, 0.2); }); }
    if (s.phase === "reveal") { G.replayIdx = 0; revealStart(s); sfx(() => { [392, 523, 659, 784].forEach((f, i) => sound.tone(f, 0.25, "triangle", 0.1, i * 0.1)); }); }
  }
  function onOver(m) { G.over = m; G.lastKey = ""; render(); sfx(() => sound.win()); const c = $("#om-cave"); if (c) c.classList.add("hidden"); }
  function onAccuseResult(m) {
    if (m.ok) { sfx(() => { [523, 659, 784, 1047].forEach((f, i) => sound.tone(f, 0.2, "triangle", 0.12, i * 0.1)); }); return; }
    G.hint = m.hint; sfx(() => sound.fail());
    toast(m.out ? "Mauvaise accusation, tu sors de la manche." : "Mauvaise accusation." + (m.hint !== null && m.hint !== undefined ? " Pierres bien placées " + m.hint + " sur " + G.st.inv.length + "." : ""));
  }
  function onRandom(m) { G.hyp = []; (m.placement || []).forEach((p) => { G.hyp[p.idx] = { x: p.x, y: p.y, rot: p.rot, d: p.d }; }); render(); }

  // ---------- grotte ----------
  function animateShot(s, sh) {
    if (!window.OMCave || !OMCave.ready) return;
    const W = s.W, H = s.H; const entry = slotEdgePt(sh.slot, W, H); const first = slotStep(sh.slot);
    sfx(() => { sound.tone(900, 0.08, "sawtooth", 0.05); sound.tone(1300, 0.12, "sawtooth", 0.05, 0.05); });
    if (sh.rays && sh.rays.length) {
      sh.rays.forEach((r) => OMCave.fire(r.pts, r.m || sh.mask, { fade: 6 }));
    } else {
      // trace mystère, on voit entrer le rayon dans la mine puis ressortir
      OMCave.fire([entry, [entry[0] + first[0] * 1.2, entry[1] + first[1] * 1.2]], sh.mask, { fade: 5 });
      sh.exits.forEach((e) => { const p = slotEdgePt(e, W, H); const st = slotStep(e); OMCave.fire([[p[0] + st[0] * 1.2, p[1] + st[1] * 1.2], p], e.m, { fade: 5, delay: 0.7 }); });
    }
  }
  function slotEdgePt(sl, W, H) { return sl.s === "N" ? [sl.i, -1] : sl.s === "S" ? [sl.i, H] : sl.s === "W" ? [-1, sl.i] : [W, sl.i]; }
  function slotStep(sl) { return sl.s === "N" ? [0, 1] : sl.s === "S" ? [0, -1] : sl.s === "W" ? [1, 0] : [-1, 0]; }
  function revealStart(s) {
    if (!window.OMCave || !OMCave.ready || !s.reveal) return; OMCave.clearRays(); const rv = s.reveal;
    const mi = rv.units[G.unitView] ? rv.units[G.unitView].mine : 0; const mine = rv.mines[mi] || rv.mines[0]; OMCave.setGems(mine.gems);
    replayUnit(s, G.unitView);
  }
  function replayUnit(s, ui) {
    const rv = s.reveal; const u = rv.units[ui]; if (!u) return; const mine = rv.mines[u.mine] || rv.mines[0];
    const gems = mine.gems.map((g) => Object.assign({}, g)); const grid = E.buildGrid(s.W, s.H, gems); OMCave.clearRays(); OMCave.setGems(gems);
    u.shotsList.forEach((sh, i) => { const res = E.trace(s.W, s.H, grid, gems, sh.slot, sh.mask, true); res.rays.forEach((r) => OMCave.fire(r.pts, r.m || sh.mask, { delay: i * 0.8, fade: 4 + u.shotsList.length })); });
  }

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
  // opts : { gems (vrais), hyp (hypothèses), shots, onCell, onSlot, selSlot, notes, ghost }
  function boardSvg(s, opts) {
    const W = s.W, H = s.H, S = 40; const vw = (W + 2) * S, vh = (H + 2) * S;
    const root = svg("svg", { viewBox: "0 0 " + vw + " " + vh, class: "om-board" });
    root.appendChild(svg("rect", { x: S * 0.55, y: S * 0.55, width: (W + 0.9) * S, height: (H + 0.9) * S, rx: 10, fill: "#10163a", stroke: "#3a4a9a", "stroke-width": 3 }));
    for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
      const c = svg("rect", { x: (x + 1) * S + 1, y: (y + 1) * S + 1, width: S - 2, height: S - 2, rx: 4, fill: (x + y) % 2 ? "#1d2650" : "#18204a", class: "om-cell" });
      if (opts.onCell) { c.style.cursor = "pointer"; c.addEventListener("click", () => opts.onCell(x, y)); }
      root.appendChild(c);
    }
    if (opts.notes) opts.notes.forEach((k) => { const [x, y] = k.split(",").map(Number); root.appendChild(svg("text", { x: (x + 1.5) * S, y: (y + 1.5) * S + 6, "text-anchor": "middle", "font-size": 20, fill: "#7f8ac8", "pointer-events": "none" }, [txt("✕")])); });
    if (opts.gems) opts.gems.forEach((gm) => drawGem(root, gm, S, 1, false, opts.onCell));
    if (opts.hyp) opts.hyp.forEach((h, i) => { if (!h) return; const meta = s.inv[i]; const gm = { k: meta.k, m: meta.m, d: h.d, cells: cellsOf(meta.shape, h.rot), x: h.x, y: h.y, idx: i }; drawGem(root, gm, S, 0.85, G.sel === i, (x, y) => { G.sel = i; render(); }, true); });
    // rayons visibles
    if (opts.shots) opts.shots.forEach((sh) => {
      if (sh.rays) sh.rays.forEach((r) => { const pts = r.pts.map((p) => ((p[0] + 1.5) * S) + "," + ((p[1] + 1.5) * S)).join(" "); root.appendChild(svg("polyline", { points: pts, fill: "none", stroke: HEX[r.m || sh.mask] || "#fff", "stroke-width": 4, "stroke-linecap": "round", "stroke-linejoin": "round", opacity: 0.85, "pointer-events": "none" })); });
    });
    // entrées
    E.slotsOf(W, H).forEach((sl) => {
      const p = slotXY(sl, W, H, S); const shotsHere = (opts.shots || []).filter((sh) => E.slotKey(sh.slot) === E.slotKey(sl));
      const exitsHere = []; (opts.shots || []).forEach((sh) => sh.exits.forEach((e) => { if (E.slotKey(e) === E.slotKey(sl)) exitsHere.push({ n: sh.n, m: e.m }); }));
      const sel = opts.selSlot && E.slotKey(opts.selSlot) === E.slotKey(sl);
      const g = svg("g", { class: "om-slot" + (sel ? " om-slot--sel" : "") + (opts.onSlot ? " om-slot--btn" : "") });
      g.appendChild(svg("circle", { cx: p[0], cy: p[1], r: S * 0.36, fill: sel ? "#ffd23f" : "#1a2358", stroke: sel ? "#fff" : "#4a5cc0", "stroke-width": 2 }));
      let label = null;
      if (shotsHere.length) { const sh = shotsHere[shotsHere.length - 1]; g.appendChild(svg("circle", { cx: p[0], cy: p[1], r: S * 0.3, fill: HEX[sh.mask] })); label = String(sh.n) + (sh.absorbed && !sh.exits.length ? "✕" : ""); g.appendChild(svg("text", { x: p[0], y: p[1] + 5, "text-anchor": "middle", "font-size": 14, "font-weight": 700, fill: sh.mask === 4 || sh.mask === 7 ? "#222" : "#fff", "pointer-events": "none" }, [txt(label)])); }
      else if (exitsHere.length) { const e = exitsHere[exitsHere.length - 1]; g.appendChild(svg("rect", { x: p[0] - S * 0.26, y: p[1] - S * 0.26, width: S * 0.52, height: S * 0.52, rx: 6, fill: HEX[e.m] || "#fff" })); g.appendChild(svg("text", { x: p[0], y: p[1] + 5, "text-anchor": "middle", "font-size": 14, "font-weight": 700, fill: e.m === 4 || e.m === 7 || e.m === 6 ? "#222" : "#fff", "pointer-events": "none" }, [txt(String(e.n))])); }
      if (opts.onSlot) { g.style.cursor = "pointer"; g.addEventListener("click", () => opts.onSlot(sl)); }
      root.appendChild(g);
    });
    return root;
  }
  const txt = (t) => document.createTextNode(t);
  function slotXY(sl, W, H, S) { return sl.s === "N" ? [(sl.i + 1.5) * S, 0.5 * S] : sl.s === "S" ? [(sl.i + 1.5) * S, (H + 1.5) * S] : sl.s === "W" ? [0.5 * S, (sl.i + 1.5) * S] : [(W + 1.5) * S, (sl.i + 1.5) * S]; }
  function drawGem(root, gm, S, scale, selected, onClick, ghost) {
    gm.cells.forEach(([dx, dy]) => {
      const x = (gm.x + dx + 1) * S, y = (gm.y + dy + 1) * S; const pad = S * (1 - scale) / 2 + 2; const w = S - pad * 2; const g = svg("g", { class: "om-gem" + (ghost ? " om-gem--ghost" : "") });
      const cxp = x + S / 2, cyp = y + S / 2;
      if (gm.k === "filter") g.appendChild(svg("rect", { x: x + pad, y: y + pad, width: w, height: w, rx: 6, fill: HEX[gm.m], opacity: ghost ? 0.6 : 0.75, stroke: "#fff", "stroke-width": 2 }));
      else if (gm.k === "mirror") { g.appendChild(svg("rect", { x: x + pad, y: y + pad, width: w, height: w, rx: 6, fill: "#46506f", stroke: "#cfd8ff", "stroke-width": 2 })); g.appendChild(svg("line", gm.d ? { x1: x + pad + 3, y1: y + pad + 3, x2: x + pad + w - 3, y2: y + pad + w - 3, stroke: "#e8f0ff", "stroke-width": 5, "stroke-linecap": "round" } : { x1: x + pad + 3, y1: y + pad + w - 3, x2: x + pad + w - 3, y2: y + pad + 3, stroke: "#e8f0ff", "stroke-width": 5, "stroke-linecap": "round" })); }
      else if (gm.k === "obsidian") { g.appendChild(svg("rect", { x: x + pad, y: y + pad, width: w, height: w, rx: 9, fill: "#0b0b14", stroke: "#6a58b0", "stroke-width": 2 })); g.appendChild(svg("circle", { cx: cxp - w * 0.15, cy: cyp - w * 0.15, r: 3, fill: "#9a8cff" })); }
      else if (gm.k === "prism") { g.appendChild(svg("polygon", { points: cxp + "," + (y + pad) + " " + (x + pad + w) + "," + (y + pad + w) + " " + (x + pad) + "," + (y + pad + w), fill: "#e8f6ff", opacity: 0.85, stroke: "#9fd8ff", "stroke-width": 2 })); g.appendChild(svg("line", { x1: cxp, y1: cyp, x2: cxp - 7, y2: cyp - 6, stroke: "#ff3b4e", "stroke-width": 3 })); g.appendChild(svg("line", { x1: cxp, y1: cyp, x2: cxp + 7, y2: cyp - 6, stroke: "#3b7bff", "stroke-width": 3 })); }
      else if (gm.k === "splitter") { g.appendChild(svg("polygon", { points: cxp + "," + (y + pad) + " " + (x + pad + w) + "," + cyp + " " + cxp + "," + (y + pad + w) + " " + (x + pad) + "," + cyp, fill: "#7fe8ff", opacity: 0.8, stroke: "#fff", "stroke-width": 2 })); g.appendChild(svg("line", gm.d ? { x1: x + pad + 6, y1: y + pad + 6, x2: x + pad + w - 6, y2: y + pad + w - 6, stroke: "#fff", "stroke-width": 3 } : { x1: x + pad + 6, y1: y + pad + w - 6, x2: x + pad + w - 6, y2: y + pad + 6, stroke: "#fff", "stroke-width": 3 })); }
      else if (gm.k === "tint") { g.appendChild(svg("circle", { cx: cxp, cy: cyp, r: w / 2, fill: HEX[gm.m], opacity: 0.85, stroke: "#fff", "stroke-width": 2 })); g.appendChild(svg("circle", { cx: cxp - 4, cy: cyp - 4, r: 4, fill: "#fff", opacity: 0.7 })); }
      if (selected) g.appendChild(svg("rect", { x: x + 1, y: y + 1, width: S - 2, height: S - 2, rx: 6, fill: "none", stroke: "#ffd23f", "stroke-width": 3 }));
      if (onClick) { g.style.cursor = "pointer"; g.addEventListener("click", (e) => { e.stopPropagation(); onClick(gm.x + dx, gm.y + dy); }); }
      root.appendChild(g);
    });
  }
  function gemIcon(meta, d, size) {
    const S = size || 30; const cells = E.SHAPES[meta.shape]; const w = Math.max.apply(null, cells.map((c) => c[0])) + 1, h = Math.max.apply(null, cells.map((c) => c[1])) + 1;
    const root = svg("svg", { viewBox: "0 0 " + w * 40 + " " + h * 40, width: w * S, height: h * S });
    drawGem(root, { k: meta.k, m: meta.m, d: d || 0, cells, x: -1 + 0, y: -1 + 0 }, 40, 1, false, null);
    root.setAttribute("viewBox", "40 40 " + w * 40 + " " + h * 40); return root;
  }

  // ---------- carnet et pose ----------
  function hypGems(s) { return G.hyp.map((h, i) => (h ? { k: s.inv[i].k, m: s.inv[i].m, d: h.d, cells: cellsOf(s.inv[i].shape, h.rot), x: h.x, y: h.y } : null)); }
  function fitsHyp(s, idx, h) {
    const cells = cellsOf(s.inv[idx].shape, h.rot); const occ = new Set();
    G.hyp.forEach((o, i) => { if (!o || i === idx) return; cellsOf(s.inv[i].shape, o.rot).forEach(([dx, dy]) => occ.add((o.x + dx) + "," + (o.y + dy))); });
    return cells.every(([dx, dy]) => { const x = h.x + dx, y = h.y + dy; return x >= 0 && y >= 0 && x < s.W && y < s.H && !occ.has(x + "," + y); });
  }
  function cellPose(s, x, y) {
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
      const b = el("button", { class: "om-pitem" + (G.sel === i ? " om-pitem--sel" : "") + (placed ? " om-pitem--placed" : ""), onclick: () => { G.sel = G.sel === i ? null : i; render(); } }, [el("span", { class: "om-picon" }), el("small", { text: E.KINDS[m.k].label + (m.m ? " " + CNAME[m.m] : "") })]);
      b.querySelector(".om-picon").appendChild(gemIcon(m, 0, 22));
      box.appendChild(b);
    });
    return box;
  }
  function toolBar(s) {
    const selMeta = G.sel !== null ? s.inv[G.sel] : null; const diag = selMeta && (selMeta.k === "mirror" || selMeta.k === "splitter");
    return el("div", { class: "om-tools" }, [
      el("button", { class: "btn btn--small " + (G.tool === "pose" ? "btn--accent" : "btn--ghost"), text: "Poser une pierre", onclick: () => { G.tool = "pose"; render(); } }),
      el("button", { class: "btn btn--small " + (G.tool === "note" ? "btn--accent" : "btn--ghost"), text: "Barrer une case", onclick: () => { G.tool = "note"; render(); } }),
      el("button", { class: "btn btn--small btn--ghost", text: "Tourner", disabled: G.sel === null, onclick: () => rotateSel(s) }),
      diag ? el("button", { class: "btn btn--small btn--ghost", text: "Changer la diagonale", disabled: !G.hyp[G.sel], onclick: flipSel }) : null,
      el("button", { class: "btn btn--small btn--ghost", text: "Retirer", disabled: G.sel === null || !G.hyp[G.sel], onclick: removeSel }),
    ]);
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
    st.appendChild(el("div", { class: "om-card" }, [el("h2", { text: s.key === "classique" ? "Tu es le Directeur" : "Cache ta mine" }), el("p", { class: "om-hint", text: "Pose toutes les pierres dans la mine. Les explorateurs devront les retrouver avec des rayons. Pour un miroir ou un séparateur, choisis aussi le sens de la diagonale." + (s.key === "croise" ? " Ton voisin explorera ta mine, et tu exploreras celle d'un autre." : "") })]));
    st.appendChild(boardWrap(boardSvg(s, { hyp: G.hyp.map((h, i) => h), onCell: (x, y) => cellPose(s, x, y), notes: null, gems: null })));
    st.appendChild(palette(s)); st.appendChild(toolBar(s));
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
    const shots = s.shots || [];
    // bandeau d'état
    let banner = null;
    if (iAmDir) banner = "Tu es le Directeur, regarde-les chercher. Ta mine est affichée en transparence.";
    else if (!explorer) banner = "Tu regardes la partie.";
    else if (mine.solved) banner = "Mine résolue, bravo !";
    else if (mine.out) banner = "Tu es sorti de la manche.";
    else if (s.share === "turn") banner = mine.turn === myId() ? "C'est ton tour, tire un laser ou accuse." : "Tour de " + nameOf(mine.turn) + ".";
    else banner = s.key === "course" ? "Course. Ton carnet est secret, le premier qui accuse juste gagne." : s.key === "croise" ? "Tu explores la mine de ton voisin. La tienne est cachée plus bas." : s.key === "equipes" ? "Ton équipe " + mine.members.map(nameOf).join(" et ") + " partage un carnet secret." : "Vous fouillez ensemble, le carnet est commun.";
    st.appendChild(el("div", { class: "om-banner" + (explorer && s.share === "turn" && mine.turn === myId() ? " om-banner--turn" : "") }, [el("b", { text: banner })]));
    if (s.units.length > 1 && s.key !== "classique") st.appendChild(el("div", { class: "om-units" }, s.units.map((u) => el("span", { class: "om-unit" + (u.id === s.myUnit ? " om-unit--me" : "") + (u.out ? " om-unit--out" : "") }, u.members.map((id) => dot(id)).concat([u.members.map(nameOf).join(" et ") + "  ·  " + u.used + " tir" + (u.used > 1 ? "s" : "") + (u.solved ? "  ·  résolu" : u.out ? "  ·  éliminé" : "")])))));
    const mayAct = explorer && !mine.solved && !mine.out && (s.share !== "turn" || mine.turn === myId());
    const left = s.budget ? Math.max(0, s.budget - mine.used) : null;
    const bd = boardSvg(s, { gems: iAmDir || (s.key === "croise" && false) ? s.dirMine : null, hyp: explorer ? G.hyp : null, shots: explorer || iAmDir ? shots : [], notes: G.notes, onCell: explorer ? (x, y) => cellPose(s, x, y) : null, onSlot: mayAct ? (sl) => { G.slot = sl; render(); } : null, selSlot: G.slot });
    st.appendChild(boardWrap(bd));
    if (explorer) {
      // choix du laser et tir
      const lasers = el("div", { class: "om-lasers" }, s.lasers.map((m) => el("button", { class: "om-laser" + (G.mask === m ? " om-laser--on" : ""), style: G.mask === m ? { borderColor: HEX[m] } : {}, title: CNAME[m], onclick: () => { G.mask = m; render(); } }, [el("i", { style: { background: HEX[m], boxShadow: "0 0 12px " + HEX[m] } }), el("small", { text: CNAME[m] })])));
      if (!s.lasers.includes(G.mask)) G.mask = s.lasers[s.lasers.length - 1];
      const slotTxt = G.slot ? "entrée " + slotName(G.slot) : "aucune entrée choisie";
      const canShoot = mayAct && G.slot && (left === null || left > 0);
      st.appendChild(el("div", { class: "om-fire" }, [lasers, el("button", { class: "btn btn--accent btn--big", disabled: !canShoot, text: left === 0 ? "Plus de tirs" : "Tirer " + CNAME[G.mask] + ", " + slotTxt, onclick: () => { Kit.socket.emit("om:shoot", { s: G.slot.s, i: G.slot.i, mask: G.mask }); G.slot = null; } })]));
      st.appendChild(el("p", { class: "om-hint", text: "Touche un rond autour de la mine pour choisir où partira le laser. Un rond coloré avec un numéro est un tir, un carré coloré est l'endroit où il ressort." }));
      // journal des tirs
      st.appendChild(shotLog(s, shots));
      // carnet
      st.appendChild(el("div", { class: "om-card" }, [el("h3", { text: "Ton carnet de pierres" }), el("p", { class: "small muted", text: "Pose ici les pierres là où tu penses qu'elles sont. Les tirs qui ne collent pas avec ton carnet sont marqués d'une croix." }), palette(s), toolBar(s)]));
      const all = G.hyp.filter(Boolean).length === s.inv.length;
      const lives = mine.perMember ? s.lives - (mine.strikes[myId()] || 0) : s.lives - (mine.strikes.u || 0);
      st.appendChild(el("div", { class: "om-ctrl" }, [el("button", { class: "btn btn--green btn--big", disabled: !mayAct || !all, text: !all ? "Place les " + s.inv.length + " pierres pour accuser (" + G.hyp.filter(Boolean).length + " posées)" : "J'accuse, c'est ça la mine (" + lives + " essai" + (lives > 1 ? "s" : "") + ")", onclick: () => Kit.confirm("Accuser avec ce carnet ? Une erreur coûte un essai.", () => Kit.socket.emit("om:accuse", { placement: placement() })) })]));
      if (G.hint !== null && G.hint !== undefined) st.appendChild(el("p", { class: "om-hint", text: "Dernier indice, " + G.hint + " pierre" + (G.hint > 1 ? "s" : "") + " bien placée" + (G.hint > 1 ? "s" : "") + " sur " + s.inv.length + "." }));
    } else {
      st.appendChild(el("div", { class: "om-card" }, [el("h3", { text: "Les pierres à trouver" }), palette(s)]));
      if (iAmDir) st.appendChild(shotLog(s, shots));
    }
    if (s.key === "croise" && s.dirMine) { const sp = el("div", { class: "om-card" }, [el("h3", { text: "Ta propre mine" }), boardWrap(boardSvg(s, { gems: s.dirMine, shots: [] }))]); st.appendChild(sp); }
    if (Kit.isHost()) st.appendChild(el("div", { class: "om-ctrl" }, [el("button", { class: "btn btn--small btn--ghost", text: "Terminer la manche", onclick: () => Kit.confirm("Terminer la manche maintenant ? Personne ne marquera.", () => Kit.socket.emit("om:skip")) })]));
    if (s.units.some((u) => u.stallAt && u.id === s.myUnit)) st.appendChild(el("p", { class: "om-hint", text: "Plus de tirs. Tu as une minute pour accuser." }));
  }
  const slotName = (sl) => ({ N: "du haut", S: "du bas", W: "de gauche", E: "de droite" }[sl.s]) + " numéro " + (sl.i + 1);
  function shotLog(s, shots) {
    const hyp = hypGems(s); const placedAll = hyp.every(Boolean) && hyp.length === s.inv.length; const grid = placedAll ? E.buildGrid(s.W, s.H, hyp) : null;
    const rows = shots.slice().reverse().map((sh) => {
      let mark = ""; if (placedAll) { const res = E.trace(s.W, s.H, grid, hyp, sh.slot, sh.mask, false); mark = E.shotSig(res) === E.shotSig(sh) ? "✔" : "✕"; }
      const exits = sh.exits.length ? sh.exits.map((e) => ({ N: "haut", S: "bas", W: "gauche", E: "droite" }[e.s]) + " " + (e.i + 1) + " en " + CNAME[e.m]).join(" et ") : "rien";
      return el("div", { class: "om-shot" }, [el("i", { class: "om-shot__dot", style: { background: HEX[sh.mask] } }, [txt(String(sh.n))]), el("div", {}, [el("b", { text: sh.free ? "Tir offert " : "" }), el("span", { class: "small", text: "Entrée " + ({ N: "haut", S: "bas", W: "gauche", E: "droite" }[sh.slot.s]) + " " + (sh.slot.i + 1) + ", " + CNAME[sh.mask] + ". Sortie " + exits + (sh.absorbed ? (sh.exits.length ? ", une partie absorbée" : ", absorbé") : "") + "." })]), mark ? el("span", { class: "om-shot__mark " + (mark === "✔" ? "ok" : "ko"), text: mark }) : null]);
    });
    return el("div", { class: "om-card" }, [el("h3", { text: "Journal des tirs (" + shots.length + ")" }), rows.length ? el("div", { class: "om-shots" }, rows) : el("p", { class: "small muted", text: "Aucun tir pour l'instant." })]);
  }

  // ---------- révélation ----------
  function buildReveal(st, s) {
    const rv = s.reveal; if (!rv) return;
    const win = rv.win !== null && rv.win !== undefined ? rv.units.find((u) => u.id === rv.win) : null;
    st.appendChild(el("div", { class: "om-card om-reveal" }, [el("h2", { text: win ? "Mine résolue" : "Mine intacte" }), el("p", { class: "om-hint", text: win ? win.members.map(nameOf).join(" et ") + " ont tout trouvé en " + win.shots + " tir" + (win.shots > 1 ? "s" : "") + "." : "Personne n'a trouvé toutes les pierres." })]));
    if (rv.units.length > 1) st.appendChild(el("div", { class: "om-units" }, rv.units.map((u) => el("button", { class: "om-unit om-unit--btn" + (u.id === G.unitView ? " om-unit--me" : ""), onclick: () => { G.unitView = u.id; replayUnit(s, u.id); render(); } }, u.members.map((id) => dot(id)).concat([u.members.map(nameOf).join(" et ") + "  ·  " + u.shots + " tirs" + (u.solved ? "  ·  résolu" : "")])))));
    const u = rv.units.find((x) => x.id === G.unitView) || rv.units[0]; const mine = rv.mines[u.mine] || rv.mines[0];
    const shots = u.shotsList.map((sh) => { const res = E.trace(s.W, s.H, E.buildGrid(s.W, s.H, mine.gems), mine.gems, sh.slot, sh.mask, true); return { n: sh.n, slot: sh.slot, mask: sh.mask, exits: res.exits, absorbed: res.absorbed, rays: res.rays }; });
    st.appendChild(boardWrap(boardSvg(s, { gems: mine.gems, shots, onCell: null })));
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
  Kit.on("room", (r) => { if (r.status === "lobby") { G.st = null; G.over = null; G.round = -1; G.lastKey = ""; const c = $("#om-cave"); if (c) c.classList.add("hidden"); } else if (G.st) renderTop(); });
  function attach() { const so = Kit.socket; if (!so || G.attached) return; G.attached = true; so.on("om:state", onState); so.on("om:over", onOver); so.on("om:accuseResult", onAccuseResult); so.on("om:random", onRandom); }

  Kit.init({
    id: "orapa-mine", title: "Orapa Mine", emoji: "💎", ribbon: "Le jeu de déduction à lasers", tagline: "Tire des rayons dans la mine et retrouve les pierres cachées.",
    createLabel: "Créer une expédition", soloLabel: "Jouer contre un robot", startLabel: "Descendre dans la mine", helpTitle: "Comment jouer",
    floaters: [{ e: "💎", x: 6 }, { e: "⛏️", x: 20 }, { e: "🔦", x: 36 }, { e: "🔴", x: 50 }, { e: "🔵", x: 64 }, { e: "🟡", x: 78 }, { e: "🪨", x: 92 }],
    colors: COLORS, botLevels: [{ id: "novice", label: "Novice" }, { id: "fute", label: "Futé" }, { id: "genie", label: "Génie" }], maxPlayers: 6, minPlayers: 2, schema: R.SCHEMA,
    help: [
      { title: "Le principe", text: "Des pierres précieuses sont cachées dans une mine en forme de grille. Tu ne les vois pas. Tu tires des lasers depuis les bords et tu regardes par où et avec quelle couleur ils ressortent. À toi de déduire où sont les pierres et dans quel sens." },
      { title: "Les pierres", text: "Un filtre ne laisse passer que sa couleur. Un miroir renvoie le rayon en diagonale. L'obsidienne avale la lumière. Un prisme sépare le blanc, le rouge tourne à gauche, le bleu à droite et le jaune continue. Un séparateur laisse passer le rayon et en renvoie une copie. Une opale ajoute sa couleur au rayon." },
      { title: "Les couleurs", text: "Il n'y a que trois couleurs de base, rouge, bleu et jaune. Elles se mélangent, rouge et bleu donnent violet, rouge et jaune donnent orange, bleu et jaune donnent vert, et les trois ensemble donnent blanc." },
      { title: "Tirer", text: "Choisis un laser, touche un rond autour de la mine, puis tire. Selon le réglage, tu vois tout le trajet, le début seulement, ou juste l'entrée et la sortie. Les tirs sont notés dans le journal." },
      { title: "Le carnet", text: "Pose les pierres de la liste dans ton carnet, tourne-les, change le sens des diagonales. Une fois toutes posées, le journal te dit quels tirs sont compatibles avec ton carnet, c'est la meilleure façon de trouver ce qui ne va pas." },
      { title: "Accuser", text: "Quand ton carnet te semble juste, accuse. Si les pierres sont toutes bien placées avec le bon sens, tu gagnes la manche. Sinon tu perds un essai, et quand il n'y en a plus tu sors de la manche." },
      { title: "Les modes", text: "En classique un Directeur cache la mine et chacun tire à son tour. En course on se dispute la même mine en secret. En mines croisées chacun cache la sienne. En coopération et en équipes on partage un carnet. L'énigme donne quelques tirs gratuits, la campagne enchaîne douze mines." },
    ],
    theme: { a1: "#7fd6ff", a2: "#b06bff", bg1: "#1a2a6b", bg2: "#070a1c" },
    onInit() { build(); attach(); Kit.on("connect", attach); },
  });
})();

// ============================================================
// MAUVAISES LANGUES — Interface de jeu (client)
// ============================================================
(function () {
  const { el, $, toast, sound, store } = Kit;
  const R = MLRules;
  const COLORS = [
    { name: "Rose", hex: "#ff4fa3" }, { name: "Jaune", hex: "#ffd23f" }, { name: "Turquoise", hex: "#27d3c3" }, { name: "Violet", hex: "#9b5cff" },
    { name: "Orange", hex: "#ff8a1f" }, { name: "Vert", hex: "#4cd964" }, { name: "Bleu", hex: "#3d8bff" }, { name: "Rouge", hex: "#ff4b3e" },
  ];
  const G = { st: null, q: null, ranking: [], myVote: null, sig: "", offset: 0, samples: [], phaseTotal: 1, phaseKey: "", over: null, sentRank: false, topSig: "" };
  const myId = () => { const p = Kit.me(); return p ? p.id : null; };
  const pl = (id) => (Kit.room ? Kit.room.players.find((p) => p.id === id) : null);
  const nameOf = (id) => { const p = pl(id); return p ? p.name : "?"; };
  const hexOf = (id) => { const p = pl(id); return COLORS[((p && p.color) || 0) % COLORS.length].hex; };
  const snow = () => Date.now() + G.offset;
  const clockSample = (serverNow) => { G.samples.push(serverNow - Date.now()); if (G.samples.length > 10) G.samples.shift(); G.offset = Math.max.apply(null, G.samples); };
  const dot = (id) => el("i", { class: "dotc", style: { background: hexOf(id) } });
  const flames = (h) => "🌶️".repeat(Math.max(1, Math.min(3, h || 1)));
  const pick = (arr, k) => arr[Math.abs(k) % arr.length];

  // ---------- squelette ----------
  function build() {
    const sc = $("#screen-game"); sc.innerHTML = "";
    sc.appendChild(el("div", { class: "ml-bg" }));
    sc.appendChild(el("div", { class: "ml-top", id: "ml-top" }));
    sc.appendChild(el("div", { class: "ml-timer hidden", id: "ml-timer" }, [el("i", { id: "ml-timer-fill" }), el("span", { id: "ml-timer-txt" })]));
    sc.appendChild(el("main", { class: "ml-stage", id: "ml-stage" }));
    sc.appendChild(el("div", { class: "ml-reacts", id: "ml-reacts" }));
    sc.appendChild(el("div", { class: "ml-react-bar hidden", id: "ml-react-bar" }));
    sc.appendChild(el("button", { class: "round-btn ml-menu", id: "ml-menu", title: "Menu", text: "⚙️", onclick: openMenu }));
  }
  function openMenu() {
    const sbtn = el("button", { class: "btn btn--small btn--ghost", text: sound.enabled ? "Son activé" : "Son coupé", onclick: (ev) => { ev.target.textContent = sound.toggle() ? "Son activé" : "Son coupé"; } });
    Kit.showModal("Menu", [
      el("div", { class: "menu-row" }, [el("div", {}, [el("b", { text: "Sons" }), el("p", { class: "small muted", text: "Les petits bruitages du jeu." })]), sbtn]),
      el("h3", { text: "Comment ça marche", style: { marginTop: "0.8rem" } }),
      el("p", { class: "small", text: "À chaque manche, un joueur reçoit une question secrète et classe tout le monde, lui compris. Les autres voient le classement et doivent deviner quelle question parmi quatre a servi à le faire." }),
      el("button", { class: "btn btn--danger btn--small", style: { marginTop: "0.8rem" }, text: "Quitter la partie", onclick: () => Kit.confirm("Quitter la partie et revenir à l'accueil ?", () => { $("#modal").classList.add("hidden"); Kit.leave(); }) }),
    ]);
  }

  // ---------- réception ----------
  function onState(s) {
    clockSample(s.now);
    const key = s.phase + "|" + s.idx;
    if (key !== G.phaseKey) {
      G.phaseKey = key; G.phaseTotal = Math.max(1000, s.phaseUntil - snow());
      if (s.phase === "rank") { G.ranking = []; G.sentRank = false; G.myVote = null; if (s.rankerId !== myId()) G.q = null; }
      if (s.phase === "guess") { G.myVote = null; sound.tone(520, 0.1, "triangle", 0.09); sound.tone(780, 0.12, "triangle", 0.09, 0.09); }
      if (s.phase === "reveal") { sound.tone(392, 0.12, "sawtooth", 0.06); sound.tone(523, 0.12, "sawtooth", 0.06, 0.1); sound.tone(784, 0.25, "triangle", 0.1, 0.2); }
      if (s.phase === "rank" && s.rankerId === myId()) { sound.tone(660, 0.12, "triangle", 0.1); sound.tone(880, 0.16, "triangle", 0.1, 0.12); }
    }
    G.st = s; render();
  }
  function onQuestion(m) { G.q = m; if (G.st && G.st.phase === "rank" && G.st.rankerId === myId()) { updateQuestionCard(); } }
  function onOver(m) { G.over = m; G.phaseKey = "over"; render(); }

  // ---------- rendu ----------
  function render() {
    const s = G.st; if (!s || !Kit.room) return;
    renderTop();
    const role = s.phase === "over" ? "over" : s.rankerId === myId() ? "ranker" : (s.pids || []).includes(myId()) ? "voter" : "watch";
    const sig = s.phase + "|" + s.idx + "|" + role + "|" + (s.phase === "over" ? (G.over ? 1 : 0) : 1);
    if (sig !== G.sig) { G.sig = sig; buildStage(role); }
    else updateDynamic();
    $("#ml-react-bar").classList.toggle("hidden", !(s.phase === "reveal" && Kit.room.settings.reactions));
    const tm = $("#ml-timer"); tm.classList.toggle("hidden", s.phase === "over");
  }
  function renderTop() {
    const s = G.st; const top = $("#ml-top");
    const sig = JSON.stringify([s.idx, s.total, s.rankerId, s.phase, s.scores, Kit.room.players.map((p) => [p.id, p.name, p.color, p.connected, p.left])]);
    if (sig === G.topSig) return; G.topSig = sig; top.innerHTML = "";
    top.appendChild(el("div", { class: "ml-round", text: s.phase === "over" ? "Fin de partie" : "Manche " + (s.idx + 1) + " sur " + s.total }));
    const row = el("div", { class: "ml-scores" });
    const list = Kit.room.players.filter((p) => !p.left).slice().sort((a, b) => (s.scores[b.id] || 0) - (s.scores[a.id] || 0));
    list.forEach((p) => row.appendChild(el("div", { class: "ml-chip" + (p.id === s.rankerId && s.phase !== "over" ? " ml-chip--rk" : "") + (p.you ? " ml-chip--you" : "") + (p.connected ? "" : " ml-chip--off") }, [dot(p.id), el("span", { class: "nm", text: (p.id === s.rankerId && s.phase !== "over" ? "🎤 " : "") + p.name }), el("b", { text: String(s.scores[p.id] || 0) })])));
    top.appendChild(row);
  }
  function tickTimer() {
    const s = G.st; if (!s || s.phase === "over") return; const left = Math.max(0, s.phaseUntil - snow());
    const f = $("#ml-timer-fill"), t = $("#ml-timer-txt"); if (!f) return;
    f.style.width = Math.max(0, Math.min(100, (left / G.phaseTotal) * 100)).toFixed(1) + "%";
    const sec = Math.ceil(left / 1000); t.textContent = sec + " s"; $("#ml-timer").classList.toggle("ml-timer--hot", sec <= 8 && s.phase !== "reveal");
  }
  setInterval(tickTimer, 200);

  function buildStage(role) {
    const s = G.st; const st = $("#ml-stage"); st.innerHTML = ""; st.scrollTop = 0;
    if (s.phase === "over") return buildOver(st);
    if (s.phase === "rank") return role === "ranker" ? buildRanker(st) : buildWaitRank(st);
    if (s.phase === "guess") return buildGuess(st, role);
    if (s.phase === "reveal") return buildReveal(st);
  }
  function updateDynamic() {
    const s = G.st;
    if (s.phase === "guess") {
      const box = $("#ml-voted"); if (box) { box.innerHTML = ""; const need = (s.pids || []).filter((id) => id !== s.rankerId); need.forEach((id) => box.appendChild(el("span", { class: "ml-vd" + (s.voted.includes(id) ? " ml-vd--ok" : "") , title: nameOf(id) }, [dot(id), s.voted.includes(id) ? "✓" : "…"]))); const c = $("#ml-voted-txt"); if (c) c.textContent = s.voted.length + " sur " + need.length + " ont voté"; }
    }
  }

  // ---------- classement par le joueur ----------
  function buildRanker(st) {
    const s = G.st;
    st.appendChild(el("div", { class: "ml-card ml-qcard", id: "ml-qcard" }));
    st.appendChild(el("p", { class: "ml-hint", text: "Classe tout le monde, toi compris, du plus au moins. Seul toi vois cette question. Les autres devront la deviner." }));
    st.appendChild(el("div", { class: "ml-rk" }, [
      el("div", { class: "ml-rk__end", text: "👆 Le plus" }),
      el("div", { id: "rk-list", class: "ml-rk__list" }),
      el("div", { class: "ml-rk__end", text: "👇 Le moins" }),
    ]));
    st.appendChild(el("div", { class: "ml-pool-title", text: "Touche un nom pour le placer dans l'ordre" }));
    st.appendChild(el("div", { id: "rk-pool", class: "ml-pool" }));
    st.appendChild(el("div", { class: "ml-actions" }, [
      el("button", { id: "rk-clear", class: "btn btn--ghost btn--small", text: "Tout effacer", onclick: () => { G.ranking = []; drawRanking(); } }),
      el("button", { id: "rk-ok", class: "btn btn--accent btn--big", text: "Valider mon classement", onclick: submitRank }),
    ]));
    updateQuestionCard(); drawRanking();
  }
  function updateQuestionCard() {
    const card = $("#ml-qcard"); if (!card) return; const q = G.q && G.st && G.q.idx === G.st.idx ? G.q : null; card.innerHTML = "";
    if (!q) { card.appendChild(el("p", { class: "ml-q", text: "Ta question arrive" })); return; }
    const th = R.themeOf(q.q.theme);
    card.appendChild(el("div", { class: "ml-qmeta" }, [el("span", { class: "ml-tag", text: th.icon + " " + th.label }), el("span", { class: "ml-tag ml-tag--heat", text: flames(q.q.heat) + " " + R.HEAT_NAMES[q.q.heat] })]));
    card.appendChild(el("p", { class: "ml-q", text: q.q.text }));
    const left = q.swapsLeft;
    if (Kit.room.settings.swaps > 0) card.appendChild(el("button", { class: "btn btn--ghost btn--small", disabled: left <= 0, text: left > 0 ? "Changer de question (" + left + " restant" + (left > 1 ? "s" : "") + ")" : "Plus de changement possible", onclick: () => { G.ranking = []; drawRanking(); Kit.socket.emit("ml:swap"); } }));
  }
  function drawRanking() {
    const s = G.st; if (!s) return; const list = $("#rk-list"), pool = $("#rk-pool"); if (!list || !pool) return;
    list.innerHTML = ""; pool.innerHTML = "";
    G.ranking.forEach((id, i) => {
      list.appendChild(el("div", { class: "ml-rkrow", style: { "--hc": hexOf(id) } }, [
        el("b", { class: "ml-rkn", text: String(i + 1) }), dot(id), el("span", { class: "nm", text: nameOf(id) + (id === myId() ? " (toi)" : "") }),
        el("button", { class: "ml-mv", title: "Monter", text: "▲", disabled: i === 0, onclick: () => { move(i, -1); } }),
        el("button", { class: "ml-mv", title: "Descendre", text: "▼", disabled: i === G.ranking.length - 1, onclick: () => { move(i, 1); } }),
        el("button", { class: "ml-mv ml-mv--x", title: "Retirer", text: "✕", onclick: () => { G.ranking.splice(i, 1); drawRanking(); } }),
      ]));
    });
    if (!G.ranking.length) list.appendChild(el("div", { class: "ml-empty", text: "Personne n'est encore placé" }));
    const rest = s.pids.filter((id) => !G.ranking.includes(id));
    rest.forEach((id) => pool.appendChild(el("button", { class: "ml-pchip", style: { "--hc": hexOf(id) }, onclick: () => { sound.click(); G.ranking.push(id); drawRanking(); } }, [dot(id), nameOf(id) + (id === myId() ? " (toi)" : "")])));
    if (!rest.length) pool.appendChild(el("div", { class: "ml-empty", text: "Tout le monde est placé, tu peux valider" }));
    const ok = $("#rk-ok"); if (ok) ok.disabled = rest.length > 0 || G.sentRank;
  }
  function move(i, d) { const j = i + d; if (j < 0 || j >= G.ranking.length) return; const t = G.ranking[i]; G.ranking[i] = G.ranking[j]; G.ranking[j] = t; sound.click(); drawRanking(); }
  function submitRank() { if (G.sentRank) return; G.sentRank = true; Kit.socket.emit("ml:rank", { order: G.ranking.slice() }); setTimeout(() => { G.sentRank = false; drawRanking(); }, 2500); drawRanking(); }

  // ---------- attente pendant que quelqu'un classe ----------
  const WAIT_LINES = ["réfléchit à qui sera tout en bas", "pèse chaque nom avec beaucoup de mauvaise foi", "hésite entre l'amitié et la vérité", "se prépare à se faire des ennemis", "classe tout le monde sans pitié", "sourit déjà en pensant au dernier"];
  function buildWaitRank(st) {
    const s = G.st; const n = nameOf(s.rankerId);
    st.appendChild(el("div", { class: "ml-card ml-wait" }, [
      el("div", { class: "ml-bigemoji", text: "🤫" }),
      el("h2", { text: n + " classe tout le monde" }),
      el("p", { class: "muted", text: n + " " + pick(WAIT_LINES, s.idx * 3 + 1) + "." }),
      el("p", { class: "ml-hint", text: "Tout à l'heure vous verrez son classement et quatre questions. Une seule est la vraie. À vous de deviner." }),
    ]));
  }

  // ---------- vote ----------
  function rankingView(s, opts) {
    opts = opts || {}; const n = s.ranking.length;
    const box = el("div", { class: "ml-rk ml-rk--view" }, [el("div", { class: "ml-rk__end", text: "👆 Le plus" })]);
    s.ranking.forEach((id, i) => box.appendChild(el("div", { class: "ml-rkrow ml-rkrow--v" + (i === 0 ? " ml-rkrow--first" : "") + (i === n - 1 && n > 1 ? " ml-rkrow--last" : ""), style: { "--hc": hexOf(id), "--i": i } }, [
      el("b", { class: "ml-rkn", text: i === 0 ? "👑" : i === n - 1 && n > 1 ? "💀" : String(i + 1) }), dot(id), el("span", { class: "nm", text: nameOf(id) + (id === myId() ? " (toi)" : "") }),
      opts.gains && opts.gains[id] ? el("span", { class: "ml-gain", text: "+" + opts.gains[id] }) : null,
    ])));
    box.appendChild(el("div", { class: "ml-rk__end", text: "👇 Le moins" }));
    return box;
  }
  function buildGuess(st, role) {
    const s = G.st; const rk = nameOf(s.rankerId);
    st.appendChild(el("div", { class: "ml-card" }, [el("h2", { text: "Le classement de " + rk }), rankingView(s)]));
    if (role === "ranker") {
      st.appendChild(el("div", { class: "ml-card ml-wait" }, [el("div", { class: "ml-bigemoji", text: "😏" }), el("h2", { text: "Les autres cherchent ta question" }), el("p", { class: "muted", text: "Tu as classé honnêtement, non ? Tu marques des points pour chaque joueur qui trouve." })]));
    } else if (role === "watch") {
      st.appendChild(el("p", { class: "ml-hint", text: "Tu n'étais pas là au début de la manche, tu regardes les autres deviner." }));
    } else {
      st.appendChild(el("h3", { class: "ml-ask", text: "À ton avis, quelle question " + rk + " a eue ?" }));
      const box = el("div", { class: "ml-opts", id: "ml-opts" });
      s.options.forEach((o, i) => box.appendChild(el("button", { class: "ml-opt" + (G.myVote === o.id ? " ml-opt--on" : ""), "data-o": o.id, onclick: () => vote(o.id) }, [el("b", { text: String.fromCharCode(65 + i) }), el("span", { text: o.text })])));
      st.appendChild(box);
    }
    st.appendChild(el("div", { class: "ml-votedbox" }, [el("div", { id: "ml-voted", class: "ml-voted" }), el("span", { id: "ml-voted-txt", class: "small muted" })]));
    updateDynamic();
  }
  function vote(o) {
    if (G.st.phase !== "guess") return; G.myVote = o; sound.click(); Kit.socket.emit("ml:vote", { opt: o });
    document.querySelectorAll(".ml-opt").forEach((b) => b.classList.toggle("ml-opt--on", b.dataset.o === o));
  }

  // ---------- dévoilement ----------
  const FIRST = ["{n} est tout en haut, ça ne surprend personne.", "{n} prend la première place, les autres encaissent.", "Le trône revient à {n}.", "{n} gagne ce classement sans rien avoir fait."];
  const LAST = ["{n} ferme la marche, il va falloir en parler.", "{n} finit dernier, l'ego en prend un coup.", "Dernière place pour {n}, courage.", "{n} tout en bas, plus dure sera la chute."];
  function roast(s) {
    const r = s.ranking, n = r.length, k = s.idx + n; const out = [];
    out.push(pick(FIRST, k).replace("{n}", nameOf(r[0])));
    if (n > 1) out.push(pick(LAST, k + 1).replace("{n}", nameOf(r[n - 1])));
    const me = s.rankerId; const at = r.indexOf(me);
    if (n > 2 && at === 0) out.push(nameOf(me) + " s'est classé tout en haut, quelle modestie.");
    else if (n > 2 && at === n - 1) out.push(nameOf(me) + " s'est classé tout en bas, humble ou lucide ?");
    return out;
  }
  function buildReveal(st) {
    const s = G.st; const rv = s.reveal; const th = R.themeOf(rv.q.theme);
    if (rv.skipped) {
      st.appendChild(el("div", { class: "ml-card ml-wait" }, [el("div", { class: "ml-bigemoji", text: "🦗" }), el("h2", { text: "Manche annulée" }), el("p", { class: "muted", text: rv.why || "Personne ne marque cette fois." })]));
      return;
    }
    st.appendChild(el("div", { class: "ml-card ml-qcard ml-qcard--real" }, [
      el("div", { class: "ml-qmeta" }, [el("span", { class: "ml-tag", text: th.icon + " " + th.label }), el("span", { class: "ml-tag ml-tag--heat", text: flames(rv.q.heat) + " " + R.HEAT_NAMES[rv.q.heat] })]),
      el("p", { class: "ml-q", text: rv.q.text }),
      el("p", { class: "small muted", text: "La vraie question de " + nameOf(s.rankerId) }),
    ]));
    st.appendChild(el("div", { class: "ml-card" }, [el("h2", { text: "Le classement" }), rankingView(s, { gains: null })]));
    const lines = roast(s); st.appendChild(el("div", { class: "ml-roast" }, lines.map((l, i) => el("p", { style: { "--d": (0.4 + i * 0.5) + "s" }, text: l }))));
    st.appendChild(el("h3", { class: "ml-ask", text: "Qui a trouvé ?" }));
    const box = el("div", { class: "ml-opts ml-opts--rev" });
    s.options.forEach((o, i) => {
      const good = o.id === rv.correct; const voters = rv.votes ? Object.keys(rv.votes).filter((id) => rv.votes[id] === o.id) : [];
      const cnt = rv.counts[o.id] || 0;
      box.appendChild(el("div", { class: "ml-opt ml-opt--rev" + (good ? " ml-opt--good" : G.myVote === o.id ? " ml-opt--bad" : ""), style: { "--d": (i * 0.12) + "s" } }, [
        el("b", { text: good ? "✅" : String.fromCharCode(65 + i) }), el("div", { class: "ml-optbody" }, [el("span", { text: o.text }),
          el("div", { class: "ml-vwho" }, voters.length ? voters.map((id) => el("span", { class: "ml-vtag", style: { "--hc": hexOf(id) } }, [dot(id), nameOf(id)])) : (cnt ? [el("span", { class: "small muted", text: cnt + " vote" + (cnt > 1 ? "s" : "") })] : [el("span", { class: "small muted", text: "Aucun vote" })]))]),
      ]));
    });
    st.appendChild(box);
    const gl = Object.keys(rv.gains).filter((id) => rv.gains[id] > 0).sort((a, b) => rv.gains[b] - rv.gains[a]);
    st.appendChild(el("div", { class: "ml-card ml-gains" }, [el("h2", { text: "Points de la manche" }), gl.length ? el("div", { class: "ml-vwho" }, gl.map((id) => el("span", { class: "ml-vtag ml-vtag--gain", style: { "--hc": hexOf(id) } }, [dot(id), nameOf(id) + " +" + rv.gains[id]]))) : el("p", { class: "muted", text: "Personne n'a trouvé, " + nameOf(s.rankerId) + " est un mystère." })]));
    if (Kit.isHost()) st.appendChild(el("div", { class: "ml-actions" }, [el("button", { class: "btn btn--accent btn--big", text: s.idx + 1 >= s.total ? "Voir les résultats" : "Manche suivante", onclick: () => Kit.socket.emit("ml:next") })]));
    else st.appendChild(el("p", { class: "ml-hint", text: "L'hôte passera à la suite. Ou le temps s'en chargera." }));
    if (!rv.skipped && rv.votes) { const mine = rv.votes[myId()]; if (mine === rv.correct) sound.win(); else if (mine) sound.fail(); }
  }

  // ---------- réactions ----------
  function buildReactBar() {
    const bar = $("#ml-react-bar"); bar.innerHTML = "";
    R.EMOJIS.forEach((e) => bar.appendChild(el("button", { class: "ml-emo", text: e, onclick: () => Kit.socket.emit("ml:react", { e }) })));
  }
  function onReact(m) {
    const box = $("#ml-reacts"); if (!box) return;
    const n = el("div", { class: "ml-fly", style: { left: (8 + Math.random() * 80) + "%" } }, [el("span", { text: m.e }), el("small", { text: nameOf(m.pid) })]);
    box.appendChild(n); setTimeout(() => n.remove(), 2600);
  }

  // ---------- fin de partie ----------
  function buildOver(st) {
    const o = G.over; if (!o) { st.appendChild(el("div", { class: "ml-card ml-wait" }, [el("h2", { text: "Résultats en cours" })])); return; }
    const nm = (id) => { const p = o.players.find((x) => x.id === id); return p ? p.name : "?"; };
    const hx = (id) => { const p = o.players.find((x) => x.id === id); return COLORS[((p && p.color) || 0) % COLORS.length].hex; };
    const top = o.rows.slice(0, 3); const order = top.length === 1 ? [top[0]] : top.length === 2 ? [top[1], top[0]] : [top[1], top[0], top[2]];
    st.appendChild(el("div", { class: "ml-card" }, [el("h2", { text: "Le podium des mauvaises langues" }), el("div", { class: "podium ml-podium" }, order.map((r) => el("div", { class: "pod pod--" + r.rank }, [el("div", { class: "pod__ball", style: { background: hx(r.id) } }), el("div", { class: "pod__nm", text: r.name }), el("div", { class: "pod__bar", text: String(r.pts) })])))]));
    st.appendChild(el("div", { class: "ml-card" }, [el("h2", { text: "Le classement final" }), el("table", { class: "tbl ml-tbl" }, [el("thead", {}, [el("tr", {}, [el("th", { text: "" }), el("th", { text: "Joueur" }), el("th", { class: "r", text: "Points" }), el("th", { class: "r", text: "Bonnes réponses" })])]), el("tbody", {}, o.rows.map((r) => el("tr", {}, [el("td", { text: String(r.rank) }), el("td", {}, [el("span", { class: "dotc", style: { background: hx(r.id) } }), r.name + (r.left ? " (parti)" : "")]), el("td", { class: "r", text: String(r.pts) }), el("td", { class: "r", text: String(r.correct) })])))])]));
    if (o.awards.length) st.appendChild(el("div", { class: "ml-card" }, [el("h2", { text: "Les titres" }), el("div", { class: "ml-awards" }, o.awards.map((a) => el("div", { class: "ml-award", style: { "--hc": hx(a.id) } }, [el("span", { class: "ml-award__ic", text: a.icon }), el("div", {}, [el("b", { text: a.title }), el("div", { class: "ml-award__nm" }, [el("span", { class: "dotc", style: { background: hx(a.id) } }), nm(a.id)]), el("span", { class: "small muted", text: a.detail })])])))]));
    if (o.themes.length) st.appendChild(el("div", { class: "ml-card" }, [el("h2", { text: "Qui domine chaque thème" }), el("div", { class: "ml-themes" }, o.themes.map((t) => el("div", { class: "ml-theme" }, [el("b", { text: t.icon + " " + t.label }), el("span", { class: "small", text: "👑 " + nm(t.top) + (t.bottom ? "   💀 " + nm(t.bottom) : "") })])))]));
    const hist = o.history.filter((h) => !h.skipped);
    if (hist.length) st.appendChild(el("div", { class: "ml-card" }, [el("h2", { text: "Le résumé des manches" }), el("div", { class: "ml-recap" }, hist.map((h) => el("div", { class: "ml-recap__row" }, [el("b", { text: h.q }), el("span", { class: "small muted", text: "Classé par " + nm(h.rankerId) + ". Premier " + nm(h.top) + (h.bottom && h.bottom !== h.top ? ", dernier " + nm(h.bottom) : "") + ". " + h.correct + " sur " + h.voters + " ont trouvé." })])))]));
    const host = Kit.isHost();
    st.appendChild(el("div", { class: "ml-actions" }, [el("button", { class: "btn btn--ghost", text: "Quitter", onclick: () => Kit.confirm("Quitter la partie et revenir à l'accueil ?", () => Kit.leave()) }), host ? el("button", { class: "btn btn--accent btn--big", text: "Retour au salon", onclick: () => Kit.backToLobby() }) : el("span", { class: "muted small", text: "L'hôte peut relancer une partie depuis le salon." })]));
    sound.win();
  }

  // ---------- branchement ----------
  function attach() {
    const so = Kit.socket; if (!so || G.attached) return; G.attached = true;
    so.on("ml:state", onState); so.on("ml:question", onQuestion); so.on("ml:voted", (m) => { G.myVote = m.opt; document.querySelectorAll(".ml-opt").forEach((b) => b.classList.toggle("ml-opt--on", b.dataset.o === m.opt)); }); so.on("ml:over", onOver); so.on("ml:react", onReact);
  }
  Kit.on("reset", () => { G.st = null; G.q = null; G.sig = ""; G.topSig = ""; G.phaseKey = ""; G.over = null; });
  Kit.on("room", (r) => { if (r.status === "lobby") { G.st = null; G.sig = ""; G.topSig = ""; G.phaseKey = ""; G.over = null; } else if (G.st) { G.topSig = ""; renderTop(); } });

  Kit.init({
    id: "mauvaises-langues", title: "Mauvaises Langues", emoji: "👅", ribbon: "Le jeu des classements qui fâchent", tagline: "Classe tes amis sans pitié, puis devine ce qu'on t'a demandé.",
    createLabel: "Créer un salon", soloLabel: "", startLabel: "Lancer la partie", helpTitle: "Comment jouer", noBots: true,
    floaters: [{ e: "👅", x: 6 }, { e: "🌶️", x: 20 }, { e: "😈", x: 36 }, { e: "💀", x: 50 }, { e: "🍑", x: 64 }, { e: "🤫", x: 78 }, { e: "🔥", x: 92 }],
    colors: COLORS, botLevels: [{ id: "none", label: "Aucun" }, { id: "none2", label: "Aucun" }], maxPlayers: 8, minPlayers: 3, schema: R.SCHEMA,
    help: [
      { title: "Le principe", text: "À chaque manche, un joueur reçoit en secret une question du genre qui est le plus susceptible de finir riche. Il classe tout le monde, lui compris, du plus au moins. Les autres voient ce classement et doivent deviner quelle question, parmi quatre, a servi à le faire." },
      { title: "Classer", text: "Quand c'est ton tour, touche les noms dans l'ordre. Le premier est le plus concerné par la question, le dernier le moins. Tu peux changer de question si elle te met mal à l'aise, selon le réglage de l'hôte. Sois honnête, c'est plus drôle et tu marques des points quand on te devine." },
      { title: "Deviner", text: "Observe qui est en haut et qui est en bas. Une seule des quatre questions explique ce classement. Si tu trouves, tu gagnes des points, et le joueur qui a classé aussi. À la fin de chaque manche, on voit qui a voté pour quoi." },
      { title: "Les points et les titres", text: "Chaque bonne réponse rapporte des points réglables par l'hôte. À la fin, des titres sont distribués, le chouchou, le bouc émissaire, le meilleur détective, l'énigme, le livre ouvert, et le champion de chaque thème." },
      { title: "Pour adultes", text: "Les questions sont déplacées, elles parlent de sexualité, de bêtises, d'argent, de soirées et d'ego. L'hôte règle le niveau de piment et les thèmes autorisés. Jouez entre amis qui se connaissent bien, et rappelez-vous que tout ça reste un jeu." },
    ],
    theme: { a1: "#ffe14a", a2: "#ff9f1c", bg1: "#7a1fa2", bg2: "#1a0533" },
    onInit() { build(); buildReactBar(); attach(); Kit.on("connect", attach); },
  });
})();

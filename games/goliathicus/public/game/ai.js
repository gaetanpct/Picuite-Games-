// ============================================================
// GOLIATHICUS — Intelligence artificielle
// L'IA joue comme un humain : elle ne voit que l'état filtré qui lui est
// envoyé (jamais le rang des pièces cachées) et garde sa propre mémoire.
// ============================================================
(function (root, factory) {
  if (typeof module !== "undefined" && module.exports) module.exports = factory(require("./pieces.js"));
  else root.GoliathAI = factory(root.GoliathPieces);
})(typeof window !== "undefined" ? window : globalThis, function (Pieces) {
  const { PIECES, HOUSES } = Pieces;
  const K = (r, c) => r + "," + c;
  const DIRS = [[-1, 0], [1, 0], [0, -1], [0, 1]];

  const LEVELS = {
    easy: {
      id: "easy", label: "Petit Rat", icon: "🐀", desc: "Joue un peu au hasard, tombe dans tous les pièges.",
      noise: 14, aggression: 0.5, danger: 0.0, progress: 0.8, useKnowledge: 0.55, powerChance: 0.04, placement: "random", think: [350, 700], flagGuard: 0, hunt: 0,
    },
    normal: {
      id: "normal", label: "Chevalier", icon: "🛡️", desc: "Évalue les risques et attaque quand c'est rentable.",
      noise: 6, aggression: 0.9, danger: 0.4, progress: 1.0, useKnowledge: 1, powerChance: 0.25, placement: "mixed", think: [500, 1000], flagGuard: 0.6, hunt: 0.5,
    },
    hard: {
      id: "hard", label: "Sorcier", icon: "🧙", desc: "Protège son œuf, piste les pièces immobiles et bluffe un peu.",
      noise: 3, aggression: 1.0, danger: 0.7, progress: 1.0, useKnowledge: 1, powerChance: 0.6, placement: "smart", think: [650, 1300], flagGuard: 1, hunt: 1,
    },
    expert: {
      id: "expert", label: "Dragon", icon: "🐲", desc: "Calcule tout, se souvient de tout, n'oublie jamais une tarte.",
      noise: 1.2, aggression: 1.05, danger: 1.0, progress: 1.1, useKnowledge: 1, powerChance: 0.9, placement: "smart", think: [800, 1600], flagGuard: 1.3, hunt: 1.4,
    },
  };

  const NAMES = ["Bouzelouf", "Tigrou", "Daddy", "Mommy", "Pupuce", "Zaza", "Khalamité", "BadGyal", "Yakak", "Maître Picut", "Tonton Gaufre", "Mamie Tartine"];

  function newMemory() { return { known: {}, lastSeq: 0, lastFrom: {}, moveCount: 0, lastCombatRound: 0 }; }

  function rankOf(t) { return PIECES[t].rank; }
  function val(t, mode) {
    const p = PIECES[t];
    if (t === "oeuf") return 110;
    if (t === "roi" && mode === "kinghunt") return 80;
    return p.cost + (p.mobile ? 1 : 0);
  }

  // résultat d'une attaque de a contre d : "win" | "lose" | "tie"
  function fight(a, d, mode) {
    const A = PIECES[a], D = PIECES[d];
    if (mode === "kinghunt" && a === "roi" && d === "roi") return "win";
    if (D.bomb) return A.miner ? "win" : "lose";
    if (d === "oeuf") return "win";
    if (a === "rat" && d === "roi") return "win";
    if (A.rank > D.rank) return "win";
    if (A.rank < D.rank) return "lose";
    return "tie";
  }

  function rnd(rng, a, b) { return a + rng() * (b - a); }
  function gauss(rng) { return (rng() + rng() + rng() - 1.5) * 1.6; }

  // ---------- observation ----------
  function observe(mem, state) {
    (state.events || []).forEach((ev) => {
      if (ev.seq <= mem.lastSeq) return;
      mem.lastSeq = Math.max(mem.lastSeq, ev.seq);
      if (ev.kind === "combat") {
        mem.lastCombatRound = Math.max(mem.lastCombatRound || 0, ev.round || 0);
        if (ev.attacker && ev.attacker.type) mem.known[ev.attacker.id] = ev.attacker.type;
        if (ev.defender && ev.defender.type) mem.known[ev.defender.id] = ev.defender.type;
      } else if (ev.kind === "move" && ev.owner === state.you) {
        mem.lastFrom[ev.pieceId] = K(ev.from.r, ev.from.c);
      }
    });
    state.pieces.forEach((p) => { if (p.type) mem.known[p.id] = p.type; });
  }

  // ---------- connaissance ----------
  function buildView(state, mem) {
    const me = state.you;
    const myTeam = state.players[me].team;
    const mode = state.settings.mode;
    const grid = new Map();
    state.pieces.forEach((p) => grid.set(K(p.r, p.c), p));
    const enemyOwners = state.players.filter((pl) => pl.team !== myTeam && !pl.eliminated).map((pl) => pl.seat);
    const pools = {};
    enemyOwners.forEach((o) => {
      const counts = Object.assign({}, state.armyCounts);
      state.graveyard.forEach((g) => { if (g.owner === o && counts[g.type] > 0) counts[g.type]--; });
      const alive = state.pieces.filter((p) => p.owner === o);
      alive.forEach((p) => { const t = p.type || mem.known[p.id]; if (t && counts[t] > 0) counts[t]--; });
      pools[o] = counts;
    });
    const typeOf = (p) => p.type || mem.known[p.id] || null;
    return { me, myTeam, mode, grid, pools, enemyOwners, typeOf, state };
  }

  // distribution de probabilité pour une pièce ennemie inconnue
  function distribution(view, p) {
    const pool = view.pools[p.owner] || {};
    const w = {};
    let total = 0;
    Object.keys(pool).forEach((t) => {
      const n = pool[t];
      if (n <= 0) return;
      let f = 1;
      const imm = !PIECES[t].mobile;
      if (p.moved && imm) f = 0;
      else if (!p.moved && !imm) f = 0.45;
      if (p.frozen > 0 && !p.moved) f = f * 1;
      const x = n * f;
      if (x > 0) { w[t] = x; total += x; }
    });
    if (total <= 0) {
      Object.keys(PIECES).forEach((t) => { if (PIECES[t].mobile) { w[t] = 1; total += 1; } });
    }
    Object.keys(w).forEach((t) => { w[t] /= total; });
    return w;
  }

  function evAttack(view, mine, target, level, rng) {
    const known = view.typeOf(target);
    const myT = mine.type;
    const vm = val(myT, view.mode);
    let ev = 0; let pWin = 0; let pLose = 0;
    const consider = (t, prob) => {
      const r = fight(myT, t, view.mode);
      const vt = val(t, view.mode);
      if (r === "win") { ev += prob * (vt + 0.5); pWin += prob; }
      else if (r === "lose") { ev -= prob * vm; pLose += prob; }
      else { ev += prob * (vt - vm); }
    };
    const mixKnow = known && (level.useKnowledge >= 1 || rng() < level.useKnowledge);
    if (mixKnow) consider(known, 1);
    else {
      const d = distribution(view, target);
      Object.keys(d).forEach((t) => consider(t, d[t]));
    }
    // intérêt d'apprendre quelque chose avec une pièce bon marché
    let info = 0;
    if (!mixKnow && vm <= 5) info = 4;
    return { ev, pWin, pLose, info, known: !!mixKnow };
  }

  // probabilité que l'ennemi e batte mon unité de type t s'il m'attaque
  function threatOn(view, e, myType) {
    const known = view.typeOf(e);
    const beat = (t) => PIECES[t].mobile && fight(t, myType, view.mode) === "win";
    if (known) return beat(known) ? 1 : 0;
    const d = distribution(view, e);
    let p = 0;
    Object.keys(d).forEach((t) => { if (beat(t)) p += d[t]; });
    return p;
  }

  function nearest(list, r, c) {
    let best = 999;
    list.forEach((q) => { const d = Math.abs(q.r - r) + Math.abs(q.c - c); if (d < best) best = d; });
    return best;
  }

  // ---------- décision ----------
  function chooseMove(state, mem, level, rng) {
    const view = buildView(state, mem);
    const { me, mode } = view;
    const myPieces = state.pieces.filter((p) => p.owner === me);
    const enemies = state.pieces.filter((p) => state.players[p.owner].team !== view.myTeam);
    const myFlag = myPieces.find((p) => p.type === "oeuf");
    const myKing = myPieces.find((p) => p.type === "roi");
    const protect = mode === "kinghunt" ? myKing : myFlag;
    const relics = state.board.relics || [];
    const round = state.round;
    // impatience : plus la partie s'endort, plus l'IA ose attaquer
    const quiet = round - (mem.lastCombatRound || 0);
    const impatience = Math.min(14, Math.max(0, (quiet - 5) * 0.9));
    const cands = [];
    myPieces.forEach((p) => {
      const dests = state.legal[p.id];
      if (!dests) return;
      dests.forEach(([r, c]) => {
        const target = view.grid.get(K(r, c));
        let score = 0;
        const parts = {};
        if (target && state.players[target.owner].team !== view.myTeam) {
          const a = evAttack(view, p, target, level, rng);
          let bonus = a.ev * level.aggression + a.info;
          // défense de l'œuf (ou du roi)
          if (protect) {
            const dProt = Math.abs(target.r - protect.r) + Math.abs(target.c - protect.c);
            if (dProt <= 3) bonus += 18 * level.flagGuard;
          }
          // chasse aux pièces immobiles avec un nain
          if (p.type === "nain" && !target.moved && round > 8) bonus += 5 * level.hunt;
          if (!a.known && p.type !== "nain" && !target.moved && round > 8) bonus -= 2 * level.hunt * (1 - a.pWin);
          score += bonus + impatience * (a.pLose < 0.65 ? 1 : 0.3);
        } else {
          // simple déplacement : progression et sécurité
          const cur = nearest(enemies, p.r, p.c);
          const nxt = nearest(enemies, r, c);
          let prog = (cur - nxt) * 1.6 * level.progress * (1 + impatience * 0.15);
          // les pièces fortes attendent un peu avant de foncer
          const rk = PIECES[p.type].rank;
          if (rk >= 8 && round < 10 && impatience === 0) prog *= 0.3;
          if (state.settings.mode === "kinghunt" && p.type === "roi" && impatience < 5) prog *= 0.2;
          score += prog;
          // reliques
          if (relics.length) {
            const onRelic = (x, y) => relics.some((q) => q.r === x && q.c === y);
            if (onRelic(r, c)) score += 9;
            if (onRelic(p.r, p.c)) score -= 7;
            if (!onRelic(r, c)) {
              const dNow = Math.min(...relics.map((q) => Math.abs(q.r - p.r) + Math.abs(q.c - p.c)));
              const dNew = Math.min(...relics.map((q) => Math.abs(q.r - r) + Math.abs(q.c - c)));
              score += (dNow - dNew) * 1.2;
            }
          }
          // sécurité à l'arrivée
          let worst = 0;
          DIRS.forEach(([dr, dc]) => {
            const e = view.grid.get(K(r + dr, c + dc));
            if (!e || state.players[e.owner].team === view.myTeam) return;
            const t = threatOn(view, e, p.type);
            if (t > worst) worst = t;
          });
          score -= val(p.type, mode) * worst * 0.7 * level.danger;
          // éviter de tourner en rond
          if (mem.lastFrom[p.id] === K(r, c)) score -= 2.5;
          // l'œuf et les tartes ne bougent pas, mais les défenseurs restent autour de l'œuf
          if (protect && p.id !== protect.id) {
            const dBefore = Math.abs(p.r - protect.r) + Math.abs(p.c - protect.c);
            const dAfter = Math.abs(r - protect.r) + Math.abs(c - protect.c);
            const threat = nearest(enemies.filter((e) => e.moved || view.typeOf(e)), protect.r, protect.c);
            if (threat <= 5 && dBefore <= 3 && dAfter > dBefore) score -= 4 * level.flagGuard;
            if (threat <= 5 && dAfter < dBefore && dAfter >= 1) score += 2 * level.flagGuard;
          }
          // le roi reste prudent
          if (p.type === "roi" && round < 25 && nxt < cur) score -= 1.5 * level.danger;
        }
        score += gauss(rng) * level.noise;
        cands.push({ pieceId: p.id, to: [r, c], score });
      });
    });
    if (!cands.length) return null;
    cands.sort((a, b) => b.score - a.score);
    return cands[0];
  }

  // ---------- pouvoirs ----------
  function choosePower(state, mem, level, rng) {
    if (!state.settings.powers) return null;
    const me = state.you;
    const pl = state.players[me];
    if (pl.charges <= 0 || state.turnPowerUsed) return null;
    if (state.round < 3) return null;
    if (rng() > level.powerChance) return null;
    const house = HOUSES[pl.house % HOUSES.length];
    const view = buildView(state, mem);
    const mine = state.pieces.filter((p) => p.owner === me);
    const enemies = state.pieces.filter((p) => state.players[p.owner].team !== view.myTeam);
    const protect = view.mode === "kinghunt" ? mine.find((p) => p.type === "roi") : mine.find((p) => p.type === "oeuf");
    const pid = house.power.id;
    if (pid === "longuevue") {
      const unk = enemies.filter((e) => !view.typeOf(e));
      if (!unk.length) return null;
      // la pièce inconnue la plus proche de mon objectif à protéger, ou de ma pièce la plus précieuse
      const ref = protect || mine[0];
      unk.sort((a, b) => (Math.abs(a.r - ref.r) + Math.abs(a.c - ref.c)) - (Math.abs(b.r - ref.r) + Math.abs(b.c - ref.c)) + (b.moved ? 1 : 0) - (a.moved ? 1 : 0));
      return { power: pid, data: { target: unk[0].id } };
    }
    if (pid === "sieste") {
      if (!protect) return null;
      const threats = enemies.filter((e) => e.moved || view.typeOf(e));
      threats.sort((a, b) => (Math.abs(a.r - protect.r) + Math.abs(a.c - protect.c)) - (Math.abs(b.r - protect.r) + Math.abs(b.c - protect.c)));
      const t = threats[0];
      if (!t || Math.abs(t.r - protect.r) + Math.abs(t.c - protect.c) > 5) return null;
      const kt = view.typeOf(t);
      if (kt && !PIECES[kt].mobile) return null;
      return { power: pid, data: { target: t.id } };
    }
    if (pid === "ruee") {
      // seulement si un coup très rentable existe
      const best = chooseMove(state, mem, level, rng);
      if (best && best.score > 14 && state.round > 6) return { power: pid, data: {} };
      return null;
    }
    if (pid === "theatre") {
      const precious = mine.filter((p) => p.type && val(p.type, view.mode) >= 8);
      for (const p of precious) {
        const danger = enemies.find((e) => Math.abs(e.r - p.r) + Math.abs(e.c - p.c) === 1 && view.typeOf(e) && threatOn(view, e, p.type) === 1);
        if (!danger) continue;
        const sac = mine.filter((q) => q.id !== p.id && q.type && PIECES[q.type].mobile && val(q.type, view.mode) <= 5)
          .sort((a, b) => (Math.abs(a.r - p.r) + Math.abs(a.c - p.c)) - (Math.abs(b.r - p.r) + Math.abs(b.c - p.c)))[0];
        if (sac) return { power: pid, data: { a: p.id, b: sac.id } };
      }
      return null;
    }
    return null;
  }

  // ---------- placement ----------
  function depthFn(state) {
    const arm = state.board.arms[state.you];
    const cells = arm.cells;
    const rs = cells.map((x) => x[0]), cs = cells.map((x) => x[1]);
    const minR = Math.min(...rs), maxR = Math.max(...rs), minC = Math.min(...cs), maxC = Math.max(...cs);
    const side = arm.side;
    return (r, c) => (side === "bottom" ? r - minR : side === "top" ? maxR - r : side === "left" ? maxC - c : c - minC);
  }

  function choosePlacement(state, level, rng) {
    const arm = state.board.arms[state.you];
    const cells = arm.cells.map((x) => [x[0], x[1]]);
    const mine = state.pieces.filter((p) => p.owner === state.you && p.type);
    const depthOf = depthFn(state);
    const maxD = Math.max(...cells.map(([r, c]) => depthOf(r, c)));
    const shuffle = (a) => { for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(rng() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; };
    const free = shuffle(cells.slice());
    const out = {};
    const take = (cell) => { const i = free.findIndex((x) => x[0] === cell[0] && x[1] === cell[1]); if (i >= 0) free.splice(i, 1); };
    const place = (p, cell) => { out[p.id] = cell; take(cell); };
    const pending = shuffle(mine.slice());

    if (level.placement === "random") {
      pending.forEach((p) => place(p, free[0]));
      return out;
    }
    const kingMode = state.settings.mode === "kinghunt";
    const flag = pending.find((p) => p.type === "oeuf");
    const bombs = pending.filter((p) => p.type === "tarte");
    const guarded = flag || pending.find((p) => p.type === "roi");
    let anchor = null;
    if (guarded) {
      const backCells = free.filter(([r, c]) => depthOf(r, c) >= (kingMode ? maxD - 1 : maxD));
      // aime les bords du camp
      backCells.sort((a, b) => {
        const edge = (cell) => {
          const others = cells.filter(([r, c]) => depthOf(r, c) === maxD).map((x) => x[0] + x[1] * 7);
          return others.length;
        };
        return edge(a) - edge(b);
      });
      anchor = backCells.length ? backCells[Math.floor(rng() * backCells.length)] : free[0];
      place(guarded, anchor);
    }
    const bombList = bombs.slice();
    if (anchor) {
      const neigh = free.filter(([r, c]) => Math.abs(r - anchor[0]) + Math.abs(c - anchor[1]) === 1);
      shuffle(neigh);
      while (bombList.length && neigh.length && !kingMode) place(bombList.shift(), neigh.shift());
    }
    // les tartes restantes : une en leurre devant, les autres en profondeur
    bombList.forEach((b, i) => {
      const pick = free.filter(([r, c]) => depthOf(r, c) === (i === 0 && level.placement === "smart" ? 1 : Math.min(maxD, 1 + Math.floor(rng() * 2))))[0] || free.filter(([r, c]) => depthOf(r, c) >= 1)[0] || free[0];
      place(b, pick);
    });
    // le reste : lutins et petites pièces devant, grosses pièces au milieu
    const rest = pending.filter((p) => !out[p.id]);
    const frontClass = (t) => t === "lutin" || t === "garde" || t === "archere" || t === "rat" || t === "fantome";
    const frontPieces = shuffle(rest.filter((p) => frontClass(p.type)));
    const midPieces = shuffle(rest.filter((p) => !frontClass(p.type)));
    // le roi et le dragon évitent la première ligne
    const frontSlots = free.filter(([r, c]) => depthOf(r, c) === 0);
    frontSlots.forEach((cell) => {
      let p = frontPieces.shift();
      if (!p) p = midPieces.find((q) => q.type !== "roi" && q.type !== "dragon") || midPieces[0];
      if (!p) return;
      const idx = midPieces.indexOf(p);
      if (idx >= 0) midPieces.splice(idx, 1);
      place(p, cell);
    });
    const left = frontPieces.concat(midPieces);
    shuffle(left);
    if (level.placement === "smart") {
      // nains vers le centre de l'armée, gros bras au milieu
      left.sort((a, b) => (PIECES[b.type].rank >= 7 ? 1 : 0) - (PIECES[a.type].rank >= 7 ? 1 : 0));
    }
    left.forEach((p) => place(p, free[0]));
    return out;
  }

  // ---------- point d'entrée ----------
  // Retourne { kind:"move", pieceId, to } | { kind:"power", power, data } | { kind:"place", placement } | null
  function act(state, mem, levelId, rng) {
    rng = rng || Math.random;
    const level = LEVELS[levelId] || LEVELS.normal;
    observe(mem, state);
    if (state.phase === "setup") {
      return { kind: "place", placement: choosePlacement(state, level, rng) };
    }
    if (state.phase !== "playing" || state.current !== state.you) return null;
    const pw = choosePower(state, mem, level, rng);
    if (pw) return { kind: "power", power: pw.power, data: pw.data };
    const mv = chooseMove(state, mem, level, rng);
    if (!mv) return null;
    mem.moveCount++;
    return { kind: "move", pieceId: mv.pieceId, to: mv.to };
  }

  function thinkDelay(levelId, slow, rng) {
    const lv = LEVELS[levelId] || LEVELS.normal;
    const [a, b] = lv.think;
    const base = a + (rng || Math.random)() * (b - a);
    return Math.round(base * (slow ? 2.4 : 1));
  }

  return { LEVELS, NAMES, newMemory, act, thinkDelay, observe, fight };
});

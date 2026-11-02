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
    beginner: {
      id: "beginner", label: "Œuf mollet", icon: "🥚", desc: "Débutant complet, avance presque au hasard et attaque sans réfléchir.",
      noise: 55, aggression: 0.15, danger: 0.0, progress: 0.35, useKnowledge: 0.2, powerChance: 0.02, placement: "random", think: [300, 600], flagGuard: 0, hunt: 0,
    },
    easy: {
      id: "easy", label: "Petit Rat", icon: "🐀", desc: "Joue un peu au hasard, tombe dans tous les pièges.",
      noise: 14, aggression: 0.5, danger: 0.0, progress: 0.8, useKnowledge: 0.55, powerChance: 0.04, placement: "random", think: [350, 700], flagGuard: 0, hunt: 0,
    },
    normal: {
      id: "normal", label: "Chevalier", icon: "🛡️", desc: "Évalue les risques et attaque quand c'est rentable.",
      noise: 6, aggression: 0.9, danger: 0.4, progress: 1.0, useKnowledge: 1, powerChance: 0.25, placement: "mixed", think: [500, 1000], flagGuard: 0.6, hunt: 0.5,
    },
    captain: {
      id: "captain", label: "Capitaine", icon: "🎖️", desc: "Joue prudemment, garde son œuf et profite des erreurs.",
      noise: 5.5, aggression: 0.95, danger: 0.5, progress: 1.0, useKnowledge: 1, powerChance: 0.4, placement: "mixed", think: [600, 1150], flagGuard: 0.7, hunt: 0.65,
    },
    hard: {
      id: "hard", label: "Sorcier", icon: "🧙", desc: "Protège son œuf, piste les pièces immobiles et bluffe un peu.",
      noise: 3.5, aggression: 1.0, danger: 0.75, progress: 1.0, useKnowledge: 1, powerChance: 0.6, placement: "smart", think: [650, 1300], flagGuard: 1, hunt: 1,
    },
    expert: {
      id: "expert", label: "Dragon", icon: "🐲", desc: "Calcule tout, se souvient de tout, n'oublie jamais une tarte, et anticipe la riposte avant de jouer.",
      master: true, look: 1, adapt: true, noise: 0.8, aggression: 1.1, danger: 1.2, progress: 1.1, useKnowledge: 1, powerChance: 1, placement: "smart", think: [800, 1600], flagGuard: 1.5, hunt: 1.7,
    },
    master: {
      id: "master", label: "Roi Stratège", icon: "👑", desc: "Comprend vraiment le jeu. Il anticipe la riposte, tend des pièges défendus, bluffe, prépare des fourchettes et change de style à chaque partie. Il remarque aussi si tu attaques beaucoup ou si tu attends, et s'adapte.",
      master: true, look: 2, persona: true, adapt: true, noise: 0.15, aggression: 1.0, danger: 1.0, progress: 1.0, useKnowledge: 1, powerChance: 1, placement: "master", think: [900, 1800], flagGuard: 1.5, hunt: 1.5,
    },
  };

  const NAMES = ["Bouzelouf", "Tigrou", "Daddy", "Mommy", "Pupuce", "Zaza", "Khalamité", "BadGyal", "Yakak", "Maître Picut", "Tonton Gaufre", "Mamie Tartine"];

  function newMemory() { return { known: {}, lastSeq: 0, lastFrom: {}, moveCount: 0, lastCombatRound: 0, belief: {}, exposed: {}, lastSeen: {}, trail: {}, plan: null, lastMover: null, enemyAct: {}, tick: 0, grow: {}, opp: {}, persona: null, op: null }; }

  function rankOf(t) { return PIECES[t].rank; }
  function val(t, mode) {
    const p = PIECES[t];
    if (t === "oeuf") return 110;
    if (t === "roi" && mode === "kinghunt") return 80;
    // le Phénix renaît, le perdre coûte moins cher, le tuer rapporte moins
    return (p.phoenix ? p.cost * 0.6 : p.cost) + (p.mobile ? 1 : 0);
  }

  // résultat d'une attaque de a contre d : "win" | "lose" | "tie"
  function fight(a, d, mode, ba, bd) {
    const A = PIECES[a], D = PIECES[d];
    if (mode === "kinghunt" && a === "roi" && d === "roi") return "win";
    if (D.bomb) return A.miner ? "win" : "lose";
    if (d === "oeuf") return "win";
    if (A.bomber) return d === "roi" ? "lose" : "tie";
    if (a === "rat" && d === "roi") return "win";
    if (a === "roi" && d === "rat") return "lose";
    if (D.mirror) return "tie";
    if (A.assassin && D.rank <= 9) return "win";
    const ra = A.rank + (ba || 0), rd = D.rank + (bd || 0);
    if (ra > rd) return "win";
    if (ra < rd) return "lose";
    return "tie";
  }

  // bonus d'étendard d'une pièce, d'après les étendards alliés collés à elle (type connu de l'IA)
  function bannerBoost(view, p) {
    const t = view.typeOf(p);
    if (!t) return 0;
    const st = view.state.settings;
    let grow = 0;
    if (PIECES[t].grow) grow = Math.min(3, p.grow || (view.mem && view.mem.grow[p.id]) || 0);
    let ban = 0, ph = 0;
    for (const [dr, dc] of DIRS) {
      const q = view.grid.get(K(p.r + dr, p.c + dc));
      if (!q || q.owner !== p.owner) continue;
      const qt = view.typeOf(q);
      if (st.specialPieces && !PIECES[t].banner && qt === "etendard") ban = Number(st.bannerBoost) || 1;
      if (st.phalange && PIECES[t].mobile && qt === t) ph = 1;
    }
    return grow + Math.max(ban, ph);
  }

  // ce que le souffle d'un Bombardier emporterait autour de la cible, positif si ça touche surtout l'ennemi
  function splashValue(view, bomber, target) {
    let sum = 0;
    DIRS.forEach(([dr, dc]) => {
      const q = view.grid.get(K(target.r + dr, target.c + dc));
      if (!q || q.id === bomber.id) return;
      const t = view.typeOf(q);
      if (t === "roi" || t === "oeuf") return;
      const mine = view.state.players[q.owner].team === view.myTeam;
      const v = t ? val(t, view.mode) : 6;
      sum += mine ? -v * 1.1 : v;
    });
    return sum;
  }

  // Situation en conquête, le double jeu reliques et œuf
  function conquestCtx(state, view) {
    const relics = (state.board && state.board.relics) || [];
    if (state.settings.mode !== "conquest" || !relics.length) return null;
    const T = Number(state.settings.relicTarget) || 12;
    const me = state.players[view.me];
    let lead = 0, leaderSeat = -1;
    state.players.forEach((pl) => { if (!pl.eliminated && pl.team !== me.team && (pl.score || 0) > lead) { lead = pl.score || 0; leaderSeat = pl.seat; } });
    // urgence, grande quand un adversaire approche de l'objectif ou me dépasse
    const near = lead / T;
    const behind = Math.max(0, lead - (me.score || 0)) / T;
    const u = Math.max(0, Math.min(3, near * 2.5 + behind * 2 + (lead > 0 ? 0.3 : 0)));
    const held = (pl) => relics.filter((q) => { const o = view.grid.get(K(q.r, q.c)); return o && o.owner === pl; }).length;
    const mineHeld = relics.filter((q) => { const o = view.grid.get(K(q.r, q.c)); return o && state.players[o.owner].team === view.myTeam; }).length;
    const enemyCells = relics.filter((q) => { const o = view.grid.get(K(q.r, q.c)); return o && state.players[o.owner].team !== view.myTeam; });
    return { relics, T, lead, leaderSeat, u, mineHeld, enemyCells, held, ahead: (me.score || 0) >= lead && (me.score || 0) > 0 };
  }

  // Termes ajoutés au score d'un coup, communs aux deux niveaux de réflexion
  function extraTerms(view, ctx, level, p, r, c, target) {
    let t = 0;
    const K2 = 1;
    const settings = view.state.settings;
    const pd = PIECES[p.type];
    if (target && view.state.players[target.owner].team !== view.myTeam) {
      if (ctx) {
        const onRelic = ctx.relics.some((q) => q.r === target.r && q.c === target.c);
        if (onRelic) t += K2 * (7 + 6 * ctx.u) * (0.5 + 0.5 * level.hunt);
        if (target.owner === ctx.leaderSeat) t += K2 * 2.5 * ctx.u;
      }
      if (pd.bomber) t += splashValue(view, p, target) * 0.8;
    } else {
      if (ctx) {
        const onRelic = (x, y) => ctx.relics.some((q) => q.r === x && q.c === y);
        if (onRelic(r, c)) t += K2 * 3 * ctx.u;
        if (onRelic(p.r, p.c) && !onRelic(r, c)) t -= K2 * (2 + 2 * ctx.u);
        // aller déloger celui qui tient une relique, surtout s'il est en tête
        if (ctx.enemyCells.length && pd.mobile && p.type !== "oeuf" && (PIECES[p.type].rank >= 3 || pd.long)) {
          const d0 = Math.min(...ctx.enemyCells.map((q) => Math.abs(q.r - p.r) + Math.abs(q.c - p.c)));
          const d1 = Math.min(...ctx.enemyCells.map((q) => Math.abs(q.r - r) + Math.abs(q.c - c)));
          t += K2 * (d0 - d1) * (0.5 + 0.9 * ctx.u) * level.hunt;
        }
      }
      if (settings.specialPieces) {
        if (pd.sentinel) {
          const range = Number(settings.sentinelRange) || 1;
          view.state.pieces.forEach((q) => {
            if (view.state.players[q.owner].team === view.myTeam || view.typeOf(q)) return;
            if (Math.abs(q.r - r) + Math.abs(q.c - c) <= range) t += q.moved ? 2 : 3;
          });
        }
        if (pd.messenger && settings.messengerBonus) t += 2;
        if (pd.banner) {
          const near = (x, y) => DIRS.reduce((n, [dr, dc]) => { const q = view.grid.get(K(x + dr, y + dc)); return n + (q && q.owner === p.owner && PIECES[q.type] && PIECES[q.type].mobile ? 1 : 0); }, 0);
          t += (near(r, c) - near(p.r, p.c)) * 0.9;
        } else if (pd.mobile) {
          const nb = (x, y) => DIRS.some(([dr, dc]) => { const q = view.grid.get(K(x + dr, y + dc)); return q && q.owner === p.owner && q.type === "etendard"; });
          if (nb(r, c) && !nb(p.r, p.c)) t += 0.7;
        }
      }
    }
    return t;
  }

  function rnd(rng, a, b) { return a + rng() * (b - a); }
  function gauss(rng) { return (rng() + rng() + rng() - 1.5) * 1.6; }

  // ---------- observation ----------
  function observe(mem, state) {
    const me = state.you;
    const myTeam = state.players[me].team;
    const byId = {};
    state.pieces.forEach((p) => { byId[p.id] = p; });
    (state.events || []).forEach((ev) => {
      if (ev.seq <= mem.lastSeq) return;
      mem.lastSeq = Math.max(mem.lastSeq, ev.seq);
      if (ev.kind === "combat") {
        mem.lastCombatRound = Math.max(mem.lastCombatRound || 0, ev.round || 0);
        // le Gladiateur grandit à chaque victoire, on s'en souvient même quand il redevient inconnu
        if (ev.attacker && ev.attacker.type === "gladiateur" && ev.result === "attWins") mem.grow[ev.attacker.id] = Math.min(3, (mem.grow[ev.attacker.id] || 0) + 1);
        if (ev.defender && ev.defender.type === "gladiateur" && ev.result === "defWins") mem.grow[ev.defender.id] = Math.min(3, (mem.grow[ev.defender.id] || 0) + 1);
        // modèle de l'adversaire, à quelle fréquence attaque-t-il plutôt que d'avancer
        if (ev.attacker && state.players[ev.attacker.owner] && state.players[ev.attacker.owner].team !== myTeam) { const o = mem.opp[ev.attacker.owner] || (mem.opp[ev.attacker.owner] = { att: 0, mov: 0 }); o.att++; }
        if (ev.attacker && ev.attacker.type) mem.known[ev.attacker.id] = ev.attacker.type;
        if (ev.defender && ev.defender.type) mem.known[ev.defender.id] = ev.defender.type;
        // mes pièces qui ont survécu à un combat sont connues des adversaires
        [ev.attacker, ev.defender].forEach((x) => {
          if (x && x.owner != null && state.players[x.owner].team === myTeam && byId[x.id]) mem.exposed[x.id] = true;
        });
      } else if (ev.kind === "move" && ev.owner === state.you) {
        mem.lastFrom[ev.pieceId] = K(ev.from.r, ev.from.c);
        const tr = mem.trail[ev.pieceId] || (mem.trail[ev.pieceId] = []);
        tr.push(K(ev.from.r, ev.from.c)); if (tr.length > 8) tr.shift();
        mem.lastMover = ev.pieceId;
      } else if (ev.kind === "move" && state.players[ev.owner].team !== myTeam) {
        const oo = mem.opp[ev.owner] || (mem.opp[ev.owner] = { att: 0, mov: 0 }); oo.mov++;
        const ea = mem.enemyAct[ev.pieceId] || (mem.enemyAct[ev.pieceId] = { moves: 0, last: 0 });
        ea.moves++; ea.last = state.round;
        learnFromEnemyMove(mem, state, ev, byId);
      }
    });
    state.pieces.forEach((p) => { if (p.type) mem.known[p.id] = p.type; if (p.grow) mem.grow[p.id] = Math.max(mem.grow[p.id] || 0, p.grow); });
  }

  // Un adversaire qui s'approche (ou s'éloigne) d'une de mes pièces révèle un peu son rang.
  function learnFromEnemyMove(mem, state, ev, byId) {
    const mover = byId[ev.pieceId];
    if (!mover || mover.type || mem.known[mover.id]) return;
    const myTeam = state.players[state.you].team;
    const near = (r, c) => {
      const out = [];
      DIRS.forEach(([dr, dc]) => {
        const q = state.pieces.find((x) => x.r === r + dr && x.c === c + dc);
        if (q && state.players[q.owner].team === myTeam && q.type) out.push(q);
      });
      return out;
    };
    const after = near(ev.to.r, ev.to.c);
    const before = near(ev.from.r, ev.from.c);
    const b = mem.belief[mover.id] || (mem.belief[mover.id] = {});
    if (Math.abs(ev.to.r - ev.from.r) + Math.abs(ev.to.c - ev.from.c) > 1) b._long = true;
    const adj = (list, f) => list.forEach((q) => {
      Object.keys(PIECES).forEach((t) => {
        if (!PIECES[t].mobile) return;
        const iBeatIt = fight(q.type, t, state.settings.mode) === "win";
        const itBeatsMe = fight(t, q.type, state.settings.mode) === "win";
        b[t] = (b[t] || 1) * f(iBeatIt, itBeatsMe);
      });
    });
    // il vient se coller à une de mes pièces : probablement parce qu'il la bat
    adj(after, (iBeatIt, itBeatsMe) => (itBeatsMe ? 1.5 : iBeatIt ? 0.55 : 1));
    // il quitte le voisinage d'une de mes pièces qu'il craint
    adj(before.filter((q) => !after.includes(q)), (iBeatIt, itBeatsMe) => (iBeatIt ? 1.35 : itBeatsMe ? 0.8 : 1));
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
      const counts = Object.assign({}, (state.armyCountsBy && state.armyCountsBy[o]) || state.armyCounts);
      state.graveyard.forEach((g) => { if (g.owner === o && g.type && counts[g.type] > 0) counts[g.type]--; });
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
    const ba = bannerBoost(view, mine), bd = bannerBoost(view, target);
    const consider = (t, prob) => {
      const r = fight(myT, t, view.mode, ba, t === "etendard" ? 0 : bd);
      const vt = val(t, view.mode);
      if (r === "win") { ev += prob * (vt + 0.5 - (t === "bouffon" ? jesterCost(vm) : 0)); pWin += prob; }
      else if (r === "lose") { ev -= prob * (vm - (myT === "bouffon" ? jesterCost(vt) : 0)); pLose += prob; }
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

  // un Bouffon battu endort son vainqueur, ça coûte un peu de temps et expose la pièce
  function jesterCost(v) { return 1.5 + 0.25 * v; }

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
  // ---------- mémoire des plans et des trajets (tous niveaux) ----------
  // Pénalité quand une pièce retourne sur une case qu'elle vient de quitter (tourner en rond).
  function trailPenalty(mem, p, r, c, strength) {
    const tr = mem.trail[p.id];
    if (!tr || !tr.length) return 0;
    const k = K(r, c);
    let pen = 0;
    for (let i = tr.length - 1, age = 0; i >= 0; i--, age++) {
      if (tr[i] === k) { pen = Math.max(pen, strength * (age < 2 ? 1 : age < 4 ? 0.6 : 0.3)); }
    }
    return pen;
  }

  // Le plan en cours (une pièce, une cible) est conservé tant qu'il reste valable.
  function planValid(state, mem, view) {
    const pl = mem.plan;
    if (!pl) return null;
    if (state.round - pl.since > 14) return null;
    const mover = state.pieces.find((x) => x.id === pl.pieceId && x.owner === view.me);
    const tgt = state.pieces.find((x) => x.id === pl.targetId);
    if (!mover || !tgt || !state.legal[mover.id]) return null;
    return { mover, tgt, pl };
  }

  // Distance réelle (en contournant lacs et ruines) jusqu'à une case, calculée une fois par tour.
  function pathMap(view, r0, c0) {
    const key = "pm" + r0 + "," + c0;
    if (view.cache && view.cache.has(key)) return view.cache.get(key);
    const b = view.state.board;
    const blocked = (r, c) => {
      if (r < 0 || c < 0 || r >= b.rows || c >= b.cols) return true;
      const t = b.terrain[r][c];
      if (!(t === "plain" || t === "forest" || t === "marsh")) return true;
      return (b.ruins || []).some(([a, d]) => a === r && d === c);
    };
    const m = new Map([[K(r0, c0), 0]]);
    const q = [[r0, c0]];
    for (let i = 0; i < q.length; i++) {
      const [r, c] = q[i]; const d = m.get(K(r, c));
      DIRS.forEach(([dr, dc]) => {
        const nr = r + dr, nc = c + dc, k = K(nr, nc);
        if (blocked(nr, nc) || m.has(k)) return;
        m.set(k, d + 1); q.push([nr, nc]);
      });
    }
    if (view.cache) view.cache.set(key, m);
    return m;
  }
  function stepGain(view, tgt, p, r, c) {
    const m = pathMap(view, tgt.r, tgt.c);
    const a = m.get(K(p.r, p.c)), b = m.get(K(r, c));
    if (a == null || b == null) return (Math.abs(tgt.r - p.r) + Math.abs(tgt.c - p.c)) - (Math.abs(tgt.r - r) + Math.abs(tgt.c - c));
    return a - b;
  }

  // Riposte. Quand une pièce ennemie connue est dangereuse (un Roi qui ravage, un gros bras près de l'œuf),
  // la pièce qui la bat à coup sûr, la moins précieuse possible, part la chercher. Le Rat contre le Roi en est l'exemple.
  function counterPlan(state, mem, view, valueOf) {
    let best = null, bestS = 2;
    view.enemies.forEach((e) => {
      const t = view.typeOf(e);
      if (!t || !PIECES[t].mobile || e.frozen > 0 && false) return;
      const V = valueOf(t);
      const dProt = view.protect ? Math.abs(e.r - view.protect.r) + Math.abs(e.c - view.protect.c) : 99;
      const big = t === "roi" || V >= 10;
      if (!big && dProt > 5) return;
      view.mine.forEach((p) => {
        if (!state.legal[p.id] || !PIECES[p.type].mobile) return;
        if (fight(p.type, t, view.mode) !== "win") return;
        if (p.type === "rat" && t !== "roi") return;
        const pm = pathMap(view, e.r, e.c).get(K(p.r, p.c));
        const d = pm == null ? Math.abs(p.r - e.r) + Math.abs(p.c - e.c) : pm;
        const sc = (V * (big ? 1 : 0.6)) / (1 + 0.22 * d) - valueOf(p.type) * 0.18;
        if (sc > bestS) { bestS = sc; best = { mover: p, tgt: e, urgent: true }; }
      });
    });
    return best;
  }

  // Choisit (ou garde) un plan simple. Retourne { mover, tgt } ou null.
  function pickPlan(state, mem, view, scoreFn, valueOf) {
    const ctr = valueOf ? counterPlan(state, mem, view, valueOf) : null;
    if (ctr) { mem.plan = { pieceId: ctr.mover.id, targetId: ctr.tgt.id, since: state.round, urgent: true }; return ctr; }
    const keep = planValid(state, mem, view);
    if (keep) {
      const s = scoreFn(keep.mover, keep.tgt);
      if (s > 0.5) return keep;
    }
    let best = null, bestS = 1.5;
    view.mine.forEach((p) => {
      if (!state.legal[p.id] || !PIECES[p.type].mobile) return;
      view.enemies.forEach((e) => {
        const s = scoreFn(p, e);
        if (s > bestS) { bestS = s; best = { mover: p, tgt: e }; }
      });
    });
    if (best) mem.plan = { pieceId: best.mover.id, targetId: best.tgt.id, since: state.round };
    else mem.plan = null;
    return best;
  }

  function chooseMove(state, mem, level, rng) {
    const view = masterView(state, mem);
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
    // plan suivi : une pièce, une cible, tant que ça reste intéressant
    const planScore = (p, e) => {
      if (!PIECES[p.type].mobile || p.type === "roi" && mode !== "kinghunt" && round < 30) return 0;
      const a = evAttack(view, p, e, level, rng);
      const d = Math.abs(p.r - e.r) + Math.abs(p.c - e.c);
      return (a.ev * 0.6 + a.info * 0.5 - 0.05 * Math.max(0, dangerAt(view, mem, p, p.r, p.c, null, null)) * val(p.type, mode)) / (1 + 0.2 * d);
    };
    const plan = level.danger > 0 ? pickPlan(state, mem, view, planScore, (t) => val(t, mode)) : null;
    const cq = conquestCtx(state, view);
    myPieces.forEach((p) => {
      const dests = state.legal[p.id];
      if (!dests) return;
      const Vp = val(p.type, mode);
      const curDanger = level.danger > 0 ? dangerAt(view, mem, p, p.r, p.c, null, null) : 0;
      const vac = K(p.r, p.c);
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
          // ne pas se faire reprendre juste après (mémoire de ce que je sais des voisins)
          if (a.pWin > 0 && level.danger > 0) score -= Vp * dangerAt(view, mem, p, r, c, target.id, vac) * a.pWin * 0.5 * level.danger;
          if (plan && plan.mover.id === p.id && plan.tgt.id === target.id) score += plan.urgent ? 14 : 3;
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
          // sécurité à l'arrivée (adjacents et lignes de tir), comparée à la case de départ
          let worst = 0;
          DIRS.forEach(([dr, dc]) => {
            const e = view.grid.get(K(r + dr, c + dc));
            if (!e || state.players[e.owner].team === view.myTeam) return;
            const t = threatOn(view, e, p.type);
            if (t > worst) worst = t;
          });
          if (level.danger > 0) {
            const dgNew = dangerAt(view, mem, p, r, c, null, vac);
            score -= Vp * Math.max(worst * 0.5, dgNew) * 0.7 * level.danger * (plan && plan.urgent && plan.mover.id === p.id ? 0.1 : 1);
            // une pièce menacée qui se met à l'abri
            if (curDanger > 0.3 && dgNew < curDanger) score += Vp * (curDanger - dgNew) * 0.6 * level.danger;
          } else score -= Vp * worst * 0.7 * level.danger;
          // éviter de tourner en rond (mémoire des dernières cases)
          score -= trailPenalty(mem, p, r, c, level.danger > 0 ? 3.4 : 1.5);
          // plan en cours, on avance vers la cible
          if (plan && plan.mover.id === p.id) {
            score += stepGain(view, plan.tgt, p, r, c) * (plan.urgent ? 12 : 1.8);
          } else if (mem.lastMover === p.id && level.danger > 0) score += 0.6;
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
        if (level.useKnowledge >= 0.55) score += extraTerms(view, cq, level, p, r, c, target);
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
      const best = chooseMoveAny(state, mem, level, rng);
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

    if (level.placement === "master" && TUNE.place === "master") return choosePlacementMaster(state, level, rng);
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
    const frontClass = (t) => t === "gladiateur" || t === "bouffon" || t === "escargot" || t === "lutin" || t === "garde" || t === "archere" || t === "rat" || t === "fantome" || t === "chauvesouris" || t === "cavalier";
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

  // =====================================================================
  // IA STRATÈGE (niveau maximal)
  // Elle raisonne comme un bon joueur humain.
  //  - elle estime ce que cache chaque pièce adverse (pièces restantes, mouvements,
  //    profondeur dans le camp, voisinage de tartes, comportement face à ses pièces)
  //  - elle donne une valeur à chaque pièce selon son rôle (Œuf, Roi, Rat tueur de roi,
  //    Nain démineur tant qu'il reste des tartes, Dragon...)
  //  - elle protège ses pièces clés et traque celles de l'adversaire
  //  - elle mesure le danger de chaque case d'arrivée (voisins, lutins en ligne)
  // =====================================================================
  // Réglages de l'IA stratège (obtenus par parties d'entraînement contre les autres niveaux)
  const TUNE = { prog: 0.7, danger: 1.6, scout: 4, aggr: 1.4, hunt: 1, lossMul: 1.5, eggW: 0.4, eggV: 45, revealPen: 0.12, place: "master" };
  if (typeof process !== "undefined" && process.env && process.env.MTUNE) Object.assign(TUNE, JSON.parse(process.env.MTUNE));
  function depthFnFor(state, seat) {
    const arm = state.board.arms[seat];
    const cells = arm.cells;
    const rs = cells.map((x) => x[0]), cs = cells.map((x) => x[1]);
    const minR = Math.min(...rs), maxR = Math.max(...rs), minC = Math.min(...cs), maxC = Math.max(...cs);
    const side = arm.side;
    const maxD = Math.max(...cells.map(([r, c]) => (side === "bottom" ? r - minR : side === "top" ? maxR - r : side === "left" ? maxC - c : c - minC)));
    return { max: Math.max(1, maxD), at: (r, c) => (side === "bottom" ? r - minR : side === "top" ? maxR - r : side === "left" ? maxC - c : c - minC) };
  }

  function masterView(state, mem) {
    const view = buildView(state, mem);
    view.mem = mem;
    view.portalTwin = new Map();
    ((state.board && state.board.portals) || []).forEach((pt) => { view.portalTwin.set(K(pt.a.r, pt.a.c), pt.b); view.portalTwin.set(K(pt.b.r, pt.b.c), pt.a); });
    view.cache = new Map();
    view.depth = {};
    view.enemies = state.pieces.filter((p) => state.players[p.owner].team !== view.myTeam);
    view.mine = state.pieces.filter((p) => p.owner === view.me);
    view.allies = state.pieces.filter((p) => state.players[p.owner].team === view.myTeam);
    const poolSum = (t) => view.enemyOwners.reduce((s, o) => s + ((view.pools[o] && view.pools[o][t]) || 0), 0);
    let kingKnownAlive = view.enemies.some((e) => view.typeOf(e) === "roi");
    view.enemyKingAlive = kingKnownAlive || poolSum("roi") > 0;
    view.enemyBombs = view.enemies.filter((e) => view.typeOf(e) === "tarte").length + poolSum("tarte");
    view.myKing = view.mine.find((p) => p.type === "roi") || null;
    view.myFlag = view.mine.find((p) => p.type === "oeuf") || null;
    view.protect = view.mode === "kinghunt" ? view.myKing : view.myFlag;
    view.enemyRatAlive = view.enemies.some((e) => view.typeOf(e) === "rat") || poolSum("rat") > 0;
    // grille d'obstacles
    view.blocked = (r, c) => {
      const b = state.board;
      if (r < 0 || c < 0 || r >= b.rows || c >= b.cols) return true;
      const t = b.terrain[r][c];
      if (!(t === "plain" || t === "forest" || t === "marsh")) return true;
      return b.ruins.some(([a, d]) => a === r && d === c);
    };
    return view;
  }

  function depthOfCell(view, owner, r, c) {
    if (!view.depth[owner]) view.depth[owner] = depthFnFor(view.state, owner);
    return view.depth[owner];
  }

  // Valeur d'une pièce dans la partie (selon son rôle)
  function roleValue(view, type, mine) {
    const mode = view.mode;
    if (type === "oeuf") return TUNE.eggV;
    if (type === "roi") return mode === "kinghunt" ? 130 : 24;
    if (type === "tarte") return 5;
    const p = PIECES[type];
    let v = (p.phoenix ? p.cost * 0.6 : p.cost) + 1;
    if (type === "sentinelle") v += 2;
    if (type === "rat") {
      // le Rat est le seul à pouvoir tuer le Roi
      if (mine ? view.enemyKingAlive : !!view.myKing) v += mode === "kinghunt" ? 30 : 14;
      else v -= 1;
    }
    if (type === "nain" && mode !== "kinghunt") {
      const bombs = mine ? view.enemyBombs : view.mine.filter((x) => x.type === "tarte").length;
      v += Math.min(8, bombs * 1.5);
    }
    if (type === "dragon" && mine && !view.enemyKingAlive) v += 3;
    return v;
  }

  // Répartition de probabilité du contenu d'une pièce adverse inconnue
  function distM(view, mem, p) {
    const cached = view.cache.get("d" + p.id);
    if (cached) return cached;
    const pool = view.pools[p.owner] || {};
    const state = view.state;
    const belief = mem.belief[p.id] || {};
    const unknownOfOwner = state.pieces.filter((q) => q.owner === p.owner && !view.typeOf(q));
    const unmoved = unknownOfOwner.filter((q) => !q.moved);
    let immTotal = 0;
    Object.keys(pool).forEach((t) => { if (!PIECES[t].mobile && pool[t] > 0) immTotal += pool[t]; });
    const w = {};
    let mobTot = 0, immTot = 0;
    const longOnly = belief._long;
    Object.keys(pool).forEach((t) => {
      const n = pool[t];
      if (n <= 0) return;
      const d = PIECES[t];
      if (d.mobile) {
        if (longOnly && !(d.long || d.ghost || d.reach)) return;
        const x = n * (belief[t] || 1);
        w[t] = x; mobTot += x;
      } else if (!p.moved && !longOnly) {
        let x = n;
        if (t === "oeuf") {
          const df = depthOfCell(view, p.owner);
          const dpt = df.at(p.r, p.c) / df.max;
          let adj = 0;
          DIRS.forEach(([dr, dc]) => { const q = view.grid.get(K(p.r + dr, p.c + dc)); if (q && q.owner === p.owner && !q.moved && !view.typeOf(q)) adj++; });
          x = n * (0.4 + 1.8 * dpt) * (1 + 0.3 * adj) * TUNE.eggW;
        }
        w[t] = x; immTot += x;
      }
    });
    if (p.moved || longOnly) { immTot = 0; }
    const out = {};
    if (!mobTot && !immTot) {
      Object.keys(PIECES).forEach((t) => { if (PIECES[t].mobile) out[t] = 1 / 11; });
    } else {
      // part d'immobiles parmi les pièces qui n'ont jamais bougé
      let fImm = 0;
      if (!p.moved && !longOnly && immTot > 0) fImm = mobTot > 0 ? Math.min(0.97, immTotal / Math.max(1, unmoved.length)) : 1;
      Object.keys(w).forEach((t) => {
        if (PIECES[t].mobile) out[t] = mobTot ? (w[t] / mobTot) * (1 - fImm) : 0;
        else out[t] = immTot ? (w[t] / immTot) * fImm : 0;
      });
    }
    view.cache.set("d" + p.id, out);
    return out;
  }

  function dMap(view, mem, e) {
    const k = view.typeOf(e);
    return k ? { [k]: 1 } : distM(view, mem, e);
  }

  function proxBonus(view, e, type) {
    // un ennemi mobile près de ce que je dois protéger devient une cible prioritaire
    if (!view.protect || !PIECES[type].mobile) return 0;
    const d = Math.abs(e.r - view.protect.r) + Math.abs(e.c - view.protect.c);
    return Math.max(0, 4 - d) * 7;
  }

  function evAttackM(view, mem, p, e, level) {
    const myT = p.type;
    const vm = roleValue(view, myT, true);
    const d = dMap(view, mem, e);
    let ev = 0, pWin = 0, pLose = 0, expV = 0;
    Object.keys(d).forEach((t) => {
      const pr = d[t];
      if (pr <= 0) return;
      const r = fight(myT, t, view.mode, bannerBoost(view, p), t === "etendard" ? 0 : bannerBoost(view, e));
      const vt = roleValue(view, t, false) + proxBonus(view, e, t);
      expV += pr * vt;
      if (r === "win") { ev += pr * (vt - (t === "bouffon" ? jesterCost(vm) : 0)); pWin += pr; }
      else if (r === "lose") { ev -= pr * (vm * (view.lossMul || TUNE.lossMul) - (myT === "bouffon" ? jesterCost(vt) : 0)); pLose += pr; }
      else ev += pr * (vt - vm);
    });
    const known = !!view.typeOf(e);
    // apprendre ce que cache une pièce vaut quelque chose (surtout avec une pièce bon marché)
    let info = 0;
    if (!known) info = (1 + Math.min(6, 0.3 * expV)) * (vm <= 6 ? 1 : 0.4) * Math.max(pLose, 0.3);
    // une pièce clé qui gagne se dévoile
    let reveal = 0;
    if (pWin > 0 && view.state.settings.survivorsRevealed && !mem.exposed[p.id] && (myT === "roi" || myT === "dragon" || myT === "sorcier" || TUNE.revealPen > 0.2)) reveal = TUNE.revealPen * vm * pWin;
    return { ev, pWin, pLose, expV, known, info, reveal };
  }

  function clearLine(view, e, r, c, vacated) {
    if (e.r !== r && e.c !== c) return false;
    const dr = Math.sign(r - e.r), dc = Math.sign(c - e.c);
    let x = e.r + dr, y = e.c + dc;
    while (x !== r || y !== c) {
      if (view.blocked(x, y)) return false;
      const q = view.grid.get(K(x, y));
      if (q && K(x, y) !== vacated) return false;
      x += dr; y += dc;
    }
    return true;
  }

  // Probabilité qu'une de mes pièces (type myType) soit battue si elle se trouve en (r,c)
  function dangerAt(view, mem, my, r, c, skipId, vacated) {
    let keep = 1;
    view.enemies.forEach((e) => {
      if (e.id === skipId || e.frozen > 0) return;
      const dist = Math.abs(e.r - r) + Math.abs(e.c - c);
      if (dist === 0) return;
      const known = view.typeOf(e);
      const d = dMap(view, mem, e);
      let pThreat = 0;
      Object.keys(d).forEach((t) => {
        const def = PIECES[t];
        if (!def.mobile || d[t] <= 0) return;
        if (dist > 1) { if (!(def.long || (def.reach && dist <= def.reach)) || !clearLine(view, e, r, c, vacated)) return; }
        const f = fight(t, my.type, view.mode);
        if (f === "win") pThreat += d[t];
        else if (f === "tie") pThreat += d[t] * 0.4;
      });
      // un inconnu qui n'a jamais bougé attaque rarement
      if (!known && !e.moved) pThreat *= 0.5;
      keep *= 1 - Math.min(1, pThreat);
    });
    const exposed = mem.exposed[my.id] || my.type === "oeuf" ? 1 : 0.6;
    return (1 - keep) * exposed;
  }

  // =====================================================================
  // IA STRATÈGE, deuxième génération
  //  - elle anticipe la riposte, si je joue ici, que peut-il me prendre, et pourrai-je reprendre derrière
  //  - elle crée des menaces (fourchettes) que l'adversaire ne peut pas toutes parer
  //  - elle garde un caractère par partie (assaut, forteresse, piégeur, rôdeur, bluffeur)
  //  - elle apprend comment l'adversaire joue, il attaque beaucoup ou il attend
  //  - elle prend plus ou moins de risques selon l'avantage matériel
  // =====================================================================
  const PERSONAS = {
    equilibre: { name: "équilibré", aggr: 1, danger: 1.2, scout: 1.7, guard: 1, bait: 1, hide: 1, bluff: 1, patience: 1.8, thr: 1 },
    assaut: { name: "assaut", aggr: 1.2, danger: 1.0, scout: 1.4, guard: 0.85, bait: 0.7, hide: 0.7, bluff: 0.8, patience: 1.1, thr: 1.4 },
    forteresse: { name: "forteresse", aggr: 0.85, danger: 1.4, scout: 1.4, guard: 1.5, bait: 1.2, hide: 1.3, bluff: 0.7, patience: 2.3, thr: 0.8 },
    piegeur: { name: "piégeur", aggr: 0.95, danger: 1.25, scout: 1.5, guard: 1.2, bait: 2.0, hide: 1.6, bluff: 1.1, patience: 1.9, thr: 1 },
    rodeur: { name: "rôdeur", aggr: 1.0, danger: 1.2, scout: 2.2, guard: 0.9, bait: 1, hide: 1, bluff: 1.2, patience: 1.6, thr: 1.1 },
    bluffeur: { name: "bluffeur", aggr: 1.05, danger: 1.15, scout: 1.6, guard: 0.9, bait: 1.4, hide: 1.8, bluff: 2.0, patience: 1.6, thr: 1.2 },
  };
  const PERSONA_IDS = ["equilibre", "assaut", "forteresse", "piegeur", "rodeur", "bluffeur"];

  function personaOf(mem, level, rng) {
    if (!mem.persona) {
      const pool = level.persona ? PERSONA_IDS : ["equilibre"];
      if (typeof process !== "undefined" && process.env && process.env.PERSONA && PERSONAS[process.env.PERSONA]) { mem.persona = process.env.PERSONA; return PERSONAS[mem.persona]; }
      mem.persona = pool[Math.floor(rng() * pool.length)];
    }
    const base = PERSONAS[mem.persona] || PERSONAS.equilibre;
    if (typeof process !== "undefined" && process.env && process.env.PJSON) return Object.assign({}, base, JSON.parse(process.env.PJSON));
    return base;
  }

  // Part des attaques dans les coups de l'adversaire, avec un a priori prudent
  function aggrOf(mem, owner) {
    const o = mem.opp[owner];
    if (!o) return 0.22;
    return (o.att + 2.5) / (o.att + o.mov + 11);
  }

  function growthOf(view, p) { return Math.min(3, p.grow || (view.mem && view.mem.grow[p.id]) || 0); }

  // Un portail vide dont le jumeau est libre emmène la pièce de l'autre côté
  function landOf(view, p, r, c) {
    const tw = view.portalTwin.get(K(r, c));
    if (tw && !view.grid.get(K(r, c)) && !view.grid.get(K(tw.r, tw.c))) return tw;
    if (tw && !view.grid.get(K(r, c)) && view.grid.get(K(tw.r, tw.c)) && view.grid.get(K(tw.r, tw.c)).id === p.id) return { r, c };
    return { r, c };
  }

  // Matériel estimé de chaque camp (pièces connues + contenu probable des inconnues)
  function materialBalance(view) {
    const state = view.state; let mine = 0; const en = {};
    state.pieces.forEach((p) => {
      const t = view.typeOf(p);
      const isMine = state.players[p.owner].team === view.myTeam;
      if (isMine) { mine += t ? val(t, view.mode) : 6; return; }
      if (t) en[p.owner] = (en[p.owner] || 0) + val(t, view.mode);
    });
    view.enemyOwners.forEach((o) => {
      const pool = view.pools[o] || {}; let s = 0;
      Object.keys(pool).forEach((t) => { if (pool[t] > 0 && PIECES[t]) s += pool[t] * val(t, view.mode); });
      en[o] = (en[o] || 0) + s;
    });
    const owners = view.enemyOwners.length || 1; let avg = 0; view.enemyOwners.forEach((o) => { avg += en[o] || 0; }); avg /= owners;
    return (mine - avg) / Math.max(1, mine + avg);
  }

  // ---------- monde virtuel pour anticiper ----------
  // mods { moverId, to ({r,c} ou null si la pièce disparaît), removeEnemy (id), exposeMover }
  function buildWorld(view, mods) {
    const ov = new Map(); const mine = [], enemies = [];
    view.state.pieces.forEach((p) => {
      const isMine = view.state.players[p.owner].team === view.myTeam;
      if (p.id === mods.moverId) {
        ov.set(K(p.r, p.c), null);
        if (mods.to) { const q = Object.assign({}, p, { r: mods.to.r, c: mods.to.c, moved: true, ghostExposed: !!mods.exposeMover }); ov.set(K(q.r, q.c), q); mine.push(q); }
        return;
      }
      if (mods.removeEnemy === p.id) { ov.set(K(p.r, p.c), null); return; }
      (isMine ? mine : enemies).push(p);
    });
    return {
      mine, enemies, ov,
      occ: (r, c) => { const k = K(r, c); return ov.has(k) ? ov.get(k) : view.grid.get(k); },
    };
  }

  function maxReachOf(types) {
    let m = 1;
    for (let i = 0; i < types.length; i++) { const d = PIECES[types[i][0]]; if (d.long) return 99; if (d.reach && d.reach > m) m = d.reach; }
    return m;
  }

  // Qui, parmi mes pièces, pourrait revenir sur la case (r,c) au coup suivant, et avec quelle probabilité de gagner contre le type t
  function recaptureP(view, W, r, c, t, exceptId) {
    let best = 0;
    for (let i = 0; i < W.mine.length; i++) {
      const m = W.mine[i];
      if (m.id === exceptId || m.frozen > 0) continue;
      const d = PIECES[m.type]; if (!d.mobile) continue;
      const dist = Math.abs(m.r - r) + Math.abs(m.c - c);
      if (dist === 0) continue;
      if (dist > 1) {
        if (!(d.long || (d.reach && dist <= d.reach)) || (m.r !== r && m.c !== c)) continue;
        const dr = Math.sign(r - m.r), dc = Math.sign(c - m.c); let x = m.r + dr, y = m.c + dc, clear = true;
        while (x !== r || y !== c) { if (view.blocked(x, y) || W.occ(x, y)) { clear = false; break; } x += dr; y += dc; }
        if (!clear) continue;
      }
      const f = fight(m.type, t, view.mode, bannerBoost(view, m), 0);
      const v = f === "win" ? 1 : f === "tie" ? 0.5 : 0;
      if (v > best) best = v;
      if (best >= 1) break;
    }
    return best;
  }

  // Risque que je cours dans ce monde, ce que l'adversaire peut me prendre au coup suivant, net de mes reprises.
  // bait = ce que j'espère gagner si l'adversaire tombe dans un piège défendu.
  function worldRisk(view, mem, W, mdl) {
    let best = 0, rest = 0, bait = 0;
    for (let i = 0; i < W.enemies.length; i++) {
      const e = W.enemies[i];
      if (e.frozen > 0) continue;
      const d = dMap(view, mem, e);
      const types = []; let pm = 0;
      Object.keys(d).forEach((t) => { if (d[t] > 0 && PIECES[t].mobile) { types.push([t, d[t]]); pm += d[t]; } });
      if (!types.length) continue;
      const lim = maxReachOf(types);
      const known = !!view.typeOf(e);
      const ag = known ? 1 : Math.min(0.95, 0.35 + 1.5 * aggrOf(mem, e.owner));
      for (let di = 0; di < 4; di++) {
        let r = e.r + DIRS[di][0], c = e.c + DIRS[di][1], k = 1;
        while (k <= lim && !view.blocked(r, c)) {
          const q = W.occ(r, c);
          if (q) {
            if (state_isMine(view, q)) {
              const Vq = roleValue(view, q.type, true);
              const keyPiece = q.type === "oeuf" || (view.mode === "kinghunt" && q.type === "roi");
              const qb = bannerBoost(view, q);
              let E = 0;
              for (let ti = 0; ti < types.length; ti++) {
                const t = types[ti][0], pr = types[ti][1]; const dd = PIECES[t];
                if (k > 1 && !(dd.long || (dd.reach && k <= dd.reach))) continue;
                const f = fight(t, q.type, view.mode, 0, qb);
                const Vt = roleValue(view, t, false);
                if (f === "win") E += pr * (Vq - (keyPiece ? 0 : recaptureP(view, W, q.r, q.c, t, q.id) * Vt));
                else if (f === "tie") E += pr * (Vq - Vt);
                else E -= pr * Vt;
              }
              const exposedQ = mem.exposed[q.id] || q.ghostExposed || q.type === "oeuf" ? true : false;
              let pa;
              if (known || exposedQ) pa = E > 0 ? 1 : 0.06; else pa = ag;
              if (E > 0) { const v = pa * E; if (v > best) { rest += best; best = v; } else rest += v; }
              else if (!known && !exposedQ) bait += pa * (-E);
            }
            break;
          }
          r += DIRS[di][0]; c += DIRS[di][1]; k++;
        }
      }
    }
    return { risk: best + 0.3 * rest, bait };
  }
  function state_isMine(view, q) { return view.state.players[q.owner].team === view.myTeam; }

  // Menaces que je crée, fourchettes comprises. L'adversaire ne peut parer qu'une menace par tour.
  function worldThreat(view, mem, W, level) {
    const found = [];
    for (let i = 0; i < W.mine.length; i++) {
      const m = W.mine[i];
      if (m.frozen > 0) continue;
      const md = PIECES[m.type]; if (!md.mobile) continue;
      const lim = md.long ? 99 : md.reach || 1;
      for (let di = 0; di < 4; di++) {
        let r = m.r + DIRS[di][0], c = m.c + DIRS[di][1], k = 1;
        while (k <= lim && !view.blocked(r, c)) {
          const q = W.occ(r, c);
          if (q) {
            if (!state_isMine(view, q)) {
              const a = evAttackM(view, mem, m, q, level);
              const v = a.ev + a.info * 0.4;
              if (v > 0.5) found.push({ t: q.id, v });
            }
            break;
          }
          r += DIRS[di][0]; c += DIRS[di][1]; k++;
        }
      }
    }
    if (!found.length) return 0;
    found.sort((a, b) => b.v - a.v);
    const seen = new Set(); let total = 0, w = 1;
    for (let i = 0; i < found.length && seen.size < 3; i++) { if (seen.has(found[i].t)) continue; seen.add(found[i].t); total += found[i].v * w; w *= 0.45; }
    return total;
  }

  function chooseMoveMaster(state, mem, level, rng) {
    const view = masterView(state, mem);
    const { me, mode } = view;
    const persona = personaOf(mem, level, rng);
    const round = state.round;
    const deep = level.look >= 2;
    // avantage matériel, plus on est devant plus on évite le risque, plus on est derrière plus on tente
    const lead = materialBalance(view);
    view.lossMul = Math.max(0.8, Math.min(2.1, TUNE.lossMul * (1 + lead * 0.9)));
    const quiet = round - (mem.lastCombatRound || 0);
    const impatience = Math.min(16, Math.max(0, (quiet - 6 * persona.patience) * (lead < -0.1 ? 1.25 : lead > 0.15 ? 0.7 : 1)));
    // l'adversaire qui attaque peu se laisse approcher
    let oppAggr = 0.25; { let n = 0, s = 0; view.enemyOwners.forEach((o) => { s += aggrOf(mem, o); n++; }); if (n) oppAggr = s / n; }
    const passive = level.adapt && oppAggr < 0.17;
    const reckless = level.adapt && oppAggr > 0.38;
    const protect = view.protect;
    const relics = state.board.relics || [];
    let openNeighbors = [];
    if (protect) {
      DIRS.forEach(([dr, dc]) => {
        const r = protect.r + dr, c = protect.c + dc;
        if (!view.blocked(r, c) && !view.grid.get(K(r, c))) openNeighbors.push(K(r, c));
        const occ = view.grid.get(K(r, c));
        if (occ && occ.owner === me && PIECES[occ.type] && PIECES[occ.type].mobile) openNeighbors.push(K(r, c));
      });
    }
    const nearestEnemyToProtect = protect ? Math.min(99, ...view.enemies.filter((e) => view.typeOf(e) ? PIECES[view.typeOf(e)].mobile : e.moved || round > 3).map((e) => Math.abs(e.r - protect.r) + Math.abs(e.c - protect.c))) : 99;
    const threatened = nearestEnemyToProtect <= 5;
    // trophées, plus un adversaire approche de l'objectif plus il faut se battre
    let bountyU = 0;
    if (mode === "bounty") { const T = Number(state.settings.bountyTarget) || 60; let top = 0; state.players.forEach((pl) => { if (pl.team !== view.myTeam && !pl.eliminated) top = Math.max(top, pl.score || 0); }); const mine = state.players[me].score || 0; bountyU = Math.max(0, Math.min(2, (top / T) * 1.6 + Math.max(0, top - mine) / T)); }

    const attractive = new Map();
    view.mine.forEach((p) => {
      if (!state.legal[p.id]) return;
      const arr = [];
      view.enemies.forEach((e) => {
        const a = evAttackM(view, mem, p, e, level);
        const score = a.ev + a.info * 0.5 * persona.scout;
        if (score > 0.5) arr.push({ e, score });
      });
      arr.sort((x, y) => y.score - x.score);
      attractive.set(p.id, arr.slice(0, 3));
    });

    const planScore = (p, e) => {
      if (!PIECES[p.type].mobile || (p.type === "roi" && mode !== "kinghunt" && round < 30)) return 0;
      const a = evAttackM(view, mem, p, e, level);
      const d = Math.abs(p.r - e.r) + Math.abs(p.c - e.c);
      const Vq = roleValue(view, p.type, true);
      return (a.ev * 0.5 + a.info * 0.4 - Vq * dangerAt(view, mem, p, p.r, p.c, null, null) * 0.3) / (1 + 0.2 * d);
    };
    const plan = pickPlan(state, mem, view, planScore, (t) => roleValue(view, t, t === "rat" ? true : false));
    const cq = conquestCtx(state, view);

    // ---- premier passage, évaluation rapide de tous les coups ----
    const cands = [];
    view.mine.forEach((p) => {
      const dests = state.legal[p.id];
      if (!dests) return;
      const Vp = roleValue(view, p.type, true);
      const curDanger = dangerAt(view, mem, p, p.r, p.c, null, null);
      const vac = K(p.r, p.c);
      const neverMoved = !p.moved && !mem.exposed[p.id];
      dests.forEach(([r0, c0]) => {
        const target = view.grid.get(K(r0, c0));
        const isAtk = target && state.players[target.owner].team !== view.myTeam;
        const L = isAtk ? { r: r0, c: c0 } : landOf(view, p, r0, c0);
        const r = L.r, c = L.c;
        let score = 0, dangerPart = 0, a = null;
        if (isAtk) {
          a = evAttackM(view, mem, p, target, level);
          score += a.ev * level.aggression * TUNE.aggr * persona.aggr * (mode === "bounty" ? 1 + bountyU * 0.3 : 1) + a.info * TUNE.scout * persona.scout - a.reveal;
          if (a.pWin > 0) { dangerPart = -Vp * dangerAt(view, mem, p, r, c, target.id, vac) * a.pWin * 0.7; }
          if (a.known && a.pWin === 1) score += 1.5;
          if (!a.known && !target.moved && p.type === "nain" && round > 6) score += 3 * level.hunt;
          score += impatience * (a.pLose < 0.6 ? 1 : 0.3);
          if (passive && !a.known && a.pLose < 0.5) score += 1.2;
          if (plan && plan.mover.id === p.id && plan.tgt.id === target.id) score += plan.urgent ? 14 : 3;
        } else {
          const dgNew = dangerAt(view, mem, p, r, c, null, vac);
          dangerPart = -(dgNew - curDanger) * Vp * TUNE.danger * (plan && plan.urgent && plan.mover.id === p.id ? 0.1 : 1);
          const targets = attractive.get(p.id) || [];
          targets.forEach(({ e, score: sc }) => {
            const d0 = Math.abs(e.r - p.r) + Math.abs(e.c - p.c);
            const d1 = Math.abs(e.r - r) + Math.abs(e.c - c);
            score += (d0 - d1) * Math.min(2.6, 0.18 * sc + 0.3) * level.progress;
          });
          if (!targets.length) {
            const cur = nearest(view.enemies, p.r, p.c), nxt = nearest(view.enemies, r, c);
            let prog = (cur - nxt) * TUNE.prog * (1 + impatience * 0.12) * (passive ? 1.25 : 1);
            if (p.type === "roi" || p.type === "oeuf") prog *= 0.1;
            else if (PIECES[p.type].rank >= 8 && round < 10 && impatience === 0) prog *= 0.3;
            score += prog;
          }
          if (relics.length) {
            const onRelic = (x, y) => relics.some((q) => q.r === x && q.c === y);
            if (onRelic(r, c)) score += 9;
            if (onRelic(p.r, p.c)) score -= 7;
            if (!onRelic(r, c)) {
              const dNow = Math.min(...relics.map((q) => Math.abs(q.r - p.r) + Math.abs(q.c - p.c)));
              const dNew = Math.min(...relics.map((q) => Math.abs(q.r - r) + Math.abs(q.c - c)));
              score += (dNow - dNew) * 1.1;
            }
          }
          score -= trailPenalty(mem, p, r, c, 3.4);
          if (plan && plan.mover.id === p.id) score += stepGain(view, plan.tgt, p, r, c) * (plan.urgent ? 12 : 1.8);
          else if (mem.lastMover === p.id) score += 0.6;
          if (protect && p.id !== protect.id && threatened) {
            const isGuardCell = (key) => openNeighbors.includes(key);
            if (isGuardCell(K(r, c)) && !isGuardCell(K(p.r, p.c))) score += 7 * level.flagGuard * persona.guard * (Vp < 14 ? 1 : 0.5);
            if (isGuardCell(K(p.r, p.c)) && !isGuardCell(K(r, c))) score -= 8 * level.flagGuard * persona.guard;
            const dB = Math.abs(p.r - protect.r) + Math.abs(p.c - protect.c);
            const dA = Math.abs(r - protect.r) + Math.abs(c - protect.c);
            if (dB <= 3 && dA > dB) score -= 2.5 * level.flagGuard * persona.guard;
          }
          if (p.type === "roi" && round < 30 && mode !== "kinghunt" && impatience < 6) score -= 0.6;
          // les marais endorment, les forêts cachent
          const tr = state.board.terrain[r][c];
          if (tr === "marsh" && state.board.terrain[p.r][p.c] !== "marsh") score -= (0.9 + Vp * 0.12) * (nearest(view.enemies, r, c) <= 3 ? 1.8 : 1);
          // phalange, rester collé à une pièce identique
          if (state.settings.phalange && PIECES[p.type].mobile) {
            const adj = (x, y) => DIRS.some(([dr, dc]) => { const q = view.grid.get(K(x + dr, y + dc)); return q && q.owner === me && q.id !== p.id && q.type === p.type; });
            if (adj(r, c) && !adj(p.r, p.c)) score += 0.9; else if (!adj(r, c) && adj(p.r, p.c)) score -= 0.6;
          }
          // ne pas se trahir, une grosse pièce qui n'a jamais bougé garde son mystère tant qu'elle n'a rien à faire
          if (neverMoved && Vp >= 9 && nearest(view.enemies, r, c) > 3 && impatience < 5) score -= 0.12 * Vp * persona.hide;
          // une petite pièce discrète qui s'avance fait croire à une grosse
          if (neverMoved && Vp <= 6 && PIECES[p.type].mobile && nearest(view.enemies, r, c) < nearest(view.enemies, p.r, p.c) && nearest(view.enemies, r, c) >= 3) score += 0.45 * persona.bluff;
        }
        score += extraTerms(view, cq, level, p, r, c, target);
        score += (rng() - 0.5) * level.noise;
        cands.push({ pieceId: p.id, to: [r0, c0], score, dangerPart, atk: a, target: isAtk ? target : null, p, L, Vp });
      });
    });
    if (!cands.length) return null;
    // ---- second passage, on regarde la riposte pour les meilleurs coups ----
    cands.forEach((cd) => { cd.s1 = cd.score + cd.dangerPart; });
    cands.sort((a, b) => b.s1 - a.s1);
    if (!level.look) return cands[0];
    const K2 = Math.min(cands.length, deep ? 18 : 10);
    const baseW = buildWorld(view, { moverId: null });
    const baseR = worldRisk(view, mem, baseW, null).risk;
    const baseT = worldThreat(view, mem, baseW, level);
    const thrW = 0.32 * persona.thr * (reckless ? 0.7 : passive ? 1.2 : 1) * (deep ? 1 : 0.7);
    const dW = TUNE.danger * persona.danger * (reckless ? 1.15 : 1);
    const baitW = (deep ? 0.22 : 0.1) * persona.bait * (reckless ? 1.5 : passive ? 0.5 : 1);
    for (let i = 0; i < K2; i++) {
      const cd = cands[i]; const p = cd.p;
      let rsk = 0, bait = 0, thr = 0;
      if (!cd.target) {
        const W = buildWorld(view, { moverId: p.id, to: cd.L });
        const wr = worldRisk(view, mem, W, null); rsk = wr.risk; bait = wr.bait; thr = deep ? worldThreat(view, mem, W, level) : 0;
      } else {
        // issue incertaine, on pondère les trois mondes possibles
        const a = cd.atk; const e = cd.target; const d = dMap(view, mem, e);
        let pw = 0, pl = 0, pt = 0;
        Object.keys(d).forEach((t) => { const f = fight(p.type, t, view.mode, bannerBoost(view, p), t === "etendard" ? 0 : bannerBoost(view, e)); if (f === "win") pw += d[t]; else if (f === "lose") pl += d[t]; else pt += d[t]; });
        const tot = pw + pl + pt || 1; pw /= tot; pl /= tot; pt /= tot;
        const worlds = [];
        if (pw > 0.001) worlds.push([pw, { moverId: p.id, to: cd.L, removeEnemy: e.id, exposeMover: !!state.settings.survivorsRevealed }]);
        if (pl > 0.001) worlds.push([pl, { moverId: p.id, to: null }]);
        if (pt > 0.001) worlds.push([pt, { moverId: p.id, to: null, removeEnemy: e.id }]);
        worlds.forEach(([w, mods]) => { const W = buildWorld(view, mods); const wr = worldRisk(view, mem, W, null); rsk += w * wr.risk; if (deep && w >= 0.25) thr += w * worldThreat(view, mem, W, level); });
        // la dangerPart du premier passage était un résumé, la remplace
      }
      const keepFirst = cd.target ? 0 : 0;
      cd.score = cd.score + keepFirst - (rsk - baseR) * dW * (cd.target ? 0.9 : 1) + bait * baitW + (thr - baseT) * thrW;
      // sécurité de la pièce clé, jamais de coup qui met l'objectif à protéger en prise
      cd.r2 = rsk;
    }
    const top = cands.slice(0, K2).sort((a, b) => b.score - a.score);
    return top[0];
  }

  function chooseMoveAny(state, mem, level, rng) {
    return level.master ? chooseMoveMaster(state, mem, level, rng) : chooseMove(state, mem, level, rng);
  }

  // ---------- placement du stratège ----------
  function choosePlacementMaster(state, level, rng) {
    const arm = state.board.arms[state.you];
    const cells = arm.cells.map((x) => [x[0], x[1]]);
    const mine = state.pieces.filter((p) => p.owner === state.you && p.type);
    const df = depthFnFor(state, state.you);
    const kingMode = state.settings.mode === "kinghunt";
    const inArm = new Set(cells.map(([r, c]) => K(r, c)));
    const out = {};
    const free = new Set(cells.map(([r, c]) => K(r, c)));
    const cellOf = (key) => key.split(",").map(Number);
    const neighbors = (cell) => DIRS.map(([dr, dc]) => K(cell[0] + dr, cell[1] + dc)).filter((k) => inArm.has(k));
    const put = (p, key) => { out[p.id] = cellOf(key); free.delete(key); };
    const depthKey = (key) => df.at(...cellOf(key)) / df.max;
    const pick = (list, scoreFn) => {
      let best = null, bs = -1e9;
      list.forEach((k) => { const s = scoreFn(k) + rng() * 0.6; if (s > bs) { bs = s; best = k; } });
      return best;
    };
    const rest = mine.slice();
    const take = (pred) => { const i = rest.findIndex(pred); return i >= 0 ? rest.splice(i, 1)[0] : null; };
    const target = take((p) => p.type === (kingMode ? "roi" : "oeuf"));
    let anchorKey = null;
    if (target) {
      // au fond, de préférence sur un bord (peu de voisins dans le camp)
      anchorKey = pick([...free], (k) => depthKey(k) * 4 - neighbors(cellOf(k)).length * 0.7);
      put(target, anchorKey);
    }
    const bombs = rest.filter((p) => p.type === "tarte");
    bombs.forEach((b) => rest.splice(rest.indexOf(b), 1));
    // les tartes protègent la cible, mais une ou deux servent de leurre
    const decoys = bombs.length >= 3 ? 1 + (rng() < 0.4 ? 1 : 0) : bombs.length >= 2 ? 1 : 0;
    const guard = bombs.slice(0, bombs.length - decoys);
    const lures = bombs.slice(bombs.length - decoys);
    if (anchorKey) {
      const ring = neighbors(cellOf(anchorKey)).filter((k) => free.has(k));
      guard.forEach((b) => {
        const k = ring.length ? ring.splice(Math.floor(rng() * ring.length), 1)[0] : pick([...free], (x) => depthKey(x) * 2);
        put(b, k);
      });
    } else guard.forEach((b) => put(b, pick([...free], (x) => depthKey(x) * 2)));
    lures.forEach((b) => put(b, pick([...free], (x) => -Math.abs(depthKey(x) - 0.45) * 3 + (rng() < 0.3 ? 1 : 0))));
    // préférence de profondeur par type (0 = ligne de front, 1 = fond)
    const pref = { gladiateur: 0.3, escargot: 0.4, bouffon: 0.3, lutin: 0.0, rat: 0.25, garde: 0.2, archere: 0.3, fantome: 0.2, cavalier: 0.3, assassin: 0.5, reflet: 0.35, chauvesouris: 0.2, golem: 0.6, bombardier: 0.3, etendard: 0.4, sentinelle: 0.35, phenix: 0.6, messagere: 0.25, chevalier: 0.4, troll: 0.5, nain: 0.55, sorcier: 0.65, dragon: 0.7, roi: 0.8 };
    const order = ["roi", "dragon", "sorcier", "phenix", "golem", "nain", "sentinelle", "etendard", "troll", "chevalier", "cavalier", "assassin", "reflet", "rat", "archere", "chauvesouris", "bombardier", "messagere", "gladiateur", "escargot", "bouffon", "garde", "fantome", "lutin"];
    rest.sort((a, b) => order.indexOf(a.type) - order.indexOf(b.type));
    rest.forEach((p) => {
      const want = pref[p.type] != null ? pref[p.type] : 0.4;
      const k = pick([...free], (x) => {
        let s = -Math.abs(depthKey(x) - want) * 4;
        // le Roi et le Dragon ne s'affichent pas à côté de la cible (cela la trahirait)
        if (anchorKey && (p.type === "roi" || p.type === "dragon") && neighbors(cellOf(anchorKey)).includes(x)) s -= 1.5;
        // les nains près du centre pour sortir vite
        if (p.type === "nain") s += (1 - depthKey(x)) * 0.4;
        return s;
      });
      put(p, k);
    });
    return out;
  }

  // ---------- composition sur mesure ----------
  function composeArmy(state, levelId, rng) {
    rng = rng || Math.random;
    const info = state.compose || {};
    const budget = info.budget || 150;
    const room = (info.size || 24) - 1;
    const level = LEVELS[levelId] || LEVELS.normal;
    const special = state.settings.specialPieces;
    if (info.legion) {
      const slots = info.legion.slots;
      const seqL = (levelId === "hard" || levelId === "expert" || level.master) ? ["golem", "phenix", "gladiateur", "sentinelle", "assassin", "etendard", "reflet", "bouffon", "cavalier", "chauvesouris", "messagere", "gladiateur", "bombardier", "fantome", "golem", "cavalier"] : ["cavalier", "gladiateur", "fantome", "reflet", "bombardier", "bouffon", "chauvesouris", "messagere", "assassin", "escargot", "golem", "sentinelle", "cavalier", "fantome"];
      // un caractère de partie différent donne une armée différente, le départ dans la liste change
      if (level.master && rng() < 0.3) seqL.unshift(["escargot", "bouffon", "gladiateur"][Math.floor(rng() * 3)]);
      const pickL = {};
      let got = 0;
      const start = Math.floor(rng() * seqL.length);
      for (let i = 0; i < seqL.length * 2 && got < slots; i++) {
        const t = seqL[(start + i) % seqL.length];
        if ((pickL[t] || 0) < PIECES[t].max) { pickL[t] = (pickL[t] || 0) + 1; got++; }
      }
      return pickL;
    }
    const out = { roi: 1 };
    let cost = PIECES.roi.cost, total = 1;
    const add = (t) => {
      const d = PIECES[t];
      if (!d || (d.special && !special)) return false;
      if ((out[t] || 0) >= d.max || total + 1 > room || cost + d.cost > budget) return false;
      out[t] = (out[t] || 0) + 1; cost += d.cost; total++; return true;
    };
    if (level.master || levelId === "hard" || levelId === "expert") {
      // base solide, puis on équilibre
      const seq = ["dragon", "sorcier", "rat", "nain", "nain", "tarte", "tarte", "lutin", "lutin", "troll", "chevalier", "sentinelle", "phenix", "nain", "tarte", "etendard", "gladiateur", "archere", "bombardier", "messagere", "lutin", "sorcier", "troll", "chevalier", "garde", "dragon", "lutin", "archere", "garde", "tarte", "nain", "troll", "garde", "lutin", "rat"];
      if (state.settings.mode === "kinghunt") seq.splice(seq.indexOf("rat"), 1);
      for (let round = 0; round < 3; round++) seq.forEach((t) => { if (total < room) add(t); });
    } else {
      const bag = ["rat", "lutin", "nain", "garde", "archere", "chevalier", "troll", "sorcier", "dragon", "tarte", "lutin", "garde", "sentinelle", "messagere", "bombardier", "gladiateur", "bouffon"];
      let guard = 0;
      while (total < room && guard++ < 200) { if (!add(bag[Math.floor(rng() * bag.length)])) { if (cost > budget - 3) break; } }
    }
    return out;
  }

  // ---------- point d'entrée ----------
  // Retourne { kind:"move", pieceId, to } | { kind:"power", power, data } | { kind:"place", placement } | null
  function act(state, mem, levelId, rng) {
    rng = rng || Math.random;
    const level = LEVELS[levelId] || LEVELS.normal;
    observe(mem, state);
    if (state.phase === "compose") return { kind: "compose", counts: composeArmy(state, levelId, rng) };
    if (state.phase === "setup") {
      return { kind: "place", placement: choosePlacement(state, level, rng) };
    }
    if (state.phase !== "playing" || state.current !== state.you) return null;
    const pw = choosePower(state, mem, level, rng);
    if (pw) return { kind: "power", power: pw.power, data: pw.data };
    const mv = chooseMoveAny(state, mem, level, rng);
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

  return { LEVELS, NAMES, newMemory, act, thinkDelay, observe, fight, composeArmy };
});

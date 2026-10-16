// ============================================================
// RICHISSIME DESTINY — Mini-jeux de cartes joués pour de vrai
// Blackjack à deux (chacun contre l'autre, avec le même paquet) et poker à cinq cartes avec échange et une mise.
// Tout est calculé sur le serveur, la main de l'adversaire n'est jamais envoyée avant la fin.
// ============================================================
const C = require("./core");

const SUITS = ["♠", "♥", "♦", "♣"];
const RANKS = [2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14];
const MINI_GAMES = { blackjack: { l: "Blackjack", ic: "🂡" }, poker: { l: "Poker", ic: "🃏" } };

function newDeck(rng) {
  const d = [];
  SUITS.forEach((s) => RANKS.forEach((r) => d.push({ r, s })));
  for (let i = d.length - 1; i > 0; i--) { const j = Math.floor(rng() * (i + 1)); [d[i], d[j]] = [d[j], d[i]]; }
  return d;
}

// ---------- blackjack ----------
function bjTotal(cards) {
  let t = 0, aces = 0;
  cards.forEach((c) => { if (c.r === 14) { aces++; t += 11; } else t += c.r >= 10 ? 10 : c.r; });
  while (t > 21 && aces > 0) { t -= 10; aces--; }
  return t;
}
const bjNatural = (cards) => cards.length === 2 && bjTotal(cards) === 21;
// force d'une main de blackjack, du pire au meilleur
function bjScore(cards) {
  const t = bjTotal(cards);
  if (t > 21) return -1;
  return t * 10 + (bjNatural(cards) ? 5 : 0);
}

// ---------- poker à cinq cartes ----------
const HAND_NAMES = ["une carte haute", "une paire", "une double paire", "un brelan", "une suite", "une couleur", "un full", "un carré", "une quinte flush"];
function rank5(cards) {
  const rs = cards.map((c) => c.r).sort((a, b) => b - a);
  const cnt = {}; rs.forEach((r) => { cnt[r] = (cnt[r] || 0) + 1; });
  const groups = Object.keys(cnt).map((r) => ({ r: Number(r), n: cnt[r] })).sort((a, b) => b.n - a.n || b.r - a.r);
  const flush = cards.every((c) => c.s === cards[0].s);
  const uniq = Array.from(new Set(rs));
  let straightHigh = 0;
  if (uniq.length === 5) {
    if (uniq[0] - uniq[4] === 4) straightHigh = uniq[0];
    else if (uniq[0] === 14 && uniq[1] === 5 && uniq[4] === 2) straightHigh = 5;
  }
  const kick = groups.map((x) => x.r);
  if (straightHigh && flush) return [8, straightHigh];
  if (groups[0].n === 4) return [7].concat(kick);
  if (groups[0].n === 3 && groups[1] && groups[1].n === 2) return [6].concat(kick);
  if (flush) return [5].concat(rs);
  if (straightHigh) return [4, straightHigh];
  if (groups[0].n === 3) return [3].concat(kick);
  if (groups[0].n === 2 && groups[1] && groups[1].n === 2) return [2].concat(kick);
  if (groups[0].n === 2) return [1].concat(kick);
  return [0].concat(rs);
}
function cmpRank(a, b) {
  for (let i = 0; i < Math.max(a.length, b.length); i++) { const x = a[i] || 0, y = b[i] || 0; if (x !== y) return x > y ? 1 : -1; }
  return 0;
}
const handName = (cards) => HAND_NAMES[rank5(cards)[0]];
const cardName = (c) => ({ 11: "Valet", 12: "Dame", 13: "Roi", 14: "As" }[c.r] || String(c.r)) + c.s;
const showHand = (cards) => cards.map(cardName).join(" ");

// ---------- cycle de vie ----------
function enabled(g) { return g.settings.cardGames !== false; }
function wants(g, f, t, game) { return enabled(g) && !!MINI_GAMES[game] && f.alive && t.alive; }

function stageDeadline(g, m) {
  const ms = g.timerMs(0.8);
  m.deadline = ms ? g.now() + ms : 0;
  m.botAt = g.now() + 500 + Math.floor(g.rng() * 700) * g.timeScale;
}

function queue(g, f, t, game, amount) {
  g.minis = g.minis || [];
  const amt = Math.max(0, Math.min(Math.floor(amount || 0), Math.floor(f.cash), Math.floor(t.cash)));
  const m = { id: g.minis.length + 1, kind: game, a: f.seat, b: t.seat, amount: amt, state: "play", deck: newDeck(g.rng), hands: {}, log: [], result: null, round: g.round };
  m.hands[f.seat] = []; m.hands[t.seat] = [];
  if (game === "blackjack") {
    m.stood = {}; m.stood[f.seat] = false; m.stood[t.seat] = false;
    for (let i = 0; i < 2; i++) { m.hands[f.seat].push(m.deck.pop()); m.hands[t.seat].push(m.deck.pop()); }
    [f.seat, t.seat].forEach((s) => { if (bjTotal(m.hands[s]) >= 21) m.stood[s] = true; });
    m.stage = "jeu";
  } else {
    for (let i = 0; i < 5; i++) { m.hands[f.seat].push(m.deck.pop()); m.hands[t.seat].push(m.deck.pop()); }
    m.stage = "echange"; m.drawn = {}; m.drawn[f.seat] = false; m.drawn[t.seat] = false;
    m.raise = 0; m.turn = null; m.raiser = null; m.checked = false;
  }
  stageDeadline(g, m);
  g.minis.push(m);
  [f, t].forEach((p) => p.yearLog.push(MINI_GAMES[game].ic + " " + (p === f ? "Tu t'assois" : "Tu t'assois") + " à la table de " + MINI_GAMES[game].l.toLowerCase() + " avec " + (p === f ? t : f).name + (amt ? ", mise de " + C.fmt(amt) + "." : ", pour l'honneur.")));
  return m;
}

const pending = (g) => (g.minis || []).some((m) => m.state === "play") || (!!g.miniHold && g.now() < g.miniHold);
function open(g) {
  g.phase = "mini";
  (g.minis || []).forEach((m) => { if (m.state === "play") stageDeadline(g, m); });
  g.deadline = 0;
}

function other(m, seat) { return seat === m.a ? m.b : m.a; }

// ---------- actions des joueurs ----------
function act(g, seat, id, action, arg) {
  if (g.phase !== "mini") return { ok: false, error: "Pas de partie en cours." };
  const m = (g.minis || []).find((x) => x.id === Number(id));
  if (!m || m.state !== "play" || (seat !== m.a && seat !== m.b)) return { ok: false, error: "Cette partie n'existe pas." };
  return m.kind === "blackjack" ? bjAct(g, m, seat, action) : pkAct(g, m, seat, action, arg);
}

function bjAct(g, m, seat, action) {
  if (m.stood[seat]) return { ok: false, error: "Tu as déjà fini ta main." };
  if (action === "hit") {
    m.hands[seat].push(m.deck.pop());
    const t = bjTotal(m.hands[seat]);
    if (t >= 21) m.stood[seat] = true;
  } else if (action === "stand") m.stood[seat] = true;
  else return { ok: false, error: "Action inconnue." };
  m.botAt = g.now() + 400 * g.timeScale;
  if (m.stood[m.a] && m.stood[m.b]) bjFinish(g, m);
  return { ok: true };
}

function bjFinish(g, m) {
  const sa = bjScore(m.hands[m.a]), sb = bjScore(m.hands[m.b]);
  let winner = null;
  if (sa > sb) winner = m.a; else if (sb > sa) winner = m.b;
  if (sa === -1 && sb === -1) winner = null;
  finish(g, m, winner, m.amount, {
    a: bjTotal(m.hands[m.a]), b: bjTotal(m.hands[m.b]),
    detail: (s) => showHand(m.hands[s]) + " (" + (bjTotal(m.hands[s]) > 21 ? "trop de points" : bjTotal(m.hands[s])) + ")",
  });
}

function pkAct(g, m, seat, action, arg) {
  if (m.stage === "echange") {
    if (action !== "draw") return { ok: false, error: "Choisis les cartes à échanger." };
    if (m.drawn[seat]) return { ok: false, error: "Tu as déjà échangé." };
    const idx = Array.from(new Set((Array.isArray(arg) ? arg : []).map(Number).filter((i) => i >= 0 && i < 5)));
    idx.forEach((i) => { m.hands[seat][i] = m.deck.pop(); });
    m.drawn[seat] = true;
    m.log.push({ seat, text: idx.length ? "échange " + idx.length + " carte" + (idx.length > 1 ? "s" : "") : "garde sa main" });
    m.botAt = g.now() + 400 * g.timeScale;
    if (m.drawn[m.a] && m.drawn[m.b]) {
      if (m.amount > 0) { m.stage = "mise"; m.turn = m.a; stageDeadline(g, m); } else pkShowdown(g, m);
    }
    return { ok: true };
  }
  if (m.stage === "mise") {
    if (seat !== m.turn) return { ok: false, error: "Ce n'est pas ton tour." };
    const me = seat, op = other(m, seat);
    if (m.raise > 0 && m.raiser !== me) {
      // il faut répondre à une relance
      if (action === "call") { m.log.push({ seat, text: "suit la relance" }); return pkShowdown(g, m), { ok: true }; }
      if (action === "fold") { m.log.push({ seat, text: "se couche" }); finish(g, m, op, m.amount, { folded: me }); return { ok: true }; }
      return { ok: false, error: "Suivre ou se coucher." };
    }
    if (action === "raise") {
      m.raise = m.amount; m.raiser = me; m.turn = op; m.log.push({ seat, text: "relance de " + C.fmt(m.amount) });
      stageDeadline(g, m); return { ok: true };
    }
    if (action === "check") {
      m.log.push({ seat, text: "parole" });
      if (me === m.a) { m.turn = m.b; stageDeadline(g, m); return { ok: true }; }
      pkShowdown(g, m); return { ok: true };
    }
    return { ok: false, error: "Action inconnue." };
  }
  return { ok: false, error: "Rien à faire pour l'instant." };
}

function pkShowdown(g, m) {
  const ra = rank5(m.hands[m.a]), rb = rank5(m.hands[m.b]);
  const c = cmpRank(ra, rb);
  const stake = m.amount + m.raise;
  finish(g, m, c > 0 ? m.a : c < 0 ? m.b : null, stake, { ra, rb });
}

// ---------- fin de partie ----------
function finish(g, m, winnerSeat, stake, info) {
  const social = require("./social");
  const SK = require("./socialkit");
  m.state = "done"; m.deadline = 0;
  m.stage = "fin";
  const A = g.players[m.a], B = g.players[m.b];
  const ic = MINI_GAMES[m.kind].ic;
  const lines = { a: "", b: "" };
  let pubText;
  if (winnerSeat === null) {
    lines.a = lines.b = ic + " Égalité parfaite, personne ne perd rien.";
    pubText = A.name + " et " + B.name + " font match nul.";
    m.result = { winner: null, text: lines.a, pub: pubText, stake: 0 };
    A.stats.bonheur = C.clamp(A.stats.bonheur + 1, 0, 100); B.stats.bonheur = C.clamp(B.stats.bonheur + 1, 0, 100);
  } else {
    const W = g.players[winnerSeat], L = g.players[other(m, winnerSeat)];
    const amt = Math.max(0, Math.min(stake, Math.floor(L.cash)));
    if (amt > 0) { L.cash -= amt; W.cash += amt; }
    W.stats.bonheur = C.clamp(W.stats.bonheur + 5, 0, 100); L.stats.bonheur = C.clamp(L.stats.bonheur - 4, 0, 100);
    W.stats.repute = C.clamp(W.stats.repute + 2, 0, 100);
    let how;
    if (info && info.folded !== undefined) how = L.name + " s'est couché(e).";
    else if (m.kind === "poker") how = W.name + " avait " + handName(m.hands[W.seat]) + " contre " + handName(m.hands[L.seat]) + ".";
    else how = W.name + " " + bjTotal(m.hands[W.seat]) + " contre " + (bjTotal(m.hands[L.seat]) > 21 ? "une main qui a sauté" : L.name + " " + bjTotal(m.hands[L.seat])) + ".";
    m.result = { winner: winnerSeat, text: how, pub: W.name + " bat " + L.name + (amt ? " et empoche " + C.fmt(amt) : "") + ".", stake: amt };
    W.yearLog.push(ic + " Tu as battu " + L.name + " au " + MINI_GAMES[m.kind].l.toLowerCase() + (amt ? " et gagné " + C.fmt(amt) + "." : ".") + " " + how);
    L.yearLog.push(ic + " Tu as perdu contre " + W.name + (amt ? " et laissé " + C.fmt(amt) + "." : ".") + " " + how);
    social.recordLoss(g, L, W, m.kind, amt);
    SK.touch(g, W.seat, L.seat, { riv: amt > 0 ? 3 : 1, aff: 1 });
  }
  g.news(winnerSeat === null ? null : g.players[winnerSeat], ic + " " + m.result.pub, "duel");
  g.miniHold = g.now() + 8000 * g.timeScale;
}

// ---------- IA des robots et des absents ----------
function autoMove(g, m, seat) {
  const p = g.players[seat];
  const rng = g.rng;
  if (m.kind === "blackjack") {
    const mine = bjTotal(m.hands[seat]);
    const oppUp = m.hands[other(m, seat)][0];
    const up = oppUp.r === 14 ? 11 : Math.min(10, oppUp.r);
    const bold = (p.traits.courage - 50) / 100;
    let hit;
    if (mine <= 11) hit = true;
    else if (mine >= 18) hit = false;
    else if (mine === 17) hit = rng() < 0.05 + Math.max(0, bold) * 0.1;
    else hit = up >= 7 ? rng() < 0.7 + bold * 0.2 : rng() < 0.3 + bold * 0.2;
    return { action: hit ? "hit" : "stand" };
  }
  if (m.stage === "echange") {
    const hand = m.hands[seat];
    const cnt = {}; hand.forEach((c) => { cnt[c.r] = (cnt[c.r] || 0) + 1; });
    const rk = rank5(hand);
    if (rk[0] >= 4) return { action: "draw", arg: [] };
    const keep = hand.map((c, i) => (cnt[c.r] >= 2 ? i : -1)).filter((i) => i >= 0);
    if (keep.length) return { action: "draw", arg: [0, 1, 2, 3, 4].filter((i) => !keep.includes(i)) };
    for (const s of SUITS) { const same = hand.map((c, i) => (c.s === s ? i : -1)).filter((i) => i >= 0); if (same.length === 4) return { action: "draw", arg: [0, 1, 2, 3, 4].filter((i) => !same.includes(i)) }; }
    const sorted = hand.map((c, i) => ({ r: c.r, i })).sort((a, b) => b.r - a.r);
    const hi = sorted.filter((x) => x.r >= 11).slice(0, 2).map((x) => x.i);
    const k = hi.length ? hi : [sorted[0].i];
    return { action: "draw", arg: [0, 1, 2, 3, 4].filter((i) => !k.includes(i)) };
  }
  // mise
  const rk = rank5(m.hands[seat]);
  const strength = rk[0] * 10 + (rk[0] === 1 ? rk[1] / 2 : rk[0] === 0 ? rk[1] / 6 : 0);
  const bluff = rng() < 0.06 + Math.max(0, (p.traits.courage - 55) / 400);
  if (m.raise > 0 && m.raiser !== seat) {
    const call = strength >= 18 || (strength >= 12 && rng() < 0.7) || (strength >= 6 && rng() < 0.35) || rng() < 0.12;
    return { action: call ? "call" : "fold" };
  }
  if (strength >= 20 || (strength >= 12 && rng() < 0.45) || bluff) return { action: "raise" };
  return { action: "check" };
}

function tick(g, t) {
  let changed = false;
  for (const m of (g.minis || [])) {
    if (m.state !== "play") continue;
    const seats = m.kind === "blackjack"
      ? [m.a, m.b].filter((s) => !m.stood[s])
      : m.stage === "echange" ? [m.a, m.b].filter((s) => !m.drawn[s]) : m.stage === "mise" ? [m.turn] : [];
    const late = m.deadline && t >= m.deadline;
    for (const s of seats) {
      if (m.state !== "play") break;
      const p = g.players[s];
      if (!p.alive) { finish(g, m, other(m, s), m.amount, {}); changed = true; break; }
      const bot = g.controlled(p);
      if ((bot && t >= m.botAt) || late) {
        const mv = autoMove(g, m, s);
        const before = m.state + m.stage;
        act(g, s, m.id, mv.action, mv.arg);
        changed = true;
        if (late && !bot) { p.missed = (p.missed || 0) + 1; }
        if (m.state === "play" && before === m.state + m.stage && m.kind === "blackjack") m.botAt = g.now() + 300;
      }
    }
    // une partie coincée trop longtemps est terminée d'office
    if (m.state === "play" && m.deadline && t >= m.deadline + 4000 * g.timeScale) { if (m.kind === "blackjack") { m.stood[m.a] = m.stood[m.b] = true; bjFinish(g, m); } else pkShowdown(g, m); changed = true; }
  }
  return changed;
}

// ---------- vue envoyée aux joueurs ----------
function cardView(c) { return { r: c.r, s: c.s, n: cardName(c) }; }
function viewFor(g, seat) {
  const out = [];
  (g.minis || []).forEach((m) => {
    const done = m.state === "done";
    const involved = seat === m.a || seat === m.b;
    const A = g.players[m.a], B = g.players[m.b];
    const base = { id: m.id, kind: m.kind, ic: MINI_GAMES[m.kind].ic, label: MINI_GAMES[m.kind].l, amount: m.amount, state: m.state, stage: m.stage, a: { seat: m.a, name: A.name, avatar: A.avatar }, b: { seat: m.b, name: B.name, avatar: B.avatar }, deadline: m.deadline || 0, involved };
    if (done) base.result = m.result;
    if (!involved) { out.push(base); return; }
    const op = other(m, seat);
    const mine = m.hands[seat], theirs = m.hands[op];
    base.you = seat;
    base.mine = { cards: mine.map(cardView) };
    const reveal = done && !(m.kind === "poker" && m.result && m.result.text && /couché/.test(m.result.text));
    base.theirs = { name: g.players[op].name, count: theirs.length, cards: theirs.map((c, i) => (reveal || (m.kind === "blackjack" && i === 0) ? cardView(c) : null)) };
    if (m.kind === "blackjack") {
      base.mine.total = bjTotal(mine); base.mine.stood = !!m.stood[seat]; base.mine.bust = bjTotal(mine) > 21; base.mine.natural = bjNatural(mine);
      base.theirs.stood = !!m.stood[op];
      if (reveal) { base.theirs.total = bjTotal(theirs); base.theirs.bust = bjTotal(theirs) > 21; }
      base.canAct = !done && !m.stood[seat];
      base.actions = base.canAct ? ["hit", "stand"] : [];
    } else {
      base.mine.hand = handName(mine);
      if (reveal) base.theirs.hand = handName(theirs);
      base.drawn = !!m.drawn[seat]; base.oppDrawn = !!m.drawn[op];
      base.raise = m.raise; base.turn = m.turn; base.log = m.log.slice(-4).map((l) => ({ name: g.players[l.seat].name, text: l.text }));
      if (m.stage === "echange") { base.canAct = !done && !m.drawn[seat]; base.actions = base.canAct ? ["draw"] : []; }
      else if (m.stage === "mise") {
        base.canAct = !done && m.turn === seat;
        base.actions = !base.canAct ? [] : (m.raise > 0 && m.raiser !== seat) ? ["call", "fold"] : ["check", "raise"];
      } else { base.canAct = false; base.actions = []; }
    }
    out.push(base);
  });
  return out;
}

module.exports = { MINI_GAMES, newDeck, bjTotal, bjNatural, rank5, cmpRank, handName, enabled, wants, queue, pending, open, act, tick, viewFor, autoMove };

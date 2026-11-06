// ============================================================
// SUCRÉ OU SALÉ — Cerveau des robots
// Naïf devine à peu près, Futé raisonne dilemme par dilemme, Génie cumule les indices
// et anticipe ce que les enquêteurs vont déduire.
// ============================================================
const rng = Math.random;
const gauss = () => { let u = 0; for (let i = 0; i < 4; i++) u += rng(); return (u - 2) * 1.7; };
const ov = (set, tags) => { let n = 0; tags.forEach((t) => { if (set.has(t)) n++; }); return n; };
// marge d'un mot sur un dilemme, positive si le mot colle plutôt au côté A
const margin = (w, d) => ov(w.tagset, d.ta) - ov(w.tagset, d.tb);
const PERSONAS = ["prudent", "audacieux", "intuitif", "methodique"];
const LEVELS = { naif: 0, futé: 1, fute: 1, genie: 2, génie: 2 };
const lv = (id) => (LEVELS[id] !== undefined ? LEVELS[id] : 1);

// ----- Extralucide robot -----
// retourne { card, side } avec side parmi A, B, both, none
function chooseCard(level, hand, secret, aliveWords, jokerLeft, inverse) {
  const L = lv(level);
  const opts = hand.map((d) => {
    const sA = ov(secret.tagset, d.ta), sB = ov(secret.tagset, d.tb), diff = sA - sB;
    let side = diff > 0 ? "A" : diff < 0 ? "B" : null;
    const sign = diff > 0 ? 1 : diff < 0 ? -1 : 0;
    // mots que les enquêteurs pourront éliminer, ceux qui collent à l'autre côté
    let elimable = 0;
    aliveWords.forEach((w) => { if (w.id === secret.id) return; const m = margin(w, d); if (sign && m * sign < 0) elimable++; });
    return { d, sA, sB, diff, side, elimable };
  });
  let best = null, bestScore = -1e9;
  opts.forEach((o) => {
    let sc;
    if (L === 0) sc = rng() * 4;
    else if (L === 1) sc = Math.abs(o.diff) * 2 + o.elimable * 0.4 + gauss() * 0.8;
    else sc = Math.min(Math.abs(o.diff), 3) * 1.6 + o.elimable * 0.9 - (o.diff === 0 ? 1.5 : 0) + gauss() * 0.2;
    if (sc > bestScore) { bestScore = sc; best = o; }
  });
  let side = best.side;
  if (!side) { // aucune préférence nette, on tente un joker si on en a, sinon un côté au hasard
    if (jokerLeft && best.sA >= 2 && best.sB >= 2 && L >= 1) side = "both";
    else if (jokerLeft && best.sA === 0 && best.sB === 0 && L >= 1) side = "none";
    else side = rng() < 0.5 ? "A" : "B";
  } else if (jokerLeft && L === 2 && Math.abs(best.diff) === 1 && best.sA >= 2 && best.sB >= 2) side = "both";
  else if (L === 0 && rng() < 0.2) side = side === "A" ? "B" : "A";
  else if (L === 1 && rng() < 0.05) side = side === "A" ? "B" : "A";
  // dilemme inversé, on désigne le côté qui colle le moins
  if (inverse && (side === "A" || side === "B")) side = side === "A" ? "B" : "A";
  return { card: best.d.id, side };
}

// ----- mémoire d'un enquêteur robot -----
function newMemory(level, persona) { return { level, persona: persona || PERSONAS[Math.floor(rng() * PERSONAS.length)], score: {}, steps: 0 }; }
// meaning est le côté auquel le mot de l'Extralucide colle réellement, A, B, both ou none
function observe(mem, d, meaning, aliveWords) {
  const L = lv(mem.level); mem.steps++;
  if (L === 0) mem.score = {}; // les naïfs oublient tout
  const sd = L === 0 ? 2.4 : L === 1 ? 1.0 : 0.25;
  aliveWords.forEach((w) => {
    const a = ov(w.tagset, d.ta), b = ov(w.tagset, d.tb), m = a - b;
    let e = 0;
    if (meaning === "A") e = m; else if (meaning === "B") e = -m;
    else if (meaning === "both") e = -Math.abs(m) * 0.8 + Math.min(a, b) * 0.5;
    else if (meaning === "none") e = -(a + b) * 0.8;
    mem.score[w.id] = (mem.score[w.id] || 0) + e + gauss() * sd;
  });
}
function ranked(mem, alive) { return alive.slice().sort((x, y) => (mem.score[y.id] || 0) - (mem.score[x.id] || 0)); }
// choisit les mots à marquer. rule = majorite, un ou unanimite
function chooseMarks(mem, alive, quota, rule, solo) {
  const L = lv(mem.level); const r = ranked(mem, alive);
  const keep = L === 2 ? 3 : L === 1 ? 2 : 1;
  const pool = r.slice(keep).reverse(); // du moins probable au plus probable
  let k = quota;
  if (mem.persona === "prudent") k = Math.max(1, Math.ceil(quota * 0.6));
  if (mem.persona === "audacieux") k = quota;
  if (L === 0) k = Math.max(1, Math.min(quota, 1 + Math.floor(rng() * quota)));
  if (rule === "un" && !solo && L === 2) k = Math.max(1, Math.ceil(k * 0.7));
  // le niveau génie ne marque pas un mot qui a l'air presque aussi bon que le meilleur
  const topScore = r.length ? (mem.score[r[0].id] || 0) : 0;
  const out = [];
  for (const w of pool) {
    if (out.length >= k) break;
    const gap = topScore - (mem.score[w.id] || 0);
    if (L === 2 && gap < 1.2 && mem.steps < 3 && out.length >= 1) continue;
    if (L === 0 && rng() < 0.25) continue;
    out.push(w.id);
  }
  if (L === 0 && rng() < 0.2 && r.length > 2) { const w = r[Math.floor(rng() * r.length)]; if (!out.includes(w.id)) out.push(w.id); }
  return out.slice(0, quota);
}
function chooseFinal(mem, alive) {
  const L = lv(mem.level); if (!alive.length) return null;
  if (L === 0) return alive[Math.floor(rng() * alive.length)].id;
  const r = ranked(mem, alive);
  if (L === 1 && rng() < 0.2 && r.length > 1) return r[1].id;
  return r[0].id;
}
// qualité d'une main pour l'Extralucide robot, plus c'est haut plus un dilemme colle au mot
function handQuality(level, hand, secret) {
  if (lv(level) === 0) return 1;
  let best = 0; hand.forEach((d) => { const diff = Math.abs(ov(secret.tagset, d.ta) - ov(secret.tagset, d.tb)); if (diff > best) best = diff; });
  return best;
}
// un enquêteur robot annonce son mot en avance quand l'écart est net
function earlyGuess(mem, alive, left) {
  const L = lv(mem.level); if (L === 0 || alive.length < 1 || mem.steps < 2) return null;
  const r = ranked(mem, alive); if (r.length < 2) return null;
  const gap = (mem.score[r[0].id] || 0) - (mem.score[r[1].id] || 0);
  const maxN = L === 2 ? 4 : 3, minGap = L === 2 ? 2.4 : 2.7;
  if (alive.length <= maxN && gap >= minGap && (mem.persona !== "prudent" || gap >= minGap + 1)) return r[0].id;
  return null;
}
module.exports = { handQuality, earlyGuess, chooseCard, newMemory, observe, chooseMarks, chooseFinal, margin, ov, PERSONAS };

// ============================================================
// Mode 5 ans par 5 ans. Repère les scènes qui changent vraiment une vie.
// Une scène est clé si elle est marquée key, ou si ses issues touchent
// beaucoup de choses d'un coup (métier, couple, justice, déménagement...).
// ============================================================
const STRUCT = new Set(["job", "quit", "fire", "promote", "demote", "retire", "prison", "record", "born", "adopt", "becomes", "drop", "kill", "item", "sell", "loseItem", "empire", "placer", "spe", "dipl", "school", "city", "home", "lifestyle", "pro", "sale", "escape", "org", "die", "free"]);
const STATS = ["sante", "bonheur", "intel", "charme", "sport", "repute"];

function fxScore(fx) {
  if (!fx) return 0;
  let s = 0;
  for (const k of Object.keys(fx)) {
    const v = fx[k];
    if (STRUCT.has(k)) s += 3;
    else if (k === "argent" || k === "dette") s += typeof v === "number" ? Math.min(3, Math.abs(v) / 6000) : 1.5;
    else if (k === "flag" || k === "later" || k === "forced" || k === "next") s += 1.2;
    else if (STATS.includes(k)) s += typeof v === "number" ? Math.min(2, Math.abs(v) / 6) : 0.8;
    else if (k === "rel") s += 0.8;
  }
  return s;
}

const memo = new Map();
function stakes(e) {
  if (memo.has(e.id)) return memo.get(e.id);
  let best;
  if (e.key === true) best = 99;
  else if (e.key === false) best = 0;
  else if (typeof e.c === "function") best = 3;
  else {
    best = 0;
    for (const c of e.c || []) {
      const tot = (c.o || []).reduce((a, b) => a + (typeof b.w === "number" ? b.w : 0.5), 0) || 1;
      let sc = 0;
      (c.o || []).forEach((o) => { sc += (typeof o.w === "number" ? o.w : 0.5) * fxScore(o.fx) / tot; });
      best = Math.max(best, sc);
    }
  }
  memo.set(e.id, best);
  return best;
}

// level 0 très sélectif, 1 un peu plus large, 2 tout ce qui compte un peu
const THRESHOLDS = [3, 2, 1];
const isKey = (e, level) => stakes(e) >= THRESHOLDS[Math.min(level || 0, 2)];

module.exports = { stakes, isKey, THRESHOLDS };

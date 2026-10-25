// Outils communs aux mini-jeux
const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
function mulberry32(a) { return function () { a |= 0; a = (a + 0x6d2b79f5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }
function hashSeed(s) { let h = 2166136261; for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); } return h >>> 0; }
function shuffle(arr, rnd) { const a = arr.slice(); for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(rnd() * (i + 1)); const t = a[i]; a[i] = a[j]; a[j] = t; } return a; }
// classement par ordre de chute. fall est une liste de groupes dans l'ordre où les joueurs sont tombés, alive les survivants
function rankFromFalls(ids, fallOrder, aliveIds) {
  const groups = []; if (aliveIds.length) groups.push(aliveIds.slice());
  for (let i = fallOrder.length - 1; i >= 0; i--) groups.push(fallOrder[i].slice());
  const seen = new Set(); groups.forEach((g) => g.forEach((id) => seen.add(id)));
  const rest = ids.filter((id) => !seen.has(id)); if (rest.length) groups.push(rest);
  return groups;
}
// place n points sur un cercle ou une grille de départ
function ringPositions(n, cx, cy, r, a0) { const out = []; for (let i = 0; i < n; i++) { const a = (a0 || 0) + (i / n) * Math.PI * 2; out.push({ x: cx + Math.cos(a) * r, y: cy + Math.sin(a) * r, a }); } return out; }
function norm2(x, y) { const l = Math.hypot(x, y); return l > 1 ? [x / l, y / l] : [x, y]; }
module.exports = { clamp, mulberry32, hashSeed, shuffle, rankFromFalls, ringPositions, norm2 };

// ============================================================
// MAIN MORTE — Le Goulag, le règlement de comptes après une épreuve
// Quand plusieurs joueurs perdent ensemble une épreuve, ils se départagent en face à face
// dans une petite arène. Trois tomates dans la figure et c'est perdu. Le perdant reste
// dans l'arène et affronte le suivant, le dernier perdant est le seul à perdre sa main.
// ============================================================
const ARENA = 7; // demi-largeur de l'arène
const CRATES = [
  { x: -3, z: 0, w: 1.7, d: 1.7 },
  { x: 3, z: 0, w: 1.7, d: 1.7 },
  { x: 0, z: -3.3, w: 2.8, d: 0.9 },
  { x: 0, z: 3.3, w: 2.8, d: 0.9 },
];
const PR = 0.55, SR = 0.24, SPEED = 5.2, SHOT_V = 13, SHOT_LIFE = 1.5, COOL = 0.55, LIVES = 3;
const FIGHT_MS = 40000, SUDDEN_MS = 15000, STEP_MS = 33;
const rng = Math.random;
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const LVL = { figurant: 0, candidat: 1, veteran: 2 };

function hitsCrate(x, z, r) { return CRATES.some((c) => Math.abs(x - c.x) < c.w / 2 + r && Math.abs(z - c.z) < c.d / 2 + r); }
// la ligne entre deux points passe-t-elle par une caisse
function blocked(x1, z1, x2, z2) {
  return CRATES.some((c) => {
    let t0 = 0, t1 = 1; const dx = x2 - x1, dz = z2 - z1;
    const slab = (p, d, lo, hi) => { if (Math.abs(d) < 1e-9) return p >= lo && p <= hi; let a = (lo - p) / d, b = (hi - p) / d; if (a > b) [a, b] = [b, a]; t0 = Math.max(t0, a); t1 = Math.min(t1, b); return t0 <= t1; };
    return slab(x1, dx, c.x - c.w / 2, c.x + c.w / 2) && slab(z1, dz, c.z - c.d / 2, c.z + c.d / 2);
  });
}
function move(P, dx, dz) {
  const nx = clamp(P.x + dx, -ARENA + PR, ARENA - PR); if (!hitsCrate(nx, P.z, PR)) P.x = nx;
  const nz = clamp(P.z + dz, -ARENA + PR, ARENA - PR); if (!hitsCrate(P.x, nz, PR)) P.z = nz;
}

function create(ids, ctx) {
  // ctx = { ctl(id) vrai si le joueur est piloté par le serveur, level(id), TS }
  return { queue: ids.slice(), ctx, fights: [], cur: null, step: "intro", worst: null, seq: 0 };
}
function nextFight(gl, now) {
  let a, b;
  if (!gl.cur) { a = gl.queue.shift(); b = gl.queue.shift(); }
  else { a = gl.cur.loser; b = gl.queue.shift(); }
  const f = { a, b, P: {}, shots: [], hits: {}, ev: [], t0: 0, ends: 0, sudden: false, winner: null, loser: null, ready: {} };
  f.P[a] = { x: 0, z: 5.6, mx: 0, mz: 0, ax: 0, az: -1, cd: 0.8, fire: false, bot: {} };
  f.P[b] = { x: 0, z: -5.6, mx: 0, mz: 0, ax: 0, az: 1, cd: 0.8, fire: false, bot: {} };
  f.hits[a] = 0; f.hits[b] = 0;
  gl.cur = f; gl.step = "intro"; gl.introAt = now;
}
function input(gl, id, d) {
  const f = gl.cur; if (!f || gl.step !== "fight" || !f.P[id] || gl.ctx.ctl(id)) return;
  const P = f.P[id]; let mx = +d.mx || 0, mz = +d.mz || 0; const l = Math.hypot(mx, mz); if (l > 1) { mx /= l; mz /= l; }
  P.mx = mx; P.mz = mz; const al = Math.hypot(+d.ax || 0, +d.az || 0); if (al > 0.01) { P.ax = d.ax / al; P.az = d.az / al; }
  P.fire = !!d.fire; if (d.shot) P.shot = true;
}
function fire(f, id) {
  const P = f.P[id]; if (P.cd > 0 || f.shots.filter((s) => s.by === id).length >= 2) return;
  P.cd = COOL; f.shots.push({ by: id, x: P.x + P.ax * (PR + 0.1), z: P.z + P.az * (PR + 0.1), vx: P.ax * SHOT_V, vz: P.az * SHOT_V, life: SHOT_LIFE, k: (f.k = (f.k || 0) + 1) });
  f.ev.push({ t: "shot", by: id });
}
function botThink(gl, f, id, dt, now) {
  const me = f.P[id], oid = id === f.a ? f.b : f.a, o = f.P[oid]; const L = gl.ctx.level(id); const B = me.bot;
  const dx = o.x - me.x, dz = o.z - me.z, dist = Math.hypot(dx, dz) || 1;
  // déplacement, on garde une bonne distance et on tourne autour
  if (!B.switchAt || now > B.switchAt) { B.side = rng() < 0.5 ? -1 : 1; B.switchAt = now + 700 + rng() * 1500; B.want = 4.2 + rng() * 2.5; }
  let mx = (-dz / dist) * B.side * 0.8, mz = (dx / dist) * B.side * 0.8; const radial = (dist - B.want) / 3; mx += (dx / dist) * radial; mz += (dz / dist) * radial;
  // esquive des tomates qui arrivent
  const dodge = [0.25, 0.6, 0.85][L];
  f.shots.forEach((s) => { if (s.by === id) return; const rx = me.x - s.x, rz = me.z - s.z; const sv = Math.hypot(s.vx, s.vz); const along = (rx * s.vx + rz * s.vz) / sv; if (along < 0 || along > 5) return; const side = (rx * s.vz - rz * s.vx) / sv; if (Math.abs(side) < 1.1) { if (B.dodgeK !== s.k) { B.dodgeK = s.k; B.dodgeOk = rng() < dodge; } if (B.dodgeOk) { const sg = side >= 0 ? 1 : -1; mx += (s.vz / sv) * sg * 2.2; mz += (-s.vx / sv) * sg * 2.2; } } });
  const l = Math.hypot(mx, mz); if (l > 1) { mx /= l; mz /= l; } me.mx = mx; me.mz = mz;
  // visée, avec un peu d'anticipation et une erreur selon le niveau
  const lead = [0.1, 0.45, 0.85][L] * dist / SHOT_V; const tx = o.x + (o.vx || 0) * lead, tz = o.z + (o.vz || 0) * lead;
  if (!B.errAt || now > B.errAt) { B.err = (rng() - 0.5) * 2 * [0.34, 0.2, 0.11][L]; B.errAt = now + 400 + rng() * 500; }
  const ang = Math.atan2(tz - me.z, tx - me.x) + B.err; me.ax = Math.cos(ang); me.az = Math.sin(ang);
  if (me.cd <= 0 && !blocked(me.x, me.z, o.x, o.z) && rng() < [0.03, 0.05, 0.08][L] * (dt / 0.033)) fire(f, id);
}
// avance la bagarre d'un pas, renvoie vrai si quelque chose d'important a changé
function step(gl, now) {
  const f = gl.cur; if (!f || gl.step !== "fight") return false;
  const dt = STEP_MS / 1000; let changed = false;
  [f.a, f.b].forEach((id) => {
    const P = f.P[id]; if (gl.ctx.ctl(id)) botThink(gl, f, id, dt, now);
    const ox = P.x, oz = P.z; move(P, P.mx * SPEED * dt, P.mz * SPEED * dt); P.vx = (P.x - ox) / dt; P.vz = (P.z - oz) / dt;
    P.cd = Math.max(0, P.cd - dt); if (P.fire || P.shot) { fire(f, id); P.shot = false; }
  });
  for (let i = f.shots.length - 1; i >= 0; i--) {
    const s = f.shots[i]; s.x += s.vx * dt; s.z += s.vz * dt; s.life -= dt; let gone = s.life <= 0 || Math.abs(s.x) > ARENA || Math.abs(s.z) > ARENA;
    if (!gone && hitsCrate(s.x, s.z, SR * 0.6)) { gone = true; f.ev.push({ t: "splat", x: s.x, z: s.z }); }
    const tid = s.by === f.a ? f.b : f.a; const T = f.P[tid];
    if (!gone && Math.hypot(T.x - s.x, T.z - s.z) < PR + SR) { gone = true; f.hits[s.by]++; f.ev.push({ t: "hit", on: tid, by: s.by, x: s.x, z: s.z }); move(T, (s.vx / SHOT_V) * 0.45, (s.vz / SHOT_V) * 0.45); changed = true; }
    if (gone) f.shots.splice(i, 1);
  }
  // fin du combat
  const lost = (id) => f.hits[id === f.a ? f.b : f.a] >= LIVES;
  let win = null;
  if (lost(f.a) || lost(f.b)) win = lost(f.a) ? f.b : f.a;
  else if (!f.sudden && now >= f.ends) { if (f.hits[f.a] !== f.hits[f.b]) win = f.hits[f.a] > f.hits[f.b] ? f.a : f.b; else { f.sudden = true; f.ends = now + SUDDEN_MS * gl.ctx.TS; f.base = { a: f.hits[f.a], b: f.hits[f.b] }; changed = true; } }
  else if (f.sudden) { if (f.hits[f.a] !== f.hits[f.b]) win = f.hits[f.a] > f.hits[f.b] ? f.a : f.b; else if (now >= f.ends) win = rng() < 0.5 ? f.a : f.b; }
  if (win) { f.winner = win; f.loser = win === f.a ? f.b : f.a; gl.step = "ko"; gl.koAt = now; gl.fights.push({ a: f.a, b: f.b, winner: f.winner, loser: f.loser, hits: Object.assign({}, f.hits) }); changed = true; }
  return changed;
}
// ce que reçoivent les clients plusieurs fois par seconde pendant le combat
function snap(gl) {
  const f = gl.cur; if (!f) return null; const ev = f.ev.splice(0);
  const P = {}; [f.a, f.b].forEach((id) => { const q = f.P[id]; P[id] = [+q.x.toFixed(2), +q.z.toFixed(2), +q.ax.toFixed(2), +q.az.toFixed(2)]; });
  return { seq: ++gl.seq, P, S: f.shots.map((s) => [s.k, +s.x.toFixed(2), +s.z.toFixed(2), +s.vx.toFixed(1), +s.vz.toFixed(1), s.by]), hits: f.hits, ev, ends: f.ends, sudden: f.sudden };
}
function view(gl) {
  const f = gl.cur;
  return { step: gl.step, a: f && f.a, b: f && f.b, hits: f ? f.hits : {}, ends: f ? f.ends : 0, sudden: !!(f && f.sudden), winner: f && f.winner, loser: f && f.loser, queue: gl.queue.slice(), fights: gl.fights, worst: gl.worst, lives: LIVES, arena: ARENA, crates: CRATES };
}
module.exports = { create, nextFight, input, step, snap, view, ARENA, CRATES, LIVES, FIGHT_MS, STEP_MS, LVL };

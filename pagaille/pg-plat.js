// ============================================================
// PAGAILLE PARTY — Petite physique de plateforme en 3D (serveur)
// Des boîtes (fixes, mobiles ou tournantes) et des personnages ronds qui courent, sautent, double sautent et se bousculent.
// x vers la droite, y vers le spectateur, z vers le haut. Tout est en unités du monde, secondes et radians.
// ============================================================
const U = require("./pg-util.js");

class World {
  constructor() { this.boxes = []; this.t = 0; this._id = 0; }
  add(b) {
    b.n = ++this._id; b.solid = b.solid !== false; b.rot = b.rot || 0; b.vx = b.vy = b.vz = 0; b.dx = b.dy = b.dz = 0; b.omega = b.omega || 0; b.e = b.e == null ? 0.2 : b.e;
    this.boxes.push(b); return b;
  }
  // fait avancer les plateformes mobiles. move(t) renvoie {x,y,z,rot} ou rien
  step(dt) {
    this.t += dt;
    this.boxes.forEach((b) => {
      if (!b.move) { b.dx = b.dy = b.dz = 0; return; }
      const px = b.x, py = b.y, pz = b.z, pr = b.rot; const m = b.move(this.t, b);
      if (m) { if (m.x != null) b.x = m.x; if (m.y != null) b.y = m.y; if (m.z != null) b.z = m.z; if (m.rot != null) b.rot = m.rot; }
      b.dx = b.x - px; b.dy = b.y - py; b.dz = b.z - pz; b.vx = b.dx / dt; b.vy = b.dy / dt; b.vz = b.dz / dt; b.omega = (b.rot - pr) / dt;
    });
  }
}
// vitesse de la surface d'une boîte au point (px,py)
function surfV(b, px, py) { return [b.vx - b.omega * (py - b.y), b.vy + b.omega * (px - b.x)]; }
// distance signée d'un cercle à une boîte, dans le repère de la boîte. renvoie null si pas de contact
function overlap(b, px, py, r) {
  const c = Math.cos(-b.rot), s = Math.sin(-b.rot); const dx = px - b.x, dy = py - b.y; const lx = dx * c - dy * s, ly = dx * s + dy * c; const hx = b.w / 2, hy = b.d / 2;
  const cx = Math.max(-hx, Math.min(hx, lx)), cy = Math.max(-hy, Math.min(hy, ly)); let ex = lx - cx, ey = ly - cy; let d = Math.hypot(ex, ey);
  if (d >= r) return null;
  let nx, ny, pen;
  if (d < 1e-6) { // le centre est dans la boîte, on sort par le côté le plus proche
    const px2 = hx - Math.abs(lx), py2 = hy - Math.abs(ly); if (px2 < py2) { nx = lx < 0 ? -1 : 1; ny = 0; pen = px2 + r; } else { nx = 0; ny = lx * 0 + (ly < 0 ? -1 : 1); pen = py2 + r; }
  } else { nx = ex / d; ny = ey / d; pen = r - d; }
  // retour au repère du monde
  const cc = Math.cos(b.rot), ss = Math.sin(b.rot); return { nx: nx * cc - ny * ss, ny: nx * ss + ny * cc, pen };
}
// le centre du cercle est il au dessus de la boîte, avec un peu de tolérance sur les bords
function over(b, px, py, tol) {
  const c = Math.cos(-b.rot), s = Math.sin(-b.rot); const dx = px - b.x, dy = py - b.y; const lx = dx * c - dy * s, ly = dx * s + dy * c;
  return Math.abs(lx) <= b.w / 2 + tol && Math.abs(ly) <= b.d / 2 + tol;
}

function body(x, y, z, o) {
  return Object.assign({ x, y, z, vx: 0, vy: 0, vz: 0, r: 16, hgt: 40, grounded: false, ground: null, jumps: 0, coyote: 0, jbuf: 0, face: 0, alive: true, gz: null, dive: 0, diveCd: 0, stun: 0, jumpHeld: false, airT: 0, lastGround: 0, ev: [] }, o || {});
}
const DEF = { maxV: 290, accG: 2600, accA: 1500, g: 1750, jumpV: 610, maxJumps: 2, term: -1100, kill: -260, step: 16, diveV: 460, diveCd: 0.9, friction: 1, shove: 1, bump: 0.35 };

// avance un personnage d'un pas. inp {x,y} entre -1 et 1, jump pressé, jh maintenu, dive pressé
function step(world, b, inp, dt, cfgIn) {
  const cfg = cfgIn ? Object.assign({}, DEF, cfgIn) : DEF; b.ev.length = 0;
  if (!b.alive) return b.ev;
  let ix = inp.x || 0, iy = inp.y || 0; const il = Math.hypot(ix, iy); if (il > 1) { ix /= il; iy /= il; }
  if (b.stun > 0) { b.stun -= dt; ix = 0; iy = 0; }
  b.diveCd = Math.max(0, b.diveCd - dt); b.dive = Math.max(0, b.dive - dt);
  // accélération horizontale
  const acc = (b.grounded ? cfg.accG : cfg.accA) * cfg.friction * (b.fric == null ? 1 : b.fric) * (b.dive > 0 ? 0.25 : 1);
  const tx = ix * cfg.maxV, ty = iy * cfg.maxV;
  const ax = tx - b.vx, ay = ty - b.vy; const al = Math.hypot(ax, ay); const lim = acc * dt;
  if (al > lim) { b.vx += ax / al * lim; b.vy += ay / al * lim; } else { b.vx = tx; b.vy = ty; }
  if (il > 0.2) b.face = Math.atan2(iy, ix);
  // sauts
  b.jbuf = Math.max(0, b.jbuf - dt); b.coyote = Math.max(0, b.coyote - dt);
  if (inp.jump && b.stun <= 0) b.jbuf = 0.13;
  b.jumpHeld = !!inp.jh;
  if (b.jbuf > 0) {
    if (b.grounded || b.coyote > 0) { b.vz = cfg.jumpV; b.grounded = false; b.ground = null; b.coyote = 0; b.jbuf = 0; b.jumps = 1; b.ev.push("jump"); b.cut = false; }
    else if (b.jumps < cfg.maxJumps && b.jumps > 0) { b.vz = cfg.jumpV * 0.88; b.jbuf = 0; b.jumps++; b.ev.push("dbl"); b.cut = false; }
    else if (b.jumps === 0 && cfg.maxJumps > 1) { b.vz = cfg.jumpV * 0.88; b.jbuf = 0; b.jumps = 2; b.ev.push("dbl"); }
  }
  if (!b.jumpHeld && b.vz > 220 && !b.cut) { b.vz *= 0.55; b.cut = true; }
  if (inp.dive && b.diveCd <= 0 && b.stun <= 0 && cfg.diveV) { const a = il > 0.2 ? Math.atan2(iy, ix) : b.face; b.vx = Math.cos(a) * cfg.diveV; b.vy = Math.sin(a) * cfg.diveV; if (!b.grounded) b.vz = Math.max(b.vz, 160); b.dive = 0.38; b.diveCd = cfg.diveCd; b.face = a; b.ev.push("dive"); }
  b.vz = Math.max(cfg.term, b.vz - cfg.g * dt);
  // déplacement horizontal puis collisions latérales
  const carry = b.grounded && b.ground && b.ground.move ? b.ground : null;
  if (carry) { b.x += carry.dx; b.y += carry.dy; if (carry.omega) { /* la plateforme tourne, on suit son mouvement */ const sv = surfV(carry, b.x, b.y); b.x += (sv[0] - carry.vx) * dt; b.y += (sv[1] - carry.vy) * dt; } }
  b.x += b.vx * dt; b.y += b.vy * dt;
  const feet0 = b.z, head0 = b.z + b.hgt;
  for (let i = 0; i < world.boxes.length; i++) {
    const bx = world.boxes[i]; if (!bx.solid) continue; const top = bx.z + bx.h;
    if (feet0 >= top - cfg.step || head0 <= bx.z + 1) continue; // au dessus (ou on peut monter dessus), ou en dessous
    const ov = overlap(bx, b.x, b.y, b.r); if (!ov) continue;
    b.x += ov.nx * ov.pen; b.y += ov.ny * ov.pen;
    const sv = surfV(bx, b.x, b.y); const rvx = b.vx - sv[0], rvy = b.vy - sv[1]; const vn = rvx * ov.nx + rvy * ov.ny;
    if (vn < 0) { const e = bx.e == null ? cfg.bump : bx.e; b.vx -= (1 + e) * vn * ov.nx; b.vy -= (1 + e) * vn * ov.ny; if (vn < -150) b.ev.push("bump"); if (bx.hit) bx.hit(b, ov, vn); }
  }
  // déplacement vertical
  const prevFeet = b.z; let dz = b.vz * dt; if (carry && b.grounded) dz += carry.dz;
  b.z += dz; const newFeet = b.z; let landed = null, gz = null, ceil = null;
  for (let i = 0; i < world.boxes.length; i++) {
    const bx = world.boxes[i]; if (!bx.solid) continue; const top = bx.z + bx.h;
    if (!over(bx, b.x, b.y, b.r * 0.55)) continue;
    if (top <= newFeet + 6 && (gz == null || top > gz)) gz = top;
    if (b.vz <= 0.0001 && prevFeet >= top - bx.dz - 6 && newFeet <= top + 0.5 && (!landed || top > landed.z + landed.h)) landed = bx;
    if (b.vz > 0 && prevFeet + b.hgt <= bx.z - bx.dz + 4 && newFeet + b.hgt > bx.z && (!ceil || bx.z < ceil.z)) ceil = bx;
  }
  if (ceil && b.vz > 0) { b.z = ceil.z - b.hgt; b.vz = 0; }
  const was = b.grounded;
  if (landed) {
    b.z = landed.z + landed.h; if (b.vz < -260 && !was) b.ev.push("land"); b.vz = 0; b.grounded = true; b.ground = landed; b.jumps = 0; b.airT = 0; b.lastGround = b.z;
    if (landed.hurt) landed.hurt(b);
  } else {
    if (was) b.coyote = 0.1; b.grounded = false; b.ground = null; b.airT += dt;
  }
  b.gz = gz;
  if (b.z < cfg.kill) { b.ev.push("void"); }
  return b.ev;
}

// séparation douce des personnages qui se touchent
function separate(list, cfg) {
  const sh = (cfg && cfg.shove) || 1;
  for (let i = 0; i < list.length; i++) for (let j = i + 1; j < list.length; j++) {
    const a = list[i], b = list[j]; if (!a.alive || !b.alive) continue; if (Math.abs(a.z - b.z) > a.hgt * 0.8) continue;
    const dx = b.x - a.x, dy = b.y - a.y, m = a.r + b.r; const d2 = dx * dx + dy * dy; if (d2 >= m * m) continue; const d = Math.sqrt(d2) || 0.01; const nx = dx / d, ny = dy / d, o = (m - d) / 2;
    a.x -= nx * o; a.y -= ny * o; b.x += nx * o; b.y += ny * o;
    const rv = (b.vx - a.vx) * nx + (b.vy - a.vy) * ny; if (rv < 0) { const j2 = -(1 + 0.25) * rv / 2 * sh; a.vx -= nx * j2; a.vy -= ny * j2; b.vx += nx * j2; b.vy += ny * j2; }
  }
}

// pion prêt à être envoyé au client
function pawnItem(b, meta, extra) {
  const it = { t: "pawn", id: meta.id, x: b.x, y: b.y, z: b.z, k: meta.k, n: meta.name, face: b.face, air: !b.grounded && b.z > (b.gz == null ? -1e9 : b.gz) + 3 ? 1 : 0, gz: b.gz == null ? b.z - 400 : b.gz };
  if (b.dive > 0) { it.tilt = 0.7; }
  return extra ? Object.assign(it, extra) : it;
}

// ---------- aides pour les bots ----------
// y a t il du sol à cet endroit à peu près à la hauteur z (ou juste en dessous). renvoie la hauteur du sol ou null
function groundAt(world, x, y, zMax, zMin) {
  let best = null; for (let i = 0; i < world.boxes.length; i++) { const bx = world.boxes[i]; if (!bx.solid) continue; const top = bx.z + bx.h; if (top > zMax || top < zMin) continue; if (!over(bx, x, y, 4)) continue; if (best == null || top > best) best = top; }
  return best;
}
// aide au saut. vrai si le joueur court vers un bord avec du sol atteignable de l'autre côté, il saute alors tout seul au bon moment
function assistJump(world, b, inp) {
  if (!b.alive || !b.grounded || b.stun > 0) return false;
  const ix = inp.x || 0, iy = inp.y || 0, il = Math.hypot(ix, iy); if (il < 0.3) return false;
  const sp = Math.hypot(b.vx, b.vy); if (sp < 120) return false;
  const ux = b.vx / sp, uy = b.vy / sp, z = b.z;
  if (groundAt(world, b.x + ux * (b.r + 16), b.y + uy * (b.r + 16), z + 20, z - 22) != null) return false;
  for (let d = 70; d <= 190; d += 30) { if (groundAt(world, b.x + ux * (b.r + d), b.y + uy * (b.r + d), z + 60, z - 70) != null) return true; }
  return false;
}
// commande simple pour aller vers (tx,ty). renvoie {x,y} dans la même convention que les touches du joueur
function goto(b, tx, ty, speed) { const dx = tx - b.x, dy = ty - b.y, d = Math.hypot(dx, dy) || 1; const s = Math.min(1, d / (speed || 40)); return { x: dx / d * s, y: dy / d * s, d }; }

module.exports = { World, body, step, separate, pawnItem, groundAt, assistJump, goto, overlap, over, surfV, DEF };

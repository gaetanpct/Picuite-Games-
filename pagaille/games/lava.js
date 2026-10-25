// Lave montante. Des tours de plateformes, un saut permet de monter de deux niveaux.
const U = require("../pg-util.js");
const W = 800, H = 560;
exports.create = function (ctx) {
  const rnd = ctx.rnd; const spd = 175 * ctx.speed;
  // tours imbriquées, chaque niveau est un rectangle plus petit posé sur le précédent
  const towers = []; const nT = Math.min(6, 2 + Math.ceil(ctx.n / 2));
  const spots = U.shuffle([[170, 150], [630, 150], [400, 130], [170, 410], [630, 410], [400, 430], [400, 280]], rnd);
  for (let i = 0; i < nT; i++) { const [cx, cy] = spots[i]; const top = i === 0 ? 7 : 4 + Math.floor(rnd() * 3); towers.push({ cx, cy, top }); }
  const plats = []; towers.forEach((tw) => { for (let lv = 1; lv <= tw.top; lv++) { const sz = 150 - lv * 13; plats.push({ x: tw.cx - sz / 2, y: tw.cy - sz / 2, w: sz, h: sz, lv }); } });
  const heightAt = (x, y) => { let hgt = 0; for (let i = 0; i < plats.length; i++) { const p = plats[i]; if (x >= p.x && x <= p.x + p.w && y >= p.y && y <= p.y + p.h && p.lv > hgt) hgt = p.lv; } return hgt; };
  const P = ctx.players.map((m, i) => { const a = (i / ctx.n) * Math.PI * 2 + 0.3; return { id: m.id, k: m.color, name: m.name, x: W / 2 + Math.cos(a) * 330, y: H / 2 + Math.sin(a) * 215, z: 0, air: 0, cd: 0, alive: true, burn: 0, maxZ: 0 }; });
  P.forEach((p) => { p.x = U.clamp(p.x, 24, W - 24); p.y = U.clamp(p.y, 24, H - 24); p.z = heightAt(p.x, p.y); });
  const falls = []; let t = 0; const topLv = Math.max.apply(null, towers.map((x) => x.top));
  const rate = (topLv + 1.2) / (36 * ctx.pace / ctx.speed); const startAfter = 5 / ctx.speed;
  const lavaAt = () => -0.6 + Math.max(0, t - startAfter) * rate;
  const inst = {
    done: false,
    update(dt) {
      t += dt; const L = lavaAt(); const dead = [];
      P.forEach((p) => {
        if (!p.alive) return; const i = ctx.input(p.id); const e = ctx.edge(p.id); const [vx, vy] = U.norm2(i.x, i.y);
        p.cd -= dt; p.air = Math.max(0, p.air - dt);
        if ((e.a || i.a) && p.air <= 0 && p.cd <= 0) { p.air = 0.55; p.cd = 0.8; }
        const climb = p.air > 0 ? 2.05 : 0.05; const sp = spd * (p.air > 0 ? 1.15 : 1);
        let nx = U.clamp(p.x + vx * sp * dt, 14, W - 14), ny = U.clamp(p.y + vy * sp * dt, 14, H - 14);
        if (heightAt(nx, ny) > p.z + climb) { if (heightAt(nx, p.y) <= p.z + climb) ny = p.y; else if (heightAt(p.x, ny) <= p.z + climb) nx = p.x; else { nx = p.x; ny = p.y; } }
        p.x = nx; p.y = ny; const h = heightAt(p.x, p.y);
        if (p.air <= 0) p.z = h;
        if (p.z > p.maxZ) p.maxZ = p.z;
        if (p.air <= 0 && p.z <= L) { p.burn += dt; if (p.burn > 0.55) { p.alive = false; dead.push(p.id); } } else p.burn = Math.max(0, p.burn - dt * 2);
      });
      const A = P.filter((p) => p.alive);
      for (let i = 0; i < A.length; i++) for (let j = i + 1; j < A.length; j++) { if (Math.abs(A[i].z - A[j].z) > 0.9) continue; const dx = A[j].x - A[i].x, dy = A[j].y - A[i].y, d = Math.hypot(dx, dy) || 0.01; if (d < 30) { const o = (30 - d) / 2; A[i].x -= dx / d * o; A[i].y -= dy / d * o; A[j].x += dx / d * o; A[j].y += dy / d * o; } }
      if (dead.length) falls.push(dead);
      if (P.filter((p) => p.alive).length <= 1 || t > 70) inst.done = true;
    },
    frame() {
      const L = lavaAt(); const items = [{ t: "rect", x: 0, y: 0, w: W, h: H, c: L >= 0 ? "#c73a1d" : "#5b4636" }];
      plats.forEach((p) => { const sunk = p.lv <= L; const warn = !sunk && p.lv <= L + 0.9; items.push({ t: "rect", x: p.x, y: p.y, w: p.w, h: p.h, c: sunk ? "#c73a1d" : warn ? "#e8742a" : "hsl(" + (200 - p.lv * 18) + ",45%," + (38 + p.lv * 4) + "%)", s: "rgba(0,0,0,.35)", r: 6 }); });
      towers.forEach((tw) => { if (tw.top > L) items.push({ t: "text", x: tw.cx, y: tw.cy + 5, v: String(tw.top), c: "rgba(255,255,255,.55)", s: 18 }); });
      P.forEach((p) => { if (p.alive) items.push({ t: "pawn", id: p.id, x: p.x, y: p.y, k: p.k, n: p.name, r: 15, z: p.z, air: p.air > 0 ? 1 : 0, ring: p.burn > 0 ? "#ff3b1a" : null }); });
      return { w: W, h: H, bg: "#2a1a14", items, hud: { title: "La lave monte, grimpe", lava: Math.max(0, L), chips: [{ text: P.filter((p) => p.alive).length + " en jeu" }] } };
    },
    ranking() {
      const al = P.filter((p) => p.alive).map((p) => p.id); const best = Math.max.apply(null, P.map((p) => p.maxZ)); const bonus = {};
      P.forEach((p) => { if (p.maxZ === best && best > 0) bonus[p.id] = 1; });
      return { groups: U.rankFromFalls(P.map((p) => p.id), falls, al), bonus };
    },
  };
  return inst;
};

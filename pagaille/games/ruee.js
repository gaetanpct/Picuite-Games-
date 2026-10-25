// Ruée vers l'or. Chaque tour on répartit en secret ses mineurs entre des gisements et la banque, puis tout est dévoilé.
// Le plus gros bataillon rafle un gisement, à plusieurs on se partage moins, une galerie fragile peut s'effondrer. La banque rapporte sans risque.
const U = require("../pg-util.js");

const PAL = ["#ef4b4b", "#3b82f6", "#34c36c", "#f5c518", "#9b5de5", "#ff8a1f", "#ff6fb5", "#1fc8c0"];
const SITES = [{ n: "Filon du nord", x: 150, y: 200 }, { n: "Mine de l'est", x: 330, y: 150 }, { n: "Puits du sud", x: 510, y: 150 }, { n: "Veine de l'ouest", x: 690, y: 200 }];
const BANK = { x: 420, y: 400 };
exports.create = function (ctx) {
  const rnd = ctx.rnd; const n = ctx.n; const ROUNDS = Math.max(3, Math.round(5 * ctx.len)); const M = 4; const BANKV = 3;
  const P = ctx.players.map((m, i) => ({ id: m.id, k: m.color, name: m.name, gold: 0, alloc: [0, 0, 0, 0, 0], lock: false, ex: {}, gain: 0, hist: [0, 0, 0, 0, 0], rounds: 0, best: 0 }));
  let round = 0, phase = "pre", left = 2, t = 0, sites = [], res = null, bestMove = null; const log = [];
  const hex = (k) => PAL[(k || 0) % PAL.length];
  const reserve = (p) => M - p.alloc.reduce((a, b) => a + b, 0);
  function newRound() {
    round++; const base = U.shuffle([20, 32, 46, 68], rnd).map((v) => Math.round(v * (1 + 0.12 * (round - 1)) * (0.92 + rnd() * 0.16)));
    const richest = base.indexOf(Math.max.apply(null, base));
    sites = SITES.map((s, i) => ({ idx: i, n: s.n, x: s.x, y: s.y, pot: base[i], cap: round >= 2 && i === richest && rnd() < 0.8 ? Math.max(4, Math.round(n * 1.25 + 1)) : 0 }));
    P.forEach((p) => { p.alloc = [0, 0, 0, 0, 0]; p.lock = false; p.gain = 0; p.ex.bt = null; }); res = null; phase = "plan"; left = 15 * ctx.pace; ctx.announce("Tour " + round + " sur " + ROUNDS + ", répartis tes " + M + " mineurs", 1800); ctx.snd("count");
  }
  // résultat d'un gisement. renvoie un tableau de gains par joueur
  function siteGain(s, al) {
    const rows = P.map((p) => ({ p, k: al(p) })).filter((r) => r.k > 0); const out = new Map(); if (!rows.length) return { out, why: "vide" };
    const total = rows.reduce((a, r) => a + r.k, 0); if (s.cap && total >= s.cap) return { out, why: "éboulement" };
    rows.sort((a, b) => b.k - a.k); const top = rows[0], second = rows[1];
    if (!second) { out.set(top.p.id, s.pot); return { out, why: "seul" }; }
    if (top.k >= 2 * second.k) { out.set(top.p.id, Math.round(s.pot * 0.9)); return { out, why: "domine" }; }
    const eff = 1 / (1 + 0.14 * (rows.length - 1)); rows.forEach((r) => out.set(r.p.id, Math.round(s.pot * (r.k / total) * eff))); return { out, why: "partage" };
  }
  function resolve() {
    P.forEach((p) => { const r = reserve(p); p.alloc[4] += r; }); // les mineurs non placés vont à la banque
    const detail = sites.map((s) => { const g = siteGain(s, (p) => p.alloc[s.idx]); return { s, g }; }); const gains = {}; P.forEach((p) => { gains[p.id] = p.alloc[4] * BANKV; });
    detail.forEach((d) => d.g.out.forEach((v, id) => { gains[id] += v; }));
    let bm = null; P.forEach((p) => { p.gain = gains[p.id]; p.gold += p.gain; p.hist.forEach((_, i) => { p.hist[i] += p.alloc[i]; }); p.rounds++;
      const risky = p.alloc.slice(0, 4).reduce((a, b) => a + b, 0); const score = p.gain - risky * BANKV * 0.5 + (p.alloc.slice(0, 4).filter((x) => x > 0).length === 1 && p.gain >= 40 ? 15 : 0); if (!bm || score > bm.score) bm = { id: p.id, score, gain: p.gain }; });
    if (bm && bm.gain >= 30) { const q = P.find((x) => x.id === bm.id); q.best = (q.best || 0) + 1; }
    res = { detail, gains }; phase = "reveal"; left = 5.2; ctx.snd("coin"); detail.forEach((d) => { if (d.g.why === "éboulement") { ctx.fx("boom", d.s.x, d.s.y, 0, "#ff9a3a"); ctx.shake(2.5); ctx.snd("boom"); } else if (d.g.out.size) ctx.fx("coin", d.s.x, d.s.y, 30, ""); });
    const top = P.slice().sort((a, b) => b.gain - a.gain)[0]; if (top) ctx.announce(top.name + " rafle " + top.gain + " or ce tour", 2400);
  }
  // les bots raisonnent sur ce qu'ils attendent des autres
  function botPlan(p) {
    const sk = ctx.skill(p.id); const foes = P.filter((q) => q !== p); const alloc = [0, 0, 0, 0, 0];
    const expOther = sites.map((s) => { let tot = 0, top = 0; foes.forEach((q) => { const prior = (M * 0.82) / 4; const h = q.rounds ? q.hist[s.idx] / q.rounds : prior; const e = q.rounds ? 0.65 * h + 0.35 * prior : prior; tot += e; top = Math.max(top, e); }); return { tot, top }; });
    const noise = sites.map((s) => (1 + (rnd() - 0.5) * (1 - sk) * 0.9));
    const val = (s, k) => { if (!k) return 0; const e = expOther[s.idx]; const O = e.tot; let g; if (k >= 2 * Math.max(0.5, e.top) && k >= 2) g = s.pot * 0.9; else g = s.pot * (k / (k + O)) / (1 + 0.14 * Math.min(foes.length, Math.ceil(O / 1.8))); if (s.cap && k + O >= s.cap - 0.5 * (1 - sk)) g *= sk > 0.5 ? 0.25 : 0.7; return g * noise[s.idx]; };
    const style = p.ex.style = p.ex.style || (rnd() < 0.2 ? "tout" : rnd() < 0.25 ? "banque" : "malin");
    for (let m = 0; m < M; m++) {
      let bestI = 4, bestV = BANKV * (style === "banque" ? 1.9 : 1) * 1; sites.forEach((s) => { const v = val(s, alloc[s.idx] + 1) - val(s, alloc[s.idx]) + (style === "tout" && alloc[s.idx] > 0 ? 4 : 0); if (v > bestV) { bestV = v; bestI = s.idx; } });
      alloc[bestI]++;
    }
    p.alloc = alloc; p.ex.bt = 1.4 + rnd() * 3.4 * (1.15 - sk);
  }
  function place(p, i, d) { if (p.lock || phase !== "plan") return; if (d > 0 && reserve(p) > 0 && i < 4) p.alloc[i]++; else if (d < 0 && p.alloc[i] > 0) p.alloc[i]--; p.err = ""; ctx.snd("coin"); }
  const inst = {
    done: false,
    live: false,
    update(dt) {
      t += dt; left -= dt;
      if (phase === "pre") { if (left <= 0) newRound(); }
      else if (phase === "plan") {
        P.forEach((p) => { if (p.lock) return; if (ctx.isBot(p.id)) { if (p.ex.bt == null) botPlan(p); p.ex.bt -= dt; if (p.ex.bt <= 0) { p.lock = true; ctx.snd("coin"); } } else { const e = ctx.edge(p.id); if (e.a) { p.lock = true; ctx.snd("coin"); } } });
        const A = P.filter((p) => ctx.present(p.id)); if (left <= 0 || (A.length && A.every((p) => p.lock))) resolve();
      } else if (phase === "reveal") { if (left <= 0) { if (round >= ROUNDS) inst.done = true; else newRound(); } }
    },
    scene() {
      const items = [{ t: "box", x: 450, y: 300, z: -40, w: 900, d: 600, h: 40, c: "#6b4a2b" }, { t: "box", x: 450, y: 300, z: -2, w: 860, d: 560, h: 2, c: "#8a6238", ns: 1 }];
      SITES.forEach((s) => { items.push({ t: "cyl", x: s.x, y: s.y, z: -2, r: 92, h: 10, c: "#3d2a18" }); items.push({ t: "deco", kind: "rock", x: s.x - 60, y: s.y - 70, z: -2, s: 2.2 }); items.push({ t: "deco", kind: "rock", x: s.x + 70, y: s.y - 60, z: -2, s: 1.8 }); });
      items.push({ t: "cyl", x: BANK.x, y: BANK.y, z: -2, r: 86, h: 10, c: "#2a3a55" }); items.push({ t: "chest", x: BANK.x, y: BANK.y, z: 8, s: 1.6 });
      items.push({ t: "text", x: BANK.x, y: BANK.y + 70, z: 6, v: "Banque, " + BANKV + " or par mineur", c: "#bcd4ff", s: 24 });
      [[60, 480], [840, 480], [60, 70], [840, 70]].forEach((l) => items.push({ t: "deco", kind: "lamp", x: l[0], y: l[1], z: -2, s: 1.4 }));
      return { w: 900, h: 600, cam: { tilt: 55, fov: 40, pad: 1.05, c: [450, 300], ht: 20 }, env: { sky: ["#2a1a0a", "#e8a850"], fog: "#6a4a22", fogN: 70, fogF: 250, ground: { c: "#2a1a0a", z: -200 }, lt: { h: ["#fff0d0", "#7a5a3a"], hi: 0.9, d: "#fff1d0", di: 0.9, dir: [-0.3, 1, 0.5] } }, items };
    },
    frame() {
      const items = [];
      sites.forEach((s) => { const d = res && res.detail[s.idx]; items.push({ t: "text", id: "pot" + s.idx, x: s.x, y: s.y - 6, z: 60, v: s.pot + " or", c: "#ffd23b", s: 30 }); items.push({ t: "text", id: "nm" + s.idx, x: s.x, y: s.y + 28, z: 4, v: s.n, c: "#f2e4c8", s: 18 }); if (s.cap) items.push({ t: "text", id: "cp" + s.idx, x: s.x, y: s.y + 52, z: 4, v: "éboulement à " + s.cap + " mineurs", c: "#ff8a6a", s: 16 }); items.push({ t: "coin", id: "co" + s.idx, x: s.x, y: s.y, z: 18, s: 1.4, vis: d && d.g.why === "éboulement" ? 0 : 1 });
        if (d) { const label = d.g.why === "éboulement" ? "Éboulement" : d.g.why === "vide" ? "Personne" : d.g.why === "seul" ? "Seul" : d.g.why === "domine" ? "Domine" : "Partage"; items.push({ t: "text", id: "rs" + s.idx, x: s.x, y: s.y - 52, z: 90, v: label, c: d.g.why === "éboulement" ? "#ff6a4a" : "#9be37a", s: 22 }); } });
      if (res) { res.detail.forEach((d) => { let off = 0; const rows = P.filter((p) => p.alloc[d.s.idx] > 0).sort((a, b) => b.alloc[d.s.idx] - a.alloc[d.s.idx]); rows.forEach((p, ri) => { const k = p.alloc[d.s.idx]; const x = d.s.x + (ri - (rows.length - 1) / 2) * 34, y = d.s.y + 70; items.push({ t: "cyl", id: "st" + p.id + "_" + d.s.idx, x, y, z: 0, r: 14, h: 8 + k * 9, c: hex(p.k), sm: 20 }); items.push({ t: "text", id: "tk" + p.id + "_" + d.s.idx, x, y: y + 4, z: 12 + k * 9, v: "x" + k + (d.g.out.get(p.id) ? " +" + d.g.out.get(p.id) : ""), c: "#ffffff", s: 17 }); }); });
        const bk = P.filter((p) => p.alloc[4] > 0); bk.forEach((p, ri) => { const x = BANK.x + (ri - (bk.length - 1) / 2) * 34, y = BANK.y - 70; items.push({ t: "cyl", id: "sb" + p.id, x, y, z: 0, r: 14, h: 8 + p.alloc[4] * 9, c: hex(p.k), sm: 20 }); items.push({ t: "text", id: "tb" + p.id, x, y: y + 4, z: 12 + p.alloc[4] * 9, v: "x" + p.alloc[4], c: "#fff", s: 17 }); });
      }
      const lead = P.slice().sort((a, b) => b.gold - a.gold)[0]; const lockN = P.filter((p) => p.lock).length;
      return { w: 900, h: 600, items, hud: { title: phase === "plan" ? "Répartis tes mineurs en secret" : phase === "reveal" ? "Voici les choix de chacun" : "", timer: phase === "plan" ? left : null, chips: [{ text: "Tour " + round + " sur " + ROUNDS }, { text: phase === "plan" ? lockN + " sur " + n + " prêts" : "En tête, " + lead.name + " avec " + lead.gold + " or" }] } };
    },
    priv(pid) {
      const p = P.find((x) => x.id === pid); if (!p) return null; const items = [];
      if (phase === "plan") { sites.forEach((s) => { if (p.alloc[s.idx]) items.push({ t: "text", id: "my" + s.idx, x: s.x, y: s.y + 74, z: 20, v: "Toi, x" + p.alloc[s.idx], c: hex(p.k), s: 24 }); }); if (p.alloc[4] + reserve(p)) items.push({ t: "text", id: "myb", x: BANK.x, y: BANK.y - 60, z: 20, v: "Toi, x" + (p.alloc[4] + reserve(p)), c: hex(p.k), s: 24 }); }
      const out = { items, bars: [{ label: "Trésor", pct: Math.min(100, p.gold / (ROUNDS * 40) * 100), c: "#ffd23b" }] };
      if (phase === "plan") {
        const groups = sites.map((s) => ({ label: s.n + ", " + s.pot + " or" + (s.cap ? " (éboulement à " + s.cap + ")" : "") + ", " + p.alloc[s.idx] + " mineur" + (p.alloc[s.idx] > 1 ? "s" : ""), btns: [{ id: "s" + s.idx + "-", t: "Retirer", dis: p.lock || p.alloc[s.idx] <= 0 }, { id: "s" + s.idx + "+", t: "Envoyer", dis: p.lock || reserve(p) <= 0 }] }));
        groups.push({ label: "Banque, " + (p.alloc[4] + reserve(p)) + " mineur" + (p.alloc[4] + reserve(p) > 1 ? "s" : "") + " sûrs, " + BANKV + " or chacun", btns: [] });
        out.ui = { title: reserve(p) + " mineur" + (reserve(p) > 1 ? "s" : "") + " à placer, le reste va à la banque", groups, lock: { id: "lock", t: p.lock ? "Prêt" : "Valider", dis: p.lock } };
      } else if (phase === "reveal") out.why = "Ce tour, tu gagnes " + p.gain + " or";
      return out;
    },
    onAct(pid, m) {
      const p = P.find((x) => x.id === pid); if (!p || phase !== "plan" || p.lock) return;
      if (m.type === "click") { let bi = -1, bd = 120; sites.forEach((s) => { const d = Math.hypot(m.x - s.x, m.y - s.y); if (d < bd) { bd = d; bi = s.idx; } }); if (bi >= 0) place(p, bi, 1); return; }
      if (m.type !== "btn") return; const id = m.id || ""; if (id === "lock") { p.lock = true; ctx.snd("coin"); return; } const mm = /^s([0-3])([+-])$/.exec(id); if (mm) place(p, Number(mm[1]), mm[2] === "+" ? 1 : -1);
    },
    ranking() {
      const sorted = P.slice().sort((a, b) => b.gold - a.gold); const groups = []; sorted.forEach((p) => { const last = groups[groups.length - 1]; if (last && P.find((x) => x.id === last[0]).gold === p.gold) last.push(p.id); else groups.push([p.id]); });
      const bonus = {}, notes = {}; const sm = P.slice().sort((a, b) => b.best - a.best)[0]; if (sm && sm.best >= 2) bonus[sm.id] = 2; P.forEach((p) => { notes[p.id] = p.gold + " or" + (p.best ? ", " + p.best + " coup" + (p.best > 1 ? "s" : "") + " malin" + (p.best > 1 ? "s" : "") : ""); });
      return { groups, bonus, notes, headline: "⛏️ " + sorted[0].name + " repart avec le plus gros trésor" };
    },
  };
  return inst;
};

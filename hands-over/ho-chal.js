// ============================================================
// HANDS OVER — Les épreuves
// Chaque épreuve garde ses secrets côté serveur et ne montre à chacun que ce qu'il a le droit de voir.
// init(part, opt) → état    view(c, pid, now) → ce que voit pid    act(c, pid, data, now)    tick(c, now)
// isDone(c, now)    result(c) → { scores, losers, reveal }    bot(c, pid, level, mem, now) → action ou null
// ============================================================
const { PAIRS } = require("./data/ho-data.js");
const rng = Math.random;
const shuffle = (a) => { const r = a.slice(); for (let i = r.length - 1; i > 0; i--) { const j = Math.floor(rng() * (i + 1)); [r[i], r[j]] = [r[j], r[i]]; } return r; };
const pickOne = (a) => a[Math.floor(rng() * a.length)];
const between = (a, b) => a + rng() * (b - a);
const LV = { figurant: 0, candidat: 1, veteran: 2, naif: 0, fute: 1, genie: 2, stagiaire: 0 };
const lv = (l) => (LV[l] !== undefined ? LV[l] : 1);
const D = {};

// ---------- Crocodile dentiste ----------
const RING = (a, b, n) => { const d = Math.abs(a - b) % n; return Math.min(d, n - d); };
const HOT = (d) => (d <= 1 ? "brûlant" : d === 2 ? "chaud" : d <= 4 ? "tiède" : "froid");
D.croco = {
  id: "croco", family: "chance", name: "Le crocodile dentiste", min: 2, ghostOk: false,
  rules: "Chacun son tour, appuie sur une dent. L'une d'elles déclenche la mâchoire et la main qui l'a pressée est perdue.",
  init(part, o) {
    const variant = o.variant && o.variant !== "mixte" ? o.variant : pickOne(["classique", "deux", "chaud", "mobile", "chrono"]);
    const teeth = 12; const nt = variant === "deux" ? 2 : 1; const traps = shuffle([...Array(teeth).keys()]).slice(0, nt);
    const turnMs = (variant === "chrono" ? 4500 : 10000) * o.speed;
    const c = { id: "croco", part, variant, teeth, traps, pressed: [], order: shuffle(part), turn: 0, turnMs, o, hints: {}, bite: null, done: false, botDelay: 0 };
    c.turnStart = Date.now(); c.turnEnds = c.turnStart + turnMs; c.botDelay = between(900, 2600);
    c.rulesExtra = variant === "classique" ? "Un seul piège caché." : variant === "deux" ? "Deux pièges cachés, la mâchoire est deux fois plus nerveuse." : variant === "chaud" ? "Après chaque dent sûre, on te dit si le piège est brûlant, chaud, tiède ou froid." : variant === "mobile" ? "Après chaque dent sûre, le piège change parfois de place." : "Tu n'as que quelques secondes par tour, sinon une dent est pressée à ta place.";
    return c;
  },
  view(c, pid, now) {
    return { variant: c.variant, extra: c.rulesExtra, teeth: c.teeth, pressed: c.pressed.map((p) => ({ i: p.i, by: p.by, hint: p.hint || null, auto: !!p.auto })), order: c.order, turn: c.done ? null : c.order[c.turn], turnEnds: c.turnEnds, nTraps: c.traps.length, bite: c.done ? c.bite : null, traps: c.done ? c.traps : null, left: c.teeth - c.pressed.length };
  },
  press(c, pid, i, now, auto) {
    if (c.done || c.pressed.some((p) => p.i === i)) return false;
    const rec = { i, by: pid, auto };
    if (c.traps.includes(i)) { c.pressed.push(rec); c.done = true; c.bite = { i, by: pid }; return true; }
    if (c.variant === "chaud") rec.hint = HOT(Math.min.apply(null, c.traps.map((t) => RING(t, i, c.teeth))));
    c.pressed.push(rec);
    if (c.variant === "mobile" && rng() < 0.55) { const free = [...Array(c.teeth).keys()].filter((x) => !c.pressed.some((p) => p.i === x)); if (free.length) c.traps = [pickOne(free)]; }
    c.turn = (c.turn + 1) % c.order.length; c.turnStart = now; c.turnEnds = now + c.turnMs; c.botDelay = between(900, 2600);
    return true;
  },
  act(c, pid, d, now) { if (c.done || c.order[c.turn] !== pid) return false; const i = Math.floor(+d.tooth); if (!(i >= 0 && i < c.teeth)) return false; return this.press(c, pid, i, now, false); },
  tick(c, now) {
    if (c.done || now < c.turnEnds) return false; const free = [...Array(c.teeth).keys()].filter((x) => !c.pressed.some((p) => p.i === x)); if (!free.length) return false;
    // à bout de temps, une dent est pressée à la place du joueur (jamais le piège connu, le serveur ne triche pas)
    return this.press(c, c.order[c.turn], pickOne(free), now, true);
  },
  isDone(c) { return c.done; },
  result(c) { const by = c.bite ? c.bite.by : null; const scores = {}; c.order.forEach((id) => { scores[id] = id === by ? -1 : 0; }); return { scores, losers: by ? [by] : [], reveal: { traps: c.traps, bite: c.bite } }; },
  bot(c, pid, level, mem, now) {
    if (c.done || c.order[c.turn] !== pid || now - c.turnStart < c.botDelay) return null; const L = lv(level);
    const free = [...Array(c.teeth).keys()].filter((x) => !c.pressed.some((p) => p.i === x)); let cand = free;
    if (c.variant === "chaud" && L >= 1) {
      const ok = free.filter((t) => c.pressed.every((p) => !p.hint || HOT(RING(p.i, t, c.teeth)) === p.hint));
      if (L === 2 || rng() < 0.6) cand = ok.length ? ok : free;
      // le piège est dans l'ensemble ok, on joue la dent qui a le moins de chances d'en faire partie
      if (L >= 1 && ok.length && ok.length < free.length) { const safe = free.filter((t) => !ok.includes(t)); if (safe.length) return { tooth: pickOne(safe) }; }
    }
    return { tooth: pickOne(cand) };
  },
};

// ---------- Collision ----------
D.collision = {
  id: "collision", family: "chance", name: "Collision", min: 3, ghostOk: false,
  rules: "Chacun choisit un numéro en secret. Les joueurs qui ont choisi le même numéro que d'autres se rentrent dedans, et le plus gros groupe perd une main.",
  init(part, o) { const n = Math.min(9, part.length + 1); return { id: "collision", part, n, ends: Date.now() + 14000 * o.speed, choice: {}, o }; },
  view(c, pid, now) { const done = this.isDone(c, now); return { n: c.n, ends: c.ends, chosen: Object.keys(c.choice).reduce((a, k) => { a[k] = true; return a; }, {}), mine: c.choice[pid] || null, all: done ? c.choice : null }; },
  act(c, pid, d) { if (!c.part.includes(pid) || c.choice[pid]) return false; const k = Math.floor(+d.n); if (!(k >= 1 && k <= c.n)) return false; c.choice[pid] = k; return true; },
  tick(c, now) { if (now >= c.ends) { let ch = false; c.part.forEach((id) => { if (!c.choice[id]) { c.choice[id] = 1 + Math.floor(rng() * c.n); ch = true; } }); return ch; } return false; },
  isDone(c, now) { return c.part.every((id) => c.choice[id]) || now >= c.ends; },
  result(c) {
    const groups = {}; c.part.forEach((id) => { const k = c.choice[id] || 1; (groups[k] = groups[k] || []).push(id); });
    let big = 1; Object.values(groups).forEach((g) => { if (g.length > big) big = g.length; });
    const losers = big >= 2 ? [].concat.apply([], Object.values(groups).filter((g) => g.length === big)) : [];
    const scores = {}; c.part.forEach((id) => { scores[id] = groups[c.choice[id]].length === 1 ? 2 : losers.includes(id) ? -1 : 0; });
    return { scores, losers, reveal: { choice: c.choice, groups } };
  },
  bot(c, pid, level, mem, now) {
    if (c.choice[pid]) return null; if (!mem.at) mem.at = now + between(900, 4500); if (now < mem.at) return null; const L = lv(level);
    const bias = L === 0 ? Math.floor(rng() * 3) + 1 : 1 + Math.floor(rng() * c.n); return { n: Math.min(c.n, bias) };
  },
};

// ---------- Simon (mémoire) ----------
D.simon = {
  id: "simon", family: "memoire", name: "Le Simon des ténèbres", min: 2, ghostOk: true,
  rules: "Mémorise la suite de couleurs, puis répète-la sans te tromper. Les ratés perdent une main, et s'il n'y en a aucun c'est le plus lent.",
  init(part, o) { const len = o.short ? 4 : 5 + Math.floor(rng() * 2); const seq = [...Array(len)].map(() => Math.floor(rng() * 4)); const now = Date.now(); const pace = 700 * o.speed; return { id: "simon", part, seq, pace, showStart: now + 1200, inputStart: now + 1200 + len * pace + 700, ends: now + 1200 + len * pace + 700 + (9000 + len * 1500) * o.speed, prog: {}, o }; },
  view(c, pid, now) { const done = this.isDone(c, now); return { seq: c.seq, pace: c.pace, showStart: c.showStart, inputStart: c.inputStart, ends: c.ends, prog: c.part.reduce((a, id) => { const p = c.prog[id] || { i: 0 }; a[id] = { i: p.i, fail: !!p.fail, done: !!p.doneAt }; return a; }, {}), now, over: done }; },
  act(c, pid, d, now) {
    if (!c.part.includes(pid) || now < c.inputStart || now > c.ends) return false; const p = c.prog[pid] || (c.prog[pid] = { i: 0 }); if (p.fail || p.doneAt) return false;
    const k = Math.floor(+d.tap); if (!(k >= 0 && k < 4)) return false;
    if (c.seq[p.i] !== k) { p.fail = true; p.failAt = now; return true; } p.i++; if (p.i >= c.seq.length) p.doneAt = now; return true;
  },
  tick() { return false; },
  isDone(c, now) { return now >= c.ends || c.part.every((id) => { const p = c.prog[id]; return p && (p.fail || p.doneAt); }); },
  result(c) {
    const scores = {}; const ok = [], bad = [];
    c.part.forEach((id) => { const p = c.prog[id] || { i: 0 }; if (p.doneAt) { scores[id] = 1000 - (p.doneAt - c.inputStart) / 10; ok.push(id); } else { scores[id] = p.i + (p.fail ? 0 : 0.5) - 100; bad.push(id); } });
    let losers = bad; if (!bad.length) { const slow = ok.slice().sort((a, b) => scores[a] - scores[b])[0]; losers = slow ? [slow] : []; }
    else if (bad.length > Math.ceil(c.part.length / 2)) { const min = Math.min.apply(null, bad.map((id) => scores[id])); losers = bad.filter((id) => scores[id] === min); }
    return { scores, losers, reveal: { seq: c.seq, prog: c.prog } };
  },
  bot(c, pid, level, mem, now) {
    if (now < c.inputStart) return null; const p = c.prog[pid] || { i: 0 }; if (p.fail || p.doneAt) return null; const L = lv(level);
    if (mem.errAt === undefined) { const pErr = [0.6, 0.18, 0.03][L]; mem.errAt = rng() < pErr ? Math.floor(rng() * c.seq.length) : -1; mem.next = now + between(500, 1400) * (L === 0 ? 1.6 : 1); }
    if (now < mem.next) return null; mem.next = now + between(280, 560) * (L === 0 ? 1.8 : L === 1 ? 1.2 : 0.9);
    const right = c.seq[p.i]; return { tap: p.i === mem.errAt ? (right + 1 + Math.floor(rng() * 3)) % 4 : right };
  },
};

// ---------- Réflexes (feu vert et chaises) ----------
D.reflex = {
  id: "reflex", family: "reflexe", name: "Réflexes", min: 2, ghostOk: true,
  rules: "Attends le signal sans bouger, puis appuie le plus vite possible. Appuyer trop tôt fait perdre une main, et sinon c'est le plus lent qui paie.",
  init(part, o) {
    const chair = (o.chair !== undefined ? !!o.chair : rng() < 0.4) && part.length >= 3; const now = Date.now(); const fireAt = now + between(2600, 6800) * o.speed;
    const feints = []; const nf = Math.floor(rng() * 3) + (rng() < 0.5 ? 1 : 0); let ft = now + 900;
    for (let i = 0; i < nf; i++) { ft += between(500, 1700) * o.speed; if (ft > fireAt - 650) break; feints.push({ at: Math.round(ft), d: Math.round(between(25, 55)) / 100 }); }
    return { id: "reflex", part, chair, chairs: chair ? part.length - 1 : 0, fireAt, ends: fireAt + 3800 * o.speed, taps: {}, early: {}, fired: false, o, feints, fi: 0 };
  },
  view(c, pid, now) { const fired = now >= c.fireAt; return { chair: c.chair, chairs: c.chairs, fired, firedAt: fired ? c.fireAt : null, feints: c.feints.slice(0, c.fi), taps: Object.keys(c.taps).reduce((a, k) => { a[k] = Math.round(c.taps[k]); return a; }, {}), early: c.early, ends: c.ends, wait: !fired }; },
  act(c, pid, d, now) {
    if (!c.part.includes(pid) || c.taps[pid] !== undefined || c.early[pid]) return false;
    if (now < c.fireAt) { c.early[pid] = true; return true; } c.taps[pid] = now - c.fireAt; return true;
  },
  tick(c, now) { if (c.fi < c.feints.length && now >= c.feints[c.fi].at - 350) { c.fi++; return true; } return !c.fired && now >= c.fireAt ? (c.fired = true) : false; },
  isDone(c, now) { return now >= c.ends || c.part.every((id) => c.taps[id] !== undefined || c.early[id]); },
  result(c) {
    const scores = {}; const early = c.part.filter((id) => c.early[id]);
    c.part.forEach((id) => { scores[id] = c.early[id] ? -9999 : c.taps[id] !== undefined ? 3000 - c.taps[id] : -5000; });
    let losers = early; if (!early.length) { const worst = c.part.slice().sort((a, b) => scores[a] - scores[b])[0]; losers = worst ? [worst] : []; }
    return { scores, losers, reveal: { taps: c.taps, early: c.early, chair: c.chair } };
  },
  bot(c, pid, level, mem, now) {
    if (c.taps[pid] !== undefined || c.early[pid]) return null; const L = lv(level);
    if (mem.at === undefined) { const jump = rng() < [0.2, 0.06, 0.01][L]; const react = [between(450, 850), between(300, 500), between(210, 340)][L]; mem.at = jump ? c.fireAt - between(150, 900) : c.fireAt + react; }
    return now >= mem.at ? { tap: true } : null;
  },
};

// ---------- Stop pile (précision) ----------
const tri = (f) => 1 - Math.abs(2 * (f - Math.floor(f)) - 1);
D.stoppile = {
  id: "stoppile", family: "precision", name: "Stop pile", min: 2, ghostOk: true,
  rules: "Un curseur va et vient. Arrête-le dans la zone dorée en appuyant au bon moment. Le moins précis perd une main.",
  init(part, o) { const now = Date.now(); const P = 2300 * o.speed; return { id: "stoppile", part, t0: now + 1600, P, target: between(0.25, 0.75), w: 0.07, ends: now + 1600 + 8500 * o.speed, stop: {}, o }; },
  pos(c, t) { return tri((t - c.t0) / c.P); },
  view(c, pid, now) { const done = this.isDone(c, now); return { t0: c.t0, P: c.P, target: c.target, w: c.w, ends: c.ends, now, stopped: Object.keys(c.stop).reduce((a, k) => { a[k] = true; return a; }, {}), errs: done ? Object.keys(c.stop).reduce((a, k) => { a[k] = Math.round(Math.abs(c.stop[k] - c.target) * 1000) / 1000; return a; }, {}) : null, mine: c.stop[pid] !== undefined ? c.stop[pid] : null }; },
  act(c, pid, d, now) { if (!c.part.includes(pid) || c.stop[pid] !== undefined || now < c.t0 || now > c.ends) return false; c.stop[pid] = this.pos(c, now); return true; },
  tick() { return false; },
  isDone(c, now) { return now >= c.ends || c.part.every((id) => c.stop[id] !== undefined); },
  result(c) {
    const scores = {}; c.part.forEach((id) => { scores[id] = c.stop[id] === undefined ? -1 : -Math.abs(c.stop[id] - c.target); });
    const order = c.part.slice().sort((a, b) => scores[a] - scores[b]); const k = c.part.length >= 6 ? 2 : 1;
    return { scores, losers: order.slice(0, k), reveal: { stop: c.stop, target: c.target } };
  },
  bot(c, pid, level, mem, now) {
    if (c.stop[pid] !== undefined || now < c.t0) return null; const L = lv(level);
    if (mem.at === undefined) {
      const sd = [0.17, 0.065, 0.022][L]; const aim = Math.max(0, Math.min(1, c.target + (rng() + rng() + rng() - 1.5) * 2 * sd)); let t = now + between(300, 1800);
      // on cherche le prochain instant où le curseur passe sur la cible visée
      for (let k = 0; k < 4000; k++) { if (Math.abs(this.pos(c, t) - aim) < 0.01) break; t += 4; } mem.at = Math.min(t, c.ends - 200);
    }
    return now >= mem.at ? { stop: true } : null;
  },
};

// ---------- Le coffre (déduction coopérative) ----------
D.coffre = {
  id: "coffre", family: "deduction", name: "Le coffre", min: 2, ghostOk: false,
  rules: "Un code de trois chiffres différents entre 1 et 6 ferme le coffre. Chaque essai dit combien de chiffres sont bien placés et combien sont ailleurs. Si l'équipe échoue, celui qui a le moins participé perd une main.",
  init(part, o) { const code = shuffle([1, 2, 3, 4, 5, 6]).slice(0, 3); return { id: "coffre", part, code, guesses: [], max: 10, ends: Date.now() + 75000 * o.speed, cracked: null, o, hv: {} }; },
  hover(c, pid, d) { if (!c.part.includes(pid) || c.cracked || !Array.isArray(d.code) || d.code.length !== 3) return false; const g = d.code.map((x) => Math.floor(+x)); if (g.some((x) => !(x >= 1 && x <= 6))) return false; if (c.hv[pid] && c.hv[pid].join() === g.join()) return false; c.hv[pid] = g; return true; },
  fb(code, g) { let exact = 0, near = 0; g.forEach((x, i) => { if (code[i] === x) exact++; else if (code.includes(x)) near++; }); return { exact, near }; },
  view(c, pid, now) { const done = this.isDone(c, now); return { guesses: c.guesses, left: c.max - c.guesses.length, ends: c.ends, cracked: c.cracked, code: done ? c.code : null, hv: done ? {} : c.hv }; },
  act(c, pid, d, now) {
    if (!c.part.includes(pid) || c.cracked || c.guesses.length >= c.max || now > c.ends) return false; const g = (d.guess || []).map((x) => Math.floor(+x));
    if (g.length !== 3 || g.some((x) => !(x >= 1 && x <= 6)) || new Set(g).size !== 3) return false;
    const f = this.fb(c.code, g); c.guesses.push({ by: pid, g, exact: f.exact, near: f.near }); if (f.exact === 3) c.cracked = pid; return true;
  },
  tick() { return false; },
  isDone(c, now) { return !!c.cracked || c.guesses.length >= c.max || now > c.ends; },
  result(c) {
    const scores = {}; const cnt = {}; c.part.forEach((id) => { cnt[id] = 0; scores[id] = 0; }); c.guesses.forEach((x) => { cnt[x.by]++; });
    if (c.cracked) { scores[c.cracked] = 3; c.part.forEach((id) => { if (id !== c.cracked) scores[id] = 1; }); return { scores, losers: [], reveal: { code: c.code, cracked: c.cracked } }; }
    const min = Math.min.apply(null, c.part.map((id) => cnt[id])); const low = c.part.filter((id) => cnt[id] === min); c.part.forEach((id) => { scores[id] = cnt[id]; });
    return { scores, losers: [pickOne(low)], reveal: { code: c.code, cracked: null } };
  },
  bot(c, pid, level, mem, now) {
    if (c.cracked || c.guesses.length >= c.max) return null; const L = lv(level);
    if (!mem.at) mem.at = now + between(3500, 7000) * (L === 2 ? 0.8 : 1.1);
    // le robot hésite à voix haute, son code en cours de composition se voit
    if (now < mem.at) { if (!mem.hvAt || now >= mem.hvAt) { mem.hvAt = now + between(700, 1600); c.hv[pid] = shuffle([1, 2, 3, 4, 5, 6]).slice(0, 3); } return null; } mem.at = now + between(5000, 9500);
    // on laisse des essais aux humains
    const humansLeft = c.max - c.guesses.length; if (humansLeft <= 4 && c.ends - now > 15000) return null;
    const all = []; for (let a = 1; a <= 6; a++) for (let b = 1; b <= 6; b++) for (let d = 1; d <= 6; d++) if (a !== b && a !== d && b !== d) all.push([a, b, d]);
    let cand = all.filter((g) => c.guesses.every((x) => { const f = this.fb(g, x.g); return f.exact === x.exact && f.near === x.near; }));
    if (!cand.length) cand = all; if (L === 0 || (L === 1 && rng() < 0.4)) cand = all.filter((g) => !c.guesses.some((x) => x.g.join() === g.join()));
    return { guess: pickOne(cand) };
  },
};

// ---------- La bombe (nerfs et bluff) ----------
D.bombe = {
  id: "bombe", family: "bluff", name: "La bombe", min: 2, ghostOk: false,
  rules: "Tout le monde a la main sur la bombe. Elle explose à un moment secret. Retire ta main avant, mais pas le premier, sinon tu passes pour un lâche.",
  init(part, o) { const now = Date.now(); const E = between(7500, 21000) * o.speed; return { id: "bombe", part, t0: now + 1500, E, vis: 6200 * o.speed, out: {}, o, over: false }; },
  view(c, pid, now) { const done = this.isDone(c, now); return { t0: c.t0, now, out: c.out, over: done, vis: c.vis, boom: done && Object.keys(c.out).length < c.part.length, E: done ? c.E : null, mineOut: c.out[pid] !== undefined }; },
  act(c, pid, d, now) { if (!c.part.includes(pid) || c.out[pid] !== undefined || now < c.t0) return false; if (now - c.t0 >= c.E) return false; c.out[pid] = Math.round(now - c.t0); return true; },
  tick() { return false; },
  isDone(c, now) { return now - c.t0 >= c.E || c.part.every((id) => c.out[id] !== undefined); },
  result(c) {
    const scores = {}; const stay = c.part.filter((id) => c.out[id] === undefined); c.part.forEach((id) => { scores[id] = c.out[id] !== undefined ? c.out[id] : -1; });
    let losers = stay; if (!stay.length) { const first = c.part.slice().sort((a, b) => c.out[a] - c.out[b])[0]; losers = first ? [first] : []; }
    return { scores, losers, reveal: { E: Math.round(c.E), out: c.out, boom: stay.length > 0 } };
  },
  bot(c, pid, level, mem, now) {
    if (c.out[pid] !== undefined || now < c.t0) return null; const L = lv(level);
    if (mem.w === undefined) mem.w = [between(2500, 15000), between(5500, 13500), between(6800, 11000)][L] * c.o.speed;
    // le vétéran attend qu'un autre retire sa main, puis le suit de près
    if (L === 2 && Object.keys(c.out).length) { if (mem.follow === undefined) mem.follow = now + between(200, 1100); return now >= Math.min(mem.follow, c.t0 + mem.w) ? { out: true } : null; }
    return now - c.t0 >= mem.w ? { out: true } : null;
  },
};

// ---------- Coup d'œil, compter les doigts levés ----------
D.coupdoeil = {
  id: "coupdoeil", family: "memoire", name: "Coup d'œil", min: 2, ghostOk: true,
  rules: "Des mains surgissent sur la table une fraction de seconde. Compte les doigts levés et donne le total. Trois manches, le plus faible total de points perd une main.",
  init(part, o) {
    const qs = []; const sp = Math.min(1.2, Math.max(0.75, o.speed));
    for (let k = 0; k < 3; k++) {
      const nh = [3, 4, 5][k] + (rng() < 0.35 ? 1 : 0); const hands = [];
      for (let h = 0; h < nh; h++) { const f = Math.floor(rng() * 6); const up = shuffle([0, 1, 2, 3, 4]).slice(0, f); hands.push({ up: [0, 1, 2, 3, 4].map((x) => up.includes(x)), r: Math.round((rng() - 0.5) * 70), s: rng() < 0.5 ? 1 : -1 }); }
      const v = hands.reduce((a, h) => a + h.up.filter(Boolean).length, 0); const set = new Set([v]); while (set.size < 4) { const d = pickOne([-3, -2, -1, 1, 2, 3]); if (v + d >= 0) set.add(v + d); }
      const choices = [...set].sort((x, y) => x - y); qs.push({ hands, v, choices, ok: choices.indexOf(v), flash: Math.round([1150, 900, 700][k] * sp) });
    }
    const now = Date.now(); return { id: "coupdoeil", part, qs, qi: 0, qStart: now + 2600, ansMs: 9000 * o.speed, ans: [{}, {}, {}], o, sent: 0 };
  },
  qEnds(c) { const q = c.qs[Math.min(c.qi, 2)]; return c.qStart + q.flash + c.ansMs; },
  view(c, pid, now) {
    const done = this.isDone(c, now); const qi = Math.min(c.qi, 2); const q = c.qs[qi]; const fEnd = c.qStart + q.flash;
    const show = !done && now >= c.qStart - 350 && now < fEnd + 150;
    return { qi, nh: now >= c.qStart ? q.hands.length : null, hands: show ? q.hands : null, flashStart: c.qStart, flashEnd: fEnd, choices: now >= fEnd ? q.choices : null, ends: this.qEnds(c), answered: Object.keys(c.ans[qi]).reduce((a, k) => { a[k] = true; return a; }, {}), mine: (c.ans[qi][pid] || {}).a, past: c.qs.slice(0, c.qi).map((x, i) => ({ v: x.v, ok: x.ok, mine: (c.ans[i][pid] || {}).a, choices: x.choices })), over: done, now };
  },
  act(c, pid, d, now) { if (!c.part.includes(pid) || c.qi > 2) return false; const q = c.qs[c.qi]; if (now < c.qStart + q.flash || c.ans[c.qi][pid]) return false; const a = Math.floor(+d.a); if (!(a >= 0 && a < 4)) return false; c.ans[c.qi][pid] = { a, t: now - c.qStart - q.flash }; return true; },
  tick(c, now) {
    if (c.qi > 2) return false; const q = c.qs[c.qi];
    // on envoie l'état juste avant l'apparition des mains, puis juste après leur disparition
    if (c.sent === 0 && now >= c.qStart - 350) { c.sent = 1; return true; }
    if (c.sent === 1 && now >= c.qStart + q.flash + 150) { c.sent = 2; return true; }
    const all = c.part.every((id) => c.ans[c.qi][id]);
    if (all || now >= this.qEnds(c)) { c.qi++; c.sent = 0; if (c.qi <= 2) c.qStart = now + 2200; return true; } return false;
  },
  isDone(c) { return c.qi > 2; },
  result(c) {
    const scores = {}, tm = {}; c.part.forEach((id) => { scores[id] = 0; tm[id] = 0; });
    c.qs.forEach((q, i) => c.part.forEach((id) => { const a = c.ans[i][id]; if (a) { tm[id] += a.t; if (a.a === q.ok) scores[id] += 100 + Math.max(0, 50 - a.t / 160); } else tm[id] += c.ansMs; }));
    c.part.forEach((id) => { scores[id] = Math.round(scores[id] * 10) / 10 - tm[id] / 1e7; });
    const order = c.part.slice().sort((a, b) => scores[a] - scores[b]);
    return { scores, losers: order.slice(0, c.part.length >= 6 ? 2 : 1), reveal: { vals: c.qs.map((q) => q.v), ans: c.ans.map((m, i) => Object.keys(m).reduce((a, k) => { a[k] = c.qs[i].choices[m[k].a]; return a; }, {})) } };
  },
  bot(c, pid, level, mem, now) {
    if (c.qi > 2 || c.ans[c.qi][pid]) return null; const q = c.qs[c.qi]; const fEnd = c.qStart + q.flash; if (now < fEnd) return null; const L = lv(level); const key = "q" + c.qi;
    if (mem[key] === undefined) mem[key] = { at: fEnd + [between(3000, 5600), between(1800, 3600), between(1100, 2500)][L] * c.o.speed, ok: rng() < [0.35, 0.68, 0.9][L] };
    if (now < mem[key].at) return null; const m = mem[key]; const near = [q.ok - 1, q.ok + 1].filter((x) => x >= 0 && x < 4);
    return { a: m.ok ? q.ok : pickOne(near.length ? near : [0, 1, 2, 3].filter((x) => x !== q.ok)) };
  },
};

// ---------- L'imposteur ----------
D.imposteur = {
  id: "imposteur", family: "deduction", name: "L'imposteur", min: 3, ghostOk: false,
  rules: "Tout le monde a le même mot sauf un imposteur qui en a un voisin. Chacun donne un indice puis on vote. Le joueur le plus accusé perd une main.",
  init(part, o) {
    const pair = pickOne(PAIRS); const swap = rng() < 0.5; const imp = pickOne(part); const now = Date.now(); const own = {};
    part.forEach((id) => { const isImp = id === imp; const side = (swap ? !isImp : isImp) ? "B" : "A"; const word = side === "A" ? pair.a : pair.b; const good = shuffle(pair.clues.filter((x) => x.t === "X")).slice(0, 3); const mine = shuffle(pair.clues.filter((x) => x.t === side)).slice(0, 3); own[id] = { word, side, options: shuffle(good.concat(mine)).map((x) => ({ w: x.w, t: x.t })) }; });
    return { id: "imposteur", part, pair, imp, own, clue: {}, vote: {}, clueEnds: now + 22000 * o.speed, voteEnds: now + 22000 * o.speed + 24000 * o.speed, o, phaseAt: "clue", hv: {} };
  },
  hover(c, pid, d) { if (!c.part.includes(pid) || this.phase(c, Date.now()) !== "vote" || c.vote[pid]) return false; const t = d.hv && c.part.includes(d.hv) && d.hv !== pid ? d.hv : null; if ((c.hv[pid] || null) === t) return false; c.hv[pid] = t; return true; },
  phase(c, now) { return now < c.clueEnds && !c.part.every((id) => c.clue[id] !== undefined) ? "clue" : "vote"; },
  view(c, pid, now) {
    const ph = this.phase(c, now); const done = this.isDone(c, now); const mine = c.own[pid];
    const clues = ph === "vote" || done ? c.part.map((id) => ({ by: id, w: c.own[id].options[c.clue[id] !== undefined ? c.clue[id] : 0].w })) : null;
    return { phase: done ? "reveal" : ph, word: mine ? mine.word : null, options: ph === "clue" && mine ? mine.options.map((x) => x.w) : null, myClue: c.clue[pid], clues, voted: Object.keys(c.vote).reduce((a, k) => { a[k] = true; return a; }, {}), myVote: c.vote[pid] || null, hv: ph === "vote" && !done ? Object.keys(c.hv).reduce((a, k) => { if (c.hv[k] && !c.vote[k]) a[k] = c.hv[k]; return a; }, {}) : {}, ends: ph === "clue" ? c.clueEnds : c.voteEnds, cluedBy: Object.keys(c.clue).reduce((a, k) => { a[k] = true; return a; }, {}), reveal: done ? { imp: c.imp, words: c.part.reduce((a, id) => { a[id] = c.own[id].word; return a; }, {}), votes: c.vote } : null };
  },
  act(c, pid, d, now) {
    if (!c.part.includes(pid)) return false; const ph = this.phase(c, now);
    if (ph === "clue" && d.clue !== undefined && c.clue[pid] === undefined) { const k = Math.floor(+d.clue); if (!(k >= 0 && k < 6)) return false; c.clue[pid] = k; return true; }
    if (ph === "vote" && d.vote && c.vote[pid] === undefined) { if (d.vote === pid || !c.part.includes(d.vote)) return false; c.vote[pid] = d.vote; return true; }
    return false;
  },
  tick(c, now) { let ch = false; if (now >= c.clueEnds) c.part.forEach((id) => { if (c.clue[id] === undefined) { c.clue[id] = Math.floor(rng() * 6); ch = true; } }); if (now >= c.voteEnds) c.part.forEach((id) => { if (!c.vote[id]) { c.vote[id] = pickOne(c.part.filter((x) => x !== id)); ch = true; } }); return ch; },
  isDone(c, now) { return now >= c.voteEnds || (c.part.every((id) => c.clue[id] !== undefined) && c.part.every((id) => c.vote[id])); },
  result(c) {
    const tally = {}; c.part.forEach((id) => { tally[id] = 0; }); Object.values(c.vote).forEach((v) => { if (tally[v] !== undefined) tally[v]++; });
    const max = Math.max.apply(null, Object.values(tally)); const top = c.part.filter((id) => tally[id] === max); const loser = top.includes(c.imp) && top.length > 1 && rng() < 0.5 ? pickOne(top.filter((x) => x !== c.imp)) : pickOne(top);
    const caught = loser === c.imp; const scores = {}; c.part.forEach((id) => { scores[id] = id === c.imp ? (caught ? -2 : 2) : (caught ? 1 : 0); });
    return { scores, losers: [loser], reveal: { imp: c.imp, caught, tally, words: c.part.reduce((a, id) => { a[id] = c.own[id].word; return a; }, {}) } };
  },
  bot(c, pid, level, mem, now) {
    const L = lv(level); const ph = this.phase(c, now); const mine = c.own[pid];
    if (ph === "clue" && c.clue[pid] === undefined) {
      if (!mem.c1) mem.c1 = now + between(1500, 8000); if (now < mem.c1) return null; const isImp = pid === c.imp;
      const idx = mine.options.map((o, i) => ({ o, i })).filter((x) => (isImp || L === 0 ? x.o.t === "X" || rng() < 0.4 : x.o.t === mine.side || rng() < 0.3 * (2 - L)));
      return { clue: pickOne(idx.length ? idx : mine.options.map((o, i) => ({ i }))).i };
    }
    if (ph === "vote" && !c.vote[pid]) {
      const others = c.part.filter((x) => x !== pid); if (!mem.v1) mem.v1 = now + between(2500, 11000);
      if (now < mem.v1) { if (!mem.hvAt || now >= mem.hvAt) { mem.hvAt = now + between(600, 1500); c.hv[pid] = pickOne(others); } return null; }
      let sus = others.filter((id) => { const w = c.own[id].options[c.clue[id] || 0]; return w && w.t !== "X" && w.t !== mine.side; });
      if (L === 0 || !sus.length) sus = others; return { vote: pickOne(sus) };
    }
    return null;
  },
};

// ---------- Les doigts ----------
D.doigts = {
  id: "doigts", family: "bluff", name: "Les doigts", min: 3, ghostOk: false,
  rules: "Lève en secret entre zéro et trois doigts et devine le total de tous les doigts levés. Le plus éloigné du bon total perd une main.",
  init(part, o) { return { id: "doigts", part, ends: Date.now() + 16000 * o.speed, f: {}, g: {}, o }; },
  view(c, pid, now) { const done = this.isDone(c, now); return { max: c.part.length * 3, ends: c.ends, locked: Object.keys(c.f).reduce((a, k) => { a[k] = true; return a; }, {}), mine: c.f[pid] !== undefined ? { f: c.f[pid], g: c.g[pid] } : null, reveal: done ? { f: c.f, g: c.g, sum: this.sum(c) } : null }; },
  sum(c) { return c.part.reduce((a, id) => a + (c.f[id] || 0), 0); },
  act(c, pid, d) { if (!c.part.includes(pid) || c.f[pid] !== undefined) return false; const f = Math.floor(+d.f), g = Math.floor(+d.g); if (!(f >= 0 && f <= 3 && g >= 0 && g <= c.part.length * 3)) return false; c.f[pid] = f; c.g[pid] = g; return true; },
  tick(c, now) { if (now < c.ends) return false; let ch = false; c.part.forEach((id) => { if (c.f[id] === undefined) { c.f[id] = Math.floor(rng() * 4); c.g[id] = Math.floor(rng() * (c.part.length * 3 + 1)); ch = true; } }); return ch; },
  isDone(c, now) { return now >= c.ends || c.part.every((id) => c.f[id] !== undefined); },
  result(c) {
    const S = this.sum(c); const dist = {}; const scores = {}; c.part.forEach((id) => { dist[id] = Math.abs((c.g[id] || 0) - S); scores[id] = (dist[id] === 0 ? 5 : 0) - dist[id]; });
    const max = Math.max.apply(null, Object.values(dist)); const worst = c.part.filter((id) => dist[id] === max); const losers = max === 0 ? [] : [pickOne(worst)];
    return { scores, losers, reveal: { f: c.f, g: c.g, sum: S } };
  },
  bot(c, pid, level, mem, now) {
    if (c.f[pid] !== undefined) return null; if (!mem.at) mem.at = now + between(2000, 9000); if (now < mem.at) return null; const L = lv(level); const n = c.part.length;
    const f = Math.floor(rng() * 4); const exp = f + 1.5 * (n - 1); const g = L === 0 ? Math.floor(rng() * (n * 3 + 1)) : Math.max(0, Math.min(n * 3, Math.round(exp + (rng() - 0.5) * (L === 1 ? 3 : 1.5)))); return { f, g };
  },
};


// ---------- Le duel des mains, pierre feuille ciseaux ----------
const PPC = ["Pierre", "Feuille", "Ciseaux"];
D.ppc = {
  id: "ppc", family: "chance", name: "Le duel des mains", min: 2, ghostOk: false,
  rules: "Choisis pierre, feuille ou ciseaux en secret. Chacun est comparé à tous les autres et celui qui a le pire bilan perd une main.",
  init(part, o) { return { id: "ppc", part, ends: Date.now() + 15000 * o.speed, pick: {}, o }; },
  bilan(c) { const b = {}; c.part.forEach((a) => { b[a] = 0; c.part.forEach((z) => { if (a === z || c.pick[a] === undefined || c.pick[z] === undefined) return; const d = (c.pick[a] - c.pick[z] + 3) % 3; if (d === 1) b[a]++; else if (d === 2) b[a]--; }); }); return b; },
  view(c, pid, now) { const done = this.isDone(c, now); return { ends: c.ends, names: PPC, mine: c.pick[pid] !== undefined ? c.pick[pid] : null, chosen: Object.keys(c.pick).reduce((a, k) => { a[k] = true; return a; }, {}), all: done ? c.pick : null, bil: done ? this.bilan(c) : null }; },
  act(c, pid, d) { if (!c.part.includes(pid) || c.pick[pid] !== undefined) return false; const k = Math.floor(+d.pick); if (!(k >= 0 && k <= 2)) return false; c.pick[pid] = k; return true; },
  tick(c, now) { if (now < c.ends) return false; let ch = false; c.part.forEach((id) => { if (c.pick[id] === undefined) { c.pick[id] = Math.floor(rng() * 3); ch = true; } }); return ch; },
  isDone(c, now) { return now >= c.ends || c.part.every((id) => c.pick[id] !== undefined); },
  result(c) {
    const b = this.bilan(c); const vals = c.part.map((id) => b[id]); const mn = Math.min.apply(null, vals), mx = Math.max.apply(null, vals);
    const worst = c.part.filter((id) => b[id] === mn); const losers = mn < mx ? [pickOne(worst)] : [];
    return { scores: b, losers, reveal: { pick: c.pick, bil: b, names: PPC } };
  },
  bot(c, pid, level, mem, now) { if (c.pick[pid] !== undefined) return null; if (!mem.at) mem.at = now + between(1500, 8000); if (now < mem.at) return null; return { pick: Math.floor(rng() * 3) }; },
};

// ---------- La main chaude, réflexes en grille ----------
const HOT_TOK = Symbol("srv");
D.hot = {
  id: "hot", family: "reflexe", name: "La main chaude", min: 2, ghostOk: true,
  rules: "Une main s'allume brièvement dans la grille. Touche-la avant qu'elle refroidisse, une erreur coûte un point. Le plus faible total perd une main.",
  init(part, o) {
    const start = Date.now() + 2500 * o.speed; const dur = Math.max(650, Math.min(1500, 1150 * o.speed)); const gap = 1650 * o.speed; const n = 12; const seq = []; let prev = -1;
    for (let i = 0; i < n; i++) { let cell; do { cell = Math.floor(rng() * 9); } while (cell === prev); prev = cell; seq.push({ cell, at: Math.round(i * gap + rng() * 350 * o.speed), dur: Math.round(dur) }); }
    const c = { id: "hot", part, start, seq, end: start + seq[n - 1].at + dur + 600, score: {}, got: {}, o }; part.forEach((id) => { c.score[id] = 0; }); return c;
  },
  litAt(c, t) { for (let i = 0; i < c.seq.length; i++) { const w = c.seq[i]; if (t >= c.start + w.at && t < c.start + w.at + w.dur) return i; } return -1; },
  view(c, pid, now) { return { start: c.start, seq: c.seq, end: c.end, scores: Object.assign({}, c.score), mine: c.score[pid] || 0, done: now >= c.end }; },
  act(c, pid, d, now) {
    if (!c.part.includes(pid)) return false; const cell = Math.floor(+d.cell); if (!(cell >= 0 && cell < 9)) return false; const t = d.srvTok === HOT_TOK ? d.srvAt : now; if (t < c.start || t >= c.end) return false;
    const i = this.litAt(c, t); const key = pid + "|" + i;
    if (i >= 0 && c.seq[i].cell === cell && !c.got[key]) { c.got[key] = true; c.score[pid]++; return true; }
    c.score[pid]--; return true;
  },
  tick() { return false; },
  isDone(c, now) { return now >= c.end; },
  result(c) {
    const vals = c.part.map((id) => c.score[id]); const mn = Math.min.apply(null, vals), mx = Math.max.apply(null, vals); const worst = c.part.filter((id) => c.score[id] === mn);
    return { scores: Object.assign({}, c.score), losers: mn < mx ? [pickOne(worst)] : [], reveal: { score: c.score, total: c.seq.length } };
  },
  bot(c, pid, level, mem, now) {
    const L = lv(level); if (!mem.plan) { mem.plan = c.seq.map((w, i) => ({ i, hit: rng() < [0.5, 0.75, 0.92][L], at: c.start + w.at + between([420, 300, 200][L], [800, 560, 380][L]) * (c.o.speed < 0.5 ? 0.3 : 1), cell: w.cell })); const miss = [3, 2, 1][L]; for (let k = 0; k < miss; k++) mem.plan.push({ i: -1, hit: true, at: c.start + between(0, c.end - c.start), cell: Math.floor(rng() * 9), wrong: true }); mem.plan.sort((a, b) => a.at - b.at); mem.ix = 0; }
    while (mem.ix < mem.plan.length && now >= mem.plan[mem.ix].at) { const q = mem.plan[mem.ix++]; if (!q.hit) continue; const w = q.i >= 0 ? c.seq[q.i] : null; const at = w ? Math.min(q.at, c.start + w.at + w.dur - 40) : q.at; return { cell: q.cell, srvAt: at, srvTok: HOT_TOK }; }
    return null;
  },
};


// ---------- Le couteau entre les doigts ----------
D.couteau = {
  id: "couteau", family: "reflexe", name: "Le couteau entre les doigts", min: 2, ghostOk: true,
  rules: "Le couteau pique entre tes doigts en rythme, de plus en plus vite. Frappe le bon espace au bon moment. Une erreur et le doigt saute, le premier qui se trompe perd une main.",
  init(part, o) {
    const n = o.short ? 20 : 26; const sp = Math.sqrt(o.speed); const beats = []; let t = 0, prev = -1;
    const sweep = [0, 1, 2, 3, 2, 1, 0, 1, 2, 3];
    for (let i = 0; i < n; i++) {
      const iv = Math.round((980 - (980 - 330) * Math.pow(i / (n - 1), 0.8)) * sp); if (i > 0) t += iv;
      let g; if (i < sweep.length) g = sweep[i]; else { do { g = Math.floor(rng() * 4); } while (g === prev); }
      prev = g; beats.push({ at: t, g, w: Math.round(Math.max(115, iv * 0.34)) });
    }
    const prog = {}; part.forEach((id) => { prog[id] = { i: 0, fail: -1, err: 0, last: 0 }; });
    return { id: "couteau", part, beats, n, t0: Date.now() + 3200, prog, o };
  },
  view(c, pid, now) { const done = this.isDone(c, now); return { t0: c.t0, beats: c.beats, n: c.n, ends: c.t0 + c.beats[c.n - 1].at + 1500, prog: c.part.reduce((a, id) => { const p = c.prog[id]; a[id] = { i: p.i, fail: p.fail, wrong: p.wrong === undefined ? null : p.wrong }; return a; }, {}), over: done, now }; },
  act(c, pid, d, now) {
    const p = c.prog[pid]; if (!p || p.fail >= 0 || p.i >= c.n) return false; const k = Math.floor(+d.gap); if (!(k >= 0 && k < 4)) return false;
    const at = isFinite(+d.at) && Math.abs(+d.at - now) < 700 ? +d.at : now; const b = c.beats[p.i]; const B = c.t0 + b.at;
    if (at >= B - b.w && at <= B + b.w && k === b.g) { p.i++; p.err += Math.abs(at - B); p.last = at; return true; }
    // un rebond juste après un coup réussi ne compte pas, tout le reste est une faute
    if (p.last && at - p.last < 120) return false;
    if (at < B - b.w - 260 && k === b.g && p.i === 0) return false;
    p.fail = p.i; p.failAt = now; p.wrong = k; return true;
  },
  tick(c, now) { let ch = false; c.part.forEach((id) => { const p = c.prog[id]; if (p.fail >= 0 || p.i >= c.n) return; const b = c.beats[p.i]; if (now > c.t0 + b.at + b.w + 320) { p.fail = p.i; p.failAt = now; p.wrong = -1; ch = true; } }); return ch; },
  isDone(c, now) { return now > c.t0 + c.beats[c.n - 1].at + 1500 || c.part.every((id) => c.prog[id].fail >= 0 || c.prog[id].i >= c.n); },
  result(c) {
    const scores = {}; c.part.forEach((id) => { const p = c.prog[id]; scores[id] = p.fail >= 0 ? p.fail - 100 : c.n * 10 - p.err / 100; });
    const failed = c.part.filter((id) => c.prog[id].fail >= 0); let losers;
    if (failed.length) losers = [failed.slice().sort((a, b) => c.prog[a].fail - c.prog[b].fail || c.prog[a].failAt - c.prog[b].failAt)[0]];
    else losers = [c.part.slice().sort((a, b) => scores[a] - scores[b])[0]];
    return { scores, losers, reveal: { prog: c.part.reduce((a, id) => { a[id] = { i: c.prog[id].i, fail: c.prog[id].fail }; return a; }, {}), n: c.n } };
  },
  bot(c, pid, level, mem, now) {
    const p = c.prog[pid]; if (!p || p.fail >= 0 || p.i >= c.n) return null; const L = lv(level);
    if (mem.failAt === undefined) { mem.failAt = c.n; for (let i = 0; i < c.n; i++) { const q = [0.95, 0.978, 0.993][L] - (i / c.n) * [0.09, 0.05, 0.02][L]; if (rng() > q) { mem.failAt = i; break; } } }
    const b = c.beats[p.i]; const B = c.t0 + b.at; if (mem.j === undefined || mem.ji !== p.i) { mem.ji = p.i; mem.j = (rng() - 0.5) * 2 * [110, 70, 35][L]; }
    if (now < B + mem.j - 40) return null; const wrong = p.i === mem.failAt; return { gap: wrong ? (b.g + 1 + Math.floor(rng() * 3)) % 4 : b.g, at: wrong ? now : Math.min(now, B + Math.max(-b.w + 10, Math.min(b.w - 10, mem.j))) };
  },
};

// ---------- L'étau ----------
D.etau = {
  id: "etau", family: "bluff", name: "L'étau", min: 2, ghostOk: false,
  rules: "Tout le monde garde la main dans l'étau en maintenant la touche. L'étau se resserre et chaque main qui se retire le fait aller plus vite. Le premier qui lâche perd une main, mais ceux qui restent quand il se ferme sont écrasés.",
  init(part, o) { const now = Date.now(); return { id: "etau", part, t0: now + Math.max(3200, 4200 * o.speed), base: 1 / (17000 * o.speed), Pc: between(0.36, 1), P: 0, lastT: 0, hold: {}, out: {}, started: false, closed: false, crushed: [], o }; },
  rate(c) { return c.base * (1 + 0.45 * Object.keys(c.out).length); },
  view(c, pid, now) { const done = this.isDone(c, now); return { t0: c.t0, P: c.P, rate: c.started && !done ? this.rate(c) : 0, at: now, hold: c.hold, out: c.out, started: c.started, over: done, closed: c.closed, crushed: c.crushed, Pc: done ? c.Pc : null, mineHold: !!c.hold[pid], mineOut: c.out[pid] !== undefined }; },
  act(c, pid, d, now) {
    if (!c.part.includes(pid) || c.out[pid] !== undefined || c.closed) return false;
    if (d.hold) { if (c.hold[pid]) return false; if (now >= c.t0) return false; c.hold[pid] = true; return true; }
    if (!c.hold[pid]) return false; c.hold[pid] = false; if (now >= c.t0 && c.started) c.out[pid] = Math.round(now - c.t0); return true;
  },
  tick(c, now) {
    if (c.closed) return false;
    if (!c.started) { if (now < c.t0) return false; c.started = true; c.lastT = now; c.part.forEach((id) => { if (!c.hold[id]) c.out[id] = 0; }); return true; }
    const dt = now - c.lastT; c.lastT = now; c.P += dt * this.rate(c);
    if (c.P >= c.Pc) { c.P = c.Pc; c.closed = true; c.crushed = c.part.filter((id) => c.hold[id] && c.out[id] === undefined); return true; }
    return false;
  },
  isDone(c) { return c.closed || (c.started && c.part.every((id) => c.out[id] !== undefined)); },
  result(c) {
    const scores = {}; c.part.forEach((id) => { scores[id] = c.out[id] !== undefined ? c.out[id] : -1; });
    let losers = c.crushed.slice();
    if (!losers.length) { const min = Math.min.apply(null, c.part.map((id) => c.out[id])); losers = c.part.filter((id) => c.out[id] === min); if (losers.length > Math.ceil(c.part.length / 2)) losers = [pickOne(losers)]; }
    return { scores, losers, reveal: { out: c.out, crushed: c.crushed, Pc: Math.round(c.Pc * 100) } };
  },
  bot(c, pid, level, mem, now) {
    if (c.out[pid] !== undefined || c.closed) return null; const L = lv(level);
    if (!c.started) { if (c.hold[pid]) return null; if (!mem.place) mem.place = c.t0 - between(600, 2800); return now >= mem.place ? { hold: true } : null; }
    if (!c.hold[pid]) return null;
    if (mem.thr === undefined) mem.thr = [between(0.08, 0.85), between(0.22, 0.7), between(0.3, 0.55)][L];
    const nOut = Object.keys(c.out).filter((k) => c.out[k] > 0).length;
    // un robot malin évite d'être le premier à lâcher, puis file dès qu'un autre a cédé
    if (L === 2) { if (nOut) { if (mem.follow === undefined) mem.follow = now + between(150, 900); return now >= mem.follow ? { hold: false } : null; } return c.P >= Math.max(mem.thr, 0.42) ? { hold: false } : null; }
    return c.P >= mem.thr ? { hold: false } : null;
  },
};

// ---------- Les gants ----------
const GLOVES = [["rouge", "#e63946"], ["bleu", "#3d7bd9"], ["vert", "#5ec26a"], ["jaune", "#ffd23f"], ["violet", "#9b5de5"], ["blanc", "#e9e4d4"]];
const KINDS = ["cuir", "laine", "caoutchouc"];
D.gants = {
  id: "gants", family: "chance", name: "Les gants", min: 2, ghostOk: false,
  rules: "Six gants sur la table, un seul cache un piège. Chacun à son tour en enfile un. Un indice tombe au début et après chaque gant sans danger. Chacun peut passer son tour une seule fois.",
  init(part, o) {
    const kinds = shuffle([0, 0, 1, 1, 2, 2]), hands = shuffle([0, 0, 0, 1, 1, 1]); const cols = shuffle([0, 1, 2, 3, 4, 5]);
    const gloves = cols.map((col, i) => ({ col, k: kinds[i], h: hands[i], by: null }));
    const c = { id: "gants", part, gloves, trap: Math.floor(rng() * 6), clues: [], order: shuffle(part), turn: 0, turnMs: 15000 * o.speed, passed: {}, done: false, o };
    this.clue(c); c.turnStart = Date.now(); c.turnEnds = c.turnStart + c.turnMs; c.botDelay = between(1500, 3500); return c;
  },
  ok(c, j, cl) { const g = c.gloves[j]; return cl.k === "kind" ? g.k === cl.v : cl.k === "hand" ? g.h === cl.v : j !== cl.v; },
  cons(c) { return c.gloves.map((g, j) => j).filter((j) => c.gloves[j].by === null && c.clues.every((cl) => this.ok(c, j, cl))); },
  clue(c) {
    const cons = this.cons(c); if (cons.length <= 2) return; const T = c.gloves[c.trap]; const cand = [];
    if (!c.clues.some((x) => x.k === "kind")) cand.push({ k: "kind", v: T.k, txt: "Le gant piégé est en " + KINDS[T.k] + "." });
    if (!c.clues.some((x) => x.k === "hand")) cand.push({ k: "hand", v: T.h, txt: "Le gant piégé est un gant " + (T.h ? "droit" : "gauche") + "." });
    c.gloves.forEach((g, j) => { if (j !== c.trap && g.by === null && !c.clues.some((x) => x.k === "not" && x.v === j)) cand.push({ k: "not", v: j, txt: "Le gant piégé n'est pas le gant " + GLOVES[g.col][0] + "." }); });
    const good = cand.filter((cl) => { const n = cons.filter((j) => this.ok(c, j, cl)).length; return n < cons.length && n >= 2; });
    if (good.length) c.clues.push(pickOne(good));
  },
  view(c, pid, now) { return { gloves: c.gloves.map((g) => ({ col: g.col, hex: GLOVES[g.col][1], name: GLOVES[g.col][0], k: KINDS[g.k], h: g.h ? "droit" : "gauche", by: g.by })), clues: c.clues.map((x) => x.txt), order: c.order, turn: c.done ? null : c.order[c.turn], turnEnds: c.turnEnds, passed: c.passed, left: c.gloves.filter((g) => g.by === null).length, bite: c.done ? c.bite : null, trap: c.done ? c.trap : null }; },
  next(c, now) { c.turn = (c.turn + 1) % c.order.length; c.turnStart = now; c.turnEnds = now + c.turnMs; c.botDelay = between(1500, 3800); },
  take(c, pid, j, now, auto) {
    const g = c.gloves[j]; if (!g || g.by !== null || c.done) return false; g.by = pid; g.auto = !!auto;
    if (j === c.trap) { c.done = true; c.bite = { j, by: pid }; return true; } this.clue(c); this.next(c, now); return true;
  },
  act(c, pid, d, now) {
    if (c.done || c.order[c.turn] !== pid) return false;
    if (d.pass) { const left = c.gloves.filter((g) => g.by === null).length; if (c.passed[pid] || left <= 1 || c.order.length < 2) return false; c.passed[pid] = true; this.next(c, now); return true; }
    return this.take(c, pid, Math.floor(+d.glove), now, false);
  },
  tick(c, now) { if (c.done || now < c.turnEnds) return false; const free = c.gloves.map((g, j) => j).filter((j) => c.gloves[j].by === null); return this.take(c, c.order[c.turn], pickOne(free), now, true); },
  isDone(c) { return c.done; },
  result(c) { const by = c.bite ? c.bite.by : null; const scores = {}; c.part.forEach((id) => { scores[id] = id === by ? -1 : 1; }); return { scores, losers: by ? [by] : [], reveal: { trap: c.trap, bite: c.bite, name: c.bite ? GLOVES[c.gloves[c.trap].col][0] : "" } }; },
  bot(c, pid, level, mem, now) {
    if (c.done || c.order[c.turn] !== pid || now - c.turnStart < c.botDelay) return null; const L = lv(level);
    const free = c.gloves.map((g, j) => j).filter((j) => c.gloves[j].by === null); const cons = this.cons(c); const safe = free.filter((j) => !cons.includes(j));
    if (safe.length && (L === 2 || (L === 1 && rng() < 0.8) || (L === 0 && rng() < 0.3))) return { glove: pickOne(safe) };
    if (!c.passed[pid] && free.length > 1 && free.length <= 3 && rng() < [0.2, 0.5, 0.85][L]) return { pass: true };
    return { glove: pickOne(L === 0 ? free : cons.length ? cons : free) };
  },
};

// ---------- La boîte noire ----------
const BOX_OBJ = [["une éponge", "mou"], ["une chaussette mouillée", "mou"], ["de la pâte à modeler", "mou"], ["une limace", "gluant", 0.8], ["de la gelée", "gluant"], ["des spaghettis froids", "gluant"], ["une perruque", "poilu"], ["une peluche", "poilu"], ["une brosse", "poilu"], ["une fourchette", "pointu"], ["un oursin", "pointu", 0.35], ["une pomme de pin", "pointu"], ["une bille", "lisse"], ["un savon", "lisse"], ["une cuillère", "lisse"]];
const TEX = { mou: "C'est mou", gluant: "C'est gluant", poilu: "C'est poilu", pointu: "C'est dur et pointu", lisse: "C'est lisse et froid" };
const CLAIMS = ["Sans danger", "Méfiance", "Ça mord"];
D.boite = {
  id: "boite", family: "deduction", name: "La boîte noire", min: 2, ghostOk: false,
  rules: "Chacun glisse d'abord la main dans une boîte et sent ce qu'il y a dedans, puis annonce aux autres ce qu'il en pense, vrai ou faux. Ensuite chacun à son tour plonge la main dans une autre boîte que la sienne. L'une d'elles mord.",
  init(part, o) {
    const nb = Math.min(9, part.length + 1); const trap = Math.floor(rng() * nb); const pool = shuffle(BOX_OBJ); const pointy = pool.filter((x) => x[1] === "pointu"); const rest = pool.filter((x) => x[1] !== "pointu");
    const nPointy = nb >= 4 ? 1 + (rng() < 0.4 ? 1 : 0) : rng() < 0.5 ? 1 : 0;
    const objs = shuffle(pointy.slice(0, nPointy).concat(rest.slice(0, nb - 1 - nPointy))); objs.splice(trap, 0, ["une mâchoire", "pointu", 0.5]);
    const feel = {}; const order = shuffle(part); const boxes = shuffle([...Array(nb).keys()]);
    order.forEach((id, i) => { const b = boxes[i]; const ob = objs[b]; const moved = rng() < (ob[2] || 0); feel[id] = { box: b, text: TEX[ob[1]] + (moved ? ", et ça a bougé" : "") + ".", t: ob[1], moved }; });
    const now = Date.now(); return { id: "boite", part, nb, trap, objs, feel, claim: {}, claimEnds: now + 22000 * o.speed, picks: {}, order: shuffle(part), turn: 0, turnMs: 12000 * o.speed, phase: "feel", done: false, bite: null, o };
  },
  view(c, pid, now) {
    const done = c.done; const mine = c.feel[pid] ? { box: c.feel[pid].box, text: c.feel[pid].text } : null; const pick = c.phase !== "feel";
    return { phase: done ? "reveal" : c.phase, nb: c.nb, mine, free: pick && !done && c.order[c.turn] === pid ? this.free(c, pid) : null, myClaim: c.claim[pid] === undefined ? null : c.claim[pid], names: CLAIMS, claimed: Object.keys(c.claim).reduce((a, k) => { a[k] = true; return a; }, {}), claims: pick ? c.part.map((id) => ({ by: id, box: c.feel[id].box, k: c.claim[id] })) : null, picks: c.picks, order: c.order, turn: pick && !done ? c.order[c.turn] : null, turnEnds: pick ? c.turnEnds : c.claimEnds, ends: pick ? null : c.claimEnds, bite: done ? c.bite : null, contents: done ? c.objs.map((x) => x[0]) : null, trap: done ? c.trap : null };
  },
  startPick(c, now) { c.phase = "pick"; c.turn = 0; c.turnStart = now; c.turnEnds = now + c.turnMs; c.botDelay = between(1600, 3800); },
  free(c, pid) { const f = [...Array(c.nb).keys()].filter((b) => c.picks[b] === undefined); const other = f.filter((b) => !c.feel[pid] || c.feel[pid].box !== b); return other.length ? other : f; },
  pick(c, pid, b, now, auto) {
    if (!this.free(c, pid).includes(b)) return false; c.picks[b] = pid;
    if (b === c.trap) { c.done = true; c.bite = { box: b, by: pid, auto: !!auto }; return true; }
    c.turn++; if (c.turn >= c.order.length) { c.done = true; return true; } c.turnStart = now; c.turnEnds = now + c.turnMs; c.botDelay = between(1600, 3800); return true;
  },
  act(c, pid, d, now) {
    if (c.done || !c.part.includes(pid)) return false;
    if (c.phase === "feel") { if (c.claim[pid] !== undefined) return false; const k = Math.floor(+d.claim); if (!(k >= 0 && k <= 2)) return false; c.claim[pid] = k; if (c.part.every((id) => c.claim[id] !== undefined)) this.startPick(c, now); return true; }
    if (c.order[c.turn] !== pid) return false; return this.pick(c, pid, Math.floor(+d.box), now, false);
  },
  tick(c, now) {
    if (c.done) return false;
    if (c.phase === "feel") { if (now < c.claimEnds) return false; c.part.forEach((id) => { if (c.claim[id] === undefined) c.claim[id] = 1; }); this.startPick(c, now); return true; }
    if (now < c.turnEnds) return false; const who = c.order[c.turn]; return this.pick(c, who, pickOne(this.free(c, who)), now, true);
  },
  isDone(c) { return c.done; },
  result(c) {
    const scores = {}; c.part.forEach((id) => { scores[id] = 0; }); const by = c.bite ? c.bite.by : null; const feeler = c.part.find((id) => c.feel[id].box === c.trap);
    if (by) scores[by] = -2; if (feeler && feeler !== by) scores[feeler] += by && c.claim[feeler] === 0 ? 2 : c.claim[feeler] === 2 ? 1 : 0;
    return { scores, losers: by ? [by] : [], reveal: { bite: c.bite, trap: c.trap, contents: c.objs.map((x) => x[0]), feeler: feeler || null, liar: feeler && c.claim[feeler] === 0 ? feeler : null } };
  },
  bot(c, pid, level, mem, now) {
    const L = lv(level); const f = c.feel[pid];
    if (c.phase === "feel") {
      if (c.claim[pid] !== undefined) return null; if (!mem.c) mem.c = now + between(2500, 9000); if (now < mem.c) return null;
      const truth = f.t === "pointu" ? (f.moved ? 2 : 1) : 0; const honest = rng() < [0.85, 0.72, 0.6][L];
      return { claim: honest ? truth : f.t === "pointu" ? 0 : pickOne([1, 2]) };
    }
    if (c.done || c.order[c.turn] !== pid || now - c.turnStart < c.botDelay) return null;
    const free = this.free(c, pid); if (L === 0 && rng() < 0.6) return { box: pickOne(free) };
    const risk = (b) => {
      if (f && f.box === b) return f.t === "pointu" ? (f.moved ? 9 : 4) : 0.05;
      const cl = c.part.find((id) => id !== pid && c.feel[id].box === b); let r = 1; if (cl !== undefined) { const k = c.claim[cl]; const trust = L === 2 ? 0.6 : 0.85; r = k === 0 ? 1 - 0.6 * trust : k === 1 ? 1.4 : 1 + 1.6 * trust; }
      return r * (0.85 + rng() * 0.3);
    };
    return { box: free.slice().sort((a, b) => risk(a) - risk(b))[0] };
  },
};

// ---------- Le bistouri ----------
D.bistouri = {
  id: "bistouri", family: "precision", name: "Le bistouri", min: 2, ghostOk: true,
  rules: "Retire les trois objets du patient avec la pince sans toucher les bords du passage. Chaque contact fait hurler le patient et compte comme une faute, à trois fautes tu es exclu. Le plus faible score perd une main.",
  init(part, o) { const now = Date.now(); const prog = {}; part.forEach((id) => { prog[id] = { got: [], strikes: 0, out: false, doneAt: 0, lastT: 0 }; }); return { id: "bistouri", part, lay: Math.floor(rng() * 3), n: 3, t0: now + 2600, ends: now + 2600 + 46000 * o.speed, prog, o }; },
  score(c, id) { const p = c.prog[id]; return p.got.length * 100 - p.strikes * 30 + (p.doneAt ? Math.max(0, c.ends - p.doneAt) / 200 : 0); },
  view(c, pid, now) { const done = this.isDone(c, now); return { lay: c.lay, n: c.n, t0: c.t0, ends: c.ends, prog: c.part.reduce((a, id) => { const p = c.prog[id]; a[id] = { got: p.got.slice(), strikes: p.strikes, out: p.out, done: !!p.doneAt }; return a; }, {}), over: done, scores: done ? c.part.reduce((a, id) => { a[id] = Math.round(this.score(c, id)); return a; }, {}) : null }; },
  act(c, pid, d, now) {
    const p = c.prog[pid]; if (!p || p.out || p.doneAt || now < c.t0 || now > c.ends) return false;
    if (d.got !== undefined) { const k = Math.floor(+d.got); if (!(k >= 0 && k < c.n) || p.got.includes(k)) return false; p.got.push(k); if (p.got.length >= c.n) p.doneAt = now; return true; }
    if (d.touch) { if (now - p.lastT < 450) return false; p.lastT = now; p.strikes++; if (p.strikes >= 3) p.out = true; return true; }
    return false;
  },
  tick() { return false; },
  isDone(c, now) { return now >= c.ends || c.part.every((id) => c.prog[id].out || c.prog[id].doneAt); },
  result(c) {
    const scores = {}; c.part.forEach((id) => { scores[id] = this.score(c, id); }); const order = c.part.slice().sort((a, b) => scores[a] - scores[b]);
    const mn = scores[order[0]], mx = scores[order[order.length - 1]]; const losers = mn < mx ? order.slice(0, c.part.length >= 6 ? 2 : 1) : [];
    return { scores, losers, reveal: { scores: c.part.reduce((a, id) => { a[id] = Math.round(scores[id]); return a; }, {}), prog: c.part.reduce((a, id) => { a[id] = { got: c.prog[id].got.length, strikes: c.prog[id].strikes }; return a; }, {}) } };
  },
  bot(c, pid, level, mem, now) {
    const p = c.prog[pid]; if (!p || p.out || p.doneAt || now < c.t0) return null; const L = lv(level);
    if (!mem.plan) {
      mem.plan = []; let t = c.t0 + between(800, 2000); let strikes = 0;
      for (let k = 0; k < c.n && strikes < 3; k++) {
        let tries = 0; for (;;) { const dur = [between(6500, 11000), between(4200, 7500), between(2800, 5200)][L] * Math.sqrt(c.o.speed); if (rng() < [0.5, 0.3, 0.12][L] && tries < 3) { t += dur * between(0.3, 0.8); mem.plan.push({ at: t, a: { touch: true } }); strikes++; tries++; t += 900; if (strikes >= 3) break; continue; } t += dur; mem.plan.push({ at: t, a: { got: k } }); break; }
      }
      mem.ix = 0;
    }
    if (mem.ix < mem.plan.length && now >= mem.plan[mem.ix].at) return mem.plan[mem.ix++].a;
    return null;
  },
};

module.exports = { D, IDS: Object.keys(D), lv };

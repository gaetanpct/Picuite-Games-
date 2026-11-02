// Suite logique. Une suite de nombres, de lettres ou de dessins avec un trou. Trouve vite ce qui manque.
// Plus on répond vite, plus on gagne de points. Une erreur te bloque quelques secondes. Les suites deviennent plus fines à chaque manche.
const U = require("../pg-util.js");

const COLORS = ["🔴", "🔵", "🟢", "🟡", "🟣", "🟠"], SHAPES = ["⭐", "❤️", "🔷", "🔺", "🌙", "🍀"], LET = "ABCDEFGHIJKLMNOPQRSTUVWXYZ";
exports.create = function (ctx) {
  const rnd = ctx.rnd; const ROUNDS = Math.max(4, Math.round(6 * (ctx.len < 0.8 ? 0.75 : ctx.len > 1.2 ? 1.2 : 1))); const LIM = 14 * ctx.pace;
  const P = ctx.players.map((m) => ({ id: m.id, k: m.color, name: m.name, score: 0, solved: false, gain: 0, wrong: 0, lockT: 0, tries: 0, right: 0, at: 0, ex: {} }));
  let round = 0, phase = "pre", left = 2.4, clock = 0, firstAt = null, q = null; const ri = (a, b) => a + Math.floor(rnd() * (b - a + 1));
  function gen(level) {
    const kinds = level <= 1 ? ["add", "mul", "icons"] : level <= 3 ? ["alt", "sq", "icons2", "letters", "add2"] : ["fib", "grow", "tri", "alt2", "letters2", "geo3"];
    const kind = U.pick(kinds, rnd); let seq = [], ans, opts, text = "Quel nombre manque ?";
    const nums = (arr, i) => { seq = arr.map(String); ans = arr[i]; seq[i] = "?"; opts = new Set([ans]); [1, -1, 2, -2, 10, -10, 3].forEach((d) => { if (opts.size < 4 && rnd() < 0.7 && ans + d > 0) opts.add(ans + d); }); for (let v = 1; opts.size < 4; v++) opts.add(ans + 4 + v); opts = U.shuffle([...opts], rnd).map(String); ans = String(ans); };
    const hole = (len) => len - 1 - (rnd() < 0.35 ? ri(0, 1) : 0);
    if (kind === "add" || kind === "add2") { const a = ri(1, 12), k = ri(2, kind === "add" ? 6 : 9); const arr = Array.from({ length: 6 }, (_, i) => a + i * k * (kind === "add2" && i > 2 ? 1 : 1)); nums(arr, hole(6)); }
    else if (kind === "mul") { const a = ri(1, 4), k = U.pick([2, 3], rnd); const arr = Array.from({ length: 5 }, (_, i) => a * Math.pow(k, i)); nums(arr, hole(5)); }
    else if (kind === "geo3") { const a = ri(1, 3), k = U.pick([2, 3, 4], rnd); const arr = Array.from({ length: 5 }, (_, i) => a * Math.pow(k, i)); nums(arr, hole(5)); }
    else if (kind === "alt" || kind === "alt2") { const a = ri(5, 20), u = ri(3, 8), d = ri(1, u - 1); const arr = [a]; for (let i = 1; i < 7; i++) arr.push(arr[i - 1] + (i % 2 ? u : -d)); nums(arr, hole(7)); }
    else if (kind === "sq") { const o = ri(0, 2); const arr = Array.from({ length: 6 }, (_, i) => (i + 1 + o) * (i + 1 + o)); nums(arr, hole(6)); }
    else if (kind === "tri") { const arr = Array.from({ length: 6 }, (_, i) => ((i + 1) * (i + 2)) / 2); nums(arr, hole(6)); }
    else if (kind === "fib") { const a = ri(1, 3), b = ri(1, 4); const arr = [a, b]; for (let i = 2; i < 7; i++) arr.push(arr[i - 1] + arr[i - 2]); nums(arr, hole(7)); }
    else if (kind === "grow") { const a = ri(1, 6); const arr = [a]; for (let i = 1; i < 7; i++) arr.push(arr[i - 1] + i + 1); nums(arr, hole(7)); text = "Les écarts changent, trouve la règle"; }
    else if (kind === "letters" || kind === "letters2") { const k = kind === "letters" ? ri(1, 3) : ri(2, 4); const a = ri(0, 26 - 6 * k - 1); const arr = Array.from({ length: 6 }, (_, i) => LET[a + i * k]); const i = hole(6); ans = arr[i]; seq = arr.slice(); seq[i] = "?"; const o = new Set([ans]); while (o.size < 4) { const c = LET[Math.max(0, Math.min(25, LET.indexOf(ans) + ri(-4, 4)))]; if (c) o.add(c); } opts = U.shuffle([...o], rnd); text = "Quelle lettre manque ?"; }
    else { // suites de dessins qui se répètent
      const set = U.shuffle(kind === "icons" ? COLORS : SHAPES, rnd); const pat = kind === "icons" ? [set[0], set[1], set[1]] : [set[0], set[1], set[2], set[1]]; const arr = Array.from({ length: kind === "icons" ? 8 : 9 }, (_, i) => pat[i % pat.length]); const i = arr.length - 1 - ri(0, 1); ans = arr[i]; seq = arr.slice(); seq[i] = "?"; opts = U.shuffle(set.slice(0, 4), rnd); if (!opts.includes(ans)) opts[0] = ans; opts = U.shuffle(opts, rnd); text = "Quel dessin continue le motif ?";
    }
    return { kind, seq, text, opts: opts.map(String), good: opts.map(String).indexOf(String(ans)), ans: String(ans) };
  }
  function newRound() { round++; q = gen(Math.min(4, Math.ceil(round / (ROUNDS / 4)))); P.forEach((p) => { p.solved = false; p.gain = 0; p.lockT = 0; p.tries = 0; p.pickI = -1; const sk = ctx.skill(p.id); p.ex.t = 2.3 + rnd() * 5.5 * (1.2 - sk * 0.7); p.ex.slip = rnd() < (1 - sk) * 0.4; }); clock = 0; firstAt = null; phase = "ask"; left = LIM; ctx.announce("Suite " + round + " sur " + ROUNDS, 1200); ctx.snd("go"); }
  function answer(p, i) {
    if (phase !== "ask" || p.solved || p.lockT > 0 || i < 0 || i >= q.opts.length) return; p.tries++; p.pickI = i;
    if (i === q.good) { p.solved = true; p.at = clock; p.right++; p.gain = Math.round(55 + 45 * Math.max(0, 1 - clock / LIM)) - (p.tries - 1) * 12; p.gain = Math.max(25, p.gain); p.score += p.gain; if (firstAt == null) { firstAt = clock; ctx.announce(p.name + " a trouvé", 1100); } ctx.snd("reveal"); }
    else { p.wrong++; p.lockT = 2.6; ctx.snd("lose"); }
  }
  function settle() { phase = "reveal"; left = 3.2; ctx.snd("coin"); }
  const inst = {
    done: false,
    update(dt) {
      left -= dt;
      if (phase === "pre") { if (left <= 0) newRound(); return; }
      if (phase === "ask") {
        clock += dt; P.forEach((p) => { p.lockT = Math.max(0, p.lockT - dt); if (!p.solved && ctx.isBot(p.id) && clock >= p.ex.t && p.lockT <= 0) { if (p.ex.slip) { p.ex.slip = false; answer(p, (q.good + 1 + Math.floor(rnd() * (q.opts.length - 1))) % q.opts.length); p.ex.t = clock + 2.6 + rnd() * 1.5; } else answer(p, q.good); } });
        const all = P.every((p) => p.solved || !ctx.present(p.id)); if (all || left <= 0 || (firstAt != null && clock - firstAt > 6.5)) settle();
      } else if (phase === "reveal" && left <= 0) { if (round >= ROUNDS) inst.done = true; else newRound(); }
    },
    frame() {
      const items = []; const n = q ? q.seq.length : 0; const step = Math.min(88, 640 / Math.max(1, n));
      if (q && phase !== "pre") { q.seq.forEach((s, i) => { const x = 360 + (i - (n - 1) / 2) * step; const hole = s === "?"; if (hole) items.push({ t: "box", x, y: 170, z: 0, w: step - 10, d: 80, h: 0, c: phase === "reveal" ? "#2f7d4a" : "#5a3a8a" }); items.push({ t: "text", x, y: 190, v: hole && phase === "reveal" ? q.ans : s, c: hole ? (phase === "reveal" ? "#ffffff" : "#ffd23b") : "#ffffff", s: /^[0-9A-Z?]+$/.test(s) ? 50 : 46 }); }); items.push({ t: "text", x: 360, y: 90, v: q.text, c: "#e8def8", s: 26 }); }
      else items.push({ t: "text", x: 360, y: 160, v: "Prépare ta logique", c: "#ffd23b", s: 40 });
      if (phase === "ask") items.push({ t: "box", x: 360, y: 262, z: 0, w: 600 * Math.max(0, left / LIM), d: 8, h: 0, c: left < 4 ? "#ff6a6a" : "#7ed957" });
      const rows = P.slice().sort((a, b) => b.score - a.score); rows.forEach((p, i) => { const col = i % 4, row = Math.floor(i / 4); const x = 90 + col * 180, y = 340 + row * 46; items.push({ t: "text", x, y, v: p.name + " " + p.score, c: p.solved ? "#9be37a" : p.lockT > 0 ? "#ff8a8a" : "#e8def8", s: 18 }); if (p.solved && phase !== "pre") items.push({ t: "text", x, y: y + 20, v: phase === "reveal" ? "+" + p.gain : "trouvé", c: "#9be37a", s: 14 }); else if (p.lockT > 0) items.push({ t: "text", x, y: y + 20, v: "bloqué", c: "#ff8a8a", s: 14 }); });
      return { w: 720, h: 340 + Math.ceil(P.length / 4) * 46 + 30, bg: "#1a1536", items, hud: { title: "Suite " + Math.max(1, round) + " sur " + ROUNDS + ", trouve ce qui manque", chips: [{ text: phase === "ask" ? P.filter((p) => p.solved).length + " sur " + P.length + " ont trouvé" : "Logique et rapidité" }] } };
    },
    priv(pid) {
      const p = P.find((x) => x.id === pid); if (!p) return null;
      if (phase === "ask") return { ui: { title: q.text, groups: [{ label: p.solved ? "Bonne réponse" : p.lockT > 0 ? "Raté, patiente un instant" : "Choisis vite", btns: q.opts.map((o, i) => ({ id: "a" + i, t: String(o), sel: p.solved && i === q.good, dis: p.solved || p.lockT > 0 })) }] } };
      if (phase === "reveal") return { why: p.solved ? "Bien joué, plus " + p.gain + " points" : "C'était " + q.ans };
      return { ui: null };
    },
    onAct(pid, m) { const p = P.find((x) => x.id === pid); if (!p || m.type !== "btn") return; const mm = /^a(\d)$/.exec(m.id || ""); if (mm) answer(p, Number(mm[1])); },
    ranking() {
      const groups = U.rankByScore(P, (p) => p.score, false, 0); const bonus = {}, notes = {}; P.forEach((p) => { notes[p.id] = p.right + " suite" + (p.right > 1 ? "s" : "") + " trouvée" + (p.right > 1 ? "s" : "") + " sur " + ROUNDS + ", " + p.score + " points" + (p.wrong ? ", " + p.wrong + " erreur" + (p.wrong > 1 ? "s" : "") : ""); });
      const perfect = P.filter((p) => p.right === ROUNDS && p.wrong === 0); if (perfect.length === 1) bonus[perfect[0].id] = 2;
      return { groups, bonus, notes, headline: "🧩 " + P.find((p) => p.id === groups[0][0]).name + " a l'esprit le plus logique" };
    },
  };
  return inst;
};

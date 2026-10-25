// Faux semblants, la version à deux joueurs du meurtre. Rôles secrets, choix simultanés.
const U = require("../pg-util.js");
const ROOMS = ["Salon", "Cuisine", "Jardin", "Cave"]; const ROLE = { M: "Meurtrier", D: "Détective", I: "Innocent" };
exports.create = function (ctx) {
  const rnd = ctx.rnd; const roles = U.shuffle(["M", "D", "I"], rnd).slice(0, 2);
  const P = ctx.players.map((m, i) => ({ id: m.id, k: m.color, name: m.name, role: roles[i], room: Math.floor(rnd() * 4), act: roles[i] === "M" ? "hide" : "wait", lock: false, alive: true, log: [], known: null }));
  let turn = 1, phase = "plan", left = 12 * ctx.pace, result = null; const TURNS = 5; let reveal = null;
  const other = (p) => P.find((q) => q !== p);
  function resolve() {
    const [a, b] = P; const lines = [];
    const same = a.room === b.room;
    // une accusation correcte gagne tout de suite, une accusation fausse fait perdre
    const acc = P.filter((p) => p.act === "accuse");
    if (acc.length) {
      let winner = null, loser = null;
      acc.forEach((p) => { const q = other(p); if (q.role === "M") { winner = winner || p; } else { loser = loser || p; } });
      if (winner && !(acc.length === 2 && acc.every((p) => other(p).role === "M"))) { result = { win: winner.id, why: winner.name + " a démasqué le meurtrier" }; }
      else if (acc.length === 2 && acc.every((p) => other(p).role === "M")) { result = { win: null, why: "Deux meurtriers qui s'accusent, personne ne gagne" }; }
      else if (loser) { result = { win: other(loser).id, why: loser.name + " a accusé à tort" }; }
    }
    if (!result) {
      P.forEach((p) => { if (p.role === "M" && p.act === "strike" && other(p).room === p.room) { other(p).alive = false; lines.push(p.name + " a frappé dans " + ROOMS[p.room]); } });
      if (!a.alive && !b.alive) result = { win: null, why: "Deux meurtriers se sont frappés en même temps" };
      else if (!a.alive) result = { win: b.id, why: b.name + " a frappé le premier" };
      else if (!b.alive) result = { win: a.id, why: a.name + " a frappé le premier" };
    }
    P.forEach((p) => { p.log = []; });
    P.forEach((p) => {
      if (same) p.log.push("Vous étiez dans la même pièce, " + ROOMS[p.room] + ".");
      if (same && p.role === "D" && p.act === "search") { p.known = ROLE[other(p).role]; p.log.push("Ta fouille révèle un " + ROLE[other(p).role].toLowerCase() + "."); }
      if (!same) p.log.push("Vous ne vous êtes pas croisés.");
    });
    reveal = { rooms: P.map((p) => p.room), same }; phase = "reveal"; left = 3.2;
  }
  const inst = {
    done: false,
    live: false,
    update(dt) {
      left -= dt;
      if (phase === "plan") {
        P.forEach((p) => { if (!ctx.isBot(p.id) || p.lock) return; if (p.bt == null) { const sk = ctx.skill(p.id); p.bt = 1.2 + rnd() * 4.5 * (1.2 - sk); p.room = Math.floor(rnd() * 4);
          if (p.role === "M") p.act = rnd() < 0.72 ? "strike" : "hide"; else if (p.role === "D") p.act = p.known === "Meurtrier" ? "accuse" : rnd() < 0.55 + sk * 0.2 ? "search" : "wait"; else p.act = (turn >= 4 && rnd() < 0.1 * (1.2 - sk)) ? "accuse" : "wait"; if (p.role === "D" && p.known === "Meurtrier" && rnd() < 0.15) p.act = "search"; }
          p.bt -= dt; if (p.bt <= 0) { p.lock = true; p.bt = null; } });
        const A = P.filter((p) => ctx.present(p.id));
        if (left <= 0 || (A.length && A.every((p) => p.lock))) resolve();
      } else if (phase === "reveal" && left <= 0) {
        if (result || turn >= TURNS) { inst.done = true; return; }
        turn++; phase = "plan"; left = 11 * ctx.pace; P.forEach((p) => { p.lock = false; p.bt = null; });
      }
    },
    frame() {
      const items = []; ROOMS.forEach((r, i) => { const cx = 40 + (i % 2) * 340 + 160, cy = 80 + Math.floor(i / 2) * 200 + 90; const hot = phase === "reveal" && reveal && reveal.rooms.includes(i); items.push({ t: "box", x: cx, y: cy, w: 320, d: 180, h: 0, c: hot ? "#4a5f8c" : "#33405c", lab: r, lc: "rgba(200,211,234,.85)" }); });
      if (phase === "reveal" && reveal) P.forEach((p, i) => { const r = p.room; items.push({ t: "pawn", id: p.id, x: 120 + (r % 2) * 340 + i * 90 + 30, y: 170 + Math.floor(r / 2) * 200 + 70, z: 0, k: p.k, n: p.name, dead: p.alive ? 0 : 1 }); });
      const lockN = P.filter((p) => p.lock).length;
      return { w: 720, h: 480, bg: "#141b2d", items, hud: { title: "Tour " + turn + " sur " + TURNS, timer: phase === "plan" ? Math.max(0, left) : null, chips: [{ text: lockN + " prêts" }].concat(phase === "reveal" && result ? [{ text: result.why }] : []) } };
    },
    priv(pid) {
      const p = P.find((x) => x.id === pid); if (!p) return null;
      const out = { role: { name: ROLE[p.role], c: p.role === "M" ? "#e53935" : p.role === "D" ? "#3b82f6" : "#34c36c", tip: p.role === "M" ? "Frappe l'autre joueur dans sa pièce, ou reste discret." : p.role === "D" ? "Fouille pour apprendre qui est l'autre, accuse seulement si tu es sûr." : "Ne te fais pas tuer, accuse seulement si tu es sûr." }, log: p.log, known: p.known, turn };
      if (phase === "plan") {
        const acts = p.role === "M" ? [["strike", "Frapper"], ["hide", "Rester discret"], ["accuse", "Accuser l'autre"]] : p.role === "D" ? [["search", "Fouiller"], ["wait", "Patienter"], ["accuse", "Accuser l'autre"]] : [["wait", "Patienter"], ["accuse", "Accuser l'autre"]];
        out.ui = { groups: [{ label: "Dans quelle pièce vas-tu", btns: ROOMS.map((r, i) => ({ id: "room" + i, t: r, sel: p.room === i, dis: p.lock })) }, { label: "Ton action", btns: acts.map(([id, t]) => ({ id: "act" + id, t, sel: p.act === id, dis: p.lock })) }], lock: { id: "lock", t: p.lock ? "Prêt" : "Valider", dis: p.lock } };
      } else if (reveal) { out.reveal = { rooms: reveal.rooms }; out.why = result ? result.why : null; }
      return out;
    },
    onAct(pid, m) {
      const p = P.find((x) => x.id === pid); if (!p || phase !== "plan" || p.lock || m.type !== "btn") return; const id = m.id || "";
      if (/^room[0-3]$/.test(id)) p.room = Number(id[4]);
      else if (id === "lock") p.lock = true;
      else if (id.startsWith("act")) { const a = id.slice(3); const ok = p.role === "M" ? ["strike", "hide", "accuse"] : p.role === "D" ? ["search", "wait", "accuse"] : ["wait", "accuse"]; if (ok.includes(a)) p.act = a; }
    },
    ranking() {
      const bonus = {}, notes = {};
      if (result && result.win) { const w = result.win; const l = P.find((p) => p.id !== w).id; if (turn <= 3) bonus[w] = 2; notes[w] = result.why; return { groups: [[w], [l]], bonus, notes }; }
      return { groups: [P.map((p) => p.id)], bonus, notes: result ? { [P[0].id]: result.why } : { [P[0].id]: "match nul après cinq tours" } };
    },
  };
  return inst;
};

// ============================================================
// BUS BAZAR — Actions des joueurs et des robots (prendre, donner, ranger, porter, éjecter)
// ============================================================
const L = require("./public/game/layout.js");
const Sim = require("./bb-sim.js");
const dist = (a, b) => Math.hypot(a.x - b.x, a.z - b.z);
const HOLD_TYPES = { fire: 1, puddle: 1, hatch: 1 };
const CAP = 34;
const onboardCount = (S) => S.npcs.filter((n) => ["board", "walk", "seat", "stand", "tumble", "sleep", "carried"].includes(n.st)).length;

function toast(S, p, text) { S.events.push({ k: "toast", to: p.id, text }); }
function itemOf(S, p) { return p.held && p.held.t === "item" ? S.items.find((x) => x.id === p.held.id) : null; }
function inRange(a, b, r) { return dist(a, b) <= r; }

function press(S, p, m) {
  const t = m.t; p.useAt = S.t;
  if (t === "cand") return accept(S, p, m.id, !!m.refuse);
  if (t === "npc") return pressNpc(S, p, m);
  if (t === "grab") return grab(S, p, m.id);
  if (t === "item") return pickup(S, p, m.id);
  if (t === "station") return station(S, p, m.id, m.k);
  if (t === "slot") return slot(S, p, m.id);
  if (t === "seat") return seatNpc(S, p, m.id);
  if (t === "door") return door(S, p);
  if (t === "rear") return rear(S, p);
  if (t === "fire" || t === "puddle" || t === "hatch") { p.hold = { t, id: m.id }; p.holdAt = S.t; if (t === "hatch" && !itemOf(S, p)) toast(S, p, "Il faut la caisse à outils en main."); if (t === "fire" && !(itemOf(S, p) || {}).t) toast(S, p, "Il faut l'extincteur en main."); return; }
}
function hold(S, p, m) { // maintien de la touche
  if (m.t === "npc" || HOLD_TYPES[m.t]) { if (!p.hold || p.hold.t !== m.t || p.hold.id !== m.id) { if (m.t === "npc") { const n = S.npcs.find((x) => x.id === m.id); if (!n || !(n.trouble || n.asleep || (n.need && L.NEEDS[n.need.type].hold))) return; } p.hold = { t: m.t, id: m.id }; } p.holdAt = S.t; }
}
function accept(S, p, id, refuse) {
  const n = S.npcs.find((x) => x.id === id); if (!n || n.st !== "wait" || S.phase !== "stop") return; if (p.role === "driver") return;
  if (refuse) { n.st = "gone"; S.stats.refused++; n.path = []; S.events.push({ k: "fixed" }); return; }
  if (onboardCount(S) >= CAP) return toast(S, p, "Le bus est plein.");
  S.npcs.forEach(() => {}); Sim.dockNpc(S, n); S.money += Math.round(n.fare * 0.15); S.events.push({ k: "cash" });
}
function pressNpc(S, p, m) {
  const n = S.npcs.find((x) => x.id === m.id); if (!n || n.st === "gone" || n.st === "wait") return; if (dist(n, p) > 2.2) return;
  const it = itemOf(S, p);
  if (n.need) {
    const N = L.NEEDS[n.need.type];
    if (N.item) {
      if (it && it.t === N.item && (n.need.type !== "valise" || it.owner === n.id)) {
        // donne l'objet
        n.mood = Math.min(100, n.mood + 24); S.rep += 0.3; S.stats.tips += 0; const type = n.need.type; n.need = null; n.needCd = 16 + S.rng() * 25;
        if (it.t === "bucket") { it.dirty = true; } else { it.gone = true; p.held = null; } if (it.t === "bag") { n.bag = null; }
        S.events.push({ k: "fixed" }); Sim.say(S, n.name + " est content.", "good", "😊"); return;
      }
      return toast(S, p, n.name + " voudrait " + (N.item === "bag" ? "sa valise" : "un objet que tu n'as pas en main") + ".");
    }
    if (N.seat) { const seat = Sim.freeSeat(S, n); if (!seat) return toast(S, p, "Plus aucune place libre."); n.seat = seat.i; n.st = "walk"; n.path = [{ x: seat.aisle ? seat.x : (seat.x < 0 ? -0.55 : 0.55), z: seat.z }, { x: seat.x, z: seat.z, final: true }]; n.need = null; n.mood += 12; S.events.push({ k: "fixed" }); return; }
    if (N.stop) return toast(S, p, n.name + " doit descendre. Demande au conducteur de s'arrêter au plus vite.");
    if (N.hold) { p.hold = { t: "npc", id: n.id }; p.holdAt = S.t; return; }
  }
  if (n.trouble || n.asleep) { p.hold = { t: "npc", id: n.id }; p.holdAt = S.t; return; }
  toast(S, p, n.name + " n'a besoin de rien.");
}
function grab(S, p, id) {
  if (p.held) return toast(S, p, "Tes mains sont pleines."); if (p.role === "driver") return;
  const n = S.npcs.find((x) => x.id === id); if (!n || dist(n, p) > 1.8 || !["seat", "stand", "walk", "sleep", "tumble"].includes(n.st)) return;
  if (n.kind === "enfant" && !n.trouble) return toast(S, p, "On ne porte pas un enfant sage.");
  n.st0 = n.st; n.st = "carried"; n.carriedBy = p.id; n.seat0 = n.seat !== null ? n.seat : n.seat0; n.seat = null; n.asleep = false; n.path = []; p.held = { t: "npc", id: n.id }; n.prog = 0;
}
function pickup(S, p, id) {
  if (p.held) return toast(S, p, "Tes mains sont pleines."); if (p.role === "driver") return;
  const it = S.items.find((x) => x.id === id); if (!it || it.holder || dist(it, p) > 2.0) return;
  if (it.state === "slot") { it.slot = null; }
  if (it.state === "wait" || it.state === "plat") { if (it.t === "crate" && onboardCount(S) < 0) return; }
  it.state = "free"; it.holder = p.id; it.y = 1; p.held = { t: "item", id: it.id }; if (it.t === "chick") S.events.push({ k: "chick" });
}
function station(S, p, id, k) {
  const st = L.stations.find((x) => x.id === id); if (!st || dist(st, p) > st.r + 0.5) return; if (p.role === "driver") return;
  const cur = itemOf(S, p);
  if (cur) { if (L.ITEMS[cur.t] && st.give.includes(cur.t) || (id === "cart" && cur.t === "mop")) { cur.gone = true; p.held = null; } else toast(S, p, "Tes mains sont pleines."); return; }
  let kind = k; const gives = id === "cart" ? ["snack", "drink", "mop"] : st.give; if (!gives.includes(kind)) kind = gives[0]; if (!kind) return;
  if (S.items.filter((x) => x.t === kind && !x.gone).length >= 6 && kind !== "tools" && kind !== "ext") return toast(S, p, "Il y en a déjà assez en circulation.");
  const exist = S.items.find((x) => x.t === kind && (kind === "tools" || kind === "ext" || kind === "aid") && !x.gone && !x.holder);
  if (exist) { exist.holder = p.id; p.held = { t: "item", id: exist.id }; exist.state = "free"; exist.slot = null; return; }
  if ((kind === "tools" || kind === "ext" || kind === "aid") && S.items.some((x) => x.t === kind && !x.gone)) return toast(S, p, "Quelqu'un tient déjà cet objet.");
  const it = { id: Sim.nid(S), t: kind, x: p.x, y: 1, z: p.z, vx: 0, vz: 0, vy: 0, holder: p.id, slot: null, hp: 100, state: "free" }; S.items.push(it); p.held = { t: "item", id: it.id };
}
function slot(S, p, id) {
  const sl = L.slots[id]; if (!sl || dist(sl, p) > 2.0) return; const here = S.items.find((x) => x.state === "slot" && x.slot === id && !x.gone);
  const cur = itemOf(S, p);
  if (cur) { if (here) return toast(S, p, "Cet emplacement est déjà pris."); if (cur.t !== "crate" && cur.t !== "bag") return toast(S, p, "Seuls les colis et les valises se rangent ici."); cur.holder = null; p.held = null; cur.state = "slot"; cur.slot = id; cur.x = sl.x; cur.y = sl.y; cur.z = sl.z; cur.vx = cur.vz = cur.vy = 0; S.events.push({ k: "fixed" }); return; }
  if (here && !p.held) { here.holder = p.id; here.state = "free"; here.slot = null; p.held = { t: "item", id: here.id }; }
}
function seatNpc(S, p, id) {
  if (!p.held || p.held.t !== "npc") return; const s = L.seats[id]; if (!s || dist(s, p) > 2.0) return; if (S.npcs.some((n) => n.seat === id && n.st !== "gone")) return toast(S, p, "Cette place est occupée.");
  const n = S.npcs.find((x) => x.id === p.held.id); if (!n) return; p.held = null; n.carriedBy = null; n.seat = id; n.st = "walk"; n.x = s.aisle ? (s.x < 0 ? -0.5 : 0.5) : (s.x < 0 ? -0.55 : 0.55); n.z = s.z; n.path = [{ x: s.x, z: s.z, final: true }]; n.mood += 8; S.events.push({ k: "fixed" });
}
function door(S, p) {
  if (p.role !== "driver") return; const B = S.bus;
  if (S.phase !== "stop") return toast(S, p, "On ne descend pas du bus en roulant.");
  const busy = S.npcs.filter((n) => (n.st === "board" && n.outside === false) || (n.st === "leave" && n.x < L.BUS.x1 + 0.3)).length;
  if (busy) return toast(S, p, "Des passagers montent ou descendent encore.");
  if (Object.values(S.players).some((q) => !q.bot && q.out)) return toast(S, p, "Un équipier est encore sur le quai.");
  Sim.departNow(S);
}
function rear(S, p) {
  if (dist(p, L.REAR) > 2.4 && dist(p, { x: 0, z: -7.4 }) > 2.4) return; const B = S.bus;
  if (B.rear) { B.rear = false; Sim.say(S, "La porte de secours est refermée.", "good", "🚪"); S.events.push({ k: "fixed" }); }
  else { if (S.phase === "drive" && !S.cfg.eject) return toast(S, p, "L'éjection est désactivée dans ce salon."); B.rear = true; Sim.say(S, p.name + " ouvre la porte de secours.", "info", "🚪"); }
}
function drop(S, p, throwIt) {
  const h = p.held; if (!h) return;
  if (h.t === "npc") {
    const n = S.npcs.find((x) => x.id === h.id); if (!n) { p.held = null; return; }
    const atDoor = S.phase === "stop" && S.bus.door && p.x > L.BUS.x1 - 0.9 && Math.abs(p.z - L.DOOR.z) < 1.3;
    const atRear = S.bus.rear && p.z < L.BUS.z0 + 1.4 && Math.abs(p.x) < 1.1;
    if (atDoor || atRear) {
      if (!S.cfg.eject) { toast(S, p, "L'éjection est désactivée dans ce salon."); return Sim.dropHeld(S, p); }
      p.held = null; n.carriedBy = null; n.st = "ejected"; n.t2 = 0; n.vx = atRear ? 0 : 3.2; n.vz = atRear ? -3.5 : 0; S.stats.ejected++;
      const bad = n.trouble || n.wasTrouble || n.mood < 25; S.rep -= bad ? 1.2 : 7; S.npcs.forEach((m) => { if (m !== n && (m.st === "seat" || m.st === "stand")) m.mood += bad ? 4 : -14; });
      Sim.say(S, n.name + " est éjecté" + (bad ? ", les autres applaudissent." : " sans raison, les passagers sont choqués."), bad ? "info" : "bad", "🛫"); S.events.push({ k: "eject" }); return;
    }
    return Sim.dropHeld(S, p);
  }
  const it = S.items.find((x) => x.id === h.id); if (!it) { p.held = null; return; }
  if (throwIt && it.t !== "chick") {
    p.held = null; it.holder = null; it.state = "free"; it.x = p.x + Math.sin(p.yaw) * 0.6; it.z = p.z + Math.cos(p.yaw) * 0.6; it.y = 1.1; it.vy = 2.6; it.vx = Math.sin(p.yaw) * 6.5; it.vz = Math.cos(p.yaw) * 6.5; return;
  }
  Sim.dropHeld(S, p);
}
function apply(S, p, m) {
  if (!m) return; const a = m.a;
  if (a === "use") { if (m.e) press(S, p, m); else hold(S, p, m); }
  else if (a === "drop") drop(S, p, false);
  else if (a === "throw") drop(S, p, true);
  else if (a === "horn" && p.role === "driver") { S.bus.horn = 0.9; S.events.push({ k: "horn" }); }
}
module.exports = { apply, press, drop, onboardCount, CAP, accept, grab, pickup, station, slot, seatNpc, rear, door };

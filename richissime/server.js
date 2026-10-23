// ============================================================
// RICHISSIME DESTINY — Serveur (Express + Socket.io)
// Serveur autoritaire. Le contenu des scènes et le moteur restent dans lib/,
// jamais envoyés au navigateur. Chaque joueur reçoit uniquement sa vue filtrée.
// ============================================================
const fs = require("fs");
const os = require("os");
const zlib = require("zlib");
const path = require("path");
const http = require("http");
const express = require("express");
const { Server } = require("socket.io");

const { Game } = require("./lib/engine");
const R = require("./lib/rules");
const Settings = require("./lib/settings");
const social = require("./lib/social");
const View = require("./lib/view");
const kit = require("./lib/content");

const PORT = process.env.PORT || 3000;
const TS = Math.max(0.001, Number(process.env.RICHISSIME_TIME_SCALE) || 1);
module.exports = function mount(server, prefix) {
const app = express.Router();
const io = new Server(server, { path: prefix + "/socket.io", pingInterval: 10000, pingTimeout: 20000, maxHttpBufferSize: 1e6 });

app.get("/health", (req, res) => res.json({ ok: true, rooms: rooms.size, scenes: kit.EVENTS.length }));
app.use(express.static(path.join(__dirname, "public"), { extensions: ["html"], maxAge: 0 }));

const rooms = new Map();
const MAX_PLAYERS = 6;
const GRACE_LOBBY_MS = 60 * 1000 * TS;
const AFK_AUTO_MS = 45 * 1000 * TS;
const ACCESSORIES = ["🎩", "👑", "🕶️", "🎀", "🧢", "🎓", "🪖", "🤠", "🧐", "🎧", "🌸", "🦊", "🐱", "🐸", "🦄", "🐙"];
const COLORS = ["#c9a13b", "#e5583c", "#2f7f9d", "#6a4fb3", "#2e9a62", "#d4549a", "#e08a1e", "#3a3f6b"];
const STARS = require("./lib/stars");
const rng = Math.random;

function makeCode() {
  const letters = "ABCDEFGHJKLMNPQRSTUVWXYZ";
  for (let tries = 0; tries < 200; tries++) {
    let c = "";
    for (let i = 0; i < 4; i++) c += letters[Math.floor(rng() * letters.length)];
    if (!rooms.has(c)) return c;
  }
  return null;
}
function makeId() { return Math.random().toString(36).slice(2, 10); }
function cleanName(s, fallback) {
  const t = String(s || "").replace(/[\u0000-\u001f<>]/g, "").trim().slice(0, 16);
  return t || fallback;
}
function cleanAvatar(a, prev) {
  const acc = a && ACCESSORIES.includes(a.acc) ? a.acc : prev ? prev.acc : ACCESSORIES[0];
  const color = a && /^#[0-9a-fA-F]{6}$/.test(String(a.color || "")) ? a.color : prev ? prev.color : COLORS[0];
  return { acc, color };
}

function META() {
  return {
    schema: Settings.SCHEMA,
    gifts: Object.keys(R.GIFTS).map((k) => ({ id: k, l: R.GIFTS[k].l, ic: R.GIFTS[k].ic, d: R.GIFTS[k].d })),
    accessories: ACCESSORIES, colors: COLORS, maxPlayers: MAX_PLAYERS,
    stats: R.STATS, traits: R.TRAITS,
    scenes: kit.EVENTS.length,
  };
}

function publicRoom(room, forToken) {
  const host = room.players.find((p) => p.token === room.hostToken);
  return {
    code: room.code, status: room.status, hostId: host ? host.id : null, settings: room.settings,
    players: room.players.map((p, seat) => ({
      id: p.id, seat, name: p.name, gender: p.gender, avatar: p.avatar, gift: p.gift, bot: p.isBot, ready: p.ready,
      connected: p.isBot ? true : p.connected, you: p.token === forToken, auto: !!p.auto, left: !!p.left,
    })),
  };
}
function broadcastRoom(room) {
  room.players.forEach((p) => {
    if (p.isBot || !p.socketId) return;
    try { io.to(p.socketId).emit("room:state", publicRoom(room, p.token)); } catch (e) { /* ignore */ }
  });
}

// ---------- état de jeu, envoyé seulement s'il a changé ----------
function sendGame(room, force) {
  if (!room.engine) return;
  const eng = room.engine;
  room.players.forEach((p, seat) => {
    if (p.isBot || !p.socketId) return;
    try {
      const st = View.getStateFor(eng, eng.relay && eng.relay[seat] !== undefined ? eng.relay[seat] : seat);
      st.turbo = room.turbo ? "on" : "off";
      const key = JSON.stringify(st);
      if (!force && p.lastKey === key) return;
      p.lastKey = key;
      st.serverTime = Date.now();
      st.autoSeats = room.players.map((q) => !!q.auto);
      io.to(p.socketId).emit("game:state", st);
    } catch (e) { console.error("sendGame", e); }
  });
}

function sysChat(room, text) {
  const msg = { id: makeId(), system: true, text, t: Date.now() };
  room.chat.push(msg); if (room.chat.length > 60) room.chat.shift();
  room.players.forEach((p) => { if (!p.isBot && p.socketId) io.to(p.socketId).emit("chat:message", msg); });
}

function clearTimers(room) { if (room.loop) clearInterval(room.loop); room.loop = null; }
function deleteRoomIfEmpty(room) {
  const humans = room.players.filter((p) => !p.isBot && !p.left);
  if (!humans.length) { clearTimers(room); rooms.delete(room.code); }
}
function ensureHost(room) {
  const host = room.players.find((p) => p.token === room.hostToken && !p.isBot && !p.left);
  if (host) return;
  const next = room.players.find((p) => !p.isBot && !p.left && p.connected) || room.players.find((p) => !p.isBot && !p.left);
  if (next) room.hostToken = next.token;
}

// ---------- partie ----------
function startGame(room) {
  const players = room.players.map((p) => ({ name: p.name, gender: p.gender, gift: p.gift, avatar: p.avatar, bot: p.isBot }));
  room.settings = Settings.normalize(room.settings);
  room.engine = new Game({ settings: room.settings, rng: Math.random, timeScale: TS, players });
  room.status = "game";
  room.turbo = false; room.players.forEach((p) => { p.left = false; p.auto = false; p.lastKey = null; });
  room.engine.start();
  sysChat(room, "🎓 La partie commence ! Bonne vie à tous.");
  broadcastRoom(room);
  clearTimers(room);
  room.loop = setInterval(() => stepRoom(room), 400);
  sendGame(room, true);
}

function syncAuto(room) {
  const eng = room.engine;
  room.players.forEach((p, seat) => {
    if (p.isBot) return;
    const ep = eng.players[eng.relay && eng.relay[seat] !== undefined ? eng.relay[seat] : seat];
    const away = p.left || (!p.connected && p.disconnectedAt && Date.now() - p.disconnectedAt > AFK_AUTO_MS);
    if (away && !ep.auto) { ep.auto = true; p.auto = true; broadcastRoom(room); }
    if (!away && p.connected && p.auto && ep.auto && !p.left) { /* reprise de contrôle à la reconnexion */ }
  });
}

// Force l'étape en cours à se terminer tout de suite (accélération)
function forceStep(room) {
  const eng = room.engine; const now = Date.now();
  if (["agenda", "respond", "recap"].includes(eng.phase)) eng.deadline = now - 1;
  else if (eng.phase === "review" && eng.review) eng.review.deadline = now - 1;
  else if (eng.phase === "group" && eng.group) eng.group.deadline = now - 1;
  else if (eng.phase === "mini") { (eng.minis || []).forEach((m) => { if (m.state === "play") m.deadline = now - 1; }); eng.miniHold = 0; }
  else if (eng.phase === "event") eng.players.forEach((p) => { if (p.alive && p.scene) p.scene.deadline = now - 1; });
}
function stepRoom(room) {
  const eng = room.engine;
  if (!eng) return;
  try {
    // Mode accéléré. À chaque battement, on force plusieurs étapes d'affilée. Il s'arrête tout seul dès que le vote commence
    // ou que la partie finit, et le bouton d'arrêt le coupe tout de suite.
    eng.turbo = !!room.turbo;
    if (room.turbo) {
      for (let i = 0; i < 6 && room.turbo; i++) {
        if (eng.phase === "review" || eng.phase === "over") { room.turbo = false; break; }
        forceStep(room);
        syncAuto(room);
        eng.tick();
        if (eng.phase === "review" || eng.phase === "over") room.turbo = false;
      }
      eng.turbo = !!room.turbo;
    } else syncAuto(room);
    eng.tick();
    if (eng.phase === "over" && room.status === "game") {
      room.status = "over";
      sysChat(room, "🪦 La partie est terminée. Découvrez le classement.");
      broadcastRoom(room);
    }
  } catch (e) { console.error("tick", e); }
  sendGame(room);
}


// ============================================================
// Sauvegarde des parties. Le serveur peut redémarrer à tout moment (mise à jour, veille, panne), et une partie
// perdue ruine la soirée. Trois filets de sécurité.
//   1. sur le disque du serveur, toutes les quelques secondes
//   2. chaque joueur reçoit une copie compressée qu'il garde dans son navigateur
//   3. si le serveur a tout oublié, le navigateur peut remonter la partie à l'identique
// ============================================================
const DATA_DIR = process.env.RICHISSIME_DATA || path.join(os.tmpdir(), "richissime-parties");
const SAVE_FILE = path.join(DATA_DIR, "parties.json");
const MAX_AGE_MS = 8 * 60 * 60 * 1000;
const TIME_KEYS = /deadline|botAt|until|expire|^at$/i;

function snapshotRoom(room) {
  const eng = room.engine;
  if (!eng) return null;
  const engineData = {};
  Object.keys(eng).forEach((k) => { if (typeof eng[k] !== "function" && k !== "minigames") engineData[k] = eng[k]; });
  return {
    v: 1, savedAt: Date.now(),
    room: {
      code: room.code, status: room.status, hostToken: room.hostToken, settings: room.settings, chat: room.chat.slice(-40), turbo: false, created: room.created,
      players: room.players.map((p) => ({ id: p.id, token: p.token, name: p.name, gender: p.gender, avatar: p.avatar, gift: p.gift, isBot: p.isBot, ready: p.ready, left: !!p.left, auto: !!p.auto })),
    },
    engine: engineData,
  };
}
function shiftTimes(o, delta, seen) {
  if (!o || typeof o !== "object" || seen.has(o)) return;
  seen.add(o);
  Object.keys(o).forEach((k) => {
    const v = o[k];
    if (typeof v === "number") { if (v > 1e11 && TIME_KEYS.test(k)) o[k] = v + delta; }
    else if (v && typeof v === "object") shiftTimes(v, delta, seen);
  });
}
function restoreRoom(snap) {
  if (!snap || snap.v !== 1 || !snap.room || !snap.engine || !Array.isArray(snap.room.players)) throw new Error("copie illisible");
  const r = snap.room;
  const code = String(r.code || "").toUpperCase();
  if (!/^[A-Z]{4}$/.test(code)) throw new Error("code invalide");
  if (!Array.isArray(snap.engine.players) || snap.engine.players.length !== r.players.length) throw new Error("joueurs incohérents");
  const eng = new Game({ settings: snap.engine.settings || r.settings, rng: Math.random, timeScale: TS, players: [] });
  Object.keys(snap.engine).forEach((k) => { if (k !== "rng" && k !== "clock" && k !== "minigames" && k !== "timeScale") eng[k] = snap.engine[k]; });
  shiftTimes(eng, Date.now() - (snap.savedAt || Date.now()), new WeakSet());
  eng.turbo = false;
  const room = {
    code, status: r.status === "over" ? "over" : r.status === "lobby" ? "game" : r.status, hostToken: r.hostToken, settings: r.settings || eng.settings, chat: Array.isArray(r.chat) ? r.chat : [],
    engine: eng, loop: null, created: r.created || Date.now(), turbo: false, restoredAt: Date.now(),
    players: r.players.map((p) => ({ id: p.id || makeId(), token: p.token, socketId: null, name: cleanName(p.name, "Joueur"), gender: p.gender === "f" ? "f" : "m", avatar: cleanAvatar(p.avatar), gift: p.gift, isBot: !!p.isBot, ready: true, connected: !!p.isBot, left: !!p.left, auto: !!p.auto, disconnectedAt: p.isBot ? null : Date.now(), lastKey: null })),
  };
  return room;
}
function startLoop(room) {
  clearTimers(room);
  if (room.status === "game") room.loop = setInterval(() => stepRoom(room), 400);
}
function adopt(room) { rooms.set(room.code, room); startLoop(room); sendGame(room, true); }

let lastSaved = "";
function saveToDisk() {
  try {
    const list = [];
    rooms.forEach((room) => { if (room.engine && room.status !== "lobby") { const s = snapshotRoom(room); if (s) list.push(s); } });
    const txt = JSON.stringify(list);
    if (txt === lastSaved) return;
    fs.mkdirSync(DATA_DIR, { recursive: true });
    const tmp = SAVE_FILE + ".tmp";
    fs.writeFileSync(tmp, txt); fs.renameSync(tmp, SAVE_FILE);
    lastSaved = txt;
  } catch (e) { console.error("sauvegarde", e.message); }
}
function loadFromDisk() {
  try {
    if (!fs.existsSync(SAVE_FILE)) return 0;
    const list = JSON.parse(fs.readFileSync(SAVE_FILE, "utf8"));
    let n = 0;
    list.forEach((snap) => {
      try {
        if (!snap || Date.now() - snap.savedAt > MAX_AGE_MS) return;
        const room = restoreRoom(snap);
        if (rooms.has(room.code)) return;
        adopt(room); n++;
      } catch (e) { console.error("restauration", e.message); }
    });
    if (n) console.log("Richissime a remonté " + n + " partie(s) depuis le disque.");
    return n;
  } catch (e) { console.error("lecture sauvegarde", e.message); return 0; }
}
const packSnap = (snap) => zlib.gzipSync(JSON.stringify(snap), { level: 6 }).toString("base64");
function unpackSnap(b64) {
  if (typeof b64 !== "string" || b64.length > 3 * 1024 * 1024) throw new Error("copie trop grosse");
  const buf = zlib.gunzipSync(Buffer.from(b64, "base64"), { maxOutputLength: 20 * 1024 * 1024 });
  return JSON.parse(buf.toString("utf8"));
}
// copie envoyée aux joueurs, seulement si la partie a avancé
function sendBackups(room) {
  const eng = room.engine; if (!eng || room.status === "lobby") return;
  const key = eng.round + ":" + eng.phase + ":" + eng.age;
  if (room.backupKey === key && Date.now() - (room.backupAt || 0) < 120000) return;
  room.backupKey = key; room.backupAt = Date.now();
  let data; try { data = packSnap(snapshotRoom(room)); } catch (e) { console.error("copie", e.message); return; }
  room.players.forEach((p) => { if (!p.isBot && p.socketId) io.to(p.socketId).emit("room:backup", { code: room.code, savedAt: Date.now(), data }); });
}
setInterval(() => { saveToDisk(); rooms.forEach((room) => { try { sendBackups(room); } catch (e) { /* ignore */ } }); }, 20000);
loadFromDisk();
app.flush = saveToDisk;

io.on("connection", (socket) => {
  const ctx = { room: null, token: null };
  const safe = (fn) => (...args) => {
    try { fn(...args); } catch (e) { console.error("handler", e); socket.emit("toast", { type: "error", text: "Oups, une erreur est survenue côté serveur." }); }
  };
  const me = () => (ctx.room ? ctx.room.players.find((p) => p.token === ctx.token) : null);
  const ownSeat = () => (ctx.room ? ctx.room.players.findIndex((p) => p.token === ctx.token) : -1);
  const seatOf = () => { const i = ownSeat(); const r = ctx.room && ctx.room.engine && ctx.room.engine.relay; return r && r[i] !== undefined ? r[i] : i; };
  const toast = (text, type = "error") => socket.emit("toast", { type, text });
  const isHost = () => ctx.room && ctx.room.hostToken === ctx.token;
  socket.emit("meta", META());

  function attach(room, player) {
    ctx.room = room; ctx.token = player.token;
    player.socketId = socket.id; player.connected = true; player.disconnectedAt = null; player.lastKey = null;
    if (room.engine && room.status !== "lobby") {
      const ix = room.players.indexOf(player); const rl = room.engine.relay;
      const ep = room.engine.players[rl && rl[ix] !== undefined ? rl[ix] : ix];
      if (ep && !ep.bot) { ep.auto = false; ep.missed = 0; }
      player.auto = false;
    }
    socket.join(room.code);
  }
  function newPlayer(room, tok, name) {
    const idx = room.players.length;
    return { id: makeId(), token: tok, socketId: socket.id, name: cleanName(name, "Joueur " + (idx + 1)), gender: idx % 2 ? "m" : "f", avatar: { acc: ACCESSORIES[idx % ACCESSORIES.length], color: COLORS[idx % COLORS.length] }, gift: "cerveau", isBot: false, ready: false, connected: true, left: false, auto: false };
  }

  socket.on("room:create", safe(({ name, token }) => {
    if (ctx.room) return;
    const code = makeCode();
    if (!code) return toast("Trop de salons ouverts, réessaie dans un instant.");
    const tok = String(token || makeId() + makeId());
    const room = { code, status: "lobby", hostToken: tok, players: [], settings: Settings.defaults(), chat: [], engine: null, loop: null, created: Date.now() };
    const player = newPlayer(room, tok, name); player.ready = true;
    room.players.push(player);
    rooms.set(code, room);
    attach(room, player);
    socket.emit("room:joined", { code, token: tok });
    broadcastRoom(room);
  }));

  socket.on("room:join", safe(({ code, name, token }) => {
    if (ctx.room) return;
    code = String(code || "").toUpperCase().trim();
    const room = rooms.get(code);
    if (!room) return toast("Ce salon n'existe pas. Vérifie le code !");
    const tok = String(token || makeId() + makeId());
    const existing = room.players.find((p) => p.token === tok && !p.isBot);
    if (existing) {
      attach(room, existing);
      socket.emit("room:joined", { code, token: tok });
      socket.emit("chat:history", room.chat);
      broadcastRoom(room);
      if (room.engine) sendGame(room, true);
      return;
    }
    if (room.status !== "lobby") return toast("Cette partie a déjà commencé.");
    if (room.players.length >= MAX_PLAYERS) return toast("Le salon est complet (6 joueurs maximum).");
    const player = newPlayer(room, tok, name);
    room.players.push(player);
    attach(room, player);
    socket.emit("room:joined", { code, token: tok });
    socket.emit("chat:history", room.chat);
    sysChat(room, player.name + " rejoint la partie.");
    broadcastRoom(room);
  }));

  // Resynchronisation demandée par la page. Si ce socket n'est plus rattaché, on le rattache
  socket.on("game:sync", safe(({ code, token }) => {
    if (!ctx.room) {
      const room = rooms.get(String(code || "").toUpperCase());
      const p = room && room.players.find((x) => x.token === token && !x.isBot && !x.left);
      if (!p) return socket.emit("room:gone");
      attach(room, p);
      socket.emit("room:joined", { code: room.code, token });
      socket.emit("chat:history", room.chat);
      broadcastRoom(room);
    }
    const room = ctx.room; const p = me();
    if (room && room.engine && p) { p.lastKey = null; sendGame(room, true); }
  }));

  socket.on("room:reconnect", safe(({ code, token }) => {
    if (ctx.room) return;
    const room = rooms.get(String(code || "").toUpperCase());
    if (!room) return socket.emit("room:gone");
    const p = room.players.find((x) => x.token === token && !x.isBot && !x.left);
    if (!p) return socket.emit("room:gone");
    attach(room, p);
    socket.emit("room:joined", { code: room.code, token });
    socket.emit("chat:history", room.chat);
    broadcastRoom(room);
    if (room.engine) sendGame(room, true);
  }));


  // La partie a disparu du serveur. Le navigateur du joueur en garde une copie et la remonte.
  socket.on("room:restore", safe(({ code, token, data }) => {
    if (ctx.room) return;
    code = String(code || "").toUpperCase();
    let room = rooms.get(code);
    if (!room) {
      let snap;
      try { snap = unpackSnap(data); room = restoreRoom(snap); } catch (e) { console.error("restore", e.message); return socket.emit("room:gone", { fatal: true }); }
      if (room.code !== code || Date.now() - (snap.savedAt || 0) > MAX_AGE_MS) return socket.emit("room:gone", { fatal: true });
      if (!room.players.some((x) => x.token === token && !x.isBot)) return socket.emit("room:gone", { fatal: true });
      adopt(room);
      console.log("Richissime a remonté la partie " + code + " depuis la copie d'un joueur.");
    }
    const p = room.players.find((x) => x.token === token && !x.isBot);
    if (!p) return socket.emit("room:gone", { fatal: true });
    p.left = false;
    attach(room, p);
    socket.emit("room:joined", { code: room.code, token });
    socket.emit("chat:history", room.chat);
    sysChat(room, "♻️ La partie a été remontée après une coupure du serveur.");
    broadcastRoom(room);
    sendGame(room, true);
  }));

  function leave(explicit) {
    const room = ctx.room; if (!room) return;
    const p = me(); const seat = seatOf();
    socket.leave(room.code);
    if (p) {
      if (room.status === "lobby") {
        room.players = room.players.filter((x) => x !== p);
        sysChat(room, p.name + " quitte le salon.");
      } else if (explicit) {
        p.left = true; p.connected = false; p.socketId = null;
        if (room.engine && room.engine.players[seat]) room.engine.players[seat].auto = true;
        sysChat(room, p.name + " a quitté la partie, un pilote automatique prend la relève.");
      }
    }
    ctx.room = null; ctx.token = null;
    ensureHost(room);
    broadcastRoom(room);
    deleteRoomIfEmpty(room);
  }
  socket.on("room:leave", safe(() => leave(true)));

  socket.on("disconnect", safe(() => {
    const room = ctx.room; const p = me();
    if (!room || !p) return;
    // un ancien socket qui meurt tard ne doit pas écraser la nouvelle connexion du même joueur
    if (p.socketId && p.socketId !== socket.id) return;
    p.connected = false; p.socketId = null; p.disconnectedAt = Date.now();
    if (room.status === "lobby") {
      setTimeout(() => {
        if (!rooms.has(room.code)) return;
        if (!p.connected && room.status === "lobby") {
          room.players = room.players.filter((x) => x !== p);
          ensureHost(room); broadcastRoom(room); deleteRoomIfEmpty(room);
        }
      }, GRACE_LOBBY_MS);
    } else {
      ensureHost(room);
      broadcastRoom(room);
      setTimeout(() => {
        if (!rooms.has(room.code)) return;
        if (room.players.filter((x) => !x.isBot && x.connected).length === 0 && room.status !== "lobby") { clearTimers(room); rooms.delete(room.code); }
      }, 12 * 60 * 1000);
    }
  }));

  // ----- salon -----
  socket.on("room:settings", safe(({ settings }) => {
    const room = ctx.room; if (!room || !isHost() || room.status !== "lobby") return;
    room.settings = Settings.normalize(Object.assign({}, room.settings, settings || {}));
    broadcastRoom(room);
  }));
  socket.on("room:char", safe(({ name, gender, avatar, gift }) => {
    const room = ctx.room; const p = me(); if (!room || !p || room.status !== "lobby") return;
    if (name !== undefined) p.name = cleanName(name, p.name);
    if (gender === "m" || gender === "f") p.gender = gender;
    if (avatar) p.avatar = cleanAvatar(avatar, p.avatar);
    if (gift && R.GIFTS[gift]) p.gift = gift;
    broadcastRoom(room);
  }));
  socket.on("room:ready", safe(({ ready }) => {
    const room = ctx.room; const p = me(); if (!room || !p || room.status !== "lobby") return;
    p.ready = !!ready; broadcastRoom(room);
  }));
  socket.on("room:addBot", safe(() => {
    const room = ctx.room; if (!room || !isHost() || room.status !== "lobby") return;
    if (room.players.length >= MAX_PLAYERS) return toast("Le salon est complet.");
    const used = new Set(room.players.map((p) => p.name));
    const pool = STARS.filter((s) => !used.has(s.n));
    const star = pool.length ? pool[Math.floor(rng() * pool.length)] : { n: "Robot " + room.players.length, g: rng() < 0.5 ? "m" : "f" };
    const name = star.n;
    const idx = room.players.length;
    const gifts = Object.keys(R.GIFTS);
    room.players.push({ id: makeId(), token: null, socketId: null, name, gender: star.g, avatar: { acc: ACCESSORIES[(idx * 3 + 5) % ACCESSORIES.length], color: COLORS[(idx + 2) % COLORS.length] }, gift: gifts[Math.floor(rng() * gifts.length)], isBot: true, ready: true, connected: true, left: false, auto: false });
    broadcastRoom(room);
  }));
  socket.on("room:removeBot", safe(({ id }) => {
    const room = ctx.room; if (!room || !isHost() || room.status !== "lobby") return;
    room.players = room.players.filter((p) => !(p.isBot && p.id === id));
    broadcastRoom(room);
  }));
  socket.on("room:kick", safe(({ id }) => {
    const room = ctx.room; if (!room || !isHost() || room.status !== "lobby") return;
    const p = room.players.find((x) => x.id === id);
    if (!p || p.token === ctx.token) return;
    if (!p.isBot && p.socketId) { io.to(p.socketId).emit("room:kicked"); const s = io.sockets.sockets.get(p.socketId); if (s) s.leave(room.code); }
    room.players = room.players.filter((x) => x !== p);
    broadcastRoom(room);
  }));
  socket.on("room:start", safe(() => {
    const room = ctx.room; if (!room || !isHost() || room.status !== "lobby") return;
    if (room.players.length < 1) return toast("Il faut au moins un joueur.");
    if (room.players.some((p) => !p.isBot && !p.ready && p.token !== ctx.token)) return toast("Tous les joueurs ne sont pas prêts.");
    startGame(room);
  }));
  socket.on("room:backToLobby", safe(() => {
    const room = ctx.room; if (!room || !isHost()) return;
    if (!room.engine || room.engine.phase !== "over") return;
    clearTimers(room);
    room.engine = null; room.status = "lobby";
    room.players = room.players.filter((p) => !p.left && (p.isBot || p.connected));
    room.turbo = false; room.players.forEach((p) => { p.ready = p.isBot || p.token === room.hostToken; p.auto = false; p.lastKey = null; });
    ensureHost(room);
    io.to(room.code).emit("room:lobbyAgain");
    broadcastRoom(room);
  }));
  socket.on("host:turbo", safe(({ on }) => {
    const room = ctx.room; if (!room || !isHost() || !room.engine) return;
    const eng = room.engine;
    if (eng.phase === "review" || eng.phase === "over") { room.turbo = false; sendGame(room, true); return; }
    // l'arrêt est immédiat
    room.turbo = !!on;
    if (on) stepRoom(room);
    sendGame(room, true);
  }));
  // passe à la vie suivante pendant le vote, avec un délai de sécurité contre les clics répétés
  socket.on("host:force", safe(() => {
    const room = ctx.room; if (!room || !isHost() || !room.engine) return;
    const eng = room.engine; const now = Date.now();
    if (eng.phase !== "review") return;
    if (room.lastForce && now - room.lastForce < 4000) return;
    room.lastForce = now;
    forceStep(room);
    stepRoom(room);
  }));

  // ----- partie -----
  const inGame = () => ctx.room && ctx.room.engine && ctx.room.status === "game";
  const after = () => { sendGame(ctx.room); };
  socket.on("game:agenda", safe((plan) => {
    if (!inGame()) return;
    const r = ctx.room.engine.submitAgenda(seatOf(), plan || {});
    if (!r.ok && r.error) toast(r.error);
    after();
  }));
  socket.on("game:draft", safe((plan) => {
    if (!inGame()) return;
    ctx.room.engine.saveDraft(seatOf(), plan || {});
  }));
  socket.on("game:quitjob", safe(() => {
    if (!inGame()) return;
    const r = ctx.room.engine.quitJob(seatOf());
    if (!r.ok && r.error) toast(r.error);
    after();
  }));
  socket.on("game:finance", safe((op) => {
    if (!inGame()) return;
    const r = ctx.room.engine.finance(seatOf(), op || {});
    if (!r.ok && r.error) toast(r.error);
    after();
  }));
  socket.on("game:scene", safe(({ i }) => {
    if (!inGame()) return;
    const r = ctx.room.engine.chooseScene(seatOf(), Number(i));
    if (!r.ok && r.error) toast(r.error);
    after();
  }));
  socket.on("game:continue", safe(() => {
    if (!inGame()) return;
    ctx.room.engine.continueScene(seatOf());
    after();
  }));
  socket.on("game:respond", safe(({ id, answer }) => {
    if (!inGame()) return;
    social.respond(ctx.room.engine, seatOf(), Number(id), ["yes", "no", "half"].includes(answer) ? answer : "no");
    after();
  }));
  socket.on("game:group", safe(({ value }) => {
    if (!inGame()) return;
    const r = social.groupChoose(ctx.room.engine, seatOf(), value);
    if (!r.ok && r.error) toast(r.error);
    after();
  }));
  socket.on("game:mini", safe(({ id, action, arg }) => {
    if (!inGame()) return;
    const r = ctx.room.engine.minigames.act(ctx.room.engine, seatOf(), Number(id), String(action || ""), arg);
    if (!r.ok && r.error) toast(r.error);
    after();
  }));
  socket.on("game:groupReady", safe(() => {
    if (!inGame()) return;
    social.groupReady(ctx.room.engine, seatOf());
    after();
  }));
  socket.on("game:rate", safe(({ score }) => {
    if (!inGame()) return;
    const r = ctx.room.engine.rate(seatOf(), score);
    if (!r.ok && r.error) toast(r.error);
    after();
  }));
  socket.on("game:recapReady", safe(() => {
    if (!inGame()) return;
    ctx.room.engine.readyRecap(seatOf());
    after();
  }));

  // ----- tchat -----
  socket.on("chat:send", safe(({ text }) => {
    const room = ctx.room; const p = me(); if (!room || !p) return;
    const t = String(text || "").replace(/[\u0000-\u001f]/g, " ").trim().slice(0, 200);
    if (!t) return;
    const msg = { id: makeId(), from: p.id, name: p.name, avatar: p.avatar, text: t, t: Date.now() };
    room.chat.push(msg); if (room.chat.length > 60) room.chat.shift();
    room.players.forEach((q) => { if (!q.isBot && q.socketId) io.to(q.socketId).emit("chat:message", msg); });
  }));
});

setInterval(() => {
  const now = Date.now();
  rooms.forEach((room, code) => {
    const anyConnected = room.players.some((p) => !p.isBot && p.connected);
    if (!anyConnected && now - Math.max(room.created, room.restoredAt || 0) > 15 * 60 * 1000) { clearTimers(room); rooms.delete(code); }
  });
}, 5 * 60 * 1000);

return app;
};


// ============================================================
// Noyau de salons partagé par Golfouille et Zoomalou
// Gère les salons, les joueurs, les bots, les réglages, le tchat,
// la reconnexion et le départ en partie. Chaque jeu fournit ses règles.
// ============================================================
const path = require("path");
const express = require("express");
const { Server } = require("socket.io");

module.exports = function createRoomKit(server, prefix, game) {
  const app = express.Router();
  const io = new Server(server, { path: prefix + "/socket.io", pingInterval: 10000, pingTimeout: 20000, maxHttpBufferSize: 1e6 });
  const rooms = new Map();
  const TS = Math.max(0.001, Number(process.env.KIT_TIME_SCALE) || 1);
  const GRACE_LOBBY_MS = 60 * 1000 * TS;
  const GRACE_GAME_MS = 120 * 1000 * TS;

  app.get("/health", (req, res) => res.json({ ok: true, rooms: rooms.size }));
  app.use("/common", express.static(path.join(__dirname, "public"), { maxAge: 0 }));
  app.use(express.static(path.join(game.dir, "public"), { extensions: ["html"], maxAge: 0 }));

  const rnd = Math.random;
  function makeCode() {
    const letters = "ABCDEFGHJKLMNPQRSTUVWXYZ";
    for (let t = 0; t < 200; t++) {
      let c = "";
      for (let i = 0; i < 4; i++) c += letters[Math.floor(rnd() * letters.length)];
      if (!rooms.has(c)) return c;
    }
    return null;
  }
  const makeId = () => Math.random().toString(36).slice(2, 10);
  const cleanName = (s, fb) => (String(s || "").replace(/[\u0000-\u001f<>]/g, "").trim().slice(0, 16) || fb);

  function freeColor(room, wanted) {
    const used = new Set(room.players.map((p) => p.color));
    if (wanted != null && wanted >= 0 && wanted < game.colors.length && !used.has(wanted)) return wanted;
    for (let c = 0; c < game.colors.length; c++) if (!used.has(c)) return c;
    return 0;
  }

  function publicRoom(room, forToken) {
    const host = room.players.find((p) => p.token === room.hostToken);
    return {
      code: room.code, status: room.status, hostId: host ? host.id : null, settings: room.settings,
      players: room.players.map((p, seat) => ({
        id: p.id, seat, name: p.name, color: p.color, isBot: p.isBot, level: p.level, ready: p.ready,
        connected: p.connected, you: p.token === forToken, left: !!p.left,
      })),
    };
  }
  function broadcastRoom(room) {
    room.players.forEach((p) => {
      if (p.isBot || !p.socketId) return;
      try { io.to(p.socketId).emit("room:state", publicRoom(room, p.token)); } catch (e) { /* ignore */ }
    });
  }
  function emitAll(room, ev, payload) {
    room.players.forEach((p) => { if (!p.isBot && p.socketId) io.to(p.socketId).emit(ev, payload); });
  }
  function sysChat(room, text) {
    const msg = { id: makeId(), system: true, text, t: Date.now() };
    room.chat.push(msg); if (room.chat.length > 60) room.chat.shift();
    emitAll(room, "chat:message", msg);
  }
  function ensureHost(room) {
    if (room.players.find((p) => p.token === room.hostToken && !p.isBot && !p.left)) return;
    const next = room.players.find((p) => !p.isBot && !p.left && p.connected) || room.players.find((p) => !p.isBot && !p.left);
    if (next) room.hostToken = next.token;
  }
  function destroyRoom(room) {
    if (game.onDestroy) { try { game.onDestroy(room); } catch (e) { console.error(e); } }
    rooms.delete(room.code);
  }
  function deleteRoomIfEmpty(room) {
    if (!room.players.filter((p) => !p.isBot && !p.left).length) destroyRoom(room);
  }

  const api = { io, rooms, broadcastRoom, emitAll, sysChat, makeId, ensureHost, publicRoom };

  io.on("connection", (socket) => {
    const ctx = { room: null, token: null };
    const safe = (fn) => (...a) => {
      try { fn(...a); } catch (e) { console.error("handler", e); socket.emit("toast", { type: "error", text: "Oups, une erreur est survenue côté serveur." }); }
    };
    const me = () => (ctx.room ? ctx.room.players.find((p) => p.token === ctx.token) : null);
    const seatOf = () => (ctx.room ? ctx.room.players.findIndex((p) => p.token === ctx.token) : -1);
    const toast = (text, type = "error") => socket.emit("toast", { type, text });
    const isHost = () => ctx.room && ctx.room.hostToken === ctx.token;
    const helpers = { ctx, me, seatOf, toast, isHost, safe, socket };

    function attach(room, p) {
      ctx.room = room; ctx.token = p.token;
      p.socketId = socket.id; p.connected = true; p.disconnectedAt = null;
      socket.join(room.code);
    }
    function newPlayer(name, token, isBot, level) {
      return { id: makeId(), token, socketId: null, name, color: 0, isBot: !!isBot, level: level || null, ready: !!isBot, connected: true, left: false };
    }
    function afterJoin(room, p) {
      socket.emit("room:joined", { code: room.code, token: p.token });
      socket.emit("chat:history", room.chat);
      broadcastRoom(room);
      if (room.status === "game" && game.onReconnect) game.onReconnect(room, p, api);
    }

    socket.on("room:create", safe(({ name, token }) => {
      if (ctx.room) return;
      const code = makeCode();
      if (!code) return toast("Trop de salons ouverts, réessaie dans un instant.");
      const tok = String(token || makeId() + makeId());
      const room = { code, status: "lobby", hostToken: tok, players: [], settings: game.defaults(), chat: [], created: Date.now(), g: null };
      const p = newPlayer(cleanName(name, "Joueur 1"), tok, false); p.ready = true; p.color = 0;
      room.players.push(p); rooms.set(code, room);
      attach(room, p);
      afterJoin(room, p);
    }));

    socket.on("room:join", safe(({ code, name, token }) => {
      if (ctx.room) return;
      code = String(code || "").toUpperCase().trim();
      const room = rooms.get(code);
      if (!room) return toast("Ce salon n'existe pas. Vérifie le code.");
      const tok = String(token || makeId() + makeId());
      const ex = room.players.find((p) => p.token === tok && !p.isBot);
      if (ex) { attach(room, ex); ex.left = false; return afterJoin(room, ex); }
      if (room.status !== "lobby") return toast("Cette partie a déjà commencé.");
      if (room.players.length >= game.maxPlayers) return toast("Le salon est complet (" + game.maxPlayers + " joueurs maximum).");
      const p = newPlayer(cleanName(name, "Joueur " + (room.players.length + 1)), tok, false);
      p.color = freeColor(room, null);
      room.players.push(p); attach(room, p);
      room.settings = game.normalize(room.settings, room.players.length);
      sysChat(room, p.name + " rejoint le salon.");
      afterJoin(room, p);
    }));

    socket.on("room:reconnect", safe(({ code, token }) => {
      if (ctx.room) return;
      const room = rooms.get(String(code || "").toUpperCase());
      if (!room) return socket.emit("room:gone");
      const p = room.players.find((x) => x.token === token && !x.isBot && !x.left);
      if (!p) return socket.emit("room:gone");
      attach(room, p);
      afterJoin(room, p);
    }));

    function leave(explicit) {
      const room = ctx.room; if (!room) return;
      const p = me();
      socket.leave(room.code);
      if (p) {
        if (room.status === "lobby") {
          room.players = room.players.filter((x) => x !== p);
          sysChat(room, p.name + " quitte le salon.");
        } else if (explicit) {
          p.left = true; p.connected = false; p.socketId = null;
          sysChat(room, p.name + " a quitté la partie.");
          if (game.onLeave) game.onLeave(room, p, api);
        }
      }
      ctx.room = null; ctx.token = null;
      ensureHost(room);
      if (room.status === "lobby") room.settings = game.normalize(room.settings, room.players.length);
      broadcastRoom(room);
      deleteRoomIfEmpty(room);
    }
    socket.on("room:leave", safe(() => leave(true)));

    socket.on("disconnect", safe(() => {
      const room = ctx.room; const p = me();
      if (!room || !p) return;
      if (p.socketId && p.socketId !== socket.id) return; // un ancien lien qui se ferme tard
      p.connected = false; p.socketId = null; p.disconnectedAt = Date.now();
      if (room.status === "lobby") {
        setTimeout(() => {
          if (!rooms.has(room.code)) return;
          if (!p.connected && room.status === "lobby" && room.players.includes(p)) {
            room.players = room.players.filter((x) => x !== p); ensureHost(room); broadcastRoom(room); deleteRoomIfEmpty(room);
          }
        }, GRACE_LOBBY_MS);
      } else {
        if (game.onDisconnect) game.onDisconnect(room, p, api);
        setTimeout(() => {
          if (!rooms.has(room.code)) return;
          if (!p.connected && game.onAbsent) game.onAbsent(room, p, api);
          deleteRoomIfEmpty(room);
        }, GRACE_GAME_MS);
        setTimeout(() => {
          if (!rooms.has(room.code)) return;
          if (!room.players.some((x) => !x.isBot && x.connected) && Date.now() - p.disconnectedAt > 9 * 60 * 1000) destroyRoom(room);
        }, 10 * 60 * 1000);
        ensureHost(room); broadcastRoom(room);
      }
    }));

    // ----- salon -----
    socket.on("room:settings", safe(({ settings }) => {
      const room = ctx.room; if (!room || !isHost() || room.status !== "lobby") return;
      room.settings = game.normalize(Object.assign({}, room.settings, settings || {}), room.players.length);
      broadcastRoom(room);
    }));
    socket.on("room:name", safe(({ name }) => {
      const room = ctx.room; const p = me(); if (!room || !p || room.status !== "lobby") return;
      p.name = cleanName(name, p.name); broadcastRoom(room);
    }));
    socket.on("room:color", safe(({ color }) => {
      const room = ctx.room; const p = me(); if (!room || !p || room.status !== "lobby") return;
      color = Number(color);
      if (!(color >= 0 && color < game.colors.length)) return;
      const holder = room.players.find((x) => x !== p && x.color === color);
      if (holder && !holder.isBot) return toast("Cette couleur est déjà prise.");
      if (holder) holder.color = p.color;
      p.color = color; broadcastRoom(room);
    }));
    socket.on("room:ready", safe(({ ready }) => {
      const room = ctx.room; const p = me(); if (!room || !p || room.status !== "lobby") return;
      p.ready = !!ready; broadcastRoom(room);
    }));
    socket.on("room:addBot", safe(({ level }) => {
      const room = ctx.room; if (!room || !isHost() || room.status !== "lobby" || game.noBots) return;
      if (room.players.length >= game.maxPlayers) return toast("Le salon est complet.");
      const lv = game.botLevels.some((l) => l.id === level) ? level : game.botLevels[1].id;
      const used = new Set(room.players.map((p) => p.name));
      const pool = game.botNames.filter((n) => !used.has(n));
      const name = pool.length ? pool[Math.floor(rnd() * pool.length)] : "Robot " + room.players.length;
      const p = newPlayer(name, null, true, lv); p.color = freeColor(room, null);
      room.players.push(p);
      room.settings = game.normalize(room.settings, room.players.length);
      broadcastRoom(room);
    }));
    socket.on("room:botLevel", safe(({ id, level }) => {
      const room = ctx.room; if (!room || !isHost() || room.status !== "lobby") return;
      const p = room.players.find((x) => x.isBot && x.id === id);
      if (p && game.botLevels.some((l) => l.id === level)) { p.level = level; broadcastRoom(room); }
    }));
    socket.on("room:kick", safe(({ id }) => {
      const room = ctx.room; if (!room || !isHost() || room.status !== "lobby") return;
      const p = room.players.find((x) => x.id === id);
      if (!p || p.token === ctx.token) return;
      if (!p.isBot && p.socketId) {
        io.to(p.socketId).emit("room:kicked");
        const s = io.sockets.sockets.get(p.socketId); if (s) s.leave(room.code);
      }
      room.players = room.players.filter((x) => x !== p);
      room.settings = game.normalize(room.settings, room.players.length);
      broadcastRoom(room);
    }));
    socket.on("room:start", safe(() => {
      const room = ctx.room; if (!room || !isHost() || room.status !== "lobby") return;
      if (room.players.length < game.minPlayers) return toast(game.minPlayers <= 1 ? "Il faut au moins un joueur." : "Il faut au moins " + game.minPlayers + " joueurs" + (game.noBots ? ", invite des amis avec le code." : ", tu peux ajouter un bot."));
      if (room.players.some((p) => !p.isBot && !p.ready && p.token !== ctx.token)) return toast("Tous les joueurs ne sont pas prêts.");
      room.settings = game.normalize(room.settings, room.players.length);
      room.status = "game";
      room.players.forEach((p) => { p.left = false; });
      game.start(room, api);
      broadcastRoom(room);
    }));
    socket.on("room:backToLobby", safe(() => {
      const room = ctx.room; if (!room || !isHost() || room.status !== "game") return;
      if (game.canReturn && !game.canReturn(room)) return;
      if (game.onDestroy) game.onDestroy(room);
      room.g = null; room.status = "lobby";
      room.players = room.players.filter((p) => !p.left && (p.isBot || p.connected));
      room.players.forEach((p) => { p.ready = p.isBot || p.token === room.hostToken; });
      ensureHost(room);
      room.settings = game.normalize(room.settings, room.players.length);
      emitAll(room, "room:lobbyAgain", {});
      broadcastRoom(room);
    }));

    // ----- tchat -----
    socket.on("chat:send", safe(({ text }) => {
      const room = ctx.room; const p = me(); if (!room || !p) return;
      const t = String(text || "").replace(/[\u0000-\u001f]/g, " ").trim().slice(0, 200);
      if (!t) return;
      const msg = { id: makeId(), from: p.id, name: p.name, color: p.color, text: t, t: Date.now() };
      room.chat.push(msg); if (room.chat.length > 60) room.chat.shift();
      emitAll(room, "chat:message", msg);
    }));

    if (game.bind) game.bind(socket, helpers, api);
  });

  setInterval(() => {
    const now = Date.now();
    rooms.forEach((room) => {
      if (!room.players.some((p) => !p.isBot && p.connected) && now - room.created > 15 * 60 * 1000) destroyRoom(room);
    });
  }, 5 * 60 * 1000).unref();

  return { router: app, api };
};

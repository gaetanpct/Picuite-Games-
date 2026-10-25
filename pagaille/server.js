// ============================================================
// PAGAILLE PARTY — Serveur (Express + Socket.io)
// Un party game en ligne avec une collection de mini-jeux courts.
// ============================================================
const createRoomKit = require("../common/room-kit.js");
const Rules = require("./public/game/rules.js");
const Engine = require("./pg-engine.js");

const COLORS = [
  { name: "Rouge", hex: "#ef4b4b" }, { name: "Bleu", hex: "#3b82f6" }, { name: "Vert", hex: "#34c36c" }, { name: "Jaune", hex: "#f5c518" },
  { name: "Violet", hex: "#9b5de5" }, { name: "Orange", hex: "#ff8a1f" }, { name: "Rose", hex: "#ff6fb5" }, { name: "Turquoise", hex: "#1fc8c0" },
];

module.exports = function mount(server, prefix) {
  const game = {
    dir: __dirname, id: "pagaille", maxPlayers: 8, minPlayers: 2, noBots: true, colors: COLORS,
    botNames: [], botLevels: [{ id: "x", label: "x" }],
    defaults: Rules.defaults, normalize: (s) => Rules.normalize(s),
    start: Engine.start, bind: Engine.bind, onReconnect: Engine.onReconnect, onDisconnect: Engine.onDisconnect, onLeave: Engine.onLeave, onDestroy: Engine.onDestroy, canReturn: Engine.canReturn,
  };
  return createRoomKit(server, prefix, game).router;
};

// ============================================================
// BOUSKAILLE — Serveur (Express + Socket.io)
// ============================================================
const createRoomKit = require("../common/room-kit.js");
const Rules = require("./public/game/rules.js");
const Game = require("./bousk-game.js");
const Bot = require("./bousk-bot.js");

const COLORS = [
  { name: "Rouge", hex: "#e8453c" }, { name: "Bleu", hex: "#2f78d1" }, { name: "Vert", hex: "#3aa653" }, { name: "Jaune", hex: "#f2c230" },
  { name: "Violet", hex: "#8a55c8" }, { name: "Orange", hex: "#f08a24" }, { name: "Rose", hex: "#ee6fb0" }, { name: "Turquoise", hex: "#25b9b0" },
];

module.exports = function mount(server, prefix) {
  const game = {
    dir: __dirname, id: "bouskaille", maxPlayers: 8, minPlayers: 2, colors: COLORS,
    botNames: ["Boum", "Patatras", "Rebond", "Gnon", "Bourrin", "Cogne", "Tamponne", "Ricoche", "Bouscule", "Pouf"],
    botLevels: Bot.LEVEL_LIST.map((l) => ({ id: l.id, label: l.label })),
    defaults: Rules.defaults, normalize: (s) => Rules.normalize(s),
    start: Game.start, bind: Game.bind, onReconnect: Game.onReconnect, onDisconnect: Game.onDisconnect, onLeave: Game.onLeave, onDestroy: Game.onDestroy, canReturn: Game.canReturn,
  };
  return createRoomKit(server, prefix, game).router;
};

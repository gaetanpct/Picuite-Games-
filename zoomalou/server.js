// ============================================================
// ZOOMALOU — Serveur (Express + Socket.io)
// ============================================================
const createRoomKit = require("../common/room-kit.js");
const Rules = require("./public/game/rules.js");
const Game = require("./zoom-game.js");
const Bot = require("./zoom-bot.js");

const COLORS = [
  { name: "Rouge", hex: "#e8453c" }, { name: "Bleu", hex: "#2f78d1" }, { name: "Vert", hex: "#3aa653" }, { name: "Jaune", hex: "#f2c230" },
  { name: "Violet", hex: "#8a55c8" }, { name: "Orange", hex: "#f08a24" }, { name: "Rose", hex: "#ee6fb0" }, { name: "Turquoise", hex: "#25b9b0" },
];

module.exports = function mount(server, prefix) {
  const game = {
    dir: __dirname, id: "zoomalou", maxPlayers: 6, minPlayers: 1, colors: COLORS,
    botNames: ["Vroum", "Dérapage", "Turbo-Tom", "Pneu-Lisse", "Klaxonne", "Rond-Point", "Pit-Stop", "Gomme", "Frein-à-Main", "Mach Zéro"],
    botLevels: Object.values(Bot.LEVELS).map((l) => ({ id: l.id, label: l.label })),
    defaults: Rules.defaults, normalize: (s) => Rules.normalize(s),
    start: Game.start, bind: Game.bind, onReconnect: Game.onReconnect, onLeave: Game.onLeave, onDestroy: Game.onDestroy, canReturn: Game.canReturn,
  };
  return createRoomKit(server, prefix, game).router;
};

// ============================================================
// ORAPA MINE — Serveur (Express + Socket.io)
// ============================================================
const createRoomKit = require("../common/room-kit.js");
const Rules = require("./public/game/rules.js");
const Game = require("./om-game.js");

const COLORS = [
  { name: "Rubis", hex: "#ff4a6a" }, { name: "Topaze", hex: "#ffc83d" }, { name: "Émeraude", hex: "#2fd66b" }, { name: "Saphir", hex: "#4a86ff" },
  { name: "Améthyste", hex: "#b06bff" }, { name: "Citrine", hex: "#ff8a1f" }, { name: "Aigue-marine", hex: "#35d4d4" }, { name: "Diamant", hex: "#e8f1ff" },
];
module.exports = function mount(server, prefix) {
  const game = {
    dir: __dirname, id: "orapa-mine", maxPlayers: 6, minPlayers: 2, colors: COLORS,
    botNames: ["Pépita", "Grisou", "Galène", "Quartz", "Pyrite", "Basalte"],
    botLevels: [{ id: "novice", label: "Novice" }, { id: "fute", label: "Futé" }, { id: "genie", label: "Génie" }],
    defaults: Rules.defaults, normalize: (s) => Rules.normalize(s),
    start: Game.start, bind: Game.bind, onReconnect: Game.onReconnect, onDisconnect: Game.onLeave, onLeave: Game.onLeave, onDestroy: Game.onDestroy, canReturn: Game.canReturn,
  };
  return createRoomKit(server, prefix, game).router;
};

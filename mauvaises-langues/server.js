// ============================================================
// MAUVAISES LANGUES — Serveur (Express + Socket.io)
// ============================================================
const createRoomKit = require("../common/room-kit.js");
const Rules = require("./public/game/rules.js");
const Game = require("./ml-game.js");

const COLORS = [
  { name: "Rose", hex: "#ff4fa3" }, { name: "Jaune", hex: "#ffd23f" }, { name: "Turquoise", hex: "#27d3c3" }, { name: "Violet", hex: "#9b5cff" },
  { name: "Orange", hex: "#ff8a1f" }, { name: "Vert", hex: "#4cd964" }, { name: "Bleu", hex: "#3d8bff" }, { name: "Rouge", hex: "#ff4b3e" },
];

module.exports = function mount(server, prefix) {
  const game = {
    dir: __dirname, id: "mauvaises-langues", maxPlayers: 8, minPlayers: 3, colors: COLORS, noBots: true,
    botNames: [], botLevels: [{ id: "none", label: "Aucun" }, { id: "none2", label: "Aucun" }],
    defaults: Rules.defaults, normalize: (s) => Rules.normalize(s),
    start: Game.start, bind: Game.bind, onReconnect: Game.onReconnect, onLeave: Game.onLeave, onDestroy: Game.onDestroy, canReturn: Game.canReturn,
  };
  return createRoomKit(server, prefix, game).router;
};

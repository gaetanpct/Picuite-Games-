// ============================================================
// SUCRÉ OU SALÉ — Serveur (Express + Socket.io)
// ============================================================
const createRoomKit = require("../common/room-kit.js");
const Rules = require("./public/game/rules.js");
const Game = require("./sos-game.js");

const COLORS = [
  { name: "Rose", hex: "#ff5fa8" }, { name: "Jaune", hex: "#ffd23f" }, { name: "Turquoise", hex: "#27d3c3" }, { name: "Violet", hex: "#a56bff" },
  { name: "Orange", hex: "#ff8a1f" }, { name: "Vert", hex: "#4cd964" }, { name: "Bleu", hex: "#3d8bff" }, { name: "Rouge", hex: "#ff4b3e" },
];
module.exports = function mount(server, prefix) {
  const game = {
    dir: __dirname, id: "sucre-ou-sale", maxPlayers: 8, minPlayers: 2, colors: COLORS,
    botNames: ["Madame Irma", "Nostradamus", "Pythie", "Zoltar", "Cassandre", "Mentalo", "Bob le Devin", "Sibylle"],
    botLevels: [{ id: "naif", label: "Naïf" }, { id: "fute", label: "Futé" }, { id: "genie", label: "Génie" }],
    defaults: Rules.defaults, normalize: (s) => Rules.normalize(s),
    start: Game.start, bind: Game.bind, onReconnect: Game.onReconnect, onDisconnect: Game.onLeave, onLeave: Game.onLeave, onDestroy: Game.onDestroy, canReturn: Game.canReturn,
  };
  return createRoomKit(server, prefix, game).router;
};

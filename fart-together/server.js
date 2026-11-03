// ============================================================
// FART TOGETHER — Serveur (Express + Socket.io)
// ============================================================
const createRoomKit = require("../common/room-kit.js");
const Rules = require("./public/game/rules.js");
const Game = require("./ft-game.js");

const COLORS = [
  { name: "Fraise", hex: "#ff5fa8" }, { name: "Citron", hex: "#ffd23f" }, { name: "Menthe", hex: "#2fe0a8" }, { name: "Raisin", hex: "#a56bff" },
  { name: "Mandarine", hex: "#ff8a1f" }, { name: "Kiwi", hex: "#7ed957" }, { name: "Myrtille", hex: "#3d8bff" }, { name: "Piment", hex: "#ff4b3e" },
];
module.exports = function mount(server, prefix) {
  const game = {
    dir: __dirname, id: "fart-together", maxPlayers: 8, minPlayers: 1, colors: COLORS,
    botNames: ["Gaston Gaz", "Mireille Météo", "Brise-Lou", "Tonton Turbo", "Pschitt", "Bulle Bob", "Zéphyrine", "Capitaine Courant"],
    botLevels: [{ id: "stagiaire", label: "Stagiaire" }, { id: "matelot", label: "Matelot" }, { id: "capitaine", label: "Capitaine" }],
    defaults: Rules.defaults, normalize: (s) => Rules.normalize(s),
    start: Game.start, bind: Game.bind, onReconnect: Game.onReconnect, onDisconnect: Game.onLeave, onLeave: Game.onLeave, onDestroy: Game.onDestroy, canReturn: Game.canReturn,
  };
  return createRoomKit(server, prefix, game).router;
};

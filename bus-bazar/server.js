// ============================================================
// BUS BAZAR — Serveur (Express + Socket.io)
// Un jeu coopératif en 3D, à la première personne, dans un bus absurde.
// ============================================================
const createRoomKit = require("../common/room-kit.js");
const Rules = require("./public/game/rules.js");
const Game = require("./bb-game.js");

const COLORS = [
  { name: "Jaune bus", hex: "#f2b705" }, { name: "Rouge sirène", hex: "#e8453c" }, { name: "Bleu route", hex: "#2f78d1" }, { name: "Vert canard", hex: "#3aa653" },
];

module.exports = function mount(server, prefix) {
  const game = {
    dir: __dirname, id: "bus-bazar", maxPlayers: 4, minPlayers: 1, noBots: true, colors: COLORS,
    botNames: [], botLevels: [{ id: "habile", label: "Habile" }],
    defaults: Rules.defaults, normalize: (s) => Rules.normalize(s),
    start: Game.start, bind: Game.bind, onReconnect: Game.onReconnect, onDisconnect: Game.onDisconnect, onLeave: Game.onLeave, onDestroy: Game.onDestroy, canReturn: Game.canReturn,
  };
  return createRoomKit(server, prefix, game).router;
};

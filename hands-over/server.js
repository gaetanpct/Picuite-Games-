// ============================================================
// HANDS OVER — Serveur (Express + Socket.io)
// ============================================================
const createRoomKit = require("../common/room-kit.js");
const Rules = require("./public/game/rules.js");
const Game = require("./ho-game.js");

const COLORS = [
  { name: "Rouge sang", hex: "#e63946" }, { name: "Or terni", hex: "#d4a72c" }, { name: "Vert poison", hex: "#5ec26a" }, { name: "Violet funèbre", hex: "#9b5de5" },
  { name: "Bleu nuit", hex: "#3d7bd9" }, { name: "Orange citrouille", hex: "#f77f00" }, { name: "Rose bonbon", hex: "#ff6fb5" }, { name: "Blanc os", hex: "#e9e4d4" },
];
module.exports = function mount(server, prefix) {
  const game = {
    dir: __dirname, id: "hands-over", maxPlayers: 8, minPlayers: 2, colors: COLORS,
    botNames: ["Monsieur Sourire", "Dame Guillotine", "Le Cousin", "Tante Ténèbres", "Gros Gant", "Petit Doigt", "Maître Pouce", "Jeannot Manchot"],
    botLevels: [{ id: "figurant", label: "Figurant" }, { id: "candidat", label: "Candidat" }, { id: "veteran", label: "Vétéran" }],
    defaults: Rules.defaults, normalize: (s) => Rules.normalize(s),
    start: Game.start, bind: Game.bind, onReconnect: Game.onReconnect, onDisconnect: Game.onLeave, onLeave: Game.onLeave, onDestroy: Game.onDestroy, canReturn: Game.canReturn,
  };
  return createRoomKit(server, prefix, game).router;
};

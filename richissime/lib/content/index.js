// Charge tous les fichiers de scènes du dossier.
const fs = require("fs");
const path = require("path");
const kit = require("../kit");
const { ev, flash, O, C, D } = kit;

ev("annee_tranquille", {
  chainOnly: true, once: false, tags: ["calme"], ic: "🌤️",
  t: "Une année sans grand événement. Les saisons passent, tu observes la vie autour de toi.",
  c: [
    D("Profiter de la routine", "☕", "Tu savoures le calme. Il y a des années comme ça.", { bonheur: 2 }),
    D("Tenter quelque chose de nouveau", "✨", "Tu essaies une nouveauté. Ça ne change pas ta vie, mais ça amuse.", { creatif: 2, bonheur: 1 }),
  ],
});

fs.readdirSync(__dirname).filter((f) => f.endsWith(".js") && f !== "index.js").sort().forEach((f) => require(path.join(__dirname, f)));
module.exports = kit;

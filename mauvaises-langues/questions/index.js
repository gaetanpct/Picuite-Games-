// Base de questions de Mauvaises Langues. Chaque thème a son fichier, la liste des thèmes vient des règles.
const Rules = require("../public/game/rules.js");
const ALL = [];
Rules.THEMES.forEach((t) => { require("./" + t.id + ".js").forEach((row, i) => { ALL.push({ id: t.id + i, theme: t.id, heat: row[0], text: row[1] }); }); });
module.exports = { ALL };

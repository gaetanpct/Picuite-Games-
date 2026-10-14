// Charge tous les fichiers de choix de vie du dossier.
const fs = require("fs");
const path = require("path");
fs.readdirSync(__dirname).filter((f) => f.endsWith(".js") && f !== "index.js").sort().forEach((f) => require(path.join(__dirname, f)));

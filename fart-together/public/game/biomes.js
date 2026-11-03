// FART TOGETHER — Palettes des décors (serveur et client)
(function (root, factory) {
  if (typeof module !== "undefined" && module.exports) module.exports = factory();
  else root.FTBiomes = factory();
})(typeof window !== "undefined" ? window : globalThis, function () {
  const BIOMES = {
  prairie: { sky: ["#8fd3ff", "#e8f7ff"], water: "#35b4e8", water2: "#6fd0f5", bank: "#6ccf5a", fog: "#cfeeff", sun: "#fff4d6", prop: "tree" },
  ville: { sky: ["#7a9acc", "#dbe4f0"], water: "#3a84b8", water2: "#5aa6d8", bank: "#9aa0ad", fog: "#cdd6e4", sun: "#fff0d0", prop: "building" },
  canyon: { sky: ["#ffb37a", "#ffe6c4"], water: "#3aa0c8", water2: "#68c8e8", bank: "#d58a5a", fog: "#ffd9b4", sun: "#ffe2b0", prop: "rock" },
  jungle: { sky: ["#6fd8a0", "#d6f7d8"], water: "#2fb0a0", water2: "#5fd6c4", bank: "#2f9a45", fog: "#c4efd2", sun: "#fff6c0", prop: "palm" },
  glacier: { sky: ["#a6c8ff", "#f0f8ff"], water: "#58b8e8", water2: "#9cdcf8", bank: "#eef6ff", fog: "#e4f0ff", sun: "#ffffff", prop: "pine" },
  marais: { sky: ["#b8c96a", "#f0f2b8"], water: "#7aa04a", water2: "#a0c868", bank: "#6a7a3a", fog: "#dde8a8", sun: "#fff0a0", prop: "tree" },
  parc: { sky: ["#ff9ad5", "#ffe4f6"], water: "#30b8ff", water2: "#7fe0ff", bank: "#ffd23f", fog: "#ffe0f2", sun: "#fff4d6", prop: "balloon" },
  desert: { sky: ["#ffcf7a", "#fff0cc"], water: "#38a8d0", water2: "#70d0ec", bank: "#e8c070", fog: "#ffe8b8", sun: "#fff0c0", prop: "cactus" },
  egout: { sky: ["#2a3a3a", "#506464"], water: "#4a9a6a", water2: "#7acc94", bank: "#5a6a60", fog: "#3a4a48", sun: "#d8ffe8", prop: "pipe" },
  fete: { sky: ["#7a3aff", "#ff9ad5"], water: "#3a7aff", water2: "#8ab0ff", bank: "#ff5fa8", fog: "#c4a0ff", sun: "#ffe0ff", prop: "balloon" },
};
  return BIOMES;
});

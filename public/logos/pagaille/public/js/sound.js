// ============================================================
// PAGAILLE PARTY — Sons par synthèse (aucun fichier à charger)
// Le jeu se comprend sans le son. Les sons ne font qu'ajouter du plaisir et peuvent être coupés avec le bouton du haut.
// ============================================================
(function () {
  const K = window.Kit; if (!K || !K.sound) { window.PgSound = { play() {}, music() {}, stop() {} }; return; }
  const { tone, noise } = K.sound; const last = {};
  const defs = {
    tick() { tone(880, 0.05, "square", 0.04); },
    go() { tone(523, 0.12, "triangle", 0.1); tone(784, 0.12, "triangle", 0.1, 0.1); tone(1046, 0.3, "triangle", 0.11, 0.2); },
    count() { tone(440, 0.12, "triangle", 0.09); },
    boom() { noise(0.9, 0.22, 0, 900); tone(120, 0.5, "sawtooth", 0.12, 0, 35); },
    hit() { noise(0.12, 0.12, 0, 2400); tone(220, 0.1, "square", 0.06, 0, 110); },
    bump() { tone(180, 0.1, "triangle", 0.1, 0, 90); noise(0.06, 0.08, 0, 1200); },
    pass() { tone(660, 0.07, "square", 0.06); tone(990, 0.1, "square", 0.06, 0.06); },
    fall() { tone(520, 0.6, "sine", 0.09, 0, 90); },
    splash() { noise(0.4, 0.14, 0, 1500); },
    lava() { noise(0.5, 0.16, 0, 700); tone(150, 0.4, "sawtooth", 0.07, 0, 60); },
    jump() { tone(340, 0.14, "triangle", 0.08, 0, 700); },
    land() { tone(140, 0.06, "triangle", 0.07); },
    coin() { tone(988, 0.07, "square", 0.06); tone(1319, 0.14, "square", 0.06, 0.07); },
    win() { [523, 659, 784, 1046].forEach((f, i) => tone(f, 0.18, "triangle", 0.1, i * 0.1)); },
    lose() { tone(330, 0.2, "sawtooth", 0.07, 0, 200); tone(220, 0.35, "sawtooth", 0.07, 0.18, 110); },
    laser() { tone(1400, 0.35, "sawtooth", 0.07, 0, 300); },
    flag() { tone(660, 0.1, "triangle", 0.09); tone(880, 0.16, "triangle", 0.09, 0.09); },
    safe() { tone(700, 0.1, "triangle", 0.08); },
    crack() { noise(0.15, 0.1, 0, 3000); },
    whoosh() { noise(0.25, 0.1, 0, 1800); },
    vote() { tone(600, 0.06, "triangle", 0.08); },
    reveal() { tone(392, 0.12, "triangle", 0.09); tone(523, 0.12, "triangle", 0.09, 0.1); tone(659, 0.22, "triangle", 0.1, 0.2); },
    siren() { tone(600, 0.2, "square", 0.05, 0, 900); tone(900, 0.2, "square", 0.05, 0.2, 600); },
    stab() { tone(900, 0.08, "sawtooth", 0.09, 0, 200); noise(0.1, 0.08, 0, 2500); },
  };
  window.PgSound = {
    play(name) { const f = defs[name]; if (!f) return; const now = performance.now(); if (last[name] && now - last[name] < 70) return; last[name] = now; try { f(); } catch (e) { /* rien */ } },
  };
})();

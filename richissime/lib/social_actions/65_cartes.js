// Parties de cartes jouées pour de vrai. Rares, mais quand on les accepte, les cartes sont tirées et c'est le jeu qui décide.
const { reg } = require("../socialkit");

const on = (g) => g.settings.cardGames !== false;

reg({ id: "table_blackjack", grp: "jeu", ic: "🂡", l: "Proposer un blackjack", mode: "offer", ages: [18, 100], w: 2, cool: 5, coolPair: 5,
  d: "Une table, un paquet de cartes, une mise. Chacun reçoit deux cartes, tire ou s'arrête, et le plus proche de 21 sans le dépasser gagne. Tu joues la partie en vrai.",
  ask: "$A te propose une partie de blackjack, avec de l'argent sur la table.",
  ok: (g, A, B) => on(g) && A.cash >= 100 && B.cash >= 100, fit: (g, A, B, b) => 0.8 + b.aff / 100,
  no: { ta: "$B n'a pas envie de jouer pour de l'argent aujourd'hui.", bond: { aff: -1 } },
  yes: [{ w: 1, special: "mini_blackjack", ta: "$B s'installe en face de toi.", tb: "Tu t'installes en face de $A.", bond: { aff: 2 } }] });

reg({ id: "table_poker", grp: "jeu", ic: "🃏", l: "Proposer une partie de poker", mode: "offer", ages: [18, 100], w: 2, cool: 5, coolPair: 5,
  d: "Poker à cinq cartes. Tu choisis les cartes à changer, puis tu peux relancer ou te coucher. Le meilleur jeu gagne le pot. Tu joues la partie en vrai.",
  ask: "$A te propose une partie de poker, avec de l'argent sur la table.",
  ok: (g, A, B) => on(g) && A.cash >= 100 && B.cash >= 100, fit: (g, A, B, b) => 0.8 + b.aff / 100,
  no: { ta: "$B préfère garder ses jetons.", bond: { aff: -1 } },
  yes: [{ w: 1, special: "mini_poker", ta: "$B bat les cartes avec un petit sourire.", tb: "Tu bats les cartes avec un petit sourire.", bond: { aff: 2 } }] });

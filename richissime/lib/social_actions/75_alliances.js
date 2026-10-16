// Les liens positifs qui comptent pour de vrai. Alliances, secours financier, carnet d'adresses, financement d'un projet.
const { reg } = require("../socialkit");

reg({ id: "pacte_alliance", grp: "amitie", ic: "🤝", l: "Sceller une alliance", mode: "offer", ages: [14, 100], w: 6, cool: 4, coolPair: 8,
  d: "Une vraie alliance. Vous vous défendez l'un l'autre, vous pouvez compter l'un sur l'autre quand ça va mal, et si l'un de vous trahit l'autre, la rupture sera brutale.",
  ask: "$A te propose une alliance, pour se défendre et se soutenir quoi qu'il arrive.",
  ok: (g, A, B, b) => b.aff >= 25 && b.riv < 20 && !b.tags.allie && !b.tags.betrayed, fit: (g, A, B, b) => 0.8 + b.aff / 60,
  no: { ta: "$B préfère garder sa liberté pour le moment.", bond: { aff: -1 } },
  yes: [{ w: 1, tag: "allie", a: { bonheur: 5, repute: 1 }, b: { bonheur: 5, repute: 1 }, ta: "$B serre ta main. Vous voilà alliés, pour le meilleur et pour le pire.", tb: "Tu serres la main de $A. Vous voilà alliés, pour le meilleur et pour le pire.", bond: { aff: 12 }, news: "🤝 $A et $B scellent une alliance." }] });

reg({ id: "sauver_dettes", grp: "amitie", ic: "🛟", l: "Éponger ses dettes", mode: "direct", ages: [20, 100], w: 4, cool: 4, coolPair: 5,
  d: "Tu règles une bonne partie de ses dettes, jusqu'à 40 % de ton argent. Il ou elle ne l'oubliera jamais.",
  ok: (g, A, B, b) => B.debt >= 5000 && A.cash >= 3000 && (b.aff >= 30 || b.tags.allie || !!(A.partner && A.partner.player === B.seat)), fit: (g, A, B, b) => 1.2 + b.aff / 100,
  direct: [{ w: 1, special: "bailout", a: { bonheur: 3, bonte: 2, repute: 3 }, b: { bonheur: 8 }, ta: "Tu tends la main à $B au pire moment.", tb: "$A tend la main au pire moment.", bond: { aff: 25 } }] });

reg({ id: "presenter_reseau", grp: "travail", ic: "🥂", l: "Ouvrir son carnet d'adresses", mode: "direct", ages: [22, 75], w: 4, cool: 3, coolPair: 4,
  d: "Tu présentes ton proche aux bonnes personnes. Son travail est remarqué, il ou elle peut obtenir une augmentation, ou une piste d'emploi sérieuse s'il ou elle n'en a pas.",
  ok: (g, A, B) => A.stats.repute >= 55 || A.cash >= 100000, fit: (g, A, B, b) => (b.aff >= 25 ? 1.2 : 0.4) + (A.stats.repute >= 70 ? 0.5 : 0),
  direct: [{ w: 1, special: "intro_network", a: { bonheur: 3 }, b: { bonheur: 5 }, ta: "Tu fais jouer ton réseau pour $B.", tb: "$A fait jouer son réseau pour toi.", bond: { aff: 8 } }] });

reg({ id: "financer_projet", grp: "argent", ic: "💼", l: "Financer son projet", mode: "offer", ages: [22, 85], w: 4, cool: 4, coolPair: 5,
  d: "Tu mises environ 8 % de ton argent sur son idée. Si ça prend, tu retrouves ta mise avec un très joli bénéfice. Sinon, tu perds tout.",
  ask: "$A veut financer ton projet, en échange d'une part des bénéfices.",
  ok: (g, A, B, b) => A.cash >= 15000 && b.aff >= 20 && b.riv < 25, fit: (g, A, B, b) => 0.8 + b.aff / 100 + (B.traits.ambition >= 60 ? 0.4 : 0),
  no: { ta: "$B ne veut pas mélanger l'argent et l'amitié.", bond: { aff: -1 } },
  yes: [{ w: 1, special: "fund", ta: "$B accepte ton financement.", tb: "Tu acceptes l'argent de $A.", bond: { aff: 3 } }] });

reg({ id: "confidences", grp: "amitie", ic: "🤫", l: "Partager un secret", mode: "offer", ages: [12, 100], w: 5, cool: 5, coolPair: 8,
  d: "Tu confies quelque chose que personne ne sait. Ça vous rapproche beaucoup, mais si vous vous fâchez un jour, l'autre pourra s'en servir.",
  ask: "$A veut te confier un secret.",
  ok: (g, A, B, b) => b.aff >= 25 && b.riv < 15 && !b.tags.confident, fit: (g, A, B, b) => 0.7 + b.aff / 70,
  no: { ta: "$B préfère ne rien savoir.", bond: { aff: -1 } },
  yes: [{ w: 1, tag: "confident", a: { bonheur: 5 }, b: { bonheur: 4 }, ta: "$B écoute sans juger. Quelque chose de lourd s'envole.", tb: "$A te confie un secret. Tu mesures la confiance qu'on te fait.", bond: { aff: 16 } }] });

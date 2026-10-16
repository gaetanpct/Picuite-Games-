// Réactions. Quand on a été volé, calomnié ou trompé, on peut répondre l'année suivante, mais pas à chaque fois.
// Quand on a perdu une partie, on peut proposer une revanche, double ou rien.
const { reg } = require("../socialkit");

const fresh = (g, A, B) => (g.grievances || []).find((x) => x.v === A.seat && x.c === B.seat && x.round === g.round - 1 && !x.used);
const lost = (g, A, B) => (g.lostGames || []).find((x) => x.loser === A.seat && x.winner === B.seat && x.round === g.round - 1 && !x.used);
const gate = (g, A, B, pct) => ((g.round * 7 + A.seat * 3 + B.seat * 5) % 10) < pct;
const GAMES = { course: "la course", quiz: "le quiz", charme: "le concours de charme", blackjack: "le blackjack", echecs: "les échecs", petanque: "la pétanque", cartes: "les cartes" };

reg({ id: "porter_plainte", grp: "reaction", ic: "⚖️", l: "Porter plainte", mode: "direct", ages: [14, 110], w: 30, cool: 0, coolPair: 0,
  d: (A, g) => "On t'a fait du tort l'an dernier. Tu peux saisir la justice, avec des chances variables de gagner. Si tu perds, tu as perdu ton temps.",
  ok: (g, A, B) => !!fresh(g, A, B) && gate(g, A, B, 7), fit: () => 3,
  direct: [
    { w: (g, A, B) => Math.max(0.2, Math.min(0.8, 0.5 + (A.stats.intel - B.stats.intel) / 250 + (A.stats.repute - B.stats.repute) / 300)), special: "plainte_ok",
      a: { bonheur: 6, repute: 2 }, b: { repute: -10, bonheur: -5 },
      ta: "Tu portes plainte contre $B. L'enquête tient la route et le juge te donne raison. Tu ressors du tribunal la tête haute.", tb: "$A t'a traîné(e) devant la justice et tu as perdu. Le jugement fait le tour de la ville.", bond: { riv: 8 }, news: "⚖️ $A a gagné son procès contre $B." },
    { w: (g, A, B) => 1 - Math.max(0.2, Math.min(0.8, 0.5 + (A.stats.intel - B.stats.intel) / 250 + (A.stats.repute - B.stats.repute) / 300)), special: "plainte_ko",
      a: { bonheur: -4 }, b: { bonheur: 1 },
      ta: "Ta plainte contre $B est classée sans suite, faute de preuves. Tu as payé un avocat pour rien.", tb: "$A a porté plainte contre toi, qui a été classée sans suite. Tu te contentes de hausser les épaules.", bond: { riv: 6 } },
  ] });

reg({ id: "demenir_rumeur", grp: "reaction", ic: "📣", l: "Démentir publiquement", mode: "direct", ages: [12, 110], w: 20, cool: 0, coolPair: 0,
  d: "Une rumeur t'a visé. Tu prends la parole devant tout le monde pour rétablir les faits.",
  ok: (g, A, B) => { const x = fresh(g, A, B); return !!x && (x.kind === "rumor" || x.kind === "denounce") && gate(g, A, B, 8); }, fit: () => 2.5,
  direct: [
    { w: 0.65, a: { repute: 9, bonheur: 4 }, b: { repute: -5 }, ta: "Ton démenti est limpide et ton adversaire n'a rien à répondre. Les gens te croient à nouveau.", tb: "$A prend la parole et ruine la rumeur que tu avais lancée. Tu passes pour un(e) menteur(se).", bond: { riv: 6 }, special: "plainte_ko" },
    { w: 0.35, a: { repute: -3, bonheur: -3 }, b: { repute: 1 }, ta: "Ton démenti sonne faux, et chacun y voit un aveu. La rumeur continue sa route.", tb: "Le démenti de $A est si maladroit qu'il te rend service.", bond: { riv: 4 }, special: "plainte_ko" },
  ] });

reg({ id: "revanche", grp: "reaction", ic: "🔁", l: "Demander une revanche", mode: "offer", ages: [8, 110], w: 30, cool: 0, coolPair: 0,
  d: (A, g) => "Tu as perdu la dernière fois. Tu proposes une revanche, double ou rien.",
  ask: "$A veut sa revanche, double ou rien.",
  ok: (g, A, B) => !!lost(g, A, B) && gate(g, A, B, 6), fit: () => 3,
  no: { ta: "$B refuse la revanche, en disant qu'il vaut mieux rester sur une victoire.", bond: { aff: -1, riv: 3 } },
  yes: [{ w: 1, special: "revanche", ta: "Tu acceptes la revanche avec $B.", tb: "$A obtient sa revanche.", bond: { riv: 3, aff: 1 } }] });

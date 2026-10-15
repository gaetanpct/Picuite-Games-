// Actions de base, gérées par social.js (argent, couple, mariage, entreprise, vol, rumeur, dénonciation, défi).
// Elles sont proposées selon l'âge, le couple et les liens, comme toutes les autres.
const { reg, bond, single, coupleWith, married } = require("../socialkit");

reg({ id: "gift", legacy: true, grp: "argent", ic: "🎁", l: "Faire un cadeau", d: "Tu offres de l'argent. Pas besoin de réponse.", mode: "direct", ui: "amount",
  ages: [10, 120], w: 6, cool: 1, coolPair: 2 });

reg({ id: "loan", legacy: true, grp: "argent", ic: "🏦", l: "Prêter de l'argent", d: "Avec intérêts, remboursable dans quelques années.", ui: "loan",
  ages: [16, 120], w: 5, cool: 2, coolPair: 3, ok: (g, A) => A.cash >= 1000 });

reg({ id: "ask", legacy: true, grp: "argent", ic: "🙏", l: "Demander de l'aide", d: "Tu demandes de l'argent. À l'autre de décider, entièrement ou à moitié.", ui: "amount",
  ages: [12, 120], w: 5, cool: 2, coolPair: 3, fit: (g, A) => (A.cash < 3000 || A.debt > 0 ? 1.6 : 0.5) });

reg({ id: "couple", legacy: true, grp: "coeur", ic: "💘", l: "Sortir ensemble", d: "Vous deviendrez un couple, avec dépenses partagées et un petit plus de bonheur. Une rupture est toujours possible.",
  ages: [15, 100], w: 8, cool: 2, coolPair: 2, prio: 1, ok: (g, A, B, b) => single(A) && single(B) && Math.abs(A.age - B.age) <= 25 && (b.aff >= 14 || !!b.tags.crush),
  fit: (g, A, B, b) => (b.tags.crush ? 3 : b.aff >= 30 ? 1.5 : 0.8) * (Math.abs(A.age - B.age) <= 8 ? 1 : 0.4) });

reg({ id: "marry", legacy: true, grp: "coeur", ic: "💍", l: "Demander en mariage", d: "Il faut déjà être en couple. Le mariage lie vos fortunes en cas de décès ou de divorce.",
  ages: [18, 120], w: 12, cool: 1, coolPair: 2, prio: 2, ok: (g, A, B, b) => !!(A.partner && A.partner.player === B.seat && A.partner.status === "couple") && (g.round - (b.tags.couple !== undefined ? b.tags.couple : g.round - 1)) >= 1 });

reg({ id: "company", legacy: true, grp: "argent", ic: "🤝", l: "Fonder une entreprise", d: "Chacun investit la même somme dans une société à parts égales.", ui: "amount",
  ages: [18, 80], w: 5, cool: 3, coolPair: 4, ok: (g, A, B) => A.cash >= 3000 && !A.retired, fit: (g, A, B, b) => (b.aff >= 20 ? 1.3 : 0.6) });

reg({ id: "steal", legacy: true, grp: "coup_bas", ic: "🦹", l: "Voler", d: "Tu piques de l'argent. Risque d'être attrapé(e).", hostile: true, mode: "direct", ui: "tier",
  ages: [10, 80], w: 4, cool: 2, coolPair: 2, ok: (g, A, B, b) => b.aff < 60 });

reg({ id: "rumor", legacy: true, grp: "coup_bas", ic: "🗣️", l: "Répandre une rumeur", d: "Tu salis sa réputation. Si c'est découvert, ça se retourne contre toi.", hostile: true, mode: "direct",
  ages: [12, 100], w: 5, cool: 2, coolPair: 2, ok: (g, A, B, b) => b.aff < 70 });

reg({ id: "denounce", legacy: true, grp: "coup_bas", ic: "📢", l: "Dénoncer", d: "Tu signales ses casseroles à la police. Si c'est faux, ça te coûte cher.", hostile: true, mode: "direct",
  ages: [18, 100], w: 3, cool: 3, coolPair: 3, ok: (g, A, B, b) => b.riv >= 15 });

reg({ id: "duel", legacy: true, grp: "jeu", ic: "⚔️", l: "Lancer un défi", d: "Un pari d'argent sur une épreuve adaptée à votre âge à tous les deux.", ui: "game",
  ages: [8, 110], w: 6, cool: 1, coolPair: 2,
  fit: (g, A, B) => (Math.max(A.age, B.age) >= 55 ? 0.5 : Math.max(A.age, B.age) >= 40 ? 0.7 : 1.2),
  label: (A) => (A.age < 14 ? "Défier à la récré" : A.age >= 55 ? "Proposer une partie" : A.age >= 40 ? "Proposer un pari amical" : "Lancer un défi") });

// Deux voies vers des fortunes indécentes, l'une légale, l'autre pas. Chaque étape réussie ouvre la suivante,
// et à n'importe quel moment tout peut s'effondrer d'un coup.
const { reg, out, net } = require("../lifekit");
const C = require("../core");

const base = { nostudy: true, noprison: true, school: false, retired: false };
const pct = (f, cap) => (p) => Math.round(Math.min(cap, Math.max(0, net(p)) * f));
const lose = (f) => (p) => -Math.round(Math.max(0, net(p)) * f);
const has = (p, f) => C.hasFlag(p, f);
const ambitious = (p) => (p.traits.ambition >= 55 ? 1.6 : 0.8);

// ---------- la voie légale ----------
reg({ id: "empire_1", grp: "argent", l: "Bâtir un empire", ic: "🏗️", d: "Tu mets tout ce que tu as dans une entreprise qui vise le monde. Une fois sur trois, elle décolle. Si elle décolle, d'autres étapes s'ouvriront, de plus en plus grandes, et de plus en plus dangereuses.",
  need: Object.assign({ money: [25000, null], net: [40000, null], ages: [22, 62], noflag: ["empire_1", "empire_2", "empire_3", "empire_4", "empire_5"] }, base), cost: 20000, cool: 5, w: 2, j: true,
  fit: (p) => ambitious(p) * (p.stats.intel >= 55 ? 1.4 : 0.8),
  outs: [
    out(0.35, "Ton idée prend. Les clients arrivent, les investisseurs aussi. En deux ans, tu diriges une vraie scale-up avec des centaines de salariés.", { empire: { to: 1 }, repute: 8, bonheur: 8, ambition: 4, pub: "🚀 $nom lance une scale-up qui fait parler d'elle." }, true),
    out(0.4, "L'entreprise végète, ni succès ni faillite. Tu gardes la tête hors de l'eau et l'envie d'essayer autre chose.", { bonheur: -2, courage: 2 }),
    out(0.25, "Les ventes ne décollent jamais. Tu fermes au bout de dix-huit mois, avec des dettes et des leçons.", { argent: (p) => -Math.min(Math.max(0, p.cash), 15000), dette: 30000, bonheur: -8, prudent: 2 }, true),
  ] });

const LV = [
  null,
  null,
  { n: 2, from: 1, name: "Passer à l'échelle nationale", d: "Ta scale-up rachète ses concurrents et ouvre dans tous les grands pays voisins.", win: 0.42, flat: 0.38, ok: "Ton groupe écrase ses concurrents. Tu diriges un champion national, avec des milliers de salariés.", ko: "L'expansion est trop rapide, les comptes dérapent et un fonds vend ses parts. Ton groupe perd la moitié de sa valeur." },
  { n: 3, from: 2, name: "Rachats en série et introduction en bourse", d: "Tu enchaînes les rachats, puis tu entres en bourse. Les chiffres deviennent vertigineux, les ennemis aussi.", win: 0.38, flat: 0.42, ok: "Ton introduction en bourse est un triomphe. La valeur de ton groupe s'envole, et les journaux t'appellent par ton prénom.", ko: "Ton introduction en bourse déçoit et un rapport accuse ton groupe de maquiller ses comptes. L'action s'effondre." },
  { n: 4, from: 3, name: "Conquérir le marché mondial", d: "Tu vises le monde entier, avec des usines, des satellites et des gouvernements à convaincre.", win: 0.33, flat: 0.47, ok: "Tu deviens un acteur incontournable de ton secteur sur tous les continents. Les chefs d'État prennent ton appel.", ko: "Une enquête internationale, une amende record et des départs en cascade. Ton empire perd l'essentiel de sa valeur." },
  { n: 5, from: 4, name: "Devenir la première entreprise du monde", d: "Il n'y a plus de limite, sauf celle de ta chute. Chaque décision se compte en dizaines de milliards.", win: 0.28, flat: 0.5, ok: "Ton entreprise passe devant toutes les autres. Ta fortune dépasse celle de plusieurs pays.", ko: "Une faille que tu n'avais pas vue, un scandale mondial, et tout s'écroule en quelques semaines." },
];
LV.forEach((L) => {
  if (!L) return;
  reg({ id: "empire_" + L.n, grp: "argent", l: L.name, ic: "🏢", d: L.d + " Si ça rate, tu peux perdre l'essentiel d'un coup.",
    need: Object.assign({ flag: "empire_" + L.from, noflag: "empire_" + L.n, ages: [24, 85] }, base), cool: 3, w: 5, j: true, fit: (p) => (has(p, "empire_" + L.from) ? 2.2 : 0),
    outs: [
      out(L.win, L.ok, { empire: { to: L.n }, repute: 6, bonheur: 6, ambition: 2, pub: "🏆 $nom pousse son entreprise à un niveau jamais vu." }, true),
      out(L.flat, "L'étape se passe sans accroc majeur, mais rien ne change vraiment. Tu retentes plus tard.", { bonheur: -1 }),
      out(1 - L.win - L.flat, L.ko, { empire: { fall: 0.6, debt: 0 }, repute: -8, bonheur: -12, pub: "💥 L'empire de $nom vacille." }, true),
    ] });
});

// ---------- la voie illégale ----------
const CART = [
  null,
  { n: 1, name: "Étendre le territoire de la famille", d: "Un port, des camions, des élus qui ferment les yeux. Les gains explosent, les ennemis aussi.", win: 0.48, flat: 0.34, gain: 0.7, ok: "Tu prends le contrôle de tout un port. Les valises de billets arrivent par camions.", ko: "Un rival te trahit, les autorités saisissent un énorme chargement et tu passes de longues années en prison." },
  { n: 2, name: "Tisser un réseau international", d: "Des routes entre trois continents, des banques complaisantes et un nom qui fait trembler les enquêteurs.", win: 0.42, flat: 0.38, gain: 0.9, ok: "Ton réseau couvre trois continents. Tu pèses plus que bien des entreprises légales.", ko: "Une opération internationale démantèle ton réseau. Tu es arrêté, et on gèle tes comptes partout dans le monde." },
  { n: 3, name: "Devenir le roi de l'ombre", d: "Un cartel que personne n'ose défier, des États qui négocient avec toi, et un bunker pour dormir.", win: 0.36, flat: 0.4, gain: 1.1, ok: "Tu règnes sur un empire de l'ombre. Ta fortune est indécente, tes nuits sont courtes.", ko: "Un traître de ton cercle proche te livre. Tu tombes pour très longtemps, avec une fortune saisie en quelques heures." },
];
CART.forEach((L) => {
  if (!L) return;
  const crooked = (p) => (p.traits.honnete < 45 ? 1.8 : p.traits.honnete < 70 ? 1 : 0.4);
  reg({ id: "cartel_" + L.n, grp: "argent", tag: "mature", l: L.name, ic: "🕴️", d: L.d + " Chaque étape te rapporte énormément, et tout peut s'arrêter du jour au lendemain, avec des peines de prison très lourdes.",
    need: Object.assign({ flag: L.n === 1 ? "parrain" : ["parrain", "cartel_" + (L.n - 1)], noflag: "cartel_" + L.n, ages: [28, 85] }, base), cool: 3, w: 8, j: true, fit: (p) => (has(p, "parrain") ? 1.8 * crooked(p) : 0),
    outs: [
      out(L.win, L.ok, { argent: pct(L.gain, 1500000000), flag: "cartel_" + L.n, honnete: -6, repute: -3, bonheur: 4, pub: "🕴️ La rumeur dit que $nom dirige un réseau très puissant." }, true),
      out(L.flat, "Les affaires continuent, sans grand changement. Tu restes prudent.", { argent: pct(0.04, 80000000), honnete: -2 }),
      out(1 - L.win - L.flat, L.ko, { prison: 18 + L.n * 6, argent: lose(0.85), unflag: ["mafia", "parrain", "cartel_1", "cartel_2", "cartel_3"], repute: -30, bonheur: -15, pub: "🚔 Le réseau de $nom est démantelé, une peine historique est prononcée." }, true),
    ] });
});

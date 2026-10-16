// Des vies qui sortent de la moyenne. Paris fous, emprunts démesurés, monde de la mafia et de ses longues peines.
const { reg, out, tier, net } = require("../lifekit");
const C = require("../core");

const adult = { ages: [20, 82], nostudy: true, noprison: true, school: false };
const bold = (p) => (p.traits.courage >= 55 ? 1.4 : 0.9);
const crooked = (p) => (p.traits.honnete < 45 ? 1.9 : p.traits.honnete < 65 ? 0.9 : 0.25);
const stake = (p) => Math.max(1500, Math.round(Math.max(p.cash, 0) * 0.8));
const cap = (n, m) => Math.round(Math.min(m, n));

reg({ id: "pari_fou", grp: "argent", l: "Tout miser sur une idée folle", ic: "🎰", d: "Tu mets presque tout ton argent liquide sur une idée que personne ne comprend. Une fois sur quarante, elle change ta vie. Le plus souvent, elle te la complique.",
  need: Object.assign({ money: [3000, null] }, adult), cool: 6, w: 5, j: true, fit: (p) => (p.traits.courage >= 45 ? 1.4 * bold(p) : 0.5),
  outs: [
    out(0.03, "L'impossible arrive. Ton idée devient une entreprise colossale, le genre dont on parle dans les écoles de commerce. Tu n'as plus jamais besoin de regarder le prix de rien.",
      { argent: (p) => -stake(p), item: { kind: "entreprise", name: "Empire né d'une idée folle", value: (p) => cap(Math.max(3000000, stake(p) * 120 + Math.max(0, net(p)) * 4), 2500000000) }, repute: 20, bonheur: 14, ambition: 6, pub: "🦄 $nom a tout misé sur une idée folle, et gagné." }, true),
    out(0.17, "Ton pari paie bien. Tu triples ta mise et tu t'offres un dîner dont tu te souviendras.", { argent: (p) => stake(p) * 2, bonheur: 7, courage: 2 }),
    out(0.4, "Ça marche à moitié. Tu récupères la moitié de ta mise et une belle histoire.", { argent: (p) => -Math.round(stake(p) / 2), bonheur: -2, courage: 2 }),
    out(0.4, "Tout est perdu. L'idée était brillante, le marché n'a jamais suivi.", { argent: (p) => -stake(p), bonheur: -8, prudent: 3 }, true),
  ] });

reg({ id: "emprunt_demesure", grp: "argent", l: "Emprunter énormément pour spéculer", ic: "💣", d: "Un prêt géant, une position à effet de levier. Si ça marche, tu changes de catégorie. Si ça rate, la dette te suit toute ta vie.",
  need: Object.assign({ net: [20000, null], ages: [24, 70] }, { nostudy: true, noprison: true, school: false }), cool: 8, w: 3, j: true,
  fit: (p) => (p.traits.courage >= 55 && p.traits.prudent < 60 ? 1.6 : 0.4),
  outs: [
    out(0.05, "Le coup de poker du siècle. Ton levier explose le plafond, tu rembourses tout, et il reste une fortune.", { argent: (p) => cap(Math.max(250000, net(p) * 12), 900000000), bonheur: 12, repute: 8, pub: "🚀 $nom empoche une fortune après un pari à effet de levier." }, true),
    out(0.3, "Le pari rapporte, sans miracle. Tu rembourses l'emprunt et tu gardes un joli bénéfice.", { argent: (p) => cap(Math.max(15000, net(p) * 0.6), 4000000), bonheur: 4 }),
    out(0.65, "Le marché se retourne. La banque te réclame tout, et les intérêts continuent de courir.", { dette: (p) => cap(Math.max(60000, net(p) * 3), 80000000), bonheur: -12, repute: -3, prudent: 4 }, true),
  ] });

reg({ id: "entrer_mafia", grp: "argent", l: "Rejoindre une organisation criminelle", ic: "🕴️", d: "Quelqu'un te propose de rejoindre la famille. L'argent coule vite, les amis sont fidèles, et le jour où la police frappe, on t'oublie longtemps dans une cellule.", tag: "mature",
  need: Object.assign({ noflag: ["mafia", "parrain"] }, adult, { ages: [18, 60] }), cool: 8, w: 5, j: true, fit: (p) => (C.hasFlag(p, "mafia") || C.hasFlag(p, "parrain") ? 0 : crooked(p) * (tier(p) <= 1 ? 1.5 : 1)),
  outs: [
    out(0.5, "On t'accueille avec un dîner silencieux. Tu es désormais dans la famille. Tu as de l'argent liquide, des obligations, et des amis qui ne posent pas de question.", { argent: 12000, honnete: -10, repute: -3, bonheur: 3, flag: "mafia" }, true),
    out(0.3, "On te teste, puis on te laisse tranquille. Tu n'es pas retenu, mais tu gardes un petit billet.", { argent: 3000, honnete: -3 }),
    out(0.2, "Le dîner était piégé, la police était assise à la table d'à côté. Tu passes quelques années en prison.", { prison: 4, honnete: -6, repute: -10, bonheur: -8 }, true),
  ] });

reg({ id: "monter_en_grade", grp: "argent", l: "Grimper dans la famille", ic: "🪜", d: "Tu veux plus de territoire, plus de respect, plus de coups à jouer. Le sommet est un poste de parrain, et le prix de la chute est énorme.", tag: "mature", prio: 1,
  need: Object.assign({ flag: "mafia" }, { noprison: true, nostudy: true, ages: [20, 80] }), cool: 4, w: 14, j: true, fit: (p) => (C.hasFlag(p, "mafia") && !C.hasFlag(p, "parrain") ? 2 : 0),
  outs: [
    out(0.45, "Le vieux parrain s'efface, tu prends sa place. Désormais on baisse les yeux quand tu passes. Les gains sont immenses, et les années à prévoir en prison aussi.", { argent: (p) => cap(Math.max(60000, net(p) * 0.1), 30000000), honnete: -8, repute: -4, flag: "parrain", unflag: "mafia" }, true),
    out(0.4, "Tu prends du galon et des responsabilités. Rien de définitif, mais les poches se remplissent.", { argent: 30000, honnete: -4 }),
    out(0.15, "Un rival te dénonce. Perquisition, procès, verdict lourd.", { prison: 9, honnete: -4, repute: -12, bonheur: -10 }, true),
  ] });

reg({ id: "quitter_mafia", grp: "argent", l: "Tourner la page de la famille", ic: "🚪", d: "Tu dis que c'est fini. Certains te laissent partir, d'autres te le font payer.", tag: "mature", prio: 1,
  need: { noprison: true, nostudy: true, ages: [20, 90] }, cool: 3, w: 8, fit: (p) => ((C.hasFlag(p, "mafia") || C.hasFlag(p, "parrain")) && (p.mem.jailYears > 0 || p.age > 45) ? 1.6 : (C.hasFlag(p, "mafia") || C.hasFlag(p, "parrain")) ? 0.5 : 0),
  outs: [
    out(0.55, "On te laisse partir, avec un regard qui dit tout. Tu changes de ville et tu dors enfin.", { unflag: ["mafia", "parrain"], honnete: 6, bonheur: 8, repute: 2 }, true),
    out(0.3, "On te laisse partir, mais pas sans une facture lourde.", { unflag: ["mafia", "parrain"], argent: (p) => -Math.round(Math.max(0, net(p)) * 0.3), bonheur: 3 }),
    out(0.15, "Le départ tourne mal. On te fait comprendre que la porte reste fermée, avec ton portefeuille en prime.", { argent: (p) => -Math.round(Math.max(0, net(p)) * 0.25), bonheur: -8, repute: -3 }, true),
  ] });

// ============================================================
// PAGAILLE PARTY — Catalogue des mini-jeux (partagé serveur et client)
// Chaque fiche décrit un jeu. Le code de chaque jeu vit dans games/<id>.js côté serveur.
// ============================================================
(function (root, factory) { if (typeof module === "object" && module.exports) module.exports = factory(); else root.PgCatalog = factory(); })(typeof self !== "undefined" ? self : this, function () {
  const GAMES = [
    { id: "switch", name: "Couleur cible", icon: "🎨", min: 2, max: 8, ideal: "4 à 6", secs: 40, kind: "Survie", move: true,
      controls: ["Flèches ou ZQSD pour courir"],
      rules: ["Une couleur s'affiche sur le panneau.", "Cours sur une case de cette couleur avant la fin du compte à rebours.", "Les autres cases disparaissent, et tu tombes avec elles."],
      scoring: "Le dernier debout gagne. Les autres sont classés dans l'ordre de leur chute." },
    { id: "lava", name: "Lave montante", icon: "🌋", min: 2, max: 8, ideal: "3 à 6", secs: 45, kind: "Survie", move: true,
      controls: ["Flèches ou ZQSD pour courir", "Espace pour sauter sur une plateforme plus haute"],
      rules: ["La lave monte sans arrêt.", "Grimpe de plateforme en plateforme, un saut te fait monter de deux niveaux au plus.", "Celui qui reste au sec le plus longtemps gagne."],
      scoring: "Classement selon l'ordre des chutes dans la lave. Un petit bonus pour celui qui monte le plus haut." },
    { id: "tnt", name: "Bombe en voiture", icon: "💣", min: 2, max: 8, ideal: "4 à 8", secs: 60, kind: "Poursuite", move: true,
      controls: ["Haut pour accélérer, bas pour freiner", "Gauche et droite pour tourner"],
      rules: ["Une voiture porte la bombe et le compte à rebours.", "Touche une autre voiture pour lui passer la bombe avant l'explosion.", "Les piliers servent à esquiver. Celui qui porte la bombe à zéro saute."],
      scoring: "Le dernier survivant gagne. Les autres sont classés dans l'ordre des explosions." },
    { id: "sumo", name: "Sumo glissant", icon: "🧊", min: 2, max: 8, ideal: "3 à 6", secs: 60, kind: "Stratégie physique", move: false,
      controls: ["Gauche et droite pour tourner la flèche", "Haut et bas pour régler la puissance", "Espace pour valider, ou clic de souris pour viser"],
      rules: ["Tout le monde vise en secret, puis se lance en même temps.", "Les chocs éjectent les autres, la glace fait glisser.", "La plateforme rétrécit à chaque lancer."],
      scoring: "Le dernier sur la plateforme gagne. Les autres sont classés dans l'ordre des chutes." },
    { id: "lasers", name: "Lasers invisibles", icon: "🔦", min: 2, max: 8, ideal: "3 à 6", secs: 50, kind: "Bluff", move: false,
      controls: ["Souris ou boutons pour choisir ton déplacement et ton laser", "Valider quand tu es prêt"],
      rules: ["Personne ne voit les autres pendant la préparation.", "Choisis en secret où te déplacer et quelle ligne ou colonne tu tires.", "Tout le monde redevient visible et les lasers partent ensemble."],
      scoring: "Le dernier debout gagne. Les éliminés sont classés dans l'ordre de leur chute." },
    { id: "murder", name: "Meurtre mystère", icon: "🔪", min: 3, max: 8, ideal: "5 à 8", secs: 75, kind: "Rôles secrets", move: true,
      controls: ["Flèches ou ZQSD pour marcher", "Espace pour l'action de ton rôle", "Maj ou la touche E pour accuser le joueur le plus proche"],
      rules: ["Un meurtrier se cache parmi les innocents, un détective connu de tous les protège.", "Le meurtrier frappe de près en silence. Un cadavre fait apparaître un signal.", "Accuser le meurtrier gagne la manche. Accuser un innocent te coûte cher."],
      scoring: "Si le meurtrier tombe, les innocents gagnent. S'il survit jusqu'au bout ou tue tout le monde, il gagne." },
    { id: "duo", name: "Faux semblants", icon: "🎭", min: 2, max: 2, ideal: "2", secs: 45, kind: "Bluff à deux", move: false,
      controls: ["Choisis une pièce et une action, puis valide"],
      rules: ["Chacun reçoit un rôle secret parmi meurtrier, détective et innocent, sans connaître celui de l'autre.", "À chaque tour, on choisit une pièce et une action en secret.", "Frappe au bon endroit, ou accuse au bon moment."],
      scoring: "Une manche à deux, victoire ou défaite nette, avec un petit bonus de survie." },
    { id: "bridge", name: "Pont de verre", icon: "🌉", min: 2, max: 8, ideal: "3 à 8", secs: 50, kind: "Chance et mémoire", move: false,
      controls: ["Gauche ou droite pour choisir une dalle", "Souris acceptée"],
      rules: ["À chaque rangée une dalle est fragile.", "Les joueurs passent chacun leur tour, ceux qui tombent révèlent le bon chemin aux suivants.", "Celui qui traverse en premier gagne."],
      scoring: "Classement selon la distance parcourue. Traverser donne la victoire." },
    { id: "crowd", name: "Faites des groupes", icon: "👥", min: 3, max: 8, ideal: "5 à 8", secs: 40, kind: "Coopération et panique", move: true,
      controls: ["Flèches ou ZQSD pour courir"],
      rules: ["Un nombre est annoncé.", "Rejoins une zone avec exactement ce nombre de joueurs avant la fin.", "Les zones trop pleines ou trop vides sont éliminées."],
      scoring: "Classement selon la manche de l'élimination. Les derniers debout se partagent la victoire." },
    { id: "cagnotte", name: "Cagnotte qui grimpe", icon: "💰", min: 2, max: 8, ideal: "3 à 8", secs: 40, kind: "Risque", move: false,
      controls: ["Espace ou clic pour encaisser"],
      rules: ["La cagnotte grimpe à chaque instant, mais elle peut exploser à tout moment.", "Encaisse avant l'explosion pour garder la valeur.", "Si tu attends trop, tu perds la manche."],
      scoring: "Total sur cinq coups. Le plus gros total gagne." },
    { id: "tiles", name: "Sol en miettes", icon: "🧱", min: 2, max: 8, ideal: "3 à 6", secs: 50, kind: "Survie", move: true,
      controls: ["Flèches ou ZQSD pour courir"],
      rules: ["Chaque dalle effleurée s'effrite et tombe.", "Garde de la place et pousse les autres vers le vide.", "Le dernier debout gagne."],
      scoring: "Classement selon l'ordre des chutes." },
  ];
  const byId = {}; GAMES.forEach((g) => { byId[g.id] = g; });
  return { GAMES, byId, ids: GAMES.map((g) => g.id) };
});

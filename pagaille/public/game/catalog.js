// ============================================================
// PAGAILLE PARTY — Catalogue des mini-jeux (partagé serveur et client)
// Chaque fiche décrit un jeu. Le code de chaque jeu vit dans games/<id>.js côté serveur.
// secs est une durée habituelle, maxSecs est la limite dure. La durée réelle dépend du jeu et du réglage de durée.
// view vaut 3d pour une vraie scène en trois dimensions, 2d pour une interface à plat.
// ============================================================
(function (root, factory) { if (typeof module === "object" && module.exports) module.exports = factory(); else root.PgCatalog = factory(); })(typeof self !== "undefined" ? self : this, function () {
  const GAMES = [
    { id: "tnt", name: "Bombe en voiture", icon: "💣", min: 2, max: 8, ideal: "4 à 8", secs: 100, maxSecs: 170, kind: "Poursuite", skills: ["Adresse", "Chaos"], move: true, view: "3d", hold: 2800, theme: "#ff6b3d",
      controls: ["Haut accélère, bas freine, gauche et droite tournent", "Espace donne un coup de turbo, il se recharge"],
      rules: ["Une voiture porte la bombe et sa mèche brûle.", "Touche une autre voiture pour lui passer la bombe, puis fuis.", "Gare aux trous du sol, la bombe et le vide éliminent."],
      scoring: "Le dernier survivant gagne. Les autres sont classés dans l'ordre de leur élimination." },
    { id: "parcours", name: "Course des fous", icon: "🏁", min: 2, max: 8, ideal: "3 à 8", secs: 95, maxSecs: 170, kind: "Course", skills: ["Adresse", "Réflexes"], move: true, view: "3d", hold: 3000, theme: "#3ddc97",
      controls: ["Flèches ou ZQSD pour courir", "Espace ou X pour sauter, une seconde fois en l'air pour un double saut", "Maj, E ou C pour plonger en avant"],
      rules: ["Franchis des plateformes mobiles, des balanciers et des trous.", "Si tu tombes, tu repars du dernier drapeau.", "Le premier à la ligne d'arrivée gagne."],
      scoring: "Classement selon l'ordre d'arrivée, puis la distance parcourue. Un bonus pour qui n'est jamais tombé." },
    { id: "lava", name: "Lave montante", icon: "🌋", min: 2, max: 8, ideal: "3 à 6", secs: 80, maxSecs: 150, kind: "Survie", skills: ["Adresse", "Survie"], move: true, view: "3d", hold: 2600, theme: "#ff4d2e",
      controls: ["Flèches ou ZQSD pour courir", "Espace ou X pour sauter, une seconde fois en l'air pour un double saut"],
      rules: ["La lave monte sans jamais s'arrêter.", "Grimpe de plateforme en plateforme, les piliers sont de plus en plus hauts.", "Celui qui reste au sec le plus longtemps gagne."],
      scoring: "Classement selon l'ordre des chutes dans la lave. Un bonus pour qui monte le plus haut." },
    { id: "sumo", name: "Sumo glissant", icon: "🧊", min: 2, max: 8, ideal: "3 à 6", secs: 90, maxSecs: 160, kind: "Stratégie physique", skills: ["Anticipation", "Stratégie"], move: false, view: "3d", hold: 2800, theme: "#6cc7ff",
      controls: ["Gauche et droite tournent la flèche", "Haut et bas règlent la puissance", "Espace valide, la souris peut aussi viser"],
      rules: ["Tout le monde vise en secret, puis se lance en même temps sur la glace.", "Les chocs éjectent les adversaires, les météores bousculent tout le monde.", "La plateforme rétrécit à chaque tour."],
      scoring: "Le dernier sur la plateforme gagne. Les autres sont classés dans l'ordre des chutes." },
    { id: "bumper", name: "Choc au sommet", icon: "🥊", min: 2, max: 8, ideal: "3 à 8", secs: 80, maxSecs: 150, kind: "Bagarre", skills: ["Réflexes", "Chaos"], move: true, view: "3d", hold: 2800, theme: "#ff5d8f",
      controls: ["Flèches ou ZQSD pour courir", "Espace pour foncer en avant, ça repousse les gens que tu touches", "Maj, E ou C pour sauter et écraser le sol autour de toi"],
      rules: ["Fonce sur les autres pour les projeter, le but est de les envoyer dans le vide.", "Chaque joueur affiche son pourcentage de dégâts. Plus il est haut, plus les coups l'envoient loin.", "Des bumpers, des vagues et des météores changent le terrain. Le dernier debout gagne."],
      scoring: "Classement selon l'ordre des chutes. Un bonus pour le plus grand nombre d'éjections." },
    { id: "switch", name: "Couleur cible", icon: "🎨", min: 2, max: 8, ideal: "4 à 6", secs: 55, maxSecs: 110, kind: "Survie", skills: ["Réflexes", "Survie"], move: true, view: "3d", hold: 2400, theme: "#ffd23b",
      controls: ["Flèches ou ZQSD pour courir", "Espace pour un petit saut", "Maj, E ou C pour pousser un voisin"],
      rules: ["Une couleur s'affiche, elle change à chaque tour.", "Cours sur une case de cette couleur avant la fin du compte à rebours.", "Les autres cases disparaissent, tu tombes avec elles.", "Après quelques tours les couleurs s'éteignent avant la chute, il faut s'en souvenir."],
      scoring: "Le dernier debout gagne. Les autres sont classés dans l'ordre de leur chute." },
    { id: "tiles", name: "Sol en miettes", icon: "🧱", min: 2, max: 8, ideal: "3 à 6", secs: 60, maxSecs: 120, kind: "Survie", skills: ["Survie", "Anticipation"], move: true, view: "3d", hold: 2400, theme: "#c8a977",
      controls: ["Flèches ou ZQSD pour courir", "Espace ou X pour sauter par dessus un trou"],
      rules: ["Chaque dalle sur laquelle tu cours s'abîme puis tombe, il y a deux étages.", "Des dalles se fissurent aussi toutes seules avec le temps.", "Garde de la place, pousse les autres vers le vide.", "Le dernier debout gagne."],
      scoring: "Classement selon l'ordre des chutes." },
    { id: "memo", name: "Dalles de mémoire", icon: "🧠", min: 2, max: 8, ideal: "3 à 8", secs: 60, maxSecs: 130, kind: "Mémoire", skills: ["Mémoire", "Réflexes"], move: true, view: "3d", hold: 2400, theme: "#b388ff",
      controls: ["Flèches ou ZQSD pour courir", "Espace ou X pour sauter", "Maj, E ou C pour pousser un voisin"],
      rules: ["Une suite de dalles s'allume, retiens bien l'ordre.", "Quand le sol s'éteint, cours sur une dalle qui était allumée avant le signal.", "Les autres dalles tombent, avec toi dessus."],
      scoring: "Le dernier debout gagne. Les autres sont classés dans l'ordre de leur chute." },
    { id: "lasers", name: "Lasers invisibles", icon: "🔦", min: 2, max: 8, ideal: "3 à 8", secs: 70, maxSecs: 150, kind: "Bluff et placement", skills: ["Anticipation", "Bluff"], move: true, view: "3d", hold: 2600, theme: "#ff3b5c",
      controls: ["Flèches ou ZQSD pour marcher, ton laser pointe toujours devant toi", "Espace maintenu pour marcher sans tourner", "Maj ou E quand tu es prêt"],
      rules: ["Pendant le placement, personne ne voit les autres ni leurs lasers.", "À la révélation, tous les lasers apparaissent. Si tu te tiens sur le laser de quelqu'un, tu tombes.", "La plateforme rétrécit à chaque tour et ramène les survivants vers le centre."],
      scoring: "Le dernier debout gagne. Un bonus pour qui a fait tomber le plus de monde." },
    { id: "bridge", name: "Pont de verre", icon: "🌉", min: 2, max: 8, ideal: "3 à 8", secs: 70, maxSecs: 150, kind: "Courage et mémoire", skills: ["Courage", "Mémoire"], move: true, view: "3d", hold: 2600, theme: "#7fe7ff",
      controls: ["Flèches ou ZQSD pour marcher", "Espace ou X pour sauter", "Maj, E ou C pour pousser un voisin"],
      rules: ["À chaque rangée deux dalles identiques, une seule se brise sous tes pieds.", "Quelqu'un doit tester. Les dalles sûres le restent pour tout le monde, une chute te ramène au départ.", "Un mur laser avance derrière vous. Sans avancer, il écrase tout le monde."],
      scoring: "Le premier arrivé gagne, puis l'ordre d'arrivée et la distance. Un bonus pour qui a ouvert la voie." },
    { id: "crowd", name: "Faites des groupes", icon: "👥", min: 3, max: 8, ideal: "5 à 8", secs: 60, maxSecs: 120, kind: "Coopération et panique", skills: ["Coopération", "Réflexes"], move: true, view: "3d", hold: 2400, theme: "#43d17a",
      controls: ["Flèches ou ZQSD pour courir"],
      rules: ["Un nombre est annoncé.", "Rejoins une plateforme avec exactement ce nombre de joueurs avant la fin.", "Les plateformes trop pleines ou trop vides tombent."],
      scoring: "Classement selon la manche de l'élimination. Les derniers debout se partagent la victoire." },
    { id: "ruee", name: "Ruée vers l'or", icon: "⛏️", min: 2, max: 8, ideal: "3 à 6", secs: 90, maxSecs: 170, kind: "Stratégie et ressources", skills: ["Stratégie", "Anticipation"], move: false, view: "3d", hold: 2600, theme: "#ffc233",
      controls: ["Clique sur un gisement pour y envoyer un mineur", "Retire ou valide ta répartition", "La souris ou les boutons du panneau"],
      rules: ["Répartis en secret tes quatre mineurs entre plusieurs gisements.", "Seul sur un gisement, tu empoches tout. À plusieurs, vous vous partagez moins ou vous vous battez.", "Garde des mineurs en réserve pour la banque, elle rapporte sans risque."],
      scoring: "Le plus gros trésor après les tours gagne. Un bonus pour le coup le plus malin." },
    { id: "cagnotte", name: "Cagnotte qui grimpe", icon: "💰", min: 2, max: 8, ideal: "3 à 8", secs: 55, maxSecs: 120, kind: "Risque", skills: ["Risque", "Sang froid"], move: false, view: "2d", hold: 2400, theme: "#ffd23b",
      controls: ["Espace ou clic pour encaisser"],
      rules: ["La cagnotte grimpe à chaque instant, mais elle peut exploser à tout moment.", "Encaisse avant l'explosion pour garder la valeur.", "Si tu attends trop, tu perds la manche."],
      scoring: "Total sur cinq coups. Le plus gros total gagne." },
  ];
  const byId = {}; GAMES.forEach((g) => { byId[g.id] = g; });
  return { GAMES, byId, ids: GAMES.map((g) => g.id) };
});

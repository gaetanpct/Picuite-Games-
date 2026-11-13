// Scènes d'humour noir, de la jeunesse à l'âge adulte
// (fichiers regroupés pour rester sous la limite de fichiers par dossier)

// ===== 100_noir_jeunesse.js =====
{
// HUMOUR NOIR 1/4 — Enfance, école, adolescence, amitiés, soirées
// Les ids commencent par n_ . Les scènes chainOnly sont des conséquences différées.
const { ev, flash, O, C, D } = require("../kit");

// ============ ENFANCE ET ÉCOLE ============
ev("n_pipi_classe", {
  title: "Le déluge du mardi", ages: [6, 9], tags: ["enfance"], ic: "💦🧒", rar: "peu",
  t: "Tu lèves la main trop tard. En quelques secondes, ta chaise devient un petit lac et toute la classe tourne la tête avec une précision de projecteur.",
  c: [
    D("Assumer avec dignité", "🫡", "Tu te lèves, tu annonces « c'est la fontaine » et tu sors la tête haute. La classe applaudit ton culot.", { courage: 3, repute: 1, bonheur: -1, flag: "honte_classe" }),
    C("Accuser le voisin", "👉", [O(0.5, "Le voisin pleure, tout le monde te croit. Il portera cette réputation jusqu'au collège.", { honnete: -4, bonheur: 2, repute: 1 }), O(0.5, "La maîtresse remarque que la flaque est sous TA chaise. L'accusation devient légendaire.", { honnete: -4, bonheur: -4, repute: -2, flag: "honte_classe" })], { risk: 1 }),
    D("Éclater en sanglots", "😭", "La maîtresse te console, ta mère te rapporte un pantalon propre et un biscuit.", { bonheur: -2, bonte: 1, flag: "honte_classe", later: { id: "n_retrouvailles_honte", in: [15, 30], p: 0.6 } }),
  ],
});

ev("n_retrouvailles_honte", {
  chainOnly: true, title: "On n'oublie jamais", tags: ["amis"], ic: "🥂😬",
  t: "Au repas des retrouvailles de ton ancienne classe, quelqu'un lève son verre et lance « et si on parlait du fameux mardi ? ». Tout le monde se tourne vers toi avec un sourire immense. Vingt ans ont passé, mais la flaque est toujours là.",
  c: [
    D("En rire avec tout le monde", "😂", "Tu racontes ta version avec des effets de manche. La soirée t'appartient.", { sociable: 3, bonheur: 4, repute: 2 }),
    D("Quitter la table discrètement", "🚪", "Tu invoques une urgence imaginaire. Personne n'est dupe.", { bonheur: -3, sociable: -2 }),
    C("Révéler ce que tu sais sur les autres", "😈", [O(0.5, "La contre-attaque est cruelle et brillante. La table est en larmes de rire.", { repute: 2, bonheur: 3, bonte: -2 }), O(0.5, "Tu mets le feu à la table. Trois personnes ne te parleront plus.", { repute: -4, bonheur: -3, bonte: -3 })], { risk: 1 }),
  ],
});

ev("n_gage_maudit", {
  title: "Le gage de la cour", ages: [7, 11], tags: ["enfance"], ic: "🤞📜", rar: "peu", who: { ami: "friend" },
  t: "Pendant la récré, $ami te lance un défi absurde. Tu promets, main sur le cœur et doigts croisés, que dans vingt ans vous serez mariés ou associés, au choix. La cloche sonne, personne ne se souvient de rien, sauf toi.",
  c: [
    D("Signer en cachette avec du feutre", "🖊️", "Un petit papier plié au fond de ta trousse. Un jour, il ressortira.", { bonheur: 2, creatif: 1, rel: { ami: 8 }, later: { id: "n_promesse_gage", in: [18, 32], keep: true, p: 0.7 } }),
    D("Oublier aussitôt", "🙈", "Une parole d'enfant, une parole de vent.", { bonheur: 1 }),
  ],
});
ev("n_promesse_gage", {
  chainOnly: true, title: "La promesse du préau", tags: ["amis"], ic: "📜😳", who: { ami: "friend" },
  t: "Dans un vieux carton, tu retrouves un papier plié, griffonné au feutre rouge. « Dans 20 ans, $ami et moi, on se marie ou on monte une boîte ensemble. » C'est signé, daté, et tu as même dessiné un dinosaure en guise de sceau.",
  c: [
    C("Appeler $ami et proposer de tenir parole", "📞", [O(0.4, "Vous montez une petite entreprise absurde, qui marche à votre grande surprise.", { argent: 4000, bonheur: 6, ambition: 2, rel: { ami: 20 } }), O(0.3, "Vous vous mariez... pour rire, devant le maire. Le divorce est prévu pour la semaine suivante.", { bonheur: 5, rel: { ami: 15 }, repute: 1 }), O(0.3, "$ami a complètement oublié et pense à une plaisanterie de mauvais goût.", { bonheur: -2, rel: { ami: -5 } })], { risk: 1 }),
    D("Encadrer le papier et le garder", "🖼️", "Un souvenir précieux. Il trône désormais dans ton salon.", { bonheur: 3, creatif: 1 }),
    D("Le brûler pour ne plus y penser", "🔥", "Les cendres s'envolent. Un poids tombe, ou presque.", { bonheur: 0 }),
  ],
});

ev("n_poisson_rouge", {
  title: "Les adieux de Gaston", ages: [6, 10], tags: ["enfance"], ic: "🐟🚽", rar: "peu",
  t: "Ton poisson rouge flotte le ventre en l'air. Tu veux lui offrir des funérailles dignes, mais ta mère dit « les toilettes, c'est ce qu'il y a de plus rapide ». Tu es partagé{|e} entre le chagrin et le tourbillon.",
  c: [
    D("Organiser des funérailles dans le jardin", "⚰️", "Une boîte à chaussures, un discours de trois phrases et un voisin qui pleure plus que toi. Beau moment.", { bonte: 3, bonheur: 1, creatif: 2 }),
    C("Tirer la chasse d'eau avec solennité", "🚽", [O(0.7, "Gaston part vers la mer. Tu le salues d'un geste militaire.", { courage: 2, bonheur: -1 }), O(0.3, "Le poisson revient, vivant, dans la cuvette. Le trauma est immense.", { bonheur: -4, courage: -1, creatif: 1 })], { risk: 1 }),
    D("Prétendre qu'il est en vacances", "🏖️", "Tu inventes une croisière tropicale. Ton petit frère y croit et demande des cartes postales.", { honnete: -2, creatif: 3, bonheur: 1 }),
  ],
});

ev("n_dessin_maitresse", {
  title: "Le portrait de trop", ages: [6, 9], tags: ["enfance", "ecole"], ic: "🖍️👩‍🏫", rar: "peu", who: { prof: "teacher" },
  t: "Tu dessines $prof avec une bouche immense et des dents très pointues. Elle voit le dessin, blêmit et te convoque avec tes parents. Le mot « psychologue » circule dans les couloirs.",
  c: [
    D("Expliquer que c'est un compliment", "🎨", "Ton talent d'orateur désarme tout le monde. Le dessin est accroché au tableau d'honneur.", { creatif: 3, charme: 1, bonheur: 3, rel: { prof: 5 } }),
    D("Pleurer très fort", "😭", "La maîtresse culpabilise et t'offre une sucette. Efficace mais honteux.", { honnete: -2, bonheur: 1, rel: { prof: -3 } }),
    C("Faire un deuxième dessin pire encore", "😈", [O(0.4, "La maîtresse éclate de rire. Vous devenez complices.", { creatif: 3, bonheur: 4, rel: { prof: 10 } }), O(0.6, "Rendez-vous chez le directeur. Ta mère ne te parle plus pendant deux jours.", { bonheur: -3, repute: -2, rel: { prof: -12 } })], { risk: 1 }),
  ],
});

ev("n_mensonge_papa_astronaute", {
  title: "Mon père est astronaute", ages: [6, 9], tags: ["enfance"], ic: "🚀🤥", rar: "peu", who: { pere: "pere" },
  t: "Pour impressionner la cour, tu annonces que ton père est astronaute. Dix minutes plus tard, toute l'école le sait. Le lendemain, la directrice voudrait « l'inviter à parler aux élèves ».",
  c: [
    C("Tenir le mensonge à tout prix", "🌌", [O(0.35, "Ton père, bon joueur, enfile une combinaison de bricolage et passe une heure à parler. Tu es un héros.", { repute: 4, bonheur: 5, rel: { pere: 10 } }), O(0.65, "Ton père arrive en costume de plombier. La cour hurle de rire.", { bonheur: -4, repute: -2, honnete: -2, rel: { pere: -5 } })], { risk: 1 }),
    D("Tout avouer", "😳", "Tu confesses, la directrice sourit. Les moqueries durent trois jours.", { honnete: 3, bonheur: -2, repute: -1 }),
    D("Dire qu'il est parti en mission secrète", "🕵️", "Un mystère de plus. Tu deviens la légende de l'école.", { creatif: 3, repute: 2, honnete: -2 }),
  ],
});

ev("n_lettre_futur", {
  title: "Lettre à moi-même", ages: [9, 13], tags: ["enfance", "ecole"], ic: "✉️⏳", rar: "peu",
  t: "Le maître vous fait écrire une lettre à votre futur vous, à ouvrir dans vingt ans. Tu t'appliques, avec des fautes et quelques promesses grandioses. Tu glisses aussi un secret, au cas où.",
  c: [
    D("Écrire sérieusement tes rêves", "🌠", "Tu notes ce que tu veux devenir. Le papier retourne dans une boîte.", { ambition: 2, creatif: 1, later: { id: "n_lettre_arrive", in: [18, 30], p: 0.8 } }),
    D("Y glisser une blague nulle", "🤡", "Un message très profond, « t'as perdu tes cheveux ? ». Le futur ne rira peut-être pas.", { creatif: 1, bonheur: 2, later: { id: "n_lettre_arrive", in: [18, 30], p: 0.8 } }),
    D("Y dessiner un robot géant", "🤖", "Une œuvre d'art, à n'en pas douter.", { creatif: 3, later: { id: "n_lettre_arrive", in: [18, 30], p: 0.8 } }),
  ],
});
ev("n_lettre_arrive", {
  chainOnly: true, title: "Reçu avec vingt ans de retard", tags: ["amis"], ic: "📬🧒",
  t: "Un courrier jauni arrive dans ta boîte aux lettres. Ton écriture d'enfant, des fautes, un dessin d'astronaute, et la phrase « si tu n'es pas milliardaire, tu es nul ». La lettre te regarde droit dans les yeux.",
  c: [
    D("Relever le défi", "🔥", "Tu te remets à rêver grand. L'enfant que tu étais t'adresse un vrai coup de pied aux fesses.", { ambition: 4, bonheur: 3 }),
    D("Rire et la ranger", "😂", "Tu as bien changé, le monde aussi. Tu gardes l'astronaute.", { bonheur: 3, creatif: 1 }),
    D("La montrer à tes amis", "📣", "Elle fait le tour de la soirée. Le robot géant reçoit une standing ovation.", { sociable: 2, bonheur: 4, repute: 1 }),
  ],
});

ev("n_cantine_guerre", {
  title: "La bataille de la purée", ages: [6, 12], tags: ["enfance", "ecole"], ic: "🥔⚔️", rar: "commun",
  t: "Un petit pois, un lancer approximatif, un cri de guerre. En deux minutes, la cantine entière devient un champ de bataille de purée et de compote. Le surveillant se réfugie derrière un plateau.",
  c: [
    C("Attaquer sans pitié", "🥄", [O(0.5, "Tu es le héros de la cour, couvert de purée mais le plus acclamé.", { repute: 3, bonheur: 5, courage: 2 }), O(0.5, "Tu touches le directeur en pleine figure. Il pose son plateau avec une lenteur terrifiante.", { repute: -2, bonheur: -3, courage: 1, argent: -20 })], { risk: 1 }),
    D("Te cacher sous la table", "🫣", "Tu observes la guerre comme un correspondant de terrain. Aucun dégât.", { prudent: 2, bonheur: 1 }),
    D("Faire respecter l'ordre", "🙋", "Tu cries « stop ». Tout le monde te regarde, puis te lance de la purée.", { courage: 2, honnete: 1, repute: 1, bonheur: -1 }),
  ],
});

ev("n_triche_dictee", {
  title: "La dictée de la honte", ages: [7, 12], tags: ["enfance", "ecole"], ic: "✏️👀", rar: "commun", who: { prof: "teacher" },
  t: "Tu n'as rien appris. Le voisin, lui, a tout révisé. Sa feuille est pile dans ton angle de vue, comme une offrande du ciel.",
  c: [
    C("Copier discrètement", "👀", [O(0.55, "Tu as la meilleure note de ta vie. Le voisin a fait trois fautes volontaires.", { notes: 8, honnete: -3, bonheur: 3 }), O(0.45, "$prof te voit, prend les deux copies et appelle tes parents.", { notes: -10, honnete: -3, bonheur: -4, repute: -2, rel: { prof: -10 }, flag: "tricheur_ecole" })], { risk: 1 }),
    D("Rendre une copie honnête et vide", "📄", "Un beau zéro, mais tout est propre. Ta maîtresse note ta franchise.", { notes: -6, honnete: 3, bonheur: -1 }),
    D("Inventer des mots", "🪄", "Tu écris « le chat fouillait dans la cabulette ». Le dictionnaire n'a rien à dire.", { creatif: 3, notes: -3, bonheur: 2 }),
  ],
});

ev("n_poux_epidemie", {
  title: "L'invasion", ages: [6, 10], tags: ["enfance"], ic: "🪲🧒", rar: "commun",
  t: "Un message de l'école tombe, dix-sept lettres, trois points d'exclamation. Il y a des poux dans la classe. Ta tête commence à te démanger avec une conviction suspecte.",
  c: [
    D("Se faire peigner par ta mère", "🪮", "Une heure de supplice, trois prières, zéro pou. Tu t'en sors indemne.", { sante: 0, bonheur: -1, rel: { mere: 3 } }),
    D("Raser la tête de ton frère par solidarité", "💈", "Une coupe radicale. Il ressemble à un œuf, il t'en veut pour la vie.", { bonte: -1, bonheur: 1, creatif: 2 }),
    D("Nier jusqu'au bout", "🙈", "Tu continues à jouer comme si de rien n'était. La moitié de la classe te remercie en grattant.", { honnete: -2, bonheur: 1, repute: -1 }),
  ],
});

ev("n_voyage_scolaire_chaos", {
  title: "La classe de neige", ages: [9, 13], tags: ["enfance", "ecole"], ic: "🏔️🚌", rar: "commun",
  t: "Une semaine au chalet avec trente enfants, deux accompagnateurs épuisés et un car qui sent le chocolat chaud. La première nuit, un élève hurle que le chalet est hanté.",
  c: [
    C("Mener l'enquête", "🔦", [O(0.5, "Le fantôme est un accompagnateur somnambule. Tu deviens la légende du voyage.", { courage: 3, repute: 3, bonheur: 5 }), O(0.5, "Tu tombes dans l'escalier et passes la semaine en chaussette plâtrée.", { courage: 2, sante: -2, bonheur: -2 })], { risk: 1 }),
    D("Te cacher sous la couette", "🛏️", "Un fantôme de plus ou de moins, tu n'as rien vu.", { prudent: 2, bonheur: 0 }),
    D("Organiser une soirée contes", "📖", "Tu terrorises tout le dortoir avec une histoire de loup-garou. Ils t'adorent, les moniteurs moins.", { creatif: 3, repute: 2, bonheur: 4 }),
  ],
});

// ============ ADOLESCENCE ============
ev("n_video_fete_ado", {
  title: "Ne pas la regarder", ages: [14, 17], tags: ["ado", "reseaux"], ic: "📹😖", rar: "peu",
  t: "Une soirée pyjama dérape. Quelqu'un te filme en train de danser sur le canapé, un coussin sur la tête et une chanson inventée aux lèvres. La vidéo circule déjà dans le groupe de la classe.",
  c: [
    D("Demander à tout le monde de la supprimer", "🙏", "La plupart la suppriment. Deux exemplaires survivent, forcément.", { honnete: 1, bonheur: -2, flag: "video_honte", later: { id: "n_retour_video", in: [10, 25], p: 0.65 } }),
    D("La poster toi-même avec une légende drôle", "😎", "Ton autodérision coupe l'herbe sous le pied des moqueurs. La vidéo reste, mais c'est toi qui la possèdes.", { courage: 3, repute: 2, bonheur: 2, flag: "video_honte", later: { id: "n_retour_video", in: [10, 25], p: 0.65 } }),
    D("Changer de classe", "🏃", "Tu demandes un transfert. Le problème te suit, mais plus lentement.", { bonheur: -3, prudent: 1, flag: "video_honte", later: { id: "n_retour_video", in: [10, 25], p: 0.65 } }),
  ],
});
ev("n_retour_video", {
  chainOnly: true, title: "Elle est revenue", tags: ["reseaux", "travail"], ic: "📹👻",
  t: "Au moment où tu dois présenter un dossier important, quelqu'un prononce ton nom avec un sourire en coin. La vidéo de ta soirée pyjama, vieille de plusieurs années, vient de ressurgir sur un grand écran, en pleine salle de réunion.",
  c: [
    D("En rire avec la salle", "😂", "Ta réaction détend tout le monde. Plusieurs collègues te demandent même la chanson.", { repute: 3, bonheur: 3, perf: 3, charme: 1 }),
    C("Nier que c'est toi", "🙅", [O(0.3, "Un coup de bluff qui fonctionne, la salle passe à autre chose.", { honnete: -2, bonheur: 1 }), O(0.7, "Quelqu'un te reconnaît avec précision, jusqu'au coussin. L'humiliation est totale.", { honnete: -3, repute: -4, perf: -4, bonheur: -3 })], { risk: 2 }),
    D("Quitter la salle avec dignité", "🚪", "Tu ramasses ton dossier et sors. Le dossier est repris par un collègue plus calme.", { perf: -4, bonheur: -3, prudent: 1 }),
  ],
});

ev("n_rumeur_college", {
  title: "Radio couloir", ages: [11, 16], tags: ["ado"], ic: "🗣️🏫", rar: "commun", who: { rival: "rival" },
  t: "Une rumeur absurde court sur toi dans tout le collège. D'après elle, tu serais le petit-fils d'un dictateur oublié ou le propriétaire d'un hamster mutant. Tout le monde te regarde différemment, et $rival entretient la flamme.",
  c: [
    D("Confirmer la rumeur avec aplomb", "🤥", "Tu en rajoutes. En dix jours, on te demande des autographes à la cantine.", { charme: 2, repute: 3, honnete: -3, bonheur: 4 }),
    D("Démentir avec calme", "🕊️", "Le temps passe, la rumeur meurt. Elle reviendra sous une autre forme.", { honnete: 2, bonheur: -1 }),
    C("Inventer une rumeur pire sur $rival", "😈", [O(0.5, "Les regards se détournent de toi, la rumeur change de cible.", { repute: 2, bonheur: 3, bonte: -3, rel: { rival: -15 } }), O(0.5, "Ta riposte se retourne contre toi. Le collège te boude une semaine.", { repute: -4, bonheur: -3, bonte: -3, rel: { rival: -10 } })], { risk: 1 }),
  ],
});

ev("n_premier_baiser", {
  title: "Un baiser, deux dents", ages: [13, 16], tags: ["ado", "amour"], ic: "💋😬", rar: "commun", who: { crush: "crush" },
  t: "Devant le portail du collège, $crush se penche vers toi. Tu fermes les yeux, tu avances, et vos appareils dentaires s'accrochent avec un bruit de ferraille qui fait se retourner trois classes.",
  c: [
    D("Rire et recommencer", "😂", "Un baiser plus calme, plus heureux. Cela devient une histoire que vous raconterez à tout le monde.", { bonheur: 6, charme: 1, rel: { crush: 15 } }),
    D("Fuir en courant", "🏃", "Tu disparais en direction des toilettes. Un souvenir qui reviendra te hanter.", { bonheur: -4, charme: -1, rel: { crush: -10 } }),
    C("Appeler les pompiers pour vous décoller", "🚒", [O(0.4, "Les pompiers sont adorables, la photo finit au journal.", { repute: 4, bonheur: 3, rel: { crush: 10 } }), O(0.6, "Les pompiers rigolent et la scène devient virale à l'échelle du collège.", { repute: -3, bonheur: -3, charme: -1 })], { risk: 1 }),
  ],
});

ev("n_photo_classe_pire", {
  title: "La photo de classe", ages: [10, 16], tags: ["ado", "ecole"], ic: "📸🙃", rar: "commun",
  t: "Au moment du déclic, tu éternues, tu clignes des deux yeux et un camarade te fait des oreilles de lapin. La photo arrive deux semaines plus tard, et ta mère l'encadre sans honte.",
  c: [
    D("L'accepter", "😅", "La photo orne le salon pour les vingt prochaines années. Tout le monde l'adore sauf toi.", { bonheur: -1, charme: -1, rel: { mere: 3 } }),
    D("La retoucher au feutre", "🖊️", "Tu corriges ton visage, mais le feutre a mordu sur les autres. Le professeur est furieux.", { creatif: 2, honnete: -1, bonheur: 1, repute: -1 }),
    D("La faire disparaître", "🔥", "Tu la glisses dans la cheminée. Ta mère demande où est passée la photo des vacances.", { honnete: -2, bonheur: 1 }),
  ],
});

ev("n_fugue_festival", {
  title: "Direction le festival", ages: [15, 17], tags: ["ado"], ic: "🎪🎒", rar: "peu",
  t: "Tu sèches un week-end entier pour suivre des amis à un festival de musique. Les parents ne sont pas au courant, le sac à dos est plein de chips et la tente a trois trous.",
  c: [
    C("Profiter à fond", "🎸", [O(0.55, "Un week-end légendaire, des chansons à plein poumons et une amitié qui naît sous la pluie.", { bonheur: 8, sociable: 3, courage: 2 }), O(0.45, "Tu perds ton portefeuille, ton téléphone et une chaussure.", { bonheur: -3, argent: -100, sante: -2 })], { risk: 1 }),
    D("Rentrer avant que tes parents ne s'inquiètent", "🏠", "Tu rates le meilleur concert mais évites une grosse dispute.", { prudent: 2, bonheur: -1, honnete: 1 }),
    C("Mentir sur l'endroit où tu étais", "🤥", [O(0.5, "Personne n'y voit rien. Ta crédibilité reste intacte.", { honnete: -3, bonheur: 3 }), O(0.5, "Une photo de toi sur la scène arrive aux oreilles de ta mère. Elle est atterrée.", { honnete: -3, bonheur: -4, rel: { mere: -10 } })], { risk: 1 }),
  ],
});

ev("n_pari_toit", {
  title: "Le pari du toit", ages: [12, 17], tags: ["ado"], ic: "🏠🪂", rar: "rare",
  t: "Un camarade te défie de sauter d'un petit toit dans la piscine du voisin. La distance est correcte, mais le niveau de l'eau, lui, est discutable.",
  c: [
    C("Sauter", "🦅", [O(0.8, "Splash magnifique. Le voisin applaudit sans comprendre.", { courage: 4, repute: 3, bonheur: 4 }), O(0.17, "Mauvaise réception, bras cassé et fierté en miettes.", { sante: -8, argent: -200, repute: -1 }), O(0.03, "L'eau est plus basse que prévu. La suite est trop triste.", { die: "après un plongeon raté dans la piscine du voisin" })], { risk: 3 }),
    D("Refuser et proposer un défi plus calme", "🧠", "Une partie d'échecs à cinq. Tu gagnes, personne ne sait comment.", { intel: 2, prudent: 3, bonheur: 1 }),
    D("Pousser l'ami qui a lancé le défi", "😈", "Il saute, il rit, il hurle. La piscine est sa meilleure amie, il te remercie.", { bonte: -1, bonheur: 3, repute: 1 }),
  ],
});

ev("n_journal_intime_lu", {
  title: "Pages arrachées", ages: [11, 16], tags: ["ado", "famille"], ic: "📓😱", rar: "commun", who: { sibling: "sibling" },
  t: "Ton journal intime est sur la table du salon, ouvert à la page la plus embarrassante, entouré de ton frère ou de ta sœur hilare. Il lit à voix haute avec les intonations.",
  c: [
    D("Lui arracher le carnet", "🤼", "Une bagarre homérique, un livre déchiré, une tristesse silencieuse ensuite.", { bonheur: -3, sport: 1, rel: { sibling: -8 } }),
    D("Rire avec lui ou elle", "😂", "Tu transformes la page en parodie. Tout le monde adore.", { charme: 1, bonheur: 3, rel: { sibling: 10 }, honnete: 1 }),
    C("Menacer de révéler ses secrets", "😈", [O(0.6, "Il se calme aussitôt. Un équilibre de la terreur s'installe.", { bonheur: 2, bonte: -2, rel: { sibling: -3 } }), O(0.4, "Il ne cède pas et le salon devient une zone de guerre.", { bonheur: -3, bonte: -2, rel: { sibling: -12 } })], { risk: 1 }),
  ],
});

ev("n_meilleur_ami_trahit", {
  title: "Le poignard dans le dos", ages: [12, 18], tags: ["ado", "amis"], ic: "🗡️🤝", rar: "peu", who: { copain: "bestfriend" },
  t: "$copain, ton meilleur ami depuis toujours, a tout répété à la classe. Tes secrets, ton petit béguin, ta peur des moutons. Les rires dans le couloir ressemblent à un grand orchestre.",
  c: [
    D("Lui parler face à face", "🗣️", "Il pleure, s'excuse, promet. Une amitié abîmée mais réparable.", { courage: 3, honnete: 2, rel: { copain: -5 } }),
    D("Ne plus jamais lui parler", "🧊", "Tu bloques le contact, tu changes de table. La solitude pèse plus que prévu.", { bonheur: -4, bonte: -1, becomes: { copain: "enemy" } }),
    C("Se venger au bon moment", "⏳", [O(0.6, "Des années plus tard, ta vengeance arrive avec élégance et personne ne comprend d'où elle vient.", { bonheur: 3, bonte: -3, becomes: { copain: "enemy" } }), O(0.4, "Tu oublies, tu le recroises, vous éclatez de rire. Une tendresse bête t'envahit.", { bonheur: 4, rel: { copain: 15 } })], { risk: 1 }),
  ],
});

// ============ AMITIÉS ET TRAHISONS ============
ev("n_ami_copie_vie", {
  title: "Copier-coller", ages: [18, 55], tags: ["amis"], ic: "👯😒", rar: "peu", who: { ami: "friend" },
  t: "$ami a la même coupe de cheveux que toi, le même manteau, la même ville, le même prénom pour son chat. Hier, tu as appris qu'il a postulé dans ton entreprise, avec ton CV légèrement modifié.",
  c: [
    D("Le prendre au mot et l'aider", "🤝", "Il est touché, il progresse. Vous formez un duo inattendu.", { bonte: 3, bonheur: 2, rel: { ami: 12 } }),
    D("Lui dire clairement que ça suffit", "🛑", "Une conversation tendue. Il pleure, puis change de style.", { courage: 2, honnete: 2, rel: { ami: -8 } }),
    C("Lui faire une blague cruelle", "🎭", [O(0.5, "Tu lui envoies une photo piégée de toi. Il la copie, il se ridiculise, il rit de lui-même.", { creatif: 2, bonheur: 3, rel: { ami: 4 } }), O(0.5, "Il découvre la farce et te le fait payer.", { bonheur: -3, repute: -2, rel: { ami: -15 } })], { risk: 1 }),
  ],
});

ev("n_ami_emprunte_tout", {
  title: "Je te le rends demain", ages: [20, 65], tags: ["amis", "argent"], ic: "💸😅", rar: "commun", who: { ami: "friend" },
  t: "$ami t'emprunte une perceuse, un livre, deux cents euros et ta voiture pour le week-end. Les objets reviennent un par un, par miracle, mais jamais l'argent.",
  c: [
    D("Réclamer ton dû avec fermeté", "🧾", "Il paie en deux fois et te regarde avec rancune.", { argent: 100, courage: 2, rel: { ami: -10 } }),
    D("Laisser tomber par amitié", "🤷", "L'argent s'évapore, l'amitié résiste, ton sourire un peu moins.", { argent: -200, bonte: 2, bonheur: -1, rel: { ami: 6 } }),
    C("Lui prêter encore plus pour le piéger", "🪤", [O(0.4, "Il rembourse tout d'un coup, honteux. Tout le monde y gagne.", { argent: 300, honnete: 1, bonheur: 3, rel: { ami: 5 } }), O(0.6, "Il disparaît avec la totalité.", { argent: -500, bonheur: -4, rel: { ami: -25 } })], { risk: 1 }),
  ],
});

ev("n_ami_gagne_loto", {
  title: "Le gros lot du voisin", ages: [20, 70], tags: ["amis", "argent"], ic: "🎰🤑", rar: "rare", who: { ami: "friend" },
  t: "$ami vient de gagner au loto, un montant à huit chiffres. Il t'invite à fêter ça, annonce qu'il quitte son travail et réclame immédiatement que tu viennes vivre avec lui.",
  c: [
    D("Accepter pour la fête", "🥂", "Une semaine de folie, de yachts pas payés et de champagne tiède. Tu repars léger de quelques kilos.", { bonheur: 8, sante: -1, argent: 2000, rel: { ami: 15 } }),
    C("Lui demander un prêt immense", "💶", [O(0.5, "Il accepte avec un grand sourire. Tu changes de vie.", { argent: 30000, bonheur: 6, honnete: -1, rel: { ami: -5 } }), O(0.5, "Il rit et te raccompagne poliment à la porte.", { bonheur: -3, rel: { ami: -15 } })], { risk: 1 }),
    D("Rester un ami discret", "🙂", "Tu le félicites sans rien demander. Il s'en souviendra, toi aussi.", { bonte: 2, bonheur: 2, rel: { ami: 12 } }),
  ],
});

ev("n_ami_secret_avoue", {
  title: "Je dois te dire un truc", ages: [18, 70], tags: ["amis"], ic: "😰🍷", rar: "peu", who: { ami: "friend" },
  t: "$ami t'appelle à minuit. « Tu es assis{|e} ? J'ai quelque chose à avouer. » Il respire fort, tu entends un pigeon, puis un long silence qui ressemble à un film d'horreur.",
  c: [
    D("L'écouter patiemment", "👂", "Il t'avoue avoir écrit en secret des romans de fantasy sous pseudo. Tu les lis tous en une semaine.", { bonte: 2, bonheur: 4, creatif: 1, rel: { ami: 12 } }),
    C("Lui dire que tu devines déjà", "🔮", [O(0.5, "Tu avais deviné juste. Il est stupéfait, soulagé.", { intel: 1, bonheur: 3, rel: { ami: 10 } }), O(0.5, "Tu étais complètement à côté. Il en reste vexé.", { bonheur: -2, rel: { ami: -5 } })], { risk: 1 }),
    D("Raccrocher en faisant semblant d'être coupé", "📵", "Tu fuis la conversation. Il retentera dans six mois.", { honnete: -2, bonheur: -1, rel: { ami: -8 } }),
  ],
});

ev("n_coloc_enfer", {
  title: "Colocation sans pitié", ages: [18, 35], tags: ["amis", "logement"], ic: "🏠🔥", rar: "commun",
  t: "Tes colocs ont un tableau de ménage, un tableau de vaisselle et un tableau de reproches. Hier, un yaourt a disparu et trois personnes ont failli en venir aux mains. Aujourd'hui, c'est la vaisselle.",
  c: [
    D("Organiser un grand conseil", "📋", "Une règle est votée, une autre disparaît. Les murs tiennent encore.", { sociable: 2, bonheur: 1 }),
    D("Déménager à la cloche de bois", "🚪", "Tu pars à l'aube avec deux valises et quelques dettes.", { bonheur: 2, argent: -300, sociable: -1 }),
    C("Se venger du voleur de yaourt", "🥛", [O(0.5, "Tu découvres le coupable. Il admet tout, on l'applaudit.", { bonheur: 3, honnete: 1 }), O(0.5, "Tu accuses le mauvais coloc, qui claque la porte.", { bonheur: -3, honnete: -1, repute: -2 })], { risk: 1 }),
  ],
});

ev("n_surprise_party_ratee", {
  title: "Surprise !", ages: [18, 70], tags: ["amis"], ic: "🎂😳", rar: "commun", who: { ami: "friend" },
  t: "Pour ton anniversaire, $ami a organisé une grande surprise. Quarante personnes se cachent dans l'obscurité. Tu rentres un soir où tu avais prévu de rester en pyjama, la porte s'ouvre et les cris fusent.",
  c: [
    D("Sourire et jouer le jeu", "🥳", "Tu fais comme si tu n'avais rien vu venir. La soirée est inoubliable.", { bonheur: 6, sociable: 3, rel: { ami: 10 } }),
    D("Éclater de rire malgré le pyjama", "😂", "Tu saluais tout le monde en chaussons. Une photo qui marque l'histoire.", { bonheur: 4, charme: -1, repute: 1, rel: { ami: 8 } }),
    D("T'enfuir en pleurant", "😭", "Tu t'enfermes dans la salle de bain pendant une heure. Les invités mangent le gâteau sans toi.", { bonheur: -4, repute: -2, rel: { ami: -10 } }),
  ],
});

// ============ SOIRÉES, ALCOOL ET EXCÈS ============
ev("n_reveil_zoo", {
  title: "Le réveil au zoo", ages: [18, 45], tags: ["fete", "mature"], ic: "🦒🥴", rar: "peu",
  t: "Tu ouvres un œil, puis l'autre. Tu es allongé{|e} dans l'enclos des flamants roses, un chapeau melon sur la tête et un gardien qui te regarde avec attention. Tes souvenirs de la veille ressemblent à du brouillard.",
  c: [
    D("Sortir tranquillement en saluant", "🦩", "Tu salues le gardien, les flamants et les visiteurs. Une sortie digne d'un chef d'État.", { courage: 2, bonheur: 2, sante: -1 }),
    C("Inventer une raison officielle", "📋", [O(0.5, "Tu prétends être inspecteur sanitaire. Tout le monde te croit, par pure fatigue.", { honnete: -3, bonheur: 3 }), O(0.5, "Le gardien appelle la police municipale.", { honnete: -3, argent: -135, repute: -3, bonheur: -3 })], { risk: 1 }),
    D("Prendre un selfie avec les flamants", "🤳", "La photo devient un classique de ton album. Les flamants gardent leur sérieux.", { creatif: 2, bonheur: 4, repute: 1 }),
  ],
});

ev("n_karaoke_fatal", {
  title: "Karaoké fatal", ages: [18, 65], tags: ["fete", "mature"], ic: "🎤🔥", rar: "commun",
  t: "Deux verres de trop, un micro tendu par un inconnu, et la voix de ton enfance intérieure qui te souffle « vas-y ». La chanson choisie fait onze minutes. Tu connais à peu près les trois premières secondes.",
  c: [
    C("Chanter à pleins poumons", "🎶", [O(0.4, "Une performance mythique. La salle te réclame un rappel.", { repute: 3, bonheur: 6, charme: 1 }), O(0.6, "La salle prie pour la fin. Quelqu'un lance un chausson.", { repute: -2, bonheur: -1, courage: 2 })], { risk: 1 }),
    D("Refuser et applaudir les autres", "👏", "Tu laisses la gloire à d'autres. Ton foie aussi.", { bonheur: 1, prudent: 1 }),
    D("Chanter une chanson pour enfants avec sérieux", "🧸", "Un moment de pure poésie absurde. Tout le monde chante avec toi.", { creatif: 3, sociable: 2, bonheur: 5 }),
  ],
});

ev("n_message_patron_ivre", {
  title: "Envoyé à tous", ages: [22, 60], tags: ["fete", "travail", "mature"], ic: "📱🍷", rar: "peu", need: { job: true }, who: { chef: "boss" },
  t: "Le lendemain d'une soirée, ton téléphone indique « message envoyé » à $chef, à minuit quarante-sept. Tu n'oses pas lire le contenu. Les trois mots que tu devines sont « je t'adore » et « démission ».",
  c: [
    D("Tout avouer en face", "🗣️", "Tu poses ta tête sur la table, il éclate de rire. Une complicité naît du désastre.", { honnete: 3, bonheur: 1, perf: -2, rel: { chef: 8 } }),
    C("Nier avoir écrit", "🙅", [O(0.3, "Tu prétends qu'on t'a volé ton téléphone. Il y croit, ou fait semblant.", { honnete: -2, bonheur: 1 }), O(0.7, "Il a gardé une capture d'écran qu'il agite devant toi.", { honnete: -3, perf: -6, repute: -3, rel: { chef: -12 } })], { risk: 2 }),
    D("Prendre trois jours de congé", "🏖️", "Le temps de laisser l'affaire s'oublier, ou de changer de nom.", { bonheur: 2, perf: -4, argent: -150 }),
  ],
});

ev("n_achat_ivre", {
  title: "Commande confirmée", ages: [20, 60], tags: ["fete", "argent", "mature"], ic: "🛒🍾", rar: "peu", need: { money: [500, null] },
  t: "Tu te réveilles avec un mail de confirmation. À deux heures du matin, tu as acheté un cheval, une pirogue et trente mètres de moquette léopard. La livraison est annoncée pour la semaine prochaine.",
  c: [
    C("Annuler en urgence", "📞", [O(0.5, "Le vendeur est compréhensif et rembourse presque tout.", { argent: -150, bonheur: 1, prudent: 2 }), O(0.5, "Le contrat est clair, tu dois payer des frais énormes.", { argent: -1800, bonheur: -3, prudent: 3 })], { risk: 1 }),
    D("Assumer et accueillir le cheval", "🐴", "Il se nomme Gaston, il adore ton salon. Tu apprends à aimer le crottin.", { argent: -900, bonheur: 5, creatif: 3, item: { kind: "loufoque", name: "Cheval de salon", value: 2500 } }),
    D("Revendre l'ensemble à profit", "🤑", "Un flair commercial né de l'urgence. Tu empoches une petite marge.", { argent: 400, intel: 1, ambition: 1 }),
  ],
});

ev("n_mariage_vegas", {
  title: "Oui, oui, oui !", ages: [21, 45], tags: ["fete", "amour", "mature"], ic: "💒🎰", rar: "rare", need: { single: true },
  t: "Un voyage entre amis, un pari, une chapelle ouverte vingt-quatre heures sur vingt-quatre. Tu te réveilles avec une alliance en plastique au doigt et un certificat de mariage signé. Ton conjoint dort encore, il ou elle porte une cape.",
  c: [
    D("Annuler immédiatement", "✂️", "Les papiers sont déchirés, l'affaire est classée. Une légende de plus.", { bonheur: -1, argent: -200, honnete: 1 }),
    C("Essayer de faire vivre l'union", "💍", [O(0.25, "Contre toute attente, l'histoire dure. Vous vous mariez une seconde fois, cette fois pour de bon.", { bonheur: 9, charme: 1, flag: "mariage_vegas_ok" }), O(0.75, "La réalité s'invite en deux semaines. Un divorce, des avocats, un chat à partager.", { bonheur: -4, argent: -1200, later: { id: "n_divorce_express", in: 1 } })], { risk: 2 }),
    D("Fuir à l'aéroport sans un mot", "✈️", "Tu laisses une note. Le marié ou la mariée apprendra la nouvelle autour d'un pancake.", { honnete: -3, bonheur: 2, repute: -2 }),
  ],
});
ev("n_divorce_express", {
  chainOnly: true, title: "Divorce à l'amiable, ou presque", tags: ["amour"], ic: "⚖️💔",
  t: "L'avocat t'explique que ton mariage éclair fait de toi l'ex-conjoint d'une personne dont tu connais surtout le prénom. Il propose un partage équitable du chat, de la cape et d'une moquette léopard.",
  c: [
    D("Tout lui laisser", "🏳️", "Tu pars léger{|e}, un peu plus pauvre et beaucoup plus sage.", { argent: -300, bonheur: 2, prudent: 3 }),
    D("Réclamer la moquette", "🐆", "Un combat d'une absurdité rare. Tu gagnes la moquette, tu perds trois soirées.", { argent: -600, bonheur: -1, creatif: 2 }),
    D("Rester amis", "🤝", "Vous finissez dans un bar à raconter l'histoire. Une belle amitié bizarre commence.", { bonheur: 4, sociable: 2 }),
  ],
});

ev("n_gueule_bois_reunion", {
  title: "La réunion de dix heures", ages: [24, 58], tags: ["fete", "travail", "mature"], ic: "🤢📊", rar: "commun", need: { job: true },
  t: "Ton réveil sonne. Ta tête sonne aussi, mais plus fort. Dans une heure, tu dois présenter le bilan annuel à vingt personnes. Ton reflet ressemble à un chiffon mouillé.",
  c: [
    D("Boire trois cafés et prier", "☕", "Tu tiens, à peu près. Un collègue te regarde avec pitié.", { perf: -1, sante: -2, bonheur: -1 }),
    C("Tout miser sur le charme", "😎", [O(0.4, "Tu improvises, tu fais rire, personne ne s'aperçoit de rien.", { perf: 5, charme: 2, bonheur: 3 }), O(0.6, "Tu bafouilles devant la direction. Un silence glacial s'installe.", { perf: -6, repute: -3, bonheur: -3 })], { risk: 2 }),
    D("Prétexter un virus", "🤒", "Tu restes au lit, honteux{|se} et soulagé{|e}. Ton patron propose du jus d'orange.", { honnete: -2, perf: -2, sante: 1 }),
  ],
});

ev("n_afterwork_derapage", {
  title: "Un petit verre, vraiment", ages: [22, 60], tags: ["fete", "travail", "mature"], ic: "🍻💼", rar: "commun", need: { job: true }, who: { collegue: "colleague" },
  t: "L'afterwork devait durer une heure. Il est trois heures du matin, $collegue chante sur le bar, ton patron a perdu sa cravate et un stagiaire raconte la vie de sa grand-mère à un barman ému.",
  c: [
    D("Partir avant la catastrophe", "🚶", "Tu rentres dormir. Le lendemain, tu seras le seul à avoir bonne mine.", { sante: 1, prudent: 2, perf: 1 }),
    D("Rester et participer au chaos", "🎉", "Tu deviens l'âme de la soirée. Ton équipe t'adore, ton foie moins.", { sociable: 3, bonheur: 5, sante: -2, perf: 2, rel: { collegue: 10 } }),
    C("Prendre des photos pour chantage futur", "📸", [O(0.5, "Ces clichés valent de l'or, ou au moins une promotion.", { perf: 5, honnete: -3, ambition: 2 }), O(0.5, "Quelqu'un te surprend à photographier, l'ambiance se glace.", { honnete: -3, repute: -3, rel: { collegue: -15 } })], { risk: 2 }),
  ],
});

ev("n_concours_biere", {
  title: "Le concours qui tourne mal", ages: [18, 50], tags: ["fete", "mature"], ic: "🍺🏆", rar: "peu",
  t: "Un bar organise un concours de dégustation. Tu t'inscris par défi. À la quatrième pinte, la salle te regarde avec admiration, ton nom s'affiche en lumières et ton estomac fait des bruits de ferry.",
  c: [
    C("Continuer jusqu'à la victoire", "🏆", [O(0.35, "Tu gagnes un trophée en plastique et un an de bières offertes. Ton foie pleure.", { repute: 3, bonheur: 5, sante: -4, argent: 150 }), O(0.65, "Tu t'endors sur la table. Un barman te couvre d'une nappe.", { sante: -3, repute: -2, bonheur: -1 })], { risk: 1 }),
    D("Abandonner avec dignité", "🏳️", "Tu poses ton verre, sous les sifflets amicaux. Tu survis.", { prudent: 2, sante: 0 }),
    D("Passer à l'eau gazeuse en cachette", "💧", "Tu triches avec un talent extraordinaire. Tu rentres chez toi en forme.", { honnete: -2, intel: 1, bonheur: 2 }),
  ],
});

ev("n_nuit_serenade", {
  title: "La sérénade de trois heures", ages: [18, 60], tags: ["fete", "amour", "mature"], ic: "🎸🌙", rar: "peu", who: { crush: "crush" },
  t: "Sur un coup de tête et de rhum, tu décides de chanter sous la fenêtre de $crush, une guitare empruntée dans les mains et un répertoire de deux chansons. Les voisins sortent un à un, en peignoir.",
  c: [
    C("Persévérer jusqu'au bout", "🎶", [O(0.3, "$crush ouvre la fenêtre, éclate de rire et t'invite à monter.", { bonheur: 8, charme: 2, rel: { crush: 25 } }), O(0.7, "Un seau d'eau, un chien qui aboie, la police qui sonne.", { bonheur: -3, argent: -135, repute: -2, rel: { crush: -5 } })], { risk: 2 }),
    D("Rentrer en silence", "🚶", "Tu ranges la guitare dans le coffre de ta honte. Elle est bien là.", { bonheur: -1, prudent: 1 }),
    D("Passer au répertoire de Noël en plein été", "🎄", "Tout le quartier chante avec toi. Tu deviens légende urbaine.", { creatif: 3, sociable: 2, bonheur: 5, repute: 2 }),
  ],
});

}

// ===== 101_noir_adulte1.js =====
{
// HUMOUR NOIR 2/4 — Amour, famille, études, travail
const { ev, flash, O, C, D } = require("../kit");

// ============ AMOUR, SEXUALITÉ ET RELATIONS ============
ev("n_relation_dun_soir", {
  title: "Une nuit, trois conséquences", ages: [18, 40], tags: ["amour", "mature"], ic: "🌙💋", rar: "peu", need: { single: true },
  t: "Une soirée, un regard, un taxi partagé. Au matin, ton hôte dort encore, tu laisses un mot maladroit sur une serviette en papier et tu t'en vas sans te retourner. Tu te dis que personne n'en saura jamais rien.",
  c: [
    D("Laisser ton vrai numéro", "📞", "Quelques semaines d'échanges tendres, puis un joli silence. Cela se passe bien.", { bonheur: 3, charme: 1, flag: "nuit_sans_lendemain" }),
    D("Disparaître sans laisser de trace", "👻", "Un fantôme dans la nuit. Une histoire que tu garderas pour toi.", { bonheur: 2, honnete: -1, flag: "nuit_sans_lendemain", later: { id: "n_enfant_surprise", in: [4, 18], p: 0.18 } }),
    D("Laisser un faux nom et un vrai bisou", "🎭", "Tu t'inventes une vie, puis tu l'oublies.", { honnete: -2, bonheur: 2, flag: "nuit_sans_lendemain", later: { id: "n_enfant_surprise", in: [4, 18], p: 0.18 } }),
  ],
});
ev("n_enfant_surprise", {
  chainOnly: true, title: "Papa, Maman, c'est moi", tags: ["famille", "amour"], ic: "👶📬", need: { noflag: "enfant_surprise_vu" },
  t: "Une lettre recommandée arrive. Un enfant de quelques années, une photo très ressemblante à toi, une lettre posée avec une maladresse émouvante. Une personne du passé t'apprend que tu es parent depuis longtemps, et qu'elle n'a pas osé te le dire.",
  c: [
    C("Aller le ou la rencontrer", "🚪", [O(0.7, "Vous passez un premier week-end maladroit, un parc, une glace, un éclat de rire. L'enfant s'attache vite.", { bonheur: 8, bonte: 4, argent: -400, born: 1, flag: "enfant_surprise_vu", rel: { enfant: 20 } }), O(0.3, "Un test de paternité ou de maternité te surprend, l'enfant n'est pas le tien. Le malentendu laisse un goût étrange.", { bonheur: -3, argent: -300, flag: "enfant_surprise_vu" })], { risk: 1 }),
    D("Demander un test avant tout", "🧬", "La science tranche. Tu as bien un enfant. L'avocat propose un arrangement.", { argent: -600, bonheur: 1, born: 1, flag: "enfant_surprise_vu" }),
    D("Refuser tout contact", "🚫", "Tu enfermes la lettre dans un tiroir. Le tiroir ne se ferme plus tout à fait.", { bonte: -4, bonheur: -4, honnete: -2, flag: "enfant_surprise_vu" }),
  ],
});

ev("n_ex_obsede", {
  title: "L'ex qui n'a pas compris", ages: [20, 60], tags: ["amour"], ic: "📱😶", rar: "peu", need: { rel: "ex" },
  t: "Ton ex t'écrit tous les jours. Un jour pour te présenter des excuses, un autre pour des reproches, un troisième pour te raconter son rêve de la nuit. Il ou elle a même commenté une photo de ton chat avec un cœur brisé.",
  c: [
    D("Répondre une fois, calmement", "🕊️", "Un message poli, définitif. Le silence revient doucement.", { honnete: 2, bonheur: 1 }),
    D("Bloquer sur tous les réseaux", "🚫", "Un soulagement immédiat, une culpabilité diffuse.", { bonheur: 2, prudent: 1 }),
    C("Lui présenter ta nouvelle conquête", "💑", [O(0.4, "Ton ex disparaît pour de bon. Tu savoures.", { bonheur: 4, charme: 1, bonte: -1 }), O(0.6, "Ton ex fait une scène mémorable dans ton restaurant préféré.", { bonheur: -4, repute: -3, argent: -80 })], { risk: 1 }),
  ],
});

ev("n_double_vie", {
  title: "La vie secrète", ages: [25, 65], tags: ["amour", "mature"], ic: "🎭💔", rar: "rare", need: { partner: true },
  t: "Un soir, tu découvres que ton conjoint a une double vie. Un autre appartement, un autre chat, un autre prénom pour lui, et une collection complète de cravates qu'il ne t'a jamais montrées. Il rentre dans trois minutes.",
  c: [
    D("L'attendre et exiger des explications", "🪑", "Une discussion épique de quatre heures. Le chat sort vainqueur.", { courage: 3, bonheur: -4, honnete: 2, flag: "rupture_trahison" }),
    D("Faire tes valises sans rien dire", "🧳", "Tu pars à l'aube, en laissant un mot digne d'un opéra. Un poids tombe de tes épaules.", { bonheur: -2, courage: 2, drop: [] }),
    C("Mener ta propre enquête", "🕵️", [O(0.5, "Tu découvres la vérité complète, bien plus drôle que prévu. Vous vous séparez en riant, ou presque.", { intel: 2, bonheur: 1, honnete: 1 }), O(0.5, "Tu t'enfonces dans une toile de mensonges. L'affaire finit dans le journal local.", { bonheur: -6, repute: -3, argent: -400 })], { risk: 2 }),
  ],
});

ev("n_belle_famille_diner", {
  title: "Le dîner des belles-familles", ages: [22, 60], tags: ["amour", "famille"], ic: "🍽️😰", rar: "commun", need: { partner: true },
  t: "Dîner avec les parents de ton ou ta partenaire. Il y a de la nappe blanche, un rôti sec et une tante qui pose des questions sur ton salaire, ton avenir et la date de ton mariage, par ordre de gravité croissante.",
  c: [
    D("Jouer la carte du charme", "😊", "Tu complimentes la tante, le chien et le rôti. Tout le monde te trouve parfait.", { charme: 2, bonheur: 3, repute: 2 }),
    C("Dire exactement ce que tu penses", "🗣️", [O(0.4, "Une franchise qui plaît. Le beau-père éclate de rire et t'offre un digestif.", { courage: 3, honnete: 2, bonheur: 4 }), O(0.6, "Le silence qui suit est digne d'un enterrement.", { honnete: 2, bonheur: -4, repute: -2 })], { risk: 1 }),
    D("Prétexter une urgence au dessert", "📞", "Tu pars en courant, ton partenaire ne comprend pas. Ou trop bien.", { honnete: -2, bonheur: -1 }),
  ],
});

ev("n_demande_en_mariage_rate", {
  title: "La demande de l'année", ages: [22, 55], tags: ["amour"], ic: "💍🙈", rar: "peu", need: { partner: true },
  t: "Tu prépares la demande en mariage du siècle. La bague, le restaurant, le violoniste. Au moment décisif, le violoniste glisse, la bague tombe dans une soupière et un serveur la ramasse avec une cuillère.",
  c: [
    D("Rire et faire la demande dans la confusion", "😂", "Elle ou il dit oui, entre deux fous rires. Une histoire qui va se raconter pendant des décennies.", { bonheur: 8, charme: 1, flag: "fiance" }),
    D("Reporter à un autre jour", "📆", "Vous finissez le repas, la bague se perd dans la soupe. Le secret reste entier.", { bonheur: -2, prudent: 1 }),
    C("Demander quand même, avec sérieux", "💍", [O(0.55, "Un oui profond, ému. La salle applaudit.", { bonheur: 9, flag: "fiance" }), O(0.45, "Un non surprenant, glacé, sous les yeux d'un serveur compatissant.", { bonheur: -8, charme: -1, repute: -1 })], { risk: 2 }),
  ],
});

ev("n_rencontre_appli", {
  title: "Match de l'enfer", ages: [18, 60], tags: ["amour", "reseaux"], ic: "📱💔", rar: "commun", need: { single: true },
  t: "Ton rendez-vous arrive avec une demi-heure de retard, vingt ans de plus que sur la photo et un perroquet sur l'épaule. Il commande trois plats, un cocktail, puis te demande si tu peux régler la note.",
  c: [
    D("Partir avant le dessert", "🚪", "Tu t'excuses, tu pars. Le perroquet crie ton prénom jusqu'à la sortie.", { bonheur: -1, prudent: 1 }),
    D("Rester et jouer le jeu", "🎭", "Le repas est drôle. Le perroquet est charmant, la personne l'est presque.", { bonheur: 3, sociable: 2, argent: -90 }),
    C("Payer et proposer de se revoir", "💶", [O(0.15, "Une vraie histoire commence, absurde et sincère.", { bonheur: 8, argent: -90, flag: "rencontre_amie" }), O(0.85, "Le deuxième rendez-vous est encore plus étrange.", { bonheur: -2, argent: -150 })], { risk: 1 }),
  ],
});

ev("n_ex_chez_nous", {
  title: "Le retour de l'ex", ages: [25, 70], tags: ["amour"], ic: "🔔😬", rar: "peu", need: { partner: true, rel: "ex" },
  t: "Un soir, la sonnette retentit. C'est ton ex, un sac à la main et les yeux rouges. Il ou elle prétend avoir été mis{|e} à la porte et demande à dormir sur ton canapé. Ton ou ta partenaire est derrière toi, les bras croisés.",
  c: [
    D("Refuser fermement", "🚫", "La porte se ferme, l'ambiance du couple se détend un peu.", { honnete: 1, bonheur: 1, courage: 2 }),
    C("Accepter pour une nuit", "🛋️", [O(0.3, "Vous passez une nuit étonnamment calme, ton ex repart sans rien casser.", { bonte: 3, bonheur: 2 }), O(0.7, "Le matin, l'ex a mangé tes céréales et dit des horreurs à ton partenaire. La vaisselle volera.", { bonheur: -5, bonte: 1, flag: "rupture_trahison" })], { risk: 2 }),
    D("Appeler un taxi et payer le trajet", "🚕", "Une solution propre, froide, efficace. L'ex repart vexé.", { argent: -60, bonheur: 0 }),
  ],
});

ev("n_amour_fou_inconnu", {
  title: "Coup de foudre au rayon surgelés", ages: [18, 70], tags: ["amour"], ic: "⚡🥦", rar: "rare", need: { single: true },
  t: "Entre les petits pois et les glaces à la vanille, tu croises un regard qui dure deux secondes de trop. Une personne magnifique te sourit, puis prend la fuite. Elle a oublié son panier, rempli de dix pots de moutarde.",
  c: [
    C("Courir après elle ou lui", "🏃", [O(0.35, "Tu le ou la rattrapes sur le parking. Vous dînez le soir même.", { bonheur: 8, charme: 2, flag: "rencontre_amie" }), O(0.65, "Tu glisses sur une flaque de glace fondue, la sécurité intervient.", { bonheur: -3, sante: -2, repute: -2 })], { risk: 1 }),
    D("Laisser un mot dans le panier", "📝", "Un numéro de téléphone, un cœur, une blague sur la moutarde. Le message reste sans réponse, puis arrive dix jours plus tard.", { creatif: 2, bonheur: 3, flag: "rencontre_amie" }),
    D("Garder le panier pour toi", "🧺", "Dix pots de moutarde. Tu deviens l'homme ou la femme la plus piquante de la ville.", { bonheur: 1, honnete: -1 }),
  ],
});

ev("n_trio_catastrophe", {
  title: "Le triangle des Bermudes", ages: [20, 50], tags: ["amour", "mature"], ic: "🔺💘", rar: "rare",
  t: "Tu t'aperçois que deux personnes très différentes pensent chacune que tu es leur amoureux ou amoureuse. Elles se présentent toutes deux à ta porte, le même soir, chacune avec un bouquet et un chien.",
  c: [
    D("Tout avouer aux deux", "🕊️", "Une scène digne d'un vaudeville. Aucun des deux ne te reparle pendant un mois.", { honnete: 3, bonheur: -4, repute: -2 }),
    C("Essayer de les séparer pour mieux régner", "🧠", [O(0.25, "Un exploit tactique, tu sors indemne et sans honte.", { intel: 2, honnete: -3, bonheur: 4 }), O(0.75, "Les deux découvrent la supercherie ensemble et vous poursuivent à tour de rôle.", { honnete: -3, bonheur: -6, repute: -4 })], { risk: 2 }),
    D("Choisir celui ou celle avec le chien le plus mignon", "🐶", "Une décision sans appel. Les deux restent stupéfaits.", { bonheur: 3, charme: 1, honnete: -1 }),
  ],
});

ev("n_amour_ancien_prof", {
  title: "Les retrouvailles du lycée", ages: [25, 55], tags: ["amour", "amis"], ic: "🎓💘", rar: "peu", need: { single: true },
  t: "Au vingtième anniversaire de ta promo, tu revois ton ancien béguin de lycée. Il ou elle n'a presque pas changé, ou alors à peine plus que toi. La nuit avance, les verres se multiplient, un slow débute.",
  c: [
    D("Inviter à danser", "💃", "Vous dansez, vous riez, vous vous souvenez de choses qui n'étaient jamais arrivées.", { bonheur: 6, charme: 1, flag: "rencontre_amie" }),
    D("Rester près du buffet", "🍢", "Tu manges trente mini-saucisses en regardant la piste. Une belle soirée de timide.", { bonheur: 1, sante: -1 }),
    C("Avouer enfin ton secret d'il y a vingt ans", "💌", [O(0.4, "Surprise, il ou elle avait le même. Vous partez bras dessus bras dessous.", { bonheur: 9, courage: 2, flag: "rencontre_amie" }), O(0.6, "Il ou elle ne se souvient même pas de toi.", { bonheur: -5, courage: 2, repute: -1 })], { risk: 2 }),
  ],
});

// ============ FAMILLE, PARENTALITÉ ET SECRETS ============
ev("n_secret_famille", {
  title: "Ce que cachait le grenier", ages: [8, 20], tags: ["famille"], ic: "📦🕵️", rar: "peu",
  t: "En fouillant le grenier, tu trouves une boîte fermée par un ruban. Des lettres, une photo d'un inconnu qui te ressemble, un acte de naissance au nom d'une autre famille. Ton cœur bat plus fort.",
  c: [
    D("Tout lire en cachette", "📖", "Tu comprends à moitié. Un secret ancien, un nom oublié. Tu gardes le tout pour toi.", { intel: 2, bonheur: -2, honnete: -1, flag: "secret_famille", later: { id: "n_revelation_famille", in: [12, 30], keep: true } }),
    D("En parler à tes parents", "🗣️", "Un silence tendu, puis une explication à moitié vraie. Tu n'es pas sûr{|e} de tout comprendre.", { honnete: 2, bonheur: -3, flag: "secret_famille", later: { id: "n_revelation_famille", in: [12, 30], keep: true } }),
    D("Remettre la boîte à sa place", "🔒", "Tu ne veux pas savoir. Pas encore. Tu fais semblant de tout ignorer.", { prudent: 2, bonheur: 0, flag: "secret_famille", later: { id: "n_revelation_famille", in: [15, 35], keep: true } }),
  ],
});
ev("n_revelation_famille", {
  chainOnly: true, title: "La vérité sort du placard", tags: ["famille"], ic: "🗝️😳", who: { pere: "pere" },
  t: "À l'occasion d'un repas de famille, une vieille tante s'écrie « il va bien falloir lui dire un jour ». Un verre se brise. Tout le monde se tourne vers toi, avec les yeux de ceux qui savent depuis toujours.",
  c: [
    D("Demander toute la vérité", "🕯️", "Un récit plein de détours, de larmes et d'éclats de rire. Tu repars avec une famille un peu plus grande.", { honnete: 3, bonheur: 3, courage: 3, rel: { pere: 5 } }),
    D("Dire que tu savais déjà", "😎", "Les visages se décomposent. Ta tante change de couleur.", { intel: 2, bonheur: 4, repute: 2 }),
    D("Quitter la table, sidéré{|e}", "🚪", "Tu marches trois heures dans la ville. Au retour, quelqu'un a gardé ton dessert.", { bonheur: -3, courage: 1, rel: { pere: -5 } }),
  ],
});

ev("n_heritage_surprise", {
  title: "Un oncle dont personne ne parlait", ages: [22, 75], tags: ["famille", "argent"], ic: "📜💰", rar: "peu",
  t: "Un notaire t'appelle. Un oncle lointain, mort sur un yacht sans témoin, t'a légué un manoir humide, une collection de timbres et trois perroquets. Il y a aussi une dette, de montant indéterminé.",
  c: [
    C("Accepter l'héritage en bloc", "📜", [O(0.5, "Le manoir cache un petit trésor sous la cave. Tu deviens plus riche que tu ne le pensais.", { argent: 20000, bonheur: 6, item: { kind: "immo", name: "Manoir humide", value: 150000 } }), O(0.5, "Les dettes dépassent la valeur du manoir. Tu apprends à jongler avec les huissiers.", { dette: 20000, bonheur: -4, item: { kind: "immo", name: "Manoir humide", value: 120000 }, later: { id: "n_heritage_conflit", in: [1, 3] } })], { risk: 2 }),
    D("Refuser pour éviter les ennuis", "🙅", "Tu laisses les perroquets au notaire. Tu dors bien, mais tu y penseras souvent.", { prudent: 3, bonheur: 0 }),
    D("Prendre uniquement les perroquets", "🦜", "Ils insultent tout le monde avec élégance. Ton quartier est ravi.", { bonheur: 4, creatif: 2, argent: -150 }),
  ],
});
ev("n_heritage_conflit", {
  chainOnly: true, title: "Les cousins arrivent", tags: ["famille", "argent"], ic: "👨‍👩‍👧‍👦⚖️",
  t: "Trois cousins que tu n'as jamais vus se présentent à ta porte avec un avocat, une tarte et des regards très peu chaleureux. Ils estiment que le manoir leur revient de droit.",
  c: [
    D("Négocier à l'amiable", "🤝", "Un partage honnête est signé autour d'un thé. Chacun repart avec un perroquet.", { argent: -2000, bonheur: 2, bonte: 2 }),
    C("Aller jusqu'au tribunal", "⚖️", [O(0.45, "Tu gagnes. Le juge est visiblement soulagé de se débarrasser du dossier.", { argent: 3000, bonheur: 3, repute: 1 }), O(0.55, "Tu perds, les frais d'avocat engloutissent tout.", { argent: -6000, bonheur: -5 })], { risk: 2 }),
    D("Tout leur laisser", "🏳️", "Ils emportent tout, le manoir, la collection, et un perroquet qui t'insulte depuis la voiture.", { bonheur: -2, bonte: 3, prudent: 2 }),
  ],
});

ev("n_enfant_cartable_feu", {
  title: "La note du directeur", ages: [25, 50], tags: ["famille"], ic: "🔥🎒", rar: "commun", need: { rel: "child" }, who: { enfant: "child" },
  t: "Le directeur de l'école de $enfant t'appelle. $enfant a mis le feu à un cartable, accessoirement celui d'un camarade, accessoirement avec un briquet qu'il ou elle n'était pas censé{e} avoir. Il y a un rapport de trois pages.",
  c: [
    D("Punir avec fermeté", "🚫", "Une sortie en moins pendant un mois. L'enfant boude, l'école soupire de soulagement.", { honnete: 1, bonheur: -2, rel: { enfant: -8 } }),
    D("Discuter longuement", "🗣️", "Un long dialogue sincère. L'enfant avoue qu'il ou elle voulait seulement « voir si ça brûle ».", { bonte: 2, bonheur: 1, rel: { enfant: 8 } }),
    C("Défendre l'enfant devant l'école", "🛡️", [O(0.4, "L'école reconnaît l'accident, l'affaire est classée.", { repute: 1, rel: { enfant: 12 } }), O(0.6, "L'école ne cède pas, et ta réputation de parent en prend un coup.", { repute: -3, bonheur: -2, rel: { enfant: 4 } })], { risk: 1 }),
  ],
});

ev("n_enfant_ado_rebelle", {
  title: "Je ne te parle plus", ages: [30, 55], tags: ["famille"], ic: "🚪😤", rar: "commun", need: { rel: "child" }, who: { enfant: "child" },
  t: "$enfant, devenu{e} adolescent{e}, ne répond plus que par grognements. Son pantalon est trop large, sa musique trop forte et sa porte fermée à clé. Un jour, tu trouves un mot sur la table, « je pars vivre chez Marco ».",
  c: [
    D("Aller le ou la chercher chez Marco", "🚗", "Tu arrives, tu t'excuses d'avance. Marco est en fait un chien. La dispute se transforme en fou rire.", { bonte: 2, bonheur: 4, rel: { enfant: 15 } }),
    D("Laisser du temps", "⏳", "Le silence dure trois jours. $enfant revient avec une pizza en guise d'excuse.", { prudent: 2, bonheur: 1, rel: { enfant: 8 } }),
    C("Menacer de couper les vivres", "💸", [O(0.5, "Un électrochoc. L'enfant devient presque aimable.", { honnete: 1, bonheur: -1, rel: { enfant: -4 } }), O(0.5, "La guerre est déclarée, pour de bon.", { bonheur: -5, rel: { enfant: -20 } })], { risk: 1 }),
  ],
});

ev("n_mariage_parents_dispute", {
  title: "Le mariage des disputes", ages: [25, 60], tags: ["famille"], ic: "💒🥊", rar: "peu", who: { mere: "mere", pere: "pere" },
  t: "Au mariage d'un cousin, ta mère et ton père s'affrontent au sujet d'un plan de table. La pièce montée est menacée, un oncle met ses lunettes de soleil et le marié se cache derrière un rideau.",
  c: [
    D("Faire la médiation", "🕊️", "Tu les écoutes deux heures, tu rédiges un traité de paix. Il tient toute la soirée.", { bonte: 3, intel: 1, bonheur: 2 }),
    D("Boire un verre et regarder le spectacle", "🥂", "Un moment d'anthologie. Tu en fais le récit pendant dix ans.", { bonheur: 3, honnete: -1 }),
    C("Prendre parti", "🎯", [O(0.4, "Tu as raison, ils le reconnaissent en grommelant.", { repute: 1, bonheur: 2, rel: { mere: 6, pere: -3 } }), O(0.6, "Tu as tort, et tu en payes le prix pendant les trois dîners suivants.", { bonheur: -4, rel: { mere: -5, pere: -5 } })], { risk: 1 }),
  ],
});

ev("n_cadeau_noel_catastrophe", {
  title: "Le pire cadeau du monde", ages: [10, 80], tags: ["famille"], ic: "🎁😬", rar: "commun",
  t: "Noël. Tu ouvres ton paquet devant toute la famille. Un pull jaune avec un renne qui chante, une paire de chaussettes assorties et un bon pour « une journée avec la tante Gertrude ». Tout le monde te regarde.",
  c: [
    D("Remercier avec émotion", "🥹", "Tu portes le pull toute la soirée. La tante est aux anges.", { bonte: 2, bonheur: 1, honnete: -1 }),
    D("Éclater de rire", "😂", "Le renne chante, tu chantes avec lui. L'oncle le plus raide de la famille rit aux larmes.", { bonheur: 3, charme: 1 }),
    C("Dire la vérité", "🙊", [O(0.4, "Un silence, puis un éclat de rire général. La tante promet d'offrir des chocolats l'an prochain.", { honnete: 2, bonheur: 2 }), O(0.6, "Elle se lève, quitte la table et ne revient que pour le dessert.", { honnete: 2, bonheur: -3, repute: -1 })], { risk: 1 }),
  ],
});

ev("n_testament_surprise_vivant", {
  title: "Le testament de son vivant", ages: [40, 85], tags: ["famille", "argent"], ic: "📜😏", rar: "rare", need: { rel: "family" },
  t: "Un grand-père riche réunit toute la famille pour lire son testament de son vivant. Il sourit, il observe, il note les réactions. La phrase finale, « je distribue tout à celui qui me fera le plus rire ».",
  c: [
    C("Tenter la blague de ta vie", "🎭", [O(0.3, "Le grand-père éclate de rire et te nomme héritier principal.", { argent: 15000, bonheur: 6, charme: 2, repute: 2 }), O(0.7, "Ton humour tombe à plat. La cousine, elle, a préparé un numéro de clown.", { bonheur: -3, charme: -1 })], { risk: 2 }),
    D("Lui offrir sincèrement du temps", "🫂", "Une après-midi à lui écouter ses souvenirs. Il te sourit, il n'oublie pas.", { bonte: 3, bonheur: 4, argent: 1000 }),
    D("Quitter la salle en disant que c'est ridicule", "🚪", "Tu perds sans doute des milliers d'euros, mais tu gagnes en dignité.", { honnete: 2, bonheur: 1, argent: -50 }),
  ],
});

// ============ ÉTUDES ET ÉCHECS SCOLAIRES ============
ev("n_orientation_absurde", {
  title: "Le conseiller d'orientation", ages: [14, 18], tags: ["ecole"], ic: "🧭🤨", rar: "commun",
  t: "Le conseiller d'orientation te regarde longuement, consulte une feuille et annonce « d'après vos résultats, vous avez toutes les chances de devenir dompteur de puces ». Il le dit avec un sérieux administratif.",
  c: [
    D("Prendre la proposition au sérieux", "🪲", "Tu explores la piste. Tu découvres une passion sincère pour le dressage de puces.", { creatif: 3, bonheur: 3, flag: "puces" }),
    D("Ignorer son avis", "🙄", "Tu choisis ta voie sans lui. Il hoche la tête avec compassion.", { ambition: 1, bonheur: 0 }),
    D("Contester auprès du directeur", "🗣️", "Un long échange administratif. Le conseiller est muté.", { courage: 2, repute: 1, bonheur: 1 }),
  ],
});

ev("n_redoublement_epique", {
  title: "Le redoublement qui change tout", ages: [15, 22], tags: ["ecole"], ic: "📚🔁", rar: "peu",
  t: "Tu redoubles pour la deuxième fois. Tes camarades de la première heure passent en troisième année, toi en deuxième chance. Ton nouveau groupe t'accueille avec des lazzis et un sandwich.",
  c: [
    D("Travailler comme un forcené", "💪", "Tu bûches jour et nuit. Les résultats suivent, avec une fatigue sourde.", { notes: 10, intel: 2, sante: -2, bonheur: -1 }),
    D("Prendre ça avec humour", "😄", "Tu deviens la mascotte de la classe. Les profs t'adorent, les notes un peu moins.", { notes: 1, bonheur: 4, sociable: 3 }),
    C("Tricher avec une application secrète", "📱", [O(0.4, "Personne ne remarque rien, tu passes sans effort.", { notes: 8, honnete: -4, bonheur: 3 }), O(0.6, "Tu es repéré{|e}. L'exclusion est immédiate.", { notes: -8, honnete: -4, repute: -4, bonheur: -5, flag: "tricheur_ecole" })], { risk: 2 }),
  ],
});

ev("n_mensonge_cv", {
  title: "Un diplôme très imaginatif", ages: [21, 50], tags: ["travail", "etudes"], ic: "📄🤥", rar: "peu", need: { nojob: true },
  t: "Pour décrocher un entretien, tu embellis légèrement ton CV. Un diplôme d'une école très prestigieuse, quelques stages en Suisse, et une fluence « bilingue » dans une langue que tu as seulement chantée sous la douche.",
  c: [
    C("Envoyer le CV tel quel", "📨", [O(0.6, "Tu décroches l'entretien, puis le poste. Une carrière brillante commence sur un mensonge.", { job: "consultant:0", honnete: -4, bonheur: 4, flag: "cv_mensonge", later: { id: "n_cv_controle", in: [3, 15], p: 0.65 } }), O(0.4, "Le recruteur parle la langue en question. Un silence de quatre minutes s'installe.", { honnete: -2, bonheur: -3, repute: -2 })], { risk: 2 }),
    D("Rendre le CV honnête", "📄", "Plus modeste, plus vrai. Tu décroches un entretien raisonnable.", { honnete: 3, bonheur: 1 }),
    D("Dire que tu étais en tournée avec un cirque", "🎪", "Ton récit enchante le recruteur. Il t'engage sans rien vérifier.", { creatif: 3, honnete: -2, bonheur: 3, jobHunt: true }),
  ],
});
ev("n_cv_controle", {
  chainOnly: true, title: "Vérification des diplômes", tags: ["travail"], ic: "🔍📄", need: { job: true },
  t: "Un audit interne contrôle tous les diplômes. Le directeur des ressources humaines te convoque avec un dossier épais. Il pose ton CV sur la table, ouvre la page 2 et lit à voix haute « bilingue en finnois ».",
  c: [
    D("Tout avouer", "🕊️", "Tu t'excuses, tu t'expliques. On te garde sur un poste plus modeste.", { honnete: 3, perf: -6, bonheur: -3, demote: true }),
    C("Nier jusqu'au bout", "🙅", [O(0.3, "Le dossier est perdu, personne ne cherche plus loin.", { honnete: -3, bonheur: 2 }), O(0.7, "Une preuve irréfutable. Tu es licencié{|e}.", { honnete: -3, fire: true, repute: -5, bonheur: -6 })], { risk: 3 }),
    D("Démissionner avant le scandale", "🚪", "Tu pars la tête haute, ta dignité à moitié intacte.", { quit: true, bonheur: -2, repute: -1 }),
  ],
});

ev("n_mention_inattendue", {
  title: "Le plus beau jour de ton année", ages: [16, 24], tags: ["ecole", "chance"], ic: "🎓✨", rar: "rare",
  t: "Tu n'as presque pas révisé, tu as répondu à tout au hasard, et tu reçois pourtant une mention exceptionnelle. Les profs sont suspicieux, tes parents pleurent, et le correcteur se demande lui-même ce qui s'est passé.",
  c: [
    D("Savourer sans poser de question", "🍾", "Tu fêtes ça jusqu'à l'aube. Personne ne t'a rien demandé.", { notes: 10, bonheur: 8, honnete: -1, repute: 2 }),
    D("Avouer ton coup de chance", "😅", "Tu confesses à ton prof, qui rit et te garde comme assistant{|e}.", { honnete: 3, bonheur: 4, repute: 1 }),
    D("Demander une recorrection", "🧐", "Ta note baisse de trois points, mais la mention reste. Le destin est généreux.", { honnete: 2, bonheur: 5 }),
  ],
});

ev("n_grand_oral_catastrophe", {
  title: "L'oral du siècle", ages: [17, 26], tags: ["ecole", "etudes"], ic: "🎤🥶", rar: "commun",
  t: "Devant un jury de cinq personnes, tu ouvres la bouche et rien ne sort. Puis un hoquet. Puis un chant de baleine involontaire. Le jury est pétrifié, un des examinateurs note quelque chose avec gravité.",
  c: [
    D("Éclater de rire et recommencer", "😂", "Ton rire est contagieux. Le jury aussi s'y met. Tu obtiens une bonne note pour ton courage.", { notes: 4, courage: 3, bonheur: 3 }),
    D("Fuir la salle", "🏃", "Tu sors en trombe. Le concierge te regarde passer avec sérénité.", { notes: -10, bonheur: -5, courage: -1 }),
    D("Continuer avec dignité, hoquet compris", "🎩", "Le hoquet devient un rythme. Tu finis sous les applaudissements polis.", { notes: 2, courage: 2, bonheur: 1, creatif: 1 }),
  ],
});

ev("n_stage_enfer", {
  title: "Stagiaire à vie", ages: [18, 26], tags: ["travail", "etudes"], ic: "📎😵", rar: "commun",
  t: "Ton stage consiste à faire du café, trier des trombones et acheter des croissants pour un patron qui t'appelle « le stagiaire ». Le nom de ton badge est écrit à la main, avec une faute d'orthographe.",
  c: [
    D("Faire du zèle et impressionner", "🌟", "Tu appris tout, tu rends tout, tu proposes des idées. On te remarque, un peu.", { ambition: 2, perf: 3, bonheur: -2, sante: -1 }),
    D("Démissionner avec panache", "🚪", "Tu pars en laissant un mug avec « merci pour le café ». Une légende de bureau.", { bonheur: 3, honnete: 1, argent: -200 }),
    C("Se plaindre à la direction", "🗣️", [O(0.4, "Le patron s'excuse, ton statut change, tu es payé{|e}.", { argent: 600, repute: 2, courage: 3 }), O(0.6, "Il note ton nom pour ne plus jamais te rappeler.", { repute: -3, bonheur: -2 })], { risk: 1 }),
  ],
});

// ============ TRAVAIL, CHÔMAGE ET CARRIÈRE ============
ev("n_licenciement_absurde", {
  title: "Merci pour votre service", ages: [22, 62], tags: ["travail"], ic: "📦😶", rar: "peu", need: { job: true },
  t: "Un matin, ton badge ne marche plus. Un agent de sécurité te tend un carton avec ta plante verte, une tasse et un chèque. Le motif du licenciement, selon la lettre, est « poste supprimé par un algorithme en retard d'une version ».",
  c: [
    D("Partir avec dignité", "🚶", "Tu remercies tout le monde, tu quittes les lieux. Le carton pèse plus lourd que prévu.", { fire: true, bonheur: -4, honnete: 1, later: { id: "n_chomage_spirale", in: 1 } }),
    C("Attaquer aux prud'hommes", "⚖️", [O(0.4, "Le juge te donne raison. Une indemnité tombe, ton ancien patron change de couleur.", { fire: true, argent: 8000, bonheur: 4, later: { id: "n_chomage_spirale", in: 1 } }), O(0.6, "L'affaire s'éternise. Les honoraires dépassent l'indemnité.", { fire: true, argent: -2000, bonheur: -5, later: { id: "n_chomage_spirale", in: 1 } })], { risk: 2 }),
    D("Embarquer la plante et la photocopieuse", "🪴", "Un petit cambriolage sentimental. L'entreprise n'a jamais vu passer ni l'une ni l'autre.", { fire: true, honnete: -3, bonheur: 2, record: 0, later: { id: "n_chomage_spirale", in: 1 } }),
  ],
});
ev("n_chomage_spirale", {
  chainOnly: true, title: "Le chômage, ce grand inconnu", tags: ["travail"], ic: "🛋️📉", need: { nojob: true },
  t: "Les journées se suivent, longues et sans horaire. Tu as relu trois fois ton CV, vidé ton frigo et passé une demi-journée à regarder un escargot traverser la terrasse. L'estime de soi s'effrite doucement.",
  c: [
    D("Se reconvertir complètement", "🔄", "Tu te lances dans une formation improbable, dompteur de plantes ou conseiller en moustaches. Une nouvelle vie commence.", { argent: -1500, bonheur: 3, creatif: 3, jobHunt: true }),
    D("Créer ta propre entreprise", "🚀", "Une idée, un site web, une tasse de café. Tu te lances, avec plus de courage que de capital.", { bonheur: 4, ambition: 3, jobHunt: true }),
    C("Attendre que ça passe", "⏳", [O(0.5, "Un coup de fil inattendu te propose un contrat sur un malentendu.", { jobHunt: true, bonheur: 3 }), O(0.5, "Les semaines deviennent des mois. Le moral descend.", { bonheur: -6, sante: -2, flag: "creux_chomage" })], { risk: 1 }),
  ],
});

ev("n_promotion_accident", {
  title: "Nommé par erreur", ages: [24, 60], tags: ["travail", "chance"], ic: "🏆🙃", rar: "rare", need: { job: true },
  t: "Un mail du siège t'annonce ta nomination au poste de directeur, avec un salaire doublé et un bureau face à la mer. Tu cherches l'erreur longtemps, avant de comprendre que le message était destiné à un homonyme.",
  c: [
    D("Accepter sans rien dire", "🤫", "Tu prends le poste, le bureau, le café brésilien. Tu apprends en route, ou presque.", { promote: true, honnete: -3, bonheur: 6, perf: -3, flag: "poste_par_erreur" }),
    D("Prévenir le siège de l'erreur", "📞", "Le siège éclate de rire et te propose un poste plus raisonnable pour ta franchise.", { honnete: 4, raise: 0.1, bonheur: 3, repute: 2 }),
    C("Demander une augmentation en plus", "💶", [O(0.3, "Le siège a peur d'un scandale et accorde tout.", { raise: 0.3, honnete: -3, bonheur: 5 }), O(0.7, "On découvre la méprise, tu es licencié{|e} pour usurpation de nomination.", { fire: true, honnete: -3, bonheur: -6, repute: -4 })], { risk: 3 }),
  ],
});

ev("n_boss_humiliation", {
  title: "La réunion de trop", ages: [22, 62], tags: ["travail"], ic: "😬📣", rar: "commun", need: { job: true }, who: { chef: "boss" },
  t: "$chef te reprend publiquement pour une erreur que tu n'as pas faite, devant trente collègues, avec un tableau et un pointeur laser. Un collègue te regarde en haussant les sourcils de compassion.",
  c: [
    D("Répondre calmement avec des preuves", "📊", "Tu sors les chiffres. Le silence tombe, puis la rectification. Tu gagnes en respect.", { courage: 3, intel: 1, perf: 4, repute: 2, rel: { chef: -5 } }),
    D("Encaisser et rager en silence", "😤", "Tu avales la couleuvre. Elle te reste en travers pendant des jours.", { bonheur: -3, perf: -2, prudent: 1 }),
    C("Rendre l'humiliation", "🎯", [O(0.35, "Tu réponds avec esprit. La salle éclate de rire, le chef rougit.", { repute: 3, bonheur: 3, rel: { chef: -20 }, perf: 2 }), O(0.65, "Ta réplique rate sa cible. Le chef te convoque en privé, longtemps.", { repute: -3, perf: -6, bonheur: -3, rel: { chef: -20 } })], { risk: 2 }),
  ],
});

ev("n_startup_brillante", {
  title: "La start-up de trop", ages: [22, 55], tags: ["travail", "argent"], ic: "🚀💸", rar: "peu", need: { money: [3000, null] },
  t: "Un ami te propose de lever des fonds pour une application qui transforme les cris des chats en haïkus. Les investisseurs adorent. Le logiciel plante une fois sur deux. Les chats, eux, ne comprennent rien.",
  c: [
    C("Investir et foncer", "💶", [O(0.2, "L'application explose. Vous revendez pour une somme absurde.", { argent: 60000, bonheur: 8, repute: 4, ambition: 3 }), O(0.8, "La start-up s'évapore en dix-huit mois, laissant des dettes et des chats mécontents.", { argent: -3000, dette: 4000, bonheur: -4 })], { risk: 3, cost: 3000 }),
    D("Rejoindre comme simple salarié", "💼", "Un petit salaire, une grande ambiance, une table de ping-pong. Tu apprends beaucoup.", { argent: 2000, ambition: 1, bonheur: 3 }),
    D("Décliner poliment", "🙅", "Tu laisses les chats à leurs haïkus. La start-up fait faillite, tu respires.", { prudent: 2, bonheur: 1 }),
  ],
});

ev("n_collegue_vole_idee", {
  title: "Mon idée, son nom", ages: [22, 62], tags: ["travail"], ic: "🕵️💡", rar: "commun", need: { job: true }, who: { collegue: "colleague" },
  t: "Tu découvres que $collegue présente ton projet à la direction, mot pour mot, avec ton schéma et tes fautes de frappe. Il a même gardé ton clin d'œil final.",
  c: [
    D("Le démasquer en réunion", "📣", "Tu exposes l'affaire devant tout le monde. Les regards se tournent vers lui, la direction hésite.", { courage: 3, perf: 3, repute: 2, rel: { collegue: -25 } }),
    D("Lui en parler en tête à tête", "🗣️", "Il s'excuse, promet de rectifier. Il ne le fera jamais complètement.", { honnete: 2, perf: 1, rel: { collegue: -8 } }),
    C("Lui voler la prochaine idée", "🥷", [O(0.45, "Tu devances tout le monde et brilles. Il pâlit.", { perf: 5, honnete: -3, ambition: 2, rel: { collegue: -20 } }), O(0.55, "Il t'avait tendu un piège. Tu te ridiculises devant la direction.", { perf: -6, honnete: -3, repute: -4 })], { risk: 2 }),
  ],
});

ev("n_teletravail_derapage", {
  title: "Caméra allumée", ages: [22, 62], tags: ["travail", "reseaux"], ic: "💻🙈", rar: "commun", need: { job: true },
  t: "Pendant une visioconférence avec soixante personnes, tu te lèves pour attraper un café. Tu portes un caleçon à motifs de canard, ton chat marche sur le clavier, et ton micro est resté ouvert. Un silence admiratif s'installe.",
  c: [
    D("Assumer", "🦆", "Tu salues l'écran et te rassois. Ton collègue démarre une ola dans la discussion.", { bonheur: 3, repute: 1, charme: 1, courage: 2 }),
    D("Couper la caméra et simuler un bug", "📵", "Tu fais semblant de planter. Le plantage dure jusqu'à la fin de la réunion.", { honnete: -2, bonheur: -1 }),
    C("Dire que c'est une blague de l'équipe technique", "🎭", [O(0.3, "Personne ne vérifie, tu t'en sors.", { honnete: -2, bonheur: 2 }), O(0.7, "Le service informatique est vexé et prouve le contraire avec un journal détaillé.", { honnete: -3, repute: -3, perf: -2 })], { risk: 1 }),
  ],
});

ev("n_burnout_collectif", {
  title: "Le bureau déprime", ages: [24, 62], tags: ["travail", "sante"], ic: "🪫👥", rar: "peu", need: { job: true },
  t: "Dans l'équipe, une personne s'écroule, puis deux, puis cinq. L'open space ressemble à un champ de bataille de post-it. Ton manager répond par un atelier « sourire du lundi » avec des ballons.",
  c: [
    D("Alerter la direction", "📣", "Un rapport circonstancié, quelques réunions pénibles. Quelques changements concrets arrivent.", { courage: 3, repute: 2, perf: -1, bonheur: 1 }),
    D("Quitter le navire", "🚪", "Tu pars, la tête haute et le CV fraîchement mis à jour.", { quit: true, jobHunt: true, bonheur: 2 }),
    D("Organiser une sortie de groupe", "🎳", "Un bowling, des rires, une trêve de quelques heures. Ça fait du bien à tous.", { sociable: 3, bonheur: 3, argent: -60, perf: 1 }),
  ],
});

ev("n_chef_gueule_noire", {
  title: "Le patron fantôme", ages: [24, 62], tags: ["travail"], ic: "👻👔", rar: "peu", need: { job: true },
  t: "Ton nouveau patron n'a jamais été vu en vrai. Il donne ses ordres par mail à trois heures du matin, signés d'une seule initiale. Un collègue jure qu'il l'a croisé dans l'ascenseur, mais il s'est évaporé.",
  c: [
    C("Mener ta propre enquête", "🕵️", [O(0.4, "Le patron est un chat roux, nommé Directeur, adopté par la standardiste. Les mails étaient écrits par elle. La boîte est conquise.", { bonheur: 5, creatif: 2, repute: 2 }), O(0.6, "Tu ne trouves rien, mais on te reproche ta curiosité.", { perf: -3, repute: -1, bonheur: -1 })], { risk: 1 }),
    D("Faire ton travail sans te poser de question", "📎", "L'absurde est ton collègue. Les résultats suivent.", { perf: 3, prudent: 2 }),
    D("Écrire un mail de remerciements à ce fantôme", "💌", "Une réponse arrive à cinq heures, deux mots, « merci beaucoup ». Tu es ému{|e}.", { bonheur: 3, honnete: 1 }),
  ],
});

}

// ===== 102_noir_adulte2.js =====
{
// HUMOUR NOIR 3/4 — Argent, faillites, réseaux sociaux, célébrité, justice
const { ev, flash, O, C, D } = require("../kit");

// ============ ARGENT, DETTES, INVESTISSEMENTS, FAILLITES ============
ev("n_crypto_poulet", {
  title: "Le PouletCoin", ages: [20, 60], tags: ["argent"], ic: "🐔📈", rar: "peu", need: { money: [1500, null] },
  t: "Un cousin éloigné t'explique, avec des yeux brillants, que le PouletCoin va remplacer l'euro avant Noël. Le logo est un poulet en costume. Le site promet des rendements de 4000 pour cent et un autocollant offert.",
  c: [
    C("Tout miser, c'est l'occasion de ta vie", "🎰", [O(0.12, "Le poulet décolle. Tu revends au sommet et tu ne comprends toujours pas pourquoi.", { argent: 22000, bonheur: 8, flag: "riche_par_hasard", later: { id: "n_profiteurs", in: [1, 2], p: 0.7 } }), O(0.88, "Le cours s'effondre en six heures. Le cousin ne répond plus, son site affiche un simple poulet qui rit.", { argent: -1500, dette: 4000, bonheur: -6, flag: "dette_crypto", later: { id: "n_saisie_huissier", in: [1, 2], p: 0.75 } })], { risk: 3 }),
    D("Investir juste de quoi s'amuser", "🪙", "Quelques euros pour un poulet numérique. Il vaut dix centimes la semaine suivante, mais ton autocollant est très joli.", { argent: -150, bonheur: 1 }),
    D("Prévenir toute la famille du piège", "📣", "Tu passes pour un rabat-joie jusqu'à ce que le site s'effondre. Tu deviens un prophète dans ta propre famille.", { repute: 3, intel: 1, bonheur: 2 }),
  ],
});
ev("n_saisie_huissier", {
  chainOnly: true, title: "L'huissier sonne deux fois", tags: ["argent"], ic: "🔔📋", need: { debt: [1500, null] },
  t: "Un homme en costume gris sonne à ta porte avec une mallette et une expression de pure bonté administrative. Il t'explique qu'il va « procéder à un inventaire », ce qui signifie qu'il regarde ton canapé avec envie.",
  c: [
    D("Négocier un échéancier", "🤝", "Une longue discussion, un café tiède et un tableau Excel. Tu t'en sors avec un plan sur dix ans.", { honnete: 2, bonheur: -2, dette: -500 }),
    C("Cacher tes objets de valeur chez la voisine", "📦", [O(0.5, "L'huissier n'y voit que du feu. La voisine adore garder ta collection de vinyles.", { bonheur: 2, honnete: -2 }), O(0.5, "L'huissier est plus malin que prévu. La fraude te coûte une amende.", { honnete: -3, argent: -800, dette: 800, bonheur: -3, record: 1 })], { risk: 2 }),
    D("Laisser tout saisir et repartir de zéro", "🧹", "Il ne reste que des murs et un matelas. Un sentiment étrange de liberté s'installe.", { sell: "voiture", argent: -400, bonheur: -3, courage: 3, flag: "tout_perdu", later: { id: "n_faillite_perso", in: [1, 3], p: 0.5 } }),
  ],
});
ev("n_faillite_perso", {
  chainOnly: true, title: "Dossier de surendettement", tags: ["argent"], ic: "🗂️💸", need: { debt: [3000, null] },
  t: "Tu poses ton dossier de surendettement sur le comptoir. L'agent le feuillette avec un petit sourire poli, puis il te demande si tu as « une cagnotte secrète quelque part ». Tu réponds par un rire nerveux.",
  c: [
    D("Accepter la procédure", "📄", "On efface une partie de la dette. Tu sors allégé{|e}, mais fiché{|e} pour quelques années.", { dette: -9000, bonheur: 3, repute: -2, flag: "ancien_failli" }),
    C("Tenter de négocier encore plus", "🎲", [O(0.35, "Le conciliateur est de bonne humeur, une partie de la dette saute.", { dette: -14000, bonheur: 5 }), O(0.65, "Il referme le dossier et te demande de revenir quand tu auras plus de dignité.", { bonheur: -4, repute: -1 })], { risk: 1 }),
  ],
});
ev("n_profiteurs", {
  chainOnly: true, title: "Tous tes amis d'un coup", tags: ["argent", "social"], ic: "🦈🍾", need: { money: [3000, null] },
  t: "Depuis ton succès, ton téléphone ne désemplit plus. Des amis d'enfance que tu n'as pas vus depuis vingt ans, un oncle qui connaît un « super projet », une ex qui « pensait justement à toi », et un inconnu qui te demande de financer son album de flûte.",
  c: [
    C("Prêter à tout le monde", "🤲", [O(0.3, "Tu as le cœur grand, et deux ou trois personnes te remboursent même avec un petit cadeau.", { argent: -2500, bonte: 4, bonheur: 4, repute: 2 }), O(0.7, "Tu ne reverras jamais ton argent. Mais tu as fini à la une du journal de la flûte.", { argent: -9000, bonte: 2, bonheur: -3 })], { risk: 2 }),
    D("Filtrer les vrais proches", "🔍", "Tu fais le tri sans pitié. Il te reste quatre vrais amis et un chat.", { argent: -300, intel: 2, bonheur: 2, repute: -1 }),
    D("Disparaître quelques mois en voyage", "🏝️", "Tu reviens bronzé{|e}, ils ont tous trouvé quelqu'un d'autre à exploiter.", { argent: -2500, bonheur: 5 }),
  ],
});
ev("n_idee_stupide_millionnaire", {
  title: "L'idée du siècle", ages: [20, 55], tags: ["argent", "chance"], ic: "💡🤑", rar: "mythique",
  t: "Un soir de fête, tu lances une idée complètement stupide. Un ami la note sur une serviette. Un an plus tard, des chaussettes à poche pour téléphone se vendent partout dans le monde, et ton nom figure sur la serviette encadrée, dans le bureau de l'investisseur.",
  c: [
    D("Réclamer ta part", "🧾", "Un avocat, une négociation et un chèque à six chiffres.", { argent: 120000, bonheur: 8, ambition: 3, flag: "idee_millions", later: { id: "n_profiteurs", in: [1, 2], p: 0.8 } }),
    D("Laisser faire, par amitié", "🤍", "Ton ami t'offre un voyage et un dîner. La reconnaissance est belle, mais cher payée.", { argent: 3000, bonheur: 5, bonte: 3 }),
    C("Menacer d'un procès", "⚖️", [O(0.5, "Un arrangement discret te rapporte gros.", { argent: 60000, honnete: -2, bonheur: 5 }), O(0.5, "Pas de preuve, pas de serviette. La serviette a disparu dans une machine à laver.", { bonheur: -5, repute: -2 })], { risk: 2 }),
  ],
});
ev("n_chute_apres_succes", {
  chainOnly: true, title: "La chute du roi", tags: ["argent"], ic: "📉👑", need: { money: [50000, null] },
  t: "Tu as cru que cela durerait toujours. Un conseiller en gestion de patrimoine à lunettes rondes t'explique poliment que tu dépenses cinq fois plus que tu ne gagnes, et que le yacht n'était pas une obligation.",
  c: [
    D("Vendre le superflu en urgence", "🛥️", "Les jouets partent à bas prix. Il te reste un modeste confort et une grande leçon.", { argent: -6000, sell: "bijou", bonheur: -3, prudent: 4 }),
    C("Doubler la mise pour se refaire", "🎲", [O(0.25, "Miracle, tu te refais en trois semaines. Tu n'as rien compris, mais ça marche.", { argent: 40000, bonheur: 4, prudent: -2 }), O(0.75, "Tu perds plus encore. Le yacht part dans la semaine.", { argent: -45000, bonheur: -8, prudent: -2 })], { risk: 3 }),
    D("Tout avouer à ta famille", "🗣️", "La honte passe vite, le soutien reste. Ta famille te prête une chambre et du courage.", { bonheur: 2, honnete: 3, argent: -1000 }),
  ],
});
ev("n_loterie_imprevue", {
  title: "Le ticket oublié", ages: [20, 80], tags: ["argent", "chance"], ic: "🎟️🍀", rar: "rare",
  t: "En vidant une vieille veste, tu retrouves un ticket de loterie froissé. Tu le vérifies sur un site au hasard, par curiosité. Les chiffres correspondent. La date limite de réclamation est demain midi, et ton train a été annulé.",
  c: [
    C("Courir au guichet à pied", "🏃", [O(0.6, "Tu arrives à la minute près, hors d'haleine. Le gain est confirmé.", { argent: 35000, bonheur: 9, sport: 1, flag: "gagnant_loto" }), O(0.4, "Le guichet ferme devant ton nez. Tu restes à genoux sur le trottoir.", { bonheur: -8, courage: -1 })], { risk: 2 }),
    D("Appeler un ami pour qu'il t'emmène", "🚗", "Il arrive en retard, mais il arrive. Tu lui offres un cadeau énorme.", { argent: 33000, bonheur: 8, bonte: 3, flag: "gagnant_loto" }),
    D("Ne rien faire, c'est sûrement faux", "😴", "Il était vrai. Tu l'apprends trois semaines plus tard par un article.", { bonheur: -10, intel: -1 }),
  ],
});
ev("n_heritage_loufoque", {
  title: "Un legs improbable", ages: [25, 80], tags: ["argent", "famille", "loufoque"], ic: "📜🐊", rar: "rare",
  t: "Un notaire te convoque. Ta grande tante t'a légué sa collection de cinquante-deux perruques, un perroquet qui insulte le notaire, et un coffre-fort dont personne ne connaît le code.",
  c: [
    D("Accepter le legs et ouvrir le coffre", "🔐", "Après une semaine d'efforts, il s'ouvre. Il contient un peu d'argent, une lettre et une recette de gâteau.", { argent: 4000, bonheur: 5, item: "bijou", creatif: 2 }),
    D("Revendre les perruques", "💇", "Un collectionneur en offre un prix absurde. Tu es riche de façon incompréhensible.", { argent: 2500, bonheur: 3, honnete: 1 }),
    D("Adopter le perroquet seulement", "🦜", "Il t'insulte avec tendresse. Un compagnon pour la vie.", { bonheur: 5, sociable: 1, item: "velo" }),
  ],
});
ev("n_assurance_fraude", {
  title: "Le sinistre créatif", ages: [25, 70], tags: ["argent"], ic: "📑🔥", rar: "peu", need: { money: [500, null] },
  t: "Ton canapé est tâché, ton frigo est vieux et ton assurance est généreuse. Un voisin glisse, l'air de rien, qu'un petit « incident domestique » pourrait régler tous tes problèmes de décoration.",
  c: [
    C("Déclarer un sinistre inventé", "🔥", [O(0.6, "L'assureur ne vérifie rien. Tu refais ton salon à neuf avec un sourire de mauvais joueur.", { argent: 3000, honnete: -4, bonheur: 3 }), O(0.4, "L'expert te regarde pendant dix minutes. La fraude est découverte, l'amende tombe.", { argent: -2500, honnete: -4, record: 1, repute: -3 })], { risk: 3 }),
    D("Réparer toi-même, à l'ancienne", "🔧", "Un week-end avec un tournevis et un tutoriel. Le canapé tient presque.", { sport: 1, bonheur: 1, prudent: 1 }),
    D("Refuser et dénoncer le voisin", "👮", "Le voisin ne te salue plus. L'immeuble non plus.", { honnete: 3, repute: -2, bonheur: -2 }),
  ],
});
ev("n_arnaque_amoureuse", {
  title: "Le prince du messenger", ages: [22, 75], tags: ["argent", "amour"], ic: "📱🤴", rar: "peu", need: { single: true },
  t: "Un compte magnifique te contacte. Photos de voyage, citations de poètes, et une vie tragique. Après trois semaines de messages tendres, il ou elle a besoin « d'un petit service de 800 euros » pour une urgence médicale.",
  c: [
    C("Envoyer l'argent par amour", "💌", [O(0.15, "Le compte était réel. L'histoire est belle et se termine par un mariage inattendu.", { argent: -800, bonheur: 10, flag: "amour_internet" }), O(0.85, "Le compte disparaît dans l'heure. Les photos venaient d'une banque d'images.", { argent: -800, bonheur: -7, intel: -1, repute: -1 })], { risk: 3 }),
    D("Demander un appel vidéo", "🎥", "Le prince n'a plus de batterie ni d'excuses. La fraude se dévoile avec grâce.", { intel: 2, bonheur: 2, prudent: 3 }),
    D("Le piéger pour s'amuser", "🪤", "Tu passes dix jours à faire perdre son temps à un escroc. Tu en tires un récit hilarant.", { bonheur: 5, creatif: 2, repute: 2 }),
  ],
});
ev("n_entreprise_famille", {
  title: "La boutique de famille", ages: [28, 65], tags: ["argent", "famille"], ic: "🏪👨‍👩‍👧", rar: "peu", need: { money: [3000, null], job: true },
  t: "Ton oncle te propose de reprendre sa boutique de souvenirs, installée dans une ville sans touristes. Le stock se compose de mille magnets de la tour Eiffel et de trois pulls en laine de lama.",
  c: [
    C("Reprendre la boutique", "🏪", [O(0.35, "Un influenceur filme tes magnets par ironie. La boutique devient un lieu culte.", { argent: 12000, bonheur: 6, repute: 3, creatif: 2 }), O(0.65, "Les ventes sont nulles. Ton oncle se plaint de toi à chaque Noël.", { argent: -3000, bonheur: -4 })], { risk: 2 }),
    D("Refuser avec diplomatie", "🙏", "Ton oncle boude un an, puis offre la boutique à un chien.", { bonheur: 1, honnete: 1 }),
    D("Proposer de liquider le stock en ligne", "💻", "Les magnets partent en trois semaines. L'oncle pleure de joie, le chien aussi.", { argent: 1800, intel: 2, bonheur: 3 }),
  ],
});
ev("n_fisc_controle", {
  title: "Le contrôle fiscal", ages: [25, 75], tags: ["argent"], ic: "🧮😨", rar: "peu", need: { money: [4000, null] },
  t: "Un courrier à l'en-tête sévère t'invite à justifier trois années de comptes. Une facture de 12 euros pour « matériel de bien-être » attire l'attention, car tu n'as jamais pu expliquer ce que c'était.",
  c: [
    D("Tout expliquer avec franchise", "📚", "L'inspecteur sourit. Tout est en ordre, sauf la facture mystère.", { honnete: 3, argent: -300, bonheur: 1 }),
    C("Bluffer avec aplomb", "🃏", [O(0.4, "Ton aplomb déroute l'inspecteur. Il classe l'affaire en soupirant.", { honnete: -2, bonheur: 4 }), O(0.6, "Il vérifie. Il vérifie tout. L'amende est salée.", { argent: -3500, honnete: -2, bonheur: -4 })], { risk: 2 }),
    D("Embaucher un comptable très cher", "👔", "Il sauve ton dossier et mange ton dernier chèque.", { argent: -1200, prudent: 2, bonheur: 1 }),
  ],
});
ev("n_pari_sportif", {
  title: "Le pari de trop", ages: [20, 65], tags: ["argent"], ic: "⚽💸", rar: "peu", need: { money: [800, null], noflag: "sobre_jeu" },
  t: "Un ami jure avoir un tuyau en or sur le match de ce soir. Une équipe de troisième division doit battre le champion, parce que le gardien « a mal dormi ». La cote est de 40 contre 1.",
  c: [
    C("Parier le loyer", "🏠", [O(0.1, "Le gardien a vraiment mal dormi. Tu gagnes une somme folle.", { argent: 16000, bonheur: 9, flag: "pari_gagne" }), O(0.9, "Le gardien est impérial. Tu perds tout, y compris un peu de dignité.", { argent: -1000, dette: 600, bonheur: -7 })], { risk: 3 }),
    D("Parier une petite somme", "🪙", "Cinq euros pour un souvenir. Tu perds, mais le match était beau.", { argent: -5, bonheur: 1 }),
    D("Refuser et regarder le match", "📺", "Le gardien a bien mal dormi. Tu apprends que ton ami a gagné trois mille euros. Aïe.", { bonheur: -3, prudent: 1 }),
  ],
});
ev("n_colocation_dette", {
  title: "Le colocataire fantôme", ages: [20, 45], tags: ["argent", "social"], ic: "🏠👻", rar: "peu", need: { home: "coloc" },
  t: "Ton colocataire a disparu en laissant trois mois de loyer impayés, une plante carnivore et un mot qui dit « je reviens dans une minute ». Cela fait vingt-trois jours. La plante grandit.",
  c: [
    D("Payer sa part pour garder l'appartement", "💶", "Tu tiens le coup, la plante aussi. Elle devient ton meilleur colocataire.", { argent: -1100, bonheur: -1, bonte: 2 }),
    C("Mettre ses affaires à la rue", "📦", [O(0.5, "Il réapparaît à temps, vexé, mais rembourse tout.", { argent: 1100, bonheur: 2 }), O(0.5, "Il revient avec sa mère, qui te fait la leçon pendant deux heures.", { bonheur: -5, repute: -2 })], { risk: 1 }),
    D("Mener l'enquête sur sa disparition", "🔦", "Tu le retrouves dans un festival, en train de jouer du didgeridoo. Il rembourse en cinq ans.", { creatif: 1, bonheur: 3 }),
  ],
});
ev("n_pret_ami", {
  title: "Le prêt entre amis", ages: [20, 70], tags: ["argent", "social"], ic: "🤝💶", rar: "commun", need: { money: [800, null] }, who: { ami: "friend" },
  t: "$ami te demande 1500 euros pour « un truc incroyable qui va tout changer ». Il refuse de dire de quoi il s'agit et jure avoir tout prévu. Il t'a déjà emprunté un chargeur en 2019.",
  c: [
    C("Lui prêter l'argent", "🤲", [O(0.4, "Il te rembourse avec des intérêts et un énorme sourire.", { argent: 300, bonheur: 4, rel: { ami: 12 } }), O(0.6, "Il disparaît avec ton argent. La rancune te colle à la peau.", { argent: -1500, bonheur: -4, rel: { ami: -25 } })], { risk: 2 }),
    D("Refuser poliment", "🙅", "Il boude, puis oublie.", { rel: { ami: -5 }, prudent: 1 }),
    D("Proposer de lui donner 100 euros, sans retour", "🎁", "Un petit cadeau pour ne pas gâcher l'amitié.", { argent: -100, bonte: 2, rel: { ami: 4 } }),
  ],
});

// ============ RÉSEAUX SOCIAUX, RÉPUTATION, CÉLÉBRITÉ ============
ev("n_video_virale", {
  title: "Quarante millions de vues", ages: [15, 60], tags: ["social", "celebrite"], ic: "📹🔥", rar: "peu",
  t: "Un inconnu t'a filmé{|e} en train de glisser sur une peau de banane, de te rattraper sur un cygne en plastique et de finir dans une fontaine. La vidéo a quarante millions de vues. Elle s'appelle « Le grand plongeon ».",
  c: [
    D("Assumer et surfer sur la vague", "🏄", "Tu apparais dans trois émissions et ton nom devient un mème. Les sponsors font la queue.", { repute: 6, argent: 2500, bonheur: 5, flag: "celebre_ridicule", later: { id: "n_celebrite_ridicule", in: [1, 3], p: 0.7 } }),
    D("Demander la suppression de la vidéo", "🗑️", "La plateforme répond en dix mois. La vidéo a depuis été copiée mille fois.", { bonheur: -3, repute: 1, prudent: 1 }),
    C("Tourner une suite", "🎬", [O(0.35, "La suite est plus drôle que l'originale. Tu gagnes un public.", { argent: 6000, repute: 8, bonheur: 6, flag: "celebre_ridicule" }), O(0.65, "La suite est ratée. Tu es « le gars du cygne qui s'accroche ».", { repute: -4, bonheur: -3 })], { risk: 2 }),
  ],
});
ev("n_celebrite_ridicule", {
  chainOnly: true, title: "Le gars du cygne", tags: ["celebrite"], ic: "🦢⭐", need: { flag: "celebre_ridicule" },
  t: "On te reconnaît partout, au supermarché, aux toilettes, au cimetière. Des enfants te demandent de refaire « le plongeon ». Une marque de maillots de bain propose un contrat, et une chaîne de télévision te veut dans une émission de téléréalité.",
  c: [
    D("Signer pour la marque de maillots", "🩱", "Tu deviens l'égérie d'une marque improbable. Les affiches te suivent dans toute la ville.", { argent: 8000, repute: 4, bonheur: 3 }),
    C("Participer à la téléréalité", "📺", [O(0.45, "Tu fais un excellent candidat. Tu repars avec un public et une réputation.", { argent: 12000, repute: 10, bonheur: 6 }), O(0.55, "Tu es éliminé{|e} en premier, à cause d'un malentendu avec un canapé.", { repute: -4, bonheur: -4 })], { risk: 2 }),
    D("Disparaître et mener une vie discrète", "🕵️", "L'oubli arrive, doucement. Quelques années plus tard, personne ne te reconnaît.", { bonheur: 3, repute: -2, unflag: "celebre_ridicule" }),
  ],
});
ev("n_vieux_tweet", {
  title: "Le retour du vieux message", ages: [22, 60], tags: ["social"], ic: "🐦🕰️", rar: "peu", need: { job: true },
  t: "Un journaliste a déterré un message que tu avais publié à 17 ans. Il est maladroit, grossier et franchement idiot. Il passe en boucle sous le titre « Notre nouveau responsable pensait ça en 2012 ».",
  c: [
    D("Présenter des excuses publiques", "🙏", "Tu t'excuses sobrement. L'orage passe, il te reste quelques tâches de honte.", { honnete: 3, repute: -2, bonheur: -2 }),
    C("Contre-attaquer avec humour", "😏", [O(0.45, "L'humour désarme tout le monde. Le message devient un souvenir sympathique.", { repute: 4, charme: 2, bonheur: 4 }), O(0.55, "L'humour est mal reçu. Tu es suspendu{|e} par ton employeur.", { repute: -6, bonheur: -5, fire: true })], { risk: 2 }),
    D("Supprimer ton compte et te taire", "🫥", "Silence radio. Les gens finissent par oublier, ou presque.", { repute: -1, bonheur: -1 }),
  ],
});
ev("n_scandale_photo", {
  title: "La photo qui fuit", ages: [18, 60], tags: ["social", "mature"], ic: "📸😳", rar: "rare",
  t: "Une photo gênante de toi, prise un soir de fête, circule dans un groupe de messagerie qui compte déjà trois mille membres. On te voit en pyjama de licorne, un verre à chaque main et une couronne de pizza sur la tête.",
  c: [
    D("Assumer et la republier toi-même", "🦄", "Tu reprends le contrôle du récit. La photo devient un symbole de joie de vivre.", { repute: 2, bonheur: 4, courage: 3 }),
    D("Menacer de poursuites", "⚖️", "Les groupes la suppriment. Mais elle reste dans quelques mémoires.", { argent: -300, bonheur: -1 }),
    C("Payer pour étouffer l'affaire", "💰", [O(0.5, "Le fuyard disparaît avec l'argent et la photo reste cachée.", { argent: -1500, bonheur: 1 }), O(0.5, "Il garde l'argent et republie la photo avec fierté.", { argent: -1500, repute: -4, bonheur: -5 })], { risk: 2 }),
  ],
});
ev("n_influenceur", {
  title: "Devenir influenceur sans le vouloir", ages: [16, 55], tags: ["social", "celebrite"], ic: "🤳💄", rar: "peu",
  t: "Tu as posté, par ennui, une vidéo où tu goûtes des yaourts périmés avec un air solennel. Cent mille abonnés plus tard, ils te demandent des « avis de gastronomie négative ».",
  c: [
    D("Monétiser la chaîne", "💶", "Des marques de yaourts te sponsorisent. Le goût du périmé est devenu un art.", { argent: 5000, repute: 4, bonheur: 4, creatif: 3 }),
    C("Tenter un produit dérivé", "📦", [O(0.4, "Ton calendrier « mois du périmé » se vend comme des petits pains.", { argent: 9000, repute: 3, bonheur: 5 }), O(0.6, "Le stock reste dans ton salon. Ton chat s'en sert comme pyramide.", { argent: -2500, bonheur: -3 })], { risk: 2 }),
    D("Tout arrêter pour garder ta tranquillité", "🛑", "Tu retrouves ta vie. Tes abonnés pleurent dans les commentaires.", { bonheur: 2, repute: -1 }),
  ],
});
ev("n_polemique_gratuite", {
  title: "La polémique du siècle", ages: [18, 65], tags: ["social"], ic: "🔥🗣️", rar: "peu",
  t: "Tu as exprimé une opinion sans importance sur la façon de tartiner le beurre. Quarante-huit heures plus tard, des experts s'insultent sur un plateau télévisé, des politiques prennent position, et un parti vient de se fonder sur ton post.",
  c: [
    D("Se taire et regarder brûler", "🍿", "Tu savoures le désastre depuis ton canapé. L'affaire s'éteint toute seule.", { bonheur: 3, repute: -1 }),
    C("Participer au débat télévisé", "🎙️", [O(0.4, "Tu brilles par ton absurdité tranquille. L'émission te réinvite chaque mois.", { repute: 6, argent: 2000, bonheur: 5 }), O(0.6, "Tu t'effondres en direct, d'un rire nerveux qui devient mythique.", { repute: -3, bonheur: -3, flag: "rire_nerveux" })], { risk: 2 }),
    D("Présenter des excuses solennelles pour le beurre", "🧈", "On t'applaudit pour ta dignité. Le beurre, lui, ne s'est jamais remis.", { repute: 2, bonheur: 1, honnete: 1 }),
  ],
});
ev("n_faux_compte", {
  title: "Le faux compte", ages: [16, 50], tags: ["social"], who: { fam: "sibling" }, ic: "🎭📱", rar: "peu",
  t: "Quelqu'un a créé un faux compte à ton nom. Il y publie des citations de philosophes accompagnées de photos de ton visage retouchées. Le compte compte déjà plus d'abonnés que le tien.",
  c: [
    D("Signaler et attendre", "🚨", "La plateforme répond poliment qu'il s'agit d'un « hommage ». Tu soupires.", { bonheur: -1, prudent: 1 }),
    C("Contacter le faussaire", "💬", [O(0.5, "C'est ton neveu. Vous éclatez de rire et il arrête.", { bonheur: 3, rel: { fam: 5 } }), O(0.5, "C'est un inconnu qui te remercie de ton talent. Il refuse de supprimer.", { bonheur: -2, repute: -1 })], { risk: 1 }),
    D("Reprendre la main et l'utiliser toi-même", "😎", "Tu deviens l'imposteur de toi-même. Les abonnés n'y voient que du feu.", { creatif: 2, repute: 3, honnete: -1, bonheur: 2 }),
  ],
});
ev("n_star_rencontre_ridicule", {
  title: "Une star dans l'ascenseur", ages: [18, 80], tags: ["celebrite"], ic: "🛗🌟", rar: "rare", who: { vedette: "star" },
  t: "Tu te retrouves coincé{|e} dans un ascenseur avec $vedette. Il ne reste que vous deux, un ventilateur qui fait un bruit inquiétant et la vague impression d'être dans un film. Vous avez quarante minutes.",
  c: [
    D("Lui avouer ton admiration sans retenue", "😍", "Elle ou il rit, vous partagez un biscuit. Un souvenir qui te rendra heureux{|e} pour toujours.", { bonheur: 7, charme: 1, repute: 2 }),
    C("Lui proposer un duo improvisé", "🎤", [O(0.3, "Le duo est un triomphe. Il est repris dans une émission.", { repute: 7, bonheur: 8, creatif: 3 }), O(0.7, "Le duo est une catastrophe. Elle ou il se bouche les oreilles.", { repute: -1, bonheur: -3, courage: 2 })], { risk: 2 }),
    D("Faire semblant de ne pas la ou le reconnaître", "🥸", "Ton air indifférent la ou le vexe et la ou le séduit en même temps. Une histoire hilarante.", { charme: 2, bonheur: 3, honnete: -1 }),
  ],
});
ev("n_reseau_amoureux", {
  title: "Le profil trop beau", ages: [18, 60], tags: ["amour", "social"], ic: "💘📲", rar: "commun", need: { single: true },
  t: "Tu as passé trois heures à choisir ta photo de profil. Elle montre un lac, un chien emprunté et un livre de philosophie que tu n'as jamais ouvert. Une première touche apparaît, très enthousiaste, accompagnée de six points d'exclamation.",
  c: [
    C("Accepter le rendez-vous", "☕", [O(0.4, "Une vraie rencontre, des fous rires, un chien qui vous adopte.", { bonheur: 6, charme: 1, rel: { crush: 15 } }), O(0.35, "La personne n'a rien à voir avec la photo. Vous restez pour le gâteau.", { bonheur: 0 }), O(0.25, "Elle ou il apporte un ami « pour être en sécurité ». La soirée devient surréaliste.", { bonheur: 2, creatif: 1 })], { risk: 1 }),
    D("Avouer que le livre n'est pas à toi", "📖", "L'honnêteté a un certain succès, la personne rit beaucoup.", { honnete: 3, bonheur: 3, charme: 1 }),
    D("Supprimer l'application pour la dixième fois", "📵", "Tu reviens dans trois jours, comme toujours.", { bonheur: 1 }),
  ],
});
ev("n_avis_en_ligne", {
  title: "La vengeance en cinq étoiles", ages: [18, 70], tags: ["social", "travail"], ic: "⭐😤", rar: "commun",
  t: "Le restaurateur t'a servi un plat froid et une addition chaude. Tu rédiges un avis d'une cruauté lyrique, sur trois paragraphes, avec une métaphore sur le sel. Il devient l'avis le plus lu de la ville.",
  c: [
    D("Laisser l'avis en ligne", "🖋️", "Tu reçois des likes et un message du restaurateur en majuscules.", { repute: 2, bonheur: 3, bonte: -2 }),
    C("Supprimer l'avis par charité", "🕊️", [O(0.5, "Le restaurateur t'offre un dîner en remerciement, un vrai.", { bonheur: 4, bonte: 3, argent: 60 }), O(0.5, "Il l'ignore, il avait déjà fermé.", { bonheur: 1 })], { risk: 1 }),
    D("Y retourner pour un dîner de réconciliation", "🍽️", "Vous parlez de sel pendant quarante minutes. Une amitié étrange est née.", { sociable: 2, bonheur: 3 }),
  ],
});

// ============ JUSTICE, ARRESTATIONS, PROCÈS ============
ev("n_arrestation_absurde", {
  title: "Arrêté{|e} pour une raison idiote", ages: [18, 70], tags: ["justice"], ic: "🚔🤡", rar: "peu",
  t: "Trois policiers te placent poliment les menottes. Tu es soupçonné{|e} d'avoir volé une statue de nain de jardin dans un lotissement, parce qu'une caméra de surveillance t'a filmé{|e} en train de déposer ton propre nain de jardin un peu plus loin.",
  c: [
    D("Coopérer et expliquer", "🗣️", "Tu passes six heures au commissariat à écrire ton innocence. Le nain est retrouvé chez un collectionneur.", { honnete: 2, bonheur: -2, repute: -1 }),
    C("Exiger un avocat tout de suite", "👔", [O(0.6, "L'avocat sort une preuve de génie. Tu es relâché{|e} avec les excuses de la police.", { argent: -500, repute: 1, bonheur: 2 }), O(0.4, "L'avocat arrive en retard et en pantoufles. Tu restes en garde à vue toute la nuit.", { argent: -500, bonheur: -4 })], { risk: 1 }),
    D("Transformer l'affaire en histoire drôle", "😆", "Les agents te prennent en photo avec le nain. L'anecdote devient légendaire.", { bonheur: 3, repute: 3, charme: 1, later: { id: "n_proces_celebre", in: [1, 3], p: 0.25 } }),
  ],
});
ev("n_proces_celebre", {
  chainOnly: true, title: "L'affaire du nain de jardin", tags: ["justice", "celebrite"], ic: "⚖️🧙", need: { noprison: true },
  t: "Une association de défense des nains de jardin porte plainte pour « atteinte à l'image du nain ». Le procès attire les caméras, les chroniqueurs et un avocat en cape. Chacun veut sa photo avec toi.",
  c: [
    D("Plaider avec émotion", "🎭", "Ton discours émeut la salle. Tu es acquitté{|e} sous les applaudissements.", { repute: 7, bonheur: 5, charme: 2 }),
    C("Négocier un arrangement", "🤝", [O(0.55, "Tu paies une petite somme et on t'oublie.", { argent: -900, bonheur: 1 }), O(0.45, "Le procureur refuse. L'affaire devient un feuilleton.", { argent: -2500, repute: 3, bonheur: -3 })], { risk: 1 }),
    D("Écrire un livre sur l'affaire", "📚", "« Le Nain et moi » se vend étonnamment bien.", { argent: 4000, creatif: 3, repute: 5, bonheur: 4 }),
  ],
});
ev("n_prison_absurde", {
  title: "Cellule 12, vue sur l'ennui", ages: [20, 65], tags: ["justice", "mature"], ic: "🔒🙃", rar: "rare", need: { record: [1, null], noprison: true },
  t: "Tu es condamné{|e} à quelques mois pour une série de bêtises qui se sont accumulées comme des assiettes sales. Ton codétenu est un ancien chef pâtissier qui juge ta cuisine « décevante » avant même de l'avoir goûtée.",
  c: [
    D("Suivre une formation en prison", "🎓", "Tu en sors avec un diplôme et un goût prononcé pour les religieuses au chocolat.", { prison: 1, intel: 3, bonheur: -2, flag: "formation_prison" }),
    C("Organiser un tournoi de cartes", "🃏", [O(0.6, "Le tournoi remporte un énorme succès. Tu es le roi des cartes.", { prison: 1, repute: 2, bonheur: 2, sociable: 3 }), O(0.4, "Le tournoi tourne mal. Un gardien confisque tout.", { prison: 1, bonheur: -4, sante: -2 })], { risk: 2 }),
    D("Écrire des lettres à toute ta famille", "✉️", "Tu redécouvres le plaisir de la correspondance. La peine paraît plus courte.", { prison: 1, bonheur: 1, bonte: 2 }),
  ],
});
ev("n_temoin_scene", {
  title: "Témoin malgré toi", ages: [20, 80], tags: ["justice"], ic: "👀🚨", rar: "peu",
  t: "Tu as vu, depuis ton balcon, un homme en costume de canard voler un vélo. Deux jours plus tard, la police sonne à ta porte. Elle te demande de décrire le canard « avec précision ».",
  c: [
    D("Faire un portrait-robot détaillé", "✏️", "Ton dessin est étrangement fidèle. Le canard est arrêté dans la semaine.", { honnete: 3, intel: 1, repute: 2, bonheur: 2 }),
    C("Mentir par peur des représailles", "🤐", [O(0.5, "Personne ne remarque rien. Le canard court toujours.", { honnete: -3, bonheur: -1 }), O(0.5, "Le canard était le fils du maire. Tu es cité{|e} à comparaître.", { honnete: -3, bonheur: -4, repute: -2 })], { risk: 2 }),
    D("Proposer ton aide comme détective amateur", "🕵️", "Tu passes deux semaines à suivre des canards. Une passion naît.", { creatif: 2, bonheur: 4 }),
  ],
});
ev("n_amende_delirante", {
  title: "La contravention de la honte", ages: [18, 80], tags: ["justice"], ic: "🧾🚫", rar: "commun", need: { asset: "voiture" },
  t: "Une contravention de 135 euros t'attend sur ton pare-brise pour avoir stationné « en situation de défi à l'ordre public ». L'agent a écrit, en commentaire, « c'est la troisième fois, monsieur, madame, vous l'avez fait exprès ».",
  c: [
    D("Payer sans rien dire", "💶", "Cher, mais net. Tu gardes ta dignité.", { argent: -135, bonheur: -1 }),
    C("Contester avec une lettre de trois pages", "✍️", [O(0.35, "Le juge, ému par ton style, annule l'amende.", { honnete: 1, intel: 2, bonheur: 3 }), O(0.65, "Le juge ajoute des frais de dossier à ton insolence.", { argent: -220, bonheur: -2 })], { risk: 1 }),
    D("Déplacer ta voiture en pleine nuit, discrètement", "🌙", "Un chat te regarde faire. Le voisin aussi.", { honnete: -1, bonheur: 1 }),
  ],
});
ev("n_proces_famille", {
  title: "Le procès du dimanche", ages: [30, 80], tags: ["justice", "famille"], who: { fam: "sibling" }, ic: "⚖️🍗", rar: "rare", need: { money: [2000, null] },
  t: "Ton frère te traîne en justice à propos d'une casserole. Une casserole en fonte, héritée de grand-mère, qu'il juge « lui revenir de droit moral ». Les avocats facturent plus cher que la casserole ne vaut.",
  c: [
    D("Donner la casserole pour avoir la paix", "🍳", "Il la prend, ému. La famille respire.", { bonheur: 2, bonte: 3, rel: { fam: 8 } }),
    C("Se battre jusqu'au bout", "⚔️", [O(0.4, "Tu gagnes. La casserole trône sur ton étagère comme un trophée.", { argent: -2500, honnete: 1, bonheur: 2, rel: { fam: -15 } }), O(0.6, "Tu perds la casserole et ton argent.", { argent: -4000, bonheur: -5, rel: { fam: -15 } })], { risk: 2 }),
    D("Proposer de la partager, une semaine sur deux", "🔁", "Un arrangement ridicule mais fonctionnel. La casserole voyage dans un sac isotherme.", { bonheur: 3, creatif: 2 }),
  ],
});
ev("n_cambriolage", {
  title: "Le cambrioleur poli", ages: [22, 80], tags: ["justice"], ic: "🥷📦", rar: "peu", need: { money: [800, null] },
  t: "Tu rentres chez toi. La porte est ouverte, le salon est rangé avec soin et un mot est posé sur la table. « Désolé pour le dérangement. Votre télévision était trop belle. J'ai nourri votre chat. »",
  c: [
    D("Prévenir la police", "👮", "Tu déposes plainte. L'assurance rembourse en six mois.", { argent: -600, honnete: 2, bonheur: -2 }),
    D("Poser une pancarte pour le prochain visiteur", "🪧", "« Prière d'essuyer vos pieds. » Le cambrioleur ne revient pas.", { creatif: 2, bonheur: 2 }),
    C("Mener ta propre enquête", "🔎", [O(0.3, "Tu retrouves le cambrioleur, qui s'excuse et rend la télévision.", { bonheur: 5, intel: 2 }), O(0.7, "Tu t'enfonces dans des pistes absurdes. Ton chat est le seul suspect de ton propre salon.", { bonheur: -2, intel: 1 })], { risk: 1 }),
  ],
});
ev("n_condamnation_celebrite", {
  title: "Du banc des accusés aux plateaux télé", ages: [20, 60], tags: ["justice", "celebrite"], ic: "🎥⛓️", rar: "mythique", need: { record: [1, null] },
  t: "Ton passé judiciaire intrigue une production de documentaires. Ils veulent raconter ta vie, avec une musique dramatique et un titre en trois mots. Le premier titre proposé est « Le Malentendu ».",
  c: [
    D("Accepter le documentaire", "🎬", "La série cartonne. Tu deviens une célébrité de bar et de salon.", { argent: 15000, repute: 8, bonheur: 5, flag: "star_du_documentaire" }),
    C("Exiger un droit de regard", "📝", [O(0.5, "Ils acceptent. Le résultat est flatteur, presque trop.", { argent: 8000, repute: 5, bonheur: 4 }), O(0.5, "Ils refusent et sortent le film sans toi.", { repute: -3, bonheur: -3 })], { risk: 1 }),
    D("Refuser et garder ton passé secret", "🤫", "Tu restes dans l'ombre, tranquille et ordinaire.", { bonheur: 2, prudent: 2 }),
  ],
});

}

// ===== 103_noir_adulte3.js =====
{
// HUMOUR NOIR 4/4 — Santé, voyages, chance, catastrophes rares, vieillesse
const { ev, flash, O, C, D } = require("../kit");

// ============ SANTÉ, ACCIDENTS ET MALCHANCE ============
ev("n_trottinette", {
  title: "Le radar de la trottinette", ages: [14, 55], tags: ["sante"], ic: "🛴💥", rar: "commun",
  t: "Tu loues une trottinette électrique pour aller « juste au coin de la rue ». À trois kilomètres, tu découvres que les freins sont décoratifs. Un panneau « cédez le passage » se rapproche avec une détermination inquiétante.",
  c: [
    D("Te jeter dans la haie", "🌿", "Les buissons amortissent. Tu en sors couvert{|e} de feuilles et de dignité réduite.", { sante: -3, courage: 1, bonheur: -1 }),
    C("Tenter de freiner avec le pied", "🦶", [O(0.6, "Tu t'arrêtes dans une gerbe d'étincelles. Une grande première.", { sport: 1, bonheur: 2 }), O(0.4, "Le pied cède. Direction urgences, avec un plâtre qui sera signé par tout le monde.", { sante: -9, argent: -200, bonheur: -2 })], { risk: 2 }),
    D("Continuer en criant de joie", "🎢", "Tu atterris dans un bac à sable. Les enfants applaudissent.", { sante: -2, bonheur: 4, courage: 2 }),
  ],
});
ev("n_sushi_catastrophe", {
  title: "Le buffet à volonté", ages: [16, 75], tags: ["sante", "loufoque"], ic: "🍣🤢", rar: "commun",
  t: "Un restaurant à volonté propose du sushi à neuf euros quatre-vingt-dix. Tu manges de tout, y compris un plat dont personne ne connaît la nature. Vers minuit, ton corps te présente sa démission.",
  c: [
    D("Appeler les urgences", "📞", "Une nuit d'hôpital, une perfusion et une infirmière pleine d'humour.", { sante: -4, argent: -150, prudent: 2 }),
    C("Tenir bon avec du thé", "🍵", [O(0.8, "Le thé triomphe. Tu es épuisé{|e} mais vivant{|e}.", { sante: -3, courage: 1 }), O(0.2, "Le lendemain, les urgences te regardent avec une patience professionnelle.", { sante: -7, argent: -150, bonheur: -2 })], { risk: 1 }),
    D("Poster un avis en deux phrases", "✍️", "« Plus jamais. Sauf le dessert. » Le restaurant te répond par une réduction.", { repute: 1, bonheur: 1, creatif: 1 }),
  ],
});
ev("n_dentiste", {
  title: "Chez le dentiste de l'horreur", ages: [10, 80], tags: ["sante"], ic: "🦷😱", rar: "commun",
  t: "Le dentiste sourit trop. Sur le plafond, un poster de chaton te regarde avec compassion. Il murmure « ça ne fera pas mal » juste avant que la pince n'attrape ton âme.",
  c: [
    D("Serrer les dents, au sens figuré", "😬", "Un quart d'heure d'angoisse. Tu sors avec une dent en moins et un bonbon offert.", { sante: -2, courage: 2, argent: -90 }),
    C("Demander une anesthésie totale", "💉", [O(0.8, "Tu dors, tu rêves de plage et tu te réveilles content{|e}.", { argent: -300, bonheur: 2 }), O(0.2, "Tu te réveilles en disant des secrets à voix haute dans la salle d'attente.", { argent: -300, repute: -2, bonheur: -1 })], { risk: 1 }),
    D("Fuir en courant, le bavoir encore au cou", "🏃", "Tu as bonne mine dans la rue. La douleur, elle, est restée.", { sante: -4, honnete: -1, bonheur: -2 }),
  ],
});
ev("n_regime_miracle", {
  title: "Le régime miracle", ages: [18, 65], tags: ["sante"], ic: "🥬📉", rar: "commun",
  t: "Un influenceur t'a convaincu{|e} qu'il suffit de ne manger que des concombres pour trouver la paix intérieure. Tu es à trois jours de régime et tu parles aux légumes.",
  c: [
    D("Abandonner et commander une pizza", "🍕", "Un moment de pure joie. Tu aimes encore la vie.", { bonheur: 4, sante: 1 }),
    C("Tenir une semaine entière", "🥒", [O(0.4, "Tu perds du poids et gagnes une aura étrange.", { sante: 2, bonheur: 1, courage: 2 }), O(0.6, "Tu t'effondres au supermarché, entouré{|e} de poireaux inquiets.", { sante: -5, bonheur: -3 })], { risk: 2 }),
    D("Te lancer dans l'élevage de concombres", "🌱", "Une passion démarre. Tu offres des concombres à tout l'immeuble.", { creatif: 2, bonheur: 3, bonte: 1 }),
  ],
});
ev("n_hypocondrie", {
  title: "Le grand diagnostic en ligne", ages: [20, 80], tags: ["sante"], ic: "🩺💻", rar: "commun",
  t: "Un petit bouton sur le bras. Tu as tapé « bouton bras » sur internet. Selon le site, tu as une dizaine de maladies rares, dont l'une n'existe que dans une île du Pacifique. Tu te mets à écrire ton testament.",
  c: [
    D("Consulter un vrai médecin", "👩‍⚕️", "Le médecin éclate de rire. C'est un bouton, un vrai.", { honnete: 1, bonheur: 3, argent: -30 }),
    C("Te soigner tout seul avec des tisanes", "🍵", [O(0.7, "Le bouton disparaît. Le miracle est attribué au thym.", { bonheur: 2 }), O(0.3, "Le bouton grossit. Le thym n'y est pour rien.", { sante: -4, argent: -80 })], { risk: 1 }),
    D("Écrire un blog sur ta maladie imaginaire", "📝", "Tu as cent lecteurs, tous dans le même cas.", { creatif: 2, repute: 1, bonheur: 2 }),
  ],
});
ev("n_accident_cuisine", {
  title: "Le soufflé du désastre", ages: [14, 80], tags: ["sante", "loufoque"], ic: "👩‍🍳🔥", rar: "commun",
  t: "Tu as voulu impressionner tout le monde avec un soufflé flambé. Le soufflé s'est enflammé, le torchon aussi, et le détecteur de fumée chante comme un opéra. Le chat t'observe depuis le frigo.",
  c: [
    D("Étouffer les flammes avec un couvercle", "🧯", "Un geste calme, héroïque. Ton sang-froid est salué par le voisinage.", { courage: 3, sante: -1, prudent: 2 }),
    C("Jeter un seau d'eau sur la poêle", "💦", [O(0.5, "Le feu s'éteint dans une gerbe de vapeur. Tu es trempé{|e} mais heureux{|se}.", { bonheur: 1, courage: 1 }), O(0.5, "Le feu s'élargit. Les pompiers sont au courant.", { sante: -6, argent: -1200, bonheur: -4 })], { risk: 3 }),
    D("Sortir en hurlant sans rien éteindre", "🏃", "Les pompiers arrivent. Ils sont charmants, et un peu sarcastiques.", { argent: -300, bonheur: -2, courage: -1 }),
  ],
});
ev("n_chirurgie_ratee", {
  title: "Un petit coup de pouce esthétique", ages: [22, 70], tags: ["sante", "mature"], ic: "💉🎭", rar: "peu", need: { money: [3000, null] },
  t: "Un chirurgien esthétique à la Porsche te promet un « léger rafraîchissement ». Tu ressors du bloc avec un sourire qui ne veut plus se refermer et un sourcil qui a pris son indépendance.",
  c: [
    D("Assumer ce nouveau visage", "😁", "On finit par s'habituer. Les inconnus te trouvent toujours de bonne humeur.", { charme: -1, bonheur: 2, courage: 2 }),
    C("Demander une retouche", "🔧", [O(0.5, "La retouche arrange tout, presque trop bien.", { argent: -2500, charme: 2, bonheur: 3 }), O(0.5, "La retouche aggrave l'affaire. Le sourcil change de côté.", { argent: -2500, charme: -2, bonheur: -3 })], { risk: 2 }),
    D("Poursuivre le chirurgien", "⚖️", "Il disparaît sur une île. Son avocat t'envoie une carte postale.", { argent: -1500, honnete: 1, bonheur: -1 }),
  ],
});
ev("n_burnout_epique", {
  title: "Le burn-out en direct", ages: [25, 62], tags: ["sante", "travail"], ic: "🔥🧠", rar: "peu", need: { job: true },
  t: "Pendant une réunion de budget, tu te mets à rire et tu ne peux plus t'arrêter. Tu rédiges sur le tableau un poème sur la photocopieuse avant de t'allonger sur la table. Le médecin du travail est sidéré.",
  c: [
    D("Accepter un arrêt maladie", "🛏️", "Trois mois à regarder le plafond. Tu retrouves peu à peu le goût de la vie.", { sante: 3, bonheur: 4, perf: -5, prudent: 3 }),
    C("Démissionner sur-le-champ", "🚪", [O(0.5, "Tu pars, libéré{|e}. Un nouveau chapitre s'ouvre.", { quit: true, bonheur: 6, courage: 3 }), O(0.5, "Tu regrettes dès le lendemain, mais la lettre est partie.", { quit: true, bonheur: -3, argent: -500 })], { risk: 2 }),
    D("Continuer en serrant les dents", "🪨", "Tu tiens, mais le corps présente la facture dans quelques mois.", { sante: -7, bonheur: -3, ambition: 2 }),
  ],
});
ev("n_mauvais_genou", {
  title: "Le genou qui a vu trop de choses", ages: [35, 80], tags: ["sante"], ic: "🦵😖", rar: "commun",
  t: "Ton genou craque désormais à chaque pas, avec un son qui rappelle une porte d'église. Ton médecin affirme que « c'est l'âge », ce qui te vexe plus que la douleur.",
  c: [
    D("Faire une rééducation sérieuse", "💪", "Tu te remets à bouger. Ton genou renonce à la plainte.", { sante: 4, sport: 2, bonheur: 2 }),
    D("Ignorer et faire du saut en parachute", "🪂", "Le genou ne t'a pas demandé son avis. Il crie en l'air.", { courage: 3, sante: -4, bonheur: 4 }),
    D("Acheter une canne de collection", "🦯", "Tu deviens une légende de quartier. Les enfants t'appellent « Monsieur Chapeau ».", { charme: 1, repute: 1, bonheur: 2 }),
  ],
});
ev("n_gueule_de_bois_epique", {
  title: "Le lendemain qui chante faux", ages: [18, 60], tags: ["sante", "mature"], ic: "🍷🪦", rar: "commun",
  t: "Tu te réveilles sur un banc de parc, une couronne de fleurs sur la tête, un panneau « STATUE VIVANTE » autour du cou et quarante euros en pièces dans ta poche. Des touristes t'ont pris en photo, une à une.",
  c: [
    D("Rentrer discrètement chez toi", "🚶", "Un trajet de honte, avec un mégaphone dans la tête.", { sante: -2, bonheur: -2 }),
    D("Assumer ton nouveau métier", "🗿", "Tu restes immobile jusqu'au soir. Les touristes en redemandent.", { argent: 90, creatif: 2, bonheur: 3, repute: 1 }),
    C("Appeler un ami pour reconstituer la soirée", "📞", [O(0.5, "Le récit est mémorable. Vous riez pendant une heure.", { bonheur: 5, sociable: 1 }), O(0.5, "L'ami n'a aucun souvenir non plus. Seul le chien le sait.", { bonheur: 1, intel: -1 })], { risk: 1 }),
  ],
});

// ============ LOISIRS, VOYAGES, EXPÉRIENCES IMPROBABLES ============
ev("n_vol_annule", {
  title: "Retenu{|e} à l'aéroport", ages: [18, 75], tags: ["loisir"], ic: "✈️🛄", rar: "commun",
  t: "Ton vol est annulé. Puis le suivant. Puis la compagnie elle-même. Tu es coincé{|e} dans le terminal avec un sandwich à douze euros, une prise électrique convoitée et un voyageur qui chante.",
  c: [
    D("Transformer l'attente en fête", "🎉", "Tu improvises une soirée avec cent inconnus. Un mariage se prépare sur un coin de banc.", { sociable: 3, bonheur: 5, argent: -50 }),
    D("Rentrer en stop", "🚗", "Un routier te dépose chez toi, bavard et philosophe.", { courage: 2, bonheur: 2, argent: -60 }),
    C("Exiger une indemnité à voix haute", "📣", [O(0.5, "Tu obtiens un bon d'achat et une nuit d'hôtel, sous les applaudissements.", { argent: 300, bonheur: 3 }), O(0.5, "Un agent de sécurité te raccompagne à la sortie.", { bonheur: -3, repute: -1 })], { risk: 1 }),
  ],
});
ev("n_airbnb_enfer", {
  title: "Un logement exceptionnel", ages: [20, 70], tags: ["loisir"], ic: "🏚️🛏️", rar: "peu", need: { money: [600, null] },
  t: "L'annonce parlait de « charme rustique, vue sur la nature, hôte attentionné ». Sur place, la nature est entrée dans la chambre, l'hôte te regarde dormir de sa fenêtre et le matelas est un cheval.",
  c: [
    D("Demander à être remboursé{|e}", "💶", "Après dix jours de messages, on te rembourse une moitié.", { argent: -200, bonheur: -2 }),
    C("Rester pour l'aventure", "⛺", [O(0.5, "Le cheval devient ton ami. Tu passes un séjour inoubliable.", { bonheur: 6, creatif: 2 }), O(0.5, "L'hôte te réveille à six heures pour t'apprendre la traite.", { bonheur: -2, sante: -1 })], { risk: 1 }),
    D("Dormir dans la voiture", "🚙", "Une nuit froide, mais maîtrisée. L'aube est belle.", { sante: -1, courage: 1, bonheur: 1 }),
  ],
});
ev("n_randonnee_perdue", {
  title: "Raccourci fatal", ages: [14, 70], tags: ["loisir", "sante"], ic: "🥾🌲", rar: "peu",
  t: "Tu as pris « un petit raccourci » dans la forêt. Quatre heures plus tard, tu croises la même souche pour la sixième fois. Le portable affiche un point d'interrogation qui te regarde en silence.",
  c: [
    C("Suivre la rivière vers l'aval", "🌊", [O(0.8, "Tu retrouves un village, des gens et une très bonne soupe.", { courage: 3, bonheur: 4 }), O(0.2, "La nuit tombe, la nuit passe et les secours te trouvent à l'aube, frigorifié{|e}.", { sante: -6, courage: 2, argent: -300 })], { risk: 2 }),
    D("Allumer un feu de détresse", "🔥", "Les pompiers te trouvent en une heure. Ils se moquent un peu de toi.", { prudent: 2, bonheur: -1, argent: -150 }),
    D("Tourner en rond en chantant", "🎤", "Tu finis par tomber sur la route. Tu avais marché en cercle vingt minutes.", { bonheur: 2, courage: 1 }),
  ],
});
ev("n_festival_boue", {
  title: "Le festival sous le déluge", ages: [16, 50], tags: ["loisir", "mature"], ic: "🎸☔", rar: "commun",
  t: "Trois jours de musique, de bière tiède et de boue jusqu'aux genoux. Le chanteur du groupe principal glisse, tombe dans la fosse et te rend un sourire énorme. Ta tente flotte au loin.",
  c: [
    D("Danser dans la boue", "💃", "Tu entres dans le chaos avec bonheur. Ta photo fait la une du festival.", { bonheur: 6, repute: 2, sociable: 2, sante: -1 }),
    D("Trouver un abri avec des inconnus", "⛺", "Vous passez la nuit à chanter. Une amitié improbable se noue.", { bonheur: 4, sociable: 3 }),
    C("Monter sur scène par défi", "🎤", [O(0.25, "Le public te suit. Tu chantes avec le groupe pendant un refrain.", { repute: 5, bonheur: 8, courage: 3 }), O(0.75, "La sécurité te sort par les pieds.", { repute: -2, bonheur: -2, courage: 1 })], { risk: 2 }),
  ],
});
ev("n_tatouage_vacances", {
  title: "Un souvenir pour la vie", ages: [18, 55], tags: ["loisir", "mature"], ic: "🖋️🌴", rar: "peu",
  t: "En vacances, un tatoueur local te propose « le symbole de la chance » pour dix euros. Tu ne comprends pas un mot de la langue. Rentré{|e} chez toi, tu découvres qu'il y a écrit « LIVRAISON GRATUITE ».",
  c: [
    D("L'assumer fièrement", "😎", "C'est devenu ton signe distinctif. Les gens adorent.", { bonheur: 3, charme: 1, courage: 1, repute: 1 }),
    D("Le faire couvrir par un tatouage plus grand", "🐉", "Un dragon s'enroule maintenant autour de la mention. Le résultat est étonnamment beau.", { argent: -300, bonheur: 2, creatif: 1 }),
    C("Retourner voir le tatoueur", "✈️", [O(0.3, "Il te rembourse en riant et te tatoue autre chose.", { bonheur: 4, argent: -600 }), O(0.7, "Il a déménagé. Tu repars avec un autre souvenir, plus cher.", { argent: -900, bonheur: -2 })], { risk: 1 }),
  ],
});
ev("n_croisiere_naufrage", {
  title: "La croisière à moitié coulée", ages: [30, 85], tags: ["loisir", "loufoque"], ic: "🚢🫠", rar: "rare", need: { money: [2500, null] },
  t: "Le paquebot de luxe heurte un rocher que le commandant jurait avoir « déplacé au dernier moment ». Le buffet reste ouvert, l'orchestre joue un air triste et les passagers prennent des selfies sur le pont incliné.",
  c: [
    D("Embarquer dans le canot en premier", "🛟", "Tu t'en sors, un peu honteux{|se}. Un journal te surnomme « le rat du paquebot ».", { honnete: -3, repute: -3, bonheur: 1 }),
    D("Organiser l'évacuation", "🦸", "Tu aides tout le monde. Un reportage te nomme héros du jour.", { courage: 5, repute: 6, bonheur: 4, bonte: 3 }),
    C("Aller chercher le buffet de desserts", "🍰", [O(0.7, "Tu reviens avec trois gâteaux. Les rescapés t'adorent.", { bonheur: 5, repute: 2 }), O(0.3, "Tu rates le dernier canot. Un hélicoptère te repêche en dernier.", { bonheur: -3, sante: -3, courage: 2 })], { risk: 2 }),
  ],
});
ev("n_secte_yoga", {
  title: "La retraite spirituelle", ages: [22, 65], tags: ["loisir", "loufoque"], ic: "🧘‍♀️🌀", rar: "peu", need: { money: [800, null] },
  t: "Un week-end de yoga à la campagne. Le gourou accueille les participants en tunique rose et leur demande de « confier leur carte bancaire à l'univers ». Le bol de riz qui t'est tendu sourit un peu trop.",
  c: [
    D("Fuir en pleine nuit par la fenêtre", "🏃", "Tu t'enfuis, léger{|ère}. Le lendemain, tu bois un café sans te retourner.", { courage: 2, intel: 2, prudent: 3 }),
    C("Rester pour comprendre", "🧐", [O(0.3, "Le gourou s'avère inoffensif et drôle. Tu repars en paix.", { bonheur: 5, sante: 1 }), O(0.7, "Tu donnes plus que tu ne voulais. Un chèque est parti, la tunique est restée.", { argent: -1800, bonheur: -3, intel: -1 })], { risk: 2 }),
    D("Dénoncer la secte à la police", "👮", "Une enquête s'ouvre, on te remercie à demi-mot.", { honnete: 3, repute: 2, bonheur: 1 }),
  ],
});
ev("n_safari_selfie", {
  title: "Le selfie de trop", ages: [18, 70], tags: ["loisir", "sante"], ic: "🦁📷", rar: "rare", need: { money: [2000, null] },
  t: "En safari, tu as vu un lionceau près de la route. Un guide hurle de ne pas descendre. Tu penses, avec une logique imparable, que le lionceau est si mignon qu'il ne peut vouloir que ton bien.",
  c: [
    D("Remonter dans la jeep", "🚙", "Le guide te regarde avec une immense reconnaissance. Un souvenir sain.", { prudent: 3, bonheur: 2 }),
    C("Faire le selfie quand même", "🤳", [O(0.7, "Le selfie est splendide et la lionne n'a pas bougé. Tu as de la chance.", { bonheur: 6, repute: 3, courage: 3 }), O(0.27, "La lionne s'approche. Les gardes t'attrapent par le col.", { sante: -5, courage: 2, bonheur: -1 }), O(0.03, "La lionne n'a pas apprécié. Le safari devient un récit exemplaire.", { die: "lors d'un selfie avec un lionceau" })], { risk: 3 }),
    D("Offrir ton déjeuner au lionceau", "🍖", "Le guide tombe à la renverse. La lionne mange ton sandwich avec classe.", { bonte: 1, bonheur: 2, prudent: -2 }),
  ],
});
ev("n_surclassement", {
  title: "Surclassé{|e} par erreur", ages: [18, 80], tags: ["loisir", "chance"], ic: "🥂✈️", rar: "peu",
  t: "À l'embarquement, l'hôtesse t'adresse un sourire énorme et t'invite en première classe. Tu y découvres un siège-lit, du champagne et un voisin en costume qui te prend pour un célèbre écrivain.",
  c: [
    D("Jouer le jeu avec panache", "🎩", "Tu inventes un roman, tu signes des serviettes. Le voyage est mémorable.", { charme: 3, bonheur: 6, honnete: -2 }),
    D("Avouer la méprise", "🙊", "Le voisin rit beaucoup. Il t'offre un verre pour ta franchise.", { honnete: 3, bonheur: 4 }),
    C("Demander un second dessert", "🍰", [O(0.6, "On t'apporte trois desserts, la tête haute.", { bonheur: 5 }), O(0.4, "Le steward vérifie ton billet. Tu retournes en classe éco avec ton verre.", { bonheur: -2, repute: -1 })], { risk: 1 }),
  ],
});

// ============ RÉUSSITES EXTRAORDINAIRES ET COUPS DE CHANCE ============
ev("n_tableau_grenier", {
  title: "Le chef-d'œuvre du grenier", ages: [25, 85], tags: ["chance", "argent"], ic: "🖼️🕸️", rar: "mythique",
  t: "En vidant le grenier de tes parents, tu trouves une toile couverte de poussière, signée d'un nom que tu connais mal. Un expert la regarde longuement, devient pâle, puis te demande si tu veux t'asseoir.",
  c: [
    D("Vendre aux enchères", "🔨", "Le marteau s'abat sur un prix astronomique. Tu restes sans voix.", { argent: 200000, bonheur: 10, flag: "tableau_millions", later: { id: "n_profiteurs", in: [1, 2], p: 0.8 } }),
    D("L'accrocher au salon", "🛋️", "Chaque invité se prosterne devant le tableau. Tu gagnes un statut mondain.", { bonheur: 6, repute: 4, creatif: 2 }),
    C("Nettoyer le tableau toi-même", "🧽", [O(0.2, "Tu révèles une signature encore plus précieuse.", { argent: 350000, bonheur: 10, flag: "tableau_millions" }), O(0.8, "Tu effaces la moitié de la peinture avec un détergent ménager.", { bonheur: -10, intel: -2 })], { risk: 3 }),
  ],
});
ev("n_sauvetage_heros", {
  title: "Le héros du quai", ages: [14, 75], tags: ["chance", "celebrite"], ic: "🦸‍♂️🌊", rar: "rare",
  t: "Un enfant tombe de la jetée. Tu plonges tout habillé{|e}, tu le remontes, et un passant filme la scène en criant « génial » avec la voix d'un commentateur sportif. Tu es trempé{|e}, essoufflé{|e} et un peu confus{|e}.",
  c: [
    D("Refuser les honneurs", "🙏", "Tu repars discrètement. Mais la vidéo parle pour toi.", { courage: 4, bonte: 4, repute: 5, bonheur: 4 }),
    D("Accepter une médaille de la ville", "🏅", "Le maire te serre la main. Ta photo trône dans la mairie.", { repute: 7, bonheur: 5, bonte: 2 }),
    C("Monnayer ton histoire", "💶", [O(0.4, "Un magazine achète ton récit, qui devient un best-seller.", { argent: 5000, repute: 3, honnete: -2 }), O(0.6, "On te reproche ta cupidité. Tu perds une partie de ta gloire.", { repute: -3, bonheur: -2 })], { risk: 1 }),
  ],
});
ev("n_inventeur_accident", {
  title: "L'invention accidentelle", ages: [20, 70], tags: ["chance", "argent", "loufoque"], ic: "🔬💥", rar: "rare",
  t: "En voulant réparer ton grille-pain, tu fusionnes accidentellement un sèche-cheveux, une cuillère et un vieux téléphone. L'objet découpe parfaitement les tranches de pain en forme de poisson. Ton voisin pleure d'émotion.",
  c: [
    D("Déposer un brevet", "📑", "L'invention devient un succès mondial. Les tranches de pain-poisson partent par millions.", { argent: 30000, bonheur: 7, creatif: 3, ambition: 3 }),
    D("Offrir l'invention à ton voisin", "🎁", "Il devient riche. Tu es son parrain éternel.", { bonte: 4, bonheur: 3, rel: { voisin: 15 } }),
    C("Monter une société tout de suite", "🏢", [O(0.35, "La société décolle. Les investisseurs adorent ton air tranquille.", { argent: 15000, bonheur: 5 }), O(0.65, "La société s'effondre sous la comptabilité.", { argent: -4000, bonheur: -3 })], { risk: 2 }),
  ],
});
ev("n_mecene_inconnu", {
  title: "La fée bienfaitrice", ages: [18, 60], tags: ["chance", "argent"], ic: "🧚💶", rar: "rare",
  t: "Un homme élégant que tu n'as jamais vu te remet une enveloppe. « De la part de quelqu'un qui n'oubliera jamais ta gentillesse d'il y a douze ans », dit-il en s'éclipsant. L'enveloppe contient un chèque et un petit mot en forme de poème.",
  c: [
    D("Encaisser et dire merci", "🙏", "Un cadeau tombé du ciel. Tu en fais un bon usage.", { argent: 6000, bonheur: 6, bonte: 2 }),
    D("Chercher l'identité du donateur", "🕵️", "Tu retrouves une vieille dame que tu avais aidée sur un banc. Elle pleure de joie.", { argent: 6000, bonheur: 7, bonte: 3, intel: 1 }),
    D("Offrir la moitié à une association", "🤝", "Tu partages. La vieille dame l'apprend et rit aux larmes.", { argent: 3000, bonte: 5, bonheur: 6 }),
  ],
});
ev("n_erreur_virement", {
  title: "Un zéro de trop", ages: [20, 70], tags: ["chance", "argent"], ic: "🏦🤯", rar: "peu",
  t: "Ta banque a versé 30 000 euros sur ton compte à la place de 300. Un message d'excuse arrive deux heures plus tard, suivi d'un autre, puis d'un ton de plus en plus sec.",
  c: [
    D("Tout rendre immédiatement", "📞", "La banque te remercie d'un cadeau de 50 euros en bon d'achat. C'est un début.", { honnete: 4, argent: 50, bonheur: 2 }),
    C("Dépenser un peu avant de rendre", "🛍️", [O(0.4, "Tu rends l'argent, avec des frais. L'histoire reste dans l'agence.", { argent: -400, honnete: -2, bonheur: 3 }), O(0.6, "La banque te poursuit. L'amende est salée.", { argent: -3000, honnete: -3, record: 1, bonheur: -5 })], { risk: 3 }),
    D("Faire un don et tout avouer", "🏥", "Tu redonnes tout et laisses un petit pourboire à l'agence. Le directeur ne s'en remet pas.", { bonte: 3, honnete: 3, bonheur: 4, argent: -100 }),
  ],
});
ev("n_poste_prestigieux_accident", {
  title: "Le poste qui t'est tombé dessus", ages: [28, 62], tags: ["chance", "travail"], ic: "🏛️🎩", rar: "rare", need: { job: true },
  t: "Un chasseur de têtes t'appelle, enthousiaste. Il prend ton nom pour celui d'un expert renommé. Avant que tu comprennes, on t'invite à rejoindre le conseil d'administration d'une grande entreprise.",
  c: [
    D("Accepter et faire semblant", "🎭", "Tu apprends vite. On te trouve « visionnaire ».", { promote: true, honnete: -2, bonheur: 5, ambition: 3 }),
    D("Avouer la méprise", "🗣️", "Le chasseur éclate de rire et te propose un poste moins prestigieux, mais réel.", { honnete: 4, raise: 0.1, bonheur: 3 }),
    C("Demander un salaire exorbitant", "💰", [O(0.35, "L'entreprise accepte, par peur de perdre un génie.", { raise: 0.5, bonheur: 6, honnete: -2 }), O(0.65, "Le recrutement est annulé sur un éclat de rire.", { bonheur: -2, repute: -2 })], { risk: 2 }),
  ],
});
ev("n_concours_absurde", {
  title: "Champion{|ne} du monde de quelque chose", ages: [12, 80], tags: ["chance", "loufoque"], ic: "🏆🧀", rar: "rare",
  t: "Sans l'avoir prévu, tu t'inscris à un concours de lancer de fromage. Par un mélange de panique et de chance, tu gagnes. Tu reçois une coupe en forme de brie et une invitation aux championnats du monde.",
  c: [
    D("Partir aux championnats", "🧀", "Tu y vas, tu y crois, et tu termines troisième. Le brie est ton compagnon.", { repute: 4, bonheur: 5, sport: 2, argent: -300 }),
    D("Ouvrir une fromagerie", "🏪", "Tu surfes sur ta gloire. Ton fromage « Le Lanceur » devient célèbre.", { argent: 3000, creatif: 2, bonheur: 4 }),
    D("Garder la coupe sur ta cheminée", "🏠", "Chaque invité te demande de raconter l'histoire. Tu le fais avec plaisir.", { bonheur: 3, repute: 1 }),
  ],
});

// ============ ÉVÉNEMENTS EXTRÊMEMENT RARES ET CATASTROPHIQUES ============
ev("n_meteorite", {
  title: "Une pierre venue du ciel", ages: [10, 90], tags: ["catastrophe", "loufoque"], ic: "☄️🏠", rar: "mythique",
  t: "Une météorite de la taille d'un melon perce ton toit, traverse ta cuisine et s'arrête dans ton frigo, entre le beurre et le yaourt. Les scientifiques arrivent en courant, les journalistes en voiture et ta mère en pleurant.",
  c: [
    D("La vendre à un musée", "🏛️", "Le musée t'en offre une fortune. Le frigo, lui, reste au centre de l'exposition.", { argent: 25000, bonheur: 6, repute: 4 }),
    D("La garder dans ton salon", "🪨", "Chaque invité veut la toucher. Tu deviens l'hôte le plus populaire de la ville.", { bonheur: 5, repute: 3, sociable: 2 }),
    C("Organiser des visites payantes", "🎟️", [O(0.5, "Les visiteurs affluent. Tu fais fortune en quelques mois.", { argent: 12000, bonheur: 5 }), O(0.5, "L'assurance refuse de couvrir les dégâts, qu'elle juge « d'origine divine ».", { argent: -5000, bonheur: -4 })], { risk: 2 }),
  ],
});
ev("n_declare_mort", {
  title: "Vous êtes décédé{|e}, monsieur ou madame", ages: [25, 80], tags: ["catastrophe", "loufoque"], ic: "🪦📄", rar: "mythique",
  t: "Un courrier de l'administration te félicite de tes « obsèques récentes ». Ta carte bancaire est bloquée, ton compte est clos et ton employeur t'envoie des condoléances. Ton propre faire-part est affiché à la mairie.",
  c: [
    D("Se présenter au guichet en personne", "🚶", "On t'écoute avec un sourire gêné. Dix formulaires plus tard, tu es vivant{|e}.", { bonheur: -2, intel: 1, argent: -200 }),
    C("Profiter de la situation", "🥸", [O(0.5, "Tu vis trois semaines de liberté absolue, sans impôts ni factures.", { bonheur: 6, honnete: -3 }), O(0.5, "L'administration te retrouve et t'envoie une amende pour fraude.", { argent: -1500, honnete: -3, record: 1 })], { risk: 2 }),
    D("Assister à ton propre enterrement civil", "⚰️", "Tu entends les éloges les plus sincères de ta vie. Tu en es touché{|e}.", { bonheur: 5, bonte: 2, repute: 3 }),
  ],
});
ev("n_incendie_maison", {
  title: "Quand tout part en fumée", ages: [20, 85], tags: ["catastrophe"], ic: "🔥🏚️", rar: "rare", need: { money: [3000, null] },
  t: "Un court-circuit dans le grille-pain, un rideau trop proche et une nuit trop calme. Les pompiers sauvent le chat, les photos de famille et une cuillère à soupe. Le reste n'est plus que cendre.",
  c: [
    D("Accepter l'aide de la famille", "🤝", "Tu emménages quelques mois chez ta tante. Elle t'adore et te nourrit comme un roi.", { bonheur: -2, bonte: 2, argent: -1500, loseItem: "voiture" }),
    C("Contester l'assurance", "📑", [O(0.5, "L'assurance rembourse en grande partie.", { argent: 6000, bonheur: 2 }), O(0.5, "L'expert conclut à une négligence. Tu reçois une fraction.", { argent: 1500, bonheur: -5 })], { risk: 2 }),
    D("Repartir de zéro avec le sourire", "🌱", "Tu trouves un petit logement, des meubles de récupération et une vie plus simple.", { courage: 4, bonheur: 2, argent: -2500 }),
  ],
});
ev("n_inondation", {
  title: "Le salon aquatique", ages: [18, 90], tags: ["catastrophe"], ic: "🌊🛋️", rar: "rare",
  t: "La rivière sort de son lit et décide d'emménager chez toi. Ton canapé flotte, ton chat est sur la bibliothèque, et un canard s'est installé dans la baignoire en regardant les murs.",
  c: [
    D("Sauver les objets les plus précieux", "📦", "Tu sauves les albums de famille, la guitare et le canard.", { courage: 3, bonte: 2, argent: -1500, bonheur: -1 }),
    C("Attendre les secours sur le toit", "🏠", [O(0.9, "Les pompiers t'évacuent en barque. Tu te sens dans un film.", { bonheur: 2, courage: 2, argent: -2000 }), O(0.1, "Le toit tient, mais tu tombes malade du froid.", { sante: -8, argent: -2000 })], { risk: 2 }),
    D("Ramer dans le salon avec ton voisin", "🛶", "Votre humour est apprécié par le journal local, qui publie votre photo.", { sociable: 3, bonheur: 4, repute: 2, argent: -1000 }),
  ],
});
ev("n_double_identite", {
  title: "Le double parfait", ages: [20, 75], tags: ["catastrophe", "loufoque"], ic: "👥❓", rar: "mythique",
  t: "Un inconnu qui te ressemble comme deux gouttes d'eau a ouvert un compte bancaire à ton nom, a emprunté ton vélo et s'est inscrit à ton club de scrabble. Il a gagné le tournoi. Ton club le préfère.",
  c: [
    D("Le confronter", "🤝", "Vous vous découvrez des points communs étranges. Il devient un ami, un peu inquiétant.", { bonheur: 3, sociable: 2 }),
    C("Porter plainte pour usurpation", "⚖️", [O(0.5, "Il est condamné, et ton club regrette amèrement le tournoi.", { honnete: 2, bonheur: 1 }), O(0.5, "La police te prend pour le double. Tu perds une demi-journée.", { bonheur: -3, repute: -1 })], { risk: 1 }),
    D("Lui laisser ta vie ennuyeuse", "🎭", "Tu pars vivre ailleurs. Il se débrouille très bien avec tes factures.", { bonheur: 4, courage: 3, argent: -300 }),
  ],
});
ev("n_plancher_soiree", {
  title: "La fête qui s'effondre", ages: [18, 55], tags: ["catastrophe", "mature"], ic: "🏚️🎉", rar: "rare",
  t: "Soixante invités dans un appartement prévu pour douze. Le plancher gémit, le lustre balance, et un pilier cède dans un bruit d'opéra. Les invités tombent au rez-de-chaussée, sur une réunion de copropriétaires.",
  c: [
    D("Assumer la responsabilité", "🙋", "Tu t'excuses en personne. La copropriété t'envoie une facture, et une invitation à la prochaine fête.", { argent: -2500, honnete: 3, bonheur: -1 }),
    C("Accuser le voisin du dessus", "👉", [O(0.3, "Le voisin n'avait aucune preuve de son innocence. Tu t'en tires indemne.", { honnete: -4, bonheur: 2 }), O(0.7, "Il avait des témoins, toi non. L'affaire devient judiciaire.", { argent: -4000, honnete: -4, repute: -3 })], { risk: 3 }),
    D("Poursuivre la fête au rez-de-chaussée", "💃", "Les copropriétaires dansent aussi. Une soirée entrée dans l'histoire de l'immeuble.", { bonheur: 6, sociable: 3, repute: 2, argent: -800 }),
  ],
});
ev("n_pandemie_ridicule", {
  title: "La grande pénurie de papier", ages: [10, 90], tags: ["catastrophe", "loufoque"], ic: "🧻😱", rar: "rare",
  t: "Une rumeur explique que le papier toilette va disparaître. En une demi-journée, plus aucun rayon n'en contient. Ton voisin t'a proposé un échange contre un rein, une voiture ou un chat.",
  c: [
    D("Stocker comme tout le monde", "🛒", "Tu as dix paquets. Tu ne sais plus où dormir.", { argent: -150, bonheur: -1, prudent: 1 }),
    D("Rester calme et attendre", "🧘", "Les rayons se remplissent. Tu as gardé ton calme.", { bonheur: 2, intel: 1 }),
    C("Revendre du papier au marché noir", "🦹", [O(0.5, "Tu fais un joli bénéfice. Ton voisin te traite d'escroc avec admiration.", { argent: 1200, honnete: -3, bonheur: 2 }), O(0.5, "Les voisins se liguent contre toi. Ton paillasson disparaît.", { repute: -4, honnete: -3, bonheur: -3 })], { risk: 2 }),
  ],
});
ev("n_vol_identite_bancaire", {
  title: "Le compte à zéro", ages: [20, 80], tags: ["catastrophe", "argent"], ic: "💳🕳️", rar: "peu", need: { money: [2000, null] },
  t: "Un matin, ton compte affiche zéro. Un hacker, quelque part, a acheté 400 paires de chaussettes, un jet-ski et une licorne gonflable. La banque te répond que cela ressemble à ton « profil de consommation ».",
  c: [
    D("Faire opposition tout de suite", "🛑", "Tu récupères une partie de l'argent après deux mois de papiers.", { argent: -800, bonheur: -3, prudent: 2 }),
    C("Mener l'enquête toi-même", "🕵️", [O(0.25, "Tu remontes jusqu'au hacker, un adolescent qui s'excuse en larmes.", { argent: 1500, intel: 3, bonheur: 4 }), O(0.75, "Tu t'enfonces dans des forums obscurs. Ton ordinateur attrape un virus.", { argent: -600, bonheur: -3 })], { risk: 2 }),
    D("Accepter ton sort et garder la licorne", "🦄", "La licorne gonflable devient ta mascotte. Elle est plus fidèle que beaucoup d'humains.", { argent: -1500, bonheur: 1, creatif: 1 }),
  ],
});

// ============ VIEILLESSE, REGRETS, HÉRITAGE, FIN DE VIE ============
ev("n_testament_piege", {
  title: "Le testament piégé", ages: [60, 95], tags: ["vieillesse", "famille"], ic: "📜😈", rar: "peu", need: { money: [10000, null] },
  t: "Tu rédiges ton testament avec la lucidité d'un maître d'échecs. Chaque héritier devra relever un petit défi, un poème de dix vers, une soupe sans sel ou un repas en silence, avant de toucher un centime.",
  c: [
    D("Maintenir les défis, avec un sourire", "😈", "Ta famille se déchire joyeusement en ton absence. Tu savoures à l'avance.", { bonheur: 4, creatif: 2, bonte: -1 }),
    D("Tout partager équitablement", "⚖️", "Une génération qui t'aime et te regrette sans jamais s'étriper.", { bonte: 3, bonheur: 3 }),
    C("Tout léguer à ton chat", "🐈", [O(0.5, "Le notaire t'applaudit. Le chat vit dans le luxe, entouré de soupirants.", { bonheur: 5, creatif: 3 }), O(0.5, "La famille t'attaque en justice, avec une ardeur remarquable.", { bonheur: -3, argent: -1500 })], { risk: 2 }),
  ],
});
ev("n_inventaire_regrets", {
  title: "La liste des regrets", ages: [60, 95], tags: ["vieillesse"], ic: "📝🌅", rar: "commun",
  t: "Un soir de pluie, tu retrouves une vieille boîte. À l'intérieur, une liste dressée à vingt ans de tout ce que tu comptais faire. La plupart des lignes sont barrées d'un « jamais ». Une seule est restée vierge.",
  c: [
    D("Accomplir cette dernière ligne", "✅", "Tu l'accomplis, tremblant{|e} de joie. Un frisson te traverse.", { bonheur: 8, courage: 3, sante: -1 }),
    D("Rire de ta jeunesse et brûler la liste", "🔥", "Tu ris à gorge déployée, sans amertume. Le feu fait un joli spectacle.", { bonheur: 3, sante: 1 }),
    D("Appeler quelqu'un que tu n'as pas vu depuis longtemps", "📞", "Une voix te répond, émue. Vous parlez trois heures.", { bonheur: 6, bonte: 2, sociable: 2 }),
  ],
});
ev("n_maison_retraite_complot", {
  title: "La révolution des fauteuils roulants", ages: [70, 100], tags: ["vieillesse", "loufoque"], ic: "👵🛞", rar: "peu",
  t: "Dans ta résidence, un complot se trame. Une ancienne institutrice organise un tournoi illégal de bridge, un colonel prépare une évasion et ton voisin t'a confié qu'il cache des gâteaux sous son lit.",
  c: [
    D("Rejoindre le tournoi", "🃏", "Tu deviens le champion de la résidence. La rumeur dit que tu triches.", { bonheur: 5, sociable: 3, repute: 2 }),
    C("Participer à l'évasion", "🚪", [O(0.5, "L'évasion réussit jusqu'au parking. Un taxi vous ramène à la résidence.", { bonheur: 7, courage: 3 }), O(0.5, "Le colonel s'endort en chemin. Vous êtes retrouvés au bout de la rue.", { bonheur: 3, courage: 2, repute: -1 })], { risk: 1 }),
    D("Dénoncer les gâteaux", "🍪", "Tu es mis{|e} en quarantaine sociale. Les gâteaux sont à toi, au final.", { honnete: 2, bonheur: -1 }),
  ],
});
ev("n_petits_enfants_chantage", {
  title: "Les petits-enfants affectueux", ages: [65, 100], tags: ["vieillesse", "famille"], ic: "👵👶", rar: "commun", need: { kids: 1 },
  t: "Tes petits-enfants te rendent visite avec des fleurs, des dessins et un enthousiasme étrange. Après une heure, ils te demandent poliment quand tu comptes « nous faire cadeau de la maison ».",
  c: [
    D("Les gâter jusqu'à l'excès", "🎁", "Ils partent avec chacun une montre. Tu es adoré{|e}, ruiné{|e} et ravi{|e}.", { argent: -600, bonheur: 5, bonte: 2 }),
    C("Les mettre à l'épreuve", "🧪", [O(0.5, "Ils réussissent et te sourient. Tu ressens une belle fierté.", { bonheur: 6, bonte: 2 }), O(0.5, "Ils échouent lamentablement. Ils reviennent pour le dessert quand même.", { bonheur: 1, honnete: 1 })], { risk: 1 }),
    D("Promettre la maison à celui qui joue le mieux aux échecs", "♟️", "Une partie légendaire commence. Le dernier survivant gagne ton respect.", { intel: 2, bonheur: 4 }),
  ],
});
ev("n_reunion_classe", {
  title: "La réunion des anciens de la classe", ages: [40, 90], tags: ["vieillesse", "social"], ic: "🎓🥂", rar: "peu",
  t: "Quarante ans après le lycée, une réunion de classe est organisée. Le premier de la classe est devenu chauffeur de taxi, la plus timide dirige une multinationale et le cancre vend des assurances avec un talent redoutable.",
  c: [
    D("Y aller et tout raconter", "🗣️", "Tu repars avec trois anciens amis et quelques secrets rigolos.", { bonheur: 5, sociable: 2, repute: 1 }),
    C("Mentir sur ta réussite", "🎭", [O(0.4, "Ton mensonge est applaudi par la salle. Tu repars en héros imaginaire.", { bonheur: 3, honnete: -3, repute: 2 }), O(0.6, "Ton ancien voisin de table sort ton vrai dossier. La salle rit longuement.", { bonheur: -4, honnete: -3, repute: -3 })], { risk: 2 }),
    D("Rester chez toi, finalement", "🛋️", "La soirée t'a manqué comme une absence en mots croisés.", { bonheur: -1 }),
  ],
});
ev("n_ex_retrouve", {
  title: "Un amour de jeunesse", ages: [55, 95], tags: ["vieillesse", "amour"], ic: "💞🕰️", rar: "peu", need: { rel: "ex" }, who: { amour: "crush" },
  t: "Dans la salle d'attente du médecin, tu reconnais ton ancien amour de jeunesse. Ses cheveux ont blanchi, ses yeux n'ont pas changé. Il ou elle te sourit comme en 1983 et te demande si tu es toujours aussi maladroit{|e} en danse.",
  c: [
    D("Proposer un café", "☕", "Le café dure quatre heures. Vous reparlez de tout, y compris de ce que vous n'avez jamais dit.", { bonheur: 7, charme: 1, rel: { amour: 18 } }),
    C("Inviter à danser au bal du quartier", "💃", [O(0.6, "La piste est à vous. L'orchestre joue pour vous, ou presque.", { bonheur: 9, sante: 1, rel: { amour: 25 } }), O(0.4, "Votre hanche proteste. Les secours sourient en voyant les deux amoureux.", { bonheur: 4, sante: -3 })], { risk: 1 }),
    D("Lui sourire et partir en paix", "🕊️", "Certaines histoires restent belles parce qu'elles sont finies.", { bonheur: 2, bonte: 1 }),
  ],
});
ev("n_memoires", {
  title: "Mes mémoires, tome 1 sur 14", ages: [60, 100], tags: ["vieillesse", "creation"], ic: "📖🖋️", rar: "commun",
  t: "Tu décides d'écrire tes mémoires. Au bout de trois semaines, tu en es à la page 800 et tu viens à peine de naître. Le premier lecteur, ton neveu, demande poliment si les chapitres suivants sont « plus courts ».",
  c: [
    D("Poursuivre en quatorze tomes", "📚", "Ton œuvre devient un monument local. La bibliothèque lui consacre une étagère.", { creatif: 4, bonheur: 5, repute: 2 }),
    C("Chercher un éditeur", "✉️", [O(0.25, "Un éditeur y voit un chef-d'œuvre d'humour involontaire. Le livre est un succès.", { argent: 6000, repute: 6, bonheur: 7 }), O(0.75, "Dix lettres de refus, toutes très courtoises.", { bonheur: -2, creatif: 1 })], { risk: 1 }),
    D("Raconter tes histoires à voix haute", "🗣️", "Tu deviens la star des dîners de famille.", { sociable: 2, bonheur: 4 }),
  ],
});
ev("n_derniere_volonte", {
  title: "La dernière volonté improbable", ages: [70, 100], tags: ["vieillesse", "loufoque"], ic: "⚰️🎈", rar: "rare",
  t: "Tu as une dernière volonté un peu spéciale. Tu veux que tes cendres soient envoyées dans une fusée miniature, ou lancées au-dessus du stade pendant un match de handball. Ton notaire note chaque mot avec un air d'inquiétude.",
  c: [
    D("Maintenir la fusée miniature", "🚀", "Le notaire fait ses calculs. Ce sera cher, spectaculaire et inoubliable.", { argent: -3000, creatif: 3, bonheur: 5 }),
    D("Choisir le stade de handball", "🤾", "Les supporters sont prévenus. Ils applaudiront avec respect.", { bonheur: 4, repute: 2 }),
    D("Demander un simple enterrement champêtre", "🌳", "Un arbre sera planté avec tes cendres. Il grandira bien droit, comme toi.", { bonheur: 3, bonte: 2 }),
  ],
});
ev("n_bucket_list", {
  title: "Dernier tour de piste", ages: [65, 100], tags: ["vieillesse"], ic: "🎢🧓", rar: "peu", need: { money: [1500, null] },
  t: "Ton médecin est formel, il ne faut plus rien faire d'imprudent. Tu as donc décidé de tout faire, dans l'ordre. Saut en parachute, concert de heavy metal et déclaration d'amour à ton boulanger.",
  c: [
    C("Sauter en parachute", "🪂", [O(0.92, "Tu atterris dans un pré, hilare. Le moniteur te serre la main.", { bonheur: 9, courage: 4 }), O(0.08, "Ton cœur lâche d'émotion. Une fin à la hauteur de ta vie.", { die: "d'un coup d'émotion lors d'un saut en parachute" })], { risk: 3 }),
    D("Aller au concert de heavy metal", "🤘", "Tu pogotes avec dignité. Un jeune te prête son t-shirt.", { bonheur: 7, sante: -1, sociable: 2 }),
    D("Déclarer ton amour au boulanger", "🥖", "Il rougit. Il te répond que sa femme et lui seraient honorés de ta baguette quotidienne.", { bonheur: 5, courage: 3, charme: 1 }),
  ],
});
ev("n_veillee_fou_rire", {
  title: "Le fou rire de la veillée", ages: [40, 100], tags: ["vieillesse", "famille"], ic: "🕯️😂", rar: "peu",
  t: "Lors d'une veillée, un cousin raconte une anecdote tellement ridicule sur le défunt que toute l'assemblée éclate de rire. Le curé tousse. La veuve, elle, tape sur la table de joie. Tu es aux premières loges.",
  c: [
    D("Rire aux éclats avec les autres", "😂", "Le deuil devient un peu plus doux. Le rire a ouvert la porte.", { bonheur: 4, sociable: 2, bonte: 1 }),
    D("Tenter de te retenir", "🤐", "Tu craques au pire moment, à voix haute. On t'adore pour ça.", { bonheur: 2, repute: 1, courage: -1 }),
    D("Raconter à ton tour une histoire", "🎤", "Ton récit est applaudi. Le défunt aurait adoré.", { creatif: 2, bonheur: 5, repute: 2 }),
  ],
});
ev("n_heritier_surprise", {
  title: "L'héritier qui n'existait pas", ages: [55, 95], tags: ["vieillesse", "famille", "argent"], ic: "👤📜", rar: "rare", need: { money: [8000, null] },
  t: "Un jeune homme inconnu se présente chez ton notaire, un papier à la main. Il prétend être ton enfant caché, ton petit-neveu ou le fils de ton ex. Il est charmant, mal rasé, et possède ton nez.",
  c: [
    D("L'accueillir à bras ouverts", "🤗", "Il devient un vrai membre de la famille. Il fait la cuisine.", { bonheur: 6, bonte: 3, rel: { enfant: 10 } }),
    C("Demander un test ADN", "🧬", [O(0.6, "Le test confirme. Il fond en larmes, toi aussi.", { bonheur: 5, argent: -300, bonte: 2 }), O(0.4, "Le test est négatif. Il repart, légèrement penaud, avec un chèque pour le déplacement.", { bonheur: -1, argent: -400 })], { risk: 1 }),
    D("Le mettre à la porte", "🚪", "Tu te couches la conscience lourde, ce qui ne te ressemble pas.", { bonheur: -4, bonte: -3 }),
  ],
});

}

// Métiers et vocations
// (fichiers regroupés pour rester sous la limite de fichiers par dossier)

// ===== 80_metiers.js =====
{
// Vie professionnelle — scènes génériques et scènes propres à chaque métier
const { ev, flash, O, C, D } = require("../kit");
const R = require("../rules");

// ---------- Génériques ----------
ev("promotion_proposee", {
  ages: [22, 62], tags: ["travail"], ic: "📈🎉", w: 5, need: { job: true, exp: [3, null] }, once: false, cool: 4,
  t: "Ton travail ne passe pas inaperçu. Ta direction te convoque et évoque un nouveau poste, plus de responsabilités et une augmentation, avec un sourire poli qui promet beaucoup de réunions.",
  c: [
    C("Accepter la promotion", "🚀", [O(0.75, "Tu grimpes d'un échelon. Nouveau bureau, nouvelle plante verte.", { promote: true, ambition: 2, bonheur: 4, perf: 5, sante: -1 }), O(0.25, "Tu es promu{|e} mais le poste est un nid de guêpes. Les ennuis s'enchaînent.", { promote: true, bonheur: -2, sante: -3, perf: -5 })]),
    D("Négocier un plus gros salaire", "💰", "Tu obtiens une prime et un titre. Ta direction note ton audace.", { raise: 0.12, charme: 1, ambition: 2, perf: 2 }),
    D("Refuser pour garder ta tranquillité", "🧘", "Tu aimes ta vie telle qu'elle est. Le patron soupire.", { prudent: 2, bonheur: 3, perf: -3 }),
  ],
});

ev("augmentation_demande", {
  ages: [22, 62], tags: ["travail", "argent"], ic: "💶🙏", w: 5, need: { job: true }, once: false, cool: 3,
  t: "Les prix montent, ton salaire non. Tu prépares ton argumentaire devant le miroir de la salle de bain. Ton reflet te dit que tu devrais oser.",
  c: [
    C("Demander une augmentation", "💬", [O(0.5, "Accordée ! Ton chef parle de « reconnaissance de ton engagement ».", { raise: 0.1, ambition: 2, bonheur: 4 }), O(0.5, "« Pas le bon moment » dit-il, pour la huitième fois.", { bonheur: -2, ambition: 1 })]),
    D("Chercher un autre poste", "🔎", "Tu envoies quelques CV, juste pour voir.", { jobHunt: true, ambition: 1 }),
    D("Prendre ton mal en patience", "🕰️", "Un jour, on te reconnaîtra. Peut-être.", { prudent: 1, bonheur: -1 }),
  ],
});

ev("collegue_toxique", {
  ages: [20, 62], tags: ["travail"], ic: "🐍💼", w: 5, need: { job: true }, who: { collegue: "colleague" },
  t: "$collegue s'attribue tes idées en réunion, sourit dans ton dos et laisse ses tasses sales sur ton bureau. Il n'a pas le droit d'être aussi efficace dans la fourberie.",
  c: [
    D("L'affronter directement", "🗣️", "Une discussion tendue, mais honnête. Il se calme, un peu.", { courage: 3, honnete: 2, rel: { collegue: -8 }, perf: 2 }),
    C("Le dénoncer au patron", "📣", [O(0.5, "Le patron te donne raison, $collegue est recadré.", { repute: 2, perf: 4, rel: { collegue: -25 } }), O(0.5, "Le patron pense que tu cherches la bagarre.", { repute: -3, perf: -4, rel: { collegue: -15 } })], { risk: 1 }),
    D("Faire profil bas", "🤫", "Tu serres les dents et tu travailles dans ton coin.", { prudent: 2, bonheur: -3 }),
    C("Lui rendre la pareille", "😈", [O(0.5, "Tu le pièges avec la machine à café. Tout le monde en rit.", { creatif: 2, bonte: -2, rel: { collegue: -20 }, bonheur: 2 }), O(0.5, "Ton plan se retourne contre toi.", { repute: -4, perf: -5, bonte: -2 })], { risk: 1 }),
  ],
});

ev("patron_dragon", {
  ages: [20, 62], tags: ["travail"], ic: "🐲📞", w: 4, need: { job: true }, who: { chef: "boss" },
  t: "$chef te convoque à 18 h 52 pour un dossier « urgentissime ». Ses mails arrivent la nuit, ses exigences le dimanche, ses compliments jamais.",
  c: [
    D("Tout lâcher pour le dossier", "🔥", "Tu travailles jusqu'à minuit. $chef grogne un « pas mal ».", { perf: 8, sante: -3, bonheur: -3, ambition: 2 }),
    C("Lui dire non poliment", "✋", [O(0.5, "Il est surpris puis te respecte. Ton cadre de travail s'améliore.", { courage: 3, perf: 2, bonheur: 3, rel: { chef: 5 } }), O(0.5, "Il te déteste désormais.", { perf: -6, rel: { chef: -20 }, bonheur: -2 })], { risk: 1 }),
    D("Poser un congé maladie diplomatique", "🤒", "Un petit repos bien mérité. Ou presque.", { sante: 2, honnete: -2, perf: -2, bonheur: 2 }),
  ],
});

ev("equipe_seminaire", {
  ages: [22, 62], tags: ["travail", "loufoque"], ic: "🏕️🙈", w: 4, need: { job: true },
  t: "Séminaire d'entreprise en pleine forêt. Au programme, trampolines humains, cris de guerre, jeux de rôle et un atelier de cuisine collective où personne ne sait cuisiner.",
  c: [
    D("Jouer le jeu à fond", "🎭", "Tu es l'âme du séminaire. Le patron te félicite pour ton énergie.", { sociable: 3, perf: 4, bonheur: 4, repute: 2 }),
    D("Rester discret", "🌲", "Tu regardes la forêt en pensant à ton canapé.", { prudent: 1, bonheur: 0 }),
    C("Proposer un jeu de ton cru", "🎲", [O(0.5, "Un triomphe. Tout le monde en veut encore.", { creatif: 3, perf: 5, bonheur: 5, repute: 3 }), O(0.5, "Un fiasco épique.", { creatif: 2, repute: -2, bonheur: 1 })], { risk: 1 }),
  ],
});

ev("pause_cafe_ragots", {
  ages: [20, 62], tags: ["travail"], ic: "☕🗣️", w: 5, need: { job: true }, who: { collegue: "colleague" },
  t: "À la machine à café, $collegue chuchote un ragot croustillant sur la direction. La machine bipe, tout le monde se rapproche, la rumeur galope.",
  c: [
    D("Écouter sans commenter", "🤐", "Tu écoutes et tu retiens, comme un bon espion.", { prudent: 2, intel: 1 }),
    C("Propager le ragot", "📢", [O(0.5, "Tu deviens la personne qui sait tout. Les gens t'adorent... ou s'en méfient.", { sociable: 3, repute: 2, honnete: -2 }), O(0.5, "Le ragot remonte jusqu'au patron.", { repute: -5, perf: -4, honnete: -2 })], { risk: 1 }),
    D("Changer de sujet", "🙄", "Tu parles du temps. La machine à café reprend le dessus.", { honnete: 2, bonte: 1 }),
  ],
});

ev("erreur_cher_dossier", {
  ages: [20, 62], tags: ["travail"], ic: "🧾😬", w: 4, need: { job: true }, roll: { somme: [1000, 25000, 1000] },
  t: "Ton regard tombe sur une erreur dans le dossier que tu viens d'envoyer au client. Une virgule mal placée qui coûte $somme à la boîte.",
  c: [
    D("Avouer immédiatement", "🙋", "Ton chef n'est pas ravi mais apprécie ta franchise.", { honnete: 4, perf: -2, repute: 1 }),
    C("Tenter de réparer discrètement", "🕵️", [O(0.5, "Personne n'a rien vu. Tu respires.", { courage: 2, honnete: -1 }), O(0.5, "L'erreur est découverte. Tu es sanctionné{|e}.", { perf: -10, honnete: -3, repute: -3 })], { risk: 1 }),
    D("Mettre la faute sur un collègue", "😈", "Il se fait gronder à ta place. Tu as un goût amer dans la bouche.", { honnete: -5, bonte: -3, perf: 2 }),
  ],
});

ev("teletravail_chaos", {
  ages: [22, 62], tags: ["travail", "loufoque"], ic: "🏠💻", w: 4, need: { job: true },
  t: "Une visioconférence avec le grand patron tourne mal. Ton chat saute sur le clavier, ton enfant crie, ton voisin perce un mur, et tu as oublié de couper ta caméra.",
  c: [
    D("Rire de la situation", "😂", "Tout le monde rit avec toi. Tu deviens la star de l'équipe.", { charme: 2, sociable: 2, repute: 2, bonheur: 3 }),
    D("S'excuser platement", "🙇", "Le patron hausse un sourcil, mais ça passe.", { honnete: 1, perf: -1 }),
    D("Couper la caméra et faire semblant", "📵", "Personne n'est dupe. Personne ne dit rien.", { prudent: 1, perf: -2 }),
  ],
});

ev("deplacement_pro", {
  ages: [22, 62], tags: ["travail", "voyage"], ic: "💼✈️", w: 4, need: { job: true }, roll: { pays: "pays" },
  t: "Ton entreprise t'envoie en déplacement pro à destination de $pays. Un hôtel anonyme, un client exigeant et une réunion à 8 h après dix heures d'avion.",
  c: [
    D("Bosser sérieusement", "📊", "Le contrat est signé, tu rentres épuisé{|e} mais salué{|e}.", { perf: 8, ambition: 2, sante: -1 }),
    D("Profiter du séjour", "🏖️", "Tu visites un peu, tu manges beaucoup, tu travailles un tout petit peu.", { bonheur: 6, perf: -2, sociable: 1 }),
    C("Combiner travail et rencontre", "🤝", [O(0.5, "Tu signes un contrat et trouves une belle amitié.", { perf: 6, bonheur: 5, sociable: 3 }), O(0.5, "Tu rates ta réunion à cause d'un excès de dîner.", { perf: -6, bonheur: 3 })], { risk: 1 }),
  ],
});

ev("startup_idee_collegue", {
  ages: [24, 50], tags: ["travail", "argent"], ic: "💡🤝", w: 3, need: { job: true, money: [3000, null] }, who: { collegue: "colleague" },
  t: "$collegue te prend à part. « J'ai une idée géniale, on quitte tout et on monte une boîte. J'ai déjà le nom et un logo en cours de dessin ».",
  c: [
    C("Se lancer ensemble", "🚀", [O(0.25, "L'entreprise décolle à une vitesse folle. Vous voilà patrons.", { quit: true, ambition: 4, argent: 8000, item: { kind: "entreprise", name: "La start-up de $collegue", value: 120000 }, bonheur: 6 }), O(0.75, "Après un an de galère, elle ferme. Il vous reste l'amitié... ou pas.", { quit: true, argent: -6000, ambition: 2, bonheur: -3, jobHunt: true })], { cost: 3000, risk: 2 }),
    D("Décliner mais l'encourager", "👍", "Il se lance seul. Tu suis ses aventures de loin.", { prudent: 2, bonheur: 1 }),
    D("Lui dire que c'est une très mauvaise idée", "🙅", "Il en est vexé. Il ne te parle plus pendant un mois.", { honnete: 2, rel: { collegue: -10 } }),
  ],
});

ev("fusion_entreprise", {
  ages: [26, 60], tags: ["travail"], ic: "🏢🔀", w: 3, need: { job: { illicit: false } },
  t: "Ton entreprise annonce une fusion. Tout le monde parle de synergies, d'optimisation et de restructuration, ce qui veut dire que la moitié des gens vont partir.",
  c: [
    C("Se faire remarquer", "🌟", [O(0.55, "Tu es retenu{|e}, avec une belle promotion en prime.", { promote: true, ambition: 2, perf: 6 }), O(0.45, "Tu es remercié{|e}. L'indemnité est correcte.", { fire: true, argent: 5000, bonheur: -3, jobHunt: true })]),
    D("Faire profil bas", "🫥", "Tu passes entre les gouttes.", { prudent: 2, perf: 0 }),
    D("Prendre l'indemnité et partir", "💶", "Tu quittes l'entreprise avec un chèque et un sourire.", { quit: true, argent: 6000, courage: 2, jobHunt: true }),
  ],
});

ev("promotion_mauvaise_surprise", {
  ages: [24, 60], tags: ["travail"], ic: "😬📉", w: 3, need: { job: { min: 1 } },
  t: "Un jeune cadre plein de diplômes est nommé directeur au-dessus de toi. Il parle d'« agilité », d'« écosystème » et de « disruption », sans savoir où se trouve la photocopieuse.",
  c: [
    D("Lui apprendre le métier", "🤝", "Il t'est reconnaissant. Une alliance surprenante.", { bonte: 2, perf: 4, repute: 2 }),
    C("Le laisser se planter", "🍿", [O(0.5, "Il tombe, toi aussi tu y gagnes ta place.", { ambition: 2, perf: 5, honnete: -1 }), O(0.5, "Les ennuis te retombent dessus.", { perf: -6, bonheur: -2 })]),
    D("Postuler ailleurs", "🔎", "Tu en as assez de l'écosystème.", { jobHunt: true, ambition: 1 }),
  ],
});

ev("mutation_proposee", {
  ages: [24, 55], tags: ["travail"], ic: "🌍💼", w: 3, need: { job: true },
  t: "Ta société te propose une mutation à $ville, avec un meilleur salaire, un petit logement de fonction et une promesse de soleil trois jours par an.",
  c: [
    D("Accepter", "🧳", "Un nouveau départ, de nouvelles rencontres.", { city: true, raise: 0.1, courage: 2, bonheur: 2, argent: -1000 }),
    D("Refuser", "🏡", "Tu restes là où sont les tiens.", { prudent: 2, bonheur: 2 }),
  ],
});

ev("formation_continue", {
  ages: [26, 58], tags: ["travail"], ic: "🎓📋", w: 4, need: { job: true },
  t: "Ton entreprise propose une formation, trois jours dans un hôtel à la campagne. Le thème, « gérer son temps efficacement ». Le programme dure quarante heures.",
  c: [
    D("S'y inscrire sérieusement", "📝", "Tu en ressors plus efficace, un peu plus gris.", { intel: 2, perf: 5, ambition: 1 }),
    D("Y aller pour le buffet", "🍰", "La formation est l'excuse, le buffet le prétexte.", { bonheur: 3, perf: 1, sante: -1 }),
    D("Décliner", "🙅", "Tu préfères travailler à ton rythme.", { prudent: 1 }),
  ],
});

ev("heures_sup", {
  ages: [20, 62], tags: ["travail", "argent"], ic: "⏰💶", w: 4, need: { job: { illicit: false } },
  t: "Un gros projet débarque. La direction propose des heures supplémentaires, payées correctement, mais aux dépens de tes soirées et de ta patience.",
  c: [
    D("Accepter volontiers", "💪", "Tu t'épuises un peu, ton compte en banque aussi, dans le bon sens.", { argent: 2400, perf: 6, sante: -3, bonheur: -2 }),
    D("Refuser", "🙅", "Ta vie privée reste intacte, ta carrière un peu moins.", { perf: -3, bonheur: 2 }),
    D("Négocier des congés en échange", "🤝", "Un compromis habile. Tu pars en week-end prolongé.", { perf: 2, bonheur: 3, argent: 500 }),
  ],
});

ev("licenciement_dans_dos", {
  ages: [22, 60], tags: ["travail"], ic: "🔪📄", w: 2, need: { job: { illicit: false }, stat: { repute: [null, 40] } },
  t: "Ton entreprise te remet une lettre en main propre, sèche et dactylographiée. Tu es licencié{|e} pour faute grave, officiellement parce que tu aurais « mangé la dernière part de gâteau du comité ».",
  c: [
    C("Contester", "⚖️", [O(0.5, "L'injustice est reconnue, tu touches des indemnités.", { fire: true, argent: 7000, honnete: 2, bonheur: 1, jobHunt: true }), O(0.5, "Procès perdu. Fin de partie.", { fire: true, bonheur: -5, jobHunt: true })]),
    D("Rebondir immédiatement", "🏃", "Tu pars la tête haute et le carton sous le bras.", { fire: true, courage: 2, jobHunt: true }),
  ],
});

ev("nouveau_job_offre", {
  ages: [21, 60], tags: ["travail"], ic: "📬✨", w: 4, need: { job: true, exp: [2, null] }, once: false, cool: 4,
  t: "Un chasseur de têtes t'appelle. Une grande entreprise cherche quelqu'un dans ton domaine. Salaire plus élevé, promesses brillantes et un babyfoot.",
  c: [
    C("Passer l'entretien", "🤵", [O(0.55, "Tu es pris{|e} ! Nouveau poste, nouvelle vie.", { jobHunt: true, ambition: 2, bonheur: 3 }), O(0.45, "Tu n'es pas retenu{|e}, mais tu as gagné en assurance.", { courage: 1, charme: 1 })]),
    D("Refuser, tu es bien là", "🛋️", "Fidélité récompensée par une plante en cadeau.", { prudent: 2, bonheur: 2, perf: 2 }),
  ],
});

// ---------- Une scène à deux versions par métier ----------
const SPEC = {
  resto: [
    ["Le coup de feu du samedi soir déborde. Quarante couverts en retard, un client exige « un poulet sans poulet ». Le chef crie des mots que tu ne connais qu'en sauce.", "Tu inventes un plat de génie dans la cuisine, devant un critique gastronomique.", "Tu brûles trois assiettes et un tablier."],
    ["Un critique anonyme dîne dans ton établissement. Tout le monde le sait, personne ne sait lequel est le critique.", "Le critique adore. Un article élogieux paraît dans le journal local.", "Il trouve le pain trop salé et le dit à la ville entière."],
  ],
  commerce: [
    ["Les soldes sont arrivés. Une armée de clients affamés charge les portiques. Ton rayon ressemble à un champ de bataille de pull-overs.", "Tu fais le plus gros chiffre de la journée et un client t'offre des chocolats.", "Une bousculade mal gérée, un mannequin à terre, un fou rire nerveux."],
    ["Un client se plaint à voix haute que la couleur d'un t-shirt est « trop bleue ». Il exige un remboursement et la présence du directeur.", "Ta diplomatie sauve la situation, il repart avec trois t-shirts.", "Tu l'énerves, il poste un avis incendiaire en ligne."],
  ],
  btp: [
    ["Sur le chantier, la grue se bloque au-dessus d'une poutre. Les ouvriers regardent le ciel en croisant les doigts. Le chef te regarde, toi.", "Tu trouves la solution et décoinces la grue sous les applaudissements.", "La poutre tombe de peu à côté d'un camion."],
    ["Un client change tous les plans la veille de la livraison. Il veut une piscine à la place du garage.", "Tu t'adaptes avec brio et factures un joli supplément.", "Le client refuse de payer, l'ambiance est glaciale."],
  ],
  sante: [
    ["Une nuit de garde à l'hôpital, tout s'enchaîne. Une urgence, un fou rire, un patient qui jure qu'il est Napoléon.", "Ton sang-froid sauve un patient. L'équipe t'applaudit au petit matin.", "Tu fais une petite erreur de dosage, vite rattrapée, mais tu sues à grosses gouttes."],
    ["Un patient très célèbre arrive aux urgences en robe de chambre en or. Il exige une chambre avec jacuzzi.", "Tu le soignes avec tact, il te remercie dans une interview.", "Il refuse tes soins, tu perds ton calme."],
  ],
  droit: [
    ["Un dossier épineux atterrit sur ton bureau. Un client riche accusé d'avoir volé un bateau, qu'il jure avoir seulement « emprunté ».", "Ta plaidoirie fait mouche, le client est relaxé.", "Le juge te regarde avec des yeux de cobra, tu perds."],
    ["Le tribunal t'accorde dix minutes pour plaider une affaire de voisinage. Une histoire de chèvre qui a mangé un tableau de maître.", "Tu convaincs le juge, l'affaire est classée.", "La chèvre bêle pendant ta plaidoirie, personne ne t'écoute."],
  ],
  tech: [
    ["Un bug mystérieux paralyse la plateforme. Le client appelle toutes les cinq minutes. Il paraît que ça ne devrait pas se produire un vendredi.", "Tu trouves la faille en pleine nuit. Les serveurs repartent.", "Tu aggraves tout en voulant bien faire."],
    ["La direction veut intégrer une « IA révolutionnaire » dans le produit, dès lundi. Personne ne sait ce que cela veut dire.", "Tu livres un prototype étonnant, on t'invite à le présenter.", "Le prototype répond « 42 » à toutes les questions."],
  ],
  finance: [
    ["Les marchés s'affolent. Tes écrans clignotent de rouge. Un collègue crie « vends tout ! », un autre « achète tout ! ».", "Tu choisis la bonne direction et réalises un gain énorme.", "Tu rates le bon moment, la perte est cuisante."],
    ["Un client te confie un portefeuille important en insistant sur la discrétion. Il exige de la croissance sans risque.", "Tu gères avec brio, il te félicite.", "Le portefeuille dégringole, il te rappelle chaque heure."],
  ],
  enseignement: [
    ["Ta classe de trente élèves est en ébullition. Un cafard apparaît dans le cartable d'Inès, un cri retentit, et le tableau interactif décide de planter.", "Tu retournes la situation en cours de sciences naturelles. Les élèves adorent.", "Tu perds le contrôle, le directeur passe par hasard."],
    ["Des parents d'élèves exigent une réunion urgente, parce que leur enfant n'a eu que 19 sur 20.", "Tu les rassures avec calme, ils repartent apaisés.", "Ils déposent une pétition."],
  ],
  arts: [
    ["Ton spectacle est complet ce soir. La salle bruisse. Dans la dernière rangée, un producteur très célèbre s'est assis.", "Tu donnes le meilleur de toi-même, il t'offre un contrat.", "Un trou de mémoire et un décor qui tombe. Tu improvises mal."],
    ["Une galerie accepte d'exposer tes œuvres. Le vernissage est dans une semaine, les murs sont nus.", "Le public est enthousiaste, plusieurs œuvres se vendent.", "Seuls trois visiteurs passent, dont ta mère."],
  ],
  sportpro: [
    ["Match décisif ! Les tribunes grondent, ton entraîneur te regarde avec insistance. Ton genou craque un peu.", "Tu marques le but de la victoire. Le stade explose.", "Tu rates l'occasion, les huées pleuvent."],
    ["Un journaliste te demande ta recette secrète de la réussite. Tu bégaies que c'est « beaucoup de pâtes ».", "Ta réponse devient virale, les sponsors affluent.", "Ta phrase est reprise en moquerie par les humoristes."],
  ],
  politique: [
    ["Réunion publique dans la salle des fêtes. Trois cents personnes, un micro défaillant, et un habitant qui hurle contre les pigeons.", "Ton discours enflamme la salle, tu es applaudi{|e} longuement.", "Le micro grésille, ton discours fait un bide."],
    ["Un scandale éclate dans ton camp. Un adjoint aurait détourné le budget des feux d'artifice. On réclame ta réaction.", "Tu prends tes responsabilités avec dignité, ta cote remonte.", "Tu défends l'indéfendable, les médias t'étrillent."],
  ],
  ordre: [
    ["Une course-poursuite éclate dans les rues de $ville. Le suspect prend un tramway à contresens. Ton collègue hurle, tu accélères.", "Tu l'interceptes avec brio, félicité par le commissaire.", "Tu perds sa trace, il t'a semé en poussette."],
    ["Dans une affaire sensible, on te confie une mission discrète. Tu dois surveiller un suspect qui semble très observateur.", "Tu obtiens les preuves, l'affaire est résolue.", "Tu es repéré{|e} dès le premier jour, ton cache-nez ne fait illusion."],
  ],
  science: [
    ["Après des mois d'expériences, ta découverte pourrait changer la science. Ou le résultat vient d'une erreur de calcul, on ne sait pas.", "Les résultats sont confirmés, ton article fait sensation.", "L'erreur est confirmée, tu gagnes un silence gêné."],
    ["Un laboratoire concurrent publie une étude suspecte, étrangement proche de la tienne.", "Tu portes l'affaire avec élégance, la vérité éclate.", "Ta contestation est ignorée, tu perds du prestige."],
  ],
  libre: [
    ["Un client majeur menace de partir. Ton agenda déborde, ton ordinateur chauffe, ta tasse de café est la quatrième de la matinée.", "Tu le fidélises par une idée géniale, ton chiffre d'affaires grimpe.", "Il part, ton mois s'annonce maigre."],
    ["Une grosse commande arrive d'un client qui paie tard et exige tôt. Tout le monde te dit de te méfier.", "Il paie à temps, tout se passe bien.", "Il ne paie jamais, tu perds un mois de salaire."],
  ],
  transport: [
    ["Un orage violent s'abat sur la route. Les essuie-glaces vont à toute vitesse, ton chargement de poulets en porcelaine menace de se renverser.", "Tu arrives à bon port, intact, tu reçois une prime.", "Un dérapage, des poulets à terre, la franchise grimpe."],
    ["Retard de livraison à cause d'un embouteillage monstre. Le client menace de ne plus travailler avec ton employeur.", "Tu réussis à livrer à l'heure par un détour astucieux.", "Tu arrives avec trois heures de retard, l'ambiance est glaciale."],
  ],
  media: [
    ["Le direct commence dans une minute. Ton oreillette grésille, ton invité est en retard, ton prompteur affiche une recette de gâteau.", "Tu improvises et tu captives l'audience. Les chiffres montent.", "Tu bafouilles, tu rougis, c'est un naufrage en direct."],
    ["Un scandale touche ta chaîne. Une rumeur dit que tu aurais une liaison avec ta maquilleuse. C'est faux.", "Tu rétablis la vérité avec humour, ça te rend plus populaire.", "La rumeur grossit, ton image en souffre."],
  ],
  agri: [
    ["La récolte s'annonce excellente, mais un orage de grêle menace. Ton voisin t'aide à tendre des bâches, vous êtes tous les deux trempés.", "La récolte est sauvée, le marché te sourit.", "La grêle ravage la moitié du champ."],
    ["Un acheteur étranger vient visiter ta ferme et t'offre un contrat avantageux. Il veut tout goûter, y compris la vache.", "Tu le séduis, le contrat est signé.", "Le contrat tombe à l'eau, un taureau a mal pris la visite."],
  ],
  cirque: [
    ["Ton numéro est le clou du spectacle. Les projecteurs, les roulements de tambour, un tigre qui baille. Un spectateur dans la salle se met à hurler.", "Tu exécutes ton numéro à la perfection, ovation debout.", "Un faux pas, un nez rouge qui tombe, un rire d'enfant. Tu reprends en riant."],
    ["Le directeur du cirque te propose une tournée internationale. Les roulottes sont inconfortables mais le monde est vaste.", "Tu pars sillonner l'Europe, le succès est total.", "La tournée est annulée à cause d'un éléphant malade."],
  ],
  public: [
    ["Un dossier traîne depuis trois ans dans ton bureau. Il est coincé entre deux tampons, un formulaire et un trombone.", "Tu le fais avancer d'un coup magique, ta hiérarchie te félicite.", "Le dossier se perd, tu ne le retrouveras jamais."],
    ["Un usager mécontent hurle au guichet parce qu'on lui a demandé un justificatif de justificatif.", "Tu lui trouves une solution et il te serre la main.", "Il filme la scène, ça devient viral."],
  ],
  hotel: [
    ["Un client célèbre loge dans l'hôtel et exige des oreillers en plume de cygne et un thé servi à 3 h 07 du matin.", "Tu le satisfais, il laisse un énorme pourboire.", "Il quitte l'hôtel en laissant un avis assassin."],
    ["Une fuite d'eau inonde les chambres le jour d'un congrès. Les clients, en peignoir, s'agglutinent dans le hall.", "Tu gères la crise et offres le petit-déjeuner. Le congrès se termine joyeusement.", "L'hôtel doit rembourser plusieurs chambres."],
  ],
  immo: [
    ["Une cliente veut acheter une maison où elle a vu un fantôme. Elle y tient. Elle veut aussi une remise.", "Tu signes la vente avec un joli bénéfice.", "Elle renonce, la maison reste sur les bras."],
    ["Un promoteur te propose de vendre un terrain dont le propriétaire dit qu'il est maudit. Il y a des champignons parlants.", "Tu fais une belle commission.", "L'affaire se retourne contre toi."],
  ],
  ingenierie: [
    ["Le pont que tu as conçu va être inauguré. Les élus coupent le ruban, les caméras filment, une inquiétante fissure apparaît.", "Tu rectifies in extremis, le pont tient.", "Un affaissement, une enquête, un énorme scandale."],
    ["Ton prototype d'aspirateur nucléaire fascine la direction. Le premier essai doit avoir lieu en public.", "L'essai est une réussite éclatante.", "L'aspirateur explose en confettis."],
  ],
  presse: [
    ["Tu enquêtes sur un scandale local de pots-de-vin. Un informateur anonyme te donne un indice dans un parking sombre.", "Ton article fait grand bruit et te vaut une récompense.", "Ton article est démenti, une plainte tombe."],
    ["Ton rédacteur en chef réclame un titre accrocheur pour demain. Il suggère « Un cochon fait le tour du monde en ballon ».", "Ton papier s'arrache, tu deviens la star de la rédaction.", "Le cochon n'existait pas, tu es ridiculisé{|e}."],
  ],
  crime: [
    ["Un gros coup se prépare. Une banque, une nuit, un plan en trois étapes dessiné sur une serviette en papier.", "Le coup réussit, un butin gras comme une oie de Noël.", "La police débarque, tu t'enfuis in extremis."],
    ["Un rival du Milieu veut te dépouiller. Il envoie des hommes en costume rayé à ta porte, avec une boîte de chocolats piégée.", "Tu déjoues le piège avec panache.", "Tu perds une partie de ton butin."],
  ],
};
Object.keys(SPEC).forEach((tr) => {
  const T = R.TRACKS[tr];
  SPEC[tr].forEach((spec, i) => {
    const [intro, win, lose] = spec;
    const illicit = !!T.illicit;
    ev("pro_" + tr + "_" + (i + 1), {
      ages: [T.age, T.maxAge || 62], tags: illicit ? ["travail", "mature"] : ["travail"], ic: T.ic + "💼", w: 5, need: { job: tr }, once: false, cool: 3,
      t: intro,
      c: [
        C("Foncer, c'est le moment de briller", "🚀", [O(0.5, win, { perf: 9, ambition: 2, repute: 3, bonheur: 4, argent: Math.round(T.levels[0][1] * 0.08), exp: 1 }), O(0.5, lose, { perf: -7, bonheur: -3, sante: -1, repute: -2 })], { risk: 1 }),
        D("Jouer la prudence", "🛡️", "Tu fais ton travail sans éclat. Rien de grave, rien de glorieux.", { prudent: 2, perf: 1 }),
        C("Chercher un raccourci", "🥷", [O(0.45, "Le raccourci fonctionne. Personne n'y voit rien.", { perf: 5, honnete: -2, creatif: 1 }), O(0.55, "Le raccourci te revient dans la figure.", { perf: -8, honnete: -2, repute: -3 })], { risk: 1 }),
      ],
    });
  });
});

flash("Une photocopieuse tombe en panne. Un drame de bureau se joue.", { bonheur: -1 }, { ages: [20, 62], need: { job: true } });
flash("Ton collègue apporte des croissants. Il est l'homme du jour.", { bonheur: 2 }, { ages: [20, 62], need: { job: true } });
flash("Ton chef t'offre un mug « employé du mois ». Il est fêlé.", { perf: 1, bonheur: 1 }, { ages: [20, 62], need: { job: true } });
flash("Ton badge ne marche plus. Tu entres derrière quelqu'un en faisant semblant de téléphoner.", { bonheur: 0 }, { ages: [20, 62], need: { job: true } });
flash("L'ascenseur te laisse coincé{|e} dix minutes avec le directeur. Vous parlez de pêche.", { perf: 2, bonheur: 1 }, { ages: [20, 62], need: { job: true } });
flash("Une tasse de café renversée sur un clavier. Tu pleures en silence.", { bonheur: -1, argent: -60 }, { ages: [20, 62], need: { job: true } });
flash("Un client te laisse un avis cinq étoiles avec des fautes d'orthographe adorables.", { perf: 2, bonheur: 2 }, { ages: [18, 62], need: { job: true } });
flash("Tu gagnes un gâteau à la tombola de l'entreprise. Il est aux navets.", { bonheur: 1 }, { ages: [20, 62], need: { job: true } });

}

// ===== 81_metiers2.js =====
{
// Scènes propres aux métiers ajoutés (sports, arts, médias, vie nocturne, passions, aventure)
const { ev, flash, O, C, D } = require("../kit");
const R = require("../rules");

// [introduction, issue heureuse, issue malheureuse, libellé du raccourci]
const SPEC = {
  foot: [
    ["Dimanche de match. Le stade chante, ton entraîneur hurle depuis la touche et le ballon te tombe pile sur le pied droit, à vingt mètres des buts.", "Une frappe sublime, le filet tremble. Le stade se lève comme un seul homme.", "Le ballon part dans la tribune et atterrit dans la bière d'un supporter.", "Plonger dans la surface"],
    ["Un recruteur d'un grand club observe le match depuis la tribune. Ton agent t'a prévenu{|e} la veille avec trois points d'exclamation.", "Tu joues le match de ta vie. L'offre arrive dans la soirée.", "Tu rates trois passes faciles. Le recruteur range son carnet.", "Provoquer un penalty"],
    ["Après une défaite lourde, les supporters t'attendent à la sortie du stade avec des banderoles. Pas toutes très aimables.", "Tu t'arrêtes, tu t'excuses sincèrement. L'ambiance se détend et un chant te réhabilite.", "Un mot de travers devient viral. Ta cote chute.", "Passer par la sortie de secours"],
  ],
  tennis: [
    ["Balle de match au troisième set. Ton adversaire se gratte le nez, le public retient son souffle, un pigeon s'est posé sur la ligne.", "Un service gagnant, ligne touchée. Tu tombes à genoux sur la terre battue.", "Double faute. La raquette finit en deux morceaux.", "Contester la ligne"],
    ["Un grand sponsor te propose un contrat de lunettes, de montres et de boissons énergisantes. Ton agent a des étoiles dans les yeux.", "Tu négocies comme un ministre, le contrat est somptueux.", "Le sponsor se retire après une photo malheureuse.", "Signer sans lire"],
  ],
  rugby: [
    ["Finale de championnat sous la pluie. Le terrain est une soupe de boue, le talonneur a perdu une chaussure, la mêlée avance en grognant.", "Tu perces la défense et plantes l'essai de la victoire.", "Tu lâches le ballon à trois mètres de la ligne. Le silence est assourdissant.", "Plaquer un peu trop haut"],
    ["La troisième mi-temps s'éternise. Le capitaine chante, le président danse sur une table, ton coach regarde sa montre.", "Tu mènes le chant avec brio, l'équipe est soudée comme jamais.", "Tu glisses, tu casses la table du président. Facture salée.", "Rentrer discrètement"],
  ],
  cyclisme: [
    ["Dernière montée du col. Le peloton s'étire, ton souffle ressemble à un soufflet de forge et un spectateur te court à côté déguisé en diable.", "Tu lâches tout le monde dans les derniers lacets. Bras levés sur la ligne.", "Une crevaison à cinq kilomètres de l'arrivée, le rêve s'évapore.", "Se faire pousser par un supporter"],
    ["Un contrôle surprise a lieu à l'hôtel de l'équipe, à six heures du matin. Tout le monde sort en pyjama.", "Tout est en règle. Tu dors comme un bébé ensuite.", "Une erreur administrative fait grand bruit dans la presse.", "Disparaître avant le contrôle"],
  ],
  boxe: [
    ["Gong du dernier round. Ton œil droit ne s'ouvre plus, ton adversaire danse autour de toi, ton coach hurle des conseils contradictoires.", "Un crochet parfait au moment idéal. L'arbitre lève ton bras.", "Tu vas au tapis. Comptez jusqu'à dix, tu en es à neuf.", "Tenter un coup interdit"],
    ["Un promoteur douteux propose un combat à gros budget, dans un hangar, sans arbitre officiel.", "Le combat est réglo, la bourse est belle et personne ne se plaint.", "L'affaire tourne mal, ta réputation prend un coup.", "Accepter les yeux fermés"],
  ],
  f1: [
    ["Le départ du Grand Prix approche. Cinq feux rouges, vingt voitures, un moteur qui hurle plus fort que ta mère.", "Tu prends un départ magistral et tu gagnes quatre places dans le premier virage.", "Un accrochage au premier virage. Ton aileron voltige dans les arbres.", "Couper la chicane"],
    ["Ton ingénieur te propose un réglage audacieux de la voiture, jamais testé, qui pourrait changer la course.", "Le réglage fait des merveilles, tu domines la séance.", "La voiture devient incontrôlable, tu finis dans le bac à graviers.", "Garder le réglage secret"],
  ],
  ski: [
    ["Dernière descente de la saison. Un brouillard à couper au couteau cache les piquets et un marmotton s'est installé sur la piste.", "Tu dévales comme une fusée, chrono record.", "Tu rates la porte. Ta saison se termine dans un filet.", "Prendre un raccourci hors piste"],
    ["Une avalanche menace le col pendant l'entraînement. Le guide hésite, le sponsor attend.", "Vous attendez et la montagne s'effondre loin de vous. Sage décision.", "Tu t'entêtes, une coulée de neige te surprend.", "Foncer malgré tout"],
  ],
  natation: [
    ["La finale est dans cinq minutes. Ton bonnet est trop serré, ton entraîneur te donne un dernier conseil, tu ne l'as pas entendu.", "Plongeon parfait, virages précis. Tu touches le mur en premier.", "Ton maillot se déchire en plein virage. Le public hurle, toi aussi.", "Tricher sur le départ"],
    ["Un journaliste te demande ton secret de préparation devant dix caméras. Ton secret est une tartine de beurre de cacahuète.", "Ta franchise séduit le pays, les tartines se vendent à prix d'or.", "Tu fais un mauvais jeu de mots, la presse s'en empare.", "Inventer un secret"],
  ],
  esport: [
    ["Finale en direct, quatre mille personnes dans la salle et trois millions devant leurs écrans. Ta souris vient de lâcher une étincelle.", "Un combo parfait. L'équipe adverse jette ses casques.", "Un mauvais clic fatal. Le chat te rebaptise pour la semaine.", "Utiliser un bug du jeu"],
    ["Ton équipe te demande de passer 14 heures par jour à t'entraîner. Ton dos proteste, ton rang monte.", "Tu atteins le premier rang mondial du classement.", "Tu t'effondres de fatigue avant le tournoi.", "Dormir sur le clavier"],
  ],
  danse: [
    ["Premier soir de gala. Ton partenaire a un genou en compote, ta chaussure de pointe a un clou, la salle est comble et le rideau se lève.", "Tu enchaînes les pirouettes sans faute. Les roses pleuvent.", "Un faux pas, un genou qui lâche, un silence gêné.", "Improviser une variation"],
    ["Une chorégraphe célèbre te propose de rejoindre son prochain spectacle. Elle change d'avis toutes les dix minutes.", "Tu t'adaptes avec grâce, elle t'érige en muse.", "Elle te déteste. Tu es remplacé{|e} en une soirée.", "Copier un autre danseur"],
  ],
  coach: [
    ["Un client veut perdre 20 kilos pour son mariage dans trois semaines. Sa fiancée ne le sait pas encore.", "Il y parvient, il pleure de joie et t'offre un bouquet.", "Il craque devant une raclette et te rend responsable.", "Promettre un miracle"],
    ["Ta salle de sport est envahie par une classe de seniors énergiques. Ils ont des muscles d'acier et des remarques acerbes.", "Tu les conquiers avec humour, ils amènent leurs voisins.", "Ils te débordent, tu finis sur le banc de musculation.", "Les mettre au défi"],
  ],
  chanteur: [
    ["Tu montes sur scène devant une foule immense. Ton micro grésille, ton batteur est en retard, ta chanson préférée vient de sortir de ta mémoire.", "Tu improvises, la foule hurle ton nom.", "Tu chantes faux, un spectateur te lance une chaussure.", "Mimer en play-back"],
    ["Un producteur propose de transformer ton refrain en tube mondial. Il veut aussi changer ton nom, ta coupe et tes paroles.", "Le tube cartonne, tu es partout.", "Le tube fait un four, tu perds ton identité.", "Signer à la hâte"],
    ["Ton nouveau single est repris dans une publicité pour du fromage. Les fans sont partagés, le chèque ne l'est pas.", "Le fromage se vend, tu encaisses les droits.", "Le fromage est périmé, le scandale éclate.", "Refuser par principe"],
  ],
  dj: [
    ["Minuit, le club est plein, tes platines fument. Un fan hurle une demande à l'oreille, un autre renverse sa boisson sur ton ordinateur.", "Tu enchaînes les morceaux, la salle devient folle.", "Le logiciel plante. Quarante secondes de silence, c'est long.", "Lancer un remix improvisé"],
    ["Un organisateur de festival te propose le créneau de trois heures du matin, devant une foule hypnotisée et un peu fatiguée.", "Ton set devient culte. Les vidéos tournent partout.", "Tu te trompes de clé USB, tu joues des chansons pour enfants.", "Promettre un set explosif"],
  ],
  cinema: [
    ["Premier jour de tournage. Le réalisateur crie « moteur », ton partenaire oublie son texte, une mouette passe dans le champ.", "Tu improvises une réplique magistrale, le plateau applaudit.", "Tu éclates de rire quarante fois de suite. L'équipe soupire.", "Voler la vedette"],
    ["Le film dans lequel tu joues sort en salle. Les critiques sont mitigées, ta mère pleure de fierté au premier rang.", "Ta performance fait sensation, les propositions pleuvent.", "Un critique t'éreinte en trois lignes assassines.", "Écrire toi-même une critique élogieuse"],
    ["Un grand festival t'invite pour présenter ton film. Smoking prêté, escaliers rouges, flashs de partout.", "Tu glisses sur le tapis avec élégance, les caméras t'adorent.", "Tu tombes dans l'escalier, c'est la photo du jour.", "Arriver en retard sur un âne"],
  ],
  humour: [
    ["Ta première grande salle. Ton premier gag tombe dans le vide et le deuxième encore plus bas. Au fond, un spectateur ronfle.", "Ta chute fait mouche, la salle se tord.", "Tu bafouilles, le silence s'installe, quelqu'un tousse.", "Imiter un politicien"],
    ["Ton sketch devient viral, mais pas pour les bonnes raisons. Une phrase sortie de son contexte enflamme les réseaux.", "Tu t'expliques avec humour, la polémique retombe et tu en sors grandi{|e}.", "L'affaire dégénère, tu perds des contrats.", "Faire le mort"],
  ],
  mannequin: [
    ["Défilé de la semaine de la mode. Tu portes une robe en carton, des chaussures à talons de quinze centimètres et un chapeau en forme de saucisson.", "Tu glisses sur le podium avec une grâce de fauve. Les flashs crépitent.", "Un talon cède, tu atterris dans les bras d'un critique.", "Marcher à reculons"],
    ["Un photographe réputé te propose une séance mystérieuse, en pleine nuit, dans un entrepôt. Son assistante est très gentille.", "Les photos sont sublimes, la couverture t'attend.", "La séance est un désastre, on perd le contrat.", "Exiger un cachet exorbitant"],
  ],
  createur: [
    ["Tu lances une nouvelle vidéo. Ton idée est un défi à base de tartes, de chats et de trampolines. Ton compteur d'abonnés frémit.", "La vidéo devient virale, tes abonnés explosent.", "La vidéo se retrouve à 12 vues, dont trois de ta tante.", "Acheter de faux abonnés"],
    ["Une grande marque veut t'offrir un contrat de partenariat. Tu dois dire dans tes vidéos que leur shampoing change la vie.", "Le contrat te rend riche et tes fans te suivent.", "Tes fans découvrent que tu n'as jamais utilisé le shampoing.", "Mentir sans honte"],
    ["Un autre créateur t'accuse publiquement d'avoir copié son idée. Les commentaires s'enflamment à la vitesse de la lumière.", "Tu réponds avec humour, la polémique retombe en ta faveur.", "Tu réponds à chaud, ton message est ressorti dans toute la presse.", "Supprimer ton compte pour la nuit"],
  ],
  photo: [
    ["Un mariage de 250 invités, un marié ivre, un oncle qui se prend pour le photographe et un gâteau qui penche dangereusement.", "Tu captures l'instant magique, les mariés pleurent devant l'album.", "Tu oublies de recharger la carte mémoire. Plus aucune photo.", "Mettre en scène des faux souvenirs"],
    ["Un magazine te commande un reportage sur un volcan en éruption. Tu as quarante-huit heures et un seul objectif.", "Tes photos font le tour du monde.", "Tu perds ton matériel dans un ravin.", "Voler une image à un confrère"],
  ],
  peintre: [
    ["Ton tableau est exposé dans une galerie du centre-ville. Un visiteur l'observe dix minutes et déclare que c'est « de la peinture ».", "Un collectionneur l'achète au prix d'une voiture.", "Un enfant dessine dessus au feutre, personne ne s'en aperçoit.", "Prétendre que c'était voulu"],
    ["Un mécène très riche t'invite dans sa villa pour un portrait de sa famille. Le chien refuse de poser.", "Le portrait enchante la famille, les commandes suivent.", "Le portrait déplaît, on te fait déguerpir.", "Flatter le modèle jusqu'au ridicule"],
  ],
  gamedev: [
    ["Ton jeu sort demain. Vingt-trois bugs connus, quatre mystérieux, et une quête principale qui fait crasher la console.", "Le lancement est un succès, les joueurs adorent les bugs.", "Les avis sont désastreux, le studio panique.", "Cacher les bugs"],
    ["Un éditeur te propose de racheter ton studio. Il parle de synergies, d'agilité et de licornes.", "Tu vends au meilleur prix, tu gardes ta liberté.", "Le rachat tourne mal et tu perds le contrôle.", "Refuser par orgueil"],
  ],
  mode: [
    ["Ta collection d'été est prête. Elle comporte neuf robes, trois chapeaux et un sac à main qui fait aussi cafetière.", "Les acheteurs raffolent de la cafetière. La collection s'arrache.", "Les acheteurs se moquent du sac et la presse suit.", "Copier une grande maison"],
    ["Une célébrité veut porter ta robe pour une cérémonie. Elle exige de la raccourcir, de l'allonger et de la teindre en bleu.", "Elle est sublime, ton nom est dans tous les magazines.", "La robe se déchire en direct à la télévision.", "Tout accepter sans discuter"],
  ],
  archi: [
    ["Ton projet de tour futuriste est présenté au conseil municipal. Le maire l'adore, les voisins le détestent, un pigeon a déjà fait son nid sur la maquette.", "Le projet est approuvé à l'unanimité.", "Le projet est enterré sous les pétitions.", "Cacher les plans défavorables"],
    ["Le chantier de ton premier gros bâtiment accuse trois semaines de retard. L'entrepreneur invente des excuses de plus en plus poétiques.", "Tu rattrapes le retard en jonglant avec les équipes.", "Une erreur de calcul fait rire tout le chantier.", "Rogner sur les matériaux"],
  ],
  tatoueur: [
    ["Un client veut le prénom de son ex tatoué sur le bras. Il en est certain. Vraiment. Il tremble en le disant.", "Tu le dissuades avec tact. Il revient avec un dessin magnifique.", "Il te rend responsable quand l'ex revient.", "Tatouer sans discuter"],
    ["Une célébrité réserve ton salon pour la nuit, en secret, avec huit gardes du corps et une idée très étrange.", "Le tatouage devient légendaire, ta réputation explose.", "La célébrité n'est pas contente, tu perds des clients.", "Tout poster sur internet"],
  ],
  coiffeur: [
    ["Une cliente exige « la coupe de la star de la semaine » mais montre une photo de profil, floue, sur un téléphone fissuré.", "Elle sort radieuse, son mari ne la reconnaît plus mais adore.", "Elle sort en larmes. Les avis en ligne vont être cruels.", "Couper à l'instinct"],
    ["Ton salon est invité à coiffer une émission de télévision en direct. Tu as dix minutes, un sèche-cheveux et un fou rire naissant.", "La coiffure est applaudie, la télé t'engage.", "Le chignon s'effondre en direct. Les audiences explosent mais pas en ta faveur.", "Tout miser sur la laque"],
  ],
  patisserie: [
    ["Un mariage de 300 invités et un gâteau à sept étages. Il fait 35 degrés dans la salle. Ton chef te regarde avec des yeux de loup.", "Le gâteau tient, la salle applaudit, les mariés pleurent de gourmandise.", "Le gâteau fond lentement, comme dans un film d'horreur.", "Remplacer la crème par de la mousse à raser"],
    ["Un grand critique gastronomique visite ta boutique en secret. Tu le reconnais à son carnet et à ses lunettes sévères.", "Il adore ton éclair et lui consacre trois colonnes.", "Il se casse une dent sur un macaron. Mauvaise critique.", "Offrir la tournée de gâteaux"],
  ],
  cabaret: [
    ["Premier soir sur scène. Le projecteur t'aveugle, ta tenue tient avec trois épingles et la salle est pleine. Un oncle que tu ne connaissais pas est au premier rang.", "Ton numéro électrise la salle. Tu es ovationné{|e}.", "Un accroc de costume provoque un fou rire général. Tu t'en sors avec humour.", "Improviser un numéro inédit"],
    ["Une soirée privée très bien payée est proposée par un client mystérieux. Le patron te regarde d'un air entendu.", "La soirée se passe très bien, le pourboire est digne d'un roi.", "Le client se révèle odieux. Tu quittes les lieux la tête haute.", "Accepter sans poser de questions"],
    ["Ta famille découvre ton métier par un cousin bavard. Le repas de dimanche est tendu comme une corde de violon.", "Tu t'expliques avec calme, ils finissent par applaudir ton courage.", "La dispute éclate entre le fromage et le dessert.", "Mentir sur ta profession"],
  ],
  adulte: [
    ["Ton premier mois sur la plateforme. Les abonnés sont rares, les commentaires sont étranges et ton chat s'invite dans le cadre.", "Ta communauté grandit vite, les revenus grimpent.", "Le compte stagne. Tu doutes de la stratégie.", "Acheter de la publicité douteuse"],
    ["Un proche découvre ton activité. Le téléphone sonne, ta mère laisse trois messages vocaux en majuscules.", "Tu assumes avec honnêteté, la famille te respecte finalement.", "Les relations se tendent pendant des mois.", "Nier en bloc"],
    ["Une fuite de données met en danger ta vie privée. Des inconnus partagent des captures et ton nom circule.", "Tu réagis vite, tu portes plainte, la plateforme te soutient.", "L'affaire s'étale dans la presse. La honte est lourde.", "Fuir quelques mois à la campagne"],
  ],
  casino: [
    ["Une table de poker, cinq joueurs, une pile de jetons de la taille d'un pâté de maisons. Ton adversaire sourit trop, c'est suspect.", "Tu relances avec audace et tu rafles le pot.", "Tu perds tout sur un tapis maudit.", "Compter les cartes discrètement"],
    ["Un client chanceux enchaîne les gains depuis trois heures. La direction t'ordonne de le surveiller.", "Tu repères sa méthode, la direction te félicite.", "Tu l'accuses à tort, le scandale éclate.", "Fermer les yeux contre un pourboire"],
  ],
  nuit: [
    ["Une soirée très agitée dans ton bar. Quatre bagarres, deux déclarations d'amour, un homme qui danse sur le comptoir en chantant l'hymne national.", "Tu calmes tout le monde avec humour et fermeté. Le patron te fait confiance.", "La soirée dégénère, tu finis avec un œil au beurre noir.", "Fermer le bar pour la nuit"],
    ["Une célébrité arrive à l'improviste dans ton établissement. Elle veut rester anonyme et chante déjà au micro.", "La soirée devient légendaire, ton bar est cité partout.", "Un paparazzi s'invite, la star part en colère.", "Vendre l'info au plus offrant"],
  ],
  hacker: [
    ["Une grande entreprise a un système de sécurité réputé impénétrable. Tu y vois un défi, un jeu, un trophée.", "Tu y entres sans effort. Le butin numérique est énorme.", "Un piège te repère. Tu coupes la connexion de justesse.", "Lancer une attaque massive"],
    ["Un inconnu te propose un contrat très bien payé pour un piratage discret. Il refuse de donner son nom, sa voix est étrange.", "Le contrat se passe bien, tu disparais avec ta récompense.", "L'inconnu est un policier. Tu t'en sors de justesse.", "Exiger plus d'argent"],
  ],
  pompier: [
    ["La sirène retentit en pleine nuit. Un incendie dans un immeuble, des fenêtres illuminées et un chat coincé sur un balcon du quatrième.", "Tu sauves le chat et deux habitants. Les voisins pleurent d'admiration.", "Tu t'en sors avec une brûlure légère mais le chat t'a griffé.", "Foncer sans équipement"],
    ["Une inondation s'abat sur la ville. Les rues deviennent des canaux, les voitures flottent, un canard défile avec dignité.", "Tu organises les secours avec brio, la ville te remercie.", "Une erreur de manœuvre met le camion en panne.", "Prendre un raccourci par un tunnel"],
  ],
  militaire: [
    ["Un exercice de nuit en pleine forêt. Il pleut des cordes, la boussole indique le sud-ouest alors qu'on cherche le nord et le sergent chante pour se motiver.", "Tu guides le groupe jusqu'à l'objectif. Le colonel te félicite.", "Tu tournes en rond pendant six heures. Ambiance glaciale.", "Prendre un chemin interdit"],
    ["Une mission humanitaire à l'étranger te demande de distribuer des vivres. La foule est nombreuse, la chaleur écrasante.", "Tu réussis ta mission et reçois une médaille.", "Une erreur de logistique provoque un retard fâcheux.", "Improviser sans ordre"],
  ],
  astronaute: [
    ["Compte à rebours de la fusée. Dix, neuf, huit... Ton collègue a oublié ses chaussettes, le chef de mission les cherche à la radio.", "Le décollage est parfait, la Terre devient une bille bleue.", "Une alerte retarde le lancement de trois mois.", "Improviser une manœuvre"],
    ["En orbite, un câble se détache. Les voyants clignotent, un collègue panique poliment et Houston demande de ne pas toucher à rien.", "Tu répares avec sang-froid. La station est sauvée.", "Une fuite d'air force à une sortie d'urgence.", "Ignorer la procédure"],
  ],
  marin: [
    ["Une tempête s'abat sur le chalutier en pleine nuit. Les vagues font trois étages, le cuisinier chante pour se rassurer et les poissons semblent amusés.", "Tu tiens la barre et ramènes l'équipage au port.", "Une vague emporte une partie de la pêche.", "Couper à travers la tempête"],
    ["Ton filet remonte un objet étrange, couvert d'algues, qui ressemble à un coffre. Le capitaine se frotte les mains.", "Le coffre contient un vrai trésor, que tu partages avec l'équipage.", "Le coffre est vide. Il contient seulement une vieille chaussure.", "Garder le coffre pour toi"],
  ],
  artisan: [
    ["Une fuite d'eau noie la cuisine d'une cliente, à 22 h un dimanche. Elle te regarde comme un sauveur et t'offre un thé qui refroidit.", "Tu répares en vingt minutes. Elle te recommande à tout le quartier.", "Tu inondes aussi le voisin du dessous. Grosse facture.", "Facturer le triple"],
    ["Un chantier de rénovation te réserve une surprise sous le parquet. Une momie de chat, un coffre vide et un trou profond.", "Tu gères la surprise avec bonne humeur, le client est enchanté.", "Le trou s'agrandit, le budget aussi.", "Reboucher sans rien dire"],
  ],
  veto: [
    ["Une dame arrive en larmes avec un perroquet qui répète des insultes apprises auprès du voisin. Elle veut qu'on le soigne de ses « vilains mots ».", "Tu le calmes avec patience, la dame t'offre des chocolats.", "Le perroquet te mord le doigt et insulte ta mère.", "Prescrire une cure de silence"],
    ["Un fermier t'appelle en pleine nuit pour une vache qui met bas. Il pleut, la ferme est loin, le chien aboie dans la nuit.", "Un joli veau naît, le fermier pleure de joie.", "La vache te donne un coup de sabot mémorable.", "Appeler un confrère"],
  ],
  psy: [
    ["Un patient te confie un rêve étrange, avec un crocodile, une tarte et son ancien professeur de maths. Il attend une interprétation brillante.", "Ton analyse l'éclaire, il pleure de gratitude.", "Tu interprètes tout de travers, il quitte le cabinet vexé.", "Inventer une interprétation"],
    ["Un journaliste te demande ton avis sur un phénomène de société. Les caméras sont déjà là, la lumière est crue.", "Ton intervention marque les esprits et tu deviens un expert recherché.", "Une phrase mal comprise déclenche un scandale.", "Refuser de répondre"],
  ],
  pharmacien: [
    ["La pharmacie est pleine. Une vieille dame demande un médicament dont elle a oublié le nom, mais se souvient de la couleur de la boîte.", "Tu devines parfaitement. Elle te remercie et offre des bonbons.", "Tu te trompes de boîte. Heureusement, le médicament est inoffensif.", "Vendre autre chose"],
    ["Une grande chaîne ouvre une officine en face de la tienne et casse les prix avec des affiches fluorescentes.", "Tu fidélises ta clientèle grâce au conseil. Le quartier te reste fidèle.", "Tu perds la moitié de ta clientèle.", "Baisser les prix en dessous du coût"],
  ],
  dentiste: [
    ["Un patient terrifié refuse d'ouvrir la bouche. Il serre les poings, ferme les yeux et récite sa liste de courses.", "Tu le rassures, il en sort détendu, une dent plus propre.", "Il te mord le doigt. Une scène dont on parlera.", "Utiliser une méthode miracle"],
    ["Un confrère jaloux dépose une plainte fantaisiste contre ton cabinet. Un inspecteur arrive avec un carnet et un air méfiant.", "L'inspection se passe parfaitement, ta réputation grandit.", "Le dossier traîne et abîme ton image.", "Offrir un cadeau à l'inspecteur"],
  ],
  detective: [
    ["Une cliente te demande de suivre son mari. Tu le filatures pendant trois jours. Il va à la boulangerie, au parc, puis chez un clown.", "Tu découvres la vérité, la cliente éclate de rire en pleurant.", "Tu te fais repérer à cause de ton chapeau trop voyant.", "Cambrioler le bureau du suspect"],
    ["Une affaire de disparition de chat tourne au scandale de quartier. Trois voisins s'accusent mutuellement et l'un d'eux est un mime.", "Tu retrouves le chat et soudes le quartier.", "Le chat est introuvable, les accusations pleuvent.", "Accuser un innocent"],
  ],
  clerge: [
    ["Une cérémonie de mariage, un marié en retard, une mariée en larmes et une chorale qui chante une demi-heure de trop.", "Tu sauves la cérémonie avec humour. Les familles te remercient.", "Une phrase de travers déclenche un fou rire général.", "Raccourcir le sermon"],
    ["Un villageois te demande conseil pour un différend de clôture. L'affaire dure depuis trois générations.", "Tu réconcilies les deux familles autour d'un gâteau.", "Tu aggraves le litige sans le vouloir.", "Imposer ta volonté"],
  ],
  voyante: [
    ["Un client entre dans ta roulotte. Tu lui dis qu'il rencontrera l'amour. Il t'avoue qu'il est déjà marié depuis vingt ans.", "Tu rattrapes le coup avec une prédiction brillante. Il revient chaque semaine.", "Il te réclame un remboursement en hurlant.", "Prédire sa mort pour l'impressionner"],
    ["Un journaliste vient te défier en direct à la télévision. Tu dois deviner le contenu d'une boîte fermée.", "Tu devines juste par hasard. Tu deviens une star.", "La boîte contient une chaussette, tu dis une orange.", "Tricher grâce à un complice"],
  ],
  vtc: [
    ["Un client monte dans ta voiture à trois heures du matin et te raconte sa vie pendant 40 minutes. Tu apprends qu'il est un roi du pétrole.", "Il te laisse un pourboire digne d'un prince.", "Il vomit sur la banquette arrière.", "Rouler trop vite"],
    ["Une grève bloque la ville. Tout le monde veut une voiture, les prix s'envolent, tu croises un taxi en colère.", "Tu enchaînes les courses et fais ton meilleur mois.", "Tu te fais verbaliser et perds une journée.", "Doubler les tarifs"],
  ],
  explorateur: [
    ["Au fond d'une grotte, ta lampe frontale clignote. Une salle immense s'ouvre devant toi, avec des dessins étranges sur les murs.", "Tu découvres un site inédit, la presse accourt.", "Tu glisses dans une rivière souterraine et perds ton matériel.", "Explorer sans corde"],
    ["Une carte au trésor ancienne te mène sur une île déserte. Tu creuses, tu creuses, tu entends un cliquetis.", "Tu déterres un coffre rempli d'or.", "Tu déterres une boîte de conserve de 1974.", "Partir seul"],
  ],
  paysagiste: [
    ["Un client veut un jardin « zen mais festif », avec une fontaine, un labyrinthe, une piste de danse et trois nains de jardin.", "Le jardin est un chef-d'œuvre, la presse locale s'en empare.", "La fontaine inonde le voisin.", "Planter des fleurs au hasard"],
    ["Un orage détruit la moitié du parc municipal que tu as aménagé. Le maire est furieux, les enfants aussi.", "Tu replantes en un week-end avec une équipe de bénévoles.", "Le maire te rend responsable devant le conseil.", "Accuser la météo"],
  ],
  biblio: [
    ["Un lecteur te rend un livre avec trente ans de retard. Il tient à payer l'amende. Elle fait 3 650 €.", "Tu proposes un arrangement, il fait un don à la bibliothèque.", "Il réclame son argent en hurlant.", "Imposer l'amende"],
    ["Une nuit, un mystérieux livre apparaît dans les rayons. Aucune trace d'auteur, des pages blanches, et un parfum de violette.", "Le livre devient une légende locale, la bibliothèque est comble.", "Le livre disparaît aussi mystérieusement qu'il est venu.", "Le vendre à un collectionneur"],
  ],
  consultant: [
    ["Une grande entreprise t'engage pour « optimiser les synergies ». Tu ne sais pas ce que ça veut dire, mais tu dis oui avec assurance.", "Ton rapport impressionne la direction, la mission est prolongée.", "Ton rapport est truffé d'erreurs, la mission s'arrête.", "Copier le rapport d'un concurrent"],
    ["Un client te demande un diaporama en 12 heures. Il en veut 87 pages, avec des animations, de la musique et un graphique qui bouge.", "Tu livres à l'heure, la direction applaudit.", "Le fichier plante en pleine présentation.", "Tout faire faire par un stagiaire"],
  ],
};

Object.keys(SPEC).forEach((tr) => {
  const T = R.TRACKS[tr];
  if (!T) throw new Error("métier inconnu " + tr);
  SPEC[tr].forEach((spec, i) => {
    const [intro, win, lose, shortcut] = spec;
    const tags = ["travail"]; if (T.mature || T.illicit) tags.push("mature");
    ev("pro_" + tr + "_" + (i + 1), {
      ages: [T.age, T.maxAge || 64], tags, ic: T.ic + "💼", w: 5, need: { job: tr }, once: false, cool: 3,
      t: intro,
      c: [
        C("Foncer, c'est le moment de briller", "🚀", [O(0.5, win, { perf: 9, ambition: 2, repute: 3, bonheur: 4, argent: Math.round(T.levels[0][1] * 0.08), exp: 1 }), O(0.5, lose, { perf: -7, bonheur: -3, sante: T.danger ? -3 : -1, repute: -2 })], { risk: 1 }),
        D("Jouer la prudence", "🛡️", "Tu fais ton travail sans éclat. Rien de grave, rien de glorieux.", { prudent: 2, perf: 1 }),
        C(shortcut, "🥷", [O(0.45, "Le raccourci fonctionne et personne n'y voit rien.", { perf: 5, honnete: -2, creatif: 1 }), O(0.55, "Le raccourci te revient en pleine figure.", { perf: -8, honnete: -2, repute: -3 })], { risk: 1 }),
      ],
    });
  });
});

// Un petit mot d'ambiance pour chaque métier
const FL = {
  foot: ["Un enfant te réclame un autographe sur son ballon dégonflé.", "Ton coiffeur te demande une photo dédicacée pour la vitrine."],
  tennis: ["Une balle perdue atterrit sur un spectateur, il applaudit."],
  rugby: ["Après le match, tu dégustes la plus grande assiette de pâtes du monde."],
  cyclisme: ["Tu croises un troupeau de vaches sur la route. L'une d'elles te dépasse."],
  boxe: ["Ton nez a changé de forme. Ton entraîneur dit que ça te va bien."],
  f1: ["Ton casque a un autocollant de ta grand-mère. Elle est fière."],
  ski: ["Une marmotte te regarde passer, impressionnée ou moqueuse."],
  natation: ["Tu passes cinq heures dans l'eau. Tes doigts ressemblent à des pruneaux."],
  esport: ["Ton chat a gagné une partie à ta place. Il réclame des croquettes."],
  danse: ["Tes pointes sont mortes. Une nouvelle paire est arrivée."],
  coach: ["Un client te remercie avec une boîte de chocolats. Tu hésites."],
  chanteur: ["Un fan chante ta chanson sous ta fenêtre. Faux, mais avec le cœur."],
  dj: ["Ta clé USB s'est retrouvée dans la lessive. Elle a survécu."],
  cinema: ["Un figurant te reconnaît dans la rue et t'offre un café."],
  humour: ["Une blague de ta mamie t'inspire un sketch entier."],
  mannequin: ["Un styliste te demande de porter une robe en spaghettis. Ça tombe, littéralement."],
  createur: ["Ton chat bat tous tes records de vues. Il demande un cachet."],
  photo: ["Un lion de zoo a refusé de poser. Tu as photographié sa queue."],
  peintre: ["Un petit-neveu dessine une œuvre à côté de la tienne. Le critique préfère la sienne."],
  gamedev: ["Un joueur t'écrit pour te dire que ton bug l'a rendu heureux."],
  mode: ["Un fil rebelle a transformé ta robe en nappe. Elle a fait sensation."],
  tatoueur: ["Un client t'apporte son dessin, fait par sa grand-mère. Il est étonnant."],
  coiffeur: ["Un client dort pendant tout le shampoing et ronfle au séchage."],
  patisserie: ["Un client a commandé un gâteau en forme de pigeon. Il est splendide."],
  cabaret: ["Une plume s'est coincée dans l'aspirateur. Le cabaret a eu un petit rire."],
  adulte: ["Ton compte fait un petit bond. Ta comptable fait un grand sourire."],
  casino: ["Un client perd tout et te remercie. Personne ne comprend."],
  nuit: ["Un inconnu danse sur le comptoir depuis une heure et demie."],
  hacker: ["Tu retrouves le mot de passe de ta tante. Elle utilisait « 1234 ».", "Un pare-feu t'a envoyé un message, il te demande de partir poliment."],
  pompier: ["Un chat est descendu tout seul de l'arbre. Tu as pris la photo quand même."],
  militaire: ["Une botte égarée a refait surface. Elle n'était pas de ta pointure."],
  astronaute: ["Tu mets quatre minutes à boire un café en apesanteur. Il était froid."],
  marin: ["Une mouette a volé ton sandwich avec une précision militaire."],
  artisan: ["Un client te donne des tomates de son jardin. Elles sont magnifiques."],
  veto: ["Un chiot t'a léché la figure pendant l'examen. Il a un bon diagnostic."],
  psy: ["Un patient t'offre un livre. Il parle de lui-même, longuement."],
  pharmacien: ["Un client demande une boîte de sourires. Tu proposes du chocolat."],
  dentiste: ["Une enfant te fait un dessin avec des dents pleines de couleurs."],
  detective: ["Ton chapeau mou est sorti d'une soirée en lambeaux. Il a vu des choses."],
  clerge: ["Un enfant de chœur renverse tout le vin de messe. Il te regarde, terrorisé."],
  voyante: ["Tu as prédit de la pluie. Il pleut. Tu es impressionné{|e}."],
  vtc: ["Un client chante à tue-tête sur la banquette arrière."],
  explorateur: ["Une chauve-souris a élu domicile dans ton sac à dos."],
  paysagiste: ["Un nain de jardin a disparu pendant la nuit. L'enquête est ouverte."],
  biblio: ["Un lecteur demande un livre qui n'existe pas. Tu l'écris pour lui."],
  consultant: ["Tu as dit « synergie » douze fois en une réunion. Record personnel."],
};
Object.keys(FL).forEach((tr) => FL[tr].forEach((t) => flash(t, { bonheur: 1 }, { ages: [R.TRACKS[tr].age, R.TRACKS[tr].maxAge || 64], need: { job: tr } })));

}

// ===== 82_vocations.js =====
{
// Les grandes occasions qui lancent une carrière hors du commun
const { ev, flash, O, C, D } = require("../kit");
const R = require("../rules");

// [id, métier, âges, conditions, introduction, acceptation, refus]
const ENTRY = [
  ["vocation_foot", "foot", [15, 19], { stat: { sport: [58, null] }, nojob: true }, "Un recruteur de centre de formation observe tes dribbles dans le tournoi du quartier. Il te tend sa carte, avec un sourire large comme un but ouvert.", "Tu rejoins le centre de formation. Les vestiaires sentent la liniment et le rêve.", "Tu préfères finir tes études. Le recruteur hausse les épaules, tu gardes ton ballon."],
  ["vocation_tennis", "tennis", [14, 20], { stat: { sport: [55, null] }, nojob: true }, "Une ancienne championne, devenue entraîneuse, te voit frapper des balles contre un mur. Elle propose de te prendre sous son aile.", "Tu t'entraînes six heures par jour. Ton coup droit devient redoutable.", "Tu refuses poliment. Le tennis restera un hobby."],
  ["vocation_rugby", "rugby", [16, 22], { stat: { sport: [58, null] }, nojob: true }, "Après un tournoi de rugby scolaire où tu as plaqué tout le monde, un club régional te propose un contrat espoir.", "Tu signes, les pâtes se multiplient dans ton assiette.", "Tu déclines, les genoux te remercient."],
  ["vocation_cyclisme", "cyclisme", [16, 24], { stat: { sport: [60, null] }, nojob: true }, "Une course de village te voit grimper la côte comme un cabri. Un directeur sportif te regarde avec des yeux brillants.", "Tu rejoins une équipe de jeunes coureurs.", "Tu remontes dans ta voiture, le vélo restera un plaisir."],
  ["vocation_boxe", "boxe", [16, 26], { stat: { sport: [58, null] }, tr: { courage: [55, null] }, nojob: true }, "Dans la salle de boxe du quartier, un vieil entraîneur te remarque. « T'as des poings en or, petit » dit-il en mâchant un cure-dent.", "Tu enfiles les gants. Le premier combat arrive vite.", "Tu retournes à ta vie. Les poings en or sont rangés."],
  ["vocation_f1", "f1", [15, 22], { tr: { courage: [60, null] }, nojob: true, money: [2000, null] }, "Un copain t'emmène sur une piste de karting. Tu bats tous les records. Un ancien pilote te propose d'entrer dans une filière de formation.", "Tu fonces. Les week-ends sont désormais des courses.", "Tu gardes ton casque en souvenir et ton permis en poche."],
  ["vocation_ski", "ski", [14, 22], { stat: { sport: [58, null] }, nojob: true }, "Pendant un stage d'hiver, un entraîneur te filme descendre une piste noire en chantant. Il envoie la vidéo à la fédération.", "Tu entres dans l'équipe régionale. La neige devient ton bureau.", "Tu préfères rester sur les pistes vertes, le chocolat chaud t'attend."],
  ["vocation_natation", "natation", [14, 20], { stat: { sport: [58, null] }, nojob: true }, "Au bord de la piscine municipale, une entraîneuse chronomètre ta dernière longueur. Elle regarde sa montre, la secoue, la regarde à nouveau.", "Tu rejoins un club de haut niveau. Les réveils sont à cinq heures.", "Tu restes un nageur du dimanche, ravi{|e}."],
  ["vocation_esport", "esport", [14, 24], { stat: { intel: [52, null] }, nojob: true }, "Tu domines un petit tournoi en ligne, sans bouger de ta chaise. Le capitaine d'une équipe semi-professionnelle t'envoie un message plein de points d'exclamation.", "Tu intègres l'équipe. Tes pouces deviennent ton capital.", "Tu refuses, ta mère est soulagée."],
  ["vocation_danse", "danse", [13, 20], { stat: { sport: [55, null] }, nojob: true }, "Lors d'un gala de fin d'année, une directrice de compagnie te remarque. Elle te laisse sa carte avec un bouquet d'éloges.", "Tu rejoins une compagnie. Les pointes saignent, les sourires brillent.", "Tu gardes la danse pour les soirées. Elle te sourit encore."],
  ["vocation_chanteur", "chanteur", [15, 35], { tr: { creatif: [55, null] }, nojob: true }, "Un casting télévisé passe dans ta ville. Tu chantes sous la douche depuis dix ans. Tes amis te traînent jusqu'à la file d'attente.", "Tu passes l'audition, le jury est conquis. Te voilà chanteur ou chanteuse.", "Tu reprends le bus, ta chanson te suit toute la soirée."],
  ["vocation_dj", "dj", [16, 35], { tr: { creatif: [52, null] }, nojob: true }, "Le DJ d'une soirée tombe malade au dernier moment. On te pousse derrière les platines. Tu ne sais pas faire, mais tu fais.", "La soirée devient culte. On te propose des dates partout.", "Tu rends les platines avec soulagement."],
  ["vocation_cinema", "cinema", [16, 40], { stat: { charme: [58, null] }, nojob: true }, "Une équipe de tournage cherche des figurants dans ta ville. Tu te présentes en plaisantant. Le réalisateur te regarde longuement.", "Il te donne une réplique. Puis deux. Ta carrière est lancée.", "Tu rentres chez toi, un peu rêveur ou rêveuse."],
  ["vocation_humour", "humour", [16, 40], { stat: { charme: [55, null] }, tr: { sociable: [55, null] }, nojob: true }, "À une soirée, tu racontes une anecdote improbable. Tout le monde éclate de rire. Un ami organise une scène ouverte pour que tu récidives.", "Tu fais un carton. Un patron de club te propose une série de dates.", "Tu préfères rire entre amis."],
  ["vocation_mannequin", "mannequin", [15, 30], { stat: { charme: [62, null] }, nojob: true }, "Dans un centre commercial, une agente de mannequins te tend sa carte. Elle te trouve « le regard de la saison ».", "Tu signes avec l'agence. Les premiers castings s'enchaînent.", "Tu rends la carte avec un sourire. Les podiums ne sont pas pour toi."],
  ["vocation_createur", "createur", [13, 40], { tr: { creatif: [50, null] }, nojob: true }, "Une vidéo de toi, faite pour rire, atteint 400 000 vues en une nuit. Ton téléphone vibre sans arrêt.", "Tu te lances à plein temps. Ta caméra devient ton gagne-pain.", "Tu restes anonyme. La vidéo disparaît dans l'oubli."],
  ["vocation_photo", "photo", [16, 45], { tr: { creatif: [55, null] }, nojob: true }, "Une de tes photos de pigeon remporte un concours. Un photographe professionnel te propose de devenir son assistant.", "Tu deviens son assistant. Les objectifs pèsent mais ton œil progresse.", "Tu gardes ton appareil pour les voyages."],
  ["vocation_peintre", "peintre", [16, 50], { tr: { creatif: [60, null] }, nojob: true }, "Une galerie aperçoit une de tes toiles dans un café. Le propriétaire veut en voir d'autres, vite.", "Tu exposes dix toiles. Deux sont vendues le soir même.", "Tu gardes tes toiles pour toi. Elles sont mieux dans ton grenier."],
  ["vocation_gamedev", "gamedev", [16, 40], { stat: { intel: [55, null] }, tr: { creatif: [52, null] }, nojob: true }, "Ton petit jeu bricolé dans ta chambre se retrouve sur un forum. Un studio t'écrit pour te proposer un essai.", "Tu rejoins le studio. Les nuits blanches commencent.", "Tu gardes ton jeu pour le plaisir."],
  ["vocation_mode", "mode", [16, 45], { tr: { creatif: [58, null] }, nojob: true }, "La robe que tu as cousue pour une amie se fait remarquer dans une soirée. Une styliste te glisse sa carte.", "Tu rejoins un atelier de couture. Les aiguilles te piquent mais ton goût s'affine.", "Tu continues à coudre pour tes proches."],
  ["vocation_tatoueur", "tatoueur", [18, 40], { tr: { creatif: [58, null] }, nojob: true }, "Tes dessins, griffonnés sur des nappes, font fureur chez tes amis. Un tatoueur te propose un apprentissage dans son salon.", "Tu entres dans le salon. L'encre devient ton quotidien.", "Tu gardes tes dessins sur le papier. La peau attendra."],
  ["vocation_coiffeur", "coiffeur", [16, 40], { stat: { charme: [50, null] }, nojob: true }, "Tu coupes les cheveux de tous tes amis, avec un talent douteux mais un enthousiasme sincère. Une coiffeuse du quartier te propose un apprentissage.", "Tu apprends le métier, les ciseaux deviennent tes meilleurs amis.", "Tu continues à faire des coupes pour rire."],
  ["vocation_patisserie", "patisserie", [16, 40], { tr: { creatif: [50, null] }, nojob: true }, "Tes gâteaux d'anniversaire font des ravages dans ton entourage. Un pâtissier réputé te propose un stage dans sa boutique.", "Tu intègres la pâtisserie. Les croissants, c'est pour demain, quatre heures.", "Tu restes un pâtissier amateur. Tout le monde en profite."],
  ["vocation_pompier", "pompier", [18, 30], { tr: { courage: [58, null] }, nojob: true }, "Un jour, tu aides à éteindre un feu de poubelle devant ta porte. Le capitaine des pompiers t'invite à rejoindre la caserne.", "Tu intègres la caserne. La sirène fait partie de ta vie.", "Tu laisses les sirènes aux autres."],
  ["vocation_militaire", "militaire", [18, 28], { tr: { courage: [55, null] }, nojob: true }, "Une journée défense et citoyenneté te donne envie d'essayer. Le recruteur sourit en tendant un formulaire.", "Tu t'engages. Tu apprends à plier ton lit au carré.", "Tu gardes tes cheveux longs. Le recruteur soupire."],
  ["vocation_astronaute", "astronaute", [26, 40], { edu: 5, stat: { intel: [65, null], sante: [65, null] }, nojob: true }, "Une agence spatiale recrute des candidats. Tu envoies un dossier sans y croire. Quelques mois plus tard, on t'appelle.", "Tu entres dans le programme. Tu apprends à manger en apesanteur.", "Tu restes sur Terre, le café est meilleur ici."],
  ["vocation_cabaret", "cabaret", [18, 36], { stat: { charme: [58, null] }, tr: { courage: [48, null] }, nojob: true, mature: true }, "Un ami te traîne dans un cabaret pour une soirée. Le patron te remarque et te propose un essai sur scène, avec un clin d'œil.", "Tu montes sur scène. La salle applaudit, ta famille ne sait rien.", "Tu rentres chez toi en riant, le costume t'était trop grand."],
  ["vocation_adulte", "adulte", [18, 40], { stat: { charme: [58, null] }, tr: { courage: [48, null] }, nojob: true, mature: true }, "Un ami te parle d'une plateforme d'abonnements pour adultes. Les revenus de certains font tourner la tête. Tu hésites longuement devant ton écran.", "Tu te lances sur la plateforme. Tes premiers abonnés arrivent, ton secret aussi.", "Tu fermes l'onglet. Tu retournes à ta vie, un peu rêveur ou rêveuse."],
  ["vocation_casino", "casino", [18, 45], { stat: { intel: [52, null] }, nojob: true, mature: true }, "Tu gagnes une grosse somme au poker lors d'un soir de chance. Le directeur du casino t'observe et te propose un poste.", "Tu rejoins le casino. Les jetons tournent, les sourires aussi.", "Tu quittes le casino, ton gain bien rangé."],
  ["vocation_nuit", "nuit", [18, 40], { stat: { charme: [50, null] }, nojob: true, mature: true }, "Un bar du centre-ville cherche un remplaçant en urgence. Tu connais le menu, tu connais les clients, tu acceptes en deux minutes.", "Tu t'installes derrière le comptoir. La nuit t'appartient.", "Tu rentres te coucher, un peu soulagé{|e}."],
  ["vocation_hacker", "hacker", [16, 40], { stat: { intel: [62, null] }, tr: { honnete: [null, 55] }, nojob: true, mature: true }, "Tu trouves une faille dans le site de ton lycée, juste pour voir. Un inconnu te contacte en ligne. Il te félicite et te propose un « travail ».", "Tu entres dans un petit milieu de pirates. L'adrénaline monte.", "Tu patches la faille et tu préviens l'administration. Un héros discret."],
  ["vocation_marin", "marin", [16, 30], { stat: { sport: [50, null] }, nojob: true }, "Pendant les vacances au bord de la mer, un patron de chalutier te propose une saison. Il dit que tu as « le pied marin ».", "Tu montes à bord. La mer te berce, la mer te secoue.", "Tu retournes à terre, la tête dans les nuages."],
  ["vocation_explorateur", "explorateur", [20, 45], { tr: { courage: [58, null] }, nojob: true }, "Un vieil explorateur te lègue sa vieille carte à la mort de ton oncle. Elle montre une grotte que personne n'a encore explorée.", "Tu pars, sac sur le dos. Ton premier voyage commence.", "Tu ranges la carte dans un tiroir. Elle t'attend peut-être encore."],
  ["vocation_detective", "detective", [20, 55], { stat: { intel: [55, null] }, nojob: true }, "Une voisine te supplie de retrouver son chat. Tu le retrouves en quarante minutes. Elle te propose un chèque et de t'appeler « monsieur le détective ».", "Tu ouvres une petite agence. Ton chapeau mou est de rigueur.", "Tu laisses le chat à son bonheur et tes pantoufles à tes pieds."],
  ["vocation_voyante", "voyante", [18, 60], { stat: { charme: [50, null] }, nojob: true }, "Une prédiction faite en plaisantant se réalise le lendemain. Le voisin te regarde avec une admiration inquiétante. Il revient avec ses amis.", "Tu t'installes avec une boule de cristal et un bon sens du spectacle.", "Tu avoues que c'était un coup de chance. Les gens se vexent un peu."],
];

ENTRY.forEach(([id, track, ages, need, intro, accept, refuse]) => {
  const T = R.TRACKS[track];
  const tags = ["travail", "vocation"]; if (T.mature || T.illicit) tags.push("mature");
  ev(id, {
    ages, tags, ic: T.ic + "🌟", w: 3, need, once: true,
    t: intro,
    c: [
      D("Dire oui, c'est ta chance", T.ic, accept, { job: track + ":0", bonheur: 5, ambition: 2, flag: "vocation_" + track }),
      D("Refuser poliment", "🙅", refuse, { bonheur: -1, prudent: 2 }),
      C("Négocier fort pour un meilleur départ", "💬", [
        O(0.45, "Ton aplomb impressionne. On te propose un meilleur contrat dès le départ.", { job: track + ":1", bonheur: 6, ambition: 3, flag: "vocation_" + track }),
        O(0.55, "Ton audace agace. La proposition est retirée.", { bonheur: -4, repute: -2 }),
      ], { risk: 1 }),
    ],
  });
});

}

# Picuite Games

Le site qui réunit tous les jeux, avec une page d'accueil pour choisir.

Jeux inclus pour l'instant, Gaeboub-up (plateau à la Monopoly), Goliathicus (stratégie et bluff), Richissime Destiny (simulation de vie entre amis), Golfouille (golf en 3D sur des terrains générés) Zoomalou (courses de voitures sur des circuits générés) Mauvaises Langues (jeu de soirée de classements déplacés, pour adultes) et Pagaille Party (party game de mini-jeux).

## Lancer en local

    npm install
    npm start

Puis ouvrir localhost, port 3000, dans le navigateur.

## Déployer sur Render

1. Pousser ce dossier sur un dépôt GitHub.
2. Sur Render, créer un Web Service relié au dépôt.
3. Build Command, npm install.
4. Start Command, npm start.
5. Render fournit la variable PORT tout seul.

Une seule adresse sert tout le site. Les jeux sont sur /gaeboub-up, /goliathicus, /richissime, /golfouille, /zoomalou, /mauvaises-langues et /pagaille. La route /health répond quand le serveur est vivant.

## Organisation

- server.js, le serveur du site, il découvre et monte automatiquement chaque jeu.
- public/, la page d'accueil (index.html, style.css, app.js), les logos dans public/logos et le petit bouton de retour pg-back.js.
- gaeboub-up/, goliathicus/, richissime/, golfouille/, zoomalou/, mauvaises-langues/ et pagaille/, un dossier par jeu directement à la racine, sans dossier games. Chaque dossier contient son server.js, son dossier public, ses éventuels dossiers lib, et un fichier game.json qui sert à la présentation sur l'accueil. Tout dossier de la racine qui contient un server.js et un game.json est reconnu comme un jeu (sauf public et node_modules).

Pour envoyer le projet sur GitHub, il suffit de déposer chaque dossier séparément (gaeboub-up, goliathicus, richissime, public), puis les fichiers de la racine. Chaque envoi reste sous la limite de 100 fichiers.

## Une seule base de code

Ce dépôt est la seule source de vérité. Une modification faite dans gaeboub-up, goliathicus ou richissime s'applique directement au site Picuite Games, il n'y a pas de deuxième script à tenir à jour. Les anciens dépôts séparés de chaque jeu ne servent plus.

## Ajouter un nouveau jeu plus tard

1. Créer un dossier à la racine au nom du jeu, par exemple mon-jeu.
2. Y mettre un server.js qui exporte une fonction mount(server, prefix) renvoyant un routeur Express. Le serveur Socket.io du jeu doit utiliser le chemin prefix + "/socket.io", et le client doit se connecter avec ce même chemin.
3. Ajouter un game.json (nom, accroche, présentation, étapes, couleurs, ordre) en copiant celui d'un autre jeu.
4. Déposer son logo en SVG dans public/logos/ sous le nom de son dossier, par exemple mon-jeu.svg.
5. Ajouter dans la page index.html du jeu le script /pg-back.js pour avoir le bouton de retour vers l'accueil.

La carte du jeu apparaît toute seule sur l'accueil, à la place réservée.

## Richissime Destiny, mise à jour

Troisième mise à jour de Richissime Destiny, pour des parties moins moyennes.

- Des destins extrêmes. Chacun place son argent de son côté. Seuls de rares krachs touchent tout le monde d'un coup, dont un grand krach très rare qui frappe aussi l'immobilier et les entreprises. Le livret ne rapporte parfois rien, les cryptos font perdre le plus souvent mais peuvent être multipliées par plus de dix, et il existe des jackpots de start-ups et d'entreprises. Deux voies mènent à des fortunes indécentes, de plusieurs centaines de millions à des milliards. La voie légale est une chaîne d'étapes (scale-up, groupe national, bourse, marché mondial, première entreprise du monde). La voie illégale passe par la mafia, le poste de parrain puis un cartel. Chaque étape ouvre la suivante, et à tout moment un empire peut s'effondrer d'un coup ou un réseau tomber avec des peines de prison très lourdes. Des choix comme le pari fou et l'emprunt démesuré donnent aussi des fins en dettes énormes.
- Des réactions. Quand on a été volé, calomnié, trompé ou arnaqué, on peut porter plainte l'année suivante, et démentir une rumeur. Après une partie perdue, on peut demander une revanche, double ou rien. Ces réactions ne sont pas proposées à chaque fois.
- Du blackjack pour de vrai. Quand un défi de blackjack est accepté, une table s'ouvre avec de vraies cartes tirées dans un paquet. Chacun tire ou reste, et le plus proche de 21 gagne. La main de l'adversaire n'est jamais envoyée avant la fin. Les robots et les absents jouent à ta place avec une stratégie simple. Il n'y a plus de poker et plus de réglage à ce sujet. On mise toujours de l'argent, la somme est choisie par celui qui lance le défi, et un robot ne peut pas refuser.
- Des scènes collectives irrégulières. Le tirage est aléatoire, avec parfois deux années de suite puis plusieurs années sans rien, mais jamais plus de sept années sans scène. Cinq années sans scène arrivent rarement au réglage normal. Le réglage propose Fréquentes, Normales, Peu fréquentes et Rares. Les enjeux suivent la fortune des joueurs présents, avec parfois un coup exceptionnel.
- Des habitudes qui comptent. Répéter la salle de sport, une formation, la lecture, une langue ou le théâtre installe des qualités, avec des paliers à trois, six et dix ans et des déclics aléatoires. La salle de sport fait grimper le charme, une formation fait grimper l'intelligence, et les stats influencent les salaires proposés.

Quatrième mise à jour, pensée pour plus de cohérence et de rapidité.

- Moins de réglages. La partie commence toujours à 8 ans, et le réglage de l'âge de départ a disparu. Par défaut, il n'y a pas de limite de temps pour noter une vie, on peut se noter soi-même, les thèmes adultes et les coups bas sont autorisés, et l'héritage entre joueurs est désactivé.
- Une nouvelle bande de prénoms. Les personnages secondaires portent plus souvent les prénoms de la bande (environ quatre sur cinq au réglage par défaut), avec la nouvelle liste.
- Des centres d'intérêt qui se construisent. Chaque année passée sur un domaine (sport, arts, musique, vidéo, études, affaires, vie sociale, nature, cuisine...) renforce l'intérêt pour ce domaine. Une passion est presque toujours proposée sous une forme ou une autre, et elle ouvre les métiers qui vont avec. Les métiers de passion (sport de haut niveau, ski, chant, cinéma, création de contenu...) ne sont plus proposés à quelqu'un qui ne s'y est jamais intéressé.
- Des parcours en boule de neige. Un parcours sportif (section sport-études, centre de formation, contrat professionnel, vedette), un parcours cinéma (courts métrages dans le garage, festival, producteur, rôle principal, star mondiale) et un parcours musique (groupe de garage, premiers concerts, label, tube, stades du monde entier). Chaque marche réussie ouvre la suivante, chaque marche peut échouer (blessure grave, fiasco, scandale) et faire retomber, et le nombre d'essais par marche est limité.

Cinquième mise à jour, centrée sur les relations et sur la liberté de choix.

- Un bouton Quitter mon emploi est toujours visible dans l'année quand on travaille, même en apprentissage. Partir fait perdre le salaire de l'année, et la recherche d'emploi est proposée tout de suite.
- Les choix risqués ne tournent pas pareil deux fois. Les chances dépendent de l'intelligence, de l'ambition et de la prudence, mais aussi de ce qu'on a déjà vécu avec ce choix. Après un échec on retient parfois la leçon, après une série de succès la chance finit par tourner. Les choix sans hasard réservent maintenant de bonnes et de moins bonnes années.
- Chaque autre joueur a un rôle bien lisible dans l'onglet Proches et dans la liste des joueurs. On y trouve meilleur ami, ami, camarade, allié, ex, conjoint, rival, ennemi juré, ainsi que les dettes entre joueurs, les sociétés communes et les derniers événements entre vous deux.
- Les rivalités ont de vraies conséquences. Quand la rivalité monte, des incidents arrivent même sans action, avec des clients perdus, des procès, des rapports qui nuisent à un poste, des biens saccagés et, tout en haut, des violences. Les coups bas ont changé d'échelle avec ruiner ses affaires, faire perdre son emploi, déterrer son passé, tendre un piège, saccager ses biens et, pour les parties très sombres, mettre un contrat sur une tête. La réussite dépend du rapport de force entre les deux joueurs. La vengeance, qu'elle réussisse ou non, coûte maintenant de l'argent à l'un ou à l'autre.
- Les liens positifs comptent aussi. On peut sceller une alliance, éponger les dettes d'un proche, ouvrir son carnet d'adresses, financer un projet ou partager un secret. Un allié prend ta défense, vient à ton secours quand les dettes s'accumulent, et sa trahison est brutale. Un secret partagé peut se retourner contre toi si vous vous fâchez.

Sixième mise à jour, centrée sur la vie entière, les statuts et la carrière.

- Beaucoup plus de causes de mort. La liste compte désormais plus de cent trente causes, des accidents de la route aux situations rarissimes. Elles tombent à des fréquences très différentes, et environ une vie sur dix s'arrête par un coup du sort entre 8 et 85 ans. Les improbables sont vraiment improbables.
- Un vote final qui regarde la vie. Les joueurs automatiques notent d'abord ce que la vie a raconté, avec ses moments les plus lourds, et seulement ensuite la fortune. Les moments clés de la fiche de vie reprennent les faits qui comptent vraiment, comme de longues années de prison, un mariage, un deuil, une ruine ou une ascension. Un registre suit ces faits pendant toute la partie.
- Plus de cagnotte commune vide. Les scènes collectives sont passées à plus de cent cinquante événements, répartis sur seize mécaniques différentes, comme les expéditions, les paris, les tribunaux, les fêtes, les épreuves, les négociations et les crises. Chaque joueur y a un vrai choix et les résultats changent d'une scène à l'autre.
- Des statuts qui comptent. Un rival juré, un ennemi, un conjoint ou un détenu reçoit des actions bien à lui, dont des vendettas, des contrats sur une tête, des demandes en mariage, des voyages de noces, des scènes de jalousie, des colis et des avocats pour un détenu, et des évasions. Les autres joueurs réagissent aussi à ton statut. Après des années de prison, le conjoint peut partir, les amis s'éloignent, les ennemis en profitent, et une scène marque la libération.
- Les clics ne sont plus perdus. Quand le chrono s'arrête avant de valider l'année, le choix de vie, l'option professionnelle et l'action envers un autre joueur déjà cliqués sont retenus. Une année vide n'arrive plus qu'en l'absence de tout clic.
- Des études qui comptent vraiment. Après le lycée, l'apprentissage ou le bac, on choisit une spécialisation parmi soixante-treize filières, par exemple arts du spectacle en lycée professionnel ou en apprentissage pour devenir acteur, cuisine, mécanique, soins, informatique, sport études, droit des affaires ou chirurgie. Chaque année dans la filière fait progresser les qualités du domaine. À la sortie, les métiers du domaine sont proposés bien plus souvent, avec un meilleur salaire et un niveau de départ plus élevé, et la fiche professionnelle démarre avec de la compétence et un carnet d'adresses. L'apprentissage mène à un diplôme.
- Un onglet Professionnel. Tout ce qui fait avancer une carrière ou rapporte de l'argent quitte la liste des choix de vie et passe dans un onglet à part. On peut y faire un choix en plus de son choix de vie. Les options dépendent de l'activité du moment, avec des menus propres aux métiers sérieux, aux métiers manuels, à la scène, au sport, aux indépendants, aux chefs d'entreprise, au milieu, à la mafia, aux études, à l'apprentissage, à la recherche d'emploi, à la retraite et à la détention.
- Une fiche de carrière qui change l'avenir. Chaque joueur a quatre jauges. La compétence ouvre les promotions et les augmentations. Le réseau améliore les offres d'emploi. La réputation compte pour les promotions et pour le respect dans la mafia. La pression policière augmente le risque d'arrestation et de chute, et retombe quand on se fait discret, qu'on blanchit ou qu'on arrose les bonnes personnes. Chaque option indique ce qu'elle construit, son risque, son coût et si elle est illégale.
- Un nouveau réglage, le nombre d'options professionnelles par année, de trois à sept, avec son explication dans le salon.
- Le bouton Quitter mon emploi est maintenant dans l'onglet Professionnel.

Septième mise à jour de Richissime Destiny, centrée sur le rythme, la prison, la mafia et la cohérence des carrières.

- Un mode cinq ans par cinq ans. Dans le salon, le réglage Rythme de la partie propose Année par année ou Cinq ans par cinq ans. Dans ce second mode, tu choisis un cap pour l'année, puis quatre années passent toutes seules en suivant ce cap, et tu ne réponds qu'aux décisions clés qui changent vraiment une vie, comme un départ à l'étranger, créer une entreprise, un enfant ou une promotion, une crise de couple, un burn-out, un héritage, une proposition louche, un parent âgé, la retraite et les derniers vœux. Les petites scènes sans enjeu sont jouées automatiquement. Les décisions clés en attente (embauche, rencontre, choix d'études) sont gardées pour ta prochaine année de choix. Le bilan affiche Les années en bref, avec le patrimoine année par année et les faits marquants. Un réglage donne le nombre de décisions clés par étape, de deux à six. Quand il y a trop peu de décisions clés à ton âge, tu en reçois moins plutôt que des choix sans intérêt.
- Un bouton d'accélération qui s'arrête vraiment. L'accélération est un seul interrupteur, l'arrêt est immédiat, et un joueur humain ne passe plus en pilote automatique à cause de l'accélération, ce qui réglait les votes mal comptés.
- Les joueurs automatiques portent les noms des cinquante plus grandes stars du monde, de façon permanente. Ces noms sont inventés, dans le style des stars (acteurs, chanteurs, sportifs, créateurs). Je n'ai pas mis de vrais noms parce que ces personnages se retrouvent en prison, dans la mafia ou morts de façon absurde, ce qui ne se fait pas avec de vraies personnes. Pour les remplacer, il suffit de modifier le fichier lib/stars.js.
- Une prison et une mafia beaucoup plus profondes. Argent propre et argent sale (le sale se dépense d'abord pour les options illégales, se blanchit avec des frais, et peut être saisi), clans de prison, alliances, balance, évasion, gardiens corrompus, libération conditionnelle, organisation à la sortie et vie après la peine. Les choix pèsent sur la suite. Le couple peut partir, les amis s'éloignent, et une partie de l'argent est saisie.
- Des carrières cohérentes. Les stars vivent à Los Angeles, Las Vegas ou dans les grandes villes qui conviennent, les sportifs jouent dans de vrais clubs, et des raccourcis risqués et coûteux permettent de devenir star ou sportif d'élite plus vite, avec de vraies chances d'échouer.
- Le logo rond de Picuite Games, sans texte, est posé au milieu à gauche de l'écran dans tous les jeux.

## Goliathicus, mise à jour

- Le mode Conquête n'a plus d'œuf. Seules les reliques comptent, et on est éliminé quand plus aucune pièce ne peut bouger. Un réglage permet de remettre l'œuf si on le souhaite.
- Beaucoup plus de points possibles. L'objectif de reliques monte jusqu'à 100 points, avec des paliers à 40 et 60, pour de longues guerres de position.
- Cinq nouvelles pièces spéciales, avec le Fantôme déjà présent. Le Cavalier Fougueux avance d'une ou deux cases. L'Assassin est très fragile en défense mais élimine tout jusqu'au Dragon quand il attaque, sauf le Roi. Le Reflet renvoie le coup, et les deux pièces disparaissent. La Chauve-souris Géante vole sur trois cases par-dessus les lacs et les ruines. Le Golem de Pierre est presque aussi fort qu'un Sorcier, mais se repose après chaque déplacement.
- Un nouveau mode de composition, la Légion des merveilles. Tout le monde a le même noyau d'armée classique, et chacun choisit en secret ses pièces spéciales pour les places libres. Les places non remplies deviennent des Gardes.
- Les pièces spéciales sont aussi disponibles dans la composition sur mesure, avec le budget. Le réglage Pièces spéciales les autorise ou les interdit partout.

## Huitième mise à jour de Richissime Destiny

Cette version rend la vie plus cohérente, plus piquante et un peu moins facile.

- Les proches comptent enfin. Un nouveau panneau de l'agenda permet d'agir sur ton conjoint, un ex que tu veux reconquérir, tes amis, tes rivaux ou ta famille. Les idées apparaissent surtout quand le lien est très fort ou très faible. On peut organiser une soirée, un voyage, demander un service, proposer une affaire, présenter des excuses, tourner la page, lancer un défi ou jouer un mauvais tour. Les robots s'en servent aussi.
- La mafia a maintenant une vraie échelle à six grades, de recrue jusqu'à parrain. Chaque grade rapporte davantage. Un parrain gagne des millions par an, et les trois niveaux de cartel poussent les gains jusqu'à plusieurs dizaines de millions par an, pour un des plus gros réseaux du monde. La chute reste possible et coûte très cher.
- La justice est moins sévère. Les petites peines donnent souvent du sursis avec une amende, et les longues peines sont un peu réduites. Les évasions et les coups de filet gardent leur poids.
- L'argent est moins facile au début de la vie. Les dépenses de base et les petits gains ponctuels ont été revus. Les stars, les grands sportifs et les très grosses sommes ne sont pas touchés.
- Un réglage Caractère des joueurs automatiques permet de choisir des robots sages, piquants ou sans pitié. Les piquants prennent des risques de vie, entrent dans la mafia, vont en prison, nouent des alliances et déclenchent des rivalités.
- Le mode accéléré joue maintenant comme toi. Il retient tes habitudes, tes types de projets, ton goût du risque et tes placements, puis il choisit des vrais projets de vie, investit, retire de l'argent en cas de besoin et rembourse tes dettes.
- Le train de vie compte. Le luxe et la démesure donnent du bonheur, de la réputation, du charme et un réseau qui grandit, avec des rencontres utiles, mais aussi des dépenses qui dérapent et des scandales. La vie sobre fait économiser et rend prudent. Chaque option est expliquée en détail dans le panneau Mon argent.
- La réputation pèse davantage sur les promotions, les salaires proposés et les collaborations. Elle remonte plus vite quand elle est basse, et deux nouvelles idées permettent de la soigner, l'engagement dans une association et la remise en état de ton image.
- Les noms des vedettes viennent de ta liste, avec le bon genre. Les clubs de football et de rugby sont rangés par division, de la quatrième division jusqu'à l'élite.
- Les réglages ont été simplifiés. Les options qui étaient toujours réglées de la même façon ont disparu de l'écran.

## Neuvième mise à jour de Richissime Destiny

- Les morts imprévues sont un peu moins fréquentes.
- Si ton personnage meurt avant 55 ans, tu reprends en main la vie d'une IA tirée au hasard, dans l'état où elle se trouve, riche ou endettée. Ta partie d'origine reste celle qui compte pour le classement. Un bandeau le rappelle à gauche.
- Les actions simples, celles qu'on choisit rarement comme l'année tranquille, bosser dur, le théâtre ou un trek, rapportent davantage. Elles gagnent des bonus et, de temps en temps, un vrai coup de chance. Bosser dur peut maintenant rapporter une prime ou faire monter ta performance.
- Les actions envers les proches ne sont plus dans les idées de l'année. Dans l'onglet Proches à gauche, clique sur le prénom d'un proche pour ouvrir ses actions possibles.
- Le mode accéléré crée maintenant des liens avec les autres joueurs, dans le ton de ta personnalité, et continue à jouer dans tes habitudes.
- Cinq parcours très rares, avec une suite de choix à réussir un par un. La voie divine passe par la secte, les fidèles, le temple, le prophète, le miracle puis l'ascension. Un dieu ne vieillit plus et bénit ou éprouve chaque année l'un des autres joueurs. Il y a aussi la politique jusqu'à la présidence, la conquête spatiale jusqu'à Mars, la recherche jusqu'au prix Nobel et la famille royale jusqu'au trône.

## Dixième mise à jour de Richissime Destiny

- Un seul conjoint à la fois. Si tu es en couple avec un autre joueur, l'ancien conjoint personnage devient un ex. Il n'y a plus de doublon.
- Les actions envers les proches ne concernent plus les parents. Elles couvrent les frères et sœurs, le rival, le meilleur ami ou la meilleure amie, les amis, puis ceux qui arrivent en cours de route comme les ex, les béguins, les enfants et les stars.
- Chaque type de proche a ses propres actions. On peut proposer à un ami ou à un béguin de se mettre en couple si on est seul. On peut tenter de contacter une star, ce qui peut marcher, et si elle recale on perd le contact. Si le contact existe, on peut lui proposer une collaboration.
- Quand les dépenses de l'année dépassent l'argent disponible, les placements vendus pour couvrir le manque sont maintenant annoncés dans le bilan, avec le montant et le type de placement. Les impôts et charges d'une grande fortune sont eux aussi affichés.

## Onzième mise à jour de Richissime Destiny

- Un parcours professionnel réussi se voit enfin sur le personnage. Plus le poste est haut, plus les compétences, le réseau et la réputation ont un niveau minimum élevé. Chaque promotion les fait monter d'un coup. Pour les métiers de la célébrité comme le cinéma, la musique ou le sport pro, la réputation et le charme suivent encore plus vite. Une légende du cinéma n'a donc plus une réputation à 40.

## Douzième mise à jour

- Correction d'un blocage de Richissime Destiny. Après une coupure de connexion très brève, la page ne se rattachait pas à la partie. Les clics ne partaient plus, l'écran ne bougeait plus et le serveur finissait par te croire absent. La page se rattache maintenant à chaque reconnexion, et elle redemande l'état de la partie toutes les douze secondes.
- Un ancien lien de connexion qui se ferme en retard ne peut plus écraser la nouvelle connexion du joueur. Cela vaut pour Richissime Destiny et pour Goliathicus.

## Treizième mise à jour (Goliathicus)

- Nouvelle taille de plateau, la Grande. Chaque camp compte 40 pièces au lieu de 24. Le duel se joue sur 15 lignes et 10 colonnes, et la croix à 3 ou 4 joueurs sur 18 par 18. Les lacs sont adaptés, il reste toujours des passages. Le réglage se trouve dans la taille du plateau, avec une durée indiquée d'environ une heure.
- Sur la Grande, toutes les armées toutes prêtes, la Légion des merveilles et les préréglages existent aussi, avec les mêmes proportions que la taille normale. Le budget de l'armée sur mesure grandit avec le nombre de pièces, pour que le réglage reste cohérent.
- Les IA ont maintenant une mémoire de leurs trajets. Une pièce évite de revenir sur les cases qu'elle vient de quitter, ce qui supprime la plupart des allers-retours.
- Les IA suivent un plan. Une pièce et une cible sont choisies, puis gardées tant que c'est intéressant, au lieu de changer de pièce à chaque tour. Le plan est abandonné si la cible disparaît ou si le coup devient trop risqué.
- Les IA ripostent. Quand une pièce ennemie dangereuse est connue, par exemple un Roi qui ravage le camp ou un gros bras près de l'œuf, la pièce la moins précieuse qui la bat à coup sûr part à sa rencontre. Un Rat avance vers un Roi connu en contournant les lacs, même au prix d'un risque. Les autres pièces ne le gênent plus.
- Les IA voient mieux le danger. Elles regardent aussi les lignes de tir des éclaireurs, comparent la case d'arrivée à la case de départ, mettent à l'abri une pièce menacée et pensent à ne pas se faire reprendre juste après une capture.
- Sur des parties entre anciennes et nouvelles IA, le niveau Dragon gagne environ deux parties sur trois, le niveau Chevalier un peu plus d'une sur deux, et le Roi Stratège reste à égalité, ce qui est attendu car il était déjà le plus fort.

## Quatorzième mise à jour, deux nouveaux jeux

Deux jeux arrivent sur l'accueil, Golfouille et Zoomalou. Ils partagent un petit socle commun dans le dossier common (salon, réglages expliqués, bots, chat, 3D avec three.js), ce qui garde le même esprit que les autres jeux. Chaque réglage est modifiable dans le salon et expliqué juste dessous.

### Golfouille

- Golf en 3D avec des terrains générés à l'infini. Un bouton Générer un autre terrain dans le salon montre un aperçu, et Jouer ce parcours fixe la graine pour que tout le monde joue exactement le même trou.
- Huit biomes (prairie, désert, neige, jungle, volcan, plage, bonbons, cosmos), chacun avec son décor et ses obstacles.
- Course au trou. Le premier arrivé marque le plus de points, et l'on joue en tour par tour ou tous en même temps selon le réglage.
- Plusieurs clubs (driver, fer, cale, lob, putter) avec des portées et des trajectoires différentes, une jauge de puissance à maintenir, une aide de visée réglable (aucune, points ou trajectoire).
- De petits pouvoirs ramassés sur le terrain pour gêner les autres, avec un choix de cible. Leur fréquence et leur apparition se règlent.
- Bots à quatre niveaux, reconnexion, mode solo.
- Le serveur calcule chaque coup avec la même physique que le client, donc personne ne peut tricher sur la distance.

### Zoomalou

- Courses de voitures sur des circuits générés à l'infini, inspirées de Trackmania Turbo, avec des graphismes volontairement simples.
- Sept biomes (côte, désert, neige, forêt, volcan, bonbons, néon), des sols différents (bitume, terre, glace, sol collant), des tapis turbo, des bosses à sauter et des points de contrôle.
- Cinq voitures, Bolide, Rallye-Pote, Pétard, Toupie et Bouboule, chacune avec ses forces. Le premier joueur, l'hôte, choisit la voiture de tout le monde au garage avant chaque course, pour que la course reste équitable.
- Mode essence. Chaque pilote pose d'abord un temps. Ensuite le dernier du classement joue avec toute son essence pour battre l'avant-dernier. Tant qu'il reste dernier c'est encore à lui, et sans essence il est éliminé. Dès qu'il passe devant, le nouveau dernier joue à son tour. La manche s'arrête quand il ne reste que le meilleur temps, qui gagne, ou quand un pilote abandonne si le réglage le demande.
- Réservoir. Il se règle de deux façons, en multiple du meilleur temps posé ou en secondes fixes. Chaque pilote a son propre réservoir pour toute la manche et il ne se remplit pas. Un essai abandonné coûte l'essence déjà brûlée.
- Deux modes chrono. Dans le chrono fantôme tout le monde part en même temps depuis la même ligne, les voitures des autres sont transparentes, et le meilleur temps de chacun compte. Dans le chrono contact les voitures sont solides et se gênent.
- Fantôme du record avec écart en direct, retour au dernier point de contrôle, caméras multiples, commandes clavier, tactiles et manette.
- Les temps sont rejoués par le serveur à partir des touches envoyées, sauf si l'on choisit de faire confiance aux joueurs dans les réglages.

## Quinzième mise à jour, version finale de Golfouille et de Zoomalou

### Golfouille

- Nouvelle visée. Un simple toucher sur le terrain, ou sur la carte en haut à gauche, vise ce point. Le jeu choisit le club et règle la force pour que la balle s'y arrête, et tu peux ensuite tout changer à la main.
- Prévision complète du coup. Le trait blanc montre le vol, le jaune le roulé, un cercle montre où la balle retombe et un autre l'erreur possible du coup. Des pastilles signalent les obstacles touchés, l'eau, la lave et les moulins ou barrières en mouvement. Le texte au-dessus des clubs donne la distance de vol, la distance d'arrêt, ce qui restera jusqu'au trou et la nature du sol sous la balle. Le réglage Aide à la visée permet de garder la trajectoire complète, la direction seule ou rien du tout.
- Vue du dessus (bouton carte ou touche V) pour voir toute la trajectoire et toucher la cible. Bouton caddie (touche C) pour que le jeu vise vers le trou et choisisse le club conseillé.
- Clubs expliqués. Chaque bouton de club affiche sa portée réelle en mètres depuis l'endroit où se trouve la balle, un club conseillé est signalé, et changer de club garde le même point visé. La jauge de force affiche le pourcentage et la distance, avec des boutons plus et moins.
- Repère du trou toujours visible, avec la distance, même hors de l'écran. Petit tutoriel au premier coup, qu'on peut revoir dans le menu.
- Nouveau barème de points, identique partout et expliqué à l'écran. Le premier dans le trou gagne 10 points, puis 7, 5, 3, 2 et 1. Un trou en un ajoute 5 points. Dans le décompte Arrivée et coups, chaque coup sous le par ajoute 2 points. Dans le décompte aux coups il n'y a pas de points et le moins de coups gagne. Le détail de chaque trou s'affiche à la fin du trou, avec la place, les coups, le bonus et le total.
- Correction. L'ordre d'arrivée se calcule maintenant à l'instant exact où la balle tombe dans le trou, et non plus à la prochaine seconde du serveur.
- Messages clairs après chaque coup (birdie, par, plouf, hors limites), compte à rebours visible quand le trou va se terminer, et trophées de fin de partie (plus long coup, roi du chaos, cible favorite, plongeur de l'année, collectionneur d'orbes, trou en un).

### Zoomalou

- Commandes aux quatre flèches. Haut pour accélérer, bas pour freiner puis reculer, gauche et droite pour tourner. Entrée recommence l'essai depuis le départ et Maj ramène au dernier point de contrôle. Les touches sont rappelées dans le garage et en course.
- Voiture choisie par l'hôte pour tout le monde, sans réglage. Elle se choisit au garage avant chaque course.
- Correction du bug d'essence avec les pilotes automatiques. Ils jouaient tous leurs essais d'un coup en cachette, ce qui vidait la jauge dès le début de leur tour. Ils roulent maintenant en direct, essai après essai, avec une jauge qui baisse vraiment. Ils abandonnent un essai quand ils sont en retard sur le record, ou insistent jusqu'à l'arrivée selon leur niveau.
- Nouveau réglage Vitesse des tours des pilotes automatiques (normale, deux fois ou quatre fois plus vite) pour ne pas attendre quand ils ont un grand réservoir.
- Le tableau de fin de course indique le nombre d'essais de chaque pilote.

## Seizième mise à jour, Zoomalou, les pilotes automatiques et les circuits géants

- Roues. Chaque roue tournait autour du centre de la voiture au lieu de tourner sur elle-même, ce qui les faisait partir dans tous les sens dès que la course se lançait. Elles tournent maintenant sur place, avec un petit moyeu blanc, et les roues avant se braquent quand on tourne.
- Essence. Quand la jauge est vide, l'essai en cours va toujours jusqu'au bout et peut encore battre le record. Seul le prochain essai est refusé. Si le record ne peut plus être battu, l'essai s'arrête de lui-même. Les pilotes automatiques suivent la même règle.
- Pilotes automatiques refaits. Un pilote étudie le circuit sans le connaître d'avance. Il calcule la trajectoire qui coupe les virages au plus court, déduit la vitesse possible en chaque point d'après sa voiture et le sol, puis se règle en se faisant rouler des centaines d'essais sur le vrai moteur. Il peut aussi s'inspirer de la trajectoire d'un meilleur temps existant, humain ou non, et teste si ça va plus vite. À chaque essai raté en mode essence il prend un peu plus de risques. Sur 200 circuits de test le niveau Prodige est environ 17 pour cent plus rapide qu'avant, et les trois autres niveaux ont gagné autant ou plus, tout en gardant des écarts nets entre eux. Les pilotes étudient le circuit pendant le garage.
- Deux modes chrono. Le chrono fantôme garde des voitures transparentes qui ne se touchent pas. Le chrono contact rend les voitures solides, on se pousse et on se bloque. Dans les deux, le départ est commun et se fait côte à côte sur une ligne très large, avec le même compte à rebours pour tous.
- Chocs vérifiés. En chrono contact chaque navigateur note les chocs reçus, et le serveur les rejoue avec les commandes pour confirmer le temps. Les pilotes automatiques roulent sur leur trajectoire et ne se laissent pas pousser.
- Les pilotes automatiques roulent en continu en chrono, essai après essai, et leurs voitures sont visibles sur la grille dès le départ.
- Circuits plus longs. Deux nouvelles longueurs, Très long et Géant, qui montent jusqu'à environ 4 kilomètres. Le générateur sait maintenant reculer quand un circuit se coince, ce qui évite les circuits trop courts.
- Décor retravaillé. Ciel avec soleil et nuages, montagnes à l'horizon, lignes peintes de départ et d'arrivée, feux avant et arrière, bandes de course, particules d'ambiance selon le biome (neige, braises, lucioles, poussière, confettis) et effet de vitesse sur les bords de l'écran.

## Dix-septième mise à jour, Golfouille, gros rework des clubs et de la visée

- Clubs triés du plus puissant au moins puissant. La colonne va de la Fusée au Putter, chaque bouton affiche sa portée réelle depuis la balle et une petite barre de puissance. Les touches 1 à 7 suivent le même ordre.
- Chaque club a une fiche claire. Elle donne son rôle, trois notes en pastilles (puissance, hauteur, précision) et une phrase sur son vol. Le driver est dit tendu et bas, donc il cogne facilement un arbre. La cale et le lob sont dits hauts et passent au dessus des obstacles.
- Hauteur du tir réglable. Chaque club se joue de très bas à très haut, avec les flèches à côté des clubs, les touches R et F, ou Alt avec la molette. Un tir bas file droit et roule mais cogne les obstacles, un tir haut les passe. La force est recalculée pour garder le même point visé. Le serveur contrôle la hauteur reçue. Le ricochet et le putter ont une hauteur fixe.
- Nouveau réglage Hauteur du tir réglable. Décoché, chaque club garde son angle habituel pour tout le monde.
- Interface dégagée. Les clubs ne sont plus au milieu de l'écran mais dans une colonne sur le côté, la fiche du club est en haut à gauche, la carte passe à droite sur grand écran, et le centre reste libre pour voir où l'on tire. Sur téléphone la colonne devient compacte avec icônes et portées.
- Aide à la visée repensée. Le nouveau mode par défaut, Zone d'arrivée, montre l'arc de la balle jusqu'à son atterrissage et un grand cercle où elle devrait finir, avec une distance arrondie. Il ne montre ni rebonds ni obstacles touchés, et prévient seulement quand quelque chose se trouve sur la route ou qu'un danger est proche. L'ancien mode complet devient Trajectoire exacte, pour apprendre. Direction seule et Aucune restent disponibles. Le réglage s'applique à tous les joueurs.
- Les bots Gaillard, Champion et Prodige essaient eux aussi des tirs plus hauts ou plus bas selon les obstacles.
- Aide, tutoriel et menu réécrits pour expliquer les clubs, la hauteur et la nouvelle aide.
- Limites connues. Le bot Mou du genou ne règle pas la hauteur. Les tirs de la zone d'arrivée dépendent des moulins et barrières qui bougent, donc l'aide reste approximative par construction.

## Dix-huitième mise à jour, nouveau jeu, Mauvaises Langues

- Un jeu de soirée pour adultes, de 3 à 8 joueurs, sans bots puisqu'ils ne joueraient pas. À chaque manche, un joueur reçoit une question secrète du genre qui est le plus susceptible de finir riche, et classe tout le monde, lui compris. Les autres voient le classement et votent pour la vraie question parmi quatre.
- Une base de 745 questions écrites pour le jeu, sur 13 thèmes, sexualité, bêtises et honte, hygiène de vie, amour et drague, soirées et alcool, mensonges et secrets, physique et ego, argent, téléphone et réseaux, boulot et études, personnalité, futur et chaos. Chaque question a un niveau de piment, taquin, épicé ou déplacé. Les questions vivent dans mauvaises-langues/questions, un fichier par thème, pour en ajouter facilement plus tard.
- Réglages expliqués dans le salon. Niveau de piment (doux, équilibré, épicé, infernal), thèmes autorisés, changements de question par manche, type de questions leurres (mélangées, même thème, au hasard), temps pour classer, voter et lire le dévoilement, points pour une bonne réponse, points du classeur, affichage des votes nominatifs et réactions en emojis.
- Dévoilement. On voit le classement, la vraie question, qui a voté pour quoi, les points gagnés et quelques phrases piquantes sur le premier et le dernier. Les joueurs peuvent envoyer des emojis qui montent à l'écran.
- Fin de partie avec podium, tableau, titres (le chouchou, le bouc émissaire, le meilleur détective, l'énigme, le livre ouvert), champion et dernier de chaque thème, et résumé de toutes les manches.
- Si un joueur ne classe pas à temps ou quitte la partie, la manche est annulée sans points. Le jeu s'arrête s'il reste moins de trois joueurs.
- Le socle commun accepte maintenant les jeux sans bots, avec le réglage noBots.
- Limites connues. La base ne bouge pas toute seule, il faudra demander de nouvelles questions pour la compléter. Le jeu n'a pas été testé avec de vrais joueurs sur plusieurs téléphones, seulement avec des navigateurs de test.

## Dix-neuvième mise à jour, Zoomalou, nouvelle règle d'essence et circuits beaucoup plus variés

### Règle de l'essence corrigée

- Chaque pilote pose d'abord un temps, avec autant d'essais que le réglage le permet et sans limite d'essence. Ensuite le pilote au plus mauvais temps reçoit toute son essence pour battre au moins l'avant-dernier. Tant qu'il reste dernier c'est encore à lui. S'il n'a plus d'essence il est éliminé. Quand quelqu'un le dépasse, c'est le nouveau dernier qui joue.
- Exemple avec trois pilotes à 35, 34 et 38 secondes. Le troisième joue d'abord et fait 33 secondes. Le premier devient dernier et rejoue jusqu'à battre le deuxième, puis le deuxième rejoue à son tour.
- La manche se termine quand il ne reste que le meilleur temps, qui gagne 3 points, ou quand un pilote abandonne et que le réglage La manche s'arrête a été choisi. Le dernier éliminé gagne 1 point.
- Nouveau bouton Abandonner pendant son tour, avec une confirmation. Nouveau réglage Quand un pilote abandonne, avec les choix Il est éliminé ou La manche s'arrête.
- Le classement à droite montre pour chacun son meilleur temps et son essence restante, les éliminés sont barrés.
- Le réservoir de chacun vaut un multiple du meilleur temps posé, ou une durée fixe, au choix. Il ne se remplit pas entre deux tours de jeu.

### Nouveaux éléments de circuit

- Trous à sauter. Un trou dans la route à franchir en l'air. Le tremplin est calculé pour que le saut soit toujours possible, même avec la voiture la plus lente, avec un point de contrôle juste avant l'élan et une longue réception derrière. Un portique jaune et noir prévient avant le trou et un tapis vert marque la réception.
- Côtes et descentes raides, avec des pentes allant jusqu'à 50 pour cent.
- Obstacles posés sur la route (plots, tonneaux, caisses, piliers) en série, avec un passage toujours laissé libre.
- Route large ou étroite. La largeur change beaucoup, avec des goulots et de grandes arènes.
- Ponts sans rebord, surélevés, où une sortie de route fait tomber la voiture au dernier point de contrôle.
- Zones sans gravité. Looping, vrille, mur à grimper et plafond. La voiture reste collée à la route même la tête en bas, et la caméra tourne avec elle. La route n'est jamais à l'envers ailleurs que dans ces zones, que des anneaux violets marquent à l'entrée et le long du parcours.
- Chaque élément se coche ou se décoche dans les réglages du circuit, dans Animations du circuit. L'aperçu du salon liste ce que contient le circuit.
- Les automates savent franchir tous ces éléments. Sur 1500 courses de test, une seule n'a pas fini dans le temps de calcul prévu, sur un circuit géant avec la voiture la plus lente. Ce temps de calcul est maintenant allongé pour les grands circuits.

### Limites connues

- Les zones sans gravité sont testées par des automates et par des captures d'écran du rendu, pas par de vrais joueurs. Les sensations de conduite dans un looping ou une vrille restent à juger à la manette ou au clavier.
- Les pilotes automatiques ne tentent pas d'abandonner volontairement, ils jouent jusqu'à la panne d'essence.
- Les temps de calcul des automates sur les circuits géants peuvent se sentir au début d'un tour.


## Richissime Destiny, douzième mise à jour, des métiers pour tous

Les vies de Richissime partaient trop souvent vers la scène ou le stade. Sur 150 vies simulées, 63 pour cent commençaient par un métier de scène ou de sport. Cette mise à jour rend les parcours plus variés et les choix plus cohérents.

### Trente-cinq nouveaux métiers

- Métiers manuels et de service, plombier, électricien, menuisier, boulanger, boucher, fleuriste, mécanicien, facteur, conducteur de bus et de train, maraîcher, pêcheur, bijoutier, couturier, fromager, apiculteur, brasseur, brocanteur, libraire, guide touristique, personnel navigant, animateur, aide à domicile et énergies vertes.
- Métiers de bureau et de gestion, comptable, assistant de direction, assurance et banque, ressources humaines, urbaniste, géomètre, interprète, logisticien, contrôleur aérien, actuaire, événementiel et éducation spécialisée.
- Chacun a ses échelons de salaire, ses centres d'intérêt, ses filières d'études qui le favorisent et une occasion de vocation qui peut le lancer.

### Un début de carrière moins prévisible

- Les métiers de vedette (scène et sport) ne sont plus proposés avant 18 ans, sauf vocation ou parcours engagé. Ensuite ils restent possibles, avec une probabilité plus proche de celle des autres métiers.
- Les vocations de chanteur, d'esport, de créateur et de DJ demandent de vraies qualités et tombent moins souvent.
- Résultat sur 180 vies simulées, 21 pour cent de débuts en scène ou en sport au lieu de 63 pour cent. Le nombre de premiers métiers différents passe d'une trentaine à plus de soixante-dix.

### Un onglet professionnel qui parle de ton métier

- Les marches professionnelles des parcours (label, tube, contrat pro, saison de rêve) ne sont plus proposées à quelqu'un dont le métier n'a aucun rapport.
- Les coups de poker de la scène et du sport sont réservés aux bons métiers. Un peintre ne reçoit plus d'offre pour lancer un morceau, ni un comptable de camp d'entraînement.
- Titres, descriptions et issues changent selon le métier. Un musicien part en tournée et signe chez un label, un peintre fait circuler ses œuvres et vise une galerie, un joueur d'esport vise le grand tournoi mondial, un footballeur vise la grande finale avec son équipe, un explorateur tente l'expédition de sa vie.
- Chez les métiers manuels, viser un label de qualité, accepter le chantier le plus dangereux, passer un examen interne ou ouvrir son atelier ne sont proposés qu'aux métiers concernés.

### Limites connues

- Les textes adaptés couvrent les options les plus décalées. D'autres options de bureau et de métiers manuels gardent un texte général.
- Les chances de rencontrer un métier précis dépendent encore beaucoup des goûts et des qualités du personnage.

## Treizième mise à jour, écran noir sur Mac et parties qui survivent aux pannes

### Écran vide sur Mac pour Golfouille et Zoomalou

- Cause la plus probable, l'écran du jeu était placé avec un réglage de style que les anciens Safari ne comprennent pas. La zone 3D n'avait alors aucune taille et restait vide, alors que les menus s'affichaient. Ce réglage est remplacé partout, dans tous les jeux, par des positions classiques.
- Le rendu 3D essaie maintenant plusieurs réglages de plus en plus prudents avant d'abandonner, et une erreur sur une image ne casse plus tout l'affichage.
- Si le terrain reste vide ou si la 3D est impossible, un message s'affiche en haut de l'écran avec la cause et un bouton pour réessayer en mode compatibilité.

### Richissime Destiny, parties protégées contre les coupures

- Le serveur sauvegarde les parties toutes les vingt secondes, et à chaque arrêt demandé par l'hébergeur. Au redémarrage il les remonte tout seul, les joueurs reviennent sans rien perdre.
- Chaque joueur garde aussi dans son navigateur une copie compressée de la partie. Si le serveur a tout oublié, la page remonte la partie à l'identique avec le même code, et les autres joueurs se rattachent seuls.
- Pendant la reprise, un écran explique ce qui se passe au lieu de renvoyer à l'accueil.
- Un message dans le salon annonce que la partie a été remontée.

### Serveur du site

- Une erreur dans un jeu est maintenant enregistrée sans arrêter le site, les autres parties continuent.
- Golfouille et Zoomalou affichent un message clair quand un salon a disparu après un redémarrage.

### Limites connues

- Je n'ai pas de Mac sous la main. Le correctif vise la cause la plus probable et l'écran de secours dira la vraie cause si ce n'est pas la bonne.
- Sur l'hébergement gratuit, les fichiers du serveur sont effacés à chaque redémarrage complet. C'est pour cela que la copie dans le navigateur existe. La copie ne couvre que Richissime.
- Les parties de Golfouille et de Zoomalou en cours ne sont pas sauvegardées, seul le message est amélioré.

## Quatorzième mise à jour, écran blanc sur Mac, essai unique et chocs entre voitures

### Mode compatibilité pour Golfouille et Zoomalou

- Un nouveau mode d'affichage 3D ultra simple, sans ombres, sans reflets, sans lissage, sur le rendu graphique le plus ancien et le plus répandu. Le ciel devient une image dans la scène au lieu d'un dégradé derrière un canevas transparent.
- Il s'active tout seul sur Safari. Il s'active aussi tout seul, une seule fois, si une erreur de compilation graphique ou un écran resté d'une seule couleur est détecté.
- Il se règle à la main dans le menu des jeux, ligne Mode compatibilité, ou avec ?safe=1 à la fin de l'adresse du jeu.
- Toute erreur de script s'affiche maintenant en bas de l'écran avec le nom du fichier et la ligne, pour savoir ce qui bloque.
- Une page de diagnostic existe à l'adresse du jeu suivie de /common/diag.html. Elle teste chaque type d'affichage et liste ce qui marche. Une capture d'écran de cette page dira exactement ce qui pose problème sur le Mac.

### Zoomalou, un seul essai et chocs plus vrais

- En mode fantôme et en mode contact, chaque pilote n'a droit qu'à un seul essai par course. Plus de remise à zéro du chrono, abandonner demande une confirmation. La course se termine dès que tout le monde a fini.
- En mode contact, un choc est maintenant élastique. La voiture percutée est déviée et se met à tourner selon l'endroit touché, la vitesse des deux voitures est prise en compte et les voitures ne se collent plus.
- Le serveur rejoue chaque choc pour vérifier les temps, la vérification a été testée.

### Limites connues

- Je n'ai toujours pas de Mac. Les tests ont été faits sur un navigateur de bureau avec écran Retina, avec le rendu ancien forcé, avec un faux Safari et avec un affichage volontairement cassé pour vérifier que le mode compatibilité se déclenche seul.

## Vingt-et-unième mise à jour, nouveaux pions pour Goliathicus

### Goliathicus

- Le signe zzz au dessus du Golem n'apparaît plus quand il se repose après un déplacement. Les adversaires ne peuvent plus le deviner. Le signe reste visible pour les pièces endormies par le marais ou par le pouvoir Sommeil, puisque cela se voit de toute façon.
- Cinq nouvelles pièces spéciales, disponibles en Légion des merveilles et en armée sur mesure, avec deux nouveaux modèles de Légion, Mystique et Chaos.
  - Gobelin Bombardier 💣, force 2. Quand il attaque, il explose et emporte sa cible. Selon le réglage, le souffle emporte aussi les pièces voisines, amies comme ennemies. Le Roi et l'Œuf de Dragon résistent.
  - Porte-Étendard 🚩, force 3. Les alliés voisins gagnent de la force dans les combats, sans cumul.
  - Sentinelle 🦉, force 4. Les ennemis proches sont démasqués pour toujours, mais seulement pour ton camp.
  - Phénix 🐦‍🔥, force 7. Il renaît face cachée dans ton camp après son élimination, endormi un tour.
  - Messagère 🕊️, force 2. Un déplacement sans combat te donne un second déplacement, une fois par tour.
- Nouveaux réglages dans le salon, chacun avec son explication. Souffle du Bombardier, force de l'étendard, portée de la Sentinelle, renaissances du Phénix, bonus de la Messagère.
- L'IA sait jouer et composer avec les nouvelles pièces.

### Limites connues

- L'IA de Goliathicus ne calcule pas le bonus de l'étendard quand elle évalue un combat, elle joue donc un peu en dessous de son niveau contre cette pièce.
- Le Phénix 🐦‍🔥 est un emoji récent, sur un appareil ancien il peut s'afficher en deux symboles.

## Vingt-deuxième mise à jour, décor à la main, reliques équitables, Zone interdite et correctif Richissime

### Goliathicus

- Nouveau relief À la main. L'hôte choisit un décor (lac, forêt, marais) ou la gomme, puis clique sur les cases du centre de l'aperçu du plateau. Chaque case posée est copiée par symétrie sur les autres côtés pour que le plateau reste équitable. Un lac qui couperait le plateau en deux est refusé.
- Les reliques ne sont plus jamais posées sur un obstacle, une forêt ou un marais, que le relief soit classique, aléatoire, sauvage ou posé à la main.
- Nouveau réglage Reflet interdit sur les reliques, activé par défaut. Un Reflet ne peut plus se poser sur une relique, ni en marchant, ni par l'échange de la maison du Lion, ni par le mélange du chaos. Il ne peut donc plus bloquer une relique pour toujours.
- Les points de reliques tombent maintenant pour tout le monde en même temps, à la fin de chaque tour de table. Celui qui joue en premier n'est plus avantagé. Si deux camps atteignent l'objectif avec le même score, la partie continue jusqu'à ce que l'un prenne l'avantage.

### Mauvaises Langues

- Nouvelle catégorie à part, la Zone interdite, réservée aux plus de 18 ans. Environ soixante questions très gênantes sur la vie privée et la vie intime du groupe, drôles mais jamais explicites.
- Elle est désactivée par défaut. Deux réglages dans le salon, l'activation et la fréquence (de temps en temps, souvent, presque que ça). Un message prévient tout le monde au lancement, et chaque joueur peut toujours changer sa question.

### Richissime Destiny

- Correction d'une erreur qui pouvait faire planter une année. Les choix reprendre contact avec un ex et proposer un rendez-vous lisaient un personnage qui avait pu disparaître entre-temps. Les textes sont maintenant sûrs.
- Une règle de choix qui plante ne peut plus faire tomber la partie. Le choix devient simplement indisponible et l'erreur est notée dans le journal du serveur.
- Environ 340 parties complètes ont été jouées en test avec 2 à 6 joueurs, des robots et des joueurs simulés, sans autre blocage ni erreur.

### Limites connues

- Les plantages de Richissime que tu vois ne sont pas tous reproduits. Si ça recommence, note l'année de la partie et ce qui était affiché, avec une capture si possible.
- Sur l'hébergement gratuit, tous les jeux partagent le même petit serveur. Quand il s'endort ou redémarre, les parties en cours peuvent être perdues.

## Vingt-troisième mise à jour, Goliathicus plus simple et IA plus stratège

### Légion des merveilles

- La fenêtre de composition fonctionne. Les longues descriptions des pièces poussaient les boutons plus et moins hors de l'écran, ce qui empêchait de choisir quoi que ce soit. Chaque pièce affiche maintenant son nom, sa force, ses boutons et sa description sur une ligne en dessous.
- Un bouton Tout vider enlève toutes les pièces spéciales pour choisir une par une. Le compteur reste bloqué au nombre de places libres et les places non remplies deviennent des Gardes, donc tout le monde a bien le même nombre de pions.

### Réglages simplifiés

- Retirés de l'écran. Le camp éliminé disparaît toujours, plus de ruines qui remplissent le plateau. Le brouillard comme réglage permanent, il reste dans les événements du mode Chaos. Le temps pour placer l'armée, toujours illimité.
- Les réglages des nouvelles pièces et des reliques sont retirés et gardent leur valeur de départ, souffle du Bombardier sur les cases voisines, étendard à plus 1, Sentinelle à 1 case, une seule renaissance du Phénix, bonus de la Messagère actif et Reflet interdit sur les reliques.
- Nouveau réglage Œuf croqué, une pièce revient. Quand tu croques l'Œuf de Dragon d'un adversaire, ta dernière pièce éliminée revient dans ton camp face cachée. Désactivé par défaut.

### Intelligence artificielle

- En mode Conquête, l'IA joue le double jeu. Elle suit les points de reliques de chaque adversaire, s'inquiète quand l'un s'approche de l'objectif ou la dépasse, va déloger les pièces qui tiennent une relique et vise en priorité le meneur, tout en continuant de protéger son Œuf et de viser celui des autres.
- L'IA connaît les nouvelles pièces. Elle compte le bonus de l'étendard dans ses combats, calcule les dégâts du souffle du Bombardier chez l'ennemi et chez ses alliés, place la Sentinelle près des pièces inconnues, joue la Messagère pour gagner un second déplacement, protège moins le Phénix qui renaît et compose ses armées avec ces pièces.
- Sur des parties de test entre deux IA, la nouvelle version bat l'ancienne en Conquête aux niveaux Sorcier et Dragon. Au niveau Roi Stratège, les deux versions sont à égalité.

### Limites connues

- Le niveau Roi Stratège n'a pas gagné en force en Conquête, il était déjà bon pour les reliques.
- Tout cela a été testé par des parties entre IA et dans un navigateur de bureau, pas avec des humains.

## Vingt-quatrième mise à jour, Zoomalou plus juste

### Circuits

- Les ralentisseurs ne sont plus des pièces entières. Ce sont de petites plaques de trois ou quatre points posées de temps en temps sur l'asphalte, avec un espacement minimum et un plafond par circuit. Il y en a environ vingt fois moins, et le tirage donne plus de pentes, de sauts, de ponts, d'obstacles et de boosts.

### Un seul essai par course

- Le réglage Temps pour se lancer propose maintenant Adapté au circuit, choisi par défaut. La fenêtre se calcule d'après le temps du pilote de référence, donc une course de trente secondes ne laisse plus traîner.
- Un pilote déjà parti garde toujours le temps de finir, compté depuis son propre départ. Son essai ne peut plus être gâché par la fin du chrono.
- Une fois la fenêtre écoulée, on ne peut plus partir. Dans les deux modes chrono et contact, il n'y a qu'un essai, l'abandon compte comme l'essai.

### Temps perdus

- Le serveur compare toujours la course rejouée au temps annoncé, mais il accepte maintenant le temps annoncé quand l'écart est petit ou que le rejeu diverge, tant que ce temps reste plausible. Les écarts sont écrits dans le journal du serveur.
- Si le serveur refuse tout de même un passage, l'essai n'est pas consommé et le joueur peut repartir.

### Niveaux des IA

- Les écarts entre niveaux sont nettement plus grands. Mesure sur le même circuit, par rapport au Prodige. Débutant environ deux fois plus lent, Moyen environ un tiers plus lent, Champion environ neuf pour cent plus lent.

### Contacts

- Les chocs sont plus forts, avec un rebond plus vif, un décalage plus net et une rotation plus marquée. Les limites de contrôle du serveur restent les mêmes.

### Limites connues

- Les contacts ont été testés par rejeu serveur, pas à plusieurs humains en même temps. Leur dosage se juge à la main.
- Si un joueur ne démarre pas du tout, il perd simplement son essai, personne ne le lance à sa place.

## Vingt-cinquième mise à jour, contacts réels et sortie de piste

### Pilotes automatiques en mode contact

- Avant, les pilotes automatiques rejouaient un trajet déjà calculé, donc rien ne les bougeait. C'est la raison pour laquelle ils te poussaient sans jamais rien subir.
- Maintenant, en mode contact, chaque pilote automatique roule en direct sur le serveur avec la vraie physique. Quand tu le percutes, il est poussé, dévié et peut partir en tête à queue. Il se rattrape ensuite tout seul et reprend la route.
- Les chocs entre deux automates fonctionnent aussi.
- Dans mes essais, des chocs très violents avec rotation à plein régime n'ont fait échouer aucun automate sur quarante huit courses, ils perdent seulement quelques secondes.

### Chocs plus justes

- Humains et automates utilisent maintenant la même formule de choc, avec la même force des deux côtés. Taper quelqu'un par derrière ne se résume plus à s'arrêter net.

### Nouveau réglage, sortie de piste

- Murs infranchissables est le mode assisté et reste le réglage par défaut.
- Sortie permise, retour au point de contrôle. Un saut assez haut et assez long peut passer par dessus la barrière. La voiture retombe hors du circuit puis repart du dernier point de contrôle.
- Sortie permise, retour au départ. Même chose, mais on repart de la ligne de départ. Le chrono continue de tourner.
- Les pilotes automatiques restent toujours dans les murs.

### Limites connues

- Les chocs avec un humain sont calculés d'après sa position envoyée environ vingt fois par seconde. Avec une mauvaise connexion, le choc peut paraître un peu en retard.
- Je n'ai pas pu tester à plusieurs humains en même temps, seulement avec des joueurs simulés. Le dosage de la force des chocs se juge à la main.

## Vingt-sixième mise à jour, Pagaille Party en vraie 3D

Pagaille Party est un party game en ligne de deux à huit joueurs, dans l'esprit de Mario Party. Il vit dans le dossier pagaille et se branche sur le site comme les autres jeux, avec le même système de salons, de code, de couleurs, de tchat et de reconnexion. Cette mise à jour le transforme en vrai jeu en trois dimensions, avec quinze mini-jeux complets.

### Comment se déroule une partie

- L'hôte règle le nombre de manches (5, 10, 15, 20, 30 ou un nombre personnalisé jusqu'à 40) et lance la partie.
- À chaque manche, trois mini-jeux compatibles avec le nombre de joueurs sont proposés. Tout le monde vote, le vote s'arrête dès que tous ont voté, et les égalités sont tranchées au hasard.
- Les règles et les commandes s'affichent avant chaque jeu, avec un bouton prêt pour passer plus vite, puis un compte à rebours de trois secondes.
- Après le jeu, un écran de résultat montre le classement de la manche, les bonus, les multiplicateurs et le classement général.
- La dernière manche peut compter double, réglable.
- Il n'y a plus de limite d'une minute. Chaque jeu dure le temps que demande son idée, entre une demi minute et environ trois minutes, et le réglage de durée l'allonge ou le raccourcit.

### Les réglages, tous expliqués dans le salon

- Nombre de manches et nombre personnalisé, ambiance compétitive ou chaotique, niveau de chaos, dernière manche double.
- Temps pour voter, temps pour lire les règles et durée des mini-jeux (courts, normaux, longs).
- Éviter deux fois de suite le même jeu, et activer ou désactiver chaque mini-jeu un par un.
- Réglages propres à un jeu. Longueur de la mèche de la bombe, difficulté de la course, vitesse de la lave, météores du sumo, événements de l'arène du choc au sommet. Chacun change vraiment le déroulement du jeu.
- Un bot remplace un joueur déconnecté, réglable.
- Mode démo, où des bots jouent à la place de l'hôte, pour regarder le jeu tourner.
- Jeu imposé pour tester, qui force un mini-jeu précis à chaque manche. Utile pour essayer un seul jeu, seul, avec des bots.

### Les points

- Un classement est établi à chaque manche. Dix points pour le premier, puis des points décroissants selon le nombre de joueurs, et les égalités se partagent les points.
- Des bonus récompensent les beaux coups, comme démasquer le meurtrier, éjecter le plus d'adversaires, monter le plus haut ou n'être jamais tombé. Les surprises du mode chaos peuvent doubler les points.

### Les quinze mini-jeux

| Jeu | Joueurs | Principe |
|---|---|---|
| Bombe en voiture | 2 à 8 | Des voitures en 3D, une bombe qui passe au contact, des trous dans le sol. Mèche réglable. |
| Course des fous | 2 à 8 | Une vraie course d'obstacles avec plateformes mobiles, balanciers, pistons, escaliers, poutre étroite et drapeaux de reprise. Trois difficultés. |
| Lave montante | 2 à 8 | Une tour de plateformes en spirale, une lave qui monte à vitesse réglable, un combat au sommet. |
| Sumo glissant | 2 à 8 | Visée secrète, lancer simultané sur la glace, plateforme qui rétrécit, météores en option. |
| Choc au sommet | 2 à 8 | Une arène où l'on se charge, se repousse et s'écrase, avec bumpers, vagues et météores. |
| Couleur cible | 2 à 8 | Une couleur est annoncée, les autres dalles tombent. Après quelques tours les couleurs s'éteignent avant la chute. |
| Sol en miettes | 2 à 8 | Deux étages de dalles qui s'abîment sous les pas et se fissurent avec le temps. |
| Dalles de mémoire | 2 à 8 | Des dalles s'allument, le sol s'éteint, il faut courir sur une dalle qui était allumée. |
| Lasers invisibles | 2 à 8 | Déplacement et ligne de tir choisis en secret, tout part en même temps. |
| Meurtre mystère | 3 à 8 | Un meurtrier secret, un détective connu de tous, des cadavres qui déclenchent une alerte, des accusations risquées. |
| Faux semblants | 2 | La version du meurtre pour deux joueurs, en interface plate. |
| Pont de verre | 2 à 8 | Une dalle fragile par rangée, on passe chacun son tour et ceux qui tombent révèlent le chemin. |
| Faites des groupes | 3 à 8 | Un nombre est annoncé, il faut se retrouver sur une plateforme avec exactement ce nombre de joueurs. |
| Ruée vers l'or | 2 à 8 | Répartir en secret des mineurs entre des gisements, avec une banque sûre et des conflits. |
| Cagnotte qui grimpe | 2 à 8 | Cinq coups où l'on encaisse avant une explosion au moment inconnu, en interface plate. |

Les nouveautés de cette mise à jour sont la Course des fous, le Choc au sommet, les Dalles de mémoire et la Ruée vers l'or. Les autres jeux ont été refaits en 3D avec des bots. Un jeu qui ne convient pas au nombre de joueurs présents n'est jamais proposé.

### Les bots

- Tous les jeux sont jouables seul ou avec des bots. Les bots ont trois niveaux, facile, normal et expert, et se trompent, hésitent et réagissent avec un petit retard, pour rester crédibles.
- Un joueur déconnecté peut être remplacé par un bot, puis reprendre sa place en revenant.

### Technique

- Le serveur décide de tout, les votes, les déplacements, les collisions, les éliminations et les scores. Le client envoie ses touches, ses clics et ses choix, et affiche la scène reçue.
- La scène 3D est décrite par de simples formes, boîtes, cylindres, sphères, personnages et voitures. Le client la dessine avec three.js, déjà partagé par tout le site. Aucune bibliothèque n'a été ajoutée.
- Si la 3D n'est pas disponible, un affichage à plat prend le relais. Le bouton 3D en haut à droite permet de basculer.
- Les ressources de chaque scène sont libérées entre deux jeux.
- Le dossier pagaille reste sous cent fichiers.

### Ajouter un mini-jeu

- Ajouter une fiche dans pagaille/public/game/catalog.js avec le nombre de joueurs, les règles et les commandes.
- Créer pagaille/games/<identifiant>.js qui exporte create(ctx) et renvoie un objet avec update, frame, scene, priv, onAct, done et ranking.
- Le moteur se charge du reste, vote, règles, compte à rebours, classement, points, déconnexions et affichage.

### Limites connues

- Les tests ont été faits avec des bots et avec un navigateur sans carte graphique réelle. La fluidité sur un vrai téléphone ou un vieil ordinateur n'est pas mesurée.
- Les touches à l'écran pour téléphone n'ont pas été testées sur un vrai téléphone.
- Aucun test avec plusieurs humains réels. L'équilibrage fin, la vitesse de la lave, la difficulté de la course ou la force des chocs, se juge à la main avec les réglages.

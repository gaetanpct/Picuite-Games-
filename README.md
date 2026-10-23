# Picuite Games

Le site qui réunit tous les jeux, avec une page d'accueil pour choisir.

Jeux inclus pour l'instant, Gaeboub-up (plateau à la Monopoly), Goliathicus (stratégie et bluff), Richissime Destiny (simulation de vie entre amis), Golfouille (golf en 3D sur des terrains générés) et Zoomalou (courses de voitures sur des circuits générés).

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

Une seule adresse sert tout le site. Les jeux sont sur /gaeboub-up, /goliathicus, /richissime, /golfouille et /zoomalou. La route /health répond quand le serveur est vivant.

## Organisation

- server.js, le serveur du site, il découvre et monte automatiquement chaque jeu.
- public/, la page d'accueil (index.html, style.css, app.js), les logos dans public/logos et le petit bouton de retour pg-back.js.
- gaeboub-up/, goliathicus/, richissime/, golfouille/ et zoomalou/, un dossier par jeu directement à la racine, sans dossier games. Chaque dossier contient son server.js, son dossier public, ses éventuels dossiers lib, et un fichier game.json qui sert à la présentation sur l'accueil. Tout dossier de la racine qui contient un server.js et un game.json est reconnu comme un jeu (sauf public et node_modules).

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
- Mode essence. Le premier pilote pose un temps, puis chaque autre pilote a un réservoir limité pour le battre et retente tant qu'il lui reste de l'essence. Le réservoir se règle de deux façons, relatif au record ou fixe en secondes. Un essai abandonné coûte l'essence déjà brûlée.
- Ordre des pilotes. Le réglage propose À tour de rôle ou Le dernier d'abord, où le pilote le moins bien classé pose le temps et le leader joue en dernier.
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

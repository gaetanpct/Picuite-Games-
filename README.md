# Picuite Games

Le site qui réunit tous les jeux, avec une page d'accueil pour choisir.

Jeux inclus pour l'instant, Gaeboub-up (plateau à la Monopoly), Goliathicus (stratégie et bluff) et Richissime Destiny (simulation de vie entre amis).

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

Une seule adresse sert tout le site. Les jeux sont sur /gaeboub-up, /goliathicus et /richissime. La route /health répond quand le serveur est vivant.

## Organisation

- server.js, le serveur du site, il découvre et monte automatiquement chaque jeu.
- public/, la page d'accueil (index.html, style.css, app.js), les logos dans public/logos et le petit bouton de retour pg-back.js.
- gaeboub-up/, goliathicus/ et richissime/, un dossier par jeu directement à la racine, sans dossier games. Chaque dossier contient son server.js, son dossier public, ses éventuels dossiers lib, et un fichier game.json qui sert à la présentation sur l'accueil. Tout dossier de la racine qui contient un server.js et un game.json est reconnu comme un jeu (sauf public et node_modules).

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
- Du blackjack et du poker pour de vrai. Quand un défi de blackjack ou de poker est accepté, une table s'ouvre avec de vraies cartes tirées dans un paquet. Au blackjack, chacun tire ou reste, et le plus proche de 21 gagne. Au poker à cinq cartes, on échange ses cartes, on peut relancer ou se coucher, et le meilleur jeu gagne. La main de l'adversaire n'est jamais envoyée avant la fin. Les robots et les absents jouent à ta place avec une stratégie simple. Cette option se désactive dans les réglages (Blackjack et poker pour de vrai).
- Des scènes collectives irrégulières. Le tirage est aléatoire, avec parfois deux années de suite puis plusieurs années sans rien, mais jamais plus de sept années sans scène. Cinq années sans scène arrivent rarement au réglage normal. Le réglage propose Fréquentes, Normales, Peu fréquentes et Rares. Les enjeux suivent la fortune des joueurs présents, avec parfois un coup exceptionnel.
- Des habitudes qui comptent. Répéter la salle de sport, une formation, la lecture, une langue ou le théâtre installe des qualités, avec des paliers à trois, six et dix ans et des déclics aléatoires. La salle de sport fait grimper le charme, une formation fait grimper l'intelligence, et les stats influencent les salaires proposés.

Quatrième mise à jour, pensée pour plus de cohérence et de rapidité.

- Moins de réglages. La partie commence toujours à 8 ans, et le réglage de l'âge de départ a disparu. Par défaut, il n'y a pas de limite de temps pour noter une vie, on peut se noter soi-même, les thèmes adultes et les coups bas sont autorisés, et l'héritage entre joueurs est désactivé.
- Une nouvelle bande de prénoms. Les personnages secondaires portent plus souvent les prénoms de la bande (environ quatre sur cinq au réglage par défaut), avec la nouvelle liste.
- Des centres d'intérêt qui se construisent. Chaque année passée sur un domaine (sport, arts, musique, vidéo, études, affaires, vie sociale, nature, cuisine...) renforce l'intérêt pour ce domaine. Une passion est presque toujours proposée sous une forme ou une autre, et elle ouvre les métiers qui vont avec. Les métiers de passion (sport de haut niveau, ski, chant, cinéma, création de contenu...) ne sont plus proposés à quelqu'un qui ne s'y est jamais intéressé.
- Des parcours en boule de neige. Un parcours sportif (section sport-études, centre de formation, contrat professionnel, vedette), un parcours cinéma (courts métrages dans le garage, festival, producteur, rôle principal, star mondiale) et un parcours musique (groupe de garage, premiers concerts, label, tube, stades du monde entier). Chaque marche réussie ouvre la suivante, chaque marche peut échouer (blessure grave, fiasco, scandale) et faire retomber, et le nombre d'essais par marche est limité.

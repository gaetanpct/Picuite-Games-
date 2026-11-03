// ============================================================
// SUCRÉ OU SALÉ — Lexique. Chaque mot porte des traits, les mêmes que ceux des dilemmes.
// Les robots s'en servent pour répondre et déduire, les humains ne voient jamais les traits.
// Format d'une ligne, Nom|trait,trait,...
// ============================================================
const RAW = {
  objets: `
Cuillère|objet,petit,metal,cuisine,bouche,propre,banal,utile,dur,brillant
Brosse à dents|objet,petit,bain,bouche,hygiene,propre,banal,utile,plastique,mains
Parapluie|objet,grand,pluie,utile,tissu,exterieur,ville,banal,pointu,ancien
Lunettes de soleil|objet,petit,ete,vacances,tete,mode,plastique,brillant,fete,banal
Téléphone|objet,petit,moderne,electrique,utile,travail,mains,plat,celebre,banal
Clé|objet,petit,metal,maison,utile,dur,banal,serieux,brillant,mains
Marteau|objet,outil,lourd,metal,dur,danger,travail,bruyant,mains,agressif
Ballon|objet,jouet,rond,leger,enfantin,sport,fete,drole,colore,exterieur
Oreiller|objet,meuble,mou,doux,chambre,nuit,calme,tissu,paresseux,maison
Savon|objet,petit,bain,hygiene,propre,parfum,mou,mains,banal,eau
Miroir|objet,plat,brillant,verre,bain,maison,tete,fragile,magique,serieux
Montre|objet,petit,metal,brillant,luxe,mains,ancien,serieux,travail,utile
Couteau|objet,outil,pointu,metal,cuisine,danger,brillant,mains,agressif,dur
Chaise|objet,meuble,bois,maison,utile,banal,dur,restaurant,calme,paresseux
Ordinateur|objet,moderne,electrique,travail,ecole,serieux,intelligent,plat,utile,celebre
Bougie|objet,petit,feu,parfum,romantique,nuit,calme,maison,fete,doux
Valise|objet,grand,voyage,vacances,plastique,lourd,creux,utile,ville,aeroport
Sac à dos|objet,tissu,ecole,voyage,utile,creux,nature,montagne,jeune,banal
Chaussette|objet,vetement,tissu,petit,pieds,doux,pue,banal,hiver,chaud
Peigne|objet,petit,tete,hygiene,plastique,long,pointu,banal,propre,bain
Aspirateur|objet,electrique,maison,bruyant,utile,serieux,banal,propre,lourd,ennuyeux
Livre|objet,papier,lecture,culture,ecole,calme,intelligent,plat,ancien,chambre
Stylo|objet,petit,long,ecole,travail,utile,plastique,banal,mains,lecture
Lampe|objet,electrique,brillant,maison,chambre,utile,nuit,banal,moderne,calme
Casque audio|objet,electrique,musique,tete,moderne,plastique,silence,jeune,energie,voyage
Fer à repasser|objet,electrique,maison,chaud,lourd,danger,serieux,ennuyeux,metal,utile
Cadenas|objet,petit,metal,dur,serieux,securite,lourd,brillant,ville,utile
Boussole|objet,petit,voyage,nature,ancien,metal,intelligent,aventure,montagne,mer
Caméra|objet,electrique,moderne,art,culture,celebre,fete,souvenir,drole,luxe
Balai|objet,outil,long,maison,propre,magique,banal,ennuyeux,bois,utile
Seau|objet,creux,eau,plastique,enfantin,mer,plage,banal,utile,exterieur
Canapé|objet,meuble,grand,mou,doux,maison,calme,paresseux,tissu,chambre
Réveil|objet,electrique,bruyant,chambre,nuit,ecole,travail,utile,serieux,agressif
Ciseaux|objet,outil,pointu,metal,danger,ecole,petit,mains,agressif,utile
Télécommande|objet,petit,electrique,maison,plastique,paresseux,moderne,banal,mains,calme
Radiateur|objet,electrique,chaud,hiver,maison,metal,lourd,banal,calme,utile
Tapis|objet,meuble,plat,tissu,maison,doux,grand,ancien,luxe,pieds
Couronne|objet,luxe,brillant,metal,rare,celebre,tete,serieux,ancien,magique
Lit|objet,meuble,grand,mou,chambre,nuit,paresseux,calme,maison,doux
Tondeuse|objet,electrique,bruyant,exterieur,nature,danger,lourd,ete,maison,agressif
Briquet|objet,petit,feu,danger,metal,fete,adulte,mains,utile,chaud
Ventilateur|objet,electrique,ete,froid,bruyant,rond,maison,utile,vacances,calme
Bouée|objet,rond,creux,mer,plage,ete,vacances,enfantin,colore,leger
Peluche|objet,jouet,doux,mou,enfantin,mignon,chambre,tissu,calme,nuit
Poubelle|objet,creux,pue,crade,maison,ville,banal,utile,ennuyeux,plastique
Papier toilette|objet,papier,bain,hygiene,blanc,doux,banal,utile,maison,rond
Dentifrice|objet,petit,bain,hygiene,propre,parfum,bouche,mou,banal,utile
Chapeau|objet,vetement,tete,tissu,mode,ancien,magique,drole,exterieur,ete
Échelle|objet,outil,long,grand,metal,danger,travail,exterieur,utile,dur
Éponge|objet,mou,eau,cuisine,propre,banal,utile,petit,bain,crade
Trampoline|objet,jouet,rond,grand,sport,enfantin,drole,exterieur,energie,leger
`,
  nourriture: `
Pizza|nourriture,rond,chaud,sel,fromage,fete,celebre,restaurant,jeune,gras
Croissant|nourriture,sucre,chaud,petit,matin,celebre,mou,doux,beurre,banal
Sushi|nourriture,sel,froid,petit,poisson,restaurant,luxe,celebre,mer,serieux
Chocolat|nourriture,sucre,doux,amer,romantique,fete,enfantin,dur,celebre,banal
Fromage|nourriture,sel,gras,pue,restaurant,celebre,mou,froid,banal,adulte
Banane|nourriture,sucre,doux,long,mou,fruit,drole,jaune,banal,nature
Citron|nourriture,acide,fruit,jaune,froid,rond,petit,hygiene,nature,ete
Spaghetti|nourriture,chaud,long,sel,restaurant,celebre,mou,banal,cuisine,enfantin
Frites|nourriture,chaud,sel,gras,long,fete,banal,celebre,jeune,restaurant
Glace|nourriture,sucre,froid,ete,vacances,enfantin,doux,fete,celebre,rond
Baguette|nourriture,long,dur,sel,celebre,matin,banal,ancien,bruyant,ville
Hamburger|nourriture,sel,gras,chaud,rond,celebre,restaurant,jeune,banal,mains
Soupe|nourriture,chaud,liquide,hiver,sel,maison,calme,doux,banal,cuisine
Pomme|nourriture,fruit,sucre,rond,nature,rouge,dur,banal,sante,enfantin
Piment|nourriture,epice,chaud,danger,petit,rouge,agressif,adulte,energie,nature
Café|boisson,chaud,amer,matin,travail,adulte,energie,banal,celebre,serieux
Thé|boisson,chaud,calme,doux,parfum,hiver,ancien,serieux,maison,sante
Champagne|boisson,froid,luxe,fete,brillant,adulte,celebre,rare,bruyant,sucre
Lait|boisson,froid,blanc,doux,enfantin,matin,sante,banal,liquide,calme
Œuf|nourriture,rond,petit,fragile,matin,banal,cuisine,sante,vivant,mignon
Miel|nourriture,sucre,doux,liquide,nature,sante,parfum,mou,calme,mignon
Chewing-gum|nourriture,sucre,mou,petit,bouche,jeune,drole,parfum,banal,plastique
Barbe à papa|nourriture,sucre,fete,enfantin,leger,doux,colore,drole,exterieur,vacances
Cornichon|nourriture,acide,sel,petit,vert,pue,banal,adulte,restaurant,froid
Crêpe|nourriture,sucre,plat,chaud,fete,doux,enfantin,celebre,cuisine,rond
Salade|nourriture,froid,vert,sante,leger,ete,nature,ennuyeux,restaurant,banal
Steak|nourriture,sel,chaud,gras,lourd,restaurant,adulte,serieux,viande,agressif
Gâteau d'anniversaire|nourriture,sucre,fete,rond,bougie,enfantin,doux,romantique,celebre,colore
Popcorn|nourriture,sel,leger,cinema,fete,bruyant,petit,drole,jeune,celebre
Bonbon|nourriture,sucre,petit,enfantin,colore,fete,mignon,doux,banal,mou
Raclette|nourriture,chaud,gras,fromage,hiver,montagne,fete,sel,maison,pue
Pastèque|nourriture,fruit,sucre,ete,rond,grand,vacances,froid,rouge,nature
Kebab|nourriture,sel,epice,chaud,gras,ville,nuit,jeune,mains,banal
Beurre|nourriture,gras,mou,doux,cuisine,jaune,froid,banal,sel,utile
Yaourt|nourriture,froid,doux,mou,sante,blanc,banal,enfantin,matin,calme
Noix de coco|nourriture,fruit,dur,rond,ete,vacances,mer,sucre,nature,celebre
Olive|nourriture,petit,sel,amer,rond,vert,adulte,restaurant,nature,banal
Huître|nourriture,sel,mer,luxe,fete,mou,froid,adulte,rare,restaurant
Oignon|nourriture,pue,rond,cuisine,pleurs,banal,piquant,nature,utile,sel
Cookie|nourriture,sucre,rond,doux,chocolat,enfantin,celebre,jeune,banal,mains
`,
  animaux: `
Chat|animal,vivant,mignon,doux,maison,paresseux,nuit,calme,petit,celebre
Chien|animal,vivant,fidele,maison,energie,bruyant,exterieur,mignon,celebre,sport
Lion|animal,vivant,grand,danger,agressif,roi,savane,celebre,energie,fort
Dauphin|animal,vivant,mer,intelligent,drole,mignon,vacances,eau,energie,celebre
Pingouin|animal,vivant,froid,mer,drole,mignon,hiver,glace,noir,blanc
Escargot|animal,vivant,petit,lent,paresseux,mou,nature,calme,jardin,pluie
Araignée|animal,vivant,petit,effrayant,pointu,danger,nuit,pue,cave,agressif
Requin|animal,vivant,mer,danger,effrayant,grand,agressif,rapide,eau,celebre
Mouton|animal,vivant,doux,campagne,mignon,calme,laine,blanc,paresseux,enfantin
Aigle|animal,vivant,grand,rapide,montagne,ciel,roi,serieux,fort,rare
Grenouille|animal,vivant,petit,vert,eau,drole,nature,pluie,mou,enfantin
Éléphant|animal,vivant,grand,lourd,intelligent,calme,savane,cirque,gris,celebre
Poule|animal,vivant,campagne,bruyant,matin,drole,banal,exterieur,petit,nourrit
Lapin|animal,vivant,petit,mignon,doux,rapide,enfantin,nature,magique,blanc
Mouche|animal,vivant,petit,pue,bruyant,crade,ete,agressif,banal,vole
Singe|animal,vivant,drole,intelligent,energie,arbre,jungle,cirque,mignon,agressif
Girafe|animal,vivant,grand,long,savane,calme,doux,zoo,celebre,rare
Tortue|animal,vivant,lent,dur,mer,calme,ancien,sage,petit,paresseux
Loup|animal,vivant,nuit,danger,agressif,montagne,hiver,effrayant,fort,fidele
Cochon|animal,vivant,crade,rose,campagne,gras,drole,paresseux,mou,sel
Pieuvre|animal,vivant,mer,mou,intelligent,effrayant,eau,rare,drole,sombre
Papillon|animal,vivant,petit,leger,colore,nature,ete,doux,calme,mignon
Serpent|animal,vivant,long,danger,effrayant,froid,rampe,desert,rare,sombre
Cheval|animal,vivant,grand,rapide,campagne,fort,sport,noble,exterieur,luxe
Panda|animal,vivant,mignon,doux,paresseux,rare,zoo,blanc,noir,calme
Hérisson|animal,vivant,petit,pointu,nuit,nature,mignon,jardin,calme,danger
Moustique|animal,vivant,petit,nuit,ete,bruyant,agressif,danger,sang,vole
Perroquet|animal,vivant,colore,bruyant,drole,intelligent,jungle,pirate,vole,rare
Vache|animal,vivant,campagne,grand,lait,calme,paresseux,lourd,nature,banal
Canard|animal,vivant,eau,drole,petit,bruyant,mignon,enfantin,bain,vole
`,
  lieux: `
Plage|lieu,ete,vacances,mer,sable,calme,exterieur,soleil,drole,detente
Bibliothèque|lieu,silence,lecture,culture,calme,ecole,serieux,intelligent,ancien,travail
Hôpital|lieu,sante,serieux,blanc,travail,effrayant,propre,calme,ville,hygiene
Aéroport|lieu,voyage,grand,bruyant,vacances,ville,serieux,moderne,stress,securite
Cinéma|lieu,sombre,nuit,fete,culture,popcorn,calme,jeune,romantique,ville
Supermarché|lieu,grand,banal,nourriture,ville,utile,bruyant,ennuyeux,famille,froid
Cimetière|lieu,mort,effrayant,silence,calme,serieux,nuit,pierre,triste,ancien
Piscine|lieu,eau,ete,sport,vacances,bruyant,enfantin,chaud,hygiene,drole
Boîte de nuit|lieu,nuit,bruyant,fete,musique,jeune,adulte,sombre,energie,ville
École|lieu,ecole,enfantin,jeune,bruyant,serieux,intelligent,lecture,travail,banal
Désert|lieu,chaud,sec,sable,rare,calme,silence,nature,danger,aventure
Forêt|lieu,nature,vert,calme,arbre,sombre,effrayant,silence,parfum,aventure
Montagne|lieu,nature,grand,hiver,froid,sport,aventure,calme,pierre,rare
Château|lieu,ancien,grand,luxe,roi,pierre,celebre,magique,effrayant,culture
Prison|lieu,serieux,danger,effrayant,metal,sombre,triste,agressif,dur,securite
Musée|lieu,culture,art,calme,silence,ancien,serieux,celebre,ville,intelligent
Salle de bain|lieu,bain,hygiene,eau,propre,maison,petit,chaud,intime,banal
Cuisine|lieu,maison,nourriture,chaud,cuisine,famille,banal,utile,parfum,bruyant
Grenier|lieu,maison,ancien,sombre,poussiere,effrayant,secret,calme,silence,rare
Cave|lieu,maison,sombre,froid,effrayant,ancien,secret,pierre,humide,calme
Stade|lieu,sport,grand,bruyant,fete,energie,exterieur,foule,celebre,jeune
Parc d'attractions|lieu,fete,enfantin,drole,energie,bruyant,colore,vacances,famille,exterieur
Église|lieu,ancien,calme,silence,serieux,pierre,culture,celebre,grand,sacre
Gare|lieu,voyage,ville,bruyant,grand,foule,stress,utile,ancien,metal
Ascenseur|lieu,petit,metal,gene,silence,ville,moderne,banal,serieux,electrique
Camping|lieu,nature,ete,vacances,aventure,exterieur,calme,famille,feu,jeune
Spa|lieu,detente,chaud,luxe,eau,calme,parfum,hygiene,doux,adulte
Banque|lieu,serieux,argent,ville,securite,metal,adulte,travail,ennuyeux,luxe
Cirque|lieu,fete,drole,colore,bruyant,enfantin,energie,magique,celebre,rare
Station spatiale|lieu,espace,moderne,rare,metal,silence,intelligent,serieux,danger,futur
Zoo|lieu,animal,famille,enfantin,exterieur,ville,vacances,mignon,bruyant,nature
Salle d'attente|lieu,ennuyeux,calme,sante,silence,banal,paresseux,serieux,froid,stress
Boulangerie|lieu,nourriture,matin,parfum,chaud,ville,banal,celebre,doux,sucre
Ferme|lieu,campagne,animal,nature,matin,calme,pue,exterieur,famille,banal
Île déserte|lieu,mer,rare,aventure,calme,nature,vacances,sable,silence,magique
`,
  metiers: `
Pompier|metier,humain,danger,courage,feu,fort,serieux,ville,rouge,heros
Médecin|metier,humain,sante,serieux,intelligent,blanc,travail,propre,utile,calme
Boulanger|metier,humain,matin,nourriture,chaud,parfum,banal,utile,ville,travail
Pilote|metier,humain,voyage,serieux,intelligent,ciel,luxe,moderne,danger,aventure
Clown|metier,humain,drole,colore,cirque,enfantin,bruyant,fete,effrayant,energie
Policier|metier,humain,serieux,securite,danger,ville,agressif,travail,fort,utile
Professeur|metier,humain,ecole,intelligent,serieux,lecture,calme,travail,ennuyeux,utile
Chef cuisinier|metier,humain,cuisine,restaurant,luxe,agressif,chaud,parfum,celebre,energie
Astronaute|metier,humain,espace,rare,intelligent,courage,danger,moderne,celebre,futur
Magicien|metier,humain,magique,drole,fete,rare,celebre,mysterieux,enfantin,cirque
Avocat|metier,humain,serieux,intelligent,luxe,ville,adulte,travail,argent,agressif
Plombier|metier,humain,eau,maison,utile,crade,travail,banal,bruyant,mains
Président|metier,humain,serieux,luxe,celebre,pouvoir,ville,adulte,travail,stress
Détective|metier,humain,intelligent,mysterieux,serieux,nuit,danger,secret,aventure,ville
Pirate|metier,humain,mer,danger,aventure,drole,tresor,agressif,celebre,ancien
Chanteur|metier,humain,musique,celebre,art,fete,bruyant,luxe,energie,scene
Dentiste|metier,humain,sante,effrayant,bouche,propre,blanc,serieux,pointu,travail
Facteur|metier,humain,exterieur,utile,matin,banal,ville,velo,calme,travail
Roi|metier,humain,luxe,pouvoir,ancien,celebre,serieux,couronne,chateau,adulte
Éboueur|metier,humain,crade,pue,matin,utile,banal,ville,bruyant,travail
Maître nageur|metier,humain,eau,sport,ete,vacances,sante,courage,exterieur,fort
Danseuse|metier,humain,art,musique,scene,energie,leger,culture,doux,romantique
Jardinier|metier,humain,nature,calme,exterieur,plante,utile,ete,mains,banal
Mécanicien|metier,humain,metal,crade,vehicule,utile,bruyant,travail,banal,mains
Journaliste|metier,humain,intelligent,lecture,ville,serieux,celebre,stress,travail,curieux
`,
  fiction: `
Dragon|fiction,magique,grand,feu,danger,effrayant,ancien,rare,celebre,vole
Vampire|fiction,nuit,effrayant,sombre,sang,romantique,ancien,rare,adulte,mysterieux
Père Noël|fiction,hiver,fete,magique,enfantin,rouge,doux,celebre,cadeau,bon
Sorcière|fiction,magique,nuit,effrayant,pue,vole,balai,ancien,drole,mysterieux
Robot|fiction,metal,moderne,electrique,intelligent,futur,froid,serieux,energie,utile
Licorne|fiction,magique,mignon,colore,rare,enfantin,doux,brillant,celebre,pur
Fantôme|fiction,mort,effrayant,nuit,silence,leger,drole,ancien,mysterieux,blanc
Zombie|fiction,mort,effrayant,crade,agressif,pue,lent,nuit,danger,sombre
Sirène|fiction,mer,magique,romantique,rare,eau,chante,mignon,ancien,brillant
Super-héros|fiction,courage,fort,moderne,celebre,colore,heros,energie,vole,serieux
Alien|fiction,espace,rare,effrayant,moderne,futur,intelligent,vert,mysterieux,danger
Fée|fiction,magique,petit,leger,brillant,mignon,enfantin,doux,nuit,vole
Momie|fiction,ancien,effrayant,desert,mort,tissu,rare,sombre,mysterieux,lent
Ogre|fiction,grand,lourd,effrayant,agressif,crade,pue,fort,gras,enfantin
Cow-boy|fiction,desert,chapeau,ancien,fort,celebre,cheval,courage,aventure,adulte
Ninja|fiction,nuit,rapide,silence,danger,sombre,agile,mysterieux,fort,secret
Lutin|fiction,magique,petit,drole,vert,nature,mignon,energie,fete,enfantin
Yéti|fiction,montagne,hiver,froid,grand,rare,effrayant,blanc,mysterieux,lourd
Génie de la lampe|fiction,magique,luxe,rare,brillant,drole,voeux,ancien,desert,celebre
Squelette|fiction,mort,effrayant,dur,blanc,drole,sombre,ancien,sante,fete
`,
  nature: `
Volcan|nature,montagne,chaud,feu,danger,grand,rare,bruyant,effrayant,pierre
Arc-en-ciel|nature,colore,pluie,rare,doux,calme,ciel,mignon,magique,enfantin
Orage|nature,bruyant,danger,nuit,pluie,effrayant,electrique,sombre,agressif,fort
Neige|nature,froid,blanc,hiver,doux,calme,silence,montagne,enfantin,leger
Cactus|nature,plante,pointu,desert,danger,sec,vert,rare,drole,dur
Rose|nature,plante,romantique,parfum,rouge,doux,pointu,luxe,fete,mignon
Océan|nature,mer,grand,eau,bleu,profond,vacances,calme,danger,rare
Lune|nature,nuit,calme,ciel,espace,romantique,blanc,rond,silence,magique
Soleil|nature,jour,chaud,ete,brillant,ciel,espace,vacances,jaune,energie
Étoile filante|nature,nuit,rare,ciel,magique,romantique,rapide,brillant,petit,espace
Tornade|nature,danger,bruyant,fort,effrayant,sombre,rapide,rare,agressif,vent
Cascade|nature,eau,bruyant,montagne,grand,rare,froid,calme,energie,aventure
Champignon|nature,plante,petit,pue,humide,foret,mou,danger,magique,drole
Tournesol|nature,plante,jaune,ete,grand,campagne,mignon,doux,jour,brillant
Glacier|nature,froid,montagne,grand,hiver,blanc,rare,dur,silence,danger
Brouillard|nature,sombre,froid,calme,silence,effrayant,mysterieux,humide,hiver,leger
Feu de camp|nature,feu,chaud,nuit,camping,calme,romantique,fete,bois,aventure
Sapin|nature,plante,hiver,fete,vert,grand,pointu,celebre,parfum,montagne
Nuage|nature,ciel,leger,mou,blanc,calme,doux,pluie,enfantin,grand
Iceberg|nature,froid,mer,grand,hiver,danger,rare,glace,dur,silence
`,
  culture: `
Piano|instrument,musique,lourd,grand,noir,serieux,art,culture,luxe,calme
Guitare électrique|instrument,musique,electrique,bruyant,jeune,energie,fete,celebre,scene,agressif
Football|sport,ballon,energie,exterieur,celebre,foule,jeune,equipe,bruyant,rond
Tennis|sport,exterieur,ete,raquette,serieux,calme,celebre,luxe,energie,blanc
Échecs|jeu,intelligent,serieux,calme,silence,ancien,noir,blanc,strategie,culture
Karaoké|fete,musique,bruyant,drole,jeune,nuit,chante,energie,adulte,vacances
Trottinette|vehicule,petit,jeune,rapide,ville,energie,sport,moderne,enfantin,exterieur
Hélicoptère|vehicule,bruyant,vole,metal,rapide,luxe,danger,ciel,moderne,rare
Camion de pompiers|vehicule,grand,rouge,bruyant,danger,courage,ville,eau,enfantin,heros
Montgolfière|vehicule,grand,ciel,calme,colore,romantique,vacances,leger,rare,aventure
Tracteur|vehicule,campagne,lourd,bruyant,vert,utile,grand,travail,lent,exterieur
Sous-marin|vehicule,mer,metal,sombre,rare,silence,danger,profond,aventure,serieux
Train|vehicule,voyage,metal,grand,ville,rapide,utile,vacances,bruyant,celebre
Voilier|vehicule,mer,vacances,ete,calme,blanc,romantique,exterieur,luxe,aventure
Fusée|vehicule,espace,rapide,moderne,rare,bruyant,danger,feu,futur,intelligent
Skateboard|sport,petit,jeune,bruyant,ville,energie,exterieur,drole,rapide,agressif
Violon|instrument,musique,romantique,serieux,ancien,calme,art,luxe,culture,doux
Tambour|instrument,musique,bruyant,rond,energie,fete,agressif,enfantin,rythme,dur
Boxe|sport,agressif,danger,fort,energie,serieux,bruyant,sueur,adulte,courage
Yoga|sport,calme,silence,doux,sante,paresseux,leger,serieux,nature,adulte
Cache-cache|jeu,enfantin,drole,silence,energie,famille,calme,maison,exterieur,mignon
Échelle de corde|jeu,aventure,exterieur,energie,sport,enfantin,danger,drole,leger,nature
`,
};
// transforme le texte brut en liste d'objets, tags en tableau
const WORDS = [];
Object.keys(RAW).forEach((cat) => {
  RAW[cat].split("\n").map((l) => l.trim()).filter(Boolean).forEach((l) => {
    const [name, tags] = l.split("|"); const t = tags.split(",").map((x) => x.trim()).filter(Boolean);
    WORDS.push({ id: WORDS.length, name, cat, tags: t, tagset: new Set(t) });
  });
});
const CATS = [
  { id: "objets", label: "Objets du quotidien", icon: "🧴" }, { id: "nourriture", label: "Nourriture et boissons", icon: "🍕" }, { id: "animaux", label: "Animaux", icon: "🐙" },
  { id: "lieux", label: "Lieux", icon: "🏰" }, { id: "metiers", label: "Métiers", icon: "👩‍🚒" }, { id: "fiction", label: "Créatures et personnages", icon: "🧛" },
  { id: "nature", label: "Nature et météo", icon: "🌋" }, { id: "culture", label: "Musique, sports et véhicules", icon: "🎸" },
];
module.exports = { WORDS, CATS };

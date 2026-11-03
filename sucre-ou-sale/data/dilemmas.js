// ============================================================
// SUCRÉ OU SALÉ — Bibliothèque de dilemmes.
// Ligne = catégorie + niveau | côté A | côté B | traits A | traits B
// Catégories L logique, A absurde, C culture, Q quotidien, D drôle, H difficile à cerner, I imagination.
// Niveaux 1 évident, 2 moyen, 3 vicieux.
// Les traits sont les mêmes que ceux du lexique, les robots comparent les deux.
// ============================================================
const RAW = `
Q1|Brosse à dents|Brosse WC|bain,hygiene,propre,bouche,petit|crade,pue,bain,banal,plastique
Q1|Photo d'identité|Photo de mariage|serieux,banal,ville,travail,froid|romantique,fete,luxe,souvenir,joyeux
L1|Mature|Immature|adulte,serieux,calme,travail|enfantin,drole,jeune,energie,jouet
L1|Planification|Improvisation|serieux,intelligent,calme,travail,securite|drole,energie,aventure,bruyant,jeune
C1|Valet de pique|Roi de cœur|jeu,ancien,noir,petit|roi,luxe,romantique,rouge,pouvoir
Q1|Chaud|Froid|chaud,ete,feu,soleil,energie|froid,hiver,glace,calme,silence
Q1|Matin|Soir|matin,energie,cafe,jour,travail|nuit,calme,sombre,paresseux,romantique
Q1|Jour|Nuit|jour,soleil,energie,exterieur,bruyant|nuit,sombre,calme,silence,mysterieux
Q1|Silence|Bruit|silence,calme,doux,bibliotheque,serieux|bruyant,fete,energie,agressif,foule
L1|Petit|Grand|petit,mignon,leger,doux,enfantin|grand,lourd,fort,luxe,danger
L1|Doux|Dur|doux,mou,mignon,calme,tissu|dur,metal,pierre,agressif,pointu
L1|Mou|Pointu|mou,doux,calme,gras,mignon|pointu,danger,metal,agressif,dur
L1|Lent|Rapide|lent,paresseux,calme,ancien,sage|rapide,energie,sport,danger,moderne
L1|Léger|Lourd|leger,vole,doux,petit,blanc|lourd,grand,dur,metal,fort
L1|Ancien|Moderne|ancien,pierre,culture,serieux,rare|moderne,electrique,futur,jeune,plastique
L1|Naturel|Artificiel|nature,vert,calme,sante,plante|plastique,moderne,electrique,metal,futur
Q1|Été|Hiver|ete,soleil,vacances,mer,chaud|hiver,froid,neige,montagne,calme
Q1|Mer|Montagne|mer,eau,sable,vacances,bleu|montagne,pierre,froid,hiver,aventure
Q1|Ville|Campagne|ville,bruyant,foule,moderne,metal|campagne,nature,calme,animal,silence
Q1|Dormir|Courir|nuit,paresseux,calme,doux,mou|sport,energie,rapide,exterieur,sueur
Q1|Douche|Bain|bain,eau,propre,hygiene,rapide|bain,detente,chaud,calme,doux
Q1|Salé|Sucré|sel,gras,fromage,restaurant,piquant|sucre,doux,enfantin,fete,mignon
Q1|Chat|Chien|mignon,doux,paresseux,nuit,calme|fidele,energie,bruyant,exterieur,sport
Q1|Livre|Film|lecture,calme,silence,intelligent,papier|cinema,sombre,fete,jeune,popcorn
Q1|Appartement|Maison|ville,petit,moderne,bruyant,ascenseur|maison,campagne,grand,jardin,famille
Q1|Voiture|Vélo|vehicule,metal,bruyant,ville,rapide|sport,exterieur,nature,calme,leger
Q1|Café|Thé|energie,amer,matin,adulte,travail|calme,doux,parfum,sante,hiver
Q1|Sandales|Chaussons|ete,vacances,plage,pieds,leger|hiver,doux,maison,chaud,paresseux
Q1|Lunettes de soleil|Bonnet|ete,vacances,mode,soleil,tete|hiver,froid,doux,tissu,tete
Q1|Barbecue|Raclette|ete,exterieur,feu,viande,fete|hiver,fromage,montagne,maison,chaud
Q1|Piscine|Baignoire|ete,sport,bruyant,vacances,grand|bain,calme,intime,petit,chaud
Q1|Réveil|Sieste|bruyant,matin,travail,agressif,serieux|paresseux,calme,doux,mou,silence
Q1|Cuisine|Salon|cuisine,chaud,parfum,famille,bruyant|calme,canape,mou,paresseux,maison
Q1|Ascenseur|Escalier|metal,moderne,paresseux,petit,electrique|sport,energie,long,dur,exterieur
Q1|Cadeau|Carte de vœux|fete,mignon,colore,surprise,cadeau|papier,petit,lecture,banal,calme
L2|Prudent|Téméraire|serieux,calme,securite,intelligent,adulte|courage,danger,aventure,energie,jeune
L2|Visible|Invisible|colore,brillant,fete,bruyant,celebre|secret,silence,mysterieux,nuit,rare
L2|Pur|Mélangé|blanc,propre,doux,calme,rare|colore,bruyant,foule,drole,banal
L2|Naturel|Fabriqué|nature,vert,doux,sante,calme|metal,moderne,futur,intelligent,electrique
L2|Gratuit|Précieux|banal,utile,commun,enfantin,simple|luxe,rare,brillant,serieux,argent
L2|Éphémère|Éternel|leger,rare,nuage,romantique,doux|ancien,pierre,dur,serieux,celebre
L2|Public|Privé|foule,bruyant,ville,fete,celebre|intime,secret,calme,maison,silence
L2|Solitaire|Collectif|calme,silence,sombre,intelligent,serieux|foule,equipe,fete,bruyant,energie
L2|Rond|Carré|rond,doux,leger,mignon,enfantin|dur,plat,metal,serieux,ennuyeux
L2|Brillant|Mat|brillant,luxe,metal,magique,verre|doux,tissu,calme,banal,ancien
L2|Rare|Courant|rare,luxe,celebre,magique,mysterieux|banal,utile,commun,quotidien,ennuyeux
L2|Droit|Courbe|long,serieux,dur,metal,securite|rond,doux,mou,drole,mignon
L2|Liquide|Solide|eau,mou,doux,liquide,chaud|dur,pierre,metal,lourd,froid
L2|Court|Long|petit,rapide,leger,mignon,banal|long,lent,grand,calme,ancien
L2|Humide|Sec|eau,pluie,froid,mou,crade|desert,chaud,poussiere,dur,calme
L2|Brut|Raffiné|dur,pierre,crade,agressif,nature|luxe,doux,propre,serieux,art
L2|Fragile|Solide|verre,petit,mignon,leger,doux|dur,fort,metal,lourd,securite
L3|Utile|Beau|utile,outil,metal,banal,travail|art,mignon,colore,romantique,luxe
L3|Contrôlé|Chaotique|serieux,intelligent,securite,calme,propre|bruyant,drole,agressif,energie,danger
L3|Intérieur|Extérieur|maison,calme,doux,chaud,intime|nature,exterieur,soleil,froid,aventure
L3|Protéger|Attaquer|securite,dur,metal,calme,courage|agressif,pointu,danger,fort,feu
L3|Montrer|Cacher|celebre,brillant,fete,colore,scene|secret,sombre,mysterieux,silence,nuit
L3|Donner|Prendre|cadeau,doux,fete,bon,mignon|agressif,pirate,sombre,danger,crade
L3|Réparer|Détruire|outil,utile,serieux,calme,mains|danger,agressif,bruyant,feu,fort
C2|Mozart|Rock'n'roll|piano,ancien,calme,culture,serieux|bruyant,jeune,energie,electrique,fete
C2|Louvre|Disneyland|musee,culture,serieux,art,calme|enfantin,fete,colore,famille,drole
C2|Pizza|Sushi|chaud,gras,fromage,jeune,fete|froid,luxe,poisson,serieux,petit
C2|Western|Science-fiction|desert,ancien,cheval,cowboy,poussiere|espace,futur,metal,moderne,robot
C2|Conte de fées|Film d'horreur|magique,mignon,enfantin,doux,colore|effrayant,sombre,nuit,sang,mort
C2|Opéra|Karaoké|luxe,serieux,culture,calme,ancien|drole,bruyant,fete,jeune,vacances
C2|Football|Tennis|bruyant,foule,equipe,energie,jeune|calme,serieux,luxe,blanc,exterieur
C2|Tour Eiffel|Statue de la Liberté|ville,metal,celebre,ancien,grand|celebre,grand,metal,voyage,vert
C2|Picasso|Photographie|art,colore,drole,culture,rare|moderne,souvenir,plat,realiste,banal
C2|Père Noël|Fée des dents|hiver,rouge,cadeau,fete,celebre|nuit,petit,magique,mignon,doux
C2|Cirque|Théâtre|colore,bruyant,drole,enfantin,energie|culture,serieux,calme,art,sombre
C2|Pirate|Chevalier|mer,danger,aventure,tresor,agressif|chateau,courage,metal,roi,noble
C2|Dracula|Frankenstein|nuit,sang,romantique,vampire,ancien|lourd,sombre,effrayant,metal,electrique
C2|Gladiateur|Samouraï|ancien,fort,agressif,sable,foule|silence,ninja,serieux,secret,calme
C2|Pyramide|Château fort|desert,ancien,pierre,mysterieux,grand|ancien,pierre,roi,grand,luxe
C2|Jeu de société|Jeu vidéo|famille,calme,intelligent,table,ancien|moderne,electrique,jeune,energie,solitaire
C3|Shakespeare|Molière|ancien,serieux,culture,lecture,drame|drole,culture,scene,ancien,satire
C3|Jazz|Classique|musique,nuit,libre,saxophone,calme|musique,piano,serieux,ancien,culture
C3|Baroque|Minimaliste|luxe,brillant,ancien,colore,art|simple,blanc,calme,moderne,plat
C3|Légende|Histoire vraie|magique,ancien,rare,mysterieux,celebre|serieux,culture,ecole,intelligent,realiste
A1|Poule|Œuf|vivant,bruyant,matin,campagne,animal|petit,fragile,rond,cuisine,banal
A2|Un nuage|Une pierre|leger,blanc,mou,doux,ciel|lourd,dur,froid,ancien,silence
A2|Un chatouillement|Une piqûre|doux,leger,drole,mignon,mains|pointu,danger,petit,agressif,sante
A2|Un éternuement|Un hoquet|bruyant,drole,froid,hiver,nez|petit,drole,bruyant,gene,repete
A2|Une pièce de monnaie|Un bouton|metal,petit,rond,argent,brillant|petit,rond,tissu,banal,plat
A2|Un tunnel|Un pont|sombre,profond,froid,silence,pierre|ciel,eau,long,grand,metal
A2|La lune|Le soleil|nuit,calme,blanc,romantique,silence|jour,chaud,brillant,energie,jaune
A2|Un escargot|Une limace|lent,mignon,jardin,pluie,petit|crade,mou,pue,humide,jardin
A2|Un glaçon|Une bougie|froid,dur,ete,eau,glace|chaud,feu,romantique,doux,nuit
A2|Un aimant|Une colle|metal,magique,intelligent,petit,utile|mou,crade,utile,mains,banal
A2|Un tapis volant|Un balai magique|magique,desert,vole,luxe,aventure|magique,vole,nuit,sorciere,ancien
A2|Un bocal|Une boîte|verre,creux,fragile,cuisine,brillant|creux,carton,banal,dur,utile
A2|Une toile d'araignée|Un filet de pêche|leger,petit,effrayant,pointu,nuit|mer,eau,long,utile,rare
A2|Une tempête|Un tremblement de terre|bruyant,pluie,mer,vent,sombre|pierre,danger,fort,sombre,rare
A2|Un cactus|Un hérisson|pointu,desert,vert,plante,sec|pointu,vivant,petit,nuit,mignon
A3|Un parapluie|Un pissenlit|pluie,utile,pointu,ancien,tissu|leger,nature,jaune,ete,vole
A3|Une bulle de savon|Un ballon de baudruche|leger,fragile,rond,bain,vole|rond,fete,colore,enfantin,bruyant
A3|Un ver de terre|Un spaghetti|long,mou,nature,jardin,crade|long,mou,chaud,restaurant,banal
A3|Une ombre|Un écho|sombre,silence,mysterieux,nuit,plat|silence,bruyant,montagne,mysterieux,ancien
A3|Un trou noir|Un puits|espace,sombre,profond,danger,rare|eau,sombre,profond,pierre,ancien
A3|Un point final|Trois petits points|serieux,petit,dur,calme,simple|mysterieux,suspens,leger,romantique,silence
A3|Une cicatrice|Un tatouage|sante,ancien,dur,sombre,serieux|art,mode,jeune,colore,fete
A3|Un secret|Un mensonge|secret,silence,mysterieux,intime,calme|sombre,agressif,danger,crade,serieux
A3|Un rêve|Un souvenir|nuit,magique,mysterieux,leger,doux|ancien,photo,romantique,souvenir,calme
D1|Pet|Rot|pue,drole,gras,crade,bruyant|bruyant,drole,crade,gras,bouche
D1|Une glissade sur une peau de banane|Un pied dans une crotte|drole,jaune,fruit,sante,enfantin|crade,pue,danger,exterieur,banal
D1|Moustache|Barbe|drole,mode,ancien,tete,petit|adulte,tete,fort,hiver,serieux
D1|Pyjama|Maillot de bain|nuit,doux,chambre,paresseux,tissu|ete,plage,vacances,eau,leger
D1|Hoquet|Fou rire|petit,gene,bruyant,repete,drole|drole,bruyant,joyeux,energie,foule
D1|Chaussettes dépareillées|Chemise à l'envers|pieds,tissu,drole,banal,gene|tissu,drole,gene,travail,mode
D1|Sauter dans une flaque|Faire un bonhomme de neige|eau,pluie,enfantin,drole,exterieur|neige,hiver,froid,enfantin,exterieur
D2|Karaoké raté|Danse ridicule|chante,bruyant,drole,fete,nuit|drole,fete,energie,musique,foule
D2|Roter à table|Éternuer sur le gâteau|crade,bruyant,drole,restaurant,gene|crade,gene,fete,gateau,drole
D2|Costume de dinde|Costume de banane|drole,ferme,fete,colore,animal|drole,jaune,fruit,fete,mou
D2|Cri de singe|Hurlement de loup|drole,jungle,bruyant,energie,animal|nuit,montagne,effrayant,froid,animal
D2|Se faire chatouiller|Se faire pincer|drole,doux,leger,mignon,mains|pointu,petit,agressif,mains,sante
D2|Imiter un canard|Imiter une poule|drole,eau,petit,bruyant,mignon|drole,campagne,matin,bruyant,petit
D2|Danse de la pluie|Danse du ventre|drole,pluie,ancien,magique,exterieur|drole,desert,musique,scene,chaud
D3|Perruque|Fausse moustache|drole,mode,tete,fete,doux|drole,mode,tete,petit,ancien
D3|Un pet de licorne|Un rot de dragon|magique,mignon,colore,pue,enfantin|magique,feu,grand,pue,effrayant
D3|Mouiller son pantalon|Renverser son verre|gene,eau,drole,enfantin,crade|gene,eau,restaurant,fragile,banal
D3|Pantoufles de lapin|Peignoir de licorne|doux,drole,maison,mignon,enfantin|doux,magique,maison,mignon,colore
H2|Le courage|La sagesse|courage,fort,danger,heros,aventure|sage,calme,intelligent,ancien,serieux
H2|La nostalgie|L'espoir|ancien,souvenir,calme,doux,romantique|futur,leger,doux,jeune,lumiere
H2|La peur|La colère|effrayant,sombre,nuit,silence,froid|agressif,rouge,bruyant,feu,fort
H2|La jalousie|L'admiration|sombre,vert,agressif,froid,serieux|luxe,celebre,doux,brillant,heros
H2|Le silence|Le murmure|silence,calme,froid,serieux,sombre|doux,leger,secret,intime,romantique
H2|L'ennui|La curiosité|ennuyeux,paresseux,banal,calme,lent|intelligent,aventure,energie,jeune,mysterieux
H3|L'horloge|Le calendrier|metal,rond,serieux,travail,bruyant|papier,plat,ecole,banal,serieux
H3|Le début|La fin|jeune,energie,matin,leger,enfantin|ancien,calme,nuit,serieux,silence
H3|La promesse|Le pari|serieux,fidele,securite,calme,adulte|danger,drole,energie,jeune,aventure
H3|La tradition|La nouveauté|ancien,culture,famille,calme,serieux|moderne,jeune,futur,energie,rare
H3|La mer calme|La mer déchaînée|mer,calme,bleu,doux,vacances|mer,danger,bruyant,fort,sombre
H3|Le feu|La glace|feu,chaud,rouge,danger,energie|froid,blanc,dur,calme,silence
H3|La loi|Le hasard|serieux,securite,adulte,travail,dur|jeu,drole,aventure,energie,rare
I1|Une plage de sable|Une forêt dense|sable,mer,soleil,vacances,calme|arbre,vert,sombre,nature,silence
I1|Un château de sable|Un igloo|sable,plage,enfantin,ete,mer|glace,froid,hiver,blanc,enfantin
I1|Un dragon gentil|Une fée méchante|magique,feu,mignon,grand,enfantin|magique,petit,sombre,agressif,brillant
I1|Un robot cuisinier|Un robot jardinier|metal,cuisine,moderne,chaud,intelligent|metal,nature,exterieur,vert,moderne
I2|Vivre sur un nuage|Vivre au fond de l'océan|ciel,leger,blanc,doux,calme|mer,profond,sombre,silence,rare
I2|Parler aux animaux|Voler comme un oiseau|animal,intelligent,doux,nature,magique|vole,ciel,liberte,aventure,leger
I2|Être invisible|Être géant|secret,silence,mysterieux,nuit,leger|grand,fort,lourd,danger,celebre
I2|Pays de bonbons|Pays de glace|sucre,colore,enfantin,fete,doux|froid,blanc,hiver,glace,silence
I2|Machine à remonter le temps|Vaisseau spatial|ancien,futur,intelligent,magique,rare|espace,metal,rapide,moderne,aventure
I2|Maison dans un arbre|Maison sur l'eau|arbre,nature,enfantin,aventure,vert|eau,mer,calme,vacances,rare
I3|Un phare|Un moulin à vent|mer,lumiere,seul,silence,ancien|vent,campagne,ancien,calme,grand
I3|Une grotte|Une cabane|sombre,froid,secret,pierre,effrayant|bois,enfantin,secret,foret,calme
I3|Un manoir hanté|Une station spatiale abandonnée|ancien,effrayant,sombre,fantome,pierre|espace,metal,silence,effrayant,futur
I3|Un marché de nuit|Un bal masqué|nuit,foule,bruyant,parfum,colore|nuit,fete,mysterieux,luxe,romantique
I3|Un champ de lavande|Un champ de tournesols|parfum,calme,doux,ete,nature|jaune,grand,ete,campagne,brillant
I3|Un trésor enfoui|Une carte au trésor|rare,brillant,luxe,pirate,secret|papier,aventure,pirate,ancien,mysterieux
Q2|Rouge à lèvres|Gloss|rouge,mode,bouche,luxe,adulte|brillant,mode,bouche,jeune,doux
Q2|Parfum|Déodorant|parfum,luxe,doux,fete,romantique|hygiene,propre,banal,utile,bain
Q2|Dentifrice|Bain de bouche|bouche,hygiene,propre,mou,banal|bouche,hygiene,liquide,froid,piquant
Q2|Cintre|Tiroir|tissu,petit,metal,maison,utile|meuble,maison,creux,banal,utile
Q2|Thermos|Gourde|chaud,metal,hiver,voyage,utile|sport,eau,plastique,leger,nature
Q2|Pull en laine|Veste en cuir|hiver,doux,chaud,tissu,mignon|noir,dur,agressif,jeune,mode
Q2|Cahier|Ordinateur|papier,ecole,calme,ancien,lecture|electrique,moderne,travail,plat,intelligent
Q2|Brosse à cheveux|Sèche-cheveux|tete,hygiene,propre,doux,banal|electrique,bruyant,chaud,tete,bain
Q2|Mug|Verre|chaud,maison,banal,matin,doux|froid,verre,fragile,brillant,restaurant
Q2|Facture|Lettre d'amour|serieux,papier,argent,ennuyeux,adulte|papier,romantique,doux,secret,calme
Q2|Chewing-gum|Bonbon|bouche,mou,jeune,drole,plastique|sucre,petit,colore,enfantin,fete
Q2|Pantoufles|Baskets|doux,maison,paresseux,chaud,pieds|sport,energie,rapide,exterieur,pieds
Q2|Ceinture|Bretelles|tissu,serieux,ancien,utile,banal|tissu,drole,ancien,mode,adulte
Q2|Placard|Coffre-fort|creux,maison,banal,bois,utile|metal,securite,lourd,secret,luxe
Q2|Rideau|Volet|tissu,doux,maison,chambre,calme|bois,dur,securite,bruyant,exterieur
Q3|Une photo de famille|Un selfie|souvenir,famille,ancien,doux,fete|moderne,jeune,drole,telephone,celebre
Q3|Une liste de courses|Un journal intime|papier,banal,utile,supermarche,ennuyeux|secret,intime,romantique,calme,papier
Q3|Un ticket de métro|Un billet d'avion|ville,petit,papier,banal,utile|voyage,vacances,luxe,aeroport,aventure
Q3|Un dimanche pluvieux|Un samedi ensoleillé|pluie,calme,paresseux,maison,doux|soleil,ete,fete,energie,exterieur
Q3|Le métro à l'heure de pointe|Une plage déserte|foule,bruyant,stress,ville,metal|calme,sable,silence,mer,vacances
Q3|Une salle d'attente|Un hall de gare|ennuyeux,calme,silence,banal,paresseux|bruyant,foule,voyage,stress,grand
Q3|Une cantine|Un restaurant étoilé|bruyant,ecole,banal,foule,jeune|luxe,serieux,calme,rare,adulte
Q3|Un vide-grenier|Une vente de luxe|ancien,banal,crade,exterieur,foule|luxe,brillant,rare,serieux,adulte
Q3|Un pique-nique|Un banquet|exterieur,nature,famille,leger,ete|luxe,fete,grand,foule,restaurant
Q3|Un feu d'artifice|Un feu de cheminée|bruyant,fete,colore,nuit,ciel|calme,chaud,hiver,maison,romantique
`;
const DILEMMAS = [];
const CATS = { L: "Logique", A: "Absurde", C: "Culture", Q: "Quotidien", D: "Drôle", H: "Difficile à cerner", I: "Imagination" };
RAW.split("\n").map((l) => l.trim()).filter(Boolean).forEach((l) => {
  const p = l.split("|"); if (p.length < 5) return;
  const cat = p[0][0], lvl = +p[0][1];
  const ta = new Set(p[3].split(",").map((x) => x.trim())), tb = new Set(p[4].split(",").map((x) => x.trim()));
  DILEMMAS.push({ id: DILEMMAS.length, cat, lvl, a: p[1].trim(), b: p[2].trim(), ta, tb });
});
module.exports = { DILEMMAS, DCATS: CATS };

// ============================================================
// HANDS OVER — Données des épreuves et répliques du présentateur
// ============================================================
// Chaque paire donne deux mots proches. Les indices sont marqués A, B ou X quand ils vont aux deux.
const T = (a, b, list) => ({ a, b, clues: list.split(",").map((x) => { const [w, t] = x.split("/"); return { w: w.trim(), t: t || "X" }; }) });
const PAIRS = [
  T("la plage", "la piscine", "sable/A,vagues/A,chlore/B,carrelage/B,maillot/X,serviette/X,soleil/X,parasol/X,mouettes/A,plongeoir/B"),
  T("le cinéma", "le théâtre", "écran/A,pop-corn/A,rideau/B,scène/B,fauteuils/X,obscurité/X,billet/X,applaudissements/B,bande-annonce/A,costumes/B"),
  T("un chat", "un lion", "ronron/A,canapé/A,savane/B,crinière/B,griffes/X,moustaches/X,sieste/X,chasse/X,croquettes/A,rugissement/B"),
  T("une pizza", "une tarte", "tomate/A,mozzarella/A,pâte/X,four/X,fruits/B,pâtisserie/B,part/X,chaud/X,livraison/A,sucre/B"),
  T("un hôpital", "un hôtel", "médecin/A,urgences/A,réception/B,valise/B,chambre/X,lit/X,couloir/X,ascenseur/X,infirmière/A,pourboire/B"),
  T("le football", "le rugby", "ballon rond/A,penalty/A,mêlée/B,essai/B,arbitre/X,stade/X,maillot/X,équipe/X,gardien/A,plaquage/B"),
  T("un vampire", "un fantôme", "dents/A,cercueil/A,drap/B,chaînes/B,nuit/X,château/X,peur/X,hanter/B,cape/A,transparent/B"),
  T("une guitare", "un piano", "cordes/X,médiator/A,touches/B,pédale/B,concert/X,accord/X,mélodie/X,tabouret/B,amplificateur/A,solo/X"),
  T("un avion", "un bateau", "ailes/A,décollage/A,port/B,ancre/B,passagers/X,voyage/X,capitaine/X,hublot/X,turbulences/A,vagues/B"),
  T("la neige", "la pluie", "luge/A,bonhomme/A,parapluie/B,flaque/B,froid/X,hiver/X,nuages/X,météo/X,skis/A,bottes/B"),
  T("un médecin", "un dentiste", "stéthoscope/A,ordonnance/A,fraise/B,molaire/B,cabinet/X,blouse/X,rendez-vous/X,douleur/X,thermomètre/A,anesthésie/B"),
  T("un pirate", "un cowboy", "perroquet/A,trésor/A,cheval/B,saloon/B,chapeau/X,aventure/X,duel/X,carte/X,crochet/A,lasso/B"),
  T("un café", "un thé", "expresso/A,grains/A,infusion/B,théière/B,tasse/X,chaud/X,matin/X,sucre/X,mousse/A,sachet/B"),
  T("un robot", "un extraterrestre", "circuits/A,batterie/A,soucoupe/B,antennes/B,métal/X,futur/X,espace/X,voix/X,programme/A,planète/B"),
  T("le carnaval", "le mariage", "masques/A,déguisement/A,alliance/B,robe blanche/B,musique/X,danse/X,foule/X,fête/X,confettis/A,gâteau/B"),
  T("une bibliothèque", "une librairie", "emprunt/A,carte/A,caisse/B,vitrine/B,livres/X,silence/X,étagères/X,rayon/X,retour/A,promotion/B"),
  T("un bagel", "un croissant", "sésame/A,saumon/A,beurre/B,boulangerie/B,petit déjeuner/X,four/X,farine/X,miettes/X,trou/A,pur beurre/B"),
  T("le désert", "la jungle", "dunes/A,chameau/A,lianes/B,singe/B,chaleur/X,aventure/X,explorateur/X,soif/X,mirage/A,humidité/B"),
];
const HOST = {
  intro: ["Bonsoir et bienvenue dans la seule émission où l'on perd ce que l'on a de plus précieux. Vos mains.", "Les caméras tournent, les mains tremblent. Que le spectacle commence.", "Ce soir, nous allons perdre quelques mains et sûrement quelques amitiés.", "Installez-vous, posez vos mains bien à plat. Elles ne resteront pas toutes."],
  next: ["Prochaine épreuve, ne touchez à rien. Enfin si, touchez, c'est le principe.", "Un petit changement d'ambiance pour la suite.", "Le public s'impatiente. Moi aussi.", "Je vous laisse deux secondes pour paniquer."],
  count: ["Mains sur la table.", "Silence sur le plateau.", "On tourne. Personne ne bouge.", "Respirez. Ou pas."],
  lose: ["Une main de moins. Heureusement qu'on en a deux.", "Le public vous remercie pour ce sacrifice.", "Il paraît que la deuxième main repousse. C'est faux.", "Quelqu'un a une trousse de secours ? Non ? Tant pis.", "Couvrez-moi ça, les enfants regardent."],
  win: ["Bravo, vous avez évité le pire. Pour l'instant.", "Applaudissements enregistrés.", "Quel talent. Quel dommage que ça ne serve à rien."],
  ghost: ["Bienvenue chez les fantômes. Ici personne ne vous entend crier. Enfin si, un peu.", "Votre carrière s'arrête ici. Votre carrière de fantôme commence.", "Asseyez-vous, cher fantôme. Votre chaise est encore tiède."],
  none: ["Personne ne perd rien. C'est suspect.", "Un tour sans casse, le producteur est déçu.", "Toutes les mains sont là. Je recompte. Toutes. Dommage."],
  end: ["Et voilà notre grand gagnant, avec encore ses mains. Profitez-en.", "Le rideau tombe. Les mains restantes sont à récupérer à la sortie."],
  trial: {
    croco: ["Notre crocodile a mal aux dents. Soyez doux.", "Douze dents, un seul caractère de cochon.", "Il n'a pas mangé depuis l'émission de la semaine dernière."],
    collision: ["Posez vos mains où vous voulez. Mais pas toutes au même endroit.", "Un numéro, une case, une main. Et parfois une crêpe de doigts."],
    simon: ["On éteint la lumière. Les clochettes vont vous parler.", "Écoutez bien les clochettes. Elles ne sonnent qu'une fois, comme le glas."],
    reflex: ["Ma main est grande, la vôtre est petite. Faites-en bon usage.", "Je vais frapper la table. Je préfère que vos mains n'y soient plus."],
    stoppile: ["Un curseur, une zone dorée, et beaucoup de regrets.", "Arrêtez-le pile. Pile, j'ai dit."],
    coffre: ["Un coffre, trois chiffres, et tout le monde regarde vos doigts.", "Coopérez. Ça ne durera pas."],
    bombe: ["Une bombe, une mèche, et personne pour l'éteindre.", "Écoutez cette mèche. Elle chante pour vous."],
    coupdoeil: ["Ouvrez grand les yeux, les mains ne restent pas longtemps.", "Comptez vite. Moi je compte déjà les perdants."],
    imposteur: ["Un menteur est assis parmi vous. Il vous sourit.", "Méfiez-vous de vos voisins, surtout s'ils vous ressemblent."],
    doigts: ["Levez les doigts. Ceux qui vous restent.", "Un peu de calcul mental, avec les doigts de préférence."],
    ppc: ["Pierre, feuille, ciseaux. Surtout ciseaux.", "Le jeu le plus ancien du monde, avec un prix bien moderne."],
    hot: ["Les mains brûlent, la mienne aussi. Elle frappe fort.", "Touchez ce qui est chaud, fuyez ce qui tombe."],
    couteau: ["Le couteau entre les doigts. Un classique des fins de soirée.", "Écartez bien les doigts. Ça aide. Un peu."],
    etau: ["L'étau est graissé, les mains sont tendres.", "Tenez bon. Pas trop longtemps."],
    gants: ["Six gants, une surprise. Enfilez avec élégance.", "Un de ces gants a des dents. Lequel, mystère."],
    boite: ["Mettez la main dans la boîte. Et faites confiance à vos amis. Haha.", "Chaque boîte a son secret. L'une d'elles a faim."],
    bistouri: ["Docteur, le patient vous attend. Il est chatouilleux.", "Opérez sans trembler. Le patient, lui, tremble pour deux."],
  },
  after: {
    croco: ["Clac. Il avait faim finalement.", "Le crocodile vous remercie pour ce repas."],
    bombe: ["Boum. Quelqu'un a vu ma perruque ?", "La mèche ne mentait pas."],
    etau: ["Écrasé. Il fallait lâcher.", "L'étau ne pardonne pas, c'est son seul défaut."],
    couteau: ["Un doigt de moins sur la table. Ramassez-le, il peut servir.", "Le rythme, toujours le rythme."],
    gants: ["Ce gant vous allait très bien. Dommage pour ce qu'il y avait dedans.", "Bien enfilé, mal choisi."],
    boite: ["Elle mordait. Comme promis.", "La boîte avait faim, et vous étiez là."],
    reflex: ["Ma main a frappé. La vôtre était encore là.", "Trop lent. Ou trop pressé, je ne sais plus."],
    bistouri: ["Le patient a hurlé. Le chirurgien aussi.", "Rendez-moi cette pince."],
  },
};
const pick = (a) => a[Math.floor(Math.random() * a.length)];
module.exports = { PAIRS, HOST, pick };

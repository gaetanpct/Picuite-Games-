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
  intro: ["Bonsoir et bienvenue dans la seule émission où l'on perd ce que l'on a de plus précieux. Vos mains.", "Les caméras tournent, les mains tremblent. Que le spectacle commence.", "Ce soir, nous allons perdre quelques mains et sûrement quelques amitiés."],
  next: ["Prochaine épreuve, ne touchez à rien. Enfin si, touchez, c'est le principe.", "Un petit changement d'ambiance pour la suite.", "Le public s'impatiente. Moi aussi.", "Je vous laisse deux secondes pour paniquer."],
  lose: ["Une main de moins. Heureusement qu'on en a deux.", "Le public vous remercie pour ce sacrifice.", "Il paraît que la deuxième main repousse. C'est faux.", "Quelqu'un a une trousse de secours ? Non ? Tant pis."],
  win: ["Bravo, vous avez évité le pire. Pour l'instant.", "Applaudissements enregistrés.", "Quel talent. Quel dommage que ça ne serve à rien."],
  ghost: ["Bienvenue chez les fantômes. Ici personne ne vous entend crier. Enfin si, un peu.", "Votre carrière s'arrête ici. Votre carrière de fantôme commence."],
  none: ["Personne ne perd rien. C'est suspect.", "Un tour sans casse, le producteur est déçu."],
  end: ["Et voilà notre grand gagnant, avec encore ses mains. Profitez-en.", "Le rideau tombe. Les mains restantes sont à récupérer à la sortie."],
};
const pick = (a) => a[Math.floor(Math.random() * a.length)];
module.exports = { PAIRS, HOST, pick };

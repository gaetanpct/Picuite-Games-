// ============================================================
// ZOOMALOU — Commentateur sportif, côté navigateur
// Le serveur envoie un événement (z:com). On tire une réplique dans la banque, sans répéter les dernières,
// on l'affiche en sous-titre et on la fait dire par la voix du navigateur si le réglage le permet.
// Réglage dans zoom.com, "voix" (voix et sous-titres), "texte" (sous-titres seuls) ou "off".
// ============================================================
(function () {
  const BANK = {
    intro: [
      "Bienvenue sur {circuit}, les moteurs chauffent et le public est déjà debout !",
      "Mesdames et messieurs, direction {circuit}. Ça va secouer !",
      "Nous voici à {circuit}. Un circuit tout neuf, personne ne le connaît, tout est possible.",
      "{circuit} ! On m'annonce une piste piégeuse, gardez les yeux ouverts.",
      "Bonsoir à tous, ici votre commentateur en direct de {circuit}.",
      "Le soleil, la poussière et l'odeur du pneu chaud. Bienvenue à {circuit} !",
      "Prochaine épreuve, {circuit}. Les mécaniciens serrent les derniers boulons.",
      "On change de décor, cap sur {circuit}. Qui va dompter cette piste ?",
      "{circuit}, un nom qui fait déjà trembler les rétroviseurs.",
      "Installez-vous confortablement, la course à {circuit} va bientôt commencer.",
    ],
    go: [
      "Feu vert ! C'est parti !", "Et c'est parti pour la course !", "Les voilà lancés !", "Départ donné, ça pousse fort !",
      "Ils s'élancent tous ensemble, quel départ !", "Pied au plancher, la course est lancée !", "Go go go ! Tout le monde fonce !", "Et ça démarre en trombe !",
    ],
    tete1: [
      "{an} prend la tête de la course !", "C'est {an} qui mène la danse !", "{an} s'installe aux commandes !", "{an} est devant, tout le monde à ses trousses !",
      "Belle entame de {an}, en tête pour l'instant.", "{an} ouvre la route, la meute suit derrière.",
    ],
    tete: [
      "Changement en tête, {an} passe devant !", "{an} prend le commandement, {bn} perd sa place !", "Nouveau leader, c'est {an} !", "{an} vient chiper la première place à {bn} !",
      "Retournement de situation, {an} est devant !", "Et voilà {an} en tête, {bn} n'a rien pu faire.",
    ],
    double: [
      "{an} double {bn} !", "Joli dépassement de {an} sur {bn} !", "{an} passe {bn}, proprement !", "{bn} se fait déposer par {an} !",
      "Quelle manœuvre de {an}, {bn} ne l'a pas vu venir !", "{an} plonge à l'intérieur et passe {bn} !", "Et hop, {an} laisse {bn} derrière !", "{bn} perd une place au profit de {an}.",
      "Coup de volant gagnant pour {an}, {bn} est dépassé !", "{an} prend le meilleur sur {bn} !",
    ],
    doubleTete: [
      "{an} double {bn} et prend la tête !", "Dépassement pour la victoire, {an} passe {bn} !", "{an} s'empare de la première place devant {bn} !",
      "Énorme ! {an} déborde {bn} et file en tête !", "{an} vient de passer {bn} pour la première place !",
    ],
    duel: [
      "Roue contre roue entre {an} et {bn} !", "{an} et {bn} ne se lâchent plus !", "Quel duel entre {an} et {bn} !", "Ils sont collés, {an} et {bn} se battent pour chaque mètre !",
      "{an} et {bn}, c'est un match dans le match !", "Personne ne veut céder entre {an} et {bn} !", "Ça frotte entre {an} et {bn} !", "On retient son souffle, {an} et {bn} côte à côte !",
    ],
    aspi: [
      "{an} se cale dans l'aspiration de {bn} !", "{an} profite du sillage de {bn}, attention !", "{bn} sert de coupe-vent à {an} !", "{an} colle {bn} et prend de l'élan !",
      "Aspiration parfaite pour {an} derrière {bn}.",
    ],
    chute: [
      "Oh non ! {an} tombe dans le vide !", "{an} rate son atterrissage et retourne au point de contrôle !", "Quelle chute pour {an} !", "{an} a visé un peu trop loin, c'est la chute !",
      "Grand plongeon pour {an}, il faut tout recommencer depuis le dernier point !", "{an} s'envole... et disparaît. Aïe !",
    ],
    faute: [
      "Faute de {an} qui repart du point de contrôle !", "Petite sortie de route pour {an} !", "{an} perd le contrôle, quel dommage !", "Aïe, {an} s'est fait piéger !",
      "{an} part à la faute, ça coûte du temps !", "{an} a pris un mauvais chemin, retour au dernier point.", "Oups ! {an} va devoir se remettre dans le rythme.",
    ],
    envol: [
      "Quel envol pour {an} !", "{an} fait du vol plané !", "Regardez-moi ce saut de {an} !", "{an} touche presque les nuages !", "{an} décolle, cette voiture a des ailes !",
      "Long vol pour {an}, l'atterrissage va être sportif !",
    ],
    remontee: [
      "Remontée fantastique de {an} !", "{an} était dernier, le voilà dans le bon wagon !", "Quelle remontée de {an} !", "{an} n'a pas dit son dernier mot !",
      "Attention à {an} qui revient de nulle part !",
    ],
    final: [
      "Dernière ligne droite pour {an} !", "{an} voit déjà la ligne d'arrivée !", "Plus que quelques virages pour {an} !", "{an} entame le dernier secteur, tout est encore possible !",
    ],
    finalSerre: [
      "Dernière ligne droite et {an} n'a que quelques mètres d'avance sur {bn} !", "Ça va se jouer à rien entre {an} et {bn} !", "{bn} revient sur {an}, quel final !",
      "Final haletant entre {an} et {bn} !",
    ],
    premier: [
      "{an} franchit la ligne en premier, en {ts} !", "Et c'est {an} qui coupe la ligne le premier, {ts} !", "{an} termine en tête en {ts}, bravo !", "Drapeau à damier pour {an} en {ts} !",
      "{an} boucle le circuit en {ts}, le temps à battre !",
    ],
    meilleur: [
      "{an} signe le meilleur temps, {ts} !", "Nouveau temps de référence pour {an}, {ts} !", "{an} fait mieux que tout le monde avec {ts} !", "Record de la course pour {an} en {ts} !",
    ],
    arrive: [
      "{an} termine en {ts}.", "{an} passe la ligne, {ts}.", "Arrivée de {an} en {ts}.", "{an} rentre au garage avec {ts}.",
    ],
    photo: [
      "Photo-finish entre {an} et {bn} !", "Incroyable, {an} et {bn} arrivent presque ensemble !", "Il faudra la photo pour départager {an} et {bn} !", "À un cheveu ! {an} et {bn} dans le même souffle !",
    ],
    ouvre: [
      "{an} ouvre le bal et pose le premier temps.", "C'est à {an} de lancer la course !", "{an} part en éclaireur sur ce circuit inconnu.", "Premier en piste, {an}. Place au spectacle.",
    ],
    pose: [
      "Au tour de {an} de poser un temps.", "{an} s'élance à son tour.", "{an} entre en piste, voyons ce que ça donne.", "Place à {an}, moteur rugissant.",
    ],
    duelEssence: [
      "Dernière place pour {an}, il faut battre {bn} et ses {ts} !", "Pour {an}, l'objectif est clair, faire mieux que {ts} !", "{an} contre la montre, {bn} a posé {ts}.", "Il faut sauver sa place, {an} doit descendre sous {ts} !",
    ],
    dernierEssai: [
      "Plus d'essence pour {an}, c'est le tout dernier essai !", "Dernière chance pour {an}, il n'y a plus de réservoir !", "Tout ou rien pour {an} !",
    ],
    retry: ["{an} recommence depuis la ligne.", "Nouvel essai pour {an}.", "{an} repart, on efface tout.", "On reprend tout, {an} est relancé."],
    avance: [
      "{an} a {ts} d'avance sur {bn} !", "Ça sent bon pour {an}, {ts} d'avance !", "{an} est dans le bon tempo, {ts} devant {bn}.", "Le chrono sourit à {an}, {ts} d'avance !",
    ],
    retard: [
      "{an} accuse {ts} de retard sur {bn}.", "{an} est derrière le temps de {bn}, {ts} à rattraper !", "Il manque {ts} à {an}, il faut attaquer !", "{an} est en retard de {ts}, ça se complique.",
    ],
    egal: ["{an} est pile dans le temps de {bn} !", "Au centième près, {an} et {bn} sont ensemble !", "{an} roule exactement au rythme de {bn} !"],
    essence: [
      "Le réservoir de {an} sonne creux !", "Plus que quelques gouttes d'essence pour {an} !", "{an} roule sur la réserve, attention !", "La jauge de {an} clignote !",
    ],
    tempsPose: ["{an} pose {ts}.", "{ts} pour {an}, pas mal du tout.", "{an} rentre avec {ts}.", "Temps de {an}, {ts}."],
    recordEssence: ["{an} prend la tête avec {ts} !", "Meilleur temps pour {an}, {ts} !", "{an} met tout le monde d'accord, {ts} !"],
    battu: [
      "{an} bat {bn} et sauve sa place !", "Mission accomplie pour {an}, {bn} passe dernier !", "{an} fait mieux que {bn} avec {ts} !", "Ouf ! {an} n'est plus dernier, à {bn} de jouer !",
    ],
    elimine: ["{an} est à sec, c'est l'élimination.", "Fin de course pour {an}, le réservoir est vide.", "{an} doit rendre les clés, éliminé !", "Plus d'essence, plus d'espoir, {an} sort de la course."],
    abandon: ["{an} abandonne.", "{an} jette l'éponge.", "{an} rentre au stand, la course est finie."],
    survieOut: ["{an} est le dernier à passer, éliminé !", "Couperet pour {an} !", "La survie s'arrête ici pour {an}.", "{an} sort de la course, trop tard au point de contrôle !"],
    victoire: [
      "Victoire de {an} ! Quelle course !", "{an} remporte cette manche, bravo !", "C'est gagné pour {an} !", "{an} monte sur la plus haute marche !",
      "Et la victoire revient à {an}, chapeau !", "{an} s'impose avec panache !",
    ],
  };
  const C = { mode: "voix", recent: [], voice: null };
  try { C.mode = localStorage.getItem("zoom.com") || "voix"; } catch (e) { /* stockage indisponible */ }
  const pickVoice = () => { try { const vs = speechSynthesis.getVoices(); C.voice = vs.find((v) => /^fr(-|_)FR/i.test(v.lang) && /google|natural|neural|amelie|thomas|audrey/i.test(v.name)) || vs.find((v) => /^fr/i.test(v.lang)) || null; } catch (e) { C.voice = null; } };
  if (typeof speechSynthesis !== "undefined") { pickVoice(); try { speechSynthesis.onvoiceschanged = pickVoice; } catch (e) { /* rien */ } }
  function fill(s, m) { return s.replace(/\{(\w+)\}/g, (_, k) => (m[k] != null && m[k] !== "" ? m[k] : k === "ac" || k === "bc" ? "voiture" : "?")); }
  function line(m) {
    const list = BANK[m.k]; if (!list) return ""; const free = list.filter((s) => !C.recent.includes(s)); const pool = free.length ? free : list;
    const s = pool[(m.n || Math.floor(Math.random() * 1e6)) % pool.length]; C.recent.push(s); if (C.recent.length > 40) C.recent.shift(); return fill(s, m);
  }
  let hideT = 0;
  function show(text) {
    const box = document.getElementById("z-com"); if (!box) return; box.textContent = "🎙️ " + text; box.classList.remove("z-com--hide"); box.classList.add("z-com--on");
    clearTimeout(hideT); hideT = setTimeout(() => { box.classList.add("z-com--hide"); box.classList.remove("z-com--on"); }, 1800 + text.length * 45);
  }
  function speak(text) {
    if (C.mode !== "voix" || typeof speechSynthesis === "undefined") return;
    try { speechSynthesis.cancel(); const u = new SpeechSynthesisUtterance(text); u.lang = "fr-FR"; if (C.voice) u.voice = C.voice; u.rate = 1.12; u.pitch = 1.05; u.volume = 0.95; speechSynthesis.speak(u); } catch (e) { /* voix indisponible */ }
  }
  C.on = function (m) { if (C.mode === "off" || !m || !m.k) return; const t = line(m); if (!t) return; show(t); speak(t); C.lastText = t; };
  C.setMode = function (v) { C.mode = v; try { localStorage.setItem("zoom.com", v); } catch (e) { /* rien */ } if (v !== "voix") try { speechSynthesis.cancel(); } catch (e) { /* rien */ } };
  C.next = function () { const order = ["voix", "texte", "off"]; C.setMode(order[(order.indexOf(C.mode) + 1) % order.length]); return C.mode; };
  C.label = (v) => ({ voix: "Voix et sous-titres", texte: "Sous-titres seuls", off: "Coupé" }[v || C.mode]);
  C.BANK = BANK;
  window.ZoomCom = C;
})();

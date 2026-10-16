// De quoi suivre une passion année après année dès l'enfance. Chaque domaine propose plusieurs façons de s'y investir.
const { reg, out } = require("../lifekit");

const young = { school: true, ages: [8, 17] };
const keen = (dom, f) => (p) => 0.8 + (p.interest && p.interest[dom] ? Math.min(p.interest[dom], 8) / 3 : 0) + (f ? f(p) : 0);

// ---- sport ----
reg({ id: "entrainement_extra", grp: "sport", dom: ["sport"], l: "T'entraîner en plus", ic: "🏃", d: "Des séances en plus après l'école. Tu progresses, tes devoirs un peu moins.", need: young, cool: 0, w: 6, fx: { sport: 6, sante: 1, courage: 1, notes: -2 }, fit: keen("sport", (p) => (p.stats.sport >= 50 ? 0.5 : 0)) });
reg({ id: "tournoi", grp: "sport", dom: ["sport"], l: "Disputer un tournoi", ic: "🥇", d: "Une compétition régionale, avec des vrais maillots et des gens qui crient depuis les gradins.", need: young, cool: 0, w: 6, fit: keen("sport"),
  outs: [out(0.3, "Tu gagnes le tournoi. On te porte en triomphe, et une coupe prend la place d'honneur sur la cheminée.", { sport: 5, repute: 4, bonheur: 7, courage: 2 }, true), out(0.5, "Tu finis en milieu de tableau, avec des progrès et quelques courbatures.", { sport: 4, bonheur: 2 }), out(0.2, "Tu te tords la cheville dès le premier match. Tu observes le reste depuis un banc.", { sport: -2, sante: -3, bonheur: -4 })] });
reg({ id: "stage_sportif", grp: "sport", dom: ["sport"], l: "Faire un stage sportif pendant les vacances", ic: "⛺", d: "Une semaine entière à t'entraîner avec des passionnés (300 €).", need: young, cost: 300, cool: 1, w: 4, fit: keen("sport"), fx: { sport: 7, sociable: 2, bonheur: 3 } });

// ---- arts ----
reg({ id: "atelier_dessin", grp: "arts", dom: ["arts"], l: "Suivre un atelier de dessin", ic: "🖌️", d: "Du fusain, de la peinture et des critiques gentilles.", need: young, cool: 0, w: 6, fx: { creatif: 5, bonheur: 3, notes: -1 }, fit: keen("arts", (p) => (p.traits.creatif >= 55 ? 0.5 : 0)) });
reg({ id: "expo_ecole", grp: "arts", dom: ["arts"], l: "Exposer tes œuvres à l'école", ic: "🖼️", d: "Tu accroches tes œuvres au mur du couloir. Tout le monde passe devant, et certains regardent.", need: young, cool: 1, w: 4, fit: keen("arts"),
  outs: [out(0.5, "On remarque ton travail, et une professeure te glisse que tu as du talent.", { creatif: 4, repute: 3, bonheur: 5 }, true), out(0.5, "Quelqu'un colle un chewing-gum sur ton chef-d'œuvre. Tu continues quand même.", { creatif: 2, courage: 2, bonheur: -1 })] });

// ---- musique ----
reg({ id: "cours_musique", grp: "arts", dom: ["music"], l: "Prendre des cours de musique", ic: "🎼", d: "Un instrument, un prof patient et des gammes à n'en plus finir (200 €).", need: young, cost: 200, cool: 0, w: 6, fx: { creatif: 4, intel: 1, bonheur: 2 }, fit: keen("music", (p) => (p.traits.creatif >= 55 ? 0.5 : 0)) });
reg({ id: "fanfare", grp: "arts", dom: ["music"], l: "Rejoindre la fanfare de la ville", ic: "🎺", d: "Défilés, kermesses et sourires crispés sous la pluie.", need: young, cool: 0, w: 5, fit: keen("music"), fx: { creatif: 3, sociable: 3, bonheur: 4 } });
reg({ id: "concert_ecole", grp: "arts", dom: ["music"], l: "Jouer au concert de l'école", ic: "🎤", d: "Tu montes sur scène devant tous les parents.", need: young, cool: 1, w: 4, fit: keen("music"),
  outs: [out(0.55, "Tu joues sans une fausse note et la salle applaudit longtemps.", { creatif: 4, repute: 3, bonheur: 6, courage: 2 }, true), out(0.45, "Ta corde casse au milieu du morceau. Tu finis en chantant, ce qui est pire.", { courage: 3, bonheur: -2 })] });

// ---- cinéma et vidéo ----
reg({ id: "video_amis", grp: "arts", dom: ["screen"], l: "Filmer des vidéos avec tes amis", ic: "📱", d: "Des scénarios improvisés, des cascades douteuses et des montages à la va-vite.", need: young, cool: 0, w: 6, fx: { creatif: 4, sociable: 2, bonheur: 4 }, fit: keen("screen", (p) => (p.traits.creatif >= 55 ? 0.5 : 0)) });
reg({ id: "montage_video", grp: "arts", dom: ["screen"], l: "Apprendre le montage vidéo", ic: "🎞️", d: "Des logiciels, des tutoriels et des nuits blanches devant l'écran.", need: young, cool: 0, w: 5, fx: { creatif: 4, intel: 2, notes: -1 }, fit: keen("screen") });

// ---- esprit ----
reg({ id: "club_sciences", grp: "ecole", dom: ["intel"], l: "Rejoindre le club de sciences", ic: "🔬", d: "Des expériences, des fumées colorées et un prof dont les cheveux se dressent.", need: young, cool: 0, w: 5, fx: { intel: 4, notes: 3, creatif: 1 }, fit: keen("intel", (p) => (p.stats.intel >= 55 ? 0.5 : 0)) });
reg({ id: "olympiades", grp: "ecole", dom: ["intel"], l: "Participer aux olympiades", ic: "🧮", d: "Un concours où l'on résout des problèmes que les adultes évitent.", need: { school: true, ages: [11, 17] }, cool: 1, w: 4, fit: keen("intel"),
  outs: [out(0.35, "Tu finis dans les premiers du département. Ton nom est lu à voix haute dans la cour.", { intel: 5, notes: 4, repute: 4, bonheur: 5 }, true), out(0.65, "Tu ne gagnes rien, mais tu rentres avec deux nouvelles idées et un stylo offert.", { intel: 3, notes: 1 })] });

// ============================================================
// BUS BAZAR — Plan du bus, objets, types de passagers (serveur et client)
// Repère local du bus. x vers la droite, z vers l'avant, y vers le haut. Le cap yaw regarde vers (sin yaw, cos yaw).
// ============================================================
(function (root, factory) {
  if (typeof module !== "undefined" && module.exports) module.exports = factory();
  else root.BBL = factory();
})(typeof window !== "undefined" ? window : globalThis, function () {
  const BUS = { x0: -1.5, x1: 1.5, z0: -7.8, z1: 7.2, h: 2.3, len: 16, wid: 3.2 };
  const DOOR = { x: 1.5, z: 4.6, w: 1.3 };          // porte d'entrée sur le flanc droit
  const REAR = { x: 0, z: -7.9, w: 1.1 };           // porte de secours à l'arrière
  const DRIVER = { x: -0.75, z: 6.35, wheelZ: 6.95 };
  const ROWS = 7;
  const seats = [];
  for (let r = 0; r < ROWS; r++) {
    const z = 3.0 - r * 1.0;
    [-1.28, -0.78, 0.78, 1.28].forEach((x, k) => seats.push({ i: seats.length, row: r, k, x, z, aisle: Math.abs(x) < 1, side: x < 0 ? -1 : 1 }));
  }
  // zones de choc rectangulaires [x0, x1, z0, z1]
  const boxes = [];
  for (let r = 0; r < ROWS; r++) { const z = 3.0 - r * 1.0; boxes.push([0.55, 1.5, z - 0.42, z + 0.42]); boxes.push([-1.5, -0.55, z - 0.42, z + 0.42]); }
  boxes.push([-1.5, -0.2, 5.55, 5.8]);       // comptoir de la cabine
  boxes.push([-1.5, -0.2, 5.8, 7.25]);       // siège du conducteur
  boxes.push([-1.5, -0.9, 4.1, 4.95]);       // chariot de service
  boxes.push([1.1, 1.5, 5.8, 6.5]);          // trousse de secours
  boxes.push([-1.5, -0.95, -7.1, -6.4]);     // établi
  boxes.push([0.95, 1.5, -7.1, -6.4]);       // extincteur
  const stations = [
    { id: "cart", x: -1.12, z: 4.55, r: 1.4, label: "Chariot de service", role: "steward", give: ["snack", "drink"] },
    { id: "aid", x: 1.12, z: 6.15, r: 1.3, label: "Trousse de secours", role: "steward", give: ["aid"] },
    { id: "bench", x: -1.12, z: -6.75, r: 1.4, label: "Établi", role: "mechanic", give: ["tools"] },
    { id: "ext", x: 1.12, z: -6.75, r: 1.3, label: "Extincteur", role: "mechanic", give: ["ext"] },
    { id: "bucketstand", x: 0.7, z: -7.45, r: 1.1, label: "Réserve de seaux", role: "steward", give: ["bucket"] },
    { id: "hatch", x: -0.5, z: -7.45, r: 1.2, label: "Trappe du moteur", role: "mechanic", give: [] },
  ];
  // emplacements pour ranger les bagages
  const slots = [
    { id: 0, x: -1.05, y: 0, z: -4.6, kind: "sol" }, { id: 1, x: -1.05, y: 0, z: -5.5, kind: "sol" },
    { id: 2, x: 1.05, y: 0, z: -4.6, kind: "sol" }, { id: 3, x: 1.05, y: 0, z: -5.5, kind: "sol" },
    { id: 4, x: -1.1, y: 1.75, z: 2.0, kind: "haut" }, { id: 5, x: -1.1, y: 1.75, z: -0.5, kind: "haut" },
    { id: 6, x: 1.1, y: 1.75, z: 2.0, kind: "haut" }, { id: 7, x: 1.1, y: 1.75, z: -0.5, kind: "haut" },
  ];
  // objets que l'on peut porter
  const ITEMS = {
    snack: { label: "Casse-croûte", color: "#e8a23a", size: 0.18, w: 0.1, tip: "pour un passager affamé" },
    drink: { label: "Boisson", color: "#4aa3e0", size: 0.16, w: 0.1, tip: "pour un passager assoiffé" },
    bucket: { label: "Seau", color: "#9aa5b1", size: 0.22, w: 0.2, tip: "pour un passager barbouillé" },
    tools: { label: "Caisse à outils", color: "#d6452f", size: 0.28, w: 0.35, tip: "pour réparer le bus" },
    ext: { label: "Extincteur", color: "#e0302a", size: 0.2, w: 0.3, tip: "pour éteindre un feu" },
    aid: { label: "Trousse de secours", color: "#f4f4f4", size: 0.2, w: 0.15, tip: "pour soigner et consoler" },
    mop: { label: "Serpillière", color: "#b9a37a", size: 0.2, w: 0.15, tip: "pour nettoyer le sol" },
    crate: { label: "Colis", color: "#b98a52", size: 0.42, w: 0.6, tip: "à ranger dans la soute ou le porte-bagages" },
    bag: { label: "Valise", color: "#6f55c8", size: 0.34, w: 0.45, tip: "à rendre à son propriétaire" },
    chick: { label: "Poulet en fuite", color: "#f2d65a", size: 0.2, w: 0.2, tip: "à remettre dans sa caisse" },
  };
  // types de colis
  const CARGO = {
    valises: { label: "Valises ordinaires", pay: 20, risk: 0.1, color: "#6f55c8", note: "Aucun souci, ou presque." },
    poulets: { label: "Caisse de poulets", pay: 45, risk: 0.5, color: "#f2d65a", note: "Si la caisse est secouée, les poulets s'échappent." },
    feux: { label: "Feux d'artifice", pay: 70, risk: 0.65, color: "#e0302a", note: "Ne supporte ni les flammes ni les gros chocs." },
    fut: { label: "Fût de cidre", pay: 40, risk: 0.45, color: "#8a5a2b", note: "Fuit après un choc, et le sol devient glissant." },
    statue: { label: "Statue fragile", pay: 85, risk: 0.55, color: "#c9d3dc", note: "Se brise si elle tombe ou prend un choc." },
    piano: { label: "Piano droit", pay: 95, risk: 0.35, color: "#2b2b33", note: "Très lourd, il glisse partout s'il n'est pas rangé." },
  };
  // types de passagers
  const KINDS = {
    normal: { label: "Voyageur tranquille", fare: 30, risk: 0.1, decay: 1, scare: 1, hunger: 1, note: "Rien à signaler." },
    grincheux: { label: "Grincheux", fare: 38, risk: 0.35, decay: 1.7, scare: 1, hunger: 1, note: "Se plaint de tout et s'énerve vite." },
    nerveux: { label: "Nerveux", fare: 32, risk: 0.3, decay: 1, scare: 2.2, hunger: 1, note: "Panique à chaque secousse." },
    gourmand: { label: "Gourmand", fare: 34, risk: 0.2, decay: 1, scare: 1, hunger: 2.4, note: "A toujours faim ou soif." },
    farceur: { label: "Farceur", fare: 36, risk: 0.5, decay: 1.2, scare: 0.6, hunger: 1, note: "Fait des bêtises, jette des affaires, ouvre les portes." },
    dormeur: { label: "Dormeur", fare: 26, risk: 0.1, decay: 0.5, scare: 1.3, hunger: 0.6, note: "Dort, mais se réveille de mauvaise humeur." },
    enfant: { label: "Enfant surexcité", fare: 18, risk: 0.45, decay: 1, scare: 0.8, hunger: 1.8, note: "Court partout et se glisse dans la cabine." },
    vip: { label: "Personnalité exigeante", fare: 90, risk: 0.55, decay: 2, scare: 1.2, hunger: 1.3, note: "Paie très cher, mais n'attend rien ni personne." },
    malade: { label: "Estomac fragile", fare: 28, risk: 0.4, decay: 1, scare: 1.1, hunger: 0.7, note: "Le moindre virage le rend vert." },
    fetard: { label: "Fêtard", fare: 40, risk: 0.6, decay: 0.9, scare: 0.5, hunger: 1.5, note: "Chante, bouscule, et s'énerve si on le calme mal." },
  };
  const KIND_IDS = Object.keys(KINDS);
  const NEEDS = {
    faim: { icon: "🍞", label: "a faim", item: "snack", time: 55 },
    soif: { icon: "🥤", label: "a soif", item: "drink", time: 55 },
    nausee: { icon: "🤢", label: "est barbouillé", item: "bucket", time: 28 },
    peur: { icon: "😱", label: "a peur", hold: "Rassurer", time: 40 },
    ennui: { icon: "🥱", label: "s'ennuie", hold: "Faire la conversation", time: 70 },
    pipi: { icon: "🚽", label: "doit descendre vite", stop: true, time: 80 },
    cigarette: { icon: "🚬", label: "allume une cigarette", hold: "Confisquer", time: 25 },
    valise: { icon: "🧳", label: "veut sa valise", item: "bag", time: 75 },
    place: { icon: "💺", label: "cherche une place", seat: true, time: 40 },
  };
  const NAMES = ["Josette", "Gaston", "Mireille", "Bernard", "Yvonne", "Kevin", "Fatou", "Hugo", "Léonie", "Armand", "Paulette", "Samir", "Colette", "Théo", "Nadège", "Marcel", "Pénélope", "Roméo", "Ginette", "Oscar", "Zoé", "Albert", "Mamadou", "Chantal", "Basile", "Odile", "Raymond", "Ines", "Lucien", "Solène", "Mehdi", "Berthe", "Gaspard", "Louise", "Ahmed", "Jocelyne", "Fernand", "Maëlle", "Anselme", "Brigitte"];
  const HATS = ["aucun", "casquette", "chapeau", "bonnet", "couronne", "melon"];
  const SKIN = ["#f6d3b3", "#e7b48a", "#c68a5e", "#8d5a3b", "#5e3b27", "#fbe0c9"];
  const CLOTH = ["#d9534f", "#5bc0de", "#f0ad4e", "#5cb85c", "#9b59b6", "#e67e9a", "#3f6fb5", "#c9b037", "#2fa59a", "#8e6e53"];
  const ROLES = [
    { id: "driver", label: "Conducteur", icon: "🚌", color: "#f2b705", desc: "Reste au volant, conduit, klaxonne, ouvre et ferme les portes." },
    { id: "steward", label: "Hôtesse ou steward", icon: "🍞", color: "#e8553c", desc: "Sert les repas et les boissons, rassure, accueille et choisit les passagers à l'embarquement." },
    { id: "mechanic", label: "Mécano", icon: "🔧", color: "#2f78d1", desc: "Répare le moteur, les pneus et éteint les feux." },
    { id: "porter", label: "Bagagiste", icon: "📦", color: "#3aa653", desc: "Choisit et range les colis, rattrape les poulets, et sort les fauteurs de trouble." },
  ];
  const ROLE_IDS = ROLES.map((r) => r.id);

  // collisions d'un cercle avec les murs, la porte et les sièges. open vaut vrai quand la porte est ouverte et que le quai existe
  function collide(x, z, r, open) {
    const gapH = DOOR.w / 2 - 0.12; const inGap = Math.abs(z - DOOR.z) <= gapH;
    if (open && x > BUS.x1 - r * 0.5) {
      // du côté du quai, ou en train de passer la porte
      z = Math.max(-1.5, Math.min(10, z));
      if (x < BUS.x1 + r) { if (!inGap) { x = x < BUS.x1 ? BUS.x1 - r : BUS.x1 + r; } else z = Math.max(DOOR.z - gapH, Math.min(DOOR.z + gapH, z)); }
      x = Math.min(9, x);
      if (x > BUS.x1 + r) return { x, z, out: true };
    }
    const xmax = open && inGap ? BUS.x1 + 0.3 : BUS.x1 - r;
    x = Math.max(BUS.x0 + r, Math.min(xmax, x)); z = Math.max(BUS.z0 + r, Math.min(BUS.z1 - r, z));
    for (let i = 0; i < boxes.length; i++) {
      const b = boxes[i]; const cx = Math.max(b[0], Math.min(b[1], x)), cz = Math.max(b[2], Math.min(b[3], z)); const dx = x - cx, dz = z - cz; const d2 = dx * dx + dz * dz;
      if (d2 < r * r) {
        if (d2 > 1e-8) { const d = Math.sqrt(d2); x = cx + (dx / d) * r; z = cz + (dz / d) * r; }
        else { const l = x - b[0], rt = b[1] - x, t = z - b[2], bt = b[3] - z; const m = Math.min(l, rt, t, bt); if (m === l) x = b[0] - r; else if (m === rt) x = b[1] + r; else if (m === t) z = b[2] - r; else z = b[3] + r; }
      }
    }
    return { x, z, out: x > BUS.x1 + 0.05 };
  }
  const dist2 = (a, b) => (a.x - b.x) * (a.x - b.x) + (a.z - b.z) * (a.z - b.z);
  return { BUS, DOOR, REAR, DRIVER, ROWS, seats, boxes, stations, slots, ITEMS, CARGO, KINDS, KIND_IDS, NEEDS, NAMES, HATS, SKIN, CLOTH, ROLES, ROLE_IDS, collide, dist2 };
});

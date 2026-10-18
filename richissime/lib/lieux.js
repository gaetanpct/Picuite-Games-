// ============================================================
// RICHISSIME DESTINY — Les lieux de vie des carrières
// Quand la carrière décolle, la vie suit. Une star de cinéma s'installe à Los Angeles, une vedette de la chanson à Las Vegas ou à Londres,
// un footballeur vit dans la ville de son club. Les sportifs jouent dans de vrais clubs, de plus en plus grands.
// ============================================================
const R = require("./rules");
const C = require("./core");

// villes par métier et par niveau minimum (le dernier palier atteint s'applique)
const CITIES = {
  cinema: [[1, ["Paris", "Los Angeles", "Londres"]], [2, ["Los Angeles", "Paris", "Londres"]], [3, ["Los Angeles", "Beverly Hills", "Malibu", "New York"]], [4, ["Beverly Hills", "Malibu", "Los Angeles"]]],
  chanteur: [[2, ["Paris", "Londres", "Nashville"]], [3, ["Londres", "Los Angeles", "Nashville", "Paris"]], [4, ["Las Vegas", "Los Angeles", "Londres", "Miami"]]],
  dj: [[1, ["Berlin", "Ibiza", "Paris"]], [2, ["Ibiza", "Miami", "Berlin"]], [3, ["Las Vegas", "Ibiza", "Miami"]]],
  humour: [[2, ["Paris", "Montréal", "Londres"]], [3, ["Las Vegas", "Paris", "Los Angeles"]], [4, ["Las Vegas", "Los Angeles"]]],
  mannequin: [[1, ["Paris", "Milan"]], [2, ["Paris", "Milan", "New York"]], [3, ["New York", "Paris", "Milan", "Los Angeles"]]],
  mode: [[2, ["Paris", "Milan"]], [3, ["Paris", "Milan", "New York"]]],
  createur: [[2, ["Los Angeles", "Dubaï", "Paris", "Miami"]], [3, ["Los Angeles", "Dubaï", "Miami"]]],
  cabaret: [[2, ["Paris", "Las Vegas"]], [3, ["Las Vegas", "Paris"]]],
  casino: [[2, ["Las Vegas", "Monaco"]], [3, ["Las Vegas", "Monaco"]]],
  danse: [[2, ["Paris", "New York", "Londres"]], [3, ["New York", "Londres", "Paris"]]],
  esport: [[2, ["Séoul", "Berlin", "Paris", "Los Angeles"]], [3, ["Séoul", "Los Angeles", "Berlin"]]],
  golf_pro: [[1, ["Orlando", "Marbella", "Dubaï"]]],
  astronaute: [[1, ["Houston"]]],
  tennis: [[2, ["Monaco", "Paris", "Londres"]], [3, ["Monaco", "Miami", "Dubaï"]]],
  ski: [[2, ["Chamonix", "Val d'Isère", "Courchevel"]]],
  cyclisme: [[2, ["Nice", "Toulouse", "Girone"]]],
  boxe: [[3, ["Las Vegas", "Londres", "Paris"]]],
  f1: [[2, ["Monaco", "Milan", "Londres"]]],
};

// clubs par sport et par niveau, avec la ville du club
const CLUBS = {
  foot: [
    [0, [["AS Cannes", "Cannes"], ["Racing Club de France Football", "Paris"], ["Angoulême Charente FC", "Angoulême"], ["Olympique Saint-Quentin", "Saint-Quentin"]]],
    [1, [["FC Rouen", "Rouen"], ["Dijon FCO", "Dijon"], ["FC Versailles", "Versailles"], ["US Orléans", "Orléans"], ["Le Puy Foot 43", "Le Puy-en-Velay"]]],
    [2, [["AS Saint-Étienne", "Saint-Étienne"], ["Stade de Reims", "Reims"], ["Montpellier Hérault Sport Club", "Montpellier"], ["Red Star FC", "Paris"], ["FC Sochaux-Montbéliard", "Sochaux"]]],
    [3, [["Paris Saint-Germain", "Paris"], ["Real Madrid", "Madrid"], ["FC Barcelone", "Barcelone"], ["Manchester City", "Manchester"]]],
  ],
  rugby: [
    [0, [["Rugby Club Langon", "Langon"], ["Stade Nantais", "Nantes"], ["Rugby Club de Suresnes", "Suresnes"]]],
    [1, [["SC Albi", "Albi"], ["RC Massy Essonne", "Massy"]]],
    [2, [["CA Brive", "Brive"], ["Provence Rugby", "Aix-en-Provence"]]],
    [3, [["Rugby Club Toulonnais", "Toulon"], ["Stade Toulousain", "Toulouse"], ["Leinster Rugby", "Dublin"]]],
  ],
  sportpro: [
    [0, [["le club municipal", null], ["l'association sportive de la ville", null]]],
    [1, [["un club de deuxième division", null]]],
    [2, [["un grand club de première division", null]]],
    [3, [["l'un des plus grands clubs du pays", null]]],
    [4, [["le club le plus titré du monde", null]]],
  ],
  cyclisme: [[0, [["le vélo club local", null]]], [1, [["une équipe continentale", null]]], [2, [["une équipe du World Tour", null]]], [3, [["l'équipe la plus puissante du peloton", null]]]],
  esport: [[0, [["une équipe amateur", null]]], [1, [["une équipe régionale", null]]], [2, [["une organisation européenne", null]]], [3, [["l'organisation la plus titrée de la planète", null]]]],
};

const pickOf = (rng, a) => a[Math.floor(rng() * a.length)];

function citiesFor(track, level) {
  const t = CITIES[track]; if (!t) return null;
  let found = null;
  t.forEach(([lv, list]) => { if (level >= lv) found = list; });
  return found;
}
function clubFor(track, level, rng) {
  const t = CLUBS[track]; if (!t) return null;
  let found = null;
  t.forEach(([lv, list]) => { if (level >= lv) found = list; });
  return found ? pickOf(rng, found) : null;
}

function move(g, p, city, why, rep) {
  if (!city || p.city === city) return;
  const from = p.city;
  p.city = city;
  p.journal.push({ age: p.age, text: why.replace("$ville", city), ic: "🏙️", tag: "lieu" });
  if (rep) rep.lines.push("🏙️ " + why.replace("$ville", city));
}

// À appeler chaque année après la carrière. Ne déménage que quand la situation change (promotion, nouveau métier, nouveau club).
function sync(g, p, rep) {
  if (!p.job || p.prison || p.retired) return;
  const rng = g.rng;
  const key = p.job.track + ":" + p.job.level;
  p.lieu = p.lieu || {};
  const sport = !!(CLUBS[p.job.track]);
  // transfert de club tous les 3 à 5 ans, ou à chaque changement de niveau
  if (sport) {
    const changedLevel = p.lieu.key !== key;
    const due = p.job.club && p.lieu.clubSince !== undefined && p.age - p.lieu.clubSince >= 3 && rng() < 0.28;
    if (changedLevel || due || !p.job.club) {
      const c = clubFor(p.job.track, p.job.level, rng);
      if (c && c[0] !== p.job.club) {
        const old = p.job.club;
        p.job.club = c[0];
        p.lieu.clubSince = p.age;
        const txt = old ? "Tu quittes " + old + " pour " + c[0] + "." : "Tu signes à " + c[0] + ".";
        p.journal.push({ age: p.age, text: txt, ic: "🏟️", tag: "travail" });
        if (rep) rep.lines.push("🏟️ " + txt);
        if (c[1]) move(g, p, c[1], "Tu t'installes à $ville, près du club.", rep);
      }
    }
  } else p.job.club = undefined;
  if (p.lieu.key !== key) {
    const list = citiesFor(p.job.track, p.job.level);
    if (list && !sport) {
      // un seul déménagement par palier, avec une bonne chance de changer de ville
      if (!list.includes(p.city)) move(g, p, pickOf(rng, list), "Ta carrière décolle. Tu t'installes à $ville.", rep);
    } else if (list && sport && !p.job.club) {
      if (!list.includes(p.city)) move(g, p, pickOf(rng, list), "Ta carrière te mène à $ville.", rep);
    }
    p.lieu.key = key;
  }
}

module.exports = { sync, citiesFor, clubFor, CITIES, CLUBS };

// ============================================================
// RICHISSIME DESTINY — Justice, prison, argent sale et organisations
//  p.dirty        l'argent sale, en liquide. Il compte dans la fortune mais ne sert pas aux achats normaux. On le blanchit ou on le dépense dans l'ombre.
//  p.pris         l'état de la détention en cours (clan, respect, plan d'évasion, dossier, corruption…)
//  p.org          l'organisation criminelle dont on fait partie
// ============================================================
const C = require("./core");
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const rint = (rng, a, b) => a + Math.floor(rng() * (b - a + 1));

const ORGS = ["Le Clan des Corbeaux", "La Famille Moretti", "Les Frères de la Cour", "Le Syndicat du Port", "La Main Noire", "Le Cercle des Ombres", "Les Loups du Bitume", "La Confrérie des Verrous", "Le Réseau Santini", "Les Cousins du Sud"];
const RANKS = ["Recrue", "Homme de main", "Chef d'équipe", "Lieutenant", "Bras droit", "Parrain"];

function dirty(p) { return Math.max(0, Math.round(p.dirty || 0)); }
function addDirty(p, n) { p.dirty = Math.max(0, Math.round((p.dirty || 0) + n)); }

// partage un revenu entre propre et sale
function earn(p, amount, shareDirty) {
  const d = Math.round(amount * shareDirty);
  addDirty(p, d);
  p.cash += amount - d;
  return d;
}

// les dépenses de l'ombre se paient d'abord avec l'argent sale
function canPay(p, cost, ill) { return p.cash + (ill ? dirty(p) : 0) >= cost; }
function pay(p, cost, ill) {
  let rest = cost;
  if (ill) { const d = Math.min(dirty(p), rest); addDirty(p, -d); rest -= d; }
  p.cash -= rest;
}

const MARKERS = ["milieu_contact", "illicite", "voleur", "fugitif", "mafia", "parrain", "cartel_1", "cartel_2", "cartel_3", "trafic"];
// un gain d'argent sera sale s'il vient d'une activité illégale
function isDirtyFx(fx) {
  if (!fx) return false;
  if (fx.sale !== undefined) return false;
  if (fx.record > 0 || fx.prison) return true;
  const fl = fx.flag; if (!fl) return false;
  const arr = typeof fl === "string" ? [fl] : Array.isArray(fl) ? fl : Object.keys(fl);
  return arr.some((f) => MARKERS.includes(f));
}
// convertit argent en argent sale (gain) ou le prélève d'abord sur l'argent sale (dépense)
function dirtify(fx, v, p) {
  const out = Object.assign({}, fx);
  if (v > 0) { const d = Math.round(v * 0.85); out.argent = v - d; out.sale = (out.sale || 0) + d; }
  else if (v < 0) { const need = -v; const fromD = Math.min(dirty(p), need); out.argent = -(need - fromD); out.sale = (out.sale || 0) - fromD; }
  return out;
}

// ---------- saisies ----------
function seize(g, p, sev, lines, why) {
  const rng = g.rng;
  const cashLoss = Math.round(Math.max(0, p.cash) * clamp(sev * (0.6 + rng() * 0.6), 0, 0.85));
  p.cash -= cashLoss;
  let assetLoss = 0;
  p.assets.forEach((a) => {
    const f = a.kind === "immo" ? sev * 0.35 : sev * (0.5 + rng() * 0.5);
    const cut = Math.round(a.value * clamp(f, 0, 0.8));
    a.value -= cut; assetLoss += cut;
  });
  const shield = p.pris && p.pris.bribed ? Math.min(0.5, p.pris.bribed * 0.15) : 0;
  const dirtyLoss = Math.round(dirty(p) * clamp(sev * 0.55 * (1 - shield), 0, 0.7));
  addDirty(p, -dirtyLoss);
  const total = cashLoss + assetLoss + dirtyLoss;
  if (total > 2000 && lines) lines.push("💸 La justice saisit " + C.fmt(total) + (why ? " (" + why + ")" : "") + (dirtyLoss ? ", dont " + C.fmt(dirtyLoss) + " d'argent caché retrouvé." : "."));
  return total;
}

// ---------- entrée en prison ----------
function pris(p) {
  if (!p.pris) p.pris = { gang: null, rep: 0, plan: 0, dossier: 0, bribed: 0, conduct: 0, snitch: false, lien: 0 };
  return p.pris;
}
function onSentence(g, p, yrs, opts) {
  opts = opts || {};
  p.pris = null; pris(p);
  p.pris.since = p.age;
  const rng = g.rng;
  const lines = [];
  const sev = clamp(0.05 + yrs * 0.03 + (opts.heavy ? 0.12 : 0), 0.05, 0.7);
  seize(g, p, sev, lines, "frais de justice et biens saisis");
  const long = yrs >= 2;
  // le couple
  if (p.partner && p.partner.npc !== undefined) {
    const n = p.npcs.find((q) => q.id === p.partner.npc);
    if (n) {
      const chance = clamp(0.08 + yrs * 0.05 - (n.close - 60) / 250 - (p.partner.status === "marie" ? 0.08 : 0), 0.03, 0.8);
      if (long && rng() < chance) {
        n.kind = "ex"; n.close = Math.min(n.close, 12); p.partner = null; p.stats.bonheur = clamp(p.stats.bonheur - 10, 0, 100);
        lines.push("💔 " + n.name + " ne supporte pas ta condamnation et te quitte.");
        p.journal.push({ age: p.age, text: n.name + " t'a quitté(e) à cause de la prison.", ic: "💔", tag: "amour" });
      } else if (long) { n.close = clamp(n.close - rint(rng, 3, 10), 0, 100); lines.push("💞 " + n.name + " reste à tes côtés, mais l'épreuve pèse sur votre couple."); }
    }
  }
  // les amis et la famille
  p.npcs.forEach((n) => {
    if (!n.alive) return;
    if (n.kind === "bestfriend" || n.kind === "friend") n.close = clamp(n.close - rint(rng, long ? 6 : 2, long ? 20 : 8), 0, 100);
    else if (n.kind === "mere" || n.kind === "pere" || n.kind === "sibling") n.close = clamp(n.close - rint(rng, 2, 8), 0, 100);
    else if (n.kind === "child" && n.age < 18) n.close = clamp(n.close - rint(rng, 2, 6) * Math.min(3, yrs), 0, 100);
  });
  if (long) lines.push("🫥 Tes amis prennent leurs distances. Les visites se font rares.");
  p.stats.repute = clamp(p.stats.repute - (opts.heavy ? 8 : 4), 0, 100);
  // les clefs d'une organisation déjà liée
  if (p.org) { p.pris.gang = p.org.name; p.pris.rep += 10 + p.org.rank * 6; lines.push("🕴️ Ton organisation te protège même ici. Les détenus savent à qui ils ont affaire."); }
  lines.forEach((l) => p.yearLog.push(l));
}

// ---------- chaque année derrière les barreaux ----------
function prisonYear(g, p, rep) {
  const S = pris(p);
  const rng = g.rng;
  // ceux du dehors oublient
  p.npcs.forEach((n) => { if (n.alive && (n.kind === "friend" || n.kind === "bestfriend") && rng() < 0.5) n.close = clamp(n.close - (S.lien > 0 ? 0 : 2), 0, 100); });
  if (S.lien > 0) S.lien--;
  // le couple tient ou craque
  if (p.partner && p.partner.npc !== undefined && rng() < clamp(0.05 + (p.prison.total - 1) * 0.015 - (S.lien > 0 ? 0.05 : 0), 0.01, 0.3)) {
    const n = p.npcs.find((q) => q.id === p.partner.npc);
    if (n) { n.kind = "ex"; n.close = Math.min(n.close, 10); p.partner = null; rep.lines.push("💔 Les mois passent. " + n.name + " finit par ne plus répondre à tes lettres, et vous vous séparez."); p.journal.push({ age: p.age, text: n.name + " a mis fin à votre histoire pendant ta détention.", ic: "💔", tag: "amour" }); }
  }
  // un clan rapporte un peu
  if (S.gang && !S.snitch && rng() < 0.55) {
    const gain = Math.round((400 + rng() * 5000) * (1 + S.rep / 50) / 10) * 10;
    addDirty(p, gain);
    rep.lines.push("🕶️ Ton clan t'a fait passer " + C.fmt(gain) + " en liquide cette année.");
  }
  // le respect monte avec le temps, la bonne conduite s'accumule
  S.rep = Math.max(0, S.rep - 1);
  // un balance est menacé
  if (S.snitch && rng() < 0.22) { p.stats.sante = clamp(p.stats.sante - rint(rng, 5, 14), 0, 100); rep.lines.push("🩹 Des détenus te font payer ta dénonciation. Tu en gardes des séquelles."); S.snitch = true; }
}

// ---------- sortie ----------
function onRelease(g, p, rep) {
  const S = pris(p);
  const rng = g.rng;
  p.prisHist = p.prisHist || [];
  p.prisHist.push({ age: p.age, yrs: p.prison ? p.prison.total : 0, gang: S.gang });
  p.exPris = { since: p.age, gang: S.gang };
  p.flags.ex_detenu = 1;
  if (S.gang && !S.snitch) {
    const rank = clamp(Math.floor(S.rep / 30), 0, 3);
    const had = !!p.org;
    p.org = { name: S.gang, rank: p.org ? Math.max(p.org.rank, rank) : rank, since: p.age };
    p.flags.mafia = 1;
    const pecule = Math.round((12000 + rng() * 60000) * (1 + rank * 0.8) / 100) * 100;
    addDirty(p, pecule);
    rep.lines.push("🕴️ Devant la prison, une voiture noire t'attend. " + S.gang + " t'accueille comme l'un des siens (" + RANKS[p.org.rank].toLowerCase() + ") et te remet " + C.fmt(pecule) + " en liquide.");
    p.journal.push({ age: p.age, text: "Sorti(e) de prison, tu rejoins " + S.gang + (had ? " avec un grade plus élevé." : "."), ic: "🕴️", tag: "justice" });
    g.news(p, "🕴️ " + p.name + " sort de prison et rejoint " + S.gang + ".", "crime");
  }
  if (S.snitch) { p.flags.balance = 1; p.flagTtl.balance = 10; rep.lines.push("🤐 Ton passé de balance te précède. Certains t'attendent à la sortie."); }
  // la vie d'avant a changé
  if (p.partner && p.partner.npc !== undefined) {
    const n = p.npcs.find((q) => q.id === p.partner.npc);
    if (n) { n.close = clamp(n.close - rint(rng, 0, 8), 0, 100); }
  }
  p.pris = null;
  // les scènes de l'après-peine, dès la première année dehors
  const f = (id) => p.forced.push({ id });
  f("sp_casier");
  if (p.partner) f("sp_couple"); else f("sp_seul");
  if (p.org) f("sp_orga");
  if (dirty(p) > 0 && rng() < 0.5) f("sp_planque");
  if (p.npcs.some((n) => n.alive && n.kind === "friend") && rng() < 0.5) f("sp_amis");
}

// ---------- chaque année dehors ----------
function yearly(g, p, rep) {
  const rng = g.rng;
  const PS = require("./pro").state(p);
  // l'argent sale peut disparaître
  const d = dirty(p);
  if (d > 20000 && !p.prison) {
    const prob = 0.015 + PS.heat / 600 + (d > 500000 ? 0.03 : 0);
    if (rng() < prob) {
      const cut = Math.round(d * (0.2 + rng() * 0.35));
      addDirty(p, -cut);
      rep.lines.push(rng() < 0.5 ? "🔎 Une perquisition met la main sur " + C.fmt(cut) + " d'argent caché." : "🕳️ Quelqu'un a trouvé ta planque. " + C.fmt(cut) + " en liquide ont disparu.");
    }
  }
  // un évadé est recherché
  if (p.flags.fugitif && !p.prison && p.escapedLeft) {
    const prob = clamp(0.2 + PS.heat / 400 - PS.net / 500, 0.06, 0.55);
    if (rng() < prob) {
      const left = p.escapedLeft + rint(rng, 1, 3);
      p.escapedLeft = 0; delete p.flags.fugitif; delete p.flagTtl.fugitif;
      const FX = require("./fx");
      FX.applyFx(g, p, { prison: left, repute: -8, bonheur: -10 }, { slots: {}, vals: {}, hard: true });
      rep.lines.push("🚔 La police te retrouve. Tu retournes en prison pour " + left + " ans, évasion comprise.");
      g.news(p, "🚔 " + p.name + ", évadé(e), est repris(e).", "crime");
    } else if (!p.flags.fugitif) p.escapedLeft = 0;
  }
  // une organisation attend ses cotisations
  if (p.org && !p.prison) {
    const tribute = Math.round(Math.max(0, dirty(p)) * 0.04);
    if (tribute > 500) { addDirty(p, -tribute); rep.lines.push("🕴️ " + p.org.name + " prélève sa part, " + C.fmt(tribute) + "."); }
  }
}

// couverture automatique d'un découvert avec l'argent sale (au prix d'une commission)
function coverDeficit(p, rep) {
  if (p.cash >= 0 || dirty(p) <= 0) return;
  const need = -p.cash;
  const usable = Math.min(dirty(p), Math.ceil(need / 0.7));
  const got = Math.round(usable * 0.7);
  addDirty(p, -usable); p.cash += got;
  if (rep && usable > 1000) rep.lines.push("🧺 Pour payer tes dépenses, tu fais passer " + C.fmt(usable) + " d'argent sale par des circuits discrets. Il t'en reste " + C.fmt(got) + " de propre.");
}

// blanchiment, renvoie la part nette
function launder(g, p, amount, fee) {
  const a = Math.min(dirty(p), Math.round(amount));
  addDirty(p, -a);
  const net = Math.round(a * (1 - fee));
  p.cash += net;
  return { used: a, net };
}

// vente de la fortune pour le classement et l'affichage
function cleanWorth(p) { return Math.round(p.cash + C.assetsValue(p) - p.debt); }

// le grade d'organisation
function rankLabel(p) {
  if (!p.org) return null;
  const f = p.flags || {};
  if (f.cartel_3) return "Roi mondial de la drogue";
  if (f.cartel_2) return "Chef de réseau international";
  if (f.cartel_1) return "Parrain des ports";
  if (f.parrain) return RANKS[5];
  return RANKS[clamp(p.org.rank, 0, 4)];
}
function orgName(g) { return ORGS[Math.floor(g.rng() * ORGS.length)]; }

module.exports = { ORGS, RANKS, dirty, addDirty, earn, canPay, pay, isDirtyFx, dirtify, seize, pris, onSentence, prisonYear, onRelease, yearly, coverDeficit, launder, cleanWorth, rankLabel, orgName };

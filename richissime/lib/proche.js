"use strict";
// Interactions avec les proches (personnages secondaires) : conjoint, ex, amis, rivaux, famille.
const C = require("./core");

const FAMILY = ["mere", "pere", "sibling", "child", "grandparent"];
const clamp = C.clamp;

function group(n) {
  if (n.kind === "partner" || n.kind === "spouse") return "couple";
  if (n.kind === "ex") return "ex";
  if (n.kind === "friend" || n.kind === "bestfriend") return "ami";
  if (n.kind === "rival" || n.kind === "enemy") return "rival";
  if (FAMILY.includes(n.kind)) return "famille";
  return null;
}
function bump(n, d) { n.close = clamp(n.close + d, 0, 100); }
function st(p, k, d) { p.stats[k] = clamp(p.stats[k] + d, 0, 100); }
function pay(p, c) { p.cash -= c; }
function log(p, text, ic, tag) { p.yearLog.push(text); p.journal.push({ age: p.age, text, ic: ic || "🫂", tag: tag || "amour" }); }
function chance(p, n, base, k) { return clamp(base + (n.close - 50) / 200 + (p.stats.charme - 50) / 400 + (p.stats.repute - 50) / (k || 500), 0.05, 0.92); }

const ACTS = {
  couple: [
    { id: "soiree", l: "Soirée romantique", d: "Un dîner à deux. Coût 80 €. Rapproche et fait du bien au moral.", cost: 80,
      run(g, p, n) { bump(n, 7); st(p, "bonheur", 4); return "Tu as passé une soirée romantique avec " + n.name + "."; } },
    { id: "voyage", l: "Voyage à deux", d: "Une escapade qui compte. Coût 1 500 €. Gros gain de complicité.", cost: 1500,
      run(g, p, n) { bump(n, 14); st(p, "bonheur", 8); st(p, "sante", 2); return "Votre voyage avec " + n.name + " vous a rapprochés."; } },
    { id: "cadeau", l: "Offrir un beau cadeau", d: "Un présent choisi avec soin. Coût 400 €.", cost: 400,
      run(g, p, n) { bump(n, 9); st(p, "bonheur", 2); return n.name + " a été très touché" + (n.gender === "f" ? "e" : "") + " par ton cadeau."; } },
    { id: "parler", l: "Avoir une vraie discussion", d: "Mettre les choses à plat. Gratuit, mais cela peut mal tourner si le lien est faible.", cost: 0,
      run(g, p, n) { if (g.rng() < chance(p, n, 0.6)) { bump(n, 7); st(p, "bonheur", 3); return "Votre discussion avec " + n.name + " a fait du bien."; } bump(n, -6); st(p, "bonheur", -3); return "La discussion avec " + n.name + " a dégénéré en dispute."; } },
  ],
  ex: [
    { id: "reconquerir", l: "Tenter de reconquérir", d: "Retenter sa chance. Les chances dépendent du lien restant, de ton charme et de ta réputation. Impossible si tu es déjà en couple.", cost: 100,
      cond: (g, p) => !p.partner,
      run(g, p, n) {
        if (g.rng() < chance(p, n, 0.18, 400)) {
          n.kind = "partner"; p.partner = { npc: n.id, status: "couple", since: p.age }; n.close = Math.max(n.close, 62);
          st(p, "bonheur", 10); log(p, "Tu as reconquis " + n.name + ". Vous voilà de nouveau ensemble.", "💞"); return null;
        }
        bump(n, -5); st(p, "bonheur", -4); return n.name + " t'a repoussé" + (p.gender === "f" ? "e" : "") + ". Ce n'est pas encore le bon moment.";
      } },
    { id: "excuses", l: "Présenter des excuses", d: "Faire la paix sans arrière-pensée. Gratuit.", cost: 0,
      run(g, p, n) { bump(n, 10); st(p, "bonheur", 2); return "Tu as présenté tes excuses à " + n.name + ". L'ambiance s'est apaisée."; } },
    { id: "tourner", l: "Tourner la page", d: "Couper les ponts proprement. Tu retrouves de la sérénité.", cost: 0,
      run(g, p, n) { n.close = Math.min(n.close, 6); st(p, "bonheur", 4); return "Tu as tourné la page avec " + n.name + "."; } },
    { id: "vengeance", l: "Se venger discrètement", d: "Un mauvais coup à ton ex. Risqué pour ta réputation.", cost: 0, mature: true,
      run(g, p, n) { bump(n, -20); if (g.rng() < 0.45) { st(p, "repute", -8); return "Ta petite vengeance contre " + n.name + " a fait du bruit et t'a nui."; } st(p, "bonheur", 2); return "Ta vengeance contre " + n.name + " est restée secrète."; } },
  ],
  ami: [
    { id: "soiree", l: "Sortie entre amis", d: "Une bonne soirée. Coût 60 €.", cost: 60,
      run(g, p, n) { bump(n, 6); st(p, "bonheur", 4); return "Tu as passé une super soirée avec " + n.name + "."; } },
    { id: "service", l: "Demander un gros service", d: "Un prêt entre amis. Accepté surtout si le lien est solide, sinon cela refroidit.", cost: 0,
      run(g, p, n) { if (n.close >= 55 && g.rng() < chance(p, n, 0.6)) { const s = C.rint(g.rng, 500, 3000); p.cash += s; bump(n, -6); return n.name + " t'a prêté " + s + " €."; } bump(n, -6); return n.name + " a refusé de t'aider, et c'était gênant."; } },
    { id: "affaire", l: "Proposer une affaire", d: "Un projet en commun. Il faut un lien fort. Coût 1 000 €, gain possible plus important.", cost: 1000,
      cond: (g, p, n) => n.close >= 60,
      run(g, p, n) { if (g.rng() < chance(p, n, 0.5)) { const s = C.rint(g.rng, 2500, 9000); p.cash += s; bump(n, 6); st(p, "repute", 2); return "L'affaire avec " + n.name + " a bien marché. Tu récupères " + s + " €."; } bump(n, -10); return "L'affaire avec " + n.name + " a tourné court et le lien en a souffert."; } },
    { id: "reconcilier", l: "Renouer le contact", d: "Pour un lien devenu faible. Gratuit.", cost: 0,
      cond: (g, p, n) => n.close < 45,
      run(g, p, n) { bump(n, 13); return "Tu as renoué avec " + n.name + "."; } },
  ],
  rival: [
    { id: "coup_bas", l: "Lui jouer un mauvais tour", d: "Saboter discrètement. Il peut se retourner contre toi.", cost: 0, mature: true,
      run(g, p, n) { bump(n, -10); if (g.rng() < 0.3) { st(p, "repute", -8); return "Ton coup bas contre " + n.name + " a été découvert."; } st(p, "ambition", 0); st(p, "bonheur", 2); return "Ton coup bas contre " + n.name + " a fait mouche."; } },
    { id: "paix", l: "Proposer la paix", d: "Enterrer la hache de guerre. La réussite n'est pas garantie.", cost: 0,
      run(g, p, n) { if (g.rng() < chance(p, n, 0.4, 400)) { n.kind = "friend"; n.close = Math.max(n.close, 45); st(p, "bonheur", 4); return n.name + " a accepté la paix. Vous êtes désormais amis."; } bump(n, -3); return n.name + " a refusé ta main tendue."; } },
    { id: "defi", l: "Lancer un défi", d: "Un duel amical pour trancher. Gagner donne de la réputation, perdre en retire.", cost: 0,
      run(g, p, n) { const win = g.rng() < clamp((p.stats.intel + p.stats.sport + p.stats.charme) / 300, 0.15, 0.85); if (win) { st(p, "repute", 5); st(p, "bonheur", 3); bump(n, -4); return "Tu as battu " + n.name + " lors de votre défi."; } st(p, "repute", -3); bump(n, 3); return n.name + " a gagné votre défi."; } },
  ],
  famille: [
    { id: "temps", l: "Passer du temps ensemble", d: "Un week-end en famille. Gratuit.", cost: 0,
      run(g, p, n) { bump(n, 6); st(p, "bonheur", 3); return "Tu as passé du temps avec " + n.name + "."; } },
    { id: "cadeau", l: "Faire un cadeau", d: "Coût 300 €.", cost: 300,
      run(g, p, n) { bump(n, 8); st(p, "bonheur", 2); return n.name + " a adoré ton cadeau."; } },
    { id: "aide", l: "Aider financièrement", d: "Donner 1 000 € à ce proche. Le lien se renforce beaucoup.", cost: 1000,
      run(g, p, n) { bump(n, 12); st(p, "repute", 1); return "Tu as aidé " + n.name + " financièrement."; } },
    { id: "renouer", l: "Renouer le contact", d: "Pour un lien devenu faible. Gratuit.", cost: 0,
      cond: (g, p, n) => n.close < 45,
      run(g, p, n) { bump(n, 13); return "Tu as repris contact avec " + n.name + "."; } },
  ],
};

function actsFor(g, p, n) {
  const gr = group(n);
  if (!gr) return [];
  return ACTS[gr].filter((a) => (!a.mature || g.settings.mature) && (!a.cond || a.cond(g, p, n)) && (a.cost || 0) <= p.cash);
}
function eligible(g, p) {
  if (p.prison) return [];
  return p.npcs.filter((n) => n.alive && group(n) && (group(n) === "couple" || group(n) === "ex" || n.close >= 65 || n.close <= 30));
}
function offer(g, p) {
  return eligible(g, p).slice(0, 10).map((n) => ({ npc: n.id, name: n.name, kind: n.kind, close: Math.round(n.close), acts: actsFor(g, p, n).map((a) => ({ id: a.id, l: a.l, d: a.d, cost: a.cost || 0 })) })).filter((o) => o.acts.length);
}
function validate(g, p, sel) {
  if (!sel || !sel.npc) return { ok: false };
  const n = p.npcs.find((x) => x.id === sel.npc);
  if (!n || !n.alive) return { ok: false, error: "Ce proche n'est plus là." };
  const a = actsFor(g, p, n).find((x) => x.id === sel.act);
  if (!a) return { ok: false, error: "Cette action n'est plus possible." };
  return { ok: true, sel: { npc: n.id, act: a.id } };
}
function run(g, p, sel) {
  const n = p.npcs.find((x) => x.id === sel.npc);
  if (!n) return;
  const a = actsFor(g, p, n).find((x) => x.id === sel.act);
  if (!a) return;
  if (a.cost) pay(p, a.cost);
  const t = a.run(g, p, n);
  if (t) log(p, t, "🫂");
}
// Choix d'un robot. L'IA piquante ose davantage, l'IA sage reste calme.
function botPick(g, p, peaceful) {
  const style = (g.settings && g.settings.aiStyle) || "piquant";
  const base = style === "sage" ? 0.15 : style === "enfer" ? 0.5 : 0.32;
  if (g.rng() > base) return null;
  const os = offer(g, p);
  if (!os.length) return null;
  const pool = [];
  os.forEach((o) => o.acts.forEach((a) => {
    let w = 1;
    if (a.id === "reconquerir") w = style === "sage" ? 1 : 4;
    if (peaceful && (a.id === "coup_bas" || a.id === "vengeance")) w = 0;
    else if (a.id === "coup_bas" || a.id === "vengeance") w = style === "sage" ? 0 : style === "enfer" ? 5 : 2;
    if (a.id === "paix" || a.id === "excuses") w = style === "enfer" ? 0.5 : 2;
    if (a.cost > p.cash * 0.3) w = 0;
    if (w) pool.push({ sel: { npc: o.npc, act: a.id }, w });
  }));
  let r = g.rng() * pool.reduce((s, x) => s + x.w, 0);
  for (const x of pool) { r -= x.w; if (r <= 0) return x.sel; }
  return pool.length ? pool[pool.length - 1].sel : null;
}
module.exports = { offer, validate, run, botPick, group };

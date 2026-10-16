// Parties de cartes jouées pour de vrai (blackjack et poker à cinq cartes)
(function () {
  const RD = (window.RD = window.RD || {});
  const h = RD.h;
  const UI = (RD.miniUI = RD.miniUI || { sel: {} });
  const emit = (ev, d) => RD.emit(ev, d);
  const RNAME = { 11: "V", 12: "D", 13: "R", 14: "A" };

  function card(c, onClick, selected) {
    if (!c) return h("div.pcard.back", h("span.s", "✦"));
    const red = c.s === "♥" || c.s === "♦";
    return h("div.pcard" + (red ? ".red" : "") + (selected ? ".sel" : "") + (onClick ? ".click" : ""), onClick ? { on: { click: onClick }, role: "button", "aria-label": c.n } : null,
      h("span.r", RNAME[c.r] || String(c.r)), h("span.s", c.s));
  }
  const send = (m, action, arg) => { RD.play && RD.play("good"); emit("game:mini", { id: m.id, action, arg }); };
  const stakeText = (m) => (m.amount ? "Mise de " + RD.money(m.amount) + " chacun" : "Partie pour l'honneur");

  function blackjack(m) {
    const done = m.state === "done";
    const th = m.theirs, me = m.mine;
    const state = done ? null : me.stood ? "Tu as fini ta main. " + (th.stood ? "" : th.name + " réfléchit encore.") : th.stood ? th.name + " a fini sa main." : th.name + " réfléchit aussi.";
    return h("div.minibox",
      h("div.mini-side", h("div.mini-name", th.name), h("div.cards", th.cards.map((c) => card(c))),
        done ? h("div.mini-total" + (th.bust ? ".bad" : ""), th.bust ? "Trop de points (" + th.total + ")" : "Total " + th.total) : h("div.muted.small", th.cards.length + " cartes, une seule est visible")),
      h("div.mini-side.me", h("div.mini-name", "Toi"), h("div.cards", me.cards.map((c) => card(c))),
        h("div.mini-total" + (me.bust ? ".bad" : me.natural ? ".good" : ""), me.bust ? "Trop de points (" + me.total + ")" : me.natural ? "Blackjack ! 21 en deux cartes" : "Total " + me.total)),
      !done && m.canAct ? h("div.row", { style: { justifyContent: "center", marginTop: "10px" } },
        h("button.btn.good", { on: { click: () => send(m, "hit") } }, "Tirer une carte"),
        h("button.btn", { on: { click: () => send(m, "stand") } }, "Rester à " + me.total)) : null,
      state ? h("p.muted", { style: { textAlign: "center" } }, state) : null);
  }

  function poker(m) {
    const done = m.state === "done";
    const th = m.theirs, me = m.mine;
    const key = m.id + ":" + m.stage + ":" + me.cards.map((c) => c.n).join("");
    UI.sel[key] = UI.sel[key] || {};
    const sel = UI.sel[key];
    const picking = m.stage === "echange" && m.canAct;
    const cards = me.cards.map((c, i) => card(c, picking ? () => { sel[i] = !sel[i]; RD.render(); } : null, picking && sel[i]));
    const picked = Object.keys(sel).filter((i) => sel[i]).map(Number);
    let controls = null, info = null;
    if (!done && m.stage === "echange") {
      controls = picking ? h("div.row", { style: { justifyContent: "center", marginTop: "10px" } },
        h("button.btn.good", { on: { click: () => send(m, "draw", picked) } }, picked.length ? "Échanger " + picked.length + " carte" + (picked.length > 1 ? "s" : "") : "Garder ma main")) : null;
      info = picking ? "Touche les cartes que tu veux changer, puis valide." : "Tu as échangé. " + (m.oppDrawn ? "" : th.name + " choisit encore ses cartes.");
    } else if (!done && m.stage === "mise") {
      const facing = m.actions.includes("call");
      controls = m.canAct ? h("div.row", { style: { justifyContent: "center", marginTop: "10px" } },
        facing ? [h("button.btn.good", { on: { click: () => send(m, "call") } }, "Suivre (" + RD.money(m.raise) + " de plus)"), h("button.btn.bad", { on: { click: () => send(m, "fold") } }, "Se coucher")]
          : [h("button.btn", { on: { click: () => send(m, "check") } }, "Parole"), h("button.btn.good", { on: { click: () => send(m, "raise") } }, "Relancer de " + RD.money(m.amount))]) : null;
      info = m.canAct ? (facing ? th.name + " relance. Tu suis ou tu te couches ?" : "À toi de parler. Relancer double l'enjeu.") : "C'est à " + th.name + " de parler.";
    }
    return h("div.minibox",
      h("div.mini-side", h("div.mini-name", th.name), h("div.cards", th.cards.map((c) => card(c))), done && th.hand ? h("div.mini-total", th.hand) : null),
      h("div.mini-side.me", h("div.mini-name", "Toi"), h("div.cards", cards), me.hand ? h("div.mini-total", "Tu as " + me.hand) : null),
      controls, info ? h("p.muted", { style: { textAlign: "center" } }, info) : null,
      m.log && m.log.length ? h("div.small.muted", { style: { textAlign: "center" } }, m.log.map((l) => l.name + " " + l.text).join(" · ")) : null);
  }

  function one(m) {
    if (!m.involved) {
      return h("div.offer", h("p", m.ic + " " + m.a.name + " et " + m.b.name + " jouent au " + m.label.toLowerCase() + (m.amount ? " pour " + RD.money(m.amount) : " pour l'honneur") + "."),
        m.state === "done" ? h("p", { style: { fontWeight: 700 } }, m.result.pub) : h("p.muted", "La partie est en cours."));
    }
    const done = m.state === "done";
    return h("div.card", h("div.kicker", m.ic + " " + m.label + " contre " + m.theirs.name), h("h2", done ? "La partie est finie" : "À la table"),
      h("p.muted", stakeText(m)), !done && m.deadline ? RD.timerBar(m.deadline, 30000) : null,
      m.kind === "blackjack" ? blackjack(m) : poker(m),
      done ? h("div.mini-result" + (m.result.winner === null ? "" : m.result.winner === m.you ? ".good" : ".bad"),
        h("strong", m.result.winner === null ? "Égalité" : m.result.winner === m.you ? "Tu as gagné" + (m.result.stake ? " " + RD.money(m.result.stake) : "") : "Tu as perdu" + (m.result.stake ? " " + RD.money(m.result.stake) : "")), h("div", m.result.text)) : null);
  }

  RD.miniView = function (st) {
    const list = st.minis || [];
    if (!list.length) return h("div.card.waiting", h("h3", "Un instant"), h("div.dots", h("span", "•"), h("span", "•"), h("span", "•")));
    const mine = list.filter((m) => m.involved), others = list.filter((m) => !m.involved);
    return h("div", { style: { display: "grid", gap: "14px" } },
      mine.map(one),
      others.length ? h("div.card", h("div.kicker", "Autres tables"), others.map(one), mine.length ? null : h("p.muted", "Tu regardes les autres jouer, patience.")) : null);
  };
})();

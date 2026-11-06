// Page d'accueil — affiche les jeux découverts par le serveur
(function () {
  const el = (tag, attrs, ...kids) => {
    const n = document.createElement(tag);
    Object.keys(attrs || {}).forEach((k) => { if (k === "class") n.className = attrs[k]; else if (k === "style") n.setAttribute("style", attrs[k]); else n.setAttribute(k, attrs[k]); });
    kids.flat().forEach((c) => { if (c !== null && c !== undefined) n.appendChild(typeof c === "string" ? document.createTextNode(c) : c); });
    return n;
  };

  function card(g, i) {
    const c = g.colors || ["#7c5cff", "#1a1a2e"];
    const meta = (g.tags || []).slice(0, 3).join(" · ");
    return el("article", { class: "game", style: "--a:" + c[0] + ";--b:" + c[1] },
      el("div", { class: "game-top" },
        el("img", { src: g.logo, alt: "Logo " + g.name, width: 84, height: 84, loading: i > 3 ? "lazy" : "eager" }),
        el("div", {}, el("h3", {}, g.name), el("p", { class: "tagline" }, g.tagline))),
      el("div", { class: "game-body" },
        meta ? el("p", { class: "meta" }, meta) : null,
        el("p", { class: "pitch" }, g.pitch),
        (g.steps || []).length ? el("details", { class: "how-to" }, el("summary", {}, "Comment on joue"), el("ol", { class: "mini" }, g.steps.map((s) => el("li", {}, s)))) : null,
        g.note ? el("p", { class: "note" }, g.note) : null,
        el("a", { class: "btn play", href: "/" + g.id + "/" }, g.cta || "Jouer", el("span", { "aria-hidden": "true" }, " →"))));
  }

  function soon() {
    return el("article", { class: "game soon" },
      el("div", { class: "game-top" }, el("div", { class: "qmark", "aria-hidden": "true" }, "?"),
        el("div", {}, el("h3", {}, "Le prochain jeu"), el("p", { class: "tagline" }, "Une place est gardée sur la table."))),
      el("div", { class: "game-body" }, el("p", { class: "pitch" }, "Reviens de temps en temps, d'autres jeux arrivent.")));
  }

  fetch("api/games").then((r) => r.json()).then((games) => {
    const grid = document.getElementById("grid");
    grid.textContent = "";
    const sub = document.getElementById("sub"); if (sub) sub.textContent = games.length + " jeux à lancer entre amis, d'autres arrivent.";
    games.forEach((g, i) => grid.appendChild(card(g, i)));
    grid.appendChild(soon());
    const pick = document.getElementById("pick");
    games.forEach((g) => pick.appendChild(el("a", { class: "pickitem", href: "/" + g.id + "/", style: "--a:" + (g.colors || ["#7c5cff"])[0] },
      el("img", { src: g.logo, alt: "", width: 56, height: 56 }),
      el("div", {}, el("b", {}, g.name), el("p", {}, g["for"] || "")))));
  }).catch(() => {
    document.getElementById("grid").textContent = "Les jeux n'ont pas pu se charger. Recharge la page.";
  });
})();

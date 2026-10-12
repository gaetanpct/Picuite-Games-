// Petit bouton de retour vers Picuite Games, injecté dans chaque jeu
(function () {
  if (document.getElementById("pg-back")) return;
  var st = document.createElement("style");
  st.textContent = "#pg-back{position:fixed;left:10px;bottom:10px;z-index:99999;display:flex;align-items:center;gap:8px;padding:5px 12px 5px 6px;border:2.5px solid #1a1a2e;border-radius:99px;background:#ffd23f;color:#1a1a2e;font:700 13px/1 system-ui,sans-serif;text-decoration:none;box-shadow:2px 2px 0 #1a1a2e;opacity:.92}#pg-back:hover{opacity:1;transform:translateY(-1px)}#pg-back img{width:24px;height:24px}@media(max-width:700px){#pg-back{bottom:74px;padding:4px}#pg-back span{display:none}}";
  document.head.appendChild(st);
  var a = document.createElement("a");
  a.id = "pg-back"; a.href = "/"; a.title = "Retour à Picuite Games"; a.setAttribute("aria-label", "Retour à Picuite Games");
  a.innerHTML = '<img src="/logos/picuite.svg" alt=""><span>Picuite Games</span>';
  document.body.appendChild(a);
})();

// ============================================================
// MAIN MORTE — Le Goulag (client)
// Petite arène en 3D vue de haut. Chaque combattant se déplace, vise et lance des tomates.
// Trois tomates reçues et c'est perdu. Les autres joueurs regardent le combat en direct.
// ============================================================
(function () {
  const T = window.THREE;
  const H = { st: null, gl: null, root: null, built: false, snap: null, me: null, keys: {}, mouse: { x: 0, y: 0, down: false, has: false }, joy: null, aimTouch: null, lastSend: 0, lastIn: "", shots: {}, fx: [], seq: 0, fightKey: "" };
  let helpers = null;
  const PR = 0.55, SPEED = 5.2;
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
  const touchDev = () => window.matchMedia && window.matchMedia("(pointer: coarse)").matches;
  const el = (t, cls, txt) => { const e = document.createElement(t); if (cls) e.className = cls; if (txt != null) e.textContent = txt; return e; };

  function build() {
    if (H.built) return; H.built = true;
    const root = el("div", "ho-gl hidden"); root.id = "ho-gl"; document.body.appendChild(root); H.root = root;
    const cv = el("canvas", "ho-gl__cv"); root.appendChild(cv); H.cv = cv;
    const hud = el("div", "ho-gl__hud"); root.appendChild(hud);
    H.sideA = el("div", "ho-gl__side ho-gl__side--a"); H.sideB = el("div", "ho-gl__side ho-gl__side--b"); H.mid = el("div", "ho-gl__mid");
    hud.appendChild(H.sideA); hud.appendChild(H.mid); hud.appendChild(H.sideB);
    H.msg = el("div", "ho-gl__msg hidden"); root.appendChild(H.msg);
    H.help = el("div", "ho-gl__help"); root.appendChild(H.help);
    H.joyEl = el("div", "ho-gl__joy hidden"); H.joyKnob = el("i"); H.joyEl.appendChild(H.joyKnob); root.appendChild(H.joyEl);
    H.fireEl = el("button", "ho-gl__fire hidden", "🍅"); root.appendChild(H.fireEl);
    // scène
    if (T) {
      const R = new T.WebGLRenderer({ canvas: cv, antialias: true }); R.setPixelRatio(Math.min(2, window.devicePixelRatio || 1)); H.R = R;
      const sc = new T.Scene(); sc.background = new T.Color("#1a0d12"); sc.fog = new T.Fog("#1a0d12", 22, 40); H.sc = sc;
      H.cam = new T.PerspectiveCamera(48, 1, 0.1, 100);
      sc.add(new T.HemisphereLight("#ffe9d6", "#3a1620", 0.9)); const sun = new T.DirectionalLight("#fff3e0", 0.8); sun.position.set(4, 12, 6); sc.add(sun);
      const spot = new T.PointLight("#ff4060", 0.6, 30); spot.position.set(0, 6, 0); sc.add(spot);
      H.world = new T.Group(); sc.add(H.world);
      H.players = {};
    }
    // commandes
    window.addEventListener("keydown", (e) => { if (!active()) return; const k = e.key.toLowerCase(); H.keys[k] = true; if (k === " " || k.startsWith("arrow")) e.preventDefault(); if (k === " " && !e.repeat) H.shotQ = true; });
    window.addEventListener("keyup", (e) => { H.keys[e.key.toLowerCase()] = false; });
    cv.addEventListener("pointermove", (e) => { if (e.pointerType === "touch") return; H.mouse.x = e.clientX; H.mouse.y = e.clientY; H.mouse.has = true; });
    cv.addEventListener("pointerdown", (e) => {
      if (!active()) return;
      if (e.pointerType === "touch") { if (e.clientX < window.innerWidth * 0.45 && !H.joy) { H.joy = { id: e.pointerId, x: e.clientX, y: e.clientY, dx: 0, dy: 0 }; showJoy(); } else { H.aimTouch = { id: e.pointerId, x: e.clientX, y: e.clientY }; H.shotQ = true; } cv.setPointerCapture(e.pointerId); return; }
      H.mouse.x = e.clientX; H.mouse.y = e.clientY; H.mouse.has = true; H.mouse.down = true; H.shotQ = true;
    });
    cv.addEventListener("pointermove", (e) => { if (e.pointerType !== "touch") return; if (H.joy && H.joy.id === e.pointerId) { H.joy.dx = clamp((e.clientX - H.joy.x) / 50, -1, 1); H.joy.dy = clamp((e.clientY - H.joy.y) / 50, -1, 1); showJoy(); } if (H.aimTouch && H.aimTouch.id === e.pointerId) { H.aimTouch.x = e.clientX; H.aimTouch.y = e.clientY; } });
    const up = (e) => { if (e.pointerType === "touch") { if (H.joy && H.joy.id === e.pointerId) { H.joy = null; showJoy(); } if (H.aimTouch && H.aimTouch.id === e.pointerId) H.aimTouch = null; } else H.mouse.down = false; };
    cv.addEventListener("pointerup", up); cv.addEventListener("pointercancel", up);
    // bouton tomate, vise tout seul l'adversaire
    H.fireEl.addEventListener("pointerdown", (e) => { e.preventDefault(); H.autoAim = true; H.shotQ = true; H.fireHeld = true; });
    const fu = () => { H.fireHeld = false; }; H.fireEl.addEventListener("pointerup", fu); H.fireEl.addEventListener("pointercancel", fu); H.fireEl.addEventListener("pointerleave", fu);
    window.addEventListener("resize", resize);
    requestAnimationFrame(frame);
  }
  function showJoy() {
    if (!H.joyEl) return; const on = !!H.joy; H.joyEl.classList.toggle("ho-gl__joy--on", on);
    if (on) { H.joyEl.style.left = H.joy.x + "px"; H.joyEl.style.top = H.joy.y + "px"; H.joyKnob.style.transform = "translate(" + H.joy.dx * 34 + "px," + H.joy.dy * 34 + "px)"; }
  }
  const active = () => H.gl && H.gl.step === "fight" && H.me && (H.me === H.gl.a || H.me === H.gl.b);
  function resize() { if (!H.R || !H.root) return; const w = H.root.clientWidth || window.innerWidth, h = H.root.clientHeight || window.innerHeight; H.R.setSize(w, h, false); H.cam.aspect = w / h; H.cam.updateProjectionMatrix(); placeCam(); }
  // le combattant B voit l'arène depuis l'autre côté, chacun a son adversaire en haut de l'écran
  const flip = () => (H.gl && H.me === H.gl.b ? -1 : 1);
  function placeCam() {
    if (!H.cam) return; const f = flip(); const asp = H.cam.aspect || 1;
    // assez loin pour voir toute la largeur de l'arène, même sur un téléphone tenu droit
    const hf = Math.atan(Math.tan((H.cam.fov * Math.PI) / 360) * asp); const dist = Math.max(16.4, 8.2 / Math.tan(hf));
    H.cam.position.set(0, dist * 0.84, dist * 0.55 * f); H.cam.lookAt(0, 0, 0.9 * f); if (H.sc && H.sc.fog) { H.sc.fog.near = dist + 2; H.sc.fog.far = dist + 22; }
  }

  // ----- construction de l'arène -----
  function buildArena(gl) {
    if (!T || H.arenaFor === gl.arena) return; H.arenaFor = gl.arena; const W = H.world; while (W.children.length) W.remove(W.children[0]);
    const A = gl.arena;
    const cvs = document.createElement("canvas"); cvs.width = cvs.height = 256; const x = cvs.getContext("2d"); x.fillStyle = "#3b2a22"; x.fillRect(0, 0, 256, 256);
    for (let i = 0; i < 8; i++) for (let j = 0; j < 8; j++) { x.fillStyle = (i + j) % 2 ? "#4a352b" : "#3f2d24"; x.fillRect(i * 32, j * 32, 32, 32); }
    const tex = new T.CanvasTexture(cvs); tex.wrapS = tex.wrapT = T.RepeatWrapping; tex.repeat.set(2, 2);
    const floor = new T.Mesh(new T.PlaneGeometry(A * 2, A * 2), new T.MeshLambertMaterial({ map: tex })); floor.rotation.x = -Math.PI / 2; W.add(floor);
    const ring = new T.Mesh(new T.RingGeometry(1.2, 1.35, 40), new T.MeshBasicMaterial({ color: "#e63946", transparent: true, opacity: 0.5 })); ring.rotation.x = -Math.PI / 2; ring.position.y = 0.01; W.add(ring);
    // murs de barbelés
    const wm = new T.MeshLambertMaterial({ color: "#5a5f66" });
    [[0, -A, A * 2 + 0.4, 0.4], [0, A, A * 2 + 0.4, 0.4], [-A, 0, 0.4, A * 2], [A, 0, 0.4, A * 2]].forEach((w) => { const m = new T.Mesh(new T.BoxGeometry(w[2], 0.7, w[3]), wm); m.position.set(w[0], 0.35, w[1]); W.add(m); });
    for (let i = -A; i <= A; i += 1.75) [[i, -A], [i, A], [-A, i], [A, i]].forEach((p) => { const post = new T.Mesh(new T.CylinderGeometry(0.06, 0.06, 1.6, 6), new T.MeshLambertMaterial({ color: "#2b2b2b" })); post.position.set(p[0], 0.8, p[1]); W.add(post); });
    const crateM = new T.MeshLambertMaterial({ color: "#a0703c" }), bandM = new T.MeshLambertMaterial({ color: "#6b4524" });
    gl.crates.forEach((c) => { const g = new T.Group(); const b = new T.Mesh(new T.BoxGeometry(c.w, 1.1, c.d), crateM); b.position.y = 0.55; g.add(b); const band = new T.Mesh(new T.BoxGeometry(c.w + 0.04, 0.14, c.d + 0.04), bandM); band.position.y = 0.85; g.add(band); const band2 = band.clone(); band2.position.y = 0.25; g.add(band2); g.position.set(c.x, 0, c.z); W.add(g); });
    // projecteurs dans les coins
    [[-A, -A], [A, -A], [-A, A], [A, A]].forEach((p) => { const lamp = new T.Mesh(new T.SphereGeometry(0.25, 10, 8), new T.MeshBasicMaterial({ color: "#ffe9a8" })); lamp.position.set(p[0], 2.2, p[1]); W.add(lamp); });
    H.players = {}; H.shots = {};
  }
  function label(txt, hex) {
    const c = document.createElement("canvas"); c.width = 256; c.height = 64; const x = c.getContext("2d"); x.fillStyle = "rgba(10,4,8,0.75)"; x.fillRect(0, 8, 256, 48); x.fillStyle = hex; x.font = "bold " + (txt.length > 12 ? 24 : 30) + "px Fredoka, sans-serif"; x.textAlign = "center"; x.textBaseline = "middle"; x.fillText(txt.slice(0, 18), 128, 33);
    const sp = new T.Sprite(new T.SpriteMaterial({ map: new T.CanvasTexture(c), depthTest: false })); sp.scale.set(2.4, 0.6, 1); return sp;
  }
  function fighter(id) {
    if (H.players[id]) return H.players[id]; const hex = helpers.hexOf(id);
    const g = new T.Group(); const mat = new T.MeshLambertMaterial({ color: hex });
    const body = new T.Mesh(new T.CapsuleGeometry(0.42, 0.55, 4, 12), mat); body.position.y = 0.75; g.add(body);
    const eyeM = new T.MeshBasicMaterial({ color: "#ffffff" }); const pupM = new T.MeshBasicMaterial({ color: "#111" });
    const head = new T.Group(); head.position.y = 1.15; g.add(head);
    [-0.15, 0.15].forEach((ex) => { const e = new T.Mesh(new T.SphereGeometry(0.1, 8, 6), eyeM); e.position.set(ex, 0.05, 0.36); head.add(e); const p = new T.Mesh(new T.SphereGeometry(0.05, 6, 4), pupM); p.position.set(ex, 0.05, 0.44); head.add(p); });
    // le gant qui lance, tourné vers la visée
    const arm = new T.Group(); arm.position.y = 0.8; g.add(arm); const glove = new T.Mesh(new T.SphereGeometry(0.2, 10, 8), new T.MeshLambertMaterial({ color: "#f2f2f2" })); glove.position.set(0.25, 0, 0.55); arm.add(glove);
    const tomato = new T.Mesh(new T.SphereGeometry(0.16, 10, 8), new T.MeshLambertMaterial({ color: "#e0301e" })); tomato.position.set(0.25, 0.18, 0.62); arm.add(tomato);
    const shadow = new T.Mesh(new T.CircleGeometry(0.6, 20), new T.MeshBasicMaterial({ color: "#000", transparent: true, opacity: 0.35 })); shadow.rotation.x = -Math.PI / 2; shadow.position.y = 0.02; g.add(shadow);
    const ring = new T.Mesh(new T.RingGeometry(0.66, 0.78, 28), new T.MeshBasicMaterial({ color: hex })); ring.rotation.x = -Math.PI / 2; ring.position.y = 0.03; g.add(ring);
    const tag = label(id === H.me ? "Toi" : helpers.nameOf(id), hex); tag.position.y = 2.2; g.add(tag);
    // ligne de visée pour soi
    let aim = null; if (id === H.me) { aim = new T.Mesh(new T.PlaneGeometry(0.08, 3), new T.MeshBasicMaterial({ color: "#ffd23f", transparent: true, opacity: 0.55 })); aim.rotation.x = -Math.PI / 2; aim.position.set(0, 0.05, 2.2); arm.add(aim); }
    H.world.add(g); const P = { g, body, mat, arm, tomato, x: 0, z: 0, tx: 0, tz: 0, ax: 0, az: 1, hurt: 0 }; H.players[id] = P; return P;
  }

  // ----- réception -----
  function setState(st, me) {
    build(); H.st = st; H.me = me; const gl = st.gl; const was = H.gl; H.gl = gl;
    const show = !!gl; H.root.classList.toggle("hidden", !show); document.body.classList.toggle("ho-gl-on", show); if (!show) { H.keys = {}; return; }
    if (!was) resize(); buildArena(gl);
    const fk = gl.a + ">" + gl.b; if (fk !== H.fightKey) { H.fightKey = fk; Object.keys(H.players).forEach((id) => { H.world.remove(H.players[id].g); }); H.players = {}; Object.keys(H.shots).forEach((k) => H.world.remove(H.shots[k].m)); H.shots = {}; const A = fighter(gl.a), B = fighter(gl.b); A.x = A.tx = 0; A.z = A.tz = 5.6; A.az = -1; B.x = B.tx = 0; B.z = B.tz = -5.6; B.az = 1; H.pred = null; placeCam(); helpers.sfx("bell"); }
    if (was && was.step !== gl.step) { if (gl.step === "fight") helpers.sfx("go"); if (gl.step === "ko") helpers.sfx("ko"); }
    hud(); msg();
    const inIt = me === gl.a || me === gl.b; const t = touchDev() && inIt && gl.step === "fight";
    H.joyEl.classList.toggle("hidden", !t); H.fireEl.classList.toggle("hidden", !t);
    H.help.textContent = !inIt ? "Tu regardes le combat." : touchDev() ? "Glisse à gauche pour bouger, touche à droite pour lancer. 🍅 vise tout seul." : "Flèches ou ZQSD pour bouger. La souris vise, clic ou Espace pour lancer une tomate.";
  }
  function hearts(n, lives) { let s = ""; for (let i = 0; i < lives; i++) s += i < lives - n ? "❤️" : "🖤"; return s; }
  function hud() {
    const gl = H.gl; if (!gl || !gl.a) return; const hits = (H.snap && H.snap.hits) || gl.hits || {};
    const side = (box, id, oid) => { box.innerHTML = ""; const n = el("b", "", id === H.me ? "Toi" : helpers.nameOf(id)); n.style.color = helpers.hexOf(id); box.appendChild(n); box.appendChild(el("span", "ho-gl__hearts", hearts(hits[oid] || 0, gl.lives))); };
    // en haut à gauche celui qu'on joue, ou le premier combattant
    const me = H.me === gl.b ? gl.b : gl.a, other = me === gl.a ? gl.b : gl.a;
    side(H.sideA, me, other); side(H.sideB, other, me);
    const ends = (H.snap && H.snap.ends) || gl.ends; const left = gl.step === "fight" ? Math.max(0, Math.ceil((ends - helpers.now()) / 1000)) : null;
    const sudden = (H.snap && H.snap.sudden) || gl.sudden;
    H.mid.innerHTML = ""; H.mid.appendChild(el("b", "", "🥊 Le Goulag")); if (left != null) H.mid.appendChild(el("span", "ho-gl__time" + (sudden ? " ho-gl__time--sd" : ""), sudden ? "Mort subite " + left : left + " s"));
  }
  function msg() {
    const gl = H.gl, m = H.msg; m.innerHTML = ""; const inIt = H.me === gl.a || H.me === gl.b;
    if (gl.step === "fight") { m.classList.add("hidden"); return; } m.classList.remove("hidden");
    if (gl.step === "intro") {
      m.appendChild(el("h2", "", "🥊 Le Goulag"));
      m.appendChild(el("p", "", gl.fights.length ? "Le perdant du combat précédent reste dans l'arène et affronte le suivant." : "Plusieurs joueurs ont perdu ensemble. Ils règlent leurs comptes en face à face, seul le dernier perdant perd sa main."));
      const vs = el("p", "ho-gl__vs"); const a = el("b", "", helpers.nameOf(gl.a)); a.style.color = helpers.hexOf(gl.a); const b = el("b", "", helpers.nameOf(gl.b)); b.style.color = helpers.hexOf(gl.b); vs.appendChild(a); vs.appendChild(el("span", "", " contre ")); vs.appendChild(b); m.appendChild(vs);
      m.appendChild(el("p", "ho-gl__rule", "Trois tomates reçues et c'est perdu. Cache-toi derrière les caisses, bouge sans arrêt et vise bien. Après 40 secondes, celui qui a touché le plus gagne, sinon mort subite."));
      if (gl.queue.length) m.appendChild(el("p", "ho-gl__small", "Attendent leur tour " + gl.queue.map(helpers.nameOf).join(", ") + "."));
      const ready = (H.st.glReady || []).includes(H.me);
      const btn = el("button", "btn btn--accent btn--big", inIt ? (ready ? "Prêt, j'attends l'autre" : "Je suis prêt") : "Lancer le combat"); btn.disabled = inIt && ready; btn.onclick = () => window.Kit.socket.emit("ho:ready"); m.appendChild(btn);
      if (!inIt) m.appendChild(el("p", "ho-gl__small", "Tu regardes le combat, tu ne risques rien."));
      return;
    }
    if (gl.step === "ko") { const w = el("h2", "", "K.O."); m.appendChild(w); const p = el("p", ""); const b = el("b", "", helpers.nameOf(gl.winner)); b.style.color = helpers.hexOf(gl.winner); p.appendChild(b); p.appendChild(el("span", "", " gagne et sauve sa main.")); m.appendChild(p); if (gl.queue.length) m.appendChild(el("p", "ho-gl__small", helpers.nameOf(gl.loser) + " reste dans l'arène.")); return; }
    if (gl.step === "done") { m.appendChild(el("h2", "", "💀 Fin du règlement")); const p = el("p", ""); const b = el("b", "", helpers.nameOf(gl.worst)); b.style.color = helpers.hexOf(gl.worst); p.appendChild(b); p.appendChild(el("span", "", gl.worst === H.me ? ", c'est toi qui perds la main." : " perd la main. Les autres sont sauvés.")); m.appendChild(p); }
  }
  function onSnap(sn) {
    if (!H.gl || !sn || sn.seq <= H.seq) return; H.seq = sn.seq; H.snap = sn; H.snapAt = performance.now();
    Object.keys(sn.P).forEach((id) => { const P = H.players[id]; if (!P) return; const q = sn.P[id]; P.tx = q[0]; P.tz = q[1]; if (id !== H.me) { P.ax = q[2]; P.az = q[3]; } });
    const seen = {}; sn.S.forEach((s) => { seen[s[0]] = 1; let o = H.shots[s[0]]; if (!o) { const m = new T.Mesh(new T.SphereGeometry(0.22, 10, 8), new T.MeshLambertMaterial({ color: "#e0301e" })); m.position.y = 0.8; H.world.add(m); o = H.shots[s[0]] = { m }; } o.x = s[1]; o.z = s[2]; o.vx = s[3]; o.vz = s[4]; o.at = performance.now(); });
    Object.keys(H.shots).forEach((k) => { if (!seen[k]) { H.world.remove(H.shots[k].m); delete H.shots[k]; } });
    sn.ev.forEach((e) => { if (e.t === "hit") { splat(e.x, e.z, "#e0301e", 14); const P = H.players[e.on]; if (P) P.hurt = 0.5; helpers.sfx(e.on === H.me ? "hurt" : "hit"); } else if (e.t === "splat") { splat(e.x, e.z, "#c0281a", 7); helpers.sfx("splat"); } else if (e.t === "shot") helpers.sfx("throw"); });
    hud();
  }
  function splat(x, z, col, n) { if (!T) return; for (let i = 0; i < n; i++) { const m = new T.Mesh(new T.SphereGeometry(0.06 + Math.random() * 0.06, 6, 4), new T.MeshBasicMaterial({ color: col })); m.position.set(x, 0.8, z); H.world.add(m); H.fx.push({ m, vx: (Math.random() - 0.5) * 6, vy: 2 + Math.random() * 3, vz: (Math.random() - 0.5) * 6, t: 0.7 }); } }

  // ----- commandes envoyées au serveur -----
  const ray = T ? new T.Raycaster() : null; const plane = T ? new T.Plane(new T.Vector3(0, 1, 0), -0.8) : null; const hitV = T ? new T.Vector3() : null;
  function groundAt(sx, sy) { const r = H.cv.getBoundingClientRect(); ray.setFromCamera({ x: ((sx - r.left) / r.width) * 2 - 1, y: -((sy - r.top) / r.height) * 2 + 1 }, H.cam); return ray.ray.intersectPlane(plane, hitV) ? { x: hitV.x, z: hitV.z } : null; }
  function readInput() {
    const k = H.keys; let x = 0, y = 0;
    if (k.arrowleft || k.q || k.a) x -= 1; if (k.arrowright || k.d) x += 1; if (k.arrowup || k.z || k.w) y -= 1; if (k.arrowdown || k.s) y += 1;
    if (H.joy) { x = H.joy.dx; y = H.joy.dy; }
    const f = flip(); let mx = x * f, mz = y * f; const l = Math.hypot(mx, mz); if (l > 1) { mx /= l; mz /= l; }
    const P = H.players[H.me]; let ax = P ? P.ax : 0, az = P ? P.az : -f;
    const gl = H.gl; const oid = H.me === gl.a ? gl.b : gl.a; const O = H.players[oid];
    let tgt = null;
    if (H.aimTouch) tgt = groundAt(H.aimTouch.x, H.aimTouch.y);
    else if (H.autoAim && O) tgt = { x: O.x, z: O.z };
    else if (H.mouse.has && !touchDev()) tgt = groundAt(H.mouse.x, H.mouse.y);
    if (tgt && P) { const dx = tgt.x - P.x, dz = tgt.z - P.z, d = Math.hypot(dx, dz); if (d > 0.2) { ax = dx / d; az = dz / d; } }
    if (!H.fireHeld) H.autoAim = false;
    return { mx, mz, ax, az, fire: H.mouse.down || !!H.fireHeld || !!k[" "] || !!H.aimTouch, shot: !!H.shotQ };
  }
  function sendInput(now) {
    if (!active()) return; const d = readInput(); const P = H.players[H.me]; if (P) { P.ax = d.ax; P.az = d.az; }
    const key = [d.mx.toFixed(2), d.mz.toFixed(2), d.ax.toFixed(2), d.az.toFixed(2), d.fire, d.shot].join();
    if (key === H.lastIn && now - H.lastSend < 250) return; if (now - H.lastSend < 45 && !d.shot) return;
    H.lastIn = key; H.lastSend = now; H.shotQ = false; window.Kit.socket.emit("ho:gl", d); H.myIn = d;
  }
  // déplacement prédit pour soi, corrigé doucement par le serveur
  function crateHit(x, z, r) { return (H.gl.crates || []).some((c) => Math.abs(x - c.x) < c.w / 2 + r && Math.abs(z - c.z) < c.d / 2 + r); }
  function predict(P, dt) {
    const d = H.myIn; if (!d) return; const A = H.gl.arena;
    const nx = clamp(P.x + d.mx * SPEED * dt, -A + PR, A - PR); if (!crateHit(nx, P.z, PR)) P.x = nx;
    const nz = clamp(P.z + d.mz * SPEED * dt, -A + PR, A - PR); if (!crateHit(P.x, nz, PR)) P.z = nz;
  }

  let last = performance.now();
  function frame(now) {
    requestAnimationFrame(frame); const dt = Math.min(0.05, (now - last) / 1000); last = now;
    if (!H.gl || !H.R || H.root.classList.contains("hidden")) return;
    sendInput(now);
    Object.keys(H.players).forEach((id) => {
      const P = H.players[id];
      if (id === H.me && active()) { predict(P, dt); P.x += (P.tx - P.x) * Math.min(1, dt * 4); P.z += (P.tz - P.z) * Math.min(1, dt * 4); if (Math.hypot(P.tx - P.x, P.tz - P.z) > 2) { P.x = P.tx; P.z = P.tz; } }
      else { const lag = H.snap ? (now - H.snapAt) / 1000 : 0; P.x += (P.tx - P.x) * Math.min(1, dt * 14); P.z += (P.tz - P.z) * Math.min(1, dt * 14); void lag; }
      P.g.position.set(P.x, 0, P.z); const ang = Math.atan2(P.ax, P.az); P.g.rotation.y = ang;
      P.hurt = Math.max(0, P.hurt - dt); P.mat.emissive && P.mat.emissive.setRGB(P.hurt * 1.6, 0, 0); P.body.scale.setScalar(1 + P.hurt * 0.25);
    });
    Object.keys(H.shots).forEach((k) => { const o = H.shots[k]; const t = (now - o.at) / 1000; o.m.position.set(o.x + o.vx * t, 0.8 + Math.sin(Math.min(1, t * 3)) * 0.1, o.z + o.vz * t); });
    for (let i = H.fx.length - 1; i >= 0; i--) { const f = H.fx[i]; f.t -= dt; f.vy -= 14 * dt; f.m.position.x += f.vx * dt; f.m.position.y = Math.max(0.03, f.m.position.y + f.vy * dt); f.m.position.z += f.vz * dt; if (f.t <= 0) { H.world.remove(f.m); H.fx.splice(i, 1); } }
    if (H.gl.step === "fight" && (!H.hudAt || now - H.hudAt > 250)) { H.hudAt = now; hud(); }
    H.R.render(H.sc, H.cam);
  }
  window.HOGulag = { init(h) { helpers = h; }, state: setState, snap: onSnap, hide() { if (H.root) { H.root.classList.add("hidden"); document.body.classList.remove("ho-gl-on"); } H.gl = null; H.fightKey = ""; H.seq = 0; } };
})();

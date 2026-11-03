// ============================================================
// HANDS OVER — Plateau de télévision en 3D (three.js)
// Rideaux rouges, présentateur au grand sourire, pupitres avec les mains de chaque joueur.
// Tout est décoratif et suit l'état envoyé par le serveur.
// ============================================================
(function () {
  const T = THREE; const St = { ready: false };
  let renderer, scene, camera, host, canvas, hostG, mouth, headG, eyeL, eyeR, podG, cones = [], t = 0, shake = 0, pods = {}, moodTarget = new T.Color("#e63946"), ringMat, talk = 0, dust, flash = 0, flashCol = new T.Color("#ffffff"), ghostSheet = {};
  const col = (h) => new T.Color(h);
  const lam = (c, o) => new T.MeshLambertMaterial(Object.assign({ color: col(c) }, o || {}));
  const bas = (c, o) => new T.MeshBasicMaterial(Object.assign({ color: col(c) }, o || {}));

  St.init = function (container) {
    host = container; canvas = document.createElement("canvas"); canvas.className = "ho-canvas"; host.appendChild(canvas);
    try { renderer = PicuiteGL.create(T, canvas, "medium"); PicuiteGL.watch(canvas); } catch (e) { return false; }
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.5)); renderer.setClearColor(0x0a0206, 1);
    scene = new T.Scene(); scene.fog = new T.Fog(0x0a0206, 14, 40);
    camera = new T.PerspectiveCamera(52, 1, 0.1, 80); camera.position.set(0, 3.4, 9.5);
    scene.add(new T.HemisphereLight(0xffd5d5, 0x1a0a14, 0.75)); const key = new T.DirectionalLight(0xfff0e0, 0.7); key.position.set(3, 8, 8); scene.add(key);
    // sol et anneau lumineux
    const floor = new T.Mesh(new T.CircleGeometry(14, 40), lam("#1a0d12")); floor.rotation.x = -Math.PI / 2; scene.add(floor);
    for (let i = 0; i < 24; i++) { const tile = new T.Mesh(new T.RingGeometry(2 + (i % 4) * 2.4, 2 + (i % 4) * 2.4 + 1.2, 24, 1, (i / 24) * 6.28, 0.26), lam(i % 2 ? "#2a1219" : "#120709")); tile.rotation.x = -Math.PI / 2; tile.position.y = 0.01; scene.add(tile); }
    ringMat = bas("#e63946"); const ring = new T.Mesh(new T.RingGeometry(7.6, 7.85, 64), ringMat); ring.rotation.x = -Math.PI / 2; ring.position.y = 0.03; scene.add(ring);
    // rideaux
    [-1, 1].forEach((sd) => { for (let k = 0; k < 7; k++) { const c = new T.Mesh(new T.CylinderGeometry(0.55, 0.55, 14, 10, 1, true), lam(k % 2 ? "#7a0f1c" : "#a3162a", { side: T.DoubleSide })); c.position.set(sd * (9 + k * 0.9), 6.5, -6 - Math.abs(k - 3) * 0.3); scene.add(c); } });
    // écran du fond
    const cv = document.createElement("canvas"); cv.width = 512; cv.height = 192; const x = cv.getContext("2d"); x.fillStyle = "#14060a"; x.fillRect(0, 0, 512, 192); x.strokeStyle = "#ff3b4e"; x.lineWidth = 8; x.strokeRect(10, 10, 492, 172); x.fillStyle = "#ff3b4e"; x.shadowColor = "#ff3b4e"; x.shadowBlur = 24; x.font = "bold 84px Impact, sans-serif"; x.textAlign = "center"; x.fillText("HANDS OVER", 256, 118);
    const screen = new T.Mesh(new T.PlaneGeometry(12, 4.5), new T.MeshBasicMaterial({ map: new T.CanvasTexture(cv) })); screen.position.set(0, 7, -8); scene.add(screen);
    // présentateur
    hostG = new T.Group(); hostG.position.set(0, 0, -3.6); scene.add(hostG);
    const ped = new T.Mesh(new T.CylinderGeometry(1.6, 1.9, 0.5, 20), lam("#2a1219")); ped.position.y = 0.25; hostG.add(ped);
    const body = new T.Mesh(new T.CylinderGeometry(0.7, 0.95, 2.4, 12), lam("#0e0e14")); body.position.y = 1.7; hostG.add(body);
    const tie = new T.Mesh(new T.ConeGeometry(0.2, 0.8, 4), lam("#e63946")); tie.position.set(0, 2.35, 0.78); tie.rotation.x = Math.PI; hostG.add(tie);
    headG = new T.Group(); headG.position.y = 3.35; hostG.add(headG);
    headG.add(new T.Mesh(new T.SphereGeometry(0.85, 18, 14), lam("#f2e6d4")));
    eyeL = new T.Mesh(new T.SphereGeometry(0.17, 10, 8), bas("#ffffff")); eyeL.position.set(-0.32, 0.22, 0.72); headG.add(eyeL); eyeR = eyeL.clone(); eyeR.position.x = 0.32; headG.add(eyeR);
    [-1, 1].forEach((sd) => { const p = new T.Mesh(new T.SphereGeometry(0.07, 8, 6), bas("#000000")); p.position.set(sd * 0.32, 0.22, 0.87); headG.add(p); });
    mouth = new T.Group(); mouth.position.set(0, -0.2, 0.7); headG.add(mouth);
    const smile = new T.Mesh(new T.TorusGeometry(0.5, 0.09, 8, 20, Math.PI), bas("#7a0f1c")); smile.rotation.z = Math.PI; mouth.add(smile);
    for (let i = 0; i < 9; i++) { const a = Math.PI + (i / 8) * Math.PI; const tooth = new T.Mesh(new T.BoxGeometry(0.08, 0.14, 0.05), bas("#ffffff")); tooth.position.set(Math.cos(a) * 0.48, Math.sin(a) * 0.48 + 0.02, 0.03); mouth.add(tooth); }
    const hat = new T.Mesh(new T.CylinderGeometry(0.5, 0.55, 0.8, 14), lam("#0e0e14")); hat.position.y = 1.05; headG.add(hat); const brim = new T.Mesh(new T.CylinderGeometry(0.95, 0.95, 0.07, 16), lam("#0e0e14")); brim.position.y = 0.68; headG.add(brim);
    // projecteurs
    for (let i = 0; i < 3; i++) { const c = new T.Mesh(new T.ConeGeometry(2.4, 12, 18, 1, true), new T.MeshBasicMaterial({ color: [0xff3b4e, 0xffe08a, 0xb06bff][i], transparent: true, opacity: 0.11, side: T.DoubleSide, depthWrite: false })); c.position.set((i - 1) * 6, 8, -2); scene.add(c); cones.push(c); }
    // poussière
    const n = 70, g = new T.BufferGeometry(), pos = new Float32Array(n * 3); for (let i = 0; i < n; i++) { pos[i * 3] = (Math.random() - 0.5) * 22; pos[i * 3 + 1] = Math.random() * 9; pos[i * 3 + 2] = (Math.random() - 0.5) * 16; }
    g.setAttribute("position", new T.BufferAttribute(pos, 3)); dust = new T.Points(g, new T.PointsMaterial({ color: 0xffd0c0, size: 0.07 })); scene.add(dust);
    podG = new T.Group(); scene.add(podG);
    window.addEventListener("resize", St.resize); St.resize(); St.ready = true; requestAnimationFrame(loop); return true;
  };
  St.resize = function () { if (!renderer || !host) return; const w = host.clientWidth || 300, h = host.clientHeight || 200; renderer.setSize(w, h, false); camera.aspect = w / h; camera.updateProjectionMatrix(); };
  function handMesh(skin) {
    const g = new T.Group(); const palm = new T.Mesh(new T.BoxGeometry(0.5, 0.14, 0.55), lam(skin)); g.add(palm);
    for (let i = 0; i < 4; i++) { const f = new T.Mesh(new T.BoxGeometry(0.09, 0.1, 0.3), lam(skin)); f.position.set(-0.19 + i * 0.127, 0, -0.4); g.add(f); }
    const th = new T.Mesh(new T.BoxGeometry(0.25, 0.1, 0.1), lam(skin)); th.position.set(0.35, 0, -0.1); th.rotation.y = -0.5; g.add(th); return g;
  }
  // players : [{ id, color, hands, max, alive, name }]
  St.setPlayers = function (list) {
    if (!scene) return; const key = list.map((p) => p.id + p.color + p.max).join("|");
    if (St.key !== key) {
      St.key = key; while (podG.children.length) podG.remove(podG.children[0]); pods = {}; const n = list.length;
      list.forEach((p, i) => { const a = Math.PI * (0.18 + (0.64 * (n === 1 ? 0.5 : i / (n - 1)))); const px = -Math.cos(a) * 6.2, pz = 1.2 + Math.sin(a) * -1.2 + 1.5 - Math.abs(i - (n - 1) / 2) * 0.35;
        const g = new T.Group(); g.position.set(px, 0, pz); g.rotation.y = -px * 0.06;
        const base = new T.Mesh(new T.BoxGeometry(1.7, 1.1, 1.1), lam("#1c0d12")); base.position.y = 0.55; g.add(base);
        const top = new T.Mesh(new T.BoxGeometry(1.8, 0.1, 1.2), lam(p.hex)); top.position.y = 1.12; g.add(top);
        const hands = []; for (let k = 0; k < p.max; k++) { const h = handMesh("#f2d2b0"); h.position.set((k - (p.max - 1) / 2) * 0.62, 1.24, 0.05); h.userData.k = k; g.add(h); hands.push(h); }
        const gh = new T.Mesh(new T.ConeGeometry(0.5, 1.4, 10), new T.MeshBasicMaterial({ color: 0xcfe8ff, transparent: true, opacity: 0.0 })); gh.position.y = 2.2; g.add(gh);
        podG.add(g); pods[p.id] = { g, hands, gh, base, shown: p.max, alive: true, hex: p.hex }; });
    }
    list.forEach((p) => { const o = pods[p.id]; if (!o) return; o.alive = p.alive; o.want = p.hands; });
  };
  St.flash = function (hex, amt) { flash = amt || 1; flashCol.set(hex || "#ff3b4e"); };
  St.shake = function (v) { shake = Math.max(shake, v); };
  St.talk = function () { talk = 1.6; };
  St.mood = function (hex) { moodTarget.set(hex); };
  St.loseHand = function (id) { const o = pods[id]; if (!o) return; const h = o.hands.filter((x) => x.visible && !x.userData.dying).pop(); if (h) h.userData.dying = 1; shake = Math.max(shake, 0.5); };
  function loop(now) {
    requestAnimationFrame(loop); if (!renderer) return; const scr = document.getElementById("screen-game"); if (!scr || !scr.classList.contains("screen--active") || host.style.display === "none") return;
    const dt = 0.016; t += dt;
    PicuiteGL.frame(() => {
      headG.rotation.y = Math.sin(t * 0.8) * 0.25; headG.rotation.z = Math.sin(t * 0.5) * 0.08; headG.position.y = 3.35 + Math.sin(t * 1.4) * 0.05; talk = Math.max(0, talk - dt); mouth.scale.y = 1 + (talk > 0 ? Math.abs(Math.sin(t * 16)) * 0.9 : 0);
      eyeL.scale.setScalar(1 + Math.sin(t * 3) * 0.05); eyeR.scale.setScalar(1 + Math.sin(t * 3) * 0.05);
      cones.forEach((c, i) => { c.rotation.z = Math.sin(t * 0.6 + i * 2) * 0.35; c.rotation.x = Math.cos(t * 0.5 + i) * 0.2; });
      ringMat.color.lerp(moodTarget, 0.05);
      Object.keys(pods).forEach((id) => { const o = pods[id]; o.hands.forEach((h, k) => { if (h.userData.dying) { h.position.y -= dt * 3; h.rotation.z += dt * 6; h.position.z += dt * 2; if (h.position.y < 0.2) { h.visible = false; h.userData.dying = 0; } } else if (h.visible) h.position.y = 1.24 + Math.sin(t * 2 + k + id.length) * 0.02; });
        const vis = o.hands.filter((h) => h.visible && !h.userData.dying).length; if (vis > o.want) { const h = o.hands.filter((x) => x.visible && !x.userData.dying).pop(); if (h) h.userData.dying = 1; }
        o.gh.material.opacity += ((o.alive ? 0 : 0.5) - o.gh.material.opacity) * 0.05; o.gh.position.y = 2.2 + Math.sin(t * 1.5) * 0.15; o.base.material.opacity = 1; });
      const sx = shake > 0.01 ? (Math.random() - 0.5) * shake : 0, sy = shake > 0.01 ? (Math.random() - 0.5) * shake : 0; shake *= 0.9;
      camera.position.set(Math.sin(t * 0.25) * 0.8 + sx, 3.0 + Math.sin(t * 0.3) * 0.15 + sy, 10.5); camera.lookAt(0, -0.2, -1);
      scene.background = null; const bgc = 0x0a0206; if (flash > 0.02) { renderer.setClearColor(new T.Color(bgc).lerp(flashCol, flash * 0.6), 1); flash *= 0.9; } else renderer.setClearColor(bgc, 1);
      renderer.render(scene, camera); PicuiteGL.verify(renderer);
    });
  }
  St.setVisible = function (v) { if (host) host.style.display = v ? "block" : "none"; if (v) St.resize(); };
  window.HOStage = St;
})();

// ============================================================
// MAIN MORTE — Plateau de télévision en 3D (three.js)
// Une table ronde au centre, les joueurs assis autour derrière leur pupitre, le présentateur au fond.
// Pendant une épreuve, la caméra passe à la première personne et la table porte les accessoires de l'épreuve.
// Tout est décoratif ou sert à cliquer, la vérité reste sur le serveur.
// ============================================================
(function () {
  const T = THREE; const St = { ready: false, onPick: null, pickable: null };
  const TY = 1.0, TR = 2.5, PR = 3.75, SKIN = "#f2d2b0";
  let renderer, scene, camera, host, canvas, hemi, keyL, hostG, mouth, headG, eyeL, eyeR, podG, propG, fxG, ringMat, dust, giant, poolMat;
  let cones = [], t = 0, shake = 0, pods = {}, meId = null, talk = 0, flash = 0, dark = 0, darkT = 0, lean = 0;
  const moodTarget = new T.Color("#e63946"), flashCol = new T.Color("#ffffff");
  let camMode = "wide", camFocus = null, focusTop = 0, focusBot = 0, holdSync = false, cur = null, hoverObj = null, lastErrKey = "";
  const camPos = new T.Vector3(0, 6.2, 10.8), camLook = new T.Vector3(0, 1, -0.4); const anims = [];
  const V = (x, y, z) => new T.Vector3(x, y, z);
  const col = (h) => new T.Color(h);
  const lam = (c, o) => new T.MeshLambertMaterial(Object.assign({ color: col(c) }, o || {}));
  const bas = (c, o) => new T.MeshBasicMaterial(Object.assign({ color: col(c) }, o || {}));
  const phong = (c, o) => new T.MeshPhongMaterial(Object.assign({ color: col(c) }, o || {}));
  const clamp = (x, a, b) => (x < a ? a : x > b ? b : x);
  const ease = (x) => { x = clamp(x, 0, 1); return x * x * (3 - 2 * x); };

  // ---------- petites animations à durée fixe ----------
  function anim(dur, fn, done, delay) { anims.push({ t: -(delay || 0), dur, fn, done }); }
  function runAnims(dt) {
    for (let i = anims.length - 1; i >= 0; i--) {
      const a = anims[i]; a.t += dt; if (a.t < 0) continue; const k = Math.min(1, a.t / a.dur);
      try { a.fn(k); } catch (e) { a.t = a.dur; }
      if (k >= 1) { anims.splice(i, 1); if (a.done) { try { a.done(); } catch (e) { /* rien */ } } }
    }
  }
  function dispose(o) { o.traverse((n) => { if (n.geometry) n.geometry.dispose(); const ms = n.material ? [].concat(n.material) : []; ms.forEach((m) => { if (m.map) m.map.dispose(); m.dispose(); }); }); }
  function drop(o) { if (o && o.parent) o.parent.remove(o); if (o) dispose(o); }

  // ---------- étiquettes ----------
  function rr(x, a, b, w, h, r) { x.beginPath(); x.moveTo(a + r, b); x.lineTo(a + w - r, b); x.quadraticCurveTo(a + w, b, a + w, b + r); x.lineTo(a + w, b + h - r); x.quadraticCurveTo(a + w, b + h, a + w - r, b + h); x.lineTo(a + r, b + h); x.quadraticCurveTo(a, b + h, a, b + h - r); x.lineTo(a, b + r); x.quadraticCurveTo(a, b, a + r, b); x.closePath(); }
  function textCanvas(text, o) {
    const fs = o.fs || 44; const cv = document.createElement("canvas"); let x = cv.getContext("2d"); const font = "bold " + fs + "px Fredoka, Arial, sans-serif"; x.font = font;
    const w = Math.ceil(x.measureText(text).width + fs * (o.bg ? 1.1 : 0.6)), h = Math.ceil(fs * 1.5); cv.width = w; cv.height = h; x = cv.getContext("2d"); x.font = font; x.textAlign = "center"; x.textBaseline = "middle";
    if (o.bg) { x.fillStyle = o.bg; rr(x, 2, 2, w - 4, h - 4, Math.min(h / 2.2, 22)); x.fill(); }
    x.lineWidth = fs / 6; x.strokeStyle = o.stroke || "rgba(0,0,0,0.85)"; x.lineJoin = "round"; x.strokeText(text, w / 2, h / 2 + 2); x.fillStyle = o.color || "#ffffff"; x.fillText(text, w / 2, h / 2 + 2);
    return cv;
  }
  function label(text, o) {
    o = o || {}; const cv = textCanvas(text, o); const tex = new T.CanvasTexture(cv);
    const sp = new T.Sprite(new T.SpriteMaterial({ map: tex, transparent: true, depthWrite: false, depthTest: o.depthTest !== false })); const sc = o.size || 0.3; sp.scale.set((sc * cv.width) / cv.height, sc, 1); sp.renderOrder = 5; sp.userData.text = text; return sp;
  }
  function relabel(sp, text, o) { if (!sp || sp.userData.text === text) return; const cv = textCanvas(text, o || {}); if (sp.material.map) sp.material.map.dispose(); sp.material.map = new T.CanvasTexture(cv); sp.material.needsUpdate = true; const sc = (o && o.size) || 0.3; sp.scale.set((sc * cv.width) / cv.height, sc, 1); sp.userData.text = text; }
  function flatText(text, size, o) {
    const cv = textCanvas(text, Object.assign({ fs: 64 }, o || {})); const m = new T.Mesh(new T.PlaneGeometry((size * cv.width) / cv.height, size), new T.MeshBasicMaterial({ map: new T.CanvasTexture(cv), transparent: true, depthWrite: false }));
    m.rotation.x = -Math.PI / 2; return m;
  }

  // ---------- une main stylisée aux doigts articulés ----------
  // pose "flat" posée paume vers le bas, doigts vers -z. pose "up" debout, doigts vers le haut, paume vers +z
  const FX = [0, 0.165, 0.055, -0.055, -0.165], FL = [0.27, 0.31, 0.35, 0.33, 0.26];
  function makeHand(skin, o) {
    o = o || {}; const G = new T.Group(); const I = new T.Group(); G.add(I); const m = o.mat || lam(skin, o.mirror ? { side: T.DoubleSide } : undefined);
    const palm = new T.Mesh(new T.BoxGeometry(0.46, 0.5, 0.14), m); I.add(palm); const fingers = [];
    const th = new T.Group(); th.position.set(0.22, -0.06, 0); th.rotation.z = -0.8; const tm = new T.Mesh(new T.BoxGeometry(0.105, FL[0], 0.12), m); tm.position.y = FL[0] / 2; th.add(tm); I.add(th); fingers.push(th);
    for (let i = 1; i < 5; i++) { const p = new T.Group(); p.position.set(FX[i], 0.25, 0); const f = new T.Mesh(new T.BoxGeometry(0.092, FL[i], 0.115), m); f.position.y = FL[i] / 2; p.add(f); I.add(p); fingers.push(p); }
    if (o.sleeve) { const sl = new T.Mesh(new T.CylinderGeometry(0.2, 0.23, o.sleeveLen || 0.7, 12), lam(o.sleeve)); sl.position.y = -0.25 - (o.sleeveLen || 0.7) / 2; I.add(sl); }
    if (o.cuff) { const cf = new T.Mesh(new T.CylinderGeometry(0.29, 0.25, 0.3, 14), m); cf.position.y = -0.36; I.add(cf); }
    if (o.pose === "flat") I.rotation.set(-Math.PI / 2, Math.PI, 0);
    if (o.mirror) G.scale.x = -1;
    const H = { g: G, inner: I, fingers, mat: m,
      set(i, up) { const f = fingers[i]; if (i === 0) { f.rotation.z = up ? -0.8 : 0.25; f.rotation.x = up ? 0 : 0.9; } else f.rotation.x = up ? 0 : 1.85; },
      mask(arr) { for (let i = 0; i < 5; i++) H.set(i, !!arr[i]); },
      spread(k) { [-0.75 - 0.35 * k, -0.22 * k, -0.07 * k, 0.08 * k, 0.24 * k].forEach((a, i) => { fingers[i].rotation.z = a; }); } };
    return H;
  }

  // ---------- installation ----------
  St.init = function (container) {
    host = container; canvas = document.createElement("canvas"); canvas.className = "ho-canvas"; host.appendChild(canvas);
    try { renderer = PicuiteGL.create(T, canvas, "medium"); PicuiteGL.watch(canvas); } catch (e) { return false; }
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.5)); renderer.setClearColor(0x0a0206, 1);
    scene = new T.Scene(); scene.fog = new T.Fog(0x0a0206, 16, 42);
    camera = new T.PerspectiveCamera(50, 1, 0.1, 80); camera.position.copy(camPos);
    hemi = new T.HemisphereLight(0xffd5d5, 0x1a0a14, 0.78); scene.add(hemi); keyL = new T.DirectionalLight(0xfff0e0, 0.72); keyL.position.set(3, 9, 7); scene.add(keyL);
    // sol, dalles et anneau lumineux
    const floor = new T.Mesh(new T.CircleGeometry(15, 40), lam("#1a0d12")); floor.rotation.x = -Math.PI / 2; scene.add(floor);
    for (let i = 0; i < 24; i++) { const r0 = 5.2 + (i % 3) * 2.2; const tile = new T.Mesh(new T.RingGeometry(r0, r0 + 1.1, 24, 1, (i / 24) * 6.28, 0.26), lam(i % 2 ? "#2a1219" : "#120709")); tile.rotation.x = -Math.PI / 2; tile.position.y = 0.01; scene.add(tile); }
    ringMat = bas("#e63946"); const ring = new T.Mesh(new T.RingGeometry(4.9, 5.1, 72), ringMat); ring.rotation.x = -Math.PI / 2; ring.position.y = 0.03; scene.add(ring);
    // rideaux et écran du fond
    [-1, 1].forEach((sd) => { for (let k = 0; k < 7; k++) { const c = new T.Mesh(new T.CylinderGeometry(0.55, 0.55, 14, 10, 1, true), lam(k % 2 ? "#7a0f1c" : "#a3162a", { side: T.DoubleSide })); c.position.set(sd * (9 + k * 0.9), 6.5, -7 - Math.abs(k - 3) * 0.3); scene.add(c); } });
    const cv = document.createElement("canvas"); cv.width = 512; cv.height = 192; const x = cv.getContext("2d"); x.fillStyle = "#14060a"; x.fillRect(0, 0, 512, 192); x.strokeStyle = "#ff3b4e"; x.lineWidth = 8; x.strokeRect(10, 10, 492, 172); x.fillStyle = "#ff3b4e"; x.shadowColor = "#ff3b4e"; x.shadowBlur = 24; x.font = "bold 84px Impact, sans-serif"; x.textAlign = "center"; x.fillText("MAIN MORTE", 256, 118);
    const screen = new T.Mesh(new T.PlaneGeometry(12, 4.5), new T.MeshBasicMaterial({ map: new T.CanvasTexture(cv) })); screen.position.set(0, 7.6, -9); scene.add(screen);
    // la table des épreuves
    const tbl = new T.Group(); scene.add(tbl);
    const top = new T.Mesh(new T.CylinderGeometry(TR, TR, 0.12, 48), lam("#3a0d16")); top.position.y = TY - 0.06; tbl.add(top);
    const rim = new T.Mesh(new T.TorusGeometry(TR, 0.06, 8, 48), lam("#b8902a")); rim.rotation.x = Math.PI / 2; rim.position.y = TY; tbl.add(rim);
    const leg = new T.Mesh(new T.CylinderGeometry(0.5, 0.9, TY - 0.1, 16), lam("#1c0d12")); leg.position.y = (TY - 0.1) / 2; tbl.add(leg);
    poolMat = new T.MeshBasicMaterial({ color: 0xffe0b0, transparent: true, opacity: 0.11, depthWrite: false }); const pool = new T.Mesh(new T.CircleGeometry(TR * 0.82, 40), poolMat); pool.rotation.x = -Math.PI / 2; pool.position.y = TY + 0.004; tbl.add(pool);
    // le présentateur, derrière la table
    hostG = new T.Group(); hostG.position.set(0, 0, -4.7); scene.add(hostG);
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
    // sa main géante, qui sort pour frapper la table
    giant = makeHand("#f2e6d4", { pose: "flat", sleeve: "#0e0e14", sleeveLen: 2.2 }); giant.g.scale.setScalar(2.3); giant.g.rotation.y = Math.PI; giant.g.visible = false; giant.g.position.set(0, 5, -1); scene.add(giant.g);
    giant.want = V(0, 5, -1); giant.k = 4;
    // projecteurs et poussière
    for (let i = 0; i < 3; i++) { const c = new T.Mesh(new T.ConeGeometry(2.4, 12, 18, 1, true), new T.MeshBasicMaterial({ color: [0xff3b4e, 0xffe08a, 0xb06bff][i], transparent: true, opacity: 0.1, side: T.DoubleSide, depthWrite: false })); c.position.set((i - 1) * 7, 8.5, -3); scene.add(c); cones.push(c); }
    const n = 70, g = new T.BufferGeometry(), pos = new Float32Array(n * 3); for (let i = 0; i < n; i++) { pos[i * 3] = (Math.random() - 0.5) * 22; pos[i * 3 + 1] = Math.random() * 9; pos[i * 3 + 2] = (Math.random() - 0.5) * 16; }
    g.setAttribute("position", new T.BufferAttribute(pos, 3)); dust = new T.Points(g, new T.PointsMaterial({ color: 0xffd0c0, size: 0.07 })); scene.add(dust);
    podG = new T.Group(); scene.add(podG); propG = new T.Group(); scene.add(propG); fxG = new T.Group(); scene.add(fxG);
    canvas.addEventListener("pointerdown", onDown); canvas.addEventListener("pointermove", onMove);
    window.addEventListener("resize", St.resize); St.resize(); St.ready = true; requestAnimationFrame(loop); return true;
  };
  St.resize = function () { if (!renderer || !host) return; const w = host.clientWidth || 300, h = host.clientHeight || 200; renderer.setSize(w, h, false); camera.aspect = w / h; applyOffset(); };
  // la zone libre de l'écran devient le cadre principal de la caméra, avec un champ adapté à sa forme, en largeur comme sur téléphone
  function applyOffset() {
    const w = host.clientWidth || 300, h = host.clientHeight || 200; const region = focusTop || focusBot; const rh = region ? Math.max(60, h - focusBot - focusTop) : h;
    const ra = w / rh; const D = Math.PI / 180; camera.aspect = ra; camera.fov = clamp((2 * Math.atan(Math.tan(38 * D) / ra)) / D, 24, 62);
    if (region) camera.setViewOffset(w, rh, 0, -focusTop, w, h); else camera.clearViewOffset();
    camera.updateProjectionMatrix();
  }
  // zone libre de l'écran où l'on veut voir la table, en pixels depuis le haut et depuis le bas
  St.setFocus = function (top, bot) { top = Math.round(top || 0); bot = Math.round(bot || 0); if (top === focusTop && bot === focusBot) return; focusTop = top; focusBot = bot; if (renderer) applyOffset(); };
  St.setView = function (mode, focusId) { camMode = mode || "wide"; camFocus = focusId || null; };

  // ---------- pupitres et joueurs ----------
  function seatAngle(i, n) { if (n <= 1) return 0; const sp = Math.min(112, 22 + 16 * (n - 1)) * (Math.PI / 180); return -sp + (2 * sp * i) / (n - 1); }
  function dirOf(id) { const o = pods[id]; return o ? V(Math.sin(o.th), 0, Math.cos(o.th)) : V(0, 0, 1); }
  function ghostMesh() {
    const pts = [[0, 1.05], [0.2, 1.02], [0.34, 0.86], [0.4, 0.55], [0.43, 0.2], [0.47, -0.15], [0.52, -0.45], [0.44, -0.52], [0.5, -0.6]].map((p) => new T.Vector2(p[0], p[1]));
    const g = new T.Group(); const m = new T.MeshLambertMaterial({ color: 0xcfe8ff, emissive: 0x3a5a7a, transparent: true, opacity: 0, side: T.DoubleSide, depthWrite: false });
    g.add(new T.Mesh(new T.LatheGeometry(pts, 18), m));
    [-1, 1].forEach((sd) => { const e = new T.Mesh(new T.SphereGeometry(0.07, 8, 6), new T.MeshBasicMaterial({ color: 0x10141c, transparent: true, opacity: 0 })); e.position.set(sd * 0.14, 0.62, -0.36); g.add(e); });
    return g;
  }
  St.setPlayers = function (list, me) {
    if (!scene) return; if (me) meId = me; const key = list.map((p) => p.id + ":" + p.color + ":" + p.max + ":" + (p.name || "")).join("|");
    if (St.key !== key) {
      St.key = key; while (podG.children.length) drop(podG.children[0]); pods = {}; const n = list.length;
      list.forEach((p, i) => {
        const th = seatAngle(i, n); const g = new T.Group(); g.position.set(Math.sin(th) * PR, 0, Math.cos(th) * PR); g.rotation.y = th;
        const base = new T.Mesh(new T.BoxGeometry(1.5, 1.0, 0.72), lam("#1c0d12")); base.position.y = 0.5; g.add(base);
        const top = new T.Mesh(new T.BoxGeometry(1.62, 0.08, 0.84), lam(p.hex)); top.position.y = 1.04; g.add(top);
        const hands = [], sheets = []; const sp = Math.min(0.42, 1.36 / Math.max(1, p.max));
        for (let k = 0; k < p.max; k++) {
          const h = makeHand(SKIN, { pose: "flat" }); h.g.scale.setScalar(0.58); h.g.position.set((k - (p.max - 1) / 2) * sp, 1.12, 0.02); g.add(h.g); hands.push(h);
          const sh = new T.Group(); const cloth = new T.Mesh(new T.SphereGeometry(0.3, 14, 10), lam("#ece6d6")); cloth.scale.set(0.95, 0.42, 1.15); sh.add(cloth);
          const stain = new T.Mesh(new T.CircleGeometry(0.07, 12), bas("#8c1020")); stain.rotation.x = -Math.PI / 2; stain.position.set(0.05, 0.128, 0.05); sh.add(stain);
          sh.position.set(h.g.position.x, 1.1, 0.02); sh.visible = false; g.add(sh); sheets.push(sh);
        }
        const av = new T.Group(); av.position.z = 0.9; g.add(av);
        const chair = new T.Mesh(new T.BoxGeometry(1.0, 1.9, 0.12), lam("#2a1219")); chair.position.set(0, 1.4, 0.42); av.add(chair);
        const torso = new T.Mesh(new T.CylinderGeometry(0.34, 0.46, 1.1, 12), lam("#17121d")); torso.position.y = 1.55; av.add(torso);
        const scarf = new T.Mesh(new T.CylinderGeometry(0.3, 0.35, 0.14, 12), lam(p.hex)); scarf.position.y = 2.1; av.add(scarf);
        const head = new T.Group(); head.position.y = 2.44; av.add(head);
        head.add(new T.Mesh(new T.SphereGeometry(0.31, 14, 10), lam("#eadfcc")));
        [-1, 1].forEach((sd) => { const e = new T.Mesh(new T.SphereGeometry(0.045, 8, 6), bas("#1a0d12")); e.position.set(sd * 0.11, 0.05, -0.28); head.add(e); });
        const hat = new T.Mesh(new T.ConeGeometry(0.22, 0.34, 10), lam(p.hex)); hat.position.y = 0.36; head.add(hat);
        const gh = ghostMesh(); gh.position.set(0, 1.55, 0.9); g.add(gh);
        const red = new T.Mesh(new T.ConeGeometry(1.0, 4.2, 18, 1, true), new T.MeshBasicMaterial({ color: 0xff2030, transparent: true, opacity: 0, side: T.DoubleSide, depthWrite: false, blending: T.AdditiveBlending })); red.position.set(0, 3.2, 0.2); g.add(red);
        const nm = label(p.name || "", { size: 0.34, color: p.hex, fs: 44, bg: "rgba(10,4,8,0.7)" }); nm.position.set(0, 3.25, 0.9); g.add(nm);
        podG.add(g); pods[p.id] = { id: p.id, g, th, hands, sheets, av, head, gh, red, nm, nmPos: (g.updateMatrixWorld(true), g.localToWorld(V(0, 3.25, 0.9))), hex: p.hex, max: p.max, covered: 0, want: p.max - p.hands, alive: p.alive, ghostK: p.alive ? 0 : 1, pulse: 0, redK: 0, redT: 0 };
      });
    }
    list.forEach((p) => { const o = pods[p.id]; if (!o) return; o.alive = p.alive; o.want = Math.max(0, o.max - p.hands); });
  };
  function syncCovers(o, instant) {
    o.sheets.forEach((sh, k) => { const covered = k >= o.max - o.covered; if (covered && !sh.visible) { sh.visible = true; if (!instant) { sh.position.y = 2.2; anim(0.35, (q) => { sh.position.y = 2.2 - 1.1 * ease(q); }); } } if (!covered) sh.visible = false; o.hands[k].g.visible = !covered; });
  }
  St.hold = function (v) { holdSync = !!v; };
  // le moment fort, lumière rouge sur le pupitre
  St.redLight = function (id, on) { const o = pods[id]; if (o) o.redT = on ? 1 : 0; };
  // pendant la coupure noire, la main disparaît sous un drap
  St.cover = function (id) { const o = pods[id]; if (!o) return; o.covered = Math.min(o.max, o.covered + 1); syncCovers(o, true); St.shake(0.35); };
  St.pulse = function (id) { const o = pods[id]; if (o) o.pulse = 1; };
  St.flash = function (hex, amt) { flash = amt || 1; flashCol.set(hex || "#ff3b4e"); };
  St.shake = function (v) { shake = Math.max(shake, v); };
  St.talk = function (sec) { talk = Math.max(talk, sec || 1.6); };
  St.mood = function (hex) { moodTarget.set(hex); };
  St.dark = function (v) { darkT = clamp(v || 0, 0, 1); };
  St.loseHand = function (id) { St.cover(id); };

  // une main de joueur qui part du pupitre vers un point de la table
  function reach(pid, target, o) {
    const pod = pods[pid]; if (!pod) return null; o = o || {}; const from = pod.g.localToWorld(V(0, 1.3, -0.25)); const to = target.clone();
    const h = makeHand(SKIN, { pose: "flat", sleeve: pod.hex, sleeveLen: pid === meId && camMode === "seat" ? 0.9 : 2.6 }); h.g.scale.setScalar(o.scale || 0.6); h.g.position.copy(from); (o.stay ? propG : fxG).add(h.g);
    const yaw = Math.atan2(to.x - from.x, to.z - from.z); h.g.rotation.y = yaw + Math.PI;
    if (pod.ghostK > 0.5) { h.mat.transparent = true; h.mat.opacity = 0.45; h.mat.color.set("#cfe8ff"); }
    const dur = o.dur || 0.9; const up = o.up || 0.12;
    anim(dur, (k) => { const s = o.stay ? ease(k / 0.6) : k < 0.45 ? ease(k / 0.45) : k < 0.62 ? 1 : 1 - ease((k - 0.62) / 0.38); h.g.position.lerpVectors(from, to, s); h.g.position.y += Math.sin(s * Math.PI) * 0.45 + up * s; },
      () => { if (!o.stay) drop(h.g); }, o.delay || 0);
    return h;
  }

  // ---------- la main géante ----------
  function giantShow(on) { giant.g.visible = !!on; giant.busy = false; if (!on) giant.want.set(0, 6, -2.5); }
  function giantSlam(x, z, hold, after) {
    giant.busy = true; const sx = giant.g.position.x, sz = giant.g.position.z, sy = giant.g.position.y; lean = 1;
    anim(0.14, (k) => { giant.g.position.set(sx + (x - sx) * k, sy + (TY + 0.32 - sy) * ease(k), sz + (z - sz) * k); }, () => { St.shake(0.55); if (after) after(); anim(hold || 0.3, () => {}, () => { giant.busy = false; }); });
  }

  // ---------- accessoires des épreuves ----------
  const B = {};
  const worldOf = (o) => o.getWorldPosition(V(0, 0, 0));
  const myTh = () => (pods[meId] ? pods[meId].th : 0);
  const PADS = ["#e63946", "#3d7bd9", "#ffd23f", "#2fe0a8"];
  const HOTC = { "brûlant": "#ff3b4e", chaud: "#f77f00", "tiède": "#ffd23f", froid: "#3d7bd9" };
  function setPick(m, pick) { m.userData.pick = pick; return m; }
  const cap1 = (x) => x.charAt(0).toUpperCase() + x.slice(1);
  function glow(c, r) { return new T.Mesh(new T.SphereGeometry(r || 0.3, 14, 10), new T.MeshBasicMaterial({ color: col(c), transparent: true, opacity: 0, depthWrite: false, blending: T.AdditiveBlending })); }
  const isHover = (pick) => hoverObj && hoverObj.userData.pick && hoverObj.userData.pick.k === pick.k && hoverObj.userData.pick.i === pick.i;

  B.croco = function (v) {
    const G = new T.Group(); G.position.y = TY; G.rotation.y = myTh(); propG.add(G); const green = lam("#2f8f3a"), pink = lam("#c4455a");
    const low = new T.Mesh(new T.CylinderGeometry(1.0, 1.08, 0.26, 28), green); low.scale.set(1.15, 1, 0.92); low.position.y = 0.13; G.add(low);
    const tongue = new T.Mesh(new T.CylinderGeometry(0.62, 0.66, 0.05, 20), pink); tongue.scale.set(1.1, 1, 0.8); tongue.position.y = 0.27; G.add(tongue);
    const hinge = new T.Group(); hinge.position.set(0, 0.28, -0.92); G.add(hinge);
    const up = new T.Mesh(new T.CylinderGeometry(1.0, 1.08, 0.3, 28), green); up.scale.set(1.15, 1, 0.92); up.position.set(0, 0.17, 0.92); hinge.add(up);
    const pal = new T.Mesh(new T.CylinderGeometry(0.88, 0.88, 0.03, 20), pink); pal.scale.set(1.1, 1, 0.8); pal.position.set(0, 0.01, 0.92); hinge.add(pal);
    [-1, 1].forEach((sd) => { const e = new T.Mesh(new T.SphereGeometry(0.2, 14, 10), lam("#ffd23f")); e.position.set(sd * 0.42, 0.4, 0.3); hinge.add(e); const pu = new T.Mesh(new T.BoxGeometry(0.05, 0.24, 0.06), bas("#000000")); pu.position.set(sd * 0.42, 0.42, 0.48); hinge.add(pu); const ns = new T.Mesh(new T.SphereGeometry(0.06, 8, 6), lam("#1f6a2a")); ns.position.set(sd * 0.2, 0.34, 1.72); hinge.add(ns); });
    for (let i = 0; i < 14; i++) { const a = (-160 + (320 * i) / 13) * (Math.PI / 180); const ut = new T.Mesh(new T.ConeGeometry(0.06, 0.16, 5), lam("#f5f0e1")); ut.rotation.x = Math.PI; ut.position.set(Math.sin(a) * 1.0, -0.06, 0.92 + Math.cos(a) * 0.8); hinge.add(ut); }
    const teeth = [];
    for (let i = 0; i < v.teeth; i++) {
      const phi = (-150 + (300 * i) / (v.teeth - 1)) * (Math.PI / 180); const x = Math.sin(phi) * 0.98, z = Math.cos(phi) * 0.78;
      const tooth = setPick(new T.Mesh(new T.ConeGeometry(0.105, 0.28, 6), lam("#f5f0e1", { emissive: 0x000000 })), { k: "tooth", i }); tooth.position.set(x, 0.4, z); G.add(tooth); teeth.push(tooth);
      const lb = label(String(i + 1), { size: 0.3, fs: 48, depthTest: false }); lb.position.set(x * 1.28, 0.75, z * 1.28); G.add(lb);
    }
    let open = 0.6, nPressed = 0, bitten = false, amp = 0;
    return { update(v, st, now, dt) {
      v.pressed.forEach((p) => { const tm = teeth[p.i]; if (tm && !tm.userData.down) { tm.userData.down = 1; tm.position.y = 0.27; tm.material.color.set(p.hint ? HOTC[p.hint] || "#9a9384" : "#8f897b"); } });
      if (v.pressed.length > nPressed) { const p = v.pressed[v.pressed.length - 1]; if (teeth[p.i]) reach(p.by, worldOf(teeth[p.i]).add(V(0, 0.1, 0)), { dur: 0.8 }); nPressed = v.pressed.length; St.shake(0.06); }
      const frac = v.pressed.length / v.teeth; amp = 0.004 + 0.07 * Math.pow(frac, 1.5) * (v.nTraps > 1 ? 1.5 : 1);
      if (v.bite && !bitten) { bitten = true; const tm = teeth[v.bite.i]; if (tm) tm.material.color.set("#e63946"); St.shake(1); St.flash("#ff3b4e", 0.8); }
      if (v.traps) v.traps.forEach((i) => { if (teeth[i] && !(v.bite && v.bite.i === i)) teeth[i].material.color.set("#ff8a8a"); });
      open += ((bitten ? 0.02 : 0.6) - open) * Math.min(1, dt * (bitten ? 30 : 3));
      hinge.rotation.x = -(open + (bitten ? 0 : Math.sin(t * 38) * amp + Math.sin(t * 23) * amp * 0.6));
      G.position.x = bitten ? 0 : (Math.random() - 0.5) * amp * 0.4; G.position.z = bitten ? 0 : (Math.random() - 0.5) * amp * 0.4;
      const mine = v.turn === meId && !bitten; teeth.forEach((tm) => { const ok = mine && !tm.userData.down; tm.scale.setScalar(ok && hoverObj === tm ? 1.25 : 1); tm.material.emissive.setRGB(ok ? 0.25 + 0.2 * Math.sin(t * 6) : 0, ok ? 0.15 : 0, 0); });
    } };
  };

  B.collision = function (v) {
    const G = new T.Group(); G.position.y = TY + 0.01; propG.add(G); const n = v.n; const cells = []; const R = n > 6 ? 1.55 : 1.3;
    for (let i = 0; i < n; i++) {
      const a = (i - (n - 1) / 2) * ((2 * Math.PI) / n); const x = Math.sin(a) * R, z = Math.cos(a) * R;
      const cell = setPick(new T.Mesh(new T.CylinderGeometry(0.42, 0.42, 0.05, 28), lam("#4a1a28", { emissive: 0x000000 })), { k: "cell", i }); cell.position.set(x, 0.025, z); G.add(cell);
      const rimC = new T.Mesh(new T.TorusGeometry(0.42, 0.025, 6, 28), lam("#b8902a")); rimC.rotation.x = Math.PI / 2; rimC.position.set(x, 0.05, z); G.add(rimC);
      const num = flatText(String(i + 1), 0.62, { color: "#ffd23f" }); num.position.set(x, 0.06, z); num.rotation.z = myTh(); G.add(num); cells.push(cell);
    }
    let mine = null, revealed = false;
    return { update(v) {
      if (v.mine && !mine && !v.all) { const c = cells[v.mine - 1]; if (c) mine = reach(meId, worldOf(c).add(V(0, 0.1, 0)), { stay: true, dur: 0.5 }); }
      cells.forEach((c, i) => { const hv = !v.mine && hoverObj === c; c.material.emissive.setRGB(hv ? 0.4 : v.mine === i + 1 ? 0.25 : 0, hv ? 0.25 : 0, 0); });
      if (v.all && !revealed) {
        revealed = true; if (mine) { drop(mine.g); mine = null; } const groups = {}; Object.keys(v.all).forEach((id) => { (groups[v.all[id]] = groups[v.all[id]] || []).push(id); }); let big = 1; Object.values(groups).forEach((g) => { big = Math.max(big, g.length); });
        const crushed = []; Object.keys(groups).forEach((k) => { const c = cells[k - 1]; if (!c) return; groups[k].forEach((id, j) => { const h = reach(id, worldOf(c).add(V((j % 2) * 0.08, 0.1 + j * 0.09, 0)), { stay: true, dur: 0.6, delay: j * 0.15 }); if (h && groups[k].length > 1) crushed.push({ h, big: groups[k].length === big, c }); }); });
        if (crushed.length) { const cs = [...new Set(crushed.map((x) => x.c))]; anim(0.01, () => {}, () => { giantShow(true); giant.g.position.set(0, 5, -2); }, 0.8); cs.forEach((c, i) => { anim(0.01, () => {}, () => { const p = worldOf(c); giantSlam(p.x, p.z, 0.35, () => { crushed.filter((x) => x.c === c).forEach((x) => { x.h.g.scale.y *= 0.35; if (x.big) x.h.mat.color.set("#d0505a"); }); }); }, 1.2 + i * 0.75); }); anim(0.01, () => {}, () => giantShow(false), 1.8 + cs.length * 0.75); }
      }
    } };
  };

  B.simon = function () {
    const G = new T.Group(); G.position.y = TY; G.rotation.y = myTh(); propG.add(G); const bells = [];
    const prof = [[0, 0.62], [0.06, 0.6], [0.14, 0.52], [0.2, 0.36], [0.24, 0.2], [0.32, 0.06], [0.36, 0]].map((p) => new T.Vector2(p[0], p[1]));
    PADS.forEach((c, k) => {
      const b = new T.Group(); b.position.set(-1.05 + k * 0.7, 0, 0.15); G.add(b);
      const m = phong(c, { emissive: 0x000000, shininess: 80, side: T.DoubleSide }); const body = setPick(new T.Mesh(new T.LatheGeometry(prof, 20), m), { k: "bell", i: k }); b.add(body);
      const knob = new T.Mesh(new T.SphereGeometry(0.06, 8, 6), lam("#d9c48a")); knob.position.y = 0.66; b.add(knob);
      const gl = glow(c, 0.55); gl.position.y = 0.3; b.add(gl);
      const lb = label(String(k + 1), { size: 0.18, fs: 36 }); lb.position.set(0, 0.86, 0); b.add(lb); bells.push({ b, m, gl, c: col(c), lit: 0 });
    });
    return { update(v, st, now, dt) {
      const L = v.seq.length; const idx = now >= v.showStart && now < v.showStart + L * v.pace ? Math.floor((now - v.showStart) / v.pace) : -1; const within = idx >= 0 && (now - v.showStart) % v.pace < v.pace * 0.72;
      St.dark(now < v.ends && !v.over ? 0.86 : 0);
      bells.forEach((x, k) => { const on = (within && v.seq[idx] === k) || (St.ringK === k && performance.now() - St.ringAt < 200); x.lit += ((on ? 1 : 0) - x.lit) * Math.min(1, dt * 18); x.m.emissive.copy(x.c).multiplyScalar(0.12 + 0.88 * x.lit); x.gl.material.opacity = 0.55 * x.lit; x.b.rotation.z = Math.sin(t * 30) * 0.08 * x.lit; x.b.scale.setScalar(isHover({ k: "bell", i: k }) ? 1.08 : 1); });
    }, end() { St.dark(0); } };
  };
  St.ring = function (k) { St.ringK = k; St.ringAt = performance.now(); };

  function tableHands(part, R, opts) {
    const out = {}; part.forEach((id) => { const d = dirOf(id); const h = makeHand(SKIN, { pose: opts && opts.pose, sleeve: pods[id] ? pods[id].hex : "#444", sleeveLen: opts && opts.pose === "up" ? 0.42 : 1.6 }); h.g.scale.setScalar((opts && opts.scale) || 0.7); h.g.position.set(d.x * R, TY + 0.05, d.z * R); h.g.rotation.y = Math.atan2(d.x, d.z); if (pods[id] && pods[id].ghostK > 0.5) { h.mat.transparent = true; h.mat.opacity = 0.45; h.mat.color.set("#cfe8ff"); } propG.add(h.g); out[id] = h; }); return out;
  }

  B.reflex = function (v, st) {
    const hands = tableHands(st.part, 1.25, { pose: "flat" });
    giantShow(true); giant.g.position.set(0, 4.6, -1.6); giant.want.set(0, 2.1, -0.25); giant.k = 3; let nf = 0, slammed = false; const gone = {};
    const myHand = hands[meId]; if (myHand) myHand.g.traverse((m) => { if (m.isMesh) m.userData.pick = { k: "myhand" }; });
    return { update(v) {
      if (v.feints.length > nf && !slammed) { const f = v.feints[v.feints.length - 1]; nf = v.feints.length; giant.busy = true; const y0 = giant.g.position.y; anim(0.16, (k) => { giant.g.position.y = y0 - f.d * 1.7 * ease(k); }, () => anim(0.4, (k) => { giant.g.position.y = y0 - f.d * 1.7 * (1 - ease(k)); }, () => { giant.busy = false; })); St.shake(0.08); }
      if (v.fired && !slammed) { slammed = true; giantSlam(0, 0, 9); St.flash("#ffffff", 0.4); }
      Object.keys(hands).forEach((id) => { if ((v.taps[id] !== undefined || v.early[id]) && !gone[id]) { gone[id] = 1; const h = hands[id]; const d = dirOf(id); const p0 = h.g.position.clone(); anim(0.18, (k) => { h.g.position.set(p0.x + d.x * 1.1 * k, p0.y + 0.25 * Math.sin(k * Math.PI), p0.z + d.z * 1.1 * k); }); if (v.early[id]) h.mat.color.set("#d0505a"); } });
    }, end() { giantShow(false); } };
  };

  B.stoppile = function (v) {
    const G = new T.Group(); G.rotation.y = myTh(); propG.add(G); const L = 2.15; const piv = new T.Group(); piv.position.set(0, TY + 2.5, -0.1); G.add(piv);
    const arm = new T.Mesh(new T.CylinderGeometry(0.025, 0.025, L, 6), lam("#888888")); arm.position.y = -L / 2; piv.add(arm);
    const blade = setPick(new T.Mesh(new T.BoxGeometry(0.9, 0.1, 0.45), phong("#d8dde6", { shininess: 120 })), { k: "stop" }); blade.position.y = -L; piv.add(blade);
    const X = (p) => Math.sin((p - 0.5) * 1.5) * L; const z0 = X(v.target - v.w), z1 = X(v.target + v.w);
    const zone = new T.Mesh(new T.BoxGeometry(Math.max(0.06, z1 - z0), 0.02, 0.9), bas("#ffd23f")); zone.position.set((z0 + z1) / 2, TY + 0.012, -0.1); G.add(zone);
    const track = new T.Mesh(new T.BoxGeometry(X(1) - X(0), 0.01, 0.9), lam("#5a2838")); track.position.set(0, TY + 0.008, -0.1); G.add(track);
    const marks = {};
    return { update(v, st, now) {
      const pos = v.mine !== null && v.mine !== undefined ? v.mine : now < v.t0 ? 0 : 1 - Math.abs(2 * (((now - v.t0) / v.P) % 1) - 1); piv.rotation.z = -(pos - 0.5) * 1.5;
      if (v.errs) Object.keys(v.errs).forEach((id) => { if (marks[id] || !pods[id]) return; const sgn = id === meId && v.mine !== null ? Math.sign(v.mine - v.target) || 1 : (id.length % 2 ? -1 : 1); const p = clamp(v.target + sgn * v.errs[id], 0, 1); const m = new T.Mesh(new T.CylinderGeometry(0.07, 0.07, 0.03, 12), bas(pods[id].hex)); m.position.set(X(p), TY + 0.03, 0.12); G.add(m); marks[id] = m; });
    } };
  };

  B.coffre = function () {
    const G = new T.Group(); G.position.y = TY; G.rotation.y = myTh(); propG.add(G); const metal = phong("#3a3d46", { shininess: 60 });
    const body = new T.Mesh(new T.BoxGeometry(1.3, 1.25, 1.0), metal); body.position.y = 0.63; G.add(body);
    const inside = new T.Mesh(new T.BoxGeometry(1.1, 1.05, 0.05), bas("#ffd23f")); inside.position.set(0, 0.63, 0.47); G.add(inside);
    const hinge = new T.Group(); hinge.position.set(-0.6, 0.63, 0.52); G.add(hinge); const door = new T.Mesh(new T.BoxGeometry(1.2, 1.15, 0.08), phong("#4c505c", { shininess: 80 })); door.position.x = 0.6; hinge.add(door);
    const dial = new T.Mesh(new T.CylinderGeometry(0.2, 0.2, 0.06, 20), phong("#c9b26a")); dial.rotation.x = Math.PI / 2; dial.position.set(0.85, 0.15, 0.06); hinge.add(dial);
    const cv = document.createElement("canvas"); cv.width = 256; cv.height = 96; const tex = new T.CanvasTexture(cv); const disp = new T.Mesh(new T.PlaneGeometry(0.8, 0.3), new T.MeshBasicMaterial({ map: tex })); disp.position.set(0.55, -0.25, 0.05); hinge.add(disp);
    let shown = ""; const tags = {}; let opened = false;
    const draw = (txt) => { const x = cv.getContext("2d"); x.fillStyle = "#10160e"; x.fillRect(0, 0, 256, 96); x.fillStyle = "#5ef06a"; x.font = "bold 64px monospace"; x.textAlign = "center"; x.textBaseline = "middle"; x.fillText(txt, 128, 52); tex.needsUpdate = true; };
    draw("? ? ?");
    return { update(v, st) {
      const last = v.guesses.length ? v.guesses[v.guesses.length - 1] : null; const txt = v.code ? v.code.join(" ") : last ? last.g.join(" ") : "? ? ?"; if (txt !== shown) { shown = txt; draw(txt); if (last) dial.rotation.y += 2; }
      if (v.cracked && !opened) { opened = true; anim(0.8, (k) => { hinge.rotation.y = -1.9 * ease(k); }); St.flash("#ffd23f", 0.5); }
      st.part.forEach((id) => { if (id === meId || !pods[id]) return; const code = v.hv && v.hv[id]; if (!tags[id]) { tags[id] = label(" ", { size: 0.3, bg: "rgba(10,4,8,0.8)", color: pods[id].hex }); tags[id].position.copy(pods[id].g.localToWorld(V(0, 1.75, -0.35))); propG.add(tags[id]); } tags[id].visible = !!code; if (code) relabel(tags[id], "✏️ " + code.join(" "), { size: 0.3, bg: "rgba(10,4,8,0.8)", color: pods[id].hex }); });
    } };
  };

  B.bombe = function (v, st) {
    const G = new T.Group(); G.position.y = TY; G.rotation.y = myTh(); propG.add(G);
    const bomb = new T.Group(); G.add(bomb); const ball = new T.Mesh(new T.SphereGeometry(0.55, 22, 16), phong("#15151a", { shininess: 90 })); ball.position.y = 0.55; bomb.add(ball);
    const cap = new T.Mesh(new T.CylinderGeometry(0.14, 0.16, 0.18, 12), lam("#5a5a64", { emissive: 0x000000 })); cap.position.y = 1.12; bomb.add(cap);
    const pts = [V(0, 1.2, 0), V(0.25, 1.15, 0.2), V(0.45, 0.4, 0.5), V(0.7, 0.05, 0.75), V(1.25, 0.04, 0.55), V(1.55, 0.04, 1.0), V(1.1, 0.04, 1.45), V(0.4, 0.04, 1.3), V(-0.3, 0.04, 1.65), V(-1.0, 0.04, 1.35), V(-1.5, 0.04, 0.75)];
    const curve = new T.CatmullRomCurve3(pts); const N = 70; const segs = []; const rope = lam("#c9a46a");
    for (let i = 0; i < N; i++) { const a = curve.getPoint(i / N), b = curve.getPoint((i + 1) / N); const len = a.distanceTo(b); const s = new T.Mesh(new T.CylinderGeometry(0.03, 0.03, len, 5), rope); s.position.copy(a).add(b).multiplyScalar(0.5); s.lookAt(b.x + G.position.x, b.y + G.position.y, b.z + G.position.z); s.rotateX(Math.PI / 2); G.add(s); segs.push(s); }
    const spark = new T.Mesh(new T.SphereGeometry(0.045, 8, 6), bas("#fff3b0")); const halo = glow("#ff9a2a", 0.11); spark.add(halo); G.add(spark);
    const hands = {}; st.part.forEach((id) => { const d = dirOf(id).applyAxisAngle(V(0, 1, 0), -myTh()); const piv = new T.Group(); piv.position.set(d.x * 0.42, 0.62, d.z * 0.42); piv.rotation.y = Math.atan2(d.x, d.z); G.add(piv); const h = makeHand(SKIN, { pose: "flat", sleeve: pods[id] ? pods[id].hex : "#444", sleeveLen: 1.6 }); h.g.scale.setScalar(0.62); h.g.rotation.x = 0.85; h.g.position.z = 0.32; piv.add(h.g); hands[id] = { piv, h, out: false }; });
    let boomed = false;
    return { update(v, st, now) {
      const s = clamp((now - v.t0) / v.vis, 0, 1); const burning = now >= v.t0 && !v.over;
      segs.forEach((sg, i) => { sg.visible = i / N < 1 - s + 0.001; });
      const p = curve.getPoint(Math.max(0, 1 - s)); spark.position.copy(p); spark.visible = !v.over; spark.scale.setScalar(burning ? 0.8 + Math.random() * 0.9 : 0.6); halo.material.opacity = burning ? 0.55 + Math.random() * 0.3 : 0.2;
      if (s >= 1 && burning) { spark.position.set(0, 1.22 + Math.random() * 0.03, 0); cap.material.emissive.setRGB(0.3 + Math.random() * 0.3, 0.1, 0); }
      Object.keys(hands).forEach((id) => { const H = hands[id]; if (v.out[id] !== undefined && !H.out) { H.out = true; const p0 = H.piv.position.clone(); const d = dirOf(id).applyAxisAngle(V(0, 1, 0), -myTh()); anim(0.3, (k) => { H.piv.position.set(p0.x + d.x * 1.6 * ease(k), p0.y - 0.55 * ease(k), p0.z + d.z * 1.6 * ease(k)); H.h.g.rotation.x = 0.85 * (1 - k); }); } });
      if (v.over && v.boom && !boomed) {
        boomed = true; bomb.visible = false; spark.visible = false; St.flash("#ff8a3b", 1.4); St.shake(1.3);
        Object.keys(hands).forEach((id) => { if (!hands[id].out) hands[id].h.mat.color.set("#2a2226"); });
        const smoke = new T.Mesh(new T.SphereGeometry(0.6, 14, 10), new T.MeshBasicMaterial({ color: 0x55504c, transparent: true, opacity: 0.8, depthWrite: false })); smoke.position.y = 0.6; G.add(smoke); anim(1.6, (k) => { smoke.scale.setScalar(1 + k * 3); smoke.material.opacity = 0.8 * (1 - k); smoke.position.y = 0.6 + k * 1.2; });
        for (let i = 0; i < 16; i++) { const d = new T.Mesh(new T.BoxGeometry(0.1, 0.1, 0.1), lam(i % 2 ? "#15151a" : "#ff7a2a")); d.position.y = 0.6; G.add(d); const vx = (Math.random() - 0.5) * 6, vy = 2 + Math.random() * 4, vz = (Math.random() - 0.5) * 6; anim(1.1, (k) => { const tt = k * 1.1; d.position.set(vx * tt, 0.6 + vy * tt - 4.9 * tt * tt, vz * tt); d.rotation.x += 0.3; }, () => { d.visible = false; }); }
      }
    } };
  };

  B.coupdoeil = function () {
    const G = new T.Group(); G.position.y = TY; G.rotation.y = myTh(); propG.add(G); let shownQ = -1, hs = [], popAt = 0;
    return { update(v, st, now) {
      const on = !!v.hands && now >= v.flashStart && now < v.flashEnd;
      if (v.hands && shownQ !== v.qi) { shownQ = v.qi; hs.forEach((h) => drop(h.g)); hs = []; const n = v.hands.length; v.hands.forEach((hd, i) => { const h = makeHand(SKIN, { pose: "up", mirror: hd.s < 0 }); h.mask(hd.up); h.spread(0.6); h.g.position.set((i - (n - 1) / 2) * Math.min(0.95, 4.2 / n), 0.7, 0.1 + (i % 2) * 0.4); h.g.rotation.z = (hd.r * Math.PI) / 180; h.sgn = hd.s < 0 ? -1 : 1; G.add(h.g); hs.push(h); }); }
      if (on && !popAt) popAt = performance.now(); if (!on) popAt = 0; const k = on ? Math.min(1, (performance.now() - popAt) / 70) : 0; hs.forEach((h) => { h.g.visible = on; h.g.scale.set(1.35 * k * h.sgn, 1.35 * k, 1.35 * k); });
    } };
  };

  function fistHands(st, R) { const hands = tableHands(st.part, R, { pose: "up", scale: 0.75 }); Object.keys(hands).forEach((id) => { const h = hands[id]; h.mask([0, 0, 0, 0, 0]); h.g.position.y = TY + 0.42; h.g.rotation.y += Math.PI; }); return hands; }
  B.doigts = function (v, st) {
    const hands = fistHands(st, 1.6); let shown = false;
    return { update(v) { if (v.reveal && !shown) { shown = true; Object.keys(hands).forEach((id) => { const f = v.reveal.f[id] || 0; hands[id].mask([0, f >= 1, f >= 2, f >= 3, 0]); hands[id].spread(0.5); }); St.shake(0.15); } if (!shown) Object.keys(hands).forEach((id) => { hands[id].g.position.y = TY + 0.42 + (v.locked[id] ? 0 : Math.abs(Math.sin(t * 3 + id.length)) * 0.06); }); } };
  };
  B.ppc = function (v, st) {
    const hands = fistHands(st, 1.6); let shown = false; const SH = [[0, 0, 0, 0, 0], [1, 1, 1, 1, 1], [0, 1, 1, 0, 0]];
    return { update(v) { if (v.all && !shown) { shown = true; Object.keys(hands).forEach((id) => { hands[id].mask(SH[v.all[id]] || SH[0]); hands[id].spread(v.all[id] === 2 ? 1.3 : 0.4); hands[id].g.position.y = TY + 0.42; }); St.shake(0.2); } if (!shown) Object.keys(hands).forEach((id) => { hands[id].g.position.y = TY + 0.42 + (v.chosen[id] ? 0.1 * Math.max(0, Math.sin(t * 9)) : 0); }); } };
  };

  B.hot = function () {
    const G = new T.Group(); G.position.y = TY; G.rotation.y = myTh(); propG.add(G); const cells = [];
    for (let k = 0; k < 9; k++) { const x = ((k % 3) - 1) * 0.72, z = (Math.floor(k / 3) - 1) * 0.72; const tile = setPick(new T.Mesh(new T.BoxGeometry(0.64, 0.06, 0.64), lam("#2a1219", { emissive: 0x000000 })), { k: "hot", i: k }); tile.position.set(x, 0.03, z); G.add(tile); const h = makeHand(SKIN, { pose: "flat" }); h.g.scale.setScalar(0.42); h.g.position.set(x, 0.1, z); h.g.rotation.y = Math.PI; G.add(h.g); cells.push({ tile, h }); }
    giantShow(true); giant.g.position.set(0, 5, -1.5); giant.want.set(0, 2.2, -0.4); giant.k = 2.5; let slamI = -1;
    return { update(v, st, now) {
      let lit = -1; v.seq.forEach((w) => { if (now >= v.start + w.at && now < v.start + w.at + w.dur) lit = w.cell; });
      cells.forEach((c, k) => { const on = k === lit; const hv = hoverObj === c.tile; c.tile.material.emissive.setRGB(on ? 0.9 : hv ? 0.2 : 0, on ? 0.25 : hv ? 0.1 : 0, 0); c.h.mat.color.set(on ? "#ff7a4a" : SKIN); });
      for (let i = slamI + 1; i < v.seq.length; i++) { const w = v.seq[i]; if (now >= v.start + w.at + w.dur) { slamI = i; if (!giant.busy) { const p = worldOf(cells[w.cell].tile); giantSlam(p.x, p.z, 0.12); } } else break; }
      if (!giant.busy && lit >= 0) { const p = worldOf(cells[lit].tile); giant.want.set(p.x, 2.0, p.z - 0.3); }
    }, end() { giantShow(false); } };
  };

  B.couteau = function (v, st) {
    const who = st.part.includes(meId) ? meId : st.part[0]; const th = pods[who] ? pods[who].th : 0; const d = dirOf(who);
    const G = new T.Group(); G.position.set(d.x * 0.5, TY, d.z * 0.5); G.rotation.y = th; propG.add(G);
    const H = makeHand(SKIN, { pose: "flat", sleeve: pods[who] ? pods[who].hex : "#444", sleeveLen: 0.35 }); H.spread(2.3); H.g.scale.setScalar(2.0); H.g.position.y = 0.14; H.g.position.z = 0.35; G.add(H.g);
    const gapLocal = []; const tipOf = (i, f) => { const p = H.fingers[i]; const a = p.rotation.z; const L = FL[i] * f; return new T.Vector2(p.position.x - L * Math.sin(a), p.position.y + L * Math.cos(a)); };
    for (let g = 0; g < 4; g++) { const a = tipOf(g, g === 0 ? 0.55 : 0.62), b = tipOf(g + 1, 0.62); gapLocal.push(new T.Vector2((a.x + b.x) / 2, (a.y + b.y) / 2)); }
    const marks = gapLocal.map((p, g) => { const m = setPick(new T.Mesh(new T.CircleGeometry(0.06, 18), new T.MeshBasicMaterial({ color: 0x5a2030, side: T.DoubleSide })), { k: "gap", i: g }); m.position.set(p.x, p.y, 0.066); H.inner.add(m); const lb = label(String(g + 1), { size: 0.11, fs: 40, depthTest: false }); lb.position.set(p.x, p.y + 0.02, -0.16); H.inner.add(lb); return m; });
    const ringM = new T.Mesh(new T.RingGeometry(0.062, 0.082, 24), new T.MeshBasicMaterial({ color: 0xffd23f, transparent: true, opacity: 0.9, side: T.DoubleSide, depthWrite: false })); H.inner.add(ringM);
    const knife = new T.Group(); G.add(knife); const blade = new T.Mesh(new T.BoxGeometry(0.12, 1.0, 0.03), phong("#dfe4ec", { shininess: 140 })); blade.position.y = 0.5; knife.add(blade); const tip = new T.Mesh(new T.ConeGeometry(0.06, 0.16, 4), phong("#dfe4ec", { shininess: 140 })); tip.rotation.x = Math.PI; tip.position.y = -0.06; knife.add(tip); const handle = new T.Mesh(new T.BoxGeometry(0.16, 0.5, 0.1), lam("#3a1f12")); handle.position.y = 1.25; knife.add(handle);
    const wp = (g) => { const p = gapLocal[g]; return H.inner.localToWorld(V(p.x, p.y, 0.066)); };
    let lastI = 0, stab = 0, failed = false;
    return { cam: () => ({ pos: V(d.x * 2.6, TY + 2.6, d.z * 2.6), look: V(d.x * 0.35, TY, d.z * 0.35) }), update(v, st, now, dt) {
      const P = v.prog[who] || { i: 0, fail: -1 }; const i = Math.min(P.i, v.n - 1); const b = v.beats[i]; const Bt = v.t0 + b.at; const prev = i > 0 ? v.t0 + v.beats[i - 1].at : v.t0 - 1200;
      if (P.i > lastI) { lastI = P.i; stab = 1; }
      const live = P.fail < 0 && P.i < v.n; const tgt = P.fail >= 0 ? (P.wrong >= 0 ? P.wrong : v.beats[P.fail].g) : b.g;
      marks.forEach((m, g) => { m.material.color.set(g === tgt && live ? 0xffd23f : isHover({ k: "gap", i: g }) ? 0x9a4050 : 0x5a2030); });
      const k = clamp((now - prev) / Math.max(1, Bt - prev), 0, 1); const gp = gapLocal[b.g]; ringM.position.set(gp.x, gp.y, 0.068); ringM.scale.setScalar(1 + 2.6 * (1 - k)); ringM.visible = live && now > v.t0 - 1500; ringM.material.opacity = 0.35 + 0.6 * k;
      const target = wp(stab > 0.5 ? v.beats[Math.max(0, P.i - 1)].g : tgt); const lp = G.worldToLocal(target.clone()); knife.position.x += (lp.x - knife.position.x) * Math.min(1, dt * 16); knife.position.z += (lp.z - knife.position.z) * Math.min(1, dt * 16);
      stab = Math.max(0, stab - dt * 7); knife.position.y = 0.06 + (stab > 0 ? (1 - stab) * 0.15 : 0.35 + 0.25 * (1 - k));
      if (P.fail >= 0 && !failed) {
        failed = true; const g = P.wrong >= 0 ? P.wrong : v.beats[P.fail].g; const f = H.fingers[Math.min(4, g + 1)]; St.shake(0.7); St.flash("#ff3b4e", 0.9);
        const y0 = f.position.y, x0 = f.rotation.x; anim(0.9, (q) => { f.position.z = -1.2 * Math.sin(q * Math.PI); f.rotation.x = x0 - q * 7; f.position.y = y0 + q * 0.35; }, () => { f.visible = false; });
        const sp = new T.Mesh(new T.CircleGeometry(0.12, 14), bas("#a01020", { side: T.DoubleSide })); sp.position.set(f.position.x, y0 + 0.05, 0.068); H.inner.add(sp);
      }
    } };
  };

  B.etau = function (v, st) {
    const G = new T.Group(); G.position.y = TY; G.rotation.y = myTh(); propG.add(G); const metal = phong("#5b616e", { shininess: 70 });
    const base = new T.Mesh(new T.BoxGeometry(3.0, 0.22, 1.1), metal); base.position.y = 0.11; G.add(base);
    const fixedJ = new T.Mesh(new T.BoxGeometry(0.32, 1.35, 1.1), metal); fixedJ.position.set(-1.25, 0.78, -0.1); G.add(fixedJ);
    const moveJ = new T.Mesh(new T.BoxGeometry(0.32, 1.35, 1.1), phong("#7b2a32", { shininess: 50 })); moveJ.position.set(1.1, 0.78, -0.1); G.add(moveJ);
    const rod = new T.Mesh(new T.CylinderGeometry(0.07, 0.07, 1.6, 8), lam("#9aa0aa")); rod.rotation.z = Math.PI / 2; rod.position.set(1.8, 0.78, 0); G.add(rod);
    const crank = new T.Group(); crank.position.set(2.55, 0.78, 0); G.add(crank); const bar = new T.Mesh(new T.BoxGeometry(0.06, 0.9, 0.06), lam("#9aa0aa")); crank.add(bar); [-1, 1].forEach((s) => { const kn = new T.Mesh(new T.SphereGeometry(0.09, 8, 6), lam("#222222")); kn.position.y = s * 0.45; crank.add(kn); });
    const hands = {}; const ids = st.part.slice();
    ids.forEach((id, i) => { const h = makeHand(SKIN, { pose: "flat", sleeve: pods[id] ? pods[id].hex : "#444", sleeveLen: 0.45 }); h.g.scale.setScalar(0.72); h.g.rotation.y = i % 2 ? Math.PI : 0; h.g.position.set(-0.15, 0.32 + i * 0.12, (i % 2 ? -1 : 1) * 0.05); h.g.visible = false; G.add(h.g); hands[id] = { h, out: false }; });
    let closed = false; const dm = dirOf(meId);
    return { cam: () => ({ pos: V(dm.x * 3.4, TY + 2.3, dm.z * 3.4), look: V(0, TY + 0.6, 0) }), update(v, st, now) {
      const P = clamp(v.started && !v.over ? v.P + v.rate * (now - v.at) : v.P, 0, 1); const jx = 1.1 - 1.72 * P; moveJ.position.x = jx; crank.rotation.x = P * 22; rod.position.x = jx + 0.7;
      const gap = jx - 0.16 - (-1.25 + 0.16); const sq = clamp(gap / 0.95, 0.3, 1);
      ids.forEach((id) => { const H = hands[id]; if (!H.out && v.started && v.out[id] !== undefined) { H.out = true; if (v.out[id] > 0 && H.h.g.visible) { const p0 = H.h.g.position.clone(); anim(0.35, (k) => { H.h.g.position.set(p0.x, p0.y + 1.2 * k, p0.z); }, () => { H.h.g.visible = false; }); } else H.h.g.visible = false; } else if (!H.out) { H.h.g.visible = v.started ? true : !!v.hold[id]; H.h.g.scale.set(0.72 * sq, 0.72, 0.72); } });
      if (v.closed && !closed) { closed = true; St.shake(1.2); St.flash("#ff3b4e", 1); (v.crushed || []).forEach((id) => { const H = hands[id]; if (H) { H.h.mat.color.set("#c0404c"); H.h.g.scale.x = 0.72 * 0.22; } }); }
    } };
  };

  B.gants = function (v) {
    const G = new T.Group(); G.position.y = TY; G.rotation.y = myTh(); propG.add(G); const gl = [];
    v.gloves.forEach((g, i) => {
      const a = (-70 + (140 * i) / 5) * (Math.PI / 180); const x = Math.sin(a) * 1.7, z = Math.cos(a) * 0.7 - 0.45;
      const mat = g.k === "laine" ? lam(g.hex, { flatShading: true, side: T.DoubleSide, emissive: 0x000000 }) : phong(g.hex, { shininess: g.k === "caoutchouc" ? 110 : 35, specular: g.k === "caoutchouc" ? 0x888888 : 0x332222, side: T.DoubleSide, emissive: 0x000000 });
      const h = makeHand(g.hex, { pose: "up", cuff: true, mat, mirror: g.h === "gauche" }); h.spread(0.35); h.g.scale.set(g.h === "gauche" ? -0.72 : 0.72, 0.72, 0.72); h.g.position.set(x, 0.5, z); h.g.rotation.y = -a * 0.4; G.add(h.g);
      h.g.traverse((m) => { if (m.isMesh) m.userData.pick = { k: "glove", i }; });
      const lb = label(cap1(g.k) + ", " + g.h, { size: 0.18, fs: 40, color: "#f4e9d8", bg: "rgba(10,4,8,0.7)" }); lb.position.set(x, 1.05 + (i % 2) * 0.2, z); G.add(lb);
      gl.push({ h, lb, gone: false, base: h.g.position.clone() });
    });
    let bit = false;
    return { update(v) {
      v.gloves.forEach((g, i) => { const o = gl[i]; if (g.by && !o.gone) { o.gone = true; o.lb.visible = false; const pod = pods[g.by]; if (pod) { const from = o.h.g.position.clone(); const to = G.worldToLocal(pod.g.localToWorld(V(0.45, 1.5, 0))); anim(0.7, (k) => { o.h.g.position.lerpVectors(from, to, ease(k)); o.h.g.position.y += Math.sin(k * Math.PI) * 0.8; }); } } });
      const mine = v.turn === meId; gl.forEach((o, i) => { if (!o.gone) { const hv = mine && isHover({ k: "glove", i }); o.h.g.position.y = o.base.y + (hv ? 0.12 : 0) + Math.sin(t * 2 + o.base.x) * 0.02; o.h.mat.emissive.setRGB(hv ? 0.2 : 0, hv ? 0.15 : 0, 0); } });
      if (v.bite && !bit) { bit = true; const o = gl[v.bite.j]; if (o) { anim(0.01, () => {}, () => { for (let s = 0; s < 10; s++) { const sp = new T.Mesh(new T.ConeGeometry(0.035, 0.22, 5), lam("#e9e4d4")); const a = (s / 10) * Math.PI * 2; sp.position.set(Math.cos(a) * 0.22, 0.05 + (s % 3) * 0.12, Math.sin(a) * 0.1); sp.rotation.z = -Math.cos(a) * 1.4; sp.rotation.x = Math.sin(a) * 1.4; o.h.inner.add(sp); } o.h.mat.emissive.setRGB(0.45, 0, 0); St.shake(0.9); St.flash("#ff3b4e", 0.9); }, 0.75); } }
    } };
  };

  B.boite = function (v) {
    const G = new T.Group(); G.position.y = TY; G.rotation.y = myTh(); propG.add(G); const bx = []; const n = v.nb; const R = n > 6 ? 1.62 : 1.4;
    for (let b = 0; b < n; b++) {
      const a = (b - (n - 1) / 2) * ((2 * Math.PI) / n); const x = Math.sin(a) * R, z = Math.cos(a) * R; const g = new T.Group(); g.position.set(x, 0, z); g.rotation.y = a; G.add(g);
      const box = setPick(new T.Mesh(new T.BoxGeometry(0.62, 0.55, 0.62), lam("#151216", { emissive: 0x000000 })), { k: "box", i: b }); box.position.y = 0.28; g.add(box);
      const lid = new T.Mesh(new T.BoxGeometry(0.68, 0.06, 0.68), lam("#2a2030")); lid.position.y = 0.58; g.add(lid);
      const hole = new T.Mesh(new T.CircleGeometry(0.17, 18), bas("#000000")); hole.position.set(0, 0.28, 0.312); g.add(hole);
      const num = label(String(b + 1), { size: 0.24, fs: 44, color: "#ffd23f" }); num.position.set(0, 0.86, 0); g.add(num);
      const cl = label(" ", { size: 0.2, fs: 36 }); cl.position.set(0, 1.1, 0); cl.visible = false; g.add(cl);
      const ring = new T.Mesh(new T.RingGeometry(0.42, 0.48, 28), bas("#5ef06a", { transparent: true, opacity: 0, side: T.DoubleSide })); ring.rotation.x = -Math.PI / 2; ring.position.y = 0.012; g.add(ring);
      bx.push({ g, box, lid, cl, ring, hole, picked: false });
    }
    let bit = false, shownC = false;
    return { update(v) {
      if (v.mine && bx[v.mine.box]) bx[v.mine.box].ring.material.opacity = 0.55 + 0.25 * Math.sin(t * 3);
      if (v.claims) v.claims.forEach((c) => { const o = bx[c.box]; if (!o || c.k === undefined || c.k === null) return; o.cl.visible = true; relabel(o.cl, v.names[c.k], { size: 0.2, fs: 36, bg: ["rgba(30,120,60,0.9)", "rgba(170,110,20,0.9)", "rgba(170,30,40,0.9)"][c.k], color: "#ffffff" }); });
      Object.keys(v.picks).forEach((b) => { const o = bx[b]; if (!o || o.picked) return; o.picked = true; reach(v.picks[b], o.hole.getWorldPosition(V(0, 0, 0)), { stay: true, dur: 0.7, scale: 0.5 }); });
      const mine = v.turn === meId; const free = v.free || []; bx.forEach((o, b) => { const ok = mine && free.includes(b); const hv = hoverObj === o.box; o.box.material.emissive.setRGB(ok ? (hv ? 0.45 : 0.12) : 0, ok ? (hv ? 0.3 : 0.08) : 0, 0); });
      if (v.bite && !bit) { bit = true; const o = bx[v.bite.box]; if (o) { anim(0.5, (k) => { o.lid.position.y = 0.58 + Math.sin(k * Math.PI * 3) * 0.25 * (1 - k); o.g.rotation.z = Math.sin(k * 40) * 0.08 * (1 - k); }, null, 0.75); for (let s = 0; s < 7; s++) { const tt = new T.Mesh(new T.ConeGeometry(0.03, 0.09, 4), lam("#ffffff")); tt.position.set(-0.12 + s * 0.04, 0.4, 0.315); tt.rotation.x = Math.PI; o.g.add(tt); } } anim(0.01, () => {}, () => { St.shake(1); St.flash("#ff3b4e", 0.9); }, 0.75); }
      if (v.contents && !shownC) { shownC = true; v.contents.forEach((c, b) => { const o = bx[b]; if (!o) return; const lb = label(c, { size: 0.16, fs: 32, color: b === v.trap ? "#ff6b6b" : "#e9e4d4", bg: "rgba(10,4,8,0.75)" }); lb.position.set(0, 1.36, 0); o.g.add(lb); }); }
    } };
  };

  B.bistouri = function () {
    const G = new T.Group(); G.position.y = TY + 0.012; G.rotation.y = myTh(); propG.add(G); let tex = null, plane = null; const dm = dirOf(meId);
    const tray = new T.Mesh(new T.BoxGeometry(3.1, 0.06, 2.1), lam("#d8c9a8")); G.add(tray);
    return { cam: () => ({ pos: V(dm.x * 2.3, TY + 3.0, dm.z * 2.3), look: V(0, TY, 0) }), update() {
      if (!plane && St.patient) { tex = new T.CanvasTexture(St.patient); plane = new T.Mesh(new T.PlaneGeometry(2.95, 1.97), new T.MeshBasicMaterial({ map: tex })); plane.rotation.x = -Math.PI / 2; plane.position.y = 0.035; G.add(plane); }
      if (tex) tex.needsUpdate = true;
    } };
  };

  B.imposteur = function () {
    const G = new T.Group(); G.position.y = TY; propG.add(G); const m = new T.Mesh(new T.TorusKnotGeometry(0.35, 0.1, 64, 8), phong("#e9e4d4", { shininess: 60 })); m.position.y = 0.9; G.add(m);
    return { update() { m.rotation.y = t * 0.6; m.rotation.x = Math.sin(t * 0.4) * 0.3; } };
  };

  function clearProps() {
    if (cur && cur.o && cur.o.end) { try { cur.o.end(); } catch (e) { /* rien */ } }
    while (propG.children.length) drop(propG.children[0]); while (fxG.children.length) drop(fxG.children[0]); giantShow(false); St.dark(0); hoverObj = null; cur = null;
  }
  St.clearTrial = function () { if (scene && cur) clearProps(); };
  St.trial = function (id, v, st, now) {
    if (!scene || !st) return; const key = id + "|" + st.round;
    if (!cur || cur.key !== key) { if (cur) clearProps(); cur = { id, key, o: null }; }
    if (!cur.o && v && B[id]) { try { cur.o = B[id](v, st) || {}; } catch (e) { if (lastErrKey !== key) { lastErrKey = key; console.error("Main Morte décor", e); } cur.o = {}; } }
    if (cur.o && cur.o.update && v) { try { cur.o.update(v, st, now, Math.min(0.05, St.dt || 0.016)); } catch (e) { if (lastErrKey !== key + "u") { lastErrKey = key + "u"; console.error("Main Morte décor", e); } } }
  };

  // ---------- clics sur la table ----------
  const ray = new T.Raycaster(); const ndc = new T.Vector2();
  function hit(ev) {
    if (!propG.children.length) return null; const r = canvas.getBoundingClientRect(); ndc.set(((ev.clientX - r.left) / r.width) * 2 - 1, -((ev.clientY - r.top) / r.height) * 2 + 1); ray.setFromCamera(ndc, camera);
    const hs = ray.intersectObjects(propG.children, true); for (const h of hs) { let o = h.object; while (o && !(o.userData && o.userData.pick)) o = o.parent; if (o && o.visible !== false) { if (!St.pickable || St.pickable(o.userData.pick)) return o; } } return null;
  }
  function onDown(ev) { const o = hit(ev); if (o && St.onPick) { St.onPick(o.userData.pick); ev.preventDefault(); } }
  let moveAt = 0; function onMove(ev) { const n = performance.now(); if (n - moveAt < 50) return; moveAt = n; hoverObj = hit(ev); canvas.style.cursor = hoverObj ? "pointer" : ""; }

  // ---------- boucle ----------
  let last = 0;
  function loop(now) {
    requestAnimationFrame(loop); if (!renderer) return; const scr = document.getElementById("screen-game"); if (!scr || !scr.classList.contains("screen--active") || host.style.display === "none") return;
    const dt = Math.min(0.05, last ? (now - last) / 1000 : 0.016); last = now; t += dt; St.dt = dt;
    PicuiteGL.frame(() => {
      runAnims(dt);
      headG.rotation.y = Math.sin(t * 0.8) * 0.25; headG.rotation.z = Math.sin(t * 0.5) * 0.08; headG.position.y = 3.35 + Math.sin(t * 1.4) * 0.05; talk = Math.max(0, talk - dt); mouth.scale.y = 1 + (talk > 0 ? Math.abs(Math.sin(t * 15)) * 0.9 : 0);
      lean = Math.max(0, lean - dt * 1.5); hostG.rotation.x = lean * 0.18;
      eyeL.scale.setScalar(1 + Math.sin(t * 3) * 0.05); eyeR.scale.setScalar(1 + Math.sin(t * 3) * 0.05);
      dark += (darkT - dark) * Math.min(1, dt * 4); hemi.intensity = 0.78 * (1 - 0.82 * dark); keyL.intensity = 0.72 * (1 - 0.9 * dark); poolMat.opacity = 0.11 * (1 - dark);
      cones.forEach((c, i) => { c.rotation.z = Math.sin(t * 0.6 + i * 2) * 0.35; c.rotation.x = Math.cos(t * 0.5 + i) * 0.2; c.material.opacity = 0.1 * (1 - dark); });
      ringMat.color.lerp(moodTarget, 0.05);
      if (giant.g.visible && !giant.busy) { giant.g.position.lerp(giant.want, Math.min(1, dt * giant.k)); giant.g.position.y += Math.sin(t * 2) * 0.004; }
      Object.keys(pods).forEach((id) => {
        const o = pods[id]; const seat = camMode === "seat" && id === meId;
        if (!holdSync && o.covered !== o.want) { o.covered = o.want; syncCovers(o, false); }
        o.hands.forEach((h, k) => { if (h.g.visible) h.g.position.y = 1.12 + Math.sin(t * 2 + k + id.length) * 0.012 + (k === 0 ? o.pulse * 0.12 : 0); });
        o.ghostK += ((o.alive ? 0 : 1) - o.ghostK) * Math.min(1, dt * 2); o.av.visible = o.ghostK < 0.5 && !seat; o.gh.visible = o.ghostK > 0.02 && !seat;
        o.gh.children.forEach((m, i) => { m.material.opacity = (i === 0 ? 0.5 : 0.9) * o.ghostK; }); o.gh.position.y = 1.65 + Math.sin(t * 1.5 + o.th * 3) * 0.12; o.gh.position.z = 0.9 - o.pulse * 0.6;
        o.head.rotation.x = -o.pulse * 0.35 + Math.sin(t * 0.7 + o.th) * 0.04; o.pulse = Math.max(0, o.pulse - dt * 3);
        o.redK += (o.redT - o.redK) * Math.min(1, dt * (o.redT ? 8 : 1.5)); o.red.material.opacity = 0.42 * o.redK; o.nm.visible = !seat && !camFocus && camera.position.distanceTo(o.nmPos) > 4;
      });
      // caméra
      const wantPos = V(Math.sin(t * 0.25) * 0.6, 6.2, 10.8), wantLook = V(0, 1.0, -0.6);
      const oc = camMode === "seat" && cur && cur.o && cur.o.cam ? cur.o.cam() : null;
      if (oc) { wantPos.copy(oc.pos); wantLook.copy(oc.look); }
      else if (camMode === "seat" && pods[meId]) { const g = pods[meId].g; wantPos.copy(g.localToWorld(V(0, 2.75, 1.1))); wantLook.set(0, TY + 0.15, 0).addScaledVector(dirOf(meId), -0.25); }
      else if (camFocus && pods[camFocus]) { const pw = pods[camFocus].g.position; const d = dirOf(camFocus); wantPos.set(-d.x * 1.2, 4.4, -d.z * 1.2); wantLook.set(pw.x, 1.25, pw.z); }
      const kc = Math.min(1, dt * 2.6); camPos.lerp(wantPos, kc); camLook.lerp(wantLook, kc);
      const sx = shake > 0.01 ? (Math.random() - 0.5) * shake * 0.5 : 0, sy = shake > 0.01 ? (Math.random() - 0.5) * shake * 0.5 : 0; shake *= Math.pow(0.02, dt);
      camera.position.set(camPos.x + sx, camPos.y + sy, camPos.z); camera.lookAt(camLook);
      const bgc = 0x0a0206; if (flash > 0.02) { renderer.setClearColor(new T.Color(bgc).lerp(flashCol, Math.min(1, flash) * 0.6), 1); flash *= Math.pow(0.004, dt); } else renderer.setClearColor(bgc, 1);
      renderer.render(scene, camera); PicuiteGL.verify(renderer);
    });
  }
  St.setVisible = function (v) { if (host) host.style.display = v ? "block" : "none"; if (v) St.resize(); };
  window.HOStage = St;
})();

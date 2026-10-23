// ============================================================
// GOLFOUILLE — Rendu 3D (three.js)
// Construit un trou, anime les balles et l'environnement, gère la caméra.
// ============================================================
(function () {
  const T = THREE;
  const P = GolfPhysics, Course = GolfCourse;
  const S = P.S;
  const col = (h) => new T.Color(h);
  const lerp = (a, b, t) => a + (b - a) * t;
  const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);

  const View = { ready: false, hole: null, balls: {}, quality: "medium" };
  let renderer, scene, camera, sun, hemi, canvas, host;
  let terrain, liquids = [], movers = [], orbMeshes = {}, wallMeshes = {}, flag, particles = [], stars, windSock;
  let followId = null, camMode = "aim", camYaw = 0, camDist = 9, camPitch = 0.42, camPos = new T.Vector3(), camLook = new T.Vector3(), flyT = -1, flyPath = null;
  const UP = new T.Vector3(0, 1, 0);
  let biome = null, clockOffset = 0, playStart = 0, holeGroup = null, shake = 0, aimGroup = null, aimDots = [], predLine = null, tmpV = new T.Vector3();
  const listeners = {};
  View.on = (ev, fn) => { listeners[ev] = fn; };
  const emit = (ev, a) => { if (listeners[ev]) listeners[ev](a); };

  // ---------- initialisation ----------
  View.init = function (container, quality) {
    host = container; View.quality = quality || "medium";
    canvas = document.createElement("canvas"); canvas.className = "gl-canvas"; host.appendChild(canvas);
    renderer = PicuiteGL.create(T, canvas, View.quality); PicuiteGL.watch(canvas);
    renderer.setClearColor(0x000000, 0);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, View.quality === "high" ? 2 : 1.5));
    renderer.shadowMap.enabled = View.quality !== "low"; renderer.shadowMap.type = T.PCFSoftShadowMap;
    scene = new T.Scene();
    camera = new T.PerspectiveCamera(58, 1, 0.3, 600);
    hemi = new T.HemisphereLight(0xbfe3ff, 0x5a7a50, 0.85); scene.add(hemi);
    sun = new T.DirectionalLight(0xfff4d6, 0.95); sun.position.set(40, 70, -20);
    sun.castShadow = View.quality !== "low"; const sh = View.quality === "high" ? 2048 : 1024; sun.shadow.mapSize.set(sh, sh);
    const sc = sun.shadow.camera; sc.left = -45; sc.right = 45; sc.top = 45; sc.bottom = -45; sc.near = 1; sc.far = 220; sun.shadow.bias = -0.0008;
    scene.add(sun); scene.add(sun.target);
    window.addEventListener("resize", View.resize);
    View.resize(); View.ready = true;
    requestAnimationFrame(loop);
  };
  View.setQuality = function (q) {
    View.quality = q; if (!renderer) return;
    renderer.shadowMap.enabled = q !== "low"; sun.castShadow = q !== "low";
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, q === "high" ? 2 : 1.5));
    if (terrain) terrain.material.needsUpdate = true;
    scene.traverse((o) => { if (o.material) o.material.needsUpdate = true; });
  };
  View.resize = function () {
    if (!renderer || !host) return;
    const w = host.clientWidth || window.innerWidth, h = host.clientHeight || window.innerHeight;
    renderer.setSize(w, h, false); camera.aspect = w / h; camera.updateProjectionMatrix();
  };
  View.setClock = function (offset) { clockOffset = offset; };
  View.setPlayStart = function (ms) { playStart = ms; };
  const tRel = () => (Date.now() + clockOffset - playStart) / 1000;

  // ---------- fabrication d'objets ----------
  const mats = {};
  function mat(color, opts) {
    const key = color + JSON.stringify(opts || {});
    if (!mats[key]) mats[key] = new T.MeshStandardMaterial(Object.assign({ color: col(color), roughness: 0.85, metalness: 0, flatShading: true }, opts || {}));
    return mats[key];
  }
  function mesh(geo, material, x, y, z, shadow) { const m = new T.Mesh(geo, material); m.position.set(x || 0, y || 0, z || 0); if (shadow !== false) m.castShadow = true; m.receiveShadow = false; return m; }
  const G = {
    cyl: (r1, r2, h, n) => new T.CylinderGeometry(r1, r2, h, n || 8), cone: (r, h, n) => new T.ConeGeometry(r, h, n || 8), sph: (r, a, b) => new T.SphereGeometry(r, a || 10, b || 8),
    box: (x, y, z) => new T.BoxGeometry(x, y, z), dodeca: (r) => new T.DodecahedronGeometry(r, 0), ico: (r, d) => new T.IcosahedronGeometry(r, d || 0), octa: (r) => new T.OctahedronGeometry(r, 0), torus: (r, t) => new T.TorusGeometry(r, t, 8, 20),
  };
  function textTexture(text, color, bg) {
    const c = document.createElement("canvas"); c.width = 256; c.height = 64; const g = c.getContext("2d");
    g.fillStyle = bg || "rgba(0,0,0,0.55)"; const r = 24; g.beginPath(); g.moveTo(r, 4); g.arcTo(252, 4, 252, 60, r); g.arcTo(252, 60, 4, 60, r); g.arcTo(4, 60, 4, 4, r); g.arcTo(4, 4, 252, 4, r); g.fill();
    g.fillStyle = color || "#fff"; g.font = "700 32px Fredoka, Trebuchet MS, sans-serif"; g.textAlign = "center"; g.textBaseline = "middle"; g.fillText(text, 128, 34);
    const t = new T.CanvasTexture(c); return t;
  }
  function padTexture() {
    const c = document.createElement("canvas"); c.width = 128; c.height = 128; const g = c.getContext("2d");
    g.fillStyle = "#ffcc33"; g.fillRect(0, 0, 128, 128); g.strokeStyle = "#ff7a00"; g.lineWidth = 12; g.lineCap = "round";
    for (let i = 0; i < 3; i++) { const y = 100 - i * 38; g.beginPath(); g.moveTo(24, y); g.lineTo(64, y - 28); g.lineTo(104, y); g.stroke(); }
    const t = new T.CanvasTexture(c); return t;
  }
  function brickTexture() {
    const c = document.createElement("canvas"); c.width = 128; c.height = 64; const g = c.getContext("2d");
    g.fillStyle = "#c46a4a"; g.fillRect(0, 0, 128, 64); g.strokeStyle = "#e8c8a0"; g.lineWidth = 3;
    for (let y = 0; y < 64; y += 16) { g.beginPath(); g.moveTo(0, y); g.lineTo(128, y); g.stroke(); for (let x = (y / 16) % 2 ? 0 : 16; x < 128; x += 32) { g.beginPath(); g.moveTo(x, y); g.lineTo(x, y + 16); g.stroke(); } }
    const t = new T.CanvasTexture(c); t.wrapS = t.wrapT = T.RepeatWrapping; t.repeat.set(3, 1); return t;
  }

  const MODELS = {
    tree(sc, b) { const g = new T.Group(); g.add(mesh(G.cyl(0.28, 0.4, 3, 6), mat("#7a4f2a"), 0, 1.5, 0)); g.add(mesh(G.cone(2.2, 3.4, 7), mat(b.id === "jungle" ? "#1f8a45" : "#2f9a45"), 0, 4.2, 0)); g.add(mesh(G.cone(1.7, 2.8, 7), mat("#3fb25a"), 0, 5.7, 0)); return g; },
    pine(sc, b) { const g = new T.Group(); const snow = b.id === "neige"; g.add(mesh(G.cyl(0.22, 0.32, 2, 6), mat("#6a4a2a"), 0, 1, 0)); [[1.9, 2.4, 2.8], [1.5, 2.2, 4.3], [1.0, 2, 5.7]].forEach(([r, h, y], i) => { g.add(mesh(G.cone(r, h, 7), mat(snow ? "#2b6a4a" : "#2a7a3f"), 0, y, 0)); if (snow) g.add(mesh(G.cone(r * 0.72, h * 0.5, 7), mat("#ffffff"), 0, y + h * 0.3, 0)); }); return g; },
    palm(sc) { const g = new T.Group(); const trunk = mesh(G.cyl(0.18, 0.3, 5.4, 6), mat("#9a6a3a"), 0.4, 2.7, 0); trunk.rotation.z = -0.15; g.add(trunk); for (let i = 0; i < 6; i++) { const leaf = mesh(G.cone(0.5, 3.4, 4), mat("#2fa85a"), 0.9, 5.3, 0); leaf.scale.set(1, 1, 0.25); leaf.rotation.z = -1.25; const piv = new T.Group(); piv.position.set(0.9, 5.4, 0); piv.rotation.y = (i / 6) * 6.28; leaf.position.set(1.4, -0.2, 0); piv.add(leaf); g.add(piv); } return g; },
    jtree(sc) { const g = new T.Group(); g.add(mesh(G.cyl(0.35, 0.55, 4, 6), mat("#6a4222"), 0, 2, 0)); [[0, 5.5, 0, 2.3], [1.3, 5, 0.5, 1.7], [-1.1, 5.2, -0.6, 1.8]].forEach(([x, y, z, r]) => g.add(mesh(G.sph(r, 8, 6), mat("#16803f"), x, y, z))); return g; },
    cactus() { const g = new T.Group(); g.add(mesh(G.cyl(0.4, 0.45, 2.6, 8), mat("#3a9a50"), 0, 1.3, 0)); g.add(mesh(G.sph(0.4, 8, 6), mat("#3a9a50"), 0, 2.6, 0)); const a1 = mesh(G.cyl(0.2, 0.2, 1, 6), mat("#3a9a50"), 0.65, 1.6, 0); a1.rotation.z = Math.PI / 2; g.add(a1); g.add(mesh(G.cyl(0.2, 0.2, 0.9, 6), mat("#3a9a50"), 1.1, 2.0, 0)); const a2 = mesh(G.cyl(0.2, 0.2, 0.8, 6), mat("#3a9a50"), -0.55, 1.2, 0); a2.rotation.z = Math.PI / 2; g.add(a2); g.add(mesh(G.cyl(0.2, 0.2, 0.7, 6), mat("#3a9a50"), -0.9, 1.5, 0)); return g; },
    rock(sc, b) { const g = new T.Group(); const m = mesh(G.dodeca(1), mat(b.id === "volcan" ? "#4a3a40" : b.id === "cosmos" ? "#6a5aa0" : "#8a8f96"), 0, 0.7, 0); m.scale.set(1.15, 0.8, 1); g.add(m); return g; },
    snowman() { const g = new T.Group(); g.add(mesh(G.sph(0.75, 10, 8), mat("#ffffff"), 0, 0.7, 0)); g.add(mesh(G.sph(0.55, 10, 8), mat("#ffffff"), 0, 1.6, 0)); g.add(mesh(G.sph(0.38, 10, 8), mat("#ffffff"), 0, 2.28, 0)); const nose = mesh(G.cone(0.07, 0.4, 6), mat("#ff8a2a"), 0, 2.28, 0.4); nose.rotation.x = Math.PI / 2; g.add(nose); g.add(mesh(G.cyl(0.28, 0.28, 0.35, 8), mat("#222"), 0, 2.7, 0)); return g; },
    mushroom() { const g = new T.Group(); g.add(mesh(G.cyl(0.3, 0.38, 0.9, 8), mat("#fff3e0"), 0, 0.45, 0)); const cap = mesh(new T.SphereGeometry(1, 12, 8, 0, Math.PI * 2, 0, Math.PI / 2), mat("#e83a3a"), 0, 0.85, 0); cap.scale.set(1, 0.7, 1); g.add(cap); for (let i = 0; i < 5; i++) { const a = i * 1.26; g.add(mesh(G.sph(0.14, 6, 5), mat("#ffffff"), Math.cos(a) * 0.55, 1.25 - (i % 2) * 0.15, Math.sin(a) * 0.55)); } return g; },
    lolli() { const g = new T.Group(); g.add(mesh(G.cyl(0.06, 0.06, 2.4, 6), mat("#ffffff"), 0, 1.2, 0)); const d = mesh(G.cyl(0.85, 0.85, 0.2, 14), mat("#ff4aa8"), 0, 2.7, 0); d.rotation.x = Math.PI / 2; g.add(d); const d2 = mesh(G.cyl(0.55, 0.55, 0.24, 14), mat("#ffe14a"), 0, 2.7, 0); d2.rotation.x = Math.PI / 2; g.add(d2); const d3 = mesh(G.cyl(0.25, 0.25, 0.28, 12), mat("#4ad0ff"), 0, 2.7, 0); d3.rotation.x = Math.PI / 2; g.add(d3); return g; },
    cane() { const g = new T.Group(); for (let i = 0; i < 6; i++) g.add(mesh(G.cyl(0.22, 0.22, 0.45, 8), mat(i % 2 ? "#ffffff" : "#ee3355"), 0, 0.22 + i * 0.45, 0)); const top = mesh(new T.TorusGeometry(0.4, 0.2, 6, 10, Math.PI), mat("#ee3355"), 0.4, 2.7, 0); g.add(top); return g; },
    asteroid() { const g = new T.Group(); const m = mesh(G.ico(1, 1), mat("#6f6a8a"), 0, 1.2, 0); m.scale.set(1.2, 1, 0.9); g.add(m); return g; },
    crystal(sc, b) { const g = new T.Group(); [[0, 0, 1.3], [0.45, 0.2, 0.9], [-0.4, -0.2, 0.8]].forEach(([x, z, h]) => { const c = mesh(G.octa(0.45), mat(b.id === "volcan" ? "#ff7a3a" : "#5affd8", { emissive: col(b.id === "volcan" ? "#c03a10" : "#10a890"), emissiveIntensity: 0.6, flatShading: true }), x, h, z); c.scale.set(0.7, 1.9, 0.7); g.add(c); }); return g; },
    parasol() { const g = new T.Group(); g.add(mesh(G.cyl(0.05, 0.05, 2.4, 6), mat("#eeeeee"), 0, 1.2, 0)); g.add(mesh(G.cone(1.4, 0.6, 10), mat("#ff5a4a"), 0, 2.6, 0)); return g; },
    gummy() { const g = new T.Group(); const m = mesh(G.sph(1, 12, 8), mat("#ff6aa8", { transparent: true, opacity: 0.85, roughness: 0.3 }), 0, 0.6, 0); m.scale.set(1, 0.7, 1); g.add(m); return g; },
  };

  // ---------- construction d'un trou ----------
  function clearHole() {
    if (holeGroup) { scene.remove(holeGroup); holeGroup.traverse((o) => { if (o.geometry && !o.userData.shared) o.geometry.dispose(); }); }
    holeGroup = new T.Group(); scene.add(holeGroup);
    terrain = null; liquids = []; movers = []; orbMeshes = {}; wallMeshes = {}; flag = null; stars = null; windSock = null;
    Object.values(View.balls).forEach((b) => scene.remove(b.group)); View.balls = {};
  }

  View.loadHole = function (hole) {
    View.hole = hole; P.prepare(hole); biome = Course.BIOMES[hole.biome];
    clearHole();
    document.getElementById("gl-host").style.background = "linear-gradient(180deg," + biome.sky[0] + "," + biome.sky[1] + " 78%)";
    scene.fog = new T.Fog(col(biome.fog), 60, biome.id === "cosmos" ? 240 : 230);
    hemi.color.set(biome.amb); hemi.groundColor.set(biome.col.rough); sun.color.set(biome.sun);
    buildTerrain(hole); buildDecor(hole); buildSpecials(hole);
    if (biome.stars) {
      const n = 500, pos = new Float32Array(n * 3); for (let i = 0; i < n; i++) { const a = Math.random() * 6.28, b = Math.random() * 1.2 + 0.1, r = 300; pos[i * 3] = Math.cos(a) * Math.cos(b) * r; pos[i * 3 + 1] = Math.sin(b) * r; pos[i * 3 + 2] = Math.sin(a) * Math.cos(b) * r; }
      const g = new T.BufferGeometry(); g.setAttribute("position", new T.BufferAttribute(pos, 3)); stars = new T.Points(g, new T.PointsMaterial({ color: 0xffffff, size: 1.6, fog: false, sizeAttenuation: false })); holeGroup.add(stars);
    }
    // plateau de départ et drapeau
    const tee = hole.tee; const base = mesh(G.cyl(1.6, 1.7, 0.12, 20), mat("#f4f4f4"), tee.x, tee.y - 0.02, tee.z, false); holeGroup.add(base);
    [-1.5, 1.5].forEach((o) => { const px = Math.cos(hole.teeAngle) * o, pz = -Math.sin(hole.teeAngle) * o; const m = mesh(G.sph(0.18, 8, 6), mat("#ff4a4a"), tee.x + px, tee.y + 0.25, tee.z + pz); holeGroup.add(m); });
    const cy = P.heightAt(hole, hole.cup.x, hole.cup.z);
    const cup = mesh(G.cyl(hole.cupR, hole.cupR, 0.05, 18), new T.MeshBasicMaterial({ color: 0x111111 }), hole.cup.x, cy + 0.03, hole.cup.z, false); holeGroup.add(cup);
    const rim = mesh(new T.TorusGeometry(hole.cupR, 0.05, 6, 20), mat("#ffffff"), hole.cup.x, cy + 0.04, hole.cup.z, false); rim.rotation.x = Math.PI / 2; holeGroup.add(rim);
    flag = new T.Group(); flag.position.set(hole.cup.x, cy, hole.cup.z);
    flag.add(mesh(G.cyl(0.04, 0.04, 3.4, 5), mat("#ffffff"), 0, 1.7, 0));
    const cloth = mesh(new T.PlaneGeometry(1.3, 0.8, 6, 1), new T.MeshStandardMaterial({ color: col("#ff3a5a"), side: T.DoubleSide, flatShading: true }), 0.68, 3.0, 0); cloth.userData.cloth = true; flag.add(cloth); holeGroup.add(flag);
    // lumière
    sun.target.position.set(hole.cup.x, cy, hole.cup.z);
    View.resetCamera();
    emit("loaded", hole);
  };

  function buildTerrain(hole) {
    const w = hole.nx, h = hole.nz, W = w + 1; const prep = P.prepare(hole); const C = biome.col;
    const surfCol = [col(C.fairway), col(C.green), col(C.rough), col(C.sand), col(C.water), col(C.ice), col(C.mud), col(C.lava), col(C.bouncy), col(C.wall).multiplyScalar(0.8)];
    const wallCol = col(C.wall);
    const cellColor = (i, j) => {
      i = clamp(i, 0, w - 1); j = clamp(j, 0, h - 1); const s = hole.surf[j * w + i]; const c = surfCol[s].clone();
      if (s === S.FAIRWAY || s === S.GREEN) c.multiplyScalar(1 + 0.05 * (((Math.floor((i + j) / 3)) & 1) ? 1 : -1));
      if (s === S.ROUGH) { const a = Math.abs(prep.N[((j * W) + i) * 2]) + Math.abs(prep.N[((j * W) + i) * 2 + 1]); c.lerp(wallCol, clamp((a - 0.5) / 1.4, 0, 0.85)); }
      const n = ((i * 73856093) ^ (j * 19349663)) & 255; c.multiplyScalar(0.96 + (n / 255) * 0.08);
      return c;
    };
    const verts = [], cols = [], norms = [];
    const vc = new Array(W * (h + 1));
    for (let j = 0; j <= h; j++) for (let i = 0; i <= w; i++) {
      const cs = [cellColor(i - 1, j - 1), cellColor(i, j - 1), cellColor(i - 1, j), cellColor(i, j)];
      vc[j * W + i] = new T.Color((cs[0].r + cs[1].r + cs[2].r + cs[3].r) / 4, (cs[0].g + cs[1].g + cs[2].g + cs[3].g) / 4, (cs[0].b + cs[1].b + cs[2].b + cs[3].b) / 4);
    }
    const nrm = (i, j) => { const k = (j * W + i) * 2; const x = -prep.N[k], z = -prep.N[k + 1]; const l = Math.sqrt(x * x + 1 + z * z); return [x / l, 1 / l, z / l]; };
    const push = (i, j) => { const k = j * W + i; verts.push(hole.ox + i, hole.heights[k], hole.oz + j); const c = vc[k]; cols.push(c.r, c.g, c.b); const n = nrm(i, j); norms.push(n[0], n[1], n[2]); };
    for (let j = 0; j < h; j++) for (let i = 0; i < w; i++) {
      // la case est colorée selon ses 4 coins, les liquides gardent une couleur franche
      push(i, j); push(i, j + 1); push(i + 1, j); push(i + 1, j); push(i, j + 1); push(i + 1, j + 1);
    }
    const geo = new T.BufferGeometry();
    geo.setAttribute("position", new T.Float32BufferAttribute(verts, 3)); geo.setAttribute("color", new T.Float32BufferAttribute(cols, 3)); geo.setAttribute("normal", new T.Float32BufferAttribute(norms, 3));
    terrain = new T.Mesh(geo, new T.MeshStandardMaterial({ vertexColors: true, roughness: 0.95, metalness: 0, flatShading: false }));
    terrain.receiveShadow = true; holeGroup.add(terrain);
    // liquides
    ["water", "lava"].forEach((kind) => {
      const sid = kind === "water" ? S.WATER : S.LAVA; const pos = [];
      for (let j = 0; j < h; j++) for (let i = 0; i < w; i++) if (hole.surf[j * w + i] === sid) {
        const y = (hole.heights[j * W + i] + hole.heights[j * W + i + 1] + hole.heights[(j + 1) * W + i] + hole.heights[(j + 1) * W + i + 1]) / 4 + 0.05;
        const x0 = hole.ox + i, z0 = hole.oz + j; pos.push(x0, y, z0, x0, y, z0 + 1, x0 + 1, y, z0, x0 + 1, y, z0, x0, y, z0 + 1, x0 + 1, y, z0 + 1);
      }
      if (!pos.length) return;
      const g = new T.BufferGeometry(); g.setAttribute("position", new T.Float32BufferAttribute(pos, 3)); g.computeVertexNormals();
      const m = kind === "water" ? new T.MeshStandardMaterial({ color: col(C.water), transparent: true, opacity: 0.82, roughness: 0.15, metalness: 0.1, emissive: col(C.water), emissiveIntensity: 0.12 }) : new T.MeshStandardMaterial({ color: col(C.lava), emissive: col(C.lava), emissiveIntensity: 0.9, roughness: 0.6 });
      const me = new T.Mesh(g, m); me.userData.liquid = kind; holeGroup.add(me); liquids.push(me);
    });
  }

  function groundY(x, z) { return P.heightAt(View.hole, x, z); }

  function buildDecor(hole) {
    const C = biome.col; const rng = Course.mulberry32(Course.hashSeed(hole.spec.seed + "d"));
    hole.obstacles.forEach((o) => {
      const fn = MODELS[o.k] || MODELS.rock; const g = fn(o.sc, biome); g.position.set(o.x, groundY(o.x, o.z), o.z); g.rotation.y = o.rot;
      const s = o.k === "rock" || o.k === "asteroid" ? o.r / 1.1 : o.sc; g.scale.setScalar(s); holeGroup.add(g);
      if (o.k === "mushroom" || o.k === "gummy") { g.userData.bounce = true; movers.push({ kind: "squish", obj: g, base: s, ph: rng() * 6 }); }
    });
    // décors sans collision, en instances
    const kinds = [
      { geo: G.cone(0.18, 0.55, 5), color: C.fairway, y: 0.27 },
      { geo: G.sph(0.14, 6, 5), color: biome.id === "neige" ? "#9ad0ff" : biome.id === "desert" ? "#e8a050" : "#ffd84a", y: 0.35 },
      { geo: G.dodeca(0.22), color: C.wall, y: 0.12 },
    ];
    kinds.forEach((k, vi) => {
      const list = hole.decor.filter((d) => d.v === vi); if (!list.length) return;
      const im = new T.InstancedMesh(k.geo, new T.MeshStandardMaterial({ color: col(k.color), roughness: 0.9, flatShading: true }), list.length);
      const m4 = new T.Matrix4(), q = new T.Quaternion(), sc = new T.Vector3(), ps = new T.Vector3();
      list.forEach((d, n) => { ps.set(d.x, groundY(d.x, d.z) + k.y * d.sc, d.z); q.setFromEuler(new T.Euler(0, d.rot, 0)); sc.setScalar(d.sc); m4.compose(ps, q, sc); im.setMatrixAt(n, m4); });
      im.userData.shared = false; holeGroup.add(im);
    });
  }

  function buildSpecials(hole) {
    hole.bumpers.forEach((b) => {
      const g = new T.Group(); g.add(mesh(G.cyl(b.r, b.r * 1.1, 0.9, 14), mat("#3a6aee", { emissive: col("#1a3a9a"), emissiveIntensity: 0.4 }), 0, 0.45, 0)); g.add(mesh(G.cyl(b.r * 0.7, b.r * 0.7, 0.2, 14), mat("#ffdd33", { emissive: col("#aa8800"), emissiveIntensity: 0.5 }), 0, 0.95, 0));
      g.position.set(b.x, groundY(b.x, b.z), b.z); holeGroup.add(g); movers.push({ kind: "squish", obj: g, base: 1, ph: Math.random() * 6, amp: 0.04 });
    });
    hole.bars.forEach((b) => {
      const g = new T.Group(); g.position.set(b.x, groundY(b.x, b.z), b.z);
      g.add(mesh(G.cyl(0.55, 0.8, 3.2, 8), mat("#e8e0d0"), 0, 1.6, 0)); g.add(mesh(G.cone(0.95, 1.1, 8), mat("#c0392b"), 0, 3.7, 0));
      const blade = new T.Group(); blade.position.y = 1.0; blade.add(mesh(G.box(b.len, 0.45, b.thick), mat("#ffcc33", { emissive: col("#aa7a00"), emissiveIntensity: 0.25 }), 0, 0, 0)); [-1, 1].forEach((sg) => blade.add(mesh(G.box(0.5, 0.5, b.thick + 0.1), mat("#ee4433"), sg * (b.len / 2 - 0.25), 0, 0)));
      g.add(blade); holeGroup.add(g); movers.push({ kind: "bar", obj: blade, def: b });
    });
    hole.sliders.forEach((b) => {
      const m = mesh(G.box(b.len, 1.4, b.thick), mat("#7a5cff", { emissive: col("#3a1cae"), emissiveIntensity: 0.4 }), 0, 0.7, 0); const g = new T.Group(); g.add(m);
      for (let i = -1; i <= 1; i += 2) g.add(mesh(G.box(0.4, 1.7, b.thick + 0.15), mat("#ffdd33"), i * b.len / 2, 0.85, 0));
      holeGroup.add(g); movers.push({ kind: "slider", obj: g, def: b });
    });
    const padTex = padTexture();
    hole.pads.forEach((p) => {
      const m = new T.Mesh(new T.PlaneGeometry(p.w, p.l), new T.MeshBasicMaterial({ map: padTex })); m.rotation.x = -Math.PI / 2; m.rotation.z = -p.ang; m.position.set(p.x, groundY(p.x, p.z) + 0.07, p.z); m.rotation.order = "YXZ"; m.rotation.set(-Math.PI / 2, 0, 0); m.rotateOnWorldAxis(new T.Vector3(0, 1, 0), p.ang); holeGroup.add(m);
    });
    hole.tramps.forEach((t) => {
      const g = new T.Group(); g.add(mesh(G.cyl(t.r, t.r, 0.18, 18), mat("#b04aff", { emissive: col("#5a1a9a"), emissiveIntensity: 0.5 }), 0, 0.1, 0)); const ring = mesh(new T.TorusGeometry(t.r, 0.12, 6, 20), mat("#ffdd33"), 0, 0.2, 0); ring.rotation.x = Math.PI / 2; g.add(ring);
      g.position.set(t.x, groundY(t.x, t.z), t.z); holeGroup.add(g); movers.push({ kind: "squish", obj: g, base: 1, ph: Math.random() * 6, amp: 0.05 });
    });
    hole.portals.forEach((p) => {
      [p.a, p.b].forEach((e, i) => {
        const g = new T.Group(); const c = i ? "#ff9a2a" : "#2ad0ff";
        const ring = mesh(new T.TorusGeometry(p.r, 0.14, 8, 24), mat(c, { emissive: col(c), emissiveIntensity: 0.9 }), 0, p.r + 0.2, 0); g.add(ring);
        const disc = new T.Mesh(new T.CircleGeometry(p.r, 24), new T.MeshBasicMaterial({ color: col(c), transparent: true, opacity: 0.35, side: T.DoubleSide })); disc.position.y = p.r + 0.2; g.add(disc);
        g.position.set(e.x, groundY(e.x, e.z), e.z); g.rotation.y = e.ang + Math.PI / 2; holeGroup.add(g); movers.push({ kind: "portal", obj: ring, disc });
      });
    });
    hole.orbs.forEach((o) => {
      const g = new T.Group(); g.position.set(o.x, groundY(o.x, o.z) + 0.95, o.z);
      const core = mesh(G.ico(0.42, 1), new T.MeshStandardMaterial({ color: col("#ffffff"), emissive: col("#ffd84a"), emissiveIntensity: 0.9, flatShading: true }), 0, 0, 0, false); g.add(core);
      const halo = new T.Mesh(G.sph(0.75, 12, 8), new T.MeshBasicMaterial({ color: col("#fff2a0"), transparent: true, opacity: 0.22, depthWrite: false })); g.add(halo);
      const ring = mesh(new T.TorusGeometry(0.7, 0.04, 6, 20), new T.MeshBasicMaterial({ color: col("#ffffff") }), 0, 0, 0, false); g.add(ring);
      g.userData = { base: g.position.y, ph: Math.random() * 6, core, ring }; holeGroup.add(g); orbMeshes[o.id] = g;
    });
  }

  // ---------- balles ----------
  View.setPlayers = function (players, state) {
    players.forEach((pl) => {
      let b = View.balls[pl.id];
      if (!b) {
        const group = new T.Group();
        const color = col(pl.hex);
        const ball = new T.Mesh(G.sph(P.BALL_R, 14, 10), new T.MeshStandardMaterial({ color, roughness: 0.35, metalness: 0.05, emissive: color, emissiveIntensity: 0.18 })); ball.castShadow = true; group.add(ball);
        const band = new T.Mesh(new T.TorusGeometry(P.BALL_R * 0.98, 0.03, 5, 18), new T.MeshBasicMaterial({ color: 0xffffff })); band.rotation.x = Math.PI / 2; group.add(band);
        const blob = new T.Mesh(new T.CircleGeometry(0.28, 14), new T.MeshBasicMaterial({ color: 0x000000, transparent: true, opacity: 0.3, depthWrite: false })); blob.rotation.x = -Math.PI / 2; scene.add(blob);
        const label = new T.Sprite(new T.SpriteMaterial({ map: textTexture(pl.name, "#fff"), depthTest: false, transparent: true })); label.scale.set(2.4, 0.6, 1); label.position.y = 1.0; label.renderOrder = 10; group.add(label);
        const ring = new T.Mesh(new T.RingGeometry(0.34, 0.42, 20), new T.MeshBasicMaterial({ color, side: T.DoubleSide, transparent: true, opacity: 0.9, depthWrite: false })); ring.rotation.x = -Math.PI / 2; scene.add(ring);
        scene.add(group);
        b = View.balls[pl.id] = { id: pl.id, group, ball, blob, ring, label, name: pl.name, hex: pl.hex, anim: null, x: 0, y: 0, z: 0, hidden: false, trailT: 0 };
      }
      b.hidden = !!pl.finished && !pl.moving;
      if (!b.anim) { b.x = pl.x; b.y = pl.y; b.z = pl.z; }
    });
    Object.keys(View.balls).forEach((id) => { if (!players.find((p) => p.id === id)) { const b = View.balls[id]; scene.remove(b.group); scene.remove(b.blob); scene.remove(b.ring); delete View.balls[id]; } });
  };
  View.teleportBall = function (id, x, y, z) { const b = View.balls[id]; if (!b) return; b.anim = null; b.x = x; b.y = y; b.z = z; };
  View.setBallRest = function (id, pl) { const b = View.balls[id]; if (!b) return; b.hidden = !!pl.finished && !pl.moving; if (!b.anim) { b.x = pl.x; b.y = pl.y; b.z = pl.z; } };
  View.ballPos = function (id) { const b = View.balls[id]; return b ? { x: b.x, y: b.y, z: b.z } : null; };
  View.isAnimating = function (id) { return !!(View.balls[id] && View.balls[id].anim); };

  // lecture d'un coup. startLocal en millisecondes (horloge locale)
  View.playShot = function (id, frames, events, startLocal, outcome) {
    const b = View.balls[id]; if (!b) return;
    b.anim = { frames, events: events.slice().sort((a, c) => a.f - c.f), t0: startLocal, ei: 0, outcome, n: frames.length / 3 };
    b.hidden = false;
  };
  const shotListeners = [];
  View.onBallEvent = (fn) => shotListeners.push(fn);

  // ---------- particules ----------
  const pGeo = new T.SphereGeometry(0.09, 5, 4);
  function burst(x, y, z, color, n, speed, up, size) {
    for (let i = 0; i < n; i++) {
      let p = particles.find((q) => !q.alive);
      if (!p) { if (particles.length > 160) return; p = { mesh: new T.Mesh(pGeo, new T.MeshBasicMaterial({ color: 0xffffff, transparent: true })), alive: false, v: new T.Vector3(), life: 0 }; scene.add(p.mesh); particles.push(p); }
      p.alive = true; p.life = 0.5 + Math.random() * 0.5; p.max = p.life; p.mesh.visible = true; p.mesh.material.color.set(color); p.mesh.position.set(x, y, z); p.mesh.scale.setScalar((size || 1) * (0.6 + Math.random() * 0.8));
      const a = Math.random() * 6.28, s = speed * (0.4 + Math.random() * 0.8); p.v.set(Math.cos(a) * s, up * (0.5 + Math.random()), Math.sin(a) * s);
    }
  }
  View.burst = burst;
  function surfColor(s) { const C = biome.col; return [C.fairway, C.green, C.rough, C.sand, C.water, C.ice, C.mud, C.lava, C.bouncy, C.wall][s] || C.rough; }

  // ---------- visée ----------
  // mode "aucune" cache tout, "points" montre la direction, "trajectoire" montre le vol, les rebonds, le roulé et la zone d'incertitude
  const aimTex = {};
  function emojiTex(ch) {
    if (aimTex[ch]) return aimTex[ch];
    const c = document.createElement("canvas"); c.width = c.height = 96; const g = c.getContext("2d"); g.font = "64px sans-serif"; g.textAlign = "center"; g.textBaseline = "middle";
    g.fillStyle = "rgba(0,0,0,0.35)"; g.beginPath(); g.arc(48, 48, 44, 0, 6.3); g.fill(); g.fillText(ch, 48, 52);
    const t = new T.CanvasTexture(c); aimTex[ch] = t; return t;
  }
  const MARK = { hit: "💥", ob: "🚫", boost: "⚡", orb: "✨", portal: "🌀", tramp: "🟣", skip: "💦", sunk: "⛳" };
  let aimPool = null, aimLabelKey = "";
  function buildAimPool() {
    aimGroup = new T.Group(); scene.add(aimGroup);
    const flat = (c, o) => new T.MeshBasicMaterial({ color: c, transparent: true, opacity: o, depthTest: false, side: T.DoubleSide });
    aimPool = { air: [], roll: [], marks: [], matAir: flat(0xffffff, 0.95), matRoll: flat(0xffd84a, 0.95) };
    const sg = new T.SphereGeometry(0.13, 8, 6), dg = new T.CylinderGeometry(0.17, 0.17, 0.04, 10);
    for (let i = 0; i < 130; i++) { const m = new T.Mesh(i % 2 ? sg : sg, aimPool.matAir); m.renderOrder = 9; m.visible = false; aimGroup.add(m); aimPool.air.push(m); }
    for (let i = 0; i < 130; i++) { const m = new T.Mesh(dg, aimPool.matRoll); m.renderOrder = 9; m.visible = false; aimGroup.add(m); aimPool.roll.push(m); }
    const ring = (c, ri, ro) => { const m = new T.Mesh(new T.RingGeometry(ri, ro, 32), flat(c, 0.95)); m.rotation.x = -Math.PI / 2; m.renderOrder = 9; m.visible = false; aimGroup.add(m); return m; };
    aimPool.carry = ring(0xffffff, 0.5, 0.75); aimPool.rest = ring(0xffd84a, 0.4, 0.62);
    aimPool.disc = new T.Mesh(new T.CircleGeometry(1, 40), flat(0xffffff, 0.2)); aimPool.disc.rotation.x = -Math.PI / 2; aimPool.disc.renderOrder = 8; aimPool.disc.visible = false; aimGroup.add(aimPool.disc);
    aimPool.discEdge = new T.Mesh(new T.RingGeometry(0.94, 1, 48), flat(0xffffff, 0.55)); aimPool.discEdge.rotation.x = -Math.PI / 2; aimPool.discEdge.renderOrder = 8; aimPool.discEdge.visible = false; aimGroup.add(aimPool.discEdge);
    for (let i = 0; i < 8; i++) { const sp = new T.Sprite(new T.SpriteMaterial({ depthTest: false, transparent: true })); sp.scale.set(1.5, 1.5, 1); sp.renderOrder = 10; sp.visible = false; aimGroup.add(sp); aimPool.marks.push(sp); }
    const lc = document.createElement("canvas"); lc.width = 320; lc.height = 96; aimPool.lc = lc; aimPool.ltex = new T.CanvasTexture(lc);
    aimPool.label = new T.Sprite(new T.SpriteMaterial({ map: aimPool.ltex, depthTest: false, transparent: true })); aimPool.label.scale.set(5.2, 1.56, 1); aimPool.label.renderOrder = 11; aimPool.label.visible = false; aimGroup.add(aimPool.label);
    const arrow = new T.Mesh(new T.ConeGeometry(0.32, 0.8, 8), new T.MeshBasicMaterial({ color: 0xffd84a, depthTest: false })); arrow.renderOrder = 9; aimGroup.add(arrow); aimPool.arrow = arrow;
    aimPool.line = [];
    for (let i = 0; i < 26; i++) { const m = new T.Mesh(sg, aimPool.matAir); m.renderOrder = 9; m.visible = false; aimGroup.add(m); aimPool.line.push(m); }
  }
  function setLabel(text, warn) {
    const key = text + "|" + warn; if (key === aimLabelKey) return; aimLabelKey = key;
    const c = aimPool.lc, g = c.getContext("2d"); g.clearRect(0, 0, c.width, c.height);
    g.fillStyle = warn ? "rgba(150,20,20,0.88)" : "rgba(10,40,30,0.85)"; const r = 22; g.beginPath(); g.moveTo(r, 8); g.lineTo(c.width - r, 8); g.quadraticCurveTo(c.width - 4, 8, c.width - 4, 8 + r); g.lineTo(c.width - 4, c.height - 8 - r); g.quadraticCurveTo(c.width - 4, c.height - 8, c.width - r, c.height - 8); g.lineTo(r, c.height - 8); g.quadraticCurveTo(4, c.height - 8, 4, c.height - 8 - r); g.lineTo(4, 8 + r); g.quadraticCurveTo(4, 8, r, 8); g.fill();
    g.font = "bold 44px sans-serif"; g.fillStyle = "#fff"; g.textAlign = "center"; g.textBaseline = "middle"; g.fillText(text, c.width / 2, c.height / 2 + 2); aimPool.ltex.needsUpdate = true;
  }
  // x y z position de la balle, yaw direction. o = { mode, len, frames, events, sigma, label, warn, outcome }
  View.setAim = function (show, x, y, z, yaw, o) {
    if (!aimPool) buildAimPool();
    aimGroup.visible = show; if (!show) return; o = o || {};
    const P = aimPool; const mode = o.mode || "points";
    const hideAll = () => { P.air.forEach((m) => { m.visible = false; }); P.roll.forEach((m) => { m.visible = false; }); P.marks.forEach((m) => { m.visible = false; }); P.carry.visible = P.rest.visible = P.disc.visible = P.discEdge.visible = P.label.visible = false; };
    const sx = Math.sin(yaw), sz = Math.cos(yaw);
    P.line.forEach((d, i) => { const dist = 1.3 + i * ((o.len || 20) / 26); d.visible = mode === "points"; const px = x + sx * dist, pz = z + sz * dist; d.position.set(px, groundY(px, pz) + 0.25, pz); d.scale.setScalar(i % 5 === 4 ? 1.7 : 1); });
    P.arrow.visible = mode === "points"; { const len = o.len || 20; const ax = x + sx * (len + 1.4), az = z + sz * (len + 1.4); P.arrow.position.set(ax, groundY(ax, az) + 0.35, az); P.arrow.rotation.order = "YXZ"; P.arrow.rotation.y = yaw; P.arrow.rotation.x = Math.PI / 2; }
    if (mode === "zone" && o.frames && o.zone) {
      // aide douce, l'arc de vol jusqu'à l'atterrissage et un grand cercle d'arrivée, sans rebonds ni obstacles
      const f = o.frames, n = f.length / 3; hideAll();
      let land = n - 1; for (let i = 4; i < n; i++) { if (f[i * 3 + 1] / 100 - groundY(f[i * 3] / 100, f[i * 3 + 2] / 100) < 0.2) { land = i; break; } }
      let total = 0; for (let i = 1; i <= land; i++) total += Math.hypot(f[i * 3] - f[(i - 1) * 3], f[i * 3 + 2] - f[(i - 1) * 3 + 2]) / 100 + Math.abs(f[i * 3 + 1] - f[(i - 1) * 3 + 1]) / 100;
      const gap = Math.max(0.8, total / 34); let acc = 0, ia = 0;
      for (let i = 1; i <= land; i++) {
        acc += Math.hypot(f[i * 3] - f[(i - 1) * 3], f[i * 3 + 2] - f[(i - 1) * 3 + 2]) / 100 + Math.abs(f[i * 3 + 1] - f[(i - 1) * 3 + 1]) / 100;
        if (acc < gap) continue; acc = 0;
        const px = f[i * 3] / 100, py = f[i * 3 + 1] / 100, pz = f[i * 3 + 2] / 100;
        if (py - groundY(px, pz) > 0.3 && ia < P.air.length) { const m = P.air[ia++]; m.position.set(px, py, pz); m.visible = true; }
      }
      const zr = Math.max(1.5, o.zone.r), gy = groundY(o.zone.cx, o.zone.cz);
      P.disc.visible = P.discEdge.visible = true; P.disc.position.set(o.zone.cx, gy + 0.1, o.zone.cz); P.disc.scale.set(zr, zr, 1); P.discEdge.position.set(o.zone.cx, gy + 0.11, o.zone.cz); P.discEdge.scale.set(zr, zr, 1);
      const col = o.warn ? 0xff5a4a : 0xffffff; P.disc.material.color.setHex(col); P.discEdge.material.color.setHex(col);
      if (o.label) { setLabel(o.label, !!o.warn); P.label.visible = true; P.label.position.set(o.zone.cx, gy + 3.3 + Math.min(1.5, zr * 0.12), o.zone.cz); }
      return;
    }
    if (mode !== "trajectoire" || !o.frames) { hideAll(); return; }
    const f = o.frames, n = f.length / 3; let total = 0; for (let i = 1; i < n; i++) total += Math.hypot(f[i * 3] - f[(i - 1) * 3], f[i * 3 + 2] - f[(i - 1) * 3 + 2]) / 100;
    const gap = Math.max(0.9, total / 120); let acc = 0, ia = 0, ir = 0;
    P.air.forEach((m) => { m.visible = false; }); P.roll.forEach((m) => { m.visible = false; });
    for (let i = 1; i < n; i++) {
      acc += Math.hypot(f[i * 3] - f[(i - 1) * 3], f[i * 3 + 2] - f[(i - 1) * 3 + 2]) / 100 + Math.abs(f[i * 3 + 1] - f[(i - 1) * 3 + 1]) / 200;
      if (acc < gap) continue; acc = 0;
      const px = f[i * 3] / 100, py = f[i * 3 + 1] / 100, pz = f[i * 3 + 2] / 100; const gy = groundY(px, pz);
      if (py - gy > 0.3) { if (ia < P.air.length) { const m = P.air[ia++]; m.position.set(px, py, pz); m.visible = true; } }
      else if (ir < P.roll.length) { const m = P.roll[ir++]; m.position.set(px, gy + 0.1, pz); m.visible = true; }
    }
    // premier contact avec le sol
    let cx = null, cz = null; for (let i = 1; i < n; i++) { const py = f[i * 3 + 1] / 100, gy = groundY(f[i * 3] / 100, f[i * 3 + 2] / 100); if (py - gy < 0.2 && i > 3) { cx = f[i * 3] / 100; cz = f[i * 3 + 2] / 100; break; } }
    if (cx != null && o.showCarry !== false) { P.carry.visible = true; P.carry.position.set(cx, groundY(cx, cz) + 0.12, cz); } else P.carry.visible = false;
    const ex = f[(n - 1) * 3] / 100, ez = f[(n - 1) * 3 + 2] / 100, egy = groundY(ex, ez);
    P.rest.visible = true; P.rest.position.set(ex, egy + 0.14, ez); P.rest.material.color.setHex(o.warn ? 0xff5a4a : 0xffd84a);
    const sg = Math.max(0.5, o.sigma || 0.5);
    P.disc.visible = P.discEdge.visible = true; P.disc.position.set(ex, egy + 0.1, ez); P.disc.scale.set(sg, sg, 1); P.discEdge.position.set(ex, egy + 0.11, ez); P.discEdge.scale.set(sg, sg, 1);
    P.disc.material.color.setHex(o.warn ? 0xff5a4a : 0xffffff); P.discEdge.material.color.setHex(o.warn ? 0xff5a4a : 0xffffff);
    // pastilles sur les événements
    P.marks.forEach((m) => { m.visible = false; }); let mi = 0;
    (o.events || []).forEach((e) => {
      const ch = MARK[e.k]; if (!ch || mi >= P.marks.length || e.k === "sunk" && false) return;
      const m = P.marks[mi++]; m.material.map = emojiTex(ch); m.material.needsUpdate = true; m.position.set(e.x, e.y + 1.1, e.z); m.visible = true;
    });
    if (o.outcome === "water" || o.outcome === "lava") { if (mi < P.marks.length) { const m = P.marks[mi++]; m.material.map = emojiTex(o.outcome === "lava" ? "🔥" : "💦"); m.material.needsUpdate = true; m.position.set(ex, egy + 1.4, ez); m.visible = true; } }
    if (o.label) { setLabel(o.label, !!o.warn); P.label.visible = true; P.label.position.set(ex, egy + 3.1 + Math.min(1.5, sg * 0.15), ez); } else P.label.visible = false;
  };
  // point du terrain sous un clic ou un doigt
  View.pick = function (cx, cy) {
    if (!terrain || !renderer) return null; const r = host.getBoundingClientRect();
    const ndc = new T.Vector2(((cx - r.left) / r.width) * 2 - 1, -((cy - r.top) / r.height) * 2 + 1);
    const rc = new T.Raycaster(); rc.setFromCamera(ndc, camera); const hit = rc.intersectObject(terrain, false)[0];
    return hit ? { x: hit.point.x, z: hit.point.z } : null;
  };

  // ---------- caméra ----------
  View.resetCamera = function () { camMode = "aim"; flyT = -1; };
  View.setCam = function (o) { if (o.yaw != null) camYaw = o.yaw; if (o.dist != null) camDist = clamp(o.dist, 4, 22); if (o.pitch != null) camPitch = clamp(o.pitch, 0.12, 1.0); };
  View.camState = () => ({ yaw: camYaw, dist: camDist, pitch: camPitch });
  View.follow = function (id) { followId = id; };
  View.setCamMode = function (m) { camMode = m; };
  let topInfo = null;
  View.setTop = function (on, info) { if (on) { topInfo = info; camMode = "top"; } else if (camMode === "top") { camMode = "aim"; topInfo = null; } };
  View.isTop = () => camMode === "top";
  View.startFlyover = function (ms) {
    const h = View.hole; if (!h) return; flyT = 0; flyPath = { dur: ms || 4200, pts: h.path.filter((_, i) => i % 2 === 0).map((p) => new T.Vector3(p.x, 0, p.z)) };
    camMode = "fly";
  };
  View.endFlyover = function () { if (camMode === "fly") camMode = "aim"; flyT = -1; };

  function updateCamera(dt) {
    const h = View.hole; if (!h) return;
    const me = followId && View.balls[followId];
    if (camMode === "fly" && flyPath) {
      flyT += dt * 1000; const t = clamp(flyT / flyPath.dur, 0, 1); const e = t * t * (3 - 2 * t);
      const pts = flyPath.pts; const f = (1 - e) * (pts.length - 1); const i = Math.min(pts.length - 2, Math.floor(f)); const u = f - i;
      const px = lerp(pts[i].x, pts[i + 1].x, u), pz = lerp(pts[i].z, pts[i + 1].z, u);
      const nx = pts[Math.min(pts.length - 1, i + 2)], pv = pts[Math.max(0, i - 1)];
      const dx = pts[Math.min(pts.length - 1, i + 1)].x - pts[Math.max(0, i - 1)].x, dz = pts[Math.min(pts.length - 1, i + 1)].z - pts[Math.max(0, i - 1)].z; const dl = Math.hypot(dx, dz) || 1;
      const dirx = -dx / dl, dirz = -dz / dl; // on regarde du trou vers le départ puis on revient
      tmpV.set(px + dirx * 14, groundY(px, pz) + 16 - e * 5, pz + dirz * 14); camPos.lerp(tmpV, 0.12); camLook.set(px, groundY(px, pz), pz);
      camera.position.copy(camPos); camera.lookAt(camLook); return;
    }
    if (camMode !== "top") { camera.up.lerp(UP, 0.25).normalize(); }
    if (camMode === "top" && topInfo) {
      const sx = Math.sin(topInfo.yaw), sz = Math.cos(topInfo.yaw); const H = topInfo.h;
      tmpV.set(topInfo.x - sx * H * 0.16, groundY(topInfo.x, topInfo.z) + H, topInfo.z - sz * H * 0.16); camPos.lerp(tmpV, Math.min(1, dt * 6));
      camLook.lerp(tmpV.set(topInfo.x, groundY(topInfo.x, topInfo.z), topInfo.z), Math.min(1, dt * 8));
      camera.up.lerp(new T.Vector3(sx, 0, sz), Math.min(1, dt * 8)).normalize(); camera.position.copy(camPos); camera.lookAt(camLook); return;
    }
    if (camMode === "over") {
      const cx = (h.tee.x + h.cup.x) / 2, cz = (h.tee.z + h.cup.z) / 2; const span = Math.hypot(h.cup.x - h.tee.x, h.cup.z - h.tee.z);
      tmpV.set(cx, span * 0.85 + 18, cz - span * 0.45); camPos.lerp(tmpV, 0.1); camLook.lerp(new T.Vector3(cx, 0, cz), 0.15); camera.position.copy(camPos); camera.lookAt(camLook); return;
    }
    if (!me) return;
    let tx = me.x, ty = me.y, tz = me.z;
    let yaw = camYaw;
    if (me.anim) {
      // pendant le vol, on suit la balle depuis l'arrière
      const f = me.anim.frames; const i = Math.min(me.anim.n - 2, Math.max(0, Math.floor(((Date.now() + clockOffset - me.anim.t0) / 1000) * 30)));
      const dx = f[(i + 1) * 3] - f[i * 3], dz = f[(i + 1) * 3 + 2] - f[i * 3 + 2];
      if (Math.hypot(dx, dz) > 0.5) { const want = Math.atan2(dx, dz); let d = want - camYaw; while (d > Math.PI) d -= 2 * Math.PI; while (d < -Math.PI) d += 2 * Math.PI; camYaw += d * Math.min(1, dt * 1.6); yaw = camYaw; }
    }
    const horiz = camDist * Math.cos(camPitch), vert = camDist * Math.sin(camPitch);
    tmpV.set(tx - Math.sin(yaw) * horiz, ty + vert + 0.6, tz - Math.cos(yaw) * horiz);
    const gy = groundY(tmpV.x, tmpV.z) + 1.0; if (tmpV.y < gy) tmpV.y = gy;
    camPos.lerp(tmpV, me.anim ? Math.min(1, dt * 4) : Math.min(1, dt * 7));
    camLook.set(tx + Math.sin(yaw) * 6, ty + 0.5, tz + Math.cos(yaw) * 6);
    camera.position.copy(camPos); camera.lookAt(camLook);
    if (shake > 0) { camera.position.x += (Math.random() - 0.5) * shake; camera.position.y += (Math.random() - 0.5) * shake; shake = Math.max(0, shake - dt * 2); }
  }

  // ---------- boucle ----------
  let last = performance.now(); let clothT = 0;
  function loop(now) { requestAnimationFrame(loop); PicuiteGL.frame(() => loopBody(now)); }
  function loopBody(now) {
    const dt = Math.min(0.05, (now - last) / 1000); last = now;
    if (!View.hole || !renderer || View.paused) { return; }
    const tr = Math.max(0, tRel());
    // balles
    Object.values(View.balls).forEach((b) => {
      if (b.anim) {
        const a = b.anim; const t = (Date.now() + clockOffset - a.t0) / 1000; const f = t * 30;
        if (f < 0) { /* pas encore parti */ }
        else {
          const i = Math.floor(f); const u = f - i;
          while (a.ei < a.events.length && a.events[a.ei].f <= f) { const ev = a.events[a.ei++]; handleEvent(b, ev); }
          if (i >= a.n - 1) { const k = (a.n - 1) * 3; b.x = a.frames[k] / 100; b.y = a.frames[k + 1] / 100; b.z = a.frames[k + 2] / 100; b.anim = null; shotListeners.forEach((fn) => fn({ k: "end", id: b.id, outcome: a.outcome })); }
          else {
            const k = i * 3, k2 = (i + 1) * 3; const dx = a.frames[k2] - a.frames[k], dz = a.frames[k2 + 2] - a.frames[k + 2];
            const jump = Math.hypot(dx, dz) > 600; const uu = jump ? 1 : u;
            b.x = lerp(a.frames[k], a.frames[k2], uu) / 100; b.y = lerp(a.frames[k + 1], a.frames[k2 + 1], uu) / 100; b.z = lerp(a.frames[k + 2], a.frames[k2 + 2], uu) / 100;
            b.group.rotation.x += dt * 9; b.group.rotation.z += dt * 5;
          }
        }
      }
      b.group.visible = !b.hidden; b.blob.visible = !b.hidden; b.ring.visible = !b.hidden;
      b.group.position.set(b.x, b.y, b.z);
      const gy = groundY(b.x, b.z); b.blob.position.set(b.x, gy + 0.04, b.z); const hgt = Math.max(0, b.y - gy); b.blob.scale.setScalar(clamp(1.2 - hgt * 0.06, 0.3, 1.2)); b.blob.material.opacity = clamp(0.35 - hgt * 0.02, 0.08, 0.35);
      b.ring.position.set(b.x, gy + 0.06, b.z); b.ring.scale.setScalar(1 + 0.12 * Math.sin(now / 260));
      b.label.position.y = 0.95 + Math.min(2.2, hgt * 0.05);
    });
    // objets animés
    movers.forEach((m) => {
      if (m.kind === "bar") { const e = P.barEnds(m.def, tr); m.obj.rotation.y = -e.ang; }
      else if (m.kind === "slider") { const e = P.sliderEnds(m.def, tr); m.obj.position.set((e.x1 + e.x2) / 2, groundY((e.x1 + e.x2) / 2, (e.z1 + e.z2) / 2), (e.z1 + e.z2) / 2); m.obj.rotation.y = -Math.atan2(m.def.tz, m.def.tx); }
      else if (m.kind === "squish") { const s = 1 + (m.amp || 0.07) * Math.sin(now / 330 + m.ph); m.obj.scale.set(m.base * (2 - s), m.base * s, m.base * (2 - s)); }
      else if (m.kind === "portal") { m.obj.rotation.z += dt * 1.4; m.disc.material.opacity = 0.28 + 0.12 * Math.sin(now / 200); }
    });
    Object.values(orbMeshes).forEach((g) => { g.position.y = g.userData.base + Math.sin(now / 420 + g.userData.ph) * 0.18; g.userData.core.rotation.y += dt * 2; g.userData.ring.rotation.x += dt * 1.5; g.userData.ring.rotation.y += dt * 0.7; const hue = (now / 2500 + g.userData.ph) % 1; g.userData.core.material.emissive.setHSL(hue, 0.9, 0.55); });
    liquids.forEach((l) => { if (l.userData.liquid === "lava") l.material.emissiveIntensity = 0.75 + 0.25 * Math.sin(now / 300); else l.position.y = Math.sin(now / 700) * 0.02; });
    if (flag) { clothT += dt; flag.children.forEach((c) => { if (c.userData.cloth) { const p = c.geometry.attributes.position; for (let i = 0; i < p.count; i++) { const x = p.getX(i); p.setZ(i, Math.sin(clothT * 4 + x * 3) * 0.12 * (x + 0.65)); } p.needsUpdate = true; } }); }
    // murs de pouvoir
    Object.values(wallMeshes).forEach((w) => { if (w.userData.grow < 1) { w.userData.grow = Math.min(1, w.userData.grow + dt * 3); w.scale.y = w.userData.grow; } });
    // particules
    particles.forEach((p) => { if (!p.alive) return; p.life -= dt; if (p.life <= 0) { p.alive = false; p.mesh.visible = false; return; } p.v.y -= 14 * dt; p.mesh.position.addScaledVector(p.v, dt); p.mesh.material.opacity = clamp(p.life / p.max, 0, 1); });
    if (stars) stars.position.copy(camera.position);
    // lumière qui suit la caméra pour des ombres nettes
    const fm = followId && View.balls[followId]; if (fm) { sun.target.position.set(fm.x, fm.y, fm.z); sun.position.set(fm.x + 40, fm.y + 70, fm.z - 20); }
    updateCamera(dt);
    PicuiteGL.frame(() => { renderer.render(scene, camera); PicuiteGL.verify(renderer); });
  }

  function handleEvent(b, ev) {
    const isMine = b.id === followId; const near = (v) => (isMine ? v : v * 0.5);
    if (ev.k === "bounce") { burst(ev.x, ev.y + 0.1, ev.z, surfColor(ev.s), Math.min(10, 3 + ev.v), 2 + ev.v * 0.2, 2.5, 1); shotListeners.forEach((fn) => fn({ k: "bounce", id: b.id, s: ev.s, v: ev.v, mine: isMine })); }
    else if (ev.k === "splash") { burst(ev.x, ev.y + 0.1, ev.z, biome.col.water, 22, 4, 6, 1.4); shotListeners.forEach((fn) => fn({ k: "splash", id: b.id, mine: isMine })); }
    else if (ev.k === "lava") { burst(ev.x, ev.y + 0.1, ev.z, "#ff7a2a", 24, 4, 7, 1.4); shotListeners.forEach((fn) => fn({ k: "splash", id: b.id, mine: isMine, lava: true })); }
    else if (ev.k === "skip") { burst(ev.x, ev.y + 0.1, ev.z, biome.col.water, 8, 2.5, 3, 1); shotListeners.forEach((fn) => fn({ k: "skip", id: b.id, mine: isMine })); }
    else if (ev.k === "sunk") { for (let i = 0; i < 4; i++) setTimeout(() => burst(ev.x, ev.y + 1.2, ev.z, ["#ffd84a", "#ff5a8a", "#5ad0ff", "#8aff7a"][i], 14, 5, 7, 1.3), i * 90); shotListeners.forEach((fn) => fn({ k: "sunk", id: b.id, mine: isMine })); }
    else if (ev.k === "hit" || ev.k === "bumper") { burst(ev.x, ev.y + 0.2, ev.z, "#ffffff", 6, 2.5, 2, 0.8); shotListeners.forEach((fn) => fn({ k: ev.k, id: b.id, v: ev.v || 4, mine: isMine })); }
    else if (ev.k === "boost") { burst(ev.x, ev.y + 0.1, ev.z, "#ffcc33", 6, 3, 1, 0.9); shotListeners.forEach((fn) => fn({ k: "boost", id: b.id, mine: isMine })); }
    else if (ev.k === "tramp") { burst(ev.x, ev.y + 0.1, ev.z, "#b04aff", 12, 3, 3, 1); shotListeners.forEach((fn) => fn({ k: "tramp", id: b.id, mine: isMine })); }
    else if (ev.k === "portal") { burst(ev.x, ev.y + 0.6, ev.z, "#2ad0ff", 16, 3, 3, 1); burst(ev.to[0], ev.y + 0.6, ev.to[1], "#ff9a2a", 16, 3, 3, 1); shotListeners.forEach((fn) => fn({ k: "portal", id: b.id, mine: isMine })); }
    else if (ev.k === "orb") { const o = orbMeshes[ev.id]; if (o) { o.visible = false; burst(o.position.x, o.position.y, o.position.z, "#ffe45a", 18, 3.5, 4, 1.2); } shotListeners.forEach((fn) => fn({ k: "orb", id: b.id, mine: isMine })); }
    else if (ev.k === "ob") shotListeners.forEach((fn) => fn({ k: "ob", id: b.id, mine: isMine }));
  }

  // ---------- état extérieur ----------
  View.setOrbs = function (list) { list.forEach((o) => { const g = orbMeshes[o.id]; if (!g) return; const playing = Object.values(View.balls).some((b) => b.anim && b.anim.events.some((e) => e.k === "orb" && e.id === o.id && b.anim.ei <= b.anim.events.indexOf(e))); g.visible = !o.taken || playing; }); };
  View.setWalls = function (list) {
    const ids = new Set(list.map((w) => w.id));
    Object.keys(wallMeshes).forEach((k) => { if (!ids.has(+k)) { holeGroup.remove(wallMeshes[k]); delete wallMeshes[k]; } });
    list.forEach((w) => {
      if (wallMeshes[w.id]) return;
      const len = Math.hypot(w.x2 - w.x1, w.z2 - w.z1); const tex = brickTexture();
      const m = new T.Mesh(G.box(len, w.h, 0.5), new T.MeshStandardMaterial({ map: tex, roughness: 0.9 })); m.castShadow = true;
      const cx = (w.x1 + w.x2) / 2, cz = (w.z1 + w.z2) / 2; m.position.set(cx, groundY(cx, cz) + w.h / 2, cz); m.rotation.y = -Math.atan2(w.z2 - w.z1, w.x2 - w.x1);
      const g = new T.Group(); g.position.set(cx, groundY(cx, cz), cz); m.position.set(0, w.h / 2, 0); g.rotation.y = m.rotation.y; m.rotation.y = 0; g.add(m); g.userData.grow = 0; g.scale.y = 0.01; holeGroup.add(g); wallMeshes[w.id] = g;
      burst(cx, groundY(cx, cz) + 1, cz, "#e8c8a0", 18, 3, 3, 1.2);
    });
  };
  View.shake = (a) => { shake = a || 0.4; };
  View.camera = () => camera;
  View.project = function (x, y, z) { const v = new T.Vector3(x, y, z).project(camera); return { x: (v.x * 0.5 + 0.5) * (host.clientWidth), y: (-v.y * 0.5 + 0.5) * host.clientHeight, behind: v.z > 1 }; };
  View.groundY = groundY;
  View.biome = () => biome;
  View.screenshotReady = () => !!terrain;
  window.GolfView = View;
})();

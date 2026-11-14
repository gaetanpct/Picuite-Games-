// ============================================================
// ZOOMALOU — Rendu 3D (three.js) du circuit, des voitures et de la caméra
// ============================================================
(function () {
  const T = THREE;
  const Track = ZoomTrack, Car = ZoomCar;
  const col = (h) => new T.Color(h);
  const lerp = (a, b, t) => a + (b - a) * t;
  const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
  const wrap = (a) => { while (a > Math.PI) a -= 2 * Math.PI; while (a < -Math.PI) a += 2 * Math.PI; return a; };
  const View = { ready: false, track: null, quality: "medium", cars: {}, paused: false };
  let renderer, scene, camera, sun, hemi, host, group = null, particles = [], gates = [], stars = null, camMode = 0, followId = null, shake = 0;
  let boostKick = 0, spdCam = 0, speedLines = null;
  let decorMesh = null, trackside = null, showroom = false, camRoll = 0, showAng = 0, platform = null, podiumG = null, podT = 0;
  let camHd = 0, camPos = new T.Vector3(), camInit = false, fov = 62, orbit = null, time = 0, sky = null, cloudsG = null, amb = null, ambMode = null, movers = [], ringsM = [];
  View.onFrame = null;

  View.init = function (container, quality) {
    host = container; View.quality = quality || "medium";
    const canvas = document.createElement("canvas"); canvas.className = "gl-canvas"; host.appendChild(canvas);
    renderer = PicuiteGL.create(T, canvas, View.quality); PicuiteGL.watch(canvas);
    renderer.setClearColor(0x000000, 0); renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, View.quality === "high" ? 2 : 1.5));
    renderer.shadowMap.enabled = View.quality !== "low"; renderer.shadowMap.type = T.PCFSoftShadowMap;
    scene = new T.Scene(); camera = new T.PerspectiveCamera(62, 1, 0.3, 900);
    hemi = new T.HemisphereLight(0xbfe3ff, 0x5a7a50, 0.9); scene.add(hemi);
    sun = new T.DirectionalLight(0xfff4d6, 0.95); sun.position.set(60, 90, -30); sun.castShadow = View.quality !== "low";
    const sh = View.quality === "high" ? 2048 : 1024; sun.shadow.mapSize.set(sh, sh); const sc = sun.shadow.camera; sc.left = -50; sc.right = 50; sc.top = 50; sc.bottom = -50; sc.near = 1; sc.far = 260; sun.shadow.bias = -0.0008;
    scene.add(sun); scene.add(sun.target);
    window.addEventListener("resize", View.resize); View.resize(); View.ready = true; requestAnimationFrame(loop);
    if (window.ZoomModels) { ZoomModels.load(View.quality !== "low"); ZoomModels.onReady(onModelsReady); }
    setupPost();
  };
  // ---------- effets de lumière ----------
  // halo lumineux sur ce qui brille (néons, turbos, anneaux, étincelles) et léger flou de vitesse sur les bords de l'écran
  let composer = null, bloom = null, blurPass = null, postOn = false, bgTex = null;
  const BLUR = { uniforms: { tDiffuse: { value: null }, amount: { value: 0 } }, vertexShader: "varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }",
    fragmentShader: "uniform sampler2D tDiffuse; uniform float amount; varying vec2 vUv; void main(){ vec2 d = vUv - vec2(0.5, 0.55); float k = amount * smoothstep(0.22, 0.8, length(d)); vec4 acc = vec4(0.0); for (int i = 0; i < 6; i++) { acc += texture2D(tDiffuse, vUv - d * k * float(i) * 0.012); } gl_FragColor = acc / 6.0; }" };
  function setupPost() {
    postOn = false; composer = null;
    try {
      if (!T.EffectComposer || !T.UnrealBloomPass || View.quality === "low" || (PicuiteGL.compat && PicuiteGL.compat())) return;
      composer = new T.EffectComposer(renderer); composer.addPass(new T.RenderPass(scene, camera));
      bloom = new T.UnrealBloomPass(new T.Vector2(256, 256), 0.35, 0.45, 0.82); composer.addPass(bloom);
      blurPass = new T.ShaderPass(BLUR); blurPass.enabled = false; composer.addPass(blurPass);
      postOn = true; View.resize();
    } catch (e) { console.warn("effets désactivés", e); composer = null; postOn = false; }
  }
  // avec les effets, le ciel en dégradé passe dans la scène, le fond transparent ne survit pas au halo
  function postSky(B) { if (!postOn) return; try { const c = document.createElement("canvas"); c.width = 4; c.height = 256; const x = c.getContext("2d"); const g = x.createLinearGradient(0, 0, 0, 256); g.addColorStop(0, B.sky[0]); g.addColorStop(0.78, B.sky[1]); g.addColorStop(1, B.sky[1]); x.fillStyle = g; x.fillRect(0, 0, 4, 256); if (bgTex) bgTex.dispose(); bgTex = new T.CanvasTexture(c); bgTex.minFilter = T.LinearFilter; bgTex.magFilter = T.LinearFilter; bgTex.generateMipmaps = false; scene.background = bgTex; } catch (e) { /* fond transparent */ }
    // seuls les objets lumineux brillent, le seuil est haut dans les biomes clairs pour que le sable ou la neige ne s'illuminent pas
    bloom.strength = { neon: 0.85, megapole: 0.5, usine: 0.38, foraine: 0.3 }[B.id] || 0.24; bloom.threshold = { neon: 0.72, megapole: 0.9, usine: 0.9 }[B.id] || 0.97; bloom.radius = B.id === "neon" ? 0.5 : 0.35; }
  View.setQuality = function (q) { View.quality = q; if (!renderer) return; if ((q === "low") === postOn) { setupPost(); if (!postOn) scene.background = null; else if (View.track) postSky(Track.BIOMES[View.track.biome]); } renderer.shadowMap.enabled = q !== "low"; sun.castShadow = q !== "low"; renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, q === "high" ? 2 : 1.5)); scene.traverse((o) => { if (o.material) o.material.needsUpdate = true; }); };
  View.resize = function () { if (!renderer || !host) return; const w = host.clientWidth || window.innerWidth, h = host.clientHeight || window.innerHeight; renderer.setSize(w, h, false); camera.aspect = w / h; if (viewOfs) camera.setViewOffset(w, h, 0, h * 0.27, w, h); camera.updateProjectionMatrix(); if (composer) { composer.setPixelRatio(renderer.getPixelRatio()); composer.setSize(w, h); if (bloom) bloom.resolution.set(w / 2, h / 2); } };

  // ---------- matériaux et petits modèles ----------
  const mats = {};
  function mat(color, opts) { const k = color + JSON.stringify(opts || {}); if (!mats[k]) mats[k] = new T.MeshStandardMaterial(Object.assign({ color: col(color), roughness: 0.8, metalness: 0, flatShading: true }, opts || {})); return mats[k]; }
  function mesh(geo, material, x, y, z) { const m = new T.Mesh(geo, material); m.position.set(x || 0, y || 0, z || 0); m.castShadow = true; return m; }
  const G = { cyl: (a, b, h, n) => new T.CylinderGeometry(a, b, h, n || 8), cone: (r, h, n) => new T.ConeGeometry(r, h, n || 8), sph: (r, a, b) => new T.SphereGeometry(r, a || 10, b || 8), box: (x, y, z) => new T.BoxGeometry(x, y, z), dodeca: (r) => new T.DodecahedronGeometry(r, 0), ico: (r, d) => new T.IcosahedronGeometry(r, d || 0), octa: (r) => new T.OctahedronGeometry(r, 0) };
  const DECOR = {
    tree() { const g = new T.Group(); g.add(mesh(G.cyl(0.3, 0.42, 3, 6), mat("#7a4f2a"), 0, 1.5, 0)); g.add(mesh(G.cone(2.3, 3.6, 7), mat("#2f9a45"), 0, 4.3, 0)); g.add(mesh(G.cone(1.7, 2.8, 7), mat("#3fb25a"), 0, 5.9, 0)); return g; },
    pine(b) { const g = new T.Group(); g.add(mesh(G.cyl(0.25, 0.35, 2, 6), mat("#6a4a2a"), 0, 1, 0)); [[2.0, 2.4, 2.8], [1.6, 2.2, 4.3], [1.1, 2, 5.7]].forEach(([r, h, y]) => { g.add(mesh(G.cone(r, h, 7), mat("#2a7a4f"), 0, y, 0)); if (b === "neige") g.add(mesh(G.cone(r * 0.72, h * 0.5, 7), mat("#ffffff"), 0, y + h * 0.3, 0)); }); return g; },
    palm() { const g = new T.Group(); const tr = mesh(G.cyl(0.2, 0.32, 5.6, 6), mat("#9a6a3a"), 0.4, 2.8, 0); tr.rotation.z = -0.15; g.add(tr); for (let i = 0; i < 6; i++) { const piv = new T.Group(); piv.position.set(0.9, 5.6, 0); piv.rotation.y = (i / 6) * 6.28; const leaf = mesh(G.cone(0.5, 3.4, 4), mat("#2fa85a"), 1.4, -0.2, 0); leaf.scale.set(1, 1, 0.25); leaf.rotation.z = -1.25; piv.add(leaf); g.add(piv); } return g; },
    cactus() { const g = new T.Group(); const c = mat("#3a9a50"); g.add(mesh(G.cyl(0.42, 0.46, 2.8, 8), c, 0, 1.4, 0)); g.add(mesh(G.sph(0.42, 8, 6), c, 0, 2.8, 0)); const a = mesh(G.cyl(0.2, 0.2, 1, 6), c, 0.65, 1.6, 0); a.rotation.z = Math.PI / 2; g.add(a); g.add(mesh(G.cyl(0.2, 0.2, 0.9, 6), c, 1.1, 2.0, 0)); return g; },
    rock(b) { const g = new T.Group(); const m = mesh(G.dodeca(1.3), mat(b === "volcan" ? "#4a3a40" : b === "neon" ? "#6a5aa0" : "#8a8f96"), 0, 0.8, 0); m.scale.set(1.2, 0.8, 1); g.add(m); return g; },
    snowman() { const g = new T.Group(); const w = mat("#ffffff"); g.add(mesh(G.sph(0.8, 10, 8), w, 0, 0.75, 0)); g.add(mesh(G.sph(0.58, 10, 8), w, 0, 1.7, 0)); g.add(mesh(G.sph(0.4, 10, 8), w, 0, 2.4, 0)); const nose = mesh(G.cone(0.08, 0.45, 6), mat("#ff8a2a"), 0, 2.4, 0.42); nose.rotation.x = Math.PI / 2; g.add(nose); return g; },
    mushroom() { const g = new T.Group(); g.add(mesh(G.cyl(0.35, 0.45, 1.1, 8), mat("#fff3e0"), 0, 0.55, 0)); const cap = mesh(new T.SphereGeometry(1.3, 12, 8, 0, Math.PI * 2, 0, Math.PI / 2), mat("#e83a3a"), 0, 1.05, 0); cap.scale.set(1, 0.7, 1); g.add(cap); for (let i = 0; i < 5; i++) { const a = i * 1.26; g.add(mesh(G.sph(0.17, 6, 5), mat("#ffffff"), Math.cos(a) * 0.7, 1.55 - (i % 2) * 0.15, Math.sin(a) * 0.7)); } return g; },
    lolli() { const g = new T.Group(); g.add(mesh(G.cyl(0.07, 0.07, 3, 6), mat("#ffffff"), 0, 1.5, 0)); [[1.0, "#ff4aa8"], [0.66, "#ffe14a"], [0.3, "#4ad0ff"]].forEach(([r, c], i) => { const d = mesh(G.cyl(r, r, 0.2 + i * 0.03, 14), mat(c), 0, 3.3, 0); d.rotation.x = Math.PI / 2; g.add(d); }); return g; },
    cane() { const g = new T.Group(); for (let i = 0; i < 7; i++) g.add(mesh(G.cyl(0.25, 0.25, 0.5, 8), mat(i % 2 ? "#ffffff" : "#ee3355"), 0, 0.25 + i * 0.5, 0)); g.add(mesh(new T.TorusGeometry(0.45, 0.22, 6, 10, Math.PI), mat("#ee3355"), 0.45, 3.2, 0)); return g; },
    gummy() { const g = new T.Group(); const m = mesh(G.sph(1.1, 12, 8), mat("#ff6aa8", { roughness: 0.3 }), 0, 0.7, 0); m.scale.set(1, 0.75, 1); g.add(m); return g; },
    asteroid() { const g = new T.Group(); const m = mesh(G.ico(1.3, 1), mat("#6f6a8a"), 0, 1.4, 0); m.scale.set(1.2, 1, 0.9); g.add(m); return g; },
    crystal(b) { const g = new T.Group(); const c = b === "volcan" ? "#ff7a3a" : "#5affd8"; [[0, 0, 1.6], [0.5, 0.3, 1.1], [-0.5, -0.2, 1.0]].forEach(([x, z, h]) => { const m = mesh(G.octa(0.55), mat(c, { emissive: col(b === "volcan" ? "#c03a10" : "#10a890"), emissiveIntensity: 0.6 }), x, h, z); m.scale.set(0.7, 2.0, 0.7); g.add(m); }); return g; },
    parasol() { const g = new T.Group(); g.add(mesh(G.cyl(0.06, 0.06, 2.6, 6), mat("#eeeeee"), 0, 1.3, 0)); g.add(mesh(G.cone(1.6, 0.7, 10), mat("#ff5a4a"), 0, 2.8, 0)); return g; },
    phare() { const g = new T.Group(); g.add(mesh(G.cyl(1.0, 1.5, 7, 10), mat("#f4f4f4"), 0, 3.5, 0)); [1.6, 4.2].forEach((y) => g.add(mesh(G.cyl(1.2, 1.35, 1.1, 10), mat("#d93a3a"), 0, y, 0))); g.add(mesh(G.cyl(1.25, 1.25, 0.3, 10), mat("#2a2a30"), 0, 7.1, 0)); g.add(mesh(G.sph(0.8, 8, 6), mat("#ffe27a", { emissive: col("#ffcf33"), emissiveIntensity: 0.8 }), 0, 7.9, 0)); g.add(mesh(G.cone(1.1, 1, 8), mat("#d93a3a"), 0, 8.9, 0)); return g; },
    bouee() { const g = new T.Group(); g.add(mesh(new T.TorusGeometry(0.8, 0.3, 6, 12), mat("#ff4a4a"), 0, 0.9, 0)); g.add(mesh(G.cyl(0.08, 0.08, 2, 6), mat("#eeeeee"), 0, 1.6, 0)); g.add(mesh(G.box(0.7, 0.35, 0.05), mat("#ffcf33"), 0.35, 2.4, 0)); return g; },
    pyramide() { const g = new T.Group(); const p = mesh(G.cone(4.6, 5.4, 4), mat("#e7c06a"), 0, 2.7, 0); p.rotation.y = Math.PI / 4; g.add(p); const q = mesh(G.cone(2.2, 2.6, 4), mat("#d2a850"), 6, 1.3, 2); q.rotation.y = Math.PI / 4; g.add(q); return g; },
    arche() { const g = new T.Group(); const c = mat("#c98e5a"); g.add(mesh(G.box(1.5, 4.2, 1.8), c, -2.2, 2.1, 0)); g.add(mesh(G.box(1.5, 3.4, 1.8), c, 2.2, 1.7, 0)); g.add(mesh(G.box(6.2, 1.3, 1.9), mat("#b57a48"), 0, 4.4, 0)); return g; },
    igloo() { const g = new T.Group(); g.add(mesh(new T.SphereGeometry(2.1, 12, 8, 0, Math.PI * 2, 0, Math.PI / 2), mat("#f4fbff"), 0, 0, 0)); g.add(mesh(G.box(1.1, 1.0, 1.4), mat("#e3f1fb"), 0, 0.5, 2.0)); g.add(mesh(G.box(0.7, 0.7, 0.2), mat("#34506a"), 0, 0.4, 2.75)); return g; },
    tronc() { const g = new T.Group(); const l = mesh(G.cyl(0.5, 0.5, 4, 8), mat("#7a4f2a"), 0, 0.5, 0); l.rotation.z = Math.PI / 2; g.add(l); [-2, 2].forEach((x) => { const e = mesh(G.cyl(0.4, 0.4, 0.06, 8), mat("#d9b27a"), x, 0.5, 0); e.rotation.z = Math.PI / 2; g.add(e); }); return g; },
    cabane() { const g = new T.Group(); g.add(mesh(G.box(2.8, 1.9, 2.4), mat("#8a5a2a"), 0, 0.95, 0)); const r = mesh(G.cone(2.4, 1.5, 4), mat("#a33a2a"), 0, 2.65, 0); r.rotation.y = Math.PI / 4; g.add(r); g.add(mesh(G.box(0.6, 1.1, 0.1), mat("#3a2412"), 0, 0.55, 1.22)); return g; },
    geyser() { const g = new T.Group(); g.add(mesh(G.cone(1.6, 1.3, 8), mat("#3a2a30"), 0, 0.65, 0)); g.add(mesh(G.cyl(0.25, 0.7, 4.2, 8), mat("#ff9a3a", { emissive: col("#ff6a1a"), emissiveIntensity: 0.9, transparent: true, opacity: 0.85 }), 0, 3.3, 0)); return g; },
    obelisque() { const g = new T.Group(); g.add(mesh(G.cyl(0.55, 1.0, 6.5, 4), mat("#3a2a40"), 0, 3.25, 0)); g.add(mesh(G.cone(0.55, 1.1, 4), mat("#ff7a3a", { emissive: col("#ff5a1a"), emissiveIntensity: 0.8 }), 0, 7.0, 0)); return g; },
    cupcake() { const g = new T.Group(); g.add(mesh(G.cyl(1.0, 0.75, 1.0, 12), mat("#ff9ad0"), 0, 0.5, 0)); g.add(mesh(G.sph(1.1, 12, 8), mat("#fff0f8"), 0, 1.4, 0)); g.add(mesh(G.sph(0.32, 8, 6), mat("#ff3a5a"), 0, 2.45, 0)); return g; },
    donut() { const g = new T.Group(); const a = mesh(new T.TorusGeometry(1.2, 0.55, 8, 16), mat("#f5a35a"), 0, 1.0, 0); a.rotation.x = Math.PI / 2; g.add(a); const b = mesh(new T.TorusGeometry(1.2, 0.5, 8, 16), mat("#ff7ac0"), 0, 1.2, 0); b.rotation.x = Math.PI / 2; b.scale.set(1, 1, 0.7); g.add(b); return g; },
    anneau() { const g = new T.Group(); const r = mesh(new T.TorusGeometry(2.4, 0.2, 6, 24), mat("#5affd8", { emissive: col("#2affc8"), emissiveIntensity: 1 }), 0, 4.2, 0); g.add(r); g.add(mesh(G.cyl(0.1, 0.14, 2, 6), mat("#2a2470"), 0, 1, 0)); return g; },
    tour() { const g = new T.Group(); g.add(mesh(G.cyl(0.7, 0.95, 10, 8), mat("#241a6a", { emissive: col("#3a2aa0"), emissiveIntensity: 0.5 }), 0, 5, 0)); g.add(mesh(G.sph(0.9, 8, 6), mat("#ff4a8a", { emissive: col("#ff2a7a"), emissiveIntensity: 0.9 }), 0, 10.6, 0)); return g; },
    immeuble() { const g = new T.Group(); const h = 14 + Math.random() * 26, w = 5 + Math.random() * 4; const tone = ["#c9d6e2", "#a9bccd", "#dfe6ec", "#8fa6ba"][Math.floor(Math.random() * 4)]; g.add(mesh(G.box(w, h, w * 0.9), mat(tone), 0, h / 2, 0)); for (let y = 2.5; y < h - 1; y += 3) g.add(mesh(G.box(w + 0.08, 0.9, w * 0.9 + 0.08), mat("#4a7aa6", { emissive: col("#7ac8ff"), emissiveIntensity: 0.25 }), 0, y, 0)); g.add(mesh(G.box(w * 0.5, 1.4, w * 0.4), mat("#6a7a8a"), 0, h + 0.7, 0)); return g; },
    tourverre() { const g = new T.Group(); const h = 30 + Math.random() * 25; g.add(mesh(G.cyl(3.2, 4.2, h, 8), mat("#7ac0e8", { roughness: 0.25, metalness: 0.3 }), 0, h / 2, 0)); g.add(mesh(G.cyl(0.2, 0.2, 6, 6), mat("#e6eef4"), 0, h + 3, 0)); g.add(mesh(G.sph(0.5, 6, 5), mat("#ff4a4a", { emissive: col("#ff2a2a"), emissiveIntensity: 1 }), 0, h + 6, 0)); return g; },
    panneau() { const g = new T.Group(); g.add(mesh(G.cyl(0.25, 0.3, 7, 6), mat("#8a96a4"), 0, 3.5, 0)); g.add(mesh(G.box(8, 3.4, 0.4), mat(["#21c5e8", "#ff4a8a", "#ffcf33"][Math.floor(Math.random() * 3)], { emissive: col("#ffffff"), emissiveIntensity: 0.15 }), 0, 8.4, 0)); return g; },
    antenne() { const g = new T.Group(); g.add(mesh(G.cyl(0.4, 1.4, 18, 4), mat("#c8ccd2"), 0, 9, 0)); [5, 10, 15].forEach((y) => g.add(mesh(G.box(3 - y * 0.12, 0.2, 0.2), mat("#9aa0aa"), 0, y, 0))); g.add(mesh(G.sph(0.45, 6, 5), mat("#ff4a4a", { emissive: col("#ff2a2a"), emissiveIntensity: 1 }), 0, 18.4, 0)); return g; },
    palmier2() { const g = new T.Group(); const tr = mesh(G.cyl(0.3, 0.45, 8, 6), mat("#7a5a32"), 0, 4, 0); g.add(tr); for (let i = 0; i < 7; i++) { const piv = new T.Group(); piv.position.set(0, 8, 0); piv.rotation.y = (i / 7) * 6.28; const leaf = mesh(G.cone(0.7, 4.6, 4), mat(i % 2 ? "#1f8a3a" : "#2fa84a"), 2.0, -0.5, 0); leaf.scale.set(1, 1, 0.25); leaf.rotation.z = -1.3; piv.add(leaf); g.add(piv); } return g; },
    fougere() { const g = new T.Group(); for (let i = 0; i < 6; i++) { const f = mesh(G.cone(0.5, 2.4, 4), mat("#2f9a45"), 0, 1.0, 0); f.rotation.z = 0.9; const piv = new T.Group(); piv.rotation.y = i * 1.05; piv.add(f); f.position.x = 0.9; g.add(piv); } return g; },
    temple() { const g = new T.Group(); const c = mat("#9a9a7a"); [[7, 1.6], [5.4, 1.6], [3.8, 1.6]].forEach(([w, h], k) => g.add(mesh(G.box(w, h, w), k % 2 ? mat("#8a8a6a") : c, 0, 0.8 + k * 1.6, 0))); g.add(mesh(G.box(2.2, 2, 2.2), mat("#7a7a5a"), 0, 5.8, 0)); g.add(mesh(G.box(1.2, 1.4, 0.3), mat("#2a2a20"), 0, 0.7, 3.55)); g.add(mesh(G.sph(1.0, 6, 5), mat("#3a8a3a"), 2.6, 3.4, 2.6)); return g; },
    bambou() { const g = new T.Group(); for (let i = 0; i < 5; i++) { const h = 6 + Math.random() * 4; const x = (Math.random() - 0.5) * 2.4, z = (Math.random() - 0.5) * 2.4; g.add(mesh(G.cyl(0.18, 0.2, h, 6), mat("#8ac04a"), x, h / 2, z)); g.add(mesh(G.cone(0.6, 1.4, 4), mat("#3fa84a"), x, h, z)); } return g; },
    cheminee() { const g = new T.Group(); g.add(mesh(G.box(9, 6, 7), mat("#8a6a5a"), 0, 3, 0)); g.add(mesh(G.cyl(1.0, 1.4, 20, 10), mat("#9a5a4a"), 2.5, 10, 0)); [14, 18].forEach((y) => g.add(mesh(G.cyl(1.1, 1.1, 0.6, 10), mat("#f2f2f2"), 2.5, y, 0))); g.add(mesh(G.sph(2.2, 8, 6), mat("#d8d4d0", { transparent: true, opacity: 0.7 }), 2.5, 22, 0)); return g; },
    grue() { const g = new T.Group(); const y = mat("#ffb21a"); g.add(mesh(G.box(1.2, 22, 1.2), y, 0, 11, 0)); g.add(mesh(G.box(18, 1.0, 1.0), y, 4, 22, 0)); g.add(mesh(G.box(2.4, 2, 2.4), mat("#3a3a40"), -4, 21, 0)); g.add(mesh(G.cyl(0.05, 0.05, 9, 4), mat("#222222"), 11, 17.5, 0)); g.add(mesh(G.box(1.6, 1.2, 1.6), mat("#d94a3a"), 11, 12.6, 0)); return g; },
    conteneur() { const g = new T.Group(); const cs = ["#d94a3a", "#2a7ad1", "#3aa653", "#f2c230", "#8a55c8"]; const k = 1 + Math.floor(Math.random() * 3); for (let q = 0; q < k; q++) g.add(mesh(G.box(6, 2.6, 2.4), mat(cs[Math.floor(Math.random() * cs.length)]), (Math.random() - 0.5) * 0.6, 1.3 + q * 2.6, (Math.random() - 0.5) * 0.4)); return g; },
    cuve() { const g = new T.Group(); g.add(mesh(G.cyl(3.2, 3.2, 8, 14), mat("#c8ccd2", { metalness: 0.3, roughness: 0.4 }), 0, 4, 0)); g.add(mesh(G.sph(3.2, 14, 6), mat("#c8ccd2", { metalness: 0.3, roughness: 0.4 }), 0, 8, 0)); g.add(mesh(G.cyl(3.25, 3.25, 0.6, 14), mat("#ffb21a"), 0, 3, 0)); return g; },
    grandeRoue() { const g = new T.Group(); const R = 11; g.add(mesh(new T.TorusGeometry(R, 0.35, 6, 32), mat("#ff4a8a"), 0, R + 3, 0)); for (let i = 0; i < 12; i++) { const a = i / 12 * 6.28; const sp = mesh(G.box(0.2, R, 0.2), mat("#f2f2f2"), Math.cos(a) * R / 2, R + 3 + Math.sin(a) * R / 2, 0); sp.rotation.z = a + Math.PI / 2; g.add(sp); g.add(mesh(G.box(1.6, 1.4, 1.6), mat(["#ffcf33", "#21c5e8", "#7ac943"][i % 3]), Math.cos(a) * R, R + 1.8 + Math.sin(a) * R, 0)); } [-1, 1].forEach((o) => { const l = mesh(G.box(0.5, R + 4, 0.5), mat("#c8c8d0"), o * 3, (R + 3) / 2, 0); l.rotation.z = o * 0.22; g.add(l); }); return g; },
    chapiteau() { const g = new T.Group(); g.add(mesh(G.cyl(5, 5, 4, 12), mat("#ff3a6a"), 0, 2, 0)); for (let i = 0; i < 12; i += 2) { const s2 = mesh(G.box(0.4, 4.02, 2.7), mat("#ffffff"), Math.cos(i / 12 * 6.28) * 5, 2, Math.sin(i / 12 * 6.28) * 5); s2.rotation.y = -i / 12 * 6.28; g.add(s2); } g.add(mesh(G.cone(5.6, 4.2, 12), mat("#ffd23f"), 0, 6.1, 0)); g.add(mesh(G.cyl(0.08, 0.08, 2, 4), mat("#ffffff"), 0, 9, 0)); g.add(mesh(G.box(1.2, 0.7, 0.05), mat("#ff3a6a"), 0.6, 9.6, 0)); return g; },
    ballons() { const g = new T.Group(); const cs = ["#ff3a6a", "#ffd23f", "#21c5e8", "#7ac943", "#b45aff"]; for (let i = 0; i < 7; i++) { const x = (Math.random() - 0.5) * 3, z = (Math.random() - 0.5) * 3, h = 5 + Math.random() * 3; g.add(mesh(G.cyl(0.02, 0.02, h, 3), mat("#ffffff"), x * 0.5, h / 2, z * 0.5)); const b = mesh(G.sph(0.8, 8, 6), mat(cs[i % cs.length], { roughness: 0.3 }), x, h + 0.7, z); b.scale.y = 1.2; g.add(b); } return g; },
    manege() { const g = new T.Group(); g.add(mesh(G.cyl(5, 5, 0.6, 16), mat("#ffd23f"), 0, 0.3, 0)); g.add(mesh(G.cyl(0.4, 0.4, 4.6, 8), mat("#f2f2f2"), 0, 2.6, 0)); g.add(mesh(G.cone(5.5, 2.2, 16), mat("#21c5e8"), 0, 5.8, 0)); for (let i = 0; i < 6; i++) { const a = i / 6 * 6.28; g.add(mesh(G.cyl(0.08, 0.08, 4.4, 4), mat("#ffffff"), Math.cos(a) * 3.6, 2.6, Math.sin(a) * 3.6)); g.add(mesh(G.box(1.2, 0.9, 0.6), mat(["#ff3a6a", "#7ac943", "#b45aff"][i % 3]), Math.cos(a) * 3.6, 1.6 + (i % 2) * 0.6, Math.sin(a) * 3.6)); } return g; },
    dune() { const g = new T.Group(); const m = mesh(G.sph(6, 12, 6), mat("#e9b868"), 0, -2.2, 0); m.scale.set(1.6, 0.55, 1); g.add(m); const m2 = mesh(G.sph(4, 10, 6), mat("#f0c878"), 5, -1.6, 2); m2.scale.set(1.4, 0.5, 1); g.add(m2); return g; },
    pylon() { const g = new T.Group(); g.add(mesh(G.cyl(0.3, 0.45, 9, 6), mat("#2a2470", { emissive: col("#3a2aa0"), emissiveIntensity: 0.5 }), 0, 4.5, 0)); const r = mesh(new T.TorusGeometry(1.0, 0.12, 6, 14), mat("#5affd8", { emissive: col("#5affd8"), emissiveIntensity: 0.9 }), 0, 8.5, 0); r.rotation.x = Math.PI / 2; g.add(r); g.add(mesh(G.sph(0.5, 8, 6), mat("#ff4a8a", { emissive: col("#ff4a8a"), emissiveIntensity: 1 }), 0, 9.6, 0)); return g; },
  };
  function bakeDecor(list, biomeId) {
    const pos = [], cols = []; const cache = {}; const m4 = new T.Matrix4(), q = new T.Quaternion(), sc = new T.Vector3(), pv = new T.Vector3(), up = new T.Vector3(0, 1, 0), v = new T.Vector3(), c = new T.Color();
    const MD = window.ZoomModels && ZoomModels.ready ? ZoomModels : null;
    list.forEach((d) => {
      // modèle Kenney quand il existe pour ce décor, choisi parmi ses variantes d'après la position
      const vars = MD && MD.DECOR_MAP[d.k]; if (vars) { const vk = vars[Math.abs(Math.floor(d.x * 7 + d.z * 13)) % vars.length]; const parts = MD.decoParts(vk); if (parts) { pv.set(d.x, View.track.groundY, d.z); q.setFromAxisAngle(up, d.r); sc.setScalar(0.75 + d.s * 0.3); m4.compose(pv, q, sc); parts.forEach((p) => { const mm = new T.Matrix4().multiplyMatrices(m4, p.mw); const a = p.geo.attributes.position; for (let i = 0; i < a.count; i++) { v.fromBufferAttribute(a, i).applyMatrix4(mm); pos.push(v.x, v.y, v.z); cols.push(p.c.r, p.c.g, p.c.b); } }); return; } }
      const fn = DECOR[d.k] || DECOR.rock; if (!cache[d.k]) { const g = fn(biomeId); g.updateMatrixWorld(true); const parts = []; g.traverse((o) => { if (o.isMesh) { const geo = o.geometry.index ? o.geometry.toNonIndexed() : o.geometry; const cc = o.material.color.clone(); if (o.material.emissive) cc.add(o.material.emissive.clone().multiplyScalar(o.material.emissiveIntensity || 0)); parts.push({ geo, mw: o.matrixWorld.clone(), c: cc }); } }); cache[d.k] = parts; }
      pv.set(d.x, View.track.groundY, d.z); q.setFromAxisAngle(up, d.r); sc.setScalar(d.s); m4.compose(pv, q, sc);
      cache[d.k].forEach((p) => { const mm = new T.Matrix4().multiplyMatrices(m4, p.mw); const a = p.geo.attributes.position; for (let i = 0; i < a.count; i++) { v.fromBufferAttribute(a, i).applyMatrix4(mm); pos.push(v.x, v.y, v.z); cols.push(p.c.r, p.c.g, p.c.b); } });
    });
    const geo = new T.BufferGeometry(); geo.setAttribute("position", new T.Float32BufferAttribute(pos, 3)); geo.setAttribute("color", new T.Float32BufferAttribute(cols, 3));
    const m = new T.Mesh(geo, new T.MeshStandardMaterial({ vertexColors: true, roughness: 0.85, flatShading: true })); m.castShadow = true; return m;
  }

  // ---------- textures ----------
  function bannerTexture(text, a, b) {
    const c = document.createElement("canvas"); c.width = 512; c.height = 96; const g = c.getContext("2d");
    for (let i = 0; i < 16; i++) for (let j = 0; j < 3; j++) { g.fillStyle = (i + j) % 2 ? a : b; g.fillRect(i * 32, j * 32, 32, 32); }
    g.fillStyle = "rgba(0,0,0,0.55)"; g.fillRect(96, 14, 320, 68); g.fillStyle = "#fff"; g.font = "700 52px Fredoka, Trebuchet MS, sans-serif"; g.textAlign = "center"; g.textBaseline = "middle"; g.fillText(text, 256, 50);
    return new T.CanvasTexture(c);
  }
  function chevTexture(bg, fg) {
    const c = document.createElement("canvas"); c.width = 128; c.height = 128; const g = c.getContext("2d"); g.fillStyle = bg || "#ff9a1a"; g.fillRect(0, 0, 128, 128); g.strokeStyle = fg || "#fff3a0"; g.lineWidth = 14; g.lineCap = "round"; g.lineJoin = "round";
    for (let i = 0; i < 3; i++) { const y = 112 - i * 40; g.beginPath(); g.moveTo(22, y); g.lineTo(64, y - 30); g.lineTo(106, y); g.stroke(); }
    return new T.CanvasTexture(c);
  }
  // marquage au sol d'un carrefour, des hachures jaunes dans un cadre
  function junctionTexture() {
    const c = document.createElement("canvas"); c.width = 256; c.height = 256; const g = c.getContext("2d"); g.clearRect(0, 0, 256, 256); g.strokeStyle = "rgba(255,210,63,0.9)"; g.lineWidth = 10; g.strokeRect(8, 8, 240, 240);
    g.lineWidth = 7; for (let k = -256; k < 512; k += 36) { g.beginPath(); g.moveTo(k, 0); g.lineTo(k + 256, 256); g.stroke(); g.beginPath(); g.moveTo(k + 256, 0); g.lineTo(k, 256); g.stroke(); }
    const t = new T.CanvasTexture(c); return t;
  }
  // panneau du raccourci
  function signTexture(text, bg, fg) {
    const c = document.createElement("canvas"); c.width = 320; c.height = 120; const g = c.getContext("2d"); g.fillStyle = bg; g.fillRect(0, 0, 320, 120); g.strokeStyle = fg; g.lineWidth = 7; g.strokeRect(6, 6, 308, 108);
    g.fillStyle = fg; let fs = 46; g.font = "bold " + fs + "px system-ui, sans-serif"; while (g.measureText(text).width > 280 && fs > 18) { fs -= 2; g.font = "bold " + fs + "px system-ui, sans-serif"; } g.textAlign = "center"; g.textBaseline = "middle"; g.fillText(text, 160, 62); return new T.CanvasTexture(c);
  }
  function hazardTexture() {
    const c = document.createElement("canvas"); c.width = 256; c.height = 48; const g = c.getContext("2d"); g.fillStyle = "#ffcf33"; g.fillRect(0, 0, 256, 48); g.fillStyle = "#1c1c22";
    for (let i = -2; i < 12; i++) { g.beginPath(); g.moveTo(i * 28, 48); g.lineTo(i * 28 + 14, 48); g.lineTo(i * 28 + 62, 0); g.lineTo(i * 28 + 48, 0); g.closePath(); g.fill(); }
    return new T.CanvasTexture(c);
  }
  function labelTexture(text) {
    const c = document.createElement("canvas"); c.width = 256; c.height = 64; const g = c.getContext("2d"); g.fillStyle = "rgba(0,0,0,0.55)"; const r = 24; g.beginPath(); g.moveTo(r, 4); g.arcTo(252, 4, 252, 60, r); g.arcTo(252, 60, 4, 60, r); g.arcTo(4, 60, 4, 4, r); g.arcTo(4, 4, 252, 4, r); g.fill();
    g.fillStyle = "#fff"; g.font = "700 32px Fredoka, Trebuchet MS, sans-serif"; g.textAlign = "center"; g.textBaseline = "middle"; g.fillText(text, 128, 34); return new T.CanvasTexture(c);
  }

  // ---------- circuit ----------
  function clearTrack() {
    if (group) { scene.remove(group); group.traverse((o) => { if (o.geometry) o.geometry.dispose(); }); }
    group = new T.Group(); scene.add(group); gates = [];
    Object.values(View.cars).forEach((c) => scene.remove(c.root)); View.cars = {};
  }
  View.loadTrack = function (tr) {
    View.track = tr; const B = Track.BIOMES[tr.biome]; clearTrack();
    PicuiteGL.sky(scene, document.getElementById("gl-host"), B.sky[0], B.sky[1], T); postSky(B); clearMarks();
    scene.fog = new T.Fog(col(B.fog), 90, B.stars ? 420 : 380); hemi.color.set(B.amb); hemi.groundColor.set(B.ground); sun.color.set(B.sun);
    const n = tr.n, X = tr.x, Y = tr.y, Z = tr.z, H = tr.h, W = tr.w, FL = tr.flags, FG = Track.FLAG;
    // repère de chaque point. Au sol la droite est horizontale et le haut est vertical. Dans une zone sans gravité on prend le vrai repère 3D
    const MM = Track.magMap(tr).id; const RX = new Float32Array(n), RY = new Float32Array(n), RZ = new Float32Array(n), UX = new Float32Array(n), UY = new Float32Array(n), UZ = new Float32Array(n);
    for (let i = 0; i < n; i++) {
      const k = MM[i];
      if (k >= 0) { const fr = Track.frameAt(tr, tr.mags[k], i); RX[i] = fr.rx; RY[i] = fr.ry; RZ[i] = fr.rz; UX[i] = fr.ux; UY[i] = fr.uy; UZ[i] = fr.uz; }
      else { RX[i] = -Math.cos(H[i]); RY[i] = tr.bank ? tr.bank[i] : 0; RZ[i] = Math.sin(H[i]); UX[i] = 0; UY[i] = 1; UZ[i] = 0; }
    }
    // carrefours à niveau. Le second passage est posé un rien plus haut pour ne pas scintiller, et aucun mur ne barre le croisement
    const XS = new Uint8Array(n); (tr.xings || []).forEach((x) => { for (let i = Math.max(0, x.ja - 40); i <= Math.min(n - 1, x.jb + 40); i++) if (FL[i] & FG.XING) XS[i] = Math.abs(i - x.ja) <= Math.abs(i - x.jb) ? 1 : 2; });
    const XL = new Float32Array(n); for (let i = 0; i < n; i++) if (XS[i] === 2) XL[i] = 0.06;
    for (let i = 1; i < n - 1; i++) if (!XL[i] && (XS[i - 1] === 2 || XS[i + 1] === 2)) XL[i] = 0.03;
    // raccourcis. Les murs du détour que la voiture survole sont retirés
    const CS = new Uint8Array(n); (tr.cuts || []).forEach((c) => { const fx = Math.sin(c.h), fz = Math.cos(c.h); for (let i = c.lip; i <= c.land; i++) [1, -1].forEach((o, k) => { const px = X[i] + RX[i] * W[i] * o, pz = Z[i] + RZ[i] * W[i] * o; const d = (px - c.ax) * fx + (pz - c.az) * fz; const lat = Math.abs((px - c.ax) * -Math.cos(c.h) + (pz - c.az) * Math.sin(c.h) - (c.u0 + c.u1) / 2); if (d > -2 && d < c.D + 2 && lat < (c.u1 - c.u0) / 2 + 3.5) CS[i] |= 1 << k; }); });
    const hole = (i) => (FL[i] | FL[i + 1]) & FG.GAP, bare = (i) => (FL[i] | FL[i + 1]) & FG.NOWALL, inMag = (i) => MM[i] >= 0 || MM[i + 1] >= 0;
    const FM = Track.forkMap(tr), MV = Track.moverMap(tr), VW = tr.vw || new Array(n).fill(0);
    const inFork = (i) => FM[i] >= 0 && FM[i + 1] >= 0 && FM[i] === FM[i + 1];
    const moving = (i) => MV[i] >= 0 || MV[i + 1] >= 0;
    const roadCol = [col(B.road), col(B.road).multiplyScalar(1.2).lerp(col("#9a6a3a"), 0.55), col("#9fdcff"), col("#ff9a1a"), col("#7a6a3a"), col("#b45aff"), col(B.vergeCol || B.ground)];
    const magCol = col("#6a5ae0");
    const pos = [], cols = []; const quad = (a, b, c, d, color, arr, carr) => { arr.push(a[0], a[1], a[2], b[0], b[1], b[2], c[0], c[1], c[2], c[0], c[1], c[2], b[0], b[1], b[2], d[0], d[1], d[2]); for (let k = 0; k < 6; k++) carr.push(color.r, color.g, color.b); };
    const L = (i, o, up) => [X[i] + RX[i] * W[i] * o + UX[i] * (up || 0), Y[i] + XL[i] + RY[i] * W[i] * o + UY[i] * (up || 0), Z[i] + RZ[i] * W[i] * o + UZ[i] * (up || 0)];
    // point à la position latérale absolue u, avec une hauteur ajoutée
    const P = (i, u, up) => [X[i] + RX[i] * u, Y[i] + XL[i] + (MM[i] >= 0 ? 0 : RY[i] * u) + (up || 0), Z[i] + RZ[i] * u];
    const cc = new T.Color();
    const surfCol = (s, i) => { cc.copy(roadCol[s] || roadCol[0]).multiplyScalar(0.95 + 0.07 * (i % 2)); if (s === 3) cc.copy(i % 4 < 2 ? col("#ff9a1a") : col("#ffd84a")); if (s === 5) cc.copy(i % 4 < 2 ? col("#b45aff") : col("#ff7af0")); return cc; };
    // géométrie d'un embranchement à l'indice i, voies, terre-plein et hauteur de chaque voie
    const fgeo = (i) => { const f = tr.forks[FM[i]]; const g = Track.forkGeo(f, i); return { f, m: g.m, a0: g.a0, a1: g.a1, b0: g.b0, b1: g.b1, dA: Track.forkDy(f, 0, i), dB: Track.forkDy(f, 1, i) }; };
    for (let i = 0; i < n - 1; i++) {
      if (hole(i) || moving(i)) continue;
      const s = tr.surf[i]; surfCol(s, i);
      if (inMag(i)) cc.lerp(magCol, 0.38).multiplyScalar(i % 6 < 3 ? 1.12 : 0.9);
      if (inFork(i)) {
        const g0 = fgeo(i), g1 = fgeo(i + 1);
        if (g0.m < 0.05 && g1.m < 0.05) { quad(L(i, 1), L(i + 1, 1), L(i, -1), L(i + 1, -1), cc.clone(), pos, cols); continue; }
        const core = (FL[i] & FG.FORK) !== 0;
        [0, 1].forEach((k) => { const ln = g0.f.lanes[k]; const ls = core && ln.s ? ln.s : s; const c2 = surfCol(ls, i).clone(); const u0a = k ? g0.b0 : g0.a0, u1a = k ? g0.b1 : g0.a1, u0b = k ? g1.b0 : g1.a0, u1b = k ? g1.b1 : g1.a1, da = k ? g0.dB : g0.dA, db = k ? g1.dB : g1.dA; quad(P(i, u1a, da), P(i + 1, u1b, db), P(i, u0a, da), P(i + 1, u0b, db), c2, pos, cols); });
        // dessus du terre-plein
        if (g0.m > 0.05) { const gc = col(B.vergeCol || B.ground).multiplyScalar(0.92 + 0.06 * (i % 2)); const top = Math.min(g0.dA, g0.dB, g1.dA, g1.dB) + 0.25; quad(P(i, g0.b0, top), P(i + 1, g1.b0, top), P(i, g0.a1, top), P(i + 1, g1.a1, top), gc, pos, cols); }
        continue;
      }
      // droite a gauche. Le cap croissant tourne à gauche
      quad(L(i, 1), L(i + 1, 1), L(i, -1), L(i + 1, -1), cc.clone(), pos, cols);
      // bas-côtés
      if (VW[i] > 0.05 || VW[i + 1] > 0.05) { const vc = col(B.vergeCol || B.ground).multiplyScalar(0.9 + 0.08 * ((i >> 1) % 2)); [1, -1].forEach((o) => { const a1 = P(i, o * W[i], -0.04), b1 = P(i + 1, o * W[i + 1], -0.04), a2 = P(i, o * (W[i] + VW[i]), -0.04), b2 = P(i + 1, o * (W[i + 1] + VW[i + 1]), -0.04); if (o > 0) quad(a2, b2, a1, b1, vc, pos, cols); else quad(a1, b1, a2, b2, vc, pos, cols); }); }
    }
    const geo = new T.BufferGeometry(); geo.setAttribute("position", new T.Float32BufferAttribute(pos, 3)); geo.setAttribute("color", new T.Float32BufferAttribute(cols, 3)); geo.computeVertexNormals();
    const road = new T.Mesh(geo, new T.MeshStandardMaterial({ vertexColors: true, roughness: 0.9, flatShading: true, side: T.DoubleSide })); road.receiveShadow = true; group.add(road);
    // lignes de bord et ligne centrale
    const lp = [], lc = []; const white = col("#ffffff");
    for (let i = 0; i < n - 1; i++) {
      if (tr.surf[i] === 3 || tr.surf[i] === 5 || hole(i) || moving(i) || XS[i] === 1 || XS[i + 1] === 1) continue;
      if (inFork(i)) { const g0 = fgeo(i), g1 = fgeo(i + 1); if (g0.m > 0.05) { [[g0.a0 + 0.3, g1.a0 + 0.3, g0.dA, g1.dA], [g0.a1 - 0.3, g1.a1 - 0.3, g0.dA, g1.dA], [g0.b0 + 0.3, g1.b0 + 0.3, g0.dB, g1.dB], [g0.b1 - 0.3, g1.b1 - 0.3, g0.dB, g1.dB]].forEach(([ua, ub, da, db]) => quad(P(i, ua + 0.12, da + 0.03), P(i + 1, ub + 0.12, db + 0.03), P(i, ua - 0.12, da + 0.03), P(i + 1, ub - 0.12, db + 0.03), white, lp, lc)); continue; } }
      [0.93, -0.93].forEach((o) => { const a = L(i, o, 0.03), b = L(i + 1, o, 0.03); const a2 = L(i, o - Math.sign(o) * 0.05, 0.03), b2 = L(i + 1, o - Math.sign(o) * 0.05, 0.03); quad(a, b, a2, b2, white, lp, lc); });
      if (i % 4 < 2 && !inFork(i)) { const o = 0.012; quad(L(i, o, 0.03), L(i + 1, o, 0.03), L(i, -o, 0.03), L(i + 1, -o, 0.03), white, lp, lc); }
    }
    const lg = new T.BufferGeometry(); lg.setAttribute("position", new T.Float32BufferAttribute(lp, 3)); lg.setAttribute("color", new T.Float32BufferAttribute(lc, 3));
    group.add(new T.Mesh(lg, new T.MeshBasicMaterial({ vertexColors: true, side: T.DoubleSide, transparent: true, opacity: 0.7, depthWrite: false })));
    // murs de bord, jupes sous la route, dessous des ponts
    const wp = [], wc = []; const WH = 0.95; const skirt = col(B.road).multiplyScalar(0.55); const deck = col(B.road).multiplyScalar(0.42);
    const lowCol = col(tr.vergeK === "neige" ? "#ffffff" : tr.vergeK === "herbe" ? "#f4f4f0" : tr.vergeK === "sable" ? "#d9a860" : "#c8c8cc");
    // une route posée au-dessus d'une autre n'a pas de jupe jusqu'au sol, des piliers la portent
    // une portion de croisement bien au-dessus du sol est portée par des piliers, comme un pont
    const highArr = new Uint8Array(n); (tr.crosses || []).forEach((c) => { const base = Math.min(Y[c.a], Y[Math.min(n - 1, c.b)]); for (let i = c.a; i <= c.b && i < n; i++) if (Y[i] - base > 2.5) highArr[i] = 1; });
    const over = (i) => ((FL[i] | FL[i + 1]) & FG.OVER) || highArr[i];
    const wallSeg = (ua, ub, ya, yb, i, side, cA, h) => { // side 1 mur côté droit de la portion (u croissant), -1 côté gauche
      const a = P(i, ua, ya), b = P(i + 1, ub, yb), a2 = P(i, ua, ya + h), b2 = P(i + 1, ub, yb + h); const oa2 = P(i, ua + side * 0.35, ya + h), ob2 = P(i + 1, ub + side * 0.35, yb + h);
      if (side > 0) { quad(a, b, a2, b2, cA, wp, wc); quad(a2, b2, oa2, ob2, cA.clone().multiplyScalar(1.15), wp, wc); } else { quad(b, a, b2, a2, cA, wp, wc); quad(b2, a2, ob2, oa2, cA.clone().multiplyScalar(1.15), wp, wc); }
    };
    for (let i = 0; i < n - 1; i++) {
      if (hole(i) || moving(i)) continue;
      const cA = col(B.curb[Math.floor(i / 2) % 2]); const mag = inMag(i);
      if (inFork(i)) {
        const g0 = fgeo(i), g1 = fgeo(i + 1);
        if (g0.m >= 0.05 || g1.m >= 0.05) {
          wallSeg(g0.b1, g1.b1, g0.dB, g1.dB, i, 1, cA, WH); wallSeg(g0.a0, g1.a0, g0.dA, g1.dA, i, -1, cA, WH);
          if (g0.m >= 1.2 && g1.m >= 1.2) { wallSeg(g0.a1, g1.a1, g0.dA, g1.dA, i, 1, cA, 0.7); wallSeg(g0.b0, g1.b0, g0.dB, g1.dB, i, -1, cA, 0.7); }
          // flancs des voies surélevées et jupes extérieures
          [[g0.a0, g1.a0, -1], [g0.b1, g1.b1, 1]].forEach(([ua, ub, o]) => { const a = P(i, ua, 0), b = P(i + 1, ub, 0), gnd = [a[0], tr.groundY, a[2]], gnd2 = [b[0], tr.groundY, b[2]]; if (o > 0) quad(a, b, gnd, gnd2, skirt, wp, wc); else quad(b, a, gnd2, gnd, skirt, wp, wc); });
          [[g0.a1, g1.a1, g0.dA, g1.dA, 1], [g0.a0, g1.a0, g0.dA, g1.dA, -1], [g0.b0, g1.b0, g0.dB, g1.dB, -1], [g0.b1, g1.b1, g0.dB, g1.dB, 1]].forEach(([ua, ub, da, db, o]) => { if (da < 0.05 && db < 0.05) return; const a = P(i, ua, da), b = P(i + 1, ub, db), a0 = P(i, ua, 0), b0 = P(i + 1, ub, 0); if (o > 0) quad(a, b, a0, b0, deck, wp, wc); else quad(b, a, b0, a0, deck, wp, wc); });
          continue;
        }
      }
      if (bare(i)) { // pont sans rebord, on voit juste l'épaisseur de la dalle
        const e1 = L(i, 1), e2 = L(i + 1, 1), f1 = L(i, -1), f2 = L(i + 1, -1), e1d = L(i, 1, -0.8), e2d = L(i + 1, 1, -0.8), f1d = L(i, -1, -0.8), f2d = L(i + 1, -1, -0.8);
        quad(e1d, e2d, e1, e2, deck, wp, wc); quad(f2d, f1d, f2, f1, deck, wp, wc); quad(f1d, f2d, e1d, e2d, deck.clone().multiplyScalar(0.8), wp, wc);
        continue;
      }
      if (VW[i] > 0.3 && VW[i + 1] > 0.3) { // bas-côté, une clôture basse loin du bord
        [1, -1].forEach((o) => { const ua = o * (W[i] + VW[i]), ub = o * (W[i + 1] + VW[i + 1]); wallSeg(ua, ub, -0.04, -0.04, i, o, lowCol.clone().multiplyScalar(0.9 + 0.1 * ((i >> 1) % 2)), 0.55); const a = P(i, ua, -0.04), b = P(i + 1, ub, -0.04), gnd = [a[0], tr.groundY, a[2]], gnd2 = [b[0], tr.groundY, b[2]]; if (o > 0) quad(a, b, gnd, gnd2, skirt, wp, wc); else quad(b, a, gnd2, gnd, skirt, wp, wc); });
        continue;
      }
      [1, -1].forEach((o, ok) => {
        if (XS[i] || XS[i + 1] || ((CS[i] | CS[i + 1]) & (1 << ok))) { const oa = L(i, o * 1.04), ob = L(i + 1, o * 1.04); if (!mag && !over(i)) { const gnd = [oa[0], tr.groundY, oa[2]], gnd2 = [ob[0], tr.groundY, ob[2]]; if (o > 0) quad(oa, ob, gnd, gnd2, skirt, wp, wc); else quad(ob, oa, gnd2, gnd, skirt, wp, wc); } return; }
        const a = L(i, o), b = L(i + 1, o), a2 = L(i, o, WH), b2 = L(i + 1, o, WH);
        const oa = L(i, o * 1.04), ob = L(i + 1, o * 1.04), oa2 = L(i, o * 1.04, WH), ob2 = L(i + 1, o * 1.04, WH);
        if (o > 0) { quad(a, b, a2, b2, cA, wp, wc); quad(a2, b2, oa2, ob2, cA.clone().multiplyScalar(1.15), wp, wc); } else { quad(b, a, b2, a2, cA, wp, wc); quad(b2, a2, ob2, oa2, cA.clone().multiplyScalar(1.15), wp, wc); }
        if (!mag && !over(i)) { const gnd = [oa[0], tr.groundY, oa[2]], gnd2 = [ob[0], tr.groundY, ob[2]]; if (o > 0) quad(oa, ob, gnd, gnd2, skirt, wp, wc); else quad(ob, oa, gnd2, gnd, skirt, wp, wc); }
        if (over(i)) { const oad = L(i, o * 1.04, -0.9), obd = L(i + 1, o * 1.04, -0.9); if (o > 0) quad(oa, ob, oad, obd, deck, wp, wc); else quad(ob, oa, obd, oad, deck, wp, wc); }
      });
      if (mag) { quad(L(i, -1.04, -0.5), L(i + 1, -1.04, -0.5), L(i, 1.04, -0.5), L(i + 1, 1.04, -0.5), skirt, wp, wc); }
      if (over(i)) { quad(L(i, -1.04, -0.9), L(i + 1, -1.04, -0.9), L(i, 1.04, -0.9), L(i + 1, 1.04, -0.9), deck, wp, wc); }
    }
    const wg = new T.BufferGeometry(); wg.setAttribute("position", new T.Float32BufferAttribute(wp, 3)); wg.setAttribute("color", new T.Float32BufferAttribute(wc, 3)); wg.computeVertexNormals();
    const walls = new T.Mesh(wg, new T.MeshStandardMaterial({ vertexColors: true, roughness: 0.8, flatShading: true, side: T.DoubleSide })); walls.castShadow = View.quality !== "low"; group.add(walls);
    // piliers sous les ponts et sous les routes qui en survolent une autre, jamais posés sur la route du dessous
    { const pm = mat("#8a8a96"); const under = []; for (let j = 0; j < n; j++) if (FL[j] & FG.UNDER) under.push(j);
      const clearOf = (px, pz) => !under.some((j) => Math.hypot(X[j] - px, Z[j] - pz) < W[j] + 1.6);
      for (let i = 4; i < n - 4; i += 9) {
        if (hole(i) || MM[i] >= 0) continue; const isOver = (FL[i] & FG.OVER) || highArr[i]; if (!(FL[i] & FG.NOWALL) && !isOver) continue; const hh = Y[i] - tr.groundY - 0.8; if (hh < 2) continue;
        const spots = isOver ? [[X[i] + RX[i] * (W[i] + 0.4), Z[i] + RZ[i] * (W[i] + 0.4)], [X[i] - RX[i] * (W[i] + 0.4), Z[i] - RZ[i] * (W[i] + 0.4)]] : [[X[i], Z[i]]];
        spots.forEach(([px, pz]) => { if (isOver && !clearOf(px, pz)) return; group.add(mesh(G.cyl(isOver ? 0.7 : 0.9, isOver ? 0.85 : 1.1, hh, 8), pm, px, tr.groundY + hh / 2, pz)); });
      } }
    // sol
    const ground = new T.Mesh(new T.PlaneGeometry(4000, 4000), new T.MeshStandardMaterial({ color: col(B.ground), roughness: 1 })); ground.rotation.x = -Math.PI / 2; ground.position.set(0, tr.groundY, 0); ground.receiveShadow = true; group.add(ground);
    // routes qui bougent, un maillage refait à chaque image
    movers = (tr.movers || []).map((mv) => { const m = new T.Mesh(new T.BufferGeometry(), new T.MeshStandardMaterial({ vertexColors: true, roughness: 0.85, flatShading: true, side: T.DoubleSide })); m.receiveShadow = true; m.frustumCulled = false; group.add(m); return { mv, m, cA: B.curb.map((c) => col(c)), road: col(B.road), stripe: col("#ffb21a") }; });
    // tunnels, une voûte au-dessus de la route ou d'une seule voie d'embranchement
    { const tcol = col(B.id === "megapole" ? "#3a4a5e" : B.id === "jungle" ? "#2f7a3a" : B.id === "neige" ? "#cfe6f6" : B.id === "usine" ? "#5a5650" : B.id === "foraine" ? "#6a3a7a" : B.id === "dunes" ? "#c98e5a" : B.id === "neon" ? "#2a2470" : "#8a8f96");
      const lcol = col(B.id === "megapole" ? "#5affff" : B.id === "neon" ? "#ff4a8a" : B.id === "jungle" ? "#c8ff8a" : "#fff2b0");
      const tp = [], tc = []; const lights = [];
      (tr.tunnels || []).forEach((tu) => {
        for (let i = tu.a; i < tu.b && i < n - 1; i++) {
          let ua0, ua1, ub0, ub1, da = 0, db = 0; if (tu.lane >= 0 && FM[i] >= 0) { const g0 = fgeo(i), g1 = fgeo(i + 1); ua0 = tu.lane ? g0.b0 : g0.a0; ua1 = tu.lane ? g0.b1 : g0.a1; ub0 = tu.lane ? g1.b0 : g1.a0; ub1 = tu.lane ? g1.b1 : g1.a1; da = tu.lane ? g0.dB : g0.dA; db = tu.lane ? g1.dB : g1.dA; } else { ua0 = -W[i] - 0.4; ua1 = W[i] + 0.4; ub0 = -W[i + 1] - 0.4; ub1 = W[i + 1] + 0.4; }
          const SEG = 8; const ca = (ua0 + ua1) / 2, ra = (ua1 - ua0) / 2 + 0.3, cb = (ub0 + ub1) / 2, rb = (ub1 - ub0) / 2 + 0.3; const ha = Math.max(5.2, ra * 0.9), hb = Math.max(5.2, rb * 0.9);
          for (let q = 0; q < SEG; q++) { const t0 = Math.PI * q / SEG, t1 = Math.PI * (q + 1) / SEG; const pa0 = P(i, ca + Math.cos(t0) * ra, da + Math.sin(t0) * ha), pa1 = P(i, ca + Math.cos(t1) * ra, da + Math.sin(t1) * ha), pb0 = P(i + 1, cb + Math.cos(t0) * rb, db + Math.sin(t0) * hb), pb1 = P(i + 1, cb + Math.cos(t1) * rb, db + Math.sin(t1) * hb); quad(pa0, pb0, pa1, pb1, tcol.clone().multiplyScalar(0.85 + 0.15 * ((i >> 2) % 2)), tp, tc); }
          if ((i - tu.a) % 7 === 0) lights.push(P(i, ca, da + ha - 0.35));
        }
        // butte de terre collée à la voûte, elle suit la route et s'amincit aux deux bouts
        if (B.id !== "megapole" && B.id !== "usine" && tu.lane < 0) {
          const gcol = col(B.ground).multiplyScalar(0.82);
          for (let i = tu.a; i < tu.b && i < n - 1; i++) {
            const e0 = 1.5 * Math.min(1, Math.min(i - tu.a, tu.b - i) / 8), e1 = 1.5 * Math.min(1, Math.min(i + 1 - tu.a, tu.b - i - 1) / 8);
            const ra = W[i] + 0.7, rb = W[i + 1] + 0.7, ha = Math.max(5.2, ra * 0.9), hb = Math.max(5.2, rb * 0.9);
            for (let q = 0; q < 8; q++) { const t0 = Math.PI * q / 8, t1 = Math.PI * (q + 1) / 8; const pa0 = P(i, Math.cos(t0) * (ra + e0), Math.sin(t0) * (ha + e0) + 0.05), pa1 = P(i, Math.cos(t1) * (ra + e0), Math.sin(t1) * (ha + e0) + 0.05), pb0 = P(i + 1, Math.cos(t0) * (rb + e1), Math.sin(t0) * (hb + e1) + 0.05), pb1 = P(i + 1, Math.cos(t1) * (rb + e1), Math.sin(t1) * (hb + e1) + 0.05); quad(pa0, pb0, pa1, pb1, gcol.clone().multiplyScalar(0.92 + 0.08 * ((i >> 2) % 2)), tp, tc); }
          }
        }
      });
      if (tp.length) { const g2 = new T.BufferGeometry(); g2.setAttribute("position", new T.Float32BufferAttribute(tp, 3)); g2.setAttribute("color", new T.Float32BufferAttribute(tc, 3)); g2.computeVertexNormals(); const tm = new T.Mesh(g2, new T.MeshStandardMaterial({ vertexColors: true, roughness: 0.9, flatShading: true, side: T.DoubleSide })); tm.castShadow = false; tm.receiveShadow = false; group.add(tm); }
      const lm = new T.MeshBasicMaterial({ color: lcol }); lights.forEach((p) => group.add(new T.Mesh(G.box(1.6, 0.18, 0.6), lm).translateX(p[0]).translateY(p[1]).translateZ(p[2])));
    }
    // pastilles turbo
    const chev = chevTexture(); let i = 0;
    const chevSup = chevTexture("#b45aff", "#ffd0ff");
    while (i < n) { if (tr.flags[i] & 1) { let j = i; while (j < n && (tr.flags[j] & 1)) j++; const mid = Math.floor((i + j) / 2); const len = (j - i) * tr.step; const pl = new T.Mesh(new T.PlaneGeometry(tr.w[mid] * 1.5, len), new T.MeshBasicMaterial({ map: tr.surf[mid] === 5 ? chevSup : chev })); pl.rotation.x = -Math.PI / 2; const wr = new T.Object3D(); wr.position.set(tr.x[mid], tr.y[mid] + 0.06, tr.z[mid]); wr.rotation.y = tr.h[mid] + Math.PI; wr.add(pl); group.add(wr); i = j; } else i++; }
    // tapis turbo posés sur une seule voie
    { const chevS = chevTexture("#b45aff", "#ffd0ff"); (tr.pads || []).forEach((pd) => { const mid = Math.floor((pd.a + pd.b) / 2); const len = (pd.b - pd.a + 1) * tr.step; const fg = FM[mid] >= 0 ? fgeo(mid) : null; const lane = fg ? (pd.u0 < 0 ? fg.dA : fg.dB) : 0; const pl = new T.Mesh(new T.PlaneGeometry(pd.u1 - pd.u0, len), new T.MeshBasicMaterial({ map: pd.k === 2 ? chevS : chev })); pl.rotation.x = -Math.PI / 2; const wr = new T.Object3D(); const c = (pd.u0 + pd.u1) / 2; wr.position.set(tr.x[mid] + RX[mid] * c, tr.y[mid] + lane + 0.07, tr.z[mid] + RZ[mid] * c); wr.rotation.y = tr.h[mid] + Math.PI; wr.add(pl); group.add(wr); }); }
    // carrefours à niveau, hachures au milieu du croisement
    if ((tr.xings || []).length) { const jt = junctionTexture(); tr.xings.forEach((x) => { const i = x.ja; const sz = 2 * Math.max(W[x.ja], W[x.jb]) + 1; const pl = new T.Mesh(new T.PlaneGeometry(sz, sz), new T.MeshBasicMaterial({ map: jt, transparent: true, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -4, polygonOffsetUnits: -4 })); pl.rotation.x = -Math.PI / 2; const wr = new T.Object3D(); wr.position.set((X[x.ja] + X[x.jb]) / 2, Math.max(Y[x.ja], Y[x.jb]) + 0.1, (Z[x.ja] + Z[x.jb]) / 2); wr.rotation.y = H[i]; wr.add(pl); group.add(wr); }); }
    // raccourcis, un tremplin jaune et noir d'un seul côté de la route, et un panneau
    (tr.cuts || []).forEach((c) => {
      const i = c.lip; const wdt = c.u1 - c.u0, mid = (c.u0 + c.u1) / 2; const Lr = 7, Hr = 0.55; const tex = chevTexture("#ffcf33", "#1c1c22");
      const top = new T.Mesh(new T.PlaneGeometry(wdt, Math.hypot(Lr, Hr)), new T.MeshStandardMaterial({ map: tex, roughness: 0.7 })); top.rotation.x = -Math.PI / 2 + Math.atan2(Hr, Lr);
      const wr = new T.Object3D(); wr.position.set(X[i] + RX[i] * mid - Math.sin(H[i]) * Lr / 2, Y[i] + Hr / 2 + 0.02, Z[i] + RZ[i] * mid - Math.cos(H[i]) * Lr / 2); wr.rotation.y = H[i] + Math.PI; wr.add(top); top.castShadow = View.quality !== "low"; group.add(wr);
      const front = mesh(G.box(wdt, Hr, 0.25), mat("#1c1c22"), X[i] + RX[i] * mid, Y[i] + Hr / 2, Z[i] + RZ[i] * mid); front.rotation.y = H[i]; group.add(front);
      const side = c.u0 > 0 ? 1 : -1; const j = Math.max(0, i - 14); const su = side * (W[j] + 1.6); const post = mesh(G.box(0.18, 3.2, 0.18), mat("#4a4a52"), X[j] + RX[j] * su, Y[j] + 1.6, Z[j] + RZ[j] * su); group.add(post);
      const sign = new T.Mesh(new T.PlaneGeometry(3.4, 1.28), new T.MeshBasicMaterial({ map: signTexture("RACCOURCI ↑", "#ffcf33", "#1c1c22"), side: T.DoubleSide })); sign.position.set(X[j] + RX[j] * su, Y[j] + 3.4, Z[j] + RZ[j] * su); sign.rotation.y = H[j] + Math.PI; group.add(sign);
    });
    // anneaux turbo
    ringsM = (tr.rings || []).map((rg) => { const m = new T.Mesh(new T.TorusGeometry(rg.r, 0.26, 8, 30), new T.MeshStandardMaterial({ color: col("#ffcf33"), emissive: col("#ff9a1a"), emissiveIntensity: 0.9 })); const i = rg.i; m.position.set(tr.x[i] + RX[i] * rg.u, rg.y, tr.z[i] + RZ[i] * rg.u); m.rotation.y = tr.h[i]; group.add(m); const inner = new T.Mesh(new T.CircleGeometry(rg.r - 0.2, 24), new T.MeshBasicMaterial({ color: col("#ffd84a"), transparent: true, opacity: 0.12, side: T.DoubleSide, depthWrite: false })); inner.position.copy(m.position); inner.rotation.y = tr.h[i]; group.add(inner); return { m, inner, rg }; });
    // arches de départ, d'arrivée et points de contrôle
    const arch = (idx, text, a, b, color, isGate) => {
      const g = new T.Group(); const w = tr.w[idx] + 0.6; const h = isGate ? 6.2 : 7.2;
      [1, -1].forEach((o) => g.add(mesh(G.box(0.7, h, 0.7), mat(color), o * w, h / 2, 0)));
      if (isGate) { const ring = mesh(new T.TorusGeometry(w, 0.28, 6, 24, Math.PI), new T.MeshStandardMaterial({ color: col(color), emissive: col(color), emissiveIntensity: 0.8 }), 0, h - 0.2, 0); g.add(ring); g.userData.ring = ring; }
      else { const ban = mesh(G.box(w * 2, 1.5, 0.3), new T.MeshBasicMaterial({ map: bannerTexture(text, a, b) }), 0, h + 0.2, 0); g.add(ban); }
      g.position.set(tr.x[idx], tr.y[idx], tr.z[idx]); g.rotation.y = tr.h[idx] + Math.PI / 2 * 0; group.add(g); return g;
    };
    // les arches sont orientées pour que leur axe x soit la droite de la route
    const place = (g, idx) => { g.rotation.y = tr.h[idx]; };
    place(arch(tr.start.idx, "DÉPART", "#ffffff", "#222222", "#ffffff", false), tr.start.idx);
    place(arch(tr.n - 3, "ARRIVÉE", "#ffffff", "#222222", "#ffffff", false), tr.n - 3);
    tr.cps.forEach((c, k) => { const g = arch(c, "", "", "", "#33e0ff", true); place(g, c); g.userData.cp = k; gates.push(g); });
    // lignes peintes au départ et à l'arrivée
    { const ck = checkerTexture(); [tr.start.idx, tr.n - 3].forEach((idx) => { const pl = new T.Mesh(new T.PlaneGeometry(tr.w[idx] * 2 - 0.2, 3.2), new T.MeshBasicMaterial({ map: ck, transparent: true, opacity: 0.92 })); pl.rotation.x = -Math.PI / 2; const wr = new T.Object3D(); wr.position.set(tr.x[idx], tr.y[idx] + 0.07, tr.z[idx]); wr.rotation.y = tr.h[idx]; wr.add(pl); group.add(wr); }); }
    // obstacles posés sur la route
    (tr.obs || []).forEach((o) => {
      const g = new T.Group(); const ty = Track.OBS_IDS[o.t];
      if (ty === "cone") { g.add(mesh(G.cone(0.75, 1.5, 10), mat("#ff7a1a"), 0, 0.75, 0)); g.add(mesh(G.cyl(0.42, 0.5, 0.25, 10), mat("#ffffff"), 0, 0.62, 0)); g.add(mesh(G.box(1.5, 0.12, 1.5), mat("#2a2a30"), 0, 0.06, 0)); }
      else if (ty === "barrel") { g.add(mesh(G.cyl(1.0, 1.0, 1.7, 14), mat("#d93a3a"), 0, 0.85, 0)); [0.35, 1.35].forEach((y) => g.add(mesh(G.cyl(1.04, 1.04, 0.14, 14), mat("#f2f2f2"), 0, y, 0))); }
      else if (ty === "crate") { const sd = o.r * 1.3; g.add(mesh(G.box(sd, 2.0, sd), mat("#b07a3a"), 0, 1.0, 0)); g.add(mesh(G.box(sd + 0.12, 0.2, sd + 0.12), mat("#7a5224"), 0, 0.1, 0)); g.add(mesh(G.box(sd + 0.12, 0.2, sd + 0.12), mat("#7a5224"), 0, 1.9, 0)); g.add(mesh(G.box(0.2, 2.0, sd + 0.12), mat("#7a5224"), 0, 1.0, 0)); }
      else if (ty === "tires") { [0.2, 0.62, 1.04].forEach((y, k) => g.add(mesh(G.cyl(1.05 - k * 0.06, 1.05 - k * 0.06, 0.4, 14), mat(k === 1 ? "#f2f2f2" : "#26262c"), 0, y, 0))); }
      else if (ty === "rock") { const m = mesh(G.dodeca(1.5), mat(tr.biome === "volcan" ? "#4a3a40" : tr.biome === "desert" ? "#b08a5a" : "#7a7f88"), 0, 1.0, 0); m.scale.set(1, 0.85, 1); g.add(m); }
      else if (ty === "bale") { const m = mesh(G.cyl(1.25, 1.25, 1.5, 14), mat("#e2c25a"), 0, 0.75, 0); g.add(m); [-0.45, 0.45].forEach((y) => g.add(mesh(G.cyl(1.27, 1.27, 0.12, 14), mat("#8a5a2a"), 0, 0.75 + y, 0))); }
      else if (ty === "ice") { const m = mesh(G.dodeca(1.25), mat("#bfe8ff", { roughness: 0.25 }), 0, 1.0, 0); m.scale.set(1, 1.35, 1); g.add(m); g.add(mesh(G.cone(0.5, 1.2, 5), mat("#e6f6ff", { roughness: 0.25 }), 0.5, 2.2, 0.2)); }
      else if (ty === "nose") { const hz = hazardTexture(); hz.wrapS = T.RepeatWrapping; const blk = new T.Mesh(G.box(2.2, 1.3, 2.2), new T.MeshStandardMaterial({ map: hz, roughness: 0.6 })); blk.position.y = 0.65; g.add(blk); g.add(mesh(G.cone(1.0, 1.0, 4), mat("#ffcf33"), 0, 1.8, 0)); const sign = new T.Mesh(G.box(3.6, 1.0, 0.15), new T.MeshBasicMaterial({ map: bannerTexture("⇦  ⇨", "#ffcf33", "#1c1c22") })); sign.position.y = 3.0; g.add(sign); g.add(mesh(G.box(0.15, 2.5, 0.15), mat("#3a3a40"), 0, 1.6, 0)); }
      else if (ty === "crystal") { const c = tr.biome === "bonbons" ? "#ff9ad5" : tr.biome === "volcan" ? "#ff7a3a" : tr.biome === "neon" ? "#5affd8" : "#9ad8ff"; const em = { emissive: col(c), emissiveIntensity: 0.55 }; [[0, 0, 2.2, 0.55], [0.55, 0.2, 1.4, 0.4], [-0.5, -0.25, 1.1, 0.35]].forEach(([x, z, h, r]) => g.add(mesh(G.cone(r, h, 5), mat(c, em), x, h / 2, z))); }
      else { g.add(mesh(G.cyl(0.95, 1.05, 5, 10), mat("#9aa0aa"), 0, 2.5, 0)); g.add(mesh(G.cyl(1.2, 1.2, 0.5, 10), mat("#6a707a"), 0, 5.1, 0)); g.add(mesh(G.cyl(0.97, 1.07, 0.35, 10), mat("#ffcf33"), 0, 1.0, 0)); g.add(mesh(G.cyl(0.97, 1.07, 0.35, 10), mat("#ffcf33"), 0, 2.4, 0)); }
      g.position.set(o.x, o.y, o.z); g.rotation.y = ty === "nose" ? tr.h[o.i] : (o.i * 1.7) % 6.28; group.add(g);
    });
    // trous à franchir. Un portique d'avertissement avant l'élan et un tapis vert à la réception
    { const hz = hazardTexture();
      (tr.gaps || []).forEach((gp) => {
        const w = tr.w[gp.lip] + 0.6; const g = new T.Group();
        [1, -1].forEach((o) => g.add(mesh(G.box(0.6, 6.4, 0.6), mat("#ffcf33"), o * w, 3.2, 0)));
        g.add(mesh(G.box(w * 2, 1.1, 0.3), new T.MeshBasicMaterial({ map: hz }), 0, 6.4, 0));
        g.position.set(tr.x[gp.lip - 3], tr.y[gp.lip - 3], tr.z[gp.lip - 3]); g.rotation.y = tr.h[gp.lip - 3]; group.add(g);
        const pl = new T.Mesh(new T.PlaneGeometry(tr.w[gp.land] * 1.9, 7), new T.MeshBasicMaterial({ color: col("#4cff7a"), transparent: true, opacity: 0.4, depthWrite: false })); pl.rotation.x = -Math.PI / 2; const wr = new T.Object3D(); wr.position.set(tr.x[gp.land + 3], tr.y[gp.land + 3] + 0.08, tr.z[gp.land + 3]); wr.rotation.y = tr.h[gp.land + 3]; wr.add(pl); group.add(wr);
      }); }
    // entrées et sorties des zones sans gravité, avec des anneaux lumineux le long du parcours
    { const ringMat = new T.MeshStandardMaterial({ color: col("#b57aff"), emissive: col("#8a4aff"), emissiveIntensity: 0.9 }); const m4 = new T.Matrix4();
      (tr.mags || []).forEach((mg) => {
        const step = mg.k === "roll" ? 5 : 6;
        for (let i = mg.a; i <= mg.b; i += step) {
          const edge = i === mg.a || i + step > mg.b; const ring = new T.Mesh(new T.TorusGeometry(tr.w[i] + 0.9, edge ? 0.3 : 0.12, 6, 28), edge ? ringMat : new T.MeshStandardMaterial({ color: col("#7a6aff"), emissive: col("#5a4aff"), emissiveIntensity: 0.55, transparent: true, opacity: 0.8 }));
          const fr = Track.frameAt(tr, mg, i);
          const left = new T.Vector3(fr.ux, fr.uy, fr.uz).cross(new T.Vector3(fr.tx, fr.ty, fr.tz)).normalize(); m4.makeBasis(left, new T.Vector3(fr.ux, fr.uy, fr.uz), new T.Vector3(fr.tx, fr.ty, fr.tz));
          ring.quaternion.setFromRotationMatrix(m4); ring.position.set(tr.x[i], tr.y[i], tr.z[i]); group.add(ring);
        }
      }); }
    decorMesh = bakeDecor(tr.decor, tr.biome); group.add(decorMesh); trackside = buildTrackside(tr); if (trackside) group.add(trackside); buildSky(B, tr);
    if (B.stars) { const m = 500, p = new Float32Array(m * 3); for (let k = 0; k < m; k++) { const a = Math.random() * 6.28, b = Math.random() * 1.2 + 0.05, r = 600; p[k * 3] = Math.cos(a) * Math.cos(b) * r; p[k * 3 + 1] = Math.sin(b) * r; p[k * 3 + 2] = Math.sin(a) * Math.cos(b) * r; } const g = new T.BufferGeometry(); g.setAttribute("position", new T.BufferAttribute(p, 3)); stars = new T.Points(g, new T.PointsMaterial({ color: 0xffffff, size: 1.6, fog: false, sizeAttenuation: false })); group.add(stars); } else stars = null;
    camInit = false; View.resetFollow();
  };
  // ---------- ciel, horizon et ambiance ----------
  function sunTexture(hex) { const c = document.createElement("canvas"); c.width = c.height = 128; const g = c.getContext("2d"); const gr = g.createRadialGradient(64, 64, 4, 64, 64, 62); gr.addColorStop(0, "#ffffff"); gr.addColorStop(0.25, hex); gr.addColorStop(1, "rgba(255,255,255,0)"); g.fillStyle = gr; g.fillRect(0, 0, 128, 128); return new T.CanvasTexture(c); }
  function checkerTexture() { const c = document.createElement("canvas"); c.width = 256; c.height = 64; const g = c.getContext("2d"); for (let i = 0; i < 32; i++) for (let j = 0; j < 8; j++) { g.fillStyle = (i + j) % 2 ? "#ffffff" : "#15171f"; g.fillRect(i * 8, j * 8, 8, 8); } const t = new T.CanvasTexture(c); t.anisotropy = 4; return t; }
  const AMBIENT = { neige: { n: 220, color: "#ffffff", size: 0.35, vy: -3.2, drift: 1.4 }, jungle: { n: 110, color: "#eaff8a", size: 0.4, vy: 0.3, drift: 0.8 }, dunes: { n: 140, color: "#f6dca0", size: 0.3, vy: -0.2, drift: 5 }, foraine: { n: 120, color: "#ff8ac8", size: 0.45, vy: -1.4, drift: 0.9 }, usine: { n: 90, color: "#ffb84a", size: 0.25, vy: 1.6, drift: 0.6 }, megapole: { n: 50, color: "#ffffff", size: 0.22, vy: 0.2, drift: 1.6 }, neon: { n: 160, color: "#5affd8", size: 0.4, vy: 0.8, drift: 1.2 }, cote: { n: 60, color: "#ffffff", size: 0.25, vy: 0.2, drift: 2 } };
  function buildSky(B, tr) {
    sky = new T.Group(); group.add(sky); const lowQ = View.quality === "low";
    const sdir = new T.Vector3(0.55, 0.42, -0.5).normalize().multiplyScalar(470);
    const sunSp = new T.Sprite(new T.SpriteMaterial({ map: sunTexture(B.sun), transparent: true, fog: false, depthWrite: false, opacity: B.stars ? 0.55 : 0.95 })); sunSp.scale.set(B.stars ? 160 : 120, B.stars ? 160 : 120, 1); sunSp.position.copy(sdir); sky.add(sunSp);
    if (B.stars) { const pl = new T.Mesh(new T.SphereGeometry(1, 20, 14), new T.MeshBasicMaterial({ color: col("#7a5ae0"), fog: false })); pl.scale.set(70, 70, 70); pl.position.set(-300, 210, 380); sky.add(pl); const ring = new T.Mesh(new T.TorusGeometry(1.7, 0.06, 4, 40), new T.MeshBasicMaterial({ color: col("#5affd8"), fog: false })); ring.scale.set(70, 70, 70); ring.position.copy(pl.position); ring.rotation.x = 1.2; ring.rotation.y = 0.3; sky.add(ring); }
    const gcol = col(B.ground).lerp(col(B.fog), 0.45).multiplyScalar(0.8); const mr = mulberryJS(tr.n * 7 + 3);
    const mcount = lowQ ? 14 : 28; for (let i = 0; i < mcount; i++) { const a = (i / mcount) * 6.283 + mr() * 0.2; const r = 430 + mr() * 90; const h = 40 + mr() * 90 * (B.id === "desert" || B.id === "cote" ? 0.6 : 1); const w = 50 + mr() * 70;
      const city = B.id === "megapole" || B.id === "usine"; const m = new T.Mesh(city ? new T.BoxGeometry(w * 0.5, h * (B.id === "megapole" ? 2.2 : 1.1), w * 0.5) : new T.ConeGeometry(w, h, 5 + Math.floor(mr() * 3)), new T.MeshBasicMaterial({ color: (city ? col(B.id === "megapole" ? "#8aa6c0" : "#8a7a6e") : gcol).clone().multiplyScalar(0.85 + mr() * 0.3), fog: false })); m.position.set(Math.cos(a) * r, tr.groundY + (city ? h * (B.id === "megapole" ? 1.1 : 0.55) : h / 2) - 4, Math.sin(a) * r); m.rotation.y = mr() * 3; sky.add(m); if (B.id === "neige") { const cap = new T.Mesh(new T.ConeGeometry(w * 0.34, h * 0.34, 5), new T.MeshBasicMaterial({ color: col(B.id === "neige" ? "#ffffff" : "#ff7a3a"), fog: false })); cap.position.set(m.position.x, tr.groundY + h * 0.84 - 4, m.position.z); sky.add(cap); } }
    if (B.id === "foraine") { const wheel = new T.Mesh(new T.TorusGeometry(60, 2.5, 6, 40), new T.MeshBasicMaterial({ color: col("#ff6a9a"), fog: false })); wheel.position.set(-260, tr.groundY + 70, 330); wheel.rotation.y = 0.7; sky.add(wheel); }
    cloudsG = new T.Group(); sky.add(cloudsG); if (!B.stars) { const cc = col("#ffffff").lerp(col(B.amb), 0.25); const ccount = lowQ ? 8 : 16; for (let i = 0; i < ccount; i++) { const cl = new T.Group(); const puffs = 4 + Math.floor(mr() * 3); for (let k = 0; k < puffs; k++) { const m = new T.Mesh(new T.SphereGeometry(1, 7, 5), new T.MeshBasicMaterial({ color: cc, fog: false, transparent: true, opacity: 0.93 })); m.position.set((k - puffs / 2) * 1.3, mr() * 0.5, (mr() - 0.5) * 0.8); m.scale.set(1.2 + mr() * 0.7, 0.6 + mr() * 0.3, 0.9); cl.add(m); } const a = mr() * 6.283, r = 300 + mr() * 160; cl.position.set(Math.cos(a) * r, 80 + mr() * 90, Math.sin(a) * r); const sc = 14 + mr() * 16; cl.scale.set(sc, sc, sc); cloudsG.add(cl); } }
    // particules d'ambiance qui suivent la caméra
    const A = AMBIENT[B.id]; amb = null; if (A && View.quality !== "low") { const n = A.n; const p = new Float32Array(n * 3); for (let i = 0; i < n; i++) { p[i * 3] = (mr() - 0.5) * 90; p[i * 3 + 1] = mr() * 36; p[i * 3 + 2] = (mr() - 0.5) * 90; } const g = new T.BufferGeometry(); g.setAttribute("position", new T.BufferAttribute(p, 3)); amb = new T.Points(g, new T.PointsMaterial({ color: col(A.color), size: A.size, transparent: true, opacity: 0.85, depthWrite: false })); amb.frustumCulled = false; amb.userData = A; group.add(amb); }
  }
  function mulberryJS(a) { return function () { a |= 0; a = (a + 0x6d2b79f5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }
  View.flashGate = function (k) { const g = gates[k - 1]; if (g && g.userData.ring) { g.userData.ring.material.color.set("#7aff7a"); g.userData.ring.material.emissive.set("#2aff2a"); g.userData.flash = 1; } };
  View.resetGates = function () { gates.forEach((g) => { if (g.userData.ring) { g.userData.ring.material.color.set("#33e0ff"); g.userData.ring.material.emissive.set("#33e0ff"); } }); };

  // ---------- bord de piste, objets Kenney ----------
  // tribunes et tours à banderoles au départ, damiers à l'arrivée, réverbères en ville, tentes et panneaux à la fête et sur la côte
  function buildTrackside(tr) {
    const MD = window.ZoomModels && ZoomModels.ready ? ZoomModels : null; if (!MD || !MD.deco.grandStandCovered) return null;
    const g = new T.Group(); const n = tr.n, FL = tr.flags, FG = Track.FLAG; const VW = tr.vw || [];
    const bad = (i) => (FL[i] & (FG.MAG | FG.OVER | FG.UNDER | FG.NOWALL | FG.FORK | FG.XING | FG.CUT | FG.GAP | FG.TUNNEL | FG.MOVE | FG.BANK)) !== 0;
    const place = (k, i, side, off, face, s) => { const o = MD.decoObject(k); if (!o) return null; const u = side * (tr.w[i] + (VW[i] || 0) + off); o.position.set(tr.x[i] - Math.cos(tr.h[i]) * u, tr.y[i] - 0.05, tr.z[i] + Math.sin(tr.h[i]) * u); o.rotation.y = tr.h[i] + (face ? (side > 0 ? -Math.PI / 2 : Math.PI / 2) : 0); if (s) o.scale.setScalar(s); g.add(o); return o; };
    const B = tr.biome; const st = tr.start.idx;
    // départ
    [-1, 1].forEach((sd) => { const o = place(sd > 0 ? "bannerTowerRed" : "bannerTowerGreen", st + 6, sd, 1.4, false); });
    [16, 26].forEach((i) => { if (i < n - 10 && !bad(i)) place("grandStandCovered", i, (i === 16 ? 1 : -1) * (tr.biome === "neon" ? 1 : 1), 5.5, true, 1); });
    // arrivée
    [-1, 1].forEach((sd) => place("flagCheckers", n - 4, sd, 1.2, false));
    // réverbères tous les 80 m en ville et dans l'espace
    if (B === "megapole" || B === "neon" || B === "usine") { for (let i = 40; i < n - 20; i += 40) { if (bad(i)) continue; const o = place(B === "usine" ? "lightPostLarge" : "lightPostModern", i, (i / 40) % 2 ? 1 : -1, 1.1, true); if (o && B === "neon") o.traverse((m) => { if (m.isMesh) { m.material = m.material.clone(); m.material.emissive = new T.Color("#5affd8"); m.material.emissiveIntensity = 0.35; } }); } }
    // tentes et panneaux
    if (B === "foraine" || B === "cote") { [34, 46].forEach((i, k) => { if (i < n - 10 && !bad(i)) place("tent", i, k ? 1 : -1, 6, true); }); }
    if (B === "foraine" || B === "megapole" || B === "cote") { for (let i = 120; i < n - 40; i += 170) { if (bad(i)) continue; place("billboard", i, (i / 170) % 2 ? 1 : -1, 5, true, 1); } }
    g.traverse((m) => { if (m.isMesh) { m.castShadow = View.quality !== "low"; m.receiveShadow = true; } });
    return g;
  }
  // quand les modèles arrivent, les voitures et les décors déjà posés sont remplacés
  function onModelsReady() {
    if (View.track && group) { if (decorMesh) { group.remove(decorMesh); decorMesh.geometry.dispose(); } decorMesh = bakeDecor(View.track.decor, View.track.biome); group.add(decorMesh); if (trackside) group.remove(trackside); trackside = buildTrackside(View.track); if (trackside) group.add(trackside); }
    Object.keys(View.cars).forEach((id) => { const o = View.cars[id]; const c = makeCar(o.carId, o.hex, o.ghost, o.name); ["st", "tgt", "init", "rail", "air", "boost", "speed", "steer", "skid", "drTier", "draft", "hex", "name", "spin"].forEach((k) => { c[k] = o[k]; }); c.root.visible = o.root.visible; scene.remove(o.root); if (o.shadow) scene.remove(o.shadow); scene.add(c.root); if (c.shadow) scene.add(c.shadow); View.cars[id] = c; });
  }

  // ---------- voitures ----------
  function makeCar(carId, hex, ghost, name) {
    const root = new T.Group(); const body = col(hex); const tr = ghost ? { transparent: true, opacity: 0.42, depthWrite: false } : {};
    const M = (c, o) => new T.MeshStandardMaterial(Object.assign({ color: col(c), roughness: 0.55, metalness: 0.1, flatShading: true }, tr, o || {}));
    const mb = M(hex); const dark = M("#222a33"); const white = M("#f4f4f4"); const glass = M("#9fd8ff", { roughness: 0.2 });
    const add = (geo, m, x, y, z, rx, ry, rz) => { const o = new T.Mesh(geo, m); o.position.set(x, y, z); if (rx) o.rotation.x = rx; if (ry) o.rotation.y = ry; if (rz) o.rotation.z = rz; o.castShadow = !ghost; root.add(o); return o; };
    const wheels = [];
    const KM = window.ZoomModels && ZoomModels.ready ? ZoomModels.car(carId, hex, ghost) : null;
    if (KM) { root.add(KM.root); KM.wheels.forEach((w) => wheels.push(w)); return finishCar(root, wheels, carId, ghost, name, KM.len, M, mb, dark); }
    const wheel = (x, y, z, r, wd) => { const w = new T.Mesh(G.cyl(r, r, wd, 10), dark); w.rotation.z = Math.PI / 2; w.castShadow = !ghost; const hub = new T.Mesh(G.cyl(r * 0.55, r * 0.55, wd * 1.05, 6), white); hub.rotation.z = Math.PI / 2; hub.position.x = Math.sign(x) * 0.02; const holder = new T.Group(); holder.rotation.order = "YXZ"; holder.position.set(x, y, z); holder.add(w); holder.add(hub); root.add(holder); wheels.push({ holder, front: z > 0 }); return w; };
    if (carId === "rallye") { add(G.box(2.1, 0.8, 4.0), mb, 0, 0.85, 0); add(G.box(1.8, 0.7, 2.0), glass, 0, 1.55, -0.2); add(G.box(1.9, 0.12, 2.1), white, 0, 1.95, -0.2); add(G.box(1.6, 0.18, 0.4), dark, 0, 1.2, 1.95); [[1.1, 1.3], [-1.1, 1.3], [1.1, -1.3], [-1.1, -1.3]].forEach(([x, z]) => wheel(x, 0.55, z, 0.55, 0.45)); for (let i = -1; i <= 1; i += 2) add(G.sph(0.14, 6, 5), M("#fff3a0", { emissive: col("#ffe060"), emissiveIntensity: 0.8 }), i * 0.55, 1.6, 2.0); }
    else if (carId === "petard") { add(G.box(1.6, 0.55, 4.6), mb, 0, 0.6, 0); const nose = add(G.cone(0.8, 1.6, 8), mb, 0, 0.6, 3.0); nose.rotation.x = Math.PI / 2; add(G.box(0.9, 0.5, 1.5), glass, 0, 1.0, -0.2); add(G.box(0.18, 1.4, 1.4), white, 0, 1.2, -2.2); add(G.box(2.6, 0.14, 0.7), dark, 0, 1.8, -2.3); [[1.0, 1.8], [-1.0, 1.8], [1.05, -1.8], [-1.05, -1.8]].forEach(([x, z]) => wheel(x, 0.45, z, 0.45, 0.5)); }
    else if (carId === "toupie") { add(G.cyl(1.5, 1.6, 0.6, 14), mb, 0, 0.6, 0); const dome = add(new T.SphereGeometry(1.0, 12, 8, 0, Math.PI * 2, 0, Math.PI / 2), glass, 0, 0.9, 0.1); dome.scale.set(1, 0.9, 1.1); add(G.cyl(0.35, 0.35, 0.3, 8), white, 0, 1.0, -1.0); [[1.35, 1.0], [-1.35, 1.0], [1.35, -1.0], [-1.35, -1.0]].forEach(([x, z]) => wheel(x, 0.4, z, 0.4, 0.4)); }
    else if (carId === "bouboule") { const s = add(G.sph(1.25, 14, 10), mb, 0, 1.15, 0); s.scale.set(1, 0.85, 1.25); const dome = add(G.sph(0.8, 10, 8), glass, 0, 1.75, 0.2); dome.scale.set(1, 0.7, 1); [[1.15, 1.0], [-1.15, 1.0], [1.15, -1.0], [-1.15, -1.0]].forEach(([x, z]) => wheel(x, 0.5, z, 0.5, 0.45)); add(G.sph(0.2, 6, 5), white, 0.5, 1.05, 1.5); add(G.sph(0.2, 6, 5), white, -0.5, 1.05, 1.5); }
    else if (carId === "mastodonte") { add(G.box(2.4, 1.0, 4.4), mb, 0, 1.0, 0); add(G.box(1.8, 0.9, 1.7), glass, 0, 1.9, -0.5); add(G.box(2.5, 0.35, 0.5), dark, 0, 0.75, 2.35); add(G.box(0.25, 1.0, 0.25), dark, 0.8, 2.0, 1.1); add(G.box(0.25, 1.0, 0.25), dark, -0.8, 2.0, 1.1); [[1.25, 1.5], [-1.25, 1.5], [1.25, -1.4], [-1.25, -1.4]].forEach(([x, z]) => wheel(x, 0.8, z, 0.8, 0.7)); }
    else if (carId === "libellule") { add(G.box(1.3, 0.4, 4.0), mb, 0, 0.55, 0); add(G.sph(0.7, 10, 8), glass, 0, 0.95, 0.2).scale.set(1, 0.7, 1.5); add(G.box(3.3, 0.06, 0.9), mb, 0, 0.9, -1.4); add(G.box(0.1, 0.5, 0.9), mb, 1.6, 1.1, -1.4); add(G.box(0.1, 0.5, 0.9), mb, -1.6, 1.1, -1.4); add(G.cone(0.5, 1.2, 8), mb, 0, 0.55, 2.5).rotation.x = Math.PI / 2; [[0.95, 1.5], [-0.95, 1.5], [0.95, -1.4], [-0.95, -1.4]].forEach(([x, z]) => wheel(x, 0.38, z, 0.38, 0.34)); }
    else if (carId === "volt") { add(G.box(2.0, 0.42, 4.4), mb, 0, 0.55, 0); const nose = add(G.box(1.9, 0.3, 1.2), mb, 0, 0.5, 2.4); nose.rotation.x = 0.18; add(G.box(1.5, 0.42, 1.9), glass, 0, 0.95, -0.3); const glow = M("#9ff0ff", { emissive: col("#3ad8ff"), emissiveIntensity: 1 }); [-1, 1].forEach((sx) => add(G.box(0.08, 0.08, 4.2), glow, sx * 1.01, 0.62, 0)); const bolt = add(G.box(0.25, 0.04, 1.1), M("#ffe23a", { emissive: col("#ffcf1a"), emissiveIntensity: 0.6 }), 0, 0.78, 1.2); bolt.rotation.y = 0.5; add(G.box(2.0, 0.08, 0.5), dark, 0, 1.05, -2.1); [[1.05, 1.45], [-1.05, 1.45], [1.05, -1.45], [-1.05, -1.45]].forEach(([x, z]) => wheel(x, 0.45, z, 0.45, 0.4)); }
    else if (carId === "sauterelle") { add(G.box(1.3, 0.55, 3.4), mb, 0, 1.25, 0); add(G.sph(0.65, 10, 8), glass, 0, 1.7, 0.4).scale.set(1, 0.8, 1.3); const leg = M("#4a6a2a"); [[0.95, 1.3], [-0.95, 1.3], [0.95, -1.3], [-0.95, -1.3]].forEach(([x, z]) => { const st = add(G.box(0.12, 0.9, 0.12), leg, x * 0.75, 0.95, z); st.rotation.z = x > 0 ? -0.4 : 0.4; wheel(x, 0.58, z, 0.58, 0.32); }); [-1, 1].forEach((sx) => { const w = add(G.box(1.6, 0.05, 1.4), M("#b8f07a", { transparent: true, opacity: 0.75 }), sx * 1.2, 1.7, -0.9); w.rotation.z = sx * 0.35; }); [-0.25, 0.25].forEach((sx) => { const a = add(G.cyl(0.03, 0.03, 1.4, 4), dark, sx, 2.2, 1.4); a.rotation.x = -0.6; }); }
    else if (carId === "comete") { const b = add(G.sph(1.0, 12, 10), mb, 0, 0.85, 0.7); b.scale.set(1.05, 0.6, 1.6); add(G.box(1.5, 0.5, 2.2), mb, 0, 0.75, -1.0); add(G.sph(0.6, 10, 8), glass, 0, 1.25, 0.5).scale.set(1, 0.6, 1.4); [-1, 1].forEach((sx) => { const f = add(G.box(0.08, 0.9, 1.3), M("#ffd23f"), sx * 0.7, 1.25, -1.8); f.rotation.x = -0.4; }); add(G.cone(0.45, 1.1, 8), M("#ffb3dc", { emissive: col("#ff5ab4"), emissiveIntensity: 0.7 }), 0, 0.8, -2.5).rotation.x = -Math.PI / 2; [[1.0, 1.3], [-1.0, 1.3], [1.0, -1.4], [-1.0, -1.4]].forEach(([x, z]) => wheel(x, 0.45, z, 0.45, 0.42)); }
    else { add(G.box(2.0, 0.5, 4.2), mb, 0, 0.62, 0); add(G.box(1.45, 0.45, 1.7), glass, 0, 1.05, -0.35); add(G.box(1.2, 0.1, 0.5), dark, 0, 1.35, -2.0); add(G.box(0.12, 0.45, 0.12), dark, 0.7, 1.1, -1.9); add(G.box(0.12, 0.45, 0.12), dark, -0.7, 1.1, -1.9); add(G.box(1.9, 0.12, 0.9), dark, 0, 0.4, 2.1); [[1.05, 1.4], [-1.05, 1.4], [1.05, -1.4], [-1.05, -1.4]].forEach(([x, z]) => wheel(x, 0.48, z, 0.48, 0.42)); }
    // feux avant et arrière, et bandes de course
    { const D = { rallye: [2.0, -2.0, 0.95, 0.7], petard: [3.0, -2.3, 0.65, 0.5], toupie: [1.55, -1.5, 0.65, 0.8], bouboule: [1.5, -1.4, 1.0, 0.6], mastodonte: [2.3, -2.25, 1.05, 0.9], libellule: [2.6, -2.0, 0.55, 0.45], volt: [2.95, -2.2, 0.55, 0.75], sauterelle: [1.72, -1.7, 1.25, 0.45], comete: [2.25, -2.1, 0.8, 0.55], bolide: [2.1, -2.1, 0.62, 0.8] }[carId] || [2.1, -2.1, 0.62, 0.8];
      const head = M("#fff6c0", { emissive: col("#ffe890"), emissiveIntensity: 0.9 }), tail = M("#ff3030", { emissive: col("#ff1010"), emissiveIntensity: 0.9 });
      [-1, 1].forEach((sx) => { add(G.box(0.3, 0.14, 0.08), head, sx * D[3], D[2], D[0] + 0.02); add(G.box(0.34, 0.14, 0.08), tail, sx * D[3], D[2], D[1] - 0.02); });
      if (carId === "bolide" || carId === "petard") [-0.3, 0.3].forEach((sx) => add(G.box(0.18, 0.02, carId === "bolide" ? 3.6 : 3.9), white, sx, carId === "bolide" ? 0.89 : 0.9, carId === "bolide" ? 0 : 0.3)); }
    return finishCar(root, wheels, carId, ghost, name, 0, M, mb, dark);
  }
  // flamme de turbo, nom et ombre, communs aux deux sortes de voitures. Les modèles Kenney gardent quelques signes distinctifs de chaque voiture
  function finishCar(root, wheels, carId, ghost, name, len, M, mb, dark) {
    const add = (geo, m, x, y, z) => { const o = new T.Mesh(geo, m); o.position.set(x, y, z); o.castShadow = !ghost; root.add(o); return o; };
    if (len) {
      const back = -len / 2;
      if (carId === "volt") { const glow = M("#9ff0ff", { emissive: col("#3ad8ff"), emissiveIntensity: 1.2 }); [-1, 1].forEach((sx) => add(G.box(0.07, 0.07, len * 0.8), glow, sx * 1.04, 0.55, 0)); }
      if (carId === "comete") { const c2 = add(G.cone(0.42, 1.0, 8), M("#ffb3dc", { emissive: col("#ff5ab4"), emissiveIntensity: 0.9 }), 0, 0.85, back - 0.35); c2.rotation.x = -Math.PI / 2; }
      if (carId === "sauterelle") [-1, 1].forEach((sx) => { const w = add(G.box(1.5, 0.05, 1.3), M("#b8f07a", { transparent: true, opacity: 0.7 }), sx * 1.25, 1.75, -0.4); w.rotation.z = sx * 0.35; });
      if (carId === "libellule") { add(G.box(2.6, 0.06, 0.6), mb, 0, 1.45, back + 0.5); }
    }
    const flame = new T.Mesh(G.cone(0.5, 2.2, 8), new T.MeshBasicMaterial({ color: 0xffb02a, transparent: true, opacity: 0.85 })); flame.rotation.x = -Math.PI / 2; flame.position.set(0, 0.7, len ? -len / 2 - 1.0 : -3.1); flame.visible = false; root.add(flame);
    let label = null; if (name) { label = new T.Sprite(new T.SpriteMaterial({ map: labelTexture(name), depthTest: false, transparent: true })); label.scale.set(4.2, 1.05, 1); label.position.y = 3.3; label.renderOrder = 10; root.add(label); }
    const shadow = ghost ? null : new T.Mesh(new T.CircleGeometry(1.8, 14), new T.MeshBasicMaterial({ color: 0, transparent: true, opacity: 0.28, depthWrite: false })); if (shadow) { shadow.rotation.x = -Math.PI / 2; }
    return { root, wheels, flame, label, shadow, carId, ghost, st: { x: 0, y: 0, z: 0, h: 0, p: 0 }, tgt: null, spin: 0, speed: 0, model: !!len, len: len || 4.2 };
  }
  View.ensureCar = function (id, carId, hex, ghost, name) {
    let c = View.cars[id]; if (c && (c.carId !== carId || c.hex !== hex || c.ghost !== ghost || c.name !== name)) { scene.remove(c.root); if (c.shadow) scene.remove(c.shadow); c = null; }
    if (!c) { c = makeCar(carId, hex, ghost, name); c.hex = hex; c.name = name; try { const cd = window.ZoomCar && ZoomCar.CARS[carId]; c.vmax = cd ? cd.vmax : 52; } catch (e) { c.vmax = 52; } scene.add(c.root); if (c.shadow) scene.add(c.shadow); View.cars[id] = c; c.root.visible = false; }
    return c;
  };
  View.removeCar = function (id) { const c = View.cars[id]; if (c) { scene.remove(c.root); if (c.shadow) scene.remove(c.shadow); delete View.cars[id]; } };
  View.removeAllCars = function () { Object.keys(View.cars).forEach(View.removeCar); };
  View.setCarState = function (id, s, snap) {
    const c = View.cars[id]; if (!c) return; c.root.visible = true;
    if (snap || !c.init) { c.st = { x: s.x, y: s.y, z: s.z, h: s.h, p: s.p || 0 }; c.init = true; } else { c.st = { x: s.x, y: s.y, z: s.z, h: s.h, p: s.p || 0 }; }
    const rl = s.a === 2; if (rl !== !!c.rail) { c.rail = rl; c.st.h = s.h; } c.st.i = s.i || 0; c.air = s.a === 1 || s.a === true; c.boost = !!s.b; c.speed = s.speed || 0; c.steer = s.steer || 0; c.skid = s.skid || 0; c.drTier = s.dt || 0; c.draft = s.dr || 0;
  };
  View.setCarTarget = function (id, s) { const c = View.cars[id]; if (!c) return; c.tgt = s; const rl = s.a === 2; if (!c.init || rl !== !!c.rail) { c.st = { x: s.x, y: s.y, z: s.z, h: s.h, p: s.p || 0, i: s.i || 0 }; c.init = true; } c.rail = rl; c.root.visible = true; c.air = s.a === 1 || s.a === true; c.boost = !!s.b; };
  View.hideCar = function (id) { const c = View.cars[id]; if (c) { c.root.visible = false; c.init = false; if (c.shadow) c.shadow.visible = false; } };

  // ---------- route qui bouge, maillage recalculé à chaque image ----------
  function buildMover(mo, t) {
    const tr = View.track, mv = mo.mv; const a = Math.max(0, mv.a - 1), b = Math.min(tr.n - 1, mv.b + 1); const pos = mo.pos || (mo.pos = new Float32Array((b - a) * 18 * 7)), colr = mo.col || (mo.col = new Float32Array((b - a) * 18 * 7)); let k = 0;
    const put = (p, c) => { pos[k] = p[0]; pos[k + 1] = p[1]; pos[k + 2] = p[2]; colr[k] = c.r; colr[k + 1] = c.g; colr[k + 2] = c.b; k += 3; };
    const quad = (A, B2, C, D, c) => { put(A, c); put(B2, c); put(C, c); put(C, c); put(B2, c); put(D, c); };
    const Pt = (i, u, up) => { const dy = Track.moverDy(mv, i, t); return [tr.x[i] - Math.cos(tr.h[i]) * u, tr.y[i] + dy + (up || 0), tr.z[i] + Math.sin(tr.h[i]) * u]; };
    const rc = new T.Color(), cc2 = new T.Color();
    for (let i = a; i < b; i++) {
      const w0 = tr.w[i], w1 = tr.w[i + 1]; rc.copy(mo.road).multiplyScalar(0.95 + 0.07 * (i % 2)); if ((i >> 2) % 3 === 0) rc.lerp(mo.stripe, 0.25);
      quad(Pt(i, w0), Pt(i + 1, w1), Pt(i, -w0), Pt(i + 1, -w1), rc);
      cc2.copy(mo.cA[Math.floor(i / 2) % 2]);
      [1, -1].forEach((o) => { const A = Pt(i, o * w0), B2 = Pt(i + 1, o * w1), A2 = Pt(i, o * w0, 0.95), B3 = Pt(i + 1, o * w1, 0.95); if (o > 0) quad(A, B2, A2, B3, cc2); else quad(B2, A, B3, A2, cc2); const Ad = Pt(i, o * w0, -1.2), Bd = Pt(i + 1, o * w1, -1.2); if (o > 0) quad(A, B2, Ad, Bd, mo.road); else quad(B2, A, Bd, Ad, mo.road); });
    }
    const g = mo.m.geometry; if (!g.attributes.position) { g.setAttribute("position", new T.BufferAttribute(pos, 3)); g.setAttribute("color", new T.BufferAttribute(colr, 3)); } g.setDrawRange(0, k / 3); g.attributes.position.needsUpdate = true; g.attributes.color.needsUpdate = true; g.computeVertexNormals();
  }
  View.moverClock = null;

  // ---------- particules ----------
  const pGeo = new T.SphereGeometry(0.16, 5, 4);
  function puff(x, y, z, color, n, speed, up, size) {
    let last = null;
    for (let i = 0; i < n; i++) {
      let p = particles.find((q) => !q.alive);
      if (!p) { if (particles.length > 200) return; p = { mesh: new T.Mesh(pGeo, new T.MeshBasicMaterial({ color: 0xffffff, transparent: true, depthWrite: false })), alive: false, v: new T.Vector3(), life: 0 }; scene.add(p.mesh); particles.push(p); }
      p.alive = true; p.life = p.max = 0.4 + Math.random() * 0.5; p.mesh.visible = true; p.mesh.material.color.set(color); p.alpha = 0.8; p.grav = 1.2; p.grow = 0.8; p.mesh.material.blending = T.NormalBlending; p.mesh.position.set(x, y, z); p.mesh.scale.setScalar((size || 1) * (0.6 + Math.random() * 0.8));
      const a = Math.random() * 6.28, s = speed * (0.4 + Math.random() * 0.8); p.v.set(Math.cos(a) * s, up * (0.5 + Math.random()), Math.sin(a) * s); last = p;
    }
    return last;
  }
  View.puff = puff;
  // poussière discrète derrière les roues, petite, basse et transparente pour ne jamais cacher la route
  function dust(x, y, z, color, size) { const p = puff(x, y, z, color, 1, 0.9, 0.5, size || 1.1); if (p) { p.alpha = 0.26; p.max = p.life = 0.45 + Math.random() * 0.3; p.grow = 0.35; p.grav = 0.3; } }
  // étincelles d'un choc contre un mur, petites, vives et retombant vite
  const sGeo = new T.BoxGeometry(0.07, 0.07, 0.38);
  View.sparks = function (x, y, z, nx, nz, n) {
    for (let i = 0; i < (n || 12); i++) {
      let p = particles.find((q) => !q.alive && q.spark); if (!p) { if (particles.length > 260) return; p = { mesh: new T.Mesh(sGeo, new T.MeshBasicMaterial({ color: 0xffd060, transparent: true, depthWrite: false, blending: T.AdditiveBlending })), alive: false, v: new T.Vector3(), life: 0, spark: true }; scene.add(p.mesh); particles.push(p); }
      p.alive = true; p.max = p.life = 0.25 + Math.random() * 0.3; p.mesh.visible = true; p.mesh.material.color.set(Math.random() < 0.5 ? "#ffe680" : "#ff9a2a"); p.mesh.position.set(x, y, z); p.mesh.scale.setScalar(1); p.alpha = 1; p.grav = -11; p.grow = 0;
      const sp = 5 + Math.random() * 7; p.v.set(nx * sp * 0.6 + (Math.random() - 0.5) * 6, 2 + Math.random() * 4, nz * sp * 0.6 + (Math.random() - 0.5) * 6); p.mesh.lookAt(x + p.v.x, y + p.v.y, z + p.v.z);
    }
  };
  // traces de pneus qui restent sur la route, une bande sombre par roue arrière tant que la voiture glisse
  const MK_N = 1400; let mkGeo = null, mkMesh = null, mkPos = null, mkCol = null, mkHead = 0;
  function ensureMarks() {
    if (mkMesh) return; mkGeo = new T.BufferGeometry(); mkPos = new Float32Array(MK_N * 6 * 3); mkCol = new Float32Array(MK_N * 6 * 3); mkGeo.setAttribute("position", new T.BufferAttribute(mkPos, 3)); mkGeo.setAttribute("color", new T.BufferAttribute(mkCol, 3));
    mkMesh = new T.Mesh(mkGeo, new T.MeshBasicMaterial({ vertexColors: true, transparent: true, opacity: 0.5, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -3, polygonOffsetUnits: -3, side: T.DoubleSide })); mkMesh.frustumCulled = false; mkMesh.renderOrder = 1; scene.add(mkMesh);
  }
  function clearMarks() { if (mkPos) { mkPos.fill(0); mkGeo.attributes.position.needsUpdate = true; } mkHead = 0; Object.values(View.cars).forEach((c) => { c.mk = null; }); }
  function addMark(a, b, wa, wb, color) {
    ensureMarks(); const k = (mkHead % MK_N) * 18; mkHead++; const dx = b[0] - a[0], dz = b[2] - a[2]; const l = Math.hypot(dx, dz) || 1; const px = -dz / l, pz = dx / l;
    const A1 = [a[0] + px * wa, a[1], a[2] + pz * wa], A2 = [a[0] - px * wa, a[1], a[2] - pz * wa], B1 = [b[0] + px * wb, b[1], b[2] + pz * wb], B2 = [b[0] - px * wb, b[1], b[2] - pz * wb];
    [A1, B1, A2, A2, B1, B2].forEach((P, j) => { mkPos[k + j * 3] = P[0]; mkPos[k + j * 3 + 1] = P[1]; mkPos[k + j * 3 + 2] = P[2]; mkCol[k + j * 3] = color.r; mkCol[k + j * 3 + 1] = color.g; mkCol[k + j * 3 + 2] = color.b; });
    mkGeo.attributes.position.needsUpdate = true; mkGeo.attributes.color.needsUpdate = true;
  }
  const MK_ASPH = new T.Color("#141418"), MK_DIRT = new T.Color("#5a4026"), MK_SNOW = new T.Color("#8a9aaa");
  // sol sous une voiture, d'après le circuit. 0 bitume, 1 terre, 2 glace, 6 bas-côté
  function groundOf(c) { const tr = View.track; const i = Math.max(0, Math.min(tr.n - 1, Math.round(c.st.i || 0))); const s = c.st; const u = (s.x - tr.x[i]) * -Math.cos(tr.h[i]) + (s.z - tr.z[i]) * Math.sin(tr.h[i]); if (tr.vw && tr.vw[i] > 0.3 && Math.abs(u) > tr.w[i] - 0.25) return 6; return tr.surf[i]; }
  function carFx(c, dt) {
    const s = c.st; if (c.ghost || c.air || c.rail || !c.root.visible) { c.mk = null; return; } const spd = Math.abs(c.speed || 0); const tr = View.track; const B = Track.BIOMES[tr.biome];
    const gnd = groundOf(c); const fx = Math.sin(s.h), fz = Math.cos(s.h), rx = -Math.cos(s.h), rz = Math.sin(s.h); const back = (c.len || 4.2) / 2 - 0.5;
    // poussière sur la terre, le sable, l'herbe et la neige des bas-côtés
    if ((gnd === 1 || gnd === 6) && spd > 9 && Math.random() < Math.min(0.4, spd / 90)) { const o = Math.random() < 0.5 ? 1 : -1; dust(s.x - fx * back + rx * o * 0.8, s.y + 0.25, s.z - fz * back + rz * o * 0.8, gnd === 6 ? (B.vergeCol || "#e8d4a0") : "#a8865a", 0.9 + Math.min(0.5, spd / 100)); }
    // traces de pneus
    const marking = (c.skid > 0.5 || c.drTier > 0) && spd > 6 && gnd !== 6;
    if (!marking) { c.mk = null; return; }
    const col2 = gnd === 1 ? MK_DIRT : gnd === 2 ? MK_SNOW : MK_ASPH; const y = s.y + 0.04;
    const L = [s.x - fx * back + rx * 0.82, y, s.z - fz * back + rz * 0.82], R = [s.x - fx * back - rx * 0.82, y, s.z - fz * back - rz * 0.82];
    if (c.mk && Math.hypot(L[0] - c.mk[0][0], L[2] - c.mk[0][2]) > 0.6) { if (Math.hypot(L[0] - c.mk[0][0], L[2] - c.mk[0][2]) < 4) { addMark(c.mk[0], L, 0.17, 0.17, col2); addMark(c.mk[1], R, 0.17, 0.17, col2); } c.mk = [L, R]; } else if (!c.mk) c.mk = [L, R];
  }
  View.shake = (a) => { shake = Math.max(shake, a || 0.4); };

  // ---------- orientation dans une zone sans gravité ----------
  const _m = new T.Matrix4(), _fw = new T.Vector3(), _up = new T.Vector3(), _lf = new T.Vector3();
  // calcule l'avant, le haut et la gauche de la voiture au point idx avec le cap relatif hd, et remplit _m. Faux hors zone
  function railBasis(idx, hd) {
    const tr = View.track; if (!tr || !tr.mags) return false; const ids = Track.magMap(tr).id; const k = ids[Math.floor(clamp(idx, 0, tr.n - 2))]; if (k < 0) return false;
    const fr = Track.frameAt(tr, tr.mags[k], idx); const ch = Math.cos(hd), sh = Math.sin(hd);
    _fw.set(fr.tx * ch - fr.rx * sh, fr.ty * ch - fr.ry * sh, fr.tz * ch - fr.rz * sh).normalize(); _up.set(fr.ux, fr.uy, fr.uz); _lf.crossVectors(_up, _fw).normalize(); _m.makeBasis(_lf, _up, _fw); return true;
  }
  // replace une position sur la route déroulée. Les autres voitures et le fantôme sont lissés en ligne droite entre deux positions reçues,
  // dans un looping cette ligne droite coupe à travers la route. On garde donc seulement le décalage latéral et on recolle la voiture sur la route à l'indice lissé.
  const _rp = { x: 0, y: 0, z: 0 };
  function railSnap(s) {
    const tr = View.track; if (!tr || !tr.mags) return null; const ids = Track.magMap(tr).id; const k = ids[Math.floor(clamp(s.i, 0, tr.n - 2))]; if (k < 0) return null;
    const fr = Track.frameAt(tr, tr.mags[k], s.i); let u = (s.x - fr.px) * fr.rx + (s.y - fr.py) * fr.ry + (s.z - fr.pz) * fr.rz; const lim = (tr.w ? tr.w[Math.floor(clamp(s.i, 0, tr.n - 2))] : 8) ; u = clamp(u, -lim, lim);
    _rp.x = fr.px + fr.rx * u; _rp.y = fr.py + fr.ry * u; _rp.z = fr.pz + fr.rz * u; return _rp;
  }
  const _wantUp = new T.Vector3(); let wasRail = false;
  // ---------- caméra ----------
  View.follow = (id) => { followId = id; };
  View.resetFollow = () => { camInit = false; };
  View.cycleCam = () => { camMode = (camMode + 1) % 3; return camMode; };
  View.setOrbit = (o) => { orbit = o; };
  View.camMode = () => camMode;
  let lookBack = false, introK = 0, flyS = 0;
  View.lookBack = (b) => { lookBack = !!b; const e = document.getElementById("z-retro"); if (e) e.classList.toggle("hidden", !lookBack); };
  let tvOn = false; View.setTV = (b) => { tvOn = !!b; };
  View.intro = (k) => { introK = k == null ? 1 : k; };
  let viewOfs = false;
  function updateCamera(dt) {
    const c = followId && View.cars[followId];
    // au garage la voiture est remontée dans l'image, au-dessus des cartes des voitures
    const wantOfs = !!(showroom && !podiumG && c && c.init && c.root.visible); if (wantOfs !== viewOfs) { viewOfs = wantOfs; if (wantOfs) { const w = host.clientWidth || 1, h = host.clientHeight || 1; camera.setViewOffset(w, h, 0, h * 0.27, w, h); } else camera.clearViewOffset(); }
    if (podiumG) { // podium de fin de partie, la caméra se balance doucement devant les marches
      podT += dt; const P = podiumG.userData; const a = Math.sin(podT * 0.35) * 0.45; const fx = Math.sin(P.h + a), fz = Math.cos(P.h + a);
      camera.up.set(0, 1, 0); camera.position.set(P.x + fx * 15, P.y + 5.2, P.z + fz * 15); camera.lookAt(P.x, P.y + 2.4, P.z); if (Math.abs(camera.fov - 46) > 0.05) { camera.fov = 46; camera.updateProjectionMatrix(); }
      if (Math.random() < dt * 9) { const cc = ["#ff4a8a", "#ffd23f", "#5affd8", "#7aa8ff", "#7aff7a"][Math.floor(Math.random() * 5)]; const q = puff(P.x + (Math.random() - 0.5) * 12, P.y + 9 + Math.random() * 3, P.z + (Math.random() - 0.5) * 6, cc, 1, 0.6, 0, 1.1); if (q) { q.grav = -2.5; q.grow = 0; q.max = q.life = 2.4; q.alpha = 1; q.v.y = -1; } }
      return;
    }
    if (showroom && c && c.init && c.root.visible) { // garage, la voiture tourne sur un plateau
      showAng += dt * 0.55; const st = c.st; const h = View.track ? View.track.start.h : st.h; const fx = Math.sin(h + 0.75), fz = Math.cos(h + 0.75);
      camera.up.set(0, 1, 0); camera.position.set(st.x + fx * 10.5, st.y + 3.1, st.z + fz * 10.5); camera.lookAt(st.x, st.y + 0.8, st.z); if (Math.abs(camera.fov - 40) > 0.05) { camera.fov = 40; camera.updateProjectionMatrix(); }
      if (platform) { platform.position.set(st.x, st.y - 0.16, st.z); platform.rotation.y = showAng; }
      return;
    }
    if (orbit === "fly") { // survol du circuit pendant le garage, la caméra file le long de la route
      camera.up.set(0, 1, 0); const tr = View.track; flyS += dt * 26 / tr.step; if (flyS > tr.n - 8) flyS = 0; const i = Math.floor(flyS), j = Math.min(tr.n - 1, i + 22);
      const tx = tr.x[i] + Math.cos(tr.h[i]) * 10, ty = Math.max(tr.y[i], tr.y[j]) + 17, tz = tr.z[i] - Math.sin(tr.h[i]) * 10; if (!camInit) { camPos.set(tx, ty, tz); camInit = true; } camPos.x += (tx - camPos.x) * Math.min(1, dt * 2); camPos.y += (ty - camPos.y) * Math.min(1, dt * 2); camPos.z += (tz - camPos.z) * Math.min(1, dt * 2);
      camera.position.copy(camPos); camera.lookAt(tr.x[j], tr.y[j], tr.z[j]); if (camera.fov !== 58) { camera.fov = 58; camera.updateProjectionMatrix(); } return;
    }
    if (orbit) { camera.up.set(0, 1, 0); // vue de garage, la caméra tourne autour du départ
      const t = time * 0.35; const s = View.track.start; camera.position.set(s.x + Math.sin(t) * 14, s.y + 5.2, s.z + Math.cos(t) * 14); camera.lookAt(s.x, s.y + 0.8, s.z); camera.fov = 52; camera.updateProjectionMatrix(); return;
    }
    if (!c || !c.init) return;
    const st = c.st; const spd = c.speed || 0;
    if (c.rail && railBasis(st.i, st.h)) { // la caméra suit la voiture et tourne avec elle, même la tête en bas
      const dist = camMode === 0 ? 8.2 : camMode === 1 ? 15 : 0.2, hgt = camMode === 0 ? 3.3 : camMode === 1 ? 7.5 : 1.7;
      const tx = st.x - _fw.x * dist + _up.x * hgt, ty = st.y - _fw.y * dist + _up.y * hgt, tz = st.z - _fw.z * dist + _up.z * hgt;
      if (!camInit || !wasRail) { camPos.set(tx, ty, tz); camInit = true; } const kk = Math.min(1, dt * (camMode === 2 ? 30 : 9));
      camPos.x += (tx - camPos.x) * kk; camPos.y += (ty - camPos.y) * kk; camPos.z += (tz - camPos.z) * kk;
      camera.up.lerp(_up, Math.min(1, dt * 5)).normalize(); camera.position.copy(camPos);
      camera.lookAt(st.x + _fw.x * 6 + _up.x * 1.3, st.y + _fw.y * 6 + _up.y * 1.3, st.z + _fw.z * 6 + _up.z * 1.3); wasRail = true;
      const wf = 62 + clamp(spd / 60, 0, 1) * 20; fov += (wf - fov) * Math.min(1, dt * 4); if (Math.abs(camera.fov - fov) > 0.05) { camera.fov = fov; camera.updateProjectionMatrix(); }
      return;
    }
    if (tvOn) { // caméra télé, posée au bord du circuit tous les 70 m et qui suit la voiture du regard
      const tr = View.track; const k = clamp(Math.floor((st.i || 0) / 35) * 35 + 30, 2, tr.n - 3); const side = (Math.floor(k / 35) % 2) ? 1 : -1; const off = tr.w[k] + (tr.vw ? tr.vw[k] : 0) + 9;
      camera.up.set(0, 1, 0); camera.position.set(tr.x[k] - Math.cos(tr.h[k]) * off * side, Math.max(tr.y[k], st.y) + 6, tr.z[k] + Math.sin(tr.h[k]) * off * side); camera.lookAt(st.x, st.y + 1, st.z); if (Math.abs(camera.fov - 42) > 0.05) { camera.fov = 42; camera.updateProjectionMatrix(); } camInit = false; return;
    }
    if (wasRail) { wasRail = false; camHd = st.h; camPos.set(st.x - Math.sin(st.h) * 8, st.y + 3.3, st.z - Math.cos(st.h) * 8); }
    if (camera.up.y < 0.999) { _wantUp.set(0, 1, 0); camera.up.lerp(_wantUp, Math.min(1, dt * 6)).normalize(); }
    if (!camInit) { camHd = st.h; camInit = true; camPos.set(st.x - Math.sin(st.h) * 9, st.y + 4, st.z - Math.cos(st.h) * 9); }
    camHd += wrap(st.h - camHd) * Math.min(1, dt * (camMode === 2 ? 20 : 4.5));
    if (introK > 0) introK = Math.max(0, introK - dt * 0.42); const ik = introK * introK * (3 - 2 * introK);
    let dist = camMode === 0 ? 8.2 : camMode === 1 ? 15 : 0.2; let hgt = camMode === 0 ? 3.3 : camMode === 1 ? 7.5 : 1.7;
    // la caméra recule et s'abaisse un peu avec la vitesse, et prend un petit recul au déclenchement d'un turbo
    if (c.boost && !c.boostWas) boostKick = 1; c.boostWas = !!c.boost; boostKick = Math.max(0, boostKick - dt * 1.6);
    if (camMode !== 2) { const sk = clamp((spd - 18) / 42, 0, 1); spdCam += (sk - spdCam) * Math.min(1, dt * 2.5); dist += spdCam * (camMode === 0 ? 2.3 : 3) + boostKick * boostKick * 1.5; hgt -= spdCam * (camMode === 0 ? 0.4 : 0.8); }
    dist += (34 - dist) * ik; hgt += (16 - hgt) * ik;
    if (lookBack) { // rétroviseur, la caméra se place devant la voiture et regarde derrière
      const bx = st.x - Math.sin(st.h) * 2.4, bz = st.z - Math.cos(st.h) * 2.4; camera.up.set(0, 1, 0); camera.position.set(bx, st.y + 2.1, bz); camera.lookAt(st.x - Math.sin(st.h) * 22, st.y + 1.0, st.z - Math.cos(st.h) * 22); if (Math.abs(camera.fov - 70) > 0.05) { camera.fov = 70; camera.updateProjectionMatrix(); } camPos.set(st.x - Math.sin(camHd) * dist, st.y + hgt, st.z - Math.cos(camHd) * dist); return;
    }
    const tx = st.x - Math.sin(camHd) * dist, ty = st.y + hgt, tz = st.z - Math.cos(camHd) * dist;
    camPos.x += (tx - camPos.x) * Math.min(1, dt * (camMode === 2 ? 30 : 10)); camPos.z += (tz - camPos.z) * Math.min(1, dt * (camMode === 2 ? 30 : 10)); camPos.y += (ty - camPos.y) * Math.min(1, dt * 6);
    if (ik > 0) { camPos.set(tx, ty, tz); }
    const g = View.track.groundY; if (camPos.y < g + 0.8) camPos.y = g + 0.8;
    camera.position.copy(camPos);
    if (shake > 0) { camera.position.x += (Math.random() - 0.5) * shake; camera.position.y += (Math.random() - 0.5) * shake * 0.6; shake = Math.max(0, shake - dt * 2.4); }
    camera.lookAt(st.x + Math.sin(camHd) * (camMode === 2 ? 20 : 6), st.y + (camMode === 2 ? 1.5 : 1.3), st.z + Math.cos(camHd) * (camMode === 2 ? 20 : 6));
    // la caméra penche très légèrement dans les virages
    { const rollT = camMode === 1 ? 0 : (c.steer || 0) * 0.032 * clamp(spd / 35, 0, 1); camRoll += (rollT - camRoll) * Math.min(1, dt * 3); if (Math.abs(camRoll) > 1e-4) camera.rotateZ(camRoll); }
    const wantFov = 60 + clamp(spd / 60, 0, 1) * 22 + (c.boost ? 8 : 0); fov += (wantFov - fov) * Math.min(1, dt * 4); if (Math.abs(camera.fov - fov) > 0.05) { camera.fov = fov; camera.updateProjectionMatrix(); }
  }

  // lignes de vitesse, de fines traînées blanches qui filent autour de l'écran au turbo et à très haute vitesse
  function speedLinesUpdate(dt) {
    const f = followId && View.cars[followId]; let want = 0;
    if (f && !orbit && !showroom && !podiumG && !lookBack && camMode !== 2) { const vmax = (f.vmax || 52); const r = clamp(((f.speed || 0) / vmax - 0.82) / 0.3, 0, 1); want = Math.max(f.boost ? 0.55 : 0, r * 0.32); }
    if (!speedLines) { if (want <= 0) return; const N = 34; const pos = new Float32Array(N * 6); const g = new T.BufferGeometry(); g.setAttribute("position", new T.BufferAttribute(pos, 3)); const m = new T.LineBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0, depthWrite: false, depthTest: false });
      speedLines = new T.LineSegments(g, m); speedLines.frustumCulled = false; speedLines.renderOrder = 999; speedLines.userData = { N, z: [], x: [], y: [], a: 0 };
      for (let i = 0; i < N; i++) { const a = Math.random() * Math.PI * 2, r = 1.15 + Math.random() * 1.6; speedLines.userData.x.push(Math.cos(a) * r * 1.6); speedLines.userData.y.push(Math.sin(a) * r); speedLines.userData.z.push(-2 - Math.random() * 14); } }
    if (!speedLines.parent && scene) scene.add(speedLines);
    const U = speedLines.userData; U.a += (want - U.a) * Math.min(1, dt * 5); speedLines.material.opacity = U.a; speedLines.visible = U.a > 0.01; if (!speedLines.visible) return;
    const p = speedLines.geometry.attributes.position.array; const v = 30 + (f ? f.speed || 0 : 0) * 0.8;
    for (let i = 0; i < U.N; i++) { U.z[i] += v * dt; if (U.z[i] > -1.2) { U.z[i] = -14 - Math.random() * 3; const a = Math.random() * Math.PI * 2, r = 1.15 + Math.random() * 1.6; U.x[i] = Math.cos(a) * r * 1.6; U.y[i] = Math.sin(a) * r; }
      const L = 1.2 + U.a * 2.4; p[i * 6] = U.x[i]; p[i * 6 + 1] = U.y[i]; p[i * 6 + 2] = U.z[i]; p[i * 6 + 3] = U.x[i]; p[i * 6 + 4] = U.y[i]; p[i * 6 + 5] = U.z[i] - L; }
    speedLines.geometry.attributes.position.needsUpdate = true; speedLines.position.copy(camera.position); speedLines.quaternion.copy(camera.quaternion);
  }

  // ---------- boucle ----------
  let last = performance.now();
  function loop(now) { requestAnimationFrame(loop); PicuiteGL.frame(() => loopBody(now)); }
  function loopBody(now) {
    const dt = Math.min(0.05, (now - last) / 1000); last = now; time += dt;
    if (!View.track || !renderer || View.paused) return;
    if (View.onFrame) View.onFrame(dt);
    const B = Track.BIOMES[View.track.biome];
    Object.keys(View.cars).forEach((cid) => {
      const c = View.cars[cid];
      if (View.sampler && cid !== "me" && c.tgt && !c.ghost && c.root.visible) { const smp = View.sampler(cid); if (smp) View.setCarTarget(cid, smp); }
      if (c.tgt) { const k = 1 - Math.exp(-(View.sampler && cid !== "me" ? 30 : 14) * dt); c.st.x += (c.tgt.x - c.st.x) * k; c.st.y += (c.tgt.y - c.st.y) * k; c.st.z += (c.tgt.z - c.st.z) * k; c.st.h += wrap(c.tgt.h - c.st.h) * k; c.st.p += ((c.tgt.p || 0) - c.st.p) * k; if (c.rail) c.st.i += ((c.tgt.i || 0) - c.st.i) * k; }
      const s = c.st; const sn = c.rail && c !== View.cars.me ? railSnap(s) : null; if (sn) c.root.position.set(sn.x, sn.y, sn.z); else c.root.position.set(s.x, s.y, s.z);
      if (c.hop > 0) { c.hop = Math.max(0, c.hop - dt * 2.2); c.root.position.y += Math.sin(c.hop * Math.PI * 2) * 0.12 * c.hop; }
      if (showroom && !podiumG && cid !== followId) { c.root.visible = false; if (c.shadow) c.shadow.visible = false; return; }
      if (showroom && cid === followId && !podiumG) { c.root.rotation.order = "YXZ"; c.root.rotation.set(0, s.h + showAng, 0); }
      else if (c.rail && railBasis(s.i, s.h)) c.root.quaternion.setFromRotationMatrix(_m); else { c.root.rotation.order = "YXZ"; c.root.rotation.y = s.h; c.root.rotation.x = -s.p * (c.air ? 0.4 : 1); c.root.rotation.z = -(c.steer || 0) * 0.06 * clamp((c.speed || 0) / 30, 0, 1) - (!c.air && View.track && View.track.bank ? Math.atan(Track.bankAt(View.track, s.i || 0)) : 0); }
      if (!c.rail && !(showroom && !podiumG)) {
        // la caisse se cabre à l'accélération, plonge au freinage, et s'écrase un instant à l'atterrissage
        const sp = c.speed || 0; const acc = dt > 0 ? (sp - (c.psp == null ? sp : c.psp)) / dt : 0; c.psp = sp;
        const pT = cid === followId && !c.air ? clamp(-acc * 0.0032, -0.055, 0.045) : 0; c.pitchFx = (c.pitchFx || 0) + (pT - (c.pitchFx || 0)) * Math.min(1, dt * 7);
        if (c.wasAir && !c.air) c.landT = 1; c.wasAir = !!c.air; if (c.landT > 0) c.landT = Math.max(0, c.landT - dt * 3.4);
        const comp = c.landT > 0 ? Math.sin(c.landT * Math.PI) * 0.17 : 0; if (comp) { c.root.position.y -= comp; }
        if (c.pitchFx) c.root.rotation.x += c.pitchFx;
        if (c.landT > 0.95 && cid === followId) { shake = Math.max(shake, 0.12); [-1, 1].forEach((o) => puff(s.x - Math.cos(s.h) * o * 1.2, s.y + 0.25, s.z + Math.sin(s.h) * o * 1.2, "#d8d2c4", 3, 2.4, 0.4, 0.9)); }
      }
      if (c.label) { const d = camera.position.distanceTo(c.root.position); c.label.visible = d > 9 && d < 170; const sc = 2.6 + d * 0.02; c.label.scale.set(sc, sc * 0.25, 1); c.label.position.y = 3.1; }
      c.flame.visible = !!c.boost; if (c.boost) c.flame.scale.set(0.8 + Math.random() * 0.3, 0.8 + Math.random() * 0.5, 0.8 + Math.random() * 0.3);
      c.spin += (c.speed || 0) * dt / 0.5; c.spin = c.spin % (Math.PI * 2); c.wheels.forEach((w) => { w.holder.rotation.x = c.spin; w.holder.rotation.y = w.front ? -(c.steer || 0) * 0.45 : 0; });
      if (c.shadow) { c.shadow.visible = c.root.visible && !c.air && !c.rail; c.shadow.position.set(s.x, s.y + 0.06, s.z); c.shadow.rotation.z = s.h; }
      if (cid !== "me" && !c.ghost) { const mvx = s.x - (c.px == null ? s.x : c.px), mvz = s.z - (c.pz == null ? s.z : c.pz); const mv = Math.hypot(mvx, mvz); if (mv > 0.12 && dt > 0) { const slip = Math.abs(wrap(Math.atan2(mvx, mvz) - s.h)); c.skid = slip > 0.22 && slip < 2.5 && mv / dt > 10 ? 1 : 0; c.speed = (c.speed || 0) * 0.8 + Math.min(120, mv / dt) * 0.2; } else if (dt > 0 && mv < 0.01) c.speed = (c.speed || 0) * 0.9; c.px = s.x; c.pz = s.z; }
      carFx(c, dt);
      if (c.skid > 0.5 && !c.air && !c.rail && Math.random() < 0.35 && groundOf(c) === 0) puff(s.x - Math.sin(s.h) * 1.6, s.y + 0.3, s.z - Math.cos(s.h) * 1.6, c.skidCol || "#dddddd", 1, 1.4, 0.8, 1);
      // étincelles du turbo de dérapage, bleues, orange puis violettes
      if (c.drTier > 0 && !c.air && !c.rail && Math.random() < 0.8) { const sc = ["#5ad0ff", "#ffa21a", "#d65aff"][c.drTier - 1]; [-1, 1].forEach((o) => puff(s.x - Math.sin(s.h) * 1.7 - Math.cos(s.h) * o * 0.9, s.y + 0.25, s.z - Math.cos(s.h) * 1.7 + Math.sin(s.h) * o * 0.9, sc, 1, 2.2 + c.drTier, 1.2, 0.6 + c.drTier * 0.15)); }
      // aspiration, de fines traînées de vent autour de la voiture
      if (c.draft > 0.3 && Math.random() < c.draft * 0.7) puff(s.x + (Math.random() - 0.5) * 3, s.y + 0.6 + Math.random() * 1.4, s.z + (Math.random() - 0.5) * 3, "#e8f6ff", 1, 0.5, 0.1, 0.35);
    });
    particles.forEach((p) => { if (!p.alive) return; p.life -= dt; if (p.life <= 0) { p.alive = false; p.mesh.visible = false; return; } p.v.y += (p.grav == null ? 1.2 : p.grav) * dt; p.v.multiplyScalar(1 - dt * (p.spark ? 0.6 : 1.5)); p.mesh.position.addScaledVector(p.v, dt); const dc = p.spark ? 9 : p.mesh.position.distanceTo(camera.position); p.mesh.material.opacity = clamp(p.life / p.max, 0, 1) * (p.alpha == null ? 0.8 : p.alpha) * clamp((dc - 2.5) / 6, 0, 1); if (p.grow) p.mesh.scale.multiplyScalar(1 + dt * p.grow); });
    ringsM.forEach((rg) => { rg.m.rotation.z += dt * 1.3; });
    if (movers.length) { const tm = View.moverClock ? View.moverClock() : time; movers.forEach((mo) => buildMover(mo, tm)); }
    gates.forEach((g) => { if (g.userData.flash > 0) { g.userData.flash -= dt * 0.6; if (g.userData.flash <= 0 && g.userData.ring) { g.userData.ring.material.emissive.set("#33e0ff"); g.userData.ring.material.color.set("#33e0ff"); } } });
    if (stars) stars.position.copy(camera.position);
    if (sky) { sky.position.set(camera.position.x, 0, camera.position.z); if (cloudsG) cloudsG.rotation.y += dt * 0.004; }
    if (amb) { const A = amb.userData, a = amb.geometry.attributes.position; for (let i = 0; i < a.count; i++) { let y = a.getY(i) + A.vy * dt, x = a.getX(i) + (Math.sin(time * 0.4 + i) * A.drift) * dt + A.drift * 0.4 * dt, z = a.getZ(i); if (y < 0) y += 36; if (y > 36) y -= 36; if (x > 45) x -= 90; if (x < -45) x += 90; a.setXYZ(i, x, y, z); } a.needsUpdate = true; amb.position.set(camera.position.x, camera.position.y - 14, camera.position.z); }
    const f = followId && View.cars[followId]; if (f) { sun.target.position.set(f.st.x, f.st.y, f.st.z); sun.position.set(f.st.x + 50, f.st.y + 90, f.st.z - 30); }
    updateCamera(dt);
    speedLinesUpdate(dt);
    PicuiteGL.frame(() => { if (composer && postOn) { const f2 = followId && View.cars[followId]; const kmh = f2 && !orbit && !showroom ? (f2.speed || 0) * 3.6 : 0; const amt = clamp((kmh - 150) / 140, 0, 1) * 0.9 + (f2 && f2.boost && kmh > 80 ? 0.22 : 0); blurPass.uniforms.amount.value += (amt - blurPass.uniforms.amount.value) * Math.min(1, dt * 5); blurPass.enabled = blurPass.uniforms.amount.value > 0.02 && camMode !== 1; composer.render(dt); } else renderer.render(scene, camera); PicuiteGL.verify(renderer); });
  }
  View.carState = (id) => (View.cars[id] ? View.cars[id].st : null);
  // ---------- garage et podium ----------
  View.setShowroom = function (on) {
    showroom = !!on; if (on && !platform && scene) { platform = new T.Group(); const disc = new T.Mesh(new T.CylinderGeometry(3.4, 3.6, 0.3, 40), new T.MeshStandardMaterial({ color: col("#2a2f48"), roughness: 0.4, metalness: 0.4 })); disc.receiveShadow = true; platform.add(disc); const ring = new T.Mesh(new T.TorusGeometry(3.5, 0.07, 6, 60), new T.MeshBasicMaterial({ color: col("#5affd8") })); ring.rotation.x = Math.PI / 2; ring.position.y = 0.16; platform.add(ring); for (let k = 0; k < 8; k++) { const d = new T.Mesh(new T.BoxGeometry(0.5, 0.04, 0.12), new T.MeshBasicMaterial({ color: col("#ffd66b") })); const a = k / 8 * Math.PI * 2; d.position.set(Math.sin(a) * 2.9, 0.17, Math.cos(a) * 2.9); d.rotation.y = a; platform.add(d); } scene.add(platform); }
    if (platform) platform.visible = showroom;
  };
  // petit sursaut quand le moteur démarre, avec un nuage d'échappement
  View.carHop = function (id) { const c = View.cars[id]; if (!c) return; c.hop = 1; const s = c.st; const back = (c.len || 4.2) / 2; for (let k = 0; k < 4; k++) { const q = puff(s.x - Math.sin(s.h + showAng) * back, s.y + 0.5, s.z - Math.cos(s.h + showAng) * back, "#8a8a92", 1, 0.8, 0.6, 1.4); if (q) { q.alpha = 0.45; q.grow = 1.1; } } };
  // podium 3D de fin de partie. list est rangée par place, {carId, hex, name}
  View.podium = function (list) {
    View.podiumOff(); if (!View.track || !scene) return; View.removeAllCars(); const tr = View.track; const i = Math.min(tr.n - 2, tr.start.idx + 30); const h = tr.h[i] + Math.PI;
    podiumG = new T.Group(); podiumG.userData = { x: tr.x[i], y: tr.y[i], z: tr.z[i], h }; podT = 0; scene.add(podiumG);
    const rx = -Math.cos(h), rz = Math.sin(h); const spots = [{ u: 0, hgt: 2.0, c: "#ffd23f" }, { u: 3.9, hgt: 1.35, c: "#d8dde8" }, { u: -3.9, hgt: 0.85, c: "#d88a4a" }];
    spots.forEach((sp, k) => { const px = tr.x[i] + rx * sp.u, pz = tr.z[i] + rz * sp.u; const blk = new T.Mesh(new T.BoxGeometry(3.7, sp.hgt, 3.4), new T.MeshStandardMaterial({ color: col(sp.c), roughness: 0.35, metalness: 0.3, emissive: col(sp.c), emissiveIntensity: 0.12 })); blk.position.set(px, tr.y[i] + sp.hgt / 2, pz); blk.rotation.y = h; blk.castShadow = true; blk.receiveShadow = true; podiumG.add(blk);
      const num = new T.Mesh(new T.PlaneGeometry(1.4, 1.4), new T.MeshBasicMaterial({ map: signTexture(String(k + 1), "rgba(0,0,0,0)", "#14172b"), transparent: true })); num.position.set(px + Math.sin(h) * 1.72, tr.y[i] + sp.hgt / 2, pz + Math.cos(h) * 1.72); num.rotation.y = h; podiumG.add(num);
      const e = list[k]; if (!e) return; const id = "pod" + k; const car = View.ensureCar(id, e.carId, e.hex, false, e.name); View.setCarState(id, { x: px, y: tr.y[i] + sp.hgt, z: pz, h, p: 0, a: 0, b: 0, speed: 0 }, true); car.hop = 1 - k * 0.25; });
  };
  View.podiumOff = function () { if (podiumG) { scene.remove(podiumG); podiumG = null; ["pod0", "pod1", "pod2"].forEach((id) => View.removeCar(id)); } };
  View.screenReady = () => !!View.track;
  window.ZoomView = View;
})();

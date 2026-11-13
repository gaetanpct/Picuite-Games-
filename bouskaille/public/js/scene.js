// ============================================================
// BOUSKAILLE — Décors 3D des arènes (tout dépend du temps de jeu, rien n'est synchronisé à part l'état des dalles)
// ============================================================
(function () {
  const T = THREE, Sim = BouskSim;
  const TAU = Math.PI * 2;
  const V = { assets: { props: {}, loaded: false } };
  window.BouskScene = V;

  // ---------- thèmes ----------
  const THEMES = {
    cloud: { sky: ["#ffd9c2", "#7fc7ff"], fog: "#cfe9ff", fogD: 0.012, sun: 1.15, hemi: ["#ffffff", "#9fc8ff"], top: "#ffffff", side: "#cfe3ff", rim: "#ffffff" },
    factory: { sky: ["#46324f", "#1d1830"], fog: "#2a2038", fogD: 0.014, sun: 1.0, hemi: ["#ffe9c9", "#3b2a4a"], top: "#7f8da0", side: "#3d4655", rim: "#ffc83d" },
    carousel: { sky: ["#ff9fb8", "#5a2c7a"], fog: "#7b3a8a", fogD: 0.013, sun: 1.0, hemi: ["#fff1f5", "#6a3a8a"], top: "#ffe3ee", side: "#c0396b", rim: "#ffd166" },
    island: { sky: ["#8fe1ff", "#2aa4d6"], fog: "#aee9ff", fogD: 0.009, sun: 1.3, hemi: ["#ffffff", "#7fd0e6"], top: "#f1d38f", side: "#c79a4a", rim: "#5fbf4a" },
    sections: { sky: ["#6e5cff", "#14103a"], fog: "#241a5a", fogD: 0.013, sun: 1.0, hemi: ["#dcd6ff", "#2a2060"], top: "#35e0c1", side: "#157a7a", rim: "#ffffff" },
    fair: { sky: ["#ffcf66", "#e8556e"], fog: "#f08a6a", fogD: 0.011, sun: 1.1, hemi: ["#fff5e0", "#9a4a6a"], top: "#fff0d6", side: "#d63b4f", rim: "#ffd23d" },
    float: { sky: ["#1b1f4a", "#05060f"], fog: "#0a0c22", fogD: 0.009, sun: 0.9, hemi: ["#b8c8ff", "#101436"], top: "#aab6d6", side: "#4a5678", rim: "#38e1ff" },
  };
  V.THEMES = THEMES;

  // ---------- textures dessinées ----------
  const texCache = {};
  function canvasTex(key, w, h, draw, rep) {
    if (texCache[key]) return texCache[key];
    const c = document.createElement("canvas"); c.width = w; c.height = h; draw(c.getContext("2d"), w, h);
    const t = new T.CanvasTexture(c); t.anisotropy = 4; if (rep) { t.wrapS = t.wrapT = T.RepeatWrapping; } if (T.sRGBEncoding) t.encoding = T.sRGBEncoding; texCache[key] = t; return t;
  }
  function topTex(theme) {
    switch (theme) {
      case "cloud": return canvasTex("t.cloud", 256, 256, (g, w, h) => { const gr = g.createRadialGradient(w / 2, h / 2, 10, w / 2, h / 2, w / 2); gr.addColorStop(0, "#ffffff"); gr.addColorStop(1, "#e4f0ff"); g.fillStyle = gr; g.fillRect(0, 0, w, h); g.fillStyle = "rgba(160,200,255,0.25)"; for (let i = 0; i < 26; i++) { g.beginPath(); g.arc(Math.random() * w, Math.random() * h, 8 + Math.random() * 22, 0, TAU); g.fill(); } });
      case "factory": return canvasTex("t.fact", 256, 256, (g, w, h) => { g.fillStyle = "#7f8da0"; g.fillRect(0, 0, w, h); g.strokeStyle = "rgba(30,40,55,0.55)"; g.lineWidth = 3; for (let i = 0; i <= 4; i++) { g.beginPath(); g.moveTo(i * w / 4, 0); g.lineTo(i * w / 4, h); g.moveTo(0, i * h / 4); g.lineTo(w, i * h / 4); g.stroke(); } g.fillStyle = "#566174"; for (let i = 0; i < 4; i++) for (let j = 0; j < 4; j++) for (const [dx, dy] of [[10, 10], [w / 4 - 10, 10], [10, h / 4 - 10], [w / 4 - 10, h / 4 - 10]]) { g.beginPath(); g.arc(i * w / 4 + dx, j * h / 4 + dy, 3, 0, TAU); g.fill(); } }, true);
      case "carousel": return canvasTex("t.car", 256, 256, (g, w, h) => { const n = 12; for (let i = 0; i < n; i++) { g.fillStyle = i % 2 ? "#ffd1e1" : "#ff7aa8"; g.beginPath(); g.moveTo(w / 2, h / 2); g.arc(w / 2, h / 2, w, (i / n) * TAU, ((i + 1) / n) * TAU); g.fill(); } g.strokeStyle = "#ffd166"; g.lineWidth = 8; g.beginPath(); g.arc(w / 2, h / 2, w * 0.46, 0, TAU); g.stroke(); });
      case "island": return canvasTex("t.isl", 256, 256, (g, w, h) => { g.fillStyle = "#f1d38f"; g.fillRect(0, 0, w, h); for (let i = 0; i < 400; i++) { g.fillStyle = Math.random() < 0.5 ? "rgba(255,240,190,0.5)" : "rgba(190,140,70,0.35)"; g.fillRect(Math.random() * w, Math.random() * h, 2 + Math.random() * 3, 2 + Math.random() * 3); } });
      case "sections": return canvasTex("t.sec", 256, 256, (g, w, h) => { g.fillStyle = "#2fd8c0"; g.fillRect(0, 0, w, h); g.fillStyle = "#26b8a4"; g.fillRect(0, 0, w / 2, h / 2); g.fillRect(w / 2, h / 2, w / 2, h / 2); g.strokeStyle = "rgba(255,255,255,0.85)"; g.lineWidth = 6; g.strokeRect(10, 10, w - 20, h - 20); g.fillStyle = "rgba(255,255,255,0.8)"; g.beginPath(); g.moveTo(w * 0.35, h * 0.62); g.lineTo(w * 0.5, h * 0.3); g.lineTo(w * 0.65, h * 0.62); g.lineTo(w * 0.5, h * 0.52); g.fill(); });
      case "fair": return canvasTex("t.fair", 256, 256, (g, w, h) => { for (let i = 0; i < 4; i++) for (let j = 0; j < 4; j++) { g.fillStyle = (i + j) % 2 ? "#fff0d6" : "#ff5a6a"; g.fillRect(i * w / 4, j * h / 4, w / 4, h / 4); } }, true);
      default: return canvasTex("t.float", 256, 256, (g, w, h) => { g.fillStyle = "#aab6d6"; g.fillRect(0, 0, w, h); g.strokeStyle = "#38e1ff"; g.lineWidth = 5; g.strokeRect(14, 14, w - 28, h - 28); g.strokeStyle = "rgba(56,225,255,0.45)"; g.lineWidth = 3; g.beginPath(); g.moveTo(w / 2, 14); g.lineTo(w / 2, h - 14); g.moveTo(14, h / 2); g.lineTo(w - 14, h / 2); g.stroke(); });
    }
  }
  const chevTex = (col) => canvasTex("t.chev" + col, 128, 128, (g, w, h) => { g.fillStyle = "#3a3f4a"; g.fillRect(0, 0, w, h); g.strokeStyle = col; g.lineWidth = 14; g.lineCap = "round"; g.beginPath(); g.moveTo(30, 20); g.lineTo(80, 64); g.lineTo(30, 108); g.stroke(); }, true);
  const stripeTex = canvasTex("t.stripe", 128, 32, (g, w, h) => { for (let i = 0; i < 8; i++) { g.fillStyle = i % 2 ? "#fff" : "#e8453c"; g.fillRect(i * w / 8, 0, w / 8, h); } }, true);
  const hazardTex = canvasTex("t.haz", 128, 128, (g, w, h) => { g.fillStyle = "#ffcf2e"; g.fillRect(0, 0, w, h); g.fillStyle = "#2a2a2a"; for (let i = -4; i < 8; i++) { g.beginPath(); g.moveTo(i * 32, 0); g.lineTo(i * 32 + 16, 0); g.lineTo(i * 32 + 16 + 128, h); g.lineTo(i * 32 + 128, h); g.fill(); } }, true);
  const dotTex = canvasTex("t.dots", 128, 128, (g, w, h) => { g.fillStyle = "#e8453c"; g.fillRect(0, 0, w, h); g.fillStyle = "#fff"; for (const [x, y, r] of [[30, 30, 14], [90, 40, 10], [60, 90, 16], [110, 100, 9], [20, 100, 8]]) { g.beginPath(); g.arc(x, y, r, 0, TAU); g.fill(); } });
  const softTex = canvasTex("t.soft", 64, 64, (g, w, h) => { const gr = g.createRadialGradient(32, 32, 0, 32, 32, 32); gr.addColorStop(0, "rgba(255,255,255,1)"); gr.addColorStop(1, "rgba(255,255,255,0)"); g.fillStyle = gr; g.fillRect(0, 0, w, h); });
  V.softTex = softTex;

  const M = {}; // matériaux partagés
  const lam = (key, o) => (M[key] || (M[key] = new T.MeshLambertMaterial(o)));
  const clipU = { value: 1e9 }; V.clipU = clipU;
  const COMPAT = () => !!(window.PicuiteGL && PicuiteGL.compat && PicuiteGL.compat());
  // les surfaces disparaissent au delà du rayon d'effondrement, exactement comme dans la physique
  function clipped(mat) {
    if (COMPAT()) return mat;
    try {
      mat.onBeforeCompile = (sh) => {
        sh.uniforms.uClip = clipU;
        sh.vertexShader = "varying vec2 vWP;\n" + sh.vertexShader.replace("#include <begin_vertex>", "#include <begin_vertex>\n vWP = (modelMatrix * vec4(transformed, 1.0)).xz;");
        sh.fragmentShader = "varying vec2 vWP; uniform float uClip;\n" + sh.fragmentShader.replace("void main() {", "void main() {\n if (length(vWP) > uClip) discard;");
      };
      mat.customProgramCacheKey = () => "clip";
    } catch (e) { /* rien */ }
    return mat;
  }
  V.clipped = clipped;

  // ---------- décors Kenney et KayKit ----------
  V.loadAssets = function (done) {
    if (V.assets.loaded || V.assets.loading) return done && (V.assets.loaded ? done() : (V.assets.cbs = V.assets.cbs || []).push(done));
    V.assets.loading = true; V.assets.cbs = done ? [done] : [];
    if (!T.GLTFLoader || COMPAT()) { V.assets.loaded = true; V.assets.loading = false; V.assets.cbs.forEach((f) => f()); return; }
    const ld = new T.GLTFLoader(); const files = ["props/platformer.glb", "props/proto.glb", "deco/tree_palm.glb", "deco/tree_palmTall.glb", "deco/plant_bushLarge.glb", "deco/rock_largeA.glb", "deco/rock_tallA.glb", "deco/tent.glb", "deco/flagCheckers.glb", "deco/lightPostModern.glb"];
    let n = files.length; const fin = () => { if (--n === 0) { V.assets.loaded = true; V.assets.loading = false; V.assets.cbs.forEach((f) => f()); } };
    files.forEach((f) => ld.load("assets/" + f, (g) => {
      const name = f.split("/").pop().replace(".glb", "");
      if (name === "platformer" || name === "proto") g.scene.children.forEach((c) => { V.assets.props[c.name] = c; });
      else V.assets.props[name] = g.scene;
      g.scene.traverse((o) => { if (o.isMesh && o.material) { const ms = Array.isArray(o.material) ? o.material : [o.material]; ms.forEach((m) => { if (m.map && T.sRGBEncoding) m.map.encoding = T.sRGBEncoding; m.roughness = 0.9; m.metalness = 0; }); } });
      fin();
    }, undefined, fin));
  };
  function prop(name, h) {
    const src = V.assets.props[name]; if (!src) return null; const o = src.clone(true);
    const bb = new T.Box3().setFromObject(o); const sz = bb.getSize(new T.Vector3()); if (h && sz.y > 0) o.scale.multiplyScalar(h / sz.y);
    const bb2 = new T.Box3().setFromObject(o); o.position.y -= bb2.min.y; const g = new T.Group(); g.add(o);
    g.traverse((m) => { if (m.isMesh) { m.castShadow = true; m.receiveShadow = true; } }); return g;
  }
  V.prop = prop;

  // ---------- construction d'une arène ----------
  class ArenaView {
    constructor(scene, A, quality) {
      this.scene = scene; this.A = A; this.q = quality || "high"; this.th = THEMES[A.theme] || THEMES.cloud; this.root = new T.Group(); scene.add(this.root);
      this.surf = []; this.zones = []; this.bars = []; this.sliders = []; this.pegs = []; this.anim = []; this.decor = new T.Group(); this.root.add(this.decor); this.t0 = performance.now();
      this.world = Sim.makeWorld(A, { noShrink: true });
      this.buildSky(); this.buildSurfaces(); this.buildZones(); this.buildHazards(); this.buildBackdrop(); this.buildClipRing();
    }
    mat(color, extra) { return new T.MeshLambertMaterial(Object.assign({ color }, extra || {})); }
    buildSky() {
      const th = this.th; this.scene.fog = new T.FogExp2(new T.Color(th.fog), th.fogD);
      if (this.hemi) this.scene.remove(this.hemi);
      this.hemi = new T.HemisphereLight(new T.Color(th.hemi[0]), new T.Color(th.hemi[1]), 0.85); this.root.add(this.hemi);
      this.sun = new T.DirectionalLight(0xffffff, th.sun * 1.05); this.sun.position.set(-14, 26, 12); this.sun.target.position.set(0, 0, 0);
      const R = this.A.R + 2;
      if (this.q !== "low") { this.sun.castShadow = true; const sc = this.sun.shadow.camera; sc.left = -R; sc.right = R; sc.top = R; sc.bottom = -R; sc.near = 4; sc.far = 80; this.sun.shadow.mapSize.set(this.q === "high" ? 2048 : 1024, this.q === "high" ? 2048 : 1024); this.sun.shadow.bias = -0.0006; this.sun.shadow.normalBias = 0.03; }
      this.root.add(this.sun); this.root.add(this.sun.target);
    }
    surfMats(s, i) {
      const th = this.th, A = this.A; let top;
      const tt = topTex(A.theme);
      if (s.belt) { const tx = chevTex("#ffcf2e").clone(); tx.needsUpdate = true; tx.wrapS = tx.wrapT = T.RepeatWrapping; tx.repeat.set(Math.max(2, Math.round((s.w || 8) / 1.6)), Math.max(1, Math.round((s.d || 3) / 1.6))); top = clipped(new T.MeshLambertMaterial({ map: tx })); top.userData.belt = { tx, s }; }
      else if (s.slip) top = clipped(new T.MeshLambertMaterial({ map: tt, color: 0xcfeeff }));
      else if (s.kind === "crumble") top = clipped(new T.MeshLambertMaterial({ map: hazardTex, color: 0xffe9a8 }));
      else { const m = tt.clone(); m.needsUpdate = true; if (s.k === "rect") { m.wrapS = m.wrapT = T.RepeatWrapping; m.repeat.set(Math.max(1, Math.round((s.w || 4) / 4)), Math.max(1, Math.round((s.d || 4) / 4))); } top = clipped(new T.MeshLambertMaterial({ map: m })); }
      const side = clipped(new T.MeshLambertMaterial({ color: new T.Color(th.side) })); const rim = clipped(new T.MeshLambertMaterial({ color: new T.Color(th.rim) }));
      return { top, side, rim };
    }
    buildSurfaces() {
      const A = this.A, TH = 1.1;
      A.surfaces.forEach((s, i) => {
        const g = new T.Group(); const m = this.surfMats(s, i); let top, body;
        if (s.k === "disc") {
          body = new T.Mesh(new T.CylinderGeometry(s.r, s.r * 0.94, TH, 56, 1), [m.side, m.top, m.top]);
          const ring = new T.Mesh(new T.TorusGeometry(s.r - 0.02, 0.14, 8, 64), m.rim); ring.rotation.x = Math.PI / 2; ring.position.y = -0.02; g.add(ring);
          if (A.theme === "cloud" && !s.slip) this.cloudPuffs(g, s.r);
        } else {
          body = new T.Mesh(new T.BoxGeometry(s.w, TH, s.d), [m.side, m.side, m.top, m.side, m.side, m.side]);
          const e = 0.13; [[0, s.d / 2, s.w, e], [0, -s.d / 2, s.w, e]].forEach(([x, z, w]) => { const b = new T.Mesh(new T.BoxGeometry(w, 0.2, 0.26), m.rim); b.position.set(x, -0.02, z); g.add(b); }); [[s.w / 2], [-s.w / 2]].forEach(([x]) => { const b = new T.Mesh(new T.BoxGeometry(0.26, 0.2, s.d), m.rim); b.position.set(x, -0.02, 0); g.add(b); });
        }
        body.position.y = -TH / 2; body.castShadow = false; body.receiveShadow = true; g.add(body);
        // dessous, pour que la tranche ne soit pas un bloc plat
        if (A.theme !== "cloud") { const under = new T.Mesh(s.k === "disc" ? new T.ConeGeometry(s.r * 0.9, 1.8, 24) : new T.BoxGeometry(s.w * 0.7, 1.6, s.d * 0.7), m.side); under.position.y = -TH - 0.8; if (s.k === "disc") under.rotation.x = Math.PI; g.add(under); }
        this.root.add(g); this.surf[i] = { g, s, m, body };
      });
    }
    cloudPuffs(g, r) {
      const n = Math.round(r * 3.4), mat = clipped(new T.MeshLambertMaterial({ color: 0xffffff }));
      for (let k = 0; k < n; k++) { const a = (k / n) * TAU + Math.sin(k * 12.9) * 0.15, rr = r - 0.1 + Math.sin(k * 7.3) * 0.2; const sp = new T.Mesh(new T.SphereGeometry(0.55 + (Math.sin(k * 3.1) + 1) * 0.22, 12, 10), mat); sp.position.set(Math.cos(a) * rr, -0.25 - (k % 3) * 0.12, Math.sin(a) * rr); sp.scale.y = 0.75; g.add(sp); }
      for (let k = 0; k < Math.round(r * 1.2); k++) { const a = k * 2.4, rr = r * 0.55 * Math.sqrt((k % 7) / 7 + 0.1); const sp = new T.Mesh(new T.SphereGeometry(0.7, 10, 8), mat); sp.position.set(Math.cos(a) * rr, -0.9, Math.sin(a) * rr); sp.scale.set(1.4, 0.8, 1.4); g.add(sp); }
    }
    buildZones() {
      const A = this.A;
      A.zones.forEach((z, i) => {
        const g = new T.Group();
        if (z.k === "spring") {
          const tr = A.theme === "island";
          const base = new T.Mesh(new T.CylinderGeometry(z.r * 0.95, z.r, 0.25, 24), this.mat(tr ? 0xf3e2b3 : 0x3a3f4a)); base.position.y = 0.12; g.add(base);
          const cap = new T.Mesh(new T.SphereGeometry(z.r * 0.92, 20, 12, 0, TAU, 0, Math.PI / 2), tr ? new T.MeshLambertMaterial({ map: dotTex }) : this.mat(0x2fa8ff, { emissive: 0x0a3a66 })); cap.position.y = 0.2; cap.scale.y = 0.55; g.add(cap); g.userData.cap = cap;
          const rg = new T.Mesh(new T.TorusGeometry(z.r * 0.95, 0.09, 6, 28), this.mat(0xffd23d, { emissive: 0x664400 })); rg.rotation.x = Math.PI / 2; rg.position.y = 0.28; g.add(rg);
        } else if (z.k === "slip" || z.k === "mud") {
          const ice = z.k === "slip"; const d = new T.Mesh(new T.CircleGeometry(z.r, 32), ice ? new T.MeshLambertMaterial({ color: A.theme === "factory" ? 0x1a1d24 : 0xbfe8ff, transparent: true, opacity: 0.8, emissive: A.theme === "factory" ? 0x000000 : 0x2a6a99 }) : new T.MeshLambertMaterial({ color: 0x6b4a2a, transparent: true, opacity: 0.92 }));
          d.rotation.x = -Math.PI / 2; d.position.y = 0.03; g.add(d);
          for (let k = 0; k < 5; k++) { const b = new T.Mesh(new T.CircleGeometry(0.25 + (k % 3) * 0.12, 10), new T.MeshBasicMaterial({ color: ice ? 0xffffff : 0x8a6a3a, transparent: true, opacity: ice ? 0.7 : 0.8 })); b.rotation.x = -Math.PI / 2; const a = k * 1.9; b.position.set(Math.cos(a) * z.r * 0.55, 0.05, Math.sin(a) * z.r * 0.55); g.add(b); }
        } else if (z.k === "wind") {
          g.userData.streaks = []; const n = this.q === "low" ? 6 : 14;
          for (let k = 0; k < n; k++) { const m = new T.Mesh(new T.PlaneGeometry(3.2, 0.12), new T.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0, depthWrite: false })); m.rotation.x = -Math.PI / 2; m.rotation.z = Math.atan2(z.dz, z.dx) * -1 + 0; m.userData = { k, ph: Math.random(), off: (Math.random() - 0.5) * 2 * z.r * 0.8, y: 0.6 + Math.random() * 1.4 }; g.add(m); g.userData.streaks.push(m); }
          const ring = new T.Mesh(new T.RingGeometry(z.r - 0.4, z.r, 48), new T.MeshBasicMaterial({ color: 0xff9a3d, transparent: true, opacity: 0, side: T.DoubleSide, depthWrite: false })); ring.rotation.x = -Math.PI / 2; ring.position.y = 0.06; g.add(ring); g.userData.ring = ring;
          const ar = new T.Mesh(new T.PlaneGeometry(2.4, 1.2), new T.MeshBasicMaterial({ map: chevTex("#ffffff"), transparent: true, opacity: 0, depthWrite: false })); ar.rotation.x = -Math.PI / 2; ar.rotation.z = -Math.atan2(z.dz, z.dx); ar.position.y = 0.07; g.add(ar); g.userData.arrow = ar;
        }
        this.root.add(g); this.zones[i] = { g, z };
      });
    }
    buildHazards() {
      const A = this.A;
      A.bars.forEach((b, i) => {
        const g = new T.Group(); const L = b.len * (b.both ? 2 : 1); const rod = new T.Mesh(new T.CylinderGeometry(0.32, 0.32, L, 14), new T.MeshLambertMaterial({ map: stripeTex.clone() })); rod.material.map.needsUpdate = true; rod.material.map.repeat.set(1, Math.max(2, Math.round(L / 1.2))); rod.rotation.z = Math.PI / 2; rod.position.set(b.both ? 0 : b.len / 2, 0.55, 0); rod.castShadow = true; g.add(rod);
        const ends = b.both ? [-b.len, b.len] : [b.len]; ends.forEach((x) => { const c = new T.Mesh(new T.SphereGeometry(0.42, 14, 10), this.mat(0xffd23d, { emissive: 0x664400 })); c.position.set(x, 0.55, 0); c.castShadow = true; g.add(c); });
        const hub = new T.Mesh(new T.CylinderGeometry(0.7, 0.8, 0.7, 20), this.mat(0x3a3f4a)); hub.position.y = 0.35; g.add(hub);
        g.position.set(b.x, 0, b.z); this.root.add(g); this.bars[i] = { g, b };
      });
      A.sliders.forEach((o, i) => {
        const g = new T.Group(); const bd = new T.Mesh(new T.BoxGeometry(o.hw * 2, 1.7, o.hd * 2), new T.MeshLambertMaterial({ map: hazardTex.clone() })); bd.material.map.needsUpdate = true; bd.material.map.repeat.set(Math.max(1, o.hw), Math.max(1, o.hd)); bd.position.y = 0.85; bd.castShadow = true; g.add(bd);
        const rail = new T.Mesh(new T.PlaneGeometry(Math.abs(o.ax) ? o.travel + o.hw * 2 : o.hw * 2, Math.abs(o.az) ? o.travel + o.hd * 2 : o.hd * 2), new T.MeshBasicMaterial({ color: 0xff3b2e, transparent: true, opacity: 0, depthWrite: false })); rail.rotation.x = -Math.PI / 2; rail.position.set(o.x + o.ax * o.travel / 2, 0.06, o.z + o.az * o.travel / 2); this.root.add(rail);
        this.root.add(g); this.sliders[i] = { g, o, rail };
      });
      A.pegs.forEach((p, i) => {
        const g = new T.Group(); const bounce = !!p.bounce;
        const body = new T.Mesh(new T.CylinderGeometry(p.r, p.r * 1.05, bounce ? 1.0 : 1.8, 20), this.mat(bounce ? 0xff4b8a : 0x4a4f5c, bounce ? { emissive: 0x551133 } : {})); body.position.y = bounce ? 0.5 : 0.9; body.castShadow = true; g.add(body);
        const top = new T.Mesh(new T.CylinderGeometry(p.r * 0.7, p.r * 0.9, 0.18, 20), this.mat(bounce ? 0xffe14d : 0xffc83d)); top.position.y = bounce ? 1.05 : 1.85; g.add(top);
        if (!bounce && A.theme === "carousel") { const cone = new T.Mesh(new T.ConeGeometry(p.r * 1.6, 1.6, 20), this.mat(0xe8453c)); cone.position.y = 2.7; g.add(cone); }
        g.position.set(p.x, 0, p.z); this.root.add(g); this.pegs[i] = { g, p, body };
      });
    }
    buildClipRing() {
      const ring = new T.Mesh(new T.RingGeometry(0.97, 1.0, 96), new T.MeshBasicMaterial({ color: 0xff5a3d, transparent: true, opacity: 0.9, side: T.DoubleSide, depthWrite: false })); ring.rotation.x = -Math.PI / 2; ring.position.y = 0.1; ring.visible = false; this.clipRing = ring; this.root.add(ring);
      const wet = new T.Mesh(new T.RingGeometry(1, 1.9, 96), new T.MeshBasicMaterial({ color: 0x1a7ab0, transparent: true, opacity: 0.35, side: T.DoubleSide, depthWrite: false })); wet.rotation.x = -Math.PI / 2; wet.position.y = 0.08; wet.visible = false; this.wet = wet; this.root.add(wet);
    }
    // fond de scène propre à chaque thème
    buildBackdrop() {
      const A = this.A, D = this.decor, th = this.th; const R = A.R;
      const sphere = (r, c, x, y, z, sx, sy, sz, em) => { const m = new T.Mesh(new T.SphereGeometry(r, 14, 10), this.mat(c, em ? { emissive: em } : {})); m.position.set(x, y, z); m.scale.set(sx || 1, sy || 1, sz || 1); D.add(m); return m; };
      const ring = (n, f) => { for (let i = 0; i < n; i++) f(i, (i / n) * TAU + Math.sin(i * 5.1) * 0.12); };
      if (A.theme === "cloud") {
        const cl = V.assets.props["cloud"];
        ring(this.q === "low" ? 14 : 26, (i, a) => { const d = R + 18 + (i % 4) * 7, y = -9 - (i % 5) * 3.5; if (cl) { const c = cl.clone(true); c.scale.setScalar(5 + (i % 4) * 2); c.position.set(Math.cos(a) * d, y, Math.sin(a) * d); c.rotation.y = a * 3; D.add(c); } else sphere(4 + (i % 4), 0xffffff, Math.cos(a) * d, y, Math.sin(a) * d, 1.8, 0.8, 1.2); });
        const sea = new T.Mesh(new T.PlaneGeometry(400, 400), new T.MeshLambertMaterial({ color: 0xe9f4ff })); sea.rotation.x = -Math.PI / 2; sea.position.y = -22; D.add(sea);
        const sun = new T.Mesh(new T.CircleGeometry(14, 32), new T.MeshBasicMaterial({ color: 0xfff1b8, fog: false })); sun.position.set(-70, 34, -90); sun.lookAt(0, 0, 0); D.add(sun);
        this.floaters = []; for (let i = 0; i < 5; i++) { const c = cl ? cl.clone(true) : null; if (c) { c.scale.setScalar(2.2); c.position.set(-30 + i * 16, 5 + (i % 3) * 3, -R - 20 - i * 3); D.add(c); this.floaters.push(c); } }
      } else if (A.theme === "factory") {
        const fl = new T.Mesh(new T.PlaneGeometry(200, 200), new T.MeshLambertMaterial({ color: 0x2a2433 })); fl.rotation.x = -Math.PI / 2; fl.position.y = -14; D.add(fl);
        const lava = new T.Mesh(new T.PlaneGeometry(140, 140), new T.MeshBasicMaterial({ color: 0xff6a2a })); lava.rotation.x = -Math.PI / 2; lava.position.y = -13.5; D.add(lava); this.lava = lava;
        const names = ["Box_A", "Box_B", "Box_C", "Barrel_A", "Barrel_B", "Pallet_Large", "Pillar_A", "Cube_Prototype_Large_A", "Cube_Prototype_Large_B", "Primitive_Pillar"];
        ring(this.q === "low" ? 16 : 34, (i, a) => { const d = R + 7 + (i % 5) * 4.5; const p = prop(names[i % names.length], 3 + (i % 4) * 2.5); if (p) { p.position.set(Math.cos(a) * d, -14, Math.sin(a) * d); p.scale.multiplyScalar(2.4); p.rotation.y = i; D.add(p); } else sphere(2, 0xe85a4f, Math.cos(a) * d, -10, Math.sin(a) * d); });
        for (let i = 0; i < 6; i++) { const a = i * 1.05, d = R + 14; const pipe = new T.Mesh(new T.CylinderGeometry(1.2, 1.2, 40, 12), this.mat(i % 2 ? 0xe8453c : 0x2f78d1)); pipe.position.set(Math.cos(a) * d, 4, Math.sin(a) * d); D.add(pipe); }
      } else if (A.theme === "carousel") {
        const fl = new T.Mesh(new T.PlaneGeometry(260, 260), new T.MeshLambertMaterial({ color: 0x3a1f54 })); fl.rotation.x = -Math.PI / 2; fl.position.y = -16; D.add(fl);
        ring(this.q === "low" ? 8 : 16, (i, a) => { const d = R + 20 + (i % 3) * 6; const tent = new T.Group(); const body = new T.Mesh(new T.CylinderGeometry(5, 5, 6, 12), this.mat(i % 2 ? 0xffe1ec : 0xff6f9c)); body.position.y = 3; const roof = new T.Mesh(new T.ConeGeometry(6.2, 5, 12), this.mat(i % 2 ? 0xff6f9c : 0xffe1ec)); roof.position.y = 8.5; tent.add(body, roof); tent.position.set(Math.cos(a) * d, -16, Math.sin(a) * d); tent.scale.setScalar(1.3 + (i % 3) * 0.3); D.add(tent); });
        this.bulbs = []; for (let i = 0; i < 40; i++) { const a = (i / 40) * TAU, rr = R + 4; const b = new T.Mesh(new T.SphereGeometry(0.28, 8, 6), new T.MeshBasicMaterial({ color: i % 2 ? 0xffe14d : 0xff5a8a })); b.position.set(Math.cos(a) * rr, 5 + Math.sin(a * 3) * 0.8, Math.sin(a) * rr); D.add(b); this.bulbs.push(b); }
      } else if (A.theme === "island") {
        const w = new T.PlaneGeometry(260, 260, 56, 56); w.rotateX(-Math.PI / 2); this.water = new T.Mesh(w, new T.MeshLambertMaterial({ color: 0x1fa3d9, transparent: true, opacity: 0.93 })); this.water.position.y = -1.3; D.add(this.water); this.waterBase = Float32Array.from(w.attributes.position.array);
        const rng = (i) => Math.abs(Math.sin(i * 91.7 + this.A.seed * 0.001)); const trees = ["tree_palm", "tree_palmTall"]; const rocks = ["rock_largeA", "rock_tallA"];
        A.surfaces.forEach((s, k) => { if (k % 2 === 0) { const a = rng(k) * TAU, d = s.r * 0.55; const p = prop(trees[k % 2], 6 + rng(k + 3) * 2.5); if (p) { p.position.set(s.x + Math.cos(a) * d, 0, s.z + Math.sin(a) * d); p.rotation.y = a; this.decor.add(p); } } });
        ring(this.q === "low" ? 6 : 14, (i, a) => { const d = R + 6 + (i % 3) * 7; const p = prop(rocks[i % 2], 4 + (i % 3) * 2); if (p) { p.position.set(Math.cos(a) * d, -1.4, Math.sin(a) * d); p.rotation.y = i; D.add(p); } });
        const sun = new T.Mesh(new T.CircleGeometry(12, 32), new T.MeshBasicMaterial({ color: 0xfff7c9, fog: false })); sun.position.set(70, 40, -90); sun.lookAt(0, 0, 0); D.add(sun);
      } else if (A.theme === "sections") {
        const gr = new T.GridHelper(300, 60, 0x6e5cff, 0x3a2f8a); gr.position.y = -18; D.add(gr);
        ring(this.q === "low" ? 10 : 22, (i, a) => { const d = R + 14 + (i % 4) * 5; const s = 3 + (i % 3) * 2; const m = new T.Mesh(i % 2 ? new T.OctahedronGeometry(s) : new T.BoxGeometry(s, s, s), this.mat([0x35e0c1, 0xff7ab8, 0xffd23d, 0x6e8cff][i % 4], { emissive: 0x112244 })); m.position.set(Math.cos(a) * d, -6 + (i % 5) * 3, Math.sin(a) * d); m.rotation.set(i, i * 2, 0); D.add(m); (this.spinners = this.spinners || []).push(m); });
      } else if (A.theme === "fair") {
        const fl = new T.Mesh(new T.PlaneGeometry(260, 260), new T.MeshLambertMaterial({ color: 0x6a3a4a })); fl.rotation.x = -Math.PI / 2; fl.position.y = -16; D.add(fl);
        const wheel = new T.Group(); const rim = new T.Mesh(new T.TorusGeometry(13, 0.5, 8, 40), this.mat(0xfff0d6)); wheel.add(rim); for (let i = 0; i < 12; i++) { const sp = new T.Mesh(new T.BoxGeometry(0.3, 26, 0.3), this.mat(0xfff0d6)); sp.rotation.z = (i / 12) * Math.PI; wheel.add(sp); const gd = new T.Mesh(new T.BoxGeometry(2, 1.6, 1.6), this.mat([0xff5a6a, 0xffd23d, 0x2fa8ff, 0x7be07b][i % 4])); gd.position.set(Math.cos((i / 12) * TAU) * 13, Math.sin((i / 12) * TAU) * 13, 0); wheel.add(gd); } wheel.position.set(-R - 26, 6, -R - 14); wheel.scale.setScalar(1.4); D.add(wheel); this.wheel = wheel;
        ring(this.q === "low" ? 6 : 12, (i, a) => { const d = R + 22 + (i % 3) * 5; const t = new T.Group(); const body = new T.Mesh(new T.BoxGeometry(7, 5, 7), this.mat(i % 2 ? 0xff5a6a : 0xfff0d6)); body.position.y = 2.5; const roof = new T.Mesh(new T.ConeGeometry(6, 4, 4), this.mat(i % 2 ? 0xfff0d6 : 0xff5a6a)); roof.position.y = 7; roof.rotation.y = Math.PI / 4; t.add(body, roof); t.position.set(Math.cos(a) * d, -16, Math.sin(a) * d); t.scale.setScalar(1.8); D.add(t); });
      } else {
        const pts = new T.BufferGeometry(); const n = 700, arr = new Float32Array(n * 3); for (let i = 0; i < n; i++) { const a = Math.random() * TAU, e = (Math.random() - 0.3) * 1.2, r = 160 + Math.random() * 40; arr[i * 3] = Math.cos(a) * Math.cos(e) * r; arr[i * 3 + 1] = Math.sin(e) * r; arr[i * 3 + 2] = Math.sin(a) * Math.cos(e) * r; } pts.setAttribute("position", new T.BufferAttribute(arr, 3));
        this.stars = new T.Points(pts, new T.PointsMaterial({ color: 0xffffff, size: 1.6, sizeAttenuation: false, fog: false })); D.add(this.stars);
        sphere(16, 0x6e8cff, -60, -30, -90, 1, 1, 1, 0x1a2a66); sphere(7, 0xff7ab8, 70, -25, -70, 1, 1, 1, 0x662244);
        ring(this.q === "low" ? 6 : 12, (i, a) => { const d = R + 12 + (i % 3) * 5; const m = new T.Mesh(new T.OctahedronGeometry(2 + (i % 3)), this.mat(0x38e1ff, { emissive: 0x0a5a7a })); m.position.set(Math.cos(a) * d, -3 + (i % 4) * 3, Math.sin(a) * d); D.add(m); (this.spinners = this.spinners || []).push(m); });
      }
    }
    // ----- mise à jour à chaque image -----
    update(t, tiles, clipR, dt) {
      const W = this.world; W.t = t; Sim.prepare(W); const A = this.A; const now = performance.now() / 1000;
      clipU.value = clipR && clipR > 0 ? clipR : 1e9;
      let tl = 0;
      this.surf.forEach((o, i) => {
        const st = W.ss[i], s = o.s; o.g.position.set(st.cx, 0, st.cz); o.g.rotation.y = -st.rot;
        if (s.kind === "crumble") { const rem = tiles && tiles[tl] !== undefined ? tiles[tl] : -1; tl++; o.g.visible = true; const baseY = 0; if (rem >= 0 && rem < 1.2) { o.g.position.y = baseY + (Math.random() - 0.5) * 0.05; o.g.position.x += (Math.random() - 0.5) * 0.07; } if (rem === 0 || (rem < 0 && rem > -9 && false)) o.g.visible = false; o.g.userData.rem = rem; if (rem > -1 && rem <= 0.0001 && rem !== -1) o.g.visible = false; o.g.visible = !(rem >= 0 && rem <= 0.0001) && !o.g.userData.fallen; }
        if (o.m.top.userData.belt) { const b = o.m.top.userData.belt; const dirx = s.belt.x; b.tx.offset.x = (b.tx.offset.x - dirx * dt * 0.3 / 1.6 * Math.max(0.4, Sim.dramp(t))) % 1; }
      });
      this.zones.forEach((o, i) => {
        const p = W.zs[i]; const z = o.z; o.g.position.set(p.x, 0, p.z); if (z.host != null) o.g.rotation.y = -W.ss[z.host].rot;
        if (z.k === "wind") { const ws = Sim.windState(z, t); const u = o.g.userData; const a = Math.atan2(z.dz, z.dx);
          u.streaks.forEach((m) => { const sp = 16; const ph = ((m.userData.ph + now * (sp / (z.r * 2))) % 1); const pos = (ph - 0.5) * z.r * 2.2; const perp = m.userData.off; m.position.set(Math.cos(a) * pos - Math.sin(a) * perp, m.userData.y, Math.sin(a) * pos + Math.cos(a) * perp); m.material.opacity = ws === 2 ? 0.55 * Math.sin(ph * Math.PI) : 0; m.rotation.z = -a; });
          u.ring.material.opacity = ws === 1 ? 0.35 + 0.35 * Math.sin(now * 14) : ws === 2 ? 0.25 : 0; u.arrow.material.opacity = ws === 1 ? 0.7 + 0.3 * Math.sin(now * 14) : 0; u.arrow.visible = true; }
        else if (z.k === "spring" && o.g.userData.cap) { const cap = o.g.userData.cap; const q = o.sq || 0; cap.scale.y = 0.55 * (1 - q * 0.45); cap.scale.x = cap.scale.z = 1 + q * 0.18; o.sq = Math.max(0, q - dt * 4); }
      });
      this.bars.forEach((o) => { const a = Sim.barAngle(o.b, t); o.g.rotation.y = -a; });
      this.sliders.forEach((o) => { const b = Sim.sliderBox(o.o, t); o.g.position.set(b.x, 0, b.z); o.rail.material.opacity = b.warn ? 0.28 + 0.22 * Math.sin(now * 16) : 0; });
      if (this.clipRing) { const on = clipR && clipR < 1e8 && clipR < A.R + 1.5; this.clipRing.visible = !!on; if (on) { this.clipRing.scale.setScalar(clipR); this.clipRing.material.opacity = 0.6 + 0.3 * Math.sin(now * 8); } }
      if (this.wet) { const tide = A.tide; const on = !!tide; this.wet.visible = on; if (on) { const rmin = tide.R0 - tide.depth; this.wet.position.y = 0.04; this.wet.scale.setScalar(1); this.wet.geometry.dispose(); this.wet.geometry = new T.RingGeometry(rmin, tide.R0 + 3, 72); } }
      if (this.water) { const pos = this.water.geometry.attributes.position, b = this.waterBase; for (let i = 0; i < pos.count; i++) { const x = b[i * 3], z = b[i * 3 + 2]; pos.array[i * 3 + 1] = Math.sin(x * 0.18 + now * 1.3) * 0.25 + Math.cos(z * 0.21 + now * 1.1) * 0.22; } pos.needsUpdate = true; if (A.tide) this.water.position.y = -1.3 + 0.0; }
      if (this.lava) this.lava.material.color.setHSL(0.04 + Math.sin(now) * 0.01, 1, 0.5 + Math.sin(now * 2.3) * 0.05);
      if (this.spinners) this.spinners.forEach((m, i) => { m.rotation.y += dt * 0.4; m.rotation.x += dt * 0.2; m.position.y += Math.sin(now + i) * dt * 0.3; });
      if (this.wheel) this.wheel.rotation.z += dt * 0.12;
      if (this.bulbs) this.bulbs.forEach((b, i) => { b.material.color.setHex(((i + Math.floor(now * 3)) % 2) ? 0xffe14d : 0xff5a8a); });
      if (this.floaters) this.floaters.forEach((c, i) => { c.position.x += dt * (0.4 + i * 0.1); if (c.position.x > 50) c.position.x = -50; });
    }
    squash(i) { if (this.zones[i]) this.zones[i].sq = 1; }
    nearestSpring(x, z) { let bi = -1, bd = 1e9; this.zones.forEach((o, i) => { if (o.z.k !== "spring") return; const p = this.world.zs[i]; const d = Math.hypot(p.x - x, p.z - z); if (d < bd) { bd = d; bi = i; } }); return bd < 3 ? bi : -1; }
    dispose() {
      this.scene.remove(this.root);
      this.root.traverse((o) => { if (o.isMesh || o.isPoints) { if (o.geometry) o.geometry.dispose(); } });
      this.scene.fog = null;
    }
  }
  V.ArenaView = ArenaView;
})();

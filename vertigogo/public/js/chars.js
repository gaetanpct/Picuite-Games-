// ============================================================
// VERTIGOGO — Personnages animés (KayKit, licence CC0), couleurs, chapeaux et plaques de nom
// ============================================================
(function () {
  const T = THREE; const TAU = Math.PI * 2;
  const FILES = ["Knight", "Barbarian", "Mage", "Rogue", "Rogue_Hooded"];
  const NAMES = ["Chevalier", "Barbare", "Mage", "Voleuse", "Capuche"];
  const HATS = ["Aucun", "Couronne", "Chapeau de fête", "Casquette à hélice", "Cornes", "Casquette", "Oreilles de lapin", "Fleur", "Haut de forme", "Auréole"];
  const TRAILS = ["Aucune", "Étincelles", "Cœurs", "Étoiles", "Bulles", "Braises"];
  const B = { buf: {}, loading: false, ready: false, waiters: [] };
  const api = { FILES, NAMES, HATS, TRAILS };
  window.VgChars = api;

  api.load = function (cb) {
    if (B.ready) return cb && cb(); if (cb) B.waiters.push(cb); if (B.loading) return; B.loading = true;
    let n = FILES.length; const fin = () => { if (--n === 0) { B.ready = true; B.loading = false; const w = B.waiters; B.waiters = []; w.forEach((f) => f()); } };
    FILES.forEach((f) => { fetch("assets/chars/" + f + ".glb").then((r) => r.arrayBuffer()).then((b) => { B.buf[f] = b; fin(); }).catch(() => fin()); });
  };
  api.ready = () => B.ready && !(window.PicuiteGL && PicuiteGL.compat && PicuiteGL.compat());

  // ---------- chapeaux dessinés, en mètres ----------
  const mat = (c, e) => new T.MeshLambertMaterial({ color: c, emissive: e || 0x000000 });
  function hat(idx) {
    const g = new T.Group(); g.userData.spin = null;
    const add = (geo, m, x, y, z) => { const o = new T.Mesh(geo, m); o.position.set(x || 0, y || 0, z || 0); o.castShadow = false; g.add(o); return o; };
    switch (idx) {
      case 1: { add(new T.CylinderGeometry(0.2, 0.22, 0.14, 16), mat(0xffd23d, 0x553b00), 0, 0.07, 0); for (let i = 0; i < 5; i++) { const a = (i / 5) * TAU; const s = add(new T.ConeGeometry(0.06, 0.16, 6), mat(0xffd23d, 0x553b00), Math.cos(a) * 0.19, 0.22, Math.sin(a) * 0.19); add(new T.SphereGeometry(0.035, 8, 6), mat(i % 2 ? 0xe8453c : 0x2f78d1), Math.cos(a) * 0.19, 0.31, Math.sin(a) * 0.19); } break; }
      case 2: { const c = add(new T.ConeGeometry(0.17, 0.42, 14), mat(0xff5aa0), 0, 0.21, 0); add(new T.SphereGeometry(0.05, 8, 6), mat(0xffe14d), 0, 0.44, 0); add(new T.TorusGeometry(0.12, 0.018, 6, 16), mat(0xffe14d), 0, 0.1, 0).rotation.x = Math.PI / 2; break; }
      case 3: { add(new T.SphereGeometry(0.2, 16, 10, 0, TAU, 0, Math.PI / 2), mat(0xe8453c), 0, 0.03, 0); add(new T.CylinderGeometry(0.02, 0.02, 0.1, 6), mat(0x444444), 0, 0.24, 0); const p = new T.Group(); p.position.y = 0.3; add(new T.BoxGeometry(0.36, 0.012, 0.07), mat(0x2f78d1), 0, 0, 0); p.add(g.children[g.children.length - 1]); const b2 = new T.Mesh(new T.BoxGeometry(0.07, 0.012, 0.36), mat(0xffd23d)); p.add(b2); g.add(p); g.userData.spin = p; break; }
      case 4: { add(new T.SphereGeometry(0.19, 14, 8, 0, TAU, 0, Math.PI / 2), mat(0x8a8f99), 0, 0.03, 0); for (const s of [-1, 1]) { const h = add(new T.ConeGeometry(0.05, 0.32, 8), mat(0xfff0d0), s * 0.22, 0.2, 0); h.rotation.z = -s * 0.7; } break; }
      case 5: { add(new T.SphereGeometry(0.2, 16, 10, 0, TAU, 0, Math.PI / 2), mat(0x2f78d1), 0, 0.03, 0); add(new T.CylinderGeometry(0.2, 0.2, 0.02, 14, 1, false, 0, Math.PI), mat(0x1d4f8f), 0, 0.03, 0.2).rotation.x = 0.1; add(new T.SphereGeometry(0.03, 8, 6), mat(0xffffff), 0, 0.23, 0); break; }
      case 6: { for (const s of [-1, 1]) { const e = add(new T.SphereGeometry(0.07, 10, 8), mat(0xf6eef0), s * 0.1, 0.3, 0); e.scale.set(1, 3.4, 0.55); e.rotation.z = -s * 0.12; const i = add(new T.SphereGeometry(0.045, 10, 8), mat(0xff9ab8), s * 0.1, 0.3, 0.025); i.scale.set(1, 3.0, 0.4); i.rotation.z = -s * 0.12; } break; }
      case 7: { add(new T.CylinderGeometry(0.012, 0.012, 0.2, 5), mat(0x3aa653), 0, 0.12, 0); for (let i = 0; i < 6; i++) { const a = (i / 6) * TAU; add(new T.SphereGeometry(0.055, 8, 6), mat(i % 2 ? 0xff6fa8 : 0xffa8c8), Math.cos(a) * 0.075, 0.26, Math.sin(a) * 0.075); } add(new T.SphereGeometry(0.05, 8, 6), mat(0xffe14d), 0, 0.26, 0); break; }
      case 8: { add(new T.CylinderGeometry(0.14, 0.15, 0.3, 16), mat(0x1c1c24), 0, 0.17, 0); add(new T.CylinderGeometry(0.26, 0.26, 0.025, 20), mat(0x1c1c24), 0, 0.03, 0); add(new T.CylinderGeometry(0.152, 0.152, 0.06, 16), mat(0xe8453c), 0, 0.09, 0); break; }
      case 9: { const t = add(new T.TorusGeometry(0.17, 0.025, 8, 24), mat(0xffe14d, 0x886600), 0, 0.42, 0); t.rotation.x = Math.PI / 2; break; }
      default: return null;
    }
    return g;
  }
  api.hat = hat;

  function nameSprite(name, hex) {
    const c = document.createElement("canvas"); c.width = 256; c.height = 72; const g = c.getContext("2d");
    g.font = "700 34px Fredoka, Arial, sans-serif"; const w = Math.min(244, g.measureText(name).width + 34);
    g.fillStyle = "rgba(20,16,40,0.72)"; const x = (256 - w) / 2; g.beginPath(); g.roundRect ? g.roundRect(x, 8, w, 54, 24) : g.rect(x, 8, w, 54); g.fill();
    g.fillStyle = hex; g.beginPath(); g.arc(x + 20, 35, 9, 0, TAU); g.fill();
    g.fillStyle = "#fff"; g.textBaseline = "middle"; g.textAlign = "left"; g.fillText(name, x + 36, 37, w - 44);
    const t = new T.CanvasTexture(c); const m = new T.SpriteMaterial({ map: t, transparent: true, depthTest: false, depthWrite: false }); const s = new T.Sprite(m); s.scale.set(2.4, 0.675, 1); s.renderOrder = 20; return s;
  }

  const ANIMS = { idle: "Idle", run: "Running_A", walk: "Walking_A", jump: "Jump_Start", fall: "Jump_Idle", land: "Jump_Land", hang: "Spellcast_Raise", climb: "Interact", cheer: "Cheer", hit: "Hit_B" };
  const soft = (() => { const c = document.createElement("canvas"); c.width = c.height = 64; const g = c.getContext("2d"); const gr = g.createRadialGradient(32, 32, 0, 32, 32, 32); gr.addColorStop(0, "rgba(255,255,255,1)"); gr.addColorStop(1, "rgba(255,255,255,0)"); g.fillStyle = gr; g.fillRect(0, 0, 64, 64); return new T.CanvasTexture(c); })();

  class Actor {
    constructor(scene, opts) {
      this.scene = scene; this.opts = opts; this.group = new T.Group(); this.model = null; this.mixer = null; this.act = {}; this.cur = null; this.pose = new T.Group(); this.group.add(this.pose);
      this.fy = 0; this.ready = false; this.tag = null; this.hatObj = null; this.over = null; this.fade = 1;
      const col = new T.Color(opts.color || "#ffffff");
      this.ring = new T.Mesh(new T.RingGeometry(0.5, 0.64, 28), new T.MeshBasicMaterial({ color: col, transparent: true, opacity: 0.0, side: T.DoubleSide, depthWrite: false })); this.ring.rotation.x = -Math.PI / 2; this.group.add(this.ring);
      this.ph = new T.Mesh(new T.CapsuleGeometry ? new T.CapsuleGeometry(0.3, 0.7, 4, 10) : new T.CylinderGeometry(0.3, 0.3, 1.2, 10), new T.MeshLambertMaterial({ color: col })); this.ph.position.y = 0.85; this.pose.add(this.ph);
      if (!opts.me) { this.tag = nameSprite(opts.name || "", opts.color || "#fff"); this.tag.position.y = 2.3; this.group.add(this.tag); }
      scene.add(this.group);
      if (api.ready()) this.build(); else if (!(window.PicuiteGL && PicuiteGL.compat && PicuiteGL.compat())) api.load(() => { if (!this.dead) this.build(); });
    }
    build() {
      const file = FILES[this.opts.char % FILES.length], buf = B.buf[file]; if (!buf || !T.GLTFLoader) return;
      new T.GLTFLoader().parse(buf.slice(0), "", (g) => {
        if (this.dead) return; const m = g.scene; const bb = new T.Box3().setFromObject(m); const h = bb.max.y - bb.min.y || 2; const sc = 1.62 / h; m.scale.setScalar(sc); m.position.y = -bb.min.y * sc;
        this.model = m; this.pose.remove(this.ph); this.ph = null; this.pose.add(m);
        const hasHat = this.opts.hat > 0; const col = new T.Color(this.opts.color || "#fff"); let head = null;
        m.traverse((o) => {
          if (o.isBone && o.name === "head") head = o;
          if (o.isMesh || o.isSkinnedMesh) { o.castShadow = true; o.frustumCulled = false; if (/Cape/.test(o.name)) { o.material = o.material.clone(); o.material.map = null; o.material.color = col.clone(); } if (hasHat && /Helmet|Hat/.test(o.name)) o.visible = false; if (o.material && o.material.map && T.sRGBEncoding) o.material.map.encoding = T.sRGBEncoding; }
        });
        this.mixer = new T.AnimationMixer(m);
        g.animations.forEach((c) => { const a = this.mixer.clipAction(c); this.act[c.name] = a; });
        if (head && this.opts.hat > 0) { const ho = hat(this.opts.hat); if (ho) { m.updateMatrixWorld(true); const ws = new T.Vector3(); head.getWorldScale(ws); ho.scale.setScalar(1 / (ws.x * 1.0)); let hm = null; m.traverse((o) => { if (o.isMesh && /_Head/.test(o.name)) hm = o; });
          if (hm) { const hb = new T.Box3().setFromObject(hm); const topW = new T.Vector3((hb.min.x + hb.max.x) / 2, hb.max.y, (hb.min.z + hb.max.z) / 2); const loc = head.worldToLocal(topW.clone()); ho.position.set(loc.x, loc.y - 0.035 / ws.y, loc.z); const wide = (hb.max.x - hb.min.x); const k = Math.max(0.9, Math.min(1.25, wide / 0.52)); ho.scale.multiplyScalar(k); this.hatTop = hb.max.y; } else ho.position.y = 0.42 / ws.y * 0.5;
          head.add(ho); this.hatObj = ho; } }
        this.ready = true; this.play("idle", 0);
      }, () => {});
    }
    play(name, fade, once, speed, start) {
      const a = this.act[ANIMS[name]]; if (!a) return; const cur = this.cur;
      if (cur && cur.name === name && !once) { if (speed) a.timeScale = speed; return; }
      a.reset(); a.enabled = true; a.setEffectiveWeight(1); a.timeScale = speed == null ? 1 : speed; if (start) a.time = start;
      if (once) { a.setLoop(T.LoopOnce, 1); a.clampWhenFinished = true; } else { a.setLoop(T.LoopRepeat, Infinity); a.clampWhenFinished = false; }
      a.play(); if (cur && cur.act !== a) cur.act.fadeOut(fade == null ? 0.12 : fade); a.fadeIn(fade == null ? 0.12 : fade);
      this.cur = { name, act: a, once: !!once };
    }
    // s : {x,y,z,ry,a (0 repos,1 course,2 saut,3 chute,4 suspendu,5 escalade,6 joie), vh}
    show(s, dt) {
      const g = this.group; g.position.set(s.x, s.y, s.z);
      const target = s.ry; let d = target - this.fy; while (d > Math.PI) d -= TAU; while (d < -Math.PI) d += TAU; this.fy += d * Math.min(1, dt * 16); this.pose.rotation.y = this.fy;
      let an = "idle", sp = 1, once = false;
      switch (s.a) { case 1: an = "run"; sp = Math.max(0.7, Math.min(1.5, (s.vh || 6) / 6)); if ((s.vh || 0) < 3.6) { an = "walk"; sp = 1.1; } break; case 2: an = "jump"; once = true; sp = 1.6; break; case 3: an = "fall"; break; case 4: an = "hang"; break; case 5: an = "climb"; sp = 1.5; break; case 6: an = "cheer"; break; default: an = "idle"; }
      if (an === "hang") { this.play("hang", 0.1, true, 0); const a = this.act[ANIMS.hang]; if (a) { a.paused = false; a.timeScale = 0; a.time = a.getClip().duration * 0.7; } }
      else this.play(an, an === "jump" ? 0.05 : 0.14, once, sp);
      if (this.mixer) this.mixer.update(dt);
      this.pose.rotation.x = 0; if (this.model) { const tl = s.a === 3 ? 0.18 : s.a === 2 ? -0.1 : 0; this.model.rotation.x += (tl - this.model.rotation.x) * Math.min(1, dt * 10); }
      if (this.hatObj && this.hatObj.userData.spin) this.hatObj.userData.spin.rotation.y += dt * 18;
      if (this.tag) { this.tag.position.y = 2.2 + (this.hatObj ? 0.35 : 0); this.tag.visible = s.tag !== false; }
      this.ring.material.opacity = s.ring ? 0.85 : 0;
      this.pose.visible = s.vis !== false;
    }
    dispose() { this.dead = true; this.scene.remove(this.group); this.group.traverse((o) => { if (o.geometry) o.geometry.dispose(); }); if (this.mixer) this.mixer.stopAllAction(); }
  }
  api.Actor = Actor; api.softTex = soft;
})();

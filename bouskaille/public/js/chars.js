// ============================================================
// BOUSKAILLE — Personnages animés (KayKit, licence CC0), couleurs, chapeaux et plaques de nom
// ============================================================
(function () {
  const T = THREE; const TAU = Math.PI * 2;
  const FILES = ["Knight", "Barbarian", "Mage", "Rogue", "Rogue_Hooded"];
  const NAMES = ["Chevalier", "Barbare", "Mage", "Voleuse", "Capuche"];
  const HATS = ["Aucun", "Couronne", "Chapeau de fête", "Casquette à hélice", "Cornes", "Casquette", "Oreilles de lapin", "Fleur", "Haut de forme", "Auréole"];
  const TRAILS = ["Aucune", "Étincelles", "Cœurs", "Étoiles", "Bulles", "Braises"];
  const B = { buf: {}, loading: false, ready: false, waiters: [] };
  const api = { FILES, NAMES, HATS, TRAILS };
  window.BouskChars = api;

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

  const ANIMS = { idle: "Idle", run: "Running_A", walk: "Walking_A", charge: "Spellcast_Raise", dash: "Dodge_Forward", rec: "Block_Hit", stun: "Hit_B", air: "Jump_Idle", fall: "Jump_Idle", land: "Jump_Land", kick: "Unarmed_Melee_Attack_Kick", hit: "Hit_A", cheer: "Cheer", lose: "Lie_Idle", spin: "2H_Melee_Attack_Spin" };

  class Actor {
    constructor(scene, opts) {
      this.scene = scene; this.opts = opts; this.group = new T.Group(); this.model = null; this.mixer = null; this.act = {}; this.cur = null; this.pose = new T.Group(); this.group.add(this.pose);
      this.fx = 0; this.turn = 0; this.ready = false; this.tilt = 0; this.tag = null; this.hatObj = null;
      const col = new T.Color(opts.color || "#ffffff");
      // anneau coloré sous les pieds, toujours visible
      this.ring = new T.Mesh(new T.RingGeometry(0.52, 0.68, 32), new T.MeshBasicMaterial({ color: col, transparent: true, opacity: 0.9, side: T.DoubleSide, depthWrite: false })); this.ring.rotation.x = -Math.PI / 2; this.ring.position.y = 0.04; this.group.add(this.ring);
      this.chg = new T.Mesh(new T.RingGeometry(0.72, 0.9, 40, 1, 0, TAU), new T.MeshBasicMaterial({ color: 0xffd23d, transparent: true, opacity: 0, side: T.DoubleSide, depthWrite: false })); this.chg.rotation.x = -Math.PI / 2; this.chg.position.y = 0.05; this.group.add(this.chg);
      this.shadow = new T.Mesh(new T.CircleGeometry(0.55, 20), new T.MeshBasicMaterial({ map: window.BouskScene.softTex, color: 0x000000, transparent: true, opacity: 0.45, depthWrite: false })); this.shadow.rotation.x = -Math.PI / 2; this.shadow.position.y = 0.02; this.group.add(this.shadow);
      // en attendant le modèle, une capsule colorée
      this.ph = new T.Mesh(new T.CapsuleGeometry ? new T.CapsuleGeometry(0.4, 0.6, 4, 10) : new T.CylinderGeometry(0.4, 0.4, 1.2, 10), new T.MeshLambertMaterial({ color: col })); this.ph.position.y = 0.7; this.pose.add(this.ph);
      this.tag = nameSprite(opts.name || "", opts.color || "#fff"); this.tag.position.y = 2.35; this.group.add(this.tag);
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
        if (head && this.opts.hat > 0) { const ho = hat(this.opts.hat); if (ho) { m.updateMatrixWorld(true); const ws = new T.Vector3(); head.getWorldScale(ws); ho.scale.setScalar(1 / (ws.x * 1.0)); ho.position.y = 0.42 / ws.y * 0.5; head.add(ho); this.hatObj = ho; } }
        this.ready = true; this.play("idle", 0);
      }, () => {});
    }
    play(name, fade, once, speed) {
      const a = this.act[ANIMS[name]]; if (!a) return; const cur = this.cur;
      if (cur && cur.name === name && !once) { if (speed) a.timeScale = speed; return; }
      a.reset(); a.enabled = true; a.setEffectiveWeight(1); a.timeScale = speed || 1;
      if (once) { a.setLoop(T.LoopOnce, 1); a.clampWhenFinished = true; } else { a.setLoop(T.LoopRepeat, Infinity); a.clampWhenFinished = false; }
      a.play(); if (cur && cur.act !== a) cur.act.fadeOut(fade == null ? 0.12 : fade); a.fadeIn(fade == null ? 0.12 : fade);
      this.cur = { name, act: a, once: !!once, t: 0 };
    }
    oneShot(name, speed) { this.over = { name, until: performance.now() + (name === "kick" ? 380 : name === "hit" ? 420 : 500) }; this.play(name, 0.05, true, speed || 1.4); }
    // appelé à chaque image avec l'état affiché
    show(s, dt) {
      const g = this.group; g.position.set(s.x, Math.max(s.y, -30), s.z);
      // orientation lissée
      const target = Math.PI / 2 - s.a; let d = target - this.fx; while (d > Math.PI) d -= TAU; while (d < -Math.PI) d += TAU; this.fx += d * Math.min(1, dt * 14); this.pose.rotation.y = this.fx;
      const speed = Math.hypot(s.vx, s.vz); const st = s.st; let an = "idle", sp = 1;
      const busy = this.over && performance.now() < this.over.until;
      if (st === "charge") { an = "charge"; } else if (st === "dash") { an = "dash"; sp = 1.5; } else if (st === "rec") { an = "rec"; } else if (st === "stun") { an = "stun"; } else if (st === "fall" || st === "air") { an = "fall"; } else if (speed > 3.2) { an = "run"; sp = Math.max(0.7, Math.min(1.5, speed / 6)); } else if (speed > 0.7) { an = "walk"; sp = Math.max(0.6, speed / 2.6); } else an = "idle";
      if (s.cheer) an = "cheer"; if (s.lose) an = "lose";
      if (!busy) { this.over = null; if (an === "charge") { this.play("charge", 0.08, true, 0); const a = this.act[ANIMS.charge]; if (a) { a.paused = false; a.timeScale = 0; a.time = Math.min(a.getClip().duration * 0.97, (0.15 + s.ch * 0.85) * a.getClip().duration * 0.6); } } else this.play(an, 0.14, false, sp); }
      if (this.mixer) this.mixer.update(dt);
      // inclinaisons
      const tl = st === "dash" ? 0.35 : st === "fall" ? 0.5 : st === "rec" ? 0.2 : 0; this.tilt += (tl - this.tilt) * Math.min(1, dt * 12); this.pose.rotation.x = 0; if (this.model) { this.model.rotation.x = this.tilt; }
      const sq = st === "charge" ? 1 - 0.12 * s.ch : 1; this.pose.scale.set(1 + (1 - sq) * 0.6, sq, 1 + (1 - sq) * 0.6);
      // anneau et jauge de charge
      this.chg.material.opacity = st === "charge" ? 0.35 + 0.65 * s.ch : 0; if (st === "charge") { const k = 0.8 + s.ch * 0.7; this.chg.scale.set(k, k, 1); this.chg.material.color.setHSL(0.14 - s.ch * 0.14, 1, 0.55); }
      this.ring.material.opacity = s.alive ? (s.inv ? 0.4 + 0.5 * Math.sin(performance.now() / 60) : 0.9) : 0; this.ring.scale.setScalar(st === "rec" ? 1.25 : 1);
      this.shadow.position.y = 0.02 - Math.min(0, s.y) * 0 ; const h = Math.max(0, s.y); this.shadow.material.opacity = (s.st === "fall" ? 0.0 : 0.45) * (1 - Math.min(0.7, h / 4)); this.shadow.scale.setScalar(1 - Math.min(0.5, h / 8));
      if (this.hatObj && this.hatObj.userData.spin) this.hatObj.userData.spin.rotation.y += dt * 18;
      g.visible = s.alive || s.st === "fall"; if (s.st === "fall" && s.y < -9) g.visible = false;
      this.tag.visible = s.alive && s.y > -4; this.tag.position.y = 2.25 + (this.hatObj ? 0.35 : 0);
      if (this.cap) this.cap.visible = g.visible;
    }
    dispose() { this.dead = true; this.scene.remove(this.group); this.group.traverse((o) => { if (o.geometry) o.geometry.dispose(); if (o.material && o.material.map && o.material.map !== window.BouskScene.softTex) { /* texture partagée par le modèle */ } }); if (this.mixer) this.mixer.stopAllAction(); }
  }
  api.Actor = Actor;
})();

// ============================================================
// PÉTARD MOUILLÉ — Modèles 3D (KayKit, licence CC0) pour le décor et l'équipage
// Tout est facultatif, si le chargement échoue le jeu garde ses formes simples.
// ============================================================
(function () {
  const T = THREE;
  const M = { state: 0, env: null, P: {}, chars: {}, waiters: [], tinted: {}, rad: {} };
  const CHARS = ["Knight", "Barbarian", "Mage", "Rogue", "Rogue_Hooded"];
  const FACE_CHAR = [0, 1, 2, 3, 4, 0, 1, 2];
  const FACE_TINT = [null, null, null, null, null, "#ffd27a", "#ff9a6a", "#aab4ff"];
  const FACE_NAMES = ["Chevalier", "Barbare", "Mage", "Voleuse", "Capuche", "Chevalier doré", "Barbare cuivré", "Mage lunaire"];
  const ANIM = { idle: "Idle", push: "Spellcast_Raise", hit: "Hit_B", cheer: "Cheer", work: "Interact" };

  M.compat = () => !!(window.PicuiteGL && PicuiteGL.compat && PicuiteGL.compat());
  M.ok = () => M.state === 2 && !M.compat();
  M.FACE_NAMES = FACE_NAMES;

  M.load = function (cb) {
    if (M.state === 2) return cb && cb(); if (cb) M.waiters.push(cb); if (M.state === 1 || M.state === 3) return;
    if (M.compat() || !T.GLTFLoader) { M.state = 3; return; }
    M.state = 1; let todo = 1 + CHARS.length; const fin = () => { if (--todo > 0) return; M.state = M.env ? 2 : 3; const w = M.waiters; M.waiters = []; w.forEach((f) => { try { f(); } catch (e) { /* rien */ } }); };
    fetch("assets/env.glb").then((r) => r.arrayBuffer()).then((b) => { new T.GLTFLoader().parse(b, "", (g) => { M.env = g.scene; g.scene.children.forEach((n) => { M.P[n.name] = n; }); fin(); }, () => fin()); }).catch(() => fin());
    CHARS.forEach((f) => { fetch("assets/chars/" + f + ".glb").then((r) => r.arrayBuffer()).then((b) => { M.chars[f] = b; fin(); }).catch(() => fin()); });
  };

  const shade = (g, on) => { g.traverse((o) => { if (o.isMesh) { o.castShadow = on; o.receiveShadow = on; } }); };
  function tintedSource(name, tint) {
    const k = name + tint; if (M.tinted[k]) return M.tinted[k]; const src = M.P[name].clone(true); const c = new T.Color(tint);
    src.traverse((o) => { if (o.isMesh) { o.material = o.material.clone(); o.material.color.multiply(c); } }); M.tinted[k] = src; return src;
  }
  M.prop = function (name, tint, shadows) {
    if (!M.P[name]) return null; const g = (tint ? tintedSource(name, tint) : M.P[name]).clone(true); const h = new T.Group(); h.add(g); shade(h, !!shadows); return h;
  };
  M.radius = function (name) { if (M.rad[name] != null) return M.rad[name]; const p = M.P[name]; if (!p) return 1; const b = new T.Box3().setFromObject(p); const r = Math.max(b.max.x - b.min.x, b.max.z - b.min.z) / 2; M.rad[name] = r; return r; };
  M.height = function (name) { const p = M.P[name]; if (!p) return 1; const b = new T.Box3().setFromObject(p); return b.max.y - b.min.y; };

  // ---------- décors par type de rive ----------
  // [nom, échelle min, échelle max, poids, teinte]
  const SET = {
    prairie: { near: [["trees_A_large", 3.4, 5, 5], ["trees_A_medium", 3.4, 5, 5], ["tree_single_A", 4, 6.5, 4], ["tree_single_B", 4, 6.5, 4], ["trees_B_medium", 3.4, 5, 3], ["rock_single_A", 2, 4, 2], ["rock_single_C", 2, 4, 1], ["building_home_A_red", 3.4, 4.6, 1], ["building_windmill_red", 3.4, 4.2, 0.4], ["building_home_B_red", 3.4, 4.6, 1], ["barrel", 2.2, 3, 1], ["crate_A_big", 2.2, 3, 0.6], ["flag_blue", 4, 5, 0.5]], back: ["hills_A_trees", "hills_B_trees", "hills_C_trees", "mountain_A_grass_trees", "hills_A"], bush: ["trees_A_small", "trees_B_small"] },
    ville: { near: [["building_A", 2.6, 3.8, 3], ["building_B", 2.6, 3.8, 3], ["building_C", 2.6, 3.8, 3], ["building_D", 2.6, 3.8, 2], ["building_E", 2.6, 3.8, 2], ["building_F", 2.6, 3.8, 2], ["building_G", 2.6, 3.8, 2], ["building_H", 2.6, 3.8, 2], ["watertower", 2.6, 3.2, 0.5], ["streetlight", 3.2, 3.8, 2], ["trafficlight_A", 3.2, 3.8, 1], ["car_taxi", 3, 3.4, 1], ["car_sedan", 3, 3.4, 1], ["car_police", 3, 3.4, 0.6], ["dumpster", 3, 3.4, 0.6], ["bench", 3, 3.4, 0.6], ["firehydrant", 3.2, 3.8, 0.5]], back: ["building_G", "building_E", "building_H", "building_F"], bush: ["bush"], backScale: [6, 9] },
    canyon: { near: [["rock_single_A", 4, 8, 4], ["rock_single_B", 4, 8, 4], ["rock_single_D", 4, 8, 3], ["rock_single_E", 4, 8, 3], ["tent", 3.5, 4.5, 0.5], ["cactus_medium_A", 4, 6, 1.2], ["cactus_medium_B", 4, 6, 1.2], ["tree_dead_medium", 3, 4, 0.8], ["barrel", 2.2, 3, 0.5]], back: ["mountain_A", "mountain_B", "mountain_C"], bush: ["rock_single_C"], tint: "#ffb27a", backTint: "#f0a070" },
    jungle: { near: [["trees_A_large", 4, 6, 5], ["trees_B_large", 4, 6, 5], ["tree_single_A", 5, 7.5, 4], ["tree_single_B", 5, 7.5, 4], ["trees_A_medium", 4, 5.5, 4], ["rock_single_A", 2, 3.5, 1.2], ["building_lumbermill_red", 3.4, 4, 0.3], ["tent", 3.5, 4.5, 0.4]], back: ["hills_A_trees", "hills_B_trees", "mountain_B_grass_trees", "mountain_C_grass_trees"], bush: ["trees_A_small", "trees_B_small"], tint: "#9affb0", backTint: "#b4f0b8" },
    glacier: { near: [["trees_B_large", 3.4, 5, 4], ["trees_B_medium", 3.4, 5, 4], ["tree_single_B", 4, 6, 3], ["rock_single_A", 3, 5.5, 3], ["rock_single_D", 3, 5.5, 2], ["tent", 3.5, 4.5, 0.6], ["building_tower_A_red", 3, 3.8, 0.4]], back: ["mountain_A", "mountain_B", "mountain_C"], bush: ["rock_single_C"], tint: "#e4f2ff", backTint: "#f4fbff" },
    marais: { near: [["tree_dead_large", 2.6, 3.8, 4], ["tree_dead_medium", 2.8, 4, 4], ["trees_A_medium", 3.4, 5, 2], ["rock_single_B", 2, 3.5, 1.5], ["lantern_standing", 3.2, 3.8, 1], ["gravestone", 3, 3.8, 0.8], ["barrel", 2.2, 3, 0.5]], back: ["hills_A_trees", "hills_B_trees", "hills_C_trees"], bush: ["trees_A_small"], tint: "#c8d890", backTint: "#b8c880", water: ["waterlily_A", "waterlily_B", "waterplant_A", "waterplant_B", "waterplant_C"] },
    parc: { near: [["tent", 3.6, 5, 3], ["flag_red", 4, 5.5, 2], ["flag_yellow", 4, 5.5, 2], ["flag_blue", 4, 5.5, 2], ["flag_green", 4, 5.5, 2], ["building_market_red", 3.2, 4, 1], ["target", 3, 4, 1], ["barrel", 2.2, 3, 0.8], ["trees_A_medium", 3.4, 5, 3], ["tree_single_A", 4, 6, 2], ["pumpkin_orange", 2.4, 3.4, 1.2]], back: ["hills_A_trees", "hills_C", "mountain_A_grass_trees"], bush: ["trees_A_small"] },
    desert: { near: [["cactus_medium_A", 4, 7, 4], ["cactus_medium_B", 4, 7, 4], ["cactus_small_A", 4, 6, 3], ["rock_single_A", 3, 6, 3], ["rock_single_E", 3, 6, 3], ["tent", 3.5, 4.5, 1], ["tree_dead_medium", 3, 4, 1], ["building_well_red", 3, 4, 0.4]], back: ["mountain_A", "mountain_B", "mountain_C"], bush: ["rock_single_C"], tint: "#ffe0a0", backTint: "#f4d090" },
    egout: { near: [["Pillar_A", 5, 7, 3], ["Pillar_B", 5, 7, 3], ["barrel", 2.4, 3.2, 2], ["Barrel_A", 3, 4, 1.5], ["crate_A_big", 2.4, 3.2, 1.5], ["pallet", 2.6, 3.4, 1], ["Box_A", 3, 4, 1], ["sack", 2.4, 3.2, 1], ["wall_straight", 3, 4, 1.5], ["fence_stone_straight", 3, 4, 1]], back: ["wall_straight", "building_scaffolding"], bush: ["Box_B"], tint: "#9ab0a8", backTint: "#788a84", backScale: [5, 7] },
    fete: { near: [["pumpkin_orange_jackolantern", 2.8, 4, 3], ["pumpkin_yellow", 2.8, 4, 2], ["lantern_standing", 3.4, 4, 3], ["arch", 3, 4, 1.4], ["tree_pine_orange_large", 3.4, 5, 3], ["tree_pine_yellow_large", 3.4, 5, 3], ["tent", 3.6, 5, 2], ["flag_red", 4, 5, 1.5], ["flag_yellow", 4, 5, 1.5], ["crypt", 3, 3.6, 0.4]], back: ["hills_A", "hills_B", "mountain_A"], bush: ["pumpkin_orange"], tint: "#ffd8f4", backTint: "#d8b8ff" },
  };
  M.setFor = (biomeKey, propKey) => SET[biomeKey] || SET.prairie;

  M.decor = function (group, lv, B, biomeKey, WRL, shadows, rnd) {
    const S = SET[biomeKey] || SET.prairie; const n = lv.n; let total = 0; const cap = 230;
    const pickW = (list) => { let t = 0; list.forEach((e) => { if (M.P[e[0]]) t += e[3]; }); let r = rnd() * t; for (const e of list) { if (!M.P[e[0]]) continue; r -= e[3]; if (r <= 0) return e; } return list.find((e) => M.P[e[0]]) || null; };
    const frame = (i) => { const a = Math.max(0, i - 1), b = Math.min(n - 1, i + 1); let tx = lv.x[b] - lv.x[a], tz = lv.z[b] - lv.z[a]; const l = Math.hypot(tx, tz) || 1; return [tx / l, tz / l]; };
    // premier plan, le long des deux rives
    for (let i = 3; i < n - 3 && total < cap; i += 3) for (const sd of [1, -1]) {
      if (rnd() < 0.3) continue; const e = pickW(S.near); if (!e) continue; const [tx, tz] = frame(i); const nx = -tz * sd, nz = tx * sd; const sc = e[1] + (e[2] - e[1]) * rnd(); const rad = M.radius(e[0]) * sc;
      const off = lv.hw[i] + 4 + rad + rnd() * 16; const p = M.prop(e[0], S.tint, shadows); if (!p) continue;
      p.scale.setScalar(sc); p.position.set(lv.x[i] + nx * off, lv.h[i] + 1.7, lv.z[i] + nz * off); p.rotation.y = rnd() * 6.28; group.add(p); total++;
    }
    // petite végétation collée à la rive
    if (S.bush) for (let i = 2; i < n - 2 && total < cap + 60; i += 2) for (const sd of [1, -1]) {
      if (rnd() < 0.55) continue; const nm = S.bush[Math.floor(rnd() * S.bush.length)]; if (!M.P[nm]) continue; const [tx, tz] = frame(i); const nx = -tz * sd, nz = tx * sd; const sc = 2 + rnd() * 1.6; const off = lv.hw[i] + 2.6 + rnd() * 3;
      const p = M.prop(nm, S.tint, false); p.scale.setScalar(sc); p.position.set(lv.x[i] + nx * off, lv.h[i] + 1.6, lv.z[i] + nz * off); p.rotation.y = rnd() * 6.28; group.add(p); total++;
    }
    // loin, collines et montagnes pour donner de la profondeur
    for (let i = 4; i < n - 4; i += 5) for (const sd of [1, -1]) {
      const nm = S.back[Math.floor(rnd() * S.back.length)]; if (!M.P[nm]) continue; const [tx, tz] = frame(i); const nx = -tz * sd, nz = tx * sd; const bs = S.backScale || [8, 14]; const sc = bs[0] + (bs[1] - bs[0]) * rnd(); const off = lv.hw[i] + 40 + rnd() * 55;
      const p = M.prop(nm, S.backTint || S.tint, false); p.scale.setScalar(sc); p.position.set(lv.x[i] + nx * off, lv.h[i] - 1.5, lv.z[i] + nz * off); p.rotation.y = rnd() * 6.28; group.add(p);
    }
    // nuages
    for (let i = 6; i < n - 6; i += 9) { if (rnd() < 0.2) continue; const p = M.prop(rnd() < 0.55 ? "cloud_big" : "cloud_small", null, false); if (!p) continue; const sc = 5 + rnd() * 5; p.scale.setScalar(sc); p.position.set(lv.x[i] + (rnd() - 0.5) * 120, lv.h[i] + 38 + rnd() * 26, lv.z[i] + (rnd() - 0.5) * 120); p.rotation.y = rnd() * 6; p.userData.cloud = true; group.add(p); }
    // sur l'eau, nénuphars et plantes (marais)
    if (S.water) for (let i = 4; i < n - 4; i += 3) { if (rnd() < 0.4) continue; const nm = S.water[Math.floor(rnd() * S.water.length)]; if (!M.P[nm]) continue; const [tx, tz] = frame(i); const nx = -tz, nz = tx; const sd = rnd() < 0.5 ? 1 : -1; const off = lv.hw[i] - 0.8 - rnd() * 2.2; const p = M.prop(nm, null, false); p.scale.setScalar(2 + rnd() * 1.6); p.position.set(lv.x[i] + nx * off * sd, lv.h[i] + 0.12, lv.z[i] + nz * off * sd); p.rotation.y = rnd() * 6; group.add(p); }
  };

  // ---------- personnages ----------
  M.character = function (look, hex, hatBuilder, shadows) {
    const g = new T.Group(); const face = (look.face | 0) % 8, which = FACE_CHAR[face], file = CHARS[which], buf = M.chars[file]; if (!buf) return null;
    const holder = new T.Group(); g.add(holder); const out = { group: g, holder, mixer: null, actions: {}, cur: null, head: null, hat: null, ready: false };
    new T.GLTFLoader().parse(buf.slice(0), "", (gl) => {
      const m = gl.scene; const bb = new T.Box3().setFromObject(m); const h = bb.max.y - bb.min.y || 2; const sc = 1.85 / h; m.scale.setScalar(sc); m.position.y = -bb.min.y * sc; holder.add(m);
      const cape = new T.Color(hex), tint = FACE_TINT[face] ? new T.Color(FACE_TINT[face]) : null; let head = null, headMesh = null; const hasHat = (look.hat | 0) > 0;
      m.traverse((o) => {
        if (o.isBone && o.name === "head") head = o;
        if (o.isMesh || o.isSkinnedMesh) {
          o.castShadow = !!shadows; o.frustumCulled = false; if (o.material) o.material = o.material.clone();
          if (/_Head/.test(o.name)) headMesh = o;
          if (/Cape/.test(o.name)) { o.material.map = null; o.material.color = cape.clone(); } else if (tint && o.material.color) o.material.color.multiply(tint);
          if (hasHat && /Helmet|_Hat/.test(o.name)) o.visible = false; if (/Knife|Throwable/.test(o.name)) o.visible = false;
        }
      });
      out.mixer = new T.AnimationMixer(m); gl.animations.forEach((c) => { out.actions[c.name] = out.mixer.clipAction(c); });
      if (head && hasHat && hatBuilder) { const ho = hatBuilder(look.hat | 0, hex); if (ho) { m.updateMatrixWorld(true); const ws = new T.Vector3(); head.getWorldScale(ws); ho.scale.setScalar(1 / ws.x * 0.92); const hb = new T.Box3().setFromObject(headMesh || head); const top = new T.Vector3((hb.min.x + hb.max.x) / 2, hb.max.y, (hb.min.z + hb.max.z) / 2); const loc = head.worldToLocal(top); ho.position.set(loc.x, loc.y - 0.02 / ws.y, loc.z); head.add(ho); out.hat = ho; } }
      out.head = head; out.ready = true; out.play("idle");
    }, () => {});
    out.play = function (k) { const a = out.actions[ANIM[k] || k]; if (!a || out.cur === a) return; a.reset(); a.enabled = true; a.setEffectiveWeight(1); a.setLoop(T.LoopRepeat, Infinity); a.play(); if (out.cur) out.cur.fadeOut(0.15); a.fadeIn(0.15); out.cur = a; out.curName = k; };
    return out;
  };
  window.FTModels = M;
})();

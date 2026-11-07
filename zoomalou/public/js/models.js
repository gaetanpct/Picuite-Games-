// ============================================================
// ZOOMALOU — Modèles 3D Kenney (licence CC0, kenney.nl), chargés en arrière-plan.
// Tant qu'ils ne sont pas prêts, ou si le chargement échoue, le jeu garde ses modèles faits main.
// ============================================================
(function () {
  const T = THREE;
  const M = { ready: false, failed: false, cars: {}, deco: {}, atlas: null, waiters: [] };
  const BASE = "assets/";
  // une voiture Kenney pour chaque voiture du jeu
  const CAR_FILES = { bolide: "cars/race", petard: "cars/race-future", rallye: "trucks/vehicle-truck-green", toupie: "cars/hatchback-sports", bouboule: "cars/van", mastodonte: "cars/truck", libellule: "cars/sedan-sports", volt: "cars/sedan", sauterelle: "trucks/vehicle-truck-yellow", comete: "cars/suv-luxury" };
  // hauteur visée en mètres pour chaque décor, le modèle d'origine est mis à l'échelle
  const DECO_H = { tree_palm: 8.5, tree_palmTall: 10, tree_pineTallA: 9, tree_pineRoundA: 7.5, tree_default: 7.5, tree_oak_fall: 7, tree_detailed: 8, tree_cone: 7, tree_thin_dark: 8.5, rock_largeA: 2.2, rock_tallA: 4.2, stone_tallC: 3.4, cactus_tall: 4.2, cactus_short: 2.4, plant_bushLarge: 1.6, stump_round: 0.9,
    grandStandCovered: 7.5, flagCheckers: 5.5, bannerTowerRed: 8, bannerTowerGreen: 8, lightPostModern: 8.5, lightPostLarge: 8, billboard: 6, tent: 4, pylon: 1.1, overheadLights: 6 };
  const DECO_FILES = Object.keys(DECO_H);
  // les décors du jeu remplacés par des modèles, plusieurs variantes possibles
  M.DECOR_MAP = { palm: ["tree_palm", "tree_palmTall"], pine: ["tree_pineTallA", "tree_pineRoundA"], tree: ["tree_default", "tree_oak_fall", "tree_detailed", "tree_cone"], rock: ["rock_largeA", "rock_tallA", "stone_tallC"], cactus: ["cactus_tall", "cactus_short", "cactus_tall"], fougere: ["plant_bushLarge"], palmier2: ["tree_palmTall", "tree_palm"] };

  M.onReady = (fn) => { if (M.ready) fn(); else M.waiters.push(fn); };
  M.load = function (withDeco) {
    if (M.started) return; M.started = true;
    if (!T.GLTFLoader || (window.PicuiteGL && PicuiteGL.compat && PicuiteGL.compat())) { M.failed = true; return; }
    const loader = new T.GLTFLoader(); const jobs = [];
    const one = (url) => new Promise((res) => loader.load(url, (g) => res(g), undefined, () => res(null)));
    const atlasP = {}; ["cars", "trucks"].forEach((dir) => { atlasP[dir] = new Promise((res) => { const im = new Image(); im.onload = () => { try { const c = document.createElement("canvas"); c.width = im.width; c.height = im.height; c.getContext("2d").drawImage(im, 0, 0); ATL[dir] = labelAtlas(c); } catch (e) { ATL[dir] = null; } res(); }; im.onerror = () => res(); im.src = BASE + dir + "/Textures/colormap.png"; }); });
    Object.keys(CAR_FILES).forEach((id) => { const dir = CAR_FILES[id].split("/")[0]; jobs.push(Promise.all([one(BASE + CAR_FILES[id] + ".glb"), atlasP[dir]]).then(([g]) => { if (g) M.cars[id] = prepCar(g.scene, ATL[dir]); })); });
    if (withDeco) DECO_FILES.forEach((k) => jobs.push(one(BASE + "deco/" + k + ".glb").then((g) => { if (g) M.deco[k] = prepDeco(g.scene, DECO_H[k]); })));
    Promise.all(jobs).then(() => { M.ready = Object.keys(M.cars).length > 0; M.failed = !M.ready; const w = M.waiters; M.waiters = []; if (M.ready) w.forEach((fn) => { try { fn(); } catch (e) { console.error(e); } }); });
  };
  const linear = (o) => { o.traverse((m) => { if (m.isMesh && m.material) { const mats = Array.isArray(m.material) ? m.material : [m.material]; mats.forEach((mt) => { if (mt.map) { mt.map.encoding = T.LinearEncoding; mt.map.needsUpdate = true; } }); } }); };

  // ---------- voitures ----------
  // découpe la palette en plages de couleur continues. Chaque plage est une teinte de la palette, souvent en dégradé
  const ATL = {};
  function labelAtlas(c) {
    const LW = c.width, LH = c.height; const d = c.getContext("2d").getImageData(0, 0, LW, LH).data; const LAB = new Int32Array(LW * LH).fill(-1); let next = 0; const st = [];
    const near = (a, b) => Math.abs(d[a * 4] - d[b * 4]) + Math.abs(d[a * 4 + 1] - d[b * 4 + 1]) + Math.abs(d[a * 4 + 2] - d[b * 4 + 2]) <= 18;
    for (let p = 0; p < LW * LH; p++) { if (LAB[p] >= 0) continue; LAB[p] = next; st.push(p); while (st.length) { const q = st.pop(); const x = q % LW, y = (q - x) / LW; const nb = [x > 0 ? q - 1 : -1, x < LW - 1 ? q + 1 : -1, y > 0 ? q - LW : -1, y < LH - 1 ? q + LW : -1]; for (const r of nb) if (r >= 0 && LAB[r] < 0 && near(q, r)) { LAB[r] = next; st.push(r); } } next++; }
    // saturation moyenne de chaque plage. Une peinture est vive, les vitres, le gris et le noir ne le sont pas
    const sum = new Float64Array(next * 4); for (let p = 0; p < LW * LH; p++) { const k = LAB[p] * 4; sum[k] += d[p * 4]; sum[k + 1] += d[p * 4 + 1]; sum[k + 2] += d[p * 4 + 2]; sum[k + 3]++; }
    const SAT = new Float32Array(next); for (let k = 0; k < next; k++) { const n = sum[k * 4 + 3] || 1; const r = sum[k * 4] / n / 255, g = sum[k * 4 + 1] / n / 255, b = sum[k * 4 + 2] / n / 255; const mx = Math.max(r, g, b), mn = Math.min(r, g, b); SAT[k] = mx > 0.15 && mx - mn > 0.01 ? (mx - mn) / mx : 0; }
    return { canvas: c, LAB, SAT, LW, LH, tinted: {} };
  }
  // la teinte de carrosserie est la case de la palette la plus utilisée par la caisse. On la repeint de la couleur du joueur
  function prepCar(scene, A) {
    const LAB = A && A.LAB, SAT = A && A.SAT, LW = A ? A.LW : 0, LH = A ? A.LH : 0;
    linear(scene); scene.updateMatrixWorld(true);
    const box = new T.Box3().setFromObject(scene); const size = box.getSize(new T.Vector3());
    const scale = 2.05 / Math.max(0.5, size.x); let tile = null; const w = {};
    scene.traverse((o) => {
      if (!o.isMesh || !/body/i.test(o.name + (o.parent ? o.parent.name : ""))) return; const g = o.geometry; const uv = g.attributes.uv; if (!uv) return; const idx = g.index; const pos = g.attributes.position;
      const n = idx ? idx.count : pos.count; const a = new T.Vector3(), b = new T.Vector3(), c = new T.Vector3();
      for (let t = 0; t < n; t += 3) { const i0 = idx ? idx.getX(t) : t, i1 = idx ? idx.getX(t + 1) : t + 1, i2 = idx ? idx.getX(t + 2) : t + 2; a.fromBufferAttribute(pos, i0); b.fromBufferAttribute(pos, i1); c.fromBufferAttribute(pos, i2); const area = b.sub(a).cross(c.sub(a)).length();
        const u = (uv.getX(i0) + uv.getX(i1) + uv.getX(i2)) / 3, v = (uv.getY(i0) + uv.getY(i1) + uv.getY(i2)) / 3; if (!LAB) continue; const px = Math.min(LW - 1, Math.floor(clamp01(u) * LW)), py = Math.min(LH - 1, Math.floor(clamp01(v) * LH)); const key = LAB[py * LW + px]; w[key] = (w[key] || 0) + area; }
    });
    let best = 0; Object.keys(w).forEach((k) => { const sv = SAT ? SAT[+k] : 1; const sc2 = w[k] * (sv > 0.3 ? 1 : 0.02); if (sc2 > best) { best = sc2; tile = +k; } });
    const wheels = []; scene.traverse((o) => { if (/^wheel/i.test(o.name)) wheels.push(o.name); });
    return { scene, scale, minY: box.min.y, len: size.z * scale, tile, wheels, mats: {}, A };
  }
  const clamp01 = (v) => (v < 0 ? 0 : v > 1 ? 1 : v);
  // palette repeinte, une par couleur de joueur
  function tintTexture(A, tile, hex, src) {
    if (!A || tile == null) return src; const LAB = A.LAB; const key = tile + "|" + hex; if (A.tinted[key]) return A.tinted[key];
    const c = document.createElement("canvas"); c.width = A.canvas.width; c.height = A.canvas.height; const g = c.getContext("2d"); g.drawImage(A.canvas, 0, 0);
    const im = g.getImageData(0, 0, c.width, c.height); const d = im.data;
    let L0 = 0, cnt = 0; for (let p = 0; p < LAB.length; p++) if (LAB[p] === tile) { L0 += 0.3 * d[p * 4] + 0.59 * d[p * 4 + 1] + 0.11 * d[p * 4 + 2]; cnt++; } L0 = L0 / Math.max(1, cnt) || 1;
    const col = new T.Color(hex); const r0 = col.r * 255, g0 = col.g * 255, b0 = col.b * 255;
    for (let p = 0; p < LAB.length; p++) { if (LAB[p] !== tile) continue; const i = p * 4; const k = Math.max(0.55, Math.min(1.35, (0.3 * d[i] + 0.59 * d[i + 1] + 0.11 * d[i + 2]) / L0)); d[i] = Math.min(255, r0 * k); d[i + 1] = Math.min(255, g0 * k); d[i + 2] = Math.min(255, b0 * k); }
    g.putImageData(im, 0, 0);
    const t = new T.CanvasTexture(c); t.flipY = false; t.encoding = T.LinearEncoding; if (src) { t.wrapS = src.wrapS; t.wrapT = src.wrapT; t.magFilter = src.magFilter; t.minFilter = src.minFilter; } A.tinted[key] = t; return t;
  }
  // renvoie un groupe prêt à poser, l'avant vers +z, les roues séparées pour tourner, ou null
  M.car = function (carId, hex, ghost) {
    const C = M.cars[carId]; if (!C) return null;
    const obj = C.scene.clone(true); const key = hex + (ghost ? "g" : "");
    let mat = C.mats[key];
    if (!mat) { let src = null; C.scene.traverse((o) => { if (o.isMesh && o.material && o.material.map && !src) src = o.material; }); mat = src ? src.clone() : new T.MeshStandardMaterial({ color: hex }); if (src && src.map) mat.map = tintTexture(C.A, C.tile, hex, src.map); mat.roughness = 0.5; mat.metalness = 0.15; if (ghost) { mat.transparent = true; mat.opacity = 0.42; mat.depthWrite = false; } C.mats[key] = mat; }
    obj.traverse((o) => { if (o.isMesh) { o.material = mat; o.castShadow = !ghost; o.receiveShadow = false; } });
    const root = new T.Group(); obj.scale.setScalar(C.scale); obj.position.y = -C.minY * C.scale; root.add(obj); obj.updateMatrixWorld(true);
    // chaque roue passe dans un pivot pour tourner et braquer sans perdre sa pose d'origine
    const wheels = []; const nodes = []; obj.traverse((o) => { if (/^wheel/i.test(o.name) && o.parent && !/^wheel/i.test(o.parent.name)) nodes.push(o); });
    nodes.forEach((o) => { const pv = new T.Group(); pv.rotation.order = "YXZ"; pv.position.copy(o.position); o.parent.add(pv); o.position.set(0, 0, 0); pv.add(o); wheels.push({ holder: pv, front: /front/i.test(o.name) }); });
    return { root, wheels, len: C.len };
  };

  // ---------- décors ----------
  // pièces à plat (géométrie non indexée, matrice et couleur) pour être fusionnées avec les autres décors
  function prepDeco(scene, hgt) {
    linear(scene); scene.updateMatrixWorld(true); const box = new T.Box3().setFromObject(scene); const size = box.getSize(new T.Vector3()); const s = (hgt || 4) / Math.max(0.05, size.y);
    const fix = new T.Matrix4().makeScale(s, s, s).multiply(new T.Matrix4().makeTranslation(-(box.min.x + box.max.x) / 2, -box.min.y, -(box.min.z + box.max.z) / 2));
    const parts = []; let textured = false;
    scene.traverse((o) => { if (!o.isMesh) return; const mats = Array.isArray(o.material) ? o.material : [o.material]; if (mats.some((m) => m.map)) textured = true; const geo = o.geometry.index ? o.geometry.toNonIndexed() : o.geometry; const m0 = mats[0]; const cc = m0.color ? m0.color.clone() : new T.Color("#888"); if (m0.emissive) cc.add(m0.emissive.clone().multiplyScalar(m0.emissiveIntensity || 0)); parts.push({ geo, mw: new T.Matrix4().multiplyMatrices(fix, o.matrixWorld), c: cc }); });
    return { scene, fix, parts, textured, scale: s };
  }
  M.decoParts = (k) => (M.deco[k] ? M.deco[k].parts : null);
  // copie complète d'un décor, pour les modèles texturés et les quelques objets de bord de piste
  M.decoObject = function (k) { const D = M.deco[k]; if (!D) return null; const o = D.scene.clone(true); const g = new T.Group(); const wrap = new T.Group(); wrap.applyMatrix4(D.fix); wrap.add(o); g.add(wrap); g.traverse((m) => { if (m.isMesh) { m.castShadow = true; } }); return g; };
  window.ZoomModels = M;
})();

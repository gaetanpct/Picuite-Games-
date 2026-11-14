// ============================================================
// VERTIGOGO — Objets du quotidien du parcours (partagé client, serveur et tests)
// Chaque objet a ses propres boîtes de collision, la forme de ses zones d'atterrissage
// ne ressemble donc pas à celle de l'objet d'à côté. Le repère local est u (sens de la montée), v (côté), y (haut).
// Les boîtes des modèles sont données en fractions de leur volume englobant, les autres en mètres.
// ============================================================
(function (root, factory) { if (typeof module === "object" && module.exports) module.exports = factory(); else root.VgProps = factory(); })(typeof self !== "undefined" ? self : this, function () {
  const BB = {"tree_single_A":[-0.288,-0.103,-0.302,0.286,1.094,0.245],"tree_single_B":[-0.342,-0.1,-0.36,0.342,1.113,0.36],"trees_A_large":[-0.968,-0.013,-0.991,0.977,0.913,0.975],"trees_B_large":[-0.907,-0.022,-0.986,0.942,1.153,0.947],"rock_single_A":[-0.149,0,-0.157,0.149,0.069,0.127],"rock_single_B":[-0.142,0,-0.128,0.145,0.135,0.122],"rock_single_C":[-0.185,0,-0.182,0.159,0.195,0.162],"rock_single_D":[-0.142,0,-0.13,0.145,0.163,0.12],"rock_single_E":[-0.255,0,-0.185,0.233,0.195,0.163],"hill_single_A":[-0.519,0,-0.402,0.591,0.307,0.408],"cloud_big":[-1.797,-0.884,-1.094,1.81,1.062,1.148],"cloud_small":[-1.163,-0.908,-0.963,1.175,0.932,0.829],"barrel":[-0.101,0,-0.101,0.101,0.212,0.101],"crate_A_big":[-0.105,0,-0.105,0.105,0.21,0.105],"crate_A_small":[-0.07,0,-0.07,0.07,0.14,0.07],"crate_long_A":[-0.2,0,-0.1,0.2,0.15,0.1],"tent":[-0.258,0,-0.258,0.258,0.516,0.258],"wheelbarrow":[-0.119,0,-0.213,0.119,0.188,0.293],"sack":[-0.053,-0.002,-0.086,0.053,0.062,0.074],"ladder":[-0.127,0,-0.017,0.127,0.77,0.033],"pallet":[-0.15,0,-0.15,0.15,0.08,0.15],"building_scaffolding":[-0.928,-0.003,-1.087,0.972,1.296,1.022],"building_home_A_red":[-0.396,0,-0.469,0.396,0.93,0.385],"building_tower_A_red":[-0.497,0,-0.573,0.497,2.192,0.58],"building_tower_B_red":[-0.599,0,-0.691,0.599,2.485,0.691],"building_windmill_red":[-0.558,0,-0.379,0.568,1.458,0.438],"building_well_red":[-0.315,0,-0.375,0.337,0.826,0.375],"building_church_red":[-0.514,0,-0.56,0.514,1.645,0.595],"building_market_red":[-0.901,-0.006,-0.715,0.898,0.976,0.601],"building_castle_red":[-0.988,0,-1.128,0.988,3.979,1.128],"building_bridge_A":[-0.667,-1,-0.962,0.667,0.25,0.962],"flag_red":[-0.027,0,-0.242,0.028,0.277,0.022],"flag_blue":[-0.027,0,-0.242,0.028,0.277,0.022],"resource_lumber":[-0.345,0,-0.164,0.341,0.21,0.167],"resource_stone":[-0.211,0,-0.177,0.211,0.28,0.181],"bucket_water":[-0.07,0,-0.07,0.07,0.105,0.07],"target":[-0.12,0,-0.1,0.12,0.302,0.042],"building_stage_A":[-0.481,-0.006,-0.342,0.566,0.28,0.533],"fence_wood_straight":[-1.05,-0.05,-0.577,-0.95,0.5,0.577],"wall_straight":[-1,0,-0.4,1,1.1,0.4],"building_watermill_red":[-0.525,-0.35,-0.37,0.525,1.218,0.866],"building_mine_red":[-0.817,0,-1.02,0.789,1.137,0.9],"building_tavern_red":[-0.595,0,-0.702,0.577,1.397,0.63],"building_lumbermill_red":[-0.686,-0.004,-0.459,0.681,1.704,0.73],"chair_A":[-0.375,0,-0.47,0.375,1.258,0.375],"chair_B_wood":[-0.375,0,-0.47,0.375,1.258,0.375],"chair_stool_wood":[-0.375,0,-0.375,0.375,0.5,0.375],"table_medium":[-1,0,-1,1,1,1],"table_medium_long":[-1.5,0,-1,1.5,1,1],"table_low":[-1.2,0,-0.75,1.2,0.5,0.75],"table_small":[-0.5,0,-0.5,0.5,1,0.5],"couch":[-1.5,0,-0.75,1.5,1.224,0.85],"armchair":[-0.9,0,-0.75,0.9,1.224,0.85],"bed_single_A":[-0.8,0,-1.5,0.8,1,1.5],"bed_double_A":[-1.55,0,-1.5,1.55,1,1.5],"shelf_A_big":[-1,-0.3,0,1,0.1,0.5],"shelf_B_large":[-1,-0.1,0,1,0.3,0.5],"shelf_A_small":[-0.5,-0.3,0,0.5,0.1,0.5],"cabinet_medium":[-1,0,-0.5,1,1,0.502],"cabinet_small":[-0.5,0,-0.5,0.5,1,0.502],"lamp_standing":[-0.5,0,-0.5,0.5,2.52,0.5],"lamp_table":[-0.5,-0.002,-0.5,0.5,1.02,0.5],"cactus_medium_A":[-0.44,0,-0.418,0.44,0.827,0.418],"cactus_medium_B":[-0.44,0,-0.418,0.44,0.827,0.418],"book_set":[-0.39,-0.25,-0.177,0.39,0.25,0.188],"pillow_A":[-0.325,-0.1,-0.25,0.325,0.1,0.25],"pillow_B":[-0.325,-0.1,-0.25,0.325,0.1,0.25],"bed_double_B":[-1.55,0,-1.5,1.55,1,1.5],"chair_C":[-0.375,0,-0.561,0.375,1.203,0.375],"couch_pillows":[-1.5,0,-0.75,1.5,1.224,0.85],"armchair_pillows":[-0.9,0,-0.75,0.9,1.224,0.85],"cabinet_medium_decorated":[-1,0,-0.5,1.042,1.827,0.502],"kitchentable_A_large":[-1.5,-0.004,-1,1.5,1,1],"kitchentable_B_large":[-1.5,-0.004,-1,1.5,1,1],"stove_multi":[-1,0,-1.03,1,1.2,1.258],"fridge_A":[-1,0,-1,1,2.5,1.24],"fridge_B":[-1,0,-1,1,2.5,1.24],"kitchencounter_straight_A":[-1,0,-1,1,1,1.042],"pot_large":[-1,0,-0.6,1,0.75,0.6],"pot_A_stew":[-0.7,0,-0.5,0.7,0.516,0.5],"pan_006":[-0.375,0,-0.375,0.375,0.35,0.9],"dishrack":[-0.6,0,-0.6,0.6,0.6,0.6],"oven":[-1,0,-1.03,1,2.02,1.318],"kitchencabinet":[-1,2,0,1,4,1.042],"table_round_A":[-1.5,0,-1.5,1.5,1,1.5],"crate_potatoes":[-1,0,-1,1,0.966,1],"jar_A_large":[-0.25,0,-0.25,0.25,0.75,0.25],"jar_C_large":[-0.25,0,-0.25,0.25,0.75,0.25],"shelf_papertowel":[-1,-0.91,0,1,0.15,0.6],"extractorhood":[-1,2,0,1,4,1.609],"kitchencabinet_corner":[-1,2,0,1,4,2],"stew_pot":[-0.368,0.266,-0.368,0.368,0.516,0.368],"crate_tomatoes":[-1,0,-1,1,0.923,1],"cuttingboard":[-0.75,0,-0.5,0.75,0.15,0.5],"pot_B_stew":[-0.7,0,-0.5,0.7,0.516,0.5],"stove_single_countertop":[-0.873,0.93,-0.873,0.873,1.208,0.873],"kitchentable_sink_large_decorated":[-1.5,0,-1,1.5,1.947,1],"crate_buns":[-1,0,-1,1,0.802,1],"building_A":[-1,0,-1,1,1.65,1],"building_B":[-1,0,-1,1,1.65,1],"building_C":[-1,0,-1,1,2.977,1],"building_D":[-1,0,-1,1,2.97,1.02],"building_E":[-1.003,0,-1,1.003,2.35,1],"building_F":[-1.003,0,-1,1.003,2.35,1],"building_G":[-1.003,0,-1,1.003,2.976,1],"building_H":[-1.003,0,-1,1.003,3.05,1],"car_taxi":[-0.209,-0.061,-0.472,0.209,0.373,0.466],"car_sedan":[-0.209,-0.061,-0.472,0.209,0.308,0.466],"car_police":[-0.209,-0.061,-0.472,0.209,0.352,0.466],"car_stationwagon":[-0.209,-0.061,-0.472,0.209,0.308,0.466],"car_hatchback":[-0.209,-0.061,-0.395,0.209,0.308,0.411],"streetlight":[-0.239,0,-0.035,0.03,0.96,0.035],"trafficlight_A":[-0.135,0,-0.04,0.04,0.729,0.111],"trafficlight_B":[-0.239,0,-0.04,0.04,0.96,0.111],"watertower":[-0.249,0,-0.249,0.249,0.67,0.249],"dumpster":[-0.283,0,-0.176,0.283,0.317,0.176],"bench":[-0.2,0,-0.075,0.2,0.1,0.075],"firehydrant":[-0.068,0,-0.065,0.068,0.225,0.066],"bush":[-0.089,0,-0.1,0.1,0.381,0.1],"trash_A":[-0.06,0,-0.067,0.067,0.052,0.067],"box_A":[-0.1,0,-0.1,0.1,0.176,0.103],"pumpkin_orange":[-0.501,-0.003,-0.501,0.501,0.697,0.501],"pumpkin_yellow":[-0.501,-0.003,-0.501,0.501,0.697,0.501],"pumpkin_orange_jackolantern":[-0.75,-0.004,-0.7,0.75,1.296,0.7],"tree_dead_large":[-1.322,-0.272,-0.726,0.98,4.794,0.651],"tree_dead_medium":[-0.485,-0.3,-0.233,1.323,3.889,0.233],"tree_dead_large_decorated":[-1.322,-0.272,-0.855,0.98,5.145,0.759],"tree_pine_orange_large":[-2.363,-0.555,-2.076,2.397,6.92,2.079],"tree_pine_yellow_large":[-2.363,-0.555,-2.076,2.397,6.92,2.079],"tree_pine_orange_medium":[-1.677,-0.48,-1.355,1.653,5.392,1.766],"gravestone":[-0.7,0,-0.2,0.7,1.6,0.2],"lantern_standing":[-0.32,0,-0.32,0.32,0.925,0.32],"arch":[-2.109,0,-0.385,2.109,4.414,0.385],"fence":[-2,0,-0.25,2,2.2,0.25],"crypt":[-3,0,-4,3,8,4],"coffin":[-1,0,-1.5,1,1.322,1.5],"shrine":[-0.55,0,-0.55,0.55,2.4,0.55],"pillar":[-0.5,0,-0.5,0.5,4.4,0.5],"post_lantern":[-0.32,0,-0.216,0.32,3.3,1.35],"bench_decorated":[-1,0,-0.503,1,1.677,0.514],"Barrel_A":[-0.5,-0.5,-0.5,0.5,0.5,0.5],"Pillar_A":[-0.3,0,-0.3,0.3,4.1,0.3],"Pillar_B":[-0.5,0,-0.5,0.5,4.1,0.5],"Box_A":[-0.228,0,-0.228,0.228,0.509,0.235],"Box_B":[-0.3,0,-0.2,0.3,0.402,0.206],"Pallet_Large":[-2,0,-2,2,0.5,2],"Primitive_Beam":[-2,0,-0.5,2,1,0.5]};
  const B = (a, b, c, d, e, f, x) => { const r = [a, b, c, d, e, f]; if (x) r.push(x); return r; }; // fractions
  const TPL = []; const def = (o) => { TPL.push(o); return o; };
  const one = (id, zones, m, s, box, extra, o) => def(Object.assign({ id, zones, w: 1, parts: [{ m, s, p: [0, 0, 0], ry: 0, b: [box] }], route: [0] }, o || {}));

  // ---------- 0 le jardin ----------
  def({ id: "pin1", zones: [0], w: 3, proc: "sapin", parts: [{ m: "tree_single_B", s: 8.6, p: [0, 0, 0], ry: 0, b: [B(.1, .9, .10, .30, .1, .9), B(.27, .73, .30, .44, .27, .73), B(.4, .6, .44, .58, .4, .6)] }], route: [0, 1, 2] });
  def({ id: "pin2", zones: [0], w: 3, proc: "sapin", parts: [{ m: "tree_single_A", s: 10, p: [0, 0, 0], ry: 0, b: [B(.1, .9, .08, .26, .1, .9), B(.28, .72, .26, .40, .28, .72), B(.4, .6, .40, .54, .4, .6)] }], route: [0, 1, 2] });
  def({ id: "arbre", zones: [0], w: 4, proc: "arbre", parts: [], abs: [[-3.4, -0.9, -0.5, 0, -0.65, 0.65], [-0.45, 0.45, -5.5, 5.2, -0.45, 0.45, { node: false, trunk: 1 }], [-0.65, 0.65, 0.9, 1.4, 0.9, 3.4], [0.9, 3.5, 2.4, 2.8, -0.65, 0.65]], route: [0, 2, 3] });
  def({ id: "rocher1", zones: [0, 2], w: 2, parts: [{ m: "rock_single_C", s: 14, p: [0, 0, 0], ry: 0, b: [B(.1, .9, 0, .45, .1, .9), B(.3, .7, .45, .9, .3, .7)] }], route: [0, 1] });
  def({ id: "rocher2", zones: [0, 2], w: 2, parts: [{ m: "rock_single_E", s: 12, p: [0, 0, 0], ry: 2, b: [B(.42, .98, 0, .3, .02, .62), B(.03, .47, 0, .74, .4, .97)] }], route: [0, 1] });
  def({ id: "rocher3", zones: [0, 2], w: 1.5, parts: [{ m: "rock_single_D", s: 16, p: [0, 0, 0], ry: 0, b: [B(.05, .95, 0, .45, .08, .92), B(.28, .72, .45, .72, .28, .72)] }], route: [0, 1] });
  def({ id: "champi", zones: [0], w: 3, proc: "champi", parts: [], abs: [[-1.6, 1.6, -0.45, 0, -1.6, 1.6, { k: "spring", sv: 19.5 }], [4.4, 6.8, 3.15, 3.6, -1.3, 1.3]], route: [0, 1] });
  one("buches", [0, 2], "resource_lumber", 8, B(.02, .98, 0, .9, .02, .98), 0, { w: 1.5 });
  one("pierres", [0, 2], "resource_stone", 9, B(.04, .96, 0, .92, .04, .96), 0, { w: 1.5 });
  one("seau", [0, 4], "bucket_water", 15, B(.08, .92, 0, .96, .08, .92), 0, { w: 1 });
  // ---------- 1 la rue ----------
  const car = (n) => def({ id: "voiture_" + n, zones: [1], w: 1.6, parts: [{ m: "car_" + n, s: 8, p: [0, 0, 0], ry: 1, b: [B(.02, .98, 0, .5, .02, .98), B(.12, .88, .5, .97, .3, .7)] }], route: [0, 1] });
  ["taxi", "sedan", "police", "stationwagon", "hatchback"].forEach(car);
  def({ id: "poteau_a", zones: [1, 2, 6], w: 1.5, proc: "poteau", parts: [{ m: "Pillar_B", s: 1.15, p: [0, -4.7, 0], ry: 0, b: [B(.0, 1, .93, 1, 0, 1)] }], route: [0] });
  def({ id: "poteau_b", zones: [1, 2, 6], w: 1.5, proc: "poteau", parts: [{ m: "Pillar_A", s: 1.7, p: [0, -7, 0], ry: 0, b: [B(.0, 1, .95, 1, 0, 1)] }], route: [0] });
  one("benne", [1], "dumpster", 7, B(0, 1, 0, .84, 0, 1), 0, { w: 2 });
  one("banc", [1], "bench", 9, B(0, 1, 0, .98, 0, 1), 0, { w: 1.5 });
  one("borne", [1], "firehydrant", 9, B(.14, .86, 0, .96, .14, .86), 0, { w: 1.5 });
  one("carton", [1, 2], "box_A", 12, B(.02, .98, 0, .98, .02, .98), 0, { w: 1.5 });
  // ---------- 2 le chantier ----------
  one("palette", [2], "Pallet_Large", 1, B(.02, .98, 0, 1, .02, .98), 0, { w: 2 });
  def({ id: "caisses", zones: [2], w: 3, parts: [{ m: "crate_A_big", s: 10, p: [0, 0, 0], ry: 0, b: [B(.02, .98, 0, 1, .02, .98)] }, { m: "crate_A_big", s: 10, p: [2.2, 0, 0.1], ry: 0, b: [B(.02, .98, 0, 1, .02, .98)] }, { m: "crate_A_small", s: 9.5, p: [2.65, 2.1, 0.1], ry: 0, b: [B(.02, .98, 0, 1, .02, .98)] }], route: [0, 1, 2] });
  one("tonneau", [2, 4], "barrel", 9, B(.1, .9, 0, .97, .1, .9), 0, { w: 2 });
  def({ id: "poutre", zones: [2], w: 3, parts: [{ m: "Primitive_Beam", s: 1.5, p: [0, 0, 0], ry: 0, b: [B(.0, 1, 0, 1, 0, 1)] }, { m: "Pillar_A", s: 1.6, p: [-2.4, -6.5, 0], ry: 0, b: [] }, { m: "Pillar_A", s: 1.6, p: [2.4, -6.5, 0], ry: 0, b: [] }], route: [0] });
  // ---------- 3 la maison géante ----------
  def({ id: "chaise", zones: [3], w: 3, parts: [{ m: "chair_A", s: 3, p: [0, 0, 0], ry: 3, b: [B(.02, .98, .30, .40, .02, .98), B(.02, .98, .40, 1.0, .02, .3)] }], route: [0, 1] });
  one("table", [3, 4], "table_medium", 2.4, B(0, 1, .78, 1, 0, 1), 0, { w: 2, y0abs: 1 });
  one("table_basse", [3], "table_low", 2.6, B(0, 1, .72, 1, 0, 1), 0, { w: 1.5 });
  one("tabouret", [3], "chair_stool_wood", 4, B(.04, .96, .6, 1, .04, .96), 0, { w: 1.5 });
  def({ id: "canape", zones: [3], w: 3, parts: [{ m: "couch", s: 2.4, p: [0, 0, 0], ry: 0, b: [B(.1, .9, 0, .42, .2, 1), B(0, 1, .42, .85, 0, .2)] }], route: [0, 1] });
  def({ id: "fauteuil", zones: [3], w: 2, parts: [{ m: "armchair", s: 2.6, p: [0, 0, 0], ry: 0, b: [B(.2, .8, 0, .38, .2, 1), B(.2, .8, .38, .86, 0, .2)] }], route: [0, 1] });
  def({ id: "lit", zones: [3], w: 3, proc: null, parts: [{ m: "bed_single_A", s: 2.2, p: [0, 0, 0], ry: 1, b: [B(.04, .96, 0, .52, .0, .5), B(.04, .96, 0, .52, .5, .9, { k: "spring", sv: 16.5 })] }, { m: "cabinet_medium_decorated", s: 2.2, p: [6.5, 0, 0], ry: 0, b: [B(.0, 1, 0, 1, 0, 1)] }], route: [0, 1, 2] });
  one("commode", [3], "cabinet_small", 3.4, B(0, 1, 0, 1, 0, 1), 0, { w: 2 });
  one("armoire", [3], "cabinet_medium", 3, B(0, 1, 0, 1, 0, 1), 0, { w: 2 });
  // ---------- 4 la cuisine géante ----------
  one("fourneau", [4], "stove_multi", 2.8, B(0, 1, 0, .93, 0, 1), 0, { w: 2 });
  def({ id: "frigo", zones: [4], w: 3, parts: [{ m: "kitchencounter_straight_A", s: 2.0, p: [0, 0, 0], ry: 0, b: [B(0, 1, 0, 1, 0, 1)] }, { m: "fridge_A", s: 1.3, p: [3.4, 0, 0], ry: 0, b: [B(.0, 1, 0, 1, 0, 1)] }], route: [0, 1] });
  one("marmite", [4], "pot_large", 3.2, B(.08, .92, 0, .96, .08, .92), 0, { w: 2 });
  one("bocal", [4], "jar_A_large", 4.5, B(.1, .9, 0, 1, .1, .9), 0, { w: 2 });
  one("cageot", [4], "crate_potatoes", 2.4, B(0, 1, 0, .95, 0, 1), 0, { w: 2 });
  one("assiette", [4], "table_round_A", 2.2, B(.08, .92, .85, 1, .08, .92), 0, { w: 2 });
  def({ id: "tapis", zones: [4], w: 3, proc: "tapis", parts: [], abs: [[-3.6, 3.6, -0.5, 0, -1.5, 1.5, { cv: 1 }]], route: [0] });
  // ---------- 5 les toits ----------
  const sky = (id, a, b, c, sa, sb, sc) => def({ id, zones: [5], w: 3, parts: [{ m: a, s: sa, p: [0, 0, 0], ry: 0, b: [B(.04, .96, 0, .97, .04, .96)] }, { m: b, s: sb, p: [5.3, 0, 0], ry: 0, b: [B(.04, .96, 0, .97, .04, .96)] }, { m: c, s: sc, p: [10.3, 0, 0], ry: 0, b: [B(.04, .96, 0, .97, .04, .96)] }], route: [0, 1, 2] });
  sky("skyline1", "building_A", "building_E", "building_G", 2.42, 2.25, 2.2); sky("skyline2", "building_B", "building_F", "building_H", 2.42, 2.25, 2.15);
  one("immeuble_a", [5], "building_A", 2.6, B(.04, .96, 0, .97, .04, .96), 0, { w: 2 }); one("immeuble_c", [5], "building_C", 2.1, B(.04, .96, 0, .97, .04, .96), 0, { w: 2 }); one("immeuble_d", [5], "building_D", 2.1, B(.04, .96, 0, .97, .04, .96), 0, { w: 2 });
  one("chateau_eau", [5], "watertower", 9, B(.18, .82, .7, .78, .18, .82), 0, { w: 2 });
  // ---------- 6 le cimetière ----------
  def({ id: "arbre_mort", zones: [6], w: 4, proc: "arbre", style: "mort", parts: [], abs: [[-3.4, -0.9, -0.5, 0, -0.65, 0.65], [-0.45, 0.45, -5.5, 5.2, -0.45, 0.45, { node: false, trunk: 1 }], [-0.65, 0.65, 0.9, 1.4, 0.9, 3.4], [0.9, 3.5, 2.4, 2.8, -0.65, 0.65]], route: [0, 2, 3] });
  one("citrouille", [6], "pumpkin_orange", 2.8, B(.1, .9, 0, .95, .1, .9), 0, { w: 2 });
  one("citrouille_j", [6], "pumpkin_orange_jackolantern", 2.6, B(.1, .9, 0, .95, .1, .9), 0, { w: 2 });
  def({ id: "tas_citrouilles", zones: [6], w: 3, parts: [{ m: "pumpkin_yellow", s: 2.6, p: [0, 0, 0], ry: 0, b: [B(.1, .9, 0, .95, .1, .9)] }, { m: "pumpkin_orange", s: 3.0, p: [3.2, 0, 0], ry: 0, b: [B(.1, .9, 0, .95, .1, .9)] }, { m: "pumpkin_orange_jackolantern", s: 2.6, p: [6.95, 0, 0], ry: 0, b: [B(.1, .9, 0, .95, .1, .9)] }], route: [0, 1, 2] });
  one("tombe", [6], "gravestone", 2.4, B(.02, .98, 0, 1, .02, .98), 0, { w: 2 });
  one("cercueil", [6], "coffin", 2.3, B(.02, .98, 0, .86, .02, .98), 0, { w: 2 });
  one("sanctuaire", [6], "shrine", 2.0, B(.12, .88, 0, .88, .12, .88), 0, { w: 1.5 });
  // ---------- 7 les nuages ----------
  one("nuage_g", [7], "cloud_big", 2.0, B(.12, .88, .62, .80, .12, .88), 0, { w: 3 });
  one("nuage_p", [7], "cloud_small", 2.6, B(.12, .88, .62, .80, .12, .88), 0, { w: 3 });
  def({ id: "nuage_saut", zones: [7], w: 3, parts: [{ m: "cloud_small", s: 2.4, p: [0, 0, 0], ry: 0, b: [B(.32, .68, .62, .80, .2, .8, { k: "spring", sv: 18 })] }, { m: "cloud_big", s: 2.0, p: [7.0, 3.3, 0], ry: 0, b: [B(.12, .88, .62, .80, .12, .88)] }], route: [0, 1] });
  // ---------- tremplins, dans tous les mondes ----------
  def({ id: "trampoline", zones: [0, 1, 2, 3, 4, 5, 6, 7], w: 0, proc: "trampoline", parts: [], abs: [[-1.7, 1.7, -0.55, 0, -1.7, 1.7, { k: "spring", sv: 21.5 }], [4.8, 8.0, 4.2, 4.8, -1.6, 1.6]], route: [0, 1] });

  // ---------- mise en place d'un objet dans le repère local ----------
  const rotk = (x, z, k) => { k = ((k % 4) + 4) % 4; return k === 0 ? [x, z] : k === 1 ? [z, -x] : k === 2 ? [-x, -z] : [-z, x]; };
  // renvoie les boîtes en {u0,u1,v0,v1,y0,y1,...}, la route (indices) et les pièces à dessiner
  function layout(T, f) {
    f = f || 1; const boxes = []; const parts = [];
    (T.parts || []).forEach((p) => {
      const bb = BB[p.m]; const cx = (bb[0] + bb[3]) / 2, cz = (bb[2] + bb[5]) / 2; const sx = bb[3] - bb[0], sy = bb[4] - bb[1], sz = bb[5] - bb[2]; const s = p.s * f;
      parts.push({ m: p.m, s, p: [p.p[0] * f, p.p[1] * f, p.p[2] * f], ry: p.ry || 0, piv: [cx, bb[1], cz] });
      p.b.forEach((q) => {
        const xa = (bb[0] + q[0] * sx - cx) * s, xb = (bb[0] + q[1] * sx - cx) * s, ya = q[2] * sy * s, yb = q[3] * sy * s, za = (bb[2] + q[4] * sz - cz) * s, zb = (bb[2] + q[5] * sz - cz) * s;
        const c = [rotk(xa, za, p.ry), rotk(xb, zb, p.ry), rotk(xa, zb, p.ry), rotk(xb, za, p.ry)];
        const o = { u0: Math.min(...c.map((e) => e[0])) + p.p[0] * f, u1: Math.max(...c.map((e) => e[0])) + p.p[0] * f, v0: Math.min(...c.map((e) => e[1])) + p.p[2] * f, v1: Math.max(...c.map((e) => e[1])) + p.p[2] * f, y0: ya + p.p[1] * f, y1: yb + p.p[1] * f, k: "solid" };
        if (q[6]) Object.assign(o, q[6]); boxes.push(o);
      });
    });
    (T.abs || []).forEach((q) => { const o = { u0: q[0] * f, u1: q[1] * f, y0: q[2] * f, y1: q[3] * f, v0: q[4] * f, v1: q[5] * f, k: "solid" }; if (q[6]) Object.assign(o, q[6]); boxes.push(o); });
    return { T, f, boxes, route: T.route.slice(), parts };
  }
  return { BB, TPL, layout, rotk, byId: (id) => TPL.find((t) => t.id === id) };
});

// Street lamps. The towns used to sit dim through the evening — now, at the
// squares and the doors and the lots, there are lamps that come on with the
// windows (nightglow's shared ramp): a warm glass head and a soft pool of
// light on the ground beneath. No lights — the head is emissive glass and
// the pool is an additive decal, the campfire way (VISUAL_CANON: glow is
// emissive, never a new light).
//
// Each place gets its own kind: iron lanterns in the villages, a tall lot
// light at BULKO (it is paved; nobody saw it paved), plain posts at the
// Labs, one approved globe design at Oasis Estates, wooden posts with a
// hanging lantern at the campground, and candle lanterns at the Fold (they
// decline the current, not the light).
//
// Spots are found, not typed in: around each anchor, flat open ground near
// (not on) the buildings and paths, clear of doors and prompts, a few
// strides apart. Deterministic — no dice.

import * as THREE from 'three';
import { SITES, ISLAND4, ISLAND8, ISLAND9, CRAN_NORTH, terrainHeight } from './terrain.js';
import * as zones from './zones.js';
import { debugList } from './interact.js';
import { glowLevel } from './nightglow.js';
import { mergeStatic } from './merge.js';

function mat(color, rough = 0.85) {
  return new THREE.MeshStandardMaterial({ color, flatShading: true, roughness: rough });
}
function mesh(geo, m) {
  const o = new THREE.Mesh(geo, m);
  o.castShadow = o.receiveShadow = true;
  return o;
}

// one glass material for every lamp head (so they merge, and go on together)
const GLASS = new THREE.MeshStandardMaterial({ color: 0xfff2cc, flatShading: true, roughness: 0.4 });
const GLASS_MAX = 1.25;
const CANDLE = new THREE.MeshStandardMaterial({ color: 0xffe2a8, flatShading: true, roughness: 0.5 });
const CANDLE_MAX = 0.75;
GLASS.userData.live = CANDLE.userData.live = true; // (mergeStatic keeps them: they warm at dusk)

// ------------------------------------------------------------- the kinds ----
const KINDS = {
  // iron post, a little square lantern with a peaked cap
  village(g) {
    const iron = mat(0x2e2c30, 0.6);
    const base = mesh(new THREE.CylinderGeometry(0.16, 0.2, 0.25, 6), iron);
    base.position.y = 0.12;
    const post = mesh(new THREE.CylinderGeometry(0.06, 0.08, 2.4, 6), iron);
    post.position.y = 1.4;
    const arm = mesh(new THREE.BoxGeometry(0.4, 0.06, 0.06), iron);
    arm.position.set(0, 2.55, 0);
    const glass = mesh(new THREE.BoxGeometry(0.3, 0.38, 0.3), GLASS);
    glass.position.y = 2.82;
    glass.castShadow = false;
    const cap = mesh(new THREE.ConeGeometry(0.28, 0.26, 4), iron);
    cap.rotation.y = Math.PI / 4;
    cap.position.y = 3.13;
    g.add(base, post, arm, glass, cap);
    return 0.12;
  },
  // the lot light: tall, grey, two heads, a little too bright (it's BULKO)
  lot(g) {
    const grey = mat(0x7d8288, 0.6);
    const post = mesh(new THREE.CylinderGeometry(0.1, 0.14, 5.2, 6), grey);
    post.position.y = 2.6;
    const bar = mesh(new THREE.BoxGeometry(1.8, 0.1, 0.12), grey);
    bar.position.y = 5.2;
    g.add(post, bar);
    for (const sx of [-0.85, 0.85]) {
      const head = mesh(new THREE.BoxGeometry(0.5, 0.14, 0.3), grey);
      head.position.set(sx, 5.12, 0);
      const glass = mesh(new THREE.BoxGeometry(0.42, 0.05, 0.24), GLASS);
      glass.position.set(sx, 5.03, 0);
      glass.castShadow = false;
      g.add(head, glass);
    }
    return 0.16;
  },
  // the Labs: a plain post, a flat head, a lens underneath (a whole committee)
  labs(g) {
    const grey = mat(0xb6b1a4, 0.7);
    const post = mesh(new THREE.BoxGeometry(0.14, 3.2, 0.14), grey);
    post.position.y = 1.6;
    const head = mesh(new THREE.BoxGeometry(0.7, 0.12, 0.32), grey);
    head.position.set(0.25, 3.25, 0);
    const lens = mesh(new THREE.BoxGeometry(0.56, 0.05, 0.24), GLASS);
    lens.position.set(0.25, 3.17, 0);
    lens.castShadow = false;
    g.add(post, head, lens);
    return 0.12;
  },
  // Oasis Estates: one globe design, approved after nine meetings
  oasis(g) {
    const white = mat(0xf2efe6, 0.6);
    const post = mesh(new THREE.CylinderGeometry(0.07, 0.11, 2.6, 8), white);
    post.position.y = 1.3;
    const collar = mesh(new THREE.CylinderGeometry(0.14, 0.1, 0.12, 8), white);
    collar.position.y = 2.66;
    const globe = mesh(new THREE.IcosahedronGeometry(0.26, 1), GLASS);
    globe.position.y = 2.95;
    globe.castShadow = false;
    g.add(post, collar, globe);
    return 0.11;
  },
  // the campground: a wooden post, a crook, a lantern on a hook
  camp(g) {
    const wood = mat(0x7a5a3a);
    const post = mesh(new THREE.CylinderGeometry(0.08, 0.1, 2.3, 5), wood);
    post.position.y = 1.15;
    const crook = mesh(new THREE.BoxGeometry(0.5, 0.07, 0.07), wood);
    crook.position.set(0.22, 2.25, 0);
    const lantern = mesh(new THREE.CylinderGeometry(0.12, 0.14, 0.26, 6), GLASS);
    lantern.position.set(0.42, 1.95, 0);
    lantern.castShadow = false;
    const top = mesh(new THREE.ConeGeometry(0.15, 0.12, 6), mat(0x2e2c30, 0.6));
    top.position.set(0.42, 2.14, 0);
    g.add(post, crook, lantern, top);
    return 0.1;
  },
  // the Fold: a plain post and a candle lantern (they decline the current,
  // not the light)
  fold(g) {
    const wood = mat(0x6e5843);
    const post = mesh(new THREE.CylinderGeometry(0.07, 0.09, 2.0, 5), wood);
    post.position.y = 1.0;
    const box = mesh(new THREE.BoxGeometry(0.26, 0.3, 0.26), CANDLE);
    box.position.y = 2.15;
    box.castShadow = false;
    const roof = mesh(new THREE.ConeGeometry(0.22, 0.18, 4), wood);
    roof.rotation.y = Math.PI / 4;
    roof.position.y = 2.39;
    g.add(post, box, roof);
    return 0.09;
  },
};

// -------------------------------------------------------- where they go ----
// [anchor, ring radii, how many, kind]
function anchors() {
  const S = SITES, at = (p, dx = 0, dz = 0) => ({ x: p.x + dx, z: p.z + dz });
  return [
    [at(S.village), 5, 15, 6, 'village'],         // the plaza and its shops
    [at(S.home), 2.5, 7, 1, 'village'],            // your own door
    [at(S.dock), 3, 9, 2, 'village'],              // the home pier
    [at(S.town2), 4, 13, 4, 'village'],            // the Far Isle's town
    [at(S.garden2), 2, 8, 1, 'village'],
    [at(S.town3), 4, 13, 4, 'village'],            // the North Isle's
    [at(S.manor), 4, 12, 3, 'village'],            // the manor drive
    [at(S.springs), 3, 9, 1, 'village'],
    [at(ISLAND9, -8, 0), 4.5, 12, 4, 'village'],   // Cran's green, round the gazebo
    [at(CRAN_NORTH, 0, 16), 2, 6, 1, 'village'],   // the walk up to the North End
    [at(S.labsYard), 4, 12, 4, 'labs'],
    [at(S.bigbox, 0, 11), 2, 9, 2, 'lot'],         // BULKO's lot (DO NOT WORRY ABOUT IT)
    [at(ISLAND8), 4, 16, 5, 'oasis'],
    [at(S.camp), 3, 10, 3, 'camp'],
    [at(S.storeYard), 2, 7, 1, 'camp'],
    [at(S.steading), 3, 10, 2, 'fold'],
    [at(S.kirkyard), 3, 9, 1, 'fold'],
  ];
}

export function createLamps() {
  const group = new THREE.Group();
  group.name = 'lamps';
  const pools = [];
  const prompts = debugList().filter((it) => !it.moving && it.zone === 'island');
  const placed = [];
  function flat(x, z) {
    const h = terrainHeight(x, z);
    let lo = h, hi = h;
    for (let k = 0; k < 6; k++) {
      const a = (k / 6) * Math.PI * 2;
      const y = terrainHeight(x + Math.cos(a) * 1.4, z + Math.sin(a) * 1.4);
      lo = Math.min(lo, y);
      hi = Math.max(hi, y);
    }
    return h > 0.45 && hi - lo < 0.3;
  }
  function fits(x, z) {
    if (!zones.islandCanStand(x, z, 0.9) || zones.nearAnything(x, z, 0.9)) return false;
    if (zones.islandGroundHeight(x, z) > terrainHeight(x, z) + 0.15) return false; // (not on a porch, a pier, a plinth)
    if (!flat(x, z)) return false;
    if (placed.some((p) => Math.hypot(p.x - x, p.z - z) < 6)) return false;
    if (prompts.some((it) => Math.hypot(it.x - x, it.z - z) < Math.max(1.8, it.r))) return false; // (a lamp in front of a door, a sign, a counter — no)
    return true;
  }
  for (const [c, r0, r1, n, kind] of anchors()) {
    if (!c || !Number.isFinite(c.x)) continue;
    // two passes: first spots that stand beside something (a wall, a fence,
    // a tree — where a lamp belongs), then any open spot
    let got = 0;
    for (const pass of [0, 1]) {
      for (let r = r0; r <= r1 && got < n; r += 1.5) {
        const steps = Math.max(8, Math.round(r * 2));
        for (let k = 0; k < steps && got < n; k++) {
          const a = (k / steps) * Math.PI * 2 + r * 0.37;
          const x = c.x + Math.cos(a) * r, z = c.z + Math.sin(a) * r;
          if (pass === 0 && !zones.nearAnything(x, z, 2.8)) continue;
          if (!fits(x, z)) continue;
          const g = new THREE.Group();
          const rad = KINDS[kind](g);
          const y = terrainHeight(x, z);
          g.position.set(x, y - 0.05, z);
          g.rotation.y = Math.atan2(c.x - x, c.z - z) + Math.PI / 2; // (the arm reaches along the square)
          group.add(g);
          zones.addBlocker(x, z, rad + 0.05);
          placed.push({ x, z });
          pools.push({ x, y, z, big: kind === 'lot', dim: kind === 'fold' });
          got++;
        }
      }
    }
  }
  // the pools of light under them: one instanced decal, additive, warm
  // (a soft radial falloff, like the campfire's: bright under the lamp, gone
  // by the edge — a flat disc read as a beige coaster)
  const cv = document.createElement('canvas');
  cv.width = cv.height = 64;
  const c2 = cv.getContext('2d');
  const grad = c2.createRadialGradient(32, 32, 0, 32, 32, 32);
  grad.addColorStop(0, 'rgba(255,214,150,1)');
  grad.addColorStop(0.4, 'rgba(255,190,120,0.45)');
  grad.addColorStop(1, 'rgba(255,170,100,0)');
  c2.fillStyle = grad;
  c2.fillRect(0, 0, 64, 64);
  const poolMat = new THREE.MeshBasicMaterial({
    map: new THREE.CanvasTexture(cv), color: 0xffc878, transparent: true, opacity: 0,
    depthWrite: false, blending: THREE.AdditiveBlending,
    polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2,
  });
  const poolGeo = new THREE.CircleGeometry(1, 16);
  poolGeo.rotateX(-Math.PI / 2);
  const decals = new THREE.InstancedMesh(poolGeo, poolMat, Math.max(1, pools.length));
  const tmp = new THREE.Object3D();
  pools.forEach((p, i) => {
    tmp.position.set(p.x, p.y + 0.08, p.z);
    tmp.scale.setScalar(p.big ? 4.2 : p.dim ? 1.8 : 2.6);
    tmp.updateMatrix();
    decals.setMatrixAt(i, tmp.matrix);
  });
  decals.count = pools.length;
  decals.renderOrder = 2;
  decals.castShadow = decals.receiveShadow = false;
  group.add(decals);
  mergeStatic(group);
  // (the glass merged with everything else in its material: light it now)
  GLASS.emissive = new THREE.Color(0xffd890);
  CANDLE.emissive = new THREE.Color(0xffb860);

  function update() {
    const k = glowLevel();
    GLASS.emissiveIntensity = k * GLASS_MAX;
    CANDLE.emissiveIntensity = k * CANDLE_MAX;
    poolMat.opacity = k * 0.5;
    decals.visible = k > 0.01;
  }
  return { group, update, count: pools.length };
}

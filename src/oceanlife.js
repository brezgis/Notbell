// The sea has residents too: friendly fins that patrol the strait, and —
// far out, where the water turns deep — whales that crest and blow.

import * as THREE from 'three';
import {
  WATER_Y, ISLAND_RADIUS, ISLAND2, ISLAND3, ISLAND4, ISLAND5, ISLAND5_SOUTH,
  ISLAND5_HAND, ISLAND6, TEXAS, VOLCANO, terrainHeight,
} from './terrain.js';
import { splash } from './audio.js';
import { rand, pick } from './utils.js';

// the bright water: a coral shelf roughly between the islands and the mountain
export const REEF = { x: 58, z: -72, r: 16 };

const LAND = [
  { x: 0, z: 0, r: ISLAND_RADIUS },
  ISLAND2,
  ISLAND3,
  ISLAND4,
  ISLAND5,
  ISLAND5_SOUTH,
  ...ISLAND5_HAND,
  ISLAND6,
  TEXAS,
  VOLCANO,
];

function mat(color, rough = 0.6) {
  return new THREE.MeshStandardMaterial({ color, flatShading: true, roughness: rough });
}

export function createOceanLife() {
  const group = new THREE.Group();

  // ------------------------------------------------------------ sharks ----
  // they are FRIENDLY. they have a lot of teeth and zero plans for them.
  const sharks = [];
  const heartTex = (() => {
    const cv = document.createElement('canvas');
    cv.width = cv.height = 128;
    const ctx = cv.getContext('2d');
    ctx.font = '96px sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('💛', 64, 70);
    const tex = new THREE.CanvasTexture(cv);
    tex.colorSpace = THREE.SRGBColorSpace;
    return tex;
  })();

  const orbits = [
    { cx: 50, cz: -16, r: 13 },                       // the strait
    { cx: -30, cz: 40, r: 16 },                        // south of home
    { cx: ISLAND2.x + 20, cz: ISLAND2.z + 24, r: 14 }, // off the Far Isle
  ];
  for (const orbit of orbits) {
    const shark = new THREE.Group();
    const fin = new THREE.Mesh(new THREE.ConeGeometry(0.42, 1.0, 4), mat(0x6e7e8e));
    fin.scale.z = 0.4;
    fin.position.y = 0.45;
    shark.add(fin);
    const back = new THREE.Mesh(new THREE.IcosahedronGeometry(0.5, 0), mat(0x6e7e8e));
    back.scale.set(0.8, 0.35, 2.2);
    back.position.y = 0.05;
    shark.add(back);
    const tail = new THREE.Mesh(new THREE.ConeGeometry(0.34, 0.58, 4), mat(0x6e7e8e));
    tail.scale.x = 0.18; // thin side-to-side — a caudal fin, not a paddle
    tail.position.set(0, 0.1, -1.35); // lifted so its corner meets the torso's rear
    tail.rotation.x = -0.25; // swept back, the way a tail that means it is
    tail.receiveShadow = true;
    shark.add(tail);
    // a face, so everyone can see the friendliness
    const snout = new THREE.Mesh(new THREE.IcosahedronGeometry(0.3, 0), mat(0x6e7e8e));
    snout.scale.set(0.85, 0.6, 1.0);
    snout.position.set(0, 0.22, 1.05);
    shark.add(snout);
    for (const sx of [-1, 1]) {
      const eye = new THREE.Mesh(new THREE.IcosahedronGeometry(0.06, 0), mat(0x222222, 0.3));
      eye.position.set(sx * 0.17, 0.4, 1.12);
      shark.add(eye);
    }
    const smile = new THREE.Mesh(new THREE.TorusGeometry(0.12, 0.025, 5, 8, Math.PI), mat(0x2e3640, 0.5));
    smile.position.set(0, 0.16, 1.3);
    smile.rotation.z = Math.PI; // the arc smiles up
    shark.add(smile);
    const heart = new THREE.Sprite(new THREE.SpriteMaterial({
      map: heartTex, transparent: true, depthWrite: false,
    }));
    heart.scale.set(0.9, 0.9, 1);
    heart.position.y = 1.6;
    heart.visible = false;
    shark.add(heart);
    shark.traverse((o) => { if (o.isMesh) o.castShadow = true; });
    shark.userData = { orbit, a: rand(0, Math.PI * 2), speed: rand(0.1, 0.16), heart, tail, heartT: 0, shy: 0 };
    sharks.push(shark);
    group.add(shark);
  }

  // ------------------------------------------------------------ whales ----
  const whales = [];
  for (let i = 0; i < 2; i++) {
    const whale = new THREE.Group();
    const body = new THREE.Mesh(new THREE.IcosahedronGeometry(2.4, 1), mat(0x3a4a66, 0.8));
    body.scale.set(0.85, 0.75, 2.1);
    whale.add(body);
    const belly = new THREE.Mesh(new THREE.IcosahedronGeometry(2.0, 1), mat(0xc9d4dc, 0.8));
    belly.scale.set(0.7, 0.5, 1.8);
    belly.position.y = -0.7;
    whale.add(belly);
    const tail = new THREE.Mesh(new THREE.IcosahedronGeometry(1.0, 0), mat(0x3a4a66, 0.8));
    tail.scale.set(1.6, 0.3, 0.9);
    tail.position.set(0, 0.3, -4.6);
    whale.add(tail);
    for (const sx of [-1, 1]) {
      const eye = new THREE.Mesh(new THREE.IcosahedronGeometry(0.18, 0), mat(0x222222, 0.3));
      eye.position.set(sx * 0.95, 0.25, 2.7);
      whale.add(eye);
    }
    const whaleSmile = new THREE.Mesh(new THREE.TorusGeometry(0.55, 0.06, 5, 10, Math.PI), mat(0x222e3e, 0.5));
    whaleSmile.position.set(0, -0.35, 3.5);
    whaleSmile.rotation.z = Math.PI;
    whaleSmile.rotation.x = 0.4;
    whale.add(whaleSmile);
    // spout puffs
    const spout = [];
    for (let k = 0; k < 3; k++) {
      const puff = new THREE.Mesh(new THREE.IcosahedronGeometry(0.3, 0),
        new THREE.MeshStandardMaterial({ color: 0xffffff, transparent: true, opacity: 0.8, roughness: 1 }));
      puff.visible = false;
      whale.add(puff);
      spout.push(puff);
    }
    whale.visible = false;
    whale.userData = { timer: rand(12, 30), breachT: -1, spot: { x: 0, z: 0 }, spout };
    whales.push(whale);
    group.add(whale);
  }

  function startBreach(whale) {
    // pick deep water: a ring well away from both shores
    let spot = whale.userData.spot;
    for (let tries = 0; tries < 20; tries++) {
      const a = rand(0, Math.PI * 2);
      const r = rand(58, 85);
      const x = Math.cos(a) * r + 40, z = Math.sin(a) * r - 15;
      spot = { x, z };
      if (LAND.every((island) => Math.hypot(x - island.x, z - island.z) >= island.r + 12)) break;
    }
    whale.userData.spot = spot;
    whale.userData.breachT = 0;
    whale.visible = true;
    whale.rotation.y = rand(0, Math.PI * 2);
  }

  // -------------------------------------------------------- the reef ----
  // coral just under the surface; the water brightens where it lives
  const reefGlow = new THREE.Mesh(
    new THREE.CircleGeometry(REEF.r, 22),
    new THREE.MeshBasicMaterial({ color: 0x57c8d8, transparent: true, opacity: 0.22, depthWrite: false })
  );
  reefGlow.rotation.x = -Math.PI / 2;
  reefGlow.position.set(REEF.x, WATER_Y + 0.04, REEF.z);
  group.add(reefGlow);
  const coralColors = [0xff6b81, 0xff9430, 0xc77dff, 0xffd23e, 0x8fce7a];
  for (let i = 0; i < 26; i++) {
    const a = rand(0, Math.PI * 2);
    const r = Math.sqrt(rand(0, 1)) * (REEF.r - 2);
    const cx = REEF.x + Math.cos(a) * r, cz = REEF.z + Math.sin(a) * r;
    const coral = new THREE.Group();
    const c = pick(coralColors);
    if (rand(0, 1) < 0.5) {
      // branching coral
      for (let k = 0; k < 4; k++) {
        const branch = new THREE.Mesh(new THREE.ConeGeometry(0.12, rand(0.5, 1.0), 4), mat(c, 0.7));
        branch.position.set(rand(-0.3, 0.3), 0.3, rand(-0.3, 0.3));
        branch.rotation.set(rand(-0.4, 0.4), 0, rand(-0.4, 0.4));
        coral.add(branch);
      }
    } else {
      // brain blob + fan
      const blob = new THREE.Mesh(new THREE.IcosahedronGeometry(rand(0.3, 0.55), 1), mat(c, 0.8));
      blob.scale.y = 0.6;
      coral.add(blob);
      const fan = new THREE.Mesh(new THREE.CircleGeometry(0.4, 7),
        new THREE.MeshStandardMaterial({ color: pick(coralColors), side: THREE.DoubleSide, roughness: 0.8 }));
      fan.position.set(0.4, 0.4, 0);
      fan.rotation.y = rand(0, Math.PI);
      coral.add(fan);
    }
    coral.position.set(cx, WATER_Y - rand(0.7, 1.2), cz);
    group.add(coral);
  }

  // ------------------------------------------------------- manta rays ----
  const mantas = [];
  for (let i = 0; i < 3; i++) {
    const manta = new THREE.Group();
    const wingGeo = new THREE.PlaneGeometry(2.2, 1.3);
    wingGeo.rotateX(-Math.PI / 2); // wings lie flat with the body, as wings do
    wingGeo.translate(1.1, 0, 0);
    const topMat = new THREE.MeshStandardMaterial({
      color: 0x2e3e50, side: THREE.DoubleSide, roughness: 0.6, flatShading: true,
    });
    const left = new THREE.Mesh(wingGeo, topMat);
    left.scale.x = -1;
    const right = new THREE.Mesh(wingGeo, topMat);
    manta.add(left, right);
    const bodyM = new THREE.Mesh(new THREE.IcosahedronGeometry(0.5, 0), mat(0x2e3e50, 0.6));
    bodyM.scale.set(0.7, 0.35, 1.6);
    manta.add(bodyM);
    const tail = new THREE.Mesh(new THREE.CylinderGeometry(0.02, 0.05, 1.6, 4), mat(0x2e3e50, 0.6));
    tail.rotation.x = Math.PI / 2 + 0.1;
    tail.position.set(0, 0.05, -1.6);
    manta.add(tail);
    // wide-set eyes and little cephalic fins: the manta's polite face
    for (const sx of [-1, 1]) {
      const eye = new THREE.Mesh(new THREE.IcosahedronGeometry(0.07, 0), mat(0x222222, 0.3));
      eye.position.set(sx * 0.3, 0.16, 0.7);
      manta.add(eye);
      const ceph = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.06, 0.4), mat(0x2e3e50, 0.6));
      ceph.position.set(sx * 0.22, -0.02, 0.95);
      ceph.rotation.y = sx * 0.3;
      manta.add(ceph);
    }
    manta.userData = {
      wings: { left, right },
      a: rand(0, Math.PI * 2),
      speed: rand(0.08, 0.13),
      r: rand(7, REEF.r + 6),
      depth: rand(0.5, 1.3),
      phase: rand(0, Math.PI * 2),
    };
    mantas.push(manta);
    group.add(manta);
  }

  function update(dt, t, playerPos) {
    reefGlow.material.opacity = 0.16 + Math.sin(t * 0.9) * 0.07;

    for (const manta of mantas) {
      const u = manta.userData;
      u.a += u.speed * dt;
      // long glides with a slow rise toward the light and back down
      const lift = Math.sin(t * 0.25 + u.phase);
      manta.position.set(
        REEF.x + Math.cos(u.a) * u.r,
        WATER_Y - u.depth + lift * 0.45,
        REEF.z + Math.sin(u.a) * u.r * 0.8
      );
      manta.rotation.y = -u.a + Math.PI / 2;
      manta.rotation.z = Math.sin(t * 0.8 + u.phase) * 0.1;
      const flap = Math.sin(t * 1.6 + u.phase) * 0.45;
      u.wings.left.rotation.z = flap;
      u.wings.right.rotation.z = -flap;
    }

    for (const shark of sharks) {
      const u = shark.userData;
      const dx = playerPos.x - shark.position.x;
      const dz = playerPos.z - shark.position.z;
      const dp = Math.hypot(dx, dz);
      const pause = dp < 9 ? Math.max(0, 1 - (9 - dp) / 6) : 1; // slows near you
      u.a += u.speed * dt * (0.35 + 0.65 * pause);
      // fins need depth — skip ahead past any shallows on the orbit
      for (let guard = 0; guard < 24; guard++) {
        const nx = u.orbit.cx + Math.cos(u.a) * u.orbit.r;
        const nz = u.orbit.cz + Math.sin(u.a) * u.orbit.r;
        if (terrainHeight(nx, nz) < WATER_Y - 0.5) break;
        u.a += 0.12;
      }
      shark.position.set(
        u.orbit.cx + Math.cos(u.a) * u.orbit.r,
        WATER_Y - 0.1 + Math.sin(t * 1.4 + u.a * 3) * 0.06,
        u.orbit.cz + Math.sin(u.a) * u.orbit.r
      );
      shark.rotation.y = -u.a; // face along the orbit
      u.tail.rotation.y = Math.sin(t * 3 + u.a) * 0.4;
      if (dp < 8 && u.heartT <= 0) {
        u.heartT = 6; // a moment of cross-species affection, then cooldown
        u.heart.visible = true;
      }
      if (u.heartT > 0) {
        u.heartT -= dt;
        if (u.heartT < 4.4) u.heart.visible = false;
      }
    }

    for (const whale of whales) {
      const u = whale.userData;
      if (u.breachT < 0) {
        u.timer -= dt;
        if (u.timer <= 0) startBreach(whale);
        continue;
      }
      u.breachT += dt;
      const k = u.breachT / 4.5; // a long, unhurried arc
      if (k >= 1) {
        u.breachT = -1;
        u.timer = rand(20, 45);
        whale.visible = false;
        continue;
      }
      const arc = Math.sin(k * Math.PI);
      whale.position.set(u.spot.x, WATER_Y - 3.2 + arc * 5.2, u.spot.z);
      whale.rotation.x = (k - 0.5) * -1.1; // nose up, then over
      const sp = Math.hypot(playerPos.x - u.spot.x, playerPos.z - u.spot.z);
      if (k > 0.18 && k < 0.22 && sp < 55) splash();
      u.spout.forEach((puff, i) => {
        const pk = k * 3 - i * 0.25 - 0.6;
        puff.visible = pk > 0 && pk < 1 && arc > 0.6;
        if (puff.visible) {
          puff.position.set(0, 1.6 + pk * 2.2, 2.2);
          puff.material.opacity = 0.7 * (1 - pk);
          puff.scale.setScalar(0.5 + pk * 1.4);
        }
      });
    }
  }

  return { group, update };
}

// The glow worm cave. Outside: a rocky knoll with a dark mouth in the
// cliffside. Inside: a dome of dark stone, constellations of glow worms,
// a still pond, and — at the very back — the Old Light, sleeping.

import * as THREE from 'three';
import { SITES, terrainHeight } from './terrain.js';
import * as zones from './zones.js';
import { register } from './interact.js';
import * as ui from './ui.js';
import * as S from './state.js';
import { rand } from './utils.js';
import { jingle } from './audio.js';

const IN = { x: -300, z: 0 }; // where the cave interior lives, far off-island

// the still pond, world coords — fishing.js casts onto it
export const CAVE_POND = { x: IN.x - 4, z: IN.z + 3, r: 3.6, surfaceY: 0.07 };

function rockMat(color) {
  return new THREE.MeshStandardMaterial({ color, flatShading: true, roughness: 1 });
}

// soft round dot for the glow worm points (otherwise they render as squares)
let glowTex = null;
function glowTexture() {
  if (!glowTex) {
    const cv = document.createElement('canvas');
    cv.width = cv.height = 64;
    const ctx = cv.getContext('2d');
    const grad = ctx.createRadialGradient(32, 32, 2, 32, 32, 30);
    grad.addColorStop(0, 'rgba(255,255,255,1)');
    grad.addColorStop(0.4, 'rgba(255,255,255,0.6)');
    grad.addColorStop(1, 'rgba(255,255,255,0)');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, 64, 64);
    glowTex = new THREE.CanvasTexture(cv);
  }
  return glowTex;
}

export function createCave() {
  const group = new THREE.Group();
  const site = SITES.cave;
  const updates = [];

  // ------------------------------------------------------- the knoll ----
  const knoll = new THREE.Group();
  const baseY = terrainHeight(site.x, site.z);
  for (let i = 0; i < 7; i++) {
    const a = (i / 7) * Math.PI * 2;
    const r = i === 0 ? 0 : rand(1.6, 2.6);
    const rock = new THREE.Mesh(
      new THREE.IcosahedronGeometry(rand(1.6, 2.6), 0),
      rockMat(i % 2 ? 0x6e7479 : 0x7d8287)
    );
    rock.position.set(Math.cos(a) * r, rand(0.4, 1.6), Math.sin(a) * r);
    rock.scale.y = rand(0.8, 1.3);
    rock.rotation.set(rand(0, 1), rand(0, Math.PI), rand(0, 1));
    rock.castShadow = true;
    knoll.add(rock);
  }
  // the mouth: a flat dark disc set into the rocks, facing the village
  const mouth = new THREE.Mesh(
    new THREE.CircleGeometry(1.15, 8),
    new THREE.MeshBasicMaterial({ color: 0x05070d })
  );
  mouth.position.set(0, 1.0, 2.45);
  knoll.add(mouth);
  // two faint glints just inside the dark
  const glintMat = new THREE.MeshBasicMaterial({ color: 0x8fffe9 });
  for (const [gx, gy] of [[-0.3, 1.2], [0.4, 0.8]]) {
    const glint = new THREE.Mesh(new THREE.IcosahedronGeometry(0.05, 0), glintMat);
    glint.position.set(gx, gy, 2.4);
    knoll.add(glint);
  }
  knoll.position.set(site.x, baseY, site.z);
  knoll.rotation.y = site.facing; // mouth toward the village
  group.add(knoll);
  zones.addBlocker(site.x, site.z, 4.6);

  // door: stand at the mouth, slip inside
  const mouthWorld = new THREE.Vector3(
    site.x + Math.sin(site.facing) * 3.2, 0, site.z + Math.cos(site.facing) * 3.2);
  register({
    pos: mouthWorld, r: 2.4, label: 'slip into the cave',
    use: async () => {
      const first = !S.hasFlag('visitedCave');
      S.setFlag('visitedCave');
      await zones.go('cave');
      if (first) {
        ui.say([
          'The dark is soft in here, and full of small green stars.',
          'Something hums, very quietly. Like something dreaming.',
        ]);
      }
    },
  });

  // ---------------------------------------------------- the interior ----
  const cavern = new THREE.Group();

  // floor: a wide, gently lumpy slab of dark stone (subdivided plane —
  // CircleGeometry is a fan with no interior vertices to displace)
  const floorGeo = new THREE.PlaneGeometry(36, 36, 26, 26);
  floorGeo.rotateX(-Math.PI / 2);
  const fpos = floorGeo.attributes.position;
  for (let i = 0; i < fpos.count; i++) {
    const x = fpos.getX(i), z = fpos.getZ(i);
    const d = Math.hypot(x, z);
    // stay flat under the pond (local offset -4, +3) so it reads as water
    if (Math.hypot(x + 4, z - 3) < 4.6) fpos.setY(i, -0.04);
    else if (d > 2) fpos.setY(i, rand(-0.08, 0.18) + d * 0.012);
  }
  floorGeo.computeVertexNormals();
  const floor = new THREE.Mesh(floorGeo, rockMat(0x343b49));
  floor.position.set(IN.x, 0, IN.z);
  cavern.add(floor);

  // dome: BackSide, so the camera sees through the near wall — dollhouse cave
  const dome = new THREE.Mesh(
    new THREE.IcosahedronGeometry(17, 1),
    new THREE.MeshStandardMaterial({
      color: 0x1a2030, flatShading: true, roughness: 1, side: THREE.BackSide,
    })
  );
  dome.scale.y = 0.6;
  dome.position.set(IN.x, 0.5, IN.z);
  cavern.add(dome);

  // stalagmites
  for (let i = 0; i < 9; i++) {
    const a = rand(0, Math.PI * 2);
    const r = rand(9, 14.5);
    const h = rand(0.8, 2.6);
    const stal = new THREE.Mesh(new THREE.ConeGeometry(rand(0.3, 0.6), h, 5), rockMat(0x434b5c));
    stal.position.set(IN.x + Math.cos(a) * r, h / 2, IN.z + Math.sin(a) * r);
    cavern.add(stal);
  }

  // ------------------------------------------------------ glow worms ----
  // constellations on the ceiling: clustered points, additive, twinkling
  const wormGroups = [];
  const palette = [0x8fffe9, 0x9fe8ff, 0xb8ffd0];
  for (let gIdx = 0; gIdx < 3; gIdx++) {
    const pts = [];
    for (let c = 0; c < 5; c++) {
      // cluster center: a direction in the upper dome
      const ca = rand(0, Math.PI * 2);
      const ct = rand(0.25, 1.25); // polar angle from straight up
      for (let k = 0; k < 16; k++) {
        const a = ca + rand(-0.35, 0.35);
        const tta = ct + rand(-0.22, 0.22);
        const R = 15.6;
        pts.push(
          IN.x + Math.sin(tta) * Math.cos(a) * R,
          0.5 + Math.cos(tta) * R * 0.6 * rand(0.92, 1.0),
          IN.z + Math.sin(tta) * Math.sin(a) * R
        );
      }
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.Float32BufferAttribute(pts, 3));
    const matP = new THREE.PointsMaterial({
      color: palette[gIdx], size: 0.34, transparent: true, opacity: 0.8,
      map: glowTexture(), blending: THREE.AdditiveBlending,
      depthWrite: false, sizeAttenuation: true,
    });
    const points = new THREE.Points(geo, matP);
    points.userData.phase = gIdx * 2.1;
    points.userData.speed = 0.7 + gIdx * 0.35;
    wormGroups.push(points);
    cavern.add(points);
  }
  updates.push((dt, t) => {
    for (const w of wormGroups) {
      w.material.opacity = 0.55 + Math.sin(t * w.userData.speed + w.userData.phase) * 0.35;
    }
  });
  // a whisper of cool light so the stone reads as stone
  const caveAmbient = new THREE.PointLight(0x6fd8c9, 50, 40, 2);
  caveAmbient.position.set(IN.x, 6, IN.z);
  cavern.add(caveAmbient);

  // ------------------------------------------------------------ pond ----
  const pondX = IN.x - 4, pondZ = IN.z + 3;
  const pond = new THREE.Mesh(
    new THREE.CircleGeometry(3.6, 20),
    new THREE.MeshStandardMaterial({
      color: 0x0d2433, roughness: 0.15, metalness: 0.1,
      emissive: 0x0a3a38, emissiveIntensity: 0.6,
    })
  );
  pond.rotation.x = -Math.PI / 2;
  pond.position.set(pondX, 0.07, pondZ);
  cavern.add(pond);
  updates.push((dt, t) => {
    pond.material.emissiveIntensity = 0.45 + Math.sin(t * 0.9) * 0.2;
  });
  register({
    pos: new THREE.Vector3(pondX, 0, pondZ), r: 4.6, zone: 'cave',
    label: 'look into the still pond', priority: 0,
    use: () => ui.say([
      'The pond holds the ceiling’s little stars perfectly still.',
      'For a moment it is very hard to tell which way is up. The pond seems fine with this.',
    ]),
  });

  // ------------------------------------------------- glowing mushrooms ----
  const shroomGlow = new THREE.MeshBasicMaterial({ color: 0x7fe8d8 });
  const shroomSpots = [];
  for (let i = 0; i < 6; i++) {
    const a = rand(0, Math.PI * 2);
    const r = rand(6, 13);
    const cluster = new THREE.Group();
    for (let k = 0; k < 3; k++) {
      const stem = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.07, 0.3, 5), rockMat(0x4a5568));
      stem.position.set(rand(-0.3, 0.3), 0.15, rand(-0.3, 0.3));
      const cap = new THREE.Mesh(new THREE.ConeGeometry(0.16, 0.18, 6), shroomGlow);
      cap.position.set(stem.position.x, 0.36, stem.position.z);
      cluster.add(stem, cap);
    }
    cluster.position.set(IN.x + Math.cos(a) * r, 0, IN.z + Math.sin(a) * r);
    cavern.add(cluster);
    shroomSpots.push(cluster.position);
  }

  // ------------------------------------------------ the cave glimmerwing ----
  // a pale moth that drifts between mushroom clusters; net required
  const wing = new THREE.Group();
  {
    const wingGeo = new THREE.PlaneGeometry(0.3, 0.22);
    wingGeo.rotateX(-Math.PI / 2);
    wingGeo.translate(0.16, 0, 0);
    const wingMat = new THREE.MeshBasicMaterial({
      color: 0xd8fff2, side: THREE.DoubleSide, transparent: true, opacity: 0.85,
    });
    const right = new THREE.Mesh(wingGeo, wingMat);
    const left = new THREE.Mesh(wingGeo, wingMat);
    left.scale.x = -1;
    const body = new THREE.Mesh(new THREE.CapsuleGeometry(0.03, 0.14, 2, 5), rockMat(0xb8d8cc));
    body.rotation.x = Math.PI / 2;
    wing.add(right, left, body);
    wing.userData = {
      wings: { left, right },
      home: shroomSpots[0] || new THREE.Vector3(IN.x, 0, IN.z),
      phase: rand(0, Math.PI * 2),
      respawn: 0,
      prev: new THREE.Vector3(),
    };
    cavern.add(wing);
  }
  register({
    getPos: () => wing.position,
    r: 1.8, zone: 'cave',
    enabled: () => wing.visible,
    label: () => (S.state.tools.net ? 'swing at the glimmerwing' : 'watch the glimmerwing'),
    use: () => {
      if (!S.state.tools.net) {
        ui.say('It drifts between the mushrooms like a little ghost on an errand. A net could meet it halfway.');
        return;
      }
      if (Math.random() < 0.6) {
        wing.visible = false;
        wing.userData.respawn = rand(60, 120);
        S.addItem('cave_glimmerwing');
        jingle();
        ui.foundItem('cave_glimmerwing');
        ui.updateHUD();
      } else {
        ui.toast('It melted into the dark, politely.', '🦋');
        wing.userData.home = shroomSpots[Math.floor(rand(0, shroomSpots.length))] || wing.userData.home;
      }
    },
  });
  updates.push((dt, t) => {
    if (!wing.visible) {
      wing.userData.respawn -= dt;
      if (wing.userData.respawn <= 0) wing.visible = true;
      return;
    }
    const u = wing.userData;
    u.prev.copy(wing.position);
    const x = u.home.x + Math.cos(t * 0.4 + u.phase) * 1.6;
    const z = u.home.z + Math.sin(t * 0.33 + u.phase) * 1.6;
    const y = 0.9 + Math.sin(t * 1.1 + u.phase) * 0.3;
    wing.position.set(x, y, z);
    if (u.prev.distanceToSquared(wing.position) > 1e-8) {
      wing.rotation.y = Math.atan2(wing.position.x - u.prev.x, wing.position.z - u.prev.z);
    }
    const flap = Math.sin(t * 14 + u.phase) * 0.8;
    u.wings.right.rotation.z = flap;
    u.wings.left.rotation.z = -flap;
  });

  // -------------------------------------------------- the Old Light ----
  const shrineX = IN.x, shrineZ = IN.z - 11;
  const cairn = new THREE.Group();
  for (let i = 0; i < 5; i++) {
    const rock = new THREE.Mesh(new THREE.IcosahedronGeometry(0.55 - i * 0.08, 0), rockMat(0x4a5060));
    rock.position.y = 0.3 + i * 0.42;
    rock.rotation.y = i * 0.7;
    cairn.add(rock);
  }
  cairn.position.set(shrineX, 0, shrineZ);
  cavern.add(cairn);

  const orb = new THREE.Mesh(
    new THREE.IcosahedronGeometry(0.42, 1),
    new THREE.MeshBasicMaterial({ color: 0xffd9a0, transparent: true, opacity: 0.95 })
  );
  orb.position.set(shrineX, 2.6, shrineZ);
  cavern.add(orb);
  const orbLight = new THREE.PointLight(0xffc97a, 50, 17, 2);
  orbLight.position.set(shrineX, 2.8, shrineZ);
  cavern.add(orbLight);
  updates.push((dt, t) => {
    // slow, sleepy breathing
    const breath = 1 + Math.sin(t * 0.6) * 0.1;
    orb.scale.setScalar(breath);
    orbLight.intensity = 45 + Math.sin(t * 0.6) * 12;
    orb.position.y = 2.6 + Math.sin(t * 0.45) * 0.1;
  });

  register({
    pos: new THREE.Vector3(shrineX, 0, shrineZ + 1.2), r: 2.6, zone: 'cave',
    label: 'read the carved stone',
    use: async () => {
      await ui.say([
        'A flat stone, carved long ago and worn soft:',
        '“HERE SLEEPS THE OLD LIGHT OF LIGHTKEEP ISLE. SPEAK SOFTLY. IT HAD LONG SHIFTS.”',
      ]);
      if (!S.hasFlag('blessedByLight')) {
        S.setFlag('blessedByLight');
        await ui.say('The orb pulses once, gently — like a lighthouse saying hello to a very small boat.');
      }
      // the Labs asked everywhere. "everywhere" includes here.
      if (S.hasFlag('sawRocket') && !S.hasFlag('lightseedGiven')) {
        const give = await ui.ask(
          'The orb drifts lower. It has heard about the rocket — light gossip travels at light speed. It seems to be… offering.',
          [
            { label: '🌟 Cup your paws', value: 'yes' },
            { label: 'Let it sleep', value: null },
          ]);
        if (give) {
          S.setFlag('lightseedGiven');
          S.addItem('lightseed');
          await ui.say([
            'The Old Light gathers itself the way a cat gathers for a jump it has been considering for nine years.',
            'A bead of warm glow rolls off the orb and into your paws. The orb dims — not smaller. Prouder.',
            'It guided a thousand boats home. It has never once guided one OUT. It would very much like to know what that’s like.',
          ]);
          ui.toast('You received the <b>Lightseed</b>! It hums the lighthouse song, very quietly.', '🌟');
        } else {
          ui.say('The orb settles back to its height, unbothered. Lighthouses are extremely good at waiting.');
        }
      }
    },
  });

  // exit back to the island
  zones.registerInterior('cave', {
    floorY: 0,
    bounds: { x0: IN.x - 14.5, x1: IN.x + 14.5, z0: IN.z - 13.5, z1: IN.z + 14.5 },
    blockers: [
      { x: pondX, z: pondZ, r: 3.8 },
      { x: shrineX, z: shrineZ, r: 1.3 },
    ],
    spawn: { x: IN.x, z: IN.z + 12.5, rotY: Math.PI },
    lighting: {
      bg: 0x05070d, fog: 0x05070d, fogNear: 10, fogFar: 48,
      hemiSky: 0x3a4a66, hemiGround: 0x101820, hemiIntensity: 0.35,
      sunIntensity: 0,
    },
  });
  register({
    pos: new THREE.Vector3(IN.x, 0, IN.z + 13.2), r: 1.8, zone: 'cave',
    label: 'climb back out',
    use: () => zones.leaveTo({
      x: site.x + Math.sin(site.facing) * 5.6,
      z: site.z + Math.cos(site.facing) * 5.6,
      rotY: site.facing,
    }),
  });

  group.add(cavern);

  function update(dt, t) {
    for (const u of updates) u(dt, t);
  }

  return { group, update };
}

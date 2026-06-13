import * as THREE from 'three';
import { terrainHeight, clearOfSites, SITES, ISLAND_RADIUS, ISLAND2, ISLAND3, ISLAND5, WATER_Y } from './terrain.js';
import { islandCanWalk } from './zones.js';
import { rand, pick, turnToward } from './utils.js';

function mat(color) {
  return new THREE.MeshStandardMaterial({ color, flatShading: true, roughness: 0.9 });
}

const EYE_MAT = new THREE.MeshStandardMaterial({ color: 0x222222, roughness: 0.35 });
const NOSE_MAT = new THREE.MeshStandardMaterial({ color: 0x3a2c22, roughness: 0.5 });
const BEAK_MAT = mat(0xf2a33c);

function ico(r, detail = 1) {
  return new THREE.IcosahedronGeometry(r, detail);
}

// All animals face +Z; rotation.y = atan2(dx, dz) points them along travel.
export function buildAnimal(kind, colors = {}) {
  const g = new THREE.Group();
  const bodyMat = mat(colors.body ?? 0xc9a06a);
  const headMat = colors.head ? mat(colors.head) : bodyMat;
  const parts = { legs: [], bodyY: 0.62, headY: 1.18 };

  const body = new THREE.Mesh(ico(0.5), bodyMat);
  body.scale.set(1, 0.92, 1.25);
  body.position.y = parts.bodyY;
  g.add(body);
  parts.body = body;

  const head = new THREE.Mesh(ico(0.42), headMat);
  head.position.set(0, parts.headY, 0.34);
  g.add(head);
  parts.head = head;

  parts.eyes = [];
  for (const sx of [-1, 1]) {
    const eye = new THREE.Mesh(ico(0.055, 0), EYE_MAT);
    eye.position.set(sx * 0.17, 1.27, 0.69);
    g.add(eye);
    parts.eyes.push(eye);
  }

  const legGeo = new THREE.CylinderGeometry(0.09, 0.08, 0.4, 6);
  legGeo.translate(0, -0.2, 0); // pivot at the hip so rotation.x swings the leg
  for (const [sx, sz] of [[-1, 1], [1, 1], [-1, -1], [1, -1]]) {
    const leg = new THREE.Mesh(legGeo, bodyMat);
    leg.position.set(sx * 0.23, 0.42, sz * 0.3);
    g.add(leg);
    parts.legs.push(leg);
  }

  if (kind === 'rabbit') {
    const earGeo = new THREE.CapsuleGeometry(0.09, 0.42, 4, 6);
    for (const sx of [-1, 1]) {
      const ear = new THREE.Mesh(earGeo, headMat);
      ear.position.set(sx * 0.15, 1.78, 0.26);
      ear.rotation.z = -sx * 0.18;
      g.add(ear);
    }
    const tail = new THREE.Mesh(ico(0.15), bodyMat);
    tail.position.set(0, 0.68, -0.66);
    g.add(tail);
  } else if (kind === 'fox') {
    const earGeo = new THREE.ConeGeometry(0.15, 0.34, 4);
    for (const sx of [-1, 1]) {
      const ear = new THREE.Mesh(earGeo, headMat);
      ear.position.set(sx * 0.2, 1.66, 0.28);
      g.add(ear);
    }
    const snout = new THREE.Mesh(new THREE.ConeGeometry(0.13, 0.3, 6), headMat);
    snout.rotation.x = Math.PI / 2;
    snout.position.set(0, 1.12, 0.82);
    g.add(snout);
    const nose = new THREE.Mesh(ico(0.05, 0), NOSE_MAT);
    nose.position.set(0, 1.12, 0.97);
    g.add(nose);
    const tail = new THREE.Mesh(ico(0.22), bodyMat);
    tail.scale.set(1, 1, 2.3);
    tail.position.set(0, 0.74, -0.8);
    tail.rotation.x = -0.35;
    g.add(tail);
  } else if (kind === 'duck') {
    const beak = new THREE.Mesh(new THREE.ConeGeometry(0.12, 0.3, 4), BEAK_MAT);
    beak.rotation.x = Math.PI / 2;
    beak.scale.set(1.5, 1, 0.55);
    beak.position.set(0, 1.14, 0.82);
    g.add(beak);
    const tail = new THREE.Mesh(new THREE.ConeGeometry(0.13, 0.3, 5), bodyMat);
    tail.rotation.x = -2.2;
    tail.position.set(0, 0.72, -0.62);
    g.add(tail);
  } else if (kind === 'bear') {
    for (const sx of [-1, 1]) {
      const ear = new THREE.Mesh(ico(0.13), headMat);
      ear.position.set(sx * 0.24, 1.62, 0.26);
      g.add(ear);
    }
    const muzzle = new THREE.Mesh(ico(0.17), mat(0xd8b88a));
    muzzle.scale.set(1.1, 0.8, 1);
    muzzle.position.set(0, 1.1, 0.72);
    g.add(muzzle);
    const nose = new THREE.Mesh(ico(0.06, 0), NOSE_MAT);
    nose.position.set(0, 1.15, 0.86);
    g.add(nose);
    g.scale.setScalar(1.22);
  } else if (kind === 'magpie') {
    // Pip — collector of shiny things, dealer in buttons
    const beak = new THREE.Mesh(new THREE.ConeGeometry(0.1, 0.32, 4), mat(0x6b7280));
    beak.rotation.x = Math.PI / 2;
    beak.position.set(0, 1.16, 0.78);
    g.add(beak);
    const belly = new THREE.Mesh(ico(0.36), mat(0xf5f2e9));
    belly.scale.set(0.9, 0.8, 0.9);
    belly.position.set(0, 0.56, 0.22);
    g.add(belly);
    for (const sx of [-1, 1]) {
      const cheek = new THREE.Mesh(ico(0.13, 0), mat(0xf5f2e9));
      cheek.position.set(sx * 0.3, 1.16, 0.42);
      g.add(cheek);
    }
    const tail = new THREE.Mesh(new THREE.ConeGeometry(0.14, 1.1, 4), mat(0x3a4a6b));
    tail.rotation.x = -1.85;
    tail.scale.z = 0.45;
    tail.position.set(0, 0.78, -0.78);
    g.add(tail);
  } else if (kind === 'moth') {
    // Luna — café keeper, drawn to warm lamps
    for (const sx of [-1, 1]) {
      const antenna = new THREE.Mesh(new THREE.ConeGeometry(0.09, 0.5, 4), headMat);
      antenna.scale.z = 0.3; // feathery: wide and flat
      antenna.position.set(sx * 0.16, 1.74, 0.3);
      antenna.rotation.z = -sx * 0.5;
      g.add(antenna);
    }
    const ruff = new THREE.Mesh(ico(0.3), mat(0xf6efdc));
    ruff.scale.set(1.25, 0.55, 1.1);
    ruff.position.set(0, 0.95, 0.18);
    g.add(ruff);
    const wingGeo = new THREE.PlaneGeometry(0.62, 0.95);
    wingGeo.translate(0.31, -0.32, 0);
    const wingMat = new THREE.MeshStandardMaterial({
      color: 0xf0e3c0, side: THREE.DoubleSide, roughness: 0.85, flatShading: true,
    });
    for (const sx of [-1, 1]) {
      const wing = new THREE.Mesh(wingGeo, wingMat);
      wing.position.set(sx * 0.12, 1.05, -0.3);
      wing.rotation.set(0.5, sx * 2.4, 0);
      g.add(wing);
    }
  } else if (kind === 'tortoise') {
    // Fern — museum curator, older than most rumors
    const shell = new THREE.Mesh(ico(0.62), mat(0x6b7a4a));
    shell.scale.set(0.95, 0.62, 1.05);
    shell.position.set(0, 0.82, -0.12);
    g.add(shell);
    const rim = new THREE.Mesh(ico(0.6), mat(0x55613b));
    rim.scale.set(1.0, 0.3, 1.1);
    rim.position.set(0, 0.62, -0.12);
    g.add(rim);
    // tiny curator's spectacles
    const lensGeo = new THREE.TorusGeometry(0.09, 0.018, 6, 12);
    for (const sx of [-1, 1]) {
      const lens = new THREE.Mesh(lensGeo, EYE_MAT);
      lens.position.set(sx * 0.17, 1.27, 0.7);
      g.add(lens);
    }
  } else if (kind === 'lobster') {
    // Barnaby — grocer, restaurateur, extremely calm about the soup jokes
    for (const sx of [-1, 1]) {
      const claw = new THREE.Mesh(ico(0.22), bodyMat);
      claw.scale.set(1.1, 0.7, 1.4);
      claw.position.set(sx * 0.5, 0.62, 0.55);
      claw.rotation.y = sx * 0.5;
      g.add(claw);
      const antenna = new THREE.Mesh(new THREE.CylinderGeometry(0.02, 0.012, 0.7, 4), bodyMat);
      antenna.position.set(sx * 0.1, 1.62, 0.45);
      antenna.rotation.x = -0.7;
      antenna.rotation.z = -sx * 0.25;
      g.add(antenna);
    }
    const tailFan = new THREE.Mesh(new THREE.ConeGeometry(0.3, 0.5, 5), bodyMat);
    tailFan.rotation.x = -2.0;
    tailFan.scale.y = 0.5;
    tailFan.position.set(0, 0.6, -0.68);
    g.add(tailFan);
  } else if (kind === 'horse') {
    // longer everything: rebuild the legs, lift the body, add neck and mane
    for (const leg of parts.legs) g.remove(leg);
    parts.legs.length = 0;
    const longLeg = new THREE.CylinderGeometry(0.09, 0.07, 0.72, 6);
    longLeg.translate(0, -0.36, 0);
    for (const [sx, sz] of [[-1, 1], [1, 1], [-1, -1], [1, -1]]) {
      const leg = new THREE.Mesh(longLeg, bodyMat);
      leg.position.set(sx * 0.24, 0.74, sz * 0.38);
      g.add(leg);
      parts.legs.push(leg);
    }
    parts.bodyY = 0.95;
    parts.body.position.y = parts.bodyY;
    parts.body.scale.set(1, 0.95, 1.45);
    const neck = new THREE.Mesh(new THREE.CylinderGeometry(0.18, 0.24, 0.7, 6), bodyMat);
    neck.position.set(0, 1.45, 0.45);
    neck.rotation.x = 0.5;
    g.add(neck);
    parts.headY = 1.85;
    parts.head.scale.set(0.85, 0.85, 1.15);
    parts.head.position.set(0, parts.headY, 0.72);
    parts.eyes.forEach((e, i) => e.position.set((i ? 1 : -1) * 0.16, 1.95, 1.0));
    const muzzle = new THREE.Mesh(ico(0.16), mat(0xe8d8c0));
    muzzle.scale.set(0.9, 0.7, 1.1);
    muzzle.position.set(0, 1.78, 1.12);
    g.add(muzzle);
    for (const sx of [-1, 1]) {
      const ear = new THREE.Mesh(new THREE.ConeGeometry(0.09, 0.24, 4), headMat);
      ear.position.set(sx * 0.15, 2.22, 0.62);
      g.add(ear);
    }
    // mane: a row of dark tufts down the neck
    for (let i = 0; i < 4; i++) {
      const tuft = new THREE.Mesh(ico(0.1, 0), mat(0x6b4a2e));
      tuft.scale.set(0.6, 1, 0.8);
      tuft.position.set(0, 2.1 - i * 0.22, 0.52 - i * 0.12);
      g.add(tuft);
    }
    const tail = new THREE.Mesh(new THREE.ConeGeometry(0.12, 0.7, 5), mat(0x6b4a2e));
    tail.position.set(0, 0.85, -0.85);
    tail.rotation.x = 2.6;
    g.add(tail);
  } else if (kind === 'salamander') {
    // low, long, warm — built for flat rocks and cave floors
    for (const leg of parts.legs) g.remove(leg);
    parts.legs.length = 0;
    const stubLeg = new THREE.CylinderGeometry(0.07, 0.06, 0.24, 5);
    stubLeg.translate(0, -0.12, 0);
    for (const [sx, sz] of [[-1, 1], [1, 1], [-1, -1], [1, -1]]) {
      const leg = new THREE.Mesh(stubLeg, bodyMat);
      leg.position.set(sx * 0.3, 0.26, sz * 0.34);
      g.add(leg);
      parts.legs.push(leg);
    }
    parts.bodyY = 0.32;
    parts.body.position.y = parts.bodyY;
    parts.body.scale.set(1.0, 0.55, 1.7);
    parts.headY = 0.5;
    parts.head.scale.setScalar(0.78);
    parts.head.position.set(0, parts.headY, 0.72);
    parts.eyes.forEach((e, i) => e.position.set((i ? 1 : -1) * 0.13, 0.62, 0.98));
    const tail = new THREE.Mesh(new THREE.CapsuleGeometry(0.09, 0.8, 4, 6), bodyMat);
    tail.position.set(0, 0.28, -0.95);
    tail.rotation.x = Math.PI / 2 - 0.12;
    g.add(tail);
    // warm yellow spots down the back
    for (let i = 0; i < 4; i++) {
      const spot = new THREE.Mesh(ico(0.06, 0), mat(0xffd23e, 0.6));
      spot.position.set((i % 2 ? 0.12 : -0.12), 0.6, 0.3 - i * 0.3);
      g.add(spot);
    }
  } else if (kind === 'heron') {
    // tall, patient, slightly liturgical
    for (const leg of parts.legs) g.remove(leg);
    parts.legs.length = 0;
    const thinLeg = new THREE.CylinderGeometry(0.04, 0.035, 0.95, 5);
    thinLeg.translate(0, -0.475, 0);
    for (const sx of [-1, 1]) {
      const leg = new THREE.Mesh(thinLeg, mat(0x55483a));
      leg.position.set(sx * 0.14, 1.0, 0);
      g.add(leg);
      parts.legs.push(leg);
    }
    parts.bodyY = 1.2;
    parts.body.position.y = parts.bodyY;
    parts.body.scale.set(0.85, 0.85, 1.15);
    const neck = new THREE.Mesh(new THREE.CylinderGeometry(0.09, 0.13, 0.85, 6), bodyMat);
    neck.position.set(0, 1.9, 0.3);
    neck.rotation.x = 0.25;
    g.add(neck);
    parts.headY = 2.35;
    parts.head.scale.setScalar(0.62);
    parts.head.position.set(0, parts.headY, 0.42);
    parts.eyes.forEach((e, i) => e.position.set((i ? 1 : -1) * 0.1, 2.42, 0.62));
    const beak = new THREE.Mesh(new THREE.ConeGeometry(0.07, 0.55, 5), mat(0xd9a440, 0.5));
    beak.rotation.x = Math.PI / 2;
    beak.position.set(0, 2.32, 0.85);
    g.add(beak);
    const crest = new THREE.Mesh(new THREE.ConeGeometry(0.05, 0.3, 4), mat(0x2e3e5c));
    crest.position.set(0, 2.55, 0.15);
    crest.rotation.x = -2.4;
    g.add(crest);
  } else if (kind === 'mole') {
    // velvet, dignity, very small spectacles
    parts.body.scale.set(1.05, 1.05, 1.15);
    const snoutM = new THREE.Mesh(new THREE.ConeGeometry(0.14, 0.3, 6), mat(0xf2a8b8, 0.6));
    snoutM.rotation.x = Math.PI / 2;
    snoutM.position.set(0, 1.16, 0.82);
    g.add(snoutM);
    parts.eyes.forEach((e) => e.scale.setScalar(0.6)); // moles squint generationally
    for (const sx of [-1, 1]) {
      const paw = new THREE.Mesh(ico(0.14, 0), mat(0xf2c6c6, 0.7));
      paw.scale.set(1.3, 0.5, 1);
      paw.position.set(sx * 0.42, 0.62, 0.4);
      paw.rotation.z = -sx * 0.5;
      g.add(paw);
    }
  } else if (kind === 'penguin') {
    const belly = new THREE.Mesh(ico(0.4), mat(0xf5f2e9));
    belly.scale.set(0.85, 0.95, 0.7);
    belly.position.set(0, 0.62, 0.22);
    g.add(belly);
    const beakP = new THREE.Mesh(new THREE.ConeGeometry(0.09, 0.26, 4), mat(0xe8a23c, 0.5));
    beakP.rotation.x = Math.PI / 2;
    beakP.position.set(0, 1.18, 0.8);
    g.add(beakP);
    for (const sx of [-1, 1]) {
      const flipper = new THREE.Mesh(ico(0.18, 0), bodyMat);
      flipper.scale.set(0.4, 1.4, 0.8);
      flipper.position.set(sx * 0.52, 0.7, 0);
      flipper.rotation.z = -sx * 0.25;
      g.add(flipper);
    }
  } else if (kind === 'hedgehog') {
    for (let i = 0; i < 10; i++) {
      const spike = new THREE.Mesh(new THREE.ConeGeometry(0.08, 0.3, 4), mat(0x6e5a44, 0.95));
      const a = (i / 10) * Math.PI * 1.3 - Math.PI * 0.15;
      spike.position.set(
        Math.sin(i * 2.4) * 0.25,
        0.75 + Math.sin(a) * 0.35,
        -0.1 - Math.cos(a) * 0.35
      );
      spike.rotation.x = -a - 0.6;
      g.add(spike);
    }
    const noseH = new THREE.Mesh(ico(0.05, 0), NOSE_MAT);
    noseH.position.set(0, 1.16, 0.82);
    g.add(noseH);
    g.scale.setScalar(0.85);
  } else if (kind === 'capybara') {
    // the calmest geometry in the archipelago
    parts.body.scale.set(1.35, 1.15, 1.6);
    parts.bodyY = 0.72;
    parts.body.position.y = parts.bodyY;
    parts.head.scale.set(1.0, 0.95, 1.25); // the famous rectangle
    parts.headY = 1.28;
    parts.head.position.set(0, parts.headY, 0.6);
    parts.eyes.forEach((e, i) => e.position.set((i ? 1 : -1) * 0.2, 1.42, 0.95));
    const muzzleCap = new THREE.Mesh(new THREE.BoxGeometry(0.4, 0.26, 0.3), headMat);
    muzzleCap.position.set(0, 1.26, 1.05);
    g.add(muzzleCap);
    for (const sx of [-1, 1]) {
      const earCap = new THREE.Mesh(ico(0.08, 0), headMat);
      earCap.position.set(sx * 0.26, 1.62, 0.42);
      g.add(earCap);
    }
    g.scale.setScalar(1.2);
  } else if (kind === 'croc') {
    parts.body.scale.set(1.1, 0.7, 2.4);
    parts.bodyY = 0.5;
    parts.body.position.y = parts.bodyY;
    parts.headY = 0.62;
    parts.head.scale.set(0.85, 0.55, 1.0);
    parts.head.position.set(0, parts.headY, 1.1);
    parts.eyes.forEach((e, i) => e.position.set((i ? 1 : -1) * 0.16, 0.85, 1.2));
    const snoutC = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.28, 1.0), headMat);
    snoutC.position.set(0, 0.58, 1.8);
    g.add(snoutC);
    // the patient smile
    const smileC = new THREE.Mesh(new THREE.BoxGeometry(0.52, 0.04, 0.9), mat(0x2e3a2a, 0.6));
    smileC.position.set(0, 0.5, 1.78);
    g.add(smileC);
    for (let i = 0; i < 5; i++) {
      const scute = new THREE.Mesh(new THREE.ConeGeometry(0.1, 0.22, 4), mat(0x445a3a, 0.95));
      scute.position.set(0, 0.92 - i * 0.04, 0.2 - i * 0.5);
      g.add(scute);
    }
    const tailCr = new THREE.Mesh(new THREE.ConeGeometry(0.28, 1.6, 5), bodyMat);
    tailCr.rotation.x = -Math.PI / 2 - 0.06;
    tailCr.position.set(0, 0.42, -2.0);
    g.add(tailCr);
    const stubby = new THREE.CylinderGeometry(0.09, 0.08, 0.3, 5);
    for (const leg of parts.legs) g.remove(leg);
    parts.legs.length = 0;
    for (const [sx, sz] of [[-1, 1.1], [1, 1.1], [-1, -1.1], [1, -1.1]]) {
      const leg = new THREE.Mesh(stubby, bodyMat);
      leg.position.set(sx * 0.5, 0.2, sz * 0.7);
      g.add(leg);
      parts.legs.push(leg);
    }
    // every crocodile retains a plover, on commission
    const plover = new THREE.Group();
    const pbody = new THREE.Mesh(ico(0.09, 0), mat(0xf5f2e9, 0.7));
    pbody.position.y = 0.06;
    plover.add(pbody);
    const phead = new THREE.Mesh(ico(0.055, 0), mat(0x55483a, 0.7));
    phead.position.set(0, 0.14, 0.05);
    plover.add(phead);
    const pbeak = new THREE.Mesh(new THREE.ConeGeometry(0.02, 0.07, 4), mat(0xe8a23c, 0.5));
    pbeak.rotation.x = Math.PI / 2;
    pbeak.position.set(0, 0.13, 0.12);
    plover.add(pbeak);
    plover.position.set(0, 0.78, 1.6);
    g.add(plover);
    parts.plover = plover;
  } else if (kind === 'cow') {
    parts.body.scale.set(1.2, 1.0, 1.4);
    for (const sx of [-1, 1]) {
      const horn = new THREE.Mesh(new THREE.ConeGeometry(0.07, 0.26, 5), mat(0xe8e0d0, 0.5));
      horn.position.set(sx * 0.26, 1.62, 0.2);
      horn.rotation.z = -sx * 0.7;
      g.add(horn);
      const earC = new THREE.Mesh(ico(0.11, 0), headMat);
      earC.scale.set(1.6, 0.6, 0.8);
      earC.position.set(sx * 0.38, 1.42, 0.24);
      g.add(earC);
    }
    const muzzleC = new THREE.Mesh(ico(0.22), mat(0xf2c6c6, 0.8));
    muzzleC.scale.set(1.25, 0.75, 0.9);
    muzzleC.position.set(0, 1.08, 0.74);
    g.add(muzzleC);
    for (const [nx2, nz2] of [[-0.08, 0], [0.08, 0]]) {
      const nostril = new THREE.Mesh(ico(0.035, 0), NOSE_MAT);
      nostril.position.set(nx2, 1.08, 0.92 + nz2);
      g.add(nostril);
    }
    // patchwork spots
    for (const [px2, py2, pz2, pr] of [[-0.3, 0.75, 0.2, 0.2], [0.25, 0.62, -0.3, 0.24], [0.05, 0.85, -0.05, 0.16]]) {
      const spot = new THREE.Mesh(ico(pr, 0), mat(0x4a4440, 0.9));
      spot.scale.y = 0.5;
      spot.position.set(px2, py2, pz2);
      g.add(spot);
    }
    const tailC = new THREE.Mesh(new THREE.CapsuleGeometry(0.045, 0.5, 3, 5), bodyMat);
    tailC.position.set(0, 0.72, -0.72);
    tailC.rotation.x = -0.4;
    g.add(tailC);
    g.scale.setScalar(1.15);
  } else if (kind === 'mouse') {
    for (const sx of [-1, 1]) {
      const earM = new THREE.Mesh(new THREE.CylinderGeometry(0.16, 0.16, 0.05, 10), headMat);
      earM.rotation.x = Math.PI / 2 - 0.3;
      earM.position.set(sx * 0.22, 1.62, 0.18);
      g.add(earM);
    }
    const noseM = new THREE.Mesh(ico(0.05, 0), mat(0xf2a8b8, 0.5));
    noseM.position.set(0, 1.2, 0.82);
    g.add(noseM);
    const tailM = new THREE.Mesh(new THREE.CapsuleGeometry(0.035, 0.7, 3, 5), mat(0xf2c6c6, 0.7));
    tailM.position.set(0, 0.55, -0.7);
    tailM.rotation.x = Math.PI / 2 - 0.5;
    g.add(tailM);
    g.scale.setScalar(0.78); // a mouse-sized mouse
  } else if (kind === 'owl') {
    // directorial: tufts, enormous eyes, a gaze that has read your proposal
    parts.head.scale.setScalar(1.15);
    parts.eyes.forEach((e, i) => {
      e.scale.setScalar(1.7);
      e.position.set((i ? 1 : -1) * 0.18, 1.3, 0.72);
    });
    for (const sx of [-1, 1]) {
      const ring = new THREE.Mesh(new THREE.TorusGeometry(0.13, 0.025, 6, 12), mat(0xf2e6c8, 0.7));
      ring.position.set(sx * 0.18, 1.3, 0.73);
      g.add(ring);
      const tuft = new THREE.Mesh(new THREE.ConeGeometry(0.1, 0.32, 4), headMat);
      tuft.position.set(sx * 0.26, 1.74, 0.24);
      tuft.rotation.z = -sx * 0.35;
      g.add(tuft);
      const wing = new THREE.Mesh(ico(0.26, 0), bodyMat);
      wing.scale.set(0.35, 1.5, 0.9);
      wing.position.set(sx * 0.5, 0.68, -0.05);
      wing.rotation.z = -sx * 0.12;
      g.add(wing);
    }
    const beakO = new THREE.Mesh(new THREE.ConeGeometry(0.08, 0.2, 4), mat(0xd9a440, 0.5));
    beakO.rotation.x = Math.PI / 2 + 0.25;
    beakO.position.set(0, 1.2, 0.8);
    g.add(beakO);
    const bellyO = new THREE.Mesh(ico(0.36), mat(0xefe4cb));
    bellyO.scale.set(0.85, 0.85, 0.7);
    bellyO.position.set(0, 0.6, 0.26);
    g.add(bellyO);
  } else if (kind === 'bat') {
    // librarian build: enormous ears, reading posture, folded wings
    for (const sx of [-1, 1]) {
      const ear = new THREE.Mesh(new THREE.ConeGeometry(0.16, 0.55, 4), headMat);
      ear.position.set(sx * 0.2, 1.85, 0.2);
      ear.rotation.z = -sx * 0.12;
      g.add(ear);
      const wing = new THREE.Mesh(new THREE.PlaneGeometry(0.55, 0.9),
        new THREE.MeshStandardMaterial({ color: 0x3a3248, side: THREE.DoubleSide, roughness: 0.85, flatShading: true }));
      wing.position.set(sx * 0.5, 0.75, -0.1);
      wing.rotation.y = sx * 0.45;
      wing.rotation.z = sx * 0.2;
      g.add(wing);
    }
  } else if (kind === 'axolotl') {
    // like the salamander, but pink and medically licensed
    for (const leg of parts.legs) g.remove(leg);
    parts.legs.length = 0;
    const stubby = new THREE.CylinderGeometry(0.08, 0.07, 0.3, 5);
    stubby.translate(0, -0.15, 0);
    for (const [sx, sz] of [[-1, 1], [1, 1], [-1, -1], [1, -1]]) {
      const leg = new THREE.Mesh(stubby, bodyMat);
      leg.position.set(sx * 0.28, 0.32, sz * 0.32);
      g.add(leg);
      parts.legs.push(leg);
    }
    parts.bodyY = 0.4;
    parts.body.position.y = parts.bodyY;
    parts.body.scale.set(1.0, 0.65, 1.5);
    parts.headY = 0.72;
    parts.head.scale.setScalar(0.95);
    parts.head.position.set(0, parts.headY, 0.55);
    parts.eyes.forEach((e, i) => e.position.set((i ? 1 : -1) * 0.16, 0.82, 0.88));
    // the famous gill fronds, like a small celebration around the head
    for (const sx of [-1, 1]) {
      for (let k = 0; k < 3; k++) {
        const frond = new THREE.Mesh(new THREE.ConeGeometry(0.05, 0.3, 4), mat(0xe06a8a, 0.7));
        frond.position.set(sx * (0.3 + k * 0.06), 0.85 + k * 0.1, 0.4 - k * 0.12);
        frond.rotation.z = -sx * (0.9 + k * 0.3);
        g.add(frond);
      }
    }
    const tailA = new THREE.Mesh(new THREE.CapsuleGeometry(0.1, 0.7, 4, 6), bodyMat);
    tailA.position.set(0, 0.36, -0.95);
    tailA.rotation.x = Math.PI / 2 - 0.1;
    g.add(tailA);
  } else if (kind === 'boar') {
    // wild, bristly, fundamentally a softie
    parts.body.scale.set(1.15, 1.0, 1.35);
    const snoutB = new THREE.Mesh(new THREE.CylinderGeometry(0.16, 0.2, 0.25, 7), headMat);
    snoutB.rotation.x = Math.PI / 2;
    snoutB.position.set(0, 1.12, 0.85);
    g.add(snoutB);
    const snoutTip = new THREE.Mesh(new THREE.CylinderGeometry(0.17, 0.17, 0.06, 7), NOSE_MAT);
    snoutTip.rotation.x = Math.PI / 2;
    snoutTip.position.set(0, 1.12, 0.99);
    g.add(snoutTip);
    for (const sx of [-1, 1]) {
      const tusk = new THREE.Mesh(new THREE.ConeGeometry(0.05, 0.22, 4), mat(0xf2efe4, 0.4));
      tusk.position.set(sx * 0.22, 1.02, 0.8);
      tusk.rotation.x = -0.5;
      tusk.rotation.z = -sx * 0.4;
      g.add(tusk);
      const earB = new THREE.Mesh(new THREE.ConeGeometry(0.12, 0.26, 4), headMat);
      earB.position.set(sx * 0.2, 1.66, 0.22);
      earB.rotation.z = -sx * 0.45;
      g.add(earB);
    }
    for (let i = 0; i < 4; i++) {
      const bristle = new THREE.Mesh(new THREE.ConeGeometry(0.09, 0.26, 4), mat(0x3e3228, 0.95));
      bristle.position.set(0, 1.16 - i * 0.05, 0.15 - i * 0.28);
      bristle.rotation.x = -0.4;
      g.add(bristle);
    }
    const tailB = new THREE.Mesh(new THREE.CapsuleGeometry(0.04, 0.3, 3, 5), bodyMat);
    tailB.position.set(0, 0.8, -0.68);
    tailB.rotation.x = -0.7;
    g.add(tailB);
    g.scale.setScalar(1.1);
  } else if (kind === 'cat') {
    const earGeo = new THREE.ConeGeometry(0.14, 0.28, 4);
    for (const sx of [-1, 1]) {
      const ear = new THREE.Mesh(earGeo, headMat);
      ear.position.set(sx * 0.18, 1.68, 0.28);
      g.add(ear);
    }
    const tail = new THREE.Mesh(new THREE.CapsuleGeometry(0.07, 0.55, 4, 6), bodyMat);
    tail.position.set(0.12, 0.78, -0.62);
    tail.rotation.x = -0.9;
    g.add(tail);
  }

  g.traverse((o) => {
    if (o.isMesh) o.castShadow = true;
  });
  g.userData.parts = parts;
  return g;
}

// Shared walk cycle: diagonal leg pairs plus a happy little body bob.
export function animateGait(g, t, walk, rate = 10) {
  const p = g.userData.parts;
  for (let i = 0; i < p.legs.length; i++) {
    const phase = i === 0 || i === 3 ? 0 : Math.PI;
    p.legs[i].rotation.x = Math.sin(t * rate + phase) * 0.7 * walk;
  }
  p.body.position.y = p.bodyY + Math.abs(Math.sin(t * rate)) * 0.06 * walk;
  p.head.position.y = p.headY + Math.abs(Math.sin(t * rate + 0.4)) * 0.04 * walk;
  if (p.plover) {
    // the attendant keeps its footing and paces the jaw
    p.plover.position.y = 0.78 + Math.max(0, Math.sin(t * 2.2)) * 0.08;
    p.plover.position.z = 1.6 + Math.sin(t * 0.3) * 0.25;
  }
}

const EMOTES = ['❗', '💛', '💬', '🎵'];
const emoteTextures = new Map();

function emoteTexture(char) {
  if (!emoteTextures.has(char)) {
    const cv = document.createElement('canvas');
    cv.width = cv.height = 128;
    const ctx = cv.getContext('2d');
    ctx.font = '96px sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(char, 64, 70);
    const tex = new THREE.CanvasTexture(cv);
    tex.colorSpace = THREE.SRGBColorSpace;
    emoteTextures.set(char, tex);
  }
  return emoteTextures.get(char);
}

const ROSTER = [
  { kind: 'rabbit', body: 0xf5e6c8 },
  { kind: 'rabbit', body: 0xb98c5f },
  { kind: 'fox', body: 0xe88a3a, range: 'far' },  // Saffron moved for the garden
  { kind: 'fox', body: 0x9aa3ad }, // basically a wolf, do not tell him otherwise
  { kind: 'bear', body: 0x8d6748, range: 'far' }, // Bramble likes the quiet side
  { kind: 'duck', body: 0xf5f2e9 },
  { kind: 'duck', body: 0x9b7d54, head: 0x2f7d4f }, // mallard
  { kind: 'horse', body: 0xc98f5a, range: 'far' },   // Marigold, of the Far Isle
  { kind: 'salamander', body: 0xe8743a, range: 'far' }, // Ember — Far Isle resident, cave regular
  { kind: 'boar', body: 0x6e5a44, head: 0x6e5a44, range: 'north' }, // Tusk, of the moss
  { kind: 'cow', body: 0xf2ead8, head: 0xf2ead8, range: 'north' }, // Butterpat
  { kind: 'mouse', body: 0xb8a890, range: 'everywhere' },          // Crumb, of the MouseBoat
  { kind: 'capybara', body: 0xb08a5a, head: 0xb08a5a, range: 'grove' }, // Mochi
  { kind: 'capybara', body: 0x9a7448, head: 0x9a7448, range: 'grove' }, // Pondo
  { kind: 'croc', body: 0x55772f, head: 0x55772f, range: 'grove' },     // Sol
  { kind: 'croc', body: 0x4a6a2a, head: 0x4a6a2a, range: 'grove' },     // Brook
];

function rangeOf(spec) {
  if (spec.range === 'far') return { x: ISLAND2.x, z: ISLAND2.z, R: ISLAND2.r - 2 };
  if (spec.range === 'north') return { x: ISLAND3.x, z: ISLAND3.z, R: ISLAND3.r - 2 };
  if (spec.range === 'cave') return { x: SITES.cave.x, z: SITES.cave.z, R: 11 };
  if (spec.range === 'grove') return { x: ISLAND5.x, z: ISLAND5.z + 10, R: ISLAND5.r + 12 };
  // Crumb claims every shore, but a sailor of naps stays near his bunk —
  // you'll usually find him in MouseBoat waters, off the north isle
  if (spec.range === 'everywhere') return { x: ISLAND3.x + 5, z: ISLAND3.z + 5, R: 55 };
  return { x: 0, z: 0, R: ISLAND_RADIUS };
}

export function createAnimals() {
  const group = new THREE.Group();
  const animals = [];

  for (const spec of ROSTER) {
    const g = buildAnimal(spec.kind, { body: spec.body, head: spec.head });
    const swims = spec.kind === 'duck';

    // ducks start on the beach, everyone else on grass near their range
    const range = rangeOf(spec);
    let x = range.x, z = range.z;
    for (let tries = 0; tries < 60; tries++) {
      const a = rand(0, Math.PI * 2);
      const r = rand(Math.min(8, range.R * 0.4), range.R - 2);
      const tx = range.x + Math.cos(a) * r, tz = range.z + Math.sin(a) * r;
      const h = terrainHeight(tx, tz);
      const ok = swims ? h > -0.45 && h < 0.25 : h > 0.4 && clearOfSites(tx, tz, 2);
      if (ok && animals.every((o) => o.g.position.distanceTo(new THREE.Vector3(tx, 0, tz)) > 6)) {
        x = tx;
        z = tz;
        break;
      }
    }
    g.position.set(x, terrainHeight(x, z), z);
    g.rotation.y = rand(0, Math.PI * 2);

    const sprite = new THREE.Sprite(
      new THREE.SpriteMaterial({ map: emoteTexture('❗'), transparent: true, depthWrite: false })
    );
    sprite.scale.set(0.8, 0.8, 1);
    sprite.position.y = 2.1;
    sprite.visible = false;
    g.add(sprite);

    group.add(g);
    animals.push({
      g,
      swims,
      sprite,
      range,
      state: 'idle',
      timer: rand(0.5, 3),
      target: new THREE.Vector3(),
      speed: spec.kind === 'bear' ? 1.4 : 1.9,
      walk: 0,
      hopT: 1,
      emoteT: 0,
      phase: rand(0, Math.PI * 2),
    });
  }

  function pickTarget(a) {
    for (let tries = 0; tries < 10; tries++) {
      const ang = rand(0, Math.PI * 2);
      const r = rand(3, 10);
      const nx = a.g.position.x + Math.cos(ang) * r;
      const nz = a.g.position.z + Math.sin(ang) * r;
      if (Math.hypot(nx - a.range.x, nz - a.range.z) > a.range.R + (a.swims ? 8 : 2)) continue;
      const h = terrainHeight(nx, nz);
      const ok = a.swims ? h > 0.05 || h < WATER_Y - 0.25 : h > 0.05;
      if (ok) {
        a.target.set(nx, 0, nz);
        return true;
      }
    }
    return false;
  }

  function update(dt, t, playerPos) {
    for (const a of animals) {
      if (a.away) continue; // home for the evening — houses.js hosts them now
      const g = a.g;
      const dxp = playerPos.x - g.position.x;
      const dzp = playerPos.z - g.position.z;
      const distP = Math.hypot(dxp, dzp);
      let walking = false;

      if (distP < 3.4) {
        if (a.state !== 'greet') {
          a.state = 'greet';
          a.hopT = 0;
          a.emoteT = 1.6;
          a.sprite.material.map = emoteTexture(pick(EMOTES));
          a.sprite.visible = true;
        }
        g.rotation.y = turnToward(g.rotation.y, Math.atan2(dxp, dzp), dt, 8);
      } else if (a.state === 'greet') {
        a.state = 'idle';
        a.timer = rand(0.5, 2);
      } else if (a.state === 'idle') {
        a.timer -= dt;
        if (a.timer <= 0) {
          a.state = pickTarget(a) ? 'walk' : 'idle';
          if (a.state === 'idle') a.timer = rand(1, 3);
        }
      } else if (a.state === 'walk') {
        const dx = a.target.x - g.position.x;
        const dz = a.target.z - g.position.z;
        const dist = Math.hypot(dx, dz);
        if (dist < 0.4) {
          a.state = 'idle';
          a.timer = rand(1.5, 4.5);
        } else {
          const nx = g.position.x + (dx / dist) * a.speed * dt;
          const nz = g.position.z + (dz / dist) * a.speed * dt;
          // ducks may swim where walkers can't; walkers respect buildings
          if (a.swims || islandCanWalk(nx, nz)) {
            g.rotation.y = turnToward(g.rotation.y, Math.atan2(dx, dz), dt, 6);
            g.position.x = nx;
            g.position.z = nz;
            walking = true;
          } else {
            a.state = 'idle';
            a.timer = rand(1, 3);
          }
        }
      }

      // settle onto land or float in water
      const h = terrainHeight(g.position.x, g.position.z);
      if (a.swims && h < WATER_Y - 0.05) {
        g.position.y = WATER_Y - 0.24 + Math.sin(t * 2 + a.phase) * 0.05;
        a.walk += (0 - a.walk) * Math.min(1, dt * 8);
      } else {
        g.position.y = h;
        a.walk += ((walking ? 1 : 0) - a.walk) * Math.min(1, dt * 8);
      }

      // one happy hop when greeting starts
      if (a.hopT < 0.45) {
        a.hopT += dt;
        g.position.y += Math.sin(Math.min(a.hopT / 0.45, 1) * Math.PI) * 0.3;
      }

      if (a.emoteT > 0) {
        a.emoteT -= dt;
        a.sprite.position.y = 2.1 + Math.sin(Math.min(1, (1.6 - a.emoteT) * 4) * Math.PI * 0.5) * 0.15;
        if (a.emoteT <= 0) a.sprite.visible = false;
      }

      animateGait(g, t + a.phase, a.walk);
    }
  }

  return { group, update, animals };
}

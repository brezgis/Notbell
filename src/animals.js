import * as THREE from 'three';
import { terrainHeight, clearOfSites, SITES, ISLAND_RADIUS, ISLAND2, ISLAND3, ISLAND5, VOLCANO_SHELF, WATER_Y } from './terrain.js';
import { islandCanWalk, islandCanStand, islandGroundHeight, solidAt, islandOf, findRoute } from './zones.js';
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
  } else if (kind === 'bee') {
    // round, fuzzy, striped, busy: black bands, glassy wings, a little sting
    const black = mat(0x2e2a26);
    for (const z of [-0.12, 0.2]) {
      const band = new THREE.Mesh(ico(0.51, 1), black);
      band.scale.set(1.02, 0.94, 0.14);
      band.position.set(0, parts.bodyY, z);
      g.add(band);
    }
    const sting = new THREE.Mesh(new THREE.ConeGeometry(0.08, 0.22, 5), black);
    sting.rotation.x = -Math.PI / 2;
    sting.position.set(0, parts.bodyY, -0.72);
    g.add(sting);
    for (const sx of [-1, 1]) {
      const ant = new THREE.Mesh(new THREE.CylinderGeometry(0.018, 0.018, 0.34, 4), black);
      ant.position.set(sx * 0.13, 1.66, 0.42);
      ant.rotation.z = -sx * 0.4;
      ant.rotation.x = 0.3;
      g.add(ant);
      const tip = new THREE.Mesh(ico(0.05, 0), black);
      tip.position.set(sx * 0.2, 1.82, 0.47);
      g.add(tip);
    }
    const wingMat = new THREE.MeshStandardMaterial({ color: 0xe8f6ff, transparent: true, opacity: 0.6, side: THREE.DoubleSide, roughness: 0.2 });
    parts.wings = [];
    for (const sx of [-1, 1]) {
      const pivot = new THREE.Group();
      pivot.position.set(sx * 0.15, 1.08, -0.05);
      const w = new THREE.Mesh(new THREE.CircleGeometry(0.34, 8), wingMat);
      w.scale.set(1, 0.6, 1);
      w.position.x = sx * 0.3;
      pivot.add(w);
      pivot.rotation.set(-0.9, 0, sx * 0.3);
      pivot.userData.baseY = 0;
      g.add(pivot);
      parts.wings.push(pivot);
    }
  } else if (kind === 'skunk') {
    // black and white and extremely relaxed about it
    const white = mat(colors.stripe ?? 0xf3efe6);
    const earGeo = new THREE.ConeGeometry(0.12, 0.2, 4);
    for (const sx of [-1, 1]) {
      const ear = new THREE.Mesh(earGeo, headMat);
      ear.position.set(sx * 0.22, 1.58, 0.28);
      g.add(ear);
    }
    const blaze = new THREE.Mesh(ico(0.1, 0), white); // the stripe starts on the nose
    blaze.scale.set(0.8, 0.5, 2.2);
    blaze.position.set(0, 1.5, 0.45);
    g.add(blaze);
    const stripe = new THREE.Mesh(ico(0.2, 0), white);
    stripe.scale.set(0.9, 0.5, 2.6);
    stripe.position.set(0, 1.04, -0.1);
    g.add(stripe);
    const snout = new THREE.Mesh(new THREE.ConeGeometry(0.12, 0.26, 6), headMat);
    snout.rotation.x = Math.PI / 2;
    snout.position.set(0, 1.1, 0.8);
    g.add(snout);
    const nose = new THREE.Mesh(ico(0.05, 0), NOSE_MAT);
    nose.position.set(0, 1.1, 0.94);
    g.add(nose);
    // the tail: a great plume, up and curling over, striped down the middle
    const plume = new THREE.Mesh(ico(0.36), bodyMat);
    plume.scale.set(0.9, 1.6, 0.9);
    plume.position.set(0, 1.25, -0.85);
    plume.rotation.x = -0.35;
    g.add(plume);
    const plumeStripe = new THREE.Mesh(ico(0.2, 0), white);
    plumeStripe.scale.set(0.7, 2.2, 0.6);
    plumeStripe.position.set(0, 1.35, -0.72);
    plumeStripe.rotation.x = -0.35;
    g.add(plumeStripe);
    // white rims round the eyes, or they vanish into all that black
    parts.eyes.forEach((e) => {
      const rim = new THREE.Mesh(ico(0.075, 0), white);
      rim.position.copy(e.position).add(new THREE.Vector3(0, 0, -0.02));
      g.add(rim);
    });
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
    // wings: a rounded forewing and hindwing on each side, rooted at the
    // shoulders and spread out behind her like a moth at rest — with a soft
    // eyespot each. (They flutter a little: see idleAll.)
    const wingShape = new THREE.Shape();
    wingShape.moveTo(0, 0.05);
    wingShape.quadraticCurveTo(0.5, 0.42, 0.95, 0.3);
    wingShape.quadraticCurveTo(1.05, 0.0, 0.8, -0.2);
    wingShape.quadraticCurveTo(0.75, -0.6, 0.35, -0.62);
    wingShape.quadraticCurveTo(0.1, -0.45, 0, -0.1);
    const wingGeo = new THREE.ShapeGeometry(wingShape, 3);
    const wingMat = new THREE.MeshStandardMaterial({
      color: colors.wing ?? 0xf0e3c0, side: THREE.DoubleSide, roughness: 0.85, flatShading: true,
    });
    const spotMat = new THREE.MeshStandardMaterial({ color: 0xc9a86a, side: THREE.DoubleSide, roughness: 0.85 });
    parts.wings = [];
    for (const sx of [-1, 1]) {
      const pivot = new THREE.Group();
      pivot.position.set(sx * 0.2, 1.12, -0.28);
      const wing = new THREE.Mesh(wingGeo, wingMat);
      wing.scale.x = sx; // mirror for the left side
      pivot.add(wing);
      const spot = new THREE.Mesh(new THREE.CircleGeometry(0.1, 8), spotMat);
      spot.position.set(sx * 0.55, 0.02, 0.01);
      pivot.add(spot);
      pivot.rotation.set(-0.35, sx * -0.55, sx * -0.15); // swept back, a touch lifted
      pivot.userData.baseY = pivot.rotation.y;
      g.add(pivot);
      parts.wings.push(pivot);
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
    // eyes ON the long face (they used to sit inside it), a little bigger
    parts.eyes.forEach((e, i) => { e.position.set((i ? 1 : -1) * 0.3, 1.97, 0.93); e.scale.setScalar(1.5); });
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
    // the tail: rooted at the top of the rump (narrow end), falling down
    // and back into a full brush — it used to float behind her, upside down
    const tail = new THREE.Mesh(new THREE.ConeGeometry(0.16, 0.85, 6), mat(0x6b4a2e));
    tail.rotation.x = 0.35;
    tail.position.set(0, 1.08 - 0.4, -0.7 - 0.15);
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
    for (const [i, sx] of [[0, -1], [1, 1]]) {
      const paw = new THREE.Mesh(ico(0.14, 0), mat(0xf2c6c6, 0.7));
      paw.scale.set(1.3, 0.5, 1);
      paw.position.set(0, -0.4, 0.06);
      paw.rotation.z = -sx * 0.5;
      parts.legs[i].add(paw);
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
  } else if (kind === 'sloth') {
    // built for patience: low head, long arms, and a little moss of his own
    parts.body.scale.set(1.15, 1.05, 1.15);
    parts.head.scale.set(1.05, 0.95, 1.0);
    parts.headY = 1.02;
    parts.head.position.set(0, parts.headY, 0.4);
    parts.eyes.forEach((e, i) => e.position.set((i ? 1 : -1) * 0.16, 1.1, 0.72));
    for (const sx of [-1, 1]) { // the signature eye-streaks, worn like reading glasses
      const streak = new THREE.Mesh(ico(0.09, 0), mat(0x4a3f33));
      streak.scale.set(1.6, 0.5, 0.5);
      streak.position.set(sx * 0.2, 1.06, 0.7);
      streak.rotation.z = sx * -0.5;
      g.add(streak);
    }
    for (const sx of [-1, 1]) { // arms long enough to never hurry
      const arm = new THREE.Mesh(new THREE.CylinderGeometry(0.09, 0.11, 0.95, 6), bodyMat);
      arm.position.set(sx * 0.5, 0.55, 0.18);
      arm.rotation.z = sx * 0.16;
      g.add(arm);
      const paw = new THREE.Mesh(ico(0.1, 0), mat(0x6b5a44));
      paw.scale.set(1, 0.7, 1.3);
      paw.position.set(sx * 0.57, 0.1, 0.2);
      g.add(paw);
    }
    const mossPatch = new THREE.Mesh(ico(0.16, 0), mat(0x7a8f5e));
    mossPatch.scale.set(1.3, 0.5, 1.1);
    mossPatch.position.set(-0.18, 1.02, -0.28);
    g.add(mossPatch);
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
  } else if (kind === 'sheep') {
    // the plain folk wear wool. the wool is their own. it explains itself.
    const woolMat = mat(colors.wool ?? 0xf1ead9);
    parts.body.material = woolMat;
    parts.body.scale.set(1.14, 1.02, 1.32);
    const crown = new THREE.Mesh(ico(0.3), woolMat); // fleece cap, sat square
    crown.scale.set(1.2, 0.6, 1.05);
    crown.position.set(0, 1.5, 0.24);
    g.add(crown);
    const earGeoS = new THREE.CapsuleGeometry(0.075, 0.26, 4, 6);
    for (const sx of [-1, 1]) {
      const ear = new THREE.Mesh(earGeoS, headMat);
      ear.position.set(sx * 0.4, 1.24, 0.3);
      ear.rotation.z = sx * 1.35; // ears droop, agreeably
      g.add(ear);
    }
    const tailS = new THREE.Mesh(ico(0.12), woolMat);
    tailS.position.set(0, 0.74, -0.7);
    g.add(tailS);
    for (const leg of parts.legs) leg.material = headMat; // neat dark stockings
  } else if (kind === 'pelican') {
    // a bill like a shopping bag. inventory management, solved biologically.
    parts.body.scale.set(1.15, 1.05, 1.3);
    const billTop = new THREE.Mesh(new THREE.ConeGeometry(0.13, 0.85, 5), mat(0xe8a25c));
    billTop.rotation.x = Math.PI / 2;
    billTop.scale.set(1.4, 1, 0.5);
    billTop.position.set(0, 1.2, 1.05);
    g.add(billTop);
    const pouch = new THREE.Mesh(ico(0.2, 0), mat(0xf2c894));
    pouch.scale.set(0.8, 0.9, 1.6);
    pouch.position.set(0, 1.0, 0.78);
    g.add(pouch);
    const crest = new THREE.Mesh(ico(0.12, 0), headMat);
    crest.scale.set(0.8, 0.6, 1.4);
    crest.position.set(0, 1.56, 0.1);
    g.add(crest);
    const tailP = new THREE.Mesh(new THREE.ConeGeometry(0.16, 0.34, 5), bodyMat);
    tailP.rotation.x = -2.3;
    tailP.position.set(0, 0.78, -0.72);
    g.add(tailP);
    g.scale.setScalar(1.08);
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
  } else if (kind === 'frog') {
    // a frog is mostly a head with opinions: squat and round, eyes up top
    // like two periscopes, a wide calm smile, feet that mean business.
    // colors: body, belly, feet, spots (all optional)
    parts.bodyY = 0.42;
    body.position.y = parts.bodyY;
    body.scale.set(1.3, 0.78, 1.15);
    parts.headY = 0.8;
    head.scale.set(1.2, 0.78, 1.0);
    head.position.set(0, parts.headY, 0.22);
    const white = mat(0xfaf7ee);
    for (const [i, sx] of [[0, -1], [1, 1]]) {
      const bulb = new THREE.Mesh(ico(0.16, 1), white);
      bulb.position.set(sx * 0.26, 1.08, 0.36);
      g.add(bulb);
      parts.eyes[i].position.set(sx * 0.27, 1.1, 0.51);
      parts.eyes[i].scale.setScalar(1.25);
    }
    const smile = new THREE.Mesh(new THREE.BoxGeometry(0.52, 0.035, 0.05), mat(0x2e3a2a));
    smile.position.set(0, 0.76, 0.63);
    g.add(smile);
    const belly = new THREE.Mesh(ico(0.34), mat(colors.belly ?? 0xf1ecc4));
    belly.scale.set(1.05, 0.7, 0.55);
    belly.position.set(0, 0.36, 0.42);
    g.add(belly);
    if (colors.spots) {
      for (const [x, y, z] of [[-0.22, 0.72, -0.2], [0.26, 0.66, -0.05], [0.02, 0.78, -0.38], [-0.38, 0.5, 0.05]]) {
        const spot = new THREE.Mesh(ico(0.07, 0), mat(colors.spots));
        spot.position.set(x, y, z);
        g.add(spot);
      }
    }
    // four legs, still — front ones straight, back ones folded like springs
    for (const leg of parts.legs) g.remove(leg);
    parts.legs.length = 0;
    const footMat = mat(colors.feet ?? colors.body ?? 0x6ab04a);
    const frontGeo = new THREE.CylinderGeometry(0.07, 0.06, 0.3, 5);
    frontGeo.translate(0, -0.15, 0);
    for (const sx of [-1, 1]) {
      const leg = new THREE.Mesh(frontGeo, bodyMat);
      leg.position.set(sx * 0.3, 0.32, 0.36);
      const foot = new THREE.Mesh(ico(0.09, 0), footMat);
      foot.scale.set(1.3, 0.4, 1.3);
      foot.position.set(0, -0.3, 0.05);
      leg.add(foot);
      g.add(leg);
      parts.legs.push(leg);
      const thigh = new THREE.Mesh(ico(0.24, 0), bodyMat);
      thigh.scale.set(0.75, 0.62, 1.25);
      thigh.position.set(sx * 0.46, 0.26, -0.18);
      g.add(thigh);
      const backGeo = new THREE.CylinderGeometry(0.06, 0.05, 0.12, 5);
      backGeo.translate(0, -0.06, 0);
      const back = new THREE.Mesh(backGeo, bodyMat);
      back.position.set(sx * 0.5, 0.12, 0.02);
      const bfoot = new THREE.Mesh(ico(0.11, 0), footMat);
      bfoot.scale.set(1.3, 0.35, 1.6);
      bfoot.position.set(0, -0.08, 0.08);
      back.add(bfoot);
      g.add(back);
      parts.legs.push(back);
    }
  } else if (kind === 'dolphin') {
    // a dolphin with legs. four of them. in sneakers. nobody asks.
    body.scale.set(0.95, 0.9, 1.55);
    head.scale.set(0.95, 0.9, 1.05);
    head.position.set(0, 1.12, 0.55);
    parts.eyes.forEach((e, i) => e.position.set((i ? 1 : -1) * 0.22, 1.2, 0.86));
    const beak = new THREE.Mesh(new THREE.CylinderGeometry(0.1, 0.16, 0.42, 7), headMat);
    beak.rotation.x = Math.PI / 2;
    beak.position.set(0, 1.02, 1.02);
    g.add(beak);
    const smile = new THREE.Mesh(new THREE.BoxGeometry(0.2, 0.025, 0.25), mat(0x3a4a5c));
    smile.position.set(0, 0.95, 0.98);
    g.add(smile);
    const belly = new THREE.Mesh(ico(0.38), mat(colors.belly ?? 0xdde8ee));
    belly.scale.set(0.9, 0.6, 1.3);
    belly.position.set(0, 0.48, 0.1);
    g.add(belly);
    const dorsal = new THREE.Mesh(new THREE.ConeGeometry(0.16, 0.45, 4), bodyMat);
    dorsal.scale.z = 0.35;
    dorsal.rotation.x = -0.35;
    dorsal.position.set(0, 1.18, -0.2);
    g.add(dorsal);
    for (const sx of [-1, 1]) {
      const fluke = new THREE.Mesh(new THREE.ConeGeometry(0.16, 0.5, 4), bodyMat);
      fluke.scale.set(1, 1, 0.3);
      fluke.rotation.set(0, 0, sx * Math.PI / 2);
      fluke.position.set(sx * 0.24, 0.72, -0.82);
      g.add(fluke);
    }
    for (const leg of parts.legs) {
      const shoe = new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.08, 0.24), mat(0xfaf7ee));
      shoe.position.set(0, -0.38, 0.04);
      leg.add(shoe);
    }
  } else if (kind === 'whale') {
    // a blue whale. the largest animal that has ever lived. exactly this big.
    body.scale.set(1.2, 1.0, 1.7);
    head.scale.set(1.25, 0.95, 1.2);
    head.position.set(0, 1.0, 0.55);
    parts.eyes.forEach((e, i) => e.position.set((i ? 1 : -1) * 0.34, 0.98, 0.9));
    const chin = new THREE.Mesh(ico(0.4), mat(colors.belly ?? 0xc9d8e2));
    chin.scale.set(1.2, 0.5, 1.2);
    chin.position.set(0, 0.62, 0.55);
    g.add(chin);
    for (let i = 0; i < 4; i++) { // throat grooves, chunky
      const groove = new THREE.Mesh(new THREE.BoxGeometry(0.6 - i * 0.06, 0.03, 0.03), mat(0x6f8fa8));
      groove.position.set(0, 0.5 + i * 0.07, 0.95 - i * 0.03);
      g.add(groove);
    }
    const blow = new THREE.Mesh(ico(0.07, 0), mat(0x2e3e50));
    blow.position.set(0, 1.4, 0.45);
    g.add(blow);
    for (const sx of [-1, 1]) {
      const fluke = new THREE.Mesh(new THREE.ConeGeometry(0.2, 0.62, 4), bodyMat);
      fluke.scale.set(1, 1, 0.3);
      fluke.rotation.set(0, 0, sx * Math.PI / 2);
      fluke.position.set(sx * 0.3, 0.75, -1.02);
      g.add(fluke);
    }
  } else if (kind === 'fishfolk') {
    // a round fish on two... four... on legs. out for a jog.
    body.scale.set(1.05, 1.05, 1.0);
    head.visible = false;
    parts.eyes.forEach((e, i) => { e.position.set((i ? 1 : -1) * 0.34, 0.86, 0.36); e.scale.setScalar(1.7); });
    const lips = new THREE.Mesh(new THREE.TorusGeometry(0.09, 0.04, 5, 8), mat(colors.lips ?? 0xff8a8a));
    lips.position.set(0, 0.62, 0.6);
    g.add(lips);
    const tailF = new THREE.Mesh(new THREE.ConeGeometry(0.34, 0.5, 4), mat(colors.fin ?? 0xffd23e));
    tailF.scale.set(0.25, 1, 1);
    tailF.rotation.x = -Math.PI / 2;
    tailF.position.set(0, 0.64, -0.68);
    g.add(tailF);
    const topFin = new THREE.Mesh(new THREE.ConeGeometry(0.2, 0.35, 4), mat(colors.fin ?? 0xffd23e));
    topFin.scale.z = 0.3;
    topFin.position.set(0, 1.18, -0.05);
    g.add(topFin);
    for (const sx of [-1, 1]) {
      const side = new THREE.Mesh(new THREE.ConeGeometry(0.12, 0.3, 4), mat(colors.fin ?? 0xffd23e));
      side.scale.z = 0.3;
      side.rotation.z = sx * 1.9;
      side.position.set(sx * 0.52, 0.6, 0.05);
      g.add(side);
    }
    for (let i = 0; i < 3; i++) { // stripes, like a candy
      const stripe = new THREE.Mesh(new THREE.TorusGeometry(0.46 - i * 0.02, 0.035, 4, 12), mat(colors.stripe ?? 0xfff6e8));
      stripe.rotation.y = Math.PI / 2;
      stripe.position.set(0, 0.64, -0.2 + i * 0.22);
      stripe.scale.set(1, 1.05, 1);
      g.add(stripe);
    }
  } else if (kind === 'octopus') {
    // mostly head, eight arms, all opinions
    for (const leg of parts.legs) g.remove(leg);
    parts.legs.length = 0;
    body.visible = false;
    head.scale.set(1.35, 1.5, 1.35);
    head.position.set(0, 1.05, 0);
    parts.eyes.forEach((e, i) => { e.position.set((i ? 1 : -1) * 0.22, 0.98, 0.52); e.scale.setScalar(1.5); });
    const armGeo = new THREE.CylinderGeometry(0.1, 0.04, 0.8, 5);
    armGeo.translate(0, -0.4, 0);
    for (let k = 0; k < 8; k++) {
      const a = (k / 8) * Math.PI * 2;
      const arm = new THREE.Mesh(armGeo, headMat);
      arm.position.set(Math.sin(a) * 0.32, 0.55, Math.cos(a) * 0.32);
      arm.rotation.set(Math.cos(a) * 0.9, 0, -Math.sin(a) * 0.9);
      g.add(arm);
      if (k < 4) parts.legs.push(arm); // the gait wiggles four of them. the other four have tenure.
    }
  } else if (kind === 'crab') {
    // low and wide, eyes on stalks, walks sideways on principle
    body.scale.set(1.4, 0.55, 0.95);
    body.position.y = parts.bodyY = 0.42;
    head.visible = false;
    for (const [i, sx] of [[0, -1], [1, 1]]) {
      const stalk = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.03, 0.3, 4), bodyMat);
      stalk.position.set(sx * 0.18, 0.75, 0.32);
      g.add(stalk);
      parts.eyes[i].position.set(sx * 0.18, 0.92, 0.34);
      parts.eyes[i].scale.setScalar(1.3);
      const claw = new THREE.Mesh(ico(0.16, 0), bodyMat);
      claw.scale.set(1, 0.7, 1.3);
      claw.position.set(sx * 0.62, 0.5, 0.42);
      g.add(claw);
    }
    parts.legs.forEach((leg, i) => { leg.position.x *= 2.2; leg.position.y = 0.36; leg.rotation.z = (i % 2 ? -1 : 1) * 0.5; });
    parts.headY = 0.42;
  } else if (kind === 'otter') {
    body.scale.set(0.9, 0.85, 1.45);
    head.position.set(0, 1.08, 0.5);
    parts.eyes.forEach((e, i) => e.position.set((i ? 1 : -1) * 0.16, 1.16, 0.86));
    const muzzle = new THREE.Mesh(ico(0.18), mat(colors.muzzle ?? 0xe8d8c0));
    muzzle.scale.set(1.2, 0.8, 0.8);
    muzzle.position.set(0, 1.0, 0.84);
    g.add(muzzle);
    const nose = new THREE.Mesh(ico(0.05, 0), NOSE_MAT);
    nose.position.set(0, 1.06, 0.98);
    g.add(nose);
    for (const sx of [-1, 1]) {
      const ear = new THREE.Mesh(ico(0.07, 0), headMat);
      ear.position.set(sx * 0.3, 1.38, 0.42);
      g.add(ear);
    }
    const tail = new THREE.Mesh(new THREE.CapsuleGeometry(0.1, 0.7, 4, 6), bodyMat);
    tail.rotation.x = Math.PI / 2 - 0.2;
    tail.position.set(0, 0.55, -0.95);
    g.add(tail);
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
  BUILT.push(g);
  return g;
}

// Everybody breathes and blinks — shopkeepers behind counters, campers in
// their chairs, you. A soft rise and fall of the body, a blink every few
// seconds, and now and then a little glance to one side. Nothing here
// touches what the walk cycle drives (leg swing, bob heights), so it layers
// quietly on top of any other animation.
const BUILT = [];
export function idleAll(t) {
  for (const g of BUILT) {
    if (!g.parent) continue;
    const p = g.userData.parts;
    if (!p.idle) {
      p.idle = {
        seed: Math.random() * 100,
        bodySY: p.body.scale.y,
        headX: p.head.position.x,
        eyeSY: p.eyes.map((e) => e.scale.y),
        eyeX: p.eyes.map((e) => e.position.x),
      };
    }
    const d = p.idle, u = t + d.seed;
    p.body.scale.y = d.bodySY * (1 + Math.sin(u * 1.7) * 0.025);
    if (p.wings) {
      // a slow open-and-settle, and now and then a quick flutter
      const fl = (u % 9) < 0.8 ? Math.sin(u * 22) * 0.25 : 0;
      p.wings.forEach((w, i) => { w.rotation.y = w.userData.baseY + (i ? -1 : 1) * (Math.sin(u * 0.9) * 0.1 + fl); });
    }
    // a blink: ~0.15s shut every 3-5 seconds
    const shut = (u % (3.3 + (d.seed % 1.7))) < 0.14;
    // a glance: drift a touch to one side and back, every ten seconds or so
    const gl = Math.max(0, Math.sin(u * 0.55)) ** 6 * Math.sign(Math.sin(u * 0.13 + 1)) * 0.05;
    p.head.position.x = d.headX + gl;
    p.eyes.forEach((e, i) => {
      e.scale.y = d.eyeSY[i] * (shut ? 0.12 : 1);
      e.position.x = d.eyeX[i] + gl;
    });
    // anyone who's been standing in one spot a while — a shopkeeper at the
    // counter, a camper by the fire, a heron at the door — shifts about:
    // looks this way and that, rocks their weight, shuffles a foot. (It stops
    // the moment they walk: whatever moves them owns them then.)
    const dt = d.lastT === undefined ? 0 : Math.min(0.1, Math.max(0, t - d.lastT));
    d.lastT = t;
    const moved = d.px === undefined || Math.abs(g.position.x - d.px) + Math.abs(g.position.z - d.pz) > 0.002;
    d.px = g.position.x;
    d.pz = g.position.z;
    d.still = moved ? 0 : (d.still || 0) + dt;
    const fidget = !g.userData.noFidget && (g.userData.fidget || d.still > 3);
    const k = fidget ? Math.min(1, (d.still > 3 ? d.still - 3 : 1)) : 0;
    const turn = k * (Math.sin(u * 0.35) * 0.22 + Math.sin(u * 0.9) * 0.06);
    g.rotation.y += turn - (d.turn || 0);
    d.turn = turn;
    p.body.rotation.z = k * Math.sin(u * 0.8) * 0.05;
    if (fidget && p.legs.length) {
      // a foot shuffle now and then
      const sh = u % 7;
      const lift = sh < 0.4 ? Math.sin((sh / 0.4) * Math.PI) * 0.35 : 0;
      p.legs[0].rotation.x = lift;
    }
    if (g.userData.fidget) {
      // the ones who man a post all day get an occasional bounce, too
      const ph = u % 11;
      const hop = ph < 0.5 ? Math.sin((ph / 0.5) * Math.PI) * 0.1 : 0;
      g.position.y += hop - (d.hop || 0);
      d.hop = hop;
    }
  }
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
  { kind: 'salamander', body: 0xe8743a, range: 'volcano' }, // Ember — the volcano's own, by her fire
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
  if (spec.range === 'volcano') return { x: VOLCANO_SHELF.x + 1, z: VOLCANO_SHELF.z + 1, R: VOLCANO_SHELF.r };
  if (spec.range === 'cave') return { x: SITES.cave.x, z: SITES.cave.z, R: 11 };
  if (spec.range === 'grove') return { x: ISLAND5.x, z: ISLAND5.z + 10, R: ISLAND5.r + 12 };
  // Crumb claims every shore, but a sailor of naps stays near his bunk —
  // he keeps to the North Isle, within sight of the MouseBoat
  if (spec.range === 'everywhere') return { x: ISLAND3.x, z: ISLAND3.z, R: ISLAND3.r + 1 };
  return { x: 0, z: 0, R: ISLAND_RADIUS };
}

export function createAnimals() {
  const group = new THREE.Group();
  const animals = [];

  for (const spec of ROSTER) {
    const g = buildAnimal(spec.kind, { body: spec.body, head: spec.head });
    // ducks float; crocodiles cruise low with just the eyes showing
    const swims = spec.kind === 'duck' || spec.kind === 'croc';

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
      long: spec.kind === 'croc', // mostly snout: a second collision circle up front
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

  // may a walks-er step to (nx,nz)? the island's rules (or, for swimmers,
  // just the solid things), and nobody walks THROUGH the player or each
  // other — they stop, or the goal-walker's sidesteps find a way around
  function free(a, nx, nz, playerPos) {
    // (a body, not a point — unless they're already wedged somewhere, in
    // which case any legal step out is fine)
    const gp0 = a.g.position;
    if (a.swims ? solidAt(nx, nz) : !(islandCanStand(nx, nz, 0.28) ||
      (islandCanWalk(nx, nz) && !islandCanStand(gp0.x, gp0.z, 0.28)))) return false;
    const gp = a.g.position;
    const pd = Math.hypot(nx - playerPos.x, nz - playerPos.z);
    if (pd < 0.95 && pd < Math.hypot(gp.x - playerPos.x, gp.z - playerPos.z)) return false;
    for (const o of animals) {
      // (friends mid-meetup count as "away" for chores, but they're very
      // much standing there — nobody walks through them)
      if (o === a || (o.away && !o.meeting) || o.riding || !o.g.visible) continue;
      const op = o.g.position;
      const d = Math.hypot(nx - op.x, nz - op.z);
      if (d < 1.1 && d < Math.hypot(gp.x - op.x, gp.z - op.z)) return false;
    }
    return true;
  }

  function planRoute(a) {
    const gl = a.goal;
    const from = islandOf(a.g.position.x, a.g.position.z), to = islandOf(gl.x, gl.z);
    gl.via = [];
    if (!from || !to || from === to) return;
    const route = findRoute(from, to);
    if (!route) { // no way there from here: say so, don't pace the shore
      a.goal = null;
      a.state = 'idle';
      a.timer = rand(1, 3);
      gl.fail?.(a);
      return;
    }
    for (const hop of route) {
      if (hop.link.kind === 'rail') { gl.via.push({ rail: hop.link, from: hop.from }); break; }
      const path = hop.link.a === hop.from ? hop.link.path : [...hop.link.path].reverse();
      gl.via.push(...path.map((p) => ({ x: p.x, z: p.z })));
    }
  }

  function update(dt, t, playerPos) {
    for (const a of animals) {
      if (a.away) continue; // home for the evening — houses.js hosts them now
      const g = a.g;
      const dxp = playerPos.x - g.position.x;
      const dzp = playerPos.z - g.position.z;
      const distP = Math.hypot(dxp, dzp);
      let walking = false;

      // a.goal: walk SOMEWHERE SPECIFIC — a station, a friend, one day a mail
      // route — then call goal.done(). Goal-walkers skip the greeting stop
      // (they have somewhere to be; they'd nod if we'd modeled nodding).
      // Set { x, z, r?, done?, fail? } on any animal; movement respects the
      // same rules as wandering, with a few sidestep angles for shrubbery.
      if (a.busy) {
        // fishing, bug-hunting: feet planted, attention elsewhere — but a
        // passing visitor still gets a glance
        if (distP < 3.4) g.rotation.y = turnToward(g.rotation.y, Math.atan2(dxp, dzp), dt, 3);
      } else if (a.goal) {
        // another island? plan the way there once: over bridges on foot,
        // or to a station for the train. unreachable goals give up at once
        // instead of pacing a shoreline forever (the Ember bug).
        if (a.goal.via === undefined) planRoute(a);
        const gl0 = a.goal;
        const head = gl0?.via?.[0];
        if (!gl0) {
          // (planRoute gave up; nothing to do this frame)
        } else if (head?.rail) {
          // at the rail hop: queue for the train; this goal resumes after
          const resume = gl0;
          resume.via.shift();
          resume.via = undefined; // re-plan from wherever the train leaves us
          a.goal = null;
          if (head.rail.board(a, head.from)) {
            a.resume = resume;
          } else {
            a.goal = resume; // queue full — try again shortly
            a.state = 'idle';
            a.timer = rand(2, 4);
          }
        } else {
          const tgt = head || gl0;
          const dx = tgt.x - g.position.x;
          const dz = tgt.z - g.position.z;
          const dist = Math.hypot(dx, dz);
          if (head && dist < 1.4) {
            gl0.via.shift(); // waypoint reached; on to the next
            gl0.best = Infinity;
          } else if (!head && dist < (gl0.r ?? 1.2)) {
            const done = gl0.done;
            a.goal = null;
            a.state = 'idle';
            a.timer = rand(0.5, 1.5);
            done?.(a);
            // a trip interrupted by a train ride picks up where it left off
            // (not while standing in a train queue — after the ride)
            if (!a.goal && a.resume && !a.queued) { a.goal = a.resume; a.resume = null; }
          } else {
            const base = Math.atan2(dx, dz);
            let stepped = false;
            // skirt obstacles: once a way round is chosen, keep to that side
            // (so a wall is followed, not dithered at), and let go of it after
            // a couple of clear straight steps
            const sd = gl0.side || (Math.random() < 0.5 ? 1 : -1);
            for (const off of [0, 0.6 * sd, 1.2 * sd, 1.75 * sd, 2.3 * sd, -0.6 * sd, -1.2 * sd, -1.75 * sd]) {
              const ang = base + off;
              const nx = g.position.x + Math.sin(ang) * a.speed * dt;
              const nz = g.position.z + Math.cos(ang) * a.speed * dt;
              if (free(a, nx, nz, playerPos)) {
                g.rotation.y = turnToward(g.rotation.y, ang, dt, 6);
                g.position.x = nx;
                g.position.z = nz;
                stepped = true;
                if (off === 0) {
                  gl0.clear = (gl0.clear ?? 0) + dt;
                  if (gl0.clear > 1.2) gl0.side = 0;
                } else {
                  gl0.clear = 0;
                  gl0.side = Math.sign(off);
                }
                break;
              }
            }
            walking = stepped;
            // honest progress check: stepping back and forth along a wall
            // is not getting anywhere. no real progress for 12s → give up.
            if (dist < (gl0.best ?? Infinity) - 0.5) { gl0.best = dist; gl0.since = 0; }
            gl0.since = (gl0.since ?? 0) + dt;
            if (gl0.since > 12) {
              a.goal = null;
              a.resume = null;
              a.state = 'idle';
              a.timer = rand(1, 3);
              gl0.fail?.(a);
            }
          }
        }
      } else if (distP < 3.4) {
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
          // ducks may swim where walkers can't — but nobody walks through
          // a building: swimmers skip the water rule, not the blockers
          if (free(a, nx, nz, playerPos)) {
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
      const h = islandGroundHeight(g.position.x, g.position.z);
      if (a.swims && h < WATER_Y - 0.05) {
        g.position.y = WATER_Y - (a.long ? 0.5 : 0.24) + Math.sin(t * 2 + a.phase) * 0.05;
        a.walk += (0 - a.walk) * Math.min(1, dt * 8);
      } else {
        g.position.y = Math.max(h, WATER_Y - 0.3);
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

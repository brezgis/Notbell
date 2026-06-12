// The volcano. She made all three islands, long ago, and then she retired.
// She smokes sometimes, the way old engines tick as they cool. She has
// never hurt anyone and isn't going to start for you.

import * as THREE from 'three';
import { VOLCANO, SITES, terrainHeight } from './terrain.js';
import { register } from './interact.js';
import * as ui from './ui.js';
import * as S from './state.js';
import { buildAnimal } from './animals.js';
import { sip } from './audio.js';
import { rand, pick } from './utils.js';

function mat(color, rough = 0.9) {
  return new THREE.MeshStandardMaterial({ color, flatShading: true, roughness: rough });
}

export function createVolcano() {
  const group = new THREE.Group();
  const updates = [];
  const V = VOLCANO;
  const craterY = terrainHeight(V.x, V.z); // the sunken crater floor

  // the heart: a warm glow in the crater, breathing very slowly
  const glow = new THREE.Mesh(
    new THREE.CircleGeometry(2.6, 12),
    new THREE.MeshBasicMaterial({ color: 0xff7a3c, transparent: true, opacity: 0.85 })
  );
  glow.rotation.x = -Math.PI / 2;
  glow.position.set(V.x, craterY + 0.15, V.z);
  group.add(glow);
  const emberLight = new THREE.PointLight(0xff8a4c, 60, 24, 2);
  emberLight.position.set(V.x, craterY + 2, V.z);
  group.add(emberLight);
  // a few cooled boulders around the rim
  for (let i = 0; i < 7; i++) {
    const a = (i / 7) * Math.PI * 2 + 0.3;
    const rx = V.x + Math.cos(a) * rand(4.5, 6);
    const rz = V.z + Math.sin(a) * rand(4.5, 6);
    const rock = new THREE.Mesh(new THREE.IcosahedronGeometry(rand(0.5, 1.0), 0), mat(0x4a4440));
    rock.position.set(rx, terrainHeight(rx, rz) + 0.3, rz);
    rock.castShadow = true;
    group.add(rock);
  }

  // she smokes sometimes. it means she's comfortable.
  const puffs = [];
  for (let i = 0; i < 6; i++) {
    const puff = new THREE.Mesh(new THREE.IcosahedronGeometry(0.8, 0),
      new THREE.MeshStandardMaterial({
        color: 0xd8d2cc, transparent: true, opacity: 0, roughness: 1, flatShading: true,
      }));
    puff.visible = false;
    puffs.push(puff);
    group.add(puff);
  }
  let smokeTimer = rand(10, 25);
  let smoking = 0;
  updates.push((dt, t) => {
    glow.material.opacity = 0.7 + Math.sin(t * 0.5) * 0.18;
    emberLight.intensity = 55 + Math.sin(t * 0.5) * 14;
    smokeTimer -= dt;
    if (smokeTimer <= 0 && smoking <= 0) {
      smoking = rand(8, 16); // a comfortable little smoke
      smokeTimer = rand(25, 70);
      puffs.forEach((p, i) => { p.userData.k = -i * 0.18; p.visible = true; });
    }
    if (smoking > 0) {
      smoking -= dt;
      for (const p of puffs) {
        p.userData.k += dt * 0.22;
        const k = p.userData.k;
        if (k < 0) continue;
        const kk = k % 1;
        p.position.set(
          V.x + Math.sin(t * 0.6 + k * 9) * (1 + kk * 2),
          craterY + 2 + kk * 9,
          V.z + Math.cos(t * 0.5 + k * 7) * (1 + kk * 1.5)
        );
        p.scale.setScalar(0.8 + kk * 2.6);
        p.material.opacity = (smoking > 2 ? 0.5 : 0.5 * (smoking / 2)) * (1 - kk * 0.7);
      }
    } else {
      for (const p of puffs) p.visible = false;
    }
  });

  // ------------------------------------------------- Cinder the iguana ----
  const cinder = buildAnimal('salamander', { body: 0x7a8a6a, head: 0x7a8a6a });
  cinder.scale.setScalar(1.25);
  // iguana upgrades: a row of spikes and a skeptical brow
  for (let i = 0; i < 5; i++) {
    const spike = new THREE.Mesh(new THREE.ConeGeometry(0.07, 0.22, 4), mat(0x55613b, 0.7));
    spike.position.set(0, 0.62 - i * 0.04, 0.35 - i * 0.3);
    spike.rotation.x = -0.3;
    cinder.add(spike);
  }
  // her spot: a great flat basking rock on the black-sand shelf, in full sun
  const VB = SITES.vbeach;
  const baskX = VB.x - 2.5, baskZ = VB.z + 1;
  const baskY = terrainHeight(baskX, baskZ);
  const baskRock = new THREE.Mesh(new THREE.IcosahedronGeometry(1.5, 1), mat(0x5e5854, 0.95));
  baskRock.scale.set(1.3, 0.28, 1.0);
  baskRock.position.set(baskX, baskY + 0.25, baskZ);
  baskRock.castShadow = true;
  group.add(baskRock);
  cinder.position.set(baskX, baskY + 0.55, baskZ);
  cinder.rotation.y = Math.atan2(0 - baskX, 0 - baskZ); // faces the home islands, eyes half shut
  group.add(cinder);

  // a frond lean-to, in case the sun ever overdoes it (it hasn't yet)
  const leanTo = new THREE.Group();
  for (const sx of [-1, 1]) {
    const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.09, 0.11, 2.2, 6), mat(0x8a6f4d));
    pole.position.set(sx * 1.3, 1.1, 0);
    leanTo.add(pole);
  }
  const backPoleL = new THREE.Mesh(new THREE.CylinderGeometry(0.09, 0.11, 1.2, 6), mat(0x8a6f4d));
  backPoleL.position.set(-1.3, 0.6, -1.6);
  const backPoleR = backPoleL.clone();
  backPoleR.position.x = 1.3;
  leanTo.add(backPoleL, backPoleR);
  for (let i = 0; i < 5; i++) {
    const frond = new THREE.Mesh(new THREE.ConeGeometry(0.5, 2.6, 4), mat(0x55772f, 0.9));
    frond.scale.z = 0.18;
    frond.position.set(-1.2 + i * 0.6, 1.75, -0.8);
    frond.rotation.x = Math.PI / 2 + 0.5;
    leanTo.add(frond);
  }
  leanTo.position.set(VB.x + 3, terrainHeight(VB.x + 3, VB.z - 1), VB.z - 1);
  leanTo.rotation.y = 0.4;
  leanTo.traverse((o) => { if (o.isMesh) o.castShadow = true; });
  group.add(leanTo);

  // ------------------------------------------------------ the tiki bar ----
  const bar = new THREE.Group();
  const counter = new THREE.Mesh(new THREE.BoxGeometry(2.8, 1.0, 0.8), mat(0xa97c50));
  counter.position.y = 0.5;
  bar.add(counter);
  const thatchPoles = [-1.2, 1.2].map((sx) => {
    const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.1, 2.4, 6), mat(0x8a6f4d));
    pole.position.set(sx, 1.2, 0);
    bar.add(pole);
    return pole;
  });
  void thatchPoles;
  const thatch = new THREE.Mesh(new THREE.ConeGeometry(2.2, 1.0, 7), mat(0xc9a972, 0.95));
  thatch.position.y = 2.8;
  bar.add(thatch);
  for (const sx of [-1.7, 1.7]) {
    const torch = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.08, 1.4, 5), mat(0x6b4a2e));
    torch.position.set(sx, 0.7, 0.9);
    bar.add(torch);
    const flame = new THREE.Mesh(new THREE.IcosahedronGeometry(0.12, 0),
      new THREE.MeshBasicMaterial({ color: 0xffb347 }));
    flame.position.set(sx, 1.5, 0.9);
    flame.userData.flicker = true;
    bar.add(flame);
    updates.push((dt, t) => {
      flame.scale.setScalar(0.85 + Math.sin(t * 9 + sx) * 0.2);
    });
  }
  for (let i = 0; i < 2; i++) {
    const coconut = new THREE.Mesh(new THREE.IcosahedronGeometry(0.14, 0), mat(0x6b4a2e, 0.7));
    coconut.position.set(-0.5 + i, 1.12, 0.1);
    bar.add(coconut);
    const umbrella = new THREE.Mesh(new THREE.ConeGeometry(0.12, 0.1, 6), mat(pick([0xff6b81, 0xffd23e]), 0.6));
    umbrella.position.set(-0.5 + i + 0.06, 1.3, 0.1);
    bar.add(umbrella);
  }
  const barSign = new THREE.Mesh(new THREE.BoxGeometry(1.6, 0.5, 0.08), mat(0xe8d49a, 0.7));
  barSign.position.set(0, 1.9, 0.6);
  bar.add(barSign);
  bar.position.set(VB.x + 0.5, terrainHeight(VB.x + 0.5, VB.z + 3.5), VB.z + 3.5);
  bar.rotation.y = Math.PI; // counter faces the sea
  bar.traverse((o) => { if (o.isMesh && !o.userData.flicker) o.castShadow = true; });
  group.add(bar);

  register({
    pos: new THREE.Vector3(VB.x + 0.5, 0, VB.z + 4.6), r: 2.4,
    label: 'visit the honor bar',
    use: async () => {
      const choice = await ui.ask(
        'A driftwood sign: “LAVA-VIEW BAR. NO STAFF. COCO FIZZ 15ᵇ. THE JAR TRUSTS YOU.”', [
          { label: '🥥 Coco Fizz', value: 'fizz', hint: '15🔘', disabled: S.state.buttons < 15 },
          { label: 'Just admire the jar', value: 'jar' },
          { label: 'Leave', value: null },
        ]);
      if (choice === 'fizz') {
        S.spend(15);
        S.drinkCoffee(20);
        sip();
        ui.updateHUD();
        ui.toast('Cold, fizzy, faintly of summer. The jar clinks its thanks.', '🥥');
      } else if (choice === 'jar') {
        ui.say('A pickle jar half full of buttons. Someone has left an IOU written on a leaf. Someone else has paid the IOU. The system works.');
      }
    },
  });
  updates.push((dt, t) => {
    const parts = cinder.userData.parts;
    parts.body.position.y = parts.bodyY + Math.sin(t * 1.1) * 0.02;
  });

  const CINDER_LINES = [
    'Sssalutations. Cinder. Resident. Volcanologist. Mostly the “resident” part.',
    'She made all three islands, you know. Pushed them up one by one, then retired. We respect a finished body of work here.',
    'People ask, “Cinder, is it safe?” Friend. She raised three islands from the sea floor. You think she has TIME for you?',
    'The smoke means she’s comfortable. Like a cat purring, if the cat were a mountain.',
    'Warmest rocks in the archipelago. I have a rotation. I’m on rock four. It’s a good rock.',
  ];
  let cinderIdx = 0;
  register({
    getPos: () => cinder.position,
    r: 3,
    label: 'talk to Cinder',
    use: () => {
      if (!S.hasFlag('metCinder')) {
        S.setFlag('metCinder');
        ui.say([
          'An iguana the color of cooled lava opens one eye. She was flat against the rock in a way that suggests centuries of practice.',
          '“Visitors! By BOAT and everything. Welcome to the mountain. Wipe your feet. That’s a joke. Everything here is ash.”',
        ], { speaker: 'Cinder', voice: 460 });
        return;
      }
      ui.say(CINDER_LINES[cinderIdx++ % CINDER_LINES.length], { speaker: 'Cinder', voice: 460 });
    },
  });

  // the rim plaque — the Listeners get everywhere
  register({
    pos: new THREE.Vector3(V.x - 5, 0, V.z + 3), r: 2.6,
    label: 'read the rim marker',
    use: () => ui.say([
      'A squat stone, fire-glazed, carved deep:',
      '“SHE MADE THE ISLANDS. SHE MADE THE CLIFF THE LIGHTHOUSE STOOD ON. SHE MADE THE CAVE WHERE THE LIGHT NOW SLEEPS. BE POLITE.” —the Listeners',
    ]),
  });

  function update(dt, t) {
    for (const u of updates) u(dt, t);
  }

  return { group, update };
}

// The village: Pip's Odds & Ends (shop), The Lantern Room (café), and the
// Notbell Museum — exteriors on the plaza, dollhouse interiors far away
// (you teleport through doors behind a fade, see zones.js).

import * as THREE from 'three';
import { SITES, terrainHeight } from './terrain.js';
import * as zones from './zones.js';
import { register } from './interact.js';
import * as ui from './ui.js';
import * as S from './state.js';
import { ITEMS, COFFEE_PRICE, COFFEE_BOOST_SECS, FERN_LORE, GROWTH, SHOP_HATS, SONGS } from './catalog.js';
import { kaching, sip, jingle, requestSong } from './audio.js';
import { buildAnimal } from './animals.js';
import { rand, turnToward } from './utils.js';
import { HOLIDAY } from './calendar.js';
import { hangCafeArt, artPiece, makeFramed } from './art.js';

function mat(color, rough = 0.9) {
  return new THREE.MeshStandardMaterial({ color, flatShading: true, roughness: rough });
}

function box(w, h, d, color) {
  const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat(color));
  m.castShadow = true;
  return m;
}

const VOICE = { pip: 760, luna: 470, fern: 300 };

// ------------------------------------------------------------ exteriors ----

function makeDoor(color = 0x6b4a2e) {
  const g = new THREE.Group();
  const frame = box(1.5, 2.3, 0.18, 0xd9c08f);
  frame.position.y = 1.15;
  const door = box(1.15, 2.0, 0.2, color);
  door.position.set(0, 1.0, 0.04);
  const knob = new THREE.Mesh(new THREE.IcosahedronGeometry(0.07, 0), mat(0xf2cf5b, 0.4));
  knob.position.set(0.36, 1.0, 0.18);
  g.add(frame, door, knob);
  return g;
}

function makeWindow(r = 0.45) {
  const g = new THREE.Group();
  const rim = new THREE.Mesh(new THREE.CylinderGeometry(r + 0.1, r + 0.1, 0.14, 8), mat(0xfff6e0));
  rim.rotation.x = Math.PI / 2;
  const glass = new THREE.Mesh(new THREE.CylinderGeometry(r, r, 0.16, 8), mat(0xbfe6f2, 0.3));
  glass.rotation.x = Math.PI / 2;
  g.add(rim, glass);
  return g;
}

function makeShopExterior() {
  const g = new THREE.Group();
  const walls = box(7, 3.4, 6, 0xe8b84b);
  walls.position.y = 1.7;
  g.add(walls);
  const roof = new THREE.Mesh(new THREE.ConeGeometry(5.6, 2.6, 4), mat(0x4f8f6a));
  roof.position.y = 4.6;
  roof.rotation.y = Math.PI / 4;
  roof.castShadow = true;
  g.add(roof);
  const door = makeDoor(0x7a4a26);
  door.position.z = 3.01;
  g.add(door);
  // striped awning over the door
  for (let i = 0; i < 5; i++) {
    const slat = box(0.56, 0.08, 1.3, i % 2 ? 0xfff3da : 0xe8743a);
    slat.position.set(-1.4 + i * 0.58 + 0.06, 2.6, 3.55);
    slat.rotation.x = 0.5;
    g.add(slat);
  }
  for (const sx of [-1, 1]) {
    const w = makeWindow();
    w.position.set(sx * 2.1, 2.0, 3.0);
    g.add(w);
  }
  // a big button for a sign, naturally
  const sign = new THREE.Mesh(new THREE.CylinderGeometry(0.55, 0.55, 0.16, 10), mat(0xf2cf5b, 0.35));
  sign.rotation.x = Math.PI / 2;
  sign.position.set(0, 3.9, 3.1);
  g.add(sign);
  return g;
}

function makeCafeExterior() {
  const g = new THREE.Group();
  const walls = box(6.4, 3.2, 5.6, 0xf3e6cf);
  walls.position.y = 1.6;
  g.add(walls);
  const roof = new THREE.Mesh(new THREE.ConeGeometry(5.2, 2.4, 4), mat(0xc97b63));
  roof.position.y = 4.3;
  roof.rotation.y = Math.PI / 4;
  roof.castShadow = true;
  g.add(roof);
  const door = makeDoor(0x8a5a3a);
  door.position.z = 2.81;
  g.add(door);
  const w = makeWindow(0.55);
  w.position.set(-1.9, 2.0, 2.8);
  g.add(w);
  // the lantern by the door — warm, always on, very loved
  const post = box(0.12, 2.2, 0.12, 0x55483a);
  post.position.set(2.4, 1.1, 3.3);
  g.add(post);
  const glow = new THREE.Mesh(
    new THREE.IcosahedronGeometry(0.26, 0),
    new THREE.MeshBasicMaterial({ color: 0xffd98f })
  );
  glow.position.set(2.4, 2.3, 3.3);
  g.add(glow);
  // chimney + drifting smoke
  const chimney = box(0.6, 1.2, 0.6, 0xb09a7e);
  chimney.position.set(1.7, 4.6, -1.2);
  g.add(chimney);
  const puffs = [];
  const puffMat = new THREE.MeshStandardMaterial({
    color: 0xffffff, transparent: true, opacity: 0.75, flatShading: true, roughness: 1,
  });
  for (let i = 0; i < 3; i++) {
    const p = new THREE.Mesh(new THREE.IcosahedronGeometry(0.28, 0), puffMat);
    p.position.set(1.7, 5.2, -1.2);
    p.userData.t = i / 3;
    puffs.push(p);
    g.add(p);
  }
  g.userData.puffs = puffs;
  return g;
}

function makeMuseumExterior() {
  const g = new THREE.Group();
  const walls = box(9, 3.6, 6.5, 0xcfd6cf);
  walls.position.y = 1.8;
  g.add(walls);
  // prism roof — thetaStart phases one vertex to +X, so rotateZ lands it
  // straight up: a true ridge, at last
  const roofGeo = new THREE.CylinderGeometry(2.4, 2.4, 9.6, 3, 1, false, Math.PI / 2);
  roofGeo.rotateZ(Math.PI / 2);
  const roof = new THREE.Mesh(roofGeo, mat(0x7c8894));
  roof.scale.y = 0.7;
  roof.position.y = 4.15;
  roof.castShadow = true;
  g.add(roof);
  for (const sx of [-2.9, -1, 1, 2.9]) {
    const col = new THREE.Mesh(new THREE.CylinderGeometry(0.22, 0.26, 3.4, 7), mat(0xece9dd));
    col.position.set(sx, 1.7, 3.5);
    col.castShadow = true;
    g.add(col);
  }
  const porch = box(8.6, 0.3, 1.8, 0xb9c0b9);
  porch.position.set(0, 0.15, 3.4);
  g.add(porch);
  const door = makeDoor(0x4a3a5a);
  door.position.z = 3.26;
  door.scale.setScalar(1.1);
  g.add(door);
  return g;
}

// ------------------------------------------------------------- interiors ----

function buildRoom(base, w, d, floorColor, wallColor) {
  const g = new THREE.Group();
  const floor = new THREE.Mesh(new THREE.BoxGeometry(w, 0.4, d), mat(floorColor));
  floor.position.set(base.x, -0.2, base.z);
  floor.receiveShadow = true;
  floor.castShadow = true;
  g.add(floor);
  const wallH = 4.6;
  const back = new THREE.Mesh(new THREE.BoxGeometry(w, wallH, 0.4), mat(wallColor));
  back.position.set(base.x, wallH / 2, base.z - d / 2);
  g.add(back);
  for (const sx of [-1, 1]) {
    const side = new THREE.Mesh(new THREE.BoxGeometry(0.4, wallH, d), mat(wallColor));
    side.position.set(base.x + sx * w / 2, wallH / 2, base.z);
    g.add(side);
  }
  // skirting board, because cozy lives in the details
  const skirt = new THREE.Mesh(new THREE.BoxGeometry(w - 0.2, 0.5, 0.18), mat(0x8a6f4d));
  skirt.position.set(base.x, 0.25, base.z - d / 2 + 0.3);
  g.add(skirt);
  return g;
}

function warmLamp(x, y, z, color = 0xffd9a0, intensity = 40, dist = 16) {
  const light = new THREE.PointLight(color, intensity, dist, 2);
  light.position.set(x, y, z);
  return light;
}

function npcAt(kind, colors, x, z, rotY, baseY = 0) {
  const npc = buildAnimal(kind, colors);
  npc.position.set(x, baseY, z);
  npc.rotation.y = rotY;
  return npc;
}

// little decorated blobs for the shop shelves
function shelfClutter(x, y, z, parent) {
  const colors = [0xe06a6a, 0x6a9ae0, 0xe0c46a, 0x8fce7a, 0xc77dff];
  for (let i = 0; i < 4; i++) {
    const b = new THREE.Mesh(
      new THREE.IcosahedronGeometry(rand(0.12, 0.2), 0),
      mat(colors[(i + Math.floor(x + z)) % colors.length], 0.6)
    );
    b.position.set(x + i * 0.5 - 0.75, y, z);
    parent.add(b);
  }
}

// ------------------------------------------------------------ the works ----

export function createBuildings() {
  const group = new THREE.Group();
  const C = SITES.village;
  const updates = [];

  // plaza centerpiece: a little well with a button-shaped roof finial
  const well = new THREE.Group();
  const wellBase = new THREE.Mesh(new THREE.CylinderGeometry(0.9, 1.0, 0.9, 8), mat(0x9aa0a6));
  wellBase.position.y = 0.45;
  const wellWater = new THREE.Mesh(new THREE.CylinderGeometry(0.72, 0.72, 0.1, 8), mat(0x3fb0e8, 0.3));
  wellWater.position.y = 0.82;
  well.add(wellBase, wellWater);
  for (const sx of [-1, 1]) {
    const post = box(0.14, 1.3, 0.14, 0x7a5230);
    post.position.set(sx * 0.95, 1.4, 0);
    well.add(post);
  }
  const wellRoof = new THREE.Mesh(new THREE.ConeGeometry(1.5, 0.9, 4), mat(0xc97b63));
  wellRoof.position.y = 2.4;
  wellRoof.rotation.y = Math.PI / 4;
  well.add(wellRoof);
  well.position.set(C.x, terrainHeight(C.x, C.z), C.z);
  well.traverse((o) => { if (o.isMesh) o.castShadow = true; });
  group.add(well);
  zones.addBlocker(C.x, C.z, 1.7);
  register({
    pos: well.position, r: 2.2, label: 'peer into the well',
    use: () => ui.say([
      'You peer into the well. A coin— no, a button glints at the bottom.',
      'Someone down there is saving up.',
    ]),
  });

  // ----- holiday dressing for the plaza
  if (HOLIDAY) {
    // festive bunting between two poles by the well, whatever the occasion
    const buntingColors = [0xff6b81, 0xffd23e, 0x6a9ae0, 0x8fce7a];
    const wy = terrainHeight(C.x, C.z);
    for (const sx of [-1, 1]) {
      const pole = box(0.1, 2.6, 0.1, 0xa97c50);
      pole.position.set(C.x + sx * 4, wy + 1.3, C.z + 3);
      group.add(pole);
    }
    for (let i = 0; i < 7; i++) {
      const k = i / 6;
      const flag = new THREE.Mesh(new THREE.ConeGeometry(0.16, 0.34, 4), mat(buntingColors[i % 4], 0.7));
      flag.rotation.x = Math.PI; // point down
      flag.position.set(C.x - 4 + k * 8, wy + 2.5 - Math.sin(k * Math.PI) * 0.5, C.z + 3);
      group.add(flag);
    }
    if (HOLIDAY.id === 'spooky') {
      for (let i = 0; i < 3; i++) {
        const a = (i / 3) * Math.PI * 2 + 0.5;
        const px = C.x + Math.cos(a) * 3.2, pz = C.z + Math.sin(a) * 3.2;
        const pumpkin = new THREE.Mesh(new THREE.IcosahedronGeometry(0.45, 1), mat(0xe8743a, 0.6));
        pumpkin.scale.y = 0.8;
        pumpkin.position.set(px, terrainHeight(px, pz) + 0.35, pz);
        pumpkin.castShadow = true;
        group.add(pumpkin);
        const stem = new THREE.Mesh(new THREE.ConeGeometry(0.08, 0.2, 5), mat(0x55772f));
        stem.position.set(px, terrainHeight(px, pz) + 0.75, pz);
        group.add(stem);
      }
    }
    if (HOLIDAY.id === 'frost') {
      const lightColors = [0xffd23e, 0xff6b81, 0x8fce7a, 0x6a9ae0];
      for (let i = 0; i < 10; i++) {
        const a = (i / 10) * Math.PI * 2;
        const bulb = new THREE.Mesh(new THREE.IcosahedronGeometry(0.09, 0),
          new THREE.MeshBasicMaterial({ color: lightColors[i % 4] }));
        bulb.position.set(C.x + Math.cos(a) * 2.2, wy + 2.6 + Math.sin(a * 3) * 0.15, C.z + Math.sin(a) * 2.2);
        group.add(bulb);
      }
    }
  }

  // ----- placements: an arc on the north side of the plaza, facing south
  const spots = {
    shop: { x: C.x - 8, z: C.z - 3.5, w: 7, d: 6 },
    cafe: { x: C.x + 8, z: C.z - 3.5, w: 6.4, d: 5.6 },
    museum: { x: C.x, z: C.z - 7.5, w: 9, d: 6.5 },
  };

  const exteriors = {
    shop: makeShopExterior(),
    cafe: makeCafeExterior(),
    museum: makeMuseumExterior(),
  };

  for (const [name, spot] of Object.entries(spots)) {
    const ext = exteriors[name];
    ext.position.set(spot.x, terrainHeight(spot.x, spot.z), spot.z);
    ext.traverse((o) => { if (o.isMesh && !o.material.transparent) o.castShadow = true; });
    group.add(ext);
    zones.addBlocker(spot.x, spot.z, Math.max(spot.w, spot.d) / 2 + 0.9);
  }

  // café smoke drifts up and fades, forever
  const puffs = exteriors.cafe.userData.puffs;
  updates.push((dt, t) => {
    for (const p of puffs) {
      p.userData.t = (p.userData.t + dt * 0.25) % 1;
      const k = p.userData.t;
      p.position.y = 5.2 + k * 2.2;
      p.position.x = 1.7 + Math.sin(t * 0.8 + k * 6) * 0.3;
      p.scale.setScalar(0.6 + k * 1.1);
      p.material.opacity = 0.6 * (1 - k);
    }
  });

  // ----- interiors live far off-island; doors teleport you there
  const IN = {
    shop: { x: 300, z: 0 },
    cafe: { x: 300, z: 80 },
    museum: { x: 300, z: 160 },
  };

  function wireDoors(name, spot, label) {
    const inBase = IN[name];
    const doorPos = new THREE.Vector3(spot.x, 0, spot.z + spot.d / 2 + 0.4);
    register({
      pos: doorPos, r: 2.6, label: `enter ${label}`,
      use: () => zones.go(name),
    });
    register({
      pos: new THREE.Vector3(inBase.x, 0, inBase.z + 5.2), r: 1.6,
      zone: name, label: 'step outside',
      use: () => zones.leaveTo({ x: spot.x, z: spot.z + spot.d / 2 + 2.2, rotY: 0 }),
    });
  }

  // ====================================================== Pip's Odds & Ends
  {
    const B = IN.shop;
    group.add(buildRoom(B, 16, 12, 0xa97c50, 0xe3c98f));

    const counter = box(5, 1.1, 1.2, 0x8a5a3a);
    counter.position.set(B.x, 0.55, B.z - 2.5);
    group.add(counter);

    // shelves of mysterious wares
    for (const [sx, y] of [[-5.5, 1.4], [-5.5, 2.4], [5.5, 1.4], [5.5, 2.4]]) {
      const shelf = box(3.6, 0.16, 1, 0x8a5a3a);
      shelf.position.set(B.x + sx, y, B.z - 5.2);
      group.add(shelf);
      shelfClutter(B.x + sx, y + 0.25, B.z - 5.2, group);
    }

    // THE button. on a velvet pedestal. obviously.
    const pedestal = box(0.8, 1.2, 0.8, 0x7a3a4a);
    pedestal.position.set(B.x + 6.5, 0.6, B.z - 2);
    group.add(pedestal);
    const theButton = new THREE.Mesh(
      new THREE.CylinderGeometry(0.3, 0.3, 0.1, 12), mat(0xfff0a0, 0.15));
    theButton.position.set(B.x + 6.5, 1.35, B.z - 2);
    group.add(theButton);
    updates.push((dt, t) => { theButton.rotation.y = t * 0.7; });
    register({
      pos: pedestal.position, r: 2, zone: 'shop', label: 'admire the Shiniest Button',
      use: () => ui.say(
        ['It gleams. It dazzles. It is, structurally, just a button.',
         'From across the room, Pip is watching you very, very closely.'],
      ),
    });

    // a stool so Pip can actually see (and be seen) over his counter
    const pipStool = new THREE.Mesh(new THREE.CylinderGeometry(0.45, 0.5, 0.6, 7), mat(0x6b4a2e));
    pipStool.position.set(B.x, 0.3, B.z - 3.6);
    group.add(pipStool);
    const pip = npcAt('magpie', { body: 0x39414f, head: 0x39414f }, B.x, B.z - 3.6, 0, 0.6);
    group.add(pip);
    wireNpcBob(pip, updates);

    zones.registerInterior('shop', {
      floorY: 0,
      bounds: { x0: B.x - 7.5, x1: B.x + 7.5, z0: B.z - 4.4, z1: B.z + 5.4 },
      blockers: [
        { x: B.x, z: B.z - 2.5, r: 1.6 },      // counter
        { x: B.x + 6.5, z: B.z - 2, r: 0.9 },  // pedestal
      ],
      spawn: { x: B.x, z: B.z + 4.6, rotY: Math.PI },
      lighting: {
        bg: 0x241c14, fog: 0x241c14, fogNear: 24, fogFar: 60,
        hemiSky: 0xffe6c0, hemiGround: 0x6b5135, hemiIntensity: 1.25,
        sunIntensity: 0,
      },
    });
    wireDoors('shop', spots.shop, 'Pip’s Odds & Ends');

    register({
      pos: new THREE.Vector3(B.x, 0, B.z - 2.5), r: 3, zone: 'shop',
      label: 'talk to Pip',
      use: () => pipMenu(),
    });
  }

  // ====================================================== The Lantern Room
  {
    const B = IN.cafe;
    group.add(buildRoom(B, 14, 11, 0x7a5230, 0xead9b8));
    hangCafeArt(group, B); // culture

    const counter = box(4.6, 1.1, 1.2, 0x6b4a2e);
    counter.position.set(B.x - 2, 0.55, B.z - 2.8);
    group.add(counter);

    // the espresso rig: tank, tower, tiny important levers
    const machine = new THREE.Group();
    machine.add(box(1.1, 0.9, 0.7, 0xb05a4a));
    const spout = box(0.16, 0.3, 0.3, 0x55483a);
    spout.position.set(0, -0.2, 0.32);
    machine.add(spout);
    machine.position.set(B.x - 3.2, 1.55, B.z - 2.8);
    group.add(machine);

    // THE old lamp — the lighthouse's lamp, retired to counter duty
    const lampBase = new THREE.Mesh(new THREE.CylinderGeometry(0.34, 0.42, 0.5, 8), mat(0x9a8a6a, 0.4));
    lampBase.position.set(B.x - 0.2, 1.35, B.z - 2.8);
    group.add(lampBase);
    const lampGlow = new THREE.Mesh(
      new THREE.IcosahedronGeometry(0.32, 0),
      new THREE.MeshBasicMaterial({ color: 0xffe2a8 })
    );
    lampGlow.position.set(B.x - 0.2, 1.95, B.z - 2.8);
    group.add(lampGlow);
    const lampLight = warmLamp(B.x - 0.2, 2.4, B.z - 2.6, 0xffc97a, 60, 18);
    group.add(lampLight);
    updates.push((dt, t) => {
      const pulse = 1 + Math.sin(t * 1.7) * 0.06;
      lampGlow.scale.setScalar(pulse);
      lampLight.intensity = 60 + Math.sin(t * 1.7) * 8;
    });
    register({
      pos: lampBase.position, r: 2.2, zone: 'cafe', label: 'look at the old lamp',
      use: () => {
        const seen = S.hasFlag('sawLamp');
        S.setFlag('sawLamp');
        ui.say(seen
          ? 'The lamp glows softly, like an ember that found a good retirement.'
          : ['A heavy brass lamp, lens fogged with years. It is warm without being lit.',
             'A small card reads: “FROM THE LIGHTHOUSE. DO NOT POLISH. IT TICKLES.”']);
      },
    });

    // two round tables with stools
    for (const [tx, tz] of [[B.x + 3.4, B.z + 0.6], [B.x - 3.6, B.z + 1.6]]) {
      const top = new THREE.Mesh(new THREE.CylinderGeometry(1.0, 1.0, 0.14, 8), mat(0x8a5a3a));
      top.position.set(tx, 1.0, tz);
      const leg = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.16, 1.0, 6), mat(0x6b4a2e));
      leg.position.set(tx, 0.5, tz);
      const cup = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.1, 0.18, 7), mat(0xfffaf0, 0.5));
      cup.position.set(tx + 0.3, 1.16, tz - 0.2);
      group.add(top, leg, cup);
      for (const a of [0.7, 2.6]) {
        const stool = new THREE.Mesh(new THREE.CylinderGeometry(0.34, 0.4, 0.62, 7), mat(0xa97c50));
        stool.position.set(tx + Math.cos(a) * 1.7, 0.31, tz + Math.sin(a) * 1.7);
        group.add(stool);
      }
    }

    // Chip, the house musician: a cricket, a stool, a guitar, no plans
    const chipStool = new THREE.Mesh(new THREE.CylinderGeometry(0.4, 0.46, 0.8, 7), mat(0x6b4a2e));
    chipStool.position.set(B.x + 5.2, 0.4, B.z - 2.6);
    group.add(chipStool);
    const chip = new THREE.Group();
    const chipBody = new THREE.Mesh(new THREE.CapsuleGeometry(0.12, 0.3, 2, 5), mat(0x6f9a45, 0.7));
    chipBody.rotation.x = -0.5;
    chipBody.position.y = 0.25;
    chip.add(chipBody);
    for (const sx of [-1, 1]) {
      const eye = new THREE.Mesh(new THREE.IcosahedronGeometry(0.035, 0),
        new THREE.MeshStandardMaterial({ color: 0x222222, roughness: 0.35 }));
      eye.position.set(sx * 0.07, 0.45, 0.1);
      chip.add(eye);
      const antenna = new THREE.Mesh(new THREE.CylinderGeometry(0.012, 0.012, 0.34, 4), mat(0x55772f));
      antenna.position.set(sx * 0.05, 0.6, 0.04);
      antenna.rotation.z = -sx * 0.5;
      chip.add(antenna);
    }
    const guitar = new THREE.Group();
    const guitarBody = new THREE.Mesh(new THREE.CylinderGeometry(0.16, 0.16, 0.08, 9), mat(0xc97b35, 0.5));
    guitarBody.rotation.x = Math.PI / 2;
    guitar.add(guitarBody);
    const neck = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.4, 0.04), mat(0x55483a, 0.5));
    neck.position.set(0.12, 0.2, 0);
    neck.rotation.z = -0.5;
    guitar.add(neck);
    guitar.position.set(0.08, 0.26, 0.16);
    guitar.rotation.z = 0.3;
    chip.add(guitar);
    chip.position.set(B.x + 5.2, 0.8, B.z - 2.6);
    chip.rotation.y = -0.6;
    group.add(chip);
    updates.push((dt, t) => {
      chip.rotation.z = Math.sin(t * 2.2) * 0.06; // swaying with the tune in his head
    });
    register({
      pos: chipStool.position, r: 2.4, zone: 'cafe',
      label: 'request a song from Chip',
      use: async () => {
        const choice = await ui.ask('Mm? Oh — sure. Whatcha feeling?', [
          ...SONGS.map((s) => ({ label: `🎵 ${s.name}`, value: s.id })),
          { label: 'Just listening', value: null },
        ], { speaker: 'Chip', voice: 820 });
        if (!choice) {
          ui.say('Best audience there is.', { speaker: 'Chip', voice: 820 });
          return;
        }
        const song = SONGS.find((s) => s.id === choice);
        requestSong(choice);
        ui.toast(`♪ Chip plays “${song.name}”`, '🦗');
      },
    });

    const lunaStool = new THREE.Mesh(new THREE.CylinderGeometry(0.45, 0.5, 0.6, 7), mat(0x55483a));
    lunaStool.position.set(B.x - 2, 0.3, B.z - 3.8);
    group.add(lunaStool);
    const luna = npcAt('moth', { body: 0xe8e0c8, head: 0xe8e0c8 }, B.x - 2, B.z - 3.8, 0, 0.6);
    group.add(luna);
    wireNpcBob(luna, updates);

    zones.registerInterior('cafe', {
      floorY: 0,
      bounds: { x0: B.x - 6.5, x1: B.x + 6.5, z0: B.z - 3.9, z1: B.z + 4.9 },
      blockers: [
        { x: B.x - 2, z: B.z - 2.8, r: 1.5 },   // counter
        { x: B.x + 3.4, z: B.z + 0.6, r: 1.1 }, // tables
        { x: B.x - 3.6, z: B.z + 1.6, r: 1.1 },
      ],
      spawn: { x: B.x + 1, z: B.z + 4.2, rotY: Math.PI },
      lighting: {
        bg: 0x2a2018, fog: 0x2a2018, fogNear: 22, fogFar: 55,
        hemiSky: 0xffe9c8, hemiGround: 0x70573b, hemiIntensity: 1.0,
        sunIntensity: 0,
      },
    });
    wireDoors('cafe', spots.cafe, 'The Lantern Room');

    register({
      pos: new THREE.Vector3(B.x - 2, 0, B.z - 2.8), r: 3, zone: 'cafe',
      label: 'talk to Luna',
      use: () => lunaMenu(),
    });
  }

  // ====================================================== Notbell Museum
  // Bigger on the inside. The building respects the collection.
  const museumDisplays = new THREE.Group();
  let refreshMuseum = () => {};
  {
    const B = IN.museum;
    const wallMat = 0xd8d2c2;

    // floors: entrance gallery, great hall, aquarium hall — old wood + runners
    for (const [w, d, x, z] of [
      [12.4, 7.9, B.x, B.z + 6.75],
      [37.4, 9.4, B.x, B.z - 1.5],
      [18.4, 9.0, B.x, B.z - 10.5],
    ]) {
      const floor = box(w, 0.4, d, 0x9a8468);
      floor.position.set(x, -0.2, z);
      floor.receiveShadow = true;
      group.add(floor);
    }
    const runner = box(2.6, 0.06, 7.4, 0x8a3a3a);
    runner.position.set(B.x, 0.05, B.z + 6.7);
    group.add(runner);
    const roundRug = new THREE.Mesh(new THREE.CylinderGeometry(3.4, 3.4, 0.06, 12), mat(0x8a3a3a, 0.85));
    roundRug.position.set(B.x, 0.05, B.z - 1);
    group.add(roundRug);

    // walls of the whole cross, with sconces that pretend to be gaslight
    const WALLS = [
      [12.8, 0.4, B.x, B.z + 10.5],
      [13.0, 0.4, B.x - 12.4, B.z + 3.2], [13.0, 0.4, B.x + 12.4, B.z + 3.2],
      [0.4, 9.8, B.x - 18.5, B.z - 1.5], [0.4, 9.8, B.x + 18.5, B.z - 1.5],
      [10.0, 0.4, B.x - 13.9, B.z - 6.2], [10.0, 0.4, B.x + 13.9, B.z - 6.2],
      [0.4, 8.8, B.x - 9, B.z - 10.6], [0.4, 8.8, B.x + 9, B.z - 10.6],
      [18.4, 0.4, B.x, B.z - 15],
      [0.4, 7.6, B.x - 6.2, B.z + 6.9], [0.4, 7.6, B.x + 6.2, B.z + 6.9],
    ];
    for (const [w, d, x, z] of WALLS) {
      const wall = new THREE.Mesh(new THREE.BoxGeometry(w, 5.2, d), mat(wallMat));
      wall.position.set(x, 2.6, z);
      group.add(wall);
    }
    for (const [sx, sz] of [[-8, 2.8], [8, 2.8], [-16, -5.8], [16, -5.8], [0, 10.1]]) {
      const sconce = new THREE.Mesh(new THREE.IcosahedronGeometry(0.14, 0),
        new THREE.MeshBasicMaterial({ color: 0xffd9a0 }));
      sconce.position.set(B.x + sx, 3.4, B.z + sz);
      group.add(sconce);
    }
    group.add(warmLamp(B.x, 4.2, B.z - 1, 0xffe2b0, 60, 30));

    // benches + rope barriers: the furniture of patience
    for (const [bx, bz, ry] of [[B.x - 3, B.z - 3.4, 0.3], [B.x + 3.4, B.z + 0.6, -0.4]]) {
      const bench = box(2.0, 0.4, 0.7, 0x8a5a3a);
      bench.position.set(bx, 0.35, bz);
      bench.rotation.y = ry;
      group.add(bench);
    }
    function rope(x0, z0, x1, z1) {
      for (const [px, pz] of [[x0, z0], [x1, z1]]) {
        const post = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.08, 0.9, 6), mat(0xc9a440, 0.4));
        post.position.set(px, 0.45, pz);
        group.add(post);
      }
      const len = Math.hypot(x1 - x0, z1 - z0);
      for (let k = 0; k < 3; k++) {
        const t0 = k / 3, t1 = (k + 1) / 3;
        const seg = new THREE.Mesh(new THREE.CylinderGeometry(0.025, 0.025, len / 3, 4), mat(0x8a3a3a, 0.8));
        seg.position.set(
          x0 + (x1 - x0) * (t0 + t1) / 2,
          0.78 - Math.sin(((t0 + t1) / 2) * Math.PI) * 0.08,
          z0 + (z1 - z0) * (t0 + t1) / 2);
        seg.rotation.z = Math.PI / 2;
        seg.rotation.y = Math.atan2(z1 - z0, x1 - x0) * -1;
        group.add(seg);
      }
    }

    // ---------- west wing: the fossil hall
    const sandPit = box(7, 0.3, 5, 0xd9c08f);
    sandPit.position.set(B.x - 14, 0.15, B.z + 0.2);
    group.add(sandPit);
    const halfBone = new THREE.Mesh(new THREE.TorusGeometry(1.0, 0.16, 6, 10, Math.PI * 0.8), mat(0xe8e4d8, 0.7));
    halfBone.position.set(B.x - 14.5, 0.3, B.z + 0.4);
    halfBone.rotation.x = -Math.PI / 2.4;
    group.add(halfBone);
    rope(B.x - 17.2, B.z + 2.5, B.x - 10.8, B.z + 2.5);
    const plinthSpots = [];
    for (let i = 0; i < 5; i++) {
      const px = B.x - 17 + i * 1.9;
      const plinth = box(1.0, 0.9 + (i % 2) * 0.25, 1.0, 0xb9c0b9);
      plinth.position.set(px, (0.9 + (i % 2) * 0.25) / 2, B.z - 5.4);
      group.add(plinth);
      plinthSpots.push({ x: px, y: 0.9 + (i % 2) * 0.25 + 0.25, z: B.z - 5.4 });
    }
    // the Mystery Skeleton: assembles itself one donation at a time
    register({
      pos: new THREE.Vector3(B.x - 14, 0, B.z - 3), r: 2.4, zone: 'museum',
      label: 'read the skeleton plaque',
      use: () => ui.say('“MYSTERY SKELETON. SPECIES: UNDECIDED. ERA: BEFORE LUNCH. CONTRIBUTIONS GRATEFULLY ASSEMBLED.” —F.'),
    });

    // ---------- east wing: the bug hall, six little worlds
    const terrSpots = [];
    for (let i = 0; i < 6; i++) {
      const tx = B.x + 10.5 + (i % 3) * 3.2;
      const tz = B.z - 4.6 + Math.floor(i / 3) * 6.4;
      const stand = box(2.2, 1.0, 1.6, 0x6b4a2e);
      stand.position.set(tx, 0.5, tz);
      group.add(stand);
      const glass = new THREE.Mesh(new THREE.BoxGeometry(2.0, 1.5, 1.4),
        new THREE.MeshStandardMaterial({ color: 0xbfe6f2, transparent: true, opacity: 0.18, roughness: 0.1 }));
      glass.position.set(tx, 1.78, tz);
      group.add(glass);
      const bed = box(1.9, 0.12, 1.3, [0x5fb74a, 0x7a5230, 0x3fb0e8, 0x6ec45a, 0x1a2030, 0xd9c08f][i]);
      bed.position.set(tx, 1.1, tz);
      group.add(bed);
      // habitat dressing per tank
      if (i === 0 || i === 3) { // meadow / grass
        for (let k = 0; k < 3; k++) {
          const tuft = new THREE.Mesh(new THREE.ConeGeometry(0.07, 0.3, 4), mat(0x4e9a45, 0.9));
          tuft.position.set(tx - 0.5 + k * 0.5, 1.3, tz + (k % 2 ? 0.3 : -0.2));
          group.add(tuft);
        }
        const bloom = new THREE.Mesh(new THREE.IcosahedronGeometry(0.09, 0), mat(0xff6b81, 0.7));
        bloom.position.set(tx + 0.4, 1.45, tz);
        group.add(bloom);
      } else if (i === 1) { // old log
        const log = new THREE.Mesh(new THREE.CylinderGeometry(0.22, 0.25, 1.3, 7), mat(0x7a5230));
        log.rotation.z = Math.PI / 2;
        log.position.set(tx, 1.3, tz);
        group.add(log);
      } else if (i === 2) { // pond
        const pondT = new THREE.Mesh(new THREE.CylinderGeometry(0.5, 0.5, 0.06, 10), mat(0x57c8d8, 0.2));
        pondT.position.set(tx, 1.18, tz);
        group.add(pondT);
      } else if (i === 4) { // the dark tank
        const shroomT = new THREE.Mesh(new THREE.ConeGeometry(0.1, 0.14, 6),
          new THREE.MeshBasicMaterial({ color: 0x7fe8d8 }));
        shroomT.position.set(tx - 0.4, 1.22, tz + 0.2);
        group.add(shroomT);
      } else { // sand
        const pebble = new THREE.Mesh(new THREE.IcosahedronGeometry(0.12, 0), mat(0x9aa0a6));
        pebble.position.set(tx + 0.3, 1.2, tz - 0.2);
        group.add(pebble);
      }
      terrSpots.push({ x: tx, y: 1.7, z: tz });
    }
    register({
      pos: new THREE.Vector3(B.x + 12, 0, B.z - 1.5), r: 2.6, zone: 'museum',
      label: 'read the bug hall card',
      use: () => ui.say('“EVERY RESIDENT OF THIS HALL HAS APPROVED ITS OWN HABITAT. THE NEGOTIATIONS WERE LENGTHY.” —F.'),
    });

    // ---------- north wing: the aquarium
    const tankGlass = new THREE.Mesh(new THREE.BoxGeometry(16, 4.6, 6.5),
      new THREE.MeshStandardMaterial({
        color: 0x2b8fc4, transparent: true, opacity: 0.42, roughness: 0.1, flatShading: true,
      }));
    tankGlass.position.set(B.x, 2.5, B.z - 11.2);
    group.add(tankGlass);
    const tankBack = box(16.2, 4.8, 0.3, 0x16344a);
    tankBack.position.set(B.x, 2.5, B.z - 14.5);
    group.add(tankBack);
    const tankSand = box(15.8, 0.3, 6.3, 0xd9c08f);
    tankSand.position.set(B.x, 0.35, B.z - 11.2);
    group.add(tankSand);
    // kelp, light rays, the dark grotto corner for cave species
    const kelps = [];
    for (let i = 0; i < 7; i++) {
      const kelp = new THREE.Group();
      const kx = B.x - 7 + i * 2.3, kz = B.z - 11 + (i % 2) * 1.4;
      for (let seg = 0; seg < 4; seg++) {
        const blade = new THREE.Mesh(new THREE.ConeGeometry(0.16, 1.0, 4), mat(0x3f7a45, 0.9));
        blade.position.y = 0.6 + seg * 0.8;
        kelp.add(blade);
      }
      kelp.position.set(kx, 0.4, kz);
      kelps.push(kelp);
      group.add(kelp);
    }
    for (let i = 0; i < 4; i++) {
      const ray = new THREE.Mesh(new THREE.PlaneGeometry(0.8, 4.4),
        new THREE.MeshBasicMaterial({ color: 0xbfe6f2, transparent: true, opacity: 0.12, depthWrite: false, side: THREE.DoubleSide }));
      ray.position.set(B.x - 6 + i * 4, 2.6, B.z - 11);
      ray.rotation.z = 0.18;
      group.add(ray);
    }
    const grotto = box(4.5, 4.4, 6.2, 0x10141c);
    grotto.position.set(B.x + 5.6, 2.4, B.z - 11.3);
    group.add(grotto);
    const grottoGlow = new THREE.Mesh(new THREE.IcosahedronGeometry(0.12, 0),
      new THREE.MeshBasicMaterial({ color: 0x7fe8d8 }));
    grottoGlow.position.set(B.x + 5.6, 1.2, B.z - 9.4);
    group.add(grottoGlow);
    const bubbles = [];
    for (let i = 0; i < 12; i++) {
      const bub = new THREE.Mesh(new THREE.IcosahedronGeometry(0.05, 0),
        new THREE.MeshBasicMaterial({ color: 0xeaf8ff, transparent: true, opacity: 0.7 }));
      bub.userData = { col: i % 3, k: rand(0, 1) };
      bubbles.push(bub);
      group.add(bub);
    }
    rope(B.x - 8.2, B.z - 7.4, B.x + 8.2, B.z - 7.4);

    // ---------- the entrance gallery: nine waiting walls
    const artSlots = [];
    for (let i = 0; i < 9; i++) {
      const west = i < 5;
      const sx = west ? B.x - 5.95 : B.x + 5.95;
      const sz = B.z + 3.9 + (west ? i : i - 5) * 1.55;
      artSlots.push({ x: sx, y: 2.5, z: sz, rotY: west ? Math.PI / 2 : -Math.PI / 2 });
    }

    // dynamic displays live here and rebuild on every donation
    group.add(museumDisplays);
    const swimmers = [];
    const flutterers = [];

    refreshMuseum = () => {
      museumDisplays.clear();
      swimmers.length = 0;
      flutterers.length = 0;
      const donated = S.state.donations.map((id) => ({ id, item: ITEMS[id] })).filter((d) => d.item);

      // fossils → plinths + the Mystery Skeleton gaining parts
      const fossils = donated.filter((d) => d.item.kind === 'fossil');
      fossils.slice(0, plinthSpots.length).forEach((d, i) => {
        const sSpot = plinthSpots[i];
        const f = new THREE.Mesh(new THREE.IcosahedronGeometry(0.32, 0), mat(0xc9bda4, 0.8));
        f.scale.y = 0.7;
        f.position.set(sSpot.x, sSpot.y, sSpot.z);
        museumDisplays.add(f);
      });
      const SKELLY = {
        megalodont_tooth: () => { // the skull, mostly grin
          const skull = new THREE.Mesh(new THREE.IcosahedronGeometry(0.7, 0), mat(0xe8e4d8, 0.7));
          skull.scale.set(1.2, 0.8, 0.9);
          skull.position.set(B.x - 17.2, 3.2, B.z - 2.5);
          return [skull];
        },
        trilobutton: () => Array.from({ length: 4 }, (_, k) => {
          const rib = new THREE.Mesh(new THREE.TorusGeometry(0.55 - k * 0.06, 0.07, 5, 8, Math.PI), mat(0xe8e4d8, 0.7));
          rib.position.set(B.x - 15.6 + k * 0.5, 3.0, B.z - 2.5);
          rib.rotation.z = Math.PI;
          return rib;
        }),
        fern_frond: () => Array.from({ length: 5 }, (_, k) => {
          const vert = new THREE.Mesh(new THREE.IcosahedronGeometry(0.14, 0), mat(0xe8e4d8, 0.7));
          vert.position.set(B.x - 16.4 + k * 0.55, 3.55, B.z - 2.5);
          return vert;
        }),
        curlstone: () => { // the splendid spiral tail
          const tail = new THREE.Mesh(new THREE.TorusGeometry(0.5, 0.09, 5, 10, Math.PI * 1.6), mat(0xe8e4d8, 0.7));
          tail.position.set(B.x - 12.9, 3.1, B.z - 2.5);
          tail.rotation.z = 0.6;
          return [tail];
        },
        very_old_pebble: () => { // a pebble, where the heart goes
          const heart = new THREE.Mesh(new THREE.IcosahedronGeometry(0.16, 0), mat(0x9aa0a6, 0.6));
          heart.position.set(B.x - 15.1, 2.9, B.z - 2.4);
          return [heart];
        },
      };
      for (const d of fossils) {
        (SKELLY[d.id]?.() ?? []).forEach((m) => museumDisplays.add(m));
      }

      // fish + tide pool finds → the aquarium (cave species in the grotto)
      const fishes = donated.filter((d) => d.item.kind === 'fish' || d.item.kind === 'pool');
      fishes.forEach((d, i) => {
        const deep = (d.item.where ?? 'sea') === 'cave';
        const hue = (d.id.length * 47 + i * 61) % 360;
        const body = new THREE.Mesh(new THREE.IcosahedronGeometry(0.2, 0),
          mat(new THREE.Color(`hsl(${hue}, 60%, ${deep ? 75 : 55}%)`).getHex(), 0.5));
        body.scale.set(1.7, 0.8, 0.8);
        const tail = new THREE.Mesh(new THREE.ConeGeometry(0.1, 0.22, 4),
          mat(new THREE.Color(`hsl(${hue}, 60%, 45%)`).getHex(), 0.5));
        tail.rotation.z = Math.PI / 2;
        tail.position.x = -0.38;
        const fish = new THREE.Group();
        fish.add(body, tail);
        fish.userData = {
          cx: deep ? B.x + 5.6 : B.x - 2.5,
          cz: B.z - 11.2,
          rx: deep ? 1.4 : 5.5,
          rz: deep ? 1.6 : 2.2,
          y: 1.2 + (i % 4) * 0.75,
          ph: i * 1.3,
          sp: rand(0.25, 0.5),
        };
        swimmers.push(fish);
        museumDisplays.add(fish);
      });

      // bugs → their terrariums
      const TANK_OF = {
        lemon_flit: 0, paper_wisp: 0, rose_skipper: 0, sky_dancer: 0,
        buttonshell_beetle: 1, dewdrop_dragonfly: 2, meadow_cricket: 3,
        cave_glimmerwing: 4, lantern_firefly: 4, garden_snail: 5, ladybird: 5,
      };
      const BUG_TINT = {
        lemon_flit: 0xfff3a8, paper_wisp: 0xffffff, rose_skipper: 0xffb3d1,
        sky_dancer: 0x9fd8ff, buttonshell_beetle: 0x3a3228, dewdrop_dragonfly: 0x57c8d8,
        meadow_cricket: 0x6f9a45, cave_glimmerwing: 0xd8fff2, lantern_firefly: 0xffe98f,
        garden_snail: 0x8a5a3a, ladybird: 0xd84f4f,
      };
      donated.filter((d) => d.item.kind === 'bug').forEach((d, i) => {
        const tank = terrSpots[TANK_OF[d.id] ?? 0];
        const bug = new THREE.Mesh(new THREE.IcosahedronGeometry(0.07, 0), mat(BUG_TINT[d.id] ?? 0xffd23e, 0.5));
        const flies = [0, 2, 4].includes(TANK_OF[d.id]);
        bug.userData = { cx: tank.x, cz: tank.z, y: flies ? tank.y : tank.y - 0.5, ph: i * 1.7, flies };
        flutterers.push(bug);
        museumDisplays.add(bug);
      });

      // art → the entrance gallery
      const arts = donated.filter((d) => d.item.kind === 'art');
      artSlots.forEach((slot, i) => {
        const piece = arts[i] ? artPiece(arts[i].id) : null;
        if (piece) {
          const framed = makeFramed(piece);
          framed.position.set(slot.x, slot.y, slot.z);
          framed.rotation.y = slot.rotY;
          museumDisplays.add(framed);
        } else {
          const empty = new THREE.Mesh(new THREE.BoxGeometry(0.06, 1.6, 1.2), mat(0xc8c2b2, 0.9));
          empty.position.set(slot.x, slot.y, slot.z);
          museumDisplays.add(empty);
        }
      });
    };
    refreshMuseum();

    // the halls breathe only while you're inside them
    updates.push((dt, t) => {
      if (zones.current() !== 'museum') return;
      for (const fish of swimmers) {
        const u = fish.userData;
        const a = t * u.sp + u.ph;
        fish.position.set(u.cx + Math.sin(a) * u.rx, u.y + Math.sin(a * 2) * 0.2, u.cz + Math.sin(a * 2) * u.rz * 0.5);
        fish.rotation.y = Math.atan2(Math.cos(a) * u.rx, Math.cos(a * 2) * u.rz) + Math.PI / 2;
      }
      for (const bug of flutterers) {
        const u = bug.userData;
        if (u.flies) {
          bug.position.set(u.cx + Math.cos(t * 1.3 + u.ph) * 0.5, u.y + Math.sin(t * 2 + u.ph) * 0.25, u.cz + Math.sin(t * 1.1 + u.ph) * 0.35);
        } else {
          bug.position.set(u.cx + Math.cos(u.ph) * 0.5, u.y + Math.max(0, Math.sin(t * 2.4 + u.ph)) * 0.08, u.cz + Math.sin(u.ph) * 0.3);
        }
      }
      for (let i = 0; i < kelps.length; i++) {
        kelps[i].rotation.z = Math.sin(t * 0.8 + i) * 0.08;
      }
      for (const bub of bubbles) {
        bub.userData.k = (bub.userData.k + dt * 0.12) % 1;
        bub.position.set(
          B.x - 5 + bub.userData.col * 4 + Math.sin(t + bub.userData.k * 9) * 0.15,
          0.6 + bub.userData.k * 3.8,
          B.z - 11.5);
        bub.material.opacity = 0.7 * (1 - bub.userData.k * 0.6);
      }
    });

    const fern = npcAt('tortoise', { body: 0x9aa86b, head: 0x9aa86b }, B.x - 1.5, B.z - 2.2, 0.4);
    group.add(fern);
    wireNpcBob(fern, updates, 0.5);

    zones.registerInterior('museum', {
      floorY: 0,
      bounds: { x0: B.x - 18.1, x1: B.x + 18.1, z0: B.z - 14.6, z1: B.z + 10.1 },
      blockers: [
        { x: B.x - 12.25, z: B.z + 7, r: 6.4 }, { x: B.x + 12.25, z: B.z + 7, r: 6.4 },
        { x: B.x - 13.9, z: B.z - 10.5, r: 5.2 }, { x: B.x + 13.9, z: B.z - 10.5, r: 5.2 },
        { x: B.x, z: B.z - 11.2, r: 3.4 }, // the tank itself
        { x: B.x - 14, z: B.z + 0.2, r: 2.6 }, // the dig pit
        { x: B.x - 1.5, z: B.z - 2.2, r: 1.0 }, // Fern
      ],
      spawn: { x: B.x, z: B.z + 9.4, rotY: Math.PI },
      lighting: {
        bg: 0x1c2026, fog: 0x1c2026, fogNear: 30, fogFar: 80,
        hemiSky: 0xf2ead8, hemiGround: 0x5a6258, hemiIntensity: 1.2,
        sunIntensity: 0,
      },
    });

    register({
      pos: new THREE.Vector3(spots.museum.x, 0, spots.museum.z + spots.museum.d / 2 + 0.4), r: 2.6,
      label: 'enter the Notbell Museum',
      use: async () => {
        await zones.go('museum');
        if (!S.hasFlag('sawBigInside')) {
          S.setFlag('sawBigInside');
          ui.say('It is, unmistakably, much bigger on the inside. A small plaque by the door explains: "THE BUILDING RESPECTS THE COLLECTION."');
        }
      },
    });
    register({
      pos: new THREE.Vector3(IN.museum.x, 0, IN.museum.z + 9.9), r: 1.8,
      zone: 'museum', label: 'step outside',
      use: () => zones.leaveTo({ x: spots.museum.x, z: spots.museum.z + spots.museum.d / 2 + 2.2, rotY: 0 }),
    });

    register({
      getPos: () => fern.position, r: 3, zone: 'museum',
      label: 'talk to Fern',
      use: () => fernMenu(refreshMuseum),
    });
  }

  // ------------------------------------------------------------- update ----
  function update(dt, t, playerPos) {
    for (const u of updates) u(dt, t, playerPos);
  }

  return { group, update };
}

// gentle breathing for the standing shopkeepers
function wireNpcBob(npc, updates, speed = 1) {
  const parts = npc.userData.parts;
  const phase = rand(0, Math.PI * 2);
  updates.push((dt, t, playerPos) => {
    parts.body.position.y = parts.bodyY + Math.sin(t * 1.6 * speed + phase) * 0.03;
    parts.head.position.y = parts.headY + Math.sin(t * 1.6 * speed + phase + 0.5) * 0.025;
    if (playerPos) {
      const dx = playerPos.x - npc.position.x;
      const dz = playerPos.z - npc.position.z;
      if (Math.hypot(dx, dz) < 7) {
        npc.rotation.y = turnToward(npc.rotation.y, Math.atan2(dx, dz), dt, 4);
      }
    }
  });
}

// ----------------------------------------------------------- Pip's menus ----

const PIP_CHAT = [
  'Buttons, friend! The only currency that’s ALSO a treasure. Try paying rent with feelings. Doesn’t work. Buttons do.',
  'Everything in this shop was lost, found, washed up, or “fell off a boat.” Those are all legally distinct categories.',
  'Old Tansy’s button jar started the whole economy, you know. Finest fiscal policy ever to fit on a windowsill.',
  'You find anything shiny out there — ANYTHING — I pay top button. No questions. Some light judgment, but no questions.',
];
let pipChatIdx = 0;

async function pipMenu() {
  if (!S.hasFlag('metPip')) {
    S.setFlag('metPip');
    S.giveTool('rod');
    await ui.say([
      'Well, well! A new face, and not a single button on you— no wait, there’s a few. I can hear them.',
      'Pip’s the name. Odds, ends, treasures, junk — the line between those is honestly just confidence.',
      'Here. A fishing rod, on the house. First one’s free. That’s how I get ya!',
    ], { speaker: 'Pip', voice: VOICE.pip });
    jingle();
    ui.toast('Pip gave you the <b>Driftwood Rod</b>! Find some water and press E.', '🎣');
    ui.updateHUD();
    return;
  }

  // holidays loosen even a magpie's grip on his buttons (once a year)
  if (HOLIDAY && !S.hasFlag(`gift_${HOLIDAY.id}_${new Date().getFullYear()}`)) {
    S.setFlag(`gift_${HOLIDAY.id}_${new Date().getFullYear()}`);
    S.earn(100);
    kaching();
    ui.updateHUD();
    await ui.say([
      `Happy ${HOLIDAY.name}! Here — a hundred buttons. A GIFT. From ME.`,
      'Don’t make it weird. Don’t tell anyone. Spend it here if possible.',
    ], { speaker: 'Pip', voice: VOICE.pip });
  }

  const choice = await ui.ask('What’ll it be?', [
    { label: 'Buy', value: 'buy' },
    { label: 'Sell', value: 'sell' },
    { label: 'Chat', value: 'chat' },
    { label: 'Leave', value: 'leave' },
  ], { speaker: 'Pip', voice: VOICE.pip });

  if (choice === 'buy') return pipBuy();
  if (choice === 'sell') return pipSell();
  if (choice === 'chat') {
    await ui.say(PIP_CHAT[pipChatIdx++ % PIP_CHAT.length], { speaker: 'Pip', voice: VOICE.pip });
    return pipMenu();
  }
}

async function pipBuy() {
  const choice = await ui.ask('Take a look! Everything’s for sale. Almost. Mostly.', [
    { label: '🛠️ Tools', value: 'tools' },
    { label: '🌱 Seeds', value: 'seeds' },
    { label: '🎩 Hats', value: 'hats' },
    { label: '🔘 The Shiniest Button', value: 'button', hint: '999🔘' },
    { label: 'Never mind', value: 'leave' },
  ], { speaker: 'Pip', voice: VOICE.pip });

  if (choice === 'tools') return pipBuyTools();
  if (choice === 'seeds') return pipBuySeeds();
  if (choice === 'hats') return pipBuyHats();
  if (choice === 'button') {
    await ui.say([
      'Ah, excellent eye! The Shiniest Button. 999 buttons, a true bargain, let me just—',
      '…',
      'No. NO. I can’t do it. That one’s MINE. I panicked when I priced it. Please buy literally anything else.',
    ], { speaker: 'Pip', voice: VOICE.pip });
    return pipMenu();
  }
  return pipMenu();
}

async function pipBuyTools() {
  const wares = [
    !S.state.tools.net && { label: `${ITEMS.net.emoji} Dandelion Net`, value: 'net', hint: `${ITEMS.net.price}🔘`, disabled: S.state.buttons < ITEMS.net.price },
    !S.state.tools.shovel && { label: `${ITEMS.shovel.emoji} Stubby Shovel`, value: 'shovel', hint: `${ITEMS.shovel.price}🔘`, disabled: S.state.buttons < ITEMS.shovel.price },
    !S.countItem('scuba_suit') && { label: `${ITEMS.scuba_suit.emoji} Salvage Diver’s Suit`, value: 'scuba', hint: `${ITEMS.scuba_suit.price}🔘`, disabled: S.state.buttons < ITEMS.scuba_suit.price },
    { label: 'Back', value: 'back' },
  ].filter(Boolean);
  if (wares.length === 1) {
    await ui.say('You’ve got the full kit already! Look at you. A professional.', { speaker: 'Pip', voice: VOICE.pip });
    return pipBuy();
  }
  const choice = await ui.ask('The tools of every trade I approve of:', wares,
    { speaker: 'Pip', voice: VOICE.pip });
  if (choice === 'scuba') {
    S.spend(ITEMS.scuba_suit.price);
    S.addItem('scuba_suit');
    kaching();
    ui.toast(`You bought the <b>${ITEMS.scuba_suit.name}</b>! <i>Walk into the sea like you mean it.</i>`, ITEMS.scuba_suit.emoji);
    ui.updateHUD();
    await ui.say([
      'Ahh, the diver’s suit. That one belonged to one of Tansy’s salvage divers — a whole summer underwater looking for the bell. Paid in buttons. STARTED the buttons, in fact.',
      'The helmet’s shaped like a bell. They all were. Diver humor, or diver hope. Nobody ever asked which.',
      S.state.avatar?.kind === 'duck'
        ? '…You’re a duck. You FLOAT. You know what? Fashion is fashion. No refunds.'
        : 'Just wade in anywhere and keep going. The sea’s very accommodating once you’re properly dressed for it.',
    ], { speaker: 'Pip', voice: VOICE.pip });
  }
  if (choice === 'net' || choice === 'shovel') {
    S.spend(ITEMS[choice].price);
    S.giveTool(choice);
    kaching();
    ui.toast(`You bought the <b>${ITEMS[choice].name}</b>! <i>${ITEMS[choice].blurb}</i>`, ITEMS[choice].emoji);
    ui.updateHUD();
    await ui.say(choice === 'net'
      ? 'The net! Swing it near anything that flutters. Gently! They’re someone’s neighbor.'
      : 'The shovel! If you see a little star of cracked earth, that’s the island winking at you. Dig there.',
      { speaker: 'Pip', voice: VOICE.pip });
  }
  return pipBuy();
}

async function pipBuySeeds() {
  const seeds = Object.keys(GROWTH);
  const choice = await ui.ask('Seeds! Tiny promises. Plant them in your garden plots.', [
    ...seeds.map((id) => ({
      label: `${ITEMS[id].emoji} ${ITEMS[id].name}`, value: id,
      hint: `${ITEMS[id].price}🔘`, disabled: S.state.buttons < ITEMS[id].price,
    })),
    { label: 'Back', value: 'back' },
  ], { speaker: 'Pip', voice: VOICE.pip });
  if (choice !== 'back' && GROWTH[choice]) {
    S.spend(ITEMS[choice].price);
    S.addItem(choice);
    kaching();
    ui.toast(`Bought <b>${ITEMS[choice].name}</b>.`, ITEMS[choice].emoji);
    ui.updateHUD();
    return pipBuySeeds(); // stock up without re-navigating
  }
  return pipBuy();
}

async function pipBuyHats() {
  const stock = SHOP_HATS.filter((id) => !S.state.hats.includes(id));
  if (!stock.length) {
    await ui.say('You own every hat I’ve got! The island’s best-dressed head. It’s yours. You have it.',
      { speaker: 'Pip', voice: VOICE.pip });
    return pipBuy();
  }
  const choice = await ui.ask('Hats! For the discerning head. Non-refungible.', [
    ...stock.map((id) => ({
      label: `${ITEMS[id].emoji} ${ITEMS[id].name}`, value: id,
      hint: `${ITEMS[id].price}🔘`, disabled: S.state.buttons < ITEMS[id].price,
    })),
    { label: 'Back', value: 'back' },
  ], { speaker: 'Pip', voice: VOICE.pip });
  if (choice !== 'back' && ITEMS[choice]) {
    S.spend(ITEMS[choice].price);
    S.ownHat(choice);
    kaching();
    ui.toast(`You bought the <b>${ITEMS[choice].name}</b>! Press <b>H</b> to wear it.`, ITEMS[choice].emoji);
    ui.updateHUD();
    if (choice === 'keepers_cap') {
      await ui.say('…Take care of that one. It kept all of us, once.', { speaker: 'Pip', voice: VOICE.pip });
    }
    return pipBuyHats();
  }
  return pipBuy();
}

async function pipSell() {
  const stock = S.sellables();
  if (!stock.length) {
    await ui.say('Empty pockets! Well — empty of THINGS. I can still hear the buttons. Go catch me something.',
      { speaker: 'Pip', voice: VOICE.pip });
    return pipMenu();
  }
  const choices = stock.map(({ id, n, item }) => {
    const f = S.marketFactor(id);
    return {
      label: `${item.emoji} ${item.name} ×${n}${f < 1 ? ' 📉' : ''}`,
      value: id,
      hint: `${Math.floor(item.price * f) * n}🔘`,
    };
  });
  choices.push({ label: 'Done selling', value: 'done' });

  const choice = await ui.ask('Let’s see what the island gave you!', choices,
    { speaker: 'Pip', voice: VOICE.pip });
  if (choice === 'done') return pipMenu();

  const n = S.countItem(choice);
  const factor = S.marketFactor(choice);
  const total = Math.floor(ITEMS[choice].price * factor) * n;
  const wasGlutted = factor < 1;
  S.removeItem(choice, n);
  S.earn(total);
  S.recordSale(choice, n);
  kaching();
  ui.toast(`Sold ${n} × <b>${ITEMS[choice].name}</b> for <b>${total}</b> buttons!`, '🔘');
  ui.updateHUD();
  if (choice === 'old_boot') {
    await ui.say('A boot! Single. Pre-loved. Aggressively waterproof in most places. I’ll take it.',
      { speaker: 'Pip', voice: VOICE.pip });
  } else if (!wasGlutted && S.marketFactor(choice) < 1) {
    await ui.say([
      `Whoa whoa whoa. That is a LOT of ${ITEMS[choice].name}. The market is officially FLOODED.`,
      'Half price on those ’til tomorrow. Supply! Demand! I don’t make the rules. (I make the rules.)',
    ], { speaker: 'Pip', voice: VOICE.pip });
  }
  return pipSell();
}

// ---------------------------------------------------------- Luna's menus ----

const LUNA_CHAT = [
  'Moths get a reputation. One little flutter at a porch light and suddenly you’re “obsessed.” This is a CAREER.',
  'That lamp is from the old lighthouse. Fern carried it down the cliff herself. Took her two summers. She says it took one. Let her have it.',
  'The trick to good coffee is patience. The trick to GREAT coffee is a moth with nowhere else she’d rather be.',
  'Some nights the lamp warms up all on its own. I sit with it. We don’t talk about it.',
  'The cave under the cliff? Lovely glow, very polite worms. Tell them Luna sent you and absolutely nothing will happen. They’re worms.',
];
let lunaChatIdx = 0;

async function lunaMenu() {
  if (!S.hasFlag('metLuna')) {
    S.setFlag('metLuna');
    await ui.say([
      'Oh — a new face! Welcome to The Lantern Room. Sit anywhere. The lamp likes company.',
      'I’m Luna. I make the coffee, I mind the light, and I am, yes, a moth. We find this arrangement very funny.',
    ], { speaker: 'Luna', voice: VOICE.luna });
  }
  const choice = await ui.ask('What can I warm up for you?', [
    { label: `☕ Lantern Roast`, value: 'coffee', hint: `${COFFEE_PRICE}🔘`, disabled: S.state.buttons < COFFEE_PRICE },
    { label: 'Chat', value: 'chat' },
    { label: 'Leave', value: 'leave' },
  ], { speaker: 'Luna', voice: VOICE.luna });

  if (choice === 'coffee') {
    S.spend(COFFEE_PRICE);
    S.drinkCoffee(COFFEE_BOOST_SECS);
    sip();
    ui.updateHUD();
    await ui.say('Careful, it’s warm. Like, lighthouse warm.', { speaker: 'Luna', voice: VOICE.luna });
    ui.toast(`You feel glowy. <i>Faster for ${COFFEE_BOOST_SECS} seconds!</i>`, '☕');
    return;
  }
  if (choice === 'chat') {
    await ui.say(LUNA_CHAT[lunaChatIdx++ % LUNA_CHAT.length], { speaker: 'Luna', voice: VOICE.luna });
    return lunaMenu();
  }
}

// ---------------------------------------------------------- Fern's menus ----

const FERN_CHAT = [
  'A museum is just a memory with better lighting, dear.',
  'Everything in here is older than me. I assure you, that is an achievement.',
  'Do slow down in the fossil wing. They have waited several million years; they find rushing impolite.',
];
let fernChatIdx = 0;

const FERN_THANKS = {
  fossil: 'Ah… ah! I REMEMBER these. Not personally. Mostly not personally. Onto the plinth it goes.',
  fish: 'Into the tank, little one. Mind the current — I had it installed for ambience and it has opinions.',
  pool: 'From the tide pools! The sea sends its strangest small ambassadors. It shall have a place of honor.',
  bug: 'Oh, lovely. The bug wall grows. The bugs on it remain, I’m told, extremely smug about this.',
};

async function fernMenu(refreshMuseum) {
  if (!S.hasFlag('metFern')) {
    S.setFlag('metFern');
    await ui.say([
      'Mmm. Welcome, welcome. Fern — curator, tortoise, keeper of everything the island would rather not forget.',
      'The shelves are terribly bare, dear. Bring me what the island shows you: fish, bugs, fossils, tide pool oddities.',
      'Each one carries a little of the story. Bring me enough, and I shall tell it to you properly.',
    ], { speaker: 'Fern', voice: VOICE.fern });
    return;
  }

  const choice = await ui.ask('Yes, dear?', [
    { label: 'Donate a find', value: 'donate' },
    { label: 'Chat', value: 'chat' },
    { label: 'Leave', value: 'leave' },
  ], { speaker: 'Fern', voice: VOICE.fern });

  if (choice === 'chat') {
    const n = S.state.donations.length;
    const line = n === 0
      ? 'The shelves are still bare, dear. The island is generous — go let it show off a little.'
      : FERN_CHAT[fernChatIdx++ % FERN_CHAT.length];
    await ui.say(line, { speaker: 'Fern', voice: VOICE.fern });
    return fernMenu(refreshMuseum);
  }
  if (choice !== 'donate') return;

  const options = S.donatables().map(({ id, item }) => ({
    label: `${item.emoji} ${item.name}`, value: id,
  }));
  if (!options.length) {
    await ui.say('Nothing new for the collection just now. The island will provide. It always does, eventually. I would know.',
      { speaker: 'Fern', voice: VOICE.fern });
    return fernMenu(refreshMuseum);
  }
  options.push({ label: 'Not today', value: 'cancel' });
  const pickId = await ui.ask('What have you brought me?', options,
    { speaker: 'Fern', voice: VOICE.fern });
  if (pickId === 'cancel') return fernMenu(refreshMuseum);

  S.donate(pickId);
  refreshMuseum();
  jingle();
  ui.toast(`Donated the <b>${ITEMS[pickId].name}</b> to the museum!`, '🏛️');
  await ui.say(FERN_THANKS[ITEMS[pickId].kind] || 'It shall be cherished.', { speaker: 'Fern', voice: VOICE.fern });

  // milestone lore — the island's story, a chapter at a time
  const n = S.state.donations.length;
  for (const lore of FERN_LORE) {
    if (n >= lore.at && S.state.loreToldUpTo < lore.at) {
      S.state.loreToldUpTo = lore.at;
      S.save();
      await ui.say(lore.text, { speaker: 'Fern', voice: VOICE.fern });
      break;
    }
  }
  return fernMenu(refreshMuseum);
}

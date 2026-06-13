// The Far Isle: a smaller, quieter neighbor. A grocery with a lobster
// behind the counter, a church with no bell and no plans to get one,
// a public garden, and — half-buried on the north beach — the Old Singer.

import * as THREE from 'three';
import { SITES, terrainHeight } from './terrain.js';
import * as zones from './zones.js';
import { register } from './interact.js';
import * as ui from './ui.js';
import * as S from './state.js';
import { ITEMS, GROWTH } from './catalog.js';
import { kaching, sip, jingle } from './audio.js';
import { buildAnimal } from './animals.js';
import { rand, pick, turnToward } from './utils.js';

function mat(color, rough = 0.9) {
  return new THREE.MeshStandardMaterial({ color, flatShading: true, roughness: rough });
}

function box(w, h, d, color) {
  const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat(color));
  m.castShadow = true;
  return m;
}

function collectInteriorRoot(parent, startIndex) {
  const root = new THREE.Group();
  root.add(...parent.children.slice(startIndex));
  parent.add(root);
  return root;
}

const IN = {
  grocery: { x: 300, z: 900 },
  church: { x: 300, z: 980 },
};

const VOICE = { barnaby: 290, alder: 410 };

const BARNABY_CHAT = [
  'Fresh off the morning train! The train carries nothing. I just enjoy saying it.',
  'A lobster runs the grocery and NOBODY makes soup jokes. Wonderful island. Wonderful people.',
  'Brother Alder trades me candle stubs for kelp. Don’t ask what I do with the stubs. (I light them. It’s nice.)',
  'My cousin lives in your tide pools. We wave. We’re not close.',
];
let barnabyChatIdx = 0;

const ALDER_LORE = [
  'We are Listeners, dear walker. We keep no god and ring no bell. We listen for the one the sea borrowed.',
  'When the fog is thick, the whole congregation sits perfectly still. Some say they hear the bell. Some say they hear Howell. Both are sacred, in their way.',
  'The belfry stays empty on purpose. An empty place where a bell should be is itself a kind of bell. Sit with that. Or just sit — sitting is also good.',
];
let alderLoreIdx = 0;

export function createIsland2() {
  const group = new THREE.Group();
  const updates = [];
  const T = SITES.town2;
  const ty = terrainHeight(T.x, T.z);

  // a lamp post for the little square
  const post = box(0.14, 2.6, 0.14, 0x55483a);
  post.position.set(T.x, ty + 1.3, T.z + 2);
  const lampGlow = new THREE.Mesh(new THREE.IcosahedronGeometry(0.22, 0),
    new THREE.MeshBasicMaterial({ color: 0xffd98f }));
  lampGlow.position.set(T.x, ty + 2.7, T.z + 2);
  group.add(post, lampGlow);

  // ====================================================== Barnaby's
  const gSpot = { x: T.x - 6, z: T.z - 3 };
  {
    const gy = terrainHeight(gSpot.x, gSpot.z);
    const ext = new THREE.Group();
    const walls = box(6.4, 3.2, 5.4, 0x5fa8a0);
    walls.position.y = 1.6;
    ext.add(walls);
    const roof = new THREE.Mesh(new THREE.ConeGeometry(5.1, 2.2, 4), mat(0xd9a440));
    roof.position.y = 4.2;
    roof.rotation.y = Math.PI / 4;
    roof.castShadow = true;
    ext.add(roof);
    const door = box(1.1, 1.9, 0.18, 0x2e6e66);
    door.position.set(0, 0.95, 2.71);
    ext.add(door);
    // produce crates out front
    for (const [ox, c] of [[-2.2, 0xff9430], [-1.2, 0xd84f4f], [1.4, 0x8fce7a]]) {
      const crate = box(0.8, 0.5, 0.8, 0xa97c50);
      crate.position.set(ox, 0.25, 3.2);
      ext.add(crate);
      for (let i = 0; i < 3; i++) {
        const p = new THREE.Mesh(new THREE.IcosahedronGeometry(0.16, 0), mat(c, 0.6));
        p.position.set(ox + (i - 1) * 0.22, 0.58, 3.2);
        ext.add(p);
      }
    }
    ext.position.set(gSpot.x, gy, gSpot.z);
    ext.traverse((o) => { if (o.isMesh && !o.material.transparent) o.castShadow = true; });
    group.add(ext);
    zones.addBlocker(gSpot.x, gSpot.z, 4.1);

    // interior
    const roomStart = group.children.length;
    const B = IN.grocery;
    const floor = box(15, 0.4, 11, 0xa97c50);
    floor.position.set(B.x, -0.2, B.z);
    floor.receiveShadow = true;
    group.add(floor);
    for (const [w, h, d, x, y, z] of [
      [15, 4.4, 0.4, B.x, 2.2, B.z - 5.5],
      [0.4, 4.4, 11, B.x - 7.5, 2.2, B.z],
      [0.4, 4.4, 11, B.x + 7.5, 2.2, B.z],
    ]) {
      const wall = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat(0xd8ebe8));
      wall.position.set(x, y, z);
      group.add(wall);
    }
    const counter = box(4.6, 1.1, 1.2, 0x2e6e66);
    counter.position.set(B.x - 2.5, 0.55, B.z - 2.8);
    group.add(counter);
    // produce shelves
    for (const sx of [-6.2, 5.0]) {
      for (const y of [1.2, 2.2]) {
        const shelf = box(2.6, 0.14, 1, 0x8a5a3a);
        shelf.position.set(B.x + sx, y, B.z - 4.8);
        group.add(shelf);
        for (let i = 0; i < 4; i++) {
          const p = new THREE.Mesh(new THREE.IcosahedronGeometry(0.17, 0),
            mat(pick([0xff9430, 0xd84f4f, 0x8fce7a, 0xffd23e]), 0.6));
          p.position.set(B.x + sx - 0.9 + i * 0.6, y + 0.26, B.z - 4.8);
          group.add(p);
        }
      }
    }
    // the soup corner (the "restaurant")
    const pot = new THREE.Mesh(new THREE.CylinderGeometry(0.6, 0.5, 0.7, 9), mat(0x2e2a26, 0.5));
    pot.position.set(B.x + 3.4, 0.9, B.z - 3.4);
    const potStand = box(1.4, 0.55, 1.4, 0x8a5a3a);
    potStand.position.set(B.x + 3.4, 0.27, B.z - 3.4);
    group.add(pot, potStand);
    const steamPuffs = [];
    for (let i = 0; i < 3; i++) {
      const sp = new THREE.Mesh(new THREE.IcosahedronGeometry(0.13, 0),
        new THREE.MeshStandardMaterial({ color: 0xffffff, transparent: true, opacity: 0.5, roughness: 1 }));
      sp.userData.k = i / 3;
      steamPuffs.push(sp);
      group.add(sp);
    }
    updates.push((dt, t) => {
      for (const sp of steamPuffs) {
        sp.userData.k = (sp.userData.k + dt * 0.4) % 1;
        const k = sp.userData.k;
        sp.position.set(B.x + 3.4 + Math.sin(t + k * 7) * 0.1, 1.35 + k * 1.1, B.z - 3.4);
        sp.material.opacity = 0.5 * (1 - k);
        sp.scale.setScalar(0.6 + k);
      }
    });
    for (const a of [0.6, 2.2]) {
      const stool = new THREE.Mesh(new THREE.CylinderGeometry(0.34, 0.4, 0.62, 7), mat(0xa97c50));
      stool.position.set(B.x + 3.4 + Math.cos(a) * 1.6, 0.31, B.z - 3.4 + Math.sin(a) * 1.6 + 1.2);
      group.add(stool);
    }

    const barnStool = new THREE.Mesh(new THREE.CylinderGeometry(0.45, 0.5, 0.6, 7), mat(0x1d4a44));
    barnStool.position.set(B.x - 2.5, 0.3, B.z - 3.9);
    group.add(barnStool);
    const barnaby = buildAnimal('lobster', { body: 0xd84f4f });
    barnaby.position.set(B.x - 2.5, 0.6, B.z - 3.9);
    group.add(barnaby);
    wireBob(barnaby, updates);

    const room = collectInteriorRoot(group, roomStart);
    zones.registerInterior('grocery', {
      root: room,
      floorY: 0,
      bounds: { x0: B.x - 7.1, x1: B.x + 7.1, z0: B.z - 4.4, z1: B.z + 5.1 },
      blockers: [
        { x: B.x - 2.5, z: B.z - 2.8, r: 1.5 },
        { x: B.x + 3.4, z: B.z - 3.4, r: 1.2 },
      ],
      spawn: { x: B.x, z: B.z + 4.4, rotY: Math.PI },
      lighting: {
        bg: 0x1c2422, fog: 0x1c2422, fogNear: 24, fogFar: 58,
        hemiSky: 0xeaf4f0, hemiGround: 0x4a5a52, hemiIntensity: 1.25,
        sunIntensity: 0,
      },
    });
    register({
      pos: new THREE.Vector3(gSpot.x, 0, gSpot.z + 3.4), r: 2.6,
      label: 'enter Barnaby’s Greens & Goods',
      use: () => zones.go('grocery'),
    });
    register({
      pos: new THREE.Vector3(B.x, 0, B.z + 4.9), r: 1.6, zone: 'grocery',
      label: 'step outside',
      use: () => zones.leaveTo({ x: gSpot.x, z: gSpot.z + 4.4, rotY: 0 }),
    });
    register({
      pos: new THREE.Vector3(B.x - 2.5, 0, B.z - 2.8), r: 3, zone: 'grocery',
      label: 'talk to Barnaby',
      use: () => barnabyMenu(),
    });
  }

  // ====================================================== The Listening House
  const cSpot = { x: T.x + 6, z: T.z - 4 };
  {
    const cy = terrainHeight(cSpot.x, cSpot.z);
    const ext = new THREE.Group();
    const nave = box(5.4, 4.4, 7, 0xd8d4c8);
    nave.position.y = 2.2;
    ext.add(nave);
    const roofGeo = new THREE.CylinderGeometry(2.6, 2.6, 7.4, 3, 1, false, Math.PI / 2);
    roofGeo.rotateZ(Math.PI / 2);
    const roof = new THREE.Mesh(roofGeo, mat(0x5a6a80));
    roof.scale.y = 1.1;
    roof.position.y = 5.2;
    roof.rotation.y = Math.PI / 2; // ridge runs along the nave
    roof.castShadow = true;
    ext.add(roof);
    // the belfry: an arch with no bell in it. on purpose.
    const towerA = box(0.5, 2.6, 0.5, 0xd8d4c8);
    towerA.position.set(-0.9, 7.0, 0);
    const towerB = box(0.5, 2.6, 0.5, 0xd8d4c8);
    towerB.position.set(0.9, 7.0, 0);
    const lintel = box(2.4, 0.5, 0.6, 0xd8d4c8);
    lintel.position.set(0, 8.4, 0);
    ext.add(towerA, towerB, lintel);
    // tall door + a strip of colored glass above it
    const door = box(1.3, 2.3, 0.2, 0x4a3a5a);
    door.position.set(0, 1.15, 3.51);
    ext.add(door);
    const glassColors = [0xffd23e, 0x6a9ae0, 0xc77dff];
    glassColors.forEach((c, i) => {
      const pane = new THREE.Mesh(new THREE.PlaneGeometry(0.5, 0.8),
        new THREE.MeshBasicMaterial({ color: c, transparent: true, opacity: 0.85 }));
      pane.position.set((i - 1) * 0.6, 3.1, 3.52);
      ext.add(pane);
    });
    ext.position.set(cSpot.x, cy, cSpot.z);
    ext.traverse((o) => { if (o.isMesh && !o.material.transparent) o.castShadow = true; });
    group.add(ext);
    zones.addBlocker(cSpot.x, cSpot.z, 4.4);

    // interior: long, hushed, lit through colored glass
    const roomStart = group.children.length;
    const B = IN.church;
    const floor = box(12, 0.4, 16, 0xb9c0b9);
    floor.position.set(B.x, -0.2, B.z);
    floor.receiveShadow = true;
    group.add(floor);
    for (const [w, h, d, x, y, z] of [
      [12, 5.4, 0.4, B.x, 2.7, B.z - 8],
      [0.4, 5.4, 16, B.x - 6, 2.7, B.z],
      [0.4, 5.4, 16, B.x + 6, 2.7, B.z],
    ]) {
      const wall = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat(0xcfcabb));
      wall.position.set(x, y, z);
      group.add(wall);
    }

    // the great window: small panes in an arch, amber bell on sea-blue
    const PANES = [
      '  aca  ',
      ' bbabb ',
      'bbaaabb',
      'bbaaabb',
      'baaaaab', // the bell's mouth, flaring wide
    ];
    const paneColor = { a: 0xffd23e, b: 0x5b8bc9, c: 0xc77dff };
    PANES.forEach((row, ri) => {
      [...row].forEach((ch, ci) => {
        if (!paneColor[ch]) return;
        const pane = new THREE.Mesh(new THREE.PlaneGeometry(0.62, 0.62),
          new THREE.MeshBasicMaterial({ color: paneColor[ch], transparent: true, opacity: 0.9 }));
        pane.position.set(B.x - 2.1 + ci * 0.7, 4.3 - ri * 0.7, B.z - 7.78);
        group.add(pane);
      });
    });
    // pews
    for (let r = 0; r < 4; r++) {
      for (const sx of [-2.6, 2.6]) {
        const pew = box(3.6, 0.5, 0.9, 0x8a5a3a);
        pew.position.set(B.x + sx, 0.25, B.z - 2.5 + r * 2.2);
        const back = box(3.6, 0.8, 0.18, 0x8a5a3a);
        back.position.set(B.x + sx, 0.85, B.z - 2.1 + r * 2.2);
        group.add(pew, back);
      }
    }

    // the dais: a cushion, a candle stand, and the empty bell frame
    const dais = new THREE.Mesh(new THREE.CylinderGeometry(2.2, 2.4, 0.3, 10), mat(0xb9c0b9));
    dais.position.set(B.x, 0.15, B.z - 5.6);
    group.add(dais);
    const frameA = box(0.3, 2.2, 0.3, 0x55483a);
    frameA.position.set(B.x - 1.0, 1.4, B.z - 5.8);
    const frameB = box(0.3, 2.2, 0.3, 0x55483a);
    frameB.position.set(B.x + 1.0, 1.4, B.z - 5.8);
    const frameTop = box(2.6, 0.3, 0.3, 0x55483a);
    frameTop.position.set(B.x, 2.6, B.z - 5.8);
    group.add(frameA, frameB, frameTop);
    // (no bell. that's the point.)

    // candles: a few always lit, more appear as visitors light them
    const candleGroup = new THREE.Group();
    group.add(candleGroup);
    function refreshCandles() {
      candleGroup.clear();
      const lit = Math.min(2 + (S.state.flags.candlesLit || 0), 9);
      for (let i = 0; i < 9; i++) {
        const cx = B.x - 3.6 + (i % 3) * 0.4, cz = B.z - 4.6 + Math.floor(i / 3) * 0.4;
        const stick = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.06, 0.3 + (i % 3) * 0.08, 6), mat(0xf6efdc, 0.6));
        stick.position.set(cx, 0.9, cz);
        candleGroup.add(stick);
        if (i < lit) {
          const flame = new THREE.Mesh(new THREE.IcosahedronGeometry(0.05, 0),
            new THREE.MeshBasicMaterial({ color: 0xffd98f }));
          flame.position.set(cx, 1.12 + (i % 3) * 0.04, cz);
          candleGroup.add(flame);
        }
      }
      const stand = box(1.4, 0.8, 1.0, 0x55483a);
      stand.position.set(B.x - 3.2, 0.4, B.z - 4.4);
      candleGroup.add(stand);
    }
    refreshCandles();

    const alder = buildAnimal('heron', { body: 0x8fa3b8 });
    alder.position.set(B.x, 0.15, B.z - 5.2);
    alder.rotation.y = 0;
    group.add(alder);
    wireBob(alder, updates, 0.6);

    const room = collectInteriorRoot(group, roomStart);
    zones.registerInterior('church', {
      root: room,
      floorY: 0,
      bounds: { x0: B.x - 5.6, x1: B.x + 5.6, z0: B.z - 6.6, z1: B.z + 7.6 },
      blockers: [
        { x: B.x, z: B.z - 5.6, r: 1.6 }, // dais
        { x: B.x - 3.2, z: B.z - 4.4, r: 0.9 }, // candles
      ],
      spawn: { x: B.x, z: B.z + 6.8, rotY: Math.PI },
      lighting: {
        bg: 0x1a2030, fog: 0x1a2030, fogNear: 28, fogFar: 70,
        hemiSky: 0xd8e2f0, hemiGround: 0x4a5258, hemiIntensity: 1.05,
        sunIntensity: 0,
      },
    });
    register({
      pos: new THREE.Vector3(cSpot.x, 0, cSpot.z + 4.2), r: 2.6,
      label: 'enter The Listening House',
      use: () => zones.go('church'),
    });
    register({
      pos: new THREE.Vector3(B.x, 0, B.z + 7.2), r: 1.8, zone: 'church',
      label: 'step outside',
      use: () => zones.leaveTo({ x: cSpot.x, z: cSpot.z + 5.2, rotY: 0 }),
    });
    register({
      getPos: () => alder.position, r: 3.2, zone: 'church',
      label: 'talk to Brother Alder',
      use: () => alderMenu(refreshCandles),
    });
    register({
      pos: new THREE.Vector3(B.x + 2.6, 0, B.z - 0.3), r: 2.0, zone: 'church',
      label: 'sit in a pew', priority: 0,
      use: async () => {
        await ui.fadeSwap(() => {});
        ui.say('You sit. The quiet here has texture, like wool. Somewhere in it, very faint, something almost rings. You feel mended in one or two small places.');
      },
    });
  }

  // ====================================================== the public garden
  {
    const G = SITES.garden2;
    const gy = terrainHeight(G.x, G.z);
    // hedge ring with a south gap
    for (let a = 0.4; a < Math.PI * 2 - 0.4; a += 0.32) {
      const hx = G.x + Math.cos(a + Math.PI / 2) * 5.4;
      const hz = G.z + Math.sin(a + Math.PI / 2) * 5.4;
      const hedge = box(1.4, 1.0, 1.0, 0x3f9747);
      hedge.position.set(hx, terrainHeight(hx, hz) + 0.5, hz);
      hedge.rotation.y = a;
      group.add(hedge);
    }
    // flower beds
    for (const [ox, oz] of [[-2.2, -1.6], [2.2, -1.6], [-2.2, 1.8], [2.2, 1.8]]) {
      const bed = box(2.4, 0.25, 1.6, 0x6b4a2e);
      bed.position.set(G.x + ox, gy + 0.12, G.z + oz);
      group.add(bed);
      for (let i = 0; i < 6; i++) {
        const bloom = new THREE.Mesh(new THREE.IcosahedronGeometry(0.11, 0),
          mat(pick([0xff6b81, 0xffd23e, 0xffffff, 0xc77dff]), 0.7));
        bloom.position.set(G.x + ox + rand(-0.9, 0.9), gy + 0.45, G.z + oz + rand(-0.5, 0.5));
        group.add(bloom);
        const stem = new THREE.Mesh(new THREE.CylinderGeometry(0.02, 0.03, 0.25, 4), mat(0x4e9a45));
        stem.position.set(bloom.position.x, gy + 0.3, bloom.position.z);
        group.add(stem);
      }
    }
    // fountain
    const basin = new THREE.Mesh(new THREE.CylinderGeometry(1.3, 1.4, 0.5, 10), mat(0x9aa0a6));
    basin.position.set(G.x, gy + 0.25, G.z);
    const water = new THREE.Mesh(new THREE.CylinderGeometry(1.1, 1.1, 0.1, 10),
      new THREE.MeshStandardMaterial({ color: 0x57c8d8, roughness: 0.2, emissive: 0x1a4a52, emissiveIntensity: 0.3 }));
    water.position.set(G.x, gy + 0.5, G.z);
    const spire = new THREE.Mesh(new THREE.CylinderGeometry(0.1, 0.16, 0.9, 7), mat(0x9aa0a6));
    spire.position.set(G.x, gy + 0.9, G.z);
    group.add(basin, water, spire);
    zones.addBlocker(G.x, G.z, 2.0);
    const drops = [];
    for (let i = 0; i < 8; i++) {
      const d = new THREE.Mesh(new THREE.IcosahedronGeometry(0.05, 0),
        new THREE.MeshBasicMaterial({ color: 0xbfe6f2, transparent: true }));
      d.userData.k = i / 8;
      drops.push(d);
      group.add(d);
    }
    updates.push((dt, t) => {
      for (const d of drops) {
        d.userData.k = (d.userData.k + dt * 0.7) % 1;
        const k = d.userData.k;
        const a = k * Math.PI;
        d.position.set(
          G.x + Math.cos(d.userData.k * 19) * 0.5 * k,
          gy + 1.3 + Math.sin(a) * 0.7 - k * 0.6,
          G.z + Math.sin(d.userData.k * 19) * 0.5 * k
        );
        d.material.opacity = 0.9 * (1 - k * 0.6);
      }
    });
    // bench
    const bench = box(2.0, 0.4, 0.7, 0xa97c50);
    bench.position.set(G.x, gy + 0.35, G.z + 3.6);
    const benchBack = box(2.0, 0.6, 0.15, 0xa97c50);
    benchBack.position.set(G.x, gy + 0.85, G.z + 3.9);
    group.add(bench, benchBack);
    register({
      pos: new THREE.Vector3(G.x, 0, G.z + 3.2), r: 2.0,
      label: 'sit on the garden bench',
      use: () => ui.say('You sit in the public garden. A bee conducts a full inspection of your person and approves. The fountain applauds quietly, forever.'),
    });
  }

  // ====================================================== the Old Singer
  {
    const W = SITES.bones;
    const wy = terrainHeight(W.x, W.z);
    const boneMat = mat(0xe8e4d8, 0.7);
    const skull = new THREE.Mesh(new THREE.IcosahedronGeometry(1.6, 1), boneMat);
    skull.scale.set(1.5, 0.75, 1.0);
    skull.position.set(W.x - 4.2, wy + 0.4, W.z);
    skull.rotation.y = 0.4;
    skull.castShadow = true;
    group.add(skull);
    for (let i = 0; i < 6; i++) {
      const ribR = 2.4 - i * 0.25;
      const rib = new THREE.Mesh(new THREE.TorusGeometry(ribR, 0.13, 6, 10, Math.PI), boneMat);
      rib.position.set(W.x - 1 + i * 1.5, wy + 0.1, W.z);
      rib.rotation.y = Math.PI / 2;
      rib.castShadow = true;
      group.add(rib);
      const vert = new THREE.Mesh(new THREE.IcosahedronGeometry(0.22, 0), boneMat);
      vert.position.set(W.x - 1 + i * 1.5 + 0.75, wy + 0.15, W.z);
      group.add(vert);
    }
    const tailBone = new THREE.Mesh(new THREE.ConeGeometry(0.3, 1.8, 5), boneMat);
    tailBone.rotation.z = -Math.PI / 2;
    tailBone.position.set(W.x + 8.6, wy + 0.2, W.z);
    group.add(tailBone);
    zones.addBlocker(W.x + 2, W.z, 2.2);

    register({
      pos: new THREE.Vector3(W.x - 2.5, 0, W.z + 2.5), r: 2.6,
      label: 'read the weathered plaque',
      use: async () => {
        await ui.say([
          'A plaque of sea-smoothed bronze, set in stone:',
          '“THE OLD SINGER. SHE CARRIED THE BELL’S SONG TO DEEP WATER WHEN THE RINGING STOPPED. THE SEA REMEMBERS THEM BOTH.” —the Listeners',
        ]);
        if (!S.hasFlag('metOldSinger')) {
          S.setFlag('metOldSinger');
          ui.say('The wind moves through the ribs, and for one note — just one — it sounds like a bell.');
        }
      },
    });
  }

  function update(dt, t, playerPos) {
    for (const u of updates) u(dt, t, playerPos);
  }

  return { group, update };
}

function wireBob(npc, updates, speed = 1) {
  const parts = npc.userData.parts;
  const phase = rand(0, Math.PI * 2);
  updates.push((dt, t, playerPos) => {
    parts.body.position.y = parts.bodyY + Math.sin(t * 1.6 * speed + phase) * 0.03;
    parts.head.position.y = parts.headY + Math.sin(t * 1.6 * speed + phase + 0.5) * 0.02;
    if (playerPos) {
      const dx = playerPos.x - npc.position.x;
      const dz = playerPos.z - npc.position.z;
      if (Math.hypot(dx, dz) < 8) {
        npc.rotation.y = turnToward(npc.rotation.y, Math.atan2(dx, dz), dt, 4);
      }
    }
  });
}

// ------------------------------------------------------ Barnaby's menus ----

async function barnabyMenu() {
  if (!S.hasFlag('metBarnaby')) {
    S.setFlag('metBarnaby');
    await ui.say([
      'Well! A face from the home island. Welcome to the Far Isle — population: calmer.',
      'Barnaby. Greens, goods, and the best kelp stew on either side of the strait. Also the only kelp stew. Both records, held proudly.',
    ], { speaker: 'Barnaby', voice: VOICE.barnaby });
  }
  const choice = await ui.ask('What can I get you?', [
    { label: '🌱 Buy seeds & stew', value: 'buy' },
    { label: '🥕 Sell produce (island prices!)', value: 'sell' },
    { label: 'Chat', value: 'chat' },
    { label: 'Leave', value: 'leave' },
  ], { speaker: 'Barnaby', voice: VOICE.barnaby });

  if (choice === 'buy') return barnabyBuy();
  if (choice === 'sell') return barnabySell();
  if (choice === 'chat') {
    await ui.say(BARNABY_CHAT[barnabyChatIdx++ % BARNABY_CHAT.length],
      { speaker: 'Barnaby', voice: VOICE.barnaby });
    return barnabyMenu();
  }
}

async function barnabyBuy() {
  const STEW_PRICE = 30;
  const wares = [
    ...Object.keys(GROWTH).map((id) => ({
      label: `${ITEMS[id].emoji} ${ITEMS[id].name}`, value: id,
      hint: `${ITEMS[id].price}🔘`, disabled: S.state.buttons < ITEMS[id].price,
    })),
    { label: '🍲 Kelp Stew (eat in)', value: 'stew', hint: `${STEW_PRICE}🔘`, disabled: S.state.buttons < STEW_PRICE },
    { label: 'Back', value: 'back' },
  ];
  const choice = await ui.ask('Seeds travel well. Stew doesn’t travel at all — that’s the charm.', wares,
    { speaker: 'Barnaby', voice: VOICE.barnaby });
  if (choice === 'stew') {
    S.spend(STEW_PRICE);
    S.drinkCoffee(45);
    sip();
    ui.updateHUD();
    ui.toast('Warm to the tips of your ears. <i>A little quicker for 45s!</i>', '🍲');
    await ui.say('Careful, the bowl keeps the heat. Family secret. (The secret is a warm bowl.)',
      { speaker: 'Barnaby', voice: VOICE.barnaby });
    return barnabyMenu();
  }
  if (GROWTH[choice]) {
    S.spend(ITEMS[choice].price);
    S.addItem(choice);
    kaching();
    ui.toast(`Bought <b>${ITEMS[choice].name}</b>.`, ITEMS[choice].emoji);
    ui.updateHUD();
    return barnabyBuy();
  }
  return barnabyMenu();
}

async function barnabySell() {
  const stock = Object.entries(S.state.inv)
    .map(([id, n]) => ({ id, n, item: ITEMS[id] }))
    .filter(({ item }) => item && (item.kind === 'produce' || item.kind === 'fruit'));
  if (!stock.length) {
    await ui.say('Nothing from the garden today? Grow me something orange. Or red. I’m flexible within warm colors.',
      { speaker: 'Barnaby', voice: VOICE.barnaby });
    return barnabyMenu();
  }
  const choices = stock.map(({ id, n, item }) => ({
    label: `${item.emoji} ${item.name} ×${n}`,
    value: id,
    hint: `${Math.round(item.price * 1.5) * n}🔘`,
  }));
  choices.push({ label: 'Done', value: 'done' });
  const choice = await ui.ask('Fresh-grown? I pay island prices — half again over that magpie.', choices,
    { speaker: 'Barnaby', voice: VOICE.barnaby });
  if (choice === 'done') return barnabyMenu();
  const n = S.countItem(choice);
  const total = Math.round(ITEMS[choice].price * 1.5) * n;
  S.removeItem(choice, n);
  S.earn(total);
  kaching();
  ui.toast(`Sold ${n} × <b>${ITEMS[choice].name}</b> for <b>${total}</b> buttons!`, '🔘');
  ui.updateHUD();
  return barnabySell();
}

// ------------------------------------------------- Brother Alder's menus ----

async function alderMenu(refreshCandles) {
  if (!S.hasFlag('metAlder')) {
    S.setFlag('metAlder');
    await ui.say([
      'Welcome, walker. I am Brother Alder, and this is The Listening House.',
      'No service is in progress. No service is ever in progress. We simply keep the quiet warm, in case the bell finds its way home.',
    ], { speaker: 'Brother Alder', voice: VOICE.alder });
  }
  const choice = await ui.ask('How may the quiet help you?', [
    { label: 'Ask about the Listeners', value: 'lore' },
    { label: `🕯️ Light a candle`, value: 'candle', hint: '5🔘', disabled: S.state.buttons < 5 },
    { label: 'Leave', value: 'leave' },
  ], { speaker: 'Brother Alder', voice: VOICE.alder });

  if (choice === 'lore') {
    await ui.say(ALDER_LORE[alderLoreIdx++ % ALDER_LORE.length],
      { speaker: 'Brother Alder', voice: VOICE.alder });
    return alderMenu(refreshCandles);
  }
  if (choice === 'candle') {
    S.spend(5);
    S.state.flags.candlesLit = (S.state.flags.candlesLit || 0) + 1;
    S.save();
    refreshCandles();
    jingle();
    ui.updateHUD();
    await ui.say('You light a small flame for whoever needs one. Somewhere under the sea, something warm notices.',
      { speaker: 'Brother Alder', voice: VOICE.alder });
    return alderMenu(refreshCandles);
  }
}

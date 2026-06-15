// Grove Isle: orange orchards, an old mansion full of old money and small
// grandchildren, hot springs you can actually sit in, geysers with a
// schedule, and the famous interspecies lounge: capybaras, crocodiles,
// and the little birds who work on commission.

import * as THREE from 'three';
import { SITES, ISLAND5, ISLAND5_HAND, WATER_Y, terrainHeight } from './terrain.js';
import * as zones from './zones.js';
import { register } from './interact.js';
import * as ui from './ui.js';
import * as S from './state.js';
import { buildAnimal, animateGait } from './animals.js';
import { jingle, kaching, splash, tone } from './audio.js';
import { rand, pick, turnToward } from './utils.js';
import { addIslandInfo } from './fieldguide.js';
import { glowWindow } from './nightglow.js';

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

const IN_MANOR = { x: 300, z: 1380 };

const MOLEDECAI_CHAT = [
  'Moledecai. Of the Grove Isle Moledecais. There are no other Moledecais. We are very exclusive.',
  'Old money, dear visitor, is simply old patience with compound interest.',
  'The orchards? Planted by my mother, who said fruit trees are the only investment that apologizes for nothing.',
  'My grandchildren are around here somewhere. You will hear them before you see them. You may never see them.',
];

const PEMBERTON_LINES = [
  'Pemberton, sir-or-madam. Butler to the house. The tea is hot, the silver is counted, and the children are, regrettably, fast.',
  'One does not chase the young masters. One positions oneself where they will eventually be.',
  'A penguin in service, yes. The commute from the colony was substantial. The pension is excellent.',
];

const TILLY_LINES = [
  'Oh! Mind the dust — well. There’s no dust. But mind where it would be!',
  'Three little moles, one of me, and the Baron says “let them play.” He’s right, but don’t tell him during working hours.',
  'I polish the portraits daily. The third Baron winks, I’m sure of it. Nobody believes a maid. The WINK is THERE.',
];

export function createIsland5(player) {
  const group = new THREE.Group();
  const updates = [];
  const M = SITES.manor;
  const SP = SITES.springs;
  const OR = SITES.orchard;
  const TREE_STRUCTURE_CLEARANCE = 3;

  function groveRailStop() {
    const toward = ISLAND5_HAND[0];
    const dx = toward.x - ISLAND5.x, dz = toward.z - ISLAND5.z;
    const len = Math.hypot(dx, dz);
    const ux = dx / len, uz = dz / len;
    let t = 4;
    while (terrainHeight(ISLAND5.x + ux * (t + 0.5), ISLAND5.z + uz * (t + 0.5)) >= 0.2) t += 0.5;
    return { x: ISLAND5.x + ux * (t - 2), z: ISLAND5.z + uz * (t - 2) };
  }

  const groveStop = groveRailStop();
  const treeKeepouts = [
    { x: M.x - 6, z: M.z - 2, r: 6.4 + TREE_STRUCTURE_CLEARANCE },
    { x: M.x + 6, z: M.z - 2, r: 6.4 + TREE_STRUCTURE_CLEARANCE },
    { x: M.x, z: M.z + 1.9, r: 4.5 },
    { x: M.x, z: M.z + 6, r: 2.0 + TREE_STRUCTURE_CLEARANCE },
    { ...groveStop, r: 5.2 },
  ];
  const placedTrees = [];
  function clearOfTreeKeepouts(x, z) {
    if (zones.nearBlocker(x, z, TREE_STRUCTURE_CLEARANCE)) return false;
    if (treeKeepouts.some((k) => Math.hypot(x - k.x, z - k.z) < k.r)) return false;
    return !placedTrees.some((p) => Math.hypot(x - p.x, z - p.z) < 2.7);
  }
  function treeSpotNear(x, z, minH = 0.5) {
    for (const [dx, dz] of [
      [0, 0], [2.4, 0], [-2.4, 0], [0, 2.4], [0, -2.4],
      [1.7, 1.7], [-1.7, 1.7], [1.7, -1.7], [-1.7, -1.7],
    ]) {
      const sx = x + dx, sz = z + dz;
      const h = terrainHeight(sx, sz);
      if (h < minH || !clearOfTreeKeepouts(sx, sz)) continue;
      placedTrees.push({ x: sx, z: sz });
      return { x: sx, z: sz, h };
    }
    return null;
  }
  function distToSegment(x, z, a, b) {
    const dx = b.x - a.x, dz = b.z - a.z;
    const l2 = dx * dx + dz * dz || 1;
    const t = Math.max(0, Math.min(1, ((x - a.x) * dx + (z - a.z) * dz) / l2));
    return Math.hypot(x - (a.x + dx * t), z - (a.z + dz * t));
  }
  const groveLineSegments = [
    [{ x: 0, z: 0 }, ISLAND5_HAND[1]],
    [ISLAND5_HAND[1], ISLAND5_HAND[0]],
    [ISLAND5_HAND[0], groveStop],
  ];
  function clearOfGroveLine(x, z) {
    return groveLineSegments.every(([a, b]) => distToSegment(x, z, a, b) > 2.4);
  }

  addIslandInfo({
    key: 'grove',
    mystery: '“Old money out southeast. Orchards, hot water, a baron. They say the train goes there now, which the train confirms.” —heard at the dock',
    name: 'Grove Isle', x: ISLAND5.x, z: ISLAND5.z, r: 34, icon: '🍊',
    blurb: 'Orchards, old money, and hot water. The Moledecai mansion, orange groves, geysered springs you can soak in, and the calmest lounge in the archipelago: capybaras, crocodiles, attendant birds. The Grove Line steams here straight from Notbell.',
    folk: 'Baron Moledecai · Pemberton · Tilly · three small fast grandchildren · the capybaras · the crocodiles · their birds',
  });

  // ------------------------------------------------------- the orchards ----
  const orchardTrees = [];
  for (let row = 0; row < 3; row++) {
    for (let col = 0; col < 4; col++) {
      const spot = treeSpotNear(OR.x - 5.4 + col * 3.6 + (row % 2) * 1.2, OR.z - 4.5 + row * 4.2);
      if (!spot) continue;
      const { x: tx, z: tz, h: ty } = spot;
      const tree = new THREE.Group();
      const trunk = new THREE.Mesh(new THREE.CylinderGeometry(0.24, 0.34, 1.6, 7), mat(0x7a5230));
      trunk.position.y = 0.8;
      tree.add(trunk);
      const crown = new THREE.Mesh(new THREE.IcosahedronGeometry(1.5, 1), mat(0x3f9747));
      crown.position.y = 2.4;
      crown.scale.y = 0.9;
      tree.add(crown);
      const oranges = [];
      for (let f = 0; f < 4; f++) {
        const a = (f / 4) * Math.PI * 2 + rand(-0.3, 0.3);
        const fruit = new THREE.Mesh(new THREE.IcosahedronGeometry(0.17, 0), mat(0xff9430, 0.6));
        fruit.position.set(Math.cos(a) * 1.2, 2.2 + rand(0, 0.6), Math.sin(a) * 1.2);
        tree.add(fruit);
        oranges.push(fruit);
      }
      tree.position.set(tx, ty - 0.05, tz);
      tree.traverse((o) => { if (o.isMesh) o.castShadow = true; });
      group.add(tree);
      const ot = { oranges, regrow: 0 };
      orchardTrees.push(ot);
      register({
        pos: new THREE.Vector3(tx, 0, tz), r: 2.2,
        enabled: () => ot.oranges[0].visible,
        label: 'pick oranges',
        use: () => {
          ot.oranges.forEach((f) => { f.visible = false; });
          ot.regrow = rand(360, 620);
          S.addItem('orange', 3);
          jingle();
          ui.toast('You picked 3 <b>Oranges</b>! <i>Capybara-approved.</i>', '🍊');
          ui.updateHUD();
        },
      });
    }
  }
  updates.push((dt) => {
    for (const ot of orchardTrees) {
      if (!ot.oranges[0].visible) {
        ot.regrow -= dt;
        if (ot.regrow <= 0) ot.oranges.forEach((f) => { f.visible = true; });
      }
    }
  });

  // -------------------------------------------------------- the mansion ----
  const my = terrainHeight(M.x, M.z);
  {
    const ext = new THREE.Group();
    const main = box(11, 5, 7, 0xf0e8d8);
    main.position.y = 2.5;
    ext.add(main);
    for (const sx of [-7.5, 7.5]) {
      const wing = box(4, 3.6, 5.5, 0xe8dcc4);
      wing.position.set(sx, 1.8, 0.5);
      ext.add(wing);
      const wingRoof = new THREE.Mesh(new THREE.ConeGeometry(3.4, 1.6, 4), mat(0x5a6a80));
      wingRoof.position.set(sx, 4.3, 0.5);
      wingRoof.rotation.y = Math.PI / 4;
      wingRoof.castShadow = true;
      ext.add(wingRoof);
    }
    const roofGeo = new THREE.CylinderGeometry(3.2, 3.2, 11.4, 3, 1, false, Math.PI / 2);
    roofGeo.rotateZ(Math.PI / 2);
    const roof = new THREE.Mesh(roofGeo, mat(0x4a5a70));
    roof.scale.y = 0.7;
    roof.position.y = 5.9;
    roof.castShadow = true;
    ext.add(roof);
    for (const sx of [-2.2, 2.2]) {
      const col = new THREE.Mesh(new THREE.CylinderGeometry(0.22, 0.26, 4.4, 7), mat(0xfaf4e8));
      col.position.set(sx, 2.2, 3.7);
      col.castShadow = true;
      ext.add(col);
    }
    const pediment = box(6, 0.5, 1.4, 0xfaf4e8);
    pediment.position.set(0, 4.5, 3.6);
    ext.add(pediment);
    const door = box(1.8, 2.6, 0.2, 0x4a3a2a);
    door.position.set(0, 1.3, 3.55);
    ext.add(door);
    for (const sx of [-4, 4]) {
      for (const wy of [1.8, 3.6]) {
        const win = box(1.1, 1.3, 0.14, 0xbfe6f2);
        win.position.set(sx, wy, 3.55);
        ext.add(win);
      }
    }
    // the back of the house keeps up appearances too
    for (const sx of [-4, -1.3, 1.3, 4]) {
      for (const wy of [1.8, 3.6]) {
        const win = box(1.1, 1.3, 0.14, 0xbfe6f2);
        win.position.set(sx, wy, -3.55);
        ext.add(win);
      }
    }
    for (const sx of [-9.55, 9.55]) {
      const win = box(0.14, 1.2, 1.6, 0xbfe6f2);
      win.position.set(sx, 1.8, 0.5);
      ext.add(win);
    }
    for (const wsx of [-7.5, 7.5]) {
      const win = box(1.0, 1.1, 0.14, 0xbfe6f2);
      win.position.set(wsx, 1.8, -2.2);
      ext.add(win);
    }
    ext.position.set(M.x, my, M.z - 2);
    ext.traverse((o) => {
      if (!o.isMesh) return;
      o.castShadow = true;
      if (o.material.color && o.material.color.getHex() === 0xbfe6f2) glowWindow(o); // every manor window glows
    });
    group.add(ext);
    zones.addBlocker(M.x - 6, M.z - 2, 6.4);
    zones.addBlocker(M.x + 6, M.z - 2, 6.4);

    // gravel court + fountain where the grandchildren orbit
    const court = new THREE.Mesh(new THREE.CylinderGeometry(5, 5, 0.08, 14), mat(0xd9d2c0, 0.95));
    court.position.set(M.x, my + 0.06, M.z + 6);
    group.add(court);
    const fbasin = new THREE.Mesh(new THREE.CylinderGeometry(1.2, 1.3, 0.5, 10), mat(0xb9c0b9));
    fbasin.position.set(M.x, my + 0.25, M.z + 6);
    const fwater = new THREE.Mesh(new THREE.CylinderGeometry(1.0, 1.0, 0.1, 10),
      new THREE.MeshStandardMaterial({ color: 0x57c8d8, roughness: 0.2, emissive: 0x1a4a52, emissiveIntensity: 0.3 }));
    fwater.position.set(M.x, my + 0.5, M.z + 6);
    group.add(fbasin, fwater);
    zones.addBlocker(M.x, M.z + 6, 2.0);

    // the three grandchildren: small, fast, and everywhere on this island.
    // they sprint, they sniff, they vanish into the mansion and reappear —
    // follow one inside and you'll find them lapping the grand hall.
    const doorSpot = { x: M.x, z: M.z + 1.9 };
    const pups = [];
    for (let i = 0; i < 3; i++) {
      const pup = buildAnimal('mole', { body: 0x55483a, head: 0x55483a });
      pup.scale.setScalar(0.5);
      const data = {
        g: pup, mode: 'pause', pauseT: i * 1.5 + 1,
        target: new THREE.Vector3(), speed: rand(2.6, 3.4),
        insideT: 0, chase: 0, phase: (i / 3) * Math.PI * 2,
      };
      pup.position.set(M.x + 2 + i, terrainHeight(M.x + 2 + i, M.z + 6), M.z + 6);
      pups.push(data);
      group.add(pup);

      register({
        getPos: () => pup.position,
        r: 2.6,
        zone: () => (data.mode === 'inside' ? 'manor' : 'island'),
        label: 'play with the mole pup',
        use: () => {
          for (const q of pups) if (q.mode !== 'inside') q.chase = 9;
          ui.toast('The pups change allegiance instantly. You are the parade now.', '😆');
          tone(rand(950, 1250), { dur: 0.07, type: 'triangle', vol: 0.035 });
          tone(rand(1050, 1350), { time: 0.1, dur: 0.07, type: 'triangle', vol: 0.035 });
        },
      });
    }

    function syncPupVisibility(inManor = zones.current() === 'manor') {
      for (const p of pups) p.g.visible = inManor ? p.mode === 'inside' : p.mode !== 'inside';
    }
    const pupZoneGate = {
      set visible(inManor) { syncPupVisibility(inManor); },
    };

    function pickPupTarget(data) {
      // mostly the open isle; sometimes, irresistibly, the front door
      if (rand(0, 1) < 0.16) {
        data.mode = 'toDoor';
        data.target.set(doorSpot.x, 0, doorSpot.z);
        return;
      }
      for (let tries = 0; tries < 12; tries++) {
        const a = rand(0, Math.PI * 2);
        const r = Math.sqrt(rand(0, 1)) * (ISLAND5.r - 3);
        const x = ISLAND5.x + Math.cos(a) * r;
        const z = ISLAND5.z + Math.sin(a) * r;
        if (terrainHeight(x, z) > 0.3 && zones.islandCanWalk(x, z)) {
          data.mode = 'run';
          data.target.set(x, 0, z);
          return;
        }
      }
      data.mode = 'pause';
      data.pauseT = 1;
    }

    let giggleT = 4;
    updates.push((dt, t, playerPos) => {
      giggleT -= dt;
      let anyNear = false;
      for (const data of pups) {
        const g = data.g;
        if (data.chase > 0 && playerPos) {
          // orbiting the visitor is the highest honor a pup can bestow
          data.chase -= dt;
          const a = t * 2.2 + data.phase;
          const x = playerPos.x + Math.cos(a) * 1.8;
          const z = playerPos.z + Math.sin(a) * 1.6;
          const y = data.mode === 'inside' ? 0 : terrainHeight(x, z);
          g.position.set(x, y + Math.abs(Math.sin(a * 4)) * 0.15, z);
          g.rotation.y = a + Math.PI / 2;
          anyNear = true;
          continue;
        }
        if (data.mode === 'inside') {
          // lapping the grand hall, politely avoiding the good table
          data.insideT -= dt;
          const a = t * 1.7 + data.phase;
          const x = IN_MANOR.x - 3 + Math.cos(a) * 3.4;
          const z = IN_MANOR.z + 1 + Math.sin(a) * 2.4;
          g.position.set(x, Math.abs(Math.sin(a * 4)) * 0.14, z);
          g.rotation.y = a + Math.PI / 2;
          if (data.insideT <= 0) {
            data.mode = 'pause';
            data.pauseT = 0.5;
            g.position.set(doorSpot.x + rand(-0.5, 0.5), terrainHeight(doorSpot.x, doorSpot.z), doorSpot.z + rand(0, 0.8));
          }
          continue;
        }
        if (data.mode === 'pause') {
          data.pauseT -= dt;
          if (data.pauseT <= 0) pickPupTarget(data);
          continue;
        }
        // running somewhere very important
        const dx = data.target.x - g.position.x;
        const dz = data.target.z - g.position.z;
        const dist = Math.hypot(dx, dz);
        if (dist < 0.6) {
          if (data.mode === 'toDoor') {
            data.mode = 'inside';
            data.insideT = rand(10, 26);
            g.position.set(IN_MANOR.x - 3, 0, IN_MANOR.z + 3);
          } else {
            data.mode = 'pause';
            data.pauseT = rand(0.6, 2.2); // sniff. consider. depart.
          }
          continue;
        }
        const nx = g.position.x + (dx / dist) * data.speed * dt;
        const nz = g.position.z + (dz / dist) * data.speed * dt;
        if (zones.islandCanWalk(nx, nz)) {
          g.position.set(nx, terrainHeight(nx, nz) + Math.abs(Math.sin(t * 11 + data.phase)) * 0.13, nz);
          g.rotation.y = Math.atan2(dx, dz);
        } else {
          pickPupTarget(data);
        }
        if (playerPos && Math.hypot(playerPos.x - nx, playerPos.z - nz) < 8) anyNear = true;
      }
      if (giggleT <= 0 && anyNear) {
        giggleT = rand(5, 11);
        tone(rand(900, 1200), { dur: 0.07, type: 'triangle', vol: 0.03 });
        tone(rand(1000, 1300), { time: 0.09, dur: 0.07, type: 'triangle', vol: 0.03 });
      }
      syncPupVisibility(); // zone-aware: inside pups show in the manor, outside pups on the isle
    });

    // ------------------------------------------------ the grand hall ----
    const manorStart = group.children.length;
    const B = IN_MANOR;
    const floor = box(20, 0.4, 14, 0x9a7448);
    floor.position.set(B.x, -0.2, B.z);
    floor.receiveShadow = true;
    group.add(floor);
    for (const [w, d, x, z] of [
      [20, 0.4, B.x, B.z - 7], [0.4, 14, B.x - 10, B.z], [0.4, 14, B.x + 10, B.z],
    ]) {
      const wall = new THREE.Mesh(new THREE.BoxGeometry(w, 6, d), mat(0xe4d8c0));
      wall.position.set(x, 3, z);
      group.add(wall);
    }
    const rug = box(7, 0.06, 11, 0x7a3a3a);
    rug.position.set(B.x, 0.06, B.z);
    group.add(rug);
    // chandelier
    const chRing = new THREE.Mesh(new THREE.TorusGeometry(1.2, 0.1, 6, 14), mat(0xd9a440, 0.4));
    chRing.rotation.x = Math.PI / 2;
    chRing.position.set(B.x, 4.6, B.z - 1);
    group.add(chRing);
    for (let i = 0; i < 6; i++) {
      const a = (i / 6) * Math.PI * 2;
      const candle = new THREE.Mesh(new THREE.IcosahedronGeometry(0.09, 0),
        new THREE.MeshBasicMaterial({ color: 0xffd98f }));
      candle.position.set(B.x + Math.cos(a) * 1.2, 4.8, B.z - 1 + Math.sin(a) * 1.2);
      group.add(candle);
    }
    const chLight = new THREE.PointLight(0xffd9a0, 55, 24, 2);
    chLight.position.set(B.x, 4.2, B.z - 1);
    group.add(chLight);
    // fireplace
    const hearth = box(3, 2.4, 0.8, 0x8a8478);
    hearth.position.set(B.x - 9.5, 1.2, B.z - 2);
    group.add(hearth);
    const fire = new THREE.Mesh(new THREE.IcosahedronGeometry(0.4, 0),
      new THREE.MeshBasicMaterial({ color: 0xff8a4c }));
    fire.position.set(B.x - 9.3, 0.7, B.z - 2);
    group.add(fire);
    updates.push((dt, t) => {
      fire.scale.setScalar(0.85 + Math.sin(t * 7) * 0.18);
    });
    // portraits: the Moledecai line, oils on canvas, noses on display
    for (let i = 0; i < 3; i++) {
      const cv = document.createElement('canvas');
      cv.width = 96;
      cv.height = 128;
      const ctx = cv.getContext('2d');
      ctx.fillStyle = ['#3a3226', '#2e3a4a', '#403040'][i];
      ctx.fillRect(0, 0, 96, 128);
      ctx.fillStyle = '#55483a';
      ctx.beginPath();
      ctx.ellipse(48, 64, 26, 34, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#f2a8b8';
      ctx.beginPath();
      ctx.ellipse(48, 76, 7, 9, 0, 0, Math.PI * 2);
      ctx.fill();
      if (i === 2) { // the third Baron, mid-wink (Tilly is right)
        ctx.strokeStyle = '#16140f';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(36, 56);
        ctx.lineTo(44, 58);
        ctx.stroke();
        ctx.fillStyle = '#16140f';
        ctx.beginPath();
        ctx.arc(58, 57, 3, 0, Math.PI * 2);
        ctx.fill();
      } else {
        ctx.fillStyle = '#16140f';
        ctx.beginPath();
        ctx.arc(38, 57, 3, 0, Math.PI * 2);
        ctx.arc(58, 57, 3, 0, Math.PI * 2);
        ctx.fill();
      }
      const tex = new THREE.CanvasTexture(cv);
      tex.colorSpace = THREE.SRGBColorSpace;
      const frame = box(1.5, 2.0, 0.1, 0xd9a440);
      frame.position.set(B.x - 4 + i * 4, 3.4, B.z - 6.78);
      group.add(frame);
      const canvasM = new THREE.Mesh(new THREE.PlaneGeometry(1.25, 1.7),
        new THREE.MeshBasicMaterial({ map: tex }));
      canvasM.position.set(B.x - 4 + i * 4, 3.4, B.z - 6.72);
      group.add(canvasM);
    }
    register({
      pos: new THREE.Vector3(B.x, 0, B.z - 5.5), r: 3.2, zone: 'manor',
      label: 'study the family portraits',
      use: () => ui.say('Three generations of Moledecai noses. The third Baron appears to be winking. The longer you look, the more certain you are. Tilly was right.'),
    });
    // long table
    const table = box(6, 0.2, 1.6, 0x6b4a2e);
    table.position.set(B.x + 3, 1.0, B.z + 2);
    group.add(table);
    for (const [lx, lz] of [[-2.6, -0.6], [2.6, -0.6], [-2.6, 0.6], [2.6, 0.6]]) {
      const leg = box(0.18, 1.0, 0.18, 0x55483a);
      leg.position.set(B.x + 3 + lx, 0.5, B.z + 2 + lz);
      group.add(leg);
    }

    const moledecai = buildAnimal('mole', { body: 0x55483a, head: 0x55483a });
    // the monocle of generational wealth
    const monocle = new THREE.Mesh(new THREE.TorusGeometry(0.11, 0.02, 6, 12),
      new THREE.MeshStandardMaterial({ color: 0xd9a440, roughness: 0.3 }));
    monocle.position.set(0.17, 1.27, 0.72);
    moledecai.add(monocle);
    const ascot = box(0.3, 0.25, 0.12, 0x7a3a3a);
    ascot.position.set(0, 0.95, 0.45);
    moledecai.add(ascot);
    group.add(moledecai);

    const pemberton = buildAnimal('penguin', { body: 0x2e3640, head: 0x2e3640 });
    group.add(pemberton);
    const tray = box(0.5, 0.05, 0.3, 0xd9a440);
    tray.position.set(0.5, 1.05, 0.3);
    pemberton.add(tray);
    const cup = new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.06, 0.1, 7), mat(0xfffaf0, 0.5));
    cup.position.set(0.5, 1.13, 0.3);
    pemberton.add(cup);

    const tilly = buildAnimal('hedgehog', { body: 0xc9a06a, head: 0xc9a06a });
    const apron = box(0.5, 0.55, 0.1, 0xfffaf0);
    apron.position.set(0, 0.6, 0.5);
    tilly.add(apron);
    group.add(tilly);

    // the household keeps its rounds: dignified, ceaseless, indoor-paced
    const STAFF = [
      { g: moledecai, speed: 0.7, wp: [
        [B.x - 7.8, B.z - 1.5], [B.x - 4, B.z - 5], [B.x + 1, B.z - 3],
        [B.x - 2, B.z + 3], [B.x - 7.8, B.z - 1.5]] },
      { g: pemberton, speed: 1.0, wp: [
        [B.x + 7, B.z + 5], [B.x + 3, B.z + 0.2], [B.x - 6, B.z - 0.5],
        [B.x + 1, B.z + 5.5], [B.x + 7, B.z + 5]] },
      { g: tilly, speed: 1.2, wp: [
        [B.x + 6, B.z - 4.5], [B.x - 2, B.z - 5.5], [B.x - 8.5, B.z + 3],
        [B.x + 5, B.z + 2.5], [B.x + 6, B.z - 4.5]] },
    ];
    for (const [si, st] of STAFF.entries()) {
      st.idx = si % st.wp.length;
      st.pauseT = si * 2 + 1;
      st.walk = 0;
      st.g.position.set(st.wp[st.idx][0], 0, st.wp[st.idx][1]);
    }
    updates.push((dt, t, playerPos) => {
      for (const st of STAFF) {
        const g = st.g;
        let walking = false;
        if (st.pauseT > 0) {
          st.pauseT -= dt;
          // paused: attend to the visitor, as breeding requires
          if (playerPos) {
            const dx = playerPos.x - g.position.x;
            const dz = playerPos.z - g.position.z;
            if (Math.hypot(dx, dz) < 6) {
              g.rotation.y = turnToward(g.rotation.y, Math.atan2(dx, dz), dt, 3);
            }
          }
          if (st.pauseT <= 0) st.idx = (st.idx + 1) % st.wp.length;
        } else {
          const [tx2, tz2] = st.wp[st.idx];
          const dx = tx2 - g.position.x;
          const dz = tz2 - g.position.z;
          const dist = Math.hypot(dx, dz);
          if (dist < 0.3) {
            st.pauseT = rand(3, 8);
          } else {
            g.position.x += (dx / dist) * st.speed * dt;
            g.position.z += (dz / dist) * st.speed * dt;
            g.rotation.y = turnToward(g.rotation.y, Math.atan2(dx, dz), dt, 5);
            walking = true;
          }
        }
        st.walk += ((walking ? 1 : 0) - st.walk) * Math.min(1, dt * 8);
        animateGait(g, t, st.walk, 7);
      }
    });

    register({
      pos: new THREE.Vector3(M.x, 0, M.z + 1.9), r: 2.6,
      label: 'ring at Moledecai Manor',
      use: async () => {
        await zones.go('manor');
        if (!S.hasFlag('metManor')) {
          ui.say('Pemberton opens the door before you finish knocking. “The Baron is receiving. The Baron is always receiving. It is his principal hobby.”');
        }
      },
    });
    register({
      pos: new THREE.Vector3(B.x, 0, B.z + 6.8), r: 1.8, zone: 'manor',
      label: 'step outside',
      use: () => zones.leaveTo({ x: M.x, z: M.z + 3.2, rotY: 0 }),
    });

    let mIdx = 0, pIdx = 0, tIdx = 0;
    register({
      getPos: () => moledecai.position, r: 3, zone: 'manor',
      label: 'talk to Baron Moledecai',
      use: async () => {
        if (!S.hasFlag('metManor')) {
          S.setFlag('metManor');
          await ui.say([
            'An elderly mole in a wine-dark ascot turns from the fire, monocle catching the light.',
            '“A visitor! From the bell island, no less. Sit. Or stand. The chairs are ancestral and frankly overrated.”',
            '“Moledecai. The fortune is old, the nose is older. You will want the story eventually. Everyone does.”',
          ], { speaker: 'Baron Moledecai', voice: 280 });
          return;
        }
        const opts = [
          { label: 'Chat', value: 'chat' },
          { label: 'Ask about the fortune', value: 'fortune' },
          { label: 'Leave', value: null },
        ];
        if (S.countItem('lantern_koi') > 0 && !S.hasFlag('koiSold')) {
          opts.splice(2, 0, { label: '🏮 Offer the Lantern Koi', value: 'koi', hint: '800🔘' });
        }
        const choice = await ui.ask('Yes, yes. What is it, what is it.', opts,
          { speaker: 'Baron Moledecai', voice: 280 });
        if (choice === 'chat') {
          ui.say(MOLEDECAI_CHAT[mIdx++ % MOLEDECAI_CHAT.length], { speaker: 'Baron Moledecai', voice: 280 });
        } else if (choice === 'fortune') {
          ui.say([
            'He polishes the monocle, which needs no polishing.',
            '“My grandfather was a salvage diver. THE salvage diver. When the lighthouse bell went down, Old Tansy hired him to bring it back. He dove for forty summers.”',
            '“He never found it. He billed by the hour. We are, as a family, profoundly grateful that the sea keeps its secrets.”',
          ], { speaker: 'Baron Moledecai', voice: 280 });
        } else if (choice === 'koi') {
          S.removeItem('lantern_koi', 1);
          S.earn(800);
          S.setFlag('koiSold');
          kaching();
          ui.updateHUD();
          ui.say([
            '“The glowing koi. For the east-wing pond. My mother kept one; the pond has been dark thirty years.”',
            'He pays without haggling, which from a Moledecai is a love letter.',
            '“The pond will be lit again. Do not tell the grandchildren. Let them find it.”',
          ], { speaker: 'Baron Moledecai', voice: 280 });
        }
      },
    });
    register({
      getPos: () => pemberton.position, r: 2.6, zone: 'manor',
      label: 'talk to Pemberton',
      use: () => ui.say(PEMBERTON_LINES[pIdx++ % PEMBERTON_LINES.length], { speaker: 'Pemberton', voice: 380 }),
    });
    register({
      getPos: () => tilly.position, r: 2.6, zone: 'manor',
      label: 'talk to Tilly',
      use: () => ui.say(TILLY_LINES[tIdx++ % TILLY_LINES.length], { speaker: 'Tilly', voice: 660 }),
    });

    // ---------------- the grand staircase, and what it leads to ----------
    for (let step = 0; step < 5; step++) {
      const tread = box(2.2, 0.3, 0.7, 0x8a5a3a);
      tread.position.set(B.x + 8.6, 0.15 + step * 0.32, B.z - 4.8 + step * 0.62);
      group.add(tread);
    }
    const banister = box(0.1, 1.0, 3.4, 0xd9a440);
    banister.position.set(B.x + 7.4, 1.0, B.z - 3.4);
    group.add(banister);
    register({
      pos: new THREE.Vector3(B.x + 8.4, 0, B.z - 5.4), r: 2.0, zone: 'manor',
      label: 'climb the grand staircase',
      use: () => zones.go('manor_up'),
    });
    // the cellar hatch, by the fireplace where the floor stays warm
    const hatch = box(1.4, 0.1, 1.4, 0x6b4a2e);
    hatch.position.set(B.x - 7.5, 0.07, B.z + 3.5);
    const ring = new THREE.Mesh(new THREE.TorusGeometry(0.16, 0.035, 5, 10), mat(0x55504c, 0.4));
    ring.rotation.x = Math.PI / 2;
    ring.position.set(B.x - 7.5, 0.16, B.z + 3.1);
    group.add(hatch, ring);
    register({
      pos: new THREE.Vector3(B.x - 7.5, 0, B.z + 3.5), r: 1.8, zone: 'manor',
      label: 'descend to the wine cellar',
      use: () => zones.go('cellar'),
    });
    const manorRoom = collectInteriorRoot(group, manorStart);
    zones.registerInterior('manor', {
      root: [manorRoom, pupZoneGate],
      floorY: 0,
      bounds: { x0: B.x - 9.6, x1: B.x + 9.6, z0: B.z - 6.4, z1: B.z + 7.2 },
      blockers: [
        { x: B.x + 3, z: B.z + 2, r: 2.2 },
        { x: B.x - 9.5, z: B.z - 2, r: 1.4 },
      ],
      spawn: { x: B.x, z: B.z + 6.4, rotY: Math.PI },
      lighting: {
        bg: 0x241e16, fog: 0x241e16, fogNear: 28, fogFar: 70,
        hemiSky: 0xf2e2c4, hemiGround: 0x5a4c3a, hemiIntensity: 1.1,
        sunIntensity: 0,
      },
    });

    // ======================= upstairs: the study =========================
    const upstairsStart = group.children.length;
    const U = { x: 300, z: 1460 };
    const ufloor = box(16, 0.4, 10, 0x8a6a44);
    ufloor.position.set(U.x, -0.2, U.z);
    ufloor.receiveShadow = true;
    group.add(ufloor);
    for (const [w, d, x, z] of [
      [16, 0.4, U.x, U.z - 5], [0.4, 10, U.x - 8, U.z], [0.4, 10, U.x + 8, U.z],
    ]) {
      const wall = new THREE.Mesh(new THREE.BoxGeometry(w, 5, d), mat(0xddd0b8));
      wall.position.set(x, 2.5, z);
      group.add(wall);
    }
    // four-poster bed
    const bedU = box(2.4, 0.6, 3.2, 0x6b4a2e);
    bedU.position.set(U.x - 5.5, 0.3, U.z - 2.6);
    const mattU = box(2.2, 0.3, 3.0, 0xfffaf0);
    mattU.position.set(U.x - 5.5, 0.7, U.z - 2.6);
    group.add(bedU, mattU);
    for (const [px2, pz2] of [[-6.5, -4], [-4.5, -4], [-6.5, -1.2], [-4.5, -1.2]]) {
      const post = box(0.12, 2.6, 0.12, 0x55483a);
      post.position.set(U.x + px2, 1.3, U.z + pz2);
      group.add(post);
    }
    const canopy = box(2.6, 0.1, 3.4, 0x7a3a3a);
    canopy.position.set(U.x - 5.5, 2.6, U.z - 2.6);
    group.add(canopy);
    // desk, telescope, the night window
    const deskU = box(2.4, 1.0, 1.1, 0x6b4a2e);
    deskU.position.set(U.x + 2, 0.5, U.z - 4.1);
    group.add(deskU);
    const winU = new THREE.Mesh(new THREE.PlaneGeometry(2.2, 1.6),
      new THREE.MeshBasicMaterial({ color: 0x1a2a5e }));
    winU.position.set(U.x + 5, 2.6, U.z - 4.78);
    group.add(winU);
    for (let i = 0; i < 6; i++) {
      const star = new THREE.Mesh(new THREE.IcosahedronGeometry(0.025, 0),
        new THREE.MeshBasicMaterial({ color: 0xeef4ff }));
      star.position.set(U.x + 4.2 + (i % 3) * 0.7, 2.3 + Math.floor(i / 3) * 0.7, U.z - 4.77);
      group.add(star);
    }
    const scope = new THREE.Group();
    const tube = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.16, 1.2, 8), mat(0xd9a440, 0.4));
    tube.rotation.x = -0.7;
    tube.position.y = 1.3;
    scope.add(tube);
    for (const lx of [-0.25, 0.25]) {
      const leg = box(0.06, 1.1, 0.06, 0x55483a);
      leg.position.set(lx, 0.55, 0.1);
      leg.rotation.z = lx * 0.5;
      scope.add(leg);
    }
    scope.position.set(U.x + 5, 0, U.z - 3.4);
    group.add(scope);
    register({
      pos: new THREE.Vector3(U.x + 5, 0, U.z - 3), r: 1.8, zone: 'manor_up',
      label: 'look through the telescope',
      use: () => ui.say('It is aimed at the volcano, who is asleep. A note taped to the tube: “SHE SMOKED AT 3 A.M., TUESDAY. NOBODY BELIEVES ME. —M.”'),
    });
    // THE crooked portrait, and what it hides
    const portCv = document.createElement('canvas');
    portCv.width = 256;
    portCv.height = 340;
    const portCtx = portCv.getContext('2d');
    const oilGround = portCtx.createRadialGradient(126, 116, 18, 128, 176, 240);
    oilGround.addColorStop(0, '#34402e');
    oilGround.addColorStop(0.62, '#241d18');
    oilGround.addColorStop(1, '#100d0b');
    portCtx.fillStyle = oilGround;
    portCtx.fillRect(0, 0, 256, 340);
    portCtx.fillStyle = 'rgba(76, 59, 33, 0.42)';
    portCtx.fillRect(28, 40, 64, 84);
    portCtx.fillStyle = 'rgba(22, 48, 40, 0.5)';
    portCtx.fillRect(160, 54, 48, 116);
    portCtx.lineJoin = 'round';
    portCtx.lineWidth = 18;
    portCtx.strokeStyle = '#9e6d24';
    portCtx.strokeRect(18, 18, 220, 304);
    portCtx.lineWidth = 7;
    portCtx.strokeStyle = '#efc96a';
    portCtx.strokeRect(32, 32, 192, 276);
    const portraitPoly = (pts, color) => {
      portCtx.fillStyle = color;
      portCtx.beginPath();
      portCtx.moveTo(pts[0][0], pts[0][1]);
      for (let i = 1; i < pts.length; i++) portCtx.lineTo(pts[i][0], pts[i][1]);
      portCtx.closePath();
      portCtx.fill();
    };
    portraitPoly([[58, 300], [78, 248], [102, 224], [153, 224], [179, 248], [200, 300], [186, 322], [70, 322]], '#27251f');
    portraitPoly([[78, 248], [105, 224], [128, 254], [102, 288]], '#f0e6d1');
    portraitPoly([[151, 224], [178, 248], [152, 288], [128, 254]], '#d8cbb2');
    portraitPoly([[112, 254], [128, 270], [144, 254], [140, 304], [116, 304]], '#3c3329');
    portraitPoly([[119, 294], [137, 294], [137, 314], [119, 314]], '#76342c');
    portCtx.fillStyle = '#ddb54e';
    portCtx.beginPath();
    portCtx.arc(128, 318, 10, 0, Math.PI * 2);
    portCtx.fill();
    portraitPoly([[76, 118], [88, 88], [113, 68], [148, 70], [174, 92], [188, 126], [184, 170], [164, 206], [130, 225], [94, 212], [70, 174], [66, 138]], '#493b31');
    portraitPoly([[88, 88], [113, 68], [120, 117], [84, 142]], '#5a4b3e');
    portraitPoly([[148, 70], [174, 92], [166, 154], [128, 120]], '#3a2f29');
    portraitPoly([[70, 174], [94, 212], [128, 225], [112, 182]], '#362c27');
    portraitPoly([[166, 154], [184, 170], [164, 206], [132, 184]], '#2f2823');
    portraitPoly([[96, 148], [119, 132], [146, 134], [164, 154], [160, 184], [140, 204], [112, 200], [94, 176]], '#d6b69f');
    portraitPoly([[119, 132], [146, 134], [154, 156], [128, 166], [104, 156]], '#e7c8ad');
    portraitPoly([[112, 178], [128, 166], [145, 178], [136, 194], [119, 194]], '#c9a58f');
    portraitPoly([[121, 160], [136, 160], [128, 169]], '#16120f');
    portCtx.strokeStyle = '#17120f';
    portCtx.lineWidth = 4;
    portCtx.beginPath();
    portCtx.moveTo(97, 126);
    portCtx.lineTo(115, 123);
    portCtx.moveTo(141, 123);
    portCtx.lineTo(159, 126);
    portCtx.stroke();
    portCtx.lineWidth = 3;
    portCtx.strokeStyle = '#d4b04b';
    portCtx.beginPath();
    portCtx.arc(158, 128, 13, 0, Math.PI * 2);
    portCtx.moveTo(168, 137);
    portCtx.lineTo(181, 154);
    portCtx.stroke();
    const portTex = new THREE.CanvasTexture(portCv);
    portTex.colorSpace = THREE.SRGBColorSpace;
    const portGold = mat(0xd9a440);
    const portU = new THREE.Mesh(new THREE.BoxGeometry(1.5, 2.0, 0.1), [
      portGold, portGold, portGold, portGold,
      new THREE.MeshBasicMaterial({ map: portTex }),
      portGold,
    ]);
    portU.castShadow = true;
    portU.receiveShadow = true;
    portU.position.set(U.x - 1.5, 2.6, U.z - 4.72);
    portU.rotation.z = 0.05; // suspiciously crooked
    group.add(portU);
    const safeBox = box(1.1, 1.1, 0.4, 0x4a4f55);
    safeBox.position.set(U.x - 1.5, 2.5, U.z - 4.86);
    safeBox.visible = false;
    const dial = new THREE.Mesh(new THREE.CylinderGeometry(0.14, 0.14, 0.1, 10), mat(0xd9a440, 0.3));
    dial.rotation.x = Math.PI / 2;
    dial.position.set(U.x - 1.5, 2.5, U.z - 4.6);
    dial.visible = false;
    group.add(safeBox, dial);
    register({
      pos: new THREE.Vector3(U.x - 1.5, 0, U.z - 3.9), r: 2.0, zone: 'manor_up',
      label: () => (S.hasFlag('foundSafe') ? 'open the family safe' : 'straighten the crooked portrait'),
      use: async () => {
        if (!S.hasFlag('foundSafe')) {
          S.setFlag('foundSafe');
          portU.rotation.z = 0;
          portU.position.x = U.x - 3.2;
          safeBox.visible = true;
          dial.visible = true;
          await ui.say([
            'You straighten the portrait. It swings aside entirely, with the ease of a portrait that gets straightened a lot.',
            'Behind it: a wall safe, dial gleaming. A small card reads: “COMBINATION: IT WAS NEVER LOCKED. NOBODY CHECKS.”',
          ]);
          return;
        }
        if (!S.hasFlag('safeOpened')) {
          S.setFlag('safeOpened');
          S.addItem('first_invoice');
          S.earn(300);
          jingle();
          kaching();
          ui.updateHUD();
          await ui.say([
            'The handle turns. Inside: buttons. Drifts of them, generations deep — and, framed in gold, a single yellowed paper.',
            '“INVOICE №1. One (1) summer of diving. Bell: not located. PAID IN FULL.” The founding document.',
            'A note atop the buttons: “FINDER’S TITHE: HELP YOURSELF TO A HANDFUL. SNOOPING SHOULD PAY HONESTLY. —M.”',
          ]);
          ui.toast('You got <b>Invoice №1</b>, and a handful of buttons: <b>+300</b>!', '🧾');
          return;
        }
        ui.say('The safe stands open. The buttons settle, contentedly. The invoice gleams. The dynasty continues.');
      },
    });
    register({
      pos: new THREE.Vector3(U.x, 0, U.z + 4.2), r: 1.8, zone: 'manor_up',
      label: 'descend the staircase',
      use: () => zones.go('manor', { x: B.x + 7.6, z: B.z - 4.4, rotY: Math.PI }),
    });
    const upstairsRoom = collectInteriorRoot(group, upstairsStart);
    zones.registerInterior('manor_up', {
      root: upstairsRoom,
      floorY: 0,
      bounds: { x0: U.x - 7.6, x1: U.x + 7.6, z0: U.z - 4.4, z1: U.z + 4.6 },
      blockers: [{ x: U.x - 5.5, z: U.z - 2.6, r: 1.8 }, { x: U.x + 2, z: U.z - 4.1, r: 1.2 }],
      spawn: { x: U.x, z: U.z + 3.8, rotY: Math.PI },
      lighting: {
        bg: 0x241e16, fog: 0x241e16, fogNear: 26, fogFar: 64,
        hemiSky: 0xf2e2c4, hemiGround: 0x5a4c3a, hemiIntensity: 1.05,
        sunIntensity: 0,
      },
    });

    // ======================= below: the wine cellar =======================
    const cellarStart = group.children.length;
    const C2 = { x: 300, z: 1540 };
    const cfloor = box(14, 0.4, 9, 0x5a5048);
    cfloor.position.set(C2.x, -0.2, C2.z);
    cfloor.receiveShadow = true;
    group.add(cfloor);
    for (const [w, d, x, z] of [
      [14, 0.4, C2.x, C2.z - 4.5], [0.4, 9, C2.x - 7, C2.z], [0.4, 9, C2.x + 7, C2.z],
    ]) {
      const wall = new THREE.Mesh(new THREE.BoxGeometry(w, 4.2, d), mat(0x6e645a));
      wall.position.set(x, 2.1, z);
      group.add(wall);
    }
    // barrels on their sides, racked
    for (let i = 0; i < 4; i++) {
      const barrel = new THREE.Mesh(new THREE.CylinderGeometry(0.7, 0.7, 1.4, 10), mat(0x8a5a3a));
      barrel.rotation.z = Math.PI / 2;
      barrel.position.set(C2.x - 5 + (i % 2) * 1.8, 0.7 + Math.floor(i / 2) * 1.5, C2.z - 3.4);
      barrel.castShadow = true;
      group.add(barrel);
    }
    // bottle racks: a wall of sleeping vintages
    for (let bx2 = 0; bx2 < 8; bx2++) {
      for (let by2 = 0; by2 < 4; by2++) {
        const bottle = new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.07, 0.5, 6),
          mat(by2 === 2 && bx2 === 5 ? 0x9fe8ff : 0x2e4034, 0.3));
        bottle.rotation.x = Math.PI / 2;
        bottle.position.set(C2.x + 2 + bx2 * 0.55, 0.8 + by2 * 0.5, C2.z - 4.1);
        group.add(bottle);
      }
    }
    const candleC = new THREE.Mesh(new THREE.IcosahedronGeometry(0.08, 0),
      new THREE.MeshBasicMaterial({ color: 0xffd98f }));
    candleC.position.set(C2.x, 1.4, C2.z + 1);
    const candleStandC = box(0.5, 1.2, 0.5, 0x55483a);
    candleStandC.position.set(C2.x, 0.6, C2.z + 1);
    group.add(candleC, candleStandC);
    const parmC = new THREE.Mesh(new THREE.CylinderGeometry(0.7, 0.7, 0.4, 12), mat(0xe8c95c, 0.6));
    parmC.position.set(C2.x - 5.5, 0.2, C2.z + 2.5);
    group.add(parmC);
    register({
      pos: new THREE.Vector3(C2.x + 3.5, 0, C2.z - 3), r: 2.6, zone: 'cellar',
      label: 'consult the cellar ledger',
      use: () => ui.say([
        'A ledger in five generations of handwriting. Highlights:',
        '“SQUALL YEAR RED — bottled the autumn the bell went down. Tastes of resolve. DO NOT OPEN until it comes back up.”',
        '“MOONBEAM ’34 — glows faintly. We do not discuss the Moonbeam.”',
        '“TUESDAY WHITE — fine. It’s fine. It’s a Tuesday in a bottle.”',
      ]),
    });
    register({
      pos: new THREE.Vector3(C2.x + 4.7, 0, C2.z - 3), r: 2.2, zone: 'cellar',
      label: 'lift the glowing bottle to the light', priority: 0,
      use: () => ui.say('The Moonbeam ’34. It is, unmistakably, glowing. You put it back exactly where it was and resolve, like five generations before you, not to discuss it.'),
    });
    register({
      pos: new THREE.Vector3(C2.x, 0, C2.z + 3.6), r: 1.8, zone: 'cellar',
      label: 'climb back up to the hall',
      use: () => zones.go('manor', { x: B.x - 7.5, z: B.z + 2.4, rotY: 0 }),
    });
    const cellarRoom = collectInteriorRoot(group, cellarStart);
    zones.registerInterior('cellar', {
      root: cellarRoom,
      floorY: 0,
      bounds: { x0: C2.x - 6.6, x1: C2.x + 6.6, z0: C2.z - 3.6, z1: C2.z + 4.1 },
      blockers: [{ x: C2.x - 5, z: C2.z - 3.4, r: 1.6 }],
      spawn: { x: C2.x, z: C2.z + 3.2, rotY: Math.PI },
      lighting: {
        bg: 0x14100c, fog: 0x14100c, fogNear: 16, fogFar: 44,
        hemiSky: 0xd9b88a, hemiGround: 0x2a2018, hemiIntensity: 0.7,
        sunIntensity: 0,
      },
    });
  }

  // ------------------------------------------------------ the hot springs ----
  const springPools = [];
  const spy = terrainHeight(SP.x, SP.z);
  for (const [ox, oz, r] of [[-2.5, -1, 2.2], [2.2, 1.5, 1.8], [0.2, -3.5, 1.4]]) {
    const px = SP.x + ox, pz = SP.z + oz;
    const py = terrainHeight(px, pz);
    const rim = [];
    for (let i = 0; i < 9; i++) {
      const a = (i / 9) * Math.PI * 2;
      const stone = new THREE.Mesh(new THREE.IcosahedronGeometry(rand(0.3, 0.5), 0), mat(0x9a948a));
      stone.position.set(px + Math.cos(a) * (r + 0.3), py + 0.15, pz + Math.sin(a) * (r + 0.3));
      stone.castShadow = true;
      group.add(stone);
      rim.push(stone);
    }
    const water = new THREE.Mesh(new THREE.CircleGeometry(r, 14),
      new THREE.MeshStandardMaterial({
        color: 0xa8d8d0, transparent: true, opacity: 0.85,
        roughness: 0.1, emissive: 0x2a544c, emissiveIntensity: 0.3,
      }));
    water.rotation.x = -Math.PI / 2;
    water.position.set(px, py + 0.42, pz);
    group.add(water);
    // steam
    const wisps = [];
    for (let k = 0; k < 3; k++) {
      const wisp = new THREE.Mesh(new THREE.IcosahedronGeometry(0.2, 0),
        new THREE.MeshStandardMaterial({ color: 0xffffff, transparent: true, opacity: 0.4, roughness: 1 }));
      wisp.userData.k = k / 3;
      wisps.push(wisp);
      group.add(wisp);
    }
    springPools.push({ x: px, z: pz, r, y: py, wisps });

    register({
      pos: new THREE.Vector3(px, 0, pz), r: r + 1.4,
      label: 'soak in the hot spring',
      use: async () => {
        await ui.fadeSwap(() => {
          // wade in; the water comes up to wherever worries live
          const a = rand(0, Math.PI * 2);
          const sx2 = px + Math.cos(a) * r * 0.3, sz2 = pz + Math.sin(a) * r * 0.3;
          player.group.position.set(sx2, terrainHeight(sx2, sz2), sz2);
        });
        S.drinkCoffee(90);
        ui.say(pick([
          'You lower yourself in. The heat finds each individual muscle and forgives it personally.',
          'Steam, mineral hush, the far-off sigh of a geyser. Your thoughts arrive, look around, and leave without making demands.',
          'A capybara across the pool opens one eye in acknowledgment, then closes it. You have been received.',
        ]));
        ui.toast('Limber and glowy. <i>Faster for 90s!</i>', '♨️');
      },
    });
  }
  updates.push((dt, t) => {
    for (const pool of springPools) {
      for (const wisp of pool.wisps) {
        wisp.userData.k = (wisp.userData.k + dt * 0.25) % 1;
        const k = wisp.userData.k;
        wisp.position.set(
          pool.x + Math.sin(t * 0.6 + k * 9) * pool.r * 0.5,
          pool.y + 0.7 + k * 1.6,
          pool.z + Math.cos(t * 0.5 + k * 7) * pool.r * 0.4);
        wisp.scale.setScalar(0.6 + k * 1.2);
        wisp.material.opacity = 0.35 * (1 - k);
      }
    }
  });

  // the springs sit in orchard country: oranges hang right over the water
  for (let i = 0; i < 5; i++) {
    const a = (i / 5) * Math.PI * 2 + 0.6;
    const spot = treeSpotNear(SP.x + Math.cos(a) * (SP.r + 2.5), SP.z + Math.sin(a) * (SP.r + 2.5));
    if (!spot) continue;
    const { x: tx, z: tz, h: ty } = spot;
    const tree = new THREE.Group();
    const trunk = new THREE.Mesh(new THREE.CylinderGeometry(0.24, 0.34, 1.6, 7), mat(0x7a5230));
    trunk.position.y = 0.8;
    tree.add(trunk);
    const crown = new THREE.Mesh(new THREE.IcosahedronGeometry(1.45, 1), mat(0x3f9747));
    crown.position.y = 2.35;
    tree.add(crown);
    const fruits = [];
    for (let f = 0; f < 5; f++) {
      const fa = (f / 5) * Math.PI * 2 + rand(-0.2, 0.2);
      const fruit = new THREE.Mesh(new THREE.IcosahedronGeometry(0.21, 0), mat(0xff9430, 0.55));
      fruit.position.set(Math.cos(fa) * 1.25, 2.1 + rand(0, 0.7), Math.sin(fa) * 1.25);
      tree.add(fruit);
      fruits.push(fruit);
    }
    tree.position.set(tx, ty - 0.05, tz);
    tree.traverse((o) => { if (o.isMesh) o.castShadow = true; });
    group.add(tree);
    const ot = { oranges: fruits, regrow: 0 };
    orchardTrees.push(ot);
    register({
      pos: new THREE.Vector3(tx, 0, tz), r: 2.3,
      enabled: () => ot.oranges[0].visible,
      label: 'pick oranges',
      use: () => {
        ot.oranges.forEach((f) => { f.visible = false; });
        ot.regrow = rand(360, 620);
        S.addItem('orange', 3);
        jingle();
        ui.foundItem('orange');
        ui.updateHUD();
      },
    });
  }
  // benches for the post-soak glow
  const springBenches = [
    [SP.x - 4.5, SP.z + 4.5, 0.6],
    [SP.x + 4.5, SP.z + 4, -0.7 + Math.PI],
    [SP.x + 0.5, SP.z - 5.5, Math.PI],
  ];
  for (const [bx2, bz2, ry2] of springBenches) {
    const by2 = terrainHeight(bx2, bz2);
    const bench = box(2.0, 0.4, 0.7, 0xa97c50);
    bench.position.set(bx2, by2 + 0.35, bz2);
    bench.rotation.y = ry2;
    const back = box(2.0, 0.6, 0.15, 0xa97c50);
    back.position.set(bx2 - Math.sin(ry2) * 0.32, by2 + 0.85, bz2 - Math.cos(ry2) * 0.32);
    back.rotation.y = ry2;
    group.add(bench, back);
  }
  register({
    pos: new THREE.Vector3(SP.x - 4.5, 0, SP.z + 4.5), r: 2.2,
    label: 'rest on a springs bench', priority: 0,
    use: () => ui.say('You sit, steam-warm and orange-scented. A capybara pads past and nods, one professional to another.'),
  });

  // geysers, on a proud schedule
  for (const [gx, gz] of [[SP.x + 4.5, SP.z - 3.5], [SP.x - 5, SP.z + 3]]) {
    const gy = terrainHeight(gx, gz);
    const nozzle = new THREE.Mesh(new THREE.CylinderGeometry(0.4, 0.7, 0.6, 8), mat(0x9a948a));
    nozzle.position.set(gx, gy + 0.3, gz);
    group.add(nozzle);
    const jet = [];
    for (let k = 0; k < 6; k++) {
      const puff = new THREE.Mesh(new THREE.IcosahedronGeometry(0.25, 0),
        new THREE.MeshStandardMaterial({ color: 0xffffff, transparent: true, opacity: 0, roughness: 1 }));
      jet.push(puff);
      group.add(puff);
    }
    let gTimer = rand(12, 30);
    let erupting = 0;
    updates.push((dt, t, playerPos) => {
      gTimer -= dt;
      if (gTimer <= 0 && erupting <= 0) {
        erupting = 4;
        gTimer = rand(22, 45);
        if (playerPos && Math.hypot(playerPos.x - gx, playerPos.z - gz) < 30) splash();
      }
      if (erupting > 0) {
        erupting -= dt;
        jet.forEach((puff, k) => {
          const kk = ((t * 1.6) + k / 6) % 1;
          puff.position.set(gx + Math.sin(t * 8 + k) * 0.2, gy + 0.6 + kk * 5.5, gz);
          puff.scale.setScalar(0.5 + kk * 1.3);
          puff.material.opacity = (erupting > 1 ? 0.6 : 0.6 * erupting) * (1 - kk * 0.8);
        });
      } else {
        for (const puff of jet) puff.material.opacity = 0;
      }
    });
  }

  // ------------------------------------------- the southern orchards ----
  // the peninsula is orchard country: oranges and peaches, heavy and visible
  const SO = SITES.southOrchard;
  for (let row = 0; row < 4; row++) {
    for (let col = 0; col < 4; col++) {
      const spot = treeSpotNear(SO.x - 7 + col * 4.4 + (row % 2) * 1.6, SO.z - 7 + row * 4.6);
      if (!spot) continue;
      const { x: tx, z: tz, h: ty } = spot;
      const peachy = (row + col) % 2 === 1;
      const tree = new THREE.Group();
      const trunk = new THREE.Mesh(new THREE.CylinderGeometry(0.26, 0.36, 1.7, 7), mat(0x7a5230));
      trunk.position.y = 0.85;
      tree.add(trunk);
      const crown = new THREE.Mesh(new THREE.IcosahedronGeometry(1.6, 1), mat(peachy ? 0x55b055 : 0x3f9747));
      crown.position.y = 2.5;
      crown.scale.y = 0.9;
      tree.add(crown);
      const fruits = [];
      for (let f = 0; f < 6; f++) {
        const a = (f / 6) * Math.PI * 2 + rand(-0.25, 0.25);
        const fruit = new THREE.Mesh(new THREE.IcosahedronGeometry(0.22, 0),
          mat(peachy ? 0xffb38a : 0xff9430, 0.55));
        fruit.position.set(Math.cos(a) * 1.35, 2.15 + rand(0, 0.8), Math.sin(a) * 1.35);
        tree.add(fruit);
        fruits.push(fruit);
      }
      tree.position.set(tx, ty - 0.05, tz);
      tree.traverse((o) => { if (o.isMesh) o.castShadow = true; });
      group.add(tree);
      const ot = { oranges: fruits, regrow: 0 };
      orchardTrees.push(ot);
      const itemId = peachy ? 'peach' : 'orange';
      register({
        pos: new THREE.Vector3(tx, 0, tz), r: 2.3,
        enabled: () => ot.oranges[0].visible,
        label: peachy ? 'pick peaches' : 'pick oranges',
        use: () => {
          ot.oranges.forEach((f) => { f.visible = false; });
          ot.regrow = rand(360, 620);
          S.addItem(itemId, 3);
          jingle();
          ui.foundItem(itemId);
          ui.updateHUD();
        },
      });
    }
  }

  // Panhandle wildflowers stay off the Grove Line and out from under trees.
  const flowerColors = [0xff6b81, 0xffd23e, 0xffffff, 0xc77dff];
  function addFlower(x, z, h) {
    const stem = new THREE.Mesh(new THREE.CylinderGeometry(0.02, 0.03, 0.25, 4), mat(0x4e9a45));
    stem.position.set(x, h + 0.3, z);
    const bloom = new THREE.Mesh(new THREE.IcosahedronGeometry(0.11, 0), mat(pick(flowerColors), 0.7));
    bloom.position.set(x, h + 0.45, z);
    for (const part of [stem, bloom]) {
      part.castShadow = true;
      part.receiveShadow = true;
      group.add(part);
    }
  }
  for (const islet of ISLAND5_HAND) {
    let flowers = 0;
    for (let tries = 0; tries < 80 && flowers < 12; tries++) {
      const a = rand(0, Math.PI * 2);
      const r = Math.sqrt(rand(0, 1)) * (islet.r - 1.2);
      const x = islet.x + Math.cos(a) * r;
      const z = islet.z + Math.sin(a) * r;
      const h = terrainHeight(x, z);
      if (h <= WATER_Y || !clearOfGroveLine(x, z) || zones.nearBlocker(x, z, 1.2)) continue;
      if (placedTrees.some((p) => Math.hypot(x - p.x, z - p.z) < 2.8)) continue;
      addFlower(x, z, h);
      flowers++;
    }
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
      if (Math.hypot(dx, dz) < 7) {
        npc.rotation.y = turnToward(npc.rotation.y, Math.atan2(dx, dz), dt, 4);
      }
    }
  });
}

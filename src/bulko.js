// BULKO. The southern isle. A warehouse, a parking lot nobody can explain,
// a hot dog that costs one and a half buttons and always will, and a
// lobster tank that is Not For Sale because the lobsters live there.

import * as THREE from 'three';
import { ISLAND4, terrainHeight } from './terrain.js';
import * as zones from './zones.js';
import { register } from './interact.js';
import * as ui from './ui.js';
import * as S from './state.js';
import { buildAnimal } from './animals.js';
import { kaching, jingle, sip } from './audio.js';
import { rand, pick, turnToward } from './utils.js';

function mat(color, rough = 0.9) {
  return new THREE.MeshStandardMaterial({ color, flatShading: true, roughness: rough });
}

function box(w, h, d, color) {
  const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat(color));
  m.castShadow = true;
  return m;
}

function textPanel(lines, w, h, bg, fg, fontPx) {
  const cv = document.createElement('canvas');
  cv.width = w;
  cv.height = h;
  const ctx = cv.getContext('2d');
  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, w, h);
  ctx.fillStyle = fg;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  lines.forEach(([text, y, px], i) => {
    let size = px ?? fontPx;
    do {
      ctx.font = `800 ${size}px ui-rounded, "Segoe UI", system-ui, sans-serif`;
      if (ctx.measureText(text).width <= w * 0.9 || size <= 11) break;
      size -= 2;
    } while (true);
    ctx.fillText(text, w / 2, y);
    void i;
  });
  const tex = new THREE.CanvasTexture(cv);
  tex.colorSpace = THREE.SRGBColorSpace;
  return new THREE.MeshBasicMaterial({ map: tex });
}

const IN = { x: 300, z: 1220 };

const TANK_LINES = [
  'A printed card: “NOT FOR SALE.” Below it, handwritten: “STOP ASKING. —management.” Below that, smaller: “(the lobsters)”',
  'Inside: a tiny couch, a tiny lamp, a tiny rug, and a tiny framed print of “The Great Wave.” One lobster is reading. The other appears to be doing a crossword.',
  'You detect a family resemblance to Barnaby. You decide, wisely, to mention this to neither party.',
  'A staff member walks past, sees you looking, and simply shakes their head — not at you. At the situation. At all of it.',
];

export function createBulko(player) {
  const group = new THREE.Group();
  const updates = [];
  const C = ISLAND4;
  const cy = terrainHeight(C.x, C.z);

  // ------------------------------------------------------ the warehouse ----
  const wx = C.x, wz = C.z - 7;
  {
    const ext = new THREE.Group();
    const hull = box(20, 7, 10, 0x9aa0a6);
    hull.position.y = 3.5;
    ext.add(hull);
    const trim = box(20.2, 1.0, 10.2, 0x6e7479);
    trim.position.y = 6.6;
    ext.add(trim);
    // the sign: red, enormous, certain of itself
    const sign = new THREE.Mesh(new THREE.PlaneGeometry(9, 2.2),
      textPanel([['BULKO', 64, 96]], 512, 128, '#c2452c', '#fffaf0'));
    sign.position.set(0, 5.6, 5.11);
    ext.add(sign);
    const doors = box(4.2, 3.2, 0.3, 0x3a4a5c);
    doors.position.set(-3, 1.6, 5.05);
    ext.add(doors);
    const doorSplit = box(0.12, 3.2, 0.34, 0x9aa0a6);
    doorSplit.position.set(-3, 1.6, 5.06);
    ext.add(doorSplit);
    // the staff entrance, on the dock side — which is the side everyone
    // actually arrives from, so it gets a sign too
    const backDoors = box(3.6, 3.0, 0.3, 0x3a4a5c);
    backDoors.position.set(2, 1.5, -5.05);
    ext.add(backDoors);
    const backSign = new THREE.Mesh(new THREE.PlaneGeometry(7.4, 1.35),
      textPanel([['BULKO  ·  STAFF ENTRANCE', 64, 38]], 640, 128, '#c2452c', '#fffaf0'));
    backSign.position.set(0, 5.2, -5.11);
    backSign.rotation.y = Math.PI;
    ext.add(backSign);
    ext.position.set(wx, cy, wz);
    ext.traverse((o) => { if (o.isMesh && !o.material.map) o.castShadow = true; });
    group.add(ext);
    // two circles approximate the long rectangle without sealing the doors
    zones.addBlocker(wx - 5, wz - 0.5, 7);
    zones.addBlocker(wx + 5, wz - 0.5, 7);
    register({
      pos: new THREE.Vector3(wx + 2, 0, wz - 5.8), r: 2.8,
      label: 'enter BULKO (staff entrance)',
      use: async () => {
        await zones.go('bulko');
        if (!S.hasFlag('staffDoor')) {
          S.setFlag('staffDoor');
          ui.say('A handwritten note on the staff door: "EVERYONE USES THIS ONE. THE FRONT IS FOR THE CARS."');
        }
      },
    });
  }

  // ----------------------------------------------------- the parking lot ----
  // Stall lines, carts, and cars. There are no roads on any island.
  const lotZ = C.z + 4;
  for (let i = 0; i < 8; i++) {
    const lx = C.x - 10.5 + i * 3;
    const line = box(0.18, 0.05, 4.4, 0xe8e4d8);
    line.position.set(lx, terrainHeight(lx, lotZ) + 0.06, lotZ);
    group.add(line);
  }
  const carColors = [0xb0453a, 0x5b8bc9, 0xd9c08f, 0x4f8f6a, 0x6e5a8a];
  for (let i = 0; i < 5; i++) {
    if (i === 2) continue; // one empty stall, for mystery
    const carX = C.x - 9 + i * 3;
    const carY = terrainHeight(carX, lotZ);
    const car = new THREE.Group();
    const body = box(2.0, 0.7, 3.4, carColors[i]);
    body.position.y = 0.65;
    car.add(body);
    const cab = box(1.7, 0.6, 1.7, carColors[i]);
    cab.position.set(0, 1.25, -0.2);
    car.add(cab);
    const glass = box(1.72, 0.4, 1.0, 0xbfe6f2);
    glass.position.set(0, 1.3, 0.4);
    car.add(glass);
    for (const [sx, sz] of [[-1, 1.1], [1, 1.1], [-1, -1.1], [1, -1.1]]) {
      const wheel = new THREE.Mesh(new THREE.CylinderGeometry(0.32, 0.32, 0.22, 8), mat(0x2e2a26));
      wheel.rotation.z = Math.PI / 2;
      wheel.position.set(sx * 1.05, 0.32, sz);
      car.add(wheel);
    }
    car.position.set(carX, carY, lotZ);
    car.rotation.y = rand(-0.06, 0.06);
    car.traverse((o) => { if (o.isMesh) o.castShadow = true; });
    group.add(car);
    zones.addBlocker(carX, lotZ, 1.9);
  }
  register({
    pos: new THREE.Vector3(C.x - 3, 0, lotZ + 3), r: 3,
    label: 'wonder about the cars',
    use: () => ui.say([
      'There are no roads on this island. There are no roads on ANY island. There have never been roads.',
      'The cars are here anyway, parked neatly, a little warm, as if recently driven.',
      'A small sign at the lot’s edge reads: “DO NOT WORRY ABOUT IT.”',
    ]),
  });
  // a stray shopping cart, wheels akimbo
  const cart = new THREE.Group();
  const basket = box(0.9, 0.6, 1.2, 0xb8beba);
  basket.position.y = 0.85;
  cart.add(basket);
  for (const [sx, sz] of [[-0.35, 0.5], [0.35, 0.5], [-0.35, -0.5], [0.35, -0.5]]) {
    const cw = new THREE.Mesh(new THREE.CylinderGeometry(0.09, 0.09, 0.06, 6), mat(0x55504c));
    cw.rotation.z = Math.PI / 2;
    cw.position.set(sx, 0.1, sz);
    cart.add(cw);
  }
  cart.position.set(C.x + 7, terrainHeight(C.x + 7, C.z + 7), C.z + 7);
  cart.rotation.y = 2.2; // abandoned mid-thought
  group.add(cart);

  // ---------------------------------------------------------- ferry dock ----
  const dockA = Math.atan2(0 - C.x, 0 - C.z); // pier points home, like all piers
  const dox = Math.sin(dockA), doz = Math.cos(dockA);
  let shoreT = C.r - 6;
  while (terrainHeight(C.x + dox * (shoreT + 0.5), C.z + doz * (shoreT + 0.5)) >= 0.15) shoreT += 0.5;
  const dock = { x: C.x + dox * shoreT, z: C.z + doz * shoreT };
  for (let i = 0; i < 7; i++) {
    const plank = box(2.4, 0.18, 1.0, i % 4 === 2 ? 0x96703f : 0xa97c50);
    plank.position.set(dock.x + dox * (i + 0.5), 0.55, dock.z + doz * (i + 0.5));
    plank.rotation.y = dockA;
    group.add(plank);
  }
  zones.addCrossing({
    contains(x, z) {
      const dx = x - dock.x, dz = z - dock.z;
      const t = dx * dox + dz * doz;
      if (t < -0.5 || t > 7.5) return false;
      return Math.abs(dx * -doz + dz * dox) < 1.25;
    },
    height: () => 0.64,
  });
  const buoy = new THREE.Group();
  const bb = new THREE.Mesh(new THREE.CylinderGeometry(0.4, 0.55, 1.0, 7), mat(0xb0453a));
  bb.position.y = 0.5;
  buoy.add(bb);
  const bt = new THREE.Mesh(new THREE.IcosahedronGeometry(0.22, 0), mat(0xf2cf5b, 0.4));
  bt.position.y = 1.2;
  buoy.add(bt);
  buoy.position.set(dock.x - dox * 2, terrainHeight(dock.x - dox * 2, dock.z - doz * 2), dock.z - doz * 2);
  buoy.traverse((o) => { if (o.isMesh) o.castShadow = true; });
  group.add(buoy);
  // (boats.js wires the ferry stops — this buoy is just the landmark)
  BULKO_DOCK.x = dock.x - dox * 1.5;
  BULKO_DOCK.z = dock.z - doz * 1.5;
  BULKO_DOCK.rotY = dockA + Math.PI;
  BULKO_DOCK.buoyPos = buoy.position;

  // ------------------------------------------------------- the billboard ----
  // on Notbell's south shore, where it can work on everyone's subconscious
  {
    let bz = 20;
    while (terrainHeight(6, bz + 0.6) >= 0.4) bz += 0.6;
    const by = terrainHeight(6, bz - 1.5);
    const bill = new THREE.Group();
    for (const sx of [-2.6, 2.6]) {
      const post = box(0.22, 4.4, 0.22, 0x6b4a2e);
      post.position.set(sx, 2.2, 0);
      bill.add(post);
    }
    const panel = new THREE.Mesh(new THREE.PlaneGeometry(7, 3),
      textPanel([
        ['BULKO', 56, 72],
        ['HOT DOG + FIZZ: STILL 1.5ᵇ', 122, 30],
        ['FERRY DAILY · THE LOBSTERS ARE NOT FOR SALE', 160, 22],
      ], 512, 192, '#c2452c', '#fffaf0'));
    panel.position.set(0, 4.0, 0.13);
    bill.add(panel);
    const backing = box(7.2, 3.2, 0.15, 0x8a5a3a);
    backing.position.set(0, 4.0, 0);
    bill.add(backing);
    bill.position.set(6, by, bz - 1.5);
    bill.rotation.y = Math.PI; // faces inland, into hearts and minds
    bill.traverse((o) => { if (o.isMesh && !o.material.map) o.castShadow = true; });
    group.add(bill);
    zones.addBlocker(6, bz - 1.5, 1.2);
    register({
      pos: new THREE.Vector3(6, 0, bz - 0.2), r: 2.6,
      label: 'read the billboard',
      use: () => ui.say([
        '“BULKO. HOT DOG + FIZZ: STILL 1.5 BUTTONS. FERRY DAILY.”',
        'In the corner, small: “Ad space sold by P. Magpie & Associates. P. Magpie & Associates is one magpie.”',
      ]),
    });
  }

  // -------------------------------------------------------- the interior ----
  const B = IN;
  {
    const floor = box(34, 0.4, 22, 0x8a8f95); // honest concrete
    floor.position.set(B.x, -0.2, B.z);
    floor.receiveShadow = true;
    group.add(floor);
    for (const [w, d, x, z] of [
      [34, 0.4, B.x, B.z - 11], [0.4, 22, B.x - 17, B.z], [0.4, 22, B.x + 17, B.z],
    ]) {
      const wall = new THREE.Mesh(new THREE.BoxGeometry(w, 8, d), mat(0xa8adb3));
      wall.position.set(x, 4, z);
      group.add(wall);
    }
    // fluorescent bars, hovering in the dollhouse way
    for (let i = 0; i < 4; i++) {
      const bar = new THREE.Mesh(new THREE.BoxGeometry(8, 0.12, 0.5),
        new THREE.MeshBasicMaterial({ color: 0xf4f8ff }));
      bar.position.set(B.x - 9 + i * 6, 6.5, B.z - 4);
      group.add(bar);
    }

    // steel racking with bulk mystery pallets
    for (const rackX of [-12, -4, 4, 12]) {
      for (let level = 0; level < 3; level++) {
        const shelf = box(6.5, 0.2, 2.2, 0xd9a440);
        shelf.position.set(B.x + rackX, 1 + level * 1.8, B.z - 7);
        group.add(shelf);
        for (let pIdx = 0; pIdx < 3; pIdx++) {
          const pallet = box(1.7, 1.2, 1.7, pick([0xb8beba, 0xc9b178, 0x8a9aa8, 0xb0a8c9]));
          pallet.position.set(B.x + rackX - 2.2 + pIdx * 2.2, 1.8 + level * 1.8, B.z - 7);
          group.add(pallet);
        }
      }
      const upright = box(0.25, 6, 2.4, 0xe8743a);
      upright.position.set(B.x + rackX - 3.4, 3, B.z - 7);
      const upright2 = box(0.25, 6, 2.4, 0xe8743a);
      upright2.position.set(B.x + rackX + 3.4, 3, B.z - 7);
      group.add(upright, upright2);
    }

    // the parmesan: wheels of it, stacked like the treasure it is
    for (let i = 0; i < 6; i++) {
      const wheel = new THREE.Mesh(new THREE.CylinderGeometry(0.9, 0.9, 0.5, 12), mat(0xe8c95c, 0.6));
      wheel.position.set(B.x - 13 + (i % 2) * 2.1, 0.45 + Math.floor(i / 2) * 0.55, B.z + 2);
      wheel.castShadow = true;
      group.add(wheel);
    }
    register({
      pos: new THREE.Vector3(B.x - 12, 0, B.z + 3.8), r: 2.6, zone: 'bulko',
      label: 'consider the parmesan wheels',
      use: async () => {
        const choice = await ui.ask('Wheels of parmesan, stacked to shoulder height. Each one is the size of a well-fed dog.', [
          { label: '🧀 Buy a wheel', value: 'buy', hint: '300🔘', disabled: S.state.buttons < 300 },
          { label: 'Respect them from here', value: null },
        ]);
        if (choice === 'buy') {
          S.spend(300);
          S.addItem('parm_wheel');
          kaching();
          ui.updateHUD();
          ui.toast('You bought a <b>Bulk Parmesan Wheel</b>. <i>It does not fit in your pockets. You now simply have it.</i>', '🧀');
        }
      },
    });

    // the wall of TVs
    for (let i = 0; i < 8; i++) {
      const tv = box(1.9, 1.2, 0.18, 0x16140f);
      tv.position.set(B.x + 8 + (i % 4) * 2.1, 2 + Math.floor(i / 4) * 1.5, B.z - 10.7);
      group.add(tv);
      const screen = new THREE.Mesh(new THREE.PlaneGeometry(1.7, 1.0),
        new THREE.MeshBasicMaterial({ color: 0x9fdcf7 }));
      screen.position.set(B.x + 8 + (i % 4) * 2.1, 2 + Math.floor(i / 4) * 1.5, B.z - 10.6);
      group.add(screen);
    }
    register({
      pos: new THREE.Vector3(B.x + 11, 0, B.z - 8.5), r: 3, zone: 'bulko',
      label: 'watch the wall of TVs',
      use: () => ui.say('All the screens show the same gentle footage of the sea. All except one, which is just a window. Nobody can tell which, including the staff, including the window.'),
    });

    // display couches, dared to be imagined in your cottage
    for (let i = 0; i < 3; i++) {
      const couch = new THREE.Group();
      const seat = box(2.4, 0.5, 1.0, [0x5b8bc9, 0x8a5a8a, 0x4f8f6a][i]);
      seat.position.y = 0.45;
      couch.add(seat);
      const backC = box(2.4, 0.8, 0.3, [0x5b8bc9, 0x8a5a8a, 0x4f8f6a][i]);
      backC.position.set(0, 0.95, -0.38);
      couch.add(backC);
      for (const sx of [-1.18, 1.18]) {
        const arm = box(0.25, 0.7, 1.0, [0x4a76ac, 0x744a74, 0x417a58][i]);
        arm.position.set(sx, 0.65, 0);
        couch.add(arm);
      }
      couch.position.set(B.x - 1 + i * 3.4, 0, B.z + 5.5);
      couch.traverse((o) => { if (o.isMesh) o.castShadow = true; });
      group.add(couch);
    }
    register({
      pos: new THREE.Vector3(B.x + 2.4, 0, B.z + 4), r: 3, zone: 'bulko',
      label: 'try a display couch',
      use: async () => {
        await ui.fadeSwap(() => {});
        ui.say('You sit on display couch #2. It is somehow both firm and soft. A tag dares you to imagine it in your cottage. You imagine it. The tag knew you would.');
      },
    });

    // the food court: one and a half buttons, since before the bell sank
    const counter = box(4, 1.1, 1.2, 0xc2452c);
    counter.position.set(B.x + 12, 0.55, B.z + 6.5);
    group.add(counter);
    const menuBoard = new THREE.Mesh(new THREE.PlaneGeometry(3.6, 1.2),
      textPanel([['HOT DOG + FIZZ  ·  1.5ᵇ', 64, 40]], 512, 128, '#3a3a3a', '#fffaf0'));
    menuBoard.position.set(B.x + 12, 3, B.z + 7.04);
    menuBoard.rotation.y = Math.PI;
    group.add(menuBoard);
    register({
      pos: new THREE.Vector3(B.x + 12, 0, B.z + 5.6), r: 2.8, zone: 'bulko',
      label: 'order the hot dog combo',
      use: async () => {
        if (S.state.buttons < 2) {
          ui.say('You need two whole buttons. The cashier looks genuinely sorry. The hot dog rotates on, patient as the tide.');
          return;
        }
        S.spend(2);
        S.drinkCoffee(60);
        kaching();
        sip();
        ui.updateHUD();
        if (!S.hasFlag('halfButton')) {
          S.setFlag('halfButton');
          S.addItem('half_button');
          jingle();
          await ui.say([
            'It costs exactly one and a half buttons. You pay two. You receive, in change, half a button.',
            'It is legal tender nowhere. You will treasure it forever.',
          ]);
          ui.toast('You got <b>Half a Button</b>! And a hot dog. <i>Warm and quick for 60s!</i>', '🌭');
        } else {
          ui.toast('Hot dog, fizz, half a button back. The system is eternal. <i>Warm and quick for 60s!</i>', '🌭');
        }
        if (!S.hasFlag('hotdogLore')) {
          S.setFlag('hotdogLore');
          ui.say('A plaque by the till: “THIS PRICE HAS NOT CHANGED SINCE THE SEA HAD A BELL. IT NEVER WILL.” You feel, briefly, like crying at a food court.');
        }
      },
    });

    // THE TANK. fully furnished. not for sale. stop asking.
    const tank = new THREE.Mesh(new THREE.BoxGeometry(5, 3, 2.6),
      new THREE.MeshStandardMaterial({ color: 0x3fb0e8, transparent: true, opacity: 0.4, roughness: 0.15 }));
    tank.position.set(B.x - 12, 1.9, B.z - 1);
    group.add(tank);
    const tankBase = box(5.4, 0.5, 3, 0x55483a);
    tankBase.position.set(B.x - 12, 0.25, B.z - 1);
    group.add(tankBase);
    // the furnishings
    const tinyCouch = box(0.9, 0.35, 0.4, 0xc25b4e);
    tinyCouch.position.set(B.x - 13.2, 0.85, B.z - 1);
    const tinyLamp = new THREE.Mesh(new THREE.IcosahedronGeometry(0.1, 0),
      new THREE.MeshBasicMaterial({ color: 0xffd98f }));
    tinyLamp.position.set(B.x - 12.6, 1.5, B.z - 1.5);
    const tinyLampPost = box(0.05, 0.7, 0.05, 0x55483a);
    tinyLampPost.position.set(B.x - 12.6, 1.05, B.z - 1.5);
    const tinyRug = new THREE.Mesh(new THREE.CylinderGeometry(0.5, 0.5, 0.04, 8), mat(0xd9a440, 0.8));
    tinyRug.position.set(B.x - 12, 0.55, B.z - 0.8);
    const tinyArt = box(0.4, 0.3, 0.04, 0x27408f);
    tinyArt.position.set(B.x - 11, 1.6, B.z - 2.2);
    group.add(tinyCouch, tinyLamp, tinyLampPost, tinyRug, tinyArt);
    // the residents
    const lobsterA = buildAnimal('lobster', { body: 0xd84f4f });
    lobsterA.scale.setScalar(0.4);
    lobsterA.position.set(B.x - 13.2, 0.95, B.z - 1);
    const lobsterB = buildAnimal('lobster', { body: 0xb8453a });
    lobsterB.scale.setScalar(0.4);
    lobsterB.position.set(B.x - 11, 0.6, B.z - 0.6);
    lobsterB.rotation.y = -0.8;
    group.add(lobsterA, lobsterB);
    updates.push((dt, t) => {
      if (zones.current() !== 'bulko') return;
      lobsterA.position.y = 0.95 + Math.sin(t * 1.2) * 0.04;
      lobsterB.position.y = 0.6 + Math.sin(t * 1.4 + 2) * 0.05;
    });
    let tankIdx = 0;
    register({
      pos: new THREE.Vector3(B.x - 12, 0, B.z + 1), r: 2.8, zone: 'bulko',
      label: 'inspect the lobster tank',
      use: () => ui.say(TANK_LINES[tankIdx++ % TANK_LINES.length]),
    });

    // Gus, the greeter. there is a vest. there is a system. respect both.
    const gus = buildAnimal('tortoise', { body: 0x8a9a7a, head: 0x8a9a7a });
    gus.scale.setScalar(1.25);
    const vest = box(0.85, 0.7, 0.95, 0xe8743a);
    vest.position.set(0, 0.62, 0);
    gus.add(vest);
    gus.position.set(B.x - 6.5, 0, B.z + 8);
    group.add(gus);
    updates.push((dt, t, playerPos) => {
      if (zones.current() !== 'bulko' || !playerPos) return;
      const parts = gus.userData.parts;
      parts.body.position.y = parts.bodyY + Math.sin(t * 0.9) * 0.02;
      const dx = playerPos.x - gus.position.x, dz = playerPos.z - gus.position.z;
      if (Math.hypot(dx, dz) < 8) {
        gus.rotation.y = turnToward(gus.rotation.y, Math.atan2(dx, dz), dt, 3);
      }
    });
    register({
      getPos: () => gus.position, r: 3, zone: 'bulko',
      label: 'talk to Gus',
      use: () => {
        if (!S.hasFlag('metGus')) {
          S.setFlag('metGus');
          ui.say([
            'An enormous old tortoise in an orange vest looks at you over imaginary glasses.',
            '“Card?” You have no card. He considers this for a geological moment.',
            '“…You can use the lobsters’ guest pass. They never use it.” He waves you through with tremendous dignity.',
          ], { speaker: 'Gus', voice: 260 });
          return;
        }
        ui.say(pick([
          '“Card? …Right. Guest pass. Go on through.”',
          '“The samples today are: the concept of abundance. One per customer.”',
          '“Forty years on this door. Seen three things I can’t explain. The cars are two of them.”',
        ]), { speaker: 'Gus', voice: 260 });
      },
    });

    zones.registerInterior('bulko', {
      floorY: 0,
      bounds: { x0: B.x - 16.6, x1: B.x + 16.6, z0: B.z - 10.2, z1: B.z + 10.4 },
      blockers: [
        { x: B.x - 12, z: B.z - 7, r: 4 }, { x: B.x - 4, z: B.z - 7, r: 4 },
        { x: B.x + 4, z: B.z - 7, r: 4 }, { x: B.x + 12, z: B.z - 7, r: 4 },
        { x: B.x - 12, z: B.z - 1, r: 3 },   // the tank
        { x: B.x + 12, z: B.z + 6.5, r: 2 }, // food court counter
        { x: B.x + 0.4 + 1.7, z: B.z + 5.5, r: 1 }, // a couch, approximately
      ],
      spawn: { x: B.x - 2, z: B.z + 9.3, rotY: Math.PI },
      lighting: {
        bg: 0x2a2d31, fog: 0x2a2d31, fogNear: 34, fogFar: 90,
        hemiSky: 0xf4f8ff, hemiGround: 0x5a6066, hemiIntensity: 1.45, // fluorescent honesty
        sunIntensity: 0,
      },
    });
    register({
      pos: new THREE.Vector3(wx - 3, 0, wz + 5.6), r: 2.8,
      label: 'enter BULKO',
      use: async () => {
        await zones.go('bulko');
        if (!S.hasFlag('sawBulko')) {
          S.setFlag('sawBulko');
          ui.say('The doors part. The ceiling is a rumor. Somewhere, forklifts sing to one another. Welcome to BULKO.');
        }
      },
    });
    register({
      pos: new THREE.Vector3(B.x - 2, 0, B.z + 9.9), r: 1.8, zone: 'bulko',
      label: 'step outside',
      use: async () => {
        await zones.leaveTo({ x: wx - 3, z: wz + 7.4, rotY: 0 });
        ui.toast('Gus marks your receipt with a tiny sun. No receipt? He marks the air. Tradition is tradition.', '✅');
      },
    });
  }

  function update(dt, t, playerPos) {
    for (const u of updates) u(dt, t, playerPos);
  }

  return { group, update };
}

// filled in by createBulko; boats.js reads it to run the ferry line
export const BULKO_DOCK = { x: 0, z: 0, rotY: 0, buoyPos: null };

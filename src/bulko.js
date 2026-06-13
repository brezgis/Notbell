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
      bar.position.set(B.x - 9 + i * 6, 7.5, B.z - 4);
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

    register({
      pos: new THREE.Vector3(B.x, 0, B.z - 4.6), r: 5, zone: 'bulko',
      label: 'browse the bulk shelves',
      use: () => ui.say(pick([
        'A five-gallon, shelf-stable bucket of macaroni and cheese. The lid reads “FAMILY SIZE.” It does not specify how large a family, nor whether they are meant to eat it or live in it. You respect the ambiguity.',
        'One hundred and forty-four rolls of paper towel, shrink-wrapped into a single cube the size of a refrigerator. You could not lift it. You doubt anyone could. It may be load-bearing.',
        'A jar of pickles requiring both arms and a plan. Forty-eight of them. The brine alone could refloat a small boat. You think, briefly, of Captain Brine. You decide not to mention it to him.',
        'A flat of sixty cans of beans. Only beans. The label is a photograph of the beans. Somewhere, a person is overjoyed by this. You hope, sincerely, to meet them.',
        'A two-kilogram tub labeled “ASSORTED OPTIMISM (GUMMY).” Best before: a date not yet invented. Net weight: more than you have ever personally felt.',
        'The shelves climb up into the fog. Whatever sits on the very top has been there since before the bell went down, and it is fine. It is all fine. It is BULKO.',
      ])),
    });

    // the parmesan: wheels of it, stacked like the treasure it is
    for (let i = 0; i < 6; i++) {
      const wheel = new THREE.Mesh(new THREE.CylinderGeometry(0.9, 0.9, 0.5, 12), mat(0xe8c95c, 0.6));
      wheel.position.set(B.x - 9 + (i % 2) * 2.1, 0.45 + Math.floor(i / 2) * 0.55, B.z + 3.3);
      wheel.castShadow = true;
      group.add(wheel);
    }
    register({
      pos: new THREE.Vector3(B.x - 8, 0, B.z + 4.9), r: 2.6, zone: 'bulko',
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

    // ------------------------------------------------ the milk cooler entrance ----
    // A WIDE Costco-style cold-room entrance: steel frame, strip curtains, a dark
    // cold beyond. Set into the WEST wall, directly across the floor from the
    // lobster tank (now on the east). E enters the 'milkroom' zone (big dairy hall).
    {
      const dx = B.x - 17, dz = B.z + 3, hw = 3.6; // west wall, toward the south end
      const beyond = box(0.1, 3.4, hw * 2, 0x162430); // the cold dark through the strips
      beyond.position.set(dx + 0.05, 1.9, dz);
      group.add(beyond);
      const lintel = box(0.6, 0.6, hw * 2 + 0.9, 0x8d949c);
      lintel.position.set(dx, 3.7, dz);
      group.add(lintel);
      for (const s of [-1, 1]) {
        const post = box(0.6, 3.7, 0.6, 0x8d949c);
        post.position.set(dx, 1.85, dz + s * (hw + 0.35));
        group.add(post);
      }
      // strip curtains, the kind you nose through with a cart
      for (let i = 0; i <= 10; i++) {
        const strip = new THREE.Mesh(new THREE.BoxGeometry(0.06, 3.1, 0.5),
          new THREE.MeshStandardMaterial({ color: 0xcfe8f0, transparent: true, opacity: 0.34, roughness: 0.1, flatShading: true }));
        strip.position.set(dx + 0.3, 1.7, dz - hw + 0.35 + i * ((hw * 2 - 0.7) / 10));
        group.add(strip);
      }
      // cold breath spilling into the aisle
      const leak = new THREE.Mesh(new THREE.BoxGeometry(2.2, 0.5, hw * 2),
        new THREE.MeshBasicMaterial({ color: 0xbfe6f2, transparent: true, opacity: 0.12, depthWrite: false }));
      leak.position.set(dx + 1.1, 0.3, dz);
      group.add(leak);
      const sign = new THREE.Mesh(new THREE.PlaneGeometry(6.4, 1.0),
        textPanel([['❄  THE MILK COOLER  ❄', 64, 40]], 768, 128, '#2f5a6e', '#eaf6fb'));
      sign.position.set(dx + 0.35, 4.5, dz);
      sign.rotation.y = Math.PI / 2; // faces east, into the store
      group.add(sign);
      register({
        pos: new THREE.Vector3(dx + 2.5, 0, dz), r: 3, zone: 'bulko',
        label: 'enter the milk cooler',
        use: async () => {
          await zones.go('milkroom');
          if (!S.hasFlag('sawMilkroom')) {
            S.setFlag('sawMilkroom');
            ui.say('The strip curtains part with a cold sigh. Beyond: a dairy hall the size of a small weather system, and three cows who have clearly been talking about you.');
          }
        },
      });
    }

    // ====================== the milk cooler — a huge, roofless dairy hall ----
    {
      const MC = { x: 440, z: 1220 }; // far east of BULKO, beyond its fog
      const cfloor = box(22, 0.4, 16, 0xdfeaf0);
      cfloor.position.set(MC.x, -0.2, MC.z);
      cfloor.receiveShadow = true;
      group.add(cfloor);
      for (const [w, d, x, z] of [
        [22, 0.4, MC.x, MC.z - 8], [0.4, 16, MC.x - 11, MC.z], [0.4, 16, MC.x + 11, MC.z],
      ]) {
        const wall = new THREE.Mesh(new THREE.BoxGeometry(w, 5.5, d), mat(0xbcd0d8));
        wall.position.set(x, 2.75, z);
        group.add(wall);
      }
      // no roof — the fixed camera looks straight in, dollhouse-style
      // cold air, pooled and blue
      const chill = new THREE.Mesh(new THREE.BoxGeometry(21.6, 5, 15.6),
        new THREE.MeshBasicMaterial({ color: 0xbfe6f2, transparent: true, opacity: 0.09, depthWrite: false }));
      chill.position.set(MC.x, 2.5, MC.z);
      group.add(chill);
      const bigSign = new THREE.Mesh(new THREE.PlaneGeometry(8, 1.4),
        textPanel([['❄  THE MILK COOLER  ❄', 64, 44]], 768, 140, '#2f5a6e', '#eaf6fb'));
      bigSign.position.set(MC.x, 4.2, MC.z - 7.78);
      group.add(bigSign);
      // the carton wall (north), long
      const tops = [0x6b4a2e, 0xe89ab0, 0xd9c08f];
      for (let i = 0; i < 56; i++) {
        const col = i % 14, row = Math.floor(i / 14);
        const cxn = MC.x - 6.5 + col * 1.0, cyn = 0.95 + row * 0.74, czn = MC.z - 7.4;
        const carton = box(0.6, 0.66, 0.6, 0xfbf7ef);
        carton.position.set(cxn, cyn, czn);
        group.add(carton);
        const top = new THREE.Mesh(new THREE.ConeGeometry(0.42, 0.28, 4), mat(tops[(i + row) % 3], 0.7));
        top.rotation.y = Math.PI / 4;
        top.position.set(cxn, cyn + 0.47, czn);
        group.add(top);
      }
      // dairy island cases full of cartons (the Costco aisle)
      const dairyCase = (cx, cz) => {
        const base = box(5.2, 1.0, 2.6, 0xaebfc8);
        base.position.set(cx, 0.5, cz);
        group.add(base);
        const rim = box(5.4, 0.18, 2.8, 0x8da0aa);
        rim.position.set(cx, 1.05, cz);
        group.add(rim);
        for (let i = 0; i < 14; i++) {
          const ccx = cx - 2.1 + (i % 7) * 0.7, ccz = cz - 0.55 + Math.floor(i / 7) * 1.05;
          const carton = box(0.5, 0.7, 0.5, 0xfbf7ef);
          carton.position.set(ccx, 1.45, ccz);
          group.add(carton);
          const ctop = new THREE.Mesh(new THREE.ConeGeometry(0.36, 0.26, 4), mat(tops[i % 3], 0.7));
          ctop.rotation.y = Math.PI / 4;
          ctop.position.set(ccx, 1.88, ccz);
          group.add(ctop);
        }
      };
      dairyCase(MC.x - 5, MC.z - 2);
      dairyCase(MC.x + 5, MC.z - 2);

      // the cows, spread across the hall
      const makeCow = (body, x, z, ry) => {
        const c = buildAnimal('cow', { body, head: body });
        c.scale.setScalar(0.95);
        c.position.set(x, 0, z);
        c.rotation.y = ry;
        c.traverse((o) => { if (o.isMesh) o.castShadow = true; });
        group.add(c);
        return c;
      };
      const cocoa = makeCow(0x6b4a2e, MC.x - 7, MC.z + 2.6, 0.4);
      const sundae = makeCow(0xe6a6bc, MC.x + 7, MC.z + 2.6, -0.4);
      const barley = makeCow(0xece3d0, MC.x, MC.z + 4.6, 0);
      { // Barley's beret, naturally
        const beret = new THREE.Group();
        const disc = new THREE.Mesh(new THREE.CylinderGeometry(0.34, 0.37, 0.12, 10), mat(0x2f3a4a, 0.6));
        beret.add(disc);
        const nub = new THREE.Mesh(new THREE.IcosahedronGeometry(0.06, 0), mat(0x2f3a4a, 0.6));
        nub.position.y = 0.11;
        beret.add(nub);
        beret.position.set(0.05, 1.66, 0.5);
        beret.rotation.z = 0.25;
        barley.add(beret);
      }
      updates.push((dt, t) => {
        if (zones.current() !== 'milkroom') return;
        [cocoa, sundae, barley].forEach((c, i) => {
          const p = c.userData.parts;
          if (p?.body) p.body.position.y = p.bodyY + Math.sin(t * 1.1 + i * 1.7) * 0.018;
          if (p?.head) p.head.position.y = p.headY + Math.sin(t * 1.1 + i * 1.7 + 0.6) * 0.02;
        });
      });

      const COW_LINES = {
        Cocoa: [
          '“Some say chocolate milk is a dessert. I say it is a hug you can pour.”',
          '“I keep it cold. The cold keeps it honest.”',
          '“Barley says oat is the future. I say the past tasted better. We don’t argue. We’re cows.”',
        ],
        Sundae: [
          '“Pink is a great deal of pressure. I carry it well, I think.”',
          '“Everyone wants strawberry in summer. In winter I finally get to think.”',
          '“Cocoa is rich, Barley is complicated. I’m only sweet. Someone has to be.”',
        ],
        Barley: [
          '“The beret came with the personality. Or the personality with the beret. The order is unclear and, frankly, beneath us.”',
          '“Oat: for those who find regular cold a touch mainstream.”',
          '“I don’t produce it, exactly. I curate it.”',
        ],
      };
      const COW_MEET = {
        Cocoa: ['A big brown cow regards you with enormous, gentle calm.',
          '“Chocolate milk isn’t a flavor. It’s a feeling. The feeling is being eight, and it being summer, and nothing being due.”'],
        Sundae: ['A pink cow blinks at you, slow and dreamy.',
          '“I’m strawberry. I don’t make the rules. I barely make the strawberry.”'],
        Barley: ['A cream-colored cow in a small beret considers you over the top of it.',
          '“Mine’s oat. It’s not milk — it’s a beverage. There is a difference. I won’t explain it.”',
          '“I was plant-based before the tank had lobsters.”'],
      };
      const cowReg = (cow, name, voice) => register({
        getPos: () => cow.position, r: 2.6, zone: 'milkroom', label: `talk to ${name}`,
        use: () => {
          const flag = `met${name}`;
          if (!S.hasFlag(flag)) { S.setFlag(flag); ui.say(COW_MEET[name], { speaker: name, voice }); return; }
          ui.say(pick(COW_LINES[name]), { speaker: name, voice });
        },
      });
      cowReg(cocoa, 'Cocoa', 250);
      cowReg(sundae, 'Sundae', 300);
      cowReg(barley, 'Barley', 270);

      register({
        pos: new THREE.Vector3(MC.x, 0, MC.z - 5.5), r: 2.4, zone: 'milkroom',
        label: 'browse the milk wall',
        use: () => ui.say(pick([
          'Cartons to the ceiling, gable-topped, beaded with cold. Top to bottom: chocolate, strawberry, oat, and one labeled simply “?”.',
          'A small sign: “TAKE A CARTON. LEAVE A CARTON. THE COOLER ABIDES.” You take nothing. The cooler abides regardless.',
        ])),
      });
      register({
        pos: new THREE.Vector3(MC.x, 0, MC.z + 7), r: 2.4, zone: 'milkroom',
        label: 'step back into BULKO',
        use: () => zones.go('bulko', { x: B.x - 14, z: B.z + 3, rotY: -Math.PI / 2 }),
      });
      zones.registerInterior('milkroom', {
        floorY: 0,
        bounds: { x0: MC.x - 10.5, x1: MC.x + 10.5, z0: MC.z - 7.6, z1: MC.z + 7.6 },
        blockers: [
          { x: MC.x - 5, z: MC.z - 2, r: 2.5 }, { x: MC.x + 5, z: MC.z - 2, r: 2.5 },
        ],
        spawn: { x: MC.x, z: MC.z + 6.5, rotY: 0 },
        lighting: {
          bg: 0x1a2832, fog: 0x1a2832, fogNear: 22, fogFar: 64,
          hemiSky: 0xdaf0fb, hemiGround: 0x4a5a64, hemiIntensity: 1.25,
          sunIntensity: 0,
        },
      });
    }

    // the wall of TVs — in the lounge now, behind the couches, on a stand with
    // a solid backing board (the screens are just lit panels)
    const tvBase = box(8.8, 1.0, 1.3, 0xe8743a); // shelf orange
    tvBase.position.set(B.x + 2.4, 0.5, B.z + 1.5);
    group.add(tvBase);
    const tvBack = box(8.8, 3.2, 0.2, 0xc2c6ca); // the solid rectangle behind the screens (light grey)
    tvBack.position.set(B.x + 2.4, 2.7, B.z + 1.3);
    group.add(tvBack);
    for (let i = 0; i < 8; i++) {
      const tx = B.x + 2.4 + ((i % 4) - 1.5) * 2.1;
      const ty = 2.0 + Math.floor(i / 4) * 1.5;
      const tv = box(1.9, 1.2, 0.18, 0x16140f);
      tv.position.set(tx, ty, B.z + 1.42);
      group.add(tv);
      const screen = new THREE.Mesh(new THREE.PlaneGeometry(1.7, 1.0),
        new THREE.MeshBasicMaterial({ color: 0x9fdcf7 }));
      screen.position.set(tx, ty, B.z + 1.52);
      group.add(screen);
    }
    register({
      pos: new THREE.Vector3(B.x + 2.4, 0, B.z + 3.8), r: 3, zone: 'bulko',
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
    // the menu board: a solid board on two posts, text facing the customer
    for (const s of [-1, 1]) {
      const menuPost = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.08, 4.9, 6), mat(0x55483a));
      menuPost.position.set(B.x + 12 + s * 2.0, 2.45, B.z + 5.9); // attached to the counter's back edge
      menuPost.castShadow = true;
      group.add(menuPost);
    }
    const menuMat = textPanel([['HOT DOG + FIZZ  ·  1.5ᵇ', 80, 42]], 512, 160, '#2a2a2a', '#fffaf0');
    menuMat.side = THREE.DoubleSide;
    const menuBoard = new THREE.Mesh(new THREE.PlaneGeometry(4.0, 1.5), menuMat);
    menuBoard.position.set(B.x + 12, 3.6, B.z + 5.95);
    group.add(menuBoard);

    // the staff: a frog vendor. makeFrog — same idea as makeCow up in the milk
    // room: build the body, recolor, scale, place. (modeled on the North Isle's
    // very poisonous frog, grown large and gone green-and-yellow.)
    const makeFrog = (body, legColor, x, z, s = 1) => {
      const f = new THREE.Group();
      const fb = new THREE.Mesh(new THREE.IcosahedronGeometry(0.13, 0), mat(body, 0.5));
      fb.scale.set(1, 0.78, 1.2); fb.position.y = 0.1;
      f.add(fb);
      for (const sx of [-1, 1]) {
        const eye = new THREE.Mesh(new THREE.IcosahedronGeometry(0.05, 0), mat(0x222222, 0.3));
        eye.position.set(sx * 0.07, 0.22, 0.08);
        const leg = new THREE.Mesh(new THREE.IcosahedronGeometry(0.05, 0), mat(legColor, 0.5));
        leg.scale.set(1, 0.6, 1.6); leg.position.set(sx * 0.13, 0.04, -0.04);
        f.add(eye, leg);
      }
      f.scale.setScalar(s);
      f.position.set(x, 0, z);
      f.traverse((o) => { if (o.isMesh) o.castShadow = true; });
      group.add(f);
      return f;
    };
    // a stool so he can see, and be seen, over his counter (like Pip's)
    const frogStool = new THREE.Mesh(new THREE.CylinderGeometry(0.5, 0.55, 0.85, 8), mat(0x6b4a2e));
    frogStool.position.set(B.x + 12, 0.42, B.z + 5.4);
    frogStool.castShadow = true;
    group.add(frogStool);
    const frog = makeFrog(0x6ab04a, 0xf0d840, B.x + 12, B.z + 5.4, 6);
    { // the paper hat — a little origami boat (the paper_boat item) — on his head
      const hatHull = new THREE.Mesh(new THREE.ConeGeometry(0.09, 0.07, 4), mat(0xfffaf0, 0.7));
      hatHull.rotation.y = Math.PI / 4; hatHull.scale.set(1.5, 1, 0.7);
      hatHull.position.set(0, 0.28, 0.02);
      const hatSail = new THREE.Mesh(new THREE.ConeGeometry(0.035, 0.06, 4), mat(0xfffaf0, 0.7));
      hatSail.position.set(0, 0.34, 0.02);
      hatHull.castShadow = true; hatSail.castShadow = true;
      frog.add(hatHull, hatSail);
    }
    updates.push((dt, t) => {
      if (zones.current() !== 'bulko') return;
      frog.position.y = 0.6 + Math.abs(Math.sin(t * 1.4)) * 0.1; // a patient little bob, up on his stool
    });
    // the frog IS the hot dog stand — order from him (the half-button is his doing)
    register({
      getPos: () => frog.position, r: 2.8, zone: 'bulko',
      label: 'order from Mortimer',
      use: async () => {
        if (!S.hasFlag('metFrog')) {
          S.setFlag('metFrog');
          await ui.say([
            'A large green-and-yellow frog in a small paper hat regards you with the calm of one who has flipped a great many hot dogs and judged none of them.',
            '“Mortimer,” he says, by way of introduction. “Hot dog?” He is, somehow, already making one. He does not blink. The roller turns; the fizz fizzes; all is well.',
          ], { speaker: 'Mortimer', voice: 320 });
        }
        if (S.state.buttons < 2) {
          ui.say('Mortimer looks genuinely sorry. You are two buttons short, and he is far too dignified to spot you the difference. The hot dog rotates on, patient as the tide.', { speaker: 'Mortimer', voice: 320 });
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
            'It costs exactly one and a half buttons. You pay two. Mortimer returns, in change, half a button — handed over with the gravity of a man passing along a deed.',
            'It is legal tender nowhere. You will treasure it forever. He knew you would.',
          ], { speaker: 'Mortimer', voice: 320 });
          ui.toast('You got <b>Half a Button</b>! And a hot dog. <i>Warm and quick for 60s!</i>', '🌭');
        } else {
          ui.toast('Hot dog, fizz, half a button back. Mortimer nods once. The system is eternal. <i>Warm and quick for 60s!</i>', '🌭');
        }
        if (!S.hasFlag('hotdogLore')) {
          S.setFlag('hotdogLore');
          await ui.say('A plaque by the till, which Mortimer polished this morning: “THIS PRICE HAS NOT CHANGED SINCE THE SEA HAD A BELL. IT NEVER WILL.” You feel, briefly, like crying at a food court.', { speaker: 'Mortimer', voice: 320 });
        }
      },
    });

    // THE TANK. fully furnished. not for sale. stop asking.
    // a group, so it parks as one — the west cold corner, south of the cooler
    // door and just past the parmesan, with room to walk between the two.
    const tankG = new THREE.Group();
    tankG.position.set(B.x - 8, 0, B.z - 3);
    group.add(tankG);
    const tank = new THREE.Mesh(new THREE.BoxGeometry(5, 3, 2.6),
      new THREE.MeshStandardMaterial({ color: 0x3fb0e8, transparent: true, opacity: 0.4, roughness: 0.15 }));
    tank.position.set(0, 1.9, 0);
    tankG.add(tank);
    const tankBase = box(5.4, 0.5, 3, 0x55483a);
    tankBase.position.set(0, 0.25, 0);
    tankG.add(tankBase);
    // the furnishings
    const tinyCouch = box(0.9, 0.35, 0.4, 0xc25b4e);
    tinyCouch.position.set(-1.2, 0.85, 0);
    const tinyLamp = new THREE.Mesh(new THREE.IcosahedronGeometry(0.1, 0),
      new THREE.MeshBasicMaterial({ color: 0xffd98f }));
    tinyLamp.position.set(-0.6, 1.5, -0.5);
    const tinyLampPost = box(0.05, 0.7, 0.05, 0x55483a);
    tinyLampPost.position.set(-0.6, 1.05, -0.5);
    const tinyRug = new THREE.Mesh(new THREE.CylinderGeometry(0.5, 0.5, 0.04, 8), mat(0xd9a440, 0.8));
    tinyRug.position.set(0, 0.55, 0.2);
    const tinyArt = box(0.4, 0.3, 0.04, 0x27408f);
    tinyArt.position.set(1, 1.6, -1.2);
    tankG.add(tinyCouch, tinyLamp, tinyLampPost, tinyRug, tinyArt);
    // the residents
    const lobsterA = buildAnimal('lobster', { body: 0xd84f4f });
    lobsterA.scale.setScalar(0.4);
    lobsterA.position.set(-1.2, 0.95, 0);
    const lobsterB = buildAnimal('lobster', { body: 0xb8453a });
    lobsterB.scale.setScalar(0.4);
    lobsterB.position.set(1, 0.6, 0.4);
    lobsterB.rotation.y = -0.8;
    tankG.add(lobsterA, lobsterB);
    updates.push((dt, t) => {
      if (zones.current() !== 'bulko') return;
      lobsterA.position.y = 0.95 + Math.sin(t * 1.2) * 0.04;
      lobsterB.position.y = 0.6 + Math.sin(t * 1.4 + 2) * 0.05;
    });
    let tankIdx = 0;
    register({
      pos: new THREE.Vector3(B.x - 5, 0, B.z - 3), r: 2.8, zone: 'bulko',
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
        { x: B.x - 8, z: B.z - 3, r: 3 },   // the tank
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

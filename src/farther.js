// Farther Isle — south past the Far Isle, which is the entire joke. A
// campsite on the high ground (two RVs, two tents, one fire that has never
// been allowed to go out), the Farther General under Cypress the pelican,
// and the mangrove flats: trees that waded out to meet the tide halfway
// and liked it there. The tide runs the only clock on the island.

import * as THREE from 'three';
import { SITES, terrainHeight, ISLAND7, ISLAND7_FLATS, WATER_Y } from './terrain.js';
import * as zones from './zones.js';
import { register } from './interact.js';
import * as ui from './ui.js';
import * as S from './state.js';
import { kaching } from './audio.js';
import { buildAnimal, animateGait } from './animals.js';
import { rand, pick, turnToward } from './utils.js';
import { addIslandInfo } from './fieldguide.js';
import { glowWindow } from './nightglow.js';

function mat(color, rough = 0.9) {
  return new THREE.MeshStandardMaterial({ color, flatShading: true, roughness: rough });
}

function box(w, h, d, color) {
  const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat(color));
  m.castShadow = m.receiveShadow = true;
  return m;
}

function collectInteriorRoot(parent, startIndex) {
  const root = new THREE.Group();
  root.add(...parent.children.slice(startIndex));
  parent.add(root);
  return root;
}

const IN_GENERAL = { x: 300, z: 1940 }; // the store interior, off in the elsewhere

const VOICE = { huck: 250, wren: 480, cypress: 300 };

// the ferry calls here — boats.js reads this (create farther before boats)
export const FARTHER_DOCK = { x: 0, z: 0, rotY: 0, buoyPos: null };

const HUCK_CHAT = [
  'Huck. Eleven summers camping here. The tent became an RV, the RV grew an awning. Any year now I expect a porch. That’s how houses happen, friend — nobody builds one on purpose.',
  'The tide comes in, the tide goes out. I keep a chair facing each direction.',
  'Cypress stocks three kinds of beans and won’t say what the third one is. I respect it enormously.',
  'Folks ask when I’m heading home. Home’s where your kettle is. My kettle’s here.',
];

const WREN_CHAT = [
  'Shh — there. On the flats. A heron. He’s been on one leg since Tuesday. Committed. I admire that.',
  'Forty-one birds logged this month. Forty-two if you count reflections, which I do not. Rigor, friend.',
  'Some folks watch birds hoping for rare ones. I watch because somebody should be keeping notes. The sky just DOES things all day, unsupervised.',
  'The mangroves are the best hide on the island. You stand in the water and the birds assume you’re furniture. It’s very restful, being furniture.',
];

const CYPRESS_CHAT = [
  'Welcome to the General. We have it. If we don’t have it, come back Thursday — the tide usually brings one in.',
  'Receipts go in the pouch. Everything goes in the pouch. The pouch is the filing system, and the filing system is full.',
  'Marshmallows are the top seller. Beans are second. The third bean is doing better than expected.',
];

export function createFarther() {
  const group = new THREE.Group();
  const updates = [];       // island zone
  const storeUpdates = [];  // 'general' zone
  const C = SITES.camp;
  const SY = SITES.storeYard;
  const F = ISLAND7_FLATS;

  addIslandInfo({
    key: 'farther',
    name: 'Farther Isle', x: ISLAND7.x, z: ISLAND7.z + 4, r: 30, icon: '🏕️',
    blurb: 'South past the Far Isle, which is the entire joke. A campsite on the high ground, the Farther General, and mangroves that waded out to meet the tide halfway.',
    folk: 'Huck · Wren · Cypress · Stilt (one leg, since Tuesday)',
    mystery: '“Smoke past the Far Isle of an evening. Campfire smoke — the friendly kind. Smelled marshmallows clean across the water. I had to sit down.” —Captain Brine',
  });

  // ======================================================== the campsite ----
  const FIRE = { x: 100, z: 17 };
  const flames = [];
  {
    const fy = terrainHeight(FIRE.x, FIRE.z);
    // stone ring
    for (let i = 0; i < 8; i++) {
      const a = (i / 8) * Math.PI * 2 + rand(-0.1, 0.1);
      const stone = new THREE.Mesh(new THREE.IcosahedronGeometry(0.22 + rand(-0.04, 0.06), 0), mat(0x8a8378));
      stone.position.set(FIRE.x + Math.cos(a) * 0.85, fy + 0.12, FIRE.z + Math.sin(a) * 0.85);
      stone.castShadow = stone.receiveShadow = true;
      group.add(stone);
    }
    // charred logs, leaned the way fires like
    for (const ry of [0.3, 1.4, 2.5]) {
      const log = new THREE.Mesh(new THREE.CylinderGeometry(0.09, 0.11, 1.0, 6), mat(0x4a3a2c));
      log.rotation.z = Math.PI / 2 - 0.35;
      log.rotation.y = ry;
      log.position.set(FIRE.x, fy + 0.22, FIRE.z);
      log.castShadow = true;
      group.add(log);
    }
    // the flames: emissive, no light, gently alive
    for (let i = 0; i < 3; i++) {
      const flame = new THREE.Mesh(new THREE.IcosahedronGeometry(0.16 - i * 0.03, 0),
        new THREE.MeshBasicMaterial({ color: [0xffb347, 0xffd98f, 0xff8c42][i] }));
      flame.position.set(FIRE.x + (i - 1) * 0.12, fy + 0.4 + i * 0.16, FIRE.z + (i % 2) * 0.1);
      flames.push(flame);
      group.add(flame);
    }
    zones.addBlocker(FIRE.x, FIRE.z, 1.0);
    // log benches, two sides
    for (const [bx, bz, ry] of [[FIRE.x - 2.1, FIRE.z + 0.6, 0.5], [FIRE.x + 1.6, FIRE.z + 1.6, -0.7]]) {
      const bench = new THREE.Mesh(new THREE.CylinderGeometry(0.24, 0.26, 2.2, 7), mat(0x8a5a3a));
      bench.rotation.z = Math.PI / 2;
      bench.rotation.y = ry;
      bench.position.set(bx, terrainHeight(bx, bz) + 0.26, bz);
      bench.castShadow = bench.receiveShadow = true;
      group.add(bench);
      zones.addBlocker(bx, bz, 0.7);
    }
    register({
      pos: new THREE.Vector3(FIRE.x, 0, FIRE.z + 1.6), r: 1.9,
      label: 'sit by the fire',
      use: async () => {
        if (!(S.state.inv.marshmallows > 0)) {
          ui.say('The fire crackles generously. It would toast a marshmallow to an heirloom bronze, if a marshmallow were present. The General sells them.');
          return;
        }
        const c = await ui.ask('The fire makes its standing offer.', [
          { label: '🍡 Toast a marshmallow', value: 'toast' },
          { label: 'Just sit', value: null },
        ]);
        if (c === 'toast') {
          await ui.fadeSwap(() => {});
          ui.say('You toast one slowly, turning it the way the tide turns — patient, both sides. It comes out the exact color of a good decision. Somewhere in the bag, another takes its place.');
        } else {
          ui.say('You sit. The fire does the talking. It is a good listener too, somehow, at the same time.');
        }
      },
    });
  }

  // tents: canvas prisms, one lived-in, one politely spare
  function tent(x, z, ry, color) {
    const g = new THREE.Group();
    const y = terrainHeight(x, z);
    const bodyGeo = new THREE.CylinderGeometry(1.15, 1.15, 2.2, 3, 1, false, Math.PI / 2);
    bodyGeo.rotateZ(Math.PI / 2);
    const body = new THREE.Mesh(bodyGeo, mat(color, 0.95));
    body.scale.y = 0.85;
    body.position.y = 0.58;
    g.add(body);
    const dark = new THREE.Mesh(
      new THREE.CylinderGeometry(0.52, 0.52, 0.06, 3, 1, false, Math.PI / 2), mat(0x3a3226));
    dark.rotation.z = Math.PI / 2; // the doorway: a shadow the shape of the tent
    dark.scale.x = 0.85;
    dark.position.set(1.1, 0.45, 0);
    g.add(dark);
    g.rotation.y = ry;
    g.position.set(x, y, z);
    g.traverse((o) => { if (o.isMesh) { o.castShadow = true; o.receiveShadow = true; } });
    group.add(g);
    zones.addBlocker(x, z, 1.3);
  }
  tent(96.5, 20, 0.9, 0xd9c08f);   // Wren's, sun-faded canvas
  tent(97.3, 15.2, -2.4, 0x5b8b7a); // the spare, sea-green

  // RVs: little caravans. one is a residence, one is a holiday from a holiday.
  const rvKnocks = [];
  function caravan(x, z, faceX, faceZ, bodyColor, stripeColor, who) {
    const g = new THREE.Group();
    const y = terrainHeight(x, z);
    const body = box(4.0, 1.9, 2.1, bodyColor);
    body.userData.occlude = true;
    body.position.y = 1.35;
    g.add(body);
    const roofGeo = new THREE.CylinderGeometry(1.15, 1.15, 3.9, 6, 1, false, 0);
    roofGeo.rotateZ(Math.PI / 2);
    const roof = new THREE.Mesh(roofGeo, mat(bodyColor));
    roof.scale.y = 0.42;
    roof.position.y = 2.3;
    roof.castShadow = roof.receiveShadow = true;
    g.add(roof);
    const stripe = box(4.02, 0.3, 2.12, stripeColor);
    stripe.position.y = 1.15;
    g.add(stripe);
    const door = box(0.8, 1.4, 0.1, 0x4a4038);
    door.position.set(-0.9, 1.1, 1.08);
    g.add(door);
    const pane = new THREE.Mesh(new THREE.BoxGeometry(0.85, 0.55, 0.08), mat(0xbfe6f2, 0.4));
    pane.castShadow = false;
    pane.position.set(0.9, 1.6, 1.06);
    g.add(pane);
    glowWindow(pane, { max: 0.5 });
    for (const sx of [-1.3, 1.3]) {
      const wheel = new THREE.Mesh(new THREE.CylinderGeometry(0.34, 0.34, 0.2, 8), mat(0x2e2a26, 0.7));
      wheel.rotation.x = Math.PI / 2;
      wheel.position.set(sx, 0.34, 1.0);
      wheel.castShadow = true;
      g.add(wheel);
      const wheel2 = wheel.clone();
      wheel2.position.z = -1.0;
      g.add(wheel2);
    }
    const hitch = box(0.14, 0.14, 1.1, 0x6b7280);
    hitch.position.set(-2.4, 0.6, 0);
    hitch.rotation.y = Math.PI / 2;
    g.add(hitch);
    const vent = box(0.5, 0.14, 0.5, 0x9aa3ad);
    vent.position.set(0.8, 2.85, 0);
    g.add(vent);
    const rotY = Math.atan2(faceX - x, faceZ - z);
    g.rotation.y = rotY;
    g.position.set(x, y, z);
    group.add(g);
    zones.addBlocker(x, z, 2.3);
    const doorWorld = {
      x: x + Math.sin(rotY + 0.4) * 2.0,
      z: z + Math.cos(rotY + 0.4) * 2.0,
    };
    rvKnocks.push({ ...doorWorld, who });
    return g;
  }
  // Huck's rig, door to the fire; the spare, curtains drawn
  caravan(103.8, 15.4, FIRE.x, FIRE.z, 0xece3d0, 0x3a7d8a, 'huck');
  caravan(104.8, 21.2, FIRE.x, FIRE.z, 0xc9d4c0, 0xb0453a, 'spare');
  register({
    pos: new THREE.Vector3(rvKnocks[0].x, 0, rvKnocks[0].z), r: 1.7,
    label: 'peer into Huck’s RV',
    use: () => ui.say('The awning creaks amiably. Inside: a wall of tide tables, annotated in pencil, some entries just say “yes.” Huck is not in — Huck is by the fire, where Huck is.'),
  });
  register({
    pos: new THREE.Vector3(rvKnocks[1].x, 0, rvKnocks[1].z), r: 1.7,
    label: 'peer into the other RV',
    use: () => ui.say('Checkered curtains, drawn. A sign taped inside the glass: “ON HOLIDAY FROM OUR HOLIDAY. BACK SOON.” The tide has its own opinions about “soon.”'),
  });

  // Huck's camp furniture: two chairs, honestly aimed
  for (const [cx, cz, ry] of [[101.8, 15.9, 2.6], [102.4, 18.8, -2.9]]) {
    const chair = new THREE.Group();
    const seat = box(0.7, 0.12, 0.7, 0xb0453a);
    seat.position.y = 0.45;
    chair.add(seat);
    const back = box(0.7, 0.7, 0.1, 0xb0453a);
    back.position.set(0, 0.8, -0.32);
    chair.add(back);
    for (const [lx, lz] of [[-0.28, 0.28], [0.28, 0.28], [-0.28, -0.28], [0.28, -0.28]]) {
      const leg = box(0.07, 0.45, 0.07, 0x6b7280);
      leg.position.set(lx, 0.22, lz);
      chair.add(leg);
    }
    chair.rotation.y = ry;
    chair.position.set(cx, terrainHeight(cx, cz), cz);
    group.add(chair);
    zones.addBlocker(cx, cz, 0.55);
  }

  // Huck himself, bucket hat, exactly where you'd expect
  const huck = buildAnimal('bear', { body: 0x8a6a48 });
  {
    const hat = new THREE.Group();
    const brim = new THREE.Mesh(new THREE.CylinderGeometry(0.5, 0.56, 0.14, 9), mat(0xa8a084, 0.85));
    hat.add(brim);
    const crown = new THREE.Mesh(new THREE.CylinderGeometry(0.32, 0.36, 0.26, 8), mat(0xa8a084, 0.85));
    crown.position.y = 0.16;
    hat.add(crown);
    hat.position.set(0, 1.62, 0.12);
    huck.add(hat);
    huck.position.set(101.2, terrainHeight(101.2, 18.6), 18.6);
    huck.rotation.y = -2.6; // facing his fire
    group.add(huck);
    register({
      getPos: () => huck.position, r: 2.6,
      label: 'talk to Huck',
      use: () => ui.say(pick(HUCK_CHAT), { speaker: 'Huck', voice: VOICE.huck }),
    });
  }

  // ================================================== the Farther General ----
  const STORE = { x: 112, z: 27 };
  {
    const sy = terrainHeight(STORE.x, STORE.z);
    const ext = new THREE.Group();
    const plinth = box(7.4, 1.3, 6.0, 0x8a8378);
    plinth.position.y = -0.5;
    ext.add(plinth);
    const walls = box(6.8, 2.9, 5.2, 0xd8cbb0);
    walls.userData.occlude = true;
    walls.position.y = 1.45;
    ext.add(walls);
    const roofGeo = new THREE.CylinderGeometry((5.2 + 0.9) / 1.73, (5.2 + 0.9) / 1.73, 7.6, 3, 1, false, Math.PI / 2);
    roofGeo.rotateZ(Math.PI / 2);
    const roof = new THREE.Mesh(roofGeo, mat(0x6b5a48));
    roof.scale.y = 0.5;
    roof.position.y = 2.9;
    roof.castShadow = roof.receiveShadow = true;
    ext.add(roof);
    // the porch: deck, posts, its own little roof — country store, regulation
    const deck = box(6.8, 0.24, 1.8, 0xa97c50);
    deck.position.set(0, 0.12, 3.5);
    ext.add(deck);
    for (const px of [-3.0, 0, 3.0]) {
      const post = box(0.16, 2.3, 0.16, 0x8a5a3a);
      post.position.set(px, 1.3, 4.2);
      ext.add(post);
    }
    const porchRoof = box(7.2, 0.14, 2.4, 0x5c5348);
    porchRoof.position.set(0, 2.5, 3.6);
    porchRoof.rotation.x = 0.1;
    ext.add(porchRoof);
    const door = box(1.1, 1.9, 0.14, 0x4a3a2c);
    door.position.set(-0.8, 0.95 + 0.24, 2.62);
    ext.add(door);
    const paneS = new THREE.Mesh(new THREE.BoxGeometry(1.3, 0.9, 0.08), mat(0xbfe6f2, 0.4));
    paneS.castShadow = false;
    paneS.position.set(1.4, 1.6, 2.62);
    ext.add(paneS);
    glowWindow(paneS, { max: 0.5 });
    // porch goods: a barrel, crates, and an honest bench
    const barrel = new THREE.Mesh(new THREE.CylinderGeometry(0.4, 0.45, 0.9, 8), mat(0x8a5a3a));
    barrel.position.set(2.6, 0.69, 3.4);
    barrel.castShadow = true;
    ext.add(barrel);
    const crate = box(0.7, 0.5, 0.7, 0xa97c50);
    crate.position.set(-2.6, 0.49, 3.4);
    ext.add(crate);
    // the sign hangs from the porch roof, saying where you are
    const sign = signBoard('FARTHER GENERAL', 3.0, 0.7);
    sign.position.set(0, 2.05, 4.35);
    ext.add(sign);
    ext.position.set(STORE.x, sy, STORE.z);
    ext.rotation.y = Math.atan2(C.x - STORE.x, C.z - STORE.z); // porch faces the camp
    group.add(ext);
    zones.addBlocker(STORE.x - 1.6, STORE.z - 0.8, 3.0);
    zones.addBlocker(STORE.x + 1.6, STORE.z - 0.8, 3.0);

    const rotY = ext.rotation.y;
    const doorWorld = {
      x: STORE.x + Math.sin(rotY) * 3.6,
      z: STORE.z + Math.cos(rotY) * 3.6,
    };
    register({
      pos: new THREE.Vector3(doorWorld.x, 0, doorWorld.z), r: 2.2,
      label: 'enter the Farther General',
      use: () => zones.go('general'),
    });

    // ------------------------------------------------------ the interior ----
    const roomStart = group.children.length;
    const B = IN_GENERAL;
    const floor = box(12, 0.4, 10, 0x9a7b5a);
    floor.position.set(B.x, -0.2, B.z);
    group.add(floor);
    for (const [w, h, d, x, y, z] of [
      [12, 3.6, 0.4, B.x, 1.8, B.z - 5],
      [0.4, 3.6, 10, B.x - 6, 1.8, B.z],
      [0.4, 3.6, 10, B.x + 6, 1.8, B.z],
    ]) {
      const wall = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat(0xc9b99a));
      wall.receiveShadow = true;
      wall.position.set(x, y, z);
      group.add(wall);
    }
    // the counter, and Cypress behind it
    const counter = box(3.6, 1.0, 0.9, 0x8a5a3a);
    counter.position.set(B.x - 3.2, 0.5, B.z - 2.6);
    group.add(counter);
    const till = box(0.5, 0.4, 0.4, 0x55483a);
    till.position.set(B.x - 4.2, 1.2, B.z - 2.6);
    group.add(till);
    const lantern = new THREE.Mesh(new THREE.IcosahedronGeometry(0.14, 0),
      new THREE.MeshBasicMaterial({ color: 0xffd98f }));
    lantern.position.set(B.x - 2.2, 1.25, B.z - 2.6);
    group.add(lantern);
    // shelves: two aisles + the back wall, stocked with the essentials
    function shelf(x, z, ry) {
      const s = new THREE.Group();
      const back = box(3.0, 1.9, 0.08, 0xa97c50);
      back.position.set(0, 0.95, -0.22);
      s.add(back);
      for (const sx of [-1.46, 1.46]) {
        const side = box(0.08, 1.9, 0.5, 0xa97c50);
        side.position.set(sx, 0.95, 0);
        s.add(side);
      }
      for (const ly of [0.5, 1.0, 1.5]) {
        const plank = box(3.0, 0.06, 0.46, 0x96703f);
        plank.position.set(0, ly, 0);
        s.add(plank);
        for (let i = 0; i < 5; i++) {
          const kindRoll = (i + ly * 4) % 3;
          let good;
          if (kindRoll < 1) {
            good = new THREE.Mesh(new THREE.CylinderGeometry(0.11, 0.11, 0.26, 7),
              mat([0xc9705a, 0x5b8b7a, 0xd9a440][i % 3], 0.5)); // cans. one of them is the third bean.
            good.position.y = ly + 0.16;
          } else if (kindRoll < 2) {
            good = new THREE.Mesh(new THREE.IcosahedronGeometry(0.15, 0), mat(0xb9a582, 0.95));
            good.scale.y = 0.75; // sacks
            good.position.y = ly + 0.14;
          } else {
            good = new THREE.Mesh(new THREE.BoxGeometry(0.24, 0.24, 0.16), mat([0xd9c08f, 0x8fa3b8][i % 2], 0.8));
            good.position.y = ly + 0.15;
          }
          good.position.x = -1.2 + i * 0.6;
          good.castShadow = true;
          s.add(good);
        }
      }
      s.rotation.y = ry;
      s.position.set(x, 0, z);
      group.add(s);
    }
    shelf(B.x + 1.2, B.z - 3.2, 0);
    shelf(B.x + 1.2, B.z - 0.2, 0);
    shelf(B.x - 3.2, B.z + 1.6, Math.PI / 2);
    // the pot-belly stove, ticking warmly
    const stove = new THREE.Mesh(new THREE.CylinderGeometry(0.5, 0.6, 1.1, 8), mat(0x3a3630, 0.6));
    stove.position.set(B.x + 4.4, 0.55, B.z + 2.8);
    stove.castShadow = true;
    group.add(stove);
    const pipe = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.12, 2.4, 6), mat(0x3a3630, 0.6));
    pipe.position.set(B.x + 4.4, 2.3, B.z + 2.8);
    group.add(pipe);
    const kettle = new THREE.Mesh(new THREE.IcosahedronGeometry(0.2, 0), mat(0x8fa3b8, 0.4));
    kettle.scale.y = 0.8;
    kettle.position.set(B.x + 4.4, 1.25, B.z + 2.8);
    kettle.castShadow = true;
    group.add(kettle);

    // Cypress, behind the counter, pouch at the ready
    const cypress = buildAnimal('pelican', { body: 0xece7dc, head: 0xece7dc });
    cypress.position.set(B.x - 3.2, 0.1, B.z - 3.9);
    cypress.rotation.y = Math.PI * 0.05;
    group.add(cypress);
    storeUpdates.push((dt, t) => { cypress.position.y = 0.1 + Math.sin(t * 1.2) * 0.025; });

    const room = collectInteriorRoot(group, roomStart);
    zones.registerInterior('general', {
      root: room,
      floorY: 0,
      bounds: { x0: B.x - 5.6, x1: B.x + 5.6, z0: B.z - 4.4, z1: B.z + 4.6 },
      blockers: [
        { x: B.x - 3.2, z: B.z - 2.6, r: 1.8 },  // counter
        { x: B.x + 1.2, z: B.z - 3.2, r: 1.4 },  // aisle shelf
        { x: B.x + 1.2, z: B.z - 0.2, r: 1.4 },  // aisle shelf
        { x: B.x - 3.2, z: B.z + 1.6, r: 1.4 },  // wall shelf
        { x: B.x + 4.4, z: B.z + 2.8, r: 0.9 },  // the stove
      ],
      spawn: { x: B.x, z: B.z + 3.8, rotY: Math.PI },
      lighting: {
        bg: 0x2a2018, fog: 0x2a2018, fogNear: 20, fogFar: 52,
        hemiSky: 0xffe9c8, hemiGround: 0x70573b, hemiIntensity: 1.22,
        sunIntensity: 0,
      },
    });
    register({
      pos: new THREE.Vector3(B.x, 0, B.z + 4.2), r: 1.8, zone: 'general',
      label: 'step outside',
      use: () => zones.leaveTo({
        x: doorWorld.x + Math.sin(rotY) * 1.2,
        z: doorWorld.z + Math.cos(rotY) * 1.2,
        rotY: rotY + Math.PI,
      }),
    });
    register({
      getPos: () => cypress.position, r: 3.4, zone: 'general',
      label: 'talk to Cypress',
      use: () => ui.say(pick(CYPRESS_CHAT), { speaker: 'Cypress', voice: VOICE.cypress }),
    });
    const GOODS = [
      { id: 'marshmallows', label: '🍡 Marshmallows', name: 'Marshmallows', emoji: '🍡', price: 5 },
      { id: 'camp_mug', label: '☕ Enamel camp mug', name: 'Enamel Camp Mug', emoji: '☕', price: 6 },
      { id: 'postcard_farther', label: '🏝️ Postcard', name: 'Farther Isle Postcard', emoji: '🏝️', price: 3 },
    ];
    register({
      pos: new THREE.Vector3(B.x + 1.2, 0, B.z - 1.7), r: 2.0, zone: 'general',
      label: 'browse the shelves',
      use: async () => {
        const picked = await ui.ask('The shelves hold exactly what a camp needs and one thing nobody has identified.', [
          ...GOODS.map((g) => ({
            label: g.label, value: g.id, hint: `${g.price}🔘`,
            disabled: S.state.buttons < g.price,
          })),
          { label: 'Just browsing', value: null },
        ]);
        const g = GOODS.find((x) => x.id === picked);
        if (!g) return;
        S.spend(g.price);
        S.addItem(g.id);
        kaching();
        ui.updateHUD();
        ui.toast(`You bought <b>${g.name}</b>. Cypress files the buttons in the pouch. The pouch accepts them the way the sea accepts rivers.`, g.emoji);
      },
    });
    register({
      pos: new THREE.Vector3(B.x + 4.4, 0, B.z + 1.6), r: 1.7, zone: 'general', priority: 0,
      label: 'warm your hands at the stove',
      use: () => ui.say('The stove ticks. The kettle on top sits forever nearly boiling, out of respect for whoever comes in next.'),
    });
  }

  // ==================================================== the mangrove flats ----
  {
    for (let i = 0; i < 22; i++) {
      const a = rand(0, Math.PI * 2);
      const r = 3 + Math.sqrt(rand(0, 1)) * 10;
      const x = F.x + Math.cos(a) * r;
      const z = F.z + Math.sin(a) * r * 0.9;
      const y = terrainHeight(x, z);
      if (y > 0.3) continue; // mangroves live where the tide can reach them
      const tree = makeMangrove(rand(0.8, 1.25));
      tree.rotation.y = rand(0, Math.PI * 2);
      tree.position.set(x, Math.max(y, WATER_Y - 0.25), z);
      group.add(tree);
    }
    // Stilt, the heron. one leg. since Tuesday.
    const stilt = buildAnimal('heron', { body: 0x9fb3c8 });
    stilt.position.set(107, Math.max(terrainHeight(107, 43.5), WATER_Y - 0.1), 43.5);
    stilt.rotation.y = 2.4;
    group.add(stilt);
    register({
      getPos: () => stilt.position, r: 2.6,
      label: 'regard Stilt',
      use: () => ui.say('(Stilt regards the water. The water regards Stilt. You get the sense this has been going on all morning, and that both parties consider it going well.)'),
    });
  }

  function makeMangrove(scale = 1) {
    const g = new THREE.Group();
    const wood = mat(0x6e5136, 0.95);
    const knot = { x: 0, y: 1.0, z: 0 };
    for (let i = 0; i < 5; i++) {
      const a = (i / 5) * Math.PI * 2 + rand(-0.2, 0.2);
      const bx = Math.cos(a) * (0.65 + rand(-0.1, 0.15));
      const bz = Math.sin(a) * (0.65 + rand(-0.1, 0.15));
      const from = new THREE.Vector3(bx, -0.3, bz);
      const to = new THREE.Vector3(knot.x, knot.y, knot.z);
      const dir = to.clone().sub(from);
      const len = dir.length();
      const root = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.08, len, 5), wood);
      root.position.copy(from).add(to).multiplyScalar(0.5);
      root.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), dir.normalize());
      root.castShadow = true;
      g.add(root);
    }
    const trunk = new THREE.Mesh(new THREE.CylinderGeometry(0.13, 0.17, 0.9, 6), wood);
    trunk.position.y = knot.y + 0.4;
    trunk.castShadow = true;
    g.add(trunk);
    const leafMat = mat(0x3f7747, 0.95);
    for (const [ox, oy, oz, r] of [[0, 2.2, 0, 0.95], [0.6, 1.95, 0.25, 0.65], [-0.55, 2.0, -0.25, 0.7]]) {
      const blob = new THREE.Mesh(new THREE.IcosahedronGeometry(r, 1), leafMat);
      blob.position.set(ox, oy, oz);
      blob.castShadow = true;
      g.add(blob);
    }
    g.scale.setScalar(scale);
    return g;
  }

  // ================================================== Wren, birdwatching ----
  const wren = buildAnimal('duck', { body: 0x9a7a5c, head: 0x8a6a4c });
  {
    // binoculars: two little barrels on a strap thought
    const bino = new THREE.Group();
    for (const sx of [-0.09, 0.09]) {
      const barrel = new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.07, 0.16, 6), mat(0x3a3630, 0.5));
      barrel.rotation.x = Math.PI / 2;
      barrel.position.x = sx;
      bino.add(barrel);
    }
    bino.position.set(0, 0.95, 0.55);
    wren.add(bino);
    wren.position.set(98, terrainHeight(98, 22), 22);
    group.add(wren);
    register({
      getPos: () => wren.position, r: 2.4,
      label: 'talk to Wren',
      use: () => ui.say(pick(WREN_CHAT), { speaker: 'Wren', voice: VOICE.wren }),
    });
  }
  const wrenWalk = {
    g: wren, seg: 0, speed: 1.3, pause: 2,
    points: [
      { x: 98, z: 22 },      // camp edge
      { x: 103, z: 36 },     // the bank over the flats
      { x: 106.5, z: 41 },   // down among the mangroves
      { x: 95, z: 27 },      // the west beach
    ],
  };

  // ======================================================== the west pier ----
  {
    const bearing = -Math.PI / 2; // due west, into the evening
    const bx = Math.sin(bearing), bz = Math.cos(bearing);
    let shoreT = 0;
    for (let tt = 0; tt < 26; tt += 0.5) {
      if (terrainHeight(94 + bx * tt, 30 + bz * tt) < 0.25) { shoreT = tt - 1; break; }
      shoreT = tt;
    }
    const sx = 94 + bx * shoreT, sz = 30 + bz * shoreT;
    FARTHER_DOCK.x = sx;
    FARTHER_DOCK.z = sz;
    FARTHER_DOCK.rotY = bearing + Math.PI; // step off facing the island
    const px = -bz, pz = bx;
    // the west beach shelves gently — the pier walks out until it means it
    for (let i = 0; i < 9; i++) {
      const t = i + 0.5;
      const plank = box(2.4, 0.16, 1.0, i % 4 === 2 ? 0x96703f : 0xa97c50);
      plank.position.set(sx + bx * t, 0.55, sz + bz * t);
      plank.rotation.y = bearing;
      plank.receiveShadow = true;
      group.add(plank);
      if (i % 3 === 0) {
        for (const side of [-1, 1]) {
          const pile = new THREE.Mesh(new THREE.CylinderGeometry(0.13, 0.17, 2.4, 6), mat(0x6b4a2e));
          pile.position.set(sx + bx * t + px * side * 1.1, -0.6, sz + bz * t + pz * side * 1.1);
          group.add(pile);
        }
      }
    }
    zones.addCrossing({
      contains(x, z) {
        const dx = x - sx, dz = z - sz;
        const t = dx * bx + dz * bz;
        if (t < -0.5 || t > 9.5) return false;
        return Math.abs(dx * px + dz * pz) < 1.3;
      },
      height: () => 0.64,
    });
    const bxp = sx + bx * 11.5 + px * 2.4, bzp = sz + bz * 11.5 + pz * 2.4;
    FARTHER_DOCK.buoyPos = new THREE.Vector3(bxp, 0, bzp);
  }

  // everything solid casts and catches light; glows and glass do not
  group.traverse((o) => {
    if (!o.isMesh) return;
    if (o.material.transparent) return;
    if (o.material.isMeshBasicMaterial) return;
    if (o.material.emissive && o.material.emissiveIntensity > 0) return;
    o.castShadow = true;
    o.receiveShadow = true;
  });

  function update(dt, t, playerPos) {
    const zone = zones.current();
    if (zone === 'general') {
      for (const fn of storeUpdates) fn(dt, t, playerPos);
      return;
    }
    if (zone !== 'island') return;

    // the fire, gently alive
    for (let i = 0; i < flames.length; i++) {
      const f = flames[i];
      const k = 0.85 + Math.sin(t * (6 + i * 1.7) + i * 2.1) * 0.18;
      f.scale.setScalar(k);
    }

    // Wren makes her rounds, pausing generously — birds don't hurry her
    const w = wrenWalk;
    if (w.pause > 0) {
      w.pause -= dt;
      animateGait(w.g, t, 0);
      if (playerPos) {
        const dxp = playerPos.x - w.g.position.x, dzp = playerPos.z - w.g.position.z;
        if (Math.hypot(dxp, dzp) < 5) {
          w.g.rotation.y = turnToward(w.g.rotation.y, Math.atan2(dxp, dzp), dt, 4);
        }
      }
    } else {
      const target = w.points[w.seg];
      const dx = target.x - w.g.position.x, dz = target.z - w.g.position.z;
      const d = Math.hypot(dx, dz);
      if (d < 0.5) {
        w.seg = (w.seg + 1) % w.points.length;
        w.pause = 6 + Math.random() * 10; // there was a bird
      } else {
        const step = Math.min(w.speed * dt, d);
        w.g.position.x += (dx / d) * step;
        w.g.position.z += (dz / d) * step;
        w.g.position.y = Math.max(terrainHeight(w.g.position.x, w.g.position.z), WATER_Y - 0.1);
        w.g.rotation.y = turnToward(w.g.rotation.y, Math.atan2(dx, dz), dt, 6);
        animateGait(w.g, t, 1);
      }
    }

    // Huck turns to meet company; the fire excuses him from standing up
    if (playerPos) {
      const dxh = playerPos.x - huck.position.x, dzh = playerPos.z - huck.position.z;
      const dh = Math.hypot(dxh, dzh);
      huck.rotation.y = turnToward(huck.rotation.y,
        dh < 5 ? Math.atan2(dxh, dzh) : -2.6, dt, 4);
    }

    // the welcome, once
    if (playerPos && !S.hasFlag('seenFarther') &&
        Math.hypot(playerPos.x - ISLAND7.x, playerPos.z - ISLAND7.z) < 20) {
      S.setFlag('seenFarther');
      ui.toast('Farther Isle. The name is a promise, faithfully kept.', '🏕️');
    }
  }

  return { group, update };
}

// the sign helper: painted board, block letters, readable at camera distance
function signBoard(text, w = 3.4, h = 0.8) {
  const cv = document.createElement('canvas');
  cv.width = 512; cv.height = 128;
  const ctx = cv.getContext('2d');
  ctx.fillStyle = '#4a3f33';
  ctx.fillRect(0, 0, 512, 128);
  ctx.strokeStyle = '#6a5c48';
  ctx.lineWidth = 8;
  ctx.strokeRect(6, 6, 500, 116);
  ctx.fillStyle = '#f3ead6';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  let size = 72;
  do {
    ctx.font = `bold ${size}px ui-rounded, 'Segoe UI', system-ui, sans-serif`;
    size -= 4;
  } while (ctx.measureText(text).width > 460 && size > 18);
  ctx.fillText(text, 256, 68);
  const tex = new THREE.CanvasTexture(cv);
  const board = new THREE.Mesh(new THREE.BoxGeometry(w, h, 0.08),
    new THREE.MeshStandardMaterial({ map: tex, flatShading: true, roughness: 0.9 }));
  board.castShadow = board.receiveShadow = true;
  return board;
}

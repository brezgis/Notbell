// The dock: rowboats you can actually row, a tugboat with a captain who
// knows where everything is and goes nowhere, and the old lighthouse —
// dark since the lamp retired to the café, with an empty hook where the
// bell used to hang.

import * as THREE from 'three';
import { SITES, terrainHeight, WATER_Y, ISLAND2, ISLAND3, ISLAND5, ISLAND6, VOLCANO } from './terrain.js';
import * as zones from './zones.js';
import { register } from './interact.js';
import * as ui from './ui.js';
import * as S from './state.js';
import { buildAnimal } from './animals.js';
import { plop, doorChime } from './audio.js';
import { rand, turnToward } from './utils.js';
import { BULKO_DOCK } from './bulko.js';
import { LABS_DOCK } from './island6.js';

function mat(color, rough = 0.85) {
  return new THREE.MeshStandardMaterial({ color, flatShading: true, roughness: rough });
}

function box(w, h, d, color) {
  const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat(color));
  m.castShadow = true;
  return m;
}

function makeRowboat(color) {
  const g = new THREE.Group();
  const hull = new THREE.Mesh(new THREE.CylinderGeometry(0.9, 0.55, 0.7, 7), mat(color));
  hull.scale.z = 2.1;
  hull.rotation.y = Math.PI / 7; // flat-ish side forward
  hull.position.y = 0.1;
  g.add(hull);
  const inner = new THREE.Mesh(new THREE.CylinderGeometry(0.72, 0.45, 0.5, 7), mat(0xc9b178));
  inner.scale.z = 2.0;
  inner.rotation.y = Math.PI / 7;
  inner.position.y = 0.25;
  g.add(inner);
  const bench = box(1.1, 0.1, 0.3, 0x8a5a3a);
  bench.position.set(0, 0.4, -0.2);
  g.add(bench);
  for (const sx of [-1, 1]) {
    const oar = box(0.08, 0.08, 1.7, 0xa97c50);
    oar.position.set(sx * 0.95, 0.45, 0.1);
    oar.rotation.y = sx * 0.35;
    g.add(oar);
  }
  return g;
}

export function createBoats(player) {
  const group = new THREE.Group();
  const updates = [];
  const D = SITES.dock;

  // the dock points out to sea, away from the island's heart
  const outA = Math.atan2(D.x, D.z); // seaward bearing
  const ox = Math.sin(outA), oz = Math.cos(outA);
  const px = -oz, pz = ox; // along-shore

  // ---------------------------------------------------------- the pier ----
  const PIER_LEN = 11;
  for (let i = 0; i < PIER_LEN; i += 1) {
    const t = i + 0.5;
    const plank = box(2.6, 0.18, 1.0, i % 5 === 2 ? 0x96703f : 0xa97c50);
    plank.position.set(D.x + ox * t, 0.55, D.z + oz * t);
    plank.rotation.y = outA;
    plank.receiveShadow = true;
    group.add(plank);
    if (i % 3 === 0) {
      for (const side of [-1, 1]) {
        const pile = new THREE.Mesh(new THREE.CylinderGeometry(0.14, 0.18, 2.6, 6), mat(0x6b4a2e));
        pile.position.set(D.x + ox * t + px * side * 1.2, -0.6, D.z + oz * t + pz * side * 1.2);
        group.add(pile);
      }
    }
  }
  // the pier is a proper crossing: walk it all the way out over the water
  zones.addCrossing({
    contains(x, z) {
      const dx = x - D.x, dz = z - D.z;
      const t = dx * ox + dz * oz;
      if (t < -0.5 || t > PIER_LEN + 0.8) return false;
      return Math.abs(dx * px + dz * pz) < 1.35;
    },
    height: () => 0.64,
  });

  // -------------------------------------------------------- the rowboats ----
  const boats = [];
  for (const [i, color] of [[0, 0xb0453a], [1, 0x4f8f6a]].values()) {
    const boat = makeRowboat(color);
    // moored where the shallows end, both on the same side of the pier —
    // the Persistent keeps the other side, and the prompts stay honest
    const bx = D.x + ox * 7.6 + px * (i === 0 ? -2.0 : -4.0);
    const bz = D.z + oz * 7.6 + pz * (i === 0 ? -2.0 : -4.0);
    boat.position.set(bx, WATER_Y + 0.12, bz);
    boat.rotation.y = outA + rand(-0.3, 0.3);
    group.add(boat);
    const data = { boat, inUse: false };
    boats.push(data);

    register({
      getPos: () => boat.position,
      r: 5.2, // callable from the end of the wadeable shallows
      enabled: () => !data.inUse,
      label: 'row out to sea',
      use: () => boardBoat(data),
    });
  }

  let activeBoat = null;

  async function boardBoat(data) {
    plop();
    await zones.go('sea', {
      x: data.boat.position.x, z: data.boat.position.z,
      rotY: data.boat.rotation.y,
    });
    data.inUse = true;
    activeBoat = data;
    data.boat.position.set(0, -0.42, 0.1);
    data.boat.rotation.set(0, 0, 0);
    player.group.add(data.boat); // the boat goes where you go now
    ui.toast('You push off. The water holds you like it’s done this before.', '🚣');
    if (!S.hasFlag('firstRow')) {
      S.setFlag('firstRow');
      ui.say([
        'Oars in, oars out. The island shrinks behind you, politely.',
        'Steer for the smoking mountain, the bright water, or wherever the fins are going. To land again, nose up to any shore and press E.',
      ]);
    }
  }

  function disembarkSpot() {
    // a walkable patch of land just ahead of the bow
    const ry = player.group.rotation.y;
    const dx = Math.sin(ry), dz = Math.cos(ry);
    for (let d = 1.5; d <= 6; d += 0.7) {
      const x = player.group.position.x + dx * d;
      const z = player.group.position.z + dz * d;
      if (terrainHeight(x, z) > WATER_Y + 0.15 && zones.islandCanWalk(x, z)) return { x, z };
    }
    return null;
  }

  register({
    getPos: () => player.group.position,
    r: 99, priority: 0,
    zone: 'sea',
    enabled: () => !!activeBoat && !!disembarkSpot(),
    label: 'go ashore',
    use: async () => {
      const spot = disembarkSpot();
      if (!spot || !activeBoat) return;
      const data = activeBoat;
      activeBoat = null;
      player.group.remove(data.boat);
      // the boat waits where you left it, nosed up to the shore
      data.boat.position.set(player.group.position.x, WATER_Y + 0.12, player.group.position.z);
      data.boat.rotation.y = player.group.rotation.y;
      group.add(data.boat);
      data.inUse = false;
      plop();
      await zones.go('island', { x: spot.x, z: spot.z, rotY: player.group.rotation.y });
      ui.toast('You hop ashore. The boat will wait — it’s good at that.', '⛵');
    },
  });

  // ---------------------------------------------------------- the tugboat ----
  const tug = new THREE.Group();
  const hull = new THREE.Mesh(new THREE.CylinderGeometry(1.7, 1.2, 1.2, 8), mat(0x2e3e5c));
  hull.scale.z = 2.2;
  hull.position.y = 0.3;
  tug.add(hull);
  const deck = box(2.6, 0.2, 5.2, 0xa97c50);
  deck.position.y = 0.95;
  tug.add(deck);
  const cabin = box(1.6, 1.3, 1.8, 0xf3e6cf);
  cabin.position.set(0, 1.7, -0.6);
  tug.add(cabin);
  const cabinRoof = box(1.8, 0.18, 2.0, 0xb0453a);
  cabinRoof.position.set(0, 2.4, -0.6);
  tug.add(cabinRoof);
  const funnel = new THREE.Mesh(new THREE.CylinderGeometry(0.22, 0.3, 0.9, 7), mat(0xb0453a));
  funnel.position.set(0, 1.6, 0.9);
  tug.add(funnel);
  const bumper = new THREE.Mesh(new THREE.TorusGeometry(0.3, 0.1, 6, 10), mat(0x2e2a26, 0.6));
  bumper.position.set(0, 0.6, 2.6);
  tug.add(bumper);
  tug.traverse((o) => { if (o.isMesh) o.castShadow = true; });
  // moored across the pier from the rowboats, so walking the planks offers
  // the rowboats on one corner and the captain on the other
  const tx = D.x + ox * 10.5 + px * 4.5;
  const tz = D.z + oz * 10.5 + pz * 4.5;
  tug.position.set(tx, WATER_Y + 0.35, tz);
  tug.rotation.y = outA + 0.9;
  group.add(tug);
  updates.push((dt, t) => {
    tug.position.y = WATER_Y + 0.35 + Math.sin(t * 0.8) * 0.06;
    tug.rotation.z = Math.sin(t * 0.7) * 0.015;
  });

  // Captain Brine, the goose who has been everywhere and stays here
  const brine = buildAnimal('duck', { body: 0x9aa3a0, head: 0xb8beba });
  brine.scale.setScalar(1.25);
  brine.position.set(0, 1.05, 0.6);
  brine.rotation.y = Math.PI + 0.4;
  tug.add(brine);
  const BRINE_LINES = [
    'Captain Brine. Tug’s called the Persistent. She doesn’t tug much these days. Neither do I.',
    'Out past the volcano there’s a fog bank that hums, and rocks that sing back. Someday, a proper route. Today: the mountain run.',
    'Watch the reef glow when you row over it — bright water means small neighbors. Mind your oars.',
    'The old light there? I steered home by her a hundred times. Tip your hat when you pass. You don’t have a hat? The shop sells hats.',
  ];
  // ------------------------------------------------------ the sea stories ----
  // every route gets one. mandatory, the story.
  const STORIES = {
    volcano: [
      ['The Persistent grumbles away from the pier. Brine talks without turning around.',
       '“I was a deckhand the night the bell went down. Youngest aboard. The wave stood up like a wall with opinions.”',
       '“Tansy didn’t cry, you know. She just listened all the way down. Said it rang once, under the water. Said it sounded… relieved.”',
       'The engine settles. Black rock slides past the windows.'],
      ['“See the reef glowing off the port side? My grandmother called it the dropped crown. Said a sea-queen threw it away on purpose.”',
       '“Why on purpose? Because it kept singing, and she wanted to sleep. Royalty.” Brine snorts at her own joke for a while.',
       'The volcano grows ahead, warm and unbothered.'],
      ['“The mountain? Oh, she and I get along. I whistle when I pass. She smokes when she’s pleased.”',
       '“One time she smoked BEFORE I whistled. I think about that a lot.”'],
    ],
    bulko: [
      ['“Warehouse run. Hold on to something.” The Persistent picks up speed, which is to say: some speed.',
       '“They asked me to decorate the lobster tank once. The lobsters had OPINIONS about the throw pillows. We don’t speak of it. The pillows stayed.”',
       'A gray building rises over the water like a very organized cliff.'],
      ['“A buck and a half for the dog and the fizz. Since before the bell went down. I checked the ledgers myself.”',
       '“Some things hold, sailor.” She says nothing else the whole way, and it is somehow the best conversation you’ve had all week.'],
      ['“See any cars on the way? No? Funny thing—” She stops herself. “No. Gus is right. Don’t worry about it.”'],
    ],
    far: [
      ['“Short hop, this. Time for a short story: the church over there has no bell. ON PURPOSE. First time I heard that, I laughed so hard I fouled the prop.”',
       '“Then I sat in there once, out of the rain. Quietest twenty minutes of my life. I think about it more than I let on.”'],
      ['“See the bones on the far shore? The Old Singer. Whale. Before your time, before MY time, and I’m older than the paint on this boat.”',
       '“Some nights the wind comes over those ribs and the whole isle hums. The heron calls it a hymn. I call it weather. We’re both right.”'],
    ],
    north: [
      ['“North run. Mind the damp. The moss up there has TENURE, sailor — it was on the rocks before the rocks finished.”',
       '“The bat runs the library. Lent me a book on knots once. I know all the knots. Read it anyway. Manners.”'],
      ['“Doctor up there’s an axolotl. Nobody on that island has ever been sick. She keeps the clinic anyway. ‘Readiness,’ she says.”',
       '“I respect that. The Persistent hasn’t tugged anything in years. We keep ready too.”'],
    ],
    grove: [
      ['“Grove Isle. Old money. The Baron’s grandfather billed Old Tansy by the HOUR to not find that bell. I’ve seen the invoice. It’s in a gold frame.”',
       '“And still — orchards came out of it, springs, a railway. Funny what grows out of a bad deal, given a century.”'],
      ['“The capybaras run the springs. Don’t let the calm fool you. That calm took PRACTICE.”',
       '“One of them wears an orange. You’ll want to ask about it. Don’t ask about it. Some things are load-bearing.”'],
    ],
    labs: [
      ['“The Labs! They tried to buy the Persistent off me once. ‘Acoustic research,’ they said. Asked what they’d play through her. They said PINGS. She’s a tugboat, not a triangle.”',
       '“They apologized with a fruit basket and a barometer. Good neighbors, honestly. The barometer’s never wrong. I hate it.”'],
      ['“They strung a telephone wire over the north causeway. One telephone. It calls the OTHER END OF THE BRIDGE. They’re very proud.”',
       '“I rang it once. A mole picked up. Said ‘we can hear you without it, you know.’ Magnificent waste of wire. Science!”'],
      ['“They’re building a rocket out there. To the MOON, they say. You know what I say? Good.”',
       '“The sea’s been keeping our bell a hundred years. About time somebody from this archipelago went somewhere the sea can’t follow.”',
       'She says nothing else the rest of the way. It’s not a sad nothing.'],
    ],
    home: [
      ['“Homeward. Best heading there is.” The Persistent seems to agree; she runs a half-knot faster pointed at her own pier.'],
      ['“You know what I love about that island? Lost the bell, kept the NAME. No moping. Straight to paperwork.” She laughs like a goose, which she is.'],
    ],
  };
  const storyIdx = {};
  let brineIdx = 0;

  // ------------------------------------------------------------ the stops ----
  // every island gets a landing and a patch of deep water just off it.
  // except TEXAS. the Persistent draws four feet of water.

  function shoreLanding(cx, cz) {
    const bearing = Math.atan2(D.x - cx, D.z - cz); // the shore facing home
    const bx = Math.sin(bearing), bz = Math.cos(bearing);
    let landT = 6;
    for (let t = 6; t < 60; t += 0.5) {
      if (terrainHeight(cx + bx * t, cz + bz * t) < 0.15) break;
      landT = t;
    }
    return {
      x: cx + bx * landT, z: cz + bz * landT, rotY: bearing + Math.PI,
      buoy: { x: cx + bx * (landT - 1.2) - bz * 2.4, z: cz + bz * (landT - 1.2) + bx * 2.4 },
    };
  }

  function seaOff(lx, lz, cx, cz) {
    const a = Math.atan2(lx - cx, lz - cz);
    const ax = Math.sin(a), az = Math.cos(a);
    for (let t = 2; t < 30; t += 0.5) {
      if (terrainHeight(lx + ax * t, lz + az * t) < WATER_Y - 0.7) {
        return { x: lx + ax * (t + 1.5), z: lz + az * (t + 1.5) };
      }
    }
    return { x: lx + ax * 10, z: lz + az * 10 };
  }

  const farLand = shoreLanding(ISLAND2.x, ISLAND2.z);
  const northLand = shoreLanding(ISLAND3.x, ISLAND3.z);
  const groveLand = shoreLanding(ISLAND5.x, ISLAND5.z);
  const vb = SITES.vbeach;

  const STOPS = {
    home: {
      label: '🍃 Notbell (home dock)',
      land: { x: D.x + ox * 3, z: D.z + oz * 3, rotY: Math.atan2(-ox, -oz) },
      sea: { x: tx + ox * 2, z: tz + oz * 2 },
    },
    volcano: {
      label: '🌋 The volcano',
      land: { x: vb.x, z: vb.z + 2, rotY: Math.PI },
      sea: seaOff(vb.x, vb.z + 2, VOLCANO.x, VOLCANO.z),
    },
    far: {
      label: '⛪ The Far Isle',
      land: farLand,
      sea: seaOff(farLand.x, farLand.z, ISLAND2.x, ISLAND2.z),
    },
    north: {
      label: '📚 The North Isle',
      land: northLand,
      sea: seaOff(northLand.x, northLand.z, ISLAND3.x, ISLAND3.z),
    },
    grove: {
      label: '🍊 Grove Isle',
      land: groveLand,
      sea: seaOff(groveLand.x, groveLand.z, ISLAND5.x, ISLAND5.z),
    },
    bulko: {
      label: '🛒 BULKO',
      land: { x: BULKO_DOCK.x, z: BULKO_DOCK.z, rotY: BULKO_DOCK.rotY },
      sea: seaOff(BULKO_DOCK.x, BULKO_DOCK.z, 8, 96),
    },
    labs: {
      label: '🚀 Notbell Labs',
      land: { x: LABS_DOCK.x, z: LABS_DOCK.z, rotY: LABS_DOCK.rotY },
      sea: seaOff(LABS_DOCK.x, LABS_DOCK.z, ISLAND6.x, ISLAND6.z),
    },
  };

  // ----------------------------------------------------------- the voyage ----
  // no more black screens: the Persistent actually sails. you ride the deck,
  // the story plays over open water, Brine steers around the shallows.

  let voyage = null;
  const wakeBits = [];
  const smokePuffs = [];
  let wakeT = 0;
  let smokeT = 0;

  function spawnBit(list, color, size, max, x, y, z) {
    let bit;
    if (list.length >= max) {
      bit = list.shift();
    } else {
      bit = {
        m: new THREE.Mesh(new THREE.IcosahedronGeometry(size, 0),
          new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.8, depthWrite: false })),
      };
      group.add(bit.m);
    }
    bit.life = 0;
    bit.m.visible = true;
    bit.m.material.opacity = 0.8;
    bit.m.scale.setScalar(1);
    bit.m.position.set(x, y, z);
    list.push(bit);
    return bit;
  }

  function shallowAhead(ang, dist) {
    const a = tug.rotation.y + ang;
    return terrainHeight(
      tug.position.x + Math.sin(a) * dist,
      tug.position.z + Math.cos(a) * dist) > WATER_Y - 0.55;
  }

  async function beginVoyage(destId, fromId) {
    const dest = STOPS[destId];
    const from = STOPS[fromId];
    const lines = STORIES[destId] || STORIES.home;
    storyIdx[destId] = storyIdx[destId] || 0;
    const story = lines[storyIdx[destId]++ % lines.length];
    plop();
    await ui.fadeSwap(() => {
      const heading = Math.atan2(dest.sea.x - from.sea.x, dest.sea.z - from.sea.z);
      tug.position.set(from.sea.x, WATER_Y + 0.35, from.sea.z);
      tug.rotation.y = heading;
      player.riding = true;
      return zones.go('sea', { x: from.sea.x, z: from.sea.z, rotY: heading });
    });
    voyage = { dest, destId, story, speed: 0, elapsed: 0, storyFired: false, landing: false };
    ui.toast('The Persistent clears her throat and gets going.', '⛴️');
  }

  async function landVoyage() {
    const v = voyage;
    voyage = null;
    player.riding = false;
    await ui.fadeSwap(() => zones.go('island', v.dest.land));
    ui.toast(v.destId === 'home'
      ? 'Home port. The Persistent sighs happily.'
      : 'The Persistent putters off home. Ring a buoy when you want a lift.', '⛴️');
    if (v.destId !== 'home') {
      // she sees herself home, trailing smoke over the horizon
      voyage = { dest: STOPS.home, destId: 'home', ghost: true, speed: 4, elapsed: 0 };
    } else {
      tug.position.set(tx, WATER_Y + 0.35, tz);
      tug.rotation.y = outA + 0.9;
    }
  }

  async function stopMenu(hereId) {
    if (!S.hasFlag('metBrine')) {
      S.setFlag('metBrine');
      ui.say([
        'A broad gray goose looks up from a coil of rope she was clearly asleep on.',
        '“Captain Brine. The Persistent. We go everywhere worth going and two places that aren’t — ten buttons a leg, sea story included. Mandatory, the story.”',
      ], { speaker: 'Captain Brine', voice: 340 });
      return;
    }
    const choices = Object.entries(STOPS)
      .filter(([id]) => id !== hereId)
      .map(([id, s]) => ({
        label: s.label, value: id,
        hint: id === 'home' ? 'free' : '10🔘',
        disabled: id !== 'home' && S.state.buttons < 10,
      }));
    choices.push({ label: '🤠 TEXAS', value: 'texas' });
    if (hereId === 'home') choices.push({ label: 'Chat', value: 'chat' });
    choices.push({ label: 'Leave', value: null });
    const choice = await ui.ask('Where to, sailor?', choices, { speaker: 'Captain Brine', voice: 340 });
    if (!choice) return;
    if (choice === 'texas') {
      ui.say([
        'No.',
        '“The Persistent draws four feet of water. TEXAS draws ten inches of Texas. We’d beach her, and Pecos would charge us mooring fees on land HE doesn’t pay for either.”',
        '“Row. Swim. Walk at low tide, I don’t care. The Persistent does not do TEXAS.”',
      ], { speaker: 'Captain Brine', voice: 340 });
      return;
    }
    if (choice === 'chat') {
      ui.say(BRINE_LINES[brineIdx++ % BRINE_LINES.length], { speaker: 'Captain Brine', voice: 340 });
      return;
    }
    if (choice !== 'home') {
      S.spend(10);
      ui.updateHUD();
    }
    await beginVoyage(choice, hereId);
  }

  register({
    pos: new THREE.Vector3(tx, 0, tz), r: 6,
    enabled: () => !voyage || voyage.ghost,
    label: 'hail Captain Brine',
    use: () => stopMenu('home'),
  });

  // bell-buoys at every port of call
  function makeBuoy(x, z) {
    const b = new THREE.Group();
    const base = new THREE.Mesh(new THREE.CylinderGeometry(0.4, 0.55, 1.0, 7), mat(0xb0453a));
    base.position.y = 0.5;
    b.add(base);
    const top = new THREE.Mesh(new THREE.IcosahedronGeometry(0.22, 0), mat(0xf2cf5b, 0.4));
    top.position.y = 1.2;
    b.add(top);
    b.position.set(x, terrainHeight(x, z), z);
    b.traverse((o) => { if (o.isMesh) o.castShadow = true; });
    group.add(b);
    return b;
  }

  const PORT_BUOYS = [
    ['volcano', makeBuoy(vb.x - 4, vb.z + 4).position],
    ['far', makeBuoy(farLand.buoy.x, farLand.buoy.z).position],
    ['north', makeBuoy(northLand.buoy.x, northLand.buoy.z).position],
    ['grove', makeBuoy(groveLand.buoy.x, groveLand.buoy.z).position],
  ];
  if (BULKO_DOCK.buoyPos) PORT_BUOYS.push(['bulko', BULKO_DOCK.buoyPos]);
  if (LABS_DOCK.buoyPos) PORT_BUOYS.push(['labs', LABS_DOCK.buoyPos]);
  for (const [id, pos] of PORT_BUOYS) {
    register({
      pos, r: 2.6,
      label: 'ring the buoy for the Persistent',
      use: async () => {
        doorChime();
        await stopMenu(id);
      },
    });
  }

  // ------------------------------------------------------- the lighthouse ----
  const lhx = D.x - ox * 2 + px * 8, lhz = D.z - oz * 2 + pz * 8;
  const lhy = terrainHeight(lhx, lhz);
  const lh = new THREE.Group();
  for (let i = 0; i < 4; i++) {
    const seg = new THREE.Mesh(
      new THREE.CylinderGeometry(1.5 - i * 0.22, 1.7 - i * 0.22, 2.6, 9),
      mat(i % 2 ? 0xb0453a : 0xf0e8d8, 0.8)
    );
    seg.position.y = 1.3 + i * 2.6;
    seg.castShadow = true;
    lh.add(seg);
  }
  // the lamp room: glass, empty of light (the lamp lives at Luna's now)
  const lampRoom = new THREE.Mesh(new THREE.CylinderGeometry(0.95, 0.95, 1.5, 8),
    new THREE.MeshStandardMaterial({
      color: 0xbfe6f2, transparent: true, opacity: 0.4, roughness: 0.2, flatShading: true,
    }));
  lampRoom.position.y = 11.5;
  lh.add(lampRoom);
  const cap = new THREE.Mesh(new THREE.ConeGeometry(1.3, 1.1, 9), mat(0xb0453a));
  cap.position.y = 12.8;
  cap.castShadow = true;
  lh.add(cap);
  // the bell gallery: an open frame below the lamp room, hook and no bell
  for (const sx of [-1, 1]) {
    const arm = box(0.18, 1.2, 0.18, 0x55483a);
    arm.position.set(sx * 0.8, 9.9, 0.9);
    lh.add(arm);
  }
  const crossbar = box(1.9, 0.18, 0.18, 0x55483a);
  crossbar.position.set(0, 10.5, 0.9);
  lh.add(crossbar);
  const hook = new THREE.Mesh(new THREE.TorusGeometry(0.12, 0.035, 5, 8), mat(0x3a3a3a, 0.4));
  hook.position.set(0, 10.3, 0.9);
  lh.add(hook);
  lh.position.set(lhx, lhy, lhz);
  group.add(lh);
  zones.addBlocker(lhx, lhz, 2.2);

  const towardShore = Math.atan2(D.x - lhx, D.z - lhz);
  register({
    pos: new THREE.Vector3(
      lhx + Math.sin(towardShore) * 2.8, 0, lhz + Math.cos(towardShore) * 2.8),
    r: 2.8,
    label: 'stand at the old lighthouse',
    use: async () => {
      await ui.say([
        'The tower still stands watch, white and rust-red, glass dark at the top.',
        'Below the lamp room hangs an iron crossbar, and from it, an empty hook — polished, not rusted. Someone keeps it polished.',
        'A small plate reads: “HER LIGHT KEEPS THE CAFÉ WARM. HER BELL KEEPS THE SEA COMPANY. THE HOOK KEEPS ITS SHAPE, IN CASE.”',
      ]);
      if (!S.hasFlag('sawLighthouse')) {
        S.setFlag('sawLighthouse');
        doorChime();
        ui.toast('Far below the waves, something rings once. Probably the tide. Probably.', '🔔');
      }
    },
  });

  function update(dt, t, playerPos) {
    for (const u of updates) u(dt, t, playerPos);
    // idle boats bob at their moorings
    for (const data of boats) {
      if (!data.inUse) {
        data.boat.position.y = WATER_Y + 0.12 + Math.sin(t * 1.3 + data.boat.position.x) * 0.05;
      }
    }

    // ------------------------------------------------- a voyage underway ----
    if (voyage) {
      const v = voyage;
      v.elapsed += dt;
      const dx = v.dest.sea.x - tug.position.x;
      const dz = v.dest.sea.z - tug.position.z;
      const dist = Math.hypot(dx, dz);
      // steer for the anchorage; the shallows get a respectful berth
      let want = Math.atan2(dx, dz);
      let dodging = false;
      if (dist > 14) {
        if (shallowAhead(0, 13) || shallowAhead(0, 8)) {
          dodging = true;
          want = tug.rotation.y + (shallowAhead(0.5, 10) && !shallowAhead(-0.5, 10) ? -1.0 : 1.0);
        } else if (shallowAhead(0.4, 9)) {
          dodging = true;
          want = tug.rotation.y - 0.5;
        } else if (shallowAhead(-0.4, 9)) {
          dodging = true;
          want = tug.rotation.y + 0.5;
        }
      }
      tug.rotation.y = turnToward(tug.rotation.y, want, dt, dodging ? 1.7 : 1.0);
      const targetSpeed = v.ghost ? 6 : dist < 10 ? 1.8 : 6.5;
      v.speed += (targetSpeed - v.speed) * Math.min(1, dt * 0.8);
      tug.position.x += Math.sin(tug.rotation.y) * v.speed * dt;
      tug.position.z += Math.cos(tug.rotation.y) * v.speed * dt;

      if (!v.ghost) {
        // you, on deck, enjoying the spray
        const ry = tug.rotation.y;
        player.group.position.set(
          tug.position.x + Math.sin(ry) * 1.55,
          tug.position.y + 0.72,
          tug.position.z + Math.cos(ry) * 1.55);
        player.group.rotation.y = ry;
        // the story, told over open water
        if (!v.storyFired && v.elapsed > 2.2 && !ui.isBusy()) {
          v.storyFired = true;
          ui.say(v.story, { speaker: 'Captain Brine', voice: 340 });
        }
        // arrival — politely waits for Brine to finish the story
        if (!v.landing && (dist < 2.2 || v.elapsed > 90) && v.storyFired && !ui.isBusy()) {
          v.landing = true;
          landVoyage();
        }
      } else if (dist < 3) {
        // the ghost run home ends at her own mooring
        tug.position.set(tx, WATER_Y + 0.35, tz);
        tug.rotation.y = outA + 0.9;
        voyage = null;
      }

      // wake off the stern, smoke off the funnel
      wakeT -= dt;
      if (voyage && v.speed > 2 && wakeT <= 0) {
        wakeT = 0.1;
        const ry = tug.rotation.y;
        for (const side of [-1, 1]) {
          spawnBit(wakeBits, 0xeaf6f8, 0.16, 26,
            tug.position.x - Math.sin(ry) * 2.4 + Math.cos(ry) * side * 0.7,
            WATER_Y + 0.05,
            tug.position.z - Math.cos(ry) * 2.4 - Math.sin(ry) * side * 0.7);
        }
      }
      smokeT -= dt;
      if (voyage && v.speed > 1 && smokeT <= 0) {
        smokeT = 0.3;
        const ry = tug.rotation.y;
        spawnBit(smokePuffs, 0x9aa3ad, 0.2, 12,
          tug.position.x + Math.sin(ry) * 0.9,
          tug.position.y + 2.1,
          tug.position.z + Math.cos(ry) * 0.9);
      }
    }
    // foam and smoke age out whether or not anyone is sailing
    for (const list of [wakeBits, smokePuffs]) {
      const isSmoke = list === smokePuffs;
      const maxLife = isSmoke ? 2.2 : 1.5;
      for (const bit of list) {
        if (!bit.m.visible) continue;
        bit.life += dt;
        if (bit.life > maxLife) {
          bit.m.visible = false;
          continue;
        }
        const k = bit.life / maxLife;
        bit.m.material.opacity = 0.8 * (1 - k);
        bit.m.scale.setScalar(1 + k * (isSmoke ? 2.6 : 1.8));
        if (isSmoke) bit.m.position.y += dt * 1.1;
      }
    }
    // Captain Brine watches you potter about the harbor
    if (playerPos) {
      const wp = new THREE.Vector3();
      brine.getWorldPosition(wp);
      const dx = playerPos.x - wp.x, dz = playerPos.z - wp.z;
      if (Math.hypot(dx, dz) < 10) {
        brine.rotation.y = turnToward(brine.rotation.y, Math.atan2(dx, dz) - tug.rotation.y, dt, 3);
      }
    }
  }

  return { group, update };
}

// Home. Yours is a little blue-roofed cottage with a garden out front;
// the villagers each have their own door to (politely) knock on.

import * as THREE from 'three';
import { SITES, terrainHeight, clearOfSites } from './terrain.js';
import * as zones from './zones.js';
import { register } from './interact.js';
import * as ui from './ui.js';
import * as S from './state.js';
import { ITEMS, GROWTH } from './catalog.js';
import { jingle, doorChime, thud } from './audio.js';
import { rand, pick, turnToward } from './utils.js';
import { hourNow } from './calendar.js';
import { MOUSEBOAT } from './island3.js';
import { currentWeather } from './almanac.js';

function mat(color, rough = 0.9) {
  return new THREE.MeshStandardMaterial({ color, flatShading: true, roughness: rough });
}

function box(w, h, d, color) {
  const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat(color));
  m.castShadow = true;
  return m;
}

const IN_HOME = { x: 300, z: 240 }; // cottage interior, off in the elsewhere

const BOOKS = [
  '“Knots for Boats and Reasons.”',
  '“1001 Button Facts, Vol. 2 (Facts 38–41).”',
  '“The Lighthouse Keeper’s Almanac,” annotated in two different handwritings.',
  '“Mushrooms: Friend, Food, or Lamp?”',
  '“A Field Guide to Pretending You Are a Wolf.” It is signed.',
];

// what you find when you knock and nobody's home
const KNOCKS = {
  Clover: 'A round green door with a clover knocker. Nobody home — she’s out in the flowers somewhere, being furniture for butterflies.',
  Biscuit: 'The yard is FULL of small, suspicious mounds. A sign on the door: “OUT. DIGGING. OR NAPPING. INVESTIGATING SOMETHING, ANYWAY.”',
  Saffron: 'It smells like every flower on the island at once, but alphabetized. Nobody in.',
  Howell: 'Scratch marks on the door. Like a wolf’s. EXACTLY like a wolf’s. A note: “OUT. PRACTICING. AWOO.”',
  Bramble: 'The whole house leans comfortably to one side, like it sat down years ago and saw no reason to get up. Bramble is elsewhere, probably also sitting.',
  Marigold: 'A long house with a tall door. A horseshoe hangs above it, ends up, holding the luck in like a bowl. Nobody home — listen for hooves on the bridge.',
  Ember: 'A low round hut, warm to the touch even from outside. A sign: “IF NOT HERE, AT THE CAVE. IF NOT AT THE CAVE, IT IS RAINING AND I AM EVERYWHERE.”',
  Butterpat: 'A wide, calm house smelling of butter and cut grass. A note: “GRAZING. IT’S ALL GRAZING, REALLY, IF YOU THINK ABOUT IT.”',
  Crumb: 'The MouseBoat rocks gently at its mooring. A tiny sign: “CAPTAIN OUT. CRUMBS ACCEPTED IN THE TIN.” There is, indeed, a tin.',
};

// when each villager is home, [start, end) on the real clock — wet weather
// sends everyone home early, except Howell, who insists wolves love drama
const SCHEDULE = {
  Clover: [19, 7],
  Biscuit: [22, 7],
  Saffron: [20, 6],
  Bramble: [21, 6],
  Howell: [10, 16], // nocturnal. obviously. being a wolf.
  Marigold: [20, 5],
  Butterpat: [19, 6],
  Crumb: [22, 6],   // sleeps on deck, under whatever the sky is doing
  Ember: [21, 7],   // nights in her hut on the Far Isle…
};
const EMBER_CAVE_HOURS = [11, 16]; // …middays in the cave, rain permitting (she prefers it not to permit)

function isHomeNow(name) {
  if (!SCHEDULE[name]) return false;
  if (currentWeather() !== 'clear') {
    // rain sends everyone in — except the wolf (drama) and the salamander (joy)
    if (name === 'Ember') return false;
    if (name !== 'Howell') return true;
  }
  const [s, e] = SCHEDULE[name];
  const h = hourNow();
  return s < e ? h >= s && h < e : h >= s || h < e;
}

const COME_INS = {
  Clover: 'A muffled voice: “It’s open! Watch the cushions! …no, you can step on them, they like it.”',
  Biscuit: 'From inside: “In here! Mind the mounds!”',
  Saffron: 'A pleased voice: “Come iiin!”',
  Howell: 'A grave voice: “You may ENTER the den.” A pause. “Hi.”',
  Bramble: 'A slow, warm voice: “Door’s unlocked. It always is.”',
  Marigold: 'A bright whinny: “It’s open! Duck under the beam!”',
  Ember: 'A happy hiss: “Yesss, come in! Pick a rock! They’re all warm!”',
  Butterpat: 'A slow, pleased voice: “Come in, dear. Mind the churn. The churn minds back.”',
};

const HOME_LINES = {
  Clover: [
    'You found my burrow! Sit anywhere. Sit EVERYWHERE. That’s what the cushions are for.',
    'Home is where you can hear the rain and not be in it. Unless you’re Howell. He’s out there singing in it.',
  ],
  Biscuit: [
    'Welcome! Mind the floor. And the walls. Some things are buried in the walls. Long story. Good story.',
    'A buried snack is a gift from a very thoughtful past me to a very lucky future me.',
  ],
  Saffron: [
    'Come in, come in — mind the hanging bunches. That one’s labeled “northwest wind, first warm day.”',
    'A tidy den and one open window. That’s the entire secret to everything.',
  ],
  Howell: [
    'Welcome to the DEN. Wolves have dens. This is one. Draw your own conclusions. The correct ones.',
    'I howl at the poster on cloudy nights. Keeps the skills sharp. The moon understands.',
  ],
  Bramble: [
    'Oh, hello. Pull up a chair. The big one. There’s only the big one.',
    'A house is just a cave that learned manners.',
  ],
  Marigold: [
    'Welcome! Mind your head — the ceiling was built for optimists.',
    'I keep the window facing the bridge. Best view on either island: things arriving.',
  ],
  Ember: [
    'Oh! Hello! Isn’t it WONDERFUL in here. Shh. Listen. …B-flat.',
    'Sit on a warm rock. Any of them. They’re all warm. I checked each one personally.',
  ],
  Butterpat: [
    'Evenings are for butter and thinking about grass in the abstract.',
    'Vesper lent me a book about meadows. I live in a meadow. I read it anyway. Wonderful twist at the end: more meadow.',
  ],
  Crumb: [
    'Deck’s the best room of the house. Ceiling’s a bit far away, but you can’t have everything.',
    'Hear that? Water on the hull. Best lullaby there is, and it knows every verse.',
  ],
};

const HOME_PROPS = {
  Clover: { label: 'squish a cushion', text: 'Impossibly soft. You understand everything about Clover now.' },
  Biscuit: { label: 'inspect the treasure shelf', text: 'A bottle cap, a snail shell (vacant — he checked), and a button so lucky it has its own tiny cushion.' },
  Saffron: { label: 'sniff the dried flowers', text: 'Last summer, preserved. Each bunch is labeled with where the wind was coming from.' },
  Howell: { label: 'examine the moon poster', text: '“MOON,” reads the caption. It is signed. By Howell.' },
  Bramble: { label: 'peek at the honey pots', text: 'Three pots: “BREAKFAST,” “EMERGENCY,” and “DO NOT (SPRING ONLY).”' },
  Marigold: { label: 'look at the ribbon wall', text: 'Ribbons from races with one participant. All firsts. The discipline is what counts.' },
  Ember: { label: 'touch the hearth stones', text: 'Flat stones in a ring, numbered 1 through 9 in scratched tally marks. Rock four has a small crown drawn on it.' },
  Butterpat: { label: 'admire the butter churn', text: 'Polished from years of patient work. A ribbon on the handle reads “BEST BUTTER — ONLY ENTRANT — STILL EARNED IT.”' },
};

const HOUSE_STYLES = {
  Clover: { wall: 0xf3e6cf, roof: 0x6fae5c, door: 0x4e9a45 },
  Biscuit: { wall: 0xe3c98f, roof: 0x8a5a3a, door: 0x6b4a2e },
  Saffron: { wall: 0xf3d9bb, roof: 0xe8743a, door: 0xb05a2a },
  Howell: { wall: 0xcdd3da, roof: 0x5a6a80, door: 0x3a4a5c },
  Bramble: { wall: 0xc9a06a, roof: 0x55772f, door: 0x55483a },
  Marigold: { wall: 0xf5ecd8, roof: 0xd9a440, door: 0xb05a4a },
  Ember: { wall: 0xd9a08a, roof: 0x6e5048, door: 0xe8743a },
  Butterpat: { wall: 0xfdf6e8, roof: 0x6e5a44, door: 0x8a5a3a },
};

function makeCottage({ wall, roof, door }, scale = 1) {
  const g = new THREE.Group();
  const walls = box(4.6 * scale, 2.6 * scale, 4 * scale, wall);
  walls.position.y = 1.3 * scale;
  g.add(walls);
  const roofMesh = new THREE.Mesh(
    new THREE.ConeGeometry(3.8 * scale, 1.9 * scale, 4), mat(roof));
  roofMesh.position.y = 3.4 * scale;
  roofMesh.rotation.y = Math.PI / 4;
  roofMesh.castShadow = true;
  g.add(roofMesh);
  const doorMesh = box(0.95 * scale, 1.7 * scale, 0.16, door);
  doorMesh.position.set(0, 0.85 * scale, 2.01 * scale);
  g.add(doorMesh);
  const knob = new THREE.Mesh(new THREE.IcosahedronGeometry(0.06, 0), mat(0xf2cf5b, 0.4));
  knob.position.set(0.3 * scale, 0.85 * scale, 2.12 * scale);
  g.add(knob);
  const win = new THREE.Mesh(new THREE.CylinderGeometry(0.35 * scale, 0.35 * scale, 0.14, 8), mat(0xbfe6f2, 0.3));
  win.rotation.x = Math.PI / 2;
  win.position.set(-1.3 * scale, 1.5 * scale, 2.0 * scale);
  g.add(win);
  return g;
}

// Houses near a slope get honest wooden stilts under their low corners,
// instead of hovering — island carpentry at its finest.
function addStilts(group, x, z, baseH, half, rotY) {
  const cs = Math.cos(rotY), sn = Math.sin(rotY);
  for (const [cx, cz] of [[half, half], [half, -half], [-half, half], [-half, -half]]) {
    const wx = x + cx * cs + cz * sn;
    const wz = z - cx * sn + cz * cs;
    const ground = terrainHeight(wx, wz);
    if (ground < baseH - 0.3) {
      const len = baseH - ground + 0.5;
      const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.13, 0.16, len, 6), mat(0x6b4a2e));
      pole.position.set(wx, baseH - len / 2 + 0.1, wz);
      pole.castShadow = true;
      group.add(pole);
    }
  }
}

// ----------------------------------------------------------- the garden ----

const PLOT_OFFSETS = [
  [-1.4, 0], [0, 0], [1.4, 0],
  [-1.4, 1.6], [0, 1.6], [1.4, 1.6],
];

function plotStage(plot) {
  if (!plot) return 'empty';
  const g = GROWTH[plot.seed];
  if (!g) return 'empty';
  const f = (Date.now() - plot.plantedAt) / (g.secs * 1000);
  if (f >= 1) return 'ready';
  return f < 0.45 ? 'sprout' : 'leafy';
}

function buildPlotVisual(stage, seed) {
  const g = new THREE.Group();
  if (stage === 'sprout') {
    const s = new THREE.Mesh(new THREE.ConeGeometry(0.08, 0.22, 5), mat(0x6fae5c, 0.8));
    s.position.y = 0.16;
    g.add(s);
  } else if (stage === 'leafy') {
    for (let i = 0; i < 3; i++) {
      const leaf = new THREE.Mesh(new THREE.IcosahedronGeometry(0.14, 0), mat(0x55b055, 0.8));
      leaf.position.set(rand(-0.18, 0.18), 0.2 + rand(0, 0.1), rand(-0.18, 0.18));
      leaf.scale.y = 0.7;
      g.add(leaf);
    }
  } else if (stage === 'ready') {
    const grown = GROWTH[seed];
    const looks = {
      carrot: { color: 0xff9430, r: 0.13, n: 3, y: 0.12 },
      tomato: { color: 0xd84f4f, r: 0.14, n: 3, y: 0.18 },
      pumpkin: { color: 0xe8743a, r: 0.3, n: 1, y: 0.24 },
    }[grown.produce];
    for (let i = 0; i < looks.n; i++) {
      const p = new THREE.Mesh(new THREE.IcosahedronGeometry(looks.r, 0), mat(looks.color, 0.6));
      p.position.set(looks.n === 1 ? 0 : (i - 1) * 0.32, looks.y, rand(-0.1, 0.1));
      g.add(p);
    }
    const tuft = new THREE.Mesh(new THREE.ConeGeometry(0.07, 0.18, 5), mat(0x4e9a45, 0.8));
    tuft.position.y = looks.y + looks.r + 0.08;
    g.add(tuft);
  }
  return g;
}

// --------------------------------------------------- villager interiors ----

function buildVillagerInterior(group, B, name, style) {
  // the shell: floor, three walls, a warm lamp
  const floor = new THREE.Mesh(new THREE.BoxGeometry(11, 0.4, 9), mat(0x9a7448));
  floor.position.set(B.x, -0.2, B.z);
  floor.receiveShadow = true;
  floor.castShadow = true;
  group.add(floor);
  for (const [w, h, d, x, y, z] of [
    [11, 4.0, 0.4, B.x, 2.0, B.z - 4.5],
    [0.4, 4.0, 9, B.x - 5.5, 2.0, B.z],
    [0.4, 4.0, 9, B.x + 5.5, 2.0, B.z],
  ]) {
    const wall = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat(style.wall));
    wall.position.set(x, y, z);
    group.add(wall);
  }
  // everyone gets a bed in their colors and a rug
  const bedFrame = box(1.6, 0.45, 2.4, 0x8a5a3a);
  bedFrame.position.set(B.x - 3.4, 0.22, B.z - 2.8);
  const mattress = box(1.45, 0.25, 2.2, 0xfffaf0);
  mattress.position.set(B.x - 3.4, 0.55, B.z - 2.8);
  const blanket = box(1.5, 0.12, 1.3, style.roof);
  blanket.position.set(B.x - 3.4, 0.68, B.z - 2.4);
  group.add(bedFrame, mattress, blanket);
  const rug = new THREE.Mesh(new THREE.CylinderGeometry(1.5, 1.5, 0.06, 9), mat(style.door, 0.85));
  rug.position.set(B.x + 0.5, 0.06, B.z + 0.5);
  group.add(rug);

  // ...and a home that could only be theirs
  if (name === 'Clover') {
    const pastels = [0xffd9e8, 0xd9e8ff, 0xfff3c9, 0xe2ffd9, 0xf3d9ff];
    for (let i = 0; i < 7; i++) {
      const cushion = new THREE.Mesh(new THREE.IcosahedronGeometry(rand(0.3, 0.45), 1), mat(pastels[i % 5], 0.95));
      cushion.scale.y = 0.45;
      cushion.position.set(B.x + rand(-1.5, 4), 0.18, B.z + rand(-3, 2.5));
      group.add(cushion);
    }
    const teaTable = new THREE.Mesh(new THREE.CylinderGeometry(0.7, 0.7, 0.1, 8), mat(0xfff3da, 0.7));
    teaTable.position.set(B.x - 1.5, 0.45, B.z - 3.2);
    const teaLeg = box(0.15, 0.4, 0.15, 0xd9c08f);
    teaLeg.position.set(B.x - 1.5, 0.2, B.z - 3.2);
    group.add(teaTable, teaLeg);
  } else if (name === 'Biscuit') {
    for (let i = 0; i < 5; i++) {
      const patch = new THREE.Mesh(new THREE.CircleGeometry(rand(0.3, 0.55), 7), mat(0x77603f));
      patch.rotation.x = -Math.PI / 2;
      patch.position.set(B.x + rand(-3.5, 4), 0.02, B.z + rand(-3.5, 3));
      group.add(patch);
      if (i < 3) {
        const mound = new THREE.Mesh(new THREE.IcosahedronGeometry(0.25, 0), mat(0x8a6f4d));
        mound.scale.y = 0.5;
        mound.position.set(patch.position.x, 0.1, patch.position.z);
        group.add(mound);
      }
    }
    const shelf = box(2.4, 0.14, 0.8, 0x8a5a3a);
    shelf.position.set(B.x - 1.5, 1.5, B.z - 4.0);
    group.add(shelf);
    const treasures = [0x9aa0a6, 0xf2cf5b, 0xe8dcc0];
    treasures.forEach((c, i) => {
      const tr = new THREE.Mesh(new THREE.IcosahedronGeometry(0.14, 0), mat(c, 0.5));
      tr.position.set(B.x - 2.2 + i * 0.7, 1.68, B.z - 4.0);
      group.add(tr);
    });
  } else if (name === 'Saffron') {
    for (let i = 0; i < 5; i++) {
      const bunch = new THREE.Group();
      for (let k = 0; k < 3; k++) {
        const bloom = new THREE.Mesh(new THREE.IcosahedronGeometry(0.09, 0),
          mat(pick([0xc77dff, 0xff9bb0, 0xffd23e]), 0.85));
        bloom.position.set(rand(-0.08, 0.08), -0.3 - k * 0.08, rand(-0.05, 0.05));
        bunch.add(bloom);
      }
      const stem = new THREE.Mesh(new THREE.CylinderGeometry(0.02, 0.02, 0.3, 4), mat(0x7a8a4a));
      stem.position.y = -0.15;
      bunch.add(stem);
      bunch.position.set(B.x - 4 + i * 2, 3.1, B.z - 4.1);
      group.add(bunch);
    }
    for (let i = 0; i < 4; i++) {
      const bottle = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.1, rand(0.2, 0.35), 6),
        mat(pick([0xbfe6f2, 0xe2a9ff, 0xffd9c9]), 0.3));
      bottle.position.set(B.x + 3 + (i % 2) * 0.5, 1.4 + Math.floor(i / 2) * 0.5, B.z - 4.0);
      group.add(bottle);
    }
  } else if (name === 'Howell') {
    // the moon poster: dark frame, pale moon, total sincerity
    const posterFrame = box(2.0, 2.4, 0.12, 0x1d2738);
    posterFrame.position.set(B.x - 1.5, 1.7, B.z - 4.4);
    group.add(posterFrame);
    const moon = new THREE.Mesh(new THREE.CircleGeometry(0.7, 12),
      new THREE.MeshBasicMaterial({ color: 0xf4f0dc }));
    moon.position.set(B.x - 1.5, 1.9, B.z - 4.32);
    group.add(moon);
    const post = new THREE.Mesh(new THREE.CylinderGeometry(0.18, 0.2, 1.6, 7), mat(0xc9a06a, 1));
    post.position.set(B.x + 3.4, 0.8, B.z - 3.2);
    group.add(post); // the scratching post. for wolf reasons.
    const bookStand = box(0.8, 1.0, 0.5, 0x55483a);
    bookStand.position.set(B.x + 3.4, 0.5, B.z + 1.8);
    const book = box(0.62, 0.1, 0.45, 0xc25b4e);
    book.position.set(B.x + 3.4, 1.06, B.z + 1.8);
    book.rotation.z = 0.08;
    group.add(bookStand, book);
  } else if (name === 'Marigold') {
    // ribbon wall + hay corner
    for (let i = 0; i < 5; i++) {
      const ribbon = new THREE.Mesh(new THREE.CylinderGeometry(0.14, 0.14, 0.06, 8),
        mat(pick([0xd84f4f, 0x5b8bc9, 0xffd23e]), 0.5));
      ribbon.rotation.x = Math.PI / 2;
      ribbon.position.set(B.x - 3.2 + i * 1.4, 2.2, B.z - 4.32);
      group.add(ribbon);
      const tail1 = box(0.1, 0.4, 0.04, 0xc25b4e);
      tail1.position.set(ribbon.position.x - 0.06, 1.9, B.z - 4.32);
      group.add(tail1);
    }
    for (let i = 0; i < 6; i++) {
      const hay = box(rand(0.5, 0.9), 0.2, rand(0.4, 0.7), 0xe8d49a);
      hay.position.set(B.x + 3.6 + rand(-0.6, 0.6), 0.1 + i * 0.16, B.z - 3 + rand(-0.5, 0.5));
      hay.rotation.y = rand(0, Math.PI);
      group.add(hay);
    }
    const shoe = new THREE.Mesh(new THREE.TorusGeometry(0.26, 0.05, 6, 10, Math.PI * 1.3), mat(0x9aa0a6, 0.4));
    shoe.position.set(B.x, 2.6, B.z - 4.32);
    shoe.rotation.z = Math.PI * 0.85; // ends up — luck stays in
    group.add(shoe);
  } else if (name === 'Ember') {
    // a ring of numbered warm stones around a little hearth
    for (let i = 0; i < 9; i++) {
      const a2 = (i / 9) * Math.PI * 2;
      const stone = new THREE.Mesh(new THREE.IcosahedronGeometry(rand(0.28, 0.42), 0), mat(0x8a7468, 0.95));
      stone.scale.y = 0.4;
      stone.position.set(B.x + 1 + Math.cos(a2) * 2.2, 0.12, B.z - 1 + Math.sin(a2) * 1.8);
      group.add(stone);
    }
    const hearth = new THREE.Mesh(new THREE.CylinderGeometry(0.5, 0.6, 0.25, 8), mat(0x55504c));
    hearth.position.set(B.x + 1, 0.12, B.z - 1);
    group.add(hearth);
    const embers = new THREE.Mesh(new THREE.CircleGeometry(0.4, 8),
      new THREE.MeshBasicMaterial({ color: 0xff8a4c }));
    embers.rotation.x = -Math.PI / 2;
    embers.position.set(B.x + 1, 0.26, B.z - 1);
    group.add(embers);
  } else if (name === 'Butterpat') {
    // the churn, the pails, and a portrait of a truly excellent field
    const churn = new THREE.Group();
    const barrel = new THREE.Mesh(new THREE.CylinderGeometry(0.35, 0.42, 0.9, 9), mat(0x8a5a3a));
    barrel.position.y = 0.45;
    churn.add(barrel);
    const handle = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.04, 0.8, 5), mat(0x6b4a2e));
    handle.position.y = 1.2;
    churn.add(handle);
    churn.position.set(B.x + 3.2, 0, B.z - 3.4);
    group.add(churn);
    for (let i = 0; i < 3; i++) {
      const pail = new THREE.Mesh(new THREE.CylinderGeometry(0.2, 0.16, 0.34, 8), mat(0x9aa0a6, 0.5));
      pail.position.set(B.x - 1 + i * 0.7, 0.17, B.z - 3.9);
      group.add(pail);
    }
    const fieldFrame = box(1.6, 1.1, 0.1, 0x8a5a3a);
    fieldFrame.position.set(B.x + 1, 2.1, B.z - 4.35);
    group.add(fieldFrame);
    const fieldArt = new THREE.Mesh(new THREE.PlaneGeometry(1.35, 0.85),
      new THREE.MeshBasicMaterial({ color: 0x6ec45a }));
    fieldArt.position.set(B.x + 1, 2.1, B.z - 4.29);
    group.add(fieldArt);
  } else if (name === 'Bramble') {
    const chair = new THREE.Group();
    const seat = box(1.6, 0.5, 1.5, 0x8a5a3a);
    seat.position.y = 0.45;
    const back = box(1.6, 1.3, 0.35, 0x8a5a3a);
    back.position.set(0, 1.1, -0.6);
    const cushion = box(1.4, 0.22, 1.2, 0x6fae5c);
    cushion.position.y = 0.78;
    chair.add(seat, back, cushion);
    chair.position.set(B.x + 2.8, 0, B.z - 2.6);
    chair.rotation.y = -0.5;
    group.add(chair);
    for (let i = 0; i < 3; i++) {
      const pot = new THREE.Mesh(new THREE.CylinderGeometry(0.22, 0.26, 0.4, 8), mat(0xd9a440, 0.5));
      pot.position.set(B.x - 1.8 + i * 0.7, 0.2, B.z - 3.9);
      const lid = new THREE.Mesh(new THREE.CylinderGeometry(0.24, 0.24, 0.08, 8), mat(0x8a5a3a));
      lid.position.set(pot.position.x, 0.44, pot.position.z);
      group.add(pot, lid);
    }
    const plant = new THREE.Group();
    const planter = new THREE.Mesh(new THREE.CylinderGeometry(0.3, 0.24, 0.4, 7), mat(0xb05a4a, 0.8));
    planter.position.y = 0.2;
    plant.add(planter);
    for (let k = 0; k < 3; k++) {
      const frond = new THREE.Mesh(new THREE.ConeGeometry(0.1, 0.7, 5), mat(0x55b055));
      frond.position.set(Math.cos(k * 2.1) * 0.12, 0.7, Math.sin(k * 2.1) * 0.12);
      frond.rotation.x = Math.cos(k * 2.1) * 0.3;
      plant.add(frond);
    }
    plant.position.set(B.x - 4.5, 0, B.z + 2.5);
    group.add(plant);
  }
}

// ------------------------------------------------------------- the works ----

export function createHouses(animals, obstacles = []) {
  const group = new THREE.Group();
  const updates = [];
  const home = SITES.home;

  // ----- your cottage
  const cottage = makeCottage({ wall: 0xfdf6e8, roof: 0x5b8bc9, door: 0xb05a4a }, 1.15);
  const hy = terrainHeight(home.x, home.z);
  cottage.position.set(home.x, hy, home.z - 1.5);
  group.add(cottage);
  addStilts(group, home.x, home.z - 1.5, hy, 2.5, 0);
  zones.addBlocker(home.x, home.z - 1.5, 3.4);

  // window boxes, because it is YOUR house
  for (const sx of [-1, 1]) {
    const wbox = box(0.9, 0.25, 0.3, 0x8a5a3a);
    wbox.position.set(home.x + sx * 1.6, hy + 0.95, home.z + 0.85);
    group.add(wbox);
    for (let i = 0; i < 3; i++) {
      const bloom = new THREE.Mesh(new THREE.IcosahedronGeometry(0.09, 0),
        mat(pick([0xff6b81, 0xffd23e, 0xc77dff]), 0.6));
      bloom.position.set(home.x + sx * 1.6 + (i - 1) * 0.26, hy + 1.15, home.z + 0.85);
      group.add(bloom);
    }
  }

  // ----- cottage interior
  const B = IN_HOME;
  {
    // floor + walls (same dollhouse recipe as the village interiors)
    const floor = new THREE.Mesh(new THREE.BoxGeometry(13, 0.4, 10), mat(0xa97c50));
    floor.position.set(B.x, -0.2, B.z);
    floor.receiveShadow = true;
    floor.castShadow = true;
    group.add(floor);
    for (const [w, h, d, x, y, z] of [
      [13, 4.4, 0.4, B.x, 2.2, B.z - 5],
      [0.4, 4.4, 10, B.x - 6.5, 2.2, B.z],
      [0.4, 4.4, 10, B.x + 6.5, 2.2, B.z],
    ]) {
      const wallMesh = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat(0xf0e2c8));
      wallMesh.position.set(x, y, z);
      group.add(wallMesh);
    }
    // the bed
    const bedFrame = box(2.0, 0.5, 3.0, 0x8a5a3a);
    bedFrame.position.set(B.x - 4.6, 0.25, B.z - 3.2);
    const mattress = box(1.8, 0.3, 2.7, 0xfffaf0);
    mattress.position.set(B.x - 4.6, 0.6, B.z - 3.2);
    const pillow = box(1.2, 0.25, 0.7, 0xbfe6f2);
    pillow.position.set(B.x - 4.6, 0.82, B.z - 4.2);
    const blanket = box(1.85, 0.12, 1.6, 0xc25b4e);
    blanket.position.set(B.x - 4.6, 0.78, B.z - 2.6);
    group.add(bedFrame, mattress, pillow, blanket);
    register({
      pos: new THREE.Vector3(B.x - 3.4, 0, B.z - 3), r: 1.8, zone: 'home',
      label: 'flop onto the bed',
      use: async () => {
        await ui.fadeSwap(() => {});
        S.save();
        ui.toast('You napped wonderfully. The island will remember everything.', '😴');
        ui.say(pick([
          'You dream of a bell, ringing somewhere warm and underwater. It sounds happy.',
          'You dream you are a boat. A good one.',
          'Nothing needed you for a whole nap. It was wonderful.',
        ]));
      },
    });

    // bookshelf
    const shelf = box(2.6, 2.4, 0.5, 0x8a5a3a);
    shelf.position.set(B.x + 3.6, 1.2, B.z - 4.6);
    group.add(shelf);
    for (let i = 0; i < 8; i++) {
      const book = box(0.18, 0.5, 0.32, [0xc25b4e, 0x5b8bc9, 0x6fae5c, 0xffd23e][i % 4]);
      book.position.set(B.x + 2.6 + (i % 4) * 0.24 + (i > 3 ? 0.55 : 0), 1.0 + Math.floor(i / 4) * 0.7, B.z - 4.55);
      group.add(book);
    }
    register({
      pos: new THREE.Vector3(B.x + 3.6, 0, B.z - 3.9), r: 1.7, zone: 'home',
      label: 'browse the bookshelf',
      use: () => ui.say(`You pull one out at random: ${pick(BOOKS)}`),
    });

    // rug, table, the window with a sea view
    const rug = new THREE.Mesh(new THREE.CylinderGeometry(1.7, 1.7, 0.06, 10), mat(0xc9b178, 0.8));
    rug.position.set(B.x, 0.06, B.z + 0.6);
    group.add(rug);
    const table = new THREE.Mesh(new THREE.CylinderGeometry(0.8, 0.8, 0.12, 8), mat(0x8a5a3a));
    table.position.set(B.x, 0.95, B.z + 0.6);
    const tLeg = new THREE.Mesh(new THREE.CylinderGeometry(0.1, 0.14, 0.9, 6), mat(0x6b4a2e));
    tLeg.position.set(B.x, 0.45, B.z + 0.6);
    group.add(table, tLeg);
    const winFrame = box(1.8, 1.3, 0.18, 0x8a5a3a);
    winFrame.position.set(B.x - 1.5, 2.2, B.z - 4.85);
    const winSea = new THREE.Mesh(new THREE.PlaneGeometry(1.5, 1.0),
      new THREE.MeshBasicMaterial({ color: 0x9fdcf7 }));
    winSea.position.set(B.x - 1.5, 2.2, B.z - 4.74);
    group.add(winFrame, winSea);
    register({
      pos: new THREE.Vector3(B.x - 1.5, 0, B.z - 3.9), r: 1.6, zone: 'home',
      label: 'look out the window',
      use: () => ui.say('The window faces the sea. The sea, as far as you can tell, faces back.'),
    });

    zones.registerInterior('home', {
      floorY: 0,
      bounds: { x0: B.x - 6, x1: B.x + 6, z0: B.z - 4.4, z1: B.z + 4.4 },
      blockers: [
        { x: B.x - 4.6, z: B.z - 3.2, r: 1.5 }, // bed
        { x: B.x, z: B.z + 0.6, r: 0.8 },       // table
      ],
      spawn: { x: B.x, z: B.z + 3.8, rotY: Math.PI },
      lighting: {
        bg: 0x2a2018, fog: 0x2a2018, fogNear: 22, fogFar: 55,
        hemiSky: 0xffe9c8, hemiGround: 0x70573b, hemiIntensity: 1.25,
        sunIntensity: 0,
      },
    });
    register({
      pos: new THREE.Vector3(home.x, 0, home.z + 1.2), r: 2.4,
      label: 'go inside (it’s yours!)',
      use: () => zones.go('home'),
    });
    register({
      pos: new THREE.Vector3(B.x, 0, B.z + 4.6), r: 1.6, zone: 'home',
      label: 'step outside',
      use: () => zones.leaveTo({ x: home.x, z: home.z + 2.6, rotY: 0 }),
    });
  }

  // ----- the garden: six plots on the side of the cottage that faces away
  // from the village, so nothing squeezes against the shops
  const plots = [];
  const awayA = Math.atan2(home.x - SITES.village.x, home.z - SITES.village.z);
  const gx = home.x + Math.sin(awayA) * 4.6;
  const gz = home.z + Math.cos(awayA) * 4.6 + 1.2;
  for (let i = 0; i < PLOT_OFFSETS.length; i++) {
    const [ox, oz] = PLOT_OFFSETS[i];
    const px = gx + ox, pz = gz + oz;
    const py = terrainHeight(px, pz);
    const soil = box(1.15, 0.22, 1.15, 0x6b4a2e);
    soil.position.set(px, py + 0.08, pz);
    group.add(soil);
    const plot = { i, x: px, y: py, z: pz, visual: null, lastStage: null };
    plots.push(plot);

    register({
      pos: new THREE.Vector3(px, 0, pz), r: 1.6,
      label: () => {
        const stage = plotStage(S.state.garden[i]);
        if (stage === 'empty') return 'plant something';
        if (stage === 'ready') return 'harvest!';
        return 'growing…';
      },
      use: async () => {
        const data = S.state.garden[i];
        const stage = plotStage(data);
        if (stage === 'ready') {
          const grown = GROWTH[data.seed];
          delete S.state.garden[i];
          S.addItem(grown.produce, grown.n);
          S.save();
          jingle();
          ui.toast(`You harvested ${grown.n} × <b>${ITEMS[grown.produce].name}</b>!`, ITEMS[grown.produce].emoji);
          ui.updateHUD();
          return;
        }
        if (stage !== 'empty') {
          const g = GROWTH[data.seed];
          const left = Math.max(0, Math.ceil((g.secs * 1000 - (Date.now() - data.plantedAt)) / 60000));
          ui.say(left <= 1
            ? 'Almost there. It’s concentrating. You can tell.'
            : `Growing nicely. Give it about ${left} more minutes of being a plant.`);
          return;
        }
        const seedsOwned = Object.keys(GROWTH).filter((id) => S.countItem(id) > 0);
        if (!seedsOwned.length) {
          ui.say('Bare, hopeful soil. Pip sells seeds — carrots, tomatoes, pumpkins. The dirt has been practicing.');
          return;
        }
        const choice = await ui.ask('Plant what?', [
          ...seedsOwned.map((id) => ({
            label: `${ITEMS[id].emoji} ${ITEMS[id].name}`, value: id, hint: `×${S.countItem(id)}`,
          })),
          { label: 'Nothing today', value: null },
        ]);
        if (!choice) return;
        S.removeItem(choice, 1);
        S.state.garden[i] = { seed: choice, plantedAt: Date.now() };
        S.save();
        thud();
        ui.toast(`Planted <b>${ITEMS[choice].name}</b>. Now: the noble art of waiting.`, '🌱');
      },
    });
  }

  let gardenPoll = 0;
  updates.push((dt) => {
    gardenPoll -= dt;
    if (gardenPoll > 0) return;
    gardenPoll = 1;
    for (const plot of plots) {
      const data = S.state.garden[plot.i];
      const stage = plotStage(data);
      if (stage === plot.lastStage) continue;
      plot.lastStage = stage;
      if (plot.visual) group.remove(plot.visual);
      plot.visual = buildPlotVisual(stage, data?.seed);
      plot.visual.position.set(plot.x, plot.y + 0.18, plot.z);
      group.add(plot.visual);
    }
  });

  // ----- villager houses, each near where its owner likes to loiter
  const taken = [{ x: home.x, z: home.z }];
  function houseSpotNear(px, pz) {
    for (let r = 4; r < 14; r += 1.5) {
      for (let a = 0; a < Math.PI * 2; a += 0.45) {
        const x = px + Math.cos(a) * r;
        const z = pz + Math.sin(a) * r;
        const h = terrainHeight(x, z);
        if (h < 0.8 || h > 6.5) continue;
        if (!clearOfSites(x, z, 2.5)) continue;
        if (taken.some((q) => Math.hypot(q.x - x, q.z - z) < 7)) continue;
        // never drop a house on a villager — its blocker would trap them
        if (animals.some((a) => Math.hypot(a.g.position.x - x, a.g.position.z - z) < 3.4)) continue;
        // and never into a tree, pine, or rock
        if (obstacles.some((o) => Math.hypot(o.x - x, o.z - z) < o.r + 2.8)) continue;
        // a touch of flat ground for the doorstep, and no wild cliff-hangs
        if (Math.abs(terrainHeight(x, z + 2) - h) > 1.2) continue;
        const corners = [[2, 2], [2, -2], [-2, 2], [-2, -2]]
          .map(([cx, cz]) => terrainHeight(x + cx, z + cz));
        if (h - Math.min(...corners) > 2.6) continue;
        taken.push({ x, z });
        return { x, z, h };
      }
    }
    return null;
  }

  const households = []; // { a, name, zoneId, seat, doorOut, home }
  let villagerIdx = 0;

  for (const a of animals) {
    const name = a.identity?.name;

    if (name === 'Crumb') {
      // Crumb's house floats: nights are spent on the MouseBoat's deck
      if (!MOUSEBOAT) continue;
      const vh = {
        a, name, zoneId: 'island',
        seat: { x: MOUSEBOAT.deck.x, y: MOUSEBOAT.deck.y, z: MOUSEBOAT.deck.z },
        doorOut: MOUSEBOAT.doorOut,
        home: false,
      };
      households.push(vh);
      let crumbIdx = 0;
      register({
        getPos: () => a.g.position, r: 3.4,
        enabled: () => vh.home,
        label: 'call up to Crumb',
        use: () => {
          const lines = HOME_LINES.Crumb;
          ui.say(lines[crumbIdx++ % lines.length], { speaker: 'Crumb', voice: a.identity.voice });
        },
      });
      register({
        pos: new THREE.Vector3(MOUSEBOAT.knock.x, 0, MOUSEBOAT.knock.z), r: 2.2,
        enabled: () => !vh.home,
        label: 'peer at the MouseBoat',
        use: () => ui.say(KNOCKS.Crumb),
      });
      continue;
    }

    if (!name || !KNOCKS[name]) continue; // ducks handled below
    const spot = houseSpotNear(a.g.position.x, a.g.position.z);
    if (!spot) continue;
    const style = HOUSE_STYLES[name];
    const house = makeCottage(style, 0.8);
    house.position.set(spot.x, spot.h, spot.z);
    // face the house roughly toward its villager's patch
    house.rotation.y = Math.atan2(a.g.position.x - spot.x, a.g.position.z - spot.z);
    group.add(house);
    addStilts(group, spot.x, spot.z, spot.h, 1.9, house.rotation.y);
    zones.addBlocker(spot.x, spot.z, 2.6);

    const doorWorld = new THREE.Vector3(
      spot.x + Math.sin(house.rotation.y) * 2.4, 0,
      spot.z + Math.cos(house.rotation.y) * 2.4);
    const doorOut = {
      x: spot.x + Math.sin(house.rotation.y) * 3.2,
      z: spot.z + Math.cos(house.rotation.y) * 3.2,
      rotY: house.rotation.y,
    };

    // ----- their room, furnished to taste
    const B = { x: 300, z: 320 + villagerIdx * 80 };
    villagerIdx++;
    const zoneId = `house_${name.toLowerCase()}`;
    const seat = buildVillagerInterior(group, B, name, style);

    zones.registerInterior(zoneId, {
      floorY: 0,
      bounds: { x0: B.x - 5.1, x1: B.x + 5.1, z0: B.z - 4.0, z1: B.z + 4.4 },
      blockers: [{ x: B.x - 3.4, z: B.z - 2.8, r: 1.3 }], // the bed
      spawn: { x: B.x, z: B.z + 3.6, rotY: Math.PI },
      lighting: {
        bg: 0x2a2018, fog: 0x2a2018, fogNear: 20, fogFar: 50,
        hemiSky: 0xffe9c8, hemiGround: 0x70573b, hemiIntensity: 1.25,
        sunIntensity: 0,
      },
    });

    const vh = { a, name, zoneId, seat: { x: B.x + 1.6, z: B.z - 2.2 }, doorOut, home: false };
    households.push(vh);

    // the door knows whether anyone's in
    register({
      pos: doorWorld, r: 2.0,
      label: () => (vh.home ? `visit ${name}` : `knock on ${name}’s door`),
      use: async () => {
        doorChime();
        if (!vh.home) {
          ui.say(KNOCKS[name]);
          return;
        }
        await ui.say(COME_INS[name]);
        zones.go(zoneId);
      },
    });

    // them, at home
    let homeLineIdx = 0;
    register({
      getPos: () => a.g.position, r: 2.6, zone: zoneId,
      enabled: () => vh.home && !vh.inCave,
      label: `talk to ${name}`,
      use: () => {
        const lines = HOME_LINES[name];
        ui.say(lines[homeLineIdx++ % lines.length], { speaker: name, voice: a.identity.voice });
      },
    });

    // one personal prop each
    const prop = HOME_PROPS[name];
    register({
      pos: new THREE.Vector3(B.x - 1.5, 0, B.z - 3.2), r: 2.0, zone: zoneId,
      label: prop.label,
      use: () => ui.say(prop.text),
    });

    register({
      pos: new THREE.Vector3(B.x, 0, B.z + 4.0), r: 1.6, zone: zoneId,
      label: 'step outside',
      use: () => zones.leaveTo(doorOut),
    });
  }

  // Ember keeps a second address: the cave, at her appointed hours
  const ember = households.find((vh) => vh.name === 'Ember');
  if (ember) {
    ember.caveSeat = { x: -295.5, z: -4 };
    let caveIdx = 0;
    register({
      getPos: () => ember.a.g.position, r: 2.6, zone: 'cave',
      enabled: () => !!ember.inCave,
      label: 'talk to Ember',
      use: () => {
        const lines = HOME_LINES.Ember;
        ui.say(lines[caveIdx++ % lines.length], { speaker: 'Ember', voice: ember.a.identity.voice });
      },
    });
  }

  function emberCaveTime() {
    if (currentWeather() !== 'clear') return false; // rain days are outside days
    const h = hourNow();
    return h >= EMBER_CAVE_HOURS[0] && h < EMBER_CAVE_HOURS[1];
  }

  // the clock (and the weather) decides who's in
  let schedulePoll = 0;
  function applySchedules(force = false) {
    for (const vh of households) {
      let mode;
      if (vh.forced !== undefined) mode = vh.forced ? 'house' : 'out';
      else if (vh.name === 'Ember' && emberCaveTime()) mode = 'cave';
      else mode = isHomeNow(vh.name) ? 'house' : 'out';
      if (!force && mode === vh.mode) continue;
      vh.mode = mode;
      const homeNow = mode !== 'out';
      vh.home = homeNow;
      vh.inCave = mode === 'cave';
      vh.a.home = homeNow;
      vh.a.away = homeNow || !!vh.a.errand;
      if (mode === 'cave') {
        vh.a.g.position.set(vh.caveSeat.x, 0, vh.caveSeat.z);
        vh.a.g.rotation.y = Math.PI / 2;
      } else if (mode === 'house') {
        vh.a.g.position.set(vh.seat.x, vh.seat.y ?? 0, vh.seat.z);
        vh.a.g.rotation.y = 0; // facing the door, ready for visitors
      } else {
        vh.a.g.position.set(vh.doorOut.x, terrainHeight(vh.doorOut.x, vh.doorOut.z), vh.doorOut.z);
        vh.a.g.rotation.y = vh.doorOut.rotY;
        vh.a.state = 'idle';
        vh.a.timer = rand(1, 3);
      }
    }
  }
  applySchedules(true);
  updates.push((dt, t, playerPos) => {
    schedulePoll -= dt;
    if (schedulePoll <= 0) {
      schedulePoll = 2;
      applySchedules();
    }
    // home villagers breathe gently and turn to face their guest
    for (const vh of households) {
      if (!vh.home) continue;
      const parts = vh.a.g.userData.parts;
      const phase = vh.seat.x + vh.seat.z;
      parts.body.position.y = parts.bodyY + Math.sin(t * 1.5 + phase) * 0.03;
      parts.head.position.y = parts.headY + Math.sin(t * 1.5 + phase + 0.5) * 0.025;
      if (playerPos) {
        const dx = playerPos.x - vh.a.g.position.x;
        const dz = playerPos.z - vh.a.g.position.z;
        if (Math.hypot(dx, dz) < 8) {
          vh.a.g.rotation.y = turnToward(vh.a.g.rotation.y, Math.atan2(dx, dz), dt, 4);
        }
      }
    }
  });

  // ----- the ducks' beach nest
  const duck = animals.find((a) => a.swims);
  if (duck) {
    const nx = duck.g.position.x, nz = duck.g.position.z;
    const nest = new THREE.Group();
    for (let i = 0; i < 8; i++) {
      const ang = (i / 8) * Math.PI * 2;
      const stick = box(0.7, 0.12, 0.14, 0xa97c50);
      stick.position.set(Math.cos(ang) * 0.8, 0.1, Math.sin(ang) * 0.8);
      stick.rotation.y = ang + Math.PI / 2 + rand(-0.3, 0.3);
      nest.add(stick);
    }
    const pillow = box(0.6, 0.18, 0.6, 0xbfe6f2);
    pillow.position.y = 0.12;
    nest.add(pillow);
    const ny = Math.max(terrainHeight(nx, nz), 0.05);
    nest.position.set(nx, ny, nz);
    group.add(nest);
    register({
      pos: nest.position, r: 2.0,
      label: 'peek into the nest',
      use: () => ui.say('A tidy ring of driftwood. Inside: one (1) regulation pillow and a snack stash labeled “PROVISIONS — ADMIRAL’S EYES ONLY (PUDDLE: NO).”'),
    });
  }

  function update(dt, t, playerPos) {
    for (const u of updates) u(dt, t, playerPos);
  }

  // test/debug: pin a villager home (true), out (false), or back to the clock (undefined)
  function forceHome(name, value) {
    const vh = households.find((h) => h.name === name);
    if (!vh) return;
    vh.forced = value;
    applySchedules(true);
  }

  return { group, update, forceHome };
}

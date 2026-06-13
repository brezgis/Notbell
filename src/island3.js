// The north isle: moss with tenure, mushrooms in committee, a library, a
// doctor for an island where nobody gets sick, and — parked forever — the
// Buttonwagon. Reached by the natural stone arch the sea carved itself.

import * as THREE from 'three';
import { SITES, ISLAND3, terrainHeight, WATER_Y } from './terrain.js';
import * as zones from './zones.js';
import { register } from './interact.js';
import * as ui from './ui.js';
import * as S from './state.js';
import { buildAnimal } from './animals.js';
import { jingle, sip, kaching } from './audio.js';
import { rand, pick, turnToward } from './utils.js';

// where the MouseBoat is moored — houses.js puts Crumb to bed on its deck
export let MOUSEBOAT = null;

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
  library: { x: 300, z: 1060 },
  clinic: { x: 300, z: 1140 },
};

// The Quiet Stacks hold real volumes from the wider world shelved cheek-by-jowl
// with the island's own. Each of the four stacks is anchored to one shelf; you
// draw a single book at random from whichever you're standing at, so the same
// passage never turns up at two positions. Verse uses " / " line breaks (the
// dialogue box collapses real newlines, and white-space:pre-wrap would change
// every other dialogue). The real excerpts are public domain, quoted verbatim.
const STACKS3 = [
  // — salt water —
  [
    {
      title: '“Moby-Dick,” by Herman Melville.',
      note: 'Salt-swollen, and read well past the library’s rules.',
      passage: 'Call me Ishmael. Some years ago—never mind how long precisely—having little or no money in my purse, and nothing particular to interest me on shore, I thought I would sail about a little and see the watery part of the world.',
      voice: 430,
    },
    {
      title: '“The Sea Also Listens,” by a Friend of the Listeners.',
      passage: 'First lesson: the sea does not answer. Second lesson: that is not the same as not listening. We ring no bell here — we keep the quiet a bell would leave behind.',
      voice: 470,
    },
    {
      title: '“Moonlit Night,” by Du Fu.',
      note: 'Translated by Florence Ayscough & Amy Lowell, 1921.',
      passage: [
        'To-night—the moon at Fu Chou. / In the centre of the Women’s Apartments / There is only one to look at it. / I am far away, but I love my little son, my daughter. / They cannot understand and think of Ch’ang An.',
        'The sweet-smelling mist makes the cloud head-dress damp, / The jade arm must be chilly / In this clear, glorious shining. / When shall I lean on the lonely screen? / When shall we both be shone upon, and the scars of tears be dry?',
      ],
      voice: 520,
    },
    {
      title: '“Boats I Have Whistled At,” by Capt. E. Brine.',
      note: 'Signed, smudged, and faintly damp.',
      passage: 'A boat will go where you point it and sulk the whole way, or go where it pleases and let you call that seamanship. I have whistled at four hundred boats. Two whistled back. I do not discuss the second one.',
      voice: 360,
    },
  ],
  // — quiet rooms —
  [
    {
      title: '“Jane Eyre,” by Charlotte Brontë.',
      note: 'A faded ribbon marks a page very near the end.',
      passage: 'Reader, I married him. A quiet wedding we had: he and I, the parson and clerk, were alone present.',
      voice: 560,
    },
    {
      title: '“Spring Quiet,” by Christina Rossetti.',
      passage: 'Here the sun shineth / Most shadily; / Here is heard an echo / Of the far sea, / Though far off it be.',
      voice: 600,
    },
    {
      title: '“Moss: A Love Story (Unabridged, 9 vols.).”',
      passage: 'Volume Six. He had not moved. Neither had she. Between them the patient green crept one heroic inch across the stone — and the narrator assures us, with feeling, that this is the most that has ever happened to anyone.',
      voice: 580,
    },
  ],
  // — the sky, and other large ideas —
  [
    {
      title: '“War and Peace,” by Leo Tolstoy.',
      note: 'Heavier than the shelf it came from.',
      passage: 'It seemed to Pierre that this comet fully responded to what was passing in his own softened and uplifted soul, now blossoming into a new life.',
      voice: 500,
    },
    {
      title: '“Hope is the thing with feathers,” by Emily Dickinson.',
      passage: [
        'Hope is the thing with feathers / That perches in the soul, / And sings the tune without the words, / And never stops at all,',
        'And sweetest in the gale is heard; / And sore must be the storm / That could abash the little bird / That kept so many warm.',
      ],
      voice: 640,
    },
    {
      title: '“Practical Ghostkeeping.”',
      note: 'Someone has written “thank you” in the margin, in very cold ink.',
      passage: 'Chapter One: You Cannot Tidy A Ghost, But You May Leave Things Findable. Chapter Two: A Polished Hook Is A Kindness. Chapter Three: If The Brass Is Already Shining, Do Not Ask Who.',
      voice: 420,
    },
  ],
  // — the island’s own —
  [
    {
      title: '“Les Misérables,” by Victor Hugo.',
      note: 'Translated by Isabel F. Hapgood, 1887.',
      passage: '“The beautiful is as useful as the useful.” He added after a pause, “More so, perhaps.”',
      voice: 480,
    },
    {
      title: '“I Am a Cat,” by Natsume Sōseki.',
      note: 'Translated by Kan-ichi Andō, 1906.',
      passage: 'I am a cat; but as yet I have no name. Where I was born is entirely unknown to me. But this still dimly lives in my memory. I was mewing in a gloomy damp place, where I got the first sight of a creature called man.',
      voice: 600,
    },
    {
      title: '“Edible Mushrooms of the North Isle,” heavily annotated.',
      passage: 'Entry 9, the speckled cap: the author recommends it sautéed. The margin replies, in a firmer hand: “NO.” Entry 10: “ALSO NO.” Entry 11, at last: “fine. but only this one. and only Fern knows why.”',
      voice: 520,
    },
    {
      title: '“The Lightkeeper’s Logbook, Years 1–34,” by Old Tansy.',
      note: 'The final page is missing.',
      passage: 'Year 22, a fog with no manners. Rang the bell from dusk until the boats were all counted home. A good bell does half a lighthouse’s work, and never once asks for the credit. — T.',
      voice: 540,
    },
  ],
];
const ALL_BOOKS3 = STACKS3.flat(); // Vesper lends from the whole library

const VESPER_LORE = [
  'Records? Mm. I keep the island’s memory in paper, the way Fern keeps it in stone and the cave keeps it in light.',
  'Tansy’s logbook ends mid-sentence, you know. The last page is missing. I expect it’s wherever the bell is. Filed under “sea.”',
  'The moss on the arch is older than the library. I consider it the senior librarian. We don’t argue.',
];

const GILL_CHAT = [
  'Nobody on these islands has been sick in living memory. I stay for the view, and on principle.',
  'I lost an arm once. Grew it back. I don’t recommend it as a hobby, but it’s a tremendous party fact.',
  'Brush your teeth, sleep with the window cracked, and tell someone your favorite cloud daily. Doctor’s orders.',
];

const FROG_LINES = [
  'It is doing a push-up. It knows it looks good.',
  'Its colors say “danger.” Its face says “invite me to things.”',
  'It blinks one eye, then the other. Showing off, frankly.',
  'You should absolutely not pick it up, and it has made peace with the loneliness of beauty.',
];

export function createIsland3() {
  const group = new THREE.Group();
  const updates = [];
  const T = SITES.town3;
  const ty = terrainHeight(T.x, T.z);

  // ------------------------------------------------- the natural arch ----
  {
    const len0 = Math.hypot(ISLAND3.x, ISLAND3.z);
    const dir = { x: ISLAND3.x / len0, z: ISLAND3.z / len0 };
    let tA = 24;
    while (terrainHeight(dir.x * (tA + 0.5), dir.z * (tA + 0.5)) >= 0.15) tA += 0.5;
    let tB = len0 - 14;
    while (terrainHeight(dir.x * (tB - 0.5), dir.z * (tB - 0.5)) >= 0.15) tB -= 0.5;
    const A = { x: dir.x * tA, z: dir.z * tA };
    const LEN = tB - tA;
    const along = dir;
    const perp = { x: -dir.z, z: dir.x };
    const hA = terrainHeight(A.x, A.z);
    const hB = terrainHeight(dir.x * tB, dir.z * tB);
    const archY = (t) => hA + (hB - hA) * t + Math.sin(t * Math.PI) * 3.2 + 0.5;

    zones.addCrossing({
      contains(x, z) {
        const dx = x - A.x, dz = z - A.z;
        const t = (dx * along.x + dz * along.z) / LEN;
        if (t < -0.02 || t > 1.02) return false;
        return Math.abs(dx * perp.x + dz * perp.z) < 1.55;
      },
      height(x, z) {
        const t = Math.max(0, Math.min(1, ((x - A.x) * along.x + (z - A.z) * along.z) / LEN));
        return archY(t);
      },
    });

    const slabCount = Math.ceil(LEN / 1.6);
    for (let i = 0; i <= slabCount; i++) {
      const t = i / slabCount;
      const px = A.x + along.x * t * LEN, pz = A.z + along.z * t * LEN;
      const slab = box(3.6 + rand(-0.3, 0.4), rand(0.7, 1.1), 1.8, i % 3 ? 0x7d8287 : 0x73807a);
      slab.position.set(px + rand(-0.1, 0.1), archY(t) - 0.45, pz);
      slab.rotation.y = Math.atan2(along.x, along.z) + rand(-0.04, 0.04);
      slab.receiveShadow = true;
      group.add(slab);
      // the senior librarian (moss)
      if (i % 2 === 0) {
        const moss = new THREE.Mesh(new THREE.IcosahedronGeometry(rand(0.35, 0.6), 0), mat(0x4f8a52, 0.95));
        moss.scale.y = 0.25;
        moss.position.set(px + rand(-1.2, 1.2), archY(t) + 0.05, pz + rand(-0.6, 0.6));
        group.add(moss);
      }
      // barnacles crust the slab sides near the waterline
      if (t > 0.12 && t < 0.88 && i % 2 === 1) {
        for (let b = 0; b < 3; b++) {
          const barn = new THREE.Mesh(new THREE.IcosahedronGeometry(rand(0.06, 0.11), 0), mat(0xe8e4d8, 0.6));
          barn.position.set(
            px + perp.x * (1.85 * (b % 2 ? 1 : -1)),
            archY(t) - rand(1.2, 2.4),
            pz + perp.z * (1.85 * (b % 2 ? 1 : -1)));
          group.add(barn);
        }
      }
      // stout pillars where the arch rides highest
      if (i === Math.floor(slabCount / 2) || i === Math.floor(slabCount / 4) || i === Math.floor(3 * slabCount / 4)) {
        const pil = new THREE.Mesh(
          new THREE.CylinderGeometry(0.7, 1.1, archY(t) - WATER_Y + 2, 6), mat(0x6e7873));
        pil.position.set(px, (archY(t) + WATER_Y - 2) / 2, pz);
        group.add(pil);
      }
    }
  }

  // ------------------------------------------------------- moss & such ----
  const flora = [];
  const TREE_STRUCTURE_CLEARANCE = 3;
  const treeKeepouts = [
    { x: T.x - 5.5, z: T.z - 3, r: 4.2 + TREE_STRUCTURE_CLEARANCE },
    { x: T.x + 5.5, z: T.z - 3, r: 3.8 + TREE_STRUCTURE_CLEARANCE },
    { x: T.x, z: T.z + 6.5, r: 2.8 + TREE_STRUCTURE_CLEARANCE },
    { x: T.x + 3.5, z: T.z + 5.5, r: 1.8 + TREE_STRUCTURE_CLEARANCE },
  ];
  function clearOfTreeKeepouts(x, z) {
    if (zones.nearBlocker(x, z, TREE_STRUCTURE_CLEARANCE)) return false;
    return !treeKeepouts.some((k) => Math.hypot(x - k.x, z - k.z) < k.r);
  }
  function placeOnIsle(minH, maxH, tries = 40, opts = {}) {
    for (let i = 0; i < tries; i++) {
      const a = rand(0, Math.PI * 2);
      const r = Math.sqrt(rand(0, 1)) * (ISLAND3.r + 2);
      const x = ISLAND3.x + Math.cos(a) * r, z = ISLAND3.z + Math.sin(a) * r;
      if (Math.hypot(x - T.x, z - T.z) < T.r - 2) continue;
      if (opts.trees && !clearOfTreeKeepouts(x, z)) continue;
      const h = terrainHeight(x, z);
      if (h < minH || h > maxH) continue;
      if (flora.some((f) => Math.hypot(f.x - x, f.z - z) < 1.2)) continue;
      flora.push({ x, z });
      return { x, z, h };
    }
    return null;
  }

  const shroomSpots = [];
  for (let i = 0; i < 34; i++) {
    const s = placeOnIsle(0.5, 6);
    if (!s) continue;
    const cluster = new THREE.Group();
    const n = 1 + Math.floor(rand(0, 3));
    for (let k = 0; k < n; k++) {
      const red = rand(0, 1) < 0.5;
      const stem = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.09, rand(0.25, 0.5), 5), mat(0xe8e0d0, 0.8));
      const sx = rand(-0.35, 0.35), sz = rand(-0.35, 0.35);
      stem.position.set(sx, 0.2, sz);
      cluster.add(stem);
      const cap = new THREE.Mesh(new THREE.ConeGeometry(rand(0.18, 0.3), rand(0.18, 0.28), 7), mat(red ? 0xd84f4f : 0xc9a06a, 0.8));
      cap.position.set(sx, 0.42, sz);
      cluster.add(cap);
      if (red) {
        for (let d = 0; d < 3; d++) {
          const dot = new THREE.Mesh(new THREE.IcosahedronGeometry(0.035, 0), mat(0xfff6e8, 0.6));
          const da = rand(0, Math.PI * 2);
          dot.position.set(sx + Math.cos(da) * 0.13, 0.47, sz + Math.sin(da) * 0.13);
          cluster.add(dot);
        }
      }
    }
    cluster.position.set(s.x, s.h, s.z);
    cluster.traverse((o) => { if (o.isMesh) o.castShadow = true; });
    group.add(cluster);
    shroomSpots.push(s);
  }
  for (let i = 0; i < 22; i++) {
    const s = placeOnIsle(0.4, 6);
    if (!s) continue;
    const moss = new THREE.Mesh(new THREE.IcosahedronGeometry(rand(0.4, 0.9), 0), mat(pick([0x4f8a52, 0x5e975e, 0x3f7a45]), 0.95));
    moss.scale.y = rand(0.18, 0.3);
    moss.position.set(s.x, s.h + 0.05, s.z);
    group.add(moss);
  }
  for (let i = 0; i < 9; i++) {
    const s = placeOnIsle(0.8, 6, 40, { trees: true });
    if (!s) continue;
    const tree = new THREE.Group();
    const trunk = new THREE.Mesh(new THREE.CylinderGeometry(0.26, 0.4, 1.7, 7), mat(0x4a3f32));
    trunk.position.y = 0.85;
    tree.add(trunk);
    const crown = new THREE.Mesh(new THREE.IcosahedronGeometry(rand(1.4, 1.9), 1), mat(pick([0x3f7a45, 0x4f8a52]), 0.95));
    crown.position.y = 2.6;
    crown.scale.y = 0.85;
    tree.add(crown);
    const drape = new THREE.Mesh(new THREE.IcosahedronGeometry(0.5, 0), mat(0x5e975e, 0.95));
    drape.scale.set(0.6, 1.4, 0.6);
    drape.position.set(rand(-1, 1), 1.8, rand(-0.6, 0.6));
    tree.add(drape);
    tree.position.set(s.x, s.h - 0.05, s.z);
    tree.traverse((o) => { if (o.isMesh) o.castShadow = true; });
    group.add(tree);
  }

  // ---------------------------------------------------------- library ----
  const libSpot = { x: T.x - 5.5, z: T.z - 3 };
  {
    const ly = terrainHeight(libSpot.x, libSpot.z);
    const ext = new THREE.Group();
    const walls = box(6.8, 3.4, 5.8, 0x9a8a78);
    walls.position.y = 1.7;
    ext.add(walls);
    const roofGeo = new THREE.CylinderGeometry(2.4, 2.4, 7.2, 3, 1, false, Math.PI / 2);
    roofGeo.rotateZ(Math.PI / 2);
    const roof = new THREE.Mesh(roofGeo, mat(0x3f7a45));
    roof.scale.y = 0.8;
    roof.position.y = 4.2;
    roof.castShadow = true;
    ext.add(roof);
    const door = box(1.2, 2.0, 0.18, 0x4a3f32);
    door.position.set(0, 1.0, 2.91);
    ext.add(door);
    for (const sx of [-2, 2]) {
      const win = box(1.0, 1.2, 0.14, 0xbfe6f2);
      win.position.set(sx, 1.9, 2.92);
      ext.add(win);
    }
    const mossRoof = new THREE.Mesh(new THREE.IcosahedronGeometry(0.8, 0), mat(0x4f8a52, 0.95));
    mossRoof.scale.y = 0.3;
    mossRoof.position.set(-1.5, 4.6, 0.5);
    ext.add(mossRoof);
    ext.position.set(libSpot.x, ly, libSpot.z);
    ext.traverse((o) => { if (o.isMesh && !o.material.transparent) o.castShadow = true; });
    group.add(ext);
    zones.addBlocker(libSpot.x, libSpot.z, 4.2);

    const B = IN.library;
    const roomStart = group.children.length;
    const floor = box(16, 0.4, 12, 0x7a5a40);
    floor.position.set(B.x, -0.2, B.z);
    floor.receiveShadow = true;
    group.add(floor);
    for (const [w, h, d, x, y, z] of [
      [16, 5.0, 0.4, B.x, 2.5, B.z - 6],
      [0.4, 5.0, 12, B.x - 8, 2.5, B.z],
      [0.4, 5.0, 12, B.x + 8, 2.5, B.z],
    ]) {
      const wall = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat(0xd9cbb0));
      wall.position.set(x, y, z);
      group.add(wall);
    }
    // stacks: tall shelves with rows of colorful spines — one anchored book
    // collection (STACKS3) per shelf; press E at a shelf to read a random one
    const spineColors = [0xc25b4e, 0x5b8bc9, 0x6fae5c, 0xd9a440, 0x8a5a8a];
    const SHELF_X = [-6.2, -2.2, 1.8, 5.8];
    SHELF_X.forEach((sx, i) => {
      const shelf = box(3.2, 3.6, 0.9, 0x6b4a2e);
      shelf.position.set(B.x + sx, 1.8, B.z - 5.2);
      group.add(shelf);
      for (let row = 0; row < 4; row++) {
        for (let bIdx = 0; bIdx < 7; bIdx++) {
          const spine = box(0.28, 0.62, 0.16, spineColors[(row + bIdx + Math.abs(sx) | 0) % 5]);
          spine.position.set(B.x + sx - 1.25 + bIdx * 0.42, 0.7 + row * 0.86, B.z - 4.72);
          group.add(spine);
        }
      }
      register({
        pos: new THREE.Vector3(B.x + sx, 0, B.z - 4.6), r: 2.2, zone: 'library',
        label: 'read a book',
        use: async () => {
          const book = pick(STACKS3[i]);
          const body = Array.isArray(book.passage) ? book.passage : [book.passage];
          await ui.say([book.note ? `${book.title} ${book.note}` : book.title, ...body],
            { voice: book.voice ?? 480 });
        },
      });
    });
    const ladder = new THREE.Group();
    for (const lx of [-0.3, 0.3]) {
      const rail = box(0.08, 3.4, 0.08, 0x8a6f4d);
      rail.position.set(lx, 1.7, 0);
      ladder.add(rail);
    }
    for (let rIdx = 0; rIdx < 5; rIdx++) {
      const rung = box(0.6, 0.07, 0.07, 0x8a6f4d);
      rung.position.set(0, 0.5 + rIdx * 0.62, 0);
      ladder.add(rung);
    }
    ladder.position.set(B.x + 3.6, 0, B.z - 4.5);
    ladder.rotation.x = -0.12;
    group.add(ladder);
    // reading nook + desk
    const nook = new THREE.Mesh(new THREE.IcosahedronGeometry(0.8, 1), mat(0xc25b4e, 0.95));
    nook.scale.y = 0.4;
    nook.position.set(B.x + 5.5, 0.3, B.z + 2.5);
    group.add(nook);
    const desk = box(2.6, 1.0, 1.2, 0x6b4a2e);
    desk.position.set(B.x - 4, 0.5, B.z + 1);
    group.add(desk);
    const openBook = box(0.7, 0.06, 0.5, 0xfff6e8);
    openBook.position.set(B.x - 4, 1.06, B.z + 1);
    openBook.rotation.y = 0.3;
    group.add(openBook);

    const vesper = buildAnimal('bat', { body: 0x6a5a78, head: 0x6a5a78 });
    vesper.position.set(B.x - 4, 0, B.z - 0.2);
    group.add(vesper);
    wireBob(vesper, updates, 0.8);

    const room = collectInteriorRoot(group, roomStart);
    zones.registerInterior('library', {
      root: room,
      floorY: 0,
      bounds: { x0: B.x - 7.6, x1: B.x + 7.6, z0: B.z - 4.0, z1: B.z + 5.5 },
      blockers: [
        { x: B.x - 4, z: B.z + 1, r: 1.5 },
        { x: B.x + 5.5, z: B.z + 2.5, r: 1.0 },
      ],
      spawn: { x: B.x, z: B.z + 4.8, rotY: Math.PI },
      lighting: {
        bg: 0x241f18, fog: 0x241f18, fogNear: 24, fogFar: 60,
        hemiSky: 0xf2e2c0, hemiGround: 0x5a4a38, hemiIntensity: 1.2,
        sunIntensity: 0,
      },
    });
    register({
      pos: new THREE.Vector3(libSpot.x, 0, libSpot.z + 3.6), r: 2.6,
      label: 'enter the Quiet Stacks',
      use: () => zones.go('library'),
    });
    register({
      pos: new THREE.Vector3(B.x, 0, B.z + 5.2), r: 1.6, zone: 'library',
      label: 'step outside',
      use: () => zones.leaveTo({ x: libSpot.x, z: libSpot.z + 4.6, rotY: 0 }),
    });

    let loreIdx = 0;
    register({
      getPos: () => vesper.position, r: 3, zone: 'library',
      label: 'talk to Vesper',
      use: async () => {
        if (!S.hasFlag('metVesper')) {
          S.setFlag('metVesper');
          await ui.say([
            'A bat hangs upside down from the desk lamp, reading. She rights herself with great dignity.',
            '“Vesper. Librarian. Whisper if you can, mumble if you must. Welcome to the Quiet Stacks.”',
          ], { speaker: 'Vesper', voice: 540 });
          return;
        }
        const choice = await ui.ask('Mm?', [
          { label: '📖 Borrow a book', value: 'borrow' },
          { label: 'Ask about the records', value: 'lore' },
          { label: 'Leave', value: null },
        ], { speaker: 'Vesper', voice: 540 });
        if (choice === 'borrow') {
          const book = pick(ALL_BOOKS3);
          jingle();
          ui.toast(`You borrow ${book.title} Due date: whenever.`, '📖');
          await ui.say('Spine uncracked, corners unfolded, returned before the moss notices. The usual terms.',
            { speaker: 'Vesper', voice: 540 });
        } else if (choice === 'lore') {
          await ui.say(VESPER_LORE[loreIdx++ % VESPER_LORE.length], { speaker: 'Vesper', voice: 540 });
        }
      },
    });
  }

  // ----------------------------------------------------------- clinic ----
  const clinSpot = { x: T.x + 5.5, z: T.z - 3 };
  {
    const cy = terrainHeight(clinSpot.x, clinSpot.z);
    const ext = new THREE.Group();
    const walls = box(5.6, 3.0, 5.0, 0xf0ece4);
    walls.position.y = 1.5;
    ext.add(walls);
    const roof = new THREE.Mesh(new THREE.ConeGeometry(4.6, 2.0, 4), mat(0x5b8bc9));
    roof.position.y = 3.9;
    roof.rotation.y = Math.PI / 4;
    roof.castShadow = true;
    ext.add(roof);
    const door = box(1.1, 1.9, 0.18, 0x5b8bc9);
    door.position.set(0, 0.95, 2.51);
    ext.add(door);
    // the gentle cross of a place that mostly hands out lollipops
    const crossV = box(0.5, 1.3, 0.12, 0x8fce7a);
    crossV.position.set(0, 3.0, 2.56);
    const crossH = box(1.3, 0.5, 0.12, 0x8fce7a);
    crossH.position.set(0, 3.0, 2.56);
    ext.add(crossV, crossH);
    ext.position.set(clinSpot.x, cy, clinSpot.z);
    ext.traverse((o) => { if (o.isMesh) o.castShadow = true; });
    group.add(ext);
    zones.addBlocker(clinSpot.x, clinSpot.z, 3.8);

    const B = IN.clinic;
    const roomStart = group.children.length;
    const floor = box(12, 0.4, 9, 0xd8dcd2);
    floor.position.set(B.x, -0.2, B.z);
    floor.receiveShadow = true;
    group.add(floor);
    for (const [w, h, d, x, y, z] of [
      [12, 4.2, 0.4, B.x, 2.1, B.z - 4.5],
      [0.4, 4.2, 9, B.x - 6, 2.1, B.z],
      [0.4, 4.2, 9, B.x + 6, 2.1, B.z],
    ]) {
      const wall = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat(0xeaf4f0));
      wall.position.set(x, y, z);
      group.add(wall);
    }
    // cot, desk, lollipop jar, and the eye chart (it's all paw prints)
    const cot = box(1.6, 0.55, 2.6, 0xb9c0b9);
    cot.position.set(B.x - 4, 0.27, B.z - 2.6);
    const cotTop = box(1.45, 0.2, 2.4, 0xffffff);
    cotTop.position.set(B.x - 4, 0.62, B.z - 2.6);
    group.add(cot, cotTop);
    const deskC = box(2.4, 1.0, 1.1, 0x8a9a92);
    deskC.position.set(B.x + 2.5, 0.5, B.z - 2.4);
    group.add(deskC);
    const jar = new THREE.Mesh(new THREE.CylinderGeometry(0.22, 0.22, 0.5, 8),
      new THREE.MeshStandardMaterial({ color: 0xbfe6f2, transparent: true, opacity: 0.5, roughness: 0.2 }));
    jar.position.set(B.x + 3.2, 1.25, B.z - 2.4);
    group.add(jar);
    for (let i = 0; i < 5; i++) {
      const pop = new THREE.Mesh(new THREE.IcosahedronGeometry(0.06, 0),
        mat(pick([0xff6b81, 0xffd23e, 0x8fce7a]), 0.5));
      pop.position.set(B.x + 3.2 + rand(-0.08, 0.08), 1.1 + i * 0.07, B.z - 2.4 + rand(-0.08, 0.08));
      group.add(pop);
    }
    // eye chart: descending paw prints
    const chartCv = document.createElement('canvas');
    chartCv.width = 128;
    chartCv.height = 192;
    const cctx = chartCv.getContext('2d');
    cctx.fillStyle = '#fffaf0';
    cctx.fillRect(0, 0, 128, 192);
    cctx.fillStyle = '#5b4a32';
    cctx.textAlign = 'center';
    let yy = 36;
    for (const size of [40, 28, 20, 14, 9, 6]) {
      cctx.font = `${size}px sans-serif`;
      cctx.fillText('🐾'.repeat(Math.min(6, Math.ceil(40 / size))), 64, yy);
      yy += size + 12;
    }
    const chartTex = new THREE.CanvasTexture(chartCv);
    chartTex.colorSpace = THREE.SRGBColorSpace;
    const chart = new THREE.Mesh(new THREE.PlaneGeometry(1.0, 1.5),
      new THREE.MeshBasicMaterial({ map: chartTex }));
    chart.position.set(B.x, 2.2, B.z - 4.28);
    group.add(chart);

    const gill = buildAnimal('axolotl', { body: 0xf2b8c6, head: 0xf2b8c6 });
    gill.position.set(B.x + 2.5, 0, B.z - 3.4);
    group.add(gill);
    wireBob(gill, updates, 0.9);

    const room = collectInteriorRoot(group, roomStart);
    zones.registerInterior('clinic', {
      root: room,
      floorY: 0,
      bounds: { x0: B.x - 5.6, x1: B.x + 5.6, z0: B.z - 3.0, z1: B.z + 4.1 },
      blockers: [
        { x: B.x - 4, z: B.z - 2.6, r: 1.4 },
        { x: B.x + 2.5, z: B.z - 2.4, r: 1.4 },
      ],
      spawn: { x: B.x, z: B.z + 3.4, rotY: Math.PI },
      lighting: {
        bg: 0x202824, fog: 0x202824, fogNear: 22, fogFar: 55,
        hemiSky: 0xf0fff8, hemiGround: 0x586058, hemiIntensity: 1.25,
        sunIntensity: 0,
      },
    });
    register({
      pos: new THREE.Vector3(clinSpot.x, 0, clinSpot.z + 3.2), r: 2.6,
      label: 'enter the clinic',
      use: () => zones.go('clinic'),
    });
    register({
      pos: new THREE.Vector3(B.x, 0, B.z + 3.8), r: 1.6, zone: 'clinic',
      label: 'step outside',
      use: () => zones.leaveTo({ x: clinSpot.x, z: clinSpot.z + 4.2, rotY: 0 }),
    });

    let chatIdx = 0;
    register({
      getPos: () => gill.position, r: 3, zone: 'clinic',
      label: 'talk to Dr. Gill',
      use: async () => {
        if (!S.hasFlag('metGill')) {
          S.setFlag('metGill');
          await ui.say([
            'A pink axolotl in a tiny white coat looks up, gill-fronds bobbing like festive antennae.',
            '“Dr. Gill. Nobody here gets sick, so mostly I do check-ups, hand out lollipops, and admire everyone’s excellent health. Hop up whenever.”',
          ], { speaker: 'Dr. Gill', voice: 500 });
          return;
        }
        const choice = await ui.ask('What brings you in? (Nothing. It’s always nothing. Wonderful.)', [
          { label: '🩺 Get a check-up', value: 'checkup' },
          { label: 'Chat', value: 'chat' },
          { label: 'Leave', value: null },
        ], { speaker: 'Dr. Gill', voice: 500 });
        if (choice === 'checkup') {
          await ui.say([
            '“Eyes on the chart… read me the bottom row.” (It is six microscopic paw prints.) “Close enough.”',
            '“Breathe in… and out. Lovely. Heart’s keeping excellent time — slightly syncopated, very fashionable.”',
            '“Reflexes—” (a tiny hammer appears from somewhere) “—superb. You flinched with real artistry.”',
            '“Diagnosis: in perfect health, possibly thriving. Keep doing whatever this is. Lollipop?”',
          ], { speaker: 'Dr. Gill', voice: 500 });
          jingle();
          ui.toast('Clean bill of health, plus a lollipop. <i>It’s the good flavor.</i>', '🍭');
          S.setFlag('hadCheckup');
        } else if (choice === 'chat') {
          await ui.say(GILL_CHAT[chatIdx++ % GILL_CHAT.length], { speaker: 'Dr. Gill', voice: 500 });
        }
      },
    });
  }

  // ------------------------------------------------- the Buttonwagon ----
  {
    const bx = T.x, bz = T.z + 6.5;
    const by = terrainHeight(bx, bz);
    const wagon = new THREE.Group();
    const bed = box(3.4, 0.3, 1.8, 0x8a5a3a);
    bed.position.y = 0.75;
    wagon.add(bed);
    for (const [sx, sz] of [[-1.2, 0.8], [1.2, 0.8], [-1.2, -0.8], [1.2, -0.8]]) {
      const wheel = new THREE.Mesh(new THREE.CylinderGeometry(0.45, 0.45, 0.2, 9), mat(0x55483a));
      wheel.rotation.x = Math.PI / 2;
      wheel.position.set(sx, 0.45, sz);
      wagon.add(wheel);
    }
    // THE BUTTON. enormous. mother-of-pearl. unexplained.
    const button = new THREE.Mesh(new THREE.CylinderGeometry(2.1, 2.1, 0.45, 16), mat(0xf2e8da, 0.35));
    button.rotation.x = Math.PI / 2;
    button.position.y = 2.85;
    wagon.add(button);
    for (const [hx, hy] of [[-0.55, 0.55], [0.55, 0.55], [-0.55, -0.55], [0.55, -0.55]]) {
      const hole = new THREE.Mesh(new THREE.CylinderGeometry(0.22, 0.22, 0.55, 10), mat(0x55504c, 0.6));
      hole.rotation.x = Math.PI / 2;
      hole.position.set(hx, 2.85 + hy, 0);
      wagon.add(hole);
    }
    const hitch = box(1.4, 0.12, 0.12, 0x6b4a2e);
    hitch.position.set(2.3, 0.7, 0);
    wagon.add(hitch);
    wagon.position.set(bx, by, bz);
    wagon.rotation.y = 0.5;
    wagon.traverse((o) => { if (o.isMesh) o.castShadow = true; });
    group.add(wagon);
    zones.addBlocker(bx, bz, 2.8);

    register({
      pos: new THREE.Vector3(bx + 2.5, 0, bz + 1.5), r: 2.6,
      label: 'inspect the Buttonwagon',
      use: () => ui.say([
        'An enormous mother-of-pearl button, mounted on a cart. A small plaque:',
        '“THE BUTTONWAGON. PIP’S MARKETING INITIATIVE, YEAR OF THE AMBITIOUS SPRING. IT DROVE ONCE. THE ISLAND HAS AGREED NEVER AGAIN.”',
        'Someone — almost certainly Pip — still waxes it. It is immaculate.',
      ]),
    });
  }

  // -------------------------------------------- the very poisonous frog ----
  {
    const fs = shroomSpots[0] ?? { x: T.x + 8, z: T.z + 2, h: ty };
    const frog = new THREE.Group();
    const fBody = new THREE.Mesh(new THREE.IcosahedronGeometry(0.13, 0), mat(0x2a7fe8, 0.5));
    fBody.scale.set(1, 0.75, 1.2);
    fBody.position.y = 0.1;
    frog.add(fBody);
    for (const sx of [-1, 1]) {
      const eye = new THREE.Mesh(new THREE.IcosahedronGeometry(0.045, 0), mat(0x222222, 0.3));
      eye.position.set(sx * 0.07, 0.21, 0.08);
      frog.add(eye);
      const legF = new THREE.Mesh(new THREE.IcosahedronGeometry(0.05, 0), mat(0xff9430, 0.5));
      legF.scale.set(1, 0.6, 1.6);
      legF.position.set(sx * 0.13, 0.04, -0.04);
      frog.add(legF);
    }
    frog.position.set(fs.x + 0.7, terrainHeight(fs.x + 0.7, fs.z + 0.4), fs.z + 0.4);
    group.add(frog);
    let hopT = rand(1, 3);
    let hop = 99;
    updates.push((dt) => {
      hopT -= dt;
      if (hopT <= 0) { hop = 0; hopT = rand(2, 5); }
      if (hop < 0.35) {
        hop += dt;
        frog.position.y = terrainHeight(frog.position.x, frog.position.z) +
          Math.sin(Math.min(hop / 0.35, 1) * Math.PI) * 0.18;
      }
    });
    let frogIdx = 0;
    register({
      getPos: () => frog.position, r: 1.8,
      label: 'admire the very poisonous frog (do not touch)',
      use: () => ui.say(FROG_LINES[frogIdx++ % FROG_LINES.length]),
    });
  }

  // ----------------------------------------------------- the MouseBoat ----
  {
    // a mooring on whichever shore faces away from the arch — and clear of
    // the Labs causeway, which has right of way on account of being a bridge
    const cwLen = Math.hypot(SITES.labsYard.x - ISLAND3.x, SITES.labsYard.z - ISLAND3.z);
    const cwx = (SITES.labsYard.x - ISLAND3.x) / cwLen;
    const cwz = (SITES.labsYard.z - ISLAND3.z) / cwLen;
    let mx = ISLAND3.x, mz = ISLAND3.z + ISLAND3.r;
    outer:
    for (let a = 0; a < Math.PI * 2; a += 0.2) {
      for (let r = ISLAND3.r - 4; r < ISLAND3.r + 6; r += 0.6) {
        const x = ISLAND3.x + Math.cos(a) * r, z = ISLAND3.z + Math.sin(a) * r;
        const toOrigin = (x * -ISLAND3.x + z * -ISLAND3.z); // arch side check
        if (toOrigin > 0) continue;
        if (Math.cos(a) * cwx + Math.sin(a) * cwz > 0.35) continue; // causeway side
        const h = terrainHeight(x, z);
        if (h > -0.05 || h < -0.45) continue;
        if (terrainHeight(x * 1.06, z * 1.06) > WATER_Y - 0.3) continue;
        mx = x; mz = z;
        break outer;
      }
    }
    const seaward = Math.atan2(mx - ISLAND3.x, mz - ISLAND3.z);
    const bx = mx + Math.sin(seaward) * 3.4, bz = mz + Math.cos(seaward) * 3.4;

    const boat = new THREE.Group();
    const hull = box(3.2, 1.0, 5.4, 0x8a3a30);
    hull.position.y = 0.3;
    boat.add(hull);
    const deck = box(3.0, 0.16, 5.2, 0xa97c50);
    deck.position.y = 0.85;
    boat.add(deck);
    const cabin = box(2.4, 1.7, 2.8, 0xf3e6cf);
    cabin.position.set(0, 1.75, -0.8);
    boat.add(cabin);
    const cabinRoof = box(2.7, 0.16, 3.1, 0x4f8f6a);
    cabinRoof.position.set(0, 2.66, -0.8);
    boat.add(cabinRoof);
    const porthole = new THREE.Mesh(new THREE.CylinderGeometry(0.26, 0.26, 0.1, 8), mat(0xbfe6f2, 0.3));
    porthole.rotation.x = Math.PI / 2;
    porthole.position.set(0, 1.8, 0.65);
    boat.add(porthole);
    const stovepipe = new THREE.Mesh(new THREE.CylinderGeometry(0.1, 0.12, 0.7, 6), mat(0x2e2a26));
    stovepipe.position.set(0.8, 3.0, -1.4);
    boat.add(stovepipe);
    // an enormous wedge of "ballast" lashed to the bow. it is cheese.
    const cheese = new THREE.Mesh(new THREE.CylinderGeometry(0.55, 0.55, 0.5, 3), mat(0xf2cf5b, 0.6));
    cheese.position.set(0, 1.2, 1.8);
    cheese.rotation.y = 0.4;
    boat.add(cheese);
    boat.position.set(bx, WATER_Y + 0.25, bz);
    boat.rotation.y = seaward + Math.PI / 2;
    boat.traverse((o) => { if (o.isMesh) o.castShadow = true; });
    group.add(boat);
    updates.push((dt, t) => {
      boat.position.y = WATER_Y + 0.25 + Math.sin(t * 0.9) * 0.05;
      boat.rotation.z = Math.sin(t * 0.8) * 0.012;
    });
    // mooring post + a plank to shore
    const post = box(0.16, 1.1, 0.16, 0x6b4a2e);
    post.position.set(mx, terrainHeight(mx, mz) + 0.55, mz);
    group.add(post);
    const plank = box(0.9, 0.1, 3.4, 0x96703f);
    plank.position.set((mx + bx) / 2, 0.6, (mz + bz) / 2);
    plank.rotation.y = seaward;
    group.add(plank);

    MOUSEBOAT = {
      deck: { x: bx, y: WATER_Y + 1.2, z: bz },
      knock: { x: mx, z: mz },
      doorOut: { x: mx - Math.sin(seaward) * 1.5, z: mz - Math.cos(seaward) * 1.5, rotY: seaward + Math.PI },
    };
  }

  // ------------------------------------------- the Buttonwagon food cart ----
  {
    const cx = T.x + 3.5, cz = T.z + 5.5;
    const cy2 = terrainHeight(cx, cz);
    const cart = new THREE.Group();
    const body = box(2.6, 1.2, 1.4, 0xf2e8da);
    body.position.y = 1.1;
    cart.add(body);
    for (const sx of [-1, 1]) {
      const wheel = new THREE.Mesh(new THREE.CylinderGeometry(0.5, 0.5, 0.18, 9), mat(0x55483a));
      wheel.rotation.x = Math.PI / 2;
      wheel.position.set(sx * 1.0, 0.5, 0.75);
      cart.add(wheel);
    }
    for (let i = 0; i < 5; i++) {
      const slat = box(0.56, 0.07, 1.2, i % 2 ? 0xfff3da : 0xb05a4a);
      slat.position.set(-1.15 + i * 0.57, 2.35, -0.1);
      slat.rotation.x = 0.4;
      cart.add(slat);
    }
    const pot2 = new THREE.Mesh(new THREE.CylinderGeometry(0.4, 0.34, 0.5, 9), mat(0x2e2a26, 0.5));
    pot2.position.set(0.5, 1.95, 0);
    cart.add(pot2);
    // sponsor's mark: a proud little button on the side
    const sponsorButton = new THREE.Mesh(new THREE.CylinderGeometry(0.35, 0.35, 0.1, 12), mat(0xf2cf5b, 0.35));
    sponsorButton.rotation.x = Math.PI / 2;
    sponsorButton.position.set(-0.6, 1.2, 0.73);
    cart.add(sponsorButton);
    cart.position.set(cx, cy2, cz);
    cart.rotation.y = -0.5;
    cart.traverse((o) => { if (o.isMesh) o.castShadow = true; });
    group.add(cart);
    zones.addBlocker(cx, cz, 1.8);

    register({
      pos: new THREE.Vector3(cx + 1.4, 0, cz + 1.4), r: 2.4,
      label: 'visit the stew cart',
      use: async () => {
        const choice = await ui.ask(
          'A painted banner: “BUTTONWAGON PRESENTS: BUTTON MUSHROOM STEW. (THE BUTTONWAGON DOES NOT COOK. THE BUTTONWAGON BELIEVES.)”', [
            { label: '🍲 Button mushroom stew', value: 'stew', hint: '25🔘', disabled: S.state.buttons < 25 },
            { label: 'Ask about the sponsorship', value: 'sponsor' },
            { label: 'Leave', value: null },
          ]);
        if (choice === 'stew') {
          S.spend(25);
          S.drinkCoffee(30);
          kaching();
          sip();
          ui.updateHUD();
          ui.toast('Earthy, buttery, suspiciously perfect. <i>Warm and quick for 30s!</i>', '🍲');
        } else if (choice === 'sponsor') {
          ui.say('The fine print: “THE BUTTONWAGON ASKED FOR NOTHING IN RETURN. THE BUTTONWAGON ONLY WANTED TO BE PART OF SOMETHING AGAIN.” …Oh. Oh no. Now you’re emotional at a stew cart.');
        }
      },
    });
  }

  // a welcome of sorts
  const sign = box(1.4, 0.8, 0.1, 0x8a6f4d);
  sign.position.set(T.x - 1, ty + 1.0, T.z + 3.5);
  sign.rotation.y = 0.2;
  const signPost = box(0.12, 1.0, 0.12, 0x6b4a2e);
  signPost.position.set(T.x - 1, ty + 0.5, T.z + 3.5);
  group.add(sign, signPost);
  register({
    pos: new THREE.Vector3(T.x - 1, 0, T.z + 3.5), r: 2,
    label: 'read the mossy sign',
    use: () => ui.say('“THE NORTH ISLE. QUIET, PLEASE — MOSS AT WORK. (The moss thanks you. The moss notices everything.)”'),
  });

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

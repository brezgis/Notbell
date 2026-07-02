// The Fold — the plain folk of the far shore. West of the Labs, past the
// edge of the chart (they asked, politely, to stay off it): a green, a kirk
// called the HOUSE OF COD, three cottages, a barn, wheat, carrots, preserves,
// and a small hill of well-kept stones. Sheep, mostly. Kind, unbothered,
// technology politely declined. They share an island with the archipelago's
// most advanced research institute. Nobody finds this strange. Both sides wave.
//
// This is its own quiet story lane — the Fold has no opinion about the bell.

import * as THREE from 'three';
import { SITES, terrainHeight } from './terrain.js';
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

const IN_KIRK = { x: 300, z: 1860 }; // the kirk interior, off in the elsewhere

const VOICE = { amos: 240, mercy: 370, patience: 330, obed: 265, lamb: 540 };

// ---------------------------------------------------------------- words ----

const COD_LORE = [
  'The Cod provides. Not everything, and not always — but enough, and mostly on Tuesdays. That is very nearly the whole of the catechism.',
  'Folk ask me if the Cod is real. Friend, the sea is real, and supper is real, and between the two of them swims something kind.',
  'We hung a wooden cod from the rafters so the sermon has somewhere to look when I lose my place. It has never once complained.',
  'Services are whenever the weather says so. The weather has excellent judgment and has never gone long on a sermon.',
];

const NEIGHBOR_LORE = [
  'The Labs? Good neighbors. They listen at the sky; we mend nets. Every net needs a far end, and I suspect we are theirs.',
  'They offered us the electric light once, very politely. We declined, very politely. Now we wave. It is a fine arrangement and nobody has to read a manual.',
  'Their rocket went up and we all leaned on our rakes to watch. A thing may be declined and still be admired. That is most things, in fact.',
];

const FOLD_LORE = [
  'We came out past the chart because the land was cheap and the quiet was free. The quiet has appreciated considerably.',
  'Wheat in, carrots up, preserves down for winter. The year is a wheel and we are very fond of the wheel.',
  'You will find no bell here and no missing one either. Other folks’ longing is their own to keep. We keep jam.',
];

const MERCY_CHAT = [
  'Preserves! Gooseberry, carrot, sea-plum. The Cod provides; I provide lids.',
  'Everything in these jars grew within pointing distance. We are not a shouting people.',
  'Take a jar for the road, friend. The road out here is long and entirely worth it.',
];

const PATIENCE_CHAT = [
  'Named Patience, handed carrots. Carrots take a season. Somebody in the naming business knew exactly what they were doing.',
  'Wheat in, wheat out. In between, weather. That is farming, friend — the rest is commentary.',
  'The Labs made our rain gauge sing once. We thanked them and gave it back. Rain counts fine on its own.',
];

const OBED_CHAT = [
  'Obed. I keep the barn and the fence keeps me. We are all kept by something.',
  'A fellow from the Labs waves at me each morning and I wave back. Eleven years now. Neither of us has missed a day. That is a friendship, that is.',
  'The barn leans a little east. So do I, by evening. We understand one another.',
];

const LAMB_CHAT = [
  'I’m Small Mercy! Ma’s the regular one. When I’m grown I get the rest of the name, and then — well. Mercy me.',
  'The sky-boat went WHOOSH once. Elder Amos says we don’t hold with rockets. I hold with them a LITTLE. Don’t tell.',
  'I’m learning preserves. So far I am very good at the part where you eat one to be sure.',
];

const KNOCKS = {
  mercy: 'A jar of gooseberry preserves sits on the step with a paper hat, waiting for somebody specific. Nobody in — the stall keeps her hours.',
  patience: 'A bootscraper, well used. A bench, well sat. From somewhere behind the house, the exact sound of weeding.',
  obed: 'The door is open an honest inch. A note, pinned flat: “IN THE BARN. OR THE FIELD. START WITH THE BARN.”',
  amos: 'A hut the size of a good thought. The door has no lock and has never wanted one. He will be at the kirk.',
};

const EPITAPHS = [
  'CONSTANCE — sixty winters. Preferred them.',
  'OBADIAH — mended the fence. The fence stands.',
  'VERITY — said little. Meant all of it.',
  'THANKFUL — was.',
  'PETER — fisher. The cod forgave him, mostly.',
  'A LAMB — briefly. Entirely loved.',
  'The seventh stone is older than its letters. You run a thumb along the top, the way everyone before you has, which is why it is smooth.',
];

// ---------------------------------------------------------------- props ----

// a carved wooden cod, pointing +x. the congregation's whole iconography.
function makeCod(len = 1, color = 0xa97c50) {
  const g = new THREE.Group();
  const m = mat(color, 0.8);
  const body = new THREE.Mesh(new THREE.IcosahedronGeometry(0.5, 1), m);
  body.scale.set(1.4, 0.52, 0.2);
  g.add(body);
  const tail = new THREE.Mesh(new THREE.ConeGeometry(0.26, 0.5, 3), m);
  tail.rotation.z = Math.PI / 2;
  tail.scale.z = 0.3;
  tail.position.set(-0.86, 0, 0);
  g.add(tail);
  const fin = new THREE.Mesh(new THREE.ConeGeometry(0.14, 0.3, 3), m);
  fin.scale.z = 0.3;
  fin.position.set(0.05, 0.32, 0);
  g.add(fin);
  for (const s of [-1, 1]) {
    const eye = new THREE.Mesh(new THREE.IcosahedronGeometry(0.045, 0), mat(0x3a3026, 0.5));
    eye.position.set(0.42, 0.1, s * 0.11);
    g.add(eye);
  }
  g.scale.setScalar(len);
  return g;
}

// the plain hat: flat brim, low crown, worn square
function flatBrimHat(color = 0x322d27) {
  const g = new THREE.Group();
  const brim = new THREE.Mesh(new THREE.CylinderGeometry(0.44, 0.44, 0.05, 10), mat(color, 0.7));
  g.add(brim);
  const crown = new THREE.Mesh(new THREE.CylinderGeometry(0.25, 0.28, 0.24, 8), mat(color, 0.7));
  crown.position.y = 0.14;
  g.add(crown);
  return g;
}

// the plain bonnet: a soft cap with a little curved brim at the front
function makeBonnet(color = 0xcdc4b0) {
  const g = new THREE.Group();
  const cap = new THREE.Mesh(new THREE.IcosahedronGeometry(0.3, 1), mat(color, 0.85));
  cap.scale.set(1.1, 0.6, 1.0);
  g.add(cap);
  const brim = new THREE.Mesh(
    new THREE.CylinderGeometry(0.34, 0.34, 0.2, 8, 1, true, -1.1, 2.2), mat(color, 0.85));
  brim.rotation.x = 0.35;
  brim.position.set(0, -0.02, 0.06);
  g.add(brim);
  return g;
}

// a work apron, worn over the wool
function makeApron(color = 0x5a6270) {
  const apron = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.58, 0.06), mat(color, 0.85));
  apron.position.set(0, 0.58, 0.62);
  apron.rotation.x = 0.12;
  return apron;
}

// band trees — same family as nature.js's, grown locally so the band can be
// planted deliberately (it is a hedge between neighbors, and a friendly one)
function makeOak(leaf = 0x55a055) {
  const g = new THREE.Group();
  const trunk = new THREE.Mesh(new THREE.CylinderGeometry(0.3, 0.42, 1.9, 7), mat(0x6e5136));
  trunk.position.y = 0.95;
  g.add(trunk);
  const leafMat = mat(leaf, 0.95);
  for (const [x, y, z, r] of [[0, 2.9, 0, 1.55], [0.95, 2.45, 0.25, 1.0], [-0.85, 2.5, -0.3, 1.05]]) {
    const blob = new THREE.Mesh(new THREE.IcosahedronGeometry(r, 1), leafMat);
    blob.position.set(x, y, z);
    g.add(blob);
  }
  return g;
}

function makeFir() {
  const g = new THREE.Group();
  const trunk = new THREE.Mesh(new THREE.CylinderGeometry(0.22, 0.3, 1.2, 7), mat(0x6e5136));
  trunk.position.y = 0.6;
  g.add(trunk);
  const needle = mat(0x4a8a4f, 0.95);
  for (const [r, h, y] of [[1.5, 1.6, 1.7], [1.15, 1.4, 2.8], [0.75, 1.2, 3.8]]) {
    const cone = new THREE.Mesh(new THREE.ConeGeometry(r, h, 8), needle);
    cone.position.y = y;
    g.add(cone);
  }
  return g;
}

// the sign: painted board, block letters, no serif within a mile of here
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

// ------------------------------------------------------------- the fold ----

export function createFold() {
  const group = new THREE.Group();
  const updates = [];      // (dt, t, playerPos) — island zone only
  const kirkUpdates = [];  // (dt, t, playerPos) — kirk zone only
  const ST = SITES.steading, FF = SITES.foldFields, KY = SITES.kirkyard;

  // keyless on purpose: the HUD learns the name, the chart never does.
  // they asked. the chart, which ends at the Labs anyway, was gracious.
  addIslandInfo({
    name: 'The Fold', x: -194, z: -50, r: 24, icon: '🐑',
    blurb: 'Off every chart, by request. Wheat, carrots, preserves, and the House of Cod.',
    folk: 'Elder Amos · Mercy · Patience · Obed · Small Mercy',
  });

  // ================================================== the HOUSE OF COD ----
  const KX = -199, KZ = -50; // the kirk, west side of the green, door east
  {
    const ky = terrainHeight(KX, KZ);
    const ext = new THREE.Group();
    // plinth first: plain folk do not float (see: the whole audit)
    const plinth = box(9.4, 1.4, 6.8, 0x8a8378);
    plinth.position.y = -0.55;
    ext.add(plinth);
    const nave = box(8.8, 3.4, 6.2, 0xe9e5da); // whitewash, no steeple. plain.
    nave.userData.occlude = true;
    nave.position.y = 1.7;
    ext.add(nave);
    // ridge runs east-west (along x): r ≈ (depth + eaves) / 1.73
    const roofGeo = new THREE.CylinderGeometry(4.05, 4.05, 9.6, 3, 1, false, Math.PI / 2);
    roofGeo.rotateZ(Math.PI / 2);
    const roof = new THREE.Mesh(roofGeo, mat(0x5c5348));
    roof.scale.y = 0.45;
    roof.position.y = 3.4;
    roof.castShadow = roof.receiveShadow = true;
    ext.add(roof);
    // door on the gable end, facing the green
    const door = box(1.4, 2.2, 0.16, 0x4a3a2c);
    door.position.set(4.46, 1.1, 0);
    ext.add(door);
    // the sign hangs out under the gable, saying the one thing it needs to
    const sign = signBoard('HOUSE OF COD');
    sign.position.set(4.98, 2.62, 0);
    sign.rotation.y = Math.PI / 2;
    ext.add(sign);
    for (const sz of [-1.3, 1.3]) {
      const rod = box(0.06, 0.7, 0.06, 0x4a3f33);
      rod.position.set(4.95, 3.25, sz);
      ext.add(rod);
    }
    // a wooden cod for a weathervane. wind-powered. permitted. beloved.
    const vanePost = box(0.08, 1.0, 0.08, 0x4a3f33);
    vanePost.position.set(0, 5.3, 0);
    ext.add(vanePost);
    const vane = makeCod(0.75, 0xc9b99a);
    vane.position.set(0, 5.8, 0);
    ext.add(vane);
    updates.push((dt) => { vane.rotation.y += dt * 0.22; }); // a very patient wind
    // two square windows a side, candle-warm after dark
    for (const sz of [-1, 1]) {
      for (const wx of [-1.9, 1.9]) {
        const pane = new THREE.Mesh(new THREE.BoxGeometry(0.72, 0.92, 0.08),
          mat(0xbfe6f2, 0.4));
        pane.position.set(wx, 1.9, sz * 3.14);
        pane.castShadow = false;
        ext.add(pane);
        glowWindow(pane, { max: 0.4 }); // candlelight, not current
      }
    }
    ext.position.set(KX, ky, KZ);
    group.add(ext);
    zones.addBlocker(KX - 2.1, KZ, 3.4);
    zones.addBlocker(KX + 2.1, KZ, 3.4);

    register({
      pos: new THREE.Vector3(KX + 5.4, 0, KZ), r: 2.2,
      label: 'enter the House of Cod',
      use: () => zones.go('kirk'),
    });
  }

  // ------------------------------------------------------ kirk interior ----
  {
    const roomStart = group.children.length;
    const B = IN_KIRK;
    const floor = box(11, 0.4, 14, 0x9a7b5a);
    floor.position.set(B.x, -0.2, B.z);
    group.add(floor);
    for (const [w, h, d, x, y, z] of [
      [11, 4.6, 0.4, B.x, 2.3, B.z - 7],   // back wall, behind the lectern
      [0.4, 4.6, 14, B.x - 5.5, 2.3, B.z],
      [0.4, 4.6, 14, B.x + 5.5, 2.3, B.z],
    ]) {
      const wall = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat(0xe9e5da));
      wall.receiveShadow = true;
      wall.position.set(x, y, z);
      group.add(wall);
    }
    // pews: three honest rows a side, pale wood, no cushions to speak of
    for (let r = 0; r < 3; r++) {
      for (const sx of [-2.4, 2.4]) {
        const pew = box(3.4, 0.45, 0.85, 0x9a6a44);
        pew.position.set(B.x + sx, 0.22, B.z - 0.8 + r * 2.0);
        const back = box(3.4, 0.75, 0.16, 0x9a6a44);
        back.position.set(B.x + sx, 0.78, B.z - 0.42 + r * 2.0);
        group.add(pew, back);
      }
    }
    // the lectern: a post, a slanted top, and no notes because Amos lost them
    const post = box(0.3, 1.15, 0.3, 0x6e5136);
    post.position.set(B.x, 0.57, B.z - 4.6);
    const top = box(0.85, 0.1, 0.62, 0x6e5136);
    top.position.set(B.x, 1.2, B.z - 4.5);
    top.rotation.x = 0.35;
    group.add(post, top);
    // THE COD — carved, hung from the rafters, mid-congregation. it sways.
    const codRig = new THREE.Group();
    codRig.position.set(B.x, 4.4, B.z - 2.6);
    const rope1 = new THREE.Mesh(new THREE.CylinderGeometry(0.02, 0.02, 1.3, 5), mat(0x8a7a5c, 0.95));
    rope1.position.set(-0.55, -0.65, 0);
    const rope2 = rope1.clone();
    rope2.position.set(0.55, -0.65, 0);
    codRig.add(rope1, rope2);
    const theCod = makeCod(1.5, 0xa97c50);
    theCod.position.set(0, -1.45, 0);
    codRig.add(theCod);
    group.add(codRig);
    kirkUpdates.push((dt, t) => { codRig.rotation.z = Math.sin(t * 0.6) * 0.05; });
    // candle stands, either side of the lectern — always lit, always modest
    for (const sx of [-2.6, 2.6]) {
      const stand = box(0.9, 0.85, 0.7, 0x55483a);
      stand.position.set(B.x + sx, 0.42, B.z - 4.4);
      group.add(stand);
      for (let i = 0; i < 3; i++) {
        const stick = new THREE.Mesh(new THREE.CylinderGeometry(0.045, 0.055, 0.26 + (i % 3) * 0.07, 6), mat(0xf6efdc, 0.6));
        stick.position.set(B.x + sx - 0.22 + i * 0.22, 1.0, B.z - 4.4);
        group.add(stick);
        const flame = new THREE.Mesh(new THREE.IcosahedronGeometry(0.05, 0),
          new THREE.MeshBasicMaterial({ color: 0xffd98f }));
        flame.castShadow = false;
        flame.position.set(B.x + sx - 0.22 + i * 0.22, 1.18 + (i % 3) * 0.035, B.z - 4.4);
        group.add(flame);
      }
    }
    // the harvest table: jars, a loaf, a lean of wheat. grace, in still life.
    const table = box(2.6, 0.75, 1.0, 0x8a5a3a);
    table.position.set(B.x - 3.6, 0.37, B.z + 5.6);
    group.add(table);
    const jarColors = [0x88b04b, 0xe08a2e, 0x6a5acd, 0x88b04b, 0xe08a2e];
    jarColors.forEach((c, i) => {
      const jar = new THREE.Mesh(new THREE.CylinderGeometry(0.11, 0.13, 0.28, 7), mat(c, 0.5));
      jar.position.set(B.x - 4.5 + i * 0.42, 0.9, B.z + 5.5);
      jar.castShadow = true;
      group.add(jar);
    });
    const loaf = new THREE.Mesh(new THREE.IcosahedronGeometry(0.28, 1), mat(0xc98d4e, 0.85));
    loaf.scale.set(1.5, 0.7, 0.9);
    loaf.position.set(B.x - 2.7, 0.86, B.z + 5.7);
    loaf.castShadow = true;
    group.add(loaf);
    for (let i = 0; i < 5; i++) {
      const stalk = new THREE.Mesh(new THREE.CylinderGeometry(0.02, 0.025, 0.9, 5), mat(0xd9b45a, 0.9));
      stalk.position.set(B.x - 2.0 + i * 0.05, 1.15, B.z + 5.4 + (i % 2) * 0.08);
      stalk.rotation.z = 0.5 - i * 0.04;
      group.add(stalk);
    }

    // Elder Amos, by the lectern, glad you came
    const amos = buildAnimal('sheep', { head: 0x45403a, wool: 0xf1ead9 });
    const amosHat = flatBrimHat();
    amosHat.position.set(0, 1.68, 0.18);
    amos.add(amosHat);
    amos.position.set(B.x + 0.9, 0.15, B.z - 3.9);
    amos.rotation.y = Math.PI * 0.8;
    group.add(amos);
    kirkUpdates.push((dt, t) => { amos.position.y = 0.15 + Math.sin(t * 1.4) * 0.02; });

    const room = collectInteriorRoot(group, roomStart);
    zones.registerInterior('kirk', {
      root: room,
      floorY: 0,
      bounds: { x0: B.x - 5.1, x1: B.x + 5.1, z0: B.z - 5.6, z1: B.z + 6.8 },
      blockers: [
        { x: B.x, z: B.z - 4.6, r: 1.1 },        // lectern
        { x: B.x - 2.6, z: B.z - 4.4, r: 0.8 },  // candles
        { x: B.x + 2.6, z: B.z - 4.4, r: 0.8 },  // candles
        { x: B.x - 3.6, z: B.z + 5.6, r: 1.3 },  // harvest table
        { x: B.x - 2.4, z: B.z - 0.6, r: 1.5 },  // pews, port side
        { x: B.x + 2.4, z: B.z - 0.6, r: 1.5 },
        { x: B.x - 2.4, z: B.z + 1.4, r: 1.5 },
        { x: B.x + 2.4, z: B.z + 1.4, r: 1.5 },
      ],
      spawn: { x: B.x, z: B.z + 5.9, rotY: Math.PI },
      lighting: {
        bg: 0x241c12, fog: 0x241c12, fogNear: 22, fogFar: 60,
        hemiSky: 0xffe6bc, hemiGround: 0x66523c, hemiIntensity: 1.18,
        sunIntensity: 0,
      },
    });
    register({
      pos: new THREE.Vector3(B.x, 0, B.z + 6.4), r: 1.8, zone: 'kirk',
      label: 'step outside',
      use: () => zones.leaveTo({ x: KX + 5.8, z: KZ, rotY: Math.PI / 2 }),
    });
    register({
      getPos: () => amos.position, r: 3.0, zone: 'kirk',
      label: 'talk to Elder Amos',
      use: () => amosMenu(),
    });
    register({
      pos: new THREE.Vector3(B.x - 2.4, 0, B.z + 0.4), r: 1.8, zone: 'kirk', priority: 0,
      label: 'sit in a pew',
      use: async () => {
        await ui.fadeSwap(() => {});
        ui.say('You sit. Outside, a cart creaks past; somewhere a jar seals with a small, satisfied pop. If the Cod is saying anything, it is saying: supper, eventually, for everyone.');
      },
    });

    let amosIdx = { cod: 0, nb: 0, fold: 0 };
    async function amosMenu() {
      if (!S.hasFlag('metAmos')) {
        S.setFlag('metAmos');
        await ui.say([
          'Welcome, walker. I am Elder Amos, and this is the House of Cod. Wipe your feet if you like — the floor forgives either way.',
          'We are plain folk. We farm, we jar, we listen to the weather. You are welcome to exactly all of it.',
        ], { speaker: 'Elder Amos', voice: VOICE.amos });
      }
      const choice = await ui.ask('Elder Amos folds his hooves and gives you his whole attention.', [
        { label: '🐟 Ask about the Cod', value: 'cod' },
        { label: '🔭 Ask about the neighbors', value: 'nb' },
        { label: '🌾 Ask about the Fold', value: 'fold' },
        { label: 'Go gently', value: null },
      ]);
      if (!choice) {
        ui.say('Go gently, friend. Take weather with you.', { speaker: 'Elder Amos', voice: VOICE.amos });
        return;
      }
      const table = { cod: COD_LORE, nb: NEIGHBOR_LORE, fold: FOLD_LORE }[choice];
      ui.say(table[amosIdx[choice] % table.length], { speaker: 'Elder Amos', voice: VOICE.amos });
      amosIdx[choice]++;
    }
  }

  // ======================================================== the cottages ----
  const knockSpots = [];
  function plainCottage(x, z, faceX, faceZ, wallColor, who, scale = 1) {
    const g = new THREE.Group();
    const y = terrainHeight(x, z);
    const W = 4.2 * scale, H = 2.5 * scale, D = 3.8 * scale;
    const plinth = box(W + 0.5, 1.3, D + 0.5, 0x8a8378);
    plinth.position.y = -0.5;
    g.add(plinth);
    const walls = box(W, H, D, wallColor);
    walls.userData.occlude = true;
    walls.position.y = H / 2;
    g.add(walls);
    const roofGeo = new THREE.CylinderGeometry((D + 0.7) / 1.73, (D + 0.7) / 1.73, W + 0.7, 3, 1, false, Math.PI / 2);
    roofGeo.rotateZ(Math.PI / 2);
    const roof = new THREE.Mesh(roofGeo, mat(0x6b5a48));
    roof.scale.y = 0.5;
    roof.position.y = H;
    roof.castShadow = roof.receiveShadow = true;
    g.add(roof);
    const door = box(1.0 * scale, 1.8 * scale, 0.15, 0x4a3a2c);
    door.position.set(0, 0.9 * scale, D / 2 + 0.05);
    g.add(door);
    const pane = new THREE.Mesh(new THREE.BoxGeometry(0.6, 0.6, 0.08), mat(0xbfe6f2, 0.4));
    pane.castShadow = false;
    pane.position.set(-1.2 * scale, 1.5 * scale, D / 2 + 0.03);
    g.add(pane);
    glowWindow(pane, { max: 0.38 });
    const chimney = box(0.5, 1.7, 0.5, 0x8a8378);
    chimney.position.set(W / 2 - 0.4, H + 0.7, -0.5);
    g.add(chimney);
    const rotY = Math.atan2(faceX - x, faceZ - z);
    g.rotation.y = rotY;
    g.position.set(x, y, z);
    group.add(g);
    zones.addBlocker(x, z, Math.max(W, D) * 0.62);
    const doorWorld = {
      x: x + Math.sin(rotY) * (D / 2 + 0.9),
      z: z + Math.cos(rotY) * (D / 2 + 0.9),
    };
    knockSpots.push({ ...doorWorld, who });
    register({
      pos: new THREE.Vector3(doorWorld.x, 0, doorWorld.z), r: 1.8,
      label: `knock on ${who[0].toUpperCase() + who.slice(1)}’s door`,
      use: () => ui.say(KNOCKS[who]),
    });
    return g;
  }

  plainCottage(-193.5, -43.5, -193, -50, 0xd8d0bd, 'mercy');
  plainCottage(-192.3, -56.8, -193, -50, 0xcfc7b2, 'patience');
  plainCottage(-187.2, -59.6, -184, -67, 0xd3ccc0, 'obed');   // faces the barn
  plainCottage(-204.2, -45.4, -199, -50, 0xd8d0bd, 'amos', 0.8); // the elder's hut, up by the stones

  // ==================================================== the green: stall ----
  const STALL = { x: -189, z: -47 };
  let mercy;
  {
    const sy = terrainHeight(STALL.x, STALL.z);
    const g = new THREE.Group();
    const counter = box(2.6, 0.9, 0.9, 0x8a5a3a);
    counter.position.y = 0.45;
    g.add(counter);
    for (const sx of [-1.15, 1.15]) {
      const postS = box(0.12, 2.2, 0.12, 0x6e5843);
      postS.position.set(sx, 1.1, -0.25);
      g.add(postS);
    }
    const awning = box(3.0, 0.12, 1.6, 0x9a958c);
    awning.position.set(0, 2.2, -0.1);
    awning.rotation.x = -0.12;
    g.add(awning);
    // the wares: a rank of jars, colors telling flavors
    const flavors = [0x88b04b, 0xe08a2e, 0x6a5acd];
    for (let i = 0; i < 6; i++) {
      const jar = new THREE.Mesh(new THREE.CylinderGeometry(0.11, 0.13, 0.28, 7), mat(flavors[i % 3], 0.5));
      jar.position.set(-1.0 + i * 0.4, 1.05, 0);
      jar.castShadow = true;
      g.add(jar);
    }
    const rotY = Math.atan2(ST.x - STALL.x, ST.z - STALL.z); // face the green
    g.rotation.y = rotY;
    g.position.set(STALL.x, sy, STALL.z);
    group.add(g);
    zones.addBlocker(STALL.x, STALL.z, 1.4);

    // Mercy, behind the counter, glad of the company
    mercy = buildAnimal('sheep', { head: 0x6e5a48, wool: 0xf1ead9 });
    const bonnetM = makeBonnet(0xcdc4b0);
    bonnetM.position.set(0, 1.62, 0.14);
    mercy.add(bonnetM);
    mercy.add(makeApron(0x5a6270));
    const behind = { x: STALL.x - Math.sin(rotY) * 1.4, z: STALL.z - Math.cos(rotY) * 1.4 };
    mercy.position.set(behind.x, terrainHeight(behind.x, behind.z), behind.z);
    mercy.rotation.y = rotY;
    group.add(mercy);

    const JARS = [
      { id: 'preserves_goose', label: '🫙 Gooseberry preserves', name: 'Gooseberry Preserves', emoji: '🫙', price: 7 },
      { id: 'preserves_carrot', label: '🥕 Carrot marmalade', name: 'Carrot Marmalade', emoji: '🥕', price: 7 },
      { id: 'preserves_plum', label: '🫐 Sea-plum jam', name: 'Sea-Plum Jam', emoji: '🫐', price: 8 },
    ];
    register({
      pos: new THREE.Vector3(
        STALL.x + Math.sin(rotY) * 1.5, 0, STALL.z + Math.cos(rotY) * 1.5), r: 2.0,
      label: 'browse the preserves',
      use: async () => {
        const picked = await ui.ask('Jars stand in a proud little rank. Each label is hand-lettered, and each lid, you sense, was defeated honestly.', [
          ...JARS.map((j) => ({
            label: j.label, value: j.id, hint: `${j.price}🔘`,
            disabled: S.state.buttons < j.price,
          })),
          { label: 'Just admiring', value: null },
        ]);
        const j = JARS.find((x) => x.id === picked);
        if (!j) return;
        S.spend(j.price);
        S.addItem(j.id);
        kaching();
        ui.updateHUD();
        ui.toast(`You bought <b>${j.name}</b>. The jar is heavier than it looks, the way good things are.`, j.emoji);
      },
    });
    register({
      getPos: () => mercy.position, r: 3.4, // the radius crosses the counter. learned that one.
      label: 'talk to Mercy',
      use: () => ui.say(pick(MERCY_CHAT), { speaker: 'Mercy', voice: VOICE.mercy }),
    });
  }

  // the well: a working one. wishes go in the bucket like everything else.
  {
    const WX = -190.5, WZ = -53.2;
    const wy = terrainHeight(WX, WZ);
    const ring = new THREE.Mesh(new THREE.CylinderGeometry(0.85, 0.95, 0.7, 8), mat(0x8a8378));
    ring.position.set(WX, wy + 0.35, WZ);
    ring.castShadow = ring.receiveShadow = true;
    group.add(ring);
    for (const sx of [-0.75, 0.75]) {
      const postW = box(0.1, 1.3, 0.1, 0x6e5843);
      postW.position.set(WX + sx, wy + 1.0, WZ);
      group.add(postW);
    }
    const crossbar = box(1.7, 0.1, 0.1, 0x6e5843);
    crossbar.position.set(WX, wy + 1.6, WZ);
    group.add(crossbar);
    const bucket = new THREE.Mesh(new THREE.CylinderGeometry(0.16, 0.13, 0.22, 7), mat(0x6e5136, 0.8));
    bucket.position.set(WX, wy + 1.15, WZ);
    bucket.castShadow = true;
    group.add(bucket);
    zones.addBlocker(WX, WZ, 1.1);
    register({
      pos: new THREE.Vector3(WX, 0, WZ + 1.4), r: 1.6,
      label: 'look into the well',
      use: () => ui.say('Water, dark and patient. Your reflection looks up, wearing the sky for a hat. No coins down there — around here a wish is something you plant.'),
    });
  }

  // ========================================================== the barn ----
  const BARN = { x: -184, z: -67 };
  {
    const by = terrainHeight(BARN.x, BARN.z);
    const g = new THREE.Group();
    const plinth = box(7.6, 1.2, 5.6, 0x8a8378);
    plinth.position.y = -0.45;
    g.add(plinth);
    const walls = box(7, 3.2, 5, 0x8a4a3a); // oxblood, weathered honest
    walls.userData.occlude = true;
    walls.position.y = 1.6;
    g.add(walls);
    const roofGeo = new THREE.CylinderGeometry((5 + 0.9) / 1.73, (5 + 0.9) / 1.73, 7.8, 3, 1, false, Math.PI / 2);
    roofGeo.rotateZ(Math.PI / 2);
    const roof = new THREE.Mesh(roofGeo, mat(0x6b5a48));
    roof.scale.y = 0.55;
    roof.position.y = 3.2;
    roof.castShadow = roof.receiveShadow = true;
    g.add(roof);
    // big doors on the gable end, one honestly ajar
    const doorL = box(1.1, 2.4, 0.15, 0x5c4034);
    doorL.position.set(-0.6, 1.2, 2.56);
    g.add(doorL);
    const doorR = box(1.1, 2.4, 0.15, 0x5c4034);
    doorR.position.set(0.75, 1.2, 2.42);
    doorR.rotation.y = 0.35;
    g.add(doorR);
    // hayloft window, dark and sweet-smelling
    const loft = box(0.9, 0.7, 0.1, 0x2e2620);
    loft.position.set(0, 2.7, 2.55);
    g.add(loft);
    const rotY = Math.atan2(-187.2 - BARN.x, -59.6 - BARN.z); // gable to the farmhouse
    g.rotation.y = rotY;
    g.position.set(BARN.x, by, BARN.z);
    group.add(g);
    zones.addBlocker(BARN.x - 1.8, BARN.z, 2.9);
    zones.addBlocker(BARN.x + 1.8, BARN.z, 2.9);
    // hay bales, stacked with the particular pride of stacked hay
    for (const [hx, hz, hr] of [[BARN.x + 4.4, BARN.z + 1.2, 0], [BARN.x + 4.6, BARN.z + 2.4, 0.4], [BARN.x + 4.5, BARN.z + 1.8, 0]]) {
      const bale = box(1.1, 0.7, 0.8, 0xd9b45a);
      bale.position.set(hx, terrainHeight(hx, hz) + 0.35 + (hr ? 0.7 : 0), hz);
      bale.rotation.y = hr;
      group.add(bale);
    }
    zones.addBlocker(BARN.x + 4.5, BARN.z + 1.8, 1.2);
  }

  // wheelbarrows: one holding hay, one holding the idea of carrots
  function wheelbarrow(x, z, rotY, cargo) {
    const g = new THREE.Group();
    const tray = box(0.9, 0.3, 1.3, 0x6e5843);
    tray.position.y = 0.45;
    g.add(tray);
    const wheel = new THREE.Mesh(new THREE.CylinderGeometry(0.22, 0.22, 0.1, 8), mat(0x4a3f33, 0.7));
    wheel.rotation.z = Math.PI / 2;
    wheel.position.set(0, 0.22, 0.75);
    wheel.castShadow = true;
    g.add(wheel);
    for (const sx of [-0.32, 0.32]) {
      const handle = box(0.07, 0.07, 0.8, 0x6e5843);
      handle.position.set(sx, 0.42, -0.85);
      handle.rotation.x = -0.15;
      g.add(handle);
    }
    for (const sx of [-0.3, 0.3]) {
      const legW = box(0.07, 0.4, 0.07, 0x6e5843);
      legW.position.set(sx, 0.2, -0.45);
      g.add(legW);
    }
    if (cargo === 'hay') {
      const heap = new THREE.Mesh(new THREE.IcosahedronGeometry(0.42, 0), mat(0xd9b45a, 0.95));
      heap.scale.y = 0.6;
      heap.position.y = 0.72;
      heap.castShadow = true;
      g.add(heap);
    } else if (cargo === 'carrots') {
      for (let i = 0; i < 3; i++) {
        const c = new THREE.Mesh(new THREE.ConeGeometry(0.09, 0.4, 5), mat(0xe08a2e, 0.7));
        c.rotation.z = Math.PI / 2 + i * 0.3;
        c.position.set(-0.15 + i * 0.16, 0.68, -0.1 + (i % 2) * 0.2);
        c.castShadow = true;
        g.add(c);
      }
    }
    g.rotation.y = rotY;
    g.position.set(x, terrainHeight(x, z), z);
    group.add(g);
    zones.addBlocker(x, z, 0.8);
  }
  wheelbarrow(-181.6, -66.2, 0.7, 'hay');
  wheelbarrow(-182.2, -58.4, -0.5, 'carrots');

  // ======================================================= the fields ----
  {
    // wheat, in rows, each stalk leaning its own honest lean
    for (let cx = 0; cx < 5; cx++) {
      for (let rz = 0; rz < 7; rz++) {
        const x = -178 + cx * 1.4 + rand(-0.15, 0.15);
        const z = -69 + rz * 1.4 + rand(-0.15, 0.15);
        if (Math.hypot(x - BARN.x, z - BARN.z) < 4.6) continue;
        const y = terrainHeight(x, z);
        if (y < 0.5) continue;
        const stalk = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.05, 0.85, 5), mat(0xd9b45a, 0.95));
        stalk.position.set(x, y + 0.42, z);
        stalk.rotation.z = rand(-0.09, 0.09);
        stalk.castShadow = true;
        group.add(stalk);
        const head = new THREE.Mesh(new THREE.ConeGeometry(0.11, 0.3, 5), mat(0xe3c26a, 0.95));
        head.position.set(x + stalk.rotation.z * -0.85, y + 0.98, z);
        head.castShadow = true;
        group.add(head);
      }
    }
    // carrots: rows of tops, one already pulled and forgotten in the excitement
    for (let cx = 0; cx < 4; cx++) {
      for (let rz = 0; rz < 3; rz++) {
        const x = -185 + cx * 1.2 + rand(-0.12, 0.12);
        const z = -61.5 + rz * 1.2 + rand(-0.12, 0.12);
        const y = terrainHeight(x, z);
        const tuft = new THREE.Mesh(new THREE.ConeGeometry(0.1, 0.24, 5), mat(0x4f8a52, 0.95));
        tuft.position.set(x, y + 0.12, z);
        tuft.castShadow = true;
        group.add(tuft);
      }
    }
    const dropped = new THREE.Mesh(new THREE.ConeGeometry(0.09, 0.38, 5), mat(0xe08a2e, 0.7));
    dropped.rotation.z = Math.PI / 2 + 0.3;
    dropped.position.set(-183.4, terrainHeight(-183.4, -57.6) + 0.08, -57.6);
    dropped.castShadow = true;
    group.add(dropped);

    // the scarecrow wears the uniform. the crows appreciate the formality.
    const SC = { x: -175.3, z: -64.5 };
    const scy = terrainHeight(SC.x, SC.z);
    const poleS = box(0.09, 2.0, 0.09, 0x6e5843);
    poleS.position.set(SC.x, scy + 1.0, SC.z);
    group.add(poleS);
    const arms = box(1.5, 0.09, 0.09, 0x6e5843);
    arms.position.set(SC.x, scy + 1.45, SC.z);
    group.add(arms);
    const smock = box(0.6, 0.8, 0.35, 0x5a6270);
    smock.position.set(SC.x, scy + 1.15, SC.z);
    group.add(smock);
    const headS = new THREE.Mesh(new THREE.IcosahedronGeometry(0.24, 1), mat(0xd9b45a, 0.95));
    headS.position.set(SC.x, scy + 1.95, SC.z);
    headS.castShadow = true;
    group.add(headS);
    const hatS = flatBrimHat(0x322d27);
    hatS.position.set(SC.x, scy + 2.16, SC.z);
    hatS.rotation.z = 0.12;
    group.add(hatS);
    zones.addBlocker(SC.x, SC.z, 0.5);
    register({
      pos: new THREE.Vector3(SC.x, 0, SC.z), r: 1.8, priority: 0,
      label: 'regard the scarecrow',
      use: () => ui.say('It wears the plain hat, the plain smock, and an expression of permanent mild welcome. A crow sits on one arm, entirely unafraid, which everyone involved has decided not to mention.'),
    });
  }

  // split-rail fences along the field edges, gapped where feet actually go
  function fenceRun(x0, z0, x1, z1) {
    const len = Math.hypot(x1 - x0, z1 - z0);
    const n = Math.round(len / 1.7);
    for (let i = 0; i <= n; i++) {
      const t = i / n;
      const x = x0 + (x1 - x0) * t, z = z0 + (z1 - z0) * t;
      const y = terrainHeight(x, z);
      const postF = box(0.09, 0.75, 0.09, 0x6e5843);
      postF.position.set(x, y + 0.37, z);
      group.add(postF);
      if (i < n) {
        const nx = x0 + (x1 - x0) * ((i + 1) / n), nz = z0 + (z1 - z0) * ((i + 1) / n);
        const ny = terrainHeight(nx, nz);
        for (const railY of [0.55, 0.28]) {
          const rail = box(Math.hypot(nx - x, nz - z) + 0.1, 0.06, 0.05, 0x7a6a52);
          rail.position.set((x + nx) / 2, (y + ny) / 2 + railY, (z + nz) / 2);
          rail.rotation.y = Math.atan2(nx - x, nz - z) + Math.PI / 2;
          rail.rotation.z = Math.atan2(ny - y, Math.hypot(nx - x, nz - z));
          group.add(rail);
        }
      }
    }
  }
  fenceRun(-187, -70.8, -171.5, -70.8); // south edge of the wheat
  fenceRun(-170.8, -70.5, -170.8, -58.5); // east edge, toward the band

  // ===================================================== the kirkyard ----
  {
    const G = { x: -201.5, z: -41 };
    // a low fieldstone wall, gapped on the kirk side. steppable, in a pinch;
    // everyone uses the gap anyway, out of respect.
    const runs = [
      [-205, -43.7, -202, -43.7], [-199.8, -43.7, -198, -43.7], // south, gapped
      [-205, -38.2, -198, -38.2], // north
      [-205, -43.7, -205, -38.2], // west
      [-198, -43.7, -198, -38.2], // east
    ];
    for (const [x0, z0, x1, z1] of runs) {
      const len = Math.hypot(x1 - x0, z1 - z0);
      const segs = Math.max(1, Math.round(len / 1.4));
      for (let i = 0; i < segs; i++) {
        const t = (i + 0.5) / segs;
        const x = x0 + (x1 - x0) * t, z = z0 + (z1 - z0) * t;
        const seg = box(len / segs + 0.08, 0.34 + rand(-0.04, 0.04), 0.32, 0x8a8378);
        seg.position.set(x, terrainHeight(x, z) + 0.17, z);
        seg.rotation.y = Math.atan2(x1 - x0, z1 - z0) + Math.PI / 2 + rand(-0.03, 0.03);
        group.add(seg);
      }
    }
    // the stones: two patient rows, kept clear of moss out of love
    let si = 0;
    for (const rowZ of [-42.4, -40.2]) {
      for (let i = 0; i < (rowZ === -42.4 ? 4 : 3); i++) {
        const x = -204 + i * 1.5 + rand(-0.1, 0.1);
        const z = rowZ + rand(-0.1, 0.1);
        const y = terrainHeight(x, z);
        const tall = si === 3;
        const stone = box(0.5, tall ? 0.85 : 0.6, 0.16, 0x9a958c);
        stone.position.set(x, y + (tall ? 0.42 : 0.3), z);
        stone.rotation.x = rand(-0.05, 0.05);
        stone.rotation.z = rand(-0.06, 0.06);
        group.add(stone);
        const cap = box(0.56, 0.1, 0.2, 0x8a857c);
        cap.position.set(x, y + (tall ? 0.87 : 0.62), z);
        cap.rotation.z = stone.rotation.z;
        group.add(cap);
        zones.addBlocker(x, z, 0.4);
        si++;
      }
    }
    // the yard oak, older than the wall, consulted on all major decisions
    const oak = makeOak(0x4f9151);
    oak.scale.setScalar(1.2);
    oak.position.set(-198.9, terrainHeight(-198.9, -38.9), -38.9);
    group.add(oak);
    zones.addBlocker(-198.9, -38.9, 0.7);

    let stoneIdx = 0;
    register({
      pos: new THREE.Vector3(G.x, 0, G.z), r: 2.8,
      label: 'read the stones',
      use: () => {
        ui.say(EPITAPHS[stoneIdx % EPITAPHS.length]);
        stoneIdx++;
      },
    });
  }

  // ============================================== the west shore: cod ----
  {
    // a beached dory, resting exactly as hard as it worked
    const DX = -208.5, DZ = -52.3;
    const dy = terrainHeight(DX, DZ);
    // hull the same family as the dock rowboats, beached and resting
    const dory = new THREE.Group();
    const hull = new THREE.Mesh(new THREE.CylinderGeometry(0.8, 0.5, 0.6, 7), mat(0x8a5a3a));
    hull.scale.z = 2.0;
    hull.rotation.y = Math.PI / 7;
    hull.position.y = 0.28;
    dory.add(hull);
    const inner = new THREE.Mesh(new THREE.CylinderGeometry(0.64, 0.4, 0.42, 7), mat(0xc9b178));
    inner.scale.z = 1.9;
    inner.rotation.y = Math.PI / 7;
    inner.position.y = 0.42;
    dory.add(inner);
    const thwart = box(1.0, 0.09, 0.26, 0x6e5136);
    thwart.position.set(0, 0.52, -0.2);
    dory.add(thwart);
    dory.rotation.y = 0.5;
    dory.rotation.z = 0.06; // heeled just so, the way boats rest
    dory.position.set(DX, dy, DZ);
    group.add(dory);
    zones.addBlocker(DX, DZ, 1.3);

    // the drying rack: three cod, becoming keepable. the Cod provides;
    // the rack makes sure it keeps providing into February.
    const RX = -207.5, RZ = -48.8;
    const ry = terrainHeight(RX, RZ);
    for (const sx of [-1.1, 1.1]) {
      const postR = box(0.1, 1.7, 0.1, 0x6e5843);
      postR.position.set(RX + sx, ry + 0.85, RZ);
      group.add(postR);
    }
    const bar = box(2.5, 0.08, 0.08, 0x6e5843);
    bar.position.set(RX, ry + 1.62, RZ);
    group.add(bar);
    for (let i = 0; i < 3; i++) {
      const fish = makeCod(0.5, 0xc9b99a);
      fish.rotation.z = -Math.PI / 2; // hung by the tail, as is proper
      fish.position.set(RX - 0.7 + i * 0.7, ry + 1.18, RZ);
      group.add(fish);
    }
    zones.addBlocker(RX, RZ, 0.9);
    register({
      pos: new THREE.Vector3(RX, 0, RZ + 1.2), r: 1.7, priority: 0,
      label: 'consider the cod',
      use: () => ui.say('Three cod, drying in the sea wind, well on their way to lasting the winter. It is hard to say where the faith ends and the pantry begins, and nobody here would want you to.'),
    });
  }

  // ================================================ the band + the stile ----
  {
    // a friendly hedge of trees between the Fold and the Labs, with one gap
    // where the footpath goes. both sides planted it. neither remembers whose
    // idea it was, which is the best sign.
    for (let i = 0; i < 16; i++) {
      const x = rand(-171, -163.5);
      const z = rand(-71, -33);
      if (Math.abs(z + 54) < 2.8) continue; // the footpath keeps its gap
      const y = terrainHeight(x, z);
      if (y < 0.6) continue;
      const tree = i % 3 === 0 ? makeOak() : makeFir();
      tree.scale.setScalar(rand(0.85, 1.2));
      tree.rotation.y = rand(0, Math.PI * 2);
      tree.position.set(x, y - 0.05, z);
      group.add(tree);
    }
    // the stile: two steps over nothing in particular. built for the look of
    // the thing, and for sitting on, which is most of what stiles are for.
    const SX = -166.8, SZ = -54;
    const sy = terrainHeight(SX, SZ);
    const step1 = box(0.9, 0.3, 0.5, 0x7a6a52);
    step1.position.set(SX, sy + 0.15, SZ + 0.5);
    const step2 = box(0.9, 0.3, 0.5, 0x7a6a52);
    step2.position.set(SX, sy + 0.4, SZ);
    const step3 = box(0.9, 0.3, 0.5, 0x7a6a52);
    step3.position.set(SX, sy + 0.15, SZ - 0.5);
    group.add(step1, step2, step3);
    for (const sz of [-0.8, 0.8]) {
      const postT = box(0.09, 0.9, 0.09, 0x6e5843);
      postT.position.set(SX, sy + 0.45, SZ + sz);
      group.add(postT);
    }
  }

  // ======================================================== the folk ----
  // Patience and Obed walk their rounds; Small Mercy orbits the green.
  const walkers = [];
  function addFolk(name, kind, colors, points, lines, voice, opts = {}) {
    const a = buildAnimal(kind, colors);
    if (opts.scale) a.scale.setScalar(opts.scale);
    if (opts.hat) { opts.hat.position.set(0, 1.66, 0.16); a.add(opts.hat); }
    if (opts.bonnet) { opts.bonnet.position.set(0, 1.62, 0.14); a.add(opts.bonnet); }
    if (opts.apron) a.add(opts.apron);
    a.position.set(points[0].x, terrainHeight(points[0].x, points[0].z), points[0].z);
    group.add(a);
    const w = { g: a, points, seg: 0, speed: opts.speed ?? 1.1, pause: rand(0, 2) };
    walkers.push(w);
    register({
      getPos: () => a.position, r: 2.4,
      label: `talk to ${name}`,
      use: () => ui.say(pick(lines), { speaker: name, voice }),
    });
    return w;
  }

  addFolk('Patience', 'sheep', { head: 0x7a746a, wool: 0xf1ead9 }, [
    { x: -183.5, z: -60.5 }, { x: -179, z: -58.5 }, { x: -175, z: -61 },
    { x: -176.5, z: -66.5 }, { x: -181, z: -63 },
  ], PATIENCE_CHAT, VOICE.patience, {
    bonnet: makeBonnet(0xb9c0b9), apron: makeApron(0x4f5a4f), speed: 1.0,
  });

  addFolk('Obed', 'sheep', { head: 0x3a3630, wool: 0xece4d0 }, [
    { x: -182, z: -65.5 }, { x: -186.5, z: -61.5 }, { x: -189.5, z: -55 },
    { x: -186, z: -57.5 },
  ], OBED_CHAT, VOICE.obed, {
    hat: flatBrimHat(), speed: 1.2,
  });

  addFolk('Small Mercy', 'sheep', { head: 0x8a7a68, wool: 0xf6f1e4 }, [
    { x: -191, z: -47.5 }, { x: -195.5, z: -46.5 }, { x: -195, z: -52.5 },
    { x: -190.5, z: -51 }, { x: -188, z: -48.5 },
  ], LAMB_CHAT, VOICE.lamb, {
    scale: 0.62, speed: 1.6, // small legs, big agenda
  });

  // everything solid casts and catches the light honestly
  group.traverse((o) => {
    if (!o.isMesh) return;
    if (o.material.transparent) return;
    if (o.material.emissive && o.material.emissiveIntensity > 0) return;
    if (o.material.isMeshBasicMaterial) return; // candle flames glow, cast nothing
    o.castShadow = true;
    o.receiveShadow = true;
  });

  function update(dt, t, playerPos) {
    const zone = zones.current();
    if (zone === 'kirk') {
      for (const fn of kirkUpdates) fn(dt, t, playerPos);
      return;
    }
    if (zone !== 'island') return;
    for (const fn of updates) fn(dt, t, playerPos);

    // the rounds: walk, pause, consider, continue
    for (const w of walkers) {
      if (w.pause > 0) {
        w.pause -= dt;
        animateGait(w.g, t, 0);
        // company is worth stopping for
        if (playerPos && w.pause > 0.2) {
          const dxp = playerPos.x - w.g.position.x, dzp = playerPos.z - w.g.position.z;
          if (Math.hypot(dxp, dzp) < 5) {
            w.g.rotation.y = turnToward(w.g.rotation.y, Math.atan2(dxp, dzp), dt, 4);
          }
        }
        continue;
      }
      const target = w.points[w.seg];
      const dx = target.x - w.g.position.x, dz = target.z - w.g.position.z;
      const d = Math.hypot(dx, dz);
      if (d < 0.4) {
        w.seg = (w.seg + 1) % w.points.length;
        w.pause = 1.6 + Math.random() * 2.8;
        continue;
      }
      const step = Math.min(w.speed * dt, d);
      w.g.position.x += (dx / d) * step;
      w.g.position.z += (dz / d) * step;
      w.g.position.y = terrainHeight(w.g.position.x, w.g.position.z);
      w.g.rotation.y = turnToward(w.g.rotation.y, Math.atan2(dx, dz), dt, 6);
      animateGait(w.g, t, 1);
    }

    // Mercy minds the stall but is delighted you're here
    if (playerPos && mercy) {
      const dxm = playerPos.x - mercy.position.x, dzm = playerPos.z - mercy.position.z;
      const dm = Math.hypot(dxm, dzm);
      const restY = Math.atan2(ST.x - STALL.x, ST.z - STALL.z);
      mercy.rotation.y = turnToward(mercy.rotation.y,
        dm < 6 ? Math.atan2(dxm, dzm) : restY, dt, 4);
    }

    // the welcome: once, gently, when you first come over the rise
    if (playerPos && !S.hasFlag('seenFold') &&
        Math.hypot(playerPos.x - ST.x, playerPos.z - ST.z) < 16) {
      S.setFlag('seenFold');
      ui.toast('The chart ended a while back. The farms did not.', '🐑');
    }
  }

  return { group, update };
}

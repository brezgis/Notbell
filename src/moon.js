// The Moon. Where the rovers go when they grow up — if they want.
//
// It is the quietest place the archipelago owns, and the rovers appreciate
// it professionally. Sound doesn't carry here, so they talk in lamp-blinks,
// the language they learned (secondhand, through forty years of telescope
// notes) from a certain lighthouse. They name craters after feelings, draw
// ten-thousand-year lines in the dust on purpose, fish the dust sea with
// magnets, and keep exactly one rock in a museum. The currency is gold star
// stickers, which are priceless, which is the point.

import * as THREE from 'three';
import * as zones from './zones.js';
import { register } from './interact.js';
import * as ui from './ui.js';
import * as S from './state.js';
import { buildRover } from './island6.js';
import { rand, pick, fbm, smoothstep, hash2, vnoise, turnToward } from './utils.js';
import { tone, thud, plop, jingle, sadTrombone } from './audio.js';
import { METEOR_TABLE, rollTable } from './catalog.js';

export const MOON = { x: 1000, z: 0, r: 95 };

function mat(color, rough = 0.95) {
  return new THREE.MeshStandardMaterial({ color, flatShading: true, roughness: rough });
}

function box(w, h, d, color) {
  const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat(color));
  m.castShadow = true;
  return m;
}

// ----------------------------------------------------------- the ground ----

const LAND = { x: 980, z: 30, r: 10, h: 1.2 };   // the landing pad
const SET = { x: 1012, z: -6, r: 16, h: 1.5 };   // the settlement
const DUST = { x: 1040, z: 26, r: 18, h: -1.1 }; // the dust sea (a basin)
const TRAX = { x: 985, z: -26, r: 13, h: 1.4 };  // the track garden

const CRATERS = [
  { x: 1048, z: -32, r: 16, d: 4.5, name: 'CRATER CONTENTMENT', sign: '“CRATER CONTENTMENT. pop. 0. perfect.”' },
  { x: 955, z: 10, r: 13, d: 3.5, name: 'CRATER MILD CONCERN', sign: '“CRATER MILD CONCERN. (formerly Crater Alarm; things improved.)”' },
  { x: 996, z: 54, r: 11, d: 3, name: 'CRATER NAPTIME', sign: '“CRATER NAPTIME. shhh.”' },
  { x: 1022, z: -56, r: 14, d: 4, name: 'CRATER WHEE', sign: '“CRATER WHEE. helmets are already on. proceed.”' },
];

export function moonHeight(x, z) {
  const d = Math.hypot(x - MOON.x, z - MOON.z);
  let h = fbm(x * 0.035 + 11, z * 0.035 - 6) * 4.2 - 0.6;
  h += smoothstep(72, 100, d) * 7; // the horizon rolls up into far hills
  for (const c of CRATERS) {
    const cd = Math.hypot(x - c.x, z - c.z);
    h += smoothstep(c.r * 1.5, c.r * 0.95, cd) * c.d * 0.35; // the rim
    h -= smoothstep(c.r, c.r * 0.2, cd) * c.d;               // the bowl
  }
  for (const s of [LAND, SET, DUST, TRAX]) {
    const sd = Math.hypot(x - s.x, z - s.z);
    if (sd < s.r) h += (s.h - h) * smoothstep(s.r, s.r * 0.45, sd);
  }
  return h;
}

const moonBlockers = [];

function addMoonBlocker(x, z, r) {
  moonBlockers.push({ x, z, r });
}

// ------------------------------------------------------------------------

export function createMoon(player) {
  const group = new THREE.Group();
  const updates = []; // (dt, t, playerPos), moon zone only

  zones.registerWorld('moon', {
    groundHeight: moonHeight,
    canWalk(x, z) {
      if (Math.hypot(x - MOON.x, z - MOON.z) > MOON.r) return false;
      for (const b of moonBlockers) {
        if (Math.hypot(x - b.x, z - b.z) < b.r) return false;
      }
      return true;
    },
    spawn: { x: LAND.x, z: LAND.z + 3.4, rotY: Math.PI },
    lighting: {
      bg: 0x04050a, fog: 0x04050a, fogNear: 130, fogFar: 380,
      hemiSky: 0x2a3550, hemiGround: 0x0a0c12, hemiIntensity: 0.55,
      sunIntensity: 3.2,
      sunPos: [MOON.x + 80, 90, MOON.z + 50],
      sunTarget: [MOON.x, 0, MOON.z],
    },
  });

  // --------------------------------------------------------- the ground ----
  {
    const SIZE = 230, SEG = 118;
    let geo = new THREE.PlaneGeometry(SIZE, SIZE, SEG, SEG);
    geo.rotateX(-Math.PI / 2);
    geo.translate(MOON.x, 0, MOON.z);
    const pos = geo.attributes.position;
    for (let i = 0; i < pos.count; i++) {
      pos.setY(i, moonHeight(pos.getX(i), pos.getZ(i)));
    }
    geo = geo.toNonIndexed();
    const p = geo.attributes.position;
    const colors = new Float32Array(p.count * 3);
    const color = new THREE.Color();
    const va = new THREE.Vector3();
    const GRAY_A = new THREE.Color(0xb4b4bc);
    const GRAY_B = new THREE.Color(0xa4a4ae);
    const BOWL = new THREE.Color(0x8b8b96);
    const DUSTC = new THREE.Color(0x72727c);
    const SPARK = new THREE.Color(0xe2e6f0);
    for (let i = 0; i < p.count; i += 3) {
      va.fromBufferAttribute(p, i);
      let inBowl = 0;
      for (const c of CRATERS) {
        inBowl = Math.max(inBowl, smoothstep(c.r, c.r * 0.4, Math.hypot(va.x - c.x, va.z - c.z)));
      }
      if (Math.hypot(va.x - DUST.x, va.z - DUST.z) < DUST.r - 1) {
        color.copy(DUSTC);
      } else if (hash2(i, 13) > 0.992) {
        color.copy(SPARK); // a fleck that remembers being a star
      } else {
        color.copy(vnoise(va.x * 0.5 + 3, va.z * 0.5 - 8) > 0.5 ? GRAY_A : GRAY_B);
        color.lerp(BOWL, inBowl);
      }
      color.multiplyScalar(1 + (hash2(i, 5) - 0.5) * 0.08);
      for (let k = 0; k < 3; k++) {
        colors[(i + k) * 3] = color.r;
        colors[(i + k) * 3 + 1] = color.g;
        colors[(i + k) * 3 + 2] = color.b;
      }
    }
    geo.setAttribute('color', new THREE.BufferAttribute(colors, 3));
    geo.computeVertexNormals();
    const mesh = new THREE.Mesh(geo, new THREE.MeshStandardMaterial({
      vertexColors: true, flatShading: true, roughness: 1, metalness: 0,
    }));
    mesh.receiveShadow = true;
    group.add(mesh);
  }

  // ------------------------------------------------------------ the sky ----
  {
    const starGeo = new THREE.BufferGeometry();
    const pts = [];
    for (let i = 0; i < 650; i++) {
      const a = rand(0, Math.PI * 2);
      const elev = Math.acos(rand(0.04, 1)); // denser near the zenith
      const r = 260;
      pts.push(
        MOON.x + Math.cos(a) * Math.sin(elev) * r,
        Math.cos(elev) * r + 4,
        MOON.z + Math.sin(a) * Math.sin(elev) * r);
    }
    starGeo.setAttribute('position', new THREE.Float32BufferAttribute(pts, 3));
    const stars = new THREE.Points(starGeo, new THREE.PointsMaterial({
      color: 0xeef2ff, size: 1.7, sizeAttenuation: false, transparent: true, opacity: 0.9,
    }));
    stars.material.fog = false;
    group.add(stars);
  }

  // home, hanging in the black — every island the volcano ever made
  let glint;
  {
    const home = new THREE.Group();
    const sea = new THREE.Mesh(new THREE.IcosahedronGeometry(15, 2),
      new THREE.MeshStandardMaterial({
        color: 0x3fa0d8, emissive: 0x10283c, flatShading: true, roughness: 0.6,
      }));
    home.add(sea);
    // the archipelago, roughly as charted (the cartographer was a rover)
    const isles = [
      [0, 0.2, 2.2, 0x5fb74a],   // Notbell
      [1.6, -0.6, 1.4, 0x5fb74a], // the Far Isle
      [-1.1, -1.5, 1.1, 0x4f8a52], // the moss
      [0.6, -2.1, 0.9, 0x55504c], // the mountain, retired
      [0.2, 1.7, 1.2, 0x595a5e],  // the warehouse
      [1.7, 1.5, 1.3, 0x5fb74a],  // the orchards
      [-2.3, -0.9, 1.5, 0xb6b1a4], // the Labs (off every chart but this one)
    ];
    for (const [ix, iz, ir, c] of isles) {
      const blob = new THREE.Mesh(new THREE.IcosahedronGeometry(ir, 0), mat(c, 0.9));
      blob.scale.y = 0.35;
      const len = Math.hypot(ix, iz, 13.5);
      blob.position.set(ix, 13.8, iz).multiplyScalar(15.2 / len);
      blob.lookAt(0, 0, 0);
      home.add(blob);
    }
    for (let i = 0; i < 7; i++) {
      const cloud = new THREE.Mesh(new THREE.IcosahedronGeometry(rand(1.2, 2.6), 0),
        new THREE.MeshStandardMaterial({
          color: 0xffffff, emissive: 0x404048, flatShading: true,
          transparent: true, opacity: 0.85, roughness: 1,
        }));
      const a = rand(0, Math.PI * 2), e = rand(-0.9, 0.9);
      cloud.position.set(Math.cos(a) * Math.cos(e), Math.sin(e), Math.sin(a) * Math.cos(e)).multiplyScalar(16.4);
      cloud.scale.y = 0.4;
      home.add(cloud);
    }
    // the glint, southeast of the big island, deep in the navy water
    glint = new THREE.Mesh(new THREE.IcosahedronGeometry(0.5, 0),
      new THREE.MeshStandardMaterial({
        color: 0xf2cf5b, emissive: 0xc9a02c, emissiveIntensity: 0.6, flatShading: true,
      }));
    glint.position.set(2.4, 12.8, 2.8).multiplyScalar(15.1 / Math.hypot(2.4, 12.8, 2.8));
    home.add(glint);
    home.traverse((o) => { o.material && (o.material.fog = false); });
    home.position.set(MOON.x - 30, 72, MOON.z - 185);
    group.add(home);
    updates.push((dt, t) => {
      home.rotation.y = t * 0.01; // home turns slowly, like it has all day
      glint.material.emissiveIntensity = 0.4 + Math.max(0, Math.sin(t * 0.7)) * 1.2;
    });
  }

  // ----------------------------------------------------- the landing pad ----
  {
    const scorch = new THREE.Mesh(new THREE.CylinderGeometry(3.2, 3.2, 0.1, 14), mat(0x55555e, 1));
    scorch.position.set(LAND.x, LAND.h + 0.02, LAND.z - 3);
    group.add(scorch);
    // the rocket, parked on its legs, pointed home
    const rocket = new THREE.Group();
    const body = new THREE.Mesh(new THREE.CylinderGeometry(1.0, 1.1, 5.2, 10), mat(0xf2efe4, 0.7));
    body.position.y = 3.6;
    rocket.add(body);
    const nose = new THREE.Mesh(new THREE.ConeGeometry(1.0, 1.9, 10), mat(0xd9534f, 0.7));
    nose.position.y = 7.1;
    rocket.add(nose);
    for (let i = 0; i < 3; i++) {
      const a = (i / 3) * Math.PI * 2;
      const leg = box(0.16, 2.6, 0.16, 0x9aa3ad);
      leg.position.set(Math.cos(a) * 1.5, 1.0, Math.sin(a) * 1.5);
      leg.rotation.z = Math.cos(a) * 0.4;
      leg.rotation.x = -Math.sin(a) * 0.4;
      rocket.add(leg);
      const foot = new THREE.Mesh(new THREE.CylinderGeometry(0.4, 0.5, 0.15, 7), mat(0x9aa3ad, 0.6));
      foot.position.set(Math.cos(a) * 2.0, 0.1, Math.sin(a) * 2.0);
      rocket.add(foot);
    }
    const ladder = box(0.5, 3.4, 0.08, 0xc9962e);
    ladder.position.set(0, 1.7, 1.1);
    rocket.add(ladder);
    const glow = new THREE.Mesh(new THREE.CircleGeometry(0.22, 10),
      new THREE.MeshStandardMaterial({ color: 0xffd9a0, emissive: 0xffc97a, flatShading: true }));
    glow.position.set(0, 2.0, 1.06);
    rocket.add(glow);
    rocket.position.set(LAND.x, LAND.h, LAND.z - 3);
    rocket.traverse((o) => { if (o.isMesh) o.castShadow = true; });
    group.add(rocket);
    addMoonBlocker(LAND.x, LAND.z - 3, 2.4);
    updates.push((dt, t) => {
      glow.material.emissiveIntensity = 1 + Math.sin(t * 1.6) * 0.4; // still humming
    });

    register({
      pos: new THREE.Vector3(LAND.x, 0, LAND.z + 0.4), r: 2.6, zone: 'moon',
      label: 'fly home',
      use: async () => {
        const go = await ui.ask('The rocket waits on its legs, ladder down, heart glowing. The Lightseed has been humming a slightly different tune up here. A rounder one.', [
          { label: '🌍 Fly home', value: 'go' },
          { label: 'Stay a while', value: null },
        ]);
        if (!go) return;
        await ui.fadeSwap(async () => {
          tone(54, { dur: 1.8, type: 'sawtooth', vol: 0.07 });
          await ui.say([
            'Falling is just arriving, on a schedule. The rocket does it like a kept promise.',
            'The black goes thin. The thin goes blue. Somewhere on the way down, the sea starts again — you hear it through the hull, and you didn’t know until just now that you had missed it.',
          ]);
          await zones.go('island', { x: -127, z: -71.5, rotY: Math.PI });
        });
        ui.toast('Home. The gulls already have opinions about the scorch marks.', '🌊');
      },
    });

    // the flag the rovers planted for the first graduate
    const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.05, 2.6, 6), mat(0xd9d4c8, 0.5));
    pole.position.set(LAND.x + 4.2, moonHeight(LAND.x + 4.2, LAND.z - 1) + 1.3, LAND.z - 1);
    group.add(pole);
    const cloth = box(1.2, 0.74, 0.04, 0xfdf6e4);
    cloth.position.set(LAND.x + 4.85, moonHeight(LAND.x + 4.2, LAND.z - 1) + 2.2, LAND.z - 1);
    group.add(cloth);
    const sticker = new THREE.Mesh(new THREE.CircleGeometry(0.12, 5),
      new THREE.MeshStandardMaterial({ color: 0xf2cf5b, emissive: 0x8a6f1c, flatShading: true }));
    sticker.position.set(LAND.x + 5.2, moonHeight(LAND.x + 4.2, LAND.z - 1) + 2.42, LAND.z - 0.97);
    group.add(sticker);
    register({
      pos: new THREE.Vector3(LAND.x + 4.2, 0, LAND.z - 1), r: 2.0, zone: 'moon',
      label: 'read the flag',
      use: () => ui.say([
        'A stiff little flag, planted the day the kindergarten’s first graduate arrived: the bell-that-isn’t, the button-that-is. No wind has ever bothered it, and none is scheduled.',
        'In the corner, slightly crooked, one gold star sticker. “IT WAS EARNED,” reads the plaque. That is the whole plaque.',
      ]),
    });
  }

  // ------------------------------------------------------ the settlement ----
  const rovers = []; // the wandering grown-ups

  function adultRover(opts = {}) {
    const r = buildRover(opts.body ?? 0xcfd2d8);
    r.scale.setScalar(opts.scale ?? 1.45);
    return r;
  }

  function placeNPC(g, x, z, ry = 0) {
    g.position.set(x, moonHeight(x, z), z);
    g.rotation.y = ry;
    group.add(g);
  }

  // the charging meadow: solar flowers, planted in rows, leaning sunward
  {
    for (let i = 0; i < 6; i++) {
      const fx = SET.x - 6 + (i % 3) * 2.6;
      const fz = SET.z + 4.5 + Math.floor(i / 3) * 2.6;
      const fy = moonHeight(fx, fz);
      const stem = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.07, 1.5, 5), mat(0x9aa3ad, 0.6));
      stem.position.set(fx, fy + 0.75, fz);
      group.add(stem);
      const panel = box(1.1, 0.06, 0.8, 0x2e3e6b);
      panel.position.set(fx + 0.25, fy + 1.55, fz + 0.15);
      panel.rotation.z = -0.5 + rand(-0.08, 0.08);
      panel.rotation.x = 0.3;
      group.add(panel);
      addMoonBlocker(fx, fz, 0.45);
    }
    // one rover always charging here, dreaming in maps
    const napper = adultRover({ body: 0xc4ccd4 });
    placeNPC(napper, SET.x - 3.4, SET.z + 8.6, 2.6);
    napper.userData.head.rotation.x = 0.55;
    register({
      pos: new THREE.Vector3(SET.x - 3.4, 0, SET.z + 8.6), r: 1.8, zone: 'moon',
      label: 'peek at the charging rover',
      use: () => ui.say('(Mid-charge. Its wheels twitch, very slightly. Miss Pinion was right — they do dream in maps.)'),
    });
  }

  // the beacon: how the moon talks to anyone patient enough to watch
  {
    const bx = SET.x + 7, bz = SET.z - 6;
    const by = moonHeight(bx, bz);
    const tower = new THREE.Mesh(new THREE.CylinderGeometry(0.14, 0.3, 7.5, 7), mat(0x9aa3ad, 0.6));
    tower.position.set(bx, by + 3.75, bz);
    tower.castShadow = true;
    group.add(tower);
    const lamp = new THREE.Mesh(new THREE.IcosahedronGeometry(0.42, 1),
      new THREE.MeshStandardMaterial({
        color: 0xffd9a0, emissive: 0xffc97a, emissiveIntensity: 0.2, flatShading: true,
      }));
    lamp.position.set(bx, by + 7.8, bz);
    lamp.material.fog = false;
    group.add(lamp);
    addMoonBlocker(bx, bz, 0.8);
    // it blinks the old harbor pattern: two short, one long, rest
    let blinkT = 0;
    updates.push((dt, t) => {
      blinkT = (blinkT + dt) % 3.6;
      const on = blinkT < 0.25 || (blinkT > 0.55 && blinkT < 0.8) || (blinkT > 1.2 && blinkT < 2.0);
      lamp.material.emissiveIntensity = on ? 2.0 : 0.12;
    });

    const beacon = adultRover({ body: 0xd8d2c0 });
    const mast = new THREE.Mesh(new THREE.CylinderGeometry(0.02, 0.03, 0.9, 4), mat(0xc9962e, 0.5));
    mast.position.set(0.18, 0.9, -0.25);
    beacon.add(mast);
    const mastLamp = new THREE.Mesh(new THREE.IcosahedronGeometry(0.07, 0),
      new THREE.MeshStandardMaterial({ color: 0xffd9a0, emissive: 0xffc97a, flatShading: true }));
    mastLamp.position.set(0.18, 1.38, -0.25);
    beacon.add(mastLamp);
    placeNPC(beacon, bx - 1.8, bz + 1.6, 0.8);
    let beaconIdx = 0;
    const BEACON_LINES = [
      '⬩ ⬩ — ⬩ (Beacon is delighted to see you. The lamp says so twice, in case the first time was lost to glare.)',
      '— — ⬩ ⬩ ⬩ (A long thought about the light you arrived by. Beacon learned this language from it — secondhand, through forty years of telescope notes.)',
      '⬩ — ⬩ (Beacon aims its lamp at the blue marble overhead, then at you, then back. Translation: “You’re from THERE. It shows. It’s a compliment.”)',
      '— (Beacon holds one long, warm blink. There is no translation. You understood it anyway.)',
    ];
    register({
      getPos: () => beacon.position, r: 2.4, zone: 'moon',
      label: 'watch Beacon blink',
      use: () => {
        tone(1400, { dur: 0.05, vol: 0.03 });
        ui.say(BEACON_LINES[beaconIdx++ % BEACON_LINES.length], { speaker: 'Beacon', voice: 880 });
      },
    });
  }

  // the Best Rock Museum (one dome, one pedestal, one rock; rotation: daily)
  {
    const mx = SET.x - 1, mz = SET.z - 9;
    const my = moonHeight(mx, mz);
    const dome = new THREE.Mesh(new THREE.SphereGeometry(3.2, 10, 6, 0, Math.PI * 2, 0, Math.PI / 2), mat(0xb9b4a8, 0.9));
    dome.position.set(mx, my, mz);
    dome.castShadow = true;
    group.add(dome);
    addMoonBlocker(mx, mz, 3.4);
    const pedestal = new THREE.Mesh(new THREE.CylinderGeometry(0.4, 0.5, 1.1, 7), mat(0xd9d4c8, 0.8));
    pedestal.position.set(mx, my + 0.55, mz + 4.6);
    group.add(pedestal);
    const bestRock = new THREE.Mesh(new THREE.IcosahedronGeometry(0.38, 0), mat(0x9a9aa4, 0.95));
    bestRock.position.set(mx, my + 1.35, mz + 4.6);
    bestRock.castShadow = true;
    group.add(bestRock);
    addMoonBlocker(mx, mz + 4.6, 0.7);
    updates.push((dt, t) => {
      bestRock.rotation.y = t * 0.3; // display rotation. it earned this.
    });
    const ROCKS = [
      'Gerald (igneous)', 'The Toast', 'Roundish', 'Item 7',
      'A Frankly Beautiful Rock', 'The One Sojo Sat On',
      'Probably A Meteorite (disputed)', 'Greg (Gerald’s rival)',
    ];
    const today = Math.floor(Date.now() / 86400000);
    register({
      pos: new THREE.Vector3(mx, 0, mz + 5.6), r: 2.2, zone: 'moon',
      label: 'admire today’s best rock',
      use: () => ui.say([
        `The pedestal plaque reads: “TODAY’S BEST ROCK: ${ROCKS[today % ROCKS.length]}. Please admire responsibly.”`,
        'It rotates slowly under a beam of pure sunlight. It is, you have to admit, a great rock.',
      ]),
    });

    const pebble = adultRover({ body: 0xd2cabe });
    const bowtie = box(0.22, 0.1, 0.05, 0xb0453a);
    bowtie.position.set(0, 0.62, 0.38);
    pebble.add(bowtie);
    placeNPC(pebble, mx + 2.2, mz + 4.2, -0.7);
    let pebbleIdx = 0;
    const PEBBLE_LINES = [
      'Pebble. Curator. Welcome to the Best Rock Museum. Today’s best rock is on the pedestal. Yesterday’s best rock is everywhere else. The collection is doing very well.',
      'We rotate which rock is the best one. Democracy. The dust sea votes too — its ballots are extremely heavy and arrive at terminal velocity.',
      'No, you cannot donate. You may NOMINATE. The committee meets at earthrise and consists of whoever is awake.',
      'Down home they keep a whole museum of things that stopped moving. Fern. A legend. We exchange letters through the telescope, one word a night.',
    ];
    register({
      getPos: () => pebble.position, r: 2.4, zone: 'moon',
      label: 'talk to Pebble',
      use: () => ui.say(PEBBLE_LINES[pebbleIdx++ % PEBBLE_LINES.length], { speaker: 'Pebble', voice: 480 }),
    });
  }

  // crater signage (the parks department is one rover with strong opinions)
  for (const c of CRATERS) {
    const a = Math.atan2(SET.x - c.x, SET.z - c.z); // sign faces the settlement
    const sx = c.x + Math.sin(a) * (c.r + 2.5);
    const sz = c.z + Math.cos(a) * (c.r + 2.5);
    const sy = moonHeight(sx, sz);
    const post = box(0.1, 1.3, 0.1, 0x9aa3ad);
    post.position.set(sx, sy + 0.65, sz);
    group.add(post);
    const boardC = box(1.7, 0.6, 0.08, 0xd9d4c8);
    boardC.position.set(sx, sy + 1.5, sz);
    boardC.rotation.y = a;
    group.add(boardC);
    register({
      pos: new THREE.Vector3(sx, 0, sz), r: 2.0, zone: 'moon',
      label: 'read the crater sign',
      use: () => ui.say(c.sign),
    });
  }

  // the lookout: Old Sojo, a bench, and home in the sky
  {
    const c = CRATERS[0]; // Contentment, naturally
    const a = Math.atan2(MOON.x - c.x, (MOON.z - 100) - c.z);
    const lx = c.x + Math.sin(a) * (c.r + 1.5) - 4;
    const lz = c.z + Math.cos(a) * (c.r + 1.5);
    const ly = moonHeight(lx, lz);
    const bench = new THREE.Group();
    const seat = box(2.4, 0.14, 0.6, 0xb9b4a8);
    seat.position.y = 0.5;
    bench.add(seat);
    for (const sx of [-1, 1]) {
      const leg = box(0.14, 0.5, 0.55, 0x9aa3ad);
      leg.position.set(sx * 0.95, 0.25, 0);
      bench.add(leg);
    }
    bench.position.set(lx, ly, lz);
    bench.rotation.y = Math.PI; // facing the rise
    group.add(bench);
    addMoonBlocker(lx, lz, 0.7);
    const plate = box(0.7, 0.3, 0.05, 0xc9962e);
    plate.position.set(lx + 1.4, ly + 0.5, lz);
    group.add(plate);
    register({
      pos: new THREE.Vector3(lx + 1.4, 0, lz + 0.8), r: 1.8, zone: 'moon',
      label: 'read the bench plate',
      use: () => ui.say('“RATED FOR TWO ROVERS OR ONE SOFT VISITOR. — the committee”'),
    });

    const sojo = adultRover({ body: 0xcfc4a8, scale: 1.5 });
    // one wheel replaced, long ago, with whatever fit
    const odd = sojo.userData.wheels[2];
    odd.scale.setScalar(1.3);
    odd.material = mat(0xb0453a, 0.6);
    placeNPC(sojo, lx - 2.4, lz - 0.4, Math.PI - 0.3);
    let sojoIdx = 0;
    const SOJO_STORIES = [
      ['“Sit. The bench is rated for two rovers or one soft visitor.”',
       '“I came up alone, before the kindergarten, before the stickers. The Labs sent me with a shovel arm, a radio, and a list of questions longer than the fuel was.”',
       '“The radio failed the second winter. So I drove circles — big ones, so the telescope could read them. STILL HERE. STILL HERE. They chalked it on a blackboard down there. I hear it’s still chalked.”',
       '“Then one day the sky opened, and a rocket brought up the kindergarten’s first graduate, and I have not drawn an emergency circle since. I draw them for fun now. Completely different circles.”'],
      ['“See home up there? It rises and sets like anything else. The blue one. The loud one.”',
       '“Sound can’t cross the empty, so we feel instead — through the wheels, through the ground. The tide pulling. The volcano humming, smug. And on the heavy tides, sailor… something ringing.”',
       '“I told the Labs decades ago. They framed a chart about it and gave the credit to a wolf. Fair. He HEARD it. We only ever felt it.”'],
      ['“The first thing I did up here? Nothing. For a month. It was MAGNIFICENT.”',
       '“The Labs thought I’d broken down. I was listening to the quiet. The quiet up here isn’t empty — it’s full. It’s every sound that ever got to rest.”',
       '“That’s why the grown-ups stay, when any of us could roll home rich on meteorites. This is the quietest place the archipelago owns. Somebody has to appreciate it professionally.”'],
    ];
    register({
      getPos: () => sojo.position, r: 2.8, zone: 'moon',
      label: 'talk to Old Sojo',
      use: () => ui.say(SOJO_STORIES[sojoIdx++ % SOJO_STORIES.length], { speaker: 'Old Sojo', voice: 360 }),
    });

    register({
      pos: new THREE.Vector3(lx, 0, lz + 1), r: 1.6, zone: 'moon', priority: 0,
      label: 'sit and watch home',
      use: () => ui.say([
        'The archipelago hangs in the black — blue and green and small enough to cup in two paws. Clouds drift across the strait. The volcano is smoking. Comfortable, even from here.',
        'Southeast of the big island, deep in the navy water, something catches the sun. A glint. Gone the moment you fix on it, back the moment you stop trying.',
        'Old Sojo doesn’t look over. “We’ve charted that glint for forty years,” she says. “It rings on the heavy tides. Someday somebody is going to go down there and say hello. Not a rover — we rust. Somebody soft, and stubborn.”',
      ]),
    });
  }

  // ---------------------------------------------------- the track garden ----
  {
    const θmax = 22.6;
    for (let th = 0.6; th < θmax; th += 0.34) {
      const r = 1.5 + 0.42 * th;
      const gx = TRAX.x + Math.cos(th) * r;
      const gz = TRAX.z + Math.sin(th) * r;
      const seg = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.04, 0.16), mat(0x6e6e78, 1));
      seg.position.set(gx, moonHeight(gx, gz) + 0.03, gz);
      seg.rotation.y = -th - Math.PI / 2;
      group.add(seg);
    }
    const tracks = adultRover({ body: 0xe2ddd0 });
    tracks.userData.wheels.forEach((w) => { w.material = mat(0xf2efe4, 0.8); }); // chalk wheels
    group.add(tracks);
    let th = 0.6, dir = 1;
    updates.push((dt) => {
      th += dir * dt * 0.5;
      if (th > θmax) { th = θmax; dir = -1; }
      if (th < 0.6) { th = 0.6; dir = 1; }
      const r = 1.5 + 0.42 * th;
      const gx = TRAX.x + Math.cos(th) * r;
      const gz = TRAX.z + Math.sin(th) * r;
      tracks.position.set(gx, moonHeight(gx, gz), gz);
      tracks.rotation.y = -th - (dir > 0 ? Math.PI / 2 : -Math.PI / 2);
      for (const w of tracks.userData.wheels) w.rotation.x += dt * 3;
    });
    let tracksIdx = 0;
    const TRACKS_LINES = [
      'Tracks. I draw. The dust holds a line for ten thousand years, so you had better mean it.',
      'This one is called “Spiral No. 41: I Kept Going.” The critics — Pebble — call it “round.” The critics are correct. That IS the piece.',
      'Your boots are adding to the work right now. Don’t apologize. Collaboration.',
      'Sojo’s emergency circles are still out past the east rim. We maintain them. Not because anyone’s in trouble. Because they’re the best thing anyone here ever drew.',
    ];
    register({
      getPos: () => tracks.position, r: 2.6, zone: 'moon',
      label: 'talk to Tracks',
      use: () => ui.say(TRACKS_LINES[tracksIdx++ % TRACKS_LINES.length], { speaker: 'Tracks', voice: 560 }),
    });
  }

  // ------------------------------------------------------- the dust sea ----
  // fishing, except the sea is dust, the rod is a magnet, and the bite
  // is a CLUNK you feel through your boots.
  {
    const magnetRover = adultRover({ body: 0xb89890 });
    const rod = new THREE.Mesh(new THREE.CylinderGeometry(0.025, 0.025, 1.3, 4), mat(0x7a5230));
    rod.position.set(0.3, 0.85, 0.3);
    rod.rotation.z = -0.7;
    magnetRover.add(rod);
    const horseshoe = new THREE.Mesh(new THREE.TorusGeometry(0.12, 0.05, 6, 10, Math.PI), mat(0xb0453a, 0.5));
    horseshoe.position.set(0.85, 0.45, 0.3);
    horseshoe.rotation.z = Math.PI;
    magnetRover.add(horseshoe);
    placeNPC(magnetRover, DUST.x - DUST.r + 2.5, DUST.z - 4, 1.2);
    let magnetIdx = 0;
    const MAGNET_LINES = [
      'The sea down home keeps a bell, I hear. Ours keeps everything else that ever fell. Fair trade, I’d say. Quieter inventory.',
      'I caught a Moonpearl once. ONE. I think about it the way your magpie thinks about buttons — constantly, and out loud.',
      'Watch for the dimples. The sea breathes where it’s holding something. Don’t ask me how dust breathes. It didn’t ask how you do.',
    ];
    register({
      getPos: () => magnetRover.position, r: 2.6, zone: 'moon',
      label: 'talk to Magnet',
      use: () => {
        if (!S.hasFlag('magnetLent')) {
          S.setFlag('magnetLent');
          jingle();
          ui.say([
            'Magnet. I fish the dust sea. Not fish-fish — iron-fish. The sky has been restocking it for four billion years and nobody else has a license.',
            'Here — the loaner rod. Cast at a dimple, wait for the CLUNK, and mind the too-soon. The dust hates eagerness. Same as any sea.',
          ], { speaker: 'Magnet', voice: 420 });
          ui.toast('Magnet lent you the <b>loaner rod</b>! Cast it at dimples in the dust sea.', '🧲');
          return;
        }
        ui.say(MAGNET_LINES[magnetIdx++ % MAGNET_LINES.length], { speaker: 'Magnet', voice: 420 });
      },
    });

    // the dimples: where the sea is breathing
    const dimples = [];
    function moveDimple(d) {
      const a = rand(0, Math.PI * 2);
      const r = rand(3, DUST.r - 4);
      d.x = DUST.x + Math.cos(a) * r;
      d.z = DUST.z + Math.sin(a) * r;
      d.m.position.set(d.x, moonHeight(d.x, d.z) + 0.05, d.z);
    }
    for (let i = 0; i < 3; i++) {
      const ring = new THREE.Mesh(new THREE.TorusGeometry(0.5, 0.07, 5, 12),
        new THREE.MeshStandardMaterial({ color: 0x55555e, flatShading: true, roughness: 1 }));
      ring.rotation.x = Math.PI / 2;
      group.add(ring);
      const d = { m: ring, x: 0, z: 0, phase: rand(0, 6) };
      moveDimple(d);
      dimples.push(d);
    }
    updates.push((dt, t) => {
      for (const d of dimples) {
        d.m.scale.setScalar(1 + Math.sin(t * 1.4 + d.phase) * 0.18);
      }
    });

    // the cast itself
    let dustState = 'idle'; // idle | waiting | clunk
    let dustTimer = 0;
    let activeDimple = null;
    const castFrom = new THREE.Vector3();
    const magnetBob = new THREE.Mesh(new THREE.IcosahedronGeometry(0.14, 0), mat(0xb0453a, 0.5));
    magnetBob.visible = false;
    group.add(magnetBob);

    function nearDimple() {
      for (const d of dimples) {
        if (Math.hypot(d.x - player.group.position.x, d.z - player.group.position.z) < 4.4) return d;
      }
      return null;
    }

    function resetCast() {
      dustState = 'idle';
      magnetBob.visible = false;
      activeDimple = null;
    }

    register({
      getPos: () => player.group.position, r: 99, priority: 0, zone: 'moon',
      enabled: () => S.hasFlag('magnetLent') && (dustState !== 'idle' || !!nearDimple()),
      label: () => (dustState === 'idle' ? 'cast the magnet'
        : dustState === 'clunk' ? 'haul it up!' : 'feel for the clunk…'),
      use: () => {
        if (dustState === 'idle') {
          const d = nearDimple();
          if (!d) return;
          activeDimple = d;
          castFrom.copy(player.group.position);
          magnetBob.position.set(d.x, moonHeight(d.x, d.z) + 0.25, d.z);
          magnetBob.visible = true;
          plop();
          dustState = 'waiting';
          dustTimer = rand(2.5, 6);
        } else if (dustState === 'waiting') {
          resetCast();
          ui.toast('Too soon. The dust closes over whatever it was holding.', '🌑');
        } else if (dustState === 'clunk') {
          const id = rollTable(METEOR_TABLE);
          S.addItem(id);
          jingle();
          ui.foundItem(id);
          ui.updateHUD();
          moveDimple(activeDimple);
          resetCast();
        }
      },
    });

    updates.push((dt, t, playerPos) => {
      if (dustState === 'idle') return;
      if (castFrom.distanceTo(playerPos) > 0.4) { resetCast(); return; }
      if (dustState === 'waiting') {
        magnetBob.position.y = moonHeight(magnetBob.position.x, magnetBob.position.z) + 0.25 + Math.sin(t * 2) * 0.04;
        dustTimer -= dt;
        if (dustTimer <= 0) {
          dustState = 'clunk';
          dustTimer = 0.9;
          magnetBob.position.y -= 0.22;
          thud(); // you feel it through your boots
        }
      } else if (dustState === 'clunk') {
        dustTimer -= dt;
        if (dustTimer <= 0) {
          resetCast();
          sadTrombone();
          ui.toast('It let go. Somewhere below, iron settles back into its nap.', '🧲');
        }
      }
    });
  }

  // moon rocks, personally considered
  {
    const spots = [];
    for (let i = 0; i < 8; i++) {
      const a = (i / 8) * Math.PI * 2 + 0.4;
      const r = rand(22, 44);
      const x = MOON.x + Math.cos(a) * r;
      const z = MOON.z + Math.sin(a) * r;
      const rock = new THREE.Mesh(new THREE.IcosahedronGeometry(rand(0.22, 0.34), 0), mat(0x8e8e98, 0.95));
      rock.position.set(x, moonHeight(x, z) + 0.15, z);
      rock.castShadow = true;
      group.add(rock);
      const spot = { rock, regrow: 0 };
      spots.push(spot);
      register({
        pos: rock.position, r: 1.8, zone: 'moon',
        enabled: () => rock.visible,
        label: 'pick up a moon rock',
        use: () => {
          rock.visible = false;
          spot.regrow = 300; // the moon finds another; the moon has several
          S.addItem('moon_rock');
          jingle();
          ui.foundItem('moon_rock');
          ui.updateHUD();
        },
      });
    }
    updates.push((dt) => {
      for (const s of spots) {
        if (!s.rock.visible) {
          s.regrow -= dt;
          if (s.regrow <= 0) s.rock.visible = true;
        }
      }
    });
  }

  // Comet, who does the perimeter (the perimeter does not need doing)
  {
    const comet = adultRover({ body: 0xeef2f6, scale: 1.15 });
    placeNPC(comet, SET.x - 2, SET.z - 2, 0);
    const state = { target: null, pauseT: 0 };
    updates.push((dt, t, playerPos) => {
      const pd = Math.hypot(playerPos.x - comet.position.x, playerPos.z - comet.position.z);
      if (pd < 3.2) {
        comet.rotation.y = turnToward(comet.rotation.y,
          Math.atan2(playerPos.x - comet.position.x, playerPos.z - comet.position.z), dt, 6);
        return;
      }
      if (state.pauseT > 0) { state.pauseT -= dt; return; }
      if (!state.target) {
        const a = rand(0, Math.PI * 2);
        state.target = { x: SET.x + Math.cos(a) * rand(4, 13), z: SET.z + Math.sin(a) * rand(4, 13) };
      }
      const dx = state.target.x - comet.position.x, dz = state.target.z - comet.position.z;
      const dist = Math.hypot(dx, dz);
      if (dist < 0.4) { state.target = null; state.pauseT = rand(0.5, 2); return; }
      comet.rotation.y = turnToward(comet.rotation.y, Math.atan2(dx, dz), dt, 4);
      comet.position.x += Math.sin(comet.rotation.y) * 2.6 * dt; // zoomy
      comet.position.z += Math.cos(comet.rotation.y) * 2.6 * dt;
      comet.position.y = moonHeight(comet.position.x, comet.position.z);
      for (const w of comet.userData.wheels) w.rotation.x += dt * 9;
    });
    let cometIdx = 0;
    const COMET_LINES = [
      'I do the perimeter every day. The perimeter does not need doing. THAT’S WHY IT’S PERFECT.',
      'Crater Whee is named honestly. Try the east slope. Tuck your arms. Trust the dust.',
      'When you go back down — visit the kindergarten. Wave through the glass. It’s load-bearing. You’ll understand when you wave.',
    ];
    register({
      getPos: () => comet.position, r: 2.6, zone: 'moon',
      label: 'talk to Comet',
      use: async () => {
        if (!S.hasFlag('metComet')) {
          S.setFlag('metComet');
          tone(990, { dur: 0.06, vol: 0.04 });
          tone(1320, { time: 0.08, dur: 0.06, vol: 0.04 });
          await ui.say([
            '(A rover zooms up so fast it has to orbit you twice to stop.)',
            'bip! BIP! You came UP! From DOWN! Did— did you come through the kindergarten? Is Miss Pinion still— is the window still— do they still WAVE?',
          ], { speaker: 'Comet', voice: 920 });
          if (S.hasFlag('metPinion')) {
            S.addItem('gold_star');
            jingle();
            await ui.say([
              'I knew it. I KNEW you smelled like crayons and ambition.',
              'Here — my last sticker from graduation. Miss Pinion says you spend them on people, not things. So. Spent.',
            ], { speaker: 'Comet', voice: 920 });
            ui.toast('Comet gave you a <b>Gold Star Sticker</b>! It is better than money.', '⭐');
          } else {
            await ui.say('You haven’t MET her?! Go down. Go to the glass room. Say the blocks out loud. Then come back and we’ll talk, graduate to future graduate.',
              { speaker: 'Comet', voice: 920 });
          }
          return;
        }
        ui.say(COMET_LINES[cometIdx++ % COMET_LINES.length], { speaker: 'Comet', voice: 920 });
      },
    });
  }

  // ============================================================ update ----
  function update(dt, t, playerPos) {
    for (const u of updates) u(dt, t, playerPos);
  }

  return { group, update };
}

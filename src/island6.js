// Notbell Labs: the far-west research isle. Founded to hear the bell again
// (the machines kept getting bigger; the research kept getting wider), now
// home to frontier chemistry, one room-sized computer, a rocket division,
// a cafeteria, and a kindergarten of rovers who may go to the moon when
// they grow up, if they want. Almost named Bell Labs. Legal said no.

import * as THREE from 'three';
import { SITES, ISLAND3, ISLAND6, terrainHeight, WATER_Y } from './terrain.js';
import * as zones from './zones.js';
import { register } from './interact.js';
import * as ui from './ui.js';
import * as S from './state.js';
import { buildAnimal, animateGait } from './animals.js';
import { jingle, tone, doorChime, sip } from './audio.js';
import { rand, pick, turnToward } from './utils.js';
import { addIslandInfo } from './fieldguide.js';
import { HOLIDAY } from './calendar.js';
import { currentWeather, setSpaceFade } from './almanac.js';
import { setLaunchNight } from './sky.js';

function mat(color, rough = 0.9) {
  return new THREE.MeshStandardMaterial({ color, flatShading: true, roughness: rough });
}

function box(w, h, d, color) {
  const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat(color));
  m.castShadow = true;
  return m;
}

function solidShadowCaster(o) {
  if (!o.isMesh) return false;
  const materials = Array.isArray(o.material) ? o.material : [o.material];
  return !materials.some((m) => m && (
    m.transparent || m.isMeshBasicMaterial || (m.emissive && m.emissive.getHex() !== 0)
  ));
}

const IN = { x: 300, z: 1700 }; // the labs interior, off in the elsewhere

// the dock the Persistent calls at (consumed by boats.js — create the labs
// before the boats in main.js, same deal as BULKO)
export const LABS_DOCK = { x: 0, z: 0, rotY: 0, buoyPos: null };

// ----------------------------------------------------------- the flag ----
// The Notbell flag: the outline of the bell that isn't, a button where the
// clapper was. Same mark as the front door of the website, because the Labs
// standardized it. They standardize everything. They have a committee.

function flagTexture() {
  const cv = document.createElement('canvas');
  cv.width = 160;
  cv.height = 100;
  const ctx = cv.getContext('2d');
  ctx.fillStyle = '#fdf6e4';
  ctx.fillRect(0, 0, 160, 100);
  ctx.strokeStyle = '#e8d5ae';
  ctx.lineWidth = 5;
  ctx.strokeRect(2, 2, 156, 96);
  // the bell that isn't
  ctx.strokeStyle = '#8a6f4d';
  ctx.lineWidth = 5;
  ctx.setLineDash([9, 7]);
  ctx.beginPath();
  ctx.moveTo(58, 62);
  ctx.bezierCurveTo(58, 30, 64, 16, 80, 16);
  ctx.bezierCurveTo(96, 16, 102, 30, 102, 62);
  ctx.quadraticCurveTo(108, 65, 108, 70);
  ctx.lineTo(52, 70);
  ctx.quadraticCurveTo(52, 65, 58, 62);
  ctx.stroke();
  // the button that is
  ctx.setLineDash([]);
  ctx.fillStyle = '#f2cf5b';
  ctx.strokeStyle = '#c9a02c';
  ctx.lineWidth = 2.5;
  ctx.beginPath();
  ctx.arc(80, 80, 9, 0, Math.PI * 2);
  ctx.fill();
  ctx.stroke();
  ctx.fillStyle = '#8a6f4d';
  for (const [hx, hz] of [[-3, -3], [3, -3], [-3, 3], [3, 3]]) {
    ctx.beginPath();
    ctx.arc(80 + hx, 80 + hz, 1.6, 0, Math.PI * 2);
    ctx.fill();
  }
  const tex = new THREE.CanvasTexture(cv);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

// ------------------------------------------------------------ rovers ----
// (exported: the moon is where they go when they grow up)

export function buildRover(bodyColor = 0xdfe2e6) {
  const g = new THREE.Group();
  const body = box(0.55, 0.22, 0.75, bodyColor);
  body.position.y = 0.28;
  g.add(body);
  const panel = new THREE.Mesh(new THREE.BoxGeometry(0.4, 0.04, 0.45), mat(0x2e3e6b, 0.5));
  panel.position.set(0, 0.42, -0.12);
  g.add(panel);
  const wheels = [];
  const wheelGeo = new THREE.CylinderGeometry(0.13, 0.13, 0.09, 8);
  wheelGeo.rotateZ(Math.PI / 2);
  for (const [sx, sz] of [[-1, 1], [1, 1], [-1, 0], [1, 0], [-1, -1], [1, -1]]) {
    const w = new THREE.Mesh(wheelGeo, mat(0x2e2a26, 0.6));
    w.position.set(sx * 0.34, 0.13, sz * 0.3);
    g.add(w);
    wheels.push(w);
  }
  const mast = new THREE.Mesh(new THREE.CylinderGeometry(0.025, 0.035, 0.42, 5), mat(0x9aa3ad, 0.5));
  mast.position.set(0, 0.6, 0.22);
  g.add(mast);
  const headG = new THREE.Group();
  const eyeBox = box(0.16, 0.1, 0.1, 0xc8ccd2);
  headG.add(eyeBox);
  const eye = new THREE.Mesh(new THREE.IcosahedronGeometry(0.045, 0),
    new THREE.MeshStandardMaterial({ color: 0x222222, roughness: 0.3 }));
  eye.position.z = 0.06;
  headG.add(eye);
  headG.position.set(0, 0.82, 0.22);
  g.add(headG);
  const antenna = new THREE.Mesh(new THREE.CylinderGeometry(0.012, 0.012, 0.3, 4), mat(0xf2cf5b, 0.5));
  antenna.position.set(-0.18, 0.55, -0.25);
  g.add(antenna);
  g.traverse((o) => { if (solidShadowCaster(o)) o.castShadow = true; });
  g.userData = { wheels, head: headG };
  return g;
}

// a tiny yellow hard hat, regulation issue
function hardHat() {
  const h = new THREE.Group();
  const dome = new THREE.Mesh(new THREE.IcosahedronGeometry(0.32, 0), mat(0xf2cf5b, 0.6));
  dome.scale.set(1, 0.62, 1);
  h.add(dome);
  const brim = new THREE.Mesh(new THREE.CylinderGeometry(0.4, 0.42, 0.05, 9), mat(0xe2bd42, 0.6));
  brim.position.y = -0.1;
  h.add(brim);
  h.traverse((o) => { if (solidShadowCaster(o)) o.castShadow = true; });
  return h;
}

export function createIsland6(player) {
  const group = new THREE.Group();
  const updates = [];      // (dt, t, playerPos) — exterior, island zone only
  const labUpdates = [];   // (dt, t, playerPos) — interior, labs zone only
  const Y = SITES.labsYard;
  const P = SITES.labsPad;

  addIslandInfo({
    key: 'labs',
    name: 'Notbell Labs', x: -121, z: -58, r: 42, icon: '🚀',
    blurb: 'The far-west research isle. Frontier chemistry, one computer the size of a room, a rocket division, and a kindergarten of rovers (window: please wave). The chart ends before the island does. The Labs find this extremely funny.',
    folk: 'Director Strix · Ada, software · Dr. Hazel · Pots · Miss Pinion · the rovers · the Boring Department',
    mystery: '“Far west, past the moss isle, somebody is doing SCIENCE at the sky. On still nights you can hear it hum. I hear it FIRST.” —Howell, who is, once again, right',
  });

  // ===================================================== the facility ----
  const fx = -126, fz = -63; // building center
  const fy = Y.h;
  {
    const main = box(16, 5, 7, 0xe6e2d4);
    main.userData.occlude = true;
    main.position.set(fx, fy + 2.5, fz);
    main.receiveShadow = true;
    group.add(main);
    // a band of windows, lit from within (science doesn't sleep)
    for (let i = 0; i < 6; i++) {
      const win = new THREE.Mesh(new THREE.BoxGeometry(1.5, 1.1, 0.1),
        new THREE.MeshStandardMaterial({
          color: 0xfff3c4, emissive: 0xffe9a0, emissiveIntensity: 0.55,
          flatShading: true, roughness: 0.4,
        }));
      win.position.set(fx - 6.5 + i * 2.6, fy + 2.9, fz + 3.52);
      group.add(win);
    }
    // door, south face
    const door = box(1.8, 2.6, 0.18, 0x4a5568);
    door.position.set(fx, fy + 1.3, fz + 3.55);
    group.add(door);
    const lintel = box(2.4, 0.5, 0.3, 0xb6b1a4);
    lintel.position.set(fx, fy + 2.8, fz + 3.6);
    group.add(lintel);
    zones.addBlocker(fx - 4.5, fz, 5.2);
    zones.addBlocker(fx + 4.5, fz, 5.2);
    zones.addBlocker(fx, fz + 2.8, 1.4); // the doorway recess is a recess, not a hallway

    register({
      pos: new THREE.Vector3(fx, 0, fz + 4.4), r: 2.2,
      label: 'enter Notbell Labs',
      use: async () => {
        doorChime();
        await zones.go('labs');
        if (!S.hasFlag('visitedLabs')) {
          S.setFlag('visitedLabs');
          ui.toast('It smells like chalk, solder, and ambition.', '🔬');
        }
      },
    });
  }

  // -------------------------------------------------- the roof catwalk ----
  // stairs up the WEST side (the causeway owns the east approach now),
  // a railed walk across the top, a telescope at the far end.
  // "the catwalk is the best part of the facility" —management
  const ROOF_Y = fy + 5.65;
  const CATWALK_HALF_W = 1.55;
  const stairX0 = fx - 7.2;  // top of the stairs (roof's west edge)
  const stairX1 = fx - 14.2; // bottom of the stairs (ground, westward)
  zones.addCrossing({
    contains(x, z) {
      return x >= stairX1 && x <= stairX0 && Math.abs(z - fz) < CATWALK_HALF_W;
    },
    height(x) {
      const t = (x - stairX0) / (stairX1 - stairX0);
      return ROOF_Y + (fy - ROOF_Y) * t;
    },
  });
  zones.addCrossing({
    contains(x, z) {
      return x >= stairX0 && x <= fx + 7.2 && Math.abs(z - fz) < CATWALK_HALF_W;
    },
    height: () => ROOF_Y,
  });
  {
    // the stair: a long inclined slab with cleats, plus rails
    const run = stairX0 - stairX1; // climbs eastward, toward the roof
    const rise = ROOF_Y - fy;
    const slab = box(Math.hypot(run, rise) + 0.4, 0.16, CATWALK_HALF_W * 2 - 0.2, 0x9aa3ad);
    slab.position.set((stairX0 + stairX1) / 2, (ROOF_Y + fy) / 2 + 0.05, fz);
    slab.rotation.z = Math.atan2(rise, run);
    slab.castShadow = slab.receiveShadow = true;
    group.add(slab);
    for (let i = 0; i < 8; i++) {
      const t = (i + 0.5) / 8;
      const cleat = box(0.18, 0.07, CATWALK_HALF_W * 2 - 0.2, 0x6b7280);
      cleat.position.set(stairX1 + t * run, fy + t * rise + 0.14, fz);
      cleat.castShadow = cleat.receiveShadow = true;
      group.add(cleat);
    }
    // the catwalk deck and rails
    const deck = box(15, 0.14, CATWALK_HALF_W * 2, 0x9aa3ad);
    deck.position.set(fx, ROOF_Y - 0.07, fz);
    deck.castShadow = deck.receiveShadow = true;
    group.add(deck);
    for (const sz of [-1, 1]) {
      for (let i = 0; i <= 7; i++) {
        const post = box(0.08, 1.05, 0.08, 0xd9534f);
        post.position.set(fx - 7 + i * 2, ROOF_Y + 0.52, fz + sz * CATWALK_HALF_W);
        post.castShadow = post.receiveShadow = true;
        group.add(post);
      }
      const rail = box(15, 0.08, 0.08, 0xd9534f);
      rail.position.set(fx, ROOF_Y + 1.05, fz + sz * CATWALK_HALF_W);
      rail.castShadow = rail.receiveShadow = true;
      group.add(rail);
    }
    // the telescope, pointed somewhere very specific
    const scope = new THREE.Group();
    const tripod = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.5, 1.1, 5), mat(0x55483a));
    tripod.position.y = 0.55;
    scope.add(tripod);
    const tube = new THREE.Mesh(new THREE.CylinderGeometry(0.16, 0.22, 1.3, 8), mat(0xc9962e, 0.45));
    tube.position.y = 1.25;
    tube.rotation.x = -0.9; // up, and a little north
    scope.add(tube);
    scope.position.set(fx + 6.4, ROOF_Y, fz);
    scope.traverse((o) => { if (solidShadowCaster(o)) o.castShadow = true; });
    group.add(scope);
    register({
      pos: new THREE.Vector3(fx + 6.4, 0, fz), r: 1.8,
      label: 'peer through the telescope',
      use: () => ui.say(S.hasFlag('rocketPowered')
        ? ['The moon, enormous and patient. Someone has taped a note to the eyepiece: “SOON.”']
        : ['The moon, enormous and patient. Chalked on the railing beside the telescope, an arrow pointing up: “IT’S RIGHT THERE.”']),
    });
  }

  // ------------------------------------------------------ the forecourt ----
  // benches, planters, and the flag. office-park charm, frontier edition.
  {
    for (const [bx, bz, ry] of [
      [fx - 3.4, fz + 5.6, 0.5], [fx + 3.4, fz + 5.6, -0.5], [Y.x - 6.2, Y.z + 4.8, Math.PI / 2],
    ]) {
      const bench = new THREE.Group();
      const seat = box(2.0, 0.12, 0.55, 0xa97c50);
      seat.position.y = 0.55;
      bench.add(seat);
      const back = box(2.0, 0.5, 0.1, 0xa97c50);
      back.position.set(0, 0.95, -0.26);
      bench.add(back);
      for (const sx of [-0.8, 0.8]) {
        const leg = box(0.12, 0.55, 0.5, 0x6b7280);
        leg.position.set(sx, 0.28, 0);
        bench.add(leg);
      }
      bench.position.set(bx, terrainHeight(bx, bz), bz);
      bench.rotation.y = ry;
      group.add(bench);
      zones.addBlocker(bx, bz, 0.8);
    }
    // planters: poured concrete, institutional; flowers: insubordinate
    for (const [px, pz] of [
      [fx - 5.8, fz + 5.6], [fx + 5.8, fz + 5.6], [Y.x - 3.8, Y.z + 7.0], [Y.x - 8.6, Y.z + 6.1],
    ]) {
      const py = terrainHeight(px, pz);
      const tub = box(1.5, 0.55, 1.5, 0xb6b1a4);
      tub.position.set(px, py + 0.28, pz);
      group.add(tub);
      const soil = box(1.3, 0.1, 1.3, 0x5a4632);
      soil.position.set(px, py + 0.56, pz);
      group.add(soil);
      for (let f = 0; f < 5; f++) {
        const stem = new THREE.Mesh(new THREE.CylinderGeometry(0.02, 0.03, 0.45, 4), mat(0x3f9747));
        stem.position.set(px + rand(-0.45, 0.45), py + 0.8, pz + rand(-0.45, 0.45));
        group.add(stem);
        const bloom = new THREE.Mesh(new THREE.IcosahedronGeometry(0.11, 0),
          mat(pick([0xf2cf5b, 0xe88a8a, 0xb9a3e8, 0xf2f2e0]), 0.7));
        bloom.position.set(stem.position.x, py + 1.05, stem.position.z);
        group.add(bloom);
      }
      zones.addBlocker(px, pz, 1.0);
    }
  }

  // ----------------------------------------------------------- the flag ----
  const flagBaseX = fx, flagBaseZ = fz + 8.6;
  let flagGroup, flagCloth;
  {
    const py = terrainHeight(flagBaseX, flagBaseZ);
    const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.1, 8.2, 7), mat(0xd9d4c8, 0.5));
    pole.position.set(flagBaseX, py + 4.1, flagBaseZ);
    pole.castShadow = true;
    group.add(pole);
    const finial = new THREE.Mesh(new THREE.IcosahedronGeometry(0.14, 0), mat(0xf2cf5b, 0.4));
    finial.position.set(flagBaseX, py + 8.3, flagBaseZ);
    group.add(finial);
    // the little floodlight that makes regulation 4(c) legal
    const flood = box(0.3, 0.2, 0.3, 0x4a5568);
    flood.position.set(flagBaseX + 0.7, py + 0.15, flagBaseZ + 0.7);
    flood.rotation.z = 0.6;
    group.add(flood);
    zones.addBlocker(flagBaseX, flagBaseZ, 0.5);

    flagGroup = new THREE.Group();
    flagCloth = new THREE.Mesh(new THREE.PlaneGeometry(1.8, 1.1, 6, 1),
      new THREE.MeshStandardMaterial({
        map: flagTexture(), side: THREE.DoubleSide, flatShading: true, roughness: 0.9,
      }));
    flagCloth.position.x = 0.92;
    flagGroup.add(flagCloth);
    flagGroup.position.set(flagBaseX, py + 7.6, flagBaseZ);
    group.add(flagGroup);

    const plaque = box(0.9, 0.6, 0.08, 0xc9b178);
    plaque.position.set(flagBaseX - 0.9, py + 0.9, flagBaseZ);
    plaque.rotation.x = -0.3;
    group.add(plaque);
    register({
      pos: new THREE.Vector3(flagBaseX, 0, flagBaseZ), r: 2.4,
      label: 'read the flag protocol',
      use: () => ui.say([
        'A brass plaque, polished to regulation shine:',
        '“FLAG PROTOCOL. Up at dawn. IN when it rains — the flag is wool, and Pylon insists. Half-mast on Bell Day, for the bell, who would have understood.”',
        '“Flown at night under floodlight, as permitted by regulation 4(c), which we wrote, about our flag. The committee thanks you for noticing the flag.”',
      ]),
    });

    // etiquette, checked the slow way — flags don't hurry
    let flagT = 0;
    updates.push((dt, t) => {
      // a cloth in the wind: each strip of the plane waves a little later
      const posA = flagCloth.geometry.attributes.position;
      for (let i = 0; i < posA.count; i++) {
        const lx = posA.getX(i);
        posA.setZ(i, Math.sin(t * 3.2 + lx * 2.4) * 0.09 * (lx + 0.92));
      }
      posA.needsUpdate = true;
      flagT -= dt;
      if (flagT <= 0) {
        flagT = 3;
        const wet = currentWeather() !== 'clear';
        flagGroup.visible = !wet;
        const py = terrainHeight(flagBaseX, flagBaseZ);
        const half = HOLIDAY?.id === 'bellday';
        flagGroup.position.y = py + (half ? 4.6 : 7.6);
      }
    });
  }

  // -------------------------------------------------------- the big ear ----
  {
    const dx = Y.x - 2, dz = Y.z - 13; // north of the yard, clear of the eaves
    const dy = terrainHeight(dx, dz);
    const dish = new THREE.Group();
    const pedestal = new THREE.Mesh(new THREE.CylinderGeometry(0.5, 0.9, 2.2, 7), mat(0x9aa3ad, 0.6));
    pedestal.position.y = 1.1;
    dish.add(pedestal);
    const bowlG = new THREE.Group();
    const bowl = new THREE.Mesh(new THREE.CylinderGeometry(2.6, 0.5, 1.3, 12, 1, true),
      new THREE.MeshStandardMaterial({ color: 0xe6e2d4, flatShading: true, roughness: 0.7, side: THREE.DoubleSide }));
    bowl.position.y = 0.6;
    bowlG.add(bowl);
    const feed = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.04, 1.6, 4), mat(0x6b7280));
    feed.position.y = 1.0;
    bowlG.add(feed);
    const blinker = new THREE.Mesh(new THREE.IcosahedronGeometry(0.09, 0),
      new THREE.MeshStandardMaterial({ color: 0xd9534f, emissive: 0xd9534f, emissiveIntensity: 1.2, flatShading: true }));
    blinker.position.y = 1.85;
    bowlG.add(blinker);
    bowlG.position.y = 2.3;
    bowlG.rotation.x = -0.7; // aimed up and out to sea
    dish.add(bowlG);
    dish.position.set(dx, dy, dz);
    dish.traverse((o) => { if (solidShadowCaster(o)) o.castShadow = true; });
    group.add(dish);
    zones.addBlocker(dx, dz, 1.4);
    updates.push((dt, t) => {
      dish.rotation.y = Math.sin(t * 0.05) * 1.2; // a very slow, very thorough sweep
      blinker.material.emissiveIntensity = (Math.sin(t * 2.5) > 0.4) ? 1.4 : 0.15;
    });
    register({
      pos: new THREE.Vector3(dx, 0, dz + 2.2), r: 2.2,
      label: 'listen at the big ear',
      use: () => ui.say(pick([
        ['A plate on the pedestal: “EST. TO HEAR THE BELL AGAIN. STILL LISTENING. THE RESEARCH GREW.”'],
        ['You put your ear to the pedestal. The dish hums. Far below the hum, fainter than fair, something goes: …ding?', 'Probably the tide. Probably.'],
        ['Logbook, latest entry: “03:12 — heard a whale. Rude one. Logged anyway. All data is data.”'],
      ])),
    });
  }

  // ------------------------------------------------------ the launch pad ----
  let rocketGlow, rocket, launch = null;
  const smoke = []; // faceted exhaust puffs at liftoff
  {
    const ring = new THREE.Mesh(new THREE.CylinderGeometry(6.2, 6.6, 0.25, 18), mat(0x8a857a, 0.95));
    ring.position.set(P.x, P.h + 0.05, P.z);
    ring.receiveShadow = true;
    group.add(ring);
    const scorch = new THREE.Mesh(new THREE.CylinderGeometry(2.6, 2.6, 0.28, 14), mat(0x44403a, 1));
    scorch.position.set(P.x, P.h + 0.07, P.z);
    group.add(scorch);

    // the rocket: white, red, and certain
    rocket = new THREE.Group();
    const bodyR = new THREE.Mesh(new THREE.CylinderGeometry(1.05, 1.15, 5.6, 10), mat(0xf2efe4, 0.7));
    bodyR.position.y = 3.4;
    rocket.add(bodyR);
    const band = new THREE.Mesh(new THREE.CylinderGeometry(1.08, 1.1, 0.5, 10), mat(0xd9534f, 0.7));
    band.position.y = 4.6;
    rocket.add(band);
    const nose = new THREE.Mesh(new THREE.ConeGeometry(1.06, 2.1, 10), mat(0xd9534f, 0.7));
    nose.position.y = 7.25;
    rocket.add(nose);
    for (let i = 0; i < 3; i++) {
      const fin = box(0.18, 1.8, 1.3, 0xd9534f);
      const a = (i / 3) * Math.PI * 2;
      fin.position.set(Math.cos(a) * 1.15, 1.3, Math.sin(a) * 1.15);
      fin.rotation.y = -a;
      rocket.add(fin);
    }
    const engine = new THREE.Mesh(new THREE.CylinderGeometry(0.75, 1.0, 0.8, 10), mat(0x6b7280, 0.4));
    engine.position.y = 0.4;
    rocket.add(engine);
    const porthole = new THREE.Mesh(new THREE.TorusGeometry(0.3, 0.07, 6, 12), mat(0xc9962e, 0.45));
    porthole.position.set(0, 5.6, 1.06);
    rocket.add(porthole);
    const portglass = new THREE.Mesh(new THREE.CircleGeometry(0.28, 10),
      new THREE.MeshStandardMaterial({ color: 0xbfe6f2, flatShading: true, roughness: 0.3 }));
    portglass.position.set(0, 5.6, 1.07);
    rocket.add(portglass);
    // the heart chamber: a small open hatch at paw height
    const hatchRim = new THREE.Mesh(new THREE.TorusGeometry(0.26, 0.06, 6, 12), mat(0xc9962e, 0.45));
    hatchRim.position.set(0, 2.0, 1.12);
    rocket.add(hatchRim);
    rocketGlow = new THREE.Mesh(new THREE.CircleGeometry(0.24, 10),
      new THREE.MeshStandardMaterial({
        color: 0x2a2622, emissive: 0x000000, emissiveIntensity: 1, flatShading: true,
      }));
    rocketGlow.position.set(0, 2.0, 1.13);
    rocket.add(rocketGlow);
    rocket.position.set(P.x, P.h, P.z);
    rocket.traverse((o) => { if (solidShadowCaster(o)) o.castShadow = true; });
    group.add(rocket);
    zones.addBlocker(P.x, P.z, 1.9);

    // the gantry: scaffolding with opinions about safety
    const gantry = new THREE.Group();
    for (const [gx, gz] of [[-0.6, -0.6], [0.6, -0.6], [-0.6, 0.6], [0.6, 0.6]]) {
      const legG = box(0.16, 8.6, 0.16, 0xd9534f);
      legG.position.set(gx, 4.3, gz);
      gantry.add(legG);
    }
    for (let lvl = 1; lvl <= 4; lvl++) {
      for (const [w, d, rx] of [[1.4, 0.12, 0], [0.12, 1.4, 0]]) {
        const bar = box(w, 0.1, d, 0x9aa3ad);
        bar.position.y = lvl * 2;
        gantry.add(bar);
      }
    }
    const arm = box(1.6, 0.16, 0.3, 0x9aa3ad);
    arm.position.set(1.4, 5.4, 0);
    gantry.add(arm);
    const gantryLamp = new THREE.Mesh(new THREE.IcosahedronGeometry(0.14, 0),
      new THREE.MeshStandardMaterial({ color: 0xfff3c4, emissive: 0x000000, flatShading: true }));
    gantryLamp.position.set(0, 8.8, 0);
    gantry.add(gantryLamp);
    gantry.position.set(P.x - 3.1, P.h, P.z);
    gantry.traverse((o) => { if (solidShadowCaster(o)) o.castShadow = true; });
    group.add(gantry);
    zones.addBlocker(P.x - 3.1, P.z, 1.2);

    function powerUp() {
      rocketGlow.material.color.set(0xffd9a0);
      rocketGlow.material.emissive.set(0xffc97a);
      portglass.material.color.set(0xfff3c4);
      portglass.material.emissive = new THREE.Color(0xffe9a0);
      gantryLamp.material.emissive.set(0xffe9a0);
    }
    if (S.hasFlag('rocketPowered')) powerUp();
    updates.push((dt, t) => {
      if (S.hasFlag('rocketPowered')) {
        rocketGlow.material.emissiveIntensity = 1 + Math.sin(t * 1.6) * 0.4; // a heartbeat
      }
    });

    register({
      pos: new THREE.Vector3(P.x, 0, P.z + 2.6), r: 2.8,
      enabled: () => !launch, // no re-triggering once you've lit the candle
      label: () => S.hasFlag('rocketPowered') ? 'check on the rocket' : 'inspect the rocket',
      use: async () => {
        if (S.hasFlag('rocketPowered')) {
          const go = await ui.ask(
            'The heart chamber glows steady. The gantry lamp is lit. The clipboard checklist is all ticks except the last line, which reads, simply: “GO?”',
            [
              { label: '🚀 Go', value: 'go' },
              { label: 'Not yet', value: null },
            ]);
          if (!go) {
            ui.say('The rocket hums on, unbothered. Patience is the oldest part of lighthouse keeping.');
            return;
          }
          if (!S.hasFlag('moonHelmet')) {
            S.setFlag('moonHelmet');
            S.addItem('bubble_helmet');
            jingle();
            await ui.say([
              'Dr. Hazel sprints from the facility holding something round and gleaming, goggles askew.',
              '“WAIT. WAIT. Helmet! HELMET. It’s a fishbowl with delusions and three patents. Air for a whole afternoon, and your hat fits under it. We checked. We checked WITH HATS.”',
            ], { speaker: 'Dr. Hazel', voice: 700 });
            ui.toast('Got the <b>Bubble Helmet</b>! It fogs up when you grin. It will fog up a lot.', '🫧');
          }
          liftoff(); // the rocket climbs (you're inside); narration + cut-to-moon play out in update()
          return;
        }
        const firstLook = !S.hasFlag('sawRocket');
        S.setFlag('sawRocket');
        if (S.countItem('lightseed')) {
          const place = await ui.ask(
            'The heart chamber sits open at paw height, padded like a jewel box. In your pocket, the Lightseed hums louder — it can see the sky from here.',
            [
              { label: '🌟 Place the Lightseed', value: 'yes' },
              { label: 'Not yet', value: null },
            ]);
          if (place) {
            S.removeItem('lightseed');
            S.setFlag('rocketPowered');
            powerUp();
            jingle();
            await ui.say([
              'You set the warm little glow into the chamber. It settles the way a cat settles: completely, and with authority.',
              'Somewhere inside the rocket, something begins to hum the lighthouse song. The gantry lamp flicks on by itself. Across the yard, three hard hats turn at once.',
              'The light kept the harbor for a hundred years. Now it sits at the bottom of a rocket, glowing up at the nose cone like: well? You said UP.',
            ]);
            ui.toast('The rocket has a heart. <i>Hold that thought — the moon can wait a little longer.</i>', '🚀');
          }
          return;
        }
        await ui.say([
          'White and red and patient, pointing at the sky like a question mark with excellent posture.',
          'A small hatch stands open at the heart of it. Empty. A brass plaque beneath:',
          '“WANTED: one light that knows the way home. INQUIRE: everywhere. (We did. Still inquiring.)”',
        ]);
        if (firstLook) {
          ui.toast('A light that knows the way home… you may have met one, sleeping.', '✨');
        }
      },
    });
  }

  // ------------------------------------------------------------ the sign ----
  {
    const sx = Y.x + 2, sz = Y.z + 10.5;
    const sy = terrainHeight(sx, sz);
    const post1 = box(0.14, 1.8, 0.14, 0x6b7280);
    post1.position.set(sx - 1.6, sy + 0.9, sz);
    group.add(post1);
    const post2 = box(0.14, 1.8, 0.14, 0x6b7280);
    post2.position.set(sx + 1.6, sy + 0.9, sz);
    group.add(post2);
    const boardS = box(3.8, 1.2, 0.14, 0xf0e8d8);
    boardS.position.set(sx, sy + 1.7, sz);
    group.add(boardS);
    zones.addBlocker(sx, sz, 0.6);
    register({
      pos: new THREE.Vector3(sx, 0, sz + 1), r: 2.2,
      label: 'read the sign',
      use: () => ui.say([
        '“NOTBELL LABS — research in progress. Mind the rovers. The rovers mind you back.”',
        'Smaller, underneath: “Almost Bell Labs. Legal — a heron, freelance — said no. We keep his letter framed. It’s very politely worded.”',
      ]),
    });
  }

  // ------------------------------------------------------------- the pier ----
  {
    // the shore that faces home: walk the bearing toward Notbell until wet
    const bearing = Math.atan2(0 - Y.x, 0 - Y.z); // toward the home island
    const bx = Math.sin(bearing), bz = Math.cos(bearing);
    let shoreT = 10;
    for (let tt = 10; tt < 36; tt += 0.5) {
      if (terrainHeight(Y.x + bx * tt, Y.z + bz * tt) < 0.18) break;
      shoreT = tt;
    }
    const sx = Y.x + bx * shoreT, sz = Y.z + bz * shoreT;
    LABS_DOCK.x = sx;
    LABS_DOCK.z = sz;
    LABS_DOCK.rotY = bearing + Math.PI; // step off facing the Labs
    const px = -bz, pz = bx;
    for (let i = 0; i < 5; i++) {
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
        if (t < -0.5 || t > 5.5) return false;
        return Math.abs(dx * px + dz * pz) < 1.3;
      },
      height: () => 0.64,
    });
    // the buoy, for ringing the Persistent
    const buoy = new THREE.Group();
    const base = new THREE.Mesh(new THREE.CylinderGeometry(0.4, 0.55, 1.0, 7), mat(0xb0453a));
    base.position.y = 0.5;
    buoy.add(base);
    const top = new THREE.Mesh(new THREE.IcosahedronGeometry(0.22, 0), mat(0xf2cf5b, 0.4));
    top.position.y = 1.2;
    buoy.add(top);
    const bxp = sx + px * 2.6, bzp = sz + pz * 2.6;
    buoy.position.set(bxp, terrainHeight(bxp, bzp), bzp);
    buoy.traverse((o) => { if (solidShadowCaster(o)) o.castShadow = true; });
    group.add(buoy);
    LABS_DOCK.buoyPos = new THREE.Vector3(bxp, 0, bzp);
  }

  // ------------------------------------------- the causeway from the north ----
  // a long timber causeway from the North Isle, with the archipelago's first
  // telephone line walking beside it.
  // there is one telephone. it calls the other end of this bridge.
  {
    const dirX = Y.x - ISLAND3.x, dirZ = Y.z - ISLAND3.z;
    const len = Math.hypot(dirX, dirZ);
    const ux = dirX / len, uz = dirZ / len;
    // find the dry ends
    let tA = 12;
    for (let tt = 12; tt < len; tt += 0.5) {
      if (terrainHeight(ISLAND3.x + ux * tt, ISLAND3.z + uz * tt) < 0.25) { tA = tt - 1; break; }
    }
    let tB = len - 14;
    for (let tt = len - 14; tt > 0; tt -= 0.5) {
      if (terrainHeight(ISLAND3.x + ux * tt, ISLAND3.z + uz * tt) < 0.25) { tB = tt + 1; break; }
    }
    const ax = ISLAND3.x + ux * tA, az = ISLAND3.z + uz * tA;
    const bx2 = ISLAND3.x + ux * tB, bz2 = ISLAND3.z + uz * tB;
    const span = tB - tA;
    const hA = terrainHeight(ax, az) + 0.15;
    const hB = terrainHeight(bx2, bz2) + 0.15;
    const deckH = (tt) => {
      const t = (tt - tA) / span;
      return hA + (hB - hA) * t + Math.sin(t * Math.PI) * 1.1;
    };
    zones.addCrossing({
      contains(x, z) {
        const dx = x - ISLAND3.x, dz = z - ISLAND3.z;
        const t = dx * ux + dz * uz;
        if (t < tA - 0.5 || t > tB + 0.5) return false;
        return Math.abs(dx * -uz + dz * ux) < 1.4;
      },
      height(x, z) {
        const t = (x - ISLAND3.x) * ux + (z - ISLAND3.z) * uz;
        return deckH(Math.min(Math.max(t, tA), tB));
      },
    });
    const sx2 = -uz, sz2 = ux; // sideways
    for (let tt = tA; tt <= tB; tt += 1.1) {
      const h = deckH(tt);
      const deckRot = Math.atan2(ux, uz);
      const wood = Math.round(tt) % 5 === 2 ? 0x96703f : 0xa97c50;
      const plank = box(3.15, 0.16, 1.05, wood);
      plank.position.set(ISLAND3.x + ux * tt, h, ISLAND3.z + uz * tt);
      plank.rotation.y = deckRot;
      plank.receiveShadow = true;
      group.add(plank);

      for (const side of [-1, 1]) {
        const beam = box(0.22, 0.2, 1.08, 0x6b4a2e);
        beam.position.set(
          ISLAND3.x + ux * tt + sx2 * side * 1.72,
          h + 0.08,
          ISLAND3.z + uz * tt + sz2 * side * 1.72);
        beam.rotation.y = deckRot;
        group.add(beam);
      }

      if (Math.round(tt - tA) % 4 === 0) {
        for (const side of [-1, 1]) {
          const pile = new THREE.Mesh(new THREE.CylinderGeometry(0.16, 0.22, h - WATER_Y + 1.2, 6), mat(0x6b4a2e));
          pile.position.set(
            ISLAND3.x + ux * tt + sx2 * side * 1.55,
            (h + WATER_Y - 1.2) / 2,
            ISLAND3.z + uz * tt + sz2 * side * 1.55);
          group.add(pile);
        }
      }
      if (Math.round(tt - tA) % 7 === 0) {
        for (const side of [-1, 1]) {
          const post = new THREE.Mesh(new THREE.CylinderGeometry(0.09, 0.12, 1.05, 6), mat(0x7a5230));
          post.position.set(
            ISLAND3.x + ux * tt + sx2 * side * 1.72,
            h + 0.56,
            ISLAND3.z + uz * tt + sz2 * side * 1.72);
          post.castShadow = true;
          group.add(post);
        }
      }
    }
    // the telephone line: poles every few spans, wire sagging in between
    // (it ends at the shore; indoors the call continues by ordinary shouting)
    let prevTop = null;
    for (let tt = tA + 2; tt <= tB; tt += 7) {
      const wx = ISLAND3.x + ux * tt + sx2 * 2.1;
      const wz = ISLAND3.z + uz * tt + sz2 * 2.1;
      const baseY = deckH(tt) - 0.4;
      const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.09, 0.12, 4.4, 6), mat(0x7a5230));
      pole.position.set(wx, baseY + 2.2, wz);
      pole.castShadow = true;
      group.add(pole);
      const cross = box(1.2, 0.1, 0.1, 0x7a5230);
      cross.position.set(wx, baseY + 4.0, wz);
      cross.rotation.y = Math.atan2(ux, uz) + Math.PI / 2;
      group.add(cross);
      const top = new THREE.Vector3(wx, baseY + 4.0, wz);
      if (prevTop) {
        // two slack segments per span — close enough to a catenary for wool
        const mid = prevTop.clone().lerp(top, 0.5);
        mid.y -= 0.55;
        for (const [a, b] of [[prevTop, mid], [mid, top]]) {
          const segLen = a.distanceTo(b);
          const wire = new THREE.Mesh(new THREE.CylinderGeometry(0.022, 0.022, segLen, 3), mat(0x3a3a3a, 0.5));
          wire.position.copy(a).lerp(b, 0.5);
          wire.lookAt(b);
          wire.rotateX(Math.PI / 2);
          group.add(wire);
        }
      }
      prevTop = top;
    }
  }

  // ------------------------------------------------- engineers, exterior ----
  // the Boring Department: they dug the foundations. they are not boring.
  const walkers = [];
  function addWalker(name, points, lines, opts = {}) {
    const mole = buildAnimal('mole', { body: opts.body ?? 0x5a4a44 });
    mole.scale.setScalar(0.95);
    const hat = hardHat();
    hat.position.y = 1.55;
    mole.add(hat);
    mole.position.set(points[0].x, points[0].y ?? terrainHeight(points[0].x, points[0].z), points[0].z);
    group.add(mole);
    const w = { g: mole, points, seg: 0, speed: opts.speed ?? 1.3, pause: 0, fixedY: opts.fixedY };
    walkers.push(w);
    register({
      getPos: () => mole.position,
      r: 2.4,
      label: `talk to ${name}`,
      use: () => ui.say(pick(lines), { speaker: name, voice: 290 }),
    });
    return w;
  }
  addWalker('Gantry', [
    { x: fx - 6.5, z: fz, y: ROOF_Y }, { x: fx + 7, z: fz, y: ROOF_Y },
  ], [
    'Gantry. Boring Department, rooftop division. The catwalk is the best part of the facility. Management agrees. Management is also up here.',
    'From up here you can see the pad, the sea, and whether Pots is carrying the soup pot. Critical infrastructure, this view.',
    'We dug the foundations, you know. Then they said “dig UP.” Career-defining day.',
  ], { fixedY: ROOF_Y, speed: 1.0 });
  addWalker('Pylon', [
    { x: Y.x + 3, z: Y.z + 4 }, { x: LABS_DOCK.x - 2, z: LABS_DOCK.z - 2 }, { x: Y.x + 7, z: Y.z - 4 },
  ], [
    'Pylon. Logistics. Everything on this island arrived by boat, including the opinion that we need a bigger boat.',
    'The flag is wool. WOOL. You do not fly wet wool. I wrote a memo. The memo is now policy. Best day of my life.',
    'Crates in, science out. That’s the whole job. The science weighs less. Nobody can explain where the weight goes.',
  ]);
  addWalker('Doppler', [
    { x: P.x + 6.5, z: P.z + 2 }, { x: P.x + 2, z: P.z + 6.5 }, { x: P.x - 2, z: P.z - 6.5 }, { x: P.x + 6, z: P.z - 3 },
  ], [
    'Doppler. Pad safety. We test on Tuesdays. We also define Tuesday experimentally.',
    'Stand anywhere you like. The rocket is OFF. Being off is its best-tested feature.',
    'When she goes up, the checklist is nine pages. Page nine just says “wave.”',
  ], { speed: 1.6 });

  // Scout, the rover who graduated early (it asked)
  const scout = buildRover(0xe8e2d2);
  scout.position.set(P.x + 5, P.h, P.z + 5);
  group.add(scout);
  const scoutState = { target: null, pauseT: 0 };
  register({
    getPos: () => scout.position,
    r: 2.2,
    label: 'say hi to Scout',
    use: () => {
      tone(880, { dur: 0.07, vol: 0.04 });
      tone(1180, { time: 0.09, dur: 0.07, vol: 0.04 });
      ui.say(pick([
        '(Scout draws a slow, careful circle around you, beeping contentedly, then returns to work. The circle was a hug.)',
        '(Scout shows you a pebble it has been pushing around the pad all morning. It is, Scout indicates, a GREAT pebble.)',
        '(Scout points its eye at the rocket, then at you, then at the rocket. Beep. You understand each other completely.)',
      ]));
    },
  });

  // ========================================================== interior ----
  const B = IN;
  group.traverse((o) => {
    if (solidShadowCaster(o)) o.castShadow = true;
  });

  buildInterior();

  function buildInterior() {
    const room = new THREE.Group();
    const W = 36, D = 24; // x: 282..318, z: 1688..1712
    const wallMat = mat(0xe8e6da, 0.95);
    const floor = new THREE.Mesh(new THREE.BoxGeometry(W + 2, 0.3, D + 2), mat(0xcfd2cc, 1));
    floor.position.set(B.x, -0.15, B.z);
    floor.receiveShadow = true;
    room.add(floor);
    // walls (the south wall leaves a doorway)
    const north = new THREE.Mesh(new THREE.BoxGeometry(W + 2, 4.6, 0.5), wallMat);
    north.position.set(B.x, 2.3, B.z - D / 2);
    room.add(north);
    for (const sx of [-1, 1]) {
      const side = new THREE.Mesh(new THREE.BoxGeometry(0.5, 4.6, D + 2), wallMat);
      side.position.set(B.x + sx * W / 2, 2.3, B.z);
      room.add(side);
    }
    for (const sx of [-1, 1]) {
      const south = new THREE.Mesh(new THREE.BoxGeometry(W / 2 - 1.2, 4.6, 0.5), wallMat);
      south.position.set(B.x + sx * (W / 4 + 0.6), 2.3, B.z + D / 2);
      room.add(south);
    }
    const lintel2 = new THREE.Mesh(new THREE.BoxGeometry(2.6, 1.6, 0.5), wallMat);
    lintel2.position.set(B.x, 3.8, B.z + D / 2);
    room.add(lintel2);

    // a non-walkable gantry over the hall, for atmosphere and one sign
    const beam = box(W - 4, 0.18, 1.4, 0x9aa3ad);
    beam.position.set(B.x, 3.4, B.z - 2);
    room.add(beam);
    for (const sx of [-12, 0, 12]) {
      const post = box(0.14, 3.4, 0.14, 0x9aa3ad);
      post.position.set(B.x + sx, 1.7, B.z - 2);
      room.add(post);
    }
    const banner = box(6, 0.9, 0.06, 0xf0e8d8);
    banner.position.set(B.x, 2.6, B.z - 1.9);
    room.add(banner);
    register({
      pos: new THREE.Vector3(B.x, 0, B.z - 1), r: 3, zone: 'labs',
      label: 'read the banner',
      use: () => ui.say('“DAYS SINCE LAST UNSCHEDULED DISCOVERY: 0 — and proud of it.”'),
    });

    const blockers = [
      { x: B.x, z: B.z - 2, r: 0.4 }, // gantry posts (the middle one)
    ];

    // ------------------------------------------------------- the lobby ----
    const desk = box(3.2, 1.1, 0.9, 0xa97c50);
    desk.position.set(B.x + 3.2, 0.55, B.z + 8.4);
    room.add(desk);
    blockers.push({ x: B.x + 3.2, z: B.z + 8.4, r: 1.6 });
    // Director Strix, behind the desk, fully briefed
    const strix = buildAnimal('owl', { body: 0x8a7a66, head: 0x9a8a76 });
    strix.position.set(B.x + 3.2, 0, B.z + 7.3);
    strix.rotation.y = Math.PI;
    room.add(strix);
    let strixIdx = 0;
    const STRIX_LINES = [
      'We were nearly Bell Labs, you know. Legal — a heron, freelance — advised against. His invoice was one (1) fish. We framed the invoice. We frame things, here.',
      'The Labs were founded to hear the bell again. The listening machines kept getting bigger, and the questions kept getting wider, and one morning there was a rocket division. Research is like that.',
      'The wolf was right, by the way. Low-frequency event, foggy nights only, source: under the sea. The seismograph said so. He visits the chart on Sundays. Brings the chart a biscuit.',
      'Funding? Buttons. Endowed by the estate of a keeper who believed light should go wherever it’s needed. We are taking her extremely literally.',
    ];
    register({
      pos: new THREE.Vector3(B.x + 3.2, 0, B.z + 6.8), r: 2.6, zone: 'labs',
      label: 'talk to Director Strix',
      use: async () => {
        if (!S.hasFlag('metStrix')) {
          S.setFlag('metStrix');
          await ui.say([
            'The owl behind the desk swivels her whole head to you, which saves a great deal of time.',
            '“Director Strix. Welcome to Notbell Labs. We research everything the sea didn’t explain. The list is long. The coffee is free. The rovers are friendly. Mind the chalk.”',
          ], { speaker: 'Director Strix', voice: 330 });
          return;
        }
        if (S.hasFlag('rocketPowered')) {
          ui.say('The rocket hums like a kept promise. Fueling, checklists, and then — well. The moon has been very patient with us. We intend to be worth it.',
            { speaker: 'Director Strix', voice: 330 });
          return;
        }
        if (S.countItem('lightseed')) {
          ui.say('You’re CARRYING it? It’s humming — the whole building can feel it. Go. GO. The pad. Gently! Like an egg! A very important egg!',
            { speaker: 'Director Strix', voice: 330 });
          return;
        }
        if (S.hasFlag('sawRocket')) {
          ui.say([
            'The heart chamber, yes. Engines we have. Fuel we have. What a rocket NEEDS is a light that knows the way home — navigation is mostly remembering, you see.',
            'There is one sleeping under your island. The old harbor light, in the glow worm cave. ASK it. Worst case it says no, and you’ve made a friend.',
          ], { speaker: 'Director Strix', voice: 330 });
          return;
        }
        ui.say(STRIX_LINES[strixIdx++ % STRIX_LINES.length], { speaker: 'Director Strix', voice: 330 });
      },
    });
    labUpdates.push((dt, t, playerPos) => {
      const dx = playerPos.x - strix.position.x, dz = playerPos.z - strix.position.z;
      if (Math.hypot(dx, dz) < 8) {
        strix.rotation.y = turnToward(strix.rotation.y, Math.atan2(dx, dz), dt, 4);
      }
      animateGait(strix, t, 0, 8);
    });

    // THE WOLF WAS RIGHT (framed, dusted weekly)
    {
      const frame = box(2.2, 1.3, 0.08, 0x7a5230);
      frame.position.set(B.x + 9, 2.2, B.z + 11.6);
      room.add(frame);
      const cv = document.createElement('canvas');
      cv.width = 256; cv.height = 144;
      const ctx = cv.getContext('2d');
      ctx.fillStyle = '#fdf6e4';
      ctx.fillRect(0, 0, 256, 144);
      ctx.strokeStyle = '#5b4a32';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(10, 80);
      for (let x = 10; x < 246; x += 4) {
        const spike = (x > 120 && x < 150) ? Math.sin((x - 120) * 0.4) * 38 : Math.sin(x * 0.6) * 4;
        ctx.lineTo(x, 80 - spike);
      }
      ctx.stroke();
      ctx.fillStyle = '#8a3a2e';
      ctx.font = '700 17px ui-rounded, "Segoe UI", system-ui, sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText('THE WOLF WAS RIGHT', 128, 126);
      const tex = new THREE.CanvasTexture(cv);
      tex.colorSpace = THREE.SRGBColorSpace;
      const chart = new THREE.Mesh(new THREE.PlaneGeometry(2.0, 1.1),
        new THREE.MeshStandardMaterial({ map: tex, flatShading: true, roughness: 0.9 }));
      chart.position.set(B.x + 9, 2.2, B.z + 11.53);
      chart.rotation.y = Math.PI;
      room.add(chart);
      register({
        pos: new THREE.Vector3(B.x + 9, 0, B.z + 10.6), r: 2.2, zone: 'labs',
        label: 'study the framed chart',
        use: () => ui.say([
          'A seismograph trace, mostly calm, with one unmistakable spike. The label: “Unexplained low-frequency event. Foggy nights only. Source: below sea level. Bell-shaped, acoustically speaking.”',
          'Beneath, in different ink: “THE WOLF WAS RIGHT.” Someone has visited this frame often enough to wear the floor pale.',
        ]),
      });
    }

    // --------------------------------------------------- chemistry, west ----
    const chemSteam = [];
    for (const bz of [B.z + 1.5, B.z + 5.5]) {
      const bench = box(5.4, 1.0, 1.3, 0xd9d4c8);
      bench.position.set(B.x - 14.2, 0.5, bz);
      room.add(bench);
      blockers.push({ x: B.x - 14.2, z: bz, r: 1.9 });
      for (let i = 0; i < 4; i++) {
        const fl = new THREE.Mesh(new THREE.IcosahedronGeometry(0.22, 1),
          new THREE.MeshStandardMaterial({
            color: pick([0x7fd4c0, 0xe88a8a, 0xb9a3e8, 0xf2cf5b]),
            transparent: true, opacity: 0.7, flatShading: true, roughness: 0.3,
          }));
        fl.position.set(B.x - 16.2 + i * 1.4, 1.18, bz + rand(-0.3, 0.3));
        room.add(fl);
        const neck = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.05, 0.3, 5), mat(0xd9d4c8, 0.3));
        neck.position.set(fl.position.x, 1.45, fl.position.z);
        room.add(neck);
        if (i % 2 === 0) {
          const puff = new THREE.Mesh(new THREE.IcosahedronGeometry(0.12, 0),
            new THREE.MeshStandardMaterial({
              color: 0xf5f2e9, transparent: true, opacity: 0.18,
              flatShading: true, roughness: 1,
            }));
          puff.position.set(fl.position.x, 1.62, fl.position.z);
          room.add(puff);
          chemSteam.push({ m: puff, x: fl.position.x, z: fl.position.z, phase: chemSteam.length * 0.23 });
        }
      }
    }
    // bubbles: three tiny spheres on shift rotation above the benches
    const chemBubbles = [];
    for (let i = 0; i < 3; i++) {
      const bub = new THREE.Mesh(new THREE.IcosahedronGeometry(0.05, 0),
        new THREE.MeshStandardMaterial({ color: 0xdef2ee, transparent: true, opacity: 0.7, flatShading: true }));
      bub.position.set(B.x - 15.5 + i * 1.4, 1.4, B.z + 1.5);
      room.add(bub);
      chemBubbles.push({ m: bub, t: i * 0.6 });
    }
    labUpdates.push((dt, t) => {
      for (const b of chemBubbles) {
        b.t += dt;
        const ph = b.t % 1.8;
        b.m.position.y = 1.4 + ph * 0.5;
        b.m.material.opacity = 0.7 * (1 - ph / 1.8);
      }
      for (const s of chemSteam) {
        const k = (s.phase + t * 0.12) % 1;
        s.m.position.set(
          s.x + Math.sin(t * 0.6 + s.phase * 11) * 0.08,
          1.55 + k * 0.8,
          s.z + Math.cos(t * 0.5 + s.phase * 9) * 0.06);
        s.m.scale.setScalar(0.45 + k * 0.85);
        s.m.material.opacity = 0.22 * Math.sin(k * Math.PI);
      }
    });
    register({
      pos: new THREE.Vector3(B.x - 13, 0, B.z + 3.5), r: 2.4, zone: 'labs',
      label: 'read the chemistry poster',
      use: () => ui.say([
        '“PERIODIC TABLE OF ELEMENTS WE HAVE: eleven (11). Mostly salt. The sea keeps donating salt.”',
        'Under it, a sticky note: “GLOW (proposed element) — rejected again. It’s not an element, Ada. It’s a FRIEND.”',
      ]),
    });

    // ---------------------------------------------- the computer, east ----
    const blinkLights = [];
    for (let c = 0; c < 4; c++) {
      const cab = box(2.4, 2.8, 0.8, c % 2 ? 0x3e5a5e : 0x46646a);
      cab.position.set(B.x + 10.4, 1.4, B.z - 7.8 + c * 2.9);
      cab.rotation.y = Math.PI / 2;
      room.add(cab);
      blockers.push({ x: B.x + 10.4, z: B.z - 7.8 + c * 2.9, r: 1.5 });
      for (let i = 0; i < 6; i++) {
        const lamp = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.12, 0.06),
          new THREE.MeshStandardMaterial({
            color: 0x222222, emissive: pick([0xffd23e, 0x7fd4c0, 0xe88a8a]),
            emissiveIntensity: 0.1, flatShading: true,
          }));
        lamp.position.set(
          B.x + 9.95,
          1.6 + Math.floor(i / 3) * 0.5,
          B.z - 8.55 + c * 2.9 + (i % 3) * 0.5);
        lamp.rotation.y = Math.PI / 2;
        room.add(lamp);
        blinkLights.push({ m: lamp, t: rand(0, 2), period: rand(0.4, 1.6) });
      }
    }
    // tape reels, turning over the night's results
    const reels = [];
    for (const rz of [B.z - 4.9, B.z + 0.9]) {
      for (const off of [-0.45, 0.45]) {
        const reel = new THREE.Mesh(new THREE.CylinderGeometry(0.34, 0.34, 0.08, 12), mat(0x2e2a26, 0.4));
        reel.rotation.x = Math.PI / 2;
        reel.rotation.z = Math.PI / 2;
        reel.position.set(B.x + 9.9, 2.1, rz + off);
        room.add(reel);
        reels.push(reel);
      }
    }
    labUpdates.push((dt, t) => {
      for (const L of blinkLights) {
        L.t += dt;
        if (L.t > L.period) {
          L.t = 0;
          L.m.material.emissiveIntensity = L.m.material.emissiveIntensity > 0.5 ? 0.1 : 1.1;
        }
      }
      for (const [i, reel] of reels.entries()) {
        reel.rotation.y += dt * (i % 2 ? 1.8 : -1.4);
      }
    });
    // the punch-card desk
    const cardDesk = box(2.6, 0.95, 1.2, 0xa97c50);
    cardDesk.position.set(B.x + 6.4, 0.48, B.z - 6);
    room.add(cardDesk);
    blockers.push({ x: B.x + 6.4, z: B.z - 6, r: 1.5 });
    for (let i = 0; i < 4; i++) {
      const stack = box(0.5, 0.06 + i * 0.02, 0.8, 0xf5f2e9);
      stack.position.set(B.x + 5.6 + i * 0.55, 1.0, B.z - 6 + rand(-0.1, 0.1));
      stack.rotation.y = rand(-0.15, 0.15);
      room.add(stack);
    }
    register({
      pos: new THREE.Vector3(B.x + 6.4, 0, B.z - 4.9), r: 2.0, zone: 'labs',
      label: 'inspect the punch cards',
      use: () => ui.say([
        'Stacks of stiff cards, each punched with neat little holes. A program. You can tell because of the holes.',
        'The top card reads, in pencil: “MOON.1 — do not shuffle. DO NOT SHUFFLE. We learned about shuffling.”',
      ]),
    });
    // Ada, software department, on top of cabinet two
    const ada = new THREE.Group();
    const abody = new THREE.Mesh(new THREE.IcosahedronGeometry(0.17, 0), mat(0x3a3248, 0.6));
    abody.position.y = 0.14;
    ada.add(abody);
    const ahead = new THREE.Mesh(new THREE.IcosahedronGeometry(0.11, 0), mat(0x4a4258, 0.6));
    ahead.position.set(0, 0.12, 0.18);
    ada.add(ahead);
    for (const sx of [-1, 1]) {
      const eye = new THREE.Mesh(new THREE.IcosahedronGeometry(0.025, 0),
        new THREE.MeshStandardMaterial({ color: 0xffd23e, roughness: 0.3 }));
      eye.position.set(sx * 0.045, 0.16, 0.27);
      ada.add(eye);
    }
    for (let i = 0; i < 8; i++) {
      const sx = i < 4 ? -1 : 1;
      const k = i % 4;
      const leg = new THREE.Mesh(new THREE.CylinderGeometry(0.012, 0.012, 0.36, 3), mat(0x3a3248, 0.6));
      leg.position.set(sx * 0.16, 0.06, -0.12 + k * 0.1);
      leg.rotation.z = sx * 1.1;
      ada.add(leg);
    }
    // her thread, anchored to the reel below
    const silk = new THREE.Mesh(new THREE.CylinderGeometry(0.008, 0.008, 0.75, 3),
      new THREE.MeshStandardMaterial({ color: 0xf5f2e9, transparent: true, opacity: 0.6 }));
    silk.position.set(0, -0.37, 0);
    ada.add(silk);
    ada.scale.setScalar(1.65);
    ada.position.set(B.x + 10.2, 2.95, B.z - 4.9);
    room.add(ada);
    let adaIdx = 0;
    const ADA_LINES = [
      'Ada. Software department. Yes, all of it. I weave the programs by paw — core memory is just very opinionated lace.',
      'The computer fills the room. The PROGRAM fits in a thimble. Nobody here finds this as funny as I do, which is their loss.',
      'Bugs in the system? Friend. I am the only engineer alive who EATS the bugs in the system.',
      'Eight legs, eight threads, one loom the size of a building. The moon program is my best doily yet.',
    ];
    register({
      pos: new THREE.Vector3(B.x + 9.4, 0, B.z - 4.9), r: 2.6, zone: 'labs',
      label: 'talk to Ada (look up)',
      use: () => ui.say(ADA_LINES[adaIdx++ % ADA_LINES.length], { speaker: 'Ada', voice: 660 }),
    });
    labUpdates.push((dt, t) => {
      ada.position.y = 2.95 + Math.sin(t * 0.9) * 0.18;
      silk.scale.y = 1 + Math.sin(t * 0.9) * 0.22;
    });

    // ------------------------------------- the rover kindergarten, NE ----
    // glass on two sides, so the engineers can wave. the waving is
    // load-bearing, developmentally.
    const KG = { x0: B.x + 6, x1: B.x + 17, z0: B.z - 11, z1: B.z + 4 };
    {
      const glassMat = new THREE.MeshStandardMaterial({
        color: 0xbfe6f2, transparent: true, opacity: 0.22, roughness: 0.15,
        flatShading: true, side: THREE.DoubleSide,
      });
      // west glass wall (with the doorway), runs along x = KG.x0... but the
      // computer row lives at x ≈ B.x+10 — so the kindergarten is the NE
      // corner BEYOND the cabinets: glass from the cabinet row to the east wall
      const gx = B.x + 12.2; // west edge of the kindergarten
      const wallG = new THREE.Mesh(new THREE.PlaneGeometry(KG.z1 - KG.z0 - 3.2, 3.2), glassMat);
      wallG.rotation.y = Math.PI / 2;
      wallG.position.set(gx, 1.6, (KG.z0 + KG.z1) / 2 + 1.6);
      room.add(wallG);
      const wallS = new THREE.Mesh(new THREE.PlaneGeometry(KG.x1 - gx, 3.2), glassMat);
      wallS.position.set((gx + KG.x1) / 2, 1.6, KG.z1);
      room.add(wallS);
      // walkability: glass with a door gap at the north end of the west wall
      for (let z = KG.z1; z > KG.z0 + 3.4; z -= 1.2) {
        blockers.push({ x: gx, z, r: 0.7 });
      }
      for (let x = gx + 1.2; x < KG.x1; x += 1.2) {
        blockers.push({ x, z: KG.z1, r: 0.7 });
      }
      // inside: blocks, a ramp, a star mobile, a charging corner
      const blocksPos = [KG.x1 - 2, 0, KG.z0 + 2.5];
      for (const [i, c] of [0xe88a8a, 0xf2cf5b, 0x7fd4c0].entries()) {
        const blk = box(0.5, 0.5, 0.5, c);
        blk.position.set(blocksPos[0] + (i % 2) * 0.55, 0.25 + Math.floor(i / 2) * 0.52, blocksPos[2] + (i % 2 ? 0.2 : 0));
        room.add(blk);
      }
      register({
        pos: new THREE.Vector3(blocksPos[0], 0, blocksPos[2] + 1), r: 1.6, zone: 'labs',
        label: 'read the blocks',
        use: () => ui.say('Alphabet blocks: “A IS FOR APOGEE.” “B IS FOR BURN.” “C IS FOR COOKIE.” The curriculum is sound.'),
      });
      const ramp = box(2.2, 0.5, 1.2, 0xc9b178);
      ramp.position.set(KG.x1 - 4.5, 0.18, KG.z0 + 4);
      ramp.rotation.z = 0.22;
      room.add(ramp);
      // the star mobile
      const mobile = new THREE.Group();
      for (let i = 0; i < 4; i++) {
        const a = (i / 4) * Math.PI * 2;
        const star = new THREE.Mesh(new THREE.IcosahedronGeometry(0.12, 0), mat(0xf2cf5b, 0.5));
        star.position.set(Math.cos(a) * 0.8, -0.5 - (i % 2) * 0.3, Math.sin(a) * 0.8);
        mobile.add(star);
        const str = new THREE.Mesh(new THREE.CylinderGeometry(0.008, 0.008, 0.5 + (i % 2) * 0.3, 3), mat(0xd9d4c8, 0.4));
        str.position.set(Math.cos(a) * 0.8, -0.25 - (i % 2) * 0.15, Math.sin(a) * 0.8);
        mobile.add(str);
      }
      const moonBall = new THREE.Mesh(new THREE.IcosahedronGeometry(0.2, 1), mat(0xd9d4c8, 0.7));
      moonBall.position.y = -0.9;
      mobile.add(moonBall);
      mobile.position.set((gx + KG.x1) / 2 + 1, 3.2, (KG.z0 + KG.z1) / 2);
      room.add(mobile);
      labUpdates.push((dt, t) => { mobile.rotation.y = t * 0.25; });
      // charging corner: one rover always napping
      const matPad = box(1.6, 0.06, 1.2, 0x3e4a52);
      matPad.position.set(KG.x1 - 1.6, 0.03, KG.z1 - 1.6);
      room.add(matPad);
      const sleeper = buildRover(0xcfd8de);
      sleeper.position.set(KG.x1 - 1.6, 0, KG.z1 - 1.6);
      sleeper.rotation.y = 2.4;
      sleeper.userData.head.rotation.x = 0.5; // chin down. fast asleep.
      room.add(sleeper);
      const cord = new THREE.Mesh(new THREE.CylinderGeometry(0.02, 0.02, 1.4, 4), mat(0x3a3a3a, 0.5));
      cord.position.set(KG.x1 - 0.8, 0.25, KG.z1 - 1.3);
      cord.rotation.z = 1.2;
      room.add(cord);
      register({
        pos: new THREE.Vector3(KG.x1 - 1.6, 0, KG.z1 - 2.6), r: 1.6, zone: 'labs',
        label: 'peek at the sleeping rover',
        use: () => ui.say('(Charging. Its wheels twitch, very slightly. Miss Pinion says they dream in maps.)'),
      });

      // the students
      const rovers = [];
      for (let i = 0; i < 3; i++) {
        const rv = buildRover();
        rv.position.set(gx + 2 + i * 2.2, 0, KG.z0 + 3 + i * 2.6);
        room.add(rv);
        rovers.push({
          g: rv, target: null, pauseT: rand(0, 2), beeped: false,
          home: { x0: gx + 1.2, x1: KG.x1 - 2.6, z0: KG.z0 + 1.6, z1: KG.z1 - 3 },
        });
        register({
          getPos: () => rv.position,
          r: 1.8, zone: 'labs',
          label: 'say hi to the little rover',
          use: () => {
            tone(990 + i * 120, { dur: 0.06, vol: 0.04 });
            tone(1320 + i * 120, { time: 0.08, dur: 0.06, vol: 0.04 });
            ui.say(pick([
              '(beep! It does a small spin. The spin is for you.)',
              '(beep beep — it shows you a rock it found. There are no rocks in here. It found one anyway.)',
              '(It bumps your ankle, very gently, and reverses. In rover, that’s a handshake.)',
              '(It points its eye at the star mobile, then at you. beep. It wants you to know the moon is up there. You know. It knows you know. beep.)',
            ]));
          },
        });
      }
      labUpdates.push((dt, t, playerPos) => {
        for (const r of rovers) {
          const g = r.g;
          const pd = Math.hypot(playerPos.x - g.position.x, playerPos.z - g.position.z);
          if (pd < 2.2) {
            // a visitor! stop and look (the mast does the looking)
            g.userData.head.rotation.y =
              Math.atan2(playerPos.x - g.position.x, playerPos.z - g.position.z) - g.rotation.y;
            if (!r.beeped) {
              r.beeped = true;
              tone(880, { dur: 0.05, vol: 0.03 });
            }
            continue;
          }
          r.beeped = false;
          g.userData.head.rotation.y *= 1 - Math.min(1, dt * 4);
          if (r.pauseT > 0) {
            r.pauseT -= dt;
            continue;
          }
          if (!r.target) {
            r.target = {
              x: rand(r.home.x0, r.home.x1),
              z: rand(r.home.z0, r.home.z1),
            };
          }
          const dx = r.target.x - g.position.x, dz = r.target.z - g.position.z;
          const dist = Math.hypot(dx, dz);
          if (dist < 0.3) {
            r.target = null;
            r.pauseT = rand(1, 4);
            continue;
          }
          const want = Math.atan2(dx, dz);
          g.rotation.y = turnToward(g.rotation.y, want, dt, 3);
          g.position.x += Math.sin(g.rotation.y) * 0.7 * dt;
          g.position.z += Math.cos(g.rotation.y) * 0.7 * dt;
          for (const w of g.userData.wheels) w.rotation.x += dt * 5;
        }
      });

      // Miss Pinion, who is a hen, which is to say: management material
      const pinion = buildAnimal('duck', { body: 0xf2e6cf, head: 0xf2e6cf });
      const comb = new THREE.Group();
      for (let i = 0; i < 3; i++) {
        const c = new THREE.Mesh(new THREE.IcosahedronGeometry(0.07, 0), mat(0xd9534f, 0.6));
        c.position.set(0, 0.42 + (i === 1 ? 0.06 : 0), 0.12 - i * 0.14);
        comb.add(c);
      }
      pinion.userData.parts.head.add(comb);
      pinion.position.set((gx + KG.x1) / 2, 0, (KG.z0 + KG.z1) / 2 - 1);
      room.add(pinion);
      let pinionIdx = 0;
      const PINION_LINES = [
        'Miss Pinion. Early rover development. We do shapes, naps, and trajectories, in that order, because that is the correct order.',
        'They can go to the moon when they grow up — IF they want. One wants to be a library cart. We are equally proud of all of them.',
        'The glass is so the engineers can wave on their way past. The waving is load-bearing. Developmentally speaking.',
        'Scout graduated early. It asked. You don’t say no to a rover that asks. You CAN’T. We checked the regulations.',
      ];
      register({
        getPos: () => pinion.position,
        r: 2.4, zone: 'labs',
        label: 'talk to Miss Pinion',
        use: () => {
          S.setFlag('metPinion'); // the graduates up there will want to know
          ui.say(PINION_LINES[pinionIdx++ % PINION_LINES.length], { speaker: 'Miss Pinion', voice: 540 });
        },
      });
      labUpdates.push((dt, t, playerPos) => {
        const dx = playerPos.x - pinion.position.x, dz = playerPos.z - pinion.position.z;
        if (Math.hypot(dx, dz) < 5) {
          pinion.rotation.y = turnToward(pinion.rotation.y, Math.atan2(dx, dz), dt, 4);
        }
        animateGait(pinion, t, 0.12, 6); // gentle supervisory pacing-in-place
      });
    }

    // ----------------------------------------------- cafeteria, NW ----
    {
      const counter = box(4.2, 1.05, 1.0, 0xd9d4c8);
      counter.position.set(B.x - 14.6, 0.52, B.z - 9.4);
      room.add(counter);
      blockers.push({ x: B.x - 14.6, z: B.z - 9.4, r: 2.0 });
      const urn = new THREE.Mesh(new THREE.CylinderGeometry(0.35, 0.4, 0.9, 9), mat(0xc9962e, 0.4));
      urn.position.set(B.x - 13.4, 1.5, B.z - 9.4);
      room.add(urn);
      for (const [tx, tz] of [[B.x - 13.5, B.z - 5.6], [B.x - 8.5, B.z - 7.6]]) {
        const table = box(3.4, 0.95, 1.4, 0xa97c50);
        table.position.set(tx, 0.48, tz);
        room.add(table);
        blockers.push({ x: tx, z: tz, r: 2.0 });
        for (const sz of [-1, 1]) {
          const benchT = box(3.2, 0.45, 0.4, 0x96703f);
          benchT.position.set(tx, 0.22, tz + sz * 1.1);
          room.add(benchT);
        }
      }
      register({
        pos: new THREE.Vector3(B.x - 13.4, 0, B.z - 8.3), r: 1.8, zone: 'labs',
        label: 'pour some lab coffee',
        use: () => {
          sip();
          S.drinkCoffee(60);
          ui.toast('Lab coffee: technically coffee. You feel <b>PUBLISHED</b>.', '☕');
        },
      });
      // Pots, the cook (a bear in a toque)
      const pots = buildAnimal('bear', { body: 0x6e5a44 });
      const toque = new THREE.Mesh(new THREE.CylinderGeometry(0.34, 0.3, 0.5, 9), mat(0xf5f2e9, 0.9));
      toque.position.y = 0.5;
      pots.userData.parts.head.add(toque);
      pots.position.set(B.x - 14.6, 0, B.z - 8.1);
      room.add(pots);
      let potsIdx = 0;
      const POTS_LINES = [
        'Pots. Cafeteria. The stew is rocket fuel. Legally distinct rocket fuel. Sit. Eat. Discover.',
        'Scientists forget to eat, so I bang the pot at noon. We don’t ring things here. Respect for the bell. The pot understands.',
        'The moon? I’m planning the first picnic. You can’t rush a picnic. You can rush soup. Different physics entirely.',
      ];
      register({
        getPos: () => pots.position,
        r: 2.6, zone: 'labs',
        label: 'talk to Pots',
        use: () => ui.say(POTS_LINES[potsIdx++ % POTS_LINES.length], { speaker: 'Pots', voice: 300 }),
      });
      const menuFrame = box(5.0, 2.25, 0.16, 0x6b4a2e);
      menuFrame.position.set(B.x - 14.6, 2.35, B.z - 11.72);
      menuFrame.receiveShadow = true;
      room.add(menuFrame);
      const menuCv = document.createElement('canvas');
      menuCv.width = 512; menuCv.height = 256;
      const menuCtx = menuCv.getContext('2d');
      menuCtx.fillStyle = '#2e3a32';
      menuCtx.fillRect(0, 0, 512, 256);
      menuCtx.strokeStyle = '#e8e0d0';
      menuCtx.lineWidth = 8;
      menuCtx.strokeRect(14, 14, 484, 228);
      menuCtx.textAlign = 'center';
      menuCtx.textBaseline = 'middle';
      for (const [text, y, px] of [
        ["POTS' CANTEEN ·", 45, 34],
        ['Coffee — free, always ·', 96, 26],
        ['Bolt Soup — 6 ·', 137, 25],
        ['Gear Loaf — 8 ·', 178, 25],
        ['(Tuesday: also Gear Loaf)', 218, 21],
      ]) {
        menuCtx.font = `800 ${px}px ui-rounded, "Segoe UI", system-ui, sans-serif`;
        menuCtx.fillStyle = y === 45 ? '#f2cf5b' : '#f5f2e9';
        menuCtx.fillText(text, 256, y);
      }
      const menuTex = new THREE.CanvasTexture(menuCv);
      menuTex.colorSpace = THREE.SRGBColorSpace;
      const menuPanel = new THREE.Mesh(new THREE.PlaneGeometry(4.55, 1.95),
        new THREE.MeshBasicMaterial({ map: menuTex }));
      menuPanel.position.set(B.x - 14.6, 2.35, B.z - 11.61);
      room.add(menuPanel);
      labUpdates.push((dt, t, playerPos) => {
        const dx = playerPos.x - pots.position.x, dz = playerPos.z - pots.position.z;
        if (Math.hypot(dx, dz) < 6) {
          pots.rotation.y = turnToward(pots.rotation.y, Math.atan2(dx, dz), dt, 4);
        }
        animateGait(pots, t, 0, 8);
      });
      // third shift, recharging
      const napper = buildAnimal('mole', { body: 0x5a4a44 });
      napper.position.set(B.x - 8.5, 0.35, B.z - 6.4);
      napper.rotation.y = Math.PI;
      napper.rotation.x = 0.85; // face gently down onto the table
      room.add(napper);
      register({
        pos: new THREE.Vector3(B.x - 8.5, 0, B.z - 5.8), r: 1.8, zone: 'labs',
        label: 'check on the engineer',
        use: () => ui.say('(Third shift. Recharging. There is a half-finished equation on the napkin and a whole nap on the engineer.)'),
      });
    }

    // ------------------------------------------ rocket division, SW ----
    {
      // the blackboard
      const bb = box(4.6, 2.2, 0.12, 0x2e3a32);
      bb.position.set(B.x - 17.5, 1.7, B.z + 8.5);
      bb.rotation.y = Math.PI / 2;
      room.add(bb);
      const cv = document.createElement('canvas');
      cv.width = 256; cv.height = 128;
      const ctx = cv.getContext('2d');
      ctx.fillStyle = '#2e3a32';
      ctx.fillRect(0, 0, 256, 128);
      ctx.strokeStyle = '#e8e0d0';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(70, 80, 28, 0, Math.PI * 2); // home
      ctx.stroke();
      ctx.beginPath();
      ctx.setLineDash([6, 5]);
      ctx.ellipse(130, 70, 90, 44, -0.3, 0, Math.PI * 1.65);
      ctx.stroke();
      ctx.setLineDash([]);
      ctx.beginPath();
      ctx.arc(208, 36, 12, 0, Math.PI * 2); // the moon
      ctx.stroke();
      ctx.font = '700 13px ui-rounded, "Segoe UI", system-ui, sans-serif';
      ctx.fillStyle = '#e8e0d0';
      ctx.fillText('HOME', 52, 122);
      ctx.fillText('UP?', 196, 18);
      const tex = new THREE.CanvasTexture(cv);
      tex.colorSpace = THREE.SRGBColorSpace;
      const chalk = new THREE.Mesh(new THREE.PlaneGeometry(4.3, 2.0),
        new THREE.MeshStandardMaterial({ map: tex, flatShading: true, roughness: 0.95 }));
      chalk.position.set(B.x - 17.42, 1.7, B.z + 8.5);
      chalk.rotation.y = Math.PI / 2;
      room.add(chalk);
      register({
        pos: new THREE.Vector3(B.x - 16.4, 0, B.z + 8.5), r: 2.2, zone: 'labs',
        label: 'study the blackboard',
        use: () => ui.say([
          'A chalk orbit, drawn and redrawn so many times the board has gone soft there. HOME, a long dotted curve, and a small circle labeled “UP?”',
          'In the corner, tally marks. Hundreds. A note: “attempts to stop thinking about it.” The tallies stop mid-stroke.',
        ]),
      });
      // blueprint table + model rocket
      const bp = box(2.8, 0.95, 1.6, 0xa97c50);
      bp.position.set(B.x - 12.8, 0.48, B.z + 8.6);
      room.add(bp);
      blockers.push({ x: B.x - 12.8, z: B.z + 8.6, r: 1.7 });
      const sheet = box(2.2, 0.04, 1.2, 0x2e3e6b);
      sheet.position.set(B.x - 12.8, 0.98, B.z + 8.6);
      room.add(sheet);
      const model = new THREE.Group();
      const mb = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.14, 0.6, 8), mat(0xf2efe4, 0.6));
      mb.position.y = 0.3;
      model.add(mb);
      const mn = new THREE.Mesh(new THREE.ConeGeometry(0.12, 0.25, 8), mat(0xd9534f, 0.6));
      mn.position.y = 0.72;
      model.add(mn);
      model.position.set(B.x - 12.2, 1.0, B.z + 8.3);
      room.add(model);
      // Dr. Hazel, trajectories (a mouse in goggles)
      const hazel = buildAnimal('mouse', { body: 0xb08a5a });
      for (const sx of [-1, 1]) {
        const lens = new THREE.Mesh(new THREE.TorusGeometry(0.09, 0.025, 6, 10), mat(0xc9962e, 0.4));
        lens.position.set(sx * 0.16, 0.18, 0.38);
        hazel.userData.parts.head.add(lens);
      }
      hazel.position.set(B.x - 13.5, 0, B.z + 6.6);
      room.add(hazel);
      let hazelIdx = 0;
      const HAZEL_LINES = [
        'Hazel. Trajectories. A launch is just a very committed throw, and I have committed.',
        'The moon passes overhead every night, very smug about it. We are preparing a response.',
        'Everything wants to come back down. The trick is asking it, nicely, to do that LATER.',
      ];
      register({
        getPos: () => hazel.position,
        r: 2.4, zone: 'labs',
        label: 'talk to Dr. Hazel',
        use: () => {
          if (S.hasFlag('rocketPowered')) {
            ui.say('The heart chamber is WARM. Did you— you DID. T-minus: a polite while. We launch when the moon is ready for company. I have started sleeping in the goggles.',
              { speaker: 'Dr. Hazel', voice: 700 });
            return;
          }
          ui.say(HAZEL_LINES[hazelIdx++ % HAZEL_LINES.length], { speaker: 'Dr. Hazel', voice: 700 });
        },
      });
      labUpdates.push((dt, t, playerPos) => {
        const dx = playerPos.x - hazel.position.x, dz = playerPos.z - hazel.position.z;
        if (Math.hypot(dx, dz) < 5) {
          hazel.rotation.y = turnToward(hazel.rotation.y, Math.atan2(dx, dz), dt, 5);
        }
        animateGait(hazel, t, 0.1, 7);
      });
    }

    room.traverse((o) => {
      if (solidShadowCaster(o)) o.castShadow = true;
    });
    group.add(room);

    zones.registerInterior('labs', {
      root: room,
      floorY: 0,
      bounds: { x0: B.x - W / 2 + 0.6, x1: B.x + W / 2 - 0.6, z0: B.z - D / 2 + 0.6, z1: B.z + D / 2 - 0.6 },
      blockers,
      spawn: { x: B.x, z: B.z + 10.6, rotY: Math.PI },
      lighting: {
        bg: 0xe6edf0, fog: 0xe6edf0, fogNear: 40, fogFar: 130,
        hemiSky: 0xffffff, hemiGround: 0x9aa6ad, hemiIntensity: 1.45,
        sunIntensity: 1.0,
      },
    });
    register({
      pos: new THREE.Vector3(B.x, 0, B.z + 11.4), r: 1.8, zone: 'labs',
      label: 'step outside',
      use: () => zones.leaveTo({ x: fx, z: fz + 5.2, rotY: 0 }),
    });
  }

  // ----------------------------------------------------- the launch ride ----
  // Tugboat-style: you ride the rocket up (player hidden — you're sealed inside),
  // the camera trails the climb as the island shrinks below, the existing
  // narration plays mid-ascent, then a fade cuts to the starry moon.
  const LAUNCH_NARRATION = [
    '“Notbell Control to rocket. Checklist page nine.” Doppler’s voice, extremely calm. Somewhere below, Pots bangs the pot.',
    'The hum becomes a shake. The shake becomes a HAND, pressing you gently into the seat. Through the porthole: the pad, the yard, the flag — smaller, smaller, a postage stamp of a country.',
    'The blue goes thin. The thin goes black. The Lightseed sings the whole way up — the same four notes the lighthouse used to keep — and the sea, for the first time in your life, is somewhere you are not.',
    'And below the window, all of it at once: every island the volcano ever made, laid out on the water like buttons on a coat.',
  ];
  function puffSmoke(n = 6) {
    for (let i = 0; i < n; i++) {
      const p = new THREE.Mesh(new THREE.IcosahedronGeometry(rand(0.4, 0.95), 0),
        new THREE.MeshStandardMaterial({ color: 0xd8d3c8, flatShading: true, roughness: 1, transparent: true, opacity: 0.85 }));
      const a = rand(0, Math.PI * 2), rad = rand(0.4, 2.6);
      p.position.set(P.x + Math.cos(a) * rad, P.h + 0.4 + rand(0, 0.6), P.z + Math.sin(a) * rad);
      p.userData.vel = { x: Math.cos(a) * rand(0.5, 1.5), y: rand(0.4, 1.0), z: Math.sin(a) * rand(0.5, 1.5) };
      group.add(p);
      smoke.push(p);
    }
  }
  function ageSmoke(dt) {
    for (let i = smoke.length - 1; i >= 0; i--) {
      const p = smoke[i];
      p.position.x += p.userData.vel.x * dt;
      p.position.y += p.userData.vel.y * dt;
      p.position.z += p.userData.vel.z * dt;
      p.scale.multiplyScalar(1 + dt * 0.8); // billow out
      p.material.opacity -= dt * 0.5;        // ~1.7s life
      if (p.material.opacity <= 0) {
        group.remove(p);
        p.geometry.dispose();
        p.material.dispose();
        smoke.splice(i, 1);
      }
    }
  }
  function liftoff() {
    tone(60, { dur: 1.6, type: 'sawtooth', vol: 0.07 });
    tone(48, { time: 0.8, dur: 2.2, type: 'sawtooth', vol: 0.08 });
    player.riding = true;          // the rocket flies; you sit tight (player.js honors riding)
    player.group.visible = false;  // sealed inside — we watch the rocket itself rise
    puffSmoke(8);
    launch = { t: 0, vy: 0, fired: false, phase: 'rise' };
  }
  function emitExhaust() {
    // the volcano's smoke, inverted: emitted at the engine, trailing DOWN as we climb
    const p = new THREE.Mesh(new THREE.IcosahedronGeometry(rand(0.35, 0.8), 0),
      new THREE.MeshStandardMaterial({ color: 0xd8d2cc, flatShading: true, roughness: 1, transparent: true, opacity: 0.75 }));
    p.position.set(rocket.position.x + rand(-0.3, 0.3), rocket.position.y + 0.3, rocket.position.z + rand(-0.3, 0.3));
    p.userData.vel = { x: rand(-0.6, 0.6), y: rand(-2.5, -1.0), z: rand(-0.6, 0.6) };
    group.add(p);
    smoke.push(p);
  }
  function advanceLaunch(dt, t) {
    const L = launch;
    if (L.phase === 'gone') return; // mid-fade; hold until zones.go lands us on the moon
    L.t += dt;
    L.vy = Math.min(L.vy + 9 * dt, 24);
    if (rocket.position.y > P.h + 85) L.vy *= 0.95; // ease into a hover near the top of the sky
    rocket.position.y += L.vy * dt;
    rocket.position.x = P.x + Math.sin(t * 46) * 0.06 * Math.max(0, 1 - L.t * 0.6); // ignition shimmy, fades
    player.group.position.set(rocket.position.x, rocket.position.y + 3, rocket.position.z); // camera trails this
    if (L.t < 1.1 && Math.sin(t * 28) > 0.9) puffSmoke(2); // kicked-up ground cloud at liftoff
    if (L.vy > 4) { // continuous exhaust plume while climbing
      L.emitT = (L.emitT || 0) - dt;
      while (L.emitT <= 0) { emitExhaust(); L.emitT += 0.06; }
    }
    // climb out of the sky → starry space (begins ~+28, full near apex ~+74)
    const k = Math.max(0, Math.min(1, (rocket.position.y - P.h - 28) / 46));
    setSpaceFade(k);
    setLaunchNight(k);
    if (!L.fired && L.t > 1.3) { L.fired = true; ui.say(LAUNCH_NARRATION); }
    if (L.fired && !ui.isBusy() && rocket.position.y > P.h + 72) {
      L.phase = 'gone';
      ui.fadeSwap(async () => {
        await zones.go('moon');
        rocket.position.set(P.x, P.h, P.z); // reset the pad for next time
        player.group.visible = true;
        player.riding = false;
        setSpaceFade(0);
        setLaunchNight(0);
        launch = null;
      });
      ui.toast('Contact light. The dust accepts you politely.', '🌑');
    }
  }

  // ============================================================ update ----
  function update(dt, t, playerPos) {
    if (smoke.length) ageSmoke(dt);                // liftoff puffs linger, then clear
    if (launch) { advanceLaunch(dt, t); return; }  // during the launch, nothing else matters
    const zone = zones.current();
    if (zone === 'island') {
      // only spend effort when the labs are anywhere near the frame
      if (Math.hypot(playerPos.x - ISLAND6.x, playerPos.z - ISLAND6.z) < ISLAND6.r + 130) {
        for (const u of updates) u(dt, t, playerPos);
        for (const w of walkers) {
          if (w.pause > 0) { w.pause -= dt; animateGait(w.g, t, 0, 8); continue; }
          const target = w.points[(w.seg + 1) % w.points.length];
          const dx = target.x - w.g.position.x, dz = target.z - w.g.position.z;
          const dist = Math.hypot(dx, dz);
          if (dist < 0.4) {
            w.seg = (w.seg + 1) % w.points.length;
            w.pause = rand(0.5, 2.5);
            continue;
          }
          w.g.rotation.y = turnToward(w.g.rotation.y, Math.atan2(dx, dz), dt, 5);
          w.g.position.x += (dx / dist) * w.speed * dt;
          w.g.position.z += (dz / dist) * w.speed * dt;
          w.g.position.y = w.fixedY ?? terrainHeight(w.g.position.x, w.g.position.z);
          animateGait(w.g, t, 1, 9);
        }
        // Scout patrols the pad apron, conscientiously
        if (scoutState.pauseT > 0) {
          scoutState.pauseT -= dt;
        } else {
          if (!scoutState.target) {
            const a = rand(0, Math.PI * 2);
            scoutState.target = { x: P.x + Math.cos(a) * rand(4.5, 7), z: P.z + Math.sin(a) * rand(4.5, 7) };
          }
          const dx = scoutState.target.x - scout.position.x, dz = scoutState.target.z - scout.position.z;
          const dist = Math.hypot(dx, dz);
          if (dist < 0.3) {
            scoutState.target = null;
            scoutState.pauseT = rand(1.5, 5);
          } else {
            scout.rotation.y = turnToward(scout.rotation.y, Math.atan2(dx, dz), dt, 3);
            scout.position.x += Math.sin(scout.rotation.y) * 0.85 * dt;
            scout.position.z += Math.cos(scout.rotation.y) * 0.85 * dt;
            scout.position.y = terrainHeight(scout.position.x, scout.position.z);
            for (const w of scout.userData.wheels) w.rotation.x += dt * 5;
          }
        }
      }
    } else if (zone === 'labs') {
      for (const u of labUpdates) u(dt, t, playerPos);
    }
  }

  return { group, update };
}

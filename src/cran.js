// The Isle of Cran — south-east of Notbell, over a footbridge from Grove
// Isle. A cranberry bog: dark moss, live oaks hung with Spanish moss, a
// creek that cuts the island in two (the turtles sit by it), the bog beds on
// the east bank — one flooded for the harvest, the berries floating — and a
// little village on the west: a gazebo in a ring of flower pots somebody
// arranges every morning, Bog Ink (tattoos; rock and roll), Low Tide Records,
// and the Cran Community Center (zumba, watercolor, Chocoholics Anonymous).
// On the east shore, under the biggest oak, a bench for looking at the sea.
//
// The villagers who live here (Barb, Ruth, Null, Mabel) are real villagers —
// animals.js / villagers.js / houses.js. This module is the place.
//
// Layout is in local (u, v) from ISLAND9: u east, v south.

import * as THREE from 'three';
import { ISLAND5, ISLAND9, CRAN_CREEK, CRAN_BEDS, WATER_Y, terrainHeight, cranCreekDist, cranBedAt } from './terrain.js';
import * as zones from './zones.js';
import { register } from './interact.js';
import * as ui from './ui.js';
import * as S from './state.js';
import { kaching, sip, tone, playSong } from './audio.js';
import { buildAnimal, animateGait } from './animals.js';
import { rand, turnToward } from './utils.js';
import { addIslandInfo, addZonePlace } from './fieldguide.js';
import { glowWindow } from './nightglow.js';
import { ITEMS } from './catalog.js';
import { makeWindow, makeHangingLamp } from './buildings.js';
import { mergeStatic } from './oasis.js';
import { hourNow } from './calendar.js';
import { waveAt } from './ocean.js';

function mat(color, rough = 0.9) {
  return new THREE.MeshStandardMaterial({ color, flatShading: true, roughness: rough });
}
function box(w, h, d, color) {
  const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat(color));
  m.castShadow = m.receiveShadow = true;
  return m;
}
function cyl(rt, rb, h, seg, color) {
  const m = new THREE.Mesh(new THREE.CylinderGeometry(rt, rb, h, seg), mat(color));
  m.castShadow = m.receiveShadow = true;
  return m;
}
function ball(r, color, detail = 0) {
  const m = new THREE.Mesh(new THREE.IcosahedronGeometry(r, detail), mat(color));
  m.castShadow = m.receiveShadow = true;
  return m;
}
function collectInteriorRoot(parent, startIndex) {
  const root = new THREE.Group();
  root.add(...parent.children.slice(startIndex));
  parent.add(root);
  return root;
}
function sign(lines, { w = 3.4, h = 0.8, d = 0.08, bg = '#f3ead6', fg = '#3a3026', border = null } = {}) {
  const cv = document.createElement('canvas');
  cv.width = 512;
  cv.height = Math.round(512 * (h / w));
  const ctx = cv.getContext('2d');
  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, cv.width, cv.height);
  if (border) {
    ctx.strokeStyle = border;
    ctx.lineWidth = cv.height * 0.07;
    ctx.strokeRect(ctx.lineWidth / 2, ctx.lineWidth / 2, cv.width - ctx.lineWidth, cv.height - ctx.lineWidth);
  }
  const L = Array.isArray(lines) ? lines : [lines];
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  const slot = cv.height / L.length;
  L.forEach((text, i) => {
    let size = Math.round(slot * (i === 0 ? 0.72 : 0.56));
    do {
      ctx.font = `bold ${size}px ui-rounded, 'Segoe UI', system-ui, sans-serif`;
      size -= 2;
    } while (ctx.measureText(text).width > cv.width * 0.9 && size > 10);
    ctx.fillStyle = fg;
    ctx.fillText(text, cv.width / 2, slot * i + slot * 0.54);
  });
  const tex = new THREE.CanvasTexture(cv);
  tex.colorSpace = THREE.SRGBColorSpace;
  const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), new THREE.MeshStandardMaterial({ map: tex, flatShading: true, roughness: 0.85 }));
  m.castShadow = m.receiveShadow = true;
  return m;
}

// ------------------------------------------------------------ the plan ----
const C = ISLAND9;
const W = (u, v) => ({ x: C.x + u, z: C.z + v });
const gy = (u, v) => terrainHeight(C.x + u, C.z + v);

// buildings (and what they face): the Community Center across the top of
// the green, Low Tide Records and Bog Ink on its west side, facing in
const CC = { u: -7, v: -14, w: 9, d: 6, ry: 0 };
const REC = { u: -19, v: -5, w: 5, d: 5, ry: Math.PI / 2 };
const INK = { u: -17, v: 7, w: 5, d: 4.5, ry: Math.PI / 2 };
const GAZ = { u: -8, v: 0, r: 2.4 };
const OAK = { u: 22, v: -3 };          // the big one, on the east shore
const BENCH = { u: 22.6, v: 1.2, ry: Math.PI / 2 }; // facing the sea (east)
// the creek's footbridges (planks across, u from..to at v)
const CREEK_BRIDGES = [{ v: -5, u0: 2.4, u1: 8.6 }, { v: 11, u0: 5.6, u1: 11.8 }]; // (the second ends short of the south bed's vines)

// interiors, off in the elsewhere (the x = -300 column, past Oasis Estates)
const IN = {
  cran_ink: { x: -300, z: 1600 },
  cran_records: { x: -300, z: 1680 },
  cran_cc: { x: -300, z: 1760 },
};

// ---- the footbridge from Grove Isle, found from the shores themselves ----
function shoreFrom(fx, fz, tx, tz) {
  const dx = tx - fx, dz = tz - fz, L = Math.hypot(dx, dz), ux = dx / L, uz = dz / L;
  let t = 0;
  while (t < L && terrainHeight(fx + ux * t, fz + uz * t) > 0.3) t += 0.25;
  return { x: fx + ux * t, z: fz + uz * t, ux, uz };
}
const GS = shoreFrom(ISLAND5.x, ISLAND5.z, C.x, C.z); // where Grove's grass gives out
const CS = shoreFrom(C.x, C.z, ISLAND5.x, ISLAND5.z); // where Cran's does
export const CRAN_BRIDGE = {
  a: { x: GS.x - GS.ux * 1.5, z: GS.z - GS.uz * 1.5 }, // (a step back onto each shore)
  b: { x: CS.x - CS.ux * 1.5, z: CS.z - CS.uz * 1.5 },
  w: 1.8,
};

// ---- reservations, made at module load so the house-planner (houses.js,
// which runs long before createCran) leaves room for the village --------
for (const [u, v, r] of [
  [CC.u, CC.v, 5.5], [REC.u, REC.v, 4], [INK.u, INK.v, 3.9], [GAZ.u, GAZ.v, 4.8], [OAK.u, OAK.v + 1.5, 3.4],
]) {
  const p = W(u, v);
  zones.addKeepout(p.x, p.z, r);
}
for (let i = 0; i < CRAN_CREEK.length - 1; i++) {
  const [a0, b0] = CRAN_CREEK[i], [a1, b1] = CRAN_CREEK[i + 1];
  const n = Math.ceil(Math.hypot(a1 - a0, b1 - b0) / 1.6);
  for (let k = 0; k <= n; k++) {
    const p = W(a0 + ((a1 - a0) * k) / n, b0 + ((b1 - b0) * k) / n);
    zones.addKeepout(p.x, p.z, 3.4); // no house hangs its porch over the creek
  }
}
{
  // the walk in from the footbridge to the green stays open
  const a = CRAN_BRIDGE.b, g = W(GAZ.u, GAZ.v);
  const n = Math.ceil(Math.hypot(g.x - a.x, g.z - a.z) / 2);
  for (let k = 0; k <= n; k++) zones.addKeepout(a.x + ((g.x - a.x) * k) / n, a.z + ((g.z - a.z) * k) / n, 2.2);
}
// and villagers know the way across
zones.addLink({
  a: 'grove', b: 'cran', kind: 'walk',
  path: [
    { x: GS.x - GS.ux * 4, z: GS.z - GS.uz * 4 }, CRAN_BRIDGE.a, CRAN_BRIDGE.b,
    { x: CS.x - CS.ux * 4, z: CS.z - CS.uz * 4 },
  ],
});

const VOICE = { spike: 220, sloane: 160, lily: 620, dabble: 420, coco: 520 };
const said = {};
function nextLine(key, lines) {
  const i = said[key] ?? 0;
  said[key] = (i + 1) % lines.length;
  return lines[i];
}

const SPIKE = [
  'Welcome to Bog Ink. Tattoos, and rock and roll. Mostly rock and roll. The tattoos are how I pay for the rock and roll.',
  'Rock and roll never dies. It just gets a real good tattoo and moves to a bog.',
  'I did Barb’s. “RUTH,” in a heart, on the shell. Took four hours. She didn’t flinch once. She did cry. Different thing.',
  'The mohawk? Grows like that. I just point it.',
  'People ask if it hurts. Everything hurts. That’s how you know it’s real. Also, it doesn’t hurt much. I’m very gentle. Don’t tell anybody.',
];
const SLOANE = [
  'Welcome… to… Low… Tide. … Take your time. I’m going to.',
  'Every record in here is on sale. The sale started in the spring. Of which year… is a good question.',
  'The listening booth is free. Put on anything. I’ll hear it from here. I hear everything. Slowly.',
  'Vinyl sounds warmer. So do I. We’re both… taking the scenic route.',
];
const LILY = [
  'AND a one, AND a two — oh! A new face! Grab a spot! Anywhere! Barb stands in the back and doesn’t do the arms. That’s valid!',
  'Zumba is joy with a beat. Also cardio. Mostly joy. The cardio sneaks in.',
  'The goose is banned from the front row. She knows why. We ALL know why.',
];
const DABBLE = [
  'Watercolor is just water, with opinions. Let it go where it wants. Then say you meant it.',
  'Ruth paints the bog every week. It comes out a pink smudge. It is the most accurate painting in the room.',
  'There are no mistakes in watercolor. There are only happy puddles.',
];
const CHOC = [
  [['Coco', 'Welcome back, everyone. Who’d like to share?'], ['a mouse', 'Hi. I’m Pim. It’s been three days since my last truffle.'], ['everyone', 'Hi, Pim.'], ['Coco', 'Thank you, Pim. Three days is three days.']],
  [['a bear', 'I walked past the fudge place today.'], ['Coco', 'And?'], ['a bear', 'I walked past it three times.'], ['Coco', 'That’s still past, Hubert. That counts.']],
  [['a hamster', 'I found a chocolate coin in my cheek. I don’t know how long it had been there.'], ['Coco', 'We don’t judge the cheek.'], ['everyone', 'We don’t judge the cheek.']],
  [['Coco', 'Ruth brought brownies again.'], ['a mouse', 'For who?'], ['Coco', '…For support.'], ['a bear', 'I feel very supported.']],
];

export function createCran(player) {
  const group = new THREE.Group();
  const outdoor = [];
  const inside = {};
  function put(obj, u, v, y = 0, ry = 0) {
    const p = W(u, v);
    obj.position.set(p.x, gy(u, v) + y, p.z);
    obj.rotation.y = ry;
    group.add(obj);
    return obj;
  }
  function solidBox(u, v, w, d, ry = 0, kind) {
    const p = W(u, v);
    zones.addBlockerBox(p.x, p.z, w, d, ry, 0, kind);
  }
  function solidDisc(u, v, r, kind) {
    const p = W(u, v);
    zones.addBlocker(p.x, p.z, r, kind);
  }
  // is there room here (houses already stand; they went up before us)?
  function roomAt(u, v, r) {
    const p = W(u, v);
    return !zones.nearAnything(p.x, p.z, r) && gy(u, v) > 0.5 && cranCreekDist(p.x, p.z) > 2.6 && !cranBedAt(p.x, p.z, 0.3);
  }
  function local(u, v, ry, lx, lz) {
    const c = Math.cos(ry), s = Math.sin(ry);
    return [u + lx * c + lz * s, v - lx * s + lz * c];
  }

  addIslandInfo({
    key: 'cran',
    name: 'Isle of Cran', x: C.x, z: C.z, r: 30, icon: '🍒',
    blurb: 'A cranberry bog over a footbridge from Grove Isle. A creek, the turtles who sit by it, Spanish moss, a gazebo in a ring of flower pots, Bog Ink, Low Tide Records, and the Community Center (zumba, watercolor, Chocoholics Anonymous).',
    folk: 'Barb (snapping turtle) · Ruth (box turtle) · Null (a black cat; a hacker) · Mabel (a goose) · Spike · Sloane · Coach Lily · Miss Dabble · Coco',
    mystery: '“East of the orchards there’s a red island. Red in the water, I mean — the whole bay goes red in the autumn and then some fool goose honks at you.” —Captain Brine',
  });

  // ============================================== the Grove footbridge ----
  {
    const A = CRAN_BRIDGE.a, B = CRAN_BRIDGE.b;
    const dx = B.x - A.x, dz = B.z - A.z, L = Math.hypot(dx, dz), ry = Math.atan2(dx, dz);
    // meets each shore at the shore's own height (no step up onto the first plank), with a gentle hump over the water
    const hA = Math.max(terrainHeight(A.x, A.z), 0.2) + 0.05, hB = Math.max(terrainHeight(B.x, B.z), 0.2) + 0.05;
    const deckAt = (t) => hA + (hB - hA) * t + Math.sin(Math.PI * t) * 0.7;
    const n = Math.ceil(L / 0.5);
    for (let k = 0; k < n; k++) {
      const t = (k + 0.5) / n;
      const x = A.x + dx * t, z = A.z + dz * t;
      const plank = box(CRAN_BRIDGE.w, 0.1, (L / n) * 0.9, k % 2 ? 0x9a7a52 : 0x8a6a48);
      plank.position.set(x, Math.max(deckAt(t), terrainHeight(x, z) + 0.05), z);
      plank.rotation.y = ry;
      plank.rotation.x = -Math.cos(Math.PI * t) * 0.12;
      group.add(plank);
    }
    for (let k = 0; k <= Math.ceil(L / 2.5); k++) {
      const t = k / Math.ceil(L / 2.5);
      for (const side of [-1, 1]) {
        const x = A.x + dx * t + Math.cos(ry) * side * (CRAN_BRIDGE.w / 2 + 0.05), z = A.z + dz * t - Math.sin(ry) * side * (CRAN_BRIDGE.w / 2 + 0.05);
        const top = deckAt(t) + 0.95;
        const post = cyl(0.07, 0.08, top - WATER_Y + 1, 6, 0x6e5a44);
        post.position.set(x, (top + WATER_Y - 1) / 2, z);
        group.add(post);
      }
    }
    for (const side of [-1, 1]) {
      for (let k = 0; k < 8; k++) {
        const t0 = k / 8, t1 = (k + 1) / 8, tm = (t0 + t1) / 2;
        const rail = box(0.08, 0.08, L / 8 + 0.05, 0x7a6048);
        rail.position.set(A.x + dx * tm + Math.cos(ry) * side * (CRAN_BRIDGE.w / 2 + 0.05), deckAt(tm) + 0.9, A.z + dz * tm - Math.sin(ry) * side * (CRAN_BRIDGE.w / 2 + 0.05));
        rail.rotation.y = ry;
        rail.rotation.x = -Math.cos(Math.PI * tm) * 0.12;
        group.add(rail);
      }
    }
    const c = Math.cos(ry), s = Math.sin(ry);
    const proj = (x, z) => { const rx = x - A.x, rz = z - A.z; return { along: (rx * dx + rz * dz) / L, across: rx * c - rz * s }; };
    zones.addCrossing({
      contains: (x, z) => { const p = proj(x, z); return p.along >= -0.3 && p.along <= L + 0.3 && Math.abs(p.across) <= CRAN_BRIDGE.w / 2 - 0.12; },
      height: (x, z) => { const t = Math.max(0, Math.min(1, proj(x, z).along / L)); return Math.max(deckAt(t) + 0.05, terrainHeight(x, z)); },
    });
    zones.addSeaWall({
      contains: (x, z) => { const p = proj(x, z); return p.along >= 0 && p.along <= L && Math.abs(p.across) <= CRAN_BRIDGE.w / 2 + 0.4; },
    });
    // the welcome sign at the Cran end
    const sp = { x: B.x - CS.ux * 1.2 + Math.cos(ry) * 1.8, z: B.z - CS.uz * 1.2 - Math.sin(ry) * 1.8 };
    const sg = sign(['ISLE OF CRAN', 'pop. 4 · the turtles count twice'], { w: 2.4, h: 0.8, bg: '#8c3a3f', fg: '#f3ead6' });
    sg.position.set(sp.x, terrainHeight(sp.x, sp.z) + 1.5, sp.z);
    sg.rotation.y = ry + Math.PI;
    group.add(sg);
    for (const off of [-1.0, 1.0]) {
      const post = cyl(0.06, 0.06, 1.3, 5, 0x6e5a44);
      post.position.set(sp.x + Math.cos(ry) * off, terrainHeight(sp.x, sp.z) + 0.65, sp.z - Math.sin(ry) * off);
      group.add(post);
    }
    zones.addBlockerBox(sp.x, sp.z, 2.4, 0.3, ry);
  }

  // ======================================================== the creek ----
  // its footbridges, and a steady procession of runaway cranberries drifting
  // down it to the sea (that's how you can tell which way it flows)
  for (const cb of CREEK_BRIDGES) {
    const L = cb.u1 - cb.u0, mid = (cb.u0 + cb.u1) / 2;
    const e0 = W(cb.u0, cb.v), e1 = W(cb.u1, cb.v);
    const hA = Math.max(terrainHeight(e0.x, e0.z), 0.2) + 0.05, hB = Math.max(terrainHeight(e1.x, e1.z), 0.2) + 0.05;
    const deck = (u) => { const t = Math.max(0, Math.min(1, (u - cb.u0) / L)); return hA + (hB - hA) * t + Math.sin(t * Math.PI) * 0.45; }; // (flush with each bank)
    for (let k = 0; k < 10; k++) {
      const u = cb.u0 + (L * (k + 0.5)) / 10;
      const plank = box(L / 10 * 0.92, 0.1, 1.6, 0x8a6a48);
      const p = W(u, cb.v);
      plank.position.set(p.x, deck(u), p.z);
      plank.rotation.z = -Math.cos(((u - cb.u0) / L) * Math.PI) * 0.18;
      group.add(plank);
    }
    for (const sv of [-0.85, 0.85]) {
      const rail = box(L, 0.07, 0.07, 0x7a6048);
      const p = W(mid, cb.v + sv);
      rail.position.set(p.x, 1.95, p.z);
      group.add(rail);
      for (const u of [cb.u0 + 0.2, mid, cb.u1 - 0.2]) {
        const post = cyl(0.05, 0.05, 1.3, 5, 0x6e5a44);
        const q = W(u, cb.v + sv);
        post.position.set(q.x, deck(u) + 0.45, q.z);
        group.add(post);
      }
    }
    const p0 = W(cb.u0 - 0.3, cb.v - 0.72), p1 = W(cb.u1 + 0.3, cb.v + 0.72);
    zones.addCrossing({
      contains: (x, z) => x >= p0.x && x <= p1.x && z >= p0.z && z <= p1.z,
      height: (x) => Math.max(deck(x - C.x) + 0.05, terrainHeight(x, W(0, cb.v).z)),
    });
    zones.addSeaWall({ contains: (x, z) => x >= p0.x && x <= p1.x && z >= p0.z - 0.2 && z <= p1.z + 0.2 });
  }
  {
    // the drifting berries: a few dozen, recycled from source to sea
    const pts = CRAN_CREEK.map(([u, v]) => W(u, v));
    const segL = pts.slice(1).map((p, i) => Math.hypot(p.x - pts[i].x, p.z - pts[i].z));
    const total = segL.reduce((a, b) => a + b, 0);
    const along = (d) => {
      let i = 0;
      while (i < segL.length - 1 && d > segL[i]) { d -= segL[i]; i++; }
      const t = Math.min(1, d / segL[i]);
      return { x: pts[i].x + (pts[i + 1].x - pts[i].x) * t, z: pts[i].z + (pts[i + 1].z - pts[i].z) * t };
    };
    const berryGeo = new THREE.IcosahedronGeometry(0.1, 0);
    const berries = new THREE.InstancedMesh(berryGeo, mat(0xb3202c, 0.6), 40);
    group.add(berries);
    const tmp = new THREE.Object3D();
    const seeds = Array.from({ length: 40 }, (_, k) => ({ off: (k / 40) * total, side: ((k * 37) % 11) / 11 - 0.5 }));
    outdoor.push((dt, t) => {
      for (let k = 0; k < seeds.length; k++) {
        const d = (seeds[k].off + t * 0.6) % total;
        const p = along(d);
        const bx = p.x + seeds[k].side * 1.2, bz = p.z + seeds[k].side * 0.6;
        tmp.position.set(bx, WATER_Y + Math.max(0, waveAt(bx, bz, t)) + 0.07, bz); // riding the rendered swell, never under it
        tmp.updateMatrix();
        berries.setMatrixAt(k, tmp.matrix);
      }
      berries.instanceMatrix.needsUpdate = true;
    });
    // lily pads, here and there, keeping still on principle
    const pads = [];
    for (let k = 0; k < 14; k++) {
      const p = along((k / 14) * total + 3);
      const pad = new THREE.Mesh(new THREE.CylinderGeometry(0.35, 0.35, 0.03, 7), mat(0x4a8a3a));
      pad.position.set(p.x + ((k * 13) % 7) / 7 - 0.5, WATER_Y + 0.22, p.z + ((k * 5) % 7) / 7 - 0.5);
      pad.userData.dynamic = true;
      group.add(pad);
      pads.push(pad);
    }
    outdoor.push((dt, t) => { for (const pad of pads) pad.position.y = WATER_Y + Math.max(0, waveAt(pad.position.x, pad.position.z, t)) + 0.03; });
    // the good rock, by the creek, where the turtles sit
    const rock = ball(0.9, 0x7a7468);
    rock.scale.set(1.4, 0.35, 1.1);
    put(rock, 1.2, 3.0, 0.05);
    register({
      pos: new THREE.Vector3(W(1.2, 3).x, 0, W(1.2, 3).z), r: 1.8,
      label: 'sit on the good rock',
      use: () => ui.say([
        'You sit on the good rock. It is flat, and warm, and exactly the size of one turtle, or two turtles who don’t mind.',
        'The creek goes by. A cranberry goes by on it, then another. You are, for a moment, extremely in no hurry.',
      ]),
    });
  }

  // ====================================================== the bog beds ----
  {
    const vineGeo = new THREE.IcosahedronGeometry(0.28, 0);
    const berryGeo = new THREE.IcosahedronGeometry(0.07, 0);
    const vineMat = mat(0x3d5a2e), berryMat = mat(0xc22a36, 0.5);
    const tmp = new THREE.Object3D();
    for (const bed of CRAN_BEDS) {
      if (bed.flooded) continue;
      const nu = Math.floor((bed.u1 - bed.u0) / 0.8), nv = Math.floor((bed.v1 - bed.v0) / 0.8);
      const vines = new THREE.InstancedMesh(vineGeo, vineMat, nu * nv);
      const berries = new THREE.InstancedMesh(berryGeo, berryMat, nu * nv * 3);
      let vi = 0, bi = 0;
      for (let i = 0; i < nu; i++) {
        for (let j = 0; j < nv; j++) {
          const u = bed.u0 + 0.4 + i * 0.8 + ((i * 7 + j * 3) % 5) * 0.06, v = bed.v0 + 0.4 + j * 0.8 + ((i * 3 + j * 11) % 5) * 0.06;
          const y = gy(u, v);
          const p = W(u, v);
          tmp.position.set(p.x, y + 0.08, p.z);
          tmp.scale.set(1.2, 0.35, 1.2);
          tmp.rotation.set(0, (i * 13 + j * 7) % 6, 0);
          tmp.updateMatrix();
          vines.setMatrixAt(vi++, tmp.matrix);
          for (let q = 0; q < 3; q++) {
            tmp.position.set(p.x + Math.cos(q * 2.1 + i) * 0.22, y + 0.2, p.z + Math.sin(q * 2.1 + j) * 0.22);
            tmp.scale.set(1, 1, 1);
            tmp.updateMatrix();
            berries.setMatrixAt(bi++, tmp.matrix);
          }
        }
      }
      vines.receiveShadow = true;
      berries.castShadow = false; // (the vines' shadow is plenty)
      group.add(vines, berries);
    }
    // the flooded bed: the harvest. berries, floating, all the way to the edges;
    // a yellow boom to herd them; a flat-bottomed boat, tied up
    const fb = CRAN_BEDS.find((b) => b.flooded);
    const nu = Math.floor((fb.u1 - fb.u0) / 0.35), nv = Math.floor((fb.v1 - fb.v0) / 0.35);
    const floaters = new THREE.InstancedMesh(new THREE.IcosahedronGeometry(0.12, 0), mat(0xd02a3a, 0.45), nu * nv);
    let fi = 0;
    for (let i = 0; i < nu; i++) {
      for (let j = 0; j < nv; j++) {
        const p = W(fb.u0 + 0.2 + i * 0.35 + ((i + j) % 3) * 0.05, fb.v0 + 0.2 + j * 0.35 + ((i * 2 + j) % 3) * 0.05);
        tmp.position.set(p.x, WATER_Y + 0.28, p.z); // (up on top of the rendered waves)
        tmp.scale.set(1, 0.8, 1);
        tmp.updateMatrix();
        floaters.setMatrixAt(fi++, tmp.matrix);
      }
    }
    group.add(floaters);
    outdoor.push((dt, t) => { floaters.position.y = Math.sin(t * 0.9) * 0.03; });
    const boom = new THREE.Mesh(new THREE.TorusGeometry(1, 0.12, 5, 16, Math.PI), mat(0xf2cf5b, 0.5));
    boom.rotation.x = -Math.PI / 2;
    boom.scale.set(3.5, 2.4, 1);
    const bp = W((fb.u0 + fb.u1) / 2, fb.v1 - 1.2);
    boom.position.set(bp.x, WATER_Y + 0.26, bp.z);
    group.add(boom);
    const skiff = new THREE.Group();
    const hull = box(1.2, 0.35, 2.6, 0x6e5a44);
    hull.position.y = 0.1;
    const seat = box(1.1, 0.08, 0.3, 0x8a6a48);
    seat.position.y = 0.3;
    skiff.add(hull, seat);
    const skp = W(fb.u0 + 2.6, fb.v0 + 2.6);
    skiff.position.set(skp.x, WATER_Y + 0.22, skp.z);
    skiff.rotation.y = 0.3;
    group.add(skiff);
    const hs = sign(['HARVEST IN PROGRESS', 'please do not swim in the product'], { w: 2.4, h: 0.7, bg: '#f3ead6', fg: '#8c3a3f' });
    put(hs, fb.u0 - 1.0, fb.v1 + 0.4, 1.2, 0);
    put(cyl(0.06, 0.06, 1.2, 5, 0x6e5a44), fb.u0 - 1.0, fb.v1 + 0.4, 0.3);
    solidBox(fb.u0 - 1.0, fb.v1 + 0.4, 2.4, 0.3);
    register({
      pos: new THREE.Vector3(W(fb.u0 - 1, fb.v1 + 1).x, 0, W(fb.u0 - 1, fb.v1 + 1).z), r: 1.8,
      label: 'look at the flooded bog',
      use: () => ui.say([
        'The bed has been flooded to the brim and every berry has let go of its vine and come up to the top: a whole square of red, floating, packed edge to edge, bobbing very slightly all together.',
        'Cranberries float because each one has four little pockets of air inside. Barb says that’s the whole secret. She says it about a lot of things.',
      ]),
    });
    register({
      pos: new THREE.Vector3(W(12, -12).x, 0, W(12, -12).z), r: 2.4, priority: 0,
      label: 'walk through the cranberries',
      use: () => ui.say('The vines are low and springy and wet underfoot, and the berries tick against your ankles as you go. It smells like rain and something sharp and sweet. You try not to step on any. You step on several. They forgive you.'),
    });
  }

  // =========================================== live oaks & Spanish moss ----
  const MOSS = [0x8a9a86, 0x9aa894, 0x7c8c78];
  function oak(u, v, s = 1, lean = 0.2) {
    const g = new THREE.Group();
    const trunk = cyl(0.28 * s, 0.42 * s, 2.2 * s, 7, 0x5a4a3a);
    trunk.position.y = 1.1 * s;
    trunk.rotation.z = lean * 0.3;
    g.add(trunk);
    const crowns = [];
    for (const [cx, cy, cz, cr] of [[0, 2.7, 0, 1.6], [1.4, 2.4, 0.5, 1.2], [-1.3, 2.5, -0.4, 1.25], [0.3, 2.5, -1.3, 1.1], [-0.2, 2.6, 1.3, 1.1]]) {
      const cm = ball(cr * s, 0x3a5a32, 1);
      cm.scale.y = 0.55;
      cm.position.set(cx * s, cy * s, cz * s);
      g.add(cm);
      crowns.push(cm);
      // limbs out to the side crowns
      if (cx || cz) {
        const limb = cyl(0.1 * s, 0.16 * s, Math.hypot(cx, cz) * s, 5, 0x5a4a3a);
        limb.position.set((cx / 2) * s, (cy - 0.5) * s, (cz / 2) * s);
        limb.rotation.z = Math.atan2(-cx, 1.2) * 0.9;
        limb.rotation.x = Math.atan2(cz, 1.2) * 0.9;
        g.add(limb);
      }
    }
    // the moss: long grey-green drapes hanging from under the crowns
    let k = 0;
    for (const cm of crowns) {
      for (let q = 0; q < 5; q++) {
        const a = q * 1.26 + k;
        const len = (0.8 + ((q * 7 + k) % 5) * 0.2) * s;
        const drape = new THREE.Mesh(new THREE.ConeGeometry(0.1 * s, len, 4), mat(MOSS[(q + k) % 3], 1));
        drape.rotation.x = Math.PI; // point down
        drape.position.set(cm.position.x + Math.cos(a) * 0.9 * s, cm.position.y - 0.3 * s - len / 2, cm.position.z + Math.sin(a) * 0.9 * s);
        drape.castShadow = true;
        g.add(drape);
      }
      k++;
    }
    put(g, u, v, -0.05, (u * 7 + v * 3) % 6);
    solidDisc(u, v, 0.45 * s, 'tree');
    return g;
  }
  oak(OAK.u, OAK.v, 1.35, 0.5); // the bench oak
  for (const [u, v, s] of [[-19, -13, 1.0], [-12, -21, 0.9], [-2, -20, 1.1], [-21, 0, 0.85], [-9, 18, 1.0], [15, 17, 0.95], [18, -15, 0.9], [-14, 12, 0.8], [8, 21, 0.9], [-3, 10, 0.75]]) {
    if (roomAt(u, v, 1.4 + 1.3 * s)) oak(u, v, s); // (room for the crown and the moss, not just the trunk)
  }

  // ------------------------------------------------ moss & ferns underfoot
  for (let k = 0; k < 40; k++) {
    const u = -22 + ((k * 37) % 44), v = -22 + ((k * 53) % 44);
    if (Math.hypot(u, v) > 22 || !roomAt(u, v, 0.6)) continue;
    const m = ball(0.3 + (k % 4) * 0.1, k % 3 ? 0x355a2f : 0x2f5028, 0);
    m.scale.y = 0.35;
    put(m, u, v, 0.02, k);
    if (k % 3 === 0) {
      for (let f = 0; f < 4; f++) {
        const frond = new THREE.Mesh(new THREE.ConeGeometry(0.08, 0.6, 3), mat(0x4a7a3a));
        frond.rotation.z = 0.7;
        frond.rotation.y = f * 1.57;
        put(frond, u + Math.cos(f * 1.57) * 0.2, v + Math.sin(f * 1.57) * 0.2, 0.25, f * 1.57);
      }
    }
  }

  // ===================================================== the gazebo ----
  {
    const g = new THREE.Group();
    const floor = cyl(GAZ.r, GAZ.r + 0.1, 0.3, 8, 0xf3ead6);
    floor.position.y = 0.15;
    g.add(floor);
    for (let k = 0; k < 8; k++) {
      const a = (k / 8) * Math.PI * 2 + Math.PI / 8;
      const post = cyl(0.08, 0.08, 2.4, 6, 0xffffff);
      post.position.set(Math.cos(a) * (GAZ.r - 0.2), 1.5, Math.sin(a) * (GAZ.r - 0.2));
      g.add(post);
      if (k !== 2) {
        // railings between the posts, all but the way in
        const a2 = ((k + 1) / 8) * Math.PI * 2 + Math.PI / 8;
        const mx = (Math.cos(a) + Math.cos(a2)) / 2 * (GAZ.r - 0.2), mz = (Math.sin(a) + Math.sin(a2)) / 2 * (GAZ.r - 0.2);
        const rail = box(0.06, 0.06, 1.85, 0xffffff);
        rail.position.set(mx, 0.95, mz);
        rail.rotation.y = -(a + a2) / 2;
        g.add(rail);
      }
    }
    const roof = new THREE.Mesh(new THREE.ConeGeometry(GAZ.r + 0.5, 1.3, 8), mat(0x8c3a3f));
    roof.position.y = 3.35;
    roof.rotation.y = Math.PI / 8;
    roof.castShadow = true;
    g.add(roof);
    const cupola = cyl(0.3, 0.3, 0.4, 8, 0xffffff);
    cupola.position.y = 4.1;
    const finial = ball(0.12, 0xd9a440);
    finial.position.y = 4.4;
    g.add(cupola, finial);
    // no bell in the cupola. (there never was. it's a gazebo.)
    g.traverse((o) => { if (o.isMesh) o.castShadow = o.receiveShadow = true; });
    put(g, GAZ.u, GAZ.v, 0);
    const p = W(GAZ.u, GAZ.v);
    zones.addSurfaceDisc(p.x, p.z, GAZ.r, gy(GAZ.u, GAZ.v) + 0.3);
    for (let k = 0; k < 8; k++) {
      const a = (k / 8) * Math.PI * 2 + Math.PI / 8;
      solidDisc(GAZ.u + Math.cos(a) * (GAZ.r - 0.2), GAZ.v + Math.sin(a) * (GAZ.r - 0.2), 0.14);
      if (k !== 2) {
        const a2 = ((k + 1) / 8) * Math.PI * 2 + Math.PI / 8;
        const mx = (Math.cos(a) + Math.cos(a2)) / 2 * (GAZ.r - 0.2), mz = (Math.sin(a) + Math.sin(a2)) / 2 * (GAZ.r - 0.2);
        solidBox(GAZ.u + mx, GAZ.v + mz, 0.2, 1.85, -(a + a2) / 2);
      }
    }
    register({
      pos: new THREE.Vector3(p.x, 0, p.z), r: 1.6,
      label: 'stand in the gazebo',
      use: () => ui.say(nextLine('gazebo', [
        'You stand in the middle of the gazebo. It is exactly as nice as a gazebo is supposed to be, which is very. The flower pots look back at you from every side.',
        'Up in the cupola, where a lesser gazebo would hang a bell: nothing. Just the little white roof, and the sky through the slats. Nobody on Cran has ever thought that was a question.',
        'Somebody has left a watercolor on the railing to dry. It’s the bog. It’s a pink smudge. It is extremely accurate.',
      ])),
    });
  }

  // ============================================ the flower pots ----
  // Terracotta, in tiers, in rings: someone arranges them every morning (the
  // community center's Tuesday group, and on the other days, just someone).
  const BLOOMS = [0xf28fb0, 0xffffff, 0xb89ad8, 0xf2cf5b, 0xe8573f, 0xfad0dc];
  function pot(u, v, s = 1, y = 0, k = 0) {
    const g = new THREE.Group();
    const body = cyl(0.26 * s, 0.19 * s, 0.4 * s, 8, 0xc4683a);
    body.position.y = 0.2 * s;
    const lip = cyl(0.3 * s, 0.3 * s, 0.08 * s, 8, 0xd07848);
    lip.position.y = 0.42 * s;
    g.add(body, lip);
    const leaves = ball(0.26 * s, 0x4a8a3a, 1);
    leaves.scale.y = 0.6;
    leaves.position.y = 0.52 * s;
    g.add(leaves);
    for (let q = 0; q < 4; q++) {
      const b = ball(0.09 * s, BLOOMS[(k + q) % BLOOMS.length]);
      b.position.set(Math.cos(q * 1.6 + k) * 0.17 * s, 0.62 * s, Math.sin(q * 1.6 + k) * 0.17 * s);
      g.add(b);
    }
    if (k % 3 === 0) {
      // a trailing one, spilling over the side
      for (let q = 0; q < 3; q++) {
        const tr = ball(0.07 * s, 0x5a9a4a);
        tr.position.set(0.26 * s, (0.35 - q * 0.12) * s, 0.05 * q);
        g.add(tr);
      }
    }
    g.traverse((o) => { if (o.isMesh) o.castShadow = o.receiveShadow = true; });
    put(g, u, v, y);
    return g;
  }
  {
    // a ring of tiered stands around the gazebo, gaps at the paths
    for (let k = 0; k < 12; k++) {
      const a = (k / 12) * Math.PI * 2;
      if (k === 1 || k === 7 || k === 10) continue; // the ways in and out
      const u = GAZ.u + Math.cos(a) * 4.0, v = GAZ.v + Math.sin(a) * 4.0;
      const stand = box(0.9, 0.35, 0.5, 0x8a6a48);
      put(stand, u, v, 0.17, -a);
      pot(u, v, 1.15, 0.35, k);
      pot(u + Math.cos(a + 1.57) * 0.55, v + Math.sin(a + 1.57) * 0.55, 0.8, 0, k + 1);
      pot(u - Math.cos(a + 1.57) * 0.55, v - Math.sin(a + 1.57) * 0.55, 0.7, 0, k + 2);
      solidDisc(u, v, 0.75);
    }
    // pots flanking every door, and a few along the walk from the bridge
    const walkA = CRAN_BRIDGE.b, walkB = W(GAZ.u, GAZ.v);
    for (let k = 1; k < 5; k++) {
      const t = k / 5.5;
      const x = walkA.x + (walkB.x - walkA.x) * t, z = walkA.z + (walkB.z - walkA.z) * t;
      const dx = walkB.x - walkA.x, dz = walkB.z - walkA.z, L = Math.hypot(dx, dz);
      for (const side of [-1, 1]) {
        const u = x - C.x - (dz / L) * 1.7 * side, v = z - C.z + (dx / L) * 1.7 * side;
        if (roomAt(u, v, 0.5)) { pot(u, v, 0.9, 0, k * 2 + (side > 0 ? 1 : 0)); solidDisc(u, v, 0.32); }
      }
    }
    register({
      pos: new THREE.Vector3(W(GAZ.u, GAZ.v + 4.6).x, 0, W(GAZ.u, GAZ.v + 4.6).z), r: 2.0,
      label: 'admire the flower pots',
      use: () => ui.say(nextLine('pots', [
        'Terracotta pots in tiers, big ones at the back, little ones in front, pinks next to whites next to purples, one trailing thing spilling over every third pot like it’s been told a joke. Somebody arranges these every morning. You can tell. It’s love, in rows.',
        'A tiny card tucked into the biggest pot: “TUESDAY GROUP — PLEASE DO NOT REARRANGE. (MABEL.)”',
        'You notice one pot has been turned very slightly, so its best side faces the gazebo. Everything here has a best side, and everything here is facing it.',
      ])),
    });
  }

  // ================================================ the village paths ----
  {
    // plank walks: bridge → green, green → each door, green → the creek bridges
    const plankWalk = (a, b, w = 1.2) => {
      const dx = b.x - a.x, dz = b.z - a.z, L = Math.hypot(dx, dz), ry = Math.atan2(dx, dz);
      const n = Math.ceil(L / 0.6);
      for (let k = 0; k < n; k++) {
        const t = (k + 0.5) / n, x = a.x + dx * t, z = a.z + dz * t;
        if (cranCreekDist(x, z) < 2.4 || cranBedAt(x, z, 0.3)) continue;
        const pl = box(w, 0.06, 0.5, k % 2 ? 0x9a8060 : 0x8a7050);
        pl.position.set(x, terrainHeight(x, z) + 0.03, z);
        pl.rotation.y = ry;
        pl.castShadow = false;
        group.add(pl);
      }
    };
    const green = W(GAZ.u, GAZ.v);
    plankWalk(CRAN_BRIDGE.b, green);
    plankWalk(W(GAZ.u, GAZ.v - 3), W(CC.u, CC.v + CC.d / 2 + 0.8));
    plankWalk(W(GAZ.u - 3, GAZ.v), W(REC.u + REC.d / 2 + 0.8, REC.v));
    plankWalk(W(GAZ.u - 2.5, GAZ.v + 2), W(INK.u + INK.d / 2 + 0.8, INK.v));
    plankWalk(W(GAZ.u + 3, GAZ.v), W(CREEK_BRIDGES[0].u0 - 0.3, CREEK_BRIDGES[0].v));
    // (round the flooded bed, between it and the south bed, not across it)
    plankWalk(W(CREEK_BRIDGES[0].u1 + 0.3, CREEK_BRIDGES[0].v), W(10.6, 3.5));
    plankWalk(W(10.6, 3.5), W(20.8, 3.5));
    plankWalk(W(20.8, 3.5), W(BENCH.u - 1.1, BENCH.v));
  }

  // ===================================== the bench under the big oak ----
  {
    const g = new THREE.Group();
    const seat = box(1.8, 0.1, 0.55, 0x8a6a48);
    seat.position.y = 0.48;
    const back = box(1.8, 0.5, 0.08, 0x8a6a48);
    back.position.set(0, 0.85, -0.25);
    g.add(seat, back);
    for (const sx of [-0.8, 0.8]) {
      const leg = box(0.1, 0.48, 0.5, 0x5a4a3a);
      leg.position.set(sx, 0.24, 0);
      g.add(leg);
    }
    g.traverse((o) => { if (o.isMesh) o.castShadow = o.receiveShadow = true; });
    put(g, BENCH.u, BENCH.v, 0, BENCH.ry);
    solidBox(BENCH.u, BENCH.v, 0.6, 1.8, BENCH.ry);
    // Sit: you, on the bench, looking out at the sea, until you choose to get
    // up (any direction key). Nothing to do. That's the whole feature.
    let seated = false;
    const seatAt = W(BENCH.u, BENCH.v);
    const stand = () => {
      if (!seated) return;
      seated = false;
      player.riding = false;
      player.group.position.set(seatAt.x - 1.2, gy(BENCH.u - 1.2, BENCH.v), seatAt.z);
    };
    addEventListener('keydown', (e) => {
      if (seated && ['KeyW', 'KeyA', 'KeyS', 'KeyD', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(e.code) && !ui.isBusy()) stand();
    });
    register({
      pos: new THREE.Vector3(seatAt.x - 0.9, 0, seatAt.z), r: 1.6,
      label: 'sit on the bench and look at the sea',
      enabled: () => !seated,
      use: async () => {
        await ui.fadeSwap(() => {
          seated = true;
          player.riding = true;
          player.group.position.set(seatAt.x, gy(BENCH.u, BENCH.v) + 0.3, seatAt.z);
          player.group.rotation.y = BENCH.ry;
        });
        await ui.say(nextLine('sea', [
          'You sit. The moss moves a little over your head. The sea goes out and out, grey-blue and then blue and then no color at all, where it meets the sky and they agree to stop arguing.',
          'You sit. A cranberry comes down the creek behind you and out into the bay and away. You watch it go until you can’t. It seemed to know where it was going.',
          'You sit. Far off, something glints on the water — a wave, or a gull, or just the light. You don’t get up to find out. You let it be a glint.',
          'You sit. Nobody needs anything from you. The oak doesn’t. The sea doesn’t. It’s very restful, being needed by nothing, for a while.',
        ]));
        ui.toast('Sitting. (Walk to get up.)', '🌊');
      },
    });
    outdoor.push(() => { if (seated && zones.current() !== 'island') { seated = false; player.riding = false; } });
  }

  // ============================================================ rooms ----
  const EXIT = {};
  const LIGHT = {
    bg: 0x2a2620, fog: 0x2a2620, fogNear: 22, fogFar: 60,
    hemiSky: 0xfff0dc, hemiGround: 0x6a5a48, hemiIntensity: 1.7, sunIntensity: 0,
  };
  function doorway(id, u, v, ry, label) {
    const ox = Math.sin(ry), oz = Math.cos(ry);
    const p = W(u, v);
    EXIT[id] = { x: p.x + ox * 1.2, z: p.z + oz * 1.2, rotY: ry };
    zones.setDoor(id, { x: EXIT[id].x, z: EXIT[id].z });
    register({ pos: new THREE.Vector3(p.x + ox * 0.6, 0, p.z + oz * 0.6), r: 1.6, label, use: () => zones.go(id) });
  }
  function room(id, name, B, { w, d, wallH = 3.6, floor, wall, lighting = LIGHT, build }) {
    const start = group.children.length;
    const fl = box(w, 0.4, d, floor);
    fl.position.set(B.x, -0.2, B.z);
    group.add(fl);
    for (const [ww, dd, x, z] of [[w, 0.3, B.x, B.z - d / 2], [0.3, d, B.x - w / 2, B.z], [0.3, d, B.x + w / 2, B.z]]) {
      const wl = box(ww, wallH, dd, wall);
      wl.position.set(x, wallH / 2, z);
      group.add(wl);
    }
    const blockers = [], things = [];
    build?.(B, blockers, things);
    const root = collectInteriorRoot(group, start);
    root.userData.noMerge = true;
    zones.registerInterior(id, {
      root, floorY: 0,
      bounds: { x0: B.x - w / 2 + 0.45, x1: B.x + w / 2 - 0.45, z0: B.z - d / 2 + 0.45, z1: B.z + d / 2 - 0.1 },
      blockers, spawn: { x: B.x, z: B.z + d / 2 - 0.7, rotY: Math.PI }, lighting,
    });
    addZonePlace(id, name);
    register({ pos: new THREE.Vector3(B.x, 0, B.z + d / 2 - 0.25), r: 1.5, zone: id, label: 'step outside', use: () => zones.leaveTo(EXIT[id]) });
    for (const it of things) register({ ...it, zone: id });
  }
  // (folk who notice you, and folk who wander a room: see oasis.js — same
  // manners here)
  function listFor(zone) { return zone === 'island' ? outdoor : (inside[zone] ??= []); }
  function attend(a, zone, r = 4.5) {
    const base = a.rotation.y;
    listFor(zone).push((dt, t, pp) => {
      const d = Math.hypot(pp.x - a.position.x, pp.z - a.position.z);
      a.rotation.y = turnToward(a.rotation.y, d < r ? Math.atan2(pp.x - a.position.x, pp.z - a.position.z) : base, dt, 3);
    });
  }
  function folk(kind, colors, x, y, z, ry, { scale, fidget } = {}) {
    const a = buildAnimal(kind, colors);
    if (scale) a.scale.setScalar(scale);
    a.position.set(x, y, z);
    a.rotation.y = ry;
    if (fidget) a.userData.fidget = true;
    group.add(a);
    return a;
  }
  async function till(who, voice, prompt, goods) {
    const V = { speaker: who, voice };
    const c = await ui.ask(prompt, [
      ...goods.map((g, k) => ({ label: `${ITEMS[g.id].emoji} ${ITEMS[g.id].name}`, value: String(k), hint: `${g.price}🔘`, disabled: S.state.buttons < g.price })),
      { label: 'Just looking', value: null },
    ], V);
    if (c === null || c === undefined) return false;
    const g = goods[Number(c)];
    S.spend(g.price);
    S.addItem(g.id);
    kaching();
    ui.updateHUD();
    ui.toast(`You got <b>${ITEMS[g.id].name}</b>.`, ITEMS[g.id].emoji);
    await g.before?.();
    await ui.say(g.say, V);
    return true;
  }
  function building(bld, { wall, roof, trim, flat = false }) {
    const g = new THREE.Group();
    const plinth = box(bld.w + 0.3, 1.0, bld.d + 0.3, 0x6a6258);
    plinth.position.y = -0.3;
    const body = box(bld.w, 2.8, bld.d, wall);
    body.position.y = 1.4;
    g.add(plinth, body);
    if (flat) {
      const cap = box(bld.w + 0.4, 0.3, bld.d + 0.4, roof);
      cap.position.y = 2.95;
      g.add(cap);
    } else {
      const r = (bld.d + 0.8) / 1.73;
      const geo = new THREE.CylinderGeometry(r, r, bld.w + 0.4, 3, 1, false, Math.PI / 2);
      geo.rotateZ(Math.PI / 2);
      const rf = new THREE.Mesh(geo, mat(roof));
      rf.scale.y = 1.3 / (r * 1.5);
      rf.position.y = 2.8 + 0.45;
      rf.castShadow = true;
      g.add(rf);
    }
    const door = box(1.0, 1.8, 0.1, trim);
    door.position.set(-bld.w / 4, 0.9, bld.d / 2 + 0.03);
    g.add(door);
    for (const wx of [bld.w / 4 - 0.3, bld.w / 4 + 0.7]) {
      if (wx > bld.w / 2 - 0.4) continue;
      const win = makeWindow(0.36);
      win.position.set(wx, 1.6, bld.d / 2 + 0.02);
      g.add(win);
    }
    g.traverse((o) => { if (o.isMesh) { o.castShadow = true; o.receiveShadow = true; } });
    put(g, bld.u, bld.v, 0, bld.ry);
    solidBox(bld.u, bld.v, bld.w + 0.3, bld.d + 0.3, bld.ry);
    const [du, dv] = local(bld.u, bld.v, bld.ry, -bld.w / 4, bld.d / 2 + 0.15);
    return { g, door: [du, dv] };
  }

  // ------------------------------------------------------------ Bog Ink ----
  {
    const b = building(INK, { wall: 0x1e1e24, roof: 0x2a2a30, trim: 0xd8342c, flat: true });
    // flames up the front, a lightning bolt, the sign: rock and roll
    for (let k = 0; k < 5; k++) {
      const fl = new THREE.Mesh(new THREE.ConeGeometry(0.22, 0.9 + (k % 2) * 0.4, 4), new THREE.MeshBasicMaterial({ color: k % 2 ? 0xff7a2a : 0xffc23a }));
      fl.position.set(0.6 + k * 0.38, 0.45 + (k % 2) * 0.2, INK.d / 2 + 0.06);
      b.g.add(fl);
    }
    const sg = sign(['BOG INK', 'tattoos · rock & roll · no appointment'], { w: 3.6, h: 0.9, bg: '#1e1e24', fg: '#ff4fb0', border: '#ffc23a' });
    sg.position.set(0, 2.3, INK.d / 2 + 0.1); // (below the roof cap)
    b.g.add(sg);
    const guitar = new THREE.Group();
    const gbody = box(0.55, 0.7, 0.08, 0xd8342c);
    const gneck = box(0.1, 1.1, 0.06, 0x2a2a2e);
    gneck.position.y = 0.85;
    guitar.add(gbody, gneck);
    guitar.position.set(0, 3.6, 0);
    guitar.rotation.z = 0.5;
    b.g.add(guitar);
    doorway('cran_ink', ...b.door, INK.ry, 'go into Bog Ink');
    const B = IN.cran_ink;
    room('cran_ink', '🎸 Bog Ink', B, {
      w: 12, d: 9, floor: 0x4a3a52, wall: 0x2e2440,
      lighting: { ...LIGHT, hemiSky: 0xffe0f2, hemiGround: 0x6a4a6a, hemiIntensity: 2.4 },
      build: (B, bl, things) => {
        const X = (l) => B.x + l, Z = (l) => B.z + l;
        const flash = sign(['FLASH', 'a cranberry · MOM (anchor) · a turtle, “SLOW & STEADY & METAL” · a lighthouse'], { w: 7, h: 1.4, d: 0.05, bg: '#f3ead6', fg: '#1e1e24' });
        flash.position.set(X(0), 2.4, Z(-4.3));
        group.add(flash);
        // the chair, the lamp, the station
        const chair = box(1.0, 0.6, 2.0, 0xd8342c);
        chair.position.set(X(2), 0.3, Z(-0.5));
        const back = box(1.0, 1.0, 0.3, 0xd8342c);
        back.position.set(X(2), 0.9, Z(-1.4));
        chair.rotation.y = back.rotation.y = 0;
        group.add(chair, back);
        bl.push({ x: X(2), z: Z(-0.6), w: 1.1, d: 2.2 });
        const lamp = makeHangingLamp(0x2a2a2e);
        lamp.position.set(X(2), 2.8, Z(-0.5));
        group.add(lamp);
        // the amp, a guitar on the wall, and the jukebox (it only has rock)
        const amp = box(0.9, 1.1, 0.6, 0x2a2a2e);
        amp.position.set(X(-5.0), 0.55, Z(-3.6));
        const grille = box(0.75, 0.8, 0.04, 0x55555a);
        grille.position.set(X(-5.0), 0.6, Z(-3.28));
        group.add(amp, grille);
        const juke = new THREE.Group();
        const jb = box(1.1, 1.6, 0.7, 0xc86a2a);
        jb.position.y = 0.8;
        const arch = new THREE.Mesh(new THREE.CylinderGeometry(0.55, 0.55, 0.7, 10, 1, false, 0, Math.PI), new THREE.MeshBasicMaterial({ color: 0xffc23a }));
        arch.rotation.z = Math.PI / 2;
        arch.rotation.y = Math.PI / 2;
        arch.position.y = 1.6;
        juke.add(jb, arch);
        juke.position.set(X(-3.4), 0, Z(-3.8));
        group.add(juke);
        bl.push({ x: X(-5.0), z: Z(-3.6), w: 0.9, d: 0.6 }, { x: X(-3.4), z: Z(-3.8), w: 1.1, d: 0.7 });
        const spike = folk('skunk', { body: 0x1e1e24, head: 0x1e1e24 }, X(0.6), 0, Z(-1.4), 0.3, { fidget: true });
        for (let k = 0; k < 5; k++) {
          const hawk = new THREE.Mesh(new THREE.ConeGeometry(0.07, 0.35, 4), mat(0xff4fb0));
          hawk.position.set(0, 0.4, 0.2 - k * 0.15);
          spike.userData.parts.head.add(hawk);
        }
        attend(spike, 'cran_ink');
        const designs = [
          { id: 'tattoo_cranberry', price: 20, say: 'A cranberry. Small. On the shoulder. Classic Cran. You’ll float now. Metaphorically. Maybe literally. Test it at the bog.' },
          { id: 'tattoo_mom', price: 25, say: 'An anchor. “MOM.” Timeless. Doesn’t matter whose mom. All moms. Rock and roll.' },
          { id: 'tattoo_turtle', price: 30, say: '“SLOW & STEADY & METAL.” My favorite. Barb has the same one. She won’t admit it. It’s under the moss.' },
          { id: 'tattoo_lighthouse', price: 30, say: 'A lighthouse. With the light on. People always want the light on. I get it.' },
        ].map((g) => ({ ...g, before: async () => {
          await ui.fadeSwap(() => {});
          for (let k = 0; k < 10; k++) tone(180 + (k % 3) * 20, { time: k * 0.09, dur: 0.07, type: 'square', vol: 0.012 });
        } }));
        things.push({ getPos: () => spike.position, r: 2.4, label: 'talk to Spike',
          use: async () => {
            const c = await ui.ask(nextLine('spike', SPIKE), [
              { label: '🖋️ Get a tattoo', value: 'ink' },
              { label: '🎸 Play the jukebox', value: 'juke' },
              { label: 'Just looking (respectfully)', value: null },
            ], { speaker: 'Spike', voice: VOICE.spike });
            if (c === 'ink') await till('Spike', VOICE.spike, 'Pick one off the flash. I’ll make it sing.', designs);
            if (c === 'juke') {
              playRiff();
              await ui.say('The jukebox lights up and plays the only song it has, which is also the only song it needs: loud, three chords, and a drum fill at the end that Spike air-drums along to, eyes closed.');
            }
          } });
        things.push({ pos: new THREE.Vector3(X(0), 0, Z(-3.2)), r: 1.6, label: 'read the flash',
          use: () => ui.say('A cranberry. An anchor with “MOM” on it. A turtle over the words SLOW & STEADY & METAL. A lighthouse, light on. And in the corner, crossed out in marker: “NO BELLS — they never come out right. —S.”') });
      },
    });
  }
  // three chords and a drum fill: the jukebox's one song
  function playRiff() {
    const e8 = 60 / 150 / 2, hz = (m) => 440 * Math.pow(2, (m - 69) / 12);
    let when = 0.05;
    for (const m of [45, 45, 48, 48, 50, 50, 48, 45, 45, 45, 48, 48, 52, 50, 48, 45]) {
      tone(hz(m), { time: when, dur: e8 * 0.8, type: 'sawtooth', vol: 0.032 });
      tone(hz(m + 7), { time: when, dur: e8 * 0.8, type: 'sawtooth', vol: 0.022 });
      when += e8;
    }
    for (let k = 0; k < 6; k++) tone(90 - k * 6, { time: when + k * 0.07, dur: 0.08, type: 'sine', vol: 0.08, slide: -20 });
  }

  // --------------------------------------------------- Low Tide Records ----
  {
    const b = building(REC, { wall: 0x2e3e5c, roof: 0x8c3a3f, trim: 0xf2cf5b });
    const sg = sign(['LOW TIDE RECORDS', 'vinyl · slowly'], { w: 3.8, h: 0.8, bg: '#2e3e5c', fg: '#f3ead6', border: '#f2cf5b' });
    sg.position.set(0, 2.3, REC.d / 2 + 0.1);
    b.g.add(sg);
    const disc = new THREE.Mesh(new THREE.CylinderGeometry(0.6, 0.6, 0.06, 16), mat(0x111114, 0.3));
    disc.rotation.x = Math.PI / 2;
    disc.position.set(REC.w / 2 - 0.9, 3.6, 0);
    const label = new THREE.Mesh(new THREE.CylinderGeometry(0.2, 0.2, 0.07, 12), mat(0xf2cf5b));
    label.rotation.x = Math.PI / 2;
    label.position.copy(disc.position);
    disc.userData.dynamic = label.userData.dynamic = true; // (the record turns)
    b.g.add(disc, label);
    outdoor.push((dt) => { disc.rotation.y += dt * 0.6; label.rotation.y = disc.rotation.y; });
    doorway('cran_records', ...b.door, REC.ry, 'go into Low Tide Records');
    const B = IN.cran_records;
    room('cran_records', '💿 Low Tide Records', B, {
      w: 14, d: 10, floor: 0x8a6a48, wall: 0x3a4a6a,
      build: (B, bl, things) => {
        const X = (l) => B.x + l, Z = (l) => B.z + l;
        // crates of records, in rows
        for (const [lx, lz] of [[-3, -1], [0, -1], [3, -1], [-3, 1.6], [0, 1.6]]) {
          const crate = box(2.0, 0.8, 0.9, 0x9a7a52);
          crate.position.set(X(lx), 0.4, Z(lz));
          group.add(crate);
          for (let k = 0; k < 10; k++) {
            const rec = box(0.04, 0.55, 0.62, [0x111114, 0xd8342c, 0x3a7dd8, 0xf2cf5b, 0x5cbf4a][Math.round(k + lx + lz * 3 + 20) % 5]);
            rec.position.set(X(lx - 0.85 + k * 0.19), 0.95, Z(lz));
            rec.rotation.z = 0.15;
            group.add(rec);
          }
          bl.push({ x: X(lx), z: Z(lz), w: 2.1, d: 1.0 });
        }
        counterTopRec(X(-5), Z(-3.6));
        function counterTopRec(x, z) {
          const c = box(2.4, 1.0, 0.9, 0x6a5a48);
          c.position.set(x, 0.5, z);
          const t = box(2.5, 0.06, 1.0, 0x3a3026);
          t.position.set(x, 1.03, z);
          const tt = cyl(0.35, 0.35, 0.06, 14, 0x111114);
          tt.position.set(x + 0.5, 1.1, z);
          group.add(c, t, tt);
          bl.push({ x, z, w: 2.4, d: 0.9 });
        }
        // the listening booth: a little box with a door and a pair of headphones
        const booth = box(2.0, 2.4, 2.0, 0x2e3e5c);
        booth.position.set(X(5), 1.2, Z(-3.4));
        group.add(booth);
        const boothWin = box(1.0, 0.8, 0.05, 0xbfe6f2);
        boothWin.position.set(X(5), 1.5, Z(-2.38));
        group.add(boothWin);
        bl.push({ x: X(5), z: Z(-3.4), w: 2.0, d: 2.0 });
        const sloane = folk('sloth', { body: 0x9a8a6a, head: 0xb8a888 }, X(-3.1), 0, Z(-3.5), 0.5, { fidget: false }); // (at the end of the counter, where you can see him)
        attend(sloane, 'cran_records', 5);
        const goods = [
          { id: 'record_slowjams', price: 15, say: 'Slow Jams… for Snapping Turtles. … Good choice. … Side B… is… longer.' },
          { id: 'record_honk', price: 12, say: 'HONK… by Mabel. … Bootleg. … She recorded it… in here. … Without asking. … It’s… actually very good.' },
          { id: 'record_lofi', price: 15, say: 'Lo-fi Beats… to Hack the Labs To. … Null’s. … She says… it’s just… a coincidence.' },
        ];
        things.push({ getPos: () => sloane.position, r: 2.4, label: 'talk to Sloane',
          use: async () => {
            await ui.say(nextLine('sloane', SLOANE), { speaker: 'Sloane', voice: VOICE.sloane });
            await till('Sloane', VOICE.sloane, 'Found… something?', goods);
          } });
        things.push({ pos: new THREE.Vector3(X(0), 0, Z(0.3)), r: 1.4, priority: 0, label: 'dig through the crates',
          use: () => ui.say(nextLine('crates', [
            '“Moss Grows On You” — The Dikes. The cover is just moss. The back cover is also moss. The liner notes say “see front.”',
            '“Songs for When the Creek Is High” — Ruth & the Needles. It is knitting sounds. It is four stars.',
            '“Live at the Gazebo (Tuesday)” — Various. Somebody is clearly arranging flower pots in the background of every track.',
            '“Chocolate: A Recovery” — the Chocoholics Anonymous Choir. Track 7 is just a long pause where a truffle should be.',
            '“The Low Tide Sessions, Vol. 1 (of 1)” — Sloane. Side A is a single note. It takes the whole side. It is gorgeous.',
          ])) });
        things.push({ pos: new THREE.Vector3(X(5), 0, Z(-1.8)), r: 1.6, label: 'use the listening booth',
          use: async () => {
            const song = ['button_bossa', 'foggy_lullaby', 'tidepool_stomp', 'mind_the_gap'][Math.floor(Math.random() * 4)];
            playSong(song, true);
            await ui.say('You step into the booth, put the headphones on, and drop the needle on whatever’s on the platter. It crackles, and then it’s playing, just for you, in a small blue room in a bog.');
          } });
      },
    });
  }

  // ------------------------------------------- the Community Center ----
  {
    const b = building(CC, { wall: 0x9ab08a, roof: 0x3d5a34, trim: 0xf3ead6 });
    const sg = sign(['CRAN COMMUNITY CENTER', 'zumba · watercolor · chocoholics anonymous'], { w: 6.2, h: 0.75, bg: '#f3ead6', fg: '#3d5a34', border: '#8c3a3f' });
    sg.position.set(0.8, 2.35, CC.d / 2 + 0.1); // (under the eaves)
    b.g.add(sg);
    const board = sign(['THIS WEEK', 'MON zumba (goose: back row)', 'THU watercolor (bring a smudge)', 'SAT C.A. (brownies NOT allowed, Ruth)'], { w: 1.6, h: 1.4, bg: '#fffaf0', fg: '#3a3026' });
    const [bu, bv] = local(CC.u, CC.v, CC.ry, CC.w / 4 + 1.2, CC.d / 2 + 0.9);
    put(board, bu, bv, 1.1, CC.ry);
    put(box(0.1, 0.6, 0.1, 0x6e5a44), bu, bv, 0.3, CC.ry);
    solidBox(bu, bv, 1.6, 0.3, CC.ry);
    doorway('cran_cc', ...b.door, CC.ry, 'go into the Community Center');
    const B = IN.cran_cc;
    room('cran_cc', '🏫 Cran Community Center', B, {
      w: 22, d: 12, floor: 0xc9a77a, wall: 0xe8e0cc,
      build: (B, bl, things) => {
        const X = (l) => B.x + l, Z = (l) => B.z + l;
        // three corners of one big room: zumba (west), watercolor (middle),
        // Chocoholics Anonymous (east) — each with its own sign
        for (const [lx, t, c] of [[-7, 'ZUMBA', '#e8573f'], [0, 'WATERCOLOR', '#3a7dd8'], [7, 'CHOCOHOLICS ANONYMOUS', '#6e3a2a']]) {
          const s = sign(t, { w: 5.5, h: 0.6, d: 0.05, bg: '#fffaf0', fg: c });
          s.position.set(X(lx), 3.0, Z(-5.85));
          group.add(s);
        }
        // --- zumba: a mirror wall, a bouncing class, Coach Lily out front
        const mirror = box(6, 2.0, 0.05, 0xcfe6ee);
        mirror.position.set(X(-7), 1.4, Z(-5.8));
        group.add(mirror);
        const lily = folk('frog', { body: 0x6ac85a, head: 0x6ac85a }, X(-7), 0, Z(-4.2), 0, {});
        const band = new THREE.Mesh(new THREE.TorusGeometry(0.4, 0.06, 5, 12), mat(0xff4fb0));
        band.rotation.x = Math.PI / 2;
        band.position.y = 0.22;
        lily.userData.parts.head.add(band);
        const dancers = [
          folk('rabbit', { body: 0xf5e6c8 }, X(-9), 0, Z(-1.8), Math.PI, {}),
          folk('bear', { body: 0x8d6748 }, X(-7), 0, Z(-1.5), Math.PI, {}),
          folk('hedgehog', { body: 0x9a7a5a }, X(-5), 0, Z(-1.8), Math.PI, {}),
        ];
        for (const dd of dancers) bl.push({ x: dd.position.x, z: dd.position.z, r: 0.6 });
        bl.push({ x: lily.position.x, z: lily.position.z, r: 0.6 });
        (inside.cran_cc ??= []).push((dt, t) => {
          const beat = t * 4.2;
          lily.position.y = Math.abs(Math.sin(beat)) * 0.3;
          lily.rotation.y = Math.sin(beat * 0.5) * 0.6;
          dancers.forEach((d, k) => {
            d.position.y = Math.abs(Math.sin(beat + k * 0.4)) * 0.22;
            d.rotation.y = Math.PI + Math.sin(beat * 0.5 + k) * 0.5;
            animateGait(d, t, 0.6, 8);
          });
        });
        things.push({ getPos: () => lily.position, r: 2.6, label: 'join the zumba class',
          use: async () => {
            await ui.say(nextLine('lily', LILY), { speaker: 'Coach Lily', voice: VOICE.lily });
            await ui.fadeSwap(() => {});
            for (let k = 0; k < 16; k++) tone([523, 659, 784, 659][k % 4], { time: k * 0.18, dur: 0.12, type: 'triangle', vol: 0.03 });
            S.drinkCoffee(45);
            ui.toast('Forty-five minutes of joy with a beat. You feel zippy.', '💃');
          } });
        // --- watercolor: easels, painters, Miss Dabble
        for (const [lx, lz] of [[-1.8, -1.6], [0.2, -2.2], [2.2, -1.6]]) {
          const easel = new THREE.Group();
          for (const sx of [-0.3, 0.3]) {
            const leg = box(0.06, 1.6, 0.06, 0x8a6a48);
            leg.position.set(sx, 0.8, 0);
            leg.rotation.z = -sx * 0.3;
            easel.add(leg);
          }
          const canvas = box(0.9, 0.7, 0.04, 0xfffaf0);
          canvas.position.set(0, 1.3, 0.05);
          const smudge = new THREE.Mesh(new THREE.CircleGeometry(0.22, 8), new THREE.MeshBasicMaterial({ color: [0xf28fb0, 0x8ab8d8, 0xb8d88a][Math.round(lx + 2) % 3] }));
          smudge.position.set(0.05, 1.3, 0.08);
          easel.add(canvas, smudge);
          easel.position.set(X(lx), 0, Z(lz));
          group.add(easel);
          bl.push({ x: X(lx), z: Z(lz), r: 0.5 });
        }
        const dabble = folk('otter', { body: 0x8a6a48, head: 0x8a6a48 }, X(0.2), 0, Z(-4.4), 0, { fidget: true });
        attend(dabble, 'cran_cc', 4);
        const painter = folk('heron', { body: 0x9fb3c8 }, X(-1.8), 0, Z(-0.6), Math.PI, {});
        void painter;
        things.push({ getPos: () => dabble.position, r: 2.4, label: 'paint a watercolor',
          use: async () => {
            await ui.say(nextLine('dabble', DABBLE), { speaker: 'Miss Dabble', voice: VOICE.dabble });
            await ui.fadeSwap(() => {});
            const day = S.todayKey();
            if (S.state.flags[`watercolor_${day}`]) {
              await ui.say('You paint the bog again. It comes out a pink smudge, just like this morning’s. You are, it seems, developing a style. You leave it on the rack to dry for someone who needs a smudge.');
              return;
            }
            S.setFlag(`watercolor_${day}`);
            S.addItem('watercolor_bog');
            await ui.say('You paint the bog. You try very hard. It comes out a pink smudge. Miss Dabble looks at it for a long time and says, “Yes. That’s it exactly.”');
            ui.toast('You made <b>A Watercolor of the Bog</b>. It’s a pink smudge. It’s perfect.', '🎨');
          } });
        // --- Chocoholics Anonymous: a circle of chairs, Coco facilitating,
        // a plate of brownies on a side table (Ruth), which nobody looks at
        const circle = [
          ['rabbit', { body: 0xd8b8a0 }], ['mouse', { body: 0xb8a890 }], ['bear', { body: 0x6e4a34 }], ['hamster', { body: 0xe8c89a }],
        ];
        const cx = 7, cz = -1.5, cr = 2.2;
        for (let k = 0; k < 6; k++) {
          const a = (k / 6) * Math.PI * 2;
          const x = X(cx + Math.cos(a) * cr), z = Z(cz + Math.sin(a) * cr);
          const ch = box(0.6, 0.45, 0.6, 0x6e3a2a);
          ch.position.set(x, 0.22, z);
          group.add(ch);
          bl.push({ x, z, r: 0.45 });
          if (k < circle.length) {
            const [kind, col] = circle[k];
            folk(kind, col, x, 0.3, z, Math.atan2(X(cx) - x, Z(cz) - z), { scale: 0.85 });
          } else if (k === 4) {
            // Coco, facilitating, with a clipboard and very kind eyes
            const coco = folk('rabbit', { body: 0x6e4a34 }, x, 0.3, z, Math.atan2(X(cx) - x, Z(cz) - z), { scale: 0.9 });
            attend(coco, 'cran_cc', 3.5);
          }
        }
        const side = box(1.0, 0.8, 0.6, 0x8a6a48);
        side.position.set(X(10), 0.4, Z(-4.6));
        const plate = cyl(0.35, 0.35, 0.04, 10, 0xffffff);
        plate.position.set(X(10), 0.83, Z(-4.6));
        group.add(side, plate);
        for (let k = 0; k < 5; k++) {
          const br = box(0.18, 0.1, 0.18, 0x4a2a1a);
          br.position.set(X(9.85 + (k % 3) * 0.14), 0.9 + Math.floor(k / 3) * 0.1, Z(-4.65 + (k % 2) * 0.12));
          group.add(br);
        }
        bl.push({ x: X(10), z: Z(-4.6), w: 1.0, d: 0.6 });
        things.push({ pos: new THREE.Vector3(X(cx), 0, Z(cz + cr + 1.2)), r: 2.0, label: 'sit in on Chocoholics Anonymous',
          use: async () => {
            const set = nextLine('choc', CHOC);
            await ui.say(set.map(([sp, text]) => ({ speaker: sp, voice: sp === 'Coco' ? VOICE.coco : sp === 'everyone' ? 380 : 450, text })));
            const c = await ui.ask('Coco turns to you, kindly. “Would you like to share?”', [
              { label: '🙋 “Hi. It’s been … a while.”', value: 'share' },
              { label: 'Just listening today', value: null },
            ], { speaker: 'Coco', voice: VOICE.coco });
            if (c === 'share') {
              await ui.say([
                { speaker: 'everyone', voice: 380, text: `Hi, ${S.state.name || 'friend'}.` },
                { speaker: 'Coco', voice: VOICE.coco, text: 'Thank you for sharing. A while is a while. We’re proud of you. Please don’t look at the brownies.' },
              ]);
            }
          } });
        things.push({ pos: new THREE.Vector3(X(10), 0, Z(-3.6)), r: 1.2, label: 'take a brownie',
          use: () => ui.say('You reach for a brownie. Every head in the circle turns, very slowly, toward you. You put the brownie back. The heads turn back. Somebody whispers, “Ruth.”') });
      },
    });
  }

  // ====================================================== update ----
  function update(dt, t, playerPos) {
    const zone = zones.current();
    if (zone === 'island') {
      if (Math.hypot(playerPos.x - C.x, playerPos.z - C.z) > 130) return;
      for (const f of outdoor) f(dt, t, playerPos);
    } else if (inside[zone]) {
      for (const f of inside[zone]) f(dt, t, playerPos);
    }
  }
  void rand; void sip; void glowWindow; void hourNow;
  mergeStatic(group);
  return { group, update };
}

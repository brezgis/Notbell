// THE BURROUGH — the city under the islands.
//
// The moles were here first. Everybody up top knows a mole or two (the
// Boring Department at the Labs, the Baron at the manor, his pups) and
// nobody up top ever asks where they go home to at night. Down. They go
// down. Two ways in: a molehill by the Labs beach where Wendell takes his
// fifteen, and a little arched door in the back wall of the Moledecai wine
// cellar. The distance between them is not to scale. Nothing down here is.
//
// Neighborhoods, west to east, joined by the Boring Line (a streetcar: the
// Boring Department dug it in one night, the paperwork took eleven years):
//   · THE WORKS — under the Labs. The Local 1 union hall, Bertha the shop
//     steward, a punch clock, the Visitors' Bureau (dirt globes), and Auger
//     at the tunnel face, where the Line is extending west. Soon.
//   · THE INSTITUTE FOR DEEP STUDY — up a quiet lane from the Works: Mould
//     Hall, a blackboard, the mushroom woods. Professor Mödel walks the lane;
//     Professor Emerita Rosalind (a naked mole rat) keeps tea at four.
//   · LOAM STREET — midtown. Stacked burrow apartments with laundry lines,
//     Mrs. Loamsworth at her window, Thelonious Mole busking on the corner,
//     Nibs's hot worm cart (contains no worms), the Daily Dirt and its
//     ethics correspondent Lowell (a worm, with legs, no comment), Marjorie
//     the groundhog forecasting the surface weather (always wrong), and
//     Spoke, who is the Burrough Electric company, in a wheel.
//   · UPTOWN — under the manor. The Moledecai, the old family building the
//     family left three Barons ago, and Fitzgerald, who still keeps the door;
//     Central Mulch, a park of three mushrooms and a bench.
// Down here they hear the bell through the rock on the heavy tides. Nobody
// up top has ever asked them. (Don't resolve that here — see docs/LORE.md.)
//
// Placement is deterministic without touching the shared seeded PRNG (a
// local hash), so adding the Burrough never reshuffles anything placed
// after it.

import * as THREE from 'three';
import * as zones from './zones.js';
import { register } from './interact.js';
import * as ui from './ui.js';
import * as S from './state.js';
import { ITEMS } from './catalog.js';
import { buildAnimal, animateGait } from './animals.js';
import { terrainHeight, ISLAND6_BEACH } from './terrain.js';
import { CELLAR } from './island5.js';
import { currentWeather } from './almanac.js';
import { fbm, smoothstep, hash2, vnoise, turnToward } from './utils.js';
import { tone, plop, jingle, kaching, thud, playSong } from './audio.js';
import { addPlaceNamer } from './fieldguide.js';

export const BURROUGH = { x: 0, z: -1300 }; // well past camera.far from anything up top
const O = BURROUGH;
const W = (x, z) => ({ x: O.x + x, z: O.z + z }); // local → world

// ------------------------------------------------------------ the plan ----
// Everything below is laid out in local coordinates (x east, z south; the
// camera looks north, so shopfronts face +z).
const WORKS = { x: -54, z: -3, rx: 15, rz: 10 };
const MIDTOWN = { x: 0, z: -4, rx: 21, rz: 12 };
const UPTOWN = { x: 54, z: -3, rx: 15, rz: 10 };
const INSTITUTE = { x: -46, z: -31, rx: 12, rz: 8 };
const AREAS = [
  { seg: [-82, 0, 72, 0], r: 4.2 },          // the Boring Line's tunnel, end to end
  { ell: WORKS }, { ell: MIDTOWN }, { ell: UPTOWN },
  { seg: [-47, -10, -46, -24], r: 3 },       // Institute Lane
  { ell: INSTITUTE },
];
const TRACK_Z = -2.4;
const STOPS = [
  { name: 'the Works', x: -52 },
  { name: 'Loam Street', x: 0 },
  { name: 'Uptown', x: 52 },
];
const PLAT = { z0: -1.0, z1: 1.3, hw: 4.5, h: 0.3 }; // platforms, just south of the track
const LADDER_W = { x: -64, z: -10.4 };            // up to the Labs
const LADDER_E = { x: 64, z: -10.4 };             // up to the wine cellar
const ARRIVE_W = { x: -64, z: -8, rotY: 0 };
const ARRIVE_E = { x: 64, z: -8, rotY: 0 };

function sdSeg(x, z, [ax, az, bx, bz], r) {
  const dx = bx - ax, dz = bz - az;
  const t = Math.max(0, Math.min(1, ((x - ax) * dx + (z - az) * dz) / (dx * dx + dz * dz)));
  return Math.hypot(x - (ax + dx * t), z - (az + dz * t)) - r;
}
function sdEll(x, z, e) {
  return (Math.hypot((x - e.x) / e.rx, (z - e.z) / e.rz) - 1) * Math.min(e.rx, e.rz);
}
// signed distance to the open ground: < 0 inside, > 0 inside the earth
function sd(lx, lz) {
  let d = Infinity;
  for (const a of AREAS) d = Math.min(d, a.seg ? sdSeg(lx, lz, a.seg, a.r) : sdEll(lx, lz, a.ell));
  return d;
}

// raised floors (platforms, the stoop) are part of the ground down here
const PADS = [];
for (const st of STOPS) PADS.push({ x0: st.x - PLAT.hw, x1: st.x + PLAT.hw, z0: PLAT.z0, z1: PLAT.z1, h: PLAT.h });

export function burroughHeight(x, z) {
  const lx = x - O.x, lz = z - O.z;
  const d = sd(lx, lz);
  let h = (vnoise(lx * 0.5, lz * 0.5) - 0.5) * 0.08;
  if (d > 0) {
    // the walls: tall at the back of every street, low on any bank whose
    // open ground lies to its north (the camera looks north, over those)
    const south = sd(lx, lz + 0.5) - sd(lx, lz - 0.5); // > 0: open ground is north of here
    const tall = 9 - 5.8 * smoothstep(-0.3, 0.5, south);
    h += smoothstep(0, 5, d) * tall + fbm(lx * 0.3, lz * 0.3) * smoothstep(0, 3, d) * 1.4;
  }
  for (const p of PADS) if (lx > p.x0 && lx < p.x1 && lz > p.z0 && lz < p.z1) h = Math.max(h, p.h);
  return h;
}

// solid footprints: circles {x, z, r} and axis boxes {x0, x1, z0, z1} (local)
const circles = [];
const boxes = [];
const block = (x, z, r) => circles.push({ x, z, r });
const blockBox = (x0, z0, x1, z1) => boxes.push({ x0, x1, z0, z1 });
function solid(lx, lz) {
  for (const c of circles) if (Math.hypot(lx - c.x, lz - c.z) < c.r) return true;
  for (const b of boxes) if (lx > b.x0 && lx < b.x1 && lz > b.z0 && lz < b.z1) return true;
  return false;
}

// a local hash, so the Burrough never draws from the shared seeded PRNG
let seedN = 0;
const h01 = () => hash2(++seedN * 1.37, 71.3);

// ------------------------------------------------------------ the kit ----
function mat(color, rough = 0.85) {
  return new THREE.MeshStandardMaterial({ color, flatShading: true, roughness: rough });
}
function glow(color, k = 0.9) {
  return new THREE.MeshStandardMaterial({ color, emissive: color, emissiveIntensity: k, roughness: 0.4, flatShading: true });
}
function box(w, h, d, color) {
  const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat(color));
  m.castShadow = m.receiveShadow = true;
  return m;
}
function sign(lines, w, h, bg = '#f3e6c8', fg = '#3a2a1c', { weight = 800, border = null } = {}) {
  const cv = document.createElement('canvas');
  cv.width = 512; cv.height = Math.max(64, Math.round(512 * h / w));
  const c = cv.getContext('2d');
  c.fillStyle = bg;
  c.fillRect(0, 0, cv.width, cv.height);
  if (border) { c.strokeStyle = border; c.lineWidth = 10; c.strokeRect(8, 8, cv.width - 16, cv.height - 16); }
  c.fillStyle = fg;
  c.textAlign = 'center';
  c.textBaseline = 'middle';
  const ls = lines.split('\n');
  let size = (cv.height / ls.length) * 0.62;
  do { c.font = `${weight} ${size}px ui-rounded, "Segoe UI", system-ui, sans-serif`; size -= 2; } while (ls.some((l) => c.measureText(l).width > cv.width * 0.88) && size > 10);
  ls.forEach((l, i) => c.fillText(l, cv.width / 2, cv.height / 2 + (i - (ls.length - 1) / 2) * size * 1.25));
  const tex = new THREE.CanvasTexture(cv);
  tex.colorSpace = THREE.SRGBColorSpace;
  return new THREE.Mesh(new THREE.PlaneGeometry(w, h), new THREE.MeshBasicMaterial({ map: tex }));
}
function dotTexture() {
  const cv = document.createElement('canvas');
  cv.width = cv.height = 64;
  const c = cv.getContext('2d');
  const g = c.createRadialGradient(32, 32, 2, 32, 32, 30);
  g.addColorStop(0, 'rgba(255,255,255,1)');
  g.addColorStop(0.4, 'rgba(255,255,255,0.4)');
  g.addColorStop(1, 'rgba(255,255,255,0)');
  c.fillStyle = g;
  c.fillRect(0, 0, 64, 64);
  return new THREE.CanvasTexture(cv);
}

// hats: every mole down here has an opinion about headwear
function hardHat() {
  const g = new THREE.Group();
  const dome = new THREE.Mesh(new THREE.SphereGeometry(0.3, 8, 4, 0, Math.PI * 2, 0, Math.PI / 2), mat(0xf2cf5b, 0.5));
  const brim = new THREE.Mesh(new THREE.CylinderGeometry(0.36, 0.36, 0.04, 10), mat(0xf2cf5b, 0.5));
  g.add(dome, brim);
  const lamp = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.06, 0.05, 8), glow(0xfff2c0, 1.2));
  lamp.rotation.x = Math.PI / 2;
  lamp.position.set(0, 0.14, 0.28);
  g.add(lamp);
  return g;
}
function fedora(color = 0x4a4038) {
  const g = new THREE.Group();
  const brim = new THREE.Mesh(new THREE.CylinderGeometry(0.36, 0.36, 0.03, 10), mat(color));
  const crown = new THREE.Mesh(new THREE.CylinderGeometry(0.2, 0.24, 0.24, 8), mat(color));
  crown.position.y = 0.13;
  const band = new THREE.Mesh(new THREE.CylinderGeometry(0.245, 0.245, 0.05, 8), mat(0x2a2420));
  band.position.y = 0.05;
  g.add(brim, crown, band);
  return g;
}
function flatCap(color) {
  const g = new THREE.Group();
  const top = new THREE.Mesh(new THREE.CylinderGeometry(0.3, 0.3, 0.1, 10), mat(color));
  const peak = new THREE.Mesh(new THREE.BoxGeometry(0.34, 0.03, 0.2), mat(0x2a2420));
  peak.position.set(0, -0.03, 0.3);
  g.add(top, peak);
  return g;
}
function beret(color) {
  const m = new THREE.Mesh(new THREE.CylinderGeometry(0.3, 0.26, 0.1, 10), mat(color));
  m.rotation.z = 0.25;
  return m;
}
function spectacles() {
  const g = new THREE.Group();
  for (const sx of [-1, 1]) {
    const ring = new THREE.Mesh(new THREE.TorusGeometry(0.075, 0.015, 4, 10), mat(0xc9a24a, 0.3));
    ring.position.set(sx * 0.12, 0, 0);
    g.add(ring);
  }
  const bridge = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.015, 0.015), mat(0xc9a24a, 0.3));
  g.add(bridge);
  return g;
}
function onHead(critter, thing, y = 0.33, z = 0) {
  thing.position.set(0, y, z);
  critter.userData.parts.head.add(thing);
  return thing;
}

export function createBurrough(player) {
  const group = new THREE.Group();
  group.name = 'burrough';
  const updates = []; // (dt, t, playerPos) — burrough zone only
  const at = (lx, lz) => burroughHeight(O.x + lx, O.z + lz);
  function put(obj, lx, lz, lift = 0) {
    obj.position.set(O.x + lx, at(lx, lz) + lift, O.z + lz);
    obj.traverse((o) => { if (o.isMesh && !o.material.emissive?.getHex?.()) { o.castShadow = true; o.receiveShadow = true; } });
    group.add(obj);
    return obj;
  }

  zones.registerWorld('burrough', {
    groundHeight: burroughHeight,
    canWalk(x, z) {
      const lx = x - O.x, lz = z - O.z;
      if (Math.abs(lx - line.x) < 2.75 && Math.abs(lz - TRACK_Z) < 1.2) return false; // the streetcar is solid
      return sd(lx, lz) < -0.5 && !solid(lx, lz);
    },
    spawn: { ...W(ARRIVE_W.x, ARRIVE_W.z), rotY: 0 },
    lighting: {
      bg: 0x1d140d, fog: 0x1d140d, fogNear: 20, fogFar: 75,
      hemiSky: 0xffd9a8, hemiGround: 0x4a3322, hemiIntensity: 1.05,
      sunIntensity: 1.1,
      sunPos: [O.x - 20, 60, O.z + 30],
      sunTarget: [O.x, 0, O.z],
    },
  });

  addPlaceNamer('burrough', (x, z) => {
    const lx = x - O.x, lz = z - O.z;
    const inE = (e, pad = 1) => sdEll(lx, lz, e) < pad;
    if (inE(INSTITUTE) || sdSeg(lx, lz, [-47, -12, -46, -24], 3) < 0) return '🎓 The Institute for Deep Study';
    if (inE(WORKS)) return '⛏️ The Works';
    if (inE(MIDTOWN)) return '🚋 Loam Street';
    if (inE(UPTOWN)) return '🎩 Uptown';
    if (lx < -69) return '⛏️ The Tunnel Face';
    return '🚋 The Boring Line';
  });

  // ============================================================ the dirt ----
  {
    const X0 = -88, X1 = 78, Z0 = -46, Z1 = 16;
    const SX = 166, SZ = 62;
    let geo = new THREE.PlaneGeometry(X1 - X0, Z1 - Z0, SX, SZ);
    geo.rotateX(-Math.PI / 2);
    geo.translate(O.x + (X0 + X1) / 2, 0, O.z + (Z0 + Z1) / 2);
    const pos = geo.attributes.position;
    for (let i = 0; i < pos.count; i++) pos.setY(i, burroughHeight(pos.getX(i), pos.getZ(i)));
    geo = geo.toNonIndexed();
    const p = geo.attributes.position;
    const colors = new Float32Array(p.count * 3);
    const col = new THREE.Color();
    const FLOOR_A = new THREE.Color(0x8a6848), FLOOR_B = new THREE.Color(0x7e5f42);
    const PATH = new THREE.Color(0xa88a66), PLATFORM = new THREE.Color(0xb8a58a);
    // the walls, in strata: every band a different century of dirt
    const STRATA = [0x6b4a32, 0x7d5a3c, 0x5e4230, 0x8a6a4a, 0x6a4c38, 0x9a7a58, 0x5a3e2c].map((c) => new THREE.Color(c));
    const MOSS = new THREE.Color(0x5f6e3a);
    for (let i = 0; i < p.count; i += 3) {
      const x = (p.getX(i) + p.getX(i + 1) + p.getX(i + 2)) / 3 - O.x;
      const z = (p.getZ(i) + p.getZ(i + 1) + p.getZ(i + 2)) / 3 - O.z;
      const y = (p.getY(i) + p.getY(i + 1) + p.getY(i + 2)) / 3;
      const d = sd(x, z);
      if (d > 0.2 && y > 0.25) {
        const band = Math.floor(y * 1.1 + Math.sin(x * 0.08) * 0.8);
        col.copy(STRATA[((band % STRATA.length) + STRATA.length) % STRATA.length]);
        if (vnoise(x * 0.6, y * 2) > 0.8) col.lerp(MOSS, 0.4);
      } else {
        col.copy(vnoise(x * 0.7, z * 0.7) > 0.5 ? FLOOR_A : FLOOR_B);
        if (Math.abs(z - 0.8) < 3.2 && d < -0.5) col.lerp(PATH, 0.35); // the walkway beside the Line
        if (y > 0.2 && y < 0.35 && d < 0) col.copy(PLATFORM);
      }
      col.multiplyScalar(1 + (hash2(i, 5) - 0.5) * 0.1);
      for (let k = 0; k < 3; k++) {
        colors[(i + k) * 3] = col.r; colors[(i + k) * 3 + 1] = col.g; colors[(i + k) * 3 + 2] = col.b;
      }
    }
    geo.setAttribute('color', new THREE.BufferAttribute(colors, 3));
    geo.computeVertexNormals();
    const mesh = new THREE.Mesh(geo, new THREE.MeshStandardMaterial({ vertexColors: true, flatShading: true, roughness: 1 }));
    mesh.receiveShadow = true;
    group.add(mesh);
  }

  // roots, hanging down out of the dark wherever the ceiling would be
  {
    const rootMat = mat(0x5a3e28, 0.95);
    const geo = new THREE.ConeGeometry(0.16, 1, 4);
    geo.translate(0, -0.5, 0);
    const roots = new THREE.InstancedMesh(geo, rootMat, 160);
    const m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), sc = new THREE.Vector3(), v = new THREE.Vector3();
    let n = 0;
    for (let i = 0; i < 3000 && n < 160; i++) {
      const lx = -86 + h01() * 162, lz = -44 + h01() * 58;
      const d = sd(lx, lz);
      if (d < 0.8 || d > 4.5) continue;
      if (sd(lx, lz + 0.5) - sd(lx, lz - 0.5) > -0.2) continue; // back walls only: open ground to the south
      const len = 1.2 + h01() * 3.2;
      const top = 10.5 + h01() * 2.5; // out of the dark, where a ceiling would be
      if (top - len < at(lx, lz) + 0.6) continue;
      q.setFromAxisAngle(v.set(h01() - 0.5, 0, h01() - 0.5).normalize(), (h01() - 0.5) * 0.3);
      m4.compose(v.set(O.x + lx, top, O.z + lz), q, sc.set(0.4 + h01() * 0.5, len, 0.4 + h01() * 0.5));
      roots.setMatrixAt(n++, m4);
    }
    roots.count = n;
    group.add(roots);
  }

  // glow worms: they live on the tunnel walls, free and extremely polite
  // (they have their own cave up top; these are the city cousins)
  {
    const N = 700;
    const posA = new Float32Array(N * 3), colA = new Float32Array(N * 3);
    const base = [];
    const PAL = [new THREE.Color(0x9fffe0), new THREE.Color(0x7fd8ff), new THREE.Color(0xc8ffa0)];
    let n = 0;
    for (let i = 0; i < 6000 && n < N; i++) {
      const lx = -86 + h01() * 162, lz = -44 + h01() * 58;
      const d = sd(lx, lz);
      if (d < 0.6 || d > 6) continue;
      // thickest in the tunnels between neighborhoods, where the lamps aren't
      const inTown = sdEll(lx, lz, MIDTOWN) < 2 || sdEll(lx, lz, UPTOWN) < 2 || sdEll(lx, lz, WORKS) < 2;
      if (inTown && h01() < 0.6) continue;
      posA[n * 3] = O.x + lx; posA[n * 3 + 1] = at(lx, lz) + 0.25 + h01() * 2.5; posA[n * 3 + 2] = O.z + lz;
      base.push({ c: PAL[n % 3], ph: h01() * 9 });
      n++;
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(posA.subarray(0, n * 3), 3));
    geo.setAttribute('color', new THREE.BufferAttribute(colA.subarray(0, n * 3), 3));
    const worms = new THREE.Points(geo, new THREE.PointsMaterial({
      size: 5, sizeAttenuation: false, vertexColors: true, transparent: true, map: dotTexture(),
      depthWrite: false, blending: THREE.AdditiveBlending, fog: false,
    }));
    group.add(worms);
    updates.push((dt, t) => {
      for (let i = 0; i < n; i++) {
        const b = base[i], k = 0.55 + 0.45 * Math.sin(t * 1.3 + b.ph);
        colA[i * 3] = b.c.r * k; colA[i * 3 + 1] = b.c.g * k; colA[i * 3 + 2] = b.c.b * k;
      }
      geo.attributes.color.needsUpdate = true;
    });
  }

  // ======================================================= street furniture ----
  const lampBulbs = []; // Burrough Electric's customers (Spoke powers these)
  function lamp(lx, lz, h = 3.2) {
    const g = new THREE.Group();
    const post = box(0.14, h, 0.14, 0x3a3430);
    post.position.y = h / 2;
    const arm = box(0.7, 0.08, 0.08, 0x3a3430);
    arm.position.set(0.3, h - 0.05, 0);
    const shade = new THREE.Mesh(new THREE.ConeGeometry(0.26, 0.22, 6), mat(0x3a3430));
    shade.position.set(0.6, h - 0.12, 0);
    const bulb = new THREE.Mesh(new THREE.IcosahedronGeometry(0.13, 0), glow(0xffd98a, 1.1));
    bulb.position.set(0.6, h - 0.28, 0);
    g.add(post, arm, shade, bulb);
    put(g, lx, lz);
    bulb.castShadow = false;
    lampBulbs.push(bulb);
    block(lx, lz, 0.25);
    return g;
  }

  // a shopfront, carved into the wall: front face at z (local), back into the earth
  function frontage({ x, z, w, h, d = 5, color, trim = 0xe8dcc0, name, sub = '', signBg = '#f3e6c8', signFg = '#3a2a1c', rows = 1, cols = 2, door = true, doorColor = 0x3a2a20 }) {
    const g = new THREE.Group();
    const bodyM = box(w, h, d, color);
    bodyM.position.set(0, h / 2, -d / 2);
    bodyM.userData.occlude = true;
    g.add(bodyM);
    const cornice = box(w + 0.4, 0.3, 0.5, trim);
    cornice.position.set(0, h, 0.05);
    g.add(cornice);
    const base = box(w + 0.1, 0.35, 0.2, trim);
    base.position.set(0, 0.17, 0.02);
    g.add(base);
    if (door) {
      const dr = box(1.1, 1.9, 0.12, doorColor);
      dr.position.set(0, 0.95, 0.02);
      const arch = new THREE.Mesh(new THREE.CircleGeometry(0.55, 10, 0, Math.PI), mat(doorColor));
      arch.position.set(0, 1.9, 0.09);
      const knob = new THREE.Mesh(new THREE.IcosahedronGeometry(0.05, 0), mat(0xc9a24a, 0.3));
      knob.position.set(0.35, 0.95, 0.1);
      g.add(dr, arch, knob);
    }
    // round windows, warm — it's always evening down here
    const winMat = glow(0xffc87a, 0.75);
    const frameMat = mat(trim);
    const top = h - 0.9;
    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        const wx = (c + 0.5) * (w / cols) - w / 2;
        if (door && r === 0 && Math.abs(wx) < 1) continue;
        const wy = rows === 1 ? h * 0.52 : 1.6 + r * ((top - 1.6) / Math.max(1, rows - 1));
        const pane = new THREE.Mesh(new THREE.CircleGeometry(0.42, 10), winMat);
        pane.position.set(wx, wy, 0.03);
        const frame = new THREE.Mesh(new THREE.TorusGeometry(0.44, 0.07, 4, 12), frameMat);
        frame.position.set(wx, wy, 0.05);
        g.add(pane, frame);
      }
    }
    if (name) {
      const s = sign(sub ? `${name}\n${sub}` : name, Math.min(w - 0.6, 5.5), sub ? 0.95 : 0.6, signBg, signFg);
      s.position.set(0, h - 0.45, 0.33);
      g.add(s);
    }
    put(g, x, z);
    blockBox(x - w / 2, z - d, x + w / 2, z + 0.1);
    return g;
  }

  // a talker; a walker (loops its points, waits if you're in the way)
  function talker(getPos, name, voice, lines, r = 2.4) {
    let k = 0;
    register({
      getPos, r, zone: 'burrough', label: `talk to ${name}`,
      use: () => ui.say(lines[k++ % lines.length], { speaker: name, voice }),
    });
  }
  function walker(g, pts, speed, opts = {}) {
    const points = pts.map(([x, z]) => W(x, z));
    const w = { i: 1, pause: 1, ...opts };
    g.position.set(points[0].x, burroughHeight(points[0].x, points[0].z), points[0].z);
    group.add(g);
    updates.push((dt, t, pp) => {
      if (w.pause > 0) {
        w.pause -= dt;
        animateGait(g, t, 0);
        if (pp && Math.hypot(pp.x - g.position.x, pp.z - g.position.z) < 3.5) {
          g.rotation.y = turnToward(g.rotation.y, Math.atan2(pp.x - g.position.x, pp.z - g.position.z), dt, 4);
        }
        return;
      }
      const tg = points[w.i];
      const dx = tg.x - g.position.x, dz = tg.z - g.position.z, d = Math.hypot(dx, dz);
      if (d < 0.3) { w.i = (w.i + 1) % points.length; w.pause = w.rest ?? 1 + h01() * 2.5; return; }
      const nx = g.position.x + (dx / d) * speed * dt, nz = g.position.z + (dz / d) * speed * dt;
      if (pp && Math.hypot(pp.x - nx, pp.z - nz) < 1 && Math.hypot(pp.x - nx, pp.z - nz) < Math.hypot(pp.x - g.position.x, pp.z - g.position.z)) {
        animateGait(g, t, 0);
        return; // you're in the way; they wait
      }
      g.position.set(nx, burroughHeight(nx, nz), nz);
      g.rotation.y = turnToward(g.rotation.y, Math.atan2(dx, dz), dt, 6);
      animateGait(g, t, 1, w.rate ?? 10);
    });
    return w;
  }
  function stand(critter, lx, lz, rotY = 0, lift = 0) {
    critter.position.set(O.x + lx, at(lx, lz) + lift, O.z + lz);
    critter.rotation.y = rotY;
    group.add(critter);
    block(lx, lz, 0.45);
    return critter;
  }

  // ================================================ the ways in and out ----
  const shaftMat = new THREE.MeshBasicMaterial({ color: 0xfff4d8, transparent: true, opacity: 0.1, depthWrite: false, blending: THREE.AdditiveBlending, fog: false });
  function ladder(lx, lz, warm) {
    const g = new THREE.Group();
    for (const sx of [-0.4, 0.4]) {
      const rail = box(0.1, 9, 0.1, 0x8a6a44);
      rail.position.set(sx, 4.5, 0);
      g.add(rail);
    }
    for (let y = 0.4; y < 9; y += 0.5) {
      const rung = box(0.8, 0.06, 0.08, 0x9a7a50);
      rung.position.set(0, y, 0);
      g.add(rung);
    }
    const shaft = new THREE.Mesh(new THREE.CylinderGeometry(0.9, 1.8, 12, 8, 1, true), shaftMat.clone());
    if (warm) shaft.material.color.set(0xffc27a);
    shaft.position.set(0, 6, 0.6);
    g.add(shaft);
    put(g, lx, lz);
    shaft.castShadow = false;
    block(lx, lz, 0.6);
    return g;
  }
  ladder(LADDER_W.x, LADDER_W.z, false);
  ladder(LADDER_E.x, LADDER_E.z, true);
  {
    // west: a hard-hat-yellow sign; east: a brass handrail and a velvet rope
    const sw = sign('↑ UP TO THE LABS\n(mind your head)', 1.8, 0.8, '#f2cf5b', '#2e2a26');
    sw.position.set(O.x + LADDER_W.x + 1.5, at(LADDER_W.x, LADDER_W.z) + 2.2, O.z + LADDER_W.z + 0.3);
    group.add(sw);
    const se = sign('↑ THE MOLEDECAI CELLAR\nresidents & guests', 1.9, 0.8, '#2e3a2a', '#e8d49a', { border: '#c9a24a' });
    se.position.set(O.x + LADDER_E.x - 1.6, at(LADDER_E.x, LADDER_E.z) + 2.2, O.z + LADDER_E.z + 0.3);
    group.add(se);
    for (const dx of [-1.1, 1.1]) {
      const post = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.08, 0.9, 8), mat(0xc9a24a, 0.3));
      put(post, LADDER_E.x + dx, LADDER_E.z + 1.6, 0.45);
      const knob = new THREE.Mesh(new THREE.IcosahedronGeometry(0.09, 0), mat(0xc9a24a, 0.3));
      put(knob, LADDER_E.x + dx, LADDER_E.z + 1.6, 0.95);
    }
    const rope = new THREE.Mesh(new THREE.TorusGeometry(1.1, 0.04, 4, 12, Math.PI), mat(0x8a1f2a, 0.6));
    rope.rotation.set(0, 0, Math.PI);
    put(rope, LADDER_E.x, LADDER_E.z + 1.6, 0.85);
  }
  register({
    pos: new THREE.Vector3(O.x + LADDER_W.x, 0, O.z + LADDER_W.z + 1.2), r: 1.8, zone: 'burrough',
    label: 'climb up to the Labs',
    use: async () => {
      await zones.go('island', { ...labsHill.out });
      ui.toast('Up and out, blinking, onto the Labs beach. Wendell raises his thermos an inch.', '☀️');
    },
  });
  register({
    pos: new THREE.Vector3(O.x + LADDER_E.x, 0, O.z + LADDER_E.z + 1.2), r: 1.8, zone: 'burrough',
    label: 'climb up to the wine cellar',
    use: async () => {
      await zones.go('cellar', { x: CELLAR.x - 1.2, z: CELLAR.z - 2.4, rotY: Math.PI });
      ui.toast('Through the little door, into somebody’s wine cellar. It is very quiet. The Moonbeam ’34 glows.', '🍷');
    },
  });

  // ---- up top: the molehill by the Labs beach (Wendell's commute) ----
  const labsHill = (() => {
    // somewhere dry and open near Wendell's chair
    const B = ISLAND6_BEACH;
    let spot = null;
    for (let r = 0; r <= 9 && !spot; r += 0.75) {
      for (let k = 0; k < (r ? 12 : 1) && !spot; k++) {
        const a = (k / 12) * Math.PI * 2 + r;
        const x = B.x + 3 + Math.cos(a) * r, z = B.z - 6 + Math.sin(a) * r;
        if (terrainHeight(x, z) > 0.6 && !zones.nearAnything(x, z, 1.6)) spot = { x, z };
      }
    }
    spot = spot || { x: B.x + 3, z: B.z - 6 };
    const y = terrainHeight(spot.x, spot.z);
    const g = new THREE.Group();
    const mound = new THREE.Mesh(new THREE.CylinderGeometry(0.35, 0.95, 0.5, 8), mat(0x7a5a3c));
    mound.position.y = 0.2;
    const hole = new THREE.Mesh(new THREE.CircleGeometry(0.32, 8), mat(0x1d140d, 1));
    hole.rotation.x = -Math.PI / 2;
    hole.position.y = 0.46;
    const rungs = box(0.5, 0.05, 0.05, 0x9a7a50);
    rungs.position.set(0, 0.62, -0.18);
    for (const sx of [-0.25, 0.25]) {
      const rail = box(0.05, 0.5, 0.05, 0x8a6a44);
      rail.position.set(sx, 0.55, -0.18);
      g.add(rail);
    }
    const stake = box(0.06, 0.9, 0.06, 0x7a5230);
    stake.position.set(0.9, 0.45, 0.2);
    const plate = sign('BORING DEPT.\nstaff entrance\n(visitors welcome)', 0.8, 0.45, '#f2cf5b', '#2e2a26');
    plate.position.set(0.9, 0.95, 0.24);
    const hat = hardHat();
    hat.scale.setScalar(0.8);
    hat.position.set(0.9, 0.93, 0.2);
    hat.rotation.y = 0.4;
    g.add(mound, hole, rungs, stake, plate);
    g.add(hat);
    g.position.set(spot.x, y - 0.05, spot.z);
    g.traverse((o) => { if (o.isMesh) { o.castShadow = true; o.receiveShadow = true; } });
    group.add(g);
    zones.addBlocker(spot.x, spot.z, 0.9);
    register({
      pos: new THREE.Vector3(spot.x, 0, spot.z + 1), r: 1.9,
      label: 'climb down the molehill',
      use: () => enter(ARRIVE_W),
    });
    group.userData.molehill = spot; // (the screenshot harness goes looking for it)
    return { out: { x: spot.x, z: spot.z + 1.6, rotY: 0 } };
  })();

  // ---- up top: the little door in the back wall of the wine cellar ----
  {
    const C = CELLAR;
    const g = new THREE.Group();
    const dark = new THREE.Mesh(new THREE.CircleGeometry(0.5, 12, 0, Math.PI), mat(0x120c08, 1));
    const lower = new THREE.Mesh(new THREE.PlaneGeometry(1.0, 0.35), mat(0x120c08, 1));
    lower.position.y = -0.17;
    dark.add(lower);
    dark.position.y = 0.35;
    const trim = new THREE.Mesh(new THREE.TorusGeometry(0.52, 0.05, 4, 12, Math.PI), mat(0xc9a24a, 0.3));
    trim.position.y = 0.35;
    const plaque = sign('SERVICE ENTRANCE\n(the Burrough)', 0.55, 0.22, '#c9a24a', '#2e2a1c');
    plaque.position.set(0, 1.12, 0.01);
    g.add(dark, trim, plaque);
    g.position.set(C.x - 1.2, 0, C.z - 4.28);
    group.add(g);
    register({
      pos: new THREE.Vector3(C.x - 1.2, 0, C.z - 3.3), r: 1.4, zone: 'cellar',
      label: 'squeeze through the little door',
      use: () => enter(ARRIVE_E),
    });
  }

  async function enter(spot) {
    plop();
    await zones.go('burrough', { ...W(spot.x, spot.z), rotY: spot.rotY });
    if (!S.hasFlag('sawBurrough')) {
      S.setFlag('sawBurrough');
      ui.say([
        'Down the ladder, a long way, past roots and a sign that says MIND YOUR HEAD, and then another that says MIND IT AGAIN.',
        'And then the dark opens out into a city. Lamps. Round windows. A streetcar bell, somewhere, going ding ding.',
        'A sign on the wall: WELCOME TO THE BURROUGH. POP. LOTS.',
      ]);
    }
  }

  // ======================================================= THE BORING LINE ----
  // the track, the wire, the platforms, and the one car, which comes when rung
  {
    const railMat = mat(0x9a9a9a, 0.35);
    for (const dz of [-0.55, 0.55]) {
      const rail = new THREE.Mesh(new THREE.BoxGeometry(146, 0.08, 0.08), railMat);
      rail.position.set(O.x - 4, 0.06, O.z + TRACK_Z + dz);
      rail.receiveShadow = true;
      group.add(rail);
    }
    const ties = new THREE.InstancedMesh(new THREE.BoxGeometry(0.25, 0.06, 1.6), mat(0x5a4230), 200);
    const m4 = new THREE.Matrix4();
    let n = 0;
    for (let x = -76; x <= 68; x += 0.9) { m4.makeTranslation(O.x + x, 0.03, O.z + TRACK_Z); ties.setMatrixAt(n++, m4); }
    ties.count = n;
    ties.receiveShadow = true;
    group.add(ties);
    // the wire, on posts along the north side
    const wire = new THREE.Mesh(new THREE.BoxGeometry(146, 0.03, 0.03), mat(0x2a2a2a));
    wire.position.set(O.x - 4, 4.1, O.z + TRACK_Z);
    group.add(wire);
    for (let x = -74; x <= 66; x += 14) {
      const pz = TRACK_Z - 1.7;
      const post = box(0.14, 4.3, 0.14, 0x3a3430);
      put(post, x, pz, 2.15);
      const arm = box(0.08, 0.08, 1.8, 0x3a3430);
      put(arm, x, pz + 0.85, 4.2);
      block(x, pz, 0.2);
    }
    // platforms: a lip of cut stone, a name board, a bell pull
    for (const st of STOPS) {
      const edge = box(PLAT.hw * 2, 0.32, 0.18, 0xd8c8a8);
      put(edge, st.x, PLAT.z0 + 0.09, 0.0);
      edge.position.y = 0.16;
      const pole = box(0.12, 2.6, 0.12, 0x3a3430);
      put(pole, st.x - 3.2, PLAT.z1 - 0.3, 1.3 + PLAT.h);
      const board = sign(`BORING LINE\n${st.name.toUpperCase()}`, 1.9, 0.75, '#2f5a44', '#f3e6c8', { border: '#e8d49a' });
      board.position.set(O.x + st.x - 3.2, PLAT.h + 2.35, O.z + PLAT.z1 - 0.22);
      group.add(board);
      block(st.x - 3.2, PLAT.z1 - 0.3, 0.2);
      const bell = new THREE.Mesh(new THREE.ConeGeometry(0.16, 0.22, 8, 1, true), mat(0xc9a24a, 0.3));
      put(bell, st.x - 3.2, PLAT.z1 - 0.05, PLAT.h + 1.6);
      bell.material.side = THREE.DoubleSide;
      st.bell = bell;
    }
  }

  // the car: open-sided, like a summer trolley, so you can see who's aboard
  const car = new THREE.Group();
  const riders = [];
  {
    const green = 0x3f7a5a, cream = 0xefe2c0;
    const floor = box(5.2, 0.25, 2.1, 0x5a4230);
    floor.position.y = 0.55;
    const skirtS = box(5.2, 0.5, 0.1, green);
    skirtS.position.set(0, 0.9, 1.0);
    const skirtN = skirtS.clone();
    skirtN.position.z = -1.0;
    const roof = box(5.6, 0.18, 2.4, green);
    roof.position.y = 2.75;
    const roofTop = box(4.4, 0.16, 1.5, cream);
    roofTop.position.y = 2.9;
    car.add(floor, skirtS, skirtN, roof, roofTop);
    for (const sx of [-2.45, -0.8, 0.8, 2.45]) for (const sz of [-1.0, 1.0]) {
      const post = box(0.1, 1.9, 0.1, cream);
      post.position.set(sx, 1.75, sz);
      car.add(post);
    }
    for (const sx of [-2.6, 2.6]) {
      const end = box(0.14, 1.0, 2.1, green);
      end.position.set(sx, 1.1, 0);
      const lampF = new THREE.Mesh(new THREE.CircleGeometry(0.16, 10), glow(0xfff0c0, 1.2));
      lampF.position.set(sx + Math.sign(sx) * 0.08, 1.3, 0);
      lampF.rotation.y = Math.sign(sx) * Math.PI / 2;
      car.add(end, lampF);
    }
    const band = box(5.25, 0.12, 2.15, cream);
    band.position.y = 1.2;
    car.add(band);
    for (const sx of [-1.7, 0, 1.7]) {
      const bench = box(1.2, 0.12, 0.5, 0x8a5a3a);
      bench.position.set(sx, 0.95, -0.55);
      car.add(bench);
    }
    const nameplate = sign('THE BORING LINE', 2.4, 0.32, '#3f7a5a', '#efe2c0');
    nameplate.position.set(0, 2.52, 1.21);
    car.add(nameplate);
    // the trolley pole, up to the wire, sparking now and then
    const pole = box(0.05, 0.05, 1.6, 0x2a2a2a);
    pole.rotation.x = 0;
    pole.rotation.y = Math.PI / 2;
    pole.rotation.z = 0.7;
    pole.position.set(-0.8, 3.45, 0);
    car.add(pole);
    const spark = new THREE.Mesh(new THREE.IcosahedronGeometry(0.08, 0), glow(0xbfe8ff, 2));
    spark.position.set(-1.4, 4.08, 0);
    car.add(spark);
    car.userData.spark = spark;
    for (const sx of [-1.9, 1.9]) for (const sz of [-0.7, 0.7]) {
      const wheel = new THREE.Mesh(new THREE.CylinderGeometry(0.3, 0.3, 0.12, 10), mat(0x3a3a3a, 0.4));
      wheel.rotation.x = Math.PI / 2;
      wheel.position.set(sx, 0.32, sz);
      car.add(wheel);
    }
    car.traverse((o) => { if (o.isMesh && o !== spark) { o.castShadow = true; o.receiveShadow = true; } });
    // the motorman, and a regular with the paper
    const motor = buildAnimal('mole', { body: 0x5a4a44 });
    motor.scale.setScalar(0.85);
    onHead(motor, flatCap(0x2f5a44), 0.34);
    motor.position.set(2.1, 0.62, 0.1);
    motor.rotation.y = Math.PI / 2;
    motor.userData.noFidget = true;
    car.add(motor);
    const reader = buildAnimal('mole', { body: 0x6a5a50 });
    reader.scale.setScalar(0.8);
    reader.position.set(-1.7, 0.75, -0.55);
    reader.userData.noFidget = true;
    const paper = sign('DAILY\nDIRT', 0.5, 0.6, '#f3efe2', '#2e2a26');
    paper.position.set(0, 1.1, 0.75);
    reader.add(paper);
    car.add(reader);
    riders.push(motor, reader);
    car.position.set(O.x + STOPS[0].x, 0, O.z + TRACK_Z);
    group.add(car);
  }

  // the timetable: shuttle Works → Loam St → Uptown → Loam St → …, a short
  // dwell at each; ring the bell and it comes to you; board and it takes
  // you straight where you're going
  const line = { x: STOPS[0].x, route: [0, 1, 2, 1], ri: 0, dwell: 4, express: null, rider: null, v: 0, held: false };
  const stopAt = (i) => STOPS[i];
  function nextStopIndex() {
    return line.express ?? line.route[line.ri];
  }
  function docked(i) {
    return line.dwell > 0 && Math.abs(line.x - STOPS[i].x) < 0.3;
  }
  function ding() {
    tone(1318, { dur: 0.12, type: 'sine', vol: 0.05 });
    tone(1318, { dur: 0.16, type: 'sine', vol: 0.05, time: 0.22 });
  }
  STOPS.forEach((st, i) => {
    register({
      pos: new THREE.Vector3(O.x + st.x, 0, O.z + 0.2), r: 3.4, zone: 'burrough', priority: 2,
      enabled: () => !line.rider,
      label: () => (docked(i) ? 'board the Boring Line' : 'ring for the Boring Line'),
      use: async () => {
        if (!docked(i)) {
          line.express = i;
          line.dwell = 0;
          ding();
          ui.toast('Ding ding. The Boring Line is on its way. (It was always on its way.)', '🚋');
          return;
        }
        line.held = true; // the motorman waits while you make up your mind
        const dest = await ui.ask('“Where to?”', [
          ...STOPS.filter((d) => d !== st).map((d) => ({ label: `🚋 ${d.name}`, value: d.name })),
          { label: 'Just looking', value: null },
        ], { speaker: 'the motorman', voice: 250 });
        line.held = false;
        const to = STOPS.findIndex((d) => d.name === dest);
        if (to < 0 || !docked(i)) return;
        line.rider = { to, t: 0 };
        line.express = to;
        line.dwell = 0;
        player.riding = true;
        ding();
        ui.toast(`Next stop: ${STOPS[to].name}. Mind the gap. There is always a gap.`, '🚋');
      },
    });
  });
  updates.push((dt, t) => {
    const target = stopAt(nextStopIndex());
    if (line.dwell > 0) {
      if (!line.held) line.dwell -= dt;
      line.v = 0;
    } else {
      const d = target.x - line.x;
      // somebody on the track ahead? the car waits, and says so
      const pp = player.group.position;
      const ahead = (pp.x - car.position.x) * Math.sign(d);
      if (!line.rider && Math.abs(pp.z - (O.z + TRACK_Z)) < 1.5 && ahead > 0 && ahead < 4.2) {
        line.v = 0;
        line.waitDing = (line.waitDing ?? 0) - dt;
        if (line.waitDing <= 0) { ding(); line.waitDing = 2.5; }
        return;
      }
      const want = Math.sign(d) * Math.min(6, 0.5 + Math.abs(d) * 0.8);
      line.v += (want - line.v) * Math.min(1, dt * 1.5);
      line.x += line.v * dt;
      if (Math.abs(d) < 0.12) {
        line.x = target.x;
        line.v = 0;
        line.dwell = 5;
        ding();
        if (line.express !== null) {
          // pick the timetable back up from wherever the express left it
          const ri = line.route.indexOf(line.express);
          line.ri = (ri + 1) % line.route.length;
          line.express = null;
        } else line.ri = (line.ri + 1) % line.route.length;
        if (line.rider) {
          player.riding = false;
          player.group.position.set(O.x + target.x + 1.2, PLAT.h, O.z + 0.4);
          player.group.rotation.y = 0;
          line.rider = null;
        }
      }
    }
    car.position.set(O.x + line.x, 0, O.z + TRACK_Z);
    car.position.y = Math.abs(line.v) > 0.5 ? Math.sin(t * 14) * 0.015 : 0;
    car.userData.spark.visible = Math.abs(line.v) > 1 && Math.sin(t * 23) > 0.6;
    for (const st of STOPS) st.bell.rotation.z = docked(STOPS.indexOf(st)) ? Math.sin(t * 9) * 0.2 : 0;
    if (line.rider) {
      player.group.position.set(car.position.x + 0.3, car.position.y + 0.68, car.position.z + 0.15);
      player.group.rotation.y = line.v >= 0 ? Math.PI / 2 : -Math.PI / 2;
    }
    riders[0].rotation.y = line.v < -0.1 ? -Math.PI / 2 : Math.PI / 2;
    riders[0].position.x = line.v < -0.1 ? -2.1 : 2.1;
  });

  // ============================================================ THE WORKS ----
  frontage({ x: -54, z: -8.6, w: 8, h: 5.2, color: 0x7a5238, trim: 0xf2cf5b, name: 'BORING DEPT. · LOCAL 1', sub: 'we dig it · since forever', signBg: '#2e2a26', signFg: '#f2cf5b', cols: 3 });
  {
    // the union banner, and hard hats on hooks by the door
    const banner = sign('15 MINUTES\nFOR EVERY MOLE', 1.6, 0.9, '#b8433a', '#fff3d6');
    banner.position.set(O.x - 57.2, at(-57, -8.4) + 2.9, O.z - 8.46);
    group.add(banner);
    for (let k = 0; k < 4; k++) {
      const hat = hardHat();
      hat.scale.setScalar(0.7);
      put(hat, -51.9 + (k % 2) * 0.5, -8.35, 1.6 + Math.floor(k / 2) * 0.5);
    }
  }
  // the punch clock
  {
    const g = new THREE.Group();
    const post = box(0.12, 1.2, 0.12, 0x3a3430);
    post.position.y = 0.6;
    const clock = box(0.6, 0.8, 0.35, 0xb8b0a0);
    clock.position.y = 1.5;
    const face = new THREE.Mesh(new THREE.CircleGeometry(0.2, 12), mat(0xfff8ec));
    face.position.set(0, 1.62, 0.18);
    const slot = box(0.3, 0.05, 0.05, 0x2a2420);
    slot.position.set(0, 1.28, 0.18);
    g.add(post, clock, face, slot);
    put(g, -48.8, -7.4);
    block(-48.8, -7.4, 0.35);
    register({
      pos: new THREE.Vector3(O.x - 48.8, 0, O.z - 6.6), r: 1.4, zone: 'burrough', priority: 2,
      label: 'punch the clock',
      use: () => {
        thud();
        ui.say(S.hasFlag('punchedBurrough')
          ? 'Ka-CHUNK. Another card: VISITOR — ON THE CLOCK. You are still not employed here. The clock still doesn’t mind.'
          : 'Ka-CHUNK. The card comes out stamped VISITOR — ON THE CLOCK. Nobody is paying you. The clock doesn’t mind.');
        S.setFlag('punchedBurrough');
      },
    });
  }
  // Bertha, shop steward
  {
    const b = buildAnimal('mole', { body: 0x4e4038 });
    onHead(b, hardHat(), 0.3);
    stand(b, -50.2, -6.6, -0.3);
    b.userData.fidget = true;
    talker(() => b.position, 'Bertha', 230, [
      'Bertha. Shop steward, Boring Department, Local 1. If you’re management, I’m on my break. If you’re not, I’m also on my break.',
      'We dug the Boring Line in one night. The paperwork took eleven years. We’re proud of both.',
      'Half the Department commutes up to the Labs. They hired us for the listening wells. Nobody hears through rock like a mole.',
      'Wendell? On his fifteen. Wendell’s been on his fifteen since spring. We don’t check. That’s solidarity.',
      'Punch the clock if you like. It doesn’t pay. It just likes to be punched. Morale thing.',
    ]);
  }
  // the Visitors' Bureau: mole tourism is the Burrough's fastest-growing industry
  {
    const g = new THREE.Group();
    const counter = box(2.8, 1.0, 1.0, 0x9a6a44);
    counter.position.y = 0.5;
    const top = box(3.0, 0.1, 1.2, 0xe8dcc0);
    top.position.y = 1.05;
    const roof = box(3.2, 0.14, 1.9, 0x3f7a5a);
    roof.position.set(0, 2.55, -0.35);
    g.add(counter, top, roof);
    for (const sx of [-1.45, 1.45]) {
      const post = box(0.1, 1.5, 0.1, 0xe8dcc0);
      post.position.set(sx, 1.8, 0.4);
      g.add(post);
    }
    const s = sign('VISITORS’ BUREAU\nmaps · dirt globes · directions (down)', 2.8, 0.6, '#3f7a5a', '#f3e6c8');
    s.position.set(0, 2.2, 0.47);
    g.add(s);
    // a rack of dirt globes on the counter
    for (let k = 0; k < 3; k++) {
      const glass = new THREE.Mesh(new THREE.IcosahedronGeometry(0.14, 1), new THREE.MeshStandardMaterial({ color: 0xdff0ff, transparent: true, opacity: 0.5, roughness: 0.1 }));
      glass.position.set(-0.9 + k * 0.35, 1.26, 0.2);
      const baseG = box(0.2, 0.08, 0.2, 0x6a4a30);
      baseG.position.set(-0.9 + k * 0.35, 1.14, 0.2);
      g.add(glass, baseG);
    }
    put(g, -61.2, -8.2);
    blockBox(-62.7, -9.8, -59.7, -7.6);
    const tup = buildAnimal('hamster', { body: 0xe0a060 });
    stand(tup, -61.2, -8.9, 0, 0);
    tup.userData.fidget = true;
    const SOUVENIRS = [{ id: 'dirt_globe', price: 120 }, { id: 'daily_dirt', price: 2 }];
    const talk = [
      'Welcome to the Burrough! Population: lots! Things to do: plenty! Sky: no!',
      'Top attractions: the Boring Line, Loam Street, the Institute (look, don’t knock), and Uptown, where the rich moles don’t live anymore.',
      'First time down? Everybody holds their head up the first day. You’ll get over it.',
    ];
    let k = 0;
    register({
      pos: new THREE.Vector3(O.x - 61.2, 0, O.z - 6.8), r: 1.9, zone: 'burrough',
      label: 'visit the Visitors’ Bureau',
      use: async () => {
        const picked = await ui.ask(talk[k++ % talk.length], [
          ...SOUVENIRS.map((m) => ({
            label: `${ITEMS[m.id].emoji} ${ITEMS[m.id].name}`, value: m.id, hint: `${m.price}🔘`,
            disabled: S.state.buttons < m.price,
          })),
          { label: 'Just visiting', value: null },
        ], { speaker: 'Tuppence', voice: 640 });
        const m = SOUVENIRS.find((x) => x.id === picked);
        if (!m) return;
        S.spend(m.price);
        S.addItem(m.id);
        kaching();
        ui.updateHUD();
        ui.toast(`You bought <b>${ITEMS[m.id].name}</b>.`, ITEMS[m.id].emoji);
        ui.say(m.id === 'dirt_globe'
          ? 'Shake it! It settles! It always settles! That’s the Burrough for you!'
          : 'Fresh this morning! Well. This morning’s. It’s the hot worm story again.', { speaker: 'Tuppence', voice: 640 });
      },
    });
  }
  // the tunnel face, west: the Line is extending. soon.
  {
    const drill = new THREE.Group();
    const bodyD = box(2.2, 1.6, 1.8, 0xd8a03a);
    bodyD.position.y = 1.0;
    const bit = new THREE.Mesh(new THREE.ConeGeometry(0.8, 1.6, 7), mat(0x9a9a9a, 0.35));
    bit.rotation.z = Math.PI / 2;
    bit.position.set(-1.9, 1.0, 0);
    drill.add(bodyD, bit);
    for (const sz of [-0.9, 0.9]) {
      const tread = box(2.4, 0.5, 0.35, 0x3a3a3a);
      tread.position.set(0, 0.25, sz);
      drill.add(tread);
    }
    put(drill, -76.5, 1.4);
    blockBox(-79, 0.3, -75.3, 2.5);
    updates.push((dt, t) => { bit.rotation.x = t * 0.6; });
    const s = sign('BORING LINE EXTENSION\nWEST · COMING SOON', 2.2, 0.7, '#f2cf5b', '#2e2a26');
    s.position.set(O.x - 73.5, 2.0, O.z - 3.3);
    group.add(s);
    const auger = buildAnimal('mole', { body: 0x5a4a44 });
    onHead(auger, hardHat(), 0.3);
    stand(auger, -74.2, -0.6, -1.2);
    talker(() => auger.position, 'Auger', 270, [
      'Extension. Going west. Coming soon.',
      'How soon? In the Department we say “soon” the way you say “eventually.” It’s a comfort word.',
      'Where does it go? West. That’s the plan. The whole plan is West. We’ll know it when we hit it.',
      'Some nights, on the heavy tides, you can hear the bell through the face here. Nice sound. Keeps time.',
    ]);
  }
  // welcome, painted on the wall by the Labs ladder
  {
    const s = sign('WELCOME TO THE BURROUGH\npop. lots', 3.4, 1.0, '#e8dcc0', '#5a3a24', { border: '#5a3a24' });
    s.position.set(O.x - 68.3, at(-68.3, -8) + 2.6, O.z - 8.4);
    s.rotation.y = 0.55;
    group.add(s);
  }
  lamp(-58, -5.2);
  lamp(-44, -5.2);
  lamp(-66, 2.6);

  // =============================================== THE INSTITUTE FOR DEEP STUDY ----
  {
    // the gateposts at the foot of the lane, and the plaque
    for (const gx of [-49.6, -44.3]) {
      const p = box(0.7, 1.6, 0.7, 0xb8ad98);
      put(p, gx, -13.4, 0);
      p.position.y = at(gx, -13.4) + 0.8;
      const cap = new THREE.Mesh(new THREE.IcosahedronGeometry(0.32, 0), mat(0xd8cdb8));
      put(cap, gx, -13.4, 1.8);
      block(gx, -13.4, 0.5);
    }
    const plaque = sign('THE INSTITUTE\nFOR DEEP STUDY\nno students · no classes · no hurry', 1.5, 0.9, '#2e2a26', '#e8d49a', { border: '#c9a24a' });
    plaque.position.set(O.x - 49.6, at(-49.6, -13.4) + 1.0, O.z - 13.03);
    group.add(plaque);
  }
  // Mould Hall: red brick, white trim, a cupola with a clock nobody winds
  frontage({ x: -46, z: -33.3, w: 11, h: 5.6, color: 0x9a4a3a, trim: 0xf3efe2, name: 'MOULD HALL', signBg: '#f3efe2', signFg: '#6a2a20', rows: 2, cols: 5, doorColor: 0x2e3e2e });
  {
    const cup = new THREE.Group();
    const drum = box(1.6, 1.3, 1.6, 0xf3efe2);
    drum.position.y = 0.65;
    const roof = new THREE.Mesh(new THREE.ConeGeometry(1.25, 1.2, 4), mat(0x4a6a5a));
    roof.rotation.y = Math.PI / 4;
    roof.position.y = 1.9;
    const face = new THREE.Mesh(new THREE.CircleGeometry(0.42, 12), mat(0xfff8ec));
    face.position.set(0, 0.7, 0.81);
    const hand = box(0.04, 0.34, 0.02, 0x2a2420);
    hand.position.set(0, 0.82, 0.83);
    const hand2 = box(0.25, 0.04, 0.02, 0x2a2420);
    hand2.position.set(0.1, 0.7, 0.83);
    cup.add(drum, roof, face, hand, hand2);
    put(cup, -46, -35.8, 5.6);
  }
  // the blackboard
  {
    const g = new THREE.Group();
    const board = box(2.6, 1.6, 0.08, 0x2e3a32);
    board.position.y = 1.5;
    const frame = box(2.8, 1.8, 0.05, 0x8a6a44);
    frame.position.set(0, 1.5, -0.05);
    g.add(board, frame);
    for (const sx of [-1.2, 1.2]) {
      const leg = box(0.08, 1.4, 0.08, 0x8a6a44);
      leg.position.set(sx, 0.7, -0.05);
      g.add(leg);
    }
    const chalk = sign('THEOREM: this tunnel cannot be\nproved to have an end.\nPROOF: (keep digging)    ∎', 2.4, 1.4, '#2e3a32', '#e8efe8', { weight: 500 });
    chalk.position.set(0, 1.5, 0.05);
    g.add(chalk);
    put(g, -39.5, -30.2);
    blockBox(-41, -30.5, -38, -29.9);
    let k = 0;
    register({
      pos: new THREE.Vector3(O.x - 39.5, 0, O.z - 29), r: 1.8, zone: 'burrough',
      label: 'read the blackboard',
      use: () => ui.say([
        [
          'THEOREM (Mödel): This tunnel cannot be proved to have an end.',
          'PROOF: (keep digging)',
          'And underneath, in a different hand: “See me. —R.”',
        ],
        [
          'A new line since yesterday, very small, in the corner: “Every sufficiently deep burrow contains a room that is not on its own map.”',
          'Someone from the Boring Department has written under it: “WE CHECKED.” Someone else has crossed that out and written: “check again.”',
        ],
      ][k++ % 2]),
    });
  }
  // the mushroom woods around the Institute (the IAS has woods; so do we)
  function mushroom(lx, lz, s = 1, cap = 0xd8b89a) {
    const g = new THREE.Group();
    const stem = new THREE.Mesh(new THREE.CylinderGeometry(0.16 * s, 0.24 * s, 1.6 * s, 6), mat(0xf0e6d2));
    stem.position.y = 0.8 * s;
    const top = new THREE.Mesh(new THREE.SphereGeometry(0.9 * s, 8, 4, 0, Math.PI * 2, 0, Math.PI / 2), mat(cap));
    top.scale.y = 0.6;
    top.position.y = 1.55 * s;
    g.add(stem, top);
    g.rotation.y = h01() * 6;
    put(g, lx, lz);
    block(lx, lz, 0.3 * s);
    return g;
  }
  {
    const CAPS = [0xd8b89a, 0xc88a6a, 0xe8d0b0, 0xb87a5a];
    let placed = 0;
    for (let i = 0; i < 400 && placed < 22; i++) {
      const lx = INSTITUTE.x + (h01() - 0.5) * 26, lz = INSTITUTE.z + (h01() - 0.5) * 16;
      const d = sd(lx, lz);
      if (d > -0.8 || d < -3.5) continue;
      if (lz > -26 && Math.abs(lx + 46.5) < 4) continue;          // the lane stays clear
      if (lz < -32.5 && Math.abs(lx + 46) < 6.5) continue;        // Mould Hall's front
      if (Math.abs(lx + 46) < 4.5) continue;                       // and its front walk
      if (Math.abs(lx + 39.5) < 2.8 && Math.abs(lz + 30) < 2.6) continue; // the blackboard
      if (sdSeg(lx, lz, [-37.5, -28.2, -46.6, -23], 1.6) < 0) continue; // Mödel's walk
      if (Math.abs(lx + 51.8) < 2.8 && lz > -32 && lz < -23.5) continue; // tea, and the view of it
      if (solid(lx, lz) || circles.some((c) => Math.hypot(c.x - lx, c.z - lz) < 1.6)) continue;
      mushroom(lx, lz, 0.8 + h01() * 0.9, CAPS[placed % CAPS.length]);
      placed++;
    }
  }
  // Professor Mödel: fedora, round spectacles, a scarf (it is cold; he checked)
  {
    const m = buildAnimal('mole', { body: 0x4a4038 });
    m.scale.setScalar(0.92);
    onHead(m, fedora(0x5a5248), 0.3);
    onHead(m, spectacles(), 0.08, 0.4);
    const scarf = new THREE.Mesh(new THREE.TorusGeometry(0.3, 0.09, 5, 10), mat(0x8a3a3a));
    scarf.rotation.x = Math.PI / 2;
    scarf.position.set(0, 0.95, 0.3);
    m.add(scarf);
    walker(m, [[-42, -28.2], [-37.5, -28.2], [-42, -28.2], [-46.6, -23], [-47, -16], [-46.6, -23]], 0.8, { rest: 2.5, rate: 8 });
    talker(() => m.position, 'Professor Mödel', 210, [
      'Mödel. Professor, the Institute for Deep Study. Forgive me for not shaking hands. It is cold down here. It is always cold. I have checked.',
      'I have proved that in every sufficiently deep burrow there is a tunnel which is true but cannot be dug. The Boring Department took it personally.',
      'I have read the Burrough charter very carefully. There is a flaw in Article Four. Please, do not mention it at my hearing.',
      'In certain solutions to the equations, a mole may tunnel into her own past. I have not tried it. I would only discover that I had been late.',
      'The Institute has no students and no classes. We think. The Labs send down their hardest questions, and we send back better ones. It is a very good arrangement for the questions.',
      'Every day I walk the lane, and back. Somebody I admired very much used to walk it with me. Now I walk it for both of us. It is a short lane. It is enough.',
    ]);
  }
  // Professor Emerita Rosalind: a naked mole rat, tea at four, always four
  {
    const chair = new THREE.Group();
    const seat = box(1.2, 0.5, 1.0, 0x6a3a4a);
    seat.position.y = 0.25;
    const back = box(1.2, 1.1, 0.25, 0x6a3a4a);
    back.position.set(0, 0.8, -0.45);
    for (const sx of [-0.55, 0.55]) {
      const armr = box(0.18, 0.4, 1.0, 0x6a3a4a);
      armr.position.set(sx, 0.6, 0);
      chair.add(armr);
    }
    chair.add(seat, back);
    put(chair, -52.4, -29.6);
    const tea = new THREE.Group();
    const tbl = box(0.7, 0.6, 0.7, 0x8a6a44);
    tbl.position.y = 0.3;
    const pot = new THREE.Mesh(new THREE.IcosahedronGeometry(0.18, 1), mat(0xf3efe2, 0.4));
    pot.position.y = 0.76;
    const cup = new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.06, 0.1, 8), mat(0xf3efe2, 0.4));
    cup.position.set(0.2, 0.66, 0.15);
    tea.add(tbl, pot, cup);
    put(tea, -51.1, -29.4);
    blockBox(-53.1, -30.3, -50.7, -29.0);
    const r = buildAnimal('molerat', { body: 0xf0b8a8 });
    r.scale.setScalar(0.85);
    onHead(r, spectacles(), 0.06, 0.4);
    r.position.set(O.x - 52.4, at(-52.4, -29.6) + 0.18, O.z - 29.5);
    r.userData.noFidget = true;
    group.add(r);
    talker(() => r.position, 'Professor Emerita Rosalind', 380, [
      'Rosalind. Emerita. I have been emerita so long they have run out of cake.',
      'We naked mole rats don’t really get old, dear. We just get more senior. I’ve been senior since the Institute was a hole in the ground. It is still a hole in the ground. A very distinguished one.',
      'Mödel is the finest mind in the Burrough. He also checks my tea before I drink it. Both of those things are love.',
      'Tea is at four. It is always four. Nobody down here has seen the sun, so we picked a nice time and kept it.',
      'The blackboard? I wrote “see me.” He came to see me. We had tea. That’s how you check a proof.',
    ], 2.2);
  }

  // =========================================================== LOAM STREET ----
  // the apartments: four floors of round doors, stacked into the wall
  {
    const APT = { x: -8, z: -10.2, w: 11, h: 9 };
    frontage({ x: APT.x, z: APT.z, w: APT.w, h: APT.h, d: 6, color: 0x8a6448, trim: 0xd8c8a8, name: '', rows: 4, cols: 4, door: true, doorColor: 0x4a3020 });
    const sgn = sign('THE LOAMSWORTH ARMS\nrooms · no view · rent controlled', 3.6, 0.8, '#d8c8a8', '#4a3020');
    sgn.position.set(O.x + APT.x, at(APT.x, APT.z) + 2.55, O.z + APT.z + 0.3);
    group.add(sgn);
    // little balconies, and a fire-escape ladder
    for (let r = 1; r < 4; r++) {
      for (const c of [-1, 1]) {
        const ledge = box(1.3, 0.12, 0.6, 0x5a4230);
        put(ledge, APT.x + c * 4.125, APT.z + 0.3, 1.6 + r * ((APT.h - 0.9 - 1.6) / 3) - 0.6);
      }
    }
    for (let y = 0.5; y < 8.2; y += 0.45) {
      const rung = box(0.5, 0.05, 0.05, 0x3a3430);
      put(rung, APT.x + 5.0, APT.z + 0.35, y);
    }
    for (const sx of [-0.25, 0.25]) {
      const rail = box(0.05, 8, 0.05, 0x3a3430);
      put(rail, APT.x + 5.0 + sx, APT.z + 0.35, 4);
    }
    // laundry lines across the front, from the building to a post
    const COLORS = [0xe8dcc0, 0xb8433a, 0x6a8ab8, 0xf2cf5b, 0x8ab87a, 0xf0b8c8];
    const shirts = [];
    for (const [y, z] of [[5.5, 1.2], [7.2, 0.8]]) {
      const lineM = new THREE.Mesh(new THREE.BoxGeometry(10, 0.02, 0.02), mat(0xe8e0d0));
      lineM.position.set(O.x + APT.x, at(APT.x, APT.z) + y, O.z + APT.z + z);
      group.add(lineM);
      for (let k = 0; k < 7; k++) {
        const shirt = box(0.5 + h01() * 0.3, 0.55 + h01() * 0.3, 0.03, COLORS[(k + Math.round(y)) % COLORS.length]);
        shirt.geometry.translate(0, -0.3, 0);
        shirt.position.set(O.x + APT.x - 4.4 + k * 1.3, at(APT.x, APT.z) + y, O.z + APT.z + z);
        shirt.castShadow = true;
        group.add(shirt);
        shirts.push(shirt);
      }
    }
    updates.push((dt, t) => shirts.forEach((s, i) => { s.rotation.x = Math.sin(t * 0.9 + i) * 0.08; }));
    // Mrs. Loamsworth, leaning out of her second-floor window
    const mrs = buildAnimal('mole', { body: 0x6a5a50 });
    mrs.scale.setScalar(0.75);
    const kerchief = new THREE.Mesh(new THREE.SphereGeometry(0.32, 8, 4, 0, Math.PI * 2, 0, Math.PI / 2), mat(0xb8433a));
    onHead(mrs, kerchief, 0.12);
    const wy = 1.6 + ((APT.h - 0.9 - 1.6) / 3);
    mrs.position.set(O.x + APT.x + 1.5 * (APT.w / 4) - APT.w / 2, at(APT.x, APT.z) + wy - 0.95, O.z + APT.z + 0.1);
    mrs.userData.noFidget = true;
    group.add(mrs);
    updates.push((dt, t, pp) => {
      if (pp) mrs.rotation.y = turnToward(mrs.rotation.y, Math.max(-0.8, Math.min(0.8, Math.atan2(pp.x - mrs.position.x, pp.z - mrs.position.z))), dt, 2);
    });
    let k = 0;
    const lines = [
      'Hello down there! You’re not from the Burrough. You’re holding your head up. Nobody down here holds their head up.',
      'Second floor, no elevator, no view, rent-controlled since the Great Squall. I’m never leaving.',
      'The laundry takes about nine years to dry down here. It’s not about drying. It’s about hanging it out.',
      'That Lowell — nice boy. Legs. Nobody asks. Well, I ask. He says “no comment.” Every time. Very polite about it.',
      'You want to know what goes on in this city? Don’t buy the paper. Just ask me. I’m cheaper and I’m right.',
    ];
    register({
      pos: new THREE.Vector3(mrs.position.x, 0, O.z + APT.z + 1.4), r: 2.2, zone: 'burrough',
      label: 'call up to Mrs. Loamsworth',
      use: () => ui.say(lines[k++ % lines.length], { speaker: 'Mrs. Loamsworth', voice: 330 }),
    });
  }
  // the Daily Dirt
  frontage({ x: 7.5, z: -10.2, w: 7.5, h: 5.6, color: 0x5a4a3e, trim: 0xf3efe2, name: 'THE DAILY DIRT', sub: '“All the News That’s Fit to Dig”', signBg: '#f3efe2', signFg: '#2e2a26', rows: 2, cols: 3 });
  // the front pages, one a day
  const FRONT_PAGES = [
    ['HOT WORM CART “CONTAINS NO WORMS,” VENDOR SAYS', 'Ethics correspondent “not satisfied.” Continued on page 2, page 3, page 4, and page 5.'],
    ['WORM ETHICS: DAY 41', 'Our correspondent files 9,000 words. The vendor files one: “churro.”'],
    ['BORING LINE RUNS ON TIME', 'Management “stunned.” Union “not surprised.” Motorman “would like to be left alone.”'],
    ['INSTITUTE PROFESSOR PROVES SOMETHING', 'Nobody sure what. Professor “satisfied.” Also inside: bell heard again on the heavy tide; residents “not surprised,” “a nice sound.”'],
    ['MOLEDECAIS STILL UPSTAIRS', 'Third Baron running. Burrough “fine about it, honestly.” Doorman keeps door.'],
    ['FORECASTER CALLS FOR SUN; SURFACE ADVISED TO BRING UMBRELLA', 'Marjorie: “Thirty-one years. Never once been right. Plan accordingly.”'],
    ['LEGS: WHOSE?', 'An investigation. Our correspondent declined to be interviewed for it. Our correspondent wrote it.'],
  ];
  const dayIdx = () => Math.floor(Date.now() / 86400000);
  {
    // the newsstand, with the paper in stacks
    const g = new THREE.Group();
    const stand2 = box(1.8, 1.0, 1.0, 0x3f7a5a);
    stand2.position.y = 0.5;
    const roof = box(2.1, 0.1, 1.3, 0x2f5a44);
    roof.position.y = 2.3;
    for (const sx of [-0.85, 0.85]) {
      const post = box(0.08, 1.3, 0.08, 0x2f5a44);
      post.position.set(sx, 1.65, 0.4);
      g.add(post);
    }
    for (let k = 0; k < 3; k++) {
      const stack = box(0.42, 0.14 + k * 0.05, 0.3, 0xf3efe2);
      stack.position.set(-0.55 + k * 0.55, 1.08, 0.15);
      g.add(stack);
    }
    const s = sign('THE DAILY DIRT · 2🔘', 1.8, 0.3, '#f3efe2', '#2e2a26');
    s.position.set(0, 2.05, 0.46);
    g.add(stand2, roof, s);
    put(g, 13.2, -7.2);
    blockBox(12.2, -7.8, 14.2, -6.6);
    register({
      pos: new THREE.Vector3(O.x + 13.2, 0, O.z - 6.0), r: 1.6, zone: 'burrough',
      label: 'read today’s Daily Dirt',
      use: () => {
        const [head, deck] = FRONT_PAGES[dayIdx() % FRONT_PAGES.length];
        ui.say(['THE DAILY DIRT — “All the News That’s Fit to Dig”', head, deck]);
      },
    });
  }
  // Lowell: a worm, with legs, the ethics desk
  {
    const lw = buildAnimal('worm', { body: 0xe89a9a });
    const hat = fedora(0x6a5a48);
    hat.scale.setScalar(0.85);
    const card = sign('PRESS', 0.22, 0.12, '#f3efe2', '#2e2a26');
    card.position.set(0.18, 0.12, 0.22);
    hat.add(card);
    onHead(lw, hat, 0.3);
    const pad = box(0.25, 0.32, 0.04, 0xf3efe2);
    pad.position.set(0.32, 0.75, 1.15);
    pad.rotation.x = -0.4;
    lw.add(pad);
    walker(lw, [[10.6, -6.2], [3.2, -6.2], [10.6, -6.2], [9, -5.2]], 1.3, { rest: 3, rate: 14 });
    talker(() => lw.position, 'Lowell', 470, [
      'Lowell. The Daily Dirt, ethics desk. The ethics desk is me. The desk is also me. I type lying down.',
      '“Hot worms.” HOT. WORMS. I’m not accusing anybody. I’m asking questions. Every day. Of the same hamster.',
      'Nibs says they’re churros. I’ve eaten one. For journalism. It was a very good churro. That’s what worries me.',
      'The legs? No comment. I’m the one asking the questions here.',
      'Six. Fine. It’s six. Still no comment.',
    ]);
  }
  // Nibs and the hot worm cart (contains no worms)
  {
    const g = new THREE.Group();
    const cart = box(1.6, 0.8, 0.9, 0xb8433a);
    cart.position.y = 0.75;
    const top = box(1.7, 0.08, 1.0, 0xe8dcc0);
    top.position.y = 1.19;
    g.add(cart, top);
    for (const sx of [-0.55, 0.55]) {
      const wheel = new THREE.Mesh(new THREE.CylinderGeometry(0.3, 0.3, 0.08, 10), mat(0x3a3430));
      wheel.rotation.x = Math.PI / 2;
      wheel.position.set(sx, 0.3, 0.48);
      g.add(wheel);
    }
    const pole = box(0.06, 1.6, 0.06, 0xe8dcc0);
    pole.position.set(0, 2.0, 0);
    const umb = new THREE.Mesh(new THREE.ConeGeometry(1.2, 0.5, 8), mat(0xf2cf5b));
    umb.position.set(0, 2.9, 0);
    const umb2 = new THREE.Mesh(new THREE.ConeGeometry(1.21, 0.5, 8, 1, true, 0, Math.PI / 4), mat(0xb8433a));
    umb2.position.set(0, 2.9, 0);
    g.add(pole, umb, umb2);
    // a tray of hot worms (churros), steaming
    for (let k = 0; k < 5; k++) {
      const churro = new THREE.Mesh(new THREE.CapsuleGeometry(0.035, 0.34, 2, 5), mat(0xd8a050));
      churro.rotation.z = Math.PI / 2 + (k - 2) * 0.1;
      churro.position.set(-0.35 + k * 0.12, 1.27, 0.1);
      g.add(churro);
    }
    const s = sign('HOT WORMS 8🔘\n(contains no worms)', 1.5, 0.5, '#f3e6c8', '#b8433a');
    s.position.set(0, 0.85, 0.46);
    g.add(s);
    put(g, 0.5, -6.4);
    blockBox(-0.4, -6.95, 1.4, -5.85);
    const nibs = buildAnimal('hamster', { body: 0xc88a50, belly: 0xf8f0e0 });
    const cap = flatCap(0xe8dcc0);
    onHead(nibs, cap, 0.34);
    stand(nibs, 2.0, -6.7, -0.4);
    nibs.userData.fidget = true;
    const lines = [
      'Hot worms! Hot worms here! Contains NO worms! Never has! It says so on the cart in two places!',
      'It’s a churro. Fried dough, cinnamon, the long wiggly shape. My grandmother called them hot worms and my grandmother was a hamster of vision.',
      'Lowell comes by every morning with the notebook. I give him a hot worm. He writes it down. He eats it. We have a system.',
    ];
    let k = 0;
    register({
      getPos: () => nibs.position, r: 2.2, zone: 'burrough',
      label: 'talk to Nibs',
      use: async () => {
        const choice = await ui.ask(lines[k++ % lines.length], [
          { label: '🥖 One hot worm, please', value: 'buy', hint: '8🔘', disabled: S.state.buttons < 8 },
          { label: 'Just looking', value: null },
        ], { speaker: 'Nibs', voice: 620 });
        if (choice !== 'buy' || !S.spend(8)) return;
        kaching();
        ui.updateHUD();
        ui.toast('A hot worm: warm, cinnamony, and — you check — completely wormless.', '🥖');
      },
    });
  }
  // Thelonious Mole, on the corner, with his hat out
  {
    const th = buildAnimal('mole', { body: 0x524640 });
    onHead(th, beret(0x2a2a3a), 0.33);
    const shades = spectacles();
    shades.children.forEach((c) => { c.material = mat(0x1a1a1a, 0.2); });
    for (const sx of [-0.12, 0.12]) {
      const lens = new THREE.Mesh(new THREE.CircleGeometry(0.07, 8), mat(0x1a1a1a, 0.2));
      lens.position.set(sx, 0, 0.005);
      shades.add(lens);
    }
    onHead(th, shades, 0.08, 0.4);
    // the saxophone: a brass crook, body, and bell
    const sax = new THREE.Group();
    const brass = mat(0xd8a83a, 0.3);
    const tube = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.09, 0.7, 7), brass);
    const bell = new THREE.Mesh(new THREE.CylinderGeometry(0.18, 0.09, 0.22, 8, 1, true), brass);
    bell.material.side = THREE.DoubleSide;
    bell.position.set(0, -0.38, 0.1);
    bell.rotation.x = -0.9;
    sax.add(tube, bell);
    sax.position.set(0.12, 0.85, 0.55);
    sax.rotation.x = 0.35;
    th.add(sax);
    stand(th, -14.5, -6.2, 0.35);
    th.userData.noFidget = true;
    const hat = fedora(0x2a2a3a);
    hat.rotation.x = Math.PI; // upside down, for buttons
    put(hat, -13.4, -5.1, 0.28);
    const coins = [];
    for (let k = 0; k < 6; k++) {
      const coin = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.05, 0.02, 8), mat(0xd8b85a, 0.3));
      coin.position.set(O.x - 13.4 + (h01() - 0.5) * 0.2, at(-13.4, -5.1) + 0.12, O.z - 5.1 + (h01() - 0.5) * 0.2);
      coin.visible = k < 3;
      group.add(coin);
      coins.push(coin);
    }
    updates.push((dt, t) => {
      // he sways; the horn swings with him
      th.rotation.z = Math.sin(t * 2.2) * 0.06;
      sax.rotation.x = 0.35 + Math.sin(t * 2.2 + 0.5) * 0.1;
      th.userData.parts.head.rotation.x = Math.sin(t * 4.4) * 0.05;
      const tips = Math.min(6, 3 + (S.state.flags.burroughTips || 0));
      coins.forEach((c, i) => { c.visible = i < tips; });
    });
    const lines = [
      'Evening. It’s always evening down here. That’s why the music’s good.',
      'The hat takes buttons. The hat also takes requests. I don’t. But the hat does.',
      'Streetcar comes by every few minutes. Ding ding. I play in the key of the trolley bell. The other bell’s none of my business.',
    ];
    let k = 0;
    register({
      getPos: () => th.position, r: 2.6, zone: 'burrough',
      label: 'listen to Thelonious Mole',
      use: async () => {
        const choice = await ui.ask(lines[k++ % lines.length], [
          { label: '🔘 Drop a button in the hat', value: 'tip', hint: '5🔘', disabled: S.state.buttons < 5 },
          { label: 'Just listen', value: null },
        ], { speaker: 'Thelonious Mole', voice: 200 });
        if (choice !== 'tip' || !S.spend(5)) return;
        S.state.flags.burroughTips = (S.state.flags.burroughTips || 0) + 1;
        S.save();
        jingle();
        ui.updateHUD();
        playSong('mind_the_gap', true);
        ui.say('Thank you kindly. This one’s called “Mind the Gap.”', { speaker: 'Thelonious Mole', voice: 200 });
      },
    });
  }
  // Marjorie, forecasting the surface weather from a soapbox. never right.
  {
    const crate = box(1.1, 0.5, 0.8, 0x9a7a50);
    put(crate, -6.5, 3.2, 0.25);
    block(-6.5, 3.2, 0.7);
    const s = sign('SURFACE FORECAST', 1.1, 0.24, '#f3e6c8', '#3a2a1c');
    s.position.set(O.x - 6.5, 0.26, O.z + 3.61);
    group.add(s);
    const mj = buildAnimal('groundhog', { body: 0x8a6440, head: 0x8a6440 });
    const hat = flatCap(0x6a8ab8);
    onHead(mj, hat, 0.32);
    mj.position.set(O.x - 6.5, at(-6.5, 3.2) + 0.5, O.z + 3.2);
    mj.rotation.y = Math.PI * 0.9;
    mj.userData.fidget = true;
    group.add(mj);
    // she faces the street, and the street is north
    updates.push((dt, t, pp) => {
      if (pp) mj.rotation.y = turnToward(mj.rotation.y, Math.atan2(pp.x - mj.position.x, pp.z - mj.position.z), dt, 3);
    });
    const FORECAST = {
      clear: 'Rain up on the surface today. Heavy. Take a coat, an umbrella, and a second umbrella for the first umbrella.',
      rain: 'Sunshine up top today! Not a cloud! Leave the umbrella, you won’t need it. I’d stake my reputation on it.',
      snow: 'Warm on the surface today. Beach weather. Sandals. I can feel it in my whiskers.',
      fog: 'Crystal clear up top today. You’ll see for miles. Miles!',
    };
    let k = 0;
    register({
      getPos: () => mj.position, r: 2.4, zone: 'burrough',
      label: 'hear the surface forecast',
      use: () => {
        const wx = currentWeather();
        const say = [
          FORECAST[wx] || FORECAST.clear,
          'Thirty-one years. Never once been right. You know what that makes me? Consistent. You can plan around me.',
          'I see my shadow every morning. There’s a lamp right there. It means six more weeks of whatever’s up there.',
        ][k++ % 3];
        ui.say(say, { speaker: 'Marjorie', voice: 300 });
      },
    });
  }
  // Burrough Electric: Spoke, in the wheel, powering every lamp in Midtown
  {
    const g = new THREE.Group();
    const R = 1.5;
    const frameM = mat(0x3a3430);
    for (const sx of [-0.55, 0.55]) {
      const leg = box(0.12, 2.2, 0.12, 0x3a3430);
      leg.position.set(0, 1.1, sx);
      g.add(leg);
    }
    const wheel = new THREE.Group();
    for (const sz of [-0.45, 0.45]) {
      const rim = new THREE.Mesh(new THREE.TorusGeometry(R, 0.06, 4, 16), frameM);
      rim.position.z = sz;
      wheel.add(rim);
    }
    for (let k = 0; k < 14; k++) {
      const a = (k / 14) * Math.PI * 2;
      const rung = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.03, 0.9, 4), mat(0xc9a24a, 0.4));
      rung.rotation.x = Math.PI / 2;
      rung.position.set(Math.cos(a) * R, Math.sin(a) * R, 0);
      wheel.add(rung);
    }
    wheel.position.y = 2.0;
    wheel.rotation.y = 0;
    g.add(wheel);
    const s = sign('BURROUGH ELECTRIC CO.\n“every lamp in Midtown”', 1.8, 0.55, '#2e2a26', '#f2cf5b');
    s.position.set(0, 0.55, 0.62);
    g.add(s);
    put(g, 16.2, -8.4);
    g.rotation.y = 0.25;
    blockBox(14.4, -9.2, 18.0, -7.6);
    const spoke = buildAnimal('hamster', { body: 0xe8d0a8, belly: 0xfff8ec });
    spoke.position.set(0, 0, 0);
    spoke.rotation.y = Math.PI / 2;
    const holder = new THREE.Group();
    holder.position.set(O.x + 16.2, at(16.2, -8.4) + 0.5, O.z - 8.4);
    holder.rotation.y = 0.25;
    holder.add(spoke);
    group.add(holder);
    updates.push((dt, t) => {
      wheel.rotation.z -= dt * 2.6;
      animateGait(spoke, t, 1, 16);
      const flick = 0.95 + Math.sin(t * 2.6 * 7) * 0.08;
      for (const b of lampBulbs) b.material.emissiveIntensity = 1.1 * flick;
    });
    talker(() => holder.position, 'Spoke', 700, [
      'Burrough Electric! Every lamp in Midtown! Just me! I don’t get tired! I’ve never been tired! I’ve tried!',
      'If the lamps flicker, that’s me waving.',
      'Management keeps offering me a second hamster. I say what for. Then I think about it for a lap. Then another lap.',
    ], 2.8);
  }
  lamp(-12, -8.4);
  lamp(4, -7.8);
  lamp(19.5, -5);
  lamp(-18, -5);
  lamp(8, 4.8);

  // ================================================================ UPTOWN ----
  frontage({ x: 55.5, z: -9.2, w: 9, h: 6.6, color: 0x6b4a3a, trim: 0xe8dcc0, name: 'THE MOLEDECAI', sub: 'est. before the Squall', signBg: '#2e3a2a', signFg: '#e8d49a', rows: 3, cols: 4, doorColor: 0x2e3a2a });
  {
    // the stoop: three steps up to the door, with railings
    for (let s = 0; s < 3; s++) {
      const step = box(2.2 - s * 0.1, 0.15, 0.4, 0xb8ad98);
      put(step, 55.5, -8.0 + s * -0.35, 0.08 + s * 0.15);
      step.position.y = 0.075 + s * 0.15;
    }
    for (const sx of [-1.15, 1.15]) {
      const rail = box(0.06, 0.06, 1.3, 0x2a2a2a);
      put(rail, 55.5 + sx, -8.4, 0.95);
      rail.rotation.x = 0.35;
      const newel = box(0.1, 0.9, 0.1, 0x2a2a2a);
      put(newel, 55.5 + sx, -7.8, 0.45);
    }
    blockBox(54.2, -9.2, 56.8, -7.6);
    // brass lamps either side of the door
    for (const sx of [-1.8, 1.8]) {
      const lampB = new THREE.Mesh(new THREE.IcosahedronGeometry(0.18, 0), glow(0xffd98a, 1.0));
      lampB.position.set(O.x + 55.5 + sx, at(55.5, -9) + 2.1, O.z - 9.0);
      group.add(lampB);
    }
    const fitz = buildAnimal('mole', { body: 0x524640 });
    const coat = new THREE.Mesh(new THREE.IcosahedronGeometry(0.52, 1), mat(0x2e3a2a));
    coat.scale.set(1.06, 0.95, 1.2);
    coat.position.y = 0.62;
    fitz.add(coat);
    for (let k = 0; k < 3; k++) {
      const btn = new THREE.Mesh(new THREE.IcosahedronGeometry(0.04, 0), mat(0xc9a24a, 0.3));
      btn.position.set(0, 0.45 + k * 0.17, 0.6);
      fitz.add(btn);
    }
    onHead(fitz, flatCap(0x2e3a2a), 0.34);
    stand(fitz, 57.6, -7.7, 0.2);
    fitz.userData.fidget = true;
    talker(() => fitz.position, 'Fitzgerald', 240, [
      'Good evening. You’re not on the list. Nobody is on the list. I keep it anyway. It is a very good list.',
      'The Moledecai. Finest address in the Burrough. The family went upstairs three Barons ago. I have kept the door since.',
      'The grandfather made his fortune up there, billing by the hour. Down here we hear the bell on the heavy tides, you know. Through the rock. Nobody up there ever asked us.',
      'The Baron sends a card every winter. It says “Keep the door.” So I keep the door.',
      'The pups visit, sometimes, through the cellar. They run up and down the stoop eleven times and go home. It is the highlight of my year.',
    ]);
  }
  // Central Mulch: three mushrooms, a moss lawn, a bench
  {
    const moss = new THREE.Mesh(new THREE.CylinderGeometry(3.2, 3.4, 0.08, 10), mat(0x5f7a3a));
    put(moss, 44.5, -7.6, 0.02);
    moss.castShadow = false;
    mushroom(42.4, -9.2, 1.5, 0xc88a6a);
    mushroom(46.6, -9.6, 1.2, 0xe8d0b0);
    mushroom(44.2, -10.4, 1.8, 0xd8b89a);
    const bench = new THREE.Group();
    const seat = box(1.8, 0.1, 0.5, 0x6a4a30);
    seat.position.y = 0.45;
    const back = box(1.8, 0.45, 0.08, 0x6a4a30);
    back.position.set(0, 0.75, -0.22);
    bench.add(seat, back);
    for (const sx of [-0.8, 0.8]) {
      const leg = box(0.08, 0.45, 0.45, 0x2a2a2a);
      leg.position.set(sx, 0.22, 0);
      bench.add(leg);
    }
    put(bench, 44.5, -6.8);
    blockBox(43.5, -7.2, 45.5, -6.5);
    const s = sign('CENTRAL MULCH\nplease stay on the moss', 1.6, 0.55, '#2e3a2a', '#e8d49a');
    const post = box(0.08, 1.2, 0.08, 0x2a2a2a);
    put(post, 41.0, -6.0, 0.6);
    s.position.set(O.x + 41.0, at(41, -6) + 1.4, O.z - 5.95);
    group.add(s);
    block(41.0, -6.0, 0.2);
    // on the bench: a retired groundhog, feeding the beetles
    const old = buildAnimal('groundhog', { body: 0x9a8a78, head: 0x9a8a78, belly: 0xd8ccbc });
    old.scale.setScalar(0.9);
    old.position.set(O.x + 44.9, at(44.9, -6.8) + 0.2, O.z - 6.85);
    old.userData.noFidget = true;
    group.add(old);
    const beetles = [];
    for (let k = 0; k < 4; k++) {
      const b = new THREE.Mesh(new THREE.IcosahedronGeometry(0.09, 0), glow(0x3a6a8a, 0.15));
      b.scale.set(1, 0.6, 1.3);
      group.add(b);
      beetles.push({ m: b, a: h01() * 6, r: 0.8 + h01() * 0.8 });
    }
    updates.push((dt, t) => {
      for (const b of beetles) {
        b.a += dt * 0.5;
        const x = 44.9 + Math.cos(b.a) * b.r, z = -5.4 + Math.sin(b.a) * b.r * 0.5;
        b.m.position.set(O.x + x, at(x, z) + 0.06, O.z + z);
        b.m.rotation.y = -b.a;
      }
    });
    talker(() => old.position, 'Mr. Hollis', 200, [
      'The beetles know me. Forty years on this bench. They don’t know my name. They know the crumbs.',
      'Uptown used to be the Moledecais and nobody else. Now it’s the Moledecais’ building, and everybody else. Better this way.',
      'I was a forecaster once. Before Marjorie. I was right every time. Nobody came to hear me. You want to be loved, be wrong with confidence.',
    ], 2.4);
  }
  lamp(48, -4.8);
  lamp(61, -4.8);
  lamp(52, 3.4);

  // the tunnels between: a few signs, so nobody gets lost (everybody gets lost)
  {
    const tsign = (lx, text) => {
      const s = sign(text, 2.4, 0.6, '#2f5a44', '#f3e6c8', { border: '#e8d49a' });
      s.position.set(O.x + lx, at(lx, -4) + 2.6, O.z - 3.9);
      group.add(s);
    };
    tsign(-30, '← THE WORKS · LOAM ST →');
    tsign(30, '← LOAM ST · UPTOWN →');
    tsign(-25, 'MIND THE GAP\n(there is always a gap)');
  }

  // the sun down here is the city's own lamplight; its shadow box follows you
  const refs = zones.lightingRefs();
  updates.push((dt, t, pp) => {
    if (!pp || !refs.sun) return;
    refs.sun.position.set(pp.x - 20, 60, pp.z + 30);
    refs.sun.target.position.set(pp.x, 0, pp.z);
  });

  function update(dt, t, playerPos) {
    for (const u of updates) u(dt, t, playerPos);
  }
  return { group, update };
}

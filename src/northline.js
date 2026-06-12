// The Grove Line: a second steam railway, green where the strait line is
// red, running straight from Notbell's southeast shore to Grove Isle's
// panhandle on wooden trestles. Two stations, one patient little engine.

import * as THREE from 'three';
import { ISLAND5, ISLAND5_HAND, terrainHeight, WATER_Y } from './terrain.js';
import * as zones from './zones.js';
import { register } from './interact.js';
import * as ui from './ui.js';
import { tone } from './audio.js';
import { rand } from './utils.js';

function mat(color, rough = 0.85) {
  return new THREE.MeshStandardMaterial({ color, flatShading: true, roughness: rough });
}

function box(w, h, d, color) {
  const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat(color));
  m.castShadow = true;
  return m;
}

function marchToWater(from, toward, start = 2) {
  const dx = toward.x - from.x, dz = toward.z - from.z;
  const len = Math.hypot(dx, dz);
  const ux = dx / len, uz = dz / len;
  let t = start;
  while (terrainHeight(from.x + ux * (t + 0.5), from.z + uz * (t + 0.5)) >= 0.2) t += 0.5;
  return { x: from.x + ux * (t - 2), z: from.z + uz * (t - 2) };
}

export function createNorthline(player) {
  const group = new THREE.Group();

  // ----- the route: Notbell's SE shore, hopping BOTH panhandle islets,
  // landing on Grove Isle proper — supports on every stepping stone
  const H1 = ISLAND5_HAND[1]; // nearer islet
  const H0 = ISLAND5_HAND[0]; // farther islet
  const N = marchToWater({ x: 0, z: 0 }, H1, 20);             // Notbell SE shore
  const G = marchToWater(ISLAND5, H0, 4);                      // Grove main shore
  const PTS = [N, { x: H1.x, z: H1.z }, { x: H0.x, z: H0.z }, G];
  const segLens = [];
  let TOTAL = 0;
  for (let i = 0; i < PTS.length - 1; i++) {
    const l = Math.hypot(PTS[i + 1].x - PTS[i].x, PTS[i + 1].z - PTS[i].z);
    segLens.push(l);
    TOTAL += l;
  }
  const STOPS = [
    { s: 0, name: 'Notbell', toward: { x: 0, z: 0 }, p: N },
    { s: 1, name: 'Grove Isle', toward: { x: ISLAND5.x, z: ISLAND5.z }, p: G },
  ];

  function pointAt(s) {
    let d = s * TOTAL;
    for (let i = 0; i < segLens.length; i++) {
      if (d <= segLens[i] || i === segLens.length - 1) {
        const k = Math.min(1, d / segLens[i]);
        return {
          x: PTS[i].x + (PTS[i + 1].x - PTS[i].x) * k,
          z: PTS[i].z + (PTS[i + 1].z - PTS[i].z) * k,
          seg: i, k,
        };
      }
      d -= segLens[i];
    }
    return { ...PTS[PTS.length - 1], seg: segLens.length - 1, k: 1 };
  }

  const endY = PTS.map((p) => Math.max(terrainHeight(p.x, p.z), WATER_Y) + 1.0);

  function railHeight(s) {
    const { seg, k, x, z } = pointAt(s);
    const y0 = endY[seg], y1 = endY[seg + 1];
    const arc = y0 + (y1 - y0) * k + Math.sin(k * Math.PI) * 1.8;
    // the line clears whatever ground it crosses — islets included
    return Math.max(arc, terrainHeight(x, z) + 1.1);
  }

  function headingAt(s) {
    const a = pointAt(Math.max(0, s - 0.005));
    const b = pointAt(Math.min(1, s + 0.005));
    return Math.atan2(b.x - a.x, b.z - a.z);
  }

  // ----- trestles, ties, rails — kin to the strait bridge, not a UFO
  const SEGS = Math.ceil(TOTAL / 1.6);
  for (let i = 0; i <= SEGS; i++) {
    const s = i / SEGS;
    const p = pointAt(s);
    const y = railHeight(s);
    if (i % 2 === 0) {
      const tie = box(2.0, 0.14, 0.5, 0x6b4a2e);
      tie.position.set(p.x, y - 0.1, p.z);
      tie.rotation.y = headingAt(s);
      group.add(tie);
    }
    if (i % 8 === 3) {
      const groundY = Math.max(terrainHeight(p.x, p.z), WATER_Y - 2);
      const pile = new THREE.Mesh(
        new THREE.CylinderGeometry(0.26, 0.34, y - groundY + 2, 6), mat(0x55483a));
      pile.position.set(p.x, (y + groundY - 2) / 2 + 0.55, p.z);
      pile.castShadow = true;
      group.add(pile);
      // a cross-brace, for honesty
      const brace = box(0.12, (y - groundY) * 0.5, 0.12, 0x6b4a2e);
      brace.position.set(p.x + 0.5, (y + groundY) / 2, p.z);
      brace.rotation.z = 0.5;
      group.add(brace);
    }
  }
  for (const rOff of [-0.6, 0.6]) {
    for (let i = 0; i < SEGS; i += 3) {
      const s0 = i / SEGS, s1 = Math.min(1, (i + 3) / SEGS);
      const a = pointAt(s0), b = pointAt(s1);
      const ya = railHeight(s0), yb = railHeight(s1);
      const h = headingAt((s0 + s1) / 2);
      const px = Math.cos(h), pz = -Math.sin(h);
      const len = Math.hypot(b.x - a.x, b.z - a.z);
      const railBar = box(0.12, 0.12, len + 0.2, 0x4a3f32);
      railBar.position.set((a.x + b.x) / 2 + px * rOff, (ya + yb) / 2 + 0.08, (a.z + b.z) / 2 + pz * rOff);
      railBar.rotation.y = Math.atan2(b.x - a.x, b.z - a.z);
      railBar.rotation.x = Math.atan2(ya - yb, len);
      group.add(railBar);
    }
  }

  // ----- the engine: same family as the strait train, in northern green
  const train = new THREE.Group();
  const loco = new THREE.Group();
  const body = box(1.3, 1.0, 2.4, 0x2f7d4f);
  body.position.y = 0.9;
  loco.add(body);
  const cab = box(1.2, 0.9, 0.9, 0x1d5a38);
  cab.position.set(0, 1.5, -0.7);
  loco.add(cab);
  const chimney = new THREE.Mesh(new THREE.CylinderGeometry(0.14, 0.2, 0.5, 7), mat(0x2e2a26));
  chimney.position.set(0, 1.65, 0.8);
  loco.add(chimney);
  const dome = new THREE.Mesh(new THREE.IcosahedronGeometry(0.2, 0), mat(0xf2cf5b, 0.4));
  dome.position.set(0, 1.5, 0.2);
  loco.add(dome);
  train.add(loco);
  const cars = [];
  for (let c = 0; c < 2; c++) {
    const car = new THREE.Group();
    const carBody = box(1.2, 0.9, 2.0, c ? 0xd9a440 : 0xb0453a);
    carBody.position.y = 0.85;
    car.add(carBody);
    for (const sz of [-0.5, 0.5]) {
      const win = box(1.26, 0.34, 0.5, 0xbfe6f2);
      win.position.set(0, 1.0, sz);
      car.add(win);
    }
    car.position.z = -(c + 1) * 2.5;
    train.add(car);
    cars.push(car);
  }
  for (const part of [loco, ...cars]) {
    for (const sx of [-1, 1]) {
      for (const sz of [-0.7, 0.7]) {
        const wheel = new THREE.Mesh(new THREE.CylinderGeometry(0.26, 0.26, 0.12, 8), mat(0x2e2a26));
        wheel.rotation.z = Math.PI / 2;
        wheel.position.set(sx * 0.62, 0.26, sz);
        part.add(wheel);
      }
    }
  }
  train.traverse((o) => { if (o.isMesh) o.castShadow = true; });
  group.add(train);
  const puffs = [];
  for (let i = 0; i < 4; i++) {
    const puff = new THREE.Mesh(new THREE.IcosahedronGeometry(0.22, 0),
      new THREE.MeshStandardMaterial({ color: 0xffffff, transparent: true, opacity: 0.7, flatShading: true, roughness: 1 }));
    puff.userData.k = i / 4;
    puff.visible = false;
    puffs.push(puff);
    group.add(puff);
  }

  // ----- stations: a platform, posts, a green-roofed canopy at each stop
  for (const st of STOPS) {
    const py = terrainHeight(st.p.x, st.p.z);
    const platform = box(3.6, 0.5, 4.2, 0xb9c0b9);
    platform.position.set(st.p.x, py + 0.25, st.p.z);
    group.add(platform);
    for (const o of [-1.5, 1.5]) {
      const post = box(0.14, 2.3, 0.14, 0x8a5a3a);
      post.position.set(st.p.x + o, py + 1.4, st.p.z);
      group.add(post);
    }
    const roof = box(3.8, 0.14, 3, 0x2f7d4f);
    roof.position.set(st.p.x, py + 2.6, st.p.z);
    group.add(roof);
  }

  // ----- the timetable: shuttles end to end, pausing at every stop
  let stopIdx = 0;       // current/last stop
  let direction = 1;     // +1 toward Grove, -1 toward Notbell
  let phase = 'docked';
  let timer = 12;
  let sNow = 0;
  let riding = false;

  function whistle() {
    tone(540, { dur: 0.3, type: 'triangle', vol: 0.05 });
    tone(720, { time: 0.12, dur: 0.4, type: 'triangle', vol: 0.05 });
  }

  function placeTrain(s) {
    sNow = s;
    const p = pointAt(s);
    train.position.set(p.x, railHeight(s) + 0.15, p.z);
    train.rotation.y = headingAt(s) + (direction < 0 ? Math.PI : 0);
    if (riding) {
      player.group.position.set(p.x, railHeight(s) + 1.5, p.z);
      player.group.rotation.y = train.rotation.y;
    }
  }
  placeTrain(0);

  function legTime(a, b) {
    return Math.abs(STOPS[b].s - STOPS[a].s) * TOTAL / 3.4; // a dignified pace
  }
  let legDur = 1;

  function disembark() {
    if (!riding) return;
    riding = false;
    player.riding = false;
    const st = STOPS[stopIdx];
    const dx = st.toward.x - st.p.x, dz = st.toward.z - st.p.z;
    const dl = Math.hypot(dx, dz) || 1;
    let lx = st.p.x, lz = st.p.z;
    for (let d = 0; d <= 14; d += 0.8) {
      const x = st.p.x + (dx / dl) * d, z = st.p.z + (dz / dl) * d;
      if (terrainHeight(x, z) > 0.2 && zones.islandCanWalk(x, z)) { lx = x; lz = z; break; }
    }
    player.group.position.set(lx, terrainHeight(lx, lz) + 0.5, lz);
    ui.toast(`${st.name}. The engine catches its breath behind you.`, '🚂');
  }

  for (const [idx, st] of STOPS.entries()) {
    register({
      pos: new THREE.Vector3(st.p.x, 0, st.p.z), r: 3,
      enabled: () => !player.riding && !riding,
      label: () => (phase === 'docked' && stopIdx === idx
        ? 'board the Grove Line' : 'wait for the Grove Line…'),
      use: () => {
        if (!(phase === 'docked' && stopIdx === idx)) {
          ui.say('A green-roofed platform, a kettle-quiet wait. The Grove Line keeps its own time, but it always keeps it.');
          return;
        }
        riding = true;
        player.riding = true;
        timer = Math.min(timer, 2);
        placeTrain(sNow);
        ui.toast('All aboard the Grove Line. Oranges and old money, end of the line.', '🚂');
      },
    });
  }
  // while docked mid-journey, you may step off
  register({
    getPos: () => player.group.position,
    r: 99, priority: 0,
    enabled: () => riding && phase === 'docked',
    label: () => `step off at ${STOPS[stopIdx].name}`,
    use: disembark,
  });

  function update(dt, t) {
    timer -= dt;
    if (phase === 'docked') {
      if (timer <= 0) {
        const next = stopIdx + direction;
        if (next < 0 || next >= STOPS.length) {
          direction *= -1;
          timer = 0.1; // turn around, think it over briefly
          return;
        }
        legDur = legTime(stopIdx, next);
        phase = 'moving';
        timer = legDur;
        whistle();
        stopIdx = next;
      }
    } else {
      const from = STOPS[stopIdx - direction].s;
      const to = STOPS[stopIdx].s;
      const k = 1 - timer / legDur;
      const kk = k * k * (3 - 2 * k);
      placeTrain(from + (to - from) * kk);
      if (timer <= 0) {
        phase = 'docked';
        timer = 13;
        placeTrain(to);
      }
    }
    const moving = phase === 'moving';
    for (const puff of puffs) {
      puff.visible = moving;
      if (!moving) continue;
      puff.userData.k = (puff.userData.k + dt * 0.5) % 1;
      const k = puff.userData.k;
      const chim = new THREE.Vector3(0, 1.9, 0.8).applyMatrix4(loco.matrixWorld);
      puff.position.set(chim.x, chim.y + k * 1.8, chim.z);
      puff.scale.setScalar(0.5 + k * 1.3);
      puff.material.opacity = 0.6 * (1 - k);
    }
    void t;
  }

  return { group, update };
}

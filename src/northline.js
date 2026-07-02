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
import { glowWindow } from './nightglow.js';

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

export function createNorthline(player, animals = null) {
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
    for (let i = 0; i < SEGS; i += 2) {
      const s0 = i / SEGS, s1 = Math.min(1, (i + 2) / SEGS);
      const a = pointAt(s0), b = pointAt(s1);
      const ya = railHeight(s0), yb = railHeight(s1);
      const h = headingAt((s0 + s1) / 2);
      const px = Math.cos(h), pz = -Math.sin(h);
      const len = Math.hypot(b.x - a.x, b.z - a.z);
      const railBar = box(0.12, 0.12, len + 0.42, 0x4a3f32);
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
      glowWindow(win);
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

  // ----- riders and queues: villagers wait on land, then take the +z bench
  const animalList = Array.isArray(animals) ? animals : [];
  const waiting = STOPS.map(() => []); // { a, here, destination, origin }
  const riders = []; // { a, car, destination, origin }
  const commuters = []; // visiting villagers: { a, stop, homeStop, stayTimer, origRange }
  const seatWorld = new THREE.Vector3();
  let playerWaiting = null;
  let recruitT = 6;

  function animalPool() {
    if (animalList.length) return animalList;
    if (typeof window !== 'undefined') return window.__notbell?.animals?.animals ?? animalList;
    return animalList;
  }

  function dockedAt() {
    return phase === 'docked' ? stopIdx : null;
  }

  function safeLanding(idx) {
    const st = STOPS[idx];
    const dx = st.toward.x - st.p.x, dz = st.toward.z - st.p.z;
    const dl = Math.hypot(dx, dz) || 1;
    for (let d = 0; d <= 14; d += 0.8) {
      const x = st.p.x + (dx / dl) * d, z = st.p.z + (dz / dl) * d;
      if (terrainHeight(x, z) > 0.2 && zones.islandCanWalk(x, z)) return { x, z };
    }
    return { x: st.p.x, z: st.p.z };
  }

  function stopRange(idx) {
    const spot = safeLanding(idx);
    const st = STOPS[idx];
    const dx = st.toward.x - spot.x, dz = st.toward.z - spot.z;
    const dl = Math.hypot(dx, dz) || 1;
    for (const d of [4, 3, 2, 1, 0]) {
      const x = spot.x + (dx / dl) * d, z = spot.z + (dz / dl) * d;
      if (terrainHeight(x, z) > 0.2 && zones.islandCanWalk(x, z)) return { x, z, R: 16 };
    }
    return { x: spot.x, z: spot.z, R: 16 };
  }

  function queueSpot(idx, slot) {
    const base = safeLanding(idx);
    const h = headingAt(STOPS[idx].s);
    const ax = Math.sin(h), az = Math.cos(h);
    const sx = Math.cos(h), sz = -Math.sin(h);
    const side = slot % 2 === 0 ? -1 : 1;
    const candidates = [
      { x: base.x + sx * side * 1.1 + ax * 0.5, z: base.z + sz * side * 1.1 + az * 0.5 },
      { x: base.x + sx * side * 0.7 - ax * 0.7, z: base.z + sz * side * 0.7 - az * 0.7 },
      { x: base.x + ax * (slot ? 1.1 : -0.4), z: base.z + az * (slot ? 1.1 : -0.4) },
      base,
    ];
    return candidates.find((p) => terrainHeight(p.x, p.z) > 0.2 && zones.islandCanWalk(p.x, p.z)) ?? base;
  }

  function freeVillagerCar() {
    for (let car = 0; car < cars.length; car++) {
      if (!riders.some((r) => r.car === car)) return car;
    }
    return null;
  }

  function seatRiders() {
    train.updateMatrixWorld(true);
    for (const r of riders) {
      seatWorld.set(0, 1.45, 0.45).applyMatrix4(cars[r.car].matrixWorld);
      r.a.g.position.copy(seatWorld);
      r.a.g.rotation.y = train.rotation.y;
    }
  }

  function destinationFrom(idx, a, explicitDestination = null) {
    if (explicitDestination !== null) return explicitDestination;
    const commuter = commuters.find((c) => c.a === a);
    if (commuter) return commuter.homeStop;
    if (STOPS.length <= 1) return idx;
    let destination = idx;
    while (destination === idx) destination = Math.floor(Math.random() * STOPS.length);
    return destination;
  }

  function isWaiting(a) {
    return waiting.some((q) => q.some((w) => w.a === a));
  }

  function tryBoardWaiter(idx, entry) {
    if (dockedAt() !== idx || !entry.here || entry.a.riding) return;
    const car = freeVillagerCar();
    if (car === null) return;
    const q = waiting[idx];
    q.splice(q.indexOf(entry), 1);
    entry.a.riding = true;
    entry.a.away = true;
    riders.push({ a: entry.a, car, destination: entry.destination, origin: entry.origin });
    seatRiders();
  }

  function enqueue(idx, a, destination = null) {
    if (idx < 0 || idx >= STOPS.length || !a || isWaiting(a)) return false;
    const q = waiting[idx];
    if (q.length >= 2) return false;
    const entry = { a, here: false, destination: destinationFrom(idx, a, destination), origin: idx };
    q.push(entry);
    const spot = queueSpot(idx, q.length - 1);
    a.goal = {
      x: spot.x,
      z: spot.z,
      r: 1.1,
      done: () => { entry.here = true; tryBoardWaiter(idx, entry); },
      fail: () => { const i = q.indexOf(entry); if (i >= 0) q.splice(i, 1); },
    };
    return true;
  }

  function recruit() {
    for (let idx = 0; idx < STOPS.length; idx++) {
      if (waiting[idx].length >= 2 || Math.random() > 0.35) continue;
      const spot = safeLanding(idx);
      const nearby = animalPool().filter((a) =>
        a.identity && !a.home && !a.errand && !a.meeting && !a.riding &&
        !a.away && !a.goal && !a.swims &&
        Math.hypot(a.g.position.x - spot.x, a.g.position.z - spot.z) < 30);
      if (!nearby.length) continue;
      enqueue(idx, nearby[Math.floor(Math.random() * nearby.length)]);
    }
  }

  function boardWaiters(idx) {
    for (const entry of [...waiting[idx]]) tryBoardWaiter(idx, entry);
    if (playerWaiting !== idx) return;
    playerWaiting = null;
    const st = STOPS[idx];
    const pp = player.group.position;
    if (!player.riding && !riding && Math.hypot(pp.x - st.p.x, pp.z - st.p.z) < 8) {
      riding = true;
      player.riding = true;
      timer = Math.min(timer, 2);
      placeTrain(sNow);
      ui.toast('The Grove Line kept your place. All aboard.', '🚂');
    }
  }

  function arriveVillagers(idx) {
    const spot = safeLanding(idx);
    for (const r of [...riders]) {
      if (r.destination !== idx) continue;
      riders.splice(riders.indexOf(r), 1);
      let ox = rand(-0.8, 0.8), oz = rand(-0.8, 0.8);
      if (!zones.islandCanWalk(spot.x + ox, spot.z + oz)) { ox = 0; oz = 0; }
      r.a.g.position.set(spot.x + ox, terrainHeight(spot.x + ox, spot.z + oz) + 0.5, spot.z + oz);
      r.a.riding = false;
      const existing = commuters.find((c) => c.a === r.a);
      if (existing && idx === existing.homeStop) {
        r.a.range = existing.origRange;
        r.a.away = r.a.home || !!r.a.errand;
        commuters.splice(commuters.indexOf(existing), 1);
      } else if (!existing) {
        commuters.push({ a: r.a, stop: idx, homeStop: r.origin, stayTimer: rand(240, 480), origRange: r.a.range });
        r.a.range = stopRange(idx);
        r.a.away = false;
        r.a.state = 'idle';
        r.a.timer = rand(1, 3);
      }
      const center = stopRange(idx);
      const wd = Math.hypot(center.x - spot.x, center.z - spot.z) || 1;
      r.a.goal = {
        x: spot.x + ((center.x - spot.x) / wd) * 4,
        z: spot.z + ((center.z - spot.z) / wd) * 4,
        r: 1.2,
      };
    }
    boardWaiters(idx);
  }

  function disembark() {
    if (!riding) return;
    riding = false;
    player.riding = false;
    const st = STOPS[stopIdx];
    const { x: lx, z: lz } = safeLanding(stopIdx);
    player.group.position.set(lx, terrainHeight(lx, lz) + 0.5, lz);
    ui.toast(`${st.name}. The engine catches its breath behind you.`, '🚂');
  }

  for (const [idx, st] of STOPS.entries()) {
    register({
      pos: new THREE.Vector3(st.p.x, 0, st.p.z), r: 3,
      enabled: () => !player.riding && !riding,
      label: () => (phase === 'docked' && stopIdx === idx
        ? 'board the Grove Line'
        : playerWaiting === idx ? 'waiting for the Grove Line…' : 'wait for the Grove Line…'),
      use: () => {
        if (!(phase === 'docked' && stopIdx === idx)) {
          if (playerWaiting === idx) {
            ui.say("You're in the queue. The rails hum their green-country hum.");
            return;
          }
          playerWaiting = idx;
          ui.say('You wait for the Grove Line. Somewhere down the track, a whistle agrees to the idea.');
          return;
        }
        if (playerWaiting === idx) playerWaiting = null;
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
    recruitT -= dt;
    if (recruitT <= 0) {
      recruitT = 5;
      recruit();
    }
    if (phase === 'docked') {
      boardWaiters(stopIdx);
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
        arriveVillagers(stopIdx);
      }
    }
    if (riders.length) seatRiders();

    // visitors eventually remember where their own patch of grass is
    for (const c of [...commuters]) {
      if (c.a.home) {
        c.a.range = c.origRange;
        commuters.splice(commuters.indexOf(c), 1);
        continue;
      }
      c.stayTimer -= dt;
      if (c.stayTimer <= 0 && !c.a.riding && !c.a.errand && !c.a.meeting &&
          !c.a.away && !c.a.goal) {
        if (!enqueue(c.stop, c.a, c.homeStop)) c.stayTimer = 25;
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

  const debug = { enqueue, waiting, phase: () => phase };

  return { group, update, debug };
}

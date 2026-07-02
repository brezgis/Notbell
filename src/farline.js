// The Farther Line: the third railway, salt-teal where the strait line is
// red and the Grove Line green, crossing open water from the Far Isle's
// south shore to Farther Isle's north tip. Two engines, one on each end,
// because the line has no turntable and no intention of apologizing: the
// one in front pulls, the one behind rides along and takes half the credit.

import * as THREE from 'three';
import { ISLAND2, ISLAND7, SITES, terrainHeight, WATER_Y } from './terrain.js';
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

export function createFarline(player, animals = null) {
  const group = new THREE.Group();

  // ----- the route: the Far Isle's south shore (the spot the charts always
  // said a station would go) straight across the strait to Farther Isle
  const CAMP = SITES.camp;
  const FAR_ANCHOR = { x: 95, z: -19 };            // inside the Far Isle, south side
  const F = marchToWater(FAR_ANCHOR, ISLAND7, 6);  // Far Isle south shore
  const T = marchToWater({ x: CAMP.x + 1, z: CAMP.z + 2 }, FAR_ANCHOR, 4); // Farther north tip
  const PTS = [F, T];
  const segLens = [];
  let TOTAL = 0;
  for (let i = 0; i < PTS.length - 1; i++) {
    const l = Math.hypot(PTS[i + 1].x - PTS[i].x, PTS[i + 1].z - PTS[i].z);
    segLens.push(l);
    TOTAL += l;
  }
  const STOPS = [
    { s: 0, name: 'the Far Isle', toward: { x: ISLAND2.x, z: ISLAND2.z }, p: F },
    { s: 1, name: 'Farther Isle', toward: { x: CAMP.x, z: CAMP.z }, p: T },
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
    return Math.max(arc, terrainHeight(x, z) + 1.1);
  }

  function headingAt(s) {
    const a = pointAt(Math.max(0, s - 0.005));
    const b = pointAt(Math.min(1, s + 0.005));
    return Math.atan2(b.x - a.x, b.z - a.z);
  }

  // ----- trestles, ties, rails — kin to the Grove Line's, salted by the run
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

  // ----- the consist: an engine on EACH end, two cars between. no turntable,
  // no turn-around — whichever engine is in front does the pulling.
  const train = new THREE.Group();
  function buildLoco() {
    const loco = new THREE.Group();
    const body = box(1.3, 1.0, 2.4, 0x3a7d8a);
    body.position.y = 0.9;
    loco.add(body);
    const cab = box(1.2, 0.9, 0.9, 0x2a5d68);
    cab.position.set(0, 1.5, -0.7);
    loco.add(cab);
    const chimney = new THREE.Mesh(new THREE.CylinderGeometry(0.14, 0.2, 0.5, 7), mat(0x2e2a26));
    chimney.position.set(0, 1.65, 0.8);
    loco.add(chimney);
    const dome = new THREE.Mesh(new THREE.IcosahedronGeometry(0.2, 0), mat(0xf2cf5b, 0.4));
    dome.position.set(0, 1.5, 0.2);
    loco.add(dome);
    return loco;
  }
  const locoA = buildLoco(); // faces +s (toward Farther Isle)
  train.add(locoA);
  const cars = [];
  for (let c = 0; c < 2; c++) {
    const car = new THREE.Group();
    const carBody = box(1.2, 0.9, 2.0, c ? 0xd9c08f : 0xc9705a);
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
  const locoB = buildLoco(); // faces -s (toward the Far Isle), riding backward
  locoB.rotation.y = Math.PI;
  locoB.position.z = -7.5;
  train.add(locoB);
  for (const part of [locoA, ...cars, locoB]) {
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

  // ----- stations: deck clears the highest corner + wears a skirt (B18)
  for (const st of STOPS) {
    let py = terrainHeight(st.p.x, st.p.z);
    for (const [ox, oz] of [[1.8, 2.1], [1.8, -2.1], [-1.8, 2.1], [-1.8, -2.1]]) {
      py = Math.max(py, terrainHeight(st.p.x + ox, st.p.z + oz));
    }
    const platform = box(3.6, 0.5, 4.2, 0xb9c0b9);
    platform.position.set(st.p.x, py + 0.25, st.p.z);
    group.add(platform);
    const skirt = box(3.4, 1.6, 4.0, 0xa8afa8);
    skirt.position.set(st.p.x, py - 0.55, st.p.z);
    group.add(skirt);
    for (const o of [-1.5, 1.5]) {
      const post = box(0.14, 2.3, 0.14, 0x8a5a3a);
      post.position.set(st.p.x + o, py + 1.4, st.p.z);
      group.add(post);
    }
    const roof = box(3.8, 0.14, 3, 0x3a7d8a);
    roof.position.set(st.p.x, py + 2.6, st.p.z);
    group.add(roof);
  }

  // ----- the timetable: end to end, at a dignified pace
  let stopIdx = 0;
  let direction = 1;     // +1 toward Farther Isle, -1 toward the Far Isle
  let phase = 'docked';
  let timer = 15;
  let sNow = 0;
  let riding = false;

  function whistle() {
    tone(480, { dur: 0.3, type: 'triangle', vol: 0.05 });
    tone(640, { time: 0.12, dur: 0.4, type: 'triangle', vol: 0.05 });
  }

  function placeTrain(s) {
    sNow = s;
    const p = pointAt(s);
    train.position.set(p.x, railHeight(s) + 0.15, p.z);
    // two engines: the consist never turns around — it just leads with the
    // other face. rotation always follows the rail's +s tangent.
    train.rotation.y = headingAt(s);
    if (riding) {
      // ride the middle of the consist — with an engine on each end, the
      // origin is somebody's footplate half the time
      const mx = Math.sin(train.rotation.y) * -3.75;
      const mz = Math.cos(train.rotation.y) * -3.75;
      player.group.position.set(p.x + mx, railHeight(s) + 1.5, p.z + mz);
      player.group.rotation.y = train.rotation.y + (direction < 0 ? Math.PI : 0);
    }
  }
  placeTrain(dockS(0));

  function legTime(a, b) {
    return Math.abs(STOPS[b].s - STOPS[a].s) * TOTAL / 3.4;
  }
  let legDur = 1;

  // where the ORIGIN parks when docked: nudged along the line so the whole
  // consist stays on its rails — the track has a beginning and an end, and
  // with an engine on each bumper there is no slack to hang off either one.
  // net effect: the cars stop at the platform; the engines wait over water.
  function dockS(idx) {
    if (STOPS[idx].s === 0) return 9.0 / TOTAL; // rear bumper just clears the platform
    return 1 - 1.5 / TOTAL;                     // nose stops shy of the buffers
  }

  // ----- riders and queues, the Grove Line school of patience
  const animalList = Array.isArray(animals) ? animals : [];
  const waiting = STOPS.map(() => []);
  const riders = [];
  const commuters = [];
  const seatWorld = new THREE.Vector3();
  let playerWaiting = null;
  let recruitT = 8;

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
      if (waiting[idx].length >= 2 || Math.random() > 0.3) continue;
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
      ui.toast('The Farther Line kept your place. All aboard.', '🚂');
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
    ui.toast(`${st.name}. The engine ahead rests; the one behind takes half the credit.`, '🚂');
  }

  for (const [idx, st] of STOPS.entries()) {
    register({
      pos: new THREE.Vector3(st.p.x, 0, st.p.z), r: 3,
      enabled: () => !player.riding && !riding,
      label: () => (phase === 'docked' && stopIdx === idx
        ? 'board the Farther Line'
        : playerWaiting === idx ? 'waiting for the Farther Line…' : 'wait for the Farther Line…'),
      use: () => {
        if (!(phase === 'docked' && stopIdx === idx)) {
          if (playerWaiting === idx) {
            ui.say('You’re in the queue. The rails hum a long, salted note.');
            return;
          }
          playerWaiting = idx;
          ui.say('You wait for the Farther Line. Across the water, one of its two engines clears its throat.');
          return;
        }
        if (playerWaiting === idx) playerWaiting = null;
        riding = true;
        player.riding = true;
        timer = Math.min(timer, 2);
        placeTrain(sNow);
        ui.toast('All aboard the Farther Line. Two engines, no turning back. Or around.', '🚂');
      },
    });
  }
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
          timer = 0.1; // no turn-around required. the other engine straightens its cap.
          return;
        }
        legDur = legTime(stopIdx, next);
        phase = 'moving';
        timer = legDur;
        whistle();
        stopIdx = next;
      }
    } else {
      const from = dockS(stopIdx - direction);
      const to = dockS(stopIdx);
      const k = 1 - timer / legDur;
      const kk = k * k * (3 - 2 * k);
      placeTrain(from + (to - from) * kk);
      if (timer <= 0) {
        phase = 'docked';
        timer = 15;
        placeTrain(to);
        arriveVillagers(stopIdx);
      }
    }
    if (riders.length) seatRiders();

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

    // smoke belongs to whichever engine is doing the pulling
    const moving = phase === 'moving';
    const puller = direction >= 0 ? locoA : locoB;
    for (const puff of puffs) {
      puff.visible = moving;
      if (!moving) continue;
      puff.userData.k = (puff.userData.k + dt * 0.5) % 1;
      const k = puff.userData.k;
      const chim = new THREE.Vector3(0, 1.9, 0.8).applyMatrix4(puller.matrixWorld);
      puff.position.set(chim.x, chim.y + k * 1.8, chim.z);
      puff.scale.setScalar(0.5 + k * 1.3);
      puff.material.opacity = 0.6 * (1 - k);
    }
    void t;
  }

  const debug = { enqueue, waiting, phase: () => phase, stops: STOPS, docked: () => dockedAt() };

  return { group, update, debug };
}

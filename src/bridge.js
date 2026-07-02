// The strait between the islands, and the two ways across it: a gently
// arched plank bridge you can walk, and beside it a rail bridge with a
// little red train that shuttles back and forth all day, whistling.

import * as THREE from 'three';
import { terrainHeight, ISLAND2, WATER_Y } from './terrain.js';
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

// ------------------------------------------------------------ the line ----
// march along the strait to find the two shores
const dir = new THREE.Vector2(ISLAND2.x, ISLAND2.z).normalize();

function findShore(fromT, step) {
  // walk along the center line until we leave land
  let t = fromT;
  for (let i = 0; i < 400; i++) {
    if (terrainHeight(dir.x * (t + step), dir.y * (t + step)) < 0.15) break;
    t += step;
  }
  return t;
}

const dist2 = Math.hypot(ISLAND2.x, ISLAND2.z);
const tA = findShore(24, 0.5);            // island 1 shore (outbound)
const tB = findShore(dist2 - 14, -0.5);   // far isle shore (walking back)
const A = { x: dir.x * tA, z: dir.y * tA };
const B = { x: dir.x * tB, z: dir.y * tB };
const hA = terrainHeight(A.x, A.z);
const hB = terrainHeight(B.x, B.z);
const LEN = Math.hypot(B.x - A.x, B.z - A.z);
const along = { x: (B.x - A.x) / LEN, z: (B.z - A.z) / LEN };
const perp = { x: -along.z, z: along.x }; // rail bridge sits this way

const DECK_HALF_W = 1.7;
const RAIL_OFFSET = 6;

function pointAt(t, offset = 0) {
  return {
    x: A.x + along.x * t * LEN + perp.x * offset,
    z: A.z + along.z * t * LEN + perp.z * offset,
  };
}

function deckY(t) {
  return hA + (hB - hA) * t + Math.sin(t * Math.PI) * 2.0 + 0.55;
}

// walkable corridor test + height, consumed by zones.js
export function contains(x, z) {
  const dx = x - A.x, dz = z - A.z;
  const t = (dx * along.x + dz * along.z) / LEN;
  if (t < -0.02 || t > 1.02) return false;
  const off = dx * perp.x + dz * perp.z;
  return Math.abs(off) < DECK_HALF_W - 0.25;
}

export function deckHeight(x, z) {
  const t = Math.max(0, Math.min(1, ((x - A.x) * along.x + (z - A.z) * along.z) / LEN));
  return deckY(t);
}

zones.addCrossing({ contains, height: deckHeight });

// ------------------------------------------------------------- meshes ----

export function createBridge(player, animals = []) {
  const group = new THREE.Group();
  const updates = [];

  // planks, railings, pilings
  const nPlanks = Math.ceil(LEN / 1.1);
  const plankDepth = LEN / nPlanks + 0.16;
  for (let i = 0; i <= nPlanks; i++) {
    const t = i / nPlanks;
    const p = pointAt(t);
    const plank = box(DECK_HALF_W * 2 + 0.3, 0.18, plankDepth, i % 7 === 3 ? 0x96703f : 0xa97c50);
    plank.position.set(p.x, deckY(t), p.z);
    plank.rotation.y = Math.atan2(along.x, along.z);
    plank.receiveShadow = true;
    group.add(plank);
  }
  for (let i = 0; i <= nPlanks; i += 3) {
    const t = i / nPlanks;
    for (const side of [-1, 1]) {
      const p = pointAt(t, side * DECK_HALF_W);
      const post = box(0.14, 1.0, 0.14, 0x8a5a3a);
      post.position.set(p.x, deckY(t) + 0.55, p.z);
      group.add(post);
    }
    if (t > 0.05 && t < 0.95 && i % 6 === 0) {
      const p = pointAt(t);
      const pile = new THREE.Mesh(new THREE.CylinderGeometry(0.22, 0.26, deckY(t) - WATER_Y + 2.4, 6), mat(0x6b4a2e));
      pile.position.set(p.x, (deckY(t) + WATER_Y - 2.4) / 2, p.z);
      group.add(pile);
    }
  }
  for (const side of [-1, 1]) {
    // handrails as long thin boxes laid along the arc in segments
    for (let i = 0; i < nPlanks; i += 3) {
      const t0 = i / nPlanks, t1 = Math.min(1, (i + 3) / nPlanks);
      const p0 = pointAt(t0, side * DECK_HALF_W);
      const p1 = pointAt(t1, side * DECK_HALF_W);
      const len = Math.hypot(p1.x - p0.x, p1.z - p0.z);
      const rail = box(0.1, 0.1, len + 0.35, 0x96703f);
      rail.position.set((p0.x + p1.x) / 2, (deckY(t0) + deckY(t1)) / 2 + 1.05, (p0.z + p1.z) / 2);
      rail.rotation.y = Math.atan2(p1.x - p0.x, p1.z - p0.z);
      rail.rotation.x = Math.atan2(deckY(t0) - deckY(t1), len);
      group.add(rail);
    }
  }

  // ------------------------------------------------------ rail bridge ----
  const railY = (t) => deckY(t) + 0.15;
  for (let i = 0; i <= nPlanks; i += 1) {
    const t = i / nPlanks;
    if (i % 2 === 0) {
      const p = pointAt(t, RAIL_OFFSET);
      const tie = box(2.0, 0.14, 0.5, 0x6b4a2e);
      tie.position.set(p.x, railY(t) - 0.1, p.z);
      tie.rotation.y = Math.atan2(along.x, along.z);
      group.add(tie);
    }
  }
  for (const rOff of [-0.6, 0.6]) {
    for (let i = 0; i < nPlanks; i += 3) {
      const t0 = i / nPlanks, t1 = Math.min(1, (i + 3) / nPlanks);
      const p0 = pointAt(t0, RAIL_OFFSET + rOff);
      const p1 = pointAt(t1, RAIL_OFFSET + rOff);
      const len = Math.hypot(p1.x - p0.x, p1.z - p0.z);
      const railBar = box(0.12, 0.12, len + 0.42, 0x55483a);
      railBar.position.set((p0.x + p1.x) / 2, (railY(t0) + railY(t1)) / 2, (p0.z + p1.z) / 2);
      railBar.rotation.y = Math.atan2(p1.x - p0.x, p1.z - p0.z);
      railBar.rotation.x = Math.atan2(railY(t0) - railY(t1), len);
      group.add(railBar);
    }
  }
  for (let i = 3; i < nPlanks - 2; i += 6) {
    const t = i / nPlanks;
    const p = pointAt(t, RAIL_OFFSET);
    const pile = new THREE.Mesh(new THREE.CylinderGeometry(0.24, 0.3, railY(t) - WATER_Y + 2.4, 6), mat(0x55483a));
    pile.position.set(p.x, (railY(t) + WATER_Y - 2.4) / 2, p.z);
    group.add(pile);
  }

  // ---------------------------------------------------------- the train ----
  const train = new THREE.Group();
  const loco = new THREE.Group();
  const body = box(1.3, 1.0, 2.4, 0xb0453a);
  body.position.y = 0.9;
  loco.add(body);
  const cab = box(1.2, 0.9, 0.9, 0x8a3a30);
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
    const carBody = box(1.2, 0.9, 2.0, c ? 0x4f8f6a : 0xd9a440);
    carBody.position.y = 0.85;
    car.add(carBody);
    for (const sz of [-0.5, 0.5]) {
      const win = box(1.26, 0.34, 0.5, 0xbfe6f2);
      win.position.set(0, 1.0, sz);
      glowWindow(win);
      car.add(win);
    }
    train.add(car);
    cars.push(car);
  }
  // wheels (shared look, purely decorative)
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

  // train smoke
  const puffMat = new THREE.MeshStandardMaterial({
    color: 0xffffff, transparent: true, opacity: 0.7, flatShading: true, roughness: 1,
  });
  const puffs = [];
  for (let i = 0; i < 4; i++) {
    const puff = new THREE.Mesh(new THREE.IcosahedronGeometry(0.22, 0), puffMat.clone());
    puff.userData.k = i / 4;
    puff.visible = false;
    puffs.push(puff);
    group.add(puff);
  }

  // ------------------------------------------------------- the timetable ----
  // docked at A (20s) → cross (26s) → docked at B (20s) → back
  let phase = 'dockedA';
  let timer = 8; // first departure soon after load, for the impatient
  let trainT = 0;

  function whistle() {
    tone(620, { dur: 0.35, type: 'triangle', vol: 0.05 });
    tone(830, { time: 0.1, dur: 0.4, type: 'triangle', vol: 0.05 });
  }

  function placeTrain(t) {
    trainT = t;
    const p = pointAt(t, RAIL_OFFSET);
    train.position.set(p.x, railY(t), p.z);
    train.rotation.y = Math.atan2(along.x, along.z) + (phase === 'toA' ? Math.PI : 0);
    // carriages trail behind
    cars.forEach((car, i) => {
      car.position.z = -(i + 1) * 2.5;
    });
  }
  placeTrain(0);

  const dockedAt = () => (phase === 'dockedA' ? 'A' : phase === 'dockedB' ? 'B' : null);

  // ----------------------------------------------------------- riders ----
  // seats on the two carriages, for you and for commuting villagers
  const SEATS = [
    { car: 0, x: 0, z: 0.45 }, { car: 0, x: 0, z: -0.45 },
    { car: 1, x: 0, z: 0.45 }, { car: 1, x: 0, z: -0.45 },
  ];
  const riders = []; // { kind:'player'|'villager', a?, seat }
  const commuters = []; // visiting villagers: { a, side, stayTimer, origRange }
  const seatWorld = new THREE.Vector3();

  function freeSeat() {
    return SEATS.find((s) => !riders.some((r) => r.seat === s));
  }

  // ------------------------------------------------------- the queue ----
  // Nobody materializes in a seat anymore. Villagers WALK to the platform,
  // wait for the train like anyone with somewhere to be, and board when it
  // docks — at most two waiting per end, at most one villager per carriage.
  // The player queues too (E on an empty platform); patience is honored.
  const waiting = { A: [], B: [] }; // { a, here }
  let playerWaiting = null; // which end the player queued at
  let recruitT = 6;

  function villagerCar() {
    for (const c of [0, 1]) {
      if (!riders.some((r) => r.kind === 'villager' && r.seat.car === c)) return c;
    }
    return null;
  }

  // the villager bench is the +z side of a car; the player's is the -z side
  function villagerSeatIn(car) {
    return SEATS.find((s) => s.car === car && s.z > 0 && !riders.some((r) => r.seat === s));
  }

  function playerSeat() {
    return SEATS.find((s) => s.z < 0 && !riders.some((r) => r.seat === s)) || freeSeat();
  }

  function tryBoardWaiter(end, entry) {
    if (dockedAt() !== end || !entry.here || entry.a.riding) return;
    const car = villagerCar();
    if (car === null) return; // both carriages spoken for — next crossing
    const seat = villagerSeatIn(car);
    if (!seat) return;
    const q = waiting[end];
    q.splice(q.indexOf(entry), 1);
    entry.a.riding = true;
    entry.a.away = true;
    riders.push({ kind: 'villager', a: entry.a, seat });
    seatRiders();
  }

  function enqueue(end, a) {
    const q = waiting[end];
    if (q.length >= 2 || q.some((w) => w.a === a)) return false;
    const spot = safeLanding(end);
    const entry = { a, here: false };
    q.push(entry);
    a.goal = {
      x: spot.x + (q.length > 1 ? 1.4 : -0.3),
      z: spot.z + (q.length > 1 ? 0.6 : -0.4),
      r: 1.1,
      done: () => { entry.here = true; tryBoardWaiter(end, entry); },
      fail: () => { const i = q.indexOf(entry); if (i >= 0) q.splice(i, 1); },
    };
    return true;
  }

  function recruit() {
    for (const end of ['A', 'B']) {
      if (waiting[end].length >= 2 || Math.random() > 0.35) continue;
      const spot = safeLanding(end);
      const nearby = animals.filter((a) =>
        a.identity && !a.home && !a.errand && !a.meeting && !a.riding &&
        !a.away && !a.goal && !a.swims &&
        Math.hypot(a.g.position.x - spot.x, a.g.position.z - spot.z) < 30);
      if (!nearby.length) continue;
      enqueue(end, nearby[Math.floor(Math.random() * nearby.length)]);
    }
  }

  function boardWaiters(end) {
    for (const entry of [...waiting[end]]) tryBoardWaiter(end, entry);
    if (playerWaiting === end) {
      playerWaiting = null;
      const ps = platformSpot(end);
      const pp = player.group.position;
      if (!player.riding && Math.hypot(pp.x - ps.x, pp.z - ps.z) < 8) {
        const seat = playerSeat();
        if (seat) {
          player.riding = true;
          riders.push({ kind: 'player', seat });
          seatRiders();
          ui.toast('The train remembers you were waiting. All aboard.', '🚂');
        }
      }
    }
  }

  function seatRiders() {
    train.updateMatrixWorld(true);
    for (const r of riders) {
      const car = cars[r.seat.car];
      seatWorld.set(r.seat.x, 1.45, r.seat.z).applyMatrix4(car.matrixWorld);
      const g = r.kind === 'player' ? player.group : r.a.g;
      g.position.copy(seatWorld);
      g.rotation.y = train.rotation.y;
    }
  }

  function platformSpot(end) {
    const t = end === 'A' ? 0 : 1;
    const sp = pointAt(t, RAIL_OFFSET);
    const inland = end === 'A' ? -3 : 3;
    return {
      x: sp.x + along.x * inland * 1.4 - perp.x * 1.8,
      z: sp.z + along.z * inland * 1.4 - perp.z * 1.8,
    };
  }

  // platforms are decks over the shallows — passengers should disembark
  // onto actual land, not into the harbor (sorry, Howell)
  function safeLanding(end) {
    const spot = platformSpot(end);
    const toward = end === 'A' ? { x: 0, z: 0 } : { x: ISLAND2.x, z: ISLAND2.z };
    const dx = toward.x - spot.x, dz = toward.z - spot.z;
    const len = Math.hypot(dx, dz) || 1;
    for (let d = 0; d <= 14; d += 0.8) {
      const x = spot.x + (dx / len) * d, z = spot.z + (dz / len) * d;
      if (terrainHeight(x, z) > 0.2 && zones.islandCanWalk(x, z)) return { x, z };
    }
    return spot;
  }

  const RANGE_A = { x: 0, z: 0, R: 30 };
  const RANGE_B = { x: ISLAND2.x, z: ISLAND2.z, R: ISLAND2.r - 2 };

  function arrive(end) {
    const spot = safeLanding(end);
    for (const r of [...riders]) {
      const g = r.kind === 'player' ? player.group : r.a.g;
      let ox2 = rand(-0.8, 0.8), oz2 = rand(-0.8, 0.8);
      if (!zones.islandCanWalk(spot.x + ox2, spot.z + oz2)) { ox2 = 0; oz2 = 0; }
      g.position.set(spot.x + ox2, terrainHeight(spot.x + ox2, spot.z + oz2) + 0.5, spot.z + oz2);
      if (r.kind === 'player') {
        player.riding = false;
        ui.toast(end === 'B' ? 'The Far Isle! The train seems quietly proud.' : 'Home again. The train says nothing, fondly.', '🚂');
      } else {
        r.a.riding = false;
        const existing = commuters.find((c) => c.a === r.a);
        if (existing) {
          // coming home: restore their old patch
          r.a.range = existing.origRange;
          r.a.away = r.a.home || !!r.a.errand;
          commuters.splice(commuters.indexOf(existing), 1);
        } else {
          // arrived for a visit: wander this island a while
          commuters.push({ a: r.a, side: end, stayTimer: rand(240, 480), origRange: r.a.range });
          r.a.range = end === 'B' ? RANGE_B : RANGE_A;
          r.a.away = false;
          r.a.riding = false;
          r.a.state = 'idle';
          r.a.timer = rand(1, 3);
        }
        // step away from the platform like a person, not a package
        const center = end === 'B' ? RANGE_B : RANGE_A;
        const wd = Math.hypot(center.x - spot.x, center.z - spot.z) || 1;
        r.a.goal = {
          x: spot.x + ((center.x - spot.x) / wd) * 4,
          z: spot.z + ((center.z - spot.z) / wd) * 4,
          r: 1.2,
        };
      }
    }
    riders.length = 0;
    boardWaiters(end); // whoever's been waiting gets on
  }

  function update(dt, t) {
    timer -= dt;
    recruitT -= dt;
    if (recruitT <= 0) {
      recruitT = 5;
      recruit();
    }
    if (phase === 'dockedA' && timer <= 0) {
      phase = 'toB';
      timer = 26;
      whistle();
    } else if (phase === 'toB') {
      const k = 1 - timer / 26;
      placeTrain(smooth(k));
      seatRiders();
      if (timer <= 0) { phase = 'dockedB'; timer = 20; placeTrain(1); arrive('B'); }
    } else if (phase === 'dockedB' && timer <= 0) {
      phase = 'toA';
      timer = 26;
      whistle();
    } else if (phase === 'toA') {
      const k = 1 - timer / 26;
      placeTrain(1 - smooth(k));
      seatRiders();
      if (timer <= 0) { phase = 'dockedA'; timer = 20; placeTrain(0); arrive('A'); }
    }
    if (riders.length && !phase.startsWith('to')) seatRiders();

    // visiting villagers eventually feel the pull of their own patch
    for (const c of [...commuters]) {
      if (c.a.home) { // bedtime overrides sightseeing
        c.a.range = c.origRange;
        commuters.splice(commuters.indexOf(c), 1);
        continue;
      }
      c.stayTimer -= dt;
      if (c.stayTimer <= 0 && !c.a.riding && !c.a.errand && !c.a.meeting &&
          !c.a.away && !c.a.goal) {
        // homesick: walk to the platform and wait, like anybody
        if (!enqueue(c.side, c.a)) c.stayTimer = 25; // queue's full; linger a bit
      }
    }

    const moving = phase === 'toA' || phase === 'toB';
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
  }

  function smooth(k) {
    return k * k * (3 - 2 * k);
  }

  // ----------------------------------------------------------- stations ----
  for (const [end, here, there, label] of [
    ['A', { t: 0, shore: A, h: hA }, { t: 1, shore: B, h: hB }, 'ride the train to the Far Isle'],
    ['B', { t: 1, shore: B, h: hB }, { t: 0, shore: A, h: hA }, 'ride the train home'],
  ]) {
    const sp = pointAt(here.t, RAIL_OFFSET);
    const inland = end === 'A' ? -3 : 3; // pull the platform onto land a bit
    const px = sp.x + along.x * inland * 1.4, pz = sp.z + along.z * inland * 1.4;
    const py = Math.max(terrainHeight(px, pz), here.h);

    const platform = box(3.4, 0.5, 4.2, 0xb9c0b9);
    platform.position.set(px - perp.x * 1.8, py + 0.25, pz - perp.z * 1.8);
    platform.rotation.y = Math.atan2(along.x, along.z);
    group.add(platform);
    for (const o of [-1.4, 1.4]) {
      const post = box(0.14, 2.2, 0.14, 0x8a5a3a);
      post.position.set(px - perp.x * 1.8 + along.x * o, py + 1.35, pz - perp.z * 1.8 + along.z * o);
      group.add(post);
    }
    const roof = box(2.4, 0.14, 4.6, 0xc97b63);
    roof.position.set(px - perp.x * 1.8, py + 2.5, pz - perp.z * 1.8);
    roof.rotation.y = Math.atan2(along.x, along.z);
    group.add(roof);

    const standSpot = { x: px - perp.x * 1.8, z: pz - perp.z * 1.8 };
    register({
      pos: new THREE.Vector3(standSpot.x, 0, standSpot.z),
      r: 2.6,
      enabled: () => !player.riding,
      label: () => (dockedAt() === end ? label.replace('ride the train', 'board the train')
        : playerWaiting === end ? 'waiting for the train…' : 'wait for the train…'),
      use: () => {
        if (dockedAt() !== end) {
          if (playerWaiting === end) {
            ui.say('You’re in the queue. The rails tick warmly, the way rails do when they know something’s coming.');
            return;
          }
          playerWaiting = end;
          const ahead = waiting[end].filter((w) => w.here).length;
          ui.say(ahead
            ? `You join the queue behind ${ahead === 1 ? 'one very patient villager' : 'two very patient villagers'}. The train will be along.`
            : 'You wait for the train. The platform hums faintly. It won’t be long.');
          return;
        }
        const seat = playerSeat();
        if (!seat) {
          ui.say('Every seat is taken. The villagers look very pleased about it. There’ll be another crossing in a minute.');
          return;
        }
        player.riding = true;
        riders.push({ kind: 'player', seat });
        timer = Math.min(timer, 2.5); // the conductor respects your schedule
        seatRiders();
        ui.toast('All aboard. The strait from a window seat — there’s nothing better.', '🚂');
      },
    });
    void there;
  }

  // debug/testing hooks (the shots harness rides the rails too)
  const debug = { enqueue, waiting, dockedAt: () => dockedAt(), phase: () => phase };

  return { group, update, debug };
}

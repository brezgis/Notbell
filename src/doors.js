// Doors that open. A villager going home (or into the café, or the shop)
// walks up, the door swings open, they step into the doorway, and it
// closes behind them; coming out, the door opens, they step out, it shuts.
// (They used to blink in and out a few steps short of the door.)
//
// hinge(key, doorMesh, ...extras) re-hangs a door on its left edge, with a dark
// doorway behind it (so an open door shows an opening, not more wall);
// open(key) swings it for a moment; through(a, …) walks a villager across
// the threshold. update(dt, t) runs it all (houses.js calls it every frame).

import * as THREE from 'three';
import { animateGait } from './animals.js';

const OPEN = -1.25; // radians: out toward the step
const DOORS = new Map(); // key → { pivot, anchor, hold }
const walks = [];

const darkMat = new THREE.MeshBasicMaterial({ color: 0x1a1410 });

export function hinge(key, door, ...extras) {
  const parent = door.parent;
  if (!parent || !door.geometry?.parameters) return;
  const { width: w, height: h, depth: d } = door.geometry.parameters;
  const pivot = new THREE.Group();
  pivot.position.set(door.position.x - w / 2, 0, door.position.z);
  parent.add(pivot);
  for (const m of [door, ...extras]) {
    m.position.x -= pivot.position.x;
    m.position.z -= pivot.position.z;
    pivot.add(m);
  }
  // the dark of the doorway, behind the door's face (hidden while it's shut)
  const dark = new THREE.Mesh(new THREE.PlaneGeometry(w * 0.94, h * 0.96), darkMat);
  dark.position.set(pivot.position.x + w / 2, door.position.y, pivot.position.z + d / 2 - 0.04);
  parent.add(dark);
  // where the threshold is (in the parent's frame, so it doesn't swing)
  const anchor = new THREE.Object3D();
  anchor.position.set(pivot.position.x + w / 2, 0, pivot.position.z + d / 2 + 0.25);
  parent.add(anchor);
  DOORS.set(key, { pivot, anchor, hold: 0 });
}

export function has(key) {
  return DOORS.has(key);
}

// the threshold, in the world: where you stand to go through
export function threshold(key) {
  const d = DOORS.get(key);
  if (!d) return null;
  const v = new THREE.Vector3();
  d.anchor.getWorldPosition(v);
  return v;
}

export function open(key, hold = 1.4) {
  const d = DOORS.get(key);
  if (d) d.hold = Math.max(d.hold, hold);
}

// walk a villager from → to (world points on the ground) over dur seconds,
// then call done. While they're in the doorway, their usual update leaves
// them be (animals.js skips a.inDoorway).
export function through(a, from, to, done, dur = 0.9, delay = 0.35) {
  a.inDoorway = true;
  a.g.visible = true;
  a.g.position.set(from.x, from.y ?? a.g.position.y, from.z);
  a.g.rotation.y = Math.atan2(to.x - from.x, to.z - from.z);
  walks.push({ a, from: { x: from.x, y: from.y ?? a.g.position.y, z: from.z }, to, done, dur, t: -delay });
}

export function update(dt, t) {
  for (const d of DOORS.values()) {
    d.hold -= dt;
    const want = d.hold > 0 ? OPEN : 0;
    d.pivot.rotation.y += (want - d.pivot.rotation.y) * Math.min(1, dt * 7);
  }
  for (let i = walks.length - 1; i >= 0; i--) {
    const w = walks[i];
    w.t += dt;
    if (w.t < 0) { animateGait(w.a.g, t, 0); continue; } // waiting for the door
    const k = Math.min(1, w.t / w.dur);
    const y = w.from.y + ((w.to.y ?? w.from.y) - w.from.y) * k;
    w.a.g.position.set(w.from.x + (w.to.x - w.from.x) * k, y, w.from.z + (w.to.z - w.from.z) * k);
    animateGait(w.a.g, t, 1, 9);
    if (k >= 1) {
      walks.splice(i, 1);
      w.a.inDoorway = false;
      w.done?.();
    }
  }
}

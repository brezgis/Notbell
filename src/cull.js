// Far things wait offstage. Every frame three walks the whole scene graph —
// twice (the picture, then the sun's shadow map) — and main.js walks it a
// third time for matrices. Most of it is small and far away: a pebble on an
// island two hundred units off, a villager on an errand across the strait.
// They're a few pixels deep in fog, and every walk still visits each one.
//
// So: each module's direct children (a prop, a house, a villager, a merged
// patch) get a "far" distance from their size. Past it, the thing steps out
// of its parent's child list — the renderer and the matrix pass never visit
// it — and steps back in as the camera comes near. It keeps its parent link
// the whole time (the merge.js trick), so the game doesn't notice: its own
// code moves it, hides it, reads its world position, talks to it, exactly as
// before; you just can't see it from here, and you couldn't anyway.
//
// The distances start past the fog's near edge and grow with size, so only
// small things go, and only where the haze is already thick. Big things (a
// mountain, a merged patch of town) never go: the far skyline stays put.
//
// Opt out with userData.noCull (something meant to be seen from far off).
import * as THREE from 'three';

const NEAR = 95;   // the fog's near edge (main.js): nothing closer is ever culled
const PER_R = 26;  // and every unit of size buys this much further
const SLACK = 6;   // hysteresis, so nothing flickers on the line

const items = [];

// (a module that removes one of its children while it's offstage means it:
// let go of it for real, so we never bring it back)
const remove = THREE.Object3D.prototype.remove;
THREE.Object3D.prototype.remove = function (...objs) {
  for (const o of objs) {
    if (o.__offstage && o.parent === this) {
      o.__offstage = false;
      o.parent = null;
      o.dispatchEvent({ type: 'removed' });
    }
  }
  return remove.apply(this, objs);
};

export function initCull(groups) {
  const box = new THREE.Box3(), c = new THREE.Vector3(), s = new THREE.Vector3(), wp = new THREE.Vector3();
  for (const g of groups) {
    g.updateMatrixWorld(true);
    for (const o of [...g.children]) {
      // (hidden now = a room, a world, or something waiting its turn: their
      // owners show and hide them, and they're none of our business)
      if (!o.visible || o.userData.noCull) continue;
      box.setFromObject(o);
      if (box.isEmpty()) continue;
      box.getCenter(c);
      box.getSize(s);
      o.getWorldPosition(wp);
      // a sphere around the object's own origin (so it follows it if it moves)
      const r = s.length() / 2 + c.distanceTo(wp);
      if (!Number.isFinite(r)) continue;
      items.push({ o, parent: g, far: NEAR + r * PER_R + r });
    }
  }
}

const wp = new THREE.Vector3();
export function updateCull(camPos) {
  for (let i = 0; i < items.length; i++) {
    const it = items[i], o = it.o;
    if (o.parent !== it.parent) { items.splice(i--, 1); continue; } // re-homed or removed: theirs now
    wp.copy(o.position).applyMatrix4(it.parent.matrixWorld);
    const d = Math.hypot(wp.x - camPos.x, wp.y - camPos.y, wp.z - camPos.z);
    if (o.__offstage) {
      if (d < it.far) {
        it.parent.children.push(o);
        o.__offstage = false;
        o._lastParent = undefined; // (main.js updateMoved: re-place the whole branch)
      }
    } else if (d > it.far + SLACK) {
      const k = it.parent.children.indexOf(o);
      if (k >= 0) it.parent.children.splice(k, 1);
      o.__offstage = true;
    }
  }
}

export const cullStats = () => ({ items: items.length, offstage: items.filter((it) => it.o.__offstage).length });

// Zones: the island itself, plus every place you can step into through a
// door — the shop, the café, the museum, the glow worm cave. Interiors are
// built far away from the island and you teleport between them behind a
// fade; each zone brings its own lighting mood.

import { terrainHeight, PLAYER_SPAWN, ISLAND_RADIUS, ISLAND2, ISLAND3, ISLAND4, ISLAND5, ISLAND5_HAND, ISLAND5_SOUTH, ISLAND6, ISLAND6_WEST, ISLAND7, ISLAND7_FLATS, TEXAS, VOLCANO, WATER_Y } from './terrain.js';
import { fadeSwap } from './ui.js';
import { doorChime } from './audio.js';

// crossings over water (the footbridge, the natural arch) register here
const crossings = [];

export function addCrossing(c) {
  crossings.push(c); // { contains(x,z), height(x,z) }
}

function crossingAt(x, z) {
  for (const c of crossings) if (c.contains(x, z)) return c;
  return null;
}

let scene, hemi, sun, player, snapCamera;
let currentZone = 'island';

const ISLAND_LIGHTING = {
  bg: 0x9fdcf7, fog: 0x9fdcf7, fogNear: 95, fogFar: 230,
  hemiSky: 0xcfeeff, hemiGround: 0x7ca16a, hemiIntensity: 1.3,
  sunIntensity: 2.4,
};

const zones = {
  island: {
    lighting: ISLAND_LIGHTING,
    groundHeight(x, z) {
      // bridges and arches carry you over the strait
      const c = crossingAt(x, z);
      if (c) return Math.max(terrainHeight(x, z), c.height(x, z));
      return terrainHeight(x, z);
    },
    canWalk(x, z) {
      if (crossingAt(x, z)) return true;
      if (terrainHeight(x, z) <= WATER_Y + 0.12) return false;
      const onHome = Math.hypot(x, z) < ISLAND_RADIUS + 14;
      const onFar = Math.hypot(x - ISLAND2.x, z - ISLAND2.z) < ISLAND2.r + 14;
      const onNorth = Math.hypot(x - ISLAND3.x, z - ISLAND3.z) < ISLAND3.r + 12;
      const onVolcano = Math.hypot(x - VOLCANO.x, z - VOLCANO.z) < VOLCANO.r + 8;
      const onTexas = Math.hypot(x - TEXAS.x, z - TEXAS.z) < TEXAS.r + 8;
      const onBulko = Math.hypot(x - ISLAND4.x, z - ISLAND4.z) < ISLAND4.r + 8;
      const onGrove = Math.hypot(x - ISLAND5.x, z - ISLAND5.z) < ISLAND5.r + 10 ||
        Math.hypot(x - ISLAND5_SOUTH.x, z - ISLAND5_SOUTH.z) < ISLAND5_SOUTH.r + 10 ||
        ISLAND5_HAND.some((h) => Math.hypot(x - h.x, z - h.z) < h.r + 8);
      const onLabs = Math.hypot(x - ISLAND6.x, z - ISLAND6.z) < ISLAND6.r + 12 ||
        Math.hypot(x - ISLAND6_WEST.x, z - ISLAND6_WEST.z) < ISLAND6_WEST.r + 12;
      const onFarther = Math.hypot(x - ISLAND7.x, z - ISLAND7.z) < ISLAND7.r + 12 ||
        Math.hypot(x - ISLAND7_FLATS.x, z - ISLAND7_FLATS.z) < ISLAND7_FLATS.r + 10;
      if (!onHome && !onFar && !onNorth && !onVolcano && !onTexas && !onBulko && !onGrove && !onLabs && !onFarther) return false;
      for (const b of blockers) {
        if (Math.hypot(x - b.x, z - b.z) < b.r) return false;
      }
      return true;
    },
  },
  // out on the water, in a rowboat — boats.js swaps you in and out
  sea: {
    lighting: ISLAND_LIGHTING,
    groundHeight: () => WATER_Y + 0.12,
    canWalk(x, z) {
      if (terrainHeight(x, z) > WATER_Y - 0.22) return false; // shallows stop the hull
      // stay within the archipelago's waters
      return Math.hypot(x - 40, z - 40) < 220;
    },
  },
};

const blockers = []; // solid circles on the island (buildings, cave mound)
const interiorRoots = new Map();

export function addBlocker(x, z, r) {
  blockers.push({ x, z, r });
}

export function nearBlocker(x, z, clearance = 0) {
  return blockers.some((b) => Math.hypot(x - b.x, z - b.z) < b.r + clearance);
}

function syncInteriorRoots() {
  for (const [name, roots] of interiorRoots) {
    for (const root of roots) root.visible = name === currentZone;
  }
}

// For whole other worlds (the moon) — bring your own ground and physics.
// opts: { groundHeight(x,z), canWalk(x,z), lighting, spawn }
export function registerWorld(name, opts) {
  zones[name] = opts;
}

// opts: { root, floorY, bounds: {x0, z0, x1, z1}, blockers: [{x,z,r}],
//         lighting, spawn: {x, z, rotY}, exit: {x, z, rotY} (island-side) }
export function registerInterior(name, opts) {
  const { root, ...zoneOpts } = opts;
  if (root) {
    const roots = Array.isArray(root) ? root : [root];
    interiorRoots.set(name, [...(interiorRoots.get(name) || []), ...roots]);
    syncInteriorRoots();
  }
  zones[name] = {
    ...zoneOpts,
    groundHeight: () => zoneOpts.floorY,
    canWalk(x, z) {
      const b = zoneOpts.bounds;
      if (x < b.x0 || x > b.x1 || z < b.z0 || z > b.z1) return false;
      for (const c of zoneOpts.blockers || []) {
        if (Math.hypot(x - c.x, z - c.z) < c.r) return false;
      }
      return true;
    },
  };
}

export function init(refs) {
  ({ scene, hemi, sun, player, snapCamera } = refs);
}

export function current() {
  return currentZone;
}

// Fired after a zone change settles (player already at the new spot). The HUD
// listens so the place name + clock refresh the moment you step through a door.
const changeListeners = [];
export function onChange(fn) {
  changeListeners.push(fn);
}

export function groundHeight(x, z) {
  return zones[currentZone].groundHeight(x, z);
}

export function canWalk(x, z) {
  return zones[currentZone].canWalk(x, z);
}

// For NPCs, who only ever roam the island.
export function islandCanWalk(x, z) {
  return zones.island.canWalk(x, z);
}

function applyLighting(l) {
  scene.background.set(l.bg);
  scene.fog.color.set(l.fog);
  scene.fog.near = l.fogNear;
  scene.fog.far = l.fogFar;
  hemi.color.set(l.hemiSky);
  hemi.groundColor.set(l.hemiGround);
  hemi.intensity = l.hemiIntensity;
  sun.intensity = l.sunIntensity;
  // far-off worlds bring their own sun (and its shadow box follows the target)
  if (l.sunPos) sun.position.set(...l.sunPos);
  else sun.position.set(45, 70, 30);
  if (l.sunTarget) sun.target.position.set(...l.sunTarget);
  else sun.target.position.set(0, 0, 0);
}

let traveling = false;

export async function go(name, at) {
  if (traveling) return false;
  const target = zones[name] ? name : 'island';
  const zone = zones[target];
  traveling = true;
  try {
    doorChime();
    await fadeSwap(() => {
      currentZone = target;
      syncInteriorRoots();
      const spot = at || zone.spawn || PLAYER_SPAWN;
      player.group.position.set(spot.x, zone.groundHeight(spot.x, spot.z), spot.z);
      if (spot.rotY !== undefined) player.group.rotation.y = spot.rotY;
      applyLighting(zone.lighting || ISLAND_LIGHTING);
      snapCamera();
    });
    for (const fn of changeListeners) fn(target);
    return true;
  } finally {
    traveling = false;
  }
}

// Convenience for door pairs: enter goes to the interior's spawn,
// leaving puts you back on the island just outside the door.
export function leaveTo(islandSpot) {
  return go('island', islandSpot);
}

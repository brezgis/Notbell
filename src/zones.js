// Zones: the island itself, plus every place you can step into through a
// door — the shop, the café, the museum, the glow worm cave. Interiors are
// built far away from the island and you teleport between them behind a
// fade; each zone brings its own lighting mood.

import { terrainHeight, PLAYER_SPAWN, ISLAND_RADIUS, ISLAND2, ISLAND2_EAST, ISLAND3, ISLAND4, ISLAND5, ISLAND5_HAND, ISLAND5_SOUTH, ISLAND6, ISLAND6_WEST, ISLAND6_BEACH, ISLAND7, ISLAND7_FLATS, ISLAND7_BACK, ISLAND7_NECK, ISLAND8, ISLAND9, ISLET_CH, oasisE, TEXAS, VOLCANO, VOLCANO_SHELF, WATER_Y } from './terrain.js';
import { fadeSwap } from './ui.js';
import { doorChime } from './audio.js';

// crossings over water (the footbridge, the natural arch) register here.
// A crossing beats blockers: if you're on the bridge, you're on the bridge.
const crossings = [];

export function addCrossing(c) {
  crossings.push(c); // { contains(x,z), height(x,z) }
}

function crossingAt(x, z) {
  for (const c of crossings) if (c.contains(x, z)) return c;
  return null;
}

// sea walls: solid things standing IN the water (the North Isle arch's rock
// legs, bridge pilings) — hulls and swimmers stop at them. { contains(x,z) }
const seaWalls = [];

export function addSeaWall(w) {
  seaWalls.push(w);
}

export function seaBlocked(x, z) {
  for (const w of seaWalls) if (w.contains(x, z)) return true;
  return false;
}

// sea gates: where a boat may pass THROUGH a sea wall (the arch's tunnel,
// under the high middle of a bridge). { a, b } endpoints of the wall's line
// and { x, z } the gap's center — boats.js routes voyages through these.
const seaGates = [];

export function addSeaGate(g) {
  seaGates.push(g);
}

export function getSeaGates() {
  return seaGates;
}

// surfaces: raised floors you step UP onto instead of sinking into — plinths,
// station platforms, plazas, piers. Unlike crossings they don't beat
// blockers (a plinth under a house still has a house on it); like crossings
// they carry you over water. { contains(x,z), height(x,z) }
const surfaces = [];

export function addSurface(sf) {
  surfaces.push(sf);
}

// convenience: an oriented rectangle at a fixed top height
export function addSurfaceBox(x, z, w, d, top, rotY = 0) {
  const c = Math.cos(rotY), s = Math.sin(rotY);
  addSurface({
    contains(px, pz) {
      const dx = px - x, dz = pz - z;
      const lx = dx * c - dz * s, lz = dx * s + dz * c;
      return Math.abs(lx) <= w / 2 && Math.abs(lz) <= d / 2;
    },
    height: () => top,
  });
}

// ...and a disc
export function addSurfaceDisc(x, z, r, top) {
  addSurface({ contains: (px, pz) => Math.hypot(px - x, pz - z) <= r, height: () => top });
}

function surfaceHeight(x, z) {
  let h = -Infinity;
  for (const sf of surfaces) if (sf.contains(x, z)) h = Math.max(h, sf.height(x, z));
  return h;
}

// the island's walking height anywhere: terrain, raised by any bridge or plinth
function islandGround(x, z) {
  let h = terrainHeight(x, z);
  const c = crossingAt(x, z);
  if (c) h = Math.max(h, c.height(x, z));
  return Math.max(h, surfaceHeight(x, z));
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
    // bridges, arches, plinths and platforms all lift you off the terrain
    groundHeight: islandGround,
    canWalk(x, z) {
      if (crossingAt(x, z)) return true;
      if (terrainHeight(x, z) <= WATER_Y + 0.12 && !(surfaceHeight(x, z) > WATER_Y + 0.12)) return false;
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
      const onOasis = oasisE(x, z) < 1.5;
      const onCran = Math.hypot(x - ISLAND9.x, z - ISLAND9.z) < ISLAND9.r + 9;
      const onIslet = Math.hypot(x - ISLET_CH.x, z - ISLET_CH.z) < ISLET_CH.r + 3;
      if (!onHome && !onFar && !onNorth && !onVolcano && !onTexas && !onBulko && !onGrove && !onLabs && !onFarther && !onOasis && !onCran && !onIslet) return false;
      return !blocked(x, z);
    },
  },
  // out on the water, in a rowboat — boats.js swaps you in and out
  sea: {
    lighting: ISLAND_LIGHTING,
    groundHeight: () => WATER_Y + 0.12,
    canWalk(x, z) {
      if (terrainHeight(x, z) > WATER_Y - 0.22) return false; // shallows stop the hull
      if (seaBlocked(x, z)) return false; // and so do arches, piers, pilings
      // stay within the archipelago's waters
      return Math.hypot(x - 40, z - 40) < 220;
    },
  },
};

// Blockers: the solid things on the island. Circles (addBlocker) for round
// things and quick jobs; oriented rectangles (addBlockerBox) for walls, so a
// square building doesn't get a round force field that's too fat on its
// faces and too thin at its corners. Bucketed on a coarse grid — there are
// hundreds (every tree trunk), and canWalk runs for every walker every frame.
// kind: 'structure' (default), 'tree' (solid to walkers, invisible to
// planners — so solid trees don't thin out forests planted after them), or
// 'keepout' (reserved ground: invisible to walkers, visible to planners).
const blockers = [];
const CELL = 8;
const grid = new Map();
const cellKey = (i, j) => i * 4096 + j;
const interiorRoots = new Map();

function indexBlocker(b, x0, z0, x1, z1) {
  blockers.push(b);
  for (let i = Math.floor(x0 / CELL); i <= Math.floor(x1 / CELL); i++) {
    for (let j = Math.floor(z0 / CELL); j <= Math.floor(z1 / CELL); j++) {
      const k = cellKey(i, j);
      if (!grid.has(k)) grid.set(k, []);
      grid.get(k).push(b);
    }
  }
}

export function addBlocker(x, z, r, kind = 'structure') {
  indexBlocker({ x, z, r, kind }, x - r, z - r, x + r, z + r);
}

// a solid rectangle w×d centered on (x,z), turned rotY like a mesh's
// rotation.y; pad grows it evenly (for a little breathing room)
export function addBlockerBox(x, z, w, d, rotY = 0, pad = 0, kind = 'structure') {
  const hw = w / 2 + pad, hd = d / 2 + pad;
  const c = Math.cos(rotY), s = Math.sin(rotY);
  const ex = Math.abs(c) * hw + Math.abs(s) * hd, ez = Math.abs(s) * hw + Math.abs(c) * hd;
  indexBlocker({ x, z, hw, hd, c, s, kind, r: Math.hypot(hw, hd) }, x - ex, z - ez, x + ex, z + ez);
}

// signed-ish distance from a blocker's edge (negative = inside)
function edgeDist(b, x, z) {
  const dx = x - b.x, dz = z - b.z;
  if (b.hw === undefined) return Math.hypot(dx, dz) - b.r;
  // world → local: undo rotation.y
  const lx = Math.abs(dx * b.c - dz * b.s) - b.hw;
  const lz = Math.abs(dx * b.s + dz * b.c) - b.hd;
  return lx > 0 || lz > 0 ? Math.hypot(Math.max(lx, 0), Math.max(lz, 0)) : Math.max(lx, lz);
}

// which kinds each question cares about
const WALKERS = { structure: true, tree: true };           // can I step here?
const PLANNERS = { structure: true, keepout: true };       // may I build/plant here?
const EVERYTHING = { structure: true, tree: true, keepout: true };

function blocked(x, z, clearance = 0, kinds = WALKERS) {
  const reach = clearance + 0.001;
  const i0 = Math.floor((x - reach) / CELL), i1 = Math.floor((x + reach) / CELL);
  const j0 = Math.floor((z - reach) / CELL), j1 = Math.floor((z + reach) / CELL);
  for (let i = i0; i <= i1; i++) {
    for (let j = j0; j <= j1; j++) {
      const list = grid.get(cellKey(i, j));
      if (!list) continue;
      for (const b of list) {
        if (!kinds[b.kind]) continue;
        if (edgeDist(b, x, z) < clearance) return true;
      }
    }
  }
  return false;
}

// keepouts: ground reserved for something (a railway, a station ramp) that
// isn't a wall — walkable, but scatterers asking nearBlocker() stay off it
export function addKeepout(x, z, r) {
  indexBlocker({ x, z, r, kind: 'keepout' }, x - r, z - r, x + r, z + r);
}

export function nearBlocker(x, z, clearance = 0) {
  return blocked(x, z, clearance, PLANNERS);
}

// buildings, reservations AND trees — for placing something big (a cottage)
export function nearAnything(x, z, clearance = 0) {
  return blocked(x, z, clearance, EVERYTHING);
}

// anything solid at all, trees included (for NPCs that ignore the water rule)
export function solidAt(x, z) {
  return blocked(x, z) || floatAt(x, z);
}

// floats: solid things that MOVE (a moored rowboat can be rowed off and
// tied up somewhere else), so they can't live in the static blocker grid.
// Each is { circles() → [[x, z, r], …], active() → bool }; swimmers (ducks,
// crocs, you) steer round them through solidAt.
const floats = [];
export function addFloat(f) {
  floats.push(f);
}
function floatAt(x, z) {
  for (const f of floats) {
    if (!f.active()) continue;
    for (const [cx, cz, r] of f.circles()) if ((x - cx) ** 2 + (z - cz) ** 2 < r * r) return true;
  }
  return false;
}

function syncInteriorRoots() {
  for (const [name, roots] of interiorRoots) {
    for (const root of roots) root.visible = name === currentZone;
  }
}

// For whole other worlds (the moon) — bring your own ground and physics.
// opts: { root?, groundHeight(x,z), canWalk(x,z), lighting, spawn }
// A root shows only while you're in that world, like an interior's: out of
// sight it's still thousands of meshes to cull and re-matrix every frame.
export function registerWorld(name, opts) {
  const { root, ...worldOpts } = opts;
  if (root) {
    interiorRoots.set(name, [...(interiorRoots.get(name) || []), root]);
    syncInteriorRoots();
  }
  zones[name] = worldOpts;
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
  // interior blockers are circles {x,z,r} or boxes {x,z,w,d,rot?}
  const inner = (zoneOpts.blockers || []).map((c) => (c.w === undefined ? c : {
    x: c.x, z: c.z, hw: c.w / 2, hd: c.d / 2,
    c: Math.cos(c.rot || 0), s: Math.sin(c.rot || 0),
  }));
  zones[name] = {
    ...zoneOpts,
    groundHeight: () => zoneOpts.floorY,
    canWalk(x, z) {
      const b = zoneOpts.bounds;
      if (x < b.x0 || x > b.x1 || z < b.z0 || z > b.z1) return false;
      for (const c of inner) {
        if (edgeDist(c, x, z) < 0) return false;
      }
      return true;
    },
  };
}

export function init(refs) {
  ({ scene, hemi, sun, player, snapCamera } = refs);
}

// for worlds that shade their own water as you move (the Glow, down below)
export function lightingRefs() {
  return { scene, hemi, sun };
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

// ...and the height they walk at (bridges and plinths included — a villager
// crossing the strait walks ON the planks, not through the sea under them)
export function islandGroundHeight(x, z) {
  return islandGround(x, z);
}

// the same body test on the island's rules, for villagers wherever you are
export function islandCanStand(x, z, r = 0.3) {
  const w = zones.island.canWalk;
  return w(x, z) && w(x + r, z) && w(x - r, z) && w(x, z + r) && w(x, z - r);
}

// Folk who walk about but aren't villagers (Oasis Estates: Beverly on her
// rounds, Todd on the mower, the mall walkers) register here: { zone, obj,
// r }. They're solid to your body test. Stepping away from one you already
// overlap always works — the player's escape rule covers that for free.
const movers = [];
export function addMover(m) {
  movers.push(m);
}
function moverAt(x, z, r) {
  for (const m of movers) {
    if (m.zone !== currentZone || !m.obj.visible) continue;
    const p = m.obj.position;
    if (Math.hypot(x - p.x, z - p.z) < m.r + r) return true;
  }
  return false;
}

// Can a body of radius r stand here? The center plus four points around the
// rim — so a walker's shoulders stop at the wall, not their nose.
export function canStand(x, z, r = 0.3) {
  const w = zones[currentZone].canWalk;
  return w(x, z) && w(x + r, z) && w(x - r, z) && w(x, z + r) && w(x, z - r) && !moverAt(x, z, r);
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

// front doors of walk-in places, so villagers can walk to one instead of
// materializing inside (ambient.js errands). doorOf('shop') → {x, z} outside.
const doors = new Map();
export function setDoor(zone, spot) {
  doors.set(zone, spot);
}
export function doorOf(zone) {
  return doors.get(zone) || null;
}

// ------------------------------------------------------------ routes ----
// Which island is this? And how do you get from one to another on foot (or
// by train)? Links register from the modules that build the crossings:
// the footbridge, the arch, the causeway (kind 'walk', with waypoints from
// one shore to the other), and each railway (kind 'rail', with a board()
// that queues a villager at the right platform). Villagers walking to a
// goal on another island follow the route instead of pacing a shoreline.
const ISLES = [
  ['notbell', [{ x: 0, z: 0, r: ISLAND_RADIUS + 4 }]],
  ['far', [{ ...ISLAND2, r: ISLAND2.r + 4 }, ISLAND2_EAST]],
  ['north', [{ ...ISLAND3, r: ISLAND3.r + 4 }]],
  ['volcano', [{ ...VOLCANO, r: VOLCANO.r + 3 }, { ...VOLCANO_SHELF, r: VOLCANO_SHELF.r + 3 }]],
  ['texas', [{ ...TEXAS, r: TEXAS.r + 2 }]],
  ['bulko', [ISLAND4]],
  ['grove', [ISLAND5, ISLAND5_SOUTH, ...ISLAND5_HAND]],
  ['labs', [ISLAND6, ISLAND6_WEST, { ...ISLAND6_BEACH, r: 17 }]],
  ['oasis', [ISLAND8]],
  ['cran', [{ ...ISLAND9, r: ISLAND9.r + 3 }]],
  ['chuckee', [ISLET_CH]],
  ['farther', [{ ...ISLAND7, r: ISLAND7.r + 3 }, ISLAND7_FLATS, ISLAND7_NECK, { ...ISLAND7_BACK, r: ISLAND7_BACK.r + 3 }]],
];
export function islandOf(x, z) {
  let best = null, bestK = Infinity;
  for (const [key, circles] of ISLES) {
    for (const c of circles) {
      const k = Math.hypot(x - c.x, z - c.z) / c.r;
      if (k < 1 && k < bestK) { bestK = k; best = key; }
    }
  }
  return best;
}

const links = [];
export function addLink(link) {
  links.push(link); // { a, b, kind: 'walk'|'rail', path: [{x,z}...] (a→b), board?(villager, fromKey) }
}

// fewest-hops route: [{ link, from, to }] or null
export function findRoute(from, to) {
  if (!from || !to) return null;
  if (from === to) return [];
  const prev = new Map([[from, null]]);
  const q = [from];
  while (q.length) {
    const cur = q.shift();
    if (cur === to) break;
    for (const l of links) {
      const next = l.a === cur ? l.b : l.b === cur ? l.a : null;
      if (!next || prev.has(next)) continue;
      prev.set(next, { link: l, from: cur });
      q.push(next);
    }
  }
  if (!prev.has(to)) return null;
  const route = [];
  for (let k = to; prev.get(k); k = prev.get(k).from) route.unshift({ ...prev.get(k), to: k });
  return route;
}

// debug: every blocker, for the harness to draw (shots/views.mjs SHOW=1)
export function debugBlockers() {
  return blockers.map((b) => (b.hw === undefined
    ? { x: b.x, z: b.z, r: b.r, kind: b.kind }
    : { x: b.x, z: b.z, hw: b.hw, hd: b.hd, c: b.c, s: b.s, kind: b.kind }));
}

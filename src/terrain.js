import * as THREE from 'three';
import { fbm, vnoise, hash2, smoothstep } from './utils.js';
import { SEASON } from './calendar.js';

export const ISLAND_RADIUS = 34;
export const WATER_Y = -0.55;

// the Far Isle — a smaller neighbor across the strait, joined by the bridge
export const ISLAND2 = { x: 98, z: -30, r: 24 };
// ...grown a little east, to give the Listeners' town and the Old Singer
// room to breathe (the whale used to hang her tail off the end)
export const ISLAND2_EAST = { x: 118, z: -27, r: 13 };

// the volcano that made the whole archipelago. retired. proud of her work.
// visible from both islands, reachable only by rowboat.
export const VOLCANO = { x: 30, z: -120, r: 19 };
export const VOLCANO_SHELF = { x: 22, z: -99, r: 6.5 };

// the north island: moss, mushrooms, books, and a doctor nobody needs.
// joined to Notbell by a natural stone arch the sea carved itself.
export const ISLAND3 = { x: -58, z: -89, r: 23 }; // (backed off a notch and grown, so the town has room)

// TEXAS. a very small island. it is called Texas. that's it, that's the lore.
export const TEXAS = { x: -14, z: -52, r: 7 };

// Grove Isle, southeast: shaped a little like Idaho — a fat orchard south
// and a long panhandle reaching northwest, where the Grove Line lands.
export const ISLAND5 = { x: 87, z: 91, r: 27 };
export const ISLAND5_HAND = [{ x: 66, z: 52, r: 9 }, { x: 54, z: 34, r: 8 }];
export const ISLAND5_SOUTH = { x: 88, z: 108, r: 16 }; // the orchard country

// the southern isle, which is a BULKO. reachable by ferry. do not worry
// about the cars.
export const ISLAND4 = { x: 8, z: 96, r: 22 };

// the far west: Notbell Labs. the island is bigger than the chart, which
// stops at the chart's edge. the island does not. the Labs love this fact.
// (room to grow westward; the Labs have plans. the Labs always have plans.)
export const ISLAND6 = { x: -150, z: -58, r: 38 };

// and past the Labs, past the chart entirely: the west lobe, where the
// plain folk farm. they were offered a spot on the chart, very politely.
// they declined, very politely. everyone waves.
export const ISLAND6_WEST = { x: -194, z: -48, r: 19 };
// ...and a beach, off the Labs' south shore, for the rovers' days off
export const ISLAND6_BEACH = { x: -146, z: -21, r: 9 };
// (the beach is a broad, soft cove, not a knob: three overlapping lobes
// under the mask, and a gentle slope down to the sand — see baseHeight)
const BEACH_LOBES = [ISLAND6_BEACH, { x: -157, z: -26, r: 7 }, { x: -135, z: -25, r: 7 }];

// Farther Isle: way out past the Far Isle, off to the northeast in open
// water — a real trip on the Farther Line. the name is a whole philosophy.
// a campsite in the lee of its own little mountain (trails to the top),
// mangroves wading out of the southeast side, and a tide that runs the only
// clock anybody out there consults.
export const ISLAND7 = { x: 170, z: -126, r: 27 };
// the back of Farther: a thin neck of sand and a knob of peninsula, east,
// where somebody parked a trailer years ago and simply stayed
export const ISLAND7_BACK = { x: ISLAND7.x + 34, z: ISLAND7.z + 4, r: 8 };
export const ISLAND7_NECK = { x: ISLAND7.x + 25, z: ISLAND7.z + 3, r: 7 };
export const ISLAND7_FLATS = { x: ISLAND7.x + 14, z: ISLAND7.z + 16, r: 10 }; // the mangrove flats
// the mountain: not a volcano — nobody's ever had to say that out loud here
export const MOUNT7 = { x: ISLAND7.x + 8, z: ISLAND7.z - 10, r: 15, h: 13 };
// the summit trail, switchbacking up from camp (painted into the ground; the
// trail signs and the summit cairn live in farther.js)
export const TRAIL7 = [
  [-6, 4], [-1, 2], [4, 2.5], [10, 0], [4, -4], [0, -7], [5, -11], [8, -10],
].map(([dx, dz]) => ({ x: ISLAND7.x + dx, z: ISLAND7.z + dz }));

// Oasis Estates: south-west, out past the chart's western edge, a planned
// community on a planned island. Not an island that happened — an island
// that was APPROVED: a flat oval pad of lawn (the PAD), a tidy grass berm,
// a ring of beach. The HOA would like you to know it is not round. It is
// an oval. There were meetings. (x east, z south; rx/rz are the pad's radii)
export const ISLAND8 = { x: -180, z: 64, r: 44 };
export const OASIS_PAD = { x: ISLAND8.x, z: ISLAND8.z, rx: 29, rz: 36, h: 1.4 };
// the pad's "radius" in pad units: 1 at the lawn's edge (the berm and the
// beach run on out to ~1.42)
export function oasisE(x, z) {
  return Math.hypot((x - OASIS_PAD.x) / OASIS_PAD.rx, (z - OASIS_PAD.z) / OASIS_PAD.rz);
}

// The Isle of Cran: south-east of Notbell, over a footbridge from Grove Isle
// (north-east of it). A cranberry bog. Low, flat and wet: a mossy village
// on the west bank, the bog beds east of the creek (one of them flooded for
// the harvest), and the creek itself, cutting through from north to south.
// Pad-local (u east, v south) from the center.
export const ISLAND9 = { x: 146, z: 54, r: 27 };
export const CRAN_CREEK = [[3, -30], [2, -17], [7, -9], [4, -1], [10, 7], [8, 15], [13, 30]];
export const CRAN_BEDS = [
  { u0: 9, u1: 17, v0: -17, v1: -10 },
  { u0: 12, u1: 20, v0: -6, v1: 2, flooded: true }, // harvest: the bed is under water and the berries float
  { u0: 13, u1: 20, v0: 5, v1: 12 },
];
export function cranCreekDist(x, z) {
  const u = x - ISLAND9.x, v = z - ISLAND9.z;
  let best = Infinity;
  for (let i = 0; i < CRAN_CREEK.length - 1; i++) {
    const [ax, az] = CRAN_CREEK[i], [bx, bz] = CRAN_CREEK[i + 1];
    const dx = bx - ax, dz = bz - az, l2 = dx * dx + dz * dz;
    const t = Math.max(0, Math.min(1, ((u - ax) * dx + (v - az) * dz) / l2));
    best = Math.min(best, Math.hypot(u - (ax + dx * t), v - (az + dz * t)));
  }
  return best;
}
export function cranBedAt(x, z, pad = 0) {
  const u = x - ISLAND9.x, v = z - ISLAND9.z;
  return CRAN_BEDS.find((b) => u > b.u0 - pad && u < b.u1 + pad && v > b.v0 - pad && v < b.v1 + pad) || null;
}

const TERRACE = 2.4; // height of each AC-style terrace step

function maskAt(x, z, cx, cz, R, wobbleAmp) {
  const d = Math.hypot(x - cx, z - cz);
  const wobble = (vnoise(x * 0.04 + 9.2 + cx * 0.13, z * 0.04 - 4.7 + cz * 0.13) - 0.5) * wobbleAmp;
  const r = R + wobble;
  return smoothstep(r + 4, r - 12, d); // 1 inside the island, 0 far at sea
}

function islandMask(x, z) {
  return Math.max(
    maskAt(x, z, 0, 0, ISLAND_RADIUS, 14),
    maskAt(x, z, ISLAND2.x, ISLAND2.z, ISLAND2.r, 10),
    maskAt(x, z, ISLAND2_EAST.x, ISLAND2_EAST.z, ISLAND2_EAST.r, 6),
    maskAt(x, z, ISLAND3.x, ISLAND3.z, ISLAND3.r, 9),
    maskAt(x, z, TEXAS.x, TEXAS.z, TEXAS.r, 4),
    maskAt(x, z, ISLAND4.x, ISLAND4.z, ISLAND4.r, 6),
    maskAt(x, z, ISLAND5.x, ISLAND5.z, ISLAND5.r, 8),
    maskAt(x, z, ISLAND5_HAND[0].x, ISLAND5_HAND[0].z, ISLAND5_HAND[0].r, 4),
    maskAt(x, z, ISLAND5_HAND[1].x, ISLAND5_HAND[1].z, ISLAND5_HAND[1].r, 4),
    maskAt(x, z, ISLAND5_SOUTH.x, ISLAND5_SOUTH.z, ISLAND5_SOUTH.r, 7),
    maskAt(x, z, ISLAND6.x, ISLAND6.z, ISLAND6.r, 9),
    maskAt(x, z, ISLAND6_WEST.x, ISLAND6_WEST.z, ISLAND6_WEST.r, 7),
    ...BEACH_LOBES.map((b) => maskAt(x, z, b.x, b.z, b.r, 7)),
    maskAt(x, z, ISLAND7.x, ISLAND7.z, ISLAND7.r, 8),
    maskAt(x, z, ISLAND7_FLATS.x, ISLAND7_FLATS.z, ISLAND7_FLATS.r, 5),
    maskAt(x, z, ISLAND7_NECK.x, ISLAND7_NECK.z, ISLAND7_NECK.r, 3),
    maskAt(x, z, ISLAND7_BACK.x, ISLAND7_BACK.z, ISLAND7_BACK.r, 4)
  );
}

// The raw island, before any village flattening.
function baseHeight(x, z) {
  const m = islandMask(x, z);
  let h = fbm(x * 0.05 + 3.1, z * 0.05 + 1.7) * 9;
  // soften the hills into flat-topped terraces with steep little cliffs
  const step = Math.floor(h / TERRACE);
  const frac = h / TERRACE - step;
  h = (step + smoothstep(0.6, 0.95, frac)) * TERRACE * 0.85;
  h = (h + 1.4) * m - 1.5;

  // the volcano: a tall cone with a sunken crater, wearing a slight wobble
  const vd = Math.hypot(x - VOLCANO.x, z - VOLCANO.z);
  if (vd < VOLCANO.r + 6) {
    const wobble = (vnoise(x * 0.1 + 4.4, z * 0.1 - 8.1) - 0.5) * 1.6;
    const cone = (1 - vd / VOLCANO.r) * 17 - 1.5 + wobble;
    const crater = smoothstep(4.2, 0, vd) * 7.5;
    h = Math.max(h, cone - crater);
  }
  // the Labs beach: land within a soft, wobbly ellipse eases down toward
  // sand height — a shore that shelves gently instead of a flat disc
  {
    const ex = (x - ISLAND6_BEACH.x) / 17, ez = (z - (ISLAND6_BEACH.z - 1)) / 9.5;
    const e = Math.hypot(ex, ez) + (vnoise(x * 0.11 + 3.3, z * 0.11 - 1.1) - 0.5) * 0.35;
    if (e < 1.5 && h > 0.3) h += (0.3 - h) * smoothstep(1.5, 0.75, e);
  }
  // the volcano's shelf: a low black-sand apron on its south-west foot, room
  // enough for a fire and a good long bask (the old shelf was a towel)
  const sd = Math.hypot(x - VOLCANO_SHELF.x, z - VOLCANO_SHELF.z);
  if (sd < VOLCANO_SHELF.r + 4) {
    h = Math.max(h, smoothstep(VOLCANO_SHELF.r + 4, VOLCANO_SHELF.r, sd) * 1.1 - 0.6);
  }
  // the Isle of Cran: land a hand above the tide, the creek cut through it,
  // the bog beds sunk into it (one of them flooded to the brim)
  {
    const d = Math.hypot(x - ISLAND9.x, z - ISLAND9.z);
    if (d < ISLAND9.r + 10) {
      const R = ISLAND9.r + (vnoise(x * 0.08 + 1.3, z * 0.08 + 7.7) - 0.5) * 6;
      let hh = d < R - 5 ? 1.0 : d < R - 1 ? 1.0 + (0.3 - 1.0) * smoothstep(R - 5, R - 1, d) : 0.3 + (-1.6 - 0.3) * smoothstep(R - 1, R + 7, d);
      hh += (vnoise(x * 0.3 + 4.1, z * 0.3 - 2.2) - 0.5) * 0.12 * (d < R - 5 ? 1 : 0); // a little lumpy, like moss is
      if (d < R - 3) {
        const bed = cranBedAt(x, z, 0.6);
        if (bed) {
          const inner = cranBedAt(x, z, -0.4);
          const k = inner ? 1 : 0.5;
          hh += ((bed.flooded ? -1.0 : 0.45) - hh) * k;
        }
      }
      const cd = cranCreekDist(x, z);
      if (cd < 3.2) hh = Math.min(hh, -1.15 + (hh + 1.15) * smoothstep(1.3, 3.2, cd));
      h = d < R - 3 ? hh : Math.max(h, hh);
    }
  }
  // Oasis Estates: graded. the lawn is dead flat, the berm is a tidy slope,
  // the beach is the only part of the island nobody's filed a form about
  {
    let e = oasisE(x, z);
    if (e < 1.6) {
      if (e > 1) e += (vnoise(x * 0.09 + 5.5, z * 0.09 - 2.2) - 0.5) * 0.12; // (the sea doesn't take direction)
      const planned = e <= 1 ? OASIS_PAD.h
        : e < 1.14 ? OASIS_PAD.h + (0.3 - OASIS_PAD.h) * smoothstep(1, 1.14, e)
        : 0.3 + (-1.6 - 0.3) * smoothstep(1.14, 1.5, e);
      h = e <= 1.02 ? planned : Math.max(h, planned);
    }
  }
  // Farther's mountain: a soft grassy peak that terraces like everything else
  const md = Math.hypot(x - MOUNT7.x, z - MOUNT7.z);
  if (md < MOUNT7.r) {
    const k = 1 - md / MOUNT7.r;
    const peak = MOUNT7.h * Math.pow(k, 1.35) + (vnoise(x * 0.15 + 2.2, z * 0.15 - 7.1) - 0.5) * 1.4 * k;
    h = Math.max(h, peak * m + h * (1 - m)); // only where there's island under it
  }
  return h;
}

// ---------------------------------------------------------------- sites ----
// Deterministic spots for the village plaza, the glow worm cave, and the
// tide pools, found by scanning baseHeight — then terrainHeight() gently
// flattens a plateau at each one so buildings and pools sit naturally.

function scanAround(cx, cz, test, rMin, rMax) {
  for (let r = rMin; r <= rMax; r += 1.5) {
    for (let a = 0; a < Math.PI * 2; a += 0.22) {
      const x = cx + Math.cos(a) * r;
      const z = cz + Math.sin(a) * r;
      const result = test(x, z);
      if (result) return result;
    }
  }
  return null;
}

const scanFor = (test, rMin, rMax) => scanAround(0, 0, test, rMin, rMax);

function flatEnough(x, z, sampleR, lo, hi, maxSpread) {
  let min = Infinity, max = -Infinity, sum = 0, n = 0;
  for (let a = 0; a < Math.PI * 2; a += Math.PI / 4) {
    for (const rr of [0, sampleR * 0.55, sampleR]) {
      const h = baseHeight(x + Math.cos(a) * rr, z + Math.sin(a) * rr);
      min = Math.min(min, h);
      max = Math.max(max, h);
      sum += h;
      n++;
      if (rr === 0) break; // center once
    }
  }
  if (min < lo || max > hi || max - min > maxSpread) return null;
  return sum / n;
}

function findVillage() {
  return scanFor((x, z) => {
    const avg = flatEnough(x, z, 9, 1.2, 6.2, 2.8);
    return avg === null ? null : { x, z, r: 13, h: avg };
  }, 4, 18) ?? { x: 0, z: 6, r: 13, h: 2.2 };
}

function findCave(village) {
  return scanFor((x, z) => {
    if (Math.hypot(x - village.x, z - village.z) < 26) return null;
    const h = baseHeight(x, z);
    if (h < 3.9) return null;
    return { x, z, r: 6, h };
  }, 14, ISLAND_RADIUS - 6) ?? { x: -20, z: -20, r: 6, h: 4.2 };
}

function findPools(village, cave) {
  return scanFor((x, z) => {
    if (Math.hypot(x - village.x, z - village.z) < 22) return null;
    if (Math.hypot(x - cave.x, z - cave.z) < 16) return null;
    const h = baseHeight(x, z);
    if (h < -0.2 || h > 0.35) return null;
    // want open water just beyond — pools live at the sea's edge
    const ox = x * 1.25, oz = z * 1.25;
    if (baseHeight(ox, oz) > WATER_Y - 0.1) return null;
    return { x, z, r: 7, h: 0.18 };
  }, 18, ISLAND_RADIUS + 6) ?? { x: 0, z: ISLAND_RADIUS, r: 7, h: 0.18 };
}

function findHome(village, cave, pools) {
  return scanFor((x, z) => {
    const dv = Math.hypot(x - village.x, z - village.z);
    if (dv < 15 || dv > 24) return null;
    if (Math.hypot(x - cave.x, z - cave.z) < 14) return null;
    if (Math.hypot(x - pools.x, z - pools.z) < 14) return null;
    const avg = flatEnough(x, z, 5.5, 0.9, 6, 2.6);
    return avg === null ? null : { x, z, r: 8, h: Math.max(avg, 1.0) };
  }, 6, ISLAND_RADIUS - 6) ?? { x: village.x + 16, z: village.z + 10, r: 8, h: 2.0 };
}

// ----- Far Isle sites: the little town, the public garden, the Old Singer
function findTown2() {
  return scanAround(ISLAND2.x, ISLAND2.z, (x, z) => {
    const avg = flatEnough(x, z, 7, 1.0, 5.5, 2.6);
    return avg === null ? null : { x, z, r: 10, h: avg };
  }, 2, 14) ?? { x: ISLAND2.x, z: ISLAND2.z, r: 10, h: 2.0 };
}

function findGarden2(town2) {
  // the bridge and rail come in from the home island's direction — keep the
  // garden well off that approach so nobody gardens on the tracks
  const toHome = { x: -ISLAND2.x, z: -ISLAND2.z };
  const homeLen = Math.hypot(toHome.x, toHome.z);
  return scanAround(ISLAND2.x, ISLAND2.z, (x, z) => {
    if (Math.hypot(x - town2.x, z - town2.z) < 15) return null;
    const dx = x - ISLAND2.x, dz = z - ISLAND2.z;
    const d = Math.hypot(dx, dz) || 1;
    if ((dx * toHome.x + dz * toHome.z) / (d * homeLen) > -0.05) return null; // strait side
    const avg = flatEnough(x, z, 4.5, 0.8, 5.5, 2.4);
    return avg === null ? null : { x, z, r: 6.5, h: avg };
  }, 6, ISLAND2.r - 4) ?? { x: ISLAND2.x + 12, z: ISLAND2.z - 12, r: 6.5, h: 1.6 };
}

function findBones(town2) {
  // the strait (and its bridges) comes in from the home island's direction —
  // the Old Singer rests on a far shore, not under the train
  const toHome = { x: -ISLAND2.x, z: -ISLAND2.z };
  const homeLen = Math.hypot(toHome.x, toHome.z);
  // she rests on the new east lobe: a long, low stretch with room for all
  // sixteen units of her, nose to tail, on dry sand
  return scanAround(ISLAND2_EAST.x, ISLAND2_EAST.z, (x, z) => {
    if (Math.hypot(x - town2.x, z - town2.z) < 14) return null;
    const dx = x - ISLAND2.x, dz = z - ISLAND2.z;
    const d = Math.hypot(dx, dz) || 1;
    if ((dx * toHome.x + dz * toHome.z) / (d * homeLen) > -0.1) return null; // strait side
    const h = baseHeight(x, z);
    if (h < 0.1 || h > 2.6) return null;
    return { x, z, r: 7, h: Math.max(0.35, h) };
  }, 0, ISLAND2_EAST.r) ?? { x: ISLAND2_EAST.x, z: ISLAND2_EAST.z, r: 7, h: 0.6 };
}

function findDock(village, pools) {
  // a shore spot on the home island, clear of the pools and the bridge line
  const bridgeDir = { x: ISLAND2.x, z: ISLAND2.z };
  const bl = Math.hypot(bridgeDir.x, bridgeDir.z);
  return scanFor((x, z) => {
    if (Math.hypot(x - pools.x, z - pools.z) < 16) return null;
    if (Math.hypot(x - village.x, z - village.z) < 18) return null;
    const d = Math.hypot(x, z) || 1;
    if ((x * bridgeDir.x + z * bridgeDir.z) / (d * bl) > 0.75) return null; // bridge side
    const h = baseHeight(x, z);
    if (h < -0.15 || h > 0.3) return null;
    // open water just beyond, for rowing out
    if (baseHeight(x * 1.3, z * 1.3) > WATER_Y - 0.2) return null;
    return { x, z, r: 6, h: 0.18 };
  }, 20, ISLAND_RADIUS + 6) ?? { x: -ISLAND_RADIUS, z: 8, r: 6, h: 0.18 };
}

const village = findVillage();
const cave = findCave(village);
const pools = findPools(village, cave);
const home = findHome(village, cave, pools);
const dock = findDock(village, pools);
const town2 = findTown2();
const garden2 = findGarden2(town2);
const bones = findBones(town2);
// a flat black-sand shelf at the volcano's foot, on the side you row in from
const vbeach = { x: VOLCANO.x, z: VOLCANO.z + VOLCANO.r + 2, r: 8, h: 0.45 };

// Texas gets one flat yard, which is plenty of Texas
const texasYard = { x: TEXAS.x, z: TEXAS.z, r: 5.5, h: 0.8 };

// BULKO requires a great deal of flatness. it's basically all parking lot.
const bigbox = { x: ISLAND4.x, z: ISLAND4.z, r: 17, h: 0.8 };

// Notbell Labs: a flat campus for the facility, a flat apron for the rocket.
// science prefers level ground; the paperwork alone demands it.
const labsYard = { x: -124, z: -58, r: 14, h: 1.6 };
const labsPad = { x: -134, z: -78, r: 10, h: 1.6 };

// the Fold: a green, a field, and a small hill of well-kept stones.
// plain folk like their ground the way the Cod made it — mostly.
const steading = { x: -193, z: -50, r: 12, h: 1.5 };
const foldFields = { x: -180, z: -64, r: 9, h: 1.3 };
const kirkyard = { x: -201, z: -41, r: 6, h: 2.2 };

// Farther Isle: a camp clearing, a store yard, and the mangrove flats —
// which flatten to just above the waterline, so the tide can visit.
const camp = { x: ISLAND7.x - 1, z: ISLAND7.z + 4, r: 12, h: 1.6 };
const storeYard = { x: ISLAND7.x - 13, z: ISLAND7.z - 3, r: 7, h: 1.6 };
const mangroveFlats = { x: ISLAND7_FLATS.x, z: ISLAND7_FLATS.z, r: ISLAND7_FLATS.r, h: -0.3 };

// Grove Isle's three clearings: the manor court, the springs, the orchard
const manor = scanAround(ISLAND5.x, ISLAND5.z, (x, z) => {
  const avg = flatEnough(x, z, 7, 1.0, 6, 2.8);
  return avg === null ? null : { x, z, r: 11, h: avg };
}, 2, 14) ?? { x: ISLAND5.x, z: ISLAND5.z, r: 11, h: 2.0 };

// the manor's gravel forecourt (fountain and all) gets level ground of its
// own — it used to hang half off the hillside below the front steps. It's
// flattened LAST, so the southern orchard's lower plateau can't tug at it.
const forecourt = { x: manor.x, z: manor.z + 6, r: 9, h: manor.h };

const springs = scanAround(ISLAND5.x, ISLAND5.z, (x, z) => {
  if (Math.hypot(x - manor.x, z - manor.z) < 16) return null;
  const avg = flatEnough(x, z, 5, 0.6, 5.5, 2.6);
  return avg === null ? null : { x, z, r: 9, h: Math.max(avg, 0.9) };
}, 8, ISLAND5.r - 2) ?? { x: ISLAND5.x - 12, z: ISLAND5.z + 8, r: 9, h: 1.2 };

const southOrchard = { x: ISLAND5_SOUTH.x, z: ISLAND5_SOUTH.z - 2, r: 11, h: 1.4 };

const orchard = scanAround(ISLAND5.x, ISLAND5.z, (x, z) => {
  if (Math.hypot(x - manor.x, z - manor.z) < 15) return null;
  if (Math.hypot(x - springs.x, z - springs.z) < 14) return null;
  const avg = flatEnough(x, z, 6, 0.8, 5.5, 2.8);
  return avg === null ? null : { x, z, r: 9, h: avg };
}, 8, ISLAND5.r) ?? { x: ISLAND5.x + 10, z: ISLAND5.z - 10, r: 9, h: 1.6 };

// the north island's little clearing, for the library and the clinic
const town3 = scanAround(ISLAND3.x, ISLAND3.z, (x, z) => {
  const avg = flatEnough(x, z, 6.5, 1.0, 5.5, 2.6);
  return avg === null ? null : { x, z, r: 13, h: avg }; // wide enough for the library AND the clinic
}, 2, 13) ?? { x: ISLAND3.x, z: ISLAND3.z, r: 13, h: 1.8 };
// the cave mound's dark opening faces the village so you approach it head-on
cave.facing = Math.atan2(village.x - cave.x, village.z - cave.z);

export const SITES = { village, cave, pools, home, dock, town2, garden2, bones, vbeach, town3, texasYard, bigbox, manor, springs, orchard, southOrchard, labsYard, labsPad, steading, foldFields, kirkyard, camp, storeYard, mangroveFlats };

// Player begins at the south edge of the plaza, looking at the village.
export const PLAYER_SPAWN = { x: village.x, z: village.z + 9 };

export function clearOfSites(x, z, margin = 2) {
  for (const s of [village, cave, pools, home, dock, town2, garden2, bones, vbeach, town3, texasYard, bigbox, manor, springs, orchard, southOrchard, labsYard, labsPad, steading, foldFields, kirkyard, camp, storeYard, mangroveFlats, forecourt]) {
    if (Math.hypot(x - s.x, z - s.z) < s.r + margin) return false;
  }
  return true;
}

// Analytic height — everything (player, NPCs, props) samples this directly,
// so nothing needs raycasts to stand on the ground.
export function terrainHeight(x, z) {
  let h = baseHeight(x, z);
  for (const s of [village, cave, pools, home, dock, town2, garden2, bones, vbeach, town3, texasYard, bigbox, manor, springs, orchard, southOrchard, labsYard, labsPad, steading, foldFields, kirkyard, camp, storeYard, mangroveFlats, forecourt]) {
    const d = Math.hypot(x - s.x, z - s.z);
    if (d < s.r) {
      const w = smoothstep(s.r, s.r * 0.45, d);
      h = h + (s.h - h) * w;
    }
  }
  return h;
}

// Deterministic spiral search for a pleasant flat-ish spot near the center.
export function findOpenSpot(minH = 0.6, maxH = 3) {
  for (let r = 0; r < 26; r += 2) {
    for (let a = 0; a < Math.PI * 2; a += 0.5) {
      const x = Math.cos(a) * r;
      const z = Math.sin(a) * r;
      const h = terrainHeight(x, z);
      if (h > minH && h < maxH) return { x, z };
    }
  }
  return { x: 0, z: 0 };
}

// the island wears the season it loaded in
const GRASS_BY_SEASON = {
  spring: [0x66c25a, 0x7bd06a],
  summer: [0x5fb74a, 0x6ec45a],
  autumn: [0x9aa04e, 0xb0a23e],
  winter: [0xcfdcd4, 0xbfd0c8],
};
const [GRASS_A, GRASS_B] = GRASS_BY_SEASON[SEASON] || GRASS_BY_SEASON.summer;
const COL_GRASS_A = new THREE.Color(GRASS_A);
const COL_GRASS_B = new THREE.Color(GRASS_B);
const COL_SAND = new THREE.Color(0xecdfa8);
const COL_SAND_WET = new THREE.Color(0xc9b178);
const COL_DIRT = new THREE.Color(0x8a6f4d);
const COL_PLAZA = new THREE.Color(0xd9c08f);
const COL_BASALT = new THREE.Color(0x55504c);
const COL_CINDER = new THREE.Color(0x6e5048);
// the north island ignores the seasons; moss has tenure
const COL_MOSS_A = new THREE.Color(0x4f8a52);
const COL_MOSS_B = new THREE.Color(0x5e975e);
const COL_ASPHALT = new THREE.Color(0x595a5e);
const COL_CONCRETE = new THREE.Color(0xb6b1a4);
const COL_TILLED = new THREE.Color(0x9a7b52);
const COL_MUD = new THREE.Color(0x9a8365);
// Oasis Estates ignores the seasons too. The lawn is two and a half inches,
// green, and mown in stripes, by covenant.
const COL_LAWN_A = new THREE.Color(0x58c04a);
// the Isle of Cran: dark moss that ignores the seasons (it is older than them),
// and the bog beds, which are cranberry-red all year
const COL_CRANMOSS_A = new THREE.Color(0x3d6b38);
const COL_CRANMOSS_B = new THREE.Color(0x4a7a42);
const COL_BOG = new THREE.Color(0x6e2f35);
const COL_LAWN_B = new THREE.Color(0x6cce5a); // the mangrove flats, honest tidal mud
const COL_MUD_WET = new THREE.Color(0x7d6b52);
const COL_ROCK_TOP = new THREE.Color(0x9a948a);

function onTrail(x, z) {
  if (Math.hypot(x - MOUNT7.x, z - MOUNT7.z) > MOUNT7.r + 10) return false;
  for (let i = 0; i < TRAIL7.length - 1; i++) {
    const a = TRAIL7[i], b = TRAIL7[i + 1];
    const dx = b.x - a.x, dz = b.z - a.z, l2 = dx * dx + dz * dz;
    const t = Math.max(0, Math.min(1, ((x - a.x) * dx + (z - a.z) * dz) / l2));
    if (Math.hypot(x - (a.x + dx * t), z - (a.z + dz * t)) < 0.95) return true;
  }
  return false;
}

export function createTerrain() {
  // wider than tall: the west got longer when the Labs moved in
  const SIZE_X = 460, SIZE_Z = 320, SEG_X = 274, SEG_Z = 190;
  let geo = new THREE.PlaneGeometry(SIZE_X, SIZE_Z, SEG_X, SEG_Z);
  geo.rotateX(-Math.PI / 2);
  geo.translate(0, 0, 0); // x spans -230..230 (Farther is FAR); the chart still ends at -130

  const pos = geo.attributes.position;
  for (let i = 0; i < pos.count; i++) {
    pos.setY(i, terrainHeight(pos.getX(i), pos.getZ(i)));
  }

  // Per-face colors need unshared vertices.
  geo = geo.toNonIndexed();
  const p = geo.attributes.position;
  const colors = new Float32Array(p.count * 3);
  const color = new THREE.Color();
  const va = new THREE.Vector3(), vb = new THREE.Vector3(), vc = new THREE.Vector3();
  const e1 = new THREE.Vector3(), e2 = new THREE.Vector3(), n = new THREE.Vector3();

  for (let i = 0; i < p.count; i += 3) {
    va.fromBufferAttribute(p, i);
    vb.fromBufferAttribute(p, i + 1);
    vc.fromBufferAttribute(p, i + 2);
    const y = (va.y + vb.y + vc.y) / 3;
    n.crossVectors(e1.subVectors(vb, va), e2.subVectors(vc, va)).normalize();

    const dVillage = Math.hypot(va.x - village.x, va.z - village.z);
    const dTown2 = Math.hypot(va.x - town2.x, va.z - town2.z);
    const dVolcano = Math.hypot(va.x - VOLCANO.x, va.z - VOLCANO.z);

    const dFlats = Math.hypot(va.x - mangroveFlats.x, va.z - mangroveFlats.z);
    if (y < WATER_Y) {
      color.copy(dFlats < mangroveFlats.r + 3 ? COL_MUD_WET : COL_SAND_WET);
    } else if (y < 0.42) {
      color.copy(dFlats < mangroveFlats.r + 3 ? COL_MUD : COL_SAND);
    } else if (dVolcano < VOLCANO.r + 2) {
      color.copy(y > 9 ? COL_CINDER : COL_BASALT); // her slopes, her colors
    } else if (onTrail(va.x, va.z)) {
      color.copy(COL_DIRT); // the summit trail, worn in by boots and hooves
    } else if (Math.hypot(va.x - MOUNT7.x, va.z - MOUNT7.z) < MOUNT7.r * 0.35 && y > MOUNT7.h * 0.62) {
      color.copy(COL_ROCK_TOP); // bare rock up top, where the wind lives
    } else if (n.y < 0.65) {
      color.copy(COL_DIRT); // steep terrace walls read as earth
    } else if (dVillage < 6.5 || dTown2 < 5.5) {
      color.copy(COL_PLAZA); // packed earth around the squares
    } else if (Math.hypot(va.x - ISLAND4.x, va.z - ISLAND4.z) < 14) {
      color.copy(COL_ASPHALT); // the lot. nobody saw it paved. it is paved.
    } else if (Math.hypot(va.x - labsYard.x, va.z - labsYard.z) < labsYard.r - 1 ||
               Math.hypot(va.x - labsPad.x, va.z - labsPad.z) < labsPad.r - 1) {
      color.copy(COL_CONCRETE); // poured by the Boring Department, proudly
    } else if (Math.hypot(va.x - foldFields.x, va.z - foldFields.z) < foldFields.r - 1) {
      color.copy(COL_TILLED); // turned earth, in rows, on purpose
    } else if (Math.hypot(va.x - ISLAND9.x, va.z - ISLAND9.z) < ISLAND9.r + 2 && y > 0.3) {
      const bed = cranBedAt((va.x + vb.x + vc.x) / 3, (va.z + vb.z + vc.z) / 3);
      if (bed && !bed.flooded) color.copy(COL_BOG);
      else color.copy(vnoise(va.x * 0.5 + 3, va.z * 0.5 - 1) > 0.5 ? COL_CRANMOSS_A : COL_CRANMOSS_B);
    } else if (oasisE(va.x, va.z) < 1.16) {
      color.copy(Math.floor((va.x - OASIS_PAD.x) / 1.68 + 0.5) % 2 ? COL_LAWN_A : COL_LAWN_B); // the stripes
    } else if (Math.hypot(va.x - ISLAND3.x, va.z - ISLAND3.z) < ISLAND3.r + 6) {
      const patch = vnoise(va.x * 0.6 + 11, va.z * 0.6 - 5) > 0.5;
      color.copy(patch ? COL_MOSS_A : COL_MOSS_B);
    } else {
      const patch = vnoise(va.x * 0.6 + 11, va.z * 0.6 - 5) > 0.5;
      color.copy(patch ? COL_GRASS_A : COL_GRASS_B);
    }
    // tiny per-face brightness jitter for that hand-placed-tile feel
    color.multiplyScalar(1 + (hash2(i, 7) - 0.5) * 0.08);

    for (let k = 0; k < 3; k++) {
      colors[(i + k) * 3] = color.r;
      colors[(i + k) * 3 + 1] = color.g;
      colors[(i + k) * 3 + 2] = color.b;
    }
  }

  geo.setAttribute('color', new THREE.BufferAttribute(colors, 3));
  geo.computeVertexNormals();

  const mat = new THREE.MeshStandardMaterial({
    vertexColors: true,
    flatShading: true,
    roughness: 1,
    metalness: 0,
  });
  const mesh = new THREE.Mesh(geo, mat);
  mesh.receiveShadow = true;
  return mesh;
}

// The Grove Line: a second steam railway, green where the strait line is
// red, running from Notbell's southeast shore to Grove Isle, hopping BOTH
// panhandle islets on the way (a trestle bent on every stepping stone).
// Built from the railway kit (railway.js) — this file is just the route and
// the local color.

import { ISLAND5, ISLAND5_HAND } from './terrain.js';
import { defineLine, createRailway, marchToWater } from './railway.js';

const H1 = ISLAND5_HAND[1]; // nearer islet
const H0 = ISLAND5_HAND[0]; // farther islet
const N = marchToWater({ x: 0, z: 0 }, H1, 20); // Notbell SE shore
const G = marchToWater(ISLAND5, H0, 4);          // Grove main shore

// geometry at module load, so the trees planted later leave room for it
const LINE = defineLine({
  points: [N, { x: H1.x, z: H1.z }, { x: H0.x, z: H0.z }, G],
  stops: [
    { name: 'Notbell', toward: { x: 0, z: 0 } },
    { name: 'Grove Isle', toward: { x: ISLAND5.x, z: ISLAND5.z } },
  ],
});

export function createNorthline(player, animals = null) {
  return createRailway(LINE, {
    player, animals, name: 'the Grove Line',
    colors: { loco: 0x2f7d4f, cab: 0x1d5a38, cars: [0xb0453a, 0xd9a440], roof: 0x2f7d4f },
    dwell: 13, whistle: [540, 720],
    text: {
      board: 'All aboard the Grove Line. Oranges and old money, end of the line.',
      wait: 'Somewhere down the track, a whistle agrees to the idea.',
      queued: 'The rails hum their green-country hum.',
      kept: 'The Grove Line kept your place. All aboard.',
      arrive: [
        'Notbell. The engine catches its breath behind you.',
        'Grove Isle. It smells like oranges and a very old lawyer.',
      ],
    },
  });
}

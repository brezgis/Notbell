// The Farther Line: the third railway, salt-teal where the strait line is
// red and the Grove Line green — the long one, a proper trip over open
// water from the Far Isle's north-east shore out to Farther Isle. Two engines, one on each end,
// because the line has no turntable and no intention of apologizing: the
// one in front pulls, the one behind rides along and takes half the credit.
// (Every line works that way now — this one just said so first.)

import { ISLAND2, ISLAND7, SITES } from './terrain.js';
import { defineLine, createRailway, marchToWater } from './railway.js';

const CAMP = SITES.camp;
const FAR_ANCHOR = { x: 104, z: -40 };           // inside the Far Isle, north-east side
const F = marchToWater(FAR_ANCHOR, ISLAND7, 6);  // Far Isle's north-east shore
// Farther's south-west shore, just below the CAMP FARTHER arch — a long
// ride out over open water, which is the whole point of the place
const T = marchToWater({ x: CAMP.x - 4, z: CAMP.z + 4 }, FAR_ANCHOR, 3);

const LINE = defineLine({
  points: [F, T],
  stops: [
    { name: 'the Far Isle', toward: { x: ISLAND2.x, z: ISLAND2.z } },
    { name: 'Farther Isle', toward: { x: CAMP.x, z: CAMP.z } },
  ],
});

export function createFarline(player, animals = null) {
  return createRailway(LINE, {
    player, animals, name: 'the Farther Line',
    colors: { loco: 0x3a7d8a, cab: 0x2a5d68, cars: [0xc9705a, 0xd9c08f], roof: 0x3a7d8a },
    dwell: 15, whistle: [480, 640],
    text: {
      board: 'All aboard the Farther Line. Two engines, no turning back. Or around.',
      wait: 'Across the water, one of its two engines clears its throat.',
      queued: 'The rails hum a long, salted note.',
      kept: 'The Farther Line kept your place. All aboard.',
      arrive: [
        'The Far Isle. The engine ahead rests; the one behind takes half the credit.',
        'Farther Isle. The engine ahead rests; the one behind takes half the credit.',
      ],
    },
  });
}

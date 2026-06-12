// Game state: buttons (the currency), pockets, tools, museum donations,
// story flags. Persists to localStorage so the island remembers you.

import { ITEMS } from './catalog.js';

const SAVE_KEY = 'notbell-isle-save-v1';

export const state = {
  buttons: 100,
  inv: {},            // itemId -> count
  tools: { rod: false, net: false, shovel: false },
  donations: [],      // itemIds donated to the museum (unique)
  bottlesRead: 0,     // how many of Tansy's letters have been found
  loreToldUpTo: 0,    // highest Fern milestone already told
  flags: {},          // metPip, freeRodGiven, visitedCave, ...
  hats: [],           // hat itemIds owned
  wearing: null,      // hat currently on your head
  garden: {},         // plotIndex -> { seed, plantedAt } (epoch ms)
  seen: {},           // itemId -> lifetime catch count (for the critterpedia)
  visited: { notbell: true }, // islands you've set foot on (the chart fills in)
  errand: null,       // active delivery: { from, to } (villager names)
  lastErrandAt: 0,    // when the last errand finished (epoch ms, for cooldown)
  avatar: null,       // chosen species, e.g. { kind: 'cat', body: 0xf0c98f }
  name: null,         // what the islanders call you
  where: null,        // { zone, x, z, rotY, camYaw, camPitch, camDist }
};

let saveTimer = 0;

export function save() {
  clearTimeout(saveTimer);
  saveTimer = setTimeout(() => {
    try {
      localStorage.setItem(SAVE_KEY, JSON.stringify(state));
    } catch { /* private mode etc — the island forgives */ }
  }, 250);
}

// write-through immediately (for beforeunload, when timers don't fire)
export function saveNow() {
  clearTimeout(saveTimer);
  try {
    localStorage.setItem(SAVE_KEY, JSON.stringify(state));
  } catch { /* the island forgives */ }
}

export function load() {
  try {
    const raw = localStorage.getItem(SAVE_KEY);
    if (!raw) return;
    const data = JSON.parse(raw);
    if (data && typeof data === 'object') {
      Object.assign(state, {
        ...state,
        ...data,
        tools: { ...state.tools, ...(data.tools || {}) },
        flags: { ...(data.flags || {}) },
        inv: { ...(data.inv || {}) },
        donations: Array.isArray(data.donations) ? data.donations : [],
        hats: Array.isArray(data.hats) ? data.hats : [],
        garden: { ...(data.garden || {}) },
        seen: { ...(data.seen || {}) },
        visited: { notbell: true, ...(data.visited || {}) },
      });
    }
  } catch { /* corrupted save: start fresh */ }
}

const TRACKED = new Set(['fish', 'bug', 'fossil', 'pool', 'art']);

export function addItem(id, n = 1) {
  state.inv[id] = (state.inv[id] || 0) + n;
  if (TRACKED.has(ITEMS[id]?.kind)) {
    state.seen[id] = (state.seen[id] || 0) + n;
  }
  save();
}

export function removeItem(id, n = 1) {
  if (!state.inv[id]) return false;
  state.inv[id] -= n;
  if (state.inv[id] <= 0) delete state.inv[id];
  save();
  return true;
}

export function countItem(id) {
  return state.inv[id] || 0;
}

export function earn(n) {
  state.buttons += n;
  save();
}

export function spend(n) {
  if (state.buttons < n) return false;
  state.buttons -= n;
  save();
  return true;
}

export function giveTool(tool) {
  state.tools[tool] = true;
  save();
}

export function setFlag(name) {
  state.flags[name] = true;
  save();
}

export function hasFlag(name) {
  return !!state.flags[name];
}

// Items Pip will pay for. Tools and keepsakes aren't his to take, seeds he
// won't buy back ("store policy"), and hats are non-refungible.
const UNSELLABLE = new Set(['tool', 'keepsake', 'seed', 'hat', 'art', 'gear']);

export function sellables() {
  return Object.entries(state.inv)
    .map(([id, n]) => ({ id, n, item: ITEMS[id] }))
    .filter(({ item }) => item && item.price > 0 && !UNSELLABLE.has(item.kind));
}

export function ownHat(id) {
  if (!state.hats.includes(id)) state.hats.push(id);
  save();
}

export function wearHat(id) {
  state.wearing = id;
  save();
}

// Items Fern would accept (one of each kind of find, never duplicates).
export function donatables() {
  return Object.keys(state.inv)
    .map((id) => ({ id, item: ITEMS[id] }))
    .filter(({ id, item }) => item &&
      ['fish', 'bug', 'fossil', 'pool', 'art'].includes(item.kind) &&
      !state.donations.includes(id));
}

// Coffee from The Lantern Room makes you zippy for a while (not saved —
// the warmth wears off when you put the island down).
let coffeeUntil = 0;

export function drinkCoffee(secs) {
  coffeeUntil = performance.now() + secs * 1000;
}

export function coffeeActive() {
  return performance.now() < coffeeUntil;
}

export function donate(id) {
  if (state.donations.includes(id) || !removeItem(id, 1)) return false;
  state.donations.push(id);
  save();
  return true;
}

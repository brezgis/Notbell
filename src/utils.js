// Small math + randomness helpers shared across the island.

export function smoothstep(edge0, edge1, x) {
  const t = Math.min(1, Math.max(0, (x - edge0) / (edge1 - edge0)));
  return t * t * (3 - 2 * t);
}

// Seeded PRNG (mulberry32): every copy of the game grows the same islands,
// which matters for multiplayer guests — and means refreshing doesn't
// reshuffle your trees.
let _seed = 0x5eedbe11; // the seed bell
function mulberry() {
  _seed |= 0;
  _seed = (_seed + 0x6D2B79F5) | 0;
  let t = Math.imul(_seed ^ (_seed >>> 15), 1 | _seed);
  t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
}

export function rand01() {
  return mulberry();
}

export function rand(min, max) {
  return min + mulberry() * (max - min);
}

export function pick(arr) {
  return arr[Math.floor(mulberry() * arr.length)];
}

// Deterministic hash noise — the terrain must give the same answer for the
// same (x, z) every call, so NPCs and props can query height analytically.
export function hash2(ix, iy) {
  const s = Math.sin(ix * 127.1 + iy * 311.7) * 43758.5453123;
  return s - Math.floor(s);
}

export function vnoise(x, y) {
  const ix = Math.floor(x), iy = Math.floor(y);
  const fx = x - ix, fy = y - iy;
  const ux = fx * fx * (3 - 2 * fx);
  const uy = fy * fy * (3 - 2 * fy);
  const a = hash2(ix, iy);
  const b = hash2(ix + 1, iy);
  const c = hash2(ix, iy + 1);
  const d = hash2(ix + 1, iy + 1);
  return a + (b - a) * ux + (c - a) * uy + (a - b - c + d) * ux * uy;
}

export function fbm(x, y) {
  let v = 0, amp = 0.5, f = 1;
  for (let i = 0; i < 3; i++) {
    v += amp * vnoise(x * f, y * f);
    amp *= 0.5;
    f *= 2.03;
  }
  return v / 0.875; // roughly 0..1
}

// Shortest-arc turn toward a target yaw, frame-rate independent.
export function turnToward(current, target, dt, rate) {
  let d = target - current;
  d = Math.atan2(Math.sin(d), Math.cos(d));
  return current + d * Math.min(1, dt * rate);
}

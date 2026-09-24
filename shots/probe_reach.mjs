// Every static interactable must be reachable: some spot a body can stand
// on, within its radius, that you can actually walk to from nearby open
// ground (a small flood fill — not just "a legal spot exists").
import { boot } from './lib.mjs';
const { browser, page } = await boot();
const out = await page.evaluate(async () => {
  const N = window.__notbell;
  const bad = [];
  const list = N.interact.debugList();
  for (const it of list) {
    const zone = it.zone || 'island';
    if (N.zones.current() !== zone) {
      await N.zones.go(zone);
      await new Promise((r) => setTimeout(r, 900));
    }
    const stand = (x, z) => N.zones.canStand(x, z, 0.3);
    // flood fill from standable cells inside r, outward to 7u — reachable if
    // the fill escapes to "open ground" (≥ 5 units away) or covers many cells
    const S = 0.35, R = it.r;
    const key = (i, j) => i + ',' + j;
    const seen = new Set(), q = [];
    for (let i = -Math.ceil(R / S); i <= Math.ceil(R / S); i++) {
      for (let j = -Math.ceil(R / S); j <= Math.ceil(R / S); j++) {
        const x = it.x + i * S, z = it.z + j * S;
        if (Math.hypot(i * S, j * S) <= R && stand(x, z)) { seen.add(key(i, j)); q.push([i, j]); }
      }
    }
    let escaped = false;
    const start = q.length;
    while (q.length && seen.size < 900 && !escaped) {
      const [i, j] = q.shift();
      if (Math.hypot(i * S, j * S) > 5) { escaped = true; break; }
      for (const [di, dj] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
        const ni = i + di, nj = j + dj, k = key(ni, nj);
        if (seen.has(k)) continue;
        if (!stand(it.x + ni * S, it.z + nj * S)) continue;
        seen.add(k); q.push([ni, nj]);
      }
    }
    if (!start || (!escaped && seen.size < 40)) bad.push({ ...it, start, reach: seen.size });
  }
  return { n: list.length, bad };
});
console.log('interactables:', out.n, 'unreachable:', out.bad.length);
for (const b of out.bad) console.log(JSON.stringify(b));
await browser.close();

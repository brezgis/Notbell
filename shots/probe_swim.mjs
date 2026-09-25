// Swimming, end to end, on foot (probe_dive teleports to the reef and so
// never caught the shoreline): with the diver's suit, walk from the tide
// pools into the sea and back out; on the footbridge, walk into the rails
// (you stay on the deck); in the water beside the bridge, swim at it (you
// stay in the water, no popping up onto the deck); and a look at the kit.
import { boot, sleep, snap, view, go } from './lib.mjs';
const { browser, page } = await boot();
let fails = 0;
const check = (ok, what) => { console.log(`${ok ? 'ok  ' : 'FAIL'} ${what}`); if (!ok) fails++; };
const st = () => page.evaluate(() => {
  const N = window.__notbell, p = N.player.group.position;
  return { x: +p.x.toFixed(2), y: +p.y.toFixed(2), z: +p.z.toFixed(2), swim: p.y < -0.6 };
});
const hold = async (key, ms) => { await page.keyboard.down(key); await sleep(ms); await page.keyboard.up(key); await sleep(300); };
await page.evaluate(() => window.__notbell.S.addItem('scuba_suit'));

// 1 · the tide pools, east into the sea, and back
await go(page, 'island', { x: 12.5, z: -29, rotY: Math.PI / 2 });
await hold('KeyD', 5000);
let s = await st();
check(s.swim && s.x > 16, `walked into the sea: ${JSON.stringify(s)}`);
await view(page, { x: s.x, y: -0.4, z: s.z }, { yaw: 0.4, pitch: 0.35, dist: 4 });
await snap(page, 'paddling-goggles-up');
await view(page, null, {});
await hold('KeyA', 5000);
s = await st();
check(!s.swim && s.y > -0.45, `walked back out onto the shore: ${JSON.stringify(s)}`);

// 2 · the footbridge: find its middle, then walk sideways into the rails
const bridge = await page.evaluate(async () => {
  const m = await import('/src/bridge.js');
  let best = null;
  for (let x = 0; x < 120; x += 0.5) for (let z = -60; z < 20; z += 0.5) {
    if (m.contains(x, z)) { const h = m.deckHeight(x, z); if (!best || h > best.h) best = { x, z, h }; }
  }
  return best;
});
await go(page, 'island', { x: bridge.x, z: bridge.z });
for (const k of ['KeyW', 'KeyS', 'KeyA', 'KeyD']) {
  await go(page, 'island', { x: bridge.x, z: bridge.z });
  await hold(k, 1500);
  s = await st();
  check(!s.swim && s.y > 0.5, `on the bridge, pushing ${k}: stayed on the deck ${JSON.stringify(s)}`);
}

// 3 · in the water beside the bridge, swim at it from each side
const water = await page.evaluate(async (b) => {
  const m = await import('/src/bridge.js');
  const N = window.__notbell;
  for (let r = 2; r < 8; r += 0.5) for (let a = 0; a < 6.28; a += 0.4) {
    const x = b.x + Math.cos(a) * r, z = b.z + Math.sin(a) * r;
    if (!m.contains(x, z) && N.zones.groundHeight(x, z) < -0.7) return { x, z, a };
  }
  return null;
}, bridge);
if (water) {
  await go(page, 'island', { x: water.x, z: water.z });
  await sleep(500);
  // swim straight at the deck
  const toward = { x: bridge.x - water.x, z: bridge.z - water.z };
  const key = Math.abs(toward.x) > Math.abs(toward.z) ? (toward.x > 0 ? 'KeyD' : 'KeyA') : (toward.z > 0 ? 'KeyS' : 'KeyW');
  await hold(key, 3000);
  s = await st();
  check(s.swim, `swam at the bridge from the water: still swimming, not on the deck ${JSON.stringify(s)}`);
}

// 4 · the look, under the sea
await go(page, 'crown');
await sleep(1200);
await view(page, null, { yaw: 0.5, pitch: 0.3, dist: 4 });
await snap(page, 'under-goggles-down');
await browser.close();
console.log(fails ? `${fails} FAILED` : 'PASS');

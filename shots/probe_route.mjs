// Cross-island routing: a Far Isle villager asked to walk to the Notbell
// plaza should cross the footbridge (on the planks), not pace the shore.
import { boot, sleep } from './lib.mjs';
const { browser, page } = await boot();
const who = await page.evaluate(() => {
  const N = window.__notbell;
  const a = N.animals.animals.find((x) => x.identity && !x.away && !x.swims &&
    N.zones.islandOf(x.g.position.x, x.g.position.z) === 'far');
  window.__probeDone = null;
  a.goal = { x: 4, z: 6, r: 2, done: () => { window.__probeDone = 'arrived'; }, fail: () => { window.__probeDone = 'failed'; } };
  return a.identity.name;
});
console.log('walker:', who);
let maxY = -9, wet = 0;
for (let i = 0; i < 120; i++) {
  await sleep(2500);
  const s = await page.evaluate((n) => {
    const N = window.__notbell, a = N.animals.animals.find((x) => x.identity?.name === n);
    return { x: a.g.position.x, y: a.g.position.y, z: a.g.position.z, isle: N.zones.islandOf(a.g.position.x, a.g.position.z), via: a.goal?.via?.length ?? null, done: window.__probeDone };
  }, who);
  maxY = Math.max(maxY, s.y);
  if (s.y < -0.2) wet++;
  if (i % 6 === 0 || s.done) console.log(JSON.stringify(s));
  if (s.done) break;
}
console.log('max height on the way', maxY.toFixed(2), '· samples in the sea', wet);
await browser.close();

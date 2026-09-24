// someone should go fishing (and actually hold a rod)
import { boot, view, snap, sleep } from './lib.mjs';
const { browser, page } = await boot();
let who = null;
for (let i = 0; i < 90 && !who; i++) {
  await sleep(2000);
  who = await page.evaluate(() => {
    const a = window.__notbell.animals.animals.find((x) => x.pastime && x.busy);
    return a ? { n: a.identity.name, k: a.pastime.kind, x: a.g.position.x, y: a.g.position.y, z: a.g.position.z } : null;
  });
}
console.log('pastime:', JSON.stringify(who));
if (who) {
  await page.evaluate((w) => window.__notbell.zones.go('island', { x: w.x + 4, z: w.z + 4 }), who);
  await sleep(1500);
  await view(page, { x: who.x, y: who.y + 0.8, z: who.z }, { yaw: 0.8, pitch: 0.3, dist: 6 });
  await snap(page, 'pastime');
}
await browser.close();

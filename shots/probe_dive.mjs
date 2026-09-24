// The Dropped Crown, end to end: suit up, swim to the reef, dive, ride a
// bubble along the Kelp Highway, and swim back up.
import { boot, sleep, snap, view, press, choose, dismiss, place } from './lib.mjs';
const { browser, page } = await boot();
await page.evaluate(() => { window.__notbell.S.addItem('scuba_suit'); });
const reef = { x: 58, z: -72 };
await page.evaluate((r) => window.__notbell.zones.go('island', { x: r.x, z: r.z, rotY: 0 }), reef);
await sleep(2500);
await view(page, { x: reef.x, y: 0, z: reef.z }, { yaw: 0.6, pitch: 0.8, dist: 30 });
await snap(page, 'reef-surface');
await view(page, null, {});
const prompt = await page.evaluate(() => document.getElementById('prompt')?.textContent || '');
console.log('prompt at the reef:', prompt);
await press(page, 'KeyE', 3500);
console.log('zone after dive:', await page.evaluate(() => window.__notbell.zones.current()));
await dismiss(page);
await snap(page, 'arrived');
// walk to the bubble stop at the Crown (HWY[0]) and ride to the Glow
await place(page, -1156.5, 16.5, 0); // the Crown stop (CROWN.x - 8 + 1.5)
await sleep(1500);
console.log('prompt at stop:', await page.evaluate(() => document.getElementById('prompt')?.textContent || ''));
await press(page, 'KeyE', 800);
await choose(page, 'the Glow');
await sleep(4000);
await snap(page, 'riding');
for (let i = 0; i < 40; i++) {
  await sleep(2000);
  if (!(await page.evaluate(() => window.__notbell.player.riding))) break;
}
const p = await page.evaluate(() => ({ ...window.__notbell.player.group.position }));
console.log('arrived at', p.x.toFixed(1), p.z.toFixed(1), 'title:', await page.evaluate(() => document.getElementById('title').textContent));
await snap(page, 'glow-arrival');
await browser.close();

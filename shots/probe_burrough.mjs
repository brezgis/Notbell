// The Burrough, end to end: down the molehill by the Labs beach, ring for
// the Boring Line at the Works, ride it to Uptown, climb out into the
// Moledecai wine cellar, and back down through the little door.
import { boot, sleep, snap, view, press, choose, dismiss, place, go } from './lib.mjs';
const { browser, page } = await boot();
const O = { x: 0, z: -1300 }; // BURROUGH
const prompt = () => page.evaluate(() => document.getElementById('prompt')?.textContent || '');
const where = () => page.evaluate(() => {
  const N = window.__notbell, p = N.player.group.position;
  return { zone: N.zones.current(), x: +p.x.toFixed(1), z: +p.z.toFixed(1), riding: N.player.riding };
});
let fails = 0;
const check = (ok, what) => { console.log(`${ok ? 'ok  ' : 'FAIL'} ${what}`); if (!ok) fails++; };

// 1 · the molehill
const hill = await page.evaluate(() => window.__notbell.player.group.parent.getObjectByName('burrough').userData.molehill);
await go(page, 'island', { x: hill.x, z: hill.z + 1.2, rotY: Math.PI });
await sleep(1200);
await view(page, { x: hill.x, y: 0.5, z: hill.z }, { yaw: 0.4, pitch: 0.5, dist: 9 });
await snap(page, 'molehill');
await view(page, null, {});
check((await prompt()).includes('molehill'), `prompt at the molehill: “${await prompt()}”`);
await press(page, 'KeyE', 3000);
await dismiss(page);
check((await where()).zone === 'burrough', `down the molehill → ${JSON.stringify(await where())}`);
await snap(page, 'arrived-works');

// 2 · the Boring Line: ring, wait, board, ride to Uptown
await place(page, O.x - 52, O.z + 0.4, Math.PI);
await sleep(800);
let pr = await prompt();
console.log('prompt at the Works stop:', pr);
if (pr.includes('ring')) {
  await press(page, 'KeyE', 500);
  for (let i = 0; i < 60 && !(await prompt()).includes('board'); i++) await sleep(1000);
}
check((await prompt()).includes('board'), `the car came: “${await prompt()}”`);
for (let i = 0; i < 40; i++) {
  if ((await prompt()).includes('board')) {
    await press(page, 'KeyE', 1500);
    if (await page.evaluate(() => document.querySelector('#choices')?.style.display !== 'none')) break;
  }
  await sleep(1000);
}
await choose(page, 'Uptown');
await sleep(3000);
check((await where()).riding, `riding: ${JSON.stringify(await where())}`);
await view(page, null, { yaw: 0, pitch: 0.55, dist: 16 });
await snap(page, 'riding');
await view(page, null, {});
for (let i = 0; i < 90 && (await where()).riding; i++) await sleep(1000);
const off = await where();
check(!off.riding && Math.abs(off.x - (O.x + 52)) < 3, `got off at Uptown: ${JSON.stringify(off)}`);
await snap(page, 'uptown-platform');

// 3 · up the ladder into the wine cellar, and back through the little door
await place(page, O.x + 64, O.z - 9.2, Math.PI);
await sleep(600);
check((await prompt()).includes('cellar'), `prompt at the east ladder: “${await prompt()}”`);
await press(page, 'KeyE', 3000);
await dismiss(page);
check((await where()).zone === 'cellar', `up into the cellar → ${JSON.stringify(await where())}`);
await snap(page, 'cellar');
check((await prompt()).includes('little door'), `prompt by the cellar door: “${await prompt()}”`);
await press(page, 'KeyE', 3000);
await dismiss(page);
check((await where()).zone === 'burrough', `back down → ${JSON.stringify(await where())}`);

await browser.close();
console.log(fails ? `${fails} FAILED` : 'PASS');

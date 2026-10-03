// The Famiglia, end to end (northend.js): Benny grates to the rind (never
// say when) → the matchbook → Vinnie's can → the lair → the Don (a slice of
// parm, the fedora) → the vault → and, at 2:30 a.m., the night shift behind
// BULKO (a Polaroid). PASS/FAIL per step, a few shots along the way.
import { boot, go, view, snap, sleep, press, advance, choose, dismiss, promptText } from './lib.mjs';
const { browser, page } = await boot();
const flag = (f) => page.evaluate((k) => window.__notbell.S.hasFlag(k), f);
const item = (i) => page.evaluate((k) => window.__notbell.S.countItem(k), i);
const N = { x: 146, z: 15 }, O = { x: -300, z: 1920 }, L = { x: -300, z: 2180 };
let ok = true;
const check = (name, v) => { console.log(`${v ? 'PASS' : 'FAIL'}  ${name}`); ok &&= !!v; };
const talk = async (zn, x, z, rotY = Math.PI) => { await go(page, zn, { x, z, rotY }); await sleep(600); await press(page, 'KeyE', 900); };

// 1. Benny: just the parm, and never say when
await talk('cran_olive', O.x + 2.9, O.z + 5.2);
await choose(page, 'Just some parm');
await advance(page);
for (let k = 0; k < 5; k++) { await choose(page, 'eep going'); await advance(page); }
await advance(page);
await dismiss(page);
check('never said when → matchbook', (await flag('famigliaInvite')) && (await item('matchbook')) === 1);

// 2. the can at the end of the Alley of the Saints
await go(page, 'island', { x: N.x + 3.4, z: N.z - 11.0, rotY: Math.PI });
await sleep(800);
await press(page, 'KeyE', 1500);
await choose(page, 'Benny');
await advance(page);
await page.waitForFunction(() => window.__notbell.zones.current() === 'cran_lair', { timeout: 20000 }).catch(() => {});
check('the can → the lair', await page.evaluate(() => window.__notbell.zones.current() === 'cran_lair'));
await sleep(1000);
await view(page, { x: L.x, y: 0, z: L.z - 1 }, { yaw: 0, pitch: 0.95, dist: 26 });
await snap(page, 'lair');
await view(page, null);

// 3. the Don
await talk('cran_lair', L.x - 6, L.z - 2.6);
await advance(page);
await choose(page, 'A slice');
for (let k = 0; k < 4; k++) { await sleep(600); await advance(page); }
await dismiss(page);
check('the Don → famiglia + parm + fedora', (await flag('famiglia')) && (await item('parm_slice')) === 1 &&
  await page.evaluate(() => window.__notbell.S.state.hats.includes('fedora')));

// 4. the vault
const before = await page.evaluate(() => window.__notbell.S.state.buttons);
await talk('cran_lair', L.x + 6.25, L.z - 7.6);
await sleep(2500);
await advance(page);
await dismiss(page);
check('dive into the buttons → +1 (interest)', (await page.evaluate(() => window.__notbell.S.state.buttons)) === before + 1);

// 5. the night shift (2:30 a.m.)
await page.evaluate(() => { window.__notbellTz = 14; });
await go(page, 'island', { x: 14, z: 78, rotY: 0 });
await sleep(2000);
await view(page, { x: 13, y: 0, z: 79 }, { yaw: Math.PI, pitch: 0.75, dist: 16 });
await snap(page, 'heist');
await view(page, null);
let near = false;
for (let i = 0; i < 8 && !near; i++) {
  await page.evaluate(() => {
    const N = window.__notbell, root = N.player.group.parent.getObjectByName('northEnd');
    let sal = null;
    root.traverse((o) => { if (!sal && o.userData?.parts && o.parent?.userData?.noMerge && o.position.y > 0 && Math.abs(o.position.x - 10) < 6) sal = o; });
    if (sal) { N.player.group.position.x = sal.position.x + 1.0; N.player.group.position.z = sal.position.z; }
  });
  await sleep(500);
  near = (await promptText(page)).includes('ferret');
}
await press(page, 'KeyE', 1500);
for (let k = 0; k < 5; k++) { await sleep(1200); await advance(page); }
await dismiss(page);
check('the night shift → a Polaroid', (await flag('heistDone')) && (await item('heist_photo')) === 1);

console.log(ok ? 'PASS' : 'FAIL');
await browser.close();

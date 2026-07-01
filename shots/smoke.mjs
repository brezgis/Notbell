// Boot smoke test — no screenshots, just "does the game come up and move".
// Exits 0 on pass, 1 on any page error / stuck boot. Cheap enough to run
// after every change:  node smoke.mjs [port]
// (boot-time page errors print via lib's logger; post-boot ones fail the run)

import { boot, go, pos, walk } from './lib.mjs';

const port = Number(process.argv[2]) || 8123;

let browser, page;
try {
  ({ browser, page } = await boot({ port }));
} catch (e) {
  console.error('FAIL: boot —', e.message);
  process.exit(1);
}

const errors = [];
page.on('pageerror', (e) => errors.push(e.message));
page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });

const before = await pos(page);
await walk(page, 'KeyW', 1200);
const after = await pos(page);
const moved = Math.hypot(after.x - before.x, after.z - before.z) > 0.2;

await go(page, 'shop');
const inShop = (await pos(page)).zone === 'shop';
await go(page, 'island');
const backOut = (await pos(page)).zone === 'island';

await browser.close();

const ok = moved && inShop && backOut && errors.length === 0;
console.log(`moved: ${moved} · shop: ${inShop} · back: ${backOut} · page errors: ${errors.length}`);
for (const e of errors) console.log('  error:', e);
console.log(ok ? 'PASS' : 'FAIL');
process.exit(ok ? 0 : 1);

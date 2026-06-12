// Interaction flow tests: Pip's gift + shop menus, Fern's donation + lore,
// tide pools, digging, fishing, pockets, and the relit cave/museum.
import puppeteer from 'puppeteer-core';

const GAME_URL = 'http://localhost:8124/';
const OUT = new URL('.', import.meta.url).pathname;

const browser = await puppeteer.launch({
  executablePath: '/usr/bin/google-chrome',
  headless: 'new',
  args: ['--no-sandbox', '--use-gl=angle', '--use-angle=swiftshader',
    '--enable-unsafe-swiftshader', '--window-size=1280,720', '--mute-audio'],
});
const page = await browser.newPage();
await page.setViewport({ width: 1280, height: 720 });
page.on('pageerror', (e) => console.log('PAGE ERROR:', e.message));

await page.goto(GAME_URL, { waitUntil: 'networkidle0' });
await new Promise((r) => setTimeout(r, 3500));

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const shot = async (name) => {
  await page.screenshot({ path: `${OUT}${name}.png` });
  console.log('shot:', name);
};
const key = async (code, ms = 70) => {
  await page.keyboard.down(code);
  await sleep(ms);
  await page.keyboard.up(code);
  await sleep(260);
};

for (let i = 0; i < 6; i++) await key('KeyE', 50); // welcome

// ---- Pip: intro, gift, menus
await page.evaluate(() => window.__notbell.zones.go('shop', { x: 300, z: -0.2, rotY: Math.PI }));
await sleep(1200);
await key('KeyE'); // talk
await sleep(400);
await shot('20-pip-intro');
for (let i = 0; i < 6; i++) await key('KeyE', 50); // 3 pages
await sleep(400);
await shot('21-pip-gift');
await key('KeyE'); // talk again -> menu
await sleep(900);
await shot('22-pip-menu');
await key('Digit1'); // Buy
await sleep(900);
await shot('23-pip-wares');
await key('Digit4'); // Never mind
await sleep(700);
await key('Digit4'); // Leave
await sleep(400);

// ---- Fern: intro, donate, lore
await page.evaluate(() => {
  window.__notbell.S.addItem('trilobutton');
  return window.__notbell.zones.go('museum', { x: 297.5, z: 160.6, rotY: Math.PI });
});
await sleep(1200);
await shot('24-museum-relit');
await key('KeyE'); // intro 3 pages
for (let i = 0; i < 6; i++) await key('KeyE', 50);
await key('KeyE'); // menu
await sleep(700);
await key('Digit1'); // Donate
await sleep(700);
await shot('25-fern-donate-list');
await key('Digit1'); // the trilobutton
await sleep(700);
for (let i = 0; i < 2; i++) await key('KeyE', 50); // thanks
await sleep(300);
await shot('26-fern-lore');
for (let i = 0; i < 4; i++) await key('KeyE', 50); // lore page
await key('Digit3'); // Leave menu reopens -> Leave
await sleep(400);

// ---- relit shop + cave
await page.evaluate(() => window.__notbell.zones.go('shop'));
await sleep(1000);
await shot('27-shop-relit');
await page.evaluate(() => window.__notbell.zones.go('cave', { x: -300, z: -7.5, rotY: Math.PI }));
await sleep(1000);
await shot('28-cave-shrine');

// ---- tide pools
const pool = await page.evaluate(() => {
  const { SITES, zones } = window.__notbell;
  const p = { x: SITES.pools.x - 2.4, z: SITES.pools.z - 0.8 };
  zones.go('island', { x: p.x, z: p.z + 1.6, rotY: Math.PI });
  return p;
});
await sleep(1200);
await shot('29-tidepools');
await key('KeyE');
for (let i = 0; i < 4; i++) await key('KeyE', 50); // first-time flavor
await sleep(600);
await shot('30-tidepool-found');

// ---- digging
await page.evaluate(() => {
  const { digging, zones, S } = window.__notbell;
  S.giveTool('shovel');
  const s = digging.spots.find((s) => s.alive);
  return zones.go('island', { x: s.mark.position.x, z: s.mark.position.z + 1.2, rotY: Math.PI });
});
await sleep(1200);
await shot('31-digspot');
await key('KeyE');
await sleep(700);
await shot('32-dug');
for (let i = 0; i < 4; i++) await key('KeyE', 50); // firstFossil tip

// ---- fishing
await page.evaluate(() => {
  const { terrainHeight, zones } = window.__notbell;
  let spot = null;
  outer:
  for (let a = 0; a < Math.PI * 2; a += 0.08) {
    for (let r = 10; r < 44; r += 0.5) {
      const x = Math.cos(a) * r, z = Math.sin(a) * r;
      const h = terrainHeight(x, z);
      if (h > -0.3 && h < 0.3 && terrainHeight(x + Math.cos(a) * 3, z + Math.sin(a) * 3) < -0.85) {
        spot = { x, z, rotY: Math.atan2(Math.cos(a), Math.sin(a)) };
        break outer;
      }
    }
  }
  return zones.go('island', spot);
});
await sleep(1200);
await shot('33-shore-prompt');
await key('KeyE'); // cast
await sleep(900);
await shot('34-bobber');
await key('KeyE'); // reel too soon -> toast
await sleep(500);
await shot('35-too-soon');

// ---- pockets
await key('KeyI');
await sleep(400);
await shot('36-pockets');

await browser.close();
console.log('done');

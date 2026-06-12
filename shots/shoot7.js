// Villager homes: visit-when-home flow, furnished interiors, museum roof,
// Pip on his stool, and a wide shot for tree clipping.
import puppeteer from 'puppeteer-core';

const GAME_URL = 'http://localhost:8123/';
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
const key = async (code, ms = 60) => {
  await page.keyboard.down(code);
  await sleep(ms);
  await page.keyboard.up(code);
  await sleep(180);
};
async function advance(max = 16) {
  for (let i = 0; i < max; i++) {
    const s = await page.evaluate(() => ({
      dlg: document.querySelector('#dialog').style.display !== 'none',
      ch: document.querySelector('#choices').style.display !== 'none',
    }));
    if (!s.dlg || s.ch) return;
    await key('KeyE', 50);
  }
}

await advance(); // welcome

// who's home right now, on the real clock?
console.log('currently home:', await page.evaluate(() =>
  window.__notbell.S && [...['Clover','Biscuit','Saffron','Howell','Bramble']].filter((n) => {
    // probe via zones: villager is "away" if their island talk spot is far off-island
    return false;
  }).join(',') || '(see schedule)'));

// ---- visit Clover (forced home), via her actual front door
await page.evaluate(() => window.__notbell.houses.forceHome('Clover', true));
await sleep(500);
// stand at her door: find it by walking the interactables? we know her seat is
// in zone house_clover; enter directly first for the interior shot
await page.evaluate(() => window.__notbell.zones.go('house_clover'));
await sleep(1200);
await shot('80-clover-home');
await key('KeyE'); // talk or prop, whatever's nearest at spawn
await sleep(800);
await shot('81-clover-talk');
await advance();

// ---- Howell's den
await page.evaluate(() => {
  window.__notbell.houses.forceHome('Howell', true);
  return window.__notbell.zones.go('house_howell');
});
await sleep(1200);
await shot('82-howell-den');

// ---- museum roof + Pip stool
await page.evaluate(() => window.__notbell.zones.go('island'));
await sleep(1100);
await shot('83-village-roofcheck');
await page.evaluate(() => window.__notbell.zones.go('shop'));
await sleep(1100);
await shot('84-pip-stool');

// ---- wide island shot for tree clipping eyeball
await page.evaluate(() => {
  const { zones, SITES } = window.__notbell;
  return zones.go('island', { x: SITES.home.x, z: SITES.home.z + 6, rotY: Math.PI });
});
await sleep(1100);
await shot('85-home-area');

await browser.close();
console.log('done');

// Interior + cave + activity screenshots, driven via the window.__notbell hook.
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
const key = async (code, ms = 80) => {
  await page.keyboard.down(code);
  await sleep(ms);
  await page.keyboard.up(code);
  await sleep(200);
};

// dismiss welcome
for (let i = 0; i < 6; i++) await key('KeyE', 50);

await page.evaluate(() => window.__notbell.zones.go('shop'));
await sleep(1400);
await shot('10-shop-interior');
await key('KeyE'); // talk to Pip (spawn is within counter range? walk up first)
await page.keyboard.down('KeyW');
await sleep(700);
await page.keyboard.up('KeyW');
await sleep(200);
await key('KeyE');
await sleep(600);
await shot('11-shop-pip');
for (let i = 0; i < 8; i++) await key('KeyE', 50); // rod gift dialogue
await shot('12-shop-after-gift');

await page.evaluate(() => window.__notbell.zones.go('cafe'));
await sleep(1400);
await shot('13-cafe');

await page.evaluate(() => window.__notbell.zones.go('museum'));
await sleep(1400);
await shot('14-museum');

await page.evaluate(() => window.__notbell.zones.go('cave'));
await sleep(1400);
await shot('15-cave');

// back outside, near the tide pools
await page.evaluate(() => {
  const { zones } = window.__notbell;
  const site = JSON.parse(sessionStorage.getItem('poolsite') || 'null');
  return zones.leaveTo({ x: 0, z: 20, rotY: 0 });
});
await sleep(1200);
await shot('16-back-outside');

// fishing: give rod via state, teleport to a shore, face water, cast
await page.evaluate(async () => {
  const { zones, player, S } = window.__notbell;
  S.giveTool('rod');
  // find a shore spot: walk outward until water ahead
  await zones.go('island', { x: 0, z: 26, rotY: 0 });
});
await sleep(900);
await page.keyboard.down('KeyS');
await sleep(1500);
await page.keyboard.up('KeyS');
await sleep(300);
await shot('17-shore');
await key('KeyE'); // cast
await sleep(800);
await shot('18-cast');

await browser.close();
console.log('done');

// Screenshot harness: drive the game headless, walk around, snap pixels.
// Usage: node shots/shoot.js  (borrows puppeteer from ../not_animal_crossing/tests)
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
page.on('console', (m) => {
  if (m.type() === 'error') console.log('CONSOLE ERROR:', m.text());
});

await page.goto(GAME_URL, { waitUntil: 'networkidle0' });
await new Promise((r) => setTimeout(r, 4000));

async function shot(name) {
  await page.screenshot({ path: `${OUT}${name}.png` });
  console.log('shot:', name);
}

async function key(code, ms = 120) {
  await page.keyboard.down(code);
  await new Promise((r) => setTimeout(r, ms));
  await page.keyboard.up(code);
  await new Promise((r) => setTimeout(r, 150));
}

async function hold(code, ms) {
  await page.keyboard.down(code);
  await new Promise((r) => setTimeout(r, ms));
  await page.keyboard.up(code);
  await new Promise((r) => setTimeout(r, 250));
}

// 1. spawn + welcome dialogue
await shot('01-spawn-welcome');
// dismiss the 3 welcome pages
for (let i = 0; i < 6; i++) await key('KeyE', 60);
await shot('02-spawn-plaza');

// 2. expose game internals for teleport-style inspection
const sites = await page.evaluate(() => {
  return fetch('./src/terrain.js').then(() => null).catch(() => null);
});

// walk north toward the buildings
await hold('KeyW', 1600);
await shot('03-village');

// try to find and enter the shop: walk toward shop door (west building)
await hold('KeyA', 900);
await hold('KeyW', 600);
await shot('04-near-shop');
await key('KeyE'); // hopefully "enter"
await new Promise((r) => setTimeout(r, 1500));
await shot('05-after-enter');
// talk / advance whatever dialogue appears
for (let i = 0; i < 8; i++) await key('KeyE', 60);
await shot('06-shop-or-talk');

await browser.close();
console.log('done');

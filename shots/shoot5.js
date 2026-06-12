// Economy loop: sell to Pip, buy coffee from Luna; re-check the cave pond.
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
async function choose(label) {
  await page.waitForFunction(
    () => document.querySelector('#choices').style.display !== 'none', { timeout: 5000 });
  await page.evaluate((s) => {
    [...document.querySelectorAll('#choices .choice')]
      .find((b) => b.textContent.includes(s))?.click();
  }, label);
  await sleep(350);
}
const buttons = () => page.evaluate(() => window.__notbell.S.state.buttons);

await advance(); // welcome

// meet Pip first (rod gift), then sell three sea bass
await page.evaluate(() => {
  window.__notbell.S.addItem('sea_bass', 3);
  return window.__notbell.zones.go('shop', { x: 300, z: -0.2, rotY: Math.PI });
});
await sleep(1100);
await key('KeyE'); await advance(); // intro + gift
await sleep(400); // let the close-debounce pass
await key('KeyE'); // menu
await choose('Sell');
await shot('50-sell-list');
await choose('Sea Bass');
await sleep(400);
await shot('51-sold');
console.log('buttons after selling 3 sea bass (expect 340):', await buttons());
await advance();
await choose('Done');
await choose('Leave');

// coffee from Luna
await page.evaluate(() => window.__notbell.zones.go('cafe', { x: 298, z: 79.4, rotY: Math.PI }));
await sleep(1100);
await key('KeyE'); await advance(); // first-meet pages
await choose('Lantern Roast');
await advance();
await sleep(400);
await shot('52-coffee');
console.log('buttons after coffee (expect 300):', await buttons());
console.log('coffee active:', await page.evaluate(() => window.__notbell.S.coffeeActive()));

// the mended pond
await page.evaluate(() => window.__notbell.zones.go('cave', { x: -302, z: 6, rotY: Math.PI }));
await sleep(1100);
await shot('53-pond-fixed');

await browser.close();
console.log('done');

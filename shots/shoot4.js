// DOM-state-driven flow tests: tide pool, digging, fishing (with a real
// catch), pockets, glow worm closeup. No blind key counts.
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
const dlg = () => page.evaluate(() => ({
  dlg: document.querySelector('#dialog').style.display !== 'none',
  ch: document.querySelector('#choices').style.display !== 'none',
  prompt: document.querySelector('#prompt').textContent,
}));
// press E through pages until the dialogue closes or a menu appears
async function advance(max = 16) {
  for (let i = 0; i < max; i++) {
    const s = await dlg();
    if (!s.dlg) return;
    if (s.ch) return;
    await key('KeyE', 50);
  }
}
async function choose(label) {
  await page.waitForFunction(
    () => document.querySelector('#choices').style.display !== 'none', { timeout: 5000 });
  await page.evaluate((s) => {
    const btns = [...document.querySelectorAll('#choices .choice')];
    btns.find((b) => b.textContent.includes(s))?.click();
  }, label);
  await sleep(300);
}

await advance(); // welcome

// ---- tide pool rummage
await page.evaluate(() => {
  const { SITES, zones } = window.__notbell;
  return zones.go('island', { x: SITES.pools.x - 2.4, z: SITES.pools.z + 0.8, rotY: Math.PI });
});
await sleep(1100);
await key('KeyE');
await advance();
await sleep(500);
await shot('40-tidepool-found');

// ---- digging
await page.evaluate(() => {
  const { digging, zones, S } = window.__notbell;
  S.giveTool('shovel');
  const s = digging.spots.find((s) => s.alive);
  return zones.go('island', { x: s.mark.position.x, z: s.mark.position.z + 1.2, rotY: Math.PI });
});
await sleep(1100);
await shot('41-digspot');
await key('KeyE');
await sleep(600);
await shot('42-dug');
await advance();

// ---- fishing, with a real catch
await page.evaluate(() => {
  const { terrainHeight, zones, S } = window.__notbell;
  S.giveTool('rod');
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
await sleep(1100);
await shot('43-shore');
console.log('prompt at shore:', (await dlg()).prompt);
await key('KeyE'); // cast
await sleep(700);
await shot('44-bobber');
// wait for the bite, then strike
try {
  await page.waitForFunction(
    () => document.querySelector('#prompt').textContent.includes('reel it in'),
    { timeout: 9000, polling: 40 });
  await page.keyboard.down('KeyE');
  await sleep(50);
  await page.keyboard.up('KeyE');
  await sleep(500);
  await shot('45-caught');
  await advance(); // possible bottle letter
} catch {
  console.log('no bite within 9s (or missed)');
  await shot('45-no-bite');
}

// ---- pockets
await key('KeyI');
await sleep(350);
await shot('46-pockets');
await key('KeyI');

// ---- glow worm closeup with round sprites
await page.evaluate(() => window.__notbell.zones.go('cave', { x: -300, z: 2, rotY: Math.PI }));
await sleep(1100);
await shot('47-cave-worms');

await browser.close();
console.log('done');

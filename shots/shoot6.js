// Expansion verification: night sky, weather, cottage + garden, hats,
// cave fishing, Chip's songs, Pip's new stock.
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
async function choose(label) {
  await page.waitForFunction(
    () => document.querySelector('#choices').style.display !== 'none', { timeout: 6000 });
  await page.evaluate((s) => {
    [...document.querySelectorAll('#choices .choice')]
      .find((b) => b.textContent.includes(s))?.click();
  }, label);
  await sleep(350);
}

await advance(); // welcome

// ---- 60: the village by (real) night, with stars
await shot('60-village-night');

// ---- 61: rain
await page.evaluate(() => window.__notbell.almanac.forceWeather('rain'));
await sleep(1200);
await shot('61-rain');
await page.evaluate(() => window.__notbell.almanac.forceWeather('clear'));

// ---- cottage + garden
await page.evaluate(() => {
  const { SITES, zones, S } = window.__notbell;
  S.addItem('carrot_seeds', 2);
  return zones.go('island', { x: SITES.home.x + 1, z: SITES.home.z + 5.5, rotY: Math.PI });
});
await sleep(1200);
await shot('62-cottage');
// walk to the garden (east of door) and plant
await page.evaluate(() => {
  const { SITES, zones } = window.__notbell;
  return zones.go('island', { x: SITES.home.x + 4.2, z: SITES.home.z + 3.6, rotY: Math.PI });
});
await sleep(900);
await key('KeyE'); // plant something
await choose('Carrot');
await sleep(1300);
await shot('63-planted');
// time-travel the carrot to maturity
await page.evaluate(() => {
  const { S } = window.__notbell;
  const k = Object.keys(S.state.garden)[0];
  S.state.garden[k].plantedAt -= 10 * 60 * 1000;
});
await sleep(1600); // garden poll ticks at 1s
await shot('64-ready');
await key('KeyE'); // harvest!
await sleep(600);
await shot('65-harvested');
console.log('carrots in pockets:', await page.evaluate(() => window.__notbell.S.countItem('carrot')));

// ---- inside the cottage
await page.evaluate(() => window.__notbell.zones.go('home'));
await sleep(1200);
await shot('66-cottage-interior');

// ---- hats
await page.evaluate(() => {
  const { S } = window.__notbell;
  S.ownHat('party_cone');
  S.ownHat('flower_crown');
});
await key('KeyH');
await sleep(400);
await shot('67-hat-on');

// ---- cave pond fishing
await page.evaluate(() => {
  const { zones, S } = window.__notbell;
  S.giveTool('rod');
  return zones.go('cave', { x: -304, z: 7.4, rotY: Math.PI });
});
await sleep(1200);
await shot('68-cave-pond');
await key('KeyE'); // cast
await sleep(700);
await shot('69-cave-bobber');
try {
  await page.waitForFunction(
    () => document.querySelector('#prompt').textContent.includes('reel it in'),
    { timeout: 9000, polling: 40 });
  await key('KeyE', 40);
  await sleep(500);
  await shot('70-cave-catch');
  await advance();
} catch {
  console.log('no cave bite within 9s');
}
console.log('cave inventory:', await page.evaluate(() => {
  const inv = window.__notbell.S.state.inv;
  return Object.keys(inv).join(', ');
}));

// ---- Chip's set list
await page.evaluate(() => window.__notbell.zones.go('cafe', { x: 304, z: 78.6, rotY: Math.PI }));
await sleep(1100);
await key('KeyE');
await sleep(600);
await shot('71-chip-menu');
await choose('Button Bossa');
await sleep(700);
await shot('72-chip-plays');
await advance();

// ---- Pip's hat rack
await page.evaluate(() => window.__notbell.zones.go('shop', { x: 300, z: -0.2, rotY: Math.PI }));
await sleep(1100);
await key('KeyE'); await advance(); // intro + rod gift
await sleep(400);
await key('KeyE');
await choose('Buy');
await choose('Hats');
await sleep(400);
await shot('73-pip-hats');

await browser.close();
console.log('done');

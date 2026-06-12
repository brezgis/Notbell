// The Far Isle expansion: bridge, train, town, church, garden, bones,
// café art, ambient errands with bubbles, sharks.
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
await new Promise((r) => setTimeout(r, 4000));

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

// shore math mirrored from bridge.js, so we can stand at the bridge head
const bridgeInfo = await page.evaluate(() => {
  const { terrainHeight, ISLAND2 } = window.__notbell;
  const len = Math.hypot(ISLAND2.x, ISLAND2.z);
  const dir = { x: ISLAND2.x / len, z: ISLAND2.z / len };
  let t = 24;
  for (let i = 0; i < 400; i++) {
    if (terrainHeight(dir.x * (t + 0.5), dir.z * (t + 0.5)) < 0.15) break;
    t += 0.5;
  }
  return { ax: dir.x * t, az: dir.z * t, dx: dir.x, dz: dir.z };
});

// ---- 90: stand at the bridge head, looking across
await page.evaluate(({ ax, az, dx, dz }) => window.__notbell.zones.go('island', {
  x: ax - dx * 4, z: az - dz * 4, rotY: Math.atan2(dx, dz),
}), bridgeInfo);
await sleep(1200);
await shot('90-bridge-head');

// walk out onto the bridge
await page.keyboard.down('KeyW');
await sleep(2200);
await page.keyboard.up('KeyW');
await sleep(400);
await shot('91-on-bridge');

// ---- 92: Far Isle town square
await page.evaluate(() => {
  const { zones, SITES } = window.__notbell;
  return zones.go('island', { x: SITES.town2.x, z: SITES.town2.z + 7, rotY: Math.PI });
});
await sleep(1200);
await shot('92-far-town');

// ---- Barnaby
await page.evaluate(() => window.__notbell.zones.go('grocery'));
await sleep(1200);
await shot('93-grocery');
await page.evaluate(() => window.__notbell.zones.go('grocery', { x: 300 - 2.5, z: 899.6, rotY: Math.PI }));
await sleep(800);
await key('KeyE');
await advance();
await sleep(300);
await shot('94-barnaby');
try { await choose('Leave'); } catch {}

// ---- the Listening House
await page.evaluate(() => window.__notbell.zones.go('church'));
await sleep(1200);
await shot('95-church');
await page.evaluate(() => window.__notbell.zones.go('church', { x: 300, z: 977.5, rotY: Math.PI }));
await sleep(800);
await key('KeyE'); // talk to Alder
await advance();
await sleep(300);
await shot('96-alder');
try {
  await choose('candle');
} catch {
  try { await choose('Light a candle'); } catch {}
}
await advance();
await sleep(300);
await shot('97-candle-lit');
try { await choose('Leave'); } catch {}

// ---- garden + bones
await page.evaluate(() => {
  const { zones, SITES } = window.__notbell;
  return zones.go('island', { x: SITES.garden2.x, z: SITES.garden2.z + 6, rotY: Math.PI });
});
await sleep(1200);
await shot('98-garden');
await page.evaluate(() => {
  const { zones, SITES } = window.__notbell;
  return zones.go('island', { x: SITES.bones.x - 2, z: SITES.bones.z + 5, rotY: Math.PI });
});
await sleep(1200);
await shot('99-old-singer');

// ---- café art + an ambient guest with bubbles
await page.evaluate(() => {
  window.__notbell.ambient.forceErrand('Saffron', 'cafe');
  return window.__notbell.zones.go('cafe');
});
await sleep(1500);
await shot('100-cafe-art-guest');
await sleep(6000); // let a bubble exchange begin
await shot('101-cafe-bubbles');

// ---- sharks in the strait
await page.evaluate(({ ax, az, dx, dz }) => window.__notbell.zones.go('island', {
  x: ax - dx * 2, z: az - dz * 2, rotY: Math.atan2(dx, dz),
}), bridgeInfo);
await sleep(1500);
await shot('102-strait-sharks');

console.log('inv check:', await page.evaluate(() => window.__notbell.S.state.buttons));
await browser.close();
console.log('done');

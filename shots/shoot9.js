// Maritime verification: volcano on the horizon, the dock, rowing,
// landing on the volcano, the reef, the relocated garden.
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
const prompt = () => page.evaluate(() => document.querySelector('#prompt').textContent);
async function advance(max = 14) {
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

// 110: the volcano on the horizon, from the home island's south rim
await page.evaluate(() => {
  const { zones, SITES } = window.__notbell;
  return zones.go('island', { x: SITES.village.x, z: SITES.village.z + 14, rotY: Math.PI });
});
await sleep(1200);
await shot('110-volcano-horizon');

// 111: the dock
await page.evaluate(() => {
  const { zones, SITES } = window.__notbell;
  return zones.go('island', { x: SITES.dock.x, z: SITES.dock.z, rotY: Math.atan2(SITES.dock.x, SITES.dock.z) });
});
await sleep(1200);
await shot('111-dock');

// walk toward the boats and board
await page.keyboard.down('KeyW');
await sleep(1400);
await page.keyboard.up('KeyW');
await sleep(300);
console.log('prompt near boats:', await prompt());
await key('KeyE'); // row out
await advance();
await sleep(800);
await shot('112-rowing');

// row a little, then teleport-row to the volcano's shore
await page.keyboard.down('KeyW');
await sleep(1500);
await page.keyboard.up('KeyW');
await shot('113-open-water');
await page.evaluate(() => {
  const { player, terrainHeight } = window.__notbell;
  // park the boat just off the volcano's north shore, facing land
  const V = { x: 30, z: -120, r: 19 };
  for (let d = V.r + 6; d > V.r - 2; d -= 0.4) {
    const x = V.x, z = V.z + d;
    if (terrainHeight(x, z) < -0.77) {
      player.group.position.set(x, player.group.position.y, z);
      player.group.rotation.y = Math.PI; // facing -z, toward the cone
      break;
    }
  }
});
await sleep(600);
console.log('prompt at volcano shore:', await prompt());
await key('KeyE'); // go ashore
await sleep(1400);
await shot('114-ashore-volcano');

// climb to the crater
await page.evaluate(() => {
  const { zones } = window.__notbell;
  return zones.go('island', { x: 30, z: -114, rotY: Math.PI });
});
await sleep(1200);
await shot('115-crater');

// 116: the reef from a boat
await page.evaluate(() => {
  const { zones } = window.__notbell;
  return zones.go('sea', { x: 58, z: -60, rotY: Math.PI });
});
await sleep(1500);
await shot('116-reef');

// 117: the relocated garden
await page.evaluate(() => {
  const { zones, SITES } = window.__notbell;
  return zones.go('island', { x: SITES.home.x, z: SITES.home.z + 7, rotY: Math.PI });
});
await sleep(1200);
await shot('117-garden-fixed');

await browser.close();
console.log('done');

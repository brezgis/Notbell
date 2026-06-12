// Batch 4 verification: the real launch sequence, fish shadows, the market
// glut, the moon — then the whole thing again on an emulated phone.
import puppeteer, { KnownDevices } from 'puppeteer-core';

const GAME_URL = 'http://localhost:8123/';
const OUT = new URL('.', import.meta.url).pathname;
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const browser = await puppeteer.launch({
  executablePath: '/usr/bin/google-chrome',
  headless: 'new',
  args: ['--no-sandbox', '--use-gl=angle', '--use-angle=swiftshader',
    '--enable-unsafe-swiftshader', '--window-size=1280,720', '--mute-audio'],
});

// ============================================================ desktop ----
{
  const page = await browser.newPage();
  await page.setViewport({ width: 1280, height: 720 });
  page.on('pageerror', (e) => console.log('PAGE ERROR:', e.message));
  page.on('dialog', (d) => d.accept('Tester'));
  await page.goto(GAME_URL, { waitUntil: 'networkidle0' });
  await sleep(4500);

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
  const dlg = () => page.evaluate(() => ({
    open: document.querySelector('#dialog').style.display !== 'none',
    ch: document.querySelector('#choices').style.display !== 'none',
  }));
  async function closeAll(max = 26) {
    for (let i = 0; i < max; i++) {
      const s = await dlg();
      if (!s.open) return;
      await key('KeyE', 50);
    }
  }
  await closeAll(); // welcome + avatar pick (E selects the cat) + name

  // --- the market glut, tested at the ledger level
  const market = await page.evaluate(() => {
    const { S } = window.__notbell;
    const before = S.marketFactor('sunfruit');
    S.recordSale('sunfruit', 6);
    return { before, after: S.marketFactor('sunfruit') };
  });
  console.log('market factor before/after glut:', JSON.stringify(market), '(expect 1 then 0.5)');

  // --- fish shadows: stand at the shore, watch the water, cast
  await page.evaluate(() => {
    const { S, zones } = window.__notbell;
    S.giveTool('rod');
    return zones.go('island', { x: 4, z: -28, rotY: Math.PI });
  });
  await sleep(6000); // shadows respawn near the player on their own clock
  await shot('340-fish-shadows');
  console.log('shore prompt:', await prompt());
  await key('KeyE'); // cast
  await sleep(1200);
  await shot('341-bobber-out');

  // --- the launch, for real: powered rocket -> GO -> moon
  await page.evaluate(() => {
    const { S, zones } = window.__notbell;
    S.setFlag('sawRocket');
    S.setFlag('rocketPowered');
    return zones.go('island', { x: -127, z: -71.5, rotY: Math.PI });
  });
  await sleep(1000);
  console.log('pad prompt:', await prompt());
  await key('KeyE');     // check on the rocket -> GO?
  await sleep(600);
  await key('KeyE');     // 🚀 Go (focused)
  await sleep(400);
  await closeAll();      // Hazel's helmet speech + the whole launch story
  await sleep(2500);
  const zone = await page.evaluate(() => window.__notbell.zones.current());
  const helmet = await page.evaluate(() => window.__notbell.S.countItem('bubble_helmet'));
  console.log('after launch — zone:', zone, '· bubble helmet:', helmet);
  await shot('342-launched-on-moon');

  // bounce around a little (the gravity is a sixth of serious)
  await page.keyboard.down('KeyW');
  await sleep(2200);
  await page.keyboard.up('KeyW');
  await shot('343-moon-bounce');

  // fly home via the parked rocket
  await page.evaluate(() => window.__notbell.zones.go('moon', { x: 980, z: 31, rotY: Math.PI }));
  await sleep(800);
  await key('KeyE'); // fly home
  await sleep(500);
  await key('KeyE'); // 🌍 confirm
  await closeAll();
  await sleep(2000);
  console.log('after return — zone:', await page.evaluate(() => window.__notbell.zones.current()));
  await page.close();
}

// ============================================================= mobile ----
{
  const page = await browser.newPage();
  await page.emulate(KnownDevices['iPhone 13']);
  page.on('pageerror', (e) => console.log('MOBILE PAGE ERROR:', e.message));
  page.on('dialog', (d) => d.accept('Phone Tester'));
  await page.goto(GAME_URL, { waitUntil: 'networkidle0' });
  await sleep(5500);

  const touch = await page.evaluate(() => ({
    touchClass: document.body.classList.contains('touch'),
    stick: !!document.querySelector('#stick'),
    act: !!document.querySelector('#btn-act'),
  }));
  console.log('mobile chrome:', JSON.stringify(touch));

  // tap through the welcome with the action button
  const actBox = await page.evaluate(() => {
    const r = document.querySelector('#btn-act').getBoundingClientRect();
    return { x: r.left + r.width / 2, y: r.top + r.height / 2 };
  });
  for (let i = 0; i < 10; i++) {
    await page.touchscreen.tap(actBox.x, actBox.y);
    await sleep(350);
  }
  await sleep(800);
  await page.screenshot({ path: `${OUT}344-mobile-home.png` });
  console.log('shot: 344-mobile-home');

  // drag the stick north and check that we actually walked
  const before = await page.evaluate(() => {
    const p = window.__notbell.player.group.position;
    return { x: p.x, z: p.z };
  });
  const stickBox = await page.evaluate(() => {
    const r = document.querySelector('#stick').getBoundingClientRect();
    return { x: r.left + r.width / 2, y: r.top + r.height / 2 };
  });
  await page.touchscreen.touchStart(stickBox.x, stickBox.y);
  await page.touchscreen.touchMove(stickBox.x, stickBox.y - 40);
  await sleep(2500);
  await page.touchscreen.touchEnd();
  await sleep(400);
  const after = await page.evaluate(() => {
    const p = window.__notbell.player.group.position;
    return { x: p.x, z: p.z };
  });
  const walked = Math.hypot(after.x - before.x, after.z - before.z);
  console.log('stick walk distance:', walked.toFixed(1), '(expect > 5)');
  await page.screenshot({ path: `${OUT}345-mobile-walked.png` });
  console.log('shot: 345-mobile-walked');

  // the map button
  const mapBtn = await page.evaluate(() => {
    const r = document.querySelectorAll('.btn-mini')[0].getBoundingClientRect();
    return { x: r.left + r.width / 2, y: r.top + r.height / 2 };
  });
  await page.touchscreen.tap(mapBtn.x, mapBtn.y);
  await sleep(700);
  await page.screenshot({ path: `${OUT}346-mobile-map.png` });
  console.log('shot: 346-mobile-map');
  await page.close();
}

await browser.close();
console.log('done');

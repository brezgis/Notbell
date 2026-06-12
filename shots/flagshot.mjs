import puppeteer from 'puppeteer-core';
const browser = await puppeteer.launch({
  executablePath: '/usr/bin/google-chrome', headless: 'new',
  args: ['--no-sandbox', '--use-gl=angle', '--use-angle=swiftshader',
    '--enable-unsafe-swiftshader', '--window-size=1280,720', '--mute-audio'],
});
const page = await browser.newPage();
await page.setViewport({ width: 1280, height: 720 });
page.on('pageerror', (e) => console.log('PAGE ERROR:', e.message));
page.on('dialog', (d) => d.accept('Tester'));
await page.goto('http://localhost:8123/', { waitUntil: 'networkidle0' });
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
await sleep(5000);
// dismiss welcome + avatar + name
for (let i = 0; i < 10; i++) { await page.keyboard.press('KeyE'); await sleep(250); }
await sleep(800);

const flagState = () => page.evaluate(() => {
  const scene = window.__notbell.player.group.parent;
  let flag = null;
  scene.traverse((o) => {
    if (o.isMesh && o.geometry.type === 'PlaneGeometry' && o.material.map) {
      const wp = new (o.position.constructor)();
      o.getWorldPosition(wp);
      if (wp.x > -126 && wp.x < -118 && wp.z > -57 && wp.z < -50) {
        flag = { y: +wp.y.toFixed(1), shown: o.visible && o.parent.visible };
      }
    }
  });
  return flag;
});

// flatten the camera and back off, so tall things fit the frame
await page.evaluate(() => window.__notbell.zones.go('island', { x: -122, z: -49, rotY: Math.PI }));
await sleep(800);
await page.mouse.move(640, 500);
await page.mouse.down();
for (let i = 0; i < 30; i++) { await page.mouse.move(640, 500 + i * 6); await sleep(16); }
await page.mouse.up();
await page.mouse.wheel({ deltaY: 300 });
await sleep(1000);
console.log('clear:', JSON.stringify(await flagState()));
await page.screenshot({ path: '325-flag-portrait.png' });
console.log('shot: 325-flag-portrait');

await page.evaluate(() => window.__notbell.almanac.forceWeather('rain'));
await sleep(4000);
console.log('rain:', JSON.stringify(await flagState()));
await page.evaluate(() => window.__notbell.almanac.forceWeather('clear'));
await sleep(4000);
console.log('clear again:', JSON.stringify(await flagState()));

// the meetup, framed properly this time
const meet = await page.evaluate(() => {
  const { ambient, zones } = window.__notbell;
  for (const name of ['Howell', 'Clover', 'Puddle', 'Bramble', 'Butterpat', 'Mochi']) {
    const m = ambient.forceMeeting(name);
    if (m) { zones.go('island', { x: m.x, z: m.z + 3.5, rotY: Math.PI }); return m; }
  }
  return null;
});
console.log('meetup:', JSON.stringify(meet));
await sleep(7500);
await page.screenshot({ path: '326-meetup-bubbles.png' });
console.log('shot: 326-meetup-bubbles');
await browser.close();
console.log('done');

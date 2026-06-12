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
for (let i = 0; i < 10; i++) { await page.keyboard.press('KeyE'); await sleep(220); }
await page.evaluate(() => {
  window.__notbell.almanac.forceWeather('clear');
  return window.__notbell.zones.go('island', { x: -122, z: -47, rotY: Math.PI });
});
await sleep(4200);
// drag UP: flatten the camera so the sky (and the flag) fits the frame
await page.mouse.move(640, 560);
await page.mouse.down();
for (let i = 0; i < 35; i++) { await page.mouse.move(640, 560 - i * 6); await sleep(16); }
await page.mouse.up();
await sleep(900);
await page.screenshot({ path: '325-flag-portrait.png' });
console.log('done');

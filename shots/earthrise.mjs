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
for (let i = 0; i < 10; i++) { await page.keyboard.press('KeyE'); await sleep(200); }
await page.evaluate(() => window.__notbell.zones.go('moon', { x: 1000, z: -10, rotY: Math.PI }));
await sleep(1500);
// flatten the camera: drag up
await page.mouse.move(640, 560);
await page.mouse.down();
for (let i = 0; i < 38; i++) { await page.mouse.move(640, 560 - i * 6); await sleep(14); }
await page.mouse.up();
await sleep(800);
await page.screenshot({ path: '335-earthrise.png' });
console.log('done');

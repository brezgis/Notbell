import puppeteer from 'puppeteer-core';
const browser = await puppeteer.launch({
  executablePath: '/usr/bin/google-chrome', headless: 'new',
  args: ['--no-sandbox', '--use-gl=angle', '--use-angle=swiftshader',
    '--enable-unsafe-swiftshader', '--window-size=1280,720', '--mute-audio'],
});
const page = await browser.newPage();
page.on('pageerror', (e) => console.log('PAGE ERROR:', e.message));
await page.goto('http://localhost:8123/', { waitUntil: 'networkidle0' });
await new Promise((r) => setTimeout(r, 5000));
const report = await page.evaluate(() => {
  const scene = window.__notbell.player.group.parent;
  const found = [];
  scene.traverse((o) => {
    if (!o.isMesh) return;
    const wp = new (o.position.constructor)();
    o.getWorldPosition(wp);
    if (wp.x > -126 && wp.x < -118 && wp.z > -57 && wp.z < -50) {
      found.push({
        type: o.geometry.type, y: +wp.y.toFixed(2),
        visible: o.visible, parentVisible: o.parent.visible,
        hasMap: !!o.material.map,
      });
    }
  });
  return found;
});
console.log(JSON.stringify(report, null, 1));
await browser.close();

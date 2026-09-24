import { boot, view, snap, sleep } from './lib.mjs';
const { browser, page } = await boot();
const lines = ['bridge', 'northline', 'farline'];
for (const ln of lines) {
  const st = await page.evaluate((l) => window.__notbell[l].debug.stations.map((s) => ({ c: s.center, h: s.h, side: s.side, top: s.top, landing: s.landing })), ln);
  for (const [i, s] of st.entries()) {
    console.log(ln, i, JSON.stringify(s));
    await page.evaluate((s) => window.__notbell.zones.go('island', { x: s.landing.x, z: s.landing.z }), s);
    await sleep(1500);
    for (const yaw of [0.6, 2.4]) {
      await view(page, { x: s.c.x, z: s.c.z }, { yaw: s.h + yaw, pitch: 0.55, dist: 16 });
      await snap(page, `${ln}-${i}-${yaw}`);
    }
  }
}
await browser.close();

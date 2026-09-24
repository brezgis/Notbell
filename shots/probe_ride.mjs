// Railway E2E: two villagers walk to the Grove Line platform, board one per
// carriage, ride to Grove Isle, step off onto the deck and walk down the ramp.
// The player queues too and rides along.
import { boot, sleep } from './lib.mjs';
const { browser, page } = await boot();
const st = await page.evaluate(() => {
  const N = window.__notbell, L = N.northline.debug, S0 = L.stations[0];
  const near = N.animals.animals.filter((a) => a.identity && !a.home && !a.swims && !a.away && !a.anchored)
    .sort((p, q) => Math.hypot(p.g.position.x - S0.center.x, p.g.position.z - S0.center.z) - Math.hypot(q.g.position.x - S0.center.x, q.g.position.z - S0.center.z))
    .slice(0, 2);
  // teleport them near the station first so the walk is short (probe only)
  near.forEach((a, i) => a.g.position.set(S0.landing.x + i * 1.5, 0, S0.landing.z + 2));
  const ok = near.map((a) => L.enqueue(0, a));
  return { names: near.map((a) => a.identity.name), ok, docked: L.docked(), center: S0.center, landing: S0.landing };
});
console.log('queued:', JSON.stringify(st));
// the player walks up and joins the queue
await page.evaluate((s) => window.__notbell.zones.go('island', { x: s.landing.x, z: s.landing.z }), st);
await sleep(1500);
await page.evaluate((s) => window.__notbell.zones.go('island', { x: s.center.x, z: s.center.z }), st);
await sleep(1500);
const t0 = Date.now();
let log = [];
let rode = false, arrived = false;
while (Date.now() - t0 < 420_000) {
  const s = await page.evaluate((names) => {
    const N = window.__notbell, L = N.northline.debug;
    const as = names.map((n) => N.animals.animals.find((a) => a.identity?.name === n));
    const p = N.player.group.position;
    return {
      phase: L.phase(), docked: L.docked(), riders: L.riders(), q0: L.waiting[0].length,
      riding: N.player.riding, px: +p.x.toFixed(1), py: +p.y.toFixed(2), pz: +p.z.toFixed(1),
      v: as.map((a) => ({ riding: !!a.riding, x: +a.g.position.x.toFixed(1), y: +a.g.position.y.toFixed(2), z: +a.g.position.z.toFixed(1) })),
    };
  }, st.names);
  const line = JSON.stringify(s);
  if (log[log.length - 1] !== line) { log.push(line); console.log(((Date.now() - t0) / 1000).toFixed(0) + 's', line); }
  if (s.q0 === 0 && s.docked === 0 && !s.riding && !rode) {
    // the queue has cleared: press E on the platform
    await page.keyboard.press('KeyE'); await sleep(400);
  }
  if (s.riding) rode = true;
  if (rode && !s.riding) { arrived = true; break; }
  await page.evaluate(() => window.__notbell.northline.debug.hurry());
  await sleep(3000);
}
console.log(rode && arrived ? 'RIDE PASS' : 'RIDE INCOMPLETE');
await browser.close();

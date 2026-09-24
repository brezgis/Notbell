// Platform queue: with the train away, one villager walks up the ramp and
// waits on the deck (feet planted, facing the track); the player presses E
// to wait too. When the train docks, both board — villager first, in order.
// Then a second round: player alone, E while the train is in → boards at once.
import { boot, sleep } from './lib.mjs';
const LINE = process.env.LINE || 'northline';
const { browser, page } = await boot();
const L = (fn, arg) => page.evaluate(fn, LINE, arg);
// send the train away from station 0 first
for (let i = 0; i < 40; i++) {
  const d = await L((l) => window.__notbell[l].debug.docked());
  if (d !== 0 && d !== null) break;
  await L((l) => window.__notbell[l].debug.hurry());
  await sleep(1500);
}
const st = await L((l) => {
  const N = window.__notbell, D = N[l].debug, S0 = D.stations[0];
  const a = N.animals.animals.filter((a) => a.identity && !a.home && !a.swims && !a.away && !a.anchored)
    .sort((p, q) => Math.hypot(p.g.position.x - S0.center.x, p.g.position.z - S0.center.z) - Math.hypot(q.g.position.x - S0.center.x, q.g.position.z - S0.center.z))[0];
  a.g.position.set(S0.landing.x + 1.5, 0, S0.landing.z + 2);
  return { name: a.identity.name, ok: D.enqueue(0, a), center: S0.center, landing: S0.landing, top: S0.top, spot: S0.doorSpot(0) };
});
console.log('queued', JSON.stringify(st));
await page.evaluate((s) => window.__notbell.zones.go('island', { x: s.center.x, z: s.center.z }), st);
await sleep(1200);
await page.keyboard.press('KeyE'); await sleep(500);
await page.keyboard.press('Space'); await sleep(300);
const t0 = Date.now();
let stood = false, boardedV = false, boardedP = false, prev = '';
while (Date.now() - t0 < 240_000) {
  const s = await L((l, name) => {
    const N = window.__notbell, D = N[l].debug;
    const a = N.animals.animals.find((x) => x.identity?.name === name);
    return {
      docked: D.docked(), q: D.waiting[0].map((w) => (w.player ? 'you' : w.a.identity.name + (w.here ? '*' : ''))).join(','),
      busy: !!a.busy, riding: !!a.riding, you: !!N.player.riding,
      ax: +a.g.position.x.toFixed(1), ay: +a.g.position.y.toFixed(2), az: +a.g.position.z.toFixed(1),
    };
  }, st.name);
  const line = JSON.stringify(s);
  if (line !== prev) { console.log(((Date.now() - t0) / 1000).toFixed(0) + 's', line); prev = line; }
  if (s.busy && Math.abs(s.ay - st.top) < 0.3 && Math.hypot(s.ax - st.spot.x, s.az - st.spot.z) < 0.8) stood = true;
  if (s.riding) boardedV = true;
  if (s.you) { boardedP = true; break; }
  if (stood && s.docked !== 0) await L((l) => window.__notbell[l].debug.hurry());
  await sleep(1000);
}
console.log(`stood on platform: ${stood} · villager boarded: ${boardedV} · you boarded: ${boardedP}`);
console.log(stood && boardedV && boardedP ? 'QUEUE PASS' : 'QUEUE FAIL');
await browser.close();

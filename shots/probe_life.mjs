// Villager continuity: nobody teleports. Rain sends everyone home (they
// should WALK to their doors); an errand should walk to the café door.
import { boot, forceWeather, sleep } from './lib.mjs';
const { browser, page } = await boot();
const sample = () => page.evaluate(() => window.__notbell.animals.animals
  .filter((a) => a.identity).map((a) => ({
    n: a.identity.name, x: a.g.position.x, z: a.g.position.z,
    home: !!a.home, away: !!a.away, walk: !!a.bedtime, goal: !!a.goal, err: a.errand?.phase || null, ride: !!a.riding,
  })));
// an errand first
const who = await page.evaluate(() => {
  const door = window.__notbell.zones.doorOf('cafe');
  const a = window.__notbell.animals.animals.filter((x) => x.identity && !x.home && !x.errand && !x.swims)
    .sort((p, q) => Math.hypot(p.g.position.x - door.x, p.g.position.z - door.z) - Math.hypot(q.g.position.x - door.x, q.g.position.z - door.z))[0];
  window.__notbell.ambient.forceErrand(a.identity.name, 'cafe');
  return { n: a.identity.name, d: Math.hypot(a.g.position.x - door.x, a.g.position.z - door.z), phase: a.errand?.phase };
});
console.log('errand:', JSON.stringify(who));
let prev = await sample();
let maxJump = { d: 0 };
const track = async (secs) => {
  for (let i = 0; i < secs * 2; i++) {
    await sleep(500);
    const cur = await sample();
    for (const c of cur) {
      const p = prev.find((q) => q.n === c.n);
      const d = Math.hypot(c.x - p.x, c.z - p.z);
      // jumps allowed only across an away boundary (going through a door)
      if (d > maxJump.d && !(c.away !== p.away) && !c.ride && !p.ride) maxJump = { d, n: c.n, from: p, to: c };
    }
    prev = cur;
  }
};
await track(20);
console.log('after 20s errand phase:', JSON.stringify((await sample()).find((s) => s.n === who.n)));
await forceWeather(page, 'rain', 500);
await track(60);
const end = await sample();
console.log('home:', end.filter((s) => s.home).length, 'walking:', end.filter((s) => s.walk).length, 'total:', end.length);
console.log('max jump (non-door):', JSON.stringify(maxJump));
await browser.close();

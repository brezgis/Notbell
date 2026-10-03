// The Persistent, sailed empty on every route (fast-forwarded): how long it
// takes, how much she turns (circling shows up as turning far beyond the
// heading change), and whether her hull ever overlaps the shore, a sea wall,
// or a pier. FAIL on a timeout, a scrape, a pier, or a pirouette.
import { boot, sleep } from './lib.mjs';
const { browser, page } = await boot();
await sleep(2000);
const stops = await page.evaluate(() => window.__notbell.boats.debug.stops());
const pairs = [];
for (const s of stops) if (s !== 'home' && s !== 'oasis') pairs.push([s, 'home'], ['home', s]);
pairs.push(['grove', 'far'], ['farther', 'labs'], ['north', 'bulko'], ['oasis', 'bulko'], ['bulko', 'oasis'], ['volcano', 'grove']);
let ok = true;
for (const [to, from] of pairs) {
  const r = await page.evaluate((to, from) => {
    const N = window.__notbell, B = N.boats, Z = N.zones, th = N.terrainHeight;
    N.player.group.position.set(-300, 0, -300);
    B.debug.sail(to, from);
    let t = 0, turn = 0, lastRy = B.debug.state().ry, scrape = 0, pier = 0, worst = null;
    while (t < 150) {
      B.update(0.05, 1000 + t, N.player.group.position);
      t += 0.05;
      const st = B.debug.state();
      if (!st) break;
      let d = st.ry - lastRy; d = Math.atan2(Math.sin(d), Math.cos(d)); turn += Math.abs(d); lastRy = st.ry;
      const fx = Math.sin(st.ry), fz = Math.cos(st.ry);
      for (const [a, s] of [[3, 0], [-3, 0], [0, 1.1], [0, -1.1], [2, 0.9], [2, -0.9]]) {
        const x = st.x + fx * a + fz * s, z = st.z + fz * a - fx * s;
        const h = th(x, z);
        if (h > -0.45 || Z.seaBlocked(x, z)) { scrape++; worst ??= { x: +x.toFixed(1), z: +z.toFixed(1), why: h > -0.45 ? 'ground' : 'wall' }; }
        else if (Z.islandGroundHeight(x, z) > h + 0.6 && Z.islandGroundHeight(x, z) < 2.5) { pier++; worst ??= { x: +x.toFixed(1), z: +z.toFixed(1), why: 'pier' }; }
      }
    }
    return { t: +t.toFixed(1), turn: +turn.toFixed(1), scrape, pier, worst, arrived: !B.debug.state() };
  }, to, from);
  const bad = !r.arrived || r.scrape > 10 || r.pier > 0 || r.turn > 12;
  ok &&= !bad;
  console.log(`${bad ? 'FAIL' : 'ok  '} ${from.padEnd(8)} → ${to.padEnd(8)} ${r.arrived ? r.t + 's' : 'NEVER ARRIVED'}  turned ${r.turn} rad  scrapes ${r.scrape}  pier ${r.pier}  ${r.worst ? JSON.stringify(r.worst) : ''}`);
}
console.log(ok ? 'PASS' : 'FAIL');
await browser.close();

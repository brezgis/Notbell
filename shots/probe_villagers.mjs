// Villager life, fast-forwarded: steps the villagers, errands, houses and
// trains directly (no rendering) for SIM game-seconds, with the player parked
// out at sea. Per villager: distance walked, islands visited, errands,
// meetups, longest stretch stuck (has somewhere to be, isn't getting there),
// and how long they stood idle in the open. FAIL if anyone is stuck > 40s
// or never moves at all.
import { boot, sleep } from './lib.mjs';
const SIM = Number(process.env.SIM || 1800);
const { browser, page } = await boot();
await sleep(3000);
await page.evaluate(() => {
  const N = window.__notbell;
  N.player.group.position.set(40, 0, 300); // out of everyone's way
  window.__sim = { t: performance.now() / 1000 + 1000, stats: {} };
  for (const a of N.animals.animals) {
    window.__sim.stats[a.identity.name] = { dist: 0, isles: new Set(), errands: 0, meets: 0, stuck: 0, maxStuck: 0, still: 0, lastErr: null, lastMeet: null, px: a.g.position.x, pz: a.g.position.z, anchored: !!a.anchored, out: false };
  }
});
const STEPS = Math.round(SIM / 0.05);
for (let done = 0; done < STEPS; done += 1000) {
  await page.evaluate((n) => {
    const N = window.__notbell, S = window.__sim, dt = 0.05, far = N.player.group.position;
    for (let i = 0; i < n; i++) {
      S.t += dt;
      N.animals.update(dt, S.t, far);
      N.ambient.update(dt, far);
      N.houses.update(dt, S.t, far);
      N.bridge.update(dt, S.t); N.northline.update(dt, S.t); N.farline.update(dt, S.t);
      if (i % 20 === 0) for (const a of N.animals.animals) {
        const st = S.stats[a.identity.name], p = a.g.position;
        const d = Math.hypot(p.x - st.px, p.z - st.pz);
        if (d < 30) st.dist += d; // (a door or a train ride is a jump, not a walk)
        st.px = p.x; st.pz = p.z;
        const isle = N.zones.islandOf(p.x, p.z); if (isle && !a.away) st.isles.add(isle);
        if (!a.home) st.out = true;
        if (a.errand && a.errand !== st.lastErr) { st.errands++; } st.lastErr = a.errand;
        if (a.meeting && a.meeting !== st.lastMeet) { st.meets++; } st.lastMeet = a.meeting;
        const wants = a.goal && !a.queued && !a.riding && !a.busy && !a.inDoorway;
        if (wants && d < 0.05) { st.stuck += 1; st.maxStuck = Math.max(st.maxStuck, st.stuck); } else st.stuck = 0;
        if (!a.away && !a.goal && !a.busy && !a.meeting && !a.riding && !a.queued && d < 0.05) st.still += 1; else st.still = 0;
      }
    }
  }, Math.min(1000, STEPS - done));
}
const out = await page.evaluate(() => Object.entries(window.__sim.stats).map(([n, s]) => ({ n, dist: Math.round(s.dist), isles: [...s.isles].join(','), errands: s.errands, meets: s.meets, maxStuck: s.maxStuck, anchored: s.anchored, out: s.out })));
let ok = true;
for (const r of out) {
  if (!r.out) { console.log(`home ${r.n.padEnd(18)} (home all along, on their schedule)`); continue; }
  const bad = r.maxStuck > 40 || r.dist < 5;
  ok &&= !bad;
  console.log(`${bad ? 'FAIL' : 'ok  '} ${r.n.padEnd(18)} walked ${String(r.dist).padStart(5)}  errands ${r.errands}  meets ${r.meets}  stuck≤${r.maxStuck}s  ${r.anchored ? '(anchored) ' : ''}isles: ${r.isles}`);
}
console.log(ok ? 'PASS' : 'FAIL');
await browser.close();

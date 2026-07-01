// The canonical scene tour — stable vantages across the whole archipelago.
// Run before and after any visual change:
//
//   LABEL=before node canon.mjs     # → out/before/NN-*.png
//   ...make the change...
//   LABEL=after  node canon.mjs     # → out/after/NN-*.png
//
// then eyeball the pairs. Scenes are keyed to SITES/zone names, not raw
// coordinates, so they survive terrain nudges. Takes a few minutes — the
// headless renderer is slow and the fades are real.

import { boot, go, night, forceWeather, snap, sites, sleep } from './lib.mjs';

const { browser, page } = await boot();
const S = await sites(page);

// pre-chart every island so "Charted: …" toasts don't photobomb the tour
await page.evaluate(() => {
  for (const k of ['notbell', 'far', 'north', 'texas', 'volcano', 'bulko', 'grove', 'labs']) {
    window.__notbell.S.state.visited[k] = true;
  }
});

// -- Notbell -----------------------------------------------------------
await snap(page, 'village-plaza'); // boot spawn, default camera
await go(page, 'shop'); await snap(page, 'shop');
await go(page, 'cafe'); await snap(page, 'cafe');
await go(page, 'museum'); await snap(page, 'museum');
await go(page, 'island', S.cave); await go(page, 'cave'); await snap(page, 'cave');
await go(page, 'home'); await snap(page, 'cottage');
await go(page, 'island', S.dock); await snap(page, 'dock-persistent');
await go(page, 'island', S.pools); await snap(page, 'tide-pools');

// -- the archipelago ----------------------------------------------------
await go(page, 'island', S.town2); await snap(page, 'far-isle');
await go(page, 'island', S.town3); await snap(page, 'north-isle');
await go(page, 'island', S.texasYard); await snap(page, 'texas');
await go(page, 'island', S.vbeach); await snap(page, 'volcano-beach');
await go(page, 'island', { x: S.bigbox.x, z: S.bigbox.z + 14 }); await snap(page, 'bulko-lot');
await go(page, 'bulko'); await snap(page, 'bulko-inside');
await go(page, 'island', { x: S.manor.x, z: S.manor.z + 9 }); await snap(page, 'grove-manor');
await go(page, 'island', S.springs); await snap(page, 'hot-springs');
await go(page, 'island', S.labsYard); await snap(page, 'labs-yard');
await go(page, 'labs'); await snap(page, 'labs-lobby');
await go(page, 'moon'); await snap(page, 'moon-landing');

// -- light & weather (the village wearing night, then rain) -------------
await go(page, 'island', S.village);
await night(page, true); await snap(page, 'village-night');
await night(page, false);
await forceWeather(page, 'rain', 4000); await snap(page, 'village-rain');
await forceWeather(page, 'clear', 1000);

await browser.close();
console.log('canon tour complete.');

// The space update + everything else from the 2026-06-12 second batch:
// map fog, swimming, Notbell Labs (yard/pad/causeway/interior/kindergarten),
// the Lightseed quest, real tugboat voyages, villager meetups, flag protocol.
import puppeteer from 'puppeteer-core';

const GAME_URL = 'http://localhost:8123/';
const OUT = new URL('.', import.meta.url).pathname;

const browser = await puppeteer.launch({
  executablePath: '/usr/bin/google-chrome',
  headless: 'new',
  args: ['--no-sandbox', '--use-gl=angle', '--use-angle=swiftshader',
    '--enable-unsafe-swiftshader', '--window-size=1280,720', '--mute-audio'],
});
const page = await browser.newPage();
await page.setViewport({ width: 1280, height: 720 });
page.on('pageerror', (e) => console.log('PAGE ERROR:', e.message));
page.on('dialog', (d) => d.accept('Tester')); // the name prompt
await page.goto(GAME_URL, { waitUntil: 'networkidle0' });
await new Promise((r) => setTimeout(r, 4500));

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const shot = async (name) => {
  await page.screenshot({ path: `${OUT}${name}.png` });
  console.log('shot:', name);
};
const key = async (code, ms = 60) => {
  await page.keyboard.down(code);
  await sleep(ms);
  await page.keyboard.up(code);
  await sleep(180);
};
const prompt = () => page.evaluate(() => document.querySelector('#prompt').textContent);
const dlgState = () => page.evaluate(() => ({
  dlg: document.querySelector('#dialog').style.display !== 'none',
  ch: document.querySelector('#choices').style.display !== 'none',
  text: document.querySelector('#dialog-text')?.textContent?.slice(0, 60),
}));
async function advance(max = 18) {
  for (let i = 0; i < max; i++) {
    const s = await dlgState();
    if (!s.dlg || s.ch) return;
    await key('KeyE', 50);
  }
}
async function closeAll(max = 24) { // pages AND choice menus (picks focused)
  for (let i = 0; i < max; i++) {
    const s = await dlgState();
    if (!s.dlg) return;
    await key('KeyE', 50);
  }
}

await advance();      // welcome pages
await key('KeyE');    // pick the cat (first avatar choice)
await sleep(800);     // name prompt auto-accepted by dialog handler
await advance();

// ---- 300: the chart, mostly fog
await key('KeyP');
await sleep(600);
await shot('300-map-fog');
await key('KeyP');

// ---- 301: swimming (with the diver's suit)
await page.evaluate(() => {
  const { S, zones, SITES } = window.__notbell;
  S.addItem('scuba_suit');
  const D = SITES.dock;
  return zones.go('island', { x: D.x, z: D.z, rotY: Math.atan2(D.x, D.z) });
});
await sleep(900);
await page.keyboard.down('KeyW');
await sleep(3600);
await page.keyboard.up('KeyW');
await sleep(600);
const swim = await page.evaluate(() => {
  const p = window.__notbell.player.group.position;
  return { x: p.x.toFixed(1), z: p.z.toFixed(1), y: p.y.toFixed(2) };
});
console.log('swimmer at:', JSON.stringify(swim), '(y < -0.2 means swimming)');
await shot('301-swimming-helmet');

// ---- 302+: Notbell Labs, exterior
await page.evaluate(() => window.__notbell.zones.go('island', { x: -121, z: -47, rotY: Math.PI }));
await sleep(1500);
await shot('302-labs-yard');
console.log('yard prompt:', await prompt());

await page.evaluate(() => window.__notbell.zones.go('island', { x: -127, z: -67.5, rotY: Math.PI }));
await sleep(1200);
await shot('303-launch-pad');

// the catwalk: climb via teleport onto the roof corridor
await page.evaluate(() => window.__notbell.zones.go('island', { x: -120, z: -62, rotY: -Math.PI / 2 }));
await sleep(1200);
const roofY = await page.evaluate(() => window.__notbell.player.group.position.y.toFixed(1));
console.log('on the catwalk, y =', roofY, '(expect ~6.9)');
await shot('304-catwalk');

// the causeway from the North Isle
await page.evaluate(() => window.__notbell.zones.go('island', { x: -88, z: -71, rotY: -Math.PI / 2 }));
await sleep(1200);
const bridgeY = await page.evaluate(() => window.__notbell.player.group.position.y.toFixed(1));
console.log('on the causeway, y =', bridgeY, '(expect > 1)');
await shot('305-causeway');

// ---- 306+: inside the Labs
await page.evaluate(() => window.__notbell.zones.go('labs'));
await sleep(1300);
await shot('306-labs-lobby');

await page.evaluate(() => window.__notbell.zones.go('labs', { x: 306.5, z: 1703, rotY: Math.PI }));
await sleep(1000);
await shot('307-computer-room');

await page.evaluate(() => window.__notbell.zones.go('labs', { x: 314.5, z: 1697, rotY: Math.PI }));
await sleep(2500); // let the rovers notice the visitor
await shot('308-rover-kindergarten');
console.log('kindergarten prompt:', await prompt());

await page.evaluate(() => window.__notbell.zones.go('labs', { x: 288, z: 1693, rotY: Math.PI }));
await sleep(1000);
await shot('309-cafeteria');

// ---- 310+: the Lightseed quest
await page.evaluate(() => window.__notbell.zones.go('island', { x: -127, z: -71.5, rotY: Math.PI }));
await sleep(900);
console.log('rocket prompt:', await prompt());
await key('KeyE');
await sleep(400);
await shot('310-rocket-inspect');
await closeAll();

// the shrine hears about it
await page.evaluate(() => window.__notbell.zones.go('cave', { x: -300, z: -8.6, rotY: Math.PI }));
await sleep(1200);
console.log('shrine prompt:', await prompt());
await key('KeyE');
await advance();
await sleep(400);
await shot('311-shrine-offer');
await closeAll(); // picks "Cup your paws" (focused) then closes the rest
await sleep(600);
const hasSeed = await page.evaluate(() => window.__notbell.S.countItem('lightseed'));
console.log('lightseed in pocket:', hasSeed);

// back to the pad: give the rocket its heart
await page.evaluate(() => window.__notbell.zones.go('island', { x: -127, z: -71.5, rotY: Math.PI }));
await sleep(900);
await key('KeyE');
await advance();
await closeAll(); // "Place the Lightseed" is focused
await sleep(800);
const powered = await page.evaluate(() => window.__notbell.S.hasFlag('rocketPowered'));
console.log('rocket powered:', powered);
await shot('312-rocket-powered');

// ---- 313+: a real voyage home, on deck with Brine
await page.evaluate(() => {
  const { zones, SITES, S } = window.__notbell;
  S.setFlag('metBrine');
  const vb = SITES.vbeach;
  return zones.go('island', { x: vb.x - 4, z: vb.z + 3.2, rotY: 0 });
});
await sleep(900);
console.log('buoy prompt:', await prompt());
await key('KeyE'); // ring the buoy
await sleep(900);
await shot('313-brine-menu');
await key('KeyE'); // first choice: home (free)
await sleep(4500); // under way; the story should be playing
await shot('314-voyage-on-deck');
await closeAll(); // hear Brine out
// wait for landfall
let landed = false;
for (let i = 0; i < 40; i++) {
  await sleep(2000);
  await closeAll(4);
  const zone = await page.evaluate(() => window.__notbell.zones.current());
  if (zone === 'island') { landed = true; break; }
}
console.log('voyage landed:', landed);
await sleep(1200);
await shot('315-voyage-landed');

// ---- 316: friends meet (Howell & Saffron, wolf business)
await page.evaluate(() => {
  const { ambient, animals, zones } = window.__notbell;
  ambient.forceMeeting('Howell');
  const howell = animals.animals.find((a) => a.identity?.name === 'Howell');
  const p = howell.g.position;
  return zones.go('island', { x: p.x + 1, z: p.z + 5, rotY: Math.PI });
});
await sleep(7000); // let a bubble or two go by
await shot('316-howell-saffron-meetup');
console.log('meetup prompt:', await prompt());

// ---- 317: flag protocol — rain brings the wool in
await page.evaluate(() => {
  window.__notbell.almanac.forceWeather('rain');
  return window.__notbell.zones.go('island', { x: -122, z: -48, rotY: Math.PI });
});
await sleep(4500); // the flag checks the weather every 3s
await shot('317-labs-rain-flag-in');
await page.evaluate(() => window.__notbell.almanac.forceWeather('clear'));
await sleep(4000);
await shot('318-labs-clear-flag-up');

// ---- 319: the charted map, after the grand tour
await key('KeyP');
await sleep(600);
await shot('319-map-charted');

await browser.close();
console.log('done');

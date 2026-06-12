// Round 2: the things shoot10 couldn't see — a meetup that actually starts,
// real swimming into open water, the top of the flagpole, the voyage story.
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
page.on('dialog', (d) => d.accept('Tester'));
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
const dlgState = () => page.evaluate(() => ({
  dlg: document.querySelector('#dialog').style.display !== 'none',
  ch: document.querySelector('#choices').style.display !== 'none',
  text: document.querySelector('#dialog-text')?.textContent?.slice(0, 80),
}));
async function advance(max = 18) {
  for (let i = 0; i < max; i++) {
    const s = await dlgState();
    if (!s.dlg || s.ch) return;
    await key('KeyE', 50);
  }
}
await advance();
await key('KeyE'); // cat
await sleep(800);
await advance();

// ---- swimming, properly: north shore, water due north
await page.evaluate(() => {
  const { S, zones } = window.__notbell;
  S.addItem('scuba_suit');
  return zones.go('island', { x: 4, z: -28, rotY: Math.PI });
});
await sleep(900);
await page.keyboard.down('KeyW');
await sleep(4500);
await page.keyboard.up('KeyW');
await sleep(800);
const swim = await page.evaluate(() => {
  const p = window.__notbell.player.group.position;
  return { x: +p.x.toFixed(1), z: +p.z.toFixed(1), y: +p.y.toFixed(2) };
});
console.log('swimmer:', JSON.stringify(swim), '— swimming if y ≈ -0.28');
await shot('320-swimming');

// keep going: can we swim all the way to TEXAS? (it's at -14,-52)
await page.keyboard.down('KeyW');
await sleep(6000);
await page.keyboard.up('KeyW');
const swim2 = await page.evaluate(() => {
  const p = window.__notbell.player.group.position;
  return { x: +p.x.toFixed(1), z: +p.z.toFixed(1), y: +p.y.toFixed(2) };
});
console.log('long-distance swimmer:', JSON.stringify(swim2));
await shot('321-open-water-swim');

// ---- a meetup that reports back
const meet = await page.evaluate(() => {
  const { ambient, zones } = window.__notbell;
  for (const name of ['Howell', 'Clover', 'Puddle', 'Bramble', 'Mochi', 'Butterpat']) {
    const m = ambient.forceMeeting(name);
    if (m) {
      zones.go('island', { x: m.x + 1, z: m.z + 5.5, rotY: Math.PI });
      return m;
    }
  }
  return null;
});
console.log('meetup started:', JSON.stringify(meet));
await sleep(7500); // bubbles need an audience and a beat
await shot('322-friends-meetup');

// ---- the whole flagpole, from a respectful distance
await page.evaluate(() => window.__notbell.zones.go('island', { x: -122, z: -36, rotY: Math.PI }));
await sleep(1500);
await shot('323-flag-flying');

// ---- voyage story: sail home->volcano and catch the dialog mid-crossing
await page.evaluate(() => {
  const { zones, S, SITES } = window.__notbell;
  S.setFlag('metBrine');
  S.earn(100);
  const D = SITES.dock;
  const outA = Math.atan2(D.x, D.z);
  return zones.go('island', {
    x: D.x + Math.sin(outA) * 10.2, z: D.z + Math.cos(outA) * 10.2, rotY: outA,
  });
});
await sleep(900);
const hailPrompt = await page.evaluate(() => document.querySelector('#prompt').textContent);
console.log('pier-end prompt:', hailPrompt);
if (hailPrompt.includes('Brine')) {
  await key('KeyE');
  await sleep(700);
  // menu is up: pick the volcano (second choice — ArrowDown then E)
  await key('ArrowDown');
  await key('KeyE');
  for (let i = 0; i < 14; i++) {
    await sleep(1000);
    const s = await dlgState();
    if (s.dlg) {
      console.log('story on deck:', JSON.stringify(s.text));
      break;
    }
  }
  await shot('324-voyage-story');
} else {
  console.log('NOTE: rowboat outranked the tug at pier end; voyage story untested here');
}

await browser.close();
console.log('done');

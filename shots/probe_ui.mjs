// UI tour: every 2D surface, desktop and phone. LABEL=before|after keeps
// the two sets apart (out/<label>/). Also catches the loading screen and
// the first-run welcome.
import puppeteer from 'puppeteer-core';
import { KnownDevices } from 'puppeteer-core';
import { boot, snap, sleep, OUT } from './lib.mjs';

const port = Number(process.env.PORT) || 8123;
async function tour(mobile) {
  const tag = mobile ? 'm-' : 'd-';
  const { browser, page } = await boot({ mobile });
  const U = (fn, ...a) => page.evaluate(fn, ...a);
  await snap(page, tag + 'hud');
  // a prompt: stand by the well
  await U(() => window.__notbell.zones.go('island', { x: 4, z: 5.8, rotY: Math.PI }));
  await sleep(1200);
  await snap(page, tag + 'prompt');
  U(() => window.__notbell.ui.say([{ text: 'Oh! Hello there. Lovely morning for it — the tide pools are full and the kettle’s on.', speaker: 'Clover' }]));
  await sleep(2600);
  await snap(page, tag + 'dialog');
  await page.keyboard.press('KeyE'); await sleep(400);
  U(() => window.__notbell.ui.ask('Take a look! Everything’s for sale. Almost. Mostly.', [
    { label: '🛠️ Tools', value: 1 }, { label: '🌱 Seeds', value: 2 },
    { label: '🔘 The Shiniest Button', value: 3, hint: '999🔘', disabled: true }, { label: 'Never mind', value: 0 },
  ], { speaker: 'Pip' }));
  await sleep(2400);
  await snap(page, tag + 'choices');
  await page.keyboard.press('Digit4'); await sleep(400);
  U(() => { window.__notbell.ui.toast('You bought the <b>Dandelion Net</b>! <i>Swing it near anything that flutters.</i>', '🦋'); window.__notbell.ui.toast('You caught a <b>Lemon Flit</b>!', '🦋'); });
  await sleep(700);
  await snap(page, tag + 'toast');
  await sleep(3500);
  for (const [code, name] of [['KeyI', 'pockets'], ['KeyP', 'map'], ['KeyC', 'almanac']]) {
    await page.keyboard.press(code); await sleep(900);
    await snap(page, tag + name);
    await page.keyboard.press('Escape'); await sleep(400);
  }
  await U(() => dispatchEvent(new CustomEvent('notbell-settings'))); await sleep(700);
  await snap(page, tag + 'settings');
  await page.keyboard.press('Escape'); await sleep(300);
  await U(() => window.__notbell.zones.go('shop')); await sleep(1600);
  await snap(page, tag + 'interior');
  await browser.close();
}
await tour(false);
await tour(true);

// the loading screen, and the first-run welcome
{
  const browser = await puppeteer.launch({
    executablePath: '/usr/bin/google-chrome', headless: 'new',
    args: ['--no-sandbox', '--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--window-size=1280,720', '--mute-audio'],
  });
  const page = await browser.newPage();
  await page.setViewport({ width: 1280, height: 720 });
  let dialogs = 0;
  page.on('dialog', (d) => { dialogs++; d.accept('Sandy'); });
  const cdp = await page.createCDPSession();
  await cdp.send('Emulation.setCPUThrottlingRate', { rate: 8 });
  page.goto(`http://localhost:${port}/`);
  await sleep(900);
  await snap(page, 'd-loading');
  await cdp.send('Emulation.setCPUThrottlingRate', { rate: 1 });
  await page.waitForFunction(() => !document.getElementById('loading'), { timeout: 90000 });
  await sleep(2500);
  await snap(page, 'd-welcome');
  // click through the welcome until the picker's choices are up
  for (let i = 0; i < 12; i++) {
    if (await page.evaluate(() => document.getElementById('choices')?.style.display === 'flex')) break;
    await page.keyboard.press('KeyE'); await sleep(900);
  }
  await snap(page, 'd-picker');
  await page.keyboard.press('Digit1'); await sleep(3000);
  await snap(page, 'd-name');
  console.log('native dialogs:', dialogs);
  await browser.close();
}
console.log('out:', OUT);

// Shared puppeteer harness for Notbell screenshot probes.
//
// The gotchas this lib encodes (learned the hard way — don't re-learn them):
//  · headless swiftshader runs ~4-5 fps and main.js clamps dt at 0.05, so
//    GAME TIME RUNS ~5× SLOW in here. Poll conditions; never trust a wall-
//    clock wait to cover a game-time duration.
//  · weather rolls RANDOM at boot — boot() forces 'clear' unless told not to.
//  · the Date pin must be installed before page.goto (boot() handles it);
//    night is the pin (12:30) + a __notbellTz nudge of +9h at runtime.
//  · there is no camera API: reframing is synthetic mouse drag only (orbit()).
//  · dialogue has a typing effect and a ~250ms close debounce — drive it by
//    reading #dialog/#choices DOM state (advance/choose), never blind key mashes.
//
// Requires: python3 serve.py [port] already running, and the node_modules
// symlink (see shots/README.md).

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import puppeteer, { KnownDevices } from 'puppeteer-core';

export const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const HERE = path.dirname(fileURLToPath(import.meta.url));
// Screenshots land in shots/out/<LABEL>/ — set LABEL=before / LABEL=after
// around a change and diff the two directories.
export const LABEL = process.env.LABEL || 'shot';
export const OUT = path.join(HERE, 'out', LABEL);

let shotN = 0;

// Boot the game in headless chrome and wait until it's actually alive.
// opts: port (8123) · hour (12.5, pinned into Date before load) · name
//       · weather ('clear' | 'rain' | 'snow' | 'fog' | null to leave the roll)
//       · seed (true: pre-seed a save so the welcome/avatar/name flow never
//         runs; false for probes that test the welcome itself)
//       · mobile (emulate iPhone 13 + touch)
export async function boot({
  port = 8123, hour = 12.5, name = 'Sandy', weather = 'clear',
  seed = true, mobile = false,
} = {}) {
  const browser = await puppeteer.launch({
    executablePath: '/usr/bin/google-chrome', headless: 'new',
    args: ['--no-sandbox', '--use-gl=angle', '--use-angle=swiftshader',
      '--enable-unsafe-swiftshader', '--window-size=1280,720', '--mute-audio'],
  });
  const page = await browser.newPage();
  if (mobile) await page.emulate(KnownDevices['iPhone 13']);
  else await page.setViewport({ width: 1280, height: 720 });
  page.on('dialog', (d) => d.accept(name)); // the native name prompt
  page.on('pageerror', (e) => console.log('PAGE ERROR:', e.message));

  await page.evaluateOnNewDocument((h, nm, doSeed) => {
    // pin the clock so shots don't depend on when they're taken
    const RealDate = Date;
    const fixed = new RealDate();
    fixed.setHours(Math.floor(h), Math.round((h % 1) * 60), 0, 0);
    const offset = fixed.getTime() - RealDate.now();
    // eslint-disable-next-line no-global-assign
    Date = class extends RealDate {
      constructor(...a) { a.length ? super(...a) : super(RealDate.now() + offset); }
      static now() { return RealDate.now() + offset; }
    };
    if (doSeed) {
      // a save with 'woke' + avatar + name skips the whole welcome flow;
      // no `where` key means default spawn and no new-morning redirect
      try {
        localStorage.setItem('notbell-isle-save-v1', JSON.stringify({
          flags: { woke: true },
          avatar: { kind: 'cat', body: 0xf0c98f },
          name: nm,
        }));
      } catch {}
    }
  }, hour, name, seed);

  await page.goto(`http://localhost:${port}/`, { waitUntil: 'networkidle0' });
  await page.waitForFunction(
    () => window.__notbell && !document.getElementById('loading'),
    { timeout: 90_000, polling: 200 },
  );
  if (weather) await forceWeather(page, weather, 1200);
  await sleep(800); // first frames — let the camera settle on the player
  return { browser, page };
}

// ---- time & weather -------------------------------------------------------

// Night is a +9h nudge on the 12:30 pin (→ 21:30). Waits out the ~7s sky/
// almanac recompute (game-time, hence generous).
export async function night(page, on = true, settle = 7000) {
  await page.evaluate((v) => { window.__notbellTz = v; }, on ? 9 : 0);
  await sleep(settle);
}

export async function forceWeather(page, w, settle = 2500) {
  await page.evaluate((v) => window.__notbell.almanac.forceWeather(v), w);
  await sleep(settle); // particles spawn / window glow lerps in
}

// ---- getting around -------------------------------------------------------

// Teleport via zones.go and wait for the zone to actually flip (the fade is
// ~730ms of real time; go() also refuses re-entry mid-travel).
export async function go(page, zoneName, at) {
  await page.evaluate((n, a) => window.__notbell.zones.go(n, a), zoneName, at);
  await page.waitForFunction(
    (n) => window.__notbell.zones.current() === n,
    { timeout: 15_000, polling: 100 }, zoneName,
  );
  await sleep(900); // fade-out + camera snap
}

// Move within the current zone (re-runs the fade so the camera snaps too).
export async function place(page, x, z, rotY) {
  const cur = await zone(page);
  await go(page, cur, { x, z, rotY });
}

// Orbit the trailing camera by dragging. yaw/pitch in radians: positive yaw
// swings the camera counter-clockwise around the player (camYaw += yaw);
// positive pitch tilts down toward top-view (clamped 0.18..1.3 by the game).
// wheel: positive zooms out. NB the boot camera looks north (-z).
export async function orbit(page, { yaw = 0, pitch = 0, wheel = 0 } = {}) {
  const dx = -yaw / 0.005; // camYaw -= movementX * 0.005
  const dy = pitch / 0.004; // camPitch += movementY * 0.004
  if (dx || dy) {
    const steps = Math.max(1, Math.ceil(Math.max(Math.abs(dx), Math.abs(dy)) / 35));
    let x = 640, y = 360;
    await page.mouse.move(x, y);
    await page.mouse.down();
    for (let i = 0; i < steps; i++) {
      x += dx / steps;
      y += dy / steps;
      await page.mouse.move(x, y);
      await sleep(25);
    }
    await page.mouse.up();
    await sleep(200);
  }
  if (wheel) {
    await page.mouse.wheel({ deltaY: wheel });
    await sleep(300);
  }
}

export async function walk(page, code, ms) {
  await page.keyboard.down(code);
  await sleep(ms);
  await page.keyboard.up(code);
  await sleep(300);
}

export async function press(page, code, after = 250) {
  await page.keyboard.press(code);
  await sleep(after);
}

// ---- dialogue -------------------------------------------------------------

// Advance dialogue until it closes or choices appear. Reads DOM state; a
// press mid-typing skips to the end of the line, so this is fast and safe.
export async function advance(page, max = 16) {
  for (let i = 0; i < max; i++) {
    const s = await page.evaluate(() => ({
      dlg: document.querySelector('#dialog')?.style.display !== 'none',
      ch: document.querySelector('#choices')?.style.display !== 'none',
    }));
    if (!s.dlg || s.ch) return;
    await press(page, 'KeyE', 320); // 250ms close debounce + margin
  }
}

// Wait for the choice menu and click the option containing `label`.
export async function choose(page, label) {
  await page.waitForFunction(
    () => document.querySelector('#choices')?.style.display !== 'none',
    { timeout: 10_000, polling: 50 },
  );
  await page.evaluate((s) => {
    [...document.querySelectorAll('#choices .choice')]
      .find((b) => b.textContent.includes(s))?.click();
  }, label);
  await sleep(400);
}

// Close any stray open dialogue (e.g. an NPC that wandered into you).
export async function dismiss(page, max = 8) {
  for (let i = 0; i < max; i++) {
    const open = await page.evaluate(
      () => document.querySelector('#dialog')?.style.display !== 'none');
    if (!open) return;
    await press(page, 'KeyE', 320);
  }
}

// ---- readers --------------------------------------------------------------

export const zone = (page) =>
  page.evaluate(() => window.__notbell.zones.current());

export const pos = (page) => page.evaluate(() => {
  const p = window.__notbell.player.group.position;
  return { x: +p.x.toFixed(2), y: +p.y.toFixed(2), z: +p.z.toFixed(2),
    zone: window.__notbell.zones.current() };
});

export const dlgText = (page) =>
  page.evaluate(() => document.getElementById('dialog-text')?.textContent || '');

export const promptText = (page) =>
  page.evaluate(() => document.getElementById('prompt')?.textContent || '');

export const sites = (page) =>
  page.evaluate(() => JSON.parse(JSON.stringify(window.__notbell.SITES)));

// ---- output ---------------------------------------------------------------

export async function snap(page, name) {
  fs.mkdirSync(OUT, { recursive: true });
  const file = path.join(OUT, `${String(++shotN).padStart(2, '0')}-${name}.png`);
  await page.screenshot({ path: file });
  console.log('shot:', path.relative(HERE, file));
  return file;
}

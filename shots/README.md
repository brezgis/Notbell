# shots/ — the screenshot harness

Headless-Chrome probes that boot the real game and take screenshots. This is
how visual changes get verified (AGENTS.md: every visual change gets a
before/after). **Screenshot evidence, not code inspection, is what counts.**

## Setup (once per checkout / worktree)

```sh
ln -sfn ../../some-sibling-checkout/node_modules node_modules
```

(puppeteer-core is borrowed from any sibling checkout that has it installed;
there's no package.json here on purpose.) Chrome is expected at
`/usr/bin/google-chrome`.

## Running

```sh
python3 ../serve.py            # from repo root: serves 8123 (worktrees: pick 8124+)
node smoke.mjs                 # boot + move + door round-trip; PASS/FAIL, no shots
LABEL=before node canon.mjs    # the canonical tour → out/before/NN-*.png
LABEL=after  node canon.mjs    # …after your change → out/after/NN-*.png
```

`canon.mjs` visits ~20 stable vantages (every island, key interiors, the
village at night and in rain). Compare the pairs by eye. Probes never start
the server themselves.

## Writing a probe

Import `lib.mjs` — it encodes every hard-won gotcha:

```js
import { boot, go, place, orbit, night, forceWeather,
         advance, choose, dismiss, walk, press,
         pos, zone, dlgText, promptText, sites, snap, sleep } from './lib.mjs';

const { browser, page } = await boot();        // pinned 12:30, clear, welcome skipped
await go(page, 'island', (await sites(page)).manor);
await orbit(page, { yaw: Math.PI });           // look at a south-facing wall
await night(page, true);                       // 12:30 + 9h = 21:30
await snap(page, 'manor-back-at-night');
await browser.close();
```

### The gotchas (why the lib looks the way it does)

- **Game time runs ~5× slow in headless** (swiftshader ~4-5 fps × the dt
  clamp in main.js). Anything timed in game seconds needs ~5× the wall
  clock. Poll conditions (`waitForFunction`, `advance`, `go`) instead of
  sleeping when possible.
- **Weather is random at boot** — `boot()` forces `clear`. Force it back
  before any shot that assumes weather (the Labs flag is IN when it rains).
- **Night** = Date pinned to 12:30 by `boot()` + `window.__notbellTz = 9`
  (`night(page, true)`), then ~7s for the sky to recompute. Don't pin
  midnight directly — some probes need to toggle day/night in one session.
- **No camera API.** The trailing camera boots looking north (−z);
  `zones.go` only turns the player. To frame south-facing detail, `orbit()`
  (synthetic drag). `place()` re-runs the fade so the camera snaps.
- **Dialogue** types out and has a ~250ms close debounce. `advance()` and
  `choose()` read `#dialog`/`#choices` display state — never fire blind
  KeyE volleys.
- The native name prompt is answered by `boot()`'s dialog handler; the
  welcome/avatar flow is skipped by a seeded save (pass `seed: false` to
  test the welcome itself, e.g. the wake-up flows).
- Mobile: `boot({ mobile: true })` emulates iPhone 13; touch controls
  dispatch synthetic key events, so `press/walk` still work.
- **Villagers walk now** (B7): `ambient.forceMeeting()` returns while the
  guest is still walking over — poll for an animal with `meeting &&
  !meeting.pending` before asserting bubbles. Train riders queue via
  `__notbell.bridge.debug.enqueue(end, animal)`; a full ride is ~35 game
  seconds ≈ 3 real minutes headless.

## Layout

- `lib.mjs` — the harness (tracked)
- `smoke.mjs`, `canon.mjs` — canonical probes (tracked)
- `audit_b18.mjs` — computed geometry audit (tracked): flags floating walls,
  buried decks, and undersized prism/cone roofs island-wide, with positions
  and gap sizes. Run after any build work. Note: plinths and stilts are
  legitimate gap-fillers it can't see — triage its floaters list by eye.
- `out/` — screenshot output, per LABEL (ignored)
- `archive/` — retired one-off probes and their outputs, kept for reference
  (ignored); `audit/` — an older self-contained audit generation (ignored)

One-off probes for a specific bug are welcome — write them next to lib.mjs,
run them, then `mv` them into `archive/` when the fix ships. Only lib +
canonical probes + this README stay tracked.

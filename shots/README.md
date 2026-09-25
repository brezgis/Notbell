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

Needs Node ≥ 18 (the system `node` on north is v12 — put
`~/.nvm/versions/node/v22.22.0/bin` first on PATH). Probes talk to
`PORT` (default 8123; 8123 is often already taken on north, so e.g.
`python3 ../serve.py 8130` and `export PORT=8130`).

```sh
python3 ../serve.py 8130       # from repo root
node smoke.mjs                 # boot + move + door round-trip; PASS/FAIL, no shots
LABEL=before node canon.mjs    # the canonical tour → out/before/NN-*.png
LABEL=after  node canon.mjs    # …after your change → out/after/NN-*.png
node clip_audit.mjs            # collision audit → out/<LABEL>/clip_audit.json
VIEWS=@views.json node views.mjs   # any list of camera views → shots + a contact sheet
```

`views.mjs` takes `[{ "n": name, "x", "z", "y"?, "yaw", "pitch", "dist",
"zone"?, "px"/"pz"? (where to park the player), "find"? ("#rrggbb" — aim at
the first mesh of that color) }]`. `SHOW=1` draws every blocker outline on
the ground (red structures, green trees/rocks, blue keepouts); `NIGHT=1`,
`WEATHER=rain`.

`clip_audit.mjs` samples every spot a body can stand on the islands and
reports solid meshes the body would be inside — walls you can walk into,
plinths you sink through, trunks you ghost past. Bounding boxes flatter
round things, so triage its list by eye; the top of the list is what
matters.

`roof_audit.mjs` samples every roofed wall's top edges and reports any
that poke out through the roof (the classic: a prism roof whose eaves sit
below the wall top).

Behavior probes: `probe_life.mjs` (no villager teleports; errands and
bedtime are walks), `probe_route.mjs` (a Far Isle villager walks to the
Notbell plaza over the footbridge, never in the sea), `probe_ride.mjs` (the
Grove Line end to end), `probe_rail.mjs` (every station, both ends),
`probe_pastime.mjs` (someone goes fishing), `probe_reach.mjs` (every
interactable can still be walked up to), `probe_dive.mjs` (suit up, dive
to the Dropped Crown, ride a bubble to the Glow), `probe_swim.mjs` (on foot, with the suit: into the sea from the tide
pools and back, into the footbridge's rails, and at the bridge from the water),
`probe_burrough.mjs` (down the Labs molehill, ride the
Boring Line to Uptown, up into the wine cellar and back through its little door).

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
- **Camera:** `view(page, {x, y?, z}, {yaw, pitch, dist})` aims the camera
  at any point without moving the player (the `__notbell.cam` debug hook);
  `view(page, null)` hands it back. The older `orbit()` (synthetic drag) still
  works. The trailing camera boots looking north (−z).
- **Dialogue** types out and has a ~250ms close debounce. `advance()` and
  `choose()` read `#dialog`/`#choices` display state — never fire blind
  KeyE volleys.
- The native name prompt is answered by `boot()`'s dialog handler; the
  welcome/avatar flow is skipped by a seeded save (pass `seed: false` to
  test the welcome itself, e.g. the wake-up flows).
- Mobile: `boot({ mobile: true })` emulates iPhone 13; touch controls
  dispatch synthetic key events, so `press/walk` still work.
- **Villagers walk now**: `ambient.forceMeeting()` returns while the
  guest is still walking over — poll for an animal with `meeting &&
  !meeting.pending` before asserting bubbles. Errands walk to the door
  first (`errand.phase === 'going'`). Train riders queue via
  `__notbell.<bridge|northline|farline>.debug.enqueue(stationIdx, animal)`
  (the strait line still accepts 'A'/'B'); `debug.hurry()` skips the
  current wait. A full ride is ~35 game seconds ≈ 3 real minutes headless.

## Layout

- `lib.mjs` — the harness (tracked)
- `smoke.mjs`, `canon.mjs`, `views.mjs`, `clip_audit.mjs` — canonical
  probes and tools (tracked), plus the behavior probes above
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

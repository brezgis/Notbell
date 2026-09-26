# Notbell architecture

Reference for how the code is put together. Read AGENTS.md first for the
rules; this file explains the machine. Facts here were verified against the
tree on 2026-07-01 (45 modules, ~20k LOC); updated 2026-09-23 for the
collision/railway cleanup (railway.js, the zones blocker/surface API).

## Boot

`index.html` (shell, UI styles, an inline import map `three →
vendor/three.module.js`) loads `src/main.js` as a module. No build step —
what's in the tree is what ships. The inline import map is sha256-hashed into
the CSP `<meta>` tag at the top of the file (see AGENTS.md → Workflow).

`main.js` then: loads the save → builds renderer/lights/camera → constructs
every feature module (order matters, see below) → adds their groups to the
scene → tags occluders → restores where you were (or walks you home on a new
day) → starts the one animation loop.

## Layers

```
leaves      utils  audio  calendar  catalog  controls      (zero sibling imports)
foundation  terrain   state   ui   interact   zones
world kit   animals  nature  art  hats  nightglow  almanac  sky  fieldguide
features    buildings houses cave fishing digging tidepools player ocean
            railway (the train kit) → bridge northline farline (its lines)
            island2 island3 island5 island6 fold farther bulko moon
            boats volcano texas ghost beachball oceanlife
            ambient villagers multiplayer settings
            tools (rod/net/shovel in your paws) shells starfall
            crown (the world under the reef)  burrough (the city under the islands)
conductor   main.js
```

There are **no import cycles**. Cross-feature edges are one-way constant or
factory pulls only (`boats ← bulko.BULKO_DOCK`, `houses ← island3.MOUSEBOAT`,
`fishing ← cave.CAVE_POND`, `moon ← island6.buildRover`, …). Keep it that
way: if adding an edge would create a cycle, the thing you're importing
probably belongs a layer down (this is why `calendar.js` has zero imports —
everything may consult it at module-eval time).

## The seams (where features plug in)

- **`terrain.js`** — the analytic heightmap IS the world. `terrainHeight(x,z)`
  is deterministic and cheap; everything (props, NPCs, boats, fish shadows)
  samples it — there are no physics raycasts against the ground. Named
  `SITES` (village plateau, cave knoll, tide-pool shelf…) are found by
  scanning the base heightmap and blending flat. Island centers/radii
  (`ISLAND2…6`, `TEXAS`, `VOLCANO`) export from here. The terrain plane is
  390×320 translated (−35,0,0): x spans −230..160, ocean plane ends ±400.
- **`zones.js`** — walkability + travel. One zone is active at a time
  (`island`, `sea`, each interior, `moon`). Interiors register via
  `registerInterior` (bounds + blockers + floorY + lighting + spawn/exit) and
  live far off-island (x≈±300, moon at x≈1000); `zones.go(name)` teleports
  behind `fadeSwap` and applies the zone's lighting profile. Whole other
  worlds (the moon) use `registerWorld` with their own ground/physics, and
  pass `root: group` so the world only shows while you're in it.
  `onChange` fires after a zone swap settles (HUD listens). The island's
  collision vocabulary:
  - **blockers** — solid footprints. `addBlocker(x, z, r, kind)` circles,
    `addBlockerBox(x, z, w, d, rotY, pad, kind)` oriented rectangles.
    Bucketed on an 8u grid (there are hundreds — every tree trunk). `kind`:
    `'structure'` (default), `'tree'` (solid to walkers, invisible to the
    tree/cottage planners so solid trees don't thin later forests),
    `'keepout'` (reserved ground: walkable, but planners asking
    `nearBlocker` stay off it — railways and bridge feet use these).
    `nearBlocker` = structures+keepouts, `solidAt` = structures+trees,
    `nearAnything` = all three.
  - **surfaces** — raised floors you step UP onto: `addSurface({contains,
    height})`, `addSurfaceBox`, `addSurfaceDisc`. Plinths, porches, station
    platforms and ramps, the rocket pad. Unlike crossings they don't beat
    blockers; like crossings they carry you over water.
  - **crossings** — `addCrossing({contains, height})` for bridges, the arch,
    causeways, catwalks: **crossings beat blockers** in `canWalk`.
  - **sea walls / gates** — `addSeaWall({contains})` stops hulls and
    swimmers (the arch's rock, the MouseBoat's hull); `addSeaGate` marks a
    gap boats may pass (the arch tunnel) and boats.js routes voyages
    through it.
  - **bodies** — `canStand(x, z, r)` / `islandCanStand` test a body's rim,
    not just its center; the player (r 0.3) and villagers (0.28) use it, so
    shoulders stop at walls. The player also can't walk through villagers
    (`player.bodies`). `islandGroundHeight` is the walking height for NPCs
    (so villagers cross bridges ON the planks, not in the sea).
  - **doors** — `setDoor(zone, {x, z})` / `doorOf(zone)`: the spot outside
    a walk-in place. Errands and bedtimes walk to it.
  - **routes** — `islandOf(x, z)` names the island; `addLink({a, b, kind:
    'walk'|'rail', path, board?})` registers a way across (the footbridge,
    the arch, the causeway walk; every railway registers a rail link);
    `findRoute(from, to)` is a BFS over them. A villager whose `goal` is on
    another island follows the route (animals.js `planRoute`), queues for
    trains, and resumes afterwards — so nobody paces a shoreline forever.
- **`interact.js`** — the "walk up and press E" registry. `register({pos|getPos,
  r, label, use, enabled, zone, priority})`; nearest-eligible-wins, priority
  breaks ties (fishing registers at priority 0 so everything beats it).
  Dynamic `zone: () => …` lets a thing follow the player across zones
  (Murmur).
- **`state.js`** — the save. One `state` object, whole-object JSON to
  localStorage (debounced `save()`, immediate `saveNow()` for beforeunload).
  `load()` merges saved data over defaults key-by-key — **new fields must be
  added to the defaults and merged there**, so old saves keep working. Story
  flags are one global bag (`setFlag`/`hasFlag`); quest chains couple islands
  through it (e.g. `sawRocket`/`rocketPowered`: set in island6, read in cave
  and moon; `metPinion`: set in island6, read on the moon).
- **`catalog.js`** — pure data (no three.js, no DOM): `ITEMS`, loot tables
  (`rollFish`, `FOSSIL_TABLE`, `POOL_TABLE`, `METEOR_TABLE`), lore text,
  shop stock. Balance and content edits happen here.
- **`ui.js`** — dialogue (`say`, `ask` with typewriter + choices), prompt,
  toasts, pockets, HUD, `fadeSwap`, `escapeHtml`. Dialogue state gates the E
  key (`isBusy`/`justClosed`, 250ms close debounce — test harnesses must
  respect it).
- **`calendar.js` / `almanac.js`** — calendar is the import-free clock/season/
  holiday leaf (`SEASON` and `HOLIDAY` are baked at load). almanac owns the
  live sun, weather state machine, and rain/snow particles; `forceWeather()`
  and `window.__notbellTz` exist for the screenshot harness. Seasonal palette
  is applied at load in two places keyed off `SEASON`: `terrain.js`
  (`GRASS_BY_SEASON`) and `nature.js` (`LEAF_COLORS`).
- **`animals.js`** — `buildAnimal(kind, colors)` is the one critter factory
  (villagers, keepers, player bodies, rovers all come from it);
  `animateGait(group, t, walk)` is the shared walk cycle. New species = new
  kind here, consumed everywhere.
- **`nightglow.js`** — `glowWindow(mesh, {warm, max})` registers emissive
  glass; `updateNightGlow(dt)` (called from main's outdoor block) lerps all
  panes on at night/rain/fog. This is the pattern for "glow without lights".
- **`fieldguide.js`** — the chart + critterpedia. New islands call
  `addIslandInfo` to appear on the map; `markVisited` unfogs cells.

- **`railway.js`** — the train kit. `defineLine({points, stops, sides?})`
  runs at module load: route, a rail-height table (low beside stations,
  `CRUISE` over open water so the tug fits under, slope-limited), stations
  beside the track (deck + ramp as surfaces, keepouts reserving the
  ground). `createRailway(line, opts)` builds the trestle, the two-engine
  consist (every car follows the rail on its own — it bends and tilts), the
  timetable, and the rider rules (one per carriage, ≤2 villagers queued,
  the player queues like anybody). `bridge.js`, `northline.js`,
  `farline.js` are just routes + colors + flavor text on top.

## Creation order in main.js (these are load-bearing)

- `createBuildings()` first — registers interiors + blockers others rely on.
- `createIsland3()` **before** `createHouses()` — Crumb sleeps on the
  MouseBoat (`island3.js` exports the mutable `MOUSEBOAT` binding houses
  reads).
- `createBulko()` and `createIsland6()` **before** `createBoats()` — the
  ferry consumes `BULKO_DOCK` / `LABS_DOCK` exports.
- `nameVillagers(animals.animals)` right after `createAnimals()`.

If you add a module with a similar dependency, wire it in the same style and
comment the reason inline — the ordering comments in main.js are the real
documentation.

## The update loop (main.js)

One `setAnimationLoop`; `dt` clamped to 0.05 (headless swiftshader runs
~5× slow because of this clamp — harness timing must account for it).
Gating convention:

- Outdoor-only systems (ocean, sky, nightglow, nature, oceanlife, boats,
  volcano, bridge, digging, tidepools, beachball, texas, northline, farline)
  update inside main's `if (outdoors)` block (`zone === 'island' || 'sea'`).
  Indoors, the ocean and sky groups are hidden outright (interiors float
  far out over the sea plane; hiding it is what makes rooms read as rooms).
- Systems with indoor life (bulko, island5 — the manor staff —, island6,
  fold, farther, buildings, houses, island2, island3) update every frame and
  **gate themselves by zone internally**.
- Single-zone systems (moon, cave) are gated by zone equality in main.

Pick one of these three shapes for anything new; don't invent a fourth.

Also owned by main.js: the drag-orbit/pinch camera (`camYaw/camPitch/camDist`
spherical around the player), the wall-fade occlusion system (auto-tags
BoxGeometry meshes with `h ≥ 2.2 && max(w,d)·h ≥ 12` as occluders, plus
anything with `userData.occlude === true` — set that on new walls that miss
the heuristic), mood selection for the soundtrack, the 2.5s save/HUD tick,
and the `window.__notbell` debug hook the harness drives (including
`cam.view(point, {yaw, pitch, dist})`, which aims the camera anywhere
without moving the player — `shots/views.mjs` is built on it).

## Shared kits added 2026-09-23

- **`animals.idleAll(t)`** (called once per frame from main) — every
  `buildAnimal` character breathes, blinks and glances; anyone standing
  still >3s also fidgets (sway, weight shift, a foot shuffle) — additive to
  whatever else drives them, and off the moment they move. Set
  `userData.noFidget` to opt out (the player, multiplayer avatars) or
  `userData.fidget` to force it on plus an occasional hop (shopkeepers).
  Moth/bee wings live in `parts.wings` and flutter here.
- **`campfire.js`** — `makeFlames` / `makeCampfire`: layered flames, embers,
  sparks, and a warm additive ground decal instead of a light. Doesn't touch
  the PRNG.
- **`ocean.waveAt(x, z, t)`** — the RENDERED sea height (the coarse grid,
  interpolated). Anything riding the water (fish shadows, bobbers, kayaks)
  should sit on it, not on `WATER_Y`.
- **Railway queue** — `railway.js` platforms keep a real line: villagers walk
  up, stand at the carriage doors (`a.busy`, `a.queued`), board in order;
  whoever is still walking over doesn't hold the line; the train grants a
  few seconds' grace to someone nearly there. `shots/probe_queue.mjs`.
- **`audio.js`** — two buses (music, sfx) through a warm low-pass and a small
  generated reverb; soft attacks on every note; square/saw requests are
  softened. The soundtrack is generative (per mood: key, scale, chords,
  density; the lead improvises each bar). Moods: morning / day / evening /
  night by the hour, rain / snow / fog by weather, plus places.
  `setAmbience({outdoors, night, weather, coast, high})` drives surf, wind,
  rain beds and bird/cricket/gull calls.

## Hard invariants (break one of these and distant things fail)

1. `calendar.js` keeps **zero imports** (module-eval consumers everywhere).
2. `utils.js` PRNG stays mulberry32 with seed `0x5eedbe11` — world layout is
   identical across machines/refreshes; multiplayer guests depend on it.
3. `terrainHeight` stays deterministic and analytic — same answer for the
   same (x,z), no scene queries.
4. `camera.far` is 600 and the moon sits at x=1000 (the Dropped Crown at
   x=−1150): no world can ever render another. New far-off worlds must stay
   >1000 from the archipelago (the terrain mesh now spans x −230..230; the
   ocean plane ends ±400 and hides indoors). They're still hidden when you're
   elsewhere (`registerWorld({ root })`) — not to be unseen, but because
   thousands of out-of-sight meshes cost CPU every frame.
5. Interiors live far off-island and only one interior root is visible at a
   time (`zones.syncInteriorRoots`).
6. Save-shape changes go through the defaults+merge pattern in `state.load()`
   and never rename keys (see AGENTS.md rule 11).
7. The inline import map in `index.html` is CSP-hashed (the meta tag above it).
8. Prism/wedge roofs: build `CylinderGeometry(r, r, len, 3, 1, false,
   Math.PI/2)` **before** `rotateZ` — other phase values skew the ridge
   (this has bitten twice).
9. Matrices: main.js's `updateMoved()` replaces three's per-frame
   `scene.updateMatrixWorld()`. An object's matrix is recomputed only when its
   position/rotation/quaternion/scale or its parent changed, and hidden
   branches are skipped until shown. So: move things through those
   properties (as everything does); if you ever write `.matrix` by hand, set
   `matrixAutoUpdate = false` and `matrixWorldNeedsUpdate = true`; and to
   read where a hidden thing is, use `getWorldPosition()` (it updates the
   chain) rather than its `matrixWorld`.
10. Touch controls dispatch **real synthetic KeyboardEvents** (controls.js) —
   new features that listen for keys inherit mobile support for free; don't
   add pointer-only input paths.

## Known duplication (deliberate) and quirks

- `mat(color, rough)` (18 copies) and `box(w,h,d,color)` (12 copies) are
  **intentionally** per-file: modules stay self-contained and independently
  editable, which is what makes parallel agent lanes safe. Match the local
  copy; extracting a shared meshkit is a big cross-file change — flag it
  before doing it (AGENTS.md rule 2). Note the default roughness drifts by file (0.85–0.95) — that's
  fine, it's per-place texture.
- `collectInteriorRoot` exists in 6 files with two divergent signatures —
  known extraction candidate; it touches six hot files at once.
- `MOUSEBOAT` (island3.js) is the codebase's one **mutable** cross-module
  export (`export let`), read by houses.js — hence the creation-order rule.
- `multiplayer.js` is live but minimal on purpose (raw WebRTC, `O` key,
  manual copy-paste signaling; STUN only) — the no-third-party-scripts CSP
  rules out anything fancier.
- Exported-but-unconsumed: `REEF` (oceanlife), `GALLERY` (art), `FRIEND_OF`
  (villagers), `moonHeight` (moon). `forceWeather`/`isFoggy` (almanac) look
  unused in src/ but are harness hooks via `window.__notbell` — keep them.

## Performance budget

pixelRatio ≤ 1.5 (≤ 1.25 on touch) · shadows: one 1024px PCF map in a box
that follows the sun target, re-rendered every frame only where that box
covers you (`zones.sunShadowsHere()`; rooms draw it once on arrival) · outdoor point lights were culled 17→~6 once and
must not creep back (interiors get brightness from their zone hemisphere
profile; glow is emissive, `nightglow.js`) · outdoor updates gate by zone ·
occlusion fade is one raycast per frame against tagged occluders.

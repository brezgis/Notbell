# Notbell architecture

Reference for how the code is put together. Read AGENTS.md first for the
rules; this file explains the machine. Facts here were verified against the
tree on 2026-07-01 (45 modules, ~20k LOC).

## Boot

`index.html` (shell, UI styles, an inline import map `three →
vendor/three.module.js`) loads `src/main.js` as a module. No build step —
what's in the tree is what ships. The inline import map is sha256-hashed into
the production CSP (see AGENTS.md → Workflow).

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
            bridge island2 island3 island5 island6 fold farther bulko moon
            boats northline volcano texas ghost beachball oceanlife ambient
            villagers multiplayer settings
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
  behind `fadeSwap` and applies the zone's lighting profile. Water crossings
  (bridges, the arch, causeways, train trestles) are `addCrossing({contains,
  height})` — **crossings beat blockers** in `canWalk`. Whole other worlds
  (the moon) use `registerWorld` with their own ground/physics. `onChange`
  fires after a zone swap settles (HUD listens).
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
  volcano, bridge, digging, tidepools, beachball, texas, island5, northline)
  update inside main's `if (outdoors)` block (`zone === 'island' || 'sea'`).
- Systems with indoor life (bulko, island6, buildings, houses, island2,
  island3) update every frame and **gate themselves by zone internally**.
- Single-zone systems (moon, cave) are gated by zone equality in main.

Pick one of these three shapes for anything new; don't invent a fourth.

Also owned by main.js: the drag-orbit/pinch camera (`camYaw/camPitch/camDist`
spherical around the player), the wall-fade occlusion system (auto-tags
BoxGeometry meshes with `h ≥ 2.2 && max(w,d)·h ≥ 12` as occluders, plus
anything with `userData.occlude === true` — set that on new walls that miss
the heuristic), mood selection for the soundtrack, the 2.5s save/HUD tick,
and the `window.__notbell` debug hook the harness drives.

## Hard invariants (break one of these and distant things fail)

1. `calendar.js` keeps **zero imports** (module-eval consumers everywhere).
2. `utils.js` PRNG stays mulberry32 with seed `0x5eedbe11` — world layout is
   identical across machines/refreshes; multiplayer guests depend on it.
3. `terrainHeight` stays deterministic and analytic — same answer for the
   same (x,z), no scene queries.
4. `camera.far` is 600 and the moon sits at x=1000: neither world can ever
   render the other, with no toggling. New far-off worlds must stay >1000
   from the archipelago (ocean plane ends ±400).
5. Interiors live far off-island and only one interior root is visible at a
   time (`zones.syncInteriorRoots`).
6. Save-shape changes go through the defaults+merge pattern in `state.load()`
   and never rename keys (see AGENTS.md rule 11).
7. The inline import map in `index.html` is CSP-hashed in production.
8. Prism/wedge roofs: build `CylinderGeometry(r, r, len, 3, 1, false,
   Math.PI/2)` **before** `rotateZ` — other phase values skew the ridge
   (this has bitten twice).
9. Touch controls dispatch **real synthetic KeyboardEvents** (controls.js) —
   new features that listen for keys inherit mobile support for free; don't
   add pointer-only input paths.

## Known duplication (deliberate) and quirks

- `mat(color, rough)` (18 copies) and `box(w,h,d,color)` (12 copies) are
  **intentionally** per-file: modules stay self-contained and independently
  editable, which is what makes parallel agent lanes safe. Match the local
  copy; don't extract a shared meshkit without lead approval (AGENTS.md
  rule 2). Note the default roughness drifts by file (0.85–0.95) — that's
  fine, it's per-place texture.
- `collectInteriorRoot` exists in 6 files with two divergent signatures —
  known extraction candidate, needs lead approval since it touches six hot
  files at once.
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
that follows the sun target · outdoor point lights were culled 17→~6 once and
must not creep back (interiors get brightness from their zone hemisphere
profile; glow is emissive, `nightglow.js`) · outdoor updates gate by zone ·
occlusion fade is one raycast per frame against tagged occluders.

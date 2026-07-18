# AGENTS.md — how to work on Notbell

Notbell Archipelago is a low-poly village-life game: plain three.js ES modules,
**no build step, no dependencies** (three.js r180 vendored in `vendor/`), saves
in localStorage, live at <https://notbell.brezgis.com>. This file is the
constitution for anyone — human or model — touching the code. `CLAUDE.md` is a
symlink to this file; they are the same document.

Longer references live in `docs/`:

- `docs/ARCHITECTURE.md` — module map, seams, creation order, update loop, invariants
- `docs/VISUAL_CANON.md` — the look: palette, materials, proportions, lighting budget
- `docs/FEATURE_RECIPES.md` — how to add islands, interiors, NPCs, interactables, items, vehicles
- `docs/LORE.md` — story canon and character voices (contains spoilers, obviously)

## Run and verify

```sh
python3 serve.py            # serves on 8123 with no-cache headers
python3 serve.py 8124       # any other port (parallel worktrees each get their own)
```

Visual verification uses the puppeteer harness in `shots/` — see
`shots/README.md`. **Every visual change gets a before/after screenshot.**
Judging a visual change by code inspection or game state alone is not
verification here.

## The rules

1. **Match the style: faceted, flat-shaded, low-poly, chibi-cute, simple.**
   If a change tempts you toward more detail, realism, or polish — don't.
   Simpler is the look. See `docs/VISUAL_CANON.md`.
2. **Reuse the existing conventions.** In-file helpers (`box()`, `mat()`),
   `terrainHeight`, the SITES/blocker system, `interact.register`, the
   interior/walk-in pattern, existing data tables. Deviate only when a pattern
   is genuinely architecturally wrong — and then **flag it, don't silently
   rewrite.** Over-polished or parallel-system changes get reverted.
3. **No new dependencies, backends, services, or build steps.** Static files
   only. Multiplayer is raw WebRTC on purpose; no third-party scripts may ever
   run on the domain (strict CSP in production).
4. **World generation is deterministic.** Anything *placed in the world*
   (trees, rocks, props, layout) uses the seeded PRNG from `utils.js`
   (`rand`/`rand01`/`pick`) so every copy of the game grows the same islands —
   multiplayer guests depend on this. `Math.random()` is fine for transient
   gameplay (fishing rolls, dialogue picks, ambient timing), never for layout.
5. **Dialogue is only what a character is saying or doing.** No stage
   narration folded into speech lines. Keep each character's established
   voice (`docs/LORE.md`).
6. **Real-world text must be public domain** — author *and* translator,
   verified against a real source (Project Gutenberg etc.), never quoted from
   memory. The game is publicly served.
7. **Don't fix intentional quirks.** The chart cuts off the Labs on purpose.
   The lobster tank is NOT FOR SALE. Howell is a wolf. The parking lot needs
   no roads. TEXAS is TEXAS. The volcano never erupts. If something looks
   like a bug but might be a joke: leave it, flag it.
8. **The player's lantern glow is canon.** Never remove or dim it.
9. **New solid meshes set `castShadow` and `receiveShadow`.** Glowing/emissive
   things cast no shadow.
10. **Respect the performance budget.** No new `PointLight`s in the outdoor
    world — glow is emissive material, not light (see VISUAL_CANON). One
    1024px shadow map. Outdoor systems only update when the player is
    outdoors; interiors gate themselves by zone.
11. **Persistence must survive old saves.** Extend `state.js` via the existing
    defaults-then-merge pattern in `load()`; never rename or repurpose saved
    keys. All user-derived strings that reach the DOM go through
    `ui.escapeHtml`.
12. **Stay in scope.** Don't restyle, rename, or "improve" neighbors of the
    thing you were asked to change.

## File tiers

**Edit freely** (data and leaves — safe for any agent):

- `src/catalog.js` — pure data: items, prices, blurbs, fish tables, lore text
- `src/villagers.js` — names, dialogue, friendships (keep voices; rule 5)
- New leaf modules built from a recipe in `docs/FEATURE_RECIPES.md`
- `shots/` probe scripts

**Edit carefully** (shared seams and hot files — small diffs, screenshot proof;
these also force serialization between parallel work lanes):

- `src/buildings.js`, `src/houses.js`, `src/animals.js`, `src/boats.js`
- `src/island2.js`, `src/island3.js`, `src/island5.js`, `src/island6.js`,
  `src/bulko.js`, `src/moon.js`, `src/nature.js`
- `src/ui.js`, `src/state.js`, `src/audio.js`, `src/almanac.js`,
  `src/fieldguide.js`

**Don't touch without lead approval** (topology, physics, the game loop, and
load-bearing invariants):

- `src/main.js` — renderer, camera, occlusion, the one update loop
- `src/zones.js` — walkability, crossings, interiors, zone lighting
- `src/terrain.js` — the heightmap IS the world; everything samples it
- `src/player.js` — movement, swimming, the lantern glow (rule 8)
- `src/calendar.js` — **must keep zero imports** (everything consults it at
  module load; a cycle here bricks the boot)
- `src/utils.js` — the seeded PRNG; changing it reshuffles every world
- `index.html` — the inline importmap is hashed into the production CSP
- `vendor/` — vendored three.js, never edit

## Workflow

- `FIXES_PLAN.md` and `CODEX_TASKS.md` are **local-only** working docs
  (git-excluded); don't expect them on other checkouts.
- One task = one git worktree off `main`:
  `git worktree add -b codex/<slug> ../notbell-<slug> main`, then point
  `shots/node_modules` at any `node_modules` that has puppeteer-core (a
  relative symlink — see `shots/README.md`) and serve on your own port.
  Commit on the branch; **never merge to main yourself** — review and merge
  happen on `main`.
- Parallel lanes are safe **iff their tasks touch disjoint files** (see the
  hot-file list above).
- `main` is the integrate/verify/deploy station. Deploy (lead only, exact
  bare form — it's permission-matched):

  ```sh
  rsync -az --exclude shots --exclude .git --exclude serve.py index.html src vendor README.md package.json favicon.svg your-server:/var/www/notbell/
  ```

  Production nginx (on your-server) serves a strict CSP whose `script-src`
  includes the sha256 of the inline importmap in `index.html` — if any inline
  script changes, recompute the hash and update
  `/etc/nginx/snippets/notbell-headers.conf` on the server, or the site ships
  a white screen.
- Never commit screenshots (`shots/*.png` is git-ignored). One-off probe
  scripts belong in `shots/archive/`, also ignored; only the harness lib and
  canonical probes are tracked.

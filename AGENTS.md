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
python3 serve.py 8130       # any other port (8123 is often taken on north)
```

Visual verification uses the puppeteer harness in `shots/` — see
`shots/README.md` (needs Node ≥ 18: the system `node` on north is 12, use
`~/.nvm/versions/node/v22.22.0/bin`; set `PORT` to match the server).
**Every visual change gets a before/after screenshot.** Judging a visual
change by code inspection or game state alone is not verification here.
For collision work, `shots/clip_audit.mjs` measures every walkable spot
against every solid mesh, and `SHOW=1 node views.mjs` draws the blocker
outlines into the screenshots.

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
   **…and they are solid.** Anything a body shouldn't pass through gets a
   blocker (`zones.addBlockerBox` for rectangles — walls, counters, pews;
   `addBlocker` circles for posts, trunks, rocks). Anything raised you
   *should* be able to stand on (plinths, porches, platforms, pads) is a
   `zones.addSurface*`, not a slab you wade through. Foundations reach the
   ground on their lowest corner.
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

**Edit freely** (data and leaves):

- `src/catalog.js` — pure data: items, prices, blurbs, fish tables, lore text
- `src/villagers.js` — names, dialogue, friendships (keep voices; rule 5)
- New leaf modules built from a recipe in `docs/FEATURE_RECIPES.md`
- `shots/` probe scripts

**Edit carefully** (shared seams and hot files — small diffs, screenshot proof):

- `src/buildings.js`, `src/houses.js`, `src/animals.js`, `src/boats.js`,
  `src/railway.js` (every train line is built from it)
- `src/island2.js`, `src/island3.js`, `src/island5.js`, `src/island6.js`,
  `src/bulko.js`, `src/moon.js`, `src/nature.js`, `src/fold.js`, `src/farther.js`
- `src/ui.js`, `src/state.js`, `src/audio.js`, `src/almanac.js`,
  `src/fieldguide.js`, `src/ambient.js`

**Load-bearing** (topology, physics, the game loop, invariants — change
deliberately, say why in the commit, and re-run the smoke test, the canon
tour, and the clip audit afterward):

- `src/main.js` — renderer, camera, occlusion, the one update loop
- `src/zones.js` — walkability, blockers/surfaces/keepouts, crossings,
  sea walls, interiors, zone lighting
- `src/terrain.js` — the heightmap IS the world; everything samples it.
  Changing it moves things (sites are found by scanning it) — check every
  island afterward.
- `src/player.js` — movement, body collision, swimming, the lantern glow (rule 8)
- `src/calendar.js` — **must keep zero imports** (everything consults it at
  module load; a cycle here bricks the boot)
- `src/utils.js` — the seeded PRNG; changing it reshuffles every world
- `index.html` — the inline importmap is hashed into the production CSP
- `vendor/` — vendored three.js, never edit

## Workflow

- Work on a branch off `main` (`git switch -c <topic>`); commit in small,
  reviewable steps with before/after screenshots checked. Anna reviews and
  merges; `main` is what deploys. (The old one-worktree-per-Codex-lane setup
  is retired — one person/agent at a time works better on this codebase.
  If you do run parallel worktrees, give each its own server port.)
- The open-ideas list lives in `docs/BACKLOG.md` (tracked). The old
  `FIXES_PLAN.md` / `CODEX_TASKS.md` trackers are local-only history.
- Deploy (Anna only, exact bare form — it's permission-matched):

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

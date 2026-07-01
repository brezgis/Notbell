# Notbell visual canon

What the game looks like and why. When in doubt: **simpler is the look.**
If a change tempts you toward more detail, realism, smoothness, or polish —
stop. Over-polished changes get reverted.

## The style in one paragraph

Faceted, flat-shaded, low-poly, chibi-cute, visibly handmade. Everything is
built from primitive geometry (boxes, low-segment cylinders and cones,
icosahedra at detail 0) with `flatShading: true` — facets are the texture.
There are no image assets and no imported models: the only "textures" in the
game are runtime `<canvas>` paintings (the café art homages, the BULKO TV
channels, the Labs flag) and those are painterly on purpose. Colors are
saturated-but-soft storybook pastels. Nothing is photoreal, nothing is
gritty, and the jokes live in-world (signs, plaques, price tags), not in the
chrome.

## Materials

- `MeshStandardMaterial({ color, flatShading: true, roughness: 0.85–0.95 })`
  — every module has its own local `mat(color, rough)` helper; match the
  file you're in. The per-file roughness drift is fine (it's per-place
  texture); don't harmonize it.
- Emissive is reserved for things that glow (windows, the GLINT, screen
  faces). Glow is **material emissive, never a new light** (see Lighting).
- Transparency is rare and deliberate: water, glass, ghost, occlusion fade.

## Palette anchors

Sky/background/fog (island day): `0x9fdcf7`.

Terrain (src/terrain.js): sand `0xecdfa8` · wet sand `0xc9b178` · dirt
`0x8a6f4d` · plaza packed earth `0xd9c08f` · basalt `0x55504c` · cinder
`0x6e5048` · north-isle moss `0x4f8a52`/`0x5e975e` · BULKO asphalt
`0x595a5e` · Labs concrete `0xb6b1a4`.

Seasons are baked at load from `calendar.SEASON`, in exactly two places:
grass (`terrain.js` `GRASS_BY_SEASON`) and foliage (`nature.js`
`LEAF_COLORS`): spring blossom pinks `0xf7b8d0/0xfac7da/0x8fce7a`, summer
greens `0x4ca54c/0x55b055/0x3f9747`, autumn golds `0xe8943a/0xd8743a/
0xc9b14b`, winter snow-dust `0xe8efe9/0xdfe8e2/0xd2dfd8`.

UI is warm paper-and-wood: dialogue `#fffaf0` on border `#e8d5ae`, text
`#5b4a32`, name-tag orange `#f9a03f`, key-hint yellow `#ffd23e`, chip text
green `#3c5a3c`. Rounded sans everywhere (`ui-rounded`) — **no serif
anywhere** (a serif sign has been reverted before).

## Lighting

- Island day: hemisphere sky `0xcfeeff` / ground `0x7ca16a` @ 1.3; sun
  `0xfff3d6` @ 2.4 from (45, 70, 30). The live sun (`almanac.js`) runs on
  the real clock, island/sea only.
- Interiors don't get point lights — each zone brings its own brighter
  hemisphere profile (`zones.registerInterior` lighting). Outdoor point
  lights were culled from 17 to ~6 once; the budget stays there.
- **Window glow canon** (`nightglow.js`): warm `0xffe9a0`, max intensity
  **0.55**, **steady — no pulse, no flicker**, lerped on when
  `isNight() || weather !== 'clear'`. The Labs window band (island6.js) is
  the reference look. Round `makeWindow` windows on every house, shop,
  café, grocery, clinic; matted rectangular `makeRectWindow` **only** on
  the museum and library. Vehicles keep their own window shapes and glow
  too.
- **The player's lantern glow is canon.** It is the one hero light that
  follows you. Never remove it, dim it, or "optimize" it.

## Camera and composition

High Animal-Crossing-style camera trailing the player: FOV 50, distance
9–30 (default 20.3), pitch default 0.70 rad, drag-orbit and pinch-zoom.
Compose for this camera:

- Tops and roofs matter more than facades — decorate them.
- Interiors are dollhouses: built far off-island, BackSide/one-visible-root
  tricks, sized so the fixed camera works unchanged inside.
- Walls between camera and player auto-fade (main.js occluders) — big new
  walls that miss the BoxGeometry heuristic need `userData.occlude = true`.
- Signs and text props are canvas-painted, chunky, and readable at
  distance-20; if text doesn't read from the default camera, make the sign
  bigger, not the font finer.

## Proportions

Chibi: creatures are `buildAnimal` — big head on a small body; keep new
species in that family and reuse `animateGait` for walks. Props are chunky;
a door is ~1.6–2.2 units; prefer one bold shape over three small ones.
Slight asymmetry and hand-wobble are features — don't straighten, center,
or grid-snap the village.

Geometry gotcha, learned twice: prism/wedge roofs are
`CylinderGeometry(r, r, len, 3, 1, false, Math.PI/2)` **then** `rotateZ` —
other phase values skew the ridge.

## Charm rules (things that have actually been reverted)

- A serif sign → reverted. A realistic stone arch → reverted. A 2D cutscene
  → reverted. A cloud-save → reverted. The pattern: anything that imports a
  different aesthetic register (print design, realism, cinematics, SaaS)
  breaks the toy-world spell.
- Deadpan over spectacle: the volcano never erupts; the launch is one
  rocket and a quiet fade, not a particle show.
- Every new mesh casts and receives shadows (glowing things cast none) —
  unshadowed objects read as pasted-on and break the miniature illusion.
- Keep humor in-world and understated: a plaque, a price, a protocol. If a
  joke needs the UI to wink, it's not a Notbell joke.

## Never normalize away

The lantern glow · per-file `mat()`/inline-hex color drift · hand-placed
wobble · emoji as UI iconography · the deadpan sign copy · TEXAS.

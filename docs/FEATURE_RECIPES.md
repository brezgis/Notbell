# Feature recipes

How new things get added without diluting the place. Every recipe names a
best-in-class existing example — **read the example before building**; it is
the real spec. General shape: a feature is one new leaf module exporting
`createX()` → `{ group, update(dt, t, playerPos) }`, wired once in `main.js`
(construction + `scene.add(group)` + one `update` call in the right gating
block — see ARCHITECTURE.md "update loop").

Finish every feature with the checklist at the bottom.

## A new island

Exemplars: `texas.js` (minimal islet), `island5.js` (full-featured).

1. Terrain first (lead work — `terrain.js` is approval-tier): island center/
   radius export, heightmap contribution, any flat `SITES` pads, terrain
   colors if it has its own ground character.
2. `zones.js` `island.canWalk` gets the new island's radius check
   (approval-tier, two lines).
3. New module `islandN.js` builds everything else: props, NPCs,
   interactables, interiors.
4. Chart entry: `addIslandInfo({ name, x, z, r, icon, blurb })`
   (`fieldguide.js`) — plus a mystery blurb; unvisited islands stay grey
   rumors until `markVisited` fires.
5. Getting there is a feature, not a given: bridge/arch/causeway =
   `zones.addCrossing` (see `bridge.js`, the island3 arch, the island6
   causeway); ferry stop = export a `*_DOCK` and add to the `STOPS` table
   in `boats.js` (see `BULKO_DOCK`); rail = `northline.js` pattern.
   Swimming reaches it for free if it's in range.
6. Lore: who lives here and why does it point at the bell? (docs/LORE.md.)
   An island with no relationship to the canon is a theme-park expansion —
   don't.

## A walk-in interior

Exemplars: the café (`buildings.js`), the library (`island3.js`).

1. Pick a far-off spot for the room — the convention is a unique `IN =
   {x, z}` well outside play space (cave at −300,0; labs at 300,1700; keep
   new ones >250 from everything, spaced ~400 apart).
2. Build the room as a group at `IN`, dollhouse-style for the fixed camera
   (floor, BackSide or low walls, furniture; blockers for solid furniture).
3. `zones.registerInterior(name, { root, floorY, bounds, blockers,
   lighting, spawn, exit })` — lighting is a whole mood profile; steal the
   closest existing one and tint it.
4. Door pair: an `interact.register` outside (`use: () => zones.go(name)`)
   and one inside (`use: () => zones.leaveTo(exitSpot)`).
5. Music: add the zone to the `MOODS` map in `main.js` (sanctioned one-line
   main.js edit) or it falls back to 'indoors'.
6. If the module didn't have indoor life before, make its `update` gate
   itself by zone (the bulko.js pattern) rather than moving it out of
   main's outdoor block.

## An NPC

Exemplars: wanderer — any `villagers.js` entry; keeper — Dr. Gill
(`island3.js`); one-off weirdo — Pecos (`texas.js`).

1. Body from `buildAnimal(kind, colors)` (`animals.js`). New species = new
   kind in animals.js (careful-tier) so every system (player avatars,
   multiplayer, hats) inherits it.
2. Wanderers join the `villagers.js` roster: name, voice pitch, **a hat
   decision** (signature hats are identity; "none" is a decision — Howell),
   6–10 rotating lines, optionally a `FRIENDS` pair with meet-lines and
   errand text. A resident wanderer also gets a house (`houses.js`) with
   knock lines.
3. Keepers stay in their module with `interact.register` talk (use
   `getPos` if they move; `dynamic zone:` only for Murmur-class entities).
4. Voice rules are absolute: docs/LORE.md + AGENTS.md rule 5 (speech/action
   only, no narration). Write the character a *want*, not just jokes.

## An interactable

Exemplar: `interact.js` header comment is the spec; tide pools
(`tidepools.js`) for a rummage loop, the hot spring (`island5.js`) for a
timed effect.

- `interact.register({ pos|getPos, r, label, use, enabled, zone,
  priority })`. Label reads as the action ("talk to Pip", "rummage").
- Priority: default 1; fishing is 0 (everything beats it); go higher only
  to win a genuine overlap, and check what else is in range — overlapping
  prompts have caused unreachable interactions before (the tug/rowboat
  mooring split).
- Long interactions run through `ui.say`/`ui.ask`; never build parallel
  dialogue UI.

## A catalog item

Exemplar: any `ITEMS` entry (`catalog.js` — pure data, edit freely).

- `{ kind, name, emoji, price, blurb, … }`. Kinds and their behavior:
  `fish` (+`size`, +`where:'cave'|'moon'`, `weight` = table odds), `bug`,
  `fossil`, `pool`, `meteor` (tracked in the almanac; donatable except
  meteor), `tool`, `seed` (+`GROWTH`), `hat`, `art`, `gear`, `keepsake`
  (quest tokens). `UNSELLABLE` kinds (state.js): tool, keepsake, seed,
  hat, art, gear.
- The blurb is a joke that lands soft, one or two sentences. Price sits in
  the existing economy (fruit ~15–25, common fish 45–160, rarities
  280–800, meteorites top out ~1500) — Pip's glut ledger halves flooded
  prices automatically.
- Loot enters the world via the tables next to `ITEMS` (`rollFish`,
  `FOSSIL_TABLE`, `POOL_TABLE`, `METEOR_TABLE`), never hardcoded drops.

## A ride / vehicle

Exemplars: the Grove Line (`northline.js`), the Persistent's voyages
(`boats.js`).

- Reuse `player.riding` (board → seat the player group, disable walking;
  release on arrival). Disembark spots MUST use safe-landing scans over
  `terrainHeight` — platforms sit over shallows and NPCs have landed in
  the water before.
- Voyages: `STOPS` table + buoy/hail interactables at every port; story
  dialogue plays mid-ride gated on `!ui.isBusy`; always include a timeout
  failsafe (the tug uses 90s) so a stuck ride self-recovers.

## A holiday

Exemplar: `calendar.js` `holidayOf` + `HOLIDAY_LINES`; bunting in
`buildings.js` (~line 290); Pip's once-a-year gift (flag
`gift_<id>_<year>`).

- Date in `holidayOf` (calendar is approval-tier — it's tiny; propose the
  diff), a line for every villager mood, plaza decoration gated on
  `HOLIDAY`, at most one mechanical treat. Holidays are baked at load like
  seasons — no mid-session switches.

## A quest / story beat

Exemplar: the rocket chain (`sawRocket` → `lightseedGiven` →
`rocketPowered`, set in island6/cave, read across modules).

- State is flags in the one bag (`S.setFlag`/`hasFlag`), named `metX`,
  `sawX`, `xGiven`, `xDone`. Cross-island reads are the mechanism for
  quests spanning modules — document the chain in a comment at the first
  setter.
- Milestone-gated retelling (Fern's `loreToldUpTo`) is the pattern for
  doling out lore.
- Check docs/LORE.md before touching anything adjacent to the bell.

## When to extract a shared factory

The house pattern: helpers start life **inside** the module that owns the
look (`makeWindow` lived in buildings.js). When a **second consumer**
appears, export from the owning module — don't create a new shared-kit
file, don't move the helper "somewhere neutral" (`makeWindow` is still in
buildings.js; houses/island2/island3 import it; no cycles resulted —
buildings imports none of them). A third home for visual helpers needs
lead approval.

## The finishing checklist

- [ ] `castShadow`/`receiveShadow` on every new solid; emissive things cast none
- [ ] Blockers for anything solid the player could walk through (two small
      circles beat one big one — a single big blocker once sealed BULKO's door)
- [ ] Big flat walls: `userData.occlude = true` if the auto-heuristic misses them
- [ ] Interacts through `interact.register`; dialogue through `ui.say/ask`
- [ ] Keyboard-only input (touch synthesizes key events — never pointer-only)
- [ ] World placement uses seeded `rand`/`pick` (utils), not `Math.random`
- [ ] New save fields added to `state.js` defaults + `load()` merge
- [ ] Zone-gated updates (one of the three shapes in ARCHITECTURE.md)
- [ ] Chart/almanac entries if it's a place or a catchable
- [ ] Screenshot proof via `shots/` (day + night if it emits light; see shots/README.md)

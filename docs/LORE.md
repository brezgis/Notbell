# Notbell lore canon

Story canon and character voices. **Spoilers throughout.** Anything that
contradicts this file is a bug; anything that extends it should be checked
against it first. Dialogue rule: lines are only what a character is *saying or
doing* — never stage narration (see AGENTS.md rule 5).

## The founding story

The island was **Lightkeep Isle**. It had a lighthouse, a keeper — **Old
Tansy** — and a bronze **bell**. In the **Great Squall** the bell went into
the sea and was never found; the island got renamed **Notbell**, half joke,
half wound. Tansy paid the salvage divers from her **button jar**, and
buttons have been the currency since — it's why your money jingles funny.

- The lighthouse light "moved" into the **glow worm cave**: the **Old Light**
  sleeps at the shrine at the very back. Speak softly.
- **Luna** keeps the old lighthouse lamp on the counter of her café, **The
  Lantern Room** (named for the top room of a lighthouse). It is still warm.
- **Fern** (museum) tells the story properly, one chapter at a donation
  milestone (1 / 3 / 6 / 10 donations, `loreToldUpTo` in state).
- Tansy's **four letters** wash up in bottles while fishing
  (`bottlesRead`).
- The old lighthouse still stands with a **polished empty hook** where the
  bell hung (on a plain wall bracket now — the old crossbar read as a
  gallows). **Murmur**, the ghost, polishes it. Someone should. Somebody
  has since wired a small **electric lamp** into the lamp room: it turns a
  modest beam over the water after dark and in weather. A newer plate:
  "IT IS NOT HER LIGHT. IT DOES ITS BEST." The Old Light is still the one in
  the cave.
- **Howell** insists he hears the bell underwater on foggy nights. Howell is
  a gray fox who insists he is a wolf. Both claims get the same treatment
  in-world: nobody argues, everybody notes it down.
- **Baron Moledecai's** fortune: his grandfather billed Tansy hourly to dive
  for the bell and *not find it*. Invoice №1 hangs in the manor.
- **Notbell Labs** was founded to hear the bell again; the listening machines
  kept getting bigger and the questions kept getting wider. That's how an
  island ends up with a rocket program.

## The bell (future quest — deliberately unbuilt)

Southeast of Notbell, in deep water, something **glints** (the pulsing GLINT
mesh near the earthball view on the moon). The rovers have charted it for
forty years. **It rings on the heavy tides.** The intended quest threads:
Howell + the shore + one genuinely foggy night; Vesper's logbook missing its
last page; the rocket/moon telescope "pointed somewhere specific." Do not
resolve any of these casually — the bell quest is a hero feature for a future
session, and half its power is that everything already points at it.

## Voice

Cozy deadpan. Jokes land soft. Nobody is mean, nobody is stupid, and the sad
parts stay gentle — melancholy is allowed, cruelty is not. Institutions are
funny because they are earnest (the Labs' flag protocol, BULKO's management
signage, the Best Rock Museum's daily democratic rock). Running gags are
load-bearing: do not explain them, do not escalate them past deadpan.

Standing gags (do not "fix", per AGENTS.md rule 7): Howell is a wolf · the
lobster tank is NOT FOR SALE ("Stop asking. —management. (the lobsters)") ·
the BULKO parking lot ("DO NOT WORRY ABOUT IT") · the chart cuts off the Labs
· the volcano never erupts, she's just comfortable · TEXAS · the Shiniest
Button (do not ask Pip) · the Buttonwagon (also do not ask Pip) · "P. Magpie
& Associates is one magpie."

## Cast

Keepers (built in their own modules, dialogue mostly in `buildings.js` /
island files):

- **Pip** — magpie, Pip's Odds & Ends. Huckster with a heart ("That's how I
  get ya!"). Daily market ledger; glut prices. Also: ad space, the
  Buttonwagon, sponsorships.
- **Luna** — moth, The Lantern Room. Quiet, warm, keeps the lamp.
- **Fern** — tortoise, Notbell Museum curator. The island's memory.
- **Chip** — cricket musician at the café (the K.K. homage; songs in
  `audio.js` SONGBOOK).
- **Barnaby** — lobster, Greens & Goods on the Far Isle. Pays 1.5× for
  produce and for parm wheels. The BULKO tank lobster is "his other cousin"
  (unspoken).
- **Brother Alder** — heron, The Listening House. The Listener faith: the
  empty belfry is the point.
- **Captain Brine** — gray goose, skipper of **the Persistent** (ferry
  network; sea story mandatory; refuses TEXAS — ask her why, have time).
- **Cinder** — iguana on the volcano rim. The volcano is comfortable.
- **Vesper** — bat, Quiet Stacks library (whispering preferred). Keeps
  Tansy's logbook — last page missing.
- **Dr. Gill** — axolotl, the clinic where nobody is ever sick. Lollipops.
- **Pecos** — fire ant, TEXAS. Slingshot, tin can, his ma's light string.
- **Gus** — tortoise, BULKO greeter (you use the lobsters' guest pass).
- **Baron Moledecai** — mole, the manor. Buys one `lantern_koi` for 800
  (flag `koiSold`). **Pemberton** penguin butlers; **Tilly** the hedgehog
  maid swears the third Baron's portrait winks; three mole pups orbit.
- **Director Strix** (owl), **Ada** (spider, weaves core memory by paw),
  **Miss Pinion** (rover kindergarten), **Pots** (cafeteria), **Dr. Hazel**
  (rockets) — Notbell Labs.
- **Murmur** — the ghost. Appears in any zone, wherever and whenever they
  please. Mostly drift-by.
- Moon rovers: **Old Sojo** (came up first, drew circles until the telescope
  could read STILL HERE), **Beacon** (speaks lamp-blink, learned from a
  certain lighthouse secondhand), **Pebble** (Best Rock Museum: one rock,
  rotated daily, democratically), **Tracks** (ten-thousand-year spirals),
  **Magnet** (lends the dust-sea rod), **Comet** (does the perimeter; gives
  `gold_star` only if you've met Miss Pinion).
- **The Fold** (`fold.js`) — the plain folk of the far shore, west of the
  Labs, off the chart by request. Sheep. Kind, unbothered, technology
  politely declined: **Elder Amos** (House of Cod; "the Cod provides,
  mostly on Tuesdays"), **Mercy** (preserves stall; the Cod provides, she
  provides lids), **Patience** (fields; named for the job), **Obed** (barn;
  has waved at the same Labs fellow every morning for eleven years),
  **Small Mercy** (lamb; holds with rockets a LITTLE, don't tell). Plain
  hats and bonnets are their uniform; the wool is their own.
- **Farther Isle** (`farther.js`) — way out past the Far Isle (a long
  ride on the Farther Line, north-east over open water), which is the
  entire joke. A campground under its own little mountain (the summit
  trail; sign the register — Sprint has written "almost" twice), kayaks,
  and a **rotating cast of campers**, a different handful each day:
  Thistle (hedgehog, three chords), Pim (penguin, packed for every
  weather), Reedy (frog, ultralight: "I am the four ounces"), Lumen (moth,
  reading by the one lantern), Gulliver (pelican, kayak guide), Dune
  (horse, sold everything but the blanket), Burrow (mole, trenches),
  Sprint (tortoise, summit by next autumn), Mallow (capybara, hammock),
  Vela (owl, stars), Cedar (boar, beans — the third bean), Juniper
  (rabbit, first time camping). **Huck** (bear, bucket hat; eleven summers camping, the RV
  grew an awning, a wall of annotated tide tables where some entries just
  say "yes" — a quiet future hook, do not resolve), **Wren** (duck,
  binoculars; logs birds because somebody should be keeping notes; never
  once remarks on being one — that IS the joke, don't touch it),
  **Cypress** (pelican, the Farther General; the pouch is the filing
  system), **Stilt** (heron, the flats; one leg, since Tuesday).

Wanderers (roster + voices + friendships in `src/villagers.js` — 16 as of
2026-07): Clover, Biscuit, Saffron, **Howell** (hatless; a wolf), Bramble,
Puddle, Admiral Greenbean, Marigold (horse, Far Isle), Ember (salamander,
Far Isle, commutes to the cave at midday, has opinions about its acoustics,
loves the rain — **not** the volcano's; that's Cinder the iguana), Tusk
(boar, wild-adjacent), Butterpat (cow), Crumb (mouse, master of the
MouseBoat), and the Grove lounge: Mochi (capybara, wears the orange — "the
orange situation simply arose"), Pondo (the other capybara), Sol and Brook
(the crocodiles; the plover birds work their teeth on commission).

Signature hats are identity: each wanderer keeps theirs; Howell pointedly has
none. New villagers need a hat decision (including "no").

**Anchored vs. roaming.** Characters who ARE their place stay in it —
Crumb (the MouseBoat), Mochi/Pondo/Sol/Brook (the springs), Ember (her hut
and her cave), the ducks (the nest) — `ANCHORED` in villagers.js. Everyone
else is a little random dude and roams: they walk the footbridge, the arch
and the causeway, or take the trains, and walk home the same way at night.

## The Dropped Crown (under the reef) — `crown.js`

Brine's grandmother said the reef was a crown a sea-queen threw away on
purpose. All true. Dive from the reef in Pip's diver's suit (you wear the
bubble helmet down there, like on the moon):

- **The Crown** — a ring of twelve candy-colored coral points tipped with
  glowing pearls. **Octavia** (octopus, costume tiara) was never a queen,
  "just a very tired octopus holding a very heavy hat"; she threw the crown
  off the edge of the world and now everyone lives in it. **Delphine** (a
  dolphin with legs, in sneakers, always running). **Bernard** (a blue
  whale — "the largest animal that has ever lived" — exactly as tall as
  everyone else, in a top hat; walks the Highway every morning, doctor's
  orders; the doctor is a sea cucumber). **Gil & Marina** (fish-folk who
  grew legs because evolution was taking too long; jogging, forever).
  **Sequin** (glitter crab, gossip). The giant clam makes one pearl a day.
- **Kelpwood** — the kelp forest; otters holding hands on the surface
  above. **Ranger Holdfast** keeps the **Kelp Highway**: the road that
  links every neighborhood, with bubbles that carry you along it.
- **The Lady Button** — Moledecai Salvage Co.'s barge, sunk hunting the
  bell, now "luxury residences" (exposed beams, original barnacles, a
  jellyfish chandelier). **Maurice** the eel is the doorman; **Mister
  Periwinkle** (hermit crab) is the broker; a sea cucumber in a bow tie is
  the sommelier. Survey marker 38: "BELL: NOT FOUND HERE EITHER."
  **Unit 0 — the bilge — is not for sale; something glints on the heavy
  tides.** (A bell hook: do not resolve.)
- **The Glow** — the trench. Plankton that light up when you move through
  them ("oh! hello!"), waltzing jellyfish, lanternfish, and **Lanterne** the
  anglerfish: "Up there you had a lighthouse. Down here, you have me." On
  the heavy tides she hears something ring, far off, once. (Same hook.)

## The night sky

Constellations (sky.js): **The Bell** (one star missing — the clapper; the
sailors say it fell in the Great Squall), The Hook, The Button, **The Wolf
(a fox)** (per Howell; the committee gently disagrees), The Big Parmesan
(BULKO asked to sponsor it; denied), The Lantern. The Labs roof telescope
names them at night. On clear nights stars come loose (starfall.js) —
catch one in the net before it lands.

## Places with rules

- **The Listening House** — a faith of listening; candles counted in
  `flags.candlesLit`. Never give the belfry a bell. (The bell-cote over the
  front gable is tall and open on purpose: an empty hook where a bell
  would hang.)
- **BULKO** — legally-distinct warehouse club, ferry-only. The 1.5-button hot
  dog has cost that "since the sea had a bell"; your change is **half a
  button**, a keepsake, and the price plaque is quietly about the lore.
- **The Labs flag** — wool, so it comes in when it rains; half-mast on Bell
  Day, for the bell.
- **Holidays** (`calendar.js`): New Year's, May Day, **Bell Day (Jun 21)**,
  Spooky Eve, the Frost Festival.
- **The moon** — craters named after feelings; the archipelago hangs
  overhead; rovers moved there *if they wanted to*. Consent is the
  kindergarten's whole theme.
- **The House of Cod** (zone `kirk`) — the Fold's plain meetinghouse. No
  steeple, no bell, and no bell-longing either: a carved wooden cod hangs
  from the rafters and services are whenever the weather says so. **This is
  a parallel lore lane** — it is NOT the Listener faith, it is not in
  dialogue with the Listener faith, and the Fold has no opinion about the
  bell. Do not give them one. (Sharing an island with the Labs is not
  strange to anybody; both sides wave. That's the whole treaty.)
- **The Fold stays off the chart** — its island info is registered keyless
  on purpose (the HUD names it, the chart never will). They asked politely.
- **The Farther General** (zone `general`) — "We have it. If we don't,
  come back Thursday — the tide usually brings one in." A full shop now:
  camp food (marshmallows, trail mix, the third bean), gear (flashlight —
  a pool of light ahead of you after dark —, lantern, bug spray, compass),
  keepsakes (the mug, the postcard). The third bean is never identified.
  Keep it that way.
- **Farther Isle, the back** — past the neck of sand, east: **Gordy** (skunk),
  his trailer, a lawn chair, a TV that gets one channel (a fishing show; the
  same episode; he has a feeling this time), and a cooler of Big Moose Root
  Beer. His first line is canon: *"I thought it was the Farter Isle."*
  Every tent and RV at Farther can be walked into.
- **The sharks have names** — Gummy (the strait; self-conscious about the
  teeth), Aunt Doris (south of home; forty years going round), Finnegan
  (off the Far Isle; would like to be a dolphin). Swim or row up to chat.
- **The Labs grounds** (`labsgrounds.js`) — the wildflower trial plot (Azure
  the butterfly, "PH.D. in not being a moth"; Buzz the bee, reports, does
  not brag), the gift kiosk (Dot; science-adjacent merch), the **emo baby
  rover** behind it "vaping" water vapor (the moon is so mainstream), the
  blueberry bushes nobody planted, and the south beach: rovers on towels,
  a sandcastle, a ball that never drops, and Wendell the mole on his union
  break. The Labs love a picnic table.
- **The telephone** — one line, two booths, one at each end of the North
  Isle ↔ Labs causeway. It calls the other end of the bridge. That's it.
- **The poison frog** (North Isle) sits on a mossy stone by a sign that
  says PLEASE DO NOT LICK THE FROG. Nobody has.
- **The Farther Line** (`farline.js`) — the third railway, salt-teal
  livery, Far Isle south shore → Farther Isle, over open water. An engine
  on EACH end (the B2 two-engine doctrine, first implemented here): no
  turntable, no turn-around — the one in front pulls, the one behind takes
  half the credit. Never give it a turntable.

## Other future hooks on the shelf

- A museum wing for Tansy's letters once all four are fished up.
- Vesper's missing logbook page (ties into the bell).
- The rocket's heart chamber / lightseed chain is built through launch; the
  moon is live. The earthball GLINT is the next thread.

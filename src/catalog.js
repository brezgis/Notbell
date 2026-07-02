// Everything you can catch, dig, find, buy, or be told on Notbell Isle.
// Pure data — no three.js, no DOM — so it's easy to balance and extend.

// ---------------------------------------------------------------- items ----
// kind: fish | bug | fossil | pool | tool | keepsake
// price: what Pip pays you (or charges, for tools)

export const ITEMS = {
  // -- fish -------------------------------------------------------------
  sea_bass: {
    kind: 'fish', size: 'l', name: 'Sea Bass', emoji: '🐟', price: 45, weight: 26,
    blurb: 'No, wait — it’s at LEAST a B+.',
  },
  crumb_snapper: {
    kind: 'fish', size: 's', name: 'Crumb Snapper', emoji: '🐠', price: 60, weight: 24,
    blurb: 'It snaps at crumbs. Honestly? Relatable.',
  },
  pebble_dab: {
    kind: 'fish', size: 'm', name: 'Pebble Dab', emoji: '🐟', price: 90, weight: 18,
    blurb: 'A flat little fish. It is doing its best.',
  },
  buttonfish: {
    kind: 'fish', size: 's', name: 'Buttonfish', emoji: '✨', price: 160, weight: 12,
    blurb: 'Scales like mother-of-pearl buttons. The economy, but alive.',
  },
  glimmer_trout: {
    kind: 'fish', size: 'l', name: 'Glimmer Trout', emoji: '🌟', price: 280, weight: 8,
    blurb: 'Shines even out of the water. Show-off.',
  },
  moonbeam_eel: {
    kind: 'fish', size: 'l', where: 'cave', name: 'Moonbeam Eel', emoji: '🌙', price: 450, weight: 20,
    blurb: 'It glows faintly, like it knows something you don’t. It lives where the light sleeps. It does.',
  },
  old_boot: {
    kind: 'fish', name: 'Old Boot', emoji: '🥾', price: 2, weight: 8,
    blurb: 'Somebody, somewhere, is hopping.',
  },
  tide_nibbler: {
    kind: 'fish', size: 's', name: 'Tide Nibbler', emoji: '🐟', price: 50, weight: 26,
    blurb: 'It nibbles the tide. The tide has not noticed.',
  },
  sand_flounder: {
    kind: 'fish', size: 'm', name: 'Sand Flounder', emoji: '🐟', price: 110, weight: 13,
    blurb: 'Both eyes on the same side, so it can judge you twice.',
  },
  sunset_drum: {
    kind: 'fish', size: 'm', name: 'Sunset Drum', emoji: '🥁', price: 200, weight: 7,
    blurb: 'It hums at dusk. Nobody taught it. Everybody encourages it.',
  },

  // cave pond residents (the still pond keeps its own guest list)
  blind_cavefish: {
    kind: 'fish', size: 'm', where: 'cave', name: 'Blind Cavefish', emoji: '🐠', price: 320, weight: 30,
    blurb: 'It has never seen anything, and it is doing great.',
  },
  pale_crayfish: {
    kind: 'fish', size: 's', where: 'cave', name: 'Pale Crayfish', emoji: '🦞', price: 180, weight: 34,
    blurb: 'A little ghost with opinions and pincers.',
  },
  lantern_koi: {
    kind: 'fish', size: 'l', where: 'cave', name: 'Lantern Koi', emoji: '🏮', price: 800, weight: 8,
    blurb: 'Glows like the old lamp. Luna would cry. Do not tell Luna. Tell Luna.',
  },

  // -- bugs ---------------------------------------------------------------
  lemon_flit: {
    kind: 'bug', name: 'Lemon Flit', emoji: '🦋', price: 80,
    blurb: 'A butterfly the color of lemonade. Tastes of nothing. Don’t ask.',
  },
  paper_wisp: {
    kind: 'bug', name: 'Paper Wisp', emoji: '🤍', price: 60,
    blurb: 'Like a love letter that learned to fly.',
  },
  rose_skipper: {
    kind: 'bug', name: 'Rose Skipper', emoji: '🌸', price: 90,
    blurb: 'Skips like a stone, lands like a petal.',
  },
  sky_dancer: {
    kind: 'bug', name: 'Sky Dancer', emoji: '💙', price: 120,
    blurb: 'It practices when nobody is watching. (You were watching.)',
  },
  buttonshell_beetle: {
    kind: 'bug', name: 'Buttonshell Beetle', emoji: '🪲', price: 200,
    blurb: 'Its shell has four neat holes. Pip refuses to discuss this.',
  },
  dewdrop_dragonfly: {
    kind: 'bug', name: 'Dewdrop Dragonfly', emoji: '🪰', price: 140,
    blurb: 'Hovers like it left the iron on somewhere.',
  },
  garden_snail: {
    kind: 'bug', name: 'Garden Snail', emoji: '🐌', price: 50,
    blurb: 'Carries its own house. Pays no rent. A role model, frankly.',
  },
  ladybird: {
    kind: 'bug', name: 'Ladybird', emoji: '🐞', price: 90,
    blurb: 'Counts its own spots when it gets nervous.',
  },
  meadow_cricket: {
    kind: 'bug', name: 'Meadow Cricket', emoji: '🦗', price: 70,
    blurb: 'You hear it long before you see it. It prefers things this way.',
  },
  cave_glimmerwing: {
    kind: 'bug', name: 'Cave Glimmerwing', emoji: '🦋', price: 450,
    blurb: 'A pale moth that never left the cave. Luna writes to it.',
  },
  lantern_firefly: {
    kind: 'bug', name: 'Lantern Firefly', emoji: '✨', price: 300,
    blurb: 'A tiny piece of the old light, freelancing. Night shift only.',
  },

  // -- fossils --------------------------------------------------------------
  trilobutton: {
    kind: 'fossil', name: 'Trilobutton', emoji: '🦴', price: 420,
    blurb: 'An ancient sea bug, curled like a fastener. Fashion is a cycle.',
  },
  curlstone: {
    kind: 'fossil', name: 'Curlstone', emoji: '🐚', price: 340,
    blurb: 'A spiral shell from a sea with no name yet.',
  },
  megalodont_tooth: {
    kind: 'fossil', name: 'Megalodon’t Tooth', emoji: '🦷', price: 650,
    blurb: 'From a shark so big the ocean asked it to please not.',
  },
  fern_frond: {
    kind: 'fossil', name: 'Fern Frond Fossil', emoji: '🌿', price: 320,
    blurb: 'A perfect fern, pressed in stone. (No relation. Probably.)',
  },
  very_old_pebble: {
    kind: 'fossil', name: 'Very Old Pebble', emoji: '🪨', price: 30,
    blurb: 'It is a pebble. It is very old. Fern will want it anyway.',
  },

  // -- tide pool finds ------------------------------------------------------
  hermit_crab: {
    kind: 'pool', name: 'Hermit Crab', emoji: '🦀', price: 120,
    blurb: 'He brought his own house to the party.',
  },
  sea_star: {
    kind: 'pool', name: 'Sea Star', emoji: '⭐', price: 90,
    blurb: 'A five-armed hug, slightly damp.',
  },
  wiggleblossom: {
    kind: 'pool', name: 'Wiggleblossom', emoji: '🪸', price: 150,
    blurb: 'An anemone that waves back. Always wave first.',
  },
  pearl_periwinkle: {
    kind: 'pool', name: 'Pearl Periwinkle', emoji: '🐚', price: 150,
    blurb: 'A tiny snail with a big opinion of itself.',
  },
  tidepool_octopus: {
    kind: 'pool', name: 'Tidepool Octopus', emoji: '🐙', price: 600,
    blurb: 'It tasted a color once and never told anyone which.',
  },

  // -- tools (bought at Pip's) ---------------------------------------------
  rod:    { kind: 'tool', name: 'Driftwood Rod', emoji: '🎣', price: 0,
            blurb: 'Smells like adventure and slightly of eel.' },
  net:    { kind: 'tool', name: 'Dandelion Net', emoji: '🥅', price: 280,
            blurb: 'Light as a wish. Swing gently.' },
  shovel: { kind: 'tool', name: 'Stubby Shovel', emoji: '🪏', price: 450,
            blurb: 'For digging up the past, politely.' },

  // -- gear ------------------------------------------------------------------
  scuba_suit: {
    kind: 'gear', name: 'Salvage Diver’s Suit', emoji: '🤿', price: 1800,
    blurb: 'Canvas, brass, and a bell-shaped helmet. One of Tansy’s divers left it behind. It never found the bell. It found everything else.',
  },

  // -- garden & orchard -----------------------------------------------------
  sunfruit: {
    kind: 'fruit', name: 'Sunfruit', emoji: '🍊', price: 15,
    blurb: 'Warm even in the shade. The trees here are generous.',
  },
  orange: {
    kind: 'fruit', name: 'Orange', emoji: '🍊', price: 20,
    blurb: 'Grove Isle citrus. The capybaras wear them as hats, which is also a review.',
  },
  peach: {
    kind: 'fruit', name: 'Peach', emoji: '🍑', price: 25,
    blurb: 'Southern Grove Isle stone fruit. The sun did most of the work and admits it.',
  },
  carrot_seeds: { kind: 'seed', name: 'Carrot Seeds', emoji: '🌱', price: 30,
    blurb: 'Allegedly carrots. The packet is very confident.' },
  tomato_seeds: { kind: 'seed', name: 'Tomato Seeds', emoji: '🌱', price: 45,
    blurb: 'Fruit? Vegetable? The island does not take sides.' },
  pumpkin_seeds: { kind: 'seed', name: 'Pumpkin Seeds', emoji: '🌱', price: 80,
    blurb: 'Plant one, step back.' },
  carrot: { kind: 'produce', name: 'Carrot', emoji: '🥕', price: 90,
    blurb: 'Pulled fresh. Biscuit is already aware. Nobody told him. He knows.' },
  tomato: { kind: 'produce', name: 'Tomato', emoji: '🍅', price: 120,
    blurb: 'Sun-warm and smug about it.' },
  pumpkin: { kind: 'produce', name: 'Pumpkin', emoji: '🎃', price: 240,
    blurb: 'Big enough to be furniture. Please do not make it furniture.' },

  // -- hats (worn, not sold back — Pip says hats are "non-refungible") -------
  knit_cap: { kind: 'hat', name: 'Knit Cap', emoji: '🧢', price: 140,
    blurb: 'Somebody knitted this with love and slightly too much yarn.' },
  straw_hat: { kind: 'hat', name: 'Straw Sun Hat', emoji: '👒', price: 220,
    blurb: 'Smells like summer and a little like duck.' },
  party_cone: { kind: 'hat', name: 'Party Cone', emoji: '🎉', price: 120,
    blurb: 'It is always somebody’s birthday somewhere.' },
  flower_crown: { kind: 'hat', name: 'Flower Crown', emoji: '🌼', price: 260,
    blurb: 'The butterflies will assume you are management.' },
  keepers_cap: { kind: 'hat', name: 'Keeper’s Cap', emoji: '⚓', price: 2600,
    blurb: 'The real thing. Fern verified it, cried, and says she didn’t.' },
  captains_cap: { kind: 'hat', name: 'Captain’s Cap', emoji: '⚓', price: 0,
    blurb: 'Property of Admiral Greenbean. Earned, sailor.' },
  paper_boat: { kind: 'hat', name: 'Paper Boat', emoji: '⛵', price: 0,
    blurb: 'Puddle’s. It has sunk four times. It floats on spirit.' },
  leaf_hat: { kind: 'hat', name: 'Big Leaf', emoji: '🍃', price: 0,
    blurb: 'Bramble’s. It is a leaf. He is very proud of it.' },
  orange_hat: { kind: 'hat', name: 'An Orange', emoji: '🍊', price: 0,
    blurb: 'Mochi’s. The orange situation simply arose, and was accepted.' },

  // -- art prints (sold at the café, at home in the museum) -------------------
  art_scream: { kind: 'art', name: '“The Scream” (print)', emoji: '🖼️', price: 750,
    blurb: 'After Munch. The frame might be original. The anguish is universal.' },
  art_dance: { kind: 'art', name: '“Dance” (print)', emoji: '🖼️', price: 750,
    blurb: 'After Matisse. Moth-approved choreography.' },
  art_autumn: { kind: 'art', name: '“Golden Autumn” (print)', emoji: '🖼️', price: 750,
    blurb: 'After Levitan. Fern’s favorite. Handle accordingly.' },
  art_wave: { kind: 'art', name: '“The Great Wave” (print)', emoji: '🖼️', price: 750,
    blurb: 'After Hokusai. The Admiral salutes it every time.' },
  art_swirl: { kind: 'art', name: '“The Starry Swirl” (print)', emoji: '🖼️', price: 750,
    blurb: 'After a certain restless Dutchman. The night sky, but more so.' },
  art_pearl: { kind: 'art', name: '“Girl with a Button Earring” (print)', emoji: '🖼️', price: 750,
    blurb: 'After Vermeer, localized. Pip insists the earring is a button. Pip is biased.' },
  art_sunflowers: { kind: 'art', name: '“Sunflowers” (print)', emoji: '🖼️', price: 750,
    blurb: 'After van Gogh. Clover has tried to water it twice.' },
  art_square: { kind: 'art', name: '“The Square” (print)', emoji: '🖼️', price: 750,
    blurb: 'After Malevich. Howell stared at it for an hour and said “same.”' },
  art_wanderer: { kind: 'art', name: '“Wanderer above the Fog” (print)', emoji: '🖼️', price: 750,
    blurb: 'After Friedrich. The Listeners consider it a documentary.' },

  // -- BULKO exclusives -------------------------------------------------------
  parm_wheel: {
    kind: 'produce', name: 'Bulk Parmesan Wheel', emoji: '🧀', price: 220,
    blurb: 'It does not fit in your pockets. You now simply have it.',
  },

  // -- keepsakes -------------------------------------------------------------
  bottle_note: {
    kind: 'keepsake', name: 'Letter from T.', emoji: '📜', price: 0,
    blurb: 'Sea-soft paper, careful handwriting.',
  },
  shiny_button: {
    kind: 'keepsake', name: 'The Shiniest Button', emoji: '🔘', price: 0,
    blurb: 'Pip’s favorite. Pip’s VERY favorite.',
  },
  first_invoice: {
    kind: 'keepsake', name: 'Invoice №1', emoji: '🧾', price: 0,
    blurb: '“One (1) summer of diving. Bell: not located. PAID IN FULL.” The founding document of a fortune.',
  },
  half_button: {
    kind: 'keepsake', name: 'Half a Button', emoji: '🌗', price: 0,
    blurb: 'Change from a 1.5ᵇ hot dog. Legal tender nowhere. Treasured forever.',
  },
  // the milk cooler's wares — keepsakes, because Pip does not deal dairy
  milk_choco: {
    kind: 'keepsake', name: 'Chocolate Milk', emoji: '🍫', price: 0,
    blurb: 'Cocoa’s. Chocolate milk isn’t a flavor, it’s a feeling. The feeling is being eight.',
  },
  milk_straw: {
    kind: 'keepsake', name: 'Strawberry Milk', emoji: '🍓', price: 0,
    blurb: 'Sundae’s. Pink all the way through. She barely makes the strawberry.',
  },
  milk_oat: {
    kind: 'keepsake', name: 'Oat Beverage', emoji: '🌾', price: 0,
    blurb: 'Barley’s. It is not milk, it is a beverage. There is a difference. He won’t explain it.',
  },
  milk_plain: {
    kind: 'keepsake', name: 'Milk', emoji: '🥛', price: 0,
    blurb: 'Regular milk, from the most relaxed employees BULKO has ever had.',
  },
  parcel: {
    kind: 'keepsake', name: 'A Small Parcel', emoji: '🎁', price: 0,
    blurb: 'Addressed in careful pawwriting. It is not for you, and it is not heavy, and you may not shake it.',
  },
  // the Farther General's shelf — camp goods, tide-tested
  marshmallows: {
    kind: 'keepsake', name: 'Marshmallows', emoji: '🍡', price: 0,
    blurb: 'A bag of clouds, campfire grade. Never quite runs out, which nobody at the fire has thought to question.',
  },
  camp_mug: {
    kind: 'keepsake', name: 'Enamel Camp Mug', emoji: '☕', price: 0,
    blurb: 'Speckled blue, dented exactly once. Everything tastes fifteen percent better out of it. The dent is load-bearing.',
  },
  postcard_farther: {
    kind: 'keepsake', name: 'Farther Isle Postcard', emoji: '🏝️', price: 0,
    blurb: '“WISH YOU WERE FARTHER.” The mangroves at sunset, slightly overexposed.',
  },
  // the Fold's preserves — the Cod provides; Mercy provides lids
  preserves_goose: {
    kind: 'keepsake', name: 'Gooseberry Preserves', emoji: '🫙', price: 0,
    blurb: 'Sharp, then sweet, then gone. The label is hand-lettered and slightly proud of it.',
  },
  preserves_carrot: {
    kind: 'keepsake', name: 'Carrot Marmalade', emoji: '🥕', price: 0,
    blurb: 'Sweeter than a carrot has any business being. Patience grew it. Mercy jarred it. The Cod provided.',
  },
  preserves_plum: {
    kind: 'keepsake', name: 'Sea-Plum Jam', emoji: '🫐', price: 0,
    blurb: 'Plums from the hedge by the west shore. Tastes faintly of weather.',
  },
  lightseed: {
    kind: 'keepsake', name: 'Lightseed', emoji: '🌟', price: 0,
    blurb: 'A warm coal of the Old Light, dozing in your pocket. It guided a thousand boats home. It would like to try going the other way, once.',
  },
  bubble_helmet: {
    kind: 'keepsake', name: 'Bubble Helmet', emoji: '🫧', price: 0,
    blurb: 'A fishbowl with delusions and three patents. Rated for one afternoon of air and all known hat sizes. Fogs up when you grin.',
  },
  gold_star: {
    kind: 'keepsake', name: 'Gold Star Sticker', emoji: '⭐', price: 0,
    blurb: 'From Miss Pinion’s sheet. On the moon this is currency. Everywhere, it is better than currency.',
  },

  // -- from the sky (the dust sea gives them up to a patient magnet) ---------
  moon_rock: {
    kind: 'meteor', name: 'Moon Rock', emoji: '🌑', price: 60,
    blurb: 'Personally considered by a rover and judged excellent. Every rock on the moon has been personally considered.',
  },
  iron_meteorite: {
    kind: 'meteor', name: 'Iron Meteorite', emoji: '☄️', price: 380,
    blurb: 'Heavy, honest metal. It traveled four billion years to be fridge-magnet tested by a rover.',
  },
  stony_chondrite: {
    kind: 'meteor', name: 'Chondrite', emoji: '🪨', price: 260,
    blurb: 'A speckled pudding of the early solar system. The rovers call the speckles “sprinkles,” and the journals have given up correcting them.',
  },
  starglass: {
    kind: 'meteor', name: 'Starglass Pallasite', emoji: '✨', price: 720,
    blurb: 'Iron lace set with olivine windows. Hold it up to the light: tiny green dawns.',
  },
  moonpearl: {
    kind: 'meteor', name: 'Moonpearl', emoji: '🪩', price: 520,
    blurb: 'A perfectly round pebble of fused dust. The dust sea makes one a decade, when nobody is watching. Nobody was watching.',
  },
  meteoric_button: {
    kind: 'meteor', name: 'Meteoric Button', emoji: '🔘', price: 1500,
    blurb: 'A four-holed iron disc from BEFORE the island. Pip must never know about this. Tell Pip immediately.',
  },
};

// what a patient magnet pulls out of the dust sea
export const METEOR_TABLE = [
  ['iron_meteorite', 30], ['stony_chondrite', 32], ['starglass', 12],
  ['moonpearl', 18], ['meteoric_button', 8],
];

export const COFFEE_PRICE = 40;
export const COFFEE_BOOST_SECS = 90;

// Weighted fish draw per water ('sea' or 'cave'), optionally filtered by
// shadow size ('s'|'m'|'l'). Bottles are handled separately by fishing.js;
// the boot has no size, because the boot finds YOU.
export function rollFish(where = 'sea', size = null, randFn = Math.random) {
  const fish = Object.entries(ITEMS)
    .filter(([, it]) => it.kind === 'fish' && (it.where ?? 'sea') === where &&
      (!size || it.size === size));
  const total = fish.reduce((s, [, it]) => s + it.weight, 0);
  let r = randFn() * total;
  for (const [id, it] of fish) {
    r -= it.weight;
    if (r <= 0) return id;
  }
  return 'sea_bass';
}

// what each seed becomes, how long it takes, and how many you pull up
export const GROWTH = {
  carrot_seeds: { produce: 'carrot', secs: 180, n: 3 },
  tomato_seeds: { produce: 'tomato', secs: 240, n: 3 },
  pumpkin_seeds: { produce: 'pumpkin', secs: 360, n: 2 },
};

export const SHOP_HATS = ['party_cone', 'knit_cap', 'straw_hat', 'flower_crown', 'keepers_cap'];

export const SONGS = [
  { id: 'button_bossa', name: 'Button Bossa' },
  { id: 'foggy_lullaby', name: 'Foggy Lullaby' },
  { id: 'tidepool_stomp', name: 'Tidepool Stomp' },
];

export const POOL_TABLE = [
  ['hermit_crab', 26], ['sea_star', 30], ['wiggleblossom', 18],
  ['pearl_periwinkle', 18], ['tidepool_octopus', 8],
];

export const FOSSIL_TABLE = [
  ['trilobutton', 18], ['curlstone', 24], ['megalodont_tooth', 10],
  ['fern_frond', 24], ['very_old_pebble', 24],
];

export function rollTable(table, randFn = Math.random) {
  const total = table.reduce((s, [, w]) => s + w, 0);
  let r = randFn() * total;
  for (const [id, w] of table) {
    r -= w;
    if (r <= 0) return id;
  }
  return table[0][0];
}

// ------------------------------------------------------------------ lore ----
// The short version, which nobody on the island will tell you in order:
// Notbell Isle used to be Lightkeep Isle. A lighthouse stood on the north
// cliff, kept by Old Tansy, who rang its bronze bell in every fog. The Great
// Squall took the bell into the sea. Tansy paid salvage divers out of her
// button jar for a whole summer — they never found it, but buttons have been
// money here ever since, and the island that lost its bell got a new name.
// When the lamp finally went dark, the glow didn't go out. It moved into the
// cave under the cliff, where it sleeps among the glow worms. Luna keeps the
// old lamp warm in her café. Fern remembers all of it. Howell says that on
// foggy nights you can still hear the bell ring, from under the sea.

// Letters that wash ashore in bottles, in the order you find them.
export const BOTTLE_NOTES = [
  { title: 'A letter from T. (I)',
    text: 'To whoever finds this — the bell went into the water at dawn. I have started a jar of buttons for the divers. The sea took the ringing, but it cannot take the reason we rang. —T.' },
  { title: 'A letter from T. (II)',
    text: 'The divers found three anchors, a chandelier, and a very rude eel. No bell. I paid them in buttons again. They have begun to prefer it. —T.' },
  { title: 'A letter from T. (III)',
    text: 'The lamp is dimming and I am not sad. Light is like anyone else — after a long shift, it wants somewhere cozy to lie down. I think it has chosen the cave. —T.' },
  { title: 'A letter from T. (IV)',
    text: 'Last note, last bottle. If the fog comes and you miss the bell, listen anyway. Some sounds keep ringing in the people who heard them. Be kind to my island. —Tansy' },
];

// Fern's museum stories, unlocked at donation-count milestones.
export const FERN_LORE = [
  { at: 1, text: 'Your first gift to the collection! Mmm. You know, this island was not always called Notbell. When I was a hatchling — well. A YOUNG tortoise — it was Lightkeep Isle. There was a lighthouse on the north cliff. Bring me more, and I shall remember more.' },
  { at: 3, text: 'The lighthouse keeper was called Old Tansy. She rang the bronze bell in every fog, so the boats could feel their way home. The Great Squall took that bell into the sea. The island lost its bell... and kept the name to remember it by. Notbell.' },
  { at: 6, text: 'Tansy hired divers to find the bell, and paid them from her button jar — a whole summer of buttons. They never found it. But by autumn, everyone was trading in buttons. Look in your pocket. You are carrying her jar around, a little at a time.' },
  { at: 10, text: 'When the lamp went dark at last, the light did not go OUT, dear. It went somewhere cozier. Walk into the cave under the cliff some time, and mind your voice. The old light is sleeping in there, among the glow worms. It earned the rest.' },
];

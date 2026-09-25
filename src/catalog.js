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

  // -- beachcombing (the tide brings these in — shells.js) --------------------
  cowrie: {
    kind: 'shell', name: 'Cowrie', emoji: '🐚', price: 18,
    blurb: 'Glossy as a sweet. People used these as money once. Buttons understand.',
  },
  scallop: {
    kind: 'shell', name: 'Scallop Shell', emoji: '🐚', price: 22,
    blurb: 'Fanned like a tiny hand, waving hello from the whole sea.',
  },
  sand_dollar: {
    kind: 'shell', name: 'Sand Dollar', emoji: '🪙', price: 40,
    blurb: 'The sea’s own currency. Pip will not accept it. He has checked the exchange rate and he does not like it.',
  },
  sea_glass: {
    kind: 'shell', name: 'Sea Glass', emoji: '💎', price: 55,
    blurb: 'A bottle, eventually. The sea sands everything down to a kindness.',
  },
  conch: {
    kind: 'shell', name: 'Conch', emoji: '🐚', price: 140,
    blurb: 'Hold it to your ear: the sea. Hold it to the sea: an echo of your ear.',
  },

  pearl: {
    kind: 'shell', name: 'Crown Pearl', emoji: '🫧', price: 300,
    blurb: 'From the giant clam in the Dropped Crown, who makes exactly one a day and has never once been late.',
  },

  // -- starfall (starfall.js) --------------------------------------------------
  star_fragment: {
    kind: 'star', name: 'Star Fragment', emoji: '🌟', price: 420,
    blurb: 'Caught on the way down, still warm. It hums a note just above hearing. Make a wish; it has the paperwork.',
  },
  stardust: {
    kind: 'star', name: 'Stardust', emoji: '✨', price: 95,
    blurb: 'What a star leaves when nobody catches it. A little sad. Very sparkly. Mostly sparkly.',
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

  skateboard: {
    kind: 'gear', name: 'Pip’s Skateboard', emoji: '🛹', price: 1400,
    blurb: 'Four wheels, one plank, zero brakes. Hold run and you’re skating. The island has hills. The island has opinions about the hills.',
  },

  // -- garden & orchard -----------------------------------------------------
  blueberries: {
    kind: 'fruit', name: 'Blueberries', emoji: '🫐', price: 12,
    blurb: 'From the bushes around the Labs. Nobody planted them. Nobody is taking credit. The Labs are investigating.',
  },
  labs_mug: {
    kind: 'keepsake', name: 'Notbell Labs Mug', emoji: '☕', price: 0,
    blurb: '“I ♥ RESEARCH.” The heart is a little bell. The bell is a little joke. The coffee is real.',
  },
  labs_tee: {
    kind: 'keepsake', name: 'Notbell Labs T-Shirt', emoji: '👕', price: 0,
    blurb: '“I WENT TO NOTBELL LABS AND ALL I GOT WAS THIS SHIRT (AND A SMALL AMOUNT OF COSMIC PERSPECTIVE).”',
  },
  rocket_plush: {
    kind: 'keepsake', name: 'Plush Rocket', emoji: '🚀', price: 0,
    blurb: 'Soft, stuffed, fully non-functional. Has been to the moon exactly as many times as you have. Well — it depends.',
  },
  dirt_globe: {
    kind: 'keepsake', name: 'Burrough Dirt Globe', emoji: '🔮', price: 0,
    blurb: 'Shake it and a little storm of dirt swirls around a tiny Loam Street. Then it settles. It always settles. That’s the souvenir.',
  },
  daily_dirt: {
    kind: 'keepsake', name: 'The Daily Dirt', emoji: '🗞️', price: 0,
    blurb: '“All the News That’s Fit to Dig.” Page one is the hot worm story. Pages two through nine are also the hot worm story.',
  },
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
  art_lilies: { kind: 'art', name: '“Water Lilies” (print)', emoji: '🖼️', price: 750,
    blurb: 'After Monet. Mochi is in it in spirit.' },
  art_jatte: { kind: 'art', name: '“A Sunday on the Island” (print)', emoji: '🖼️', price: 750,
    blurb: 'After Seurat. Count the dots; Luna did.' },
  art_redfuji: { kind: 'art', name: '“Red Fuji” (print)', emoji: '🖼️', price: 750,
    blurb: 'After Hokusai. A mountain on a very good morning.' },
  art_smile: { kind: 'art', name: '“The Smile” (print)', emoji: '🖼️', price: 750,
    blurb: 'After Leonardo. The eyes follow. The smile stays.' },
  art_temeraire: { kind: 'art', name: '“The Last Tow” (print)', emoji: '🖼️', price: 750,
    blurb: 'After Turner. A tug, a ghost ship, and a sunset that knows.' },
  art_sleeper: { kind: 'art', name: '“The Sleeping Traveler” (print)', emoji: '🖼️', price: 750,
    blurb: 'After Rousseau. The lion is just checking.' },

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
  eggs: {
    kind: 'keepsake', name: 'A Dozen Eggs', emoji: '🥚', price: 0,
    blurb: 'Twelve, in the gray cardboard. One of them is brown and knows it is special.',
  },
  yogurt: {
    kind: 'keepsake', name: 'Yogurt Cup', emoji: '🍶', price: 0,
    blurb: 'Peach on the bottom. You are meant to stir it. You are not going to stir it.',
  },
  butter: {
    kind: 'keepsake', name: 'Block of Butter', emoji: '🧈', price: 0,
    blurb: 'Salted. Folded in wax paper with the corners tucked like a present to yourself.',
  },
  cheese_wheel: {
    kind: 'keepsake', name: 'Little Cheese Wheel', emoji: '🧀', price: 0,
    blurb: 'A small, round, waxed cheese. It will outlive several of your plans.',
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
  trail_mix: {
    kind: 'keepsake', name: 'Trail Mix', emoji: '🥜', price: 0,
    blurb: 'Peanuts, raisins, sunflower seeds, and a heroic minority of chocolate bits that will not survive the afternoon.',
  },
  bug_spray: {
    kind: 'keepsake', name: 'Bug Spray', emoji: '🧴', price: 0,
    blurb: '“REPELS MOSQUITOES. ATTRACTS COMPLIMENTS.” Smells of citronella and somebody’s grandmother’s porch.',
  },
  third_bean: {
    kind: 'keepsake', name: 'Can of the Third Bean', emoji: '🥫', price: 0,
    blurb: 'No label. Cypress will not say. It is doing better than expected.',
  },
  compass: {
    kind: 'keepsake', name: 'Brass Compass', emoji: '🧭', price: 0,
    blurb: 'Points north, mostly. Out here it sometimes points at the fire instead, which is also a direction.',
  },
  camp_lantern: {
    kind: 'keepsake', name: 'Camp Lantern', emoji: '🏮', price: 0,
    blurb: 'Tin and glass, a little dented. It would be a nightlight if you let it.',
  },
  flashlight: {
    kind: 'gear', name: 'Flashlight', emoji: '🔦', price: 0,
    blurb: 'A good heavy one. After dark it throws a pool of light ahead of you, wherever you point your nose.',
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
  // Oasis Estates — Trader Polly's (the Captain's picks)
  ebtb_seasoning: {
    kind: 'keepsake', name: 'Everything But The Bell Seasoning', emoji: '🧂', price: 0,
    blurb: 'Sesame, poppy, garlic, onion, salt. Everything. Not the bell. The label is very clear about the bell.',
  },
  cookie_butter: {
    kind: 'keepsake', name: 'Cookie Butter', emoji: '🍯', price: 0,
    blurb: 'Cookies, ground down into a spread, which is the kind of idea you only get to have once. Eat it with a spoon, standing up, in the light of the fridge.',
  },
  two_button_chuck: {
    kind: 'keepsake', name: 'Two-Button Chuck', emoji: '🧃', price: 0,
    blurb: 'Sparkling grape juice in a very serious bottle. The label is a painting of a vineyard nobody has been to. Tastes of purple.',
  },
  dried_mango: {
    kind: 'keepsake', name: 'Dried Mango', emoji: '🥭', price: 0,
    blurb: 'Chewy, sweet, and a little awkward to buy from a parrot named Captain Mango. He rings it up without comment. It is costing him something.',
  },
  fearless_feather: {
    kind: 'keepsake', name: 'The Fearless Feather', emoji: '📰', price: 0,
    blurb: 'Trader Polly’s newsletter. Woodcut parrots, puns, and a column called “Why Is There No Bell? (A Letter From The Captain),” which does not answer the question.',
  },
  // Dromedeals (brand names, one hump or two)
  live_laugh_lounge: {
    kind: 'keepsake', name: '“Live Laugh Lounge” Sign', emoji: '🪧', price: 0,
    blurb: 'A painted board in looping letters. Every house at Oasis Estates has one, hung in the same place. Now yours can match. COMPARE AT: 240🔘.',
  },
  ceramic_pineapple: {
    kind: 'keepsake', name: 'Ceramic Pineapple', emoji: '🍍', price: 0,
    blurb: 'Gold, glazed, heavier than it looks, and hollow for no reason. It means “welcome.” It also means “we went to Dromedeals.” COMPARE AT: 180🔘.',
  },
  candle_sand: {
    kind: 'keepsake', name: 'Candle (Scent: “Sand”)', emoji: '🕯️', price: 0,
    blurb: 'Smells exactly like sand. Warm sand, specifically. A camel lit one in the store and got homesick for a place none of them has ever been. COMPARE AT: 90🔘.',
  },
  tennis_visor: { kind: 'hat', name: 'Tennis Visor', emoji: '🧢', price: 0,
    blurb: 'A crisp white visor. The Oasis Estates mall-walker look. Nobody here plays tennis. COMPARE AT: 900🔘.' },
  // Mirage Coffee (coffee, probably)
  mirage_cup: {
    kind: 'keepsake', name: 'Mirage Cup (Your Name, Nearly)', emoji: '🥤', price: 0,
    blurb: 'An empty plastic cup with a green straw and your name on the side, spelled the way it sounded to a parrot. Too good to throw away. Too sticky to keep. You keep it.',
  },
  // Cluck & Co. (it's our pleasure)
  cluck_nuggets: {
    kind: 'keepsake', name: 'Cluck Nuggets (8 ct.)', emoji: '🍗', price: 0,
    blurb: 'Golden, crispy, and — per the laminated card — “chick’n,” which contains no chicken and never has. Nobody knows what they are. Everybody knows they’re good.',
  },
  waffle_fries: {
    kind: 'keepsake', name: 'Waffle Fries', emoji: '🍟', price: 0,
    blurb: 'Potatoes in a grid. The best shape a potato has ever been, and the potato would agree.',
  },
  cluck_sauce: {
    kind: 'keepsake', name: 'Cluck Sauce', emoji: '🥫', price: 0,
    blurb: 'A little tub of something gold and smoky-sweet. Tanner gave you three. He’d give you ten. It’s his pleasure.',
  },
  // the CaMall
  pretzel: {
    kind: 'keepsake', name: 'Auntie Dune’s Pretzel', emoji: '🥨', price: 0,
    blurb: 'A soft pretzel, warm, twisted into a shape that is almost a knot and almost a heart. Salt like sand. You eat it walking, like everyone does, past a store you’ll never go in.',
  },
  dune_gloss: {
    kind: 'keepsake', name: 'Dune Gloss', emoji: '💄', price: 0,
    blurb: 'Sahara’s bestselling lip gloss, in shade “Oasis at Dusk.” It is pink. It is always pink. Paloma says it’s “a mood.”',
  },
  sand_scrub: {
    kind: 'keepsake', name: 'Sahara Sand Scrub', emoji: '🫙', price: 0,
    blurb: 'A luxury exfoliant. The ingredients list says “sand.” The ingredients list is honest, and that is its own luxury.',
  },
  // the Isle of Cran — Bog Ink (tattoos), Low Tide Records, the Community Center
  tattoo_cranberry: {
    kind: 'keepsake', name: 'Tattoo: A Cranberry', emoji: '🍒', price: 0,
    blurb: 'Small, red, on the shoulder. Spike says you’ll float now. Metaphorically. Possibly literally. Nobody has tested it.',
  },
  tattoo_mom: {
    kind: 'keepsake', name: 'Tattoo: Anchor, “MOM”', emoji: '⚓', price: 0,
    blurb: 'Timeless. Whose mom? All moms. Rock and roll.',
  },
  tattoo_turtle: {
    kind: 'keepsake', name: 'Tattoo: “SLOW & STEADY & METAL”', emoji: '🐢', price: 0,
    blurb: 'A turtle, with a banner. Barb has the same one, under the moss. She will deny it with her whole shell.',
  },
  tattoo_lighthouse: {
    kind: 'keepsake', name: 'Tattoo: A Lighthouse', emoji: '🗼', price: 0,
    blurb: 'With the light on. People always want the light on.',
  },
  record_slowjams: {
    kind: 'keepsake', name: 'LP: “Slow Jams for Snapping Turtles”', emoji: '💿', price: 0,
    blurb: 'Side A: slow. Side B: longer. Sloane recommends Side B, eventually.',
  },
  record_honk: {
    kind: 'keepsake', name: 'LP: “HONK” (Mabel, bootleg)', emoji: '📀', price: 0,
    blurb: 'Recorded in the listening booth, without asking. It is, against every expectation, very good.',
  },
  record_lofi: {
    kind: 'keepsake', name: 'LP: “Lo-fi Beats to Hack the Labs To”', emoji: '💽', price: 0,
    blurb: 'Soft keys, rain, a cat purring into a microphone. The title is a coincidence, says Null.',
  },
  watercolor_bog: {
    kind: 'keepsake', name: 'A Watercolor of the Bog', emoji: '🎨', price: 0,
    blurb: 'You painted the bog. It came out a pink smudge. Miss Dabble says that’s it exactly, and she’s right.',
  },
  // Chuckee's (the travel stop in the strait)
  chuckee_nuggets: {
    kind: 'keepsake', name: 'Chuckee Nuggets', emoji: '🌽', price: 0,
    blurb: 'Sweet, crunchy corn puffs in a bag with a woodchuck on it. The number in a bag changes every time Chuckee counts. It is never enough.',
  },
  brisket_sandwich: {
    kind: 'keepsake', name: 'Brisket Sandwich', emoji: '🥪', price: 0,
    blurb: 'Chopped brisket on a bun, with the pickles, wrapped in paper that says CHUCKEE’S in red. Smoked since the tide went out yesterday.',
  },
  chuckee_fudge: {
    kind: 'keepsake', name: 'Chuckee’s Fudge', emoji: '🍫', price: 0,
    blurb: 'Rocky road. The rocks are nuts. (Mostly nuts.) Do not tell the Chocoholics Anonymous group on Cran.',
  },
  chuckee_plush: {
    kind: 'keepsake', name: 'Chuckee Plush', emoji: '🦫', price: 0,
    blurb: 'A little woodchuck in a little red cap. Squeezing it does nothing. Chuckee likes it when you squeeze it anyway.',
  },
  hoa_notice: {
    kind: 'keepsake', name: 'Notice of Violation', emoji: '📋', price: 0,
    blurb: 'A pink carbon copy from the Oasis Estates HOA, filled out in a very neat hand. Under “VIOLATION” it says “see attached.” There is nothing attached. That is also a violation.',
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

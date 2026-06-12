// The islanders. animals.js gives them bodies and feet; this file gives
// them names, voices, and opinions — and their friendships, which ambient.js
// turns into little meetups. Index order matches the ROSTER there.

import * as ui from './ui.js';
import { register } from './interact.js';
import { applyHat } from './hats.js';
import { HOLIDAY, HOLIDAY_LINES } from './calendar.js';
import { jingle } from './audio.js';
import * as S from './state.js';

const IDENTITIES = [
  {
    name: 'Clover', voice: 640, hat: 'flower_crown', // cream rabbit
    lines: [
      'I counted my lucky clovers today. All of them! That’s how I know it’s a good day.',
      'If you stand very still in the flowers, the butterflies think you’re furniture. It’s the best.',
      'Biscuit says you can’t nap twice in one morning. I am LIVING PROOF that you can.',
      'Luna’s coffee smells like a warm windowsill. I don’t drink it. I just go in and breathe.',
    ],
  },
  {
    name: 'Biscuit', voice: 560, hat: 'knit_cap', // brown rabbit
    lines: [
      'I buried something great once. Can’t remember where. So now EVERY day is a treasure hunt.',
      'The trick to digging is to look like you meant to do whatever you just did.',
      'Pip tried to buy my lucky button. My LUCKY one! The nerve. The absolute magpie of it all.',
      'If you find a very old pebble, take it to Fern. She knew it when it was young.',
    ],
  },
  {
    name: 'Saffron', voice: 520, hat: 'straw_hat', // orange fox
    lines: [
      'I’ve smelled every flower on this island twice. Professional curiosity. I’m not a professional anything.',
      'The tide pools gossip, you know. Splash splash splash. Scandalous stuff.',
      'Don’t tell Howell I said this, but his howl is getting better. It’s almost a whole note now.',
      'Sea Bass again? Hm. I’d rate it… B minus. Generous, I know.',
    ],
  },
  {
    name: 'Howell', voice: 430, hat: null, // wolves don't wear hats. it's a whole thing. // gray fox. a WOLF. obviously a wolf.
    lines: [
      'It’s HOWELL. As in HOWL. As in, the sound a WOLF makes. Which I am one of. A wolf.',
      'Foxes wish they had this kind of presence. I wouldn’t know. Being a wolf.',
      'AwooOOOoo… ahem. Practice. Wolves practice. It’s normal.',
      'On foggy nights, I hear a bell ring under the sea. I’m not being mysterious — I have EXCELLENT ears. Wolf ears.',
    ],
  },
  {
    name: 'Bramble', voice: 320, hat: 'leaf_hat', // bear
    lines: [
      'I sat by the cave entrance yesterday. Something in there hums. It’s a friendly hum. I checked.',
      'A good day is a berry, a sit, and one (1) excellent cloud. Today had all three by breakfast.',
      'Fern remembers when my grandmother was a cub. I don’t ask Fern how old she is. Manners.',
      'You smell like buttons and ambition. The island will do that to you.',
    ],
  },
  {
    name: 'Puddle', voice: 700, hat: 'paper_boat', // white duck
    lines: [
      'I swam ALL the way around the island today! …okay, halfway. …okay, it was a big puddle.',
      'The Admiral says I lack discipline. I say I lack snacks. We are both correct.',
      'If your boot gets away from you while fishing, don’t worry! I know that boot. It’s a free spirit.',
      'Quack. Sorry — force of habit.',
    ],
  },
  {
    name: 'Admiral Greenbean', voice: 380, hat: 'captains_cap', // the mallard
    lines: [
      'At ease. The morning patrol found nothing to report, which is exactly how I like my reports.',
      'A tidy beach is a happy beach. I run a tight shoreline, sailor.',
      'Old Tansy once let me ring the lighthouse bell. Finest moment of my career. Don’t let Puddle tell it — she exaggerates.',
      'The fog rolls in, the fog rolls out. Only one of us salutes it, and I’m fine with that.',
    ],
  },
  {
    name: 'Marigold', voice: 350, hat: 'straw_hat', // the Far Isle's horse
    lines: [
      'I trot the bridge every morning before the train wakes up. We have an understanding.',
      'Brother Alder says my hooves on the planks sound like applause. I take this very seriously.',
      'The garden here grows quieter flowers. You have to lean in to hear them showing off.',
      'Have you tried just… running? Not to anywhere. Just running. Strongest possible recommend.',
    ],
  },
  {
    name: 'Ember', voice: 590, hat: null, // salamander, cave enthusiast
    lines: [
      'The cave hums in B-flat. I checked. Sometimes I hum back. We harmonize.',
      'Warm rock, cool dark, little stars on the ceiling. I have everything, basically.',
      'The Old Light doesn’t mind visitors. It told me so. Not in words. In warm.',
      'Rain! I LOVE rain. Everyone else hides indoors and I get both whole islands to myself.',
    ],
  },
  {
    name: 'Tusk', voice: 240, hat: null, // the wild boar. wild-ish. wild-adjacent.
    lines: [
      '*snrrrf*',
      'Hrmf. (He nudges a mushroom toward you, then thinks better of it and eats it.)',
      '*contented rooting noises*',
      '(He looks at you for a long moment. You appear to have passed some kind of inspection.)',
    ],
  },
  {
    name: 'Butterpat', voice: 300, hat: 'straw_hat', // the north isle's cow
    lines: [
      'The grass here is mossy and the moss here is grassy. I have studied this for years. Delicious field, my field of study.',
      'I tried the button mushroom stew. I wept. The cart knows what it did.',
      'Vesper reads to me on quiet evenings. I don’t always follow the plot. The company is the plot.',
      'Moo, by the way. I like to get that out of the way professionally.',
    ],
  },
  {
    name: 'Crumb', voice: 760, hat: 'paper_boat', // mouse, master of the MouseBoat
    lines: [
      'Welcome aboard! Well — welcome NEAR. Aboard is mostly cheese storage.',
      'I’ve docked at every shore in the archipelago. Ranked them by crumbs. Yours is third. Don’t take it hard.',
      'A houseboat means never choosing between the sea and a nap. I refuse to choose. I’m a sailor of naps.',
      'The Persistent and the MouseBoat are technically rival vessels. Brine sends over soup anyway. Fierce rivalry. Delicious.',
    ],
  },
  {
    name: 'Mochi', voice: 250, hat: 'orange_hat', // capybara; the orange arose
    lines: [
      'Mm. Hello. (This takes a while to say, done properly.)',
      'The orange? It arrived. It stayed. We don’t interrogate good things.',
      'I have soaked in every spring on this island and ranked them. They are all first.',
      'You seem hurried. Sit a moment. The hurry will keep. It always keeps.',
    ],
  },
  {
    name: 'Pondo', voice: 230, hat: null, // the other capybara
    lines: [
      'Mochi does the talking. I do the agreeing. Mm.',
      'Sol let me lean on him through an entire rainstorm once. A mountain of a friend.',
      'The geysers go off and everyone jumps. Not us. We knew. The water tells you first.',
      '…Sorry, I drifted off. Were we talking? Were we both here? Good. Good.',
    ],
  },
  {
    name: 'Sol', voice: 180, hat: null, // crocodile, professionally patient
    lines: [
      'Sssalutations. Don’t mind the teeth. They came with the face.',
      'The bird? That’s Pick. She handles dental. I handle being warm and enormous.',
      'People expect menace. I subcontract all my menace to the geysers.',
      'The capybaras lean on me when it rains. It is the entire reason I have a back.',
    ],
  },
  {
    name: 'Brook', voice: 200, hat: null, // the other crocodile
    lines: [
      'Sol talks. I smile. Between us, a complete crocodile.',
      'My bird is called Pip — no relation to the magpie. There was a lawsuit. There was not. There could be.',
      'I once held perfectly still for a week. Personal best. The moss got ideas.',
      'Swim with us sometime. We mostly float and think about lunch we already had.',
    ],
  },
];

// ------------------------------------------------------------ friendships ----
// Everyone has a person. ambient.js arranges the meetups; the chats are
// little scripts, alternating speakers 'a' and 'b'. meetLines is what you
// get for walking up mid-conversation.

export const FRIENDS = [
  {
    a: 'Howell', b: 'Saffron',
    chats: [
      [['a', '…and THEN the fog rolled in, and I heard it. The bell. Clear as anything.'],
       ['b', 'You always hear it, Howell.'],
       ['a', 'Because I have wolf ears.'],
       ['b', 'Sure. Wolf ears.'],
       ['a', '…You believe me, though.'],
       ['b', 'I always believe you. That’s the annoying part.']],
      [['b', 'Rate the sea bass.'],
       ['a', 'B minus.'],
       ['b', 'HA! EXACTLY. This is why we’re friends.']],
      [['a', 'AwooOOO.'],
       ['b', 'Closer to a whole note every day.'],
       ['a', 'I KNOW. I’ve been practicing on the cliffs.']],
    ],
    meetLines: {
      Howell: 'We are discussing WOLF business. Official wolf business. …She’s allowed, she’s a consultant.',
      Saffron: 'We’re gossiping. He calls it wolf business. Both things are true.',
    },
  },
  {
    a: 'Clover', b: 'Biscuit',
    chats: [
      [['a', 'I found a clover with FIVE leaves today.'],
       ['b', 'That’s just showing off.'],
       ['a', 'The clover, or me?'],
       ['b', 'Yes.']],
      [['b', 'I buried something great near the big rock. Or A big rock. Or possibly it was a stick.'],
       ['a', 'I LOVE a treasure hunt.'],
       ['b', 'Me too. I make them by accident.']],
      [['a', 'Nap by the flowers later?'],
       ['b', 'I’m already late for it.']],
    ],
    meetLines: {
      Clover: 'Biscuit’s telling me where he buried things! He doesn’t know either! It’s the best.',
      Biscuit: 'Strategy meeting. The strategy is naps.',
    },
  },
  {
    a: 'Puddle', b: 'Admiral Greenbean',
    chats: [
      [['b', 'Discipline, sailor. Three laps of the cove.'],
       ['a', 'Can they be small laps?'],
       ['b', '…Granted.']],
      [['a', 'I swam around the WHOLE island today!'],
       ['b', 'Puddle.'],
       ['a', '…most of a puddle.'],
       ['b', 'Logged as reported. Carry on.']],
    ],
    meetLines: {
      Puddle: 'I’m being TRAINED. It mostly involves snacks at the end.',
      'Admiral Greenbean': 'Officer development, sailor. The paper boat stays. It’s earned regimental status.',
    },
  },
  {
    a: 'Bramble', b: 'Ember',
    chats: [
      [['a', 'The cave hum. Louder lately?'],
       ['b', 'HAPPIER lately. Still B-flat, but warm about it.'],
       ['a', 'Good. Good. I worry, you know.'],
       ['b', 'It knows. It hums back politer when you sit outside.']],
      [['b', 'You’d love the acoustics in there.'],
       ['a', 'I’d block the acoustics in there.'],
       ['b', 'You’d give them something to work with.']],
    ],
    meetLines: {
      Bramble: 'We’re talking about the cave. Quietly. It might be listening, and it’s earned the courtesy.',
      Ember: 'Bear and salamander, solving geology. Nearly there.',
    },
  },
  {
    a: 'Butterpat', b: 'Crumb',
    chats: [
      [['b', 'Welcome to the north-shore branch of the MouseBoat trading empire.'],
       ['a', 'I brought grass.'],
       ['b', 'You ate the grass.'],
       ['a', 'I brought it somewhere safe, yes.']],
      [['a', 'Read me the plot again?'],
       ['b', 'You fell asleep at the good part last time.'],
       ['a', 'The company is the plot.']],
    ],
    meetLines: {
      Butterpat: 'Crumb is telling me about every harbor in the world. I have been to one field. We are equally happy.',
      Crumb: 'Trade negotiations. She pays in moo. The exchange rate is excellent.',
    },
  },
  {
    a: 'Mochi', b: 'Pondo',
    chats: [
      [['a', 'Mm.'],
       ['b', 'Mm.'],
       ['a', '…Well said.']],
      [['b', 'Spring four is the best one.'],
       ['a', 'They are all first.'],
       ['b', 'They are all first.']],
    ],
    meetLines: {
      Mochi: 'We are conversing. Do not be fooled by the silence. It is dense with content.',
      Pondo: '…Were we talking? Good. Good.',
    },
  },
];

export const FRIEND_OF = {};
for (const f of FRIENDS) {
  FRIEND_OF[f.a] = f.b;
  FRIEND_OF[f.b] = f.a;
}

// what the sender says when they hand the parcel over
const ERRAND_ASKS = {
  Howell: 'Take this to Saffron, would you? It’s a rock that looks like a bell. She collects my best finds. As a CONSULTANT.',
  Saffron: 'Run this over to Howell? It’s an excellent stick. Tell him it’s a wolf stick. It’ll make his whole week.',
  Clover: 'Could you bring this to Biscuit? It’s four lucky clovers. He keeps losing his and I keep finding extras. The system works.',
  Biscuit: 'Take this to Clover? I dug it up and it SMELLS lucky. She’ll know what it is. She always knows.',
  Puddle: 'Would you take this to the Admiral?? It’s a medal I made him. It’s a shell on a string! Don’t tell him! Tell him!!',
  'Admiral Greenbean': 'Deliver this to Puddle, sailor. Official commendation for most improved laps. There’s a snack in it. The snack is the commendation.',
  Bramble: 'For Ember, when you’re passing. A very smooth stone, sun-warmed. I sat on it all morning to get it ready.',
  Ember: 'Bring this to Bramble? Cave moss. The good kind. He pretends he doesn’t keep a collection. The collection is labeled.',
  Butterpat: 'For Crumb, if you’re headed shoreward. Pressed flowers. Ship’s library needs SOME color that isn’t cheese.',
  Crumb: 'Run this to Butterpat? Crackers from three harbors over. She’s never had a cracker. This is an EVENT.',
  Mochi: 'Mm. For Pondo. (It is an orange. You may not ask further.)',
  Pondo: 'For Mochi, when the current takes you that way. Mm. No rush. There is never any rush.',
};

// what the recipient says when the parcel arrives
const DELIVERY_THANKS = {
  Howell: 'From Saffron? A WOLF STICK. …Tell her the wolf is extremely pleased. Use those words. EXTREMELY.',
  Saffron: 'A bell-shaped rock! That’s the fourth one. I keep them on the windowsill where he can see I keep them. Don’t tell him. He knows.',
  Clover: 'Oh, it smells SO lucky! Biscuit found this? Today really is a good day. I counted.',
  Biscuit: 'Lucky clovers!! From Clover!! I’m going to bury them somewhere GREAT and forget where. The luck compounds that way.',
  Puddle: 'A SNACK COMMENDATION! From the ADMIRAL! I’m framing the wrapper. After. After the snack.',
  'Admiral Greenbean': '…A medal. Shell, string, exemplary knotwork. (He puts it on immediately.) Inform the duck her form is improving. At ease.',
  Bramble: 'Cave moss. The good kind. …It goes in the collection. There is no collection. (There is. It’s labeled.)',
  Ember: 'A sun-warmed stone from Bramble! He pre-sits them, you know. Warmest friend in the archipelago. Literally. After me.',
  Butterpat: 'Crackers! From the sea! I shall eat them slowly over several days. (They are gone within the hour.)',
  Crumb: 'Pressed flowers for the ship’s library! Filed under F, for Friend.',
  Mochi: 'Mm. (The orange situation, you understand, continues.) Tell Pondo: well sent.',
  Pondo: 'Mm. (He balances it on his head next to nothing else, because Mochi wears the hat.) …Perfect.',
};

export function nameVillagers(animals) {
  animals.forEach((a, i) => {
    const id = IDENTITIES[i % IDENTITIES.length];
    a.identity = id;
    if (id.hat) applyHat(a.g, id.hat);
    let next = Math.floor(Math.random() * id.lines.length);
    let saidHoliday = false;
    register({
      getPos: () => a.g.position,
      r: 2.6,
      enabled: () => !a.away, // when they're home, houses.js hosts the chat
      label: `talk to ${id.name}`,
      use: async () => {
        if (HOLIDAY && !saidHoliday) {
          saidHoliday = true;
          ui.say(HOLIDAY_LINES[HOLIDAY.id], { speaker: id.name, voice: id.voice });
          return;
        }
        // a parcel with their name on it beats small talk
        if (S.state.errand?.to === id.name) {
          const from = S.state.errand.from;
          S.removeItem('parcel');
          S.state.errand = null;
          S.state.lastErrandAt = Date.now();
          const reward = 120 + Math.floor(Math.random() * 4) * 20;
          S.earn(reward);
          jingle();
          await ui.say(DELIVERY_THANKS[id.name] ||
            `Oh — from ${from}? Carried all this way? You’re a good one.`,
            { speaker: id.name, voice: id.voice });
          ui.toast(`${id.name} tucked <b>${reward} buttons</b> into your paw for the trouble.`, '🔘');
          ui.updateHUD();
          return;
        }
        if (S.state.errand?.from === id.name) {
          ui.say('Still got it? Good, good. No rush. …Some rush.',
            { speaker: id.name, voice: id.voice });
          return;
        }
        // maybe there's a parcel that needs legs
        const friend = FRIEND_OF[id.name];
        if (!S.state.errand && friend && ERRAND_ASKS[id.name] &&
            Date.now() - (S.state.lastErrandAt || 0) > 240000 && Math.random() < 0.3) {
          const yes = await ui.ask(ERRAND_ASKS[id.name], [
            { label: '🎁 Of course', value: 'yes' },
            { label: 'Maybe later', value: null },
          ], { speaker: id.name, voice: id.voice });
          if (yes) {
            S.state.errand = { from: id.name, to: friend };
            S.addItem('parcel');
            jingle();
            ui.toast(`Got <b>A Small Parcel</b> for <b>${friend}</b>! They’ll be around — somewhere.`, '🎁');
          } else {
            ui.say('No no, fair enough. It keeps. Friendship keeps.', { speaker: id.name, voice: id.voice });
          }
          return;
        }
        const line = id.lines[next];
        next = (next + 1) % id.lines.length;
        ui.say(line, { speaker: id.name, voice: id.voice });
      },
    });
  });
}

// The islanders. animals.js gives them bodies and feet; this file gives
// them names, voices, and opinions — and their friendships, which ambient.js
// turns into little meetups. Index order matches the ROSTER there.

import * as ui from './ui.js';
import { register } from './interact.js';
import { applyHat } from './hats.js';
import { HOLIDAY, HOLIDAY_LINES } from './calendar.js';
import { jingle } from './audio.js';
import * as S from './state.js';
import { ITEMS } from './catalog.js';

// characters who belong to one place (the MouseBoat, the springs, the cave,
// the duck nest) — they never wander off to other islands or take trains
const ANCHORED = new Set(['Crumb', 'Mochi', 'Pondo', 'Sol', 'Brook', 'Ember', 'Admiral Greenbean', 'Puddle', 'Barb', 'Ruth', 'Penny']);

// what anyone says when you catch them mid-hobby (ambient.js pastimes)
const FISHING_LINES = [
  'Shh. They’re thinking about it.',
  'I’m not trying to catch anything. I’m trying to be the kind of person who fishes.',
  'Caught a boot earlier. Put it back. It looked like it had somewhere to be.',
  'The trick is to want it a little less than the fish does.',
];
const NETTING_LINES = [
  'Hold still. Not you. The beetle.',
  'I’m not catching them, exactly. We’re getting to know each other through a net.',
  'Missed! On purpose. I’m being gracious.',
];
const pick = (list) => list[Math.floor(Math.random() * list.length)];

// birthdays — one date each, no ages; the archipelago counts occasions,
// not years. (Howell's is the day after Bell Day. He says he heard it.)
export const BIRTHDAYS = {
  Clover: [5, 1], Biscuit: [11, 12], Saffron: [9, 22], Howell: [6, 22],
  Bramble: [7, 19], Puddle: [4, 14], 'Admiral Greenbean': [2, 8],
  Marigold: [8, 30], Ember: [1, 17], Tusk: [12, 1], Butterpat: [6, 3],
  Crumb: [9, 9], Mochi: [1, 2], Pondo: [1, 3], Sol: [7, 7], Brook: [3, 20],
  Barb: [10, 14], Ruth: [3, 1], Null: [1, 1], Mabel: [4, 1], Penny: [2, 14],
};

export function birthdayToday(name, d = new Date()) {
  const b = BIRTHDAYS[name];
  return !!b && d.getMonth() + 1 === b[0] && d.getDate() === b[1];
}

// The whole birthday exchange — greeting, the gift offer, the thanks — shared
// by the wander-talk and the at-home visit (a birthday follows you home).
// Returns true if today was, in fact, the whole day.
export async function birthdayTalk(name, voice) {
  if (!birthdayToday(name)) return false;
  const year = new Date().getFullYear();
  if (S.hasFlag(`bgift_${name}_${year}`)) {
    ui.say('Best birthday in recent memory. Recent memory is generous. Still.', { speaker: name, voice });
    return true;
  }
  const pocket = Object.entries(S.state.inv)
    .filter(([iid]) => ITEMS[iid])
    .slice(0, 5)
    .map(([iid]) => ({ label: `${ITEMS[iid].emoji} ${ITEMS[iid].name}`, value: iid }));
  const choice = await ui.ask(
    'It’s my birthday, you know. The whole day. I’m being extremely calm about it.',
    [...pocket, { label: '🎉 Just warm wishes', value: null }],
    { speaker: name, voice });
  if (choice) {
    S.removeItem(choice);
    S.setFlag(`bgift_${name}_${year}`);
    jingle();
    await ui.say(
      `“For ME?” They hold the ${ITEMS[choice].name} like it might hatch. “This is the best one so far. Don’t tell the other years.”`,
      { speaker: name, voice });
    ui.toast(`${name} will remember this.`, '🎂');
  } else {
    ui.say('Warm wishes received and archived. The calm continues.', { speaker: name, voice });
  }
  return true;
}

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
  // ----- the Isle of Cran (index order matches animals.js ROSTER)
  {
    name: 'Barb', voice: 170, hat: null, // snapping turtle. the moss on her shell is the hat.
    lines: [
      'Hrm. You’re standing on my good rock. … No. Stay. It’s a good rock. Somebody should enjoy it.',
      'I snap. It’s in the name. I don’t snap at friends. I snap at weather. I snap at the IDEA of Tuesdays.',
      'Ruth and I have sat by this creek forty years. Said maybe a hundred words. Ninety of them were “look.”',
      'Cranberries float. Little pockets of nothing inside. Everything that floats has a little nothing in it. Remember that, next time you’re sinking.',
      'The creek goes to the sea. Everything goes to the sea. I’m in no hurry. The sea keeps.',
      'Don’t tell anyone. I go to zumba. Back row. I don’t do the arms.',
      'Got a tattoo once. On the shell. “RUTH,” in a heart. She says it’s silly. She stops by to look at it every day.',
      'The cat’s always on her laptop. The goose is always on something she shouldn’t be. I’m on this rock. We all have our places.',
    ],
  },
  {
    name: 'Ruth', voice: 300, hat: 'knit_cap', // box turtle. knits. for the creek, mostly.
    lines: [
      'Oh, hello, dear. Sit, sit. Barb won’t mind. Barb minds everything, which means she doesn’t mind anything in particular.',
      'I’m knitting a scarf for the creek. For winter. It’ll be very long. The creek is very long.',
      'Watercolor on Thursdays. I paint the bog. Every week it comes out a pink smudge. In autumn, the bog IS a pink smudge. I’m very accurate.',
      'Barb had my name tattooed on her shell. I pretend it’s silly. I visit it every day.',
      'Moss grows about an inch a year. I’ve watched a whole yard of it grow. It was lovely the entire way.',
      'I go to the chocolate group at the community center. To support them. I bring brownies. They’ve asked me to stop. I’m supporting that, too.',
    ],
  },
  {
    name: 'Null', voice: 560, hat: 'headphones', // black cat. hacker. "like the value, not like nothing."
    lines: [
      'I’m in. … Sorry. I say that when I walk into places. It’s a habit.',
      'I hacked the Labs once. Their password was “bell.” I changed it to “notbell.” That was two years ago. Nobody’s noticed.',
      'The whole island runs on one router. The router lives in a hollow log. The log is mossy. The signal is excellent.',
      'Black cat, crossing your path. That’s seven years of good uptime. People get the superstition backwards.',
      'I wrote a program to count the cranberries. It crashed. There are more cranberries than numbers. I’m looking into it.',
      'The goose keeps stealing my USB sticks. I stopped fighting it. Everything’s backed up. In the goose.',
      '“Hacker” is a strong word. I’m more of a person who knows where the settings are.',
      'Null. Like the value. Not like nothing. There’s a difference, and I’m it.',
    ],
  },
  {
    name: 'Mabel', voice: 470, hat: 'party_cone', // goose. the hat was on a birthday. the birthday wasn't using it.
    lines: [
      'HONK. … That’s hello. It’s also a warning. Mostly hello.',
      'I don’t steal. I RELOCATE. Things end up where they’re supposed to be, which is near me.',
      'This hat? It was on a birthday. The birthday wasn’t using it. HONK.',
      'Barb snapped at me once. I honked at her. Best enemies ever since. She saves me the good rock when it rains.',
      'I found a key today. Don’t know what it opens. That’s the fun part. That’s ALWAYS the fun part.',
      'The cat thinks I don’t know she backs things up into me. I know. I’m a very secure goose.',
      'Zumba is just running around honking, with rules. I’m very good at it. I’m banned from the front row.',
    ],
  },
  {
    name: 'Penny', voice: 600, hat: 'mail_cap', // pigeon. the mail carrier. walks every bridge twice a day.
    lines: [
      'Mail! … Not for you. Not yet. Soon, maybe. I’ll know before you do.',
      'Neither rain nor snow nor a very persuasive goose shall stay me from my rounds. The goose has tried.',
      'I walk every bridge in the archipelago. Twice a day, some days. My feet have opinions. The opinions are also mail.',
      'Moss sorts, I carry. He’s thorough, I’m quick. Between us: a whole postal service.',
      'I don’t read the letters. I can tell what’s in them by how they sit in the bag, though. The happy ones sit up straight.',
      'Pigeons have been carrying messages for longer than there have been messages. We just call it walking now. I prefer walking. The view’s lower.',
    ],
  },
];

// ------------------------------------------------------------ friendships ----
// Everyone has a person. ambient.js arranges the meetups; the chats are
// little scripts, alternating speakers 'a' and 'b'. meetLines is what you
// get for walking up mid-conversation.

// everybody who lives on the islands, for the Post's address book
export const VILLAGER_NAMES = IDENTITIES.map((i) => i.name);

// Letters back, when you write (mail.js). Each neighbor answers in their
// own voice — a different letter each time you write, round and round.
// `postcard` is the line they add when what you sent was the Farther card.
export const MAIL_REPLIES = {
  Clover: {
    letters: [
      'Your letter came! I read it in the flowers so the butterflies could hear. They were very moved. One of them landed on the part about me.',
      'I put your letter under my pillow for luck. Then I napped on it. Twice. It’s the luckiest nap I’ve ever had.',
    ],
    postcard: 'A postcard from FARTHER! I didn’t know you could get farther than here. Now I have to go. I’m packing a snack.',
    sign: 'Clover (a lucky rabbit, now luckier)',
  },
  Biscuit: {
    letters: [
      'Got your letter. I buried it for safekeeping. Then I dug it up to read it again. Then I buried it again. It’s in a very good spot. I think.',
      'Thanks for writing! I found a great pebble today and I thought: who else would understand this pebble? You. It’s in the envelope. (It didn’t fit. Imagine it.)',
    ],
    postcard: 'The postcard is on my wall next to my treasure map. The map is of my own garden. It’s very detailed.',
    sign: 'Biscuit',
  },
  Saffron: {
    letters: [
      'I got your letter and I smelled it first, obviously. Paper, a little salt, and Moss. Moss smells like a library that took up swimming.',
      'You write the way the tide pools gossip — lots of little news, all of it important. Write again. I want to know EVERYTHING.',
    ],
    postcard: 'Farther Isle! I hear the mangroves out there are extremely nosy. I respect them already.',
    sign: 'Saffron (professionally curious, unprofessionally)',
  },
  Howell: {
    letters: [
      'I received your correspondence. I read it aloud. To the moon. As wolves do. It went very well. The moon had no notes.',
      'Thank you for your letter. I will keep it in my den. My den is a house. A wolf’s house. Which is a den. AwoOOo. (That was a sign-off. Wolves sign off like that.)',
    ],
    postcard: 'A postcard from the far places. Wolves roam, you know. I have roamed. I have roamed as far as the bridge.',
    sign: 'Howell (a wolf)',
  },
  Bramble: {
    letters: [
      'Your letter came on a good day: a berry, a sit, and one (1) excellent cloud. Then your letter. That’s four. I didn’t know a day could hold four.',
      'I read your letter slowly, the way you eat the last berry. It was a very good last berry. Write again when you have another.',
    ],
    postcard: 'Farther. I like a place that says what it is. I’ll look at the card instead of going. That’s nearly as good, for a bear.',
    sign: 'Bramble',
  },
  Puddle: {
    letters: [
      'YOUR LETTER!! I read it swimming. It got a bit wet. It’s fine! Now it’s a bit of a puddle, which is my NAME, so it’s basically mine now!!',
      'The Admiral says letters should be short and to the point. HERE IS MY POINT: hi!!! I miss you!!! Come to the beach!!!',
    ],
    postcard: 'A postcard!! From somewhere I haven’t swum to YET!!',
    sign: 'Puddle 💧',
  },
  'Admiral Greenbean': {
    letters: [
      'Your dispatch was received at 0900 and read at 0901. A crisp report. Well done, sailor. Nothing further. (Carry on.)',
      'Correspondence acknowledged. The shoreline remains tidy. Puddle remains Puddle. All is as it should be. At ease.',
    ],
    postcard: 'A postcard from a forward position. Farther. Noted in the log. The log is proud of you.',
    sign: 'Adm. Greenbean, retired (not retired)',
  },
  Marigold: {
    letters: [
      'I carried your letter across the bridge this morning so the planks could hear it. They applauded. They applaud everything, but this time they meant it.',
      'Your letter was a quiet kind of letter. The best kind. You have to lean in to hear it showing off.',
    ],
    postcard: 'Farther! Past the Far Isle. I didn’t think there was a past-the-Far-Isle. I’ll trot a little farther tomorrow, in your honor.',
    sign: 'Marigold',
  },
  Ember: {
    letters: [
      'I read your letter in the cave. The cave hums in B-flat and so, it turns out, does your handwriting. We harmonized. It was lovely.',
      'Thank you for writing! I told the Old Light about it. It didn’t say anything. It went a little warmer. That’s how you know.',
    ],
    postcard: 'A postcard! I pinned it up near the glow worms. They’re very polite about it. They glow at it now.',
    sign: 'Ember',
  },
  Tusk: {
    letters: [
      '*snrrrf.* (A muddy hoofprint. Beside it, very carefully, a second, smaller hoofprint. It is, unmistakably, a thank-you.)',
      'Hrmf. (A mushroom, pressed flat and mailed. It is a gift. It is also slightly eaten. Both are how Tusk says you matter.)',
    ],
    postcard: '(The postcard has come back with a mushroom tucked into the corner. Tusk approves of Farther.)',
    sign: '(a hoofprint)',
  },
  Butterpat: {
    letters: [
      'I got your letter and I read it three times, slowly, the way I eat moss. It was delicious. Letters are like moss. They are best in company.',
      'Vesper helped me with the long words in your letter. There weren’t any. Vesper stayed anyway. That’s how good your letter was.',
    ],
    postcard: 'A postcard from a whole other island. I will stand very still and imagine the grass there. I bet it’s grassy.',
    sign: 'Butterpat (of the north moss)',
  },
  Crumb: {
    letters: [
      'Ahoy! Your letter arrived just as I woke from a nap and just before I started another. Perfect timing. Very seaworthy of you.',
      'Filed your letter in the cheese storage for safekeeping. It’s the safest place aboard. It smells a bit of cheddar now. You’re welcome.',
    ],
    postcard: 'Farther Isle! I’ve moored there. Ranked it for crumbs. Excellent crumbs. Your postcard is fourth. That’s very high.',
    sign: 'Crumb, Master of the MouseBoat',
  },
  Mochi: {
    letters: [
      'Mm. Your letter. I read it in the hot spring. It is now slightly steamed. It is very relaxed. So am I.',
      'Thank you. That is the whole letter. (It took me a long time. Done properly.)',
    ],
    postcard: 'Mm. Farther. We will soak about it.',
    sign: 'Mochi (and the orange)',
  },
  Pondo: {
    letters: [
      'Mochi read me your letter. I agreed with all of it. Mm.',
      'I am writing back myself this time. Mochi is helping. Mochi says to say: we liked it. Mm.',
    ],
    postcard: 'Mm. A postcard. We agreed it was a good one.',
    sign: 'Pondo',
  },
  Sol: {
    letters: [
      'Sssalutations. Your letter arrived. Pick read it to me over breakfast while she did my teeth. We agreed it was the best part of the morning.',
      'Thank you for writing. People rarely write to a crocodile. They assume we bite letters. We only bite fish, and only on weekdays.',
    ],
    postcard: 'A postcard from farther away. Sssplendid. I shall bask on it.',
    sign: 'Sol',
  },
  Barb: {
    letters: [
      'Hrm. Got your letter. Read it on the rock. Read it twice. Ruth says that means I liked it. Ruth is right. Don’t tell her.',
      'Letter received. The creek says hello. The creek doesn’t talk. I’m saying it for the creek. Hrm.',
    ],
    postcard: 'A postcard from Farther. I don’t go farther. Farther can come here. It’s welcome to the rock.',
    sign: 'Barb (on the rock)',
  },
  Ruth: {
    letters: [
      'Your letter came, dear! I’ve tucked it into my knitting basket so it stays warm. Barb read it over my shoulder and said “hrm,” which from Barb is a sonnet.',
      'Thank you for writing. I’m knitting you something. It will take a while. I knit at the speed of moss.',
    ],
    postcard: 'Oh, Farther! I painted it from your postcard. It came out a pink smudge. It’s lovely there.',
    sign: 'Ruth (and a scarf, in progress)',
  },
  Null: {
    letters: [
      '> letter received. > parsed. > sentiment: warm. > replying… hi. that’s the reply. hi. it took me four drafts.',
      'Got your letter. It came on paper. Real paper. I held it for a while. Nobody sends me anything that doesn’t have a password.',
    ],
    postcard: 'Farther Isle. No signal out there. I checked. I’m jealous.',
    sign: '— Null (like the value)',
  },
  Mabel: {
    letters: [
      'HONK! Your letter! It’s mine now. It was always going to be mine. That’s how letters work. HONK.',
      'Thanks for writing! Enclosed: one (1) button I found. It was on someone’s coat. They weren’t using the whole coat. HONK.',
    ],
    postcard: 'A postcard! I’m keeping it forever. I keep EVERYTHING forever. Ask the cat.',
    sign: 'Mabel 🪿 (HONK)',
  },
  Penny: {
    letters: [
      'A letter FOR me! I carried it to myself. It was very strange. I delivered it to my own box and then stood there. Thank you. I read it twice, once as the carrier and once as me.',
      'You wrote to the mail carrier. Nobody writes to the mail carrier. I put it in the bag with the others so it wouldn’t be lonely, then I remembered it was mine. Thank you. Truly.',
    ],
    postcard: 'A postcard from Farther! I’ve walked to Farther. By train, then by foot. The postcard is prettier than the walk. Don’t tell Farther.',
    sign: 'Penny (Notbell Post, rounds twice daily)',
  },
  Brook: {
    letters: [
      'Sol said to say thank you. I say thank you. Between us, a complete thank-you.',
      'I held your letter very still for a long time so I could read it properly. Personal best. The moss got ideas again.',
    ],
    postcard: 'A postcard. I smiled at it. That is my review. Five stars.',
    sign: 'Brook',
  },
  _default: {
    letters: ['Thank you for your letter. It found me, which is the whole trick of letters.'],
    postcard: 'A postcard from farther away. How lovely.',
  },
};

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
  {
    a: 'Barb', b: 'Ruth',
    chats: [
      [['a', 'Look.'], ['b', 'Oh. Look.'], ['a', 'Hrm.']],
      [['b', 'I brought brownies.'], ['a', 'For the chocolate group?'], ['b', 'For us. The chocolate group asked me to stop.'], ['a', 'Good. More for the rock.']],
      [['a', 'Creek’s high today.'], ['b', 'Is it?'], ['a', 'No. I just like saying things to you.']],
    ],
    meetLines: {
      Barb: 'Hrm. We’re sitting. It’s a whole thing. Forty years of it.',
      Ruth: 'We’re watching the creek, dear. It does the same thing every day. That’s the charm.',
    },
  },
  {
    a: 'Null', b: 'Mabel',
    chats: [
      [['b', 'HONK.'], ['a', 'That’s my USB stick.'], ['b', 'It WAS your USB stick.'], ['a', '…Keep it safe.']],
      [['a', 'I’m in.'], ['b', 'In what?'], ['a', 'The conversation. I’m in the conversation.'], ['b', 'HONK.']],
      [['b', 'Found a key.'], ['a', 'What does it open?'], ['b', 'Don’t know yet. That’s the fun part.'], ['a', 'I could find out.'], ['b', 'DON’T.']],
    ],
    meetLines: {
      Null: 'We’re in a meeting. It’s encrypted. It’s mostly honking.',
      Mabel: 'We’re planning something. I don’t know what. She does. HONK.',
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
  Barb: 'Hrm. Take this to Ruth. A flat stone. The flattest. Don’t say it’s from me. She’ll know it’s from me.',
  Ruth: 'Would you bring this to Barb, dear? It’s a scarf. For her neck. She says she doesn’t need one. Her neck is very long, when she lets it out.',
  Null: 'Take this to Mabel? It’s a USB stick. She’s going to take it anyway. This way it’s a gift.',
  Mabel: 'HONK. Give this to the cat. It’s her other USB stick. I’m giving it back. Don’t make it weird.',
};

// what the recipient says when the parcel arrives
const DELIVERY_THANKS = {
  Barb: 'From Ruth? A scarf. Hrm. … It’s very long. It’s the right length. Tell her — no. I’ll tell her.',
  Ruth: 'A flat stone. The flattest one. This is from Barb. It doesn’t say so. It doesn’t need to.',
  Null: 'My other USB stick. From the goose. Returned. … Something is wrong. I’m checking the backups.',
  Mabel: 'A USB stick! From the cat! She GAVE it to me? … That’s no fun. I love it. HONK.',
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
    // the ones who ARE their place stay in it: they make the atmosphere where
    // they are. everyone else is a little random dude and may roam.
    a.anchored = ANCHORED.has(id.name);
    if (id.hat) applyHat(a.g, id.hat);
    let next = Math.floor(Math.random() * id.lines.length);
    let saidHoliday = false;
    register({
      getPos: () => a.g.position,
      r: a.long ? 3.4 : 2.6, // (a crocodile's face is a long way from its middle)
      enabled: () => !a.away, // when they're home, houses.js hosts the chat
      label: `talk to ${id.name}`,
      use: async () => {
        // a birthday outranks everything, including the holiday calendar
        if (await birthdayTalk(id.name, id.voice)) return;
        // mid-hobby? they'll say so (and keep at it)
        if (a.pastime && a.busy) {
          ui.say(a.pastime.kind === 'fish' ? pick(FISHING_LINES) : pick(NETTING_LINES), { speaker: id.name, voice: id.voice });
          return;
        }
        if (HOLIDAY && !saidHoliday) {
          saidHoliday = true;
          ui.say(HOLIDAY_LINES[HOLIDAY.id], { speaker: id.name, voice: id.voice });
          return;
        }
        // a parcel with their name on it beats small talk
        if (S.state.errand?.to === id.name && S.countItem('parcel') === 0) {
          // (left it in the wardrobe? no parcel, no delivery)
          ui.say(`Is that… no. I thought for a second you had something for me. From ${S.state.errand.from}, maybe.`, { speaker: id.name, voice: id.voice });
          return;
        }
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
        // maybe there's a parcel that needs legs (two a day; friendship paces itself)
        const friend = FRIEND_OF[id.name];
        if (!S.state.errand && friend && ERRAND_ASKS[id.name] &&
            S.dailyCount('errands') < 2 &&
            Date.now() - (S.state.lastErrandAt || 0) > 240000 && Math.random() < 0.3) {
          const yes = await ui.ask(ERRAND_ASKS[id.name], [
            { label: '🎁 Of course', value: 'yes' },
            { label: 'Maybe later', value: null },
          ], { speaker: id.name, voice: id.voice });
          if (yes) {
            S.state.errand = { from: id.name, to: friend };
            S.bumpDaily('errands');
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

// Oasis Estates — A Planned Community. South-west, out past the chart's
// western edge, on an island that didn't happen so much as get approved: a
// flat oval of lawn mown in stripes, seven identical houses around a
// cul-de-sac, a strip of shops, a coffee place, a chicken place that is not
// chicken, and the CaMall. Camels, parrots, one brontosaurus family. Beverly
// Humphries is the president of the Homeowners' Association. Do not mess
// with Beverly.
//
// There is no ferry. The ferry is pending HOA approval. (A rowboat can land
// on the east beach; the HOA has not yet noticed rowboats.)
//
// Bell hook (do not resolve): the covenant forbids bells — doorbells, bike
// bells, wind chimes, the ice cream truck's song. Nobody knows why. The
// developer wrote it in: Moledecai Developments. Trader Polly's rings no bell
// at the till; Pico says "BRRRING" out loud instead.
//
// Layout is in pad-local (u, v): u east, v south, from the pad's center.
// The camera looks north, so everything that can faces south (+v).

import * as THREE from 'three';
import { OASIS_PAD, ISLAND8, WATER_Y, terrainHeight } from './terrain.js';
import * as zones from './zones.js';
import { register } from './interact.js';
import * as ui from './ui.js';
import * as S from './state.js';
import { kaching, sip, tone, blip } from './audio.js';
import { buildAnimal, animateGait } from './animals.js';
import { rand, turnToward } from './utils.js';
import { addIslandInfo, addZonePlace } from './fieldguide.js';
import { glowWindow } from './nightglow.js';
import { isNight, hourNow } from './calendar.js';
import { ITEMS } from './catalog.js';
import { makeWindow, makeHangingLamp } from './buildings.js';

function mat(color, rough = 0.88) {
  return new THREE.MeshStandardMaterial({ color, flatShading: true, roughness: rough });
}

function box(w, h, d, color) {
  const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat(color));
  m.castShadow = m.receiveShadow = true;
  return m;
}

function cyl(rt, rb, h, seg, color) {
  const m = new THREE.Mesh(new THREE.CylinderGeometry(rt, rb, h, seg), mat(color));
  m.castShadow = m.receiveShadow = true;
  return m;
}

function ball(r, color, detail = 0) {
  const m = new THREE.Mesh(new THREE.IcosahedronGeometry(r, detail), mat(color));
  m.castShadow = m.receiveShadow = true;
  return m;
}

function collectInteriorRoot(parent, startIndex) {
  const root = new THREE.Group();
  root.add(...parent.children.slice(startIndex));
  parent.add(root);
  return root;
}

// A painted sign: any colors, chunky rounded letters, auto-fit. (Box faces
// all carry the painting, so a sign on a roof reads from either side.)
function sign(lines, { w = 3.4, h = 0.8, d = 0.08, bg = '#fffaf0', fg = '#5b4a32', border = null, stripes = null, px = 512 } = {}) {
  const cv = document.createElement('canvas');
  cv.width = px;
  cv.height = Math.round(px * (h / w));
  const ctx = cv.getContext('2d');
  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, cv.width, cv.height);
  if (stripes) {
    // Sahara: black and white, vertical, very serious
    const n = 16;
    for (let i = 0; i < n; i += 2) {
      ctx.fillStyle = stripes;
      ctx.fillRect((i / n) * cv.width, 0, cv.width / n, cv.height);
    }
  }
  if (border) {
    ctx.strokeStyle = border;
    ctx.lineWidth = cv.height * 0.07;
    ctx.strokeRect(ctx.lineWidth / 2, ctx.lineWidth / 2, cv.width - ctx.lineWidth, cv.height - ctx.lineWidth);
  }
  const L = Array.isArray(lines) ? lines : [lines];
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  const slot = cv.height / L.length;
  L.forEach((text, i) => {
    const big = i === 0;
    let size = Math.round(slot * (big ? 0.72 : 0.58));
    do {
      ctx.font = `bold ${size}px ui-rounded, 'Segoe UI', system-ui, sans-serif`;
      size -= 2;
    } while (ctx.measureText(text).width > cv.width * 0.9 && size > 10);
    if (stripes) {
      // a white plate behind the letters, so the stripes don't eat them
      const tw = ctx.measureText(text).width;
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(cv.width / 2 - tw / 2 - 14, slot * i + slot * 0.18, tw + 28, slot * 0.64);
    }
    ctx.fillStyle = fg;
    ctx.fillText(text, cv.width / 2, slot * i + slot * 0.54);
  });
  const tex = new THREE.CanvasTexture(cv);
  tex.colorSpace = THREE.SRGBColorSpace;
  const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d),
    new THREE.MeshStandardMaterial({ map: tex, flatShading: true, roughness: 0.8 }));
  m.castShadow = m.receiveShadow = true;
  return m;
}

// ------------------------------------------------------------ the layout ----
const O = OASIS_PAD;
const GY = O.h; // the pad's height: everything here stands on the same lawn
const RING = { u: -4, v: 12, rIn: 5.5, rOut: 8.3 }; // the cul-de-sac (the HOA prefers "the Circle")
const BLVD = { v0: -11.5, v1: -8.5, u0: -18, u1: 27 }; // Oasis Parkway (NOT a road)
const SPUR = { u: -4, hw: 1.4 };                        // Circle Drive, from the Parkway down to the Circle
const LOT = { u0: -17, u1: 19, v0: -18.5, v1: -12 };    // the Commons lot
const HOUSE_R = 13;                                       // house centers, out from the Circle's middle
const PALM_V = BLVD.v1 + 0.5;

// interiors, off in the elsewhere: a column of their own at x = -300
const IN_Z0 = 600;
const IN = {
  mall: { x: -300, z: IN_Z0 },
  polly: { x: -300, z: IN_Z0 + 80 },
  drom: { x: -300, z: IN_Z0 + 160 },
  mirage: { x: -300, z: IN_Z0 + 240 },
  cluck: { x: -300, z: IN_Z0 + 320 },
};
const HOUSE_IN_Z0 = IN_Z0 + 400; // then the seven houses, 80 apart

// the pier, out the east end of the Parkway — and the Persistent calls
// there now (pending approval; she calls anyway). boats.js reads this; it's
// plain numbers, so creation order doesn't matter.
const PIER = { u0: 30.2, u1: 42, v: -10, w: 2.2, top: 0.62 };
export const OASIS_DOCK = {
  x: OASIS_PAD.x + PIER.u1 - 1.6, z: OASIS_PAD.z + PIER.v, rotY: -Math.PI / 2, // step off facing the island
  sea: { x: OASIS_PAD.x + PIER.u1 + 7, z: OASIS_PAD.z + PIER.v - 3 },
  buoyPos: new THREE.Vector3(OASIS_PAD.x + PIER.u1 - 4.8, 0, OASIS_PAD.z + PIER.v + 0.75), // (well clear of the sign: one prompt at a time)
};

const VOICE = {
  beverly: 330, harold: 250, gary: 150, linda: 190, junior: 200, kiwi: 620, dakota: 380,
  todd: 280, tiffany: 600, mildred: 360, phyllis: 400, bunny: 440, walt: 230,
  mango: 520, pico: 760, deb: 340, echo: 560, tanner: 300, paloma: 640, rico: 700,
  reggie: 540, sal: 480, auntie: 300, sunny: 580, chad: 290, madison: 470, dale: 170,
};

// who's talking, and what they say next: everybody works through their
// lines in order (so you hear them all), then starts again
const said = {};
function nextLine(key, lines) {
  const i = said[key] ?? 0;
  said[key] = (i + 1) % lines.length;
  return lines[i];
}
function talk(key, name, lines) {
  return () => ui.say(nextLine(key, lines), { speaker: name, voice: VOICE[key] ?? 480 });
}

const REGGIE = [
  'Name? … Name? … You’re not on the list. Nobody’s on the list. Go ahead.',
  'I keep the list. The list is blank. Some people would call that a slow day. I call it security.',
  'The boom’s up. The boom is always up. If I put it down people would have to walk around it and then they’d all have opinions. Up is easier.',
  'I repeat everything that comes through this gate. Everything. Nobody comes through this gate. It’s very peaceful.',
  'Beverly checks my log every evening. Blank, blank, blank. She says “good.” I think she means it.',
];

const NOTICES = [
  'NOTICE: Lawns are to be maintained at TWO AND ONE HALF (2½) INCHES. Not two. Not three. The President has a ruler and is not afraid of it.',
  'NOTICE: The following are prohibited under Article 9 of the Covenant (NOISE): doorbells, bicycle bells, wind chimes, dinner bells, sleigh bells, cowbells, and the song of the ice cream truck. The ice cream truck may still visit. It must do so in silence. It has been doing so in silence for eleven years. Nobody knows why Article 9 says what it says; it was in the deed. Please knock.',
  'NOTICE: The ferry proposal (submitted by Capt. Brine) is still under review. So is everything else. Thank you for your patience.',
  'LOST: one lawn flamingo, pink, answers to nothing. Last seen in the Wests’ yard. Beverly has concerns. — Mildred',
  'REMINDER: Band practice (NO OUTLET) is permitted Tuesdays, 2:00–4:00 p.m., in the Bronto garage, at a volume “consistent with the character of the community.” The character of the community is quiet.',
  'YARD OF THE MONTH: The Humphries. (Forty-one months running. Nominations are open to all residents. The President nominated herself. Seconded: the President.)',
  'NOTICE: Holiday decorations permitted December 1 – January 2. Approved colors: white. Approved lights: white, steady. No blinking. No inflatables. No inflatables. NO INFLATABLES. — B.H.',
  'FOR SALE: a Standard (the Open House, on the Circle). 4 bed, 3 bath, exactly like the others, which is the selling point. Inquire with Tiffany, who will be there. She is always there.',
];

// ------------------------------------------------------------ voices ----
// Beverly Humphries, HOA President. Catty, serious, and not to be messed
// with — but never cruel: she wants nothing on this island ever blown
// away again, and she has decided the way to do that is rules.
const BEVERLY = [
  'Oh. You’re new. I can always tell. It’s the lantern. Is that… approved? I don’t recall approving it. I’ll allow it. For now. I’m writing that down.',
  'Two and a half inches. The grass. Not two. Not three. Two and a half. I have a ruler, and I am not afraid of it.',
  'I don’t make the rules. I enforce them. I also made them. It’s a lot of work, but somebody has to be this way.',
  'Forty-one Yards of the Month. In a row. It’s not a competition. If it were a competition, I would be winning it. I am winning it.',
  'The Bronto boy’s band has a permit. Tuesdays, two to four. And yet I hear them every single day. Apparently it’s always Tuesday somewhere. I have it written down. All of it.',
  'Todd mows beautifully. Todd mows beautifully because I watch Todd mow.',
  'A ferry. Fourteen applications, from a goose. The horn is too loud. The boat is too loud. The sea is, frankly, very loud. It’s under review. … She ties up at my pier anyway. Every day. I’ve cited the boat. The boat does not care.',
  'Article Nine. No bells. No, I don’t know why. It’s in the deed; the developer wrote it. Moledecai-something. You don’t question a deed, dear. You enforce a deed.',
  'Mildred has a flamingo. A pink plastic flamingo. In her front yard. Three notices. It hasn’t moved. It watches me. I watch it back.',
  'Before the lawns, the wind used to take everything off this island. Lawn chairs. Laundry. A whole gazebo, once. Now we have rules, and nothing has blown away in thirty years. You’re welcome.',
];
const HAROLD = [
  'Oh — hello. Beverly’s out. Beverly is always out. She’s the most out person I know.',
  'I mow our lawn. She tells me where. Forty-one months, the system’s worked.',
  'She’s softer than she seems. She keeps a list of everyone’s birthdays. She files it under “Violations,” so nobody finds it.',
  'I was on the Board once. For an afternoon. Longest afternoon of my life. I resigned by letter. She approved it. Very promptly.',
  'You’re welcome to read the covenant. Four binders, on the counter. There’s a very good part in Volume Three about mailboxes. Mailboxes and me, we’ve been through a lot.',
];
const COVENANT = [
  'ARTICLE 2 (LAWNS): All lawns shall be maintained at two and one-half (2½) inches, green, and mown in stripes running north–south, “as God and the Board intended.”',
  'ARTICLE 4 (HOMES): All homes shall be the Standard. Doors shall be Taupe, Oat, or Greige. A resident wishing to paint a door any other color may submit a request in writing, which will be read aloud at the Annual Meeting, slowly.',
  'ARTICLE 9 (NOISE): No bells. No doorbells, bicycle bells, wind chimes, cowbells, dinner bells, or musical trucks. Residents shall knock. (Margin, in pencil, very old: “ask Moledecai why.” Beneath it, in pen, newer: “Do not.”)',
  'ARTICLE 11 (MAILBOXES): Black. Post white. Flag red. The flag shall be raised only in the presence of outgoing mail and lowered with dignity.',
  'ARTICLE 14 (FLAMINGOS): See Attachment F. (Attachment F is eleven pages long and unsigned.)',
  'ARTICLE 17 (WEATHER): Residents shall secure all outdoor furniture, gazebos, and laundry, in memory of the Squall, which took everything, and which the Board has not forgiven.',
];
const SAL = [
  'PARROTS OF THE WORLD. PARROTS OF THE WORLD. … Oh! Hello. I was just repeating the television.',
  '“The scarlet macaw is a social bird.” THE SCARLET MACAW IS A SOCIAL BIRD. They’re right, you know. I’m very social. I’m socializing right now.',
  'In my day we didn’t have cable. We had a window and a lot of opinions. I still have the opinions.',
  'My grandson’s in the band. The band! In the garage! “No Outlet.” I told him that’s a street sign. He said that’s the POINT, Grandpa. Kids.',
];
const SUNNY = [
  'Hi, hon! Want something to drink? We have iced tea, and iced tea, and a very nice iced tea.',
  'Kiwi’s in the Brontos’ garage with the band. I can hear them from here. I can hear them from everywhere. I’m so proud I could scream. Kiwi screams, actually. It’s the style.',
  'Dad repeats the TV. Kiwi repeats Dad. I repeat everything to Beverly, because she asks. It’s a very repetitive house. We like it that way.',
];
const LINDA = [
  'Gary’s grilling. Gary is always grilling. I have never once seen a burger come off that grill. I’ve stopped asking. It makes him happy.',
  'Go, team! … I don’t know which one is ours. I just like the green part.',
  'Junior says he’s leaving town. I packed him a lunch. It’s a big lunch. It’s a long swim.',
  'Mind your head on the way out, dear. Oh — you’re fine. It’s Gary who has to mind his head. Gary minds his head on everything.',
];
const TWINS = [
  'Shh! It’s the good part.',
  'It’s ALL the good part.',
  'Dad’s mowing again. Dad’s always mowing. When we grow up we’re gonna mow the OCEAN.',
  'Captain Crunchbeak is gonna escape from the Evil Lawn this time. We can feel it. Two hundred and twelve episodes, and we can FEEL it.',
];
const DUNES2 = [
  [{ speaker: 'Chad', voice: 290, text: 'We moved here for the schools!' }, { speaker: 'Madison', voice: 470, text: 'There aren’t any schools, Chad.' }, { speaker: 'Chad', voice: 290, text: 'For when there are schools.' }],
  [{ speaker: 'Chad', voice: 290, text: 'Honey, where’s the — ' }, { speaker: 'Madison', voice: 470, text: 'Box twelve.' }, { speaker: 'Chad', voice: 290, text: 'Which one’s box twelve?' }, { speaker: 'Madison', voice: 470, text: 'They’re all box twelve.' }],
  [{ speaker: 'Madison', voice: 470, text: 'Hot yoga at six, cold brew at seven, stroller walk at eight. I have a system. The system is Mirage.' }],
  [{ speaker: 'Chad', voice: 290, text: 'I’m a dad now. I got the vest. The vest kind of came with the dad.' }],
  [{ speaker: 'Madison', voice: 470, text: 'The baby’s name is Sahara. Like the store. It’s where we had our first date.' }, { speaker: 'Chad', voice: 290, text: 'She sprayed me with a tester.' }, { speaker: 'Madison', voice: 470, text: 'He smelled like a mood for a week.' }],
];
const WALT = [
  'Mildred’s at the mall. Mildred is always at the mall. She’s walked to the moon and back, she says. In laps.',
  'It’s golf. I don’t play it. I just like how quiet everybody is about it. Whole crowd whispering about one little ball. That’s my speed.',
  'The flamingo’s name is Dolores. Beverly wants her gone. Dolores stays. Some hills you die on. Some hills have a flamingo on them.',
  'Take a butterscotch. They’re from ’94. They’re fine. Butterscotch is forever.',
];
const MILDRED = [
  'Oh, hello, dear! Home from laps. Forty laps. Eleven’s a mile. We don’t talk about how long it takes.',
  'Did Walt offer you a butterscotch? Take two. Take the dish. Walt, give them the dish.',
  'Dolores is my flamingo. Beverly’s sent three notices. I keep them in a nice folder. I’ll send her one back someday. On pink paper.',
];
const GARY = [
  'Burgers are almost ready! They’ve been almost ready since noon. That’s grilling, pal. It’s a state of mind.',
  'Being tall has its perks. I can see over every fence on the Circle. Mostly what I see is Beverly coming. Heads up — she’s coming.',
  'That’s my boy Junior in the garage. Bass guitar. Says they’re getting out of this town. I said, “Son, it’s an island.” He said, “EXACTLY, Dad.” I don’t know what it means, but I’m proud of him.',
  'Linda says I have to stop cleaning the gutters for the whole street. But who else is gonna do it? Todd? Todd’s four feet tall.',
  'You want a burger? … They’re not ready. But you’re welcome to want one.',
  'The veggie patties come from the same people who make the nuggets. Nobody knows what’s in either. I respect a mystery.',
];
const TODD = [
  'Two and a half inches! Every Saturday. And Wednesday. And today. You can never be too sure.',
  'The stripes are the whole thing. Anybody can cut grass. The stripes are how you know somebody cared.',
  'I mow the common green, the Circle, the pool lawn, and my own. Then I mow Harold’s, because Harold mows Beverly’s, and somebody has to mow Harold. That’s community.',
  'The kids? Inside. Screens. I was the same at their age. Except with lawns.',
  'Hear that? That’s a mower that’s been serviced. Listen. … Beautiful.',
];
const TIFFANY = [
  'Welcome, welcome! Open house! Today only! (Every day.) Four bed, three bath, exactly like the others — which is the selling point.',
  'Look at this kitchen. Now imagine YOUR family in this kitchen. Now imagine them exactly like every other family in every other kitchen. Isn’t that peace?',
  'It’s been on the market since the island was graded. The price is very fair. The price has always been very fair. Nobody has ever asked the price. I’m ready, though. I am SO ready.',
  'Great schools! … Well. There aren’t schools. But imagine if there were. That’s what I sell, darling. Imagination. With granite countertops.',
];
const KIDS = [
  'Push me! Higher! No, higher! No — okay, that’s high enough. That’s too high. PUSH ME.',
  'We’re not allowed in the pool. Nobody’s allowed in the pool. We’re allowed on the swings from ten to five. It’s ten to five somewhere.',
  'My big brother’s in a band. They’re getting out of this town. I’m gonna get out of this town too. After snack.',
];
const BAND = [
  [['Kiwi', 'We’re No Outlet. We’re getting out of this town.'], ['Junior', 'Out of this town.'], ['Dakota', 'Out. Of. This. Town.']],
  [['Kiwi', 'Where to? … OUT. There’s a whole ocean. Have you SEEN it? It’s so big, and it doesn’t have an HOA.']],
  [['Dakota', 'Our first single is called “Cul-de-Sac.” It goes around and around and it doesn’t lead anywhere.'], ['Kiwi', 'That’s the point.'], ['Junior', 'That’s the whole point.']],
  [['Junior', 'The ferry’s pending approval. So we’re gonna swim.'], ['Kiwi', 'We’re practicing first.'], ['Dakota', 'In the pool.'], ['Kiwi', 'Nobody’s allowed in the pool.'], ['Junior', '…So we’re practicing on the lawn.']],
  [['Kiwi', 'We have a noise permit. Tuesdays, two to four. Every day is Tuesday if you believe in something.']],
  [['Dakota', 'My mom says it’s a phase.'], ['Kiwi', 'Everything’s a phase. The MOON is a phase.'], ['Junior', 'Whoa.']],
  [['Kiwi', 'Beverly came to our show. She stood at the end of the driveway with her arms crossed for the entire set.'], ['Dakota', 'She tapped her foot.'], ['Junior', 'She tapped her foot, man.']],
];
const PICO = [
  'BRRRING! … Sorry. Habit. Somebody needed help at register two. It was me. I’m register two.',
  'Paper or paper? We only have paper. The choice is ceremonial.',
  'BRRRING BRRRING! That’s two, for “price check.” I did the price check. It’s fine. It’s always fine.',
  'Want a sticker? Everybody gets a sticker. Grownups too. ESPECIALLY grownups. They need it the most.',
];
const MANGO = [
  'Ahoy! Welcome aboard Trader Polly’s! I’m the Captain. That’s a real title here. Everybody’s crew. You’re crew now. Welcome to the crew.',
  'We don’t have a bell. The covenant. So when we need help at the till, Pico says it. You’ll hear it. You’ll never unhear it.',
  'Everything But The Bell. Flies off the shelves. Folks ask what’s missing. I say, “The bell.” They say, “Why?” I say, “Aisle four.” There is nothing in aisle four. It works every time.',
  'The Fearless Feather! Our newsletter! Every issue, there’s a letter asking why there’s no bell. I haven’t answered it yet. I’m building suspense. Eleven years of suspense.',
  'Yes, I’m a parrot named Mango, and yes, I sell dried mango. We’ve all made our peace with it. Mostly me.',
];
const DEB = [
  'Welcome to Dromedeals. Brand names, one hump or two. Look around. Don’t look FOR anything — you’ll never find it. Look for something else, and then you’ll find it.',
  'Compare-at prices are a feeling, hon. That visor COULD have cost nine hundred. In another life. We saved you from that life.',
  'Everything’s on a rack, and the racks are arranged by nothing. That’s the treasure hunt. That’s the Dromedeal.',
  'Mildred, Phyllis and Bunny were in at opening. Bought three visors. Same visor. Identical. That’s friendship.',
];
const ECHO = [
  'Hi! Welcome to Mirage! What can I get started for you? … Sorry. I say that to everybody. I’ll say it to you again in a second.',
  'It’s called Mirage because the drinks are exactly what you imagined. Or you imagined them. Either way, you’ll love them.',
  'Sizes are Small, Medium, and Dune.',
  'I repeat every order back. Every word. Every “um.” It’s a parrot thing. It’s also a barista thing. It’s two things, and I’m the overlap.',
];
const TANNER = [
  'Welcome to Cluck & Co.! How can I serve you today? … It would be my pleasure.',
  'It’s not chicken. It’s never been chicken. It’s “chick’n.” Nobody knows what the apostrophe is doing. It’s doing its best.',
  'We’re closed Sundays. We rest. You should rest too. You look like you rowed here.',
  'My pleasure! … Sorry, you didn’t say anything yet. I get ahead of myself. It’s my pleasure to get ahead of myself.',
  'The cow on the roof holds the sign. She can spell. She’s making a choice.',
];
const PALOMA = [
  'Welcome to Sahara, babe. Are we shopping, or are we just being seen? Both are valid. Both are the store.',
  'Everything in here is a mood. That one’s “Oasis at Dusk.” That one’s “Lawn, Freshly Mown.” That one’s just called “Beverly.” It’s very strong. Nobody buys it. Everybody tests it.',
  'I contour with sand. Real sand. From the beach. It’s free, it’s local, and it’s everywhere, babe. Everywhere.',
];
const RICO = [
  'Excuse me! Excuse me — can I ask you a question? … Do you have hands? Amazing. Me too. Let me show you something for your hands.',
  'This is Dead Sand lotion. From the Dead Sand. It’s a sand. That died. It’s VERY moisturizing. Nobody knows why. That’s the science.',
  'Okay, okay, you don’t want lotion. Nobody wants lotion. But what if the lotion … wants YOU? Think about it. Take your time. I’ll be here. I’m always here.',
  'The mall walkers go past me forty times a day. Forty “can I ask you a question”s. Forty “no, dear”s. It’s the most reliable relationship I have.',
];
const AUNTIE = [
  'Pretzel, sugar? Soft, warm, salt like sand. Twisted by hand. My hand. This one.',
  'The walkers get the broken ones free. Some days more of them break than others. We don’t talk about that.',
  'I’ve been twisting pretzels since the lawn went in. Before that I twisted other things. Rope, mostly. For the gazebos. We lost a lot of gazebos.',
];
const DALE = [
  'Mall security. I patrol. On the segway. Nobody’s ever done anything in this mall except walk, but I’m ready. I’m SO ready.',
  'No running. That’s the one rule. The walkers skirt it. That’s power walking. There’s a difference. I’ve looked into it.',
  'The segway was a gift from the HOA. Beverly said, “Dale, you’ll never be fast. But you can be steady.” Best thing anyone’s ever said to me.',
];
const WALKERS = [
  [['Phyllis', 'Pick up the pace, Bunny.'], ['Bunny', 'I AM picking it up. This is my picked-up pace.'], ['Mildred', 'Girls.']],
  [['Phyllis', 'Did you hear about the ferry?'], ['Bunny', 'Pending approval.'], ['Mildred', 'Everything’s pending approval.'], ['Phyllis', 'My HIP is pending approval.']],
  [['Bunny', 'I bought this visor at Dromedeals. Compare at nine hundred. I paid thirty. I have never felt so alive.'], ['Phyllis', 'We all bought that visor, Bunny.'], ['Bunny', 'And we’ve all felt alive.']],
  [['Mildred', 'We’ve walked past Hot Tropic four thousand times. We’ve never gone in.'], ['Phyllis', 'We’re not ready.'], ['Bunny', 'We’ll never be ready.']],
  [['Mildred', 'Eleven laps is a mile, dear. We do forty. Join us! Keep up! Or don’t — we’ll come round again.']],
  [['Phyllis', 'Rico asked me if I have hands again.'], ['Bunny', 'What did you say?'], ['Phyllis', 'I said, “Not for you, Rico.”'], ['Mildred', 'Every day, girls. Every single day.']],
];
const BAND_VOICE = { Kiwi: 620, Junior: 200, Dakota: 380 };

export function createOasis(player) {
  const group = new THREE.Group();
  let h0Swings = null, h0Seesaw = null; // (the playground moves when kids are on it)
  const outdoor = [];          // island-zone updates
  const inside = {};           // zone name -> [update fns]
  const W = (u, v) => ({ x: O.x + u, z: O.z + v });
  // put a thing on the lawn at (u, v), turned ry
  function put(obj, u, v, y = 0, ry = 0) {
    obj.position.set(O.x + u, GY + y, O.z + v);
    obj.rotation.y = ry;
    group.add(obj);
    return obj;
  }
  // a little brimmed cap for folk in uniform
  function capOn(animal, color) {
    const head = animal.userData.parts.head;
    const c = new THREE.Group();
    const top = cyl(0.36, 0.32, 0.18, 9, color);
    top.position.y = 0.06;
    const brim = box(0.42, 0.04, 0.26, 0x1d2738);
    brim.position.set(0, -0.02, 0.36);
    c.add(top, brim);
    c.position.y = 0.33;
    head.add(c);
    return c;
  }
  function solidBox(u, v, w, d, ry = 0, kind) {
    zones.addBlockerBox(O.x + u, O.z + v, w, d, ry, 0, kind);
  }
  function solidDisc(u, v, r, kind) {
    zones.addBlocker(O.x + u, O.z + v, r, kind);
  }
  // local (lx, lz) in a frame at (u, v) turned ry -> pad (u, v)
  function local(u, v, ry, lx, lz) {
    const c = Math.cos(ry), s = Math.sin(ry);
    return [u + lx * c + lz * s, v - lx * s + lz * c];
  }

  addIslandInfo({
    key: 'oasis',
    name: 'Oasis Estates', x: ISLAND8.x, z: ISLAND8.z, r: 40, icon: '🏡',
    blurb: 'A Planned Community. Seven identical houses around the Circle, lawns at two and a half inches, the Commons (Trader Polly’s, Dromedeals, Mirage Coffee, Cluck & Co.), and the CaMall. The ferry is pending HOA approval.',
    folk: 'Beverly Humphries (HOA President) · the Humphries, the Featherstones, the Brontos, Todd, the Dunes, Mildred & Walt · Captain Mango · Deb · Echo · Tanner · No Outlet (a band)',
    mystery: '“Past the Labs, south and west, there’s an island where every house is the same house. I sailed by twice to be sure. Same house. Same lawn. A camel with a clipboard watched me the whole way.” —Captain Brine',
  });

  // ================================================== paving (NOT roads) ----
  // flat slabs laid on the lawn: asphalt for the Parkway, the Circle and the
  // lot; pale concrete for sidewalks, driveways, walks
  const ASPHALT = 0x5d5e63, CONCRETE = 0xd8d3c6, CURB = 0xe8e4d8, PAINT = 0xf3efe2;
  function slab(u, v, w, d, color, y = 0.03, ry = 0) {
    const m = new THREE.Mesh(new THREE.BoxGeometry(w, 0.06, d), mat(color, 0.95));
    m.receiveShadow = true;
    return put(m, u, v, y, ry);
  }
  // the Parkway, east to west, with a rounded west end and a dashed middle
  {
    const len = BLVD.u1 - BLVD.u0, cu = (BLVD.u0 + BLVD.u1) / 2, cv = (BLVD.v0 + BLVD.v1) / 2;
    slab(cu, cv, len, BLVD.v1 - BLVD.v0, ASPHALT);
    const endcap = new THREE.Mesh(new THREE.CylinderGeometry(1.5, 1.5, 0.06, 12), mat(ASPHALT, 0.95));
    endcap.receiveShadow = true;
    put(endcap, BLVD.u0, cv, 0.03);
    for (let u = BLVD.u0 + 2; u < BLVD.u1 - 1; u += 2.4) slab(u, cv, 1.1, 0.12, 0xf2cf5b, 0.065);
    // sidewalk along the south side, and a curb along the north (the lot)
    slab(cu - 0.5, BLVD.v1 + 0.5, len - 1, 1.0, CONCRETE, 0.04);
  }
  // the lot, lined, with a cart corral
  {
    const cu = (LOT.u0 + LOT.u1) / 2, cv = (LOT.v0 + LOT.v1) / 2;
    slab(cu, cv, LOT.u1 - LOT.u0, LOT.v1 - LOT.v0, ASPHALT);
    slab(cu, LOT.v0 + 0.5, LOT.u1 - LOT.u0, 1.0, CONCRETE, 0.05); // the walk along the shopfronts
    for (let u = LOT.u0 + 1.5; u < LOT.u1 - 1; u += 2.6) {
      if (Math.abs(u - (-4)) < 1.5) continue; // the aisle down the middle
      slab(u, LOT.v0 + 2.9, 0.12, 2.6, PAINT, 0.065);
      slab(u, LOT.v1 - 1.5, 0.12, 2.6, PAINT, 0.065);
    }
  }
  // Circle Drive and the Circle: an asphalt ring around a round green
  {
    slab(SPUR.u, (BLVD.v1 + RING.v - RING.rOut + 0.4) / 2, SPUR.hw * 2, RING.v - RING.rOut + 0.4 - BLVD.v1, ASPHALT);
    const ringGeo = new THREE.RingGeometry(RING.rIn, RING.rOut, 40, 1);
    ringGeo.rotateX(-Math.PI / 2);
    const ring = new THREE.Mesh(ringGeo, mat(ASPHALT, 0.95));
    ring.receiveShadow = true;
    put(ring, RING.u, RING.v, 0.06);
    const curbGeo = new THREE.TorusGeometry(RING.rIn, 0.12, 4, 40);
    curbGeo.rotateX(-Math.PI / 2);
    const curb = new THREE.Mesh(curbGeo, mat(CURB));
    curb.receiveShadow = true;
    put(curb, RING.u, RING.v, 0.05);
  }

  // ======================================================== the Standard ----
  // Every house at Oasis Estates is the Standard: a one-storey main house
  // with a gable roof and an attached garage. Same walls (Sand), same roof,
  // same shrubs, same mailbox. Doors come in the three approved colors.
  // Local frame: front faces +z. Main block x -3.7..0.9, garage 0.9..3.7.
  const WALL = 0xe8dcc4, ROOF = 0x8c7f72, TRIM = 0xfaf6ec;
  const HD = 4.2; // house depth
  function prismRoof(len, depth, h, color) {
    const r = (depth + 0.7) / 1.73;
    const geo = new THREE.CylinderGeometry(r, r, len, 3, 1, false, Math.PI / 2);
    geo.rotateZ(Math.PI / 2);
    const m = new THREE.Mesh(geo, mat(color));
    m.scale.y = h / (r * 1.5);
    m.castShadow = m.receiveShadow = true;
    return m;
  }
  function makeStandard({ door = 0xb9a58a, garageOpen = false } = {}) {
    const g = new THREE.Group();
    const found = box(garageOpen ? 4.8 : 7.6, 0.6, HD + 0.2, 0xc9bda6);
    found.position.set(garageOpen ? -1.4 : 0, -0.2, 0);
    g.add(found);
    const main = box(4.6, 2.8, HD, WALL);
    main.position.set(-1.4, 1.4, 0);
    g.add(main);
    const roof = prismRoof(5.1, HD, 1.5, ROOF);
    roof.position.set(-1.4, 2.8 + 0.42, 0);
    g.add(roof);
    // the garage: lower, a roof of its own, a big paneled door
    if (garageOpen) {
      // hollow: a back wall, an east wall, a floor — somebody's in there
      for (const [w, d, x, z] of [[2.8, 0.2, 2.3, -HD / 2 + 0.1], [0.2, HD - 0.2, 3.6, -0.1]]) {
        const wl = box(w, 2.2, d, WALL);
        wl.position.set(x, 1.1, z);
        g.add(wl);
      }
      const gfloor = box(2.6, 0.12, HD - 0.4, 0xa8a49a);
      gfloor.position.set(2.3, 0.06, -0.1);
      g.add(gfloor);
      const ceil = box(2.8, 0.1, HD - 0.2, 0xe8e0cc);
      ceil.position.set(2.3, 2.2, -0.1);
      g.add(ceil);
    } else {
      const gar = box(2.8, 2.2, HD - 0.2, WALL);
      gar.position.set(2.3, 1.1, -0.1);
      g.add(gar);
    }
    const groof = prismRoof(3.1, HD - 0.2, 1.0, ROOF);
    groof.position.set(2.3, 2.2 + 0.3, -0.1);
    g.add(groof);
    if (garageOpen) {
      const upDoor = box(2.2, 0.08, 1.6, TRIM); // rolled up under the ceiling
      upDoor.position.set(2.3, 1.95, HD / 2 - 0.9);
      g.add(upDoor);
    } else {
      const gd = box(2.2, 1.7, 0.08, TRIM);
      gd.position.set(2.3, 0.85, HD / 2 - 0.06);
      g.add(gd);
      for (let i = 1; i < 4; i++) {
        const groove = box(2.2, 0.04, 0.1, 0xd8d0c0);
        groove.position.set(2.3, i * 0.42, HD / 2 - 0.04);
        g.add(groove);
      }
    }
    // front door under a little pediment, two round windows, a porch step
    const doorMesh = box(0.95, 1.75, 0.12, door);
    doorMesh.position.set(-1.9, 0.875 + 0.1, HD / 2 + 0.02);
    g.add(doorMesh);
    const knob = ball(0.06, 0xf2cf5b);
    knob.position.set(-1.6, 0.95, HD / 2 + 0.12);
    g.add(knob);
    const ped = prismRoof(1.6, 0.4, 0.4, TRIM);
    ped.rotation.y = 0;
    ped.position.set(-1.9, 2.15, HD / 2 + 0.2);
    g.add(ped);
    const step = box(1.6, 0.2, 0.7, CONCRETE);
    step.position.set(-1.9, 0.1, HD / 2 + 0.35);
    g.add(step);
    for (const wx of [-3.1, -0.4]) {
      const w = makeWindow(0.38);
      w.position.set(wx, 1.6, HD / 2 + 0.02);
      g.add(w);
      // shutters: the approved accent, on every window, forever
      for (const sx of [-0.6, 0.6]) {
        const sh = box(0.18, 1.0, 0.06, 0x8c7f72);
        sh.position.set(wx + sx, 1.6, HD / 2 + 0.03);
        g.add(sh);
      }
    }
    const side = makeWindow(0.34);
    side.rotation.y = -Math.PI / 2;
    side.position.set(-3.72, 1.6, 0);
    g.add(side);
    // two shrubs, trimmed round, one each side of the door
    for (const sx of [-3.2, -0.6]) {
      const shrub = ball(0.42, 0x3f9a45, 1);
      shrub.scale.y = 0.85;
      shrub.position.set(sx, 0.36, HD / 2 + 0.55);
      g.add(shrub);
    }
    g.traverse((o) => { if (o.isMesh) { o.castShadow = true; o.receiveShadow = true; } });
    return g;
  }
  // the mailbox: black, identical, at the curb (a flag, never a bell)
  function mailbox(u, v, ry) {
    const g = new THREE.Group();
    const post = box(0.1, 0.95, 0.1, 0xf3efe2);
    post.position.y = 0.475;
    const body = box(0.3, 0.26, 0.5, 0x2a2a2e);
    body.position.y = 1.05;
    const lid = new THREE.Mesh(new THREE.CylinderGeometry(0.15, 0.15, 0.5, 8, 1, false, 0, Math.PI), mat(0x2a2a2e));
    lid.rotation.set(Math.PI / 2, 0, Math.PI / 2);
    lid.position.y = 1.18;
    const flag = box(0.03, 0.26, 0.1, 0xc0392b);
    flag.position.set(0.17, 1.14, -0.1);
    g.add(post, body, lid, flag);
    g.traverse((o) => { if (o.isMesh) o.castShadow = o.receiveShadow = true; });
    put(g, u, v, 0, ry);
    solidDisc(u, v, 0.22);
  }

  // =========================================================== greenery ----
  // palms along the Parkway, evenly spaced (the HOA measured), and a few
  // round trees in the yards
  function palm(u, v, h = 3.6, lean = 0.08) {
    const g = new THREE.Group();
    const n = 5;
    for (let i = 0; i < n; i++) {
      const seg = cyl(0.17 - i * 0.015, 0.2 - i * 0.015, h / n + 0.05, 6, i % 2 ? 0xa0835f : 0x8f7352);
      seg.position.set(Math.sin(lean) * (i + 0.5) * (h / n), (i + 0.5) * (h / n), 0);
      seg.rotation.z = -lean;
      g.add(seg);
    }
    const top = new THREE.Vector3(Math.sin(lean) * h, h, 0);
    for (let i = 0; i < 6; i++) {
      const a = (i / 6) * Math.PI * 2 + 0.3;
      const frond = new THREE.Mesh(new THREE.ConeGeometry(0.34, 1.9, 4), mat(i % 2 ? 0x3f9a45 : 0x4fae52));
      frond.scale.set(1, 1, 0.25);
      frond.position.set(top.x + Math.cos(a) * 0.8, top.y - 0.15, top.z + Math.sin(a) * 0.8);
      frond.rotation.order = 'YZX';
      frond.rotation.y = -a;
      frond.rotation.z = -Math.PI / 2 - 0.35;
      frond.castShadow = true;
      g.add(frond);
    }
    const nuts = ball(0.16, 0x6b5a3a);
    nuts.position.set(top.x, top.y - 0.25, top.z);
    g.add(nuts);
    put(g, u, v);
    solidDisc(u, v, 0.28, 'tree');
    return g;
  }
  function roundTree(u, v, s = 1) {
    const g = new THREE.Group();
    const trunk = cyl(0.14 * s, 0.18 * s, 1.4 * s, 6, 0x7a5a3a);
    trunk.position.y = 0.7 * s;
    const crown = ball(1.0 * s, 0x4c9c47, 1);
    crown.position.y = 1.9 * s;
    g.add(trunk, crown);
    put(g, u, v);
    solidDisc(u, v, 0.3 * s, 'tree');
  }
  for (let u = BLVD.u0 + 3; u <= BLVD.u1 - 2; u += 5) {
    if (Math.abs(u - SPUR.u) < 2.5) continue; // not in the mouth of Circle Drive
    palm(u, PALM_V + 0.3, 3.6, 0.06);
  }

  // ============================================================= cars ----
  // They are parked. Nobody has seen them driven. There are no roads (see
  // the signs). The HOA considers the matter closed.
  function car(u, v, ry, color, { van = false } = {}) {
    const g = new THREE.Group();
    const L = van ? 3.6 : 3.3;
    const body = box(1.8, 0.7, L, color);
    body.position.y = 0.6;
    const cab = box(1.6, van ? 0.8 : 0.6, van ? 2.6 : 1.7, color);
    cab.position.set(0, van ? 1.35 : 1.25, van ? -0.3 : -0.2);
    const glass = box(1.62, 0.4, van ? 0.2 : 1.0, 0xbfe6f2);
    glass.position.set(0, van ? 1.4 : 1.3, van ? 1.0 : 0.4);
    g.add(body, cab, glass);
    for (const [sx, sz] of [[-1, 1], [1, 1], [-1, -1], [1, -1]]) {
      const wheel = new THREE.Mesh(new THREE.CylinderGeometry(0.3, 0.3, 0.2, 8), mat(0x2e2a26));
      wheel.rotation.z = Math.PI / 2;
      wheel.position.set(sx * 0.92, 0.3, sz * (L / 2 - 0.65));
      g.add(wheel);
    }
    for (const sx of [-0.55, 0.55]) {
      const lamp = box(0.3, 0.14, 0.05, 0xfff3c0);
      lamp.position.set(sx, 0.72, L / 2 + 0.01);
      g.add(lamp);
    }
    g.traverse((o) => { if (o.isMesh) o.castShadow = o.receiveShadow = true; });
    put(g, u, v, 0, ry);
    solidBox(u, v, 2.2, L + 0.1, ry); // (the wheels stick out a little)
    return g;
  }

  // ======================================================= the houses ----
  // Seven Standards around the Circle, each facing its middle. Who lives
  // where is below; everything else about them is identical, by covenant.
  const TAUPE = 0xa8957c, OAT = 0xc9b79a, GREIGE = 0xb3ab9e; // the approved door colors
  const HOUSES = [
    { id: 'humphries', name: 'The Humphries', deg: -135, door: TAUPE },
    { id: 'featherstones', name: 'The Featherstones', deg: -45, door: OAT },
    { id: 'brontos', name: 'The Brontos', deg: 0, door: GREIGE, garageOpen: true },
    { id: 'todd', name: 'Todd’s', deg: 45, door: OAT },
    { id: 'openhouse', name: 'The Open House', deg: 90, door: GREIGE },
    { id: 'dunes', name: 'The Dunes', deg: 135, door: TAUPE },
    { id: 'mildred', name: 'Mildred & Walt’s', deg: 180, door: OAT },
  ];
  const FENCE = 0xc9a77a;
  for (const h of HOUSES) {
    const th = (h.deg * Math.PI) / 180;
    h.u = RING.u + Math.cos(th) * HOUSE_R;
    h.v = RING.v + Math.sin(th) * HOUSE_R;
    h.ry = Math.atan2(-Math.cos(th), -Math.sin(th)); // front door faces the Circle
    const L = (lx, lz) => local(h.u, h.v, h.ry, lx, lz);
    h.L = L;
    h.mesh = put(makeStandard(h), h.u, h.v, 0, h.ry);
    if (h.garageOpen) {
      const [mu0, mv0] = L(-1.4, 0);
      solidBox(mu0, mv0, 4.8, HD + 0.2, h.ry);
      const [bu0, bv0] = L(2.3, -HD / 2 + 0.1);
      solidBox(bu0, bv0, 2.9, 0.3, h.ry);
      const [eu0, ev0] = L(3.6, -0.1);
      solidBox(eu0, ev0, 0.3, HD - 0.2, h.ry);
    } else {
      solidBox(h.u, h.v, 7.6, HD + 0.2, h.ry);
    }
    // the porch step, the walk to the curb, the driveway
    const [su, sv] = L(-1.9, HD / 2 + 0.35);
    zones.addSurfaceBox(O.x + su, O.z + sv, 1.6, 0.7, GY + 0.2, h.ry);
    const toCurb = HOUSE_R - RING.rOut; // from the house's middle to the Circle's edge
    const walkLen = toCurb - HD / 2 - 0.7;
    const [wu, wv] = L(-1.9, HD / 2 + 0.7 + walkLen / 2);
    slab(wu, wv, 0.9, walkLen, CONCRETE, 0.04, h.ry);
    const dLen = toCurb - HD / 2 + 0.2;
    const [du, dv] = L(2.3, HD / 2 + dLen / 2);
    slab(du, dv, 2.6, dLen, CONCRETE, 0.035, h.ry);
    const [mu, mv] = L(-3.4, toCurb - 0.3);
    mailbox(mu, mv, h.ry);
    for (const sx of [-3.2, -0.6]) { const [bu, bv] = L(sx, HD / 2 + 0.55); solidDisc(bu, bv, 0.45); } // the shrubs
    // the backyard: a wooden fence, three sides, a gate-gap by the garage
    const fz0 = -HD / 2, fz1 = -HD / 2 - 3.4;
    const fenceBits = [
      [0, fz1, 7.8, 0.12],                      // the back
      [-3.9, (fz0 + fz1) / 2, 0.12, fz0 - fz1], // the main-house side
      [3.9, fz1 + 1.1, 0.12, 2.2],              // the garage side (the gap is the gate)
    ];
    for (const [lx, lz, w, d] of fenceBits) {
      const f = box(w, 1.1, d, FENCE);
      const [fu, fv] = L(lx, lz);
      put(f, fu, fv, 0.55, h.ry);
      solidBox(fu, fv, Math.max(w, 0.2), Math.max(d, 0.2), h.ry);
      // posts, every so often
      const n = Math.max(1, Math.round(Math.max(w, d) / 1.3));
      for (let i = 0; i <= n; i++) {
        const k = i / n - 0.5;
        const [pu, pv] = L(lx + (w > d ? k * w : 0), lz + (w > d ? 0 : k * d));
        put(box(0.18, 1.25, 0.18, 0xb08d62), pu, pv, 0.62, h.ry);
      }
    }
    h.yard = (lx, lz) => L(lx, fz0 + (fz1 - fz0) * lz); // lz 0..1 from house to back fence
  }
  const HOUSE = Object.fromEntries(HOUSES.map((h) => [h.id, h]));

  // the Circle's green: a playground, a bench, one young tree
  {
    const P = RING;
    // swing set: an A-frame, two swings
    const swing = new THREE.Group();
    for (const sx of [-1.3, 1.3]) {
      for (const sz of [-0.5, 0.5]) {
        const leg = cyl(0.06, 0.06, 2.3, 5, 0xd24b3c);
        leg.position.set(sx, 1.1, sz * 0.9);
        leg.rotation.x = -sz * 0.45;
        swing.add(leg);
      }
    }
    const bar = cyl(0.07, 0.07, 2.8, 6, 0xd24b3c);
    bar.rotation.z = Math.PI / 2;
    bar.position.y = 2.15;
    swing.add(bar);
    const seats = [];
    for (const sx of [-0.6, 0.6]) {
      const pivot = new THREE.Group();
      pivot.position.set(sx, 2.15, 0);
      for (const cx of [-0.2, 0.2]) {
        const chain = box(0.03, 1.5, 0.03, 0x9aa0a6);
        chain.position.set(cx, -0.75, 0);
        pivot.add(chain);
      }
      const seat = box(0.5, 0.07, 0.25, 0x3a7dd8);
      seat.position.y = -1.5;
      pivot.add(seat);
      swing.add(pivot);
      seats.push(pivot);
    }
    swing.traverse((o) => { if (o.isMesh) o.castShadow = o.receiveShadow = true; });
    put(swing, P.u - 1.8, P.v - 2, 0, 0.2);
    solidBox(P.u - 1.8, P.v - 2, 2.9, 1.2, 0.2);
    h0Swings = seats;
    // the slide: a ladder, a platform, a chute
    const slide = new THREE.Group();
    const plat = box(0.9, 0.12, 0.9, 0xf2cf5b);
    plat.position.set(0, 1.4, 0);
    slide.add(plat);
    for (const [lx, lz] of [[-0.4, -0.4], [0.4, -0.4], [-0.4, 0.4], [0.4, 0.4]]) {
      const post = cyl(0.05, 0.05, 1.4, 5, 0x3a7dd8);
      post.position.set(lx, 0.7, lz);
      slide.add(post);
    }
    const chute = box(0.7, 0.08, 2.3, 0xf2cf5b);
    chute.position.set(0, 0.75, 1.4);
    chute.rotation.x = 0.62;
    slide.add(chute);
    for (let i = 0; i < 4; i++) {
      const rung = box(0.6, 0.06, 0.06, 0x3a7dd8);
      rung.position.set(0, 0.3 + i * 0.3, -0.5);
      slide.add(rung);
    }
    slide.traverse((o) => { if (o.isMesh) o.castShadow = o.receiveShadow = true; });
    put(slide, P.u + 2.2, P.v - 1.5, 0, -0.3);
    { const [cu, cv] = local(P.u + 2.2, P.v - 1.5, -0.3, 0, 1.0); solidBox(cu, cv, 1.1, 3.6, -0.3); }
    // the seesaw
    const see = new THREE.Group();
    const fulcrum = cyl(0.15, 0.25, 0.45, 5, 0x3a7dd8);
    fulcrum.position.y = 0.22;
    const plank = box(2.6, 0.08, 0.3, 0x5cbf4a);
    plank.position.y = 0.48;
    see.add(fulcrum, plank);
    see.traverse((o) => { if (o.isMesh) o.castShadow = o.receiveShadow = true; });
    put(see, P.u + 0.5, P.v + 2.6, 0, 0.1);
    solidBox(P.u + 0.5, P.v + 2.6, 2.6, 0.4, 0.1);
    h0Seesaw = plank;
    // a bench (for supervising) and a young maple, staked, identical to the
    // one on the brochure
    const bench = new THREE.Group();
    const bseat = box(1.5, 0.08, 0.45, 0x8a5a3a);
    bseat.position.y = 0.45;
    const bback = box(1.5, 0.4, 0.07, 0x8a5a3a);
    bback.position.set(0, 0.72, -0.2);
    bench.add(bseat, bback);
    for (const bx of [-0.65, 0.65]) {
      const bl = box(0.08, 0.45, 0.4, 0x2a2a2e);
      bl.position.set(bx, 0.22, 0);
      bench.add(bl);
    }
    bench.traverse((o) => { if (o.isMesh) o.castShadow = o.receiveShadow = true; });
    put(bench, P.u - 2.6, P.v + 2.4, 0, 0.9);
    solidBox(P.u - 2.6, P.v + 2.4, 1.5, 0.5, 0.9);
    roundTree(P.u + 3.3, P.v + 2.2, 0.7);
  }
  // ======================================================= walk-ins ----
  // Every door opens. doorway(id, u, v, ry, label): the spot on the lawn in
  // front of a door facing ry; room(...) builds what's behind it, off in the
  // elsewhere, dollhouse-style.
  const EXIT = {};
  function doorway(id, u, v, ry, label, r = 1.6) {
    const ox = Math.sin(ry), oz = Math.cos(ry);
    EXIT[id] = { x: O.x + u + ox * 1.1, z: O.z + v + oz * 1.1, rotY: ry };
    zones.setDoor(id, { x: EXIT[id].x, z: EXIT[id].z });
    register({
      pos: new THREE.Vector3(O.x + u + ox * 0.6, 0, O.z + v + oz * 0.6), r,
      label,
      enabled: () => !(id === 'cluck' && closedToday()),
      use: () => zones.go(id),
    });
  }
  const SUBURB_LIGHT = {
    bg: 0x3a332c, fog: 0x3a332c, fogNear: 24, fogFar: 64,
    hemiSky: 0xfff6ea, hemiGround: 0x8f806a, hemiIntensity: 1.85, sunIntensity: 0,
  };
  function room(id, name, B, { w, d, wallH = 3.6, floor = 0xc9a77a, wall = 0xf1e8d8, lighting = SUBURB_LIGHT, build }) {
    const start = group.children.length;
    const fl = box(w, 0.4, d, floor);
    fl.position.set(B.x, -0.2, B.z);
    group.add(fl);
    for (const [ww, dd, x, z] of [[w, 0.3, B.x, B.z - d / 2], [0.3, d, B.x - w / 2, B.z], [0.3, d, B.x + w / 2, B.z]]) {
      const wl = box(ww, wallH, dd, wall);
      wl.position.set(x, wallH / 2, z);
      group.add(wl);
    }
    // a baseboard, because we are not animals (we are; but not like that)
    for (const [ww, dd, x, z] of [[w, 0.08, B.x, B.z - d / 2 + 0.17], [0.08, d, B.x - w / 2 + 0.17, B.z], [0.08, d, B.x + w / 2 - 0.17, B.z]]) {
      const bb = box(ww, 0.22, dd, 0xfaf6ec);
      bb.position.set(x, 0.11, z);
      group.add(bb);
    }
    const blockers = [];
    const things = [];
    build?.(B, blockers, things);
    const root = collectInteriorRoot(group, start);
    zones.registerInterior(id, {
      root, floorY: 0,
      bounds: { x0: B.x - w / 2 + 0.45, x1: B.x + w / 2 - 0.45, z0: B.z - d / 2 + 0.45, z1: B.z + d / 2 - 0.1 },
      blockers,
      spawn: { x: B.x, z: B.z + d / 2 - 0.7, rotY: Math.PI },
      lighting,
    });
    addZonePlace(id, name);
    register({
      pos: new THREE.Vector3(B.x, 0, B.z + d / 2 - 0.25), r: 1.5, zone: id,
      label: 'step outside',
      use: () => zones.leaveTo(EXIT[id]),
    });
    for (const it of things) register({ ...it, zone: id });
    return root;
  }
  // Cluck & Co. is closed Sundays. They're resting. You should too.
  function closedToday() {
    return new Date().getDay() === 0;
  }

  // ====================================================== the Commons ----
  // A lot, and on it: the CaMall (west), and the Oasis Commons strip —
  // Trader Polly's and Dromedeals under one long roof. Flat roofs, so the
  // roofs get the decorating: HVAC boxes, skylights, and the signs.
  function flatRoofBits(u, v, w, d, h, ry = 0) {
    const cap = box(w + 0.3, 0.25, d + 0.3, 0xd8d0c0);
    put(cap, u, v, h + 0.12, ry);
    for (let i = 0; i < Math.max(1, Math.floor(w / 6)); i++) {
      const [hu, hv] = local(u, v, ry, -w / 2 + 2 + i * 5.5, -d / 4);
      const hvac = box(1.1, 0.7, 0.9, 0xb8bcc0);
      put(hvac, hu, hv, h + 0.6, ry);
      const fan = cyl(0.32, 0.32, 0.08, 8, 0x8a8e92);
      put(fan, hu, hv, h + 0.99, ry);
    }
  }
  function glassDoors(w = 1.8, h = 2.0) {
    const g = new THREE.Group();
    const frame = box(w + 0.2, h + 0.15, 0.1, 0x3a3a3e);
    frame.position.y = (h + 0.15) / 2;
    const glass = box(w, h, 0.14, 0xbfe6f2);
    glass.position.y = h / 2;
    glowWindow(glass);
    const split = box(0.06, h, 0.16, 0x3a3a3e);
    split.position.y = h / 2;
    g.add(frame, glass, split);
    g.traverse((o) => { if (o.isMesh) o.castShadow = o.receiveShadow = true; });
    return g;
  }
  function awning(w, color, stripe = 0xfffaf0) {
    const g = new THREE.Group();
    const n = Math.max(3, Math.round(w / 0.5));
    for (let i = 0; i < n; i++) {
      const s = box(w / n, 0.06, 1.1, i % 2 ? stripe : color);
      s.position.x = -w / 2 + (i + 0.5) * (w / n);
      g.add(s);
    }
    g.rotation.x = 0.38;
    return g;
  }

  // --- the CaMall ---
  const MALL = { u: -9, v: -23, w: 15, d: 8, h: 4.4 };
  {
    const { u, v, w, d, h } = MALL;
    put(box(w, h, d, 0xf0d6c8), u, v, h / 2);
    put(box(w + 0.1, 0.5, d + 0.1, 0x3fb8a8), u, v, h - 0.6); // the teal band, very 1989
    flatRoofBits(u, v, w, d, h);
    // the entrance: a tall bay pushed out front, glass doors, a skylight pyramid
    put(box(4.6, h + 1.4, 1.4, 0xf6e3d8), u, v + d / 2 + 0.5, (h + 1.4) / 2);
    const door = glassDoors(2.4, 2.3);
    put(door, u, v + d / 2 + 1.21);
    const pyr = new THREE.Mesh(new THREE.ConeGeometry(2.4, 1.6, 4), mat(0xbfe6f2, 0.3));
    pyr.rotation.y = Math.PI / 4;
    glowWindow(pyr, { max: 0.35 });
    put(pyr, u, v - 0.5, h + 0.95);
    const logo = sign(['The CaMall', 'EST. WHEN THE LAWN WENT IN'], { w: 4.2, h: 1.3, bg: '#3fb8a8', fg: '#ffffff', border: '#f28fb0' });
    put(logo, u, v + d / 2 + 1.25, h + 0.55);
    // round windows along the front, like every shop in the archipelago
    for (const wu of [-5.5, -3.2, 3.2, 5.5]) {
      const win = makeWindow(0.45);
      put(win, u + wu, v + d / 2 + 0.01, 2.0);
    }
    // the directory, out front (they put one outside too; it's a mall)
    const dir = sign(['CaMall DIRECTORY', 'SAHARA · HOT TROPIC · AUNTIE DUNE’S', 'FOOD COURT · FOUNTAIN · YOU ARE HERE'], { w: 1.6, h: 1.1, bg: '#fffaf0', fg: '#3f6f6a', border: '#3fb8a8' });
    put(dir, u + 3.4, v + d / 2 + 2.1, 1.0, 0);
    put(box(0.12, 0.5, 0.12, 0x3a3a3e), u + 3.4, v + d / 2 + 2.1, 0.25);
    solidBox(u, v, w, d);
    solidBox(u, v + d / 2 + 0.6, 4.6, 1.6);
    solidDisc(u + 3.4, v + d / 2 + 2.1, 0.3);
    doorway('mall', u, v + d / 2 + 1.2, 0, 'walk into the CaMall', 1.8);
  }

  // --- Oasis Commons: Trader Polly's | Dromedeals ---
  const STRIP = { u: 9.5, v: -22.5, w: 18, d: 7, h: 3.6 };
  {
    const { u, v, w, d, h } = STRIP;
    put(box(w, h, d, 0xe9dcc2), u, v, h / 2);
    flatRoofBits(u, v, w, d, h);
    put(box(0.3, h + 0.5, d + 0.2, 0xd8c8a8), u, v, (h + 0.5) / 2); // the party wall, poking up
    const front = v + d / 2;
    // Trader Polly's: west half. a red sign on cream, a surfboard, a lei of
    // paper flowers over the door
    const pu = u - w / 4;
    put(sign('Trader Polly’s', { w: 5.4, h: 0.85, bg: '#fff4dc', fg: '#c0392b', border: '#c0392b' }), pu, front + 0.08, h - 0.33);
    put(awning(5.2, 0xc0392b), pu, front + 0.45, 2.55);
    put(glassDoors(1.8, 2.0), pu, front + 0.02);
    const board = box(0.5, 2.6, 0.12, 0x3fb8a8);
    board.rotation.z = 0.12;
    put(board, pu + 2.3, front + 0.12, 1.3);
    put(box(0.1, 1.6, 0.14, 0xf2cf5b), pu + 2.28, front + 0.19, 1.3, 0);
    for (const wu of [-1.8, 1.4]) put(makeWindow(0.42), pu + wu - (wu > 0 ? 0 : 0), front + 0.01, 1.5);
    // Dromedeals: east half. white sign, red letters, "compare at"
    const du = u + w / 4;
    put(sign(['DROMEDEALS', 'BRAND NAMES · ONE HUMP OR TWO'], { w: 5.4, h: 0.9, bg: '#ffffff', fg: '#a8232d', border: '#a8232d' }), du, front + 0.08, h - 0.35);
    put(awning(5.2, 0x7a1f2b, 0xf0e6e0), du, front + 0.45, 2.55);
    put(glassDoors(1.8, 2.0), du, front + 0.02);
    for (const wu of [-1.8, 1.8]) put(makeWindow(0.42), du + wu, front + 0.01, 1.5);
    solidBox(u, v, w, d);
    doorway('polly', pu, front, 0, 'go into Trader Polly’s');
    doorway('drom', du, front, 0, 'go into Dromedeals');
    // the cart corral, and a cart that did not make it to the corral
    const corral = new THREE.Group();
    for (const sx of [-1.4, 1.4]) {
      const rail = box(0.06, 0.9, 0.06, 0x9aa0a6);
      rail.position.set(sx, 0.45, 0);
      corral.add(rail);
    }
    const topRail = box(2.9, 0.06, 0.06, 0x9aa0a6);
    topRail.position.y = 0.9;
    corral.add(topRail);
    put(corral, 4, LOT.v1 - 3, 0, Math.PI / 2);
    solidBox(4, LOT.v1 - 3, 0.3, 2.9);
  }
  function cart() {
    const g = new THREE.Group();
    const basket = box(0.7, 0.45, 0.95, 0xc8ccd0);
    basket.position.y = 0.72;
    const handle = box(0.7, 0.05, 0.05, 0xc0392b);
    handle.position.set(0, 1.02, -0.52);
    g.add(basket, handle);
    for (const [sx, sz] of [[-0.3, 0.4], [0.3, 0.4], [-0.3, -0.4], [0.3, -0.4]]) {
      const w = ball(0.07, 0x2e2a26);
      w.position.set(sx, 0.07, sz);
      g.add(w);
      const leg = box(0.03, 0.45, 0.03, 0x9aa0a6);
      leg.position.set(sx, 0.3, sz);
      g.add(leg);
    }
    g.traverse((o) => { if (o.isMesh) o.castShadow = o.receiveShadow = true; });
    return g;
  }
  put(cart(), 12.5, LOT.v1 - 4.2, 0, 0.7);
  solidDisc(12.5, LOT.v1 - 4.2, 0.55);
  // the lot's cars (warm, recently driven, by nobody)
  car(-14.4, LOT.v0 + 2.9, 0, 0xe8e4dc);
  car(-9.2, LOT.v0 + 2.9, 0.05, 0x9aa0a6);
  car(-1.3, LOT.v0 + 2.9, -0.04, 0x2e3e5c, { van: true });
  car(6.5, LOT.v0 + 2.9, 0, 0xd9c08f);
  car(-11.8, LOT.v1 - 1.5, Math.PI, 0x7a8a6a);
  car(9.1, LOT.v1 - 1.5, Math.PI + 0.05, 0xe8e4dc, { van: true });
  car(14.3, LOT.v1 - 1.5, Math.PI, 0xa8232d);

  // --- Mirage Coffee & Cluck & Co., side by side on the Parkway ---
  const MIRAGE = { u: 14.5, v: -4.6, w: 5.6, d: 4.4, h: 3.0 };
  const CLUCK = { u: 21.6, v: -4.6, w: 5.6, d: 4.4, h: 3.0 };
  {
    const { u, v, w, d, h } = MIRAGE;
    put(box(w, h, d, 0x2f5f50), u, v, h / 2);
    put(box(w + 0.2, 0.35, d + 0.2, 0xe8e0cc), u, v, h + 0.17);
    put(sign(['MIRAGE', 'coffee, probably'], { w: 3.6, h: 1.0, bg: '#2f5f50', fg: '#f4efe2', border: '#e8e0cc' }), u, v, h + 0.9);
    put(box(0.1, 0.55, 0.1, 0x2a2a2e), u - 1.2, v, h + 0.5);
    put(box(0.1, 0.55, 0.1, 0x2a2a2e), u + 1.2, v, h + 0.5);
    put(awning(w - 0.4, 0x2f5f50, 0xe8e0cc), u, v + d / 2 + 0.45, 2.3);
    put(glassDoors(1.4, 1.9), u - 1.1, v + d / 2 + 0.02);
    put(makeWindow(0.45), u + 1.3, v + d / 2 + 0.01, 1.4);
    solidBox(u, v, w, d);
    doorway('mirage', u - 1.1, v + d / 2, 0, 'go into Mirage Coffee');
  }
  {
    const { u, v, w, d, h } = CLUCK;
    put(box(w, h, d, 0xfaf4ec), u, v, h / 2);
    // a red roof: a proper little gable, the only one on the Commons
    const roof = prismRoof(w + 0.4, d, 1.2, 0xc8342c);
    put(roof, u, v, h + 0.35);
    put(sign(['Cluck & Co.', 'it’s our pleasure'], { w: 3.4, h: 0.95, bg: '#c8342c', fg: '#ffffff', border: '#ffffff' }), u, v + d / 2 + 0.06, h - 0.55);
    put(glassDoors(1.4, 1.9), u - 1.2, v + d / 2 + 0.02);
    put(makeWindow(0.45), u + 1.4, v + d / 2 + 0.01, 1.2);
    // the drive-thru: a window on the east wall, a menu board, one car,
    // idling since before anyone can remember, by nobody
    put(box(0.1, 0.9, 1.1, 0xbfe6f2), u + w / 2 + 0.02, v - 0.3, 1.3);
    const menu = sign(['ORDER HERE', 'NUGGETS · SANDWICH · WAFFLE FRIES', 'LEMONADE · IT’S OUR PLEASURE'], { w: 1.4, h: 1.2, bg: '#2a2a2e', fg: '#ffdd88' });
    put(menu, u + w / 2 + 1.6, v + 2.4, 1.2, -Math.PI / 2);
    put(box(0.12, 0.6, 0.12, 0x2a2a2e), u + w / 2 + 1.6, v + 2.4, 0.3);
    solidBox(u + w / 2 + 1.6, v + 2.4, 0.3, 1.5);
    // the cow, on the roof, with her sign. she is a painted cutout. she has
    // opinions about spelling that she keeps to herself.
    const cow = sign('EAT MOR NUGGITS', { w: 2.2, h: 0.5, bg: '#fffaf0', fg: '#2a2a2e' });
    put(cow, u + 1.2, v - 0.9, h + 1.3, -0.15);
    const cowBody = buildAnimal('cow', { body: 0xf2ead8, head: 0xf2ead8 });
    cowBody.scale.setScalar(0.7);
    put(cowBody, u + 1.2, v - 0.5, h + 0.55, -0.15);
    solidBox(u, v, w, d);
    doorway('cluck', u - 1.2, v + d / 2, 0, 'go into Cluck & Co.');
    register({
      pos: new THREE.Vector3(O.x + u - 1.2, 0, O.z + v + d / 2 + 0.7), r: 1.6, priority: 2,
      label: 'try the door',
      enabled: () => closedToday(),
      use: () => ui.say('A little sign on the glass: “CLOSED SUNDAYS. We’re resting. You should too. — Cluck & Co.” Inside, the chairs are up on the tables, very politely.'),
    });
  }
  // the patio out front of the two of them: tables, umbrellas
  {
    slab(18, -0.9, 13, 2.8, CONCRETE, 0.04);
    for (const [tu, col] of [[13.2, 0x2f5f50], [16.2, 0x2f5f50], [20.3, 0xc8342c], [23.2, 0xc8342c]]) {
      const t = new THREE.Group();
      const top = cyl(0.5, 0.5, 0.06, 8, 0xfaf6ec);
      top.position.y = 0.72;
      const leg = cyl(0.05, 0.05, 0.72, 5, 0x3a3a3e);
      leg.position.y = 0.36;
      const pole = cyl(0.03, 0.03, 1.6, 5, 0x3a3a3e);
      pole.position.y = 1.5;
      const shade = new THREE.Mesh(new THREE.ConeGeometry(1.0, 0.45, 8), mat(col));
      shade.position.y = 2.3;
      shade.castShadow = true;
      t.add(top, leg, pole, shade);
      for (const a of [0, Math.PI]) {
        const chair = box(0.35, 0.45, 0.35, 0xfaf6ec);
        chair.position.set(Math.cos(a) * 0.75, 0.22, Math.sin(a) * 0.75);
        t.add(chair);
      }
      t.traverse((o) => { if (o.isMesh) o.castShadow = o.receiveShadow = true; });
      put(t, tu, -0.8);
      solidBox(tu, -0.8, 1.9, 0.9);
    }
  }

  // ================================================== the way in ----
  // the gatehouse (a parrot, a list nobody is on), the boom (up; always up;
  // it's the principle), the monument, and the pier where a ferry will call
  // the moment the HOA approves one
  {
    const G = { u: 24.6, v: -13.4 };
    put(box(2.0, 2.3, 1.8, 0xf0e6d4), G.u, G.v, 1.15);
    put(box(2.6, 0.2, 2.4, 0x8c7f72), G.u, G.v, 2.4);
    const gwin = box(1.4, 0.8, 0.1, 0xbfe6f2);
    glowWindow(gwin);
    put(gwin, G.u, G.v + 0.91, 1.5);
    put(sign('GATEHOUSE', { w: 1.6, h: 0.35, bg: '#fffaf0', fg: '#8c7f72' }), G.u, G.v + 0.95, 2.05);
    solidBox(G.u, G.v, 2.0, 1.8);
    // the boom: striped, raised, forever
    const post = box(0.35, 1.0, 0.35, 0xf0e6d4);
    put(post, 23.2, BLVD.v0 + 0.2, 0.5);
    solidDisc(23.2, BLVD.v0 + 0.2, 0.25);
    const arm = new THREE.Group();
    for (let i = 0; i < 6; i++) {
      const bit = box(0.5, 0.12, 0.12, i % 2 ? 0xffffff : 0xc0392b);
      bit.position.x = 0.25 + i * 0.5;
      arm.add(bit);
    }
    arm.rotation.z = 1.2; // up
    arm.rotation.y = Math.PI / 2;
    put(arm, 23.2, BLVD.v0 + 0.2, 1.0);
    // Reggie, in the booth (a grey parrot; the window frames him)
    const reggie = buildAnimal('parrot', { body: 0x9aa0a8, head: 0x9aa0a8, wing: 0x7a8088, tail: 0xc8342c });
    reggie.scale.setScalar(0.85);
    put(reggie, G.u, G.v + 0.2, 0);
    capOn(reggie, 0x2e3e5c);
    register({
      pos: new THREE.Vector3(O.x + G.u, 0, O.z + G.v + 1.6), r: 1.8,
      label: 'talk to Reggie',
      use: () => ui.say(nextLine('reggie', REGGIE), { speaker: 'Reggie', voice: VOICE.reggie }),
    });
  }
  {
    // the monument: a low sand-colored wall, a painted plaque, flowers
    const M = { u: 27.0, v: -6.6, ry: 0.55 };
    put(box(3.6, 1.1, 0.7, 0xd8c8a8), M.u, M.v, 0.55, M.ry);
    put(box(3.8, 0.15, 0.8, 0xc9b79a), M.u, M.v, 1.15, M.ry);
    const [pu, pv] = local(M.u, M.v, M.ry, 0, 0.37);
    put(sign(['OASIS ESTATES', 'A Planned Community'], { w: 3.0, h: 0.8, d: 0.04, bg: '#2f5f50', fg: '#f4efe2' }), pu, pv, 0.6, M.ry);
    for (let i = 0; i < 7; i++) {
      const [fu, fv] = local(M.u, M.v, M.ry, -1.5 + i * 0.5, 0.8);
      put(ball(0.14, [0xff8fa8, 0xffd23e, 0xffffff][i % 3]), fu, fv, 0.14);
    }
    solidBox(M.u, M.v, 3.8, 0.95, M.ry);
    palm(M.u - 2.4, M.v - 1.4, 3.3, 0.1);
  }
  {
    // the pier: out from the end of the Parkway into the east water
    const P0 = PIER.u0, P1 = PIER.u1, PV = PIER.v, PW = PIER.w, top = PIER.top;
    const deck = box(P1 - P0, 0.18, PW, 0xa98b62);
    put(deck, (P0 + P1) / 2, PV, top - 0.09 - GY);
    for (let u = P0 + 1; u <= P1; u += 2.4) {
      for (const sv of [-1, 1]) {
        const pile = cyl(0.12, 0.14, 2.6, 6, 0x6e5a44);
        put(pile, u, PV + sv * (PW / 2 - 0.1), top - 1.3 - GY);
      }
    }
    const x0 = O.x + P0, x1 = O.x + P1, z0 = O.z + PV - PW / 2, z1 = O.z + PV + PW / 2;
    zones.addCrossing({
      contains: (x, z) => x >= x0 && x <= x1 && z >= z0 + 0.15 && z <= z1 - 0.15,
      height: (x, z) => Math.max(top, terrainHeight(x, z)),
    });
    zones.addSeaWall({ contains: (x, z) => x >= x0 - 0.3 && x <= x1 + 0.3 && z >= z0 - 0.3 && z <= z1 + 0.3 });
    solidBox((P0 + P1) / 2, PV, P1 - P0, PW + 0.3); // its edges and pilings; the walk down the middle is the crossing
    // the Persistent's buoy, at the end of the pier (its bell removed, per
    // Article 9; you knock on it — she comes anyway)
    {
      const b = new THREE.Group();
      const base = cyl(0.3, 0.4, 0.8, 7, 0xb0453a);
      base.position.y = 0.4;
      const topBall = ball(0.18, 0xf2cf5b);
      topBall.position.y = 0.95;
      b.add(base, topBall);
      b.position.set(OASIS_DOCK.buoyPos.x, top, OASIS_DOCK.buoyPos.z);
      group.add(b);
      zones.addBlocker(OASIS_DOCK.buoyPos.x, OASIS_DOCK.buoyPos.z, 0.4);
    }
    const board = sign(['FERRY LANDING', 'SERVICE PENDING HOA APPROVAL', 'THE PERSISTENT CALLS ANYWAY'], { w: 2.2, h: 1.2, bg: '#fffaf0', fg: '#2f5f50', border: '#2f5f50' });
    put(board, P1 - 0.6, PV - PW / 2 - 0.1, top + 1.4 - GY, 0);
    put(box(0.12, 1.4, 0.12, 0x6e5a44), P1 - 0.6, PV - PW / 2 - 0.1, top + 0.4 - GY);
    register({
      pos: new THREE.Vector3(O.x + P1 - 0.8, 0, O.z + PV), r: 1.8,
      label: 'read the ferry sign',
      use: () => ui.say([
        'FERRY LANDING. SERVICE PENDING HOA APPROVAL. THANK YOU FOR YOUR PATIENCE.',
        'Under it, smaller, on a laminated card: “The Board has reviewed the ferry proposal (submitted by Captain Brine, 14 times) and requires the following revisions: a quieter horn. No horn. A different boat. A different sea. — B. Humphries, President.”',
        'Under THAT, in marker, on a luggage tag tied to the post: “Stopped asking. It’s a pier. I’m a tugboat. Knock on the buoy. — Capt. B.”',
      ]),
    });
  }

  // =================================================== street things ----
  // lamps along the Parkway and round the Circle (they glow; they don't
  // light — the budget), a street sign, a notice board, NO OUTLET
  function lamp(u, v) {
    const g = new THREE.Group();
    const post = cyl(0.06, 0.08, 2.7, 6, 0x2a2a2e);
    post.position.y = 1.35;
    const cap = cyl(0.26, 0.18, 0.12, 6, 0x2a2a2e);
    cap.position.y = 3.05;
    const globe = new THREE.Mesh(new THREE.IcosahedronGeometry(0.22, 0), mat(0xfff3d0, 0.4));
    globe.position.y = 2.82;
    glowWindow(globe, { max: 0.75 });
    g.add(post, cap, globe);
    g.traverse((o) => { if (o.isMesh) o.castShadow = o.receiveShadow = true; });
    put(g, u, v);
    solidDisc(u, v, 0.15);
  }
  for (let u = BLVD.u0 + 5.5; u <= BLVD.u1 - 4; u += 7.5) lamp(u, BLVD.v0 - 0.4);
  for (const a of [-60, 30, 120, 210]) {
    const th = (a * Math.PI) / 180;
    lamp(RING.u + Math.cos(th) * (RING.rOut + 0.5), RING.v + Math.sin(th) * (RING.rOut + 0.5));
  }
  {
    // the street sign at the mouth of Circle Drive
    const su = SPUR.u - SPUR.hw - 0.6, sv = BLVD.v1 + 1.3;
    put(cyl(0.05, 0.05, 2.6, 6, 0x6e7478), su, sv, 1.3);
    put(sign('OASIS PKWY', { w: 1.3, h: 0.28, bg: '#2f7a4f', fg: '#ffffff' }), su, sv, 2.45, 0);
    put(sign('CIRCLE DR', { w: 1.3, h: 0.28, bg: '#2f7a4f', fg: '#ffffff' }), su, sv, 2.15, Math.PI / 2);
    put(sign(['NO OUTLET'], { w: 0.9, h: 0.5, bg: '#f2cf5b', fg: '#2a2a2e' }), su, sv + 0.06, 1.6, 0);
    solidDisc(su, sv, 0.15);
    // and the one the HOA added
    const nu = SPUR.u + SPUR.hw + 0.8, nv = BLVD.v1 + 1.1;
    put(cyl(0.05, 0.05, 1.8, 6, 0x6e7478), nu, nv, 0.9);
    put(sign(['THIS IS NOT A ROAD.', 'IT IS A PARKWAY.', '— THE HOA'], { w: 1.3, h: 0.9, bg: '#ffffff', fg: '#2a2a2e', border: '#2a2a2e' }), nu, nv + 0.06, 1.7, 0);
    solidDisc(nu, nv, 0.15);
    register({
      pos: new THREE.Vector3(O.x + nu, 0, O.z + nv + 0.8), r: 1.4,
      label: 'read the HOA sign',
      use: () => ui.say([
        'THIS IS NOT A ROAD. IT IS A PARKWAY. — THE HOA',
        'There are no roads on any island. Everybody knows that; BULKO has a sign. What Oasis Estates has is four point six miles of parkway, drive, and circle, laid in asphalt, with a dashed yellow line down the middle, for walking on.',
        'There was a meeting.',
      ]),
    });
  }
  {
    // the HOA notice board, by the mouth of Circle Drive: laminated, thumbtacked,
    // current as of this morning (it is always current as of this morning)
    const bu = SPUR.u - 6.2, bv = BLVD.v1 + 2.0;
    const nb = new THREE.Group();
    const cork = box(2.0, 1.3, 0.12, 0xb58d5a);
    cork.position.y = 1.35;
    const frame = box(2.2, 1.5, 0.08, 0x8c7f72);
    frame.position.set(0, 1.35, -0.05);
    nb.add(cork, frame);
    for (const lx of [-0.9, 0.9]) {
      const leg = box(0.1, 0.8, 0.1, 0x8c7f72);
      leg.position.set(lx, 0.4, -0.05);
      nb.add(leg);
    }
    const papers = [[0xffffff, -0.55, 1.55], [0xfff3b0, 0.1, 1.6], [0xffffff, 0.62, 1.45], [0xd8ecff, -0.3, 1.05], [0xffffff, 0.45, 1.0]];
    for (const [c, x, y] of papers) {
      const pp = box(0.5, 0.6, 0.02, c);
      pp.position.set(x, y, 0.07);
      pp.rotation.z = rand(-0.08, 0.08);
      nb.add(pp);
    }
    nb.traverse((o) => { if (o.isMesh) o.castShadow = o.receiveShadow = true; });
    put(nb, bu, bv, 0, 0);
    solidBox(bu, bv, 2.2, 0.3);
    register({
      pos: new THREE.Vector3(O.x + bu, 0, O.z + bv + 0.9), r: 1.6,
      label: 'read the HOA notices',
      use: async () => {
        await ui.say(nextLine('notices', NOTICES), { speaker: 'HOA Notice Board' });
      },
    });
  }

  // ============================================ the community pool ----
  // HOA members only. Everyone is an HOA member. It isn't optional.
  const POOL = { u: 20.5, v: 13, w: 6, d: 3.6 };
  {
    const { u, v, w, d } = POOL;
    const deckTop = 0.22;
    put(box(w + 2.4, deckTop, d + 2.4, 0xe8e0cc), u, v, deckTop / 2);
    zones.addSurfaceBox(O.x + u, O.z + v, w + 2.4, d + 2.4, GY + deckTop);
    const water = box(w, 0.1, d, 0x49c6e0);
    water.material = new THREE.MeshStandardMaterial({ color: 0x49c6e0, flatShading: true, roughness: 0.2, transparent: true, opacity: 0.9 });
    put(water, u, v, deckTop - 0.02);
    const lip = box(w + 0.3, 0.08, d + 0.3, 0xffffff);
    put(lip, u, v, deckTop - 0.03);
    solidBox(u, v, w, d);
    // loungers along the south side, a lifeguard chair with nobody in it
    for (let i = 0; i < 3; i++) {
      const l = new THREE.Group();
      const base = box(0.7, 0.2, 1.7, 0xffffff);
      base.position.y = 0.3;
      const back = box(0.7, 0.08, 0.7, 0xffffff);
      back.position.set(0, 0.55, -0.7);
      back.rotation.x = -0.7;
      const towel = box(0.6, 0.04, 1.2, [0x3fb8a8, 0xf28fb0, 0xf2cf5b][i]);
      towel.position.y = 0.42;
      l.add(base, back, towel);
      l.traverse((o) => { if (o.isMesh) o.castShadow = o.receiveShadow = true; });
      put(l, u - 2.2 + i * 1.6, v + d / 2 + 1.35 - 0.3, deckTop, Math.PI);
      solidBox(u - 2.2 + i * 1.6, v + d / 2 + 1.05, 0.7, 1.7);
    }
    const chair = new THREE.Group();
    for (const sx of [-0.35, 0.35]) {
      const leg = box(0.08, 1.8, 0.08, 0xffffff);
      leg.position.set(sx, 0.9, 0);
      chair.add(leg);
    }
    const seat = box(0.8, 0.1, 0.6, 0xffffff);
    seat.position.y = 1.8;
    const cross = box(0.8, 0.5, 0.06, 0xc0392b);
    cross.position.set(0, 2.1, -0.28);
    chair.add(seat, cross);
    chair.traverse((o) => { if (o.isMesh) o.castShadow = o.receiveShadow = true; });
    put(chair, u + w / 2 + 0.7, v - d / 2 - 0.4, deckTop, -0.4);
    solidDisc(u + w / 2 + 0.7, v - d / 2 - 0.4, 0.45);
    const rules = sign(['POOL RULES', 'NO RUNNING · NO SPLASHING', 'NO CANNONBALLS · NO BELLS', 'NO FUN BEFORE 10 A.M.', '— THE HOA'], { w: 1.4, h: 1.5, bg: '#ffffff', fg: '#2f5f50', border: '#3fb8a8' });
    put(rules, u - w / 2 - 0.5, v - d / 2 - 1.1, 1.3, 0.4);
    put(box(0.1, 0.6, 0.1, 0x8c7f72), u - w / 2 - 0.5, v - d / 2 - 1.1, 0.3);
    solidBox(u - w / 2 - 0.5, v - d / 2 - 1.1, 1.5, 0.3, 0.4);
    register({
      pos: new THREE.Vector3(O.x + u, 0, O.z + v + d / 2 + 0.6), r: 2.4,
      label: 'look at the pool',
      use: () => ui.say([
        'The water is the exact blue of the brochure. Nobody is in it. Nobody is ever in it; nobody wants to be the first to make a ripple.',
        'The lifeguard chair is empty. A small sign on it: “LIFEGUARD ON DUTY.”',
      ]),
    });
  }
  roundTree(24.5, 5.5, 0.9);
  roundTree(-22.5, -3.5, 0.8);
  roundTree(16.5, 22, 0.85);

  // ====================================================== folk kit ----
  // dress(): the Oasis look — visors, pearls, aprons, shirts, clipboards.
  // Accessories ride the head or the body so they breathe and walk along.
  function floralTexture(base, dots) {
    const cv = document.createElement('canvas');
    cv.width = cv.height = 64;
    const ctx = cv.getContext('2d');
    ctx.fillStyle = base;
    ctx.fillRect(0, 0, 64, 64);
    for (let i = 0; i < 14; i++) {
      ctx.fillStyle = dots[i % dots.length];
      const x = (i * 23) % 64, y = (i * 37) % 64;
      ctx.beginPath();
      ctx.arc(x, y, 5, 0, Math.PI * 2);
      ctx.fill();
    }
    const tex = new THREE.CanvasTexture(cv);
    tex.colorSpace = THREE.SRGBColorSpace;
    return tex;
  }
  function dress(a, o = {}) {
    const P = a.userData.parts;
    if (o.shirt !== undefined || o.floral) {
      const m = o.floral
        ? new THREE.MeshStandardMaterial({ map: floralTexture(o.floral[0], o.floral.slice(1)), flatShading: true, roughness: 0.85 })
        : mat(o.shirt);
      const sh = new THREE.Mesh(P.body.geometry, m);
      sh.scale.setScalar(1.05);
      sh.castShadow = true;
      P.body.add(sh);
    }
    if (o.apron !== undefined) {
      const ap = box(0.62, 0.62, 0.06, o.apron);
      ap.position.set(0, -0.08, 0.52);
      P.body.add(ap);
    }
    if (o.visor !== undefined) {
      const v = new THREE.Group();
      const band = new THREE.Mesh(new THREE.TorusGeometry(0.34, 0.05, 5, 12), mat(o.visor));
      band.rotation.x = Math.PI / 2;
      const bill = new THREE.Mesh(new THREE.CylinderGeometry(0.36, 0.36, 0.035, 10, 1, false, -Math.PI / 2 - 0.9, 1.8), mat(o.visor));
      bill.position.set(0, -0.01, 0.07);
      bill.scale.set(1.15, 1, 1.35);
      v.add(band, bill);
      v.position.y = 0.2;
      P.head.add(v);
    }
    if (o.cap !== undefined) capOn(a, o.cap);
    if (o.pearls) {
      const pearls = new THREE.Group();
      for (let i = 0; i < 12; i++) {
        const t = (i / 12) * Math.PI * 2;
        const b = ball(0.045, 0xfaf6ec);
        b.position.set(Math.cos(t) * 0.22, 0, Math.sin(t) * 0.22);
        pearls.add(b);
      }
      pearls.position.set(0, o.pearls[0], o.pearls[1]);
      pearls.rotation.x = o.pearls[2] ?? 0.4;
      a.add(pearls);
    }
    if (o.glasses) {
      const gl = new THREE.Group();
      for (const sx of [-1, 1]) {
        const rim = new THREE.Mesh(new THREE.TorusGeometry(0.08, 0.015, 4, 10), mat(0x2a2a2e));
        rim.position.set(sx * P.eyes[0].position.x * -1, 0, 0);
        gl.add(rim);
      }
      const e = P.eyes[0];
      gl.position.copy(e.position);
      gl.position.x = 0;
      gl.position.z += 0.04;
      (e.parent || a).add(gl);
    }
    if (o.clipboard) {
      const cb = new THREE.Group();
      const board = box(0.34, 0.44, 0.03, 0x8a5a3a);
      const paper = box(0.28, 0.34, 0.035, 0xffffff);
      paper.position.y = -0.03;
      const clip = box(0.12, 0.05, 0.05, 0x9aa0a6);
      clip.position.y = 0.2;
      cb.add(board, paper, clip);
      cb.position.set(0.28, 0.1, 0.5);
      cb.rotation.x = -0.5;
      P.body.add(cb);
    }
    if (o.bow !== undefined) {
      const bw = new THREE.Group();
      for (const sx of [-1, 1]) {
        const lobe = new THREE.Mesh(new THREE.ConeGeometry(0.1, 0.18, 4), mat(o.bow));
        lobe.rotation.z = sx * Math.PI / 2;
        lobe.position.x = sx * 0.1;
        bw.add(lobe);
      }
      bw.position.set(0.2, 0.34, 0.1);
      P.head.add(bw);
    }
    return a;
  }
  // someone who lives here: built, dressed, placed (absolute x/z — rooms
  // are off in the elsewhere), and fidgeting like a proper shopkeeper
  function folk(kind, colors, x, y, z, ry, o = {}) {
    const a = buildAnimal(kind, colors);
    if (o.scale) a.scale.setScalar(o.scale);
    dress(a, o);
    a.position.set(x, y, z);
    a.rotation.y = ry;
    if (o.fidget) a.userData.fidget = true;
    group.add(a);
    return a;
  }

  // ===================================================== furniture ----
  function couch(x, z, ry, color) {
    const g = new THREE.Group();
    const seat = box(2.6, 0.45, 0.95, color);
    seat.position.y = 0.3;
    const back = box(2.6, 0.75, 0.28, color);
    back.position.set(0, 0.7, -0.36);
    g.add(seat, back);
    for (const sx of [-1.2, 1.2]) {
      const arm = box(0.28, 0.62, 0.95, color);
      arm.position.set(sx, 0.45, 0);
      g.add(arm);
    }
    for (const cx of [-0.62, 0.62]) {
      const cushion = box(1.08, 0.14, 0.7, color);
      cushion.position.set(cx, 0.58, 0.06);
      g.add(cushion);
    }
    g.position.set(x, 0, z);
    g.rotation.y = ry;
    group.add(g);
    return g;
  }
  function table(x, z, w, d, color = 0x8a6a4a, h = 0.75) {
    const g = new THREE.Group();
    const top = box(w, 0.08, d, color);
    top.position.y = h;
    g.add(top);
    for (const [sx, sz] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) {
      const leg = box(0.08, h, 0.08, color);
      leg.position.set(sx * (w / 2 - 0.1), h / 2, sz * (d / 2 - 0.1));
      g.add(leg);
    }
    g.position.set(x, 0, z);
    group.add(g);
    return g;
  }
  function chair(x, z, ry, color = 0x8a6a4a) {
    const g = new THREE.Group();
    const seat = box(0.45, 0.07, 0.45, color);
    seat.position.y = 0.45;
    const back = box(0.45, 0.55, 0.06, color);
    back.position.set(0, 0.72, -0.2);
    g.add(seat, back);
    for (const [sx, sz] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) {
      const leg = box(0.05, 0.45, 0.05, color);
      leg.position.set(sx * 0.19, 0.22, sz * 0.19);
      g.add(leg);
    }
    g.position.set(x, 0, z);
    g.rotation.y = ry;
    group.add(g);
    return g;
  }
  function rug(x, z, w, d, color) {
    const r = box(w, 0.03, d, color);
    r.position.set(x, 0.015, z);
    group.add(r);
    return r;
  }
  function plant(x, z, s = 1) {
    const pot = cyl(0.22 * s, 0.17 * s, 0.4 * s, 7, 0xf3efe2);
    pot.position.set(x, 0.2 * s, z);
    const leaves = ball(0.42 * s, 0x4c9c47, 1);
    leaves.scale.y = 1.25;
    leaves.position.set(x, 0.75 * s, z);
    group.add(pot, leaves);
  }
  function wallSign(text, x, y, z, ry, w = 2.0, opts = {}) {
    const sg = sign(text, { w, h: w * 0.3, d: 0.05, bg: '#faf6ec', fg: '#5b4a32', ...opts });
    sg.position.set(x, y, z);
    sg.rotation.y = ry;
    group.add(sg);
    return sg;
  }
  // TVs: a painted picture behind the glass, always on. Every channel at
  // Oasis Estates is a channel about Oasis Estates, more or less.
  function tvPicture(kind) {
    const cv = document.createElement('canvas');
    cv.width = 256; cv.height = 144;
    const c = cv.getContext('2d');
    const sky = (top, bot) => { const g = c.createLinearGradient(0, 0, 0, 144); g.addColorStop(0, top); g.addColorStop(1, bot); c.fillStyle = g; c.fillRect(0, 0, 256, 144); };
    const caption = (t) => { c.fillStyle = 'rgba(0,0,0,0.55)'; c.fillRect(0, 116, 256, 28); c.fillStyle = '#fff'; c.font = 'bold 15px ui-rounded, system-ui, sans-serif'; c.textAlign = 'center'; c.fillText(t, 128, 135); };
    if (kind === 'lawn') {
      sky('#9fdcf7', '#dff3fb');
      for (let i = 0; i < 8; i++) { c.fillStyle = i % 2 ? '#58c04a' : '#6cce5a'; c.fillRect(i * 32, 70, 32, 74); }
      c.fillStyle = '#e8dcc4'; c.fillRect(150, 40, 70, 34); c.fillStyle = '#8c7f72'; c.beginPath(); c.moveTo(144, 42); c.lineTo(185, 20); c.lineTo(226, 42); c.fill();
      caption('HOME & LAWN · “Edging: A Love Story”');
    } else if (kind === 'birds') {
      sky('#7fc8a0', '#2f6f4a');
      for (let i = 0; i < 5; i++) { c.fillStyle = ['#d8342c', '#3a7dd8', '#f2cf5b', '#5cbf4a', '#e86a9a'][i]; c.beginPath(); c.arc(40 + i * 45, 60 + (i % 2) * 18, 13, 0, Math.PI * 2); c.fill(); }
      caption('PARROTS OF THE WORLD (repeat)');
    } else if (kind === 'game') {
      c.fillStyle = '#3f9a45'; c.fillRect(0, 0, 256, 144);
      c.strokeStyle = '#ffffff'; c.lineWidth = 3; c.strokeRect(20, 18, 216, 92); c.beginPath(); c.moveTo(128, 18); c.lineTo(128, 110); c.stroke();
      c.fillStyle = '#ffffff'; c.beginPath(); c.arc(150, 60, 6, 0, Math.PI * 2); c.fill();
      caption('THE BIG GAME · 0 – 0 · 3rd qtr');
    } else if (kind === 'cartoon') {
      sky('#ffd23e', '#ff9b6a');
      c.fillStyle = '#6a4ad8'; c.beginPath(); c.arc(128, 70, 34, 0, Math.PI * 2); c.fill();
      c.fillStyle = '#fff'; c.beginPath(); c.arc(116, 62, 9, 0, Math.PI * 2); c.arc(140, 62, 9, 0, Math.PI * 2); c.fill();
      c.fillStyle = '#222'; c.beginPath(); c.arc(118, 63, 4, 0, Math.PI * 2); c.arc(142, 63, 4, 0, Math.PI * 2); c.fill();
      caption('CAPTAIN CRUNCHBEAK · Ep. 212');
    } else if (kind === 'fire') {
      c.fillStyle = '#2a1a12'; c.fillRect(0, 0, 256, 144);
      for (let i = 0; i < 6; i++) { c.fillStyle = ['#ff9b3a', '#ffd23e', '#ff6a2a'][i % 3]; c.beginPath(); c.moveTo(70 + i * 20, 110); c.lineTo(80 + i * 20, 40 + (i % 3) * 12); c.lineTo(90 + i * 20, 110); c.fill(); }
      caption('FIREPLACE CHANNEL · (staged)');
    } else if (kind === 'lullaby') {
      sky('#2e3e7c', '#8a7ac8');
      c.fillStyle = '#fff8d8'; c.beginPath(); c.arc(190, 40, 18, 0, Math.PI * 2); c.fill();
      for (let i = 0; i < 4; i++) { c.fillStyle = '#ffffff'; c.beginPath(); c.arc(50 + i * 40, 92, 12, 0, Math.PI * 2); c.arc(62 + i * 40, 88, 10, 0, Math.PI * 2); c.fill(); }
      caption('SLEEPY SHEEP · counting (3 hrs)');
    } else if (kind === 'golf') {
      sky('#bfe6f7', '#e6f7fb');
      c.fillStyle = '#6cce5a'; c.beginPath(); c.ellipse(128, 110, 150, 50, 0, 0, Math.PI * 2); c.fill();
      c.fillStyle = '#3a3a3e'; c.fillRect(170, 50, 3, 45); c.fillStyle = '#e8342c'; c.fillRect(173, 50, 18, 11);
      caption('GOLF · everybody whispering');
    } else if (kind === 'mall') {
      sky('#f28fb0', '#3fb8a8');
      c.fillStyle = '#fff'; c.font = 'bold 30px ui-rounded, system-ui, sans-serif'; c.textAlign = 'center'; c.fillText('SALE', 128, 70);
      caption('The CaMall · you are here');
    }
    const tex = new THREE.CanvasTexture(cv);
    tex.colorSpace = THREE.SRGBColorSpace;
    return new THREE.MeshBasicMaterial({ map: tex });
  }
  function tv(x, z, ry, kind, w = 2.0) {
    const g = new THREE.Group();
    const stand = box(w + 0.3, 0.55, 0.5, 0x3a332c);
    stand.position.y = 0.275;
    const bezel = box(w + 0.1, w * 0.6, 0.1, 0x1a1a1c);
    bezel.position.set(0, 0.6 + w * 0.3 + 0.1, -0.1);
    const screen = new THREE.Mesh(new THREE.PlaneGeometry(w - 0.05, w * 0.56), tvPicture(kind));
    screen.position.set(0, 0.6 + w * 0.3 + 0.1, -0.04);
    g.add(stand, bezel, screen);
    g.position.set(x, 0, z);
    g.rotation.y = ry;
    group.add(g);
    return g;
  }

  // ========================================== inside the Standard ----
  // One floor plan. Seven families. The same couch (Oatmeal), the same rug
  // (Greige), the same sign in the same place. Every house differs only in
  // who's home and what's on.
  const HOUSE_DRESS = {};
  function standardInterior(h, idx) {
    const B = { x: -300, z: HOUSE_IN_Z0 + idx * 80 };
    const W0 = 12, D0 = 9;
    const d = HOUSE_DRESS[h.id] || {};
    room(`oasis_${h.id}`, `🏡 ${h.name}`, B, {
      w: W0, d: D0, wall: 0xe9e2d4,
      build: (B, bl, things) => {
        const X = (lx) => B.x + lx, Z = (lz) => B.z + lz;
        // living: TV on the back wall, the couch facing it, a coffee table
        rug(X(-3.2), Z(-1.4), 3.8, 2.8, 0xb8b0a4);
        tv(X(-3.2), Z(-4.05), 0, d.tv ?? 'lawn');
        couch(X(-3.2), Z(0.2), Math.PI, 0xd8ccb8);
        table(X(-3.2), Z(-1.7), 1.2, 0.7, 0x8a6a4a, 0.42);
        bl.push({ x: X(-3.2), z: Z(-4.05), w: 2.4, d: 0.6 }, { x: X(-3.2), z: Z(0.2), w: 2.7, d: 1.0 }, { x: X(-3.2), z: Z(-1.7), w: 1.3, d: 0.8 });
        wallSign('LIVE LAUGH LOUNGE', X(-5.82), 2.3, Z(-1.3), Math.PI / 2, 2.2, { fg: '#8c7f72' });
        const win = makeWindow(0.42);
        win.rotation.y = Math.PI / 2;
        win.position.set(X(-5.84), 1.7, Z(2.0));
        group.add(win);
        // the stairs, up the back wall, to a carpeted floor you'd hear about
        for (let i = 0; i < 7; i++) {
          const st = box(1.3, 0.34 * (i + 1), 0.4, 0xd8ccb8);
          st.position.set(X(-0.4 + i * 0.4), 0.17 * (i + 1), Z(-3.95));
          group.add(st);
        }
        const rail = box(2.9, 0.06, 0.06, 0xfaf6ec);
        rail.position.set(X(0.8), 1.9, Z(-3.3));
        rail.rotation.z = 0.68;
        group.add(rail);
        bl.push({ x: X(0.8), z: Z(-3.95), w: 2.9, d: 1.3 });
        things.push({ pos: new THREE.Vector3(X(0), 0, Z(-2.8)), r: 1.3, label: 'look up the stairs',
          use: () => ui.say(d.stairs ?? 'The stairs go up to the bedrooms. The carpet up there is cream. You’d hear about it.') });
        // kitchen: back counter, fridge, an island with stools, pendant lamps
        const counter = box(2.4, 0.95, 0.7, 0xfaf6ec);
        counter.position.set(X(3.4), 0.475, Z(-4.05));
        const ctop = box(2.5, 0.06, 0.75, 0x3a3a3e);
        ctop.position.set(X(3.4), 0.98, Z(-4.05));
        const fridge = box(1.0, 2.1, 0.8, 0xdfe2e4);
        fridge.position.set(X(5.2), 1.05, Z(-3.95));
        const island = box(2.2, 0.95, 1.0, 0xfaf6ec);
        island.position.set(X(3.6), 0.475, Z(-1.5));
        const itop = box(2.3, 0.06, 1.1, 0x3a3a3e);
        itop.position.set(X(3.6), 0.98, Z(-1.5));
        group.add(counter, ctop, fridge, island, itop);
        for (const sx of [-0.6, 0.6]) {
          const stool = cyl(0.2, 0.2, 0.7, 7, 0x8a6a4a);
          stool.position.set(X(3.6 + sx), 0.35, Z(-0.6));
          group.add(stool);
        }
        for (const lx of [3.0, 4.2]) {
          const hl = makeHangingLamp(0x2f5f50);
          hl.position.set(X(lx), 2.6, Z(-1.5));
          group.add(hl);
        }
        bl.push({ x: X(3.4), z: Z(-4.05), w: 2.4, d: 0.7 }, { x: X(5.2), z: Z(-3.95), w: 1.0, d: 0.8 }, { x: X(3.6), z: Z(-1.5), w: 2.2, d: 1.0 });
        // the dining table, by the door, for company
        table(X(3.6), Z(1.9), 1.7, 1.0);
        for (const [cx, cz, cr] of [[2.9, 1.2, 0], [4.3, 1.2, 0], [2.9, 2.6, Math.PI], [4.3, 2.6, Math.PI]]) chair(X(cx), Z(cz), cr);
        bl.push({ x: X(3.6), z: Z(1.9), w: 1.8, d: 1.9 });
        plant(X(5.3), Z(3.6), 1.1);
        bl.push({ x: X(5.3), z: Z(3.6), r: 0.35 });
        d.build?.(B, X, Z, bl, things);
      },
    });
    doorway(`oasis_${h.id}`, ...h.L(-1.9, HD / 2 + 0.2), h.ry, d.enterLabel ?? `knock at ${h.name}`);
  }

  // ================================================== the families ----
  const CAMEL = 0xd8b27a, CAMEL_DK = 0xc49a66, CAMEL_LT = 0xe6c896;
  const talkThing = (getPos, key, name, lines, label = `talk to ${name}`, r = 2.2) =>
    ({ getPos, r, label, use: talk(key, name, lines) });
  // Beverly spends her days out on the Circle; after hours she's home
  const bevHome = () => { const h = hourNow(); return h < 7 || h >= 20; };
  const mildredHome = () => { const h = hourNow(); return h < 7 || h >= 18; };

  HOUSE_DRESS.humphries = {
    tv: 'lawn', enterLabel: 'knock at the Humphries’ (no bell)',
    stairs: 'At the top of the stairs, a closed door with a laminated sign: “OFFICE OF THE PRESIDENT. BY APPOINTMENT.” There are no appointments. There have never been appointments.',
    build: (B, X, Z, bl, things) => {
      // forty-one Yards of the Month, in a grid, on the east wall; one gap
      for (let k = 0; k < 42; k++) {
        if (k === 41) continue; // this month's goes here. obviously.
        const plaque = box(0.05, 0.3, 0.24, k % 7 === 3 ? 0xd9b24a : 0xc9a24a);
        plaque.position.set(X(5.82), 1.2 + Math.floor(k / 7) * 0.36, Z(-0.2 + (k % 7) * 0.32));
        group.add(plaque);
      }
      things.push({ pos: new THREE.Vector3(X(5.2), 0, Z(0.8)), r: 1.4, label: 'count the plaques',
        use: () => ui.say(['YARD OF THE MONTH. YARD OF THE MONTH. YARD OF THE MONTH… forty-one of them, brass on walnut, in a grid of seven by six.', 'The last space in the grid is empty, and the nail is already in.']) });
      // the covenant, in four binders, on the counter
      for (let k = 0; k < 4; k++) {
        const binder = box(0.18, 0.5, 0.4, [0x2f5f50, 0x8c2f39, 0x2e3e5c, 0x6a5a3a][k]);
        binder.position.set(X(2.6 + k * 0.22), 1.26, Z(-4.1));
        group.add(binder);
      }
      things.push({ pos: new THREE.Vector3(X(3.0), 0, Z(-3.0)), r: 1.2, label: 'read the covenant',
        use: () => ui.say(nextLine('covenant', COVENANT), { speaker: 'The Covenant' }) });
      const harold = folk('camel', { body: CAMEL_DK, humps: 2 }, X(1.3), 0, Z(0.6), 0.3, { shirt: 0x8a9a7a, glasses: true });
      const paper = box(0.6, 0.02, 0.4, 0xf3efe2);
      paper.position.set(X(3.6), 0.8, Z(1.7));
      group.add(paper);
      things.push(talkThing(() => harold.position, 'harold', 'Harold', HAROLD));
      // Beverly, after hours, at the island, with a clipboard
      const bevIn = folk('camel', { body: CAMEL_LT, humps: 1 }, X(3.6), 0, Z(-0.2), 0.2, { visor: 0xffffff, pearls: [1.28, 0.62, 0.35], clipboard: true, fidget: true });
      (inside[`oasis_humphries`] ??= []).push(() => { bevIn.visible = bevHome(); });
      things.push({ getPos: () => bevIn.position, r: 2.2, label: 'talk to Beverly', enabled: () => bevHome(), use: () => beverlyTalk(true) });
    },
  };
  HOUSE_DRESS.featherstones = {
    tv: 'birds', enterLabel: 'knock at the Featherstones’',
    build: (B, X, Z, bl, things) => {
      // Grandpa Sal in the armchair, repeating the television
      const arm = box(1.1, 0.5, 1.0, 0x6f8a6a);
      arm.position.set(X(-5.0), 0.25, Z(-1.6));
      const armBack = box(0.3, 0.9, 1.0, 0x6f8a6a);
      armBack.position.set(X(-5.4), 0.6, Z(-1.6));
      group.add(arm, armBack);
      bl.push({ x: X(-5.0), z: Z(-1.6), w: 1.2, d: 1.1 });
      const sal = folk('parrot', { body: 0x9aa0a8, head: 0x9aa0a8, wing: 0x7a8088, tail: 0xc8342c }, X(-4.9), 0.35, Z(-1.6), 2.6, { shirt: 0xb8a88a, glasses: true });
      things.push(talkThing(() => sal.position, 'sal', 'Grandpa Sal', SAL));
      const sunny = folk('parrot', { body: 0x5cbf4a, head: 0x5cbf4a, wing: 0x2e8a5a, tail: 0x3a7dd8, face: 0xf2e08a }, X(3.6), 0, Z(-0.4), 0, { apron: 0xf28fb0, fidget: true });
      things.push(talkThing(() => sunny.position, 'sunny', 'Sunny', SUNNY));
      // a perch by the window, because some habits are for keeps
      const perch = cyl(0.04, 0.04, 1.4, 5, 0x8a6a4a);
      perch.position.set(X(-5.2), 0.7, Z(2.6));
      const bar = cyl(0.03, 0.03, 0.8, 5, 0x8a6a4a);
      bar.rotation.z = Math.PI / 2;
      bar.position.set(X(-5.2), 1.4, Z(2.6));
      group.add(perch, bar);
      bl.push({ x: X(-5.2), z: Z(2.6), r: 0.3 });
    },
  };
  HOUSE_DRESS.brontos = {
    tv: 'game', enterLabel: 'knock at the Brontos’',
    stairs: 'The stairs go up. Gary has to go up them on his knees. He says it’s good for him. Linda says it’s good for the stairs.',
    build: (B, X, Z, bl, things) => {
      const linda = folk('bronto', { body: 0x9ab8a0, head: 0x9ab8a0, belly: 0xe0e6c8, spots: 0x7a9a80 }, X(-3.2), 0.28, Z(0.1), Math.PI, { pearls: [1.1, 0.72, 0.5] });
      linda.scale.setScalar(0.85);
      things.push(talkThing(() => linda.position, 'linda', 'Linda', LINDA));
      // an extremely large salad bowl
      const bowl = new THREE.Mesh(new THREE.SphereGeometry(0.55, 8, 4, 0, Math.PI * 2, Math.PI / 2, Math.PI / 2), mat(0xfaf6ec));
      bowl.position.set(X(3.6), 1.55, Z(-1.5));
      const greens = ball(0.5, 0x5cbf4a, 1);
      greens.scale.y = 0.35;
      greens.position.set(X(3.6), 1.52, Z(-1.5));
      group.add(bowl, greens);
      things.push({ pos: new THREE.Vector3(X(3.6), 0, Z(-0.4)), r: 1.2, label: 'look at the salad',
        use: () => ui.say('A salad the size of a small pond. A card taped to the bowl: “LUNCH (JUNIOR) — for the swim.”') });
    },
  };
  HOUSE_DRESS.todd = {
    tv: 'cartoon', enterLabel: 'knock at Todd’s',
    build: (B, X, Z, bl, things) => {
      const k1 = folk('camel', { body: CAMEL, humps: 1 }, X(-3.9), 0, Z(-2.5), Math.PI, { scale: 0.55, cap: 0x3a7dd8 });
      const k2 = folk('camel', { body: CAMEL, humps: 1 }, X(-2.5), 0, Z(-2.6), Math.PI, { scale: 0.55, cap: 0xd8342c });
      things.push({ getPos: () => k1.position, r: 1.8, label: 'talk to the twins', use: () => ui.say(nextLine('twins', TWINS)) });
      void k2;
      for (let k = 0; k < 6; k++) {
        const blk = box(0.22, 0.22, 0.22, [0xd8342c, 0x3a7dd8, 0xf2cf5b][k % 3]);
        blk.position.set(X(-1.2 + (k % 3) * 0.3), 0.11 + Math.floor(k / 3) * 0.22, Z(0.9 + (k % 2) * 0.2));
        blk.rotation.y = k * 0.4;
        group.add(blk);
      }
      things.push({ pos: new THREE.Vector3(X(5.2), 0, Z(-2.9)), r: 1.2, label: 'read the fridge',
        use: () => ui.say('Magnets, a calendar, and a drawing in crayon: a camel on a riding mower, going around and around a green circle. Underneath, in careful kid letters: “DAD (MOWING).”') });
    },
  };
  HOUSE_DRESS.openhouse = {
    tv: 'fire', enterLabel: 'go into the Open House (it’s open)',
    stairs: 'The stairs go up to three staged bedrooms. Each bed has eleven throw pillows. Nobody has ever sat on any of them. That’s how you know it’s staged.',
    build: (B, X, Z, bl, things) => {
      const tiffany = folk('parrot', { body: 0xe86a9a, head: 0xe86a9a, wing: 0xb03a6a, tail: 0xf2cf5b, face: 0xfff0f4 }, X(0.6), 0, Z(1.2), 0, { shirt: 0xf6c0d4, fidget: true });
      things.push({ getPos: () => tiffany.position, r: 2.2, label: 'talk to Tiffany', use: () => tiffanyTalk() });
      // staging: a bowl of lemons (plastic), a tray of cookies (for the smell)
      for (let k = 0; k < 5; k++) {
        const lemon = ball(0.12, 0xf2e05b);
        lemon.scale.set(1, 0.8, 1.2);
        lemon.position.set(X(3.4 + (k % 3) * 0.2 - 0.2), 1.1 + Math.floor(k / 3) * 0.1, Z(-1.5 + (k % 2) * 0.15));
        group.add(lemon);
      }
      const tray = box(0.8, 0.04, 0.5, 0x9aa0a6);
      tray.position.set(X(4.0), 1.03, Z(-4.0));
      group.add(tray);
      for (let k = 0; k < 6; k++) {
        const cookie = cyl(0.08, 0.08, 0.03, 7, 0xc9905a);
        cookie.position.set(X(3.75 + (k % 3) * 0.25), 1.07, Z(-4.1 + Math.floor(k / 3) * 0.2));
        group.add(cookie);
      }
      things.push({ pos: new THREE.Vector3(X(4.0), 0, Z(-3.0)), r: 1.2, label: 'take a cookie',
        use: () => ui.say('You reach for one. Tiffany, from across the room, without turning: “Those are for the smell, darling.”', { speaker: '' }) });
      wallSign('HOME', X(3.6), 2.4, Z(-4.3), 0, 1.4, { fg: '#b89a7a' });
    },
  };
  HOUSE_DRESS.dunes = {
    tv: 'lullaby', enterLabel: 'knock at the Dunes’',
    build: (B, X, Z, bl, things) => {
      const chad = folk('camel', { body: CAMEL, humps: 1 }, X(1.9), 0, Z(0.9), -0.4, { shirt: 0x5a6a7a });
      const madison = folk('camel', { body: CAMEL_LT, humps: 1 }, X(-0.4), 0, Z(1.0), 0.4, { shirt: 0xd8b8c8, bow: 0xf28fb0 });
      things.push({ getPos: () => chad.position, r: 2.2, label: 'talk to Chad & Madison', use: () => ui.say(nextLine('dunes', DUNES2)) });
      void madison;
      // moving boxes, still, all labeled the same
      for (let k = 0; k < 7; k++) {
        const bx = box(0.7, 0.55, 0.6, 0xc9a77a);
        bx.position.set(X(-5.1 + (k % 2) * 0.75), 0.28 + Math.floor(k / 2) * 0.56 - (k > 5 ? 0.56 : 0), Z(2.3 + (k > 5 ? 0.8 : 0)));
        group.add(bx);
        const lbl = box(0.4, 0.12, 0.02, 0xffffff);
        lbl.position.set(bx.position.x, bx.position.y, bx.position.z + 0.31);
        group.add(lbl);
      }
      bl.push({ x: X(-4.7), z: Z(2.6), w: 1.6, d: 1.5 });
      things.push({ pos: new THREE.Vector3(X(-4.6), 0, Z(1.4)), r: 1.2, label: 'read the boxes',
        use: () => ui.say('Every box says BOX 12.') });
      // the bassinet, and baby Sahara
      const bas = new THREE.Mesh(new THREE.CylinderGeometry(0.45, 0.35, 0.45, 8, 1, true), mat(0xfaf6ec));
      bas.material.side = THREE.DoubleSide;
      bas.position.set(X(0.9), 0.55, Z(-1.3));
      const basLegs = box(0.6, 0.4, 0.6, 0xd8ccb8);
      basLegs.position.set(X(0.9), 0.2, Z(-1.3));
      group.add(bas, basLegs);
      const baby = folk('camel', { body: CAMEL_LT, humps: 1 }, X(0.9), 0.35, Z(-1.3), 0, { scale: 0.33 });
      bl.push({ x: X(0.9), z: Z(-1.3), r: 0.5 });
      things.push({ getPos: () => baby.position, r: 1.3, label: 'peek at the baby',
        use: () => ui.say('Baby Sahara blinks up at you, slowly, with enormous heavy-lidded eyes. Four weeks old and already, somehow, unimpressed.') });
    },
  };
  HOUSE_DRESS.mildred = {
    tv: 'golf', enterLabel: 'knock at Mildred & Walt’s',
    build: (B, X, Z, bl, things) => {
      // Walt's recliner, angled at the golf
      const rec = box(1.1, 0.55, 1.1, 0x7a5a3a);
      rec.position.set(X(-5.0), 0.28, Z(-1.2));
      const recBack = box(0.3, 1.0, 1.1, 0x7a5a3a);
      recBack.position.set(X(-5.5), 0.7, Z(-1.2));
      group.add(rec, recBack);
      bl.push({ x: X(-5.0), z: Z(-1.2), w: 1.2, d: 1.2 });
      const walt = folk('camel', { body: 0xc8b08a, humps: 2, tuft: 0xe8e0d0 }, X(-4.9), 0.35, Z(-1.2), 2.6, { shirt: 0x6a5a8a, glasses: true });
      things.push(talkThing(() => walt.position, 'walt', 'Walt', WALT));
      const cat = buildAnimal('cat', { body: 0xe8a860 });
      cat.scale.setScalar(0.45);
      cat.position.set(X(-4.2), 0.3, Z(0.4));
      cat.rotation.y = 2.4;
      group.add(cat);
      // doilies and the candy dish (butterscotch, 1994, forever)
      const dish = new THREE.Mesh(new THREE.SphereGeometry(0.25, 8, 4, 0, Math.PI * 2, Math.PI / 2, Math.PI / 2), mat(0xbfe6f2, 0.3));
      dish.position.set(X(-3.2), 0.72, Z(-1.7));
      group.add(dish);
      for (let k = 0; k < 5; k++) {
        const candy = ball(0.05, 0xe8a830);
        candy.position.set(X(-3.3 + (k % 3) * 0.08), 0.6, Z(-1.72 + (k % 2) * 0.08));
        group.add(candy);
      }
      things.push({ pos: new THREE.Vector3(X(-3.2), 0, Z(-0.9)), r: 1.1, label: 'take a butterscotch',
        use: () => ui.say('You unwrap one. It has been in this dish since before the lawns went in. It is perfect. Butterscotch is forever.') });
      // Mildred, after the mall closes: her walking shoes by the door, and her
      const mil = folk('camel', { body: 0xd8c0a0, humps: 1 }, X(1.0), 0, Z(1.4), 0, { shirt: 0xb89ad8, visor: 0xffffff, fidget: true });
      (inside['oasis_mildred'] ??= []).push(() => { mil.visible = mildredHome(); });
      things.push({ getPos: () => mil.position, r: 2.2, label: 'talk to Mildred', enabled: () => mildredHome(), use: talk('mildred', 'Mildred', MILDRED) });
      for (let k = 0; k < 7; k++) {
        const tr = box(0.22, 0.34, 0.12, 0xd9b24a);
        tr.position.set(X(5.82), 1.9, Z(-0.5 + k * 0.35));
        tr.rotation.y = Math.PI / 2;
        group.add(tr);
      }
      things.push({ pos: new THREE.Vector3(X(5.2), 0, Z(0.5)), r: 1.3, label: 'read the ribbons',
        use: () => ui.say('Seven pedometers, retired, mounted on the wall like trophies. The last one reads 9,999,999. It gave out. Mildred didn’t.') });
    },
  };
  HOUSES.forEach((h, k) => standardInterior(h, k));

  // ============================================== out on the Circle ----
  const toLocal = (h, x, z) => {
    const du = x - O.x - h.u, dv = z - O.z - h.v, c = Math.cos(h.ry), sn = Math.sin(h.ry);
    return [du * c - dv * sn, du * sn + dv * c];
  };
  const face = (a, x, z) => { a.rotation.y = Math.atan2(x - a.position.x, z - a.position.z); };

  // --- Beverly, on her rounds -------------------------------------------
  const bev = folk('camel', { body: CAMEL_LT, humps: 1 }, 0, 0, 0, 0, { visor: 0xffffff, pearls: [1.28, 0.62, 0.35], clipboard: true });
  const BEV_R = (RING.rIn + RING.rOut) / 2;
  const bevState = { a: -Math.PI / 2, pause: 2, stopAt: 0 };
  const houseAngles = HOUSES.map((h) => (h.deg * Math.PI) / 180).sort((a, b) => a - b);
  zones.addMover({ zone: 'island', obj: bev, r: 0.55 });
  let lawnT = 0, citedAt = -1e9;
  outdoor.push((dt, t, pp) => {
    bev.visible = !bevHome();
    if (!bev.visible) return;
    const busy = ui.isBusy() && Math.hypot(pp.x - bev.position.x, pp.z - bev.position.z) < 4;
    if (busy) { face(bev, pp.x, pp.z); animateGait(bev, t, 0); return; }
    if (bevState.pause > 0) {
      bevState.pause -= dt;
      animateGait(bev, t, 0);
    } else {
      const na = bevState.a + (0.9 / BEV_R) * dt;
      const nx = O.x + RING.u + Math.cos(na) * BEV_R, nz = O.z + RING.v + Math.sin(na) * BEV_R;
      if (Math.hypot(pp.x - nx, pp.z - nz) < 1.0) { animateGait(bev, t, 0); return; } // you're in the way; she waits (pointedly)
      // passing a house? stop and inspect it
      for (const ha of houseAngles) {
        const wrap = (x) => ((x % (Math.PI * 2)) + Math.PI * 3) % (Math.PI * 2) - Math.PI;
        if (wrap(bevState.a - ha) < 0 && wrap(na - ha) >= 0) {
          bevState.pause = 3.5;
          bevState.inspect = ha;
        }
      }
      bevState.a = na;
      bev.position.set(nx, GY, nz);
      bev.rotation.y = Math.atan2(-Math.sin(na), Math.cos(na));
      animateGait(bev, t, 0.8, 7);
    }
    if (bevState.pause > 0 && bevState.inspect !== undefined) {
      face(bev, O.x + RING.u + Math.cos(bevState.inspect) * HOUSE_R, O.z + RING.v + Math.sin(bevState.inspect) * HOUSE_R);
    }
    if (bev.position.y === 0) bev.position.set(O.x + RING.u, GY, O.z + RING.v - BEV_R);
    // the Humphries lawn is NOT for walking on
    const H = HOUSE.humphries;
    const [lx, lz] = toLocal(H, pp.x, pp.z);
    const onLawn = lz > 2.3 && lz < HOUSE_R - RING.rOut - 0.2 && lx > -3.9 && lx < 3.9 && !(lx > -2.45 && lx < -1.35) && !(lx > 0.95);
    lawnT = onLawn ? lawnT + dt : 0;
    if (lawnT > 1.2 && t - citedAt > 60 && !ui.isBusy()) {
      citedAt = t;
      lawnT = 0;
      face(bev, pp.x, pp.z);
      S.addItem('hoa_notice');
      ui.say([
        { speaker: 'Beverly', voice: VOICE.beverly, text: 'Off. The. Lawn.' },
        { speaker: 'Beverly', voice: VOICE.beverly, text: 'That’s two and a half inches of Yard of the Month you’re standing on. Forty-one months. Off. Here — this is yours.' },
      ]).then(() => ui.toast('Beverly hands you a <b>Notice of Violation</b>. It is already filled out.', '📋'));
    }
  });
  register({
    getPos: () => bev.position, r: 2.4,
    label: 'talk to Beverly',
    enabled: () => bev.visible,
    use: () => beverlyTalk(false),
  });
  async function beverlyTalk() {
    const B_ = { speaker: 'Beverly', voice: VOICE.beverly };
    if (!S.hasFlag('metBeverly')) {
      S.setFlag('metBeverly');
      await ui.say([
        'Beverly Humphries. President. Of the Homeowners’ Association. Of Oasis Estates. Of — well. Of this.',
        'You’re not a homeowner. I checked. I check everyone. You may walk on the Parkway, the Drive, the walks, and the Circle. You may NOT walk on a lawn. We’ll get along fine.',
      ], B_);
    }
    const c = await ui.ask(nextLine('beverly', BEVERLY), [
      { label: '📏 “How’s the grass?”', value: 'grass' },
      { label: '👏 “You’re doing a great job.”', value: 'praise' },
      { label: '🙃 “Who elected you, anyway?”', value: 'mess' },
      { label: 'Back away slowly', value: null },
    ], B_);
    if (c === 'grass') {
      await ui.say([
        'She takes a folding ruler from her visor. She kneels. She measures.',
        { ...B_, text: 'Two and a half. … Two and a half. … Two and — TODD. This blade is two and five-eighths.' },
        { speaker: 'Todd', voice: VOICE.todd, text: '(from very far away) On it!' },
      ]);
    } else if (c === 'praise') {
      if (!S.hasFlag('praisedBeverly')) {
        S.setFlag('praisedBeverly');
        await ui.say(['…', 'Thank you. Nobody says that.', 'Don’t tell anyone I said thank you. I have a reputation. I built it by hand.'], B_);
      } else {
        await ui.say('I know.', B_);
      }
    } else if (c === 'mess') {
      const had = S.countItem('hoa_notice');
      S.addItem('hoa_notice');
      await ui.say(had
        ? ['That’s another one. I’ve started a file on you. It already has a tab with your name on it.', 'I made the tab this morning. I had a feeling.']
        : ['I did. It was a very close vote. One to nothing.', 'What’s your name, dear? No — don’t tell me. I’ll find out.', 'Here.'], B_);
      ui.toast('A <b>Notice of Violation</b>. Beverly writes very, very fast.', '📋');
    }
  }
  function tiffanyTalk() {
    const T = { speaker: 'Tiffany', voice: VOICE.tiffany };
    return ui.ask(nextLine('tiffany', TIFFANY), [
      { label: '💰 Ask the price', value: 'price' },
      { label: '📝 Make an offer', value: 'offer' },
      { label: 'Just looking', value: null },
    ], T).then((c) => {
      if (c === 'price') {
        return ui.say([
          'The… price? Oh! Oh my goodness. Nobody has ever — one moment, darling.',
          '(She takes out a card she has clearly been keeping in her blazer for a very long time.)',
          'Three million, two hundred thousand buttons. … That’s before the HOA fees.',
        ].map((text) => ({ ...T, text, speaker: text.startsWith('(') ? '' : 'Tiffany' })));
      }
      if (c === 'offer') {
        return ui.say([
          'An OFFER! Oh, I’m — I’m going to need to sit down. On a staged chair. Which I’m not allowed to sit on.',
          'Darling, the Board would have to approve you. The Board is Beverly. … I’ll put you down as “enthusiastic.”',
        ], T);
      }
      return null;
    });
  }
  // her OPEN HOUSE sign, and balloons, out at the curb
  {
    const H = HOUSE.openhouse;
    const [su, sv] = H.L(0.2, HOUSE_R - RING.rOut - 0.6);
    const sg = sign(['OPEN HOUSE', 'TODAY! (every day)', 'TIFFANY · 555-OASIS'], { w: 1.3, h: 0.95, bg: '#ffffff', fg: '#c8346a', border: '#c8346a' });
    put(sg, su, sv, 0.95, H.ry);
    put(box(0.08, 0.6, 0.08, 0xfaf6ec), su, sv, 0.3, H.ry);
    solidDisc(su, sv, 0.2);
    for (let k = 0; k < 3; k++) {
      const [bu, bv] = H.L(0.7 + k * 0.25, HOUSE_R - RING.rOut - 0.6 + (k % 2) * 0.15);
      const b = new THREE.Mesh(new THREE.IcosahedronGeometry(0.2, 1), mat([0xf28fb0, 0xffffff, 0xf2cf5b][k], 0.4));
      b.scale.y = 1.2;
      b.castShadow = true;
      put(b, bu, bv, 1.7 + k * 0.2);
      const str = box(0.01, 1.6 + k * 0.2, 0.01, 0xffffff);
      put(str, bu, bv, 0.85 + k * 0.1);
      outdoor.push((dt, t) => { b.position.x = O.x + bu + Math.sin(t * 1.3 + k) * 0.06; });
    }
  }
  // Dolores (Mildred's flamingo), in the front lawn, watching Beverly
  {
    const H = HOUSE.mildred;
    const [fu, fv] = H.L(-0.2, 3.3);
    const fl = new THREE.Group();
    const pink = 0xf07aa8;
    const body = ball(0.25, pink, 1);
    body.scale.set(0.8, 0.8, 1.2);
    body.position.y = 0.95;
    const leg = cyl(0.02, 0.02, 0.85, 4, 0x3a3a3e);
    leg.position.y = 0.45;
    const neck = cyl(0.04, 0.05, 0.6, 5, pink);
    neck.position.set(0, 1.35, 0.2);
    neck.rotation.x = 0.4;
    const head = ball(0.1, pink);
    head.position.set(0, 1.65, 0.3);
    const beak = new THREE.Mesh(new THREE.ConeGeometry(0.04, 0.16, 4), mat(0x2a2a2e));
    beak.rotation.x = Math.PI / 2 + 0.7;
    beak.position.set(0, 1.6, 0.4);
    fl.add(body, leg, neck, head, beak);
    fl.traverse((o) => { if (o.isMesh) o.castShadow = o.receiveShadow = true; });
    put(fl, fu, fv, 0, H.ry + 0.6);
    solidDisc(fu, fv, 0.25);
    register({
      pos: new THREE.Vector3(O.x + fu, 0, O.z + fv), r: 1.5,
      label: 'regard Dolores',
      use: () => ui.say([
        'A pink plastic flamingo, one leg, head cocked, in the middle of Mildred and Walt’s lawn. Her name is Dolores.',
        'She is angled, very precisely, toward wherever Beverly happens to be standing.',
      ]),
    });
    outdoor.push(() => {
      if (bev.visible) fl.rotation.y = Math.atan2(bev.position.x - fl.position.x, bev.position.z - fl.position.z);
    });
  }
  // sprinklers: a few front lawns, ticking round (in the morning and at
  // dusk, per the covenant — and whenever Todd says so)
  function sprinkler(u, v) {
    const g = new THREE.Group();
    const head = cyl(0.06, 0.08, 0.12, 6, 0x3a3a3e);
    head.position.y = 0.06;
    g.add(head);
    const drops = [];
    const dropMat = new THREE.MeshBasicMaterial({ color: 0xcfeefa, transparent: true, opacity: 0.75 });
    for (let k = 0; k < 10; k++) {
      const dr = new THREE.Mesh(new THREE.IcosahedronGeometry(0.045, 0), dropMat);
      g.add(dr);
      drops.push(dr);
    }
    put(g, u, v);
    outdoor.push((dt, t) => {
      const h = hourNow();
      const on = (h >= 6 && h < 9) || (h >= 18 && h < 20);
      g.visible = true;
      drops.forEach((dr, k) => {
        dr.visible = on;
        if (!on) return;
        const ph = (t * 0.6 + k / drops.length) % 1;
        const ang = Math.sin(t * 0.8) * 1.2;
        const r = ph * 2.2;
        dr.position.set(Math.sin(ang) * r, 0.15 + ph * (1 - ph) * 2.4, Math.cos(ang) * r);
      });
    });
  }
  for (const id of ['humphries', 'featherstones', 'todd', 'dunes']) {
    const [su, sv] = HOUSE[id].L(-0.2, 3.6);
    sprinkler(su, sv);
  }

  // --- Gary, at the grill, in the Brontos' backyard ------------------------
  {
    const H = HOUSE.brontos;
    const [gu, gv] = H.yard(1.2, 0.55);
    const grill = new THREE.Group();
    const kettle = new THREE.Mesh(new THREE.SphereGeometry(0.42, 8, 4, 0, Math.PI * 2, Math.PI / 2, Math.PI / 2), mat(0x2a2a2e));
    kettle.position.y = 0.95;
    const lid = new THREE.Mesh(new THREE.SphereGeometry(0.42, 8, 4, 0, Math.PI * 2, 0, Math.PI / 2), mat(0x2a2a2e));
    lid.position.set(0.3, 1.05, 0);
    lid.rotation.z = -1.2;
    grill.add(kettle, lid);
    for (let k = 0; k < 3; k++) {
      const leg = cyl(0.03, 0.03, 0.95, 4, 0x3a3a3e);
      const a = (k / 3) * Math.PI * 2;
      leg.position.set(Math.cos(a) * 0.25, 0.47, Math.sin(a) * 0.25);
      grill.add(leg);
    }
    for (let k = 0; k < 3; k++) {
      const patty = cyl(0.12, 0.12, 0.05, 7, 0x7a4a2a);
      patty.position.set(-0.15 + k * 0.15, 0.97, (k % 2) * 0.12 - 0.06);
      grill.add(patty);
    }
    grill.traverse((o) => { if (o.isMesh) o.castShadow = o.receiveShadow = true; });
    put(grill, gu, gv, 0, H.ry);
    solidDisc(gu, gv, 0.5);
    // smoke: a few soft puffs, recycled
    const puffs = [];
    for (let k = 0; k < 5; k++) {
      const pf = new THREE.Mesh(new THREE.IcosahedronGeometry(0.18, 0), new THREE.MeshBasicMaterial({ color: 0xe8e4dc, transparent: true, opacity: 0.5 }));
      put(pf, gu, gv, 1.2);
      puffs.push(pf);
    }
    outdoor.push((dt, t) => {
      puffs.forEach((pf, k) => {
        const ph = (t * 0.25 + k / puffs.length) % 1;
        pf.position.set(O.x + gu + Math.sin(ph * 5 + k) * 0.2, GY + 1.2 + ph * 2.2, O.z + gv + ph * 0.3);
        pf.scale.setScalar(0.6 + ph * 1.6);
        pf.material.opacity = 0.5 * (1 - ph);
      });
    });
    const [pu, pv] = H.yard(-1.2, 0.55);
    const gary = folk('bronto', { body: 0x8fb58a, head: 0x8fb58a }, O.x + pu, GY, O.z + pv, 0, { apron: 0xd8342c, cap: 0x2e3e5c });
    face(gary, O.x + gu, O.z + gv);
    gary.userData.fidget = true;
    solidDisc(pu, pv, 0.9);
    { const tu = pu - Math.sin(gary.rotation.y) * 1.4, tv = pv - Math.cos(gary.rotation.y) * 1.4; solidDisc(tu, tv, 0.5); } // and his tail
    register({ getPos: () => gary.position, r: 2.6, label: 'talk to Gary', use: talk('gary', 'Gary', GARY) });
    // a picnic table, set for a burger nobody has yet received
    const [tu, tv2] = H.yard(-2.4, 0.2);
    const pt = new THREE.Group();
    const top = box(1.6, 0.08, 0.8, 0x9a7448);
    top.position.y = 0.72;
    pt.add(top);
    for (const sz of [-0.62, 0.62]) {
      const bench = box(1.6, 0.06, 0.28, 0x9a7448);
      bench.position.set(0, 0.42, sz);
      pt.add(bench);
    }
    for (const sx of [-0.65, 0.65]) {
      const leg = box(0.08, 0.72, 1.4, 0x7a5a3a);
      leg.position.set(sx, 0.36, 0);
      pt.add(leg);
    }
    pt.traverse((o) => { if (o.isMesh) o.castShadow = o.receiveShadow = true; });
    put(pt, tu, tv2, 0, H.ry);
    solidBox(tu, tv2, 1.7, 1.5, H.ry);
  }

  // --- No Outlet, in the Brontos' garage ------------------------------------
  {
    const H = HOUSE.brontos;
    const floorY = 0.12;
    const [fu, fv] = H.L(2.3, -0.1);
    zones.addSurfaceBox(O.x + fu, O.z + fv, 2.6, HD - 0.4, GY + floorY, H.ry);
    const at = (lx, lz) => { const [u, v] = H.L(lx, lz); return [O.x + u, O.z + v]; };
    const band = [];
    // Dakota, drums, at the back
    {
      const [x, z] = at(2.3, -1.1);
      const kit = new THREE.Group();
      const bass = cyl(0.32, 0.32, 0.3, 10, 0xd8342c);
      bass.rotation.x = Math.PI / 2;
      bass.position.set(0, 0.34, 0.5);
      const snare = cyl(0.18, 0.18, 0.12, 9, 0xeeeeee);
      snare.position.set(-0.35, 0.6, 0.35);
      const cym = cyl(0.25, 0.25, 0.02, 10, 0xd9b24a);
      cym.position.set(0.45, 1.05, 0.35);
      const cstand = cyl(0.015, 0.015, 1.0, 4, 0x9aa0a6);
      cstand.position.set(0.45, 0.55, 0.35);
      kit.add(bass, snare, cym, cstand);
      kit.traverse((o) => { if (o.isMesh) o.castShadow = o.receiveShadow = true; });
      kit.position.set(x, GY + floorY, z);
      kit.rotation.y = H.ry;
      group.add(kit);
      const d = folk('camel', { body: CAMEL, humps: 2 }, x, GY + floorY, z, H.ry, { cap: 0x2a2a2e });
      d.scale.setScalar(0.8);
      band.push({ a: d, name: 'Dakota', cym });
    }
    {
      const [x, z] = at(1.55, 0.6);
      const k = folk('parrot', { body: 0x2a2a30, head: 0x2a2a30, wing: 0x7ad85a, tail: 0x7ad85a, face: 0xe8e8e8 }, x, GY + floorY, z, H.ry + 0.3);
      k.scale.setScalar(0.85);
      const guitar = new THREE.Group();
      const gb = box(0.3, 0.42, 0.08, 0x7ad85a);
      const neck = box(0.06, 0.6, 0.05, 0x2a2a2e);
      neck.position.set(0.18, 0.35, 0);
      neck.rotation.z = -0.9;
      guitar.add(gb, neck);
      guitar.position.set(0.05, 0.6, 0.5);
      guitar.rotation.z = 0.5;
      k.add(guitar);
      band.push({ a: k, name: 'Kiwi' });
    }
    {
      const [x, z] = at(3.0, 0.8);
      const j = folk('bronto', { body: 0x8fb58a, head: 0x8fb58a }, x, GY + floorY, z, H.ry - 0.3, { cap: 0xd8342c });
      j.scale.setScalar(0.62);
      const bassG = new THREE.Group();
      const bb = box(0.42, 0.5, 0.1, 0x3a7dd8);
      const neck = box(0.07, 0.9, 0.06, 0x2a2a2e);
      neck.position.set(0.3, 0.45, 0);
      neck.rotation.z = -0.9;
      bassG.add(bb, neck);
      bassG.position.set(0, 0.8, 0.95);
      bassG.rotation.z = 0.5;
      j.add(bassG);
      band.push({ a: j, name: 'Junior' });
    }
    // amps, a poster, a lamp: garage band canon
    for (const [lx, lz, c] of [[1.2, -1.4, 0x2a2a2e], [3.3, -1.5, 0x2a2a2e]]) {
      const [x, z] = at(lx, lz);
      const amp = box(0.6, 0.7, 0.4, c);
      amp.position.set(x, GY + floorY + 0.35, z);
      amp.rotation.y = H.ry;
      group.add(amp);
      const grille = box(0.5, 0.5, 0.02, 0x55555a);
      const [gx, gz] = at(lx, lz + 0.21);
      grille.position.set(gx, GY + floorY + 0.4, gz);
      grille.rotation.y = H.ry;
      group.add(grille);
    }
    const [px, pz] = at(2.3, -HD / 2 + 0.22);
    const poster = sign(['NO OUTLET', 'getting out of this town', 'tues 2–4 (all days)'], { w: 1.3, h: 0.9, d: 0.03, bg: '#2a2a30', fg: '#7ad85a' });
    poster.position.set(px, GY + 1.5, pz);
    poster.rotation.y = H.ry;
    group.add(poster);
    for (const b of band) zones.addBlocker(b.a.position.x, b.a.position.z, 0.45);
    { const j = band[2].a; zones.addBlocker(j.position.x - Math.sin(j.rotation.y) * 1.0, j.position.z - Math.cos(j.rotation.y) * 1.0, 0.4); } // Junior's tail
    for (const [lx, lz] of [[1.2, -1.4], [3.3, -1.5]]) { const [x, z] = at(lx, lz); zones.addBlocker(x, z, 0.42); } // the amps
    const [mx, mz] = at(2.3, 1.7);
    let jam = 0;
    outdoor.push((dt, t) => {
      jam = Math.max(0, jam - dt);
      const k = jam > 0 ? 1 : 0.35;
      band.forEach((b, i) => {
        const hd = b.a.userData.parts.head;
        hd.rotation.x = Math.max(0, Math.sin(t * (jam > 0 ? 11 : 6) + i)) * 0.35 * k;
        if (b.cym) b.cym.rotation.z = Math.sin(t * 12) * 0.15 * k;
      });
    });
    register({
      pos: new THREE.Vector3(mx, 0, mz), r: 2.2,
      label: 'talk to No Outlet',
      use: async () => {
        const c = await ui.ask('A garage. Three amps, one poster, one drum kit, and a band that is very much getting out of this town.', [
          { label: '💬 “What’s the band about?”', value: 'chat' },
          { label: '🎸 Request a song', value: 'song' },
          { label: 'Nod along and leave', value: null },
        ]);
        if (c === 'chat') {
          const set = nextLine('band', BAND);
          await ui.say(set.map(([sp, text]) => ({ speaker: sp, voice: BAND_VOICE[sp], text })));
        } else if (c === 'song') {
          await ui.say([
            { speaker: 'Kiwi', voice: BAND_VOICE.Kiwi, text: 'This one’s called “Cul-de-Sac.” It goes around and around.' },
            { speaker: 'Dakota', voice: BAND_VOICE.Dakota, text: 'One, two — one, two, three, four —' },
          ]);
          jam = playCulDeSac();
          setTimeout(() => {
            if (zones.current() === 'island') {
              ui.say([
                { speaker: 'Kiwi', voice: BAND_VOICE.Kiwi, text: 'THANK YOU, OASIS ESTATES! WE’RE GETTING OUT OF THIS TOWN!' },
                { speaker: 'Junior', voice: BAND_VOICE.Junior, text: '(after snack)' },
              ]);
            }
          }, (jam + 0.6) * 1000);
        }
      },
    });
  }
  // the band's one song, on the sfx bus: power chords (root + fifth),
  // a kick and a snare. about eight seconds. loud-ish. within the permit.
  function playCulDeSac() {
    const bpm = 168, e8 = 60 / bpm / 2;
    const hz = (m) => 440 * Math.pow(2, (m - 69) / 12);
    const bars = [[40, 40, 40, 40, 43, 43, 45, 45], [40, 40, 40, 40, 48, 48, 47, 47]];
    let when = 0.05;
    for (let rep = 0; rep < 2; rep++) {
      for (const bar of bars) {
        bar.forEach((m, k) => {
          tone(hz(m), { time: when, dur: e8 * 0.8, type: 'sawtooth', vol: 0.035 });
          tone(hz(m + 7), { time: when, dur: e8 * 0.8, type: 'sawtooth', vol: 0.025 });
          if (k % 4 === 0) tone(70, { time: when, dur: 0.14, type: 'sine', vol: 0.09, slide: -35 });
          if (k % 4 === 2) tone(240, { time: when, dur: 0.05, type: 'square', vol: 0.03, slide: -80 });
          when += e8;
        });
      }
    }
    tone(hz(40), { time: when, dur: 0.9, type: 'sawtooth', vol: 0.04 });
    tone(hz(47), { time: when, dur: 0.9, type: 'sawtooth', vol: 0.03 });
    tone(70, { time: when, dur: 0.3, type: 'sine', vol: 0.1, slide: -35 });
    return when + 0.9;
  }

  // --- Todd, mowing, in stripes ---------------------------------------------
  {
    const mower = new THREE.Group();
    const deck = box(1.2, 0.3, 1.5, 0x3f8a3f);
    deck.position.y = 0.4;
    const seat = box(0.6, 0.15, 0.5, 0x2a2a2e);
    seat.position.set(0, 0.62, -0.3);
    const hood = box(1.0, 0.35, 0.6, 0x3f8a3f);
    hood.position.set(0, 0.65, 0.45);
    const wheelMesh = (r, x, z) => {
      const w = new THREE.Mesh(new THREE.CylinderGeometry(r, r, 0.18, 8), mat(0x2a2a2e));
      w.rotation.z = Math.PI / 2;
      w.position.set(x, r, z);
      return w;
    };
    const steer = cyl(0.18, 0.18, 0.04, 8, 0x2a2a2e);
    steer.position.set(0, 1.0, 0.25);
    steer.rotation.x = -0.6;
    mower.add(deck, seat, hood, steer, wheelMesh(0.28, -0.62, -0.5), wheelMesh(0.28, 0.62, -0.5), wheelMesh(0.18, -0.55, 0.55), wheelMesh(0.18, 0.55, 0.55));
    mower.traverse((o) => { if (o.isMesh) o.castShadow = o.receiveShadow = true; });
    const todd = buildAnimal('camel', { body: CAMEL_DK, humps: 1 });
    dress(todd, { cap: 0x3f8a3f, shirt: 0xe8e0cc });
    todd.scale.setScalar(0.7);
    todd.position.set(0, 0.2, -0.35);
    mower.add(todd);
    group.add(mower);
    zones.addMover({ zone: 'island', obj: mower, r: 0.85 });
    // stripes, north–south, back and forth, forever, on the lawn south of
    // the pool
    const U0 = 13.2, U1 = 19.8, V0 = 18.8, V1 = 24.6, STEP = 1.3;
    const lanes = [];
    for (let u = U0; u <= U1 + 0.01; u += STEP) lanes.push(u);
    const path = [];
    lanes.forEach((u, k) => { const a = k % 2 ? V1 : V0, b = k % 2 ? V0 : V1; path.push([u, a], [u, b]); });
    for (let k = path.length - 2; k > 0; k--) path.push(path[k]); // and back again
    const m = { i: 0, x: path[0][0], z: path[0][1] };
    mower.position.set(O.x + m.x, GY, O.z + m.z);
    let vroom = 0;
    outdoor.push((dt, t, pp) => {
      const hr = hourNow();
      todd.visible = hr >= 7 && hr < 20; // after dark the mower waits where he left it
      if (!todd.visible) return;
      if (ui.isBusy() && Math.hypot(pp.x - mower.position.x, pp.z - mower.position.z) < 4) return; // he stops to chat
      const [tu, tv] = path[m.i];
      const dx = tu - m.x, dz = tv - m.z, d = Math.hypot(dx, dz);
      if (d < 0.05) { m.i = (m.i + 1) % path.length; return; }
      const want = Math.atan2(dx, dz);
      const diff = Math.atan2(Math.sin(want - mower.rotation.y), Math.cos(want - mower.rotation.y));
      if (Math.abs(diff) > 0.05) { mower.rotation.y += Math.sign(diff) * Math.min(Math.abs(diff), 2.2 * dt); return; }
      const nx = m.x + (dx / d) * Math.min(d, 1.1 * dt), nz = m.z + (dz / d) * Math.min(d, 1.1 * dt);
      if (Math.hypot(pp.x - O.x - nx, pp.z - O.z - nz) < 1.3) return; // you're on his lawn; he waits, idling politely
      m.x = nx; m.z = nz;
      mower.position.set(O.x + m.x, GY + Math.sin(t * 30) * 0.01, O.z + m.z);
      vroom -= dt;
      if (vroom <= 0 && Math.hypot(pp.x - mower.position.x, pp.z - mower.position.z) < 9) {
        vroom = 0.35;
        tone(82 + Math.random() * 6, { dur: 0.3, type: 'triangle', vol: 0.012 });
      }
    });
    register({ getPos: () => mower.position, r: 2.4, label: 'talk to Todd', enabled: () => todd.visible, use: talk('todd', 'Todd', TODD) });
    register({ getPos: () => mower.position, r: 2.4, label: 'look at the mower', enabled: () => !todd.visible,
      use: () => ui.say('The riding mower, parked mid-stripe for the night, exactly where Todd stopped. The key is in it. The key is always in it. Nobody here would dream.') });
  }

  // --- the kids, at the playground --------------------------------------------
  {
    const P = RING;
    const kidA = folk('parrot', { body: 0xf2cf5b, head: 0xf2cf5b, wing: 0x3a7dd8, tail: 0xd8342c }, 0, 0, 0, 0, { scale: 0.5 });
    const kidB = folk('parrot', { body: 0x3a9ad8, head: 0x3a9ad8, wing: 0xf2cf5b, tail: 0x5cbf4a }, 0, 0, 0, 0, { scale: 0.5 });
    const kidC = folk('camel', { body: CAMEL_LT, humps: 1 }, 0, 0, 0, 0, { scale: 0.45, bow: 0xf28fb0 });
    // A swings; B and C work the seesaw
    const seat = h0Swings[0];
    outdoor.push((dt, t) => {
      const hr = hourNow();
      const out = hr >= 7 && hr < 20; // bedtime is bedtime
      kidA.visible = kidB.visible = kidC.visible = out;
      if (!out) return;
      const sw = Math.sin(t * 2.2) * 0.55;
      h0Swings[0].rotation.x = sw;
      h0Swings[1].rotation.x = Math.sin(t * 1.3 + 1) * 0.08;
      seat.updateMatrixWorld(true);
      const sp = new THREE.Vector3(0, -1.45, 0).applyMatrix4(seat.matrixWorld);
      kidA.position.copy(sp);
      kidA.rotation.y = 0.2 + Math.PI;
      const tilt = Math.sin(t * 1.6) * 0.28;
      h0Seesaw.rotation.z = tilt;
      h0Seesaw.parent.updateMatrixWorld(true);
      for (const [kid, end] of [[kidB, -1.1], [kidC, 1.1]]) {
        const p = new THREE.Vector3(end, 0.04, 0).applyMatrix4(h0Seesaw.matrixWorld);
        kid.position.set(p.x, p.y, p.z);
      }
    });
    kidB.rotation.y = 0.1 + Math.PI / 2;
    kidC.rotation.y = 0.1 - Math.PI / 2;
    register({
      pos: new THREE.Vector3(O.x + P.u, 0, O.z + P.v), r: 4.2, priority: 0,
      label: 'talk to the kids',
      enabled: () => kidA.visible,
      use: talk('kids', 'the kids', KIDS),
    });
  }

  // ======================================================== shopping ----
  // one buying loop for every till on the island: pick a thing, pay, hear
  // about it. goods: [{ id?, label?, emoji?, price, say, then? }]
  async function till(who, voiceKey, prompt, goods, { thanks = '', once = null } = {}) {
    const V = { speaker: who, voice: VOICE[voiceKey] ?? 480 };
    const c = await ui.ask(prompt, [
      ...goods.map((g, k) => ({
        label: `${g.emoji ?? ITEMS[g.id].emoji} ${g.label ?? ITEMS[g.id].name}`, value: String(k), hint: `${g.price}🔘`,
        disabled: S.state.buttons < g.price || (g.hat && S.state.hats.includes(g.hat)),
      })),
      { label: 'Just looking', value: null },
    ], V);
    if (c === null || c === undefined) return;
    const g = goods[Number(c)];
    S.spend(g.price);
    if (g.hat) S.ownHat(g.hat);
    else if (g.id) S.addItem(g.id);
    kaching();
    ui.updateHUD();
    if (g.id) ui.toast(`You bought <b>${ITEMS[g.id].name}</b>.${thanks ? ' ' + thanks : ''}`, ITEMS[g.id].emoji);
    const lines = typeof g.say === 'function' ? g.say() : g.say;
    await ui.say(lines, V);
    await g.then?.();
    void once;
  }
  // shelves stocked with little bright things (seeded, like everything placed)
  function shelfUnit(x, z, ry, w = 3.0, palette = [0xd8342c, 0xf2cf5b, 0x3a7dd8, 0x5cbf4a, 0xf28fb0, 0xe8e0cc]) {
    const g = new THREE.Group();
    const back = box(w, 1.8, 0.1, 0xf3efe2);
    back.position.y = 0.9;
    g.add(back);
    for (const ly of [0.1, 0.65, 1.2, 1.75]) {
      const plank = box(w, 0.05, 0.55, 0xe0d8c8);
      plank.position.set(0, ly, 0.22);
      g.add(plank);
      if (ly > 1.7) continue;
      for (let k = 0; k < Math.floor(w / 0.32); k++) {
        const c = palette[Math.floor(rand(0, palette.length))];
        const tall = rand(0.18, 0.38);
        const it = rand(0, 1) < 0.5 ? box(0.24, tall, 0.2, c) : cyl(0.1, 0.1, tall, 7, c);
        it.position.set(-w / 2 + 0.2 + k * 0.32, ly + 0.03 + tall / 2, 0.24);
        g.add(it);
      }
    }
    g.position.set(x, 0, z);
    g.rotation.y = ry;
    group.add(g);
    return g;
  }
  function counterTop(x, z, w, d, color = 0xfaf6ec, top = 0x6a5a4a) {
    const c = box(w, 1.0, d, color);
    c.position.set(x, 0.5, z);
    const t = box(w + 0.1, 0.06, d + 0.1, top);
    t.position.set(x, 1.03, z);
    group.add(c, t);
  }
  function tillBox(x, z) {
    const reg = box(0.45, 0.3, 0.35, 0x3a3a3e);
    reg.position.set(x, 1.2, z);
    const scr = box(0.35, 0.22, 0.04, 0x7ad8c8);
    scr.position.set(x, 1.48, z + 0.05);
    scr.rotation.x = -0.3;
    group.add(reg, scr);
  }

  // --------------------------------------------------- Trader Polly's ----
  {
    const B = IN.polly, W0 = 16, D0 = 11;
    room('polly', '🦜 Trader Polly’s', B, {
      w: W0, d: D0, floor: 0xc9a77a, wall: 0xf4ead4,
      build: (B, bl, things) => {
        const X = (lx) => B.x + lx, Z = (lz) => B.z + lz;
        // the mural band: parrots and waves, hand-painted by the crew
        const mural = sign(['🦜 TRADER POLLY’S 🦜', 'a neighborhood grocery · crew-owned · no bell'], { w: 12, h: 1.2, d: 0.05, bg: '#3fb8a8', fg: '#fff4dc' });
        mural.position.set(B.x, 2.9, Z(-5.32));
        group.add(mural);
        // three aisles, back to back
        for (const lx of [-4.5, 0, 4.5]) {
          shelfUnit(X(lx), Z(-1.6), 0, 3.2);
          shelfUnit(X(lx), Z(-1.9), Math.PI, 3.2);
          bl.push({ x: X(lx), z: Z(-1.75), w: 3.3, d: 1.3 });
          const tag = sign(lx < 0 ? 'EVERYTHING BUT THE BELL — BACK IN STOCK' : lx > 0 ? 'COOKIE BUTTER · AISLE OF DREAMS' : 'MANGO (DRIED) · NO COMMENT', { w: 3.0, h: 0.35, d: 0.03, bg: '#fff4dc', fg: '#c0392b' });
          tag.position.set(X(lx), 2.2, Z(-1.75));
          group.add(tag);
        }
        shelfUnit(X(-4.5), Z(-5.1), 0, 5);
        shelfUnit(X(3.5), Z(-5.1), 0, 5);
        bl.push({ x: X(-4.5), z: Z(-5.0), w: 5, d: 0.7 }, { x: X(3.5), z: Z(-5.0), w: 5, d: 0.7 });
        // the till, by the door, and Pico
        counterTop(X(-4.8), Z(3.0), 2.6, 0.9);
        tillBox(X(-4.3), Z(3.0));
        bl.push({ x: X(-4.8), z: Z(3.0), w: 2.6, d: 0.9 });
        const pico = folk('parrot', { body: 0x7ad85a, head: 0xf2e05b, wing: 0x3a9a4a, tail: 0x3a7dd8, face: 0xf2e05b }, X(-4.8), 0, Z(2.2), Math.PI, { scale: 0.75, floral: ['#c0392b', '#f2cf5b', '#ffffff'], fidget: true });
        pico.rotation.y = 0;
        pico.position.z = Z(2.0);
        // the Captain, by the flowers, in the shirt
        const mango = folk('parrot', { body: 0xd8342c, head: 0xd8342c, wing: 0x2a6fd0, tail: 0xf2cf5b }, X(3.2), 0, Z(2.2), -0.4, { floral: ['#3fb8a8', '#f2cf5b', '#f28fb0', '#ffffff'], fidget: true });
        // flower buckets by the door
        for (let k = 0; k < 5; k++) {
          const bucket = cyl(0.26, 0.22, 0.45, 8, 0x9aa0a6);
          bucket.position.set(X(4.6 + (k % 3) * 0.6), 0.22, Z(3.6 - Math.floor(k / 3) * 0.6));
          group.add(bucket);
          for (let f = 0; f < 5; f++) {
            const bloom = ball(0.09, [0xf28fb0, 0xf2cf5b, 0xffffff, 0xd8342c, 0xb89ad8][(k + f) % 5]);
            bloom.position.set(bucket.position.x + Math.cos(f * 1.3) * 0.13, 0.6 + (f % 2) * 0.1, bucket.position.z + Math.sin(f * 1.3) * 0.13);
            group.add(bloom);
          }
        }
        bl.push({ x: X(5.2), z: Z(3.3), w: 1.9, d: 1.2 });
        // the bell mount, on the wall by the till. there is no bell on it.
        const bracket = box(0.5, 0.08, 0.3, 0xb08d3a);
        bracket.position.set(X(-7.8), 2.2, Z(2.2));
        const hook = cyl(0.03, 0.03, 0.25, 5, 0xb08d3a);
        hook.position.set(X(-7.65), 2.05, Z(2.2));
        group.add(bracket, hook);
        const card = sign(['PLEASE SAY', '“BRRRING”'], { w: 0.7, h: 0.45, d: 0.03, bg: '#fff4dc', fg: '#c0392b' });
        card.position.set(X(-7.83), 1.7, Z(2.2));
        card.rotation.y = Math.PI / 2;
        group.add(card);
        things.push({ pos: new THREE.Vector3(X(-7.1), 0, Z(2.2)), r: 1.2, label: 'look at the bell mount',
          use: () => ui.say([
            'A brass bracket, polished, with a hook for a ship’s bell. There is no bell on the hook. There has never been a bell on the hook.',
            'A card underneath: PLEASE SAY “BRRRING.”',
          ]) });
        // the sample station
        counterTop(X(0), Z(2.2), 1.2, 0.7, 0xc0392b, 0xfaf6ec);
        for (let k = 0; k < 4; k++) {
          const cup = cyl(0.05, 0.04, 0.08, 6, 0xffffff);
          cup.position.set(X(-0.4 + k * 0.25), 1.1, Z(2.2));
          group.add(cup);
        }
        bl.push({ x: X(0), z: Z(2.2), w: 1.2, d: 0.7 });
        things.push({ pos: new THREE.Vector3(X(0), 0, Z(3.0)), r: 1.2, label: 'try today’s sample',
          use: () => ui.say(nextLine('sample', [
            'Today’s sample: cookie butter on a pretzel crisp, in a paper cup the size of a thimble. It is the best thing you have eaten this week. It is gone.',
            'Today’s sample: a single cube of cheese with a flag in it. The flag says CHEESE. It is correct.',
            'Today’s sample: mandarin chick’n, one piece, on a toothpick. From the same people as the nuggets. Nobody asks.',
            'Today’s sample: coffee, in a thimble. It’s a Mirage blend. Echo would like you to know that Echo would like you to know that.',
          ])) });
        // the Fearless Feather, in a rack by the door (free)
        const rack = box(0.6, 1.1, 0.3, 0x3fb8a8);
        rack.position.set(X(-1.8), 0.55, Z(4.6));
        group.add(rack);
        things.push({ pos: new THREE.Vector3(X(-1.8), 0, Z(4.0)), r: 1.1, label: 'take a Fearless Feather',
          use: () => {
            if (S.countItem('fearless_feather') > 0) return ui.say('You already have this issue. The next one comes out when the Captain finishes the letter about the bell. So: not soon.');
            S.addItem('fearless_feather');
            ui.toast('You took <b>The Fearless Feather</b>. It’s free. Everything free is a little bit fearless.', '📰');
          } });
        bl.push({ x: X(-1.8), z: Z(4.6), w: 0.6, d: 0.3 });
        const goods = [
          { id: 'ebtb_seasoning', price: 4, say: ['Everything But The Bell! BRRRING! — sorry. One Everything But The Bell.', 'It’s got everything. Sesame, poppy, garlic, onion, salt. Not the bell. The bell’s the only thing it hasn’t got.'] },
          { id: 'cookie_butter', price: 5, say: 'Cookie butter! BRRRING! That’s the “good choice” brrring. I have different brrrings. That one was the good one.' },
          { id: 'two_button_chuck', price: 2, say: 'Two-Button Chuck! Two buttons! It says so on it! BRRRING!' },
          { id: 'dried_mango', price: 6, say: 'Dried mango. … BRRRING. (Don’t tell the Captain I said it quietly. He’s sensitive about the mango.)' },
        ];
        things.push({ getPos: () => pico.position, r: 2.0, label: 'check out with Pico',
          use: async () => {
            await ui.say(nextLine('pico', PICO), { speaker: 'Pico', voice: VOICE.pico });
            await till('Pico', 'pico', 'Paper or paper? (It’s paper.) What’ve you got?', goods);
          } });
        things.push(talkThing(() => mango.position, 'mango', 'Captain Mango', MANGO));
      },
    });
  }

  // ------------------------------------------------------- Dromedeals ----
  {
    const B = IN.drom, W0 = 16, D0 = 11;
    room('drom', '🐪 Dromedeals', B, {
      w: W0, d: D0, floor: 0xd8d4cc, wall: 0xf6f2ec,
      build: (B, bl, things) => {
        const X = (lx) => B.x + lx, Z = (lz) => B.z + lz;
        const banner = sign(['DROMEDEALS', 'brand names · one hump or two · compare at: everything'], { w: 10, h: 1.1, d: 0.05, bg: '#ffffff', fg: '#a8232d' });
        banner.position.set(B.x, 2.9, Z(-5.32));
        group.add(banner);
        // clothing racks, arranged by nothing (this is the treasure hunt)
        const rackSpots = [[-5.2, -2.6, 0.2], [-2.4, -3.2, -0.3], [-4.6, 0.2, 1.3], [-1.6, -0.4, 0.5], [0.8, -2.8, -0.1]];
        for (const [lx, lz, ry] of rackSpots) {
          const r = new THREE.Group();
          const bar = cyl(0.03, 0.03, 1.9, 5, 0x9aa0a6);
          bar.rotation.z = Math.PI / 2;
          bar.position.y = 1.45;
          r.add(bar);
          for (const sx of [-0.9, 0.9]) {
            const leg = cyl(0.03, 0.03, 1.45, 5, 0x9aa0a6);
            leg.position.set(sx, 0.72, 0);
            r.add(leg);
          }
          for (let k = 0; k < 8; k++) {
            const shirt = box(0.08, 0.7, 0.5, [0xa8232d, 0x3a7dd8, 0xf2cf5b, 0xf6f2ec, 0x5cbf4a, 0xb89ad8, 0x2a2a2e][Math.floor(rand(0, 7))]);
            shirt.position.set(-0.8 + k * 0.23, 1.05, 0);
            r.add(shirt);
          }
          r.position.set(X(lx), 0, Z(lz));
          r.rotation.y = ry;
          group.add(r);
          bl.push({ x: X(lx), z: Z(lz), w: 2.0, d: 0.7, rot: ry });
        }
        // home goods, along the east: pineapples, candles, signs, a lamp
        shelfUnit(X(5.2), Z(-2.0), -Math.PI / 2, 4.2, [0xd9b24a, 0xf6f2ec, 0xa8232d, 0x8c7f72]);
        bl.push({ x: X(5.2), z: Z(-2.0), w: 0.7, d: 4.2 });
        // the pineapple table (they come in every shipment; nobody orders them)
        table(X(3.4), Z(2.2), 1.4, 1.0, 0xf6f2ec);
        bl.push({ x: X(3.4), z: Z(2.2), w: 1.5, d: 1.1 });
        for (let k = 0; k < 6; k++) {
          const pine = ball(0.14, 0xd9b24a);
          pine.scale.y = 1.4;
          pine.position.set(X(2.9 + (k % 3) * 0.5), 0.98, Z(1.95 + Math.floor(k / 3) * 0.5));
          const crown = new THREE.Mesh(new THREE.ConeGeometry(0.08, 0.18, 5), mat(0x3f9a45));
          crown.position.set(pine.position.x, 1.26, pine.position.z);
          group.add(pine, crown);
        }
        const clear = sign(['CLEARANCE', 'compare at: more'], { w: 2.2, h: 0.7, d: 0.05, bg: '#a8232d', fg: '#ffffff' });
        clear.position.set(X(5.9), 2.35, Z(-2.0));
        clear.rotation.y = -Math.PI / 2;
        group.add(clear);
        // the register, and Deb, glasses on a chain
        counterTop(X(-5.2), Z(3.2), 3.0, 0.9);
        tillBox(X(-4.6), Z(3.2));
        bl.push({ x: X(-5.2), z: Z(3.2), w: 3.0, d: 0.9 });
        const deb = folk('camel', { body: CAMEL, humps: 2 }, X(-5.2), 0, Z(2.2), 0, { shirt: 0xa8232d, glasses: true, fidget: true });
        // shoppers, treasure-hunting
        const s1 = folk('camel', { body: 0xe0c8a0, humps: 1 }, X(-3.2), 0, Z(-1.4), 2.4, { visor: 0xffffff, shirt: 0x9ad8c8 });
        const s2 = folk('parrot', { body: 0xf2cf5b, head: 0xf2cf5b, wing: 0x3a7dd8, tail: 0xd8342c }, X(2.6), 0, Z(-0.8), -0.8, {});
        things.push({ getPos: () => s1.position, r: 1.8, label: 'talk to the shopper',
          use: () => ui.say('I came in for a lamp. I am leaving with a ceramic pineapple, a candle that smells like sand, and a sense that the lamp was never the point.', { speaker: 'a shopper', voice: 420 }) });
        things.push({ getPos: () => s2.position, r: 1.8, label: 'talk to the other shopper',
          use: () => ui.say('Shh. I’m in the zone. There is a designer visor on this rack somewhere. I can FEEL it.', { speaker: 'another shopper', voice: 640 }) });
        things.push({ pos: new THREE.Vector3(X(-1.0), 0, Z(-1.8)), r: 1.4, priority: 0, label: 'rummage the racks',
          use: () => ui.say(nextLine('rummage', [
            'You rummage. A sweater with one sleeve longer than the other. COMPARE AT: 300🔘. You put it back. You think about it for the rest of the day.',
            'You rummage. A bathrobe that says HIS on it. There is no HERS. There is a HERS somewhere, in another Dromedeals, looking for this one.',
            'You rummage. A pair of sunglasses shaped like pineapples. Next to them, a ceramic pineapple wearing sunglasses. This store is having a conversation with itself.',
            'You rummage. A throw pillow that says “SAND HAPPENS.” A throw pillow that says “LIVE LAUGH LOUNGE.” A throw pillow that just says “PILLOW.” You respect that one the most.',
            'You rummage. A single designer visor, perfect, crisp, white. You turn around to show someone and when you turn back, a mall walker has it. That’s the Dromedeal.',
          ])) });
        const goods = [
          { hat: 'tennis_visor', label: `${ITEMS.tennis_visor.name} (cmp. 900)`, emoji: ITEMS.tennis_visor.emoji, price: 30,
            say: ['A tennis visor. Compare at nine hundred. Yours for thirty. You just saved eight hundred and seventy buttons, hon. That’s basically earning.', '(Press H to wear it. You’re a Dromedealista now.)'] },
          { id: 'live_laugh_lounge', label: `${ITEMS.live_laugh_lounge.name} (cmp. 240)`, price: 12, say: 'Oh, that’s a classic. Every house on the Circle has one. Same spot. Same nail. It’s nice to belong.' },
          { id: 'ceramic_pineapple', label: `${ITEMS.ceramic_pineapple.name} (cmp. 180)`, price: 9, say: 'The pineapples. They come in every shipment. Every one. I never ordered a single pineapple. Take it, hon. Take two. Please.' },
          { id: 'candle_sand', label: `${ITEMS.candle_sand.name} (cmp. 90)`, price: 5, say: 'Scent: Sand. It smells exactly like sand. It’s our bestseller. Nobody here has ever been to a desert. Everybody here misses it.' },
        ];
        things.push({ getPos: () => deb.position, r: 2.2, label: 'talk to Deb',
          use: async () => {
            await ui.say(nextLine('deb', DEB), { speaker: 'Deb', voice: VOICE.deb });
            await till('Deb', 'deb', 'Find anything, hon? Or did anything find you?', goods);
          } });
      },
    });
  }

  // ---------------------------------------------------- Mirage Coffee ----
  {
    const B = IN.mirage, W0 = 12, D0 = 9;
    room('mirage', '☕ Mirage Coffee', B, {
      w: W0, d: D0, floor: 0x8a6a4a, wall: 0xe8e0cc,
      build: (B, bl, things) => {
        const X = (lx) => B.x + lx, Z = (lz) => B.z + lz;
        // the menu board, big and green, with more words than a menu needs
        const menu = sign(['MIRAGE · coffee, probably', 'SHAKEN ESPRESSO · SANDSTORM FRAPPÉ', seasonalName() + ' · JUST A COFFEE (?)', 'SIZES: SMALL · MEDIUM · DUNE'], { w: 6.5, h: 1.9, d: 0.05, bg: '#2f5f50', fg: '#f4efe2' });
        menu.position.set(X(-0.5), 2.6, Z(-4.32));
        group.add(menu);
        // the bar: counter, espresso machine, the pastry case, the handoff
        counterTop(X(-0.5), Z(-2.2), 6.5, 0.9, 0x2f5f50, 0xe8e0cc);
        bl.push({ x: X(-0.5), z: Z(-2.2), w: 6.5, d: 0.9 });
        const machine = box(1.1, 0.6, 0.5, 0xc8ccd0);
        machine.position.set(X(-2.2), 1.36, Z(-2.3));
        group.add(machine);
        for (const sx of [-0.3, 0.3]) {
          const spout = cyl(0.05, 0.05, 0.2, 5, 0x3a3a3e);
          spout.position.set(X(-2.2 + sx), 1.0 + 0.1, Z(-2.0));
          group.add(spout);
        }
        const pcase = box(1.6, 0.5, 0.7, 0xbfe6f2);
        pcase.material = new THREE.MeshStandardMaterial({ color: 0xbfe6f2, transparent: true, opacity: 0.55, roughness: 0.2 });
        pcase.position.set(X(1.6), 1.3, Z(-2.2));
        group.add(pcase);
        for (let k = 0; k < 5; k++) {
          const pastry = ball(0.12, [0xd9a45a, 0xc9905a, 0xf2e0b0][k % 3]);
          pastry.scale.y = 0.6;
          pastry.position.set(X(1.0 + k * 0.28), 1.15, Z(-2.2));
          group.add(pastry);
        }
        for (let k = 0; k < 6; k++) {
          const cup = cyl(0.09, 0.07, 0.3, 7, 0xf6f2ec);
          cup.position.set(X(2.6 + (k % 3) * 0.22), 1.2, Z(-2.0 + Math.floor(k / 3) * 0.22));
          group.add(cup);
          const straw = cyl(0.015, 0.015, 0.3, 4, 0x2f8a5a);
          straw.position.set(cup.position.x, 1.45, cup.position.z);
          group.add(straw);
        }
        const echo = folk('parrot', { body: 0x9aa0a8, head: 0x9aa0a8, wing: 0x7a8088, tail: 0xc8342c }, X(-0.8), 0, Z(-3.2), 0, { apron: 0x2f5f50, fidget: true });
        // tables: a laptop camel "working remotely"; a quiet corner
        table(X(-3.8), Z(1.4), 1.1, 0.8, 0x3a3a3e);
        chair(X(-3.8), Z(2.1), Math.PI, 0x3a3a3e);
        const laptop = box(0.5, 0.03, 0.35, 0x9aa0a6);
        laptop.position.set(X(-3.8), 0.8, Z(1.4));
        const lid = box(0.5, 0.35, 0.03, 0x9aa0a6);
        lid.position.set(X(-3.8), 0.97, Z(1.2));
        group.add(laptop, lid);
        const remote = folk('camel', { body: 0xe0c8a0, humps: 1 }, X(-3.8), 0.2, Z(2.2), Math.PI, { shirt: 0x6a7a8a, scale: 0.9 });
        bl.push({ x: X(-3.8), z: Z(1.7), w: 1.2, d: 1.6 });
        things.push({ getPos: () => remote.position, r: 1.8, label: 'talk to the camel with the laptop',
          use: () => ui.say(nextLine('remote', [
            'Oh — sorry, I’m on a call. … No, you’re fine, I’m muted. I’m always muted. I’ve been muted since spring.',
            'I work remotely. From here. Every day. For a company on an island I’ve never been to. I think it’s the Labs? It might be the Labs.',
            'This is my fourth shaken espresso. I’m not shaking. The espresso is shaking. That’s the brand.',
          ]), { speaker: 'Skyler', voice: 360 }) });
        for (const [lx, lz] of [[3.4, 1.2], [3.4, 3.0]]) {
          table(X(lx), Z(lz), 0.9, 0.9, 0x3a3a3e);
          chair(X(lx - 0.8), Z(lz), Math.PI / 2, 0x3a3a3e);
          chair(X(lx + 0.8), Z(lz), -Math.PI / 2, 0x3a3a3e);
          bl.push({ x: X(lx), z: Z(lz), w: 2.2, d: 1.0 });
        }
        plant(X(-5.3), Z(3.6));
        bl.push({ x: X(-5.3), z: Z(3.6), r: 0.35 });
        const drinks = [
          { label: 'Iced Brown Sugar Oat Shaken Espresso', emoji: '🧋', price: 8, secs: 60,
            say: () => ['One Iced Brown Sugar Oat Milk Shaken Espresso. Shaken. Shaken again. Shaken a third time, for luck. Can I get a name for the cup?', ...cupName()] },
          { label: 'Double Caramel Sandstorm Frappé', emoji: '🥤', price: 9, secs: 45,
            say: () => ['A Double Caramel Sandstorm Frappé, blended, with whip, with caramel drizzle, with caramel drizzle ON the caramel drizzle, in a Dune. Name for the cup?', ...cupName()] },
          { label: seasonalName(), emoji: '☕', price: 7, secs: 50,
            say: () => [`The ${seasonalName()}. It’s back. It never left. It’s the season and the season is it. Name?`, ...cupName()] },
          { label: 'Just a coffee', emoji: '☕', price: 3, secs: 30,
            say: () => ['Just… a coffee. Just a coffee. … Okay. Okay! I can do that. I think I can do that. Give me a second.', '(It takes eleven minutes. It is perfect. Echo looks shaken, which, here, is a compliment.)', ...cupName()] },
        ].map((d) => ({ ...d, then: () => { S.drinkCoffee(d.secs); sip(); } }));
        things.push({ getPos: () => echo.position, r: 2.6, label: 'order from Echo',
          use: async () => {
            await ui.say(nextLine('echo', ECHO), { speaker: 'Echo', voice: VOICE.echo });
            await till('Echo', 'echo', 'What can I get started for you? What can I get started for you?', drinks);
          } });
      },
    });
  }
  function seasonalName() {
    const now = new Date().getMonth();
    return now >= 8 && now <= 10 ? 'Pumpkin Spice Latte' : now >= 2 && now <= 4 ? 'Blossom Spice Latte' : now >= 5 && now <= 7 ? 'Iced Sunscreen Spice Latte' : 'Frost Spice Latte';
  }
  // Echo spells your name the way it sounded
  function cupName() {
    const n = (S.state.name || 'Friend').trim() || 'Friend';
    const tries = [
      (x) => x.replace(/y$/i, 'ee'),
      (x) => x.replace(/[aeiou]/i, (m) => m + m),
      (x) => x.replace(/s/i, 'z'),
      (x) => x.replace(/c/i, 'k'),
      (x) => x + 'h',
    ];
    let odd = n;
    for (const f of tries) { odd = f(n); if (odd !== n) break; }
    S.addItem('mirage_cup');
    return [`(The cup says “${odd}.” Close. Closer than most.)`];
  }

  // ------------------------------------------------------ Cluck & Co. ----
  {
    const B = IN.cluck, W0 = 12, D0 = 9;
    room('cluck', '🍗 Cluck & Co.', B, {
      w: W0, d: D0, floor: 0xe8dcc8, wall: 0xfaf4ec,
      build: (B, bl, things) => {
        const X = (lx) => B.x + lx, Z = (lz) => B.z + lz;
        const menu = sign(['Cluck & Co.', 'NUGGETS · THE SANDWICH · WAFFLE FRIES · LEMONADE', 'it’s not chicken · it’s our pleasure · closed sundays'], { w: 7, h: 1.5, d: 0.05, bg: '#c8342c', fg: '#ffffff' });
        menu.position.set(X(0), 2.7, Z(-4.32));
        group.add(menu);
        counterTop(X(0), Z(-2.3), 6.5, 0.9, 0xc8342c, 0xfaf6ec);
        bl.push({ x: X(0), z: Z(-2.3), w: 6.5, d: 0.9 });
        for (const lx of [-2, 0, 2]) tillBox(X(lx), Z(-2.3));
        const tanner = folk('camel', { body: CAMEL, humps: 1 }, X(0), 0, Z(-3.3), 0, { cap: 0xc8342c, apron: 0xffffff, fidget: true });
        // booths, red, along the west wall
        for (const lz of [-0.4, 2.0]) {
          table(X(-4.4), Z(lz), 1.2, 0.9, 0xfaf6ec);
          for (const sz of [-0.8, 0.8]) {
            const seat = box(1.3, 0.5, 0.5, 0xc8342c);
            seat.position.set(X(-4.4), 0.25, Z(lz + sz));
            const back = box(1.3, 0.7, 0.15, 0xc8342c);
            back.position.set(X(-4.4), 0.7, Z(lz + sz * 1.3));
            group.add(seat, back);
          }
          bl.push({ x: X(-4.4), z: Z(lz), w: 1.4, d: 2.3 });
        }
        // the PlayPlace, in the corner: a tiny slide and a ball pit
        const pit = box(2.0, 0.4, 2.0, 0x3a7dd8);
        pit.position.set(X(4.3), 0.2, Z(2.6));
        group.add(pit);
        for (let k = 0; k < 18; k++) {
          const b = ball(0.12, [0xd8342c, 0xf2cf5b, 0x3a7dd8, 0x5cbf4a][k % 4]);
          b.position.set(X(3.5 + (k % 6) * 0.3), 0.45, Z(1.9 + Math.floor(k / 6) * 0.5));
          group.add(b);
        }
        bl.push({ x: X(4.3), z: Z(2.6), w: 2.0, d: 2.0 });
        things.push({ pos: new THREE.Vector3(X(4.3), 0, Z(1.2)), r: 1.3, label: 'look at the ball pit',
          use: () => ui.say('A sign: “PLAYPLACE — AGES 3 TO 7.” A smaller sign under it, newer, in Beverly’s handwriting: “AND NOT GARY.”') });
        const goods = [
          { id: 'cluck_nuggets', price: 6, say: 'Eight-count nuggets! And three Cluck Sauces! My pleasure!', then: () => { S.addItem('cluck_sauce'); } },
          { id: 'waffle_fries', price: 4, say: 'Waffle fries! My pleasure! They’re the best shape a potato can be. The potato told me. It was its pleasure.' },
          { label: 'A lemonade (drink it here)', emoji: '🍋', price: 3, say: 'One lemonade! My pleasure! Fresh-squeezed! I squeezed it! It was my — yes. You know.', then: () => { S.drinkCoffee(20); sip(); } },
        ];
        things.push({ getPos: () => tanner.position, r: 2.6, label: 'order from Tanner',
          use: async () => {
            await ui.say(nextLine('tanner', TANNER), { speaker: 'Tanner', voice: VOICE.tanner });
            const c = await ui.ask('What can I get for you today?', [
              { label: '🍗 Order', value: 'order' },
              { label: '🙏 “Thank you!”', value: 'thanks' },
              { label: 'Leave', value: null },
            ], { speaker: 'Tanner', voice: VOICE.tanner });
            if (c === 'order') await till('Tanner', 'tanner', 'It would be my pleasure. What’ll it be?', goods);
            if (c === 'thanks') {
              const k = (said.cluckThanks = (said.cluckThanks ?? 0) + 1);
              await ui.say(k === 1 ? 'My pleasure!' : k === 2 ? 'My pleasure.' : k === 3 ? '…It really is.' : 'It is. It really, really is.', { speaker: 'Tanner', voice: VOICE.tanner });
            }
          } });
      },
    });
  }

  // ======================================================== the CaMall ----
  // One long bright hall. A fountain in the middle (wishes: one button), the
  // food court west, the stores along the back — Sahara, Hot Tropic (closed;
  // it's always closed), Sunglass Hump, SPACE AVAILABLE — an escalator to a
  // second floor there isn't, a lotion kiosk, a bronto on a segway, and the
  // mall walkers, going round, since seven.
  {
    const B = IN.mall, W0 = 30, D0 = 20;
    room('mall', '🛍️ The CaMall', B, {
      w: W0, d: D0, wallH: 5, floor: 0xf0e8dc, wall: 0xf6e3d8,
      lighting: { ...SUBURB_LIGHT, bg: 0x3a4a48, fog: 0x3a4a48, hemiSky: 0xffffff, hemiGround: 0x9aa8a0, hemiIntensity: 2.0, fogFar: 80 },
      build: (B, bl, things) => {
        const X = (lx) => B.x + lx, Z = (lz) => B.z + lz;
        const FT = { x: 0, z: -0.8 };
        // floor inlay: a teal ring around the fountain court
        const inlayGeo = new THREE.RingGeometry(3.2, 3.6, 24);
        inlayGeo.rotateX(-Math.PI / 2);
        const inlay = new THREE.Mesh(inlayGeo, mat(0x3fb8a8));
        inlay.position.set(X(FT.x), 0.02, Z(FT.z));
        group.add(inlay);
        // the fountain: a basin, water, a spout, arcs of water that fall back
        const basin = cyl(2.1, 2.2, 0.6, 14, 0xe8dcc8);
        basin.position.set(X(FT.x), 0.3, Z(FT.z));
        const water = cyl(1.9, 1.9, 0.08, 14, 0x49c6e0);
        water.material = new THREE.MeshStandardMaterial({ color: 0x49c6e0, roughness: 0.2, transparent: true, opacity: 0.85, flatShading: true });
        water.position.set(X(FT.x), 0.56, Z(FT.z));
        const spout = cyl(0.25, 0.35, 1.4, 8, 0xe8dcc8);
        spout.position.set(X(FT.x), 1.0, Z(FT.z));
        const bowl = cyl(0.7, 0.3, 0.25, 10, 0xe8dcc8);
        bowl.position.set(X(FT.x), 1.8, Z(FT.z));
        group.add(basin, water, spout, bowl);
        const jets = [];
        const jetMat = new THREE.MeshBasicMaterial({ color: 0xcfeefa, transparent: true, opacity: 0.8 });
        for (let k = 0; k < 24; k++) {
          const dr = new THREE.Mesh(new THREE.IcosahedronGeometry(0.06, 0), jetMat);
          group.add(dr);
          jets.push(dr);
        }
        // buttons on the bottom of the fountain, a little glint of wishes
        for (let k = 0; k < 14; k++) {
          const b = cyl(0.06, 0.06, 0.02, 8, [0xd9b24a, 0x9aa0a6, 0xc98f5a][k % 3]);
          const a = rand(0, Math.PI * 2), r = rand(0.9, 1.7);
          b.position.set(X(FT.x) + Math.cos(a) * r, 0.53, Z(FT.z) + Math.sin(a) * r);
          group.add(b);
        }
        bl.push({ x: X(FT.x), z: Z(FT.z), r: 2.3 });
        (inside.mall ??= []).push((dt, t) => {
          jets.forEach((dr, k) => {
            const a = (k / jets.length) * Math.PI * 2;
            const ph = (t * 0.7 + (k % 4) / 4) % 1;
            dr.position.set(X(FT.x) + Math.cos(a) * ph * 1.3, 1.9 + ph * 1.2 - ph * ph * 2.1, Z(FT.z) + Math.sin(a) * ph * 1.3);
          });
        });
        things.push({ pos: new THREE.Vector3(X(FT.x), 0, Z(FT.z + 2.7)), r: 1.6, label: 'toss a button in the fountain',
          use: async () => {
            if (S.state.buttons < 1) return ui.say('You pat your pockets. Not even one button. You make the wish anyway. It counts; it just doesn’t jingle.');
            S.spend(1);
            ui.updateHUD();
            tone(880, { dur: 0.08, type: 'sine', vol: 0.03 });
            tone(660, { time: 0.12, dur: 0.12, type: 'sine', vol: 0.02 });
            await ui.say(nextLine('wish', [
              'Plink. The button settles among the others. Somewhere, very quietly, a wish gets filed. In triplicate. This is still Oasis Estates.',
              'Plink. You wish for something. The fountain keeps it. Fountains are good at secrets; they’re loud in exactly the right way.',
              'Plink. Mildred, going by on lap thirty-one, without breaking stride: “Good one, dear.”',
              'Plink. You wish the ferry would get approved. The fountain makes a small noise that sounds, for a moment, like somebody saying “under review.”',
            ]));
          } });
        // benches round the court, and potted palms
        for (const [lx, lz, ry] of [[-3.8, -0.8, Math.PI / 2], [3.8, -0.8, -Math.PI / 2]]) {
          const g = new THREE.Group();
          const seat = box(1.6, 0.1, 0.5, 0x8a6a4a);
          seat.position.y = 0.45;
          const back = box(1.6, 0.45, 0.08, 0x8a6a4a);
          back.position.set(0, 0.72, -0.22);
          const legs = box(1.4, 0.4, 0.3, 0x3a3a3e);
          legs.position.y = 0.2;
          g.add(seat, back, legs);
          g.position.set(X(lx), 0, Z(lz));
          g.rotation.y = ry;
          group.add(g);
          bl.push({ x: X(lx), z: Z(lz), w: 0.55, d: 1.6 });
        }
        for (const [lx, lz] of [[-9, -6.2], [9, -6.2], [-9, 8.8], [9, 8.8]]) {
          plant(X(lx), Z(lz), 1.5);
          bl.push({ x: X(lx), z: Z(lz), r: 0.45 });
        }
        // ------------------------------------------- the back row of stores
        const backZ = -D0 / 2 + 0.15;
        function storefront(x0, x1, depth, fascia, { open = false, grille = false, papered = false, floorC = 0xf0e8dc } = {}) {
          const w = x1 - x0, cx = (x0 + x1) / 2, front = backZ + depth;
          for (const lx of [x0, x1]) {
            const side = box(0.25, 4.2, depth, 0xe8dcc8);
            side.position.set(X(lx), 2.1, Z(backZ + depth / 2));
            group.add(side);
            bl.push({ x: X(lx), z: Z(backZ + depth / 2), w: 0.3, d: depth });
          }
          const fl = box(w - 0.2, 0.03, depth, floorC);
          fl.position.set(X(cx), 0.02, Z(backZ + depth / 2));
          group.add(fl);
          const header = box(w + 0.2, 0.9, 0.3, 0xe8dcc8);
          header.position.set(X(cx), 3.75, Z(front));
          group.add(header);
          fascia.position.set(X(cx), 3.75, Z(front) + 0.17);
          group.add(fascia);
          if (!open) {
            // a front: either a grille (closed), or papered-over glass
            const pane = box(w - 0.3, 3.3, 0.1, papered ? 0xf3efe2 : grille ? 0x55555a : 0xbfe6f2);
            pane.position.set(X(cx), 1.65, Z(front));
            if (grille) {
              pane.visible = false;
              for (let gx = x0 + 0.4; gx < x1 - 0.2; gx += 0.35) {
                const bar = box(0.05, 3.3, 0.05, 0x8a8e92);
                bar.position.set(X(gx), 1.65, Z(front));
                group.add(bar);
              }
            }
            group.add(pane);
            bl.push({ x: X(cx), z: Z(front), w: w - 0.2, d: 0.3 });
          }
          return { cx, front };
        }
        // SAHARA: black and white stripes, very serious, open
        const sah = storefront(-12.5, -4.5, 4.4, sign('SAHARA', { w: 7.6, h: 0.8, d: 0.05, bg: '#ffffff', fg: '#111111', stripes: '#111111' }), { open: true, floorC: 0x2a2a2e });
        for (const lz of [backZ + 0.35]) {
          shelfUnit(X(-8.5), Z(lz), 0, 7.2, [0x111111, 0xffffff, 0xe86a9a, 0xd8342c, 0xf2cf5b]);
        }
        for (const [lx, ry] of [[-12.1, Math.PI / 2], [-4.9, -Math.PI / 2]]) {
          shelfUnit(X(lx), Z(backZ + 2.4), ry, 3.0, [0x111111, 0xffffff, 0xe86a9a, 0xb89ad8]);
          bl.push({ x: X(lx + (lx < -8 ? 0.25 : -0.25)), z: Z(backZ + 2.4), w: 0.6, d: 3.0 });
        }
        bl.push({ x: X(-8.5), z: Z(backZ + 0.45), w: 7.2, d: 0.7 });
        counterTop(X(-8.5), Z(backZ + 2.6), 2.6, 0.8, 0x111111, 0xffffff);
        bl.push({ x: X(-8.5), z: Z(backZ + 2.6), w: 2.6, d: 0.8 });
        const paloma = folk('parrot', { body: 0xf28fb0, head: 0xf28fb0, wing: 0xb89ad8, tail: 0x111111, face: 0xffffff }, X(-8.5), 0, Z(backZ + 1.6), 0, { apron: 0x111111, fidget: true });
        const sahGoods = [
          { id: 'dune_gloss', price: 8, say: 'Dune Gloss, in Oasis at Dusk. It’s pink. It’s always pink. It’s a mood, babe. You’re a mood now.' },
          { id: 'sand_scrub', price: 6, say: 'The Sand Scrub. Ingredients: sand. That’s it. That’s the luxury. Honesty is the new exfoliant.' },
        ];
        let sprayed = false;
        things.push({ getPos: () => paloma.position, r: 2.4, label: 'talk to Paloma',
          use: async () => {
            const c = await ui.ask(nextLine('paloma', PALOMA), [
              { label: '💄 Shop', value: 'shop' },
              { label: '🌸 Try a sample', value: 'sample' },
              { label: 'Leave', value: null },
            ], { speaker: 'Paloma', voice: VOICE.paloma });
            if (c === 'shop') await till('Paloma', 'paloma', 'What are we feeling today?', sahGoods);
            if (c === 'sample') {
              if (!sprayed) {
                sprayed = true;
                await ui.say(['Close your eyes. … Spritz.', 'That’s Eau de Oasis. Top notes: cut grass. Heart: chlorine. Base: a minivan in the sun.', 'You smell like a planned community, babe. Wear it well.'], { speaker: 'Paloma', voice: VOICE.paloma });
              } else {
                await ui.say('One spritz per customer, babe. Beverly’s rule. She has a lot of rules about scent.', { speaker: 'Paloma', voice: VOICE.paloma });
              }
            }
          } });
        // HOT TROPIC: behind a grille, dark, a neon sign, closed forever
        storefront(-3.2, 3.2, 3.2, sign('HOT TROPIC', { w: 6.2, h: 0.8, d: 0.05, bg: '#141418', fg: '#ff4fb0' }), { grille: true, floorC: 0x141418 });
        const bag = ball(0.6, 0x7a3ad8, 1);
        bag.scale.y = 0.55;
        bag.position.set(X(0.8), 0.3, Z(backZ + 1.4));
        const lava = cyl(0.12, 0.18, 0.6, 7, 0xff4fb0);
        lava.position.set(X(-1.8), 0.3, Z(backZ + 1.0));
        group.add(bag, lava);
        const cousin = folk('parrot', { body: 0x2a2a30, head: 0x2a2a30, wing: 0xff4fb0, tail: 0xff4fb0 }, X(0.8), 0.35, Z(backZ + 1.4), 0.4, { scale: 0.8 });
        cousin.rotation.x = -0.4;
        things.push({ pos: new THREE.Vector3(X(0), 0, Z(backZ + 3.9)), r: 1.8, label: 'peer into Hot Tropic',
          use: () => ui.say([
            'The grille is down. It is always down. Behind it: band tees, a lava lamp, and a teenage parrot asleep on a purple beanbag.',
            'A handwritten sign taped to the grille: “OPEN WHEN I’M READY. — MGMT (Kiwi’s cousin)”',
            'The mall walkers go past. They have been going past Hot Tropic for eleven years. They have never gone in. They are not ready either.',
          ]) });
        // SUNGLASS HUMP
        storefront(4.4, 9.2, 3.2, sign('SUNGLASS HUMP', { w: 4.8, h: 0.8, d: 0.05, bg: '#f2cf5b', fg: '#2a2a2e' }), { open: true, floorC: 0xe8e0cc });
        for (let k = 0; k < 3; k++) {
          const stand = box(0.5, 1.5, 0.5, 0xfaf6ec);
          stand.position.set(X(5.4 + k * 1.4), 0.75, Z(backZ + 1.2));
          group.add(stand);
          for (let j = 0; j < 3; j++) {
            const lens = box(0.4, 0.12, 0.05, [0x2a2a2e, 0xd8342c, 0x3a7dd8][(k + j) % 3]);
            lens.position.set(X(5.4 + k * 1.4), 0.9 + j * 0.25, Z(backZ + 1.47));
            group.add(lens);
          }
          bl.push({ x: X(5.4 + k * 1.4), z: Z(backZ + 1.2), r: 0.4 });
        }
        things.push({ pos: new THREE.Vector3(X(6.8), 0, Z(backZ + 2.4)), r: 1.5, label: 'try on sunglasses',
          use: () => ui.say(nextLine('shades', [
            'You try on a pair shaped like pineapples. In the little mirror you look like somebody who owns a boat. You don’t own a boat. You put them back.',
            'You try on a pair of aviators. A camel walks past and nods at you, respectfully, one aviator-haver to another.',
            'You try on the biggest pair. They cover most of your face. You feel, briefly, like a celebrity avoiding a mall. You are in a mall. It works both ways.',
          ])) });
        // SPACE AVAILABLE
        storefront(10.4, 14.6, 3.2, sign('SPACE AVAILABLE', { w: 4.2, h: 0.8, d: 0.05, bg: '#f3efe2', fg: '#8c7f72' }), { papered: true });
        const soon = sign(['COMING SOON:', 'HOT WORMS', '(a Burrough franchise)', 'contains no worms'], { w: 2.4, h: 1.8, d: 0.03, bg: '#fff3d6', fg: '#8a4a2a', border: '#8a4a2a' });
        soon.position.set(X(12.5), 1.8, Z(backZ + 3.3));
        group.add(soon);
        // ---------------------------------------------------- the food court
        for (const [lx, lz] of [[-11, 0.5], [-11, 4.2], [-7.4, 2.4], [-7.4, 6.4]]) {
          table(X(lx), Z(lz), 1.0, 1.0, 0xfaf6ec);
          chair(X(lx - 0.8), Z(lz), Math.PI / 2, 0x3fb8a8);
          chair(X(lx + 0.8), Z(lz), -Math.PI / 2, 0x3fb8a8);
          bl.push({ x: X(lx), z: Z(lz), w: 2.3, d: 1.1 });
        }
        counterTop(X(-14.2), Z(3.2), 1.0, 3.2, 0xd9a45a, 0xfaf6ec);
        bl.push({ x: X(-14.2), z: Z(3.2), w: 1.0, d: 3.2 });
        const auntieSign = sign(['AUNTIE DUNE’S', 'soft pretzels · since the lawn'], { w: 3.2, h: 0.8, d: 0.05, bg: '#d9a45a', fg: '#ffffff' });
        auntieSign.position.set(X(-14.8), 3.2, Z(3.2));
        auntieSign.rotation.y = Math.PI / 2;
        group.add(auntieSign);
        for (let k = 0; k < 4; k++) {
          const pz = new THREE.Mesh(new THREE.TorusGeometry(0.16, 0.06, 5, 10), mat(0xb87a3a));
          pz.position.set(X(-14.2), 1.2, Z(2.0 + k * 0.7));
          pz.rotation.y = Math.PI / 2;
          group.add(pz);
        }
        const auntie = folk('camel', { body: 0xc8b08a, humps: 2, tuft: 0xf0e8e0 }, X(-14.9), 0, Z(3.2), Math.PI / 2, { apron: 0xd9a45a, fidget: true });
        things.push({ getPos: () => auntie.position, r: 2.4, label: 'talk to Auntie Dune',
          use: async () => {
            await ui.say(nextLine('auntie', AUNTIE), { speaker: 'Auntie Dune', voice: 300 });
            await till('Auntie Dune', 'auntie', 'One pretzel, sugar? Salt like sand.', [
              { id: 'pretzel', price: 3, say: 'Here you go, sugar. Warm. Eat it walking. That’s how a mall pretzel wants to be eaten.' },
            ]);
          } });
        // ------------------------------------------------ the escalator (up)
        {
          const esc = new THREE.Group();
          const ramp = box(1.4, 0.3, 6.4, 0x9aa0a6);
          ramp.rotation.x = 0.55;
          ramp.position.set(0, 1.75, 0);
          esc.add(ramp);
          for (const sx of [-0.8, 0.8]) {
            const rail = box(0.12, 0.9, 6.6, 0x3a3a3e);
            rail.rotation.x = 0.55;
            rail.position.set(sx, 2.3, 0);
            esc.add(rail);
          }
          for (let k = 0; k < 14; k++) {
            const step = box(1.2, 0.05, 0.35, 0x6a6e72);
            const f = k / 13;
            step.position.set(0, 0.2 + f * 3.4, 2.8 - f * 5.6);
            esc.add(step);
          }
          esc.position.set(X(13.2), 0, Z(4.0));
          group.add(esc);
          bl.push({ x: X(13.2), z: Z(4.0), w: 1.8, d: 6.0 });
          const up = sign(['UP ⬆', 'to the second floor'], { w: 1.4, h: 0.5, d: 0.04, bg: '#3fb8a8', fg: '#ffffff' });
          up.position.set(X(13.2), 1.4, Z(7.3));
          group.add(up);
          things.push({ pos: new THREE.Vector3(X(13.2), 0, Z(7.6)), r: 1.3, label: 'ride the escalator',
            use: async () => {
              await ui.fadeSwap(() => {});
              await ui.say([
                'You ride it up. It hums. It goes up, and up, and at the top there is a wall, and on the wall is a lovely painting of a second floor.',
                'You ride it back down. Officer Dale, on his segway: “Everybody does that once.”',
              ]);
            } });
        }
        // ------------------------------------------------ the lotion kiosk
        {
          const kx = 9.0, kz = 5.4;
          const cart = box(1.8, 1.0, 1.0, 0xfaf6ec);
          cart.position.set(X(kx), 0.5, Z(kz));
          const canopy = box(2.0, 0.1, 1.2, 0x3fb8a8);
          canopy.position.set(X(kx), 2.3, Z(kz));
          group.add(cart, canopy);
          for (const sx of [-0.85, 0.85]) {
            const pole = cyl(0.04, 0.04, 1.3, 5, 0x3a3a3e);
            pole.position.set(X(kx + sx), 1.65, Z(kz));
            group.add(pole);
          }
          for (let k = 0; k < 6; k++) {
            const bottle = cyl(0.07, 0.07, 0.3, 6, [0xb8e0e8, 0xf2e0b0][k % 2]);
            bottle.position.set(X(kx - 0.6 + k * 0.24), 1.15, Z(kz));
            group.add(bottle);
          }
          bl.push({ x: X(kx), z: Z(kz), w: 1.9, d: 1.1 });
          const rico = folk('parrot', { body: 0x3a9ad8, head: 0x3a9ad8, wing: 0xf2cf5b, tail: 0xd8342c }, X(kx - 1.4), 0, Z(kz + 0.3), -Math.PI / 2 - 0.5, { shirt: 0x2a2a2e, fidget: true });
          things.push({ getPos: () => rico.position, r: 2.4, label: 'make eye contact with Rico',
            use: () => ui.say(nextLine('rico', RICO), { speaker: 'Rico', voice: VOICE.rico }) });
        }
        // ------------------------------------------------ Officer Dale
        {
          const dale = folk('bronto', { body: 0x9aa8b8, head: 0x9aa8b8, belly: 0xd8dce4, spots: 0x7a88a0 }, X(0), 0.25, Z(7.5), Math.PI / 2, { cap: 0x2e3e5c });
          dale.scale.setScalar(0.8);
          const seg = new THREE.Group();
          const base = box(0.9, 0.12, 0.5, 0x2a2a2e);
          base.position.y = 0.2;
          for (const sx of [-0.5, 0.5]) {
            const wh = new THREE.Mesh(new THREE.CylinderGeometry(0.2, 0.2, 0.12, 10), mat(0x2a2a2e));
            wh.rotation.x = Math.PI / 2;
            wh.position.set(sx, 0.2, 0);
            seg.add(wh);
          }
          const stalk = cyl(0.04, 0.04, 1.3, 5, 0x9aa0a6);
          stalk.position.set(0.3, 0.85, 0);
          seg.add(base, stalk);
          group.add(seg);
          zones.addMover({ zone: 'mall', obj: dale, r: 0.9 });
          (inside.mall ??= []).push((dt, t, pp) => {
            if (ui.isBusy() && Math.hypot(pp.x - dale.position.x, pp.z - dale.position.z) < 4) return;
            const u = Math.sin(t * 0.12) * 10;
            const nx = X(u), nz = Z(7.6);
            if (Math.hypot(pp.x - nx, pp.z - nz) < 1.4) return;
            const dir = Math.cos(t * 0.12) >= 0 ? 1 : -1;
            dale.position.set(nx, 0.25, nz);
            dale.rotation.y = dir > 0 ? Math.PI / 2 : -Math.PI / 2;
            seg.position.set(nx, 0, nz);
            seg.rotation.y = dale.rotation.y - Math.PI / 2;
          });
          things.push({ getPos: () => dale.position, r: 2.4, label: 'talk to Officer Dale', use: talk('dale', 'Officer Dale', DALE) });
        }
        // ------------------------------------------------ the mall walkers
        {
          const walkers = [
            { name: 'Mildred', key: 'mildred', suit: 0xb89ad8 },
            { name: 'Phyllis', key: 'phyllis', suit: 0x3fb8a8 },
            { name: 'Bunny', key: 'bunny', suit: 0xf2b08a },
          ].map((w, k) => {
            const a = folk('camel', { body: [0xd8c0a0, 0xc8a878, 0xe8d0a8][k], humps: 1 + (k % 2) }, 0, 0, 0, 0, { shirt: w.suit, visor: 0xffffff });
            zones.addMover({ zone: 'mall', obj: a, r: 0.5 });
            return { ...w, a, ph: k * 0.55 };
          });
          const RX = 6.8, RZ = 4.4;
          let lap = 0;
          (inside.mall ??= []).push((dt, t, pp) => {
            const talking = ui.isBusy() && walkers.some((w) => Math.hypot(pp.x - w.a.position.x, pp.z - w.a.position.z) < 4);
            const blocked = walkers.some((w) => {
              const na = lap + 0.08 - w.ph;
              return Math.hypot(pp.x - X(FT.x + Math.cos(na) * RX), pp.z - Z(FT.z + Math.sin(na) * RZ)) < 0.9;
            });
            const moving = !talking && !blocked;
            if (moving) lap += dt * 0.16;
            for (const w of walkers) {
              w.a.visible = !mildredHome() || w.name !== 'Mildred';
              const an = lap - w.ph;
              w.a.position.set(X(FT.x + Math.cos(an) * RX), 0, Z(FT.z + Math.sin(an) * RZ));
              w.a.rotation.y = Math.atan2(-Math.sin(an) * RX, Math.cos(an) * RZ);
              animateGait(w.a, t, moving ? 1 : 0, 9);
            }
          });
          things.push({ getPos: () => walkers[1].a.position, r: 2.8, label: 'walk with the mall walkers',
            use: () => ui.say(nextLine('walkers', WALKERS).map(([sp, text]) => ({ speaker: sp, voice: VOICE[sp.toLowerCase()] ?? 400, text }))) });
        }
        // the entrance mat
        rug(X(0), Z(D0 / 2 - 0.9), 3.2, 1.2, 0x3fb8a8);
      },
    });
  }

  // ============================================================ update ----
  function update(dt, t, playerPos) {
    const zone = zones.current();
    if (zone === 'island') {
      if (Math.hypot(playerPos.x - ISLAND8.x, playerPos.z - ISLAND8.z) > 140) return; // nobody here to see it
      for (const f of outdoor) f(dt, t, playerPos);
    } else if (inside[zone]) {
      for (const f of inside[zone]) f(dt, t, playerPos);
    }
  }

  return { group, update };
}

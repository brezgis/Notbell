// The North End of Cran — and the Famiglia.
//
// Up at the top of the Isle of Cran, where the creek starts, there's a round
// lobe of old cobbles: a piazza under strings of lights, the Olive Burrow
// (Italian-ish family dining · unlimited breadsticks · NOT A FRONT), Zio
// Orso's pasticceria (a giant cannoli on the roof), Caffè Bandito (espresso,
// standing up), a grotto at the spring with Nonno Aldo in his diving helmet,
// a bocce court, and the Alley of the Saints, which ends at a trash can with
// a raccoon in it.
//
// Under all of it: the Famiglia. Raccoons, mostly (Don Rocco, Valentina,
// Nonna, Vinnie), two ferrets (Benny waits tables, Sal rolls parm), a possum
// who plays dead (Eddie), and a very large toad who keeps the books (Rospo).
// Nonno Aldo dove forty times for Old Tansy's bell and was paid from her
// button jar; the family kept every button. The vault is full of them. They
// buy parm at BULKO at two in the morning and leave exact change.
//
// The way in (flags, in order):
//   famigliaInvite — Benny grates to the rind and you never say when (or you
//     catch Sal at BULKO between midnight and four): a matchbook, "out back,
//     ask for Vinnie"
//   famiglia — the Don, on a day very near his daughter's someday wedding,
//     gives you a slice of his parm and a fedora (metDon)
//   heistDone — you help roll a wheel to the boat (a Polaroid)
// Doors to the lair: Vinnie's trash can (not between midnight and four — he's
// the boat), and the hollow oak on Cran's west side.
//
// Layout is in local (u, v) from CRAN_NORTH: u east, v south.

import * as THREE from 'three';
import { CRAN_NORTH, CRAN_PIAZZA, CRAN_CREEK, ISLAND9, ISLAND4, WATER_Y, terrainHeight } from './terrain.js';
import * as zones from './zones.js';
import { register } from './interact.js';
import * as ui from './ui.js';
import * as S from './state.js';
import { kaching, tone, sip } from './audio.js';
import { buildAnimal, animateGait } from './animals.js';
import { rand, turnToward } from './utils.js';
import { addIslandInfo, addZonePlace } from './fieldguide.js';
import { glowWindow } from './nightglow.js';
import { ITEMS } from './catalog.js';
import { makeWindow, makeHangingLamp } from './buildings.js';
import { mergeStatic } from './merge.js';
import { hourNow } from './calendar.js';
import { applyHat } from './hats.js';

function mat(color, rough = 0.9) {
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
function glow(r, color) {
  // a candle flame, a bulb: lit from within, casts nothing
  const m = new THREE.Mesh(new THREE.IcosahedronGeometry(r, 0), new THREE.MeshBasicMaterial({ color }));
  m.castShadow = false;
  return m;
}
function collectInteriorRoot(parent, startIndex) {
  const root = new THREE.Group();
  root.add(...parent.children.slice(startIndex));
  parent.add(root);
  return root;
}
function sign(lines, { w = 3.4, h = 0.8, d = 0.08, bg = '#f3ead6', fg = '#3a3026', border = null } = {}) {
  const cv = document.createElement('canvas');
  cv.width = 512;
  cv.height = Math.round(512 * (h / w));
  const ctx = cv.getContext('2d');
  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, cv.width, cv.height);
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
    let size = Math.round(slot * (i === 0 ? 0.72 : 0.56));
    do {
      ctx.font = `bold ${size}px ui-rounded, 'Segoe UI', system-ui, sans-serif`;
      size -= 2;
    } while (ctx.measureText(text).width > cv.width * 0.9 && size > 10);
    ctx.fillStyle = fg;
    ctx.fillText(text, cv.width / 2, slot * i + slot * 0.54);
  });
  const tex = new THREE.CanvasTexture(cv);
  tex.colorSpace = THREE.SRGBColorSpace;
  const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), new THREE.MeshStandardMaterial({ map: tex, flatShading: true, roughness: 0.85 }));
  m.castShadow = m.receiveShadow = true;
  return m;
}
// a painted canvas (a mural, a portrait, a corkboard): draw(ctx, W, H) paints it
function painting(w, h, draw, { d = 0.06, px = 384 } = {}) {
  const cv = document.createElement('canvas');
  cv.width = px;
  cv.height = Math.round(px * (h / w));
  const ctx = cv.getContext('2d');
  draw(ctx, cv.width, cv.height);
  const tex = new THREE.CanvasTexture(cv);
  tex.colorSpace = THREE.SRGBColorSpace;
  const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), new THREE.MeshStandardMaterial({ map: tex, flatShading: true, roughness: 0.85 }));
  m.castShadow = m.receiveShadow = true;
  return m;
}
const FONT = (px) => `bold ${px}px ui-rounded, 'Segoe UI', system-ui, sans-serif`;

// red-and-white check, for every tablecloth in the North End (one material)
let checkMat = null;
function checkCloth() {
  if (checkMat) return checkMat;
  const cv = document.createElement('canvas');
  cv.width = cv.height = 64;
  const ctx = cv.getContext('2d');
  for (let i = 0; i < 8; i++) for (let j = 0; j < 8; j++) {
    ctx.fillStyle = (i + j) % 2 ? '#fbf6ee' : '#c8343a';
    ctx.fillRect(i * 8, j * 8, 8, 8);
  }
  const tex = new THREE.CanvasTexture(cv);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.magFilter = THREE.NearestFilter;
  checkMat = new THREE.MeshStandardMaterial({ map: tex, flatShading: true, roughness: 0.9 });
  return checkMat;
}

// ------------------------------------------------------------ the plan ----
const N = CRAN_NORTH;
const W = (u, v) => ({ x: N.x + u, z: N.z + v });
const gy = (u, v) => terrainHeight(N.x + u, N.z + v);

// the buildings round the piazza (what they face: the restaurant and the
// pasticceria face south onto it, the caffè faces east)
const OLIVE = { u: -4, v: -8.5, w: 11, d: 6.5, ry: 0, h: 3.6 };
const DOLCI = { u: 7.5, v: -8, w: 6, d: 5.5, ry: 0, h: 3.8 };
const CAFFE = { u: -12, v: 1, w: 5.5, d: 5, ry: Math.PI / 2, h: 3.4 };
const ALLEY = { u0: OLIVE.u + OLIVE.w / 2, u1: DOLCI.u - DOLCI.w / 2 }; // between the two: the Alley of the Saints
const CAN = { u: ALLEY.u1 - 0.2, v: OLIVE.v - OLIVE.d / 2 - 0.15 };   // Vinnie's, at the alley's far end, past the pasticceria's back
const CAMPANA = { u: ALLEY.u0 + 0.7, v: OLIVE.v - OLIVE.d / 2 - 0.6 }; // the last saint, on her pillar, looking back down the alley
const BACKDOOR = { u: OLIVE.u + 3.5, v: OLIVE.v - OLIVE.d / 2 };      // the Olive Burrow's kitchen door, on the north wall
const BOCCE = { u: 10.5, v: 2.5, w: 3, d: 8 };
// the grotto, where the creek begins
const SPRING = { u: CRAN_CREEK[0][0] + ISLAND9.x - N.x, v: CRAN_CREEK[0][1] + ISLAND9.z - N.z };
const GROTTO = { u: SPRING.u, v: SPRING.v - 2.7, r: 2.5 };
// and the hollow oak, out on Cran proper, west of the Community Center
export const HOLLOW_OAK = { x: ISLAND9.x - 15.5, z: ISLAND9.z - 17 };

// interiors, off in the elsewhere (the x = -300 column, past Chuckee's)
const IN = {
  cran_olive: { x: -300, z: 1920 },
  cran_caffe: { x: -300, z: 2000 },
  cran_dolci: { x: -300, z: 2080 },
  cran_lair: { x: -300, z: 2180 },
};

// ---- reservations, at module load (before the houses and Cran's oaks) ----
for (const [u, v, r] of [
  [OLIVE.u, OLIVE.v, 6.6], [DOLCI.u, DOLCI.v, 4.2], [CAFFE.u, CAFFE.v, 4.0], [GROTTO.u, GROTTO.v, 3.4],
  [BOCCE.u, BOCCE.v, 4.6], [CRAN_PIAZZA.x - N.x, CRAN_PIAZZA.z - N.z, CRAN_PIAZZA.r],
]) {
  const p = W(u, v);
  zones.addKeepout(p.x, p.z, r);
}
zones.addKeepout(HOLLOW_OAK.x, HOLLOW_OAK.z, 1.6); // (just the trunk's ground: the old oak next door stays)

const VOICE = {
  don: 140, rospo: 105, val: 660, nonna: 400, benny: 580, sal: 540, eddie: 300, vinnie: 240,
  orso: 190, gufo: 330, tortoise: 230, heron: 470, mole: 270, hog: 360,
  pia: 450, nello: 260, tullio: 180,
};
const said = {};
function nextLine(key, lines) {
  const i = said[key] ?? 0;
  said[key] = (i + 1) % lines.length;
  return lines[i];
}
// the Olive Burrow's regulars, at their tables
const PIA = [
  'The gnocchi here is like a little cloud. A little cloud that fights back.',
  'We come every Thursday. Today is Tuesday. We got confused, and then we got gnocchi.',
  'Benny calls me “bella.” He calls everybody “bella.” I choose to believe it.',
];
const NELLO = [
  'Nobody sits in the reserved booth. Why? … Nobody sits in the reserved booth.',
  'Is it a front? It’s a restaurant. Eat the bread. Stop asking.',
  'Nonna watches the door. Not for anything. She just likes the door.',
];
const TULLIO = [
  'The breadsticks are free. They keep coming. I can’t stop them. I’ve stopped trying.',
  'I ordered the lasagna in March. … No, it came. I just keep ordering it.',
  'Table for one. Always. Me and the basket. We understand each other.',
];
const EDDIE_COLORS = { body: 0xa8a6a8, head: 0xf4f0ea };
const hourIn = (a, b) => { const h = hourNow(); return a <= b ? h >= a && h < b : h >= a || h < b; };
const heistOn = () => hourIn(0, 4);           // the night shift: BULKO, two-ish in the morning
const valentinaOut = () => hourIn(9, 18);     // by day she holds court at the caffè's table

// ---------------------------------------------------------- who says what --
const DON = [
  'My father dove forty times for Old Tansy’s bell. Forty. She paid him out of a jar of buttons, every time. He never found it. He kept every button. That’s the family business: keeping.',
  'BULKO? We don’t steal from BULKO. We pay. Exact change, on the counter, in the dark, with style. That’s the difference between a heist and shopping. Style.',
  'Never trust a parm that doesn’t crumble.',
  'Nonna runs the kitchen. I run the family. Nonna runs me. This is the natural order.',
  'Valentina. My heart. She has expensive taste. The family has a vault. These two facts have met.',
  'The mole up on Grove — his grandfather billed Tansy by the hour. My father said thank you and took the buttons. One family got a manor. One got a vault and a very good restaurant. Everybody did fine.',
  'You want something, you come to me. You want parm, you come to me. You want advice, go to Rospo. He’s slower. It’s better advice.',
  'The breadsticks are unlimited. People think that’s a slogan. It’s a promise. In this family we keep our promises. We have a guy.',
];
const ROSPO = [
  'Consigliere Rospo. I keep the books. The books are mostly about cheese.',
  'Forty thousand, two hundred and six buttons in the vault. And one that is a little bit sticky. I count it anyway. It counts.',
  'The Don pays full price at BULKO. I asked him why. He said “style.” I wrote “style” in the ledger. It is our largest expense.',
  'Eddie is not dead. Eddie is never dead. Eddie is resting his eyes, professionally.',
  'Advice? … Leave the button. Take the cannoli. That’s all the advice there is, really.',
  'I am a toad. The Don is a raccoon. Benny and Sal are ferrets. Eddie is a possum. Family isn’t about the face. It’s about who you split the parm with.',
];
const VAL = [
  'Darling. Don’t look directly at the vanity lights. They’re for me.',
  'Papa thinks every day is my wedding day. I think every day is my day. We’re both right. It’s exhausting.',
  'The pearls? Buttons. Pearl buttons. Everything in this family is buttons, eventually.',
  'The sunglasses stay on. Indoors. Underground. At night. That’s what fabulous costs, and I pay in full.',
  'Engaged? Me? I’m engaged to the concept of brunch.',
  'Somebody in this family has to be fabulous. Papa has the chair. Nonna has the kitchen. I have the boa. We all serve.',
  'Ciao, bello. Ciao, bella. Ciao, whoever you are. You look expensive today.',
];
const VAL_OUT = [
  'Darling! Don’t sit. Stand where the light hits you. There. Fabulous.',
  'I come here for the espresso and stay for being looked at.',
  'Gufo makes it short and black and strong. Like me, if I were short. And black. And coffee.',
  'This is the best table in the North End. I know because I sat at it, and then it was.',
];
const NONNA = [
  'Mangia! You’re too thin. Everybody’s too thin. The Don is too thin, and he’s enormous.',
  'Gnocchi. A hundred a minute. Sixty years. You do the math. No — eat first. Then math.',
  'The front? What front. It’s a restaurant. It has a back. Everything has a back.',
  'My Aldo dove for that bell forty times. Came home every time with nothing, smiling. I married him for the smile. I kept him for the buttons. I’m kidding. It was the smile.',
  'The recipe? Nobody gets the recipe. The recipe is: more.',
  'You want to help? Wash your hands. No — again. Good. Now sit down, you’re in the way.',
];
const BENNY = [
  'Welcome to the Olive Burrow! When you’re here, you’re famiglia. When you’re not here, you’re also famiglia, just further away.',
  'Unlimited breadsticks. We mean it. We have a guy.',
  'That booth? Reserved. Always reserved. Reserved for who? For whoever it’s reserved for. Next question.',
  'The kitchen’s through there. Nonna’s in there. You can go in. I wouldn’t. But you can.',
  'My brother Sal says he’s the handsome one. We’re twins. Draw your own conclusions.',
];
const SAL = [
  'Solitaire. It’s like poker, except the only one who can cheat is me. I don’t, though. Mostly.',
  'Me and Benny, we’re twins. I’m the handsome one. He says he is. He’s wrong, very handsomely.',
  'Night shift’s at two. You know. The shopping.',
  'The trick with a wheel of parm is, you don’t push it. You let it want to go.',
];
const EDDIE = [
  '…Is it a cop? … Oh. Hi. I’m dead. Leave a message.',
  'I’m the lookout. I look out from in here. Behind my eyelids. It’s the safest place to look out from.',
  'I wasn’t sleeping. I was dead. It’s different. You get more done.',
  'If anybody asks, I was never here. I was lying down. Over there. Dead.',
];
const VINNIE = [
  'Whaddaya want. It’s a trash can. I’m a raccoon in it. Very normal. Move along.',
  'The peel? It’s a hat. It was a banana. Now it’s a hat. Things change, kid.',
  'Best seat in the North End. Quiet. Good smells. Nobody asks you nothin’.',
  'I ain’t the doorman. There’s no door. It’s a can. Beat it.',
];
const ORSO = [
  'Cannoli! Filled to order. A cannoli filled in the morning is a sad little tube by lunch. Not here. Never here.',
  'The lobster tails have no lobster in them. I put a sign up. The lobster at BULKO asked. Very politely. Through the glass.',
  'There’s another pastry shop across the street. There isn’t. But if there were, it would be worse.',
  'Every box gets this string. Red and white. My zia tied boxes with this string. It’s the same spool. It’s a very long spool.',
];
const GUFO = [
  'Caffè. Short, black, standing up. Drink it in one sip and go live your life.',
  'Night owl. Day owl, too. I don’t sleep. I have espresso. These facts are related.',
  'The TV shows bocce. Always bocce. Somebody changed it to the news once. We changed it back. Nobody was hurt.',
];
const REGULARS = [
  [['an old tortoise', 'It’s a lake.'], ['an old heron', 'It’s a bog.'], ['an old tortoise', 'My cousin swam in it.'], ['an old heron', 'That’s how we know it’s a bog.']],
  [['an old heron', 'In my day an espresso was one button.'], ['an old tortoise', 'In your day there were no buttons.'], ['an old heron', 'Exactly. It was free. Those were the days.']],
  [['an old tortoise', 'Gufo. Another.'], ['Gufo', 'That’s your fourth.'], ['an old tortoise', 'I’m a tortoise. It takes four to get me up to normal speed.']],
  [['an old heron', 'That bocce shot yesterday. Closer.'], ['an old tortoise', 'Not closer.'], ['an old heron', 'Closer.'], ['Gufo', 'It’s on the TV right now. Look.'], ['an old tortoise', '…Closer.']],
];
const OLDTIMERS = [
  [['an old mole', 'That’s closer.'], ['an old groundhog', 'That’s not closer.'], ['an old mole', 'Measure it.'], ['an old groundhog', 'I measured it last week. It was closer then. Things move.']],
  [['an old groundhog', 'Forty years we’ve played this game.'], ['an old mole', 'Forty-one.'], ['an old groundhog', 'You see? He even keeps score of the years.']],
  [['an old mole', 'You want to play? Roll it soft. Like you’re asking the ball a favor.'], ['an old groundhog', 'He asks every ball a favor. Not one has ever said yes.']],
];
const SAINTS = [
  { name: 'SAN ALDO', sub: 'the diver', color: '#c8a050', icon: 'helmet', text: 'SAN ALDO, THE DIVER — patron of looking forty times. Somebody has left a button on the little shelf under him. Somebody always has.' },
  { name: 'SANTA TANSY', sub: 'of the jar', color: '#6a8ac8', icon: 'jar', text: 'SANTA TANSY OF THE JAR — patron of paying what you owe, and of lights left on.' },
  { name: 'SAN GUS', sub: 'of the doors', color: '#5a9a5a', icon: 'shell', text: 'SAN GUS OF THE DOORS — patron of greeters, receipts, and everyone who arrives. (He’s still alive. He doesn’t know. On the North End you can be a saint while you’re still around, if you’re nice enough. Please don’t tell Gus. He’ll stand up straighter, and he’s already very straight.)' },
  { name: 'SAN BRINE', sub: 'the persistent', color: '#4a7a9a', icon: 'boat', text: 'SAN BRINE THE PERSISTENT — patron of ferries, and of going anyway.' },
  { name: 'SANTA MURMUR', sub: 'of the hook', color: '#a8b8c8', icon: 'ghost', text: 'SANTA MURMUR OF THE HOOK — patron of polishing what nobody uses anymore. The frame is very, very clean. Nobody here cleans it.' },
  { name: 'SANTA FORMAGGIA', sub: 'of the wheel', color: '#e0b040', icon: 'wheel', text: 'SANTA FORMAGGIA OF THE WHEEL — pray for us, and for the price of parm.' },
];

// ======================================================================
export function createNorthEnd(player) {
  const group = new THREE.Group();
  const outdoor = [];     // the North End (and the oak), while you're near
  const atBulko = [];     // the night shift, while you're near BULKO
  const inside = {};
  function put(obj, u, v, y = 0, ry = 0) {
    const p = W(u, v);
    obj.position.set(p.x, gy(u, v) + y, p.z);
    obj.rotation.y = ry;
    group.add(obj);
    return obj;
  }
  function solidBox(u, v, w, d, ry = 0, kind) {
    const p = W(u, v);
    zones.addBlockerBox(p.x, p.z, w, d, ry, 0, kind);
  }
  function solidDisc(u, v, r, kind) {
    const p = W(u, v);
    zones.addBlocker(p.x, p.z, r, kind);
  }
  const at = (u, v) => new THREE.Vector3(W(u, v).x, 0, W(u, v).z);
  function local(u, v, ry, lx, lz) {
    const c = Math.cos(ry), s = Math.sin(ry);
    return [u + lx * c + lz * s, v - lx * s + lz * c];
  }
  // a thing worn on the face (glasses, sunglasses) rides the head
  function onFace(a, mesh, x, y, z) {
    mesh.position.set(x, y, z);
    a.add(mesh);
    a.updateMatrixWorld(true);
    a.userData.parts.head.attach(mesh);
    return mesh;
  }
  // something worn on top (a flat cap, a toque, a headscarf), sized and
  // seated on the head the way hats.js fits a hat
  function wear(a, hat) {
    const head = a.userData.parts.head;
    const r = head.geometry?.parameters?.radius ?? 0.42, hs = head.scale;
    const k = (r * Math.sqrt(hs.x * hs.z)) / 0.42;
    hat.scale.set(k / hs.x, k / hs.y, k / hs.z);
    hat.position.set(0, a.userData.parts.hatY ?? r * 0.78, a.userData.parts.hatZ ?? 0);
    hat.traverse((o) => { if (o.isMesh) o.castShadow = true; });
    head.add(hat);
    return hat;
  }
  function folk(kind, colors, x, y, z, ry, { scale, fidget, still } = {}) {
    const a = buildAnimal(kind, colors);
    if (scale) a.scale.setScalar(scale);
    a.position.set(x, y, z);
    a.rotation.y = ry;
    if (fidget) a.userData.fidget = true;
    if (still) a.userData.noFidget = true;
    group.add(a);
    return a;
  }
  function listFor(zone) { return zone === 'island' ? outdoor : (inside[zone] ??= []); }
  function attend(a, zone, r = 4.5, list) {
    const base = a.rotation.y;
    (list || listFor(zone)).push((dt, t, pp) => {
      const d = Math.hypot(pp.x - a.position.x, pp.z - a.position.z);
      a.rotation.y = turnToward(a.rotation.y, d < r ? Math.atan2(pp.x - a.position.x, pp.z - a.position.z) : base, dt, 3);
    });
  }
  async function till(who, voice, prompt, goods) {
    const V = { speaker: who, voice };
    const c = await ui.ask(prompt, [
      ...goods.map((g, k) => ({ label: `${ITEMS[g.id].emoji} ${ITEMS[g.id].name}`, value: String(k), hint: `${g.price}🔘`, disabled: S.state.buttons < g.price })),
      { label: 'Just looking', value: null },
    ], V);
    if (c === null || c === undefined) return null;
    const g = goods[Number(c)];
    S.spend(g.price);
    S.addItem(g.id);
    kaching();
    ui.updateHUD();
    ui.toast(`You got <b>${ITEMS[g.id].name}</b>.`, ITEMS[g.id].emoji);
    if (g.say) await ui.say(g.say, V);
    return g;
  }

  addIslandInfo({
    key: 'cran_north',
    name: 'The North End', x: N.x, z: N.z - 2, r: 15, icon: '🍝',
    blurb: 'The top of the Isle of Cran, where the creek starts: a cobbled piazza under strings of lights, the Olive Burrow (unlimited breadsticks; not a front), Zio Orso’s pasticceria, Caffè Bandito, a grotto at the spring, a bocce court, and the Alley of the Saints.',
    folk: 'Benny (a ferret; a waiter) · Nonna (a raccoon; the kitchen) · Zio Orso (a bear; cannoli) · Gufo (an owl; espresso) · Valentina (fabulous) · and others, who would prefer not to be listed',
    mystery: '“North end of the red island there’s a lot of lights, nights, and a smell of garlic you can catch from the boat. I put in there once. They fed me. Wouldn’t take my buttons. Gave me a hat.” —Captain Brine',
  });

  // =========================================================== the piazza ----
  // a facade on the square: plinth to the ground, walls, a roof, a door, round
  // windows (with window boxes of geraniums), a striped awning, the sign
  function facade(b, { wall, trim, roof, flat = false, awning, signLines, signOpts, doorColor = 0x5a3a2a, doorW = 1.3, windows = [], upper = [] }) {
    const g = new THREE.Group();
    // foundation: down to the lowest corner (the cobbles are flat; the moss behind isn't)
    let lo = 0;
    for (const [sx, sz] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) {
      const [cu, cv] = local(b.u, b.v, b.ry, sx * b.w / 2, sz * b.d / 2);
      lo = Math.min(lo, gy(cu, cv) - gy(b.u, b.v));
    }
    const plinth = box(b.w + 0.3, 0.6 - lo, b.d + 0.3, 0x8a7a6a);
    plinth.position.y = (0.3 + lo) / 2 - 0.15;
    const body = box(b.w, b.h, b.d, wall);
    body.position.y = b.h / 2;
    g.add(plinth, body);
    if (flat) {
      const cap = box(b.w + 0.4, 0.3, b.d + 0.4, roof);
      cap.position.y = b.h + 0.15;
      const cornice = box(b.w + 0.5, 0.18, 0.3, trim);
      cornice.position.set(0, b.h - 0.25, b.d / 2 + 0.1);
      g.add(cap, cornice);
    } else {
      const r = (b.d + 0.8) / 1.73;
      const geo = new THREE.CylinderGeometry(r, r, b.w + 0.4, 3, 1, false, Math.PI / 2);
      geo.rotateZ(Math.PI / 2);
      const rf = new THREE.Mesh(geo, mat(roof));
      rf.scale.y = 1.4 / (r * 1.5);
      rf.position.y = b.h + 0.45;
      rf.castShadow = rf.receiveShadow = true;
      g.add(rf);
    }
    const door = box(doorW, 2.0, 0.12, doorColor);
    door.position.set(0, 1.0, b.d / 2 + 0.03);
    const lintel = box(doorW + 0.3, 0.18, 0.18, trim);
    lintel.position.set(0, 2.08, b.d / 2 + 0.06);
    g.add(door, lintel);
    for (const [wx, wy] of [...windows.map((x) => [x, 1.6]), ...upper.map((x) => [x, b.h - 0.85])]) {
      const win = makeWindow(0.34);
      win.position.set(wx, wy, b.d / 2 + 0.02);
      g.add(win);
      // a window box, and the geraniums in it
      const wb = box(0.9, 0.2, 0.25, trim);
      wb.position.set(wx, wy - 0.55, b.d / 2 + 0.14);
      g.add(wb);
      for (let k = 0; k < 4; k++) {
        const fl = ball(0.09, k % 2 ? 0xd8342c : 0xe8573f);
        fl.position.set(wx - 0.3 + k * 0.2, wy - 0.38, b.d / 2 + 0.16);
        const lf = ball(0.08, 0x4a8a3a);
        lf.position.set(wx - 0.3 + k * 0.2, wy - 0.44, b.d / 2 + 0.2);
        g.add(fl, lf);
      }
    }
    if (awning) {
      // a striped awning over the door: alternating slats, tilted out
      const aw = new THREE.Group();
      const n = Math.round(awning.w / 0.35);
      for (let k = 0; k < n; k++) {
        const slat = box(awning.w / n, 0.06, 1.0, k % 2 ? awning.c2 : awning.c1);
        slat.position.set(-awning.w / 2 + (k + 0.5) * (awning.w / n), 0, 0.5);
        aw.add(slat);
        const flap = box(awning.w / n, 0.22, 0.05, k % 2 ? awning.c2 : awning.c1);
        flap.position.set(-awning.w / 2 + (k + 0.5) * (awning.w / n), -0.1, 1.0);
        aw.add(flap);
      }
      aw.rotation.x = 0.32;
      aw.position.set(awning.x ?? 0, awning.y ?? 2.45, b.d / 2);
      g.add(aw);
    }
    if (signLines) {
      const sg = sign(signLines, signOpts);
      sg.position.set(0, signOpts.y ?? b.h - 0.45, b.d / 2 + 0.08);
      g.add(sg);
    }
    g.traverse((o) => { if (o.isMesh && !o.material.map && o.material.isMeshStandardMaterial) { o.castShadow = true; o.receiveShadow = true; } });
    put(g, b.u, b.v, 0, b.ry);
    solidBox(b.u, b.v, b.w + 0.3, b.d + 0.3, b.ry);
    const [du, dv] = local(b.u, b.v, b.ry, 0, b.d / 2 + 0.15);
    return { g, door: [du, dv] };
  }

  // ---------------------------------------------------- the Olive Burrow ----
  const EXIT = {};
  function doorway(id, u, v, ry, label, extra) {
    const ox = Math.sin(ry), oz = Math.cos(ry);
    const p = W(u, v);
    EXIT[id] = { x: p.x + ox * 1.2, z: p.z + oz * 1.2, rotY: ry };
    zones.setDoor(id, { x: EXIT[id].x, z: EXIT[id].z });
    register({ pos: new THREE.Vector3(p.x + ox * 0.6, 0, p.z + oz * 0.6), r: 1.6, label, use: async () => { await zones.go(id); await extra?.(); } });
  }
  {
    const b = facade(OLIVE, {
      wall: 0xe2ad6e, trim: 0x6b7a3a, roof: 0xb5523a, doorColor: 0x6b4a2e, doorW: 1.6,
      awning: { w: 3.2, c1: 0x5a7a3a, c2: 0xf3ead6 },
      windows: [-3.4, 3.4], upper: [],
      signLines: ['THE OLIVE BURROW', 'family dining · unlimited breadsticks · not a front'],
      signOpts: { w: 6.4, h: 0.9, bg: '#5a7a3a', fg: '#fbf3e0', border: '#d9a440', y: 3.05 },
    });
    // a chimney (Nonna's ovens), and a pair of potted cypresses at the door
    const chim = box(0.7, 1.6, 0.7, 0xa8583a);
    chim.position.set(-3.4, OLIVE.h + 0.9, -1.2);
    b.g.add(chim);
    for (const sx of [-1.5, 1.5]) {
      const pot = cyl(0.32, 0.24, 0.5, 8, 0xc4683a);
      pot.position.set(sx, 0.25, OLIVE.d / 2 + 0.55);
      const tree = new THREE.Mesh(new THREE.ConeGeometry(0.35, 1.8, 6), mat(0x2f5a32));
      tree.position.set(sx, 1.35, OLIVE.d / 2 + 0.55);
      tree.castShadow = tree.receiveShadow = true;
      b.g.add(pot, tree);
      const [pu, pv] = local(OLIVE.u, OLIVE.v, OLIVE.ry, sx, OLIVE.d / 2 + 0.55);
      solidDisc(pu, pv, 0.34);
    }
    // the menu board out front
    const menu = sign(['TONIGHT', 'everything', 'ALWAYS', 'breadsticks'], { w: 0.9, h: 1.2, bg: '#2e2a26', fg: '#fbf3e0' });
    const [mu, mv] = local(OLIVE.u, OLIVE.v, OLIVE.ry, 3.0, OLIVE.d / 2 + 1.2);
    put(menu, mu, mv, 0.75, 0.25);
    put(box(0.08, 0.7, 0.08, 0x3a3026), mu, mv, 0.3, 0);
    solidBox(mu, mv, 0.9, 0.3, 0.25);
    register({
      pos: at(mu, mv + 0.7), r: 1.3, priority: 0,
      label: 'read the menu board',
      use: () => ui.say('A chalkboard in a frame. TONIGHT: everything. ALWAYS: breadsticks. Underneath, smaller, in a different hand: “ask about the back.” Under that, in the first hand: “DON’T ask about the back.”'),
    });
    doorway('cran_olive', ...b.door, OLIVE.ry, 'go into the Olive Burrow');
    // the kitchen door, round the back
    const bd = box(1.1, 2.0, 0.1, 0x5a7a3a);
    const [bu, bv] = [BACKDOOR.u, BACKDOOR.v];
    put(bd, bu, bv - 0.07, 1.0 + (gy(OLIVE.u, OLIVE.v) - gy(bu, bv)), 0);
    const bsg = sign(['KITCHEN', 'deliveries · family'], { w: 1.2, h: 0.4, bg: '#f3ead6', fg: '#5a7a3a' });
    put(bsg, bu, bv - 0.08, 2.35 + (gy(OLIVE.u, OLIVE.v) - gy(bu, bv)), Math.PI);
    EXIT.olive_back = { x: W(bu, bv - 1.3).x, z: W(bu, bv - 1.3).z, rotY: Math.PI };
  }

  // ------------------------------------------------- Zio Orso's (dolci) ----
  {
    const b = facade(DOLCI, {
      wall: 0xf4c9cd, trim: 0xfbf6ee, roof: 0xe8a0a8, flat: true, doorColor: 0xfbf6ee, doorW: 1.2,
      awning: { w: 5.2, c1: 0xe87a90, c2: 0xfbf6ee, y: 2.25 },
      windows: [1.9],
      signLines: ['ZIO ORSO', 'pasticceria · cannoli filled to order'],
      signOpts: { w: 4.6, h: 0.85, bg: '#fbf6ee', fg: '#c8506a', border: '#e87a90', y: 3.05 },
    });
    // on the roof: a cannoli the size of a rowboat
    const can = new THREE.Group();
    const shell = cyl(0.55, 0.55, 3.2, 10, 0xd8a060);
    shell.rotation.z = Math.PI / 2;
    can.add(shell);
    for (const sx of [-1, 1]) {
      const cream = ball(0.5, 0xfbf6ee, 1);
      cream.scale.set(0.45, 1, 1);
      cream.position.x = sx * 1.68;
      const cherry = ball(0.15, 0xc8202c);
      cherry.position.set(sx * 1.8, 0.1, 0);
      const chips = ball(0.06, 0x4a2a1a);
      chips.position.set(sx * 1.85, -0.2, 0.25);
      can.add(cream, cherry, chips);
    }
    const sugar = ball(0.04, 0xffffff); // a dusting
    sugar.position.set(0.4, 0.56, 0.1);
    can.add(sugar);
    for (const sx of [-1, 1]) {
      const prop = box(0.2, 0.5, 0.6, 0xfbf6ee);
      prop.position.set(sx * 0.9, -0.55, 0);
      can.add(prop);
    }
    can.traverse((o) => { if (o.isMesh) o.castShadow = o.receiveShadow = true; });
    can.position.set(0, DOLCI.h + 1.1, 0);
    can.rotation.y = 0.12;
    b.g.add(can);
    const card = sign(['NO LOBSTERS', 'in the lobster tails'], { w: 1.3, h: 0.5, bg: '#fffaf0', fg: '#c8202c' });
    card.position.set(1.9, 1.0, DOLCI.d / 2 + 0.1);
    b.g.add(card);
    doorway('cran_dolci', ...b.door, DOLCI.ry, 'go into Zio Orso’s');
  }

  // ------------------------------------------------------ Caffè Bandito ----
  {
    const b = facade(CAFFE, {
      wall: 0x3e6a52, trim: 0xf3ead6, roof: 0x2e4a3a, flat: true, doorColor: 0x5a3a2a, doorW: 1.2,
      awning: { w: 4.4, c1: 0xc8343a, c2: 0xf3ead6, y: 2.2 },
      windows: [1.7],
      signLines: ['CAFFÈ BANDITO', 'espresso · standing room'],
      signOpts: { w: 4.4, h: 0.8, bg: '#f3ead6', fg: '#3e6a52', border: '#c8343a', y: 2.75 },
    });
    // on the roof: an espresso cup, with steam
    const cup = new THREE.Group();
    const c = cyl(0.75, 0.55, 0.9, 10, 0xfbf6ee);
    const coffee = cyl(0.68, 0.68, 0.06, 10, 0x4a2a1a);
    coffee.position.y = 0.4; // (just under the rim)
    const handle = new THREE.Mesh(new THREE.TorusGeometry(0.28, 0.08, 5, 10), mat(0xfbf6ee));
    handle.position.set(0.82, 0.05, 0);
    const saucer = cyl(1.1, 1.0, 0.1, 12, 0xfbf6ee);
    saucer.position.y = -0.48;
    cup.add(c, coffee, handle, saucer);
    cup.traverse((o) => { if (o.isMesh) o.castShadow = o.receiveShadow = true; });
    cup.position.set(0, CAFFE.h + 0.85, -0.3);
    b.g.add(cup);
    const steam = [];
    for (let k = 0; k < 3; k++) {
      const s = new THREE.Mesh(new THREE.IcosahedronGeometry(0.18, 0), mat(0xffffff, 1));
      s.material.transparent = true;
      s.material.opacity = 0.6;
      s.castShadow = false;
      s.userData.dynamic = true;
      b.g.add(s);
      steam.push(s);
    }
    outdoor.push((dt, t) => steam.forEach((s, k) => {
      const ph = (t * 0.35 + k / 3) % 1;
      s.position.set(Math.sin(ph * 6 + k) * 0.15, CAFFE.h + 1.4 + ph * 1.4, -0.3);
      s.scale.setScalar(0.6 + ph);
      s.material.opacity = 0.55 * (1 - ph);
    }));
    doorway('cran_caffe', ...b.door, CAFFE.ry, 'go into Caffè Bandito');
  }

  // ------------------------------------------- a table outside the caffè ----
  // Valentina's, by day (nine to six). The best table in the North End,
  // because she sat at it.
  const VTABLE = { u: CAFFE.u + CAFFE.d / 2 + 2.0, v: CAFFE.v - 3.0 };
  let valOut;
  {
    const tg = new THREE.Group();
    const top = new THREE.Mesh(new THREE.CylinderGeometry(0.55, 0.55, 0.05, 10), checkCloth());
    top.position.y = 0.78;
    top.castShadow = top.receiveShadow = true;
    const leg = cyl(0.05, 0.05, 0.76, 6, 0x2e2a26);
    leg.position.y = 0.38;
    const foot = cyl(0.3, 0.3, 0.04, 8, 0x2e2a26);
    const pole = cyl(0.04, 0.04, 2.3, 6, 0xf3ead6);
    pole.position.y = 1.4;
    const brolly = new THREE.Mesh(new THREE.ConeGeometry(1.3, 0.5, 8), mat(0x5a7a3a));
    brolly.position.y = 2.6;
    brolly.castShadow = true;
    const cupT = cyl(0.06, 0.05, 0.08, 6, 0xfbf6ee);
    cupT.position.set(0.15, 0.85, 0.1);
    tg.add(top, leg, foot, pole, brolly, cupT);
    for (const [sx, ry] of [[-0.9, Math.PI / 2], [0.9, -Math.PI / 2]]) {
      const ch = box(0.45, 0.06, 0.45, 0x2e2a26);
      ch.position.set(sx, 0.45, 0);
      const back = box(0.06, 0.5, 0.45, 0x2e2a26);
      back.position.set(sx + Math.sign(sx) * 0.22, 0.7, 0);
      tg.add(ch, back);
      void ry;
    }
    put(tg, VTABLE.u, VTABLE.v, 0);
    solidDisc(VTABLE.u, VTABLE.v, 0.6);
    solidDisc(VTABLE.u - 0.9, VTABLE.v, 0.3);
    solidDisc(VTABLE.u + 0.9, VTABLE.v, 0.3);
    const p = W(VTABLE.u - 0.9, VTABLE.v);
    valOut = valentina(p.x, gy(VTABLE.u, VTABLE.v) + 0.15, p.z, Math.PI / 2);
    attend(valOut, 'island', 5);
    register({
      getPos: () => valOut.position, r: 2.2, label: () => (S.hasFlag('metValentina') ? 'talk to Valentina' : 'talk to the fabulous raccoon'),
      enabled: () => valentinaOut(),
      use: () => talkValentina(true),
    });
    outdoor.push(() => { valOut.visible = valentinaOut(); });
  }

  // a fabulous raccoon: silver, pink boa, pearl buttons, sunglasses, a tiara
  function valentina(x, y, z, ry) {
    const a = folk('raccoon', { body: 0xbab0b4, head: 0xbab0b4, mask: 0x3a3036, light: 0xfff6f0, ring: 0x4a4048 }, x, y, z, ry, { scale: 0.95 });
    for (let k = 0; k < 14; k++) {
      const ang = (k / 14) * Math.PI * 2;
      const f = ball(0.11, k % 2 ? 0xff8fc8 : 0xff6fb4);
      f.position.set(Math.cos(ang) * 0.42, 0.96 + Math.sin(k * 1.7) * 0.03, 0.2 + Math.sin(ang) * 0.32);
      a.add(f);
    }
    for (let k = 0; k < 7; k++) {
      const ang = Math.PI * (0.15 + (k / 6) * 0.7);
      const p = ball(0.045, 0xfbf6f0);
      p.position.set(Math.cos(ang) * 0.3, 0.86 - Math.sin(ang) * 0.08, 0.42 + Math.sin(ang) * 0.12);
      a.add(p);
    }
    const lens = mat(0x1a1a20, 0.3), frame = mat(0xff6fb4, 0.5);
    for (const sx of [-1, 1]) {
      const l = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.12, 0.03, 10), lens);
      l.rotation.x = Math.PI / 2;
      onFace(a, l, sx * 0.17, 1.28, 0.83);
      const fr = new THREE.Mesh(new THREE.TorusGeometry(0.125, 0.025, 5, 12), frame);
      onFace(a, fr, sx * 0.17, 1.28, 0.84);
    }
    onFace(a, new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.03, 0.03), frame), 0, 1.3, 0.86);
    const gold = mat(0xe8c050, 0.35);
    const band = new THREE.Mesh(new THREE.TorusGeometry(0.22, 0.03, 5, 12, Math.PI), gold);
    onFace(a, band, 0, 1.56, 0.32);
    for (const sx of [-0.12, 0, 0.12]) {
      const pt = new THREE.Mesh(new THREE.ConeGeometry(0.04, sx ? 0.12 : 0.18, 4), gold);
      onFace(a, pt, sx, 1.62 + (sx ? 0 : 0.03), 0.32);
    }
    a.traverse((o) => { if (o.isMesh) o.castShadow = true; });
    return a;
  }
  async function talkValentina(outside) {
    const V = { speaker: 'Valentina', voice: VOICE.val };
    if (!S.hasFlag('metValentina')) {
      S.setFlag('metValentina');
      await ui.say([
        { ...V, text: 'Oh! A new face. Turn. The other way. …Yes. You’ll do.' },
        { ...V, text: 'Valentina. Of the North End Valentinas. There’s only one. That’s the point.' },
      ]);
      return;
    }
    await ui.say(outside ? nextLine('valOut', VAL_OUT) : nextLine('val', VAL), V);
  }

  // --------------------------------------------------- the string lights ----
  // across the piazza, pole to pole, a sag of warm bulbs; they come on at
  // dusk with the windows (emissive glass, not lights)
  {
    const poles = [[-8.5, -4.6], [7.0, -4.6], [-8.5, 7.5], [8.0, 6.0]].map(([u, v]) => ({ u, v }));
    for (const p of poles) {
      put(cyl(0.08, 0.1, 4.2, 6, 0x3a3a3e), p.u, p.v, 2.1);
      put(ball(0.12, 0x3a3a3e), p.u, p.v, 4.25);
      solidDisc(p.u, p.v, 0.18);
    }
    const bulbMat = mat(0xfff2cc, 0.5);
    for (const [a, b] of [[0, 3], [1, 2], [0, 1]]) {
      const A = poles[a], B = poles[b];
      const pa = W(A.u, A.v), pb = W(B.u, B.v);
      const ya = gy(A.u, A.v) + 4.15, yb = gy(B.u, B.v) + 4.15;
      const L = Math.hypot(pb.x - pa.x, pb.z - pa.z);
      const sag = 0.06 * L;
      const P = (t) => new THREE.Vector3(pa.x + (pb.x - pa.x) * t, ya + (yb - ya) * t - sag * 4 * t * (1 - t), pa.z + (pb.z - pa.z) * t);
      const n = Math.round(L / 1.6);
      for (let k = 0; k < n; k++) {
        const p0 = P(k / n), p1 = P((k + 1) / n);
        const wire = new THREE.Mesh(new THREE.CylinderGeometry(0.015, 0.015, p0.distanceTo(p1), 4), mat(0x2a2a2e));
        wire.position.copy(p0).add(p1).multiplyScalar(0.5);
        wire.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), p1.clone().sub(p0).normalize());
        wire.castShadow = false;
        group.add(wire);
        const bulb = new THREE.Mesh(new THREE.IcosahedronGeometry(0.1, 0), bulbMat);
        bulb.position.copy(P((k + 0.5) / n)).add(new THREE.Vector3(0, -0.12, 0));
        bulb.castShadow = false;
        glowWindow(bulb, { warm: 0xffd890, max: 0.9 });
        group.add(bulb);
      }
    }
  }

  // ========================================================== the grotto ----
  // Where the creek starts: a heap of mossy rock with a niche in it, and in
  // the niche Nonno Aldo, in stone, in his diving helmet, holding up one
  // button. The spring comes out under him into a stone basin, spills over,
  // and becomes the creek. People throw buttons in. Of course they do.
  {
    const g = new THREE.Group();
    const rock = [0x7e7a6c, 0x8a8678, 0x726e62];
    for (let k = 0; k < 9; k++) {
      const a = Math.PI * (0.95 + (k / 8) * 1.1); // a horseshoe, open to the south
      const r = GROTTO.r * (0.8 + (k % 3) * 0.12);
      const st = ball(0.9 + (k % 3) * 0.25, rock[k % 3]);
      st.scale.set(1, 0.85 + (k % 2) * 0.3, 1);
      st.position.set(Math.cos(a) * r * 0.75, 0.6 + (k % 2) * 0.5, Math.sin(a) * r * 0.6);
      g.add(st);
    }
    // the top of the heap, and moss on it
    const cap = ball(1.6, 0x8a8678);
    cap.scale.set(1.3, 0.7, 1.0);
    cap.position.set(0, 2.3, -0.6);
    g.add(cap);
    for (let k = 0; k < 7; k++) {
      const m = ball(0.35, k % 2 ? 0x4a7a42 : 0x3d6b38);
      m.scale.y = 0.4;
      m.position.set(Math.cos(k * 0.9) * 1.3, 2.75 - (k % 3) * 0.2, -0.6 + Math.sin(k * 0.9) * 0.6);
      g.add(m);
    }
    // the niche: dark, round-topped, set in
    const niche = new THREE.Mesh(new THREE.CylinderGeometry(0.85, 0.85, 0.5, 10, 1, false, -Math.PI / 2, Math.PI), mat(0x2e2a24));
    niche.rotation.x = Math.PI / 2;
    niche.position.set(0, 1.6, 0.2);
    const nicheLow = box(1.7, 1.1, 0.5, 0x2e2a24);
    nicheLow.position.set(0, 1.05, 0.2);
    g.add(niche, nicheLow);
    // Nonno Aldo, in stone
    const stone = 0xc8c2b4;
    const aldo = buildAnimal('raccoon', { body: stone, head: stone, mask: 0x9a958a, light: 0xdcd6c8, ring: 0xa8a294 });
    aldo.scale.setScalar(0.62);
    aldo.position.set(0, 0.6, 0.35);
    aldo.userData.noFidget = true;
    const helmet = new THREE.Mesh(new THREE.IcosahedronGeometry(0.58, 1), mat(0xb8b2a4));
    const port = new THREE.Mesh(new THREE.CylinderGeometry(0.26, 0.26, 0.1, 10), mat(0x9a958a));
    port.rotation.x = Math.PI / 2;
    port.position.set(0, 0, 0.55);
    helmet.add(port);
    helmet.position.set(0, 1.2, 0.34);
    aldo.add(helmet);
    aldo.updateMatrixWorld(true);
    aldo.userData.parts.head.attach(helmet);
    const button = cyl(0.2, 0.2, 0.06, 10, 0xd9a440);
    button.material = mat(0xd9a440, 0.35);
    button.rotation.x = Math.PI / 2;
    button.position.set(0, 1.85, 0.75);
    g.add(aldo, button);
    // the basin: a stone half-ring in the spring, brimming
    const basin = new THREE.Mesh(new THREE.TorusGeometry(0.85, 0.16, 5, 12, Math.PI), mat(0xb8b2a4));
    basin.rotation.x = -Math.PI / 2;
    basin.position.set(0, 0.25, 1.0);
    const pool = new THREE.Mesh(new THREE.CircleGeometry(0.8, 12, 0, Math.PI), mat(0x7ec8d8, 0.3));
    pool.rotation.x = -Math.PI / 2;
    pool.position.set(0, 0.3, 1.0);
    g.add(basin, pool);
    // candles on the ledges (lit, always; nobody has ever seen who lights them)
    for (const [cx, cy, cz] of [[-0.7, 0.62, 0.55], [0.7, 0.62, 0.55], [-1.05, 1.2, 0.35], [1.05, 1.2, 0.35]]) {
      const cdl = cyl(0.06, 0.06, 0.2, 6, 0xfbf6ee);
      cdl.position.set(cx, cy, cz);
      const fl = glow(0.05, 0xffc860);
      fl.position.set(cx, cy + 0.15, cz);
      g.add(cdl, fl);
    }
    for (let k = 0; k < 5; k++) {
      const f = ball(0.08, [0xf28fb0, 0xffffff, 0xf2cf5b][k % 3]);
      f.position.set(-0.9 + k * 0.45, 0.42, 0.75 - Math.abs(k - 2) * 0.1);
      g.add(f);
    }
    g.traverse((o) => { if (o.isMesh && !o.material.isMeshBasicMaterial) o.castShadow = o.receiveShadow = true; });
    const base = Math.max(gy(GROTTO.u, GROTTO.v), 0.6);
    const p = W(GROTTO.u, GROTTO.v);
    g.position.set(p.x, base - 0.3, p.z);
    group.add(g);
    solidDisc(GROTTO.u, GROTTO.v + 0.1, 2.85); // (the whole heap, side stones and all)
    // the spout: a little arc of water out of the rock into the basin, then over
    const drops = [];
    for (let k = 0; k < 10; k++) {
      const d = new THREE.Mesh(new THREE.IcosahedronGeometry(0.06, 0), mat(0xbfe6f2, 0.3));
      d.castShadow = false;
      d.userData.dynamic = true;
      group.add(d);
      drops.push(d);
    }
    outdoor.push((dt, t) => drops.forEach((d, k) => {
      const ph = (t * 0.9 + k / drops.length) % 1;
      d.position.set(p.x + Math.sin(k * 2.3) * 0.08, base - 0.3 + 0.75 - ph * ph * 0.55, p.z + 0.45 + ph * 0.6);
    }));
    // the plaque, and the wishing
    const plaque = sign(['NONNO ALDO PROCIONE', 'dove forty times · kept every button'], { w: 1.8, h: 0.5, bg: '#b8b2a4', fg: '#3a3026' });
    plaque.position.set(p.x - 1.9, base + 0.2, p.z + 1.6);
    plaque.rotation.set(-0.5, 0.35, 0);
    group.add(plaque);
    zones.addBlocker(plaque.position.x, plaque.position.z, 0.75);
    const wb = W(GROTTO.u - 2.6, GROTTO.v + 2.4);
    register({
      pos: new THREE.Vector3(wb.x, 0, wb.z), r: 1.9,
      label: 'read the grotto’s plaque',
      use: () => ui.say([
        'NONNO ALDO PROCIONE. Who dove forty times for a bell he never found, and was paid each time in buttons from a jar, and kept every one. The spring under him never stops. Neither did he.',
        'In the niche he holds up a single button, in stone, the way you’d hold up something you just found. Somebody has polished the button. Nobody has polished the rest of him. That seems right.',
      ]),
    });
    const wb2 = W(GROTTO.u + 2.7, GROTTO.v + 2.2);
    register({
      pos: new THREE.Vector3(wb2.x, 0, wb2.z), r: 1.9,
      label: 'toss a button into the spring',
      use: async () => {
        if (!S.spend(1)) {
          await ui.say('You pat your pockets. Not one button. Nonno Aldo, of all people, understands.');
          return;
        }
        ui.updateHUD();
        tone(1320, { dur: 0.08, type: 'sine', vol: 0.05 });
        tone(990, { time: 0.12, dur: 0.12, type: 'sine', vol: 0.04 });
        await ui.say(nextLine('wish', [
          'You toss a button into the spring. It wobbles down through the clear water and settles among the others: hundreds of them, every color. Somewhere, a raccoon is pleased.',
          'Plink. You wish for something. You don’t say what. That’s the rule, and also nobody asked.',
          'The button lands face-up. Nonno Aldo would have liked that. He liked everything face-up.',
          'Plink. A cranberry bobs out from under the basin and away down the creek. You decide it’s carrying your wish to the sea. It seems to know the way.',
        ]));
      },
    });
  }

  // ============================================== the Alley of the Saints ----
  // Between the Olive Burrow and Zio Orso's: an arch with a sign, and on
  // both walls little painted saints of the archipelago, each with a candle.
  // At the far end, on her own pillar, an empty frame — Santa Campana — and
  // past her, the trash can.
  function saintPanel(s) {
    return painting(0.75, 0.95, (ctx, w, h) => {
      ctx.fillStyle = '#c8a050';
      ctx.fillRect(0, 0, w, h);
      ctx.fillStyle = s.color;
      ctx.fillRect(w * 0.08, h * 0.06, w * 0.84, h * 0.7);
      // the halo, and the saint (round and simple, like a stamp)
      ctx.strokeStyle = '#ffe9a0';
      ctx.lineWidth = w * 0.04;
      ctx.beginPath();
      ctx.arc(w / 2, h * 0.3, w * 0.22, 0, Math.PI * 2);
      ctx.stroke();
      if (s.icon) {
        ctx.fillStyle = '#f3ead6';
        ctx.beginPath();
        ctx.arc(w / 2, h * 0.32, w * 0.15, 0, Math.PI * 2);
        ctx.fill();
        ctx.beginPath();
        ctx.ellipse(w / 2, h * 0.62, w * 0.22, h * 0.13, 0, Math.PI, 0);
        ctx.fill();
        ctx.fillStyle = '#3a3026';
        if (s.icon === 'helmet') { ctx.fillStyle = '#c8a050'; ctx.beginPath(); ctx.arc(w / 2, h * 0.32, w * 0.09, 0, Math.PI * 2); ctx.fill(); }
        if (s.icon === 'jar') { ctx.fillRect(w * 0.4, h * 0.5, w * 0.2, h * 0.14); }
        if (s.icon === 'shell') { ctx.fillStyle = '#5a7a3a'; ctx.beginPath(); ctx.ellipse(w / 2, h * 0.55, w * 0.18, h * 0.07, 0, Math.PI, 0); ctx.fill(); }
        if (s.icon === 'boat') { ctx.beginPath(); ctx.moveTo(w * 0.3, h * 0.56); ctx.lineTo(w * 0.7, h * 0.56); ctx.lineTo(w * 0.62, h * 0.66); ctx.lineTo(w * 0.38, h * 0.66); ctx.fill(); }
        if (s.icon === 'ghost') { ctx.globalAlpha = 0.5; ctx.fillStyle = '#ffffff'; ctx.fillRect(w * 0.3, h * 0.2, w * 0.4, h * 0.5); ctx.globalAlpha = 1; }
        if (s.icon === 'wheel') { ctx.fillStyle = '#e8c95c'; ctx.beginPath(); ctx.ellipse(w / 2, h * 0.58, w * 0.2, h * 0.06, 0, 0, Math.PI * 2); ctx.fill(); }
        ctx.fillStyle = '#2e2a26';
        ctx.fillRect(w * 0.42, h * 0.3, w * 0.05, h * 0.03);
        ctx.fillRect(w * 0.53, h * 0.3, w * 0.05, h * 0.03);
      }
      ctx.fillStyle = '#3a3026';
      ctx.textAlign = 'center';
      ctx.font = FONT(Math.round(h * 0.075));
      ctx.fillText(s.name, w / 2, h * 0.85);
      ctx.font = FONT(Math.round(h * 0.055));
      ctx.fillText(s.sub, w / 2, h * 0.93);
    }, { px: 160 });
  }
  {
    const mouthV = OLIVE.v + OLIVE.d / 2 + 0.1;
    const midU = (ALLEY.u0 + ALLEY.u1) / 2, wid = ALLEY.u1 - ALLEY.u0;
    // the arch: two posts and a sign across
    for (const u of [ALLEY.u0 + 0.12, ALLEY.u1 - 0.12]) put(box(0.2, 3.3, 0.2, 0x6a5a48), u, mouthV, 1.65);
    const arch = sign(['ALLEY OF THE SAINTS', 'mind the candles'], { w: wid + 0.4, h: 0.6, bg: '#6a5a48', fg: '#ffe9a0' });
    put(arch, midU, mouthV, 3.2);
    register({
      pos: at(midU, mouthV + 0.8), r: 1.5, priority: 0,
      label: 'read the sign over the alley',
      use: () => ui.say([
        'ALLEY OF THE SAINTS. Mind the candles.',
        'On the North End you can be a saint while you’re still around, if you’re nice enough. The alley is where they put you. You don’t get a say. You get a candle.',
      ]),
    });
    // three on each wall, angled toward the street so you can see them coming
    SAINTS.forEach((s, k) => {
      const west = k < 3;
      const v = mouthV - 1.4 - (k % 3) * 1.6;
      const u = west ? ALLEY.u0 + 0.08 : ALLEY.u1 - 0.08;
      const ry = west ? Math.PI / 2 - 0.55 : -Math.PI / 2 + 0.55;
      const panel = saintPanel(s);
      put(panel, u + (west ? 0.03 : -0.03), v, 1.9, ry);
      const shelf = box(0.5, 0.06, 0.22, 0x8a7a6a);
      put(shelf, u + (west ? 0.12 : -0.12), v, 1.25, ry);
      const cdl = cyl(0.05, 0.05, 0.16, 6, 0xfbf6ee);
      put(cdl, u + (west ? 0.14 : -0.14), v, 1.36, 0);
      const fl = glow(0.045, 0xffc860);
      put(fl, u + (west ? 0.14 : -0.14), v, 1.5, 0);
      register({
        pos: at(midU + (west ? -0.4 : 0.4), v), r: 1.0, priority: 0,
        label: `look at ${s.name.split(' ').map((w) => w[0] + w.slice(1).toLowerCase()).join(' ')}`,
        use: () => ui.say(s.text),
      });
    });
    // Santa Campana, at the end, on her pillar: a halo, and nothing under it
    const pil = box(0.55, 1.3, 0.45, 0xb8b2a4);
    put(pil, CAMPANA.u, CAMPANA.v, 0.65);
    const empty = painting(0.75, 0.95, (ctx, w, h) => {
      ctx.fillStyle = '#c8a050';
      ctx.fillRect(0, 0, w, h);
      ctx.fillStyle = '#e8e2d4';
      ctx.fillRect(w * 0.08, h * 0.06, w * 0.84, h * 0.7);
      ctx.strokeStyle = '#ffe9a0';
      ctx.lineWidth = w * 0.04;
      ctx.beginPath();
      ctx.arc(w / 2, h * 0.3, w * 0.22, 0, Math.PI * 2);
      ctx.stroke();
      ctx.fillStyle = '#3a3026';
      ctx.textAlign = 'center';
      ctx.font = FONT(Math.round(h * 0.075));
      ctx.fillText('SANTA CAMPANA', w / 2, h * 0.85);
      ctx.font = FONT(Math.round(h * 0.055));
      ctx.fillText('not found yet', w / 2, h * 0.93);
    }, { px: 160 });
    put(empty, CAMPANA.u, CAMPANA.v, 1.85, 0);
    const cdl = cyl(0.06, 0.06, 0.22, 6, 0xfbf6ee);
    put(cdl, CAMPANA.u, CAMPANA.v + 0.12, 1.41);
    put(glow(0.055, 0xffc860), CAMPANA.u, CAMPANA.v + 0.12, 1.6);
    solidBox(CAMPANA.u, CAMPANA.v, 0.55, 0.45);
    register({
      pos: at(CAMPANA.u + 0.2, CAMPANA.v + 1.1), r: 1.1, priority: 0,
      label: 'look at the last frame',
      use: () => ui.say([
        'The last frame, on its own pillar at the end of the alley, has a halo in it and nothing under the halo. The card says SANTA CAMPANA — patron of things not found yet.',
        'Her candle is the only one in the alley that nobody has ever let go out.',
      ]),
    });
  }

  // ============================================== Vinnie's trash can ----
  // A dented can at the end of the alley with a raccoon in it. Lift the lid.
  // (Between midnight and four he's out — he's the boat.)
  const vin = { up: 0, want: 0 };
  {
    const cg = new THREE.Group();
    const can = cyl(0.42, 0.38, 1.0, 10, 0x8a9096);
    can.position.y = 0.5;
    cg.add(can);
    for (const y of [0.25, 0.75]) {
      const rib = new THREE.Mesh(new THREE.TorusGeometry(0.42, 0.03, 4, 12), mat(0x7a8086));
      rib.rotation.x = Math.PI / 2;
      rib.position.y = y;
      cg.add(rib);
    }
    const dent = ball(0.12, 0x7a8086);
    dent.scale.set(1, 1.4, 0.3);
    dent.position.set(0.3, 0.55, 0.28);
    cg.add(dent);
    const lidPivot = new THREE.Group();
    lidPivot.position.set(0, 1.02, -0.44);
    lidPivot.userData.dynamic = true;
    const lid = cyl(0.47, 0.47, 0.07, 10, 0x9aa0a6);
    lid.position.set(0, 0, 0.44);
    const knob = cyl(0.12, 0.12, 0.08, 6, 0x7a8086);
    knob.position.set(0, 0.07, 0.44);
    lidPivot.add(lid, knob);
    cg.add(lidPivot);
    // Vinnie, with his hat (it was a banana)
    const v = buildAnimal('raccoon', { body: 0x7e7c78, head: 0x7e7c78 });
    v.scale.setScalar(0.7);
    v.userData.noFidget = true;
    const peel = new THREE.Group();
    for (let k = 0; k < 4; k++) {
      const strip = new THREE.Mesh(new THREE.ConeGeometry(0.09, 0.42, 4), mat(0xf2d84a));
      strip.position.set(Math.cos(k * 1.57) * 0.12, -0.04, Math.sin(k * 1.57) * 0.12);
      strip.rotation.set(Math.sin(k * 1.57) * 2.3, 0, -Math.cos(k * 1.57) * 2.3);
      peel.add(strip);
    }
    const stem = cyl(0.04, 0.05, 0.14, 5, 0x6a4a2a);
    stem.position.y = 0.12;
    peel.add(stem);
    peel.position.set(0, 1.62, 0.3);
    v.add(peel);
    v.updateMatrixWorld(true);
    v.userData.parts.head.attach(peel);
    v.userData.dynamic = true;
    cg.add(v);
    cg.traverse((o) => { if (o.isMesh) o.castShadow = o.receiveShadow = true; });
    put(cg, CAN.u, CAN.v, 0, -0.3);
    solidDisc(CAN.u, CAN.v, 0.5);
    // a note on the lid, nights
    const note = sign(['OUT. BACK BY 4.', 'don’t touch the lid. —V.'], { w: 0.5, h: 0.32, d: 0.01, bg: '#fffaf0', fg: '#3a3026' });
    note.rotation.x = -Math.PI / 2;
    note.position.set(0, 0.04, 0.44);
    lid.add(note);
    note.position.set(0, 0.04, 0);
    const base = -0.95;
    outdoor.push((dt, t) => {
      vin.up += (vin.want - vin.up) * Math.min(1, dt * 5);
      lidPivot.rotation.x = -vin.up * 1.3;
      v.position.y = base + vin.up * 1.05;
      v.visible = vin.up > 0.02;
      v.rotation.y = 0.3 + Math.sin(t * 0.7) * 0.25 * vin.up;
      note.visible = heistOn();
    });
    const canSpot = W(CAN.u - 0.4, CAN.v + 1.0);
    register({
      pos: new THREE.Vector3(canSpot.x, 0, canSpot.z), r: 1.4,
      label: () => (heistOn() ? 'look at the trash can' : 'lift the lid of the trash can'),
      use: async () => {
        if (heistOn()) {
          await ui.say('The lid’s on tight. A note is taped to it: “OUT. BACK BY 4. DON’T TOUCH THE LID. —V.” You do not touch the lid.');
          return;
        }
        vin.want = 1;
        const V = { speaker: 'Vinnie', voice: VOICE.vinnie };
        try {
          if (S.hasFlag('famiglia')) {
            const c = await ui.ask('Famiglia. Going down?', [{ label: '⬇️ Going down', value: 'down' }, { label: 'Not right now', value: null }], V);
            if (c === 'down') await zones.go('cran_lair', LAIR_SPAWN.can);
          } else if (S.hasFlag('famigliaInvite')) {
            const c = await ui.ask('…Who sent ya?', [
              { label: '“Benny. I never said when.”', value: 'when' },
              { label: '“Nobody.”', value: 'nobody' },
            ], V);
            if (c === 'when') {
              await ui.say([
                { ...V, text: '…Never said when, huh.' },
                { ...V, text: 'Get in. Mind the stairs. Wipe your feet. It’s a trash can, not a barn.' },
              ]);
              await zones.go('cran_lair', LAIR_SPAWN.can);
            } else {
              await ui.say({ ...V, text: 'Then nobody’s home. Very normal can. Beat it.' });
            }
          } else {
            await ui.say(nextLine('vinnie', VINNIE), V);
          }
        } finally {
          vin.want = 0;
        }
      },
    });
  }

  // ================================================= the bocce court ----
  {
    const c = W(BOCCE.u, BOCCE.v);
    const y = gy(BOCCE.u, BOCCE.v);
    const court = box(BOCCE.w, 0.08, BOCCE.d, 0xd9c08f);
    court.position.set(c.x, y + 0.04, c.z);
    court.castShadow = false;
    group.add(court);
    for (const [w, d, ox, oz] of [[BOCCE.w + 0.3, 0.15, 0, -BOCCE.d / 2], [BOCCE.w + 0.3, 0.15, 0, BOCCE.d / 2], [0.15, BOCCE.d, -BOCCE.w / 2, 0], [0.15, BOCCE.d, BOCCE.w / 2, 0]]) {
      const curb = box(w, 0.25, d, 0x8a6a48);
      curb.position.set(c.x + ox, y + 0.12, c.z + oz);
      group.add(curb);
    }
    solidBox(BOCCE.u, BOCCE.v, BOCCE.w + 0.3, BOCCE.d + 0.15);
    const balls = [];
    for (const [bx, bz, col] of [[0, -2.6, 0xffffff], [0.4, -2.0, 0xc8343a], [-0.5, -1.5, 0xc8343a], [0.2, -3.0, 0x3a7a4a], [-0.3, -2.4, 0x3a7a4a]]) {
      const b = ball(col === 0xffffff ? 0.08 : 0.16, col, 1);
      b.material = mat(col, 0.4);
      b.position.set(c.x + bx, y + 0.08 + (col === 0xffffff ? 0.08 : 0.16), c.z + bz);
      b.userData.dynamic = true;
      group.add(b);
      balls.push(b);
    }
    // two old-timers at the near end, in flat caps
    const cap = (a, color) => {
      const cp = new THREE.Group();
      const crown = ball(0.38, color);
      crown.scale.set(1, 0.32, 1.08);
      const bill = box(0.4, 0.04, 0.2, color);
      bill.position.set(0, -0.03, 0.36);
      cp.add(crown, bill);
      wear(a, cp);
    };
    const pa = W(BOCCE.u - 0.8, BOCCE.v + BOCCE.d / 2 + 1.0), pb = W(BOCCE.u + 0.9, BOCCE.v + BOCCE.d / 2 + 1.1);
    const moleOld = folk('mole', { body: 0x5a4e48 }, pa.x, gy(BOCCE.u - 0.8, BOCCE.v + BOCCE.d / 2 + 1), pa.z, Math.PI);
    const hogOld = folk('groundhog', { body: 0x8a6a4a }, pb.x, gy(BOCCE.u + 0.9, BOCCE.v + BOCCE.d / 2 + 1.1), pb.z, Math.PI - 0.3);
    cap(moleOld, 0x5a5a62);
    cap(hogOld, 0x6a5a48);
    zones.addBlocker(pa.x, pa.z, 0.55);
    zones.addBlocker(pb.x, pb.z, 0.55);
    attend(moleOld, 'island', 3);
    register({
      pos: at(BOCCE.u, BOCCE.v + BOCCE.d / 2 + 1.9), r: 1.6,
      label: 'watch the bocce',
      use: async () => {
        const c2 = await ui.ask('Two old-timers in flat caps, a sandy court, a little white ball at the far end and some bigger ones not quite near it.', [
          { label: '🎳 Ask to roll one', value: 'roll' },
          { label: '👂 Just listen', value: 'listen' },
        ]);
        if (c2 === 'roll') {
          const r = Math.random();
          const b = balls[1 + Math.floor(Math.random() * 4)];
          await ui.fadeSwap(() => {
            b.position.x = c.x + (Math.random() - 0.5) * 0.9;
            b.position.z = c.z - 2.6 + (r < 0.25 ? 0.2 : (Math.random() - 0.3) * 2.2);
          });
          await ui.say(r < 0.25
            ? [{ text: 'You roll it soft, like you’re asking the ball a favor. It stops a hair from the little white one.' }, { speaker: 'an old mole', voice: VOICE.mole, text: '…Closer.' }, { speaker: 'an old groundhog', voice: VOICE.hog, text: 'That’s closer. Even I say that’s closer.' }]
            : [{ text: 'You roll it. It goes somewhere. It is, by any measure, a bocce shot.' }, { speaker: 'an old groundhog', voice: VOICE.hog, text: 'Not closer.' }, { speaker: 'an old mole', voice: VOICE.mole, text: 'But with feeling.' }]);
        } else if (c2 === 'listen') {
          const set = nextLine('bocce', OLDTIMERS);
          await ui.say(set.map(([sp, text]) => ({ speaker: sp, voice: sp === 'an old mole' ? VOICE.mole : VOICE.hog, text })));
        }
      },
    });
  }

  // ========================================== the hollow oak, on Cran ----
  // Out west of the Community Center, older than the moss: a live oak with a
  // hollow at its foot just big enough for a raccoon, or you, if you're
  // invited. Knock, and a slot opens at eye height.
  const slot = { open: 0, want: 0 };
  {
    const T = HOLLOW_OAK;
    const ty = terrainHeight(T.x, T.z);
    const g = new THREE.Group();
    const bark = 0x5a4a3a;
    const trunk = cyl(1.0, 1.45, 3.4, 9, bark);
    trunk.position.y = 1.6;
    g.add(trunk);
    for (let k = 0; k < 6; k++) {
      const a = (k / 6) * Math.PI * 2 + 0.4;
      const root = new THREE.Mesh(new THREE.ConeGeometry(0.4, 1.6, 5), mat(bark));
      root.rotation.z = Math.PI / 2 - 0.35;
      root.rotation.y = -a;
      root.position.set(Math.cos(a) * 1.4, 0.2, Math.sin(a) * 1.4);
      g.add(root);
    }
    // the hollow: dark, round-topped, at the foot, facing south
    const hole = new THREE.Mesh(new THREE.CylinderGeometry(0.55, 0.55, 0.4, 9, 1, false, -Math.PI / 2, Math.PI), mat(0x1e1610));
    hole.rotation.x = Math.PI / 2;
    hole.position.set(0, 0.95, 1.22);
    const holeLow = box(1.1, 0.95, 0.4, 0x1e1610);
    holeLow.position.set(0, 0.47, 1.25);
    g.add(hole, holeLow);
    // the slot, at eye height: a little hatch that slides up
    const slotBack = box(0.5, 0.2, 0.1, 0x120c08);
    slotBack.position.set(0, 2.25, 1.13);
    const eyes = [];
    for (const sx of [-0.1, 0.1]) {
      const e = ball(0.04, 0xfbf6ee);
      e.position.set(sx, 2.25, 1.18);
      const p = ball(0.022, 0x111111);
      p.position.set(sx, 2.25, 1.21);
      e.userData.dynamic = p.userData.dynamic = true; // (they come and go with the hatch)
      g.add(e, p);
      eyes.push(e, p);
    }
    const hatch = box(0.56, 0.24, 0.08, 0x6a5848);
    hatch.position.set(0, 2.25, 1.2);
    hatch.userData.dynamic = true;
    g.add(slotBack, hatch);
    const plate = sign(['NO SOLICITING', '(except parm)'], { w: 0.8, h: 0.32, bg: '#d9c08f', fg: '#3a3026' });
    plate.position.set(0.75, 1.7, 1.2);
    plate.rotation.y = 0.35;
    g.add(plate);
    // the crown: wide and low, with moss hanging off it
    const crowns = [];
    for (const [cx, cy, cz, cr] of [[0, 4.4, 0, 2.4], [2.0, 4.0, 0.6, 1.7], [-2.0, 4.1, -0.5, 1.8], [0.4, 4.1, -2.0, 1.6], [-0.5, 4.2, 1.8, 1.5]]) {
      const cm = ball(cr, 0x3a5a32, 1);
      cm.scale.y = 0.55;
      cm.position.set(cx, cy, cz);
      g.add(cm);
      crowns.push(cm);
      if (cx || cz) {
        const limb = cyl(0.15, 0.24, Math.hypot(cx, cz), 5, bark);
        limb.position.set(cx / 2, cy - 0.7, cz / 2);
        limb.rotation.z = Math.atan2(-cx, 1.2) * 0.9;
        limb.rotation.x = Math.atan2(cz, 1.2) * 0.9;
        g.add(limb);
      }
    }
    const MOSS = [0x8a9a86, 0x9aa894, 0x7c8c78];
    crowns.forEach((cm, k) => {
      for (let q = 0; q < 5; q++) {
        const a = q * 1.26 + k;
        const len = 0.9 + ((q * 7 + k) % 5) * 0.22;
        const drape = new THREE.Mesh(new THREE.ConeGeometry(0.12, len, 4), mat(MOSS[(q + k) % 3], 1));
        drape.rotation.x = Math.PI;
        drape.position.set(cm.position.x + Math.cos(a) * 1.2, cm.position.y - 0.4 - len / 2, cm.position.z + Math.sin(a) * 1.2);
        g.add(drape);
      }
    });
    g.traverse((o) => { if (o.isMesh) o.castShadow = o.receiveShadow = true; });
    g.position.set(T.x, ty - 0.1, T.z);
    group.add(g);
    zones.addBlocker(T.x, T.z, 1.75, 'tree'); // (trunk and roots)
    outdoor.push((dt) => {
      slot.open += (slot.want - slot.open) * Math.min(1, dt * 6);
      hatch.position.y = 2.25 + slot.open * 0.26;
      eyes.forEach((e) => { e.visible = slot.open > 0.5; });
    });
    EXIT.tree = { x: T.x, z: T.z + 2.4, rotY: 0 };
    register({
      pos: new THREE.Vector3(T.x, 0, T.z + 2.0), r: 1.7,
      label: 'knock on the hollow oak',
      use: async () => {
        tone(160, { dur: 0.08, type: 'sine', vol: 0.12 });
        tone(150, { time: 0.18, dur: 0.08, type: 'sine', vol: 0.12 });
        await new Promise((r) => setTimeout(r, 450));
        slot.want = 1;
        const V = { speaker: 'a voice in the tree', voice: 300 };
        try {
          if (S.hasFlag('famiglia')) {
            const c = await ui.ask('Oh, it’s you. Going down?', [{ label: '⬇️ Going down', value: 'down' }, { label: 'Not right now', value: null }], V);
            if (c === 'down') { slot.want = 0; await zones.go('cran_lair', LAIR_SPAWN.tree); }
            return;
          }
          const opts = [{ label: '“…Cranberry?”', value: 'cran' }, { label: 'Never mind', value: null }];
          if (S.hasFlag('famigliaInvite')) opts.unshift({ label: '“I never said when.”', value: 'when' });
          const c = await ui.ask('Password.', opts, V);
          if (c === 'when') {
            await ui.say({ ...V, text: '…Mind the roots. And duck. No — the other way. Good.' });
            slot.want = 0;
            await zones.go('cran_lair', LAIR_SPAWN.tree);
          } else if (c === 'cran') {
            await ui.say({ ...V, text: 'Wrong tree.' });
          } else {
            await ui.say({ ...V, text: 'Nobody’s home. This is a tree.' });
          }
        } finally {
          slot.want = 0;
        }
      },
    });
  }

  // ================================================================ rooms ----
  const LIGHT_WARM = {
    bg: 0x2a2018, fog: 0x2a2018, fogNear: 22, fogFar: 60,
    hemiSky: 0xfff0d8, hemiGround: 0x7a5a40, hemiIntensity: 2.0, sunIntensity: 0,
  };
  function room(id, name, B, { w, d, wallH = 3.6, floor, wall, lighting = LIGHT_WARM, build, frontExit = true, gap = null }) {
    const start = group.children.length;
    const fl = box(w, 0.4, d, floor);
    fl.position.set(B.x, -0.2, B.z);
    group.add(fl);
    // the back wall (whole, or either side of a gap with a lintel over it) and the two sides
    const backs = gap ? [[-w / 2, gap.x0, 0, wallH], [gap.x1, w / 2, 0, wallH], [gap.x0, gap.x1, gap.top, wallH]] : [[-w / 2, w / 2, 0, wallH]];
    for (const [x0, x1, y0, y1] of backs) {
      const wl = box(x1 - x0, y1 - y0, 0.3, wall);
      wl.position.set(B.x + (x0 + x1) / 2, (y0 + y1) / 2, B.z - d / 2);
      group.add(wl);
    }
    for (const x of [B.x - w / 2, B.x + w / 2]) {
      const wl = box(0.3, wallH, d, wall);
      wl.position.set(x, wallH / 2, B.z);
      group.add(wl);
    }
    const blockers = [], things = [];
    const extra = build?.(B, blockers, things) || {};
    const root = collectInteriorRoot(group, start);
    root.userData.noMerge = true;
    zones.registerInterior(id, {
      root, floorY: 0,
      bounds: extra.bounds || { x0: B.x - w / 2 + 0.45, x1: B.x + w / 2 - 0.45, z0: B.z - d / 2 + 0.45, z1: B.z + d / 2 - 0.1 },
      blockers, spawn: extra.spawn || { x: B.x, z: B.z + d / 2 - 0.7, rotY: Math.PI }, lighting,
    });
    addZonePlace(id, name);
    if (frontExit) register({ pos: new THREE.Vector3(B.x, 0, B.z + d / 2 - 0.25), r: 1.5, zone: id, label: 'step outside', use: () => zones.leaveTo(EXIT[id]) });
    for (const it of things) register({ ...it, zone: id });
  }
  function hang(x, z, color, y = 3.0) {
    const l = makeHangingLamp(color);
    l.position.set(x, y, z);
    group.add(l);
  }
  function chair(x, z, ry, color = 0x6a4a2e) {
    const c = new THREE.Group();
    const seat = box(0.5, 0.08, 0.5, color);
    seat.position.y = 0.46;
    const back = box(0.5, 0.6, 0.07, color);
    back.position.set(0, 0.8, -0.22);
    c.add(seat, back);
    for (const [lx, lz] of [[-0.2, -0.2], [0.2, -0.2], [-0.2, 0.2], [0.2, 0.2]]) {
      const leg = box(0.06, 0.46, 0.06, color);
      leg.position.set(lx, 0.23, lz);
      c.add(leg);
    }
    c.position.set(x, 0, z);
    c.rotation.y = ry;
    group.add(c);
    return c;
  }
  function checkTable(x, z, w, d, h = 0.78) {
    const top = new THREE.Mesh(new THREE.BoxGeometry(w + 0.1, 0.05, d + 0.1), checkCloth());
    top.position.set(x, h, z);
    top.castShadow = top.receiveShadow = true;
    const drop = box(w + 0.12, 0.3, d + 0.12, 0xfbf6ee);
    drop.position.set(x, h - 0.15, z);
    const leg = cyl(0.08, 0.1, h, 6, 0x4a3a2a);
    leg.position.set(x, h / 2, z);
    group.add(top, drop, leg);
  }
  function fiasco(x, y, z) {
    // a straw-wrapped bottle with a candle in it, the way it has to be
    const b = cyl(0.11, 0.13, 0.26, 7, 0x3a6a3a);
    b.position.set(x, y + 0.13, z);
    const straw = cyl(0.14, 0.14, 0.13, 7, 0xd9b870);
    straw.position.set(x, y + 0.07, z);
    const neck = cyl(0.04, 0.06, 0.16, 6, 0x3a6a3a);
    neck.position.set(x, y + 0.34, z);
    const cdl = cyl(0.035, 0.035, 0.12, 5, 0xfbf6ee);
    cdl.position.set(x, y + 0.48, z);
    const fl = glow(0.035, 0xffc860);
    fl.position.set(x, y + 0.58, z);
    group.add(b, straw, neck, cdl, fl);
  }
  function parmWheel(x, y, z, s = 1) {
    const w = cyl(0.55 * s, 0.55 * s, 0.4 * s, 12, 0xe8c95c);
    w.position.set(x, y + 0.2 * s, z);
    const rind = new THREE.Mesh(new THREE.TorusGeometry(0.55 * s, 0.04 * s, 4, 12), mat(0xc8a040));
    rind.rotation.x = Math.PI / 2;
    rind.position.set(x, y + 0.2 * s, z);
    group.add(w, rind);
    return w;
  }

  // --------------------------------------------- the Olive Burrow, inside ----
  // The dining room up front (red-checked tables, wine-bottle candles, a mural
  // of Tuscany as described over the phone, the reserved booth), and through
  // the swinging doors, Nonna's kitchen, the freezer, and the back door.
  let bread = 0;
  room('cran_olive', '🍝 The Olive Burrow', IN.cran_olive, {
    w: 18, d: 13, wallH: 3.8, floor: 0xb8653e, wall: 0xe8c48a,
    lighting: { ...LIGHT_WARM, hemiSky: 0xfff0d0, hemiIntensity: 2.2 },
    build: (B, bl, things) => {
      const X = (l) => B.x + l, Z = (l) => B.z + l;
      const PZ = -1.5; // the partition between the dining room and the kitchen
      // the partition: a half-height wall (so you can see Nonna over it), a
      // pass-through, more wall, the swinging doors, more wall
      for (const [x0, x1] of [[-9, -3], [-0.5, 3], [5, 9]]) {
        const seg = box(x1 - x0, 2.4, 0.25, 0xe8c48a);
        seg.position.set(X((x0 + x1) / 2), 1.2, Z(PZ));
        group.add(seg);
        const cap = box(x1 - x0 + 0.05, 0.08, 0.35, 0x8a6a48);
        cap.position.set(X((x0 + x1) / 2), 2.44, Z(PZ));
        group.add(cap);
      }
      const below = box(2.5, 1.1, 0.25, 0xe8c48a);
      below.position.set(X(-1.75), 0.55, Z(PZ));
      const sill = box(2.7, 0.08, 0.6, 0x8a6a48);
      sill.position.set(X(-1.75), 1.14, Z(PZ));
      group.add(below, sill);
      for (let k = 0; k < 3; k++) {
        const plate = cyl(0.2, 0.18, 0.04, 10, 0xfbf6ee);
        plate.position.set(X(-2.6 + k * 0.8), 1.2, Z(PZ));
        const food = ball(0.13, k === 1 ? 0xc8343a : 0xf2d88a);
        food.scale.y = 0.45;
        food.position.set(X(-2.6 + k * 0.8), 1.26, Z(PZ));
        group.add(plate, food);
      }
      for (const sx of [-1, 1]) {
        // the swinging doors, half open, with porthole windows
        const half = box(0.95, 1.6, 0.06, 0x6b7a3a);
        half.position.set(X(4 + sx * 0.75), 1.1, Z(PZ + 0.3));
        half.rotation.y = sx * 0.5;
        group.add(half);
      }
      bl.push({ x: X(-3), z: Z(PZ), w: 12, d: 0.4 }, { x: X(7), z: Z(PZ), w: 4, d: 0.4 });
      // the mural: Tuscany, as described to the painter over the phone
      const mural = painting(5.0, 1.55, (ctx, w, h) => {
        ctx.fillStyle = '#9fd0ea'; ctx.fillRect(0, 0, w, h);
        ctx.fillStyle = '#ffd25a'; ctx.beginPath(); ctx.arc(w * 0.82, h * 0.22, h * 0.1, 0, Math.PI * 2); ctx.fill();
        const hill = (y, c, ph) => { ctx.fillStyle = c; ctx.beginPath(); ctx.moveTo(0, h); for (let x = 0; x <= w; x += 8) ctx.lineTo(x, y + Math.sin(x / w * 6 + ph) * h * 0.06); ctx.lineTo(w, h); ctx.fill(); };
        hill(h * 0.5, '#8ab860', 0); hill(h * 0.62, '#6aa04a', 2); hill(h * 0.78, '#5a8a3a', 4);
        for (const cx of [0.12, 0.2, 0.55, 0.62, 0.9]) { ctx.fillStyle = '#2f4a2a'; ctx.beginPath(); ctx.ellipse(w * cx, h * 0.5, w * 0.012, h * 0.16, 0, 0, Math.PI * 2); ctx.fill(); }
        ctx.fillStyle = '#b8343a'; ctx.fillRect(w * 0.3, h * 0.66, w * 0.14, h * 0.1); // (the bog)
        ctx.fillStyle = '#5a8ac8'; ctx.fillRect(w * 0.62, h * 0.82, w * 0.3, h * 0.07); // a canal, for some reason
        ctx.fillStyle = '#1e1e24'; ctx.beginPath(); ctx.moveTo(w * 0.68, h * 0.82); ctx.quadraticCurveTo(w * 0.77, h * 0.88, w * 0.86, h * 0.8); ctx.lineTo(w * 0.84, h * 0.84); ctx.quadraticCurveTo(w * 0.77, h * 0.86, w * 0.7, h * 0.84); ctx.fill(); // and a gondola
        ctx.strokeStyle = '#c8a050'; ctx.lineWidth = h * 0.04; ctx.strokeRect(0, 0, w, h);
      });
      mural.position.set(X(-6), 1.45, Z(PZ + 0.16));
      group.add(mural);
      things.push({ pos: new THREE.Vector3(X(-6), 0, Z(PZ + 1.4)), r: 1.4, priority: 0, label: 'admire the mural',
        use: () => ui.say('A mural of Tuscany, as described to the painter over the phone: rolling hills, tall dark cypresses, a red square that is clearly the bog, and, along the bottom, a canal with a gondola on it. Tuscany has no canals. Nobody has told the painter. Nobody is going to.') });
      // grape garland along the side walls, plastic and proud of it
      for (const sx of [-1, 1]) {
        for (let k = 0; k < 18; k++) {
          const lf = ball(0.16, k % 2 ? 0x5a8a3a : 0x4a7a32);
          lf.position.set(X(sx * 8.8), 3.3 + Math.sin(k) * 0.1, Z(-6 + k * 0.72));
          group.add(lf);
          if (k % 3 === 1) {
            for (let q = 0; q < 3; q++) {
              const gp = ball(0.07, 0x6a3a7a);
              gp.position.set(X(sx * 8.75), 3.05 - q * 0.1, Z(-6 + k * 0.72 + (q - 1) * 0.06));
              group.add(gp);
            }
          }
        }
      }
      // the dining room: three tables, two with diners, one with your name on it
      const tables = [[-6.5, 1.8], [-6.5, 4.6], [-1.6, 3.4]];
      for (const [tx, tz] of tables) {
        checkTable(X(tx), Z(tz), 1.3, 1.3);
        fiasco(X(tx), 0.8, Z(tz));
        // the breadstick basket
        const bask = cyl(0.2, 0.16, 0.14, 7, 0xc8a060);
        bask.position.set(X(tx + 0.35), 0.88, Z(tz + 0.3));
        group.add(bask);
        for (let k = 0; k < 4; k++) {
          const st = cyl(0.03, 0.03, 0.42, 5, 0xe8c070);
          st.position.set(X(tx + 0.3 + (k - 1.5) * 0.05), 1.0, Z(tz + 0.3));
          st.rotation.z = (k - 1.5) * 0.18;
          group.add(st);
        }
        for (const s of [-1, 1]) chair(X(tx + s * 0.95), Z(tz), -s * Math.PI / 2);
        bl.push({ x: X(tx), z: Z(tz), w: 2.6, d: 1.5 });
      }
      const pia = folk('capybara', { body: 0xa8784e }, X(-7.45), 0.3, Z(1.8), Math.PI / 2, { scale: 0.85 });
      const nello = folk('capybara', { body: 0x9a6a44 }, X(-5.55), 0.3, Z(1.8), -Math.PI / 2, { scale: 0.85 });
      const bearD = folk('bear', { body: 0x7a5a3e }, X(-2.55), 0.3, Z(3.4), Math.PI / 2, { scale: 0.8 });
      // (the regulars talk, between mouthfuls)
      for (const [a, key, name, lines] of [[pia, 'pia', 'Pia', PIA], [nello, 'nello', 'Nello', NELLO], [bearD, 'tullio', 'Tullio', TULLIO]]) {
        things.push({ getPos: () => a.position, r: 1.6, label: `talk to ${name}`,
          use: () => ui.say(nextLine(key, lines), { speaker: name, voice: VOICE[key] }) });
      }
      things.push({ pos: new THREE.Vector3(X(-6.5), 0, Z(6.0)), r: 1.4, label: 'have a breadstick',
        use: async () => {
          bread++;
          const lines = {
            1: 'A warm breadstick, glossy with butter and garlic and salt. The basket is full again before you’ve finished it. You did not see it get full.',
            3: 'A third breadstick. You slip a fourth into your pocket, for later. Everybody says that about the last one.',
            5: 'Five. Benny brings a fresh basket and sets it down very gently, like you’re a deer he doesn’t want to startle.',
            10: 'Ten breadsticks. The menu says unlimited. You are testing the menu. The menu is holding up.',
            20: 'Twenty. Somewhere behind the kitchen, a guy is making more. You can hear him. He sounds happy.',
            40: 'Forty. Benny sits down across from you, quietly, and has one too. Neither of you says anything. It is a moment.',
          };
          if (bread === 3 && !S.countItem('breadstick')) {
            S.addItem('breadstick');
            ui.toast('You got <b>One More Breadstick</b>.', '🥖');
          }
          await ui.say(lines[bread] || `Another breadstick. (That’s ${bread}. Nobody’s counting. Benny is counting.)`);
        } });
      // the reserved booth, in the corner
      {
        const bx = 6.6, bz = 2.4;
        const tbl = box(1.4, 0.06, 1.0, 0x4a2e1e);
        tbl.position.set(X(bx), 0.78, Z(bz));
        const tleg = cyl(0.08, 0.1, 0.78, 6, 0x3a2418);
        tleg.position.set(X(bx), 0.39, Z(bz));
        group.add(tbl, tleg);
        for (const s of [-1, 1]) {
          const seat = box(0.6, 0.45, 1.4, 0x8a1e2a);
          seat.position.set(X(bx + s * 1.05), 0.22, Z(bz));
          const back = box(0.2, 1.4, 1.4, 0x8a1e2a);
          back.position.set(X(bx + s * 1.35), 0.7, Z(bz));
          group.add(seat, back);
        }
        const card = sign('RISERVATO', { w: 0.5, h: 0.2, d: 0.05, bg: '#fffaf0', fg: '#8a1e2a' });
        card.position.set(X(bx), 0.92, Z(bz + 0.2));
        card.rotation.x = -0.3;
        const cup = cyl(0.07, 0.06, 0.1, 7, 0xfbf6ee);
        cup.position.set(X(bx - 0.3), 0.86, Z(bz - 0.15));
        group.add(card, cup);
        const wisp = new THREE.Mesh(new THREE.IcosahedronGeometry(0.06, 0), new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.5 }));
        wisp.castShadow = false;
        wisp.userData.dynamic = true;
        group.add(wisp);
        (inside.cran_olive ??= []).push((dt, t) => {
          const ph = (t * 0.5) % 1;
          wisp.position.set(X(bx - 0.3) + Math.sin(t * 3) * 0.03, 0.95 + ph * 0.4, Z(bz - 0.15));
          wisp.material.opacity = 0.5 * (1 - ph);
        });
        bl.push({ x: X(bx), z: Z(bz), w: 3.0, d: 1.5 });
        hang(X(bx), Z(bz), 0x8a1e2a, 3.0);
        things.push({ pos: new THREE.Vector3(X(bx - 0.2), 0, Z(bz + 1.5)), r: 1.3, label: 'look at the reserved booth',
          use: () => ui.say('A corner booth in red velvet, and on the table a little card: RISERVATO. In front of the empty seat, an espresso cup. It’s still warm. It is always still warm.') });
      }
      // the host stand, a rotary grater on it the size of a lantern, and Benny
      const stand = box(0.8, 1.1, 0.6, 0x4a2e1e);
      stand.position.set(X(2.2), 0.55, Z(5.3));
      const grater = cyl(0.16, 0.16, 0.4, 8, 0xc8ccd0);
      grater.rotation.z = Math.PI / 2;
      grater.position.set(X(2.2), 1.25, Z(5.3));
      const crank = box(0.06, 0.25, 0.06, 0x4a2e1e);
      crank.position.set(X(2.45), 1.35, Z(5.3));
      group.add(stand, grater, crank);
      bl.push({ x: X(2.2), z: Z(5.3), w: 0.8, d: 0.6 });
      const benny = folk('ferret', { body: 0x8a6a4a, head: 0xf0e2c8 }, X(2.9), 0, Z(3.5), Math.PI, { fidget: true });
      const bow = new THREE.Group();
      for (const sx of [-1, 1]) {
        const lobe = new THREE.Mesh(new THREE.ConeGeometry(0.07, 0.14, 4), mat(0x1a1a1e));
        lobe.rotation.z = sx * Math.PI / 2;
        lobe.position.x = sx * 0.07;
        bow.add(lobe);
      }
      bow.position.set(0, 0.88, 0.92);
      benny.add(bow);
      bl.push({ x: X(2.9), z: Z(3.5), r: 0.5 });
      attend(benny, 'cran_olive', 5);
      things.push({ getPos: () => benny.position, r: 2.0, label: 'talk to Benny',
        use: () => talkBenny() });
      hang(X(-6.5), Z(3.2), 0xc2703a);
      hang(X(-1.6), Z(3.4), 0xc2703a);
      // ---- the kitchen: Nonna, her table, the stove, the freezer, the back door
      const work = box(2.4, 0.9, 1.0, 0xdcc8a0);
      work.position.set(X(-1.75), 0.45, Z(-3.4));
      group.add(work);
      for (let k = 0; k < 14; k++) {
        const gn = ball(0.05, 0xf2e2b8);
        gn.scale.set(1, 0.7, 1.4);
        gn.position.set(X(-2.7 + (k % 7) * 0.22), 0.94, Z(-3.55 + Math.floor(k / 7) * 0.25));
        group.add(gn);
      }
      const pin = cyl(0.06, 0.06, 0.7, 6, 0xc8a070);
      pin.rotation.z = Math.PI / 2;
      pin.position.set(X(-0.9), 0.96, Z(-3.25));
      group.add(pin);
      bl.push({ x: X(-1.75), z: Z(-3.4), w: 2.4, d: 1.0 });
      const nonna = folk('raccoon', { body: 0x8a8684, head: 0x9a9694, mask: 0x3a3638 }, X(-1.75), 0, Z(-4.6), 0, { fidget: true });
      const scarf = ball(0.46, 0x2e3a5a);
      scarf.scale.set(1.04, 0.62, 1.04);
      const kerchief = new THREE.Group();
      scarf.position.set(0, -0.12, -0.04);
      kerchief.add(scarf);
      wear(nonna, kerchief);
      nonna.userData.parts.ears?.forEach((e) => { e.visible = false; }); // (tucked under the scarf)
      const knot = ball(0.1, 0x2e3a5a);
      onFace(nonna, knot, 0, 0.95, 0.62);
      const apron = ball(0.36, 0xfbf6ee);
      apron.scale.set(1.1, 1.1, 0.4);
      apron.position.set(0, 0.62, 0.42);
      nonna.add(apron);
      for (const sx of [-1, 1]) onFace(nonna, new THREE.Mesh(new THREE.TorusGeometry(0.1, 0.02, 5, 10), mat(0xc8a050, 0.4)), sx * 0.17, 1.27, 0.8);
      bl.push({ x: X(-1.75), z: Z(-4.6), r: 0.5 });
      (inside.cran_olive ??= []).push((dt, t) => { nonna.rotation.y = Math.sin(t * 2.2) * 0.12; });
      things.push({ getPos: () => nonna.position, r: 2.2, label: 'talk to Nonna',
        use: () => talkNonna() });
      hang(X(-1.75), Z(-3.6), 0xfbf6ee);
      // the stove, and pots, and their steam
      const stove = box(3.0, 0.9, 0.9, 0x2e2a2a);
      stove.position.set(X(-6.5), 0.45, Z(-5.8));
      group.add(stove);
      const steam = [];
      for (const [k, px] of [-7.4, -6.5, -5.6].entries()) {
        const pot = cyl(0.32, 0.3, 0.42, 8, k === 1 ? 0xc8ccd0 : 0x8a5a3a);
        pot.position.set(X(px), 1.11, Z(-5.8));
        group.add(pot);
        const s = new THREE.Mesh(new THREE.IcosahedronGeometry(0.16, 0), new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.4 }));
        s.castShadow = false;
        s.userData.dynamic = true;
        group.add(s);
        steam.push([s, px]);
      }
      (inside.cran_olive ??= []).push((dt, t) => steam.forEach(([s, px], k) => {
        const ph = (t * 0.4 + k * 0.33) % 1;
        s.position.set(X(px) + Math.sin(t + k) * 0.1, 1.45 + ph * 1.4, Z(-5.8));
        s.scale.setScalar(0.7 + ph);
        s.material.opacity = 0.4 * (1 - ph);
      }));
      bl.push({ x: X(-6.5), z: Z(-5.8), w: 3.0, d: 0.9 });
      // garlic braids and a shelf of jars
      const shelf = box(2.6, 0.08, 0.4, 0x8a6a48);
      shelf.position.set(X(-6.5), 2.4, Z(-6.1));
      group.add(shelf);
      for (let k = 0; k < 8; k++) {
        const jar = cyl(0.13, 0.13, 0.3, 7, [0xc8343a, 0xe8c070, 0x5a8a3a][k % 3]);
        jar.position.set(X(-7.6 + k * 0.32), 2.6, Z(-6.1));
        group.add(jar);
      }
      for (const gx of [-3.6, -3.1]) {
        for (let q = 0; q < 5; q++) {
          const bulbG = ball(0.09, 0xf3ead6);
          bulbG.position.set(X(gx), 2.9 - q * 0.17, Z(-6.2));
          group.add(bulbG);
        }
      }
      // the freezer
      const fz = box(1.4, 2.4, 0.12, 0xc8ccd0);
      fz.position.set(X(7.4), 1.2, Z(-6.32));
      const fsg = sign('FREEZER', { w: 1.0, h: 0.3, d: 0.04, bg: '#fffaf0', fg: '#3a5a8a' });
      fsg.position.set(X(7.4), 2.0, Z(-6.25));
      const handle = box(0.08, 0.5, 0.1, 0x6a7078);
      handle.position.set(X(6.9), 1.2, Z(-6.22));
      group.add(fz, fsg, handle);
      things.push({ pos: new THREE.Vector3(X(7.4), 0, Z(-5.2)), r: 1.3, label: 'open the freezer',
        use: () => ui.say([
          'You open the freezer. It’s a freezer. Cold, bright, shelves of sauce in tubs, and a great many wheels of parm, each with a little tag that says PAID.',
          'You close the freezer.',
          { speaker: 'Nonna', voice: VOICE.nonna, text: 'It’s a freezer.' },
        ]) });
      // the back door
      const bdoor = box(1.2, 2.1, 0.12, 0x5a7a3a);
      bdoor.position.set(X(4), 1.05, Z(-6.32));
      const bsg = sign(['USCITA', '→ the alley'], { w: 0.9, h: 0.36, d: 0.04, bg: '#fffaf0', fg: '#5a7a3a' });
      bsg.position.set(X(4), 2.35, Z(-6.25));
      group.add(bdoor, bsg);
      things.push({ pos: new THREE.Vector3(X(4), 0, Z(-5.4)), r: 1.3, label: 'go out the back',
        use: () => zones.leaveTo(EXIT.olive_back) });
    },
  });

  // the say-when: Benny grates until you say when. If you never do…
  async function sayWhen() {
    const V = { speaker: 'Benny', voice: VOICE.benny };
    await ui.say('Benny lifts a hand-crank grater the size of a lantern over your plate and starts to turn the handle.');
    const steps = [
      'Parmesan? Say when.',
      'Still grating. Say when.',
      'That’s a lot of parm. That’s a nice amount of parm. You can say when.',
      'I can’t see the pasta. There’s a hill. A cheese hill. …When?',
      'I’m at the rind. I can see the rind. Nobody’s ever seen the rind. …When?',
    ];
    for (let k = 0; k < steps.length; k++) {
      for (let q = 0; q < 6; q++) tone(2400 + (q % 2) * 300, { time: q * 0.06, dur: 0.03, type: 'sine', vol: 0.012 });
      const c = await ui.ask(steps[k], [
        { label: '“When.”', value: 'when' },
        { label: k < 2 ? 'Keep going.' : '…keep going.', value: 'more' },
      ], V);
      if (c !== 'more') {
        await ui.say({ ...V, text: nextLine('when', ['Grazie. Buon appetito.', 'Perfect. Nobody says when like you say when.', 'Beautiful. Enjoy. Nonna made it angry today, so it’s extra good.']) });
        return;
      }
    }
    if (S.hasFlag('famiglia')) {
      await ui.say({ ...V, text: 'Of course you didn’t say when. You’re famiglia. Mangia.' });
      return;
    }
    if (S.hasFlag('famigliaInvite')) {
      await ui.say({ ...V, text: 'You never say when. I like that about you. Out back. Vinnie knows your face.' });
      return;
    }
    await ui.say([
      'Benny stops cranking. He looks at the grater. He looks at the bare rind. He looks at you, for a long, long time.',
      { ...V, text: '…You never said when.' },
      { ...V, text: 'Nobody never says when.' },
      { ...V, text: 'Here. Don’t open it in here.' },
    ]);
    S.addItem('matchbook');
    S.setFlag('famigliaInvite');
    ui.toast('You got an <b>Olive Burrow Matchbook</b>. Inside, in pencil: “out back. ask for Vinnie.”', '📕');
  }
  async function talkBenny() {
    const V = { speaker: 'Benny', voice: VOICE.benny };
    const c = await ui.ask(S.hasFlag('famiglia') && Math.random() < 0.4 ? 'Famiglia! The usual? You don’t have a usual. You do now.' : nextLine('benny', BENNY), [
      { label: '🍝 Fettuccine Alfredo', value: 'fettuccine', hint: '24🔘', disabled: S.state.buttons < 24 },
      { label: '🍝 Spaghetti & One Enormous Meatball', value: 'meatballs', hint: '30🔘', disabled: S.state.buttons < 30 },
      { label: '🧀 Just some parm, please', value: 'parm' },
      { label: 'Just looking', value: null },
    ], V);
    if (!c) return;
    if (c !== 'parm') {
      const price = c === 'fettuccine' ? 24 : 30;
      S.spend(price);
      S.addItem(c);
      kaching();
      ui.updateHUD();
      ui.toast(`You got <b>${ITEMS[c].name}</b>.`, ITEMS[c].emoji);
      await ui.say({ ...V, text: c === 'fettuccine' ? 'Fettuccine Alfredo! The sauce is mostly parm and confidence.' : 'Spaghetti and the meatball! There’s one. It’s enough. It’s too much. It’s exactly right.' });
    }
    await sayWhen();
  }
  async function talkNonna() {
    const V = { speaker: 'Nonna', voice: VOICE.nonna };
    const day = S.todayKey();
    if (!S.hasFlag(`gnocchi_${day}`)) {
      S.setFlag(`gnocchi_${day}`);
      await ui.say([
        { ...V, text: S.hasFlag('metNonna') ? 'You again! Good. Sit. Eat.' : 'Who’s this? In my kitchen? …Sit. Eat. Nobody leaves my kitchen hungry.' },
      ]);
      S.setFlag('metNonna');
      S.addItem('nonna_gnocchi');
      ui.toast('Nonna hands you a plate of <b>Nonna’s Gnocchi</b>. It is not a question.', '🥟');
      return;
    }
    await ui.say(nextLine('nonna', NONNA), V);
  }
  // in through the back door: Nonna has opinions about that
  register({
    pos: new THREE.Vector3(W(BACKDOOR.u, BACKDOOR.v - 0.7).x, 0, W(BACKDOOR.u, BACKDOOR.v - 0.7).z), r: 1.4,
    label: 'go in the kitchen door',
    use: async () => {
      await zones.go('cran_olive', { x: IN.cran_olive.x + 4, z: IN.cran_olive.z - 5.4, rotY: 0 });
      if (!S.hasFlag('backDoorNonna')) {
        S.setFlag('backDoorNonna');
        await ui.say({ speaker: 'Nonna', voice: VOICE.nonna, text: 'In the back door? Like family? …Shoes.' });
      }
    },
  });

  // ------------------------------------------------- Caffè Bandito, inside ----
  room('cran_caffe', '☕ Caffè Bandito', IN.cran_caffe, {
    w: 11, d: 8, wallH: 3.4, floor: 0x6a5040, wall: 0xe8dcc0,
    build: (B, bl, things) => {
      const X = (l) => B.x + l, Z = (l) => B.z + l;
      // the bar: dark wood, a marble top, for standing at
      const bar = box(7.0, 1.1, 0.8, 0x5a3a2a);
      bar.position.set(X(-0.5), 0.55, Z(-2.2));
      const top = box(7.2, 0.08, 0.95, 0xf2efe8);
      top.position.set(X(-0.5), 1.14, Z(-2.2));
      top.material = mat(0xf2efe8, 0.4);
      const rail = cyl(0.04, 0.04, 7.0, 6, 0xc8a050);
      rail.rotation.z = Math.PI / 2;
      rail.position.set(X(-0.5), 0.2, Z(-1.7));
      group.add(bar, top, rail);
      bl.push({ x: X(-0.5), z: Z(-2.2), w: 7.0, d: 0.8 });
      // la macchina: chrome, a copper dome, an eagle that might be a pigeon
      const mach = box(1.4, 0.8, 0.6, 0xc8ccd0);
      mach.material = mat(0xc8ccd0, 0.3);
      mach.position.set(X(1.2), 1.58, Z(-2.3));
      const dome = new THREE.Mesh(new THREE.SphereGeometry(0.45, 8, 4, 0, Math.PI * 2, 0, Math.PI / 2), mat(0xc87a3a, 0.35));
      dome.position.set(X(1.2), 1.98, Z(-2.3));
      const bird = ball(0.14, 0xd9a440);
      bird.position.set(X(1.2), 2.5, Z(-2.3));
      group.add(mach, dome, bird);
      for (let k = 0; k < 6; k++) {
        const cup = cyl(0.07, 0.06, 0.1, 7, 0xfbf6ee);
        cup.position.set(X(-2.6 + (k % 3) * 0.18), 1.24 + Math.floor(k / 3) * 0.11, Z(-2.35));
        group.add(cup);
      }
      // the back wall: bottles, photos, the TV (bocce, always bocce)
      const shelf = box(4.0, 0.08, 0.35, 0x5a3a2a);
      shelf.position.set(X(-1.5), 2.2, Z(-3.8));
      group.add(shelf);
      for (let k = 0; k < 10; k++) {
        const bt = cyl(0.08, 0.1, 0.4, 6, [0x3a6a3a, 0xc8a050, 0x8a1e2a, 0x5a3a2a][k % 4]);
        bt.position.set(X(-3.3 + k * 0.4), 2.44, Z(-3.8));
        group.add(bt);
      }
      const tv = painting(1.6, 1.0, (ctx, w, h) => {
        ctx.fillStyle = '#1e1e24'; ctx.fillRect(0, 0, w, h);
        ctx.fillStyle = '#d9c08f'; ctx.fillRect(w * 0.08, h * 0.12, w * 0.84, h * 0.76);
        ctx.fillStyle = '#ffffff'; ctx.beginPath(); ctx.arc(w * 0.7, h * 0.4, h * 0.04, 0, Math.PI * 2); ctx.fill();
        for (const [bx, by, c] of [[0.6, 0.45, '#c8343a'], [0.74, 0.55, '#3a7a4a'], [0.4, 0.6, '#c8343a']]) { ctx.fillStyle = c; ctx.beginPath(); ctx.arc(w * bx, h * by, h * 0.07, 0, Math.PI * 2); ctx.fill(); }
        ctx.fillStyle = '#fffaf0'; ctx.font = FONT(Math.round(h * 0.1)); ctx.fillText('BOCCE · LIVE', w * 0.1, h * 0.95);
      });
      tv.position.set(X(4.2), 2.5, Z(-3.7));
      group.add(tv);
      const sg = sign(['SOLO IN PIEDI', 'standing room only (sit if you want, we’re not monsters)'], { w: 3.0, h: 0.6, d: 0.04, bg: '#3e6a52', fg: '#f3ead6' });
      sg.position.set(X(-1.5), 2.95, Z(-3.82));
      group.add(sg);
      // Gufo, behind the bar
      const gufo = folk('owl', { body: 0x8a7458, head: 0x9a8468 }, X(0.0), 0, Z(-3.2), 0, { fidget: true });
      bl.push({ x: X(0.0), z: Z(-3.2), r: 0.5 });
      attend(gufo, 'cran_caffe', 5);
      things.push({ getPos: () => new THREE.Vector3(gufo.position.x, 0, gufo.position.z + 1.6), r: 1.6, label: 'order from Gufo',
        use: async () => {
          const V = { speaker: 'Gufo', voice: VOICE.gufo };
          const c = await ui.ask(nextLine('gufo', GUFO), [
            { label: '☕ Un caffè', value: 'caffe', hint: '3🔘', disabled: S.state.buttons < 3 },
            { label: '🥛 A cappuccino', value: 'capp', hint: '5🔘', disabled: S.state.buttons < 5 },
            { label: 'Just looking', value: null },
          ], V);
          if (c === 'caffe') {
            S.spend(3);
            kaching();
            ui.updateHUD();
            sip();
            S.drinkCoffee(75);
            await ui.say('A tiny cup, a quarter full, black and gold on top. You drink it at the bar, standing, in one sip, like a local. Your heart does a little tarantella.');
            ui.toast('Espresso’d. You feel zippy.', '☕');
          } else if (c === 'capp') {
            if (hourNow() >= 11) {
              await ui.say([
                { ...V, text: 'A cappuccino? After eleven?' },
                { ...V, text: '…No.' },
                'Gufo makes you an espresso instead and slides it across the marble. He doesn’t charge you. It’s a kindness. It is also a lesson.',
              ]);
              sip();
              S.drinkCoffee(75);
              ui.toast('You feel zippy. And corrected.', '☕');
            } else {
              S.spend(5);
              kaching();
              ui.updateHUD();
              sip();
              S.drinkCoffee(60);
              await ui.say({ ...V, text: 'A cappuccino, before eleven. Like a civilized animal. Here.' });
              ui.toast('Cappuccino’d. You feel zippy, and foamy.', '☕');
            }
          }
        } });
      // the regulars, at the end of the bar, arguing (gently, forever)
      const tort = folk('tortoise', {}, X(-2.6), 0, Z(-1.1), Math.PI / 2 + 0.3, {});
      const her = folk('heron', { body: 0x9fb3c8 }, X(-1.3), 0, Z(-1.1), -Math.PI / 2 - 0.3, {});
      bl.push({ x: X(-2.6), z: Z(-1.1), r: 0.55 }, { x: X(-1.3), z: Z(-1.1), r: 0.45 });
      things.push({ pos: new THREE.Vector3(X(-1.95), 0, Z(0.3)), r: 1.5, label: 'listen to the regulars',
        use: async () => {
          const set = nextLine('regulars', REGULARS);
          await ui.say(set.map(([sp, text]) => ({ speaker: sp, voice: sp === 'Gufo' ? VOICE.gufo : sp === 'an old heron' ? VOICE.heron : VOICE.tortoise, text })));
        } });
      void tort; void her;
      // two little tables, for people who sit (it's allowed)
      for (const [tx, tz] of [[-3.4, 2.0], [2.8, 2.1]]) {
        const t = new THREE.Mesh(new THREE.CylinderGeometry(0.45, 0.45, 0.05, 10), mat(0xf2efe8, 0.4));
        t.position.set(X(tx), 0.78, Z(tz));
        t.castShadow = t.receiveShadow = true;
        const leg = cyl(0.05, 0.05, 0.78, 6, 0x2e2a26);
        leg.position.set(X(tx), 0.39, Z(tz));
        group.add(t, leg);
        chair(X(tx - 0.75), Z(tz), Math.PI / 2, 0x2e2a26);
        chair(X(tx + 0.75), Z(tz), -Math.PI / 2, 0x2e2a26);
        bl.push({ x: X(tx), z: Z(tz), w: 2.1, d: 0.9 });
      }
      hang(X(-1), Z(-1.0), 0x3e6a52);
      hang(X(2.8), Z(2.1), 0x3e6a52);
    },
  });

  // ------------------------------------------------- Zio Orso's, inside ----
  room('cran_dolci', '🥐 Zio Orso’s Pasticceria', IN.cran_dolci, {
    w: 10, d: 8, wallH: 3.4, floor: 0xf2e6e0, wall: 0xf4c9cd,
    lighting: { ...LIGHT_WARM, bg: 0x2a2024, hemiSky: 0xfff4f4, hemiGround: 0x8a6a6a, hemiIntensity: 2.3 },
    build: (B, bl, things) => {
      const X = (l) => B.x + l, Z = (l) => B.z + l;
      // the case: a pink-and-white counter with a glass top, pastries in rows
      const base = box(6.0, 0.8, 1.0, 0xfbf6ee);
      base.position.set(X(0), 0.4, Z(-1.6));
      const stripe = box(6.05, 0.15, 1.05, 0xe87a90);
      stripe.position.set(X(0), 0.65, Z(-1.6));
      const glass = new THREE.Mesh(new THREE.BoxGeometry(6.0, 0.5, 0.9), new THREE.MeshStandardMaterial({ color: 0xdff4fa, transparent: true, opacity: 0.35, roughness: 0.2 }));
      glass.position.set(X(0), 1.05, Z(-1.6));
      group.add(base, stripe, glass);
      bl.push({ x: X(0), z: Z(-1.6), w: 6.0, d: 1.0 });
      for (let k = 0; k < 10; k++) {
        // cannoli
        const c = cyl(0.06, 0.06, 0.3, 6, 0xd8a060);
        c.rotation.z = Math.PI / 2;
        c.position.set(X(-2.6 + k * 0.22), 0.87, Z(-1.85));
        group.add(c);
        // sfogliatelle (shells) and lobster tails, a row each
        const sf = new THREE.Mesh(new THREE.ConeGeometry(0.1, 0.16, 6), mat(0xe8b870));
        sf.rotation.x = Math.PI / 2;
        sf.position.set(X(0.3 + (k % 5) * 0.25), 0.88, Z(-1.55 + Math.floor(k / 5) * 0.25));
        group.add(sf);
      }
      for (let k = 0; k < 8; k++) {
        const ck = cyl(0.08, 0.08, 0.04, 8, [0xf2cf5b, 0xf28fb0, 0x8a5a3a][k % 3]);
        ck.position.set(X(-2.5 + k * 0.3), 0.84, Z(-1.35));
        group.add(ck);
      }
      // the back: white boxes, the long spool of string, the sign
      for (let k = 0; k < 9; k++) {
        const bx = box(0.5, 0.3, 0.5, 0xfbf6ee);
        bx.position.set(X(-3.6 + (k % 3) * 0.55), 0.15 + Math.floor(k / 3) * 0.31, Z(-3.5));
        group.add(bx);
      }
      bl.push({ x: X(-3.05), z: Z(-3.5), w: 1.7, d: 0.6 });
      const spool = cyl(0.25, 0.25, 0.3, 10, 0xc8343a);
      spool.rotation.x = Math.PI / 2;
      spool.position.set(X(2.6), 1.6, Z(-3.75));
      const spoolW = new THREE.Mesh(new THREE.TorusGeometry(0.25, 0.04, 4, 10), mat(0xfbf6ee));
      spoolW.position.set(X(2.6), 1.6, Z(-3.62));
      group.add(spool, spoolW);
      const sg = sign(['FILLED TO ORDER', 'no lobsters in the lobster tails'], { w: 3.0, h: 0.6, d: 0.04, bg: '#fbf6ee', fg: '#c8506a' });
      sg.position.set(X(0), 2.6, Z(-3.82));
      group.add(sg);
      // Zio Orso, in his toque
      const orso = folk('bear', { body: 0x8d6748 }, X(0.3), 0, Z(-2.9), 0, { fidget: true });
      const toque = new THREE.Group();
      const band = cyl(0.3, 0.32, 0.3, 9, 0xfbf6ee);
      band.position.y = 0.1;
      const puff = ball(0.4, 0xfbf6ee, 1);
      puff.scale.y = 0.7;
      puff.position.y = 0.4;
      toque.add(band, puff);
      wear(orso, toque);
      bl.push({ x: X(0.3), z: Z(-2.9), r: 0.6 });
      attend(orso, 'cran_dolci', 5);
      const goods = [
        { id: 'cannoli', price: 12, say: 'Filled right now, in front of you, like a promise. Box. String. Bow. Carry it like a baby bird.' },
        { id: 'sfogliatella', price: 10, say: 'A hundred layers. You’ll be finding flakes for a week. Every flake is a memory.' },
        { id: 'lobster_tail_pastry', price: 14, say: 'Lobster tail! No lobster. I want to be very clear. The lobster at BULKO wants me to be very clear.' },
      ];
      things.push({ getPos: () => new THREE.Vector3(orso.position.x, 0, orso.position.z + 1.9), r: 1.7, label: 'talk to Zio Orso',
        use: async () => {
          const V = { speaker: 'Zio Orso', voice: VOICE.orso };
          await ui.say(nextLine('orso', ORSO), V);
          const g = await till('Zio Orso', VOICE.orso, 'What’ll it be?', goods);
          if (g) for (let k = 0; k < 3; k++) tone(1600 - k * 200, { time: k * 0.08, dur: 0.06, type: 'sine', vol: 0.02 });
        } });
      // the line (there is always a line)
      folk('rabbit', { body: 0xf5e6c8 }, X(-1.6), 0, Z(0.4), Math.PI, {});
      folk('mouse', { body: 0xb8a890 }, X(-1.6), 0, Z(1.5), Math.PI, { scale: 0.8 });
      bl.push({ x: X(-1.6), z: Z(0.4), r: 0.5 }, { x: X(-1.6), z: Z(1.5), r: 0.4 });
      things.push({ pos: new THREE.Vector3(X(-2.6), 0, Z(1.0)), r: 1.2, priority: 0, label: 'look at the line',
        use: () => ui.say('There is a line. There is always a line at Zio Orso’s. Nobody minds. Standing in it is half of what you came for.') });
      hang(X(-1.5), Z(-1.6), 0xe87a90);
      hang(X(1.5), Z(-1.6), 0xe87a90);
    },
  });

  // =============================================== the lair, under it all ----
  // A long room dug out under the North End: earth walls and beams, a long
  // table, the Don's desk, the heist board, Valentina's vanity, a couch with
  // Eddie on it, and in the back wall a round steel door, open, onto the
  // vault. Two ladders up: one to the trash can, one to the tree.
  const LB = IN.cran_lair;
  const LAIR_SPAWN = {
    can: { x: LB.x - 10.6, z: LB.z - 5.0, rotY: 0 },
    tree: { x: LB.x + 10.6, z: LB.z - 5.0, rotY: 0 },
  };
  let salLair, eddieLair, valLair;
  room('cran_lair', '🧀 Somewhere Underneath', LB, {
    w: 24, d: 15, wallH: 3.8, floor: 0x5a4a3a, wall: 0x6a5440, frontExit: false, gap: { x0: 4.7, x1: 7.8, top: 3.05 },
    lighting: { bg: 0x1a140e, fog: 0x1a140e, fogNear: 24, fogFar: 60, hemiSky: 0xffe0b8, hemiGround: 0x4a3a2a, hemiIntensity: 1.8, sunIntensity: 0 },
    build: (B, bl, things) => {
      const X = (l) => B.x + l, Z = (l) => B.z + l;
      const back = -7.5;
      // posts along the back, and earth showing between them
      for (let k = 0; k < 5; k++) {
        const post = box(0.3, 3.7, 0.3, 0x4a3424);
        post.position.set(X(-10 + k * 5), 1.85, Z(back + 0.3));
        group.add(post);
      }
      for (let k = 0; k < 14; k++) {
        const clod = ball(0.3 + (k % 3) * 0.1, 0x5a4432);
        clod.position.set(X(-11.6 + (k % 2) * 23.2), 0.5 + (k % 5) * 0.6, Z(-6 + k * 0.9));
        group.add(clod);
      }
      // ---- the long table
      checkTable(X(-1), Z(1.6), 6, 1.6);
      for (const tx of [-3.2, -1, 1.2]) fiasco(X(tx), 0.8, Z(1.6));
      parmWheel(X(-1), 0.8, Z(1.6), 0.55);
      const bowl = cyl(0.4, 0.28, 0.22, 10, 0xfbf6ee);
      bowl.position.set(X(-2.2), 0.92, Z(1.5));
      const pasta = ball(0.33, 0xf2d88a);
      pasta.scale.y = 0.35;
      pasta.position.set(X(-2.2), 1.04, Z(1.5));
      group.add(bowl, pasta);
      for (let k = 0; k < 8; k++) {
        const plate = cyl(0.22, 0.2, 0.03, 10, 0xfbf6ee);
        plate.position.set(X(-3.6 + (k % 4) * 1.75), 0.82, Z(1.6 + (k < 4 ? -0.55 : 0.55)));
        group.add(plate);
        chair(X(-3.6 + (k % 4) * 1.75), Z(1.6 + (k < 4 ? -1.2 : 1.2)), k < 4 ? 0 : Math.PI, 0x5a3424);
      }
      bl.push({ x: X(-1), z: Z(1.6), w: 6.6, d: 3.6 });
      hang(X(-2.5), Z(1.6), 0x8a1e2a, 3.2);
      hang(X(0.5), Z(1.6), 0x8a1e2a, 3.2);
      // ---- the Don's desk, his chair, his little wheel on its cushion
      const desk = box(3.2, 0.8, 1.2, 0x4a2e1e);
      desk.position.set(X(-6), 0.4, Z(-4.4));
      const leather = box(3.0, 0.03, 1.0, 0x2e5a3a);
      leather.position.set(X(-6), 0.82, Z(-4.4));
      group.add(desk, leather);
      const cushion = box(0.6, 0.1, 0.6, 0x8a1e2a);
      cushion.position.set(X(-5.4), 0.88, Z(-4.3));
      group.add(cushion);
      parmWheel(X(-5.4), 0.93, Z(-4.3), 0.4);
      const ledger = box(0.5, 0.06, 0.36, 0x6a2a1a);
      ledger.position.set(X(-6.9), 0.86, Z(-4.2));
      group.add(ledger);
      // the banker's lamp: brass, green glass, warm underneath
      const lb = cyl(0.12, 0.15, 0.06, 8, 0xc8a050);
      lb.position.set(X(-7.2), 0.86, Z(-4.6));
      const ls = cyl(0.03, 0.03, 0.35, 5, 0xc8a050);
      ls.position.set(X(-7.2), 1.05, Z(-4.6));
      const shade = new THREE.Mesh(new THREE.CylinderGeometry(0.22, 0.22, 0.45, 8, 1, false, 0, Math.PI), new THREE.MeshStandardMaterial({ color: 0x2e8a4a, emissive: 0x2e8a4a, emissiveIntensity: 0.5, flatShading: true, roughness: 0.4 }));
      shade.rotation.z = Math.PI / 2;
      shade.position.set(X(-7.2), 1.25, Z(-4.6));
      const glowU = glow(0.08, 0xffe0a0);
      glowU.position.set(X(-7.2), 1.18, Z(-4.6));
      group.add(lb, ls, shade, glowU);
      bl.push({ x: X(-6), z: Z(-4.4), w: 3.2, d: 1.2 });
      const armchair = new THREE.Group();
      const seat = box(1.4, 0.5, 1.1, 0x8a1e2a);
      seat.position.y = 0.25;
      const cback = box(1.4, 1.9, 0.3, 0x8a1e2a);
      cback.position.set(0, 0.95, -0.5);
      armchair.add(seat, cback);
      for (const sx of [-1, 1]) {
        const arm = box(0.25, 0.75, 1.1, 0x7a1a24);
        arm.position.set(sx * 0.75, 0.38, 0);
        armchair.add(arm);
      }
      armchair.position.set(X(-6), 0, Z(-5.9));
      group.add(armchair);
      bl.push({ x: X(-6), z: Z(-5.9), w: 1.8, d: 1.2 });
      const don = folk('raccoon', { body: 0x9a9894, head: 0x9a9894, mask: 0x2e2c30, light: 0xf2eee6, ring: 0x3a383c }, X(-6), 0.5, Z(-5.8), 0, { scale: 1.3 });
      const carnation = ball(0.09, 0xfbf6ee, 1);
      carnation.position.set(0.24, 0.92, 0.5);
      don.add(carnation);
      attend(don, 'cran_lair', 6);
      things.push({ pos: new THREE.Vector3(X(-6), 0, Z(-3.0)), r: 1.8, label: 'speak with the Don',
        use: () => talkDon() });
      // the portrait, behind him: la famiglia
      const portrait = painting(2.6, 1.8, (ctx, w, h) => {
        ctx.fillStyle = '#5a2a2a'; ctx.fillRect(0, 0, w, h);
        ctx.fillStyle = '#3a2420'; ctx.fillRect(w * 0.07, h * 0.08, w * 0.86, h * 0.72);
        const face = (cx, cy, r, fur) => {
          ctx.fillStyle = fur; ctx.beginPath(); ctx.arc(cx, cy, r, 0, Math.PI * 2); ctx.fill();
          ctx.beginPath(); ctx.moveTo(cx - r * 0.9, cy - r * 0.4); ctx.lineTo(cx - r * 0.6, cy - r * 1.3); ctx.lineTo(cx - r * 0.2, cy - r * 0.8); ctx.fill();
          ctx.beginPath(); ctx.moveTo(cx + r * 0.9, cy - r * 0.4); ctx.lineTo(cx + r * 0.6, cy - r * 1.3); ctx.lineTo(cx + r * 0.2, cy - r * 0.8); ctx.fill();
          ctx.fillStyle = '#2e2c30'; ctx.beginPath(); ctx.ellipse(cx, cy - r * 0.1, r * 0.85, r * 0.28, 0, 0, Math.PI * 2); ctx.fill();
          ctx.fillStyle = '#ffffff'; ctx.beginPath(); ctx.arc(cx - r * 0.35, cy - r * 0.1, r * 0.1, 0, Math.PI * 2); ctx.arc(cx + r * 0.35, cy - r * 0.1, r * 0.1, 0, Math.PI * 2); ctx.fill();
          ctx.fillStyle = '#f2eee6'; ctx.beginPath(); ctx.ellipse(cx, cy + r * 0.45, r * 0.35, r * 0.25, 0, 0, Math.PI * 2); ctx.fill();
        };
        face(w * 0.5, h * 0.42, h * 0.16, '#9a9894');
        face(w * 0.28, h * 0.5, h * 0.12, '#8a8684');
        face(w * 0.72, h * 0.5, h * 0.12, '#bab0b4');
        ctx.fillStyle = '#ff8fc8'; ctx.fillRect(w * 0.64, h * 0.62, w * 0.16, h * 0.04);
        face(w * 0.14, h * 0.6, h * 0.08, '#7e7c78');
        face(w * 0.86, h * 0.62, h * 0.07, '#c8c2b4');
        ctx.fillStyle = '#e8c050'; ctx.textAlign = 'center'; ctx.font = FONT(Math.round(h * 0.09));
        ctx.fillText('LA FAMIGLIA', w / 2, h * 0.92);
      });
      portrait.position.set(X(-6), 2.5, Z(back + 0.2));
      group.add(portrait);
      // Rospo, at the Don's shoulder, with the ledger and little round glasses
      const rospo = folk('frog', { body: 0x8a7a4a, belly: 0xd8c89a, feet: 0x7a6a3a, spots: 0x5a4a2a }, X(-3.9), 0, Z(-5.6), 0.25, { scale: 1.7 });
      for (const sx of [-1, 1]) onFace(rospo, new THREE.Mesh(new THREE.TorusGeometry(0.12, 0.02, 5, 10), mat(0xc8a050, 0.4)), sx * 0.27, 1.1, 0.6);
      const book = box(0.4, 0.5, 0.08, 0x6a2a1a);
      book.position.set(0.3, 0.55, 0.62);
      book.rotation.y = -0.4;
      rospo.add(book);
      bl.push({ x: X(-3.9), z: Z(-5.6), r: 0.9 });
      attend(rospo, 'cran_lair', 5);
      things.push({ pos: new THREE.Vector3(X(-3.4), 0, Z(-4.0)), r: 1.4, label: 'talk to Rospo',
        use: () => ui.say(nextLine('rospo', ROSPO), { speaker: 'Rospo', voice: VOICE.rospo }) });
      // ---- the heist board, on the back wall
      const board = painting(2.8, 1.8, (ctx, w, h) => {
        ctx.fillStyle = '#b8895a'; ctx.fillRect(0, 0, w, h);
        ctx.fillStyle = '#3a2a1a'; ctx.textAlign = 'center'; ctx.font = FONT(Math.round(h * 0.09));
        ctx.fillText('OPERAZIONE FORMAGGIO', w / 2, h * 0.12);
        ctx.fillStyle = '#fbf6ee'; ctx.fillRect(w * 0.08, h * 0.2, w * 0.5, h * 0.42); // the plan of BULKO
        ctx.strokeStyle = '#3a5a8a'; ctx.lineWidth = 3; ctx.strokeRect(w * 0.1, h * 0.24, w * 0.46, h * 0.34);
        ctx.fillStyle = '#e8c95c'; ctx.beginPath(); ctx.arc(w * 0.2, h * 0.45, h * 0.05, 0, Math.PI * 2); ctx.fill();
        ctx.fillStyle = '#3a5a8a'; ctx.font = FONT(Math.round(h * 0.045)); ctx.fillText('STAFF DOOR', w * 0.42, h * 0.3);
        const notes = [[0.75, 0.25, '2 A.M.'], [0.78, 0.48, 'EXACT CHANGE!!'], [0.25, 0.8, 'EDDIE: lookout (lie down)'], [0.62, 0.78, 'VINNIE: boat'], [0.86, 0.68, 'SAL: roll']];
        ctx.strokeStyle = '#c8202c'; ctx.lineWidth = 2;
        for (const [nx, ny] of notes) { ctx.beginPath(); ctx.moveTo(w * 0.2, h * 0.45); ctx.lineTo(w * nx, h * ny); ctx.stroke(); }
        for (const [nx, ny, t] of notes) {
          ctx.fillStyle = '#fff4a0'; ctx.fillRect(w * nx - w * 0.12, h * ny - h * 0.06, w * 0.24, h * 0.1);
          ctx.fillStyle = '#3a2a1a'; ctx.font = FONT(Math.round(h * 0.04)); ctx.fillText(t, w * nx, h * ny + h * 0.01);
          ctx.fillStyle = '#c8202c'; ctx.beginPath(); ctx.arc(w * nx, h * ny - h * 0.05, 3, 0, Math.PI * 2); ctx.fill();
        }
      });
      board.position.set(X(0.6), 2.2, Z(back + 0.2));
      group.add(board);
      things.push({ pos: new THREE.Vector3(X(0.6), 0, Z(back + 1.4)), r: 1.4, priority: 0, label: 'study the heist board',
        use: () => ui.say([
          'OPERAZIONE FORMAGGIO. A plan of BULKO, drawn very neatly, with the parmesan circled in yellow and the staff door marked. Red string runs from the parm to five notes.',
          '“2 A.M.” “EXACT CHANGE!!” (underlined three times). “EDDIE: lookout (lie down).” “VINNIE: boat.” “SAL: roll.”',
          'At the bottom, in the Don’s hand: “We are not thieves. We are customers with style.”',
        ]) });
      // ---- the vault: a round steel door, swung open, and the room behind
      const vx0 = 3.5, vx1 = 9, vz1 = back - 5;
      const steel = 0x8a9098;
      const vfloor = box(vx1 - vx0, 0.4, 5, 0x7a8086);
      vfloor.position.set(X((vx0 + vx1) / 2), -0.2, Z(back - 2.5));
      group.add(vfloor);
      for (const [ww, dd, x, z] of [[vx1 - vx0, 0.3, (vx0 + vx1) / 2, vz1], [0.3, 5, vx0, back - 2.5], [0.3, 5, vx1, back - 2.5]]) {
        const wl = box(ww, 3.8, dd, steel);
        wl.position.set(X(x), 1.9, Z(z));
        group.add(wl);
      }
      const hole = { x0: 4.7, x1: 7.8 }; // (the gap room() left in the back wall)
      const frame = new THREE.Mesh(new THREE.TorusGeometry(1.45, 0.22, 6, 16), mat(steel, 0.4));
      frame.position.set(X((hole.x0 + hole.x1) / 2), 1.6, Z(back + 0.12));
      group.add(frame);
      const vdoorPivot = new THREE.Group();
      vdoorPivot.position.set(X(hole.x0 - 0.2), 0, Z(back + 0.3));
      vdoorPivot.rotation.y = -1.15; // swung open, out into the room
      const vdoor = cyl(1.5, 1.5, 0.45, 16, 0xa8b0b8);
      vdoor.material = mat(0xa8b0b8, 0.35);
      vdoor.rotation.x = Math.PI / 2;
      vdoor.position.set(1.5, 1.6, 0.25);
      const wheel = new THREE.Mesh(new THREE.TorusGeometry(0.45, 0.06, 5, 12), mat(0xc8a050, 0.35));
      wheel.position.set(1.5, 1.6, 0.52);
      vdoorPivot.add(vdoor, wheel);
      for (let k = 0; k < 3; k++) {
        const spoke = box(1.0, 0.07, 0.07, 0xc8a050);
        spoke.rotation.z = (k / 3) * Math.PI;
        spoke.position.set(1.5, 1.6, 0.52);
        vdoorPivot.add(spoke);
      }
      vdoorPivot.traverse((o) => { if (o.isMesh) o.castShadow = o.receiveShadow = true; });
      group.add(vdoorPivot);
      {
        const c = Math.cos(-1.15), s = Math.sin(-1.15);
        // the door's slab, wherever the hinge swung it (local x → world)
        bl.push({ x: X(hole.x0 - 0.2) + 1.5 * c, z: Z(back + 0.3) - 1.5 * s, w: 3.0, d: 0.5, rot: -1.15 });
      }
      // the buttons: a mountain of them, every color
      const COLORS = [0xd8342c, 0xf2cf5b, 0x3a7dd8, 0x5cbf4a, 0xf28fb0, 0xfbf6ee, 0x8a5a3a, 0xc8a050];
      const geo = new THREE.CylinderGeometry(0.11, 0.11, 0.04, 8);
      const btns = new THREE.InstancedMesh(geo, mat(0xffffff, 0.5), 700);
      const tmp = new THREE.Object3D(), col = new THREE.Color();
      const heap = { x: X((vx0 + vx1) / 2), z: Z(back - 2.5) };
      for (let i = 0; i < 700; i++) {
        const r = Math.sqrt(rand(0, 1)) * 1.8, a = rand(0, Math.PI * 2);
        tmp.position.set(heap.x + Math.cos(a) * r, Math.max(0.02, (1 - r / 1.8) * 1.4 + rand(-0.06, 0.06)), heap.z + Math.sin(a) * r * 0.85);
        tmp.rotation.set(rand(-0.6, 0.6), rand(0, 3), rand(-0.6, 0.6));
        tmp.updateMatrix();
        btns.setMatrixAt(i, tmp.matrix);
        btns.setColorAt(i, col.setHex(COLORS[i % COLORS.length]));
      }
      btns.castShadow = false;
      btns.receiveShadow = true;
      group.add(btns);
      bl.push({ x: heap.x, z: heap.z, r: 1.3 }); // (you dive in from the edge; you don't wade)
      // parm on the shelves, both sides
      const SHELF = [[vx0 + 0.45, back - 1.9, 3.2], [vx1 - 0.45, back - 3.4, 2.2]]; // (x, z, length): the right one stops short of the jar
      for (const [sx, sz, len] of SHELF) {
        for (let k = 0; k < 3; k++) {
          const sh = box(0.7, 0.06, len, 0x6a7078);
          sh.position.set(X(sx), 0.6 + k * 1.0, Z(sz));
          group.add(sh);
          for (let q = 0; q < Math.round(len); q++) parmWheel(X(sx), 0.63 + k * 1.0, Z(sz + len / 2 - 0.6 - q * 1.0), 0.55);
        }
      }
      // Tansy's buttons, under glass, just inside the door on the right
      const JAR = { x: vx1 - 0.75, z: back - 0.85 };
      const ped = box(0.6, 1.0, 0.6, 0x4a2e1e);
      ped.position.set(X(JAR.x), 0.5, Z(JAR.z));
      const jar = cyl(0.2, 0.2, 0.32, 8, 0xbfe6f2);
      jar.material = new THREE.MeshStandardMaterial({ color: 0xbfe6f2, transparent: true, opacity: 0.55, roughness: 0.2 });
      jar.position.set(X(JAR.x), 1.17, Z(JAR.z));
      group.add(ped, jar);
      for (let k = 0; k < 6; k++) {
        const b = cyl(0.05, 0.05, 0.02, 6, COLORS[k]);
        b.position.set(X(JAR.x - 0.05 + (k % 3) * 0.05), 1.05 + k * 0.03, Z(JAR.z));
        group.add(b);
      }
      bl.push({ x: X(JAR.x), z: Z(JAR.z), r: 0.45 });
      // the shelves are solid
      for (const [sx, sz, len] of SHELF) bl.push({ x: X(sx), z: Z(sz), w: 0.7, d: len });
      things.push({ pos: new THREE.Vector3(heap.x, 0, heap.z + 2.0), r: 1.4, label: 'dive into the buttons',
        use: async () => {
          const day = S.todayKey();
          await ui.fadeSwap(() => {
            for (let k = 0; k < 8; k++) tone(900 + Math.random() * 1400, { time: k * 0.05, dur: 0.05, type: 'triangle', vol: 0.025 });
          });
          if (S.hasFlag(`vaultDive_${day}`)) {
            await ui.say(nextLine('dive', [
              'You dive into the buttons again. It still hurts a little. It is still worth it.',
              'You backstroke across the top of the pile. Rospo, in the doorway, writes something in the ledger. You suspect it is “style.”',
              'You burrow in like a mole and come up wearing a button on your nose. Everyone agrees it suits you.',
            ]));
            return;
          }
          S.setFlag(`vaultDive_${day}`);
          S.earn(1);
          ui.updateHUD();
          await ui.say([
            'You take a run at it and dive into the mountain of buttons. They are cold and clattery and they go everywhere and it hurts a little and it is the best thing you have ever done.',
            'You come up with one button stuck to you.',
            { speaker: 'Rospo', voice: VOICE.rospo, text: 'Keep it. Interest.' },
          ]);
          ui.toast('+1 button. (Interest.)', '🔘');
        } });
      things.push({ pos: new THREE.Vector3(X(JAR.x - 0.95), 0, Z(JAR.z)), r: 1.1, label: 'look at the jar under glass',
        use: () => ui.say([
          'Under the glass, a little jar, and in it a few buttons — plain, old, some chipped — with a card in careful handwriting.',
          '“The first forty. From Old Tansy’s jar, for forty dives. Papa never spent one. He said he could hear the bell on the heavy tides, from the bottom, ringing, and that it was worth forty buttons just for that. —R.”',
        ]) });
      // ---- Valentina's vanity, east, with a ring of bulbs round the mirror
      const vanity = box(1.8, 0.8, 0.7, 0xfbf6ee);
      vanity.position.set(X(10.6), 0.4, Z(1.0));
      vanity.rotation.y = -Math.PI / 2;
      const mirror = box(0.06, 1.4, 1.3, 0xdfeef4);
      mirror.material = mat(0xdfeef4, 0.2);
      mirror.position.set(X(11.0), 1.6, Z(1.0));
      group.add(vanity, mirror);
      for (let k = 0; k < 10; k++) {
        const a = (k / 10) * Math.PI * 2;
        const bulb = glow(0.06, 0xfff2c8);
        bulb.position.set(X(10.95), 1.6 + Math.sin(a) * 0.82, Z(1.0) + Math.cos(a) * 0.78);
        group.add(bulb);
      }
      const boa = new THREE.Group();
      for (let k = 0; k < 10; k++) {
        const f = ball(0.1, k % 2 ? 0xff8fc8 : 0xff6fb4);
        f.position.set(0, 1.2 - k * 0.1, Math.sin(k * 0.8) * 0.15);
        boa.add(f);
      }
      boa.position.set(X(10.7), 0, Z(-0.2));
      group.add(boa);
      bl.push({ x: X(10.6), z: Z(1.0), w: 0.7, d: 1.8 });
      valLair = valentina(X(9.4), 0, Z(1.0), -Math.PI / 2);
      bl.push({ x: X(9.4), z: Z(1.0), r: 0.5 });
      attend(valLair, 'cran_lair', 5);
      things.push({ getPos: () => valLair.position, r: 2.0, label: 'talk to Valentina',
        enabled: () => !valentinaOut(), use: () => talkValentina(false) });
      // ---- the couch, west, with Eddie on it (dead, he says)
      const couch = new THREE.Group();
      const cs = box(2.4, 0.45, 0.9, 0x6a4a6a);
      cs.position.y = 0.22;
      const cb = box(2.4, 0.8, 0.25, 0x6a4a6a);
      cb.position.set(0, 0.6, -0.35);
      couch.add(cs, cb);
      for (const sx of [-1, 1]) {
        const arm = box(0.25, 0.6, 0.9, 0x5a3a5a);
        arm.position.set(sx * 1.25, 0.3, 0);
        couch.add(arm);
      }
      couch.position.set(X(-9.5), 0, Z(4.6));
      couch.rotation.y = Math.PI / 2;
      group.add(couch);
      bl.push({ x: X(-9.5), z: Z(4.6), w: 0.9, d: 2.7 });
      const eddieWrap = new THREE.Group();
      eddieWrap.position.set(X(-9.45), 0.95, Z(4.6));
      eddieWrap.rotation.set(0, 0, Math.PI / 2 + 0.15);
      eddieLair = buildAnimal('possum', EDDIE_COLORS);
      eddieLair.userData.noFidget = true;
      eddieLair.position.y = -0.62; // (head toward the couch's arm; he rolls onto his side about his own length)
      const tongue = box(0.08, 0.02, 0.14, 0xe87a90);
      tongue.position.set(0.05, 0.98, 1.0);
      eddieLair.add(tongue);
      eddieWrap.add(eddieLair);
      group.add(eddieWrap);
      things.push({ pos: new THREE.Vector3(X(-8.2), 0, Z(4.6)), r: 1.5, label: 'check on the possum',
        enabled: () => !heistOn(),
        use: () => ui.say([
          'A possum lies on the couch on his side, very still, with his tongue out and all four feet sticking straight out sideways.',
          { speaker: 'Eddie', voice: VOICE.eddie, text: nextLine('eddie', EDDIE) },
        ]) });
      (inside.cran_lair ??= []).push(() => { eddieWrap.visible = !heistOn(); });
      // ---- the card table, and Sal at solitaire
      const ct = new THREE.Mesh(new THREE.CylinderGeometry(0.6, 0.6, 0.05, 10), mat(0x2e5a3a));
      ct.position.set(X(-9), 0.75, Z(-1.2));
      ct.castShadow = ct.receiveShadow = true;
      const ctl = cyl(0.06, 0.06, 0.75, 6, 0x3a2418);
      ctl.position.set(X(-9), 0.37, Z(-1.2));
      group.add(ct, ctl);
      for (let k = 0; k < 7; k++) {
        const card = box(0.12, 0.01, 0.17, 0xfbf6ee);
        card.position.set(X(-9.35 + k * 0.12), 0.79, Z(-1.3 + (k % 2) * 0.1));
        group.add(card);
      }
      bl.push({ x: X(-9), z: Z(-1.2), r: 0.75 });
      chair(X(-10), Z(-1.2), Math.PI / 2, 0x5a3424);
      salLair = folk('ferret', { body: 0x8a6a4a, head: 0xf0e2c8 }, X(-10), 0.3, Z(-1.2), Math.PI / 2, {});
      applyHat(salLair, 'fedora');
      bl.push({ x: X(-10), z: Z(-1.2), r: 0.4 });
      things.push({ getPos: () => new THREE.Vector3(X(-9), 0, Z(-0.1)), r: 1.4, label: 'talk to Sal',
        enabled: () => !heistOn(),
        use: () => ui.say(nextLine('sal', SAL), { speaker: 'Sal', voice: VOICE.sal }) });
      (inside.cran_lair ??= []).push(() => { salLair.visible = !heistOn(); valLair.visible = !valentinaOut(); });
      // ---- the ladders up: west to the trash can, east to the tree
      for (const [lx, label, exit, txt] of [[-11.2, 'climb up to the alley', 'can', '↑ THE CAN'], [11.2, 'climb up the tree', 'tree', '↑ THE TREE']]) {
        for (const sx of [-0.3, 0.3]) {
          const rl = box(0.08, 3.8, 0.08, 0x8a6a48);
          rl.position.set(X(lx + sx), 1.9, Z(-6.6));
          group.add(rl);
        }
        for (let k = 0; k < 9; k++) {
          const rung = box(0.6, 0.06, 0.06, 0x8a6a48);
          rung.position.set(X(lx), 0.3 + k * 0.4, Z(-6.6));
          group.add(rung);
        }
        const sg = sign(txt, { w: 1.2, h: 0.32, d: 0.04, bg: '#f3ead6', fg: '#3a3026' });
        sg.position.set(X(lx), 2.6, Z(back + 0.2));
        group.add(sg);
        things.push({ pos: new THREE.Vector3(X(lx), 0, Z(-5.8)), r: 1.3, label,
          use: () => zones.leaveTo(exit === 'can' ? EXIT.can : EXIT.tree) });
      }
      hang(X(-6), Z(-4.2), 0x2e5a3a, 3.1);
      hang(X(9.6), Z(1.0), 0xff8fc8, 3.1);
      // the room's floor bounds reach back into the vault: block the back
      // wall either side of the vault's mouth
      bl.push({ x: X((-12 + hole.x0) / 2), z: Z(back), w: hole.x0 + 12, d: 0.6 });
      bl.push({ x: X((hole.x1 + 12) / 2), z: Z(back), w: 12 - hole.x1, d: 0.6 });
      bl.push({ x: X((-12 + vx0) / 2), z: Z(back - 2.6), w: vx0 + 12, d: 4.6 });
      bl.push({ x: X((vx1 + 12) / 2), z: Z(back - 2.6), w: 12 - vx1, d: 4.6 });
      return {
        bounds: { x0: B.x - 12 + 0.45, x1: B.x + 12 - 0.45, z0: B.z + vz1 + 0.45, z1: B.z + 7.5 - 0.1 },
        spawn: LAIR_SPAWN.can,
      };
    },
  });
  EXIT.can = { x: W(CAN.u - 0.9, CAN.v + 0.9).x, z: W(CAN.u - 0.9, CAN.v + 0.9).z, rotY: 0 };

  async function talkDon() {
    const V = { speaker: 'Don Rocco', voice: VOICE.don };
    if (!S.hasFlag('metDon')) {
      const home = !valentinaOut();
      await ui.say([
        'Behind the desk, in a red chair with a high back, sits a large grey raccoon with a white flower in his lapel. In front of him, on a little velvet cushion, is a small wheel of parmesan. He strokes it, slowly, like a cat.',
        { ...V, text: 'You come to me… on the day of my daughter’s wedding…' },
        home ? { speaker: 'Valentina', voice: VOICE.val, text: 'Papa. I’m not getting married.' } : { speaker: 'Rospo', voice: VOICE.rospo, text: 'Don Rocco. She is not getting married.' },
        { ...V, text: '…on a day very near my daughter’s someday wedding… and you ask me… for a slice of my parm.' },
      ]);
      const c = await ui.ask('He waits. Rospo, at his shoulder, waits even more slowly.', [
        { label: '“…A slice. Please, Don Rocco.”', value: 'please' },
        { label: '“I didn’t ask for any parm.”', value: 'didnt' },
      ]);
      if (c === 'didnt') await ui.say({ ...V, text: 'Everybody asks for the parm. Some ask with their mouths. You — you ask with your eyes.' });
      await ui.say([
        { ...V, text: 'Benny tells me you never said when. Not once. He grated to the rind.' },
        { ...V, text: 'In this family, we never say when. Not to parm. Not to breadsticks. Not to love.' },
        { ...V, text: 'Rospo. A slice, for our friend.' },
        { speaker: 'Rospo', voice: VOICE.rospo, text: 'Of course, Don Rocco. …One slice. Noted.' },
      ]);
      S.addItem('parm_slice');
      ui.toast('You got <b>A Slice of the Don’s Parm</b>.', '🧀');
      await ui.say({ ...V, text: 'And a hat. Famiglia wears the hat.' });
      S.ownHat('fedora');
      ui.toast('You got <b>The Famiglia Fedora</b>. (Press H to wear it.)', '🎩');
      S.setFlag('metDon');
      S.setFlag('famiglia');
      await ui.say({ ...V, text: 'Now. Go upstairs and eat something. Nonna will know if you didn’t.' });
      return;
    }
    await ui.say(nextLine('don', DON), V);
  }

  // ============================================ the night shift, at BULKO ----
  // Between midnight and four, behind BULKO by the staff door: Sal rolling a
  // wheel of parm down to the water, Vinnie in a rowboat with two more in it
  // already, and Eddie at the corner, keeping lookout — until you get close,
  // when he falls over and is dead. (Three hundred buttons are on the counter.
  // Exact change. They're customers with style.)
  {
    const C = ISLAND4;
    const door = { x: C.x + 2, z: C.z - 7 - 5.6 };
    let t = 0;
    while (terrainHeight(door.x + 3, door.z - t) > -0.1 && t < 30) t += 0.4;
    const boatAt = { x: door.x + 3, z: door.z - t - 2.2 }; // (afloat, nose to the beach)
    const shoreAt = { x: door.x + 2.6, z: door.z - t + 1.2 };
    const crew = new THREE.Group();
    crew.userData.noMerge = true; // (it all comes and goes with the hour: never bake it into the island)
    group.add(crew);
    // the rowboat, with two wheels already aboard, and Vinnie at the oars
    const boat = new THREE.Group();
    const hull = box(1.5, 0.5, 3.2, 0x6e5a44);
    hull.position.y = 0.15;
    const inner = box(1.2, 0.3, 2.9, 0x8a6a48);
    inner.position.y = 0.32;
    boat.add(hull, inner);
    const stack = [];
    for (let k = 0; k < 3; k++) {
      const w = cyl(0.5, 0.5, 0.35, 12, 0xe8c95c);
      w.position.set(0, 0.6 + k * 0.36, 0.7);
      boat.add(w);
      stack.push(w);
    }
    const vinBoat = buildAnimal('raccoon', { body: 0x7e7c78, head: 0x7e7c78 });
    vinBoat.scale.setScalar(0.75);
    vinBoat.position.set(0, 0.3, -0.7);
    applyHat(vinBoat, 'fedora');
    boat.add(vinBoat);
    for (const sx of [-1, 1]) {
      const oar = box(0.08, 0.08, 2.2, 0x8a6a48);
      oar.position.set(sx * 0.95, 0.55, -0.6);
      oar.rotation.z = sx * 0.4;
      boat.add(oar);
    }
    boat.traverse((o) => { if (o.isMesh) o.castShadow = o.receiveShadow = true; });
    boat.position.set(boatAt.x, WATER_Y + 0.15, boatAt.z);
    boat.rotation.y = 0.2;
    crew.add(boat);
    // Sal, and the wheel he's rolling
    const sal = buildAnimal('ferret', { body: 0x8a6a4a, head: 0xf0e2c8 });
    applyHat(sal, 'fedora');
    crew.add(sal);
    const wheel = new THREE.Group();
    const wb = cyl(0.55, 0.55, 0.4, 12, 0xe8c95c);
    wb.rotation.z = Math.PI / 2;
    wheel.add(wb);
    crew.add(wheel);
    const roll = { s: 0, dir: 1, pause: 0 };
    const A = { x: door.x - 0.4, z: door.z - 0.6 }, Bp = { x: shoreAt.x - 0.3, z: shoreAt.z };
    const LEN = Math.hypot(Bp.x - A.x, Bp.z - A.z);
    // Eddie, at the corner: a lookout standing up, until he isn't
    const eWrap = new THREE.Group();
    const ex = C.x + 10.6, ez = C.z - 7 - 5.8;
    const eddie = buildAnimal('possum', EDDIE_COLORS);
    eddie.userData.noFidget = true;
    eddie.position.y = -0.62;
    const tongue = box(0.08, 0.02, 0.14, 0xe87a90);
    tongue.position.set(0.05, 0.98, 1.0);
    eddie.add(tongue);
    eWrap.add(eddie);
    crew.visible = sal.visible = eWrap.visible = heistOn();
    eWrap.position.set(ex, terrainHeight(ex, ez) + 0.62, ez);
    eWrap.rotation.y = Math.PI / 2;
    crew.add(eWrap);
    let flop = 0;
    zones.addMover({ zone: 'island', obj: sal, r: 0.45 });
    zones.addMover({ zone: 'island', obj: eWrap, r: 0.5 });
    atBulko.push((dt, tt, pp) => {
      const on = heistOn();
      crew.visible = on;
      sal.visible = eWrap.visible = on;
      if (!on) return;
      // the roll: door → water, then a walk back for the next
      if (roll.pause > 0) roll.pause -= dt;
      else {
        roll.s += dt * (roll.dir > 0 ? 0.7 : 1.1) * roll.dir;
        if (roll.s >= LEN) { roll.s = LEN; roll.dir = -1; roll.pause = 2.5; }
        if (roll.s <= 0) { roll.s = 0; roll.dir = 1; roll.pause = 3.5; }
      }
      const k = roll.s / LEN;
      const ux = (Bp.x - A.x) / LEN, uz = (Bp.z - A.z) / LEN;
      const wx = A.x + (Bp.x - A.x) * k, wz = A.z + (Bp.z - A.z) * k;
      wheel.visible = roll.dir > 0 || roll.pause > 0 && roll.s >= LEN;
      wheel.position.set(wx + ux * 0.9, terrainHeight(wx + ux * 0.9, wz + uz * 0.9) + 0.55, wz + uz * 0.9);
      wheel.rotation.y = Math.atan2(ux, uz);
      wb.rotation.x = -roll.s / 0.55;
      sal.position.set(wx, terrainHeight(wx, wz), wz);
      sal.rotation.y = turnToward(sal.rotation.y, roll.dir > 0 ? Math.atan2(ux, uz) : Math.atan2(-ux, -uz), dt, 4);
      animateGait(sal, tt, roll.pause > 0 ? 0 : 1, 9);
      stack.forEach((s, i) => { s.visible = i < 2 || (roll.dir < 0); });
      // Eddie: near you, he drops; you leave, he gets up and looks out again
      const d = Math.hypot(pp.x - ex, pp.z - ez);
      const want = d < 6.5 ? 1 : d > 9 ? 0 : flop > 0.5 ? 1 : 0;
      flop += (want - flop) * Math.min(1, dt * (want ? 9 : 1.5));
      eWrap.rotation.z = flop * (Math.PI / 2 + 0.15);
      eWrap.position.y = terrainHeight(ex, ez) + 0.62 - flop * 0.12;
      tongue.visible = flop > 0.6;
      if (flop < 0.1) eWrap.rotation.y = Math.PI / 2 + Math.sin(tt * 0.8) * 0.6; // looking out, both ways
      vinBoat.rotation.y = Math.sin(tt * 0.5) * 0.3;
      boat.position.y = WATER_Y + 0.15 + Math.sin(tt * 1.3) * 0.04;
    });
    const VS = { speaker: 'Sal', voice: VOICE.sal };
    register({
      getPos: () => sal.position, r: 2.2,
      enabled: () => heistOn(),
      label: 'talk to the ferret rolling the parm',
      use: async () => {
        if (S.hasFlag('famiglia')) {
          if (!S.hasFlag('heistDone')) {
            await ui.say({ ...VS, text: 'Hey! Famiglia! Grab the other side, will ya?' });
            await ui.fadeSwap(() => { roll.s = LEN; roll.dir = -1; roll.pause = 2.5; });
            await ui.say([
              'You and Sal roll the wheel down to the water together, slow and steady, in the dark. It wants to go. You let it.',
              { speaker: 'Vinnie', voice: VOICE.vinnie, text: 'Easy… easy… beautiful. Somebody take a picture.' },
              'Somebody does. There’s a flash. Eddie, at the corner, falls over.',
              { ...VS, text: 'Three hundred on the counter. Exact change. We’re not animals. Well. We’re not THOSE animals.' },
            ]);
            S.setFlag('heistDone');
            S.addItem('heist_photo');
            ui.toast('You got <b>Polaroid: Operazione Formaggio</b>.', '📸');
            return;
          }
          await ui.say({ ...VS, text: nextLine('salNight', [
            'Shh. You’re famiglia, so: shh, warmly.',
            'One more and we’re done. The Don likes three. Three’s a family.',
            'Nice night for shopping.',
          ]) });
          return;
        }
        if (S.hasFlag('famigliaInvite')) {
          await ui.say({ ...VS, text: 'You got the matchbook. So go see Vinnie. Not now — he’s busy. He’s the boat. Tomorrow. Out back of the Olive Burrow.' });
          return;
        }
        await ui.say([
          'A ferret in a fedora is rolling an entire wheel of parmesan out of BULKO’s staff door in the middle of the night. He freezes.',
          { ...VS, text: '…' },
          { ...VS, text: 'You didn’t see nothin’.' },
        ]);
        const c = await ui.ask('He waits, one paw on the wheel.', [
          { label: '“I didn’t see nothin’.”', value: 'saw' },
          { label: '“Are you stealing that?”', value: 'steal' },
        ]);
        if (c === 'steal') await ui.say({ ...VS, text: 'Stealing? We left three hundred buttons on the counter. Exact change. It’s not a crime, it’s a heist. Different thing. One of ’em has style.' });
        await ui.say([
          { ...VS, text: c === 'saw' ? 'Smart. Very smart. I like you.' : 'You ask questions. I like that. Most people just scream.' },
          { ...VS, text: 'Here. Come by the Olive Burrow sometime, on Cran. Tell ’em you never said when.' },
        ]);
        S.addItem('matchbook');
        S.setFlag('famigliaInvite');
        ui.toast('You got an <b>Olive Burrow Matchbook</b>. Inside, in pencil: “out back. ask for Vinnie.”', '📕');
      },
    });
    register({
      getPos: () => eWrap.position, r: 1.8, priority: 2,
      enabled: () => heistOn(),
      label: 'check on the possum',
      use: () => ui.say([
        'A possum lies on his side on the asphalt with his tongue out and all four feet sticking straight out sideways. He is extremely dead.',
        { speaker: 'Eddie', voice: VOICE.eddie, text: '…Is it a cop?' },
        { speaker: 'Eddie', voice: VOICE.eddie, text: S.hasFlag('famiglia') ? 'Oh. It’s you. Hi. I’m the lookout. Everything’s fine. I’m dead.' : '…I’m dead. Keep walking. Nothin’ to see. Very dead.' },
      ]),
    });
    register({
      pos: new THREE.Vector3(shoreAt.x + 0.6, 0, shoreAt.z - 0.2), r: 1.8, priority: 1,
      enabled: () => heistOn(),
      label: 'talk to the raccoon in the rowboat',
      use: () => ui.say({ speaker: 'Vinnie', voice: VOICE.vinnie, text: nextLine('vinNight', [
        'Shh. I’m the boat.',
        'I ain’t in the can tonight. Can’t be two places. I tried once. Ask Eddie how that went.',
        S.hasFlag('famiglia') ? 'Famiglia! Looking good in the hat. Now shh.' : 'Whaddaya want. It’s a boat. I’m a raccoon in it. Very normal.',
      ]) }),
    });
  }

  // ============================================================= update ----
  function update(dt, t, playerPos) {
    const zone = zones.current();
    if (zone === 'island') {
      if (Math.hypot(playerPos.x - N.x, playerPos.z - N.z) < 130) for (const f of outdoor) f(dt, t, playerPos);
      if (Math.hypot(playerPos.x - ISLAND4.x, playerPos.z - ISLAND4.z) < 90) for (const f of atBulko) f(dt, t, playerPos);
    } else if (inside[zone]) {
      for (const f of inside[zone]) f(dt, t, playerPos);
    }
  }
  mergeStatic(group);
  return { group, update };
}

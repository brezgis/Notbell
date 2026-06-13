// Ambient lives. Villagers run little errands — a coffee at the Lantern
// Room, browsing at Pip's, a quiet sit in the Listening House, a turn
// around the garden — and when you're there to see it, they chat with the
// keepers in small floating bubbles. Friends also meet up out in the open
// and have entire conversations whether or not you eavesdrop. (Eavesdrop.)

import * as THREE from 'three';
import { register } from './interact.js';
import * as zones from './zones.js';
import * as ui from './ui.js';
import { SITES, terrainHeight } from './terrain.js';
import { rand, pick } from './utils.js';
import { FRIENDS } from './villagers.js';

// ---------------------------------------------------------- bubbles ----

const bubbleCache = new Map();

function bubbleSprite(text) {
  if (!bubbleCache.has(text)) {
    // wrap to fit: the bubble grows for chatty villagers instead of clipping
    const cv = document.createElement('canvas');
    const ctx = cv.getContext('2d');
    const font = '600 34px ui-rounded, "Segoe UI", system-ui, sans-serif';
    ctx.font = font;
    const words = text.split(' ');
    const lines = [];
    let line = '';
    for (const w of words) {
      const probe = line ? line + ' ' + w : w;
      if (ctx.measureText(probe).width > 440 && line) {
        lines.push(line);
        line = w;
      } else {
        line = probe;
      }
    }
    if (line) lines.push(line);
    const H = 44 + lines.length * 42;
    cv.width = 512;
    cv.height = H;
    ctx.font = font; // canvas resize resets state
    ctx.fillStyle = 'rgba(255,250,240,0.96)';
    ctx.strokeStyle = '#e8d5ae';
    ctx.lineWidth = 6;
    ctx.beginPath();
    ctx.roundRect(8, 8, 496, H - 16, 30);
    ctx.fill();
    ctx.stroke();
    ctx.fillStyle = '#5b4a32';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    lines.forEach((ln, i) => ctx.fillText(ln, 256, 22 + (i + 0.5) * 42));
    const tex = new THREE.CanvasTexture(cv);
    tex.colorSpace = THREE.SRGBColorSpace;
    tex.userData = { h: H };
    bubbleCache.set(text, tex);
  }
  const tex = bubbleCache.get(text);
  const sprite = new THREE.Sprite(new THREE.SpriteMaterial({
    map: tex, transparent: true, depthWrite: false,
  }));
  sprite.scale.set(3.4, 3.4 * (tex.userData.h / 512), 1);
  return sprite;
}

// ----------------------------------------------------------- venues ----
// guest: where a visitor stands/sits · keeper: who they chat with

const VENUES = [
  {
    id: 'cafe', zone: 'cafe',
    guest: { x: 305.1, z: 81.2, rotY: -2.0 },
    keeper: { x: 298, z: 76.2 },
    guestLine: 'Shh. Coffee.',
    chats: [
      [['g', 'One Lantern Roast, please.'], ['k', 'For here, dreamer?'], ['g', 'Always for here.']],
      [['g', 'Is the lamp warm today?'], ['k', 'The lamp is always warm.'], ['g', 'Good. Good.']],
      [['g', 'Chip, play the slow one!'], ['k', 'He only knows slow ones.']],
    ],
  },
  {
    id: 'shop', zone: 'shop',
    guest: { x: 302.2, z: -1.0, rotY: -2.4 },
    keeper: { x: 300, z: -3.6 },
    guestLine: 'Decisions, decisions.',
    chats: [
      [['g', 'How much for the shiny one?'], ['k', 'Which shiny one?'], ['g', '…All of them.']],
      [['g', 'Did this fall off a boat?'], ['k', 'Officially? Yes.'], ['g', 'Sold.']],
      [['g', 'Pip, that’s MY button.'], ['k', 'It WAS your button.']],
    ],
  },
  {
    id: 'museum', zone: 'museum',
    guest: { x: 295, z: 161, rotY: -1.2 },
    keeper: { x: 297.5, z: 158.5 },
    guestLine: 'Looking. Learning. Mostly looking.',
    chats: [
      [['g', 'Is this fossil judging me?'], ['k', 'It has had eons of practice.']],
      [['g', 'I donated that one!'], ['k', 'And it is cherished, dear.']],
    ],
  },
  {
    id: 'church', zone: 'church',
    guest: { x: 302.6, z: 979.7, rotY: Math.PI },
    keeper: { x: 300, z: 974.8 },
    guestLine: '(listening)',
    chats: [
      [['g', '…'], ['k', '…'], ['g', '(contented)']],
      [['g', 'I almost heard it today.'], ['k', 'Then today was a good day.']],
    ],
  },
  {
    id: 'garden', zone: 'island',
    guest: () => ({ x: SITES.garden2.x - 1.2, z: SITES.garden2.z + 3.4, rotY: Math.PI }),
    keeper: null,
    guestLine: 'What a GOOD fountain.',
    chats: [
      [['g', '(smelling each flower individually)']],
      [['g', 'What a cloud. What a CLOUD.']],
    ],
  },
];

// ------------------------------------------------------------ logic ----

export function createAmbient(animals, scene) {
  const busyVenues = new Set();
  const errands = [];
  const meetings = [];
  let poll = 12; // let the island settle before anyone goes shopping

  function setAway(a) {
    a.away = !!a.home || !!a.errand || !!a.meeting;
  }

  function byName(name) {
    return animals.find((x) => x.identity?.name === name);
  }

  // talking to someone who's out on an errand
  for (const a of animals) {
    if (!a.identity) continue;
    register({
      getPos: () => a.g.position,
      r: 2.4,
      zone: () => a.errand?.venue.zone ?? '__nowhere',
      enabled: () => !!a.errand,
      label: () => `talk to ${a.identity.name}`,
      use: () => {
        ui.say(a.errand.venue.guestLine, { speaker: a.identity.name, voice: a.identity.voice });
      },
    });
    // ...or interrupting them mid-meetup (they don't mind. mostly.)
    register({
      getPos: () => a.g.position,
      r: 2.6,
      enabled: () => !!a.meeting,
      label: () => `talk to ${a.identity.name}`,
      use: () => {
        const line = a.meeting?.pair.meetLines?.[a.identity.name] ||
          '(They are mid-conversation, and politely include you in the pause.)';
        ui.say(line, { speaker: a.identity.name, voice: a.identity.voice });
      },
    });
  }

  // ---------------------------------------------------------- meetups ----

  function startMeeting(pair) {
    const A = byName(pair.a), B = byName(pair.b);
    if (!A || !B) return null;
    if (A.home || B.home || A.errand || B.errand || A.meeting || B.meeting) return null;
    // B pops over (villagers travel instantly when nobody is watching them)
    const hx = A.g.position.x, hz = A.g.position.z;
    let gx = hx + 1.7, gz = hz;
    for (let k = 0; k < 8; k++) {
      const ang = (k / 8) * Math.PI * 2;
      const tx = hx + Math.cos(ang) * 1.7, tz = hz + Math.sin(ang) * 1.7;
      if (zones.islandCanWalk(tx, tz) && terrainHeight(tx, tz) > 0.3) {
        gx = tx;
        gz = tz;
        break;
      }
    }
    const m = {
      pair, A, B,
      returnTo: { x: B.g.position.x, z: B.g.position.z },
      until: rand(40, 75),
      chatCooldown: rand(2, 6),
      exchange: null,
      bubble: null,
    };
    A.meeting = m;
    B.meeting = m;
    setAway(A);
    setAway(B);
    B.g.position.set(gx, terrainHeight(gx, gz), gz);
    A.g.rotation.y = Math.atan2(gx - hx, gz - hz); // square up, like friends do
    B.g.rotation.y = Math.atan2(hx - gx, hz - gz);
    meetings.push(m);
    return m;
  }

  function endMeeting(m) {
    clearBubble(m);
    m.A.meeting = null;
    m.B.meeting = null;
    setAway(m.A);
    setAway(m.B);
    if (!m.A.home && !m.A.errand) m.A.g.visible = true;
    if (!m.B.home && !m.B.errand) m.B.g.visible = true;
    if (!m.B.home && !m.B.errand) {
      m.B.g.position.set(m.returnTo.x, terrainHeight(m.returnTo.x, m.returnTo.z), m.returnTo.z);
      m.B.state = 'idle';
      m.B.timer = rand(1, 3);
    }
    m.A.state = 'idle';
    m.A.timer = rand(1, 3);
    meetings.splice(meetings.indexOf(m), 1);
  }

  function showMeetLine(m, [who, text]) {
    clearBubble(m);
    const speaker = who === 'a' ? m.A : m.B;
    const bubble = bubbleSprite(text);
    bubble.position.set(speaker.g.position.x, speaker.g.position.y + 2.8, speaker.g.position.z);
    scene.add(bubble);
    m.bubble = bubble;
  }

  function startErrand(a, venue) {
    const spot = typeof venue.guest === 'function' ? venue.guest() : venue.guest;
    a.errand = {
      venue,
      until: rand(120, 260),
      returnTo: { x: a.g.position.x, z: a.g.position.z },
      chatCooldown: rand(4, 10),
      exchange: null,
      bubble: null,
    };
    busyVenues.add(venue.id);
    setAway(a);
    a.g.position.set(spot.x,
      venue.zone === 'island' ? terrainHeight(spot.x, spot.z) : 0, spot.z);
    a.g.rotation.y = spot.rotY ?? 0;
  }

  function endErrand(a) {
    const e = a.errand;
    if (!e) return;
    clearBubble(e);
    busyVenues.delete(e.venue.id);
    a.errand = null;
    setAway(a);
    if (!a.home && !a.meeting) a.g.visible = true;
    if (!a.home) {
      a.g.position.set(e.returnTo.x, a.g.position.y, e.returnTo.z);
      a.state = 'idle';
      a.timer = rand(1, 3);
    }
  }

  function clearBubble(e) {
    if (e.bubble) {
      scene.remove(e.bubble);
      e.bubble.material.dispose();
      e.bubble = null;
    }
  }

  function update(dt, playerPos) {
    poll -= dt;
    if (poll <= 0) {
      poll = 6;
      // someone might feel like an outing
      if (Math.random() < 0.5) {
        const candidates = animals.filter((a) =>
          a.identity && !a.home && !a.errand && !a.meeting && !a.swims);
        const venue = pick(VENUES.filter((v) => !busyVenues.has(v.id)));
        if (candidates.length && venue) startErrand(pick(candidates), venue);
      }
      // and friends find each other
      if (Math.random() < 0.35 && meetings.length < 2) {
        startMeeting(pick(FRIENDS));
      }
    }

    for (const m of [...meetings]) {
      if (m.A.home || m.B.home) { endMeeting(m); continue; } // bedtime wins
      m.until -= dt;
      if (m.until <= 0) { endMeeting(m); continue; }
      const meetingVisible = zones.current() === 'island';
      m.A.g.visible = meetingVisible;
      m.B.g.visible = meetingVisible;
      // the conversation is only audible with an audience
      const near = meetingVisible && playerPos &&
        Math.hypot(playerPos.x - m.A.g.position.x, playerPos.z - m.A.g.position.z) < 18;
      if (!near) {
        if (m.exchange) { clearBubble(m); m.exchange = null; }
        continue;
      }
      if (m.exchange) {
        m.exchange.t -= dt;
        if (m.exchange.t <= 0) {
          clearBubble(m);
          m.exchange.idx += 1;
          const line = m.exchange.lines[m.exchange.idx];
          if (!line) {
            m.exchange = null;
            m.chatCooldown = rand(10, 24);
          } else {
            showMeetLine(m, line);
            m.exchange.t = 2.8;
          }
        }
      } else {
        m.chatCooldown -= dt;
        if (m.chatCooldown <= 0) {
          const lines = pick(m.pair.chats);
          m.exchange = { lines, idx: 0, t: 2.8 };
          showMeetLine(m, lines[0]);
        }
      }
    }

    for (const a of animals) {
      const e = a.errand;
      if (!e) continue;
      if (a.home) { endErrand(a); continue; } // bedtime beats errands
      e.until -= dt;
      if (e.until <= 0) { endErrand(a); continue; }

      // chatter, but only when someone's there to enjoy it
      const visibleHere = zones.current() === e.venue.zone;
      a.g.visible = visibleHere;
      if (!visibleHere) {
        if (e.exchange) { clearBubble(e); e.exchange = null; }
        continue;
      }
      if (e.exchange) {
        e.exchange.t -= dt;
        if (e.exchange.t <= 0) {
          clearBubble(e);
          e.exchange.idx += 1;
          const line = e.exchange.lines[e.exchange.idx];
          if (!line) {
            e.exchange = null;
            e.chatCooldown = rand(18, 40);
          } else {
            showLine(a, e, line);
            e.exchange.t = 2.8;
          }
        }
      } else {
        e.chatCooldown -= dt;
        if (e.chatCooldown <= 0) {
          const lines = pick(e.venue.chats);
          e.exchange = { lines, idx: 0, t: 2.8 };
          showLine(a, e, lines[0]);
        }
      }
    }
  }

  function showLine(a, e, [who, text]) {
    clearBubble(e);
    const bubble = bubbleSprite(text);
    if (who === 'k' && e.venue.keeper) {
      bubble.position.set(e.venue.keeper.x, 3.1, e.venue.keeper.z);
    } else {
      bubble.position.set(a.g.position.x, a.g.position.y + 2.8, a.g.position.z);
    }
    scene.add(bubble);
    e.bubble = bubble;
  }

  // test/debug: send someone on a specific outing right now
  function forceErrand(name, venueId) {
    const a = animals.find((x) => x.identity?.name === name);
    const venue = VENUES.find((v) => v.id === venueId);
    if (a && venue && !a.errand && !a.home) startErrand(a, venue);
  }

  // test/debug: make two friends meet up right now; reports where
  function forceMeeting(name) {
    const pair = FRIENDS.find((f) => f.a === name || f.b === name);
    const m = pair && startMeeting(pair);
    return m ? { host: m.pair.a, x: m.A.g.position.x, z: m.A.g.position.z } : null;
  }

  return { update, forceErrand, forceMeeting };
}

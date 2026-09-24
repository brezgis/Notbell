// Synthesized sound — no audio files, just a WebAudio context that wakes up
// on the first key press. M toggles mute.
//
// The whole mix runs through a warm low-pass and a small generated reverb,
// on two buses (music quieter than effects). Every note gets a soft attack
// and a round release, and harsh waves are softened (square → triangle), so
// nothing clicks or beeps at you. The soundtrack is generative: a mood per
// time of day and weather, a chord progression under a melody improvised
// fresh each bar from its scale. Outdoors there's ambience underneath —
// surf, wind, birds by day, crickets at night, rain when it rains.

let ctx = null;
let muted = false;
let masterGain = null;
let masterLevel = 1;
let sfxBus = null;
let musicBus = null;
let reverbSend = null;

function makeImpulse(a, secs = 2.2, decay = 2.8) {
  const len = Math.floor(a.sampleRate * secs);
  const buf = a.createBuffer(2, len, a.sampleRate);
  for (let ch = 0; ch < 2; ch++) {
    const d = buf.getChannelData(ch);
    for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / len, decay);
  }
  return buf;
}

function ac() {
  if (!ctx) {
    ctx = new (window.AudioContext || window.webkitAudioContext)();
    masterGain = ctx.createGain();
    masterLevel = muted ? 0 : 1;
    masterGain.gain.value = masterLevel;
    // warm the top end off everything; a little room around everything
    const warm = ctx.createBiquadFilter();
    warm.type = 'lowpass';
    warm.frequency.value = 5200;
    warm.Q.value = 0.4;
    const verb = ctx.createConvolver();
    verb.buffer = makeImpulse(ctx);
    const verbGain = ctx.createGain();
    verbGain.gain.value = 0.35;
    reverbSend = ctx.createGain();
    reverbSend.gain.value = 1;
    reverbSend.connect(verb).connect(verbGain).connect(warm);
    sfxBus = ctx.createGain();
    sfxBus.gain.value = 0.8;
    musicBus = ctx.createGain();
    musicBus.gain.value = 0.65;
    for (const bus of [sfxBus, musicBus]) {
      bus.connect(warm);
      bus.connect(reverbSend);
    }
    warm.connect(masterGain);
    masterGain.connect(ctx.destination);
  }
  if (ctx.state === 'suspended') ctx.resume();
  return ctx;
}

function rampMasterGain() {
  const a = ac();
  const now = a.currentTime;
  const target = muted ? 0 : 1;
  masterGain.gain.cancelScheduledValues(now);
  masterGain.gain.setValueAtTime(masterLevel, now);
  masterGain.gain.linearRampToValueAtTime(target, now + 0.015);
  masterLevel = target;
}

// Lazy init on first user gesture (browsers require it).
addEventListener('keydown', (e) => {
  if (e.code === 'KeyM') {
    muted = !muted;
    rampMasterGain();
    document.dispatchEvent(new CustomEvent('notbell-mute', { detail: muted }));
  } else {
    ac();
  }
}, { passive: true });

let collectSong = false;
let songNodes = [];

const SOFTEN = { square: 'triangle', sawtooth: 'triangle' };

// One note. attack/release are soft by default; bus 'music' or 'sfx'.
export function tone(freq, {
  time = 0, dur = 0.09, type = 'triangle', vol = 0.05, slide = 0, attack = 0.008, bus = 'sfx',
} = {}) {
  if (muted) return;
  const a = ac();
  const t0 = a.currentTime + time;
  const osc = a.createOscillator();
  if (collectSong) songNodes.push(osc);
  const gain = a.createGain();
  osc.type = SOFTEN[type] ?? type;
  osc.frequency.setValueAtTime(freq, t0);
  if (slide) osc.frequency.exponentialRampToValueAtTime(Math.max(30, freq + slide), t0 + dur);
  const atk = Math.min(attack, dur * 0.5);
  gain.gain.setValueAtTime(0.0001, t0);
  gain.gain.linearRampToValueAtTime(vol, t0 + atk);
  gain.gain.exponentialRampToValueAtTime(0.0001, t0 + dur + 0.04);
  osc.connect(gain).connect(bus === 'music' ? musicBus : sfxBus);
  osc.start(t0);
  osc.stop(t0 + dur + 0.08);
}

// a bell-ish note: fundamental plus a soft inharmonic partial
function bell(freq, { time = 0, dur = 0.5, vol = 0.04 } = {}) {
  tone(freq, { time, dur, type: 'sine', vol, attack: 0.004 });
  tone(freq * 2.76, { time, dur: dur * 0.5, type: 'sine', vol: vol * 0.25, attack: 0.004 });
}

let noiseBuf = null;
function noiseBuffer(a) {
  if (!noiseBuf) {
    const len = a.sampleRate * 2;
    noiseBuf = a.createBuffer(1, len, a.sampleRate);
    const d = noiseBuf.getChannelData(0);
    for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
  }
  return noiseBuf;
}

function noise({ time = 0, dur = 0.25, vol = 0.06, freq = 900 } = {}) {
  if (muted) return;
  const a = ac();
  const t0 = a.currentTime + time;
  const src = a.createBufferSource();
  src.buffer = noiseBuffer(a);
  const filter = a.createBiquadFilter();
  filter.type = 'bandpass';
  filter.frequency.value = freq;
  const gain = a.createGain();
  gain.gain.setValueAtTime(0.0001, t0);
  gain.gain.linearRampToValueAtTime(vol, t0 + 0.02);
  gain.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
  src.connect(filter).connect(gain).connect(sfxBus);
  src.start(t0, Math.random());
  src.stop(t0 + dur + 0.05);
}

// One syllable of villager-speak; pitch is the speaker's voice. Round and
// quiet now — a murmur with a pitch, not a beep.
export function blip(pitch = 520) {
  tone(pitch * (0.92 + Math.random() * 0.18), {
    dur: 0.06, type: 'sine', vol: 0.032, attack: 0.01,
  });
}

export function jingle() {
  bell(784, { dur: 0.35, vol: 0.035 });
  bell(988, { time: 0.1, dur: 0.35, vol: 0.035 });
  bell(1318, { time: 0.2, dur: 0.6, vol: 0.04 });
}

export function sadTrombone() {
  tone(300, { dur: 0.22, type: 'triangle', vol: 0.03, slide: -60, attack: 0.03 });
  tone(240, { time: 0.2, dur: 0.4, type: 'triangle', vol: 0.03, slide: -50, attack: 0.03 });
}

export function splash() {
  noise({ dur: 0.35, freq: 1200, vol: 0.06 });
  noise({ time: 0.05, dur: 0.25, freq: 500, vol: 0.04 });
}

export function plop() {
  tone(380, { dur: 0.14, type: 'sine', vol: 0.06, slide: -220 });
}

export function bite() {
  // a tug on the line: two quick soft knocks
  tone(620, { dur: 0.08, type: 'sine', vol: 0.06 });
  tone(620, { time: 0.1, dur: 0.08, type: 'sine', vol: 0.06 });
}

export function thud() {
  tone(120, { dur: 0.18, type: 'sine', vol: 0.09, slide: -60 });
  noise({ dur: 0.12, freq: 300, vol: 0.03 });
}

export function kaching() {
  bell(1174, { dur: 0.25, vol: 0.035 });
  bell(1568, { time: 0.07, dur: 0.45, vol: 0.035 });
}

export function doorChime() {
  bell(784, { dur: 0.4, vol: 0.04 });
  bell(1046, { time: 0.12, dur: 0.6, vol: 0.04 });
}

export function sip() {
  noise({ dur: 0.18, freq: 1800, vol: 0.02 });
  tone(520, { time: 0.2, dur: 0.18, type: 'sine', vol: 0.03, slide: 80 });
}

export function isMuted() {
  return muted;
}

// ---------------------------------------------------- Chip's songbook ----
// Tiny melodies, scheduled note by note. [midiNote, beats] — 0 is a rest.
const SONGBOOK = {
  button_bossa: {
    bpm: 132, type: 'triangle',
    notes: [[64, 1], [67, 1], [69, 0.5], [67, 0.5], [64, 1], [60, 1], [62, 0.5], [64, 0.5],
      [67, 1], [69, 1], [72, 1.5], [0, 0.5], [69, 0.5], [67, 0.5], [64, 1], [62, 1], [60, 2]],
  },
  foggy_lullaby: {
    bpm: 72, type: 'sine',
    notes: [[57, 2], [60, 2], [64, 3], [62, 1], [60, 2], [57, 2], [55, 4],
      [0, 1], [57, 2], [60, 2], [59, 3], [57, 1], [55, 4]],
  },
  tidepool_stomp: {
    bpm: 160, type: 'triangle',
    notes: [[55, 0.5], [55, 0.5], [62, 1], [55, 0.5], [55, 0.5], [64, 1],
      [65, 0.5], [64, 0.5], [62, 0.5], [60, 0.5], [62, 2],
      [55, 0.5], [55, 0.5], [67, 1], [65, 0.5], [64, 0.5], [62, 2]],
  },
  // Thelonious, on the corner of Loam Street: a blues lick, swung
  mind_the_gap: {
    bpm: 118, type: 'triangle',
    notes: [[60, 0.67], [63, 0.33], [65, 0.67], [66, 0.33], [67, 1], [70, 0.5], [67, 0.5], [65, 1],
      [63, 0.67], [60, 0.33], [0, 0.5], [67, 0.5], [70, 0.67], [72, 0.33], [70, 0.67], [67, 0.33],
      [65, 0.67], [63, 0.33], [60, 1], [58, 0.5], [60, 2.5]],
  },
};

let songEndsAt = 0;

export function cancelSong() {
  for (const osc of songNodes) {
    try { osc.stop(); } catch { /* already done */ }
  }
  songNodes = [];
  songEndsAt = 0;
}

export function playSong(id, force = false) {
  const song = SONGBOOK[id];
  if (!song || muted) return;
  const a = ac();
  if (!force && a.currentTime < songEndsAt) return; // Chip finishes what he starts
  if (force) cancelSong();
  const beat = 60 / song.bpm;
  let when = 0.1;
  collectSong = true;
  for (const [note, beats] of song.notes) {
    if (note > 0) {
      const freq = 440 * Math.pow(2, (note - 69) / 12);
      tone(freq, { time: when, dur: beat * beats * 0.85, type: song.type, vol: 0.04, attack: 0.015, bus: 'music' });
    }
    when += beat * beats;
  }
  collectSong = false;
  songEndsAt = a.currentTime + when;
}

// Chip takes requests: drops his current number mid-bar, with dignity
export function requestSong(id) {
  playSong(id, true);
}

// ------------------------------------------------------ the music box ----
// A generative sequencer. Each mood has a tempo, a scale, a progression of
// chords (held pads that swell in), a soft bass, and a lead that improvises
// a sparse melody from the scale each bar — so it never plays the same
// sixteen notes twice, and it never quite goes quiet or gets busy.

const midiHz = (m) => 440 * Math.pow(2, (m - 69) / 12);
const SCALES = {
  major: [0, 2, 4, 7, 9],       // pentatonic: nothing can clash
  minor: [0, 3, 5, 7, 10],
  lydian: [0, 2, 4, 6, 7, 9, 11],
  dorian: [0, 2, 3, 5, 7, 9, 10],
};

// chords as [root offset from key, quality]; key is a MIDI note
const MTRACKS = {
  morning: { bpm: 76, key: 60, scale: 'major', density: 0.4, lead: 'triangle', vol: 0.02,
    chords: [[0, 'maj7'], [5, 'maj'], [9, 'min7'], [7, 'sus']] },
  day: { bpm: 84, key: 65, scale: 'major', density: 0.45, lead: 'triangle', vol: 0.02,
    chords: [[0, 'maj'], [7, 'maj'], [9, 'min'], [5, 'maj7']] },
  evening: { bpm: 70, key: 62, scale: 'dorian', density: 0.35, lead: 'sine', vol: 0.02,
    chords: [[0, 'min7'], [5, 'maj7'], [3, 'maj7'], [7, 'sus']] },
  night: { bpm: 56, key: 57, scale: 'minor', density: 0.22, lead: 'sine', vol: 0.019,
    chords: [[0, 'min7'], [8, 'maj7'], [5, 'min7'], [3, 'maj7']] },
  rain: { bpm: 62, key: 58, scale: 'minor', density: 0.28, lead: 'sine', vol: 0.018,
    chords: [[0, 'min7'], [5, 'min7'], [8, 'maj7'], [7, 'sus']] },
  snow: { bpm: 60, key: 64, scale: 'lydian', density: 0.25, lead: 'sine', vol: 0.018, sparkle: true,
    chords: [[0, 'maj7'], [2, 'maj'], [9, 'min7'], [0, 'sus']] },
  fog: { bpm: 50, key: 55, scale: 'dorian', density: 0.15, lead: 'sine', vol: 0.018,
    chords: [[0, 'sus'], [5, 'min7'], [0, 'sus'], [3, 'maj7']] },
  holiday: { bpm: 100, key: 60, scale: 'major', density: 0.6, lead: 'triangle', vol: 0.018, sparkle: true,
    chords: [[0, 'maj'], [5, 'maj'], [7, 'maj'], [5, 'maj']] },
  cave: { bpm: 42, key: 50, scale: 'minor', density: 0.12, lead: 'sine', vol: 0.022, sparkle: true,
    chords: [[0, 'sus'], [0, 'min7']] },
  church: { bpm: 50, key: 60, scale: 'major', density: 0.0, lead: 'sine', vol: 0.024,
    chords: [[0, 'maj'], [5, 'maj'], [7, 'sus'], [0, 'maj']] },
  museum: { bpm: 70, key: 57, scale: 'dorian', density: 0.3, lead: 'triangle', vol: 0.016,
    chords: [[0, 'min7'], [5, 'maj7']] },
  shop: { bpm: 92, key: 60, scale: 'major', density: 0.45, lead: 'triangle', vol: 0.018,
    chords: [[0, 'maj7'], [5, 'maj7'], [2, 'min7'], [7, 'maj']] },
  manor: { bpm: 84, key: 55, scale: 'major', density: 0.35, lead: 'triangle', vol: 0.018,
    chords: [[0, 'maj'], [5, 'maj'], [2, 'min'], [7, 'maj']] },
  bulko: { bpm: 92, key: 57, scale: 'major', density: 0.55, lead: 'triangle', vol: 0.018,
    chords: [[0, 'maj7'], [5, 'maj7'], [7, 'maj'], [5, 'maj']] }, // muzak. unapologetic muzak.
  // the Dropped Crown: lydian, slow, bubbly — the raised fourth is the light
  // coming down through the water
  reef: { bpm: 72, key: 65, scale: 'lydian', density: 0.35, lead: 'sine', vol: 0.02, sparkle: true,
    chords: [[0, 'maj7'], [2, 'maj'], [0, 'maj7'], [7, 'sus']] },
  // the Burrough: dorian, a little swing, a streetcar bell somewhere
  burrough: { bpm: 96, key: 55, scale: 'dorian', density: 0.38, lead: 'triangle', vol: 0.018,
    chords: [[2, 'min7'], [7, 'maj'], [0, 'maj7'], [9, 'min7']] },
  indoors: { bpm: 68, key: 60, scale: 'major', density: 0.2, lead: 'sine', vol: 0.016,
    chords: [[0, 'maj'], [9, 'min']] },
};
const QUAL = { maj: [0, 4, 7], min: [0, 3, 7], maj7: [0, 4, 7, 11], min7: [0, 3, 7, 10], sus: [0, 5, 7] };
// aliases the main loop may still ask for
MTRACKS.night_moon = MTRACKS.night;

let mood = null;
let mStep = 0;
let mNext = 0;
let mBar = 0;
let lastLead = 0;
const CAFE_SET = ['button_bossa', 'foggy_lullaby', 'tidepool_stomp'];
let cafeIdx = 0;

export function setMood(next) {
  if (next === mood) return;
  mood = next;
  mStep = 0;
  if (ctx) mNext = ctx.currentTime + 0.3;
}

function scheduleStep(tr, rel, stepDur) {
  const chord = tr.chords[mBar % tr.chords.length];
  const root = tr.key + chord[0];
  // the pad: swells in at the top of each bar and holds the whole bar
  if (mStep === 0) {
    for (const iv of QUAL[chord[1]]) {
      tone(midiHz(root + iv - 12), { time: rel, dur: stepDur * 16, type: 'sine', vol: tr.vol * 0.45, attack: stepDur * 4, bus: 'music' });
    }
    tone(midiHz(root - 24), { time: rel, dur: stepDur * 7, type: 'sine', vol: tr.vol * 1.1, attack: 0.06, bus: 'music' });
  }
  if (mStep === 8 && Math.random() < 0.6) {
    tone(midiHz(root - 24 + 7), { time: rel, dur: stepDur * 6, type: 'sine', vol: tr.vol * 0.9, attack: 0.06, bus: 'music' });
  }
  // the lead: a sparse, stepwise little melody, improvised from the scale
  const beatWeight = mStep % 4 === 0 ? 1.4 : mStep % 2 === 0 ? 0.9 : 0.4;
  if (Math.random() < tr.density * beatWeight) {
    const sc = SCALES[tr.scale];
    const pool = [];
    for (const oct of [0, 12]) for (const d of sc) pool.push(tr.key + 12 + oct + d);
    // mostly a step or two from the last note; sometimes a leap
    const near = pool.filter((p) => p !== lastLead && Math.abs(p - lastLead) <= 4);
    const from = lastLead && near.length && Math.random() < 0.75 ? near : pool;
    const n = from[Math.floor(Math.random() * from.length)];
    lastLead = n;
    tone(midiHz(n), { time: rel, dur: stepDur * (1.5 + Math.random() * 2), type: tr.lead, vol: tr.vol * 0.8, attack: 0.02, bus: 'music' });
  }
  // a high glint now and then (snow, caves, the reef)
  if (tr.sparkle && Math.random() < 0.06) {
    const sc = SCALES[tr.scale];
    bell(midiHz(tr.key + 24 + sc[Math.floor(Math.random() * sc.length)]), { time: rel, dur: 1.2, vol: tr.vol * 0.5 });
  }
}

setInterval(() => {
  if (!ctx || muted || !mood) return;
  if (mood === 'cafe') {
    // Chip is the house band; he simply never stops for long
    if (ctx.currentTime > songEndsAt + 2.6) {
      playSong(CAFE_SET[cafeIdx++ % CAFE_SET.length]);
    }
    return;
  }
  const tr = MTRACKS[mood];
  if (!tr) return;
  const stepDur = 60 / tr.bpm / 2;
  if (mNext < ctx.currentTime) mNext = ctx.currentTime + 0.05;
  while (mNext < ctx.currentTime + 0.3) {
    scheduleStep(tr, mNext - ctx.currentTime, stepDur);
    mStep = (mStep + 1) % 16;
    if (mStep === 0) mBar++;
    mNext += stepDur;
  }
}, 90);

// -------------------------------------------------------- ambience ----
// Continuous beds (surf, wind, rain) as looping filtered noise, faded in and
// out; birds and crickets as occasional small calls. The main loop tells us
// where we are every couple of seconds.

const amb = { want: null, beds: null, callT: 0 };

function bed(a, type, freq, q = 0.7) {
  const src = a.createBufferSource();
  src.buffer = noiseBuffer(a);
  src.loop = true;
  const f = a.createBiquadFilter();
  f.type = type;
  f.frequency.value = freq;
  f.Q.value = q;
  const g = a.createGain();
  g.gain.value = 0;
  src.connect(f).connect(g).connect(sfxBus);
  src.start(0, Math.random() * 2);
  return { g, f };
}

// { outdoors, night, weather: 'clear'|'rain'|'snow'|'fog', coast: 0..1, high: 0..1 }
export function setAmbience(want) {
  amb.want = want;
}

function birdCall(rel) {
  const base = 2200 + Math.random() * 1400;
  const n = 2 + Math.floor(Math.random() * 3);
  for (let i = 0; i < n; i++) {
    tone(base * (1 + (Math.random() - 0.5) * 0.2), { time: rel + i * 0.11, dur: 0.08, type: 'sine', vol: 0.012, slide: (Math.random() < 0.5 ? 1 : -1) * 500, attack: 0.01 });
  }
}
function cricket(rel) {
  const f = 4200 + Math.random() * 400;
  for (let i = 0; i < 3; i++) tone(f, { time: rel + i * 0.06, dur: 0.035, type: 'sine', vol: 0.006, attack: 0.005 });
}
function gull(rel) {
  tone(1500, { time: rel, dur: 0.35, type: 'triangle', vol: 0.01, slide: -600, attack: 0.04 });
  tone(1400, { time: rel + 0.4, dur: 0.3, type: 'triangle', vol: 0.008, slide: -500, attack: 0.04 });
}

setInterval(() => {
  if (!ctx || !amb.want) return;
  const a = ctx;
  if (!amb.beds) {
    amb.beds = {
      surf: bed(a, 'lowpass', 500, 0.5),
      wind: bed(a, 'bandpass', 700, 0.4),
      rain: bed(a, 'highpass', 1800, 0.3),
    };
  }
  const w = amb.want, now = a.currentTime;
  const out = w.outdoors && !muted ? 1 : 0;
  const set = (b, v) => b.g.gain.setTargetAtTime(v * out, now, 1.2);
  // the surf swells and draws back, louder near the shore
  const swell = 0.55 + 0.45 * Math.sin(now * 0.45);
  set(amb.beds.surf, (0.012 + 0.03 * (w.coast ?? 0.5)) * swell);
  amb.beds.surf.f.frequency.setTargetAtTime(380 + swell * 260, now, 0.5);
  set(amb.beds.wind, (w.weather === 'fog' ? 0.012 : 0.004) + 0.012 * (w.high ?? 0) + (w.weather === 'snow' ? 0.01 : 0));
  set(amb.beds.rain, w.weather === 'rain' ? 0.03 : 0);
  if (!out) return;
  amb.callT -= 0.5;
  if (amb.callT <= 0) {
    amb.callT = 1 + Math.random() * 4;
    if (w.weather === 'rain') return;
    if (w.night) { if (Math.random() < 0.8) cricket(0.1); } else if (Math.random() < 0.55) birdCall(0.1);
    else if ((w.coast ?? 0) > 0.5 && Math.random() < 0.3) gull(0.1);
  }
}, 500);

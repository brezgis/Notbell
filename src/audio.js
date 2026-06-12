// Tiny synthesized sounds — no audio files, just a WebAudio context that
// wakes up on the first key press. M toggles mute.

let ctx = null;
let muted = false;

function ac() {
  if (!ctx) ctx = new (window.AudioContext || window.webkitAudioContext)();
  if (ctx.state === 'suspended') ctx.resume();
  return ctx;
}

// Lazy init on first user gesture (browsers require it).
addEventListener('keydown', (e) => {
  if (e.code === 'KeyM') {
    muted = !muted;
    document.dispatchEvent(new CustomEvent('notbell-mute', { detail: muted }));
  } else {
    ac();
  }
}, { passive: true });

let collectSong = false;
let songNodes = [];

export function tone(freq, { time = 0, dur = 0.09, type = 'square', vol = 0.05, slide = 0 } = {}) {
  if (muted) return;
  const a = ac();
  const t0 = a.currentTime + time;
  const osc = a.createOscillator();
  if (collectSong) songNodes.push(osc);
  const gain = a.createGain();
  osc.type = type;
  osc.frequency.setValueAtTime(freq, t0);
  if (slide) osc.frequency.exponentialRampToValueAtTime(Math.max(30, freq + slide), t0 + dur);
  gain.gain.setValueAtTime(vol, t0);
  gain.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
  osc.connect(gain).connect(a.destination);
  osc.start(t0);
  osc.stop(t0 + dur + 0.02);
}

function noise({ time = 0, dur = 0.25, vol = 0.06, freq = 900 } = {}) {
  if (muted) return;
  const a = ac();
  const t0 = a.currentTime + time;
  const len = Math.floor(a.sampleRate * dur);
  const buf = a.createBuffer(1, len, a.sampleRate);
  const d = buf.getChannelData(0);
  for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / len);
  const src = a.createBufferSource();
  src.buffer = buf;
  const filter = a.createBiquadFilter();
  filter.type = 'bandpass';
  filter.frequency.value = freq;
  const gain = a.createGain();
  gain.gain.value = vol;
  src.connect(filter).connect(gain).connect(a.destination);
  src.start(t0);
}

// One syllable of villager-speak; pitch is the speaker's voice.
export function blip(pitch = 520) {
  tone(pitch * (0.92 + Math.random() * 0.18), {
    dur: 0.045, type: 'triangle', vol: 0.045,
  });
}

export function jingle() {
  tone(660, { dur: 0.1 });
  tone(880, { time: 0.09, dur: 0.1 });
  tone(1320, { time: 0.18, dur: 0.22, vol: 0.06 });
}

export function sadTrombone() {
  tone(300, { dur: 0.18, type: 'sawtooth', vol: 0.03, slide: -60 });
  tone(240, { time: 0.16, dur: 0.3, type: 'sawtooth', vol: 0.03, slide: -50 });
}

export function splash() {
  noise({ dur: 0.3, freq: 1400, vol: 0.08 });
  noise({ time: 0.05, dur: 0.2, freq: 600, vol: 0.05 });
}

export function plop() {
  tone(380, { dur: 0.12, type: 'sine', vol: 0.07, slide: -220 });
}

export function bite() {
  tone(1100, { dur: 0.07, type: 'square', vol: 0.07 });
  tone(1100, { time: 0.09, dur: 0.07, type: 'square', vol: 0.07 });
}

export function thud() {
  tone(120, { dur: 0.15, type: 'sine', vol: 0.1, slide: -60 });
  noise({ dur: 0.12, freq: 300, vol: 0.04 });
}

export function kaching() {
  tone(990, { dur: 0.06, vol: 0.05 });
  tone(1480, { time: 0.06, dur: 0.16, vol: 0.05 });
}

export function doorChime() {
  tone(780, { dur: 0.12, type: 'sine', vol: 0.05 });
  tone(1040, { time: 0.1, dur: 0.2, type: 'sine', vol: 0.05 });
}

export function sip() {
  noise({ dur: 0.18, freq: 2200, vol: 0.03 });
  tone(520, { time: 0.2, dur: 0.18, type: 'sine', vol: 0.04, slide: 80 });
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
    bpm: 160, type: 'square',
    notes: [[55, 0.5], [55, 0.5], [62, 1], [55, 0.5], [55, 0.5], [64, 1],
      [65, 0.5], [64, 0.5], [62, 0.5], [60, 0.5], [62, 2],
      [55, 0.5], [55, 0.5], [67, 1], [65, 0.5], [64, 0.5], [62, 2]],
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
      tone(freq, { time: when, dur: beat * beats * 0.85, type: song.type, vol: 0.045 });
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
// A tiny lookahead sequencer: 16 eighth-note steps, bass + lead + pads.
// Every place gets its own quiet weather of sound.

const midiHz = (m) => 440 * Math.pow(2, (m - 69) / 12);

const MTRACKS = {
  day: { bpm: 82, wave: 'triangle', vol: 0.02, padEvery: 8,
    bass: [48, 0, 0, 0, 43, 0, 0, 0, 45, 0, 0, 0, 41, 0, 0, 0],
    lead: [72, 0, 76, 0, 79, 0, 0, 74, 0, 0, 76, 0, 71, 0, 0, 0],
    pads: [[60, 64, 67], [55, 59, 62], [57, 60, 64], [53, 57, 60]] },
  night: { bpm: 58, wave: 'sine', vol: 0.02, padEvery: 16,
    bass: [45, 0, 0, 0, 0, 0, 0, 0, 41, 0, 0, 0, 0, 0, 0, 0],
    lead: [0, 0, 69, 0, 0, 0, 72, 0, 0, 0, 0, 76, 0, 0, 74, 0],
    pads: [[57, 60, 64], [53, 57, 60]] },
  rain: { bpm: 66, wave: 'sine', vol: 0.018, padEvery: 8,
    bass: [38, 0, 0, 0, 45, 0, 0, 0, 41, 0, 0, 0, 43, 0, 0, 0],
    lead: [0, 65, 0, 0, 69, 0, 0, 0, 0, 67, 0, 0, 0, 0, 65, 0],
    pads: [[50, 53, 57], [53, 57, 60], [46, 50, 53], [48, 52, 55]] },
  holiday: { bpm: 104, wave: 'square', vol: 0.016, padEvery: 8,
    bass: [48, 0, 48, 0, 53, 0, 53, 0, 55, 0, 55, 0, 53, 0, 50, 0],
    lead: [72, 0, 74, 76, 0, 76, 0, 77, 79, 0, 77, 0, 76, 74, 72, 0],
    pads: [[60, 64, 67], [65, 69, 72], [67, 71, 74], [65, 69, 72]] },
  cave: { bpm: 40, wave: 'sine', vol: 0.024, padEvery: 16,
    bass: [38, 0, 0, 0, 0, 0, 0, 0, 38, 0, 0, 0, 0, 0, 0, 0],
    lead: [0, 0, 0, 86, 0, 0, 0, 0, 0, 0, 89, 0, 0, 0, 0, 93],
    pads: [[50, 57, 62]] },
  church: { bpm: 52, wave: 'sine', vol: 0.026, padEvery: 8,
    bass: [36, 0, 0, 0, 0, 0, 0, 0, 41, 0, 0, 0, 43, 0, 0, 0],
    lead: [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
    pads: [[60, 64, 67], [60, 65, 69], [59, 62, 67], [60, 64, 67]] },
  museum: { bpm: 72, wave: 'triangle', vol: 0.015, padEvery: 16,
    bass: [45, 0, 0, 0, 0, 0, 0, 0, 43, 0, 0, 0, 0, 0, 0, 0],
    lead: [69, 0, 72, 0, 76, 0, 72, 0, 67, 0, 71, 0, 74, 0, 71, 0],
    pads: [[57, 60, 64]] },
  shop: { bpm: 96, wave: 'triangle', vol: 0.018, padEvery: 8,
    bass: [48, 0, 52, 0, 53, 0, 52, 0, 48, 0, 52, 0, 55, 0, 53, 0],
    lead: [0, 72, 0, 76, 0, 0, 77, 0, 0, 76, 0, 72, 0, 74, 0, 0],
    pads: [[60, 64, 67], [65, 69, 72]] },
  manor: { bpm: 88, wave: 'triangle', vol: 0.018, padEvery: 8,
    bass: [43, 0, 0, 50, 0, 0, 43, 0, 0, 48, 0, 0, 45, 0, 0, 0],
    lead: [74, 0, 0, 71, 0, 0, 67, 0, 0, 72, 0, 0, 69, 0, 0, 0],
    pads: [[55, 59, 62], [53, 57, 60]] },
  bulko: { bpm: 92, wave: 'triangle', vol: 0.02, padEvery: 8,
    bass: [45, 0, 45, 0, 50, 0, 50, 0, 43, 0, 43, 0, 48, 0, 48, 0],
    lead: [0, 76, 74, 0, 72, 0, 74, 76, 0, 74, 72, 0, 71, 0, 72, 74],
    pads: [[57, 62, 65], [55, 60, 64]] }, // muzak. unapologetic muzak.
  indoors: { bpm: 70, wave: 'sine', vol: 0.016, padEvery: 8,
    bass: [48, 0, 0, 0, 45, 0, 0, 0, 43, 0, 0, 0, 45, 0, 0, 0],
    lead: [0, 0, 72, 0, 0, 0, 0, 0, 0, 0, 71, 0, 0, 0, 0, 0],
    pads: [[60, 64, 67], [57, 60, 64]] },
};

let mood = null;
let mStep = 0;
let mNext = 0;
let mBar = 0;
const CAFE_SET = ['button_bossa', 'foggy_lullaby', 'tidepool_stomp'];
let cafeIdx = 0;

export function setMood(next) {
  if (next === mood) return;
  mood = next;
  mStep = 0;
  mBar = 0;
  if (ctx) mNext = ctx.currentTime + 0.15;
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
    const rel = mNext - ctx.currentTime;
    const b = tr.bass[mStep];
    if (b) tone(midiHz(b), { time: rel, dur: stepDur * 1.8, type: tr.wave, vol: tr.vol });
    const l = tr.lead[mStep];
    if (l) tone(midiHz(l), { time: rel, dur: stepDur * 0.9, type: tr.wave, vol: tr.vol * 0.9 });
    if (mStep % tr.padEvery === 0) {
      const chord = tr.pads[mBar % tr.pads.length];
      for (const m of chord) {
        tone(midiHz(m), { time: rel, dur: stepDur * tr.padEvery * 0.95, type: 'sine', vol: tr.vol * 0.5 });
      }
      if (mStep === 0) mBar++;
    }
    mStep = (mStep + 1) % 16;
    mNext += stepDur;
  }
}, 90);

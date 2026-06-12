// All the 2D cozy bits: dialogue box with typewriter text and choices,
// the interaction prompt, toasts, the pockets panel, HUD, and the black
// fade used when stepping through doors.
//
// Everything is plain DOM laid over the canvas; styles live in index.html.

import { state } from './state.js';
import { ITEMS } from './catalog.js';
import { blip } from './audio.js';

function el(tag, id, parent = document.body) {
  const e = document.createElement(tag);
  if (id) e.id = id;
  parent.appendChild(e);
  return e;
}

const hud = el('div', 'hud');
const promptChip = el('div', 'prompt');
const toasts = el('div', 'toasts');
const dialog = el('div', 'dialog');
const nameTag = el('div', 'dialog-name', dialog);
const dialogText = el('div', 'dialog-text', dialog);
const dialogMore = el('div', 'dialog-more', dialog);
const choicesBox = el('div', 'choices');
const pockets = el('div', 'pockets');
const fadeEl = el('div', 'fade');

dialog.style.display = 'none';
choicesBox.style.display = 'none';
pockets.style.display = 'none';
promptChip.style.display = 'none';
dialogMore.textContent = '▾';

// ------------------------------------------------------------- dialogue ----

let busy = false;          // dialogue open → world input frozen
let closedAt = -1e9;       // when the last dialogue closed (for key debounce)

export function justClosed() {
  return performance.now() - closedAt < 250;
}
let typing = false;
let typeTimer = 0;
let advanceFn = null;      // what E/Space/click should do right now
let chooseFn = null;       // resolves the current choice menu
let choiceEls = [];
let choiceIdx = 0;

export function isBusy() {
  return busy;
}

// onDone: waits for a confirming press (next page / close).
// onComplete: fires the moment the text finishes typing (used for choices).
function typeText(text, voice, { onDone = null, onComplete = null } = {}) {
  typing = true;
  dialogText.textContent = '';
  dialogMore.style.visibility = 'hidden';
  let i = 0;
  clearInterval(typeTimer);

  const finish = () => {
    clearInterval(typeTimer);
    dialogText.textContent = text;
    typing = false;
    if (onComplete) {
      advanceFn = null;
      onComplete();
    } else {
      dialogMore.style.visibility = 'visible';
      advanceFn = onDone;
    }
  };

  typeTimer = setInterval(() => {
    i++;
    dialogText.textContent = text.slice(0, i);
    const ch = text[i - 1];
    if (i % 2 === 0 && ch && /\S/.test(ch)) blip(voice);
    if (i >= text.length) finish();
  }, 24);
  advanceFn = finish; // a press mid-typing skips to the end
}

// say('hi') · say(['page1', 'page2'], {speaker, voice}) — resolves on close.
export function say(pages, { speaker = '', voice = 520 } = {}) {
  const list = (Array.isArray(pages) ? pages : [pages])
    .map((p) => (typeof p === 'string' ? { text: p, speaker, voice } : { speaker, voice, ...p }));
  return new Promise((resolve) => {
    busy = true;
    dialog.style.display = 'block';
    promptChip.style.display = 'none';
    let idx = 0;
    const showPage = () => {
      const page = list[idx];
      nameTag.textContent = page.speaker;
      nameTag.style.display = page.speaker ? 'block' : 'none';
      typeText(page.text, page.voice, { onDone: () => {
        idx++;
        if (idx < list.length) showPage();
        else {
          dialog.style.display = 'none';
          busy = false;
          advanceFn = null;
          closedAt = performance.now();
          resolve();
        }
      } });
    };
    showPage();
  });
}

// ask('text?', [{label, value, disabled, hint}], opts) → chosen value.
// The dialogue box stays open; choices appear once the text finishes typing.
export function ask(text, choices, { speaker = '', voice = 520 } = {}) {
  return new Promise((resolve) => {
    busy = true;
    dialog.style.display = 'block';
    promptChip.style.display = 'none';
    nameTag.textContent = speaker;
    nameTag.style.display = speaker ? 'block' : 'none';
    typeText(text, voice, { onComplete: () => {
      showChoices(choices, (value) => {
        dialog.style.display = 'none';
        busy = false;
        closedAt = performance.now();
        resolve(value);
      });
    } });
  });
}

function showChoices(choices, done) {
  choicesBox.innerHTML = '';
  choiceEls = [];
  choiceIdx = 0;
  choices.forEach((c, i) => {
    const b = el('button', null, choicesBox);
    b.className = 'choice' + (c.disabled ? ' disabled' : '');
    b.innerHTML = `<span>${c.label}</span>${c.hint ? `<span class="hint">${c.hint}</span>` : ''}`;
    if (!c.disabled) {
      b.addEventListener('click', () => pickChoice(i));
    }
    choiceEls.push(b);
  });
  // focus first enabled choice
  choiceIdx = choices.findIndex((c) => !c.disabled);
  if (choiceIdx < 0) choiceIdx = 0;
  updateChoiceFocus();
  choicesBox.style.display = 'flex';
  chooseFn = (i) => {
    if (choices[i]?.disabled) return;
    choicesBox.style.display = 'none';
    chooseFn = null;
    done(choices[i].value);
  };

  function pickChoice(i) {
    chooseFn?.(i);
  }
}

function updateChoiceFocus() {
  choiceEls.forEach((b, i) => b.classList.toggle('focused', i === choiceIdx));
}

function moveChoice(dir) {
  if (!choiceEls.length) return;
  for (let step = 0; step < choiceEls.length; step++) {
    choiceIdx = (choiceIdx + dir + choiceEls.length) % choiceEls.length;
    if (!choiceEls[choiceIdx].classList.contains('disabled')) break;
  }
  updateChoiceFocus();
}

// Dialogue input. interact.js checks isBusy() first, so no double-handling.
addEventListener('keydown', (e) => {
  if (!busy) {
    if (e.code === 'KeyI') togglePockets();
    else if (e.code === 'Escape') pockets.style.display = 'none';
    return;
  }
  if (chooseFn) {
    if (e.code === 'ArrowUp' || e.code === 'KeyW') moveChoice(-1);
    else if (e.code === 'ArrowDown' || e.code === 'KeyS') moveChoice(1);
    else if (e.code === 'KeyE' || e.code === 'Enter' || e.code === 'Space') chooseFn(choiceIdx);
    else if (/^Digit[1-9]$/.test(e.code)) chooseFn(Number(e.code[5]) - 1);
    if (e.code === 'Space') e.preventDefault();
    return;
  }
  if (e.code === 'KeyE' || e.code === 'Space' || e.code === 'Enter') {
    advanceFn?.();
    if (e.code === 'Space') e.preventDefault();
  }
});

dialog.addEventListener('click', () => advanceFn?.());

// --------------------------------------------------------------- prompt ----

export function prompt(text) {
  if (!text || busy) {
    promptChip.style.display = 'none';
  } else {
    promptChip.innerHTML = `<b>E</b> ${text}`;
    promptChip.style.display = 'block';
  }
}

// ---------------------------------------------------------------- toast ----

export function toast(text, emoji = '') {
  const t = el('div', null, toasts);
  t.className = 'toast';
  t.innerHTML = `${emoji ? emoji + ' ' : ''}${text}`;
  setTimeout(() => t.classList.add('show'), 16);
  setTimeout(() => {
    t.classList.remove('show');
    setTimeout(() => t.remove(), 400);
  }, 3400);
}

export function foundItem(id) {
  const it = ITEMS[id];
  if (!it) return;
  toast(`You got a <b>${it.name}</b>! <i>${it.blurb}</i>`, it.emoji);
}

// ------------------------------------------------------------------ HUD ----

export function updateHUD() {
  const tools = Object.entries(state.tools)
    .filter(([, owned]) => owned)
    .map(([t]) => ITEMS[t].emoji)
    .join(' ');
  hud.innerHTML =
    `<span class="chip">🔘 ${state.buttons}</span>` +
    (tools ? `<span class="chip">${tools}</span>` : '') +
    `<span class="chip dim">I — pockets</span>`;
}

// -------------------------------------------------------------- pockets ----

export function togglePockets() {
  if (pockets.style.display === 'none') {
    renderPockets();
    pockets.style.display = 'block';
  } else {
    pockets.style.display = 'none';
  }
}

function renderPockets() {
  const rows = Object.entries(state.inv)
    .map(([id, n]) => ({ it: ITEMS[id], n }))
    .filter(({ it }) => it)
    .map(({ it, n }) =>
      `<div class="row"><span>${it.emoji} ${it.name}</span>` +
      `<span class="dim">×${n}${it.price > 0 ? ` · ${it.price}🔘` : ''}</span></div>`)
    .join('');
  const donated = state.donations.length;
  pockets.innerHTML =
    `<h3>🎒 ${state.name ? state.name + '’s ' : ''}Pockets</h3>` +
    (rows || `<div class="row dim">Empty. The island is full of things…</div>`) +
    `<div class="row total"><span>Buttons</span><span>🔘 ${state.buttons}</span></div>` +
    (donated ? `<div class="row dim"><span>Museum pieces donated</span><span>${donated}</span></div>` : '') +
    `<div class="closehint dim">I or Esc to close</div>`;
}

// ----------------------------------------------------------------- fade ----

// Fade to black, run fn (teleport, lighting swap), fade back in.
export function fadeSwap(fn) {
  return new Promise((resolve) => {
    fadeEl.classList.add('on');
    setTimeout(async () => {
      await fn?.();
      fadeEl.classList.remove('on');
      setTimeout(resolve, 350);
    }, 380);
  });
}

document.addEventListener('notbell-mute', (e) => {
  toast(e.detail ? 'Sound off.' : 'Sound on.', e.detail ? '🔇' : '🔔');
});

// Touch controls: a thumbstick and buttons that speak fluent keyboard.
//
// Robustness by design: instead of teaching every system about touch, the
// stick and buttons dispatch real synthetic KeyboardEvents (KeyW, KeyE,
// ShiftLeft…). Anything that listens for keys — walking, dialogue,
// choices, the map, the almanac, hats, future features nobody has
// invented yet — inherits mobile support without knowing it exists.

const STICK_R = 58;   // the base circle, css px
const DEAD = 0.30;    // thumb wobble the stick politely ignores

export function isTouchDevice() {
  return matchMedia('(pointer: coarse)').matches || 'ontouchstart' in window;
}

function key(code, type) {
  dispatchEvent(new KeyboardEvent(type, { code, key: code, bubbles: true }));
}

export function initControls() {
  if (!isTouchDevice()) return;
  document.body.classList.add('touch');

  const held = new Set();
  const press = (code) => {
    if (held.has(code)) return;
    held.add(code);
    key(code, 'keydown');
  };
  const release = (code) => {
    if (!held.delete(code)) return;
    key(code, 'keyup');
  };
  const setHeld = (codes) => {
    for (const c of [...held]) if (!codes.includes(c)) release(c);
    for (const c of codes) press(c);
  };
  // a backgrounded tab should not keep walking
  addEventListener('visibilitychange', () => { if (document.hidden) setHeld([]); });

  function el(tag, id, parent = document.body) {
    const e = document.createElement(tag);
    e.id = id;
    parent.appendChild(e);
    return e;
  }

  // ------------------------------------------------------- the stick ----
  // invisible on purpose: the lower-left corner simply IS the stick.
  // a whisper of a nub appears under your thumb so you know it heard you.
  // pull gently to walk; pull further to run.
  const stick = el('div', 'stick');
  const nub = el('div', 'stick-nub', stick);

  let stickPointer = null;
  stick.addEventListener('pointerdown', (e) => {
    stickPointer = e.pointerId;
    stick.setPointerCapture(e.pointerId);
    stick.classList.add('live');
    moveStick(e);
    e.preventDefault();
  });
  stick.addEventListener('pointermove', (e) => {
    if (e.pointerId === stickPointer) moveStick(e);
  });
  const endStick = (e) => {
    if (e.pointerId !== stickPointer) return;
    stickPointer = null;
    stick.classList.remove('live');
    nub.style.transform = 'translate(-50%, -50%)';
    setHeld([]);
  };
  stick.addEventListener('pointerup', endStick);
  stick.addEventListener('pointercancel', endStick);

  function moveStick(e) {
    const r = stick.getBoundingClientRect();
    let dx = (e.clientX - (r.left + r.width / 2)) / STICK_R;
    let dy = (e.clientY - (r.top + r.height / 2)) / STICK_R;
    const len = Math.hypot(dx, dy);
    if (len > 1) { dx /= len; dy /= len; }
    nub.style.transform = `translate(calc(-50% + ${dx * STICK_R * 0.55}px), calc(-50% + ${dy * STICK_R * 0.55}px))`;
    const dirs = [];
    if (len > DEAD) {
      if (dy < -0.38) dirs.push('KeyW');
      if (dy > 0.38) dirs.push('KeyS');
      if (dx < -0.38) dirs.push('KeyA');
      if (dx > 0.38) dirs.push('KeyD');
      if (len > 0.8) dirs.push('ShiftLeft'); // a committed pull is a run
    }
    setHeld(dirs);
  }

  // -------------------------------------------------- tap to interact ----
  // no E button: a tap on the world does whatever the prompt offers (talk,
  // enter, reel in, pick up). the browser already suppresses click after a
  // drag, so camera drags stay camera drags — exactly the semantics we want.
  document.querySelector('canvas')?.addEventListener('click', () => {
    key('KeyE', 'keydown');
    key('KeyE', 'keyup');
  });

  // ------------------------------------------------------ the buttons ----
  function tapButton(node, code) {
    node.addEventListener('pointerdown', (e) => {
      key(code, 'keydown');
      key(code, 'keyup');
      e.preventDefault();
    });
  }

  const row = el('div', 'btn-row');
  for (const [label, code, title] of [
    ['🗺️', 'KeyP', 'map'], ['🎒', 'KeyI', 'pockets'],
    ['📖', 'KeyC', 'almanac'], ['🎩', 'KeyH', 'hat'],
  ]) {
    const b = document.createElement('button');
    b.className = 'btn-mini';
    b.textContent = label;
    b.title = title;
    row.appendChild(b);
    tapButton(b, code);
  }
  // settings isn't a key; it gets a real event
  const gear = document.createElement('button');
  gear.className = 'btn-mini';
  gear.textContent = '⚙️';
  gear.title = 'settings';
  row.appendChild(gear);
  gear.addEventListener('pointerdown', (e) => {
    dispatchEvent(new CustomEvent('notbell-settings'));
    e.preventDefault();
  });
}

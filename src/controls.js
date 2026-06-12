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
  const stick = el('div', 'stick');
  const nub = el('div', 'stick-nub', stick);

  let stickPointer = null;
  stick.addEventListener('pointerdown', (e) => {
    stickPointer = e.pointerId;
    stick.setPointerCapture(e.pointerId);
    moveStick(e);
    e.preventDefault();
  });
  stick.addEventListener('pointermove', (e) => {
    if (e.pointerId === stickPointer) moveStick(e);
  });
  const endStick = (e) => {
    if (e.pointerId !== stickPointer) return;
    stickPointer = null;
    nub.style.transform = 'translate(-50%, -50%)';
    setHeld([...held].filter((c) => c === 'ShiftLeft')); // run survives restick
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
    }
    if (held.has('ShiftLeft')) dirs.push('ShiftLeft');
    setHeld(dirs);
  }

  // ------------------------------------------------------ the buttons ----
  function holdButton(node, code) {
    node.addEventListener('pointerdown', (e) => {
      node.setPointerCapture(e.pointerId);
      press(code);
      e.preventDefault();
    });
    const up = () => release(code);
    node.addEventListener('pointerup', up);
    node.addEventListener('pointercancel', up);
  }

  function tapButton(node, code) {
    node.addEventListener('pointerdown', (e) => {
      key(code, 'keydown');
      key(code, 'keyup');
      e.preventDefault();
    });
  }

  const act = el('button', 'btn-act');
  act.textContent = 'E';
  holdButton(act, 'KeyE');

  const run = el('button', 'btn-run');
  run.textContent = '💨';
  // run is a latch: tap to toggle, because thumbs only come in pairs
  let running = false;
  run.addEventListener('pointerdown', (e) => {
    running = !running;
    run.classList.toggle('on', running);
    if (running) press('ShiftLeft');
    else release('ShiftLeft');
    e.preventDefault();
  });

  const row = el('div', 'btn-row');
  for (const [label, code, title] of [
    ['🗺️', 'KeyP', 'map'], ['🎒', 'KeyI', 'pockets'],
    ['📖', 'KeyC', 'almanac'], ['🎩', 'KeyH', 'hat'], ['🔔', 'KeyM', 'sound'],
  ]) {
    const b = document.createElement('button');
    b.className = 'btn-mini';
    b.textContent = label;
    b.title = title;
    row.appendChild(b);
    tapButton(b, code);
  }
}

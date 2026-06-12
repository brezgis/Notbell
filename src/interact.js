// The "walk up and press E" system. Anything interactive — villagers,
// doors, dig spots, tide pools, the water's edge — registers here, and
// each frame the nearest eligible thing gets the prompt.

import * as ui from './ui.js';

const interactables = [];
let best = null;

// spec: {
//   pos: Vector3-ish      — or getPos() for moving targets
//   r: 2.2                — interaction radius
//   label: 'talk to Pip'  — string or () => string, shown in the prompt
//   use()                 — called on E
//   enabled()             — optional gate
//   zone: 'island'        — only active in this zone
//   priority: 1           — higher wins when several are in range
// }
export function register(spec) {
  const it = { r: 2.2, zone: 'island', priority: 1, ...spec };
  interactables.push(it);
  return {
    remove() {
      const i = interactables.indexOf(it);
      if (i >= 0) interactables.splice(i, 1);
    },
  };
}

export function update(playerPos, zone) {
  best = null;
  let bestScore = -Infinity;
  for (const it of interactables) {
    const itZone = typeof it.zone === 'function' ? it.zone() : it.zone;
    if (itZone !== zone) continue;
    if (it.enabled && !it.enabled()) continue;
    const p = it.getPos ? it.getPos() : it.pos;
    const d = Math.hypot(p.x - playerPos.x, p.z - playerPos.z);
    if (d > it.r) continue;
    const score = it.priority * 1000 - d;
    if (score > bestScore) {
      bestScore = score;
      best = it;
    }
  }
  ui.prompt(best ? (typeof best.label === 'function' ? best.label() : best.label) : null);
}

addEventListener('keydown', (e) => {
  if (e.code !== 'KeyE' || e.repeat) return;
  if (ui.isBusy() || ui.justClosed()) return; // dialogue owns this press
  best?.use();
});

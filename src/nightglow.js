// Lit windows. A window stays a real lit surface — it catches the player's
// lantern as you pass, the way the Lantern Room does — and, when the light is
// worth keeping (after dark, or in rain/fog), it warms from within.
//
// No new lights: the glow is the glass's own `emissive`, driven up and down.
// We never swap the material to something unlit, so the player's-light
// reflection is preserved. And it does not pulse — it just glows.

import * as THREE from 'three';
import { isNight } from './calendar.js';
import { currentWeather } from './almanac.js';

const panes = [];

// Tag a window's GLASS mesh. It keeps its MeshStandardMaterial (so it still
// reflects the player's lantern + the scene) — we only own its `emissive` and
// ramp the intensity. Warm tone + level match the Labs window band
// (`island6.js`) and the Lantern Room's warmth.
export function glowWindow(glass, { warm = 0xffe9a0, max = 0.55 } = {}) {
  if (!glass || !glass.material) return glass;
  // own the material so only this pane lights — never paint a shared one
  glass.material = glass.material.clone();
  glass.material.emissive = new THREE.Color(warm);
  glass.material.emissiveIntensity = 0;
  panes.push({ m: glass.material, max });
  return glass;
}

// Steady glow, gated like a lighthouse: clear daylight → off; night / rain /
// snow / fog → on. Lerped so it fades up at dusk instead of snapping. No sine.
export function updateNightGlow(dt) {
  const on = isNight() || currentWeather() !== 'clear';
  const k = Math.min(1, dt * 1.5);
  for (const p of panes) {
    const target = on ? p.max : 0;
    p.m.emissiveIntensity += (target - p.m.emissiveIntensity) * k;
  }
}

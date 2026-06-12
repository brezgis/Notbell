// Fishing: face the water, press E to cast, wait for the dip, press E
// again before the moment passes. Sometimes the sea sends a letter.

import * as THREE from 'three';
import { terrainHeight, WATER_Y } from './terrain.js';
import * as zones from './zones.js';
import { register } from './interact.js';
import * as ui from './ui.js';
import * as S from './state.js';
import { rollFish, BOTTLE_NOTES } from './catalog.js';
import { plop, bite, splash, jingle, sadTrombone } from './audio.js';
import { rand } from './utils.js';
import { CAVE_POND } from './cave.js';
import { isRaining } from './almanac.js';

const BITE_WINDOW = 0.8; // seconds you have to react

export function createFishing(player) {
  const group = new THREE.Group();

  const bobber = new THREE.Group();
  const top = new THREE.Mesh(new THREE.IcosahedronGeometry(0.13, 0),
    new THREE.MeshStandardMaterial({ color: 0xe05a4a, flatShading: true, roughness: 0.5 }));
  const bottom = new THREE.Mesh(new THREE.IcosahedronGeometry(0.11, 0),
    new THREE.MeshStandardMaterial({ color: 0xfffaf0, flatShading: true, roughness: 0.5 }));
  bottom.position.y = -0.12;
  bobber.add(top, bottom);
  bobber.visible = false;
  group.add(bobber);

  let state = 'idle'; // idle | waiting | bite
  let timer = 0;
  let where = 'sea';        // which water the line is in ('sea' | 'cave')
  let surfaceY = WATER_Y;   // resting height of the bobber
  let castFrom = new THREE.Vector3();
  const castSpot = new THREE.Vector3();

  // where the line would land: a few steps ahead of the player, if it's water
  function waterAhead() {
    const ry = player.group.rotation.y;
    const dx = Math.sin(ry), dz = Math.cos(ry);
    for (let d = 2.2; d <= 4.6; d += 0.8) {
      const x = player.group.position.x + dx * d;
      const z = player.group.position.z + dz * d;
      if (zones.current() === 'cave') {
        if (Math.hypot(x - CAVE_POND.x, z - CAVE_POND.z) < CAVE_POND.r - 0.3) {
          return { x, z, where: 'cave', surfaceY: CAVE_POND.surfaceY };
        }
      } else if (terrainHeight(x, z) < WATER_Y - 0.2) {
        return { x, z, where: 'sea', surfaceY: WATER_Y };
      }
    }
    return null;
  }

  function reset() {
    state = 'idle';
    bobber.visible = false;
  }

  async function caught() {
    splash();
    const caughtWhere = where;
    reset();
    // sometimes the sea has mail (the pond keeps no correspondence)
    if (caughtWhere === 'sea' &&
        S.state.bottlesRead < BOTTLE_NOTES.length && Math.random() < 0.18) {
      const note = BOTTLE_NOTES[S.state.bottlesRead];
      S.state.bottlesRead += 1;
      S.addItem('bottle_note');
      S.save();
      jingle();
      ui.toast('A bottle! There’s a letter inside.', '🍾');
      await ui.say([`You fish up a barnacled bottle. Inside: “${note.title}.”`, note.text]);
      return;
    }
    const id = rollFish(caughtWhere);
    S.addItem(id);
    jingle();
    ui.foundItem(id);
    ui.updateHUD();
  }

  // registered in both waters: the open sea, and the cave's still pond
  for (const zone of ['island', 'cave']) {
    register({
      zone,
      getPos: () => player.group.position,
      r: 99,
      priority: 0, // anything else nearby (a villager, a door) wins
      enabled: () => S.state.tools.rod && (state !== 'idle' || !!waterAhead()),
      label: () => (state === 'idle' ? 'cast your line'
        : state === 'bite' ? 'reel it in!' : 'wait for it…'),
      use: () => {
        if (state === 'idle') {
          const spot = waterAhead();
          if (!spot) return;
          where = spot.where;
          surfaceY = spot.surfaceY;
          castSpot.set(spot.x, surfaceY + 0.08, spot.z);
          castFrom.copy(player.group.position);
          bobber.position.copy(castSpot);
          bobber.visible = true;
          plop();
          state = 'waiting';
          // fish bite faster in the rain — everyone knows this, especially fish
          timer = rand(2, 7) * (isRaining() && where === 'sea' ? 0.5 : 1);
        } else if (state === 'waiting') {
          // too eager — the water respects patience
          reset();
          ui.toast('You reeled in too soon. The water keeps its secrets.', '🌊');
        } else if (state === 'bite') {
          caught();
        }
      },
    });
  }

  function update(dt, t) {
    if (state === 'idle') return;

    // walking away abandons the line
    if (castFrom.distanceTo(player.group.position) > 0.35) {
      reset();
      return;
    }

    if (state === 'waiting') {
      bobber.position.y = surfaceY + 0.08 + Math.sin(t * 2.4) * 0.05;
      timer -= dt;
      if (timer <= 0) {
        state = 'bite';
        timer = BITE_WINDOW;
        bobber.position.y = surfaceY - 0.18; // the dip
        bite();
      }
    } else if (state === 'bite') {
      bobber.position.y = surfaceY - 0.18 + Math.sin(t * 18) * 0.06;
      timer -= dt;
      if (timer <= 0) {
        reset();
        sadTrombone();
        ui.toast('It slipped away… you can almost hear tiny laughter.', '💧');
      }
    }
  }

  return { group, update };
}

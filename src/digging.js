// Fossils. The island marks its buried memories with little stars of
// cracked earth; a shovel (Pip sells one) does the rest.

import * as THREE from 'three';
import { terrainHeight, clearOfSites, ISLAND_RADIUS } from './terrain.js';
import { register } from './interact.js';
import * as ui from './ui.js';
import * as S from './state.js';
import { rollTable, FOSSIL_TABLE } from './catalog.js';
import { thud, jingle } from './audio.js';
import { rand } from './utils.js';

const ACTIVE_SPOTS = 4;

function makeStarMark() {
  const g = new THREE.Group();
  const dirt = new THREE.Mesh(
    new THREE.CircleGeometry(0.55, 8),
    new THREE.MeshStandardMaterial({ color: 0x77603f, flatShading: true, roughness: 1 })
  );
  dirt.rotation.x = -Math.PI / 2;
  g.add(dirt);
  // the little star of cracks
  for (let i = 0; i < 4; i++) {
    const crack = new THREE.Mesh(
      new THREE.BoxGeometry(0.74, 0.02, 0.07),
      new THREE.MeshStandardMaterial({ color: 0x5a4730, roughness: 1 })
    );
    crack.rotation.y = (i / 4) * Math.PI;
    crack.position.y = 0.012;
    g.add(crack);
  }
  return g;
}

export function createDigging() {
  const group = new THREE.Group();
  const spots = [];

  function placeSpot(spot) {
    for (let tries = 0; tries < 50; tries++) {
      const a = rand(0, Math.PI * 2);
      const r = Math.sqrt(rand(0, 1)) * (ISLAND_RADIUS - 4);
      const x = Math.cos(a) * r, z = Math.sin(a) * r;
      const h = terrainHeight(x, z);
      if (h < 0.6 || h > 7) continue;
      if (!clearOfSites(x, z, 2)) continue;
      if (spots.some((s) => s !== spot && s.alive && Math.hypot(s.mark.position.x - x, s.mark.position.z - z) < 8)) continue;
      spot.mark.position.set(x, h + 0.04, z);
      spot.alive = true;
      spot.mark.visible = true;
      return;
    }
    spot.alive = false;
    spot.mark.visible = false;
    spot.respawn = 10; // try again soon
  }

  for (let i = 0; i < ACTIVE_SPOTS; i++) {
    const spot = { mark: makeStarMark(), alive: false, respawn: 0 };
    group.add(spot.mark);
    placeSpot(spot);
    spots.push(spot);

    register({
      getPos: () => spot.mark.position,
      r: 1.9,
      enabled: () => spot.alive,
      label: () => (S.state.tools.shovel ? 'dig' : 'something is buried here…'),
      use: () => {
        if (!S.state.tools.shovel) {
          ui.say([
            'The earth here is cracked in a tiny star, like the island is winking at you.',
            'You scrabble at it with your paws. The island appreciates the enthusiasm, but no. You’ll need a shovel — Pip sells one.',
          ]);
          return;
        }
        thud();
        spot.alive = false;
        spot.mark.visible = false;
        spot.respawn = rand(240, 480); // the island makes fossils slower than you spend them
        const id = rollTable(FOSSIL_TABLE);
        S.addItem(id);
        jingle();
        ui.foundItem(id);
        ui.updateHUD();
        if (!S.hasFlag('firstFossil')) {
          S.setFlag('firstFossil');
          ui.say('Fern at the museum would LOVE this. Probably. She loves most things older than her, which is a short list.');
        }
      },
    });
  }

  function update(dt) {
    for (const spot of spots) {
      if (!spot.alive) {
        spot.respawn -= dt;
        if (spot.respawn <= 0) placeSpot(spot);
      }
    }
  }

  return { group, update, spots };
}

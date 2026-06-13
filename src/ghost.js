// Murmur. The island's ghost — older than the bell, gentler than the fog.
// Walls mean nothing to them, schedules mean less, and every so often they
// simply... are nearby. Secretly (not very secretly) friendly.

import * as THREE from 'three';
import * as zones from './zones.js';
import { register } from './interact.js';
import * as ui from './ui.js';
import * as S from './state.js';
import { rand, pick, turnToward } from './utils.js';

const FIRST_MEETING = [
  '…oh. Oh! You can SEE me?',
  'Nobody’s looked right at me since the lighthouse was lit. I’m Murmur. I was here before the bell. I’ll be here after the moss, probably.',
  'Don’t tell everyone. Or do. I’ve honestly forgotten which I prefer.',
];

const MURMUR_LINES = [
  'Boo. (Sorry. Tradition. There’s paperwork.)',
  'I was here before the bell, you know. The quiet ones remember me. Fern pretends not to. It’s a little game we play. She’s very good at it.',
  'The lighthouse hook — I’m the one who polishes it. Someone should. Some things ought to stay ready.',
  'Walls are a rumor. A very confident rumor.',
  'The glow worms wave at me. Don’t let anyone tell you worms aren’t polite.',
  'I tried haunting the Buttonwagon once. It was already perfect. Nothing for me to add.',
];

const FIRST_VISIT_DELAY = [180, 360];
const BETWEEN_VISIT_DELAY = [600, 1200];
const APPROACH_STAY = [35, 70];
const DRIFT_BY_STAY = [20, 40];
const APPROACH_CHANCE = 0.25;

export function createGhost(player) {
  const group = new THREE.Group();

  const ghost = new THREE.Group();
  const sheetMat = new THREE.MeshStandardMaterial({
    color: 0xdfe8f0, transparent: true, opacity: 0, roughness: 0.9, flatShading: true,
    emissive: 0x9fb8d8, emissiveIntensity: 0.25, depthWrite: false,
  });
  const head = new THREE.Mesh(new THREE.IcosahedronGeometry(0.5, 1), sheetMat);
  head.position.y = 1.5;
  head.scale.y = 1.15;
  ghost.add(head);
  // the wavy hem: a little skirt of cones
  for (let i = 0; i < 6; i++) {
    const a = (i / 6) * Math.PI * 2;
    const fold = new THREE.Mesh(new THREE.ConeGeometry(0.2, 0.5, 4), sheetMat);
    fold.position.set(Math.cos(a) * 0.3, 0.85, Math.sin(a) * 0.3);
    fold.rotation.x = Math.PI;
    ghost.add(fold);
  }
  const eyeMat = new THREE.MeshBasicMaterial({ color: 0x2e3640, transparent: true, opacity: 0 });
  for (const sx of [-1, 1]) {
    const eye = new THREE.Mesh(new THREE.IcosahedronGeometry(0.07, 0), eyeMat);
    eye.position.set(sx * 0.17, 1.6, 0.42);
    ghost.add(eye);
  }
  ghost.visible = false;
  group.add(ghost);

  let state = 'away';   // away | fadingIn | here | fadingOut
  let timer = rand(...FIRST_VISIT_DELAY); // first visit comes when it comes
  let fade = 0;
  let lineIdx = 0;
  let drift = rand(0, Math.PI * 2);
  let willApproach = false;

  function setOpacity(k) {
    sheetMat.opacity = 0.55 * k;
    eyeMat.opacity = 0.9 * k;
  }

  register({
    getPos: () => ghost.position,
    r: 3,
    zone: () => zones.current(), // wherever you are, that's where they haunt
    enabled: () => state === 'here',
    label: () => (S.hasFlag('metMurmur') ? 'talk to Murmur' : 'approach the… presence?'),
    use: () => {
      if (!S.hasFlag('metMurmur')) {
        S.setFlag('metMurmur');
        ui.say(FIRST_MEETING, { speaker: 'Murmur', voice: 880 });
        return;
      }
      ui.say(MURMUR_LINES[lineIdx++ % MURMUR_LINES.length], { speaker: 'Murmur', voice: 880 });
    },
  });

  function update(dt, t, playerPos) {
    if (state === 'away') {
      timer -= dt;
      if (timer <= 0) {
        state = 'fadingIn';
        fade = 0;
        willApproach = rand(0, 1) < APPROACH_CHANCE;
        const a = rand(0, Math.PI * 2);
        const r = rand(7, 12);
        ghost.position.set(playerPos.x + Math.cos(a) * r, playerPos.y, playerPos.z + Math.sin(a) * r);
        ghost.visible = true;
      }
      return;
    }
    // hover and drift — terrain, walls, and furniture are other people's problems
    drift += dt * 0.3;
    ghost.position.x += Math.cos(drift) * dt * 0.5;
    ghost.position.z += Math.sin(drift * 0.8) * dt * 0.5;
    ghost.position.y += ((playerPos.y + 0.25 + Math.sin(t * 1.1) * 0.2) - ghost.position.y) * Math.min(1, dt * 2);
    const dx = playerPos.x - ghost.position.x;
    const dz = playerPos.z - ghost.position.z;
    ghost.rotation.y = turnToward(ghost.rotation.y, Math.atan2(dx, dz), dt, 2);

    if (state === 'fadingIn') {
      fade += dt;
      setOpacity(Math.min(1, fade / 2));
      if (fade >= 2) {
        state = 'here';
        timer = rand(...(willApproach ? APPROACH_STAY : DRIFT_BY_STAY)); // how long they stay
      }
    } else if (state === 'here') {
      timer -= dt;
      // Most visits are just a passing haunt; only a few drift over to visit.
      if (willApproach && Math.hypot(dx, dz) > 4) {
        ghost.position.x += dx * dt * 0.04;
        ghost.position.z += dz * dt * 0.04;
      }
      if (timer <= 0 && !ui.isBusy()) {
        state = 'fadingOut';
        fade = 2;
      }
    } else if (state === 'fadingOut') {
      fade -= dt;
      setOpacity(Math.max(0, fade / 2));
      if (fade <= 0) {
        state = 'away';
        ghost.visible = false;
        timer = rand(...BETWEEN_VISIT_DELAY); // until next time
      }
    }
  }

  return { group, update };
}

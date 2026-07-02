import * as THREE from 'three';
import { terrainHeight, PLAYER_SPAWN, WATER_Y } from './terrain.js';
import { buildAnimal, animateGait } from './animals.js';
import { turnToward } from './utils.js';
import * as zones from './zones.js';
import * as ui from './ui.js';
import { coffeeActive, countItem, state, setFlag, hasFlag } from './state.js';
import { applyHat } from './hats.js';
import { plop } from './audio.js';

const WALK_SPEED = 4.6;
const RUN_SPEED = 8.2;
const COFFEE_MULT = 1.35; // Luna's Lantern Roast is not decaf
const SWIM_MULT = 0.55;   // the sea charges a convenience fee

// the bell-shaped brass helmet of Tansy's salvage divers
function buildHelmet() {
  const brass = new THREE.MeshStandardMaterial({ color: 0xc9962e, flatShading: true, roughness: 0.45 });
  const h = new THREE.Group();
  const bell = new THREE.Mesh(new THREE.CylinderGeometry(0.46, 0.56, 0.6, 9), brass);
  h.add(bell);
  const dome = new THREE.Mesh(new THREE.IcosahedronGeometry(0.46, 1), brass);
  dome.scale.y = 0.65;
  dome.position.y = 0.3;
  h.add(dome);
  const ring = new THREE.Mesh(new THREE.TorusGeometry(0.2, 0.045, 6, 12), brass);
  ring.position.set(0, 0.06, 0.45);
  h.add(ring);
  const glass = new THREE.Mesh(new THREE.CircleGeometry(0.19, 12),
    new THREE.MeshStandardMaterial({
      color: 0xbfe6f2, transparent: true, opacity: 0.45,
      roughness: 0.2, flatShading: true, side: THREE.DoubleSide,
    }));
  glass.position.set(0, 0.06, 0.46);
  h.add(glass);
  const knob = new THREE.Mesh(new THREE.TorusGeometry(0.08, 0.03, 6, 10), brass);
  knob.rotation.x = Math.PI / 2;
  knob.position.y = 0.62;
  h.add(knob);
  h.traverse((o) => { if (o.isMesh) o.castShadow = true; });
  return h;
}

// the bubble helmet: a fishbowl with delusions and three patents.
// your hat fits under it. they checked. they checked WITH HATS.
function buildBubble() {
  const b = new THREE.Group();
  const glass = new THREE.Mesh(new THREE.IcosahedronGeometry(0.58, 1),
    new THREE.MeshStandardMaterial({
      color: 0xcfe8f2, transparent: true, opacity: 0.18,
      roughness: 0.1, flatShading: true, side: THREE.DoubleSide, depthWrite: false,
    }));
  glass.position.y = 0.06;
  b.add(glass);
  const collar = new THREE.Mesh(new THREE.TorusGeometry(0.42, 0.07, 6, 12),
    new THREE.MeshStandardMaterial({ color: 0xc9962e, flatShading: true, roughness: 0.45 }));
  collar.rotation.x = Math.PI / 2;
  collar.position.y = -0.4;
  collar.castShadow = true;
  b.add(collar);
  return b;
}

// the hero carries a little of her own light: a gentle self-emissive so no
// facet ever goes fully dark. Those "shadows" on the front/lower body were
// never shadow maps — just faces the sun wasn't talking to. Now the player
// reads from every side, and the facets still facet.
function warmUp(g) {
  g.traverse((o) => {
    if (o.isMesh && !o.material.transparent && o.material.emissive) {
      o.material.emissive.copy(o.material.color);
      o.material.emissiveIntensity = 0.16;
    }
  });
}

export function createPlayer() {
  const avatar = state.avatar || { kind: 'cat', body: 0xf0c98f };
  const group = buildAnimal(avatar.kind, { body: avatar.body });
  warmUp(group);

  group.position.set(
    PLAYER_SPAWN.x,
    terrainHeight(PLAYER_SPAWN.x, PLAYER_SPAWN.z),
    PLAYER_SPAWN.z
  );
  group.rotation.y = Math.PI; // wake up facing the village

  // a faint personal glow — invisible under the sun, a small mercy in the cave
  const lantern = new THREE.PointLight(0xffd9a0, 8, 7, 2);
  lantern.position.y = 1.6;
  group.add(lantern);

  const keys = new Set();
  addEventListener('keydown', (e) => {
    keys.add(e.code);
    if (e.code.startsWith('Arrow')) e.preventDefault();
  });
  addEventListener('keyup', (e) => keys.delete(e.code));
  addEventListener('blur', () => keys.clear());

  let walk = 0;
  let helmet = null;
  let helmetOn = false;
  let bubble = null;
  let bubbleOn = false;
  let wasSwimming = false;

  // ducks were born for this; everyone else needs the diver's suit
  function canSwim() {
    return state.avatar?.kind === 'duck' || countItem('scuba_suit') > 0;
  }

  function swimWater(x, z) {
    return zones.current() === 'island' &&
      terrainHeight(x, z) <= WATER_Y + 0.12 &&
      Math.hypot(x - 40, z - 40) < 220; // the archipelago's waters end somewhere
  }

  function passable(x, z) {
    return zones.canWalk(x, z) || (canSwim() && swimWater(x, z));
  }

  function update(dt, t, camYaw = 0) {
    if (self.riding) {       // the train drives; you admire the strait
      animateGait(group, t, 0, 10);
      return;
    }
    // swimming = standing somewhere only the sea would let you stand
    const swimming = zones.current() === 'island' &&
      zones.groundHeight(group.position.x, group.position.z) <= WATER_Y + 0.12;

    let x = 0, z = 0, running = false;
    if (!ui.isBusy()) { // conversations deserve your feet's full attention
      x = (keys.has('KeyD') || keys.has('ArrowRight') ? 1 : 0) - (keys.has('KeyA') || keys.has('ArrowLeft') ? 1 : 0);
      z = (keys.has('KeyS') || keys.has('ArrowDown') ? 1 : 0) - (keys.has('KeyW') || keys.has('ArrowUp') ? 1 : 0);
      running = keys.has('ShiftLeft') || keys.has('ShiftRight');
    }
    const moving = x !== 0 || z !== 0;

    if (moving) {
      // keys follow the camera: W is always "away from you", wherever you look
      const cy = Math.cos(camYaw), sy = Math.sin(camYaw);
      const rx = x * cy + z * sy;
      const rz = z * cy - x * sy;
      x = rx;
      z = rz;
      const len = Math.hypot(x, z);
      x /= len;
      z /= len;
      let speed = running ? RUN_SPEED : WALK_SPEED;
      if (coffeeActive()) speed *= COFFEE_MULT;
      if (swimming) speed *= SWIM_MULT;
      const nx = group.position.x + x * speed * dt;
      const nz = group.position.z + z * speed * dt;

      // slide along walls and shorelines instead of stopping dead
      if (passable(nx, nz)) {
        group.position.x = nx;
        group.position.z = nz;
      } else if (passable(nx, group.position.z)) {
        group.position.x = nx;
      } else if (passable(group.position.x, nz)) {
        group.position.z = nz;
      }

      group.rotation.y = turnToward(group.rotation.y, Math.atan2(x, z), dt, 14);
    }

    const onMoon = zones.current() === 'moon';
    if (swimming) {
      group.position.y = WATER_Y - 0.28 + Math.sin(t * 2.1) * 0.05;
      walk += ((moving ? 0.4 : 0.15) - walk) * Math.min(1, dt * 6);
      animateGait(group, t, walk, 6); // a lazy paddle
    } else {
      group.position.y = zones.groundHeight(group.position.x, group.position.z);
      walk += ((moving ? 1 : 0) - walk) * Math.min(1, dt * 10);
      if (onMoon) {
        // a sixth of the gravity, six times the joy
        group.position.y += Math.abs(Math.sin(t * 4.2)) * 0.24 * walk;
        animateGait(group, t, walk, 7);
      } else {
        animateGait(group, t, walk, running || coffeeActive() ? 14 : 10);
      }
    }

    // the bubble helmet is not optional. Dr. Hazel was very clear.
    if (onMoon !== bubbleOn) {
      bubbleOn = onMoon;
      if (!bubble) bubble = buildBubble();
      const head = group.userData.parts.head;
      if (bubbleOn) head.add(bubble);
      else bubble.parent?.remove(bubble);
    }

    if (swimming !== wasSwimming) {
      wasSwimming = swimming;
      if (swimming) {
        plop();
        if (!hasFlag('firstSwim')) {
          setFlag('firstSwim');
          ui.toast(state.avatar?.kind === 'duck'
            ? 'You take to the water like the duck you are.'
            : 'The helmet seals with a polite clonk. The sea lets you in.', '🌊');
        }
      }
    }

    // the diver's helmet appears when (and only when) it's earning its keep
    const wantHelmet = swimming && state.avatar?.kind !== 'duck' && countItem('scuba_suit') > 0;
    if (wantHelmet !== helmetOn) {
      helmetOn = wantHelmet;
      if (!helmet) helmet = buildHelmet();
      const head = group.userData.parts.head;
      if (helmetOn) {
        head.add(helmet);
        if (group.userData.hatMesh) group.userData.hatMesh.visible = false;
      } else {
        helmet.parent?.remove(helmet);
        if (group.userData.hatMesh) group.userData.hatMesh.visible = true;
      }
    }
  }

  function swapBody(kind, bodyColor) {
    const fresh = buildAnimal(kind, { body: bodyColor });
    warmUp(fresh); // every body arrives pre-warmed
    // keep the group (everyone holds a reference to it), swap the animal
    for (const child of [...group.children]) {
      if (child !== lantern) group.remove(child);
    }
    while (fresh.children.length) group.add(fresh.children[0]);
    group.userData.parts = fresh.userData.parts;
    group.userData.hatMesh = null;
    helmetOn = false; // the old head took the helmet with it
    bubbleOn = false; // and the bubble
    applyHat(group, state.wearing);
  }

  const self = { group, update, swapBody, riding: false };
  return self;
}

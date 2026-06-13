import * as THREE from 'three';
import { createTerrain, terrainHeight, SITES, ISLAND2 } from './terrain.js';
import { createOcean } from './ocean.js';
import { createSky } from './sky.js';
import { scatterNature } from './nature.js';
import { createAnimals } from './animals.js';
import { createPlayer } from './player.js';
import { createBuildings } from './buildings.js';
import { createCave } from './cave.js';
import { createFishing } from './fishing.js';
import { createDigging } from './digging.js';
import { createTidePools } from './tidepools.js';
import { nameVillagers } from './villagers.js';
import { createHouses } from './houses.js';
import { createBridge } from './bridge.js';
import { createIsland2 } from './island2.js';
import { createAmbient } from './ambient.js';
import { createOceanLife } from './oceanlife.js';
import { createBoats } from './boats.js';
import { createVolcano } from './volcano.js';
import { createIsland3 } from './island3.js';
import { createTexas } from './texas.js';
import { createGhost } from './ghost.js';
import { createBeachBall } from './beachball.js';
import { createBulko } from './bulko.js';
import { createNorthline } from './northline.js';
import { createIsland5 } from './island5.js';
import { createIsland6 } from './island6.js';
import { createMoon } from './moon.js';
import { wireHatKey } from './hats.js';
import { initFieldGuide, markVisited } from './fieldguide.js';
import { createMultiplayer } from './multiplayer.js';
import { initControls, isTouchDevice } from './controls.js';
import { initSettings } from './settings.js';
import { setMood } from './audio.js';
import { HOLIDAY, isNight } from './calendar.js';
import { currentWeather } from './almanac.js';
import * as almanac from './almanac.js';
import * as zones from './zones.js';
import * as interact from './interact.js';
import * as ui from './ui.js';
import * as S from './state.js';

S.load(); // the island remembers

const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setSize(innerWidth, innerHeight);
// capped below native retina: visually near-identical, dramatically cheaper
// (phones get a slightly lower cap; their pixels are small and their
// batteries have feelings)
renderer.setPixelRatio(Math.min(devicePixelRatio, isTouchDevice() ? 1.25 : 1.5));
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFShadowMap;
document.body.appendChild(renderer.domElement);

const scene = new THREE.Scene();
scene.background = new THREE.Color(0x9fdcf7);
scene.fog = new THREE.Fog(0x9fdcf7, 95, 230);

const camera = new THREE.PerspectiveCamera(50, innerWidth / innerHeight, 0.1, 600);

// bright cartoon noon: warm sun + cool sky fill
const hemi = new THREE.HemisphereLight(0xcfeeff, 0x7ca16a, 1.3);
scene.add(hemi);

const sun = new THREE.DirectionalLight(0xfff3d6, 2.4);
sun.position.set(45, 70, 30);
sun.castShadow = true;
sun.shadow.mapSize.set(1024, 1024);
sun.shadow.camera.left = -65;
sun.shadow.camera.right = 65;
sun.shadow.camera.top = 65;
sun.shadow.camera.bottom = -65;
sun.shadow.camera.near = 20;
sun.shadow.camera.far = 180;
sun.shadow.bias = -0.0005;
sun.shadow.normalBias = 0.4;
scene.add(sun, sun.target);

// AC-style high camera that trails the player — now steerable: drag the
// mouse to orbit, scroll to lean in or out
let camYaw = 0;
let camPitch = 0.70;
let camDist = 20.3;
const camOffset = new THREE.Vector3();
const camGoal = new THREE.Vector3();
const lookGoal = new THREE.Vector3();

function refreshCamOffset() {
  const hr = camDist * Math.cos(camPitch);
  camOffset.set(Math.sin(camYaw) * hr, camDist * Math.sin(camPitch), Math.cos(camYaw) * hr);
}
refreshCamOffset();

// one finger (or the mouse) orbits; two fingers pinch the distance
let dragging = false;
const touchPoints = new Map(); // pointerId -> {x, y}
let pinchDist = 0;

function setZoom(d) {
  camDist = Math.min(30, Math.max(9, d));
  refreshCamOffset();
}

renderer.domElement.addEventListener('pointerdown', (e) => {
  touchPoints.set(e.pointerId, { x: e.clientX, y: e.clientY });
  if (touchPoints.size === 2) {
    dragging = false;
    const [a, b] = [...touchPoints.values()];
    pinchDist = Math.hypot(a.x - b.x, a.y - b.y);
  } else if (e.button === 0) {
    dragging = true;
  }
});
const endPointer = (e) => {
  touchPoints.delete(e.pointerId);
  if (!touchPoints.size) dragging = false;
};
addEventListener('pointerup', endPointer);
addEventListener('pointercancel', endPointer);
addEventListener('pointermove', (e) => {
  const p = touchPoints.get(e.pointerId);
  if (p) {
    p.x = e.clientX;
    p.y = e.clientY;
  }
  if (touchPoints.size === 2) {
    const [a, b] = [...touchPoints.values()];
    const d = Math.hypot(a.x - b.x, a.y - b.y);
    if (pinchDist) setZoom(camDist - (d - pinchDist) * 0.05);
    pinchDist = d;
    return;
  }
  if (!dragging) return;
  camYaw -= e.movementX * 0.005;
  camPitch = Math.min(1.3, Math.max(0.18, camPitch + e.movementY * 0.004));
  refreshCamOffset();
});
addEventListener('wheel', (e) => {
  setZoom(camDist + e.deltaY * 0.02);
}, { passive: true });

const player = createPlayer();

zones.init({
  scene, hemi, sun, player,
  snapCamera: () => {
    camera.position.copy(player.group.position).add(camOffset);
    lookGoal.copy(player.group.position);
    lookGoal.y += 1.2;
    camera.lookAt(lookGoal);
  },
});

scene.add(createTerrain());
const buildings = createBuildings(); // registers interiors + blockers first
const cave = createCave();
const ocean = createOcean();
const sky = createSky();
const nature = scatterNature();
const animals = createAnimals();
nameVillagers(animals.animals);
const island3 = createIsland3(); // before houses: Crumb sleeps on the MouseBoat
const texas = createTexas();
const houses = createHouses(animals.animals, nature.obstacles);
const bridge = createBridge(player, animals.animals);
const island2 = createIsland2();
const ambient = createAmbient(animals.animals, scene);
const oceanLife = createOceanLife();
const bulko = createBulko(player); // before boats: the ferry needs the dock
const island6 = createIsland6(player); // ditto — the Persistent calls at the Labs
const moon = createMoon(player); // 384,000 km up and to the right
const boats = createBoats(player);
const island5 = createIsland5(player);
const northline = createNorthline(player);
const volcano = createVolcano();
const ghost = createGhost(player);
const beachBall = createBeachBall(player);
const fishing = createFishing(player);
const digging = createDigging();
const tidePools = createTidePools();
wireHatKey(player.group);
initFieldGuide(player);
initControls(); // thumbsticks for the touch-blessed; a no-op for everyone else
initSettings(); // the quiet panel behind the title chip
const multiplayer = createMultiplayer(player, scene);
almanac.init({ scene, hemi, sun, playerGroup: player.group });

scene.add(
  ocean.group, sky.group, nature.group, animals.group, player.group,
  buildings.group, cave.group, fishing.group, digging.group, tidePools.group,
  houses.group, bridge.group, island2.group, oceanLife.group,
  boats.group, volcano.group, island3.group, ghost.group, beachBall.group, texas.group, bulko.group,
  island5.group, northline.group, island6.group, moon.group
);

camera.position.copy(player.group.position).add(camOffset);
ui.updateHUD();

// ---- dynamic wall fading: anything wall-sized between you and the camera
// turns politely translucent (and recovers the instant it isn't)
const occluders = [];
scene.traverse((o) => {
  if (!o.isMesh || o.geometry?.type !== 'BoxGeometry') return;
  if (o.material?.transparent || o.material?.opacity < 1) return;
  const g = o.geometry.parameters;
  if (g.height >= 2.2 && Math.max(g.width, g.depth) * g.height >= 12) {
    occluders.push(o);
  }
});
const occRay = new THREE.Raycaster();
const occDir = new THREE.Vector3();
const occTarget = new THREE.Vector3();
const fadedWalls = new Set();
const nowFaded = new Set();

function updateOcclusion() {
  occTarget.copy(player.group.position);
  occTarget.y += 1.0;
  occDir.copy(occTarget).sub(camera.position);
  const dist = occDir.length();
  occDir.normalize();
  occRay.set(camera.position, occDir);
  occRay.far = dist - 0.6;
  nowFaded.clear();
  for (const hit of occRay.intersectObjects(occluders, false)) {
    nowFaded.add(hit.object);
  }
  for (const m of nowFaded) {
    if (!fadedWalls.has(m)) {
      if (!m.userData._occ) {
        m.userData._occ = {
          t: m.material.transparent, o: m.material.opacity, dw: m.material.depthWrite,
        };
      }
      m.material.transparent = true;
      m.material.opacity = 0.28;
      m.material.depthWrite = false;
    }
  }
  for (const m of fadedWalls) {
    if (!nowFaded.has(m)) {
      const old = m.userData._occ;
      m.material.transparent = old.t;
      m.material.opacity = old.o;
      m.material.depthWrite = old.dw;
    }
  }
  fadedWalls.clear();
  for (const m of nowFaded) fadedWalls.add(m);
}

addEventListener('resize', () => {
  camera.aspect = innerWidth / innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(innerWidth, innerHeight);
});

const clock = new THREE.Clock();
let moodT = 0;
let whereT = 6;

// pick up exactly where you left off — spot, zone, camera and all
if (S.state.where && S.state.where.zone !== 'sea') {
  const w = S.state.where;
  camYaw = w.camYaw ?? camYaw;
  camPitch = w.camPitch ?? camPitch;
  camDist = w.camDist ?? camDist;
  refreshCamOffset();
  zones.go(w.zone, { x: w.x, z: w.z, rotY: w.rotY }).catch(() => {});
}

addEventListener('beforeunload', () => {
  S.state.where = {
    zone: zones.current(),
    x: player.group.position.x, z: player.group.position.z,
    rotY: player.group.rotation.y, camYaw, camPitch, camDist,
  };
  S.saveNow();
});

renderer.setAnimationLoop(() => {
  const dt = Math.min(clock.getDelta(), 0.05);
  const t = clock.elapsedTime;
  const playerPos = player.group.position;

  const zone = zones.current();
  const outdoors = zone === 'island' || zone === 'sea';

  player.update(dt, t, camYaw);
  animals.update(dt, t, playerPos);
  if (outdoors) {
    // the open world only spends effort when you can see it
    ocean.update(t);
    sky.update(dt);
    nature.update(dt, t, playerPos);
    oceanLife.update(dt, t, playerPos);
    boats.update(dt, t, playerPos);
    volcano.update(dt, t);
    bridge.update(dt, t);
    digging.update(dt);
    tidePools.update(dt, t);
    beachBall.update(dt, t, playerPos);
    texas.update(dt, t, playerPos);
    island5.update(dt, t, playerPos);
    northline.update(dt, t);
  }
  bulko.update(dt, t, playerPos);
  island6.update(dt, t, playerPos); // gates itself by zone (labs life is indoors too)
  if (zone === 'moon') moon.update(dt, t, playerPos);
  if (zone === 'cave') cave.update(dt, t);
  ghost.update(dt, t, playerPos); // walls are a rumor
  buildings.update(dt, t, playerPos);
  houses.update(dt, t, playerPos);
  island2.update(dt, t, playerPos);
  island3.update(dt, t, playerPos);
  ambient.update(dt, playerPos);
  fishing.update(dt, t);
  almanac.update(dt);
  multiplayer.update(dt);
  interact.update(playerPos, zone);

  // the soundtrack follows you around
  moodT -= dt;
  if (moodT <= 0) {
    moodT = 1.5;
    const MOODS = {
      cafe: 'cafe', cave: 'cave', church: 'church', museum: 'museum',
      shop: 'shop', grocery: 'shop', bulko: 'bulko', manor: 'manor',
      manor_up: 'manor', cellar: 'cave', moon: 'night', labs: 'shop',
    };
    setMood(MOODS[zone] ?? (zone === 'island' || zone === 'sea'
      ? (HOLIDAY ? 'holiday' : currentWeather() !== 'clear' ? 'rain' : isNight() ? 'night' : 'day')
      : 'indoors'));
  }

  // remember where you are, so refreshing isn't a teleport home
  whereT -= dt;
  if (whereT <= 0) {
    whereT = 2.5;
    markVisited(player, zone); // new shores ink themselves onto the chart
    S.state.where = {
      zone, x: playerPos.x, z: playerPos.z, rotY: player.group.rotation.y,
      camYaw, camPitch, camDist,
    };
    S.save();
  }

  camGoal.copy(playerPos).add(camOffset);
  camera.position.lerp(camGoal, 1 - Math.exp(-dt * 4));
  lookGoal.copy(playerPos);
  lookGoal.y += 1.2;
  camera.lookAt(lookGoal);
  updateOcclusion();

  renderer.render(scene, camera);
});

document.getElementById('loading')?.remove();

// debug/testing hook (used by shots/shoot.js)
window.__notbell = { zones, player, S, SITES, ISLAND2, terrainHeight, digging, almanac, houses, ambient, animals, fishing };

// a small welcome the first time — and everyone gets to choose who they are
(async () => {
  if (!S.hasFlag('woke')) {
    S.setFlag('woke');
    await ui.say([
      'You wake up on Notbell Island — heart of the Notbell Archipelago, home of a real economy and famously no bell.',
      'The villagers are friendly. The magpie who runs the shop has something for you. And the islands, if you bring them enough small treasures, have a story to tell.',
    ]);
  }
  if (!S.state.avatar) {
    const kind = await ui.ask('And who, exactly, woke up this morning?', [
      { label: '🐱 A sandy cat', value: 'cat' },
      { label: '🐰 A cream rabbit', value: 'rabbit' },
      { label: '🦊 A marmalade fox', value: 'fox' },
      { label: '🦆 A snowy duck', value: 'duck' },
    ]);
    const colors = { cat: 0xf0c98f, rabbit: 0xf5e6c8, fox: 0xe88a3a, duck: 0xf5f2e9 };
    S.state.avatar = { kind: kind || 'cat', body: colors[kind] || 0xf0c98f };
    S.save();
    player.swapBody(S.state.avatar.kind, S.state.avatar.body);
  }
  if (!S.state.name) {
    const raw = window.prompt('And what do the islanders call you?', '');
    S.state.name = (raw || 'Sandy').trim().slice(0, 16) || 'Sandy';
    S.save();
    ui.updateHUD();
    ui.toast(`Welcome home, <b>${S.state.name}</b>. The tide pools already knew, somehow.`, '✨');
  }
})();

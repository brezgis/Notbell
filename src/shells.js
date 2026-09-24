// Beachcombing. The tide works a slow shift: every so often a wave leaves
// something on whichever beach you happen to be near — a cowrie, a scallop,
// a sand dollar, sea glass, and now and then a whole conch. Pick them up
// (they sell, modestly) or leave them for the next person; the tide takes
// back what nobody wanted, eventually.

import * as THREE from 'three';
import { terrainHeight, WATER_Y } from './terrain.js';
import * as zones from './zones.js';
import { register } from './interact.js';
import * as ui from './ui.js';
import * as S from './state.js';
import { ITEMS } from './catalog.js';
import { jingle } from './audio.js';

function mat(color, rough = 0.5) {
  return new THREE.MeshStandardMaterial({ color, flatShading: true, roughness: rough });
}

const KINDS = [
  { id: 'cowrie', w: 34 },
  { id: 'scallop', w: 30 },
  { id: 'sand_dollar', w: 16 },
  { id: 'sea_glass', w: 14 },
  { id: 'conch', w: 6 },
];

function makeShell(id) {
  const g = new THREE.Group();
  if (id === 'cowrie') {
    const m = new THREE.Mesh(new THREE.IcosahedronGeometry(0.13, 0), mat(0xf2dcc4, 0.3));
    m.scale.set(0.8, 0.55, 1.2);
    g.add(m);
    const lip = new THREE.Mesh(new THREE.BoxGeometry(0.03, 0.02, 0.22), mat(0x8a5a3a));
    lip.position.y = -0.05;
    g.add(lip);
  } else if (id === 'scallop') {
    const m = new THREE.Mesh(new THREE.ConeGeometry(0.18, 0.06, 7, 1, false, 0, Math.PI), mat(0xf7b8a0, 0.5));
    m.rotation.x = Math.PI / 2;
    g.add(m);
  } else if (id === 'sand_dollar') {
    const m = new THREE.Mesh(new THREE.CylinderGeometry(0.16, 0.16, 0.03, 10), mat(0xeee4cf, 0.8));
    g.add(m);
    for (let i = 0; i < 5; i++) {
      const petal = new THREE.Mesh(new THREE.BoxGeometry(0.02, 0.01, 0.07), mat(0xc9b99a));
      const a = (i / 5) * Math.PI * 2;
      petal.position.set(Math.sin(a) * 0.06, 0.02, Math.cos(a) * 0.06);
      petal.rotation.y = a;
      g.add(petal);
    }
  } else if (id === 'sea_glass') {
    const m = new THREE.Mesh(new THREE.IcosahedronGeometry(0.09, 0),
      new THREE.MeshStandardMaterial({ color: [0x7fd6c2, 0x9fc7e8, 0xb6e39a][Math.floor(Math.random() * 3)], roughness: 0.2, transparent: true, opacity: 0.8, flatShading: true }));
    m.scale.y = 0.5;
    g.add(m);
  } else { // conch
    const m = new THREE.Mesh(new THREE.ConeGeometry(0.14, 0.36, 7), mat(0xf5d7c0, 0.4));
    m.rotation.z = Math.PI / 2;
    g.add(m);
    const flare = new THREE.Mesh(new THREE.IcosahedronGeometry(0.12, 0), mat(0xf7a8a0, 0.4));
    flare.position.x = -0.13;
    flare.scale.set(0.7, 1, 1.2);
    g.add(flare);
  }
  g.traverse((o) => { if (o.isMesh) o.castShadow = true; });
  return g;
}

function rollKind() {
  let r = Math.random() * KINDS.reduce((s, k) => s + k.w, 0);
  for (const k of KINDS) { r -= k.w; if (r <= 0) return k.id; }
  return 'cowrie';
}

export function createShells() {
  const group = new THREE.Group();
  const live = []; // { id, g, age, foam, handle }
  let nextT = 12;

  // a wet strip of sand near the player, with open sea just beyond
  function beachSpotNear(p) {
    for (let k = 0; k < 30; k++) {
      const a = Math.random() * Math.PI * 2, r = 6 + Math.random() * 22;
      const x = p.x + Math.cos(a) * r, z = p.z + Math.sin(a) * r;
      const h = terrainHeight(x, z);
      if (h < WATER_Y + 0.2 || h > 0.25) continue;
      if (!zones.islandCanWalk(x, z) || zones.solidAt(x, z)) continue;
      // which way is the sea? step around until we find water
      for (let q = 0; q < 8; q++) {
        const qa = (q / 8) * Math.PI * 2;
        if (terrainHeight(x + Math.sin(qa) * 2, z + Math.cos(qa) * 2) < WATER_Y - 0.1) {
          return { x, z, h, sea: qa };
        }
      }
    }
    return null;
  }

  function wash(p) {
    const spot = beachSpotNear(p);
    if (!spot) return;
    const id = rollKind();
    const g = makeShell(id);
    g.rotation.y = Math.random() * Math.PI * 2;
    group.add(g);
    // a little crescent of foam that fades as the wave draws back
    const foam = new THREE.Mesh(new THREE.RingGeometry(0.25, 0.5, 10, 1, 0, Math.PI),
      new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.7, depthWrite: false }));
    foam.rotation.x = -Math.PI / 2;
    foam.rotation.z = -spot.sea + Math.PI / 2;
    foam.position.set(spot.x, spot.h + 0.03, spot.z);
    group.add(foam);
    const s = { id, g, foam, age: 0, spot };
    s.handle = register({
      pos: new THREE.Vector3(spot.x, 0, spot.z), r: 1.5,
      label: `pick up the ${ITEMS[id].name.toLowerCase()}`,
      use: () => {
        if (!S.addItem(id)) return;
        jingle();
        ui.toast(`You found a <b>${ITEMS[id].name}</b>! <i>${ITEMS[id].blurb}</i>`, ITEMS[id].emoji);
        ui.updateHUD();
        remove(s);
      },
    });
    live.push(s);
  }

  function remove(s) {
    group.remove(s.g, s.foam);
    s.handle.remove();
    live.splice(live.indexOf(s), 1);
  }

  function update(dt, t, playerPos) {
    if (zones.current() !== 'island') return;
    nextT -= dt;
    if (nextT <= 0) {
      nextT = 20 + Math.random() * 25;
      if (live.length < 6) wash(playerPos);
    }
    for (const s of [...live]) {
      s.age += dt;
      // the wave sets it down: a short slide up the sand, a settle
      const k = Math.min(1, s.age / 1.6);
      const back = (1 - k) * 1.2;
      s.g.position.set(
        s.spot.x + Math.sin(s.spot.sea) * back,
        s.spot.h + 0.05 + Math.sin(k * Math.PI) * 0.08,
        s.spot.z + Math.cos(s.spot.sea) * back);
      s.foam.material.opacity = Math.max(0, 0.7 * (1 - s.age / 3));
      s.foam.visible = s.foam.material.opacity > 0.01;
      if (s.age > 300) remove(s); // the tide takes back what nobody wanted
    }
    void t;
  }

  return { group, update };
}

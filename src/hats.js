// Hats. The single most important feature of any village-life game.
// Hats attach to an animal's head part, so anyone — you, a villager, in
// principle a duck — can wear one. Press H to cycle yours.

import * as THREE from 'three';
import * as S from './state.js';
import { ITEMS } from './catalog.js';
import * as ui from './ui.js';

function mat(color, rough = 0.85) {
  return new THREE.MeshStandardMaterial({ color, flatShading: true, roughness: rough });
}

const builders = {
  knit_cap() {
    const g = new THREE.Group();
    const cap = new THREE.Mesh(new THREE.IcosahedronGeometry(0.34, 1), mat(0xc25b4e));
    cap.scale.set(1, 0.62, 1);
    g.add(cap);
    const pom = new THREE.Mesh(new THREE.IcosahedronGeometry(0.1, 0), mat(0xfff3da));
    pom.position.y = 0.26;
    g.add(pom);
    return g;
  },
  straw_hat() {
    const g = new THREE.Group();
    const brim = new THREE.Mesh(new THREE.CylinderGeometry(0.58, 0.62, 0.05, 10), mat(0xe8d49a));
    g.add(brim);
    const dome = new THREE.Mesh(new THREE.CylinderGeometry(0.26, 0.32, 0.22, 9), mat(0xdfca8c));
    dome.position.y = 0.13;
    g.add(dome);
    const band = new THREE.Mesh(new THREE.CylinderGeometry(0.3, 0.33, 0.07, 9), mat(0xc25b4e, 0.6));
    band.position.y = 0.05;
    g.add(band);
    return g;
  },
  party_cone() {
    const g = new THREE.Group();
    const cone = new THREE.Mesh(new THREE.ConeGeometry(0.2, 0.48, 8), mat(0x6a9ae0, 0.6));
    cone.position.y = 0.18;
    g.add(cone);
    const pom = new THREE.Mesh(new THREE.IcosahedronGeometry(0.07, 0), mat(0xffd23e, 0.5));
    pom.position.y = 0.44;
    g.add(pom);
    return g;
  },
  flower_crown() {
    const g = new THREE.Group();
    const ring = new THREE.Mesh(new THREE.TorusGeometry(0.3, 0.05, 6, 12), mat(0x4e9a45));
    ring.rotation.x = Math.PI / 2;
    g.add(ring);
    const petals = [0xff6b81, 0xffd23e, 0xffffff, 0xc77dff, 0xff9430];
    for (let i = 0; i < 5; i++) {
      const a = (i / 5) * Math.PI * 2;
      const f = new THREE.Mesh(new THREE.IcosahedronGeometry(0.08, 0), mat(petals[i], 0.6));
      f.position.set(Math.cos(a) * 0.3, 0.03, Math.sin(a) * 0.3);
      g.add(f);
    }
    return g;
  },
  keepers_cap: () => capWithBrim(0x2e3e5c),
  captains_cap: () => capWithBrim(0xf5f2e9),
  paper_boat() {
    const g = new THREE.Group();
    const hull = new THREE.Mesh(new THREE.ConeGeometry(0.3, 0.24, 4), mat(0xfffaf0, 0.7));
    hull.rotation.y = Math.PI / 4;
    hull.scale.set(1.5, 1, 0.7);
    hull.position.y = 0.06;
    g.add(hull);
    const sail = new THREE.Mesh(new THREE.ConeGeometry(0.12, 0.2, 4), mat(0xfffaf0, 0.7));
    sail.position.y = 0.26;
    g.add(sail);
    return g;
  },
  orange_hat() {
    const g = new THREE.Group();
    const orange = new THREE.Mesh(new THREE.IcosahedronGeometry(0.18, 0), mat(0xff9430, 0.6));
    g.add(orange);
    const stem = new THREE.Mesh(new THREE.ConeGeometry(0.03, 0.08, 4), mat(0x4e9a45));
    stem.position.y = 0.18;
    g.add(stem);
    return g;
  },
  leaf_hat() {
    const g = new THREE.Group();
    const leaf = new THREE.Mesh(new THREE.IcosahedronGeometry(0.4, 0), mat(0x55b055, 0.8));
    leaf.scale.set(1.5, 0.22, 1.0);
    g.add(leaf);
    const stem = new THREE.Mesh(new THREE.ConeGeometry(0.04, 0.16, 5), mat(0x4e9a45));
    stem.position.set(-0.5, 0.08, 0);
    stem.rotation.z = 0.8;
    g.add(stem);
    return g;
  },
};

function capWithBrim(color) {
  const g = new THREE.Group();
  const top = new THREE.Mesh(new THREE.CylinderGeometry(0.36, 0.32, 0.18, 9), mat(color, 0.7));
  top.position.y = 0.06;
  g.add(top);
  const brim = new THREE.Mesh(new THREE.BoxGeometry(0.42, 0.04, 0.24), mat(0x1d2738, 0.5));
  brim.position.set(0, -0.02, 0.36);
  g.add(brim);
  const badge = new THREE.Mesh(new THREE.IcosahedronGeometry(0.05, 0), mat(0xf2cf5b, 0.3));
  badge.position.set(0, 0.08, 0.34);
  g.add(badge);
  return g;
}

// Put a hat on any buildAnimal() group (or null to go bare-headed).
export function applyHat(animal, hatId) {
  const head = animal.userData.parts?.head;
  if (!head) return;
  if (animal.userData.hatMesh) {
    head.remove(animal.userData.hatMesh);
    animal.userData.hatMesh = null;
  }
  if (!hatId || !builders[hatId]) return;
  const hat = builders[hatId]();
  hat.position.y = 0.34;
  hat.traverse((o) => { if (o.isMesh) o.castShadow = true; });
  head.add(hat);
  animal.userData.hatMesh = hat;
}

// H cycles bare → each owned hat. Wired once for the player.
export function wireHatKey(playerGroup) {
  applyHat(playerGroup, S.state.wearing); // restore from save
  addEventListener('keydown', (e) => {
    if (e.code !== 'KeyH' || e.repeat || ui.isBusy()) return;
    if (!S.state.hats.length) return;
    const cycle = [null, ...S.state.hats];
    const idx = cycle.indexOf(S.state.wearing);
    const next = cycle[(idx + 1) % cycle.length];
    S.wearHat(next);
    applyHat(playerGroup, next);
    ui.toast(next ? `You put on the <b>${ITEMS[next].name}</b>.` : 'Hat off. The breeze approves.',
      next ? ITEMS[next].emoji : '💨');
  });
}

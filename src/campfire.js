// A campfire kit: layered faceted flames, a bed of embers, sparks, and a warm
// pool of light on the ground around it — "lit" by an additive decal, not a
// PointLight (the outdoor lighting budget has no room for more lights, and
// the decal is what actually reads from the camera anyway).
//
//   const fire = makeFlames(x, groundY, z, { scale })   flames + glow only
//   const fire = makeCampfire(x, z, { scale })           + stone ring + logs
//   group.add(fire.group); every frame: fire.update(dt, t)
//
// Neither consumes the seeded PRNG: dropping a fire into a module never
// reshuffles the world placed after it.

import * as THREE from 'three';
import { terrainHeight } from './terrain.js';
import { isNight } from './calendar.js';

let poolTex = null;
function glowTex() {
  if (poolTex) return poolTex;
  const cv = document.createElement('canvas');
  cv.width = cv.height = 64;
  const c = cv.getContext('2d');
  const g = c.createRadialGradient(32, 32, 0, 32, 32, 32);
  g.addColorStop(0, 'rgba(255,190,110,1)');
  g.addColorStop(0.35, 'rgba(255,150,70,0.5)');
  g.addColorStop(1, 'rgba(255,120,50,0)');
  c.fillStyle = g;
  c.fillRect(0, 0, 64, 64);
  poolTex = new THREE.CanvasTexture(cv);
  return poolTex;
}

const FLAME_COLORS = [0xff6a2a, 0xff9a3c, 0xffd46a];

export function makeFlames(x, y, z, { scale = 1 } = {}) {
  const group = new THREE.Group();
  group.position.set(x, y, z);
  group.scale.setScalar(scale);
  // the embers: a glowing bed the flames stand in
  const bed = new THREE.Mesh(new THREE.CircleGeometry(0.55, 8),
    new THREE.MeshBasicMaterial({ color: 0xff7a3a }));
  bed.rotation.x = -Math.PI / 2;
  bed.position.y = 0.08;
  group.add(bed);
  // flames: three nested cones (red outside, gold at the heart) and two
  // small licks to the side, each flickering on its own beat
  const flames = [];
  const specs = [
    [0, 0, 0.38, 1.05, 0], [0, 0, 0.27, 0.85, 1], [0, 0, 0.15, 0.62, 2],
    [0.28, 0.12, 0.14, 0.5, 0], [-0.22, -0.18, 0.13, 0.44, 1],
  ];
  for (const [fx, fz, r, h, ci] of specs) {
    const geo = new THREE.ConeGeometry(r, h, 5);
    geo.translate(0, h / 2, 0); // pivot at the base, so flicker stretches upward
    const f = new THREE.Mesh(geo, new THREE.MeshBasicMaterial({
      color: FLAME_COLORS[ci], transparent: ci < 2, opacity: ci === 0 ? 0.85 : ci === 1 ? 0.92 : 1,
    }));
    f.position.set(fx, 0.1, fz);
    f.userData.seed = fx * 7 + fz * 13 + r * 29;
    flames.push(f);
    group.add(f);
  }
  // the light it throws: a warm pool on the ground, and a soft halo
  const pool = new THREE.Mesh(new THREE.CircleGeometry(3.6, 16), new THREE.MeshBasicMaterial({
    map: glowTex(), color: 0xffa060, transparent: true, opacity: 0.4,
    depthWrite: false, blending: THREE.AdditiveBlending,
    polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2,
  }));
  pool.rotation.x = -Math.PI / 2;
  pool.position.y = 0.06;
  group.add(pool);
  const halo = new THREE.Sprite(new THREE.SpriteMaterial({
    map: glowTex(), color: 0xff9a50, transparent: true, opacity: 0.4,
    depthWrite: false, blending: THREE.AdditiveBlending,
  }));
  halo.scale.set(3.2, 3.2, 1);
  halo.position.y = 0.8;
  group.add(halo);
  // sparks: little bright bits that rise, drift, and wink out
  const sparks = [];
  for (let i = 0; i < 7; i++) {
    const s = new THREE.Mesh(new THREE.IcosahedronGeometry(0.035, 0),
      new THREE.MeshBasicMaterial({ color: 0xffd08a, transparent: true }));
    s.userData.t = i / 7 * 1.6;
    s.userData.a = i * 2.4;
    sparks.push(s);
    group.add(s);
  }

  function update(dt, t) {
    const night = isNight() ? 1 : 0;
    for (const f of flames) {
      const u = t + f.userData.seed;
      f.scale.set(1 + Math.sin(u * 11) * 0.08, 0.85 + Math.sin(u * 7.3) * 0.12 + Math.sin(u * 17) * 0.06, 1 + Math.cos(u * 9) * 0.08);
      f.rotation.y = u * 0.8;
    }
    pool.material.opacity = (0.35 + night * 0.5) * (0.92 + Math.sin(t * 8) * 0.05 + Math.sin(t * 13.7) * 0.03);
    halo.material.opacity = 0.3 + night * 0.35 + Math.sin(t * 9) * 0.04;
    for (const s of sparks) {
      const d = s.userData;
      d.t += dt;
      if (d.t > 1.6) { d.t = 0; d.a += 1.7; }
      const k = d.t / 1.6;
      s.position.set(Math.cos(d.a) * 0.2 + Math.sin(d.t * 4 + d.a) * 0.12, 0.5 + k * 2.2, Math.sin(d.a) * 0.2);
      s.material.opacity = 1 - k;
    }
  }
  return { group, update };
}

export function makeCampfire(x, z, { scale = 1 } = {}) {
  const y = terrainHeight(x, z);
  const fire = makeFlames(x, y, z, { scale });
  const g = fire.group;
  const stoneMat = new THREE.MeshStandardMaterial({ color: 0x8a8378, flatShading: true, roughness: 0.95 });
  for (let i = 0; i < 9; i++) {
    const a = (i / 9) * Math.PI * 2;
    const stone = new THREE.Mesh(new THREE.IcosahedronGeometry(0.22 + (i % 3) * 0.04, 0), stoneMat);
    stone.position.set(Math.cos(a) * 0.85, 0.12, Math.sin(a) * 0.85);
    stone.rotation.set(i, i * 2, 0);
    stone.castShadow = stone.receiveShadow = true;
    g.add(stone);
  }
  const logMat = new THREE.MeshStandardMaterial({ color: 0x4a3a2c, flatShading: true, roughness: 0.9 });
  for (const ry of [0.3, 1.4, 2.5]) {
    const log = new THREE.Mesh(new THREE.CylinderGeometry(0.09, 0.11, 1.0, 6), logMat);
    log.rotation.z = Math.PI / 2 - 0.35;
    log.rotation.y = ry;
    log.position.y = 0.22;
    log.castShadow = true;
    g.add(log);
  }
  return fire;
}

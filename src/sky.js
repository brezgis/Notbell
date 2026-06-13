import * as THREE from 'three';
import { rand } from './utils.js';
import { dayFactor } from './calendar.js';
import * as zones from './zones.js';

// during the rocket launch, force the stars out regardless of the clock
let launchNight = 0;
export function setLaunchNight(k) { launchNight = Math.max(0, Math.min(1, k)); }

// Puffy low-poly clouds that drift across the island and cast soft
// wandering shadows — plus stars that come out when the real sun goes down.
export function createSky() {
  const group = new THREE.Group();
  const mat = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 1, flatShading: true });
  const clouds = [];

  for (let i = 0; i < 8; i++) {
    const cloud = new THREE.Group();
    const puffs = 3 + Math.floor(rand(0, 3));
    for (let k = 0; k < puffs; k++) {
      const r = rand(1.8, 3.4);
      const puff = new THREE.Mesh(new THREE.IcosahedronGeometry(r, 0), mat);
      puff.position.set((k - (puffs - 1) / 2) * r * 0.95 + rand(-0.6, 0.6), rand(-0.4, 0.4), rand(-1, 1));
      puff.scale.set(1, 0.55, 0.75);
      puff.castShadow = true;
      cloud.add(puff);
    }
    cloud.position.set(rand(-140, 140), rand(24, 38), rand(-110, 110));
    cloud.userData.speed = rand(0.8, 2.0);
    clouds.push(cloud);
    group.add(cloud);
  }

  // stars: a dome of soft points, faded in by the night
  const starPts = [];
  for (let i = 0; i < 320; i++) {
    const a = rand(0, Math.PI * 2);
    const alt = rand(0.12, 1.4); // keep them up off the horizon
    const R = 320;
    starPts.push(Math.cos(a) * Math.cos(alt) * R, Math.sin(alt) * R * 0.7 + 20, Math.sin(a) * Math.cos(alt) * R);
  }
  const starGeo = new THREE.BufferGeometry();
  starGeo.setAttribute('position', new THREE.Float32BufferAttribute(starPts, 3));
  const starMat = new THREE.PointsMaterial({
    color: 0xeef4ff, size: 2.2, transparent: true, opacity: 0,
    sizeAttenuation: false, depthWrite: false, fog: false,
  });
  const stars = new THREE.Points(starGeo, starMat);
  group.add(stars);

  function update(dt) {
    for (const c of clouds) {
      c.position.x += c.userData.speed * dt;
      if (c.position.x > 160) c.position.x = -160;
    }
    const f = dayFactor();
    const nightness = Math.max(launchNight, 1 - Math.min(1, f / 0.25));
    starMat.opacity = nightness * 0.9;
    // stars belong to the island's sky — interiors and the cave keep their own
    stars.visible = nightness > 0.02 &&
      (zones.current() === 'island' || zones.current() === 'sea');
  }

  return { group, update };
}

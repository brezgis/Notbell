import * as THREE from 'three';
import { WATER_Y } from './terrain.js';

export function createOcean() {
  const group = new THREE.Group();

  const geo = new THREE.PlaneGeometry(700, 700, 56, 56);
  geo.rotateX(-Math.PI / 2);
  const base = geo.attributes.position.array.slice();

  const surface = new THREE.Mesh(
    geo,
    new THREE.MeshStandardMaterial({
      color: 0x3fb0e8,
      transparent: true,
      opacity: 0.85,
      roughness: 0.35,
      metalness: 0,
      flatShading: true,
    })
  );
  surface.position.y = WATER_Y;
  surface.receiveShadow = true; // cloud shadows drift across the water
  group.add(surface);

  // Solid sea floor so the depths read as water, not void.
  const floor = new THREE.Mesh(
    new THREE.PlaneGeometry(800, 800),
    new THREE.MeshStandardMaterial({ color: 0x2b8fc4, roughness: 1 })
  );
  floor.rotation.x = -Math.PI / 2;
  floor.position.y = WATER_Y - 2.6;
  group.add(floor);

  const pos = geo.attributes.position;

  function update(t) {
    for (let i = 0; i < pos.count; i++) {
      const x = base[i * 3];
      const z = base[i * 3 + 2];
      pos.setY(
        i,
        Math.sin(x * 0.16 + t * 1.3) * 0.14 +
          Math.sin(z * 0.13 + t * 0.9) * 0.14 +
          Math.sin((x + z) * 0.07 + t * 0.6) * 0.1
      );
    }
    pos.needsUpdate = true;
    // flat shading derives normals in-shader, so no recompute needed
  }

  return { group, update };
}

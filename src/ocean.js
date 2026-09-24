import * as THREE from 'three';
import { WATER_Y } from './terrain.js';

// The wave field, and the height of the RENDERED surface at (x, z): the sea
// mesh is a coarse grid (12.5u cells), so things that ride the water ask for
// the interpolated height — the analytic wave would put them above or below
// the triangles you actually see.
const SEA_SIZE = 700, SEA_SEG = 56, CELL = SEA_SIZE / SEA_SEG;
function wave(x, z, t) {
  return Math.sin(x * 0.16 + t * 1.3) * 0.14 +
    Math.sin(z * 0.13 + t * 0.9) * 0.14 +
    Math.sin((x + z) * 0.07 + t * 0.6) * 0.1;
}
export function waveAt(x, z, t) {
  const gx = (x + SEA_SIZE / 2) / CELL, gz = (z + SEA_SIZE / 2) / CELL;
  const ix = Math.floor(gx), iz = Math.floor(gz);
  const fx = gx - ix, fz = gz - iz;
  const x0 = ix * CELL - SEA_SIZE / 2, z0 = iz * CELL - SEA_SIZE / 2;
  const h00 = wave(x0, z0, t), h10 = wave(x0 + CELL, z0, t);
  const h01 = wave(x0, z0 + CELL, t), h11 = wave(x0 + CELL, z0 + CELL, t);
  // the quad's two triangles split on the (0,1)-(1,0) diagonal
  return fx + fz <= 1
    ? h00 + (h10 - h00) * fx + (h01 - h00) * fz
    : h11 + (h01 - h11) * (1 - fx) + (h10 - h11) * (1 - fz);
}

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
      pos.setY(i, wave(x, z, t));
    }
    pos.needsUpdate = true;
    // flat shading derives normals in-shader, so no recompute needed
  }

  return { group, update };
}

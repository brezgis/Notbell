// A beach ball. It rolls downhill, it floats, and it cannot be caught,
// sold, or donated. It can only be pushed, which is everything.

import * as THREE from 'three';
import { SITES, terrainHeight, WATER_Y } from './terrain.js';
import * as zones from './zones.js';
import { rand } from './utils.js';

export function createBeachBall(player) {
  const group = new THREE.Group();
  const R = 0.55;

  const ball = new THREE.Group();
  const cv = document.createElement('canvas');
  cv.width = 256;
  cv.height = 128;
  const ctx = cv.getContext('2d');
  const stripes = ['#d84f4f', '#fffaf0', '#5b8bc9', '#fffaf0', '#ffd23e', '#fffaf0', '#4f8f6a', '#fffaf0'];
  const stripeW = cv.width / stripes.length;
  stripes.forEach((c, i) => {
    ctx.fillStyle = c;
    ctx.fillRect(i * stripeW, 0, stripeW + 1, cv.height);
  });
  const tex = new THREE.CanvasTexture(cv);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.wrapS = THREE.RepeatWrapping;
  const sphere = new THREE.Mesh(new THREE.SphereGeometry(R, 16, 12),
    new THREE.MeshStandardMaterial({ map: tex, roughness: 0.6 }));
  ball.add(sphere);
  ball.traverse((o) => {
    if (o.isMesh) {
      o.castShadow = true;
      o.receiveShadow = true;
    }
  });
  const D = SITES.dock;
  ball.position.set(D.x + 2, terrainHeight(D.x + 2, D.z - 3) + R, D.z - 3);
  group.add(ball);

  const vel = new THREE.Vector3();
  const spinAxis = new THREE.Vector3(1, 0, 0);

  function update(dt, t, playerPos) {
    // a friendly shove when you walk into it
    const dx = ball.position.x - playerPos.x;
    const dz = ball.position.z - playerPos.z;
    const d = Math.hypot(dx, dz);
    if (d < R + 0.65 && d > 0.001) {
      vel.x += (dx / d) * 6 * dt * 12;
      vel.z += (dz / d) * 6 * dt * 12;
    }

    const ground = terrainHeight(ball.position.x, ball.position.z);
    const floating = ground < WATER_Y - 0.1;

    if (!floating) {
      // roll downhill, gently
      const gx = terrainHeight(ball.position.x + 0.4, ball.position.z) - terrainHeight(ball.position.x - 0.4, ball.position.z);
      const gz = terrainHeight(ball.position.x, ball.position.z + 0.4) - terrainHeight(ball.position.x, ball.position.z - 0.4);
      vel.x -= gx * dt * 6;
      vel.z -= gz * dt * 6;
      vel.multiplyScalar(Math.max(0, 1 - dt * 1.4)); // grass is grabby
    } else {
      vel.multiplyScalar(Math.max(0, 1 - dt * 0.5)); // water lets it wander
      vel.x += Math.sin(t * 0.4) * dt * 0.2;
    }

    const speed = Math.hypot(vel.x, vel.z);
    if (speed > 0.01) {
      let nx = ball.position.x + vel.x * dt;
      let nz = ball.position.z + vel.z * dt;
      // stay in the archipelago's waters, bounce off blockers on land
      if (Math.hypot(nx - 40, nz - 40) > 215) {
        vel.multiplyScalar(-0.6);
        nx = ball.position.x;
        nz = ball.position.z;
      } else if (!floating && !zones.islandCanWalk(nx, nz) && terrainHeight(nx, nz) > WATER_Y - 0.1) {
        // bumped a building or the cave — bounce, cheerfully
        vel.multiplyScalar(-0.55);
        nx = ball.position.x;
        nz = ball.position.z;
      }
      ball.position.x = nx;
      ball.position.z = nz;
      // rolling means spinning; spinning means joy
      spinAxis.set(vel.z, 0, -vel.x).normalize();
      ball.rotateOnWorldAxis(spinAxis, (speed * dt) / R);
    }

    const targetY = floating
      ? WATER_Y + R * 0.7 + Math.sin(t * 1.6) * 0.06
      : ground + R;
    ball.position.y += (targetY - ball.position.y) * Math.min(1, dt * 8);
  }

  return { group, update };
}

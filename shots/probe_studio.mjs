// Portrait studio: every villager on a plain floor out in the empty west,
// front and side, for checking props, tails, hats and silhouettes.
import { boot, sleep, snap, view } from './lib.mjs';
const { browser, page } = await boot();
await page.addScriptTag({ type: 'module', content: `
  import * as THREE from 'three';
  const N = window.__notbell;
  const scene = N.player.group.parent;
  const floor = new THREE.Mesh(new THREE.BoxGeometry(40, 0.2, 20), new THREE.MeshStandardMaterial({ color: 0xe8e0d0 }));
  floor.position.set(-600, -0.1, 0);
  scene.add(floor);
  const list = N.animals.animals.filter((a) => a.identity);
  list.forEach((a, i) => {
    a.away = true; a.home = false; a.g.visible = true;
    a.g.position.set(-612 + (i % 8) * 3.4, 0, -3 + Math.floor(i / 8) * 5);
    a.g.rotation.y = 0;
  });
  window.__studio = list.map((a) => a.identity.name);
` });
await sleep(800);
await page.evaluate(() => window.__notbell.zones.go('island', { x: -600, z: 12 }));
await sleep(1500);
console.log(await page.evaluate(() => window.__studio.join(', ')));
for (const [name, yaw] of [['front', 0], ['side', Math.PI / 2], ['back', Math.PI * 0.85]]) {
  await view(page, { x: -600, y: 1.5, z: -0.5 }, { yaw, pitch: 0.18, dist: 22 });
  await snap(page, 'studio-' + name);
}
await browser.close();

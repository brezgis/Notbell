// Roof-fit audit: for every outdoor wall box with a roof over it, sample the
// wall's top edges and ask "is this point under (or inside) the roof?"
// A point that isn't is a wall corner/edge poking out through the roof —
// the classic mistake is a prism roof whose base sits BELOW the wall top, so
// the eaves narrow before they clear the walls.
//
//   PORT=8130 node roof_audit.mjs     → prints offenders, worst first
import fs from 'node:fs';
import path from 'node:path';
import { boot, OUT } from './lib.mjs';

const { browser, page } = await boot();
await page.addScriptTag({ type: 'module', content: `
  import * as THREE from 'three';
  window.__THREE = THREE;
` });
await new Promise((r) => setTimeout(r, 500));
const report = await page.evaluate(() => {
  const THREE = window.__THREE;
  const N = window.__notbell;
  const scene = N.player.group.parent;
  scene.updateMatrixWorld(true);
  const owner = (o) => { while (o.parent && o.parent !== scene) o = o.parent; return o.name || '?'; };
  const roofs = [], walls = [];
  scene.traverse((o) => {
    if (!o.isMesh || !o.geometry?.parameters) return;
    const p = o.geometry.parameters, t = o.geometry.type;
    const wp = o.getWorldPosition(new THREE.Vector3());
    if (Math.abs(wp.x) > 260 || Math.abs(wp.z) > 260) return;
    if (['ocean', 'animals', 'player', 'moon'].includes(owner(o))) return;
    const isRoof = (t === 'CylinderGeometry' && p.radialSegments === 3 && p.radiusTop > 1) ||
      (t === 'ConeGeometry' && (p.radialSegments === 4 || p.radialSegments >= 6) && p.radius > 1.2 && p.height < p.radius * 2);
    if (isRoof) {
      o.geometry.computeBoundingBox();
      roofs.push({ o, bb: o.geometry.boundingBox.clone().applyMatrix4(o.matrixWorld) });
    } else if (t === 'BoxGeometry' && p.height >= 1.8 && p.width >= 2 && p.depth >= 2) {
      walls.push({ o, p });
    }
  });
  const ray = new THREE.Raycaster();
  const up = new THREE.Vector3(0, 1, 0);
  const out = [];
  for (const w of walls) {
    const { o, p } = w;
    // top edge samples in world space
    const pts = [];
    const hw = p.width / 2, hd = p.depth / 2, top = p.height / 2;
    for (let s = -1; s <= 1.0001; s += 0.125) {
      pts.push([s * hw, top, -hd], [s * hw, top, hd], [-hw, top, s * hd], [hw, top, s * hd]);
    }
    const world = pts.map(([x, y, z]) => new THREE.Vector3(x, y, z).applyMatrix4(o.matrixWorld));
    const cx = world.reduce((a, v) => a + v.x, 0) / world.length;
    const cz = world.reduce((a, v) => a + v.z, 0) / world.length;
    const wallTop = Math.max(...world.map((v) => v.y));
    const mine = roofs.filter((r) => cx > r.bb.min.x && cx < r.bb.max.x && cz > r.bb.min.z && cz < r.bb.max.z &&
      r.bb.min.y < wallTop + 1.2 && r.bb.max.y > wallTop - 0.2);
    if (!mine.length) continue;
    let bad = 0;
    const worst = [];
    for (const v of world) {
      let covered = false;
      for (const r of mine) {
        const side = r.o.material.side;
        r.o.material.side = THREE.DoubleSide;
        ray.set(new THREE.Vector3(v.x, v.y + 0.02, v.z), up);
        ray.far = 20;
        const hit = ray.intersectObject(r.o, false).length > 0;
        r.o.material.side = side;
        if (hit) { covered = true; break; }
      }
      if (!covered) { bad++; if (worst.length < 3) worst.push([+v.x.toFixed(1), +v.y.toFixed(2), +v.z.toFixed(1)]); }
    }
    if (bad) {
      out.push({
        own: owner(o), color: '#' + o.material.color?.getHexString(), at: [+cx.toFixed(1), +cz.toFixed(1)],
        wall: [p.width, p.height, p.depth], bad, of: world.length, sample: worst,
      });
    }
  }
  out.sort((a, b) => b.bad / b.of - a.bad / a.of);
  return { walls: walls.length, roofs: roofs.length, offenders: out };
});
fs.mkdirSync(OUT, { recursive: true });
fs.writeFileSync(path.join(OUT, 'roof_audit.json'), JSON.stringify(report, null, 1));
console.log(`walls ${report.walls} · roofs ${report.roofs} · poking ${report.offenders.length}`);
for (const r of report.offenders) console.log(`${String(Math.round(100 * r.bad / r.of)).padStart(3)}% ${r.own.padEnd(10)} ${r.color} at ${r.at} wall ${r.wall.join('x')} e.g. ${JSON.stringify(r.sample[0])}`);
await browser.close();

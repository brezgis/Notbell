// Computed clipping audit: every spot the player (or a villager) can stand on
// the islands, tested against every solid outdoor mesh. A hit means a body
// standing there would be inside that mesh — a wall you can walk into, a
// plinth you sink through, a tree trunk you ghost past.
//
//   PORT=8130 node clip_audit.mjs            → out/clip_audit.json + a summary
//
// Triage by eye: bounding boxes are exact for boxes, generous for cylinders
// and icosahedra, so a hit on a round thing may be a near miss.
import fs from 'node:fs';
import path from 'node:path';
import { boot, OUT } from './lib.mjs';

const { browser, page } = await boot();
const report = await page.evaluate(() => {
  const N = window.__notbell;
  const scene = N.player.group.parent;
  const V3 = N.player.group.position.constructor;
  scene.updateMatrixWorld(true);
  const SKIP = new Set(['ocean', 'sky', 'animals', 'player', 'ghost', 'oceanLife', 'moon', 'fishing', 'digging']);
  const owner = (o) => { while (o.parent && o.parent !== scene) o = o.parent; return o.name || '?'; };
  const hidden = (o) => { for (let q = o; q; q = q.parent) if (!q.visible) return true; return false; };
  const cands = [];
  const tmp = new V3();
  scene.traverse((o) => {
    if (!o.isMesh || !o.geometry) return;
    const own = owner(o);
    if (SKIP.has(own) || hidden(o)) return;
    const m = o.material;
    if (!m || m.transparent && m.opacity < 0.7) return;
    if (m.colorWrite === false || m.visible === false) return;
    o.geometry.computeBoundingBox();
    const bb = o.geometry.boundingBox.clone().applyMatrix4(o.matrixWorld);
    if (bb.min.x < -260 || bb.max.x > 200 || Math.abs(bb.min.z) > 260) return; // interiors
    const sx = bb.max.x - bb.min.x, sz = bb.max.z - bb.min.z, sy = bb.max.y - bb.min.y;
    if (sx > 60 || sz > 60) return; // terrain, water planes
    if (sy < 0.12) return; // decals, rugs, paint
    if (o.isInstancedMesh) return;
    const inv = o.matrixWorld.clone().invert();
    const lb = o.geometry.boundingBox.clone();
    const t = o.geometry.type;
    const round = /Icosahedron|Dodecahedron|Sphere|Cone|Octahedron/.test(t);
    if (round) { // bounding boxes flatter round things: use the inscribed box
      const c = lb.getCenter(new V3()), hs = lb.getSize(new V3()).multiplyScalar(0.36);
      lb.min.copy(c).sub(hs); lb.max.copy(c).add(hs);
    }
    cands.push({ o, own, bb, inv, lb, round, hits: 0, pts: [] });
  });
  // spatial hash
  const C = 2, grid = new Map();
  const key = (i, j) => i * 100003 + j;
  cands.forEach((c, idx) => {
    for (let i = Math.floor(c.bb.min.x / C); i <= Math.floor(c.bb.max.x / C); i++)
      for (let j = Math.floor(c.bb.min.z / C); j <= Math.floor(c.bb.max.z / C); j++) {
        const k = key(i, j);
        if (!grid.has(k)) grid.set(k, []);
        grid.get(k).push(idx);
      }
  });
  const walk = (x, z) => N.zones.islandCanStand(x, z, 0.3);
  const ground = (x, z) => N.zones.groundHeight(x, z);
  const OFF = [[0, 0], [0.28, 0], [-0.28, 0], [0, 0.28], [0, -0.28]];
  const HS = [0.3, 0.7, 1.05];
  const STEP = 0.5;
  let walkable = 0;
  for (let x = -235; x <= 165; x += STEP) {
    for (let z = -165; z <= 165; z += STEP) {
      if (!walk(x, z)) continue;
      walkable++;
      const g = ground(x, z);
      const list = grid.get(key(Math.floor(x / C), Math.floor(z / C)));
      if (!list) continue;
      for (const idx of list) {
        const c = cands[idx];
        if (x < c.bb.min.x - 0.3 || x > c.bb.max.x + 0.3 || z < c.bb.min.z - 0.3 || z > c.bb.max.z + 0.3) continue;
        if (c.bb.max.y < g + 0.25 || c.bb.min.y > g + 1.1) continue;
        let hit = false;
        const round = c.round;
        for (const [ox, oz] of OFF) {
          for (const h of (round ? HS.slice(0, 2) : HS)) {
            tmp.set(x + ox, g + h, z + oz).applyMatrix4(c.inv);
            if (c.lb.containsPoint(tmp)) { hit = true; break; }
          }
          if (hit) break;
        }
        if (hit) { c.hits++; if (c.pts.length < 400) c.pts.push([x, z]); }
      }
    }
  }
  const out = [];
  for (const c of cands) {
    if (!c.hits) continue;
    const o = c.o;
    const p = o.geometry.parameters || {};
    const ctr = c.bb.getCenter(new V3());
    const xs = c.pts.map((q) => q[0]), zs = c.pts.map((q) => q[1]);
    out.push({
      own: c.own, geo: o.geometry.type, name: o.name || o.parent?.name || '',
      color: o.material.color ? '#' + o.material.color.getHexString() : '',
      at: [+ctr.x.toFixed(1), +ctr.y.toFixed(2), +ctr.z.toFixed(1)],
      size: [+(c.bb.max.x - c.bb.min.x).toFixed(2), +(c.bb.max.y - c.bb.min.y).toFixed(2), +(c.bb.max.z - c.bb.min.z).toFixed(2)],
      params: Object.fromEntries(Object.entries(p).filter(([, v]) => typeof v === 'number').map(([k, v]) => [k, +v.toFixed?.(2) ?? v])),
      hits: c.hits,
      hitBox: [Math.min(...xs), Math.min(...zs), Math.max(...xs), Math.max(...zs)],
    });
  }
  out.sort((a, b) => b.hits - a.hits);
  return { walkable, candidates: cands.length, offenders: out };
});
fs.mkdirSync(OUT, { recursive: true });
fs.writeFileSync(path.join(OUT, 'clip_audit.json'), JSON.stringify(report, null, 1));
console.log(`walkable samples ${report.walkable} · meshes ${report.candidates} · offenders ${report.offenders.length}`);
const byOwn = {};
for (const o of report.offenders) byOwn[o.own] = (byOwn[o.own] || 0) + 1;
console.log(byOwn);
for (const o of report.offenders.slice(0, +(process.env.TOP || 80))) {
  console.log(`${String(o.hits).padStart(5)} ${o.own.padEnd(10)} ${o.geo.padEnd(20)} ${o.color} at ${o.at.join(',')} size ${o.size.join('x')}`);
}
await browser.close();

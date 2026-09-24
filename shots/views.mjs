// Snap a list of camera views: VIEWS='[{"n":"name","x":0,"z":0,"yaw":0,"pitch":0.6,"dist":18}]'
// or VIEWS=@file.json. Player parks at PX,PZ (default: first view) so nothing
// photobombs; night=1 / weather=rain via env. Writes a contact sheet too.
import fs from 'node:fs';
import { boot, view, snap, sleep, night, forceWeather, OUT } from './lib.mjs';
import { execFileSync } from 'node:child_process';
let V = process.env.VIEWS || '[]';
if (V.startsWith('@')) V = fs.readFileSync(V.slice(1), 'utf8');
const views = JSON.parse(V);
const { browser, page } = await boot();
await page.evaluate(() => {
  for (const k of ['notbell', 'far', 'north', 'texas', 'volcano', 'bulko', 'grove', 'labs', 'fold', 'farther']) window.__notbell.S.state.visited[k] = true;
});
if (process.env.NIGHT) await night(page, true);
if (process.env.WEATHER) await forceWeather(page, process.env.WEATHER);
if (process.env.SHOW) {
  // draw every blocker as a ring on the ground: red = structure, green =
  // tree/rock, blue = keepout
  await page.evaluate(() => {
    const N = window.__notbell;
    const scene = N.player.group.parent;
    const THREE = { V: N.player.group.position.constructor };
    const pts = [];
    const cols = { structure: [1, 0.1, 0.1], tree: [0.1, 0.8, 0.1], keepout: [0.2, 0.4, 1] };
    const push = (x1, z1, x2, z2, col) => {
      for (const [x, z] of [[x1, z1], [x2, z2]]) pts.push(x, N.zones.groundHeight(x, z) + 0.08, z, ...col);
    };
    for (const b of N.zones.debugBlockers()) {
      const col = cols[b.kind] || [1, 1, 1];
      if (b.r !== undefined) {
        for (let i = 0; i < 20; i++) {
          const a0 = (i / 20) * Math.PI * 2, a1 = ((i + 1) / 20) * Math.PI * 2;
          push(b.x + Math.cos(a0) * b.r, b.z + Math.sin(a0) * b.r, b.x + Math.cos(a1) * b.r, b.z + Math.sin(a1) * b.r, col);
        }
      } else {
        const cs = [[-1, -1], [1, -1], [1, 1], [-1, 1]].map(([u, v]) => {
          const lx = u * b.hw, lz = v * b.hd; // local → world: inverse of (dx*c - dz*s, dx*s + dz*c)
          return [b.x + lx * b.c + lz * b.s, b.z - lx * b.s + lz * b.c];
        });
        for (let i = 0; i < 4; i++) push(...cs[i], ...cs[(i + 1) % 4], col);
      }
    }
    const geo = new (Object.getPrototypeOf(scene.children.find((c) => c.isMesh)?.geometry || {}).constructor)();
    void geo;
    window.__dbgPts = pts;
  });
  await page.addScriptTag({ type: 'module', content: `
    import * as THREE from 'three';
    const N = window.__notbell;
    const scene = N.player.group.parent;
    const p = window.__dbgPts;
    const pos = [], col = [];
    for (let i = 0; i < p.length; i += 6) { pos.push(p[i], p[i + 1], p[i + 2]); col.push(p[i + 3], p[i + 4], p[i + 5]); }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    g.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
    const lines = new THREE.LineSegments(g, new THREE.LineBasicMaterial({ vertexColors: true, depthTest: false }));
    lines.renderOrder = 999;
    scene.add(lines);
  ` });
  await sleep(300);
}
let lastZone = 'island';
const files = [];
for (const v of views) {
  if (v.find) {
    // aim at the first mesh wearing this color (e.g. "find":"#2a7fe8")
    const at = await page.evaluate((hex) => {
      let hit = null;
      window.__notbell.player.group.parent.traverse((o) => {
        if (!hit && o.isMesh && o.material?.color && '#' + o.material.color.getHexString() === hex) {
          const p = o.getWorldPosition(o.position.clone());
          hit = { x: p.x, y: p.y, z: p.z };
        }
      });
      return hit;
    }, v.find);
    if (!at) { console.log('not found', v.find); continue; }
    Object.assign(v, { x: at.x, y: at.y, z: at.z });
    if (v.px === undefined && !v.zone) { v.px = at.x + 3; v.pz = at.z + 3; }
    console.log(v.n, 'at', JSON.stringify(at));
  }
  const z = v.zone || 'island';
  const px = v.px ?? v.x + 30, pz = v.pz ?? v.z + 30;
  if (z !== lastZone || v.px !== undefined || v.move) {
    await page.evaluate((zz, p) => window.__notbell.zones.go(zz, p), z, z === 'island' ? { x: v.px ?? v.x, z: v.pz ?? v.z } : undefined);
    await sleep(1400);
    lastZone = z;
  }
  await view(page, v.zone && v.zone !== 'island' && v.x === undefined ? null : { x: v.x, y: v.y, z: v.z }, { yaw: v.yaw ?? 0, pitch: v.pitch ?? 0.6, dist: v.dist ?? 18, settle: 700 });
  files.push(await snap(page, v.n));
}
await browser.close();
if (files.length > 1) {
  execFileSync('python3', ['-c', `
import sys
from PIL import Image
fs=sys.argv[1:]
ims=[Image.open(f).resize((640,360)) for f in fs]
for k in range(0,len(ims),6):
  g=ims[k:k+6]
  W=Image.new('RGB',(1280,360*((len(g)+1)//2)))
  for i,im in enumerate(g): W.paste(im,((i%2)*640,(i//2)*360))
  W.save('${OUT}/sheet%d.png'%(k//6))
`, ...files]);
}

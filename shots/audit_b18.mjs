// B18: computed audit — floating buildings, buried decks, undersized roofs.
import { boot } from './lib.mjs';
const { browser, page } = await boot();

const report = await page.evaluate(() => {
  const N = window.__notbell;
  const th = N.terrainHeight;
  const scene = N.player.group.parent;
  const walls = [], decks = [], roofs = [];
  const v = new (N.player.group.position.constructor)();

  scene.updateMatrixWorld(true);
  scene.traverse((o) => {
    if (!o.isMesh || !o.geometry?.parameters) return;
    o.getWorldPosition(v);
    if (Math.abs(v.x) > 240 || Math.abs(v.z) > 240) return; // interiors/moon
    const p = o.geometry.parameters;
    const t = o.geometry.type;
    if (t === 'BoxGeometry') {
      // world-ish extents (assumes modest rotations; fine for an audit)
      const sx = o.getWorldScale(v.clone());
      o.getWorldPosition(v);
      const w = p.width, h = p.height, d = p.depth;
      const rec = { x: +v.x.toFixed(1), y: +v.y.toFixed(2), z: +v.z.toFixed(1), w, h, d };
      if (h >= 1.8 && w >= 2.5 && d >= 2.5) walls.push(rec);
      else if (h <= 0.7 && w * d >= 8) decks.push(rec);
    } else if ((t === 'CylinderGeometry' && p.radialSegments === 3) ||
               (t === 'ConeGeometry' && p.radialSegments === 4)) {
      if (p.radiusTop > 1 || p.radius > 1.5 || (p.height ?? 0) > 1) {
        o.getWorldPosition(v);
        const s = o.getWorldScale(v.clone());
        o.getWorldPosition(v);
        roofs.push({ x: +v.x.toFixed(1), y: +v.y.toFixed(2), z: +v.z.toFixed(1), type: t,
          r: p.radiusTop ?? p.radius, len: p.height, sy: +s.y.toFixed(2), rotY: +o.rotation.y.toFixed(2) });
      }
    }
  });

  const floaters = [], buried = [];
  for (const b of walls) {
    const bottom = b.y - b.h / 2;
    const corners = [[-1, -1], [1, -1], [-1, 1], [1, 1]]
      .map(([cx, cz]) => th(b.x + cx * b.w / 2, b.z + cz * b.d / 2));
    if (corners.some((c) => c < 0.25)) continue; // over water/shore: piers etc.
    const gap = bottom - Math.min(...corners);
    if (gap > 0.18) floaters.push({ ...b, gap: +gap.toFixed(2) });
  }
  for (const dk of decks) {
    const top = dk.y + dk.h / 2;
    const corners = [[-1, -1], [1, -1], [-1, 1], [1, 1]]
      .map(([cx, cz]) => th(dk.x + cx * dk.w / 2, dk.z + cz * dk.d / 2));
    const worst = Math.max(...corners) - top;
    if (worst > 0.05 && corners.some((c) => c > 0.25)) buried.push({ ...dk, poke: +worst.toFixed(2) });
  }
  // roof fit: match each roof to the wall directly beneath
  const badRoofs = [];
  for (const r of roofs) {
    const wall = walls.filter((b) => Math.hypot(b.x - r.x, b.z - r.z) < 2.5 &&
      r.y > b.y).sort((a, b2) => Math.hypot(a.x - r.x, a.z - r.z) - Math.hypot(b2.x - r.x, b2.z - r.z))[0];
    if (!wall) continue;
    let spanX, spanZ;
    if (r.type === 'CylinderGeometry') {
      // prism: ridge along local x after the house rotateZ; world rot may swap
      const across = 1.732 * r.r, along = r.len;
      const swap = Math.abs(Math.sin(r.rotY)) > 0.7;
      spanX = swap ? across : along;
      spanZ = swap ? along : across;
    } else { // 4-cone: square footprint, diagonal 2r
      spanX = spanZ = 2 * r.r * Math.SQRT1_2 * 2; // inscribed square side x2? conservative: 1.41r
      spanX = spanZ = 1.41 * r.r * 2;
    }
    const defX = wall.w - spanX, defZ = wall.d - spanZ;
    if (defX > 0.3 || defZ > 0.3) {
      badRoofs.push({ at: [r.x, r.z], type: r.type, r: r.r, deficitX: +defX.toFixed(2), deficitZ: +defZ.toFixed(2), wall: [wall.w, wall.d] });
    }
  }
  return { floaters, buried, badRoofs, counts: { walls: walls.length, decks: decks.length, roofs: roofs.length } };
});
console.log(JSON.stringify(report, null, 1));
await browser.close();

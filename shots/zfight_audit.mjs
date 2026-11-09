// zfight_audit — find surfaces that flicker against each other.
//
// Two faces in the same plane, facing the same way, overlapping, in
// different colors, from different meshes: the depth buffer can't decide
// which is in front and they shimmer as the camera moves ("z-fighting").
// Every triangle in the world (meshes as built — NO_MERGE — rooms included)
// is hashed by its plane; within a plane, overlapping pairs are reported,
// grouped by the two source lines that built them (MERGE_AUDIT's add hook).
//
//   PORT=8130 node zfight_audit.mjs          → out/<LABEL>/zfight.json + a summary
//   GAP=0.004 …                               (how close counts as "the same plane", world units)
// Fix at the source: lift the top thing a hair (0.01–0.02), or sink the one
// underneath. Exit code 1 if anything was found.
import fs from 'node:fs';
import path from 'node:path';
import { boot, OUT } from './lib.mjs';

process.env.NO_MERGE = '1';
process.env.MERGE_AUDIT = '1';
const { browser, page } = await boot({});
const GAP = Number(process.env.GAP || 0.004);
const MIN_AREA = Number(process.env.MIN_AREA || 0.01); // square units: smaller than a thumbnail, nobody sees it shimmer

const found = await page.evaluate((GAP, MIN_AREA) => {
  const N = window.__notbell;
  const tris = []; // [meshIndex, ax, ay, az, bx, by, bz, cx, cy, cz, nx, ny, nz]
  const meshes = [];
  const v = [0, 0, 0].map(() => new N.camera.position.constructor());
  const e1 = new N.camera.position.constructor(), e2 = e1.clone(), n = e1.clone();
  const skip = (o) => {
    if (!o.isMesh || o.isInstancedMesh || o.isSkinnedMesh) return true;
    const m = o.material;
    if (Array.isArray(m) || !m || m.transparent || m.polygonOffset || m.depthWrite === false || m.depthTest === false) return true;
    for (let a = o; a; a = a.parent) if (a.name === 'ocean' || a.name === 'sky' || a.name === 'player' || a.name === 'crown') return true;
    // (anything that moves gets placed after boot: where it stands now says nothing)
    for (let a = o; a; a = a.parent) if (a.userData.parts || a.userData.dynamic) return true;
    return false;
  };
  N.scene.updateMatrixWorld(true);
  N.scene.traverse((o) => {
    if (skip(o)) return;
    const g = o.geometry, P = g.attributes.position;
    if (!P) return;
    const idx = g.index, count = idx ? idx.count : P.count;
    if (count > 60000) return; // (the terrain: checked against, not as a source — see below)
    const mi = meshes.length;
    const col = o.material.color ? o.material.color.getHex() : -1;
    meshes.push({ o, col, double: o.material.side === 2 });
    const flip = o.matrixWorld.determinant() < 0;
    for (let i = 0; i < count; i += 3) {
      for (let k = 0; k < 3; k++) v[k].fromBufferAttribute(P, idx ? idx.getX(i + k) : i + k).applyMatrix4(o.matrixWorld);
      e1.subVectors(v[1], v[0]); e2.subVectors(v[2], v[0]); n.crossVectors(e1, e2);
      const area = n.length() / 2;
      if (area < 1e-4) continue;
      n.normalize(); if (flip) n.negate();
      if (n.y < -0.3 && !meshes[mi].double) continue; // (an underside: the camera's always above)
      tris.push([mi, v[0].x, v[0].y, v[0].z, v[1].x, v[1].y, v[1].z, v[2].x, v[2].y, v[2].z, n.x, n.y, n.z]);
    }
  });
  // the terrain too (it's the ground every slab and path sits on)
  N.scene.traverse((o) => {
    if (!o.isMesh || o.geometry.attributes.position?.count <= 60000 || skip(o)) return;
    const mi = meshes.length; meshes.push({ o, col: -2, terrain: true });
    const g = o.geometry, P = g.attributes.position, idx = g.index, count = idx ? idx.count : P.count;
    for (let i = 0; i < count; i += 3) {
      for (let k = 0; k < 3; k++) v[k].fromBufferAttribute(P, idx ? idx.getX(i + k) : i + k).applyMatrix4(o.matrixWorld);
      e1.subVectors(v[1], v[0]); e2.subVectors(v[2], v[0]); n.crossVectors(e1, e2);
      if (n.length() < 2e-4) continue;
      n.normalize();
      if (n.y < 0.999) continue; // (only flat ground can lie flush under a flat thing)
      tris.push([mi, v[0].x, v[0].y, v[0].z, v[1].x, v[1].y, v[1].z, v[2].x, v[2].y, v[2].z, n.x, n.y, n.z]);
    }
  });

  // bucket by plane: normal (2° steps) + offset (GAP steps); check the next offset bucket too
  const buckets = new Map();
  const keyOf = (t, dOff) => {
    const d = t[10] * t[1] + t[11] * t[2] + t[12] * t[3];
    return `${Math.round(t[10] * 30)},${Math.round(t[11] * 30)},${Math.round(t[12] * 30)}|${Math.floor(d / GAP) + dOff}`;
  };
  tris.forEach((t, i) => { const k = keyOf(t, 0); (buckets.get(k) || buckets.set(k, []).get(k)).push(i); });

  // 2D overlap of two coplanar triangles (separating axis, shrunk a hair so
  // triangles that merely share an edge don't count)
  const proj = (t, ax) => {
    const [u, w] = ax;
    return [[t[1 + u], t[1 + w]], [t[4 + u], t[4 + w]], [t[7 + u], t[7 + w]]];
  };
  // area of the overlap: clip triangle A by each edge of B (Sutherland–Hodgman)
  const area2 = (P) => { let a = 0; for (let i = 0; i < P.length; i++) { const p = P[i], q = P[(i + 1) % P.length]; a += p[0] * q[1] - q[0] * p[1]; } return a / 2; };
  const overlapArea = (A, B) => {
    let poly = A.slice();
    const sB = Math.sign(area2(B)) || 1;
    for (let e = 0; e < 3 && poly.length; e++) {
      const p = B[e], q = B[(e + 1) % 3];
      const side = (r) => sB * ((q[0] - p[0]) * (r[1] - p[1]) - (q[1] - p[1]) * (r[0] - p[0]));
      const out = [];
      for (let i = 0; i < poly.length; i++) {
        const c = poly[i], d = poly[(i + 1) % poly.length], sc = side(c), sd = side(d);
        if (sc >= 0) out.push(c);
        if ((sc >= 0) !== (sd >= 0)) { const t = sc / (sc - sd); out.push([c[0] + (d[0] - c[0]) * t, c[1] + (d[1] - c[1]) * t]); }
      }
      poly = out;
    }
    return poly.length >= 3 ? Math.abs(area2(poly)) : 0;
  };
  const overlap = (A, B) => {
    for (const T of [A, B]) {
      for (let e = 0; e < 3; e++) {
        const p = T[e], q = T[(e + 1) % 3];
        const nx = q[1] - p[1], ny = p[0] - q[0];
        const L = Math.hypot(nx, ny) || 1;
        let aMin = Infinity, aMax = -Infinity, bMin = Infinity, bMax = -Infinity;
        for (const r of A) { const s = (r[0] * nx + r[1] * ny) / L; aMin = Math.min(aMin, s); aMax = Math.max(aMax, s); }
        for (const r of B) { const s = (r[0] * nx + r[1] * ny) / L; bMin = Math.min(bMin, s); bMax = Math.max(bMax, s); }
        if (aMax < bMin + 0.01 || bMax < aMin + 0.01) return false;
      }
    }
    return true;
  };
  const pairs = new Map();
  for (const [k, list] of buckets) {
    const [nk, dk] = k.split('|');
    const next = buckets.get(`${nk}|${Number(dk) + 1}`) || [];
    const all = list.concat(next);
    if (all.length < 2 || all.length > 4000) continue;
    const ms = new Set(all.map((i) => tris[i][0]));
    if (ms.size < 2) continue;
    const t0 = tris[all[0]];
    const ax = Math.abs(t0[11]) > 0.7 ? [0, 2] : Math.abs(t0[10]) > 0.7 ? [1, 2] : [0, 1];
    for (let a = 0; a < list.length; a++) {
      const ta = tris[list[a]];
      for (let b = 0; b < all.length; b++) {
        const tb = tris[all[b]];
        if (tb[0] === ta[0] || (b < list.length && b <= a)) continue;
        const ma = meshes[ta[0]], mb = meshes[tb[0]];
        if (ma.col === mb.col) continue; // same color: a fight nobody can see
        const d = Math.abs(ta[10] * (ta[1] - tb[1]) + ta[11] * (ta[2] - tb[2]) + ta[12] * (ta[3] - tb[3]));
        if (d > GAP) continue;
        const PA = proj(ta, ax), PB = proj(tb, ax);
        if (!overlap(PA, PB)) continue;
        const ar = overlapArea(PA, PB);
        if (ar < 1e-4) continue;
        const key = ta[0] < tb[0] ? `${ta[0]}:${tb[0]}` : `${tb[0]}:${ta[0]}`;
        const p = pairs.get(key) || { n: 0, area: 0, at: [ta[1], ta[2], ta[3]] };
        p.n++; p.area += ar;
        pairs.set(key, p);
      }
    }
  }
  const src = (o) => o.__addedBy ? `${o.__addedAt} < ${o.__addedBy}` : (o.__addedAt || o.name || o.type);
  const rootOf = (o) => { let a = o; while (a.parent && a.parent.parent) a = a.parent; return a.name || '?'; };
  return [...pairs].map(([k, p]) => {
    const [i, j] = k.split(':').map(Number);
    const A = meshes[i], B = meshes[j];
    return {
      n: p.n, area: Math.round(p.area * 1000) / 1000, at: p.at.map((x) => Math.round(x * 10) / 10),
      a: { root: rootOf(A.o), col: A.terrain ? 'terrain' : A.col.toString(16).padStart(6, '0'), geo: A.o.geometry.type, src: A.terrain ? 'terrain' : src(A.o) },
      b: { root: rootOf(B.o), col: B.terrain ? 'terrain' : B.col.toString(16).padStart(6, '0'), geo: B.o.geometry.type, src: B.terrain ? 'terrain' : src(B.o) },
    };
  }).filter((p) => p.area >= MIN_AREA).sort((x, y) => y.area - x.area);
}, GAP, MIN_AREA);

fs.mkdirSync(OUT, { recursive: true });
fs.writeFileSync(path.join(OUT, 'zfight.json'), JSON.stringify(found, null, 1));
// group by the pair of source lines (one fix per line pair)
const bySrc = new Map();
for (const f of found) {
  const key = [`${f.a.src}`, `${f.b.src}`].sort().join('  ⟷  ');
  const g = bySrc.get(key) || { n: 0, area: 0, sites: 0, f };
  g.n += f.n; g.area += f.area; g.sites++;
  bySrc.set(key, g);
}
console.log(`${found.length} flickering pairs, from ${bySrc.size} source pairs:`);
for (const [k, g] of [...bySrc].sort((a, b) => b[1].area - a[1].area).slice(0, Number(process.env.TOP || 60))) {
  console.log(`  ${String(g.sites).padStart(4)} sites ${g.area.toFixed(2).padStart(7)} sq  #${g.f.a.col}/${g.f.b.col} ${g.f.a.geo}/${g.f.b.geo} e.g. @${g.f.at}\n        ${k}`);
}
await browser.close();
process.exit(found.length ? 1 : 0);

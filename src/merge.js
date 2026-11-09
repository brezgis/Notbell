// Static merging. A whole island of one-off meshes costs a draw call each
// (and another in the shadow pass). Once an island is built, mergeStatic
// bakes everything that never moves into a few meshes: one per surface
// (roughness, metalness, flat/smooth, sidedness, shadow flags) per patch of
// ground. Colors ride along as vertex colors, so a hundred differently
// painted planks are one draw, and the patches keep frustum and shadow
// culling working (one island-sized mesh would be drawn from everywhere).
//
// A material marked userData.live (the game recolors it later) still merges,
// but only with the parts sharing that very material, which it keeps.
//
// Left alone: anything under a node marked userData.dynamic (it moves, hides,
// or recolors) or userData.noMerge (an interior room), anyone built by
// buildAnimal (userData.parts), anything hidden at merge time, glowing panes
// (they own an emissive material), textures, transparency, instanced meshes,
// and wall-sized boxes (main.js fades those when they're between you and the
// camera — they have to stay their own mesh).
//
// Call it once, last thing in an island's create function. The meshes it
// takes are removed from the scene; the merged ones carry userData.merged
// (the part count) so probes can tell them apart.
import * as THREE from 'three';

// (audit mode only: remember where each object was attached, so the merge
// audit can point at the line that built anything it flags)
if (globalThis.__NOTBELL_MERGE_AUDIT) {
  const add = THREE.Object3D.prototype.add;
  THREE.Object3D.prototype.add = function (...objs) {
    const frames = new Error().stack.split('\n').slice(2).filter((l) => !/three|merge\.js/.test(l));
    const at = frames[0] || '';
    const tidy = (l) => l.trim().replace(/^at /, '').replace(/https?:\/\/[^/]+\//, '');
    for (const o of objs) { o.__addedAt ||= tidy(at); o.__addedBy ||= frames.slice(1, 3).map(tidy).join(' < '); }
    return add.apply(this, objs);
  };
}

const CELL = 100; // world units per patch: about an island each (cull.js does the fine-grained work)

// one material per surface, shared by every island
const MATS = new Map();
// (roughness in steps of 0.05: a flat-shaded cartoon surface can't show the
// difference between 0.85 and 0.87, and every distinct value is another draw)
const q = (v) => Math.round(v * 20) / 20;
function surfaceMat(m) {
  const key = `${q(m.roughness)}|${q(m.metalness)}|${m.flatShading}|${m.side}|${m.fog}`;
  let out = MATS.get(key);
  if (!out) {
    out = new THREE.MeshStandardMaterial({
      vertexColors: true, roughness: q(m.roughness), metalness: q(m.metalness),
      flatShading: m.flatShading, side: m.side, fog: m.fog,
    });
    MATS.set(key, out);
  }
  return out;
}

const MAPS = ['map', 'emissiveMap', 'normalMap', 'bumpMap', 'roughnessMap', 'metalnessMap',
  'alphaMap', 'aoMap', 'lightMap', 'displacementMap', 'envMap'];

// a plain, opaque, untextured, unlit-by-itself surface: bakeable
function plainMaterial(m) {
  if (!m || !m.isMeshStandardMaterial || m.isMeshPhysicalMaterial) return false;
  if (m.transparent || m.opacity < 1 || m.alphaTest > 0 || !m.visible) return false;
  if (m.wireframe || m.polygonOffset || !m.depthWrite || !m.depthTest || m.colorWrite === false) return false;
  if (m.emissive && m.emissive.getHex() !== 0 && !m.userData.live) return false;
  if (m.onBeforeCompile !== THREE.Material.prototype.onBeforeCompile) return false; // (a customized shader)
  for (const k of MAPS) if (m[k]) return false;
  return true;
}

function isWall(g) {
  if (g.type !== 'BoxGeometry') return false;
  const p = g.parameters;
  return p.height >= 2.2 && Math.max(p.width, p.depth) * p.height >= 12;
}

// A baked mesh leaves the scene. Anything hung on it (a window on a wall, a
// flag on a pole) stays put: an empty node takes the mesh's place and keeps
// its children, exactly where they were. (Removing the mesh outright used to
// take its whole subtree with it.)
function retire(o) {
  const parent = o.parent;
  if (o.children.length) {
    const stub = new THREE.Object3D();
    stub.name = o.name;
    stub.position.copy(o.position);
    stub.quaternion.copy(o.quaternion);
    stub.scale.copy(o.scale);
    stub.matrixAutoUpdate = o.matrixAutoUpdate;
    stub.matrix.copy(o.matrix);
    stub.matrixWorld.copy(o.matrixWorld);
    parent.add(stub);
    for (const c of [...o.children]) stub.add(c);
  }
  parent.remove(o);
  // …but it keeps its parent link (just not a place among the children): the
  // renderer never visits it again, while code that still holds it — a door
  // asking where it is — gets the right world position from getWorldPosition()
  o.parent = parent;
  o.userData.baked = true;
  // the merge audit (shots/merge_audit.mjs) watches what was baked: if the
  // game later moves, hides or recolors one of these, it should have been
  // marked userData.dynamic
  if (globalThis.__NOTBELL_MERGE_AUDIT) {
    const m = o.material;
    (globalThis.__mergedParts ||= []).push({
      o, parent, root: auditRoot,
      live: !!m.userData.live, snap: snapshot(o), mat: { c: m.color.getHex(), op: m.opacity, t: m.transparent, e: m.emissive?.getHex(), v: m.visible },
      pw: parent.matrixWorld.clone(), matRef: m, gv: o.geometry.attributes.position.version,
    });
  }
}
let auditRoot = null;
const snapshot = (o) => [o.visible, ...o.position.toArray(), ...o.quaternion.toArray(), ...o.scale.toArray()].join(',');

export function mergeStatic(root) {
  auditRoot = root;
  if (globalThis.__NOTBELL_NO_MERGE) return; // (the clip audit wants every mesh as built)
  root.updateMatrixWorld(true);
  const inv = new THREE.Matrix4().copy(root.matrixWorld).invert();
  const buckets = new Map();
  const sc = new THREE.Vector3(), ctr = new THREE.Vector3();
  const walk = (o, frozen) => {
    if (o.userData.dynamic || o.userData.noMerge || o.userData.parts || (o !== root && !o.visible)) frozen = true;
    if (o.isMesh && !o.isInstancedMesh && !o.isSkinnedMesh && !o.userData.merged) {
      const g = o.geometry;
      g.computeBoundingSphere?.();
      o.getWorldScale(sc);
      const r = (g.boundingSphere?.radius || 0) * Math.max(sc.x, sc.y, sc.z);
      if (r < 0.25) o.castShadow = false; // too small to cast a readable shadow
      const m = o.material;
      const bakeable = !frozen && plainMaterial(m) && !isWall(g) && !o.userData.occlude
        && g.attributes.position && g.attributes.normal && !g.morphAttributes.position
        && g.drawRange.start === 0 && g.drawRange.count === Infinity // (face groups are fine: one material)
        && o.renderOrder === 0 && o.layers.mask === 1;
      if (bakeable) {
        ctr.copy(g.boundingSphere.center).applyMatrix4(o.matrixWorld);
        const cell = `${Math.floor(ctr.x / CELL)},${Math.floor(ctr.z / CELL)}`;
        // (a material marked userData.live is one the game keeps changing —
        // the lamp glass that warms at dusk — so its parts merge as
        // themselves, still wearing it, instead of baked into vertex colors)
        const mat = m.userData.live ? m : surfaceMat(m);
        const key = `${mat.uuid}|${o.castShadow}|${o.receiveShadow}|${cell}`;
        if (!buckets.has(key)) buckets.set(key, { mat, cast: o.castShadow, recv: o.receiveShadow, parts: [] });
        buckets.get(key).parts.push(o);
      }
    }
    for (const c of o.children) walk(c, frozen);
  };
  walk(root, false);

  const mtx = new THREE.Matrix4(), nm = new THREE.Matrix3();
  const v = new THREE.Vector3(), col = new THREE.Color(), vc = new THREE.Color();
  for (const b of buckets.values()) {
    if (b.parts.length < 2) continue;
    let count = 0;
    const geos = b.parts.map((o) => {
      const g = o.geometry.index ? o.geometry.toNonIndexed() : o.geometry;
      count += g.attributes.position.count;
      return { g, o };
    });
    const pos = new Float32Array(count * 3), nor = new Float32Array(count * 3), rgb = new Float32Array(count * 3);
    let at = 0;
    for (const { g, o } of geos) {
      mtx.multiplyMatrices(inv, o.matrixWorld);
      nm.getNormalMatrix(mtx);
      // a mirrored part (negative scale) turns its triangles inside out once
      // baked — three flips the winding for it at draw time; we flip it here
      const flip = mtx.determinant() < 0;
      const P = g.attributes.position, N = g.attributes.normal, C = o.material.vertexColors ? g.attributes.color : null;
      const base = o.material.color;
      for (let i = 0; i < P.count; i++, at++) {
        const src = flip && i % 3 !== 0 ? i + (i % 3 === 1 ? 1 : -1) : i; // (swap each triangle's 2nd and 3rd corner)
        v.fromBufferAttribute(P, src).applyMatrix4(mtx);
        pos[at * 3] = v.x; pos[at * 3 + 1] = v.y; pos[at * 3 + 2] = v.z;
        v.fromBufferAttribute(N, src).applyMatrix3(nm).normalize();
        nor[at * 3] = v.x; nor[at * 3 + 1] = v.y; nor[at * 3 + 2] = v.z;
        col.copy(base);
        if (C) col.multiply(vc.setRGB(C.getX(src), C.getY(src), C.getZ(src)));
        rgb[at * 3] = col.r; rgb[at * 3 + 1] = col.g; rgb[at * 3 + 2] = col.b;
      }
      retire(o);
    }
    const merged = new THREE.BufferGeometry();
    merged.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    merged.setAttribute('normal', new THREE.BufferAttribute(nor, 3));
    merged.setAttribute('color', new THREE.BufferAttribute(rgb, 3));
    merged.computeBoundingSphere();
    merged.computeBoundingBox();
    const mesh = new THREE.Mesh(merged, b.mat);
    mesh.castShadow = b.cast;
    mesh.receiveShadow = b.recv;
    mesh.matrixAutoUpdate = false; // (it never moves; its matrix stays identity)
    mesh.userData.merged = b.parts.length;
    root.add(mesh);
  }
}

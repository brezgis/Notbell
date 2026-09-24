// The tools in your paws. Before this, catching a bug or digging a fossil
// was a toast and a jingle while you stood there with empty paws; now you
// actually hold the rod (line and all), swing the net, and dig.
//
//   play('net' | 'shovel' | 'cast')   one-shot animation
//   holdRod(getTip)                    keep the rod out while fishing; getTip()
//                                      returns the bobber position (or null)
//   putAway()                          everything back in the pockets

import * as THREE from 'three';
import { countItem } from './state.js';
import { isNight } from './calendar.js';
import * as zones from './zones.js';

function mat(color, rough = 0.7) {
  return new THREE.MeshStandardMaterial({ color, flatShading: true, roughness: rough });
}

function makeNet() {
  const g = new THREE.Group();
  const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.035, 1.3, 5), mat(0xa97c50));
  pole.position.y = 0.65;
  g.add(pole);
  const hoop = new THREE.Mesh(new THREE.TorusGeometry(0.24, 0.022, 4, 12), mat(0xd9d2c0));
  hoop.position.y = 1.42;
  g.add(hoop);
  const bag = new THREE.Mesh(new THREE.ConeGeometry(0.23, 0.42, 9, 1, true),
    new THREE.MeshStandardMaterial({ color: 0xffffff, transparent: true, opacity: 0.55, side: THREE.DoubleSide, flatShading: true }));
  bag.rotation.x = Math.PI;
  bag.position.y = 1.22;
  g.add(bag);
  return g;
}

function makeShovel() {
  const g = new THREE.Group();
  const shaft = new THREE.Mesh(new THREE.CylinderGeometry(0.035, 0.04, 1.1, 5), mat(0xa97c50));
  shaft.position.y = 0.55;
  g.add(shaft);
  const grip = new THREE.Mesh(new THREE.BoxGeometry(0.22, 0.05, 0.05), mat(0x6b4a2e));
  grip.position.y = 1.1;
  g.add(grip);
  const blade = new THREE.Mesh(new THREE.BoxGeometry(0.26, 0.3, 0.04), mat(0x9aa3ad, 0.4));
  blade.position.y = -0.1;
  g.add(blade);
  return g;
}

function makeRod() {
  const g = new THREE.Group();
  const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.018, 0.035, 1.8, 5), mat(0x8a5a3a));
  pole.position.y = 0.9;
  g.add(pole);
  const reel = new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.07, 0.06, 8), mat(0xf2cf5b, 0.4));
  reel.rotation.z = Math.PI / 2;
  reel.position.set(0.05, 0.35, 0);
  g.add(reel);
  const tip = new THREE.Object3D();
  tip.position.y = 1.8;
  g.add(tip);
  g.userData.tip = tip;
  return g;
}

let player = null;
let holder = null; // pivot at the paw
const made = {};
let anim = null;   // { kind, t, dur }
let rodTip = null; // () => bobber position, while fishing
let line = null;
const tipWorld = new THREE.Vector3();
const dirt = [];

export function initTools(p) {
  player = p;
  holder = new THREE.Group();
  holder.position.set(0.58, 0.62, 0.22); // at your side, outside the body
  player.group.add(holder);
  line = new THREE.Mesh(new THREE.CylinderGeometry(0.006, 0.006, 1, 3),
    new THREE.MeshBasicMaterial({ color: 0xf5f2e9 }));
  line.visible = false;
  player.group.parent?.add(line);
  // the flashlight: after dark, a soft pool of light on the ground ahead of
  // you (a decal, like the campfire's glow — not a light; the lantern glow
  // stays the only light you carry)
  const cv = document.createElement('canvas');
  cv.width = cv.height = 64;
  const c = cv.getContext('2d');
  const g = c.createRadialGradient(32, 32, 0, 32, 32, 32);
  g.addColorStop(0, 'rgba(255,248,220,0.9)');
  g.addColorStop(0.5, 'rgba(255,240,200,0.35)');
  g.addColorStop(1, 'rgba(255,240,200,0)');
  c.fillStyle = g;
  c.fillRect(0, 0, 64, 64);
  beam = new THREE.Mesh(new THREE.CircleGeometry(1, 16), new THREE.MeshBasicMaterial({
    map: new THREE.CanvasTexture(cv), transparent: true, opacity: 0.55, depthWrite: false,
    blending: THREE.AdditiveBlending, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2,
  }));
  beam.rotation.x = -Math.PI / 2;
  beam.scale.set(1.5, 2.6, 1);
  beam.visible = false;
}
let beam = null;
const beamAt = new THREE.Vector3();

function show(kind) {
  if (!holder) return null;
  if (!made[kind]) {
    made[kind] = kind === 'net' ? makeNet() : kind === 'shovel' ? makeShovel() : makeRod();
    made[kind].traverse((o) => { if (o.isMesh) o.castShadow = true; });
    made[kind].visible = false;
    holder.add(made[kind]);
  }
  for (const k of Object.keys(made)) made[k].visible = k === kind;
  return made[kind];
}

export function play(kind) {
  if (!holder) return;
  show(kind === 'cast' ? 'rod' : kind);
  anim = { kind, t: 0, dur: kind === 'shovel' ? 1.1 : kind === 'cast' ? 0.7 : 0.55 };
}

export function holdRod(getTip) {
  rodTip = getTip;
  show('rod');
}

export function putAway() {
  rodTip = null;
  if (!anim) for (const k of Object.keys(made)) made[k].visible = false;
  if (line) line.visible = false;
}

function puff(x, y, z) {
  const m = new THREE.Mesh(new THREE.IcosahedronGeometry(0.08, 0), mat(0x8a6f4d, 0.95));
  m.position.set(x, y, z);
  m.userData.v = new THREE.Vector3((Math.random() - 0.5) * 1.6, 2 + Math.random(), (Math.random() - 0.5) * 1.6);
  m.userData.life = 0;
  player.group.parent.add(m);
  dirt.push(m);
}

export function updateTools(dt) {
  if (!holder) return;
  if (beam) {
    const on = isNight() && countItem('flashlight') > 0 && zones.current() === 'island' && !player.riding;
    if (on && !beam.parent && player.group.parent) player.group.parent.add(beam);
    beam.visible = on;
    if (on) {
      const p = player.group.position, ry = player.group.rotation.y;
      beamAt.set(p.x + Math.sin(ry) * 3.2, 0, p.z + Math.cos(ry) * 3.2);
      beam.position.set(beamAt.x, zones.groundHeight(beamAt.x, beamAt.z) + 0.08, beamAt.z);
      beam.rotation.z = ry; // the long axis points where you're looking
    }
  }
  if (!line.parent && player.group.parent) player.group.parent.add(line);
  if (anim) {
    anim.t += dt;
    const k = Math.min(1, anim.t / anim.dur);
    if (anim.kind === 'net') {
      // up and over: a big friendly swoop
      holder.rotation.set(-1.6 + Math.sin(k * Math.PI) * -0.4 + k * 2.4, 0, -0.3 + k * 0.6);
    } else if (anim.kind === 'shovel') {
      // two good digs, dirt flying off the second
      const phase = (k * 2) % 1;
      holder.rotation.set(0.5 + Math.sin(phase * Math.PI) * 0.9, 0, 0);
      holder.position.y = 0.62 - Math.sin(phase * Math.PI) * 0.25;
      if (anim.t > anim.dur * 0.75 && !anim.puffed) {
        anim.puffed = true;
        const p = player.group.position, ry = player.group.rotation.y;
        for (let i = 0; i < 6; i++) puff(p.x + Math.sin(ry) * 0.8, p.y + 0.2, p.z + Math.cos(ry) * 0.8);
      }
    } else if (anim.kind === 'cast') {
      // back over the shoulder, then the flick forward
      holder.rotation.set(k < 0.4 ? -k * 3 : -1.2 + (k - 0.4) * 3.3, 0, 0);
    }
    if (k >= 1) {
      anim = null;
      holder.rotation.set(0, 0, 0);
      holder.position.y = 0.62;
      if (!rodTip) for (const kk of Object.keys(made)) made[kk].visible = false;
    }
  } else if (rodTip) {
    holder.rotation.set(0.9, 0, 0); // rod out over the water
  }
  // the line: from the rod tip to the bobber
  const target = rodTip?.();
  if (rodTip && target && made.rod?.visible) {
    made.rod.userData.tip.getWorldPosition(tipWorld);
    const d = tipWorld.distanceTo(target);
    line.visible = true;
    line.position.copy(tipWorld).add(target).multiplyScalar(0.5);
    line.scale.set(1, d, 1);
    line.lookAt(target);
    line.rotateX(Math.PI / 2);
  } else if (line) {
    line.visible = false;
  }
  for (const m of [...dirt]) {
    m.userData.life += dt;
    m.userData.v.y -= 9 * dt;
    m.position.addScaledVector(m.userData.v, dt);
    if (m.userData.life > 0.8) {
      m.parent?.remove(m);
      dirt.splice(dirt.indexOf(m), 1);
    }
  }
}

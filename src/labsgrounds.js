// The Labs' grounds — what the Labs do outdoors when they aren't launching
// things. A wildflower meadow in the middle of the isle, worked by a
// butterfly and a bee who take it very seriously; a gift kiosk (merch!); a
// baby rover behind it with bangs, "vaping" water vapor, who would like
// you to know it isn't a phase; blueberry bushes wherever blueberries felt
// like it; and, off the south shore, a beach: rovers on towels, sandcastles,
// a ball that never quite gets dropped, and one mole on his break.
// Plus picnic tables — the Labs (and BULKO) love a picnic table.
//
// Placement is deterministic without touching the seeded PRNG (a small
// hash), so adding this never reshuffles anything placed after it.

import * as THREE from 'three';
import { SITES, ISLAND6, ISLAND6_BEACH, terrainHeight } from './terrain.js';
import * as zones from './zones.js';
import { register } from './interact.js';
import * as ui from './ui.js';
import * as S from './state.js';
import { ITEMS } from './catalog.js';
import { buildAnimal, animateGait } from './animals.js';
import { buildRover } from './island6.js';
import { kaching, jingle, tone } from './audio.js';
import { turnToward } from './utils.js';

function mat(color, rough = 0.85) {
  return new THREE.MeshStandardMaterial({ color, flatShading: true, roughness: rough });
}
function box(w, h, d, color) {
  const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat(color));
  m.castShadow = m.receiveShadow = true;
  return m;
}
const hash = (i, k = 0) => {
  const x = Math.sin(i * 127.1 + k * 311.7) * 43758.5453;
  return x - Math.floor(x);
};
function sign(text, w, h, bg = '#f3efe2', fg = '#2e3e6b') {
  const cv = document.createElement('canvas');
  cv.width = 512; cv.height = Math.round(512 * h / w);
  const c = cv.getContext('2d');
  c.fillStyle = bg;
  c.fillRect(0, 0, cv.width, cv.height);
  c.fillStyle = fg;
  c.textAlign = 'center';
  c.textBaseline = 'middle';
  let size = cv.height * 0.6;
  do { c.font = `800 ${size}px ui-rounded, "Segoe UI", system-ui, sans-serif`; size -= 2; } while (c.measureText(text).width > cv.width * 0.9 && size > 10);
  c.fillText(text, cv.width / 2, cv.height / 2);
  const tex = new THREE.CanvasTexture(cv);
  tex.colorSpace = THREE.SRGBColorSpace;
  return new THREE.Mesh(new THREE.PlaneGeometry(w, h), new THREE.MeshBasicMaterial({ map: tex }));
}

export function createLabsGrounds() {
  const group = new THREE.Group();
  group.name = 'labsgrounds';
  const updates = [];

  // somewhere open near (x, z): dry, clear of everything, within reach
  function openSpot(x, z, clear = 1.5, maxR = 8) {
    for (let r = 0; r <= maxR; r += 0.75) {
      for (let k = 0; k < (r ? 12 : 1); k++) {
        const a = (k / 12) * Math.PI * 2 + r;
        const px = x + Math.cos(a) * r, pz = z + Math.sin(a) * r;
        if (terrainHeight(px, pz) > 0.35 && !zones.nearAnything(px, pz, clear)) return { x: px, z: pz, y: terrainHeight(px, pz) };
      }
    }
    return null;
  }

  // =================================================== the picnic tables ----
  function picnicTable(x, z, ry) {
    const g = new THREE.Group();
    const top = box(1.9, 0.12, 0.95, 0xa97c50);
    top.position.y = 0.78;
    g.add(top);
    for (const sz of [-0.8, 0.8]) {
      const bench = box(1.9, 0.1, 0.34, 0x96703f);
      bench.position.set(0, 0.45, sz);
      g.add(bench);
    }
    for (const sx of [-0.75, 0.75]) {
      const legs = box(0.1, 0.78, 1.8, 0x7a5a3a);
      legs.position.set(sx, 0.39, 0);
      g.add(legs);
    }
    g.rotation.y = ry;
    g.position.set(x, terrainHeight(x, z), z);
    group.add(g);
    zones.addBlockerBox(x, z, 1.95, 2.0, ry, 0.02);
    return g;
  }
  const Y = SITES.labsYard;
  for (const [dx, dz, ry] of [[-6, 9, 0.2], [-9.5, 7, -0.3], [-3, 12, 0.5]]) {
    const sp = openSpot(Y.x + dx, Y.z + dz, 1.8, 5);
    if (sp) picnicTable(sp.x, sp.z, ry);
  }
  const BB = SITES.bigbox;
  if (BB) {
    for (const [dx, dz, ry] of [[-9, 8, 0.1], [-11, 4.5, -0.2]]) {
      const sp = openSpot(BB.x + dx, BB.z + dz, 1.8, 6);
      if (sp) picnicTable(sp.x, sp.z, ry);
    }
  }

  // ==================================================== the wildflower meadow ----
  const M = openSpot(ISLAND6.x - 1, ISLAND6.z + 8, 1.0, 10) ?? { x: ISLAND6.x, z: ISLAND6.z + 8, y: 1 };
  {
    const stemMat = mat(0x4e9a45);
    const blooms = [0xf2cf5b, 0xf2a0a8, 0xb9a3e8, 0xfbf7ef, 0xe8743a, 0x9ac4e8];
    const bloomMats = blooms.map((c) => mat(c, 0.7));
    for (let i = 0; i < 170; i++) {
      const a = hash(i, 1) * Math.PI * 2, r = Math.sqrt(hash(i, 2)) * 8;
      const x = M.x + Math.cos(a) * r, z = M.z + Math.sin(a) * r * 0.8;
      if (terrainHeight(x, z) < 0.4 || zones.nearAnything(x, z, 0.3)) continue;
      const y = terrainHeight(x, z);
      const h = 0.25 + hash(i, 3) * 0.25;
      const stem = new THREE.Mesh(new THREE.CylinderGeometry(0.018, 0.025, h, 4), stemMat);
      stem.position.set(x, y + h / 2, z);
      const bloom = new THREE.Mesh(new THREE.IcosahedronGeometry(0.07 + hash(i, 4) * 0.04, 0), bloomMats[i % blooms.length]);
      bloom.position.set(x, y + h + 0.03, z);
      group.add(stem, bloom);
    }
    const plaque = sign('WILDFLOWER TRIAL PLOT · DO NOT MOW', 2.2, 0.36, '#f3efe2', '#3f6a3a');
    const pp = openSpot(M.x + 8.5, M.z, 0.6, 3) ?? { x: M.x + 8.5, z: M.z, y: terrainHeight(M.x + 8.5, M.z) };
    const post = box(0.1, 0.9, 0.1, 0x7a5230);
    post.position.set(pp.x, pp.y + 0.45, pp.z);
    plaque.position.set(pp.x, pp.y + 0.95, pp.z + 0.06);
    plaque.rotation.y = Math.PI / 2 * 0; // faces south, toward the beach path
    group.add(post, plaque);
    zones.addBlocker(pp.x, pp.z, 0.15);
  }

  // the meadow's two keepers: a butterfly and a bee, working the flowers
  function meadowWorker(kind, colors, name, lines, voice, speed, bob) {
    const a = buildAnimal(kind, colors);
    a.scale.setScalar(0.85);
    a.position.set(M.x, M.y, M.z);
    group.add(a);
    const st = { t: 0, target: null, pause: 1, hoverY: 0 };
    let li = 0;
    register({
      getPos: () => a.position, r: 2.4,
      label: `talk to ${name}`,
      use: () => ui.say(lines[li++ % lines.length], { speaker: name, voice }),
    });
    updates.push((dt, t, playerPos) => {
      const near = playerPos && Math.hypot(playerPos.x - a.position.x, playerPos.z - a.position.z) < 3;
      const lift = bob(t);
      if (near) {
        a.rotation.y = turnToward(a.rotation.y, Math.atan2(playerPos.x - a.position.x, playerPos.z - a.position.z), dt, 3);
        a.position.y = terrainHeight(a.position.x, a.position.z) + lift;
        animateGait(a, t, 0);
        return;
      }
      if (st.pause > 0 || !st.target) {
        st.pause -= dt;
        if (st.pause <= 0) {
          const ang = Math.random() * Math.PI * 2, rr = Math.random() * 6.5;
          st.target = { x: M.x + Math.cos(ang) * rr, z: M.z + Math.sin(ang) * rr * 0.8 };
        }
        animateGait(a, t, 0);
      } else {
        const dx = st.target.x - a.position.x, dz = st.target.z - a.position.z, d = Math.hypot(dx, dz);
        if (d < 0.2) { st.pause = 2 + Math.random() * 5; st.target = null; } else {
          const nx = a.position.x + (dx / d) * speed * dt, nz = a.position.z + (dz / d) * speed * dt;
          if (zones.islandCanStand(nx, nz, 0.3)) { a.position.x = nx; a.position.z = nz; } else { st.target = null; st.pause = 1; }
          a.rotation.y = turnToward(a.rotation.y, Math.atan2(dx, dz), dt, 4);
          animateGait(a, t, 1, 12);
        }
      }
      a.position.y = terrainHeight(a.position.x, a.position.z) + lift;
    });
  }
  meadowWorker('moth', { body: 0x3a3440, head: 0x3a3440, wing: 0x7ec3e8 }, 'Azure', [
    'Oh! Hello! Mind the asters. And the clover. And — well, mind everything, it’s all flowers, that’s the point.',
    'I’m a butterfly. People keep saying moth. I have a PH.D. in not being a moth.',
    'The Labs let me plant whatever I like, as long as I write it down. I write it down in flowers. They’re coming around to the format.',
    'Buzz is very good at her job. She is TERRIFYING at her job. I admire her enormously from a slight distance.',
  ], 760, 0.9, (t) => 0.35 + Math.sin(t * 2.2) * 0.12);
  meadowWorker('bee', { body: 0xf2c230, head: 0xf2c230 }, 'Buzz', [
    'Pollination survey, row nine. You’re standing in row nine. It’s fine. Row nine is resilient.',
    'Four hundred flowers a morning. I’m not bragging. I’m reporting.',
    'Azure keeps planting things that aren’t on the list. The list is losing. I respect it.',
    'The Labs asked me to write a paper. I made a hexagon. They said that wasn’t a paper. I said it was better.',
  ], 820, 1.4, (t) => 0.25 + Math.abs(Math.sin(t * 5)) * 0.1);

  // ==================================================== blueberry bushes ----
  // here and there, wherever they came up; pick them when they're ripe
  {
    const leafMat = mat(0x3f7a4a, 0.95), berryMat = mat(0x3f4f9a, 0.4);
    const spots = [[-14, 12], [10, 18], [-22, -6], [4, 26], [-8, 30], [16, 8]];
    spots.forEach(([dx, dz], i) => {
      const sp = openSpot(ISLAND6.x + dx, ISLAND6.z + dz, 1.2, 4);
      if (!sp) return;
      const g = new THREE.Group();
      for (const [ox, oy, oz, r] of [[0, 0.45, 0, 0.55], [0.4, 0.35, 0.2, 0.4], [-0.35, 0.35, -0.15, 0.42]]) {
        const blob = new THREE.Mesh(new THREE.IcosahedronGeometry(r, 1), leafMat);
        blob.position.set(ox, oy, oz);
        blob.castShadow = true;
        g.add(blob);
      }
      const berries = [];
      for (let b = 0; b < 9; b++) {
        const a = hash(i * 20 + b, 5) * Math.PI * 2;
        const berry = new THREE.Mesh(new THREE.IcosahedronGeometry(0.07, 0), berryMat);
        berry.position.set(Math.cos(a) * 0.55, 0.3 + hash(i * 20 + b, 6) * 0.4, Math.sin(a) * 0.55);
        g.add(berry);
        berries.push(berry);
      }
      g.position.set(sp.x, sp.y, sp.z);
      group.add(g);
      zones.addBlocker(sp.x, sp.z, 0.6, 'tree');
      const bush = { berries, regrow: 0 };
      register({
        pos: new THREE.Vector3(sp.x, 0, sp.z), r: 1.8,
        enabled: () => bush.berries[0].visible,
        label: 'pick blueberries',
        use: () => {
          bush.berries.forEach((b) => { b.visible = false; });
          bush.regrow = 300 + i * 40;
          S.addItem('blueberries', 2);
          jingle();
          ui.toast('You picked a handful of <b>Blueberries</b>. One for the pocket, one for you.', '🫐');
          ui.updateHUD();
        },
      });
      updates.push((dt) => {
        if (bush.regrow > 0) {
          bush.regrow -= dt;
          if (bush.regrow <= 0) bush.berries.forEach((b) => { b.visible = true; });
        }
      });
    });
  }

  // ====================================================== the gift kiosk ----
  const K = openSpot(M.x + 11, M.z - 4, 2.6, 8) ?? { x: M.x + 11, z: M.z - 4, y: terrainHeight(M.x + 11, M.z - 4) };
  {
    const face = Math.atan2(SITES.labsYard.x - K.x, SITES.labsYard.z - K.z); // opens toward the Labs
    const k = new THREE.Group();
    const counter = box(2.4, 1.0, 1.2, 0x2e3e6b);
    counter.position.y = 0.5;
    k.add(counter);
    const back = box(2.4, 2.4, 0.15, 0xdfe2e6);
    back.position.set(0, 1.2, -0.55);
    k.add(back);
    for (const sx of [-1.1, 1.1]) {
      const post = box(0.1, 2.5, 0.1, 0xdfe2e6);
      post.position.set(sx, 1.25, 0.55);
      k.add(post);
    }
    // striped awning, Labs blue and white
    for (let i = 0; i < 6; i++) {
      const slat = box(0.42, 0.06, 1.5, i % 2 ? 0xf3efe2 : 0x3f6ab0);
      slat.position.set(-1.05 + i * 0.42, 2.55, 0.2);
      slat.rotation.x = 0.25;
      k.add(slat);
    }
    const banner = sign('NOTBELL LABS · GIFTS', 2.4, 0.4, '#3f6ab0', '#f3efe2');
    banner.position.set(0, 2.2, 0.62);
    k.add(banner);
    // the merch, on display: mugs, a folded tee, a little plush rocket
    for (const [x, col] of [[-0.8, 0xf3efe2], [-0.5, 0x3f6ab0]]) {
      const mug = new THREE.Mesh(new THREE.CylinderGeometry(0.1, 0.1, 0.2, 8), mat(col, 0.5));
      mug.position.set(x, 1.1, 0.2);
      k.add(mug);
    }
    const tee = box(0.5, 0.08, 0.4, 0x8a9aa8);
    tee.position.set(0.1, 1.04, 0.2);
    k.add(tee);
    const rocket = new THREE.Group();
    const rb = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.1, 0.35, 7), mat(0xf3efe2));
    const rn = new THREE.Mesh(new THREE.ConeGeometry(0.08, 0.16, 7), mat(0xd84f4f));
    rn.position.y = 0.25;
    rocket.add(rb, rn);
    rocket.position.set(0.75, 1.18, 0.2);
    k.add(rocket);
    k.rotation.y = face;
    k.position.set(K.x, K.y, K.z);
    group.add(k);
    zones.addBlockerBox(K.x, K.z, 2.5, 1.3, face, 0.05);
    // the cashier: a mole from the Boring Department, on a rotation
    const dot = buildAnimal('mole', { body: 0x6a5a50 });
    const bx = K.x - Math.sin(face) * 1.0, bz = K.z - Math.cos(face) * 1.0;
    dot.position.set(bx, terrainHeight(bx, bz), bz);
    dot.rotation.y = face;
    group.add(dot);
    const MERCH = [
      { id: 'labs_mug', price: 18 },
      { id: 'labs_tee', price: 35 },
      { id: 'rocket_plush', price: 60 },
    ];
    const front = { x: K.x + Math.sin(face) * 1.6, z: K.z + Math.cos(face) * 1.6 };
    register({
      pos: new THREE.Vector3(front.x, 0, front.z), r: 1.8,
      label: 'browse the gift kiosk',
      use: async () => {
        const picked = await ui.ask('“Welcome to the gift kiosk. Everything here is science-adjacent.”', [
          ...MERCH.map((m) => ({
            label: `${ITEMS[m.id].emoji} ${ITEMS[m.id].name}`, value: m.id, hint: `${m.price}🔘`,
            disabled: S.state.buttons < m.price,
          })),
          { label: 'Just looking', value: null },
        ], { speaker: 'Dot', voice: 280 });
        const m = MERCH.find((x) => x.id === picked);
        if (!m) return;
        S.spend(m.price);
        S.addItem(m.id);
        kaching();
        ui.updateHUD();
        ui.toast(`You bought <b>${ITEMS[m.id].name}</b>.`, ITEMS[m.id].emoji);
        ui.say(pick3([
          'Thank you for supporting research. That was the research.',
          'No refunds. Not a policy — we just don’t know how.',
          'Wear it on the moon. Somebody will notice. Probably a rover.',
        ]), { speaker: 'Dot', voice: 280 });
      },
    });

    // and behind the kiosk: a baby rover with bangs, "smoking." it's water
    // vapor. it's a whole thing. you wouldn't get it.
    const bx2 = K.x - Math.sin(face) * 2.4 + Math.cos(face) * 1.2;
    const bz2 = K.z - Math.cos(face) * 2.4 - Math.sin(face) * 1.2;
    const emo = buildRover(0x3a3844);
    emo.scale.setScalar(0.75);
    emo.position.set(bx2, terrainHeight(bx2, bz2), bz2);
    emo.rotation.y = face + Math.PI * 0.6; // turned away. obviously.
    const bangs = new THREE.Mesh(new THREE.ConeGeometry(0.1, 0.18, 4), mat(0x16140f, 0.6));
    bangs.rotation.z = Math.PI / 2 + 0.4;
    bangs.position.set(-0.03, 0.05, 0.07);
    emo.userData.head.add(bangs);
    const bottle = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.05, 0.22, 7), mat(0x9ac4e8, 0.2));
    bottle.position.set(0.32, 0.11, 0.25);
    emo.add(bottle);
    group.add(emo);
    zones.addBlocker(bx2, bz2, 0.5);
    const puffs = [];
    for (let i = 0; i < 4; i++) {
      const p = new THREE.Mesh(new THREE.IcosahedronGeometry(0.1, 0),
        new THREE.MeshBasicMaterial({ color: 0xf3f6f8, transparent: true, opacity: 0, depthWrite: false }));
      group.add(p);
      puffs.push(p);
    }
    let puffT = 0;
    const eyeW = new THREE.Vector3();
    updates.push((dt, t) => {
      puffT += dt;
      emo.userData.head.rotation.y = Math.sin(t * 0.4) * 0.4; // looking at nothing, meaningfully
      const cyc = puffT % 6; // every six seconds: one long, thoughtful exhale
      emo.userData.head.getWorldPosition(eyeW);
      puffs.forEach((p, i) => {
        const k = (cyc - i * 0.25) / 2.5;
        if (k < 0 || k > 1) { p.material.opacity = 0; return; }
        p.position.set(eyeW.x + Math.sin(emo.rotation.y) * (0.2 + k * 0.6), eyeW.y + k * 0.9, eyeW.z + Math.cos(emo.rotation.y) * (0.2 + k * 0.6));
        p.scale.setScalar(1 + k * 3);
        p.material.opacity = 0.55 * (1 - k);
      });
    });
    let ei = 0;
    register({
      getPos: () => emo.position, r: 2.0,
      label: 'check on the rover behind the kiosk',
      use: () => {
        tone(330, { dur: 0.2, type: 'sine', vol: 0.03, slide: -60 });
        ui.say([
          '(The little rover exhales a long plume of water vapor and does not look at you.) …It’s just water. It’s a whole thing.',
          'Don’t tell Director Strix I’m back here. Or do. Nothing matters. The moon is so mainstream.',
          '(It swivels its eye toward you, bangs first, then away.) …You can stay. Whatever. It’s fine.',
          'Everyone wants to go to the moon. I want to go to the moon ironically. There’s a difference.',
        ][ei++ % 4]);
      },
    });
  }

  // ====================================================== the south beach ----
  const SB = { x: ISLAND6_BEACH.x, z: ISLAND6_BEACH.z + 1 };
  {
    const sy = (x, z) => terrainHeight(x, z);
    // towels, laid over the sand as it lies
    const towel = (x, z, ry, colA, colB) => {
      const cv = document.createElement('canvas');
      cv.width = 32; cv.height = 64;
      const c = cv.getContext('2d');
      for (let i = 0; i < 8; i++) { c.fillStyle = i % 2 ? colA : colB; c.fillRect(0, i * 8, 32, 8); }
      const tex = new THREE.CanvasTexture(cv);
      tex.colorSpace = THREE.SRGBColorSpace;
      const geo = new THREE.PlaneGeometry(1.1, 2.0, 2, 4);
      geo.rotateX(-Math.PI / 2);
      geo.rotateY(ry);
      const pos = geo.attributes.position;
      for (let i = 0; i < pos.count; i++) pos.setY(i, sy(x + pos.getX(i), z + pos.getZ(i)) + 0.04);
      geo.computeVertexNormals();
      const m = new THREE.Mesh(geo, new THREE.MeshStandardMaterial({ map: tex, roughness: 0.95 }));
      m.position.set(x, 0, z);
      m.receiveShadow = true;
      group.add(m);
    };
    towel(SB.x - 3, SB.z - 1, 0.2, '#f2a0a8', '#fbf7ef');
    towel(SB.x - 1.4, SB.z - 1.3, -0.1, '#9ac4e8', '#fbf7ef');
    towel(SB.x + 3.2, SB.z + 0.4, 0.4, '#f2cf5b', '#e8743a');
    // an umbrella over the pink towel
    const pole = box(0.06, 2.2, 0.06, 0xdfe2e6);
    pole.position.set(SB.x - 3.4, sy(SB.x - 3.4, SB.z - 2) + 1.1, SB.z - 2);
    const canopy = new THREE.Mesh(new THREE.ConeGeometry(1.4, 0.5, 8), mat(0xd84f4f, 0.7));
    canopy.position.set(SB.x - 3.4, sy(SB.x - 3.4, SB.z - 2) + 2.3, SB.z - 2);
    group.add(pole, canopy);
    zones.addBlocker(SB.x - 3.4, SB.z - 2, 0.15);
    // baby rovers: two sunbathing on towels, two at the sandcastle, a ball between them
    const tanning = [];
    for (const [x, z, col] of [[SB.x - 3, SB.z - 1, 0xf6e0e8], [SB.x - 1.4, SB.z - 1.3, 0xdff0f6]]) {
      const r = buildRover(col);
      r.scale.setScalar(0.6);
      r.position.set(x, sy(x, z) + 0.04, z);
      r.rotation.y = Math.PI; // facing the sea
      group.add(r);
      tanning.push(r);
    }
    // the sandcastle: towers, a keep, and a flag
    const CX = SB.x + 1, CZ = SB.z + 2.2, cy = sy(CX, CZ);
    const sand = mat(0xe8d49a, 0.95);
    const keep = new THREE.Mesh(new THREE.CylinderGeometry(0.45, 0.55, 0.6, 8), sand);
    keep.position.set(CX, cy + 0.3, CZ);
    group.add(keep);
    for (let i = 0; i < 4; i++) {
      const a = (i / 4) * Math.PI * 2 + 0.4;
      const tw = new THREE.Mesh(new THREE.CylinderGeometry(0.18, 0.22, 0.5, 7), sand);
      tw.position.set(CX + Math.cos(a) * 0.75, cy + 0.25, CZ + Math.sin(a) * 0.75);
      const cap = new THREE.Mesh(new THREE.ConeGeometry(0.2, 0.25, 7), sand);
      cap.position.set(tw.position.x, cy + 0.62, tw.position.z);
      group.add(tw, cap);
    }
    const flagPole = box(0.02, 0.5, 0.02, 0x7a5230);
    flagPole.position.set(CX, cy + 0.85, CZ);
    const flag = new THREE.Mesh(new THREE.PlaneGeometry(0.22, 0.14), new THREE.MeshBasicMaterial({ color: 0x3f6ab0, side: THREE.DoubleSide }));
    flag.position.set(CX + 0.11, cy + 1.02, CZ);
    group.add(flagPole, flag);
    zones.addBlocker(CX, CZ, 1.0);
    const players = [];
    for (const [dx, col] of [[-2.2, 0xe8e2d2], [2.4, 0xf2e6b8]]) {
      const r = buildRover(col);
      r.scale.setScalar(0.65);
      r.position.set(CX + dx, sy(CX + dx, CZ + 1.8), CZ + 1.8);
      r.rotation.y = dx < 0 ? Math.PI / 2 : -Math.PI / 2;
      group.add(r);
      players.push(r);
    }
    const ball = new THREE.Group();
    const ballColors = [0xd84f4f, 0xfbf7ef, 0x3f6ab0, 0xf2cf5b];
    for (let i = 0; i < 4; i++) {
      const seg = new THREE.Mesh(new THREE.SphereGeometry(0.2, 8, 6, (i / 4) * Math.PI * 2, Math.PI / 2), mat(ballColors[i], 0.5));
      ball.add(seg);
    }
    group.add(ball);
    updates.push((dt, t) => {
      // back and forth, a lazy lob each way
      const k = (t * 0.45) % 2, u = k < 1 ? k : 2 - k;
      const a = players[0].position, b = players[1].position;
      ball.position.set(a.x + (b.x - a.x) * u, cy + 0.35 + Math.sin(u * Math.PI) * 1.6, a.z + (b.z - a.z) * u);
      ball.rotation.x += dt * 3;
      players.forEach((p, i) => {
        const catching = i === 0 ? u < 0.12 : u > 0.88;
        p.userData.head.position.y = 0.82 + (catching ? 0.12 : 0);
        for (const w of p.userData.wheels) w.rotation.x = Math.sin(t * 2 + i) * 0.3;
      });
      tanning.forEach((r, i) => { r.userData.head.rotation.x = -0.5 + Math.sin(t * 0.3 + i) * 0.05; }); // eye to the sun
      flag.rotation.y = Math.sin(t * 2.5) * 0.3;
    });
    // the mole on his break: lawn chair, thermos, hard hat set down beside him
    const MX = SB.x + 4.4, MZ = SB.z - 1.4, my = sy(MX, MZ);
    const chair = new THREE.Group();
    const seat = box(0.8, 0.08, 0.7, 0x5b8b7a);
    seat.position.y = 0.35;
    const cback = box(0.8, 0.7, 0.08, 0x5b8b7a);
    cback.position.set(0, 0.7, -0.35);
    cback.rotation.x = -0.45;
    chair.add(seat, cback);
    chair.position.set(MX, my, MZ);
    chair.rotation.y = Math.PI;
    group.add(chair);
    const mole = buildAnimal('mole', { body: 0x5a4a44 });
    mole.position.set(MX, my + 0.2, MZ);
    mole.rotation.y = Math.PI;
    group.add(mole);
    const thermos = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.08, 0.3, 8), mat(0xd84f4f, 0.4));
    thermos.position.set(MX + 0.6, my + 0.15, MZ);
    const hat = new THREE.Mesh(new THREE.IcosahedronGeometry(0.28, 0), mat(0xf2cf5b, 0.6));
    hat.scale.set(1, 0.6, 1);
    hat.position.set(MX - 0.65, my + 0.12, MZ + 0.2);
    group.add(thermos, hat);
    zones.addBlocker(MX, MZ, 0.6);
    const onBreak = sign('ON BREAK', 0.8, 0.3, '#f2cf5b', '#2e2a26');
    const bp = box(0.05, 0.6, 0.05, 0x7a5230);
    bp.position.set(MX + 0.7, my + 0.3, MZ - 0.6);
    onBreak.position.set(MX + 0.7, my + 0.65, MZ - 0.62);
    onBreak.rotation.y = Math.PI;
    group.add(bp, onBreak);
    let mi = 0;
    register({
      getPos: () => mole.position, r: 2.2,
      label: 'talk to the mole on his break',
      use: () => ui.say([
        'Fifteen minutes. Union rules. The Boring Department fought hard for these fifteen minutes and I intend to feel every one of them.',
        'You know what nobody tells you about digging? The sun. You never see it. So I come here and I just… look at it. Not directly. I’m not an idiot.',
        'The little ones play ball all day. One day they’ll go to the moon. Today, ball.',
        '(He sips from the thermos, very slowly, making eye contact with the horizon.)',
      ][mi++ % 4], { speaker: 'Wendell', voice: 240 }),
    });
    let ti = 0;
    register({
      pos: new THREE.Vector3(SB.x - 2.2, 0, SB.z - 1.2), r: 2.0,
      label: 'say hi to the sunbathing rovers',
      use: () => ui.say([
        '(Two baby rovers lie on their towels, solar panels tilted to the sun. One beeps without opening its eye. That was hello.)',
        '(The pink one rolls over, very slightly, to even out its charge.)',
      ][ti++ % 2]),
    });
  }

  function update(dt, t, playerPos) {
    for (const u of updates) u(dt, t, playerPos);
  }
  return { group, update };
}

function pick3(arr) {
  return arr[Math.floor(Math.random() * arr.length)];
}

// The café gallery. Three framed homages, painted right here in code in a
// chunky island style — legally distinct, emotionally identical. If you
// drop real images into an art/ folder (scream.png, dance.png, autumn.png),
// they'll hang instead.

import * as THREE from 'three';
import { register } from './interact.js';
import * as ui from './ui.js';
import * as S from './state.js';
import { ITEMS } from './catalog.js';
import { kaching } from './audio.js';

function paint(w, h, draw) {
  const cv = document.createElement('canvas');
  cv.width = w;
  cv.height = h;
  draw(cv.getContext('2d'), w, h);
  const tex = new THREE.CanvasTexture(cv);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

// ----- "The Scream" (after Munch, via a small island that means well)
function drawScream(ctx, w, h) {
  const bands = ['#e8632c', '#f2913c', '#ffd23e', '#e8632c', '#c2452c'];
  bands.forEach((c, i) => {
    ctx.fillStyle = c;
    ctx.beginPath();
    ctx.moveTo(0, h * 0.08 * i);
    for (let x = 0; x <= w; x += 8) {
      ctx.lineTo(x, h * 0.08 * i + Math.sin(x * 0.05 + i) * 9);
    }
    ctx.lineTo(w, h * 0.5);
    ctx.lineTo(0, h * 0.5);
    ctx.fill();
  });
  // fjord
  ctx.fillStyle = '#2e3e5c';
  ctx.beginPath();
  ctx.moveTo(0, h * 0.42);
  ctx.lineTo(w, h * 0.34);
  ctx.lineTo(w, h);
  ctx.lineTo(0, h);
  ctx.fill();
  // bridge
  ctx.fillStyle = '#8a5a3a';
  ctx.beginPath();
  ctx.moveTo(0, h);
  ctx.lineTo(w * 0.55, h * 0.45);
  ctx.lineTo(w * 0.62, h * 0.47);
  ctx.lineTo(w * 0.12, h);
  ctx.fill();
  ctx.strokeStyle = '#6b4a2e';
  ctx.lineWidth = 5;
  ctx.beginPath();
  ctx.moveTo(0, h * 0.86);
  ctx.lineTo(w * 0.56, h * 0.42);
  ctx.stroke();
  // the screamer
  const fx = w * 0.42, fy = h * 0.66;
  ctx.fillStyle = '#3a3a4a';
  ctx.beginPath();
  ctx.moveTo(fx - 14, h);
  ctx.quadraticCurveTo(fx - 18, fy + 30, fx, fy + 18);
  ctx.quadraticCurveTo(fx + 18, fy + 30, fx + 14, h);
  ctx.fill();
  ctx.fillStyle = '#e8dcc8';
  ctx.beginPath();
  ctx.ellipse(fx, fy, 16, 22, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = '#2e2a26';
  ctx.beginPath();
  ctx.ellipse(fx - 6, fy - 4, 3.4, 5, 0, 0, Math.PI * 2);
  ctx.ellipse(fx + 6, fy - 4, 3.4, 5, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.beginPath();
  ctx.ellipse(fx, fy + 9, 4.5, 7, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = '#e8dcc8'; // hands on cheeks
  ctx.beginPath();
  ctx.ellipse(fx - 15, fy + 6, 5, 9, -0.4, 0, Math.PI * 2);
  ctx.ellipse(fx + 15, fy + 6, 5, 9, 0.4, 0, Math.PI * 2);
  ctx.fill();
}

// ----- "Dance" (after Matisse; the moths confirm the choreography)
function drawDance(ctx, w, h) {
  ctx.fillStyle = '#27408f';
  ctx.fillRect(0, 0, w, h);
  ctx.fillStyle = '#3f9747';
  ctx.beginPath();
  ctx.moveTo(0, h);
  ctx.quadraticCurveTo(w * 0.5, h * 0.52, w, h);
  ctx.fill();
  ctx.strokeStyle = '#d96a4a';
  ctx.fillStyle = '#d96a4a';
  ctx.lineWidth = 9;
  ctx.lineCap = 'round';
  const cx = w / 2, cy = h * 0.58, R = w * 0.3;
  for (let i = 0; i < 5; i++) {
    const a = (i / 5) * Math.PI * 2 - 0.6;
    const x = cx + Math.cos(a) * R;
    const y = cy + Math.sin(a) * R * 0.62;
    // body
    ctx.beginPath();
    ctx.ellipse(x, y, 8, 17, Math.cos(a) * 0.5, 0, Math.PI * 2);
    ctx.fill();
    // head
    ctx.beginPath();
    ctx.arc(x + Math.cos(a + 1) * 6, y - 20, 6.5, 0, Math.PI * 2);
    ctx.fill();
    // arms reach to the next dancer
    const an = ((i + 1) / 5) * Math.PI * 2 - 0.6;
    const nx = cx + Math.cos(an) * R;
    const ny = cy + Math.sin(an) * R * 0.62;
    ctx.beginPath();
    ctx.moveTo(x, y - 8);
    ctx.quadraticCurveTo((x + nx) / 2, (y + ny) / 2 - 26, nx - 4, ny - 8);
    ctx.stroke();
    // legs mid-step
    ctx.beginPath();
    ctx.moveTo(x, y + 12);
    ctx.lineTo(x - 9, y + 30);
    ctx.moveTo(x, y + 12);
    ctx.lineTo(x + 10, y + 27);
    ctx.stroke();
  }
}

// ----- "Golden Autumn" (after Levitan; Fern's favorite)
function drawGoldenAutumn(ctx, w, h) {
  ctx.fillStyle = '#bcd8ec';
  ctx.fillRect(0, 0, w, h * 0.34);
  ctx.fillStyle = '#e8e4c8'; // far field
  ctx.fillRect(0, h * 0.3, w, h * 0.12);
  ctx.fillStyle = '#9aa84e'; // near meadow
  ctx.fillRect(0, h * 0.4, w, h * 0.6);
  // the river, walking off toward the horizon
  ctx.fillStyle = '#4a78b0';
  ctx.beginPath();
  ctx.moveTo(w * 0.28, h);
  ctx.quadraticCurveTo(w * 0.52, h * 0.66, w * 0.45, h * 0.5);
  ctx.quadraticCurveTo(w * 0.41, h * 0.42, w * 0.52, h * 0.36);
  ctx.lineTo(w * 0.6, h * 0.36);
  ctx.quadraticCurveTo(w * 0.5, h * 0.46, w * 0.58, h * 0.58);
  ctx.quadraticCurveTo(w * 0.66, h * 0.74, w * 0.62, h);
  ctx.fill();
  // distant golden grove
  ctx.fillStyle = '#d9a440';
  for (let x = 0; x < w; x += 14) {
    ctx.beginPath();
    ctx.arc(x + 6, h * 0.32 + (x % 3) * 3, 9, 0, Math.PI * 2);
    ctx.fill();
  }
  // birches on the near bank
  const birch = (bx, by, s) => {
    ctx.strokeStyle = '#f2efe4';
    ctx.lineWidth = 4 * s;
    ctx.beginPath();
    ctx.moveTo(bx, by);
    ctx.lineTo(bx + 3 * s, by - 52 * s);
    ctx.stroke();
    ctx.strokeStyle = '#55483a';
    ctx.lineWidth = 1.5 * s;
    for (let i = 1; i < 4; i++) {
      ctx.beginPath();
      ctx.moveTo(bx + i * s, by - i * 13 * s);
      ctx.lineTo(bx + i * s + 4 * s, by - i * 13 * s - 2);
      ctx.stroke();
    }
    for (const [ox, oy, r] of [[2, -62, 17], [-9, -50, 12], [13, -52, 13]]) {
      ctx.fillStyle = ['#ffd23e', '#e8b43a', '#f2c94c'][Math.abs(ox + oy) % 3];
      ctx.beginPath();
      ctx.arc(bx + ox * s, by + oy * s, r * s, 0, Math.PI * 2);
      ctx.fill();
    }
  };
  birch(w * 0.13, h * 0.78, 1.15);
  birch(w * 0.2, h * 0.66, 0.85);
  birch(w * 0.78, h * 0.72, 1.0);
  birch(w * 0.88, h * 0.6, 0.7);
}

// ----- "The Great Wave" (after Hokusai; the Admiral salutes it)
function drawWave(ctx, w, h) {
  ctx.fillStyle = '#e8dcc8';
  ctx.fillRect(0, 0, w, h);
  // Fuji, small and patient
  ctx.fillStyle = '#7a8a9a';
  ctx.beginPath();
  ctx.moveTo(w * 0.52, h * 0.62);
  ctx.lineTo(w * 0.62, h * 0.45);
  ctx.lineTo(w * 0.72, h * 0.62);
  ctx.fill();
  ctx.fillStyle = '#fffaf0';
  ctx.beginPath();
  ctx.moveTo(w * 0.585, h * 0.51);
  ctx.lineTo(w * 0.62, h * 0.45);
  ctx.lineTo(w * 0.655, h * 0.51);
  ctx.fill();
  // the wave, all claws
  ctx.fillStyle = '#27408f';
  ctx.beginPath();
  ctx.moveTo(0, h);
  ctx.lineTo(0, h * 0.35);
  ctx.bezierCurveTo(w * 0.18, h * 0.05, w * 0.45, h * 0.12, w * 0.42, h * 0.3);
  ctx.bezierCurveTo(w * 0.40, h * 0.42, w * 0.3, h * 0.46, w * 0.26, h * 0.42);
  ctx.bezierCurveTo(w * 0.42, h * 0.6, w * 0.72, h * 0.62, w, h * 0.5);
  ctx.lineTo(w, h);
  ctx.fill();
  // foam claws
  ctx.fillStyle = '#fffaf0';
  for (let i = 0; i < 7; i++) {
    const fx = w * 0.08 + i * w * 0.05, fy = h * (0.22 + (i % 2) * 0.05);
    ctx.beginPath();
    ctx.arc(fx, fy, 8 - (i % 3) * 2, 0, Math.PI * 2);
    ctx.fill();
  }
  // a small stubborn boat
  ctx.fillStyle = '#8a6f4d';
  ctx.beginPath();
  ctx.ellipse(w * 0.62, h * 0.72, 26, 6, -0.15, 0, Math.PI * 2);
  ctx.fill();
}

// ----- "The Starry Swirl" (after a restless Dutchman)
function drawSwirl(ctx, w, h) {
  ctx.fillStyle = '#1a2a5e';
  ctx.fillRect(0, 0, w, h);
  ctx.strokeStyle = '#4a6ab0';
  ctx.lineWidth = 6;
  for (let s = 0; s < 3; s++) {
    ctx.beginPath();
    const cx2 = w * (0.3 + s * 0.25), cy2 = h * (0.22 + (s % 2) * 0.12);
    for (let a = 0; a < Math.PI * 4; a += 0.2) {
      const r = 4 + a * 4.5;
      const px = cx2 + Math.cos(a) * r, py = cy2 + Math.sin(a) * r * 0.6;
      a === 0 ? ctx.moveTo(px, py) : ctx.lineTo(px, py);
    }
    ctx.stroke();
  }
  ctx.fillStyle = '#ffd23e';
  for (let i = 0; i < 9; i++) {
    ctx.beginPath();
    ctx.arc((i * 73) % w, (i * 41) % (h * 0.5), i % 3 ? 5 : 9, 0, Math.PI * 2);
    ctx.fill();
  }
  // village, asleep
  ctx.fillStyle = '#10182e';
  ctx.fillRect(0, h * 0.78, w, h * 0.22);
  for (let i = 0; i < 6; i++) {
    ctx.fillRect(w * 0.1 + i * w * 0.14, h * 0.72, 18, 16);
  }
  ctx.fillStyle = '#ffd23e';
  for (let i = 0; i < 4; i++) ctx.fillRect(w * 0.12 + i * w * 0.2, h * 0.745, 5, 5);
  // cypress
  ctx.fillStyle = '#0e1a10';
  ctx.beginPath();
  ctx.moveTo(w * 0.13, h * 0.85);
  ctx.quadraticCurveTo(w * 0.06, h * 0.5, w * 0.12, h * 0.18);
  ctx.quadraticCurveTo(w * 0.16, h * 0.5, w * 0.17, h * 0.85);
  ctx.fill();
}

// ----- "Girl with a Button Earring" (after Vermeer; localized)
function drawPearl(ctx, w, h) {
  ctx.fillStyle = '#12100e';
  ctx.fillRect(0, 0, w, h);
  // turban: blue wrap, gold fall
  ctx.fillStyle = '#3a6ab0';
  ctx.beginPath();
  ctx.ellipse(w * 0.5, h * 0.3, w * 0.2, h * 0.14, -0.2, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = '#d9a440';
  ctx.beginPath();
  ctx.moveTo(w * 0.62, h * 0.3);
  ctx.quadraticCurveTo(w * 0.72, h * 0.5, w * 0.6, h * 0.72);
  ctx.quadraticCurveTo(w * 0.56, h * 0.52, w * 0.56, h * 0.36);
  ctx.fill();
  // face, turned over the shoulder
  ctx.fillStyle = '#e8c9a8';
  ctx.beginPath();
  ctx.ellipse(w * 0.47, h * 0.46, w * 0.14, h * 0.17, 0.08, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = '#2e2a26';
  ctx.beginPath();
  ctx.ellipse(w * 0.42, h * 0.44, 4, 6, 0, 0, Math.PI * 2);
  ctx.ellipse(w * 0.52, h * 0.45, 4, 6, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = '#b08a6a';
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.moveTo(w * 0.43, h * 0.55);
  ctx.quadraticCurveTo(w * 0.47, h * 0.575, w * 0.51, h * 0.555);
  ctx.stroke();
  // collar
  ctx.fillStyle = '#f6efdc';
  ctx.beginPath();
  ctx.moveTo(w * 0.3, h);
  ctx.quadraticCurveTo(w * 0.48, h * 0.62, w * 0.72, h);
  ctx.fill();
  // the earring: unambiguously a button (four holes)
  ctx.fillStyle = '#f2e8da';
  ctx.beginPath();
  ctx.arc(w * 0.385, h * 0.6, 9, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = '#55504c';
  for (const [bx, by] of [[-3, -3], [3, -3], [-3, 3], [3, 3]]) {
    ctx.beginPath();
    ctx.arc(w * 0.385 + bx, h * 0.6 + by, 1.4, 0, Math.PI * 2);
    ctx.fill();
  }
}

// ----- "Sunflowers" (after van Gogh; do not water)
function drawSunflowers(ctx, w, h) {
  ctx.fillStyle = '#e8c95c';
  ctx.fillRect(0, 0, w, h);
  ctx.fillStyle = '#c9a23c';
  ctx.fillRect(0, h * 0.72, w, h * 0.28);
  // vase
  ctx.fillStyle = '#d9b86a';
  ctx.beginPath();
  ctx.moveTo(w * 0.38, h * 0.68);
  ctx.bezierCurveTo(w * 0.3, h * 0.95, w * 0.7, h * 0.95, w * 0.62, h * 0.68);
  ctx.fill();
  ctx.strokeStyle = '#8a6f2c';
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.moveTo(w * 0.38, h * 0.78);
  ctx.lineTo(w * 0.62, h * 0.78);
  ctx.stroke();
  // blooms in several moods
  const blooms = [[0.3, 0.5, 22], [0.45, 0.36, 26], [0.62, 0.46, 20], [0.52, 0.58, 17], [0.7, 0.6, 14], [0.36, 0.64, 13]];
  for (const [bx, by, r] of blooms) {
    ctx.fillStyle = '#e8a23c';
    for (let p = 0; p < 10; p++) {
      const a = (p / 10) * Math.PI * 2;
      ctx.beginPath();
      ctx.ellipse(w * bx + Math.cos(a) * r, h * by + Math.sin(a) * r, r * 0.45, r * 0.2, a, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.fillStyle = '#6e4a2c';
    ctx.beginPath();
    ctx.arc(w * bx, h * by, r * 0.5, 0, Math.PI * 2);
    ctx.fill();
  }
}

// ----- "The Square" (after Malevich; Howell relates to it)
function drawSquare(ctx, w, h) {
  ctx.fillStyle = '#f2efe8';
  ctx.fillRect(0, 0, w, h);
  ctx.fillStyle = '#16140f';
  const m = w * 0.14;
  ctx.fillRect(m, m + (h - w) / 2, w - m * 2, w - m * 2);
}

// ----- "Wanderer above the Fog" (after Friedrich; Listener documentary)
function drawWanderer(ctx, w, h) {
  const grad = ctx.createLinearGradient(0, 0, 0, h);
  grad.addColorStop(0, '#d8dce4');
  grad.addColorStop(1, '#9aa6b4');
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, w, h);
  // fog banks and drowned peaks
  ctx.fillStyle = '#6e7e92';
  for (const [px, py, pw] of [[0.1, 0.45, 0.25], [0.6, 0.4, 0.3], [0.35, 0.55, 0.2]]) {
    ctx.beginPath();
    ctx.moveTo(w * px, h * py);
    ctx.lineTo(w * (px + pw / 2), h * (py - 0.12));
    ctx.lineTo(w * (px + pw), h * py);
    ctx.fill();
  }
  ctx.fillStyle = 'rgba(232,228,220,0.7)';
  for (let i = 0; i < 4; i++) {
    ctx.beginPath();
    ctx.ellipse(w * (0.2 + i * 0.2), h * (0.5 + (i % 2) * 0.08), w * 0.2, h * 0.05, 0, 0, Math.PI * 2);
    ctx.fill();
  }
  // the dark rock, the small figure, the stick
  ctx.fillStyle = '#2e2a26';
  ctx.beginPath();
  ctx.moveTo(w * 0.2, h);
  ctx.lineTo(w * 0.45, h * 0.62);
  ctx.lineTo(w * 0.72, h);
  ctx.fill();
  ctx.beginPath();
  ctx.ellipse(w * 0.46, h * 0.52, 7, 13, 0, 0, Math.PI * 2); // coat
  ctx.fill();
  ctx.beginPath();
  ctx.arc(w * 0.46, h * 0.44, 5, 0, Math.PI * 2); // head
  ctx.fill();
  ctx.strokeStyle = '#2e2a26';
  ctx.lineWidth = 2.5;
  ctx.beginPath();
  ctx.moveTo(w * 0.51, h * 0.49);
  ctx.lineTo(w * 0.54, h * 0.62);
  ctx.stroke();
}

// ------------------------------------------------------------- frames ----

export const GALLERY = [
  {
    id: 'art_scream', draw: drawScream, w: 224, h: 288, frame: 0x55483a,
    title: 'The Scream',
    label: '“The Scream.” After Munch. On loan from Pip, who swears it’s an original. It is not. The frame might be.',
  },
  {
    id: 'art_dance', draw: drawDance, w: 288, h: 224, frame: 0xd9a440,
    title: 'Dance',
    label: '“Dance.” After Matisse. Luna says this is exactly how the moths look around the lamp at closing time, and she would know.',
  },
  {
    id: 'art_autumn', draw: drawGoldenAutumn, w: 288, h: 224, frame: 0x8a5a3a,
    title: 'Golden Autumn',
    label: '“Golden Autumn.” After Levitan. Fern once stood here an entire afternoon. She says she was “just remembering.” Nobody asked remembering what.',
  },
  {
    id: 'art_wave', draw: drawWave, w: 288, h: 224, frame: 0x2e3e5c,
    title: 'The Great Wave',
    label: '“The Great Wave.” After Hokusai. Captain Brine looked at it once and said, quietly, “accurate.”',
  },
  {
    id: 'art_swirl', draw: drawSwirl, w: 288, h: 224, frame: 0x1a2a5e,
    title: 'The Starry Swirl',
    label: '“The Starry Swirl.” After a restless Dutchman. Murmur has been seen standing in front of it at four in the morning.',
  },
  {
    id: 'art_pearl', draw: drawPearl, w: 224, h: 288, frame: 0x16140f,
    title: 'Girl with a Button Earring',
    label: '“Girl with a Button Earring.” After Vermeer. Pip maintains the earring is a button and has commissioned three essays on the subject.',
  },
  {
    id: 'art_sunflowers', draw: drawSunflowers, w: 224, h: 288, frame: 0xd9a440,
    title: 'Sunflowers',
    label: '“Sunflowers.” After van Gogh. Clover waters it when Luna isn’t looking. Luna is always looking.',
  },
  {
    id: 'art_square', draw: drawSquare, w: 224, h: 288, frame: 0xf2efe8,
    title: 'The Square',
    label: '“The Square.” After Malevich. Howell stood before it a long while and finally said, “same.” Nobody asked him to elaborate. He didn’t.',
  },
  {
    id: 'art_wanderer', draw: drawWanderer, w: 224, h: 288, frame: 0x55504c,
    title: 'Wanderer above the Fog',
    label: '“Wanderer above the Fog.” After Friedrich. The Listeners consider it a documentary about a very good day.',
  },
];

export function artPiece(id) {
  return GALLERY.find((p) => p.id === id);
}

export function paintingTexture(piece) {
  return paint(piece.w, piece.h, piece.draw);
}

function makeFramed(piece) {
  const g = new THREE.Group();
  const W = piece.w / 110, H = piece.h / 110;
  const frame = new THREE.Mesh(new THREE.BoxGeometry(W + 0.22, H + 0.22, 0.1),
    new THREE.MeshStandardMaterial({ color: piece.frame, flatShading: true, roughness: 0.6 }));
  g.add(frame);
  const canvasMesh = new THREE.Mesh(
    new THREE.PlaneGeometry(W, H),
    new THREE.MeshBasicMaterial({ map: paint(piece.w, piece.h, piece.draw) })
  );
  canvasMesh.position.z = 0.06;
  g.add(canvasMesh);

  // a real image in art/ takes precedence, if one exists
  const file = `art/${piece.id.replace('art_', '')}.png`;
  fetch(file).then((res) => {
    if (!res.ok) return;
    new THREE.TextureLoader().load(file, (tex) => {
      tex.colorSpace = THREE.SRGBColorSpace;
      canvasMesh.material.map = tex;
      canvasMesh.material.needsUpdate = true;
    });
  }).catch(() => {});

  return g;
}

export { makeFramed };

// Hang this week's exhibition in the café. Three pieces rotate weekly —
// Luna calls it "the show"; prints are for sale, originals are forever.
export function hangCafeArt(group, B) {
  const spots = [
    { x: B.x - 6.75, y: 2.4, z: B.z - 1.2, rotY: Math.PI / 2 },  // west wall
    { x: B.x - 6.75, y: 2.4, z: B.z + 1.9, rotY: Math.PI / 2 },
    { x: B.x + 6.75, y: 2.4, z: B.z + 0.4, rotY: -Math.PI / 2 }, // east wall
  ];
  const week = Math.floor(Date.now() / (7 * 86400 * 1000));
  const showing = [0, 3, 6].map((k) => GALLERY[(week + k) % GALLERY.length]);

  showing.forEach((piece, i) => {
    const framed = makeFramed(piece);
    const s = spots[i];
    framed.position.set(s.x, s.y, s.z);
    framed.rotation.y = s.rotY;
    group.add(framed);
    register({
      pos: new THREE.Vector3(s.x, 0, s.z), r: 2.0, zone: 'cafe',
      label: `look at “${piece.title}”`,
      use: async () => {
        const item = ITEMS[piece.id];
        const owned = S.countItem(piece.id) > 0 || S.state.donations.includes(piece.id);
        const choice = await ui.ask(piece.label, [
          { label: '🖼️ Buy a print', value: 'buy',
            hint: owned ? 'owned' : `${item.price}🔘`,
            disabled: owned || S.state.buttons < item.price },
          { label: 'Just look a while longer', value: null },
        ]);
        if (choice === 'buy') {
          S.spend(item.price);
          S.addItem(piece.id);
          kaching();
          ui.updateHUD();
          ui.toast(`You bought a print of <b>${piece.title}</b>. The museum would hang it beautifully…`, '🖼️');
        }
      },
    });
  });
}

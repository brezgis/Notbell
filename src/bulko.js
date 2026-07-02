// BULKO. The southern isle. A warehouse, a parking lot nobody can explain,
// a hot dog that costs one and a half buttons and always will, and a
// lobster tank that is Not For Sale because the lobsters live there.

import * as THREE from 'three';
import { ISLAND4, terrainHeight } from './terrain.js';
import * as zones from './zones.js';
import { register } from './interact.js';
import * as ui from './ui.js';
import * as S from './state.js';
import { buildAnimal } from './animals.js';
import { kaching, jingle, sip } from './audio.js';
import { rand, pick, turnToward } from './utils.js';
import { currentWeather } from './almanac.js';
import { isNight } from './calendar.js';

function mat(color, rough = 0.9) {
  return new THREE.MeshStandardMaterial({ color, flatShading: true, roughness: rough });
}

function box(w, h, d, color) {
  const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat(color));
  m.castShadow = true;
  return m;
}

function collectInteriorRoot(parent, startIndex, exclude = []) {
  const skip = new Set(exclude.filter(Boolean));
  const root = new THREE.Group();
  root.add(...parent.children.slice(startIndex).filter((child) => !skip.has(child)));
  parent.add(root);
  return root;
}

function textPanel(lines, w, h, bg, fg, fontPx) {
  const cv = document.createElement('canvas');
  cv.width = w;
  cv.height = h;
  const ctx = cv.getContext('2d');
  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, w, h);
  ctx.fillStyle = fg;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  lines.forEach(([text, y, px], i) => {
    let size = px ?? fontPx;
    do {
      ctx.font = `800 ${size}px ui-rounded, "Segoe UI", system-ui, sans-serif`;
      if (ctx.measureText(text).width <= w * 0.9 || size <= 11) break;
      size -= 2;
    } while (true);
    ctx.fillText(text, w / 2, y);
    void i;
  });
  const tex = new THREE.CanvasTexture(cv);
  tex.colorSpace = THREE.SRGBColorSpace;
  return new THREE.MeshBasicMaterial({ map: tex });
}

const IN = { x: 300, z: 1220 };

const TANK_LINES = [
  'A printed card: “NOT FOR SALE.” Below it, handwritten: “STOP ASKING. —management.” Below that, smaller: “(the lobsters)”',
  'Inside: a tiny couch, a tiny lamp, a tiny rug, and a tiny framed print of “The Great Wave.” One lobster is reading. The other appears to be doing a crossword.',
  'You detect a family resemblance to Barnaby. You decide, wisely, to mention this to neither party.',
  'A staff member walks past, sees you looking, and simply shakes their head — not at you. At the situation. At all of it.',
];

// ============================================================ the TV wall ----
// BULKO's wall of screens, each tuned to a lo-fi "channel." Walk up and the
// dialogue box plays the broadcast; the screens cycle two chunky painted canvas
// frames, in the same code-painted spirit as Luna's rotating café prints.

const TV_WEATHERS = ['clear', 'rain', 'snow', 'fog'];
const TV_AD_KEYS = ['ad_hotdog', 'ad_lantern', 'ad_scuba', 'ad_parm'];

function makeScreenTex(key, frame) {
  const cv = document.createElement('canvas');
  cv.width = 320;
  cv.height = 200;
  const c = cv.getContext('2d');
  const W = cv.width, H = cv.height;

  const dot = (x, y, r, color) => {
    c.fillStyle = color;
    c.beginPath();
    c.arc(x, y, r, 0, Math.PI * 2);
    c.fill();
  };
  const label = (text, wide = 132) => {
    c.fillStyle = 'rgba(255,250,240,0.9)';
    c.fillRect(18, 164, wide, 20);
    c.fillStyle = '#3d3126';
    c.font = '800 14px ui-rounded, "Segoe UI", system-ui, sans-serif';
    c.textBaseline = 'middle';
    c.fillText(text, 26, 174);
  };
  const scan = () => {
    c.fillStyle = 'rgba(255,255,255,0.05)';
    for (let y = frame ? 1 : 0; y < H; y += 4) c.fillRect(0, y, W, 1);
    c.fillStyle = 'rgba(30,24,20,0.08)';
    c.fillRect(0, 0, W, 9);
    c.fillRect(0, H - 9, W, 9);
  };
  const cloud = (x, y, color = '#40576d') => {
    c.fillStyle = color;
    for (const [ox, oy, rx, ry] of [
      [-38, 5, 35, 15], [-12, -1, 42, 18], [22, 2, 37, 16], [54, 7, 28, 13],
    ]) {
      c.beginPath();
      c.ellipse(x + ox, y + oy, rx, ry, 0, 0, Math.PI * 2);
      c.fill();
    }
  };
  const island = (base = '#6ec45a', hill = '#57b65b') => {
    c.fillStyle = '#4a78b0';
    c.beginPath();
    c.moveTo(0, H);
    c.lineTo(0, 124);
    c.quadraticCurveTo(72, 142, 134, 128);
    c.quadraticCurveTo(228, 104, W, 130);
    c.lineTo(W, H);
    c.fill();
    c.fillStyle = base;
    c.beginPath();
    c.moveTo(0, H);
    c.lineTo(0, 154);
    c.quadraticCurveTo(78, 102, 152, 150);
    c.quadraticCurveTo(225, 192, W, 142);
    c.lineTo(W, H);
    c.fill();
    c.fillStyle = hill;
    c.beginPath();
    c.moveTo(24, H);
    c.quadraticCurveTo(98, 118, 180, 162);
    c.lineTo(W, H);
    c.fill();
  };
  const scooch = (x, y, mood = 'plain') => {
    const body = mood === 'snow' ? '#7abf58' : '#6ab04a';
    c.fillStyle = body;
    c.beginPath();
    c.ellipse(x, y, 44, 32, 0, 0, Math.PI * 2);
    c.fill();
    dot(x - 21, y - 25, 12, body);
    dot(x + 21, y - 25, 12, body);
    dot(x - 21, y - 25, 4, '#16140f');
    dot(x + 21, y - 25, 4, '#16140f');
    c.strokeStyle = '#fffaf0';
    c.lineWidth = 4;
    c.lineCap = 'round';
    c.beginPath();
    if (mood === 'fog') {
      c.moveTo(x - 21, y + 3);
      c.lineTo(x + 21, y + 3);
    } else {
      c.moveTo(x - 25, y + 4);
      c.quadraticCurveTo(x, y + (mood === 'snow' ? 19 : 22) + (frame ? 2 : -1), x + 25, y + 4);
    }
    c.stroke();
    if (mood === 'clear') {
      c.strokeStyle = '#16140f';
      c.lineWidth = 5;
      c.beginPath();
      c.moveTo(x - 34, y - 27);
      c.lineTo(x - 10, y - 23);
      c.moveTo(x + 10, y - 23);
      c.lineTo(x + 34, y - 27);
      c.stroke();
      dot(x - 21, y - 24, 8, '#16140f');
      dot(x + 21, y - 24, 8, '#16140f');
    }
    if (mood === 'snow') {
      c.fillStyle = '#e8632c';
      c.fillRect(x - 32, y - 2, 64, 8);
      c.fillRect(x + 15, y + 6, 10, 24);
    }
  };
  const drawHotdog = () => {
    c.fillStyle = '#f2913c';
    c.fillRect(0, 0, W, H);
    c.fillStyle = '#ffd23e';
    c.beginPath();
    c.moveTo(0, 34);
    c.lineTo(W, 12);
    c.lineTo(W, 108);
    c.lineTo(0, 132);
    c.fill();
    c.fillStyle = '#c2452c';
    c.fillRect(0, 142, W, 58);
    c.fillStyle = '#16140f';
    c.font = '900 42px ui-rounded, "Segoe UI", system-ui, sans-serif';
    c.fillText('BULKO', 34, 68 + (frame ? 1 : 0));
    c.fillStyle = '#fffaf0';
    c.beginPath();
    c.ellipse(172, 112, 88, 22, -0.06, 0, Math.PI * 2);
    c.fill();
    c.fillStyle = '#8a4d2c';
    c.beginPath();
    c.ellipse(172, 110 + (frame ? 1 : -1), 75, 12, -0.06, 0, Math.PI * 2);
    c.fill();
    c.strokeStyle = '#6ec45a';
    c.lineWidth = 5;
    c.beginPath();
    for (let x = 96; x < 248; x += 20) {
      c.moveTo(x, 104);
      c.quadraticCurveTo(x + 10, 92 + (frame ? 5 : 0), x + 20, 104);
    }
    c.stroke();
    dot(270, 55, frame ? 18 : 14, '#fffaf0');
    c.fillStyle = '#3d3126';
    c.font = '800 20px ui-rounded, "Segoe UI", system-ui, sans-serif';
    c.fillText('1.5ᵇ', 251, 62);
    c.font = '800 13px ui-rounded, "Segoe UI", system-ui, sans-serif';
    c.fillText('PAY 2  GET HALF BACK', 82, 137);
    label('HOT DOG');
  };

  if (key === 'hoot') {
    c.fillStyle = '#221a35';
    c.fillRect(0, 0, W, H);
    c.fillStyle = '#2e3e6d';
    c.beginPath();
    c.moveTo(0, 92);
    c.bezierCurveTo(70, 42, 146, 68, 214, 34);
    c.bezierCurveTo(256, 16, 292, 20, W, 2);
    c.lineTo(W, H);
    c.lineTo(0, H);
    c.fill();
    dot(260, 40, 22, '#ffd23e');
    dot(269, 36, 21, '#221a35');
    c.fillStyle = '#8a5a3a';
    c.fillRect(0, 132, W, 68);
    c.fillStyle = '#d9a440';
    c.fillRect(58, 126 + (frame ? 2 : 0), 206, 16);
    c.fillStyle = '#3c2a22';
    c.beginPath();
    c.ellipse(160, 102, 36, 48, 0, 0, Math.PI * 2);
    c.fill();
    c.fillStyle = '#5a3b2d';
    c.beginPath();
    c.moveTo(130, 70);
    c.lineTo(108, 46);
    c.lineTo(142, 58);
    c.moveTo(190, 70);
    c.lineTo(212, 46);
    c.lineTo(178, 58);
    c.fill();
    dot(147, 96, 11, '#fffaf0');
    dot(173, 96, 11, '#fffaf0');
    dot(148, 97 + (frame ? 3 : 0), 4, '#1b1816');
    dot(174, 97 + (frame ? 0 : 3), 4, '#1b1816');
    c.fillStyle = '#f2913c';
    c.beginPath();
    c.moveTo(160, 108);
    c.lineTo(150, 119 + (frame ? 2 : 0));
    c.lineTo(170, 119 + (frame ? 2 : 0));
    c.fill();
    c.strokeStyle = '#fffaf0';
    c.lineWidth = 5;
    c.lineCap = 'round';
    c.beginPath();
    c.moveTo(105, 133);
    c.quadraticCurveTo(96, 105, 112, 84 + (frame ? 2 : -2));
    c.moveTo(215, 133);
    c.quadraticCurveTo(226, 108, 214, 84 + (frame ? -2 : 2));
    c.stroke();
    dot(222, 128, 5, '#16140f');
    c.fillRect(220, 130, 4, 20);
    label('LATE NIGHT');
  } else if (key === 'science') {
    c.fillStyle = '#123a39';
    c.fillRect(0, 0, W, H);
    c.fillStyle = '#1d5a56';
    c.fillRect(0, 126, W, 74);
    c.strokeStyle = '#cfeeff';
    c.lineWidth = 4;
    c.beginPath();
    c.arc(86, 74, 38, 0.2, Math.PI * 1.8);
    c.moveTo(116, 98);
    c.lineTo(150, 130);
    c.stroke();
    c.fillStyle = '#cfeeff';
    c.fillRect(60, 128, 108, 9);
    c.fillRect(105, 112, 15, 34);
    dot(236, 58, 18 + (frame ? 2 : 0), '#ffd23e');
    c.strokeStyle = '#fffaf0';
    c.lineWidth = 2;
    c.beginPath();
    c.arc(236, 58, 34, 0, Math.PI * 2);
    c.stroke();
    c.strokeStyle = '#e8632c';
    c.lineWidth = 5;
    c.beginPath();
    c.moveTo(230, 126);
    c.lineTo(248, 82);
    c.lineTo(266, 126);
    c.stroke();
    c.fillStyle = '#fffaf0';
    c.beginPath();
    c.moveTo(248, 78);
    c.lineTo(238, 104);
    c.lineTo(258, 104);
    c.fill();
    c.fillStyle = '#f2913c';
    c.fillRect(216, 126, 64, 12);
    for (let i = 0; i < 6; i++) dot(42 + i * 35, 154 + Math.sin(i + frame) * 4, 4, '#9fdcf7');
    label('NOTBELL SCI');
  } else if (key === 'sea') {
    c.fillStyle = '#e8dcc8';
    c.fillRect(0, 0, W, H);
    c.fillStyle = '#7ec3e8';
    c.fillRect(0, 0, W, 82);
    c.fillStyle = '#1f6f9a';
    c.beginPath();
    c.moveTo(0, H);
    c.lineTo(0, 76);
    c.bezierCurveTo(58, 36, 130, 44, 124, 78);
    c.bezierCurveTo(118, 104, 76, 102, 66, 92);
    c.bezierCurveTo(132, 140, 238, 118, W, 98);
    c.lineTo(W, H);
    c.fill();
    c.fillStyle = '#fffaf0';
    for (let i = 0; i < 9; i++) dot(28 + i * 18, 58 + Math.sin(i + frame) * 6, 8 - (i % 3), '#fffaf0');
    c.fillStyle = '#27408f';
    c.beginPath();
    c.moveTo(0, 150);
    for (let x = 0; x <= W; x += 18) c.lineTo(x, 150 + Math.sin(x * 0.05 + frame) * 8);
    c.lineTo(W, H);
    c.lineTo(0, H);
    c.fill();
    c.fillStyle = '#8a6f4d';
    c.beginPath();
    c.ellipse(220, 136 + (frame ? 2 : -1), 42, 8, -0.12, 0, Math.PI * 2);
    c.fill();
    c.strokeStyle = '#ffd23e';
    c.lineWidth = 5;
    c.beginPath();
    c.moveTo(286, 38);
    c.quadraticCurveTo(300, 64, 282, 78);
    c.stroke();
    label('THE SEA');
  } else if (key === 'weather_clear') {
    c.fillStyle = '#9fdcf7';
    c.fillRect(0, 0, W, H);
    dot(76, 48, 30 + (frame ? 2 : 0), '#ffd23e');
    c.strokeStyle = '#ffd23e';
    c.lineWidth = 5;
    for (let i = 0; i < 12; i++) {
      const a = i / 12 * Math.PI * 2;
      c.beginPath();
      c.moveTo(76 + Math.cos(a) * 42, 48 + Math.sin(a) * 42);
      c.lineTo(76 + Math.cos(a) * 52, 48 + Math.sin(a) * 52);
      c.stroke();
    }
    island();
    c.fillStyle = '#fffaf0';
    for (let i = 0; i < 5; i++) {
      c.beginPath();
      c.ellipse(186 + i * 17, 56 + Math.sin(i + frame) * 2, 18, 7, 0, 0, Math.PI * 2);
      c.fill();
    }
    scooch(234, 130, 'clear');
    label('WEATHER: CLEAR', 144);
  } else if (key === 'weather_rain') {
    c.fillStyle = '#bcd8ec';
    c.fillRect(0, 0, W, H);
    island();
    cloud(118, 42, '#40576d');
    cloud(224, 54, '#354a5d');
    c.strokeStyle = '#fffaf0';
    c.lineWidth = 4;
    c.lineCap = 'round';
    for (let x = 28; x < 294; x += 24) {
      c.beginPath();
      c.moveTo(x + (frame ? 8 : 0), 72);
      c.lineTo(x - 8 + (frame ? 8 : 0), 104);
      c.stroke();
    }
    c.strokeStyle = '#ffd23e';
    c.lineWidth = 8;
    c.beginPath();
    c.moveTo(94, 66);
    c.lineTo(76, 102);
    c.lineTo(108, 94);
    c.lineTo(90, 134);
    c.stroke();
    scooch(236, 130, 'rain');
    label('WEATHER: RAIN', 144);
  } else if (key === 'weather_snow') {
    c.fillStyle = '#cfe8f2';
    c.fillRect(0, 0, W, H);
    island('#e8f0e8', '#d8e3dc');
    cloud(102, 42, '#eef5f5');
    cloud(230, 50, '#dfe8ec');
    for (let i = 0; i < 42; i++) {
      const x = (i * 37 + frame * 9) % W;
      const y = (i * 23 + frame * 5) % 145;
      dot(x, y, i % 3 === 0 ? 3 : 2, '#fffaf0');
    }
    c.fillStyle = '#fffaf0';
    c.beginPath();
    c.ellipse(88, 145, 28, 18, 0, 0, Math.PI * 2);
    c.ellipse(88, 119, 21, 21, 0, 0, Math.PI * 2);
    c.fill();
    dot(81, 116, 3, '#16140f');
    dot(95, 116, 3, '#16140f');
    c.fillStyle = '#f2913c';
    c.beginPath();
    c.moveTo(88, 123);
    c.lineTo(108, 128);
    c.lineTo(88, 132);
    c.fill();
    scooch(238, 130, 'snow');
    label('WEATHER: SNOW', 144);
  } else if (key === 'weather_fog') {
    c.fillStyle = '#aebdc2';
    c.fillRect(0, 0, W, H);
    island('#8fa99c', '#7f9a90');
    c.globalAlpha = 0.82;
    c.fillStyle = '#e8e4d8';
    for (let i = 0; i < 6; i++) {
      const y = 42 + i * 20 + (frame ? 3 : 0);
      c.beginPath();
      c.moveTo(-20, y);
      for (let x = -20; x <= W + 20; x += 18) c.lineTo(x, y + Math.sin(x * 0.035 + i) * 5);
      c.lineTo(W + 20, y + 14);
      c.lineTo(-20, y + 14);
      c.fill();
    }
    c.globalAlpha = 1;
    c.fillStyle = '#5a6b72';
    c.fillRect(64, 84, 18, 72);
    c.fillStyle = '#6e7c82';
    c.fillRect(52, 70, 42, 18);
    c.fillStyle = '#ffd23e';
    c.beginPath();
    c.moveTo(73, 76);
    c.quadraticCurveTo(112, 66, 152, 72 + (frame ? 3 : -3));
    c.quadraticCurveTo(112, 84, 73, 82);
    c.fill();
    scooch(238, 132, 'fog');
    label('WEATHER: FOG', 144);
  } else if (key === 'ad_hotdog') {
    drawHotdog();
  } else if (key === 'ad_lantern') {
    c.fillStyle = '#2e2540';
    c.fillRect(0, 0, W, H);
    c.fillStyle = '#5b3e2f';
    c.fillRect(0, 134, W, 66);
    c.fillStyle = '#f2b88c';
    c.beginPath();
    c.moveTo(0, 58);
    c.quadraticCurveTo(82, 28, 162, 58);
    c.quadraticCurveTo(238, 88, W, 42);
    c.lineTo(W, 134);
    c.lineTo(0, 134);
    c.fill();
    c.fillStyle = '#ffd23e';
    c.beginPath();
    c.ellipse(158, 76, 64 + (frame ? 4 : 0), 42 + (frame ? 2 : 0), 0, 0, Math.PI * 2);
    c.fill();
    c.fillStyle = '#8a5a3a';
    c.fillRect(130, 84, 56, 48);
    c.fillStyle = '#f7ead3';
    c.beginPath();
    c.ellipse(158, 80, 20, 24, 0, 0, Math.PI * 2);
    c.fill();
    c.strokeStyle = '#3d3126';
    c.lineWidth = 6;
    c.beginPath();
    c.arc(158, 56, 28, Math.PI, 0);
    c.stroke();
    c.fillStyle = '#fffaf0';
    c.beginPath();
    c.ellipse(76, 124 + (frame ? 1 : -1), 35, 12, 0, 0, Math.PI * 2);
    c.fill();
    c.fillStyle = '#4a2d24';
    c.beginPath();
    c.ellipse(76, 122 + (frame ? 1 : -1), 25, 7, 0, 0, Math.PI * 2);
    c.fill();
    c.fillStyle = '#d9a440';
    c.beginPath();
    c.moveTo(238, 92);
    c.lineTo(250, 128);
    c.lineTo(226, 128);
    c.fill();
    dot(238, 84, 13, '#3c2a22');
    c.strokeStyle = '#fffaf0';
    c.lineWidth = 4;
    c.beginPath();
    c.moveTo(218, 112 + frame);
    c.quadraticCurveTo(238, 98, 258, 112 + frame);
    c.stroke();
    c.fillStyle = '#fffaf0';
    c.font = '900 25px ui-rounded, "Segoe UI", system-ui, sans-serif';
    c.fillText('NOT DECAF', 38, 47);
    label('LANTERN ROOM', 162);
  } else if (key === 'ad_scuba') {
    c.fillStyle = '#7ec3e8';
    c.fillRect(0, 0, W, H);
    c.fillStyle = '#1f6f9a';
    c.beginPath();
    c.moveTo(0, H);
    c.lineTo(0, 88);
    for (let x = 0; x <= W; x += 16) c.lineTo(x, 88 + Math.sin(x * 0.05 + frame) * 7);
    c.lineTo(W, H);
    c.fill();
    c.fillStyle = '#27408f';
    c.beginPath();
    c.moveTo(0, H);
    c.lineTo(0, 142);
    for (let x = 0; x <= W; x += 20) c.lineTo(x, 142 + Math.sin(x * 0.04 + 2 + frame) * 10);
    c.lineTo(W, H);
    c.fill();
    c.fillStyle = '#c9962e';
    c.beginPath();
    c.ellipse(158, 84 + (frame ? 2 : -1), 48, 55, 0, 0, Math.PI * 2);
    c.fill();
    c.fillRect(118, 88 + (frame ? 2 : -1), 80, 42);
    c.fillStyle = '#7a5a2c';
    c.fillRect(112, 126 + (frame ? 2 : -1), 92, 14);
    c.fillStyle = '#bfe6f2';
    c.beginPath();
    c.ellipse(158, 78 + (frame ? 2 : -1), 26, 22, 0, 0, Math.PI * 2);
    c.fill();
    c.strokeStyle = '#6b4a2e';
    c.lineWidth = 7;
    c.beginPath();
    c.ellipse(158, 78 + (frame ? 2 : -1), 30, 26, 0, 0, Math.PI * 2);
    c.stroke();
    c.fillStyle = '#fffaf0';
    c.font = '900 28px ui-rounded, "Segoe UI", system-ui, sans-serif';
    c.fillText('SWIM', 34, 49);
    c.fillText('WHERE FISH', 178, 49);
    c.font = '900 20px ui-rounded, "Segoe UI", system-ui, sans-serif';
    c.fillText('GOSSIP', 203, 73);
    c.fillStyle = '#3d3126';
    c.beginPath();
    c.moveTo(72, 86);
    c.lineTo(92, 96);
    c.lineTo(72, 106);
    c.lineTo(76, 96);
    c.fill();
    c.beginPath();
    c.moveTo(244, 122);
    c.lineTo(266, 132);
    c.lineTo(244, 142);
    c.lineTo(250, 132);
    c.fill();
    label('PIP SUIT');
  } else if (key === 'ad_parm') {
    c.fillStyle = '#fff0a8';
    c.fillRect(0, 0, W, H);
    c.fillStyle = '#d9a440';
    c.beginPath();
    c.moveTo(0, 0);
    c.lineTo(W, 0);
    c.lineTo(W, 72);
    c.quadraticCurveTo(180, 96, 0, 72);
    c.fill();
    c.fillStyle = '#e8743a';
    c.fillRect(0, 140, W, 60);
    for (let i = 0; i < 6; i++) {
      const x = 82 + i * 24 - (frame ? 5 : 0);
      c.fillStyle = i % 2 ? '#f2c94c' : '#ffd23e';
      c.beginPath();
      c.ellipse(x, 108 - i * 2, 31, 18, -0.08, 0, Math.PI * 2);
      c.fill();
      c.fillStyle = '#c9962e';
      c.beginPath();
      c.ellipse(x, 108 - i * 2, 21, 10, -0.08, 0, Math.PI * 2);
      c.fill();
    }
    c.fillStyle = '#fffaf0';
    c.beginPath();
    c.ellipse(236, 116 + (frame ? 2 : -1), 50, 24, 0, 0, Math.PI * 2);
    c.fill();
    c.fillStyle = '#ffd23e';
    c.beginPath();
    c.ellipse(236, 116 + (frame ? 2 : -1), 38, 17, 0, 0, Math.PI * 2);
    c.fill();
    for (let i = 0; i < 9; i++) dot(215 + i * 6, 110 + (i % 3) * 5 + (frame ? 1 : 0), 2.5, '#c9962e');
    c.fillStyle = '#16140f';
    c.font = '900 39px ui-rounded, "Segoe UI", system-ui, sans-serif';
    c.fillText('PARM', 28, 58 + (frame ? 1 : 0));
    c.font = '900 24px ui-rounded, "Segoe UI", system-ui, sans-serif';
    c.fillText('WHEEL', 44, 86 + (frame ? 1 : 0));
    c.font = '800 13px ui-rounded, "Segoe UI", system-ui, sans-serif';
    c.fillText('IT IS A WHEEL', 188, 153);
    label('PARM WHEEL', 142);
  }
  scan();
  const tex = new THREE.CanvasTexture(cv);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

// ---- channel content ----
const HOOT = 'Late Night with Hoot McLaughlin', HOOT_V = 500;
const HOOT_BITS = [
  [{ speaker: HOOT, voice: HOOT_V, text: 'Good evening. Or morning. The clock and I have an understanding: it doesn’t tell me, and I don’t ask.' },
   { speaker: HOOT, voice: HOOT_V, text: 'Our top story: nothing happened today, beautifully, on every island. More on that never.' }],
  [{ speaker: HOOT, voice: HOOT_V, text: 'My guest tonight has played the Lantern Room every evening for — how long now?' },
   { speaker: 'Chip', voice: 760, text: 'Since before the candle. I don’t keep time. I keep tempo. Different thing.' },
   { speaker: HOOT, voice: HOOT_V, text: 'And the secret to a good set?' },
   { speaker: 'Chip', voice: 760, text: 'Play till the room forgets it’s a room. Then play one more.' }],
  [{ speaker: HOOT, voice: HOOT_V, text: 'I tried to book the volcano. She no-commented for four hundred years. You have to respect the discipline.' }],
  [{ speaker: HOOT, voice: HOOT_V, text: 'Tonight’s guest cancelled. Tonight’s guest is the sea — a wonderful listener and a TERRIBLE guest. Took the whole couch. Then took the couch BACK.' }],
  [{ speaker: HOOT, voice: HOOT_V, text: 'That’s our show. We’re always right back. There is, structurally, nowhere else to be. Goodnight, Notbell.' }],
];
const HOOT_NIGHT = [{ speaker: HOOT, voice: HOOT_V, text: 'You’re watching at this hour. So am I. We are not so different — you, and the owl on the screen.' }];

const SCOOCH = 'Weather with Scooch', SCOOCH_V = 360;
function scoochWeather() {
  const line = {
    clear: 'Today: clear. Sunny. Cloudless. *Devastating.* For tomorrow I am forecasting rain. I am always forecasting rain. One day I will be right and it will be the finest day of my life.',
    rain: 'RAIN. It is RAINING. I prepared remarks; I have lost them to joy. Back to you — back to ME — I am simply going to stand in it.',
    snow: 'Snow today: that is rain that tried its absolute best, and I am PROUD of it. Catch one on your tongue. It counts. Let me have this.',
    fog: 'Fog. The sky is thinking. Visibility low, mystery high — and there is rain in there somewhere, I can feel it. I am, admittedly, always a little damp.',
  }[currentWeather()] || 'Conditions: unclear. Like my heart. Which wants rain.';
  return [{ speaker: SCOOCH, voice: SCOOCH_V, text: line }];
}

const NEWT = 'Notbell Science with Newt Bellows', NEWT_V = 580;
const SCIENCE_FACTS = [
  'Here’s one that gets me EVERY time: pumice — the stone that forms when lava cools mid-air — is so full of bubbles it FLOATS. A rock! The only one on Earth that floats!',
  'When a volcano erupts, ash smashing together builds up static — like shuffling across a carpet, but sky-sized — and you get real LIGHTNING, right inside the eruption!',
  'The tallest volcano in the solar system isn’t here — it’s Olympus Mons, on Mars: three Everests tall, but so gently sloped you might not notice you were climbing it!',
  'That orange glow of lava isn’t a colour it “has” — it’s its TEMPERATURE made visible! Same physics as a lightbulb. About 1,200 degrees looks exactly like THAT.',
  'Plot twist: coral is an ANIMAL — each polyp a tiny cousin of the jellyfish, a millimetre or two across. BILLIONS of them build a reef you can see from orbit!',
  'Shine ultraviolet light on a reef at night and it glows like a neon city — corals drink in light and beam it back as greens and oranges and reds. It doubles as sunscreen!',
  'Every manta ray has a unique pattern of spots on its belly — like a fingerprint, for life! Scientists photograph them and keep a whole database of named rays.',
  'Sharks have NO bones — not one! The skeleton is all cartilage, like your nose and ears: lighter and bendier. That’s how a reef shark turns on a dime.',
  'A shark can feel the faint electric crackle of a heartbeat through jelly-filled pores in its snout — down to a BILLIONTH of a volt. It finds fish buried in sand, eyes shut!',
  'A firefly’s glow is “cold light”: nearly ALL the energy becomes light, almost none lost as heat. A lightbulb wastes ninety percent as heat. The firefly is simply better at it!',
  'Dragonflies catch up to 95% of what they chase — the best aerial hunters we’ve measured! They don’t aim where the prey is; they intercept where it’s GOING.',
  'Some cicadas wait underground exactly 13 or 17 years before emerging — both PRIME numbers! A prime cycle almost never lines up with a predator’s. Sneaky little mathematicians.',
  'The astronauts who walked the Moon said the dust smelled like gunpowder — and we still can’t fully say why. The Moon kept a little secret in its pockets!',
  'Bootprints on the Moon? Still there — no wind, no rain — and they’ll last MILLIONS of years. You could leave a footprint that outlasts the pyramids many times over.',
  'At the Moon’s average distance, you could line up all seven other planets in the gap between here and there — and they would just barely fit. Space is roomy!',
  'The Moon drifts away from us about 3.8 cm a year — the speed your fingernails grow. We know because astronauts left mirrors up there and we bounce lasers off them!',
];

const SEA_BITS = [
  'The screen shows the sea, doing what the sea does: arriving, leaving, arriving. The sound is just… the sea. Your shoulders drop an inch.',
  'Wave. Wave. Gull. Wave. (This programming is unsponsored. The sea declined to monetize.)',
  'All the screens show the same gentle sea — except one, which is a window. Nobody can tell which, including the staff, including the window.',
];

const TV_ADS = [
  { key: 'ad_hotdog',
    text: 'BULKO: the one-and-a-half-button hot dog. Pay two, get half a button back. We don’t understand it. You don’t understand it. DO NOT WORRY ABOUT IT.' },
  { key: 'ad_lantern',
    text: 'The Lantern Room — Lantern Roast, NOT decaf, and Chip plays till the candle’s out. Tell Luna the TV sent you. (Luna will be confused.)' },
  { key: 'ad_scuba',
    text: 'Wet feet? Cold feet? Pip’s got the scuba suit: unsellable, like a true friend. Go on — swim where the fish gossip.' },
  { key: 'ad_parm',
    text: 'BULKO Members: the parm wheel. It is a WHEEL. Of PARM. Roll one home today. (Barnaby pays extra for cousins of the parm. Don’t ask.)' },
];

export function createBulko(player) {
  const group = new THREE.Group();
  const updates = [];
  const C = ISLAND4;
  const cy = terrainHeight(C.x, C.z);

  // ------------------------------------------------------ the warehouse ----
  const wx = C.x, wz = C.z - 7;
  {
    const ext = new THREE.Group();
    const hull = box(20, 7, 10, 0x9aa0a6);
    hull.position.y = 3.5;
    ext.add(hull);
    const trim = box(20.2, 1.0, 10.2, 0x6e7479);
    trim.position.y = 6.6;
    ext.add(trim);
    // the sign: red, enormous, certain of itself
    const sign = new THREE.Mesh(new THREE.PlaneGeometry(9, 2.2),
      textPanel([['BULKO', 64, 96]], 512, 128, '#c2452c', '#fffaf0'));
    sign.position.set(0, 5.6, 5.11);
    ext.add(sign);
    const doors = box(4.2, 3.2, 0.3, 0x3a4a5c);
    doors.position.set(-3, 1.6, 5.05);
    ext.add(doors);
    const doorSplit = box(0.12, 3.2, 0.34, 0x9aa0a6);
    doorSplit.position.set(-3, 1.6, 5.06);
    ext.add(doorSplit);
    // the staff entrance, on the dock side — which is the side everyone
    // actually arrives from, so it gets a sign too
    const backDoors = box(3.6, 3.0, 0.3, 0x3a4a5c);
    backDoors.position.set(2, 1.5, -5.05);
    ext.add(backDoors);
    const backSign = new THREE.Mesh(new THREE.PlaneGeometry(7.4, 1.35),
      textPanel([['BULKO  ·  STAFF ENTRANCE', 64, 38]], 640, 128, '#c2452c', '#fffaf0'));
    backSign.position.set(0, 5.2, -5.11);
    backSign.rotation.y = Math.PI;
    ext.add(backSign);
    ext.position.set(wx, cy, wz);
    ext.traverse((o) => { if (o.isMesh && !o.material.map) o.castShadow = true; });
    group.add(ext);
    // two circles approximate the long rectangle without sealing the doors
    zones.addBlocker(wx - 5, wz - 0.5, 7);
    zones.addBlocker(wx + 5, wz - 0.5, 7);
    register({
      pos: new THREE.Vector3(wx + 2, 0, wz - 5.8), r: 2.8,
      label: 'enter BULKO (staff entrance)',
      use: async () => {
        await zones.go('bulko');
        if (!S.hasFlag('staffDoor')) {
          S.setFlag('staffDoor');
          ui.say('A handwritten note on the staff door: "EVERYONE USES THIS ONE. THE FRONT IS FOR THE CARS."');
        }
      },
    });
  }

  // ----------------------------------------------------- the parking lot ----
  // Stall lines, carts, and cars. There are no roads on any island.
  const lotZ = C.z + 4;
  for (let i = 0; i < 8; i++) {
    const lx = C.x - 10.5 + i * 3;
    const line = box(0.18, 0.05, 4.4, 0xe8e4d8);
    line.position.set(lx, terrainHeight(lx, lotZ) + 0.06, lotZ);
    group.add(line);
  }
  const carColors = [0xb0453a, 0x5b8bc9, 0xd9c08f, 0x4f8f6a, 0x6e5a8a];
  for (let i = 0; i < 5; i++) {
    if (i === 2) continue; // one empty stall, for mystery
    const carX = C.x - 9 + i * 3;
    const carY = terrainHeight(carX, lotZ);
    const car = new THREE.Group();
    const body = box(2.0, 0.7, 3.4, carColors[i]);
    body.position.y = 0.65;
    car.add(body);
    const cab = box(1.7, 0.6, 1.7, carColors[i]);
    cab.position.set(0, 1.25, -0.2);
    car.add(cab);
    const glass = box(1.72, 0.4, 1.0, 0xbfe6f2);
    glass.position.set(0, 1.3, 0.4);
    car.add(glass);
    for (const [sx, sz] of [[-1, 1.1], [1, 1.1], [-1, -1.1], [1, -1.1]]) {
      const wheel = new THREE.Mesh(new THREE.CylinderGeometry(0.32, 0.32, 0.22, 8), mat(0x2e2a26));
      wheel.rotation.z = Math.PI / 2;
      wheel.position.set(sx * 1.05, 0.32, sz);
      car.add(wheel);
    }
    car.position.set(carX, carY, lotZ);
    car.rotation.y = rand(-0.06, 0.06);
    car.traverse((o) => { if (o.isMesh) o.castShadow = true; });
    group.add(car);
    zones.addBlocker(carX, lotZ, 1.9);
  }
  register({
    pos: new THREE.Vector3(C.x - 3, 0, lotZ + 3), r: 3,
    label: 'wonder about the cars',
    use: () => ui.say([
      'There are no roads on this island. There are no roads on ANY island. There have never been roads.',
      'The cars are here anyway, parked neatly, a little warm, as if recently driven.',
      'A small sign at the lot’s edge reads: “DO NOT WORRY ABOUT IT.”',
    ]),
  });
  // a stray shopping cart, wheels akimbo
  const cart = new THREE.Group();
  const basket = box(0.9, 0.6, 1.2, 0xb8beba);
  basket.position.y = 0.85;
  cart.add(basket);
  for (const [sx, sz] of [[-0.35, 0.5], [0.35, 0.5], [-0.35, -0.5], [0.35, -0.5]]) {
    const cw = new THREE.Mesh(new THREE.CylinderGeometry(0.09, 0.09, 0.06, 6), mat(0x55504c));
    cw.rotation.z = Math.PI / 2;
    cw.position.set(sx, 0.1, sz);
    cart.add(cw);
  }
  cart.position.set(C.x + 7, terrainHeight(C.x + 7, C.z + 7), C.z + 7);
  cart.rotation.y = 2.2; // abandoned mid-thought
  group.add(cart);

  // ---------------------------------------------------------- ferry dock ----
  // every other pier points home — but home is BEHIND the warehouse here, and
  // ferry passengers deserve to step off on the door side, not orienteer the
  // long way around a big box. the pier points west; the entrance agrees.
  const dockA = -Math.PI / 2;
  const dox = Math.sin(dockA), doz = Math.cos(dockA);
  let shoreT = C.r - 6;
  while (terrainHeight(C.x + dox * (shoreT + 0.5), C.z + doz * (shoreT + 0.5)) >= 0.15) shoreT += 0.5;
  const dock = { x: C.x + dox * shoreT, z: C.z + doz * shoreT };
  for (let i = 0; i < 7; i++) {
    const plank = box(2.4, 0.18, 1.0, i % 4 === 2 ? 0x96703f : 0xa97c50);
    plank.position.set(dock.x + dox * (i + 0.5), 0.55, dock.z + doz * (i + 0.5));
    plank.rotation.y = dockA;
    group.add(plank);
  }
  zones.addCrossing({
    contains(x, z) {
      const dx = x - dock.x, dz = z - dock.z;
      const t = dx * dox + dz * doz;
      if (t < -0.5 || t > 7.5) return false;
      return Math.abs(dx * -doz + dz * dox) < 1.25;
    },
    height: () => 0.64,
  });
  const buoy = new THREE.Group();
  const bb = new THREE.Mesh(new THREE.CylinderGeometry(0.4, 0.55, 1.0, 7), mat(0xb0453a));
  bb.position.y = 0.5;
  buoy.add(bb);
  const bt = new THREE.Mesh(new THREE.IcosahedronGeometry(0.22, 0), mat(0xf2cf5b, 0.4));
  bt.position.y = 1.2;
  buoy.add(bt);
  buoy.position.set(dock.x - dox * 2, terrainHeight(dock.x - dox * 2, dock.z - doz * 2), dock.z - doz * 2);
  buoy.traverse((o) => { if (o.isMesh) o.castShadow = true; });
  group.add(buoy);
  // (boats.js wires the ferry stops — this buoy is just the landmark)
  BULKO_DOCK.x = dock.x - dox * 1.5;
  BULKO_DOCK.z = dock.z - doz * 1.5;
  BULKO_DOCK.rotY = dockA + Math.PI;
  BULKO_DOCK.buoyPos = buoy.position;

  // ------------------------------------------------------- the billboard ----
  // on Notbell's south shore, where it can work on everyone's subconscious
  {
    let bz = 20;
    while (terrainHeight(6, bz + 0.6) >= 0.4) bz += 0.6;
    const by = terrainHeight(6, bz - 1.5);
    const bill = new THREE.Group();
    for (const sx of [-2.6, 2.6]) {
      const post = box(0.22, 4.4, 0.22, 0x6b4a2e);
      post.position.set(sx, 2.2, 0);
      bill.add(post);
    }
    const panel = new THREE.Mesh(new THREE.PlaneGeometry(7, 3),
      textPanel([
        ['BULKO', 56, 72],
        ['HOT DOG + FIZZ: STILL 1.5ᵇ', 122, 30],
        ['FERRY DAILY · THE LOBSTERS ARE NOT FOR SALE', 160, 22],
      ], 512, 192, '#c2452c', '#fffaf0'));
    panel.position.set(0, 4.0, 0.13);
    bill.add(panel);
    const backing = box(7.2, 3.2, 0.15, 0x8a5a3a);
    backing.position.set(0, 4.0, 0);
    bill.add(backing);
    bill.position.set(6, by, bz - 1.5);
    bill.rotation.y = Math.PI; // faces inland, into hearts and minds
    bill.traverse((o) => { if (o.isMesh && !o.material.map) o.castShadow = true; });
    group.add(bill);
    zones.addBlocker(6, bz - 1.5, 1.2);
    register({
      pos: new THREE.Vector3(6, 0, bz - 0.2), r: 2.6,
      label: 'read the billboard',
      use: () => ui.say([
        '“BULKO. HOT DOG + FIZZ: STILL 1.5 BUTTONS. FERRY DAILY.”',
        'In the corner, small: “Ad space sold by P. Magpie & Associates. P. Magpie & Associates is one magpie.”',
      ]),
    });
  }

  // -------------------------------------------------------- the interior ----
  const B = IN;
  {
    const roomStart = group.children.length;
    let milkroomRoot = null;
    const floor = box(34, 0.4, 22, 0x8a8f95); // honest concrete
    floor.position.set(B.x, -0.2, B.z);
    floor.receiveShadow = true;
    group.add(floor);
    for (const [w, d, x, z] of [
      [34, 0.4, B.x, B.z - 11], [0.4, 22, B.x - 17, B.z], [0.4, 22, B.x + 17, B.z],
    ]) {
      const wall = new THREE.Mesh(new THREE.BoxGeometry(w, 8, d), mat(0xa8adb3));
      wall.position.set(x, 4, z);
      group.add(wall);
    }
    // fluorescent bars, hovering in the dollhouse way
    for (let i = 0; i < 4; i++) {
      const bar = new THREE.Mesh(new THREE.BoxGeometry(8, 0.12, 0.5),
        new THREE.MeshBasicMaterial({ color: 0xf4f8ff }));
      bar.position.set(B.x - 9 + i * 6, 7.5, B.z - 4);
      group.add(bar);
    }

    // steel racking with bulk mystery pallets
    for (const rackX of [-12, -4, 4, 12]) {
      for (let level = 0; level < 3; level++) {
        const shelf = box(6.5, 0.2, 2.2, 0xd9a440);
        shelf.position.set(B.x + rackX, 1 + level * 1.8, B.z - 7);
        group.add(shelf);
        for (let pIdx = 0; pIdx < 3; pIdx++) {
          const pallet = box(1.7, 1.2, 1.7, pick([0xb8beba, 0xc9b178, 0x8a9aa8, 0xb0a8c9]));
          pallet.position.set(B.x + rackX - 2.2 + pIdx * 2.2, 1.8 + level * 1.8, B.z - 7);
          group.add(pallet);
        }
      }
      const upright = box(0.25, 6, 2.4, 0xe8743a);
      upright.position.set(B.x + rackX - 3.4, 3, B.z - 7);
      const upright2 = box(0.25, 6, 2.4, 0xe8743a);
      upright2.position.set(B.x + rackX + 3.4, 3, B.z - 7);
      group.add(upright, upright2);
    }

    register({
      pos: new THREE.Vector3(B.x, 0, B.z - 4.6), r: 5, zone: 'bulko',
      label: 'browse the bulk shelves',
      use: () => ui.say(pick([
        'A five-gallon, shelf-stable bucket of macaroni and cheese. The lid reads “FAMILY SIZE.” It does not specify how large a family, nor whether they are meant to eat it or live in it. You respect the ambiguity.',
        'One hundred and forty-four rolls of paper towel, shrink-wrapped into a single cube the size of a refrigerator. You could not lift it. You doubt anyone could. It may be load-bearing.',
        'A jar of pickles requiring both arms and a plan. Forty-eight of them. The brine alone could refloat a small boat. You think, briefly, of Captain Brine. You decide not to mention it to him.',
        'A flat of sixty cans of beans. Only beans. The label is a photograph of the beans. Somewhere, a person is overjoyed by this. You hope, sincerely, to meet them.',
        'A two-kilogram tub labeled “ASSORTED OPTIMISM (GUMMY).” Best before: a date not yet invented. Net weight: more than you have ever personally felt.',
        'The shelves climb up into the fog. Whatever sits on the very top has been there since before the bell went down, and it is fine. It is all fine. It is BULKO.',
      ])),
    });

    // the parmesan: wheels of it, stacked like the treasure it is
    for (let i = 0; i < 6; i++) {
      const wheel = new THREE.Mesh(new THREE.CylinderGeometry(0.9, 0.9, 0.5, 12), mat(0xe8c95c, 0.6));
      wheel.position.set(B.x - 9 + (i % 2) * 2.1, 0.45 + Math.floor(i / 2) * 0.55, B.z + 3.3);
      wheel.castShadow = true;
      group.add(wheel);
    }
    register({
      pos: new THREE.Vector3(B.x - 8, 0, B.z + 4.9), r: 2.6, zone: 'bulko',
      label: 'consider the parmesan wheels',
      use: async () => {
        const choice = await ui.ask('Wheels of parmesan, stacked to shoulder height. Each one is the size of a well-fed dog.', [
          { label: '🧀 Buy a wheel', value: 'buy', hint: '300🔘', disabled: S.state.buttons < 300 },
          { label: 'Respect them from here', value: null },
        ]);
        if (choice === 'buy') {
          S.spend(300);
          S.addItem('parm_wheel');
          kaching();
          ui.updateHUD();
          ui.toast('You bought a <b>Bulk Parmesan Wheel</b>. <i>It does not fit in your pockets. You now simply have it.</i>', '🧀');
        }
      },
    });

    // ------------------------------------------------ the milk cooler entrance ----
    // A WIDE Costco-style cold-room entrance: steel frame, strip curtains, a dark
    // cold beyond. Set into the WEST wall, directly across the floor from the
    // lobster tank (now on the east). E enters the 'milkroom' zone (big dairy hall).
    {
      const dx = B.x - 17, dz = B.z + 3, hw = 3.6; // west wall, toward the south end
      const beyond = box(0.1, 3.4, hw * 2, 0x162430); // the cold dark through the strips
      beyond.position.set(dx + 0.05, 1.9, dz);
      group.add(beyond);
      const lintel = box(0.6, 0.6, hw * 2 + 0.9, 0x8d949c);
      lintel.position.set(dx, 3.7, dz);
      group.add(lintel);
      for (const s of [-1, 1]) {
        const post = box(0.6, 3.7, 0.6, 0x8d949c);
        post.position.set(dx, 1.85, dz + s * (hw + 0.35));
        group.add(post);
      }
      // strip curtains, the kind you nose through with a cart
      for (let i = 0; i <= 10; i++) {
        const strip = new THREE.Mesh(new THREE.BoxGeometry(0.06, 3.1, 0.5),
          new THREE.MeshStandardMaterial({ color: 0xcfe8f0, transparent: true, opacity: 0.34, roughness: 0.1, flatShading: true }));
        strip.position.set(dx + 0.3, 1.7, dz - hw + 0.35 + i * ((hw * 2 - 0.7) / 10));
        group.add(strip);
      }
      // cold breath spilling into the aisle — and it BREATHES: the cooler
      // exhales, reconsiders, exhales again. tide mechanics, dairy scale.
      const leak = new THREE.Mesh(new THREE.BoxGeometry(2.2, 0.5, hw * 2),
        new THREE.MeshBasicMaterial({ color: 0xbfe6f2, transparent: true, opacity: 0.12, depthWrite: false }));
      leak.position.set(dx + 1.1, 0.3, dz);
      group.add(leak);
      updates.push((dt, t) => {
        if (zones.current() !== 'bulko') return;
        leak.material.opacity = 0.09 + Math.sin(t * 0.55) * 0.05;
        leak.position.x = dx + 1.1 + (Math.sin(t * 0.3) + 1) * 0.22;
      });
      const sign = new THREE.Mesh(new THREE.PlaneGeometry(6.4, 1.0),
        textPanel([['❄  THE MILK COOLER  ❄', 64, 40]], 768, 128, '#2f5a6e', '#eaf6fb'));
      sign.position.set(dx + 0.35, 4.5, dz);
      sign.rotation.y = Math.PI / 2; // faces east, into the store
      group.add(sign);
      register({
        pos: new THREE.Vector3(dx + 2.5, 0, dz), r: 3, zone: 'bulko',
        label: 'enter the milk cooler',
        use: async () => {
          await zones.go('milkroom');
          if (!S.hasFlag('sawMilkroom')) {
            S.setFlag('sawMilkroom');
            ui.say('The strip curtains part with a cold sigh. Beyond: a dairy hall the size of a small weather system, and three cows who have clearly been talking about you.');
          }
        },
      });
    }

    // ====================== the milk cooler — a huge, roofless dairy hall ----
    {
      const milkroomStart = group.children.length;
      const MC = { x: 440, z: 1220 }; // far east of BULKO, beyond its fog
      const cfloor = box(22, 0.4, 16, 0xdfeaf0);
      cfloor.position.set(MC.x, -0.2, MC.z);
      cfloor.receiveShadow = true;
      group.add(cfloor);
      for (const [w, d, x, z] of [
        [22, 0.4, MC.x, MC.z - 8], [0.4, 16, MC.x - 11, MC.z], [0.4, 16, MC.x + 11, MC.z],
      ]) {
        const wall = new THREE.Mesh(new THREE.BoxGeometry(w, 5.5, d), mat(0xbcd0d8));
        wall.position.set(x, 2.75, z);
        group.add(wall);
      }
      // no roof — the fixed camera looks straight in, dollhouse-style
      // cold air, pooled and blue
      const chill = new THREE.Mesh(new THREE.BoxGeometry(21.6, 5, 15.6),
        new THREE.MeshBasicMaterial({ color: 0xbfe6f2, transparent: true, opacity: 0.09, depthWrite: false }));
      chill.position.set(MC.x, 2.5, MC.z);
      group.add(chill);
      const bigSign = new THREE.Mesh(new THREE.PlaneGeometry(8, 1.4),
        textPanel([['❄  COLD FRESH MOO JUICE  ❄', 64, 44]], 768, 140, '#2f5a6e', '#eaf6fb'));
      bigSign.position.set(MC.x, 4.2, MC.z - 7.78);
      group.add(bigSign);
      // the carton wall (north), long
      const tops = [0x6b4a2e, 0xe89ab0, 0xd9c08f];
      // a milk carton wears a RIDGE, not a peak — a little gable prism, seated
      // flush on the box (build the 3-cylinder with thetaStart π/2 BEFORE
      // rotateZ, or the ridge skews — see VISUAL_CANON)
      const gableGeo = (len, r) => {
        const g = new THREE.CylinderGeometry(r, r, len, 3, 1, false, Math.PI / 2);
        g.rotateZ(Math.PI / 2); // ridge runs along x
        return g;
      };
      for (let i = 0; i < 56; i++) {
        const col = i % 14, row = Math.floor(i / 14);
        const cxn = MC.x - 6.5 + col * 1.0, cyn = 0.95 + row * 0.74, czn = MC.z - 7.4;
        const carton = box(0.6, 0.66, 0.6, 0xfbf7ef);
        carton.position.set(cxn, cyn, czn);
        group.add(carton);
        const top = new THREE.Mesh(gableGeo(0.56, 0.2), mat(tops[(i + row) % 3], 0.7));
        top.position.set(cxn, cyn + 0.43, czn); // gable bottom kisses the carton top
        group.add(top);
      }
      // dairy island cases full of cartons (the Costco aisle)
      const dairyCase = (cx, cz) => {
        const base = box(5.2, 1.0, 2.6, 0xaebfc8);
        base.position.set(cx, 0.5, cz);
        group.add(base);
        const rim = box(5.4, 0.18, 2.8, 0x8da0aa);
        rim.position.set(cx, 1.05, cz);
        group.add(rim);
        for (let i = 0; i < 14; i++) {
          const ccx = cx - 2.1 + (i % 7) * 0.7, ccz = cz - 0.55 + Math.floor(i / 7) * 1.05;
          const carton = box(0.5, 0.7, 0.5, 0xfbf7ef);
          carton.position.set(ccx, 1.45, ccz);
          group.add(carton);
          const ctop = new THREE.Mesh(gableGeo(0.46, 0.17), mat(tops[i % 3], 0.7));
          ctop.position.set(ccx, 1.89, ccz);
          group.add(ctop);
        }
      };
      dairyCase(MC.x - 5, MC.z - 2);
      dairyCase(MC.x + 5, MC.z - 2);

      // and yes, you can buy the milk. it's a store. mostly.
      const MILKS = [
        { id: 'milk_choco', label: '🍫 Chocolate milk', name: 'Chocolate Milk', emoji: '🍫', price: 8 },
        { id: 'milk_straw', label: '🍓 Strawberry milk', name: 'Strawberry Milk', emoji: '🍓', price: 8 },
        { id: 'milk_oat', label: '🌾 Oat beverage', name: 'Oat Beverage', emoji: '🌾', price: 9 },
        { id: 'milk_plain', label: '🥛 Milk', name: 'Milk', emoji: '🥛', price: 6 },
      ];
      for (const caseX of [MC.x - 5, MC.x + 5]) {
        register({
          pos: new THREE.Vector3(caseX, 0, MC.z - 2), r: 2.8, zone: 'milkroom',
          label: 'browse the dairy case',
          use: async () => {
            const picked = await ui.ask('The case hums its one cold note. Cartons stand in ranks, capped by flavor.', [
              ...MILKS.map((m) => ({
                label: m.label, value: m.id, hint: `${m.price}🔘`,
                disabled: S.state.buttons < m.price,
              })),
              { label: 'Stay cool', value: null },
            ]);
            const m = MILKS.find((x) => x.id === picked);
            if (!m) return;
            S.spend(m.price);
            S.addItem(m.id);
            kaching();
            ui.updateHUD();
            ui.toast(`You bought <b>${m.name}</b>. The cold clings to the carton like it wants to come along.`, m.emoji);
          },
        });
      }

      // the cows, spread across the hall
      const makeCow = (body, x, z, ry) => {
        const c = buildAnimal('cow', { body, head: body });
        c.scale.setScalar(0.95);
        c.position.set(x, 0, z);
        c.rotation.y = ry;
        c.traverse((o) => { if (o.isMesh) o.castShadow = true; });
        group.add(c);
        return c;
      };
      const cocoa = makeCow(0x6b4a2e, MC.x - 7, MC.z + 2.6, 0.4);
      const sundae = makeCow(0xe6a6bc, MC.x + 7, MC.z + 2.6, -0.4);
      // Barley holds the oat end of the west case — off the center line, the
      // way he'd stand at a party. near the exit, in case the party is too much
      const barley = makeCow(0xece3d0, MC.x - 6.3, MC.z - 0.5, 0.35);
      { // Barley's beret, naturally
        const beret = new THREE.Group();
        const disc = new THREE.Mesh(new THREE.CylinderGeometry(0.34, 0.37, 0.12, 10), mat(0x2f3a4a, 0.6));
        beret.add(disc);
        const nub = new THREE.Mesh(new THREE.IcosahedronGeometry(0.06, 0), mat(0x2f3a4a, 0.6));
        nub.position.y = 0.11;
        beret.add(nub);
        beret.position.set(0.05, 1.66, 0.5);
        beret.rotation.z = 0.25;
        barley.add(beret);
      }
      updates.push((dt, t, playerPos) => {
        if (zones.current() !== 'milkroom') return;
        [cocoa, sundae, barley].forEach((c, i) => {
          const p = c.userData.parts;
          if (p?.body) p.body.position.y = p.bodyY + Math.sin(t * 1.1 + i * 1.7) * 0.018;
          if (p?.head) p.head.position.y = p.headY + Math.sin(t * 1.1 + i * 1.7 + 0.6) * 0.02;
          if (playerPos) { // turn to face a customer, like any good staff
            const dx = playerPos.x - c.position.x, dz = playerPos.z - c.position.z;
            if (Math.hypot(dx, dz) < 8) c.rotation.y = turnToward(c.rotation.y, Math.atan2(dx, dz), dt, 2.5);
          }
        });
      });

      const COW_LINES = {
        Cocoa: [
          '“Some say chocolate milk is a dessert. I say it is a hug you can pour.”',
          '“I keep it cold. The cold keeps it honest.”',
          '“Barley says oat is the future. I say the past tasted better. We don’t argue. We’re cows.”',
        ],
        Sundae: [
          '“Pink is a great deal of pressure. I carry it well, I think.”',
          '“Everyone wants strawberry in summer. In winter I finally get to think.”',
          '“Cocoa is rich, Barley is complicated. I’m only sweet. Someone has to be.”',
        ],
        Barley: [
          '“The beret came with the personality. Or the personality with the beret. The order is unclear and, frankly, beneath us.”',
          '“Oat: for those who find regular cold a touch mainstream.”',
          '“I don’t produce it, exactly. I curate it.”',
        ],
      };
      const COW_MEET = {
        Cocoa: ['A big brown cow regards you with enormous, gentle calm.',
          '“Chocolate milk isn’t a flavor. It’s a feeling. The feeling is being eight, and it being summer, and nothing being due.”'],
        Sundae: ['A pink cow blinks at you, slow and dreamy.',
          '“I’m strawberry. I don’t make the rules. I barely make the strawberry.”'],
        Barley: ['A cream-colored cow in a small beret considers you over the top of it.',
          '“Mine’s oat. It’s not milk — it’s a beverage. There is a difference. I won’t explain it.”',
          '“I was plant-based before the tank had lobsters.”'],
      };
      const cowReg = (cow, name, voice) => register({
        getPos: () => cow.position, r: 2.6, zone: 'milkroom', label: `talk to ${name}`,
        use: () => {
          const flag = `met${name}`;
          if (!S.hasFlag(flag)) { S.setFlag(flag); ui.say(COW_MEET[name], { speaker: name, voice }); return; }
          ui.say(pick(COW_LINES[name]), { speaker: name, voice });
        },
      });
      cowReg(cocoa, 'Cocoa', 250);
      cowReg(sundae, 'Sundae', 300);
      cowReg(barley, 'Barley', 270);

      register({
        pos: new THREE.Vector3(MC.x, 0, MC.z - 5.5), r: 2.4, zone: 'milkroom',
        label: 'browse the milk wall',
        use: () => ui.say(pick([
          'Cartons to the ceiling, gable-topped, beaded with cold. Top to bottom: chocolate, strawberry, oat, and one labeled simply “?”.',
          'A small sign: “TAKE A CARTON. LEAVE A CARTON. THE COOLER ABIDES.” You take nothing. The cooler abides regardless.',
        ])),
      });
      register({
        pos: new THREE.Vector3(MC.x, 0, MC.z + 7), r: 2.4, zone: 'milkroom',
        label: 'step back into BULKO',
        use: () => zones.go('bulko', { x: B.x - 14, z: B.z + 3, rotY: -Math.PI / 2 }),
      });
      milkroomRoot = collectInteriorRoot(group, milkroomStart);
      zones.registerInterior('milkroom', {
        root: milkroomRoot,
        floorY: 0,
        bounds: { x0: MC.x - 10.5, x1: MC.x + 10.5, z0: MC.z - 7.6, z1: MC.z + 7.6 },
        blockers: [
          { x: MC.x - 5, z: MC.z - 2, r: 2.5 }, { x: MC.x + 5, z: MC.z - 2, r: 2.5 },
        ],
        spawn: { x: MC.x, z: MC.z + 6.5, rotY: 0 },
        lighting: {
          bg: 0x1a2832, fog: 0x1a2832, fogNear: 22, fogFar: 64,
          hemiSky: 0xdaf0fb, hemiGround: 0x4a5a64, hemiIntensity: 1.25,
          sunIntensity: 0,
        },
      });
    }

    // the wall of TVs — in the lounge now, behind the couches, on a stand with
    // a solid backing board (the screens are just lit panels)
    const tvBase = box(8.8, 1.0, 1.3, 0xe8743a); // shelf orange
    tvBase.position.set(B.x + 2.4, 0.5, B.z + 1.5);
    group.add(tvBase);
    const tvBack = box(8.8, 3.2, 0.2, 0xc2c6ca); // the solid rectangle behind the screens (light grey)
    tvBack.position.set(B.x + 2.4, 2.7, B.z + 1.3);
    group.add(tvBack);
    // each channel keeps two painted frames; the schedule assigns them to screens
    const channelFrames = {};
    for (const key of [
      'hoot', 'science', 'sea',
      ...TV_WEATHERS.map((w) => `weather_${w}`),
      ...TV_AD_KEYS,
    ]) {
      channelFrames[key] = [makeScreenTex(key, 0), makeScreenTex(key, 1)];
    }
    const screenTexKey = (key) => key === 'weather' ? `weather_${currentWeather()}` : key;
    const tvScreens = [];
    for (let i = 0; i < 8; i++) {
      const tx = B.x + 2.4 + ((i % 4) - 1.5) * 2.1;
      const ty = 2.0 + Math.floor(i / 4) * 1.5;
      const tv = box(1.9, 1.2, 0.18, 0x16140f);
      tv.position.set(tx, ty, B.z + 1.42);
      group.add(tv);
      const screen = new THREE.Mesh(new THREE.PlaneGeometry(1.7, 1.0),
        new THREE.MeshBasicMaterial({ map: channelFrames.sea[0] }));
      screen.position.set(tx, ty, B.z + 1.52);
      group.add(screen);
      tvScreens.push({ screen, key: 'sea' });
    }
    // TV scheduling — what's on depends on the hour. Day: weather, science, ads,
    // and the sea on one random screen. Night: Hoot's show, ads, the sea.
    function scheduleScreens() {
      const fill = isNight() ? ['hoot', ...TV_AD_KEYS] : ['weather', 'science', ...TV_AD_KEYS];
      const seaScreen = Math.floor(rand(0, tvScreens.length)); // exactly one screen is the sea
      tvScreens.forEach((s, i) => { s.key = i === seaScreen ? 'sea' : pick(fill); });
    }
    scheduleScreens();
    // lo-fi flipbook + re-schedule on the day/night flip (and every so often, for variety)
    let tvStep = 0, tvFlipT = 0, tvNight = isNight(), tvSchedT = 0;
    updates.push((dt) => {
      if (zones.current() !== 'bulko') return;
      tvSchedT += dt;
      if (isNight() !== tvNight || tvSchedT > 40) { tvNight = isNight(); tvSchedT = 0; scheduleScreens(); }
      tvFlipT += dt;
      if (tvFlipT >= 1.6) { tvFlipT = 0; tvStep ^= 1; }
      for (const s of tvScreens) {
        s.screen.material.map = channelFrames[screenTexKey(s.key)]?.[tvStep] ?? channelFrames.sea[tvStep];
      }
    });
    // watch from anywhere along the wall front; you get one of the displayed screens
    const tvIdx = { hoot: 0, science: 0, sea: 0 };
    const tvAds = Object.fromEntries(TV_ADS.map((ad) => [ad.key, ad.text]));
    const tvBroadcast = {
      weather: () => ui.say(scoochWeather()),
      hoot: () => { const pool = isNight() ? [...HOOT_BITS, HOOT_NIGHT] : HOOT_BITS; ui.say(pool[tvIdx.hoot++ % pool.length]); },
      science: () => ui.say([{ speaker: NEWT, voice: NEWT_V, text: SCIENCE_FACTS[tvIdx.science++ % SCIENCE_FACTS.length] }]),
      sea: () => ui.say(SEA_BITS[tvIdx.sea++ % SEA_BITS.length]),
    };
    const playTv = (key) => {
      if (TV_AD_KEYS.includes(key)) return ui.say(tvAds[key]);
      return tvBroadcast[key]?.();
    };
    const tvHit = new THREE.Vector3();
    register({
      getPos: () => tvHit.set(Math.max(B.x - 1.6, Math.min(B.x + 6.4, player.group.position.x)), 0, B.z + 2.3),
      r: 2.6, zone: 'bulko',
      label: 'watch the TVs',
      use: () => { playTv(pick(tvScreens).key); },
    });

    // display couches, dared to be imagined in your cottage
    for (let i = 0; i < 3; i++) {
      const couch = new THREE.Group();
      const seat = box(2.4, 0.5, 1.0, [0x5b8bc9, 0x8a5a8a, 0x4f8f6a][i]);
      seat.position.y = 0.45;
      couch.add(seat);
      const backC = box(2.4, 0.8, 0.3, [0x5b8bc9, 0x8a5a8a, 0x4f8f6a][i]);
      backC.position.set(0, 0.95, -0.38);
      couch.add(backC);
      for (const sx of [-1.18, 1.18]) {
        const arm = box(0.25, 0.7, 1.0, [0x4a76ac, 0x744a74, 0x417a58][i]);
        arm.position.set(sx, 0.65, 0);
        couch.add(arm);
      }
      couch.position.set(B.x - 1 + i * 3.4, 0, B.z + 5.5);
      couch.traverse((o) => { if (o.isMesh) o.castShadow = true; });
      group.add(couch);
    }
    register({
      pos: new THREE.Vector3(B.x + 2.4, 0, B.z + 4), r: 3, zone: 'bulko',
      label: 'try a display couch',
      use: async () => {
        await ui.fadeSwap(() => {});
        ui.say('You sit on display couch #2. It is somehow both firm and soft. A tag dares you to imagine it in your cottage. You imagine it. The tag knew you would.');
      },
    });

    // the food court: one and a half buttons, since before the bell sank
    const counter = box(4, 1.1, 1.2, 0xc2452c);
    counter.position.set(B.x + 12, 0.55, B.z + 6.5);
    group.add(counter);
    // the menu board: a solid board on two posts, text facing the customer
    for (const s of [-1, 1]) {
      const menuPost = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.08, 4.9, 6), mat(0x55483a));
      menuPost.position.set(B.x + 12 + s * 2.0, 2.45, B.z + 5.9); // attached to the counter's back edge
      menuPost.castShadow = true;
      group.add(menuPost);
    }
    const menuMat = textPanel([['HOT DOG + FIZZ  ·  1.5ᵇ', 80, 42]], 512, 160, '#2a2a2a', '#fffaf0');
    menuMat.side = THREE.DoubleSide;
    const menuBoard = new THREE.Mesh(new THREE.PlaneGeometry(4.0, 1.5), menuMat);
    menuBoard.position.set(B.x + 12, 3.6, B.z + 5.95);
    group.add(menuBoard);

    // the apparatus, on the counter where you can watch it work: a roller
    // grill (four dogs, geologically patient) and the fizz machine
    const grill = box(1.3, 0.16, 0.66, 0x4a4f55);
    grill.position.set(B.x + 10.9, 1.19, B.z + 6.5);
    group.add(grill);
    const dogGeo = new THREE.CylinderGeometry(0.07, 0.07, 0.5, 6);
    dogGeo.rotateX(Math.PI / 2); // lie along the rollers
    const rollerDogs = [];
    for (let i = 0; i < 4; i++) {
      const dog = new THREE.Mesh(dogGeo, mat(0xc2703a, 0.7));
      dog.position.set(B.x + 10.45 + i * 0.3, 1.34, B.z + 6.5);
      dog.castShadow = true;
      group.add(dog);
      rollerDogs.push(dog);
    }
    const fizz = box(0.72, 1.05, 0.6, 0xb0453a); // BULKO red, of course
    fizz.position.set(B.x + 13.35, 1.62, B.z + 6.3);
    group.add(fizz);
    for (let i = 0; i < 3; i++) { // one tap per fizz, no labels, know your fizz
      const tap = box(0.12, 0.12, 0.06, [0xf2cf5b, 0x5b8bc9, 0x4f8f6a][i]);
      tap.position.set(B.x + 13.15 + i * 0.2, 1.9, B.z + 6.62);
      group.add(tap);
    }
    const tray = box(0.5, 0.05, 0.24, 0x8da0aa);
    tray.position.set(B.x + 13.35, 1.17, B.z + 6.74);
    group.add(tray);
    updates.push((dt) => {
      if (zones.current() !== 'bulko') return;
      for (const dog of rollerDogs) dog.rotation.z += dt * 0.7; // the roller turns
    });

    // the staff: a frog vendor. makeFrog — same idea as makeCow up in the milk
    // room: build the body, recolor, scale, place. (modeled on the North Isle's
    // very poisonous frog, grown large and gone green-and-yellow.)
    const makeFrog = (body, legColor, x, z, s = 1) => {
      const f = new THREE.Group();
      const fb = new THREE.Mesh(new THREE.IcosahedronGeometry(0.13, 0), mat(body, 0.5));
      fb.scale.set(1, 0.78, 1.2); fb.position.y = 0.1;
      f.add(fb);
      for (const sx of [-1, 1]) {
        const eye = new THREE.Mesh(new THREE.IcosahedronGeometry(0.05, 0), mat(0x222222, 0.3));
        eye.position.set(sx * 0.07, 0.22, 0.08);
        const leg = new THREE.Mesh(new THREE.IcosahedronGeometry(0.05, 0), mat(legColor, 0.5));
        leg.scale.set(1, 0.6, 1.6); leg.position.set(sx * 0.13, 0.04, -0.04);
        f.add(eye, leg);
      }
      f.scale.setScalar(s);
      f.position.set(x, 0, z);
      f.traverse((o) => { if (o.isMesh) o.castShadow = true; });
      group.add(f);
      return f;
    };
    // a stool so he can see, and be seen, over his counter (like Pip's)
    const frogStool = new THREE.Mesh(new THREE.CylinderGeometry(0.5, 0.55, 0.85, 8), mat(0x6b4a2e));
    frogStool.position.set(B.x + 12, 0.42, B.z + 5.4);
    frogStool.castShadow = true;
    group.add(frogStool);
    const frog = makeFrog(0x6ab04a, 0xf0d840, B.x + 12, B.z + 5.4, 6);
    { // the paper hat — a little origami boat (the paper_boat item) — on his head
      const hatHull = new THREE.Mesh(new THREE.ConeGeometry(0.09, 0.07, 4), mat(0xfffaf0, 0.7));
      hatHull.rotation.y = Math.PI / 4; hatHull.scale.set(1.5, 1, 0.7);
      hatHull.position.set(0, 0.28, 0.02);
      const hatSail = new THREE.Mesh(new THREE.ConeGeometry(0.035, 0.06, 4), mat(0xfffaf0, 0.7));
      hatSail.position.set(0, 0.34, 0.02);
      hatHull.castShadow = true; hatSail.castShadow = true;
      frog.add(hatHull, hatSail);
    }
    updates.push((dt, t, playerPos) => {
      if (zones.current() !== 'bulko') return;
      frog.position.y = 0.6 + Math.abs(Math.sin(t * 1.4)) * 0.1; // a patient little bob, up on his stool
      if (playerPos) { // Mortimer turns to face whoever's ordering, like Gus
        const dx = playerPos.x - frog.position.x, dz = playerPos.z - frog.position.z;
        if (Math.hypot(dx, dz) < 8) frog.rotation.y = turnToward(frog.rotation.y, Math.atan2(dx, dz), dt, 3);
      }
    });
    // the frog IS the hot dog stand — order from him (the half-button is his doing)
    register({
      getPos: () => frog.position, r: 3.6, zone: 'bulko',
      label: 'order from Mortimer',
      use: async () => {
        if (!S.hasFlag('metFrog')) {
          S.setFlag('metFrog');
          await ui.say([
            'A large green-and-yellow frog in a small paper hat regards you with the calm of one who has flipped a great many hot dogs and judged none of them.',
            '“Mortimer,” he says, by way of introduction. “Hot dog?” He is, somehow, already making one. He does not blink. The roller turns; the fizz fizzes; all is well.',
          ], { speaker: 'Mortimer', voice: 320 });
        }
        if (S.state.buttons < 2) {
          ui.say('Mortimer looks genuinely sorry. You are two buttons short, and he is far too dignified to spot you the difference. The hot dog rotates on, patient as the tide.', { speaker: 'Mortimer', voice: 320 });
          return;
        }
        S.spend(2);
        S.drinkCoffee(60);
        kaching();
        sip();
        ui.updateHUD();
        if (!S.hasFlag('halfButton')) {
          S.setFlag('halfButton');
          S.addItem('half_button');
          jingle();
          await ui.say([
            'It costs exactly one and a half buttons. You pay two. Mortimer returns, in change, half a button — handed over with the gravity of a man passing along a deed.',
            'It is legal tender nowhere. You will treasure it forever. He knew you would.',
          ], { speaker: 'Mortimer', voice: 320 });
          ui.toast('You got <b>Half a Button</b>! And a hot dog. <i>Warm and quick for 60s!</i>', '🌭');
        } else {
          ui.toast('Hot dog, fizz, half a button back. Mortimer nods once. The system is eternal. <i>Warm and quick for 60s!</i>', '🌭');
        }
        if (!S.hasFlag('hotdogLore')) {
          S.setFlag('hotdogLore');
          await ui.say('A plaque by the till, which Mortimer polished this morning: “THIS PRICE HAS NOT CHANGED SINCE THE SEA HAD A BELL. IT NEVER WILL.” You feel, briefly, like crying at a food court.', { speaker: 'Mortimer', voice: 320 });
        }
      },
    });

    // THE TANK. fully furnished. not for sale. stop asking.
    // a group, so it parks as one — the west cold corner, south of the cooler
    // door and just past the parmesan, with room to walk between the two.
    const tankG = new THREE.Group();
    tankG.position.set(B.x - 8, 0, B.z - 3);
    group.add(tankG);
    const tank = new THREE.Mesh(new THREE.BoxGeometry(5, 3, 2.6),
      new THREE.MeshStandardMaterial({ color: 0x3fb0e8, transparent: true, opacity: 0.4, roughness: 0.15 }));
    tank.position.set(0, 1.9, 0);
    tankG.add(tank);
    const tankBase = box(5.4, 0.5, 3, 0x55483a);
    tankBase.position.set(0, 0.25, 0);
    tankG.add(tankBase);
    // the furnishings
    const tinyCouch = box(0.9, 0.35, 0.4, 0xc25b4e);
    tinyCouch.position.set(-1.2, 0.85, 0);
    const tinyLamp = new THREE.Mesh(new THREE.IcosahedronGeometry(0.1, 0),
      new THREE.MeshBasicMaterial({ color: 0xffd98f }));
    tinyLamp.position.set(-0.6, 1.5, -0.5);
    const tinyLampPost = box(0.05, 0.7, 0.05, 0x55483a);
    tinyLampPost.position.set(-0.6, 1.05, -0.5);
    const tinyRug = new THREE.Mesh(new THREE.CylinderGeometry(0.5, 0.5, 0.04, 8), mat(0xd9a440, 0.8));
    tinyRug.position.set(0, 0.55, 0.2);
    const tinyArt = box(0.4, 0.3, 0.04, 0x27408f);
    tinyArt.position.set(1, 1.6, -1.2);
    tankG.add(tinyCouch, tinyLamp, tinyLampPost, tinyRug, tinyArt);
    // the residents
    const lobsterA = buildAnimal('lobster', { body: 0xd84f4f });
    lobsterA.scale.setScalar(0.4);
    lobsterA.position.set(-1.2, 0.95, 0);
    const lobsterB = buildAnimal('lobster', { body: 0xb8453a });
    lobsterB.scale.setScalar(0.4);
    lobsterB.position.set(1, 0.6, 0.4);
    lobsterB.rotation.y = -0.8;
    tankG.add(lobsterA, lobsterB);
    updates.push((dt, t) => {
      if (zones.current() !== 'bulko') return;
      lobsterA.position.y = 0.95 + Math.sin(t * 1.2) * 0.04;
      lobsterB.position.y = 0.6 + Math.sin(t * 1.4 + 2) * 0.05;
    });
    let tankIdx = 0;
    register({
      pos: new THREE.Vector3(B.x - 5, 0, B.z - 3), r: 2.8, zone: 'bulko',
      label: 'inspect the lobster tank',
      use: () => ui.say(TANK_LINES[tankIdx++ % TANK_LINES.length]),
    });

    // Gus, the greeter. there is a vest. there is a system. respect both.
    const gus = buildAnimal('tortoise', { body: 0x8a9a7a, head: 0x8a9a7a });
    gus.scale.setScalar(1.25);
    const vest = box(0.85, 0.7, 0.95, 0xe8743a);
    vest.position.set(0, 0.62, 0);
    gus.add(vest);
    gus.position.set(B.x - 6.5, 0, B.z + 8);
    group.add(gus);
    updates.push((dt, t, playerPos) => {
      if (zones.current() !== 'bulko' || !playerPos) return;
      const parts = gus.userData.parts;
      parts.body.position.y = parts.bodyY + Math.sin(t * 0.9) * 0.02;
      const dx = playerPos.x - gus.position.x, dz = playerPos.z - gus.position.z;
      if (Math.hypot(dx, dz) < 8) {
        gus.rotation.y = turnToward(gus.rotation.y, Math.atan2(dx, dz), dt, 3);
      }
    });
    register({
      getPos: () => gus.position, r: 3, zone: 'bulko',
      label: 'talk to Gus',
      use: () => {
        if (!S.hasFlag('metGus')) {
          S.setFlag('metGus');
          ui.say([
            'An enormous old tortoise in an orange vest looks at you over imaginary glasses.',
            '“Card?” You have no card. He considers this for a geological moment.',
            '“…You can use the lobsters’ guest pass. They never use it.” He waves you through with tremendous dignity.',
          ], { speaker: 'Gus', voice: 260 });
          return;
        }
        ui.say(pick([
          '“Card? …Right. Guest pass. Go on through.”',
          '“The samples today are: the concept of abundance. One per customer.”',
          '“Forty years on this door. Seen three things I can’t explain. The cars are two of them.”',
        ]), { speaker: 'Gus', voice: 260 });
      },
    });

    const room = collectInteriorRoot(group, roomStart, [milkroomRoot]);
    zones.registerInterior('bulko', {
      root: room,
      floorY: 0,
      bounds: { x0: B.x - 16.6, x1: B.x + 16.6, z0: B.z - 10.2, z1: B.z + 10.4 },
      blockers: [
        { x: B.x - 12, z: B.z - 7, r: 4 }, { x: B.x - 4, z: B.z - 7, r: 4 },
        { x: B.x + 4, z: B.z - 7, r: 4 }, { x: B.x + 12, z: B.z - 7, r: 4 },
        { x: B.x - 8, z: B.z - 3, r: 3 },   // the tank
        { x: B.x + 12, z: B.z + 6.5, r: 2 }, // food court counter
        // the TV stand — overlapping circles so there's no walk-through gap
        { x: B.x - 1.2, z: B.z + 1.6, r: 1.1 }, { x: B.x + 0.6, z: B.z + 1.6, r: 1.1 },
        { x: B.x + 2.4, z: B.z + 1.6, r: 1.1 }, { x: B.x + 4.2, z: B.z + 1.6, r: 1.1 },
        { x: B.x + 6.0, z: B.z + 1.6, r: 1.1 },
        { x: B.x - 8, z: B.z + 3.3, r: 2.0 }, // the parmesan wheels
        // the three display couches
        { x: B.x - 1, z: B.z + 5.5, r: 1.5 }, { x: B.x + 2.4, z: B.z + 5.5, r: 1.5 },
        { x: B.x + 5.8, z: B.z + 5.5, r: 1.5 },
      ],
      spawn: { x: B.x - 2, z: B.z + 9.3, rotY: Math.PI },
      lighting: {
        bg: 0x2a2d31, fog: 0x2a2d31, fogNear: 34, fogFar: 90,
        hemiSky: 0xf4f8ff, hemiGround: 0x5a6066, hemiIntensity: 1.45, // fluorescent honesty
        sunIntensity: 0,
      },
    });
    register({
      pos: new THREE.Vector3(wx - 3, 0, wz + 5.6), r: 2.8,
      label: 'enter BULKO',
      use: async () => {
        await zones.go('bulko');
        if (!S.hasFlag('sawBulko')) {
          S.setFlag('sawBulko');
          ui.say('The doors part. The ceiling is a rumor. Somewhere, forklifts sing to one another. Welcome to BULKO.');
        }
      },
    });
    register({
      pos: new THREE.Vector3(B.x - 2, 0, B.z + 9.9), r: 1.8, zone: 'bulko',
      label: 'step outside',
      use: async () => {
        await zones.leaveTo({ x: wx - 3, z: wz + 7.4, rotY: 0 });
        ui.toast('Gus marks your receipt with a tiny sun. No receipt? He marks the air. Tradition is tradition.', '✅');
      },
    });
  }

  function update(dt, t, playerPos) {
    for (const u of updates) u(dt, t, playerPos);
  }

  return { group, update };
}

// filled in by createBulko; boats.js reads it to run the ferry line
export const BULKO_DOCK = { x: 0, z: 0, rotY: 0, buoyPos: null };

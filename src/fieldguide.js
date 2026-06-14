// The field guide: P opens the chart of the archipelago (click an island
// to learn about it), C opens Old Tansy's Almanac — every fish, bug, fossil,
// tide pool find, and art print you've ever gotten your paws on.

import { terrainHeight, SITES, ISLAND2, ISLAND3, ISLAND4, TEXAS, VOLCANO, WATER_Y } from './terrain.js';
import { ITEMS } from './catalog.js';
import { state, save } from './state.js';
import * as ui from './ui.js';

// world window the chart covers (the world continues past the left edge;
// the chart does not. ask the Labs about it, they think it's very funny)
const MAP = { x0: -130, x1: 160, z0: -165, z1: 145, scale: 2 };

const ISLAND_INFO = [
  {
    key: 'notbell',
    name: 'Notbell Island', x: 0, z: 0, r: 40, icon: '🍃',
    blurb: 'Home. The island that lost its bell and kept the name. Village plaza, the Lantern Room, the museum, your cottage, the tide pools, the dock — and the cave where the old light sleeps.',
    folk: 'Pip · Luna · Fern · Chip · Clover · Biscuit · Howell · Puddle · the Admiral · Captain Brine · Murmur (sometimes)',
  },
  {
    key: 'far',
    name: 'The Far Isle', x: ISLAND2.x, z: ISLAND2.z, r: 30, icon: '⛪',
    blurb: 'The quiet side of the strait — footbridge or train. Barnaby’s grocery, the public garden, the Old Singer’s bones, and the Listening House, whose belfry is empty on purpose.',
    folk: 'Barnaby · Brother Alder · Saffron · Bramble · Marigold · Ember',
    mystery: '“Other side of the strait? Quieter. Greener. Their church doesn’t ring, and they like it that way.” —overheard at the café',
  },
  {
    key: 'north',
    name: 'The North Isle', x: ISLAND3.x, z: ISLAND3.z, r: 26, icon: '📚',
    blurb: 'Moss with tenure. Cross the natural arch to the Quiet Stacks, the clinic (everyone is fine), the Buttonwagon and its stew cart, and the MouseBoat at her mooring.',
    folk: 'Vesper · Dr. Gill · Butterpat · Tusk · Crumb · one very poisonous frog',
    mystery: '“North of here it’s moss all the way down. If you find a library, no you didn’t — but bring me back something shiny.” —Pip, unhelpfully',
  },
  {
    key: 'texas',
    name: 'TEXAS', x: TEXAS.x, z: TEXAS.z, r: 12, icon: '🤠',
    blurb: 'TEXAS. No further explanation is offered, or required. Population: one fire ant, one slingshot, one tin can, one strand of his ma’s lights.',
    folk: 'Pecos',
    mystery: 'A very small island. When asked about it, Captain Brine just exhales for a long time.',
  },
  {
    key: 'volcano',
    name: 'The Volcano', x: VOLCANO.x, z: VOLCANO.z, r: 25, icon: '🌋',
    blurb: 'She made every island in this sea, then retired. Smokes when she’s comfortable. Black-sand beach, honor bar, basking rock. Reachable by rowboat or Brine’s ferry.',
    folk: 'Cinder, and the warmest rocks in the archipelago',
    mystery: '“The smoking mountain? She MADE all of this. Go pay your respects. Ten buttons, I’ll take you myself.” —Captain Brine',
  },
  {
    key: 'bulko',
    name: 'BULKO', x: ISLAND4.x, z: ISLAND4.z, r: 26, icon: '🛒',
    blurb: 'The southern warehouse isle. Bulk parmesan, a wall of TVs, the eternal 1.5ᵇ hot dog, and a fully furnished lobster tank that is NOT for sale. Do not worry about the cars.',
    folk: 'Gus · the lobsters (management)',
    mystery: 'On clear days something enormous and gray sits on the southern horizon. It appears to be… organized.',
  },
];

// registered by island5.js when its corner of the world loads
export function addIslandInfo(info) {
  const existing = ISLAND_INFO.findIndex((isle) => isle.key && isle.key === info.key);
  if (existing >= 0) ISLAND_INFO[existing] = info;
  else ISLAND_INFO.push(info);
  chartDrawn = false;
}

// ------------------------------------------------------- charting ----
// Islands start as grey rumors on the chart; setting foot on one inks it in.

function isleAt(x, z) {
  let best = null, bestD = 1e9;
  for (const isle of ISLAND_INFO) {
    const d = Math.hypot(isle.x - x, isle.z - z);
    if (d < isle.r + 10 && d < bestD) { best = isle; bestD = d; }
  }
  return best;
}

function charted(isle) {
  return !isle.key || !!state.visited[isle.key];
}

// The label the HUD wears — derived from (zone, x, z). Interiors and the moon
// get their own name; out on the island it's the nearest charted shore; open
// water (and anywhere unnamed) is just the archipelago.
const ZONE_PLACES = {
  shop: '🪙 Pip’s Odds & Ends',
  cafe: '☕ The Lantern Room',
  museum: '🏛️ Notbell Museum',
  home: '🏡 Your Cottage',
  cave: '✨ The Glow Worm Cave',
  library: '📚 The Quiet Stacks',
  clinic: '🩹 Dr. Gill’s Clinic',
  grocery: '🥬 Barnaby’s Greens & Goods',
  church: '🕯️ The Listening House',
  manor: '🎩 Mole Manor',
  manor_up: '🎩 Mole Manor',
  cellar: '🔦 The Manor Cellar',
  milkroom: '❄️ The Milk Cooler',
  bulko: '🛒 BULKO',
  labs: '🚀 Notbell Labs',
  moon: '🌙 The Moon',
};

export function placeName(zone, x, z) {
  if (ZONE_PLACES[zone]) return ZONE_PLACES[zone];
  if (zone.startsWith('house_')) {
    const who = zone.slice(6).replace(/\b\w/g, (c) => c.toUpperCase());
    return `🏠 ${who}’s House`;
  }
  if (zone === 'island') {
    const isle = isleAt(x, z);
    if (isle) return `${isle.icon} ${isle.name}`;
  }
  return '🍃 Notbell Archipelago';
}

// called from the main loop every couple of seconds while outdoors
export function markVisited(player, zone) {
  if (zone !== 'island') return;
  const p = player.group.position;
  for (const isle of ISLAND_INFO) {
    if (!isle.key || state.visited[isle.key]) continue;
    if (Math.hypot(isle.x - p.x, isle.z - p.z) < isle.r) {
      state.visited[isle.key] = true;
      save();
      chartDrawn = false; // the ink is wet; redraw next time
      ui.toast(`Charted: <b>${isle.icon} ${isle.name}</b>. Old Tansy’s chart fills in a little.`, '🗺️');
    }
  }
}

// faded ink for unexplored shores
const fogCache = new Map();

function fogColor(hex) {
  if (!fogCache.has(hex)) {
    const n = parseInt(hex.slice(1), 16);
    const mix = (c, t) => Math.round(c + (t - c) * 0.68);
    const r = mix((n >> 16) & 255, 0x9c), g = mix((n >> 8) & 255, 0xb0), b = mix(n & 255, 0xb6);
    fogCache.set(hex, `rgb(${r},${g},${b})`);
  }
  return fogCache.get(hex);
}

// ------------------------------------------------------------- the DOM ----

const mapModal = document.createElement('div');
mapModal.id = 'fieldguide-map';
mapModal.style.display = 'none';
document.body.appendChild(mapModal);

const pedia = document.createElement('div');
pedia.id = 'critterpedia';
pedia.style.display = 'none';
document.body.appendChild(pedia);

const style = document.createElement('style');
style.textContent = `
  #fieldguide-map, #critterpedia {
    position: fixed; top: 50%; left: 50%; transform: translate(-50%, -50%);
    background: #fffaf0; border: 3px solid #e8d5ae; border-radius: 20px;
    box-shadow: 0 14px 40px rgba(0,0,0,0.35); color: #5b4a32;
    font-size: 14px; z-index: 8; padding: 16px;
  }
  #fieldguide-map { display: flex; gap: 14px; }
  #fieldguide-map canvas { border-radius: 12px; cursor: pointer; }
  #fieldguide-map .info { width: 230px; }
  #fieldguide-map .info h3 { margin: 4px 0 8px; }
  #fieldguide-map .info .folk { margin-top: 10px; font-size: 12.5px; opacity: 0.75; }
  #critterpedia { width: min(640px, 90vw); max-height: 78vh; overflow-y: auto; }
  @media (max-width: 700px) {
    #fieldguide-map { flex-direction: column; max-width: 94vw; max-height: 84vh; overflow-y: auto; }
    #fieldguide-map .info { width: auto; }
  }
  #critterpedia h3 { margin: 10px 0 6px; border-bottom: 2px solid #efe2c4; padding-bottom: 3px; }
  #critterpedia .grid { display: grid; grid-template-columns: 1fr 1fr; gap: 2px 18px; }
  #critterpedia .row { display: flex; justify-content: space-between; padding: 2px 0; }
  #critterpedia .unseen { opacity: 0.42; }
  .fg-hint { text-align: center; opacity: 0.55; font-size: 12px; margin-top: 8px; }
  .fg-close {
    position: absolute; top: 8px; right: 12px; font-size: 20px; line-height: 1;
    padding: 6px 10px; cursor: pointer; opacity: 0.55; user-select: none;
  }
  .fg-close:active { opacity: 1; }
`;
document.head.appendChild(style);

// -------------------------------------------------------------- the map ----

let mapCanvas = null;
let chartDrawn = false;

function worldToMap(x, z) {
  return [(x - MAP.x0) * MAP.scale, (z - MAP.z0) * MAP.scale];
}

function drawChart(ctx, w, h) {
  // the sea, then every island the volcano ever made
  ctx.fillStyle = '#7ec3e8';
  ctx.fillRect(0, 0, w, h);
  const step = 1.4;
  for (let z = MAP.z0; z < MAP.z1; z += step) {
    for (let x = MAP.x0; x < MAP.x1; x += step) {
      const hgt = terrainHeight(x, z);
      if (hgt <= WATER_Y) continue;
      let c;
      if (hgt < 0.42) c = '#ecdfa8';
      else if (Math.hypot(x - VOLCANO.x, z - VOLCANO.z) < VOLCANO.r + 3) {
        c = hgt > 9 ? '#6e5048' : '#55504c';
      } else if (Math.hypot(x - ISLAND4.x, z - ISLAND4.z) < 14) c = '#595a5e';
      else if (Math.hypot(x - ISLAND3.x, z - ISLAND3.z) < ISLAND3.r + 6) c = '#4f8a52';
      else c = hgt > 4 ? '#4f9a44' : '#6ec45a';
      const owner = isleAt(x, z);
      if (owner && !charted(owner)) c = fogColor(c);
      ctx.fillStyle = c;
      const [px, pz] = worldToMap(x, z);
      ctx.fillRect(px, pz, step * MAP.scale + 0.5, step * MAP.scale + 0.5);
    }
  }
  // island names (uncharted shores keep their secrets)
  ctx.font = '700 13px ui-rounded, "Segoe UI", system-ui, sans-serif';
  ctx.textAlign = 'center';
  for (const isle of ISLAND_INFO) {
    const [px, pz] = worldToMap(isle.x, isle.z);
    ctx.fillStyle = charted(isle) ? 'rgba(255,250,240,0.85)' : 'rgba(255,250,240,0.6)';
    ctx.fillText(charted(isle) ? isle.icon + ' ' + isle.name : '❓ ???', px, pz - 6);
  }
  // small site marks on the home island
  ctx.font = '11px sans-serif';
  const marks = [
    [SITES.village, '🏘️'], [SITES.cave, '✨'], [SITES.pools, '🦀'],
    [SITES.home, '🏠'], [SITES.dock, '⚓'],
  ];
  for (const [site, icon] of marks) {
    const [px, pz] = worldToMap(site.x, site.z);
    ctx.fillText(icon, px, pz + 4);
  }
}

function renderMap(player) {
  const w = (MAP.x1 - MAP.x0) * MAP.scale;
  const h = (MAP.z1 - MAP.z0) * MAP.scale;
  if (!mapCanvas) {
    mapCanvas = document.createElement('canvas');
    mapCanvas.width = w;
    mapCanvas.height = h;
    // fixed size on desks, shrink-to-fit on phones (aspect rides along)
    mapCanvas.style.width = `min(${Math.round(w * 0.78)}px, 86vw)`;
    mapCanvas.style.height = 'auto';
    mapCanvas.style.aspectRatio = `${w} / ${h}`;
    mapCanvas.addEventListener('click', (e) => {
      const rect = mapCanvas.getBoundingClientRect();
      const wx = ((e.clientX - rect.left) / rect.width) * (MAP.x1 - MAP.x0) + MAP.x0;
      const wz = ((e.clientY - rect.top) / rect.height) * (MAP.z1 - MAP.z0) + MAP.z0;
      let best = null, bestD = 1e9;
      for (const isle of ISLAND_INFO) {
        const d = Math.hypot(isle.x - wx, isle.z - wz);
        if (d < isle.r + 10 && d < bestD) { best = isle; bestD = d; }
      }
      if (best) showIsle(best);
    });
  }
  mapModal.innerHTML = '';
  const closeMap = document.createElement('div');
  closeMap.className = 'fg-close';
  closeMap.textContent = '✕';
  closeMap.addEventListener('click', () => { mapModal.style.display = 'none'; });
  mapModal.appendChild(closeMap);
  mapModal.appendChild(mapCanvas);
  const info = document.createElement('div');
  info.className = 'info';
  info.innerHTML = `<h3>🗺️ The Notbell Archipelago</h3>
    <div>The Notbell Archipelago — every island the volcano raised, back when she worked. The big one goes by Notbell Island, the way the main one always does.</div>
    <div class="folk">Click an island for the gossip.</div>
    <div class="fg-hint">P or Esc to close</div>`;
  mapModal.appendChild(info);

  const ctx = mapCanvas.getContext('2d');
  if (!chartDrawn) {
    drawChart(ctx, w, h);
    chartDrawn = true;
    mapCanvas._chart = ctx.getImageData(0, 0, w, h);
  } else {
    ctx.putImageData(mapCanvas._chart, 0, 0);
  }
  // you are here
  const [px, pz] = worldToMap(player.group.position.x, player.group.position.z);
  ctx.fillStyle = '#e8431f';
  ctx.beginPath();
  ctx.arc(px, pz, 5, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = '#fffaf0';
  ctx.lineWidth = 2;
  ctx.stroke();

  function showIsle(isle) {
    if (!charted(isle)) {
      info.innerHTML = `<h3>❓ ???</h3>
        <div>${isle.mystery || 'The chart shows a smudge here. The smudge is confident.'}</div>
        <div class="folk"><b>Around here:</b> nobody you’ve met. Yet.</div>
        <div class="fg-hint">set foot ashore to ink it in</div>`;
      return;
    }
    info.innerHTML = `<h3>${isle.icon} ${isle.name}</h3>
      <div>${isle.blurb}</div>
      <div class="folk"><b>Around here:</b> ${isle.folk}</div>
      <div class="fg-hint">P or Esc to close</div>`;
  }
}

// ------------------------------------------------------- the critterpedia ----

const SECTIONS = [
  ['fish', '🎣 Fish'],
  ['bug', '🦋 Bugs'],
  ['fossil', '🦴 Fossils'],
  ['pool', '🦀 Tide Pool'],
  ['meteor', '☄️ From the Sky'],
  ['art', '🖼️ Art Collection'],
];

function renderPedia() {
  let html = '<h3 style="border:none;margin-top:0">📖 Old Tansy’s Almanac</h3>' +
    '<div style="opacity:0.6;font-size:12.5px;margin-bottom:6px">The keeper catalogued everything she pulled from the sea and sky. The almanac continues, in a second handwriting. Yours.</div>';
  for (const [kind, title] of SECTIONS) {
    const entries = Object.entries(ITEMS).filter(([, it]) => it.kind === kind);
    const seenCount = entries.filter(([id]) => state.seen[id]).length;
    html += `<h3>${title} <span style="opacity:0.5;font-size:12px">${seenCount}/${entries.length}</span></h3><div class="grid">`;
    for (const [id, it] of entries) {
      const n = state.seen[id] || 0;
      const donated = state.donations.includes(id);
      if (n > 0) {
        html += `<div class="row"><span>${it.emoji} ${it.name}</span>` +
          `<span>×${n}${donated ? ' 🏛️' : ''}</span></div>`;
      } else {
        html += `<div class="row unseen"><span>❓ ?????</span><span></span></div>`;
      }
    }
    html += '</div>';
  }
  html += '<div class="fg-hint">🏛️ = donated to the museum · C or Esc to close</div>';
  pedia.innerHTML = '<div class="fg-close">✕</div>' + html;
  pedia.querySelector('.fg-close').addEventListener('click', () => {
    pedia.style.display = 'none';
  });
}

// ---------------------------------------------------------------- keys ----

export function initFieldGuide(player) {
  addEventListener('keydown', (e) => {
    if (ui.isBusy()) return;
    if (e.code === 'KeyP') {
      if (mapModal.style.display === 'none') {
        pedia.style.display = 'none';
        renderMap(player);
        mapModal.style.display = 'flex';
      } else {
        mapModal.style.display = 'none';
      }
    } else if (e.code === 'KeyC') {
      if (pedia.style.display === 'none') {
        mapModal.style.display = 'none';
        renderPedia();
        pedia.style.display = 'block';
      } else {
        pedia.style.display = 'none';
      }
    } else if (e.code === 'Escape') {
      mapModal.style.display = 'none';
      pedia.style.display = 'none';
    }
  });
}

// merge_audit — did mergeStatic bake anything the game still wants to touch?
//
// Boots with __NOTBELL_MERGE_AUDIT (merge.js then remembers every mesh it
// baked, with a snapshot), walks the archipelago by day, by night and in
// every weather, then (USE=1) fires every outdoor interactable once. Any
// baked mesh the game later moved, hid, recolored, re-parented — or whose
// parent moved or hid — is reported: it belongs under a userData.dynamic.
//
//   GPU=1 PORT=8130 node merge_audit.mjs          (GPU=1: game time at speed)
//   USE=1 …                                        (also press every button)
// Exit code 1 if anything was flagged.
import { boot, sleep, night, forceWeather, dismiss } from './lib.mjs';

process.env.MERGE_AUDIT = '1';
const { browser, page } = await boot({});

const SPOTS = [
  [0, 9], [20, -14], [-22, 12], [98, -30], [118, -27], [30, -112], [-58, -89], [-14, -52],
  [87, 91], [88, 108], [60, 45], [8, 96], [-150, -58], [-194, -48], [-146, -21], [170, -126],
  [204, -122], [184, -110], [-180, 64], [160, 58], [159, 18], [-163, 4.5],
];

// install the checker in the page: flags each baked part at most once
await page.evaluate(() => {
  const snap = (o) => [o.visible, ...o.position.toArray(), ...o.quaternion.toArray(), ...o.scale.toArray()].join(',');
  const label = (o) => {
    const path = [];
    for (let a = o; a; a = a.parent) if (a.name) path.push(a.name);
    return path.join(' < ');
  };
  const rootName = (r) => { for (let a = r; a; a = a.parent) if (a.name) return a.name; return '?'; };
  window.__auditFlags = [];
  window.__auditCheck = (when) => {
    for (const r of window.__mergedParts || []) {
      if (r.flag) continue;
      const why = [];
      if (snap(r.o) !== r.snap) why.push('moved/hid');
      const m = r.o.material;
      if (!r.live && (m.color.getHex() !== r.mat.c || m.opacity !== r.mat.op || m.transparent !== r.mat.t
        || m.emissive?.getHex() !== r.mat.e || m.visible !== r.mat.v)) why.push('recolored');
      if (r.o.parent !== r.parent || r.parent.children.includes(r.o)) why.push('re-added to the scene');
      if (r.o.material !== r.matRef) why.push('material swapped');
      if (r.o.geometry.attributes.position.version !== r.gv) why.push('geometry edited');
      if (r.parent.parent && !r.parent.matrixWorld.equals(r.pw)) why.push('parent moved');
      for (let a = r.parent; a && a !== r.root; a = a.parent) if (!a.visible) { why.push('parent hidden'); break; }
      if (!why.length) continue;
      r.flag = why;
      const p = new r.o.constructor().position; // (scratch)
      r.parent.localToWorld(p.copy(r.o.position));
      window.__auditFlags.push({
        root: rootName(r.root), why: why.join(', '), when,
        what: `${r.o.geometry.type} #${r.mat.c.toString(16).padStart(6, '0')} ${label(r.parent)}`,
        src: r.o.__addedAt, psrc: r.parent.__addedAt,
        at: [p.x, p.y, p.z].map((v) => Math.round(v)).join(','),
      });
    }
  };
  window.__auditTotal = (window.__mergedParts || []).length;
});
console.log('baked parts watched:', await page.evaluate(() => window.__auditTotal));

async function tour(when) {
  for (const [x, z] of SPOTS) {
    await page.evaluate((x, z) => {
      const N = window.__notbell;
      N.player.group.position.set(x, N.terrainHeight(x, z), z);
    }, x, z);
    await sleep(Number(process.env.DWELL || 1500));
    await page.evaluate((w) => window.__auditCheck(w), when);
  }
}

// the other worlds merge too (their roots are merged on their own, hidden
// or not): walk in, look around by day and night
const WORLDS = ['moon', 'crown', 'burrough'];
async function worlds(when) {
  for (const w of WORLDS) {
    await page.evaluate((w) => window.__notbell.zones.go(w).catch(() => {}), w);
    await sleep(2500);
    await page.evaluate((w) => window.__auditCheck(w), `${when} in ${w}`);
  }
  await page.evaluate(() => window.__notbell.zones.go('island').catch(() => {}));
  await sleep(1500);
}

await tour('day');
await worlds('day');
for (const w of ['rain', 'snow', 'fog']) { await forceWeather(page, w, 1500); await tour(w); }
await forceWeather(page, 'clear', 1500);
await night(page, true, 4000);
await tour('night');
await worlds('night');
await night(page, false, 4000);
await tour('morning');

if (process.env.USE) {
  // every outdoor (and other-world) interactable, once: fruit picked, shells taken, doors…
  const n = await page.evaluate(() => window.__notbell.interact.debugRaw().length);
  console.log('interactables:', n);
  for (let i = 0; i < n; i++) {
    const lbl = await page.evaluate(async (i) => {
      const N = window.__notbell; const it = N.interact.debugRaw()[i];
      const z = it && (typeof it.zone === 'function' ? it.zone() : it.zone);
      if (z !== 'island' && !['moon', 'crown', 'burrough'].includes(z)) return null;
      if (N.zones.current() !== z) { await N.zones.go(z).catch(() => {}); await new Promise((r) => setTimeout(r, 1200)); }
      const p = it.getPos ? it.getPos() : it.pos;
      N.player.group.position.set(p.x, N.terrainHeight(p.x, p.z), p.z);
      try { if (!it.enabled || it.enabled()) it.use(); } catch {}
      return typeof it.label === 'function' ? it.label() : it.label;
    }, i);
    if (lbl == null) continue;
    await sleep(400);
    await dismiss(page, 4);
    await page.keyboard.press('Escape');
    await page.evaluate((w) => window.__auditCheck(w), `use: ${lbl}`);
  }
}

const flags = await page.evaluate(() => window.__auditFlags);
const byRoot = {};
for (const f of flags) (byRoot[f.root] ||= []).push(f);
for (const [root, list] of Object.entries(byRoot)) {
  console.log(`\n${root}: ${list.length}`);
  // grouped by the line that hung the part on whatever moved
  const bySrc = {};
  for (const f of list) (bySrc[`${f.why} :: part ${f.src} :: on ${f.psrc}`] ||= []).push(f);
  for (const [k, fs] of Object.entries(bySrc)) console.log(`  ${fs.length}× [${k}] e.g. (${fs[0].when}) ${fs[0].what} @ ${fs[0].at}`);
}
console.log(flags.length ? `\nFLAGGED ${flags.length}` : '\nCLEAN — nothing baked was touched');
await browser.close();
process.exit(flags.length ? 1 : 0);

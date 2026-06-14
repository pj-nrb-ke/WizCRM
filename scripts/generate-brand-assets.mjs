// Generates WizCRM raster brand assets (mobile icons + web favicon PNG) from
// the canonical bolt mark, so every platform shares one source of truth.
//
//   node scripts/generate-brand-assets.mjs
//
// Requires `sharp` (devDependency at the repo root).
import sharp from 'sharp';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');

// Brand gradient + the lightning-bolt path (lucide "zap" geometry, 24×24 box).
const GRAD = `<linearGradient id="g" x1="0" y1="0" x2="1" y2="1">
  <stop offset="0" stop-color="#6366F1"/>
  <stop offset="0.55" stop-color="#8B5CF6"/>
  <stop offset="1" stop-color="#A855F7"/>
</linearGradient>`;
const BOLT = '13,2 3,14 12,14 11,22 21,10 12,10';

// Place the bolt centered in a w×h canvas at a fraction `f` of the height.
function bolt(w, h, f, fill) {
  const s = (f * h) / 20;
  const tx = w / 2 - 12 * s;
  const ty = h / 2 - 12 * s;
  return `<polygon points="${BOLT}" fill="${fill}" transform="translate(${tx.toFixed(2)},${ty.toFixed(2)}) scale(${s.toFixed(3)})"/>`;
}

// Full-bleed gradient tile + white bolt (app icon / favicon).
function tileSVG(size, { rx = 0, f = 0.44 } = {}) {
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 ${size} ${size}">
  <defs>${GRAD}</defs>
  <rect width="${size}" height="${size}" rx="${rx}" fill="url(#g)"/>
  ${bolt(size, size, f, '#FFFFFF')}
</svg>`;
}

// White bolt on transparent canvas (Android adaptive foreground).
function boltOnlySVG(size, f = 0.5) {
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 ${size} ${size}">
  ${bolt(size, size, f, '#FFFFFF')}
</svg>`;
}

// Centered rounded gradient tile on a transparent canvas (splash mark).
function splashSVG(size, tile = 460) {
  const o = (size - tile) / 2;
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 ${size} ${size}">
  <defs>${GRAD}</defs>
  <rect x="${o}" y="${o}" width="${tile}" height="${tile}" rx="${tile * 0.24}" fill="url(#g)"/>
  ${bolt(size, size, (0.44 * tile) / size, '#FFFFFF')}
</svg>`;
}

const png = (svg) => sharp(Buffer.from(svg)).png();

const jobs = [
  ['mobile/assets/icon.png', tileSVG(1024, { rx: 0, f: 0.42 })],
  ['mobile/assets/adaptive-icon.png', boltOnlySVG(1024, 0.5)],
  ['mobile/assets/splash-icon.png', splashSVG(1024)],
  ['mobile/assets/favicon.png', tileSVG(48, { rx: 11, f: 0.5 })],
];

for (const [rel, svg] of jobs) {
  const out = join(root, rel);
  await png(svg).toFile(out);
  const meta = await sharp(out).metadata();
  console.log(`✓ ${rel} (${meta.width}×${meta.height})`);
}
console.log('done');

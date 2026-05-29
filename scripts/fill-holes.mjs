// Fill enclosed transparent regions (holes the subject fully surrounds) with a
// solid colour — e.g. eye-whites that were left transparent in hand-made art.
// Only pixels NOT reachable from the image border are filled, so the real
// background and the outer silhouette are never touched. Operates in place on
// the given PNG(s) and rewrites them as 8-bit RGBA.
//
// Usage:
//   node scripts/fill-holes.mjs assets/sprites/bat-baby.png
//   node scripts/fill-holes.mjs assets/sprites/bat-*.png --color ffffff
//
// Options:
//   --color <rrggbb>      Fill colour (default ffffff = white).
//   --alpha-threshold <n> Alpha below this counts as transparent (default 128).
//
// NOTE: this assumes every enclosed gap should become <color>. That's right for
// eye-whites, but don't run it on art with intentional see-through gaps.
import fs from 'fs';
import path from 'path';
import { decodePng, encodePng } from './sprite-lib.mjs';

const argv = process.argv.slice(2);
const files = [];
let color = 'ffffff';
let alphaThreshold = 128;
for (let i = 0; i < argv.length; i++) {
  const a = argv[i];
  if (a === '--color') color = argv[++i].replace('#', '');
  else if (a === '--alpha-threshold') alphaThreshold = parseInt(argv[++i], 10);
  else files.push(a);
}
if (files.length === 0) {
  console.error('Usage: node scripts/fill-holes.mjs <png>... [--color rrggbb] [--alpha-threshold n]');
  process.exit(1);
}
const fr = parseInt(color.slice(0, 2), 16), fg = parseInt(color.slice(2, 4), 16), fb = parseInt(color.slice(4, 6), 16);

for (const file of files) {
  const abs = path.resolve(process.cwd(), file);
  const { width: w, height: h, rgba } = decodePng(fs.readFileSync(abs));
  const isT = (p) => rgba[p * 4 + 3] < alphaThreshold;
  const reach = new Uint8Array(w * h);
  const stack = [];
  const seed = (x, y) => {
    if (x < 0 || y < 0 || x >= w || y >= h) return;
    const p = y * w + x;
    if (reach[p] || !isT(p)) return;
    reach[p] = 1; stack.push(p);
  };
  for (let x = 0; x < w; x++) { seed(x, 0); seed(x, h - 1); }
  for (let y = 0; y < h; y++) { seed(0, y); seed(w - 1, y); }
  while (stack.length) {
    const p = stack.pop();
    const x = p % w, y = (p / w) | 0;
    seed(x + 1, y); seed(x - 1, y); seed(x, y + 1); seed(x, y - 1);
  }
  let filled = 0;
  for (let p = 0; p < w * h; p++) {
    if (isT(p) && !reach[p]) {
      rgba[p * 4] = fr; rgba[p * 4 + 1] = fg; rgba[p * 4 + 2] = fb; rgba[p * 4 + 3] = 255;
      filled++;
    }
  }
  if (filled > 0) {
    fs.writeFileSync(abs, encodePng(w, h, rgba));
    console.log(`${file}: filled ${filled} enclosed pixel(s) with #${color}`);
  } else {
    console.log(`${file}: no enclosed holes — unchanged`);
  }
}

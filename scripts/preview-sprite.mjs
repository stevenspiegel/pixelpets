// Preview a sprite PNG in the terminal — works regardless of how your image
// viewer renders transparency. Prints an ASCII silhouette (opaque = '#',
// transparent = blank) and stats, including a definitive count of INTERIOR
// HOLES (transparent pixels enclosed by the subject, i.e. not connected to the
// edge background). Use it to sanity-check cutouts before/after conversion.
//
// Usage: node scripts/preview-sprite.mjs assets/sprites/fox-baby.png
import fs from 'fs';
import path from 'path';
import url from 'url';
import { decodePng } from './sprite-lib.mjs';

const arg = process.argv[2];
if (!arg) {
  console.error('Usage: node scripts/preview-sprite.mjs <path-to-png>');
  process.exit(1);
}
const file = path.isAbsolute(arg) ? arg : path.resolve(process.cwd(), arg);
if (!fs.existsSync(file)) {
  console.error(`Not found: ${file}`);
  process.exit(1);
}

const A = 96; // alpha at/above this counts as opaque
const { width, height, rgba } = decodePng(fs.readFileSync(file));
const opaqueAt = (p) => rgba[p * 4 + 3] >= A;

// ASCII silhouette. Step rows by 2 so the aspect looks roughly square in a
// terminal (characters are about twice as tall as they are wide).
let out = '';
for (let y = 0; y < height; y += 2) {
  let line = '';
  for (let x = 0; x < width; x++) line += opaqueAt(y * width + x) ? '#' : ' ';
  out += line.replace(/\s+$/, '') + '\n';
}
console.log(out);

// Stats + hole detection: flood transparent pixels from the border = background;
// any transparent pixel not reached is enclosed by the subject = a hole.
let opaque = 0, transparent = 0;
for (let p = 0; p < width * height; p++) (opaqueAt(p) ? opaque++ : transparent++);

const visited = new Uint8Array(width * height);
const stack = [];
const seed = (x, y) => {
  if (x < 0 || y < 0 || x >= width || y >= height) return;
  const p = y * width + x;
  if (visited[p]) return;
  visited[p] = 1;
  if (!opaqueAt(p)) stack.push(p);
};
for (let x = 0; x < width; x++) { seed(x, 0); seed(x, height - 1); }
for (let y = 0; y < height; y++) { seed(0, y); seed(width - 1, y); }
let bg = 0;
while (stack.length) {
  const p = stack.pop(); bg++;
  const x = p % width, y = (p / width) | 0;
  seed(x + 1, y); seed(x - 1, y); seed(x, y + 1); seed(x, y - 1);
}
const holes = transparent - bg;

console.log(`${path.basename(file)}: ${width}x${height} | opaque ${opaque} | background ${bg} | interior holes ${holes}`);
console.log(holes > 0
  ? `⚠ ${holes} transparent pixels are enclosed by the subject = holes in the sprite.`
  : '✓ no interior holes — clean cutout.');

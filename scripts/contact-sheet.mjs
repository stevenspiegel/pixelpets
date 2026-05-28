// Build a contact sheet: tile a species' life-stage sprites into one PNG so you
// can eyeball all of them at once. Each sprite is upscaled (nearest-neighbour,
// crisp) and composited over a checkerboard, so transparency shows as a checker
// pattern instead of your viewer's black — making cutouts easy to judge.
//
// Usage:
//   node scripts/contact-sheet.mjs fox                 # one species
//   node scripts/contact-sheet.mjs fox owl tiger       # several (one row each)
//   node scripts/contact-sheet.mjs fox --scale 6 --out sheet.png
//
// Columns are stages in order (baby, child, teen, adult, ascended); a missing
// stage shows as an empty checker tile. Opens nothing — it prints the output
// path for you to open.
import fs from 'fs';
import os from 'os';
import path from 'path';
import url from 'url';
import { decodePng, encodePng, STAGES } from './sprite-lib.mjs';

const root = path.resolve(path.dirname(url.fileURLToPath(import.meta.url)), '..');

function parseArgs(argv) {
  const args = { slugs: [] };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a.startsWith('--')) {
      const k = a.slice(2), n = argv[i + 1];
      if (n === undefined || n.startsWith('--')) args[k] = true; else { args[k] = n; i++; }
    } else args.slugs.push(a);
  }
  return args;
}

const args = parseArgs(process.argv.slice(2));
if (args.slugs.length === 0) {
  console.error('Usage: node scripts/contact-sheet.mjs <slug> [<slug>...] [--scale N] [--dir D] [--out F]');
  process.exit(1);
}
const scale = args.scale ? parseInt(args.scale, 10) : 4;
const dir = args.dir ? path.resolve(process.cwd(), args.dir) : path.join(root, 'assets/sprites');

// Load each requested slug's stages that exist on disk.
const rows = args.slugs.map((slug) => {
  const tiles = STAGES.map((stage) => {
    const f = path.join(dir, `${slug}-${stage}.png`);
    return fs.existsSync(f) ? { stage, ...decodePng(fs.readFileSync(f)) } : { stage, empty: true };
  });
  return { slug, tiles };
});

// Columns = stages present in any requested slug (keep canonical order).
const cols = STAGES.filter((s) => rows.some((r) => r.tiles.find((t) => t.stage === s && !t.empty)));
if (cols.length === 0) {
  console.error(`No sprites found for: ${args.slugs.join(', ')} (looked in ${dir})`);
  process.exit(1);
}

const T = 64 * scale;       // tile size (sprites are 64×64)
const PAD = 10;             // gutter
const sheetW = PAD + cols.length * (T + PAD);
const sheetH = PAD + rows.length * (T + PAD);
const sheet = new Uint8Array(sheetW * sheetH * 4);

// Dark gutter background.
for (let i = 0; i < sheet.length; i += 4) { sheet[i] = sheet[i + 1] = sheet[i + 2] = 0x2b; sheet[i + 3] = 255; }

const checker = (x, y) => (((x >> 3) + (y >> 3)) & 1 ? 0xbb : 0xee); // 8px squares

function blitTile(tile, ox, oy) {
  for (let ty = 0; ty < T; ty++) {
    for (let tx = 0; tx < T; tx++) {
      const c = checker(tx, ty);
      let r = c, g = c, b = c;
      if (tile && !tile.empty) {
        // nearest-neighbour upscale from the sprite's own size to T×T
        const sx = Math.min(tile.width - 1, Math.floor((tx / T) * tile.width));
        const sy = Math.min(tile.height - 1, Math.floor((ty / T) * tile.height));
        const o = (sy * tile.width + sx) * 4;
        const a = tile.rgba[o + 3] / 255;
        r = Math.round(tile.rgba[o] * a + c * (1 - a));
        g = Math.round(tile.rgba[o + 1] * a + c * (1 - a));
        b = Math.round(tile.rgba[o + 2] * a + c * (1 - a));
      }
      const d = ((oy + ty) * sheetW + (ox + tx)) * 4;
      sheet[d] = r; sheet[d + 1] = g; sheet[d + 2] = b; sheet[d + 3] = 255;
    }
  }
}

rows.forEach((row, ri) => {
  const oy = PAD + ri * (T + PAD);
  cols.forEach((stage, ci) => {
    const ox = PAD + ci * (T + PAD);
    blitTile(row.tiles.find((t) => t.stage === stage), ox, oy);
  });
});

const out = args.out
  ? path.resolve(process.cwd(), args.out)
  : path.join(os.tmpdir(), `pixelpets-contact-${args.slugs.join('-')}.png`);
fs.writeFileSync(out, encodePng(sheetW, sheetH, sheet));

console.log(`Contact sheet: ${out}`);
console.log(`Rows: ${rows.map((r) => r.slug).join(', ')}`);
console.log(`Columns (left→right): ${cols.join('  ')}`);
console.log('Open it to review — transparency shows as a checker pattern.');

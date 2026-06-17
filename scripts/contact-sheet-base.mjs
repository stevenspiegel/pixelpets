// Build a contact sheet of the base/habitat decorations in assets/base/, tiled
// into one PNG so you can eyeball them all at once. Each item is upscaled
// (nearest-neighbour) over a checkerboard so transparency reads as a checker
// pattern. Order/labels follow BASE_DECOR ids.
//
// Usage:
//   node scripts/contact-sheet-base.mjs                 # all known ids
//   node scripts/contact-sheet-base.mjs ball pond       # a subset
//   node scripts/contact-sheet-base.mjs --scale 5 --cols 5 --out sheet.png
import fs from 'fs';
import os from 'os';
import path from 'path';
import url from 'url';
import { decodePng, encodePng } from './sprite-lib.mjs';

const root = path.resolve(path.dirname(url.fileURLToPath(import.meta.url)), '..');

// Default id order mirrors BASE_DECOR in src/state/base.ts.
const DEFAULT_IDS = ['fence', 'rock', 'bush', 'bowl', 'ball', 'flowers', 'tree', 'lamp', 'bed', 'pond'];

function parseArgs(argv) {
  const args = { ids: [] };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a.startsWith('--')) {
      const k = a.slice(2), n = argv[i + 1];
      if (n === undefined || n.startsWith('--')) args[k] = true; else { args[k] = n; i++; }
    } else args.ids.push(a);
  }
  return args;
}

const args = parseArgs(process.argv.slice(2));
const ids = args.ids.length ? args.ids : DEFAULT_IDS;
const scale = args.scale ? parseInt(args.scale, 10) : 4;
const cols = args.cols ? parseInt(args.cols, 10) : 5;
const dir = path.join(root, 'assets/base');

const tiles = ids.map((id) => {
  const f = path.join(dir, `${id}.png`);
  return fs.existsSync(f) ? { id, ...decodePng(fs.readFileSync(f)) } : { id, empty: true };
});

const T = 64 * scale;       // tile size
const PAD = 12;
const rows = Math.ceil(tiles.length / cols);
const sheetW = PAD + cols * (T + PAD);
const sheetH = PAD + rows * (T + PAD);
const sheet = new Uint8Array(sheetW * sheetH * 4);
for (let i = 0; i < sheet.length; i += 4) { sheet[i] = sheet[i + 1] = sheet[i + 2] = 0x2b; sheet[i + 3] = 255; }

const checker = (x, y) => (((x >> 3) + (y >> 3)) & 1 ? 0xbb : 0xee);

function blitTile(tile, ox, oy) {
  for (let ty = 0; ty < T; ty++) {
    for (let tx = 0; tx < T; tx++) {
      const c = checker(tx, ty);
      let r = c, g = c, b = c;
      if (tile && !tile.empty) {
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

tiles.forEach((tile, idx) => {
  const ri = Math.floor(idx / cols), ci = idx % cols;
  blitTile(tile, PAD + ci * (T + PAD), PAD + ri * (T + PAD));
});

const out = args.out ? path.resolve(process.cwd(), args.out) : path.join(os.tmpdir(), 'pixelpets-base-sheet.png');
fs.writeFileSync(out, encodePng(sheetW, sheetH, sheet));
console.log(`Contact sheet: ${out}`);
console.log(`Tiles (row-major, ${cols} per row): ${ids.join(', ')}`);

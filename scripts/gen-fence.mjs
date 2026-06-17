// Generate the habitat fence art procedurally so it tiles seamlessly.
//
// Two outputs, both 64x64 transparent PNGs drawn to fill the whole tile (the
// game renders fence items full-bleed, not inset, so copies in adjacent cells
// butt up against each other):
//   assets/base/fence.png    horizontal run — rails reach the LEFT/RIGHT edges,
//                            pickets repeat on a 16px period that divides 64, so
//                            tiles placed side by side connect with no seam.
//   assets/base/fence_v.png  the same fence rotated 90° — rails reach the
//                            TOP/BOTTOM edges, so tiles stack vertically.
//
// Hand-drawn rather than AI-generated because seamless tiling needs the rails
// to hit the exact pixel edges, which a render won't do reliably.
//
// Usage: node scripts/gen-fence.mjs
import fs from 'fs';
import path from 'path';
import url from 'url';
import { encodePng } from './sprite-lib.mjs';

const root = path.resolve(path.dirname(url.fileURLToPath(import.meta.url)), '..');
const S = 64;

// Warm wood palette (outline → highlight).
const OUT = [0x4a, 0x2f, 0x18, 255];
const DARK = [0x6b, 0x45, 0x23, 255];
const MID = [0x9c, 0x6b, 0x3f, 255];
const LIGHT = [0xc1, 0x90, 0x57, 255];

const buf = new Uint8Array(S * S * 4); // starts fully transparent
const set = (x, y, c) => {
  if (x < 0 || y < 0 || x >= S || y >= S) return;
  const o = (y * S + x) * 4;
  buf[o] = c[0]; buf[o + 1] = c[1]; buf[o + 2] = c[2]; buf[o + 3] = c[3];
};
const rect = (x0, y0, x1, y1, c) => {
  for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) set(x, y, c);
};

// --- Pickets: width 8, period 16 starting at x=4 → 4..11, 20..27, 36..43, 52..59.
// No picket crosses the tile edge, and the gap straddling the edge (60..63 + a
// neighbour's 0..3 = 8px) matches the interior gaps, so the run is seamless.
const PICKET_TOP = 9;      // tip of the pointed cap
const BODY_TOP = 12;       // where the full-width board starts
const PICKET_BOT = 55;     // bottom of the pickets
for (const x0 of [4, 20, 36, 52]) {
  const x1 = x0 + 7;
  // Pointed cap (pyramid narrowing to the tip).
  rect(x0 + 1, 11, x1 - 1, 11, MID);
  rect(x0 + 2, 10, x1 - 2, 10, MID);
  rect(x0 + 3, PICKET_TOP, x1 - 3, PICKET_TOP, MID);
  // Board body.
  rect(x0, BODY_TOP, x1, PICKET_BOT, MID);
  // Shading: left sheen, right + edges shadow/outline.
  for (let y = BODY_TOP; y <= PICKET_BOT; y++) {
    set(x0, y, OUT);          // left outline
    set(x0 + 1, y, LIGHT);    // sheen
    set(x1 - 1, y, DARK);     // right shade
    set(x1, y, OUT);          // right outline
  }
  set(x0, BODY_TOP, OUT);
  rect(x0, PICKET_BOT, x1, PICKET_BOT, OUT); // bottom edge
}

// --- Rails: full width so they connect across tile edges. No vertical outline
// at x=0 / x=63 (that would create a seam).
const drawRail = (y0, y1) => {
  rect(0, y0, S - 1, y1, MID);
  rect(0, y0, S - 1, y0, LIGHT);     // top highlight
  rect(0, y1, S - 1, y1, OUT);       // bottom shadow
  rect(0, y1 - 1, S - 1, y1 - 1, DARK);
};
drawRail(20, 26); // upper rail
drawRail(42, 48); // lower rail

fs.writeFileSync(path.join(root, 'assets/base/fence.png'), encodePng(S, S, buf));

// --- Vertical variant: rotate the horizontal fence 90° clockwise.
const rot = new Uint8Array(S * S * 4);
for (let y = 0; y < S; y++) {
  for (let x = 0; x < S; x++) {
    const sx = y;             // CW: dst(x,y) <- src(y, S-1-x)
    const sy = S - 1 - x;
    const so = (sy * S + sx) * 4;
    const di = (y * S + x) * 4;
    rot[di] = buf[so]; rot[di + 1] = buf[so + 1]; rot[di + 2] = buf[so + 2]; rot[di + 3] = buf[so + 3];
  }
}
fs.writeFileSync(path.join(root, 'assets/base/fence_v.png'), encodePng(S, S, rot));

console.log('Wrote assets/base/fence.png and assets/base/fence_v.png (64x64, tileable).');

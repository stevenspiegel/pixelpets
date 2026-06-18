// Generate the habitat WALL art procedurally as a 16-tile auto-tiling set.
//
// Each tile is keyed by a 4-bit neighbor bitmask (N=1, E=2, S=4, W=8): a set bit
// means the adjacent cell is also a wall, so this tile draws a rail "arm" reaching
// that edge. A center post hub ties the arms together, so any straight run, corner,
// T-junction, cross, or end-cap is composed from the same primitives and connects
// seamlessly with neighbours (opposing arms meet at the shared edge with identical
// rail offsets). Mask 0 (no neighbours) is a lone post.
//
// Hand-drawn (not AI-generated) because seamless tiling needs rails to hit the exact
// pixel edges. Outputs assets/base/wall_0.png .. wall_15.png.
//
// Usage: node scripts/gen-walls.mjs
import fs from 'fs';
import path from 'path';
import url from 'url';
import { encodePng } from './sprite-lib.mjs';

const root = path.resolve(path.dirname(url.fileURLToPath(import.meta.url)), '..');
const S = 64;

// Warm wood palette (outline → highlight), matching the old fence art.
const OUT = [0x4a, 0x2f, 0x18, 255];
const DARK = [0x6b, 0x45, 0x23, 255];
const MID = [0x9c, 0x6b, 0x3f, 255];
const LIGHT = [0xc1, 0x90, 0x57, 255];

// Two rail spans, symmetric around the 32px centre, used for both axes so corners
// line up. Centre post hub bounds.
const RA = [20, 26]; // first rail span
const RB = [38, 44]; // second rail span
const POST = [24, 40]; // centre hub bounds (inclusive)

const mk = () => new Uint8Array(S * S * 4); // fully transparent
const set = (buf, x, y, c) => {
  if (x < 0 || y < 0 || x >= S || y >= S) return;
  const o = (y * S + x) * 4;
  buf[o] = c[0]; buf[o + 1] = c[1]; buf[o + 2] = c[2]; buf[o + 3] = c[3];
};
const rect = (buf, x0, y0, x1, y1, c) => {
  for (let y = Math.max(0, y0); y <= Math.min(S - 1, y1); y++)
    for (let x = Math.max(0, x0); x <= Math.min(S - 1, x1); x++) set(buf, x, y, c);
};

// Horizontal rail bar across [x0,x1] at row span [r0,r1], shaded top→bottom.
const hRail = (buf, x0, x1, r0, r1) => {
  rect(buf, x0, r0, x1, r1, MID);
  rect(buf, x0, r0, x1, r0, LIGHT); // top highlight
  rect(buf, x0, r1 - 1, x1, r1 - 1, DARK);
  rect(buf, x0, r1, x1, r1, OUT); // bottom shadow
};
// Vertical rail bar down [y0,y1] at col span [c0,c1], shaded left→right.
const vRail = (buf, y0, y1, c0, c1) => {
  rect(buf, c0, y0, c1, y1, MID);
  rect(buf, c0, y0, c0, y1, LIGHT); // left highlight
  rect(buf, c1 - 1, y0, c1 - 1, y1, DARK);
  rect(buf, c1, y0, c1, y1, OUT); // right shadow
};

const drawWall = (mask) => {
  const buf = mk();
  const N = mask & 1, E = mask & 2, Sb = mask & 4, W = mask & 8;
  // Arms reach the exact edge so neighbouring tiles connect seamlessly.
  if (E) { hRail(buf, 32, S - 1, RA[0], RA[1]); hRail(buf, 32, S - 1, RB[0], RB[1]); }
  if (W) { hRail(buf, 0, 32, RA[0], RA[1]); hRail(buf, 0, 32, RB[0], RB[1]); }
  if (N) { vRail(buf, 0, 32, RA[0], RA[1]); vRail(buf, 0, 32, RB[0], RB[1]); }
  if (Sb) { vRail(buf, 32, S - 1, RA[0], RA[1]); vRail(buf, 32, S - 1, RB[0], RB[1]); }
  // Centre post hub, drawn last so all arms tie into it cleanly.
  rect(buf, POST[0], POST[0], POST[1], POST[1], MID);
  rect(buf, POST[0], POST[0], POST[1], POST[0], LIGHT); // top highlight
  rect(buf, POST[0], POST[0], POST[0], POST[1], LIGHT); // left highlight
  rect(buf, POST[1], POST[0], POST[1], POST[1], OUT);   // right outline
  rect(buf, POST[0], POST[1], POST[1], POST[1], OUT);   // bottom outline
  return buf;
};

for (let mask = 0; mask < 16; mask++) {
  fs.writeFileSync(path.join(root, `assets/base/wall_${mask}.png`), encodePng(S, S, drawWall(mask)));
}
console.log('Wrote assets/base/wall_0.png .. wall_15.png (64x64, auto-tiling).');

// Base / habitat decoration converter. Sibling to make-sprite.mjs, but for the
// inanimate decorations in assets/base/ rather than creatures.
//
// Turns any source image (an AI render, a hand-drawn PNG) into a game-ready
// decoration: knocks out the background, trims to the subject, fits it into a
// square transparent frame, and writes assets/base/<id>.png — matching the
// naming the game expects (see assets/base/README.md and src/base/images.ts).
//
// Unlike make-sprite, it does NOT snap colours to the creature palette: a red
// ball should stay red, a blue pond blue. It only cleans up the cutout.
//
// Works fully offline — no API key, no network.
//
// Usage:
//   node scripts/make-base.mjs --in raw.png --id ball
//   node scripts/make-base.mjs --in raw.png --id pond --size 64 --bg "#ffffff"
//
// Options:
//   --in <path>           Source image (PNG). Required.
//   --id <name>           Decor id (must match a BASE_DECOR entry / images.ts
//                         key, e.g. ball, pond, tree). Required.
//   --size <n>            Output size in px (default 64, square).
//   --fit contain|cover|stretch   How to fit the source (default contain).
//   --autobg              Auto-remove the background by flood-fill from the
//                         edges (default on; best for AI renders on a flat
//                         backdrop). Pass --no-autobg to skip.
//   --bg <#rrggbb>        Knock out this solid background colour instead of autobg.
//   --bg-tolerance <n>    Colour distance for --bg / --autobg (autobg default 60).
//   --alpha-threshold <n> Pixels with alpha below this become transparent (default 128).
import fs from 'fs';
import path from 'path';
import url from 'url';
import {
  decodePng, encodePng, fitToCanvas, keyOutBackground, removeBackgroundFlood,
  fillHoles, removeSpecks, trimToContent, cleanupSprite,
} from './sprite-lib.mjs';

const root = path.resolve(path.dirname(url.fileURLToPath(import.meta.url)), '..');

function parseArgs(argv) {
  const args = {};
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (!a.startsWith('--')) continue;
    const key = a.slice(2);
    const next = argv[i + 1];
    if (next === undefined || next.startsWith('--')) args[key] = true;
    else { args[key] = next; i++; }
  }
  return args;
}

function fail(msg) {
  console.error(`Error: ${msg}\nRun with --help for usage.`);
  process.exit(1);
}

const args = parseArgs(process.argv.slice(2));
if (args.help) {
  console.log(fs.readFileSync(url.fileURLToPath(import.meta.url), 'utf8')
    .split('\n').filter((l) => l.startsWith('//')).map((l) => l.slice(3)).join('\n'));
  process.exit(0);
}

const { in: inPath, id } = args;
if (!inPath) fail('--in <path> is required');
if (!id || id === true) fail('--id <name> is required');
if (!fs.existsSync(inPath)) fail(`source image not found: ${inPath}`);

const size = args.size ? parseInt(args.size, 10) : 64;
const fit = args.fit || 'contain';
if (!['contain', 'cover', 'stretch'].includes(fit)) fail('--fit must be contain, cover or stretch');
const alphaThreshold = args['alpha-threshold'] ? parseInt(args['alpha-threshold'], 10) : 128;
const bgTolerance = args['bg-tolerance'] ? parseInt(args['bg-tolerance'], 10) : 28;
// autobg defaults on; --bg <hex> overrides it; --no-autobg disables both.
const useAutobg = args.bg ? false : args.autobg !== false && !args['no-autobg'];

let decoded;
try {
  decoded = decodePng(fs.readFileSync(inPath));
} catch (e) {
  fail(`could not read PNG (${e.message}). Re-export as a non-interlaced PNG and try again.`);
}
let { width, height, rgba } = decoded;

if (useAutobg) removeBackgroundFlood(rgba, width, height, args['bg-tolerance'] ? bgTolerance : 60);
else if (args.bg) keyOutBackground(rgba, args.bg, bgTolerance);
if (useAutobg || args.bg) {
  const filled = fillHoles(rgba, width, height);
  if (filled > 0) console.log(`Filled ${filled} enclosed hole pixel(s).`);
  removeSpecks(rgba, width, height);
}
// Always trim to the subject so decorations fill their cell consistently.
const t = trimToContent(rgba, width, height); rgba = t.rgba; width = t.width; height = t.height;
const framed = fitToCanvas(rgba, width, height, size, fit);
// Drop the very low-alpha fringe the resample leaves behind.
for (let i = 0; i < framed.length; i += 4) if (framed[i + 3] < alphaThreshold) framed[i + 3] = 0;
if ((useAutobg || args.bg) && !args['no-clean']) cleanupSprite(framed, size, size);

const outPath = path.join(root, 'assets/base', `${id}.png`);
fs.mkdirSync(path.dirname(outPath), { recursive: true });
fs.writeFileSync(outPath, encodePng(size, size, framed));

const used = new Set();
for (let i = 0; i < framed.length; i += 4) if (framed[i + 3] > 0) used.add(`${framed[i]},${framed[i + 1]},${framed[i + 2]}`);
console.log(`Wrote ${path.relative(root, outPath)} (${size}x${size}, ${used.size} colours, from source ${decoded.width}x${decoded.height})`);

// Drop-in sprite converter. Turns any source image (a generated render, an
// Aseprite/LibreSprite export, a hand-drawn PNG) into a game-ready sprite that
// matches the existing art: fits it into a 64x64 transparent frame, snaps every
// colour to the shared palette (src/sprites/palette.ts), and writes
// assets/sprites/<slug>-<stage>.png. By default it then wires the file into
// src/sprites/images.ts so it renders immediately.
//
// Works fully offline — no API key, no network, no npm install.
//
// Usage:
//   node scripts/make-sprite.mjs --in raw.png --slug fox --stage baby
//   node scripts/make-sprite.mjs --in raw.png --slug dragon --stage ascended
//
// Options:
//   --in <path>           Source image (PNG). Required.
//   --slug <name>         Species slug, e.g. fox (must exist in species-map.json,
//                         or pass --species to register a new one). Required.
//   --stage <name>        baby | child | teen | adult | ascended. Required.
//   --species <emoji>     Register/override the slug -> emoji mapping.
//   --size <n>            Output size in px (default 64, square).
//   --fit contain|cover|stretch   How to fit the source (default contain).
//   --autobg              Auto-remove the background by flood-fill from the
//                         edges (best for AI renders on a flat backdrop; no
//                         colour needed, won't punch holes in the subject).
//   --bg <#rrggbb>        Knock out this solid background colour to transparent.
//   --bg-tolerance <n>    Colour distance for --bg / --autobg (autobg default 60).
//   --alpha-threshold <n> Pixels with alpha below this become transparent (default 128).
//   --no-wire             Don't touch images.ts (just write the PNG).
import fs from 'fs';
import path from 'path';
import url from 'url';
import {
  decodePng, encodePng, fitToCanvas, keyOutBackground, removeBackgroundFlood,
  quantizeToPalette, loadPalette, loadRegistry, STAGES,
} from './sprite-lib.mjs';
import { wireSprites } from './wire-sprites.mjs';

const root = path.resolve(path.dirname(url.fileURLToPath(import.meta.url)), '..');

function parseArgs(argv) {
  const args = {};
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a.startsWith('--')) {
      const key = a.slice(2);
      const next = argv[i + 1];
      if (next === undefined || next.startsWith('--')) args[key] = true;
      else { args[key] = next; i++; }
    }
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

const { in: inPath, slug, stage } = args;
if (!inPath) fail('--in <path> is required');
if (!slug) fail('--slug <name> is required');
if (!stage) fail('--stage <name> is required');
if (!STAGES.includes(stage)) fail(`--stage must be one of: ${STAGES.join(', ')}`);
if (!fs.existsSync(inPath)) fail(`source image not found: ${inPath}`);

const size = args.size ? parseInt(args.size, 10) : 64;
const fit = args.fit || 'contain';
if (!['contain', 'cover', 'stretch'].includes(fit)) fail('--fit must be contain, cover or stretch');
const alphaThreshold = args['alpha-threshold'] ? parseInt(args['alpha-threshold'], 10) : 128;
const bgTolerance = args['bg-tolerance'] ? parseInt(args['bg-tolerance'], 10) : 28;

// Resolve / register the slug -> emoji mapping.
const registryPath = path.join(root, 'scripts/species-map.json');
const registry = loadRegistry(root);
let entry = registry.species.find((s) => s.slug === slug);
if (!entry) {
  if (!args.species) {
    fail(`unknown slug "${slug}". Pass --species <emoji> to register it, e.g. --species 🦊`);
  }
  entry = { slug, emoji: args.species };
  registry.species.push(entry);
  fs.writeFileSync(registryPath, JSON.stringify(registry, null, 2) + '\n');
  console.log(`Registered new species: ${slug} -> ${args.species}`);
} else if (args.species && args.species !== entry.emoji) {
  entry.emoji = args.species;
  fs.writeFileSync(registryPath, JSON.stringify(registry, null, 2) + '\n');
  console.log(`Updated emoji for ${slug} -> ${args.species}`);
}
if (stage === 'ascended' && !entry.ascended) {
  console.warn(`Warning: ${slug} is not marked "ascended" in species-map.json; only dragon/unicorn ascend in-game.`);
}

// Decode -> (optional bg key) -> fit -> quantize -> encode.
const palette = loadPalette(root);
let decoded;
try {
  decoded = decodePng(fs.readFileSync(inPath));
} catch (e) {
  fail(`could not read PNG (${e.message}). Re-export as a non-interlaced PNG and try again.`);
}
const { width, height, rgba } = decoded;

if (args.autobg) removeBackgroundFlood(rgba, width, height, args['bg-tolerance'] ? bgTolerance : 60);
else if (args.bg) keyOutBackground(rgba, args.bg, bgTolerance);
const framed = fitToCanvas(rgba, width, height, size, fit);
quantizeToPalette(framed, palette, alphaThreshold);

const outPath = path.join(root, 'assets/sprites', `${slug}-${stage}.png`);
fs.writeFileSync(outPath, encodePng(size, size, framed));

// Report how many distinct opaque palette colours ended up in the sprite.
const used = new Set();
for (let i = 0; i < framed.length; i += 4) if (framed[i + 3] > 0) used.add(`${framed[i]},${framed[i + 1]},${framed[i + 2]}`);
console.log(`Wrote ${path.relative(root, outPath)} (${size}x${size}, ${used.size} palette colours, from ${width}x${height})`);

if (!args['no-wire']) {
  wireSprites({ quiet: false });
} else {
  console.log('Skipped wiring (--no-wire). Run scripts/wire-sprites.mjs when ready.');
}

// Regenerate the IMAGE_SPRITES map in src/sprites/images.ts from the PNG files
// present in assets/sprites/ + the slug<->emoji map in species-map.json.
//
// A species is emitted only if it has at least one matching <slug>-<stage>.png.
// Stages appear in canonical order (baby, child, teen, adult, ascended), each
// only if its file exists. The rest of images.ts (header, types, the
// imageSpriteFor helper) is preserved — only the literal between the markers
//   export const IMAGE_SPRITES ... = { ... };
// is rewritten. Idempotent: re-running with no new files produces no change.
//
// Usage: node scripts/wire-sprites.mjs
import fs from 'fs';
import path from 'path';
import url from 'url';
import { loadRegistry, STAGES } from './sprite-lib.mjs';

const root = path.resolve(path.dirname(url.fileURLToPath(import.meta.url)), '..');

export function wireSprites({ quiet = false } = {}) {
  const registry = loadRegistry(root);
  const spritesDir = path.join(root, 'assets/sprites');
  const present = new Set(
    fs.readdirSync(spritesDir).filter((f) => f.endsWith('.png')).map((f) => f.slice(0, -4))
  );

  const entries = [];
  for (const { slug, emoji, ascended } of registry.species) {
    const stages = STAGES.filter((stage) => {
      if (stage === 'ascended' && !ascended) return false;
      return present.has(`${slug}-${stage}`);
    });
    if (stages.length === 0) continue;
    const lines = stages
      .map((stage) => `    ${stage}: require('../../assets/sprites/${slug}-${stage}.png'),`)
      .join('\n');
    entries.push(`  '${emoji}': {\n${lines}\n  },`);
  }

  const literal =
    'export const IMAGE_SPRITES: Record<string, StageImages> = {\n' +
    entries.join('\n') +
    '\n};';

  const file = path.join(root, 'src/sprites/images.ts');
  const text = fs.readFileSync(file, 'utf8');
  // Replace from the declaration up to the first line that is exactly "};".
  const re = /export const IMAGE_SPRITES: Record<string, StageImages> = \{[\s\S]*?\n\};/;
  if (!re.test(text)) throw new Error('Could not locate IMAGE_SPRITES block in images.ts');
  const next = text.replace(re, literal);

  if (next === text) {
    if (!quiet) console.log('IMAGE_SPRITES already up to date.');
    return { changed: false, count: entries.length };
  }
  fs.writeFileSync(file, next);
  if (!quiet) console.log(`Wired ${entries.length} species into src/sprites/images.ts`);
  return { changed: true, count: entries.length };
}

// Run when invoked directly.
if (import.meta.url === url.pathToFileURL(process.argv[1]).href) {
  wireSprites();
}

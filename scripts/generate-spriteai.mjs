// Generate a source sprite from the Sprite-AI API (https://www.sprite-ai.art),
// then optionally pipe it straight through the sprite converter + wirer.
//
// Sprite-AI returns a finished PNG inline as base64 (still sprites are
// synchronous). It already renders at 64x64, but we still pass it through
// make-sprite.mjs so the colours snap to the shared palette and the background
// is knocked out — matching the rest of the art. Each still costs 1 API token.
//
// AUTH: needs an API key (starts with sai_sk_). Put it in .env as
//   SPRITE_AI_API_KEY=sai_sk_...
// (this script loads .env itself) or pass --key. The .env file is gitignored.
//
// NETWORK: needs outbound access to www.sprite-ai.art.
//
// Usage (generate only):
//   node scripts/generate-spriteai.mjs --prompt "pixel art baby fox, side view" --out /tmp/fox.png
//
// Usage (generate + convert + wire in one go — extra flags pass to make-sprite):
//   node scripts/generate-spriteai.mjs --prompt "pixel art baby fox, side view" \
//     --out /tmp/fox.png --slug fox --stage baby --autobg
//
// Options:
//   --prompt <text>        Text description of the sprite. Required.
//   --out <path>           Where to save the generated PNG. Required.
//   --asset-type <type>    Sprite-AI routing category (default "character").
//   --key <sai_sk_...>     API key (or set SPRITE_AI_API_KEY in env/.env).
//   --timeout <sec>        Max wait for the response (default 120).
//   Any make-sprite flags (--slug, --stage, --autobg, --bg, --fit, ...) →
//   convert + wire after download (needs --slug and --stage).
import fs from 'fs';
import path from 'path';
import url from 'url';
import { spawnSync } from 'child_process';

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

// Minimal .env loader: populate process.env from KEY=VALUE lines if not already
// set (we only need SPRITE_AI_API_KEY). Quiet if the file is absent.
export function loadEnv(file) {
  let text;
  try { text = fs.readFileSync(file, 'utf8'); } catch { return; }
  for (const line of text.split(/\r?\n/)) {
    const m = /^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/.exec(line);
    if (!m) continue;
    const [, k, v] = m;
    if (process.env[k] === undefined) {
      process.env[k] = v.replace(/^['"]|['"]$/g, '');
    }
  }
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  if (args.help) {
    console.log(fs.readFileSync(url.fileURLToPath(import.meta.url), 'utf8')
      .split('\n').filter((l) => l.startsWith('//')).map((l) => l.slice(3)).join('\n'));
    return;
  }
  const die = (m) => { console.error(`Error: ${m}\nRun with --help for usage.`); process.exit(1); };

  loadEnv(path.join(root, '.env'));
  const key = args.key || process.env.SPRITE_AI_API_KEY;
  if (!key) die('No API key — set SPRITE_AI_API_KEY in .env or pass --key sai_sk_...');
  if (!args.prompt || args.prompt === true) die('--prompt <text> is required');
  if (!args.out || args.out === true) die('--out <path> is required');

  const assetType = (args['asset-type'] && args['asset-type'] !== true) ? args['asset-type'] : 'character';
  const timeoutMs = (args.timeout ? parseInt(args.timeout, 10) : 120) * 1000;

  const endpoint = 'https://www.sprite-ai.art/api/sprites';
  const body = { prompt: args.prompt, asset_type: assetType };
  console.log(`POST ${endpoint}  prompt=${JSON.stringify(args.prompt)} asset_type=${assetType}`);

  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), timeoutMs);
  try {
    const res = await fetch(endpoint, {
      method: 'POST',
      headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
      signal: ctrl.signal,
    });
    if (!res.ok) die(`HTTP ${res.status}: ${(await res.text().catch(() => '')).slice(0, 300)}`);
    const json = await res.json();
    const b64 = json && json.image && json.image.pngBase64;
    if (!b64) die(`No image.pngBase64 in response: ${JSON.stringify(json).slice(0, 300)}`);

    const buf = Buffer.from(b64, 'base64');
    fs.mkdirSync(path.dirname(path.resolve(args.out)), { recursive: true });
    fs.writeFileSync(args.out, buf);
    console.log(
      `Saved ${args.out} (${buf.length} bytes, ${json.width}x${json.height}) ` +
      `— ${json.tokensSpent ?? '?'} token(s) spent`
    );
  } catch (e) {
    if (e.name === 'AbortError') die(`timed out after ${timeoutMs / 1000}s`);
    die(e.message);
  } finally {
    clearTimeout(timer);
  }

  // Chain into the converter (+ auto-wire) if conversion flags were supplied.
  if (args.slug && args.stage) {
    const passthrough = ['autobg', 'bg', 'bg-tolerance', 'fit', 'alpha-threshold', 'size', 'species', 'no-wire'];
    const convertArgs = ['scripts/make-sprite.mjs', '--in', args.out, '--slug', args.slug, '--stage', args.stage];
    for (const k of passthrough) {
      if (args[k] === undefined) continue;
      convertArgs.push(`--${k}`);
      if (args[k] !== true) convertArgs.push(String(args[k]));
    }
    console.log(`\nConverting → node ${convertArgs.join(' ')}`);
    const r = spawnSync('node', convertArgs, { cwd: root, stdio: 'inherit' });
    process.exit(r.status ?? 0);
  } else {
    console.log('\nNext: node scripts/make-sprite.mjs --in ' + args.out + ' --slug <name> --stage <stage> --autobg');
  }
}

if (process.argv[1] && import.meta.url === url.pathToFileURL(process.argv[1]).href) main();

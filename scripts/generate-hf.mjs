// Generate a source image from a free Hugging Face (Gradio) Space, then
// optionally pipe it straight through the sprite converter.
//
// Spaces are free and need no key (an HF token only raises rate limits). This
// speaks the modern Gradio "/call" REST protocol (Gradio 4.x+): POST the inputs
// to get an event id, stream the result, then download the output image.
//
// IMPORTANT: every Space has a different input signature. Open the Space's
// "Use via API" page (bottom of the Space UI) to see the exact `api_name` and
// the order/shape of its inputs, then pass them with --api-name and --data.
// The defaults assume a simple text-to-image Space: data = [prompt, negative].
//
// NETWORK: this needs outbound access to <space>.hf.space. It will NOT work in
// a sandbox whose network policy blocks Hugging Face — run it where HF is
// reachable.
//
// Usage (generate only):
//   node scripts/generate-hf.mjs --space nerijs/pixel-art-xl \
//     --api-name /predict --prompt "pixel art fox, side view, baby" --out /tmp/fox.png
//
// Usage (generate + convert + wire in one go — extra flags pass to make-sprite):
//   node scripts/generate-hf.mjs --space owner/space --prompt "pixel art fox baby" \
//     --out /tmp/fox.png --slug fox --stage baby --bg '#ffffff'
//
// Options:
//   --space <owner/name|host>  Space id (→ <owner>-<name>.hf.space) or full host. Required.
//   --api-name <name>          Gradio endpoint, e.g. /predict or /infer (default /predict).
//   --prompt <text>            Prompt (used when --data is not given). Required unless --data.
//   --negative <text>          Negative prompt (default "").
//   --data <json-array>        Exact input array for the Space (overrides --prompt/--negative).
//   --out <path>               Where to save the generated image. Required.
//   --token <hf_xxx>           HF token (or set HF_TOKEN). Optional, raises limits.
//   --timeout <sec>            Max wait for the result (default 180).
//   Any make-sprite flags (--slug, --stage, --bg, --fit, ...) → convert after download.
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

// Turn "owner/name" into the Space host "owner-name.hf.space". A value that
// already looks like a host (contains a dot) is used as-is.
export function resolveHost(space) {
  if (space.includes('.')) return space.replace(/^https?:\/\//, '').replace(/\/$/, '');
  const slug = space.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
  return `${slug}.hf.space`;
}

// Parse a Gradio "/call" SSE stream into the final data array. The stream emits
// `event: complete` followed by `data: <json>`; we return the parsed payload.
export function parseSse(text) {
  const lines = text.split(/\r?\n/);
  let event = null;
  let result;
  let errored = null;
  for (const line of lines) {
    if (line.startsWith('event:')) event = line.slice(6).trim();
    else if (line.startsWith('data:')) {
      const payload = line.slice(5).trim();
      if (event === 'complete') { try { result = JSON.parse(payload); } catch {} }
      else if (event === 'error') errored = payload;
    }
  }
  if (result === undefined && errored) throw new Error(`Space returned an error: ${errored}`);
  return result;
}

// Find the first image-like output in a Gradio result array and return a URL.
export function imageUrlFromResult(result, host) {
  const items = Array.isArray(result) ? result : [result];
  const stack = [...items];
  while (stack.length) {
    const v = stack.shift();
    if (v == null) continue;
    if (typeof v === 'string') {
      if (/^https?:\/\//.test(v)) return v;
      if (/\.(png|jpe?g|webp)$/i.test(v)) return `https://${host}/file=${v}`;
      continue;
    }
    if (typeof v === 'object') {
      if (typeof v.url === 'string') return v.url;
      if (typeof v.path === 'string') return `https://${host}/file=${v.path}`;
      stack.push(...Object.values(v));
    }
  }
  return null;
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  if (args.help) {
    console.log(fs.readFileSync(url.fileURLToPath(import.meta.url), 'utf8')
      .split('\n').filter((l) => l.startsWith('//')).map((l) => l.slice(3)).join('\n'));
    return;
  }
  const die = (m) => { console.error(`Error: ${m}\nRun with --help for usage.`); process.exit(1); };
  if (!args.space) die('--space <owner/name|host> is required');
  if (!args.out) die('--out <path> is required');
  if (!args.data && !args.prompt) die('--prompt <text> (or --data <json>) is required');

  const host = resolveHost(args.space);
  const apiName = (args['api-name'] || '/predict').replace(/^\/?/, '/');
  const token = args.token || process.env.HF_TOKEN;
  const timeoutMs = (args.timeout ? parseInt(args.timeout, 10) : 180) * 1000;
  const data = args.data ? JSON.parse(args.data) : [args.prompt, args.negative || ''];

  const headers = { 'Content-Type': 'application/json' };
  if (token) headers.Authorization = `Bearer ${token}`;

  const callUrl = `https://${host}/call${apiName}`;
  console.log(`POST ${callUrl}  data=${JSON.stringify(data)}`);

  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), timeoutMs);
  let imageUrl;
  try {
    const post = await fetch(callUrl, {
      method: 'POST', headers, body: JSON.stringify({ data }), signal: ctrl.signal,
    });
    if (!post.ok) die(`POST failed: HTTP ${post.status} ${await post.text().catch(() => '')}`);
    const { event_id, hash } = await post.json();
    const id = event_id || hash;
    if (!id) die('Space did not return an event id (unexpected API shape)');

    const streamRes = await fetch(`${callUrl}/${id}`, { headers, signal: ctrl.signal });
    if (!streamRes.ok) die(`result stream failed: HTTP ${streamRes.status}`);
    const text = await streamRes.text();
    const result = parseSse(text);
    if (result === undefined) die('No completed result in the Space response (it may still be queued or the API shape differs)');

    imageUrl = imageUrlFromResult(result, host);
    if (!imageUrl) die(`Couldn't find an image in the result: ${JSON.stringify(result).slice(0, 400)}`);

    const img = await fetch(imageUrl, { headers, signal: ctrl.signal });
    if (!img.ok) die(`image download failed: HTTP ${img.status}`);
    const buf = Buffer.from(await img.arrayBuffer());
    fs.mkdirSync(path.dirname(path.resolve(args.out)), { recursive: true });
    fs.writeFileSync(args.out, buf);
    console.log(`Saved ${args.out} (${buf.length} bytes) from ${imageUrl}`);
  } catch (e) {
    if (e.name === 'AbortError') die(`timed out after ${timeoutMs / 1000}s (free Spaces queue or sleep — retry)`);
    die(e.message);
  } finally {
    clearTimeout(timer);
  }

  // Chain into the converter if conversion flags were supplied.
  if (args.slug && args.stage) {
    const passthrough = ['bg', 'bg-tolerance', 'fit', 'alpha-threshold', 'size', 'species', 'no-wire'];
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
    console.log('\nNext: node scripts/make-sprite.mjs --in ' + args.out + ' --slug <name> --stage <stage>');
  }
}

if (process.argv[1] && import.meta.url === url.pathToFileURL(process.argv[1]).href) main();

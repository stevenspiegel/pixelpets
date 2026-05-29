// Generate all four sprite stages for one species end-to-end against a local
// ComfyUI server, then convert each render to a game sprite.
//
// For each stage it: builds the positive prompt from the shared template,
// POSTs scripts/comfyui/pixelpet-sdxl-lora.json (positive text + seed overridden)
// to ComfyUI's /prompt API, waits for completion, downloads the output PNG to
// scripts/comfyui/renders/, then runs make-sprite.mjs --autobg --trim and
// preview-sprite.mjs, printing the holes count per stage.
//
// Usage:
//   node scripts/comfyui/gen-species.mjs <slug> <seed> "<subject>" [--emoji 🦇] [--stages baby,child]
//                                        [--tolerance <n>]
//
// Renders on the model's default flat backdrop and cuts it out with
// make-sprite.mjs --autobg --trim. The flood-fill in sprite-lib.mjs samples the
// real corner colour, so low-contrast subjects cut cleanly at the default
// tolerance; pass --tolerance only to override per species.
//
// Env: COMFYUI_URL (default http://127.0.0.1:8000)
import fs from 'fs';
import path from 'path';
import url from 'url';
import { execFileSync } from 'child_process';

const root = path.resolve(path.dirname(url.fileURLToPath(import.meta.url)), '../..');
const API = process.env.COMFYUI_URL || 'http://127.0.0.1:8000';
const rendersDir = path.join(root, 'scripts/comfyui/renders');
fs.mkdirSync(rendersDir, { recursive: true });

const STAGE_MOD = {
  baby: 'newborn baby, tiny chibi body, big round head, oversized eyes, soft and round, adorable',
  child: 'young, small body, slightly longer limbs, playful, cute proportions',
  teen: 'adolescent, taller and lankier, lean, growing into adult features',
  adult: 'fully grown adult, strong confident stance, full detailed markings, majestic',
};
// Framing suffix — mirrors scripts/comfyui/prompts.md. The negative prompt is
// left as baked into the workflow (node 7) and NOT overridden here.
const SUFFIX = 'full body from head to toe, entire animal visible, small in frame, wide shot, standing, centered, simple flat solid background, crisp clean pixels, limited palette, cute game creature sprite, 8-bit, by nerijs';

// --- args -------------------------------------------------------------------
const argv = process.argv.slice(2);
const positional = [];
const opts = {};
for (let i = 0; i < argv.length; i++) {
  if (argv[i].startsWith('--')) opts[argv[i].slice(2)] = argv[++i];
  else positional.push(argv[i]);
}
const [slug, seedStr, subject] = positional;
if (!slug || !seedStr || !subject) {
  console.error('Usage: node scripts/comfyui/gen-species.mjs <slug> <seed> "<subject>" [--emoji X] [--stages a,b]');
  process.exit(1);
}
const seed = parseInt(seedStr, 10);
const stages = (opts.stages ? opts.stages.split(',') : ['baby', 'child', 'teen', 'adult']).map((s) => s.trim());
const tolerance = opts.tolerance || null;

const base = JSON.parse(fs.readFileSync(path.join(root, 'scripts/comfyui/pixelpet-sdxl-lora.json'), 'utf8'));

function buildWorkflow(stage) {
  const wf = JSON.parse(JSON.stringify(base));
  wf['3'].inputs.seed = seed;
  wf['6'].inputs.text = `pixel art, ${STAGE_MOD[stage]}, ${subject}, ${SUFFIX}`;
  // node 7 (negative) is left as baked into the workflow JSON.
  wf['9'].inputs.filename_prefix = `pixelpet-${slug}-${stage}-s${seed}`;
  return wf;
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function api(p, init) {
  const res = await fetch(`${API}${p}`, init);
  if (!res.ok) throw new Error(`${p} -> ${res.status} ${await res.text().catch(() => '')}`);
  return res;
}

async function enqueue(workflow) {
  const res = await api('/prompt', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ prompt: workflow }),
  });
  return (await res.json()).prompt_id;
}

async function waitForOutput(promptId, timeoutMs = 180000) {
  const t0 = Date.now();
  while (Date.now() - t0 < timeoutMs) {
    const hist = await (await api(`/history/${promptId}`)).json();
    const entry = hist[promptId];
    if (entry && entry.status && entry.status.completed) {
      for (const node of Object.values(entry.outputs || {})) {
        if (node.images && node.images.length) return node.images[0];
      }
      throw new Error('completed but no image output');
    }
    if (entry && entry.status && entry.status.status_str === 'error') {
      throw new Error(`ComfyUI error: ${JSON.stringify(entry.status)}`);
    }
    await sleep(2000);
  }
  throw new Error(`timeout waiting for ${promptId}`);
}

async function download(img, dest) {
  const qs = new URLSearchParams({ filename: img.filename, subfolder: img.subfolder || '', type: img.type || 'output' });
  const res = await api(`/view?${qs}`);
  fs.writeFileSync(dest, Buffer.from(await res.arrayBuffer()));
}

function run(cmd, args) {
  return execFileSync(cmd, args, { cwd: root, encoding: 'utf8' });
}

const results = [];
for (const stage of stages) {
  process.stdout.write(`\n=== ${slug}/${stage} (seed ${seed}) ===\n`);
  const promptId = await enqueue(buildWorkflow(stage));
  process.stdout.write(`enqueued ${promptId}, waiting...\n`);
  const img = await waitForOutput(promptId);
  const render = path.join(rendersDir, `pixelpet-${slug}-${stage}-s${seed}.png`);
  await download(img, render);
  process.stdout.write(`downloaded ${path.relative(root, render)}\n`);

  const spriteArgs = ['scripts/make-sprite.mjs', '--in', render, '--slug', slug, '--stage', stage, '--autobg', '--trim'];
  if (tolerance) spriteArgs.push('--bg-tolerance', tolerance);
  if (opts.emoji) spriteArgs.push('--species', opts.emoji);
  process.stdout.write(run('node', spriteArgs).trim() + '\n');

  const preview = run('node', ['scripts/preview-sprite.mjs', `assets/sprites/${slug}-${stage}.png`]);
  const line = preview.split('\n').find((l) => l.includes('interior holes')) || '';
  const m = line.match(/interior holes (\d+)/);
  const holes = m ? parseInt(m[1], 10) : -1;
  results.push({ stage, holes, line: line.trim() });
  process.stdout.write(line.trim() + '\n');
}

process.stdout.write(`\n--- ${slug} summary ---\n`);
let bad = 0;
for (const r of results) {
  if (r.holes !== 0) bad++;
  process.stdout.write(`${r.holes === 0 ? 'OK ' : '⚠  '}${r.line}\n`);
}
process.stdout.write(bad ? `\n${bad} stage(s) have holes>0 — review.\n` : `\nAll stages clean (0 holes).\n`);

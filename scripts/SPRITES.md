# Sprite pipeline

Turn any source image (an AI render, an Aseprite/LibreSprite export, a
hand-drawn PNG) into a game-ready pet sprite that matches the existing art —
then wire it into the app automatically. Runs fully offline: no API key, no
network, no `npm install` (PNG codec is built on Node's `zlib`).

## One sprite at a time

```sh
node scripts/make-sprite.mjs --in path/to/render.png --slug fox --stage baby
```

There are also `npm` shortcuts (note the `--` before the flags, which tells npm
to pass them through):

```sh
npm run sprite -- --in path/to/render.png --slug fox --stage baby
npm run sprite:generate -- --space owner/space --prompt "..." --out /tmp/fox.png --slug fox --stage baby
npm run sprite:wire
```

This fits the image into a 64×64 transparent frame, snaps every colour to the
shared palette (`src/sprites/palette.ts`), writes
`assets/sprites/fox-baby.png`, and registers it in `src/sprites/images.ts` so it
renders immediately.

Stages: `baby`, `child`, `teen`, `adult`, `ascended` (ascended only for
dragon/unicorn). Do the four life stages per species for full coverage.

### Useful flags

| Flag | Purpose |
|------|---------|
| `--bg '#00ff00'` | Knock out a solid background colour (for generators that output an opaque backdrop). |
| `--bg-tolerance 28` | How close a colour must be to `--bg` to be removed. |
| `--fit contain\|cover\|stretch` | How the source fills the frame (default `contain`, preserves aspect). |
| `--alpha-threshold 128` | Pixels below this alpha become transparent (crisp edges). |
| `--size 64` | Output size in px (square). |
| `--species 🦊` | Register a brand-new slug→emoji mapping (or override one). |
| `--no-wire` | Just write the PNG; don't touch `images.ts`. |

## Generate from a free Hugging Face Space

`generate-hf.mjs` pulls a source image from a free Gradio Space (no API key
needed) and can pipe it straight through the converter:

```sh
# generate only
node scripts/generate-hf.mjs --space owner/space --api-name /predict \
  --prompt "pixel art fox, side profile, baby, transparent background" \
  --out /tmp/fox.png

# generate + convert + wire in one command (extra flags pass to make-sprite)
node scripts/generate-hf.mjs --space owner/space --prompt "pixel art fox baby" \
  --out /tmp/fox.png --slug fox --stage baby --bg '#ffffff'
```

Per-Space setup: every Space has a different input signature. Open the Space's
**"Use via API"** panel (bottom of its page) to get the exact `--api-name` and
input order, then pass the inputs with `--data '<json-array>'` (overrides
`--prompt`/`--negative`). An `HF_TOKEN` env var or `--token` is optional and
only raises rate limits.

Requirements & caveats:
- **Network**: needs outbound access to `<space>.hf.space`. It will not run in a
  sandbox whose network policy blocks Hugging Face.
- Free Spaces sleep and queue — if it times out, just retry (`--timeout <sec>`).
- For style consistency across the four life stages, generate each stage as
  img2img from the previous one where the Space supports it.
- Speaks the modern Gradio 4.x+ `/call` protocol.

### Enabling Hugging Face egress on Claude Code on the web

`generate-hf.mjs` needs outbound network to Hugging Face. On the web, the
sandbox blocks it by default (a boot-time egress proxy returns HTTP 403 for
`huggingface.co` / `*.hf.space`). To run it in a web session:

1. Edit the **environment's network policy** (Claude Code on the web → environment
   config). Allow these hosts (or pick a less restrictive preset):
   - `huggingface.co`
   - `*.hf.space`  (Space app, Gradio `/call` endpoints, `/file=` outputs)
   - `*.huggingface.co`  (CDN/file hosts some Spaces redirect to)
   Docs: https://code.claude.com/docs/en/claude-code-on-the-web
2. **Start a new session.** The container is ephemeral and applies the egress
   policy at boot, so policy/env-var/setup-script changes only take effect in a
   fresh session — the running one won't pick them up.
3. Then live-test against a real Space, e.g.:
   ```sh
   node scripts/generate-hf.mjs --space owner/space --api-name /predict \
     --prompt "pixel art fox, side profile, baby" --out /tmp/fox.png
   ```
   Once a Space is chosen, bake its `--api-name`/`--data` defaults into a wrapper
   so they don't need to be passed each time.

Running on your **local machine** needs none of this — HF is already reachable.

## Species map

`scripts/species-map.json` maps each slug to its species emoji and controls the
order entries appear in `images.ts`. The 11 species with art today plus the 14
still on the fallback grid art (fox, bat, penguin, sloth, owl, eagle, kangaroo,
giraffe, tiger, elephant, crocodile, octopus, trex, merperson) are pre-listed.

## Re-wire without converting

If you add/remove PNGs in `assets/sprites/` by hand, regenerate the map:

```sh
node scripts/wire-sprites.mjs
```

It rebuilds the `IMAGE_SPRITES` block from the files that exist + the species
map. Idempotent — a no-op if nothing changed.

## Notes

- Rendering priority is PNG sprite → 24×24 code grid (`src/sprites/index.ts`) →
  emoji, so adding a PNG transparently upgrades a species.
- The converter snaps to the palette, so output stays consistent with the
  existing hand-drawn sprites regardless of which generator produced the input.
  Aesthetic consistency across the four life stages is still a human call —
  generating each stage as img2img from the previous one helps.

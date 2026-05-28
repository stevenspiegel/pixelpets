# Sprite pipeline

Turn any source image (an AI render, an Aseprite/LibreSprite export, a
hand-drawn PNG) into a game-ready pet sprite that matches the existing art —
then wire it into the app automatically. Runs fully offline: no API key, no
network, no `npm install` (PNG codec is built on Node's `zlib`).

## One sprite at a time

```sh
node scripts/make-sprite.mjs --in path/to/render.png --slug fox --stage baby
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
